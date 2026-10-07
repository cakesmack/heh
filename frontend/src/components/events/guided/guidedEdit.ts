import { RRule, rrulestr } from 'rrule';
import { parseInitialEventData } from '@/hooks/useEventWizard';
import type { EventResponse, EventUpdate } from '@/types';
import { INITIAL_DRAFT } from './useGuidedEventPreview';
import type { GuidedEventDraft } from './guidedEventTypes';
import { buildGuidedEventPayload, recurrenceFields } from './guidedCreation';
import { isHttpUrl } from './guidedFormHelpers';

/** Adapt the legacy wizard's hydration, retaining server identities separately. */
export function parseGuidedEventData(event: EventResponse): GuidedEventDraft {
  const data = parseInitialEventData(event);
  const start = data.date_start;
  const end = data.date_end || start;
  const recurrence = { ...INITIAL_DRAFT.recurrence, weekdays: [...data.weekdays],
    startDate: start.slice(0, 10), startTime: start.slice(11, 16), endTime: end.slice(11, 16),
    endsNextDay: end.slice(0, 10) > start.slice(0, 10), allDay: data.is_all_day,
    endsOn: data.ends_on === 'date' ? 'date' as const : 'ongoing' as const,
    endDate: data.recurrence_end_date.slice(0, 10),
  };
  if (data.recurrence_rule) {
    const rule = rrulestr(data.recurrence_rule, { dtstart: new Date(`${start}:00Z`) });
    if (!(rule instanceof RRule)) throw new Error('This recurrence requires the legacy editor.');
    const options = rule.options;
    recurrence.frequency = options.freq === RRule.MONTHLY ? 'monthly' : options.freq === RRule.DAILY ? 'daily' : 'weekly';
    recurrence.interval = options.interval;
    // RRule weekday indices already use Monday = 0.
    recurrence.weekdays = options.byweekday ? [...options.byweekday] : [(new Date(`${start}:00Z`).getUTCDay() + 6) % 7];
    const ordinalDay = options.bynweekday?.[0];
    if (options.bysetpos?.length || ordinalDay) {
      recurrence.monthlyMode = 'ordinal';
      recurrence.ordinal = options.bysetpos?.[0] ?? ordinalDay![1];
      recurrence.ordinalWeekday = options.byweekday?.[0] ?? ordinalDay![0];
    }
    if (options.until && !recurrence.endDate) {
      recurrence.endsOn = 'date';
      recurrence.endDate = options.until.toISOString().slice(0, 10);
    }
  } else {
    recurrence.frequency = data.frequency === 'MONTHLY' ? 'monthly' : 'weekly';
    recurrence.interval = data.frequency === 'BIWEEKLY' ? 2 : 1;
    if (!recurrence.weekdays.length) recurrence.weekdays = [(new Date(`${start}:00Z`).getUTCDay() + 6) % 7];
  }
  const doorMatch = (event.price_display || '').match(/£([\d.]+)\s+at the door/i);
  const booking = isHttpUrl(data.ticket_url);
  const attendanceMode = data.is_ticketing_enabled ? 'native' : doorMatch || (!booking && Number(data.price) > 0) ? 'door' : booking ? 'external' : 'free';
  return {
    ...INITIAL_DRAFT,
    title: data.title, venueMode: data.locationTab === 'multi' ? 'multiple' : 'single',
    singleVenueId: data.venue_id || null, singleVenue: event.venue ?? null,
    participatingVenues: event.participating_venues ?? [],
    existingLocationName: !data.venue_id ? data.location_name : '',
    scheduleMode: data.is_recurring ? 'recurring' : data.isMultiSession ? 'selected_dates' : 'once',
    once: { start: data.is_all_day ? start.slice(0, 10) : start, end: data.is_all_day ? end.slice(0, 10) : end, allDay: data.is_all_day },
    performances: data.showtimes.map((showtime, index) => ({ id: String(event.showtimes?.[index]?.id || `existing-${index}`), start: showtime.start_time, end: showtime.end_time || showtime.start_time, notes: showtime.notes, ticket_url: showtime.ticket_url })),
    recurrence, attendanceMode,
    doorPrice: doorMatch?.[1] ?? (attendanceMode === 'door' ? data.price : ''),
    doorReservationRequired: attendanceMode === 'door' && booking,
    doorReservationUrl: attendanceMode === 'door' && booking ? data.ticket_url : '',
    externalUrl: attendanceMode === 'external' ? data.ticket_url : '',
    externalIsFree: attendanceMode === 'external' ? Number(data.price) === 0 && !/paid/i.test(event.price_display || '') : null,
    ticketTiers: data.ticket_tiers.map((tier, index) => ({ ...tier, id: event.ticket_tiers?.[index]?.id || `existing-${index}`, serverId: event.ticket_tiers?.[index]?.id })),
    passFeesToBuyer: Boolean(data.pass_fees_to_buyer), termsAccepted: Boolean(data.terms_accepted),
    description: data.description, categoryId: data.category_id, categoryName: event.category?.name || '',
    organizerId: data.organizer_profile_id, organizerName: event.organizer_profile?.name || event.organizer_profile_name || '',
    tags: data.tags, ageRestriction: String(data.age_restriction || ''), websiteUrl: data.website_url,
    existingImageUrl: data.image_url, imagePreviewUrl: data.image_url, imageName: data.image_url ? 'Current event photo' : '', imageFile: null,
  };
}

