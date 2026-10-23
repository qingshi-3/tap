import { h, STAGE_H, STAGE_W } from './dom';

interface P {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  size: number; color: string; kind: 'spark' | 'shard' | 'mote' | 'ring' | 'plus' | 'streak'; rot: number; vr: number; g: number;
  /** 每步阻尼，缺省 0.96；汇聚类粒子用 1 保证落点准确 */
  d?: number;
}

const snap = (v: number) => Math.round(v / 2) * 2;

export class FX {
  canvas: HTMLCanvasElement;
  layer: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private ps: P[] = [];
  private raf = 0;
  private last = 0;
  private paused = false;
  private disposed = false;
  private animations = new Set<Animation>();
  private shakeTarget: HTMLElement;
  private res = 1;

  /** 特效所在的舞台根节点（主将演出把氛围层挂在这里，压在单位之上、粒子之下） */
  readonly root: HTMLElement;
  constructor(root: HTMLElement, shakeTarget: HTMLElement) {
    this.root = root;
    this.canvas = h('canvas', { class: 'fx-canvas' });
    this.layer = h('div', { class: 'fx-layer' });
    root.append(this.canvas, this.layer);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.shakeTarget = shakeTarget;
    this.resize(1);
    document.addEventListener('visibilitychange', this.visibility);
  }

  resize(scale: number) {
    this.res = Math.min(1.25, (window.devicePixelRatio || 1) * scale);
    this.canvas.width = Math.round(STAGE_W * this.res);
    this.canvas.height = Math.round(STAGE_H * this.res);
  }

