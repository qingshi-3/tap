// 一局状态与商店经济：金币递增、付费升本、混合手牌与三连发现。
import { ATOMS, BOSSES, card, equipOf, equipStats, EQUIPS, FOOD, FOOD_POOL, SPELL_POOL, ALL, hasTag, LINES, RELICS, SHOP_POOL, type Atom, type BossDef, type CardDef, type Ench, type EventId, HERO, type HeroId, type QuestId, QUEST_INFO, type FoodDef, type FoodFx, type Quality, type RelicId, type Tier, type NativeTiming } from './data';
import { QUEUE_MAX, simulate, type BattleOut, type UnitSpec, type GrantedAbility } from './engine';
import ghostData from './ghosts.json';
import { STAT_CAP } from './data';
import { authoredEncounters, type AuthoredEncounter } from './encounters';

export const SAVE_KEY = 'pdqs3_run_v3';
export const SAVE_VERSION = 3;
export const LEGACY_SAVE_KEY = 'pdqs3_run_v2';
export const saveStatus = (): 'current' | 'unsupported' | 'invalid' | 'empty' => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return localStorage.getItem(LEGACY_SAVE_KEY) ? 'unsupported' : 'empty';
    let parsed: {v?: number};
    try { parsed = JSON.parse(raw); } catch { return 'invalid'; }
    if (parsed?.v !== SAVE_VERSION) return 'unsupported';
    return load() ? 'current' : 'invalid';
  } catch { return 'invalid'; }
};
/** Preserve the exact unreadable current record before starting a new run. */
export function beginNewRunBackup(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw === null) return true;
    let i = 0; let key = `${SAVE_KEY}_backup_${Date.now()}`;
    while (localStorage.getItem(key) !== null) key = `${SAVE_KEY}_backup_${Date.now()}_${++i}`;
    localStorage.setItem(key, raw);
    return localStorage.getItem(key) === raw;
  } catch { return false; }
}
export const MAX_LIVES = 5;
/** 路线图：3 幕 × (6 层 + Boss)；每个节点一回合，打赢第 3 幕 Boss 通关 */
export const ACTS = 3;
export const LAYERS = 6;
export const GOLD_PER_ROUND = 10;
/** 每回合金币：3、4、5…封顶 10，不结转 */
export const goldFor = (turn: number) => Math.min(GOLD_PER_ROUND, turn + 2);
/** 升到第 n 级酒馆的基础价；每过一回合 −1（最低 0），升级后下一级从基础价重新计 */
export const TAVERN_COST: Record<number, number> = { 2: 5, 3: 7, 4: 8, 5: 9, 6: 10 };
export const TAVERN_MAX = 6;
/** 手牌数组长度包含遗物提供的额外格；实际可用格数看 handCap。 */
export const HAND_MAX = 5;
export const HAND_BASE_CAP = 4;
/** 手牌格在队伍 5 格之后。 */
export const HAND_BASE = QUEUE_MAX;
export const PRICE = 3;
export const REROLL = 1;
export const MAX_COPIES = 3;
/** 只防溢出，不当玩法上限 */
export { STAT_CAP } from './data';
export const FOOD_HISTORY_MAX = 5;
export const MILK_MAX = 2;
export const FOOD_SHOP_MAX = 5;
export const SUPPLY_VERSION = 1;
export const PRE_SUPPLY_BACKUP_KEY = 'pdqs3_run_v1_pre_supply_backup';
export const INHERIT_FOODS = ['f_bread', 'f_whet', 'f_roast', 'f_milk'] as const;
/** 一件原始补给的基础规格；不能写入倍率、技能或其他永久成长。 */
export interface FoodMemory { id: string; atk: number; hp: number; sourceId: number }
export const LEGION_MAX = 8;
export const GUARD_N = 3;
/** 法术在补给位里的出现概率 */
export const SPELL_RATE = 1 / 3;
/** 历战：每场最多 / 累计上限，按阶层递增 */
export const scarPer = (def: string) => { const t = card(def).tier; return t <= 2 ? 1 : t <= 4 ? 2 : 3; };
export const scarCap = (def: string) => scarPer(def) * 4;
export const hasScar = (def: string) => hasTag(card(def), 'hurt');
/** 每幕 Boss 的候选（开局各抽一个） */
export const ACT_BOSSES: BossKey[][] = [['wall', 'tide'], ['forge', 'horde'], ['final']];
/** 第 act 幕第 layer 层的计划回合（Boss 层 = LAYERS） */
export const actTurn = (act: number, layer: number) => act * (LAYERS + 1) + layer + 1;
/** 校准用：各 Boss 的计划回合 */
export const BOSS_TURNS: [BossKey, number][] = ACT_BOSSES.flatMap((ks, a) => ks.map((k) => [k, actTurn(a, LAYERS)] as [BossKey, number]));

export interface Owned {
  kind?: 'unit';
  granted?: GrantedAbility;
  pendingGoldPlay?: boolean;
  startBlock?: number;
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
  /** 雇佣兵：还剩几场离队 */
  merc?: number;
  /** 只保存最早五件直接食用的白名单补给，传承重吃不写入。 */
  foodHistory?: FoodMemory[];
  /** 历战：受伤标签单位在战斗里攒下的永久 +n/+n（已计入 atkBonus/hpBonus，这里只记数用于上限） */
  scar?: number;
  /** 驻守计数（每打满 GUARD_N 场发现一次） */
  guard?: number;
  /** 买进手牌还没上过场：第一次上场时才算「被召唤」 */
  fresh?: boolean;
  /** 老兵队长：在队里待过的回合数 */
  stay?: number;
}
export interface HeldSpell { kind: 'spell'; oid: number; def: string; val?: [number, number]; source: string; obtainedTurn: number; expiresTurn?: number }
export type HandCard = Owned | HeldSpell;
export const isHeldSpell = (x: HandCard | null | undefined): x is HeldSpell => x?.kind === 'spell';
export interface PendingReward { id: number; card: HandCard; source: string }
/** free：升星奖励卡（SAP 式：照常 3 金，刷新/新回合会被刷走，可锁定；不占普通单位格）。val：牛奶的攻血 */
export interface ShopItem { sid: number; kind: 'unit' | 'food'; def: string; locked: boolean; free: boolean; val?: [number, number];
  /** 发现来的卡；price 覆盖单价（0 = 白送，本回合刷新不会刷走） */
  disc?: boolean; price?: number; source?: string }
/** 发现：三张卡选一张。gain 放上货架；morph 替换 oid 那个单位（保留星级和成长） */
export interface Discover { opts: string[]; src: string; mode: 'gain' | 'morph' | 'spell'; price: number; oid?: number; count?: number; val?: [number, number] }
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

