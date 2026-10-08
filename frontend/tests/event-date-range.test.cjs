const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
};
const helpers = require('../src/lib/eventDateRange.ts');
const { rangeLabel, rangeFromQuery, rangeApiFilters, quickDateRange, withDateRange, mergeEventSearchQuery } = helpers;

test('no date preserves existing API behavior; labels support single days and ranges', () => {
  assert.deepEqual(rangeApiFilters({}), {});
  assert.equal(rangeLabel({}), 'Any date');
  assert.equal(rangeLabel({ from: '2026-10-12' }), '12 Oct');
  assert.equal(rangeLabel({ from: '2026-10-12', to: '2026-10-15' }), '12 Oct – 15 Oct');
});

test('single date and range use full London-local days without browser UTC shifts', () => {
  assert.deepEqual(rangeApiFilters({ from: '2026-10-12' }), {
    date_from: '2026-10-12T00:00:00', date_to: '2026-10-12T23:59:59.999999', include_past: true,
  });
  const range = rangeApiFilters({ from: '2026-10-12', to: '2026-10-14' });
  const overlap = (start, end) => start <= range.date_to && (end || start) >= range.date_from;
  for (const [start, end] of [
    ['2026-10-12T10:00:00', null], ['2026-10-13T10:00:00', '2026-10-13T12:00:00'],
    ['2026-10-10T10:00:00', '2026-10-13T12:00:00'], ['2026-10-14T23:59:59', '2026-10-16T12:00:00'],
    ['2026-10-01T10:00:00', '2026-10-30T12:00:00'],
  ]) assert.equal(overlap(start, end), true);
  assert.equal(overlap('2026-10-10T10:00:00', '2026-10-11T23:59:59'), false);
  assert.equal(overlap('2026-10-15T00:00:00', null), false);
});

test('Today, weekend and next seven days populate the same range (including Sunday and London midnight)', () => {
  const thursday = new Date('2026-10-08T12:00:00Z');
  assert.deepEqual(quickDateRange('today', thursday), { from: '2026-10-08', to: '2026-10-08' });
  assert.deepEqual(quickDateRange('weekend', thursday), { from: '2026-10-10', to: '2026-10-11' });
  assert.deepEqual(quickDateRange('week', thursday), { from: '2026-10-08', to: '2026-10-14' });
  assert.deepEqual(quickDateRange('weekend', new Date('2026-10-11T12:00:00Z')), { from: '2026-10-11', to: '2026-10-11' });
  assert.deepEqual(quickDateRange('today', new Date('2026-10-08T23:30:00Z')), { from: '2026-10-09', to: '2026-10-09' });
});

test('URL hydration and date changes preserve search, location, distance, category, sorting and tags', () => {
  const existing = { q: 'music', location: 'Inverness', category: 'music', radius: '10', latitude: '57.48', longitude: '-4.22', sort_by: 'created', tag: 'family' };
  const changed = mergeEventSearchQuery(existing, { dateFrom: '2026-10-12', dateTo: '2026-10-15' });
  assert.deepEqual(changed, { ...existing, date_from: '2026-10-12', date_to: '2026-10-15' });
  assert.deepEqual(rangeFromQuery(changed), { from: '2026-10-12', to: '2026-10-15' });
  assert.deepEqual(mergeEventSearchQuery(changed, { q: 'market' }), { ...changed, q: 'market' });
  assert.deepEqual(mergeEventSearchQuery(changed, { radius: '25' }), { ...changed, radius: '25' });
  assert.deepEqual(mergeEventSearchQuery(changed, { dateFrom: undefined, dateTo: undefined }), existing);
  assert.deepEqual(withDateRange({ ...existing, date: 'today' }, {}), existing);
  assert.deepEqual(rangeFromQuery({ date_from: '2026-02-30' }), {});
});

// Node-only component harness: controlled React state, calendar and routing.
function load(file, imports, globals = {}) {
  let cursor = 0;
  let effects = [];
  const states = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; },
    useRef: () => ({ current: { focus() {}, getBoundingClientRect: () => ({ left: 20, bottom: 120 }) } }),
    useEffect(effect) { effects.push(effect); }, useId: () => 'date-picker', useCallback: callback => callback,
  };
  const filename = path.join(__dirname, '../src', file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, React: react, console, ...globals,
    require: name => name === 'react' ? react : name === '@/lib/eventDateRange' ? helpers : name in imports ? imports[name] : (() => { throw new Error(`Unexpected ${name}`); })(),
  });
  const render = props => { cursor = 0; effects = []; return module.exports.default(props); };
  render.runEffect = index => effects[index]();
  return render;
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

