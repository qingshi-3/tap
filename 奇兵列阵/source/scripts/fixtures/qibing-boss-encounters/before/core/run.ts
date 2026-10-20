// v0.7 远征局内状态：章节与节点、招募、金币与商店、培养点、主将升阶、装备与法术。
// 纯数据 + 纯函数，UI 与模拟器共用；所有随机只走 rngState。
import { ALL_FACTIONS, DRAFT_POOL, ROLE_TAGS, tagFamily, unitDef } from './data';
import {
  EQUIPS, EQUIP_MAP, GENERALS, ORDERS, ORDER_MAP, PASSIVES, PASSIVE_MAP, POINT_MAP, POINT_TYPES, SPELLS,
  type OrderKind, type PassiveDef,
} from './content';
import { chapter, battleIndex, CHAPTER_COUNT, STAGES_PER_CHAPTER, VARIANT_KEYS, type RouteNode, type Stage } from './route';
import { filtered, markSkipped, newRec, recommend, type RecState } from './recommend';
import { rand, randInt, shuffle, weighted } from './rng';
import type { BattleSetup } from './engine';
import { isCopies, unitLevel, type ActiveFaction, type BattleResult, type Faction, type Slotted } from './types';

export { mulberry32 } from './rng';

export const SAVE_VERSION = 1;
export const CONTENT_VERSION = '0.8';
export const MAX_LIVES = 3;
export const MAX_REWARDED_RETRIES = 3;
export const MAX_REWARDED_REROLLS = 2;
export const MAX_LEVEL = 3;
export const MAX_COPIES = 4;
export const PICKS_PER_ROUND = 2;
export const BENCH_SLOTS = 3;
export const OWNED_SLOTS = 5 + BENCH_SLOTS;
export const UNIT_PRICE: Record<number, number> = { 1: 3, 2: 4, 3: 5, 4: 7 };
export const PACK_PRICE = 4;
export const PACK_POINTS = 2;
/** 主将升阶时机：第一章首领后、第二章第 6 节点后、第二章首领后 */
export const PROMO_NODE = { chapter: 1, node: 5 };

export type DraftFocus = ActiveFaction | 'neutral';
export interface ShopItem { id: string; price: number; sold: boolean }
export interface ShopState {
  units: ShopItem[];
  equips: ShopItem[];
  spells: ShopItem[];
  order: ShopItem | null;
  pack: { points: string[]; price: number; sold: boolean };
  refreshCost: number;
}
/** 本次备战中的分配记录（开战前可撤销） */
export interface AllocEntry { to: number | 'general'; type: string }
export interface PendingBattle { result: BattleResult; gold: number }

export interface RunState {
  saveVersion: number;
  contentVersion: string;
  seed: number;
  general: string;
  lives: number;
  chapter: number;
  /** 章内节点 0..8 */
  node: number;
  wins: number;
  history: BattleResult[];
  over: null | 'victory' | 'defeat';

  slots: (Slotted | null)[];
  bench: (Slotted | null)[];
  nextOwnedId: number;

  activeFactions: ActiveFaction[];
  /** 有变体的节点：0 主线、1 变体，开局抽定，重打不变 */
  variantChoices: Record<string, number>;
  draft: string[];
  picks: number;
  rerolls: number;
  rngState: number;
  rec: RecState;
  rewardedRetryCount: number;
  /** 整局累计广告刷新 */
  rewardedRerollCount: number;

  gold: number;
  shop: ShopState | null;

  /** 未分配的培养点（按类型） */
  stash: Record<string, number>;
  allocLog: AllocEntry[];
  /** 上一关发放的法强点数 */
  lastPower: number;
  /** 上一关发放的培养点（结算展示用） */
  lastPoints: string[];

  genPower: number;
  passives: string[];
  /** 待选的升阶被动 */
  promo: string[] | null;
  promoCount: number;

  /** 背包装备 */
  bag: string[];
  /** 持有的一次性法术 */
  spells: string[];
  /** 本场已使用的法术 */
  activeSpells: string[];
  orders: OrderKind[];
  /** 精英掉落的装备 3 选 1 */
  reward: string[] | null;
  /** 分岔节点选择 */
  forkPick: null | 'elite' | 'normal';
  /** 已算出、尚未播放完的战斗（防退出重打） */
  pending: PendingBattle | null;
}

