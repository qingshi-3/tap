// v0.8 远征局内状态：章节与节点、招募、金币与商店、培养点、主将升阶、装备与法术。
// 纯数据 + 纯函数，UI 与模拟器共用；所有随机只走 rngState。
export { commitPreparation } from './preparation';
import { LEGACY_TIERS, modernEconomy, prepEvent, commitPreparation, preparationChanged } from './preparation';
import { ensureRunCareer, type CareerBattle } from './career';
import { ALL_FACTIONS, DRAFT_POOL, ROLE_TAGS, tagFamily, unitDef } from './data';
import {
  generalPowerSources, EQUIPS, EQUIP_MAP, ORDERS, ORDER_MAP, PASSIVES, PASSIVE_MAP, POINT_MAP, POINT_TYPES, SPELLS,
  TACTIC_IDS, type OrderKind, type PassiveDef,
} from './content';
import { chapter, battleIndex, CHAPTER_COUNT, STAGES_PER_CHAPTER, VARIANT_KEYS, type RouteNode, type Stage } from './route';
import { filtered, markSkipped, newRec, recommend, type RecState } from './recommend';
import { rand, randInt, shuffle, weighted } from './rng';
import { tutorialStage } from './tutorialEncounters';
import type { BattleSetup } from './engine';
import { isCopies, unitLevel, type ActiveFaction, type BattleResult, type EggStat, type Faction, type Slotted } from './types';

export { mulberry32 } from './rng';

export const SAVE_VERSION = 1;
/** 显示用版本号：只改数值时升这个，进行中的远征照常续玩 */
export const CONTENT_VERSION = '0.10.1';
/** 内容结构版本：增删单位/主将/被动/装备、改 RunState 结构时才升；升了旧远征作废，生涯保留 */
export const CONTENT_STRUCTURE = 1;
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
  /** Expedition-long generic passive, offered only by modern special shops. */
  boon?: ShopItem | null;
  pack: { points: string[]; price: number; sold: boolean } | null;
  refreshCost: number;
  /** Missing on historical shelves: infer from sold unit offers without resetting purchases. */
  unitsBought?: number;
}
/** 本次备战中的分配记录（开战前可撤销） */
export interface AllocEntry { to: number | 'general'; type: string }
export interface PendingBattle { result: BattleResult; gold: number; eggStats?: Record<EggStat, number> }

export interface RunState {
  /** 仅教学UI的临时远征使用（教学不保存）；显式字段让预览克隆保留课程路由。 */
  tutorialMode?: true;
  /** Missing means legacy general, promotion and special-shop rules. */
  tacticsVersion?: 1;
  commandTarget?: number;
  economyVersion?: 2;
  draftLocked?: boolean[];
  /** One-use next-budget bonuses; never unspent wallet carryover. */
  budgetBonus?: number;
  prepUses?: Record<string, number>;
  prepCommitted?: boolean;
  /** Persistent identity is unrelated to seed; old saves are assigned one on load. */
  runId?: string;
  /** Durable outbox, replayed only after run storage commits. */
  careerPending?: CareerBattle;
  /** New-game replacement outbox: previous expedition closes only after this save commits. */
  /** Explicit new-game transition token; ordinary callbacks cannot activate another run. */
  careerActivateFrom?: string | null;
  careerPrevious?: { id: string; general: string; outcome: 'victory' | 'defeat' | 'abandon' };
  saveVersion: number;
  contentVersion: string;
  /** 缺省视为 0.8.0 的结构 1 */
  contentStructure?: number;
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

  /** 蕾娃：本场开战前交换的敌方格位 */
  swaps?: [number, number][];
  /** 星角：龙蛋事件累计 */
  eggStats?: Record<EggStat, number>;
  /** 星角：上一场孵出的龙（结算提示用） */
  lastHatch?: string | null;
  /** 已获得但持有位满时尚未领取的龙蛋；旧档缺省为 0。 */
  pendingEggs?: number;
  /** 赫克：本场的临时佣兵 */
  merc?: ShopItem | null;
}

// ───────────── 开局 ─────────────

/** 本局 4 个阵营：和 newRun 用同一段随机 */
export function runFactions(seed: number): ActiveFaction[] {
  const fs = shuffle({ rngState: seed }, [...ALL_FACTIONS]);
  return ALL_FACTIONS.filter((f) => fs.slice(0, 4).includes(f));
}
export const TACTICAL_GENERALS = ['reva','zilan','sajj','kaleos'] as const;
export const modernTactics = (r: RunState) => r.tacticsVersion === 1 && !r.tutorialMode && r.economyVersion === 2;
/** Current player entry offers three of four generals, with no forced slot. */
export function generalChoices(seed: number): string[] {
  return shuffle({rngState:(seed ^ 0x51ed27)|0},[...TACTICAL_GENERALS]).slice(0,3);
}
export const randomSeed = () => (Math.random() * 2 ** 31) | 0;

export function newRun(general: string, seed = randomSeed(), options: { legacyEconomy?: boolean; legacyRules?: boolean } = {}): RunState {
  const r: RunState = {
    ...(!options.legacyRules && !options.legacyEconomy && TACTICAL_GENERALS.some(id => id === general) ? { tacticsVersion: 1 as const } : {}),
    ...(options.legacyEconomy ? {} : { economyVersion: 2 as const, draftLocked: Array(5).fill(false), budgetBonus: 0 }),
    saveVersion: SAVE_VERSION, contentVersion: CONTENT_VERSION, contentStructure: CONTENT_STRUCTURE, seed, general,
    lives: MAX_LIVES, chapter: 0, node: 0, wins: 0, history: [], over: null,
    slots: Array(5).fill(null), bench: Array(BENCH_SLOTS).fill(null), nextOwnedId: 1,
    activeFactions: [], variantChoices: {}, draft: [], picks: PICKS_PER_ROUND, rerolls: 1, rngState: seed, rec: newRec(),
    rewardedRetryCount: 0, rewardedRerollCount: 0,
    gold: 0, shop: null,
    stash: {}, allocLog: [], lastPower: 0, lastPoints: [],
    genPower: 0, passives: [], promo: null, promoCount: 0,
    bag: [], spells: [], activeSpells: [], orders: [], reward: null, forkPick: null, pending: null,
  };
  ensureRunCareer(r);
  r.activeFactions = options.legacyEconomy ? runFactions(seed) : [...ALL_FACTIONS];
  shuffle(r, [...ALL_FACTIONS]);
  for (const k of VARIANT_KEYS) r.variantChoices[k] = rand(r) < 0.5 ? 0 : 1;
  if (general === 'argeon') r.slots[0] = newOwned(r, 'x_argeon');
  if (general === 'xingjiao') { r.slots[0] = newOwned(r, 'x_egg'); r.eggStats = emptyEgg(); r.pendingEggs = 0; }
  enterNode(r);
  return r;
}

