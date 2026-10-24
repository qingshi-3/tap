// 一局的状态与商店经济：框架照搬 SAP（6 阶、货架 3→5、补给 1→2、10 金、3 份/6 份升星、10 心 10 胜）。
import { BOSSES, card, FOOD, FOODS, SHOP_POOL, type BossDef, type Ench, type Tier } from './data';
import { QUEUE_MAX, simulate, type BattleOut, type UnitSpec } from './engine';
import ghostData from './ghosts.json';

export const SAVE_KEY = 'pdqs_run_v2';
export const SAVE_VERSION = 2;
export const MAX_LIVES = 10;
export const WIN_GOAL = 10;
export const GOLD_PER_ROUND = 10;
export const PRICE = 3;
export const REROLL = 1;
export const MAX_COPIES = 6;
export const STAT_CAP = 50;

export interface Owned {
  oid: number;
  def: string;
  copies: number;
  atkBonus: number;
  hpBonus: number;
  ench?: Ench | null;
  /** 战鼓：下一场 +n/+n */
  drum?: number;
  /** 魂灯：下一场复生 */
  lamp?: boolean;
  /** 幼兽蛋：孵出幼龙的额外攻血 */
  bank?: number;
}
/** free：升星奖励卡（SAP 式：照常 3 金，刷新/新回合会被刷走，可锁定；不占普通单位格） */
export interface ShopItem { sid: number; kind: 'unit' | 'food'; def: string; locked: boolean; free: boolean }
export type BossKey = keyof typeof BOSSES;
export interface Enemy { boss: BossKey | null; units: UnitSpec[] }
export interface RunState {
  v: number;
  seed: number;
  turn: number;
  lives: number;
  wins: number;
  gold: number;
  queue: (Owned | null)[];
  shop: ShopItem[];
  nextId: number;
  phase: 'prep' | 'won' | 'lost';
  history: ('win' | 'lose' | 'draw')[];
  /** 罐头：之后买到的单位 +n/+n */
  canned: number;
  /** 本回合已刷新次数（沙漏构装） */
  rerolls: number;
  /** 连输终局 Boss 的次数 */
  finalLosses: number;
  enemy: Enemy;
  /** 回合开始时的商店效果，留给 UI 播放 */
  pendingFx: ShopFx[];
}

/** 商店内效果，UI 逐个播放 */
export type ShopFx =
  | { kind: 'buff'; src: number | null; tgt: number; atk: number; hp: number; label: string }
  | { kind: 'gold'; src: number; n: number; label: string }
  | { kind: 'bank'; src: number; n: number; label: string };

export const lvlOf = (copies: number): 1 | 2 | 3 => (copies >= 6 ? 3 : copies >= 3 ? 2 : 1);
/** 当前星级内的进度：[已有, 需要] */
export const starProgress = (copies: number): [number, number] =>
  copies >= 6 ? [1, 1] : copies >= 3 ? [copies - 3, 3] : [copies - 1, 2];
export const ownedAtk = (o: Owned) => Math.min(STAT_CAP, Math.max(1, card(o.def).atk + o.copies - 1 + o.atkBonus));
export const ownedHp = (o: Owned) => Math.min(STAT_CAP, card(o.def).hp + o.copies - 1 + o.hpBonus);
export const sellPrice = (o: Owned) => lvlOf(o.copies);
export const unitSlots = (turn: number) => (turn <= 4 ? 3 : turn <= 8 ? 4 : 5);
export const foodSlots = (turn: number) => (turn <= 2 ? 1 : 2);
export const maxTier = (turn: number): Tier => Math.min(6, Math.ceil(turn / 2)) as Tier;
export const lossCost = (turn: number) => (turn <= 2 ? 1 : turn <= 4 ? 2 : 3);
const vOf = (o: Owned) => {
  const d = card(o.def);
  return d.v ? d.v[lvlOf(o.copies) - 1] : 0;
};

// 可复现随机
function rng(r: RunState) {
  r.seed = (r.seed * 1103515245 + 12345) & 0x7fffffff;
  return r.seed / 0x7fffffff;
}
const pick = <T>(r: RunState, arr: T[]) => arr[Math.floor(rng(r) * arr.length)];
const units = (r: RunState) => r.queue.filter((o): o is Owned => !!o);
const byOid = (r: RunState, oid: number) => units(r).find((o) => o.oid === oid);