export type NodeKind = 'fight' | 'elite' | 'camp' | 'shop' | 'event' | 'treasure' | 'boss';
/** 地图节点：next 为下一层可去的节点下标；form 为战斗节点提前亮出的敌人形态 */
export interface MapNode { k: NodeKind; form?: FormKey; next: number[]; enemy?: Enemy; battleSeed?: number }
/** 商人货物：装备 / 遗物碎片 / 高阶法术 */
export interface Goods { kind: 'equip' | 'shard' | 'spell'; id: string; price: number; sold?: boolean }
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
  spellUsed?: boolean;
}
export interface RunState {
  v: number;
  seed: number;
  turn: number;
  lives: number;
  wins: number;
  gold: number;
  queue: (Owned | null)[];
  /** 手牌：不参战、不触发技能 */
  hand: (HandCard | null)[];
  rewards?: PendingReward[];
  worldSeed?: number;
  endTurnCommitted?: boolean;
  lastSettledBattle?: string;
  /** 酒馆等级 1–6：货架只出 ≤ 该阶的卡 */
  tavern: number;
  /** 升到下一级的当前价格 */
  tavernCost: number;
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
  /** 难度 0 普通 / 1 困难 / 2 噩梦 */
  diff: Diff;
  relics: RelicId[];
  /** 待选的遗物次数；当前这次的选项（ad：已看广告多一选） */
  firstRelicGiven?: boolean;
  firstRelicPending?: boolean;
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
  /** 军团规格：全局，我方召唤物入场 +n/+n */
  legion?: number;
  /** 上一场军团规格涨了多少（UI 提示后清零） */
  legionUp?: number;
  /** 待选的发现（队列，前面的先弹） */
  discover?: Discover[];
  /** 储金罐：下回合开始返还 */
  bankGold?: number;
  /** 预言：下回合货架必出高一阶 */
  omen?: boolean;
  /** 战备：本回合剩余免费刷新 */
  freeRr?: number;
  /** 本幕地图（layers[LAYERS] = [Boss]）、当前幕 / 层、本幕已走的节点下标 */
  map: MapNode[][];
  act: number;
  layer: number;
  path: number[];
  /** 三幕 Boss（开局定好，地图上可见） */
  bosses: BossKey[];
  /** 非战斗节点：已结束回合，正在处理节点内容（读档时接着处理） */
  leaving?: boolean;
  /** 本回合商人货物 */
  merchant?: Goods[] | null;
  shards?: number;
  hero: HeroId;
  /** 主动技能上次使用的回合 */
  heroUsed?: number;
  /** 进行中的委托；questAct 已发过委托的幕；questDone 刚完成（UI 提示后清空） */
  quest?: { id: QuestId; n: number } | null;
  questAct?: number;
  questDone?: QuestId | null;
  /** 首局：不出商人 / 委托 */
  lite?: boolean;
  /** 本回合速成已触发 */
  quickUsed?: number;
}
export type Diff = 0 | 1 | 2;
/** 难度：k 敌人系数，temp 温度保留比例，lives 起始心数。通关率以当前版本同种子实测为准 */
export const DIFFS: { name: string; desc: string; k: number; temp: number; lives: number }[] = [
  { name: '普通', desc: '适合第一次远征', k: 0.88, temp: 1, lives: 5 },
  { name: '困难', desc: '敌人更强，手气差时不再放水', k: 0.95, temp: 0.5, lives: 3 },
  { name: '噩梦', desc: '敌人再强一截，只有 2 颗心', k: 0.82, temp: 0.2, lives: 2 },
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

/** 三连金色：3 份 = 金色（技能用 ★2 数值） */
export const lvlOf = (copies: number): 1 | 2 | 3 => (copies >= MAX_COPIES ? 2 : 1);
export const isGold = (o: Pick<Owned, 'copies'>) => o.copies >= MAX_COPIES;
/** 凑金色的进度：[已有, 需要] */
export const starProgress = (copies: number): [number, number] => [Math.min(copies, MAX_COPIES), MAX_COPIES];
/** 白板：1 份 = 原值，2 份 +1/+1，金色 = 两倍原值；再加永久成长 */
const baseStat = (v: number, copies: number) => (copies >= MAX_COPIES ? v * 2 : v + copies - 1);
export const ownedAtk = (o: Owned) => Math.min(STAT_CAP, Math.max(1, baseStat(card(o.def).atk, o.copies) + o.atkBonus));
export const ownedHp = (o: Owned) => Math.min(STAT_CAP, baseStat(card(o.def).hp, o.copies) + o.hpBonus);
/** 含装备的攻血（显示和上场用） */
export const shownStats = (o: Owned): [number, number] => equipStats(o.ench, ownedAtk(o), ownedHp(o));
export const sellPrice = (o: Owned) => (o.merc ? 0 : lvlOf(o.copies));
/** 货架单位格随酒馆等级：1 级 3 格、2–3 级 4 格、4 级起 5 格 */
export const unitSlots = (tavern: number) => (tavern <= 1 ? 3 : tavern <= 3 ? 4 : 5);
export const foodSlots = (tavern: number) => (tavern <= 1 ? 1 : 2);
/** 敌人生成仍按回合估阶层（幽灵库是按回合采的） */
export const maxTier = (turn: number): Tier => Math.min(6, Math.ceil(turn / 2)) as Tier;
/** 玩家能买到的最高阶 = 酒馆等级 */
export const tierOf = (r: Pick<RunState, 'tavern'>): Tier => Math.min(6, Math.max(1, r.tavern)) as Tier;
/** 输掉扣心：普通 1，精英 / Boss 2 */
export const lossCost = (hard = false) => (hard ? 2 : 1);
export const enemyLossCost = (r: Pick<RunState, 'enemy'>) => lossCost(!!r.enemy.elite?.length || !!r.enemy.boss);
export const handCap = (r: Pick<RunState, 'relics'>) => HAND_BASE_CAP + (r.relics.includes('r_medal') ? 1 : 0);
/** 升级酒馆的实际价格（商会长便宜 1） */
export const tavernPrice = (r: Pick<RunState, 'tavernCost' | 'hero'>) => Math.max(0, r.tavernCost - (r.hero === 'guild' ? 1 : 0));
export const adefOf = (o: Owned): CardDef => card(o.def);
const abOf = (o: Owned) => adefOf(o).ab;
const hasAbility = (o: Owned, timing: NativeTiming, effect: string) =>
  adefOf(o).abilities.some(a => a.role === 'event' && a.timing === timing && a.effect === effect);
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
const heldByOid = (r: RunState, oid: number) => byOid(r, oid) ?? r.hand.find((o): o is Owned => !!o && !isHeldSpell(o) && o.oid === oid);
/** cell：0–4 场上、5–7 手牌 */
export const isHand = (i: number) => i >= HAND_BASE;
export const handAt = (r: Pick<RunState, 'hand'>, i: number): HandCard | null => r.hand[i - HAND_BASE] ?? null;
export const cellAt = (r: Pick<RunState, 'queue' | 'hand'>, i: number): Owned | null => {
  const x = isHand(i) ? handAt(r, i) : r.queue[i];
  return x && !isHeldSpell(x) ? x : null;
};
function setCell(r: RunState, i: number, o: Owned | null) {
  if (isHand(i)) r.hand[i - HAND_BASE] = o;
  else r.queue[i] = o;
}
export const CELLS = QUEUE_MAX + HAND_MAX;
const newCount = (): TurnCount => ({ foods: 0, bought: 0, bear: {}, bearRefunds: 0, keeper: {}, shareUsed: false });

export function prepFoodUses(r: RunState, o: Owned): { used: number; max: number } | null {
  if (abOf(o) === 'seal') return { used: r.tc.keeper?.[o.oid] ?? 0, max: uOf(o) };
  if (abOf(o) === 'sauropod') return { used: r.tc.bearRefunds ?? 0, max: 2 };
  return null;
}

/** Facts and their IDs exist only for this in-memory run; reload starts a new observation scope and never replays past effects. */
export interface GrowthFact { kind: 'growth'; id: number; parentId?: number; phase: 'prep' | 'after_battle'; source: number | null; effectId: string; label: string; target: number; atk: number; hp: number }
export interface ActionFact { kind: 'action'; id: number; parentId?: number; action: 'buy' | 'obtain' | 'sell' | 'cast' | 'eat'; target: number | null; def: string }
export type RunFact = GrowthFact | ActionFact;
const growthObservers = new WeakMap<RunState, Set<(fact: RunFact) => void>>();
const growthSequence = new WeakMap<RunState, number>();
const actionContext = new WeakMap<RunState, number>();
const factBuffers = new WeakMap<RunState, RunFact[]>();
export function observeFacts(r: RunState, observer: (fact: RunFact) => void): () => void {
  let observers = growthObservers.get(r);
  if (!observers) growthObservers.set(r, observers = new Set());
  observers.add(observer);
  return () => observers!.delete(observer);
}
function publishFacts(r: RunState, facts: RunFact[]) {
  for (const fact of facts) for (const observer of growthObservers.get(r) ?? []) {
    try { observer(fact); } catch { /* Diagnostic observers cannot interrupt gameplay. */ }
  }
}
function emitFact(r: RunState, fact: RunFact) {
  growthSequence.set(r, fact.id);
  const buffer = factBuffers.get(r);
  if (buffer) buffer.push(fact);
  else publishFacts(r, [fact]);
}
function withFactBatch<T>(r: RunState, execute: () => T): T {
  if (factBuffers.has(r)) return execute();
  const facts: RunFact[] = [];
  factBuffers.set(r, facts);
  let completed = false;
  try {
    const result = execute();
    completed = true;
    return result;
  } finally {
    factBuffers.delete(r);
    if (completed) publishFacts(r, facts);
  }
}
function withAction<T>(r: RunState, action: ActionFact['action'], target: number | null, def: string, execute: () => T): T {
  return withFactBatch(r, () => {
    const parentId = actionContext.get(r);
    const id = (growthSequence.get(r) ?? 0) + 1;
    emitFact(r, { kind: 'action', id, parentId, action, target, def });
    actionContext.set(r, id);
    try { return execute(); }
    finally {
      if (parentId === undefined) actionContext.delete(r);
      else actionContext.set(r, parentId);
    }
  });
}
function withPurchase<T>(r: RunState, purchased: boolean, target: number | null, def: string, execute: () => T): T {
  return withFactBatch(r, () => purchased ? withAction(r, 'buy', target, def, execute) : execute());
}
function grow(r: RunState, o: Owned, atk: number, hp: number, source: number | null, label: string, effectId: string, fx: ShopFx[], phase: GrowthFact['phase'] = 'prep', parentId?: number, lineup: (Owned | null)[] = r.queue): [number, number] {
  return withFactBatch(r, () => {
    const flag = r.relics.includes('r_training') && card(o.def).tier <= 2;
    const a = Math.max(0, Math.min(atk + (flag && atk > 0 ? 1 : 0), STAT_CAP - ownedAtk(o)));
    const h = Math.max(0, Math.min(hp + (flag && hp > 0 ? 1 : 0), STAT_CAP - ownedHp(o)));
    if (!a && !h) return [0, 0];
    o.atkBonus += a; o.hpBonus += h;
    const fact: GrowthFact = { kind: 'growth', id: (growthSequence.get(r) ?? 0) + 1, parentId: parentId ?? actionContext.get(r), phase, source, effectId, label, target: o.oid, atk: a, hp: h };
    fx.push({ kind: 'buff', src: source, tgt: o.oid, atk: a, hp: h, label });
    emitFact(r, fact);
    if (h > 0) for (let i = 0; i < lineup.length; i++) {
      const listener = lineup[i];
      if (!listener || heldByOid(r, listener.oid) !== listener) continue;
      const ability = card(listener.def).abilities.find(x => x.effect === 'caretaker' && x.timing === 'permanent_health');
      if (!ability || lineup.slice(0, i).reverse().find(Boolean) !== o) continue;
      grow(r, o, ability.values?.[lvlOf(listener.copies) - 1] ?? 0, 0, listener.oid, '养护匠', ability.effect, fx, phase, fact.id, lineup);
    }
    return [a, h];
  });
}
function growFx(r: RunState, fx: ShopFx[], src: number | null, o: Owned | undefined, atk: number, hp: number, label: string, effectId: string) {
  if (o) grow(r, o, atk, hp, src, label, effectId, fx);
}
function onObtained(r: RunState, obtained: Owned, fx: ShopFx[]) {
  withAction(r, 'obtain', obtained.oid, obtained.def, () => {
    for (const listener of units(r)) {
      if (listener === obtained) continue;
      const ability = card(listener.def).abilities.find(x => x.effect === 'caravan' && x.timing === 'unit_obtained');
      if (ability) grow(r, listener, 0, ability.values?.[lvlOf(listener.copies) - 1] ?? 0, listener.oid, '行商护卫', ability.effect, fx);
    }
  });
}
/** 只在下一场有效的加成 */
function tmpFx(fx: ShopFx[], src: number | null, o: Owned | undefined, atk: number, hp: number, label: string) {
  if (!o || (!atk && !hp)) return;
  o.tmpAtk = (o.tmpAtk ?? 0) + atk;
  o.tmpHp = (o.tmpHp ?? 0) + hp;
  fx.push({ kind: 'buff', src, tgt: o.oid, atk, hp, label, tmp: true });
}

export function newRun(seed = (Math.random() * 2 ** 31) | 0, opts: { warm?: boolean; diff?: Diff; hero?: HeroId; lite?: boolean; solo?: boolean } = {}): RunState {
  const diff = opts.diff ?? 0;
  const r: RunState = {
    v: SAVE_VERSION, seed, worldSeed: seed, rewards: [], turn: 1, lives: DIFFS[diff].lives, wins: 0, gold: goldFor(1), queue: Array(QUEUE_MAX).fill(null), hand: Array(HAND_MAX).fill(null), tavern: 1, tavernCost: TAVERN_COST[2], shop: [], nextId: 1,
    phase: 'prep', history: [], canned: 0, rerolls: 0, tc: newCount(), finalLosses: 0, enemy: { boss: null, units: [] }, pendingFx: [],
    eco: [], lastForm: null, streak: 0, warm: !!opts.warm, adSave: 0, adRr: 0, lastLoss: 0, bag: [], oranges: [], noPurple: 0, chest: null,
    diff, relics: [], firstRelicGiven: false, relicDue: 0, relicPick: null, event: null, seenEv: [], chaos: 0, supplyVersion: SUPPLY_VERSION,
    map: [], act: 0, layer: 0, path: [], bosses: [], hero: opts.hero ?? 'vet', lite: !!opts.lite,
  };
  if (diff > 0) r.warm = false;
  r.eco = pickN(r, FORMS, 5);
  r.bosses = ACT_BOSSES.map((ks) => pick(r, ks));
  r.map = makeFixedMap(r, opts.solo);
  if (r.hero === 'summon') r.legion = 2;
  if (r.hero === 'guild') r.freeRr = 1;
  rollShop(r);
  grantPrepMilk(r);
  enterNode(r);
  return r;
}

/** 温度高：连败 ≥2、剩 ≤3 心、或局外偏暖 */
export const isWarm = (r: RunState) => (r.diff ?? 0) < 2 && (r.streak <= -2 || r.lives <= 3 || r.warm);

const foodPool = (r: RunState) => FOOD_POOL.filter((f) => f.tier <= tierOf(r));
/** 已解锁补给按单品权重抽取；默认每件等权。 */
function pickFood(r: RunState, minTier: Tier = 1) {
  const mt = tierOf(r);
  const floor = Math.min(mt, minTier);
  const pool = foodPool(r).filter((f) => f.tier >= floor);
  const w = pool.map((f) => f.rollWeight ?? 1);
  let t = rng(r) * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) if ((t -= w[i]) < 0) return pool[i];
  return pool[pool.length - 1];
}
/** 补给位：按 SPELL_RATE 出法术，否则出补给 */
function pickSupply(r: RunState): FoodDef {
  const spells = SPELL_POOL.filter((f) => f.tier <= tierOf(r));
  return spells.length && rng(r) < SPELL_RATE ? pick(r, spells) : pickFood(r);
}

// ── 发现 ──
const tagsOf = (d: CardDef) => [d.line, d.tag2].filter((t): t is (typeof LINES)[number] => !!t && t !== 'any' && t !== 'enemy');
/** 三张不同名；distinct：主标签互不相同；有队伍时至少一张与队伍同名或共享标签 */
function discOffer(r: RunState, pool: CardDef[], distinct = false): string[] {
  const own = units(r).map((o) => card(o.def));
  const aff = (c: CardDef) => own.some((d) => d.id === c.id || tagsOf(d).some((t) => hasTag(c, t)));
  const rest = [...pool];
  const opts: CardDef[] = [];
  while (opts.length < 3 && rest.length) {
    const c = rest.splice(Math.floor(rng(r) * rest.length), 1)[0];
    if (distinct && opts.some((o) => o.line === c.line) && rest.some((x) => !opts.some((o) => o.line === x.line))) continue;
    opts.push(c);
  }
  if (own.length && opts.length && !opts.some(aff)) {
    const rel = pool.filter((c) => aff(c) && !opts.includes(c));
    if (rel.length) opts[0] = pick(r, rel);
  }
  return opts.map((c) => c.id);
}
function pushDiscover(r: RunState, pool: CardDef[], src: string, price: number, o: { mode?: Discover['mode']; oid?: number; distinct?: boolean } = {}) {
  const opts = discOffer(r, pool, o.distinct);
  if (!opts.length) return;
  (r.discover ??= []).push({ opts, src, mode: o.mode ?? 'gain', price, oid: o.oid });
}
const tierPool = (t: number) => SHOP_POOL.filter((c) => c.tier === Math.min(6, t));
/** 同标签（只有通用标签时不限）的单位 */
const sameTag = (d: CardDef, pool: CardDef[]) => { const ts = tagsOf(d); return ts.length ? pool.filter((c) => ts.some((t) => hasTag(c, t))) : pool; };
/** 转生的候选：同标签、高一阶 */
export const rebornPool = (o: Owned) => { const d = card(o.def); return d.tier >= 6 ? [] : sameTag(d, tierPool(d.tier + 1)); };
/** 选定发现的第 i 张；返回放上货架的 sid 或被替换的 oid */
export function pickDiscover(r: RunState, i: number): { def: string; sid?: number; oid?: number; hand?: number; missing?: boolean } | null {
  const d = r.discover?.[0];
  const id = d?.opts[i];
  if (!d || !id) return null;
  return withFactBatch(r, () => {
    r.discover!.shift();
    if (d.mode === 'spell') {
      for (let n = 0; n < (d.count ?? 1); n++) {
        const spell: HeldSpell = { kind: 'spell', oid: r.nextId++, def: id, val: d.val, source: d.src, obtainedTurn: r.turn };
        enqueueCard(r, spell, d.src);
      }
      return { def: id };
    }
    if (d.mode === 'morph') {
      const handIndex = d.oid == null ? -1 : r.hand.findIndex(o => o && !isHeldSpell(o) && o.oid === d.oid);
      const o = d.oid == null ? undefined : byOid(r, d.oid) ?? (handIndex >= 0 ? cellAt(r, HAND_BASE + handIndex) : null);
      if (!o) return { def: id, missing: true };
      o.def = id;
      if (!card(id).inherit) o.foodHistory = undefined;
      return { def: id, oid: o.oid, hand: handIndex >= 0 ? HAND_BASE + handIndex : undefined };
    }
    if (d.price === 0) {
      const o: Owned = { oid: r.nextId++, def: id, copies: 1, atkBonus: 0, hpBonus: 0, fresh: true };
      const hi = enqueueCard(r, o, d.src);
      for (let n = 1; n < (d.count ?? 1); n++) enqueueCard(r, { ...o, oid: r.nextId++ }, d.src);
      return { def: id, oid: o.oid, hand: hi };
    }
    // Paid discoveries remain on the shop shelf.
    const hi = d.price === 0 ? r.hand.slice(0, handCap(r)).findIndex((o) => !o) : -1;
    if (hi >= 0) {
      const o: Owned = { oid: r.nextId++, def: id, copies: 1, atkBonus: 0, hpBonus: 0, fresh: true };
      r.hand[hi] = o;
      return { def: id, oid: o.oid, hand: HAND_BASE + hi };
    }
    const sid = r.nextId++;
    r.shop.push({ sid, kind: 'unit', def: id, locked: false, free: true, disc: true, price: d.price });
    return { def: id, sid };
  });
}
export const itemPrice = (s: ShopItem) => s.price ?? PRICE;

