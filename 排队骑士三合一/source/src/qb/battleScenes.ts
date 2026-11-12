// 战斗场景背景：7 张程序化像素动画背景（320×180，放大 4 倍，pixelated），与 pixel.ts 的 backdrop 同一套手法：
// Bayer 抖动色带、2 像素台阶的山脊、亮边。每张图的静态层只画一次（烘焙到离屏画布），
// 动态层（粒子 / 极光 / 熔岩 / 齿轮 / 雾）以 ~12fps 重画，页面隐藏或暂停时停止。
// 构图原则：画面中段（单位站位带，约第 40-100 行）保持低对比度，亮部与细节放在上下与左右边缘，不抢单位的戏。

import './css/battle-scenes.css';

export type SceneId = 'moor' | 'ember' | 'frost' | 'crypt' | 'hive' | 'foundry' | 'abyss';
export const SCENE_NAMES: Record<SceneId, string> = { moor: '月夜荒原', ember: '熔岩地窟', frost: '霜原极光', crypt: '墓穴回廊', hive: '幽暗巢穴', foundry: '齿轮铸坊', abyss: '星坠深渊' };

const W = 320, H = 180;
type RGB = [number, number, number];
const rgbCache = new Map<string, RGB>();
function rgb(h: string): RGB {
  let v = rgbCache.get(h);
  if (!v) { const s = h.replace('#', ''); v = [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; rgbCache.set(h, v); }
  return v;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(x: number, y: number, s: number) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise(x: number, y: number, s = 1) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number, s = 1) => noise(x, y, s) * 0.55 + noise(x * 2.1, y * 2.1, s + 7) * 0.3 + noise(x * 4.3, y * 4.3, s + 13) * 0.15;

class Buf {
  d = new Uint8ClampedArray(W * H * 4);
  clear() { this.d.fill(0); }
  set(x: number, y: number, col: string | RGB, a = 255) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4, c = typeof col === 'string' ? rgb(col) : col;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a;
  }
  rect(x: number, y: number, w: number, h: number, col: string, a = 255) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col, a); }
  /** 抖动叠加：按 Bayer 概率画点，模拟半透明 */
  dot(x: number, y: number, col: string, p: number) { x = Math.floor(x); y = Math.floor(y); if (bay(x, y) < p) this.set(x, y, col); }
}

/** 抖动渐变天空 + 可选光晕（与 backdrop() 同法） */
function sky(b: Buf, bands: string[], o: { gx?: number; gy?: number; gr?: number; gk?: number; k?: number; to?: number } = {}) {
  const to = o.to ?? H;
  for (let j = 0; j < to; j++) for (let i = 0; i < W; i++) {
    const glow = o.gr ? Math.max(0, 1 - Math.hypot((i - (o.gx ?? 160)) / o.gr, (j - (o.gy ?? 80)) / (o.gr * 0.4))) : 0;
    const v = Math.min(bands.length - 1, (j / to) * (o.k ?? bands.length - 1.5) + glow * (o.gk ?? 2) + bay(i, j) - 0.5);
    b.set(i, j, bands[Math.max(0, Math.floor(v))]);
  }
}
/** 2 像素台阶山脊，带亮边 */
function ridge(b: Buf, base: number, amp: number, f: number, ph: number, fill: [string, string], rim: string, to = H) {
  const fn = (j: number) => base - amp * (0.55 * Math.abs(Math.sin(j * f + ph)) + 0.3 * Math.abs(Math.sin(j * f * 2.3 + ph * 1.7)) + 0.06 * Math.sin(j * f * 5.1));
  for (let i = 0; i < W; i++) {
    const top = Math.round(fn(i - (i % 2))), prev = Math.round(fn(i - 2 - (i % 2)));
    for (let j = top; j < to; j++) {
      const lit = j - top < 1 || (j - top < 2 && prev > top);
      const depth = (j - top) / 40 + bay(i, j) * 0.6 - 0.3;
      b.set(i, j, lit ? rim : fill[depth > 0.4 ? 1 : 0]);
    }
  }
}
function disc(b: Buf, cx: number, cy: number, r: number, a: string, c: string, ry = r) {
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) {
    const d = Math.hypot(i / r, j / ry); if (d > 1) continue;
    b.set(cx + i, cy + j, d + (bay(cx + i, cy + j) - 0.5) * 0.45 < 0.55 ? a : c);
  }
}
/** 软光斑：按距离抖动叠色（烛火、灯、岩浆辉光） */
function glow(b: Buf, cx: number, cy: number, r: number, col: string, k = 0.5, ry = r) {
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) {
    const d = Math.hypot(i / r, j / ry); if (d > 1) continue;
    b.dot(cx + i, cy + j, col, (1 - d) * (1 - d) * k * 2);
  }
}
function stars(n: number, seed: number, maxY: number, avoid?: (x: number, y: number) => boolean) {
  const R = rng(seed); const out: { x: number; y: number; big: boolean; ph: number; warm: boolean }[] = [];
  for (let k = 0; k < n; k++) {
    const x = Math.floor(R() * W), y = Math.floor(R() * maxY), big = R() < 0.12, warm = R() < 0.3;
    if (avoid?.(x, y)) continue;
    out.push({ x, y, big, ph: R() * 6, warm });
  }
  return out;
}
function drawStars(b: Buf, st: ReturnType<typeof stars>, t: number, tw = true) {
  for (const s of st) {
    const on = !tw || Math.sin(t * 1.6 + s.ph) > -0.5;
    if (!on) continue;
    b.set(s.x, s.y, s.warm ? '#ffe2a6' : '#cfd2ff');
    if (s.big && Math.sin(t * 1.6 + s.ph) > 0.3) { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) b.set(s.x + dx, s.y + dy, '#6a6aa8'); }
  }
}

