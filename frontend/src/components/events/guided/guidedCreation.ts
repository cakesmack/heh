import { buildEventPayload, WIZARD_DEFAULTS, type WizardFormData } from '@/hooks/useEventWizard';
import type { EventCreate } from '@/types';
import type { GuidedEventDraft, GuidedQuestionId } from './guidedEventTypes';
import { validateAttendance, validateDetails, validateFinishing } from './guidedFormHelpers';
import { toUkUtcIso, validateSchedule } from './scheduleHelpers';

export type CreationIssue = { question: GuidedQuestionId; message: string };

export function validateGuidedCreation(draft: GuidedEventDraft): CreationIssue | null {
  if (!draft.title.trim() || draft.title.length > 255) return { question: 'title', message: 'Enter an event name of 255 characters or less.' };
  if (draft.venueMode === 'single' ? !draft.singleVenueId : draft.participatingVenues.length === 0) return { question: 'venue', message: 'Choose at least one registered venue.' };
  const scheduleIssue = validateSchedule(draft);
  if (scheduleIssue) return { question: 'schedule', message: scheduleIssue };
  // The current recurrence generator does not faithfully publish all guided rules.
  if (draft.scheduleMode === 'recurring') return { question: 'schedule', message: 'Recurring events cannot be created from this guided form yet. The existing recurrence generator needs verification first.' };
  const attendanceIssue = validateAttendance(draft);
  if (attendanceIssue) return { question: 'attendance', message: attendanceIssue };
  if (draft.attendanceMode === 'native') return { question: 'attendance', message: 'Highland Events Hub ticket creation is not available in this guided form yet.' };
  const detailsIssue = validateDetails(draft);
  if (detailsIssue) return { question: 'details', message: detailsIssue };
  const finishingIssue = validateFinishing(draft);
  if (finishingIssue) return { question: 'finishing', message: finishingIssue };
  return null;
}

function priceForAttendance(draft: GuidedEventDraft): string {
  if (draft.attendanceMode === 'door') return `£${Number(draft.doorPrice).toFixed(2)} at the door`;
  if (draft.attendanceMode === 'external' && !draft.externalIsFree) return 'Paid — see booking site';
  return 'Free';
}

/** Adapt guided answers to the live wizard's canonical payload builder. */
export function buildGuidedEventPayload(draft: GuidedEventDraft, imageUrl?: string): EventCreate {
  const issue = validateGuidedCreation(draft);
  if (issue) throw new Error(issue.message);

  const isSeveralDates = draft.scheduleMode === 'selected_dates';
  const performances = [...draft.performances].sort((a, b) => a.start.localeCompare(b.start));
  const startLocal = isSeveralDates ? performances[0].start : draft.once.allDay ? `${draft.once.start.slice(0, 10)}T00:00` : draft.once.start;
  const endLocal = isSeveralDates ? [...performances].sort((a, b) => a.end.localeCompare(b.end)).at(-1)!.end : draft.once.allDay ? `${draft.once.end.slice(0, 10)}T23:59` : draft.once.end;
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
    is_all_day: !isSeveralDates && draft.once.allDay,
    isMultiSession: isSeveralDates,
    // Showtime fields are event-local wall times in the existing create API.
    showtimes: isSeveralDates ? performances.map((performance) => ({ start_time: `${performance.start}:00`, end_time: `${performance.end}:00` })) : [],
    description: draft.description,
    image_url: imageUrl || '',
    price: priceForAttendance(draft),
    ticket_url: draft.attendanceMode === 'external' ? draft.externalUrl.trim() : draft.attendanceMode === 'door' && draft.doorReservationRequired ? draft.doorReservationUrl.trim() : '',
    website_url: draft.websiteUrl.trim(),
    age_restriction: draft.ageRestriction,
    tags: draft.tags,
    is_ticketing_enabled: false,
    ticket_tiers: [],
    pass_fees_to_buyer: false,
  };
  const payload = buildEventPayload(data);
  // The live wizard's envelope uses the viewer's local timezone for showtimes.
  // Override just these two values with UK event-local conversions.
  return { ...payload, date_start: dateStart, date_end: dateEnd };
}
