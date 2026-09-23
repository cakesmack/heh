const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Exercise the shared live payload builder and guided adapter without a browser/API.
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  const mapped = request.startsWith('@/') ? path.join(__dirname, '../src', request.slice(2)) : request;
  return resolveFilename.call(this, mapped, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  module._compile(compiled.outputText, filename);
};

const { buildGuidedEventPayload, validateGuidedCreation } = require('../src/components/events/guided/guidedCreation.ts');
const { applyOnceChange, applyPerformanceChange, toUkUtcIso, validatePerformances, validateRecurrence } = require('../src/components/events/guided/scheduleHelpers.ts');

const draft = () => ({
  title: 'Highland Market', venueMode: 'single', singleVenueId: 'venue-1', participatingVenues: [],
  scheduleMode: 'once', once: { start: '2026-07-01T10:00', end: '2026-07-01T12:00', allDay: false }, performances: [],
  recurrence: { startDate: '2026-07-01', startTime: '10:00', endTime: '12:00', endsNextDay: false, allDay: false, frequency: 'weekly', interval: 1, weekdays: [2], monthlyMode: 'date', ordinal: 1, ordinalWeekday: 2, endsOn: 'date', endDate: '2026-07-31' },
  attendanceMode: 'free', doorPrice: '', doorReservationRequired: false, doorReservationUrl: '', externalUrl: '', externalIsFree: null,
  ticketTiers: [{ id: 'inactive', name: 'Not for sale', price: 50, quantity_available: 1, max_per_order: 1 }], passFeesToBuyer: true,
  description: '<p>Local stalls</p>', categoryId: 'category-1', organizerId: '', tags: ['market'], ageRestriction: '18+', websiteUrl: 'https://example.org',
});

test('one-off start and finish stay together; invalid finish clears after start changes', () => {
  const initial = draft().once;
  assert.deepEqual(applyOnceChange(initial, { start: '2026-07-01T13:00' }), { value: { start: '2026-07-01T13:00', end: '', allDay: false }, endCleared: true });
  assert.equal(applyOnceChange(initial, { start: '2026-07-01T09:00' }).value.end, initial.end);
  assert.equal(applyOnceChange({ start: '2026-07-01', end: '2026-07-02', allDay: true }, { start: '2026-07-03' }).value.end, '');
});

test('UK wall-time conversion does not use the viewer timezone', () => {
  assert.equal(toUkUtcIso('2026-07-01T10:00'), '2026-07-01T09:00:00.000Z');
  assert.equal(toUkUtcIso('2026-12-01T10:00'), '2026-12-01T10:00:00.000Z');
  assert.throws(() => toUkUtcIso('2026-03-29T01:30'));
});

test('overnight and inclusive all-day dates keep their intended calendar days', () => {
  const overnight = draft();
  overnight.once.end = '2026-07-02T01:00';
  assert.equal(buildGuidedEventPayload(overnight).date_end, '2026-07-02T00:00:00.000Z');
  const allDay = draft();
  allDay.once = { start: '2026-07-01', end: '2026-07-02', allDay: true };
  const payload = buildGuidedEventPayload(allDay);
  assert.equal(payload.is_all_day, true);
  assert.equal(payload.date_start, '2026-06-30T23:00:00.000Z');
  assert.equal(payload.date_end, '2026-07-02T22:59:00.000Z');
});

test('free and door events use shared payload mapping without native tiers or door text as URL', () => {
  const free = buildGuidedEventPayload(draft());
  assert.equal(free.date_start, '2026-07-01T09:00:00.000Z');
  assert.equal(free.venue_id, 'venue-1');
  assert.equal(free.price, 'Free');
  assert.equal(free.ticket_url, undefined);
  assert.equal(free.is_ticketing_enabled, false);
  assert.equal(free.ticket_tiers, undefined);
  const door = draft();
  Object.assign(door, { attendanceMode: 'door', doorPrice: '12.50' });
  const noReservation = buildGuidedEventPayload(door);
  assert.equal(noReservation.price, '£12.50 at the door');
  assert.equal(noReservation.ticket_url, undefined);
  door.doorReservationRequired = true;
  door.doorReservationUrl = 'https://example.org/reserve';
  assert.equal(buildGuidedEventPayload(door).ticket_url, door.doorReservationUrl);
});

test('external and several-date events map booking, venues, image and showtimes', () => {
  const input = draft();
  Object.assign(input, {
    venueMode: 'multiple', singleVenueId: 'inactive-main', participatingVenues: [{ id: 'v1' }, { id: 'v2' }],
    scheduleMode: 'selected_dates', performances: [
      { id: 'later', start: '2026-07-03T20:00', end: '2026-07-03T22:00' },
      { id: 'earlier', start: '2026-07-02T19:00', end: '2026-07-02T21:00' },
    ], attendanceMode: 'external', externalUrl: 'https://example.org/book', externalIsFree: false,
  });
  const payload = buildGuidedEventPayload(input, 'image-id');
  assert.equal(payload.venue_id, null);
  assert.deepEqual(payload.participating_venue_ids, ['v1', 'v2']);
  assert.equal(payload.date_start, '2026-07-02T18:00:00.000Z');
  assert.equal(payload.date_end, '2026-07-03T21:00:00.000Z');
  assert.equal(payload.showtimes.length, 2);
  assert.equal(payload.showtimes[0].start_time, '2026-07-02T19:00:00');
  assert.equal(payload.ticket_url, 'https://example.org/book');
  assert.equal(payload.price, 'Paid — see booking site');
  assert.equal(payload.image_url, 'image-id');
  assert.deepEqual(payload.tags, ['market']);
  assert.equal(payload.age_restriction, '18+');
});

