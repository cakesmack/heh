const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, initial = []) {
  const state = [...initial];
  let cursor = 0, effects = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(value) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof value === 'function' ? value() : value;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useRef: value => ({ current: value }), useEffect: effect => effects.push(effect),
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, React: react, console, URLSearchParams, require(name) {
    if (name === 'react') return react;
    if (name in imports) return imports[name];
    throw new Error(`Unexpected collection-test import ${name}`);
  } });
  return { exports: module.exports, render(props) { cursor = 0; effects = []; return module.exports.default(props); }, effect: index => effects[index]() };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === 'object' ? [tree, ...nodes(tree.props.children)] : [];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  return tree && typeof tree === 'object' ? text(tree.props.children) : String(tree || '');
}
const helpers = load('lib/collectionKeywords.ts').exports;
const plain = value => JSON.parse(JSON.stringify(value));

test('legacy q hydrates as one phrase; arrays trim, deduplicate by case and preserve phrases', () => {
  assert.deepEqual(plain(helpers.readCollectionKeywords({ q: ' Christmas Santa ' })), ['Christmas Santa']);
  assert.deepEqual(plain(helpers.readCollectionKeywords({ q: 'Old', keywords: [] })), []);
  assert.deepEqual(plain(helpers.normaliseCollectionKeywords(['Christmas', 'CHRISTMAS', ' Santa ', '', null])), ['Christmas', 'Santa']);
  const original = { q: 'Christmas', category_ids: ['music'], price: 'free', exclude_event_ids: ['excluded'] };
  const saved = helpers.withCollectionKeywords(original, [' Christmas ', 'Santa', 'santa']);
  assert.deepEqual(plain(saved), { category_ids: ['music'], price: 'free', exclude_event_ids: ['excluded'], keywords: ['Christmas', 'Santa'], q: 'Christmas' });
  assert.equal(original.q, 'Christmas');
});

test('keyword chips add by Enter/comma/paste, ignore blanks/duplicates, preserve phrases and remove clearly', () => {
  const form = load('components/admin/CollectionKeywordInput.tsx', { '@/lib/collectionKeywords': helpers });
  const props = { keywords: [], onChange: keywords => { props.keywords = keywords; } };
  const render = () => nodes(form.render(props));
  const input = () => render().find(node => node.type === 'input');
  const type = value => input().props.onChange({ target: { value } });
  let prevented = 0;
  const key = value => input().props.onKeyDown({ key: value, nativeEvent: { isComposing: false }, preventDefault() { prevented++; } });
  type(' Christmas '); key('Enter');
  type('Santa'); key(',');
  type('christmas'); key('Enter');
  type('festive, Xmas, ');
  type('Winter craft fair'); input().props.onBlur();
  type('   '); key('Enter');
  assert.deepEqual(plain(props.keywords), ['Christmas', 'Santa', 'festive', 'Xmas', 'Winter craft fair']);
  assert.equal(prevented, 4);
  render().find(node => node.props['aria-label'] === 'Remove keyword Santa').props.onClick();
  assert.deepEqual(plain(props.keywords), ['Christmas', 'festive', 'Xmas', 'Winter craft fair']);
  assert.equal(input().props['aria-describedby'], 'collection-keywords-help');
});

function manager() {
  const calls = {};
  const form = load('components/admin/CollectionsManager.tsx', {
    '@/components/admin/DataTable': 'table', '@/components/admin/Modal': 'modal',
    './CollectionKeywordInput': 'keywords', '@/lib/collectionKeywords': helpers,
    '@/components/ui/OptimizedImage': 'image', '@/components/common/ImageUpload': 'upload',
    '@/lib/ageRestriction': { AGE_RESTRICTION_OPTIONS: [] },
    '@/lib/api': {
      collectionsAPI: { list: async () => [], update: async (id, data) => { calls.update = { id, data }; },
        create: async data => { calls.create = data; }, preview: async data => { calls.preview = data; return { events: [], total: 0 }; } },
      categoriesAPI: { list: async () => ({ categories: [] }) }, tagsAPI: {}, organizersAPI: { list: async () => ({ organizers: [], total: 0 }) },
    },
  }, [[], false]);
  const collection = { id: 42, title: 'Winter', slug: 'winter', target_link: '/collections/winter',
    filter_params: { q: 'Christmas', combine_operator: 'or', price: 'free', exclude_event_ids: ['excluded'] },
    organizer_profile_ids: ['host'], min_lat: 57, max_lat: 59, min_lng: -6, max_lng: -3,
    fixed_start_date: '2030-12-01', fixed_end_date: '2030-12-31' };
  nodes(form.render()).find(node => node.type === 'table').props.onEdit(collection);
  return { calls, form, render: () => nodes(form.render()) };
}

test('actual admin edit loads legacy keyword, saves an array, and preserves unrelated settings', async () => {
  const edit = manager();
  let widget = edit.render().find(node => node.type === 'keywords');
  assert.deepEqual(plain(widget.props.keywords), ['Christmas']);
  widget.props.onChange(['Christmas', 'Santa', 'Xmas']);
  await edit.render().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  const { id, data } = edit.calls.update;
  assert.equal(id, 42);
  assert.deepEqual(plain(data.filter_params.keywords), ['Christmas', 'Santa', 'Xmas']);
  assert.equal(data.filter_params.q, 'Christmas'); // Compatibility mirror, not a combined phrase.
  assert.equal(data.filter_params.combine_operator, 'or');
  assert.equal(data.filter_params.price, 'free');
  assert.deepEqual(plain(data.filter_params.exclude_event_ids), ['excluded']);
  assert.deepEqual(plain(data.organizer_profile_ids), ['host']);
  assert.equal(data.min_lat, 57);
  assert.equal(data.fixed_end_date, '2030-12-31');
});

test('actual admin preview submits the same collection rules without exclusions or saving a collection', async () => {
  const edit = manager();
  edit.render().find(node => node.type === 'keywords').props.onChange(['Christmas', 'Santa']);
  const previewButton = edit.render().find(node => node.type === 'button' && text(node).includes('Preview Events'));
  await previewButton.props.onClick();
  const data = edit.calls.preview;
  assert.deepEqual(plain(data.filter_params.keywords), ['Christmas', 'Santa']);
  assert.equal(data.filter_params.price, 'free');
  assert.deepEqual(plain(data.filter_params.exclude_event_ids), []);
  assert.deepEqual(plain(data.organizer_profile_ids), ['host']);
  assert.equal(data.fixed_start_date, '2030-12-01');
  assert.equal(edit.calls.update, undefined);
  assert.equal(edit.calls.create, undefined);
});
