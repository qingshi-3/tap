// 碰撞制战斗引擎：队首对队首同时互打，后排只靠事件技能参与（规则照搬 SAP）。
// 纯函数：输入两队，输出事件流 + 结果。播放层只读事件，不再推算规则。
import { card, equipOf, SHOP_POOL, summonInfo, type Atom, type CardDef, type Ench, type EquipSp, type Kw } from './data';

export const QUEUE_MAX = 5;
export const MAX_CLASHES = 30;
const FLY_USES = 3;
/** 鹰召唤的 6 阶单位：按星级补上合并带来的身材 */
const LVL_BONUS = [0, 2, 5];

export interface UnitSpec {
  def: string;
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
  /** 沙域法老：本回合复制到的技能（卡 id），按自己星级结算 */
  copy?: string;
  /** 精英词缀 */
  ax?: Atom[];
}

export interface BUnit {
  uid: number;
  side: 0 | 1;
  def: string;
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
  copy?: string;
  dead: boolean;
  /** 词条原子（装备 + 精英词缀） */
  ax: Atom[];
  sp?: EquipSp;
  shield: number;
  /** 身上的灼烧层数 */
  burn: number;
  fury: number;
  charged: boolean;
  reap: number;
  /** 不屈剩余次数；lock>0 为锁血中（剩余交锋数） */
  undy: number;
  lock: number;
}

export type Snap = Pick<BUnit, 'uid' | 'side' | 'def' | 'lvl' | 'atk' | 'hp' | 'maxHp' | 'block' | 'kws' | 'shield' | 'burn'> & { ench?: Ench | null; copy?: string; ax?: Atom[] };
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
  | { t: 'fizzle'; uid: number; label: string }
  | { t: 'end'; result: Result };

export type Result = 'win' | 'lose' | 'draw';
/** burn：灼烧/不屈耗尽，无视格挡与护盾 */
export type DmgKind = 'melee' | 'shot' | 'splash' | 'burn';
export interface BattleOut {
  init: Snap[];
  initOrder: Order;
  events: Ev[];
  result: Result;
  survivors: number;
  /** 战斗内获得的永久成长（按 oid）；v0.3 起战斗内只有本场加成，保留接口 */
  perm: Record<number, { atk: number; hp: number }>;
}

const val = (d: CardDef, lvl: number) => (d.v ? d.v[lvl - 1] : 0);
const val2 = (d: CardDef, lvl: number) => (d.u ? d.u[lvl - 1] : 0);

