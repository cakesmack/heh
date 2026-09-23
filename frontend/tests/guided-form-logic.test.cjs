const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Run the preview's pure TypeScript helpers without a browser or a new dependency.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  module._compile(compiled.outputText, filename);
};

const { getGuidedQuestions } = require('../src/components/events/guided/guidedEventTypes.ts');
const { attendanceSummary, nativeTicketIssue, validateAttendance, validateTickets, validateDetails, validateFinishing } = require('../src/components/events/guided/guidedFormHelpers.ts');

const base = () => ({
  scheduleMode: 'once', once: { start: '2026-10-02T10:00', end: '2026-10-02T12:00', allDay: false },
  attendanceMode: null, doorPrice: '', doorReservationRequired: false, doorReservationUrl: '',
  externalUrl: '', externalIsFree: null, ticketTiers: [], categoryId: '', description: '', websiteUrl: '', tags: [],
});

test('ticket question is visible only for native attendance', () => {
  assert.equal(getGuidedQuestions('native').length, 8);
  assert.equal(getGuidedQuestions('door').length, 7);
  assert.equal(getGuidedQuestions(null).some((item) => item.id === 'tickets'), false);
});

test('door fields validate only when active; inactive URLs do not appear in summary', () => {
  const draft = { ...base(), attendanceMode: 'door', doorPrice: '8.50', doorReservationRequired: true, doorReservationUrl: 'not-a-url' };
  assert.match(validateAttendance(draft), /HTTP\(S\)/);
  draft.doorReservationUrl = 'https://example.org/reserve';
  assert.equal(validateAttendance(draft), null);
  assert.match(attendanceSummary(draft), /£8.50/);
  draft.attendanceMode = 'free';
  assert.equal(validateAttendance(draft), null);
  assert.equal(attendanceSummary(draft), 'Free entry · just turn up');
  assert.equal(draft.doorPrice, '8.50');
});

test('external booking requires HTTP(S) URL and a free/paid answer', () => {
  const draft = { ...base(), attendanceMode: 'external', externalUrl: 'javascript:alert(1)' };
  assert.match(validateAttendance(draft), /HTTP\(S\)/);
  draft.externalUrl = 'https://example.org/book';
  assert.match(validateAttendance(draft), /free or paid/);
  draft.externalIsFree = false;
  assert.equal(validateAttendance(draft), null);
  assert.match(attendanceSummary(draft), /paid/);
});

test('native tickets reject multiple dates, recurrence and events over 36 hours', () => {
  const draft = { ...base(), attendanceMode: 'native' };
  assert.equal(nativeTicketIssue(draft), null);
  draft.scheduleMode = 'selected_dates';
  assert.match(validateAttendance(draft), /one-off/);
  draft.scheduleMode = 'recurring';
  assert.match(validateAttendance(draft), /one-off/);
  draft.scheduleMode = 'once';
  draft.once.end = '2026-10-04T00:00';
  assert.match(nativeTicketIssue(draft), /36 hours/);
  draft.once = { start: '2026-10-02', end: '2026-10-03', allDay: true };
  assert.match(nativeTicketIssue(draft), /36 hours/);
});

test('tier, category and website validation remain scoped to active answers', () => {
  const draft = { ...base(), attendanceMode: 'native', ticketTiers: [{ id: 'tier-1', name: 'General', price: 0.29, quantity_available: 50, max_per_order: 10 }] };
  assert.equal(validateTickets(draft), null);
  draft.ticketTiers[0].max_per_order = 51;
  assert.match(validateTickets(draft), /max per order/);
  draft.attendanceMode = 'free';
  assert.equal(validateTickets(draft), null);
  assert.match(validateDetails(draft), /category/);
  draft.categoryId = 'music';
  assert.equal(validateDetails(draft), null);
  draft.websiteUrl = 'ftp://example.org';
  assert.match(validateFinishing(draft), /HTTP\(S\)/);
});
