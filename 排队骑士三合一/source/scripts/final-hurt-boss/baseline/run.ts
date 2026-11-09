// 一局的状态与商店经济：框架照搬 SAP（6 阶、货架 3→5、补给 1→2、10 金、3 份/6 份升星、10 心 15 胜）。
import { ATOMS, BOSSES, card, equipOf, equipStats, EQUIPS, FOOD, FOOD_POOL, ALL, hasTag, LINES, RELICS, SHOP_POOL, type Atom, type BossDef, type CardDef, type Ench, type EventId, type FoodFx, type Quality, type RelicId, type Tier } from './data';
import { QUEUE_MAX, simulate, type BattleOut, type UnitSpec } from './engine';
import ghostData from './ghosts.json';
import { authoredEncounters, type AuthoredEncounter } from './encounters';

export const SAVE_KEY = 'pdqs_run_v5';
export const SAVE_VERSION = 5;
export const MAX_LIVES = 10;
export const WIN_GOAL = 15;
export const GOLD_PER_ROUND = 10;
export const PRICE = 3;
export const REROLL = 1;
export const MAX_COPIES = 6;
export const STAT_CAP = 50;
export const FOOD_HISTORY_MAX = 5;
export const MILK_MAX = 2;
export const FOOD_SHOP_MAX = 4;
export const SUPPLY_VERSION = 1;
export const PRE_SUPPLY_BACKUP_KEY = 'pdqs_run_v5_pre_supply_backup';
export const INHERIT_FOODS = ['f_bread', 'f_whet', 'f_roast', 'f_milk'] as const;
/** 一件原始补给的基础规格；不能写入倍率、技能或其他永久成长。 */
export interface FoodMemory { id: string; atk: number; hp: number; sourceId: number }
export const BOSS_TURNS: Record<number, BossKey> = { 4: 'wall', 8: 'tide', 12: 'forge', 16: 'horde' };

export interface Owned {
  oid: number;
  def: string;
  copies: number;
  atkBonus: number;
  hpBonus: number;
  ench?: Ench | null;
  /** 只在下一场有效的加成（战鼓、瓢虫、马、火鸡、虎斑猫） */
  tmpAtk?: number;
  tmpHp?: number;
  /** 魂灯：下一场复生 */
  lamp?: boolean;
  /** 补给的本场特效（火药包、骨汤…），打完就散 */
  tfx?: FoodFx[];
  /** 幼兽蛋：孵出幼龙的额外攻血 */
  bank?: number;
  /** 沙域法老：复制到的技能（卡 id） */
  copy?: string;
  /** 雇佣兵：还剩几场离队 */
  merc?: number;
  /** 只保存最早五件直接食用的白名单补给，传承重吃不写入。 */
  foodHistory?: FoodMemory[];
}
/** free：升星奖励卡（SAP 式：照常 3 金，刷新/新回合会被刷走，可锁定；不占普通单位格）。val：牛奶的攻血 */
export interface ShopItem { sid: number; kind: 'unit' | 'food'; def: string; locked: boolean; free: boolean; val?: [number, number] }
export type BossKey = keyof typeof BOSSES;
/** 敌阵形态：前肉后放大 / 召唤海 / 养成大哥 / 狙击队 / 自爆群 / 格挡墙 / 速攻 / 均衡 */
export type FormKey = 'tank' | 'summon' | 'carry' | 'snipe' | 'boom' | 'wall' | 'rush' | 'mixed';
export const FORMS: FormKey[] = ['tank', 'summon', 'carry', 'snipe', 'boom', 'wall', 'rush', 'mixed'];
export const FORM_INFO: Record<FormKey, { name: string; hint: string }> = {
  tank: { name: '前肉后放大', hint: '前排挨打触发，后排越打越强' },
  summon: { name: '召唤海', hint: '阵亡就召唤，人多' },
  carry: { name: '养成大哥', hint: '一个大哥扛全队' },
  snipe: { name: '狙击队', hint: '开战就打你后排、血最低的' },
  boom: { name: '自爆群', hint: '阵亡时炸全场或加攻' },
  wall: { name: '格挡墙', hint: '层层格挡，小刀刮不动' },
  rush: { name: '速攻', hint: '攻高血薄，先手打崩你' },
  mixed: { name: '均衡', hint: '什么都有一点' },
};
export interface Enemy { boss: BossKey | null; units: UnitSpec[]; form?: FormKey; elite?: Atom[]; encounter?: Pick<AuthoredEncounter, 'key' | 'name' | 'hint'> }
/** 装备箱：3 件翻牌；ad 已看过升品；src 来源 */
export interface Chest { items: Ench[]; ad: boolean; src: 'elite' | 'boss' }
/** 本回合计数：吃补给次数、买单位次数及限次技能 */
export interface TurnCount {
  foods: number;
  bought: number;
  /** 旧版巨熊逐个补货次数；仅用于存档兼容，不再参与规则。 */
  bear: Record<number, number>;
  /** 本回合全队已触发的巨熊补给返金次数。 */
  bearRefunds?: number;
  keeper?: Record<number, number>;
  shareUsed?: boolean;
}
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
  rerolls: number;
  tc: TurnCount;
  /** 连输终局 Boss 的次数 */
  finalLosses: number;
  enemy: Enemy;
  /** 回合开始时的商店效果，留给 UI 播放 */
  pendingFx: ShopFx[];
  /** 本局生态：8 种形态里抽 5 种 */
  eco: FormKey[];
  lastForm: FormKey | null;
  /** >0 连胜、<0 连败 */
  streak: number;
  /** 局外偏暖（新手 / 最近总早早出局） */
  warm: boolean;
  /** 广告保心已用次数；广告刷新所在回合 */
  adSave: number;
  /** 本局看广告重打的次数 */
  adRetry?: number;
  adRr: number;
  /** 上一场输掉扣的心（可看广告退回） */
  lastLoss: number;
  /** 背包（最多 3 件装备） */
  bag: Ench[];
  /** 本局拿到过的橙装 */
  oranges: Ench[];
  /** 本局广告把紫装升成橙装的次数（上限 ORANGE_MAX） */
  adOrange?: number;
  /** 连续多少箱没出紫 */
  noPurple: number;
  chest: Chest | null;
  /** 岔路：两个敌阵二选一（选后清空） */
  branch: Enemy[] | null;
  /** 难度 0 普通 / 1 困难 / 2 噩梦 */
  diff: Diff;
  relics: RelicId[];
  /** 待选的遗物次数；当前这次的选项（ad：已看广告多一选） */
  relicDue: number;
  relicPick: { opts: RelicId[]; ad: boolean } | null;
  /** 本回合的事件（替代岔路），处理完清空；seenEv 本局见过的 */
  event: EventId | null;
  seenEv: EventId[];
  /** 混沌契约：还剩几场强化敌人 */
  chaos: number;
  /** 已处理产奶的备战回合；重绘、刷新、存档恢复不能再次发放。 */
  milkTurn?: number;
  /** 补给容量与传承存档格式；缺失表示需从旧 v5 做一次保守迁移。 */
  supplyVersion?: number;
}
export type Diff = 0 | 1 | 2;
/** 难度：k 敌人系数，temp 温度保留比例，lives 起始心数。校准（mix0.3 bot）：通关≈72% / 52% / 28% */
export const DIFFS: { name: string; desc: string; k: number; temp: number; lives: number }[] = [
  { name: '普通', desc: '适合第一次远征', k: 0.93, temp: 1, lives: 10 },
  { name: '困难', desc: '敌人更强，手气差时不再放水', k: 1.03, temp: 0.5, lives: 10 },
  { name: '噩梦', desc: '敌人再强一截，只有 8 颗心', k: 1.06, temp: 0.2, lives: 8 },
];
export const maxLives = (r: Pick<RunState, 'diff'>) => DIFFS[r.diff ?? 0].lives;
const CHAOS_K = 1.15;
/** 本场敌人的额外系数：难度 × 混沌契约 */
export const diffK = (r: Pick<RunState, 'diff' | 'chaos'>) => DIFFS[r.diff ?? 0].k * (r.chaos > 0 ? CHAOS_K : 1);
export const BAG_MAX = 3;
export const AD_SAVE_MAX = 2;
export const ORANGE_MAX = 2;

/** 商店内效果，UI 逐个播放；tmp 为只在下一场有效 */
export type ShopFx =
  | { kind: 'buff'; src: number | null; tgt: number; atk: number; hp: number; label: string; tmp?: boolean }
  | { kind: 'bank'; src: number; n: number; label: string }
  | { kind: 'gold'; src: number; n: number; label: string };

export const lvlOf = (copies: number): 1 | 2 | 3 => (copies >= 6 ? 3 : copies >= 3 ? 2 : 1);
/** 当前星级内的进度：[已有, 需要] */
export const starProgress = (copies: number): [number, number] =>
  copies >= 6 ? [1, 1] : copies >= 3 ? [copies - 3, 3] : [copies - 1, 2];
