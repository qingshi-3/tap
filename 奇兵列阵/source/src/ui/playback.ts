import { FACTION_INFO, GENERAL_MAP, unitDef } from '../core/data';
import type { BattleEvent, BattleOutput, Snap, UnitState } from '../core/types';
import { sfx } from './audio';
import { Board, bodyPos, headPos, statsOf, UnitView } from './board';
import { h, toStage } from './dom';
import type { FX } from './fx';
import { hasGenFx, playGenFx, type GfxHost } from './genFx';

/** 主将特效配套音效 */
const GEN_SFX: Record<string, () => void> = {
  argeon: () => { sfx.shield(); sfx.buff(); },
  kaleos: () => sfx.hit(true),
  lilithe: () => sfx.summon(),
  vulkan: () => sfx.hit(true),
  faie: () => sfx.freeze(),
  zirix: () => sfx.silence(),
  hank: () => sfx.beat(),
};

const KIND_COLOR: Record<string, string> = {
  start: '#ffd36b', cast: '#c9a4ff', afterAttack: '#ffb46a', afterCast: '#e1b7ff', hurt: '#ff8a5c', kill: '#ff5f6d',
  faint: '#c590ff', allyFaint: '#b77bff', beatEnd: '#ff4b6e', aura: '#a7d9db', general: '#ffe9a8',
};
const CIRCLED = ['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮'];
export const circled = (n: number) => CIRCLED[n] ?? `(${n})`;

export interface LogLine {
  text: string;
  cls: string;
}

export class Playback {
  /** Changes apply to the next wait/instantaneous animation; idle CSS is never retimed. */
  speed = 1;
  private skipping = false;
  private done = false;
  private isCancelled = false;
  private animations = new Set<Animation>();
  private temporaryNodes = new Set<HTMLElement>();
  private cancelWaiters = new Set<() => void>();
  private paused = false;
  private stateWaiters = new Set<() => void>();
  private pausedAnimations = new Set<Animation>();

  setPaused(paused: boolean): void {
    if (this.cancelled || this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      for (const animation of this.animations) {
        if (animation.playState === 'running' || animation.pending) {
          animation.pause();
          this.pausedAnimations.add(animation);
        }
      }
    } else {
      for (const animation of this.pausedAnimations) animation.play();
      this.pausedAnimations.clear();
    }
    this.wakeStateWaiters();
  }

  private wakeStateWaiters() {
    for (const wake of this.stateWaiters) wake();
    this.stateWaiters.clear();
  }

  /** Public lifecycle gate for game start/result delays; cancellation always releases it. */
  async waitUntilResumed(): Promise<void> {
    while (this.paused && !this.cancelled) {
      await new Promise<void>((resolve) => this.stateWaiters.add(resolve));
    }
  }

  get cancelled() { return this.isCancelled; }

  cancel(): void {
    if (this.isCancelled) return;
    this.isCancelled = true;
    this.wakeStateWaiters();
    for (const wake of this.cancelWaiters) wake();
    this.cancelWaiters.clear();
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
    this.pausedAnimations.clear();
    for (const node of this.temporaryNodes) node.remove();
    this.temporaryNodes.clear();
  }

  private track(animation: Animation): Animation {
    this.animations.add(animation);
    // Attach both handlers before cancellation; rejected finished promises must be consumed.
    const release = () => { this.animations.delete(animation); this.pausedAnimations.delete(animation); };
    void animation.finished.then(release, release);
    if (this.paused && !this.cancelled) {
      animation.pause();
      this.pausedAnimations.add(animation);
    }
    if (this.cancelled) animation.cancel();
    return animation;
  }

  private animate(el: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
    return this.track(el.animate(frames, options));
  }

  /** UnitView owns its animations; capture only newly created script animations, never idle CSS. */
  private unitAction<T>(el: HTMLElement, action: () => T, scale = true): T {
    const before = new Set(el.getAnimations({ subtree: true }));
    const result = action();
    for (const animation of el.getAnimations({ subtree: true })) {
      if (before.has(animation) || 'animationName' in animation || 'transitionProperty' in animation) continue;
      if (scale) animation.playbackRate = this.speed;
      this.track(animation);
    }
    return result;
  }