/** relics：我方（左侧）遗物 */
export function simulate(left: UnitSpec[], right: UnitSpec[], seed = 1, relics: readonly string[] = []): BattleOut {
  const R = new Set(relics);
  let uid = 1;
  let rs = seed || 1;
  const rnd = () => ((rs = (rs * 1103515245 + 12345) & 0x7fffffff), rs / 0x7fffffff);
  const ev: Ev[] = [];
  const q: [BUnit[], BUnit[]] = [[], []];
  const mk = (s: UnitSpec, side: 0 | 1): BUnit => {
    const d = card(s.def);
    const adef = s.copy ? card(s.copy) : d;
    const kws = [...d.kws];
    const eq = equipOf(s.ench);
    if (eq?.splash && !kws.includes('splash')) kws.push('splash');
    const reborn = kws.includes('reborn') || !!eq?.reborn || !!s.lamp;
    if (reborn && !kws.includes('reborn')) kws.push('reborn');
    const splash = d.kws.includes('splash') ? val(d, s.lvl) || 50 : eq?.splash ?? 0;
    const ax = [...new Set([...(eq?.atoms ?? []), ...(s.ax ?? [])])];
    return {
      uid: uid++, side, def: s.def, adef, ab: adef.ab, lvl: s.lvl, atk: Math.max(1, s.atk), hp: s.hp, maxHp: s.hp, block: 0, kws, reborn, splash,
      melee: eq?.melee ?? 0, uses: 0, bank: s.bank ?? 0, oid: s.oid, ench: s.ench ?? null, copy: s.copy, dead: false,
      ax, sp: eq?.sp, shield: 0, burn: 0, fury: 0, charged: false, reap: 0, undy: ax.includes('undying') ? (eq?.sp === 'grail' ? 2 : 1) : 0, lock: 0,
    };
  };
  left.slice(0, QUEUE_MAX).forEach((s) => q[0].push(mk(s, 0)));
  right.slice(0, QUEUE_MAX).forEach((s) => q[1].push(mk(s, 1)));
  const snap = (u: BUnit): Snap => ({ uid: u.uid, side: u.side, def: u.def, lvl: u.lvl, atk: u.atk, hp: u.hp, maxHp: u.maxHp, block: u.block, kws: [...u.kws], shield: u.shield, burn: u.burn, ench: u.ench, copy: u.copy, ax: u.ax.length ? [...u.ax] : undefined });
  const hasAx = (u: BUnit, a: Atom) => u.ax.includes(a);
  const stat = (u: BUnit) => ev.push({ t: 'stat', uid: u.uid, shield: u.shield, burn: u.burn });
  const init = [...q[0], ...q[1]].map(snap);
  const order = (): Order => [q[0].map((u) => u.uid), q[1].map((u) => u.uid)];
  const initOrder = order();
  const V = (u: BUnit, L: number) => val(u.adef, L);
  const U = (u: BUnit, L: number) => val2(u.adef, L);
  const alive = (side: number) => q[side].filter((x) => !x.dead);
  const front = (side: number) => alive(side)[0] ?? null;
  const has = (u: BUnit | null, ab: string): u is BUnit => !!u && !u.dead && u.ab === ab;
  const pct = (n: number, p: number) => Math.max(1, Math.floor((n * p) / 100));
  let budget = 6000;
  const koQ: BUnit[] = [];
  // 遗物状态
  const vgDone = new Set<BUnit>();
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
  function fire(u: BUnit, label: string, fn: (L: 1 | 2 | 3) => void, behind: BUnit | null = behindOf(u)) {
    tag(u, label);
    fn(u.lvl);
    if (has(behind, 'tiger')) {
      tag(behind, '再次释放');
      fn(behind.lvl);
    }
  }

  /** 返回：-1 被格挡/护盾完全挡住；否则为击杀溢出的伤害（没击杀为 0） */
  function damage(src: BUnit | null, tgt: BUnit, n: number, kind: DmgKind): number {
    if (tgt.dead || n <= 0 || --budget < 0) return -1;
    const foe = !!src && src.side !== tgt.side;
    if (foe && hasAx(src!, 'exec') && tgt.hp * 2 < tgt.maxHp) n = Math.floor(n * 1.5);
    const ds = src?.uid ?? null;
    if (kind !== 'burn' && tgt.block > 0) {
      tgt.block--;
      ev.push({ t: 'dmg', src: ds, tgt: tgt.uid, n, blocked: true, kind, hp: tgt.hp, block: tgt.block, shield: tgt.shield });
      return -1;
    }
    if (kind !== 'burn' && tgt.shield > 0) {
      const a = Math.min(tgt.shield, n);
      tgt.shield -= a;
      n -= a;
      if (n <= 0) {
        ev.push({ t: 'dmg', src: ds, tgt: tgt.uid, n: a, blocked: true, kind, hp: tgt.hp, block: tgt.block, shield: tgt.shield });
        return -1;
      }
    }
    const before = tgt.hp;
    tgt.hp -= n;
    let undying = false;
    if (tgt.lock > 0) tgt.hp = Math.max(1, tgt.hp);
    else if (tgt.hp <= 0 && tgt.undy > 0 && kind !== 'burn') {
      tgt.undy--;
      tgt.hp = 1;
      tgt.lock = 2;
      undying = true;
    }
    ev.push({ t: 'dmg', src: ds, tgt: tgt.uid, n, blocked: false, kind, hp: tgt.hp, block: tgt.block, shield: tgt.shield });
    if (undying) tag(tgt, '不屈');
    let over = 0;
    if (tgt.hp <= 0) {
      tgt.dead = true;
      over = n - Math.max(0, before);
      if (foe) koQ.push(src!);
    }
    // 锁血期间不触发受伤（不灭圣杯除外）
    if (tgt.lock > 0 && tgt.sp !== 'grail') return over;
    onHurt(tgt, src);
    if (tgt.sp === 'thorn' && foe && !src!.dead) {
      tag(tgt, '荆棘');
      damage(tgt, src!, 3, 'shot');
    }
    return over;
  }
  function buff(src: BUnit, tgt: BUnit | null, atk: number, hp: number) {
    if (!tgt || tgt.dead || (!atk && !hp)) return;
    tgt.atk = Math.min(50, Math.max(1, tgt.atk + atk));
    const h = Math.max(0, Math.min(hp, 50 - tgt.maxHp));
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
    if (k === 'splash' && !tgt.splash) tgt.splash = 50;
    ev.push({ t: 'kw', src: src.uid, tgt: tgt.uid, kws: [k] });
  }
  function summon(src: BUnit | null, side: 0 | 1, s: UnitSpec, at: number): BUnit | null {
    if (alive(side).length >= QUEUE_MAX) {
      if (src) ev.push({ t: 'fizzle', uid: src.uid, label: '队伍满了' });
      return null;
    }
    const u = mk(s, side);
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
  function onHurt(t: BUnit, src: BUnit | null) {
    if (t.side === 0) {
      if (R.has('r_vanguard') && !t.dead && !vgDone.has(t)) {
        vgDone.add(t);
        tag(t, '先锋徽章');
        block(t, t, 1);
      }
      if (R.has('r_drums') && ++hurt0 % 5 === 0 && drumN < 3) {
        drumN++;
        tag(t, '战鼓');
        for (const x of alive(0)) buff(t, x, 1, 0);
      }
    }
    // 友军受伤时（风暴剑圣）
    for (const a of alive(t.side)) if (a !== t && a.ab === 'storm') fire(a, '友军受伤', (L) => buff(a, a, V(a, L), V(a, L)));
    switch (t.ab) {
      case 'thornback':
        if (src && src.side !== t.side && !src.dead) fire(t, '受伤', (L) => damage(t, src, V(t, L), 'shot'));
        break;
      case 'idol':
        if (!t.dead && t.uses < 3) {
          t.uses++;
          fire(t, '受伤', (L) => alive(t.side).forEach((x) => buff(t, x, V(t, L), V(t, L))));
        }
        break;
      case 'peacock':
        if (!t.dead) fire(t, '受伤', (L) => buff(t, t, V(t, L), 0));
        break;
      case 'camel':
        if (!t.dead) fire(t, '受伤', (L) => buff(t, behindOf(t), V(t, L), U(t, L)));
        break;
      case 'blowfish':
        fire(t, '受伤', (L) => {
          const fs = alive(1 - t.side);
          if (fs.length) damage(t, fs[Math.floor(rnd() * fs.length)], V(t, L), 'shot');
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
    for (const a of alive(u.side)) {
      if (a === u) continue;
      switch (a.ab) {
        case 'horse': fire(a, '友军被召唤', (L) => buff(a, u, V(a, L), 0)); break;
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
      if (!koQ.length) return;
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
    buff(u, u, 10, 10);
    if (u.lock <= 0) u.undy++;
  }
  /** 移除所有已死单位，依次结算阵亡触发；直到没有新死亡 */
  function processDeaths() {
    for (let guard = 0; guard < 60; guard++) {
      const dead = [...q[0], ...q[1]].filter((u) => u.dead);
      if (!dead.length) return checkLone();
      for (const u of dead) {
        const side = u.side;
        const line = q[side];
        const at = line.indexOf(u);
        if (at < 0) continue;
        line.splice(at, 1);
        ev.push({ t: 'die', uid: u.uid, order: order() });
        const nextBehind = line.slice(at).find((x) => !x.dead) ?? null;
        const aheadFriend = line.slice(0, at).filter((x) => !x.dead).pop() ?? null;
        const F = (fn: (L: 1 | 2 | 3) => void, label = '阵亡') => {
          fire(u, label, fn, nextBehind);
          if (u.sp === 'crown') fire(u, '冥魂王冠', fn, nextBehind);
        };
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
        if (u.reborn) {
          if (alive(side).length < QUEUE_MAX) {
            tag(u, '复生');
            const r = mk({ def: u.def, lvl: u.lvl, atk: u.atk, hp: 1, oid: u.oid, bank: u.bank, copy: u.copy }, side);
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
            line.splice(Math.min(at, line.length), 0, r);
            ev.push({ t: 'summon', src: u.uid, unit: snap(r), order: order(), revive: true });
            onSummoned(r);
          } else ev.push({ t: 'fizzle', uid: u.uid, label: '队伍满了' });
        }
        if (side === 0) {
          if (R.has('r_relay')) relay = true;
          const f = front(0);
          if (R.has('r_legacy') && f && u.atk >= 2) {
            tag(f, '传承');
            buff(f, f, Math.floor(u.atk / 2), 0);
          }
        }
        // 友军阵亡的反应
        for (const a of alive(side)) {
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
      if (R.has('r_few') && me.length <= 3) {
        tag(me[0], '少即是多');
        for (const x of me) buff(x, x, 3, 3);
      }
      if (R.has('r_heavy')) {
        tag(me[0], '重装铠');
        buff(me[0], me[0], 0, Math.ceil(me[0].maxHp / 2));
        for (const x of me.slice(1)) buff(x, x, -1, 0);
      }
      checkLone();
      const fs = alive(1);
      if (R.has('r_volley') && fs.length) {
        tag(me[0], '齐射号角');
        damage(me[0], fs[Math.floor(rnd() * fs.length)], me.length * 2, 'shot');
        settle();
      }
    }
  }
  // ── 开战：双方交替，按队列从前往后 ──
  const starters = Math.max(q[0].length, q[1].length);
  const startList: BUnit[] = [];
  for (let i = 0; i < starters; i++) for (const s of [0, 1]) if (q[s][i]) startList.push(q[s][i]);
  for (const u of startList) {
    if (u.dead) continue;
    const eq = equipOf(u.ench);
    if (eq?.block) block(u, u, eq.block);
    if (hasAx(u, 'shield')) {
      u.shield = Math.ceil(u.maxHp / 5);
      tag(u, '护盾');
      stat(u);
    }
    if (u.sp === 'blood') {
      tag(u, '饮血剑');
      damage(u, u, 3, 'shot');
    }
    const foes = () => alive(1 - u.side);
    switch (u.ab) {
      case 'ironwall': fire(u, '开战', (L) => block(u, u, V(u, L))); break;
      case 'drill': fire(u, '开战', (L) => {
        const line = q[u.side];
        for (const x of line.slice(line.indexOf(u) + 1).filter((x) => !x.dead).slice(0, V(u, L))) {
          damage(u, x, 1, 'shot');
          buff(u, x, 1, 0);
        }
      }); break;
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
      case 'leopard': fire(u, '开战', (L) => randomOf(foes(), V(u, L)).forEach((f) => damage(u, f, pct(u.atk, 50), 'shot'))); break;
    }
    settle();
  }
  settle();

  // ── 交锋循环 ──
  let n = 0;
  while (n < MAX_CLASHES && front(0) && front(1) && budget > 0) {
    n++;
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
        stat(foe);
      }
      if (u.sp === 'spear') {
        if (rest.length) tag(u, '贯日之枪');
        for (const x of rest) damage(u, x, dmg, 'splash');
        continue;
      }
      if (u.splash && rest[0]) damage(u, rest[0], pct(dmg, u.splash), 'splash');
      if (res > 0 && hasAx(u, 'pierce')) {
        const next = rest.find((x) => !x.dead);
        if (next) {
          tag(u, '穿透');
          damage(u, next, res, 'shot');
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
        damage(me, a1[a1.length - 1], 2, 'shot');
      }
    }
    for (const u of [...alive(0), ...alive(1)]) {
      if (u.sp !== 'storm' || u.dead) continue;
      tag(u, '风暴之心');
      for (const x of alive(1 - u.side)) damage(u, x, 1, 'shot');
    }
    settle();
    for (const u of [...alive(0), ...alive(1)]) if (u.burn > 0) damage(null, u, u.burn * 2, 'burn');
    for (const u of [...alive(0), ...alive(1)]) {
      if (u.lock <= 0) continue;
      if (--u.lock === 0) {
        tag(u, '不屈耗尽');
        u.hp = 0;
        u.dead = true;
        ev.push({ t: 'dmg', src: null, tgt: u.uid, n: 1, blocked: false, kind: 'burn', hp: 0, block: u.block, shield: u.shield });
      }
    }
    settle();
  }
  const l = alive(0).length;
  const r = alive(1).length;
  const result: Result = l && !r ? 'win' : r && !l ? 'lose' : 'draw';
  ev.push({ t: 'end', result });
  return { init, initOrder, events: ev, result, survivors: l, perm: {} };
}
