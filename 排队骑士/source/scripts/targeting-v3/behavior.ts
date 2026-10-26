// targeting-v3 独立行为验收。生产实现冻结后运行：
//   npx vite-node scripts/targeting-v3/behavior.ts
// @ts-ignore node builtin
import { mkdirSync, writeFileSync } from 'node:fs';
import { CARD, FOOD, FOODS, card } from '../../src/core/data';
import { simulate, type UnitSpec } from '../../src/core/engine';
import {
  INHERIT_FOODS, PRICE, SAVE_KEY, SUPPLY_VERSION, buy, endTurn, foodPrice, load, lvlOf, newRun,
  ownedAtk, ownedHp, save, sell, useFood, type Owned, type RunState, type ShopItem,
} from '../../src/core/run';

type CaseResult = { name: string; ok: boolean; detail?: string };
const results: CaseResult[] = [];
function test(name: string, body: () => void) {
  try { body(); results.push({ name, ok: true }); }
  catch (error) { results.push({ name, ok: false, detail: error instanceof Error ? error.stack ?? error.message : String(error) }); }
}
function eq<T>(actual: T, expected: T, label: string) {
  if (!Object.is(actual, expected)) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}
function deepEq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
const owned = (oid: number, def = 's_dart', copies = 1): Owned => ({ oid, def, copies, atkBonus: 0, hpBonus: 0 });
function fresh(seed = 1): RunState {
  const r = newRun(seed);
  r.gold = 999;
  r.turn = 12;
  r.queue.fill(null);
  r.shop = [];
  r.relics = [];
  r.tc = { foods: 0, bought: 0, bear: {}, keeper: {}, shareUsed: false };
  return r;
}
function addFood(r: RunState, def: string, val?: [number, number]): ShopItem {
  const item: ShopItem = { sid: r.nextId++, kind: 'food', def, locked: false, free: def === 'f_milk', val };
  r.shop.push(item);
  return item;
}
function eat(r: RunState, def: string, slot: number | null, val?: [number, number]) {
  const item = addFood(r, def, val);
  const result = useFood(r, item.sid, slot);
  if (!result.ok) throw new Error(`${def} failed: ${result.why}`);
  return { item, result };
}
function bonuses(r: RunState) { return r.queue.map((o) => o ? [o.atkBonus, o.hpBonus] : null); }

test('食品数值、价格与传承白名单保持精确契约', () => {
  const expected: Record<string, [number, number]> = {
    f_stew: [1, 1], f_whet: [2, 1], f_roast: [3, 3], f_sushi: [1, 1], f_dragon: [2, 2],
  };
  for (const [id, stats] of Object.entries(expected)) deepEq([FOOD[id].atk ?? 0, FOOD[id].hp ?? 0], stats, id);
  deepEq(INHERIT_FOODS, ['f_bread', 'f_whet', 'f_roast', 'f_milk'], '传承白名单');
  for (const f of FOODS) {
    const item = { sid: 1, kind: 'food' as const, def: f.id, locked: false, free: false };
    eq(foodPrice(item), f.id === 'f_milk' ? 0 : (f.price ?? PRICE), `${f.id} 价格`);
  }
});

test('寿司在五个目标位置仅作用目标与实际相邻格', () => {
  for (let target = 0; target < 5; target++) {
    const r = fresh(10 + target);
    for (let i = 0; i < 5; i++) r.queue[i] = owned(100 + i);
    eat(r, 'f_sushi', target);
    for (let i = 0; i < 5; i++) {
      const expected = Math.abs(i - target) <= 1 ? 1 : 0;
      eq(r.queue[i]!.atkBonus, expected, `目标 ${target} / 格 ${i} 攻`);
      eq(r.queue[i]!.hpBonus, expected, `目标 ${target} / 格 ${i} 血`);
    }
  }
});

test('寿司遇空邻位不跳位，满队精确三人', () => {
  const gap = fresh();
  gap.queue[0] = owned(1); gap.queue[2] = owned(2); gap.queue[3] = owned(3); gap.queue[4] = owned(4);
  eat(gap, 'f_sushi', 0);
  deepEq(bonuses(gap), [[1, 1], null, [0, 0], [0, 0], [0, 0]], '队首右侧空位');
  const full = fresh();
  for (let i = 0; i < 5; i++) full.queue[i] = owned(10 + i);
  eat(full, 'f_sushi', 2);
  deepEq(bonuses(full), [[0, 0], [1, 1], [1, 1], [1, 1], [0, 0]], '满队中位目标');
});

test('寿司缺目标失败且不扣钱、不移货、不计食用', () => {
  const r = fresh(); r.queue[0] = owned(1);
  const item = addFood(r, 'f_sushi'); const gold = r.gold;
  const out = useFood(r, item.sid, null);
  deepEq(out, { ok: false, why: 'target' }, '缺目标结果');
  eq(r.gold, gold, '金币'); eq(r.shop.includes(item), true, '货架保留'); eq(r.tc.foods, 0, '食用计数');
});