export const ownedAtk = (o: Owned) => Math.min(STAT_CAP, Math.max(1, card(o.def).atk + o.copies - 1 + o.atkBonus));
export const ownedHp = (o: Owned) => Math.min(STAT_CAP, card(o.def).hp + o.copies - 1 + o.hpBonus);
/** 含装备的攻血（显示和上场用） */
export const shownStats = (o: Owned): [number, number] => equipStats(o.ench, ownedAtk(o), ownedHp(o));
export const sellPrice = (o: Owned) => (o.merc ? 0 : lvlOf(o.copies));
export const unitSlots = (turn: number) => (turn <= 4 ? 3 : turn <= 8 ? 4 : 5);
export const foodSlots = (turn: number) => (turn <= 2 ? 1 : 2);
export const maxTier = (turn: number): Tier => Math.min(6, Math.ceil(turn / 2)) as Tier;
export const lossCost = (turn: number, elite = false) => (elite || turn > 4 ? 2 : 1);
export const enemyLossCost = (r: Pick<RunState, 'turn' | 'enemy'>) => lossCost(r.turn, !!r.enemy.elite?.length);
/** 技能来源：法老复制到技能时用被复制的卡 */
export const adefOf = (o: Owned): CardDef => (o.copy && card(o.def).ab === 'parrot' ? card(o.copy) : card(o.def));
const abOf = (o: Owned) => adefOf(o).ab;
const vOf = (o: Owned) => adefOf(o).v?.[lvlOf(o.copies) - 1] ?? 0;
const uOf = (o: Owned) => adefOf(o).u?.[lvlOf(o.copies) - 1] ?? 0;

// 可复现随机
function rng(r: RunState) {
  r.seed = (r.seed * 1103515245 + 12345) & 0x7fffffff;
  return r.seed / 0x7fffffff;
}
const pick = <T>(r: RunState, arr: T[]) => arr[Math.floor(rng(r) * arr.length)];
const pickN = <T>(r: RunState, arr: T[], k: number) => {
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < k && pool.length) out.push(pool.splice(Math.floor(rng(r) * pool.length), 1)[0]);
  return out;
};
const units = (r: RunState) => r.queue.filter((o): o is Owned => !!o);
const byOid = (r: RunState, oid: number) => units(r).find((o) => o.oid === oid);
const newCount = (): TurnCount => ({ foods: 0, bought: 0, bear: {}, bearRefunds: 0, keeper: {}, shareUsed: false });

export function prepFoodUses(r: RunState, o: Owned): { used: number; max: number } | null {
  if (abOf(o) === 'seal') return { used: r.tc.keeper?.[o.oid] ?? 0, max: uOf(o) };
  if (abOf(o) === 'sauropod') return { used: r.tc.bearRefunds ?? 0, max: 2 };
  return null;
}

/** 永久加成，带属性上限；返回实际加了多少 */
function grow(o: Owned, atk: number, hp: number): [number, number] {
  const a = Math.max(0, Math.min(atk, STAT_CAP - ownedAtk(o)));
  const h = Math.max(0, Math.min(hp, STAT_CAP - ownedHp(o)));
  o.atkBonus += a;
  o.hpBonus += h;
  return [a, h];
}
function growFx(fx: ShopFx[], src: number | null, o: Owned | undefined, atk: number, hp: number, label: string) {
  if (!o) return;
  const [a, h] = grow(o, atk, hp);
  if (a || h) fx.push({ kind: 'buff', src, tgt: o.oid, atk: a, hp: h, label });
}
/** 只在下一场有效的加成 */
function tmpFx(fx: ShopFx[], src: number | null, o: Owned | undefined, atk: number, hp: number, label: string) {
  if (!o || (!atk && !hp)) return;
  o.tmpAtk = (o.tmpAtk ?? 0) + atk;
  o.tmpHp = (o.tmpHp ?? 0) + hp;
  fx.push({ kind: 'buff', src, tgt: o.oid, atk, hp, label, tmp: true });
}

export function newRun(seed = (Math.random() * 2 ** 31) | 0, opts: { warm?: boolean; diff?: Diff } = {}): RunState {
  const diff = opts.diff ?? 0;
  const r: RunState = {
    v: SAVE_VERSION, seed, turn: 1, lives: DIFFS[diff].lives, wins: 0, gold: GOLD_PER_ROUND, queue: Array(QUEUE_MAX).fill(null), shop: [], nextId: 1,
    phase: 'prep', history: [], canned: 0, rerolls: 0, tc: newCount(), finalLosses: 0, enemy: { boss: null, units: [] }, pendingFx: [],
    eco: [], lastForm: null, streak: 0, warm: !!opts.warm, adSave: 0, adRr: 0, lastLoss: 0, bag: [], oranges: [], noPurple: 0, chest: null, branch: null,
    diff, relics: [], relicDue: 0, relicPick: null, event: null, seenEv: [], chaos: 0, supplyVersion: SUPPLY_VERSION,
  };
  if (diff > 0) r.warm = false;
  r.eco = pickN(r, FORMS, 5);
  rollShop(r);
  grantPrepMilk(r);
  nextEnemy(r);
  return r;
}

/** 温度高：连败 ≥2、剩 ≤3 心、或局外偏暖 */
export const isWarm = (r: RunState) => (r.diff ?? 0) < 2 && (r.streak <= -2 || r.lives <= 3 || r.warm);

const foodPool = (r: RunState) => FOOD_POOL.filter((f) => f.tier <= maxTier(r.turn));
/** 已解锁补给按单品权重抽取；默认每件等权。 */
function pickFood(r: RunState, minTier: Tier = 1) {
  const mt = maxTier(r.turn);
  const floor = Math.min(mt, minTier);
  const pool = foodPool(r).filter((f) => f.tier >= floor);
  const w = pool.map((f) => f.rollWeight ?? 1);
  let t = rng(r) * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) if ((t -= w[i]) < 0) return pool[i];
  return pool[pool.length - 1];
}
function rollShop(r: RunState) {
  const tier = maxTier(r.turn);
  const pool = SHOP_POOL.filter((c) => c.tier <= tier);
  const kept = r.shop.filter((s) => s.locked);
  const out: ShopItem[] = [];
  const keptU = kept.filter((s) => s.kind === 'unit' && !s.free);
  // 锁住的升星奖励卡和普通卡一样占刷新席位
  const keptB = kept.filter((s) => s.kind === 'unit' && s.free);
  out.push(...keptU);
  // 招募同温：温度高时最多 2 格偏向同标签 / 已有同名（只加权不保底）
  const own = units(r).map((o) => card(o.def));
  const tags = new Set(own.flatMap((d) => [d.line, d.tag2]).filter((t) => t && t !== 'any'));
  const near = (c: CardDef) => own.some((d) => d.id === c.id) || [...tags].some((t) => hasTag(c, t as (typeof LINES)[number]));
  let warmLeft = isWarm(r) && own.length ? 2 : 0;
  for (let i = keptU.length + keptB.length; i < unitSlots(r.turn); i++) {
    let c = pick(r, pool);
    if (warmLeft > 0) {
      warmLeft--;
      const w = pool.map((x) => (near(x) ? 2 : 1));
      let t = rng(r) * w.reduce((a, b) => a + b, 0);
      c = pool.find((_, j) => (t -= w[j]) < 0) ?? c;
    }
    out.push({ sid: r.nextId++, kind: 'unit', def: c.id, locked: false, free: false });
  }
  out.push(...keptB);
  const milk = r.shop.filter((s) => s.kind === 'food' && s.def === 'f_milk');
  const keptF = kept.filter((s) => s.kind === 'food' && s.def !== 'f_milk');
  out.push(...keptF);
  for (let i = keptF.length; i < foodSlots(r.turn) && out.filter((s) => s.kind === 'food').length + milk.length < FOOD_SHOP_MAX; i++) out.push({ sid: r.nextId++, kind: 'food', def: pickFood(r).id, locked: false, free: false });
  out.push(...milk);
  r.shop = out;
}

/** 仅新备战入口调用：来源按队首到队尾各供一瓶，旧规格不回溯。 */
export function grantPrepMilk(r: RunState) {
  if (r.phase !== 'prep' || r.milkTurn === r.turn) return;
  r.milkTurn = r.turn;
  let count = r.shop.filter((s) => s.kind === 'food' && s.def === 'f_milk').length;
  let total = r.shop.filter((s) => s.kind === 'food').length;
  for (const o of units(r)) {
    if (count >= MILK_MAX || total >= FOOD_SHOP_MAX) break;
    if (abOf(o) !== 'cow') continue;
    r.shop.push({ sid: r.nextId++, kind: 'food', def: 'f_milk', free: true, locked: false, val: [vOf(o), uOf(o)] });
    count++;
    total++;
  }
}

export function reroll(r: RunState): ShopFx[] | null {
  if (r.gold < REROLL) return null;
  r.gold -= REROLL;
  r.rerolls++;
  rollShop(r);
  return [];
}

/** 广告刷新：每回合 1 次，免费 */
export function adReroll(r: RunState): ShopFx[] | null {
  if (r.adRr === r.turn) return null;
  r.adRr = r.turn;
  rollShop(r);
  return [];
}

