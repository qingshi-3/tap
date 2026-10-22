import { INTRINSIC_BOSS_RULES } from './encounterRules';
import { emptyBattleMetrics } from './battleStats';
import { effectAmount } from './power';
import { unitDef } from './data';
import { EQUIP_MAP, GENERAL_MAP, POINT_MAP, type EquipDef } from './content';
import { unitLevel } from './types';
import type {
  BattleRule, BattleRuleEffect, BattleEvent, BattleOutput, BattleResult, ChargeAttack, DmgKind, Effect, EggStat, EnemyEntry, GeneralSetup, Grant, LoggedEvent,
  Side, Slotted, Snap, Tri, TriggerKind, UnitDef, UnitState,
} from './types';

export const SLOTS = 5;
export const MAX_BEATS = 60;
/** 第 N 次交锋起每次交锋结束双方全体受（交锋数 − N + 1）点狂暴伤害，防止治疗互耗 */
export const FATIGUE_BEAT = 20;
export const MAX_EVENTS = 6000;
/** 单次交锋内响应（触发效果）上限，防止无限连锁 */
export const MAX_RESPONSES = 240;
export const MAX_BLOCK = 3;
export interface BattleSetup {
  player: (Slotted | EnemyEntry | null)[];
  enemy: (EnemyEntry | null)[];
  general?: GeneralSetup | null;
  /** 本场生效的一次性法术 */
  spells?: readonly string[];
  /** 当前章节（阿尔吉昂亲征按章成长） */
  chapter?: number;
  /** 蕾娃：开战前交换的敌方格位 */
  swaps?: readonly (readonly [number, number])[];
  /** 萨吉：预备位单位，按顺序补位 */
  reserve?: readonly (Slotted | null)[];
  /** 兼容旧调用；不再使用 */
  bench?: number;
  seed?: number;
  record?: boolean;
  rules?: readonly BattleRule[];
}
export const levelStats = (defId: string, level: number) => {
  const d = unitDef(defId), up = Math.max(0, Math.min(2, level - 1));
  return { atk: d.atk === 0 ? 0 : d.atk + up, hp: d.hp + up * 2 };
};
export const abilityValue = (defId: string, level: number) => unitDef(defId).values?.[level - 1] ?? 0;
export const tri = (t: Tri | undefined, level: number) => t?.[Math.max(1, Math.min(3, level)) - 1] ?? 0;

const LABEL: Record<TriggerKind, string> = {
  start: '开战', cast: '施法', afterAttack: '普攻后', afterCast: '施法后', attacked: '被普攻', hurt: '受击', kill: '击杀',
  duelKill: '击败对手', rattle: '亡语', allyFaint: '友军阵亡', front: '成为队首', rear: '在队尾', summon: '友军召唤',
  freeze: '敌人冻结', charge: '蓄力技', pulse: '节拍', roundStart: '回合开始', beatEnd: '交锋后', aura: '被动',
  general: '主将', revive: '复活', boss: '首领', equip: '装备', spell: '法术',
};
const BOOL_GRANTS = new Set<Grant>(['snipe', 'combo', 'reborn', 'taunt', 'rotate', 'duel', 'splash']);
type BoolTrait = 'snipe' | 'combo' | 'reborn' | 'taunt' | 'rotate' | 'duel' | 'splash';
const DRAGONS = new Set(['x_bone', 'x_fire', 'x_frostd', 'x_wind', 'x_brood']);
/** 特性 / 授予 → 卡拉统计用的关键词 */
const GRANT_KW: Record<string, string> = {
  snipe: '狙击', combo: '连击', reborn: '复生', taunt: '嘲讽', rotate: '轮换', duel: '决斗', splash: '溅射', armor: '护甲', power: '法强', thorns: '反击',
};

interface Ctx { target?: UnitState; attacker?: UnitState; slot?: number; cast?: boolean; inherit?: number }
interface ActOpts { force?: boolean; snipe?: boolean }
interface SummonOpts { rear?: boolean; inherit?: number; after?: UnitState }
class CombatFault extends Error {}

/**
 * 每回合每单位默认一次常规行动；双方每次交锋至多一人，同一行动轮每人至多一次。
 * 一方用完等待，双方本轮结束才发放下一行动轮；全部次数耗尽进入新回合。
 * 先施法后普攻，普攻双方同时结算；触发效果进入 FIFO 队列，死亡在每个响应之间统一结算。
 * 常规行动后：蓄力 → 主将压轴 → 轮换。交锋结束：首领规则 → 灼烧 → 疲劳 → 交锋后 → 节拍 → 在队尾时 → 主将。
 */
export class Battle {
  readonly metrics = emptyBattleMetrics();
  units: UnitState[] = [];
  grid: (number | null)[][] = [Array(SLOTS).fill(null), Array(SLOTS).fill(null)];
  log: LoggedEvent[] = [];
  record: boolean;
  gen: GeneralSetup | null;
  beat = 0;
  round = 1;
  wave = 1;
  private waveUsed = new Set<number>();
  private actionGrants = new Map<number, Set<Effect>>();
  private constructing = true;
  /** 各卡能力触发次数（按 defId），模拟器统计用 */
  triggers: Record<string, number> = {};
  ptr: [number, number] = [0, 0];
  gold = 0;
  readonly eggStats: Record<EggStat, number> = { death: 0, burn: 0, freeze: 0, move: 0, summon: 0 };
  private passives: Set<string>;
  private spells: Set<string>;
  private chapter: number;
  private queue: { job: () => void; chain: number }[] = [];
  private killers = new Map<number, UnitState | undefined>();
  private killKind = new Map<number, DmgKind>();
  /** 致死伤害发生时的追击层数：阵亡引发的效果沿用它 */
  private deathChain = new Map<number, number>();
  private pending: (UnitState | null)[] = [null, null];
  /** 本次交锋双方的常规出手者：决斗的「对手」 */
  private actors: (UnitState | null)[] = [null, null];
  /** 当前效果来源链上的追击层数；追击只能由层数低于上限的效果引发 */
  private chain = 0;
  private rules: { rule: BattleRule; source?: number; count: number; pulled: Set<number> }[] = [];
  private equipsOf = new Map<number, EquipDef[]>();
  private cliffBeat = new Map<number, number>();
  private titanBeat = new Map<number, number>();
  private frontBeat = new Map<number, number>();
  private lastFront: (number | null)[] = [null, null];
  private capRound = new Map<Effect, Map<number, number>>();
  private capBattle = new Map<Effect, Map<number, number>>();
  private specialRound = new Map<string, number>();
  private surgeUsed = new Set<number>();
  private exiled = new Set<number>();
  private deathOrder: UnitState[] = [];
  private reserve: UnitState[] = [];
  private freeRevives = 0;
  private morale = 0;
  private wyvernBeat = new Map<number, number>();
  // 主将状态
  private argeonSaved = false;
  private souls = 0;
  private lilitheRevives = 0;
  private stars = 0;
  private kasivaVictims = new Set<number>();
  private zilanSpins = 0;
  private zilanPending = new Map<number, number>();
  private kFirst = false;
  private kLast = false;
  private kSecond = false;
  private revaMoved = new Set<number>();
  private revaFront: number | null = null;
  private isolated = new Set<number>();
  private delayFoe = new Set<number>();
  private delayLast = new Set<number>();
  private soulUsed = false;
  private rattleUsed = false;
  private reserveGain = new Map<number, number>();

  private nextUid = 1;
  private events = 0;
  private responses = 0;

  constructor(setup: BattleSetup) {
    this.record = setup.record !== false;
    this.gen = setup.general && GENERAL_MAP[setup.general.id] ? setup.general : null;
    this.passives = new Set(this.gen?.passives ?? []);
    this.spells = new Set(setup.spells ?? []);
    this.chapter = Math.max(1, setup.chapter ?? 1);
    for (const side of [0, 1] as Side[]) {
      const entries = side === 0 ? setup.player : setup.enemy;
      entries.slice(0, SLOTS).forEach((entry, slot) => {
        if (!entry) return;
        const u = this.spawn(side, slot, entry.defId, unitLevel(entry));
        this.prepare(u, entry);
      });
    }
    if (this.gen?.id === 'sajj') for (const entry of (setup.reserve ?? []).slice(0, this.reserveCap())) {
      if (!entry) continue;
      const u = this.spawn(0, null, entry.defId, unitLevel(entry));
      u.reserve = true;
      this.prepare(u, entry);
      this.reserve.push(u);
    }
    // 蕾娃：开战前交换敌方格位
    if (this.gen?.id === 'reva' && setup.swaps?.length) {
      for (const [a, b] of setup.swaps.slice(0, this.passives.has('reva_1') ? 2 : 1)) {
        if (a === b || a < 0 || b < 0 || a >= SLOTS || b >= SLOTS) continue;
        const ua = this.grid[1][a], ub = this.grid[1][b];
        if (ua == null && ub == null) continue;
        this.grid[1][a] = ub; this.grid[1][b] = ua;
        if (ua != null) { this.u(ua).slot = b; this.revaMoved.add(ua); }
        if (ub != null) { this.u(ub).slot = a; this.revaMoved.add(ub); }
      }
      const team = this.standing(1);
      if (team[0] && this.revaMoved.has(team[0].uid)) this.revaFront = team[0].uid;
      const rear = team.at(-1);
      if (rear && team.length > 1 && this.revaMoved.has(rear.uid) && this.passives.has('reva_4')) this.isolated.add(rear.uid);
    }
    for (const rule of [...INTRINSIC_BOSS_RULES, ...(setup.rules ?? [])]) {
      if (rule.source) {
        for (const u of this.units.filter(u => u.side === rule.source!.side && u.defId === rule.source!.defId))
          this.rules.push({ rule, source: u.uid, count: 0, pulled: new Set() });
      } else this.rules.push({ rule, count: 0, pulled: new Set() });
    }
    // 本场生效、开战前就决定的数值
    for (const u of this.units) {
      if (u.side === 0 && this.spells.has('sp_warsong')) u.atk += 2;
      if (u.side === 1 && this.spells.has('sp_sunder')) u.grants.armor = (u.grants.armor ?? 0) - 2;
    }
    if (this.spells.has('sp_revive')) this.freeRevives++;
    if (this.passives.has('g_revive')) this.freeRevives++;
    this.constructing = false;
    this.refreshArmor();
  }

