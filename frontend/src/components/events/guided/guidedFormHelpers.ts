import type { GuidedEventDraft } from './guidedEventTypes';
import { getStepValidator, WIZARD_DEFAULTS } from '@/hooks/useEventWizard';
import { validateInterval } from './scheduleHelpers';

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function nativeTicketIssue(draft: GuidedEventDraft): string | null {
  if (draft.scheduleMode !== 'once') return 'Highland Events Hub tickets currently support one-off single events only. Choose another attendance method for repeating or several-date events.';
  if (validateInterval(draft.once.start, draft.once.end, draft.once.allDay)) return 'Complete a valid one-off schedule before configuring Highland Events Hub tickets.';
  // Compare event-local wall times only; never interpret them in the viewer's timezone.
  const wallTimeMs = (value: string) => Date.parse(`${value.length === 10 ? `${value}T00:00` : value}:00Z`);
  const start = wallTimeMs(draft.once.start);
  const end = wallTimeMs(draft.once.end);
  if (Number.isFinite(start) && Number.isFinite(end) && (end - start) > 36 * 60 * 60 * 1000) return 'Highland Events Hub tickets are limited to events lasting 36 hours or less.';
  if (draft.once.allDay) {
    const startDay = Date.parse(`${draft.once.start.slice(0, 10)}T00:00:00Z`);
    const endDay = Date.parse(`${draft.once.end.slice(0, 10)}T00:00:00Z`);
    // All-day end dates are inclusive: two calendar days mean a 48-hour event.
    if (endDay > startDay) return 'Highland Events Hub tickets are limited to events lasting 36 hours or less.';
  }
  return null;
}

export function validateAttendance(draft: GuidedEventDraft): string | null {
  switch (draft.attendanceMode) {
    case 'free': return null;
    case 'door':
      if (!draft.doorPrice.trim() || !Number.isFinite(Number(draft.doorPrice)) || Number(draft.doorPrice) <= 0) return 'Enter a pay-at-door price greater than £0.';
      if (Math.abs(Math.round(Number(draft.doorPrice) * 100) - Number(draft.doorPrice) * 100) > 0.000001) return 'Enter the door price in pounds and pence.';
      if (draft.doorReservationRequired && !isHttpUrl(draft.doorReservationUrl)) return 'Enter a valid HTTP(S) reservation URL.';
      if (draft.doorReservationRequired && draft.doorReservationUrl.length > 500) return 'Reservation URL must be 500 characters or less.';
      return null;
    case 'external':
      if (!isHttpUrl(draft.externalUrl)) return 'Enter a valid HTTP(S) booking URL.';
      if (draft.externalUrl.length > 500) return 'Booking URL must be 500 characters or less.';
      if (draft.externalIsFree === null) return 'Choose whether external booking is free or paid.';
      return null;
    case 'native': return nativeTicketIssue(draft);
    default: return 'Choose how people can attend.';
  }
}

export function validateTickets(draft: GuidedEventDraft): string | null {
  if (draft.attendanceMode !== 'native') return null;
  const eligibilityIssue = nativeTicketIssue(draft);
  if (eligibilityIssue) return eligibilityIssue;
  const wizardErrors = getStepValidator(4, true)({ ...WIZARD_DEFAULTS, is_ticketing_enabled: true, ticket_tiers: draft.ticketTiers });
  if (wizardErrors) return Object.values(wizardErrors)[0];
  if (!draft.ticketTiers.length) return 'Add at least one ticket tier.';
  for (const [index, tier] of draft.ticketTiers.entries()) {
    const label = `Tier ${index + 1}`;
    if (!tier.name.trim()) return `${label}: enter a name.`;
    if (!Number.isFinite(tier.price) || tier.price < 0 || Math.abs(Math.round(tier.price * 100) - tier.price * 100) > 0.000001) return `${label}: enter a valid price in pounds and pence.`;
    if (!Number.isInteger(tier.quantity_available) || tier.quantity_available < 1) return `${label}: enter a capacity greater than zero.`;
    if (!Number.isInteger(tier.max_per_order) || tier.max_per_order < 1 || tier.max_per_order > tier.quantity_available) return `${label}: max per order must be between 1 and its capacity.`;
  }
  return null;
}

export function validateNativeTerms(draft: GuidedEventDraft): string | null {
  if (draft.attendanceMode !== 'native') return null;
  const wizardErrors = getStepValidator(5, true)({ ...WIZARD_DEFAULTS, is_ticketing_enabled: true, terms_accepted: draft.termsAccepted });
  return wizardErrors?.terms_accepted || null;
}

export function validateDetails(draft: GuidedEventDraft): string | null {
  if (!draft.categoryId) return 'Choose a category.';
  if (draft.description.length > 20000) return 'Description must be 20,000 characters or less.';
  return null;
}

export function validateFinishing(draft: GuidedEventDraft): string | null {
  if (draft.websiteUrl.trim() && !isHttpUrl(draft.websiteUrl)) return 'Enter a valid HTTP(S) event website URL.';
  if (draft.websiteUrl.length > 500) return 'Event website URL must be 500 characters or less.';
  if (draft.tags.length > 5) return 'Choose no more than five tags.';
  return null;
}

export function attendanceSummary(draft: GuidedEventDraft): string {
  switch (draft.attendanceMode) {
    case 'free': return 'Free entry · just turn up';
    case 'door': return `Pay at door${draft.doorPrice ? ` · £${draft.doorPrice}` : ''}${draft.doorReservationRequired ? ' · reservation required' : ''}`;
    case 'external': return `Book elsewhere · ${draft.externalIsFree === null ? 'price to add' : draft.externalIsFree ? 'free' : 'paid'}`;
    case 'native': return nativeTicketIssue(draft) ? 'Highland Events Hub tickets · schedule incompatible' : 'Highland Events Hub tickets';
    default: return 'Not added yet';
  }
}