export function toggleLock(r: RunState, sid: number) {
  const s = r.shop.find((x) => x.sid === sid);
  if (s && s.def !== 'f_milk') s.locked = !s.locked;
}

export type BuyResult = { ok: false; why: 'gold' | 'full' | 'max' } | { ok: true; merged: boolean; levelUp: boolean; fx: ShopFx[] };

/** 买单位到指定格：空格放下；同名合并；不同名的单位格拒绝 */
export function buy(r: RunState, sid: number, slot: number): BuyResult {
  const item = r.shop.find((x) => x.sid === sid);
  if (!item || item.kind !== 'unit') return { ok: false, why: 'full' };
  const cost = PRICE;
  if (r.gold < cost) return { ok: false, why: 'gold' };
  const at = r.queue[slot];
  if (at && (at.def !== item.def || at.merc)) return { ok: false, why: 'full' };
  if (at && at.copies >= MAX_COPIES) return { ok: false, why: 'max' };
  r.gold -= cost;
  r.shop = r.shop.filter((x) => x !== item);
  r.tc.bought++;
  const fx: ShopFx[] = [];
  if (!at) {
    const o: Owned = { oid: r.nextId++, def: item.def, copies: 1, atkBonus: r.canned, hpBonus: r.canned };
    r.queue[slot] = o;
    onBought(r, o, true, fx);
    return { ok: true, merged: false, levelUp: false, fx };
  }
  if (r.canned) grow(at, r.canned, r.canned);
  const levelUp = addCopies(r, at, 1, fx);
  onBought(r, at, false, fx);
  return { ok: true, merged: true, levelUp, fx };
}

/** 购买后的商店钩子；新放下的单位算一次「召唤」 */
function onBought(r: RunState, o: Owned, isNew: boolean, fx: ShopFx[]) {
  const others = units(r).filter((t) => t !== o);
  for (const t of others) {
    switch (abOf(t)) {
      case 'buffalo': growFx(fx, t.oid, t, vOf(t), vOf(t), '买入友军'); break;
      case 'dragon':
        if (card(o.def).tier === 1) for (const x of units(r)) growFx(fx, t.oid, x, vOf(t), vOf(t), '买入 1 阶');
        break;
    }
    if (!isNew) continue;
    switch (abOf(t)) {
      case 'horse': tmpFx(fx, t.oid, o, vOf(t), 0, '友军被召唤'); break;
      case 'dog': growFx(fx, t.oid, t, vOf(t), vOf(t), '友军被召唤'); break;
      case 'turkey': tmpFx(fx, t.oid, o, vOf(t), vOf(t), '友军被召唤'); break;
    }
  }
}

function addCopies(r: RunState, o: Owned, n: number, fx: ShopFx[]): boolean {
  const before = lvlOf(o.copies);
  o.copies = Math.min(MAX_COPIES, o.copies + n);
  const levelUp = lvlOf(o.copies) > before;
  if (levelUp) {
    grantStarReward(r);
    if (abOf(o) === 'fish') for (const t of units(r)) if (t !== o) growFx(fx, o.oid, t, vOf(o), vOf(o), '升星');
  }
  return levelUp;
}

/** 买到第一个合适的位置：优先合并同名，否则第一个空格 */
export function autoSlot(r: RunState, def: string): number {
  const same = r.queue.findIndex((o) => o?.def === def && o.copies < MAX_COPIES && !o.merc);
  if (same >= 0) return same;
  return r.queue.findIndex((o) => !o);
}

function grantStarReward(r: RunState) {
  const tier = Math.min(6, maxTier(r.turn) + 1);
  const pool = SHOP_POOL.filter((c) => c.tier === tier);
  r.shop.push({ sid: r.nextId++, kind: 'unit', def: pick(r, pool).id, locked: false, free: true });
}

/** 补给是否需要指定目标 */
export const foodNeedsTarget = (id: string) => !FOOD[id].n && id !== 'f_can';
export const foodAll = (id: string) => FOOD[id]?.n === ALL;
export const foodPrice = (s: ShopItem) => (s.def === 'f_milk' ? 0 : FOOD[s.def]?.price ?? PRICE);
/** 补给的攻血效果（牛奶看货架上的数值） */
export const foodStats = (s: ShopItem): [number, number] => s.val ?? [FOOD[s.def]?.atk ?? 0, FOOD[s.def]?.hp ?? 0];

export type FoodResult = { ok: false; why: 'gold' | 'target' } | { ok: true; fx: ShopFx[]; levelUp: boolean };
const inheritableFood = (id: string) => (INHERIT_FOODS as readonly string[]).includes(id);
/** 分享餐盘只复制没有额外状态或范围效果的单体攻血补给。 */
const SHARE_FOODS = new Set(['f_bread', 'f_whet', 'f_roast', 'f_milk', 'f_drum']);
/** 不把分发/分享的二次受益当作原始物件再记录，避免一件物品复制多份传承。 */
function rememberFood(o: Owned, memory: FoodMemory) {
  if (!card(o.def).inherit || !inheritableFood(memory.id)) return;
  const history = o.foodHistory ??= [];
  if (history.length < FOOD_HISTORY_MAX && !history.some((x) => x.sourceId === memory.sourceId)) history.push({ ...memory });
}
/** 统一食用结算：直接食用与传承复用技能钩子，购买与物件计数留在 useFood。 */
function eatFood(r: RunState, e: Owned, item: FoodMemory, fx: ShopFx[]): boolean {
  const f = FOOD[item.id];
  const mul = abOf(e) === 'cat' ? vOf(e) : 1;
  const a = item.atk * mul;
  const h = item.hp * mul;
  if (f.tmp) tmpFx(fx, null, e, a, h, f.name);
  else growFx(fx, null, e, a, h, f.name);
  if (f.fx && !e.tfx?.includes(f.fx)) e.tfx = [...(e.tfx ?? []), f.fx];
  if (f.id === 'f_lamp') e.lamp = true;
  const levelUp = f.id === 'f_elixir' ? addCopies(r, e, 1, fx) : false;
  const v = vOf(e);
  const slot = r.queue.indexOf(e);
  switch (abOf(e)) {
    case 'ladybug':
    case 'worm': growFx(fx, e.oid, e, v, v, '吃补给'); break;
    case 'seal':
      {
        const adjacent = [slot - 1, slot + 1].map((j) => r.queue[j]).filter((o): o is Owned => !!o);
        const used = r.tc.keeper?.[e.oid] ?? 0;
        if (adjacent.length && used < uOf(e)) {
          (r.tc.keeper ??= {})[e.oid] = used + 1;
          for (const o of adjacent) growFx(fx, e.oid, o, v, v, '吃补给');
        }
      }
      break;
    case 'tabby': for (const t of units(r)) tmpFx(fx, e.oid, t, v, 0, '吃补给'); break;
  }
  for (const t of units(r)) {
    if (t === e) continue;
    if (abOf(t) === 'rabbit') growFx(fx, t.oid, e, 0, vOf(t), '友军吃补给');
    if (abOf(t) === 'wyvern' && (a || h)) {
      const half = (x: number) => (x ? Math.max(1, Math.floor(x / 2)) : 0);
      const at = r.queue.indexOf(t);
      const targets = [r.queue[at - 1], r.queue[at + 1]].filter((x): x is Owned => !!x && x !== e).slice(0, vOf(t));
      for (const x of targets) {
        // 这只是属性分发，不广播食用事件，也不记录补给。
        if (f.tmp) tmpFx(fx, t.oid, x, half(a), half(h), '友军吃补给');
        else growFx(fx, t.oid, x, half(a), half(h), '友军吃补给');
      }
    }
  }
  return levelUp;
}