function scheduleValue(draft: GuidedEventDraft) {
  return JSON.stringify([draft.scheduleMode, draft.scheduleMode === 'once' ? draft.once : draft.scheduleMode === 'recurring' ? draft.recurrence : draft.performances]);
}

/** Use the same canonical creation payload, then apply existing update semantics. */
export function buildGuidedEventUpdate(draft: GuidedEventDraft, event: EventResponse, imageUrl?: string): EventUpdate {
  const original = parseGuidedEventData(event);
  const payload: EventUpdate = {
    ...buildGuidedEventPayload(draft, imageUrl ?? draft.existingImageUrl),
    description: draft.description || null, image_url: (imageUrl ?? draft.existingImageUrl) || null,
    ticket_url: draft.attendanceMode === 'external' ? draft.externalUrl.trim() : draft.attendanceMode === 'door' && draft.doorReservationRequired ? draft.doorReservationUrl.trim() : null,
    website_url: draft.websiteUrl.trim() || null, age_restriction: draft.ageRestriction || null,
    tags: draft.tags, organizer_profile_id: draft.organizerId || null,
    participating_venue_ids: draft.venueMode === 'multiple' ? draft.participatingVenues.map((venue) => venue.id) : [],
  };
  // Preserve legacy main-venue/custom map metadata unless location was changed.
  if (draft.venueMode === original.venueMode && draft.singleVenueId === original.singleVenueId) {
    payload.venue_id = event.venue_id || null;
    payload.location_name = event.location_name;
    payload.latitude = event.latitude;
    payload.longitude = event.longitude;
    payload.map_display_lat = event.map_display_lat;
    payload.map_display_lng = event.map_display_lng;
    payload.map_display_label = event.map_display_label;
  }
  const scheduleChanged = scheduleValue(draft) !== scheduleValue(original);
  if (!scheduleChanged) {
    for (const key of ['date_start', 'date_end', 'is_all_day', 'showtimes', 'is_recurring', 'recurrence_rule', 'frequency', 'recurrence_end_date', 'weekdays'] as const) delete (payload as Record<string, unknown>)[key];
  } else if (draft.scheduleMode === 'recurring') {
    payload.recurrence_rule = recurrenceFields(draft.recurrence, true).recurrence_rule;
    payload.frequency = 'CUSTOM';
    payload.recurrence_end_date = draft.recurrence.endsOn === 'date' ? `${draft.recurrence.endDate}T23:59:59Z` : null;
    payload.showtimes = [];
  } else {
    payload.recurrence_rule = null;
    payload.recurrence_end_date = null;
    payload.showtimes = draft.scheduleMode === 'selected_dates' ? draft.performances.map((performance) => ({ start_time: `${performance.start}:00`, end_time: `${performance.end}:00`, notes: performance.notes, ticket_url: performance.ticket_url })) : [];
  }
  if (draft.attendanceMode === 'native') {
    payload.ticket_tiers = draft.ticketTiers.map(({ serverId, id, ...tier }) => {
      const existing = event.ticket_tiers?.find((item) => item.id === serverId);
      return { ...tier, ...(serverId ? { id: serverId } : {}), sale_start: existing?.sale_start ?? null, sale_end: existing?.sale_end ?? null, is_hidden: existing?.is_hidden ?? false };
    });
  }
  // Do not replace display-price text on an unrelated metadata edit.
  if (draft.attendanceMode !== 'native' && JSON.stringify([draft.attendanceMode, draft.doorPrice, draft.externalIsFree]) === JSON.stringify([original.attendanceMode, original.doorPrice, original.externalIsFree])) delete payload.price;
  return payload;
}
