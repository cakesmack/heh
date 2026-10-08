type Performance = { start_time: string; end_time?: string | null };
type ScheduledEvent = {
  date_start: string;
  date_end?: string | null;
  is_all_day?: boolean;
  showtimes?: Performance[];
};

// Compare London wall-clock schedules, not the browser's local timezone.
function scheduleTime(value: string): number {
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const instant = new Date(value);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant);
    const part = (name: string) => Number(parts.find(p => p.type === name)?.value);
    return Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'), instant.getUTCMilliseconds());
  }
  return new Date(`${value}Z`).getTime();
}

function performanceEnd(performance: Performance, allDay: boolean): number {
  const end = scheduleTime(performance.end_time || performance.start_time);
  if (!allDay) return end;
  const day = new Date(end);
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 23, 59, 59, 999);
}

export function upcomingPerformances(event: ScheduledEvent, now = new Date()): Performance[] {
  const localNow = scheduleTime(now.toISOString());
  const performances = event.showtimes?.length ? event.showtimes : [{ start_time: event.date_start, end_time: event.date_end }];
  const seen = new Set<number>();
  return performances.filter(performance => {
    const start = scheduleTime(performance.start_time);
    if (performanceEnd(performance, !!event.is_all_day) < localNow || seen.has(start)) return false;
    seen.add(start);
    return true;
  }).sort((a, b) => scheduleTime(a.start_time) - scheduleTime(b.start_time));
}

export function eventHasEnded(event: ScheduledEvent, now = new Date()): boolean {
  return upcomingPerformances(event, now).length === 0;
}