export function useFood(r: RunState, sid: number, slot: number | null): FoodResult {
  const item = r.shop.find((x) => x.sid === sid);
  if (!item || item.kind !== 'food') return { ok: false, why: 'target' };
  const f = FOOD[item.def];
  const tgt = slot === null ? null : r.queue[slot];
  if (foodNeedsTarget(f.id) && !tgt) return { ok: false, why: 'target' };
  if (!foodNeedsTarget(f.id) && !units(r).length && f.id !== 'f_can') return { ok: false, why: 'target' };
  if (f.id === 'f_elixir' && tgt && tgt.copies >= MAX_COPIES) return { ok: false, why: 'target' };
  const price = foodPrice(item);
  if (r.gold < price) return { ok: false, why: 'gold' };
  r.gold -= price;
  r.shop = r.shop.filter((x) => x !== item);
  const fx: ShopFx[] = [];
  if (price > 0 && (r.tc.bearRefunds ?? 0) < 2) {
    // 队列从前到后扫描；只在星级严格更高时替换，故同星由前位提供返金。
    const bear = units(r).reduce<Owned | null>((best, o) =>
      abOf(o) === 'sauropod' && (!best || vOf(o) > vOf(best)) ? o : best, null);
    if (bear) {
      const refund = Math.min(price, vOf(bear));
      r.gold += refund;
      r.tc.bearRefunds = (r.tc.bearRefunds ?? 0) + 1;
      fx.push({ kind: 'gold', src: bear.oid, n: refund, label: '巨熊返金' });
    }
  }
  let levelUp = false;
  const [fa, fh] = foodStats(item);
  const eaters = f.id === 'f_can' ? [] : f.n === ALL ? units(r) : f.n ? pickN(r, units(r), f.n) : [tgt!];
  if (f.behind && slot !== null && r.queue[slot + 1]) eaters.push(r.queue[slot + 1]!);
  // 小范围补给只读取实际邻格：不补位、不因队尾/空格重复食用。
  if (f.around && slot !== null) {
    for (const j of [slot - 1, slot + 1]) if (r.queue[j]) eaters.push(r.queue[j]!);
  }
  // 分享餐盘：每回合第一份纯单体攻血补给也喂给相邻友军。
  if (r.relics?.includes('r_share') && !(r.tc.shareUsed ?? r.tc.foods > 0) && SHARE_FOODS.has(f.id) && tgt && slot !== null) {
    r.tc.shareUsed = true;
    for (const j of [slot - 1, slot + 1]) { const o = r.queue[j]; if (o) eaters.push(o); }
  }
  if (f.id === 'f_can') r.canned += 1;
  for (const e of eaters) {
    const memory: FoodMemory = { id: f.id, atk: fa, hp: fh, sourceId: item.sid };
    levelUp = eatFood(r, e, memory, fx) || levelUp;
    if (e === tgt && !f.tmp && !f.n && !f.behind && !f.around) rememberFood(e, memory);
  }
  r.tc.foods++;
  return { ok: true, fx, levelUp };
}

/** 场上两格互换，或同名合并（拖动） */
export function moveOwned(r: RunState, from: number, to: number): { merged: boolean; levelUp: boolean; fx: ShopFx[] } | null {
  if (from === to) return null;
  const a = r.queue[from];
  const b = r.queue[to];
  if (!a) return null;
  if (b && b.def === a.def && b.copies < MAX_COPIES && a.copies < MAX_COPIES && !a.merc && !b.merc) {
    b.atkBonus += a.atkBonus;
    b.hpBonus += a.hpBonus;
    if (card(b.def).inherit) {
      const history = [...(b.foodHistory ?? []), ...(a.foodHistory ?? [])];
      b.foodHistory = history.filter((x, i) => history.findIndex((y) => y.sourceId === x.sourceId) === i).slice(0, FOOD_HISTORY_MAX).map((x) => ({ ...x }));
    }
    // 合星保留品质高的装备，另一件退背包
    if (a.ench && b.ench) {
      const [hi, lo] = (equipOf(a.ench)?.q ?? 0) > (equipOf(b.ench)?.q ?? 0) ? [a.ench, b.ench] : [b.ench, a.ench];
      b.ench = hi;
      toBag(r, lo);
    } else b.ench = b.ench ?? a.ench;
    b.bank = (b.bank ?? 0) + (a.bank ?? 0);
    (r.tc.keeper ??= {})[b.oid] = (r.tc.keeper[b.oid] ?? 0) + (r.tc.keeper[a.oid] ?? 0);
    delete r.tc.keeper[a.oid];
    b.tmpAtk = (b.tmpAtk ?? 0) + (a.tmpAtk ?? 0) || undefined;
    b.tmpHp = (b.tmpHp ?? 0) + (a.tmpHp ?? 0) || undefined;
    b.lamp = b.lamp || a.lamp;
    if (a.tfx) b.tfx = [...new Set([...(b.tfx ?? []), ...a.tfx])];
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
  // 必须在删除或任何出售效果发生前确定对象，空位不改变先后关系。
  const receiver = r.queue.slice(slot + 1).find((t): t is Owned => !!t)
    ?? r.queue.slice(0, slot).reverse().find((t): t is Owned => !!t);
  const gold = sellPrice(o);
  r.gold += gold;
  r.queue[slot] = null;
  if (o.ench) toBag(r, o.ench);
  const fx: ShopFx[] = [];
  const rest = units(r);
  if (abOf(o) === 'beaver' && rest.length) growFx(fx, o.oid, pick(r, rest), vOf(o), vOf(o), '出售');
  if (card(o.def).inherit && receiver) {
    for (const item of o.foodHistory ?? []) eatFood(r, receiver, item, fx);
  }
  return { gold, fx };
}

/** 回合结束（开战前）：从队首到队尾依次结算商店成长，最后法老复制身前技能 */
export function endTurn(r: RunState): ShopFx[] {
  const fx: ShopFx[] = [];
  const q = units(r);
  q.forEach((o, i) => {
    const v = vOf(o);
    const others = q.filter((t) => t !== o);
    switch (abOf(o)) {
      case 'tfish':
        growFx(fx, o.oid, q[i - 1], 0, v, '回合结束');
        growFx(fx, o.oid, q[i + 1], 0, v, '回合结束');
        break;
      case 'bluebird': growFx(fx, o.oid, others[others.length - 1], v, 0, '回合结束'); break;
      case 'backstab': growFx(fx, o.oid, q[i - 1], v, 0, '回合结束'); break;
      case 'egg':
        o.bank = (o.bank ?? 0) + v;
        fx.push({ kind: 'bank', src: o.oid, n: v, label: '回合结束' });
        break;
      case 'giraffe': for (const t of q.slice(Math.max(0, i - v), i)) growFx(fx, o.oid, t, 1, 1, '回合结束'); break;
      case 'penguin': for (const t of others) if (lvlOf(t.copies) >= 2) growFx(fx, o.oid, t, v, v, '回合结束'); break;
      case 'monkey': growFx(fx, o.oid, others[0], v, uOf(o), '回合结束'); break;
      case 'rhyno': if (r.tc.foods >= 3) for (const t of q) growFx(fx, o.oid, t, v, v, '吃过 3 次补给'); break;
    }
  });
  q.forEach((o, i) => {
    if (card(o.def).ab !== 'parrot') return;
    const ahead = q[i - 1];
    o.copy = ahead ? (card(ahead.def).ab === 'parrot' ? ahead.copy : ahead.def) : undefined;
  });
  return fx;
}

export const playerTeam = (r: Pick<RunState, 'queue'>): UnitSpec[] =>
  r.queue.filter((o): o is Owned => !!o).map((o) => {
    const [atk, hp] = equipStats(o.ench, ownedAtk(o) + (o.tmpAtk ?? 0), ownedHp(o) + (o.tmpHp ?? 0));
    return { def: o.def, lvl: lvlOf(o.copies), atk, hp, oid: o.oid, ench: o.ench ?? null, lamp: o.lamp, tfx: o.tfx, bank: o.bank, copy: card(o.def).ab === 'parrot' ? o.copy : undefined };
  });

// ── 装备与背包 ──
/** 放进背包；满了就丢掉品质最低的一件（折 1 金） */
function toBag(r: RunState, id: Ench) {
  r.bag.push(id);
  if (r.bag.length <= BAG_MAX) return;
  let lo = 0;
  r.bag.forEach((x, i) => { if ((equipOf(x)?.q ?? 0) < (equipOf(r.bag[lo])?.q ?? 0)) lo = i; });
  r.bag.splice(lo, 1);
  r.gold += 1;
}
/** 给单位换装：旧装备退背包 */
function equipOnto(r: RunState, o: Owned, id: Ench) {
  const old = o.ench;
  o.ench = id;
  if (old && old !== id) toBag(r, old);
}
export function equipFromBag(r: RunState, i: number, slot: number): boolean {
  const o = r.queue[slot];
  const id = r.bag[i];
  if (!o || !id) return false;
  r.bag.splice(i, 1);
  equipOnto(r, o, id);
  return true;
}
export function unequip(r: RunState, slot: number): boolean {
  const o = r.queue[slot];
  if (!o?.ench || r.bag.length >= BAG_MAX) return false;
  r.bag.push(o.ench);
  o.ench = null;
  return true;
}
export function discardBag(r: RunState, i: number): number {
  if (!r.bag[i]) return 0;
  r.bag.splice(i, 1);
  r.gold += 1;
  return 1;
}

// ── 装备箱：翻 3 选 1，每件各自抽品质 ──
const CHEST_POOL = (q: Quality) => EQUIPS.filter((e) => e.q === q && !e.food);
function chestWeights(r: RunState): number[] {
  let w = r.turn <= 6 ? [55, 33, 11, 1] : r.turn <= 11 ? [40, 38, 19, 3] : [30, 38, 26, 6];
  if (isWarm(r)) w = w.map((x, i) => 0.5 * x + 0.5 * (w[i - 1] ?? 0));
  if (r.turn >= 14 && !r.oranges.length) w = [...w.slice(0, 3), Math.max(w[3], 25)];
  return w;
}
function rollQ(r: RunState, w: number[]): Quality {
  let t = rng(r) * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) if ((t -= w[i]) < 0) return i as Quality;
  return 0;
}
/** 在品质 q 里抽一件不重复的；橙装受上限约束（cap：本次允许的橙装总数） */
function rollItem(r: RunState, q: Quality, taken: Ench[], cap: number): Ench {
  if (q === 3 && r.oranges.length + taken.filter((x) => equipOf(x)?.q === 3).length >= cap) q = 2;
  const pool = CHEST_POOL(q).filter((e) => !taken.includes(e.id) && !r.oranges.includes(e.id));
  const list = pool.length ? pool : CHEST_POOL(q === 3 ? 2 : q).filter((e) => !taken.includes(e.id));
  return pick(r, list).id;
}
export function rollChest(r: RunState, src: Chest['src']): Chest {
  const w = chestWeights(r);
  const qs = [0, 1, 2].map(() => rollQ(r, w));
  if (src === 'boss' && !qs.some((q) => q >= 2)) qs[0] = 2;
  if (r.noPurple >= 3 && !qs.some((q) => q >= 2)) qs[0] = 2;
  const items: Ench[] = [];
  for (const q of qs) items.push(rollItem(r, q, items, 1));
  r.noPurple = items.some((x) => (equipOf(x)?.q ?? 0) >= 2) ? 0 : r.noPurple + 1;
  return { items, ad: false, src };
}
/** 这件还能被广告升品吗（橙封顶；紫→橙每局限 ORANGE_MAX 次） */
const canUp = (r: RunState, id: Ench) => { const q = equipOf(id)?.q ?? 0; return q < 2 || (q === 2 && (r.adOrange ?? 0) < ORANGE_MAX); };
export const chestCanUp = (r: RunState) => !!r.chest?.items.some((id) => canUp(r, id));
/** 广告升品：能升的件各 +1 品质后重抽，看就升不限次；紫→橙每件消耗 1 次额度 */
export function adUpgradeChest(r: RunState): boolean {
  const c = r.chest;
  if (!c || !chestCanUp(r)) return false;
  const items: Ench[] = [];
  for (const id of c.items) {
    const q = equipOf(id)?.q ?? 0;
    if (!canUp(r, id)) { items.push(id); continue; }
    if (q === 2) r.adOrange = (r.adOrange ?? 0) + 1;
    items.push(rollItem(r, (q + 1) as Quality, [...items, ...c.items.filter((x) => x !== id)], 99));
  }
  c.items = items;
  c.ad = true;
  return true;
}
/** 装备箱里被上限挡住的紫件（UI 标「已达上限」） */
export const orangeCapped = (r: RunState) => r.oranges.length >= ORANGE_MAX;
export function chestPick(r: RunState, i: number) {
  const c = r.chest;
  if (!c) return;
  const id = c.items[i];
  if (id) {
    if (equipOf(id)?.q === 3) r.oranges.push(id);
    toBag(r, id);
  }
  r.chest = null;
}

