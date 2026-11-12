// 碰撞制战斗引擎：队首对队首同时互打，后排只靠事件技能参与（规则照搬 SAP）。
// 纯函数：输入两队，输出事件流 + 结果。播放层只读事件，不再推算规则。
import { BattleStatsCollector, type BattleDamageSource, type BattleStats, type DamageContribution, type DamageSourceKind } from './battleStats';
import type { BattleRule } from './archetypes';
import { STAT_CAP } from './data';
import { card, equipOf, FOOD, RELIC, SHOP_POOL, summonInfo, type Atom, type CardDef, type Ench, type EquipSp, type FoodFx, type KeyKind, type Kw } from './data';

export const QUEUE_MAX = 5;
export const MAX_CLASHES = 30;
const FLY_USES = 3;
/** 鹰召唤的 6 阶单位：按星级补上合并带来的身材 */
const LVL_BONUS = [0, 2, 5];

export interface GrantedAbility {
  id: 'bone' | 'spark' | 'blood' | 'thorn' | 'sprout';
  tempered?: boolean;
  duration: 'battle' | 'permanent';
  value: number;
  source: string;
}

export interface UnitSpec {
  def: string;
  granted?: GrantedAbility;
  startBlock?: number;
  /** 补给预装的本场蓄能。 */
  startCharge?: number;
  /** 消耗型补给提供的本场规则；以补给ID记录，复生保留次数。 */
  supportFoods?: string[];
  /** 备战积攒的首击附伤。 */
  seal?: number;
  /** 总封印中由支持品提供的份额；键为 supply:/equipment:/relic: + ID。 */
  sealSources?: Record<string, number>;
  /** 不降低最大生命的开战伤势。 */
  wounds?: number;
  lvl: 1 | 2 | 3;
  atk: number;
  hp: number;
  /** 我方单位的存档 id */
  oid?: number;
  ench?: Ench | null;
  /** 魂灯：只这一场有复生 */
  lamp?: boolean;
  /** 幼兽蛋积攒的成长 */
  bank?: number;
  /** 精英词缀 */
  ax?: Atom[];
  /** 补给的本场特效 */
  tfx?: FoodFx[];
}

export interface BUnit {
  uid: number;
  side: 0 | 1;
  def: string;
  granted?: GrantedAbility;
  startBlock: number;
  /** 技能来源（法老复制时是被复制的卡） */
  adef: CardDef;
  ab?: string;
  lvl: 1 | 2 | 3;
  atk: number;
  hp: number;
  maxHp: number;
  block: number;
  kws: Kw[];
  reborn: boolean;
  splash: number;
  melee: number;
  uses: number;
  bank: number;
  /** 深渊主母召唤的骷髅：阵亡不再触发主母 */
  flySkel?: boolean;
  oid?: number;
  ench?: Ench | null;
  dead: boolean;
  /** 词条原子（装备 + 精英词缀） */
  ax: Atom[];
  sp?: EquipSp;
  shield: number;
  /** 身上的灼烧层数 */
  burn: number;
  fury: number;
  /** 补给的本场特效 */
  tfx: FoodFx[];
  charged: boolean;
  reap: number;
  /** 不屈剩余次数；lock>0 为锁血中（剩余交锋数） */
  undy: number;
  lock: number;
  charge: number;
  mark: number;
  rounds: number;
  laps: number;
  seal: number;
  sealSources: Record<string, number>;
  movedAt: number;
  rules: RuntimeRule[];
}
/** 战斗规则的运行实例；次数随复生保留，继承独立计数。 */
type CombatRule = BattleRule;
interface RuleCounter { count: number; seen: number }
interface RuntimeRule {
  rule: CombatRule;
  source: string;
  sourceKind: 'unit' | 'equipment' | 'supply' | 'relic';
  sourceName: string;
  counter: RuleCounter;
}


export type Snap = Pick<BUnit, 'uid' | 'side' | 'def' | 'lvl' | 'atk' | 'hp' | 'maxHp' | 'block' | 'kws' | 'shield' | 'burn'> & { ench?: Ench | null; ax?: Atom[]; charge?: number; mark?: number; rounds?: number };
export type Order = [number[], number[]];

export type Ev =
  | { t: 'clash'; n: number; a: number; b: number }
  | { t: 'trigger'; uid: number; label: string }
  | { t: 'dmg'; src: number | null; tgt: number; n: number; blocked: boolean; kind: DmgKind; hp: number; block: number; shield: number }
  | { t: 'stat'; uid: number; shield: number; burn: number }
  | { t: 'heal'; src: number; tgt: number; n: number; hp: number }
  | { t: 'buff'; src: number; tgt: number; atk: number; hp: number; nowAtk: number; nowHp: number; perm?: boolean }
  | { t: 'block'; src: number; tgt: number; n: number; block: number }
  | { t: 'kw'; src: number; tgt: number; kws: Kw[] }
  | { t: 'die'; uid: number; order: Order }
  | { t: 'summon'; src: number | null; unit: Snap; order: Order; revive?: boolean }
  | { t: 'move'; uid: number; from: number; to: number; order: Order; reason?: string }
  | { t: 'counter'; uid: number; charge: number; mark: number; rounds: number }
  | { t: 'fizzle'; uid: number; label: string; reason?: string; ability?: string; source?: string; required?: number; available?: number }
  | { t: 'end'; result: Result };

export type Result = 'win' | 'lose' | 'draw';
/** burn：灼烧/不屈耗尽，无视格挡与护盾 */
export type DmgKind = 'melee' | 'shot' | 'splash' | 'burn';
export interface BattleOut {
  stats: BattleStats;
  init: Snap[];
  initOrder: Order;
  events: Ev[];
  result: Result;
  survivors: number;
  /** 战斗内获得的永久成长（按 oid） */
  perm: Record<number, { atk: number; hp: number }>;
  /** 我方单位实际受伤次数（按 oid，历战用） */
  hurts?: Record<number, number>;
  /** 我方本场召唤次数（不含复生，军团规格用） */
  summons?: number;
}
/** legion：军团规格，我方召唤物入场 +n/+n */
export interface SimOpts { legion?: number; spells?: number; trades?: number; supplies?: number; gold?: number; quarry?: number }

/** 哪些时机标签吃关键卡的额外触发 */
const KEY_LABEL: Record<string, KeyKind> = { 受伤: 'hurt', 开战: 'start', 阵亡: 'faint', 孵化: 'faint' };
const val = (d: CardDef, lvl: number) => (d.v ? d.v[lvl - 1] : 0);
const val2 = (d: CardDef, lvl: number) => (d.u ? d.u[lvl - 1] : 0);

/** 阵容的原生流派数量；通用和敌方不计。 */
export function motleyCount(defs: string[]): number {
  return new Set(defs.map(id => {
    const d = card(id);
    if (d.enemy || d.token || d.id.startsWith('rw_common_')) return null;
    return d.archetype ?? (d.line !== 'any' && d.line !== 'enemy' ? d.line : null);
  }).filter(Boolean)).size;
}

