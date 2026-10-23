// 规则层类型。core/ 下不允许依赖任何 DOM / 渲染代码，模拟器与 UI 共用。
import type { BattleMetrics } from './battleStats';
export type { BattleMetrics } from './battleStats';

export type Side = 0 | 1; // 0 = 玩家, 1 = 敌方
export type Faction = 'light' | 'shadow' | 'abyss' | 'magma' | 'frost' | 'desert' | 'neutral' | 'enemy';
export type ActiveFaction = Exclude<Faction, 'neutral' | 'enemy'>;
export type Rarity = 1 | 2 | 3 | 4 | 5 | 6;
/** 卡面主时机：只用于卡面标签与说明分组，规则以效果字段为准。 */
export type Trigger =
  | 'cast' | 'start' | 'attack' | 'hurt' | 'kill' | 'rattle' | 'ally' | 'beat' | 'passive'
  | 'front' | 'rear' | 'duel' | 'charge' | 'pulse' | 'round' | 'none';
/** 一个持有个体只可能是一、二、三星；不能保存未配对的半成品。 */
export type Copies = 1 | 2 | 4;
export const isCopies = (copies: number): copies is Copies => copies === 1 || copies === 2 || copies === 4;

/** 按星级取值 [1★, 2★, 3★] */
export type Tri = [number, number, number];

/** 常驻特性（v0.8 §2）；数值按星级取。 */
export interface Traits {
  armor?: Tri;
  thorns?: Tri;
  /** 法强：自己施法（含蓄力技）的伤害、治疗、灼烧、寒意数值 +N */
  power?: Tri;
  /** 溅射：普攻时目标身后一名敌人受本次攻击力一半伤害 */
  splash?: boolean;
  combo?: boolean;
  snipe?: boolean;
  reborn?: boolean;
  /** 嘲讽：拦截紧邻身后友军受到的普攻 */
  taunt?: boolean;
  /** 轮换：常规行动后退到我方队尾 */
  rotate?: boolean;
  /** 决斗：普攻打本次交锋的对手 */
  duel?: boolean;
  /** 不行动 */
  idle?: boolean;
  /** 蓄力 N */
  charge?: number;
  /** 节拍 N */
  pulse?: number;
  /** 免疫灼烧 */
  burnImmune?: boolean;
}

export type EffectOp =
  | 'dmg' | 'heal' | 'block' | 'chill' | 'freeze' | 'burn' | 'buff' | 'weaken' | 'grant' | 'summon'
  | 'bonusAct' | 'extraAct' | 'addAction' | 'sacrifice' | 'charge' | 'rotate' | 'revive' | 'die';
export type EffectTarget =
  | 'spellAllies' | 'self' | 'front' | 'rear' | 'allies' | 'others' | 'adjacent' | 'behind' | 'ahead' | 'lowest' | 'highestAtk' | 'highestHp' | 'adjHighestAtk'
  | 'enemyFront' | 'enemyRear' | 'enemyAll' | 'enemyNext' | 'enemyLowest' | 'enemyHighestAtk' | 'enemyHighestHp'
  | 'attacker' | 'target' | 'opponent' | 'burningEnemies' | 'otherEnemies';
/** 布尔授予：snipe/combo/reborn/taunt/rotate/duel/splash；数值授予（按 v 叠加）：armor/power/thorns */
export type Grant = 'snipe' | 'combo' | 'reborn' | 'taunt' | 'rotate' | 'duel' | 'splash' | 'armor' | 'power' | 'thorns';

/** 声明式效果：引擎按 op 解释。v 为主数值，v2 为召唤/加血等的第二数值。 */
export interface Effect {
  op: EffectOp;
  to: EffectTarget;
  v?: Tri;
  v2?: Tri;
  /** dmg only: add this percentage of the source's current attack, rounded down at resolution. */
  sourceAttackPercent?: number;
  /** Numeric grant only: add this percentage of source maximum HP, rounded down. */
  sourceMaxHpPercent?: number;
  /** sacrifice only: recipient gains this percentage of victim current attack/max HP before death. */
  sacrificeStatPercent?: number;
  /** sacrifice only: recipient pursues after the death/deathrattle queue settles. */
  sacrificePursuit?: boolean;
  grant?: Grant;
  token?: string;
  /** 召唤数量 */
  count?: number;
  /** 召唤到我方队尾 */
  rear?: boolean;
  requireFodder?: boolean;
  /** buff 只持续到本回合结束 */
  temp?: boolean;
  oncePerRound?: boolean;
  /** Passive response group: first legal target event consumes one whole group per source/trigger/round, even on overflow. */
  responseGroup?: string;
  /** 每回合（同一来源）最多生效次数 */
  cap?: Tri;
  /** 每场（同一来源）最多生效次数 */
  capBattle?: Tri;
}

