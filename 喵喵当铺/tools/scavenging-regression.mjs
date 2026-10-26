import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as G from '../js/game.js';
import { MACHINE_MODS } from '../js/data.js';

const clone = x => JSON.parse(JSON.stringify(x));
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
function fixed(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = original; }
}
function setup(ids = ['can', 'dryfish', 'battery'], cap = ids.length) {
  const s = G.newRun();
  s.day = 8; s.st.buy = 12; s.money = 10000;
  s.shelf = ids.map(id => G.mkItem(id)); s.shelfCap = cap;
  G.startNight(); s.night.crates = ['heavy', 'wet', 'smell'];
  return s;
}
const open = idx => fixed(0, () => G.openCrate(idx));
function reload() {
  const saved = clone(G.S); assert(G.validateNightGround(saved)); G.setState(saved); return saved;
}
function unchanged(fn) { const before = JSON.stringify(G.S); fn(); assert.equal(JSON.stringify(G.S), before); }
function unique() {
  const items = [...G.allItems(), ...G.nightGround()];
  assert.equal(new Set(items.map(it => it.uid)).size, items.length);
}

test('a partially full shelf keeps every generated overflow instance and core result', () => {
  const s = setup(['can', 'dryfish'], 3), uid = s.uid, r = open(0);
  assert.equal(r.id, 'scrap'); assert.equal(r.got.length, 1); assert.equal(r.lost.length, 2);
  assert.equal(s.uid, uid + 3); assert.deepEqual(G.nightGround(), r.lost);
  assert.deepEqual(s.night.results[0], { id: 'scrap', n: 3, lost: 2 });
  assert.equal(s.shelf.length, 3); assert(G.validateNightGround(s)); unique();
});

test('full shelf can exchange several ground items and retains every displaced object', () => {
  const s = setup(), original = [...s.shelf], r = open(0), ids = r.lost.map(it => it.uid);
  s.win = original.map(it => it.uid);
  for (let i = 0; i < 3; i++) {
    const result = G.swapNightGround(ids[i], original[i].uid);
    assert(result.ok); assert.equal(result.taken.uid, ids[i]); assert.equal(result.left, original[i]);
    assert.equal(s.shelf.length, 3); assert(!s.win.includes(original[i].uid)); unique();
  }
  assert.deepEqual(G.nightGround().map(it => it.uid), original.map(it => it.uid));
  assert.deepEqual(s.shelf.map(it => it.uid), ids); assert.equal(s.win.length, 0);
});

test('temporary leave survives reload and production refills only after complete consumption', () => {
  let s = setup(['scrap', 'scrap', 'scrap']), r = open(1), pending = clone(r.lost);
  s = reload(); assert.deepEqual(G.nightGround(), pending);
  const materials = s.shelf.map(it => it.uid), uid = s.uid;
  assert.equal(G.runMachine('furnace', { uids: materials }), 1);
  assert.equal(s.shelf.length, 0, 'removeItem must not refill halfway through a transaction');
  assert.deepEqual(G.collectNightGround(), pending); assert.equal(s.shelf.length, 3);
  assert.equal(s.machines.furnace.n, 1); assert.equal(s.uid, uid);
  assert.deepEqual(G.collectNightGround(), []); unique();
});

test('a displaced inventory item can be reclaimed after another item is discarded', () => {
  const s = setup(), original = s.shelf[0], r = open(0);
  assert(G.swapNightGround(r.lost[0].uid, original.uid).ok);
  const collected = [];
  for (let i = 0; i < 3; i++) {
    G.removeItem(s.shelf[0]); collected.push(...G.collectNightGround());
  }
  assert(collected.some(it => it === original)); assert.equal(G.nightGround().length, 0);
  G.removeItem(s.shelf.find(it => it.uid !== original.uid));
  assert.deepEqual(G.collectNightGround(), []); assert.equal(s.shelf.filter(it => it.uid === original.uid).length, 1);
});

