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
const { applyOnceChange, toUkUtcIso } = require('../src/components/events/guided/scheduleHelpers.ts');

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

test('recurring and native modes cannot be submitted', () => {
  const recurring = draft();
  recurring.scheduleMode = 'recurring';
  assert.match(validateGuidedCreation(recurring).message, /Recurring/);
  assert.throws(() => buildGuidedEventPayload(recurring));
  const native = draft();
  native.attendanceMode = 'native';
  assert.match(validateGuidedCreation(native).message, /ticket creation/);
});
