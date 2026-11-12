// Integration regressions for preparation, acquisition and v4 save/restore.
import { card } from '../src/core/data';
import type { ArchetypeId } from '../src/core/archetypes';
import {
  activeCardPool, buy, buyGoods, canPayBlood, curNode, HAND_BASE, load, moveOwned,
  newRun, nodeOpts, ownedHp, payBlood, pickNode, reroll, resolveEvent, save, SAVE_KEY,
  sell, settleBattle, STAT_CAP, toggleLock, useFood, useHero, type Owned, type RunState,
} from '../src/core/run';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  },
});
function assert(ok: unknown, reason: string): asserts ok {
  if (!ok) throw new Error(reason);
}
let checks = 0;
function test(name: string, run: () => void) {
  store.clear();
  run();
  checks++;
  console.log('PASS ' + name);
}
function fixture(archetype: ArchetypeId): RunState {
  for (let seed = 0; seed < 100; seed++) {
    const r = newRun(seed);
    if (r.activeArchetypes.includes(archetype)) { r.gold = 100; return r; }
  }
  throw new Error('Fixture archetype missing: ' + archetype);
}
function unit(r: RunState, def: string): Owned {
  return { oid: r.nextId++, def, copies: 1, atkBonus: 0, hpBonus: 0 };
}
function retrieve(r: RunState): RunState {
  save(r);
  const restored = load();
  assert(restored, 'Current preparation state failed to reload');
  return restored;
}
function item(r: RunState, def: string, slot: number | null = null) {
  const sid = r.nextId++;
  r.shop.push({ sid, kind: 'food', def, locked: false, free: true });
  assert(useFood(r, sid, slot).ok, 'Could not use ' + def);
}
function acquire(r: RunState, def: string, slot: number, price = 3) {
  const sid = r.nextId++;
  r.shop.push({ sid, kind: 'unit', def, price, locked: false, free: price === 0 });
  assert(buy(r, sid, slot).ok, 'Could not acquire ' + def);
}
function advanceFixture(r: RunState) {
  if (!curNode(r)) assert(pickNode(r, nodeOpts(r)[0]), 'Fixture route unavailable');
  settleBattle(r, { result: 'win', perm: {} });
}

test('depleted copies merge to one health and can grow immediately', () => {
  const r = fixture('blood');
  r.queue[0] = unit(r, 'rw_blood_cutpurse');
  r.queue[1] = unit(r, 'rw_blood_cutpurse');
  for (let turn = 0; turn < 3; turn++) {
    assert(payBlood(r, 0).ok && payBlood(r, 1).ok, 'Both owners should pay once per turn');
    if (turn < 2) advanceFixture(r);
  }
  assert(moveOwned(r, 0, 1)?.merged, 'Depleted copies failed to merge');
  assert(ownedHp(r.queue[1]!) === 1, 'Merging two one-health copies produced invalid health');
  item(r, 'f_bread', 1);
  assert(ownedHp(retrieve(r).queue[1]!) === 2, 'First point of healing was absorbed by negative health');
});

test('morphing a depleted blood unit into a lower-health body remains playable', () => {
  let observed = 0;
  for (let seed = 0; seed < 30; seed++) {
    const r = newRun(seed);
    if (!r.activeArchetypes.includes('blood')) continue;
    const def = 'rw_blood_vow';
    r.queue[0] = unit(r, def);
    r.queue[0].hpBonus = 1 - card(def).hp;
    r.event = 'morph';
    assert(resolveEvent(r, 0, 0).ok, 'Blood unit had no morph choices');
    if (card(r.queue[0].def).hp >= card(def).hp) continue;
    observed++;
    assert(ownedHp(r.queue[0]) === 1, 'Morph reduced permanent health below one');
    item(r, 'f_bread', 0);
    assert(ownedHp(retrieve(r).queue[0]!) === 2, 'Morph retained hidden negative health');
  }
  assert(observed > 0, 'No lower-health morph was exercised');
});

test('omen provides a legal shelf card throughout the pre-terminal tavern tiers', () => {
  for (let seed = 1; seed <= 24; seed++) for (const tavern of [4, 5, 6]) {
    const r = newRun(seed);
    r.tavern = tavern;
    r.queue[0] = unit(r, 'rw_common_buckler');
    item(r, 'x_omen');
    advanceFixture(r);
    const legal = activeCardPool(r);
    const expectedTier = Math.max(...legal.filter(c => c.tier <= tavern + 1).map(c => c.tier));
    const shelf = r.shop.filter(s => s.kind === 'unit');
    assert(shelf.every(s => legal.some(c => c.id === s.def)), 'Omen offered a disabled unit');
    assert(shelf.some(s => tavern === 6 ? s.def === r.queue[0]?.def : card(s.def).tier === expectedTier), 'Missing omen card');
    retrieve(r);
  }
});

test('mercenary and seer use the highest eligible tier when six is gated', () => {
  const r = newRun(1, { hero: 'seer' });
  const max = Math.max(...activeCardPool(r).map(c => c.tier));
  assert(max < 6, 'Fixture must keep terminals gated');
  r.tavern = 5;
  r.event = 'merc';
  assert(resolveEvent(r, 0).ok, 'Mercenary event failed with an empty six-tier pool');
  const merc = r.queue.find(o => o?.merc);
  assert(merc && card(merc.def).tier === max, 'Mercenary fallback tier');
  r.tavern = 6; r.gold = 100;
  assert(useHero(r), 'Seer could not discover a unit');
  const options = r.discover?.[0]?.opts;
  assert(options?.length && options.every(id => card(id).tier === max), 'Seer charged without awarding legal choices');
  retrieve(r);
});

