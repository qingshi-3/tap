// 碰撞制战斗引擎：队首对队首同时互打，后排只靠事件技能参与。
// 纯函数：输入两队，输出事件流 + 结果。播放层只读事件，不再推算规则。
import { card, type CardDef, type Ench, type Kw } from './data';

export const QUEUE_MAX = 5;
export const MAX_CLASHES = 30;
const RITUAL_USES = 3;
const ENGULF_USES = 3;

export interface UnitSpec {
  def: string;
  lvl: 1 | 2 | 3;
  atk: number;
  hp: number;
  /** 我方单位的存档 id，用于把战斗内的永久成长写回 */
  oid?: number;
  ench?: Ench | null;
  /** 魂灯：只这一场有复生 */
  lamp?: boolean;
  /** 幼兽蛋积攒的成长 */
  bank?: number;
}

export interface BUnit {
  uid: number;
  side: 0 | 1;
  def: string;
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
  uses2: number;
  bank: number;
  oid?: number;
  ench?: Ench | null;
  dead: boolean;
}

export type Snap = Pick<BUnit, 'uid' | 'side' | 'def' | 'lvl' | 'atk' | 'hp' | 'maxHp' | 'block' | 'kws'> & { ench?: Ench | null };
export type Order = [number[], number[]];

export type Ev =
  | { t: 'clash'; n: number; a: number; b: number }
  | { t: 'trigger'; uid: number; label: string }
  | { t: 'dmg'; src: number | null; tgt: number; n: number; blocked: boolean; kind: 'melee' | 'shot' | 'splash'; hp: number; block: number }
  | { t: 'heal'; src: number; tgt: number; n: number; hp: number }
  | { t: 'buff'; src: number; tgt: number; atk: number; hp: number; nowAtk: number; nowHp: number; perm?: boolean }
  | { t: 'block'; src: number; tgt: number; n: number; block: number }
  | { t: 'kw'; src: number; tgt: number; kws: Kw[] }
  | { t: 'die'; uid: number; order: Order }
  | { t: 'rotate'; uid: number; order: Order }
  | { t: 'summon'; src: number | null; unit: Snap; order: Order; revive?: boolean }
  | { t: 'fizzle'; uid: number; label: string }
  | { t: 'end'; result: Result };

export type Result = 'win' | 'lose' | 'draw';
export interface BattleOut {
  init: Snap[];
  initOrder: Order;
  events: Ev[];
  result: Result;
  survivors: number;
  /** 战斗内获得的永久成长（按 oid） */
  perm: Record<number, { atk: number; hp: number }>;
}

const val = (d: CardDef, lvl: number) => (d.v ? d.v[lvl - 1] : 0);
const val2 = (d: CardDef, lvl: number) => (d.u ? d.u[lvl - 1] : 0);

