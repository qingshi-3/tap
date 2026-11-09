// 补给流专项机制回归。严格按产品契约断言；失败时仍写出报告，随后以非零退出。
// @ts-ignore node 内置模块，仅由 vite-node 执行
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CARDS, FOOD, card } from '../../src/core/data';
import {
  FOOD_HISTORY_MAX,
  SAVE_KEY,
  STAT_CAP,
  buy,
  endTurn,
  grantPrepMilk,
  load,
  moveOwned,
  newRun,
  ownedAtk,
  ownedHp,
  reroll,
  save,
  sell,
  settleBattle,
  toggleLock,
  useFood,
  type FoodMemory,
  type Owned,
  type RunState,
  type ShopItem,
} from '../../src/core/run';

type Check = { id: string; status: 'pass' | 'fail'; expected: unknown; observed: unknown; note?: string };
const checks: Check[] = [];
const extremes: unknown[] = [];
const j = (x: unknown) => JSON.stringify(x);
function check(id: string, expected: unknown, run: () => unknown, note?: string) {
  try {
    const observed = run();
    checks.push({ id, status: j(observed) === j(expected) ? 'pass' : 'fail', expected, observed, note });
  } catch (e) {
    checks.push({ id, status: 'fail', expected, observed: `threw: ${e instanceof Error ? e.message : String(e)}`, note });
  }
}
const copies = (lv: number) => [1, 3, 6][lv - 1];
const unit = (def: string, lv = 1, oid = 1, history: FoodMemory[] = []): Owned =>
  ({ oid, def, copies: copies(lv), atkBonus: 0, hpBonus: 0, foodHistory: history });
function runState(): RunState {
  const r = newRun(24681357, { diff: 0 });
  r.gold = 999;
  r.turn = 3;
  r.queue = Array(5).fill(null);
  r.shop = [];
  r.nextId = 1000;
  r.tc = { foods: 0, bought: 0, bear: {} };
  r.relics = [];
  r.milkTurn = undefined;
  return r;
}
function food(r: RunState, def: string, val?: [number, number]) {
  const s: ShopItem = { sid: r.nextId++, kind: 'food', def, locked: false, free: def === 'f_milk', val };
  r.shop.push(s);
  return s;
}
function unitShop(r: RunState, def: string) {
  const s: ShopItem = { sid: r.nextId++, kind: 'unit', def, locked: false, free: false };
  r.shop.push(s);
  return s;
}
const stats = (o: Owned) => [ownedAtk(o), ownedHp(o)];
const hist = (o: Owned | null) => (o?.foodHistory ?? []).map((x) => [x.id, x.atk, x.hp, x.sourceId]);
const milk = (r: RunState) => r.shop.filter((s) => s.kind === 'food' && s.def === 'f_milk');
const foods = (r: RunState) => r.shop.filter((s) => s.kind === 'food');

// 数据契约：只有 10 张补给流卡拥有继承标记，且新基础身材精确。
const inheritors = ['v_guard', 'v_snowman', 'v_scout', 'v_mage', 'v_keeper', 'v_sentinel', 'v_bear', 'v_rhyno', 'v_queen', 'v_wyvern'];
check('data.inherit.exact-ten', inheritors, () => CARDS.filter((c) => c.inherit).map((c) => c.id));
check('data.scout-mage.base-stats', [[3, 4], [3, 4]], () => ['v_scout', 'v_mage'].map((id) => [card(id).atk, card(id).hp]));
check('data.history-cap', 5, () => FOOD_HISTORY_MAX);