/** 蓄力技为强化普攻时的参数 */
export interface ChargeAttack {
  /** 伤害倍率 */
  mult?: number;
  bonus?: Tri;
  splash?: boolean;
  after?: Effect[];
}

/** Expedition growth uses raw stats, separately from refundable training points. */
export interface GrowthStats { atk?: number; hp?: number; power?: number }
export type PrepEvent = 'buy' | 'sell' | 'upgrade' | 'train' | 'endPrep';
export interface PrepEffect {
  event: PrepEvent;
  /** Self hooks travel with the traded unit; ally hooks require the source on the field. */
  scope: 'self' | 'ally';
  target: 'self' | 'event' | 'front' | 'rear' | 'others' | 'adjacent' | 'lowestAtk' | 'lowestHp';
  atk?: Tri;
  hp?: Tri;
  power?: Tri;
  /** Per owned source and effect, per preparation; defaults to 1. */
  cap?: number;
  /** Optional mechanic tag required on the event unit. */
  tag?: string;
  /** Filter benefit recipients independently of the event subject. */
  targetTag?: string;
}

export interface UnitDef {
  id: string;
  name: string;
  faction: Faction;
  atk: number;
  hp: number;
  tier: Rarity;
  trigger: Trigger;
  /** 卡面主数值（L1/L2/L3），用于 {v} 文案替换 */
  values?: Tri;
  /** 能力文案，{v} 替换为当前等级数值 */
  text: string;
  /** 每星完整文案；text 作后备。 */
  starText?: [string, string, string];
  /** 关键词：用于卡面标签与说明 */
  keywords?: string[];
  traits?: Traits;
  /** 施法：出手时执行，不普攻 */
  cast?: Effect[];
  /** 每次技能结算前锁定各效果目标；后续效果不因死亡或属性变化重新选人。 */
  lockTargets?: boolean;
  /** 本场施法次数上限（按星级），用完改普攻 */
  castUses?: Tri;
  /** 蓄力满时的蓄力技（按施法结算，吃法强） */
  chargeSkill?: Effect[];
  /** 蓄力满时改为强化普攻 */
  chargeAttack?: ChargeAttack;
  onStart?: Effect[];
  afterAttack?: Effect[];
  /** 自身成功轮换后响应新队列。 */
  onRotate?: Effect[];
  /** 被普攻命中后 */
  onAttacked?: Effect[];
  onHurt?: Effect[];
  onKill?: Effect[];
  /** 击败对手时 */
  onDuelKill?: Effect[];
  /** 亡语 */
  onRattle?: Effect[];
  onAllyFaint?: Effect[];
  /** 成为我方队首时 */
  onFront?: Effect[];
  /** 任一友军成为队首时 */
  onAllyFront?: Effect[];
  /** 每次交锋结束时位于队尾 */
  onRear?: Effect[];
  /** 友军召唤单位时 */
  onAllySummon?: Effect[];
  /** 任一敌人被冻结时 */
  onEnemyFreeze?: Effect[];
  onBeatEnd?: Effect[];
  /** 节拍触发 */
  onPulse?: Effect[];
  /** 每回合开始时 */
  onRoundStart?: Effect[];
  /** 复生复活时 */
  onRevive?: Effect[];
  /** 职能 + 机制标签（推荐算法、词条招募令） */
  tags?: string[];
  /** 首领 */
  boss?: boolean;
  /** 少量无法声明的专属逻辑，引擎按 id 处理 */
  special?: string;
  /** Buying/trading and committed preparation growth; never a battle trigger. */
  prep?: PrepEffect[];
  /** 仅由能力召唤，不进招募池 */
  token?: boolean;
  /** 不进招募池（敌方专属） */
  enemyOnly?: boolean;
  /** 主将专属单位（阿尔吉昂、龙蛋与龙）：不进招募池 */
  unique?: boolean;
}