  /** 入场前的个体修正：覆盖数值、培养、装备、主将专属单位 */
  private prepare(u: UnitState, entry: Slotted | EnemyEntry) {
    const P = this.gen?.power ?? 0, has = (k: string) => this.passives.has(k);
    if (u.side === 0 && u.defId === 'x_argeon') {
      u.atk += this.chapter - 1; u.hp += 3 * (this.chapter - 1); u.maxHp = u.hp;
      if (this.gen?.id === 'argeon') {
        if (has('argeon_1')) u.grants.taunt = true;
        if (has('argeon_2')) { u.grants.duel = true; u.grants.combo = true; }
        if (has('argeon_4')) u.grants.rotate = true;
      }
    }
    if (u.side === 0 && this.gen?.id === 'xingjiao') {
      if (u.defId === 'x_egg' && has('xingjiao_4')) { u.grants.taunt = true; u.grants.armor = (u.grants.armor ?? 0) + 2; }
      if (DRAGONS.has(u.defId) && has('xingjiao_3')) { u.atk += P; u.hp += 2 * P; u.maxHp += 2 * P; }
    }
    if ('ownedId' in entry) {
      u.ownedId = entry.ownedId;
      if (entry.temp) u.temp = true;
      this.outfit(u, entry);
    }
    const e = entry as EnemyEntry;
    if (e.atk !== undefined) u.atk = Math.max(1, e.atk);
    if (e.hp !== undefined) u.hp = u.maxHp = e.hp;
    if (e.block) u.block = Math.min(MAX_BLOCK, e.block);
    const cm = this.chargeMax(u);
    if (cm) { u.charge = 0; u.chargeMax = cm; }
  }

  /** 培养点与装备：开战前直接结算到身材与特性上 */
  private outfit(u: UnitState, s: Slotted) {
    if (s.train) {
      u.train = { ...s.train };
      for (const [k, n] of Object.entries(s.train)) if (n && POINT_MAP[k]) POINT_MAP[k].apply(u, n);
    }
    const eqs = (s.equips ?? []).map((id) => EQUIP_MAP[id]).filter(Boolean);
    if (!eqs.length) return;
    u.equips = eqs.map((e) => e.id);
    this.equipsOf.set(u.uid, eqs);
    for (const e of eqs) {
      u.atk = Math.max(this.minAtk(u), u.atk + (e.atk ?? 0));
      if (e.hp) { u.hp += e.hp; u.maxHp += e.hp; }
      for (const [k, v] of Object.entries(e.grants ?? {}) as [Grant, number | boolean][]) {
        if (BOOL_GRANTS.has(k)) (u.grants as Record<string, unknown>)[k] = true;
        else (u.grants as Record<string, number>)[k] = ((u.grants as Record<string, number>)[k] ?? 0) + (v as number);
      }
    }
  }

  // ---------- 查询 ----------
  u(uid: number) { return this.units[uid - 1]; }
  at(side: Side, slot: number): UnitState | null {
    if (slot < 0 || slot >= SLOTS) return null;
    const uid = this.grid[side][slot];
    const u = uid == null ? undefined : this.u(uid);
    return u?.alive ? u : null;
  }
  living(side: Side) { return this.grid[side].map((_, s) => this.at(side, s)).filter((u): u is UnitState => !!u); }
  /** 仍可被选为目标的单位（濒死未结算的不算） */
  standing(side: Side) { return this.living(side).filter(u => u.hp > 0); }
  front(side: Side) { return this.standing(side)[0] ?? null; }
  rear(side: Side) { return this.standing(side).at(-1) ?? null; }
  static cmp(a: UnitState, b: UnitState) { return a.slot - b.slot || a.side - b.side || a.uid - b.uid; }
  snap(): Snap { this.refreshArmor(); return this.units.map(u => ({ ...u, grants: { ...u.grants } })); }
  def(u: UnitState): UnitDef { return unitDef(u.defId); }
  private onField(u: UnitState) { return u.alive && u.hp > 0 && !u.reserve && this.grid[u.side][u.slot] === u.uid; }
  private minAtk(u: UnitState) { return this.def(u).atk === 0 ? 0 : 1; }
  isIdle(u: UnitState) { return !!this.def(u).traits?.idle; }

  /** 当前行动轮可出手者（未计推迟）。 */
  private raw(side: Side): UnitState[] {
    return this.standing(side).filter(u => (u.actionsLeft ?? 0) > 0 && !this.waveUsed.has(u.uid) && !this.isIdle(u));
  }
  /** 当前行动轮仍可出手的单位，按实际位置排列；先机推迟的单位等对方出手完毕。 */
  order(side: Side): UnitState[] {
    const raw = this.raw(side);
    if (!this.delayFoe.size && !this.delayLast.size) return raw;
    const foeFree = this.raw((1 - side) as Side).some(x => !this.delayFoe.has(x.uid));
    return raw.filter(u => !(this.delayFoe.has(u.uid) && foeFree) && !(this.delayLast.has(u.uid) && raw.some(o => o !== u && !this.delayLast.has(o.uid))));
  }
  /** 只读预测：当前轮、额外轮、下回合；不会为等待方重新派发。 */
  private futureOrder(side: Side): UnitState[] {
    const st = this.standing(side).filter(u => !this.isIdle(u)), now = this.order(side);
    const later = st.filter(u => (u.actionsLeft ?? 0) > 0 && !now.includes(u));
    return [...now, ...later, ...st.filter(u => !now.includes(u) && !later.includes(u))];
  }
  /** 本行动轮用完时派发下一轮；全部耗尽则结束回合。返回是否进入新回合。 */
  private prepareWave(): boolean {
    if (this.order(0).length || this.order(1).length) return false;
    this.waveUsed.clear();
    const left = (side: Side) => this.standing(side).some(u => (u.actionsLeft ?? 0) > 0 && !this.isIdle(u));
    if (left(0) || left(1)) { this.wave++; return false; }
    this.roundEnd();
    this.round++; this.wave = 1; this.actionGrants.clear(); this.capRound.clear(); this.specialRound.clear();
    for (const u of this.units) {
      if (u.tempAtk) { u.atk = Math.max(this.minAtk(u), u.atk - u.tempAtk); u.tempAtk = 0; }
      u.actionsLeft = u.alive && u.hp > 0 && !this.isIdle(u) ? 1 : 0;
    }
    return true;
  }
  addAction(src: UnitState | undefined, t: UnitState, n: number) {
    if (!t.alive || t.hp <= 0 || n <= 0 || this.isIdle(t)) return;
    t.actionsLeft = (t.actionsLeft ?? 0) + n;
    this.emit({ t: 'actionGain', src: src?.uid, uid: t.uid, n, total: t.actionsLeft });
  }
  armor(u: UnitState) {
    const d = this.def(u);
    let a = tri(d.traits?.armor, u.level) + (u.grants.armor ?? 0);
    if (u.reserve) return Math.max(0, a);
    if (d.special === 'keeper' && this.front(u.side)?.uid === u.uid) a += tri(d.values, u.level);
    for (const n of this.neighbors(u)) if (this.def(n).special === 'conduit') a += tri(this.def(n).values, n.level);
    return Math.max(0, a);
  }
  /** 个人法强：卡面 + 培养 + 装备 + 相邻光环，只强化自己的施法 */
  power(u: UnitState) {
    let p = tri(this.def(u).traits?.power, u.level) + (u.grants.power ?? 0);
    if (u.reserve) return p;
    for (const n of this.neighbors(u)) if (this.def(n).special === 'brood') p += tri(this.def(n).values, n.level);
    const before = this.standing(u.side).filter(x => x.slot < u.slot).at(-1);
    if (before && this.def(before).special === 'nobelisk') p += tri(this.def(before).values, before.level);
    return p;
  }
  thorns(u: UnitState) { return tri(this.def(u).traits?.thorns, u.level) + (u.grants.thorns ?? 0); }
  hasTrait(u: UnitState, k: BoolTrait) { return !!(this.def(u).traits?.[k] || u.grants[k]); }
  private hasEquip(u: UnitState, special: EquipDef['special']) { return !!this.equipsOf.get(u.uid)?.some(e => e.special === special); }
  private hourglasses(u: UnitState) { return u.reserve ? 0 : this.neighbors(u).filter(n => this.def(n).special === 'hourglass').length; }
  private chargeMax(u: UnitState) {
    const c = this.def(u).traits?.charge;
    return c ? Math.max(1, c - (this.hasEquip(u, 'hourglass') ? 1 : 0)) : 0;
  }
  private pulseMax(u: UnitState) {
    const p = this.def(u).traits?.pulse;
    return p ? Math.max(1, p - this.hourglasses(u)) : 0;
  }
  private hp1(side: Side) { return this.standing(side).sort((a, b) => a.hp - b.hp || Battle.cmp(a, b))[0] ?? null; }
  private atk1(side: Side, except?: number) {
    return this.standing(side).filter(x => x.uid !== except).sort((a, b) => b.atk - a.atk || Battle.cmp(a, b))[0] ?? null;
  }
  private hpTop(side: Side, except?: number) {
    return this.standing(side).filter(x => x.uid !== except).sort((a, b) => b.hp - a.hp || Battle.cmp(a, b))[0] ?? null;
  }

  private neighbors(u: UnitState, slot = u.slot) {
    const st = this.standing(u.side).filter(x => x.uid !== u.uid);
    const before = st.filter(x => x.slot < slot).at(-1), after = st.find(x => x.slot > slot);
    return [before, after].filter((x): x is UnitState => !!x);
  }
  private refreshArmor() {
    for (const u of this.units) if (u.alive) {
      u.armor = this.armor(u); u.power = this.power(u);
      const pm = this.pulseMax(u); if (pm) { u.pulseMax = pm; u.pulse ??= 0; }
    }
  }
  private spawn(side: Side, slot: number | null, defId: string, level: number) {
    const st = levelStats(defId, level), d = unitDef(defId);
    const u: UnitState = {
      uid: this.nextUid++, defId, side, slot: slot ?? -1, level, atk: d.atk === 0 ? 0 : Math.max(1, st.atk), hp: st.hp, maxHp: st.hp,
      actionsLeft: this.constructing && !d.traits?.idle ? 1 : 0, block: 0, chill: 0, burn: 0, revived: false, grants: {}, alive: true,
      ...(d.castUses ? { charges: tri(d.castUses, level) } : {}),
    };
    this.units.push(u);
    if (slot != null) this.grid[side][slot] = u.uid;
    return u;
  }
  private emit(ev: BattleEvent) {
    if (++this.events > MAX_EVENTS) throw new CombatFault('事件超过上限');
    if (this.record) { this.log.push({ ev, snap: this.snap() }); }
  }
  private label(u: UnitState, kind: TriggerKind) {
    if (kind !== 'general') this.triggers[u.defId] = (this.triggers[u.defId] ?? 0) + 1;
    this.emit({ t: 'trigger', src: u.uid, side: u.side, kind, label: LABEL[kind] });
  }
  private genShow(label: string, tgts: (UnitState | null | undefined)[]) {
    if (!this.gen) return;
    this.emit({ t: 'gen', id: this.gen.id, label, tgts: tgts.filter((x): x is UnitState => !!x).map(x => x.uid) });
  }
  private enqueue(job: () => void) { this.queue.push({ job, chain: this.chain }); }
  private flush() {
    for (;;) {
      this.reap();
      this.checkFront();
      const item = this.queue.shift();
      if (!item) break;
      if (++this.responses > MAX_RESPONSES) throw new CombatFault('响应超过上限');
      const prev = this.chain;
      this.chain = item.chain;
      try { item.job(); } finally { this.chain = prev; }
    }
  }
  private specialCount(key: string) { return this.specialRound.get(key) ?? 0; }
  private specialUse(key: string, cap: number) {
    const n = this.specialCount(key);
    if (n >= cap) return false;
    this.specialRound.set(key, n + 1);
    return true;
  }