interface Scene { bake(b: Buf): void; frame(b: Buf, t: number): void }

/* ═══════════ 1. 月夜荒原：沿用既有夜空，加漂移云、萤火、地面薄雾 ═══════════ */
function moor(): Scene {
  const st = stars(80, 7, 60, (x, y) => Math.hypot(x - 262, y - 30) < 24);
  const R = rng(5);
  const fl = Array.from({ length: 18 }, () => ({ x: R() * W, y: 112 + R() * 60, ph: R() * 6, sp: 0.3 + R() * 0.5 }));
  return {
    bake(b) {
      sky(b, ['#07071c', '#0b0b28', '#111036', '#171444', '#1f1750', '#2a1a5c', '#331d5e'], { gx: 160, gy: 70, gr: 150, gk: 2.2, k: 4.2, to: 120 });
      for (let j = -30; j <= 30; j++) for (let i = -30; i <= 30; i++) {
        const d = Math.hypot(i, j), X = 262 + i, Y = 30 + j;
        if (d <= 9) { if (Math.hypot(i - 4, j + 3) < 7.5) continue; b.set(X, Y, d > 8 ? '#d8b784' : i < -3 && j < 3 ? '#fff6dc' : '#f4ddb0'); }
        else if (d < 20 && bay(X, Y) < (1 - (d - 9) / 11) * 0.4) b.set(X, Y, d < 13 ? '#4a3270' : '#2e2060');
      }
      ridge(b, 92, 30, 0.021, 0.6, ['#1d1850', '#17133f'], '#3d3388');
      ridge(b, 104, 20, 0.034, 2.2, ['#141136', '#100d2c'], '#2c2668');
      ridge(b, 116, 12, 0.05, 4.1, ['#0c0a22', '#09081b'], '#1f1b4a');
      for (let j = 118; j < H; j++) for (let i = 0; i < W; i++) b.set(i, j, bay(i, j) < (j - 118) / 30 ? '#06061a' : '#0a0a24');
      // 墓碑剪影
      const G = rng(21);
      for (let k = 0; k < 9; k++) { const x = 8 + k * 36 + Math.floor(G() * 14), y = 132 + Math.floor(G() * 30), w = 6 + Math.floor(G() * 3), h = 8 + Math.floor(G() * 6); b.rect(x, y - h, w, h, '#0d0b26'); b.rect(x, y - h, w, 1, '#262060'); b.rect(x + 1, y - h - 1, w - 2, 1, '#0d0b26'); }
    },
    frame(b, t) {
      drawStars(b, st, t);
      // 云：横向漂移的抖动长条
      for (const [y0, sp, a] of [[24, 4, 0.5], [46, 7, 0.4], [64, 3, 0.35]] as const) for (let i = 0; i < W; i++) {
        const v = fbm((i + t * sp) * 0.03, y0 * 0.2, 3);
        if (v > 0.55) for (let k = 0; k < 3; k++) b.dot(i, y0 + k + Math.floor(Math.sin(i * 0.1) * 1.5), v > 0.65 ? '#3a2d78' : '#2a2262', a);
      }
      // 地面薄雾
      for (let j = 128; j < 150; j++) for (let i = 0; i < W; i += 1) { const v = fbm((i + t * 6) * 0.025, j * 0.12, 9); if (v > 0.52) b.dot(i, j, '#2b2a66', (v - 0.5) * 1.1); }
      for (const f of fl) { const x = f.x + Math.sin(t * f.sp + f.ph) * 12, y = f.y + Math.cos(t * f.sp * 1.3 + f.ph) * 6; if (Math.sin(t * 2 + f.ph) > -0.2) { b.set(x, y, '#ffe9a0'); b.dot(x + 1, y, '#a89040', 0.6); b.dot(x - 1, y, '#a89040', 0.6); } }
    },
  };
}

