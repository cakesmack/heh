import type { GuidedEventDraft, Performance, RecurrenceSchedule, ScheduleDateTime } from './guidedEventTypes';

const ukParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function addLocalDay(date: string): string {
  if (!validDate(date)) return '';
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

function ukWallTimeIssue(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match || !validDate(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59) return 'Enter a valid date and time.';
  const [year, month, day] = match[1].split('-').map(Number);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute);
  const matches = [wallUtc, wallUtc - 60 * 60 * 1000].filter((instant) => {
    const parts = Object.fromEntries(ukParts.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` === value;
  });
  if (matches.length === 0) return 'This UK time does not exist when the clocks change. Choose another time.';
  if (matches.length > 1) return 'This UK time occurs twice when the clocks change. Choose another time.';
  return null;
}

export function validateInterval(start: string, end: string, allDay = false): string | null {
  if (allDay) {
    const first = start.slice(0, 10);
    const last = end.slice(0, 10);
    if (!validDate(first) || !validDate(last)) return 'Add both start and finish dates.';
    if (last < first) return 'The finish date must be on or after the start date.';
    return null;
  }
  if (!start || !end) return 'Add both start and finish dates and times.';
  const startIssue = ukWallTimeIssue(start);
  if (startIssue) return `Start: ${startIssue}`;
  const endIssue = ukWallTimeIssue(end);
  if (endIssue) return `Finish: ${endIssue}`;
  if (end <= start) return 'The finish must be after the start.';
  return null;
}

export function applyOnceChange(current: ScheduleDateTime, patch: Partial<ScheduleDateTime>): { value: ScheduleDateTime; endCleared: boolean } {
  const value = { ...current, ...patch };
  if (('start' in patch || 'allDay' in patch) && value.end && validateInterval(value.start, value.end, value.allDay)) {
    return { value: { ...value, end: '' }, endCleared: true };
  }
  return { value, endCleared: false };
}

/** Turn a validated UK wall time into an ISO instant, independent of the browser timezone. */
export function toUkUtcIso(value: string): string {
  const issue = ukWallTimeIssue(value);
  if (issue) throw new Error(issue);
  const [year, month, day, hour, minute] = value.match(/\d+/g)!.map(Number);
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute);
  const matches = [wallUtc, wallUtc - 60 * 60 * 1000].filter((instant) => {
    const parts = Object.fromEntries(ukParts.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` === value;
  });
  return new Date(matches[0]).toISOString();
}

export function validatePerformances(performances: Performance[]): string | null {
  if (!performances.length) return 'Add at least one performance.';
  for (const [index, performance] of performances.entries()) {
    const issue = validateInterval(performance.start, performance.end);
    if (issue) return `Performance ${index + 1}: ${issue}`;
  }
  const sorted = [...performances].sort((a, b) => a.start.localeCompare(b.start));
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].start < sorted[index - 1].end) return 'Performances overlap or repeat. Give each one a distinct time.';
  }
  return null;
}

export function validateRecurrence(rule: RecurrenceSchedule): string | null {
  if (!validDate(rule.startDate)) return 'Choose the first event date.';
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 100) return 'Enter a repeat interval from 1 to 100.';
  if (rule.frequency === 'weekly' && rule.weekdays.length === 0) return 'Choose at least one weekday.';
  if (rule.endsOn === 'date' && (!validDate(rule.endDate) || rule.endDate < rule.startDate)) return 'Choose an end date on or after the first event.';
  if (!rule.allDay) {
    const endDate = rule.endsNextDay ? addLocalDay(rule.startDate) : rule.startDate;
    const issue = validateInterval(`${rule.startDate}T${rule.startTime}`, `${endDate}T${rule.endTime}`);
    if (issue) return issue;
  }
  return null;
}

export function validateSchedule(draft: GuidedEventDraft): string | null {
  if (!draft.scheduleMode) return 'Choose how your event is scheduled.';
  if (draft.scheduleMode === 'once') return validateInterval(draft.once.start, draft.once.end, draft.once.allDay);
  if (draft.scheduleMode === 'selected_dates') return validatePerformances(draft.performances);
  return validateRecurrence(draft.recurrence);
}

export function formatLocalDateTime(value: string, allDay = false): string {
  if (!value || !validDate(value.slice(0, 10))) return 'Date to add';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(Date.UTC(year, month - 1, day)));
  return allDay ? date : `${date}, ${value.slice(11, 16)}`;
}

export function scheduleSummary(draft: GuidedEventDraft): string {
  if (!draft.scheduleMode) return 'Not added yet';
  if (draft.scheduleMode === 'once') {
    if (!draft.once.start) return 'Just once · dates to add';
    const start = formatLocalDateTime(draft.once.start, draft.once.allDay);
    const end = draft.once.end ? formatLocalDateTime(draft.once.end, draft.once.allDay) : 'finish to add';
    return `Just once · ${start} → ${end} · UK time`;
  }
  if (draft.scheduleMode === 'selected_dates') {
    const count = draft.performances.length;
    return `Several dates or times · ${count} ${count === 1 ? 'performance' : 'performances'} · UK time`;
  }
  const rule = draft.recurrence;
  const unit = rule.frequency === 'daily' ? 'day' : rule.frequency === 'weekly' ? 'week' : 'month';
  const pattern = `Every ${rule.interval === 1 ? unit : `${rule.interval} ${unit}s`}`;
  const days = rule.frequency === 'weekly' && rule.weekdays.length
    ? ` on ${rule.weekdays.map((day) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day]).join(', ')}` : '';
  const monthly = rule.frequency !== 'monthly' ? '' : rule.monthlyMode === 'ordinal'
    ? ` on the ${rule.ordinal === -1 ? 'last' : ['first', 'second', 'third', 'fourth'][rule.ordinal - 1]} ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][rule.ordinalWeekday]}`
    : rule.startDate ? ` on day ${Number(rule.startDate.slice(8, 10))}` : ' on the first event’s calendar date';
  const ending = rule.endsOn === 'date' ? ` until ${rule.endDate || 'end date to add'}` : ' · ongoing';
  return `${pattern}${days}${monthly}${rule.startDate ? ` from ${rule.startDate}` : ''}${rule.allDay ? ' · all day' : ` at ${rule.startTime}–${rule.endTime}${rule.endsNextDay ? ' next day' : ''}`}${ending} · UK time`;
}
