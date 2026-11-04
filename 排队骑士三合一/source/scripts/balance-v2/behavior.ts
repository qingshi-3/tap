import { FOOD } from '../../src/core/data';
import {
  FOOD_SHOP_MAX, SAVE_KEY, load, moveOwned, newRun, prepFoodUses, save, sell, settleBattle, trialFight, useFood,
  type Owned, type RunState, type ShopItem,
} from '../../src/core/run';

const checks: string[] = [];
function ok(value: unknown, label: string): asserts value {
  if (!value) throw new Error(label);
  checks.push(label);
}
const unit = (oid: number, def: string, copies = 1): Owned => ({ oid, def, copies, atkBonus: 0, hpBonus: 0 });
const fresh = (seed = 1) => {
  const r = newRun(seed);
  r.gold = 99;
  r.queue.fill(null);
  r.shop = [];
  r.tc = { foods: 0, bought: 0, bear: {}, keeper: {}, shareUsed: false };
  return r;
};
function food(r: RunState, def = 'f_bread', val?: [number, number]) {
  const s: ShopItem = { sid: r.nextId++, kind: 'food', def, locked: false, free: def === 'f_milk', val };
  r.shop.push(s);
  return s;
}
function eat(r: RunState, def: string, slot: number | null, val?: [number, number]) {
  const s = food(r, def, val);
  const out = useFood(r, s.sid, slot);
  ok(out.ok, `食用 ${def}`);
  return out;
}

// 寒冬：星级限次、空邻位不耗、奶/寿司也计数、封顶不额外循环。
for (const [copies, max] of [[1, 2], [3, 3], [6, 3]] as const) {
  const r = fresh(copies);
  const keeper = unit(10, 'v_keeper', copies);
  const neighbor = unit(11, 'v_guard');
  r.queue[1] = keeper; r.queue[2] = neighbor;
  for (let i = 0; i < max + 2; i++) eat(r, 'f_bread', 1);
  ok(prepFoodUses(r, keeper)?.used === max, `寒冬 ${copies} 份限 ${max} 次`);
  const perUse = copies >= 6 ? 2 : 1;
  ok(neighbor.atkBonus === max * perUse && neighbor.hpBonus === max * perUse, `寒冬 ${copies} 份收益不越限`);
}
{
  const r = fresh(); const keeper = unit(20, 'v_keeper'); r.queue[2] = keeper;
  eat(r, 'f_bread', 2);
  ok(prepFoodUses(r, keeper)?.used === 0, '寒冬无相邻目标不耗次数');
  const capped = unit(21, 'v_guard', 1); capped.atkBonus = 49; capped.hpBonus = 47; r.queue[3] = capped;
  eat(r, 'f_milk', 2, [1, 1]);
  eat(r, 'f_sushi', 2);
  ok(prepFoodUses(r, keeper)?.used === 2, '牛奶与寿司各占一次且封顶不重复触发');
}

// 直接吃与传承重吃共限；法老按自己的 oid/星级记录。
{
  const r = fresh();
  const receiver = unit(30, 'v_keeper'); const neighbor = unit(31, 'v_guard');
  const donor = unit(32, 'v_guard');
  donor.foodHistory = [1, 2, 3].map((sourceId) => ({ id: 'f_bread', atk: 1, hp: 1, sourceId }));
  r.queue[1] = receiver; r.queue[2] = neighbor; r.queue[0] = donor;
  eat(r, 'f_bread', 1); sell(r, 0);
  ok(prepFoodUses(r, receiver)?.used === 2 && neighbor.atkBonus === 2, '直接吃与传承重吃共用寒冬上限');
  const pharaoh = unit(33, 'd_pharaoh', 3); pharaoh.copy = 'v_keeper'; r.queue[3] = pharaoh;
  eat(r, 'f_bread', 3); eat(r, 'f_bread', 3); eat(r, 'f_bread', 3);
  ok(prepFoodUses(r, pharaoh)?.used === 3 && r.tc.keeper?.[33] === 3, '法老按自身星级与 oid 计数');
}

