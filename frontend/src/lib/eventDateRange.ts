export interface EventDateRange { from?: string; to?: string }
type Query = Record<string, string | string[] | undefined>;

export function calendarDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseCalendarDate(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return !isNaN(date.getTime()) && calendarDate(date) === value ? date : undefined;
}

export function rangeFromQuery(query: Query): EventDateRange {
  const from = typeof query.date_from === 'string' && parseCalendarDate(query.date_from) ? query.date_from : undefined;
  const to = typeof query.date_to === 'string' && parseCalendarDate(query.date_to) ? query.date_to : undefined;
  return from ? { from, to: to && to >= from ? to : from } : {};
}

export function rangeLabel(range: EventDateRange): string {
  const from = parseCalendarDate(range.from);
  if (!from) return 'Any date';
  const format = (date: Date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const to = parseCalendarDate(range.to);
  return to && range.to !== range.from ? `${format(from)} – ${format(to)}` : format(from);
}

export function quickDateRange(preset: 'today' | 'weekend' | 'week', now = new Date()): EventDateRange {
  // "Today" follows the event timezone even when the visitor is abroad.
  const london = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => london.find(item => item.type === type)!.value;
  const start = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00`);
  const end = new Date(start);
  if (preset === 'week') end.setDate(start.getDate() + 6);
  if (preset === 'weekend') {
    const weekday = start.getDay();
    start.setDate(start.getDate() + (weekday === 0 ? 0 : (6 - weekday + 7) % 7));
    end.setTime(start.getTime());
    if (weekday !== 0) end.setDate(start.getDate() + 1);
  }
  return { from: calendarDate(start), to: calendarDate(end) };
}

export function rangeApiFilters(range: EventDateRange) {
  if (!parseCalendarDate(range.from)) return {};
  // Stored event schedules are naive London-local values: no UTC conversion.
  return { date_from: `${range.from}T00:00:00`, date_to: `${range.to || range.from}T23:59:59.999999`, include_past: true };
}

export function withDateRange(query: Query, range: EventDateRange): Query {
  const next = { ...query };
  delete next.date;
  delete next.date_from;
  delete next.date_to;
  if (range.from) {
    next.date_from = range.from;
    next.date_to = range.to || range.from;
  }
  return next;
}

export function mergeEventSearchQuery(query: Query, filters: Record<string, unknown>): Query {
  let next = { ...query };
  for (const key of ['q', 'location', 'category', 'date', 'radius', 'latitude', 'longitude']) {
    if (Object.prototype.hasOwnProperty.call(filters, key)) {
      const value = filters[key];
      if (value === undefined || value === '') delete next[key];
      else next[key] = String(value);
    }
  }
  if ('dateFrom' in filters || 'dateTo' in filters) {
    next = withDateRange(next, { from: filters.dateFrom as string | undefined, to: filters.dateTo as string | undefined });
  }
  return next;
}
