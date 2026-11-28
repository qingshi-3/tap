// v2 战斗引擎（排队战斗系统核心设计文档 v1.1 + CONTENT-DESIGN.md）的类型定义。
// 从 prototype/engine.js 移植，状态是纯数据（可 structuredClone）。
import type { API } from './engine';

export type Side = 0 | 1;
export type Lvl = 1 | 2 | 3;
export type Faction = 'shield' | 'blade' | 'abyss' | 'frost' | 'neutral' | 'enemy' | 'token';
export type Pos = 'front' | 'mid' | 'back';
export type HeroId = 'dispatcher' | 'pusher' | 'chrono';
export type Result = 'win' | 'lose' | 'draw';
export type Phase = 'setup' | 'start' | 'window' | 'round' | 'end';
export type TauntKind = 'all' | 'adjacent' | 'behind';

/** 开战时的一个单位：卡牌 id、等级，遭遇另带数值系数（scale 乘血量，atkScale 乘伤害，缺省同 scale） */
export interface UnitSpec {
  id: string;
  lvl?: Lvl;
  scale?: number;
  atkScale?: number;
}

export interface Unit {
  uid: number;
  side: Side;
  id: string;
  lvl: Lvl;
  scale: number;
  atkScale: number;
  atk: number;
  hp: number;
  maxHp: number;
  block: number;
  armor: number;
  shield: number;
  size: number;
  charge: number;
  combo: number;
  /** 冰冻剩余轮数（交锋中被冻为 2，本轮结束减 1） */
  stun: number;
  /** 解冻后的免疫轮数（不能连冻） */
  thaw: number;
  /** 被英雄迟滞冰冻的次数 */
  frozen: number;
  /** 围猎标记剩余轮数 */
  mark: number;
  /** 分支易伤比例与剩余轮数 */
  vuln: number;
  vulnRounds: number;
  /** 本轮临时攻击，回合末收回 */
  tmpAtk: number;
  uses: Record<string, number>;
  dead: boolean;
  summoned: boolean;
  obstacle: boolean;
  token: boolean;
  /** 吞噬得到的技能（卡牌 id） */
  extra: string[];
  /** 阵亡时在队列中的位置（亡语找"后邻"用） */
  deadIdx?: number;
}

export interface GraveEntry { id: string; lvl: Lvl; tier: number }

export interface Snapshot {
  lines: Array<Array<Pick<Unit, 'uid' | 'id' | 'lvl' | 'atk' | 'hp' | 'maxHp' | 'block' | 'shield' | 'armor' | 'charge' | 'size' | 'combo' | 'stun' | 'thaw' | 'mark' | 'vuln' | 'scale' | 'atkScale' | 'obstacle' | 'extra'>>>;
  energy: number;
  ultMeter: number;
  ultUsed: boolean;
  round: number;
}

/** 战斗日志：播放层只读日志，每条都带当时的快照 */
export interface LogEntry {
  t: string;
  round: number;
  snap: Snapshot;
  [k: string]: unknown;
}

export interface BattleState {
  seed: number;
  nextUid: number;
  units: Record<number, Unit>;
  lines: [number[], number[]];
  round: number;
  phase: Phase;
  result: Result | null;
  log: LogEntry[];
  energy: number;
  ultMeter: number;
  ultUsed: boolean;
  /** 整局技剩余次数（整局共享，由外部传入） */
  regroup: number;
  hero: HeroId;
  passiveUsed: boolean;
  heroActing: boolean;
  branches: string[];
  frontUid: [number, number];
  atomic: number;
  depth: number;
  reg: Record<string, 1>;
  grave: [GraveEntry[], GraveEntry[]];
  stats: { heroActions: number; refills: [number, number] };
  inClash?: boolean;
  redeploy?: boolean;
  /** 时停生效的轮次 */
  halt?: number;
}

export interface Payload {
  unit?: Unit;
  src?: Unit | null;
  target?: Unit;
  blockUsed?: boolean;
  amount?: number;
  side?: Side;
  why?: string;
}

export type Api = typeof API;
export type Hook = (s: BattleState, u: Unit, p: Payload, A: Api) => void;

export type EventName =
  | 'prep' | 'start' | 'beforeAttack' | 'hit' | 'blockConsumed' | 'damaged' | 'clashAttack' | 'afterClash'
  | 'enterFront' | 'sideRefill' | 'swapped' | 'redirected' | 'allyDeath' | 'death' | 'deathrattle'
  | 'summoned' | 'summonFail';

export interface CardDef {
  id: string;
  name: string;
  faction: Faction;
  tier: number;
  role: string;
  pos: Pos;
  atk: number;
  hp: number;
  art: string;
  artNote?: string;
  text: string;
  lv3: string;
  bridge?: string;
  size?: number;
  armor?: number;
  obstacle?: boolean;
  boss?: boolean;
  /** 解法提示（机制敌人） */
  answer?: string;
  intent?: (x: Snapshot['lines'][number][number]) => string;
  taunt?: (u: Unit) => TauntKind;
  share?: (u: Unit) => number;
  shatter?: boolean;
  resonance?: boolean;
  frostCast?: boolean;
  anchor?: boolean;
  expand?: (u: Unit) => number;
  charge?: (u: Unit) => number;
  fire?: (s: BattleState, u: Unit, A: Api) => void;
  insert?: (s: BattleState, u: Unit) => boolean;
  onInsert?: Hook;
  on?: Partial<Record<EventName, Hook>>;
}

export type SkillPick = 'ally1' | 'enemy1' | 'enemy2' | 'none';
export interface HeroSkill {
  hero: HeroId;
  name: string;
  /** 能量消耗；'ult' 表示奥义（独立充能） */
  cost: number | 'ult';
  pick: SkillPick;
  /** 整局技 */
  pre?: boolean;
  text: string;
}

export interface HeroAction { type: string; a?: number; b?: number }

export interface BattleOpts { regroup?: number; hero?: HeroId; branches?: string }