// ── 敌人：离线生成的幽灵库 × 每回合校准系数 k_r + 固定机制 Boss ──
interface GhostData {
  turns: Record<string, UnitSpec[][]>;
  median: Record<string, number>;
  /** 每回合敌人攻血系数（受伤流中档对它胜率约 55%） */
  scale?: Record<string, number>;
  /** Boss 系数：按回合（Boss 回合）或 Boss key */
  bossScale?: Record<string, number>;
}
export const GHOSTS = ghostData as unknown as GhostData;
const lowerKey = (rec: Record<string, unknown> | undefined, turn: number) => {
  const keys = Object.keys(rec ?? {}).map(Number).filter((k) => !Number.isNaN(k)).sort((a, b) => a - b);
  if (!keys.length) return null;
  return keys.filter((k) => k <= turn).pop() ?? keys[0];
};
const ghostTurn = (turn: number) => {
  const keys = Object.keys(GHOSTS.turns).map(Number).filter((k) => GHOSTS.turns[k]?.length).sort((a, b) => a - b);
  if (!keys.length) return null;
  return keys.filter((k) => k <= turn).pop() ?? keys[0];
};
/** 第 turn 回合的敌人系数 */
export function enemyScale(turn: number): number {
  const k = lowerKey(GHOSTS.scale, turn);
  return k === null ? 1 : GHOSTS.scale![String(k)];
}
/** 幽灵阵容按系数缩放攻血 */
export const scaleTeam = (team: UnitSpec[], k: number): UnitSpec[] =>
  team.map((u) => ({ ...u, atk: Math.max(1, Math.min(STAT_CAP, Math.round(u.atk * k))), hp: Math.max(1, Math.min(STAT_CAP, Math.round(u.hp * k))) }));
/** 第 turn 回合的幽灵库（未缩放） */
export const ghostPool = (turn: number): UnitSpec[][] => {
  const t = ghostTurn(turn);
  return t === null ? [] : GHOSTS.turns[t];
};
/** 该回合中位阵容的总攻血（Boss 预算用）；没有幽灵库时按目标曲线估 */
export function medianBudget(turn: number): number {
  const m = GHOSTS.median[String(turn)] ?? GHOSTS.median[String(ghostTurn(turn) ?? 0)];
  if (m) return m;
  const curve = [5, 7, 9, 12, 16, 20, 24, 29, 34, 39, 44, 50, 55];
  return curve[Math.min(turn, curve.length) - 1] * Math.min(5, 1 + Math.ceil(turn / 2));
}

export function bossFor(r: Pick<RunState, 'wins' | 'turn'>): BossKey | null {
  if (r.wins >= WIN_GOAL - 1) return 'final';
  return BOSS_TURNS[r.turn] ?? null;
}
export function bossMul(r: RunState, key: BossKey) {
  if (key === 'final') return r.finalLosses >= 2 ? 0.9 : r.finalLosses === 1 ? 1.0 : 1.1;
  return 1;
}
/** Boss 的校准系数：先看 key@回合，再看 key */
export function bossScaleOf(key: string, turn: number) {
  const b = GHOSTS.bossScale ?? {};
  return b[`${key}@${turn}`] ?? b[key] ?? 1;
}
/** Boss 预算 = 中位总攻血 × 本回合敌人系数 × Boss 校准系数 × 强度倍率 */
export function bossTeam(def: BossDef, turn: number, mul: number, scale = bossScaleOf(def.key, turn)): UnitSpec[] {
  const budget = medianBudget(turn) * enemyScale(turn) * mul * scale;
  const shape = def.units.map((id) => card(id));
  const total = shape.reduce((s, d) => s + d.atk + d.hp, 0);
  const lvl: 1 | 2 | 3 = def.lvl ?? (turn >= 18 ? 3 : turn >= 10 ? 2 : 1);
  return shape.map((d) => {
    const k = budget / total;
    return { def: d.id, lvl, atk: Math.max(1, Math.min(STAT_CAP, Math.round(d.atk * k))), hp: Math.max(1, Math.min(STAT_CAP, Math.round(d.hp * k))) };
  });
}

// ── 形态分类：按技能分布 ──
const SUMMON_AB = new Set(['cricket', 'egg', 'sheep', 'deer', 'rooster', 'spider', 'eagle', 'fly', 'horse', 'dog', 'turkey', 'heart']);
const BOOM_AB = new Set(['hedgehog', 'badger', 'ant', 'flamingo', 'mammoth']);
const WALL_AB = new Set(['ox', 'turtle', 'gorilla', 'ironwall']);
const SNIPE_AB = new Set(['mosquito', 'dolphin', 'croc', 'skunk', 'leopard', 'snake']);
const HURT_AB = new Set(['peacock', 'elephant', 'camel', 'blowfish', 'drill', 'anvil', 'storm', 'idol', 'thornback']);
export function formOf(team: UnitSpec[]): FormKey {
  if (!team.length) return 'mixed';
  const sc: Record<FormKey, number> = { tank: 0, summon: 0, carry: 0, snipe: 0, boom: 0, wall: 0, rush: 0, mixed: 0 };
  for (const u of team) {
    const ab = card(u.def).ab ?? '';
    if (SUMMON_AB.has(ab)) sc.summon++;
    if (BOOM_AB.has(ab)) sc.boom++;
    if (WALL_AB.has(ab) || (equipOf(u.ench)?.block ?? 0) > 0) sc.wall++;
    if (SNIPE_AB.has(ab)) sc.snipe++;
    if (HURT_AB.has(ab)) sc.tank++;
  }
  const best = (['summon', 'boom', 'wall', 'snipe', 'tank'] as FormKey[]).sort((a, b) => sc[b] - sc[a])[0];
  const tot = team.reduce((s, u) => s + u.atk + u.hp, 0);
  const big = Math.max(...team.map((u) => u.atk + u.hp));
  if (team.length >= 3 && big >= tot * 0.4 && sc[best] < 3) return 'carry';
  // 形态名要名副其实：至少 3 个（3 人以下的小队 2 个）同类技能才挂这个名
  if (sc[best] >= (team.length <= 3 ? 2 : 3)) return best;
  const atk = team.reduce((s, u) => s + u.atk, 0);
  const hp = team.reduce((s, u) => s + u.hp, 0);
  if (atk >= hp * 0.9) return 'rush';
  return 'mixed';
}