// 记录白名单、排除项、最早 5 件不替换；sourceId 是原 ShopItem.sid。
check('history.whitelist-and-first-five', [
  ['f_bread', 1, 1, 1000], ['f_whet', 3, 1, 1001], ['f_roast', 5, 5, 1002], ['f_milk', 2, 3, 1003], ['f_bread', 1, 1, 1004],
], () => {
  const r = runState(); const o = unit('v_guard'); r.queue[0] = o;
  for (const [id, val] of [['f_bread'], ['f_whet'], ['f_roast'], ['f_milk', [2, 3]], ['f_bread'], ['f_roast']] as [string, [number, number]?][]) {
    const s = food(r, id, val); useFood(r, s.sid, 0);
  }
  return hist(o);
});
check('history.exclusions-all', [], () => {
  const r = runState(); const o = unit('v_guard'); r.queue[0] = o;
  for (const id of Object.keys(FOOD).filter((id) => !['f_bread', 'f_whet', 'f_roast', 'f_milk'].includes(id))) {
    const s = food(r, id); useFood(r, s.sid, FOOD[id].n ? null : 0);
  }
  return hist(o);
}, '炖锅、寿司、龙肉及全部战斗特效/升星/罐头都不得记录');
check('history.share-extra-eaters-not-recorded', [0, 1, 0], () => {
  const r = runState(); r.relics = ['r_share'];
  r.queue[0] = unit('v_guard', 1, 1); r.queue[1] = unit('v_mage', 1, 2); r.queue[2] = unit('v_keeper', 1, 3);
  const s = food(r, 'f_bread'); useFood(r, s.sid, 1);
  return r.queue.slice(0, 3).map((o) => o?.foodHistory?.length ?? 0);
});

// 炖锅改为指定格与紧邻后一格，不能跳空；只作用实际存在的合法目标。
check('stew.target-and-next', [[2, 2], [2, 2], [0, 0]], () => {
  const r = runState(); r.queue[0] = unit('l_shield', 1, 1); r.queue[1] = unit('l_shield', 1, 2); r.queue[3] = unit('l_shield', 1, 3);
  const before = r.queue.map((o) => o ? stats(o) : null); const s = food(r, 'f_stew'); useFood(r, s.sid, 0);
  return [0, 1, 3].map((i) => [ownedAtk(r.queue[i]!) - before[i]![0], ownedHp(r.queue[i]!) - before[i]![1]]);
});
check('stew.missing-next-feeds-primary-once', { ok: true, stats: [2, 2], foods: 1, consumed: true }, () => {
  const r = runState(); r.queue[0] = unit('l_shield'); const before = stats(r.queue[0]); const s = food(r, 'f_stew'); const out = useFood(r, s.sid, 0);
  return { ok: out.ok, stats: [ownedAtk(r.queue[0]) - before[0], ownedHp(r.queue[0]) - before[1]], foods: r.tc.foods, consumed: !r.shop.some((x) => x.sid === s.sid) };
});
check('stew.missing-primary-atomic-failure', { ok: false, foods: 0, consumed: false, neighbor: [0, 0] }, () => {
  const r = runState(); r.queue[1] = unit('l_shield'); const before = stats(r.queue[1]); const s = food(r, 'f_stew'); const out = useFood(r, s.sid, 0);
  return { ok: out.ok, foods: r.tc.foods, consumed: !r.shop.some((x) => x.sid === s.sid), neighbor: [ownedAtk(r.queue[1]) - before[0], ownedHp(r.queue[1]) - before[1]] };
});

// 新触发：瓢虫永久；守望者与白龙只看物理相邻槽，不能跨 gap。
for (const lv of [1, 2, 3]) check(`ladybug.permanent.lv${lv}`, [lv, lv, 0, 0], () => {
  const r = runState(); const o = unit('v_guard', lv); r.queue[0] = o; const s = food(r, 'f_bomb'); useFood(r, s.sid, 0);
  return [o.atkBonus, o.hpBonus, o.tmpAtk ?? 0, o.tmpHp ?? 0];
});
for (const lv of [1, 2, 3]) check(`keeper.adjacent.lv${lv}`, lv === 3 ? [[2, 2], [2, 2]] : [[1, 1], [1, 1]], () => {
  const r = runState(); r.queue[1] = unit('l_shield', 1, 11); r.queue[2] = unit('v_keeper', lv, 12); r.queue[3] = unit('l_shield', 1, 13);
  const b = [stats(r.queue[1]!), stats(r.queue[3]!)]; const s = food(r, 'f_bread'); useFood(r, s.sid, 2);
  return [1, 3].map((i, k) => [ownedAtk(r.queue[i]!) - b[k][0], ownedHp(r.queue[i]!) - b[k][1]]);
});
check('keeper.no-gap-jump-and-edges', [0, 1, 1], () => {
  const r = runState(); r.queue[0] = unit('v_keeper', 1, 1); r.queue[1] = unit('l_shield', 1, 2); r.queue[3] = unit('l_shield', 1, 3);
  let s = food(r, 'f_bread'); useFood(r, s.sid, 0); const near = r.queue[1]!.atkBonus; const far = r.queue[3]!.atkBonus;
  r.queue = [unit('l_shield', 1, 4), unit('v_keeper', 1, 5), null, null, null]; s = food(r, 'f_bread'); useFood(r, s.sid, 1);
  return [far, near, r.queue[0]!.atkBonus];
});
check('wyvern.front-first-no-gap-no-recursion', { front: [1, 1], rear: [0, 0], foods: 1 }, () => {
  const r = runState(); r.queue[0] = unit('l_shield', 1, 1); r.queue[1] = unit('l_shield', 1, 2); r.queue[2] = unit('v_wyvern', 3, 3); r.queue[3] = unit('l_shield', 1, 4); r.queue[4] = null;
  const s = food(r, 'f_whet'); useFood(r, s.sid, 3);
  return { front: [r.queue[1]!.atkBonus, r.queue[1]!.hpBonus], rear: [r.queue[0]!.atkBonus, r.queue[0]!.hpBonus], foods: r.tc.foods };
}, '3星最多2人，但 eater 前邻是白龙需排除；不得越过白龙再找更远目标');

