const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const helpers = require('../src/lib/eventRoundups.ts');
const { upcomingMondayWindow, monthWindow, roundupRangeLabel, toggleRoundupSelection, moveRoundupSelection, posterCategoryColor } = helpers;

test('Sunday weekly window is upcoming Monday through next Monday exclusive', () => {
  assert.deepEqual(upcomingMondayWindow(new Date('2026-10-18T10:00:00Z')), { start: '2026-10-19', end: '2026-10-26' });
  assert.deepEqual(upcomingMondayWindow(new Date('2026-10-19T12:00:00Z')), { start: '2026-10-26', end: '2026-11-02' });
  assert.deepEqual(upcomingMondayWindow(new Date('2026-10-25T12:00:00Z')), { start: '2026-10-26', end: '2026-11-02' });
  assert.deepEqual(upcomingMondayWindow(new Date('2026-10-18T23:30:00Z')), { start: '2026-10-26', end: '2026-11-02' }); // Already Monday in London.
});
test('month window handles leap years, December and invalid months', () => {
  assert.deepEqual(monthWindow('2028-02'), { start: '2028-02-01', end: '2028-03-01' });
  assert.deepEqual(monthWindow('2026-12'), { start: '2026-12-01', end: '2027-01-01' });
  assert.throws(() => monthWindow('2026-13'));
});
test('editorial date ranges stay compact without losing month/year boundaries', () => {
  assert.equal(roundupRangeLabel('2026-10-19', '2026-10-26'), '19–25 October 2026');
  assert.equal(roundupRangeLabel('2026-10-26', '2026-11-02'), '26 Oct–1 Nov 2026');
  assert.equal(roundupRangeLabel('2026-12-28', '2027-01-04'), '28 Dec 2026–3 Jan 2027');
  assert.equal(roundupRangeLabel('2026-10-19', '2026-10-20'), '19 October 2026');
});
test('manual selection is capped at ten, deduplicated and removable', () => {
  let selected = [];
  for (let i = 0; i < 20; i++) selected = toggleRoundupSelection(selected, String(i));
  assert.equal(selected.length, 10);
  assert.deepEqual(toggleRoundupSelection(selected, '3'), selected.filter(value => value !== '3'));
  assert.equal(selected.length, 10);
});
test('editorial reorder preserves membership and does not mutate selection', () => {
  const selected = ['low-score', 'high-score', 'third'];
  assert.deepEqual(moveRoundupSelection(selected, 1, -1), ['high-score', 'low-score', 'third']);
  assert.deepEqual(selected, ['low-score', 'high-score', 'third']);
  assert.deepEqual(moveRoundupSelection(selected, 0, -1), selected);
});
test('poster uses stored category colour and a single neutral fallback', () => {
  assert.equal(posterCategoryColor('#AABBCC'), '#AABBCC');
  assert.equal(posterCategoryColor(null), '#6B7280');
  assert.equal(posterCategoryColor('invalid'), '#6B7280');
});
test('real poster template handles absent optional data, long titles and editorial order', () => {
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    forwardRef: callback => props => callback(props, null), useState: initial => [initial, () => {}] };
  const filename = path.join(__dirname, '../src/components/admin/RoundupPoster.tsx');
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, React: react, require(name) {
    if (name === 'react') return react;
    if (name === '@/lib/eventDateDisplay') return require('../src/lib/eventDateDisplay.ts');
    if (name === '@/lib/eventRoundups') return helpers;
    if (name === '@/utils/imageOptimizer') return { optimizeImage: value => value || '' };
    throw new Error(name);
  } });
  const first = { id: 'b', title: 'Very long '.repeat(40), date_start: '2026-10-19T10:00:00' };
  const second = { id: 'a', title: 'Second event', date_start: '2026-10-20T10:00:00', category_color: '#123456' };
  const tree = module.exports.RoundupPoster({ events: [first, second], area: 'Fort William', dateLabel: '19–25 October 2026' });
  const children = tree.props.children;
  const serialised = JSON.stringify(tree);
  assert.equal(tree.props.style.width, 1080);
  assert.equal(tree.props.style.height, 1350);
  assert.match(serialised, /IN FORT WILLIAM/);
  assert.match(serialised, /Highland Events Hub/);
  assert.match(serialised, /YOUR HIGHLANDS EVENTS GUIDE/);
  const header = children.find(child => child.type === 'header');
  assert.equal(header.props.children[1].props.children[0], 'TOP HIGHLAND EVENTS THIS WEEK');
  assert.equal(header.props.children[2].props.children[0], '19–25 October 2026');
  assert.ok(header.props.children[2].props.style.fontSize >= 26);
  assert.match(serialised, /Venue to be confirmed/);
  assert.match(serialised, /#123456/);
  const watermark = children.find(child => child.type === 'img' && child.props['aria-hidden']);
  assert.equal(watermark.props.src, '/images/logo-white.png');
  assert.ok(watermark.props.style.opacity < 0.06);
  assert.equal(watermark.props.style.position, 'absolute');
  const rows = children.find(child => child.props.style?.gap === 8).props.children[0];
  assert.deepEqual(Array.from(rows, row => row.props.key), ['b', 'a']);
  assert.equal(rows[0].props.style.borderLeft, '5px solid #6B7280');
  assert.equal(rows[1].props.style.borderLeft, '5px solid #123456');
  assert.equal(rows[0].props.style.borderRadius, 14);
  assert.equal(rows[0].props.style.overflow, 'hidden');
  const rank = rows[0].props.children[0].props.children[1];
  assert.ok(rank.props.style.WebkitTextStroke);
  assert.ok(rank.props.style.fontSize > 50);
  assert.equal(rank.props.children[0], 1);
  assert.equal(rows[0].props.style.border, '1px solid #ffffff28');
  const fullPoster = module.exports.RoundupPoster({ events: Array.from({ length: 10 }, (_, index) => ({ ...first, id: String(index) })), area: '', dateLabel: '19–25 October 2026' });
  const fullRows = fullPoster.props.children.find(child => child.props.style?.gap === 8).props.children[0];
  assert.doesNotMatch(JSON.stringify(fullPoster), /ACROSS THE HIGHLANDS/);
  assert.equal(fullPoster.props.children.find(child => child.type === 'header').props.style.height, 166);
  assert.equal(header.props.style.height, 190);
  assert.deepEqual(Array.from(fullRows, row => row.props.children[0].props.children[1].props.children[0]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const pill = rows[1].props.children[2];
  assert.equal(pill.props.style.borderRadius, 999);
  assert.ok(pill.props.style.border.includes('#123456'));
  assert.match(serialised, /Popular upcoming events based on views and ticket\/website clicks/);
  assert.match(JSON.stringify(module.exports.RoundupImage({ event: first })), /\/images\/og-preview.jpg/);
});

test('real admin form and API client send the hub numeric ID and exact November local bounds', async () => {
  const api = require('../src/lib/api.ts');
  const states = ['location', { start: '2026-11-01', end: '2026-12-01' }, '17', [{ id: 17, name: 'Inverness' }],
    [], [], null, false, false, false, true, null, ''];
  let cursor = 0, request;
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const i = cursor++; return [i in states ? states[i] : initial, () => {}]; },
    useRef: initial => ({ current: initial }), useEffect() {} };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/pages/admin/event-roundups.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, React: react, console, require(name) {
    if (name === 'react') return react;
    if (name === '@/lib/api') return api;
    if (name === '@/lib/eventRoundups') return helpers;
    if (name === '@/lib/eventDateDisplay') return require('../src/lib/eventDateDisplay.ts');
    if (name === 'html-to-image') return { toPng() { throw new Error('Export must not run'); } };
    if (name.includes('AdminGuard') || name.includes('AdminLayout')) return 'admin-container';
    if (name.includes('RoundupPoster')) return { RoundupImage: 'img', RoundupPoster: 'poster' };
    throw new Error(name);
  } });
  function expand(node) {
    if (Array.isArray(node)) return node.flatMap(expand);
    if (!node || typeof node !== 'object') return [];
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return [node, ...expand(node.props?.children)];
  }
  const nodes = expand(module.exports.default({}));
  const option = nodes.find(node => node.type === 'option' && node.props.children[0] === 'Inverness');
  assert.equal(option.props.value, 17);
  const previousFetch = global.fetch;
  global.fetch = async (url, options) => {
    request = new URL(url);
    return { ok: true, status: 200, json: async () => ({ candidates: [], diagnostics: {} }) };
  };
  try {
    await nodes.find(node => node.type === 'button' && node.props.children.includes('Find top 20')).props.onClick();
    assert.equal(request.pathname, '/api/admin/roundups/candidates');
    assert.equal(request.searchParams.get('location_id'), '17');
    assert.equal(request.searchParams.get('start'), '2026-11-01T00:00:00');
    assert.equal(request.searchParams.get('end'), '2026-12-01T00:00:00');
    assert.equal(request.searchParams.get('diagnostics'), 'true');
  } finally { global.fetch = previousFetch; }
});