/* ═══════════ 2. 熔岩地窟：火山、发光裂隙、流动岩浆、升腾火星 ═══════════ */
function ember(): Scene {
  const R = rng(31);
  const em = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * H, vy: 5 + R() * 14, ph: R() * 6, hot: R() < 0.5 }));
  const LAVA = ['#4a0f0a', '#7a1c0c', '#b0360f', '#e06a1c', '#ff9a3c', '#ffd36b'];
  const rock = new Uint8Array(W * H);
  return {
    bake(b) {
      sky(b, ['#0a0410', '#14061a', '#220a1c', '#34101c', '#4c1a1a', '#6a2a1a'], { gx: 160, gy: 100, gr: 170, gk: 2.4, k: 4.4, to: 120 });
      // 远火山 ×2，口部发光
      for (const [cx, base, w, h] of [[70, 112, 70, 46], [252, 114, 82, 56]] as const) {
        for (let i = -w; i <= w; i++) { const top = base - Math.round(h * Math.pow(1 - Math.abs(i) / w, 1.15)) + (i % 2 ? 0 : 1); for (let j = top; j < base + 10; j++) b.set(cx + i, j, bay(cx + i, j) < 0.25 ? '#1c0a14' : '#14060f'); b.set(cx + i, top, '#5a2218'); }
        for (let i = -6; i <= 6; i++) b.set(cx + i, base - h, bay(cx + i, base - h) < 0.6 ? '#ff7a2a' : '#c4501a');
        glow(b, cx, base - h, 18, '#ff6a2a', 0.5, 10);
      }
      ridge(b, 108, 16, 0.05, 1.3, ['#1a0a12', '#12070d'], '#4a1c18', 120);
      // 岩岛掩码：fbm 阈值，之外是岩浆
      for (let j = 108; j < H; j++) for (let i = 0; i < W; i++) rock[j * W + i] = fbm(i * 0.035, (j - 100) * 0.07, 4) > 0.56 - (j - 108) * 0.0016 ? 1 : 0;
      for (let j = 108; j < H; j++) for (let i = 0; i < W; i++) if (rock[j * W + i]) {
        const edge = !rock[j * W + i - 1] || !rock[(j - 1) * W + i];
        b.set(i, j, edge ? '#5a2418' : bay(i, j) < 0.3 ? '#1e0c12' : '#150910');
      }
    },
    frame(b, t) {
      // 岩浆：用正弦+噪声推色阶，向右缓慢流
      for (let j = 108; j < H; j++) for (let i = 0; i < W; i++) {
        if (rock[j * W + i]) { if (!rock[j * W + i + 1] || !rock[(j + 1) * W + i]) b.dot(i, j, '#ff7a2a', 0.35 + 0.25 * Math.sin(t * 2 + i * 0.2)); continue; }
        const v = fbm(i * 0.05 + t * 0.18, j * 0.11 - t * 0.05, 8) + Math.sin(i * 0.09 + j * 0.2 + t * 1.2) * 0.12 - (j - 108) * 0.0022 * 0.0;
        const lv = clamp((v - 0.3) * 6.2, 0, LAVA.length - 0.01) + (bay(i, j) - 0.5) * 0.7;
        b.set(i, j, LAVA[Math.max(0, Math.min(LAVA.length - 1, Math.floor(lv)))]);
      }
      // 地平线辉光脉动
      const p = 0.5 + 0.2 * Math.sin(t * 1.3);
      for (let j = 100; j < 118; j++) for (let i = 0; i < W; i++) b.dot(i, j, '#ff6a2a', (1 - Math.abs(j - 108) / 10) * 0.18 * p);
      for (const e of em) {
        e.y -= e.vy * 0.085; e.x += Math.sin(t * 1.2 + e.ph) * 0.18;
        if (e.y < -3) { e.y = H + 2; e.x = R() * W; }
        const a = e.y > 100 ? 1 : clamp(e.y / 100 + 0.3);
        if (bay(Math.floor(e.x), Math.floor(e.y)) < a) { b.set(e.x, e.y, e.hot ? '#ffd36b' : '#ff6a2a'); if (e.hot && Math.sin(t * 6 + e.ph) > 0.6) b.set(e.x + 1, e.y, '#ff9a3c'); }
      }
    },
  };
}