export function simulate(left: UnitSpec[], right: UnitSpec[], seed = 1): BattleOut {
  let uid = 1;
  let rs = seed || 1;
  const rnd = () => ((rs = (rs * 1103515245 + 12345) & 0x7fffffff), rs / 0x7fffffff);
  const ev: Ev[] = [];
  const perm: BattleOut['perm'] = {};
  const q: [BUnit[], BUnit[]] = [[], []];
  const mk = (s: UnitSpec, side: 0 | 1): BUnit => {
    const d = card(s.def);
    const kws = [...d.kws];
    if (s.ench === 'rotate' && !kws.includes('rotate')) kws.push('rotate');
    if (s.ench === 'chili' && !kws.includes('splash')) kws.push('splash');
    const reborn = kws.includes('reborn') || s.ench === 'shroom' || !!s.lamp;
    if (reborn && !kws.includes('reborn')) kws.push('reborn');
    const splash = d.kws.includes('splash') ? val(d, s.lvl) || 50 : s.ench === 'chili' ? 50 : 0;
    return {
      uid: uid++, side, def: s.def, lvl: s.lvl, atk: s.atk, hp: s.hp, maxHp: s.hp, block: 0, kws, reborn, splash,
      melee: s.ench === 'wine' ? 5 : 0, uses: 0, uses2: 0, bank: s.bank ?? 0, oid: s.oid, ench: s.ench ?? null, dead: false,
    };
  };
  left.slice(0, QUEUE_MAX).forEach((s) => q[0].push(mk(s, 0)));
  right.slice(0, QUEUE_MAX).forEach((s) => q[1].push(mk(s, 1)));
  const snap = (u: BUnit): Snap => ({ uid: u.uid, side: u.side, def: u.def, lvl: u.lvl, atk: u.atk, hp: u.hp, maxHp: u.maxHp, block: u.block, kws: [...u.kws], ench: u.ench });
  const init = [...q[0], ...q[1]].map(snap);
  const order = (): Order => [q[0].map((u) => u.uid), q[1].map((u) => u.uid)];
  const initOrder = order();
  const D = (u: BUnit) => card(u.def);
  const V = (u: BUnit) => val(D(u), u.lvl);
  const alive = (side: number) => q[side].filter((u) => !u.dead);
  const front = (side: number) => alive(side)[0] ?? null;
  const allies = (u: BUnit) => q[u.side].filter((x) => x !== u && !x.dead);
  const has = (u: BUnit, ab: string) => !u.dead && D(u).ab === ab;
  const sideHas = (side: number, ab: string) => alive(side).filter((x) => D(x).ab === ab);
  let budget = 6000;
  const tag = (u: BUnit, label: string) => ev.push({ t: 'trigger', uid: u.uid, label });
  const behindOf = (u: BUnit) => {
    const line = q[u.side];
    return line.slice(line.indexOf(u) + 1).find((x) => !x.dead) ?? null;
  };
  const aheadOf = (u: BUnit) => {
    const line = q[u.side];
    return line.slice(0, line.indexOf(u)).filter((x) => !x.dead).pop() ?? null;
  };
  /** 曙光执政官：上前/退后类技能额外结算次数 */
  const reps = (side: number) => 1 + Math.min(2, sideHas(side, 'archon').reduce((s, a) => s + V(a), 0));

  function damage(src: BUnit | null, tgt: BUnit, n: number, kind: 'melee' | 'shot' | 'splash') {
    if (tgt.dead || n <= 0 || --budget < 0) return;
    if (kind === 'shot' && src) n += sideHas(src.side, 'viper').reduce((s, a) => s + V(a), 0);
    if (tgt.block > 0) {
      tgt.block--;
      ev.push({ t: 'dmg', src: src?.uid ?? null, tgt: tgt.uid, n, blocked: true, kind, hp: tgt.hp, block: tgt.block });
      onBlocked(tgt);
      return;
    }
    tgt.hp -= n;
    ev.push({ t: 'dmg', src: src?.uid ?? null, tgt: tgt.uid, n, blocked: false, kind, hp: tgt.hp, block: tgt.block });
    if (tgt.hp <= 0) tgt.dead = true;
    onHurt(tgt);
  }
  function buff(src: BUnit, tgt: BUnit, atk: number, hp: number, isPerm = false) {
    if (tgt.dead || (!atk && !hp)) return;
    tgt.atk = Math.min(50, Math.max(1, tgt.atk + atk));
    const h = Math.min(hp, 50 - tgt.maxHp);
    tgt.hp += Math.max(0, h);
    tgt.maxHp += Math.max(0, h);
    ev.push({ t: 'buff', src: src.uid, tgt: tgt.uid, atk, hp, nowAtk: tgt.atk, nowHp: tgt.hp, perm: isPerm || undefined });
  }
  function debuffAtk(src: BUnit, tgt: BUnit, n: number) {
    const real = Math.min(n, tgt.atk - 1);
    if (tgt.dead || real <= 0) return;
    tgt.atk -= real;
    ev.push({ t: 'buff', src: src.uid, tgt: tgt.uid, atk: -real, hp: 0, nowAtk: tgt.atk, nowHp: tgt.hp });
  }
  function heal(src: BUnit, tgt: BUnit, n: number) {
    const real = Math.min(n, tgt.maxHp - tgt.hp);
    if (tgt.dead || real <= 0) return;
    tgt.hp += real;
    ev.push({ t: 'heal', src: src.uid, tgt: tgt.uid, n: real, hp: tgt.hp });
  }
  function block(src: BUnit, tgt: BUnit, n: number) {
    if (tgt.dead || n <= 0) return;
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
  function summon(src: BUnit | null, side: 0 | 1, s: UnitSpec, at: number | 'back'): BUnit | null {
    if (alive(side).length >= QUEUE_MAX) {
      if (src) ev.push({ t: 'fizzle', uid: src.uid, label: '队伍满了' });
      return null;
    }
    const u = mk(s, side);
    if (at === 'back') q[side].push(u);
    else q[side].splice(Math.min(at, q[side].length), 0, u);
    ev.push({ t: 'summon', src: src?.uid ?? null, unit: snap(u), order: order() });
    onSummoned(u);
    return u;
  }
  const token = (def: string, n: number): UnitSpec => ({ def, lvl: 1, atk: n, hp: n });

  // ── 事件分派 ──
  function onHurt(tgt: BUnit) {
    const behind = behindOf(tgt);
    if (behind && has(behind, 'dart')) {
      const f = front(1 - tgt.side);
      if (f) {
        tag(behind, '身前友军受伤');
        damage(behind, f, V(behind), 'shot');
      }
    }
    if (!tgt.dead && has(tgt, 'kujata') && tgt.uses2 < val2(D(tgt), tgt.lvl)) {
      tgt.uses2++;
      tag(tgt, '受伤');
      summon(tgt, tgt.side, token('t_wolf', V(tgt)), 'back');
    }
  }
  function onBlocked(tgt: BUnit) {
    for (const a of alive(tgt.side)) {
      if (has(a, 'bear')) {
        tag(a, '格挡生效');
        buff(a, a, V(a), V(a));
      }
      if (has(a, 'queen')) {
        const f = front(1 - a.side);
        if (f) {
          tag(a, '格挡生效');
          damage(a, f, val2(D(a), a.lvl), 'shot');
        }
      }
    }
  }
  function onSummoned(u: BUnit) {
    for (const a of allies(u)) {
      if (has(a, 'whelp')) {
        tag(a, '友军被召唤');
        buff(a, a, V(a), 0);
      }
      if (has(a, 'incubator')) {
        tag(a, '友军被召唤');
        buff(a, u, V(a), V(a));
      }
      if (has(a, 'bloodcaller')) {
        tag(a, '友军被召唤');
        buff(a, u, Math.floor((a.atk * V(a)) / 100), Math.floor((a.hp * V(a)) / 100));
      }
      if (has(a, 'heart') && D(u).token) {
        tag(a, '召唤物出现');
        buff(a, u, V(a), V(a));
        giveKw(a, u, 'splash');
      }
    }
  }
  function onStepUp(u: BUnit) {
    for (let k = reps(u.side); k > 0; k--) {
      if (u.dead) return;
      if (has(u, 'step')) {
        const enemies = alive(1 - u.side);
        const t = enemies[1] ?? enemies[0];
        if (t) {
          tag(u, '上前');
          damage(u, t, V(u), 'shot');
        }
      }
      if (has(u, 'knight')) {
        tag(u, '上前');
        buff(u, u, V(u), 0);
      }
      for (const a of allies(u)) {
        if (has(a, 'caliber')) {
          tag(a, '友军上前');
          buff(a, u, V(a), V(a));
        }
      }
    }
  }
  function onRetreat(u: BUnit) {
    for (let k = reps(u.side); k > 0; k--) {
      if (has(u, 'vigil')) {
        tag(u, '退后');
        block(u, u, V(u));
      }
      for (const a of allies(u)) {
        if (has(a, 'wind')) {
          tag(a, '友军退后');
          buff(a, a, V(a), 0);
        }
        if (has(a, 'medic') && u.hp < u.maxHp) {
          tag(a, '友军退后');
          heal(a, u, V(a));
        }
        if (has(a, 'storm')) {
          const foes = alive(1 - a.side);
          if (foes[0]) {
            tag(a, '友军退后');
            damage(a, foes[0], V(a), 'shot');
            if (a.lvl >= 3 && foes[1]) damage(a, foes[1], V(a), 'shot');
          }
        }
      }
    }
  }
  const lastFront: (BUnit | null)[] = [null, null];
  /** 结算死亡，再检查队首是否换人（上前）；上前技能可能再杀人，循环到稳定 */
  function settle() {
    for (let guard = 0; guard < 80; guard++) {
      processDeaths();
      let changed = false;
      for (const s of [0, 1]) {
        const now = front(s);
        if (now && now !== lastFront[s]) {
          lastFront[s] = now;
          changed = true;
          onStepUp(now);
        }
      }
      if (!changed && ![...q[0], ...q[1]].some((u) => u.dead)) return;
    }
  }

  /** 移除所有已死单位，依次结算阵亡触发；直到没有新死亡 */
  function processDeaths() {
    for (let guard = 0; guard < 60; guard++) {
      const dead = [...q[0], ...q[1]].filter((u) => u.dead);
      if (!dead.length) return;
      for (const u of dead) {
        const side = u.side;
        const line = q[side];
        const at = line.indexOf(u);
        if (at < 0) continue;
        line.splice(at, 1);
        ev.push({ t: 'die', uid: u.uid, order: order() });
        const ab = D(u).ab;
        if (ab === 'imp') {
          tag(u, '阵亡');
          summon(u, side, token(D(u).enemy ? 't_bonelet' : 't_wisp', V(u)), at);
        }
        if (ab === 'egg') {
          tag(u, '孵化');
          summon(u, side, token('t_drakelet', Math.min(50, 1 + u.bank)), at);
        }
        if (ab === 'titan') {
          tag(u, '阵亡');
          for (let i = 0; i < 3; i++) summon(u, side, token('t_statue', V(u)), at);
        }
        if (ab === 'cult') {
          const heir = line.slice(at).find((x) => !x.dead);
          if (heir) {
            tag(u, '献祭');
            buff(u, heir, Math.floor((u.atk * V(u)) / 100), Math.floor((u.maxHp * V(u)) / 100));
          }
        }
        if (ab === 'nightmare') {
          tag(u, '阵亡');
          for (const f of alive(1 - side)) damage(u, f, V(u), 'shot');
        }
        if (u.reborn) {
          if (alive(side).length < QUEUE_MAX) {
            tag(u, '复生');
            const r = mk({ def: u.def, lvl: u.lvl, atk: u.atk, hp: 1, oid: u.oid, bank: u.bank }, side);
            r.reborn = false;
            r.uses = u.uses;
            r.uses2 = u.uses2;
            r.kws = u.kws.filter((k) => k !== 'reborn');
            r.splash = u.splash;
            r.melee = u.melee;
            r.ench = u.ench;
            q[side].push(r);
            ev.push({ t: 'summon', src: u.uid, unit: snap(r), order: order(), revive: true });
            onSummoned(r);
          } else ev.push({ t: 'fizzle', uid: u.uid, label: '队伍满了' });
        }
        for (const a of alive(side)) {
          if (has(a, 'reaper')) {
            tag(a, '友军阵亡');
            buff(a, a, V(a), V(a));
          }
          if (has(a, 'spine')) {
            const f = front(1 - side);
            if (f) {
              tag(a, '友军阵亡');
              damage(a, f, V(a), 'shot');
            }
          }
          if (has(a, 'ritualist') && a.uses < RITUAL_USES) {
            a.uses++;
            tag(a, '友军阵亡');
            summon(a, side, token('t_bonelet', V(a)), 'back');
          }
          if (has(a, 'matriarch') && a.uses < V(a) && ab !== 'matriarch') {
            a.uses++;
            tag(a, '复制');
            summon(a, side, { def: u.def, lvl: u.lvl, atk: 1, hp: 1, bank: u.bank }, 'back');
          }
        }
        for (const a of alive(1 - side)) {
          if (has(a, 'engulf') && a.uses < ENGULF_USES) {
            a.uses++;
            tag(a, '敌方阵亡');
            buff(a, a, V(a), V(a), a.oid !== undefined);
            if (a.oid !== undefined) {
              const p = (perm[a.oid] ??= { atk: 0, hp: 0 });
              p.atk += V(a);
              p.hp += V(a);
            }
          }
        }
      }
    }
  }

  function rotate(u: BUnit) {
    const side = u.side;
    const line = q[side];
    if (alive(side).length < 2 || u.dead) return false;
    line.splice(line.indexOf(u), 1);
    line.push(u);
    ev.push({ t: 'rotate', uid: u.uid, order: order() });
    onRetreat(u);
    settle();
    return true;
  }

  // ── 开战：双方交替，按队列从前往后 ──
  const starters = Math.max(q[0].length, q[1].length);
  const startList: BUnit[] = [];
  for (let i = 0; i < starters; i++) for (const s of [0, 1]) if (q[s][i]) startList.push(q[s][i]);
  for (const u of startList) {
    if (u.dead) continue;
    if (u.ench === 'iron') block(u, u, 1);
    if (u.ench === 'amulet') block(u, u, 3);
    const foes = () => alive(1 - u.side);
    switch (D(u).ab) {
      case 'guard':
        tag(u, '开战');
        block(u, u, V(u));
        break;
      case 'snowman': {
        const ahead = aheadOf(u);
        if (ahead) {
          tag(u, '开战');
          block(u, ahead, V(u));
        }
        break;
      }
      case 'scout': {
        const f = foes()[0];
        if (f) {
          tag(u, '开战');
          debuffAtk(u, f, V(u));
        }
        break;
      }
      case 'wyvern':
        tag(u, '开战');
        for (const f of foes()) debuffAtk(u, f, V(u));
        break;
      case 'queen':
        tag(u, '开战');
        for (const a of alive(u.side)) block(u, a, V(u));
        break;
      case 'fox': {
        const fs = foes();
        if (fs.length) {
          tag(u, '开战');
          damage(u, fs[Math.floor(rnd() * fs.length)], V(u), 'shot');
        }
        break;
      }
      case 'hunter':
        for (let k = u.lvl >= 3 ? 2 : 1; k > 0; k--) {
          const fs = foes();
          if (!fs.length) break;
          const t = fs.reduce((m, x) => (x.hp > m.hp ? x : m));
          tag(u, '开战');
          damage(u, t, V(u), 'shot');
        }
        break;
      case 'master': {
        const back = alive(u.side).slice(1);
        if (back.length) tag(u, '开战');
        for (const a of back) {
          const fs = foes();
          if (fs.length) damage(a, fs[Math.floor(rnd() * fs.length)], V(u), 'shot');
        }
        break;
      }
      case 'chanter': {
        tag(u, '开战');
        const line = alive(u.side);
        for (const a of line.slice(line.indexOf(u) + 1, line.indexOf(u) + 1 + V(u))) giveKw(u, a, 'reborn');
        break;
      }
      case 'raptor':
        tag(u, '开战');
        summon(u, u.side, token('t_wolf', V(u)), q[u.side].indexOf(u) + 1);
        break;
      case 'rex':
        tag(u, '开战');
        summon(u, u.side, token('t_flame', V(u)), q[u.side].indexOf(u) + 1);
        break;
    }
    processDeaths();
  }
  lastFront[0] = front(0);
  lastFront[1] = front(1);
  settle();

  // ── 交锋循环 ──
  let n = 0;
  while (n < MAX_CLASHES && front(0) && front(1) && budget > 0) {
    n++;
    const a = front(0)!;
    const b = front(1)!;
    ev.push({ t: 'clash', n, a: a.uid, b: b.uid });
    const hit = (u: BUnit) => u.atk + u.melee + (u.block > 0 && has(u, 'sentinel') ? V(u) : 0);
    const atkA = hit(a);
    const atkB = hit(b);
    damage(a, b, atkA, 'melee');
    damage(b, a, atkB, 'melee');
    // 溅射
    for (const [u, foe, dmg] of [[a, b, atkA], [b, a, atkB]] as const) {
      if (u.splash) {
        const line = q[foe.side];
        const second = line.slice(line.indexOf(foe) + 1).find((x) => !x.dead);
        if (second) damage(u, second, Math.max(1, Math.floor((dmg * u.splash) / 100)), 'splash');
      }
    }
    // 冰原巨犀：击杀队首后补一下新队首
    for (const [u, foe] of [[a, b], [b, a]] as const) {
      if (foe.dead && has(u, 'rhyno')) {
        const next = alive(foe.side)[0];
        if (next) {
          tag(u, '击杀队首');
          damage(u, next, V(u), 'shot');
        }
      }
    }
    // 影舞者：紧跟在交锋者身后
    for (const u of [a, b]) {
      const behind = behindOf(u);
      if (behind && has(behind, 'dancer')) {
        const f = alive(1 - u.side)[0];
        if (f) {
          tag(behind, '身前友军交锋');
          damage(behind, f, Math.max(1, Math.floor((behind.atk * V(behind)) / 100)), 'shot');
        }
      }
    }
    // 岚影宗主：后排齐射
    for (const s of [0, 1]) {
      const lords = sideHas(s, 'lord');
      if (!lords.length) continue;
      const pct = Math.max(...lords.map(V));
      tag(lords[0], '齐射');
      for (const u of alive(s).slice(1)) {
        const f = alive(1 - s)[0];
        if (f) damage(u, f, Math.max(1, Math.floor((u.atk * pct) / 100)), 'shot');
      }
    }
    settle();
    // 轮换：只对本次交锋的、仍是队首的存活单位
    for (const s of [0, 1] as const) {
      const f = s === 0 ? a : b;
      if (f.dead || front(s) !== f) continue;
      if (f.kws.includes('rotate')) {
        rotate(f);
        continue;
      }
      const tether = alive(s).find((x) => has(x, 'tether') && x.uses < V(x) && x !== f);
      if (tether && alive(s).length > 1) {
        tether.uses++;
        tag(tether, '让队首退后');
        rotate(f);
      }
    }
    // 交锋后
    for (const s of [0, 1]) {
      for (const u of alive(s)) {
        if (has(u, 'wkeeper') && u.uses < V(u)) {
          const f = front(s);
          if (f) {
            u.uses++;
            tag(u, '交锋后');
            block(u, f, 1);
          }
        }
      }
    }
  }
  const l = alive(0).length;
  const r = alive(1).length;
  const result: Result = l && !r ? 'win' : r && !l ? 'lose' : 'draw';
  ev.push({ t: 'end', result });
  return { init, initOrder, events: ev, result, survivors: l, perm };
}
