import { FACTION_INFO, GENERAL_MAP, unitDef } from '../core/data';
import { SLOTS } from '../core/engine';
import type { BattleEvent, BattleOutput, Side, Snap, UnitState } from '../core/types';
import { sfx as liveSfx } from './audio';
import { Board, bodyPos, headPos, slotX, statsOf, UNIT_Y, UnitView } from './board';
import { h, toStage } from './dom';
import type { FX } from './fx';
import { hasGenFx, playGenFx, type GfxHost } from './genFx';
import { MECH } from './kwtext';
import '../unit-fx.css';

/** 主将特效配套音效 */
const GEN_SFX: Record<string, (sfx: typeof liveSfx) => void> = {
  argeon: (sfx) => { sfx.shield(); sfx.buff(); },
  kaleos: (sfx) => { sfx.whoosh(); sfx.buff(); },
  lilithe: (sfx) => sfx.summon(),
  vulkan: (sfx) => sfx.hit(true),
  faie: (sfx) => sfx.freeze(),
  zirix: (sfx) => sfx.silence(),
  hank: (sfx) => sfx.beat(),
};

const KIND_COLOR: Record<string, string> = {
  start: '#ffd36b', cast: '#c9a4ff', afterAttack: '#ffb46a', afterCast: '#e1b7ff', hurt: '#ff8a5c', kill: '#ff5f6d',
  faint: '#c590ff', allyFaint: '#b77bff', beatEnd: '#ff4b6e', aura: '#a7d9db', general: '#ffe9a8',
  attacked: '#ff9a6a', duelKill: '#ff8f5a', rattle: '#c590ff', front: '#9fe8ff', rear: '#9fe8ff', summon: '#e9bd72',
  freeze: '#8feaff', charge: '#ffcf4a', pulse: '#ff9ad0', roundStart: '#fff2c0', revive: '#ffd36b', boss: '#ff4b6e',
  equip: '#cfd6e6', spell: '#c9a4ff',
};
/** 授予的词条 → 词条名（图标 / 短词二选一，见 kwtext MECH） */
const GRANT_NAME: Record<string, string> = {
  snipe: '狙击', combo: '连击', reborn: '复生', taunt: '嘲讽', rotate: '轮换', duel: '决斗', splash: '溅射', armor: '护甲', power: '法强', thorns: '反击',
};
/** 能力弹道的元素形状：默认按阵营取 */
export type Elem = 'blade' | 'soul' | 'fire' | 'ice';
const FACTION_ELEM: Record<string, Elem> = {
  light: 'blade', shadow: 'blade', abyss: 'soul', magma: 'fire', frost: 'ice', desert: 'blade', neutral: 'blade', enemy: 'soul',
};
const DEBUFF_C = '#c4365a';
const CIRCLED = ['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮'];
const SILENT_SFX = new Proxy(liveSfx, { get: () => () => undefined }) as typeof liveSfx;

export const circled = (n: number) => CIRCLED[n] ?? `(${n})`;

export interface LogLine {
  text: string;
  cls: string;
}

export class Playback {
  /** Changes apply to the next wait/instantaneous animation; idle CSS is never retimed. */
  private _speed = 1;
  /** 图鉴演示循环播放：不出声 */
  silent = false;
  /** 图鉴演示：不放开战/交锋横幅 */
  banners = true;
  private get sfx() { return this.silent ? SILENT_SFX : liveSfx; }
  get speed() { return this._speed; }
  set speed(v: number) { this._speed = v; this.fx.rate = v; }
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
  onBeat: (n: number, round: number) => void = () => undefined;
  /** 当前回合与本回合已进行的交锋数（中线大字 + 圆点） */
  private round = 0;
  private roundBeats = 0;
  private clashTotal = 0;
  onPhase: (p: 'start' | 'battle') => void = () => undefined;
  /** 某次交锋出手前暂停（教学讲解用）；参数为双方本次交锋首个出手者的单位节点 */
  onHold: ((n: number, actors: HTMLElement[]) => Promise<void> | null) | null = null;