// ───────────── 开局 ─────────────

/** 开局主将 3 选 1（随局种子） */
export function generalChoices(seed: number): string[] {
  const h = { rngState: (seed ^ 0x51ed27) | 0 };
  return shuffle(h, GENERALS.map((g) => g.id)).slice(0, 3);
}
export const randomSeed = () => (Math.random() * 2 ** 31) | 0;

export function newRun(general: string, seed = randomSeed()): RunState {
  const r: RunState = {
    saveVersion: SAVE_VERSION, contentVersion: CONTENT_VERSION, seed, general,
    lives: MAX_LIVES, chapter: 0, node: 0, wins: 0, history: [], over: null,
    slots: Array(5).fill(null), bench: Array(BENCH_SLOTS).fill(null), nextOwnedId: 1,
    activeFactions: [], variantChoices: {}, draft: [], picks: PICKS_PER_ROUND, rerolls: 1, rngState: seed, rec: newRec(),
    rewardedRetryCount: 0, rewardedRerollCount: 0,
    gold: 0, shop: null,
    stash: {}, allocLog: [], lastPower: 0, lastPoints: [],
    genPower: 0, passives: [], promo: null, promoCount: 0,
    bag: [], spells: [], activeSpells: [], orders: [], reward: null, forkPick: null, pending: null,
  };
  const fs = shuffle(r, [...ALL_FACTIONS]);
  r.activeFactions = ALL_FACTIONS.filter((f) => fs.slice(0, 4).includes(f));
  for (const k of VARIANT_KEYS) r.variantChoices[k] = rand(r) < 0.5 ? 0 : 1;
  enterNode(r);
  return r;
}

export const cloneOwned = (u: Slotted | null): Slotted | null =>
  u ? { ...u, ...(u.train ? { train: { ...u.train } } : {}), ...(u.equips ? { equips: [...u.equips] } : {}) } : null;
export function cloneRun(r: RunState): RunState {
  return structuredClone(r);
}

// ───────────── 持有位 ─────────────

/** 统一地址：0..4 战场，5..7 备战 */
const validSlot = (slot: number) => Number.isInteger(slot) && slot >= 0 && slot < OWNED_SLOTS;
export const getOwned = (r: RunState, slot: number): Slotted | null =>
  validSlot(slot) ? (slot < 5 ? r.slots[slot] : r.bench[slot - 5]) ?? null : null;
export const allOwned = (r: RunState): (Slotted | null)[] => [...r.slots, ...r.bench];
function putOwned(r: RunState, slot: number, u: Slotted | null) {
  if (slot < 5) r.slots[slot] = u;
  else r.bench[slot - 5] = u;
}
export const findOwned = (r: RunState, ownedId: number) => allOwned(r).findIndex((u) => u?.ownedId === ownedId);
export const teamSize = (r: RunState) => r.slots.filter(Boolean).length;

// ───────────── 路线 ─────────────

export const currentStage = (r: RunState): Stage => chapter(r.chapter).stages[r.node];
/** 当前要打的战斗；商店、未选分岔时为 null */
export function currentBattle(r: RunState): RouteNode | null {
  const s = currentStage(r);
  switch (s.type) {
    case 'shop': return null;
    case 'boss': return s.main;
    case 'fork': return r.forkPick ? s[r.forkPick] : null;
    case 'battle': return s.variant && r.variantChoices[`${r.chapter}:${r.node}`] ? s.variant : s.main;
  }
}
/** 当前（或下一场）战斗节点：未选分岔时取普通线，商店时取本章首领 */
export function currentNode(r: RunState): RouteNode {
  const s = currentStage(r);
  if (s.type === 'fork' && !r.forkPick) return s.normal;
  return currentBattle(r) ?? (chapter(r.chapter).stages[STAGES_PER_CHAPTER - 1] as { main: RouteNode }).main;
}
export const battleNo = (r: RunState) => battleIndex(r.chapter, r.node);

export type Screen = 'over' | 'promo' | 'reward' | 'shop' | 'fork' | 'prep';
/** 当前应显示的界面（由状态推导，不单独存） */
export function screen(r: RunState): Screen {
  if (r.over) return 'over';
  if (r.promo) return 'promo';
  if (r.reward) return 'reward';
  const s = currentStage(r);
  if (s.type === 'shop') return 'shop';
  if (s.type === 'fork' && !r.forkPick) return 'fork';
  return 'prep';
}

