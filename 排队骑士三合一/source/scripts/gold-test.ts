// 金色改为技能升级（CARD-REVIEW.md）：身材 ×1.5、"金色："文案、金色覆盖与金色专属规则、多目标与新选项。
import { rulesAt } from '../src/core/archetypes';
import { card, goldStat, SHOP_POOL } from '../src/core/data';
import { simulate, type BattleOut, type UnitSpec } from '../src/core/engine';
import { GOLD } from '../src/core/goldCatalog';
import { newRun, ownedAtk, ownedHp, ownedRules, type Owned } from '../src/core/run';

const ok = (v: unknown, message: string) => { if (!v) throw new Error(message); };
let checks = 0;
const check = (v: unknown, message: string) => { ok(v, message); checks++; };
const unit = (def: string, lvl: 1 | 2 = 1, atk = 3, hp = 40, extra: Partial<UnitSpec> = {}): UnitSpec => ({ def, atk, hp, lvl, ...extra });
const foes = (n: number, hp = 60): UnitSpec[] => Array.from({ length: n }, () => ({ def: 't_wolf', atk: 1, hp, lvl: 1 }));
const shots = (out: BattleOut, src: number) => out.events.filter((e): e is Extract<typeof e, { t: 'dmg' }> => e.t === 'dmg' && e.src === src && e.kind === 'shot');

// 1. 覆盖面：每张商店卡都有金色文案；基础数值不随等级变化
check(SHOP_POOL.every(c => !!c.goldText), 'every shop card has a gold line');
check(Object.keys(GOLD).length === SHOP_POOL.length, 'gold specs match the shop pool one to one');
check(SHOP_POOL.every(c => (c.rules ?? []).every(r => !Array.isArray(r.n) && !Array.isArray(r.hp))), 'base rule numbers are fixed values');
check(SHOP_POOL.every(c => [c.v, c.u, c.pv].every(v => !v || v.every(x => x === v[0]))), 'card text shows the same base numbers at every level');

// 2. rulesAt：普通时没有金色专属规则，金色时套用覆盖
const buckler = card('rw_common_buckler');
check(rulesAt(buckler.rules, 1).length === 1 && rulesAt(buckler.rules, 2).length === 2, 'gold-only rule exists only when gold');
const bell = card('rw_wheel_bell');
check(rulesAt(bell.rules, 1)[0].every === 2 && rulesAt(bell.rules, 2)[0].every === 1 && rulesAt(bell.rules, 2)[0].limit === 5, 'gold patch overrides every and limit');

// 3. 金色身材 ×1.5
{
  const o: Owned = { oid: 1, def: 'rw_common_veteran', copies: 3, atkBonus: 0, hpBonus: 0 };
  const c = card(o.def);
  check(ownedAtk(o) === goldStat(c.atk) && ownedHp(o) === goldStat(c.hp) && goldStat(10) === 15, 'gold base stats are x1.5');
  check(ownedRules(o).length === rulesAt(c.rules, 2).length, 'ownedRules uses the gold level');
}

// 4. 多目标：金色绕阵快骑成为队首时同时打敌方前两名
{
  const normal = simulate([unit('rw_wheel_courier')], foes(3), 3);
  const gold = simulate([unit('rw_wheel_courier', 2)], foes(3), 3);
  const firstTargets = (out: BattleOut) => new Set(shots(out, 1).slice(0, 2).map(e => e.tgt));
  check(firstTargets(normal).size === 1 && firstTargets(gold).size === 2, 'gold courier hits the first two enemies on entry');
}

// 5. 并肩：金色时任意相邻友军都算搭档
{
  const normal = simulate([unit('rw_pair_cadet'), unit('t_wisp')], foes(1), 5);
  const gold = simulate([unit('rw_pair_cadet', 2), unit('t_wisp')], foes(1), 5);
  const partnerBuff = (out: BattleOut) => out.events.some(e => e.t === 'buff' && e.src === 1 && e.tgt === 2);
  check(!partnerBuff(normal) && partnerBuff(gold), 'gold pair unit treats any adjacent ally as its partner');
}

