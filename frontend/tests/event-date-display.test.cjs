const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
};
const { resolveEventDateDisplay: resolve, formatDisplayDate, eventDateContext } = require('../src/lib/eventDateDisplay.ts');
const now = new Date('2026-10-12T11:00:00Z');
const context = { now };
const exhibition = { date_start: '2026-06-12T10:00:00', date_end: '2026-10-31T17:00:00' };
const event = (start, end) => ({ date_start: `${start}T10:00:00`, date_end: `${end || start}T12:30:00` });
const show = day => ({ start_time: `${day}T10:00:00`, end_time: `${day}T12:30:00` });
const several = { ...event('2026-11-15', '2026-12-13'), showtimes: [show('2026-12-13'), show('2026-11-15'), show('2026-11-22')] };

test('future one-day event preserves its real date', () => {
  const display = resolve(event('2026-10-24'), context);
  assert.equal(display.displayLabel, '24 OCT');
  assert.equal(display.groupingDate, '2026-10-24');
  assert.equal(display.isOngoing, false);
});
test('future multi-day event preserves the actual range', () => {
  assert.equal(resolve(event('2026-10-24', '2026-10-26'), context).displayLabel, '24 OCT - 26 OCT');
  assert.equal(resolve(event('2026-11-01', '2027-03-02'), context).displayLabel, '1 NOV - 2 MAR');
});
test('active continuous event uses ongoing label and today grouping without mutation', () => {
  const before = JSON.stringify(exhibition);
  const display = resolve(exhibition, context);
  assert.equal(display.displayLabel, 'ONGOING • UNTIL 31 OCT');
  assert.equal(display.groupingDate, '2026-10-12');
  assert.equal(display.isOngoing, true);
  assert.equal(JSON.stringify(exhibition), before);
});
test('ended continuous event is not ongoing', () => {
  assert.equal(resolve(exhibition, { now: new Date('2026-11-01T12:00:00Z') }).displayLabel, '12 JUN - 31 OCT');
  assert.equal(resolve(exhibition, { now: new Date('2026-11-01T12:00:00Z') }).isOngoing, false);
});
test('recurring series uses the API-selected next occurrence, never its original anchor', () => {
  const series = { ...event('2026-05-07'), is_recurring: true, next_occurrence: '2026-10-15T10:00:00' };
  const display = resolve(series, context);
  assert.equal(display.displayLabel, '15 OCT');
  assert.equal(display.representsPerformance, true);
  assert.equal(display.isOngoing, false);
});
test('recurring date filter preserves actual matching occurrence over next-occurrence hint', () => {
  const response = { ...event('2026-10-22'), parent_event_id: 'parent', recurrence_group_id: 'group', next_occurrence: '2026-10-15T10:00:00' };
  assert.equal(resolve(response, { ...context, date_from: '2026-10-20', date_to: '2026-10-25' }).displayLabel, '22 OCT');
});
test('multi-date event uses current or next showtime, advancing after it ends', () => {
  assert.equal(resolve(several, context).displayLabel, '15 NOV');
  assert.equal(resolve(several, { now: new Date('2026-11-15T11:00:00Z') }).displayLabel, '15 NOV');
  assert.equal(resolve(several, { now: new Date('2026-11-16T11:00:00Z') }).displayLabel, '22 NOV');
});
test('multi-date filter uses matching actual showtime including past dates', () => {
  const display = resolve(several, { ...context, date_from: '2026-11-20', date_to: '2026-11-25' });
  assert.equal(display.displayLabel, '22 NOV');
  assert.equal(resolve(several, { now: new Date('2027-01-01T12:00:00Z'), date_from: '2026-11-15', date_to: '2026-11-15' }).displayLabel, '15 NOV');
});
test('multi-date display never uses envelope or invents a date in a gap', () => {
  assert.equal(resolve(several, context).displayEnd, '2026-11-15T12:30:00');
  assert.equal(resolve(several, context).isOngoing, false);
  assert.equal(resolve(several, { ...context, date_from: '2026-11-16', date_to: '2026-11-18' }).displayStart, null);
});
test('detail information retains factual continuous range and ongoing state', () => {
  const display = resolve(exhibition, context);
  assert.equal(display.factualRangeLabel, '12 Jun – 31 Oct');
  assert.equal(display.factualStart, exhibition.date_start);
  assert.equal(display.factualEnd, exhibition.date_end);
  assert.equal(display.isOngoing, true);
});
test('continuous filter grouping uses first relevant selected day without inventing occurrences', () => {
  const display = resolve(exhibition, { ...context, date_from: '2026-10-20', date_to: '2026-10-25' });
  assert.equal(display.groupingDate, '2026-10-20');
  assert.equal(display.displayStart, exhibition.date_start);
  assert.equal(display.displayLabel, 'ONGOING • UNTIL 31 OCT');
  assert.equal(display.representsPerformance, false);
});
test('one-day and short overnight events are not mistaken for continuous exhibitions', () => {
  const overnight = { date_start: '2026-10-11T22:00:00', date_end: '2026-10-12T14:00:00' };
  assert.equal(resolve(overnight, context).isOngoing, false);
  assert.equal(resolve(overnight, context).kind, 'one-off');
  assert.equal(resolve({ ...event('2026-10-12'), is_all_day: true }, context).isOngoing, false);
});
test('London-local aware/naive display is independent of viewer timezone', () => {
  const original = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = timezone;
      assert.equal(resolve(exhibition, context).displayLabel, 'ONGOING • UNTIL 31 OCT');
      assert.equal(formatDisplayDate('2026-10-14T23:30:00Z'), '15 Oct');
      assert.equal(formatDisplayDate('2026-10-15T00:30:00'), '15 Oct');
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
test('shared filter context forwards explicit API range and drawer custom dates', () => {
  assert.deepEqual(eventDateContext({ date_from: '2026-11-20', date_to: '2026-11-25' }), { date_from: '2026-11-20', date_to: '2026-11-25' });
  assert.equal(resolve(several, { ...eventDateContext({ date: 'custom', dateFrom: '2026-11-20', dateTo: '2026-11-25' }), now }).displayLabel, '22 NOV');
});
test('recurring generated occurrences never become continuous even when a corrupt end spans months', () => {
  const display = resolve({ ...exhibition, parent_event_id: 'parent', recurrence_group_id: 'group' }, context);
  assert.equal(display.isOngoing, false);
  assert.equal(display.kind, 'occurrence');
});