  // ---------- 站位 ----------
  /** 重新排列一侧：人数不变时沿用原格位，否则压紧到 0..n-1。 */
  private layout(side: Side, ordered: UnitState[]) {
    if (ordered.length > SLOTS) throw new CombatFault('站位超过上限');
    const current = this.living(side);
    const same = current.length === ordered.length && ordered.every(u => current.includes(u));
    const slots = same ? current.map(u => u.slot).sort((a, b) => a - b) : ordered.map((_, i) => i);
    const moves: { uid: number; from: number; to: number }[] = [];
    this.grid[side].fill(null);
    ordered.forEach((u, i) => {
      if (current.includes(u) && u.slot !== slots[i]) moves.push({ uid: u.uid, from: u.slot, to: slots[i] });
      u.slot = slots[i]; this.grid[side][slots[i]] = u.uid;
    });
    if (moves.length) this.emit({ t: 'move', side, moves });
    return moves.length > 0;
  }
  private moved(side: Side) {
    // 齐瑞克斯「轨迹」：任何一方换位（轮换、换位、星轨、齐兰轮转）都给全体友军 +1 攻
    if (this.passives.has('zirix_2')) this.enqueue(() => {
      const ours = this.standing(0);
      if (!ours.length) return;
      this.genShow('轨迹', ours);
      for (const a of ours) this.buff(undefined, a, 1, 0);
    });
    if (side !== 0) return;
    this.metrics.rotations++; this.eggStats.move++;
  }
  /** 友军轮换后：圣铸机兵给新队首加成 */
  private afterRotate(side: Side) {
    this.moved(side);
    for (const c of this.standing(side)) if (this.def(c).special === 'caliber') {
      const v = tri(this.def(c).values, c.level);
      this.enqueue(() => {
        const f = this.front(side);
        if (!f || !c.alive || c.hp <= 0 || !this.specialUse(`caliber${c.uid}`, 3)) return;
        this.label(c, 'aura'); this.buff(c, f, v, v);
      });
    }
  }
  private rotateToRear(u: UnitState) {
    const team = this.living(u.side);
    if (team.length < 2 || !team.includes(u) || team.at(-1) === u) return false;
    this.layout(u.side, [...team.filter(x => x !== u), u]);
    this.afterRotate(u.side);
    return true;
  }
  private swapUnits(a: UnitState, b: UnitState) {
    const team = this.living(a.side), i = team.indexOf(a), j = team.indexOf(b);
    if (i < 0 || j < 0 || i === j) return false;
    team[i] = b; team[j] = a;
    this.layout(a.side, team);
    this.moved(a.side);
    return true;
  }
  /** 成为队首时：每次交锋每单位最多一次 */
  private checkFront() {
    for (const side of [0, 1] as Side[]) {
      const f = this.front(side);
      if (!f || f.uid === this.lastFront[side]) continue;
      this.lastFront[side] = f.uid;
      if (this.frontBeat.get(f.uid) === this.beat) continue;
      this.frontBeat.set(f.uid, this.beat);
      const d = this.def(f);
      if (d.onFront) this.enqueue(() => this.respond(f, 'front', d.onFront!, {}));
      for (const a of this.standing(side)) {
        const ad = this.def(a);
        if (ad.onAllyFront) this.enqueue(() => this.respond(a, 'front', ad.onAllyFront!, { target: f }));
      }
      if (side === 0 && this.passives.has('g_relay')) this.enqueue(() => { if (f.alive && f.hp > 0) { this.label(f, 'general'); this.buff(undefined, f, 1, 0, true); } });
      if (side === 0 && f.defId === 'x_argeon' && this.passives.has('argeon_4'))
        this.enqueue(() => { this.genShow('王誓', this.standing(0)); for (const a of this.standing(0)) this.block(undefined, a, 1); });
    }
  }

  // ---------- 原子效果 ----------
  buff(src: UnitState | undefined, t: UnitState, atk: number, hp: number, temp = false) {
    if (!t.alive || t.hp <= 0 || (!atk && !hp)) return;
    if ((atk > 0 || hp > 0) && src && src.side === t.side && this.isolated.has(t.uid)) return;
    const before = t.atk;
    t.atk = Math.max(this.minAtk(t), t.atk + atk); t.hp += hp; t.maxHp += hp;
    if (t.hp <= 0) t.hp = 1;
    if (temp) t.tempAtk = (t.tempAtk ?? 0) + (t.atk - before);
    this.emit({ t: 'buff', src: src?.uid, tgt: t.uid, atk, hp });
  }
  heal(src: UnitState | undefined, t: UnitState, n: number) {
    n = Math.min(n, t.maxHp - t.hp); if (!t.alive || t.hp <= 0 || n <= 0) return;
    if (src && src.side === t.side && this.isolated.has(t.uid)) return;
    if (t.side === 0 && (!src || src.side === 0)) this.metrics.healing += n;
    t.hp += n; this.emit({ t: 'heal', src: src?.uid, tgt: t.uid, n });
  }
  block(src: UnitState | undefined, t: UnitState, n: number) {
    if (!t.alive || t.hp <= 0 || n <= 0) return;
    const add = Math.min(n, MAX_BLOCK - t.block); if (add <= 0) return;
    t.block += add; this.emit({ t: 'block', src: src?.uid, uid: t.uid, n: add });
  }
  chill(src: UnitState | undefined, t: UnitState, n: number) {
    if (t.side === 0 && this.spells.has('sp_purify')) n -= 2;
    if (!t.alive || t.hp <= 0 || n <= 0) return;
    t.chill += n; this.emit({ t: 'chill', src: src?.uid, uid: t.uid, n, total: t.chill });
  }
  burn(src: UnitState | undefined, t: UnitState, n: number) {
    if (!t.alive || t.hp <= 0 || n <= 0 || this.def(t).traits?.burnImmune) return;
    t.burn += n; this.emit({ t: 'burn', src: src?.uid, uid: t.uid, n, total: t.burn });
  }
  private addCharge(src: UnitState | undefined, t: UnitState, n: number) {
    const max = t.chargeMax ?? 0;
    if (!max || n <= 0 || !t.alive) return;
    const add = Math.min(n, max - (t.charge ?? 0)); if (add <= 0) return;
    t.charge = (t.charge ?? 0) + add;
    this.emit({ t: 'charge', src: src?.uid, uid: t.uid, n: add, total: t.charge });
  }
  private grant(src: UnitState | undefined, t: UnitState, g: Grant, v: number) {
    if (!t.alive || t.hp <= 0) return;
    if (BOOL_GRANTS.has(g)) {
      if (t.grants[g as BoolTrait]) return;
      (t.grants as Record<string, unknown>)[g] = true;
    } else {
      if (!v) return;
      if (v > 0 && src && src.side === t.side && this.isolated.has(t.uid)) return;
      (t.grants as Record<string, number>)[g] = ((t.grants as Record<string, number>)[g] ?? 0) + v;
    }
    this.emit({ t: 'buff', src: src?.uid, tgt: t.uid, atk: 0, hp: 0 });
  }

  /**
   * 伤害管线：格挡 → 护甲（最少 1）→ 其他减伤 → 扣血 → 受击时。
   * 灼烧、疲劳跳过格挡与护甲。返回是否命中（含被格挡）。
   */
  hit(src: UnitState | undefined, t: UnitState, n: number, kind: DmgKind, spell = false): boolean {
    if (!t.alive || t.hp <= 0 || n <= 0) return false;
    const direct = kind !== 'burn' && kind !== 'fatigue';
    const hostile = !src || src.side !== t.side;
    const playerDamage = hostile && t.side === 1 && kind !== 'fatigue';
    const playerDefense = hostile && t.side === 0;
    const reduce = kind === 'attack' && t.side === 0
      ? (this.passives.has('g_core') && this.front(0)?.uid === t.uid ? 1 : 0) + (this.passives.has('g_taunt') && this.hasTrait(t, 'taunt') ? 1 : 0) : 0;
    const d = this.def(t);
    if (direct && t.block > 0) {
      if (playerDefense) { this.metrics.blocks++; this.metrics.mitigated += reduce ? Math.max(1, n - reduce) : n; }
      t.block--;
      this.emit({ t: 'dmg', src: src?.uid, tgt: t.uid, n: 0, kind, blocked: true });
      this.emit({ t: 'blockBroken', uid: t.uid });
      for (const b of this.standing(t.side)) if (this.def(b).special === 'banner') {
        const v = tri(this.def(b).values, b.level);
        this.enqueue(() => { if (t.alive && t.hp > 0 && b.alive) { this.label(b, 'aura'); this.buff(b, t, v, 0); } });
      }
      if (d.special === 'warden') {
        const v = tri(d.values, t.level);
        this.enqueue(() => { if (t.alive && t.hp > 0) { this.label(t, 'aura'); this.grant(t, t, 'armor', v); } });
      }
      return true;
    }
    const beforeArmor = n;
    if (direct) n = Math.max(1, n - this.armor(t));
    if (reduce) n = Math.max(1, n - reduce);
    // Keep other reductions in both paths so their contribution is not credited to armor.
    if (direct && playerDefense) this.metrics.mitigated += Math.max(0, (reduce ? Math.max(1, beforeArmor - reduce) : beforeArmor) - n);
    if (t.side === 0 && t.defId === 'x_argeon' && this.gen?.id === 'argeon' && !this.argeonSaved && n >= t.hp) {
      this.argeonSaved = true; n = t.hp - 1;
      this.genShow('亲征', [t]);
      if (n <= 0) return true;
    }
    const actual = Math.min(t.hp, n);
    if (playerDamage) {
      this.metrics.singleHit = Math.max(this.metrics.singleHit, actual);
      if (kind === 'attack' || kind === 'splash') this.metrics.attackDamage += actual;
      if (spell) this.metrics.spellDamage += actual;
      if (kind === 'burn') this.metrics.burnDamage += actual;
      if (kind === 'thorns') this.metrics.thornsDamage += actual;
      if (kind === 'splash') this.metrics.splashDamage += actual;
      if (n >= t.hp) this.metrics.kills++;
    }
    if (kind === 'burn' && t.side === 1) this.eggStats.burn++;
    t.hp -= n;
    this.emit({ t: 'dmg', src: src?.uid, tgt: t.uid, n, kind });
    if (t.hp <= 0 && !this.killers.has(t.uid)) { this.killers.set(t.uid, src); this.killKind.set(t.uid, kind); this.deathChain.set(t.uid, this.chain); }
    if (t.hp > 0 && src?.side === 0 && t.side === 1 && direct && kind !== 'thorns' && this.passives.has('faie_1') && this.faieActive())
      this.chill(undefined, t, 2 + (this.gen?.power ?? 0));
    if (kind === 'burn' && t.side === 0 && this.passives.has('vulkan_1'))
      this.enqueue(() => { if (t.alive && t.hp > 0) { this.label(t, 'general'); this.buff(undefined, t, 1, 0); } });
    this.triggerRules('hpBelow', t);
    if (d.onHurt) this.enqueue(() => {
      if (!t.alive || t.hp <= 0) return;
      this.respond(t, 'hurt', d.onHurt!, { attacker: src });
    });
    return true;
  }
  /** 永夜君王：召回本场阵亡的随从（生命减半），自己获得 3 层格挡 */
  private recall(boss: UnitState, hpRatio = 0.5, grantBlock = true) {
    if (!boss.alive || boss.hp <= 0) return;
    this.label(boss, 'boss');
    const recalled: UnitState[] = [];
    for (const m of this.units.filter(x => x.side === boss.side && !x.alive && !x.reserve && x.uid !== boss.uid).sort((a, b) => a.uid - b.uid)) {
      const slot = this.grid[m.side][m.slot] == null ? m.slot : this.grid[m.side].findIndex(x => x == null);
      if (slot < 0) break;
      m.alive = true; m.slot = slot; m.hp = Math.max(1, Math.ceil(m.maxHp * hpRatio));
      // 召回属于重新入场；与原位即时复生不同，本回合剩余机会不继承。
      m.actionsLeft = 0; this.waveUsed.add(m.uid);
      m.block = m.chill = m.burn = 0;
      this.grid[m.side][slot] = m.uid;
      this.deathOrder = this.deathOrder.filter(x => x !== m);
      this.emit({ t: 'recall', uid: m.uid, src: boss.uid });
      if (m.side === 0) this.metrics.revives++;
      recalled.push(m);
    }
    if (grantBlock) this.block(boss, boss, 3);
    this.triggerRules('afterRecall', boss, recalled);
  }
  /** 让阵亡单位以一半生命重新入场：插到 after 身后，或我方队尾 */
  private reviveUnit(m: UnitState, after?: UnitState) {
    if (m.alive || m.reserve || this.exiled.has(m.uid) || this.living(m.side).length >= SLOTS) return false;
    m.alive = true; m.hp = Math.max(1, Math.ceil(m.maxHp / 2));
    m.block = m.chill = m.burn = 0; m.actionsLeft = 0; this.waveUsed.add(m.uid);
    const team = this.living(m.side), i = after ? team.indexOf(after) : -1;
    team.splice(i >= 0 ? i + 1 : team.length, 0, m);
    this.layout(m.side, team);
    this.deathOrder = this.deathOrder.filter(x => x !== m);
    if (m.side === 0) this.metrics.revives++;
    this.emit({ t: 'revive', uid: m.uid });
    return true;
  }
  private firstDead(side: Side, except?: number) {
    return this.deathOrder.find(x => x.side === side && !x.alive && !this.exiled.has(x.uid) && x.uid !== except) ?? null;
  }

