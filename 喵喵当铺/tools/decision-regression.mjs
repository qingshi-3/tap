import assert from 'node:assert/strict';
import * as G from '../js/game.js';
import { makeScenario } from './decision-fixture.mjs';

let count = 0;
const test = (name, fn) => { try { fn(); count++; console.log(`PASS ${name}`); } catch (e) { console.error(`FAIL ${name}`); throw e; } };
const setup = () => { G.setState(makeScenario(G)); return G.S; };
const snap = () => JSON.stringify(G.S);
const unchangedFailure = fn => { const before = snap(); fn(); assert.equal(snap(), before); };
const water = (s, g) => s.shelf.find(it => it.id === 'water' && it.g === g && it.gk);

test('explicit production selects one batch, consumes only chosen inputs', () => {
  const s = setup(), ids = s.shelf.filter(it => it.id === 'scrap' && !it.fake).slice(0, 3).map(it => it.uid);
  const p = G.productionPlan('furnace', { uids: ids });
  assert.equal(p.ok, true); assert.equal(p.batches, 1); assert.equal(p.outputCount, 1); assert.deepEqual([...p.inputUids].sort(), [...ids].sort());
  const kept = s.shelf.filter(it => !ids.includes(it.uid)).map(it => it.uid);
  assert.equal(G.runMachine('furnace', { uids: ids }), 1);
  assert.deepEqual(s.shelf.map(it => it.uid), kept); assert.equal(s.machines.furnace.n, 1);
});
test('production rejects duplicate, stale and fake inputs atomically', () => {
  const s = setup(), scrap = s.shelf.filter(it => it.id === 'scrap');
  for (const uids of [[scrap[0].uid, scrap[0].uid, scrap[1].uid], [scrap[0].uid, scrap[1].uid, 999999], [scrap[0].uid, scrap[1].uid, scrap.at(-1).uid]]) {
    unchangedFailure(() => { assert.equal(G.productionPlan('furnace', { uids }).ok, false); assert.equal(G.runMachine('furnace', { uids }), 0); });
  }
});
test('purifier previews filter and respects UV cap', () => {
  const s = setup(), it = water(s, 3), opt = { uids: [it.uid] };
  let p = G.productionPlan('purifier', opt); assert.equal(p.ok, true); assert.equal(p.filterCost, 1); assert.equal(p.filterAfter, 9);
  const before = JSON.stringify(p.outputs); s.up.uv = true; p = G.productionPlan('purifier', opt);
  assert.notEqual(JSON.stringify(p.outputs), before);
  assert.equal(G.runMachine('purifier', opt), 1); assert.equal(s.filter, 9); G.sleep();
  assert(s.shelf.some(x => x.id === 'water' && x.g === 5 && ![it.uid].includes(x.uid)));
});
test('unknown water preview does not reveal hidden grade', () => {
  const s = setup(), it = s.shelf.find(x => x.id === 'water' && !x.gk), opt = { uids: [it.uid] };
  it.g = 2; const low = G.productionPlan('purifier', opt);
  it.g = 3; const high = G.productionPlan('purifier', opt);
  assert.deepEqual(high.outputs, low.outputs); assert.deepEqual(high.inputs, low.inputs);
});
test('empty filter fails without consuming water', () => {
  const s = setup(); s.filter = 0; const uids = [water(s, 0).uid];
  unchangedFailure(() => { assert.equal(G.productionPlan('purifier', { uids }).ok, false); assert.equal(G.runMachine('purifier', { uids }), 0); });
});
test('brewery uses explicitly selected herbs and water for one batch', () => {
  const s = setup(), herbs = s.shelf.filter(it => it.id === 'catnip').slice(0, 2), chosen = water(s, 3);
  const uids = [...herbs.map(it => it.uid), chosen.uid], high = water(s, 4).uid;
  const p = G.productionPlan('brewery', { uids });
  assert.equal(p.ok, true); assert.equal(p.batches, 1); assert.equal(p.days, 2); assert.equal(p.outputCount, 1);
  assert.equal(G.runMachine('brewery', { uids }), 1); assert(s.shelf.some(it => it.uid === high));
  assert(!s.shelf.some(it => uids.includes(it.uid))); G.sleep(); assert(s.machines.brewery); G.sleep();
  assert.equal(s.machines.brewery, null); assert(s.shelf.some(it => it.id === 'nipwine'));
});
test('ready goods remain in full machine and collect on next sleep', () => {
  const s = setup(); s.shelfCap = s.shelf.length; s.machines.furnace = { left: 1, n: 1 };
  G.sleep(); assert.equal(s.machines.furnace.n, 1); assert.equal(s.machines.furnace.ready, true);
  const removed = s.shelf[0]; G.removeItem(removed); const out = G.sleep();
  assert.equal(s.machines.furnace, null); assert(out.some(it => it.id === 'ingot'));
});
test('orders default to lower usable water and support explicit high water', () => {
  let s = setup(), o = { id: 'water', qty: 1, due: 8, reward: 120 }; s.orders = [o];
  let p = G.orderPlan(o); assert.equal(p.ok, true); assert.equal(p.have, 3); assert.deepEqual(p.inputUids, [water(s, 3).uid]);
  const high = water(s, 5).uid; p = G.orderPlan(o, [high]); assert.equal(p.ok, true); assert.deepEqual(p.inputUids, [high]);
  const before = s.money; G.deliver(o, [high]); assert.equal(s.money, before + 120); assert(!s.shelf.some(it => it.uid === high));
  unchangedFailure(() => G.deliver(o, [water(s, 3).uid])); assert.equal(s.st.orders, 1);
});
test('invalid, insufficient and expired orders never consume or reward', () => {
  const s = setup(), o = { id: 'water', qty: 2, due: 8, reward: 120 }; s.orders = [o];
  const low = water(s, 0).uid, high = water(s, 5).uid;
  for (const ids of [[high], [high, high], [high, 999999], [low, high]]) unchangedFailure(() => { assert.equal(G.orderPlan(o, ids).ok, false); G.deliver(o, ids); });
  s.day = 9; unchangedFailure(() => { assert.equal(G.orderPlan(o).ok, false); G.deliver(o); });
  s.day = 5; s.shelf = s.shelf.filter(it => it.id !== 'water' || it.g < 3);
  unchangedFailure(() => { assert.equal(G.orderPlan(o).ok, false); assert.equal(G.canDeliver(o), false); G.deliver(o); });
});
test('paid and waived rent show next regular cycle', () => {
  let s = setup(); s.day = 15; s.phase = 'day'; s.rentDone = false; s.money = 1000; assert.equal(G.payRent(), true); s.rentDone = true;
  // Online 328700 contract: week 4 rent is 330; v1.2+ used a different rent table.
  let p = G.rentInfo(); assert.equal(p.paid, true); assert.equal(p.amount, 330); assert.equal(p.days, 5);
  s = setup(); s.phase = 'day'; s.rentDone = false; G.waiveRent(); s.rentDone = true; p = G.rentInfo();
  assert.equal(s.rentDue, 0); assert.equal(p.amount, 160); assert.equal(p.days, 5);
});
test('unidentified fake inputs do not leak through plans but fail execution atomically', () => {
  let s = setup(), scrap = s.shelf.filter(it => it.id === 'scrap');
  scrap.at(-1).known = false;
  const uids = [scrap[0].uid, scrap[1].uid, scrap.at(-1).uid];
  assert.equal(G.productionPlan('furnace', { uids }).ok, true);
  unchangedFailure(() => assert.equal(G.runMachine('furnace', { uids }), 0));
  s = setup(); const it = G.mkItem('can', { fake: true, known: false }); s.shelf.push(it);
  const o = { id: 'can', qty: 1, due: 8, reward: 90 }; s.orders = [o];
  assert.equal(G.orderPlan(o, [it.uid]).ok, true);
  unchangedFailure(() => assert.equal(G.deliver(o, [it.uid]), false));
});
test('near negotiation feedback does not disclose hidden limit', () => {
  setup(); const c = { kind: 'sell', who: 'trader', ask: 160, ask0: 160, res: 100, pat: 5 };
  const r = G.offerToSeller(c, 90); assert.notEqual(r.r, 'deal'); assert.equal(typeof r.near, 'boolean');
  assert(c.negotiation); assert(!Object.values(c.negotiation).includes(100));
});
test('public item and cat clues can occur for real and false visitors', () => {
  setup(); let realItem = 0, fakeItem = 0, realCat = 0, fakeCat = 0;
  for (let i = 0; i < 100; i++) {
    const c = { kind: 'sell', who: 'trader', item: G.mkItem('watch', { fake: !!(i % 2) }), bad: i % 2 ? i % 3 : -1, checks: [null, null, null], pat: 6, robo: !!(i % 2), roboBad: i % 3, obs: [null, null, null] };
    const a = G.itemClue(c), b = G.observationClue(c);
    if (a) { assert(a.index >= 0 && a.index < 3); const r = G.checkSpot(c, a.index); if (c.item.fake) { fakeItem++; assert.equal(r.res, 'fake'); } else { realItem++; assert.equal(r.res, 'ok'); } }
    if (b) { assert(b.index >= 0 && b.index < 3); const r = G.observe(c, b.index); if (c.robo) { fakeCat++; assert.equal(r.bad, true); } else { realCat++; assert.equal(r.bad, false); } }
  }
  assert(realItem && fakeItem && realCat && fakeCat);
});
test('legacy v2 queue and machine load, play, save and reload continue', () => {
  const old = makeScenario(G, 'legacycontinue'); delete old.queue[0].negotiation;
  G.setState(JSON.parse(JSON.stringify(old))); const c = G.current(); assert.equal(G.offerToSeller(c, c.ask).r, 'deal'); assert.equal(G.buyItem(c, c.ask), true);
  G.S.qi++; G.startNight(); G.sleep();
  const save = JSON.stringify(G.S); G.setState(JSON.parse(save)); assert.equal(G.S.v, 2); assert(G.S.shelf.some(it => it.id === 'ingot'));
  G.startDay(); G.startNight(); G.sleep(); const again = JSON.parse(JSON.stringify(G.S)); assert.equal(again.day, old.day + 2); assert.equal(again.v, 2);
});
console.log(`${count} decision regression checks passed`);