/** 永久加成，带属性上限；返回实际加了多少 */
function grow(o: Owned, atk: number, hp: number): [number, number] {
  const a = Math.max(0, Math.min(atk, STAT_CAP - ownedAtk(o)));
  const h = Math.max(0, Math.min(hp, STAT_CAP - ownedHp(o)));
  o.atkBonus += a;
  o.hpBonus += h;
  return [a, h];
}
function growFx(fx: ShopFx[], src: number | null, o: Owned, atk: number, hp: number, label: string) {
  const [a, h] = grow(o, atk, hp);
  if (a || h) fx.push({ kind: 'buff', src, tgt: o.oid, atk: a, hp: h, label });
}

export function newRun(seed = (Math.random() * 2 ** 31) | 0): RunState {
  const r: RunState = {
    v: SAVE_VERSION, seed, turn: 1, lives: MAX_LIVES, wins: 0, gold: GOLD_PER_ROUND, queue: Array(QUEUE_MAX).fill(null), shop: [], nextId: 1,
    phase: 'prep', history: [], canned: 0, rerolls: 0, finalLosses: 0, enemy: { boss: null, units: [] }, pendingFx: [],
  };
  rollShop(r);
  r.enemy = makeEnemy(r);
  return r;
}

function rollShop(r: RunState) {
  const tier = maxTier(r.turn);
  const pool = SHOP_POOL.filter((c) => c.tier <= tier);
  const fpool = FOODS.filter((f) => f.tier <= tier);
  const kept = r.shop.filter((s) => s.locked);
  const out: ShopItem[] = [];
  const keptU = kept.filter((s) => s.kind === 'unit' && !s.free);
  out.push(...keptU);
  for (let i = keptU.length; i < unitSlots(r.turn); i++) out.push({ sid: r.nextId++, kind: 'unit', def: pick(r, pool).id, locked: false, free: false });
  out.push(...kept.filter((s) => s.free));
  const keptF = kept.filter((s) => s.kind === 'food');
  out.push(...keptF);
  for (let i = keptF.length; i < foodSlots(r.turn); i++) out.push({ sid: r.nextId++, kind: 'food', def: pick(r, fpool).id, locked: false, free: false });
  r.shop = out;
}

export function reroll(r: RunState): ShopFx[] | null {
  if (r.gold < REROLL) return null;
  r.gold -= REROLL;
  r.rerolls++;
  rollShop(r);
  const fx: ShopFx[] = [];
  for (const o of units(r)) {
    if (card(o.def).ab === 'hourglass' && r.rerolls <= vOf(o)) {
      const t = pick(r, units(r));
      growFx(fx, o.oid, t, 1, 1, '刷新');
    }
  }
  return fx;
}

export function toggleLock(r: RunState, sid: number) {
  const s = r.shop.find((x) => x.sid === sid);
  if (s) s.locked = !s.locked;
}

export type BuyResult = { ok: false; why: 'gold' | 'full' | 'max' } | { ok: true; merged: boolean; levelUp: boolean; fx: ShopFx[] };

/** 买单位到指定格：空格放下；同名合并；不同名的单位格拒绝 */
export function buy(r: RunState, sid: number, slot: number): BuyResult {
  const item = r.shop.find((x) => x.sid === sid);
  if (!item || item.kind !== 'unit') return { ok: false, why: 'full' };
  const cost = PRICE;
  if (r.gold < cost) return { ok: false, why: 'gold' };
  const at = r.queue[slot];
  if (at && at.def !== item.def) return { ok: false, why: 'full' };
  if (at && at.copies >= MAX_COPIES) return { ok: false, why: 'max' };
  r.gold -= cost;
  r.shop = r.shop.filter((x) => x !== item);
  if (!at) {
    r.queue[slot] = { oid: r.nextId++, def: item.def, copies: 1, atkBonus: r.canned, hpBonus: r.canned };
    return { ok: true, merged: false, levelUp: false, fx: [] };
  }
  if (r.canned) grow(at, r.canned, r.canned);
  const fx: ShopFx[] = [];
  const levelUp = addCopies(r, at, 1, fx);
  return { ok: true, merged: true, levelUp, fx };
}

function addCopies(r: RunState, o: Owned, n: number, fx: ShopFx[]): boolean {
  const before = lvlOf(o.copies);
  o.copies = Math.min(MAX_COPIES, o.copies + n);
  const levelUp = lvlOf(o.copies) > before;
  if (levelUp) {
    grantStarReward(r);
    if (card(o.def).ab === 'keeper') for (const t of units(r)) if (t !== o) growFx(fx, o.oid, t, vOf(o), vOf(o), '升星');
  }
  return levelUp;
}

