// 像素特效库：代替通用的「光带横扫」。每种特效有自己的形状、配色和节奏，
// 用能力的真实含义来画：火柱 / 冰刺 / 闪电链 / 地面冲击波 / 魂火 / 爆裂 / 治疗十字 / 增益箭头 / 装甲盾 / 箭雨。
// 约定与 pixel.ts 一致：1 个精灵像素 = 2 个舞台像素，画布以半分辨率绘制，CSS 放大且 image-rendering: pixelated。
// 只在有特效时跑 rAF，页面隐藏或暂停时停止；减少动态效果时只画静帧淡入。
import { STAGE_H, STAGE_W } from './dom';

export type VfxKind = 'fire' | 'ice' | 'bolt' | 'shock' | 'soul' | 'blast' | 'heal' | 'buff' | 'plate' | 'volley';
export interface Pt { x: number; y: number }
type Ctx = CanvasRenderingContext2D;

interface Eff { t0: number; dur: number; draw: (c: Ctx, t: number) => void }

const S = 2;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeBack = (t: number) => { const k = 1.70158, u = clamp(t) - 1; return 1 + (k + 1) * u * u * u + k * u * u; };
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

function hex(c: string): [number, number, number] {
  const v = c.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
/** f>0 向白提亮，f<0 向黑压暗 */
function shade(c: string, f: number) {
  const [r, g, b] = hex(c);
  const t = f > 0 ? 255 : 0, a = Math.abs(f);
  const m = (v: number) => Math.round(v + (t - v) * a).toString(16).padStart(2, '0');
  return `#${m(r)}${m(g)}${m(b)}`;
}

const px = (c: Ctx, x: number, y: number, col: string, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: string, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 400; n++) {
    px(c, x0 - (w >> 1), y0 - (w >> 1), col, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
/** 地面椭圆环：按角度步进的点阵，可抖动出虚线感 */
function ring(c: Ctx, cx: number, cy: number, rx: number, ry: number, col: string, th = 1, dash = 0) {
  const n = Math.max(24, Math.round(Math.PI * 2 * Math.max(rx, ry)));
  for (let i = 0; i < n; i++) {
    if (dash && (i % (dash * 2)) >= dash) continue;
    const a = (i / n) * Math.PI * 2;
    px(c, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, col, th, th);
  }
}
/** 抖动圆盘：a 为中心色，b 为边缘色，Bayer 渐变 */
function disc(c: Ctx, cx: number, cy: number, r: number, a: string, b: string, ry = r) {
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++)
    for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) {
      const d = Math.hypot(i / r, j / ry);
      if (d > 1) continue;
      const X = Math.round(cx + i), Y = Math.round(cy + j);
      px(c, X, Y, d + (bay(X, Y) - 0.5) * 0.5 < 0.55 ? a : b);
    }
}

/* ───────────── 火柱：自地面蹿起的三股火舌 + 飞溅火星 + 焦痕 ───────────── */
function fireCol(c: Ctx, cx: number, gy: number, H: number, hw0: number, t: number, ph: number) {
  const layers: [string, number][] = [['#7a1c14', 0], ['#d8431f', -1], ['#ff9a3c', -2], ['#ffd36b', -3.4], ['#fff2c0', -4.8]];
  for (let r = 0; r < H; r++) {
    const p = r / H;
    const wob = Math.sin(r * 0.55 + t / 70 + ph) * (0.6 + p * 1.4);
    const base = Math.pow(1 - p, 0.75) * hw0 + (r < 3 ? 1.2 : 0);
    for (const [col, off] of layers) {
      const w = Math.floor(base + off * (1 - p * 0.4));
      if (w < 0) continue;
      const x0 = Math.round(cx + wob - w), n = w * 2 + 1;
      // 外沿抖动，让火苗边缘碎一点
      for (let i = 0; i < n; i++) if (!(off === 0 && (i === 0 || i === n - 1) && bay(x0 + i, gy - r) > 0.5)) px(c, x0 + i, gy - r, col);
    }
  }
}
function fire(ts: Pt[], size: number): { dur: number; impact: number; build: (t0: number) => Eff } {
  const n = ts.length, L = 820;
  return {
    dur: L + n * 70, impact: 230,
    build: (t0) => {
      const R = rng(11 + n);
      const em = ts.map(() => Array.from({ length: 10 }, () => ({ dx: (R() - 0.5) * 16, sp: 26 + R() * 40, ph: R() * 6, del: R() * 280, hot: R() < 0.5 })));
      return {
        t0, dur: L + n * 70,
        draw: (c, T) => ts.forEach((p, i) => {
          const t = T - i * 70;
          if (t < 0 || t > L) return;
          const cx = Math.round(p.x / S), gy = Math.round((p.y + 38) / S);
          const grow = easeBack(t / 240), fade = clamp((L - t) / 260);
          const H = Math.max(2, Math.round(54 * size * grow * (0.7 + 0.3 * fade)));
          // 焦痕
          for (let k = 0; k < 56; k++) { const a = (k / 56) * 6.283; if (bay(k, i) < fade * 0.8) px(c, cx + Math.cos(a) * 18 * size, gy + 1 + Math.sin(a) * 4.4 * size, '#2a0c0c', 2, 1); }
          fireCol(c, cx - 8 * size, gy, Math.round(H * 0.6), 4.6 * size, t, i);
          fireCol(c, cx + 8 * size, gy, Math.round(H * 0.48), 4 * size, t, i + 2);
          fireCol(c, cx, gy, H, 8 * size, t, i + 4);
          for (const e of em[i]) {
            const lt = t - e.del;
            if (lt < 0 || lt > 520) continue;
            const y = gy - 8 - (lt / 1000) * e.sp, x = cx + e.dx + Math.sin(e.ph + lt / 140) * 2;
            if (bay(Math.round(x), Math.round(y)) < 1 - lt / 520) px(c, x, y, e.hot ? '#ffd36b' : '#ff6a2a', lt < 260 ? 2 : 1, lt < 260 ? 2 : 1);
          }
        }),
      };
    },
  };
}

/* ───────────── 冰刺：地面冰晶拔起，末尾碎成下落的冰屑 + 霜环 ───────────── */
function ice(ts: Pt[], size: number) {
  const n = ts.length, L = 900;
  return {
    dur: L + n * 80, impact: 200,
    build: (t0: number): Eff => {
      const R = rng(23 + n);
      const sp = ts.map(() => [-12, 0, 12, -6, 6].map((dx, k) => ({ dx, h: [22, 36, 26, 15, 18][k] + Math.round(R() * 5), w: k < 3 ? 9 : 6, d: k * 28 })));
      const shards = ts.map(() => Array.from({ length: 12 }, () => ({ dx: (R() - 0.5) * 22, dy: -R() * 18, vx: (R() - 0.5) * 22, vy: -R() * 14, c: R() < 0.5 ? '#d8f4ff' : '#8fd8ff' })));
      return {
        t0, dur: L + n * 80,
        draw: (c, T) => ts.forEach((p, i) => {
          const t = T - i * 80;
          if (t < 0 || t > L) return;
          const cx = Math.round(p.x / S), gy = Math.round((p.y + 38) / S);
          const out = clamp((t - 520) / 380);
          // 霜环
          const rr = (8 + easeOut(t / 360) * 28) * size;
          ring(c, cx, gy, rr, rr * 0.27, '#8fd8ff', 2, 2);
          ring(c, cx, gy, rr * 0.7, rr * 0.19, '#d8f4ff', 1, 3);
          for (const s of sp[i]) {
            const g = easeBack((t - s.d) / 200);
            if (g <= 0 || out > 0) continue;
            const H = Math.round(s.h * size * Math.min(1, g)), W = Math.max(3, Math.round(s.w * size));
            for (let r = 0; r < H; r++) {
              const half = Math.max(0, Math.ceil((W / 2) * (1 - r / H)));
              for (let k = -half; k <= half; k++) px(c, cx + s.dx * size + k, gy - r, k < 0 ? '#d8f4ff' : k === 0 ? '#8fd8ff' : '#4a8fd0');
              if (r % 5 === 2) px(c, cx + s.dx * size - 1, gy - r, '#ffffff');
            }
          }
          if (out > 0) for (const q of shards[i]) {
            const tt = out * 0.9;
            const X = cx + q.dx + q.vx * tt, Y = gy + q.dy + q.vy * tt + 40 * tt * tt;
            if (bay(Math.round(X), Math.round(Y)) < 1 - out) px(c, X, Y, q.c, 2, 2);
          }
          // 十字寒光
          if (t > 120 && t < 420) { const g = 1 - Math.abs(t - 270) / 150, y = gy - 18; px(c, cx - 4 * g, y, '#ffffff', Math.max(1, Math.round(8 * g))); px(c, cx, y - 4 * g, '#ffffff', 1, Math.max(1, Math.round(8 * g))); }
        }),
      };
    },
  };
}

/* ───────────── 闪电：从天而降的折线雷击，逐目标连环，目标之间以电弧相连 ───────────── */
function bolt(ts: Pt[], _from: Pt | null, color: string) {
  const L = 420 + ts.length * 90;
  return {
    dur: L, impact: 110,
    build: (t0: number): Eff => ({
      t0, dur: L,
      draw: (c, T) => {
        const frame = Math.floor(T / 60);
        ts.forEach((p, i) => {
          const t = T - i * 90;
          if (t < 0 || t > 340) return;
          if (t > 180 && frame % 3 === 2) return; // 余辉闪烁
          const R = rng(frame * 131 + i * 17 + 3);
          const hx = Math.round(p.x / S), hy = Math.round((p.y + 34) / S);
          let x = hx + (R() - 0.5) * 20, y = -6;
          while (y < hy) {
            const ny = Math.min(hy, y + 7 + R() * 7);
            const nx = ny >= hy ? hx : x + (R() - 0.5) * 14 + (hx - x) * 0.25;
            line(c, x, y, nx, ny, shade(color, -0.35), 5);
            line(c, x, y, nx, ny, shade(color, 0.45), 3);
            line(c, x, y, nx, ny, '#ffffff', 1);
            if (R() < 0.3) line(c, nx, ny, nx + (R() - 0.5) * 22, ny + 6 + R() * 8, shade(color, 0.3), 1);
            x = nx; y = ny;
          }
          // 落点：抖动星团 + 十字电光 + 地面焦环
          const g = clamp(1 - t / 340);
          disc(c, hx, hy - 4, 5 + 7 * g, '#ffffff', shade(color, 0.35), (5 + 7 * g) * 0.8);
          px(c, hx - 11, hy - 4, '#ffffff', 23, 1); px(c, hx, hy - 15, '#ffffff', 1, 23);
          ring(c, hx, hy + 1, 9 + 7 * (1 - g), 3 + 2 * (1 - g), shade(color, -0.3), 1, 0);
          // 电弧：从上一个目标的头部拉到这个目标
          if (i > 0 && t < 220) {
            const q = ts[i - 1], ax = q.x / S, ay = (q.y - 20) / S, bx = p.x / S, by = (p.y - 20) / S;
            let lx = ax, ly = ay;
            for (let k = 1; k <= 7; k++) {
              const f = k / 7, X = ax + (bx - ax) * f, Y = ay + (by - ay) * f + (k === 7 ? 0 : (R() - 0.5) * 14 - Math.sin(f * 3.14) * 8);
              line(c, lx, ly, X, Y, shade(color, 0.4), 2); line(c, lx, ly, X, Y, '#ffffff', 1); lx = X; ly = Y;
            }
          }
        });
      },
    }),
  };
}

/* ───────────── 地面冲击波：厚实的椭圆环从施放者向外推，地面被掀起裂纹与尘柱 ───────────── */
function shock(ts: Pt[], from: Pt | null, color: string) {
  const L = 820;
  const ox = from ? from.x : ts.reduce((s, p) => s + p.x, 0) / ts.length, oy = (from ?? ts[0]).y + 38;
  const far = Math.max(...ts.map((p) => Math.abs(p.x - ox)), 120) + 60;
  return {
    dur: L, impact: Math.min(320, 110 + far * 0.33),
    build: (t0: number): Eff => {
      const R = rng(41);
      const dust = ts.map(() => Array.from({ length: 12 }, () => ({ dx: (R() - 0.5) * 30, up: 14 + R() * 26, s: 3 + Math.round(R() * 3), ph: R() })));
      const cracks = ts.map(() => Array.from({ length: 6 }, () => ({ a: R() * 6.283, l: 7 + R() * 11 })));
      return {
        t0, dur: L,
        draw: (c, T) => {
          const f = easeOut(T / 560), rx = (10 + f * far) / S, cx = Math.round(ox / S), cy = Math.round(oy / S);
          const fade = clamp((L - T) / 260);
          if (fade <= 0) return;
          // 环内地面微光（抖动）
          if (T < 600) for (let j = -Math.round(rx * 0.3); j <= Math.round(rx * 0.3); j += 2) for (let i = -Math.round(rx); i <= Math.round(rx); i += 2) {
            const d = Math.hypot(i / rx, j / (rx * 0.3)); if (d > 1 || d < 0.55) continue;
            if (bay(cx + i, cy + j) < 0.22 * fade * (d - 0.5)) px(c, cx + i, cy + j, shade(color, -0.4), 2, 1);
          }
          // 厚环：外亮内暗 5 层
          const bands = ['#ffffff', shade(color, 0.6), color, shade(color, -0.3), shade(color, -0.55)];
          bands.forEach((col, k) => { const r = rx - k * 1.8; if (r > 4) ring(c, cx, cy, r, r * 0.27, col, 2, k === 4 ? 2 : 0); });
          ts.forEach((p, i) => {
            const d = Math.abs(p.x - ox) / S, t = T - (d / (far / S)) * 560;
            if (t < 0 || t > 520) return;
            const x = Math.round(p.x / S), y = Math.round((p.y + 38) / S), g = 1 - t / 520;
            for (const q of cracks[i]) line(c, x, y, x + Math.cos(q.a) * q.l, y + Math.sin(q.a) * q.l * 0.3, shade(color, -0.6), 1);
            for (const q of dust[i]) {
              const yy = y - easeOut(t / 420) * q.up, s = Math.max(1, Math.round(q.s * (0.4 + g * 0.6)));
              px(c, x + q.dx, yy, shade(color, 0.45), s, s);
              px(c, x + q.dx, yy + s, shade(color, -0.25), s, 1);
              px(c, x + q.dx - 1, yy - 1, '#ffffff', 1, 1);
            }
          });
        },
      };
    },
  };
}

/* ───────────── 魂火：幽灵状火焰沿 S 形路线升起，地面暗环 ───────────── */
function soul(ts: Pt[], color: string) {
  const n = ts.length, L = 1100;
  return {
    dur: L + n * 70, impact: 300,
    build: (t0: number): Eff => {
      const R = rng(57 + n);
      const w = ts.map(() => Array.from({ length: 5 }, (_, k) => ({ dx: (k - 2) * 8, del: k * 100 + R() * 60, ph: R() * 6, sp: 46 + R() * 26 })));
      return {
        t0, dur: L + n * 70,
        draw: (c, T) => ts.forEach((p, i) => {
          const t = T - i * 70;
          if (t < 0 || t > L) return;
          const cx = Math.round(p.x / S), gy = Math.round((p.y + 38) / S), fade = clamp((L - t) / 320);
          const rr = 7 + easeOut(t / 500) * 20;
          ring(c, cx, gy, rr, rr * 0.27, shade(color, -0.6), 2, 0);
          ring(c, cx, gy, rr * 0.6, rr * 0.16, shade(color, -0.3), 1, 3);
          for (const q of w[i]) {
            const lt = t - q.del;
            if (lt < 0) continue;
            const y = gy - 8 - (lt / 1000) * q.sp, x = cx + q.dx + Math.sin(q.ph + lt / 150) * 4.5, a = Math.min(1, lt / 120) * fade;
            if (a <= 0.05) continue;
            const rows: [number, string][] = [[4, shade(color, 0.75)], [7, shade(color, 0.45)], [8, color], [8, color], [7, color], [6, shade(color, -0.2)], [4, shade(color, -0.35)], [3, shade(color, -0.5)], [2, shade(color, -0.6)], [1, shade(color, -0.65)]];
            rows.forEach(([ww, col], r) => { for (let k = 0; k < ww; k++) if (bay(Math.round(x) + k, Math.round(y) + r) < a + 0.2) px(c, x - ww / 2 + k, y + r, col); });
            px(c, x - 2.5, y + 2, '#1a0a2a', 2, 3); px(c, x + 1.5, y + 2, '#1a0a2a', 2, 3); px(c, x - 1, y + 6, '#1a0a2a', 2, 1);
          }
        }),
      };
    },
  };
}

/* ───────────── 爆裂：多瓣抖动火球（红-橙-黄-白）+ 上浮烟环 + 放射火星 ───────────── */
function blast(ts: Pt[], color: string, size: number) {
  const L = 700;
  return {
    dur: L + ts.length * 40, impact: 160,
    build: (t0: number): Eff => {
      const R = rng(71);
      const lobes = ts.map(() => Array.from({ length: 6 }, () => ({ a: R() * 6.283, d: 3 + R() * 8, r: 6 + R() * 6 })));
      const bits = ts.map(() => Array.from({ length: 14 }, () => ({ a: R() * 6.283, v: 26 + R() * 40 })));
      const red = shade(color, -0.35), hot = shade(color, 0.7);
      return {
        t0, dur: L + ts.length * 40,
        draw: (c, T) => ts.forEach((p, i) => {
          const t = T - i * 40;
          if (t < 0 || t > L) return;
          const cx = Math.round(p.x / S), cy = Math.round((p.y - 6) / S), g = easeOut(t / 240), fade = clamp((L - t) / 320);
          if (t < 360) {
            const k = (0.35 + g * 0.65) * size, shrink = clamp((360 - t) / 200);
            // 外层红 → 中层橙 → 内层亮 → 白热核心
            for (const l of lobes[i]) disc(c, cx + Math.cos(l.a) * l.d * k, cy + Math.sin(l.a) * l.d * k * 0.8, l.r * k * shrink, color, red);
            disc(c, cx, cy, 13 * k * shrink, hot, color);
            if (t < 150) disc(c, cx, cy, 7 * k, '#ffffff', hot);
          }
          // 烟环：暗色抖动点向上漂
          if (t > 120) for (let q = 0; q < 18; q++) {
            const a = q * 0.349, rr = (10 + easeOut((t - 120) / 500) * 16) * size;
            if (bay(q * 3, Math.round(t / 50)) < fade * 0.8) px(c, cx + Math.cos(a) * rr, cy - 6 - (t - 120) / 28 + Math.sin(a) * rr * 0.45, shade(color, -0.7), 3, 2);
          }
          if (t > 60) ring(c, cx, cy + 8, (5 + easeOut((t - 60) / 400) * 30) * size, (5 + easeOut((t - 60) / 400) * 30) * size * 0.3, hot, 1, 0);
          for (const b of bits[i]) { const tt = t / 1000; if (bay(Math.round(b.a * 9), Math.round(t / 40)) < fade) px(c, cx + Math.cos(b.a) * b.v * tt * size, cy + Math.sin(b.a) * b.v * tt * size + 30 * tt * tt, b.a > 3 ? hot : color, 2, 2); }
        }),
      };
    },
  };
}

/* ───────────── 治疗：粗体十字光点升起 + 脉冲环 ───────────── */
const PLUS = ['..###..', '..###..', '#######', '#######', '#######', '..###..', '..###..'];
function heal(ts: Pt[], color: string) {
  const n = ts.length, L = 1000;
  return {
    dur: L + n * 60, impact: 200,
    build: (t0: number): Eff => {
      const R = rng(89 + n);
      const pl = ts.map(() => Array.from({ length: 4 }, (_, k) => ({ dx: (k - 1.5) * 11 + (R() - 0.5) * 3, del: k * 100 + R() * 40, sp: 42 + R() * 18, ph: R() * 6 })));
      return {
        t0, dur: L + n * 60,
        draw: (c, T) => ts.forEach((p, i) => {
          const t = T - i * 60;
          if (t < 0 || t > L) return;
          const cx = Math.round(p.x / S), gy = Math.round((p.y + 38) / S), fade = clamp((L - t) / 300);
          const rr = 7 + easeOut(t / 420) * 19;
          ring(c, cx, gy, rr, rr * 0.27, shade(color, -0.1), 2, 0);
          ring(c, cx, gy, rr * 0.62, rr * 0.17, shade(color, 0.5), 1, 2);
          for (const q of pl[i]) {
            const lt = t - q.del;
            if (lt < 0) continue;
            const y = gy - 10 - (lt / 1000) * q.sp, x = cx + q.dx + Math.sin(q.ph + lt / 200) * 2;
            if (fade <= 0.05 || bay(Math.round(x), Math.round(y)) > fade + 0.15) continue;
            PLUS.forEach((row, ry) => [...row].forEach((ch, rx) => {
              if (ch !== '#') return;
              const core = rx >= 2 && rx <= 4 && ry >= 2 && ry <= 4;
              px(c, x - 3 + rx, y - 3 + ry, core ? (rx === 3 && ry === 3 ? '#ffffff' : shade(color, 0.6)) : lt % 260 < 130 ? color : shade(color, 0.25));
            }));
            px(c, x - 4, y + 4, shade(color, -0.4), 9, 1);
          }
        }),
      };
    },
  };
}

/* ───────────── 增益：三层粗体上升箭头 + 光环 ───────────── */
function buff(ts: Pt[], color: string) {
  const n = ts.length, L = 860;
  return {
    dur: L + n * 60, impact: 190,
    build: (t0: number): Eff => ({
      t0, dur: L + n * 60,
      draw: (c, T) => ts.forEach((p, i) => {
        const t = T - i * 60;
        if (t < 0 || t > L) return;
        const cx = Math.round(p.x / S), gy = Math.round((p.y + 38) / S), fade = clamp((L - t) / 280);
        const rr = 8 + easeOut(t / 300) * 16;
        ring(c, cx, gy, rr, rr * 0.27, color, 2, 0);
        ring(c, cx, gy, rr * 0.6, rr * 0.16, shade(color, 0.5), 1, 2);
        for (let k = 0; k < 3; k++) {
          const lt = t - k * 120;
          if (lt < 0) continue;
          const y = gy - 8 - (lt / 1000) * 62, a = fade * Math.min(1, lt / 90);
          if (a < 0.08) continue;
          for (let r = 0; r < 6; r++) for (const sgn of [-1, 1]) {
            const x = cx + sgn * (9 - r * 1.3);
            if (bay(Math.round(x), Math.round(y) + r) > a + 0.25) continue;
            px(c, x - 1, y + r + 1, shade(color, -0.45), 3, 2);
            px(c, x - 1, y + r, r < 2 ? '#ffffff' : color, 3, 2);
          }
          px(c, cx - 1, y - 2, '#ffffff', 3, 3);
        }
      }),
    }),
  };
}

/* ───────────── 装甲：八角盾徽拍上目标，碎片向内收拢，铆钉闪光 ───────────── */
function plate(ts: Pt[], color: string) {
  const n = ts.length, L = 820;
  return {
    dur: L + n * 50, impact: 150,
    build: (t0: number): Eff => ({
      t0, dur: L + n * 50,
      draw: (c, T) => ts.forEach((p, i) => {
        const t = T - i * 50;
        if (t < 0 || t > L) return;
        const cx = Math.round(p.x / S), cy = Math.round((p.y - 6) / S), fade = clamp((L - t) / 260);
        const conv = easeOut(t / 180);
        if (t < 240) for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.283 + 0.4, r = 15 + (1 - conv) * 22; px(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, k % 2 ? '#cfd8e8' : color, 3, 3); }
        const sc = easeBack((t - 90) / 170);
        if (sc <= 0) return;
        const R = 15 * Math.min(1, sc);
        for (let j = -16; j <= 16; j++) for (let k = -16; k <= 16; k++) {
          const d = Math.max(Math.abs(k), Math.abs(j), (Math.abs(k) + Math.abs(j)) * 0.72);
          if (d > R) continue;
          if (bay(cx + k, cy + j) > fade + 0.15) continue;
          px(c, cx + k, cy + j, d > R - 1.6 ? '#eef4ff' : d > R - 3.4 ? '#7f93b5' : k + j < -5 ? shade(color, 0.35) : color);
        }
        if (fade > 0.3) {
          px(c, cx - 2, cy - 7, '#ffd36b', 5, 12); px(c, cx - 7, cy - 2, '#ffd36b', 15, 5);
          px(c, cx - 1, cy - 6, '#fff2c0', 3, 10);
          for (const [sx, sy] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) px(c, cx + sx - 1, cy + sy - 1, T % 160 < 80 ? '#fff2c0' : '#ffd36b', 3, 3);
        }
      }),
    }),
  };
}

