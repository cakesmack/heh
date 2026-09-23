import { buildEventPayload, WIZARD_DEFAULTS, type WizardFormData } from '@/hooks/useEventWizard';
import { RRule } from 'rrule';
import type { EventCreate } from '@/types';
import type { GuidedEventDraft, GuidedQuestionId, RecurrenceSchedule } from './guidedEventTypes';
import { validateAttendance, validateDetails, validateFinishing, validateNativeTerms, validateTickets } from './guidedFormHelpers';
import { addLocalDay, toUkUtcIso, validateSchedule } from './scheduleHelpers';

export type CreationIssue = { question: GuidedQuestionId; message: string };

export function validateGuidedCreation(draft: GuidedEventDraft): CreationIssue | null {
  if (!draft.title.trim() || draft.title.length > 255) return { question: 'title', message: 'Enter an event name of 255 characters or less.' };
  if (draft.venueMode === 'single' ? !draft.singleVenueId : draft.participatingVenues.length === 0) return { question: 'venue', message: 'Choose at least one registered venue.' };
  const scheduleIssue = validateSchedule(draft);
  if (scheduleIssue) return { question: 'schedule', message: scheduleIssue };
  const attendanceIssue = validateAttendance(draft);
  if (attendanceIssue) return { question: 'attendance', message: attendanceIssue };
  const ticketIssue = validateTickets(draft);
  if (ticketIssue) return { question: 'tickets', message: ticketIssue };
  const detailsIssue = validateDetails(draft);
  if (detailsIssue) return { question: 'details', message: detailsIssue };
  const finishingIssue = validateFinishing(draft);
  if (finishingIssue) return { question: 'finishing', message: finishingIssue };
  const termsIssue = validateNativeTerms(draft);
  if (termsIssue) return { question: 'review', message: termsIssue };
  return null;
}

function priceForAttendance(draft: GuidedEventDraft): string {
  if (draft.attendanceMode === 'door') return `£${Number(draft.doorPrice).toFixed(2)} at the door`;
  if (draft.attendanceMode === 'external' && !draft.externalIsFree) return 'Paid — see booking site';
  return 'Free';
}

const rruleWeekdays = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU];

function recurrenceFields(rule: RecurrenceSchedule): Pick<WizardFormData, 'is_recurring' | 'frequency' | 'recurrence_rule' | 'recurrence_end_date' | 'ends_on' | 'weekdays'> {
  const simpleWeekly = rule.frequency === 'weekly' && (rule.interval === 1 || rule.interval === 2);
  const simpleMonthly = rule.frequency === 'monthly' && rule.interval === 1 && rule.monthlyMode === 'date';
  const frequency = simpleWeekly ? rule.interval === 1 ? 'WEEKLY' : 'BIWEEKLY' : simpleMonthly ? 'MONTHLY' : 'CUSTOM';
  const endDate = rule.endsOn === 'date' ? `${rule.endDate}T23:59:59Z` : '';
  let recurrenceRule = '';
  if (frequency === 'CUSTOM') {
    const options: ConstructorParameters<typeof RRule>[0] = {
      freq: rule.frequency === 'daily' ? RRule.DAILY : rule.frequency === 'weekly' ? RRule.WEEKLY : RRule.MONTHLY,
      interval: rule.interval,
    };
    if (rule.frequency === 'weekly') options.byweekday = rule.weekdays.map((day) => rruleWeekdays[day]);
    if (rule.frequency === 'monthly') {
      if (rule.monthlyMode === 'ordinal') {
        options.byweekday = [rruleWeekdays[rule.ordinalWeekday]];
        options.bysetpos = rule.ordinal;
      } else {
        options.bymonthday = Number(rule.startDate.slice(8, 10));
      }
    }
    if (endDate) options.until = new Date(endDate);
    recurrenceRule = new RRule(options).toString().replace(/^RRULE:/, '');
  }
  return {
    is_recurring: true,
    frequency,
    recurrence_rule: recurrenceRule,
    recurrence_end_date: endDate,
    ends_on: rule.endsOn === 'date' ? 'date' : 'never',
    weekdays: rule.frequency === 'weekly' ? [...rule.weekdays] : [],
  };
}

