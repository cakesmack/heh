const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const dates = require('../src/lib/eventDateRange.ts');

// Component handlers/effects only: no browser, Maps API or network.
function load(file, imports, initial = [], globals = {}) {
  const states = [...initial];
  const refs = [];
  const memos = [];
  let cursor, refCursor, memoCursor, effects;
  const react = {
    Component: class {},
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: value => { const i = cursor++; if (!(i in states)) states[i] = value; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useMemo: (callback, deps) => {
      const i = memoCursor++;
      if (!memos[i] || deps.some((value, index) => value !== memos[i].deps[index])) memos[i] = { value: callback(), deps };
      return memos[i].value;
    }, useCallback: callback => callback,
    useRef: initial => { const i = refCursor++; return refs[i] ||= { current: initial }; },
    useEffect: (callback, deps) => effects.push({ callback, deps }),
  };
  const filename = path.join(__dirname, '../src', file);
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, React: react, console,
    require: name => name === 'react' ? react : name === 'date-fns' ? require('date-fns') : name === '@/lib/eventDateRange' ? dates : name in imports ? imports[name] : (() => { throw new Error(`Unexpected ${name}`); })(),
    ...globals,
  });
  return {
    render: props => { cursor = refCursor = memoCursor = 0; effects = []; return module.exports.default(props); },
    runEffect: i => effects[i].callback(), dependencies: i => effects[i].deps, states,
  };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const tick = () => new Promise(resolve => setImmediate(resolve));

function mapHarness(listMap, selectedCollection = null) {
  const state = [[], [{ id: 'category' }], false, null, [{ id: 3, slug: 'festival' }], selectedCollection, true, 'events', [], 'category'];
  return load('pages/map.tsx', {
    'next/router': { useRouter: () => ({ isReady: true, query: {}, replace() {} }) }, 'next/dynamic': () => 'map',
    '@/lib/api': { eventsAPI: { listMap }, categoriesAPI: {}, collectionsAPI: {}, venuesAPI: { listMap: async () => [] } },
    '@/utils/imageOptimizer': { optimizeImage: value => value }, '@/components/map/MapDateFilter': 'dates',
    '@/components/map/MapSidebar': 'sidebar', '@/components/map/MapEventCard': 'event-card',
  }, state);
}