  private addTemporary(el: HTMLElement) {
    this.temporaryNodes.add(el);
    this.fx.layer.appendChild(el);
  }
  private removeTemporary(el: HTMLElement) {
    el.remove();
    this.temporaryNodes.delete(el);
  }

  private async untilCancelled<T>(task: Promise<T>): Promise<T | undefined> {
    if (this.cancelled) return undefined;
    let wake!: () => void;
    const signal = new Promise<undefined>((resolve) => { wake = () => resolve(undefined); });
    this.cancelWaiters.add(wake);
    try { return await Promise.race([task, signal]); }
    finally { this.cancelWaiters.delete(wake); }
  }
  onLog: (l: LogLine) => void = () => undefined;
  onBeat: (n: number) => void = () => undefined;
  onPhase: (p: 'start' | 'battle') => void = () => undefined;
  /** 某拍出手前暂停（教学讲解用）；参数为双方本拍首个出手者的单位节点 */
  onHold: ((n: number, actors: HTMLElement[]) => Promise<void> | null) | null = null;

  /** 主将头像节点（HUD 上），主将技能从这里发出弹道 */
  genEl: (() => HTMLElement | null) | null = null;

  constructor(
    private board: Board,
    private fx: FX,
    private out: BattleOutput,
  ) {}

  skip() {
    this.skipping = true;
  }

  private key(uid: number) {
    return `u${uid}`;
  }
  private v(uid: number) {
    return this.board.view(this.key(uid));
  }
  private st(snap: Snap, uid: number) {
    return snap[uid - 1];
  }
  private name(u: UnitState) {
    return `${u.side === 1 ? '敌·' : ''}${unitDef(u.defId).name}`;
  }
  private async w(ms: number) {
    let remaining = ms / this.speed;
    while (remaining > 0 && !this.skipping && !this.cancelled) {
      await this.waitUntilResumed();
      if (this.cancelled || this.skipping) return;
      const started = Date.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let stateChanged!: () => void;
      const changed = new Promise<void>((resolve) => { stateChanged = resolve; this.stateWaiters.add(resolve); });
      try {
        await this.untilCancelled(Promise.race([
          new Promise<void>((resolve) => { timer = setTimeout(resolve, Math.ceil(remaining)); }), changed,
        ]));
      } finally {
        clearTimeout(timer);
        this.stateWaiters.delete(stateChanged);
      }
      remaining -= Math.max(0, Date.now() - started);
    }
  }

  build(snap: Snap) {
    if (this.cancelled) return;
    this.board.clearUnits();
    for (const u of snap) {
      if (!u.alive) continue;
      const v = new UnitView(u.defId, u.side, u.slot, u.level);
      v.setStats(statsOf(u));
      this.board.add(this.key(u.uid), v);
    }
  }

  private sync(snap: Snap) {
    for (const u of snap) {
      if (!u.alive) continue;
      const v = this.v(u.uid);
      if (v) this.unitAction(v.el, () => v.setStats(statsOf(u), { pop: true }));
    }
  }

  async play() {
    try {
      if (this.paused) await this.waitUntilResumed();
      if (this.cancelled) return;
      this.build(this.out.initial);
      for (const { ev, snap } of this.out.log) {
        if (this.cancelled || this.skipping) break;
        await this.step(ev, snap);
        await this.waitUntilResumed();
        if (this.cancelled) return;
      }
      if (this.skipping && !this.cancelled) {
        const last = this.out.log.at(-1)?.snap ?? this.out.initial;
        this.build(last);
        this.board.clearArrows();
        this.board.setCenter(String(this.out.beats), '拍', 'beat');
      }
      if (!this.cancelled) this.board.setOrder(null);
    } finally {
      this.done = true;
    }
  }

  get finished() {
    return this.done;
  }