test('weekly and biweekly recurrence maps selected weekdays and an inclusive ending', () => {
  const recurring = draft();
  recurring.scheduleMode = 'recurring';
  recurring.recurrence.weekdays = [2, 4];
  assert.equal(validateGuidedCreation(recurring), null);
  const weekly = buildGuidedEventPayload(recurring);
  assert.equal(weekly.is_recurring, true);
  assert.equal(weekly.frequency, 'WEEKLY');
  assert.deepEqual(weekly.weekdays, [2, 4]);
  assert.equal(weekly.recurrence_rule, undefined);
  assert.equal(weekly.recurrence_end_date, '2026-07-31T23:59:59.000Z');
  assert.equal(weekly.date_start, '2026-07-01T09:00:00.000Z');
  recurring.recurrence.interval = 2;
  assert.equal(buildGuidedEventPayload(recurring).frequency, 'BIWEEKLY');
});

test('custom recurrence preserves intervals, weekdays, monthly patterns and ongoing choice', () => {
  const recurring = draft();
  recurring.scheduleMode = 'recurring';
  recurring.recurrence.interval = 3;
  recurring.recurrence.weekdays = [2, 4];
  const weekly = buildGuidedEventPayload(recurring);
  assert.equal(weekly.frequency, 'CUSTOM');
  assert.match(weekly.recurrence_rule, /FREQ=WEEKLY;INTERVAL=3;BYDAY=WE,FR/);
  assert.match(weekly.recurrence_rule, /UNTIL=20260731T235959Z/);
  recurring.recurrence.frequency = 'daily';
  recurring.recurrence.interval = 2;
  recurring.recurrence.endsOn = 'ongoing';
  const daily = buildGuidedEventPayload(recurring);
  assert.match(daily.recurrence_rule, /FREQ=DAILY;INTERVAL=2/);
  assert.doesNotMatch(daily.recurrence_rule, /UNTIL/);
  assert.equal(daily.recurrence_end_date, undefined);
  recurring.recurrence.frequency = 'monthly';
  recurring.recurrence.interval = 1;
  assert.equal(buildGuidedEventPayload(recurring).frequency, 'MONTHLY');
  recurring.recurrence.monthlyMode = 'ordinal';
  recurring.recurrence.ordinal = 1;
  recurring.recurrence.ordinalWeekday = 2;
  const ordinal = buildGuidedEventPayload(recurring);
  assert.equal(ordinal.frequency, 'CUSTOM');
  assert.match(ordinal.recurrence_rule, /FREQ=MONTHLY;INTERVAL=1;BYDAY=WE;BYSETPOS=1/);
  recurring.recurrence.monthlyMode = 'date';
  recurring.recurrence.interval = 2;
  assert.match(buildGuidedEventPayload(recurring).recurrence_rule, /FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=1/);
});

test('recurrence anchor must match selected weekdays and monthly position', () => {
  const rule = draft().recurrence;
  rule.weekdays = [0];
  assert.match(validateRecurrence(rule), /first event date/);
  rule.weekdays = [2];
  assert.equal(validateRecurrence(rule), null);
  rule.frequency = 'monthly';
  rule.monthlyMode = 'ordinal';
  rule.ordinal = -1;
  assert.match(validateRecurrence(rule), /first event date/);
  rule.startDate = '2026-07-29';
  assert.equal(validateRecurrence(rule), null);
});

test('recurring first instance keeps overnight and all-day ranges', () => {
  const recurring = draft();
  recurring.scheduleMode = 'recurring';
  recurring.recurrence.endsNextDay = true;
  recurring.recurrence.endTime = '01:00';
  assert.equal(buildGuidedEventPayload(recurring).date_end, '2026-07-02T00:00:00.000Z');
  recurring.recurrence.allDay = true;
  const allDay = buildGuidedEventPayload(recurring);
  assert.equal(allDay.is_all_day, true);
  assert.equal(allDay.date_start, '2026-06-30T23:00:00.000Z');
  assert.equal(allDay.date_end, '2026-07-01T22:59:00.000Z');
});

test('each performance shares one-off valid-range rules without changing another performance', () => {
  const items = [
    { id: 'first', start: '2026-09-16T10:00', end: '2026-09-16T12:00' },
    { id: 'second', start: '2026-09-20T23:00', end: '2026-09-21T01:00' },
  ];
  const changed = applyPerformanceChange(items, 'first', { start: '2026-09-24T10:00' });
  assert.equal(changed.endCleared, true);
  assert.equal(changed.items[0].end, '');
  assert.deepEqual(changed.items[1], items[1]);
  assert.match(validatePerformances(changed.items), /Performance 1/);
  const invalid = applyPerformanceChange(changed.items, 'first', { end: '2026-09-24T10:00' });
  assert.match(validatePerformances(invalid.items), /finish must be after/);
  const corrected = applyPerformanceChange(changed.items, 'first', { end: '2026-09-25T09:00' });
  assert.equal(validatePerformances(corrected.items), null);
  assert.equal(validatePerformances(items), null);
});

test('native mode remains non-submittable', () => {
  const native = draft();
  native.attendanceMode = 'native';
  assert.match(validateGuidedCreation(native).message, /ticket creation/);
});