export const cloneOwned = (u: Slotted | null): Slotted | null =>
  u ? { ...u, ...(u.train ? { train: { ...u.train } } : {}), ...(u.equips ? { equips: [...u.equips] } : {}), ...(u.growth ? { growth: { ...u.growth } } : {}) } : null;
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

export const currentStage = (r: RunState, node = r.node): Stage =>
  (r.tutorialMode ? tutorialStage(r.chapter, node) : undefined) ?? chapter(r.chapter).stages[node];
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
  if (modernEconomy(r)) {
    r.gold = 10 + (r.budgetBonus ?? 0); r.budgetBonus = 0;
  }
  r.prepUses = {}; r.prepCommitted = false;
  r.forkPick = null;
  r.allocLog = [];
  r.activeSpells = [];
  r.swaps = [];
  if (currentStage(r).type === 'shop') {
    r.shop = makeShop(r, 1);
    if (!modernEconomy(r)) r.draft = []; r.picks = 0; r.rerolls = 0;
    r.merc = null;
  } else {
    r.shop = null;
    newDraftRound(r);
    prepareBattleExtras(r);
  }
}
/** 赫克：每场战斗前刷新临时佣兵；军需官再送一张法术 */
function prepareBattleExtras(r: RunState) {
  if (r.general !== 'hank') { r.merc = null; return; }
  const tier = r.passives.includes('hank_3') ? 3 : 2;
  const pool = DRAFT_POOL.filter((d) => (modernEconomy(r) ? d.tier : LEGACY_TIERS[d.id]) === tier && factionAvailable(r, d.faction));
  r.merc = pool.length ? { id: pool[randInt(r, pool.length)].id, price: 0, sold: false } : null;
  if (r.passives.includes('hank_4')) r.spells.push(SPELLS[randInt(r, SPELLS.length)].id);
}
function newDraftRound(r: RunState) {
  if (modernEconomy(r)) { r.picks = 1; r.rerolls = 0; rollDraft(r); return; }
  r.picks = PICKS_PER_ROUND;
  r.rerolls = 1;
  rollDraft(r);
}
function advance(r: RunState) {
  const leaving = { chapter: r.chapter, node: r.node };
  r.node++;
  if (r.node >= STAGES_PER_CHAPTER) { r.node = 0; r.chapter++; }
  if (r.chapter >= CHAPTER_COUNT) { r.chapter = CHAPTER_COUNT - 1; r.node = STAGES_PER_CHAPTER - 1; r.over = 'victory'; return; }
  if (!modernTactics(r) && leaving.chapter === PROMO_NODE.chapter && leaving.node === PROMO_NODE.node) makePromo(r);
  if (modernTactics(r) && leaving.chapter < 2 && leaving.node === 4) makePromo(r);
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
  return battle < 2 ? 1 : battle < 5 ? 2 : battle < 8 ? 3 : battle < 11 ? 4 : battle < 14 ? 5 : 6;
}
const legacyCap = (battle: number) => Math.min(4, tierCap(battle));
function legacyWeights(battle: number) { return battle < 2 ? [100,0,0,0] : battle < 5 ? [60,40,0,0] : battle < 8 ? [35,45,20,0] : battle < 15 ? [25,35,30,10] : [20,30,35,15]; }
export function qualityWeights(battle: number): readonly number[] {
  return [[100,0,0,0,0,0],[60,40,0,0,0,0],[35,40,25,0,0,0],[20,30,30,20,0,0],[15,20,25,25,15,0],[10,15,20,25,20,10]][tierCap(battle)-1];
}
export const factionAvailable = (r: RunState, f: Faction) => f === 'neutral' || r.activeFactions.includes(f as ActiveFaction);
export const draftPool = (r: RunState) =>
  DRAFT_POOL.filter((d) => (modernEconomy(r) ? d.tier <= tierCap(battleNo(r)) : (LEGACY_TIERS[d.id] ?? 99) <= legacyCap(battleNo(r))) && factionAvailable(r, d.faction));