  /** 给主将特效模块用的播放接口：节点挂在特效层，按倍速播放，跳过/取消时立即收尾 */
  private gfxHost(): GfxHost {
    return {
      fx: this.fx,
      lite: this.speed >= 2,
      wait: (ms) => this.w(ms),
      play: async (el, frames, ms, o = {}) => {
        if (this.skipping || this.cancelled) return;
        if (o.back) { el.classList.add('gfx-back'); this.temporaryNodes.add(el); this.fx.root.appendChild(el); }
        else this.addTemporary(el);
        const a = this.animate(el, frames, { duration: ms / this.speed, delay: (o.delay ?? 0) / this.speed, easing: o.easing ?? 'linear', fill: 'both' });
        await this.untilCancelled(a.finished.catch(() => undefined));
        this.removeTemporary(el);
      },
    };
  }

  private projectile(from: { x: number; y: number }, to: { x: number; y: number }, color: string, dur = 340, size = 14) {
    if (this.skipping || this.cancelled) return Promise.resolve();
    const orb = h('div', { class: 'orb', style: `--c:${color};width:${size}px;height:${size}px` });
    this.addTemporary(orb);
    const mx = (from.x + to.x) / 2;
    const my = Math.min(from.y, to.y) - 40 - Math.abs(to.x - from.x) * 0.25;
    const frames: Keyframe[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * mx + t * t * to.x;
      const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * my + t * t * to.y;
      frames.push({ transform: `translate(${x}px,${y}px) translate(-50%,-50%) scale(${0.6 + Math.sin(t * Math.PI) * 0.6})` });
    }
    const a = this.animate(orb, frames, { duration: dur / this.speed, easing: 'cubic-bezier(.4,0,.6,1)' });
    return this.untilCancelled(a.finished.catch(() => undefined))
      .then(async () => {
        await this.waitUntilResumed();
        this.removeTemporary(orb);
        if (this.cancelled) return;
        this.fx.burst(to.x, to.y, color, { n: 10, speed: 3.5, kind: 'mote', size: 2.5, life: 26, gravity: 0 });
      });
  }

  private callout(uid: number, snap: Snap, text: string, color: string) {
    const u = this.st(snap, uid);
    const p = headPos(u.side, u.slot);
    const el = h('div', { class: 'callout', style: `left:${p.x}px;top:${p.y - 34}px;--c:${color}` }, text);
    this.addTemporary(el);
    this.animate(el,
      [
        { transform: 'translate(-50%,0) scale(.5)', opacity: 0 },
        { transform: 'translate(-50%,-6px) scale(1.08)', opacity: 1, offset: 0.15 },
        { transform: 'translate(-50%,-8px) scale(1)', opacity: 1, offset: 0.75 },
        { transform: 'translate(-50%,-18px) scale(.95)', opacity: 0 },
      ],
      { duration: 1100 / this.speed, easing: 'ease-out' },
    ).onfinish = () => this.removeTemporary(el);
  }

  banner(text: string, sub = '', cls = '') {
    if (this.cancelled) return;
    const el = h('div', { class: `phase-banner ${cls}` }, h('div', { class: 'pb-line' }), h('div', { class: 'pb-text' }, text), sub ? h('div', { class: 'pb-sub' }, sub) : null);
    this.addTemporary(el);
    this.animate(el,
      [
        { opacity: 0, transform: 'translate(-50%,-50%) scaleX(.2)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scaleX(1.04)', offset: 0.18 },
        { opacity: 1, transform: 'translate(-50%,-50%) scaleX(1)', offset: 0.75 },
        { opacity: 0, transform: 'translate(-50%,-50%) scaleX(1.1)' },
      ],
      { duration: 1200 / this.speed, easing: 'ease-out' },
    ).onfinish = () => this.removeTemporary(el);
  }

