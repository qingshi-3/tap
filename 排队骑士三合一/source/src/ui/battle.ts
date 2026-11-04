// 战斗播放：只读引擎事件流，不推算规则。队首交锋双方都出攻击动作，不做受击动作 / 受击闪白。
import { ATOM_INFO, card, LINE_INFO } from '../core/data';
import type { BattleOut, Ev, Order, Snap } from '../core/engine';
import { sfx } from '../qb/audio';
import { Board, bodyPos, keywordsOf, UNIT_Y, UnitView } from '../qb/board';
import { h } from '../qb/dom';
import type { FX } from '../qb/fx';
import { icon } from '../qb/icons';

const SPEEDS = [1, 2, 3];
let speedIdx = 0;

interface Live { s: Snap; v: UnitView }

export class BattlePlayer {
  private live = new Map<number, Live>();
  private skipping = false;
  /** 阵亡动画并行播放；队伍补位等到下一次交锋 / 召唤前再统一挪（先死后动，召唤不闪位） */
  private dying: Promise<void>[] = [];
  private pendingOrder: Order | null = null;
  private log: HTMLElement;
  private phase: HTMLElement;
  /** 演示用：静音、播放倍率（慢放）、逐事件钩子（返回 Promise 时暂停等待）、中止 */
  private sfx: typeof sfx = sfx;
  private demo = false;
  rate = 1;
  hook: ((ev: Ev, i: number) => Promise<void> | void) | null = null;
  private stopped = false;
  /** 批量结算中：同一来源一次打到多个目标，特效一次铺开，不逐个过 */
  private batch = false;
  private batchSfx: (() => void) | null = null;
  /** 批量时同一目标的第几个飘字，往上错开 */
  private popN = new Map<number, number>();