// 合并：接收方历史优先，追加来方，按 sourceId 去重后截前 5；合并本身不重吃。
check('history.merge-order-dedupe-cap', [10, 11, 12, 13, 14], () => {
  const m = (sourceId: number): FoodMemory => ({ id: 'f_bread', atk: 1, hp: 1, sourceId });
  const r = runState(); r.queue[0] = unit('v_guard', 1, 1, [m(13), m(14), m(15)]); r.queue[1] = unit('v_guard', 1, 2, [m(10), m(11), m(12), m(13)]);
  moveOwned(r, 0, 1); return r.queue[1]!.foodHistory!.map((x) => x.sourceId);
});
check('history.merge-no-replay-and-level-up', { copies: 6, bonus: [0, 0], history: [32, 31] }, () => {
  const m = (sourceId: number): FoodMemory => ({ id: 'f_roast', atk: 5, hp: 5, sourceId });
  const r = runState(); r.queue[0] = { ...unit('v_guard', 2, 1, [m(31)]), copies: 3 }; r.queue[1] = { ...unit('v_guard', 2, 2, [m(32)]), copies: 3 };
  moveOwned(r, 0, 1); const o = r.queue[1]!; return { copies: o.copies, bonus: [o.atkBonus, o.hpBonus], history: o.foodHistory!.map((x) => x.sourceId) };
});

// 出售继承：先捕获最近身后，否则最近身前；按记录基础值重吃，不新增记录/计数/补货。
check('sale.target-behind-nearest-across-gap', { target: [1, 1], other: [0, 0], history: 0, foods: 0 }, () => {
  const r = runState(); r.queue[0] = unit('v_guard', 1, 1, [{ id: 'f_bread', atk: 1, hp: 1, sourceId: 7 }]); r.queue[2] = unit('l_shield', 1, 2); r.queue[4] = unit('l_shield', 1, 3);
  const b2 = stats(r.queue[2]!); const b4 = stats(r.queue[4]!); sell(r, 0);
  return { target: [ownedAtk(r.queue[2]!) - b2[0], ownedHp(r.queue[2]!) - b2[1]], other: [ownedAtk(r.queue[4]!) - b4[0], ownedHp(r.queue[4]!) - b4[1]], history: r.queue[2]!.foodHistory?.length ?? 0, foods: r.tc.foods };
}, '面包基础+1/+1，目标若为普通单位只得到一次；这里预期值包含实际+1/+1，若 observed 2/2 即重复触发');
check('sale.target-front-fallback', [1, 1], () => {
  const r = runState(); r.queue[0] = unit('l_shield'); r.queue[3] = unit('v_guard', 1, 2, [{ id: 'f_bread', atk: 1, hp: 1, sourceId: 8 }]); const b = stats(r.queue[0]); sell(r, 3);
  return [ownedAtk(r.queue[0]) - b[0], ownedHp(r.queue[0]) - b[1]];
});
check('sale.no-receiver-safe', { removed: true, foods: 0 }, () => {
  const r = runState(); r.queue[2] = unit('v_guard', 1, 1, [{ id: 'f_roast', atk: 5, hp: 5, sourceId: 1 }]); sell(r, 2);
  return { removed: r.queue[2] === null, foods: r.tc.foods };
});
check('sale.continuous-chain-bounded', { final: [1, 1], histories: 0, foods: 0 }, () => {
  const r = runState(); const m: FoodMemory = { id: 'f_bread', atk: 1, hp: 1, sourceId: 41 };
  r.queue[0] = unit('v_guard', 1, 1, [m]); r.queue[1] = unit('v_mage', 1, 2, [m]); r.queue[2] = unit('l_shield', 1, 3);
  sell(r, 0); sell(r, 1); return { final: [r.queue[2]!.atkBonus, r.queue[2]!.hpBonus], histories: r.queue[2]!.foodHistory?.length ?? 0, foods: r.tc.foods };
}, '同sourceId在两个卖者中连续重吃仍各结算一次；重吃不把记录复制到普通接收者。');