test('progress guide uses shared thresholds, requires day plus trades and retains unlocks', () => {
  let s = G.newRun();
  const expected = [
    ['phone', 2, 4], ['appraisal', 3, 6], ['content2', 3, 6], ['workshop', 4, 8],
    ['premium', 6, 12], ['content3', 6, 12], ['content4', 10, 20],
  ];
  assert.deepEqual(G.progressGuide().map(({ id, day, trades }) => [id, day, trades]), expected);
  for (const [id, day, trades] of expected) {
    s = G.newRun(); s.day = day - 1; s.st.buy = trades;
    assert(!G.progressGuide().find(x => x.id === id).unlocked);
    s.day = day; s.st.buy = trades - 1;
    assert(!G.progressGuide().find(x => x.id === id).unlocked);
    s.st.sell = 1; assert(G.progressGuide().find(x => x.id === id).unlocked);
    s = reload(); s.day = 1; s.st.buy = s.st.sell = 0;
    assert(G.progressGuide().find(x => x.id === id).unlocked);
  }
});

test('moving stock to hidden storage frees a slot but hidden stock cannot be exchanged', () => {
  const s = setup(), r = open(0), stored = s.shelf[0]; s.hiddenCap = 2;
  assert(G.moveItem(stored)); assert.equal(s.shelf.length, 2);
  unchanged(() => assert(!G.swapNightGround(r.lost[0].uid, stored.uid).ok));
  const collected = G.collectNightGround(); assert.deepEqual(collected, [r.lost[0]]);
  assert.equal(s.hidden[0], stored); assert.equal(s.shelf.length, 3); unique();
});

test('shelf upgrade makes all pending scavenged goods collectible with no reroll', () => {
  const s = setup(), r = open(1), pending = clone(r.lost), uid = s.uid;
  assert(G.buyUpgrade('shelf1')); assert.equal(s.shelfCap, 6);
  assert.deepEqual(G.collectNightGround(), pending); assert.equal(s.shelf.length, 6);
  assert.equal(s.uid, uid); assert.deepEqual(G.collectNightGround(), []); unique();
});

test('machine modification consumes exact materials before pending stock refills', () => {
  const ids = MACHINE_MODS.furnace.inputs.flatMap(x => Array(x.qty).fill(x.id));
  const s = setup(ids), r = open(1), materialUids = s.shelf.map(it => it.uid);
  assert(G.modifyMachine('furnace').ok); assert.equal(s.shelf.length, 0);
  assert(s.growth.mods.furnace); assert.deepEqual(G.collectNightGround(), r.lost);
  assert(!s.shelf.some(it => materialUids.includes(it.uid))); assert.equal(s.shelf.length, 3);
  const before = JSON.stringify(s); assert(!G.modifyMachine('furnace').ok); assert.equal(JSON.stringify(s), before);
});

test('invalid or stale exchanges refuse atomically and never create inventory space', () => {
  const s = setup(), r = open(0), ground = r.lost[0], shelf = s.shelf[0];
  for (const [g, u] of [[-1, shelf.uid], [ground.uid, -1], [shelf.uid, ground.uid], [ground.uid, ground.uid]]) {
    unchanged(() => assert(!G.swapNightGround(g, u).ok));
  }
  assert(G.swapNightGround(ground.uid, shelf.uid).ok);
  unchanged(() => assert(!G.swapNightGround(ground.uid, shelf.uid).ok)); unique();
});

test('reload and repeated refill cannot duplicate goods or open an already resolved box', () => {
  let s = setup(), r = open(0), original = clone(r.lost), uid = s.uid;
  s = reload(); unchanged(() => assert.equal(open(0).id, null));
  G.removeItem(s.shelf[0]); assert.deepEqual(G.collectNightGround(), original.slice(0, 1));
  s = reload(); assert.deepEqual(G.collectNightGround(), []);
  G.removeItem(s.shelf[0]); assert.deepEqual(G.collectNightGround(), original.slice(1, 2));
  s = reload(); G.removeItem(s.shelf[0]); assert.deepEqual(G.collectNightGround(), original.slice(2));
  assert.equal(s.uid, uid); unchanged(() => assert.equal(open(0).id, null)); unique();
});

test('opening requires night, a valid unopened box and remaining granted attempts', () => {
  const s = setup();
  for (const idx of [-1, 3, 0.5, '0']) unchanged(() => assert.equal(G.openCrate(idx).id, null));
  s.phase = 'day'; unchanged(() => assert.equal(open(0).id, null)); s.phase = 'night';
  open(0); unchanged(() => assert.equal(open(1).id, null));
  s.night.extra = true; s.night.free++;
  assert.equal(open(1).id, 'water'); assert.equal(s.night.opened.length, 2);
  unchanged(() => assert.equal(open(2).id, null)); unique();
});