/** 玩家阵容中的一格 */
export interface Slotted {
  defId: string;
  /** 局内个体身份；换位/合并目标保留，不能以defId代替。 */
  ownedId: number;
  copies: Copies;
  /** 培养点（按点数类型） */
  train?: Partial<Record<string, number>>;
  /** 已装备（通常 1 件，「双持」后 2 件） */
  equips?: string[];
  /** 赫克的临时佣兵：只参加本场 */
  temp?: boolean;
  /** Non-refundable expedition growth. Values are raw stats, not training points. */
  growth?: GrowthStats;
}

export const levelFromCopies = (copies: Copies): 1 | 2 | 3 => {
  if (!isCopies(copies)) throw new Error('非法星级份数：仅支持1、2、4');
  return copies === 4 ? 3 : copies === 2 ? 2 : 1;
};
export const unitLevel = (unit: { copies?: Copies; level?: number }): number =>
  unit.copies === undefined ? Math.max(1, Math.min(3, unit.level ?? 1)) : levelFromCopies(unit.copies);

/** 敌方阵容条目：允许按关卡覆盖数值 */
export interface EnemyEntry {
  defId: string;
  /** Override innate armor for this encounter; auras still apply. */
  armor?: number;
  atk?: number;
  hp?: number;
  level?: number;
  /** 开战时额外格挡层数 */
  block?: number;
}

export interface Lineup {
  /** 长度固定 5，index 0 = 队首 */
  slots: (Slotted | EnemyEntry | null)[];
}

export interface GeneralDef {
  id: string;
  name: string;
  title: string;
  faction: Faction;
  /** 核心技能名 */
  skill: string;
  /** 核心技能说明 */
  text: string;
  /** 技能基础值（文案里的「N+法强」中的 N） */
  base: number;
  /** 美术：一阶 / 二阶 */
  art: string;
  art2?: string;
}

/** 战斗里的主将：技能、法强、已获得的被动 */
export interface GeneralSetup {
  /** New expedition tactics; omission retains the legacy general contract. */
  tacticsVersion?: 1;
  /** Persistent owned identity chosen before battle; never a defId or battle UID. */
  commandTarget?: number;
  id: string;
  power: number;
  passives: string[];
}

export interface UnitGrants {
  snipe?: boolean;
  combo?: boolean;
  reborn?: boolean;
  taunt?: boolean;
  rotate?: boolean;
  duel?: boolean;
  splash?: boolean;
  armor?: number;
  power?: number;
  thorns?: number;
}

export interface UnitState {
  /** Shared team attack-hit progress, exposed on living masters only. */
  masterHits?: number;
  uid: number;
  defId: string;
  side: Side;
  slot: number;
  level: number;
  ownedId?: number;
  atk: number;
  hp: number;
  maxHp: number;
  /** 格挡层数 0–3 */
  block: number;
  chill: number;
  burn: number;
  /** 复生已用 */
  revived: boolean;
  grants: UnitGrants;
  alive: boolean;
  /** 剩余施法次数（castUses） */
  charges?: number;
  /** 蓄力层数 */
  charge?: number;
  /** 蓄力需求（含装备修正），供 UI 显示圆点 */
  chargeMax?: number;
  /** 节拍计数 */
  pulse?: number;
  /** 节拍阈值（含沙漏修正），供 UI 显示 */
  pulseMax?: number;
  /** 本回合临时攻击（回合结束时扣回） */
  tempAtk?: number;
  /** 本回合尚未消耗的常规行动。 */
  actionsLeft?: number;
  /** 当前护甲（含光环与位置条件），供 UI 显示 */
  armor?: number;
  /** 当前个人法强（含光环），供 UI 显示 */
  power?: number;
  /** 装备与培养（显示用） */
  equips?: string[];
  train?: Partial<Record<string, number>>;
  /** 召唤物 */
  summoned?: boolean;
  /** 临时佣兵 */
  temp?: boolean;
  /** 萨吉预备位（不在场上） */
  reserve?: boolean;
}

export type Snap = UnitState[];

export type TriggerKind =
  | 'start' | 'cast' | 'afterAttack' | 'afterCast' | 'attacked' | 'hurt' | 'kill' | 'duelKill' | 'rattle' | 'allyFaint'
  | 'front' | 'rear' | 'summon' | 'freeze' | 'charge' | 'pulse' | 'roundStart'
  | 'beatEnd' | 'aura' | 'general' | 'revive' | 'boss' | 'equip' | 'spell';

