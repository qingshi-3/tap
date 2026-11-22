// 补给 / 法术 / 装备重新分工与接替继承比例（SUPPORT-REVIEW.md）
import { ACTIVE_EQUIPS, ATOMS, EQUIP, FOOD, FOOD_POOL, SHOP_POOL, SPELL_POOL, type Atom } from '../src/core/data';
import { simulate } from '../src/core/engine';
import { curNode, dynamicSeal, isCombat, newRun, nodeOpts, pickNode, rollChest, spellTargetOk, supportTargetHint, takeover, takeoverInherit, takeoverKin, useFood, save, load, type Owned, type RunState } from '../src/core/run';

const ok = (v: unknown, message: string) => { if (!v) throw new Error(message); };
let checks = 0;
const check = (v: unknown, message: string) => { ok(v, message); checks++; };
const owned = (r: RunState, def: string, extra: Partial<Owned> = {}): Owned => ({ oid: r.nextId++, def, copies: 1, atkBonus: 0, hpBonus: 0, ...extra });
const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
const shelf = (r: RunState, def: string) => { const sid = r.nextId++; r.shop.push({ sid, kind: 'food', def, locked: false, free: false }); return sid; };

// 1. 道具池
{
  const foods = ids(FOOD_POOL), spells = ids(SPELL_POOL), equips = ids(ACTIVE_EQUIPS);
  check(FOOD_POOL.length === 26 && !foods.has('f_whet') && !foods.has('f_roast'), `supplies are 26 without whetstone and roast (${FOOD_POOL.length})`);
  check(['f_swift_feed', 'f_recoil_shot', 'f_den_mask', 'f_ledger', 'f_echo_ink', 'f_pair_wine'].every((id) => foods.has(id)), 'six supplies moved from equipment are in the pool');
  check(FOOD.f_drum.rollWeight === 0.5, 'war drum appears at half weight');
  check(SPELL_POOL.length === 12, `spells are 12 (${SPELL_POOL.length})`);
  check(['x_search', 'x_echo', 'x_coin', 'x_bank', 'x_siphon', 'x_bonepact', 'x_inscribe', 'x_thorn', 'x_sprout', 'x_transfer', 'x_temper'].every((id) => !spells.has(id)), 'retired spells are out of the pool');
  check(['x_lure', 'x_rout', 'x_dispel'].every((id) => spells.has(id)), 'enemy spells are in the pool');
  check(ACTIVE_EQUIPS.length === 31, `equipment is 31 (${ACTIVE_EQUIPS.length})`);
  const byQ = [0, 1, 2, 3].map((q) => ACTIVE_EQUIPS.filter((e) => e.q === q));
  check(byQ.map((x) => x.length).join() === '8,7,8,8', `quality split 8/7/8/8 (${byQ.map((x) => x.length).join('/')})`);
  check(byQ[0].every((e) => e.atoms?.length === 1 && !e.atk && !e.hp) && new Set(byQ[0].map((e) => e.atoms![0])).size === ATOMS.length, 'white equipment is exactly the eight single atoms');
  check(!['w_sword', 'w_mail', 'iron', 'e_courier_spurs', 'e_chamber', 'e_ember_clasp', 'e_den_plate', 'e_till_chain', 'e_sigil_quill', 'e_twin_knot', 'e_mess_tin', 'e_dining_bell'].some((id) => equips.has(id)), 'stat whites and migrated archetype gear are out');
  check(EQUIP.p_thorn.q === 1 && !EQUIP.p_thorn.hp, 'thorn mail is blue without the +4 health');
}

// 2. 账房算盘 / 双声墨：喂食时按本回合计数换算追伤
{
  const r = newRun(11);
  r.activeArchetypes = [...new Set([...r.activeArchetypes, 'trade', 'rune'])] as RunState['activeArchetypes'];
  r.gold = 20; r.queue[0] = owned(r, SHOP_POOL.find((c) => c.archetype === 'trade')!.id);
  check(supportTargetHint(r, 'f_ledger', r.queue[0]) === '本回合还没有买卖单位', 'ledger needs trades this turn');
  r.tc.bought = 2; r.tc.sold = 1;
  check(dynamicSeal(r, 'f_ledger') === 3, 'ledger converts three trades into 3 seal');
  check(useFood(r, shelf(r, 'f_ledger'), 0).ok && r.queue[0]!.seal === 3, 'ledger banks the seal on the eater');
  r.tc.spells = 9;
  check(dynamicSeal(r, 'f_echo_ink') === 8, 'echo ink caps at 8');
}