  /** 亡语是否触发两次：深渊主母、卡西瓦哀悼、召魂符、回魂（不叠加） */
  private rattleTimes(u: UnitState) {
    if (this.standing(u.side).some(m => this.def(m).special === 'matriarch')) return 2;
    if (u.side === 0 && this.kasivaVictims.has(u.uid) && this.passives.has('kasiva_2')) return 2;
    if (u.side === 0 && this.spells.has('sp_soul') && !this.soulUsed) { this.soulUsed = true; return 2; }
    if (u.side === 0 && this.passives.has('g_rattle') && !this.rattleUsed) { this.rattleUsed = true; return 2; }
    return 1;
  }

  /** 统一结算濒死单位：阵亡 → 复生 → 补位 → 亡语 / 友军阵亡时 / 击杀时 */
  private reap() {
    const dying = this.units.filter(u => u.alive && u.hp <= 0).sort(Battle.cmp);
    const outer = this.chain;
    for (const u of dying) {
      const killer = this.killers.get(u.uid); this.killers.delete(u.uid);
      const kind = this.killKind.get(u.uid); this.killKind.delete(u.uid);
      this.chain = this.deathChain.get(u.uid) ?? outer; this.deathChain.delete(u.uid);
      const exiled = killer?.defId === 'e_exile' || undefined;
      const burnLeft = u.burn;
      const inherit = u.actionsLeft ?? 0;
      const wasOpponent = this.actors[u.side]?.uid === u.uid;
      u.alive = false; u.hp = 0; u.block = 0; u.chill = 0; u.burn = 0;
      this.emit({ t: 'death', tgt: u.uid, ...(exiled ? { exiled } : {}) });
      if (exiled) this.exiled.add(u.uid);
      const d = this.def(u);
      if (u.side === 0) this.eggStats.death++;
      this.addSouls(u);
      const byTrait = this.hasTrait(u, 'reborn') && !u.revived;
      const slot = u.slot;
      if (!exiled && (byTrait || (u.side === 0 && this.freeRevives > 0))) {
        if (byTrait) u.revived = true; else this.freeRevives--;
        u.alive = true; u.hp = 1;
        if (u.side === 0) this.metrics.revives++;
        this.emit({ t: 'revive', uid: u.uid });
        if (d.onRevive) this.enqueue(() => this.respond(u, 'revive', d.onRevive!, {}));
      } else {
        this.grid[u.side][slot] = null;
        this.deathOrder.push(u);
        if (u.side === 0 && this.reserve.length) this.fillFromReserve(slot);
      }
      if (!exiled && d.onRattle) {
        const times = this.rattleTimes(u);
        if (u.side === 0) this.metrics.rattles += times;
        for (let i = 0; i < times; i++) this.enqueue(() => this.respond(u, 'rattle', d.onRattle!, { slot, inherit }, true));
      }
      if (burnLeft > 0 && this.passives.has('vulkan_3')) this.enqueue(() => {
        const b = this.standing(u.side).find(x => x.slot > slot);
        if (b) { this.genShow('余烬扩散', [b]); this.burn(undefined, b, burnLeft); }
      });
      if (u.temp && this.passives.has('hank_2')) this.gold++;
      for (const a of this.standing(u.side)) {
        const ad = this.def(a);
        if (a.uid !== u.uid && ad.onAllyFaint) this.enqueue(() => { if (a.alive && a.hp > 0) this.respond(a, 'allyFaint', ad.onAllyFaint!, {}); });
      }
      if (u.side === 0 && this.passives.has('g_martyr')) this.enqueue(() => {
        const b = this.standing(0).find(x => x.slot > slot && x.uid !== u.uid);
        if (b) { this.label(b, 'general'); this.buff(undefined, b, 2, 2); }
      });
      if (burnLeft > 0) for (const h of this.standing((1 - u.side) as Side)) if (this.def(h).special === 'harvester') {
        const v = tri(this.def(h).values, h.level);
        this.enqueue(() => { if (h.alive && h.hp > 0) { this.label(h, 'aura'); this.summon(h, h.side, -1, 't_flame', v, v, { rear: true }); } });
      }
      if (wasOpponent) {
        // 赤蛇刺客：本次交锋的对手阵亡（不论谁击杀）
        for (const v of this.standing((1 - u.side) as Side)) if (this.def(v).special === 'viper')
          this.enqueue(() => { if (v.alive && v.hp > 0) { this.label(v, 'aura'); this.extraAct(v, 0); } });
      }
      if (killer && killer.side !== u.side) {
        const kd = this.def(killer);
        if (kd.onKill) this.enqueue(() => { if (killer.alive && killer.hp > 0) this.respond(killer, 'kill', kd.onKill!, { target: u }); });
        if (killer.side === 0 && this.passives.has('g_morale') && this.morale < 3) {
          this.morale++;
          this.enqueue(() => { for (const a of this.standing(0)) this.buff(undefined, a, 1, 0); });
        }
        if (wasOpponent && kind === 'attack') this.duelKill(killer, u);
      }
    }
    this.chain = outer;
  }
  /** 击败对手：普攻（含追击）击杀本次交锋的对手 */
  private duelKill(k: UnitState, victim: UnitState) {
    const side = k.side, kd = this.def(k);
    if (side === 0) this.metrics.duelKills++;
    if (kd.onDuelKill) this.enqueue(() => { if (k.alive && k.hp > 0) this.respond(k, 'duelKill', kd.onDuelKill!, { target: victim }); });
    for (const p of this.standing(side)) if (this.def(p).special === 'panda') {
      const cap = tri(this.def(p).values, p.level);
      this.enqueue(() => {
        if (!p.alive || p.hp <= 0 || !this.specialUse(`panda${p.uid}`, cap)) return;
        this.label(p, 'aura');
        for (const a of this.standing(side)) this.buff(p, a, 1, 0);
      });
    }
    if (side === 0 && this.passives.has('g_arena')) this.enqueue(() => { if (k.alive && k.hp > 0) { this.label(k, 'general'); this.heal(undefined, k, 3); } });
    if (side === 0 && k.defId === 'x_argeon' && this.passives.has('argeon_2'))
      this.enqueue(() => { this.genShow('剑誓', this.standing(0)); for (const a of this.standing(0)) this.buff(undefined, a, 1, 0); });
  }
  private fillFromReserve(slot: number) {
    const r = this.reserve.shift()!;
    r.reserve = false; r.slot = slot; this.grid[0][slot] = r.uid;
    r.actionsLeft = 1; this.waveUsed.delete(r.uid);
    this.emit({ t: 'summon', uid: r.uid });
    if (this.passives.has('sajj_2')) {
      const v = 2 + (this.gen?.power ?? 0);
      this.enqueue(() => { this.genShow('援军', [r]); this.buff(undefined, r, v, v); });
    }
  }
  /** 莉莉丝：阵亡攒魂 */
  private addSouls(u: UnitState) {
    if (this.gen?.id !== 'lilithe') return;
    const only = this.passives.has('lilithe_3');
    if (only && u.side === 0) return;
    this.souls += only ? 2 : 1;
    this.emit({ t: 'genCount', id: 'lilithe', n: Math.min(3, this.souls), max: 3 });
    while (this.souls >= 3) {
      this.souls -= 3;
      this.enqueue(() => this.soulBurst());
    }
  }
  private soulBurst() {
    const P = this.gen?.power ?? 0, has = (k: string) => this.passives.has(k);
    if (!this.standing(0).length) return;
    if (has('lilithe_1')) {
      const t = this.front(1);
      if (t) { this.genShow('收割', [t]); this.hit(undefined, t, 4 + P, 'ability', true); }
    } else if (has('lilithe_2')) {
      this.genShow('魂火', []);
      this.summon(undefined, 0, -1, 't_shade', 2, 2, { rear: true });
    } else {
      this.genShow('魂潮', this.standing(0));
      for (const a of this.standing(0)) this.buff(undefined, a, 1, 1);
    }
    if (has('lilithe_4') && this.lilitheRevives < 2) {
      const m = this.firstDead(0);
      if (m && this.reviveUnit(m)) { this.lilitheRevives++; this.genShow('冥约', [m]); }
    }
    this.emit({ t: 'genCount', id: 'lilithe', n: this.souls, max: 3 });
  }