  /** bar 为 null：图鉴演示模式（静音、固定 1 倍速，无速度 / 跳过按钮） */
  constructor(private board: Board, private fx: FX, bar: HTMLElement | null) {
    this.phase = h('b', null, '战斗');
    this.log = h('div', { class: 'bb-log' });
    if (!bar) {
      this.demo = true;
      this.sfx = new Proxy(sfx, { get: () => () => {} });
      this.fx.rate = 1;
      return;
    }
    const speedBtn = h('button', { class: 'btn ghost speed' }, icon('ff'), h('span', null, `${SPEEDS[speedIdx]}×`));
    speedBtn.addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      speedBtn.querySelector('span')!.textContent = `${SPEEDS[speedIdx]}×`;
      this.fx.rate = SPEEDS[speedIdx];
      this.sfx.click();
    });
    const skipBtn = h('button', { class: 'btn ghost' }, icon('skip'), h('span', null, '跳过'));
    skipBtn.addEventListener('click', () => { this.sfx.click(); this.skip(); });
    bar.replaceChildren(h('div', { class: 'bb-phase' }, h('span', { class: 'bb-dot' }), this.phase), this.log, h('div', { class: 'bb-btns' }, speedBtn, skipBtn));
    this.fx.rate = SPEEDS[speedIdx];
  }

  skip() {
    this.skipping = true;
  }

  stop() {
    this.stopped = true;
    this.skipping = true;
  }

  private get speed() { return (this.demo ? 1 : SPEEDS[speedIdx]) * this.rate; }
  private w(ms: number) {
    return this.skipping ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms / this.speed));
  }

  private bsfx(f: () => void) { if (this.batch) this.batchSfx ??= f; else f(); }
  private yo(tgt: number) {
    if (!this.batch) return 0;
    const n = this.popN.get(tgt) ?? 0;
    this.popN.set(tgt, n + 1);
    return n * 34;
  }
  private bw(ms: number) { return this.batch ? Promise.resolve() : this.w(ms); }

  private say(text: string) {
    if (this.skipping) return;
    this.log.prepend(h('div', { class: 'll' }, text));
    while (this.log.children.length > 4) this.log.lastElementChild!.remove();
  }

  private name(uid: number) {
    const L = this.live.get(uid);
    return L ? `${L.s.side === 0 ? '' : '敌·'}${card(L.s.def).name}` : '';
  }

  private color(uid: number | null) {
    const L = uid == null ? null : this.live.get(uid);
    if (!L) return '#fff';
    return L.s.side === 1 ? '#ff6b78' : LINE_INFO[card(L.s.def).line].color;
  }

  private pos(uid: number) {
    const L = this.live.get(uid);
    return L ? bodyPos(L.s.side, L.v.slot) : { x: 640, y: UNIT_Y };
  }

  private paint(L: Live, pop = false) {
    const s = L.s;
    const kw = keywordsOf(s.kws);
    kw.armor = s.shield ?? 0;
    L.v.setStats({ atk: s.atk, hp: s.hp, maxHp: s.maxHp, block: s.block, chill: 0, burn: s.burn ?? 0, kw }, { pop: pop && !this.skipping });
  }

  private mk(s: Snap, slot: number) {
    const v = new UnitView(s.def, s.side, slot, s.lvl, { token: !!card(s.def).token });
    this.board.add(`u${s.uid}`, v);
    const L: Live = { s: { ...s, kws: [...s.kws] }, v };
    this.live.set(s.uid, L);
    this.paint(L);
    v.setEquips([...(s.ench ? [s.ench] : []), ...(s.ax ?? []).filter((a) => s.side === 1).map((a) => ATOM_INFO[a].icon)]);
    return L;
  }

  private relayout(order: Order, except?: number) {
    const moves: Promise<void>[] = [];
    order.forEach((ids) => ids.forEach((id, i) => {
      const L = this.live.get(id);
      if (!L || id === except || L.v.slot === i) return;
      if (this.skipping) L.v.place(i);
      else moves.push(L.v.moveTo(i, 320 / this.speed, 10));
    }));
    return Promise.all(moves);
  }

  async play(out: BattleOut) {
    this.board.clearUnits();
    this.board.clearArrows();
    this.board.setCenter('0', '交锋', 'beat');
    for (const s of out.init) {
      const slot = out.initOrder[s.side].indexOf(s.uid);
      if (slot < 0 || slot >= 5) continue;
      const L = this.mk(s, slot);
      L.v.appear(slot * 60 + s.side * 30);
    }
    await this.w(700);
    for (let i = 0; i < out.events.length; i++) {
      const ev = out.events[i];
      if (this.stopped) return;
      const end = this.groupEnd(out.events, i);
      if (end > i) {
        await this.settle(false);
        if (this.hook) for (let k = i; k <= end; k++) await this.hook(out.events[k], k);
        await this.handleGroup(out.events.slice(i, end + 1));
        i = end;
        continue;
      }
      if (ev.t !== 'die') await this.settle(ev.t === 'clash' || ev.t === 'end');
      // 召唤要等单位出现后再框选
      if (this.hook && ev.t !== 'summon') await this.hook(ev, i);
      await this.handle(ev);
      if (this.hook && ev.t === 'summon') await this.hook(ev, i);
    }
    await this.settle(true);
    // 跳过时最后对齐一次
    this.skipping = false;
    this.phase.textContent = out.result === 'win' ? '胜利' : out.result === 'lose' ? '失败' : '平局';
  }

  /** 同一来源、同类效果连续打到多个目标（中间夹着的阵亡也算进来）→ 返回这一批最后一个事件的下标；不成批返回 i */
  private groupEnd(evs: Ev[], i: number) {
    const a = evs[i];
    // 同一来源的伤害/治疗/增益/格挡/词条可以混在一起（如「各造成 1 伤害并 +1 攻」逐个交替发出）
    const key = (e: Ev) => e.t === 'dmg' ? (e.kind === 'melee' || e.src == null ? null : `${e.src}`)
      : e.t === 'heal' || e.t === 'buff' || e.t === 'block' || e.t === 'kw' ? `${e.src}` : null;
    const k = key(a);
    if (!k) return i;
    const tg = new Set([(a as { tgt: number }).tgt]);
    let end = i;
    for (let j = i + 1; j < evs.length; j++) {
      const e = evs[j];
      if (e.t === 'die') continue;
      if (key(e) !== k) break;
      tg.add((e as { tgt: number }).tgt);
      end = j;
    }
    return tg.size > 1 ? end : i;
  }

  /** 一批效果：一道光扫过所有目标，然后同时结算、同时飘字，一声音效 */
  private async handleGroup(evs: Ev[]) {
    const first = evs.find((e) => e.t !== 'die')! as Extract<Ev, { tgt: number }>;
    const src = first.src;
    if (!this.skipping) {
      const tgts = evs.filter((e): e is Extract<Ev, { tgt: number }> => e.t !== 'die').map((e) => this.pos(e.tgt));
      const xs = tgts.map((p) => p.x);
      const c = first.t === 'heal' ? '#7dffb0' : first.t === 'block' ? '#ffe08a' : this.color(src);
      const from = src != null && this.live.has(src) ? this.pos(src) : null;
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      // 从施放者那一侧扫向另一侧
      const rev = from ? Math.abs(from.x - x1) < Math.abs(from.x - x0) : false;
      if (from && (from.x < x0 - 20 || from.x > x1 + 20)) this.fx.orb({ x: from.x, y: from.y - 30 }, { x: rev ? x1 : x0, y: tgts[0].y - 30 }, c, 200 / this.speed);
      if (from) await this.w(from.x < x0 - 20 || from.x > x1 + 20 ? 200 : 0);
      this.fx.sweep(rev ? x1 + 50 : x0 - 50, rev ? x0 - 50 : x1 + 50, tgts[0].y - 20, c, 380 / this.speed);
      await this.w(140);
    }
    this.batch = true;
    this.batchSfx = null;
    this.popN.clear();
    for (const e of evs) await this.handle(e);
    this.batch = false;
    (this.batchSfx as (() => void) | null)?.();
    this.batchSfx = null;
    await this.w(first.t === 'dmg' ? 260 : 240);
  }

  private async settle(layout: boolean) {
    if (this.dying.length) { const d = this.dying; this.dying = []; await Promise.all(d); }
    if (layout && this.pendingOrder) { const o = this.pendingOrder; this.pendingOrder = null; await this.relayout(o); }
  }

  private async handle(ev: Ev) {
    const fx = this.fx;
    const quiet = this.skipping;
    switch (ev.t) {
      case 'clash': {
        this.board.setCenter(String(ev.n), '交锋', 'beat');
        this.phase.textContent = `交锋 ${ev.n}`;
        const A = this.live.get(ev.a), B = this.live.get(ev.b);
        if (quiet || !A || !B) return;
        void A.v.lunge(1, 40, 360 / this.speed);
        void B.v.lunge(-1, 40, 360 / this.speed);
        await this.w(170);
        fx.impact(640, UNIT_Y - 20, '#fff2c0', false);
        this.sfx.hit();
        await this.w(60);
        return;
      }
      case 'trigger': {
        const L = this.live.get(ev.uid);
        if (!L) return;
        this.say(`${this.name(ev.uid)}：${ev.label}`);
        if (quiet) return;
        const c = this.color(ev.uid);
        const p = this.pos(ev.uid);
        L.v.castMotion(c, 420 / this.speed);
        fx.float(p.x, p.y - 96, ev.label, 'combo', 900);
        this.sfx.trigger();
        await this.w(260);
        return;
      }
      case 'dmg': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        const p = this.pos(ev.tgt);
        if (!quiet && !this.batch && ev.kind !== 'melee' && ev.src != null && this.live.has(ev.src)) {
          const a = this.pos(ev.src);
          fx.orb({ x: a.x, y: a.y - 30 }, { x: p.x, y: p.y - 30 }, this.color(ev.src), 260 / this.speed);
          await this.w(260);
        }
        T.s.hp = ev.hp;
        T.s.block = ev.block;
        const shieldHit = ev.blocked && T.s.shield > ev.shield;
        T.s.shield = ev.shield;
        this.paint(T, true);
        if (quiet) return;
        const yo = this.yo(ev.tgt);
        if (shieldHit) {
          fx.ring(p.x, p.y - 20, '#8fd8ff', 54, 20);
          fx.float(p.x, p.y - 80 - yo, `护盾 -${ev.n}`, 'shield', 800);
          this.bsfx(() => this.sfx.shieldHit());
        } else if (ev.blocked) {
          // 格挡碎裂
          fx.burst(p.x, p.y - 20, '#ffe08a', { n: 18, speed: 6, kind: 'shard', size: 4 });
          fx.ring(p.x, p.y - 20, '#ffe08a', 50, 20);
          fx.float(p.x, p.y - 80 - yo, '格挡', 'shield', 800);
          this.bsfx(() => this.sfx.shieldHit());
        } else {
          fx.float(p.x, p.y - 80 - yo, `-${ev.n}`, 'dmg', 800);
          if (ev.kind === 'splash') fx.burst(p.x, p.y - 20, '#ffb340', { n: 12, speed: 5 });
          if (ev.kind === 'burn') fx.burst(p.x, p.y - 20, '#ff6a2a', { n: 10, speed: 3, up: 2 });
          if (ev.kind !== 'melee') this.bsfx(() => this.sfx.hit(ev.n >= 6));
        }
        await this.bw(ev.kind === 'melee' ? 100 : 180);
        return;
      }
      case 'heal': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        T.s.hp = ev.hp;
        this.paint(T, true);
        if (quiet) return;
        const yo = this.yo(ev.tgt);
        const p = this.pos(ev.tgt);
        if (!this.batch && ev.src !== ev.tgt && this.live.has(ev.src)) {
          const a = this.pos(ev.src);
          fx.orb({ x: a.x, y: a.y - 30 }, { x: p.x, y: p.y - 30 }, '#7dffb0', 240 / this.speed);
          await this.w(240);
        }
        fx.float(p.x, p.y - 80 - yo, `+${ev.n}`, 'buff', 800);
        this.bsfx(() => this.sfx.buff());
        await this.bw(180);
        return;
      }
      case 'buff': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        const p = this.pos(ev.tgt);
        if (!quiet && !this.batch && ev.src !== ev.tgt && this.live.has(ev.src)) {
          const a = this.pos(ev.src);
          fx.orb({ x: a.x, y: a.y - 30 }, { x: p.x, y: p.y - 30 }, this.color(ev.src), 240 / this.speed);
          await this.w(240);
        }
        T.s.atk = ev.nowAtk;
        T.s.hp = ev.nowHp;
        T.s.maxHp = Math.max(T.s.maxHp, ev.nowHp);
        this.paint(T, true);
        if (quiet) return;
        const yo = this.yo(ev.tgt);
        const neg = ev.atk < 0 || ev.hp < 0;
        const sg = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
        fx.statPop(p.x, p.y - 80 - yo, `${sg(ev.atk)}/${sg(ev.hp)}`, ev.perm ? '永久' : '', neg ? 'pt-atk' : ev.atk >= ev.hp ? 'pt-atk' : 'pt-hp', 760);
        this.bsfx(() => this.sfx.buff());
        await this.bw(200);
        return;
      }
      case 'block': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        const p = this.pos(ev.tgt);
        if (!quiet && !this.batch && ev.src !== ev.tgt && this.live.has(ev.src)) {
          const a = this.pos(ev.src);
          fx.orb({ x: a.x, y: a.y - 30 }, { x: p.x, y: p.y - 30 }, '#ffe08a', 240 / this.speed);
          await this.w(240);
        }
        T.s.block = ev.block;
        this.paint(T, true);
        if (quiet) return;
        const yo = this.yo(ev.tgt);
        fx.statPop(p.x, p.y - 80 - yo, `+${ev.n}`, '格挡', 'pt-block', 760);
        this.bsfx(() => this.sfx.shield());
        await this.bw(180);
        return;
      }
      case 'kw': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        T.s.kws = [...new Set([...T.s.kws, ...ev.kws])];
        this.paint(T, true);
        if (quiet) return;
        const yo = this.yo(ev.tgt);
        const p = this.pos(ev.tgt);
        const names: Record<string, string> = { reborn: '复生', splash: '溅射', block: '格挡' };
        fx.float(p.x, p.y - 80 - yo, ev.kws.map((k) => names[k] ?? k).join(' '), 'grant', 800);
        this.bsfx(() => this.sfx.buff());
        await this.bw(180);
        return;
      }
      case 'die': {
        const L = this.live.get(ev.uid);
        if (!L) return;
        this.live.delete(ev.uid);
        this.board.views.delete(`u${ev.uid}`);
        this.say(`${L.s.side === 0 ? '' : '敌·'}${card(L.s.def).name} 阵亡`);
        this.pendingOrder = ev.order;
        if (quiet) { L.v.el.remove(); return; }
        const p = bodyPos(L.s.side, L.v.slot);
        fx.burst(p.x, p.y, L.s.side === 1 ? '#ff6b78' : LINE_INFO[card(L.s.def).line].color, { n: 14, speed: 4 });
        this.sfx.death();
        this.dying.push(L.v.die());
        return;
      }
      case 'summon': {
        const s = ev.unit;
        const idx = ev.order[s.side].indexOf(s.uid);
        this.pendingOrder = null;
        await this.relayout(ev.order);
        if (idx < 0 || idx >= 5) return;
        const L = this.mk(s, idx);
        this.say(`${ev.revive ? '复生' : '召唤'}：${this.name(s.uid)}`);
        if (quiet) return;
        const p = bodyPos(s.side, idx);
        L.v.appear();
        fx.ring(p.x, p.y, ev.revive ? '#78f0ff' : '#d6a8ff', 70, 28);
        if (ev.revive) fx.float(p.x, p.y - 90, '复生', 'grant', 900);
        this.sfx.summon();
        await this.w(380);
        return;
      }
      case 'fizzle': {
        if (quiet) return;
        const p = this.pos(ev.uid);
        fx.float(p.x, p.y - 90, ev.label, 'fizzle', 800);
        this.sfx.fizzle();
        await this.w(200);
        return;
      }
      case 'stat': {
        const T = this.live.get(ev.uid);
        if (!T) return;
        const more = ev.shield > T.s.shield;
        const burnUp = ev.burn > T.s.burn;
        T.s.shield = ev.shield;
        T.s.burn = ev.burn;
        this.paint(T, true);
        if (quiet) return;
        const p = this.pos(ev.uid);
        if (more) { fx.ring(p.x, p.y - 20, '#8fd8ff', 64, 24); fx.statPop(p.x, p.y - 80, `+${ev.shield}`, '护盾', 'pt-block', 760); this.sfx.shield(); }
        if (burnUp) { fx.burst(p.x, p.y - 20, '#ff6a2a', { n: 10, speed: 3 }); fx.float(p.x, p.y - 80, `灼烧 ${ev.burn}`, 'dmg', 700); }
        await this.w(140);
        return;
      }
      case 'end':
        return;
    }
  }
}