// 3. 敌阵法术与点火
const combatRun = (seed: number) => {
  const r = newRun(seed);
  if (!curNode(r)) pickNode(r, nodeOpts(r).find((i) => isCombat(r.map[r.layer][i].k)) ?? nodeOpts(r)[0]);
  ok(!!curNode(r) && isCombat(curNode(r)!.k), 'fixture starts on a combat node');
  r.gold = 20; r.queue[0] = owned(r, SHOP_POOL[0].id);
  r.enemy = { boss: null, units: [
    { def: 't_wolf', atk: 1, hp: 10, lvl: 1, ax: ['shield', 'fury'] as Atom[] },
    { def: 't_wisp', atk: 2, hp: 10, lvl: 1, ax: ['shield', 'fury'] as Atom[] },
    { def: 't_bonelet', atk: 3, hp: 10, lvl: 1, ax: ['shield', 'fury'] as Atom[] },
  ], elite: ['shield', 'fury'] };
  return r;
};
{
  const r = combatRun(21);
  check(useFood(r, shelf(r, 'x_lure'), null).ok && r.enemy.units.map((u) => u.def).join() === 't_bonelet,t_wolf,t_wisp', 'lure pulls the enemy rear to the front');
  check(useFood(r, shelf(r, 'x_rout'), null).ok && r.enemy.units.map((u) => u.def).join() === 't_wolf,t_wisp,t_bonelet', 'rout sends the enemy front to the rear');
  check(useFood(r, shelf(r, 'x_dispel'), null).ok && r.enemy.units.every((u) => u.ax?.join() === 'fury'), 'dispel strips shield but keeps other affixes');
  check(r.enemy.elite?.join() === 'shield,fury' && r.enemy.dispelled?.join() === 'shield', 'elite list stays for loot; dispelled is recorded');
  check(!spellTargetOk(r, 'x_dispel', null), 'dispel is unavailable once nothing is left to strip');
  r.enemy.boss = 'b_1' as RunState['enemy']['boss'];
  check(!spellTargetOk(r, 'x_lure', null) && !spellTargetOk(r, 'x_rout', null), 'boss lineups cannot be moved');
}
{
  const r = combatRun(22);
  check(useFood(r, shelf(r, 'x_ignite'), 0).ok && r.queue[0]!.tfx?.includes('ignite') && !r.queue[0]!.granted, 'ignite is a battle effect, not a granted ability');
  check(!spellTargetOk(r, 'x_ignite', r.queue[0]), 'a unit cannot be ignited twice in one turn');
  const out = simulate([{ def: r.queue[0]!.def, atk: 3, hp: 20, lvl: 1, tfx: ['ignite'] }], [{ def: 't_wolf', atk: 1, hp: 30, lvl: 1 }], 5);
  check(out.events.some((e) => e.t === 'dmg' && e.src === 1 && e.tgt === 1), 'ignited unit takes 1 damage at battle start');
}

// 4. 精英战利品保底
{
  let hits = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const r = newRun(seed);
    r.turn = 4;
    const atom = ATOMS.filter((a) => a !== 'pierce')[seed % 7];
    r.enemy = { boss: null, units: [], elite: [atom] };
    const chest = rollChest(r, 'elite');
    if (chest.items.some((id) => EQUIP[id].atoms?.includes(atom))) hits++;
  }
  check(hits === 60, `every elite chest carries one of the elite's affixes (${hits}/60)`);
}

// 5. 接替：同流派或桥接全额，跨流派与通用卡一半
{
  const of = (a: string) => SHOP_POOL.find((c) => c.archetype === a && !c.bridge)!.id;
  const utility = SHOP_POOL.find((c) => !c.archetype)!.id;
  check(takeoverKin(of('wheel'), SHOP_POOL.filter((c) => c.archetype === 'wheel')[1].id), 'same archetype is kin');
  check(takeoverKin(of('wheel'), of('rune')) && takeoverKin(of('blood'), of('ember')), 'bridge pairs are kin');
  check(!takeoverKin(of('wheel'), of('hunt')) && !takeoverKin(utility, of('wheel')) && !takeoverKin(of('wheel'), utility), 'other pairs and utility cards are not kin');
  const old = { def: of('wheel'), atkBonus: 7, hpBonus: 9 };
  check(takeoverInherit(old, of('rune')).join() === '7,9' && takeoverInherit(old, of('hunt')).join() === '3,4', 'kin inherits in full; cross-archetype inherits half, rounded down');
  // 实际接替
  const r = newRun(31);
  r.gold = 30; r.tavern = 6;
  const cross = SHOP_POOL.find((c) => c.archetype && c.archetype !== 'wheel' && !takeoverKin(of('wheel'), c.id) && r.activeArchetypes.includes(c.archetype))!;
  r.queue = r.queue.map(() => null);
  r.queue[0] = owned(r, of('wheel'), { atkBonus: 7, hpBonus: 9 });
  r.queue[1] = owned(r, utility);
  const sid = r.nextId++;
  r.shop = [{ sid, kind: 'unit', def: cross.id, locked: false, free: false }];
  const res = takeover(r, sid, 0);
  check(res.ok && res.inherited.join() === '3,4' && r.queue[0]!.atkBonus === 3 && r.queue[0]!.hpBonus === 4, 'real cross-archetype takeover keeps half');
}

// 6. 旧存档：背包、宝箱、商人里的已下架道具照常读取
{
  const mem = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear() } });
  const r = newRun(41);
  r.bag = ['w_sword', 'e_dining_bell'];
  r.queue[0] = owned(r, SHOP_POOL.find((c) => c.archetype && r.activeArchetypes.includes(c.archetype))!.id, { ench: 'e_till_chain' });
  r.hand[0] = { kind: 'spell', oid: r.nextId++, def: 'x_bonepact', source: 'test', obtainedTurn: r.turn };
  r.chest = { items: ['w_mail', 'iron', 'e_chamber'], ad: false, src: 'elite' };
  r.merchant = [{ kind: 'spell', id: 'x_bonepact', price: 2 }, { kind: 'equip', id: 'e_twin_knot', price: 4 }];
  save(r);
  const back = load();
  check(!!back && back.bag.join() === 'w_sword,e_dining_bell' && back.chest?.items.length === 3 && back.merchant?.length === 2 && back.queue[0]?.ench === 'e_till_chain' && !!back.hand[0], 'saves holding retired items still load');
}

console.log(`support review: ${checks} checks passed (pools, count-based supplies, enemy spells, ignite, elite loot, takeover ratios)`);
