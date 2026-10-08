const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
};
const { upcomingPerformances, eventHasEnded } = require('../src/lib/eventOccurrences.ts');
const now = new Date('2026-05-14T11:00:00Z'); // Noon London.
const performance = (day, end = '13:00:00') => ({ start_time: `2026-05-${day}T10:00:00`, end_time: `2026-05-${day}T${end}` });
const event = { date_start: '2026-05-07T10:00:00', date_end: '2026-05-28T13:00:00', showtimes: [performance('07'), performance('21'), performance('14'), performance('14')] };

test('selector hides ended showtimes, includes current, sorts and deduplicates without mutation', () => {
  assert.deepEqual(upcomingPerformances(event, now).map(p => p.start_time.slice(0, 10)), ['2026-05-14', '2026-05-21']);
  assert.equal(event.showtimes.length, 4);
  assert.equal(eventHasEnded(event, now), false);
});
test('all-ended showtimes do not become upcoming because of an event envelope', () => {
  const ended = { ...event, showtimes: [performance('07')] };
  assert.deepEqual(upcomingPerformances(ended, now), []);
  assert.equal(eventHasEnded(ended, now), true);
});
test('inclusive end, missing end, overnight and all-day end-of-day', () => {
  assert.equal(upcomingPerformances({ ...event, showtimes: [performance('14', '12:00:00')] }, now).length, 1);
  assert.equal(upcomingPerformances({ ...event, showtimes: [{ start_time: '2026-05-14T10:00:00' }] }, now).length, 0);
  assert.equal(upcomingPerformances({ ...event, showtimes: [{ start_time: '2026-05-13T23:00:00', end_time: '2026-05-14T13:00:00' }] }, now).length, 1);
  assert.equal(upcomingPerformances({ ...event, is_all_day: true, showtimes: [performance('14', '00:00:00')] }, now).length, 1);
});
test('aware and naive London schedules are equivalent regardless of browser timezone', () => {
  const original = process.env.TZ;
  try {
    for (const zone of ['UTC', 'America/New_York', 'Asia/Tokyo']) {
      process.env.TZ = zone;
      assert.equal(upcomingPerformances(event, now).length, 2);
      assert.equal(upcomingPerformances({ ...event, showtimes: [{ start_time: '2026-05-14T09:00:00Z', end_time: '2026-05-14T12:00:00Z' }] }, now).length, 1);
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