function enterNode(r: RunState) {
  r.forkPick = null;
  r.allocLog = [];
  r.activeSpells = [];
  if (currentStage(r).type === 'shop') {
    r.shop = makeShop(r, 1);
    r.draft = []; r.picks = 0; r.rerolls = 0;
  } else {
    r.shop = null;
    newDraftRound(r);
  }
}
function newDraftRound(r: RunState) {
  r.picks = PICKS_PER_ROUND;
  r.rerolls = 1;
  rollDraft(r);
}
function advance(r: RunState) {
  const leaving = { chapter: r.chapter, node: r.node };
  r.node++;
  if (r.node >= STAGES_PER_CHAPTER) { r.node = 0; r.chapter++; }
  if (r.chapter >= CHAPTER_COUNT) { r.chapter = CHAPTER_COUNT - 1; r.node = STAGES_PER_CHAPTER - 1; r.over = 'victory'; return; }
  if (leaving.chapter === PROMO_NODE.chapter && leaving.node === PROMO_NODE.node) makePromo(r);
  enterNode(r);
}
export function pickFork(r: RunState, pick: 'elite' | 'normal') {
  if (screen(r) !== 'fork') return false;
  r.forkPick = pick;
  return true;
}
export function leaveShop(r: RunState) {
  if (screen(r) !== 'shop') return false;
  r.shop = null;
  advance(r);
  return true;
}

// ───────────── 招募 ─────────────

export function tierCap(battle: number) {
  return battle < 2 ? 1 : battle < 5 ? 2 : battle < 8 ? 3 : 4;
}
export function qualityWeights(battle: number): readonly number[] {
  return battle < 2 ? [100, 0, 0, 0] : battle < 5 ? [60, 40, 0, 0] : battle < 8 ? [35, 45, 20, 0]
    : battle < 15 ? [25, 35, 30, 10] : [20, 30, 35, 15];
}
export const factionAvailable = (r: RunState, f: Faction) => f === 'neutral' || r.activeFactions.includes(f as ActiveFaction);
export const draftPool = (r: RunState) =>
  DRAFT_POOL.filter((d) => d.tier <= tierCap(battleNo(r)) && factionAvailable(r, d.faction));

function recInput(r: RunState) {
  return { pool: draftPool(r), weights: qualityWeights(battleNo(r)), owned: allOwned(r), field: r.slots };
}
/** 推荐算法生成本轮 3 张候选；上一轮没拿的卡记为跳过 */
export function rollDraft(r: RunState): boolean {
  markSkipped(r.rec, r.draft);
  const ids = recommend(r, recInput(r), r.rec, 3);
  if (ids.length < 3) return false;
  r.draft = ids;
  return true;
}
export function reroll(r: RunState) {
  if (r.over || r.rerolls <= 0 || r.picks <= 0) return false;
  if (!rollDraft(r)) return false;
  r.rerolls--;
  return true;
}
export const remainingRewardedRerolls = (r: RunState) => Math.max(0, MAX_REWARDED_REROLLS - r.rewardedRerollCount);
export const canRewardedReroll = (r: RunState) => !r.over && r.picks > 0 && r.rerolls === 0 && remainingRewardedRerolls(r) > 0;
export function applyRewardedReroll(r: RunState) {
  if (!canRewardedReroll(r)) return false;
  if (!rollDraft(r)) return false;
  r.rewardedRerollCount++;
  return true;
}
export const remainingRewardedRetries = (r: RunState) => Math.max(0, MAX_REWARDED_RETRIES - r.rewardedRetryCount);
export function consumeRewardedRetry(r: RunState) {
  if (remainingRewardedRetries(r) <= 0) return false;
  r.rewardedRetryCount++;
  return true;
}

// ───────────── 招募令 ─────────────