test('寿司不写食用记录，也不消耗分享餐盘', () => {
  const r = fresh(); r.relics = ['r_share'];
  r.queue[0] = owned(1, 'v_guard'); r.queue[1] = owned(2, 'v_guard'); r.queue[2] = owned(3, 'v_guard');
  eat(r, 'f_sushi', 1);
  for (const o of r.queue.filter((x): x is Owned => !!x)) deepEq(o.foodHistory ?? [], [], `${o.oid} 食用记录`);
  eq(r.tc.shareUsed, false, '分享餐盘未消耗');
});

test('寿司广播只按真实食用人数触发霜狼', () => {
  const r = fresh();
  r.queue[0] = owned(1); r.queue[1] = owned(2); r.queue[2] = owned(3); r.queue[4] = owned(4, 'v_scout');
  eat(r, 'f_sushi', 0); // 仅 0、1 两人实际食用
  deepEq(bonuses(r), [[1, 2], [1, 2], [0, 0], null, [0, 0]], '两名食用者各收到一次霜狼额外生命');
});

test('寿司广播只让真实食用的守望者触发自身能力', () => {
  const r = fresh();
  r.queue[0] = owned(1); r.queue[1] = owned(2, 'v_keeper'); r.queue[2] = owned(3); r.queue[4] = owned(4, 'v_keeper');
  eat(r, 'f_sushi', 0); // 0、1 吃；队尾守望者不吃
  eq(r.tc.keeper?.[2], 1, '实际食用守望者触发一次');
  eq(r.tc.keeper?.[4] ?? 0, 0, '非食用守望者不触发');
});

test('寿司广播让白霜巨龙按真实两名食用者分发，不按全队', () => {
  const r = fresh();
  r.queue[0] = owned(1); r.queue[1] = owned(2); r.queue[2] = owned(3, 'v_wyvern'); r.queue[3] = owned(4); r.queue[4] = owned(5);
  eat(r, 'f_sushi', 0); // 0、1 食用；巨龙分别向 1、3 分发一次
  deepEq(bonuses(r), [[1, 1], [2, 2], [0, 0], [1, 1], [0, 0]], '巨龙分发结果');
});

test('龙肉只喂目标和紧邻身后，队尾与空身后均不跳位', () => {
  const tail = fresh(); tail.queue[0] = owned(1); tail.queue[4] = owned(2);
  eat(tail, 'f_dragon', 4);
  deepEq(bonuses(tail), [[0, 0], null, null, null, [2, 2]], '队尾');
  const gap = fresh(); gap.queue[1] = owned(3); gap.queue[3] = owned(4);
  eat(gap, 'f_dragon', 1);
  deepEq(bonuses(gap), [null, [2, 2], null, [0, 0], null], '空身后');
});

test('小范围食品不进入传承，白名单单体食品仍记录', () => {
  for (const id of ['f_stew', 'f_sushi', 'f_dragon']) {
    const r = fresh(); r.queue[1] = owned(1, 'v_guard'); r.queue[2] = owned(2);
    eat(r, id, 1);
    deepEq(r.queue[1]!.foodHistory ?? [], [], `${id} 不记录`);
  }
  for (const id of INHERIT_FOODS) {
    const r = fresh(); r.queue[0] = owned(1, 'v_guard');
    eat(r, id, 0, id === 'f_milk' ? [1, 1] : undefined);
    eq(r.queue[0]!.foodHistory?.length, 1, `${id} 仍记录`);
  }
});

test('历史 5/5 与新 3/3 烤全羊按原记录出售重吃', () => {
  const r = fresh();
  const donor = owned(1, 'v_guard');
  donor.foodHistory = [
    { id: 'f_roast', atk: 5, hp: 5, sourceId: 8001 },
    { id: 'f_roast', atk: 3, hp: 3, sourceId: 8002 },
  ];
  r.queue[0] = donor; r.queue[1] = owned(2, 'v_guard');
  sell(r, 0);
  deepEq([r.queue[1]!.atkBonus, r.queue[1]!.hpBonus], [10, 10], '含甲虫两次额外 +1/+1 后的重吃结果');
});

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.get(k) ?? null; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
}

test('新旧存档往返不复制食用记录，迁移只执行一次', () => {
  const storage = new MemoryStorage(); globalThis.localStorage = storage;
  const base = fresh(); const o = owned(1, 'v_guard');
  o.foodHistory = [{ id: 'f_roast', atk: 5, hp: 5, sourceId: 91 }, { id: 'f_roast', atk: 3, hp: 3, sourceId: 92 }];
  base.queue[0] = o; base.supplyVersion = SUPPLY_VERSION;
  save(base); const once = load(); if (!once) throw new Error('新档首次读取失败');
  save(once); const twice = load(); if (!twice) throw new Error('新档二次读取失败');
  deepEq(twice.queue[0]?.foodHistory, o.foodHistory, '新档两次往返');

  const legacy = structuredClone(base); delete legacy.supplyVersion;
  storage.clear(); storage.setItem(SAVE_KEY, JSON.stringify(legacy));
  const migrated = load(); if (!migrated) throw new Error('旧档迁移失败');
  eq(migrated.supplyVersion, SUPPLY_VERSION, '迁移版本');
  save(migrated); const migratedAgain = load(); if (!migratedAgain) throw new Error('迁移后二次读取失败');
  deepEq(migratedAgain.queue[0]?.foodHistory, o.foodHistory, '旧档只迁移一次且不复制');
});