  /** 每条事件播放前 / 后的钩子（图鉴演示用来暂停并框选）；返回 Promise 时等它结束 */
  beforeStep: ((ev: BattleEvent, snap: Snap) => Promise<void> | void) | null = null;
  afterStep: ((ev: BattleEvent, snap: Snap) => Promise<void> | void) | null = null;

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
  /** Bind an inspection opened during the preparation-to-playback transition. */
  initialViewKey(side: number, slot: number): string | undefined {
    const unit = this.out.initial.find(u => u.side === side && u.slot === slot);
    return unit ? this.key(unit.uid) : undefined;
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
      if (!u.alive || u.reserve) continue;
      const v = new UnitView(u.defId, u.side, u.slot, u.level);
      v.setStats(statsOf(u));
      this.board.add(this.key(u.uid), v);
    }
  }

  private sync(snap: Snap) {
    const mat = [0, 1].map(s => snap.some(u => u.alive && !u.reserve && u.side === s && unitDef(u.defId).special === 'matriarch'));
    for (const u of snap) {
      if (!u.alive || u.reserve) continue;
      const v = this.v(u.uid);
      if (v) this.unitAction(v.el, () => {
        v.setStats(statsOf(u), { pop: true });
        v.setMatriarch(mat[u.side] && !!unitDef(u.defId).onRattle);
      });
    }
  }

  async play() {
    try {
      if (this.paused) await this.waitUntilResumed();
      if (this.cancelled) return;
      this.build(this.out.initial);
      const log = this.out.log;
      for (let i = 0; i < log.length; i++) {
        if (this.cancelled || this.skipping) break;
        const { ev, snap } = log[i];
        // 主将 / 光环一次给多名友军同样的加成（轨迹、纯色等）：合并成一拍同时飘字，不逐个排队刷屏
        const group = Playback.groupBuff(log, i);
        if (group > 1) {
          await this.buffGroup(log.slice(i, i + group));
          i += group - 1;
        } else {
          await this.beforeStep?.(ev, snap);
          await this.step(ev, snap);
          await this.afterStep?.(ev, snap);
        }
        await this.waitUntilResumed();
        if (this.cancelled) return;
      }
      if (this.skipping && !this.cancelled) {
        const last = this.out.log.at(-1)?.snap ?? this.out.initial;
        this.build(last);
        this.board.clearArrows();
        const lastBeat = [...this.out.log].reverse().find(l => l.ev.t === 'beat')?.ev;
        this.board.setCenter(String(lastBeat?.t === 'beat' ? lastBeat.round ?? 1 : 1), '回合', 'beat');
      }
      if (!this.cancelled) this.board.setOrder(null);
    } finally {
      this.done = true;
    }
  }

  /** 从 i 起连续多少条「无来源、数值相同」的加成可以合并播放 */
  static groupBuff(log: BattleOutput['log'], i: number): number {
    const a = log[i].ev;
    if (a.t !== 'buff' || a.src || (!a.atk && !a.hp)) return 1;
    let n = 1;
    for (; i + n < log.length; n++) {
      const b = log[i + n].ev;
      if (b.t !== 'buff' || b.src || b.atk !== a.atk || b.hp !== a.hp || b.tgt === a.tgt) break;
    }
    return n;
  }

  private async buffGroup(items: BattleOutput['log']) {
    this.sfx.buff();
    for (const { ev, snap } of items) {
      if (ev.t !== 'buff') continue;
      if (ev.atk < 0 || ev.hp < 0) { void this.debuffFx(undefined, ev.tgt, snap, Playback.debuffText(ev.atk, ev.hp)); continue; }
      const t = this.st(snap, ev.tgt), tp = bodyPos(t.side, t.slot);
      this.fx.float(tp.x, tp.y - 30, `+${ev.atk}/+${ev.hp}`, 'buff');
      this.fx.burst(tp.x, tp.y + 30, '#7dffb0', { n: 10, speed: 2.4, kind: 'mote', size: 2.2, up: 2.5, gravity: -0.04, life: 40 });
    }
    this.sync(items[items.length - 1].snap);
    await this.w(320);
    await this.waitUntilResumed();
  }

  get finished() {
    return this.done;
  }

  static debuffText(atk: number, hp: number) {
    return [atk < 0 ? `攻 ${atk}` : '', hp < 0 ? `血 ${hp}` : ''].filter(Boolean).join(' ');
  }
  /** 最近一次召唤出的单位：紧随其后的有源加成标成「来源 · 召唤加成」 */
  private lastSummon = 0;
  /** 专属特效上下文：最近一次触发 / 施法 / 蓄力的单位；随后的事件据此换成该卡的专属表现 */
  private sig: { id: string; uid: number; n: number; prev?: { x: number; y: number } } | null = null;
  private sigIs(...ids: string[]) { return this.sig && ids.includes(this.sig.id) ? this.sig : null; }
  private sideX(side: Side) { return [0, SLOTS - 1].map(i => slotX(side, i)) as [number, number]; }

  /** 专属开场：在触发标签亮起的同时播放（只用一次性特效） */
  private sigOpen(u: UnitState) {
    if (this.skipping) return;
    const fx = this.fx, p = bodyPos(u.side, u.slot), foe = (1 - u.side) as Side;
    const f1 = this.sideX(foe)[1], [a0, a1] = this.sideX(u.side);
    switch (u.defId) {
      case 'l_archon': // 头顶降下金光，依次扫过友军
        fx.pillar(p.x, p.y + 52, '#ffe9a8', 360, 640);
        fx.sweep(a0, a1, p.y, '#ffd36b', 620, 180);
        break;
      case 'a_chanter': // 蓄势：脚下法阵扩大
        fx.wave(p.x, p.y + 52, '#a35cff', 260, 520);
        fx.wave(p.x, p.y + 52, '#d6a8ff', 160, 380);
        break;
      case 'm_titan': // 双拳砸地
        fx.wave(p.x, p.y + 52, '#ff9a3d', 240, 420);
        fx.burst(p.x, p.y + 50, '#ffb46a', { n: 16, speed: 5, kind: 'shard', size: 3, up: 3, gravity: 0.3 });
        fx.shake(8, 260);
        break;
      case 'v_stag': // 雪风同时扫过两侧
        fx.sweep(p.x, f1, p.y, '#bff4ff', 560, 200);
        fx.sweep(p.x, a1, p.y, '#8feaff', 560, 200);
        fx.burst(p.x, p.y - 50, '#ffffff', { n: 14, speed: 3, kind: 'shard', size: 2.4, gravity: 0.04 });
        break;
      case 'd_sandblade': // 背后日轮转起来
        fx.spin(p.x, p.y - 10, '#ffd36b');
        fx.ring(p.x, p.y, '#ffd36b', 90);
        break;
      case 'm_rex': // 身体发红
        fx.rise(p.x, p.y + 40, '#ff6a2a', 10, 60);
        break;
      case 'm_bloodcaller':
        fx.burst(p.x, p.y, '#c4365a', { n: 14, speed: 3, kind: 'mote', size: 3, gravity: -0.05 });
        break;
      case 'v_queen':
        fx.burst(p.x, p.y - 40, '#bff4ff', { n: 12, speed: 2.5, kind: 'shard', size: 2.6, gravity: 0.03 });
        break;
      case 's_panda': // 落地震地波纹，从熊猫向两侧推开
        fx.wave(p.x, p.y + 52, '#ff5f6d', 520, 600);
        fx.shake(7, 260, true);
        break;
    }
  }

  /** 每个单位已触发的亡语次数（识别第二次） */
  private rattleSeen = new Map<number, number>();

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

  private projectile(from: { x: number; y: number }, to: { x: number; y: number }, color: string, dur = 340, size = 14, el?: Elem) {
    if (this.skipping || this.cancelled) return Promise.resolve();
    const w = el === 'ice' ? size * 2.4 : el === 'blade' ? size * 1.6 : el ? size * 1.3 : size;
    const hgt = el === 'ice' ? size * 0.9 : el === 'blade' ? size * 1.6 : el ? size * 1.3 : size;
    const orb = h('div', { class: `orb${el ? ` el-${el}` : ''}`, style: `--c:${color};width:${w}px;height:${hgt}px` });
    this.addTemporary(orb);
    const mx = (from.x + to.x) / 2;
    const my = Math.min(from.y, to.y) - 40 - Math.abs(to.x - from.x) * 0.25;
    const frames: Keyframe[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * mx + t * t * to.x;
      const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * my + t * t * to.y;
      // 元素弹道沿切线朝向；短刃自转
      const ang = Math.atan2(2 * (1 - t) * (my - from.y) + 2 * t * (to.y - my), 2 * (1 - t) * (mx - from.x) + 2 * t * (to.x - mx));
      const rot = el === 'blade' ? `rotate(${Math.round(t * 900)}deg)` : el ? `rotate(${ang.toFixed(3)}rad)` : '';
      const sc = el ? 0.85 + Math.sin(t * Math.PI) * 0.3 : 0.6 + Math.sin(t * Math.PI) * 0.6;
      frames.push({ transform: `translate(${x}px,${y}px) translate(-50%,-50%) ${rot} scale(${sc})` });
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

  private callout(uid: number, snap: Snap, text: string, color: string, encounter = false, who?: string, sideWide = false) {
    const u = this.st(snap, uid);
    // 醒目提示也贴着来源：单位头顶；作用于整队的关卡规则放在该方阵列上方
    const head = headPos(u.side, u.slot);
    const p = !encounter ? head : sideWide ? { x: (this.sideX(u.side)[0] + this.sideX(u.side)[1]) / 2, y: head.y - 40 } : { x: head.x, y: head.y - 30 };
    const el = h('div', { class: `callout${encounter ? ' encounter-callout' : ''}`, style: `left:${p.x}px;top:${p.y - 34}px;--c:${color}` },
      who ? h('span', { class: 'co-name' }, who) : null, who ? h('span', { class: 'co-sep' }, '·') : null, text);
    this.addTemporary(el);
    const reduce = encounter && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.animate(el,
      reduce ? [
        { transform: 'translate(-50%,0)', opacity: 0 },
        { transform: 'translate(-50%,0)', opacity: 1, offset: 0.15 },
        { transform: 'translate(-50%,0)', opacity: 1, offset: 0.75 },
        { transform: 'translate(-50%,0)', opacity: 0 },
      ] : [
        { transform: 'translate(-50%,0) scale(.5)', opacity: 0 },
        { transform: 'translate(-50%,-6px) scale(1.08)', opacity: 1, offset: 0.15 },
        { transform: 'translate(-50%,-8px) scale(1)', opacity: 1, offset: 0.75 },
        { transform: 'translate(-50%,-18px) scale(.95)', opacity: 0 },
      ],
      { duration: 1100 / this.speed, easing: 'ease-out' },
    ).onfinish = () => this.removeTemporary(el);
  }

  private fac(u: UnitState) { return unitDef(u.defId).faction; }
  private facColor(u: UnitState) { return FACTION_INFO[this.fac(u)].color; }
  private elemOf(u: UnitState): Elem { return FACTION_ELEM[this.fac(u)] ?? 'blade'; }

  /** 削弱：阵营色细线连到目标 → 下坠箭头 + 「攻 -N」 */
  private async debuffFx(src: number | undefined, tgt: number, snap: Snap, text: string) {
    const t = this.st(snap, tgt), tp = bodyPos(t.side, t.slot);
    if (src && src !== tgt) {
      const s = this.st(snap, src);
      this.fx.link(headPos(s.side, s.slot), tp, this.facColor(s), 320);
      await this.w(140);
      if (this.cancelled) return;
    }
    this.sfx.fizzle();
    this.fx.debuff(tp.x, tp.y - 6, DEBUFF_C);
    this.fx.burst(tp.x, tp.y - 20, '#8a1f3c', { n: 12, speed: 2.2, kind: 'shard', size: 3, gravity: 0.3, life: 30 });
    this.fx.float(tp.x, tp.y - 34, text, 'debuff', 900);
  }

  /** 授予词条：源头连线，图标 / 短词飞到目标头顶停一下，再缩进词条栏 */
  private async grantFx(src: number | undefined, tgt: number, snap: Snap, kw: string, v?: number) {
    const t = this.st(snap, tgt), tp = bodyPos(t.side, t.slot), hp = headPos(t.side, t.slot);
    const name = GRANT_NAME[kw] ?? kw, m = MECH[name];
    const color = m?.color ?? '#ffe9a8';
    if (v !== undefined && v < 0) {
      await this.debuffFx(src, tgt, snap, `${name.slice(0, 1)} ${v}`);
      return;
    }
    const s = src && src !== tgt ? this.st(snap, src) : null;
    const from = s ? headPos(s.side, s.slot) : { x: hp.x, y: hp.y - 120 };
    if (s) this.fx.link(from, hp, this.facColor(s), 360);
    const node = m?.px ? h('span', { class: `kpx px-${m.px}` }) : h('span', { class: 'tk-word', style: `--c:${color}` }, `「${name}」`);
    if (!this.skipping) this.fx.token(from, hp, node, 680);
    this.sfx.buff();
    await this.w(380);
    if (this.cancelled) return;
    this.fx.burst(tp.x, tp.y - 10, color, { n: 12, speed: 2.4, kind: 'mote', size: 2.4, up: 1.5, gravity: -0.03, life: 32 });
    if (m?.px && v) this.fx.float(tp.x, tp.y - 34, `+${v}`, 'grant', 900, m.px);
    const view = this.v(tgt);
    if (view) this.unitAction(view.el, () => view.pulse(color));
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
        if (!this.banners) return;
        if (ev.name === 'start') {
          this.sfx.start();
          this.banner('开战阶段', '将军 → 双方「开战时」效果');
          await this.w(900);
          await this.waitUntilResumed();
          if (this.cancelled) return;
        } else {
          this.sfx.whoosh();
          this.banner('交锋', '每回合每人行动一次；多的次数下一轮用', 'fight');
          await this.w(900);
          await this.waitUntilResumed();
          if (this.cancelled) return;
        }
        return;
      }
      case 'beat': {
        this.onBeat(ev.n, ev.round ?? 1);
        this.lastSummon = 0;
        this.sig = null;
        await this.waitUntilResumed();
        if (this.cancelled) return;
        this.sync(snap);
        if (ev.round !== this.round) { this.round = ev.round ?? 1; this.roundBeats = 0; }
        this.roundBeats++;
        this.board.setCenter(String(this.round), '回合', 'beat');
        this.clashTotal = this.roundBeats - 1 + (ev.left ?? 1);
        this.board.setClash(this.roundBeats, this.clashTotal);
        this.board.setOrder({ player: ev.next.player.map((u) => this.key(u)), enemy: ev.next.enemy.map((u) => this.key(u)) }, ev.round, ev.wave);
        if (this.onHold && !this.skipping) {
          const actors = [ev.next.player[0], ev.next.enemy[0]].map((u) => (u ? this.v(u)?.el : null)).filter((e): e is HTMLElement => !!e);
          const hold = this.onHold(ev.n, actors);
          if (hold) { await this.untilCancelled(hold); if (this.cancelled) return; }
        }
        this.animate(this.board.center, [{ transform: 'translate(-50%,-50%) scale(1.25)' }, { transform: 'translate(-50%,-50%) scale(1)' }], {
          duration: 260 / this.speed,
          easing: 'ease-out',
        });
        this.sfx.beat();
        await this.w(160);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'rule': {
        if (ev.id === 'master_burst') {
          if (ev.src !== undefined) {
            this.callout(ev.src, snap, ev.label, '#ffd36b', true);
            this.sig = { id: 's_master', uid: ev.src, n: 0 };
            // 屏幕从左到右扫过 6 道刀光，红色闪屏只闪一次
            const foe = snap.filter(x => x.side !== ev.side && x.alive && !x.reserve);
            if (!this.skipping && foe.length) {
              const [x0, x1] = this.sideX((1 - ev.side) as Side);
              const y = UNIT_Y - 12;
              for (let i = 0; i < 6; i++) {
                const x = x0 + ((x1 - x0) * (i + 0.5)) / 6;
                window.setTimeout(() => this.fx.slash(x, y + (i % 2 ? -18 : 18), ev.side === 0 ? 1 : -1, '#ff5f6d', true), (i * 60) / this.speed);
              }
              this.fx.flash('#ff2a4a', 0.16, 260);
            }
          }
          this.onLog({ text: ev.label, cls: 'buff' });
          await this.w(380);
          return;
        }
        // 关卡来源单独标明；后续属性事件沿用原有数值变化和增益表现。
        const anchor = ev.src ?? snap.find(u => u.side === ev.side && u.alive && u.hp > 0)?.uid;
        if (anchor !== undefined) this.callout(anchor, snap, `关卡·${ev.label}`, '#ffd36b', true, undefined, ev.src === undefined);
        this.onLog({ text: `关卡 · ${ev.label}`, cls: 'k-boss' });
        await this.w(380);
        return;
      }
      case 'trigger': {
        const u = this.st(snap, ev.src);
        const c = KIND_COLOR[ev.kind] ?? '#fff';
        const v = this.v(ev.src);
        this.sfx.trigger();
        if (ev.general) {
          const g = GENERAL_MAP[ev.general];
          const color = FACTION_INFO[g.faction].color;
          this.generalCallout(g.name, g.skill, color);
          this.genPulse(color);
          this.onLog({ text: `${ev.order ? circled(ev.order) : ''}将军 ${g.name}：${g.text}`, cls: 'general' });
          await this.w(700);
          await this.waitUntilResumed();
          if (this.cancelled) return;
          return;
        }
        v?.pulse(c);
        if (this.sig?.uid !== ev.src || this.sig.id !== u.defId) { this.sig = { id: u.defId, uid: ev.src, n: 0 }; this.sigOpen(u); }
        let label = ev.label;
        if (ev.kind === 'rattle') {
          // 同一单位的第二次亡语：标出是谁让它再来一次
          const n = (this.rattleSeen.get(ev.src) ?? 0) + 1;
          this.rattleSeen.set(ev.src, n);
          if (n === 2) {
            const mother = snap.find(m => m.alive && !m.reserve && m.side === u.side && unitDef(m.defId).special === 'matriarch');
            label = mother ? '主母 · 再次' : `${ev.label} · 再次`;
            if (mother) {
              const p = bodyPos(u.side, u.slot);
              this.fx.pillar(p.x, p.y + 50, '#a35cff', 200, 520);
              this.fx.link(bodyPos(mother.side, mother.slot), p, '#c590ff', 420);
            }
          }
        }
        this.callout(ev.src, snap, `${ev.order ? circled(ev.order) + ' ' : ''}${label}`, c, false, unitDef(u.defId).name);
        this.onLog({ text: `${ev.order ? circled(ev.order) : ''}${this.name(u)} · ${ev.label}`, cls: `k-${ev.kind}` });
        await this.w(380);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'buff': {
        const t = this.st(snap, ev.tgt);
        const tp = bodyPos(t.side, t.slot);
        if (ev.kw === 'armor' && t.defId === 'v_rhyno' && !this.skipping) { // 身上长出冰甲片
          fx.implode(tp.x, tp.y, '#bff4ff', { n: 14, r: 56, size: 3 });
          fx.burst(tp.x, tp.y, '#8feaff', { n: 10, speed: 3, kind: 'shard', size: 3 });
        }
        if (ev.kw) {
          await this.grantFx(ev.src, ev.tgt, snap, ev.kw, ev.v);
          this.sync(snap);
          await this.w(160);
          await this.waitUntilResumed();
          return;
        }
        if (ev.atk < 0 || ev.hp < 0) {
          await this.debuffFx(ev.src, ev.tgt, snap, Playback.debuffText(ev.atk, ev.hp));
          this.onLog({ text: `${this.name(t)} ${Playback.debuffText(ev.atk, ev.hp)}`, cls: 'dmg' });
          this.sync(snap);
          await this.w(300);
          await this.waitUntilResumed();
          return;
        }
        let quick = false;
        if (ev.src && ev.src !== ev.tgt) {
          const s = this.st(snap, ev.src), sp = bodyPos(s.side, s.slot);
          this.sfx.whoosh();
          if (ev.tgt === this.lastSummon) this.callout(ev.tgt, snap, '召唤加成', this.facColor(s), false, unitDef(s.defId).name);
          if (this.skipping) { /* 跳过时不播弹道 */ }
          else if (s.defId === 'l_caliber') { // 金色传动光推到新队首，脚下齿轮光环
            fx.link(sp, tp, '#ffd36b', 360);
            fx.spin(tp.x, tp.y + 52, '#ffd36b');
            await this.w(200);
          } else if (s.defId === 'l_banner') { // 护盾碎片被吸回该友军，化成攻击
            fx.implode(tp.x, tp.y, '#ffe08a', { n: 16, r: 64, size: 3 });
            await this.w(220);
          } else if (s.defId === 's_panda' && this.sigIs('s_panda')) { // 波纹经过谁就给谁加
            quick = true;
            await this.w(Math.min(240, Math.abs(tp.x - sp.x) * 0.6));
          } else if ((s.defId === 'd_pharaoh' || s.defId === 'd_goldob') && ev.tgt === this.lastSummon) { // 金沙落下渗进召唤物
            fx.flow(headPos(s.side, s.slot), { x: tp.x, y: tp.y - 50 }, '#ffd36b', { n: 18, arc: 70, life: 24, size: 2.6 });
            await this.w(380);
            fx.implode(tp.x, tp.y, '#e9bd72', { n: 12, r: 50, size: 2.6 });
          } else {
            await this.projectile(headPos(s.side, s.slot), tp, '#7dffb0');
          }
          await this.waitUntilResumed();
          if (this.cancelled) return;
        }
        this.sfx.buff();
        const armorGain = !ev.atk && !ev.hp
          ? (t.armor ?? 0) - (this.v(ev.tgt)?.getStats()?.kw?.armor ?? t.armor ?? 0) : 0;
        const gainText = !ev.atk && !ev.hp && armorGain
          ? `${armorGain > 0 ? '+' : ''}${armorGain}`
          : `+${ev.atk}/+${ev.hp}`;
        fx.float(tp.x, tp.y - 30, gainText, 'buff', 900, !ev.atk && !ev.hp && armorGain ? 'armor' : undefined);
        fx.burst(tp.x, tp.y + 30, '#7dffb0', { n: 14, speed: 2.4, kind: 'mote', size: 2.2, up: 2.5, gravity: -0.04, life: 40 });
        if (!this.skipping) fx.rise(tp.x, tp.y + 50, '#7dffb0', 5, 50);
        this.sync(snap);
        await this.w(quick ? 120 : 300);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'act': {
        this.sync(snap);
        const v = this.v(ev.uid);
        if (!v) return;
        const au = this.st(snap, ev.uid);
        if (ev.mode === 'cast' || ev.mode === 'charge') { this.sig = { id: au.defId, uid: ev.uid, n: 0 }; this.sigOpen(au); }
        else if (ev.mode === 'attack') this.sig = null;
        if (ev.mode === 'extra' && this.sig && this.sig.uid !== ev.uid && !this.skipping) {
          const s = this.st(snap, this.sig.uid), sp = bodyPos(s.side, s.slot), tp = bodyPos(au.side, au.slot);
          if (this.sig.id === 's_lord') { // 红色丝线一拉，把获胜者拽出去
            this.fx.link(sp, tp, '#ff2a4a', 360);
            this.fx.link(tp, sp, '#ff5f6d', 300);
          } else if (this.sig.id === 's_dancer') { // 影子贴到目标背后
            this.fx.flow(sp, { x: tp.x - (au.side === 0 ? 40 : -40), y: tp.y }, '#7a5cff', { n: 14, arc: 50, life: 20 });
            this.fx.burst(tp.x - (au.side === 0 ? 40 : -40), tp.y, '#2a1850', { n: 12, speed: 2, kind: 'mote', size: 4, gravity: -0.02 });
          } else if (this.sig.id === 'd_sandblade') { // 日轮向左右射出光
            this.fx.link(sp, tp, '#ffd36b', 300);
            this.fx.ring(tp.x, tp.y + 40, '#ffd36b', 70);
          }
        }
        if (ev.mode === 'cast') {
          v.pulse(this.facColor(this.st(snap, ev.uid)));
          this.unitAction(v.el, () => { v.setTag('施法', 'trg-cast'); });
          this.castFx(ev.uid, snap);
          await this.w(320);
          await this.waitUntilResumed();
          if (this.cancelled) return;
          v.setTag(null);
        } else if (ev.mode === 'charge') {
          v.pulse('#ffe58a');
          if (!this.skipping) await this.unitAction(v.el, () => v.windup(this.st(snap, ev.uid).side === 0 ? 1 : -1, 250 / this.speed), false);
          await this.waitUntilResumed();
          if (this.cancelled) return;
        } else if (ev.mode === 'extra') {
          v.pulse('#ffe58a');
          this.unitAction(v.el, () => v.dash(this.st(snap, ev.uid).side === 0 ? 1 : -1, 260 / this.speed));
          this.callout(ev.uid, snap, '追击！', '#ffe58a');
          await this.w(240);
        }
        // Once its regular action is consumed, retire the preview marker.
        // An immediate attack is independent and must not alter that preview.
        if (ev.mode !== 'extra') v.el.classList.remove('next-actor');
        return;
      }
      case 'actionGain': {
        const t = this.st(snap, ev.uid), tp = bodyPos(t.side, t.slot);
        this.sfx.buff();
        if (ev.src && ev.src !== ev.uid) {
          const s = this.st(snap, ev.src);
          this.fx.link(headPos(s.side, s.slot), headPos(t.side, t.slot), this.facColor(s), 320);
        }
        if (!this.skipping) fx.spin(tp.x, tp.y + 52, '#ffe58a');
        if (!this.skipping && t.defId === 's_ninja') { // 残影绕身一圈
          fx.spin(tp.x, tp.y, '#ff5f6d');
          fx.implode(tp.x, tp.y, '#3a1430', { n: 12, r: 60, size: 4 });
        }
        this.callout(ev.uid, snap, `行动 +${ev.n}`, '#ffe58a');
        if (ev.left !== undefined && this.roundBeats) { this.clashTotal = this.roundBeats + ev.left; this.board.setClash(this.roundBeats, this.clashTotal); }
        this.sync(snap);
        this.onLog({ text: `${this.name(t)} 本回合行动 +${ev.n}（剩余 ${ev.total} 次）`, cls: 'buff' });
        await this.w(260);
        return;
      }
      case 'sacrifice': {
        const t = this.st(snap, ev.tgt), p = bodyPos(t.side, t.slot);
        this.callout(ev.tgt, snap, '献祭', '#d6a8ff');
        fx.burst(p.x, p.y, '#b77bff', { n: 18, speed: 3, kind: 'mote', size: 3, gravity: -0.08, life: 32 });
        if (ev.src !== ev.tgt && !this.skipping) { // 祭品化成紫色粒子流进吞噬者，吞噬者膨胀一下
          const s = this.st(snap, ev.src), sp = bodyPos(s.side, s.slot);
          fx.flow(p, sp, '#b77bff', { n: 22, arc: 80, life: 26, size: 3 });
          await this.w(420);
          const sv = this.v(ev.src);
          if (sv) this.animate(sv.body, [
            { transform: 'scale(1)' }, { transform: 'scale(1.15)', offset: 0.4 }, { transform: 'scale(.96)', offset: 0.75 }, { transform: 'scale(1)' },
          ], { duration: 380 / this.speed, easing: 'ease-out' });
          fx.implode(sp.x, sp.y, '#d6a8ff', { n: 10, r: 46, size: 2.6 });
        }
        this.onLog({ text: `${this.name(this.st(snap, ev.src))} 献祭 ${this.name(t)}`, cls: 'death' });
        // The engine emits the normal death event next: keep its owned view for
        // death/rebirth effects rather than removing a sacrifice as an exile.
        this.sync(snap);
        await this.w(320);
        return;
      }
      case 'block': {
        const t = this.st(snap, ev.uid);
        const tp = bodyPos(t.side, t.slot);
        const stag = !!this.sigIs('v_stag');
        if (ev.src && ev.src !== ev.uid && !stag) {
          const s = this.st(snap, ev.src);
          await this.projectile(headPos(s.side, s.slot), tp, '#ffe08a');
          await this.waitUntilResumed();
          if (this.cancelled) return;
        }
        this.sfx.shield();
        const shc = stag ? '#8feaff' : '#ffe08a';
        fx.ring(tp.x, tp.y + 10, shc, 70);
        if (!this.skipping) fx.dome(tp.x, tp.y + 6, shc);
        if (!this.skipping && t.defId === 'l_cliff') { // 叠加的盾形轮廓
          for (let i = 1; i <= Math.min(3, t.block); i++) fx.ring(tp.x, tp.y + 10 - i * 14, '#ffd36b', 50 + i * 10, 30);
        }
        fx.float(tp.x, tp.y - 30, `+${ev.n}`, 'shield', 900, 'block');
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
        const sg = this.sig && ev.src === this.sig.uid ? this.sig : null;
        if (sg && !this.skipping && (sg.id === 'm_titan' && !chill)) { // 每个格位下依次喷出火柱
          fx.pillar(tp.x, tp.y + 52, '#ff7a2a', 240, 480);
          fx.wave(tp.x, tp.y + 52, '#ffb46a', 140);
          await this.w(120);
        } else if (sg && !this.skipping && sg.id === 'm_bloodcaller' && !chill) { // 敌人之间连出血红火线
          if (sg.prev) fx.link(sg.prev, tp, '#c4365a', 320);
          else { const s = this.st(snap, sg.uid); fx.link(bodyPos(s.side, s.slot), tp, '#c4365a', 320); }
          sg.prev = tp;
          await this.w(140);
        } else if (sg && !this.skipping && sg.id === 'v_queen' && chill) { // 冰纹沿地面蔓延
          const from = sg.prev ?? bodyPos(this.st(snap, sg.uid).side, this.st(snap, sg.uid).slot);
          fx.sweep(from.x, tp.x, tp.y + 50, '#bff4ff', 320, 50);
          sg.prev = tp;
          await this.w(160);
        } else if (sg && sg.id === 'v_stag' && chill) {
          // 雪风已经扫过，直接结霜
        } else if (ev.src && ev.src !== ev.uid) {
          const s = this.st(snap, ev.src);
          await this.projectile(headPos(s.side, s.slot), tp, color, 320, 14, chill ? 'ice' : 'fire');
          await this.waitUntilResumed();
          if (this.cancelled) return;
        }
        if (chill) this.sfx.freeze(); else this.sfx.hit(false);
        fx.burst(tp.x, tp.y, chill ? '#bff4ff' : '#ffb46a', { n: 12, speed: 3, kind: chill ? 'shard' : 'mote', size: 2.4, gravity: chill ? 0.05 : -0.05 });
        if (!this.skipping) {
          if (chill) { fx.impact(tp.x, tp.y, '#bff4ff'); fx.wave(tp.x, tp.y + 52, '#9fe8ff', 140); }
          else fx.rise(tp.x, tp.y + 44, '#ff9a4a', 8, 50);
        }
        fx.float(tp.x, tp.y - 38, `+${ev.n}`, chill ? 'freeze' : 'dmg splash', 900, chill ? 'chill' : 'burn');
        this.sync(snap);
        this.onLog({ text: `${this.name(t)} 获得 ${ev.n} 层${chill ? '寒意' : '灼烧'}（共 ${ev.total}）`, cls: chill ? 'freeze' : 'dmg' });
        await this.w(240);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'charge': {
        const t = this.st(snap, ev.uid);
        const tp = bodyPos(t.side, t.slot);
        this.sfx.charge(ev.total / Math.max(1, t.chargeMax ?? ev.total));
        fx.burst(tp.x, tp.y, '#ffe58a', { n: 8, speed: 2, kind: 'spark', size: 2.2, life: 20, gravity: -0.03 });
        this.sync(snap);
        if (ev.src && ev.src !== ev.uid) this.onLog({ text: `${this.name(t)} 蓄力 +${ev.n}（${ev.total}/${t.chargeMax ?? ev.total}）`, cls: 'buff' });
        await this.w(120);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'taunt': {
        const a = this.st(snap, ev.from), g = this.st(snap, ev.to);
        const gp = bodyPos(g.side, g.slot);
        this.projectile(bodyPos(a.side, a.slot), gp, '#ffe08a', 200, 10);
        fx.float(gp.x, gp.y - 50, '嘲讽', 'absorb');
        this.onLog({ text: `${this.name(g)} 嘲讽，吸引了攻击`, cls: 'shield' });
        await this.w(160);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'move': {
        this.sfx.swap();
        const ps: Promise<void>[] = [];
        for (const m of ev.moves) {
          const u = this.st(snap, m.uid);
          if (!u.alive || u.reserve) continue;
          let v = this.v(m.uid);
          if (!v) {
            v = new UnitView(u.defId, u.side, u.slot, u.level);
            v.setStats(statsOf(u));
            this.board.add(this.key(u.uid), v);
            this.unitAction(v.el, () => v!.appear());
            continue;
          }
          const view = v;
          if (view.slot !== u.slot) ps.push(this.unitAction(view.el, () => view.moveTo(u.slot, 420 / this.speed, m.to > m.from ? 40 : -16), false));
        }
        if (!this.skipping) await this.untilCancelled(Promise.all(ps));
        await this.waitUntilResumed();
        if (this.cancelled) return;
        this.sync(snap);
        return;
      }
      case 'genCount': {
        const g = GENERAL_MAP[ev.id];
        if (g) {
          this.genPulse(FACTION_INFO[g.faction].color);
          this.onLog({ text: `主将 ${g.name}：${ev.n}/${ev.max}`, cls: 'general' });
        }
        return;
      }
      case 'gen': {
        const g = GENERAL_MAP[ev.id];
        const color = FACTION_INFO[g.faction].color;
        this.sfx.trigger();
        this.generalCallout(g.name, ev.label, color);
        const from = this.genPulse(color);
        this.onLog({ text: `主将 ${g.name}：${ev.label}`, cls: 'general' });
        if (hasGenFx(ev.id, ev.label) && ev.tgts.length) {
          // 主将专属像素演出：头像先射出一道光，再播放招牌特效（2 倍速及以上用精简版）
          const ts = ev.tgts.map((uid) => this.st(snap, uid));
          const pos = ts.map((t) => bodyPos(t.side, t.slot));
          // 轨迹每次换位都触发，省掉头像弹道免得刷屏
          if (from && ev.label !== '轨迹') { this.sfx.whoosh(); await this.projectile(from, pos[0], color, 300, 16); }
          const allies = snap.filter((u) => u.side === 0 && u.hp > 0).sort((a, b) => a.slot - b.slot).map((u) => bodyPos(0, u.slot));
          const units = ts.map((t) => {
            const v = this.v(t.uid);
            return {
              lunge: () => { if (v) this.unitAction(v.el, () => v.lunge(t.side === 0 ? 1 : -1, 14, 280)); },
              pulse: (c: string) => { if (v) this.unitAction(v.el, () => v.pulse(c)); },
            };
          });
          if (ev.label === '轨迹') this.sfx.buff(); else GEN_SFX[ev.id]?.(this.sfx);
          if (!this.skipping && !this.cancelled) await this.untilCancelled(playGenFx(ev.id, ev.label, this.gfxHost(), { tgts: pos, units, allies, color }));
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
        this.sfx.summon();
        fx.ring(p.x, p.y + 40, '#b77bff', 80);
        if (!this.skipping) fx.pillar(p.x, p.y + 52, '#b77bff', 260, 600);
        fx.float(p.x, p.y - 44, '召回', 'exile', 1100);
        this.onLog({ text: `${this.name(u)} 被召回战场`, cls: 'summon' });
        await this.w(360);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'heal': {
        const t = this.st(snap, ev.tgt), p = bodyPos(t.side, t.slot);
        this.sfx.buff();
        fx.float(p.x, p.y - 32, `恢复 +${ev.n}`, 'buff');
        if (!this.skipping) {
          fx.rise(p.x, p.y + 50, '#7dffb0', 9, 56);
          fx.burst(p.x, p.y + 10, '#9dffc4', { n: 7, speed: 1.6, kind: 'plus', size: 2, up: 1.8, gravity: -0.05, life: 42 });
          fx.wave(p.x, p.y + 52, '#7dffb0', 130);
        }
        this.onLog({ text: `${this.name(t)} 恢复 ${ev.n}`, cls: 'buff' });
        this.sync(snap);
        await this.w(260); return;
      }
      case 'dmg': {
        const t = this.st(snap, ev.tgt);
        const tp = bodyPos(t.side, t.slot);
        const dir = t.side === 0 ? -1 : 1;
        const dsg = this.sig && ev.src === this.sig.uid ? this.sig : null;
        if (ev.kind === 'ability' && ev.src && dsg?.id === 's_master') {
          // 刀光已扫过全体，伤害同时落下
        } else if (ev.kind === 'ability' && ev.src && dsg?.id === 'a_chanter') {
          // 紫色魂潮从左向右横扫整排敌人，替代逐个魂火
          if (!dsg.n++ && !this.skipping) {
            const [x0, x1] = this.sideX(t.side);
            this.sfx.whoosh();
            fx.sweep(bodyPos(this.st(snap, ev.src).side, this.st(snap, ev.src).slot).x, x1 + (x1 - x0) * 0.1, tp.y, '#a35cff', 520, 220);
            await this.w(260);
          }
        } else if (ev.kind === 'ability' && ev.src) {
          const s = this.st(snap, ev.src);
          this.sfx.whoosh();
          await this.projectile(headPos(s.side, s.slot), tp, this.facColor(s), 360, 16, this.elemOf(s));
          await this.waitUntilResumed();
          if (this.cancelled) return;
        } else if (ev.kind === 'thorns' && ev.src) {
          const s = this.st(snap, ev.src);
          await this.projectile(bodyPos(s.side, s.slot), tp, '#c6ff6a', 220, 10);
          await this.waitUntilResumed();
          if (this.cancelled) return;
        }
        const hpLoss = ev.blocked ? 0 : ev.n;
        if (ev.seg === 2) fx.float(tp.x - 40, tp.y - 70, '连击', 'combo', 800);
        if (dsg?.id === 'm_rex' && !this.skipping && (ev.kind === 'attack' || ev.kind === 'splash')) {
          // 熔岩拖痕 + 落点火浪
          if (ev.kind === 'attack') { const s = this.st(snap, ev.src!); fx.sweep(bodyPos(s.side, s.slot).x, tp.x, tp.y + 50, '#ff6a2a', 300, 46); }
          fx.wave(tp.x, tp.y + 52, '#ff7a2a', 200, 460);
          fx.burst(tp.x, tp.y + 40, '#ffb46a', { n: 12, speed: 4, kind: 'mote', size: 3, gravity: -0.06 });
        }
        const big = ev.n >= 5;
        const hitView = this.v(ev.tgt);
        if (hitView) this.unitAction(hitView.el, () => hitView.hit(dir));
        if (ev.blocked) {
          this.sfx.shieldHit();
          fx.float(tp.x + 14, tp.y - 44, '', 'absorb', 900, 'block');
          fx.burst(tp.x, tp.y, '#ffe08a', { n: 10, speed: 4, size: 2 });
          if (!this.skipping) fx.dome(tp.x, tp.y + 6, '#ffe08a');
        }
        if (hpLoss > 0) {
          this.sfx.hit(big);
          fx.float(tp.x, tp.y - 20, `-${hpLoss}`, `dmg${big ? ' big' : ''}${ev.kind === 'splash' ? ' splash' : ''}`);
          if (ev.bonus && ev.src) fx.float(tp.x + 44, tp.y - 44, `+${ev.bonus}`, `bonus f-${this.fac(this.st(snap, ev.src))}`, 900);
          const hc = ev.kind === 'splash' || ev.kind === 'burn' ? '#ffb46a' : ev.kind === 'thorns' ? '#c6ff6a' : '#ff6a5a';
          fx.burst(tp.x, tp.y, hc, { n: big ? 24 : 14, speed: big ? 7 : 5, size: 2.6 });
          if (!this.skipping) {
            if (ev.kind === 'attack') fx.slash(tp.x, tp.y, dir, big ? '#ffd2a0' : '#fff0e0', big);
            if (ev.kind === 'burn') fx.rise(tp.x, tp.y + 40, '#ff9a4a', 6, 40);
            fx.impact(tp.x + dir * 6, tp.y, hc, big);
            if (big) fx.wave(tp.x, tp.y + 52, hc, 200);
          }
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
        this.sfx.whoosh();
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
        this.sfx.death();
        fx.burst(tp.x, tp.y, color, { n: 26, speed: 6, kind: 'shard', size: 4, up: 2, gravity: 0.25, life: 50 });
        fx.burst(tp.x, tp.y, '#ffffff', { n: 10, speed: 3, kind: 'mote', size: 3, gravity: -0.03, life: 30 });
        fx.ring(tp.x, tp.y + 40, color, 70);
        if (t.defId === 'm_egg' || t.defId === 'x_egg') { // 破壳：蛋壳碎片飞散
          fx.burst(tp.x, tp.y, '#fff1d6', { n: 22, speed: 7, kind: 'shard', size: 4, up: 4, gravity: 0.35, life: 46 });
          fx.burst(tp.x, tp.y, '#ffb46a', { n: 10, speed: 3, kind: 'mote', size: 3, gravity: -0.05 });
        }
        if (!this.skipping) {
          fx.pillar(tp.x, tp.y + 52, ev.exiled ? '#b77bff' : color, 300, 700);
          fx.wave(tp.x, tp.y + 52, color, 220, 560);
          fx.impact(tp.x, tp.y, '#ffffff', true);
        }
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
        this.sfx.swap();
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
        this.sfx.summon();
        if (this.sigIs('a_ritualist') && !this.skipping) { // 阵亡格位冒出骨手，把单位拉起来
          fx.hand(p.x, p.y + 56);
          fx.burst(p.x, p.y + 50, '#f4ecd8', { n: 12, speed: 3, kind: 'shard', size: 3, up: 2, gravity: 0.25 });
        }
        fx.ring(p.x, p.y + 40, '#ffe9a8', 80);
        if (!this.skipping) { fx.pillar(p.x, p.y + 52, '#ffe9a8', 320, 760); fx.rise(p.x, p.y + 50, '#fff2c0', 10, 60); }
        fx.float(p.x, p.y - 44, '复生', 'buff', 1100);
        this.onLog({ text: `${this.name(u)} 复生`, cls: 'summon' });
        await this.w(420);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'summon': {
        const u = this.st(snap, ev.uid);
        const p = bodyPos(u.side, u.slot);
        this.lastSummon = ev.uid;
        // 召唤者先射一道阵营色光点到出生点，再开召唤圈
        const caller = ev.src && ev.src !== ev.uid ? this.st(snap, ev.src) : null;
        const sc = caller ? this.facColor(caller) : '#d6a8ff';
        if (caller && caller.alive && !this.skipping && caller.defId === 'd_worm') {
          // 地面隆起一道沙丘，从巨虫钻到出生点
          const cp = bodyPos(caller.side, caller.slot);
          fx.sweep(cp.x, p.x, p.y + 50, '#c9954a', 360, 60);
          fx.flow({ x: cp.x, y: cp.y + 50 }, { x: p.x, y: p.y + 50 }, '#e9bd72', { n: 16, arc: 18, life: 22, kind: 'shard', size: 3 });
          await this.w(340);
          if (this.cancelled) return;
        } else if (caller && caller.alive && !this.skipping) {
          await this.projectile(headPos(caller.side, caller.slot), { x: p.x, y: p.y + 30 }, sc, 260, 12);
          if (this.cancelled) return;
        }
        const v = new UnitView(u.defId, u.side, u.slot, u.level);
        v.setStats(statsOf(u));
        this.board.add(this.key(u.uid), v);
        this.unitAction(v.el, () => v.appear());
        this.sfx.summon();
        fx.ring(p.x, p.y + 40, sc, 80);
        if (!this.skipping) { fx.pillar(p.x, p.y + 52, sc, 240, 560); fx.wave(p.x, p.y + 52, sc, 170); }
        fx.burst(p.x, p.y, sc, { n: 18, speed: 3, kind: 'mote', size: 3, gravity: -0.05 });
        this.onLog({ text: `召唤 ${unitDef(u.defId).name} ${u.atk}/${u.hp}`, cls: 'summon' });
        await this.w(420);
        await this.waitUntilResumed();
        if (this.cancelled) return;
        return;
      }
      case 'frozenSkip': {
        const t = this.st(snap, ev.uid);
        const tp = bodyPos(t.side, t.slot);
        this.sfx.freeze();
        const frozenView = this.v(ev.uid);
        frozenView?.el.classList.remove('next-actor');
        if (frozenView) this.animate(frozenView.body, 
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
          { duration: 200 / this.speed, iterations: 2 },
        );
        if (!this.skipping) fx.shell(tp.x, tp.y + 4);
        fx.float(tp.x, tp.y - 60, '冻结', 'freeze');
        fx.burst(tp.x, tp.y, '#bff4ff', { n: 12, speed: 3, kind: 'shard', size: 2 });
        if (!this.skipping) fx.dome(tp.x, tp.y + 6, '#bff4ff');
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
        this.sfx.fizzle();
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
    const u = this.st(snap, uid), p = bodyPos(u.side, u.slot), f = this.fac(u), c = this.facColor(u);
    const el = h('div', { class: 'cast-rune', 'data-f': f, style: `left:${p.x}px;top:${p.y + 46}px` });
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
    this.fx.burst(p.x, p.y + 40, c, { n: 14, speed: 1.6, kind: 'mote', size: 2.4, up: 2.6, gravity: -0.05, life: 36 });
    this.fx.pillar(p.x, p.y + 52, c, 200, 520);
    this.fx.rise(p.x, p.y + 50, c, 6, 50);
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
    const el = h('div', { class: 'gen-callout', style: `--c:${color}` }, h('b', null, name), h('span', null, text));
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