  private async step(ev: BattleEvent, snap: Snap) {
    if (this.cancelled) return;
    const fx = this.fx;
    switch (ev.t) {
      case 'phase': {
        this.onPhase(ev.name);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        if (ev.name === 'start') {
          sfx.start();
          this.banner('开战阶段', '将军 → 双方「开战时」效果');
          await this.w(900);
          await this.waitUntilResumed();
          if (this.cancelled) return;
        } else {
          sfx.whoosh();
          this.banner('交锋', '双方从队首往后轮流出手：先施法，后普攻', 'fight');
          await this.w(900);
          await this.waitUntilResumed();
          if (this.cancelled) return;
        }
        return;
      }
      case 'beat': {
        this.onBeat(ev.n);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        this.board.setCenter(String(ev.n), '拍', 'beat');
        this.board.setOrder({ player: ev.next.player.map((u) => this.key(u)), enemy: ev.next.enemy.map((u) => this.key(u)) });
        if (this.onHold && !this.skipping) {
          const actors = [ev.next.player[0], ev.next.enemy[0]].map((u) => (u ? this.v(u)?.el : null)).filter((e): e is HTMLElement => !!e);
          const hold = this.onHold(ev.n, actors);
          if (hold) { await this.untilCancelled(hold); if (this.cancelled) return; }
        }
        this.animate(this.board.center, [{ transform: 'translate(-50%,-50%) scale(1.25)' }, { transform: 'translate(-50%,-50%) scale(1)' }], {
          duration: 260 / this.speed,
          easing: 'ease-out',
        });
        sfx.beat();
        await this.w(160);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'trigger': {
        const u = this.st(snap, ev.src);
        const c = KIND_COLOR[ev.kind] ?? '#fff';
        const v = this.v(ev.src);
        sfx.trigger();
        if (ev.general) {
          const g = GENERAL_MAP[ev.general];
          const color = FACTION_INFO[g.faction].color;
          this.generalCallout(g.name, g.text, color);
          this.genPulse(color);
          this.onLog({ text: `${ev.order ? circled(ev.order) : ''}将军 ${g.name}：${g.text}`, cls: 'general' });
          await this.w(700);
          await this.waitUntilResumed();
          if (this.cancelled) return;
          return;
        }
        v?.pulse(c);
        this.callout(ev.src, snap, `${ev.order ? circled(ev.order) + ' ' : ''}${ev.label}`, c);
        this.onLog({ text: `${ev.order ? circled(ev.order) : ''}${this.name(u)} · ${ev.label}`, cls: `k-${ev.kind}` });
        await this.w(380);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'buff': {
        const t = this.st(snap, ev.tgt);
        const tp = bodyPos(t.side, t.slot);
        if (ev.src && ev.src !== ev.tgt) {
          const s = this.st(snap, ev.src);
          sfx.whoosh();
          await this.projectile(headPos(s.side, s.slot), tp, '#7dffb0');
          await this.waitUntilResumed();
          if (this.cancelled) return;
        }
        sfx.buff();
        fx.float(tp.x, tp.y - 30, `+${ev.atk}/+${ev.hp}`, 'buff');
        fx.burst(tp.x, tp.y + 30, '#7dffb0', { n: 14, speed: 2.4, kind: 'mote', size: 2.2, up: 2.5, gravity: -0.04, life: 40 });
        this.sync(snap);
        await this.w(300);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'act': {
        const v = this.v(ev.uid);
        if (!v) return;
        if (ev.mode === 'cast') {
          v.pulse('#c9a4ff');
          this.unitAction(v.el, () => { v.setTag('施法', 'trg-cast'); });
          this.castFx(ev.uid, snap);
          await this.w(320);
          await this.waitUntilResumed();
          if (this.cancelled) return;
          v.setTag(null);
        } else if (ev.mode === 'extra') {
          v.pulse('#ffe58a');
          this.callout(ev.uid, snap, '立即出手', '#ffe58a');
          await this.w(240);
        }
        return;
      }
      case 'block': {
        const t = this.st(snap, ev.uid);
        const tp = bodyPos(t.side, t.slot);
        if (ev.src && ev.src !== ev.uid) {
          const s = this.st(snap, ev.src);
          await this.projectile(headPos(s.side, s.slot), tp, '#ffe08a');
          await this.waitUntilResumed();
          if (this.cancelled) return;
        }
        sfx.shield();
        fx.ring(tp.x, tp.y + 10, '#ffe08a', 70);
        fx.float(tp.x, tp.y - 30, `+${ev.n} 格挡`, 'shield');
        this.onLog({ text: `${this.name(t)} 获得 ${ev.n} 层格挡`, cls: 'shield' });
        this.sync(snap);
        await this.w(280);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'blockBroken': {
        this.sync(snap);
        return;
      }
      case 'chill':
      case 'burn': {
        const t = this.st(snap, ev.uid);
        const tp = bodyPos(t.side, t.slot);
        const chill = ev.t === 'chill';
        const color = chill ? '#8feaff' : '#ff9a3d';
        if (ev.src && ev.src !== ev.uid) {
          const s = this.st(snap, ev.src);
          await this.projectile(headPos(s.side, s.slot), tp, color, 320);
          await this.waitUntilResumed();
          if (this.cancelled) return;
        }
        if (chill) sfx.freeze(); else sfx.hit(false);
        fx.burst(tp.x, tp.y, chill ? '#bff4ff' : '#ffb46a', { n: 12, speed: 3, kind: chill ? 'shard' : 'mote', size: 2.4, gravity: chill ? 0.05 : -0.05 });
        fx.float(tp.x, tp.y - 38, `+${ev.n} ${chill ? '寒意' : '灼烧'}`, chill ? 'freeze' : 'dmg splash');
        this.sync(snap);
        this.onLog({ text: `${this.name(t)} 获得 ${ev.n} 层${chill ? '寒意' : '灼烧'}（共 ${ev.total}）`, cls: chill ? 'freeze' : 'dmg' });
        await this.w(240);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'vuln': {
        const t = this.st(snap, ev.uid);
        const tp = bodyPos(t.side, t.slot);
        if (ev.src && ev.src !== ev.uid) {
          const s = this.st(snap, ev.src);
          await this.projectile(headPos(s.side, s.slot), tp, '#ff7ad9', 300);
          await this.waitUntilResumed();
          if (this.cancelled) return;
        }
        sfx.hit(false);
        fx.float(tp.x, tp.y - 38, `+${ev.n} 易伤`, 'dmg splash');
        this.sync(snap);
        this.onLog({ text: `${this.name(t)} 获得 ${ev.n} 层易伤（共 ${ev.total}）`, cls: 'dmg' });
        await this.w(220);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'guard': {
        const a = this.st(snap, ev.from), g = this.st(snap, ev.to);
        const gp = bodyPos(g.side, g.slot);
        this.projectile(bodyPos(a.side, a.slot), gp, '#ffe08a', 200, 10);
        fx.float(gp.x, gp.y - 50, '护卫', 'absorb');
        this.onLog({ text: `${this.name(g)} 替 ${this.name(a)} 挡下攻击`, cls: 'shield' });
        await this.w(160);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'gen': {
        const g = GENERAL_MAP[ev.id];
        const color = FACTION_INFO[g.faction].color;
        sfx.trigger();
        this.generalCallout(g.name, ev.label, color);
        const from = this.genPulse(color);
        this.onLog({ text: `主将 ${g.name}：${ev.label}`, cls: 'general' });
        if (hasGenFx(ev.id) && ev.tgts.length) {
          // 主将专属像素演出：头像先射出一道光，再播放招牌特效（2 倍速及以上用精简版）
          const ts = ev.tgts.map((uid) => this.st(snap, uid));
          const pos = ts.map((t) => bodyPos(t.side, t.slot));
          if (from) { sfx.whoosh(); await this.projectile(from, pos[0], color, 300, 16); }
          const allies = snap.filter((u) => u.side === 0 && u.hp > 0).sort((a, b) => a.slot - b.slot).map((u) => bodyPos(0, u.slot));
          const units = ts.map((t) => {
            const v = this.v(t.uid);
            return {
              lunge: () => { if (v) this.unitAction(v.el, () => v.lunge(t.side === 0 ? 1 : -1, 14, 280)); },
              pulse: (c: string) => { if (v) this.unitAction(v.el, () => v.pulse(c)); },
            };
          });
          GEN_SFX[ev.id]?.();
          if (!this.skipping && !this.cancelled) await this.untilCancelled(playGenFx(ev.id, this.gfxHost(), { tgts: pos, units, allies, color }));
          await this.w(120);
          await this.waitUntilResumed();
          if (this.cancelled) return;
          return;
        }
        // 从主将头像向每个目标打出阵营色弹道，落点再爆一圈；没有头像节点时退回原地光环
        await Promise.all(ev.tgts.map((uid, i) => {
          const t = this.st(snap, uid), p = bodyPos(t.side, t.slot);
          const land = () => {
            if (this.cancelled) return;
            fx.ring(p.x, p.y + 40, color, 70);
            fx.burst(p.x, p.y, color, { n: 12, speed: 3, kind: 'spark', size: 3, life: 24, gravity: 0 });
          };
          if (!from) { land(); return Promise.resolve(); }
          return this.w(i * 60).then(() => this.projectile(from, p, color, 420, 18)).then(land);
        }));
        if (ev.tgts.length) fx.flash(color, 0.08, 200);
        await this.w(from ? 240 : 520);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'recall': {
        const u = this.st(snap, ev.uid);
        const old = this.v(ev.uid);
        if (old) old.el.remove();
        const v = new UnitView(u.defId, u.side, u.slot, u.level);
        v.setStats(statsOf(u));
        this.board.add(this.key(u.uid), v);
        this.unitAction(v.el, () => v.appear());
        const p = bodyPos(u.side, u.slot);
        sfx.summon();
        fx.ring(p.x, p.y + 40, '#b77bff', 80);
        fx.float(p.x, p.y - 44, '召回', 'exile', 1100);
        this.onLog({ text: `${this.name(u)} 被召回战场`, cls: 'summon' });
        await this.w(360);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'heal': {
        const t = this.st(snap, ev.tgt), p = bodyPos(t.side, t.slot);
        sfx.buff();
        fx.float(p.x, p.y - 32, `恢复 +${ev.n}`, 'buff');
        this.onLog({ text: `${this.name(t)} 恢复 ${ev.n}`, cls: 'buff' });
        this.sync(snap);
        await this.w(260); return;
      }
      case 'dmg': {
        const t = this.st(snap, ev.tgt);
        const tp = bodyPos(t.side, t.slot);
        const dir = t.side === 0 ? -1 : 1;
        if (ev.kind === 'ability' && ev.src) {
          const s = this.st(snap, ev.src);
          sfx.whoosh();
          await this.projectile(headPos(s.side, s.slot), tp, '#ff6a5a', 360, 16);
          await this.waitUntilResumed();
          if (this.cancelled) return;
        } else if (ev.kind === 'thorns' && ev.src) {
          const s = this.st(snap, ev.src);
          await this.projectile(bodyPos(s.side, s.slot), tp, '#c6ff6a', 220, 10);
          await this.waitUntilResumed();
          if (this.cancelled) return;
        }
        const hpLoss = ev.blocked ? 0 : ev.n;
        const big = ev.n >= 5;
        const hitView = this.v(ev.tgt);
        if (hitView) this.unitAction(hitView.el, () => hitView.hit(dir));
        if (ev.blocked) {
          sfx.shieldHit();
          fx.float(tp.x + 14, tp.y - 44, '格挡', 'absorb');
          fx.burst(tp.x, tp.y, '#ffe08a', { n: 10, speed: 4, size: 2 });
        }
        if (hpLoss > 0) {
          sfx.hit(big);
          fx.float(tp.x, tp.y - 20, `-${hpLoss}`, `dmg${big ? ' big' : ''}${ev.kind === 'splash' ? ' splash' : ''}`);
          fx.burst(tp.x, tp.y, ev.kind === 'splash' || ev.kind === 'burn' ? '#ffb46a' : '#ff6a5a', { n: big ? 24 : 14, speed: big ? 7 : 5, size: 2.6 });
          fx.shake(big ? 9 : ev.kind === 'attack' ? 5 : 3, big ? 320 : 220);
          if (big) fx.flash('#ff4b4b', 0.12);
        }
        this.sync(snap);
        const tag = { attack: '', ability: '能力', splash: '溅射', thorns: '反击', burn: '灼烧', fatigue: '疲劳' }[ev.kind];
        this.onLog({ text: ev.blocked ? `${this.name(t)} 格挡了一次${tag}伤害` : `${this.name(t)} 受到 ${ev.n} 点${tag}伤害`, cls: 'dmg' });
        // 命中停顿
        await this.w(ev.kind === 'attack' ? 120 : 220);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'attack': {
        const anims: Promise<unknown>[] = [];
        for (const p of ev.pairs) {
          const a = this.st(snap, p.atk);
          const t = this.st(snap, p.tgt);
          const v = this.v(p.atk);
          if (!v) continue;
          const dir = a.side === 0 ? 1 : -1;
          const dist = Math.min(80, Math.max(30, Math.abs(bodyPos(t.side, t.slot).x - bodyPos(a.side, a.slot).x) * 0.35));
          const an = await this.unitAction(v.el, () => v.lunge(dir, dist, 380 / this.speed), false);
          await this.waitUntilResumed();
          if (this.cancelled) return;
          anims.push(an.finished.catch(() => undefined));
          // 狙击：显示一道轨迹，让玩家看懂"它打的不是队首"
          if (t.slot !== 0) {
            this.projectile(headPos(a.side, a.slot), bodyPos(t.side, t.slot), '#ff5f6d', 200, 10);
          }
        }
        sfx.whoosh();
        await this.w(180);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'death': {
        const t = this.st(snap, ev.tgt);
        const tp = bodyPos(t.side, t.slot);
        const v = this.v(ev.tgt);
        const color = FACTION_INFO[unitDef(t.defId).faction].color;
        sfx.death();
        fx.burst(tp.x, tp.y, color, { n: 26, speed: 6, kind: 'shard', size: 4, up: 2, gravity: 0.25, life: 50 });
        fx.burst(tp.x, tp.y, '#ffffff', { n: 10, speed: 3, kind: 'mote', size: 3, gravity: -0.03, life: 30 });
        fx.ring(tp.x, tp.y + 40, color, 70);
        if (ev.exiled) fx.float(tp.x, tp.y - 50, '放逐', 'exile', 1200);
        this.onLog({ text: `${this.name(t)} 阵亡${ev.exiled ? '（放逐）' : ''}`, cls: 'death' });
        if (v) {
          this.board.views.delete(this.key(ev.tgt));
          void this.unitAction(v.el, () => v.die(ev.exiled));
        }
        await this.w(380);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'pull': {
        const u = this.st(snap, ev.uid);
        sfx.swap();
        this.onLog({ text: `虚空领主把 ${this.name(u)} 拉到了队首`, cls: 'swap' });
        if (ev.src) this.callout(ev.src, snap, '虚空牵引!', '#ff4b6e');
        const ps: Promise<void>[] = [];
        for (const s of snap) {
          if (!s.alive || s.side !== u.side) continue;
          const v = this.v(s.uid);
          if (v && v.slot !== s.slot) ps.push(this.unitAction(v.el, () => v.moveTo(s.slot, 520 / this.speed, s.uid === ev.uid ? 56 : -20), false));
        }
        if (!this.skipping) await this.untilCancelled(Promise.all(ps));
        await this.waitUntilResumed();
        if (this.cancelled) return;
        this.sync(snap);
        await this.w(120);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'revive': {
        const u = this.st(snap, ev.uid);
        const old = this.v(ev.uid);
        if (old) old.el.remove();
        const v = new UnitView(u.defId, u.side, u.slot, u.level);
        v.setStats(statsOf(u));
        this.board.add(this.key(u.uid), v);
        this.unitAction(v.el, () => v.appear());
        const p = bodyPos(u.side, u.slot);
        sfx.summon();
        fx.ring(p.x, p.y + 40, '#ffe9a8', 80);
        fx.float(p.x, p.y - 44, '复生', 'buff', 1100);
        this.onLog({ text: `${this.name(u)} 复生`, cls: 'summon' });
        await this.w(420);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'summon': {
        const u = this.st(snap, ev.uid);
        const v = new UnitView(u.defId, u.side, u.slot, u.level);
        v.setStats(statsOf(u));
        this.board.add(this.key(u.uid), v);
        this.unitAction(v.el, () => v.appear());
        const p = bodyPos(u.side, u.slot);
        sfx.summon();
        fx.ring(p.x, p.y + 40, '#d6a8ff', 80);
        fx.burst(p.x, p.y, '#d6a8ff', { n: 18, speed: 3, kind: 'mote', size: 3, gravity: -0.05 });
        this.onLog({ text: `召唤 ${unitDef(u.defId).name} ${u.atk}/${u.hp}`, cls: 'summon' });
        await this.w(420);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'frozenSkip': {
        const t = this.st(snap, ev.uid);
        const tp = bodyPos(t.side, t.slot);
        sfx.freeze();
        const frozenView = this.v(ev.uid);
        if (frozenView) this.animate(frozenView.body, 
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
          { duration: 200 / this.speed, iterations: 2 },
        );
        fx.float(tp.x, tp.y - 40, '冻结 · 跳过出手', 'freeze');
        fx.burst(tp.x, tp.y, '#bff4ff', { n: 12, speed: 3, kind: 'shard', size: 2 });
        this.sync(snap);
        this.onLog({ text: `${this.name(t)} 寒意 ≥ 攻击，被冻结，跳过出手`, cls: 'freeze' });
        await this.w(260);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'fizzle': {
        const u = this.st(snap, ev.src);
        const p = headPos(u.side, u.slot);
        sfx.fizzle();
        fx.float(p.x, p.y - 10, `落空 · ${ev.reason}`, 'fizzle', 1300);
        this.onLog({ text: `${this.name(u)} 落空：${ev.reason}`, cls: 'fizzle' });
        await this.w(420);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'end':
        return;
    }
  }

  /** 单位施法：脚下展开像素法阵（只动 transform/opacity），身上冒起奥术微光 */
  private castFx(uid: number, snap: Snap) {
    if (this.skipping || this.cancelled) return;
    const u = this.st(snap, uid), p = bodyPos(u.side, u.slot);
    const el = h('div', { class: 'cast-rune', style: `left:${p.x}px;top:${p.y + 46}px` });
    this.addTemporary(el);
    this.animate(el,
      [
        { opacity: 0, transform: 'translate(-50%,-50%) scaleY(.42) rotate(0deg) scale(.3)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scaleY(.42) rotate(40deg) scale(1.05)', offset: 0.25 },
        { opacity: 1, transform: 'translate(-50%,-50%) scaleY(.42) rotate(110deg) scale(1)', offset: 0.7 },
        { opacity: 0, transform: 'translate(-50%,-50%) scaleY(.42) rotate(150deg) scale(1.2)' },
      ],
      { duration: 620 / this.speed, easing: 'ease-out' },
    ).onfinish = () => this.removeTemporary(el);
    this.fx.burst(p.x, p.y + 40, '#c9a4ff', { n: 14, speed: 1.6, kind: 'mote', size: 2.4, up: 2.6, gravity: -0.05, life: 36 });
  }

  /** 主将头像亮一下，返回它在舞台坐标里的中心（弹道起点） */
  private genPulse(color: string) {
    const el = this.genEl?.();
    if (!el || !el.isConnected || this.skipping || this.cancelled) return null;
    const b = el.getBoundingClientRect();
    const c = toStage(b.left + b.width / 2, b.top + b.height / 2);
    const glow = h('div', { class: 'gen-burst', style: `left:${c.x}px;top:${c.y}px;--c:${color}` });
    this.addTemporary(glow);
    this.animate(glow,
      [
        { opacity: 0.9, transform: 'translate(-50%,-50%) scale(.5)' },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(1.8)' },
      ],
      { duration: 520 / this.speed, easing: 'ease-out' },
    ).onfinish = () => this.removeTemporary(glow);
    this.fx.burst(c.x, c.y, color, { n: 16, speed: 3.2, kind: 'mote', size: 2.6, life: 28, gravity: 0 });
    return c;
  }

  private generalCallout(name: string, text: string, color: string) {
    const el = h('div', { class: 'gen-callout', style: `--c:${color}` }, h('b', null, `将军 · ${name}`), h('span', null, text));
    this.addTemporary(el);
    this.animate(el,
      [
        { opacity: 0, transform: 'translate(-50%,10px) scale(.8)' },
        { opacity: 1, transform: 'translate(-50%,0) scale(1)', offset: 0.15 },
        { opacity: 1, transform: 'translate(-50%,0) scale(1)', offset: 0.8 },
        { opacity: 0, transform: 'translate(-50%,-10px) scale(1)' },
      ],
      { duration: 1400 / this.speed },
    ).onfinish = () => this.removeTemporary(el);
  }
}