/* ───────────── 箭雨：斜向落下的粗箭，落点溅起尘点与插入的箭杆 ───────────── */
function volley(ts: Pt[], color: string) {
  const L = 640 + ts.length * 60;
  return {
    dur: L, impact: 210,
    build: (t0: number): Eff => ({
      t0, dur: L,
      draw: (c, T) => ts.forEach((p, i) => {
        const t = T - i * 60, A = 220;
        if (t < 0 || t > A + 420) return;
        const tx = p.x / S, ty = (p.y + 16) / S;
        for (let k = 0; k < 3; k++) {
          const tk = t - k * 45;
          if (tk < 0) continue;
          const f = Math.min(1, tk / A), ex = tx + (k - 1) * 6, ey = ty + (k % 2) * 3;
          const sx = ex + 30, sy = ey - 70;
          const hx = sx + (ex - sx) * f, hy = sy + (ey - sy) * f;
          if (f < 1) {
            const lx = hx + 10, ly = hy - 26;
            line(c, hx, hy, lx, ly, shade(color, -0.4), 3);
            line(c, hx, hy, lx, ly, color, 1);
            px(c, hx - 2, hy - 1, '#ffffff', 5, 5);
            line(c, lx, ly, lx - 4, ly + 1, shade(color, 0.5), 2); line(c, lx, ly, lx + 1, ly + 5, shade(color, 0.5), 2);
          } else {
            const g = (tk - A) / 420;
            if (g < 1) {
              line(c, ex, ey, ex + 6 * (1 - g * 0.3), ey - 18 * (1 - g * 0.5), shade(color, -0.2), 2);
              for (let q = 0; q < 6; q++) { const a = q * 1.05; px(c, ex + Math.cos(a) * 12 * g, ey - 1 - Math.abs(Math.sin(a)) * 10 * g, shade(color, 0.4), 2, 2); }
            }
          }
        }
      }),
    }),
  };
}