/* ═══════════ 3. 霜原极光：极光飘带、雪山、松林、飘雪 ═══════════ */
function frost(): Scene {
  const st = stars(70, 17, 56);
  const R = rng(41);
  const sn = Array.from({ length: 90 }, () => ({ x: R() * W, y: R() * H, v: 6 + R() * 14, big: R() < 0.2, ph: R() * 6 }));
  return {
    bake(b) {
      sky(b, ['#04071a', '#060d2c', '#0a1840', '#10285a', '#1a3c70', '#2a5486'], { gx: 160, gy: 110, gr: 160, gk: 1.6, k: 4.0, to: 118 });
      ridge(b, 96, 34, 0.02, 1.1, ['#223a68', '#182c54'], '#9cc8f0', 130);
      ridge(b, 108, 22, 0.034, 3.2, ['#162a52', '#10204a'], '#6ea0d8', 130);
      // 松林剪影（两侧）
      const G = rng(7);
      for (const x0 of [-4, 18, 38, 270, 292, 310]) { const h = 26 + Math.floor(G() * 12), base = 124 + Math.floor(G() * 6); for (let r = 0; r < h; r++) { const hw = Math.floor((r / h) * 9) + 1 + ((r % 6) < 2 ? 2 : 0); for (let i = -hw; i <= hw; i++) b.set(x0 + i, base - h + r, i < -hw + 2 && r % 6 > 3 ? '#5a8ec0' : '#0a1630'); } b.rect(x0 - 1, base, 3, 5, '#0a1226'); }
      // 冰湖地面：横向反光条
      for (let j = 128; j < H; j++) for (let i = 0; i < W; i++) { const k = (j - 128) / 52; b.set(i, j, bay(i, j) < 0.55 - k * 0.3 ? '#12284c' : '#0c1c3c'); if ((j % 5 === 0) && bay(i * 3, j) < 0.2) b.set(i, j, '#4e7eb4'); }
    },
    frame(b, t) {
      drawStars(b, st, t);
      // 极光：两条丝带，沿 x 的相位 + 时间
      for (const [y0, amp, spd, ca, cb, str] of [[26, 11, 0.5, '#3ddcc0', '#8a6bff', 0.9], [38, 8, -0.35, '#58e8a8', '#5a8cff', 0.6]] as const) {
        for (let i = 0; i < W; i++) {
          const cy = y0 + amp * Math.sin(i * 0.028 + t * spd) + 5 * Math.sin(i * 0.07 - t * spd * 1.6);
          const hgt = 14 + 6 * Math.sin(i * 0.05 + t * 0.7);
          for (let k = 0; k < hgt; k++) { const f = k / hgt; b.dot(i, cy + k, f < 0.5 ? ca : cb, (1 - f) * str * (0.55 + 0.3 * Math.sin(i * 0.2 + t))); }
        }
      }
      for (const s of sn) {
        s.y += s.v * 0.08; s.x += Math.sin(t * 0.7 + s.ph) * 0.15 - 0.05;
        if (s.y > H + 2) { s.y = -2; s.x = R() * W; }
        if (s.x < -2) s.x = W + 2;
        b.set(s.x, s.y, '#e8f4ff'); if (s.big) { b.set(s.x + 1, s.y, '#9cc8f0'); b.set(s.x, s.y + 1, '#9cc8f0'); }
      }
      for (let j = 110; j < 128; j++) for (let i = 0; i < W; i++) { const v = fbm((i + t * 4) * 0.03, j * 0.15, 5); if (v > 0.55) b.dot(i, j, '#8fb8e8', (v - 0.5) * 0.7); }
    },
  };
}