function recInput(r: RunState) {
  return { pool: draftPool(r).map(d => modernEconomy(r) ? d : ({ ...d, tier: LEGACY_TIERS[d.id] as typeof d.tier })), weights: modernEconomy(r) ? qualityWeights(battleNo(r)) : legacyWeights(battleNo(r)), owned: allOwned(r), field: r.slots, tacticsVersion: modernTactics(r) ? 1 as const : undefined };
}
/** 推荐算法生成本轮 3 张候选；上一轮没拿的卡记为跳过 */
export function rollDraft(r: RunState): boolean {
  if (modernEconomy(r)) {
    const pool = draftPool(r);
    if (!pool.length) return false;
    const savedRng = r.rngState;
    const rec = structuredClone(r.rec); rec.skipped = [];
    const ids = recommend(r, recInput(r), rec, 5);
    if (ids.length < 5) { r.rngState = savedRng; return false; }
    r.rec = rec;
    r.draft = ids.map((id,i) => r.draftLocked?.[i] && r.draft[i] ? r.draft[i] : id);
    r.draftLocked = r.draft.map((id,i) => !!id && !!r.draftLocked?.[i]);
    return true;
  }
  const savedRng = r.rngState;
  const savedRec = structuredClone(r.rec);
  const ids = recommend(r, recInput(r), r.rec, 3);
  if (ids.length < 3) { r.rngState = savedRng; r.rec = savedRec; return false; }
  markSkipped(r.rec, r.draft);
  r.draft = ids;
  return true;
}
/** 兼容已卖空且耗尽招募的旧存档；只补一次招募，不重置局内进度。 */
export function recoverEmptyRoster(r: RunState): boolean {
  if (modernEconomy(r) || r.over || r.pending || screen(r) !== 'prep' || r.picks > 0 || allOwned(r).some(Boolean)) return false;
  if (!rollDraft(r)) return false;
  r.picks = 1;
  return true;
}
export function reroll(r: RunState) {
  if (modernEconomy(r)) {
    if (r.over || r.pending || screen(r) !== 'prep' || r.gold < 1 || !hasRefreshableDraft(r)) return false;
    if (!rollDraft(r)) return false;
    r.gold--; return true;
  }
  if (r.over || r.rerolls <= 0 || r.picks <= 0) return false;
  if (!rollDraft(r)) return false;
  r.rerolls--;
  return true;
}
export const remainingRewardedRerolls = (r: RunState) => Math.max(0, MAX_REWARDED_REROLLS - r.rewardedRerollCount);
const hasRefreshableDraft = (r: RunState) => r.draft.some((id,i) => !id || !r.draftLocked?.[i]);
export const canRewardedReroll = (r: RunState) => !r.over && !r.pending && screen(r) === 'prep' && r.picks > 0 && remainingRewardedRerolls(r) > 0
  && (modernEconomy(r) ? r.gold < 1 && hasRefreshableDraft(r) : r.rerolls === 0);
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
export const ORDER_TAGS = [...ROLE_TAGS, '嘲讽', '轮换', '决斗', '蓄力', '节拍', '格挡', '复生', '连击', '狙击', '法强', '反击', '灼烧', '溅射', '寒意', '护甲', '追击', '行动次数', '献祭']
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
    case 'o_faction': return [...r.activeFactions, 'neutral'].filter((f) => orderPool(r, kind, f).length >= (modernEconomy(r) ? 1 : 3));
    case 'o_tag': return ORDER_TAGS.filter((t) => (!modernTactics(r) || (t !== '蓄力' && t !== '节拍')) && orderPool(r, kind, t).length >= (modernEconomy(r) ? 1 : 3));
    case 'o_named': {
      const pool = new Set(draftPool(r).map((d) => d.id));
      return [...new Set(allOwned(r).filter((u): u is Slotted => !!u && u.copies < 4 && pool.has(u.defId)).map((u) => u.defId))];
    }
  }
}
/** 使用招募令：立即按筛选重新生成本轮候选，不消耗刷新次数 */
export function useOrder(r: RunState, index: number, choice: string) {
  const kind = r.orders[index];
  if (!kind || r.over || r.pending || r.picks <= 0 || screen(r) !== 'prep' || !orderOptions(r, kind).includes(choice)) return false;
  const pool = orderPool(r, kind, choice).map(d => modernEconomy(r) ? d : ({...d, tier: LEGACY_TIERS[d.id] as typeof d.tier}));
  if (modernEconomy(r)) {
    const writable = Array.from({length:5},(_,i)=>i).filter(i => !r.draftLocked?.[i] || !r.draft[i]);
    if (!writable.length || !pool.length) return false;
    const savedRng = r.rngState;
    const ids = filtered(r, pool, qualityWeights(battleNo(r)), Math.min(writable.length,pool.length), kind === 'o_named' ? choice : undefined);
    if (!ids.length || (kind === 'o_named' && !ids.includes(choice))) { r.rngState = savedRng; return false; }
    const next = Array.from({length:5},(_,i)=>r.draft[i] ?? '');
    writable.forEach((slot,i)=> { next[slot] = ids[i] ?? ''; });
    r.draft = next;
    r.draftLocked = next.map((id,i) => !!id && !!r.draftLocked?.[i]);
  } else {
    const ids = filtered(r,pool,legacyWeights(battleNo(r)),3,kind === 'o_named' ? choice : undefined);
    if (ids.length < 3) return false;
    markSkipped(r.rec,r.draft); r.draft = ids;
  }
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
  if (cur.defId === defId && !cur.temp) return cur.copies === 1 ? 'merge' : 'invalid';
  if (reserveDestination(r, slot) !== null) return 'reserve';
  return canSell(r, slot) ? 'replace' : 'invalid';
}
const newOwned = (r: RunState, defId: string): Slotted => ({ defId, ownedId: r.nextOwnedId++, copies: 1 });
/** 被覆盖的单位按卖出处理（金币、培养点、装备全额返还） */
export function takeDraft(r: RunState, draftIdx: number, slot: number, confirmDismiss = false): PlaceResult {
  if (r.over || r.pending || r.picks <= 0 || !Number.isInteger(draftIdx) || screen(r) !== 'prep') return 'invalid';
  const id = r.draft[draftIdx];
  if (!id) return 'invalid';
  const kind = placeKind(r, id, slot);
  if (kind === 'invalid') return kind;
  if (kind === 'replace' && !confirmDismiss) return 'confirm';
  if (modernEconomy(r) && !canBuyDraft(r, draftIdx, slot)) return 'invalid';
  const bought = newOwned(r, id);
  if (modernEconomy(r)) {
    r.gold -= 3; r.draft[draftIdx] = ''; if (r.draftLocked) r.draftLocked[draftIdx] = false;
  } else { r.picks--; r.draft.splice(draftIdx, 1); }
  if (kind === 'reserve') putOwned(r, reserveDestination(r, slot)!, getOwned(r, slot));
  if (kind === 'replace') sellOwned(r, slot);
  if (kind !== 'merge') putOwned(r, slot, bought);
  // Buy hooks observe the newly bought one-star individual, before upgrade hooks.
  prepEvent(r, 'buy', bought);
  if (kind === 'merge') { mergeInto(r, bought, getOwned(r, slot)!); prepEvent(r, 'upgrade', getOwned(r, slot)!); }
  if (!modernEconomy(r)) {
    if (r.picks > 0) rollDraft(r);
    else { markSkipped(r.rec, r.draft); r.draft = []; }
  }
  claimPendingEggs(r);
  preparationChanged(r);
  return kind;
}
export type MoveResult = 'move' | 'swap' | 'merge' | 'invalid';
export function moveKind(r: RunState, from: number, to: number, mode: 'auto' | 'swap' = 'auto'): MoveResult {
  if (!validSlot(from) || !validSlot(to) || from === to) return 'invalid';
  const a = getOwned(r, from), b = getOwned(r, to);
  if (!a || !isCopies(a.copies) || (b && !isCopies(b.copies))) return 'invalid';
  if (!b) return 'move';
  if (mode === 'swap' || a.temp || b.temp || a.defId !== b.defId || a.copies !== b.copies || a.copies === MAX_COPIES) return 'swap';
  return 'merge';
}
export const equipCap = (r: RunState) => (r.passives.includes('g_dual') ? 2 : 1);
/** 合并：份数相加，培养点相加，装备保留到上限、多余回背包 */
function mergeInto(r: RunState, src: Slotted, dst: Slotted) {
  if (r.commandTarget === src.ownedId) r.commandTarget = dst.ownedId;
  dst.copies = dst.copies === 1 ? 2 : 4;
  if (src.train) {
    dst.train = { ...(dst.train ?? {}) };
    for (const [k, n] of Object.entries(src.train)) dst.train[k] = (dst.train[k] ?? 0) + (n ?? 0);
  }
  if (src.growth) {
    dst.growth ??= {};
    for (const stat of ['atk','hp','power'] as const) dst.growth[stat] = (dst.growth[stat] ?? 0) + (src.growth[stat] ?? 0);
  }
  // Preserve consumed source limits when its identity is merged away.
  for (const [key, value] of Object.entries(r.prepUses ?? {})) if (key.startsWith(`${src.ownedId}:`)) {
    const next = `${dst.ownedId}:${key.split(':')[1]}`; r.prepUses![next] = Math.max(r.prepUses![next] ?? 0, value); delete r.prepUses![key];
  }
  const eqs = [...(dst.equips ?? []), ...(src.equips ?? [])];
  dst.equips = eqs.slice(0, equipCap(r));
  r.bag.push(...eqs.slice(equipCap(r)));
  for (const e of r.allocLog) if (e.to === src.ownedId) e.to = dst.ownedId;
}
export function moveSlot(r: RunState, from: number, to: number, mode: 'auto' | 'swap' = 'auto'): MoveResult {
  if (r.pending || r.over) return 'invalid';
  const kind = moveKind(r, from, to, mode);
  if (kind === 'invalid') return kind;
  const a = getOwned(r, from)!, b = getOwned(r, to);
  if (kind === 'merge') { mergeInto(r, a, b!); putOwned(r, from, null); prepEvent(r, 'upgrade', b!); }
  else { putOwned(r, to, a); putOwned(r, from, b); }
  claimPendingEggs(r);
  preparationChanged(r);
  return kind;
}
/** 卖出价：每份 1 金；临时佣兵不值钱 */
export const sellPrice = (u: Slotted, r?: RunState) => (u.temp ? 0 : r && modernEconomy(r) ? unitLevel(u) : u.copies);
/** 阿尔吉昂本人不能出售 */
export const sellable = (u: Slotted) => u.defId !== 'x_argeon';
/** Includes the bench: replacing a protected body may reserve it, but never dismiss it. */
export function sellBlockReason(r: RunState, slot: number): string | null {
  const u = getOwned(r, slot);
  if (!u) return '该位置没有单位';
  if (!sellable(u)) return '阿尔吉昂本人不能出售';
  const bloodline = (id: string) => id === 'x_egg' || Object.values(DRAGON_OF).includes(id);
  if (r.general === 'xingjiao' && bloodline(u.defId) && !((r.pendingEggs ?? 0) > 0)
      && allOwned(r).filter(x => x && bloodline(x.defId)).length <= 1) return '星角最后的龙蛋或龙不能出售';
  if (r.over || r.pending) return '当前状态不能出售';
  if (screen(r) === 'prep' && (modernEconomy(r) ? r.gold < 2 : r.picks <= 0) && allOwned(r).filter(Boolean).length <= 1) return '保留最后一名单位才能继续远征';
  return null;
}
/** Recruitment exhaustion and the general's last bloodline share the same dismissal guard. */
export function canSell(r: RunState, slot: number): boolean {
  return sellBlockReason(r, slot) === null;
}
export function sell(r: RunState, slot: number) {
  if (!sellOwned(r, slot)) return false;
  claimPendingEggs(r);
  preparationChanged(r); return true;
}
/** 覆盖招募先完成放置，再兑现待领蛋，避免抢占招募目标格。 */
function sellOwned(r: RunState, slot: number) {
  if (!canSell(r, slot)) return false;
  const u = getOwned(r, slot)!;
  r.gold += sellPrice(u, r);
  for (const [k, n] of Object.entries(u.train ?? {})) if (n) r.stash[k] = (r.stash[k] ?? 0) + n;
  r.bag.push(...(u.equips ?? []));
  r.allocLog = r.allocLog.filter((e) => e.to !== u.ownedId);
  putOwned(r, slot, null);
  if (r.commandTarget === u.ownedId) delete r.commandTarget;
  prepEvent(r, 'sell', u, slot < 5 ? slot : undefined);
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
/** Only current skill uses permit new investments; saved power and refunds remain intact. */
export const canTrainGeneral = (r: RunState): boolean => !modernTactics(r) && generalPowerSources(r.general, r.passives).length > 0;
/** 分配一点到单位（持有位）或主将 */
export function allocPoint(r: RunState, to: number | 'general', type: string) {
  const p = POINT_MAP[type];
  if (!p || !(r.stash[type] > 0) || r.over || r.pending) return false;
  if (to === 'general') {
    if (!p.toGeneral || !canTrainGeneral(r)) return false;
    r.genPower++;
    r.allocLog.push({ to: 'general', type });
  } else {
    const u = getOwned(r, to);
    if (!u) return false;
    u.train = { ...(u.train ?? {}), [type]: (u.train?.[type] ?? 0) + 1 };
    r.allocLog.push({ to: u.ownedId, type });
  }
  r.stash[type]--;
  preparationChanged(r); return true;
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
  preparationChanged(r); return true;
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
  preparationChanged(r); return true;
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
  preparationChanged(r); return true;
}
export function unequip(r: RunState, slot: number, i: number) {
  const u = getOwned(r, slot);
  if (!u?.equips?.[i] || r.pending) return false;
  r.bag.push(u.equips[i]);
  u.equips = u.equips.filter((_, j) => j !== i);
  preparationChanged(r); return true;
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
const pickEquips = (r: RunState, n: number) => shuffle(r, EQUIPS.filter(e => !modernTactics(r) || e.id !== 'eq_hourglass').map((e) => e.id)).slice(0, n);

// ───────────── 商店 ─────────────

const SHOP_BOONS = new Set(['g_wall','g_drill','g_horde','g_store','g_relay','g_ember','g_tide','g_martyr']);
function makeShop(r: RunState, refreshCost: number): ShopState {
  const input = recInput(r);
  if (modernEconomy(r)) {
    const tier = Math.min(6, tierCap(battleNo(r)) + 1);
    input.pool = DRAFT_POOL.filter(d => d.tier === tier);
    input.weights = Array.from({length:6}, (_,i) => i+1 === tier ? 1 : 0);
  }
  const units = recommend(r, input, r.rec, 3, false)
    .map((id) => ({ id, price: modernEconomy(r) ? 3 : UNIT_PRICE[LEGACY_TIERS[id] ?? unitDef(id).tier], sold: false }));
  if (modernTactics(r)) {
    // Keep six auxiliary positions while shifting scarce training toward the opening.
    const index = Math.max(0, Math.min(2, r.chapter));
    const hasPack = rand(r) < [0.75,0.25,0][index];
    const hasOrder = rand(r) < [0,0.5,0.75][index];
    const pack = hasPack ? {points:rollPoints(r,PACK_POINTS),price:PACK_PRICE,sold:false} : null;
    const o = hasOrder ? ORDERS[Math.max(0,weighted(r,ORDERS.map(x=>x.weight)))] : null;
    const order = o ? {id:o.id,price:o.price[0]+randInt(r,o.price[1]-o.price[0]+1),sold:false} : null;
    const equips = pickEquips(r,hasPack ? 2 : 3).map(id=>({id,price:EQUIP_MAP[id].price,sold:false}));
    const spells = shuffle(r,SPELLS.map(s=>s.id)).slice(0,hasOrder ? 2 : 3)
      .map(id=>({id,price:SPELLS.find(s=>s.id===id)!.price,sold:false}));
    return {units,equips,spells,pack,order,refreshCost,unitsBought:0};
  }
  const equips = pickEquips(r, 2).map((id) => ({ id, price: EQUIP_MAP[id].price, sold: false }));
  const spells = shuffle(r, SPELLS.map((s) => s.id)).slice(0, 2)
    .map((id) => ({ id, price: SPELLS.find((s) => s.id === id)!.price, sold: false }));
  const o = ORDERS[Math.max(0, weighted(r, ORDERS.map((x) => x.weight)))];
  const order = { id: o.id, price: o.price[0] + randInt(r, o.price[1] - o.price[0] + 1), sold: false };
  const shop: ShopState = { units, equips, spells, order, pack: { points: rollPoints(r, PACK_POINTS), price: PACK_PRICE, sold: false }, refreshCost };
  if (modernEconomy(r) && !modernTactics(r)) {
    const eligible = PASSIVES.filter(p => !p.general && SHOP_BOONS.has(p.id) && !r.passives.includes(p.id) && passiveNeedMet(r,p));
    shop.boon = eligible.length ? {id: eligible[randInt(r,eligible.length)].id, price:6, sold:false} : null;
    if (shop.boon) shop.spells = shop.spells.slice(0,1);
  }
  return shop;
}
export function refreshShop(r: RunState) {
  if (modernTactics(r)) return false;
  if (!r.shop || r.gold < r.shop.refreshCost) return false;
  r.gold -= r.shop.refreshCost;
  r.shop = makeShop(r, modernEconomy(r) ? 1 : r.shop.refreshCost + 1);
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
/** Historical generated shelves can already have three sales; never remove their purchases. */
export function shopUnitBuysRemaining(r: RunState): number {
  if (!r.shop) return 0;
  if (!modernTactics(r)) return r.shop.units.filter(item=>!item.sold).length;
  const used = Math.max(r.shop.unitsBought ?? 0, r.shop.units.filter(item=>item.sold).length);
  return Math.max(0,2-used);
}
export type ShopKind = 'units' | 'equips' | 'spells' | 'order' | 'pack' | 'boon';
export function buy(r: RunState, kind: ShopKind, i = 0) {
  const s = r.shop;
  if (!s || screen(r) !== 'shop') return false;
  const item = kind === 'boon' ? s.boon : kind === 'order' ? s.order : kind === 'pack' ? s.pack : s[kind][i];
  if (!item || item.sold || r.gold < item.price) return false;
  if (kind === 'boon') {
    const passive = PASSIVE_MAP[(item as ShopItem).id];
    if (!modernEconomy(r) || modernTactics(r) || !passive || passive.general || r.passives.includes(passive.id)
      || !Number.isSafeInteger(item.price) || item.price <= 0) return false;
    r.gold -= item.price; item.sold = true; r.passives.push(passive.id); preparationChanged(r); return true;
  }
  if (kind === 'units') {
    if (modernTactics(r) && shopUnitBuysRemaining(r) === 0) return false;
    const id = (item as ShopItem).id, dst = unitDestination(r, id);
    if (dst === null) return false;
    const cur = getOwned(r, dst);
    const purchased = newOwned(r, id);
    if (modernTactics(r)) s.unitsBought = Math.max(s.unitsBought ?? 0,s.units.filter(item=>item.sold).length) + 1;
    r.gold -= item.price; item.sold = true;
    if (!cur) putOwned(r, dst, purchased);
    prepEvent(r, 'buy', purchased);
    if (cur) { mergeInto(r, purchased, cur); prepEvent(r, 'upgrade', cur); }
    preparationChanged(r); return true;
  } else if (kind === 'equips') r.bag.push((item as ShopItem).id);
  else if (kind === 'spells') r.spells.push((item as ShopItem).id);
  else if (kind === 'order') r.orders.push((item as ShopItem).id as OrderKind);
  else grantPoints(r, s.pack!.points);
  r.gold -= item.price;
  item.sold = true;
  preparationChanged(r); return true;
}

// ───────────── 主将专属 ─────────────

/** 赫克：雇佣本场的临时佣兵（只参加本场） */
export function hireMerc(r: RunState) {
  const m = r.merc;
  if (!m || m.sold || r.gold < m.price || r.pending || screen(r) !== 'prep') return false;
  const f = r.slots.findIndex((u) => !u), b = r.bench.findIndex((u) => !u);
  const dst = f >= 0 ? f : b >= 0 ? b + 5 : -1;
  if (dst < 0) return false;
  putOwned(r, dst, { ...newOwned(r, m.id), temp: true });
  r.gold -= m.price;
  m.sold = true;
  preparationChanged(r); return true;
}
export const SIGN_PRICE = 3;
/** 赫克「长约」：临时佣兵花 3 金转正 */
export function signMerc(r: RunState, slot: number) {
  const u = getOwned(r, slot);
  if (!u?.temp || r.general !== 'hank' || !r.passives.includes('hank_1') || r.gold < SIGN_PRICE
    || r.pending || r.over || screen(r) !== 'prep') return false;
  r.gold -= SIGN_PRICE;
  delete u.temp;
  prepEvent(r, 'buy', u);
  preparationChanged(r); return true;
}
/** 战后遣散临时佣兵：培养点与装备退回 */
function dismissTemps(r: RunState) {
  for (let i = 0; i < OWNED_SLOTS; i++) {
    const u = getOwned(r, i);
    if (!u?.temp) continue;
    for (const [k, n] of Object.entries(u.train ?? {})) if (n) r.stash[k] = (r.stash[k] ?? 0) + n;
    r.bag.push(...(u.equips ?? []));
    putOwned(r, i, null);
  }
}

/** 蕾娃：本场可交换次数 */
export const swapCap = (r: RunState) => (r.general !== 'reva' ? 0 : r.passives.includes('reva_1') ? 2 : 1);
/** 蕾娃：记录一次开战前的敌方换位；超过次数时替换最早的一次 */
export function addSwap(r: RunState, a: number, b: number) {
  if (!swapCap(r) || a === b || r.pending || ![a, b].every((i) => Number.isInteger(i) && i >= 0 && i < 5)) return false;
  const swaps = [...(r.swaps ?? []), [a, b] as [number, number]];
  r.swaps = swaps.slice(-swapCap(r));
  return true;
}
export function clearSwaps(r: RunState) { r.swaps = []; }

/** 萨吉：预备位格数；预备位即备战区最前面的格子 */
export const reserveSlots = (r: RunState) => (r.general !== 'sajj' ? 0 : r.passives.includes('sajj_3') ? 2 : 1);

const EGG_ORDER: EggStat[] = ['death', 'burn', 'freeze', 'move', 'summon'];
export const DRAGON_OF: Record<EggStat, string> = { death: 'x_bone', burn: 'x_fire', freeze: 'x_frostd', move: 'x_wind', summon: 'x_brood' };
const emptyEgg = (): Record<EggStat, number> => ({ death: 0, burn: 0, freeze: 0, move: 0, summon: 0 });
export const eggThreshold = (r: RunState) => (r.passives.includes('xingjiao_1') ? 8 : 12);
/** 只兑现已经获得的蛋，不推断或补发旧档历史奖励；备战位优先。 */
export function claimPendingEggs(r: RunState): number {
  if (r.general !== 'xingjiao' || r.pending || r.over) return 0;
  let claimed = 0;
  while ((r.pendingEggs ?? 0) > 0) {
    const b = r.bench.findIndex((u) => !u), f = r.slots.findIndex((u) => !u);
    const dst = b >= 0 ? b + 5 : f >= 0 ? f : -1;
    if (dst < 0) break;
    putOwned(r, dst, newOwned(r, 'x_egg'));
    r.pendingEggs = (r.pendingEggs ?? 0) - 1;
    claimed++;
  }
  return claimed;
}
/** 星角：战后累计龙蛋事件，任一类满阈值就孵化持有的第一颗蛋 */
function growEgg(r: RunState, stats?: Record<EggStat, number>) {
  if (r.lastHatch != null) delete r.lastHatch;
  if (r.general !== 'xingjiao' || !stats) return;
  const eggAt = allOwned(r).findIndex((u) => u?.defId === 'x_egg');
  if (eggAt < 0) return;
  const acc = r.eggStats ?? emptyEgg();
  for (const k of EGG_ORDER) acc[k] += stats[k] ?? 0;
  r.eggStats = acc;
  const top = EGG_ORDER.reduce((a, b) => (acc[b] > acc[a] ? b : a));
  if (acc[top] < eggThreshold(r)) return;
  const egg = getOwned(r, eggAt)!;
  egg.defId = DRAGON_OF[top];
  r.lastHatch = egg.defId;
  r.eggStats = emptyEgg();
  if (r.passives.includes('xingjiao_2')) {
    r.pendingEggs = (r.pendingEggs ?? 0) + 1;
  }
  claimPendingEggs(r);
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
    case 'cast': return units.some((u) => modernTactics(r) ? !!(unitDef(u.defId).cast?.length || unitDef(u.defId).chargeSkill?.length) : !!unitDef(u.defId).cast);
    case 'extra': return units.some(u => {
      const d = unitDef(u.defId);
      // General force commands have their own allowance and cannot benefit from chain.
      const effects = [d.cast, d.chargeSkill, d.onStart, d.afterAttack, d.onHurt, d.onKill, d.onDuelKill, d.onRattle, d.onAllyFaint,
        d.onBeatEnd, d.onRevive, d.onEnemyFreeze, d.onFront, d.onPulse];
      return r.general === 'kaleos' || d.special === 'wyvern' || d.special === 'viper' || effects.some(es => es?.some(e => e.op === 'extraAct')) ||
        (u.equips ?? []).some(id => [EQUIP_MAP[id]?.onStart, EQUIP_MAP[id]?.afterAttack].some(es => es?.some(e => e.op === 'extraAct')));
    });
    case 'equip2': return eqs.length >= 2;
    case 'rotate': return fam('轮换') || eqs.includes('eq_boots') || r.general === 'zilan' || r.passives.includes('argeon_4');
    case 'duel': return fam('决斗') || eqs.includes('eq_duel') || r.passives.includes('argeon_2');
    case 'charge': return fam('蓄力') || eqs.includes('eq_hourglass');
    case 'rattle': return fam('亡语') || r.general === 'kasiva';
    case 'summon': return fam('召唤') || r.passives.includes('lilithe_2');
    case 'taunt': return fam('嘲讽') || eqs.includes('eq_guard') || r.passives.includes('argeon_1');
  }
}
/** Two distinct unowned exclusive choices, then weighted generic fill. */
function makePromo(r: RunState) {
  if (modernTactics(r)) {
    if (r.promo || r.promoCount >= 2) return;
    const pool = PASSIVES.filter(p => (TACTIC_IDS as readonly string[]).includes(p.id) && !p.general && !r.passives.includes(p.id) && passiveNeedMet(r,p));
    r.promo = shuffle(r,pool).slice(0,3).map(p => p.id);
    if (!r.promo.length) r.promo = null;
    return;
  }
  const own = PASSIVES.filter((p) => p.general === r.general && !r.passives.includes(p.id));
  const generic = PASSIVES.filter((p) => !p.general && !r.passives.includes(p.id) && (p.id !== 'g_chain' || passiveNeedMet(r, p)));
  const out: string[] = [];
  while (out.length < 2 && own.length) out.push(own.splice(randInt(r, own.length), 1)[0].id);
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
  if (!id || !PASSIVE_MAP[id] || r.over || r.pending) return false;
  if (modernTactics(r) && (r.promoCount >= 2 || !(TACTIC_IDS as readonly string[]).includes(id)
    || r.passives.includes(id) || !passiveNeedMet(r,PASSIVE_MAP[id]))) return false;
  r.passives.push(id);
  r.promo = null;
  r.promoCount++;
  if (r.general === 'xingjiao' && id === 'xingjiao_2'
    && !allOwned(r).some((u) => u?.defId === 'x_egg')
    && allOwned(r).some((u) => u && Object.values(DRAGON_OF).includes(u.defId))) {
    r.pendingEggs = (r.pendingEggs ?? 0) + 1;
  }
  claimPendingEggs(r);
  preparationChanged(r); return true;
}
/** 已升阶（换二阶形象） */
export const promoted = (r: RunState) => r.promoCount > 0;

// ───────────── 战斗 ─────────────

export function buildBattle(r: RunState, slots: readonly (Slotted | null)[] = r.slots,
  bench: readonly (Slotted | null)[] = r.bench): BattleSetup {
  if (!r.tutorialMode && !r.prepCommitted) {
    const preview = cloneRun(r); preview.slots = slots.map(cloneOwned); preview.bench = bench.map(cloneOwned);
    commitPreparation(preview); return buildBattle(preview, preview.slots, preview.bench);
  }
  const node = currentBattle(r) ?? currentNode(r);
  const reserve = reserveSlots(r);
  return {
    player: slots.map(cloneOwned),
    enemy: node.lineup,
    rules: node.rules,
    general: { id: r.general, power: r.genPower, passives: [...r.passives], ...(modernTactics(r) ? {tacticsVersion: 1 as const, ...(r.commandTarget !== undefined ? {commandTarget:r.commandTarget} : {})} : {}) },
    spells: [...r.activeSpells],
    chapter: r.chapter + 1,
    ...(r.swaps?.length ? { swaps: r.swaps.map((s) => [...s] as [number, number]) } : {}),
    ...(reserve ? { reserve: bench.slice(0, reserve).map(cloneOwned) } : {}),
    bench: bench.filter(Boolean).length,
    seed: (r.seed ^ Math.imul(battleNo(r) + 1, 0x2545f491) ^ r.history.length) | 0,
  };
}
/** 点「开战」：结果先算出、连同进行中标记一起存档；之后锁定本次分配 */
export function beginBattle(r: RunState, result: BattleResult, gold = 0, eggStats?: Record<EggStat, number>) {
  if (r.pending || r.over) return;
  commitPreparation(r);
  r.pending = { result, gold, ...(eggStats ? { eggStats } : {}) };
  r.allocLog = [];
}
/** 播放完（或重进时）结算进行中的战斗 */
export function finishBattle(r: RunState) {
  const p = r.pending;
  if (!p) return false;
  r.pending = null;
  applyResult(r, p.result, p.gold, p.eggStats);
  return true;
}

export const WIN_GOLD = { normal: 3, elite: 5, boss: 6 } as const;
export const LOSE_GOLD = 1;
export function applyResult(r: RunState, res: BattleResult, battleGold = 0, eggStats?: Record<EggStat, number>) {
  if (r.over) return;
  const node = currentBattle(r);
  if (!node) return;
  commitPreparation(r);
  // 正式结算即消耗本场法术，包含留在原节点的首领败局/平局和终局。
  // 重打读取独立的战前快照；战前撤销仍由 unuseSpell 处理。
  r.activeSpells = [];
  r.swaps = [];
  r.history.push(res);
  if (modernEconomy(r)) { if (res !== 'draw') r.budgetBonus = (r.budgetBonus ?? 0) + battleGold; }
  else r.gold += battleGold;
  r.lastPoints = [];
  dismissTemps(r);
  if (r.merc) r.merc.sold = true;
  growEgg(r, eggStats);
  claimPendingEggs(r);
  if (res === 'win') {
    r.wins++;
    const bonus = (modernEconomy(r) ? 0 : WIN_GOLD[node.kind]) + (r.passives.includes('g_pay') ? 2 : 0) + (r.general === 'hank' ? 1 : 0);
    if (modernEconomy(r)) r.budgetBonus = (r.budgetBonus ?? 0) + bonus; else r.gold += bonus;
    const pts = rollPoints(r, (node.kind === 'elite' ? 4 : 3) + (r.passives.includes('g_drill') ? 1 : 0));
    r.lastPower = pts.filter((p) => p === 'power').length;
    r.lastPoints = pts;
    grantPoints(r, pts);
    if (node.kind === 'elite') r.reward = pickEquips(r, 3);
    if (node.kind === 'boss') {
      r.lives = Math.min(MAX_LIVES, r.lives + 1);
      if (r.chapter >= CHAPTER_COUNT - 1) { r.over = 'victory'; return; }
      if (!modernTactics(r)) makePromo(r);
    }
    advance(r);
    return;
  }
  if (res === 'lose') {
    if (!modernEconomy(r)) r.gold += LOSE_GOLD;
    r.lives--;
    if (r.lives <= 0) { r.over = 'defeat'; return; }
    // 首领战败：留在原地，重新招募一轮再打
    if (node.kind === 'boss') { if (modernEconomy(r)) { r.gold = 10 + (r.budgetBonus ?? 0); r.budgetBonus = 0; } r.prepUses = {}; r.prepCommitted = false; newDraftRound(r); prepareBattleExtras(r); r.allocLog = []; return; }
    advance(r);
    return;
  }
  // 平局：首领留在原地只能继续调阵；其他节点 +1 金、不扣命，前进
  // A boss draw resumes the same preparation: no budget, engine-cap or free-extra reset.
  if (node.kind === 'boss') return;
  if (!modernEconomy(r)) r.gold += 1;
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
  eggStats?: Record<EggStat, number>,
): RewardedRetrySettlement {
  if (retrySlots.length !== 5 || retryBench.length !== BENCH_SLOTS || !retrySlots.some(Boolean)
    || inventoryKey([...retrySlots, ...retryBench]) !== inventoryKey(allOwned(checkpoint))
    || r.seed !== checkpoint.seed || r.general !== checkpoint.general
    || (!!r.runId && !!checkpoint.runId && r.runId !== checkpoint.runId)) {
    throw new Error('重打阵容与原始快照不一致');
  }
  const next = cloneRun(checkpoint);
  next.pending = null;
  next.rewardedRetryCount = r.rewardedRetryCount;
  next.rewardedRerollCount = Math.max(r.rewardedRerollCount, checkpoint.rewardedRerollCount);
  next.slots = retrySlots.map(cloneOwned);
  next.bench = retryBench.map(cloneOwned);
  const authoritativeResult = actualResult === 'win' ? 'win' : 'lose';
  applyResult(next, authoritativeResult, battleGold, eggStats);
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

/** Stable shelf positions survive purchases and frozen goods survive node transitions. */
export function freezeDraft(r: RunState, index: number): boolean {
  if (!modernEconomy(r) || r.pending || r.over || screen(r) !== 'prep' || !Number.isInteger(index) || !r.draft[index]) return false;
  r.draftLocked ??= Array(5).fill(false); r.draftLocked[index] = !r.draftLocked[index]; return true;
}
export function draftBuyBlockReason(r: RunState, index: number, slot?: number): string | null {
  if (r.pending || r.over || screen(r) !== 'prep' || !Number.isInteger(index) || !r.draft[index]) return '商品不可购买';
  if (modernEconomy(r) && r.gold < 3) return '金币不足';
  if (slot !== undefined && placeKind(r, r.draft[index], slot) === 'invalid') return '没有可用位置';
  if (slot === undefined && unitDestination(r, r.draft[index]) === null) return '没有可用位置';
  return null;
}
export const canBuyDraft = (r: RunState, index: number, slot?: number) => draftBuyBlockReason(r,index,slot) === null;

/** Orders are preparation choices attached to permanent unit identity, never bench effects. */
export function setGeneralOrder(r: RunState, ownedId: number | null): boolean {
  if (!modernTactics(r) || !['zilan','kaleos'].includes(r.general) || r.over || r.pending || screen(r) !== 'prep') return false;
  if (ownedId === null) { delete r.commandTarget; return true; }
  if (!Number.isSafeInteger(ownedId) || !r.slots.some(u => u?.ownedId === ownedId)) return false;
  r.commandTarget = ownedId; return true;
}