/** v0.5 装备让玩家整体变强，普通敌阵按此系数补回（Boss 另有校准） */
export let EQUIP_K = 1.1;
export const setEquipK = (k: number) => { EQUIP_K = k; };
/** 对玩家当前阵容的快模拟胜率（平局算半场） */
function winRate(r: RunState, enemy: UnitSpec[], n = 4) {
  const me = playerTeam(r);
  if (!me.length) return 0;
  let w = 0;
  for (let i = 0; i < n; i++) {
    const res = simulate(me, enemy, (r.seed + i * 104729 + r.turn * 7) & 0x7fffffff, r.relics).result;
    w += res === 'win' ? 1 : res === 'draw' ? 0.5 : 0;
  }
  return w / n;
}
interface Cand { units: UnitSpec[]; form: FormKey; wr: number; encounter?: Enemy['encounter'] }

// ── 压力：玩家阵容太强时，把敌阵整体放大到「这一档该有的胜率上限」（只放大不缩小） ──
/** 前两回合发育期不加压；第 3–4 回合轻压；之后满压 */
const PRESSURE_FROM = 3;
/** 三档温度（简单 / 中等 / 困难）各自的胜率上限 */
export let PRESSURE_CAPS: [number, number, number] = [0.93, 0.75, 0.45];
export const setPressureCaps = (c: [number, number, number]) => { PRESSURE_CAPS = c; };
const capOf = (r: RunState, gi: number) => {
  if (r.turn < PRESSURE_FROM) return 1;
  const early = r.turn < 5 ? 0.08 : 0;
  return Math.min(0.97, PRESSURE_CAPS[gi] + early - 0.04 * (r.diff ?? 0));
};
const liftMax = (r: RunState) => (r.turn < 5 ? 1.3 : 2.2);
/** 胜率高于 cap 就二分放大系数，压到 cap 附近 */
function lift(r: RunState, units: UnitSpec[], wr: number, cap: number, maxK = liftMax(r)): { units: UnitSpec[]; wr: number } {
  if (cap >= 1 || wr <= cap) return { units, wr };
  const top = scaleTeam(units, maxK);
  const wTop = winRate(r, top, 6);
  if (wTop >= cap) return { units: top, wr: wTop };
  let lo = 1, hi = maxK, best = { units: top, wr: wTop };
  for (let i = 0; i < 5; i++) {
    const k = (lo + hi) / 2;
    const us = scaleTeam(units, k);
    const w = winRate(r, us, 6);
    if (w > cap) lo = k;
    else { hi = k; best = { units: us, wr: w }; }
  }
  return best;
}

// ── 敌阵整理：幽灵是 bot 的真实阵容，偶尔有站错位、混进凑数小兵的，出场前理一下 ──
/** 技能要身前有人（站队首就白给） */
const NEED_FRONT = new Set(['dodo', 'snake', 'kangaroo', 'backstab', 'giraffe', 'tiger', 'parrot']);
/** 技能作用在身后（站队尾就白给） */
const NEED_BACK = new Set(['elephant', 'camel', 'drill', 'flamingo', 'turtle']);
export function tidyTeam(team: UnitSpec[]): UnitSpec[] {
  const t = team.map((u) => ({ ...u }));
  const n = t.length;
  if (n >= 2) {
    const ab = (u: UnitSpec) => card(u.def).ab ?? '';
    const bad = (u: UnitSpec, i: number) => (i === 0 && NEED_FRONT.has(ab(u)) ? 1 : 0) + (i === n - 1 && NEED_BACK.has(ab(u)) ? 1 : 0);
    const cost = () => t.reduce((s, u, i) => s + bad(u, i), 0);
    for (let guard = 0; guard < 6 && cost() > 0; guard++) {
      let moved = false;
      for (const i of [0, n - 1]) {
        if (!bad(t[i], i)) continue;
        // 和最近的、换过去不添新毛病的单位对调
        const order = [...Array(n).keys()].filter((j) => j !== i).sort((a, b) => Math.abs(a - i) - Math.abs(b - i));
        for (const j of order) {
          const before = cost();
          [t[i], t[j]] = [t[j], t[i]];
          if (cost() < before) { moved = true; break; }
          [t[i], t[j]] = [t[j], t[i]];
        }
      }
      if (!moved) break;
    }
  }
  // 凑数小兵：身材不到队伍均值 35% 的（蛋这种靠攒成长的除外），抬到 50%
  const mean = t.reduce((s, u) => s + u.atk + u.hp, 0) / Math.max(1, n);
  for (const u of t) {
    const sz = u.atk + u.hp;
    if (u.bank != null || sz >= mean * 0.35 || mean < 8) continue;
    const k = (mean * 0.5) / sz;
    u.atk = Math.max(1, Math.min(STAT_CAP, Math.round(u.atk * k)));
    u.hp = Math.max(1, Math.min(STAT_CAP, Math.round(u.hp * k)));
  }
  return t;
}
/** 候选敌阵：生态内、不连续同形态；不够就放宽 */
function candidates(r: RunState, k = 8, avoid: FormKey | null = r.lastForm): Cand[] {
  const pool = ghostPool(r.turn);
  const sc = enemyScale(r.turn) * EQUIP_K * diffK(r);
  const all = pool.map((t) => ({ t, form: formOf(t) }));
  // 幽灵库里太少的生态形态，用同形态技能卡按中位预算补阵
  for (const f of r.eco) if (all.filter((x) => x.form === f).length < 2) for (let i = 0; i < 2; i++) all.push({ t: synthTeam(r, f), form: f });
  let list = all.filter((x) => r.eco.includes(x.form) && x.form !== avoid);
  if (list.length < 3) list = all.filter((x) => x.form !== avoid);
  if (list.length < 3) list = all;
  // 中后期逐步加入预设配合；仍随机抽取候选，不按玩家技能拼反制阵。
  const scripted = authoredEncounters(r.turn, medianBudget(r.turn)).filter((x) => x.form !== avoid);
  const wanted = Math.min(k, r.turn >= 15 ? 4 : r.turn >= 12 ? 2 : r.turn >= 9 ? 1 : 0);
  const preferred = scripted.filter((x) => r.eco.includes(x.form));
  const chosen = pickN(r, preferred.length >= wanted ? preferred : scripted, Math.min(wanted, scripted.length));
  const ghosts: Cand[] = pickN(r, list, Math.max(0, k - chosen.length)).map((x) => {
    const units = tidyTeam(scaleTeam(x.t, sc));
    return { units, form: x.form, wr: winRate(r, units) };
  });
  return [...ghosts, ...chosen.map(({ key, name, hint, form, units }) => {
    const scaled = scaleTeam(units, sc);
    return { units: scaled, form, encounter: { key, name, hint }, wr: winRate(r, scaled) };
  })];
}
/** 温度：简单 / 中等 / 困难 的权重 */
export function tempWeights(r: RunState): [number, number, number] {
  // 前两回合是发育期：多给简单局，不出困难局
  let [e, m, h] = r.turn <= 2 ? [70, 30, 0] : [20, 55, 25];
  const T = DIFFS[r.diff ?? 0].temp;
  const lose = Math.max(0, -r.streak);
  const sh = Math.min(h, Math.round(10 * lose * T));
  h -= sh;
  e += sh;
  if (r.warm) {
    const x = Math.min(h, 10);
    h -= x;
    e += x;
  }
  if (r.streak >= 3) {
    const x = Math.min(10, 45 - h, m);
    h += x;
    m -= x;
  }
  if (r.lives <= 3 && T >= 0.5) {
    m += h;
    h = 0;
    if (e < 40) {
      m -= 40 - e;
      e = 40;
    }
  }
  return [e, m, h];
}
const bucketOf = (wr: number) => (wr > 0.75 ? 0 : wr >= 0.45 ? 1 : 2);
function pickByTemp(r: RunState, cs: Cand[]): Cand {
  const w = tempWeights(r);
  const groups: Cand[][] = [[], [], []];
  for (const c of cs) groups[bucketOf(c.wr)].push(c);
  // 先按温度定这一档，再找人：这一档没人时，玩家太强就拿最难的那队放大，太弱就给最容易的
  const pressure = r.turn >= PRESSURE_FROM;
  const ws = w.map((x, i) => (groups[i].length || (pressure && i > 0) ? x : 0));
  const tot = ws.reduce((a, b) => a + b, 0);
  if (!tot) return pick(r, cs);
  let t = rng(r) * tot;
  let gi = ws.findIndex((x) => (t -= x) < 0);
  if (gi < 0) gi = 1;
  let c: Cand;
  if (groups[gi].length) c = pick(r, groups[gi]);
  else {
    const sorted = [...cs].sort((x, y) => x.wr - y.wr);
    c = cs.every((x) => bucketOf(x.wr) < gi) ? sorted[0] : sorted[sorted.length - 1];
  }
  const l = lift(r, c.units, c.wr, capOf(r, gi));
  return { ...c, ...l };
}
const ELITE_AX: Atom[] = ATOMS.filter((a) => a !== 'pierce');
/** 精英：在中等档敌阵上挂 1–2 个词缀，挑实测胜率最接近目标的组合 */
function makeElite(r: RunState, base: Cand): Enemy {
  const n = r.turn >= 9 ? 2 : 1;
  const target = isWarm(r) ? 0.5 : 0.38;
  let best: { ax: Atom[]; units: UnitSpec[]; d: number } | null = null;
  for (let i = 0; i < 4; i++) {
    const ax = pickN(r, ELITE_AX, n);
    const us = base.units.map((u) => ({ ...u, ax }));
    const d = Math.abs(winRate(r, us) - target);
    if (!best || d < best.d) best = { ax, units: us, d };
  }
  const boosted = lift(r, best!.units, winRate(r, best!.units, 6), target);
  return { boss: null, units: boosted.units, form: base.form, elite: best!.ax, encounter: base.encounter };
}
function makeEnemy(r: RunState): Enemy {
  const boss = bossFor(r);
  if (boss) {
    const units = bossTeam(BOSSES[boss], r.turn, bossMul(r, boss) * diffK(r));
    // Boss 是关卡：阵容再强也要拼一下；终局每输一次放松一点
    const cap = r.turn <= 4 ? 0.82 : Math.min(0.88, 0.66 - 0.04 * (r.diff ?? 0) + (boss === 'final' ? 0.08 * r.finalLosses : 0));
    return { boss, units: lift(r, units, winRate(r, units, 6), cap, r.turn <= 4 ? 1.3 : 2).units };
  }
  if (!ghostPool(r.turn).length) return { boss: null, units: curveTeam(r) };
  const c = pickByTemp(r, candidates(r));
  return { boss: null, units: c.units, form: c.form, encounter: c.encounter };
}
/** 岔路回合：每 3 回合、非 Boss */
export const isBranchTurn = (r: Pick<RunState, 'turn' | 'wins'>) => r.turn % 3 === 0 && !bossFor(r);
/** 生成本回合敌人（岔路回合给两个选项，默认第一个） */
function nextEnemy(r: RunState) {
  r.branch = null;
  r.event = null;
  const a = makeEnemy(r);
  r.enemy = a;
  if (!isBranchTurn(r) || !ghostPool(r.turn).length) return;
  // 事件偶尔替代岔路（每种每局最多一次）
  if (rng(r) < EVENT_CHANCE) {
    const evs = EVENTS.filter((e) => !r.seenEv.includes(e) && (e !== 'chaos' || (r.turn <= 12 && relicPool(r).length >= 3)) && (e !== 'merc' || r.turn <= 13));
    if (evs.length) {
      r.event = pick(r, evs);
      r.seenEv.push(r.event);
      return;
    }
  }
  let b: Enemy;
  if (rng(r) < 0.7) {
    const cs = candidates(r, 6, a.form ?? null);
    const mid = cs.filter((c) => bucketOf(c.wr) === 1);
    b = makeElite(r, pick(r, mid.length ? mid : cs));
  } else {
    const c = pickByTemp(r, candidates(r, 8, a.form ?? null));
    b = { boss: null, units: c.units, form: c.form, encounter: c.encounter };
  }
  r.branch = [a, b];
}
export function pickBranch(r: RunState, i: number) {
  if (!r.branch?.[i]) return;
  r.enemy = r.branch[i];
  r.branch = null;
}
const FORM_AB: Partial<Record<FormKey, Set<string>>> = { summon: SUMMON_AB, boom: BOOM_AB, wall: WALL_AB, snipe: SNIPE_AB, tank: HURT_AB };
/** 补阵：按形态挑技能卡；大哥 = 一个单位吃 45% 预算；速攻 = 攻多血少 */
function synthTeam(r: RunState, f: FormKey): UnitSpec[] {
  const n = Math.min(5, 1 + Math.ceil(r.turn / 2));
  const budget = medianBudget(r.turn);
  const tier = maxTier(r.turn);
  const set = FORM_AB[f];
  const all = SHOP_POOL.filter((c) => c.tier <= tier);
  const pool = set ? all.filter((c) => set.has(c.ab ?? '')) : all;
  const lvl: 1 | 2 | 3 = r.turn >= 12 ? 2 : 1;
  return Array.from({ length: n }, (_, i) => {
    const d = pick(r, pool.length >= 2 || i % 2 === 0 ? (pool.length ? pool : all) : all);
    const share = f === 'carry' ? (i === n - 1 ? 0.45 : 0.55 / (n - 1)) : 1 / n;
    let per = budget * share;
    let a = d.atk, h = d.hp;
    if (f === 'rush') { a = d.atk + d.hp * 0.6; h = d.hp * 0.4; }
    const k = per / (a + h || 1);
    const ench = f === 'wall' && i === 0 ? 'amulet' : undefined;
    return { def: d.id, lvl, atk: Math.max(1, Math.min(STAT_CAP, Math.round(a * k))), hp: Math.max(1, Math.min(STAT_CAP, Math.round(h * k))), ench };
  });
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
  return simulate(playerTeam(r), r.enemy.units, (r.seed ^ (r.turn * 7919)) & 0x7fffffff, r.relics);
}
/** 试打：在副本上结束回合再开打，不改存档；随机种子每次不同，只看大概 */
export function trialFight(r: RunState): BattleOut {
  const c = structuredClone(r);
  endTurn(c);
  return simulate(playerTeam(c), c.enemy.units, (Math.random() * 2 ** 31) | 0, c.relics);
}
export const AD_RETRY_MAX = 2;
/** 看广告重打：整局退回开战前（snap），可以重新调整阵容再打 */
export function adRetry(r: RunState, snap: RunState): boolean {
  const used = r.adRetry ?? 0;
  if (used >= AD_RETRY_MAX) return false;
  for (const k of Object.keys(r)) delete (r as unknown as Record<string, unknown>)[k];
  Object.assign(r, structuredClone(snap), { adRetry: used + 1 });
  return true;
}