const hasTag = (defId: string, tag: string) => (unitDef(defId).tags ?? []).some((t) => t === tag || tagFamily(t) === tag);
/** 词条招募令可选的标签：职能标签 + 机制标签族 */
export const ORDER_TAGS = [...ROLE_TAGS, '格挡', '复生', '连击', '狙击', '法强', '反击', '灼烧', '溅射', '寒意', '护甲', '护卫', '易伤', '立即攻击', '行动次数', '献祭']
  .filter((t, i, a) => a.indexOf(t) === i);
function orderPool(r: RunState, kind: OrderKind, choice: string) {
  const pool = draftPool(r);
  switch (kind) {
    case 'o_faction': return pool.filter((d) => d.faction === choice);
    case 'o_tag': return pool.filter((d) => hasTag(d.id, choice));
    case 'o_named': return pool;
  }
}
/** 某种招募令当前可选的目标（筛选后不足 3 张的不列出） */
export function orderOptions(r: RunState, kind: OrderKind): string[] {
  switch (kind) {
    case 'o_faction': return [...r.activeFactions, 'neutral'].filter((f) => orderPool(r, kind, f).length >= 3);
    case 'o_tag': return ORDER_TAGS.filter((t) => orderPool(r, kind, t).length >= 3);
    case 'o_named': {
      const pool = new Set(draftPool(r).map((d) => d.id));
      return [...new Set(allOwned(r).filter((u): u is Slotted => !!u && u.copies < 4 && pool.has(u.defId)).map((u) => u.defId))];
    }
  }
}
/** 使用招募令：立即按筛选重新生成本轮候选，不消耗刷新次数 */
export function useOrder(r: RunState, index: number, choice: string) {
  const kind = r.orders[index];
  if (!kind || r.over || r.picks <= 0 || screen(r) !== 'prep' || !orderOptions(r, kind).includes(choice)) return false;
  const ids = filtered(r, orderPool(r, kind, choice), qualityWeights(battleNo(r)), 3, kind === 'o_named' ? choice : undefined);
  if (ids.length < 3) return false;
  markSkipped(r.rec, r.draft);
  r.draft = ids;
  r.orders.splice(index, 1);
  return true;
}

// ───────────── 放置、换位、合并、卖出 ─────────────

