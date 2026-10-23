const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// JSX/handler checks only. Responsive visibility is asserted from the Tailwind
// class contract, not via a browser or a simulated viewport/layout engine.
function load(file, imports = {}, initial = []) {
  const state = [...initial];
  let cursor = 0, effects = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(value) { const i = cursor++; if (!(i in state)) state[i] = typeof value === 'function' ? value() : value;
      return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useEffect: callback => effects.push(callback), useRef: value => ({ current: value }), useCallback: callback => callback,
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, React: react, console, require(name) {
    if (name === 'react') return react;
    if (name === 'next/link') return 'link';
    if (name === 'next/head') return 'head';
    if (name === 'next/dynamic') return () => 'dynamic';
    if (name in imports) return imports[name];
    if (name.startsWith('@/components/')) return name;
    throw new Error(`Unexpected import ${name}`);
  } });
  return { exports: module.exports, component: module.exports.default, render(props) { cursor = 0; effects = []; return module.exports.default(props); },
    effect: index => effects[index]() };
}
function nodes(tree, desktop) {
  if (Array.isArray(tree)) return tree.flatMap(node => nodes(node, desktop));
  if (!tree || typeof tree !== 'object') return [];
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props), desktop);
  const classes = (tree.props.className || '').split(/\s+/);
  if (desktop !== undefined && (desktop ? classes.includes('md:hidden') || classes.includes('hidden') && !classes.includes('md:contents') : classes.includes('hidden'))) return [];
  return [tree, ...nodes(tree.props.children, desktop)];
}
const names = ['Music', 'Arts, Theatre & Dance', 'Family & Kids', 'Festivals', 'Food & Drink', 'Comedy',
  'Nightlife & Social', 'Sports & Fitness', 'Culture & Heritage', 'Classes & Workshops',
  'Markets & Fairs', 'Nature & Outdoors', 'Talks, Lectures & Business', 'Film & Cinema'];
const categories = names.map((name, index) => ({ id: `api-id-${index}`, name, slug: `existing-slug-${index}`,
  gradient_color: `#${(0x123450 + index).toString(16)}`, description: 'API metadata' }));
const card = load('components/categories/CategoryCard.tsx').component;
const browseCategories = load('components/categories/browseCategories.ts').exports;
const grid = () => load('components/categories/CategoryGrid.tsx', { '@/lib/api': {}, './CategoryCard': card, './browseCategories': browseCategories });
const links = (tree, desktop) => nodes(tree, desktop).filter(node => node.type === 'link');
const labels = list => list.map(node => node.props.children.at(-1));

test('desktop defaults to eight requested categories and mobile to six, using one responsive tree', () => {
  const tree = grid().render({ compact: true, initialCategories: [...categories].reverse() });
  assert.deepEqual(labels(links(tree, true)), names.slice(0, 8));
  assert.deepEqual(labels(links(tree, false)), names.slice(0, 6));
  assert.ok(nodes(tree).some(node => node.props.className === 'flex flex-wrap gap-1.5 md:gap-2'));
  for (const link of links(tree, true)) {
    assert.match(link.props.className, /min-h-9/);
    assert.match(link.props.className, /rounded-lg/);
    assert.ok(!link.props.className.includes('md:px-5'));
    assert.match(link.props.className, /focus-visible:ring-2/);
  }
  const button = nodes(tree).find(node => node.type === 'button');
  assert.equal(button.props.type, 'button');
  assert.equal(button.props['aria-expanded'], false);
  assert.equal(button.props['aria-controls'], 'homepage-category-pills');
  assert.equal(button.props.children[0], 'View all categories');
  assert.equal(button.props.children[1].props.children[0], '↓');
  assert.equal(button.props.style, undefined);
  assert.ok(!/border|bg-white|rounded-full/.test(button.props.className));
  assert.match(button.props.className, /focus-visible:ring-2/);
});

test('native button expands/collapses all categories inline on desktop and mobile without changing links or colours', () => {
  const form = grid(), props = { compact: true, initialCategories: [...categories].reverse() };
  nodes(form.render(props)).find(node => node.type === 'button').props.onClick();
  let tree = form.render(props);
  for (const desktop of [false, true]) {
    assert.deepEqual(labels(links(tree, desktop)), names);
    links(tree, desktop).forEach((link, index) => {
      assert.equal(link.props.href, `/category/${categories[index].slug}`);
      assert.equal(link.props.style.color, categories[index].gradient_color);
      assert.equal(link.props.style.backgroundColor, `${categories[index].gradient_color}10`);
      assert.equal(link.props.style.border, `1px solid ${categories[index].gradient_color}25`);
    });
  }
  const button = nodes(tree).find(node => node.type === 'button');
  assert.equal(button.props['aria-expanded'], true);
  assert.equal(button.props.children[0], 'Show fewer categories');
  assert.equal(button.props.children[1].props.children[0], '↑');
  button.props.onClick();
  tree = form.render(props);
  assert.equal(links(tree, true).length, 8);
  assert.equal(links(tree, false).length, 6);
});