/** 战斗结算：扣心/记胜，清掉本场加成，进入下一回合 */
export function settleBattle(r: RunState, out: Pick<BattleOut, 'result' | 'perm'>) {
  const result = out.result;
  for (const [oid, p] of Object.entries(out.perm)) {
    const o = byOid(r, Number(oid));
    if (o) grow(o, p.atk, p.hp);
  }
  for (const o of units(r)) {
    o.tmpAtk = undefined;
    o.tmpHp = undefined;
    o.lamp = undefined;
    o.tfx = undefined;
  }
  r.history.push(result);
  if (r.enemy.boss === 'final') r.finalLosses = result === 'lose' ? r.finalLosses + 1 : 0;
  r.lastLoss = 0;
  if (result === 'win') {
    r.wins++;
    r.streak = Math.max(1, r.streak + 1);
    if (r.enemy.elite?.length) r.chest = rollChest(r, 'elite');
    else if (r.enemy.boss && r.enemy.boss !== 'final') r.relicDue++;
  }
  // 雇佣兵倒数离队；混沌契约倒数，熬完给遗物
  r.queue = r.queue.map((o) => {
    if (!o?.merc) return o;
    o.merc--;
    if (o.merc > 0) return o;
    if (o.ench) toBag(r, o.ench);
    return null;
  });
  if (r.chaos > 0 && --r.chaos === 0) r.relicDue++;
  openRelic(r);
  if (result === 'lose') {
    r.lastLoss = enemyLossCost(r);
    r.lives -= r.lastLoss;
    r.streak = Math.min(-1, r.streak - 1);
  }
  if (r.enemy.form) r.lastForm = r.enemy.form;
  if (r.wins >= WIN_GOAL) {
    r.phase = 'won';
    return;
  }
  if (r.lives <= 0) {
    r.lives = 0;
    r.phase = 'lost';
    return;
  }
  advance(r);
}

/** 看广告保心：退回上一场扣的心（每局 2 次）；若因此免于出局则继续 */
export function adSaveHeart(r: RunState): boolean {
  if (!r.lastLoss || r.adSave >= AD_SAVE_MAX) return false;
  r.adSave++;
  r.lives += r.lastLoss;
  r.lastLoss = 0;
  if (r.streak < 0) r.streak = Math.min(-1, r.streak + 1);
  if (r.phase === 'lost') {
    r.phase = 'prep';
    advance(r);
  }
  return true;
}