check('sale.replay-eater-hooks', {
  ladybug: [2, 2], worm: [2, 2], sealNeighbors: [[1, 1], [0, 0]], rabbitTarget: [1, 2], wyvernShare: [1, 1], foods: 0,
}, () => {
  const memory: FoodMemory = { id: 'f_bread', atk: 1, hp: 1, sourceId: 71 };
  const eat = (target: Owned, extra: (Owned | null)[] = []) => {
    const r = runState(); r.queue = [unit('v_guard', 1, 90, [memory]), target, ...extra].slice(0, 5); while (r.queue.length < 5) r.queue.push(null); sell(r, 0); return r;
  };
  const a = eat(unit('v_guard', 1, 1)); const w = eat(unit('v_mage', 1, 2));
  const s = eat(unit('v_keeper', 1, 3), [unit('l_shield', 1, 4)]);
  const rb = eat(unit('l_shield', 1, 5), [unit('v_scout', 1, 6)]);
  const wy = eat(unit('l_shield', 1, 7), [unit('v_wyvern', 1, 8), unit('l_shield', 1, 9)]);
  return {
    ladybug: [a.queue[1]!.atkBonus, a.queue[1]!.hpBonus], worm: [w.queue[1]!.atkBonus, w.queue[1]!.hpBonus],
    sealNeighbors: [[s.queue[2]!.atkBonus, s.queue[2]!.hpBonus], [0, 0]],
    rabbitTarget: [rb.queue[1]!.atkBonus, rb.queue[1]!.hpBonus],
    wyvernShare: [wy.queue[3]!.atkBonus, wy.queue[3]!.hpBonus], foods: wy.tc.foods,
  };
});
check('sale.replay-does-not-satisfy-rhyno-three', { bonus: [1, 1], foods: 2 }, () => {
  const r = runState(); r.tc.foods = 2; r.queue[0] = unit('v_guard', 1, 1, [{ id: 'f_bread', atk: 1, hp: 1, sourceId: 1 }]); r.queue[1] = unit('v_rhyno', 1, 2); sell(r, 0); endTurn(r);
  return { bonus: [r.queue[1]!.atkBonus, r.queue[1]!.hpBonus], foods: r.tc.foods };
});
check('sale.replay-no-bear-budget-or-purchase-hooks', { gain: [1, 1], foods: 0, bearUses: 0, shopFoods: 0 }, () => {
  const r = runState(); r.queue[0] = unit('v_guard', 1, 1, [{ id: 'f_bread', atk: 1, hp: 1, sourceId: 8 }]); r.queue[1] = unit('v_bear', 1, 2); const b = stats(r.queue[1]); sell(r, 0);
  return { gain: [ownedAtk(r.queue[1]!) - b[0], ownedHp(r.queue[1]!) - b[1]], foods: r.tc.foods, bearUses: r.tc.bear[2] ?? 0, shopFoods: foods(r).length };
});