test('unknown API categories stay accessible; shared non-homepage ordering/selection behaviour is unchanged', () => {
  const extra = { ...categories[0], id: 'extra', slug: 'future-category', name: 'Future API category' };
  const form = grid(), input = [...categories].reverse().concat(extra);
  nodes(form.render({ compact: true, initialCategories: input })).find(node => node.type === 'button').props.onClick();
  assert.equal(links(form.render({ compact: true, initialCategories: input }), true).at(-1).props.href, '/category/future-category');
  const shared = grid();
  assert.deepEqual(labels(links(shared.render({ initialCategories: input }), false)), input.map(category => category.name));
  assert.match(links(shared.render({ initialCategories: input }), false)[0].props.className, /rounded-full/);
  assert.match(links(shared.render({ initialCategories: input }), false)[0].props.className, /md:px-5/);
  let selected;
  const tree = grid().render({ initialCategories: categories, onSelectCategory: slug => { selected = slug; }, activeCategory: categories[0].slug });
  const buttons = nodes(tree).filter(node => node.type === 'button');
  assert.equal(buttons.length, 14);
  buttons[0].props.onClick();
  assert.equal(selected, categories[0].slug);
});

test('homepage locations wrap as text navigation; API sources, destinations and other-page pills stay intact', async () => {
  let categoryCalls = 0, locationQuery;
  const form = load('components/categories/CategoryGrid.tsx', {
    './CategoryCard': card,
    './browseCategories': browseCategories,
    '@/lib/api': { api: { categories: { list: async () => { categoryCalls++; return { categories }; } } } },
  });
  form.render({ compact: true });
  form.effect(0);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(categoryCalls, 1);
  assert.equal(links(form.render({ compact: true }), true).length, 8);
  const locationData = ['Aviemore', 'Dingwall', 'Dornoch', 'Fort William', 'Inverness', 'Nairn', 'Thurso', 'Ullapool', 'Wick']
    .map((name, id) => ({ id, name, slug: name.toLowerCase().replaceAll(' ', '-') }));
  const locations = load('components/PopularLocations.tsx', { '@/lib/api': { locationsAPI: { list: async query => { locationQuery = query; return locationData; } } } });
  locations.render({ compact: true, activeLocation: 'Inverness' });
  locations.effect(0);
  await new Promise(resolve => setImmediate(resolve));
  const compact = locations.render({ compact: true, activeLocation: 'Inverness' });
  const normal = locations.render({ activeLocation: 'Inverness' });
  assert.equal(locationQuery.category_slug, undefined);
  const expected = locationData.map(location => `/locations/${location.slug}`);
  assert.deepEqual(links(compact, false).map(node => node.props.href), expected);
  assert.deepEqual(links(normal, false).map(node => node.props.href), expected);
  assert.match(links(compact, false)[4].props.className, /text-emerald-700 underline/);
  assert.match(links(normal, false)[4].props.className, /bg-emerald-600/);
  for (const link of links(compact, false)) {
    assert.match(link.props.className, /min-h-9/);
    assert.match(link.props.className, /focus-visible:ring-2/);
    assert.ok(!/rounded-full|border|bg-white/.test(link.props.className));
  }
  assert.ok(nodes(compact).some(node => (node.props.className || '').includes('flex-wrap gap-x-4')));
  assert.ok(!nodes(compact).some(node => (node.props.className || '').includes('overflow-x-auto')));
  assert.ok(nodes(normal).some(node => (node.props.className || '').includes('overflow-x-auto')));
  assert.ok(nodes(compact).some(node => (node.props.className || '').includes('max-w-5xl')));
});

