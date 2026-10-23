const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);

const categories = [{ id: 'festivals', name: 'Festivals', slug: 'festivals', gradient_color: '#123456' },
  { id: 'food', name: 'Food & Drink', slug: 'food-drink', gradient_color: '#FEDCBA' }];
const event = { id: 'event', title: 'Highland festival', category_id: 'festivals', category: categories[0],
  secondary_category_id: 'food', secondary_category: categories[1],
  date_start: '2030-07-01T10:00:00', date_end: '2030-07-01T12:00:00', price: 0, status: 'published' };

// Real JSX/handlers, external UI/services controlled in Node. No DOM or browser.
function load(file, imports = {}, initial = []) {
  const state = [...initial];
  let cursor = 0;
  const react = { Component: class {}, createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(value) { const i = cursor++; if (!(i in state)) state[i] = typeof value === 'function' ? value() : value;
      return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useEffect() {}, useRef: value => ({ current: value }), useCallback: value => value, useMemo: callback => callback() };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, React: react, process, console, require(name) {
    if (name === 'react') return react;
    if (name in imports) return imports[name];
    if (name === 'next/link') return 'link';
    if (name === 'next/head') return 'head';
    if (name === 'next/dynamic') return () => 'dynamic';
    if (name.startsWith('@/components/')) return { __esModule: true, default: name, Badge: 'badge', Input: 'input-component', Button: 'button', Card: 'card', Spinner: 'spinner', BookmarkButton: 'bookmark', TicketTierSelector: 'tickets', CheckoutModal: 'checkout' };
    throw new Error(`Unexpected ${name}`);
  } });
  return { state, render(props, name = 'default') { cursor = 0; return module.exports[name](props); } };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
}
const options = node => nodes(node).filter(item => item.type === 'option');
const text = node => Array.isArray(node) ? node.map(text).join(' ') : node && typeof node === 'object' ? text(node.props.children) : String(node || '');

test('guided organiser selector prevents duplicates, allows removal and keeps primary required', () => {
  const draft = { categoryId: 'festivals', categoryName: 'Festivals', secondaryCategoryId: 'food', secondaryCategoryName: 'Food & Drink', description: '' };
  const form = load('components/events/guided/DetailsQuestion.tsx', { '@/lib/api': { api: {} }, '@/hooks/useAuth': { useAuth: () => ({}) } }, [categories]);
  const props = { draft, onChange: patch => Object.assign(draft, patch) };
  let all = nodes(form.render(props, 'DetailsQuestion'));
  const primary = all.find(node => node.props.id === 'guided-category');
  assert.equal(options(primary).find(node => node.props.value === 'food').props.disabled, true);
  const secondary = all.find(node => node.props.id === 'guided-secondary-category');
  assert.equal(options(secondary).find(node => node.props.value === 'festivals').props.disabled, true);
  secondary.props.onChange({ target: { value: '' } });
  assert.equal(draft.secondaryCategoryId, '');
  assert.equal(draft.categoryId, 'festivals');
  all = nodes(form.render(props, 'DetailsQuestion'));
  assert.equal(options(all.find(node => node.props.id === 'guided-category')).find(node => node.props.value === 'food').props.disabled, false);
});