test('result record prevents a box reroll even if its opened marker is missing', () => {
  const s = setup(); open(0); s.night.opened = [];
  unchanged(() => assert.equal(open(0).id, null));
});

test('quality, fake, stolen, water label and grade survive exchange and two reloads', () => {
  let s = setup();
  s.shelf[0] = G.mkItem('water', { g: 1, lab: 5, gk: false, fake: true, known: false, q: 1.03125, stolen: true, heat: 2, cost: 7 });
  const original = clone(s.shelf[0]), r = open(0);
  assert(G.swapNightGround(r.lost[0].uid, original.uid).ok);
  s = reload(); assert.deepEqual(G.nightGround().find(it => it.uid === original.uid), original);
  assert(G.swapNightGround(original.uid, s.shelf[1].uid).ok);
  s = reload(); assert.deepEqual(s.shelf.find(it => it.uid === original.uid), original); unique();
});

test('future, stale, malformed and UID-colliding ground records reject without overwriting', () => {
  const s = setup(); open(0);
  const mutations = [
    x => x.night.ground.v = 2, x => x.night.ground.future = true, x => x.night.ground.day++,
    x => x.night.ground = null, x => x.night.ground.items = {}, x => x.phase = 'day',
    x => x.night.ground.items.push(clone(x.night.ground.items[0])),
    x => x.night.ground.items[0].uid = x.shelf[0].uid,
    x => { x.hidden.push(x.shelf.pop()); x.night.ground.items[0].uid = x.hidden[0].uid; },
    x => x.night.ground.items[0].uid = x.uid, x => x.night.ground.items[0].id = 'missing',
    x => x.night.ground.items[0].fake = 'false', x => x.night.ground.items[0].q = 0,
    x => x.night.ground.items[0].g = 999,
  ];
  for (const mutate of mutations) {
    G.setState(clone(s)); const active = G.S;
    const bad = clone(s); mutate(bad); const original = JSON.stringify(bad);
    assert.throws(() => G.setState(bad)); assert.equal(G.S, active); assert.equal(JSON.stringify(bad), original);
    // In-memory corruption must also refuse any inventory mutation.
    mutate(G.S);
    unchanged(() => { assert.throws(() => G.validateNightGround(bad)); assert.throws(() => G.collectNightGround()); assert.throws(() => G.swapNightGround(1, 2)); });
  }
});

test('last collection follows existing morning machine and dew priority, then ground expires', () => {
  let s = setup(), r = open(0); s.shelfCap = 6;
  s.machines.furnace = { left: 1, n: 1 }; s.up.dew = true;
  const day = s.day, out = G.sleep();
  assert.deepEqual(out.map(it => it.id), ['ingot', 'water', 'scrap']);
  assert.equal(out[2].uid, r.lost[0].uid); assert.equal(s.shelf.length, 6);
  assert(!Object.hasOwn(s.night, 'ground')); assert.equal(s.day, day + 1);
  s = reload(); s.phase = 'day'; G.removeItem(s.shelf[0]);
  assert.deepEqual(G.collectNightGround(), []); G.startNight(); assert.deepEqual(G.nightGround(), []);
});

for (const name of ['legacycontinue', 'patience-buyer', 'night-production-mixed-waters', 'order-selected-buyer']) {
  test(`frozen old v2 ${name} continues, saves and reenters without a ground extension`, () => {
    const original = JSON.parse(readFileSync(new URL(`./fixtures/growth-v2/${name}.json`, import.meta.url), 'utf8'));
    let s = clone(original); G.setState(s); assert(G.validateNightGround(s));
    if (s.phase !== 'night') G.startNight(); G.sleep();
    s = reload(); G.startDay(); G.startNight();
    const result = open(s.night.crates.indexOf('heavy') >= 0 ? s.night.crates.indexOf('heavy') : 0);
    assert(result.id); assert(G.validateNightGround(s)); G.sleep();
    s = reload(); assert.equal(s.v, 2); assert.equal(s.day, original.day + 2);
  });
}

console.log(`${checks} scavenging behavior groups passed`);