// 3星猫作为继承目标，重吃 5 份羊与动态牛奶；确认真实 50 cap 与成本模型。
check('extreme.cat-replay-five-roast-cap', { gain: [42, 41], capped: [50, 50], sourceRemoved: true }, () => {
  const mem = Array.from({ length: 5 }, (_, i): FoodMemory => ({ id: 'f_roast', atk: 5, hp: 5, sourceId: 20 + i }));
  const r = runState(); const src = unit('v_guard', 1, 1, mem); const cat = unit('v_queen', 3, 2); r.queue[0] = src; r.queue[1] = cat; const before = stats(cat); sell(r, 0); const after = stats(cat);
  const out = { gain: [after[0] - before[0], after[1] - before[1]], capped: after, sourceRemoved: r.queue[0] === null };
  extremes.push({ id: 'cat-five-roast', before, after, nominalReplay: [75, 75], actualGain: out.gain, cap: STAT_CAP, acquisitionGold: 5 * 3 }); return out;
});
check('extreme.cat-replay-dynamic-milk', [6, 9], () => {
  const r = runState(); r.queue[0] = unit('v_guard', 1, 1, [{ id: 'f_milk', atk: 2, hp: 3, sourceId: 9 }]); r.queue[1] = unit('v_queen', 3, 2); const b = stats(r.queue[1]); sell(r, 0);
  return [ownedAtk(r.queue[1]!) - b[0], ownedHp(r.queue[1]!) - b[1]];
});
check('extreme.cat-replay-three-three-milk', [9, 9], () => {
  const r = runState(); r.queue[0] = unit('v_guard', 1, 1, [{ id: 'f_milk', atk: 3, hp: 3, sourceId: 10 }]); r.queue[1] = unit('v_queen', 3, 2); const b = stats(r.queue[1]); sell(r, 0);
  return [ownedAtk(r.queue[1]!) - b[0], ownedHp(r.queue[1]!) - b[1]];
});
check('extreme.two-wyverns-multiple-nonrecursive', { left: [2, 2], right: [2, 2], foods: 2 }, () => {
  const r = runState(); r.queue = [unit('l_shield', 1, 1), unit('v_wyvern', 3, 2), unit('l_shield', 1, 3), unit('v_wyvern', 3, 4), unit('l_shield', 1, 5)];
  for (let i = 0; i < 2; i++) { const s = food(r, 'f_bread'); useFood(r, s.sid, 2); }
  const out = { left: [r.queue[0]!.atkBonus, r.queue[0]!.hpBonus], right: [r.queue[4]!.atkBonus, r.queue[4]!.hpBonus], foods: r.tc.foods };
  extremes.push({ id: 'two-wyverns-two-foods', ...out }); return out;
});

// 冰角牛奶：购买不生成；整备授予幂等、队列前到后、最多2奶/总补给4；刷新保留，锁定无效。
check('milk.not-on-purchase', 0, () => { const r = runState(); const s = unitShop(r, 'v_sentinel'); buy(r, s.sid, 0); return milk(r).length; });
check('milk.grant-order-values-idempotent-limits', { vals: [[1, 1], [3, 3]], milk: 2, food: 4 }, () => {
  const r = runState(); r.queue[0] = unit('v_sentinel', 1, 1); r.queue[3] = unit('v_sentinel', 3, 2); food(r, 'f_bread'); food(r, 'f_whet');
  grantPrepMilk(r); grantPrepMilk(r);
  return { vals: milk(r).map((x) => x.val), milk: milk(r).length, food: foods(r).length };
});
check('milk.refresh-preserved-and-lock-noop', { sameSid: true, locked: false, milk: 1 }, () => {
  const r = runState(); r.queue[0] = unit('v_sentinel'); grantPrepMilk(r); const m = milk(r)[0]; toggleLock(r, m.sid); reroll(r); const after = milk(r);
  return { sameSid: after[0]?.sid === m.sid, locked: after[0]?.locked ?? false, milk: after.length };
});
check('milk.direct-use-counts-once', { foods: 1, history: 1 }, () => {
  const r = runState(); r.queue[0] = unit('v_guard'); const s = food(r, 'f_milk', [2, 2]); useFood(r, s.sid, 0);
  return { foods: r.tc.foods, history: r.queue[0]!.foodHistory?.length ?? 0 };
});
check('milk.old-value-stable-after-sentinel-level-up', { levelCopies: 6, old: [1, 1], milk: 1 }, () => {
  const r = runState(); r.queue[0] = unit('v_sentinel', 1, 1); grantPrepMilk(r); const old = milk(r)[0]; r.queue[1] = { ...unit('v_sentinel', 2, 2), copies: 5 }; moveOwned(r, 1, 0); grantPrepMilk(r);
  return { levelCopies: r.queue[0]!.copies, old: old.val, milk: milk(r).length };
});
check('bear.full-shelf-does-not-consume-later-bear-budget', { first: 1, second: 0, food: 4 }, () => {
  const r = runState(); r.queue[0] = unit('v_bear', 1, 7); r.queue[1] = unit('v_bear', 1, 8); r.queue[2] = unit('l_shield');
  food(r, 'f_bread'); food(r, 'f_whet'); food(r, 'f_milk', [1, 1]); food(r, 'f_milk', [1, 1]);
  const s = r.shop.find((x) => x.def === 'f_bread')!; useFood(r, s.sid, 2);
  return { first: r.tc.bear[7] ?? 0, second: r.tc.bear[8] ?? 0, food: foods(r).length };
}, '第一只熊补回第4格；第二只看到满架，必须保留本回合限次。');