function rollShop(r: RunState) {
  const tier = tierOf(r);
  const pool = SHOP_POOL.filter((c) => c.tier <= tier);
  const kept = r.shop.filter((s) => s.locked);
  const out: ShopItem[] = [];
  const keptU = kept.filter((s) => s.kind === 'unit' && !s.free);
  // 锁住的升星奖励卡和普通卡一样占刷新席位
  const keptB = kept.filter((s) => s.kind === 'unit' && s.free);
  // 白送的发现卡本回合刷新不会刷走，也不占刷新席位
  const gifts = r.shop.filter((s) => s.kind === 'unit' && s.price === 0 && !s.locked);
  out.push(...keptU);
  // 招募同温：温度高时最多 2 格偏向同标签 / 已有同名（只加权不保底）
  const own = units(r).map((o) => card(o.def));
  const tags = new Set(own.flatMap((d) => [d.line, d.tag2]).filter((t) => t && t !== 'any'));
  const near = (c: CardDef) => own.some((d) => d.id === c.id) || [...tags].some((t) => hasTag(c, t as (typeof LINES)[number]));
  let warmLeft = isWarm(r) && own.length ? 2 : 0;
  for (let i = keptU.length + keptB.length; i < unitSlots(r.tavern); i++) {
    let c = pick(r, pool);
    if (warmLeft > 0) {
      warmLeft--;
      const w = pool.map((x) => (near(x) ? 2 : 1));
      let t = rng(r) * w.reduce((a, b) => a + b, 0);
      c = pool.find((_, j) => (t -= w[j]) < 0) ?? c;
    }
    out.push({ sid: r.nextId++, kind: 'unit', def: c.id, locked: false, free: false });
  }
  // 只检查本次新刷的单位：锁定卡（含升星奖励）不能替本次刷新消耗保底。
  // 每个队员按同名或非通用主/副标签贡献一次权重，混搭不强制绑定单一流派。
  const affinity = (c: CardDef) => own.filter((d) => d.id === c.id ||
    [d.line, d.tag2].some((t) => t && t !== 'any' && t !== 'enemy' && hasTag(c, t))).length;
  const fresh = out.filter((s) => !s.locked);
  if (own.length && fresh.length && !fresh.some((s) => affinity(card(s.def)) > 0)) {
    const related = pool.map((c) => ({ c, weight: affinity(c) })).filter((x) => x.weight > 0);
    if (related.length) {
      let roll = rng(r) * related.reduce((sum, x) => sum + x.weight, 0);
      const chosen = related.find((x) => (roll -= x.weight) < 0) ?? related[related.length - 1];
      // 原抽样已有关联卡时不干预；没有时只替换一个新位置，不改变货架容量。
      pick(r, fresh).def = chosen.c.id;
    }
  }
  out.push(...keptB, ...gifts);
  const milk = r.shop.filter((s) => s.kind === 'food' && s.def === 'f_milk');
  const keptF = r.shop.filter((s) => s.kind === 'food' && s.def !== 'f_milk' && (s.locked || s.free));
  out.push(...keptF);
  for (let i = keptF.filter((s) => !s.free).length; i < foodSlots(r.tavern) && out.filter((s) => s.kind === 'food').length + milk.length < FOOD_SHOP_MAX; i++) out.push({ sid: r.nextId++, kind: 'food', def: pickSupply(r).id, locked: false, free: false });
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
  if (r.endTurnCommitted) return null;
  if ((r.freeRr ?? 0) > 0) r.freeRr! -= 1;
  else if (r.gold < REROLL) return null;
  else r.gold -= REROLL;
  r.rerolls++;
  rollShop(r);
  return [];
}

/** 广告刷新：每回合 1 次，免费 */
export function adReroll(r: RunState): ShopFx[] | null {
  if (r.endTurnCommitted) return null;
  if (r.adRr === r.turn) return null;
  r.adRr = r.turn;
  rollShop(r);
  return [];
}

export function toggleLock(r: RunState, sid: number) {
  const s = r.shop.find((x) => x.sid === sid);
  if (s && s.def !== 'f_milk') s.locked = !s.locked;
}

export type BuyResult = { ok: false; why: 'gold' | 'full' | 'max' | 'ability' | 'ended' } | { ok: true; merged: boolean; levelUp: boolean; fx: ShopFx[] };

/** 买单位到指定格：空格放下；同名合并；不同名的单位格拒绝 */
/** pt：入场效果指定的目标 oid（不给则身前友军，没有则身后） */
export function buy(r: RunState, sid: number, slot: number, pt?: number, replacePlayAbility = false): BuyResult {
  if (r.endTurnCommitted) return { ok: false, why: 'ended' };
  const item = r.shop.find((x) => x.sid === sid);
  if (!item || item.kind !== 'unit') return { ok: false, why: 'full' };
  const cost = itemPrice(item);
  if (r.gold < cost) return { ok: false, why: 'gold' };
  const at = cellAt(r, slot);
  if (slot < 0 || slot >= CELLS || (isHand(slot) && (slot - HAND_BASE >= handCap(r) || isHeldSpell(handAt(r, slot))))) return { ok: false, why: 'full' };
  if (at && (at.def !== item.def || at.merc)) return { ok: false, why: 'full' };
  if (at && at.copies >= MAX_COPIES) return { ok: false, why: 'max' };
  if (!isHand(slot) && (!at || at.copies + 1 >= MAX_COPIES) && inspectPlayConflict(r, item.def, slot, pt, at ? MAX_COPIES : 1) && !replacePlayAbility) return { ok: false, why: 'ability' };
  r.gold -= cost;
  r.shop = r.shop.filter((x) => x !== item);
  if (cost > 0) r.tc.bought++;
  const fx: ShopFx[] = [];
  if (!at) {
    const o: Owned = { oid: r.nextId++, def: item.def, copies: 1, atkBonus: 0, hpBonus: 0 };
    setCell(r, slot, o);
    return withPurchase(r, cost > 0, o.oid, o.def, () => {
      if (r.canned && cost > 0) growFx(r, fx, null, o, r.canned, r.canned, '罐头', 'f_can');
      if (cost > 0) onBought(r, o, fx);
      onObtained(r, o, fx);
      // 进手牌的先不算召唤，第一次上场时再算
      if (isHand(slot)) o.fresh = true;
      else { o.fresh = true; onSummoned(r, o, fx, pt, replacePlayAbility); }
      if (cost > 0) buyDiscover(r, o);
      return { ok: true, merged: false, levelUp: false, fx };
    });
  }
  return withPurchase(r, cost > 0, at.oid, at.def, () => {
    if (r.canned && cost > 0) growFx(r, fx, null, at, r.canned, r.canned, '罐头', 'f_can');
    const levelUp = addCopies(r, at, 1, fx, replacePlayAbility, pt);
    if (cost > 0) onBought(r, at, fx);
    onObtained(r, at, fx);
    if (cost > 0) buyDiscover(r, at);
    return { ok: true, merged: true, levelUp, fx };
  });
}

function buyDiscover(r: RunState, o: Owned) {
  const d = card(o.def);
  if (d.disc === 'buy') pushDiscover(r, tierPool(tierOf(r)), d.name, PRICE);
}

/** 购买钩子：场上单位对「买入」的反应（买进手牌也算） */
function onBought(r: RunState, o: Owned, fx: ShopFx[]) {
  for (const t of units(r).filter((x) => x !== o)) {
    switch (hasAbility(t, 'buy', 'dragon') ? 'dragon' : undefined) {
      case 'dragon':
        if (card(o.def).tier === 1) for (const x of units(r)) growFx(r, fx, t.oid, x, vOf(t), vOf(t), '买入 1 阶', 'dragon');
        break;
    }
  }
}
/** 新单位上场算一次「召唤」（直接买上场，或手牌里的第一次上场），并结算入场 */
function onSummoned(r: RunState, o: Owned, fx: ShopFx[], pt?: number, replacePlayAbility = false) {
  const firstEntry = !!o.fresh;
  o.fresh = undefined;
  o.pendingGoldPlay = undefined;
  onPlay(r, o, fx, pt, replacePlayAbility);
  if (!firstEntry) return;
  for (const t of units(r).filter((x) => x !== o)) {
    switch (abOf(t)) {
      case 'horse': tmpFx(fx, t.oid, o, vOf(t), vOf(t), '友军被召唤'); break;
      case 'dog': growFx(r, fx, t.oid, t, vOf(t), vOf(t), '友军被召唤', 'dog'); break;
      case 'turkey': tmpFx(fx, t.oid, o, vOf(t), vOf(t), '友军被召唤'); break;
    }
  }
}

/** 入场目标：指定的友军，否则身前友军，没有则身后 */
export function playTarget(r: Pick<RunState, 'queue'>, o: Owned, pt?: number): Owned | undefined {
  const q = r.queue;
  const at = q.indexOf(o);
  if (at < 0) return undefined;
  const given = pt != null ? q.find((x) => x && x !== o && x.oid === pt) : undefined;
  return given ?? q.slice(0, at).reverse().find((x): x is Owned => !!x) ?? q.slice(at + 1).find((x): x is Owned => !!x);
}
/** Preview a deploy/merge before committing its cost or position. pt is a target oid. */
export function inspectPlayConflict(r: RunState, def: string, slot: number, pt?: number, copies = 1, from?: number): { target: Owned; incoming: GrantedAbility } | null {
  if (slot < 0 || slot >= QUEUE_MAX || card(def)?.pl !== 'p_ignite') return null;
  const queue = [...r.queue];
  if (from !== undefined && from < QUEUE_MAX) queue[from] = null;
  const actor: Owned = { oid: -1, def, copies, atkBonus: 0, hpBonus: 0 };
  queue[slot] = actor;
  const target = playTarget({queue}, actor, pt);
  if (!target?.granted) return null;
  const incoming: GrantedAbility = { id: 'blood', duration: 'battle', value: card(def).pv?.[lvlOf(copies) - 1] ?? 0, source: card(def).name };
  return target.granted.id !== incoming.id || target.granted.duration !== incoming.duration ? { target, incoming } : null;
}
const tacticalPool = (r: RunState) => ['f_bread', 'f_drum', 'f_whet', 'x_bonepact', 'x_ignite', 'x_inscribe'].filter(id => FOOD[id] && FOOD[id].tier <= tierOf(r));
/** 入场：上场时结算一次；霜冠执政官让它额外触发（同类取最高） */
function onPlay(r: RunState, o: Owned, fx: ShopFx[], pt?: number, replacePlayAbility = false, onBattleGrant?: (o: Owned) => void) {
  const d = card(o.def);
  if (!d.pl || !r.queue.includes(o)) return;
  const p = d.pv?.[lvlOf(o.copies) - 1] ?? 0;
  const tgt = playTarget(r, o, pt);
  const extra = units(r).reduce((m, x) => (x !== o && adefOf(x).key === 'play' ? Math.max(m, vOf(x)) : m), 0);
  for (let k = 0; k <= extra; k++) {
    const label = k ? '额外触发' : '入场';
    switch (d.pl) {
      case 'p_spell': {
        const pool = tacticalPool(r);
        const opts = pickN(r, pool, 3);
        if (opts.length) (r.discover ??= []).push({ opts, src: d.name, mode: 'spell', price: 0, count: p });
        break;
      }
      case 'p_bone': enqueueCard(r, { kind: 'spell', oid: r.nextId++, def: 'x_bonepact', val: [p, p], source: d.name, obtainedTurn: r.turn }, d.name); break;
      case 'p_ignite': if (tgt && (!tgt.granted || (tgt.granted.id === 'blood' && tgt.granted.duration === 'battle' && tgt.granted.value < p) || (replacePlayAbility && (tgt.granted.id !== 'blood' || tgt.granted.duration !== 'battle')))) { tgt.granted = { id: 'blood', duration: 'battle', value: p, source: d.name }; onBattleGrant?.(tgt); } break;
      case 'p_hp': growFx(r, fx, o.oid, tgt, 0, p, label, d.pl); break;
      case 'p_atk': growFx(r, fx, o.oid, tgt, p, 0, label, d.pl); break;
      case 'p_both': growFx(r, fx, o.oid, tgt, p, p, label, d.pl); break;
      case 'p_all': for (const x of units(r)) if (x !== o) growFx(r, fx, o.oid, x, p, p, label, d.pl); break;
      case 'p_feed':
        // 喂面包算真的吃补给：触发吃补给技能、计入本回合补给次数，但不进传承记录
        if (tgt) for (let i = 0; i < p; i++) { eatFood(r, tgt, { id: 'f_bread', atk: 1, hp: 1, sourceId: -1 }, fx); r.tc.foods++; }
        break;
    }
  }
}

function addCopies(r: RunState, o: Owned, n: number, fx: ShopFx[], replacePlayAbility = false, pt?: number): boolean {
  const before = lvlOf(o.copies);
  o.copies = Math.min(MAX_COPIES, o.copies + n);
  const levelUp = lvlOf(o.copies) > before;
  if (levelUp) {
    grantStarReward(r, o);
    // 变金色：入场按金色数值再结算一次（还没上过场的等上场时一起算）
    if (r.queue.includes(o)) onPlay(r, o, fx, pt, replacePlayAbility);
    else o.pendingGoldPlay = true;
  }
  return levelUp;
}

/** 买到第一个合适的 cell：优先合并同名（场上、手牌），否则场上空格，再否则手牌空格 */
export function autoSlot(r: RunState, def: string): number {
  for (let i = 0; i < CELLS; i++) {
    const o = cellAt(r, i);
    if (o?.def === def && o.copies < MAX_COPIES && !o.merc) return i;
  }
  const q = r.queue.findIndex((o) => !o);
  if (q >= 0) return q;
  const h = r.hand.slice(0, handCap(r)).findIndex((o) => !o);
  return h >= 0 ? HAND_BASE + h : -1;
}

/** 三连奖励：从酒馆等级 +1 发现一张，白送（进手牌） */
function grantStarReward(r: RunState, o: Owned) {
  pushDiscover(r, tierPool(tierOf(r) + 1), `金色${card(o.def).name}`, 0);
}

/** 升级酒馆 */
export function upgradeTavern(r: RunState): boolean {
  if (r.endTurnCommitted) return false;
  const cost = tavernPrice(r);
  if (r.tavern >= TAVERN_MAX || r.gold < cost) return false;
  r.gold -= cost;
  r.tavern++;
  r.tavernCost = TAVERN_COST[r.tavern + 1] ?? 0;
  if (r.relics.includes('r_quick') && r.quickUsed !== r.turn) {
    r.quickUsed = r.turn;
    r.freeRr = (r.freeRr ?? 0) + 1;
  }
  return true;
}