/* ═══════════ 4. 墓穴回廊：尖拱立柱、烛火光晕、地雾、游魂、月光束 ═══════════ */
function crypt(): Scene {
  const R = rng(51);
  const wisps = Array.from({ length: 7 }, () => ({ x: R() * W, y: 60 + R() * 90, ph: R() * 6, sp: 0.2 + R() * 0.3 }));
  const dust = Array.from({ length: 26 }, () => ({ x: 30 + R() * 90, y: R() * 130, ph: R() * 6 }));
  const candles = [[26, 116], [118, 118], [202, 118], [294, 116]];
  return {
    bake(b) {
      sky(b, ['#0a0a18', '#0e0e22', '#131230', '#1a1840', '#201d4a'], { k: 3.4, to: 120 });
      // 后墙砖缝
      for (let j = 8; j < 118; j += 6) for (let i = 0; i < W; i++) if (bay(i, j) < 0.5) b.set(i, j, '#161430');
      // 立柱 + 尖拱（月光色填充洞口）
      for (let k = 0; k < 6; k++) {
        const cx = 8 + k * 64, hw = 22, top = 28;
        for (let j = top; j < 118; j++) {
          const half = j < top + 22 ? Math.round(hw * Math.sqrt(1 - Math.pow((top + 22 - j) / 22, 2))) : hw;
          for (let i = -half; i <= half; i++) { const f = (j - top) / 90; b.set(cx + 32 + i, j, bay(cx + i, j) < 0.7 - f * 0.4 ? '#1e2250' : '#171a40'); }
          b.set(cx + 32 - half, j, '#3a3a78'); b.set(cx + 32 + half, j, '#0e0d24');
        }
        for (let j = 20; j < 124; j++) { b.rect(cx - 6, j, 12, 1, j % 9 === 0 ? '#0d0c20' : '#1b1938'); b.set(cx - 6, j, '#3a3870'); b.set(cx + 5, j, '#0a0a1a'); }
        b.rect(cx - 8, 20, 16, 3, '#2a2860'); b.rect(cx - 8, 122, 16, 3, '#2a2860');
      }
      // 地面石板：透视线
      for (let j = 124; j < H; j++) for (let i = 0; i < W; i++) { b.set(i, j, bay(i, j) < 0.4 ? '#15142e' : '#100f26'); if ((j - 124) % 14 === 0) b.set(i, j, '#232150'); }
      for (let k = -8; k <= 24; k++) for (let j = 124; j < H; j++) { const x = Math.round(160 + (k * 22 - 160 + 160) * 0 + (k * 22 - 160) * (1 + (j - 124) / 40)); b.set(x, j, '#1e1c42'); }
      // 月光束（斜向抖动）
      for (let j = 0; j < 130; j++) for (let i = 0; i < 46; i++) { const x = 34 + i + j * 0.35; if (bay(Math.round(x), j) < 0.12 * (1 - j / 140) * Math.sin((i / 46) * 3.14)) b.set(x, j, '#8fa8ff'); }
      for (const [x, y] of candles) { b.rect(x - 3, y, 6, 6, '#2a2860'); b.rect(x - 2, y - 7, 4, 7, '#d8d0b8'); b.set(x - 2, y - 7, '#fff6dc'); }
    },
    frame(b, t) {
      for (const [x, y] of candles) {
        const fl = Math.sin(t * 9 + x) * 0.5 + Math.sin(t * 13.7 + x * 2) * 0.5;
        glow(b, x, y - 10, 22 + fl * 2, '#ff9a3c', 0.28, 14 + fl);
        const h = 4 + Math.round(fl > 0 ? 1 : 0);
        for (let r = 0; r < h; r++) { b.set(x + (r > 2 ? Math.round(fl) : 0), y - 8 - r, r < 2 ? '#ffd36b' : '#ff8a3a'); if (r < 3) b.set(x - 1, y - 8 - r, '#ff6a2a'); }
        b.set(x, y - 9, '#fff2c0');
      }
      // 地雾
      for (let j = 96; j < 128; j++) for (let i = 0; i < W; i++) { const v = fbm((i + t * 7) * 0.022, j * 0.1 + Math.sin(t * 0.3), 6); if (v > 0.5) b.dot(i, j, '#3a3a82', (v - 0.48) * 0.9); }
      for (const d of dust) { const x = d.x + Math.sin(t * 0.5 + d.ph) * 4 + d.y * 0.35, y = (d.y + t * 3) % 130; if (Math.sin(t + d.ph) > -0.3) b.set(x, y, '#aab8ff'); }
      for (const w of wisps) {
        const x = w.x + Math.sin(t * w.sp + w.ph) * 16, y = w.y + Math.cos(t * w.sp * 1.4 + w.ph) * 8;
        b.set(x, y, '#cfe8ff'); b.dot(x - 1, y, '#6a9ae8', 0.8); b.dot(x + 1, y, '#6a9ae8', 0.8); b.dot(x, y + 1, '#4a6ac0', 0.8); b.dot(x, y - 1, '#6a9ae8', 0.5);
      }
    },
  };
}