export type PlaceResult = 'place' | 'merge' | 'reserve' | 'replace' | 'confirm' | 'invalid';
export function reserveDestination(r: RunState, target: number): number | null {
  const i = r.bench.findIndex((u, index) => !u && index + 5 !== target);
  return i < 0 ? null : i + 5;
}
export function placeKind(r: RunState, defId: string, slot: number): PlaceResult {
  if (!validSlot(slot) || !DRAFT_POOL.some((d) => d.id === defId)) return 'invalid';
  const cur = getOwned(r, slot);
  if (!cur) return 'place';
  if (cur.defId === defId) return cur.copies === 1 ? 'merge' : 'invalid';
  return reserveDestination(r, slot) === null ? 'replace' : 'reserve';
}
const newOwned = (r: RunState, defId: string): Slotted => ({ defId, ownedId: r.nextOwnedId++, copies: 1 });
/** 被覆盖的单位按卖出处理（金币、培养点、装备全额返还） */
export function takeDraft(r: RunState, draftIdx: number, slot: number, confirmDismiss = false): PlaceResult {
  if (r.over || r.picks <= 0 || !Number.isInteger(draftIdx) || screen(r) !== 'prep') return 'invalid';
  const id = r.draft[draftIdx];
  if (!id) return 'invalid';
  const kind = placeKind(r, id, slot);
  if (kind === 'invalid') return kind;
  if (kind === 'replace' && !confirmDismiss) return 'confirm';
  if (kind === 'merge') getOwned(r, slot)!.copies = 2;
  else {
    if (kind === 'reserve') putOwned(r, reserveDestination(r, slot)!, getOwned(r, slot));
    if (kind === 'replace') sell(r, slot);
    putOwned(r, slot, newOwned(r, id));
  }
  r.picks--;
  r.draft.splice(draftIdx, 1);
  if (r.picks > 0) rollDraft(r);
  else { markSkipped(r.rec, r.draft); r.draft = []; }
  return kind;
}
export type MoveResult = 'move' | 'swap' | 'merge' | 'invalid';
export function moveKind(r: RunState, from: number, to: number, mode: 'auto' | 'swap' = 'auto'): MoveResult {
  if (!validSlot(from) || !validSlot(to) || from === to) return 'invalid';
  const a = getOwned(r, from), b = getOwned(r, to);
  if (!a || !isCopies(a.copies) || (b && !isCopies(b.copies))) return 'invalid';
  if (!b) return 'move';
  if (mode === 'swap' || a.defId !== b.defId || a.copies !== b.copies || a.copies === MAX_COPIES) return 'swap';
  return 'merge';
}
export const equipCap = (r: RunState) => (r.passives.includes('g_dual') ? 2 : 1);
/** 合并：份数相加，培养点相加，装备保留到上限、多余回背包 */
function mergeInto(r: RunState, src: Slotted, dst: Slotted) {
  dst.copies = dst.copies === 1 ? 2 : 4;
  if (src.train) {
    dst.train = { ...(dst.train ?? {}) };
    for (const [k, n] of Object.entries(src.train)) dst.train[k] = (dst.train[k] ?? 0) + (n ?? 0);
  }
  const eqs = [...(dst.equips ?? []), ...(src.equips ?? [])];
  dst.equips = eqs.slice(0, equipCap(r));
  r.bag.push(...eqs.slice(equipCap(r)));
  for (const e of r.allocLog) if (e.to === src.ownedId) e.to = dst.ownedId;
}
export function moveSlot(r: RunState, from: number, to: number, mode: 'auto' | 'swap' = 'auto'): MoveResult {
  const kind = moveKind(r, from, to, mode);
  if (kind === 'invalid') return kind;
  const a = getOwned(r, from)!, b = getOwned(r, to);
  if (kind === 'merge') { mergeInto(r, a, b!); putOwned(r, from, null); }
  else { putOwned(r, to, a); putOwned(r, from, b); }
  return kind;
}
/** 卖出价：每份 1 金 */
export const sellPrice = (u: Slotted) => u.copies;
export function sell(r: RunState, slot: number) {
  const u = getOwned(r, slot);
  if (!u || r.over) return false;
  r.gold += sellPrice(u);
  for (const [k, n] of Object.entries(u.train ?? {})) if (n) r.stash[k] = (r.stash[k] ?? 0) + n;
  r.bag.push(...(u.equips ?? []));
  r.allocLog = r.allocLog.filter((e) => e.to !== u.ownedId);
  putOwned(r, slot, null);
  return true;
}

// ───────────── 培养点 ─────────────

/** 施法单位权重：场上 + 备战，按星级 1 / 1.5 / 2 */
export function casterWeight(r: RunState) {
  return allOwned(r).reduce((a, u) => a + (u && unitDef(u.defId).cast ? [1, 1.5, 2][unitLevel(u) - 1] : 0), 0);
}
export function rollPoints(r: RunState, n: number): string[] {
  const ctx = { casterWeight: casterWeight(r), lastPower: r.lastPower };
  const ws = POINT_TYPES.map((p) => p.weight(ctx));
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(POINT_TYPES[Math.max(0, weighted(r, ws))].id);
  return out;
}
function grantPoints(r: RunState, pts: readonly string[]) {
  for (const p of pts) r.stash[p] = (r.stash[p] ?? 0) + 1;
}
export const stashTotal = (r: RunState) => Object.values(r.stash).reduce((a, b) => a + b, 0);
/** 分配一点到单位（持有位）或主将 */
export function allocPoint(r: RunState, to: number | 'general', type: string) {
  const p = POINT_MAP[type];
  if (!p || !(r.stash[type] > 0) || r.over || r.pending) return false;
  if (to === 'general') {
    if (!p.toGeneral) return false;
    r.genPower++;
    r.allocLog.push({ to: 'general', type });
  } else {
    const u = getOwned(r, to);
    if (!u) return false;
    u.train = { ...(u.train ?? {}), [type]: (u.train?.[type] ?? 0) + 1 };
    r.allocLog.push({ to: u.ownedId, type });
  }
  r.stash[type]--;
  return true;
}
/** 撤销本次备战中最后一次分配 */
export function undoAlloc(r: RunState) {
  const e = r.allocLog.pop();
  if (!e) return false;
  if (e.to === 'general') r.genPower = Math.max(0, r.genPower - 1);
  else {
    const i = findOwned(r, e.to), u = i >= 0 ? getOwned(r, i) : null;
    if (!u?.train?.[e.type]) return undoAlloc(r);
    u.train[e.type]!--;
  }
  r.stash[e.type] = (r.stash[e.type] ?? 0) + 1;
  return true;
}

