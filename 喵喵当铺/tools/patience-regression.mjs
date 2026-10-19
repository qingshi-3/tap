// Behavior tests: real core functions plus actual main.js control flow in a small DOM adapter.
// SVG appearance/touch/layout are deliberately left to the real-browser checks.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as G from '../js/game.js';
import { SPOTS, ITEMS } from '../js/data.js';

const source = await readFile(new URL('../js/main.js', import.meta.url), 'utf8');
// These named declarations have a top-level closing brace. Extract and execute their
// unchanged bodies, rather than duplicating the production branch or asserting words.
function declaration(name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert(match, `UI function ${name} must exist`);
  const tail = source.slice(match.index), end = /\r?\n}\r?\n/.exec(tail);
  assert(end, `UI function ${name} must have a closing declaration`);
  return tail.slice(0, end.index + end[0].indexOf('}') + 1);
}

let count = 0;
async function test(name, fn) { await fn(); count++; console.log(`PASS ${name}`); }
function setup() { const s = G.newRun(); s.day = 4; s.phase = 'day'; s.up = {}; return s; }
function seller(extra = {}) { return { kind: 'sell', who: 'granny', item: G.mkItem('yarn', { q: 1 }), ask: 160, ask0: 160, res: 100,
  pat: 3, checks: [null, null, null], bad: -1, ...extra }; }
function buyer(extra = {}) { return { kind: 'buy', who: 'worker', max: 100, bid: 65, pat: 3, ...extra }; }
function ui({ actualShow = false, actualLeave = false } = {}) {
  const hearts = Array.from({ length: 2 }, () => ({ current: null, replaceWith(value) { this.current = value; } }));
  const feedback = [{ current: null, replaceWith(value) { this.current = value; } }];
  const controls = [{ disabled: false }, { disabled: false }], eye = { disabled: false };
  const calls = { drawn: [], left: [], saved: [], shown: [], ended: 0, waits: [] };
  const context = {
    G, SPOTS, ITEMS, busy: false, screenEpoch:0,
    ads: {captureGuard: state=>({runId:state.runId,day:state.day}),isCurrent:(guard,state)=>!!state&&guard.runId===state.runId&&guard.day===state.day},
    mutateRun: (_type,fn)=>{const result=fn(G.S);calls.saved.push(JSON.parse(JSON.stringify(G.S)));return result;},
    stage: { querySelectorAll: selector => selector === '.hearts' ? hearts : selector === '.trade-feedback' ? feedback : [] },
    D: { panel: { querySelectorAll: () => controls, classList: { remove() {} } },
      scene: { querySelectorAll: () => [eye], querySelector: () => eye }, cust: { classList: { add() {}, remove() {} } } },
    // A heart output exposes the semantic count; no fake renderer is used as visual evidence.
    heartsFor: c => ({ remaining: Math.max(0, c.pat), source: c }),
    negotiationHint: c => ({ remaining: Math.max(0, c.pat), exhausted: c.pat <= 0 }),
    refreshHud() {}, refreshBar() {}, say() {}, sfx() {}, checkAch() {}, nm: G.itemName,
    drawSell: c => calls.drawn.push(c.pat), drawBuyHaggle: c => calls.drawn.push(c.pat),
    doDeal: (c, price) => calls.drawn.push({ bought: price }), doSell: (c, price) => calls.drawn.push({ sold: price }),
    leave: (...args) => calls.left.push(args),
    showCustomer: () => calls.shown.push(G.current()),
    saveRun: () => calls.saved.push(JSON.parse(JSON.stringify(G.S))),
    setScene() {}, endOfDay: () => calls.ended++, eyeBtn: () => null,
    wait: milliseconds => new Promise(resolve => calls.waits.push({ milliseconds, resolve })),
  };
  for (const kind of ['Sell', 'Buy', 'Fence', 'Police', 'Order', 'Lady']) context[`panel${kind}`] = c => calls.shown.push(c);
  vm.createContext(context);
  for (const name of ['refreshPatience', 'doCheck', 'doOffer', 'doAsk', ...(actualShow ? ['showCustomer'] : []), ...(actualLeave ? ['leave'] : [])]) {
    vm.runInContext(declaration(name), context, { filename: `main.js:${name}` });
  }
  return { context, hearts, feedback, controls, eye, calls };
}