  burst(x: number, y: number, color: string, o: { n?: number; speed?: number; kind?: P['kind']; size?: number; up?: number; life?: number; gravity?: number } = {}) {
    const n = o.n ?? 16;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 5) * (0.35 + Math.random() * 0.8);
      const life = (o.life ?? 40) * (0.6 + Math.random() * 0.6);
      this.ps.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 0),
        life, max: life, size: (o.size ?? 3) * (0.6 + Math.random() * 0.8), color,
        kind: o.kind ?? 'spark', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, g: o.gravity ?? 0.12,
      });
    }
    this.kick();
  }

  ring(x: number, y: number, color: string, size = 60, life = 26) {
    this.ps.push({ x, y, vx: 0, vy: 0, life, max: life, size, color, kind: 'ring', rot: 0, vr: 0, g: 0 });
    this.kick();
  }

  /** 一次性 DOM 光效：只动 transform/opacity，结束即移除 */
  private sprite(cls: string, x: number, y: number, frames: Keyframe[], dur: number, style = '', easing = 'cubic-bezier(.2,.8,.3,1)') {
    if (this.blocked) return;
    const el = h('div', { class: `fxs ${cls}`, style: `left:${x}px;top:${y}px;${style}` });
    this.layer.appendChild(el);
    this.track(el.animate(frames, { duration: dur / this.rate, easing, fill: 'both' }), el);
  }

  /** 播放倍速（由回放同步），只影响 DOM 光效时长 */
  rate = 1;

  /** 斩击：一道月牙刀光扫过目标；dir=1 从左往右 */
  slash(x: number, y: number, dir: number, color: string, big = false) {
    const s = big ? 1.35 : 1;
    const r0 = dir > 0 ? -70 : 250, r1 = dir > 0 ? 10 : 170;
    this.sprite('fx-slash', x, y, [
      { opacity: 0, transform: `translate(-50%,-50%) rotate(${r0}deg) scale(${0.6 * s})` },
      { opacity: 1, transform: `translate(-50%,-50%) rotate(${(r0 + r1) / 2}deg) scale(${1.05 * s})`, offset: 0.35 },
      { opacity: 0, transform: `translate(-50%,-50%) rotate(${r1}deg) scale(${1.2 * s})` },
    ], big ? 300 : 240, `--c:${color}`);
  }

  /** 命中星芒：十字光芒 + 核心白闪 */
  impact(x: number, y: number, color: string, big = false) {
    const s = big ? 1.5 : 1;
    const rot = Math.round(Math.random() * 40 - 20);
    this.sprite('fx-impact', x, y, [
      { opacity: 1, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${0.2 * s})` },
      { opacity: 1, transform: `translate(-50%,-50%) rotate(${rot + 8}deg) scale(${1 * s})`, offset: 0.3 },
      { opacity: 0, transform: `translate(-50%,-50%) rotate(${rot + 14}deg) scale(${1.3 * s})` },
    ], big ? 340 : 260, `--c:${color}`);
  }

  /** 光柱：自地面升起（施法、复生、阵亡） */
  pillar(x: number, y: number, color: string, height = 260, dur = 620) {
    this.sprite('fx-pillar', x, y, [
      { opacity: 0, transform: 'translate(-50%,-100%) scaleX(.15) scaleY(.4)' },
      { opacity: 1, transform: 'translate(-50%,-100%) scaleX(1) scaleY(1)', offset: 0.25 },
      { opacity: 0.8, transform: 'translate(-50%,-100%) scaleX(.6) scaleY(1.05)', offset: 0.6 },
      { opacity: 0, transform: 'translate(-50%,-100%) scaleX(.05) scaleY(1.1)' },
    ], dur, `--c:${color};height:${height}px`, 'ease-out');
  }

  /** 地面冲击波：扁椭圆光环扩散 */
  wave(x: number, y: number, color: string, size = 160, dur = 480) {
    this.sprite('fx-wave', x, y, [
      { opacity: 0.95, transform: 'translate(-50%,-50%) scaleY(.36) scale(.15)' },
      { opacity: 0, transform: 'translate(-50%,-50%) scaleY(.36) scale(1)' },
    ], dur, `--c:${color};width:${size}px;height:${size}px`, 'cubic-bezier(.1,.7,.3,1)');
  }

  /** 护盾罩：半球光壳闪现 */
  dome(x: number, y: number, color: string) {
    this.sprite('fx-dome', x, y, [
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.06)', offset: 0.25 },
      { opacity: 0.7, transform: 'translate(-50%,-50%) scale(1)', offset: 0.6 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.15)' },
    ], 560, `--c:${color}`);
  }

  /** 因果连线：从 a 向 b 展开一道光线再淡出（召唤、传令、献祭、授予） */
  link(a: { x: number; y: number }, b: { x: number; y: number }, color: string, dur = 420) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.max(8, Math.hypot(dx, dy)), ang = Math.atan2(dy, dx);
    const r = `translate(0,-50%) rotate(${ang}rad)`;
    this.sprite('fx-link', a.x, a.y, [
      { opacity: 0, transform: `${r} scaleX(0)` },
      { opacity: 1, transform: `${r} scaleX(1)`, offset: 0.45 },
      { opacity: 0, transform: `${r} scaleX(1)` },
    ], dur, `--c:${color};width:${len}px`, 'ease-out');
  }

  /** 削弱：一串下坠的像素箭头 */
  debuff(x: number, y: number, color: string) {
    this.sprite('fx-debuff', x, y, [
      { opacity: 0, transform: 'translate(-50%,-110%)' },
      { opacity: 1, transform: 'translate(-50%,-70%)', offset: 0.25 },
      { opacity: 1, transform: 'translate(-50%,-40%)', offset: 0.7 },
      { opacity: 0, transform: 'translate(-50%,-10%)' },
    ], 560, `--c:${color}`, 'ease-in');
  }

  /** 冰壳：整个单位罩进冰块，停留后碎开 */
  shell(x: number, y: number, dur = 700) {
    this.sprite('fx-shell', x, y, [
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.25)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.18 },
      { opacity: 0.9, transform: 'translate(-50%,-50%) scale(1)', offset: 0.8 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.08)' },
    ], dur, '', 'ease-out');
  }

  /** 行动环：脚下一圈顺时针转一周的箭头 */
  spin(x: number, y: number, color: string) {
    this.sprite('fx-spin', x, y, [
      { opacity: 0, transform: 'translate(-50%,-50%) scaleY(.42) rotate(0deg) scale(.6)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scaleY(.42) rotate(120deg) scale(1)', offset: 0.3 },
      { opacity: 1, transform: 'translate(-50%,-50%) scaleY(.42) rotate(300deg) scale(1)', offset: 0.8 },
      { opacity: 0, transform: 'translate(-50%,-50%) scaleY(.42) rotate(360deg) scale(1.1)' },
    ], 560, `--c:${color}`, 'ease-in-out');
  }

  /** 横扫：一道光带从 x0 扫到 x1（全体技能，代替逐个弹道） */
  sweep(x0: number, x1: number, y: number, color: string, dur = 460, h = 200) {
    const dir = x1 >= x0 ? 1 : -1;
    this.sprite('fx-sweep', x0, y, [
      { opacity: 0, transform: `translate(-50%,-50%) translateX(0) scaleX(${dir})` },
      { opacity: 1, transform: `translate(-50%,-50%) translateX(${(x1 - x0) * 0.25}px) scaleX(${dir})`, offset: 0.2 },
      { opacity: 1, transform: `translate(-50%,-50%) translateX(${(x1 - x0) * 0.8}px) scaleX(${dir})`, offset: 0.75 },
      { opacity: 0, transform: `translate(-50%,-50%) translateX(${x1 - x0}px) scaleX(${dir})` },
    ], dur, `--c:${color};height:${h}px`, 'ease-in-out');
  }

  /** 词条图标 / 短词：从 a 飞到 b 上方，停一下再缩进单位 */
  token(a: { x: number; y: number }, b: { x: number; y: number }, node: HTMLElement, dur = 760) {
    if (this.blocked) return;
    const el = h('div', { class: 'fxs fx-token', style: `left:0;top:0` }, node);
    this.layer.appendChild(el);
    const top = b.y - 70;
    const p = (x: number, y: number, s: number) => `translate(${x}px,${y}px) translate(-50%,-50%) scale(${s})`;
    this.track(el.animate([
      { opacity: 0, transform: p(a.x, a.y, 0.5) },
      { opacity: 1, transform: p((a.x + b.x) / 2, Math.min(a.y, top) - 40, 1), offset: 0.3 },
      { opacity: 1, transform: p(b.x, top, 1.25), offset: 0.5 },
      { opacity: 1, transform: p(b.x, top, 1.15), offset: 0.8 },
      { opacity: 0, transform: p(b.x, b.y + 40, 0.4) },
    ], { duration: dur / this.rate, easing: 'ease-out', fill: 'both' }), el);
  }

  /** 汇聚：一圈粒子向中心收拢（吸回、渗入） */
  implode(x: number, y: number, color: string, o: { n?: number; r?: number; life?: number; size?: number } = {}) {
    const n = o.n ?? 16, r = o.r ?? 70, life = o.life ?? 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const rr = r * (0.7 + Math.random() * 0.5);
      this.ps.push({
        x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.7, vx: -Math.cos(a) * rr / life, vy: -Math.sin(a) * rr * 0.7 / life,
        life, max: life, size: (o.size ?? 3) * (0.7 + Math.random() * 0.6), color, kind: 'mote', rot: 0, vr: 0, g: 0, d: 1,
      });
    }
    this.kick();
  }

  /** 粒子流：沿弧线从 a 流向 b（献祭吞噬、金沙落下、沙丘钻行） */
  flow(a: { x: number; y: number }, b: { x: number; y: number }, color: string, o: { n?: number; life?: number; arc?: number; size?: number; kind?: P['kind'] } = {}) {
    const n = o.n ?? 18, arc = o.arc ?? 60;
    for (let i = 0; i < n; i++) {
      const life = (o.life ?? 26) * (0.85 + Math.random() * 0.3);
      // 抛物线：初速向上，重力拉回，life 帧后正好落到 b
      const g = (2 * arc) / (life * life / 4);
      const sx = a.x + (Math.random() - 0.5) * 16, sy = a.y + (Math.random() - 0.5) * 16;
      this.ps.push({
        x: sx, y: sy, vx: (b.x - sx) / life, vy: (b.y - sy) / life - g * life / 2,
        life, max: life, size: (o.size ?? 3) * (0.7 + Math.random() * 0.6), color, kind: o.kind ?? 'mote', rot: 0, vr: 0, g, d: 1,
      });
    }
    this.kick();
  }

  /** 骨手：自地面伸出、握拳、缩回（唤亡复活） */
  hand(x: number, y: number) {
    this.sprite('fx-hand', x, y, [
      { opacity: 0, transform: 'translate(-50%,-10%) scaleY(.2)' },
      { opacity: 1, transform: 'translate(-50%,-100%) scaleY(1.05)', offset: 0.35 },
      { opacity: 1, transform: 'translate(-50%,-100%) scaleY(.92)', offset: 0.7 },
      { opacity: 0, transform: 'translate(-50%,-30%) scaleY(.3)' },
    ], 640, '', 'cubic-bezier(.2,.9,.3,1)');
  }

  /** 上升光丝（治疗、增益） */
  rise(x: number, y: number, color: string, n = 8, spread = 60) {
    for (let i = 0; i < n; i++) {
      const life = 34 + Math.random() * 20;
      this.ps.push({
        x: x + (Math.random() - 0.5) * spread, y: y + Math.random() * 20, vx: 0, vy: -(2.2 + Math.random() * 2.2),
        life, max: life, size: 6 + Math.random() * 8, color, kind: 'streak', rot: 0, vr: 0, g: -0.02,
      });
    }
    this.kick();
  }

  // ───────── 整备 / 培养特效（只动 transform / opacity，全程 ≤700ms） ─────────

  /** 培养法球：像素方块沿弧线从 a 飞向 b，身后拖一串同色像素尘 */
  orb(a: { x: number; y: number }, b: { x: number; y: number }, color: string, dur = 300) {
    if (this.blocked) return;
    const el = h('div', { class: 'fxs fx-orb', style: `left:0;top:0;--c:${color}` });
    this.layer.appendChild(el);
    const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - 90;
    const at = (t: number) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t * t * b.y });
    const frames: Keyframe[] = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => {
      const p = at(t), s = [0.5, 1.25, 1.15, 1.05, 1, 0.7][i];
      return { offset: t, opacity: t === 0 ? 0 : 1, transform: `translate(${p.x}px,${p.y}px) translate(-50%,-50%) rotate(${Math.round(t * 270)}deg) scale(${s})` };
    });
    this.track(el.animate(frames, { duration: dur / this.rate, easing: 'cubic-bezier(.5,0,.75,1)', fill: 'both' }), el);
    this.flow(a, b, color, { n: 7, life: Math.max(10, Math.round(dur / 17)), arc: 45, size: 2.5 });
  }

  /** 物品落下：图标从单位头顶砸下、压扁回弹后消失 */
  drop(b: { x: number; y: number }, node: HTMLElement, dur = 460) {
    if (this.blocked) return;
    const el = h('div', { class: 'fxs fx-drop', style: 'left:0;top:0' }, node);
    this.layer.appendChild(el);
    const p = (y: number, sx: number, sy: number) => `translate(${b.x}px,${b.y + y}px) translate(-50%,-100%) scale(${sx},${sy})`;
    this.track(el.animate([
      { offset: 0, opacity: 0, transform: p(-170, 1.3, 1.3) },
      { offset: 0.12, opacity: 1, transform: p(-160, 1.3, 1.3), easing: 'cubic-bezier(.55,0,1,.45)' },
      { offset: 0.6, opacity: 1, transform: p(0, 1, 1.15) },
      { offset: 0.7, opacity: 1, transform: p(0, 1.35, 0.7) },
      { offset: 0.84, opacity: 1, transform: p(-10, 0.95, 1.08) },
      { offset: 1, opacity: 0, transform: p(0, 0.6, 0.6) },
    ], { duration: dur / this.rate, fill: 'both' }), el);
  }

  /** 升星：像素星芒炸开 + 一串小星升起 */
  stars(x: number, y: number, color = '#ffe08a', n = 7) {
    this.sprite('fx-starburst', x, y, [
      { opacity: 1, transform: 'translate(-50%,-50%) rotate(0deg) scale(.2)' },
      { opacity: 1, transform: 'translate(-50%,-50%) rotate(30deg) scale(1.2)', offset: 0.35 },
      { opacity: 0, transform: 'translate(-50%,-50%) rotate(45deg) scale(1.5)' },
    ], 440, `--c:${color}`);
    for (let i = 0; i < n; i++) {
      const dx = Math.round((i - (n - 1) / 2) * 18 + (Math.random() - 0.5) * 10);
      const up = 90 + Math.random() * 60, lag = 0.05 + (i % 3) * 0.08, s = 0.7 + Math.random() * 0.6;
      this.sprite('fx-star', x + dx, y + 10, [
        { opacity: 0, transform: `translate(-50%,-50%) scale(.2)` },
        { opacity: 0, transform: `translate(-50%,-50%) scale(.2)`, offset: lag },
        { opacity: 1, transform: `translate(-50%,${-50 - up * 0.35}px) scale(${s * 1.3})`, offset: lag + 0.2 },
        { opacity: 0, transform: `translate(${-50 + dx * 0.3}%,${-50 - up}px) scale(${s * 0.6})` },
      ], 600 + Math.random() * 100, `--c:${color}`);
    }
  }

  /** 目标受强化：单次缩放弹跳（不改布局） */
  pulse(el: Element | null | undefined, scale = 1.18, dur = 320) {
    if (!el || this.blocked) return;
    this.track(el.animate([
      { transform: 'scale(1)' },
      { transform: `scale(${scale})`, offset: 0.35 },
      { transform: 'scale(1)' },
    ], { duration: dur, easing: 'cubic-bezier(.3,1.6,.5,1)' }));
  }

  /** 数值跳动：向上一顿再落回 */
  bump(el: Element | null | undefined, dur = 340) {
    if (!el || this.blocked) return;
    this.track(el.animate([
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(-8px) scale(1.5)', offset: 0.3 },
      { transform: 'translateY(2px) scale(.92)', offset: 0.65 },
      { transform: 'translateY(0) scale(1)' },
    ], { duration: dur, easing: 'ease-out' }));
  }

  /** 漂浮文字（伤害、加成、落空提示） */
  /** px：像素词条图标（护甲/格挡/寒意/灼烧/法强），跟在数字后面，代替词条文字 */
  float(x: number, y: number, text: string, cls: string, dur = 900, px?: string) {
    const el = h('div', { class: `float ${cls}`, style: `left:${x}px;top:${y}px` }, text, px ? h('span', { class: `kpx px-${px}` }) : null);
    this.layer.appendChild(el);
    const dx = (Math.random() - 0.5) * 24;
    this.track(el.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.3}px),-90%) scale(1.25)`, opacity: 1, offset: 0.18 },
        { transform: `translate(calc(-50% + ${dx * 0.6}px),-120%) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx}px),-190%) scale(.9)`, opacity: 0 },
      ],
      { duration: dur, easing: 'cubic-bezier(.2,.8,.3,1)' },
    ), el);
  }

  /** 培养数值：无底框的描边大字，弹出 → 回弹 → 上浮淡出，四颗像素火花向外蹦 */
  statPop(x: number, y: number, num: string, label: string, cls: string, dur = 900) {
    const el = h('div', { class: `cul-pop ${cls}`, style: `left:${x}px;top:${y}px` },
      num ? h('b', { 'data-t': num }, num) : null, h('span', { 'data-t': label }, label));
    this.layer.appendChild(el);
    const tilt = (Math.random() - 0.5) * 10;
    this.track(el.animate(
      [
        { transform: `translate(-50%,-30%) scale(.2,.2) rotate(${tilt}deg)`, opacity: 0 },
        { transform: `translate(-50%,-70%) scale(1.45,.8) rotate(${tilt}deg)`, opacity: 1, offset: 0.12 },
        { transform: 'translate(-50%,-85%) scale(.88,1.18) rotate(0deg)', opacity: 1, offset: 0.22 },
        { transform: 'translate(-50%,-80%) scale(1.06,.96)', opacity: 1, offset: 0.32 },
        { transform: 'translate(-50%,-82%) scale(1)', opacity: 1, offset: 0.62 },
        { transform: 'translate(-50%,-170%) scale(.92)', opacity: 0 },
      ],
      { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)' },
    ), el);
    for (let i = 0; i < 4; i++) {
      const sp = h('i', { class: `cul-spark ${cls}`, style: `left:${x}px;top:${y}px` });
      this.layer.appendChild(sp);
      const a = -Math.PI / 2 + (i - 1.5) * 0.7, r = 34 + Math.random() * 12;
      this.track(sp.animate(
        [
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(.4)`, opacity: 0 },
        ],
        { duration: 420, delay: 70, easing: 'cubic-bezier(.1,.8,.4,1)', fill: 'backwards' },
      ), sp);
    }
  }

  shake(power = 6, dur = 260, xOnly = false) {
    const k = [];
    for (let i = 0; i < 7; i++) {
      const f = 1 - i / 7;
      const x = xOnly ? (i % 2 ? -1 : 1) * power * f : (Math.random() - 0.5) * 2 * power * f;
      k.push({ transform: `translate(${x}px, ${xOnly ? 0 : (Math.random() - 0.5) * 2 * power * f}px)` });
    }
    k.push({ transform: 'translate(0,0)' });
    this.track(this.shakeTarget.animate(k, { duration: dur, easing: 'linear' }));
  }

  flash(color = '#fff', opacity = 0.25, dur = 220) {
    const el = h('div', { class: 'screen-flash', style: `background:${color}` });
    this.layer.appendChild(el);
    this.track(el.animate([{ opacity }, { opacity: 0 }], { duration: dur, easing: 'ease-out' }), el);
  }

  private get blocked() { return this.paused || document.hidden || this.disposed; }

  private track(animation: Animation, node?: HTMLElement) {
    this.animations.add(animation);
    animation.onfinish = () => { this.animations.delete(animation); node?.remove(); };
    if (this.blocked) animation.pause();
  }

  private visibility = () => this.syncPause();

  private syncPause() {
    if (this.blocked) {
      cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0;
      this.animations.forEach(a => a.pause());
    } else {
      this.animations.forEach(a => a.play());
      this.kick();
    }
  }

  setPaused(paused: boolean) { this.paused = paused; this.syncPause(); }

  clear() {
    cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0; this.ps = [];
    this.animations.forEach(a => { a.onfinish = null; a.cancel(); });
    this.animations.clear(); this.layer.replaceChildren();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  dispose() {
    this.disposed = true; this.clear();
    document.removeEventListener('visibilitychange', this.visibility);
    this.canvas.remove(); this.layer.remove();
  }

  private kick() {
    if (this.raf || this.blocked || !this.ps.length) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (this.blocked) { this.last = 0; return; }
    const elapsed = now - this.last;
    if (elapsed < 1000 / 30 - 0.1) { this.raf = requestAnimationFrame(this.tick); return; }
    this.last = now;
    const dt = Math.min(elapsed, 100) / (1000 / 60);
    const c = this.ctx;
    c.setTransform(this.res, 0, 0, this.res, 0, 0);
    c.clearRect(0, 0, STAGE_W, STAGE_H);
    c.globalCompositeOperation = 'lighter';
    const next: P[] = [];
    for (const p of this.ps) {
      p.life -= dt;
      if (p.life <= 0.000001) continue;
      next.push(p);
      const t = p.life / p.max;
      // Integrate in original 60Hz steps so damping/gravity preserve their old trajectory.
      for (let remaining = dt; remaining > 0; ) {
        const step = Math.min(1, remaining);
        p.x += p.vx * step; p.y += p.vy * step;
        p.vy += p.g * step;
        const damping = Math.pow(p.d ?? 0.96, step);
        p.vx *= damping; p.vy *= damping; p.rot += p.vr * step;
        remaining -= step;
      }
      c.globalAlpha = Math.min(1, t * 1.6);
      // 像素风：所有粒子都是贴 2px 网格的方块
      if (p.kind === 'spark' || p.kind === 'mote') {
        // 光晕：粒子身后一块更大的淡色方块，叠加模式下像发光
        const hs = snap(p.size * 3 + 4);
        c.globalAlpha = Math.min(1, t * 1.6) * 0.16;
        c.fillStyle = p.color;
        c.fillRect(snap(p.x - hs / 2), snap(p.y - hs / 2), hs, hs);
        c.globalAlpha = Math.min(1, t * 1.6);
      }
      if (p.kind === 'spark') {
        // 火花 = 沿速度方向的一串方块，头亮尾暗
        const s = Math.max(2, snap(p.size * t + 1));
        c.fillStyle = p.color;
        for (let k = 0; k < 3; k++) {
          c.globalAlpha = Math.min(1, t * 1.6) * (1 - k * 0.3);
          c.fillRect(snap(p.x - p.vx * k * 1.2 - s / 2), snap(p.y - p.vy * k * 1.2 - s / 2), s, s);
        }
      } else if (p.kind === 'shard') {
        const s = Math.max(2, snap(p.size * (0.6 + t * 0.6)));
        c.fillStyle = p.color;
        c.fillRect(snap(p.x - s / 2), snap(p.y - s / 2), s, s);
        // 碎片随旋转闪一下白边
        if (Math.sin(p.rot * 2) > 0.6) {
          c.fillStyle = '#fff';
          c.fillRect(snap(p.x - s / 2), snap(p.y - s / 2), s, 2);
        }
      } else if (p.kind === 'mote') {
        const s = Math.max(2, snap(p.size * (1.6 - t * 0.6)));
        const x = snap(p.x - s / 2), y = snap(p.y - s / 2);
        c.fillStyle = p.color;
        c.fillRect(x, y, s, s);
        c.globalAlpha *= 0.45;
        c.fillRect(x - 2, y + s / 2 - 1, s + 4, 2);
        c.fillRect(x + s / 2 - 1, y - 2, 2, s + 4);
      } else if (p.kind === 'plus') {
        // 回血十字
        const s = Math.max(2, snap(p.size));
        const x = snap(p.x), y = snap(p.y);
        c.fillStyle = p.color;
        c.fillRect(x - s / 2, y - s * 1.5, s, s * 3);
        c.fillRect(x - s * 1.5, y - s / 2, s * 3, s);
      } else if (p.kind === 'streak') {
        // 上升光丝：头亮、尾巴逐格变淡
        const len = snap(p.size * (0.5 + t));
        const x = snap(p.x), y = snap(p.y);
        c.fillStyle = p.color;
        for (let k = 0; k < len; k += 2) {
          c.globalAlpha = Math.min(1, t * 1.6) * (1 - k / len);
          c.fillRect(x, y + k, 2, 2);
        }
        c.globalAlpha = Math.min(1, t * 1.6);
        c.fillStyle = '#fff';
        c.fillRect(x, y, 2, 2);
      } else if (p.kind === 'ring') {
        // 像素椭圆环：沿椭圆打点
        const e = 1 - t;
        const rx = p.size * (0.3 + e), ry = rx * 0.42;
        const n = Math.max(16, Math.round(rx * 0.9));
        const s = t > 0.5 ? 4 : 2;
        c.fillStyle = p.color;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          c.fillRect(snap(p.x + Math.cos(a) * rx - s / 2), snap(p.y + Math.sin(a) * ry - s / 2), s, s);
        }
      }
    }
    c.globalAlpha = 1;
    this.ps = next;
    if (next.length) this.raf = requestAnimationFrame(this.tick);
    else {
      c.clearRect(0, 0, STAGE_W, STAGE_H);
      this.last = 0;
    }
  };
}

/** 背景漂浮微光 */
export function ambient(canvas: HTMLCanvasElement) {
  const c = canvas.getContext('2d')!;
  canvas.width = STAGE_W / 2;
  canvas.height = STAGE_H / 2;
  c.imageSmoothingEnabled = false;
  const motes = Array.from({ length: 46 }, () => ({
    x: Math.random() * STAGE_W, y: Math.random() * STAGE_H, r: 0.6 + Math.random() * 2.2,
    vx: (Math.random() - 0.5) * 0.15, vy: -0.08 - Math.random() * 0.25, p: Math.random() * 6,
    hue: Math.random() < 0.7 ? '255,214,140' : '150,200,255',
  }));
  let raf = 0, last = 0, paused = false, disposed = false;
  const blocked = () => paused || document.hidden || disposed;
  const loop = (now: number) => {
    raf = 0;
    if (blocked()) { last = 0; return; }
    const elapsed = now - last;
    if (elapsed < 1000 / 20 - 0.1) { raf = requestAnimationFrame(loop); return; }
    last = now;
    const dt = Math.min(elapsed, 100) / (1000 / 60);
    c.setTransform(0.5, 0, 0, 0.5, 0, 0);
    c.clearRect(0, 0, STAGE_W, STAGE_H);
    for (const m of motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.p += 0.02 * dt;
      if (m.y < -10) {
        m.y = STAGE_H + 10;
        m.x = Math.random() * STAGE_W;
      }
      const a = 0.25 + Math.sin(m.p) * 0.2;
      c.fillStyle = `rgba(${m.hue},${a})`;
      const s = m.r > 1.8 ? 4 : 2;
      const x = snap(m.x), y = snap(m.y);
      c.fillRect(x, y, s, s);
      // 大颗的在亮相位时闪出十字星
      if (s === 4 && a > 0.38) {
        c.fillStyle = `rgba(${m.hue},${a * 0.4})`;
        c.fillRect(x - 2, y + 1, 8, 2);
        c.fillRect(x + 1, y - 2, 2, 8);
      }
    }
    raf = requestAnimationFrame(loop);
  };
  const sync = () => {
    cancelAnimationFrame(raf); raf = 0; last = 0;
    if (!blocked()) { last = performance.now(); raf = requestAnimationFrame(loop); }
  };
  document.addEventListener('visibilitychange', sync);
  sync();
  return {
    setPaused(value: boolean) { paused = value; sync(); },
    dispose() {
      disposed = true; sync();
      document.removeEventListener('visibilitychange', sync);
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
