import { h, STAGE_H, STAGE_W } from './dom';

interface P {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  size: number; color: string; kind: 'spark' | 'shard' | 'mote' | 'ring' | 'plus'; rot: number; vr: number; g: number;
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

  /** 漂浮文字（伤害、加成、落空提示） */
  float(x: number, y: number, text: string, cls: string, dur = 900) {
    const el = h('div', { class: `float ${cls}`, style: `left:${x}px;top:${y}px` }, text);
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
        const damping = Math.pow(0.96, step);
        p.vx *= damping; p.vy *= damping; p.rot += p.vr * step;
        remaining -= step;
      }
      c.globalAlpha = Math.min(1, t * 1.6);
      // 像素风：所有粒子都是贴 2px 网格的方块
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