export class PixelVFX {
  readonly canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private effs: Eff[] = [];
  private raf = 0;
  private last = 0;
  private paused = false;
  private disposed = false;
  private playbackRate = 1;
  // 所有效果共享冻结的逻辑时钟，暂停、页面隐藏和临时慢放均保留当前帧进度。
  private time = 0;
  private clockAt = performance.now();
  private clockRunning = !document.hidden;
  private motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  get rate() { return this.playbackRate; }
  set rate(value: number) { this.advance(); this.playbackRate = Math.max(0.1, value); }

  constructor(root: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'vfx-canvas';
    root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    document.addEventListener('visibilitychange', this.vis);
  }

  resize() {
    this.canvas.width = Math.round(STAGE_W / S);
    this.canvas.height = Math.round(STAGE_H / S);
    this.canvas.style.height = `${STAGE_H}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  private get blocked() { return this.paused || document.hidden || this.disposed; }
  private advance() {
    const now = performance.now();
    if (this.clockRunning) this.time += Math.max(0, now - this.clockAt) * this.rate;
    this.clockAt = now;
    return this.time;
  }
  private syncPause() {
    this.advance();
    this.clockRunning = !this.blocked;
    if (this.blocked) this.stopLoop(); else this.kick();
  }
  private vis = () => this.syncPause();
  setPaused(p: boolean) { this.paused = p; this.syncPause(); }

  /** 铺开一次范围特效，返回「命中时刻」（毫秒，已按倍速折算），调用方等这么久再结算数值 */
  area(kind: VfxKind, o: { targets: Pt[]; from?: Pt | null; color?: string; size?: number }): number {
    const ts = o.targets.slice(0, 8);
    if (!ts.length || this.blocked) return 0;
    // 减少动态效果时各目标共用一张静帧，消除逐目标错帧造成的后排缺席。
    if (this.motion?.matches && ts.length > 1) return Math.max(...ts.map(p => this.area(kind, { ...o, targets: [p] })));
    const size = o.size ?? 1;
    const col = o.color ?? '#ffffff';
    let spec: { dur: number; impact: number; build: (t0: number) => Eff };
    switch (kind) {
      case 'fire': spec = fire(ts, size); break;
      case 'ice': spec = ice(ts, size); break;
      case 'bolt': { const b = bolt(ts, o.from ?? null, o.color ?? '#9fe8ff'); spec = b; break; }
      case 'shock': { const s = shock(ts, o.from ?? null, o.color ?? '#ffd36b'); spec = s; break; }
      case 'soul': spec = soul(ts, o.color ?? '#b06bff'); break;
      case 'blast': spec = blast(ts, o.color ?? '#ff9a3c', size); break;
      case 'heal': spec = heal(ts, o.color ?? '#7dffb0'); break;
      case 'buff': spec = buff(ts, col === '#ffffff' ? '#ffd36b' : col); break;
      case 'plate': spec = plate(ts, o.color ?? '#9fb4d8'); break;
      case 'volley': spec = volley(ts, o.color ?? '#e8e8ff'); break;
    }
    const e = spec.build(this.advance());
    e.dur = spec.dur;
    this.effs.push(e);
    this.kick();
    return spec.impact / this.rate;
  }

  /** 单点特效（单体伤害、状态结算） */
  at(kind: VfxKind, p: Pt, color?: string, size = 0.7): number { return this.area(kind, { targets: [p], color, size }); }

  clear() { this.effs = []; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.stopLoop(); }
  dispose() { this.disposed = true; this.clockRunning = false; this.clear(); document.removeEventListener('visibilitychange', this.vis); this.canvas.remove(); }

  private stopLoop() { cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0; }
  private kick() { if (!this.raf && !this.paused && !this.disposed && !document.hidden && this.effs.length) this.raf = requestAnimationFrame(this.loop); }
  private loop = (now: number) => {
    this.raf = 0;
    if (this.blocked) { this.syncPause(); return; }
    if (this.last && now - this.last < 1000 / 30 - 1) { this.raf = requestAnimationFrame(this.loop); return; }
    this.last = now;
    const c = this.ctx;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const t = this.advance();
    this.effs = this.effs.filter((e) => t - e.t0 < e.dur);
    for (const e of this.effs) {
      const T = t - e.t0;
      // 减少动态效果：不播放运动，只在中段给一帧静态定格
      e.draw(c, this.motion?.matches ? Math.min(e.dur * 0.35, 260) : T);
    }
    if (this.effs.length) this.raf = requestAnimationFrame(this.loop);
    else { this.last = 0; c.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  };
}

/** 按「施放者能力 + 事件类型 + 阵营」挑特效：用能力的真实含义，而不是一律光带 */
const BY_AB: Record<string, VfxKind> = {
  // 余烬
  ash_sprite: 'fire', ash_wick: 'fire', ash_pyre: 'fire', ash_regent: 'fire', ash_phoenix: 'fire', ash_flash: 'blast',
  ash_frost: 'ice', ash_rime: 'ice', ash_cryo: 'ice', ash_glass: 'ice', ash_brand: 'blast',
  // 铁壁
  iron_toll: 'shock', iron_piston: 'shock', iron_colossus: 'shock', iron_mirror: 'plate', iron_overseer: 'plate', iron_rivet: 'plate',
  iron_ward: 'plate', iron_smith: 'plate', iron_conduit: 'plate', iron_marshal: 'plate', iron_lastwall: 'plate',
  // 既有卡
  anvil: 'shock', elephant: 'shock', hedgehog: 'soul', badger: 'blast', deer: 'blast', mosquito: 'volley', croc: 'volley',
  dolphin: 'volley', skunk: 'bolt', snake: 'bolt', rhino: 'shock', mammoth: 'soul', idol: 'buff',
};
const BY_FACTION: Record<string, VfxKind> = { magma: 'fire', frost: 'ice', abyss: 'soul', shadow: 'bolt', light: 'shock', desert: 'blast', neutral: 'blast', enemy: 'blast' };
const BY_ARCHETYPE: Record<string, VfxKind> = {
  wheel: 'shock', charge: 'blast', ember: 'fire', nest: 'shock', blood: 'soul',
  trade: 'volley', rune: 'bolt', pair: 'volley', hunt: 'volley', formation: 'shock', supply: 'blast',
};
export interface VfxSource { archetype?: string; label?: string; effect?: string; support?: boolean }

export function vfxFor(ab: string | undefined, faction: string | undefined, evType: string, dmgKind?: string, source: VfxSource = {}): VfxKind {
  if (evType === 'heal') return 'heal';
  if (evType === 'block') return 'plate';
  if (dmgKind === 'burn') return 'fire';
  if (evType === 'buff' || evType === 'kw') return source.effect === 'inherit' ? 'soul' : 'buff';
  // 规则触发的显式来源优先：传承技能、装备和遗物均保留自己的视觉语义。
  if (/冰|霜|寒/.test(source.label ?? '')) return 'ice';
  if (/雷|电|风暴/.test(source.label ?? '')) return 'bolt';
  if (/炮|火药|爆/.test(source.label ?? '') || source.effect === 'release') return 'blast';
  if (/箭|弩|齐射|贯日/.test(source.label ?? '')) return 'volley';
  if (source.effect === 'detonate') return 'soul';
  if (ab && BY_AB[ab] && evType === 'dmg') return BY_AB[ab];
  if (dmgKind === 'splash') return 'blast';
  if (source.archetype && BY_ARCHETYPE[source.archetype]) return BY_ARCHETYPE[source.archetype];
  if (source.support) return 'blast';
  return (faction && BY_FACTION[faction]) || 'blast';
}