/* ═══════════ 5. 幽暗巢穴：肉质洞壁、卵囊搏动、荧光菌、孢子、滴落 ═══════════ */
function hive(): Scene {
  const R = rng(61);
  const spores = Array.from({ length: 46 }, () => ({ x: R() * W, y: R() * H, v: 3 + R() * 7, ph: R() * 6, c: R() < 0.5 ? '#6af0c0' : R() < 0.5 ? '#ff7ac8' : '#ffe08a' }));
  const fungi = Array.from({ length: 14 }, () => ({ x: Math.floor(R() * W), y: 112 + Math.floor(R() * 56), r: 2 + Math.floor(R() * 3), c: R() < 0.6 ? '#6af0c0' : '#ff7ac8', ph: R() * 6 }));
  const eggs = [[48, 100, 12], [88, 108, 9], [236, 102, 13], [278, 110, 9], [160, 96, 10]];
  const drip = { x: 130, t: 0 };
  return {
    bake(b) {
      sky(b, ['#0c0610', '#140a18', '#1c0f20', '#26142a', '#321a30'], { k: 3.6, to: 124 });
      // 洞顶钟乳：锯齿
      for (let i = 0; i < W; i++) { const len = 10 + Math.round(14 * Math.abs(Math.sin(i * 0.11) * Math.cos(i * 0.043 + 1)) + 6 * noise(i * 0.2, 0, 3)); for (let j = 0; j < len; j++) b.set(i, j, bay(i, j) < 0.3 ? '#1a0d1c' : '#0f0712'); b.set(i, len, '#4a2a44'); }
      // 洞壁肌理
      for (let j = 30; j < 124; j++) for (let i = 0; i < W; i++) { const v = fbm(i * 0.04, j * 0.06, 12); if (v > 0.62 && bay(i, j) < 0.5) b.set(i, j, '#2c1630'); }
      // 地面：肉质 + 血管
      for (let j = 124; j < H; j++) for (let i = 0; i < W; i++) { b.set(i, j, bay(i, j) < 0.45 ? '#2a1226' : '#1e0e1c'); if (fbm(i * 0.05, j * 0.2, 14) > 0.66) b.set(i, j, '#4a1c3a'); }
      for (const [x, y, r] of eggs) { disc(b, x, y, r, '#8a5a78', '#4a2a48', r * 1.2); b.dot(x - r / 3, y - r / 2, '#e8c8e0', 0.9); b.rect(x - r, y + r, r * 2, 3, '#10060e'); }
    },
    frame(b, t) {
      for (const [x, y, r] of eggs) { const p = 0.5 + 0.5 * Math.sin(t * 1.2 + x); glow(b, x, y, r * 2.2, '#ff7ac8', 0.1 + 0.12 * p, r * 2.2); disc(b, x, y, r + Math.round(p), '#c88ab0', '#6a3a62', (r + Math.round(p)) * 1.2); b.set(x - r / 3, y - r / 2, '#fff0f8'); }
      for (const f of fungi) { const p = 0.5 + 0.5 * Math.sin(t * 1.6 + f.ph); glow(b, f.x, f.y - 2, f.r * 3.2, f.c, 0.18 + 0.2 * p, f.r * 2.2); for (let k = -f.r; k <= f.r; k++) b.set(f.x + k, f.y - Math.round(Math.sqrt(f.r * f.r - k * k)), f.c); b.rect(f.x - 1, f.y, 2, 4, '#3a2a38'); }
      for (const s of spores) { s.y -= s.v * 0.08; s.x += Math.sin(t + s.ph) * 0.2; if (s.y < -2) { s.y = H + 2; s.x = R() * W; } if (Math.sin(t * 2 + s.ph) > -0.4) b.set(s.x, s.y, s.c); }
      drip.t += 0.08; const ph = drip.t % 3.2;
      if (ph < 2) { const y = 22 + ph * ph * 42; b.set(drip.x, y, '#8fe8d0'); b.set(drip.x, y - 1, '#4ab8a0'); }
      else if (ph < 2.6) { const g = (ph - 2) / 0.6; for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.28; b.dot(drip.x + Math.cos(a) * 10 * g, 146 + Math.sin(a) * 3 * g, '#6af0c0', 1 - g); } }
    },
  };
}

/* ═══════════ 6. 齿轮铸坊：旋转巨齿轮、蒸汽、吊灯、火星 ═══════════ */
function foundry(): Scene {
  const R = rng(71);
  const sparks: { x: number; y: number; vx: number; vy: number; l: number }[] = [];
  const gears = [{ x: 56, y: 54, r: 46, n: 14, s: 0.18 }, { x: 262, y: 40, r: 38, n: 12, s: -0.22 }, { x: 160, y: 8, r: 30, n: 10, s: 0.3 }, { x: 108, y: 112, r: 20, n: 8, s: -0.4 }];
  const steam = Array.from({ length: 22 }, () => ({ x: [38, 284][R() < 0.5 ? 0 : 1] + (R() - 0.5) * 8, y: 120 - R() * 70, r: 3 + R() * 5, ph: R() * 6 }));
  return {
    bake(b) {
      sky(b, ['#060818', '#0a0f24', '#101830', '#18223e', '#202c4c'], { k: 3.4, to: 124 });
      // 砖墙纹理
      for (let j = 4; j < 124; j += 5) for (let i = 0; i < W; i++) { if ((i + (Math.floor(j / 5) % 2) * 8) % 16 === 0) b.set(i, j, '#0a1020'); if (bay(i, j) < 0.4) b.set(i, j, '#161e3a'); }
      // 横梁 + 铆钉
      for (const y of [16, 98]) { b.rect(0, y, W, 5, '#2a3660'); b.rect(0, y, W, 1, '#5a6ca0'); b.rect(0, y + 4, W, 1, '#0a0f24'); for (let i = 6; i < W; i += 18) b.rect(i, y + 2, 2, 2, '#7a8cc0'); }
      for (const x of [10, 150, 310]) b.rect(x, 20, 5, 78, '#1c2646');
      // 地面金属板
      for (let j = 124; j < H; j++) for (let i = 0; i < W; i++) { b.set(i, j, bay(i, j) < 0.4 ? '#161e38' : '#101830'); if ((j - 124) % 12 === 0 || i % 40 === 0) b.set(i, j, '#2c3a68'); if (i % 40 === 3 && (j - 124) % 12 === 3) b.set(i, j, '#6a7cb0'); }
    },
    frame(b, t) {
      for (const g of gears) {
        const rot = t * g.s;
        for (let j = -g.r - 4; j <= g.r + 4; j++) for (let i = -g.r - 4; i <= g.r + 4; i++) {
          const d = Math.hypot(i, j); if (d > g.r + 3) continue;
          const a = Math.atan2(j, i), tooth = Math.cos(g.n * (a - rot)) > 0.15;
          const rr = g.r * 0.84 + (tooth ? g.r * 0.16 : 0);
          if (d > rr) continue;
          if (d < g.r * 0.18) { b.set(g.x + i, g.y + j, d < g.r * 0.1 ? '#0a0f24' : '#5a6ca0'); continue; }
          if (d > g.r * 0.32 && d < g.r * 0.68 && Math.abs(Math.sin(3 * (a - rot))) < 0.3) continue;
          const lit = i + j < -g.r * 0.4;
          b.set(g.x + i, g.y + j, d > rr - 2 ? (lit ? '#6a7cb0' : '#2c3a68') : d < g.r * 0.3 ? '#2a3660' : lit ? '#34427a' : '#1e2850');
        }
      }
      for (const [x, y] of [[96, 24], [224, 24]]) { const fl = 0.7 + 0.3 * Math.sin(t * 7 + x); b.rect(x - 1, 20, 2, 4, '#2a3660'); b.rect(x - 4, y, 8, 5, '#d8a050'); b.rect(x - 3, y + 5, 6, 1, '#ffd36b'); glow(b, x, y + 8, 26, '#ffb050', 0.22 * fl, 18); }
      for (const s of steam) { s.y -= 0.18; s.r += 0.01; if (s.y < 50) { s.y = 120; s.r = 3; } const a = clamp((s.y - 50) / 70) * 0.55; for (let k = 0; k < 14; k++) { const ang = k * 0.45; b.dot(s.x + Math.cos(ang) * s.r + Math.sin(t + s.ph) * 3, s.y + Math.sin(ang) * s.r * 0.7, '#8aa0c8', a); } }
      if (R() < 0.18) sparks.push({ x: 20 + R() * 280, y: 126, vx: (R() - 0.5) * 1.6, vy: -1.2 - R() * 1.4, l: 1 });
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.x += s.vx; s.y += s.vy; s.vy += 0.1; s.l -= 0.03; if (s.l <= 0 || s.y > H) { sparks.splice(i, 1); continue; } b.set(s.x, s.y, s.l > 0.5 ? '#ffd36b' : '#ff8a3a'); }
    },
  };
}

