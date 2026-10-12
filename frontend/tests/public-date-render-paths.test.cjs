const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const display = require('../src/lib/eventDateDisplay.ts');
const ranges = require('../src/lib/eventDateRange.ts');
const now = new Date('2026-10-12T11:00:00Z');
const context = { now };
const salt = { id: 'salt', title: 'Salt to Plate by Debasis Biswas', date_start: '2026-06-20T10:00:00', date_end: '2026-10-31T17:00:00', latitude: 57.4, longitude: -4.2, is_recurring: false, price: 0 };
const mirrored = { ...salt, showtimes: [{ id: 'single-range', start_time: salt.date_start, end_time: salt.date_end }] };

// Run the real route/components as JSX trees in Node, mocking only external UI,
// hooks/state and Maps SDK. No browser, Maps/network calls or generated markup.
function harness(event, filter = context) {
  const cache = new Map();
  const stateOverrides = {
    'pages/events/index.tsx': [[event], 1, false, false, null, filter, {}],
    'pages/map.tsx': [[event], [], false, null, [], null, true, 'events', [], null,
      { start: new Date(`${filter.date_from || '2026-10-12'}T00:00:00`), end: new Date(`${filter.date_to || '2026-10-18'}T23:59:59`) }],
    'components/events/ClusteredEventMarkers.tsx': [{ [event.id]: {} }, event.id, null, null],
    'components/events/GoogleMapView.tsx': [null, false, null, true],
  };
  const stub = name => name;
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    let cursor = 0;
    const states = [...(stateOverrides[file] || [])];
    const react = {
      Component: class { constructor(props) { this.props = props; } }, Fragment: 'fragment',
      createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
      useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
      useMemo: callback => callback(), useCallback: callback => callback,
      useEffect() {}, useRef: value => ({ current: value }),
    };
    const imports = {
      react, 'next/link': stub('link'), 'next/dynamic': () => stub('dynamic-map'),
      'next/router': { useRouter: () => ({ isReady: true, query: {}, pathname: '/events', push() {}, replace() {} }) },
      'date-fns': require('date-fns'), 'react-hot-toast': { toast: { success() {}, error() {} } },
      '@vis.gl/react-google-maps': { useMap: () => null, Map: 'google-map', Marker: 'marker', AdvancedMarker: 'marker', InfoWindow: 'info-window' },
      '@googlemaps/markerclusterer': { MarkerClusterer: class {}, GridAlgorithm: class {} },
      '@/hooks/useGeolocation': { useGeolocation: () => ({}) }, '@/context/SearchContext': { useSearch: () => ({}) },
      '@/lib/api': { eventsAPI: {}, categoriesAPI: {}, collectionsAPI: {}, venuesAPI: {} },
      '@/lib/eventDateDisplay': display, '@/lib/eventDateRange': ranges,
      '@/lib/dateUtils': require('../src/lib/dateUtils.ts'),
      '@/lib/formatPrice': require('../src/lib/formatPrice.ts'),
      '@/utils/imageOptimizer': { optimizeImage: value => value },
      '@/components/ui/OptimizedImage': 'image', '@/components/events/BookmarkButton': { BookmarkButton: 'bookmark' },
      '@/components/common/Badge': { Badge: 'badge' }, '@/components/events/EventCardSkeleton': { EventCardSkeleton: 'skeleton' },
      '@/components/home/DiscoveryBar': 'search', '@/components/search/FilterBar': { FilterBar: 'filters' },
      '@/components/categories/CategoryGrid': 'categories', '@/components/PopularLocations': 'locations',
      '@/components/map/MapDateFilter': 'date-filter', './ClusteredVenueMarkers': 'venue-markers',
    };
    const filename = path.join(__dirname, '../src', file);
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, React: react, console, process, Date,
      require(name) {
        if (name in imports) return imports[name];
        if (name.startsWith('@/components/')) return load(name.slice(2) + '.tsx');
        if (name.startsWith('./')) return load(path.posix.join(path.posix.dirname(file), name + '.tsx'));
        throw new Error('Unexpected component dependency: ' + name);
      },
    });
    const exports = { __esModule: true };
    for (const [key, value] of Object.entries(module.exports)) {
      exports[key] = typeof value === 'function' ? props => { cursor = 0; return value(props); } : value;
    }
    cache.set(file, exports);
    return exports;
  }
  function expand(node) {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return expand(node.type.prototype?.render ? new node.type(node.props).render() : node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    return node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
  }
  function text(node) {
    if (Array.isArray(node)) return node.map(text).join(' ');
    return node && typeof node === 'object' ? text(node.props?.children) : node == null || typeof node === 'boolean' ? '' : String(node);
  }
  return { load, expand, text, nodes };
}