/** 退回本次备战里分给某个单位（或主将）的一点某类培养点 */
export function deallocPoint(r: RunState, to: number | 'general', type: string) {
  if (r.pending) return false;
  const id = to === 'general' ? 'general' : getOwned(r, to)?.ownedId;
  if (id == null) return false;
  const k = r.allocLog.map((e, i) => (e.to === id && e.type === type ? i : -1)).filter((i) => i >= 0).pop();
  if (k == null) return false;
  if (to === 'general') r.genPower = Math.max(0, r.genPower - 1);
  else {
    const u = getOwned(r, to)!;
    if (!u.train?.[type]) return false;
    u.train[type]!--;
  }
  r.allocLog.splice(k, 1);
  r.stash[type] = (r.stash[type] ?? 0) + 1;
  return true;
}
/** 本次备战里分给某个单位（或主将）、还能退回的某类点数 */
export const allocRefundable = (r: RunState, to: number | 'general', type: string) => {
  const id = to === 'general' ? 'general' : getOwned(r, to)?.ownedId;
  return id == null ? 0 : r.allocLog.filter((e) => e.to === id && e.type === type).length;
};

// ───────────── 装备与法术 ─────────────

export function equip(r: RunState, bagIdx: number, slot: number) {
  const id = r.bag[bagIdx], u = getOwned(r, slot);
  if (!id || !u || r.pending) return false;
  const eqs = [...(u.equips ?? [])];
  if (eqs.length >= equipCap(r)) r.bag.push(eqs.shift()!);
  eqs.push(id);
  r.bag.splice(bagIdx, 1);
  u.equips = eqs;
  return true;
}
export function unequip(r: RunState, slot: number, i: number) {
  const u = getOwned(r, slot);
  if (!u?.equips?.[i] || r.pending) return false;
  r.bag.push(u.equips[i]);
  u.equips = u.equips.filter((_, j) => j !== i);
  return true;
}
export function useSpell(r: RunState, i: number) {
  const id = r.spells[i];
  if (!id || screen(r) !== 'prep' || r.activeSpells.includes(id) || r.pending) return false;
  r.spells.splice(i, 1);
  r.activeSpells.push(id);
  return true;
}
export function unuseSpell(r: RunState, id: string) {
  const i = r.activeSpells.indexOf(id);
  if (i < 0 || r.pending) return false;
  r.activeSpells.splice(i, 1);
  r.spells.push(id);
  return true;
}
export function chooseReward(r: RunState, i: number) {
  if (!r.reward?.[i]) return false;
  r.bag.push(r.reward[i]);
  r.reward = null;
  return true;
}
const pickEquips = (r: RunState, n: number) => shuffle(r, EQUIPS.map((e) => e.id)).slice(0, n);

// ───────────── 商店 ─────────────