/* ═══════════ 7. 星坠深渊：虚空星云、巨月、浮岛、符文环、流星 ═══════════ */
function abyss(): Scene {
  const R = rng(81);
  const st = stars(140, 77, 120, (x, y) => Math.hypot(x - 160, y - 44) < 36);
  const isl = [[40, 56, 22], [268, 70, 26], [210, 30, 14], [100, 20, 12]];
  const meteors: { x: number; y: number; l: number }[] = [];
  return {
    bake(b) {
      sky(b, ['#030310', '#070620', '#0d0a30', '#150c42', '#1d1056', '#281468'], { gx: 160, gy: 110, gr: 150, gk: 1.6, k: 4.3, to: H });
      // 星云团：两色噪声抖动
      for (let j = 0; j < 130; j++) for (let i = 0; i < W; i++) { const v = fbm(i * 0.018, j * 0.028, 21); if (v > 0.56) b.dot(i, j, '#5a2a8a', (v - 0.55) * 1.6); const u = fbm(i * 0.02 + 9, j * 0.03, 22); if (u > 0.6) b.dot(i, j, '#2a5a9a', (u - 0.58) * 1.3); }
      // 巨月（暗环行星）
      disc(b, 160, 44, 30, '#3a2a70', '#1a1240', 30);
      for (let k = 0; k < 140; k++) { const a = (k / 140) * 6.28; b.set(160 + Math.cos(a) * 46, 44 + Math.sin(a) * 9, '#4a3a88'); b.set(160 + Math.cos(a) * 49, 44 + Math.sin(a) * 10, '#2a2060'); }
      for (let j = -30; j <= 30; j++) for (let i = -30; i <= 30; i++) { const d = Math.hypot(i, j); if (d <= 30 && d > 28) b.set(160 + i, 44 + j, i + j < 0 ? '#8a7ad8' : '#2a2060'); }
      // 浮岛：上亮下碎
      for (const [x, y, w] of isl) { for (let i = -w; i <= w; i++) { const depth = Math.round((w - Math.abs(i)) * 0.7 + noise(i * 0.4, x, 4) * 3); b.set(x + i, y, '#6a5ab8'); for (let j = 1; j <= depth; j++) b.set(x + i, y + j, j < 2 ? '#3a2e78' : bay(x + i, j) < 0.4 ? '#1e1650' : '#150f3a'); } }
      // 地面：深色晶体地
      for (let j = 124; j < H; j++) for (let i = 0; i < W; i++) b.set(i, j, bay(i, j) < (j - 124) / 56 + 0.2 ? '#06051a' : '#0b0928');
    },
    frame(b, t) {
      drawStars(b, st, t);
      // 符文环：地平线上的椭圆，刻度缓慢旋转
      const cx = 160, cy = 112, rx = 120, ry = 20;
      for (let k = 0; k < 160; k++) { const a = (k / 160) * 6.283; b.dot(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, '#6a4ad8', 0.5); }
      for (let k = 0; k < 24; k++) { const a = (k / 24) * 6.283 + t * 0.12; const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; const on = Math.sin(t * 2 + k) > -0.2; b.set(x, y, on ? '#b49aff' : '#5a3ab0'); b.set(x, y - 1, on ? '#8a6bff' : '#3a2a80'); if (k % 3 === 0) { b.set(x, y - 2, '#d8caff'); b.set(x - 1, y - 1, '#8a6bff'); b.set(x + 1, y - 1, '#8a6bff'); } }
      // 流星
      if (R() < 0.014) meteors.push({ x: 60 + R() * 260, y: -4, l: 1 });
      for (let i = meteors.length - 1; i >= 0; i--) { const m = meteors[i]; m.x -= 3.4; m.y += 1.9; m.l -= 0.012; if (m.l <= 0 || m.y > 100) { meteors.splice(i, 1); continue; } for (let k = 0; k < 16; k++) b.dot(m.x + k * 1.7, m.y - k * 0.9, k < 2 ? '#ffffff' : '#9a8aff', (1 - k / 16) * m.l); }
      // 向上飘的星尘
      for (let k = 0; k < 14; k++) { const x = (k * 71 + t * 4 * (1 + (k % 3))) % W, y = H - ((t * 6 * (1 + (k % 4) * 0.4) + k * 37) % 70); if (Math.sin(t + k) > -0.3) b.set(x, y, '#8a6bff'); }
    },
  };
}