test('homepage uses one shared browse panel without changing hero/search', () => {
  const page = load('pages/index.tsx', {
    '@/hooks/useAuth': { useAuth: () => ({}) }, '@/hooks/useEvents': { useEvents: () => ({ events: [], total: 0 }) },
    '@/lib/api': {}, '@/lib/eventDateRange': {}, '@/utils/imageOptimizer': { optimizeImage: () => '' },
  });
  const all = nodes(page.render());
  assert.equal(all.filter(node => node.type === '@/components/categories/BrowseEvents').length, 1);
  assert.equal(all.find(node => node.type === '@/components/categories/BrowseEvents').props.homepageLocations, true);
  const browse = all.find(node => node.props.id === 'categories');
  assert.equal(browse.props.className, 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3');
  assert.ok(!all.some(node => (node.props.className || '').includes('min-h-[66px]')));
  assert.ok(!all.some(node => (node.props.className || '').includes('border-t border-gray-200')));
  const hero = all.find(node => node.type === '@/components/home/HeroSection');
  hero.props.onSearch({ q: undefined }); // Existing clear path: must not navigate or fetch.
  assert.ok(nodes(page.render()).some(node => node.type === '@/components/home/HeroSection'));
});

test('browse always shows all 14 canonical pills on mobile/desktop without expansion or an API lookup', () => {
  const expectedNames = ['Nature & Outdoors', 'Classes & Workshops', 'Talks, Lectures & Business',
    'Nightlife & Social', 'Comedy', 'Culture & Heritage', 'Food & Drink', 'Music', 'Family & Kids',
    'Arts, Theatre & Dance', 'Festivals', 'Markets & Fairs', 'Sports & Fitness', 'Film & Cinema'];
  let categoryCalls = 0;
  const form = load('components/categories/CategoryGrid.tsx', {
    './CategoryCard': card, './browseCategories': browseCategories,
    '@/lib/api': { api: { categories: { list: async () => { categoryCalls++; return { categories: [] }; } } } },
  }), props = { browse: true };
  const tree = form.render(props);
  form.effect(0);
  assert.equal(categoryCalls, 0);
  for (const desktop of [false, true]) assert.deepEqual(labels(links(tree, desktop)), expectedNames);
  assert.ok(nodes(tree).some(node => node.props.className === 'flex flex-wrap gap-2'));
  assert.ok(!nodes(tree).some(node => /hidden|overflow-x/.test(node.props.className || '')));
  assert.ok(!nodes(tree).some(node => node.type === 'button' || node.props['aria-expanded'] !== undefined));
  assert.ok(!nodes(tree).some(node => node.props.role === 'status'));
  for (const link of links(tree, false)) {
    assert.match(link.props.className, /min-h-10/);
    assert.match(link.props.className, /rounded-full/);
    assert.ok(!/w-full|grid-cols|rounded-xl/.test(link.props.className));
    assert.match(link.props.className, /focus-visible:ring-2/);
    const category = browseCategories.browseCategories.find(item => `/category/${item.slug}` === link.props.href);
    assert.ok(category);
    assert.equal(link.props.style.color, category.gradient_color);
    assert.equal(link.props.style.backgroundColor, `${category.gradient_color}10`);
  }
});

test('empty/stale API records cannot omit browse categories; Events buttons preserve slug selection and active state', () => {
  const obsolete = [{ ...categories[0], name: 'Festivals & Markets', slug: 'festivals-markets' }];
  for (const initialCategories of [[], obsolete]) {
    const tree = grid().render({ browse: true, initialCategories });
    assert.equal(links(tree, false).length, 14);
    assert.ok(!labels(links(tree, false)).includes('Festivals & Markets'));
  }
  let selected;
  const tree = grid().render({ browse: true, activeCategory: 'music', onSelectCategory: slug => { selected = slug; } });
  const buttons = nodes(tree).filter(node => node.type === 'button');
  assert.equal(buttons.length, 14); // All category actions; no expansion action.
  const music = buttons.find(node => node.props.children.at(-1) === 'Music');
  assert.equal(music.props['aria-pressed'], true);
  music.props.onClick();
  assert.equal(selected, 'music');
});

test('shared panel stacks full-width categories before locations at every breakpoint', () => {
  const callback = () => {};
  const panel = load('components/categories/BrowseEvents.tsx', { './CategoryGrid': 'categories' });
  const tree = nodes(panel.render({ activeCategory: 'music', onSelectCategory: callback, activeLocation: 'Inverness', locationCategorySlug: 'music' }));
  assert.ok(tree.some(node => node.type === 'h2' && node.props.children[0] === 'Browse events'));
  assert.equal(tree[0].props.className, 'rounded-2xl bg-stone-100/70 p-3 sm:p-4');
  const layout = tree.find(node => node.props.className === 'mt-3 space-y-4');
  assert.ok(layout);
  assert.ok(!tree.some(node => /grid-cols|col-span|flex-row/.test(node.props.className || '')));
  const category = tree.find(node => node.type === 'categories');
  assert.equal(category.props.browse, true);
  assert.equal(category.props.onSelectCategory, callback);
  const locations = tree.find(node => node.type === '@/components/PopularLocations');
  assert.equal(locations.props.browse, true);
  assert.equal(locations.props.categorySlug, 'music');
  assert.ok(tree.indexOf(category) < tree.indexOf(locations));
  const sections = layout.props.children.flat(Infinity);
  assert.equal(sections.length, 2);
  assert.ok(sections.every(section => section.props.className === 'min-w-0'));
});

test('browse location list preserves all returned hubs and category-specific API request without scrolling', async () => {
  let query;
  const hubs = ['Aviemore', 'Dingwall', 'Dornoch', 'Fort William', 'Inverness', 'Nairn', 'Thurso', 'Ullapool', 'Wick', 'Portree']
    .map((name, id) => ({ id, name, slug: name.toLowerCase().replaceAll(' ', '-') }));
  const form = load('components/PopularLocations.tsx', {
    '@/lib/api': { locationsAPI: { list: async value => { query = value; return hubs; } } },
  });
  const props = { browse: true, categorySlug: 'music' };
  form.render(props); form.effect(0);
  await new Promise(resolve => setImmediate(resolve));
  const tree = form.render(props);
  assert.equal(query.category_slug, 'music');
  assert.deepEqual(links(tree, false).map(node => node.props.href), hubs.map(hub => `/locations/${hub.slug}`));
  assert.ok(nodes(tree).some(node => node.props.className === 'flex flex-wrap gap-x-5 gap-y-0'));
  assert.ok(!nodes(tree).some(node => /overflow-x|rounded-full/.test(node.props.className || '')));
});

test('homepage restores all nine shortcuts including Dornoch when the hub metadata is missing; Events retains full list', async () => {
  const names = ['Aviemore', 'Dingwall', 'Dornoch', 'Fort William', 'Inverness', 'Nairn', 'Thurso', 'Ullapool', 'Wick'];
  const hubs = names.filter(name => name !== 'Dornoch').concat('Portree')
    .map((name, id) => ({ id, name, slug: name === 'Inverness' ? 'existing-inverness-slug' : name.toLowerCase().replaceAll(' ', '-') }));
  const form = load('components/PopularLocations.tsx', {
    '@/lib/api': { locationsAPI: { list: async () => hubs } },
  });
  form.render({ browse: true, homepageShortlist: true }); form.effect(0);
  await new Promise(resolve => setImmediate(resolve));
  const home = links(form.render({ browse: true, homepageShortlist: true }), false);
  assert.deepEqual(labels(home), names);
  assert.equal(home[2].props.href, '/locations/dornoch');
  assert.equal(home[4].props.href, '/locations/existing-inverness-slug');
  const events = links(form.render({ browse: true }), false);
  assert.equal(events.length, hubs.length);
  assert.ok(events.some(link => link.props.href === '/locations/portree'));
});

test('Events page shares panel while preserving category toggle, URL state, and category-specific locations', () => {
  let pushed;
  const current = { category: 'music', location: 'Inverness', q: 'concert' };
  const page = load('pages/events/index.tsx', {
    'next/router': { useRouter: () => ({ pathname: '/events', query: { q: 'concert' }, push: (...args) => { pushed = args; } }) },
    '@/hooks/useGeolocation': { useGeolocation: () => ({}) }, '@/context/SearchContext': { useSearch: () => ({}) },
    '@/lib/api': {}, '@/lib/dateUtils': {}, '@/lib/eventDateDisplay': { eventDateContext: value => value },
    '@/lib/eventDateRange': { rangeFromQuery: () => ({}), mergeEventSearchQuery: (query, filters) => ({ ...query, ...filters }) },
  }, [[], 0, false, false, null, current, {}]);
  const panel = nodes(page.render()).find(node => node.type === '@/components/categories/BrowseEvents');
  assert.equal(panel.props.locationCategorySlug, 'music');
  assert.equal(panel.props.activeLocation, 'Inverness');
  panel.props.onSelectCategory('music');
  assert.equal(pushed[0].query.category, undefined);
  assert.equal(pushed[0].query.q, 'concert');
  assert.equal(pushed[0].query.location, 'Inverness');
  panel.props.onSelectCategory('comedy');
  assert.equal(pushed[0].query.category, 'comedy');
  assert.equal(pushed[2].shallow, true);
});

test('homepage loading rows wrap without pill scrolling and Happening Next has tighter top spacing', () => {
  const categoriesLoading = grid().render({ compact: true });
  const locationsLoading = load('components/PopularLocations.tsx', { '@/lib/api': {} }).render({ compact: true });
  for (const tree of [categoriesLoading, locationsLoading]) {
    assert.ok(nodes(tree).some(node => (node.props.className || '').includes('flex-wrap')));
    assert.ok(!nodes(tree).some(node => (node.props.className || '').includes('overflow-x-auto')));
    assert.equal(tree.props.className, tree === categoriesLoading ? 'py-1 bg-white' : 'py-1 bg-gray-50');
  }
  const upcoming = load('components/home/HappeningNextEvents.tsx', { 'lucide-react': {}, '@/types': {} });
  const loading = upcoming.render({ events: [], isLoading: true });
  const populated = upcoming.render({ events: [{ id: 'unchanged-event-card' }], isLoading: false });
  assert.equal(loading.props.className, 'pt-4 pb-10 bg-gray-50 border-b border-gray-100');
  assert.equal(populated.props.className, loading.props.className);
  assert.ok(nodes(populated).some(node => node.props.event?.id === 'unchanged-event-card'));
});