/** relics：我方（左侧）遗物 */
export function simulate(left: UnitSpec[], right: UnitSpec[], seed = 1, relics: readonly string[] = [], opts: SimOpts = {}): BattleOut {
  const R = new Set(relics);
  const legion = opts.legion ?? 0;
  const hurts: Record<number, number> = {};
  const perm: Record<number, { atk: number; hp: number }> = {};
  let summons = 0;
  let clashNo = 0;
  let splitting = false;
  let echoing = false;
  let entrancesEnabled = false;
  const inherited = new Set<string>();
  const teamLaps = [0, 0];
  const teamSummons = [0, 0];
  const originalEdges = new Map<number, [number | undefined, number | undefined]>();
  const faintNeighbors = new Map<number, [BUnit | null, BUnit | null]>();
  const startingSize = [Math.min(QUEUE_MAX, left.length), Math.min(QUEUE_MAX, right.length)];
  let quarryUid: number | null = null;
  const markSources = new Map<number, BattleDamageSource[]>();
  const frontSeen: [number | null, number | null] = [null, null];
  let uid = 1;
  let rs = seed || 1;
  const rnd = () => ((rs = (rs * 1103515245 + 12345) & 0x7fffffff), rs / 0x7fffffff);
  const ev: Ev[] = [];
  const stats = new BattleStatsCollector();
  const burnSources = new Map<number, BattleDamageSource[]>();
  const summonOrigins = new Map<number, BattleDamageSource>();
  const q: [BUnit[], BUnit[]] = [[], []];
  const sharedRelicCounters = new Map<string, RuleCounter>();
  const runtimeRules = (s: UnitSpec, side: 0 | 1): RuntimeRule[] => {
    const native = card(s.def);
    const create = (rule: CombatRule, source: string, sourceKind: RuntimeRule['sourceKind'], sourceName: string, counter: RuleCounter = { count: 0, seen: 0 }): RuntimeRule => ({ rule, source, sourceKind, sourceName, counter });
    const rules = (native.rules ?? []).filter((r): r is CombatRule => r.phase === 'battle').map(r => create(r, native.id, 'unit', native.name));
    const equipment = equipOf(s.ench);
    for (const r of equipment?.rules ?? []) if (r.phase === 'battle') rules.push(create(r, equipment!.id, 'equipment', equipment!.name));
    // 同种补给规则按一份运行；属性/预装资源仍由备战层逐次累计。
    for (const id of new Set(s.supportFoods ?? [])) for (const r of FOOD[id]?.battleRules ?? []) rules.push(create(r, id, 'supply', FOOD[id].name));
    if (side === 0) for (const id of R) {
      const relic = RELIC[id];
      for (const [index, r] of (relic?.battleRules ?? []).entries()) {
        const key = `${side}:${id}:${index}`;
        let counter: RuleCounter | undefined;
        if (relic.counterScope !== 'holder') {
          counter = sharedRelicCounters.get(key);
          if (!counter) { counter = { count: 0, seen: 0 }; sharedRelicCounters.set(key, counter); }
        }
        rules.push(create(r, id, 'relic', relic.name, counter));
      }
    }
    return rules;
  };
  const mk = (s: UnitSpec, side: 0 | 1): BUnit => {
    const d = card(s.def);
    const bounded = (n: number | undefined, cap: number) => Number.isFinite(n) ? Math.min(cap, Math.max(0, Math.floor(n!))) : 0;
    const seal = bounded(s.seal, STAT_CAP);
    let remainingSeal = seal;
    const sealSources: Record<string, number> = {};
    for (const [key, value] of Object.entries(s.sealSources ?? {})) {
      if (!/^(supply|equipment|relic):.+/.test(key)) continue;
      const n = bounded(value, remainingSeal);
      if (n > 0) { sealSources[key] = n; remainingSeal -= n; }
    }
    const kws = [...d.kws];
    const eq = equipOf(s.ench);
    const tfx = s.tfx ?? [];
    if ((eq?.splash || tfx.includes('splash')) && !kws.includes('splash')) kws.push('splash');
    const reborn = kws.includes('reborn') || !!eq?.reborn || !!s.lamp;
    if (reborn && !kws.includes('reborn')) kws.push('reborn');
    const splash = d.kws.includes('splash') ? val(d, s.lvl) || 50 : Math.max(eq?.splash ?? 0, tfx.includes('splash') ? 50 : 0);
    const ax = [...new Set([...(eq?.atoms ?? []), ...(s.ax ?? []), ...(tfx.includes('fury') ? ['fury' as Atom] : []), ...(tfx.includes('undy') ? ['undying' as Atom] : [])])];
    return {
      uid: uid++, side, def: s.def, granted: s.granted ? { ...s.granted } : undefined, startBlock: s.startBlock ?? 0, adef: d, ab: d.ab, lvl: s.lvl, atk: Math.max(1, s.atk), hp: Math.max(1, s.hp - (s.wounds ?? 0)), maxHp: s.hp, block: 0, kws, reborn, splash,
      melee: eq?.melee ?? 0, uses: 0, bank: s.bank ?? 0, oid: s.oid, ench: s.ench ?? null, dead: false,
      ax, sp: eq?.sp, shield: 0, burn: 0, fury: 0, tfx, charge: bounded(s.startCharge, 999), mark: 0, rounds: 0, laps: 0, seal, sealSources, movedAt: -1, rules: runtimeRules(s, side), charged: false, reap: 0, undy: ax.includes('undying') ? (eq?.sp === 'grail' ? 2 : 1) : 0, lock: 0,
    };
  };
  left.slice(0, QUEUE_MAX).forEach((s) => q[0].push(mk(s, 0)));
  right.slice(0, QUEUE_MAX).forEach((s) => q[1].push(mk(s, 1)));
  const snap = (u: BUnit): Snap => ({ uid: u.uid, side: u.side, def: u.def, lvl: u.lvl, atk: u.atk, hp: u.hp, maxHp: u.maxHp, block: u.block, kws: [...u.kws], shield: u.shield, burn: u.burn, ench: u.ench, ax: u.ax.length ? [...u.ax] : undefined, charge: u.charge, mark: u.mark, rounds: u.rounds });
  const hasAx = (u: BUnit, a: Atom) => u.ax.includes(a);
  const stat = (u: BUnit) => ev.push({ t: 'stat', uid: u.uid, shield: u.shield, burn: u.burn });
  const init = [...q[0], ...q[1]].map(snap);
  const order = (): Order => [q[0].filter(u => !u.dead).map((u) => u.uid), q[1].filter(u => !u.dead).map((u) => u.uid)];
  const initOrder = order();
  quarryUid = q[1][opts.quarry ?? 0]?.uid ?? null;
  for (const line of q) for (let i = 0; i < line.length; i++) originalEdges.set(line[i].uid, [line[i - 1]?.uid, line[i + 1]?.uid]);
  for (const u of [...q[0], ...q[1]]) stats.register(u, card(u.def).name);
  const sourceOf = (u: BUnit, kind: DamageSourceKind, label: string): BattleDamageSource => {
    const origin = summonOrigins.get(u.uid);
    if (origin && (kind === 'attack' || kind === 'skill')) return { ...origin, uid: origin.relicId ? null : u.uid, label: origin.relicId ? origin.label : `${origin.label}·${label}` };
    return { uid: u.uid, side: u.side, kind, label };
  };
  const equipmentSource = (u: BUnit, label: string) => sourceOf(u, 'equipment', equipOf(u.ench)?.name ?? label);
  const atomSource = (u: BUnit, atom: Atom, label: string) => equipOf(u.ench)?.atoms?.includes(atom)
    ? equipmentSource(u, label) : sourceOf(u, 'skill', label);
  const relicSource = (id: string, label: string): BattleDamageSource => ({ uid: null, side: 0, kind: 'relic', relicId: id, label });
  const ruleSource = (u: BUnit, state: RuntimeRule, label: string): BattleDamageSource => state.sourceKind === 'relic'
    ? { uid: null, side: u.side, kind: 'relic', relicId: state.source, label: state.sourceName }
    : sourceOf(u, state.sourceKind === 'unit' ? 'skill' : state.sourceKind, label);
  const splashSources = new Map<number, BattleDamageSource>();
  for (const u of [...q[0], ...q[1]]) {
    if (!u.splash) continue;
    const eq = equipOf(u.ench);
    splashSources.set(u.uid, card(u.def).kws.includes('splash') ? sourceOf(u, 'skill', '天生溅射')
      : (eq?.splash ?? 0) >= (u.tfx.includes('splash') ? 50 : 1) ? equipmentSource(u, '溅射') : sourceOf(u, 'supply', '火油'));
  }
  const V = (u: BUnit, L: number) => val(u.adef, L);
  const U = (u: BUnit, L: number) => val2(u.adef, L);
  const alive = (side: number) => q[side].filter((x) => !x.dead);
  const front = (side: number) => alive(side)[0] ?? null;
  const has = (u: BUnit | null, ab: string): u is BUnit => !!u && !u.dead && u.ab === ab;
  const pct = (n: number, p: number) => Math.max(1, Math.floor((n * p) / 100));
  let budget = 6000;
  const koQ: BUnit[] = [];
  // 遗物状态
  const vgDone = new Set<number>();
  let broodCount = 0;
  let reflecting = false;
  let hurt0 = 0, drumN = 0, relay = false, loneDone = false;
  const tag = (u: BUnit, label: string) => ev.push({ t: 'trigger', uid: u.uid, label });
  const behindOf = (u: BUnit) => {
    const line = q[u.side];
    return line.slice(line.indexOf(u) + 1).find((x) => !x.dead) ?? null;
  };
  const aheadOf = (u: BUnit) => {
    const line = q[u.side];
    return line.slice(0, line.indexOf(u)).filter((x) => !x.dead).pop() ?? null;
  };
  const randomOf = <T>(arr: T[], k: number) => {
    const pool = [...arr];
    const out: T[] = [];
    while (out.length < k && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out;
  };
  /** 释放技能；紧跟在身后的曙光执政官（老虎）让它按执政官的星级再放一次 */
  /** 关键卡加的额外次数：同侧存活的同类关键卡取最高，不叠加 */
  const keyExtra = (side: number, k: KeyKind) => alive(side).reduce((m, a) => (a.adef.key === k ? Math.max(m, V(a, a.lvl)) : m), 0);
  function fire(u: BUnit, label: string, fn: (L: 1 | 2 | 3) => void, behind: BUnit | null = behindOf(u), extra = 0) {
    const k = KEY_LABEL[label];
    const n = 1 + (k ? keyExtra(u.side, k) : 0) + extra;
    for (let i = 0; i < n; i++) {
      tag(u, i ? '额外触发' : label);
      fn(u.lvl);
    }
    if (has(behind, 'tiger')) {
      tag(behind, '再次释放');
      fn(behind.lvl);
    }
  }

  const counter = (u: BUnit) => ev.push({ t: 'counter', uid: u.uid, charge: u.charge, mark: u.mark, rounds: u.rounds });
  const pair = (u: BUnit) => [aheadOf(u), behindOf(u)].find(x => x?.def === u.def) ?? null;
  const amount = (v: CombatRule['n'] | undefined, u: BUnit, level: number = u.lvl) => typeof v === 'number' ? v : v?.[Math.min(level - 1, v.length - 1)] ?? 0;
  function targets(u: BUnit, target: string = 'self', event?: BUnit, at?: number): BUnit[] {
    const friends = alive(u.side), enemies = alive(1 - u.side);
    // 同批死亡开始时锁定邻人；召唤插队和后续位移继续保留这次遗产的接收身份。
    const frozen = u.dead ? faintNeighbors.get(u.uid) : undefined;
    const ahead = frozen ? (frozen[0]?.dead ? null : frozen[0]) : u.dead && at != null ? friends.filter(x => q[u.side].indexOf(x) < at).pop() : aheadOf(u);
    const behind = frozen ? (frozen[1]?.dead ? null : frozen[1]) : u.dead && at != null ? q[u.side].slice(at).find(x => !x.dead) : behindOf(u);
    const quarry = enemies.find(x => x.uid === quarryUid) ?? enemies[0];
    switch (target) {
      case 'front': return friends.slice(0, 1);
      case 'ahead': return ahead ? [ahead] : [];
      case 'behind': return behind ? [behind] : [];
      case 'neighbors': return [ahead, behind].filter((x): x is BUnit => !!x);
      case 'team': return friends;
      case 'event': return event && !event.dead ? [event] : [];
      case 'enemyFront': return enemies.slice(0, 1);
      case 'enemyLast': return enemies.slice(-1);
      case 'enemies': return enemies;
      case 'quarry': return quarry ? [quarry] : [];
      case 'partner': { const p = pair(u); return p ? [p] : []; }
      default: return u.dead ? [] : [u];
    }
  }
  function condition(u: BUnit, r: CombatRule, event?: BUnit) {
    switch (r.when) {
      case 'rear': return front(u.side) !== u && !u.dead;
      case 'front': return front(u.side) === u;
      case 'half': return u.hp * 2 <= u.maxHp;
      case 'critical': return u.hp === 1;
      case 'paired': return !!pair(u);
      case 'stationary': return u.movedAt !== clashNo;
      case 'token': return !!event && !!card(event.def).token;
      default: return true;
    }
  }
  function scaleOf(u: BUnit, r: CombatRule, event?: BUnit) {
    const friends = alive(u.side);
    switch (r.scale) {
      case 'laps': return 1 + Math.floor(teamLaps[u.side] / Math.max(1, startingSize[u.side]));
      case 'legion': return 1 + teamSummons[u.side];
      case 'pairs': return friends.reduce((n, x, i) => n + (i > 0 && friends[i - 1].def === x.def ? 1 : 0), 0);
      case 'edges': return friends.reduce((n, x, i) => n + (i > 0 && originalEdges.get(friends[i - 1].uid)?.[1] === x.uid ? 1 : 0), 0);
      case 'missingHp': return Math.max(0, u.maxHp - u.hp);
      case 'gold': return u.side === 0 ? opts.gold ?? 0 : 0;
      case 'spells': return u.side === 0 ? opts.spells ?? 0 : 0;
      case 'marks': return (event?.side !== u.side ? event?.mark : undefined) ?? (targets(u, r.target, event)[0]?.mark ?? 0);
      case 'attackPct': return u.atk / 100;
      case 'healthPct': return u.maxHp / 100;
      default: return 1;
    }
  }
  const passive = new Set(['coalesce', 'guard', 'share', 'pairEcho', 'survive']);
  const ruleLabels: Record<BattleRule['effect'], string> = { buff:'鼓舞', block:'格挡', damage:'技能伤害', rotate:'轮转', charge:'蓄能', release:'释放蓄能', inherit:'薪火传承', summon:'召唤', coalesce:'合巢', mark:'猎标', detonate:'引爆猎标', guard:'护卫分担', share:'邻接分担', pairEcho:'并肩共鸣', survive:'血契保命' };
  function runRule(u: BUnit, state: RuntimeRule, event?: BUnit, at?: number, echoed = false, level: number = u.lvl) {
    const r = state.rule;
    if (state.sourceKind !== 'unit') level = 1;
    if (--budget <= 0 || passive.has(r.effect)) return;
    if (!echoed) {
      if (!condition(u, r, event) || state.counter.count >= (r.limit ?? Infinity)) return;
      // 支持规则有实际接收者时才占用有限额度；原生规则沿用原有计数顺序。
      if (state.sourceKind !== 'unit') {
        const candidates = targets(u, r.target, event, at);
        if (!['rotate', 'summon'].includes(r.effect) && !candidates.length) return;
        if (r.effect === 'release' && u.charge <= 0) return;
        if (r.effect === 'charge' && (Math.floor(amount(r.n, u, level) * scaleOf(u, r, event)) <= 0 || !candidates.some(t => t.charge < 999))) return;
        if (r.effect === 'rotate' && !candidates.some(t => front(t.side) === t && alive(t.side).length > 1)) return;
      }
      if (++state.counter.seen % (r.every ?? 1)) return;
      state.counter.count++;
    }
    const n = Math.max(['attackPct', 'healthPct'].includes(r.scale ?? '') && amount(r.n, u, level) > 0 ? 1 : 0, Math.floor(amount(r.n, u, level) * scaleOf(u, r, event)));
    const h = Math.max(0, Math.floor(amount(r.hp, u, level) * scaleOf(u, r, event)));
    const label = `${state.sourceName}·${ruleLabels[r.effect]}`;
    tag(u, label);
    const ts = targets(u, r.target, event, at);
    if (r.effect !== 'rotate' && r.effect !== 'summon' && !ts.length) {
      ev.push({ t: 'fizzle', uid: u.uid, label: '没有有效目标', reason: 'no_target', ability: r.effect, source: state.sourceName, required: 1, available: 0 });
      return;
    }
    if (r.effect === 'release' && u.charge <= 0) {
      ev.push({ t: 'fizzle', uid: u.uid, label: '尚未蓄能', reason: 'no_charge', ability: 'release', source: state.sourceName, required: 1, available: 0 });
      return;
    }
    switch (r.effect) {
      case 'buff': for (const t of ts) buff(u, t, n, h); break;
      case 'block': for (const t of ts) block(u, t, n); break;
      case 'damage': for (const t of ts) damage(u, t, n, 'shot', ruleSource(u, state, label)); break;
      case 'charge': for (const t of ts) { t.charge = Math.min(999, t.charge + n); counter(t); } break;
      case 'release': {
        const charge = u.charge; u.charge = 0; counter(u);
        for (const t of ts) damage(u, t, charge * n, 'shot', ruleSource(u, state, label));
        emitRules(u, 'released', u);
        break;
      }
      case 'rotate': {
        for (const t of ts) {
          const line = q[t.side], from = line.indexOf(t);
          if (!t.dead && from === 0 && alive(t.side).length > 1) {
            line.splice(from, 1); line.push(t); t.laps++; teamLaps[t.side]++; t.rounds = 0; t.movedAt = clashNo;
            ev.push({ t: 'move', uid: t.uid, from, to: line.length - 1, order: order(), reason: label }); counter(t);
            entrances();
            emitRules(t, 'move', t);
          }
        }
        break;
      }
      case 'summon': {
        if (n > 0) summon(u, u.side, { def: 't_wolf', lvl: 1, atk: n, hp: h || n }, 0, state.sourceKind === 'unit' ? summonOrigins.get(u.uid) : ruleSource(u, state, label));
        break;
      }
      case 'inherit': {
        for (const t of ts) {
          const beforeAtk = t.atk, beforeHp = t.maxHp;
          buff(u, t, Math.floor(u.atk * n / 100), Math.floor(u.maxHp * n / 100));
          const gainedStats = t.atk > beforeAtk || t.maxHp > beforeHp;
          const copied = u.rules.find(s => s.sourceKind === 'unit' && s.rule.on === 'faint' && !['inherit', 'pairEcho', 'coalesce', 'guard', 'share', 'survive'].includes(s.rule.effect));
          if (!copied) { if (gainedStats) emitRules(t, 'inherited', u); continue; }
          const key = `${t.uid}:${copied.source}`;
          if (inherited.has(key) || t.rules.some(s => s.sourceKind === 'unit' && s.source === copied.source)) { if (gainedStats) emitRules(t, 'inherited', u); continue; }
          inherited.add(key);
          const canCopy = t.rules.filter(s => s.sourceKind === 'unit' && s.source !== t.def).length < 3;
          if (canCopy) t.rules.push({ ...copied, rule: { ...copied.rule }, counter: { count: 0, seen: 0 } });
          if (gainedStats || canCopy) emitRules(t, 'inherited', u);
        }
        break;
      }
      case 'mark': for (const t of ts) {
        const added = Math.min(99 - t.mark, n); t.mark += added;
        markSources.set(t.uid, [...(markSources.get(t.uid) ?? []), ...Array.from({ length: added }, () => ruleSource(u, state, label))]); counter(t);
      } break;
      case 'detonate': for (const t of ts) { const marks = t.mark; t.mark = 0; markSources.delete(t.uid); counter(t); damage(u, t, marks * n, 'shot', ruleSource(u, state, label)); } break;
    }
    if (!echoed && !echoing && state.sourceKind === 'unit' && ['buff', 'block', 'damage', 'mark', 'charge'].includes(r.effect)) {
      const mixedPartner = [aheadOf(u), behindOf(u)].some(p => p?.def === u.def && (p.lvl >= 2) !== (u.lvl >= 2));
      if (mixedPartner && !u.dead) for (const owner of [...alive(u.side)]) for (const e of owner.rules.filter(s => s.rule.effect === 'pairEcho')) {
        if (e.counter.count >= (e.rule.limit ?? 3) || !condition(owner, e.rule, u)) continue;
        e.counter.count++; echoing = true;
        tag(owner, '并肩共鸣');
        try { for (let i = 0; i < Math.min(2, amount(e.rule.n, owner, e.sourceKind === 'unit' ? owner.lvl : 1)); i++) runRule(u, state, event, at, true); }
        finally { echoing = false; }
      }
    }
  }
  // 递归事件排队而不递归调用：召唤→召唤、受伤→伤害均受统一预算约束。
  const ruleQueue: { u: BUnit; state: RuntimeRule; event?: BUnit; at?: number; on: string; level: number }[] = [];
  let dispatchingRules = false;
  function emitRules(u: BUnit, on: string, event?: BUnit, at?: number, level: number = u.lvl, family?: 'unit' | 'support') {
    if (budget <= 0) return;
    const pending = u.rules.filter(state => state.rule.on === on && (!family || (family === 'unit' ? state.sourceKind === 'unit' : state.sourceKind !== 'unit'))).map(state => ({ u, state, event, at, on, level }));
    // 每次换首立即排登场，优先于已排队的下一次移动，保留短暂登场的因果。
    if (on === 'enter') ruleQueue.unshift(...pending); else ruleQueue.push(...pending);
    if (dispatchingRules) return;
    dispatchingRules = true;
    try {
      while (ruleQueue.length && budget > 0) {
        const next = ruleQueue.shift()!;
        if (next.u.dead && next.on !== 'faint') continue;
        runRule(next.u, next.state, next.event, next.at, false, next.level);
      }
    } finally { dispatchingRules = false; }
    if (budget <= 0) ruleQueue.length = 0;
  }
  function entrances() {
    if (!entrancesEnabled) return;
    for (const side of [0, 1] as const) {
      const f = front(side);
      if ((f?.uid ?? null) === frontSeen[side]) continue;
      frontSeen[side] = f?.uid ?? null;
      if (f) emitRules(f, 'enter');
    }
  }

  /** 返回：-1 被格挡/护盾完全挡住；否则为击杀溢出的伤害（没击杀为 0） */
  function damage(src: BUnit | null, tgt: BUnit, n: number, kind: DmgKind, attribution?: BattleDamageSource | DamageContribution[]): number {
    if (tgt.dead || n <= 0 || --budget < 0) return -1;
    const foe = !!src && src.side !== tgt.side;
    if (foe && kind === 'melee' && !splitting && tgt.block <= 0) {
      for (const guard of alive(tgt.side)) {
        if (guard === tgt) continue;
        for (const r of guard.rules) {
          if (guard.dead) break;
          if (!['guard', 'share'].includes(r.rule.effect) || r.counter.count >= (r.rule.limit ?? Infinity) || !condition(guard, r.rule, tgt)) continue;
          if (r.rule.effect === 'guard' ? front(tgt.side) !== tgt : ![aheadOf(guard), behindOf(guard)].includes(tgt)) continue;
          const split = Math.min(n, amount(r.rule.n, guard, r.sourceKind === 'unit' ? guard.lvl : 1));
          if (split <= 0) continue;
          r.counter.count++; tag(guard, r.rule.effect === 'guard' ? '护卫分担' : '邻接分担');
          splitting = true;
          try { damage(src, guard, split, kind, attribution); } finally { splitting = false; }
          n -= split;
          if (n <= 0) return -1;
        }
      }
    }

    const beforeMultiplier = n;
    if (foe && hasAx(src!, 'exec') && tgt.hp * 2 < tgt.maxHp) n = Math.floor(n * 1.5);
    const ds = src?.uid ?? null;
    const origin = attribution ?? (src ? sourceOf(src, kind === 'melee' ? 'attack' : 'skill', kind === 'melee' ? '普通交锋' : `${src.adef.name}技能`) : undefined);
    const contributions: DamageContribution[] = Array.isArray(origin) ? [...origin] : origin ? [{ source: origin, amount: n }] : [];
    if (Array.isArray(origin) && n !== beforeMultiplier) {
      const total = contributions.reduce((sum, part) => sum + part.amount, 0);
      let allocated = 0;
      if (total > 0) for (let i = 0; i < contributions.length; i++) {
        const part = contributions[i];
        const amount = i === contributions.length - 1 ? n - allocated : Math.floor(n * part.amount / total);
        contributions[i] = { source: part.source, amount };
        allocated += amount;
      }
    }
    const beforeShield = tgt.shield;
    if (kind !== 'burn' && tgt.block > 0) {
      tgt.block--;
      stats.hit(tgt, contributions, 0, 0, true, false);
      ev.push({ t: 'dmg', src: ds, tgt: tgt.uid, n, blocked: true, kind, hp: tgt.hp, block: tgt.block, shield: tgt.shield });
      return -1;
    }
    if (kind !== 'burn' && tgt.shield > 0) {
      const a = Math.min(tgt.shield, n);
      tgt.shield -= a;
      n -= a;
      if (n <= 0) {
        stats.hit(tgt, contributions, 0, a, false, false);
        ev.push({ t: 'dmg', src: ds, tgt: tgt.uid, n: a, blocked: true, kind, hp: tgt.hp, block: tgt.block, shield: tgt.shield });
        return -1;
      }
    }
    const before = tgt.hp;
    tgt.hp -= n;
    let undying = false;
    if (tgt.hp <= 0) {
      const save = tgt.rules.find(s => s.rule.effect === 'survive' && s.counter.count < amount(s.rule.n, tgt, s.sourceKind === 'unit' ? tgt.lvl : 1) && condition(tgt, s.rule, src ?? undefined));
      if (save) { save.counter.count++; tgt.hp = 1; tag(tgt, '血契保命'); }
    }
    if (tgt.lock > 0) tgt.hp = Math.max(1, tgt.hp);
    else if (tgt.hp <= 0 && tgt.undy > 0 && kind !== 'burn') {
      tgt.undy--;
      tgt.hp = 1;
      tgt.lock = 2;
      undying = true;
    }
    stats.hit(tgt, contributions, Math.max(0, before) - Math.max(0, tgt.hp), beforeShield - tgt.shield, false, tgt.hp <= 0);
    ev.push({ t: 'dmg', src: ds, tgt: tgt.uid, n, blocked: false, kind, hp: tgt.hp, block: tgt.block, shield: tgt.shield });
    if (undying) tag(tgt, '不屈');
    let over = 0;
    if (tgt.hp <= 0) {
      tgt.dead = true;
      over = n - Math.max(0, before);
      if (foe) koQ.push(src!);
    }
    if (tgt.side === 0 && tgt.oid != null && before > tgt.hp && R.has('r_vanguard') && !vgDone.has(tgt.oid)) {
      vgDone.add(tgt.oid);
      perm[tgt.oid] = { atk: 0, hp: 1 };
      tag(tgt, '先锋徽章');
    }
    if (before > tgt.hp) grantedThorn(tgt, src);
    // 锁血期间不触发受伤（不灭圣杯除外）
    if (tgt.lock > 0 && tgt.sp !== 'grail') return over;
    onHurt(tgt, src);
    if (tgt.sp === 'thorn' && foe && !src!.dead && !reflecting) {
      reflecting = true;
      try { tag(tgt, '荆棘'); damage(tgt, src!, 3, 'shot', equipmentSource(tgt, '荆棘甲')); }
      finally { reflecting = false; }
    }
    return over;
  }
  function buff(src: BUnit, tgt: BUnit | null, atk: number, hp: number) {
    if (!tgt || tgt.dead || (!atk && !hp)) return;
    tgt.atk = Math.min(STAT_CAP, Math.max(1, tgt.atk + atk));
    const h = Math.max(0, Math.min(hp, STAT_CAP - tgt.maxHp));
    if (tgt.lock <= 0) tgt.hp += h;
    tgt.maxHp += h;
    ev.push({ t: 'buff', src: src.uid, tgt: tgt.uid, atk, hp, nowAtk: tgt.atk, nowHp: tgt.hp });
  }
  function block(src: BUnit, tgt: BUnit | null, n: number) {
    if (!tgt || tgt.dead || n <= 0) return;
    tgt.block += n;
    ev.push({ t: 'block', src: src.uid, tgt: tgt.uid, n, block: tgt.block });
  }
  function giveKw(src: BUnit, tgt: BUnit, k: Kw) {
    if (tgt.dead || tgt.kws.includes(k)) return;
    tgt.kws.push(k);
    if (k === 'reborn') tgt.reborn = true;
    if (k === 'splash' && !tgt.splash) {
      tgt.splash = 50;
      splashSources.set(tgt.uid, sourceOf(tgt, 'skill', `${src.adef.name}赋予的溅射`));
    }
    ev.push({ t: 'kw', src: src.uid, tgt: tgt.uid, kws: [k] });
  }
  function summon(src: BUnit | null, side: 0 | 1, s: UnitSpec, at: number, origin?: BattleDamageSource): BUnit | null {
    if (alive(side).length >= QUEUE_MAX) {
      const merger = alive(side).find(x => x.rules.some(r => r.rule.effect === 'coalesce'));
      const token = alive(side).find(x => card(x.def).token);
      if (src && merger && token) {
        tag(merger, '合巢'); buff(src, token, s.atk, s.hp);
        // 合流没有新实体，不计召唤数，也不再次触发召唤事件。
        return token;
      }
      if (src) ev.push({ t: 'fizzle', uid: src.uid, label: '队伍满了', reason: 'full', ability: 'summon', source: src.adef.name, required: 1, available: 0 });
      return null;
    }
    const u = mk(s, side);
    teamSummons[side]++;
    if (side === 0) {
      summons++;
      if (legion) { u.atk += legion; u.hp += legion; u.maxHp += legion; }
    }
    stats.register(u, card(u.def).name, src?.uid ?? null);
    const creation = origin ?? (src ? summonOrigins.get(src.uid) : undefined);
    if (creation) summonOrigins.set(u.uid, creation);
    if (u.splash) splashSources.set(u.uid, sourceOf(u, 'skill', '天生溅射'));
    q[side].splice(Math.max(0, Math.min(at, q[side].length)), 0, u);
    ev.push({ t: 'summon', src: src?.uid ?? null, unit: snap(u), order: order() });
    onSummoned(u);
    return u;
  }
  /** 阵亡召唤：按 summonInfo 召唤到原位 */
  function faintSummon(u: BUnit, L: 1 | 2 | 3, at: number) {
    const info = summonInfo(u.adef, L, u.atk, u.bank);
    if (!info) return;
    for (let i = 0; i < info.count; i++) {
      if (info.def) summon(u, u.side, { def: info.def, lvl: 1, atk: info.atk, hp: info.hp }, at);
      else {
        const pool = SHOP_POOL.filter((c) => c.tier === info.tier);
        const d = pool[Math.floor(rnd() * pool.length)];
        const spec = info.tier === 6
          ? { def: d.id, lvl: L, atk: d.atk + LVL_BONUS[L - 1], hp: d.hp + LVL_BONUS[L - 1] }
          : { def: d.id, lvl: L, atk: info.atk, hp: info.hp };
        summon(u, u.side, spec, at);
      }
    }
  }

  // ── 事件分派 ──
  /** 受伤回报看最大血量（敌方专用卡不接） */
  const hpCut = (t: BUnit, div: number) => (t.adef.enemy ? 0 : Math.floor(t.maxHp / div));
  function grantedThorn(t: BUnit, src: BUnit | null) {
    if (t.granted?.id === 'thorn' && src && src.side !== t.side && !src.dead && !reflecting) {
      reflecting = true;
      try { tag(t, t.granted.source); damage(t, src, t.granted.value, 'shot', sourceOf(t, 'skill', t.granted.source)); }
      finally { reflecting = false; }
    }
  }
  function onHurt(t: BUnit, src: BUnit | null) {
    if (!t.dead) {
      if (t.rules.some(s => s.sourceKind === 'unit' && s.rule.on === 'hurt')) fire(t, '受伤', L => emitRules(t, 'hurt', src ?? undefined, undefined, L, 'unit'));
      emitRules(t, 'hurt', src ?? undefined, undefined, 1, 'support');
    }
    if (t.side === 0) {
      if (t.oid != null) hurts[t.oid] = (hurts[t.oid] ?? 0) + 1;
      if (R.has('r_drums') && ++hurt0 % 5 === 0 && drumN < 3) {
        drumN++;
        tag(t, '战鼓');
        for (const x of alive(0)) buff(t, x, 1, 0);
      }
    }
    switch (t.ab) {
      case 'thornback':
        if (src && src.side !== t.side && !src.dead && !reflecting) {
          reflecting = true;
          try { fire(t, '受伤', (L) => { if (!src.dead) damage(t, src, V(t, L) + hpCut(t, 5), 'shot'); }); }
          finally { reflecting = false; }
        }
        break;
      case 'idol':
        if (!t.dead && t.uses < 3) {
          t.uses++;
          fire(t, '受伤', (L) => alive(t.side).forEach((x) => buff(t, x, V(t, L), V(t, L))));
        }
        break;
      case 'peacock':
        if (!t.dead) fire(t, '受伤', (L) => buff(t, t, V(t, L) + hpCut(t, 10), 0));
        break;
      case 'camel':
        if (!t.dead) fire(t, '受伤', (L) => buff(t, behindOf(t), V(t, L), U(t, L)));
        break;
      case 'blowfish':
        fire(t, '受伤', (L) => {
          const fs = alive(1 - t.side);
          if (fs.length) damage(t, fs[Math.floor(rnd() * fs.length)], V(t, L) + hpCut(t, 5), 'shot');
        });
        break;
      case 'gorilla':
        if (!t.dead && t.uses < V(t, t.lvl)) {
          t.uses++;
          fire(t, '受伤', () => block(t, t, 1));
        }
        break;
    }
  }
  function onSummoned(u: BUnit) {
    for (const a of [...alive(u.side)]) emitRules(a, 'summon', u);
    if (u.side === 0 && R.has('r_brood') && broodCount < 5) {
      broodCount++;
      tag(u, '繁衍号');
      for (const x of alive(0)) buff(u, x, 1, 0);
    }
    for (const a of alive(u.side)) {
      if (a === u) continue;
      switch (a.ab) {
        case 'horse': fire(a, '友军被召唤', (L) => buff(a, u, V(a, L), V(a, L))); break;
        case 'dog': fire(a, '友军被召唤', (L) => buff(a, a, V(a, L), V(a, L))); break;
        case 'turkey': fire(a, '友军被召唤', (L) => buff(a, u, V(a, L), V(a, L))); break;
        case 'heart':
          if (card(u.def).token) fire(a, '召唤物出现', (L) => {
            buff(a, u, V(a, L), V(a, L));
            giveKw(a, u, 'splash');
          });
          break;
      }
    }
  }
  function onKO(u: BUnit) {
    if (u.dead) return;
    if (hasAx(u, 'reap') && u.reap < 3 && u.lock <= 0 && u.hp < u.maxHp) {
      u.reap++;
      const n = Math.min(u.maxHp - u.hp, Math.ceil(u.maxHp / 4));
      u.hp += n;
      tag(u, '收割');
      ev.push({ t: 'heal', src: u.uid, tgt: u.uid, n, hp: u.hp });
    }
    if (u.ab === 'rhino') fire(u, '击杀', (L) => {
      const f = front(1 - u.side);
      if (f) damage(u, f, V(u, L), 'shot');
    });
  }
  function beforeAttack(u: BUnit) {
    if (u.ab === 'elephant') fire(u, '交锋前', (L) => {
      for (const x of alive(u.side).filter((x) => x !== u).slice(0, V(u, L))) damage(u, x, 1, 'shot');
    });
    if (u.ab === 'boar') fire(u, '交锋前', (L) => buff(u, u, V(u, L), V(u, L)));
  }

  /** 结算死亡与击杀，直到稳定 */
  function settle() {
    for (let guard = 0; guard < 80; guard++) {
      processDeaths();
      entrances();
      if (!koQ.length && ![...q[0], ...q[1]].some(u => u.dead) && (!entrancesEnabled || [0, 1].every(side => (front(side)?.uid ?? null) === frontSeen[side]))) return;
      while (koQ.length) onKO(koQ.shift()!);
    }
  }

  /** 独狼披风：只剩 1 个友军时一次性触发 */
  function checkLone() {
    if (loneDone || !R.has('r_lone')) return;
    const al = alive(0);
    if (al.length !== 1) return;
    loneDone = true;
    const u = al[0];
    tag(u, '独狼');
    buff(u, u, 6, 6);
    // 遗物只补足一次保命，不给装备已有次数追加充能。
    if (u.lock <= 0) u.undy = Math.max(u.undy, 1);
  }
  /** 移除所有已死单位，依次结算阵亡触发；直到没有新死亡 */
  function processDeaths() {
    for (let guard = 0; guard < 60; guard++) {
      const dead = [...q[0], ...q[1]].filter((u) => u.dead);
      const witnesses = [alive(0), alive(1)];
      if (!dead.length) return checkLone();
      for (const u of dead) {
        const line = q[u.side], at = line.indexOf(u);
        faintNeighbors.set(u.uid, [line.slice(0, at).filter(x => !x.dead).pop() ?? null, line.slice(at + 1).find(x => !x.dead) ?? null]);
      }
      for (const u of dead) {
        const side = u.side;
        const line = q[side];
        const at = line.indexOf(u);
        if (at < 0) continue;
        line.splice(at, 1);
        ev.push({ t: 'die', uid: u.uid, order: order() });
        const [aheadFriend, nextBehind] = faintNeighbors.get(u.uid)!;
        const F = (fn: (L: 1 | 2 | 3) => void, label = '阵亡') => {
          fire(u, label, fn, nextBehind, u.sp === 'crown' ? 1 : 0);
        };
        if (u.rules.some(s => s.sourceKind === 'unit' && s.rule.on === 'faint')) F(L => emitRules(u, 'faint', u, at, L, 'unit'));
        emitRules(u, 'faint', u, at, 1, 'support');
        if (u.uid === quarryUid) quarryUid = u.mark > 0 ? nextBehind?.uid ?? null : null;
        if (u.mark > 0) {
          const next = nextBehind;
          if (next) {
            const origins = markSources.get(u.uid) ?? [];
            const layers = [...(markSources.get(next.uid) ?? []), ...origins];
            if (origins.length) layers.push(origins[origins.length - 1]);
            next.mark = Math.min(99, next.mark + u.mark + 1);
            markSources.set(next.uid, layers.slice(0, 99));
            counter(next);
          }
        }
        if (u.tfx.includes('bone')) fire(u, '骨汤', () => summon(u, side, { def: 't_bonelet', lvl: 1, atk: 3, hp: 3 }, at), nextBehind);
        switch (u.ab) {
          case 'cricket': case 'egg': case 'sheep': case 'deer': case 'rooster': case 'spider': case 'eagle':
            F((L) => faintSummon(u, L, at), u.ab === 'egg' ? '孵化' : '阵亡');
            break;
          case 'ant':
            F((L) => buff(u, randomOf(alive(side), 1)[0] ?? null, V(u, L), U(u, L)));
            break;
          case 'flamingo':
            F((L) => line.slice(at).filter((x) => !x.dead).slice(0, 2).forEach((x) => buff(u, x, V(u, L), V(u, L))));
            break;
          case 'hedgehog':
            F((L) => [...alive(0), ...alive(1)].forEach((x) => damage(u, x, V(u, L), 'shot')));
            break;
          case 'turtle':
            F((L) => line.slice(at).filter((x) => !x.dead).slice(0, V(u, L)).forEach((x) => block(u, x, 1)));
            break;
          case 'badger':
            F((L) => {
              const n = pct(u.atk, V(u, L));
              const back = line.slice(at).find((x) => !x.dead);
              const ahead = line.slice(0, at).filter((x) => !x.dead).pop() ?? front(1 - side);
              if (back) damage(u, back, n, 'shot');
              if (ahead) damage(u, ahead, n, 'shot');
            });
            break;
          case 'mammoth':
            F((L) => alive(side).forEach((x) => buff(u, x, V(u, L), V(u, L))));
            break;
        }
        if (u.granted?.id === 'bone') {
          const ability = u.granted;
          tag(u, ability.source);
          F(() => summon(u, side, { def: 't_wisp', lvl: 1, atk: ability.value, hp: ability.value }, at));
        }
        if (u.reborn) {
          if (alive(side).length < QUEUE_MAX) {
            tag(u, '复生');
            const r = mk({ def: u.def, lvl: u.lvl, atk: u.atk, hp: 1, oid: u.oid, bank: u.bank, granted: u.granted }, side);
            r.reborn = false;
            r.uses = u.uses;
            r.kws = u.kws.filter((k) => k !== 'reborn');
            r.splash = u.splash;
            r.melee = u.melee;
            r.ench = u.ench;
            r.ax = u.ax;
            r.sp = u.sp;
            r.undy = u.undy;
            r.reap = u.reap;
            r.charged = u.charged;
            r.rules = u.rules.map(s => ({ ...s, counter: s.sourceKind === 'relic' && RELIC[s.source]?.counterScope !== 'holder' ? s.counter : { ...s.counter } }));
            r.charge = u.charge;
            r.laps = u.laps;
            r.seal = u.seal;
            r.sealSources = { ...u.sealSources };
            r.movedAt = clashNo;
            stats.register(r, card(r.def).name, u.uid, true);
            const summonOrigin = summonOrigins.get(u.uid);
            if (summonOrigin) summonOrigins.set(r.uid, summonOrigin);
            const splashOrigin = splashSources.get(u.uid);
            if (splashOrigin) splashSources.set(r.uid, { ...splashOrigin, uid: r.uid });
            line.splice(Math.min(at, line.length), 0, r);
            ev.push({ t: 'summon', src: u.uid, unit: snap(r), order: order(), revive: true });
            onSummoned(r);
          } else ev.push({ t: 'fizzle', uid: u.uid, label: '队伍满了', reason: 'full', ability: 'revive', source: u.adef.name, required: 1, available: 0 });
        }
        if (side === 0) {
          if (R.has('r_relay')) relay = true;
          const f = front(0);
          if (R.has('r_legacy') && f && u.atk >= 2) {
            tag(f, '传承');
            buff(f, f, Math.min(10, Math.floor(u.atk / 2)), 0);
          }
        }
        // 友军阵亡的反应
        for (const a of witnesses[side]) {
          if (a.dead) continue;
          emitRules(a, 'allyFaint', u);
          if (a.ab === 'ox' && a.uses < U(a, a.lvl)) {
            a.uses++;
            fire(a, '友军阵亡', (L) => {
              buff(a, a, V(a, L), 0);
              block(a, a, 1);
            });
          }
          if (a.ab === 'shark') fire(a, '友军阵亡', (L) => buff(a, a, V(a, L), U(a, L)));
          if (a.ab === 'fly' && a.uses < FLY_USES && !u.flySkel) {
            a.uses++;
            fire(a, '友军阵亡', (L) => {
              const pos = aheadFriend ? line.indexOf(aheadFriend) + 1 : 0;
              const s = summon(a, side, { def: 't_bonelet', lvl: 1, atk: V(a, L), hp: V(a, L) }, pos);
              if (s) s.flySkel = true;
            });
          }
        }
      }
    }
  }

  // ── 遗物：开战前 ──
  {
    const me = alive(0);
    if (me.length) {
      if (R.has('r_motley') && motleyCount(me.map((u) => u.def)) >= 3) {
        tag(me[0], '散兵章');
        for (const x of me) buff(x, x, 2, 2);
      }
      if (R.has('r_few') && me.length <= 3) {
        tag(me[0], '少即是多');
        for (const x of me) buff(x, x, 3, 3);
      }
      if (R.has('r_heavy')) {
        tag(me[0], '重装铠');
        const gain = Math.max(0, Math.min(20, Math.ceil(me[0].maxHp / 2)));
        buff(me[0], me[0], 0, gain);
        if (gain > 0) for (const x of me.slice(1)) buff(x, x, -1, 0);
      }
      checkLone();
      const fs = alive(1);
      if (R.has('r_volley') && fs.length) {
        tag(me[0], '齐射号角');
        damage(me[0], fs[Math.floor(rnd() * fs.length)], me.length * 2, 'shot', relicSource('r_volley', '齐射号角'));
        settle();
      }
    }
  }
  // ── 开战：双方交替，按队列从前往后 ──
  const starters = Math.max(q[0].length, q[1].length);
  const startList: BUnit[] = [];
  for (let i = 0; i < starters; i++) for (const s of [0, 1]) if (q[s][i]) startList.push(q[s][i]);
  for (const u of startList) if (u.startBlock > 0) block(u, u, u.startBlock);
  for (const u of startList) {
    if (u.dead) continue;
    const eq = equipOf(u.ench);
    if (eq?.block) block(u, u, eq.block);
    // 补给的本场特效
    for (const f of u.tfx) {
      if (u.dead) break;
      if (f === 'plate') { tag(u, '铁甲片'); block(u, u, 2); }
      if (f === 'berry') { tag(u, '刺莓'); damage(u, u, 1, 'shot', sourceOf(u, 'supply', '刺莓')); }
      if (f === 'bomb') { const t = front(1 - u.side); if (t) { tag(u, '火药包'); damage(u, t, 3, 'shot', sourceOf(u, 'supply', '火药包')); } }
      if (f === 'thunder') { tag(u, '雷霆瓶'); for (const t of alive(1 - u.side)) damage(u, t, 2, 'shot', sourceOf(u, 'supply', '雷霆瓶')); }
    }
    if (hasAx(u, 'shield')) {
      u.shield = Math.ceil(u.maxHp / 5);
      tag(u, '护盾');
      stat(u);
    }
    if (u.sp === 'blood') {
      tag(u, '饮血剑');
      damage(u, u, 3, 'shot', equipmentSource(u, '饮血剑'));
    }
    if (u.rules.some(s => s.sourceKind === 'unit' && s.rule.on === 'start' && !passive.has(s.rule.effect))) fire(u, '开战', L => emitRules(u, 'start', undefined, undefined, L, 'unit'));
    emitRules(u, 'start', undefined, undefined, 1, 'support');
    const foes = () => alive(1 - u.side);
    switch (u.ab) {
      case 'ironwall': fire(u, '开战', (L) => block(u, u, V(u, L))); break;
      case 'anvil': fire(u, '开战', (L) => {
        for (let k = 0; k < V(u, L); k++) for (const x of alive(u.side)) damage(u, x, 1, 'shot');
      }); break;
      case 'mosquito': fire(u, '开战', (L) => randomOf(foes(), V(u, L)).forEach((f) => damage(u, f, 1, 'shot'))); break;
      case 'dodo': {
        const ahead = aheadOf(u);
        if (ahead) fire(u, '开战', (L) => buff(u, ahead, pct(u.atk, V(u, L)), 0));
        break;
      }
      case 'dolphin': fire(u, '开战', (L) => {
        const fs = foes();
        if (fs.length) damage(u, fs.reduce((m, x) => (x.hp < m.hp ? x : m)), V(u, L), 'shot');
      }); break;
      case 'croc': fire(u, '开战', (L) => {
        const t = foes().pop();
        if (t) damage(u, t, V(u, L), 'shot');
      }); break;
      case 'skunk': fire(u, '开战', (L) => {
        const fs = foes();
        if (!fs.length) return;
        const t = fs.reduce((m, x) => (x.hp > m.hp ? x : m));
        damage(u, t, Math.min(t.hp - 1, Math.floor((t.hp * V(u, L)) / 100)), 'shot');
      }); break;
    }
    if (!u.dead && u.granted?.id === 'spark') {
      const ability = u.granted;
      tag(u, ability.source);
      const target = front(1 - u.side);
      if (target) fire(u, '开战', () => damage(u, target, ability.value, 'shot', sourceOf(u, 'skill', ability.source)));
    }
    if (!u.dead && u.granted?.id === 'blood') {
      const ability = u.granted;
      tag(u, ability.source);
      fire(u, '开战', () => {
        if (u.dead) return;
        damage(u, u, 1, 'shot', sourceOf(u, 'skill', ability.source));
        if (!u.dead) buff(u, u, ability.value, 0);
      });
    }
    settle();
  }
  settle();

  entrancesEnabled = true;
  settle();

  // ── 交锋循环 ──
  let n = 0;
  while (n < MAX_CLASHES && front(0) && front(1) && budget > 0) {
    n++;
    clashNo = n;
    // 交锋前：每个单位每次交锋最多一次；队首因此换人时，新队首也结算
    const fired = new Set<BUnit>();
    for (let g = 0; g < 8; g++) {
      let any = false;
      for (const s of [0, 1]) {
        const f = front(s);
        if (f && !fired.has(f)) {
          fired.add(f);
          any = true;
          beforeAttack(f);
        }
      }
      settle();
      if (!any) break;
    }
    const a = front(0);
    const b = front(1);
    if (!a || !b) break;
    ev.push({ t: 'clash', n, a: a.uid, b: b.uid });
    const hitOf = (u: BUnit) => {
      let d = u.atk + u.melee;
      if (u.sp === 'rage') d *= 2;
      if (u.side === 0 && relay) {
        relay = false;
        tag(u, '车轮战');
        d *= 2;
      }
      if (hasAx(u, 'charge') && !u.charged) {
        u.charged = true;
        tag(u, '冲锋');
        d *= 2;
      }
      return d;
    };
    const atkA = hitOf(a);
    const atkB = hitOf(b);
    const resA = damage(a, b, atkA, 'melee');
    const resB = damage(b, a, atkB, 'melee');
    for (const [u, foe, dmg, res] of [[a, b, atkA, resA], [b, a, atkB, resB]] as const) {
      const line = q[foe.side];
      const rest = line.slice(line.indexOf(foe) + 1).filter((x) => !x.dead);
      if (res >= 0 && hasAx(u, 'burn') && !foe.dead && foe.burn < 3) {
        foe.burn++;
        const layers = burnSources.get(foe.uid) ?? [];
        layers.push(atomSource(u, 'burn', '灼烧'));
        burnSources.set(foe.uid, layers);
        stat(foe);
      }
      if (u.sp === 'spear') {
        if (rest.length) tag(u, '贯日之枪');
        for (const x of rest) damage(u, x, dmg, 'splash', equipmentSource(u, '贯日之枪'));
        continue;
      }
      if (u.splash && rest[0]) damage(u, rest[0], pct(dmg, u.splash), 'splash', splashSources.get(u.uid));
      if (res > 0 && hasAx(u, 'pierce')) {
        const next = rest.find((x) => !x.dead);
        if (next) {
          tag(u, '穿透');
          damage(u, next, res, 'shot', atomSource(u, 'pierce', '穿透'));
        }
      }
    }
    // 身前友军攻击后
    for (const u of [a, b]) {
      const bh = behindOf(u);
      if (has(bh, 'snake')) fire(bh, '身前友军攻击', (L) => {
        const f = front(1 - u.side);
        if (f) damage(bh, f, pct(bh.atk, V(bh, L)), 'shot');
      });
      if (has(bh, 'kangaroo')) fire(bh, '身前友军攻击', (L) => buff(bh, bh, V(bh, L), V(bh, L)));
    }
    for (const u of [a, b]) {
      if (u.seal > 0) {
        const target = u === a ? b : a, seal = u.seal;
        const support: DamageContribution[] = Object.entries(u.sealSources).map(([key, amount]) => {
          const colon = key.indexOf(':'), kind = key.slice(0, colon) as 'supply' | 'equipment' | 'relic', id = key.slice(colon + 1);
          const name = (kind === 'supply' ? FOOD[id] : kind === 'equipment' ? equipOf(id) : RELIC[id])?.name ?? id;
          return { source: kind === 'relic' ? { uid: null, side: u.side, kind, relicId: id, label: name } : sourceOf(u, kind, `${name}·封印首击`), amount };
        });
        const native = seal - support.reduce((n, x) => n + x.amount, 0);
        const contributions: DamageContribution[] = native > 0 ? [{ source: sourceOf(u, 'skill', '封印首击'), amount: native }, ...support] : support;
        u.seal = 0; u.sealSources = {};
        if (!target.dead) { tag(u, '封印首击'); damage(u, target, seal, 'shot', contributions); }
      }
      if (!u.dead) emitRules(u, 'afterAttack');
    }
    settle();
    // 交锋后：战意、风暴之心、灼烧、不屈倒计时
    for (const u of [a, b]) {
      if (!u.dead && hasAx(u, 'fury') && u.fury < 5) {
        u.fury++;
        buff(u, u, 1, 0);
      }
    }
    if (R.has('r_rear')) {
      const a0 = alive(0), a1 = alive(1);
      if (a0.length && a1.length) {
        const me = a0[a0.length - 1];
        tag(me, '后卫弩');
        damage(me, a1[a1.length - 1], 2, 'shot', relicSource('r_rear', '后卫弩'));
      }
    }
    for (const u of [...alive(0), ...alive(1)]) {
      if (u.sp !== 'storm' || u.dead) continue;
      tag(u, '风暴之心');
      for (const x of alive(1 - u.side)) damage(u, x, 1, 'shot', equipmentSource(u, '风暴之心'));
    }
    settle();
    for (const u of [...alive(0), ...alive(1)]) {
      if (u.movedAt !== n) u.rounds++; else u.rounds = 0;
      counter(u);
      emitRules(u, 'clashEnd');
    }
    settle();
    for (const u of [...alive(0), ...alive(1)]) if (u.mark > 0) damage(null, u, u.mark, 'shot', (markSources.get(u.uid) ?? []).map(source => ({ source, amount: 1 })));
    settle();
    for (const u of [...alive(0), ...alive(1)]) if (u.burn > 0) damage(null, u, u.burn * 2, 'burn', (burnSources.get(u.uid) ?? []).map((source) => ({ source, amount: 2 })));
    for (const u of [...alive(0), ...alive(1)]) {
      if (u.lock <= 0) continue;
      if (--u.lock === 0) {
        tag(u, '不屈耗尽');
        // 圣杯的第二次不屈接续生效；旧逻辑直接死亡，丢弃了剩余次数。
        if (u.undy > 0) {
          u.undy--;
          u.lock = 2;
          tag(u, '不屈');
          continue;
        }
        u.hp = 0;
        u.dead = true;
        ev.push({ t: 'dmg', src: null, tgt: u.uid, n: 1, blocked: false, kind: 'burn', hp: 0, block: u.block, shield: u.shield });
      }
    }
    settle();
  }
  if (budget <= 0) {
    const u = front(0) ?? front(1);
    if (u) ev.push({ t: 'fizzle', uid: u.uid, label: '连锁结算达到上限', reason: 'operation_budget', required: 1, available: 0 });
  }
  const l = alive(0).length;
  const r = alive(1).length;
  const result: Result = l && !r ? 'win' : r && !l ? 'lose' : 'draw';
  ev.push({ t: 'end', result });
  return { init, initOrder, events: ev, result, survivors: l, perm, hurts, summons, stats: stats.finish() };
}