/** 买到第一个合适的位置：优先合并同名，否则第一个空格 */
export function autoSlot(r: RunState, def: string): number {
  const same = r.queue.findIndex((o) => o?.def === def && o.copies < MAX_COPIES);
  if (same >= 0) return same;
  return r.queue.findIndex((o) => !o);
}

function grantStarReward(r: RunState) {
  const tier = Math.min(6, maxTier(r.turn) + 1);
  const pool = SHOP_POOL.filter((c) => c.tier === tier);
  r.shop.push({ sid: r.nextId++, kind: 'unit', def: pick(r, pool).id, locked: false, free: true });
}

/** 补给是否需要指定目标 */
export const foodNeedsTarget = (id: string) => !['f_stew', 'f_sushi', 'f_roast', 'f_can'].includes(id);
/** 沙域法老：补给数值放大 */
function pharaohMul(r: RunState) {
  const best = Math.max(0, ...units(r).filter((o) => card(o.def).ab === 'pharaoh').map(vOf));
  return 1 + best / 100;
}

export type FoodResult = { ok: false; why: 'gold' | 'target' } | { ok: true; fx: ShopFx[]; levelUp: boolean };
export function useFood(r: RunState, sid: number, slot: number | null): FoodResult {
  const item = r.shop.find((x) => x.sid === sid);
  if (!item || item.kind !== 'food') return { ok: false, why: 'target' };
  const f = FOOD[item.def];
  const tgt = slot === null ? null : r.queue[slot];
  if (foodNeedsTarget(f.id) && !tgt) return { ok: false, why: 'target' };
  if (!foodNeedsTarget(f.id) && !units(r).length && f.id !== 'f_can') return { ok: false, why: 'target' };
  if (f.id === 'f_elixir' && tgt && tgt.copies >= MAX_COPIES) return { ok: false, why: 'target' };
  if (r.gold < PRICE) return { ok: false, why: 'gold' };
  r.gold -= PRICE;
  r.shop = r.shop.filter((x) => x !== item);
  const m = pharaohMul(r);
  const n = (x: number) => Math.round(x * m);
  const fx: ShopFx[] = [];
  let levelUp = false;
  const randomN = (k: number, amt: number) => {
    const pool = [...units(r)];
    for (let i = 0; i < k && pool.length; i++) {
      const t = pool.splice(Math.floor(rng(r) * pool.length), 1)[0];
      growFx(fx, null, t, n(amt), n(amt), f.name);
    }
  };
  if (f.ench && tgt) tgt.ench = f.ench;
  switch (f.id) {
    case 'f_bread': growFx(fx, null, tgt!, n(1), n(1), f.name); break;
    case 'f_whet': growFx(fx, null, tgt!, n(3), n(1), f.name); break;
    case 'f_lamp': tgt!.lamp = true; break;
    case 'f_drum': tgt!.drum = (tgt!.drum ?? 0) + n(3); break;
    case 'f_elixir': levelUp = addCopies(r, tgt!, 1, fx); break;
    case 'f_stew': randomN(2, 2); break;
    case 'f_sushi': randomN(3, 2); break;
    case 'f_roast': randomN(2, 4); break;
    case 'f_can': r.canned += n(1); break;
  }
  return { ok: true, fx, levelUp };
}

/** 场上两格互换，或同名合并（拖动） */
export function moveOwned(r: RunState, from: number, to: number): { merged: boolean; levelUp: boolean; fx: ShopFx[] } | null {
  if (from === to) return null;
  const a = r.queue[from];
  const b = r.queue[to];
  if (!a) return null;
  if (b && b.def === a.def && b.copies < MAX_COPIES && a.copies < MAX_COPIES) {
    b.atkBonus += a.atkBonus;
    b.hpBonus += a.hpBonus;
    b.ench = b.ench ?? a.ench;
    b.bank = (b.bank ?? 0) + (a.bank ?? 0);
    b.drum = (b.drum ?? 0) + (a.drum ?? 0) || undefined;
    b.lamp = b.lamp || a.lamp;
    r.queue[from] = null;
    const fx: ShopFx[] = [];
    const levelUp = addCopies(r, b, a.copies, fx);
    grow(b, 0, 0);
    return { merged: true, levelUp, fx };
  }
  r.queue[from] = b;
  r.queue[to] = a;
  return { merged: false, levelUp: false, fx: [] };
}