test('existing presets/custom controls drive date-only requests; category remains selected and clear restores week', async () => {
  const requests = [];
  const map = mapHarness(async filters => { requests.push(filters); return []; });
  let tree = map.render({});
  map.runEffect(1);
  await tick();
  const dateProps = nodes(tree).find(node => node.type === 'dates').props;
  const controls = load('components/map/MapDateFilter.tsx', {
    'react-day-picker': { DayPicker: 'calendar' }, 'react-day-picker/dist/style.css': {},
    'lucide-react': { Calendar: 'icon', X: 'close', ChevronDown: 'icon' },
  });
  for (const preset of ['weekend', 'week', 'month']) {
    nodes(controls.render(dateProps)).find(node => node.props.key === preset).props.onClick();
    map.render({});
    map.runEffect(1);
    await tick();
    const request = requests.at(-1);
    assert.match(request.date_from, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(request.date_to, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(request.category_id, 'category');
  }
  assert.notEqual(requests[1].date_to, requests[3].date_to);
  assert.equal(requests[0].date_to, requests[2].date_to); // default/preset seven-day parity
  // Open the existing custom modal and apply its calendar selection.
  nodes(controls.render(dateProps)).find(node => node.type === 'button' && !node.props.key).props.onClick();
  nodes(controls.render(dateProps)).find(node => node.type === 'calendar').props.onSelect({ from: new Date('2027-10-12T12:00:00'), to: new Date('2027-10-14T12:00:00') });
  nodes(controls.render(dateProps)).find(node => node.props.children.includes('Apply Range')).props.onClick();
  tree = map.render({});
  map.runEffect(1);
  await tick();
  assert.equal(requests.at(-1).date_from, '2027-10-12');
  assert.equal(requests.at(-1).date_to, '2027-10-14');
  const updated = nodes(tree).find(node => node.type === 'dates').props;
  nodes(controls.render(updated)).find(node => node.props.role === 'button').props.onClick({ stopPropagation() {} });
  map.render({});
  map.runEffect(1);
  await tick();
  assert.equal(requests.at(-1).date_from, requests[0].date_from);
  assert.equal(requests.at(-1).date_to, requests[0].date_to);
});

test('old responses cannot overwrite new ranges; sidebar and markers consume the identical filtered set', async () => {
  const pending = [];
  const map = mapHarness(filters => new Promise(resolve => pending.push({ filters, resolve })), 'festival');
  let tree = map.render({});
  const cancel = map.runEffect(1);
  await tick();
  nodes(tree).find(node => node.type === 'dates').props.onRangeSelect({ id: 'custom', start: new Date('2027-10-12T12:00'), end: new Date('2027-10-14T12:00') });
  cancel();
  map.render({});
  map.runEffect(1);
  await tick();
  assert.equal(pending[1].filters.collection_id, 3);
  assert.equal(pending[1].filters.date_from, '2027-10-12');
  const current = { id: 'current', category: { id: 'category' }, latitude: 57.48, longitude: -4.22 };
  pending[1].resolve([current]);
  await tick();
  pending[0].resolve([{ ...current, id: 'stale' }]);
  await tick();
  tree = nodes(map.render({}));
  const sidebar = tree.find(node => node.type === 'sidebar');
  const markers = tree.find(node => node.type === 'map');
  assert.equal(sidebar.props.events, markers.props.events);
  assert.deepEqual(sidebar.props.events.map(event => event.id), ['current']);
});

test('an empty filtered result clears existing clusters rather than retaining previous markers', () => {
  const { harness, instances } = clusterHarness();
  harness.render({ events: [] });
  harness.runEffect(0);
  harness.render({ events: [] });
  harness.runEffect(1);
  assert.equal(instances[0].clears, 1);
  assert.equal(instances[0].markers.length, 0);
});

function clusterHarness() {
  const instances = [];
  class FakeMap {
    ready = true;
    listeners = new Set();
    getProjection() { return this.ready ? {} : undefined; }
    addListener(_event, callback) { this.listeners.add(callback); return { remove: () => this.listeners.delete(callback) }; }
    idle() { for (const callback of [...this.listeners]) callback(); }
  }
  let map = new FakeMap();
  class FakeClusterer {
    constructor(options) {
      this.options = options;
      this.map = options.map;
      this.overlayReady = false;
      this.clears = this.renders = 0;
      this.markers = [];
      instances.push(this);
      this.render(); // Real library onAdd calls render before OverlayView readiness.
    }
    getMap() { return this.map; }
    getProjection() { return this.overlayReady && this.map ? {} : undefined; }
    render() { assert.ok(this.map?.ready && this.getProjection(), 'Must not calculate without BOTH projections'); this.renders++; }
    clearMarkers(noDraw) { assert.equal(noDraw, true); this.clears++; this.markers = []; }
    addMarkers(markers, noDraw) { assert.equal(noDraw, true); this.markers.push(...markers); }
    setMap(value) { this.map = value; }
  }
  const harness = load('components/events/ClusteredEventMarkers.tsx', {
    '@vis.gl/react-google-maps': { useMap: () => map, AdvancedMarker: 'marker', InfoWindow: 'info' },
    '@googlemaps/markerclusterer': { MarkerClusterer: FakeClusterer, GridAlgorithm: class {} },
    '@/components/ui/OptimizedImage': 'image',
  }, [], { google: { maps: { Map: FakeMap } } });
  return { harness, instances, getMap: () => map, replaceMap: () => { map = new FakeMap(); } };
}

test('filter updates reuse one clusterer and wait for the overlay projection before rendering', () => {
  const { harness, instances, getMap } = clusterHarness();
  harness.render({ events: [] });
  const originalDependencies = harness.dependencies(0);
  harness.runEffect(0);
  const instance = instances[0];
  harness.states[0] = { first: { id: 'first' } };
  harness.render({ events: [] });
  harness.runEffect(1);
  assert.equal(instance.renders, 0); // Map ready is not OverlayView ready.
  instance.overlayReady = true;
  instance.draw(); // The real Maps readiness signal, not a timer.
  assert.equal(instance.renders, 1);
  for (let i = 0; i < 5; i++) {
    harness.states[0] = { [`marker-${i}`]: { id: `marker-${i}` } };
    harness.render({ events: [{ id: `event-${i}`, latitude: 57.48, longitude: -4.22 }] });
    assert.deepEqual(harness.dependencies(0), originalDependencies);
    harness.runEffect(1);
  }
  assert.equal(instances.length, 1);
  assert.equal(instance.getMap(), getMap());
  assert.equal(instance.markers[0].id, 'marker-4');
  assert.equal(instance.renders, 6); // Exactly one render per batch after readiness.
});

test('cleanup and map replacement cannot render a detached clusterer; replayed effects create no duplicates', () => {
  const { harness, instances, replaceMap } = clusterHarness();
  const props = { events: [] };
  harness.render(props);
  const cleanup = harness.runEffect(0);
  harness.render(props);
  instances[0].overlayReady = true;
  harness.runEffect(1);
  const old = instances[0];
  const renders = old.renders;
  cleanup();
  assert.equal(old.getMap(), null);
  old.render(); // A late library idle callback must be harmless.
  harness.runEffect(1); // React can still have the old clusterer in state.
  assert.equal(old.renders, renders);
  replaceMap();
  harness.render(props);
  const nextCleanup = harness.runEffect(0);
  harness.runEffect(1); // Stale state while the new instance is being committed.
  harness.render(props);
  instances[1].overlayReady = true;
  harness.runEffect(1);
  assert.equal(instances.length, 2); // One per map, not per filter update.
  nextCleanup();
  harness.render(props);
  harness.runEffect(0); // React Strict Mode setup/cleanup/setup.
  assert.equal(instances.length, 3);
  assert.equal(instances.filter(instance => instance.getMap()).length, 1);
});

test('a pending map-ready callback is disposed on unmount without creating a late clusterer', () => {
  const { harness, instances, getMap } = clusterHarness();
  getMap().ready = false;
  harness.render({ events: [] });
  const cleanup = harness.runEffect(0);
  const queuedIdle = [...getMap().listeners][0];
  cleanup();
  getMap().ready = true;
  queuedIdle();
  assert.equal(instances.length, 0);
  assert.equal(getMap().listeners.size, 0);
});

test('mapId configuration omits inline styles; maps without mapId keep existing styles', () => {
  for (const mapId of ['heh-map-id', undefined]) {
    const harness = load('components/events/GoogleMapView.tsx', {
      '@vis.gl/react-google-maps': { Map: 'google-map', Marker: 'marker', InfoWindow: 'info', useMap: () => null },
      './ClusteredEventMarkers': 'event-markers', './ClusteredVenueMarkers': 'venue-markers',
      '@/utils/imageOptimizer': { optimizeImage: value => value },
    }, [], { process: { env: { NEXT_PUBLIC_GOOGLE_MAP_ID: mapId } } });
    const map = nodes(harness.render({ events: [] })).find(node => node.type === 'google-map');
    assert.equal(map.props.mapId, mapId);
    if (mapId) assert.equal(map.props.styles, undefined);
    else assert.ok(map.props.styles.length > 0);
  }
});

test('the existing map API helper transmits dates alongside collection and location filters', async () => {
  let requested;
  const filename = path.join(__dirname, '../src/lib/api.ts');
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    module, exports: module.exports, process: { env: {} }, URLSearchParams,
    fetch: async url => { requested = new URL(url); return { ok: true, status: 200, json: async () => [] }; },
  });
  await module.exports.eventsAPI.listMap({ date_from: '2027-10-12', date_to: '2027-10-14', collection_id: 3, latitude: 57.48, longitude: -4.22, radius_km: 10 });
  assert.equal(requested.pathname, '/api/events/map');
  assert.equal(requested.searchParams.get('date_to'), '2027-10-14');
  assert.equal(requested.searchParams.get('collection_id'), '3');
  assert.equal(requested.searchParams.get('radius'), '10');
});