await test('plain check costs one; repeating a checked spot costs zero', () => {
  setup(); const c = seller(); assert.equal(G.checkSpot(c, 0).left, 2); assert.equal(c.pat, 2);
  assert.equal(G.checkSpot(c, 0).free, true); assert.equal(c.pat, 2);
});
await test('lens first new check is free, repeat is free, next new check costs one', () => {
  setup(); G.S.up.lens = true; const c = seller();
  assert.equal(G.checkSpot(c, 0).free, true); assert.equal(c.pat, 3); assert.equal(c.lensUsed, true);
  G.checkSpot(c, 0); assert.equal(c.pat, 3);
  assert.equal(G.checkSpot(c, 1).free, false); assert.equal(c.pat, 2);
});
await test('seller ordinary/angry boundary and successful price have exact patience costs', () => {
  setup(); let c = seller(); assert.equal(G.offerToSeller(c, 50).angry, false); assert.equal(c.pat, 2);
  c = seller(); assert.equal(G.offerToSeller(c, 49).angry, true); assert.equal(c.pat, 1);
  c = seller(); assert.equal(G.offerToSeller(c, 100).r, 'deal'); assert.equal(c.pat, 3);
});
await test('buyer ordinary/angry boundary and successful price have exact patience costs', () => {
  setup(); let c = buyer(); assert.equal(G.askBuyer(c, 160).angry, false); assert.equal(c.pat, 2);
  c = buyer(); assert.equal(G.askBuyer(c, 161).angry, true); assert.equal(c.pat, 1);
  c = buyer(); assert.equal(G.askBuyer(c, 100).r, 'deal'); assert.equal(c.pat, 3);
});
await test('checking, observing and failed bargaining share the same existing customer budget', () => {
  setup(); const c = seller({ obs: [null, null, null] });
  G.checkSpot(c, 0); assert.equal(c.pat, 2); G.observe(c, 0); assert.equal(c.pat, 1);
  assert.equal(G.offerToSeller(c, 90).r, 'leave'); assert.equal(c.pat, 0);
  assert.equal(G.observe(c, 0).free, true); assert.equal(c.pat, 0);
});
await test('JSON save/reload preserves current hearts, checked spots and used free check', () => {
  setup(); G.S.up.lens = true; const c = seller(); G.S.queue = [c]; G.S.qi = 0;
  G.checkSpot(c, 0); G.checkSpot(c, 1); G.offerToSeller(c, 90);
  G.setState(JSON.parse(JSON.stringify(G.S)));
  assert.equal(G.current().pat, 1); assert.equal(G.current().lensUsed, true);
  assert.deepEqual(G.current().checks, ['ok', 'ok', null]); G.checkSpot(G.current(), 0); assert.equal(G.current().pat, 1);
});
await test('actual UI check path refreshes both visible heart groups after paid and free checks', () => {
  setup(); const c = seller(), u = ui(); u.context.doCheck(c, 0);
  assert.equal(c.pat, 2); assert(u.hearts.every(h => h.current?.remaining === 2));
  u.context.doCheck(c, 0); assert(u.hearts.every(h => h.current?.remaining === 2));
  G.S.up.lens = true; const fresh = seller(); u.context.doCheck(fresh, 0); assert(u.hearts.every(h => h.current?.remaining === 3));
});
await test('actual UI seller failure refreshes zero hearts before leave, including angry exhaustion', () => {
  setup(); let c = seller({ pat: 1 }), u = ui(); u.context.doOffer(c, 90);
  assert.equal(c.pat, 0); assert.equal(u.calls.left.length, 1); assert(u.hearts.every(h => h.current?.remaining === 0));
  c = seller({ pat: 2 }); u = ui(); u.context.doOffer(c, 49);
  assert.equal(c.pat, 0); assert.equal(u.calls.left.length, 1); assert(u.hearts.every(h => h.current?.remaining === 0));
});
await test('actual UI buyer failure refreshes zero hearts before leave and clamps negative hearts', () => {
  setup(); let c = buyer({ pat: 1 }), u = ui(); u.context.doAsk(c, 110);
  assert.equal(c.pat, 0); assert.equal(u.calls.left.length, 1); assert(u.hearts.every(h => h.current?.remaining === 0));
  c = buyer({ pat: 1 }); u = ui(); u.context.doAsk(c, 161);
  assert.equal(c.pat, -1); assert(u.hearts.every(h => h.current?.remaining === 0));
});
await test('actual leave refreshes immediately, disables input and advances only after both waits', async () => {
  setup(); const exhausted = seller({ pat: 0 }), fresh = buyer(); G.S.queue = [exhausted, fresh]; G.S.qi = 0;
  const u = ui({ actualLeave: true }), pending = u.context.leave('leave', 'bad');
  assert(u.hearts.every(h => h.current?.remaining === 0)); assert(u.controls.every(c => c.disabled)); assert.equal(u.eye.disabled, true);
  assert(u.feedback.every(f => f.current?.exhausted === true));
  assert.equal(G.S.qi, 0); assert.equal(u.calls.waits[0].milliseconds, 1100);
  u.calls.waits.shift().resolve(); await new Promise(resolve => setImmediate(resolve)); assert.equal(G.S.qi, 0); assert.equal(u.calls.waits[0].milliseconds, 380);
  u.calls.waits.shift().resolve(); await pending;
  assert.equal(G.S.qi, 1); assert.equal(u.calls.shown[0], fresh); assert.equal(u.calls.saved[0].qi, 1); assert.equal(fresh.pat, 3);
});
await test('actual showCustomer skips exhausted v2 seller/tutorial/lady and buyer, without transactions', () => {
  setup(); G.S.story.lady = 1;
  const fresh = buyer(), dead = [seller({ pat: 0, tut: 'haggle' }), seller({ pat: -1, who: 'lady', story: 0 }), buyer({ pat: 0 })];
  G.S.queue = [...dead, fresh]; G.S.qi = 0; G.setState(JSON.parse(JSON.stringify(G.S)));
  const before = G.S.money, u = ui({ actualShow: true }); u.context.showCustomer();
  assert.equal(G.S.qi, 3); assert.equal(G.S.money, before); assert.equal(G.S.st.buy, 0); assert.equal(G.S.st.sell, 0);
  assert.equal(u.calls.shown.length, 1); assert.equal(u.calls.shown[0], G.current()); assert.equal(G.current().pat, 3);
  assert.equal(G.S.story.lady, 1); assert.equal(u.calls.saved.length, 1); assert.equal(u.calls.saved[0].qi, 3);
});
await test('actual showCustomer preserves live one-heart customers and cannot skip police', () => {
  setup(); const live = buyer({ pat: 1 }); G.S.queue = [live]; G.S.qi = 0;
  let u = ui({ actualShow: true }); u.context.showCustomer(); assert.equal(G.S.qi, 0); assert.equal(u.calls.shown[0], live);
  const police = { kind: 'police', who: 'police', pat: 0 }; G.S.queue = [seller({ pat: 0 }), police]; G.S.qi = 0;
  u = ui({ actualShow: true }); u.context.showCustomer(); assert.equal(G.S.qi, 1); assert.equal(u.calls.shown[0], police);
});
await test('actual showCustomer enters end-of-day if all restored visits were exhausted', () => {
  setup(); G.S.queue = [seller({ pat: 0 }), buyer({ pat: -1 })]; G.S.qi = 0;
  const u = ui({ actualShow: true }); u.context.showCustomer();
  assert.equal(G.S.qi, 2); assert.equal(u.calls.ended, 1); assert.equal(u.calls.shown.length, 0); assert.equal(u.calls.saved.length, 1);
});
console.log(`${count} patience behavior checks passed. SVG rendering and real input remain browser acceptance.`);