// 合并相加，升星不重置；保存往返、旧档迁移、非法计数与新回合。
{
  const r = fresh(); const a = unit(40, 'v_keeper'); const b = unit(41, 'v_keeper', 2);
  r.queue[0] = a; r.queue[1] = b; r.tc.keeper = { 40: 1, 41: 1 };
  const m = moveOwned(r, 0, 1);
  ok(m?.merged && prepFoodUses(r, b)?.used === 2 && b.copies === 3, '合并次数相加且升星不重置');
  const memory = new Map<string, string>();
  globalThis.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, v); }, removeItem: (k) => { memory.delete(k); }, clear: () => memory.clear(), key: (i) => [...memory.keys()][i] ?? null, get length() { return memory.size; } };
  save(r); ok(load()?.tc.keeper?.[41] === 2, '寒冬次数保存往返保留');
  const legacy = structuredClone(r); delete legacy.tc.keeper; legacy.tc.foods = 1; memory.set(SAVE_KEY, JSON.stringify(legacy));
  ok(load()?.tc.keeper?.[41] === 3, '旧档有食用记录时保守耗尽寒冬次数');
  const bad = structuredClone(r); bad.tc.keeper = { 41: -1 }; memory.set(SAVE_KEY, JSON.stringify(bad));
  ok(load() === null, '非法寒冬计数拒绝载入');
  r.enemy = { boss: null, units: [] }; settleBattle(r, { result: 'draw', perm: {} });
  ok(Object.keys(r.tc.keeper ?? {}).length === 0, '新回合清空寒冬次数');
}

// 巨熊：每星均两次；非牛奶购买才触发；只补空位，总槽上限，补货阶级与锁定保留。
for (const [copies, floor] of [[1, 1], [3, 3], [6, 5]] as const) {
  const r = fresh(100 + copies); r.turn = 12;
  const bear = unit(50, 'v_bear', copies); r.queue[0] = bear;
  const locked = food(r, 'f_bread'); locked.locked = true;
  eat(r, 'f_milk', 0, [1, 1]);
  ok(prepFoodUses(r, bear)?.used === 0, `巨熊 ${copies} 份免费奶不触发`);
  for (let i = 0; i < 3; i++) {
    const purchasable = r.shop.find((s) => s.kind === 'food' && s !== locked) ?? food(r, 'f_bread');
    ok(useFood(r, purchasable.sid, 0).ok, `巨熊 ${copies} 份购买补给 ${i + 1}`);
  }
  const restocked = r.shop.filter((s) => s.kind === 'food' && s !== locked);
  ok(prepFoodUses(r, bear)?.used === 2, `巨熊 ${copies} 份每回合固定两次`);
  ok(restocked.every((s) => FOOD[s.def].tier >= floor), `巨熊 ${copies} 份补货最低 ${floor} 阶`);
  ok(r.shop.includes(locked) && locked.locked, '巨熊补货不改锁定商品');
  ok(r.shop.filter((s) => s.kind === 'food').length <= FOOD_SHOP_MAX, '巨熊补货不超过四个总槽');
}
{
  const r = fresh(); const bear = unit(60, 'v_bear'); r.queue[0] = bear;
  food(r, 'f_bread'); food(r, 'f_whet');
  const purchased = r.shop[0]; useFood(r, purchased.sid, 0);
  ok(prepFoodUses(r, bear)?.used === 0, '普通补给位无空格时巨熊不耗次数');
  const donor = unit(61, 'v_guard'); donor.foodHistory = [{ id: 'f_bread', atk: 1, hp: 1, sourceId: 999 }]; r.queue[1] = donor;
  sell(r, 1); ok(prepFoodUses(r, bear)?.used === 0, '传承重吃不触发巨熊');
  r.queue[1] = unit(62, 'v_bear'); r.tc.bear = { 60: 1, 62: 1 }; moveOwned(r, 1, 0);
  ok(r.tc.bear[60] === 2, '巨熊合并次数相加防重置');
}

// 公开生成路径性质检查：找到精英岔路，词缀与形态保留，试打不能改写已展示敌阵。
{
  let found: RunState | null = null;
  for (let seed = 1; seed < 500 && !found; seed++) {
    const r = newRun(seed); r.queue = [unit(70, 'd_onyx', 6), unit(71, 'v_queen', 6), unit(72, 'l_archon', 6), null, null];
    for (const o of r.queue) if (o) { o.atkBonus = 40; o.hpBonus = 40; }
    r.enemy = { boss: null, units: [] }; settleBattle(r, { result: 'win', perm: {} });
    r.enemy = { boss: null, units: [] }; settleBattle(r, { result: 'win', perm: {} });
    if (r.branch?.some((e) => e.elite?.length && e.form && e.units.every((u) => u.ax?.length))) found = r;
  }
  ok(found, '确定种子可生成带词缀且保留形态的精英');
  const elite = found.branch!.find((e) => e.elite?.length)!; found.enemy = elite;
  const shown = JSON.stringify(found.enemy); trialFight(found);
  ok(JSON.stringify(found.enemy) === shown, '试打不改写已展示精英阵容');
}

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
