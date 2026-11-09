// @ts-ignore Node runtime assertion module is provided by vite-node.
import assert from 'node:assert/strict';
import { card, SHOP_POOL, STAT_CAP } from '../src/core/data';
import { newRun, buy, buyToHand, pickDiscover, claimReward, moveOwned, useFood, useHero, endTurn, resolveEvent, fight, settleBattle, trialFight, ownedAtk, ownedHp, observeFacts, load, SAVE_KEY, HAND_BASE, type Owned, type RunFact, type RunState } from '../src/core/run';
const unit = (oid: number, def: string, copies = 1): Owned => ({ oid, def, copies, atkBonus: 0, hpBonus: 0 });
function setup() {
    const r = newRun(19, { solo: true });
    r.gold = 99;
    r.nextId = 1000;
    r.queue = [null, null, null, null, null];
    r.hand = [null, null, null, null, null];
    r.shop = [];
    r.discover = [];
    return r;
}
function offer(r: RunState, def: string, kind: 'unit' | 'food' = 'unit') {
    const sid = r.nextId++;
    r.shop.push({ sid, kind, def, locked: false, free: false });
    return sid;
}
function facts(r: RunState) {
    const out: RunFact[] = [];
    observeFacts(r, fact => out.push(fact));
    return out;
}
const food = (r: RunState, id: string, target: number) => useFood(r, offer(r, id, 'food'), target);
const stats = (o: Owned) => [ownedAtk(o), ownedHp(o)];
assert.equal(card('n_caravan').faction, 'neutral');
assert.equal(card('n_caretaker').faction, 'neutral');
assert.equal(card('n_tether').faction, 'neutral');
assert.equal(card('n_medic').faction, 'neutral');
assert.ok(SHOP_POOL.some(x => x.id === 'n_caravan'));
assert.ok(SHOP_POOL.some(x => x.id === 'n_caretaker'));
// Purchase, deployment and direct merge each produce one acquisition.
for (const copies of [1, 3]) {
    const r = setup(), guard = unit(1, 'n_caravan', copies);
    r.queue[1] = guard;
    const log = facts(r);
    assert.equal(buyToHand(r, offer(r, 's_dart')).ok, true);
    assert.equal(guard.hpBonus, copies === 3 ? 2 : 1);
    assert.deepEqual(log.slice(0, 2).map(x => x.kind === 'action' ? x.action : x.effectId), ['buy', 'obtain']);
    const obtain = log.find(x => x.kind === 'action' && x.action === 'obtain')!;
    const growth = log.find(x => x.kind === 'growth')!;
    assert.equal(growth.parentId, obtain.id);
    const before = guard.hpBonus;
    assert.ok(moveOwned(r, HAND_BASE, 0));
    assert.equal(guard.hpBonus, before);
    assert.equal(buy(r, offer(r, 's_dart'), 0).ok, true);
    assert.equal(guard.hpBonus, before + (copies === 3 ? 2 : 1));
}
// Two guards, self-merge exclusion, multiple pending discoveries and failed purchase.
{
    const r = setup(), a = unit(1, 'n_caravan'), b = unit(2, 'n_caravan');
    r.queue[0] = a;
    r.queue[1] = b;
    assert.equal(buy(r, offer(r, 'n_caravan'), 0).ok, true);
    assert.equal(a.hpBonus, 0);
    assert.equal(b.hpBonus, 1);
    const old = b.hpBonus;
    r.discover = [{ opts: ['s_dart'], src: 'test', mode: 'gain', price: 0, count: 2 }];
    r.hand = [unit(3, 's_fox'), unit(4, 's_fox'), unit(5, 's_fox'), unit(6, 's_fox'), null];
    assert.ok(pickDiscover(r, 0));
    assert.equal(a.hpBonus, 2);
    assert.equal(b.hpBonus, old + 2);
    assert.equal(r.rewards!.length, 2);
    r.hand[0] = null;
    assert.equal(claimReward(r, r.rewards![0].id), true);
    assert.equal(a.hpBonus, 2);
    assert.equal(b.hpBonus, old + 2);
    const log = facts(r);
    r.gold = 0;
    assert.equal(buy(r, offer(r, 's_dart'), 2).ok, false);
    assert.equal(log.length, 0);
}
// Acquisition, guard growth and caretaker reaction keep one causal chain.
{
    const r = setup();
    r.queue[0] = unit(1, 'n_caravan');
    r.queue[1] = unit(2, 'n_caretaker');
    const log = facts(r);
    assert.equal(buyToHand(r, offer(r, 's_dart')).ok, true);
    assert.deepEqual([r.queue[0]!.atkBonus, r.queue[0]!.hpBonus], [1, 1]);
    const [purchase, acquisition, health, attack] = log;
    assert.equal(acquisition.parentId, purchase.id);
    assert.equal(health.parentId, acquisition.id);
    assert.equal(attack.parentId, health.id);
    assert.deepEqual(log.map(x => x.kind === 'action' ? x.action : x.effectId), ['buy', 'obtain', 'caravan', 'caretaker']);
}
// Bread produces one health event and one finite caretaker reaction.
for (const copies of [1, 3]) {
    const r = setup();
    r.queue[0] = unit(1, 's_dart');
    r.queue[2] = unit(2, 'n_caretaker', copies);
    const log = facts(r);
    assert.equal(food(r, 'f_bread', 0).ok, true);
    const target = r.queue[0]!;
    assert.deepEqual([target.atkBonus, target.hpBonus], [copies === 3 ? 3 : 2, 1]);
    const growth = log.filter(x => x.kind === 'growth');
    assert.equal(growth.length, 2);
    assert.equal(growth[0].effectId, 'f_bread');
    assert.equal(growth[1].parentId, growth[0].id);
    assert.equal(growth[1].effectId, 'caretaker');
    assert.equal(growth[0].parentId, log.find(x => x.kind === 'action' && x.action === 'eat')!.id);
    assert.equal(food(r, 'f_drum', 0).ok, true);
    assert.deepEqual([r.queue[0]!.atkBonus, r.queue[0]!.hpBonus], [copies === 3 ? 3 : 2, 1]);
}
// The flag applies once per positive component; a capped health gain triggers nothing.
{
    const r = setup();
    r.queue[0] = unit(1, 's_dart');
    r.queue[1] = unit(2, 'n_caretaker');
    r.queue[2] = unit(3, 'n_caretaker');
    r.relics = ['r_training'];
    const log = facts(r);
    assert.equal(food(r, 'f_bread', 0).ok, true);
    assert.deepEqual([r.queue[0]!.atkBonus, r.queue[0]!.hpBonus], [4, 2]);
    const g = log.filter(x => x.kind === 'growth');
    assert.deepEqual(g.map(x => [x.atk, x.hp]), [[2, 2], [2, 0]]);
    r.queue[0]!.hpBonus = STAT_CAP;
    const before = r.queue[0]!.atkBonus;
    assert.equal(food(r, 'f_bread', 0).ok, true);
    assert.equal(r.queue[0]!.atkBonus, before + 2);
}
{
    const r = setup();
    r.queue[0] = unit(1, 's_dart');
    r.queue[1] = unit(2, 'n_caretaker');
    // Campfire, play, replayed play, and attack-only play cover distinct sources.
    r.event = 'fire';
    assert.equal(resolveEvent(r, 1, 0).ok, true);
    assert.deepEqual([r.queue[0]!.atkBonus, r.queue[0]!.hpBonus], [5, 4]);
    const r2 = setup();
    r2.queue[0] = unit(1, 's_dart');
    r2.queue[1] = unit(2, 'n_caretaker');
    assert.equal(buy(r2, offer(r2, 'd_artificer'), 2, 1).ok, true);
    assert.deepEqual([r2.queue[0]!.atkBonus, r2.queue[0]!.hpBonus], [2, 1]);
    const r3 = setup();
    r3.queue[0] = unit(1, 'n_tether');
    r3.queue[1] = unit(2, 's_dart');
    r3.queue[2] = unit(3, 'n_caretaker');
    assert.equal(food(r3, 'x_echo', 0).ok, true);
    assert.deepEqual([r3.queue[1]!.atkBonus, r3.queue[1]!.hpBonus], [1, 3]);
    const r4 = setup();
    r4.queue[0] = unit(1, 's_dart');
    r4.queue[1] = unit(2, 'n_caretaker');
    assert.equal(buy(r4, offer(r4, 's_backstab'), 2, 1).ok, true);
    assert.deepEqual([r4.queue[0]!.atkBonus, r4.queue[0]!.hpBonus], [2, 0]);
}
{
    const r = setup();
    // A real fight freezes the held lineup; preview and repeated settlement are inert.
    r.queue[0] = unit(1, 'l_shield');
    r.queue[1] = unit(2, 'n_caretaker');
    r.queue[0]!.granted = { id: 'blood', duration: 'battle', value: 0, source: 'test' };
    r.relics = ['r_vanguard'];
    r.enemy = { boss: null, units: [{ def: 's_fox', atk: 1, hp: 30, lvl: 1 }] };
    const snapshot = JSON.stringify(r);
    trialFight(r);
    assert.equal(JSON.stringify(r), snapshot);
    const log = facts(r);
    const out = fight(r);
    assert.ok(out.perm[1]);
    const target = r.queue[0]!;
    const before = stats(target);
    r.queue[0] = null;
    r.hand[0] = target;
    settleBattle(r, out);
    assert.ok(ownedHp(target) > before[1]);
    assert.ok(ownedAtk(target) > before[0]);
    assert.ok(log.some(x => x.kind === 'growth' && x.effectId === 'r_vanguard' && x.phase === 'after_battle'));
    assert.ok(log.some(x => x.kind === 'growth' && x.effectId === 'scar' && x.phase === 'after_battle'));
    const once = JSON.stringify(r);
    settleBattle(r, out);
    assert.equal(JSON.stringify(r), once);
}
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) } });
{
    const r = setup();
    r.queue[0] = unit(1, 'n_caravan');
    storage.set(SAVE_KEY, JSON.stringify(r));
    assert.ok(load());
}
// A pure health play receives the flag only in health; caretaker produces a new attack effect.
{
    const r = setup();
    r.queue[0] = unit(1, 's_dart');
    r.queue[1] = unit(2, 'n_caretaker');
    r.relics = ['r_training'];
    const log = facts(r);
    assert.equal(buy(r, offer(r, 'n_tether'), 2, 1).ok, true);
    assert.deepEqual([r.queue[0]!.atkBonus, r.queue[0]!.hpBonus], [2, 4]);
    const growth = log.filter(x => x.kind === 'growth');
    assert.deepEqual(growth.map(x => [x.effectId, x.atk, x.hp]), [['p_hp', 0, 4], ['caretaker', 2, 0]]);
}
// A pending acquisition stays settled through save/reload and later claim.
{
    const r = setup();
    r.queue[0] = unit(1, 'n_caravan');
    r.hand = [unit(2, 's_fox'), unit(3, 's_fox'), unit(4, 's_fox'), unit(5, 's_fox'), null];
    r.discover = [{ opts: ['s_dart'], src: 'test', mode: 'gain', price: 0 }];
    assert.ok(pickDiscover(r, 0));
    assert.equal(r.queue[0]!.hpBonus, 1);
    storage.set(SAVE_KEY, JSON.stringify(r));
    const restored = load()!;
    assert.ok(restored);
    restored.hand[0] = null;
    assert.equal(claimReward(restored, restored.rewards![0].id), true);
    assert.equal(restored.queue[0]!.hpBonus, 1);
}
// Free shelf units are acquisitions, not purchases; observers see committed state.
{
    const r = setup();
    r.queue[0] = unit(1, 'n_caravan');
    const sid = offer(r, 's_dart');
    r.shop.find(x => x.sid === sid)!.price = 0;
    const seen: RunFact[] = [];
    const observedStates: Array<[number, boolean]> = [];
    observeFacts(r, () => { throw new Error('diagnostic observer failure'); });
    observeFacts(r, fact => {
        observedStates.push([r.queue[0]!.hpBonus, !!r.hand[0]]);
        seen.push(fact);
    });
    assert.equal(buyToHand(r, sid).ok, true);
    assert.equal(r.tc.bought, 0);
    assert.deepEqual(seen.map(x => x.kind === 'action' ? x.action : x.effectId), ['obtain', 'caravan']);
    assert.deepEqual(observedStates, [[1, true], [1, true]]);
}
// Observers see the complete outcome of each multi-effect public operation.
{
    const r = setup();
    r.queue[0] = unit(1, 's_dart');
    r.queue[1] = unit(2, 'n_tether');
    r.queue[2] = unit(3, 's_dart');
    const states: Array<[number, number, boolean]> = [];
    observeFacts(r, () => states.push([r.queue[0]!.hpBonus, r.queue[2]!.hpBonus, !!r.endTurnCommitted]));
    endTurn(r);
    assert.deepEqual(states, [[1, 1, true], [1, 1, true]]);
}
{
    const r = setup();
    r.hero = 'qm';
    r.queue[0] = unit(1, 's_dart');
    r.queue[1] = unit(2, 'n_caretaker');
    const states: Array<[number, number, number | undefined]> = [];
    observeFacts(r, () => states.push([r.queue[0]!.atkBonus, r.gold, r.heroUsed]));
    assert.ok(useHero(r, 0));
    assert.deepEqual(states, [[2, r.gold, r.turn], [2, r.gold, r.turn]]);
    assert.ok(r.gold < 99);
}
{
    const r = setup();
    r.queue[0] = unit(1, 's_dart');
    r.queue[1] = unit(2, 'n_caretaker');
    r.event = 'fire';
    const states: Array<[number, unknown]> = [];
    observeFacts(r, () => states.push([r.queue[0]!.atkBonus, r.event]));
    assert.equal(resolveEvent(r, 1, 0).ok, true);
    assert.deepEqual(states, [[5, null], [5, null]]);
}
{
    const r = setup();
    r.queue[0] = unit(1, 's_dart');
    r.queue[1] = unit(2, 'n_caretaker');
    r.queue[2] = unit(3, 's_dart');
    const states: Array<[number, number, number]> = [];
    observeFacts(r, () => states.push([r.queue[0]!.hpBonus, r.queue[2]!.hpBonus, r.history.length]));
    settleBattle(r, { result: 'win', perm: { 1: { atk: 0, hp: 1 }, 3: { atk: 0, hp: 1 } }, settlementId: 'batch' });
    assert.deepEqual(states, [[1, 1, 1], [1, 1, 1], [1, 1, 1]]);
}
{
    const r = setup();
    const first = unit(1, 'd_artificer');
    const second = unit(2, 'n_tether');
    first.fresh = true;
    second.fresh = true;
    r.queue[0] = first;
    r.queue[1] = unit(3, 's_dart');
    r.queue[2] = second;
    const states: Array<[number, number]> = [];
    observeFacts(r, () => states.push([r.queue[1]!.atkBonus, r.queue[1]!.hpBonus]));
    assert.ok(moveOwned(r, 0, 2));
    assert.deepEqual(states, [[1, 4], [1, 4]]);
}
console.log('ability-growth: passed');
