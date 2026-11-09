import { CARDS, CARD, SHOP_POOL, type CardDef } from '../src/core/data';
import { simulate } from '../src/core/engine';
import { buy, buyToHand, castHandSpell, endTurn, grantPrepMilk, HAND_BASE, moveOwned, newRun, sell, useFood, type Owned, type RunState } from '../src/core/run';

let checks = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}
function ok(actual: unknown, label: string) { eq(!!actual, true, label); }
function fixture(): RunState {
  const r = newRun(190818, { solo: true });
  r.queue = [unit('l_shield', 101), null, null, null, null];
  r.hand = [null, null, null, null, null]; r.shop = []; r.gold = 1000; r.nextId = 200;
  r.discover = []; r.rewards = []; r.relics = []; r.tavern = 6;
  return r;
}
const unit = (def: string, oid: number, copies = 1): Owned => ({ def, oid, copies, atkBonus: 0, hpBonus: 0 });
function offer(r: RunState, def: string, kind: 'unit' | 'food' = 'unit') {
  const sid = r.nextId++; r.shop.push({ sid, def, kind, locked: false, free: false }); return sid;
}
// Measure observable outputs, not implementation labels. Ignition is an idempotent grant;
// its strength is checked separately because executing it twice keeps the same ability.
function outputs(r: RunState, d: CardDef) {
  const target = r.queue[0]!;
  switch (d.pl) {
    case 'p_hp': return target.hpBonus;
    case 'p_atk': return target.atkBonus;
    case 'p_both': return [target.atkBonus, target.hpBonus];
    case 'p_feed': return [target.atkBonus, target.hpBonus, r.tc.foods];
    case 'p_ignite': return target.granted?.value ?? 0;
    case 'p_spell': return (r.discover ?? []).filter(x => x.mode === 'spell').map(x => x.count ?? 1);
    case 'p_bone': return [...r.hand, ...(r.rewards ?? []).map(x => x.card)].filter(x => x?.kind === 'spell' && x.def === 'x_bonepact').map(x => x!.kind === 'spell' ? x!.val : null);
    default: throw new Error(`Unhandled shipped play contract: ${d.id}`);
  }
}
function expected(d: CardDef, levels: number[], multiplier = 1) {
  const values = levels.flatMap(l => Array(multiplier).fill(d.pv![l - 1]) as number[]);
  const total = values.reduce((a, b) => a + b, 0);
  switch (d.pl) {
    case 'p_hp': case 'p_atk': return total;
    case 'p_both': return [total, total];
    case 'p_feed': return [total, total, total];
    case 'p_ignite': return values.length ? Math.max(...values) : 0;
    case 'p_spell': return values;
    case 'p_bone': return values.map(p => [p, p]);
  }
}