function makeShop(r: RunState, refreshCost: number): ShopState {
  const units = recommend(r, recInput(r), r.rec, 3, false)
    .map((id) => ({ id, price: UNIT_PRICE[unitDef(id).tier], sold: false }));
  const equips = pickEquips(r, 2).map((id) => ({ id, price: EQUIP_MAP[id].price, sold: false }));
  const spells = shuffle(r, SPELLS.map((s) => s.id)).slice(0, 2)
    .map((id) => ({ id, price: SPELLS.find((s) => s.id === id)!.price, sold: false }));
  const o = ORDERS[Math.max(0, weighted(r, ORDERS.map((x) => x.weight)))];
  const order = { id: o.id, price: o.price[0] + randInt(r, o.price[1] - o.price[0] + 1), sold: false };
  return { units, equips, spells, order, pack: { points: rollPoints(r, PACK_POINTS), price: PACK_PRICE, sold: false }, refreshCost };
}
export function refreshShop(r: RunState) {
  if (!r.shop || r.gold < r.shop.refreshCost) return false;
  r.gold -= r.shop.refreshCost;
  r.shop = makeShop(r, r.shop.refreshCost + 1);
  return true;
}
/** 买到的单位：先放第一个空备战位，再放空战位；都满时并入同名一星 */
export function unitDestination(r: RunState, defId: string): number | null {
  const b = r.bench.findIndex((u) => !u);
  if (b >= 0) return b + 5;
  const f = r.slots.findIndex((u) => !u);
  if (f >= 0) return f;
  const m = allOwned(r).findIndex((u) => u?.defId === defId && u.copies === 1);
  return m >= 0 ? m : null;
}
export type ShopKind = 'units' | 'equips' | 'spells' | 'order' | 'pack';
export function buy(r: RunState, kind: ShopKind, i = 0) {
  const s = r.shop;
  if (!s || screen(r) !== 'shop') return false;
  const item = kind === 'order' ? s.order : kind === 'pack' ? s.pack : s[kind][i];
  if (!item || item.sold || r.gold < item.price) return false;
  if (kind === 'units') {
    const id = (item as ShopItem).id, dst = unitDestination(r, id);
    if (dst === null) return false;
    const cur = getOwned(r, dst);
    if (cur) cur.copies = 2;
    else putOwned(r, dst, newOwned(r, id));
  } else if (kind === 'equips') r.bag.push((item as ShopItem).id);
  else if (kind === 'spells') r.spells.push((item as ShopItem).id);
  else if (kind === 'order') r.orders.push((item as ShopItem).id as OrderKind);
  else grantPoints(r, s.pack.points);
  r.gold -= item.price;
  item.sold = true;
  return true;
}

// ───────────── 主将升阶 ─────────────

function passiveNeedMet(r: RunState, p: PassiveDef) {
  if (!p.need) return true;
  const units = allOwned(r).filter((u): u is Slotted => !!u);
  const fam = (f: string) => units.some((u) => (unitDef(u.defId).tags ?? []).some((t) => tagFamily(t) === f));
  const eqs = [...r.bag, ...units.flatMap((u) => u.equips ?? [])];
  switch (p.need) {
    case 'burn': return fam('灼烧') || eqs.includes('eq_flame') || r.general === 'vulkan';
    case 'chill': return fam('寒意') || eqs.includes('eq_frost') || r.general === 'faie';
    case 'cast': return units.some((u) => !!unitDef(u.defId).cast);
    case 'extra': return fam('立即攻击') || r.general === 'hank';
    case 'equip2': return eqs.length >= 2;
  }
}
/** 1 个专属 + 2 个通用 */
function makePromo(r: RunState) {
  const own = PASSIVES.filter((p) => p.general === r.general && !r.passives.includes(p.id));
  const generic = PASSIVES.filter((p) => !p.general && !r.passives.includes(p.id));
  const out: string[] = [];
  if (own.length) out.push(own[randInt(r, own.length)].id);
  const pool = [...generic];
  while (out.length < 3 && pool.length) {
    const i = Math.max(0, weighted(r, pool.map((p) => (passiveNeedMet(r, p) ? 1 : 0.2))));
    out.push(pool[i].id);
    pool.splice(i, 1);
  }
  r.promo = out;
}
export function choosePromo(r: RunState, i: number) {
  const id = r.promo?.[i];
  if (!id || !PASSIVE_MAP[id]) return false;
  r.passives.push(id);
  r.promo = null;
  r.promoCount++;
  return true;
}
/** 已升阶（换二阶形象） */
export const promoted = (r: RunState) => r.promoCount > 0;

// ───────────── 战斗 ─────────────

export function buildBattle(r: RunState, slots: readonly (Slotted | null)[] = r.slots,
  bench: readonly (Slotted | null)[] = r.bench): BattleSetup {
  const node = currentBattle(r) ?? currentNode(r);
  return {
    player: slots.map(cloneOwned),
    enemy: node.lineup,
    general: { id: r.general, power: r.genPower, passives: [...r.passives] },
    spells: [...r.activeSpells],
    bench: bench.filter(Boolean).length,
    seed: (r.seed ^ Math.imul(battleNo(r) + 1, 0x2545f491) ^ r.history.length) | 0,
  };
}
/** 点「开战」：结果先算出、连同进行中标记一起存档；之后锁定本次分配 */
export function beginBattle(r: RunState, result: BattleResult, gold = 0) {
  r.pending = { result, gold };
  r.allocLog = [];
}
/** 播放完（或重进时）结算进行中的战斗 */
export function finishBattle(r: RunState) {
  const p = r.pending;
  if (!p) return false;
  r.pending = null;
  applyResult(r, p.result, p.gold);
  return true;
}