for (const event of [salt, mirrored]) {
  test(`actual /events → EventList → EventCard renders ongoing (${event.showtimes ? 'single envelope showtime' : 'bare range'})`, () => {
    const view = harness(event);
    // The route's filter context normally has no explicit clock; freeze just the
    // resolver default clock, without substituting its classification/formatting.
    const original = display.eventDateContext;
    display.eventDateContext = filters => ({ ...original(filters), now });
    try {
      const tree = view.expand(view.load('pages/events/index.tsx').default({}));
      assert.match(view.text(tree), /ONGOING • UNTIL 31 OCT/);
      assert.doesNotMatch(view.text(tree), /20 JUN - 31 OCT/);
    } finally { display.eventDateContext = original; }
  });
}

test('actual sidebar header and MapEventCard use today for the continuous range', () => {
  const view = harness(mirrored);
  const tree = view.expand(view.load('components/map/MapSidebar.tsx').default({ events: [mirrored], loading: false, error: null, dateContext: context }));
  assert.match(view.text(tree), /Monday 12 Oct/);
  assert.match(view.text(tree), /ONGOING • UNTIL 31 OCT/);
  assert.doesNotMatch(view.text(tree), /20 Jun/);
});

test('actual sidebar uses the first relevant future filter day', () => {
  const filter = { ...context, date_from: '2026-10-20', date_to: '2026-10-25' };
  const view = harness(mirrored, filter);
  const tree = view.expand(view.load('components/map/MapSidebar.tsx').default({ events: [mirrored], loading: false, error: null, dateContext: filter }));
  assert.match(view.text(tree), /Tuesday 20 Oct/);
  assert.match(view.text(tree), /ONGOING • UNTIL 31 OCT/);
});

test('actual map marker popup uses the same ongoing label', () => {
  const view = harness(mirrored);
  const tree = view.expand(view.load('components/events/ClusteredEventMarkers.tsx').default({ events: [mirrored], dateContext: context }));
  const popup = view.nodes(tree).find(node => node.type === 'info-window');
  assert.ok(popup, 'Real selected marker InfoWindow must be rendered');
  assert.match(view.text(popup), /ONGOING • UNTIL 31 OCT/);
});

test('actual /map forwards its date context to sidebar and GoogleMapView → marker popup', () => {
  const filter = { ...context, date_from: '2026-10-20', date_to: '2026-10-25' };
  const view = harness(mirrored, filter);
  const tree = view.load('pages/map.tsx').default({});
  const sidebarComponent = view.load('components/map/MapSidebar.tsx').default;
  const sidebar = view.nodes(tree).find(node => node.type === sidebarComponent);
  const dynamicMap = view.nodes(tree).find(node => node.type === 'dynamic-map');
  assert.ok(sidebar && dynamicMap, 'Actual map route must render both surfaces');
  assert.equal(sidebar.props.dateContext.date_from, '2026-10-20');
  assert.equal(dynamicMap.props.dateContext.date_to, '2026-10-25');
  const original = display.resolveEventDateDisplay;
  display.resolveEventDateDisplay = (event, context) => original(event, { now, ...context });
  try {
    assert.match(view.text(view.expand(sidebar)), /Tuesday 20 Oct/);
    const map = view.expand(view.load('components/events/GoogleMapView.tsx').default(dynamicMap.props));
    assert.match(view.text(map), /ONGOING • UNTIL 31 OCT/);
  } finally { display.resolveEventDateDisplay = original; }
});

test('actual card and sidebar retain future, recurring and discrete showtime dates', () => {
  const future = { ...salt, date_start: '2026-11-01T10:00:00', date_end: '2027-03-02T17:00:00' };
  future.showtimes = [{ start_time: future.date_start, end_time: future.date_end }];
  const recurring = { ...salt, parent_event_id: 'parent', recurrence_group_id: 'group', date_start: '2026-10-15T10:00:00', date_end: '2026-10-15T12:30:00' };
  const several = { ...salt, date_start: '2026-11-15T10:00:00', date_end: '2026-12-13T12:30:00', showtimes: [
    { start_time: '2026-11-15T10:00:00', end_time: '2026-11-15T12:30:00' },
    { start_time: '2026-12-13T10:00:00', end_time: '2026-12-13T12:30:00' },
  ] };
  for (const [event, label] of [[future, '1 NOV - 2 MAR'], [recurring, '15 OCT'], [several, '15 NOV']]) {
    const view = harness(event);
    const card = view.expand(view.load('components/events/EventCard.tsx').EventCard({ event, dateContext: context }));
    assert.ok(view.text(card).includes(label));
    assert.doesNotMatch(view.text(card), /ONGOING/);
    const sidebar = view.expand(view.load('components/map/MapSidebar.tsx').default({ events: [event], loading: false, error: null, dateContext: context }));
    assert.ok(view.text(sidebar).includes(label));
    assert.doesNotMatch(view.text(sidebar), /ONGOING/);
  }
});