  /**
   * 召唤插入：原位空着放原位；否则插到来源身后。满员时最近的友军获得一半属性（萨吉收容则进预备位）。
   * 返回召唤出的单位；失败返回 null。
   */
  private summon(src: UnitState | undefined, side: Side, origin: number, token: string, atk: number, hp: number, o: SummonOpts = {}): UnitState | null {
    const td = unitDef(token);
    const a = td.atk === 0 ? 0 : Math.max(1, atk);
    if (this.living(side).length >= SLOTS) {
      if (side === 0 && this.passives.has('sajj_4') && this.reserve.length < this.reserveCap()) {
        const r = this.spawn(side, null, token, 1);
        r.atk = a; r.hp = r.maxHp = hp; r.summoned = true; r.reserve = true;
        this.reserve.push(r);
        this.emit({ t: 'summon', uid: r.uid, src: src?.uid });
        this.genShow('收容', [r]);
        return null;
      }
      const near = this.standing(side).sort((x, y) => Math.abs(x.slot - origin) - Math.abs(y.slot - origin) || Battle.cmp(x, y))[0];
      if (near) this.buff(src, near, Math.floor(a / 2), Math.floor(hp / 2));
      return null;
    }
    const s = this.spawn(side, null, token, 1);
    s.atk = a; s.hp = s.maxHp = hp; s.summoned = true;
    const team = this.living(side);
    if (o.rear) this.layout(side, [...team, s]);
    else if (!o.after && origin >= 0 && origin < SLOTS && this.grid[side][origin] == null) { s.slot = origin; this.grid[side][origin] = s.uid; }
    else {
      const anchor = o.after ?? src, i = anchor ? team.indexOf(anchor) : -1;
      team.splice(i >= 0 ? i + 1 : team.filter(x => x.slot < origin).length, 0, s);
      this.layout(side, team);
    }
    if (side === 0) { this.metrics.summons++; this.eggStats.summon++; }
    this.emit({ t: 'summon', uid: s.uid, src: src?.uid });
    let ready = false;
    for (const m of this.standing(side)) {
      if (m === s) continue;
      const md = this.def(m);
      if (md.special === 'incubator') { const v = tri(md.values, m.level); this.buff(m, s, v, v); ready = true; }
      if (md.special === 'pharaoh') { const v = tri(md.values, m.level); this.buff(m, s, v, v); }
      if (md.onAllySummon) this.enqueue(() => this.respond(m, 'summon', md.onAllySummon!, { target: s }));
    }
    if (side === 0 && this.passives.has('g_horde')) this.buff(undefined, s, 1, 1);
    s.actionsLeft = this.isIdle(s) ? 0 : ready ? Math.max(1, o.inherit ?? 0) : o.inherit ?? 0;
    return s;
  }
  private reserveCap() { return this.passives.has('sajj_3') ? 2 : 1; }

  // ---------- 效果解释 ----------
  private targets(u: UnitState, to: Effect['to'], ctx: Ctx): UnitState[] {
    const foe = (1 - u.side) as Side, slot = ctx.slot ?? u.slot;
    const one = (x: UnitState | null | undefined) => (x && x.alive && x.hp > 0 ? [x] : []);
    switch (to) {
      case 'self': return one(u);
      case 'front': return one(this.front(u.side));
      case 'rear': return one(this.rear(u.side));
      case 'allies': return this.standing(u.side);
      case 'others': return this.standing(u.side).filter(x => x.uid !== u.uid);
      case 'adjacent': return this.neighbors(u, slot);
      case 'ahead': return one(this.standing(u.side).filter(x => x.slot < slot && x.uid !== u.uid).at(-1));
      case 'behind': return one(this.standing(u.side).find(x => x.slot > slot && x.uid !== u.uid));
      case 'lowest': return one(this.standing(u.side).filter(x => x.hp < x.maxHp).sort((a, b) => a.hp - b.hp || Battle.cmp(a, b))[0]);
      case 'highestAtk': return one(this.atk1(u.side, u.uid));
      case 'highestHp': return one(this.hpTop(u.side));
      case 'adjHighestAtk': return one(this.neighbors(u, slot).sort((a, b) => b.atk - a.atk || Battle.cmp(a, b))[0]);
      case 'enemyFront': return one(this.front(foe));
      case 'enemyRear': return one(this.rear(foe));
      case 'enemyLowest': return one(this.hp1(foe));
      case 'enemyHighestAtk': return one(this.atk1(foe));
      case 'enemyHighestHp': return one(this.hpTop(foe));
      case 'enemyAll': return this.standing(foe);
      case 'enemyNext': {
        const p = this.pending[foe];
        return one(p && p.alive && p.hp > 0 ? p : this.futureOrder(foe)[0]);
      }
      case 'attacker': return one(ctx.attacker && ctx.attacker.side !== u.side ? ctx.attacker : null);
      case 'target': return one(ctx.target);
      case 'opponent': return one(ctx.target && ctx.target.uid === this.actors[foe]?.uid ? ctx.target : null);
      case 'burningEnemies': return this.standing(foe).filter(x => x.burn > 0);
      case 'otherEnemies': return this.standing(foe).filter(x => x.uid !== ctx.target?.uid);
    }
  }
  private capped(u: UnitState, e: Effect) {
    return (!!e.cap && (this.capRound.get(e)?.get(u.uid) ?? 0) >= tri(e.cap, u.level))
      || (!!e.capBattle && (this.capBattle.get(e)?.get(u.uid) ?? 0) >= tri(e.capBattle, u.level));
  }
  private useCap(u: UnitState, e: Effect) {
    for (const [has, m] of [[e.cap, this.capRound], [e.capBattle, this.capBattle]] as const) {
      if (!has) continue;
      const per = m.get(e) ?? new Map<number, number>();
      per.set(u.uid, (per.get(u.uid) ?? 0) + 1); m.set(e, per);
    }
  }
  private apply(u: UnitState, effects: Effect[], ctx: Ctx): boolean {
    let any = false;
    const pw = ctx.cast ? this.power(u) : 0;
    // 锁定目标：先解析所有效果的目标，后续效果不因死亡或属性变化重新选人。
    const locked = this.def(u).lockTargets ? new Map(effects.map(e => [e, this.targets(u, e.to, ctx)])) : undefined;
    for (const e of effects) {
      const captured = locked?.get(e)?.filter(t => t.alive && t.hp > 0);
      if (!this.effectUseful(u, e, ctx, captured)) continue;
      const v = effectAmount(e, tri(e.v, u.level), pw, !!ctx.cast);
      const v2 = tri(e.v2, u.level);
      const free = e.op === 'grant' || e.op === 'extraAct' || e.op === 'summon' || e.op === 'rotate' || e.op === 'revive' || e.op === 'die' || e.op === 'freeze' || e.op === 'sacrifice';
      if (!free && v <= 0 && v2 <= 0) continue;
      this.useCap(u, e);
      if (e.op === 'summon') {
        let prev: UnitState | undefined;
        for (let i = 0; i < (e.count ?? 1); i++) {
          const s = this.summon(u, u.side, ctx.slot ?? u.slot, e.token!, v, v2 || v, { rear: e.rear, inherit: ctx.inherit, after: prev });
          if (s) prev = s;
        }
        any = true; continue;
      }
      if (e.op === 'revive') {
        const m = this.firstDead(u.side, u.uid);
        if (m && this.reviveUnit(m, u)) any = true;
        continue;
      }
      if (e.op === 'rotate') {
        const f = this.front(u.side);
        if (f && this.rotateToRear(f)) any = true;
        continue;
      }
      const ts = captured ?? this.targets(u, e.to, ctx);
      for (const t of ts) {
        any = true;
        switch (e.op) {
          case 'dmg': this.hit(u, t, v, 'ability', !!ctx.cast); break;
          case 'heal': this.heal(u, t, v); break;
          case 'block': this.block(u, t, v); break;
          case 'chill': this.chill(u, t, v); break;
          case 'freeze': this.chill(u, t, Math.max(1, t.atk)); break;
          case 'burn': this.burn(u, t, v); break;
          case 'buff': this.buff(u, t, v, v2, !!e.temp); break;
          case 'weaken': this.buff(u, t, -v, 0); break;
          case 'grant': if (e.grant) this.grant(u, t, e.grant, v); break;
          case 'extraAct': this.extraAct(t, v); break;
          case 'charge': this.addCharge(u, t, v); break;
          case 'die': if (t.alive && t.hp > 0) { t.hp = 0; this.killers.delete(t.uid); } break;
          case 'addAction':
            this.addAction(u, t, v);
            if (e.oncePerRound) { const used = this.actionGrants.get(u.uid) ?? new Set<Effect>(); used.add(e); this.actionGrants.set(u.uid, used); }
            break;
          case 'sacrifice': {
            const receiver = this.standing(u.side).filter(x => x.uid !== u.uid && x.uid !== t.uid).sort((a, b) => b.atk - a.atk || Battle.cmp(a, b))[0];
            if (!receiver) break;
            t.hp = 0; this.killers.delete(t.uid);
            if (u.side === 0 && t.side === 0) this.metrics.sacrifices++;
            this.emit({ t: 'sacrifice', src: u.uid, tgt: t.uid });
            this.buff(u, receiver, v, 0);
            break;
          }
        }
      }
    }
    return any;
  }
  private respond(u: UnitState, kind: TriggerKind, effects: Effect[], ctx: Ctx, dead = false) {
    if (!dead && (!u.alive || u.hp <= 0)) return;
    // 被动响应没有有效目标时静默跳过（落空提示只给施法）
    if (!effects.some(e => this.effectUseful(u, e, ctx))) return;
    this.label(u, kind);
    this.apply(u, effects, ctx);
  }

  // ---------- 出手 ----------
  /** 追击层数上限：追击引发的效果不再引发追击；主将「连锁」允许我方再引发一层 */
  private chainCap(side: Side) { return side === 0 && this.passives.has('g_chain') ? 2 : 1; }
  /** 能施法：有施法、次数未用完、且至少一个效果有用；否则这次出手改为普攻 */
  canCast(u: UnitState) {
    const d = this.def(u);
    if (!d.cast || (u.charges !== undefined && u.charges <= 0)) return false;
    return d.cast.some(e => e.op === 'summon' ? this.living(u.side).length < SLOTS : this.effectUseful(u, e, {}));
  }
  private effectUseful(u: UnitState, e: Effect, ctx: Ctx, targets?: UnitState[]) {
    if (this.capped(u, e)) return false;
    if (e.op === 'summon') return true;
    if (e.op === 'revive') return this.living(u.side).length < SLOTS && !!this.firstDead(u.side, u.uid);
    if (e.op === 'rotate') return this.standing(u.side).length >= 2;
    if (e.op === 'grant' && (!e.grant || (!BOOL_GRANTS.has(e.grant) && tri(e.v, u.level) === 0))) return false;
    if (e.op === 'extraAct' && this.chain >= this.chainCap(u.side)) return false;
    if (e.op === 'addAction' && (tri(e.v, u.level) <= 0 || (e.oncePerRound && this.actionGrants.get(u.uid)?.has(e)))) return false;
    return (targets ?? this.targets(u, e.to, ctx)).some(t =>
      e.op === 'heal' ? t.hp < t.maxHp && !(t.side === u.side && this.isolated.has(t.uid)) : e.op === 'block' ? t.block < MAX_BLOCK :
      e.op === 'charge' ? !!t.chargeMax && (t.charge ?? 0) < t.chargeMax :
      e.op === 'grant' && BOOL_GRANTS.has(e.grant!) ? !t.grants[e.grant as BoolTrait] && !this.def(t).traits?.[e.grant as BoolTrait] :
      e.op === 'sacrifice' ? this.standing(u.side).some(x => x.uid !== u.uid && x.uid !== t.uid) : true);
  }