test('picker stages calendar changes until Apply, supports one day, ranges and Clear', () => {
  const render = load('components/search/EventDateRangePicker.tsx', {
    'react-dom': { createPortal: tree => tree }, 'lucide-react': { CalendarDays: 'icon' },
    'react-day-picker': { DayPicker: 'calendar' }, 'react-day-picker/dist/style.css': {},
  }, { window: { innerWidth: 400, innerHeight: 800 }, document: { body: {} } });
  let applied;
  const props = { value: {}, onChange: value => { applied = value; } };
  nodes(render(props)).find(node => node.props['aria-haspopup']).props.onClick();
  let tree = nodes(render(props));
  tree.find(node => node.type === 'calendar').props.onSelect({ from: new Date('2026-10-12T12:00:00') });
  assert.equal(applied, undefined);
  tree = nodes(render(props));
  tree.find(node => node.type === 'button' && node.props.children.includes('Apply')).props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(applied)), { from: '2026-10-12', to: '2026-10-12' });
  props.value = applied;
  nodes(render(props)).find(node => node.props['aria-haspopup']).props.onClick();
  nodes(render(props)).find(node => node.type === 'calendar').props.onSelect({ from: new Date('2026-10-12T12:00:00'), to: new Date('2026-10-15T12:00:00') });
  nodes(render(props)).find(node => node.type === 'button' && node.props.children.includes('Apply')).props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(applied)), { from: '2026-10-12', to: '2026-10-15' });
  nodes(render(props)).find(node => node.props['aria-haspopup']).props.onClick();
  nodes(render(props)).find(node => node.type === 'button' && node.props.children.includes('Clear')).props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(applied)), {});
});

test('homepage Search transfers text and dates, and also permits dates without text', () => {
  let navigation;
  const render = load('components/home/HeroSection.tsx', {
    'next/link': 'link', 'next/image': 'image', 'next/router': { useRouter: () => ({ push: value => { navigation = value; } }) },
    '@/components/home/DiscoveryBar': 'search', '@/components/search/EventDateRangePicker': 'picker',
  });
  const props = { onSearch() { throw new Error('Must navigate, not open the old drawer'); } };
  nodes(render(props)).find(node => node.type === 'picker').props.onChange({ from: '2026-10-12', to: '2026-10-15' });
  nodes(render(props)).find(node => node.type === 'search').props.onSearch({ q: 'music' });
  assert.equal(navigation.pathname, '/events');
  assert.deepEqual(navigation.query, { q: 'music', date_from: '2026-10-12', date_to: '2026-10-15' });
  nodes(render(props)).find(node => node.type === 'search').props.onSearch({});
  assert.equal(navigation.query.date_from, '2026-10-12');
  assert.equal(navigation.query.q, undefined);
});

test('Events page hydrates from the URL, sends full-day API bounds and responds to back/forward changes', async () => {
  const originalQuery = { q: 'music', category: 'music', location: 'Inverness', radius: '10', latitude: '57.48', longitude: '-4.22', sort_by: 'created', tag: 'family' };
  const router = { isReady: true, pathname: '/events', query: { ...originalQuery, date_from: '2026-10-12', date_to: '2026-10-15' }, push: value => { router.query = value.query; } };
  let request;
  const render = load('pages/events/index.tsx', {
    'next/router': { useRouter: () => router }, '@/hooks/useGeolocation': { useGeolocation: () => ({}) },
    '@/context/SearchContext': { useSearch: () => ({}) }, '@/components/events/EventList': { EventList: 'list' },
    '@/components/home/DiscoveryBar': 'search', '@/components/search/FilterBar': { FilterBar: 'filters' },
    '@/components/categories/CategoryGrid': 'categories', '@/components/PopularLocations': 'locations',
    '@/lib/dateUtils': require('../src/lib/dateUtils.ts'),
    '@/lib/api': { eventsAPI: { list: async filters => { request = filters; return { events: [], total: 0 }; } } },
  }, { console: { log() {} } });
  render({});
  render.runEffect(0);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(request.date_from, '2026-10-12T00:00:00');
  assert.equal(request.date_to, '2026-10-15T23:59:59.999999');
  assert.equal(request.q, 'music');
  assert.equal(request.location, 'Inverness');
  assert.equal(request.radius_km, 10);
  assert.equal(request.category, 'music');
  assert.equal(request.sort_by, 'created');
  let filter = nodes(render({})).find(node => node.type === 'filters');
  assert.equal(filter.props.dateRange.from, '2026-10-12');
  filter.props.onDateRangeChange({});
  assert.deepEqual(router.query, originalQuery);
  // A browser back/forward event supplies the previous router.query.
  router.query = { ...originalQuery, date_from: '2026-10-20', date_to: '2026-10-20' };
  render({});
  render.runEffect(0);
  await new Promise(resolve => setImmediate(resolve));
  filter = nodes(render({})).find(node => node.type === 'filters');
  assert.equal(filter.props.dateRange.from, '2026-10-20');
  assert.equal(request.date_to, '2026-10-20T23:59:59.999999');
});