// 存档：load 不补奶；v5 缺历史归空，非法历史拒绝/清洗需由契约实现决定为安全空。
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
check('load.no-milk-injection-old-v5-empty-history', { milk: 0, history: [] }, () => {
  const r = runState(); r.queue[0] = unit('v_sentinel'); delete (r.queue[0] as Partial<Owned>).foodHistory; save(r); const got = load()!;
  return { milk: milk(got).length, history: got.queue[0]?.foodHistory ?? [] };
});
check('load.invalid-history-rejected-and-original-preserved', { loaded: null, preserved: true }, () => {
  const r = runState(); r.queue[0] = unit('v_guard'); (r.queue[0] as Owned).foodHistory = [{ id: 'f_dragon', atk: -9, hp: 999, sourceId: -1 }]; const raw = JSON.stringify(r); storage.setItem(SAVE_KEY, raw);
  return { loaded: load(), preserved: storage.getItem(SAVE_KEY) === raw };
});
check('save-load-roundtrip-idempotent', true, () => {
  const r = runState(); r.queue[0] = unit('v_guard', 1, 1, [{ id: 'f_bread', atk: 1, hp: 1, sourceId: 12 }]); save(r); const a = load()!; save(a); const b = load()!;
  return j(a) === j(b);
});

// advance：清旧奶后 roll 普通，再按当前阵容补奶；连续回合不得累积。
check('advance.milk-regenerated-not-accumulated', { milk: 1, totalAtMost4: true }, () => {
  const r = runState(); r.queue[0] = unit('v_sentinel', 2); grantPrepMilk(r); const old = milk(r)[0].sid;
  settleBattle(r, { result: 'draw', perm: [] });
  return { milk: milk(r).length, totalAtMost4: foods(r).length <= 4 && milk(r).every((x) => x.sid !== old) };
});
check('advance.removes-even-locked-old-milk', { oldGone: true, milk: 1 }, () => {
  const r = runState(); r.queue[0] = unit('v_sentinel'); grantPrepMilk(r); const old = milk(r)[0]; old.locked = true; settleBattle(r, { result: 'draw', perm: [] });
  return { oldGone: !r.shop.some((x) => x.sid === old.sid), milk: milk(r).length };
});