const recruitable = CARDS.filter(d => !d.token && !d.enemy);
eq(SHOP_POOL.length, 62, 'all 60 original and two newly shipped recruitable units are included');
eq(new Set(CARDS.map(d => d.id)).size, CARDS.length, 'all card definitions have unique IDs');
eq(SHOP_POOL.map(d => d.id).sort(), recruitable.map(d => d.id).sort(), 'shop pool covers all and only recruitable definitions');
for (const id of ['n_caravan', 'n_caretaker']) ok(SHOP_POOL.some(d => d.id === id && CARD[id] === d), `${id}: new recruitable identity is unique and indexed`);
const plays = SHOP_POOL.filter(d => d.pl);
for (const d of plays) {
  for (const level of [1, 2]) {
    const copies = level === 1 ? 1 : 3;
    const r = fixture();
    const actor = unit(d.id, r.nextId++, copies); actor.fresh = true; r.hand[3] = actor;
    eq(outputs(r, d), expected(d, []), `${d.id}/${level}: buying into hand has no entry output`);
    ok(moveOwned(r, HAND_BASE + 3, 1), `${d.id}/${level}: first deployment`);
    eq(outputs(r, d), expected(d, [level]), `${d.id}/${level}: exact first entry output`);
    ok(moveOwned(r, 1, HAND_BASE + 3), `${d.id}/${level}: return to hand`);
    ok(moveOwned(r, HAND_BASE + 3, 1), `${d.id}/${level}: redeploy`);
    eq(outputs(r, d), expected(d, [level]), `${d.id}/${level}: redeploy does not repeat entry`);
    const echo = offer(r, 'x_echo', 'food');
    ok(buyToHand(r, echo).ok, `${d.id}/${level}: buy echo`);
    const echoCell = HAND_BASE + r.hand.findIndex(x => x?.def === 'x_echo');
    ok(castHandSpell(r, echoCell, 1).ok, `${d.id}/${level}: cast echo`);
    eq(outputs(r, d), expected(d, [level, level]), `${d.id}/${level}: echo repeats entry once`);
    // End cannot resolve before choices. Clear fixture-only choices to isolate timing.
    r.discover = []; r.rewards = [];
    const before = JSON.stringify(outputs(r, d)); endTurn(r);
    if (d.id === 'n_tether') eq(r.queue[0]!.hpBonus, 2 * d.pv![level - 1] + d.v![level - 1], `${d.id}/${level}: separate end trigger`);
    else if (d.id === 's_backstab') eq(r.queue[0]!.atkBonus, 2 * d.pv![level - 1] + d.v![level - 1], `${d.id}/${level}: separate end trigger`);
    else eq(JSON.stringify(outputs(r, d)), before, `${d.id}/${level}: end does not repeat entry`);
    const committed = JSON.stringify(r); endTurn(r); eq(JSON.stringify(r), committed, `${d.id}/${level}: end commits once`);
  }
  const r = fixture();
  ok(buy(r, offer(r, d.id), 1).ok, `${d.id}: direct purchase enters`);
  eq(outputs(r, d), expected(d, [1]), `${d.id}: direct purchase output`);
  ok(buy(r, offer(r, d.id), 1).ok, `${d.id}: second copy`);
  eq(outputs(r, d), expected(d, [1]), `${d.id}: ordinary merge does not enter`);
  ok(buy(r, offer(r, d.id), 1).ok, `${d.id}: third copy`);
  eq(outputs(r, d), expected(d, [1, 2]), `${d.id}: golden upgrade executes golden entry once`);

  const deferred = fixture(); const entered = unit(d.id, 300, 2); deferred.hand[0] = entered;
  ok(buy(deferred, offer(deferred, d.id), HAND_BASE).ok, `${d.id}: golden upgrade in hand`);
  eq(outputs(deferred, d), expected(d, []), `${d.id}: hand golden entry deferred`);
  ok(moveOwned(deferred, HAND_BASE, 1), `${d.id}: deploy deferred golden`);
  eq(outputs(deferred, d), expected(d, [2]), `${d.id}: deferred golden executes once`);
  ok(moveOwned(deferred, 1, HAND_BASE + 3), `${d.id}: deferred return`);
  ok(moveOwned(deferred, HAND_BASE + 3, 1), `${d.id}: deferred redeploy`);
  eq(outputs(deferred, d), expected(d, [2]), `${d.id}: deferred marker consumed`);

  const virgin = fixture(); virgin.hand[0] = { ...unit(d.id, 301, 2), fresh: true };
  virgin.hand[1] = { ...unit(d.id, 302), fresh: true };
  ok(moveOwned(virgin, HAND_BASE + 1, HAND_BASE), `${d.id}: all-fresh triple in hand`);
  ok(moveOwned(virgin, HAND_BASE, 1), `${d.id}: all-fresh golden deployment`);
  eq(outputs(virgin, d), expected(d, [2]), `${d.id}: first entry and golden entry coalesce`);

  for (const amplifierLevel of [1, 2]) {
    const amp = fixture(); amp.queue[3] = unit('v_queen', 310, amplifierLevel === 1 ? 1 : 3);
    // Same-kind auras use highest; a second normal queen must not add another copy.
    amp.queue[4] = unit('v_queen', 311);
    ok(buy(amp, offer(amp, d.id), 1).ok, `${d.id}: amplified entry`);
    eq(outputs(amp, d), expected(d, [1], amplifierLevel + 1), `${d.id}: highest queen amplification`);
  }
}