export interface SellOut { gold: number; fx: ShopFx[] }
export function sell(r: RunState, slot: number): SellOut | null {
  const o = r.queue[slot];
  if (!o) return null;
  const gold = sellPrice(o);
  r.gold += gold;
  r.queue[slot] = null;
  const fx: ShopFx[] = [];
  const rest = units(r);
  const ab = card(o.def).ab;
  if (ab === 'artificer' && rest.length) growFx(fx, o.oid, pick(r, rest), vOf(o), vOf(o), '出售');
  if (ab === 'worm' && rest.length) {
    const share = (x: number) => Math.max(1, Math.floor((x * vOf(o)) / 100 / rest.length));
    const sa = share(ownedAtk(o));
    const sh = share(ownedHp(o));
    for (const t of rest) growFx(fx, o.oid, t, sa, sh, '出售');
  }
  for (const t of rest) if (card(t.def).ab === 'dunecaster') growFx(fx, t.oid, t, vOf(t), vOf(t), '友军被出售');
  return { gold, fx };
}

/** 回合结束（开战前）：从队首到队尾依次结算商店成长 */
export function endTurn(r: RunState): ShopFx[] {
  const fx: ShopFx[] = [];
  const q = r.queue.filter((o): o is Owned => !!o);
  q.forEach((o, i) => {
    const v = vOf(o);
    switch (card(o.def).ab) {
      case 'backstab':
        if (i > 0) growFx(fx, o.oid, q[i - 1], v, 0, '回合结束');
        break;
      case 'ninja':
        if (i === q.length - 1) growFx(fx, o.oid, o, v, v, '回合结束');
        break;
      case 'warden':
        for (const t of q) if (card(t.def).kws.includes('rotate') || t.ench === 'rotate') growFx(fx, o.oid, t, 0, v, '回合结束');
        break;
      case 'mage':
        growFx(fx, o.oid, q[0], 0, v, '回合结束');
        break;
      case 'howler':
        for (const t of q.slice(Math.max(0, i - 2), i)) growFx(fx, o.oid, t, v, v, '回合结束');
        break;
      case 'egg':
        o.bank = (o.bank ?? 0) + v;
        fx.push({ kind: 'bank', src: o.oid, n: v, label: '回合结束' });
        break;
      case 'goldob':
        for (; r.gold > 0; r.gold--) growFx(fx, o.oid, pick(r, q), v, v, '花光余金');
        break;
      case 'onyx':
        for (const t of q) growFx(fx, o.oid, t, v, v, '回合结束');
        break;
    }
  });
  return fx;
}

export const playerTeam = (r: RunState): UnitSpec[] =>
  units(r).map((o) => ({
    def: o.def, lvl: lvlOf(o.copies), atk: Math.min(STAT_CAP, ownedAtk(o) + (o.drum ?? 0)), hp: Math.min(STAT_CAP, ownedHp(o) + (o.drum ?? 0)),
    oid: o.oid, ench: o.ench ?? null, lamp: o.lamp, bank: o.bank,
  }));

// ── 敌人：离线生成的幽灵库 + 固定机制 Boss ──
interface GhostData { turns: Record<string, UnitSpec[][]>; median: Record<string, number>; bossScale?: Record<string, number> }
const GHOSTS = ghostData as unknown as GhostData;
const ghostTurn = (turn: number) => {
  const keys = Object.keys(GHOSTS.turns).map(Number).filter((k) => GHOSTS.turns[k]?.length).sort((a, b) => a - b);
  if (!keys.length) return null;
  return keys.filter((k) => k <= turn).pop() ?? keys[0];
};
/** 该回合中位阵容的总攻血（Boss 预算用）；没有幽灵库时按目标曲线估 */
export function medianBudget(turn: number): number {
  const m = GHOSTS.median[String(turn)] ?? GHOSTS.median[String(ghostTurn(turn) ?? 0)];
  if (m) return m;
  const curve = [5, 7, 9, 12, 16, 20, 24, 29, 34, 39, 44, 50, 55];
  return curve[Math.min(turn, curve.length) - 1] * Math.min(5, 1 + Math.ceil(turn / 2));
}

