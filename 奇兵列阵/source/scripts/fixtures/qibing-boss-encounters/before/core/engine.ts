import { effectAmount } from './power';
import { unitDef } from './data';
import { EQUIP_MAP, GENERAL_MAP, POINT_MAP, generalInterval, type EquipDef } from './content';
import { unitLevel } from './types';
import type {
  BattleEvent, BattleOutput, BattleResult, DmgKind, Effect, EnemyEntry, GeneralSetup, Grant, LoggedEvent, Side, Slotted, Snap, Tri,
  TriggerKind, UnitDef, UnitState,
} from './types';

export const SLOTS = 5;
export const MAX_BEATS = 60;
/** 第 N 拍起每拍结束双方全体受（拍数 − N + 1）点狂暴伤害，防止治疗互耗 */
export const FATIGUE_BEAT = 20;
export const MAX_EVENTS = 6000;
/** 单拍内响应（触发效果）上限，防止无限连锁 */
export const MAX_RESPONSES = 240;
export const MAX_BLOCK = 3;
export interface BattleSetup {
  player: (Slotted | EnemyEntry | null)[];
  enemy: (EnemyEntry | null)[];
  general?: GeneralSetup | null;
  /** 本场生效的一次性法术 */
  spells?: readonly string[];
  /** 备战位单位数（后援） */
  bench?: number;
  /** 战斗内随机（后援）用的种子 */
  seed?: number;
  record?: boolean;
}
export const levelStats = (defId: string, level: number) => {
  const d = unitDef(defId), up = Math.max(0, Math.min(2, level - 1));
  return { atk: d.atk + up, hp: d.hp + up * 2 };
};
export const abilityValue = (defId: string, level: number) => unitDef(defId).values?.[level - 1] ?? 0;
export const tri = (t: Tri | undefined, level: number) => t?.[Math.max(1, Math.min(3, level)) - 1] ?? 0;

const LABEL: Record<TriggerKind, string> = {
  start: '开战', cast: '施法', afterAttack: '普攻后', afterCast: '施法后', hurt: '受击', kill: '击杀',
  faint: '阵亡', allyFaint: '友军阵亡', beatEnd: '拍末', aura: '被动', general: '主将', revive: '复活',
  guard: '护卫', boss: '首领', equip: '装备', spell: '法术',
};
const BOOL_GRANTS = new Set<Grant>(['snipe', 'combo', 'reborn', 'guard']);
/** 敌方单体指定目标：会被护卫改选 */
const GUARDED = new Set<Effect['to']>(['enemyRear', 'enemyLowest', 'enemyHighestAtk', 'enemyHighestHp']);

interface Ctx { target?: UnitState; attacker?: UnitState; slot?: number; bonus?: number; cast?: boolean; probe?: boolean }
interface ActOpts { force?: boolean; snipe?: boolean }
class CombatFault extends Error {}

/**
 * 每回合每单位默认一次常规行动；双方每拍至多一人，同一行动轮每人至多一次。
 * 一方用完等待，双方本轮结束才发放下一行动轮；全部次数耗尽进入新回合。
 * 先施法后普攻，普攻双方同时结算；触发效果进入 FIFO 队列，死亡在每个响应之间统一结算。
 * 每拍结束：主将技能 → 首领效果 → 灼烧 → 疲劳 → 其他「每拍结束时」。
 */
export class Battle {
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
  private passives: Set<string>;
  private spells: Set<string>;
  private benchCount: number;
  private seed: number;
  private queue: (() => void)[] = [];
  private killers = new Map<number, UnitState | undefined>();
  private pending: (UnitState | null)[] = [null, null];
  private extraUsed: [number, number] = [0, 0];
  private pulled = new Set<number>();
  private equipsOf = new Map<number, EquipDef[]>();
  private redirected = new Set<number>();
  private cliffBeat = new Map<number, number>();
  private titanBeat = new Map<number, number>();
  private glassGain = new Map<number, number>();
  private surgeUsed = new Set<number>();
  private freeRevives = 0;
  private morale = 0;
  private faieArmor = 0;
  private genTimer = 3;
  private hasted = false;
  private recastBeat = -1;
  /** 白霜巨龙每拍只吃第一次冻结 */
  private wyvernBeat = new Map<number, number>();
  private hankActor = 0;
  private nightDone = false;
  private nextUid = 1;
  private events = 0;
  private responses = 0;