/** 补给是否需要指定目标 */
export const foodNeedsTarget = (id: string) => (FOOD[id].spell ? !!FOOD[id].target : !FOOD[id].n && id !== 'f_can');
export const foodAll = (id: string) => FOOD[id]?.n === ALL;
export const foodPrice = (s: ShopItem) => (s.def === 'f_milk' || (s.kind === 'food' && s.free) ? 0 : FOOD[s.def]?.price ?? PRICE);
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
/** 统一食用结算；返回补给本体是否实际生效，食用监听不计作余温石的命中。 */
function eatFood(r: RunState, e: Owned, item: FoodMemory, fx: ShopFx[]): boolean {
  return withAction(r, 'eat', e.oid, item.id, () => {
    const f = FOOD[item.id];
    const mul = abOf(e) === 'cat' ? uOf(e) : 1;
    const a = item.atk * mul;
    const h = item.hp * mul;
    let applied = false;
    if (f.tmp) {
      const before = equipStats(e.ench, ownedAtk(e) + (e.tmpAtk ?? 0), ownedHp(e) + (e.tmpHp ?? 0));
      tmpFx(fx, null, e, a, h, f.name);
      const after = equipStats(e.ench, ownedAtk(e) + (e.tmpAtk ?? 0), ownedHp(e) + (e.tmpHp ?? 0));
      applied = after.some((n, i) => n > before[i]);
    } else growFx(r, fx, null, e, a, h, f.name, f.id);
    if (f.fx && !e.tfx?.includes(f.fx)) { e.tfx = [...(e.tfx ?? []), f.fx]; applied = true; }
    if (f.id === 'f_lamp' && !e.lamp) { e.lamp = true; applied = true; }
    const v = vOf(e);
    const slot = r.queue.indexOf(e);
    switch (adefOf(e).abilities.find(a => a.role === 'event' && a.timing === 'food')?.effect) {
      case 'ladybug':
      case 'worm': growFx(r, fx, e.oid, e, v, v, '吃补给', abOf(e)!); break;
      case 'seal':
        {
          const adjacent = [slot - 1, slot + 1].map((j) => r.queue[j]).filter((o): o is Owned => !!o);
          const used = r.tc.keeper?.[e.oid] ?? 0;
          if (adjacent.length && used < uOf(e)) {
            (r.tc.keeper ??= {})[e.oid] = used + 1;
            for (const o of adjacent) growFx(r, fx, e.oid, o, v, v, '吃补给', abOf(e)!);
          }
        }
        break;
      case 'tabby': for (const t of units(r)) tmpFx(fx, e.oid, t, v, 0, '吃补给'); break;
    }
    for (const t of units(r)) {
      if (t === e) continue;
      if (hasAbility(t, 'ally_food', 'rabbit')) growFx(r, fx, t.oid, e, 0, vOf(t), '友军吃补给', abOf(t)!);
      if (hasAbility(t, 'ally_food', 'wyvern') && (a || h)) {
        const half = (x: number) => (x ? Math.max(1, Math.floor(x / 2)) : 0);
        const at = r.queue.indexOf(t);
        const targets = [r.queue[at - 1], r.queue[at + 1]].filter((x): x is Owned => !!x && x !== e).slice(0, vOf(t));
        for (const x of targets) {
          // 这只是属性分发，不广播食用事件，也不记录补给。
          if (f.tmp) tmpFx(fx, t.oid, x, half(a), half(h), '友军吃补给');
          else growFx(r, fx, t.oid, x, half(a), half(h), '友军吃补给', abOf(t)!);
        }
      }
    }
    return applied;
  });
}

function supplyRefund(r: RunState, price: number, fx: ShopFx[]) {
  if (price > 0 && (r.tc.bearRefunds ?? 0) < 2) {
    // 队列从前到后扫描；只在星级严格更高时替换，故同星由前位提供返金。
    const bear = units(r).reduce<Owned | null>((best, o) =>
      hasAbility(o, 'buy', 'sauropod') && (!best || vOf(o) > vOf(best)) ? o : best, null);
    if (bear) {
      const refund = Math.min(price, vOf(bear));
      r.gold += refund;
      r.tc.bearRefunds = (r.tc.bearRefunds ?? 0) + 1;
      fx.push({ kind: 'gold', src: bear.oid, n: refund, label: '巨熊返金' });
    }
  }
}
function useFoodImpl(r: RunState, sid: number, slot: number | null, replaceAbility = false, sourceSlot?: number, purchased = true): FoodResult {
  const item = r.shop.find((x) => x.sid === sid);
  if (!item || item.kind !== 'food') return { ok: false, why: 'target' };
  const f = FOOD[item.def];
  const tgt = slot === null ? null : cellAt(r, slot);
  if (f.spell) return castSpell(r, item, f, slot, replaceAbility, sourceSlot, purchased);
  if (foodNeedsTarget(f.id) && !tgt) return { ok: false, why: 'target' };
  if (!foodNeedsTarget(f.id) && !units(r).length && f.id !== 'f_can') return { ok: false, why: 'target' };
  const price = foodPrice(item);
  if (r.gold < price) return { ok: false, why: 'gold' };
  return withPurchase(r, purchased && price > 0, tgt?.oid ?? null, f.id, () => withAction(r, 'cast', tgt?.oid ?? null, f.id, () => {
    r.gold -= price;
    r.shop = r.shop.filter((x) => x !== item);
    const fx: ShopFx[] = [];
    supplyRefund(r, price, fx);
    const firstSpell = !r.tc.spellUsed;
    r.tc.spellUsed = true;
    const repeatFood = firstSpell ? units(r).reduce((m, o) => hasAbility(o, 'spell', 'spellEcho') ? Math.max(m, vOf(o)) : m, 0) : 0;
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
    const emberTargets = new Set<Owned>();
    for (let iteration = 0; iteration <= repeatFood; iteration++) {
      if (f.id === 'f_can') r.canned += 1;
      for (const e of eaters) {
        const memory: FoodMemory = { id: f.id, atk: fa, hp: fh, sourceId: item.sid };
        const applied = eatFood(r, e, memory, fx);
        if (f.tmp && applied) emberTargets.add(e);
        if (e === tgt && !f.tmp && !f.n && !f.behind && !f.around) rememberFood(e, memory);
      }
    }
    if (r.relics.includes('r_ember')) for (const e of emberTargets) if (cellExists(r, e)) growFx(r, fx, null, e, 1, 1, '余温石', 'r_ember');
    r.tc.foods += eaters.length * (repeatFood + 1);
    spellObservers(r, fx);
    return { ok: true, fx, levelUp: false };
  }));
}

export function nativeTimings(d: CardDef): NativeTiming[] {
  return [...new Set(d.abilities.filter(a => a.role === 'event').map(a => a.timing))];
}
export function searchPool(r: RunState, o: Owned): CardDef[] {
  const d = card(o.def), timings = nativeTimings(d);
  return SHOP_POOL.filter(c => c.id !== d.id && c.tier <= tierOf(r) && nativeTimings(c).some(t => timings.includes(t)));
}

/** 法术目标是否合法（UI 拖放提示也用） */
export function spellTargetOk(r: RunState, id: string, o: Owned | null | undefined): boolean {
  const f = FOOD[id];
  if (!f.target) return f.spell === 'siphon' ? r.lives > 1 : units(r).length > 0 || f.spell === 'bank' || f.spell === 'coin' || f.spell === 'ready' || f.spell === 'omen' || f.spell === 'draft';
  if (!o || o.merc) return false;
  if (f.spell === 'copy') return o.copies < MAX_COPIES;
  if (f.spell === 'crown') return card(o.def).tier <= 4 && !isGold(o);
  if (f.spell === 'temper') return !!o.granted && o.granted.duration === 'permanent' && o.granted.id !== 'blood' && !o.granted.tempered;
  if (f.spell === 'reborn') return rebornPool(o).length > 0;
  if (f.spell === 'search') return searchPool(r, o).length > 0;
  return true;
}
const cellExists = (r: RunState, o: Owned) => r.queue.includes(o) || r.hand.includes(o);
const dismissGold = (tier: number) => (tier <= 2 ? 2 : tier <= 4 ? 3 : 4);
function castSpell(r: RunState, item: ShopItem, f: FoodDef, slot: number | null, replaceAbility = false, sourceSlot?: number, purchased = true): FoodResult {
  const tgt = slot === null ? null : cellAt(r, slot);
  const source = sourceSlot === undefined ? null : cellAt(r, sourceSlot);
  if ((f.spell === 'echo' || f.spell === 'ignite') && (!tgt || !r.queue.includes(tgt))) return { ok: false, why: 'target' };
  if (f.spell === 'echo' && !card(tgt!.def).pl) return { ok: false, why: 'target' };
  if (f.spell === 'echo' && inspectPlayConflict(r, tgt!.def, r.queue.indexOf(tgt!), undefined, tgt!.copies) && !replaceAbility) return { ok: false, why: 'target' };
  const prospectiveRepeats = !r.tc.spellUsed ? units(r).reduce((m, o) => hasAbility(o, 'spell', 'spellEcho') ? Math.max(m, vOf(o)) : m, 0) : 0;
  if ((f.spell === 'crown' || f.spell === 'copy' && tgt && tgt.copies + 1 + prospectiveRepeats >= MAX_COPIES) && tgt && r.queue.includes(tgt) && inspectPlayConflict(r, tgt.def, r.queue.indexOf(tgt), undefined, MAX_COPIES) && !replaceAbility) return { ok: false, why: 'target' };
  if (f.spell === 'siphon' && r.lives <= 1) return { ok: false, why: 'target' };
  if (f.spell === 'transfer' && (!source?.granted || !tgt || source === tgt)) return { ok: false, why: 'target' };
  let incoming: GrantedAbility | undefined;
  if (f.spell === 'bonepact') incoming = { id: 'bone', duration: 'permanent', value: item.val?.[0] ?? 2, source: f.name };
  else if (f.spell === 'ignite') incoming = { id: 'blood', duration: 'battle', value: 0, source: f.name };
  else if (f.spell === 'inscribe') incoming = { id: 'spark', duration: 'permanent', value: 2, source: f.name };
  else if (f.spell === 'thorn' || f.spell === 'sprout') incoming = { id: f.spell, duration: 'permanent', value: f.spell === 'thorn' ? 2 : 1, source: f.name };
  else if (f.spell === 'transfer') incoming = source?.granted;
  if (tgt?.granted && incoming) {
    const same = tgt.granted.id === incoming.id && tgt.granted.duration === incoming.duration;
    if (same && tgt.granted.value >= incoming.value) return { ok: false, why: 'target' };
    if (!same && !replaceAbility) return { ok: false, why: 'target' };
  }
  if (!spellTargetOk(r, f.id, tgt)) return { ok: false, why: 'target' };
  const price = foodPrice(item);
  if (r.gold < price) return { ok: false, why: 'gold' };
  return withPurchase(r, purchased && price > 0, tgt?.oid ?? null, f.id, () => withAction(r, 'cast', tgt?.oid ?? null, f.id, () => {
    r.gold -= price;
    r.shop = r.shop.filter((x) => x !== item);
    const fx: ShopFx[] = [];
    supplyRefund(r, price, fx);
    let levelUp = false;
    const mt = tierOf(r);
    const first = !r.tc.spellUsed;
    r.tc.spellUsed = true;
    const repeats = first ? units(r).reduce((m, o) => hasAbility(o, 'spell', 'spellEcho') ? Math.max(m, vOf(o)) : m, 0) : 0;
    const battleGrants = new Set<Owned>();
    for (let iteration = 0; iteration <= repeats; iteration++) switch (f.spell) {
      case 'echo': onPlay(r, tgt!, fx, undefined, replaceAbility, o => battleGrants.add(o)); break;
      case 'bonepact': tgt!.granted = { id: 'bone', duration: 'permanent', value: item.val?.[0] ?? 2, source: item.source ?? f.name }; break;
      case 'ignite': if (!tgt!.granted || tgt!.granted.id !== 'blood' || tgt!.granted.duration !== 'battle' || tgt!.granted.value < 0) { tgt!.granted = { id: 'blood', duration: 'battle', value: 0, source: f.name }; battleGrants.add(tgt!); } break;
      case 'inscribe': tgt!.granted = { id: 'spark', duration: 'permanent', value: 2, source: f.name }; break;
      case 'thorn': case 'sprout': if (!tgt!.granted || tgt!.granted.id !== f.spell || tgt!.granted.duration !== 'permanent' || tgt!.granted.value < (f.spell === 'thorn' ? 2 : 1)) tgt!.granted = { id: f.spell, duration: 'permanent', value: f.spell === 'thorn' ? 2 : 1, source: f.name }; break;
      case 'temper': if (tgt!.granted && !tgt!.granted.tempered) { tgt!.granted.value *= 2; tgt!.granted.tempered = true; } break;
      case 'crown': if (!isGold(tgt!)) levelUp = addCopies(r, tgt!, MAX_COPIES - tgt!.copies, fx, replaceAbility) || levelUp; break;
      case 'siphon': if (r.lives > 1) { r.lives--; r.gold += 3; } break;
      case 'transfer': if (source?.granted) { tgt!.granted = source.granted; source.granted = undefined; if (tgt!.granted.duration === 'battle') battleGrants.add(tgt!); } break;
      case 'search': pushDiscover(r, searchPool(r, tgt!), f.name, 0); break;
      case 'recruit': pushDiscover(r, sameTag(card(tgt!.def), SHOP_POOL.filter((c) => c.tier <= mt)), f.name, 0); break;
      case 'bank': r.bankGold = (r.bankGold ?? 0) + 5; break;
      case 'draft': pushDiscover(r, tierPool(mt), f.name, 0, { distinct: true }); break;
      case 'copy': levelUp = addCopies(r, tgt!, 1, fx, replaceAbility); break;
      case 'reborn': pushDiscover(r, rebornPool(tgt!), f.name, 0, { mode: 'morph', oid: tgt!.oid }); break;
      case 'omen': r.omen = true; break;
      case 'dismiss': {
        if (!tgt || slot === null || cellAt(r, slot) !== tgt) break;
        const tier = card(tgt!.def).tier;
        const out = sell(r, slot!);
        if (out) { fx.push(...out.fx); r.gold += dismissGold(tier) + (r.relics.includes('r_pouch') ? 1 : 0) - out.gold; }
        pushDiscover(r, tierPool(tier), f.name, 0);
        break;
      }
      case 'ready': r.freeRr = (r.freeRr ?? 0) + 2; break;
      case 'coin': r.gold += 2; break;
    }
    if (r.relics.includes('r_ember')) for (const o of battleGrants) if (cellExists(r, o)) growFx(r, fx, null, o, 1, 1, '余温石', 'r_ember');
    spellObservers(r, fx);
    return { ok: true, fx, levelUp };
  }));
}


