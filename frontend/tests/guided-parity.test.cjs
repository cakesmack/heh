const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise component wiring and handlers in Node, with no browser, network or
// new test dependency. Effects/services are controlled explicitly by each test.
function loadComponent(file, imports = {}, initialState = [], globals = {}) {
  const states = [...initialState];
  let effects = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useEffect: (effect) => { effects.push(effect); },
    useRef: (value) => ({ current: value }),
  };
  const filename = path.join(__dirname, '../src', file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module, exports: module.exports, React: react, console,
    require: (name) => {
      if (name === 'react') return react;
      if (name in imports) return imports[name];
      throw new Error(`Unexpected import ${name}`);
    },
    ...globals,
  }, { filename });
  return {
    exports: module.exports,
    runEffects: () => { effects.forEach(effect => effect()); },
    render: (component, props) => { cursor = 0; effects = []; return component(props); },
  };
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const icons = { Building2: 'building', MapPin: 'pin', Milestone: 'milestone', Check: 'check', Clock3: 'clock' };
const venue = { id: 'new-venue', name: 'Highland Hall', address: 'Inverness IV1 1AA', status: 'UNVERIFIED', latitude: 57.48, longitude: -4.22 };

test('guided single and participating selectors enable legacy Google discovery and preserve selected objects', () => {
  const harness = loadComponent('components/events/guided/VenueQuestion.tsx', {
    'lucide-react': icons,
    '@/components/venues/MultiVenueSelector': 'multi-selector',
    '@/components/venues/UnifiedVenueSelect': { UnifiedVenueSelect: 'venue-selector' },
  });
  let selected;
  const props = { mode: 'single', singleVenueId: null, singleVenue: null, participatingVenues: [], inputRef: { current: null },
    onModeChange: () => {}, onSingleVenueChange: (...args) => { selected = args; }, onParticipatingVenuesChange: (items) => { selected = items; } };
  const single = nodes(harness.render(harness.exports.VenueQuestion, props)).find(node => node.type === 'venue-selector');
  assert.notEqual(single.props.disableGoogle, true);
  single.props.onChange(venue.id, venue);
  assert.equal(selected[0], venue.id);
  assert.equal(selected[1], venue);
  const multiple = nodes(harness.render(harness.exports.VenueQuestion, { ...props, mode: 'multiple' })).find(node => node.type === 'multi-selector');
  assert.notEqual(multiple.props.disableGoogle, true);
  multiple.props.onChange([venue]);
  assert.equal(selected[0], venue);
});

test('legacy participating selector adds Google-created venues, deduplicates IDs and removes venues', () => {
  const harness = loadComponent('components/venues/MultiVenueSelector.tsx', {
    '../venues/UnifiedVenueSelect': { UnifiedVenueSelect: 'venue-selector' },
  });
  let selection = [];
  const render = () => harness.render(harness.exports.default, { selectedVenues: selection, onChange: (items) => { selection = items; } });
  let selector = nodes(render()).find(node => node.type === 'venue-selector');
  assert.equal(selector.props.disableGoogle, false);
  selector.props.onChange(venue.id, venue);
  assert.equal(selection[0], venue);
  selector = nodes(render()).find(node => node.type === 'venue-selector');
  selector.props.onChange(venue.id, { ...venue });
  assert.equal(selection.length, 1);
  nodes(render()).find(node => node.props['aria-label'] === `Remove ${venue.name}`).props.onClick();
  assert.equal(selection.length, 0);
});

