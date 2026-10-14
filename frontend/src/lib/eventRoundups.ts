import { londonDisplayDay, formatDisplayDate } from './eventDateDisplay';

export interface RoundupCandidate {
  id: string; title: string; date_start: string; date_end?: string | null;
  image_url?: string | null; venue_name?: string | null; venue_address?: string | null; town?: string | null;
  category_name?: string | null; category_color?: string | null;
  view_count: number; website_click_count: number; ticket_click_count: number; popularity_score: number;
}
export interface RoundupShortlist { start: string; end: string; location_name?: string | null; candidates: RoundupCandidate[] }

// London calendar arithmetic, independent of the admin computer's timezone/DST.
export function upcomingMondayWindow(now = new Date()) {
  const day = new Date(`${londonDisplayDay(now)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + ((8 - day.getUTCDay()) % 7 || 7));
  const start = day.toISOString().slice(0, 10);
  day.setUTCDate(day.getUTCDate() + 7);
  return { start, end: day.toISOString().slice(0, 10) };
}
export function monthWindow(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Choose a valid month');
  const day = new Date(`${month}-01T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 7) !== month) throw new Error('Choose a valid month');
  day.setUTCMonth(day.getUTCMonth() + 1);
  return { start: `${month}-01`, end: day.toISOString().slice(0, 10) };
}
export function roundupRangeLabel(start: string, end: string) {
  const last = new Date(`${end.slice(0, 10)}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() - 1);
  const firstDay = start.slice(0, 10), lastDay = last.toISOString().slice(0, 10);
  if (firstDay === lastDay) return formatDisplayDate(firstDay, { day: 'numeric', month: 'long', year: 'numeric' });
  if (firstDay.slice(0, 7) === lastDay.slice(0, 7)) {
    return `${formatDisplayDate(firstDay, { day: 'numeric' })}–${formatDisplayDate(lastDay, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  const sameYear = firstDay.slice(0, 4) === lastDay.slice(0, 4);
  return `${formatDisplayDate(firstDay, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })}–${formatDisplayDate(lastDay, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
export function toggleRoundupSelection(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter(value => value !== id);
  return selected.length < 10 ? [...selected, id] : selected;
}
export function moveRoundupSelection(selected: string[], index: number, direction: -1 | 1) {
  const next = [...selected], target = index + direction;
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function posterCategoryColor(color?: string | null) {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : '#6B7280';
}