export type DmgKind = 'attack' | 'ability' | 'splash' | 'thorns' | 'burn' | 'fatigue';

export type BattleEvent =
  | { t: 'rule'; id: string; label: string; side: Side; src?: number; provider?: number }
  | { t: 'phase'; name: 'start' | 'battle' }
  | { t: 'beat'; n: number; round?: number; wave?: number; next: { player: number[]; enemy: number[] } }
  | { t: 'act'; side: Side; uid: number; mode: 'attack' | 'cast' | 'extra' | 'charge' }
  | { t: 'trigger'; src: number; side: Side; kind: TriggerKind; label: string; order?: number; general?: string }
  | { t: 'buff'; src?: number; tgt: number; atk: number; hp: number }
  | { t: 'heal'; src?: number; tgt: number; n: number }
  | { t: 'block'; src?: number; uid: number; n: number }
  | { t: 'blockBroken'; uid: number }
  | { t: 'chill'; src?: number; uid: number; n: number; total: number }
  | { t: 'burn'; src?: number; uid: number; n: number; total: number }
  | { t: 'charge'; src?: number; uid: number; n: number; total: number }
  | { t: 'dmg'; src?: number; tgt: number; n: number; kind: DmgKind; blocked?: boolean; chilled?: number }
  | { t: 'taunt'; from: number; to: number }
  | { t: 'gen'; id: string; label: string; tgts: number[] }
  /** 主将计数（魂、星能）变化 */
  | { t: 'genCount'; id: string; n: number; max: number }
  /** 队列位移：轮换、插入、换位、补位 */
  | { t: 'move'; side: Side; moves: { uid: number; from: number; to: number }[] }
  | { t: 'recall'; uid: number; src: number }
  | { t: 'attack'; pairs: { atk: number; tgt: number; chill?: number }[] }
  | { t: 'death'; tgt: number; exiled?: boolean }
  | { t: 'revive'; uid: number }
  | { t: 'summon'; uid: number; src?: number }
  | { t: 'pull'; uid: number; src?: number }
  | { t: 'frozenSkip'; uid: number }
  | { t: 'actionGain'; src?: number; uid: number; n: number; total: number }
  | { t: 'sacrifice'; src: number; tgt: number }
  | { t: 'fizzle'; src: number; reason: string }
  | { t: 'end'; result: BattleResult; beats: number };

export type BattleResult = 'win' | 'lose' | 'draw';

export interface LoggedEvent {
  ev: BattleEvent;
  snap: Snap;
}

/** 星角龙蛋的 5 类事件 */
export type EggStat = 'death' | 'burn' | 'freeze' | 'move' | 'summon';

export interface BattleOutput {
  /** 玩家侧单场指标，与日志录制无关；交锋数见 beats。 */
  metrics?: BattleMetrics;
  result: BattleResult;
  beats: number;
  /** 结束时所在回合；开战阶段取胜为 0 */
  rounds?: number;
  log: LoggedEvent[];
  /** 开战阶段结束后的快照（备战预览用） */
  afterStart: Snap;
  initial: Snap;
  /** 故障保护：UI必须返回战前，不可把占位result结算为平局。 */
  fault?: string;
  /** 各卡能力触发次数（按 defId） */
  triggers?: Record<string, number>;
  /** 战斗中获得的金币（赫克专属被动） */
  gold?: number;
  /** 星角：本场龙蛋事件计数 */
  eggStats?: Record<EggStat, number>;
}

/** Immutable encounter configuration; counters belong to each Battle instance/source. */
export type BattleRuleEffect =
  | { op: 'pullRearToFront'; oncePerTarget?: boolean; blockedBy?: string }
  | { op: 'chillHighestAttack' }
  | { op: 'recall'; hpRatio: number }
  | { op: 'buff'; to: 'allies' | 'source' | 'recalled'; atk: number; hp?: number }
  | { op: 'block'; to: 'allies' | 'source' | 'recalled'; amount: number };
export interface BattleRule {
  id: string;
  label: string;
  /** Intrinsic abilities already emit their existing boss feedback. */
  intrinsic?: boolean;
  side: Side;
  source?: { side: Side; defId: string };
  trigger: { on: 'beatEnd'; every: number } | { on: 'hpBelow'; ratio: number } | { on: 'afterRecall' };
  maxTriggers?: number;
  effects: readonly BattleRuleEffect[];
}
