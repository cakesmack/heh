const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Same dependency-free component harness as the focused contact-help tests.
function harness(apiFetch, props) {
  const state = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useRef(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    },
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/components/ticketing/ResendTicketsButton.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, encodeURIComponent, require(name) {
    if (name === 'react') return react;
    if (name === '@/lib/api') return { apiFetch };
    throw new Error(`Unexpected resend dependency: ${name}`);
  } });
  return () => {
    cursor = 0;
    const tree = module.exports.default(props);
    return tree.props.children;
  };
}

for (const role of ['organizer', 'admin']) {
  test(`${role}: sends only an order action, prevents double submission, shows masked success`, async () => {
    const calls = [];
    let resolve;
    const pending = new Promise(done => { resolve = done; });
    const render = harness((...args) => { calls.push(args); return pending; }, { orderId: 'existing/order', role });
    const button = render()[0];
    assert.equal(button.props.disabled, false);
    const first = button.props.onClick();
    await button.props.onClick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], `${role === 'admin' ? '/api/admin/ticketing' : '/api/ticketing/organizer'}/orders/existing%2Forder/resend-tickets`);
    assert.equal(calls[0][1].method, 'POST');
    assert.equal(Object.keys(calls[0][1]).length, 1);
    assert.equal(render()[0].props.disabled, true);
    resolve({ message: 'Tickets resent to h***@example.com' });
    await first;
    const [finished, feedback] = render();
    assert.equal(finished.props.disabled, false);
    assert.equal(feedback.props.role, 'status');
    assert.equal(feedback.props.children[0], 'Tickets resent to h***@example.com');
  });
}

test('failure and throttling are visible and release the submission guard', async () => {
  let attempts = 0;
  const render = harness(async () => {
    attempts++;
    throw new Error('Please wait one minute before resending this order again.');
  }, { orderId: 'order' });
  await render()[0].props.onClick();
  let [button, feedback] = render();
  assert.equal(button.props.disabled, false);
  assert.equal(feedback.props.role, 'alert');
  assert.match(feedback.props.children[0], /wait one minute/);
  await button.props.onClick();
  assert.equal(attempts, 2);
});

test('existing organiser and admin order surfaces share the resend component', () => {
  for (const file of ['organizers/hub.tsx', 'organizers/invoices.tsx', 'admin/ticketing.tsx']) {
    const source = fs.readFileSync(path.join(__dirname, '../src/pages', file), 'utf8');
    assert.match(source, /import ResendTicketsButton from '@\/components\/ticketing\/ResendTicketsButton'/);
    assert.match(source, /<ResendTicketsButton[^>]+orderId=/);
    if (file.startsWith('admin/')) assert.match(source, /<ResendTicketsButton[^>]+role="admin"/);
  }
});