  /** 寒意检查：寒意 ≥ 当前攻击 → 冻结，跳过这次出手 */
  private frozen(u: UnitState, bonus = 0) {
    if (u.chill <= 0 || u.chill < u.atk + bonus) return false;
    u.chill = 0;
    if (u.side === 1) { this.metrics.freezes++; this.eggStats.freeze++; }
    this.emit({ t: 'frozenSkip', uid: u.uid });
    const foe = (1 - u.side) as Side;
    for (const q of this.standing(foe)) {
      const qd = this.def(q);
      if (qd.special === 'queen') {
        const v = tri(qd.values, q.level);
        this.enqueue(() => {
          if (!q.alive || q.hp <= 0) return;
          this.label(q, 'aura');
          for (const o of this.standing(u.side)) if (o.uid !== u.uid) this.chill(q, o, v);
        });
      }
      if (qd.special === 'wyvern' && this.wyvernBeat.get(q.uid) !== this.beat) {
        this.wyvernBeat.set(q.uid, this.beat);
        const v = tri(qd.values, q.level);
        this.enqueue(() => { if (q.alive && q.hp > 0) { this.label(q, 'aura'); this.buff(q, q, v, 0); this.extraAct(q, 0); } });
      }
      if (qd.onEnemyFreeze) this.enqueue(() => this.respond(q, 'freeze', qd.onEnemyFreeze!, { target: u }));
    }
    if (u.side === 1 && this.passives.has('g_tide')) {
      const ns = this.neighbors(u);
      this.enqueue(() => { for (const n of ns) this.chill(undefined, n, 2); });
    }
    return true;
  }
  private cast(u: UnitState, ctx: Ctx) {
    if (u.side === 0) this.metrics.casts++;
    const d = this.def(u);
    if (u.charges !== undefined) u.charges--;
    if (!this.apply(u, d.cast!, { ...ctx, cast: true })) this.emit({ t: 'fizzle', src: u.uid, reason: '没有有效目标' });
    this.triggers[u.defId] = (this.triggers[u.defId] ?? 0) + 1;
    if (u.side === 0 && this.passives.has('g_surge') && !this.surgeUsed.has(u.uid)) {
      this.surgeUsed.add(u.uid);
      this.enqueue(() => { if (u.alive && u.hp > 0 && this.canCast(u)) { this.metrics.casts++; this.label(u, 'general'); this.apply(u, d.cast!, { cast: true }); } });
    }
    for (const m of this.standing(u.side)) {
      const md = this.def(m);
      if (md.special === 'solus' && m.uid !== u.uid) {
        const v = tri(md.values, m.level);
        this.enqueue(() => { if (m.alive && m.hp > 0 && u.alive && u.hp > 0) { this.label(m, 'afterCast'); this.grant(m, u, 'power', v); } });
      }
    }
    for (const s of this.neighbors(u)) if (this.def(s).special === 'sentinel') {
      const v = this.def(s).values;
      this.enqueue(() => this.respond(s, 'afterCast', [{ op: 'chill', to: 'enemyNext', v }], {}));
    }
  }
  /**
   * 追击：冲出队列立刻普攻，不施法、不消耗常规行动、不蓄力、不轮换；仍做寒意检查。
   * 追击引发的效果（含击杀、受击、冻结等后续）不会再引发追击。force = 主将直接命令，不受层数限制。
   */
  private extraAct(u: UnitState, bonus: number, opts: ActOpts = {}) {
    if (!u.alive || u.hp <= 0 || u.reserve) return;
    if (!opts.force && this.chain >= this.chainCap(u.side)) return;
    const prev = this.chain;
    this.chain = prev + 1;
    try {
      this.emit({ t: 'act', side: u.side, uid: u.uid, mode: 'extra' });
      if (this.frozen(u, bonus)) return;
      if (u.side === 0 && this.standing(1).length) this.metrics.extraActions++;
      this.attack([{ a: u, bonus, snipe: opts.snipe }]);
    } finally { this.chain = prev; }
  }

  /** 普攻选目标：嘲讽 > 决斗对手 / 狙击 > 队首 */
  private pickTarget(a: UnitState, snipe: boolean, announce: boolean): UnitState | null {
    const foe = (1 - a.side) as Side, st = this.standing(foe);
    if (!st.length) return null;
    const opp = this.actors[foe];
    const pref = this.hasTrait(a, 'duel') && opp && st.includes(opp) ? opp : snipe ? st.at(-1)! : st[0];
    const taunt = st.find(x => this.hasTrait(x, 'taunt'));
    if (taunt && taunt !== pref) {
      if (announce) { if (taunt.side === 0) this.metrics.taunts++; this.emit({ t: 'taunt', from: pref.uid, to: taunt.uid }); }
      return taunt;
    }
    return pref;
  }

  /** 普攻（可多人同时）：先锁定目标，所有段数交替结算，最后统一响应 */
  private attack(list: { a: UnitState; bonus: number; snipe?: boolean; ca?: ChargeAttack }[]) {
    const plans = list.filter(p => p.a.alive && p.a.hp > 0 && !this.frozen(p.a, p.bonus)).map(p => {
      const a = p.a, foe = (1 - a.side) as Side, snipe = !!p.snipe || this.hasTrait(a, 'snipe');
      const tgt = this.pickTarget(a, snipe, true);
      const chilled = Math.min(a.chill, a.atk + p.bonus - 1);
      let base = Math.max(1, a.atk + p.bonus - a.chill);
      a.chill = 0;
      if (p.ca) base = base * (p.ca.mult ?? 1) + tri(p.ca.bonus, a.level);
      const combo = this.hasTrait(a, 'combo');
      return { a, foe, snipe, tgt, chilled, base, ca: p.ca, hits: combo ? [Math.ceil(base / 2), Math.ceil(base / 2)] : [base], struck: [] as UnitState[] };
    }).filter(p => p.tgt);
    if (!plans.length) return;
    this.emit({ t: 'attack', pairs: plans.map(p => ({ atk: p.a.uid, tgt: p.tgt!.uid, ...(p.chilled > 0 ? { chill: p.chilled } : {}) })) });
    const maxHits = Math.max(...plans.map(p => p.hits.length));
    for (let i = 0; i < maxHits; i++) {
      for (const p of plans) {
        if (i >= p.hits.length) continue;
        let t = p.tgt!;
        if (!t.alive || t.hp <= 0) {
          const n = this.pickTarget(p.a, p.snipe, false);
          if (!n) continue;
          t = p.tgt = n;
        }
        const a = p.a, ad = this.def(a), td = this.def(t);
        let n = p.hits[i];
        if (ad.special === 'lion') n += a.block * tri(ad.values, a.level);
        if (ad.special === 'monk' && t.atk > a.atk) n += tri(ad.values, a.level);
        if (this.hasEquip(a, 'hammer') && this.armor(t) > 0) n += 2;
        const hitTargets = [t];
        const landed = this.hit(a, t, n, 'attack');
        if (landed && !p.struck.includes(t)) p.struck.push(t);
        if (landed && td.special === 'cliff' && this.cliffBeat.get(t.uid) !== this.beat) {
          this.cliffBeat.set(t.uid, this.beat);
          const v = tri(td.values, t.level);
          this.enqueue(() => { if (t.alive && t.hp > 0) { this.label(t, 'attacked'); this.block(t, t, v); } });
        }
        const thorns = this.thorns(t);
        if (landed && thorns > 0 && a.alive) this.hit(t, a, thorns, 'thorns');
        if (i === 0 && (this.hasTrait(a, 'splash') || p.ca?.splash)) {
          const behind = this.standing(p.foe).find(x => x.slot > t.slot);
          if (behind) {
            this.hit(a, behind, Math.max(1, Math.floor(p.base / 2)), 'splash'); hitTargets.push(behind);
            if (ad.special === 'whelp') this.burn(a, behind, tri(ad.values, a.level));
          }
        }
        if (ad.special === 'titan' && landed && this.titanBeat.get(a.uid) !== this.beat) {
          this.titanBeat.set(a.uid, this.beat);
          const v = tri(ad.values, a.level);
          for (const h of hitTargets) this.burn(a, h, v);
        }
        if (landed) for (const m of this.standing(a.side)) if (this.def(m).special === 'master') {
          const v = tri(this.def(m).values, m.level);
          this.enqueue(() => { if (m.alive && m.hp > 0) { const r = this.rear((1 - m.side) as Side); if (r) { this.label(m, 'afterAttack'); this.hit(m, r, v, 'ability'); } } });
        }
      }
    }
    for (const p of plans) {
      const a = p.a, ad = this.def(a), target = p.tgt!;
      if (ad.afterAttack) this.enqueue(() => this.respond(a, 'afterAttack', ad.afterAttack!, { target }));
      if (p.ca?.after) { const after = p.ca.after; this.enqueue(() => this.respond(a, 'charge', after, { target })); }
      for (const e of this.equipsOf.get(a.uid) ?? []) if (e.afterAttack) this.enqueue(() => this.respond(a, 'equip', e.afterAttack!, { target }));
      for (const t of p.struck) {
        const td = this.def(t);
        if (td.onAttacked) this.enqueue(() => this.respond(t, 'attacked', td.onAttacked!, { attacker: a }));
        if (t.side === 0 && t.defId === 'x_argeon' && this.passives.has('argeon_1'))
          this.enqueue(() => { if (t.alive && t.hp > 0) { const b = this.standing(0).find(x => x.slot > t.slot); if (b) { this.genShow('盾誓', [b]); this.block(undefined, b, 1); } } });
      }
    }
  }

  private pick(side: Side) {
    const u = this.order(side)[0] ?? null;
    if (u) { this.waveUsed.add(u.uid); u.actionsLeft = Math.max(0, (u.actionsLeft ?? 0) - 1); this.ptr[side] = (u.slot + 1) % SLOTS; }
    return u;
  }