// 6. 金色专属规则在战斗里生效（列阵护卫开战获得格挡）
{
  const blocks = (out: BattleOut) => out.events.filter(e => e.t === 'block' && e.tgt === 1).length;
  check(blocks(simulate([unit('rw_formation_guard', 2)], foes(1), 7)) > blocks(simulate([unit('rw_formation_guard')], foes(1), 7)), 'gold guard gains block at battle start');
}

// 7. 释放后保留一半蓄能（金甲机兵）
{
  const out = simulate([unit('t_wisp', 1, 1, 6), unit('rw_charge_gunner', 2, 2, 80)], foes(2, 80), 9);
  const released = out.events.findIndex(e => e.t === 'counter' && e.uid === 2 && e.charge > 0);
  check(released >= 0, 'gunner charges in the rear');
  const after = out.events.filter((e): e is Extract<typeof e, { t: 'counter' }> => e.t === 'counter' && e.uid === 2);
  const drop = after.findIndex((e, i) => i > 0 && e.charge < after[i - 1].charge);
  check(drop > 0 && after[drop].charge === Math.floor(after[drop - 1].charge / 2), 'gold gunner keeps half its charge after releasing');
}

// 8. 召唤个数（前哨兽卵）
{
  const summons = (out: BattleOut) => out.events.filter(e => e.t === 'summon' && e.src === 1).length;
  check(summons(simulate([unit('rw_nest_hatch')], foes(1), 11)) === 1 && summons(simulate([unit('rw_nest_hatch', 2)], foes(1), 11)) === 2, 'gold hatch summons two whelps');
}

// 9. 引爆后转移一半猎标（引线猎手）：三名斥候先给敌首叠标，引线猎手上前引爆
{
  const run = (lvl: 1 | 2) => simulate([unit('rw_hunt_spotter', 1, 1, 6), unit('rw_hunt_spotter', 1, 1, 6), unit('rw_hunt_spotter', 1, 1, 6), unit('rw_hunt_powder', lvl, 1, 60)], foes(2, 200), 13);
  const second = (out: BattleOut) => out.init.filter(u => u.side === 1)[1].uid;
  const passed = (out: BattleOut) => out.events.some(e => e.t === 'counter' && e.uid === second(out) && e.mark > 0);
  check(!passed(run(1)) && passed(run(2)), 'gold powder passes half the marks to the next enemy');
}

// 10. 分担减半（霜岩傀儡）
{
  const run = (lvl: 1 | 2) => simulate([unit('t_wisp', 1, 1, 30), unit('rw_formation_phalanx', lvl, 1, 60)], [{ def: 't_wolf', atk: 6, hp: 200, lvl: 1 }], 17);
  const taken = (out: BattleOut) => out.events.filter((e): e is Extract<typeof e, { t: 'dmg' }> => e.t === 'dmg' && e.tgt === 2 && !e.blocked).reduce((s, e) => s + e.n, 0);
  check(taken(run(2)) < taken(run(1)), 'gold phalanx takes less damage when sharing');
}

// 11. 释放后退到队尾（机甲炮手）
{
  const out = simulate([unit('t_wisp', 1, 1, 6), unit('rw_charge_mortar', 2, 2, 80), unit('t_wolf', 1, 1, 80)], foes(3, 80), 19);
  check(out.events.some(e => e.t === 'move' && e.uid === 2 && String(e.reason).includes('机甲炮手')), 'gold mortar rotates to the back after releasing');
}

// 12. 经营：金色专属的回合开始规则（雪人伙夫）进入实际规则列表
{
  const r = newRun(77, { solo: true });
  const o: Owned = { oid: r.nextId++, def: 'rw_supply_canteen', copies: 3, atkBonus: 0, hpBonus: 0 };
  check(ownedRules(o).some(rule => rule.phase === 'prep' && rule.on === 'turnStart' && rule.effect === 'ration'), 'gold canteen gains a turn-start ration rule');
  check(!ownedRules({ ...o, copies: 1 }).some(rule => rule.phase === 'prep' && rule.on === 'turnStart'), 'normal canteen has no turn-start rule');
}

console.log(`gold: ${checks} checks passed (coverage, rulesAt, x1.5 stats, multi-target, pair, gold-only battle rule, retain, summon count, mark transfer, halve, rotate, prep gold-only)`);
