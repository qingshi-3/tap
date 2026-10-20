// 规则层类型。core/ 下不允许依赖任何 DOM / 渲染代码，模拟器与 UI 共用。

export type Side = 0 | 1; // 0 = 玩家, 1 = 敌方
export type Faction = 'light' | 'shadow' | 'abyss' | 'magma' | 'frost' | 'desert' | 'neutral' | 'enemy';
export type ActiveFaction = Exclude<Faction, 'neutral' | 'enemy'>;
export type Rarity = 1 | 2 | 3 | 4;
/** 卡面主时机：只用于卡面标签与说明分组，规则以效果字段为准。 */
export type Trigger = 'cast' | 'start' | 'attack' | 'hurt' | 'kill' | 'faint' | 'ally' | 'beat' | 'passive' | 'none';
/** 一个持有个体只可能是一、二、三星；不能保存未配对的半成品。 */
export type Copies = 1 | 2 | 4;
export const isCopies = (copies: number): copies is Copies => copies === 1 || copies === 2 || copies === 4;

/** 按星级取值 [1★, 2★, 3★] */
export type Tri = [number, number, number];

/** 常驻特性（v0.6 §5.1）；数值按星级取。 */
export interface Traits {
  armor?: Tri;
  splash?: Tri;
  thorns?: Tri;
  /** 法强：友方施法的伤害、治疗、灼烧、寒意数值 +N */
  power?: Tri;
  combo?: boolean;
  snipe?: boolean;
  reborn?: boolean;
  /** 护卫：敌方单体指定效果选中相邻友军时改选自己 */
  guard?: boolean;
}

export type EffectOp = 'dmg' | 'heal' | 'block' | 'chill' | 'burn' | 'vuln' | 'buff' | 'grant' | 'summon' | 'extraAct' | 'addAction' | 'sacrifice';
export type EffectTarget =
  | 'self' | 'front' | 'rear' | 'allies' | 'adjacent' | 'behind' | 'ahead' | 'lowest' | 'highestAtk' | 'highestHp' | 'adjHighestAtk'
  | 'guardAllies'
  | 'enemyFront' | 'enemyRear' | 'enemyAll' | 'enemyNext' | 'enemyLowest' | 'enemyHighestAtk' | 'enemyHighestHp'
  | 'attacker' | 'target' | 'burningEnemies' | 'otherEnemies';
/** 布尔授予：snipe/combo/reborn/guard；数值授予（按 v 叠加）：splash/armor/power/thorns */
export type Grant = 'snipe' | 'combo' | 'reborn' | 'guard' | 'splash' | 'armor' | 'power' | 'thorns';

/** 声明式效果：引擎按 op 解释。v 为主数值，v2 为召唤/加血等的第二数值。 */
export interface Effect {
  op: EffectOp;
  to: EffectTarget;
  v?: Tri;
  v2?: Tri;
  grant?: Grant;
  token?: string;
  oncePerRound?: boolean;
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
  /** 本场施法次数上限，用完改普攻 */
  castUses?: number;
  onStart?: Effect[];
  afterAttack?: Effect[];
  onHurt?: Effect[];
  onKill?: Effect[];
  onFaint?: Effect[];
  onAllyFaint?: Effect[];
  onBeatEnd?: Effect[];
  /** onBeatEnd 只在每第 N 拍结束时触发 */
  beatEvery?: number;
  /** 复生复活时 */
  onRevive?: Effect[];
  /** 职能 + 机制标签（推荐算法、词条招募令） */
  tags?: string[];
  /** 首领 */
  boss?: boolean;
  /** 少量无法声明的专属逻辑，引擎按 id 处理 */
  special?: string;
  /** 仅由能力召唤，不进招募池 */
  token?: boolean;
  /** 不进招募池（敌方专属） */
  enemyOnly?: boolean;
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
  /** 技能说明（每第 3 拍结束） */
  text: string;
  /** 技能基础值 */
  base: number;
  /** 美术：一阶 / 二阶 */
  art: string;
  art2?: string;
}

/** 战斗里的主将：技能、法强、已获得的被动 */
export interface GeneralSetup {
  id: string;
  power: number;
  passives: string[];
}

export interface UnitGrants {
  snipe?: boolean;
  combo?: boolean;
  reborn?: boolean;
  guard?: boolean;
  armor?: number;
  splash?: number;
  power?: number;
  thorns?: number;
}

export interface UnitState {
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
  /** 易伤层数 */
  vuln: number;
  /** 复生已用 */
  revived: boolean;
  grants: UnitGrants;
  alive: boolean;
  /** 唤亡祭师等的剩余施法次数 */
  charges?: number;
  /** 本回合尚未消耗的常规行动。 */
  actionsLeft?: number;
  /** 当前护甲（含光环与位置条件），供 UI 显示 */
  armor?: number;
  /** 当前个人法强（含光环），供 UI 显示 */
  power?: number;
  /** 装备与培养（显示用） */
  equips?: string[];
  train?: Partial<Record<string, number>>;
}

export type Snap = UnitState[];

export type TriggerKind =
  | 'start' | 'cast' | 'afterAttack' | 'afterCast' | 'hurt' | 'kill' | 'faint' | 'allyFaint' | 'beatEnd' | 'aura' | 'general' | 'revive' | 'guard' | 'boss' | 'equip' | 'spell';

export type DmgKind = 'attack' | 'ability' | 'splash' | 'thorns' | 'burn' | 'fatigue';

export type BattleEvent =
  | { t: 'phase'; name: 'start' | 'battle' }
  | { t: 'beat'; n: number; round?: number; wave?: number; next: { player: number[]; enemy: number[] } }
  | { t: 'act'; side: Side; uid: number; mode: 'attack' | 'cast' | 'extra' }
  | { t: 'trigger'; src: number; side: Side; kind: TriggerKind; label: string; order?: number; general?: string }
  | { t: 'buff'; src?: number; tgt: number; atk: number; hp: number }
  | { t: 'heal'; src?: number; tgt: number; n: number }
  | { t: 'block'; src?: number; uid: number; n: number }
  | { t: 'blockBroken'; uid: number }
  | { t: 'chill'; src?: number; uid: number; n: number; total: number }
  | { t: 'burn'; src?: number; uid: number; n: number; total: number }
  | { t: 'vuln'; src?: number; uid: number; n: number; total: number }
  | { t: 'dmg'; src?: number; tgt: number; n: number; kind: DmgKind; blocked?: boolean; vuln?: number; chilled?: number }
  | { t: 'guard'; from: number; to: number }
  | { t: 'gen'; id: string; label: string; tgts: number[] }
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

export interface BattleOutput {
  result: BattleResult;
  beats: number;
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
}