  // ---------- 主将 ----------
  private faieActive() {
    return this.gen?.id === 'faie' && !this.passives.has('faie_3') && this.round <= (this.passives.has('faie_2') ? 2 : 1);
  }
  /** 卡雷奥斯：压轴 / 首发 / 双幕 / 影步 */
  private kaleosAfter(a: UnitState) {
    if (this.gen?.id !== 'kaleos' || a.side !== 0 || !a.alive || a.hp <= 0) return;
    const P = this.gen.power, has = (k: string) => this.passives.has(k);
    const others = this.standing(0).filter(x => x.uid !== a.uid && !this.isIdle(x) && (x.actionsLeft ?? 0) > 0).length;
    const mine = a.actionsLeft ?? 0;
    let lead = false;
    if (has('kaleos_1')) { if (!this.kFirst) { this.kFirst = true; lead = true; } }
    else if (!others && !mine && !this.kLast) { this.kLast = true; lead = true; }
    if (lead) {
      this.genShow(has('kaleos_1') ? '首发' : '压轴', [a]);
      if (has('kaleos_2') && this.canCast(a)) {
        this.metrics.casts++;
        this.apply(a, this.def(a).cast!, { cast: true });
        this.flush();
      } else {
        this.extraAct(a, P, { force: true });
        this.flush();
        const f = this.front(0);
        if (has('kaleos_4') && a.alive && a.hp > 0 && f && f !== a) { this.genShow('影步', [a, f]); this.swapUnits(a, f); this.flush(); }
      }
    }
    if (has('kaleos_3') && !lead && others === 1 && !mine && !this.kSecond && a.alive && a.hp > 0) {
      this.kSecond = true;
      this.genShow('双幕', [a]);
      this.extraAct(a, -Math.floor(a.atk / 2), { force: true });
      this.flush();
    }
  }
  /** 卡西瓦：开战献祭队尾，其余友军平分属性 */
  private kasivaStart() {
    const team = this.standing(0), n = this.passives.has('kasiva_1') ? 2 : 1;
    if (team.length <= n) return;
    const victims = team.slice(-n), rest = team.slice(0, -n);
    // 平分的是祭品 2 倍的攻击和生命
    const atk = 2 * victims.reduce((s, v) => s + v.atk, 0), hp = 2 * victims.reduce((s, v) => s + v.maxHp, 0);
    this.genShow('血祭', victims);
    for (const v of victims) {
      this.kasivaVictims.add(v.uid);
      v.hp = 0; this.killers.delete(v.uid);
      this.metrics.sacrifices++;
      this.emit({ t: 'sacrifice', src: v.uid, tgt: v.uid });
    }
    if (this.passives.has('kasiva_3')) this.buff(undefined, rest[0], atk, hp);
    else for (const r of rest) this.buff(undefined, r, Math.floor(atk / rest.length), Math.floor(hp / rest.length));
    this.flush();
  }
  /** 卡拉：统计关键词种类 */
  private karaStart() {
    const kwOf = (u: UnitState) => {
      const s = new Set(this.def(u).keywords ?? []);
      for (const [k, v] of Object.entries(u.grants)) if (v && GRANT_KW[k]) s.add(GRANT_KW[k]);
      return s;
    };
    const ours = this.standing(0);
    if (!ours.length) return;
    const sets = ours.map(kwOf);
    const kinds = new Set(sets.flatMap(s => [...s]));
    if (this.passives.has('kara_4')) for (const e of this.standing(1)) for (const k of kwOf(e)) kinds.add(k);
    const k = kinds.size;
    if (this.passives.has('kara_1')) {
      let best: UnitState[] = [];
      for (const w of kinds) { const hold = ours.filter((_, i) => sets[i].has(w)); if (hold.length > best.length) best = hold; }
      const n = best.length;
      if (n >= 2) { this.genShow('纯色', best); for (const a of best) this.buff(undefined, a, n + 3, n + 3); }
      return;
    }
    this.genShow('棱镜', ours);
    const atk = Math.min(3, Math.floor(k / 3));
    if (this.passives.has('kara_2')) { const f = this.front(0); if (f) this.block(undefined, f, Math.min(3, k)); }
    for (const a of ours) this.buff(undefined, a, atk, this.passives.has('kara_2') ? 0 : k);
    if (this.passives.has('kara_3') && k >= 6) for (const a of ours) this.grant(undefined, a, 'power', 1);
  }
  /** 齐瑞克斯：积满星能后首尾互换 */
  private zirixTick() {
    if (this.gen?.id !== 'zirix') return;
    const has = (k: string) => this.passives.has(k), max = 4;
    this.stars++;
    this.emit({ t: 'genCount', id: 'zirix', n: Math.min(max, this.stars), max });
    if (this.stars < max) return;
    this.stars = 0;
    const hurt: UnitState[] = [];
    const team = this.standing(1);
    if (team.length >= 2) {
      const a = team[0], b = has('zirix_4') ? team[1] : team.at(-1)!;
      this.genShow('星轨', [a, b]);
      if (this.swapUnits(a, b)) hurt.push(a, b);
    }
    if (has('zirix_1')) for (const t of hurt) this.chill(undefined, t, 2 + (this.gen?.power ?? 0));
    if (has('zirix_3')) for (const t of hurt) this.hit(undefined, t, 3 + (this.gen?.power ?? 0), 'ability', true);
    this.emit({ t: 'genCount', id: 'zirix', n: 0, max });
    this.flush();
  }
  /** 齐兰：全队轮转一格 */
  private zilanSpin() {
    const team = this.standing(0);
    if (team.length < 2) return;
    const P = this.gen?.power ?? 0, has = (k: string) => this.passives.has(k);
    if (has('zilan_1')) { this.genShow('回马枪', [team[0]]); this.extraAct(team[0], 2); this.flush(); }
    const now = this.standing(0);
    if (now.length < 2) return;
    const order = [...now.slice(1), now[0]];
    this.genShow('轮番上阵', order);
    this.layout(0, order);
    this.afterRotate(0);
    const f = order[0], r = order.at(-1)!;
    if (has('zilan_2')) this.zilanPending.set(f.uid, (this.zilanPending.get(f.uid) ?? 0) + 2 + P);
    if (has('zilan_3')) { this.heal(undefined, r, 3 + P); this.block(undefined, r, 1); }
    this.flush();
  }

