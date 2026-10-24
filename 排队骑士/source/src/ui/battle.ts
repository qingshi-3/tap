// 战斗播放：只读引擎事件流，不推算规则。队首交锋双方都出攻击动作，不做受击动作 / 受击闪白。
import { card, LINE_INFO } from '../core/data';
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
  /** 阵亡动画并行播放；队伍补位等到下一次交锋 / 轮换 / 召唤前再统一挪（先死后动，召唤不闪位） */
  private dying: Promise<void>[] = [];
  private pendingOrder: Order | null = null;
  private log: HTMLElement;
  private phase: HTMLElement;

  constructor(private board: Board, private fx: FX, bar: HTMLElement) {
    const speedBtn = h('button', { class: 'btn ghost speed' }, icon('ff'), h('span', null, `${SPEEDS[speedIdx]}×`));
    speedBtn.addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      speedBtn.querySelector('span')!.textContent = `${SPEEDS[speedIdx]}×`;
      this.fx.rate = SPEEDS[speedIdx];
      sfx.click();
    });
    const skipBtn = h('button', { class: 'btn ghost' }, icon('skip'), h('span', null, '跳过'));
    skipBtn.addEventListener('click', () => { sfx.click(); this.skip(); });
    this.phase = h('b', null, '战斗');
    this.log = h('div', { class: 'bb-log' });
    bar.replaceChildren(h('div', { class: 'bb-phase' }, h('span', { class: 'bb-dot' }), this.phase), this.log, h('div', { class: 'bb-btns' }, speedBtn, skipBtn));
    this.fx.rate = SPEEDS[speedIdx];
  }

  skip() {
    this.skipping = true;
  }

  private get speed() { return SPEEDS[speedIdx]; }
  private w(ms: number) {
    return this.skipping ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms / this.speed));
  }

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
    L.v.setStats({ atk: s.atk, hp: s.hp, maxHp: s.maxHp, block: s.block, chill: 0, burn: 0, kw: keywordsOf(s.kws) }, { pop: pop && !this.skipping });
  }

  private mk(s: Snap, slot: number) {
    const v = new UnitView(s.def, s.side, slot, s.lvl, { token: !!card(s.def).token });
    this.board.add(`u${s.uid}`, v);
    const L: Live = { s: { ...s, kws: [...s.kws] }, v };
    this.live.set(s.uid, L);
    this.paint(L);
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
    for (const ev of out.events) {
      if (ev.t !== 'die') await this.settle(ev.t === 'clash' || ev.t === 'end');
      await this.handle(ev);
    }
    await this.settle(true);
    // 跳过时最后对齐一次
    this.skipping = false;
    this.phase.textContent = out.result === 'win' ? '胜利' : out.result === 'lose' ? '失败' : '平局';
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
        sfx.hit();
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
        sfx.trigger();
        await this.w(260);
        return;
      }
      case 'dmg': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        const p = this.pos(ev.tgt);
        if (!quiet && ev.kind !== 'melee' && ev.src != null && this.live.has(ev.src)) {
          const a = this.pos(ev.src);
          fx.orb({ x: a.x, y: a.y - 30 }, { x: p.x, y: p.y - 30 }, this.color(ev.src), 260 / this.speed);
          await this.w(260);
        }
        T.s.hp = ev.hp;
        T.s.block = ev.block;
        this.paint(T, true);
        if (quiet) return;
        if (ev.blocked) {
          // 格挡碎裂
          fx.burst(p.x, p.y - 20, '#ffe08a', { n: 18, speed: 6, kind: 'shard', size: 4 });
          fx.ring(p.x, p.y - 20, '#ffe08a', 50, 20);
          fx.float(p.x, p.y - 80, '格挡', 'shield', 800);
          sfx.shieldHit();
        } else {
          fx.float(p.x, p.y - 80, `-${ev.n}`, 'dmg', 800);
          if (ev.kind === 'splash') fx.burst(p.x, p.y - 20, '#ffb340', { n: 12, speed: 5 });
          if (ev.kind !== 'melee') sfx.hit(ev.n >= 6);
        }
        await this.w(ev.kind === 'melee' ? 100 : 180);
        return;
      }
      case 'heal': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        T.s.hp = ev.hp;
        this.paint(T, true);
        if (quiet) return;
        const p = this.pos(ev.tgt);
        if (ev.src !== ev.tgt && this.live.has(ev.src)) {
          const a = this.pos(ev.src);
          fx.orb({ x: a.x, y: a.y - 30 }, { x: p.x, y: p.y - 30 }, '#7dffb0', 240 / this.speed);
          await this.w(240);
        }
        fx.float(p.x, p.y - 80, `+${ev.n}`, 'buff', 800);
        sfx.buff();
        await this.w(180);
        return;
      }
      case 'buff': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        const p = this.pos(ev.tgt);
        if (!quiet && ev.src !== ev.tgt && this.live.has(ev.src)) {
          const a = this.pos(ev.src);
          fx.orb({ x: a.x, y: a.y - 30 }, { x: p.x, y: p.y - 30 }, this.color(ev.src), 240 / this.speed);
          await this.w(240);
        }
        T.s.atk = ev.nowAtk;
        T.s.hp = ev.nowHp;
        T.s.maxHp = Math.max(T.s.maxHp, ev.nowHp);
        this.paint(T, true);
        if (quiet) return;
        const neg = ev.atk < 0 || ev.hp < 0;
        const sg = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
        fx.statPop(p.x, p.y - 80, `${sg(ev.atk)}/${sg(ev.hp)}`, ev.perm ? '永久' : '', neg ? 'pt-atk' : ev.atk >= ev.hp ? 'pt-atk' : 'pt-hp', 760);
        sfx.buff();
        await this.w(200);
        return;
      }
      case 'block': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        const p = this.pos(ev.tgt);
        if (!quiet && ev.src !== ev.tgt && this.live.has(ev.src)) {
          const a = this.pos(ev.src);
          fx.orb({ x: a.x, y: a.y - 30 }, { x: p.x, y: p.y - 30 }, '#ffe08a', 240 / this.speed);
          await this.w(240);
        }
        T.s.block = ev.block;
        this.paint(T, true);
        if (quiet) return;
        fx.statPop(p.x, p.y - 80, `+${ev.n}`, '格挡', 'pt-block', 760);
        sfx.shield();
        await this.w(180);
        return;
      }
      case 'kw': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        T.s.kws = [...new Set([...T.s.kws, ...ev.kws])];
        this.paint(T, true);
        if (quiet) return;
        const p = this.pos(ev.tgt);
        const names: Record<string, string> = { rotate: '轮换', reborn: '复生', splash: '溅射', block: '格挡' };
        fx.float(p.x, p.y - 80, ev.kws.map((k) => names[k] ?? k).join(' '), 'grant', 800);
        sfx.buff();
        await this.w(180);
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
        sfx.death();
        this.dying.push(L.v.die());
        return;
      }
      case 'rotate': {
        const L = this.live.get(ev.uid);
        if (!L) return;
        const idx = ev.order[L.s.side].indexOf(ev.uid);
        this.pendingOrder = null;
        this.say(`${this.name(ev.uid)} 轮换到队尾`);
        if (quiet) { L.v.place(idx); await this.relayout(ev.order, ev.uid); return; }
        sfx.whoosh();
        const moves = this.relayout(ev.order, ev.uid);
        await Promise.all([L.v.moveTo(idx, 560 / this.speed, 150), moves]);
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
        sfx.summon();
        await this.w(380);
        return;
      }
      case 'fizzle': {
        if (quiet) return;
        const p = this.pos(ev.uid);
        fx.float(p.x, p.y - 90, ev.label, 'fizzle', 800);
        sfx.fizzle();
        await this.w(200);
        return;
      }
      case 'end':
        return;
    }
  }
}