const report = {
  generatedAt: new Date().toISOString(),
  contract: { FOOD_HISTORY_MAX, STAT_CAP, inheritors },
  summary: { total: checks.length, passed: checks.filter((x) => x.status === 'pass').length, failed: checks.filter((x) => x.status === 'fail').length },
  checks,
  extremes,
  risks: [
    '出售重吃的 sourceId 语义必须稳定为原补给实例 sid；若定义为单位 oid，合并去重会错误吞掉同单位吃过的多份补给。',
    '牛奶由队列顺序每只冰角一瓶且总量最多2；同一只冰角的合并星级变化应在下一次 grant/advance 才重算，刷新保留现有奶值。',
    '白龙“身前优先再身后”与“不跳空邻位”组合意味着最多仅两个物理邻格；排除 eater/自身后不向更远槽补足。',
    '炖锅仅在指定目标不存在时失败；失败必须不扣钱、不移除物品、不递增 tc.foods，也不得把效果改给后邻。',
    '50 上限使五份烤全羊被3星执政官重吃的名义+75大幅溢出，实际收益依接收者基础与已有成长而变。',
  ],
};
const outDir = new URL('../../output/supply-audit/', import.meta.url);
mkdirSync(outDir, { recursive: true });
writeFileSync(new URL('extremes.json', outDir), JSON.stringify(report, null, 2));
const preFile = new URL('baseline-pre-change.json', outDir);
const postFile = new URL('baseline-post-change.json', outDir);
if (existsSync(preFile) && existsSync(postFile)) {
  const pre = JSON.parse(readFileSync(preFile, 'utf8'));
  const post = JSON.parse(readFileSync(postFile, 'utf8'));
  const meanCi = (values: number[]) => {
    const mean = values.reduce((s, x) => s + x, 0) / values.length;
    const variance = values.length > 1 ? values.reduce((s, x) => s + (x - mean) ** 2, 0) / (values.length - 1) : 0;
    const half = 1.959963984540054 * Math.sqrt(variance / values.length);
    return { mean, ci95: [mean - half, mean + half] };
  };
  const paired = post.groups.map((pg: any) => {
    const bg = pre.groups.find((g: any) => g.group.id === pg.group.id);
    if (!bg) throw new Error(`pre-change missing group ${pg.group.id}`);
    const bySeed = new Map<number, any>(bg.runs.map((r: any) => [r.seed, r]));
    const pairs = pg.runs.map((after: any) => ({ before: bySeed.get(after.seed), after })).filter((x: any) => x.before);
    if (pairs.length !== pg.runs.length || pairs.length !== bg.runs.length) throw new Error(`unpaired seeds in ${pg.group.id}`);
    const clearDiffs = pairs.map((x: any) => Number(x.after.cleared) - Number(x.before.cleared));
    const turnDiffs = pairs.map((x: any) => x.after.terminalTurn - x.before.terminalTurn);
    const improved = clearDiffs.filter((x: number) => x === 1).length;
    const regressed = clearDiffs.filter((x: number) => x === -1).length;
    return {
      group: pg.group.id,
      n: pairs.length,
      clear: {
        before: bg.summary.clearRate,
        after: pg.summary.clearRate,
        pairedDifference: meanCi(clearDiffs),
        discordant: { improved, regressed, total: improved + regressed },
        unchanged: pairs.length - improved - regressed,
      },
      terminalTurnDifference: meanCi(turnDiffs),
      stageAggregateDeltas: pg.summary.stages.map((s: any) => {
        const b = bg.summary.stages.find((x: any) => x.stage === s.stage);
        return { stage: s.stage, reachedRuns: s.reachedRuns - b.reachedRuns, winRate: s.winRate - b.winRate, avgAtk: s.avgAtk - b.avgAtk, avgHp: s.avgHp - b.avgHp };
      }),
    };
  });
  const comparison = {
    generatedAt: new Date().toISOString(),
    before: { label: pre.label, generatedAt: pre.generatedAt, sourceHead: pre.sourceHead },
    after: { label: post.label, generatedAt: post.generatedAt, sourceHead: post.sourceHead },
    method: '同组同seed逐局配对；通关差值取{-1,0,1}样本均值，95% CI为配对差值的正态近似区间。阶段攻血/胜率只给实际到达者的聚合差，受幸存者构成变化影响，不伪装成配对单位差。',
    caveat: '两次文件记录的git HEAD相同，说明改动尚未提交；HEAD只能标识提交基线，不能证明工作树内容相同。',
    groups: paired,
  };
  writeFileSync(new URL('comparison.json', outDir), JSON.stringify(comparison, null, 2));
}
console.log(`mechanics ${report.summary.passed}/${report.summary.total} passed; extremes=${extremes.length}`);
for (const c of checks.filter((x) => x.status === 'fail')) console.error(`FAIL ${c.id}\n expected ${j(c.expected)}\n observed ${j(c.observed)}`);
if (report.summary.failed) throw new Error(`${report.summary.failed} mechanics contract checks failed`);