test('chant observes the actual second and fourth spells and closes its window', () => {
  for (const prior of [1, 4]) {
    const r = fixture('rune');
    r.queue[0] = unit(r, 'rw_common_buckler');
    for (let i = 0; i < prior; i++) item(r, 'x_coin');
    r.queue[1] = unit(r, 'rw_rune_cantor');
    let seal = 0;
    for (let count = prior + 1; count <= 8; count++) {
      item(r, 'x_coin');
      if (count === 2 || count === 4) seal++;
      assert((r.queue[0]?.seal ?? 0) === seal, 'Unexpected chant on spell ' + count);
    }
  }
});

test('trade ration fires on the second paid purchase while the observer is deployed', () => {
  for (const prior of [1, 2]) {
    const r = fixture('trade');
    for (let i = 0; i < prior; i++) acquire(r, 'rw_common_buckler', i);
    r.queue[4] = unit(r, 'rw_trade_hawker');
    acquire(r, 'rw_common_runner', HAND_BASE, 0);
    for (let i = prior; i < 4; i++) acquire(r, 'rw_common_buckler', i);
    assert(r.tc.generatedRations === (prior === 1 ? 1 : 0), 'Trade window followed the owner instead of the purchase count');
  }
});

test('selling a fed carrier transmits food without consuming direct feeding limits', () => {
  const r = fixture('supply');
  r.queue[0] = unit(r, 'rw_supply_pup'); r.queue[1] = unit(r, 'rw_supply_pup');
  item(r, 'f_bread', 0);
  assert(sell(r, 0), 'Carrier failed to sell');
  assert(r.queue[1]!.atkBonus === 1 && r.queue[1]!.hpBonus === 1, 'Inherited food fired a direct-food trait');
  assert(r.tc.foods === 1, 'Inherited food incremented the meal count');
});

test('a directly fed hand unit receives its own food trait', () => {
  const r = fixture('supply');
  r.hand[0] = unit(r, 'rw_supply_pup');
  item(r, 'f_bread', HAND_BASE);
  const o = r.hand[0] as Owned;
  assert(o.atkBonus === 2 && o.hpBonus === 2 && r.tc.foods === 1, 'Missing hand-unit food trait');
});

test('paid buys count once on either merge route and free units give no buy rewards', () => {
  for (const separate of [false, true]) {
    const r = fixture('rune'); r.tavern = 3;
    acquire(r, 'rw_rune_satchel', 0, 0);
    assert(r.tc.generatedSpells === 0, 'Free gain triggered ownBuy');
    acquire(r, 'rw_rune_satchel', separate ? 1 : 0);
    if (separate) assert(moveOwned(r, 1, 0)?.merged, 'Expected explicit merge');
    acquire(r, 'rw_rune_satchel', 0);
    assert(Number(r.tc.generatedSpells) === 2 && r.tc.bought === 2, 'Merging changed paid buy rewards');
  }
});

test('a hand merge preserves an already spent blood payment across reload', () => {
  const r = fixture('blood');
  acquire(r, 'rw_blood_cutpurse', 0);
  assert(payBlood(r, 0).ok, 'First payment failed');
  acquire(r, 'rw_blood_cutpurse', HAND_BASE);
  assert(moveOwned(r, HAND_BASE, 0)?.merged, 'Hand merge failed');
  const restored = retrieve(r), before = JSON.stringify(restored);
  assert(!payBlood(restored, 0).ok && JSON.stringify(restored) === before, 'Merging reset payment usage');
});

test('full ration shelf refuses merchant spell without charging or corrupting the save', () => {
  const r = fixture('supply'); r.tavern = 2;
  assert(reroll(r), 'Could not stock a two-slot supply shelf');
  acquire(r, 'rw_common_cook', 0); acquire(r, 'rw_common_cook', 1);
  for (const s of r.shop) if (s.kind === 'food' && s.free) toggleLock(r, s.sid);
  advanceFixture(r); r.gold = 100;
  acquire(r, 'rw_common_cook', 2);
  assert(r.shop.filter(s => s.kind === 'food').length === 5, 'Expected full food shelf');
  r.merchant = [{ kind: 'spell', id: 'x_ignite', price: 2 }];
  const before = JSON.stringify(r);
  assert(!buyGoods(r, 0) && JSON.stringify(r) === before, 'Full shelf consumed the purchase');
  retrieve(r);
});

test('invalid map selection fails to load', () => {
  const r = newRun(1);
  r.path[0] = r.map[0].length;
  store.set(SAVE_KEY, JSON.stringify(r));
  assert(load() === null, 'Out-of-range choice left a resumable, unplayable route');
});

test('paying for a capped attack gain leaves the complete state intact', () => {
  const r = fixture('blood'); r.queue[0] = unit(r, 'rw_blood_vow');
  r.queue[0].atkBonus = STAT_CAP;
  const before = JSON.stringify(r);
  assert(!canPayBlood(r, 0) && !payBlood(r, 0).ok, 'Payment accepted without an attack gain');
  assert(JSON.stringify(r) === before, 'Rejected payment mutated the state');
});
console.log(`archetype preparation regressions passed (${checks})`);