  constructor(setup: BattleSetup) {
    this.record = setup.record !== false;
    this.gen = setup.general && GENERAL_MAP[setup.general.id] ? setup.general : null;
    this.passives = new Set(this.gen?.passives ?? []);
    this.spells = new Set(setup.spells ?? []);
    this.benchCount = setup.bench ?? 0;
    this.seed = (setup.seed ?? 1) | 0;
    this.genTimer = generalInterval(this.gen?.passives ?? []);
    for (const side of [0, 1] as Side[]) {
      const entries = side === 0 ? setup.player : setup.enemy;
      entries.slice(0, SLOTS).forEach((entry, slot) => {
        if (!entry) return;
        const u = this.spawn(side, slot, entry.defId, unitLevel(entry));
        if ('ownedId' in entry) {
          u.ownedId = entry.ownedId;
          this.outfit(u, entry);
        }
        const e = entry as EnemyEntry;
        if (e.atk !== undefined) u.atk = Math.max(1, e.atk);
        if (e.hp !== undefined) u.hp = u.maxHp = e.hp;
        if (e.block) u.block = Math.min(MAX_BLOCK, e.block);
      });
    }
    // 本场生效、开战前就决定的数值
    for (const u of this.units) {
      if (u.side === 0 && this.spells.has('sp_warsong')) u.atk += 2;
      if (u.side === 1 && this.spells.has('sp_sunder')) u.grants.armor = (u.grants.armor ?? 0) - 2;
    }
    if (this.spells.has('sp_revive')) this.freeRevives++;
    if (this.passives.has('g_revive')) this.freeRevives++;
    if (this.passives.has('lilithe_4')) this.freeRevives++;
    this.constructing = false;
    this.refreshArmor();
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
      u.atk = Math.max(1, u.atk + (e.atk ?? 0));
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

  /** 当前行动轮仍可出手的单位，按实际位置排列。 */
  order(side: Side): UnitState[] {
    return this.standing(side).filter(u => (u.actionsLeft ?? 0) > 0 && !this.waveUsed.has(u.uid));
  }
  /** 只读预测：当前轮、额外轮、下回合；不会为等待方重新派发。 */
  private futureOrder(side: Side): UnitState[] {
    const st = this.standing(side), now = this.order(side);
    const later = st.filter(u => (u.actionsLeft ?? 0) > 0 && !now.includes(u));
    return [...now, ...later, ...st.filter(u => !now.includes(u) && !later.includes(u))];
  }
  private prepareWave() {
    if (this.order(0).length || this.order(1).length) return;
    this.waveUsed.clear();
    if (this.standing(0).some(u => (u.actionsLeft ?? 0) > 0) || this.standing(1).some(u => (u.actionsLeft ?? 0) > 0)) this.wave++;
    else {
      this.round++; this.wave = 1; this.actionGrants.clear();
      for (const u of this.units) u.actionsLeft = u.alive && u.hp > 0 ? 1 : 0;
    }
  }
  addAction(src: UnitState | undefined, t: UnitState, n: number) {
    if (!t.alive || t.hp <= 0 || n <= 0) return;
    t.actionsLeft = (t.actionsLeft ?? 0) + n;
    this.emit({ t: 'actionGain', src: src?.uid, uid: t.uid, n, total: t.actionsLeft });
  }
  armor(u: UnitState) {
    const d = this.def(u);
    let a = tri(d.traits?.armor, u.level) + (u.grants.armor ?? 0);
    if (d.special === 'keeper' && this.front(u.side)?.uid === u.uid) a += tri(d.values, u.level);
    for (const n of this.neighbors(u)) if (this.def(n).special === 'conduit') a += tri(this.def(n).values, n.level);
    return Math.max(0, a);
  }
  /** 个人法强：卡面 + 培养 + 装备 + 相邻光环，只强化自己的施法 */
  power(u: UnitState) {
    let p = tri(this.def(u).traits?.power, u.level) + (u.grants.power ?? 0);
    for (const n of this.neighbors(u)) if (this.def(n).special === 'brood') p += tri(this.def(n).values, n.level);
    const before = this.standing(u.side).filter(x => x.slot < u.slot).at(-1);
    if (before && this.def(before).special === 'nobelisk') p += tri(this.def(before).values, before.level);
    return p;
  }
  splash(u: UnitState) { return tri(this.def(u).traits?.splash, u.level) + (u.grants.splash ?? 0); }
  thorns(u: UnitState) { return tri(this.def(u).traits?.thorns, u.level) + (u.grants.thorns ?? 0); }
  hasTrait(u: UnitState, k: 'combo' | 'snipe' | 'reborn' | 'guard') { return !!(this.def(u).traits?.[k] || u.grants[k]); }
  private hasEquip(u: UnitState, special: EquipDef['special']) { return !!this.equipsOf.get(u.uid)?.some(e => e.special === special); }
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
  private refreshArmor() { for (const u of this.units) if (u.alive) { u.armor = this.armor(u); u.power = this.power(u); } }
  private spawn(side: Side, slot: number, defId: string, level: number) {
    const st = levelStats(defId, level), d = unitDef(defId);
    const u: UnitState = {
      uid: this.nextUid++, defId, side, slot, level, atk: Math.max(1, st.atk), hp: st.hp, maxHp: st.hp,
      actionsLeft: this.constructing ? 1 : 0, block: 0, chill: 0, burn: 0, vuln: 0, revived: false, grants: {}, alive: true,
      ...(d.castUses ? { charges: d.castUses } : {}),
    };
    this.units.push(u); this.grid[side][slot] = u.uid; return u;
  }
  private emit(ev: BattleEvent) {
    if (++this.events > MAX_EVENTS) throw new CombatFault('事件超过上限');
    if (this.record) { this.log.push({ ev, snap: this.snap() }); }
  }
  private label(u: UnitState, kind: TriggerKind) {
    if (kind !== 'general') this.triggers[u.defId] = (this.triggers[u.defId] ?? 0) + 1;
    this.emit({ t: 'trigger', src: u.uid, side: u.side, kind, label: LABEL[kind] });
  }
  private enqueue(job: () => void) { this.queue.push(job); }
  private flush() {
    for (;;) {
      this.reap();
      const job = this.queue.shift();
      if (!job) break;
      if (++this.responses > MAX_RESPONSES) throw new CombatFault('响应超过上限');
      job();
    }
  }
  private rnd() {
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- 原子效果 ----------
  buff(src: UnitState | undefined, t: UnitState, atk: number, hp: number) {
    if (!t.alive || t.hp <= 0 || (!atk && !hp)) return;
    t.atk = Math.max(1, t.atk + atk); t.hp += hp; t.maxHp += hp;
    this.emit({ t: 'buff', src: src?.uid, tgt: t.uid, atk, hp });
  }
  heal(src: UnitState | undefined, t: UnitState, n: number) {
    n = Math.min(n, t.maxHp - t.hp); if (!t.alive || t.hp <= 0 || n <= 0) return;
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
    if (!t.alive || t.hp <= 0 || n <= 0) return;
    t.burn += n; this.emit({ t: 'burn', src: src?.uid, uid: t.uid, n, total: t.burn });
  }
  vuln(src: UnitState | undefined, t: UnitState, n: number) {
    if (!t.alive || t.hp <= 0 || n <= 0) return;
    t.vuln += n; this.emit({ t: 'vuln', src: src?.uid, uid: t.uid, n, total: t.vuln });
  }
  private grant(src: UnitState | undefined, t: UnitState, g: Grant, v: number) {
    if (!t.alive || t.hp <= 0) return;
    if (BOOL_GRANTS.has(g)) {
      if (t.grants[g as 'snipe']) return;
      (t.grants as Record<string, unknown>)[g] = true;
    } else {
      if (!v) return;
      (t.grants as Record<string, number>)[g] = ((t.grants as Record<string, number>)[g] ?? 0) + v;
    }
    this.emit({ t: 'buff', src: src?.uid, tgt: t.uid, atk: 0, hp: 0 });
  }

  /** 护卫：敌方单体指定效果选中护卫的相邻友军时，改为选中护卫（两侧都有时取靠前的） */
  private guarded(t: UnitState | null, probe = false): UnitState | null {
    if (!t || this.hasTrait(t, 'guard')) return t;
    const g = this.neighbors(t).filter(x => this.hasTrait(x, 'guard')).sort(Battle.cmp)[0];
    if (!g) return t;
    if (!probe) { this.emit({ t: 'guard', from: t.uid, to: g.uid }); this.redirected.add(g.uid); }
    return g;
  }

  /**
   * 伤害管线：格挡 → 易伤（+1，消耗 1 层）→ 护甲（最少 1）→ 扣血 → 受击时。
   * 灼烧、疲劳跳过格挡、易伤与护甲。返回是否命中（含被格挡）。
   */
  hit(src: UnitState | undefined, t: UnitState, n: number, kind: DmgKind): boolean {
    if (!t.alive || t.hp <= 0 || n <= 0) return false;
    const direct = kind !== 'burn' && kind !== 'fatigue';
    const d = this.def(t);
    if (this.redirected.delete(t.uid)) this.onGuarded(t, src);
    if (direct && t.block > 0) {
      t.block--;
      this.emit({ t: 'dmg', src: src?.uid, tgt: t.uid, n: 0, kind, blocked: true });
      this.emit({ t: 'blockBroken', uid: t.uid });
      for (const b of this.standing(t.side)) if (this.def(b).special === 'banner') {
        const v = tri(this.def(b).values, b.level);
        this.enqueue(() => { if (t.alive && t.hp > 0 && b.alive) { this.label(b, 'aura'); this.buff(b, t, v, 0); } });
      }
      if (d.special === 'warden') {
        const v = tri(d.values, t.level);
        this.enqueue(() => { if (t.alive && t.hp > 0) { this.label(t, 'aura'); this.heal(t, t, v); } });
      }
      return true;
    }
    const hadVuln = t.vuln > 0;
    let vulnUsed = 0;
    if (direct && t.vuln > 0) {
      n += 1; t.vuln--; vulnUsed = 1;
      const onyx = kind === 'attack' && src ? this.standing(src.side).find(x => this.def(x).special === 'onyx') : undefined;
      if (onyx) {
        if (t.vuln > 0) { t.vuln--; vulnUsed++; }
        n += tri(this.def(onyx).values, onyx.level);
      }
    }
    if (direct) n = Math.max(1, n - this.armor(t));
    if (kind === 'attack' && t.side === 0 && this.passives.has('g_core') && this.front(0)?.uid === t.uid) n = Math.max(1, n - 1);
    t.hp -= n;
    this.emit({ t: 'dmg', src: src?.uid, tgt: t.uid, n, kind, ...(vulnUsed ? { vuln: vulnUsed } : {}) });
    if (t.hp <= 0 && !this.killers.has(t.uid)) this.killers.set(t.uid, src);
    if (hadVuln) for (const g of this.standing((1 - t.side) as Side)) if (this.def(g).special === 'glass') {
      const cap = tri(this.def(g).values, g.level);
      this.enqueue(() => {
        const got = this.glassGain.get(g.uid) ?? 0;
        if (got >= cap || !g.alive || g.hp <= 0) return;
        this.glassGain.set(g.uid, got + 1); this.label(g, 'aura'); this.buff(g, g, 1, 0);
      });
    }
    if (d.special === 'nightk' && !this.nightDone && t.hp > 0 && t.hp * 2 < t.maxHp) {
      this.nightDone = true;
      this.enqueue(() => this.recall(t));
    }
    if (d.onHurt) this.enqueue(() => {
      if (!t.alive || t.hp <= 0) return;
      this.respond(t, 'hurt', d.onHurt!, { attacker: src });
    });
    return true;
  }
  /** 护卫替友军承伤之后 */
  private onGuarded(g: UnitState, src?: UnitState) {
    const d = this.def(g);
    if (d.special === 'cliff' && this.cliffBeat.get(g.uid) !== this.beat) {
      this.cliffBeat.set(g.uid, this.beat);
      const v = tri(d.values, g.level);
      this.enqueue(() => { if (g.alive && g.hp > 0) { this.label(g, 'guard'); this.block(g, g, v); } });
    }
    if (d.special === 'dkeeper' && src && src.side !== g.side) {
      this.enqueue(() => { if (g.alive && src.alive && src.hp > 0) { this.label(g, 'guard'); this.vuln(g, src, tri(d.values, g.level)); } });
    }
  }
  /** 永夜君王：召回本场阵亡的随从（生命减半），自己获得 3 层格挡 */
  private recall(boss: UnitState) {
    if (!boss.alive || boss.hp <= 0) return;
    this.label(boss, 'boss');
    for (const m of this.units.filter(x => x.side === boss.side && !x.alive && x.uid !== boss.uid).sort((a, b) => a.uid - b.uid)) {
      const slot = this.grid[m.side][m.slot] == null ? m.slot : this.grid[m.side].findIndex(x => x == null);
      if (slot < 0) break;
      m.alive = true; m.slot = slot; m.hp = Math.max(1, Math.ceil(m.maxHp / 2));
      // 召回属于重新入场；与原位即时复生不同，本回合剩余机会不继承。
      m.actionsLeft = 0; this.waveUsed.add(m.uid);
      m.block = m.chill = m.burn = m.vuln = 0;
      this.grid[m.side][slot] = m.uid;
      this.emit({ t: 'recall', uid: m.uid, src: boss.uid });
    }
    this.block(boss, boss, 3);
  }

  /** 统一结算濒死单位：阵亡 → 复生 → 阵亡时 / 友军阵亡时 / 击杀时 */
  private reap() {
    const dying = this.units.filter(u => u.alive && u.hp <= 0).sort(Battle.cmp);
    for (const u of dying) {
      const killer = this.killers.get(u.uid); this.killers.delete(u.uid);
      const exiled = killer?.defId === 'e_exile' || undefined;
      const hadVuln = u.vuln > 0;
      u.alive = false; u.hp = 0; u.block = 0; u.chill = 0; u.burn = 0; u.vuln = 0;
      this.emit({ t: 'death', tgt: u.uid, ...(exiled ? { exiled } : {}) });
      const d = this.def(u);
      const byTrait = this.hasTrait(u, 'reborn') && !u.revived;
      if (!exiled && (byTrait || (u.side === 0 && this.freeRevives > 0))) {
        if (byTrait) u.revived = true; else this.freeRevives--;
        u.alive = true; u.hp = 1;
        this.emit({ t: 'revive', uid: u.uid });
        if (d.onRevive) this.enqueue(() => this.respond(u, 'revive', d.onRevive!, {}));
      } else this.grid[u.side][u.slot] = null;
      if (d.onFaint) { const slot = u.slot; this.enqueue(() => this.respond(u, 'faint', d.onFaint!, { slot }, true)); }
      for (const a of this.standing(u.side)) {
        const ad = this.def(a);
        if (a.uid !== u.uid && ad.onAllyFaint) this.enqueue(() => { if (a.alive && a.hp > 0) this.respond(a, 'allyFaint', ad.onAllyFaint!, {}); });
      }
      if (u.side === 0) {
        if (this.passives.has('g_martyr')) {
          const slot = u.slot;
          this.enqueue(() => {
            const b = this.standing(0).find(x => x.slot > slot && x.uid !== u.uid);
            if (b) { this.label(b, 'general'); this.buff(undefined, b, 2, 2); }
          });
        }
        if (this.passives.has('lilithe_1')) this.enqueue(() => this.genCast());
      }
      if (u.side === 1 && hadVuln && this.passives.has('zirix_4') && !this.hasted) { this.hasted = true; this.genTimer--; }
      if (killer && killer.side !== u.side) {
        const kd = this.def(killer);
        if (kd.onKill) this.enqueue(() => { if (killer.alive && killer.hp > 0) this.respond(killer, 'kill', kd.onKill!, { target: u }); });
        if (killer.side === 0 && this.passives.has('g_morale') && this.morale < 3) {
          this.morale++;
          this.enqueue(() => { for (const a of this.standing(0)) this.buff(undefined, a, 1, 0); });
        }
        if (killer.uid === this.hankActor && this.passives.has('hank_2') && this.gold < 2) this.gold++;
      }
    }
  }

  private summon(src: UnitState | undefined, side: Side, slot: number, token: string, atk: number, hp: number) {
    if (this.grid[side][slot] == null) {
      const s = this.spawn(side, slot, token, 1);
      s.atk = Math.max(1, atk); s.hp = s.maxHp = hp;
      this.emit({ t: 'summon', uid: s.uid, src: src?.uid });
      return;
    }
    // 原位被占（例如复生）：改为最近的友军 +atk/+hp
    const near = this.standing(side).sort((a, b) => Math.abs(a.slot - slot) - Math.abs(b.slot - slot) || Battle.cmp(a, b))[0];
    if (near) this.buff(src, near, atk, hp);
  }

  // ---------- 效果解释 ----------
  private targets(u: UnitState, to: Effect['to'], ctx: Ctx): UnitState[] {
    const foe = (1 - u.side) as Side, slot = ctx.slot ?? u.slot;
    const one = (x: UnitState | null | undefined) => (x && x.alive && x.hp > 0 ? [x] : []);
    const g = (x: UnitState | null) => (GUARDED.has(to) ? this.guarded(x, ctx.probe) : x);
    switch (to) {
      case 'self': return one(u);
      case 'front': return one(this.front(u.side));
      case 'rear': return one(this.rear(u.side));
      case 'allies': return this.standing(u.side);
      case 'adjacent': return this.neighbors(u, slot);
      case 'ahead': return one(this.standing(u.side).filter(x => x.slot < slot && x.uid !== u.uid).at(-1));
      case 'behind': return one(this.standing(u.side).find(x => x.slot > slot && x.uid !== u.uid));
      case 'lowest': return one(this.standing(u.side).filter(x => x.hp < x.maxHp).sort((a, b) => a.hp - b.hp || Battle.cmp(a, b))[0]);
      case 'highestAtk': return one(this.atk1(u.side, u.uid));
      case 'highestHp': return one(this.hpTop(u.side));
      case 'adjHighestAtk': return one(this.neighbors(u, slot).sort((a, b) => b.atk - a.atk || Battle.cmp(a, b))[0]);
      case 'guardAllies': return this.standing(u.side).filter(x => this.hasTrait(x, 'guard'));
      case 'enemyFront': return one(this.front(foe));
      case 'enemyRear': return one(g(this.rear(foe)));
      case 'enemyLowest': return one(g(this.hp1(foe)));
      case 'enemyHighestAtk': return one(g(this.atk1(foe)));
      case 'enemyHighestHp': return one(g(this.hpTop(foe)));
      case 'enemyAll': return this.standing(foe);
      case 'enemyNext': {
        const p = this.pending[foe];
        return one(p && p.alive && p.hp > 0 ? p : this.futureOrder(foe)[0]);
      }
      case 'attacker': return one(ctx.attacker && ctx.attacker.side !== u.side ? ctx.attacker : null);
      case 'target': return one(ctx.target);
      case 'burningEnemies': return this.standing(foe).filter(x => x.burn > 0);
      case 'otherEnemies': return this.standing(foe).filter(x => x.uid !== ctx.target?.uid);
    }
  }
  private apply(u: UnitState, effects: Effect[], ctx: Ctx): boolean {
    let any = false;
    const pw = ctx.cast ? this.power(u) : 0;
    for (const e of effects) {
      if (!this.effectUseful(u, e, ctx)) continue;
      const v = effectAmount(e, tri(e.v, u.level), pw, !!ctx.cast);
      const v2 = tri(e.v2, u.level);
      if (e.op !== 'grant' && e.op !== 'extraAct' && e.op !== 'summon' && v <= 0 && v2 <= 0) continue;
      if (e.op === 'summon') { this.summon(u, u.side, ctx.slot ?? u.slot, e.token!, v, v2 || v); any = true; continue; }
      const ts = this.targets(u, e.to, ctx);
      for (const t of ts) {
        any = true;
        switch (e.op) {
          case 'dmg': this.hit(u, t, v, 'ability'); break;
          case 'heal': this.heal(u, t, v); break;
          case 'block': this.block(u, t, v); break;
          case 'chill': this.chill(u, t, v); break;
          case 'burn': this.burn(u, t, v); break;
          case 'vuln': this.vuln(u, t, v); break;
          case 'buff': this.buff(u, t, v, v2); break;
          case 'grant': if (e.grant) this.grant(u, t, e.grant, v); break;
          case 'extraAct': this.extraAct(t, v); break;
          case 'addAction':
            this.addAction(u, t, v);
            if (e.oncePerRound) { const used = this.actionGrants.get(u.uid) ?? new Set<Effect>(); used.add(e); this.actionGrants.set(u.uid, used); }
            break;
          case 'sacrifice': {
            const receiver = this.standing(u.side).filter(x => x.uid !== u.uid && x.uid !== t.uid).sort((a, b) => b.atk - a.atk || Battle.cmp(a, b))[0];
            if (!receiver) break;
            t.hp = 0; this.killers.delete(t.uid);
            this.emit({ t: 'sacrifice', src: u.uid, tgt: t.uid });
            this.buff(u, receiver, v, 0);
            break;
          }
        }
      }
    }
    this.redirected.clear();
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
  private extraCap(side: Side) { return side === 0 && this.passives.has('g_chain') ? 2 : 1; }
  /** 能施法：有施法、次数未用完、且至少一个效果有用；否则这次出手改为普攻 */
  canCast(u: UnitState) {
    const d = this.def(u);
    if (!d.cast || (u.charges !== undefined && u.charges <= 0)) return false;
    return d.cast.some(e => this.effectUseful(u, e, { probe: true }));
  }
  private effectUseful(u: UnitState, e: Effect, ctx: Ctx) {
    if (e.op === 'summon') return true;
    if (e.op === 'extraAct' && this.extraUsed[u.side] >= this.extraCap(u.side)) return false;
    if (e.op === 'addAction' && (tri(e.v, u.level) <= 0 || (e.oncePerRound && this.actionGrants.get(u.uid)?.has(e)))) return false;
    return this.targets(u, e.to, { ...ctx, probe: true }).some(t =>
      e.op === 'heal' ? t.hp < t.maxHp : e.op === 'block' ? t.block < MAX_BLOCK :
      e.op === 'sacrifice' ? this.standing(u.side).some(x => x.uid !== u.uid && x.uid !== t.uid) : true);
  }

  /** 寒意检查：寒意 ≥ 当前攻击 → 冻结，跳过这次出手 */
  private frozen(u: UnitState, bonus = 0) {
    if (u.chill <= 0 || u.chill < u.atk + bonus) return false;
    u.chill = 0;
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
    }
    if (u.side === 1 && this.passives.has('g_tide')) {
      const ns = this.neighbors(u);
      this.enqueue(() => { for (const n of ns) this.chill(undefined, n, 2); });
    }
    return true;
  }
  private cast(u: UnitState, ctx: Ctx) {
    const d = this.def(u);
    if (u.charges !== undefined) u.charges--;
    if (!this.apply(u, d.cast!, { ...ctx, cast: true })) this.emit({ t: 'fizzle', src: u.uid, reason: '没有有效目标' });
    this.triggers[u.defId] = (this.triggers[u.defId] ?? 0) + 1;
    if (u.side === 0 && this.passives.has('g_surge') && !this.surgeUsed.has(u.uid)) {
      this.surgeUsed.add(u.uid);
      this.enqueue(() => { if (u.alive && u.hp > 0 && this.canCast(u)) { this.label(u, 'general'); this.apply(u, d.cast!, { cast: true }); } });
    }
    for (const m of this.standing(u.side)) {
      const md = this.def(m);
      if (md.special === 'matriarch') {
        const v = tri(md.values, m.level);
        this.enqueue(() => { if (m.alive && m.hp > 0) { this.label(m, 'afterCast'); const t = this.front((1 - m.side) as Side); if (t) this.hit(m, t, v, 'ability'); } });
      }
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
  /** 立即攻击：不施法、不消耗常规行动；每方每拍最多 1 次（因此不能链式）；仍做寒意检查。force 不占次数（主将） */
  private extraAct(u: UnitState, bonus: number, opts: ActOpts = {}) {
    if (!u.alive || u.hp <= 0) return;
    if (!opts.force) {
      if (this.extraUsed[u.side] >= this.extraCap(u.side)) return;
      this.extraUsed[u.side]++;
    }
    this.emit({ t: 'act', side: u.side, uid: u.uid, mode: 'extra' });
    if (this.frozen(u, bonus)) return;
    this.attack([{ a: u, bonus, snipe: opts.snipe }]);
  }

  /** 普攻（可多人同时）：先锁定目标，所有段数交替结算，最后统一响应 */
  private attack(list: { a: UnitState; bonus: number; snipe?: boolean }[]) {
    const plans = list.filter(p => p.a.alive && p.a.hp > 0 && !this.frozen(p.a, p.bonus)).map(p => {
      const a = p.a, foe = (1 - a.side) as Side, snipe = !!p.snipe || this.hasTrait(a, 'snipe');
      const tgt = snipe ? this.guarded(this.rear(foe)) : this.front(foe);
      const chilled = Math.min(a.chill, a.atk + p.bonus - 1);
      const base = Math.max(1, a.atk + p.bonus - a.chill);
      a.chill = 0;
      const combo = this.hasTrait(a, 'combo');
      return { a, foe, snipe, tgt, chilled, hits: combo ? [Math.ceil(base / 2), Math.ceil(base / 2)] : [base], hadVuln: !!tgt && tgt.vuln > 0 };
    }).filter(p => p.tgt);
    if (!plans.length) return;
    this.emit({ t: 'attack', pairs: plans.map(p => ({ atk: p.a.uid, tgt: p.tgt!.uid, ...(p.chilled > 0 ? { chill: p.chilled } : {}) })) });
    const maxHits = Math.max(...plans.map(p => p.hits.length));
    for (let i = 0; i < maxHits; i++) {
      for (const p of plans) {
        if (i >= p.hits.length) continue;
        let t = p.tgt!;
        if (!t.alive || t.hp <= 0) {
          const n = p.snipe ? this.guarded(this.rear(p.foe)) : this.front(p.foe);
          if (!n) continue;
          t = p.tgt = n;
        }
        const a = p.a, ad = this.def(a);
        let n = p.hits[i];
        if (ad.special === 'scout' && t.chill > 0) n += t.chill;
        if (ad.special === 'lion') n += a.block * tri(ad.values, a.level);
        if (this.hasEquip(a, 'hammer') && this.armor(t) > 0) n += 2;
        const hitTargets = [t];
        const landed = this.hit(a, t, n, 'attack');
        const thorns = this.thorns(t);
        if (landed && thorns > 0 && a.alive) this.hit(t, a, thorns, 'thorns');
        if (i === 0) {
          const splash = this.splash(a);
          const behind = this.standing(p.foe).find(x => x.slot > t.slot);
          if (splash > 0 && behind) {
            this.hit(a, behind, splash, 'splash'); hitTargets.push(behind);
            if (ad.special === 'sandblade') this.vuln(a, behind, 1);
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
    this.redirected.clear();
    for (const p of plans) {
      const a = p.a, ad = this.def(a), target = p.tgt!;
      if (ad.afterAttack) this.enqueue(() => this.respond(a, 'afterAttack', ad.afterAttack!, { target }));
      if (ad.special === 'monk' && p.hadVuln) {
        const v = tri(ad.values, a.level);
        this.enqueue(() => { if (a.alive && a.hp > 0) { this.label(a, 'afterAttack'); this.buff(a, a, v, 0); } });
      }
      for (const e of this.equipsOf.get(a.uid) ?? []) if (e.afterAttack) this.enqueue(() => this.respond(a, 'equip', e.afterAttack!, { target }));
    }
  }

  private pick(side: Side) {
    const u = this.order(side)[0] ?? null;
    if (u) { this.waveUsed.add(u.uid); u.actionsLeft = Math.max(0, (u.actionsLeft ?? 0) - 1); this.ptr[side] = (u.slot + 1) % SLOTS; }
    return u;
  }

  // ---------- 主将 ----------
  /** 主将技能：数值 = 基础值 + 主将法强；施法动作由 gen 事件表现 */
  private genCast() {
    const g = this.gen;
    if (!g || !this.standing(0).length || !this.standing(1).length) return;
    const P = g.power, has = (k: string) => this.passives.has(k), base = GENERAL_MAP[g.id].base + P;
    const show = (tgts: (UnitState | null | undefined)[], label = '主将技能') =>
      this.emit({ t: 'gen', id: g.id, label, tgts: tgts.filter((x): x is UnitState => !!x).map(x => x.uid) });
    switch (g.id) {
      case 'argeon': {
        const ts = has('argeon_1') ? this.standing(0) : [this.hp1(0)].filter((x): x is UnitState => !!x);
        const heal = has('argeon_1') ? Math.ceil(base / 2) : base;
        show(ts);
        for (const t of ts) {
          this.block(undefined, t, 1 + (has('argeon_2') ? 1 : 0));
          this.heal(undefined, t, heal);
          if (has('argeon_3')) this.buff(undefined, t, 1, 0);
        }
        break;
      }
      case 'kaleos': {
        if (has('kaleos_3')) { const a = this.atk1(0); if (a) { this.extraAct(a, 0, { force: true }); this.flush(); } }
        const t = this.guarded(this.hp1(1));
        const r = has('kaleos_2') ? this.guarded(this.rear(1)) : null;
        const ts = [t, r && r.uid !== t?.uid ? r : null].filter((x): x is UnitState => !!x);
        if (!ts.length) return;
        show(ts);
        for (const x of ts) { this.hit(undefined, x, base, 'ability'); if (has('kaleos_4')) this.vuln(undefined, x, 2); }
        this.redirected.clear();
        this.flush();
        if (has('kaleos_1') && ts.some(x => !x.alive) && this.recastBeat !== this.beat) { this.recastBeat = this.beat; this.genCast(); }
        break;
      }
      case 'lilithe': {
        const ts = has('lilithe_2') ? this.standing(1) : [this.front(1)].filter((x): x is UnitState => !!x);
        const n = has('lilithe_2') ? Math.max(1, base - 1) : base;
        const hs = has('lilithe_3') ? this.standing(0) : [this.front(0)].filter((x): x is UnitState => !!x);
        show(ts);
        for (const t of ts) this.hit(undefined, t, n, 'ability');
        for (const h of hs) this.heal(undefined, h, n);
        break;
      }
      case 'vulkan': {
        if (has('vulkan_2')) for (const b of this.standing(1).filter(x => x.burn > 0)) this.hit(undefined, b, b.burn, 'ability');
        this.flush();
        const st = this.standing(1);
        const ts = has('vulkan_1') ? st.slice(0, 2) : st.slice(0, 1);
        show(ts);
        const n = base + (has('vulkan_4') ? P : 0);
        for (const t of ts) this.burn(undefined, t, n);
        if (has('vulkan_3')) { const a = this.atk1(0); if (a) this.buff(undefined, a, 2, 0); }
        break;
      }
      case 'faie': {
        const ts = this.futureOrder(1).slice(0, has('faie_1') ? 2 : 1);
        show(ts);
        let froze = false;
        for (const t of ts) { this.chill(undefined, t, base); if (t.chill >= t.atk) froze = true; }
        if (froze && has('faie_2')) for (const e of this.standing(1)) this.chill(undefined, e, 1);
        if (has('faie_3') && this.faieArmor < 3) { const f = this.front(0); if (f) { this.faieArmor++; this.grant(undefined, f, 'armor', 1); } }
        break;
      }
      case 'zirix': {
        const ts = has('zirix_1') ? this.standing(1) : [this.guarded(this.front(1))].filter((x): x is UnitState => !!x);
        const n = has('zirix_1') ? 1 + Math.floor(P / 2) : base;
        show(ts);
        for (const t of ts) { this.vuln(undefined, t, n); if (has('zirix_3')) this.grant(undefined, t, 'armor', -1); }
        this.redirected.clear();
        if (has('zirix_2')) { const f = this.front(0); if (f) this.block(undefined, f, 1); }
        break;
      }
      case 'hank': {
        const a = this.atk1(0);
        if (!a) return;
        show([a]);
        this.hankActor = a.uid;
        this.extraAct(a, P + (has('hank_1') ? 2 : 0), { force: true, snipe: has('hank_4') });
        this.flush();
        this.hankActor = 0;
        break;
      }
    }
    this.flush();
  }

  // ---------- 阶段 ----------
  private startPhase() {
    this.emit({ t: 'phase', name: 'start' });
    this.responses = 0;
    const allies = () => this.standing(0), foes = () => this.standing(1);
    if (this.passives.has('g_elite') && allies().length <= 4) for (const a of allies()) this.buff(undefined, a, 2, 4);
    if (this.passives.has('g_wall')) for (const a of allies()) this.block(undefined, a, 1);
    if (this.passives.has('g_breach')) for (const e of foes()) { e.block = 0; this.grant(undefined, e, 'armor', -1); }
    if (this.passives.has('g_weak')) for (const e of foes()) this.vuln(undefined, e, 2);
    if (this.passives.has('g_reserve')) for (let i = 0; i < this.benchCount; i++) {
      const st = allies(); if (!st.length) break;
      this.buff(undefined, st[Math.floor(this.rnd() * st.length)], 1, 2);
    }
    if (this.spells.has('sp_haste')) { const f = this.front(0); if (f) this.addAction(undefined, f, 1); }
    if (this.spells.has('sp_shield')) for (const a of allies()) this.block(undefined, a, 1);
    if (this.spells.has('sp_firerain')) for (const e of foes()) this.burn(undefined, e, 3);
    if (this.spells.has('sp_freeze')) { const f = this.front(1); if (f) this.chill(undefined, f, f.atk); }
    this.flush();
    const starters = this.units.filter(u => u.alive && (this.def(u).onStart || this.equipsOf.get(u.uid)?.some(e => e.onStart))).sort(Battle.cmp);
    for (const u of starters) {
      this.responses = 0;
      const d = this.def(u);
      if (d.onStart) this.respond(u, 'start', d.onStart, {});
      for (const e of this.equipsOf.get(u.uid) ?? []) if (e.onStart) this.respond(u, 'equip', e.onStart, {});
      this.flush();
    }
    if (this.passives.has('g_first')) {
      this.responses = 0;
      const a = this.atk1(0);
      if (a) { this.label(a, 'general'); this.extraAct(a, 0, { force: true }); this.flush(); }
    }
  }
  private doBeat() {
    this.prepareWave();
    this.beat++;
    this.responses = 0;
    this.extraUsed = [0, 0];
    this.emit({ t: 'beat', n: this.beat, round: this.round, wave: this.wave, next: { player: this.order(0).map(u => u.uid), enemy: this.order(1).map(u => u.uid) } });
    const actors = [this.pick(0), this.pick(1)];
    this.pending = [...actors];
    const attackers: { a: UnitState; bonus: number }[] = [];
    for (const side of [0, 1] as Side[]) {
      const a = actors[side];
      if (!a || !a.alive || a.hp <= 0) { this.pending[side] = null; continue; }
      if (this.frozen(a)) { this.pending[side] = null; this.flush(); continue; }
      if (this.canCast(a)) {
        this.emit({ t: 'act', side, uid: a.uid, mode: 'cast' });
        this.pending[side] = null;
        a.chill = 0; this.cast(a, {}); this.flush();
      } else {
        this.emit({ t: 'act', side, uid: a.uid, mode: 'attack' });
        attackers.push({ a, bonus: 0 });
      }
    }
    this.attack(attackers); this.pending = [null, null]; this.flush();
    if (!this.outcome()) this.beatEnd();
  }
  private beatEnd() {
    // 1. 主将技能
    if (this.gen && --this.genTimer <= 0) {
      this.genTimer = generalInterval(this.gen.passives);
      this.hasted = false;
      this.responses = 0;
      this.genCast();
    }
    // 2. 首领效果
    for (const boss of this.standing(1).filter(u => this.def(u).boss)) {
      const sp = this.def(boss).special;
      if (sp === 'void' && this.beat % 3 === 0 && !this.spells.has('sp_anchor')) {
        // 虚空领主：把玩家队尾拉到队首，每个单位本场只被拉一次
        const team = this.standing(0), r = team.at(-1);
        if (r && team.length > 1 && !this.pulled.has(r.uid)) {
          this.pulled.add(r.uid);
          const slots = team.map(u => u.slot), order = [r, ...team.slice(0, -1)];
          order.forEach((u, i) => { u.slot = slots[i]; this.grid[0][slots[i]] = u.uid; });
          this.label(boss, 'boss');
          this.emit({ t: 'pull', uid: r.uid, src: boss.uid });
        }
      }
      if (sp === 'frostq' && this.beat % 3 === 0) {
        // 霜魇女皇：你攻击最高的单位获得等同其攻击的寒意
        const t = this.atk1(0);
        if (t) { this.label(boss, 'boss'); this.chill(boss, t, t.atk); }
      }
    }
    this.flush();
    // 3. 灼烧
    for (const u of this.units.filter(x => x.alive && x.hp > 0 && x.burn > 0).sort(Battle.cmp)) {
      this.hit(undefined, u, u.burn + (u.side === 1 && this.passives.has('g_ember') ? 1 : 0), 'burn');
      u.burn = Math.max(0, u.burn - 1);
    }
    this.flush();
    // 4. 疲劳
    if (this.beat >= FATIGUE_BEAT) {
      const n = this.beat - FATIGUE_BEAT + 1;
      for (const u of this.units.filter(x => x.alive && x.hp > 0).sort(Battle.cmp)) this.hit(undefined, u, n, 'fatigue');
      this.flush();
    }
    // 5. 其他「每拍结束时」
    for (const u of this.units.filter(x => x.alive && x.hp > 0 && this.def(x).onBeatEnd).sort(Battle.cmp)) {
      const d = this.def(u);
      if (d.beatEvery && this.beat % d.beatEvery !== 0) continue;
      this.respond(u, 'beatEnd', d.onBeatEnd!, {});
      this.flush();
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
      result, beats: this.beat, log: this.log, afterStart, initial, triggers: this.triggers,
      ...(this.gold ? { gold: this.gold } : {}), ...(fault ? { fault } : {}),
    };
  }
}

export function simulate(setup: BattleSetup): BattleOutput {
  return new Battle(setup).run_();
}