const raisedStats: Record<string, [number, number]> = {
  l_caliber:[7,11], l_knight:[7,9], l_storm:[9,11], l_archon:[7,8],
  s_hunter:[7,7], s_viper:[10,6], s_master:[6,9], s_lord:[12,7],
  a_chanter:[5,8], a_cult:[7,7], a_engulf:[7,9], a_matriarch:[8,10], a_nightmare:[7,14],
  m_rex:[3,5], m_bloodcaller:[6,8], m_mankator:[8,6], m_titan:[9,9], m_heart:[9,12],
  v_keeper:[4,8], v_sentinel:[6,8], v_bear:[7,10], v_rhyno:[7,8], v_queen:[7,9], v_wyvern:[8,11],
  d_dunecaster:[7,7], d_hourglass:[4,7], d_goldob:[4,8], d_pharaoh:[7,7], d_onyx:[8,11], d_worm:[9,16],
};

test('30 张 4—6 阶商店卡数据与实际购买、合并、升星身材一致', () => {
  eq(Object.keys(raisedStats).length, 30, '卡数');
  for (const [id, stats] of Object.entries(raisedStats)) {
    deepEq([CARD[id].atk, CARD[id].hp], stats, `${id} 数据`);
    const r = fresh();
    for (let copy = 1; copy <= 6; copy++) {
      const item: ShopItem = { sid: r.nextId++, kind: 'unit', def: id, locked: false, free: false };
      r.shop.push(item);
      const out = buy(r, item.sid, 0);
      if (!out.ok) throw new Error(`${id} 第 ${copy} 份购买失败: ${out.why}`);
      const o = r.queue[0]!;
      eq(o.copies, copy, `${id} 份数`);
      eq(lvlOf(o.copies), copy >= 6 ? 3 : copy >= 3 ? 2 : 1, `${id} 星级`);
      eq(ownedAtk(o), stats[0] + copy - 1, `${id} 第 ${copy} 份攻击`);
      eq(ownedHp(o), stats[1] + copy - 1, `${id} 第 ${copy} 份生命`);
    }
  }
});

test('灯笼狐与构装学徒三档数值及真实行为为 1/2/3', () => {
  deepEq(card('s_fox').v, [1, 2, 3], '灯笼狐数值');
  deepEq(card('d_artificer').v, [1, 2, 3], '构装学徒数值');
  for (const [copies, gain] of [[1,1], [3,2], [6,3]] as const) {
    const foxRun = fresh(); foxRun.queue[0] = owned(1, 's_fox', copies); foxRun.queue[1] = owned(2);
    endTurn(foxRun); eq(foxRun.queue[1]!.atkBonus, gain, `狐 ${copies} 份`);
    const artRun = fresh(50 + copies); artRun.queue[0] = owned(3, 'd_artificer', copies); artRun.queue[1] = owned(4);
    sell(artRun, 0); deepEq([artRun.queue[1]!.atkBonus, artRun.queue[1]!.hpBonus], [gain, gain], `学徒 ${copies} 份`);
  }
});

test('显式 UnitSpec 身材不再叠加卡牌 base，固定 token 身材不变', () => {
  const explicit: UnitSpec[] = [{ def: 'l_archon', lvl: 3, atk: 17, hp: 19 }];
  const tokens: UnitSpec[] = [{ def: 't_wisp', lvl: 1, atk: 1, hp: 1 }, { def: 't_bonelet', lvl: 1, atk: 2, hp: 2 }];
  const out = simulate([...explicit, ...tokens], [{ def: 'v_guard', lvl: 1, atk: 1, hp: 50 }], 7);
  deepEq(out.init.slice(0, 3).map((u) => [u.def, u.atk, u.hp]), [['l_archon',17,19], ['t_wisp',1,1], ['t_bonelet',2,2]], '开战初始身材');
});

test('随机 6 阶召唤使用新 base 加星级增量且不二次叠加', () => {
  const out = simulate(
    [{ def: 'm_titan', lvl: 3, atk: 1, hp: 1 }],
    [{ def: 'v_guard', lvl: 1, atk: 50, hp: 50 }],
    12345,
  );
  const ev = out.events.find((e) => e.t === 'summon' && e.src !== null);
  if (!ev || ev.t !== 'summon') throw new Error('未观察到熔岩巨像随机召唤');
  const d = card(ev.unit.def);
  eq(d.tier, 6, '召唤阶级'); eq(ev.unit.lvl, 3, '召唤星级');
  eq(ev.unit.atk, d.atk + 5, '召唤攻击只加一次三星增量');
  eq(ev.unit.hp, d.hp + 5, '召唤生命只加一次三星增量');
});

const report = {
  generatedAt: new Date().toISOString(),
  passed: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  results,
};
mkdirSync(new URL('../../output/targeting-v3/', import.meta.url), { recursive: true });
writeFileSync(new URL('../../output/targeting-v3/verification.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.failed) (globalThis as any).process.exitCode = 1;