test('admin create/edit uses existing API with secondary ID or explicit null', async () => {
  const saved = [];
  const api = { eventsAPI: { create: async value => saved.push(value), update: async (id, value) => saved.push(value), get: async () => event },
    categoriesAPI: {}, venuesAPI: {}, adminEventsAPI: { list: async () => ({ data: [event], total: 1, total_pages: 1 }) } };
  const form = load('components/admin/EventsManager.tsx', { 'next/router': { useRouter: () => ({}) }, '@/lib/api': api,
    '@/lib/ageRestriction': { AGE_RESTRICTION_OPTIONS: [] } }, [[event], categories, [], false]);
  nodes(form.render()).find(node => node.type === 'button' && text(node).trim() === 'Add Event').props.onClick();
  let all = nodes(form.render());
  let secondary = all.find(node => node.type === 'select' && options(node).some(option => option.props.children[0] === 'None'));
  assert.equal(secondary.props.value, '');
  assert.equal(options(secondary).find(option => option.props.value === 'festivals').props.disabled, true);
  secondary.props.onChange({ target: { value: 'food' } });
  await nodes(form.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(saved[0].category_id, 'festivals');
  assert.equal(saved[0].secondary_category_id, 'food');
  await new Promise(resolve => setImmediate(resolve)); // Existing list refresh completes after saving.
  all = nodes(form.render());
  await all.find(node => node.type === 'button' && text(node).trim() === 'Edit').props.onClick({ stopPropagation() {} });
  all = nodes(form.render());
  secondary = all.find(node => node.type === 'select' && options(node).some(option => option.props.children[0] === 'None'));
  assert.equal(secondary.props.value, 'food');
  secondary.props.onChange({ target: { value: '' } });
  await nodes(form.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(saved[1].secondary_category_id, null);
  assert.equal(saved[1].category_id, 'festivals');
});

test('event card identity stays primary when secondary is present', () => {
  const card = load('components/events/EventCard.tsx', {
    '@/lib/eventDateDisplay': require('../src/lib/eventDateDisplay.ts'), '@/lib/formatPrice': require('../src/lib/formatPrice.ts'),
    'react-hot-toast': { toast: {} },
  });
  const withSecondary = card.render({ event }, 'EventCard');
  const withoutSecondary = card.render({ event: { ...event, secondary_category: null, secondary_category_id: null } }, 'EventCard');
  assert.equal(JSON.stringify(withSecondary), JSON.stringify(withoutSecondary));
  assert.match(JSON.stringify(withSecondary), /#123456/);
  assert.doesNotMatch(JSON.stringify(withSecondary), /#FEDCBA|Food & Drink/);
});

test('event detail links both categories with primary badge visually dominant', () => {
  const detail = load('pages/events/[id].tsx', {
    'next/router': { useRouter: () => ({ query: { id: event.id }, isReady: true }) },
    '@/hooks/useAuth': { useAuth: () => ({ user: null, isAuthenticated: false }) },
    '@/hooks/useAnalytics': { useAnalytics: () => ({}) },
    '@/lib/api': {}, '@/lib/formatPrice': require('../src/lib/formatPrice.ts'),
    '@/lib/eventOccurrences': require('../src/lib/eventOccurrences.ts'), '@/lib/eventDateDisplay': require('../src/lib/eventDateDisplay.ts'),
    '@/utils/imageOptimizer': { optimizeImage: () => '' }, 'lucide-react': { Heart: 'heart', HeartOff: 'heart' }, 'react-hot-toast': { toast: {} },
  });
  const all = nodes(detail.render({ initialEvent: event }));
  const primary = all.find(node => node.type === 'link' && node.props.href === '/category/festivals');
  const secondary = all.find(node => node.type === 'link' && node.props.href === '/category/food-drink');
  assert.ok(primary && secondary);
  assert.equal(nodes(primary).find(node => node.type === 'badge').props.variant, 'info');
  assert.equal(nodes(secondary).find(node => node.type === 'badge').props.variant, 'default');
});

test('map category selection retains secondary matches without changing primary identity', () => {
  const mapEvent = { ...event, latitude: 57.48, longitude: -4.22 };
  const map = load('pages/map.tsx', {
    'date-fns': require('date-fns'),
    'next/router': { useRouter: () => ({ isReady: true, query: {} }) }, '@/lib/api': {},
    '@/lib/eventDateRange': require('../src/lib/eventDateRange.ts'), '@/utils/imageOptimizer': { optimizeImage: value => value },
  }, [[mapEvent], categories, false, null, [], null, true, 'events', [], 'food']);
  const sidebar = nodes(map.render()).find(node => typeof node.type === 'string' && node.type.endsWith('/MapSidebar'));
  assert.equal(sidebar.props.events.length, 1);
  assert.equal(sidebar.props.events[0].id, event.id);
  assert.equal(sidebar.props.events[0].category.id, 'festivals');
});