function advance(r: RunState) {
  r.turn++;
  r.rerolls = 0;
  r.tc = newCount();
  r.gold = GOLD_PER_ROUND;
  // 额外牛奶只属于上一备战，锁定也不跨回合。
  r.shop = r.shop.filter((s) => s.kind !== 'food' || s.def !== 'f_milk');
  rollShop(r);
  grantPrepMilk(r);
  r.pendingFx = [];
  nextEnemy(r);
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
    const raw = localStorage.getItem(SAVE_KEY);
    const r = JSON.parse(raw ?? 'null') as RunState | null;
    if (!r || r.v !== SAVE_VERSION || r.phase !== 'prep' || !Array.isArray(r.queue) || r.queue.length !== QUEUE_MAX) return null;
    const ok = r.queue.every((o) => !o || card(o.def)) && r.shop.every((s) => (s.kind === 'food' ? FOOD[s.def] : card(s.def))) && r.enemy.units.every((u) => card(u.def));
    if (!ok || !Number.isInteger(r.nextId) || !Number.isInteger(r.turn)) return null;
    if (!r.tc || !Number.isSafeInteger(r.tc.foods) || r.tc.foods < 0 || !Number.isSafeInteger(r.tc.bought) || r.tc.bought < 0
      || !r.tc.bear || typeof r.tc.bear !== 'object' || Array.isArray(r.tc.bear)
      || (r.tc.bearRefunds !== undefined && (!Number.isSafeInteger(r.tc.bearRefunds) || r.tc.bearRefunds < 0 || r.tc.bearRefunds > 2))
      || (r.tc.shareUsed !== undefined && typeof r.tc.shareUsed !== 'boolean')) return null;
    const validUses = (x: Record<number, number>) => Object.entries(x).every(([oid, used]) => {
      const n = Number(oid);
      return Number.isSafeInteger(n) && n > 0 && String(n) === oid && Number.isSafeInteger(used) && used >= 0;
    });
    if (!validUses(r.tc.bear)) return null;
    if (r.tc.keeper !== undefined && (!r.tc.keeper || typeof r.tc.keeper !== 'object' || Array.isArray(r.tc.keeper) || !validUses(r.tc.keeper))) return null;
    const legacySupply = r.supplyVersion === undefined;
    if (!legacySupply && r.supplyVersion !== SUPPLY_VERSION) return null;
    // 同版本增量字段：旧档没有记录就从空开始，不能从累计属性反推来源。
    const seen = new Set<number>();
    for (const o of units(r)) {
      if (!o.foodHistory) { o.foodHistory = []; continue; }
      if (!Array.isArray(o.foodHistory) || o.foodHistory.length > FOOD_HISTORY_MAX) return null;
      if (!card(o.def).inherit && o.foodHistory.length) return null;
      for (const m of o.foodHistory) {
        if (!m || !inheritableFood(m.id) || !Number.isSafeInteger(m.sourceId) || m.sourceId < 1 || seen.has(m.sourceId)
          || !Number.isFinite(m.atk) || !Number.isFinite(m.hp) || m.atk < 0 || m.hp < 0 || m.atk > STAT_CAP || m.hp > STAT_CAP) return null;
        seen.add(m.sourceId);
      }
    }
    if (legacySupply) {
      // 原件先独立留档；无法备份时宁可拒绝迁移，也不在内存中改写用户进度。
      if (!raw) return null;
      if (localStorage.getItem(PRE_SUPPLY_BACKUP_KEY) === null) {
        try { localStorage.setItem(PRE_SUPPLY_BACKUP_KEY, raw); }
        catch { return null; }
      }
      const normal = r.shop.filter((s) => s.kind === 'food' && s.def !== 'f_milk');
      const cap = foodSlots(r.turn);
      if (normal.length > cap) {
        // 锁定优先；锁定组与未锁定组内部都保留旧货架顺序。
        const keep = new Set([...normal.filter((s) => s.locked), ...normal.filter((s) => !s.locked)].slice(0, cap));
        r.shop = r.shop.filter((s) => s.kind !== 'food' || s.def === 'f_milk' || keep.has(s));
      }
      r.supplyVersion = SUPPLY_VERSION;
    }
    const foods = r.shop.filter((s) => s.kind === 'food');
    const milk = foods.filter((s) => s.def === 'f_milk');
    if (foods.length > FOOD_SHOP_MAX || milk.length > MILK_MAX || milk.some((s) => !s.val || s.val.length !== 2 || s.val.some((v) => !Number.isFinite(v) || v < 1 || v > 3))) return null;
    for (const s of milk) s.locked = false;
    r.milkTurn ??= r.turn;
    // 旧档不能反推出是否已用过餐盘；本回合保守保留，下一回合重新可用。
    r.tc.shareUsed ??= r.tc.foods > 0;
    // 旧档没有全队返金计数；本回合吃过补给时保守视为额度已用尽，避免读档刷新经济额度。
    r.tc.bearRefunds ??= r.tc.foods > 0 ? 2 : 0;
    // 旧档没有守望者次数历史：只要本回合吃过补给，就按当前阵容逐个保守耗尽。
    if (r.tc.keeper === undefined) {
      r.tc.keeper = {};
      if (r.tc.foods > 0) for (const o of units(r)) if (abOf(o) === 'seal') r.tc.keeper[o.oid] = uOf(o);
    }
    return r;
  } catch {
    return null;
  }
}
export function clearAll() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('pdqs_')).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

// ── 遗物 ──
export const relicPool = (r: RunState) => RELICS.filter((x) => !r.relics.includes(x.id)).map((x) => x.id);
/** 有待选的遗物就生成本次选项 */
export function openRelic(r: RunState) {
  if (r.relicPick || r.relicDue <= 0) return;
  const pool = relicPool(r);
  if (!pool.length) { r.relicDue = 0; return; }
  r.relicPick = { opts: pickN(r, pool, 3), ad: false };
}
/** 广告：遗物多一选（3 → 4） */
export function adRelic(r: RunState): boolean {
  const p = r.relicPick;
  if (!p || p.ad) return false;
  const more = relicPool(r).filter((x) => !p.opts.includes(x));
  p.ad = true;
  if (more.length) p.opts.push(pick(r, more));
  return true;
}
export function pickRelic(r: RunState, i: number) {
  const p = r.relicPick;
  if (!p) return;
  const id = p.opts[i];
  if (id) r.relics.push(id);
  r.relicPick = null;
  r.relicDue = Math.max(0, r.relicDue - 1);
  openRelic(r);
}

// ── 事件 ──
export const EVENTS: EventId[] = ['camp', 'smith', 'morph', 'merc', 'chaos'];
export const EVENT_CHANCE = 0.35;
export const MERC_FIGHTS = 3;
/** 变形候选：同阶、共享任一标签、不同名 */
export const morphPool = (o: Owned) => {
  const d = card(o.def);
  const tags = [d.line, d.tag2].filter((t) => t && t !== 'any') as (typeof LINES)[number][];
  return SHOP_POOL.filter((c) => c.tier === d.tier && c.id !== d.id && (tags.length ? tags.some((t) => hasTag(c, t)) : true));
};
/** 雇佣兵的阶数：当前可买最高阶 +1 */
export const mercTier = (r: RunState) => Math.min(6, maxTier(r.turn) + 1) as Tier;
export type EventOut = { ok: false } | { ok: true; fx: ShopFx[]; levelUp?: boolean; lost?: Owned; morphed?: string; bag?: Ench; merc?: number };
/** 事件选择：choice 0 = 主选项（camp 有 0/1 两个），-1 = 离开；需要单位的选项带 slot */
export function resolveEvent(r: RunState, choice: number, slot: number | null = null): EventOut {
  const ev = r.event;
  if (!ev) return { ok: false };
  const o = slot === null ? null : r.queue[slot];
  const fx: ShopFx[] = [];
  let out: EventOut = { ok: true, fx };
  if (choice >= 0) {
    switch (ev) {
      case 'camp':
        if (choice === 0) {
          if (!o) return { ok: false };
          growFx(fx, null, o, 3, 3, '训练营');
        } else {
          const id = rollItem(r, 1, [], 1);
          toBag(r, id);
          out = { ok: true, fx, bag: id };
        }
        break;
      case 'smith': {
        if (!o || o.merc || o.copies >= MAX_COPIES) return { ok: false };
        const others = units(r).filter((t) => t !== o && !t.merc);
        if (!others.length) return { ok: false };
        const lost = pick(r, others);
        r.queue[r.queue.indexOf(lost)] = null;
        if (lost.ench) toBag(r, lost.ench);
        const need = (o.copies >= 3 ? 6 : 3) - o.copies;
        const levelUp = addCopies(r, o, need, fx);
        out = { ok: true, fx, levelUp, lost };
        break;
      }
      case 'morph': {
        if (!o || o.merc) return { ok: false };
        const pool = morphPool(o);
        if (!pool.length) return { ok: false };
        o.def = pick(r, pool).id;
        o.copy = undefined;
        if (!card(o.def).inherit) o.foodHistory = undefined;
        out = { ok: true, fx, morphed: o.def };
        break;
      }
      case 'merc': {
        const at = r.queue.findIndex((x) => !x);
        if (at < 0) return { ok: false };
        const pool = SHOP_POOL.filter((c) => c.tier === mercTier(r));
        const m: Owned = { oid: r.nextId++, def: pick(r, pool).id, copies: 3, atkBonus: 0, hpBonus: 0, merc: MERC_FIGHTS };
        r.queue[at] = m;
        out = { ok: true, fx, merc: at };
        break;
      }
      case 'chaos':
        r.chaos = 3;
        r.enemy = makeEnemy(r);
        break;
    }
  }
  r.event = null;
  return out;
}