for (const copies of [1, 3]) {
  const value = copies === 1 ? 1 : 2;
  const r = fixture(); r.queue[0] = unit('d_dunecaster', 101, copies); r.queue[1] = unit('l_shield', 102);
  r.hand[0] = unit('l_shield', 103); r.hand[1] = unit('d_dunecaster', 104, copies);
  ok(sell(r, HAND_BASE), 'selling hand unit succeeds');
  eq([r.queue[0]!.atkBonus, r.queue[0]!.hpBonus], [value, value], `salvage/${copies}: observes hand sale`);
  eq([(r.hand[1] as Owned).atkBonus, (r.hand[1] as Owned).hpBonus], [0, 0], 'hand salvage is inactive');
  ok(sell(r, 1), 'selling queued unit succeeds');
  eq([r.queue[0]!.atkBonus, r.queue[0]!.hpBonus], [2 * value, 2 * value], `salvage/${copies}: observes queue sale`);
  const self = r.queue[0]!; ok(sell(r, 0), 'salvage can itself be sold');
  eq([self.atkBonus, self.hpBonus], [2 * value, 2 * value], 'salvage never observes its own sale');

  const artificer = fixture(); artificer.queue[1] = unit('d_artificer', 102, copies);
  ok(sell(artificer, 1), 'artificer sale');
  eq([artificer.queue[0]!.atkBonus, artificer.queue[0]!.hpBonus], [value, value], 'artificer sale is independent of entry');

  const dragon = fixture(); dragon.queue[0] = unit('d_onyx', 101, copies);
  ok(buyToHand(dragon, offer(dragon, 's_dart')).ok, 'buy tier one into hand');
  eq([dragon.queue[0]!.atkBonus, dragon.queue[0]!.hpBonus], [value, value], 'tier one purchase grows queued team');
  ok(moveOwned(dragon, HAND_BASE, 1), 'deploy bought tier one');
  eq(dragon.queue[0]!.atkBonus, value, 'deployment does not repeat purchase');
  ok(buy(dragon, offer(dragon, 's_dart'), 1).ok, 'buy duplicate tier one');
  eq(dragon.queue[0]!.atkBonus, 2 * value, 'purchased duplicate still emits purchase');

  const milk = fixture(); milk.queue[1] = unit('v_sentinel', 102, copies); milk.milkTurn = undefined;
  grantPrepMilk(milk); eq(milk.shop.filter(x => x.def === 'f_milk').map(x => x.val), [[value, value]], 'round start milk exact strength');
  grantPrepMilk(milk); eq(milk.shop.filter(x => x.def === 'f_milk').length, 1, 'round start milk does not repeat');
}

// Echo produces effect copies, while spell observers see one cast.
for (const copies of [1, 3]) {
  const r = fixture(); r.queue[1] = unit('s_backstab', 102); r.queue[2] = unit('d_keeper', 103);
  r.queue[3] = unit('d_pharaoh', 104, copies); r.queue[4] = unit('v_queen', 105);
  ok(useFood(r, offer(r, 'x_echo', 'food'), 1).ok, 'echo with pharaoh and queen');
  eq(r.queue[0]!.atkBonus, 2 * 2 * (copies === 1 ? 2 : 3), 'echo copies each apply current entry amplifier');
  eq([r.queue[1]!.atkBonus, r.queue[1]!.hpBonus], [1, 1], 'spell observer executes once for echoed spell');
}
// Percentage opening damage follows the damage pipeline, rather than direct life loss.
for (const lvl of [1, 2] as const) {
  const ordinary = simulate([{def:'s_master',lvl,atk:6,hp:9}], [{def:'t_wolf',lvl:1,atk:1,hp:100}], 5);
  const shot = ordinary.events.find(e => e.t === 'dmg' && e.kind === 'shot');
  ok(shot?.t === 'dmg' && shot.n === (lvl === 1 ? 33 : 66), 'percentage damage uses current health and golden value');
  const blocked = simulate([{def:'t_wolf',lvl:1,atk:1,hp:100,ench:'amulet'}], [{def:'s_master',lvl,atk:6,hp:9}], 5);
  ok(blocked.events.some(e => e.t === 'dmg' && e.kind === 'shot' && e.blocked), 'percentage damage can be blocked');
}
console.log(`Trigger contracts passed: ${plays.length} entry cards at ordinary/golden levels; ${checks} behavior assertions.`);