/** Adapt guided answers to the live wizard's canonical payload builder. */
export function buildGuidedEventPayload(draft: GuidedEventDraft, imageUrl?: string): EventCreate {
  const issue = validateGuidedCreation(draft);
  if (issue) throw new Error(issue.message);

  const isSeveralDates = draft.scheduleMode === 'selected_dates';
  const isRecurring = draft.scheduleMode === 'recurring';
  const performances = [...draft.performances].sort((a, b) => a.start.localeCompare(b.start));
  const recurrence = draft.recurrence;
  const startLocal = isSeveralDates ? performances[0].start : isRecurring ? `${recurrence.startDate}T${recurrence.allDay ? '00:00' : recurrence.startTime}` : draft.once.allDay ? `${draft.once.start.slice(0, 10)}T00:00` : draft.once.start;
  const recurringEndDate = recurrence.endsNextDay ? addLocalDay(recurrence.startDate) : recurrence.startDate;
  const endLocal = isSeveralDates ? [...performances].sort((a, b) => a.end.localeCompare(b.end)).at(-1)!.end : isRecurring ? `${recurrence.allDay ? recurrence.startDate : recurringEndDate}T${recurrence.allDay ? '23:59' : recurrence.endTime}` : draft.once.allDay ? `${draft.once.end.slice(0, 10)}T23:59` : draft.once.end;
  const dateStart = toUkUtcIso(startLocal);
  const dateEnd = toUkUtcIso(endLocal);

  const data: WizardFormData = {
    ...WIZARD_DEFAULTS,
    title: draft.title.trim(),
    category_id: draft.categoryId,
    selectedOrganizer: draft.organizerId,
    organizer_profile_id: draft.organizerId,
    locationTab: draft.venueMode === 'single' ? 'main' : 'multi',
    venue_id: draft.venueMode === 'single' ? draft.singleVenueId || '' : '',
    participating_venue_ids: draft.venueMode === 'multiple' ? draft.participatingVenues.map((venue) => venue.id) : [],
    date_start: dateStart,
    date_end: dateEnd,
    is_all_day: !isSeveralDates && (isRecurring ? recurrence.allDay : draft.once.allDay),
    isMultiSession: isSeveralDates,
    ...(isRecurring ? recurrenceFields(recurrence) : {}),
    // Showtime fields are event-local wall times in the existing create API.
    showtimes: isSeveralDates ? performances.map((performance) => ({ start_time: `${performance.start}:00`, end_time: `${performance.end}:00` })) : [],
    description: draft.description,
    image_url: imageUrl || '',
    price: priceForAttendance(draft),
    ticket_url: draft.attendanceMode === 'external' ? draft.externalUrl.trim() : draft.attendanceMode === 'door' && draft.doorReservationRequired ? draft.doorReservationUrl.trim() : '',
    website_url: draft.websiteUrl.trim(),
    age_restriction: draft.ageRestriction,
    tags: draft.tags,
    is_ticketing_enabled: draft.attendanceMode === 'native',
    ticket_tiers: draft.attendanceMode === 'native' ? draft.ticketTiers.map(({ name, price, quantity_available, max_per_order }) => ({ name, price, quantity_available, max_per_order })) : [],
    pass_fees_to_buyer: draft.attendanceMode === 'native' && draft.passFeesToBuyer,
    terms_accepted: draft.attendanceMode === 'native' && draft.termsAccepted,
  };
  const payload = buildEventPayload(data);
  // The live wizard's envelope uses the viewer's local timezone for showtimes.
  // Override just these two values with UK event-local conversions.
  return { ...payload, date_start: dateStart, date_end: dateEnd };
}