const BUILD: Record<SceneId, () => Scene> = { moor, ember, frost, crypt, hive, foundry, abyss };

/** 场景挑选：Boss 固定主题；普通战按「幕 × 回合」确定性轮换，同一场重播始终同一张 */
export function pickScene(o: { act: number; turn: number; boss?: string | null }): SceneId {
  const b = o.boss;
  if (b === 'forge') return 'ember';
  if (b === 'horde') return 'hive';
  if (b === 'wall') return 'foundry';
  if (b === 'tide') return 'crypt';
  if (b === 'final') return 'abyss';
  const pools: SceneId[][] = [['moor', 'crypt', 'frost'], ['ember', 'hive', 'foundry', 'moor'], ['frost', 'abyss', 'crypt', 'foundry']];
  const pool = pools[Math.max(0, Math.min(2, o.act - 1))];
  return pool[Math.abs(o.turn * 7 + o.act * 3) % pool.length];
}

export interface SceneHandle { el: HTMLElement; dispose(): void; setPaused(p: boolean): void }

/** One live renderer per host, including callers outside the Game lifecycle. */
const mounted = new WeakMap<HTMLElement, SceneHandle>();

export function mountScene(host: HTMLElement, id: SceneId): SceneHandle {
  mounted.get(host)?.dispose();
  const el = document.createElement('div');
  el.className = `battle-scene scene-${id}`;
  el.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  el.appendChild(canvas);
  host.prepend(el);
  host.classList.add('has-battle-scene');
  const c = canvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const scene = BUILD[id]();
  const baked = document.createElement('canvas'); baked.width = W; baked.height = H;
  const over = document.createElement('canvas'); over.width = W; over.height = H;
  const bakeBuf = new Buf();
  scene.bake(bakeBuf);
  baked.getContext('2d')!.putImageData(new ImageData(bakeBuf.d, W, H), 0, 0);
  const oc = over.getContext('2d')!;
  const buf = new Buf();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0, last: number | null = null, paused = false, dead = false;
  let tt = motion.matches ? 3 : 0;
  const draw = () => {
    buf.clear();
    scene.frame(buf, tt);
    oc.putImageData(new ImageData(buf.d, W, H), 0, 0);
    c.drawImage(baked, 0, 0);
    c.drawImage(over, 0, 0);
  };
  const loop = (now: number) => {
    raf = 0;
    if (dead || paused || document.hidden || motion.matches) { last = null; return; }
    // First callback after resume establishes a fresh clock; paused time stays frozen.
    if (last === null) last = now;
    else if (now - last >= 1000 / 12 - 1) {
      tt += Math.min(0.2, (now - last) / 1000);
      last = now;
      draw();
    }
    raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    cancelAnimationFrame(raf); raf = 0; last = null;
    if (!dead && !paused && !document.hidden && !motion.matches) raf = requestAnimationFrame(loop);
  };
  document.addEventListener('visibilitychange', kick);
  motion.addEventListener('change', kick);
  draw();
  kick();
  const handle: SceneHandle = {
    el,
    setPaused(p) { if (dead || paused === p) return; paused = p; kick(); },
    dispose() {
      if (dead) return;
      dead = true;
      cancelAnimationFrame(raf); raf = 0;
      document.removeEventListener('visibilitychange', kick);
      motion.removeEventListener('change', kick);
      el.remove();
      if (mounted.get(host) === handle) {
        mounted.delete(host);
        host.classList.remove('has-battle-scene');
      }
    },
  };
  mounted.set(host, handle);
  return handle;
}
