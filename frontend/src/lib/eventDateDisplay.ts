import { performanceEnd, scheduleTime } from './eventOccurrences';
import { getDateRangeFromFilter } from './dateUtils';

export type EventDateContext = { now?: Date; date_from?: string; date_to?: string };
type Schedule = {
  date_start: string;
  date_end?: string | null;
  is_all_day?: boolean;
  is_recurring?: boolean;
  parent_event_id?: string | null;
  recurrence_group_id?: string | null;
  recurrence_rule?: string | null;
  next_occurrence?: string | null;
  showtimes?: { start_time: string; end_time?: string | null }[];
};

// Values are London wall-clock coordinates, represented in UTC solely for
// formatting/comparison. They are NOT replacement event timestamps.
export function formatDisplayDate(value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  const time = scheduleTime(value);
  return Number.isFinite(time) ? new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(time)) : 'Date to be confirmed';
}

const dayKey = (time: number) => new Date(time).toISOString().slice(0, 10);
export function londonDisplayDay(now = new Date()) { return dayKey(scheduleTime(now.toISOString())); }

export function eventDateContext(filters: { date?: string; date_from?: string; date_to?: string; dateFrom?: string; dateTo?: string }): EventDateContext {
  if (filters.date_from || filters.date_to) return { date_from: filters.date_from, date_to: filters.date_to };
  if (filters.dateFrom || filters.dateTo) return getDateRangeFromFilter('custom', filters.dateFrom, filters.dateTo);
  if (filters.date === 'past') return { date_to: new Date().toISOString() };
  return getDateRangeFromFilter(filters.date === 'this-weekend' ? 'weekend' : filters.date || '');
}

export function resolveEventDateDisplay(event: Schedule, context: EventDateContext = {}) {
  const now = scheduleTime((context.now || new Date()).toISOString());
  const filtered = Boolean(context.date_from || context.date_to);
  const lower = context.date_from ? scheduleTime(context.date_from) : filtered ? -Infinity : now;
  const upper = context.date_to ? scheduleTime(context.date_to.length === 10 ? `${context.date_to}T23:59:59.999` : context.date_to) : Infinity;
  const recurring = Boolean(event.is_recurring || event.parent_event_id || event.recurrence_group_id || event.recurrence_rule);
  const showtime = Boolean(event.showtimes?.length);
  // Recurring discovery responses already represent the server-selected actual
  // occurrence. Never generate dates from RRULE or override a filtered response.
  const baseStart = !filtered && recurring && event.next_occurrence ? event.next_occurrence : event.date_start;
  const baseEnd = scheduleTime(event.date_end || '') < scheduleTime(baseStart) ? undefined : event.date_end;
  const candidates = (showtime ? event.showtimes! : [{ start_time: baseStart, end_time: baseEnd }])
    .map(performance => ({ performance, start: scheduleTime(performance.start_time), end: performanceEnd(performance, !!event.is_all_day) }))
    .filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end >= item.start)
    .sort((a, b) => a.start - b.start);
  const matching = candidates.filter(item => item.end >= lower && item.start <= upper);
  const current = matching.find(item => item.start <= now && item.end >= now);
  const chosen = filtered ? matching[0] : current || matching[0] || candidates.at(-1);
  const factualStart = event.date_start;
  const factualEnd = event.date_end || event.date_start;
  const factualRangeLabel = formatDisplayDate(factualStart) + (dayKeySafe(factualStart) !== dayKeySafe(factualEnd) ? ` – ${formatDisplayDate(factualEnd)}` : '');
  const unavailable = !chosen || (!filtered && event.is_recurring && !event.parent_event_id && !event.next_occurrence && chosen.end < now);
  if (unavailable) return {
    displayStart: null, displayEnd: null, groupingDate: null, displayLabel: 'Dates to be confirmed',
    timeLabel: '', dateTimeLabel: 'Dates to be confirmed', isOngoing: false, isActive: false,
    representsPerformance: showtime || recurring, kind: showtime ? 'showtime' : recurring ? 'occurrence' : 'one-off',
    factualStart, factualEnd, factualRangeLabel,
  };
  const { start, end, performance } = chosen;
  const isActive = start <= now && end >= now;
  // No separate continuous flag exists: an uninterrupted multi-day one-off is
  // eligible, but never a series/showtime envelope or a short overnight session.
  const continuous = !recurring && !showtime && dayKey(start) !== dayKey(end) && end - start > 24 * 60 * 60 * 1000;
  const isOngoing = continuous && isActive;
  const short = (value: string) => formatDisplayDate(value).toUpperCase();
  const displayEnd = performance.end_time || performance.start_time;
  const dateLabel = short(performance.start_time) + (dayKey(start) !== dayKey(end) ? ` - ${short(displayEnd)}` : '');
  const displayLabel = isOngoing ? `ONGOING • UNTIL ${short(displayEnd)}` : dateLabel;
  const timeLabel = event.is_all_day ? 'All day' : formatDisplayDate(performance.start_time, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const grouping = continuous && filtered ? Math.max(start, Number.isFinite(lower) ? lower : start) : isOngoing ? now : start;
  return {
    displayStart: performance.start_time, displayEnd, groupingDate: dayKey(grouping),
    displayLabel, timeLabel, dateTimeLabel: isOngoing ? displayLabel : `${displayLabel} • ${timeLabel}`,
    isOngoing, isActive, representsPerformance: showtime || recurring,
    kind: showtime ? 'showtime' : recurring ? 'occurrence' : continuous ? 'continuous' : 'one-off',
    factualStart, factualEnd, factualRangeLabel,
  };
}

function dayKeySafe(value: string) {
  const time = scheduleTime(value);
  return Number.isFinite(time) ? dayKey(time) : '';
}
