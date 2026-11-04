// @ts-ignore Node built-in, this script runs only in vite-node.
import { mkdirSync, writeFileSync } from 'node:fs';
// @ts-ignore Node built-in, this script runs only in vite-node.
import { dirname } from 'node:path';
// @ts-ignore Node built-in, this script runs only in vite-node.
import { fileURLToPath } from 'node:url';
import { FOOD, FOOD_POOL } from '../../src/core/data';
import {
  SAVE_KEY, load, moveOwned, newRun, ownedAtk, ownedHp, prepFoodUses, reroll, sell, useFood,
  type Owned, type RunState,
} from '../../src/core/run';

let checks = 0;
const results: { name: string; detail?: unknown }[] = [];
function ok(value: unknown, name: string, detail?: unknown) {
  checks++;
  if (!value) throw new Error(`${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
  results.push({ name, detail });
}
const unit = (def: string, oid: number, copies = 1): Owned => ({ def, oid, copies, atkBonus: 0, hpBonus: 0, foodHistory: [] });
function fixture() {
  const r = newRun(440041); r.gold = 100; r.nextId = 500; r.shop = []; r.relics = [];
  r.queue = [unit('d_artificer', 101), unit('d_artificer', 102), unit('d_artificer', 103), null, null];
  return r;
}
function putFood(r: RunState, def: string, val?: [number, number]) {
  const sid = r.nextId++;
  r.shop.push({ sid, kind: 'food', def, locked: false, free: false, val });
  return sid;
}
function eat(r: RunState, def: string, slot: number | null, val?: [number, number]) {
  return useFood(r, putFood(r, def, val), slot);
}
const foodStats = (o: Owned) => [ownedAtk(o) + (o.tmpAtk ?? 0), ownedHp(o) + (o.tmpHp ?? 0)];

// 分享餐盘：只接受冻结的五件纯单体攻血补给；其他补给不消耗本回合份额。
const shareFoods = ['f_bread', 'f_whet', 'f_roast', 'f_milk', 'f_drum'];
for (const id of shareFoods) {
  const r = fixture(); r.relics = ['r_share'];
  const before = r.queue.slice(0, 3).map((o) => foodStats(o!));
  const res = eat(r, id, 1, id === 'f_milk' ? [2, 1] : undefined);
  ok(res.ok && r.tc.shareUsed === true, `餐盘接受 ${id}`);
  ok(r.queue.slice(0, 3).every((o, i) => foodStats(o!)[0] > before[i][0] || foodStats(o!)[1] > before[i][1]), `餐盘共享 ${id}`);
}
for (const f of FOOD_POOL.filter((x) => !shareFoods.includes(x.id))) {
  const r = fixture(); r.relics = ['r_share'];
  ok(eat(r, f.id, f.id === 'f_can' ? null : 1).ok, `使用非餐盘补给 ${f.id}`);
  ok(r.tc.shareUsed === false, `非餐盘补给不耗份额 ${f.id}`);
  const left = [ownedAtk(r.queue[0]!), ownedHp(r.queue[0]!)];
  ok(eat(r, 'f_bread', 1).ok && r.tc.shareUsed === true, `非餐盘后仍可共享 ${f.id}`);
  ok(ownedAtk(r.queue[0]!) > left[0] || ownedHp(r.queue[0]!) > left[1], `非餐盘后面包确实共享 ${f.id}`);
}

// 巨熊：全队共同两次，按购买时在场最高星级返金，同星取队列前位。
for (const [copies, refund] of [[1, 1], [3, 2], [6, 3]] as const) {
  const r = fixture(); r.queue[0] = unit('v_bear', 201, copies);
  const before = r.gold, res = eat(r, 'f_bread', 1);
  ok(res.ok && r.gold === before - 3 + refund, `巨熊 ${copies}份返${refund}金`, { gold: r.gold, fx: res.ok ? res.fx : [] });
  ok(res.ok && res.fx.some((x) => x.kind === 'gold' && x.src === 201 && x.n === refund), `巨熊 ${copies}份金币反馈`);
}
{
  const r = fixture(); r.queue = [unit('v_bear', 210, 3), unit('v_bear', 211, 6), unit('v_bear', 212, 6), null, null];
  const first = eat(r, 'f_bread', 0), second = eat(r, 'f_bread', 0), thirdGold = r.gold;
  eat(r, 'f_bread', 0);
  ok(first.ok && first.fx.some((x) => x.kind === 'gold' && x.src === 211), '最高星且同星前位提供返金');
  ok(second.ok && (r.tc.bearRefunds === 2) && r.gold === thirdGold - 3, '全队仅前两次返金');
  ok(prepFoodUses(r, r.queue[0]!)?.used === 2 && prepFoodUses(r, r.queue[1]!)?.max === 2, '所有巨熊显示共同额度');
}
{
  const r = fixture(); const before = r.gold;
  eat(r, 'f_bread', 0); r.queue[0] = unit('v_bear', 220, 6); const afterNoBear = r.gold;
  eat(r, 'f_bread', 1);
  ok(afterNoBear === before - 3 && r.tc.bearRefunds === 1, '无熊购买不消耗额度');
}
{
  const r = fixture(); r.queue[0] = unit('v_bear', 230, 6); const before = r.gold;
  eat(r, 'f_milk', 1, [2, 2]);
  ok(r.gold === before && r.tc.bearRefunds === 0, '免费牛奶不返金不耗额度');
  const donor = unit('v_guard', 231); donor.foodHistory = [{ id: 'f_bread', atk: 1, hp: 1, sourceId: 999 }]; r.queue[1] = donor;
  sell(r, 1);
  ok(r.gold === before + 1 && r.tc.bearRefunds === 0, '传承重吃不触发返金');
}
{
  const r = fixture(); r.queue = [unit('v_bear', 240, 1), unit('v_bear', 241, 1), unit('d_artificer', 242), null, null];
  eat(r, 'f_bread', 2); moveOwned(r, 1, 0); eat(r, 'f_bread', 2); const beforeThird = r.gold; eat(r, 'f_bread', 2);
  ok(r.tc.bearRefunds === 2 && r.gold === beforeThird - 3, '巨熊合并不重置共同额度');
}
{
  const r = fixture(); r.queue[0] = unit('v_bear', 250, 6);
  const oldPrice = FOOD.f_bread.price; FOOD.f_bread.price = 1;
  try {
    const before = r.gold, res = eat(r, 'f_bread', 1);
    ok(res.ok && r.gold === before && res.fx.some((x) => x.kind === 'gold' && x.n === 1), '返金不超过实际支付');
  } finally { FOOD.f_bread.price = oldPrice; }
}

// 旧档缺少新计数时，已吃过补给则保守耗尽；本回合未吃则保留两次。
{
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  } });
  for (const foods of [0, 1]) {
    const r = fixture(); r.tc.foods = foods; delete r.tc.bearRefunds; store.set(SAVE_KEY, JSON.stringify(r));
    ok(load()?.tc.bearRefunds === (foods ? 2 : 0), `旧档返金额度迁移 foods=${foods}`);
  }
}

// 抽样：12回合解锁池按单品 rollWeight 抽取，不再叠加阶级权重。
{
  const r = newRun(440099); r.turn = 12; r.shop = []; r.gold = 1_000_000;
  const counts = Object.fromEntries(FOOD_POOL.map((f) => [f.id, 0])) as Record<string, number>;
  const samples = 200_000;
  for (let i = 0; i < samples / 2; i++) {
    reroll(r); r.gold = 1_000_000;
    for (const s of r.shop) if (s.kind === 'food' && s.def !== 'f_milk') counts[s.def]++;
  }
  const totalWeight = FOOD_POOL.reduce((n, f) => n + (f.rollWeight ?? 1), 0);
  const deviations = FOOD_POOL.map((f) => {
    const expected = (f.rollWeight ?? 1) / totalWeight;
    const observed = counts[f.id] / samples;
    return { id: f.id, weight: f.rollWeight ?? 1, expected, observed, delta: observed - expected };
  });
  // 生产 RNG 为轻量确定性发生器；此处用宽于独立随机置信区间的门限抓取数量级/漏乘权重错误。
  ok(deviations.every((x) => Math.abs(x.delta) < 0.008), '补给单品权重抽样符合配置', deviations);
  const specials = ['f_lamp', 'f_oil', 'f_undy'];
  ok(specials.every((id) => FOOD[id].rollWeight === 0.5), '三件强战斗补给精确权重为0.5');
}

const output = { checks, results };
const out = fileURLToPath(new URL('../../output/supply-v4/verification.json', import.meta.url));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(output, null, 2)}\n`);
console.log(`SUPPLY_V4_OK ${checks} assertions`);