function spellObservers(r: RunState, fx: ShopFx[]) {
  for (const o of units(r)) {
    const at = r.queue.indexOf(o);
    if (hasAbility(o, 'spell', 'spellgrow')) growFx(r, fx, o.oid, r.queue.slice(0, at).reverse().find((x): x is Owned => !!x), vOf(o), vOf(o), '施法', 'spellgrow');
    if (hasAbility(o, 'spell', 'abilitygrow')) { const ts = units(r); if (ts.length) { const t = pick(r, ts); t.startBlock = (t.startBlock ?? 0) + vOf(o); } }
  }
}
function enqueueCard(r: RunState, card: HandCard, source: string): number | undefined {
  const hi = r.hand.slice(0, handCap(r)).findIndex(x => !x);
  if (hi >= 0) {
    r.hand[hi] = card;
    if (!isHeldSpell(card)) onObtained(r, card, []);
    return HAND_BASE + hi;
  }
  (r.rewards ??= []).push({ id: r.nextId++, card, source });
  if (!isHeldSpell(card)) onObtained(r, card, []);
  return undefined;
}
export function claimReward(r: RunState, id: number, handCell?: number): boolean {
  const i = (r.rewards ?? []).findIndex(x => x.id === id);
  if (i < 0) return false;
  const h = handCell === undefined ? r.hand.slice(0, handCap(r)).findIndex(x => !x) : handCell - HAND_BASE;
  if (h < 0 || h >= handCap(r) || r.hand[h]) return false;
  r.hand[h] = r.rewards![i].card;
  r.rewards!.splice(i, 1);
  return true;
}
export function discardReward(r: RunState, id: number): boolean {
  const i = (r.rewards ?? []).findIndex(x => x.id === id);
  if (i < 0) return false;
  r.rewards!.splice(i, 1);
  return true;
}
/** Drop a hand unit without sale triggers or proceeds, including while resolving end-turn rewards. */
export function discardHandUnit(r: RunState, cell: number): boolean {
  const o = handAt(r, cell);
  if (!o || isHeldSpell(o)) return false;
  if (o.ench && r.bag.length >= BAG_MAX) return false;
  if (o.ench) r.bag.push(o.ench);
  r.hand[cell - HAND_BASE] = null;
  return true;
}
export function discardHandCard(r: RunState, cell: number): boolean {
  return isHeldSpell(handAt(r, cell)) ? discardHandSpell(r, cell) : discardHandUnit(r, cell);
}
export function discardHandSpell(r: RunState, cell: number): boolean {
  if (!isHeldSpell(handAt(r, cell))) return false;
  r.hand[cell - HAND_BASE] = null;
  return true;
}
export function buyToHand(r: RunState, sid: number, cell?: number): BuyResult {
  if (r.endTurnCommitted) return { ok: false, why: 'ended' };
  const item = r.shop.find(x => x.sid === sid);
  if (!item) return { ok: false, why: 'full' };
  const h = cell === undefined ? r.hand.slice(0, handCap(r)).findIndex(x => !x) : cell - HAND_BASE;
  if (h < 0 || h >= handCap(r) || r.hand[h]) return { ok: false, why: 'full' };
  if (item.kind === 'unit') return buy(r, sid, HAND_BASE + h);
  const cost = foodPrice(item);
  if (r.gold < cost) return { ok: false, why: 'gold' };
  return withPurchase(r, cost > 0, null, item.def, () => {
    r.gold -= cost;
    r.shop = r.shop.filter(x => x !== item);
    r.hand[h] = { kind: 'spell', oid: r.nextId++, def: item.def, val: item.val, source: '酒馆', obtainedTurn: r.turn, expiresTurn: item.def === 'f_milk' ? r.turn : undefined };
    const fx: ShopFx[] = [];
    supplyRefund(r, cost, fx);
    return { ok: true, merged: false, levelUp: false, fx };
  });
}
function beginFactTransaction(r: RunState, c: RunState): RunFact[] {
  const facts: RunFact[] = [];
  growthSequence.set(c, growthSequence.get(r) ?? 0);
  observeFacts(c, fact => facts.push(fact));
  return facts;
}
function commit(r: RunState, c: RunState, facts: RunFact[]) {
  Object.assign(r, c);
  for (const fact of facts) emitFact(r, fact);
}
export function useFood(r: RunState, sid: number, slot: number | null, replaceAbility = false, sourceSlot?: number): FoodResult {
  if (r.endTurnCommitted) return { ok: false, why: 'target' };
  const c = structuredClone(r);
  const facts = beginFactTransaction(r, c);
  const out = useFoodImpl(c, sid, slot, replaceAbility, sourceSlot);
  if (out.ok) commit(r, c, facts);
  return out;
}
export function castHandSpell(r: RunState, cell: number, target: number | null, replaceAbility = false, sourceSlot?: number): FoodResult {
  if (r.endTurnCommitted) return { ok: false, why: 'target' };
  const c = structuredClone(r);
  const held = handAt(c, cell);
  if (!isHeldSpell(held) || (held.expiresTurn !== undefined && held.expiresTurn < r.turn)) return { ok: false, why: 'target' };
  c.hand[cell - HAND_BASE] = null;
  const sid = c.nextId++;
  c.shop.push({ sid, kind: 'food', def: held.def, val: held.val, source: held.source, locked: false, free: true });
  const facts = beginFactTransaction(r, c);
  const out = useFoodImpl(c, sid, target, replaceAbility, sourceSlot, false);
  if (out.ok) commit(r, c, facts);
  return out;
}

/** 场上两格互换，或同名合并（拖动） */
type MoveResult = { merged: boolean; levelUp: boolean; fx: ShopFx[] } | null;
export function moveOwned(r: RunState, from: number, to: number, pt?: number, keepAbility?: 'source' | 'target', replacePlayAbility = false): MoveResult {
  return withFactBatch(r, () => moveOwnedImpl(r, from, to, pt, keepAbility, replacePlayAbility));
}
function moveOwnedImpl(r: RunState, from: number, to: number, pt?: number, keepAbility?: 'source' | 'target', replacePlayAbility = false): MoveResult {
  if (r.endTurnCommitted) return null;
  if (from < 0 || to < 0 || from >= CELLS || to >= CELLS || isHeldSpell(handAt(r, to)) || from === to || (isHand(to) && to - HAND_BASE >= handCap(r))) return null;
  const a = cellAt(r, from);
  const b = cellAt(r, to);
  if (!a) return null;
  if (!isHand(to) && (a.fresh || a.pendingGoldPlay || (b?.def === a.def && b.copies + a.copies >= MAX_COPIES)) && inspectPlayConflict(r, a.def, to, pt, b ? Math.min(MAX_COPIES, a.copies + b.copies) : a.copies, from) && !replacePlayAbility) return null;
  if (!isHand(from) && b && (b.fresh || b.pendingGoldPlay) && inspectPlayConflict(r, b.def, from, undefined, b.copies, to) && !replacePlayAbility) return null;
  if (b && b.def === a.def && b.copies < MAX_COPIES && a.copies < MAX_COPIES && !a.merc && !b.merc) {
    if (a.granted && b.granted) {
      const same = a.granted.id === b.granted.id && a.granted.duration === b.granted.duration;
      if (!same && !keepAbility) return null;
      b.granted = same ? (a.granted.value > b.granted.value ? a.granted : b.granted) : keepAbility === 'source' ? a.granted : b.granted;
    } else b.granted ??= a.granted;
    const entered = !a.fresh || !b.fresh;
    b.fresh = entered ? undefined : true;
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
    if (a.scar || b.scar) b.scar = Math.min(scarCap(b.def), (b.scar ?? 0) + (a.scar ?? 0));
    if (a.guard || b.guard) b.guard = Math.max(b.guard ?? 0, a.guard ?? 0);
    (r.tc.keeper ??= {})[b.oid] = (r.tc.keeper[b.oid] ?? 0) + (r.tc.keeper[a.oid] ?? 0);
    delete r.tc.keeper[a.oid];
    b.startBlock = (b.startBlock ?? 0) + (a.startBlock ?? 0) || undefined;
    b.tmpAtk = (b.tmpAtk ?? 0) + (a.tmpAtk ?? 0) || undefined;
    b.tmpHp = (b.tmpHp ?? 0) + (a.tmpHp ?? 0) || undefined;
    b.lamp = b.lamp || a.lamp;
    if (a.tfx) b.tfx = [...new Set([...(b.tfx ?? []), ...a.tfx])];
    setCell(r, from, null);
    const fx: ShopFx[] = [];
    const levelUp = addCopies(r, b, a.copies, fx, replacePlayAbility, pt);
    // Merging existing bonuses is bookkeeping, not a new growth effect.
    if ((b.fresh || b.pendingGoldPlay) && !isHand(to)) onSummoned(r, b, fx, pt, replacePlayAbility);
    return { merged: true, levelUp, fx };
  }
  setCell(r, from, b);
  setCell(r, to, a);
  const fx: ShopFx[] = [];
  if ((a.fresh || a.pendingGoldPlay) && !isHand(to)) onSummoned(r, a, fx, pt, replacePlayAbility);
  if ((b?.fresh || b?.pendingGoldPlay) && !isHand(from)) onSummoned(r, b, fx, undefined, replacePlayAbility);
  return { merged: false, levelUp: false, fx };
}

export interface SellOut { gold: number; fx: ShopFx[] }
export function sell(r: RunState, slot: number): SellOut | null {
  if (r.endTurnCommitted) return null;
  const o = cellAt(r, slot);
  if (!o) return null;
  return withAction(r, 'sell', o.oid, o.def, () => {
    // 必须在删除或任何出售效果发生前确定对象，空位不改变先后关系；手牌卖出时传给队尾。
    const receiver = isHand(slot) ? [...r.queue].reverse().find((t): t is Owned => !!t)
      : r.queue.slice(slot + 1).find((t): t is Owned => !!t) ?? r.queue.slice(0, slot).reverse().find((t): t is Owned => !!t);
    const gold = sellPrice(o) + (r.relics.includes('r_pouch') ? 1 : 0);
    r.gold += gold;
    setCell(r, slot, null);
    if (o.ench) toBag(r, o.ench);
    const fx: ShopFx[] = [];
    const rest = units(r);
    if (hasAbility(o, 'sell', 'beaver') && rest.length) growFx(r, fx, o.oid, pick(r, rest), vOf(o), vOf(o), '出售', 'beaver');
    for (const t of rest) if (hasAbility(t, 'sell', 'salvage')) growFx(r, fx, t.oid, t, vOf(t), vOf(t), '出售其他单位', 'salvage');
    if (card(o.def).inherit && receiver) {
      for (const item of o.foodHistory ?? []) eatFood(r, receiver, item, fx);
    }
    if (card(o.def).disc === 'sell' && !o.merc) pushDiscover(r, tierPool(tierOf(r)), card(o.def).name, PRICE);
    questTick(r, 'sell', 1, fx);
    return { gold, fx };
  });
}

/** 回合结束（开战前）：从队首到队尾依次结算商店成长；沙域法老让它们额外触发 */
export function endTurn(r: RunState): ShopFx[] {
  return withFactBatch(r, () => endTurnImpl(r));
}
function endTurnImpl(r: RunState): ShopFx[] {
  if (r.endTurnCommitted || r.rewards?.length || r.discover?.length) return [];
  r.endTurnCommitted = true;
  const fx: ShopFx[] = [];
  const q = units(r);
  // 沙域法老：回合结束技能额外触发（同类取最高）
  const extra = q.reduce((m, x) => (adefOf(x).key === 'end' ? Math.max(m, vOf(x)) : m), 0);
  q.forEach((o, i) => { for (let k = 0; k <= extra; k++) {
    const v = vOf(o);
    const others = q.filter((t) => t !== o);
    switch (abOf(o)) {
      case 'recallUnit': {
        const opts = discOffer(r, SHOP_POOL.filter(c => c.tier <= 2));
        if (opts.length) (r.discover ??= []).push({ opts, src: card(o.def).name, mode: 'gain', price: 0, count: v });
        break;
      }
      case 'tfish':
        growFx(r, fx, o.oid, q[i - 1], 0, v, '回合结束', abOf(o)!);
        growFx(r, fx, o.oid, q[i + 1], 0, v, '回合结束', abOf(o)!);
        break;
      case 'backstab': growFx(r, fx, o.oid, q[i - 1], v, 0, '回合结束', abOf(o)!); break;
      case 'egg':
        o.bank = (o.bank ?? 0) + v;
        fx.push({ kind: 'bank', src: o.oid, n: v, label: '回合结束' });
        break;
      case 'giraffe': for (const t of q.slice(Math.max(0, i - v), i)) growFx(r, fx, o.oid, t, 1, 1, '回合结束', abOf(o)!); break;
      case 'penguin': for (const t of others) if (isGold(t)) growFx(r, fx, o.oid, t, v, v, '回合结束', abOf(o)!); break;
      case 'rhyno': if (r.tc.foods >= 3) for (const t of q) growFx(r, fx, o.oid, t, v, v, '吃过 3 次补给', 'rhyno'); break;
    }
  } });
  for (const o of q) if (o.granted?.id === 'sprout' && o.granted.duration === 'permanent') growFx(r, fx, o.oid, o, 0, o.granted.value, '萌芽印', 'sprout');
  // 老兵队长：在队里待满 3 回合后，每回合结束 +1/+1
  if (r.hero === 'vet') for (const o of q) {
    o.stay = (o.stay ?? 0) + 1;
    if (o.stay > 3) growFx(r, fx, null, o, 1, 1, '老兵', 'hero_vet');
  }
  return fx;
}

