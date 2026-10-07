const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  return resolve.call(this, request.startsWith('@/') ? path.join(__dirname, '../src', request.slice(2)) : request, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { parseGuidedEventData, buildGuidedEventUpdate } = require('../src/components/events/guided/guidedEdit.ts');
const event = (patch = {}) => ({
  id: 'event-1', title: 'Highland Market', date_start: '2026-10-12T10:00:00', date_end: '2026-10-12T12:00:00',
  venue_id: 'venue-1', venue: { id: 'venue-1', name: 'Hall' }, category_id: 'cat-1', category: { name: 'Community' },
  price: 0, description: 'Local stalls', tags: [{ name: 'market' }], age_restriction: '18+',
  image_url: 'https://example.org/event.jpg', website_url: 'https://example.org',
  organizer_profile_id: 'org-1', organizer_profile: { id: 'org-1', name: 'Market Group' },
  participating_venues: [], showtimes: [], ticket_tiers: [], ...patch,
});

test('legacy hydration populates venues, host, metadata and current image; metadata save keeps schedule', () => {
  const original = event();
  const draft = parseGuidedEventData(original);
  assert.equal(draft.singleVenue.name, 'Hall');
  assert.equal(draft.organizerName, 'Market Group');
  assert.equal(draft.categoryName, 'Community');
  assert.deepEqual(draft.tags, ['market']);
  assert.equal(draft.once.start, '2026-10-12T10:00');
  assert.equal(draft.imagePreviewUrl, original.image_url);
  draft.title = 'Updated market';
  const payload = buildGuidedEventUpdate(draft, original);
  assert.equal(payload.title, draft.title);
  assert.equal(payload.image_url, original.image_url);
  assert.equal(payload.date_start, undefined);
  assert.equal(payload.showtimes, undefined);
  assert.equal(payload.is_recurring, undefined);
});

test('clearing optional values produces explicit update clears; door text never becomes URL', () => {
  const original = event({ price: 12.5, price_display: '£12.50 at the door', ticket_url: 'https://example.org/reserve' });
  const draft = parseGuidedEventData(original);
  assert.equal(draft.attendanceMode, 'door');
  assert.equal(draft.doorReservationRequired, true);
  Object.assign(draft, { doorReservationRequired: false, imagePreviewUrl: '', existingImageUrl: '', description: '', tags: [], websiteUrl: '', ageRestriction: '', organizerId: '' });
  const payload = buildGuidedEventUpdate(draft, original);
  for (const field of ['ticket_url', 'image_url', 'description', 'website_url', 'age_restriction', 'organizer_profile_id']) assert.equal(payload[field], null, field);
  assert.deepEqual(payload.tags, []);
  assert.equal(buildGuidedEventUpdate(draft, original, 'https://example.org/replacement.jpg').image_url, 'https://example.org/replacement.jpg');
});

test('native sold tier renaming retains server ID, hidden state, sale window and fee settings', () => {
  const original = event({ is_ticketing_enabled: true, pass_fees_to_buyer: true, ticket_tiers: [
    { id: 'sold-tier', name: 'General', price: 10, quantity_available: 100, quantity_sold: 12, max_per_order: 5, sale_start: '2026-10-01T00:00:00', sale_end: null, is_hidden: true },
  ] });
  const draft = parseGuidedEventData(original);
  draft.ticketTiers[0].name = 'Renamed General';
  draft.ticketTiers.push({ id: 'client-new', name: 'Child', price: 5, quantity_available: 30, max_per_order: 5 });
  const payload = buildGuidedEventUpdate(draft, original);
  assert.equal(payload.ticket_tiers[0].id, 'sold-tier');
  assert.equal(payload.ticket_tiers[0].sale_start, original.ticket_tiers[0].sale_start);
  assert.equal(payload.ticket_tiers[0].is_hidden, true);
  assert.equal(payload.ticket_tiers[1].id, undefined);
  assert.equal(payload.pass_fees_to_buyer, true);
  assert.equal(payload.is_ticketing_enabled, true);
});

test('recurrence hydrates weekdays, intervals and finite end; unchanged edit omits regeneration keys', () => {
  const original = event({ is_recurring: true, recurrence_rule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231T235959Z' });
  const draft = parseGuidedEventData(original);
  assert.equal(draft.recurrence.interval, 2);
  assert.deepEqual(draft.recurrence.weekdays, [0, 2]);
  assert.equal(draft.recurrence.endsOn, 'date');
  assert.equal(draft.recurrence.endDate, '2026-12-31');
  assert.equal(buildGuidedEventUpdate(draft, original).recurrence_rule, undefined);
  Object.assign(draft.recurrence, { weekdays: [1, 4], startDate: '2026-10-13', endsOn: 'ongoing' });
  const payload = buildGuidedEventUpdate(draft, original);
  assert.match(payload.recurrence_rule, /BYDAY=TU,FR/);
  assert.match(payload.recurrence_rule, /INTERVAL=2/);
  assert.doesNotMatch(payload.recurrence_rule, /UNTIL/);
  assert.equal(payload.recurrence_end_date, null);
});

test('monthly ordinal and date patterns hydrate without a generated-date preview', () => {
  for (const rule of ['FREQ=MONTHLY;INTERVAL=3;BYDAY=FR;BYSETPOS=-1', 'FREQ=MONTHLY;BYDAY=-1FR']) {
    const draft = parseGuidedEventData(event({ is_recurring: true, recurrence_rule: rule }));
    assert.equal(draft.recurrence.monthlyMode, 'ordinal');
    assert.equal(draft.recurrence.ordinal, -1);
    assert.equal(draft.recurrence.ordinalWeekday, 4);
  }
  assert.equal(parseGuidedEventData(event({ is_recurring: true, recurrence_rule: 'FREQ=MONTHLY;BYMONTHDAY=12' })).recurrence.monthlyMode, 'date');
});

test('multi-date edit retains participating/main venues and showtime metadata until schedule changes', () => {
  const original = event({ participating_venues: [{ id: 'other', name: 'Other Hall' }], showtimes: [
    { id: 'show-1', start_time: '2026-10-12T10:00:00', end_time: '2026-10-12T12:00:00', notes: 'Matinee', ticket_url: 'https://example.org/book' },
  ] });
  const draft = parseGuidedEventData(original);
  assert.equal(draft.scheduleMode, 'selected_dates');
  assert.equal(draft.venueMode, 'multiple');
  assert.equal(buildGuidedEventUpdate(draft, original).venue_id, 'venue-1');
  assert.equal(buildGuidedEventUpdate(draft, original).showtimes, undefined);
  draft.performances[0].end = '2026-10-12T13:00';
  const payload = buildGuidedEventUpdate(draft, original);
  assert.equal(payload.showtimes[0].notes, 'Matinee');
  assert.equal(payload.showtimes[0].ticket_url, 'https://example.org/book');
  assert.deepEqual(payload.participating_venue_ids, ['other']);
});

test('custom location survives editing; switching attendance or scheduling does not send inactive fields', () => {
  const original = event({ venue_id: null, venue: null, location_name: 'Village Green', latitude: 57.4, longitude: -4.2, ticket_url: 'https://example.org/book', price: 20 });
  const draft = parseGuidedEventData(original);
  assert.equal(draft.attendanceMode, 'external');
  draft.attendanceMode = 'free';
  const payload = buildGuidedEventUpdate(draft, original);
  assert.equal(payload.location_name, 'Village Green');
  assert.equal(payload.latitude, 57.4);
  assert.equal(payload.ticket_url, null);
  assert.equal(payload.ticket_tiers, undefined);
  const recurring = event({ is_recurring: true, recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO' });
  const changed = parseGuidedEventData(recurring);
  changed.scheduleMode = 'once';
  assert.equal(buildGuidedEventUpdate(changed, recurring).recurrence_rule, null);
});