test('legacy Google selection creates an UNVERIFIED venue through the existing API and selects its response', async () => {
  const prediction = { place_id: 'google-place', description: venue.address, structured_formatting: { main_text: venue.name } };
  let detailsRequest, payload, selected, pending;
  const placesService = { getDetails: (request, callback) => {
    detailsRequest = request;
    pending = callback({ name: venue.name, place_id: prediction.place_id, formatted_address: venue.address,
      geometry: { location: { lat: () => venue.latitude, lng: () => venue.longitude } },
      website: 'https://hall.example', formatted_phone_number: '01463 123456',
      address_components: [{ types: ['postal_code'], long_name: 'IV1 1AA' }],
    }, 'OK');
  } };
  const harness = loadComponent('components/venues/UnifiedVenueSelect.tsx', {
    '@vis.gl/react-google-maps': { useMapsLibrary: () => null },
    '@/lib/api': { api: { venues: {
      listCategories: async () => [{ id: 'other-id', slug: 'other' }],
      create: async (data) => { payload = data; return venue; },
    } } },
  }, ['', [], [prediction], false, false, true, null, null, placesService], {
    google: { maps: { places: { PlacesServiceStatus: { OK: 'OK' } } } },
  });
  const tree = harness.render(harness.exports.UnifiedVenueSelect, { value: null, onChange: (...args) => { selected = args; } });
  nodes(tree).find(node => node.props.key === prediction.place_id).props.onClick();
  await pending;
  assert.equal(detailsRequest.placeId, prediction.place_id);
  assert.equal(payload.status, 'UNVERIFIED');
  assert.equal(payload.google_place_id, prediction.place_id);
  assert.equal(payload.postcode, 'IV1 1AA');
  assert.equal(payload.address, venue.address);
  assert.equal(payload.latitude, venue.latitude);
  assert.equal(payload.longitude, venue.longitude);
  assert.equal(payload.website, 'https://hall.example');
  assert.equal(payload.phone, '01463 123456');
  assert.equal(payload.category_id, 'other-id');
  assert.equal(selected[0], venue.id);
  assert.equal(selected[1], venue);
});

test('registered venue selection reuses the existing record without creating a venue', () => {
  const harness = loadComponent('components/venues/UnifiedVenueSelect.tsx', {
    '@vis.gl/react-google-maps': { useMapsLibrary: () => null },
    '@/lib/api': { api: { venues: { create: () => { throw new Error('Must not create'); } } } },
  }, ['', [venue], [], false, false, true, null]);
  let selected;
  const tree = harness.render(harness.exports.UnifiedVenueSelect, { value: null, onChange: (...args) => { selected = args; } });
  nodes(tree).find(node => node.props.key === venue.id).props.onClick();
  assert.equal(selected[1], venue);
});

for (const slug of ['highland-event', null]) {
  test(`published success restores view, shared SocialShare and legacy promotion destination (${slug || 'ID fallback'})`, () => {
    const event = { id: 'created-id', slug, title: 'New event', status: 'published' };
    const eventPath = `/events/${slug || event.id}`;
    const harness = loadComponent('components/events/guided/GuidedCreationSuccess.tsx', {
      'next/link': 'link', 'lucide-react': icons, '@/components/common/SocialShare': 'social-share',
    }, [], { window: { location: { origin: 'https://heh.example' } } });
    harness.render(harness.exports.GuidedCreationSuccess, { event });
    harness.runEffects();
    const tree = nodes(harness.render(harness.exports.GuidedCreationSuccess, { event }));
    assert.ok(tree.find(node => node.type === 'link' && node.props.href === eventPath));
    assert.ok(tree.find(node => node.type === 'link' && node.props.href === `/events/${event.id}/promote`));
    const share = tree.find(node => node.type === 'social-share');
    assert.equal(share.props.url, `https://heh.example${eventPath}`);
    assert.equal(share.props.title, event.title);
  });
}

test('pending success retains legacy moderation/dashboard behavior without advertising an unpublished event', () => {
  const harness = loadComponent('components/events/guided/GuidedCreationSuccess.tsx', {
    'next/link': 'link', 'lucide-react': icons, '@/components/common/SocialShare': 'social-share',
  });
  const tree = nodes(harness.render(harness.exports.GuidedCreationSuccess, { event: { id: 'pending-id', title: 'Pending', status: 'pending_review' } }));
  assert.ok(tree.find(node => node.type === 'link' && node.props.href === '/account'));
  assert.ok(!tree.find(node => node.type === 'social-share' || node.props.href?.endsWith('/promote')));
});