export function bossFor(r: RunState): BossKey | null {
  if (r.wins >= WIN_GOAL - 1) return 'final';
  return ({ 4: 'wall', 8: 'tide', 12: 'wheel' } as Record<number, BossKey>)[r.turn] ?? null;
}
export function bossMul(r: RunState, key: BossKey) {
  if (key === 'final') return r.finalLosses >= 2 ? 0.9 : r.finalLosses === 1 ? 1.0 : 1.1;
  return key === 'wheel' ? 1.08 : 1.05;
}
/** Boss 预算 = 中位总攻血 × 机制校准系数（sim 让中位阵容对 ×1.0 Boss 胜率约 60%）× 强度倍率 */
export function bossTeam(def: BossDef, turn: number, mul: number, scale = GHOSTS.bossScale?.[def.key] ?? 1): UnitSpec[] {
  const budget = medianBudget(turn) * mul * scale;
  const shape = def.units.map((id) => card(id));
  const total = shape.reduce((s, d) => s + d.atk + d.hp, 0);
  const lvl: 1 | 2 | 3 = turn >= 11 ? 3 : turn >= 6 ? 2 : 1;
  return shape.map((d) => {
    const k = budget / total;
    return { def: d.id, lvl, atk: Math.max(1, Math.min(STAT_CAP, Math.round(d.atk * k))), hp: Math.max(1, Math.min(STAT_CAP, Math.round(d.hp * k))) };
  });
}

function makeEnemy(r: RunState): Enemy {
  const boss = bossFor(r);
  if (boss) return { boss, units: bossTeam(BOSSES[boss], r.turn, bossMul(r, boss)) };
  const t = ghostTurn(r.turn);
  if (t !== null) return { boss: null, units: pick(r, GHOSTS.turns[t]).map((u) => ({ ...u })) };
  return { boss: null, units: curveTeam(r) };
}
/** 没有幽灵库时的兜底：按曲线随机凑一队 */
function curveTeam(r: RunState): UnitSpec[] {
  const n = Math.min(5, 1 + Math.ceil(r.turn / 2));
  const per = medianBudget(r.turn) / n;
  const pool = SHOP_POOL.filter((c) => c.tier <= maxTier(r.turn));
  return Array.from({ length: n }, () => {
    const d = pick(r, pool);
    const k = per / (d.atk + d.hp || 1);
    return { def: d.id, lvl: 1 as const, atk: Math.max(1, Math.round(d.atk * k)), hp: Math.max(1, Math.round(d.hp * k)) };
  });
}

export function fight(r: RunState): BattleOut {
  return simulate(playerTeam(r), r.enemy.units, (r.seed ^ (r.turn * 7919)) & 0x7fffffff);
}

/** 战斗结算：扣心/记胜，写回战斗内永久成长，进入下一回合 */
export function settleBattle(r: RunState, out: Pick<BattleOut, 'result' | 'perm'>) {
  const result = out.result;
  for (const [oid, p] of Object.entries(out.perm)) {
    const o = byOid(r, Number(oid));
    if (o) grow(o, p.atk, p.hp);
  }
  for (const o of units(r)) {
    o.drum = undefined;
    o.lamp = undefined;
  }
  r.history.push(result);
  if (r.enemy.boss === 'final') r.finalLosses = result === 'lose' ? r.finalLosses + 1 : 0;
  if (result === 'win') r.wins++;
  if (result === 'lose') r.lives -= lossCost(r.turn);
  if (r.wins >= WIN_GOAL) {
    r.phase = 'won';
    return;
  }
  if (r.lives <= 0) {
    r.lives = 0;
    r.phase = 'lost';
    return;
  }
  r.turn++;
  r.rerolls = 0;
  r.gold = GOLD_PER_ROUND;
  rollShop(r);
  r.pendingFx = turnStart(r);
  r.enemy = makeEnemy(r);
}

function turnStart(r: RunState): ShopFx[] {
  const fx: ShopFx[] = [];
  for (const o of units(r)) {
    if (card(o.def).ab === 'dune') {
      r.gold += vOf(o);
      fx.push({ kind: 'gold', src: o.oid, n: vOf(o), label: '回合开始' });
    }
  }
  return fx;
}

// ── 存档 ──
export function save(r: RunState | null) {
  try {
    if (!r || r.phase !== 'prep') localStorage.removeItem(SAVE_KEY);
    else localStorage.setItem(SAVE_KEY, JSON.stringify(r));
  } catch { /* 存储受限时照常可玩 */ }
}
export function load(): RunState | null {
  try {
    const r = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as RunState | null;
    if (!r || r.v !== SAVE_VERSION || r.phase !== 'prep' || !Array.isArray(r.queue) || r.queue.length !== QUEUE_MAX) return null;
    const ok = r.queue.every((o) => !o || card(o.def)) && r.shop.every((s) => (s.kind === 'food' ? FOOD[s.def] : card(s.def))) && r.enemy.units.every((u) => card(u.def));
    return ok ? r : null;
  } catch {
    return null;
  }
}
export function clearAll() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('pdqs_')).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