export const playerTeam = (r: Pick<RunState, 'queue'>): UnitSpec[] =>
  r.queue.filter((o): o is Owned => !!o).map((o) => {
    const [atk, hp] = equipStats(o.ench, ownedAtk(o) + (o.tmpAtk ?? 0), ownedHp(o) + (o.tmpHp ?? 0));
    return { def: o.def, lvl: lvlOf(o.copies), atk, hp, oid: o.oid, ench: o.ench ?? null, lamp: o.lamp, tfx: o.tfx, bank: o.bank, granted: o.granted, startBlock: o.startBlock };
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
  if (r.endTurnCommitted) return false;
  const o = r.queue[slot];
  const id = r.bag[i];
  if (!o || !id) return false;
  r.bag.splice(i, 1);
  equipOnto(r, o, id);
  return true;
}
export function unequip(r: RunState, slot: number): boolean {
  if (r.endTurnCommitted) return false;
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

/** 本幕 Boss（地图上一直可见） */
export const bossOf = (r: Pick<RunState, 'bosses' | 'act'>): BossKey => r.bosses[r.act] ?? 'final';
/** finalLosses = 对当前 Boss 的连败数：终局 1.1 → 1.0 → 0.9；其他 Boss 连败 2 次起 0.9 */
export function bossMul(r: RunState, key: BossKey) {
  if (key === 'final') return r.finalLosses >= 2 ? 0.9 : r.finalLosses === 1 ? 1.0 : 1.1;
  return r.finalLosses >= 2 ? 0.9 : 1;
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
/** 关键卡按它放大的时机归形态 */
const KEY_AB: Record<string, string> = { hurt: 'idol', start: 'mosquito', faint: 'mammoth' };
const SUMMON_AB = new Set(['cricket', 'egg', 'sheep', 'deer', 'rooster', 'spider', 'eagle', 'fly', 'horse', 'dog', 'turkey', 'heart']);
const BOOM_AB = new Set(['hedgehog', 'badger', 'ant', 'flamingo', 'mammoth']);
const WALL_AB = new Set(['ox', 'turtle', 'gorilla', 'ironwall']);
const SNIPE_AB = new Set(['mosquito', 'dolphin', 'croc', 'skunk', 'snake']);
const HURT_AB = new Set(['peacock', 'elephant', 'camel', 'blowfish', 'anvil', 'idol', 'thornback']);
export function formOf(team: UnitSpec[]): FormKey {
  if (!team.length) return 'mixed';
  const sc: Record<FormKey, number> = { tank: 0, summon: 0, carry: 0, snipe: 0, boom: 0, wall: 0, rush: 0, mixed: 0 };
  for (const u of team) {
    const ab = card(u.def).ab ?? KEY_AB[card(u.def).key ?? ''] ?? '';
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
    const res = simulate(me, enemy, (r.seed + i * 104729 + r.turn * 7) & 0x7fffffff, r.relics, simOpts(r)).result;
    w += res === 'win' ? 1 : res === 'draw' ? 0.5 : 0;
  }
  return w / n;
}
interface Cand { units: UnitSpec[]; form: FormKey; wr: number; encounter?: Enemy['encounter'] }

// ── 压力：玩家阵容太强时，把敌阵整体放大到「这一档该有的胜率上限」（只放大不缩小） ──
/** 前 4 回合是发育期（金币少、要攒钱升本），不加压；之后满压 */
const PRESSURE_FROM = 5;
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
/** 胜率低于 floor 就二分缩小系数（亮出形态后候选少，不能只会放大） */
function soften(r: RunState, units: UnitSpec[], wr: number, floor: number): { units: UnitSpec[]; wr: number } {
  if (wr >= floor) return { units, wr };
  let lo = 0.55, hi = 1, best = { units, wr };
  for (let i = 0; i < 5; i++) {
    const k = (lo + hi) / 2;
    const us = scaleTeam(units, k);
    const w = winRate(r, us, 6);
    if (w < floor) hi = k;
    else { lo = k; best = { units: us, wr: w }; }
  }
  return best.wr >= floor ? best : { units: scaleTeam(units, 0.55), wr: floor };
}
const FLOOR = [0.75, 0.5, 0.3];

// ── 敌阵整理：幽灵是 bot 的真实阵容，偶尔有站错位、混进凑数小兵的，出场前理一下 ──
/** 技能要身前有人（站队首就白给） */
const NEED_FRONT = new Set(['dodo', 'snake', 'kangaroo', 'backstab', 'giraffe', 'tiger']);
/** 技能作用在身后（站队尾就白给） */
const NEED_BACK = new Set(['elephant', 'camel', 'flamingo', 'turtle']);
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
  // 前 3 回合幽灵形态天然单一，不补合成阵（否则开局敌人偏离校准）
  if (r.turn >= 4) for (const f of r.eco) if (all.filter((x) => x.form === f).length < 2) for (let i = 0; i < 2; i++) all.push({ t: synthTeam(r, f), form: f });
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
function pickByTemp(r: RunState, cs: Cand[], soft = false): Cand {
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
  const l = soft && c.wr < FLOOR[gi] ? soften(r, c.units, c.wr, FLOOR[gi]) : lift(r, c.units, c.wr, capOf(r, gi));
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
  const w0 = winRate(r, best!.units, 6);
  const boosted = w0 < target - 0.05 ? soften(r, best!.units, w0, target - 0.05) : lift(r, best!.units, w0, target);
  return { boss: null, units: boosted.units, form: base.form, elite: best!.ax, encounter: base.encounter };
}
export function makeBoss(r: RunState): Enemy {
  const boss = bossOf(r);
  // 按计划回合定强度：重打 Boss 不因回合数增长而变强
  const turn = actTurn(r.act, LAYERS);
  const units = bossTeam(BOSSES[boss], turn, bossMul(r, boss) * diffK(r));
  // Boss 是关卡：阵容再强也要拼一下；每连败一次放松一点
  const cap = Math.min(0.88, 0.66 - 0.04 * (r.diff ?? 0) + 0.08 * r.finalLosses);
  const w = winRate(r, units, 6);
  const floor = Math.min(0.8, 0.62 - 0.06 * (r.diff ?? 0) + 0.08 * r.finalLosses);
  return { boss, units: (w < floor ? soften(r, units, w, floor) : lift(r, units, w, cap, 2)).units };
}
/** 战斗节点的候选：优先地图上亮出的形态，没有就按该形态补阵 */
function formCands(r: RunState, form: FormKey | undefined, k: number): Cand[] {
  const cs = candidates(r, k, form ? null : r.lastForm);
  if (!form) return cs;
  const hit = cs.filter((c) => c.form === form);
  if (hit.length >= 2) return hit;
  const sc = enemyScale(r.turn) * EQUIP_K * diffK(r);
  for (let i = hit.length; i < 2; i++) {
    const units = tidyTeam(scaleTeam(synthTeam(r, form), sc));
    hit.push({ units, form, wr: winRate(r, units) });
  }
  return hit;
}
export function makeNodeEnemy(r: RunState, n: MapNode): Enemy {
  if (!ghostPool(r.turn).length) return { boss: null, units: curveTeam(r) };
  if (n.k === 'elite') {
    const cs = formCands(r, n.form, 6);
    const mid = cs.filter((c) => bucketOf(c.wr) === 1);
    return makeElite(r, pick(r, mid.length ? mid : cs));
  }
  const c = pickByTemp(r, formCands(r, n.form, 8), !!n.form);
  return { boss: null, units: c.units, form: n.form ?? c.form, encounter: c.encounter };
}

// ── 路线图 ──
const NODE_W: [NodeKind, number][] = [['fight', 42], ['elite', 14], ['event', 18], ['shop', 10], ['treasure', 8], ['camp', 8]];
export const isCombat = (k: NodeKind) => k === 'fight' || k === 'elite' || k === 'boss';
function rollKind(r: RunState, l: number): NodeKind {
  if (l === 0) return 'fight';
  const ws = NODE_W.map(([k, w]) => {
    if (k === 'shop' && r.lite) return 0;
    if ((k === 'elite' || k === 'camp') && (l < 2 || l === LAYERS - 1)) return 0;
    return w;
  });
  let t = rng(r) * ws.reduce((a, b) => a + b, 0);
  return NODE_W[ws.findIndex((w) => (t -= w) < 0)]?.[0] ?? 'fight';
}
/** 连线：按比例对齐 → 补齐没人连的点 → 随机加不交叉的斜线 */
function linkLayers(r: RunState, A: MapNode[], B: MapNode[]) {
  const a = A.length, b = B.length;
  const prop = (i: number, x: number, y: number) => (x === 1 ? 0 : Math.round((i * (y - 1)) / (x - 1)));
  A.forEach((n, i) => { n.next = a === 1 ? B.map((_, j) => j) : [prop(i, a, b)]; });
  for (let j = 0; j < b; j++) if (!A.some((n) => n.next.includes(j))) A[prop(j, b, a)].next.push(j);
  const crosses = (i: number, j: number) => A.some((n, i2) => n.next.some((j2) => (i2 < i && j2 > j) || (i2 > i && j2 < j)));
  A.forEach((n, i) => {
    if (rng(r) > 0.45) return;
    const j = n.next[0] + (rng(r) < 0.5 ? -1 : 1);
    if (j >= 0 && j < b && !n.next.includes(j) && !crosses(i, j)) n.next.push(j);
  });
  for (const n of A) n.next.sort((x, y) => x - y);
}
/** 每条路线的最少 / 最多计数 */
function pathRange(L: MapNode[][], f: (n: MapNode) => number): [number, number] {
  let cur = L[0].map((n) => [f(n), f(n)]);
  for (let l = 1; l < L.length; l++) {
    cur = L[l].map((n, j) => {
      const from = L[l - 1].map((p, i) => (p.next.includes(j) ? cur[i] : null)).filter((x): x is number[] => !!x);
      return [Math.min(...from.map((x) => x[0])) + f(n), Math.max(...from.map((x) => x[1])) + f(n)];
    });
  }
  return [Math.min(...cur.map((x) => x[0])), Math.max(...cur.map((x) => x[1]))];
}
/** 生成本幕地图：6 层 × 2–3 点 + Boss；每条路至少 3 场战斗、有可绕开的精英、Boss 前一层必有篝火 */
export function genMap(r: RunState, solo = false): MapNode[][] {
  const boss: MapNode[] = [{ k: 'boss', next: [] }];
  if (solo) return [...Array.from({ length: LAYERS }, (): MapNode[] => [{ k: 'fight', next: [0] }]), boss];
  let L: MapNode[][] = [];
  let valid = false;
  for (let tries = 0; tries < 60; tries++) {
    L = Array.from({ length: LAYERS }, (_, l) => Array.from({ length: rng(r) < 0.55 ? 3 : 2 }, () => ({ k: rollKind(r, l), next: [] as number[] })));
    for (const n of L[LAYERS - 1]) n.k = 'camp';
    for (let l = 0; l < LAYERS - 1; l++) linkLayers(r, L[l], L[l + 1]);
    for (const n of L[LAYERS - 1]) n.next = [0];
    const fights = pathRange(L, (n) => (n.k === 'fight' || n.k === 'elite' ? 1 : 0));
    const elites = pathRange(L, (n) => (n.k === 'elite' ? 1 : 0));
    const shops = L.flat().filter((n) => n.k === 'shop').length;
    if (fights[0] >= 3 && elites[1] >= 1 && elites[0] === 0 && shops <= 2) { valid = true; break; }
  }
  if (!valid) {
    // Two parallel routes: each fights at layers 0, 1 and 3; only one sees an elite.
    L = Array.from({ length: LAYERS }, (_, l) => [0, 1].map(i => ({ k: (l === 5 ? 'camp' : l === 2 && i === 0 ? 'elite' : l === 2 || l === 4 ? 'event' : 'fight') as NodeKind, next: [i] })));
    for (const n of L[LAYERS - 1]) n.next = [0];
  }
  for (let l = 0; l < LAYERS; l++) for (const n of L[l]) if ((n.k === 'fight' || n.k === 'elite') && (r.act > 0 || l >= 2)) n.form = pick(r, r.eco);
  return [...L, boss];
}
/** Map and opponents use a separate stream, independent of tavern actions and player strength. */
function makeFixedMap(r: RunState, solo = false): MapNode[][] {
  const c = structuredClone(r);
  c.seed = ((r.worldSeed ?? r.seed) ^ Math.imul(r.act + 1, 0x45d9f3b)) & 0x7fffffff;
  c.turn = actTurn(r.act, 0); c.chaos = 0; c.finalLosses = 0;
  const map = genMap(c, solo);
  map.forEach((layer, l) => layer.forEach((n) => {
    if (!isCombat(n.k)) return;
    c.turn = actTurn(r.act, l);
    n.battleSeed = Math.floor(rng(c) * 0x7fffffff);
    if (n.k === 'boss') {
      const boss = bossOf(c);
      n.enemy = { boss, units: bossTeam(BOSSES[boss], c.turn, (boss === 'final' ? 1.1 : 1) * DIFFS[c.diff].k) };
    } else {
      const form = n.form ?? pick(c, c.eco);
      const base = synthTeam(c, form);
      const ax = n.k === 'elite' ? pickN(c, ELITE_AX, c.turn >= 9 ? 2 : 1) : undefined;
      const us = scaleTeam(base, enemyScale(c.turn) * EQUIP_K * DIFFS[c.diff].k);
      n.enemy = { boss: null, form, units: ax ? us.map(u => ({ ...u, ax })) : us, elite: ax };
    }
  }));
  return map;
}
/** 当前层可去的节点 */
export const nodeOpts = (r: Pick<RunState, 'map' | 'layer' | 'path'>): number[] =>
  r.layer === 0 ? r.map[0].map((_, i) => i) : r.map[r.layer - 1]?.[r.path[r.layer - 1]]?.next ?? [0];
export const curNode = (r: Pick<RunState, 'map' | 'layer' | 'path'>): MapNode | null => r.map[r.layer]?.[r.path[r.layer]] ?? null;
const EMPTY: Enemy = { boss: null, units: [] };
/** 进入本回合的节点：只有一条路就直接走，否则等玩家在地图上选 */
function enterNode(r: RunState) {
  r.event = null;
  r.merchant = null;
  r.leaving = false;
  r.path.length = r.layer;
  r.enemy = { ...EMPTY };
  const opts = nodeOpts(r);
  if (opts.length === 1) pickNode(r, opts[0]);
}
export function pickNode(r: RunState, i: number): boolean {
  if (r.path[r.layer] !== undefined || !nodeOpts(r).includes(i)) return false;
  r.path[r.layer] = i;
  const n = r.map[r.layer][i];
  if (isCombat(n.k)) {
    r.enemy = structuredClone(n.enemy ?? EMPTY);
    // Chaos is an explicit event cost applied to the fixed template once per encounter.
    if (r.chaos > 0) r.enemy.units = scaleTeam(r.enemy.units, CHAOS_K);
  } else r.enemy = { ...EMPTY };
  if (n.k === 'shop') r.merchant = rollGoods(r);
  return true;
}
/** 非战斗节点：结束回合后处理节点内容（篝火 / 事件 / 宝藏）；商人直接离开 */
export function leaveNode(r: RunState) {
  if (r.rewards?.length || r.discover?.length) return;
  const n = curNode(r);
  if (!n || isCombat(n.k)) return;
  r.leaving = true;
  r.event = n.k === 'camp' ? 'fire' : n.k === 'treasure' ? 'treasure' : n.k === 'event' ? rollNodeEvent(r) : null;
}
export function passNode(r: RunState) {
  if (r.rewards?.length || r.discover?.length) return;
  if (!r.leaving) return;
  r.leaving = false;
  r.event = null;
  r.layer++;
  advance(r);
}
function rollNodeEvent(r: RunState): EventId {
  if (!r.lite && !r.quest && r.questAct !== r.act && rng(r) < 0.45) return 'quest';
  const evs = EVENTS.filter((e) => !r.seenEv.includes(e) && (e !== 'chaos' || (r.turn <= 15 && relicPool(r).length >= 3)) && (e !== 'merc' || r.turn <= 17));
  if (!evs.length) return 'treasure';
  const e = pick(r, evs);
  r.seenEv.push(e);
  return e;
}

// ── 商人 ──
export const SHARD_NEED = 2;
const merchantSpells = (r: RunState) => {
  const t = Math.min(6, tierOf(r) + 1);
  const hi = SPELL_POOL.filter((f) => f.tier === t);
  return hi.length ? hi : SPELL_POOL.filter((f) => f.tier <= t);
};
function rollGoods(r: RunState): Goods[] {
  const out: Goods[] = [];
  const q: Quality = rng(r) < 0.6 ? 1 : 2;
  out.push({ kind: 'equip', id: rollItem(r, q, [], 0), price: q === 1 ? 4 : 7 });
  if (relicPool(r).length && rng(r) < 0.5) out.push({ kind: 'shard', id: 'shard', price: 5 });
  else {
    const sp = merchantSpells(r);
    if (sp.length) { const f = pick(r, sp); out.push({ kind: 'spell', id: f.id, price: (f.price ?? PRICE) + 1 }); }
  }
  return out;
}
export function buyGoods(r: RunState, i: number): boolean {
  if (r.endTurnCommitted) return false;
  const g = r.merchant?.[i];
  if (!g || g.sold || r.gold < g.price) return false;
  r.gold -= g.price;
  g.sold = true;
  if (g.kind === 'equip') toBag(r, g.id as Ench);
  else if (g.kind === 'shard') {
    r.shards = (r.shards ?? 0) + 1;
    if (r.shards >= SHARD_NEED) { r.shards = 0; r.relicDue++; openRelic(r); }
  } else r.shop.push({ sid: r.nextId++, kind: 'food', def: g.id, locked: false, free: true });
  return true;
}

// ── 英雄 / 委托 ──
export const heroReady = (r: RunState) => { const h = HERO[r.hero]; return !!h.cost && r.heroUsed !== r.turn && r.gold >= h.cost; };
/** 主动技能：军需官要指定友军；先知直接发现 */
export function useHero(r: RunState, slot: number | null = null): ShopFx[] | null {
  return withFactBatch(r, () => useHeroImpl(r, slot));
}
function useHeroImpl(r: RunState, slot: number | null): ShopFx[] | null {
  if (r.endTurnCommitted) return null;
  if (!heroReady(r)) return null;
  const fx: ShopFx[] = [];
  if (r.hero === 'qm') {
    const o = slot === null ? null : cellAt(r, slot);
    if (!o) return null;
    growFx(r, fx, null, o, 1, 2, '军需', 'hero_qm');
  } else if (r.hero === 'seer') pushDiscover(r, tierPool(tierOf(r)), '先知', 0);
  else return null;
  r.gold -= HERO[r.hero].cost!;
  r.heroUsed = r.turn;
  return fx;
}
export const QUESTS: QuestId[] = ['hurt', 'summon', 'sell'];
function questTick(r: RunState, id: QuestId, n: number, fx: ShopFx[], hurts?: Record<number, number>) {
  const q = r.quest;
  if (!q || q.id !== id || n <= 0) return;
  q.n += n;
  if (q.n < QUEST_INFO[id].goal) return;
  r.quest = null;
  r.questDone = id;
  if (id === 'summon') r.legion = Math.min(LEGION_MAX, (r.legion ?? 0) + 3);
  else if (id === 'sell') pushDiscover(r, tierPool(6), '委托', 0);
  else {
    const c = units(r).filter((o) => !o.merc && !isGold(o)).sort((a, b) => (hurts?.[b.oid] ?? 0) - (hurts?.[a.oid] ?? 0))[0];
    if (c) addCopies(r, c, MAX_COPIES - c.copies, fx);
  }
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

export const simOpts = (r: Pick<RunState, 'legion'>) => ({ legion: r.legion ?? 0 });
export function fight(r: RunState): BattleOut & { settlementId: string; battleQueue: (number | null)[] } {
  if (r.rewards?.length || r.discover?.length) throw new Error('Resolve pending rewards before battle');
  const out = simulate(playerTeam(r), r.enemy.units, (curNode(r)?.battleSeed ?? r.seed), r.relics, simOpts(r));
  return { ...out, settlementId: `${r.worldSeed}:${r.act}:${r.layer}:${r.path[r.layer]}:${r.turn}`, battleQueue: r.queue.map(o => o?.oid ?? null) };
}
/** 试打：在副本上结束回合再开打，不改存档；随机种子每次不同，只看大概 */
export function trialFight(r: RunState): BattleOut & { preview: true } {
  const c = structuredClone(r);
  endTurn(c);
  return { ...simulate(playerTeam(c), c.enemy.units, (Math.random() * 2 ** 31) | 0, c.relics, simOpts(c)), preview: true };
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
type SettlementOut = Pick<BattleOut, 'result' | 'perm'> & Partial<Pick<BattleOut, 'hurts' | 'summons'>> & { settlementId?: string; preview?: boolean; battleQueue?: (number | null)[] };
export function settleBattle(r: RunState, out: SettlementOut) {
  return withFactBatch(r, () => settleBattleImpl(r, out));
}
function settleBattleImpl(r: RunState, out: SettlementOut) {
  if (out.preview) return;
  if (out.settlementId && r.lastSettledBattle === out.settlementId) return;
  if (out.settlementId) r.lastSettledBattle = out.settlementId;
  const result = out.result;
  if (result === 'win' && r.relics.includes('r_runebox')) {
    const pool = tacticalPool(r);
    if (pool.length) enqueueCard(r, { kind: 'spell', oid: r.nextId++, def: pick(r, pool), source: '符文匣', obtainedTurn: r.turn }, '符文匣');
  }
  const battleLineup = out.battleQueue ? out.battleQueue.map(id => id == null ? null : heldByOid(r, id) ?? null) : [...r.queue];
  const scarFx: ShopFx[] = [];
  for (const [oid, p] of Object.entries(out.perm)) {
    const o = heldByOid(r, Number(oid));
    if (o && battleLineup.includes(o)) grow(r, o, p.atk, p.hp, null, '先锋徽章', 'r_vanguard', scarFx, 'after_battle', undefined, battleLineup);
  }
  // 历战：每实际受伤 2 次记 1 点，输赢都给；每场与累计上限按阶层
  for (const o of battleLineup.filter((x): x is Owned => !!x && heldByOid(r, x.oid) === x)) {
    if (!hasScar(o.def)) continue;
    const n = Math.min(Math.floor((out.hurts?.[o.oid] ?? 0) / 2), scarPer(o.def), scarCap(o.def) - (o.scar ?? 0));
    if (n <= 0) continue;
    grow(r, o, n, n, null, '历战', 'scar', scarFx, 'after_battle', undefined, battleLineup);
    o.scar = (o.scar ?? 0) + n;
  }
  // 军团规格：本场召唤满 3 / 6 次 +1 / +2
  const sn = out.summons ?? 0;
  const before = r.legion ?? 0;
  r.legion = Math.min(LEGION_MAX, before + (sn >= 6 ? 2 : sn >= 3 ? 1 : 0));
  r.legionUp = r.legion - before;
  const guards = units(r).filter((o) => card(o.def).disc === 'guard');
  for (const o of units(r)) {
    o.tmpAtk = undefined;
    o.tmpHp = undefined;
    o.lamp = undefined;
    o.tfx = undefined;
    o.startBlock = undefined;
    if (o.granted?.duration === 'battle') o.granted = undefined;
  }
  for (const o of r.hand) if (o && !isHeldSpell(o)) {
    o.tmpAtk = undefined; o.tmpHp = undefined; o.lamp = undefined; o.tfx = undefined; o.startBlock = undefined;
    if (o.granted?.duration === 'battle') o.granted = undefined;
  }
  r.history.push(result);
  if (r.enemy.boss) r.finalLosses = result === 'lose' ? r.finalLosses + 1 : 0;
  r.lastLoss = 0;
  questTick(r, 'hurt', Object.values(out.hurts ?? {}).reduce((a, b) => a + b, 0), scarFx, out.hurts);
  questTick(r, 'summon', sn, scarFx);
  const bossWin = result === 'win' && curNode(r)?.k === 'boss';
  if (result === 'win') {
    r.wins++;
    r.streak = Math.max(1, r.streak + 1);
    if (r.enemy.elite?.length) r.chest = rollChest(r, 'elite');
    else if (curNode(r)?.k === 'boss') { if (r.act < ACTS - 1) r.relicDue++; }
    else r.bankGold = (r.bankGold ?? 0) + 2;
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
  if (result === 'lose') {
    // 保心只返还实际扣除的生命，避免1血承受2点惩罚后复活成2血。
    r.lastLoss = Math.min(r.lives, enemyLossCost(r));
    r.lives -= r.lastLoss;
    r.streak = Math.min(-1, r.streak - 1);
  }
  if (r.enemy.form) r.lastForm = r.enemy.form;
  const firstSettlement = r.firstRelicGiven === false;
  if (firstSettlement) r.firstRelicGiven = true;
  if (bossWin && r.act >= ACTS - 1) {
    r.phase = 'won';
    return;
  }
  if (r.lives <= 0) {
    r.lives = 0;
    r.phase = 'lost';
    return;
  }
  if (firstSettlement) { r.firstRelicPending = true; r.relicDue++; }
  openRelic(r);
  stepMap(r, result === 'win');
  advance(r);
  r.pendingFx = scarFx;
  // 驻守：每在队里打满 GUARD_N 场，免费发现一张高一阶单位
  for (const o of guards) {
    if (!r.queue.includes(o)) continue;
    o.guard = (o.guard ?? 0) + 1;
    if (o.guard < GUARD_N) continue;
    o.guard = 0;
    pushDiscover(r, tierPool(tierOf(r) + 1), card(o.def).name, 0);
  }
}

/** 看广告保心：退回上一场扣的心（每局 2 次）；若因此免于出局则继续 */
export function adSaveHeart(r: RunState): boolean {
  if (!r.lastLoss || r.adSave >= AD_SAVE_MAX) return false;
  r.adSave++;
  r.lives = Math.min(maxLives(r), r.lives + r.lastLoss);
  r.lastLoss = 0;
  if (r.streak < 0) r.streak = Math.min(-1, r.streak + 1);
  if (r.phase === 'lost') {
    r.phase = 'prep';
    stepMap(r, false);
    advance(r);
  }
  return true;
}

/** 战后走地图：Boss 输了留在原地，赢了进下一幕；其余节点往前一层 */
function stepMap(r: RunState, win: boolean) {
  if (curNode(r)?.k !== 'boss') { r.layer++; return; }
  if (!win) return;
  r.act++;
  r.layer = 0;
  r.path = [];
  r.map = makeFixedMap(r);
}
function advance(r: RunState) {
  if (r.relics.includes('r_reserve')) r.bankGold = (r.bankGold ?? 0) + Math.floor(r.gold / 2);
  r.turn++;
  r.hand = r.hand.map(o => isHeldSpell(o) && o.expiresTurn !== undefined && o.expiresTurn < r.turn ? null : o);
  r.rewards = r.rewards?.filter(x => !isHeldSpell(x.card) || x.card.expiresTurn === undefined || x.card.expiresTurn >= r.turn);
  r.endTurnCommitted = false;
  r.rerolls = 0;
  r.tc = newCount();
  r.gold = goldFor(r.turn) + (r.bankGold ?? 0);
  if (r.tavern < TAVERN_MAX) r.tavernCost = Math.max(0, r.tavernCost - 1);
  r.bankGold = 0;
  r.freeRr = r.hero === 'guild' ? 1 : 0;
  // 额外牛奶只属于上一备战，锁定也不跨回合；白送的发现卡没锁也不跨回合。
  r.shop = r.shop.filter((s) => (s.kind !== 'food' || s.def !== 'f_milk') && !(s.price === 0 && !s.locked));
  rollShop(r);
  if (r.omen) {
    r.omen = false;
    const mt = tierOf(r);
    const pool = mt >= 6 ? units(r).map((o) => card(o.def)).filter((d) => !d.token && !d.enemy) : tierPool(mt + 1);
    const slot = r.shop.find((s) => s.kind === 'unit' && !s.locked && !s.free);
    if (slot && pool.length) slot.def = pick(r, pool).id;
  }
  grantPrepMilk(r);
  r.pendingFx = [];
  enterNode(r);
}

// ── 存档 ──
export function save(r: RunState | null) {
  try {
    const status = saveStatus();
    if ((status === 'invalid' || (status === 'unsupported' && localStorage.getItem(SAVE_KEY) !== null)) && !beginNewRunBackup()) return;
    if (!r || r.phase !== 'prep') localStorage.removeItem(SAVE_KEY);
    else localStorage.setItem(SAVE_KEY, JSON.stringify(r));
  } catch { /* 存储受限时照常可玩 */ }
}
export function load(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const r = JSON.parse(raw ?? 'null') as RunState | null;
    if (!r || r.v !== SAVE_VERSION || r.phase !== 'prep' || !Array.isArray(r.queue) || r.queue.length !== QUEUE_MAX) return null;
    if (!Array.isArray(r.map) || r.map.length !== LAYERS + 1 || !Array.isArray(r.path) || !Array.isArray(r.bosses) || !HERO[r.hero]) return null;
    if (!Array.isArray(r.hand) || r.hand.length !== HAND_MAX || !Number.isInteger(r.tavern) || r.tavern < 1 || r.tavern > TAVERN_MAX
      || !Number.isInteger(r.tavernCost) || r.tavernCost < 0) return null;
    // Validate persisted identities and new v3 fields before any gameplay uses them.
    const ids = new Set<number>();
    const idOk = (id: unknown) => {
      if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || id >= r.nextId || ids.has(id)) return false;
      ids.add(id);
      return true;
    };
    const finite = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
    const migrate = (id: string) => id === 'f_elixir' ? 'x_copy' : id;
    for (const o of r.hand) if (o && isHeldSpell(o)) o.def = migrate(o.def);
    for (const s of r.shop) if (s.kind === 'food') s.def = migrate(s.def);
    for (const reward of r.rewards ?? []) if (reward?.card && isHeldSpell(reward.card)) reward.card.def = migrate(reward.card.def);
    for (const d of r.discover ?? []) if (d.mode === 'spell') d.opts = d.opts.map(migrate);
    for (const g of r.merchant ?? []) if (g.kind === 'spell') g.id = migrate(g.id);
    const abilityOk = (g: GrantedAbility | undefined) => g === undefined || (
      !!g && ['bone', 'spark', 'blood', 'thorn', 'sprout'].includes(g.id)
      && ['battle', 'permanent'].includes(g.duration)
      && finite(g.value) && g.value >= 0 && typeof g.source === 'string'
      && (g.tempered === undefined || typeof g.tempered === 'boolean')
    );
    const ownedOk = (o: Owned) => !!card(o.def)
      && (o.kind === undefined || o.kind === 'unit')
      && Number.isSafeInteger(o.copies) && o.copies >= 1 && o.copies <= MAX_COPIES
      && finite(o.atkBonus) && finite(o.hpBonus) && abilityOk(o.granted)
      && (o.pendingGoldPlay === undefined || typeof o.pendingGoldPlay === 'boolean')
      && (o.startBlock === undefined || (Number.isSafeInteger(o.startBlock) && o.startBlock >= 0));
    const handOk = (o: HandCard) => {
      if (!isHeldSpell(o)) return ownedOk(o);
      return !!FOOD[o.def] && typeof o.source === 'string'
        && Number.isSafeInteger(o.obtainedTurn) && o.obtainedTurn > 0
        && (o.expiresTurn === undefined || (Number.isSafeInteger(o.expiresTurn) && o.expiresTurn >= o.obtainedTurn))
        && (o.val === undefined || (Array.isArray(o.val) && o.val.length === 2 && o.val.every(v => finite(v) && v >= 0)));
    };
    if (!Number.isSafeInteger(r.nextId) || r.nextId < 1 || !Number.isSafeInteger(r.worldSeed)
      || (r.endTurnCommitted !== undefined && typeof r.endTurnCommitted !== 'boolean')
      || (r.lastSettledBattle !== undefined && typeof r.lastSettledBattle !== 'string')) return null;
    if (!r.queue.every(o => !o || (idOk(o.oid) && ownedOk(o)))
      || !r.hand.every(o => !o || (idOk(o.oid) && handOk(o)))
      || !Array.isArray(r.shop) || !r.shop.every(s => !!s && idOk(s.sid))) return null;
    if (!Array.isArray(r.rewards) || !r.rewards.every(x => !!x && idOk(x.id)
      && typeof x.source === 'string' && !!x.card && idOk(x.card.oid) && handOk(x.card))) return null;
    const enemyOk = (e: Enemy | undefined) => !!e && (e.boss === null || !!BOSSES[e.boss])
      && Array.isArray(e.units) && e.units.every(u => !!u && !!card(u.def)
        && finite(u.atk) && u.atk > 0 && finite(u.hp) && u.hp > 0 && [1, 2, 3].includes(u.lvl));
    const kinds: NodeKind[] = ['fight', 'elite', 'camp', 'shop', 'event', 'treasure', 'boss'];
    const validMap = r.map.every((layer, l) => Array.isArray(layer) && layer.length > 0 && layer.every(n => {
      if (!n || !kinds.includes(n.k) || !Array.isArray(n.next)) return false;
      if (!n.next.every(i => Number.isSafeInteger(i) && i >= 0 && l < LAYERS && i < r.map[l + 1].length)) return false;
      return !isCombat(n.k) || (Number.isSafeInteger(n.battleSeed) && n.battleSeed! >= 0 && enemyOk(n.enemy));
    }));
    if (!validMap || !enemyOk(r.enemy)) return null;
    const ok = r.queue.every((o) => !o || card(o.def)) && r.hand.every((o) => !o || (isHeldSpell(o) ? !!FOOD[o.def] : !!card(o.def))) && r.shop.every((s) => (s.kind === 'food' ? FOOD[s.def] : card(s.def))) && r.enemy.units.every((u) => card(u.def));
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
    if ((r.firstRelicGiven !== undefined && typeof r.firstRelicGiven !== 'boolean') || (r.firstRelicPending !== undefined && typeof r.firstRelicPending !== 'boolean')) return null;
    r.firstRelicGiven ??= true;
    const legacySupply = r.supplyVersion === undefined;
    if (!legacySupply && r.supplyVersion !== SUPPLY_VERSION) return null;
    // 同版本增量字段缺失时从空开始，不能从累计属性反推来源。
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
      const cap = foodSlots(r.tavern);
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
    if (r.discover !== undefined && (!Array.isArray(r.discover) || r.discover.some((d) => !d || !Array.isArray(d.opts) || d.opts.some((id) => d.mode === 'spell' ? !FOOD[id] : !card(id))))) return null;
    if (!Number.isInteger(r.lives) || r.lives <= 0 || !DIFFS[r.diff ?? 0]) return null;
    if (r.lives > maxLives(r)) {
      // 原存档留底后，仅把超出新上限的生命收至上限，不重置进度。
      const backup = `${SAVE_KEY}_before_health_532`;
      if (localStorage.getItem(backup) === null) localStorage.setItem(backup, raw!);
      r.lives = maxLives(r);
    }
    return r;
  } catch {
    return null;
  }
}
export function clearAll() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('pdqs3_')).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

// ── 遗物 ──
export const relicPool = (r: RunState) => RELICS.filter((x) => !r.relics.includes(x.id)).map((x) => x.id);
const RARE_FIRST: RelicId[] = ['r_training'];
const FIRST_RELICS: RelicId[] = ['r_share', 'r_vanguard', 'r_relay', 'r_reserve', 'r_runebox', 'r_ember', 'r_motley'];
/** 有待选的遗物就生成本次选项 */
export function openRelic(r: RunState) {
  if (r.relicPick || r.relicDue <= 0) return;
  const pool = relicPool(r);
  if (!pool.length) { r.relicDue = 0; r.firstRelicPending = false; return; }
  const first = r.firstRelicPending === true;
  const firstPool = pool.filter(id => FIRST_RELICS.includes(id));
  if (first && !firstPool.length && !pool.some(id => RARE_FIRST.includes(id))) {
    r.firstRelicPending = false;
    r.relicDue--;
    openRelic(r);
    return;
  }
  const opts: RelicId[] = [];
  if (first && firstPool.length) opts.push(pick(r, firstPool));
  const remaining = pool.filter(id => !opts.includes(id) && (!first || FIRST_RELICS.includes(id) || RARE_FIRST.includes(id)));
  while (opts.length < 3 && remaining.length) {
    const weight = (id: RelicId) => (first ? RARE_FIRST.includes(id) : RELICS.find(x => x.id === id)?.rarity === 'rare') ? 1 : 4;
    let n = rng(r) * remaining.reduce((sum, id) => sum + weight(id), 0);
    let i = 0; while (i < remaining.length - 1 && (n -= weight(remaining[i])) >= 0) i++;
    opts.push(remaining.splice(i, 1)[0]);
  }
  if (first) r.firstRelicPending = false;
  r.relicPick = { opts, ad: false };
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
/** 篝火选项：0 +2 份 / 1 永久 +4/+4 / 2 +1 心 / 3 装备升一品（铁匠） */
export const fireCopyOk = (o: Owned | null | undefined) => !!o && !o.merc && o.copies < MAX_COPIES;
export const fireSmithOk = (o: Owned | null | undefined) => !!o?.ench && (equipOf(o.ench)?.q ?? 3) < 3 && !EQUIPS.find((e) => e.id === o.ench)?.food;
export const MERC_FIGHTS = 3;
/** 变形候选：同阶、共享任一标签、不同名 */
export const morphPool = (o: Owned) => {
  const d = card(o.def);
  const tags = [d.line, d.tag2].filter((t) => t && t !== 'any') as (typeof LINES)[number][];
  return SHOP_POOL.filter((c) => c.tier === d.tier && c.id !== d.id && (tags.length ? tags.some((t) => hasTag(c, t)) : true));
};
/** 雇佣兵的阶数：当前可买最高阶 +1 */
export const mercTier = (r: RunState) => Math.min(6, tierOf(r) + 1) as Tier;
export type EventOut = { ok: false } | { ok: true; fx: ShopFx[]; levelUp?: boolean; lost?: Owned; morphed?: string; bag?: Ench; merc?: number };
/** 事件选择：choice 0 = 主选项（camp 有 0/1 两个），-1 = 离开；需要单位的选项带 slot */
export function resolveEvent(r: RunState, choice: number, slot: number | null = null): EventOut {
  return withFactBatch(r, () => resolveEventImpl(r, choice, slot));
}
function resolveEventImpl(r: RunState, choice: number, slot: number | null): EventOut {
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
          growFx(r, fx, null, o, 3, 3, '训练营', 'event_camp');
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
        const need = MAX_COPIES - o.copies;
        const levelUp = addCopies(r, o, need, fx);
        out = { ok: true, fx, levelUp, lost };
        break;
      }
      case 'morph': {
        if (!o || o.merc) return { ok: false };
        const pool = morphPool(o);
        if (!pool.length) return { ok: false };
        o.def = pick(r, pool).id;
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
        onObtained(r, m, fx);
        out = { ok: true, fx, merc: at };
        break;
      }
      case 'chaos':
        r.chaos = 3;
        break;
      case 'fire':
        if (choice === 2) {
          if (r.lives >= maxLives(r)) return { ok: false };
          r.lives++;
        } else if (choice === 0) {
          if (!fireCopyOk(o)) return { ok: false };
          out = { ok: true, fx, levelUp: addCopies(r, o!, 2, fx) };
        } else if (choice === 1) {
          if (!o) return { ok: false };
          growFx(r, fx, null, o, 4, 4, '篝火', 'event_fire');
        } else {
          if (r.hero !== 'smith' || !fireSmithOk(o)) return { ok: false };
          const q = (equipOf(o!.ench!)!.q + 1) as Quality;
          const id = rollItem(r, q, [o!.ench!], ORANGE_MAX);
          if (equipOf(id)?.q === 3) r.oranges.push(id);
          o!.ench = id;
          out = { ok: true, fx, bag: id };
        }
        break;
      case 'treasure':
        r.bankGold = (r.bankGold ?? 0) + 4;
        break;
      case 'quest':
        if (!QUESTS[choice]) return { ok: false };
        r.quest = { id: QUESTS[choice], n: 0 };
        r.questAct = r.act;
        break;
    }
  }
  r.event = null;
  return out;
}
