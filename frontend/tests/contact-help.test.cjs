const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Focused JSX and disclosure-handler checks; no browser, server or network.
let nextId = 0;
function load(file, imports = {}) {
  const state = [];
  let cursor = 0;
  const id = `contact-test-${++nextId}`;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useId: () => id,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
  };
  const module = { exports: {} };
  const filename = path.join(__dirname, '../src', file);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, React: react, encodeURIComponent, require(name) {
    if (name === 'react') return react;
    if (name === 'next/link') return 'link';
    if (name === 'next/head') return 'head';
    if (name === 'lucide-react') return { ChevronDown: 'chevron' };
    if (name in imports) return imports[name];
    throw new Error(`Unexpected contact-page dependency: ${name}`);
  } });
  return { exports: module.exports, render(component, props) { cursor = 0; return component(props); } };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props));
  return [tree, ...nodes(tree.props.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  if (tree && typeof tree === 'object') return text(tree.props.children);
  return tree == null || tree === false ? '' : String(tree);
}
const content = load('components/help/contactHelpContent.ts').exports;
function page() {
  const card = load('components/common/Card.tsx').exports;
  const harness = load('pages/contact.tsx', {
    '@/components/common/Card': card,
    '@/components/common/Disclosure': { Disclosure: 'disclosure' },
    '@/components/help/contactHelpContent': content,
  });
  return nodes(harness.render(harness.exports.default));
}

test('Contact & Help has metadata, responsive contact/quick-help cards and a visible organiser notice', () => {
  const tree = page();
  assert.equal(text(tree.find(node => node.type === 'h1')), 'Contact & Help');
  assert.equal(text(tree.find(node => node.type === 'title')), 'Contact & Help | Highland Events Hub');
  assert.ok(tree.some(node => node.type === 'meta' && node.props.name === 'description' && node.props.content.includes('event listings')));
  assert.ok(tree.some(node => node.props.className === 'grid items-start gap-6 lg:grid-cols-2'));
  const notice = tree.find(node => node.type === 'aside');
  assert.match(text(notice), /does not organise the events/);
  assert.match(text(notice), /contact the event organiser or venue directly/);
  assert.match(text(notice), /refunds, accessibility, paying on the door/);
  assert.equal(notice.props.role, undefined);
  assert.equal(notice.props.hidden, undefined);
  assert.ok(tree.some(node => node.type === 'p' && text(node).includes('Please allow a few days for a response.')));
  const emailButtons = tree.filter(node => node.type === 'a' && node.props.href === content.contactMailto && /bg-highland-green/.test(node.props.className));
  assert.equal(emailButtons.length, 2);
  for (const email of emailButtons) {
    assert.match(email.props.className, /max-w-full/);
    assert.match(email.props.className, /break-all/);
    assert.equal(text(email), content.contactEmail);
  }
});

test('quick actions reuse existing routes and done-for-you enquiry is optional mailto, not payment', () => {
  const tree = page();
  const quickHelp = tree.find(node => node.type === 'nav' && node.props['aria-label'] === 'Quick help');
  assert.deepEqual(nodes(quickHelp).filter(node => node.type === 'link').map(node => node.props.href), ['/create-event', '/groups', '/venues']);
  const enquiry = tree.find(node => node.type === 'a' && node.props.href === content.listingMailto);
  assert.equal(text(enquiry), 'Ask about a done-for-you listing');
  assert.equal(new URL(enquiry.props.href).searchParams.get('subject'), 'Done-for-you event listing');
  assert.match(text(tree.find(node => node.type === 'div' && text(node).startsWith('Need me to add your event?'))), /Adding your own event is free/);
  assert.ok(tree.some(node => node.type === 'p' && text(node).includes('£10 per event')));
  assert.ok(!tree.some(node => node.type === 'form' || node.type === 'input'));
  for (const route of ['/create-event', '/groups', '/venues', '/login', '/register', '/sell-tickets']) {
    const base = path.join(__dirname, '../src/pages', route);
    assert.ok(fs.existsSync(`${base}.tsx`) || fs.existsSync(path.join(base, 'index.tsx')), route);
  }
});

test('all 35 requested FAQs render in six full-width groups with supported capability wording', () => {
  const tree = page();
  const groups = content.contactHelpGroups;
  assert.deepEqual(Array.from(groups, group => group.questions.length), [7, 8, 7, 4, 4, 5]);
  assert.equal(tree.filter(node => node.type === 'disclosure').length, 35);
  for (const group of groups) assert.ok(tree.some(node => node.type === 'h3' && text(node) === group.title));
  const questions = groups.flatMap(group => group.questions);
  assert.equal(new Set(questions.map(question => question.question)).size, 35);
  const answer = question => questions.find(item => item.question === question).paragraphs.join(' ');
  assert.match(answer('Do free tickets require Stripe?'), /No\. Stripe is not required/);
  assert.match(answer('Does Highland Events Hub offer ticketing?'), /one-off events lasting up to 36 hours/);
  assert.match(answer('Can I add recurring or regular events?'), /Native HEH ticketing is currently limited to one-off/);
  assert.match(answer('My organisation or venue is already listed. Can I manage it?'), /Claim Venue/);
  assert.match(answer('My organisation or venue is already listed. Can I manage it?'), /contact me/);
  assert.ok(!/\d+%/.test(answer('Is Highland Events Hub ticketing cheaper than Eventbrite?')));
  assert.match(answer('I am having trouble with my account. What should I do?'), /Do not send passwords/);
  assert.ok(tree.some(node => node.type === 'h2' && text(node) === 'Still need help?'));
});

test('disclosure uses a native keyboard-operable button with stable associations and toggles hidden answer', () => {
  const harness = load('components/common/Disclosure.tsx');
  const props = { title: 'A wrapped question?', children: 'An answer' };
  const render = () => nodes(harness.render(harness.exports.Disclosure, props));
  let tree = render();
  let button = tree.find(node => node.type === 'button');
  const questionId = button.props.id;
  const panelId = button.props['aria-controls'];
  assert.equal(button.props.type, 'button');
  assert.equal(button.props['aria-expanded'], false);
  assert.match(button.props.className, /focus-visible:ring-2/);
  assert.match(button.props.className, /min-h-12/);
  assert.equal(tree.find(node => node.props.id === panelId).props.hidden, true);
  assert.equal(tree.find(node => node.props.id === panelId).props['aria-labelledby'], questionId);
  button.props.onClick();
  tree = render(); button = tree.find(node => node.type === 'button');
  assert.equal(button.props.id, questionId);
  assert.equal(button.props['aria-expanded'], true);
  assert.equal(tree.find(node => node.props.id === panelId).props.hidden, false);
  assert.match(tree.find(node => node.type === 'chevron').props.className, /rotate-180/);
  button.props.onClick();
  assert.equal(render().find(node => node.props.id === panelId).props.hidden, true);
});

test('separate disclosures have unique IDs and can remain open together', () => {
  const first = load('components/common/Disclosure.tsx'), second = load('components/common/Disclosure.tsx');
  const render = harness => nodes(harness.render(harness.exports.Disclosure, { title: 'Question', children: 'Answer' }));
  for (const harness of [first, second]) render(harness).find(node => node.type === 'button').props.onClick();
  const buttons = [first, second].map(harness => render(harness).find(node => node.type === 'button'));
  assert.ok(buttons.every(button => button.props['aria-expanded'] === true));
  assert.notEqual(buttons[0].props.id, buttons[1].props.id);
  assert.notEqual(buttons[0].props['aria-controls'], buttons[1].props['aria-controls']);
});
