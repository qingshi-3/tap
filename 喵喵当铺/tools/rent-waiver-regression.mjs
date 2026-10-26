import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as G from '../js/game.js';
import { rentOf } from '../js/data.js';
const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const rentScene = source.slice(source.indexOf('function rentScene() {'), source.indexOf('\nasync function playAd()'));
const setup = (overrides = {}) => Object.assign(G.newRun(), { day: 5, phase: 'day', money: 800, rentDone: false }, overrides);
let count = 0;
async function test(name, fn) { await fn(); console.log('PASS', name); count++; }
function ui() {
  let resolveAd, saved, closed = 0, adCalls = 0;
  const timers = [], messages = [];
  const nodes = node => [node, ...(node.children || []).flatMap(nodes)];
  const panel = { children: [], querySelectorAll: () => panel.children.flatMap(nodes).filter(x => x.tag?.startsWith('button')) };
  const context = { G, rentOf, busy: true, D: { panel, cust: { classList: { add() {} } } }, ads: { available: true },
    h(tag, ...children) { const props = children[0] && typeof children[0] === 'object' && !children[0].tag ? children.shift() : {}; return { tag, ...props, children: children.flat().filter(Boolean) }; },
    fill(target, ...children) { target.children = children.filter(Boolean); },
    setScene() {}, say(_who, text) { messages.push(text); }, sfx() {}, refreshHud() {}, saveRun() { saved = JSON.stringify(G.S); },
    setTimeout(fn) { timers.push(fn); }, closeShop() { closed++; }, toast() {}, floatMoney() {}, unlock() {}, modal() {}, gameOver() {},
    playAd() { adCalls++; return new Promise(resolve => { resolveAd = resolve; }); },
  };
  vm.runInNewContext(rentScene + '\nrentScene();', context);
  const button = text => panel.children.find(x => x.children?.some(c => typeof c === 'string' && c.startsWith(text)));
  const click = b => b.onclick({ currentTarget: b });
  return { context, button, click, complete(ok) { resolveAd(ok); }, timers, messages, get saved() { return saved; }, get closed() { return closed; }, get adCalls() { return adCalls; } };
}
await test('waiver clears current rent and legacy debt without spending or cash achievements', () => {
  const s = setup({ rentDue: 100, rentPaid: 2 });
  assert(G.waiveRent()); assert.equal(s.money, 800); assert.equal(s.rentDue, 0); assert.equal(s.rentPaid, 2); assert(s.rentDone && s.graceUsed);
  assert.equal(G.rentInfo().amount, rentOf(2)); assert.equal(G.rentInfo().days, 5);
  const settled = JSON.stringify(s); assert.equal(G.waiveRent(), false); assert.equal(JSON.stringify(s), settled);
  G.setState(JSON.parse(settled)); assert.equal(G.waiveRent(), false); G.S.day = 10; G.S.rentDone = false; assert.equal(G.waiveRent(), false);
});
await test('ordinary cash payment and legacy used flag remain intact', () => {
  setup({ rentDue: 100, graceUsed: true });
  G.setState(JSON.parse(JSON.stringify(G.S)));
  const s = G.S, bill = G.rentAmount();
  const before = JSON.stringify(s); assert.equal(G.waiveRent(), false); assert.equal(JSON.stringify(s), before);
  assert(G.payRent()); assert.equal(s.money, 800 - bill); assert.equal(s.rentPaid, 1); assert.equal(s.rentDue, 0);
});
await test('non-rent day, settled bill and night reject waiver without mutations', () => {
  for (const patch of [{ day: 4 }, { rentDone: true }, { phase: 'night' }]) { const s = setup(patch), before = JSON.stringify(s); assert.equal(G.waiveRent(), false); assert.equal(JSON.stringify(s), before); }
});
await test('real rentScene completion saves waiver once and shows regular next bill', async () => {
  const s = setup({ rentDue: 100 }), u = ui(), b = u.button('免交本次房租');
  const pending = u.click(b); assert(b.disabled); await u.click(b); assert.equal(u.adCalls, 1);
  u.complete(true); await pending; assert.equal(s.rentDue, 0); assert.equal(s.money, 800); assert.equal(s.rentPaid, 0);
  assert.match(u.messages.at(-1), /本次房租已免交/); assert.match(u.messages.at(-1), new RegExp(`下次${rentOf(2)}鱼币，5天后交`));
  G.setState(JSON.parse(u.saved)); assert(G.S.rentDone && G.S.graceUsed); assert.equal(G.S.rentDue, 0);
});
await test('cancelled or failed video leaves bill unchanged and allows retry', async () => {
  setup(); const before = JSON.stringify(G.S), u = ui(), b = u.button('免交本次房租');
  const pending = u.click(b); u.complete(false); await pending;
  assert.equal(JSON.stringify(G.S), before); assert.equal(b.disabled, false); assert.equal(u.saved, undefined);
});
await test('stale run, day, panel or already-paid callback cannot award or save', async () => {
  for (const change of [() => setup(), () => G.S.day++, u => { u.context.D.panel = {}; }, () => G.payRent()]) {
    setup(); const u = ui(), pending = u.click(u.button('免交本次房租')); change(u);
    const before = JSON.stringify(G.S); u.complete(true); await pending; assert.equal(JSON.stringify(G.S), before); assert.equal(u.saved, undefined);
  }
});
await test('settled live rent scene completes the ordinary night transition', async () => {
  setup(); const u = ui(), pending = u.click(u.button('免交本次房租')); u.complete(true); await pending;
  while (u.timers.length) u.timers.shift()(); assert.equal(u.closed, 1);
});
await test('both delayed scene transitions reject stale runs and days', async () => {
  for (const stage of [0, 1]) { setup(); const u = ui(), pending = u.click(u.button('免交本次房租')); u.complete(true); await pending;
    if (stage) u.timers.shift()(); G.S.day++; while (u.timers.length) u.timers.shift()(); assert.equal(u.closed, 0); }
});
await test('used benefit hides ad action and normal pay callback stays cash payment', () => {
  const s = setup({ graceUsed: true }), u = ui(); assert.equal(u.button('免交本次房租'), undefined);
  u.click(u.button('付房租')); assert.equal(s.rentPaid, 1); assert.equal(s.money, 700); assert.equal(s.rentDue, 0);
});
console.log(`${count} rent-waiver behavior checks passed`);
