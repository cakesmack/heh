const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const api = require('../src/lib/api.ts');
const dates = require('../src/lib/eventDateRange.ts');
const display = require('../src/lib/eventDateDisplay.ts');

// Execute the real page, hero, DiscoveryBar, useEvents hook, result sections and
// EventCard as Node JSX trees. No browser, server, effects or network access.
function harness() {
  const cache = new Map();
  const imports = {
    'next/link': 'link', 'next/image': 'image', 'next/head': 'head',
    'next/navigation': { usePathname: () => '/', useSearchParams: () => ({}) },
    '@/hooks/useDebounce': { useDebounce: value => value },
    '@/hooks/useAuth': { useAuth: () => ({ user: null }) },
    '@/lib/api': api, '@/lib/eventDateRange': dates, '@/lib/eventDateDisplay': display,
    '@/lib/formatPrice': require('../src/lib/formatPrice.ts'),
    '@/utils/imageOptimizer': { optimizeImage: value => value },
    '@/components/search/EventDateRangePicker': 'date-picker',
    '@/components/search/FilterBar': 'filter-bar',
    '@/components/events/BookmarkButton': { BookmarkButton: 'bookmark' },
    '@/components/common/Badge': { Badge: 'badge' },
    'react-hot-toast': { toast: {} },
    'lucide-react': { MapPin: 'icon', Building2: 'icon', Users: 'icon' },
  };
  const real = new Set(['pages/index.tsx', 'hooks/useEvents.ts', 'components/home/HeroSection.tsx',
    'components/home/DiscoveryBar.tsx', 'components/home/SearchResultsDrawer.tsx', 'components/events/EventCard.tsx']);
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    if (!real.has(file)) return { default: file };
    const state = [], refs = [];
    let cursor = 0, refCursor = 0;
    const react = {
      createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
      useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
        return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
      useRef(initial) { const i = refCursor++; return refs[i] ||= { current: initial }; },
      useEffect() {}, useCallback: callback => callback,
    };
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText, { module, exports: module.exports, React: react, console, process,
      // Analytics timers are unrelated to the submit/render behaviour under test.
      setTimeout() {}, require(name) {
        if (name === 'react') return react;
        if (name === 'next/dynamic') return callback => load(callback.toString().match(/@\/([^'"]+)/)[1] + '.tsx').default;
        if (name in imports) return imports[name];
        if (name.startsWith('@/')) return load(name.slice(2) + (name.includes('useEvents') ? '.ts' : '.tsx'));
        throw new Error(`Unexpected import: ${name}`);
      },
    });
    const exported = { __esModule: true };
    for (const [key, value] of Object.entries(module.exports)) exported[key] = typeof value === 'function'
      ? (...args) => { cursor = refCursor = 0; return value(...args); } : value;
    cache.set(file, exported);
    return exported;
  }
  function expand(node) {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  }
  return { render: () => expand(load('pages/index.tsx').default()) };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  return tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree || '');
}
const event = { id: 'event', title: 'Eden Court concert', date_start: '2030-11-10T19:00:00', price: 0 };
const venue = { id: 'venue', slug: 'eden-court', name: 'Eden Court', city: 'Inverness' };

async function search({ events = [event], venues = [venue], range, total = events.length } = {}, verify) {
  const originalFetch = global.fetch, requests = [];
  global.fetch = async url => {
    const request = new URL(url);
    requests.push(request);
    assert.ok(['/api/search', '/api/events'].includes(request.pathname));
    return { ok: true, status: 200, json: async () => request.pathname === '/api/search'
      ? { venues, groups: [], events: [] } : { events, total } };
  };
  try {
    const home = harness();
    if (range) nodes(home.render()).find(node => node.type === 'date-picker').props.onChange(range);
    nodes(home.render()).find(node => node.type === 'input' && node.props.id === 'search').props.onChange({ target: { value: 'eden court' } });
    // Execute the actual Enter handler, not a stand-in hero callback.
    await nodes(home.render()).find(node => node.type === 'input' && node.props.id === 'search').props.onKeyDown({ key: 'Enter', preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
    await verify(home, requests);
  } finally { global.fetch = originalFetch; }
}

test('homepage Enter stays inline and renders current event cards and separate linked venue results', async () => {
  await search({}, (home, requests) => {
    const tree = home.render(), all = nodes(tree);
    assert.match(text(tree), /Matching Venues/);
    assert.match(text(tree), /Matching Events/);
    assert.match(text(tree), /Eden Court concert/);
    assert.ok(all.some(node => node.type === 'link' && node.props.href === '/venues/eden-court'));
    assert.ok(all.some(node => node.type === 'link' && node.props.href === '/events/event'));
    assert.equal(requests.find(request => request.pathname === '/api/events').searchParams.get('q'), 'eden court');
    // Loading next/router would fail this harness: no navigation is available.
    assert.equal(all.find(node => node.type === 'input' && node.props.id === 'search').props.value, 'eden court');
  });
});
test('event-only results retain the event section with a venue empty state', async () => {
  await search({ venues: [] }, home => {
    assert.match(text(home.render()), /Eden Court concert/);
    assert.match(text(home.render()), /No matching venues found/);
  });
});
test('venue-only results remain visible alongside the event empty state', async () => {
  await search({ events: [] }, home => {
    assert.match(text(home.render()), /Matching Venues/);
    assert.match(text(home.render()), /Eden Court/);
    assert.match(text(home.render()), /No events found/);
  });
});
test('no matches shows both event and venue empty states', async () => {
  await search({ events: [], venues: [] }, home => {
    assert.match(text(home.render()), /No matching venues found/);
    assert.match(text(home.render()), /No events found/);
  });
});
test('selected range filters only events and retains venue-only matches', async () => {
  await search({ events: [], range: { from: '2026-10-20', to: '2026-10-25' } }, async (home, requests) => {
    const eventRequest = requests.find(request => request.pathname === '/api/events');
    assert.equal(eventRequest.searchParams.get('date_from'), '2026-10-20T00:00:00');
    assert.equal(eventRequest.searchParams.get('date_to'), '2026-10-25T23:59:59.999999');
    assert.equal(eventRequest.searchParams.get('include_past'), 'true');
    const venueRequest = requests.find(request => request.pathname === '/api/search');
    assert.deepEqual([...venueRequest.searchParams.keys()].sort(), ['limit', 'q']);
    assert.match(text(home.render()), /Matching Venues/);
    assert.match(text(home.render()), /No events found/);
  });
});

test('date range survives inline sorting/pagination and the optional View All link', async () => {
  await search({ total: 16, range: { from: '2026-10-20', to: '2026-10-25' } }, async (home, requests) => {
    let tree = home.render();
    await nodes(tree).find(node => node.type === 'select' && node.props.value === 'date_asc').props.onChange({ target: { value: 'created_desc' } });
    tree = home.render();
    await nodes(tree).find(node => node.type === 'button' && text(node).trim() === 'Next').props.onClick();
    const last = requests.at(-1);
    assert.equal(last.searchParams.get('skip'), '8');
    assert.equal(last.searchParams.get('sort_by'), 'created_desc');
    assert.equal(last.searchParams.get('date_from'), '2026-10-20T00:00:00');
    assert.equal(last.searchParams.get('date_to'), '2026-10-25T23:59:59.999999');
    const allResults = nodes(home.render()).find(node => node.type === 'link' && text(node).includes('View All Results'));
    assert.equal(allResults.props.href.query.date_from, '2026-10-20');
    assert.equal(allResults.props.href.query.date_to, '2026-10-25');
    assert.equal(requests.filter(request => request.pathname === '/api/search').length, 1);
    assert.match(text(home.render()), /Matching Venues/);
  });
});

test('restored homepage uses current ongoing, recurring and showtime card date display', async () => {
  const events = [
    { ...event, id: 'continuous', date_start: '2000-06-20T10:00:00', date_end: '2099-10-31T17:00:00' },
    { ...event, id: 'recurring', is_recurring: true, date_start: '2099-11-10T19:00:00', next_occurrence: '2099-11-17T19:00:00' },
    { ...event, id: 'showtime', date_start: '2099-11-01T10:00:00', date_end: '2099-11-30T20:00:00',
      showtimes: [{ start_time: '2099-11-11T19:00:00', end_time: '2099-11-11T21:00:00' }] },
  ];
  await search({ events }, home => {
    const cards = nodes(home.render()).filter(node => node.type === 'link' && /^\/events\/(continuous|recurring|showtime)$/.test(node.props.href));
    assert.match(text(cards[0]), /ONGOING • UNTIL 31 OCT/);
    assert.match(text(cards[1]), /17 NOV/);
    assert.doesNotMatch(text(cards[1]), /ONGOING/);
    assert.match(text(cards[2]), /11 NOV/);
    assert.doesNotMatch(text(cards[2]), /ONGOING/);
  });
});