  // ---------- 阶段 ----------
  private startPhase() {
    this.emit({ t: 'phase', name: 'start' });
    this.responses = 0;
    this.lastFront = [this.front(0)?.uid ?? null, this.front(1)?.uid ?? null];
    const allies = () => this.standing(0), foes = () => this.standing(1);
    const P = this.gen?.power ?? 0;
    if (this.gen?.id === 'kasiva') this.kasivaStart();
    if (this.gen?.id === 'kara') this.karaStart();
    if (this.passives.has('reva_2')) for (const e of foes()) if (this.revaMoved.has(e.uid)) { this.genShow('惊扰', [e]); this.buff(undefined, e, -(1 + Math.floor(P / 2)), 0); }
    if (this.passives.has('g_elite') && allies().length <= 4) for (const a of allies()) this.buff(undefined, a, 2, 4);
    if (this.passives.has('g_wall')) for (const a of allies()) this.block(undefined, a, 1);
    if (this.passives.has('g_breach')) for (const e of foes()) this.grant(undefined, e, 'armor', -1);
    if (this.passives.has('g_store')) for (const a of allies()) this.addCharge(undefined, a, 1);
    if (this.spells.has('sp_haste')) { const f = this.front(0); if (f) this.addAction(undefined, f, 1); }
    if (this.spells.has('sp_shield')) for (const a of allies()) this.block(undefined, a, 1);
    if (this.spells.has('sp_firerain')) for (const e of foes()) this.burn(undefined, e, 3);
    if (this.spells.has('sp_freeze')) { const f = this.front(1); if (f) this.chill(undefined, f, f.atk); }
    this.flush();
    const starters = this.units.filter(u => this.onField(u) && (this.def(u).onStart || this.equipsOf.get(u.uid)?.some(e => e.onStart))).sort(Battle.cmp);
    for (const u of starters) {
      this.responses = 0;
      const d = this.def(u);
      if (d.onStart) this.respond(u, 'start', d.onStart, {});
      for (const e of this.equipsOf.get(u.uid) ?? []) if (e.onStart) this.respond(u, 'equip', e.onStart, {});
      this.flush();
    }
    // Strip shields after every unit/equipment opening effect, before the opening command.
    if (this.passives.has('g_breach')) for (const e of foes()) e.block = 0;
    if (this.passives.has('g_haste')) {
      this.responses = 0;
      const a = this.atk1(0);
      if (a) { this.label(a, 'general'); this.extraAct(a, 0, { force: true }); this.flush(); }
    }
  }
  /** 每回合开始（含第 1 回合）：推迟、临时加成、回合开始时效果 */
  private roundStart() {
    this.responses = 0;
    this.kFirst = this.kLast = this.kSecond = false;
    this.zilanSpins = 0;
    this.delayFoe.clear(); this.delayLast.clear();
    const has = (k: string) => this.passives.has(k), P = this.gen?.power ?? 0;
    for (const [uid, n] of this.zilanPending) { const u = this.u(uid); if (u.alive && u.hp > 0) { this.genShow('接力', [u]); this.buff(undefined, u, n, 0, true); } }
    this.zilanPending.clear();
    if (this.gen?.id === 'faie') {
      if (has('faie_3')) {
        if (this.round === 1) { this.genShow('后发', this.standing(0)); for (const a of this.standing(0)) { this.delayFoe.add(a.uid); this.buff(undefined, a, 3, 0, true); } }
      } else if (has('faie_2')) {
        if (this.round <= 2) { const last = this.standing(1).slice(-2); this.genShow('长冬', last); for (const e of last) this.delayFoe.add(e.uid); }
      } else if (this.round === 1) { this.genShow('先机', this.standing(1)); for (const e of this.standing(1)) this.delayFoe.add(e.uid); }
    }
    if (this.round === 1 && this.revaFront != null && has('reva_3')) this.delayLast.add(this.revaFront);
    if (this.round === 2 && has('kasiva_4')) for (const uid of this.kasivaVictims) {
      const v = this.u(uid);
      if (!v.alive && this.reviveUnit(v)) this.genShow('余烬', [v]);
    }
    for (const u of this.units.filter(x => this.onField(x)).sort(Battle.cmp)) {
      const d = this.def(u);
      if (d.special === 'devourer') {
        const r = this.rear(u.side);
        if (r && r !== u) {
          this.label(u, 'roundStart');
          const atk = Math.floor(r.atk / 2), hp = Math.floor(r.maxHp / 2);
          r.hp = 0; this.killers.delete(r.uid);
          if (u.side === 0) this.metrics.sacrifices++;
          this.emit({ t: 'sacrifice', src: u.uid, tgt: r.uid });
          this.buff(u, u, atk, hp);
        }
      }
      if (d.special === 'worm') {
        this.label(u, 'roundStart');
        if (!this.summon(u, u.side, u.slot, 't_worm', 1, 1)) { const v = tri(d.values, u.level); this.buff(u, u, v, v); }
      }
      if (d.onRoundStart) this.respond(u, 'roundStart', d.onRoundStart, {});
      this.flush();
    }
    void P;
  }
  /** 回合结束：齐兰轮转、瓦尔坎火山 */
  private roundEnd() {
    this.responses = 0;
    const P = this.gen?.power ?? 0, has = (k: string) => this.passives.has(k);
    if (this.gen?.id === 'zilan' && !has('zilan_4')) this.zilanSpin();
    if (this.gen?.id === 'vulkan') {
      const pick = (side: Side) => has('vulkan_2') ? this.rear(side) : this.front(side);
      const mine = pick(0), theirs = pick(1);
      this.genShow('火山战场', has('vulkan_1') ? [mine, theirs] : [theirs]);
      if (mine && has('vulkan_1')) this.burn(undefined, mine, 1);
      if (theirs) this.burn(undefined, theirs, 2 + P);
      const f = this.front(0);
      if (f && has('vulkan_4')) this.block(undefined, f, 1);
    }
    this.flush();
  }
  private doBeat() {
    const first = this.beat === 0;
    const fresh = this.prepareWave();
    if (this.outcome()) return;
    if (first || fresh) { this.roundStart(); if (this.outcome()) return; }
    this.beat++;
    this.responses = 0;
    this.emit({ t: 'beat', n: this.beat, round: this.round, wave: this.wave, next: { player: this.order(0).map(u => u.uid), enemy: this.order(1).map(u => u.uid) } });
    const actors = [this.pick(0), this.pick(1)];
    this.actors = [...actors];
    this.pending = [...actors];
    const attackers: { a: UnitState; bonus: number; ca?: ChargeAttack }[] = [];
    const acted: { a: UnitState; released: boolean }[] = [];
    for (const side of [0, 1] as Side[]) {
      const a = actors[side];
      if (!a || !a.alive || a.hp <= 0) { this.pending[side] = null; continue; }
      if (this.frozen(a)) { this.pending[side] = null; this.flush(); continue; }
      const d = this.def(a);
      const full = !!a.chargeMax && (a.charge ?? 0) >= a.chargeMax;
      acted.push({ a, released: full });
      if (full) {
        a.charge = 0;
        if (a.side === 0) this.metrics.charges++;
        this.emit({ t: 'act', side, uid: a.uid, mode: 'charge' });
        if (d.chargeSkill) {
          this.pending[side] = null;
          a.chill = 0; this.label(a, 'charge');
          if (!this.apply(a, d.chargeSkill, { cast: true })) this.emit({ t: 'fizzle', src: a.uid, reason: '没有有效目标' });
          this.flush();
        } else {
          // 带 after 的蓄力普攻在 respond 里亮标签；纯数值的（如日轮刃使）在这里亮，否则回放看不到「蓄力」
          if (!d.chargeAttack?.after) this.label(a, 'charge');
          attackers.push({ a, bonus: 0, ca: d.chargeAttack ?? {} });
        }
      } else if (a.side === 0 && a.defId === 'x_argeon' && this.passives.has('argeon_3') && this.standing(0).some(x => x.hp < x.maxHp)) {
        this.emit({ t: 'act', side, uid: a.uid, mode: 'cast' });
        this.pending[side] = null; a.chill = 0;
        const n = 2 + (this.gen?.power ?? 0);
        this.genShow('光誓', this.standing(0));
        for (const x of this.standing(0)) this.heal(a, x, n);
        this.flush();
      } else if (this.canCast(a)) {
        this.emit({ t: 'act', side, uid: a.uid, mode: 'cast' });
        this.pending[side] = null;
        a.chill = 0; this.cast(a, {}); this.flush();
      } else {
        this.emit({ t: 'act', side, uid: a.uid, mode: 'attack' });
        attackers.push({ a, bonus: 0 });
      }
    }
    this.attack(attackers); this.pending = [null, null]; this.flush();
    // 常规行动之后：蓄力、压轴、轮换（追击之后不轮换）
    for (const { a, released } of acted) {
      if (!a.alive || a.hp <= 0) continue;
      if (!released && a.chargeMax) {
        const n = 1 + this.hourglasses(a) + (a.side === 0 && this.passives.has('faie_4') && this.faieActive() ? 1 : 0);
        this.addCharge(undefined, a, n);
      }
    }
    for (const { a } of acted) this.kaleosAfter(a);
    for (const { a } of acted) if (a.alive && a.hp > 0 && this.hasTrait(a, 'rotate')) this.rotateToRear(a);
    this.flush();
    if (!this.outcome()) this.beatEnd();
    this.actors = [null, null];
  }
  private beatEnd() {
    // 1. 固有规则先于关卡规则；每次规则之间结算死亡。
    this.responses = 0;
    this.flush();
    this.triggerRules('beatEnd');
    this.flush();
    // 2. 灼烧
    for (const u of this.units.filter(x => this.onField(x) && x.burn > 0).sort(Battle.cmp)) {
      this.hit(undefined, u, u.burn + (u.side === 1 && this.passives.has('g_ember') ? 1 : 0), 'burn');
      u.burn = Math.max(0, u.burn - 1);
    }
    this.flush();
    // 3. 疲劳
    if (this.beat >= FATIGUE_BEAT) {
      const n = this.beat - FATIGUE_BEAT + 1;
      for (const u of this.units.filter(x => this.onField(x)).sort(Battle.cmp)) this.hit(undefined, u, n, 'fatigue');
      this.flush();
    }
    // 4. 其他「每次交锋结束时」
    for (const u of this.units.filter(x => this.onField(x) && this.def(x).onBeatEnd).sort(Battle.cmp)) {
      this.respond(u, 'beatEnd', this.def(u).onBeatEnd!, {});
      this.flush();
    }
    // 5. 节拍
    for (const u of this.units.filter(x => this.onField(x) && this.def(x).traits?.pulse).sort(Battle.cmp)) {
      if (!u.alive || u.hp <= 0) continue;
      const max = this.pulseMax(u);
      u.pulse = (u.pulse ?? 0) + 1;
      if (u.pulse < max) continue;
      u.pulse = 0;
      const d = this.def(u);
      if (d.onPulse) this.respond(u, 'pulse', d.onPulse, { slot: u.slot });
      this.flush();
    }
    // 6. 在队尾时
    for (const side of [0, 1] as Side[]) {
      const r = this.rear(side), d = r && this.def(r);
      if (r && d?.onRear && this.standing(side).length > 1) { this.respond(r, 'rear', d.onRear, {}); this.flush(); }
    }
    // 7. 主将
    if (this.passives.has('sajj_1')) for (const r of this.reserve) {
      if (r.chargeMax) this.addCharge(undefined, r, 1);
      else if ((this.reserveGain.get(r.uid) ?? 0) < 3) { this.reserveGain.set(r.uid, (this.reserveGain.get(r.uid) ?? 0) + 1); r.atk++; }
    }
    if (this.gen?.id === 'zilan' && this.passives.has('zilan_4') && this.zilanSpins < 3) { this.zilanSpins++; this.zilanSpin(); }
    this.zirixTick();
    this.flush();
  }
  private triggerRules(on: 'beatEnd' | 'hpBelow' | 'afterRecall', target?: UnitState, recalled: UnitState[] = []) {
    for (const state of this.rules) {
      const r = state.rule, tr = r.trigger;
      if (tr.on !== on || state.count >= (r.maxTriggers ?? Infinity)) continue;
      const source = state.source === undefined ? undefined : this.u(state.source);
      if (source && (!source.alive || source.hp <= 0)) continue;
      if (tr.on === 'beatEnd' && (tr.every <= 0 || this.beat % tr.every !== 0)) continue;
      if (tr.on === 'hpBelow' && (!source || target?.uid !== source.uid || source.hp >= source.maxHp * tr.ratio)) continue;
      // 召回事件只归属本侧、本次来源；空召回不触发增强或消耗增强次数。
      if (tr.on === 'afterRecall' && (!recalled.length || target?.side !== r.side || (source && target.uid !== source.uid))) continue;
      // 入队前占用触发次数，防止同一批多次受伤重复排入一次性规则。
      state.count++;
      const execute = () => {
        if (source && (!source.alive || source.hp <= 0)) return;
        if (!r.intrinsic) this.emit({ t: 'rule', id: r.id, label: r.label, side: r.side, src: source?.uid });
        for (const effect of r.effects) this.ruleEffect(effect, r.side, source, state.pulled, recalled);
      };
      if (on === 'hpBelow') this.enqueue(execute);
      else { execute(); if (on === 'beatEnd') this.flush(); }
    }
  }
  private ruleEffect(e: BattleRuleEffect, side: Side, source: UnitState | undefined, pulled: Set<number>, recalled: UnitState[]) {
    const foe = (1 - side) as Side;
    if (e.op === 'pullRearToFront') {
      if (e.blockedBy && this.spells.has(e.blockedBy)) return;
      const team = this.living(foe).filter(u => u.hp > 0), rear = team.at(-1);
      if (!rear || team.length < 2 || team.length !== this.living(foe).length || (e.oncePerTarget && pulled.has(rear.uid))) return;
      pulled.add(rear.uid);
      if (source) this.label(source, 'boss');
      this.layout(foe, [rear, ...team.slice(0, -1)]);
      this.emit({ t: 'pull', uid: rear.uid, src: source?.uid });
    } else if (e.op === 'chillHighestAttack') {
      const t = this.atk1(foe);
      if (t) { if (source) this.label(source, 'boss'); this.chill(source, t, t.atk); }
    } else if (e.op === 'recall') {
      if (source) this.recall(source, e.hpRatio, false);
    } else {
      const targets = e.to === 'allies' ? this.standing(side) : e.to === 'source' ? (source ? [source] : []) : recalled;
      for (const t of targets) {
        if (e.op === 'buff') this.buff(source, t, e.atk, e.hp ?? 0);
        else this.block(source, t, e.amount);
      }
    }
  }
  outcome(): BattleResult | null {
    const p = this.standing(0).length, e = this.standing(1).length;
    return p && e ? null : !p && !e ? 'draw' : p ? 'win' : 'lose';
  }
  run_(): BattleOutput {
    const initial = this.snap();
    let afterStart = initial, result: BattleResult = 'draw', fault: string | undefined;
    try {
      this.startPhase(); afterStart = this.snap();
      this.emit({ t: 'phase', name: 'battle' });
      let outcome = this.outcome();
      while (!outcome && this.beat < MAX_BEATS) { this.doBeat(); outcome = this.outcome(); }
      result = outcome ?? 'draw';
      this.emit({ t: 'end', result, beats: this.beat });
    } catch (e) {
      if (!(e instanceof CombatFault)) throw e;
      fault = e.message; afterStart = this.beat === 0 ? this.snap() : afterStart;
    }
    return {
      result, beats: this.beat, rounds: this.beat ? this.round : 0, log: this.log, afterStart, initial, triggers: this.triggers, metrics: { ...this.metrics },
      eggStats: { ...this.eggStats },
      ...(this.gold ? { gold: this.gold } : {}), ...(fault ? { fault } : {}),
    };
  }
}

export function simulate(setup: BattleSetup): BattleOutput {
  return new Battle(setup).run_();
}