export const WIN_GOLD = { normal: 3, elite: 5, boss: 6 } as const;
export const LOSE_GOLD = 1;
export function applyResult(r: RunState, res: BattleResult, battleGold = 0) {
  if (r.over) return;
  const node = currentBattle(r);
  if (!node) return;
  r.history.push(res);
  r.gold += battleGold;
  r.lastPoints = [];
  if (res === 'win') {
    r.wins++;
    r.gold += WIN_GOLD[node.kind] + (r.passives.includes('g_pay') ? 2 : 0);
    const pts = rollPoints(r, (node.kind === 'elite' ? 4 : 3) + (r.passives.includes('g_drill') ? 1 : 0));
    r.lastPower = pts.filter((p) => p === 'power').length;
    r.lastPoints = pts;
    grantPoints(r, pts);
    if (node.kind === 'elite') r.reward = pickEquips(r, 3);
    if (node.kind === 'boss') {
      r.lives = Math.min(MAX_LIVES, r.lives + 1);
      if (r.chapter >= CHAPTER_COUNT - 1) { r.over = 'victory'; return; }
      makePromo(r);
    }
    advance(r);
    return;
  }
  if (res === 'lose') {
    r.gold += LOSE_GOLD;
    r.lives--;
    if (r.lives <= 0) { r.over = 'defeat'; return; }
    // 首领战败：留在原地，重新招募一轮再打
    if (node.kind === 'boss') { newDraftRound(r); r.allocLog = []; return; }
    advance(r);
    return;
  }
  // 平局：首领留在原地只能继续调阵；其他节点 +1 金、不扣命，前进
  if (node.kind === 'boss') return;
  r.gold += 1;
  advance(r);
}

export interface RewardedRetrySettlement {
  actualResult: BattleResult;
  authoritativeResult: Exclude<BattleResult, 'draw'>;
  lifeRestored: boolean;
}
function inventoryKey(units: readonly (Slotted | null)[]) {
  if (units.some((u) => u && !isCopies(u.copies))) throw new Error('重打库存含非法星级份数');
  return units.filter((u): u is Slotted => !!u).map((u) => [u.ownedId, u.defId, u.copies].join(':')).sort().join('|');
}
/** 广告重打：回到战前快照，用调整后的站位重打；胜负以重打为准 */
export function settleRewardedRetry(
  r: RunState, checkpoint: RunState, retrySlots: readonly (Slotted | null)[],
  actualResult: BattleResult, retryBench: readonly (Slotted | null)[] = checkpoint.bench, battleGold = 0,
): RewardedRetrySettlement {
  if (retrySlots.length !== 5 || retryBench.length !== BENCH_SLOTS || !retrySlots.some(Boolean)
    || inventoryKey([...retrySlots, ...retryBench]) !== inventoryKey(allOwned(checkpoint))
    || r.seed !== checkpoint.seed || r.general !== checkpoint.general) {
    throw new Error('重打阵容与原始快照不一致');
  }
  const next = cloneRun(checkpoint);
  next.pending = null;
  next.rewardedRetryCount = r.rewardedRetryCount;
  next.rewardedRerollCount = Math.max(r.rewardedRerollCount, checkpoint.rewardedRerollCount);
  next.slots = retrySlots.map(cloneOwned);
  next.bench = retryBench.map(cloneOwned);
  const authoritativeResult = actualResult === 'win' ? 'win' : 'lose';
  applyResult(next, authoritativeResult, battleGold);
  const lifeRestored = next.lives > r.lives;
  Object.assign(r, next);
  return { actualResult, authoritativeResult, lifeRestored };
}

export const describe = (defId: string, level: number, n?: number) => {
  const d = unitDef(defId), index = Math.max(0, Math.min(2, level - 1));
  const v = d.values?.[index] ?? 0;
  return (d.starText?.[index] ?? d.text).replace(/\{\+v\}/g, v > 0 ? ' +' + v : '')
    .replace(/\{v\}/g, String(v)).replace(/\{n\}/g, String(n ?? 1));
};
export { ORDER_MAP };
