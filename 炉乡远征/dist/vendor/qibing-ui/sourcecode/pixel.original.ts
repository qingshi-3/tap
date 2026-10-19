import { FACTION_INFO } from '../core/data';
import type { Faction } from '../core/types';
import { mix } from './unitArt';

// 像素美术层：所有边框 / 分隔线 / 台座 / 背景都在启动时用 canvas 程序化生成，
// 以 data URI 写进 :root 的 CSS 变量，样式表只引用 var(--px-*)，不带任何外部图片。
// 约定：1 个精灵像素 = 2 个舞台像素，统一 image-rendering: pixelated。

type RGBA = [number, number, number, number];
type Pal = { o: string; h: string; m: string; s: string; d: string; g?: string };

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}
function rgba(hex: string, a = 255): RGBA {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), a];
}
/** 逐像素绘制：fn 返回颜色或 null（透明） */
function paint(w: number, h: number, fn: (x: number, y: number) => string | RGBA | null) {
  const [c, x] = canvas(w, h);
  const img = x.createImageData(w, h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const v = fn(i, j);
      if (!v) continue;
      const p = typeof v === 'string' ? rgba(v) : v;
      img.data.set(p, (j * w + i) * 4);
    }
  x.putImageData(img, 0, 0);
  return c;
}
const url = (c: HTMLCanvasElement) => `url("${c.toDataURL()}")`;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER4[(y & 3) * 4 + (x & 3)];

/* ───────── 9-slice 边框：16×16，切片 6 ───────── */
function frame(p: Pal, rivet = true) {
  const N = 16;
  return paint(N, N, (x, y) => {
    const t = y, l = x, b = N - 1 - y, r = N - 1 - x;
    const edge = Math.min(t, l, b, r);
    const corner = Math.min(t + l, t + r, b + l, b + r);
    const e = Math.min(edge, corner - 2);
    if (e < 0) return null;
    if (e === 0) return p.o;
    if (e === 1) return Math.min(t, l) <= Math.min(b, r) ? p.h : p.s;
    if (e === 2) return p.m;
    if (e === 3) return p.d;
    // 四角铆钉
    if (rivet && edge === 4 && corner === 8) return p.g ?? p.h;
    return null;
  });
}

/* ───────── 分隔线：横向平铺 8×3 + 中心宝石 ───────── */
function dividerTile(p: Pal) {
  return paint(8, 3, (x, y) => {
    if (y === 0) return x % 4 === 0 ? p.h : x % 2 === 0 ? p.m : null;
    if (y === 1) return x % 2 === 0 ? p.m : p.s;
    return x % 4 === 2 ? p.s : null;
  });
}
function dividerTileV(p: Pal) {
  return paint(3, 8, (x, y) => {
    if (x === 1) return y % 2 === 0 ? p.m : p.s;
    return y % 4 === 0 ? p.h : null;
  });
}
function gem(p: Pal, w = 11, hgt = 7) {
  const cx = (w - 1) / 2, cy = (hgt - 1) / 2;
  return paint(w, hgt, (x, y) => {
    const d = Math.abs(x - cx) / (cx + 0.5) + Math.abs(y - cy) / (cy + 0.5);
    if (d > 1) return null;
    if (d > 0.72) return p.o;
    if (x < cx && y <= cy) return p.h;
    if (y > cy) return p.s;
    return p.m;
  });
}

/* ───────── 数值宝石（攻击菱形 / 生命圆） ───────── */
function statGem(kind: 'atk' | 'hp', p: Pal) {
  const N = 17, c = 8;
  return paint(N, N, (x, y) => {
    const dx = x - c, dy = y - c;
    const d = kind === 'atk' ? (Math.abs(dx) + Math.abs(dy)) / 8.6 : Math.sqrt(dx * dx + dy * dy) / 8.2;
    if (d > 1) return null;
    const o = kind === 'atk' ? 0.86 : 0.84;
    if (d > o) return '#0b0612';
    if (d > o - 0.12) return dx + dy < 0 ? p.h : p.s;
    // 内部：左上亮，右下暗，加一颗高光点
    if ((dx === -3 && dy === -4) || (dx === -4 && dy === -3) || (dx === -3 && dy === -3)) return '#ffffff';
    const sh = (dx + dy) / 16 + bayer(x, y) * 0.35 - 0.17;
    return sh < -0.2 ? p.h : sh > 0.22 ? p.d : sh > 0.04 ? p.s : p.m;
  });
}

/* ───────── 像素心 9×8 ───────── */
const HEART = ['.##...##.', '#hh#.#mm#', '#hmm#mmm#', '#mmmmmmm#', '.#mmmms#.', '..#mms#..', '...#s#...', '....#....'];
function heart(h: string, m: string, s: string, o = '#1a0610') {
  return paint(9, 8, (x, y) => ({ '#': o, h, m, s })[HEART[y][x]] ?? null);
}

/* ───────── 台座：46×18 阶梯石盘 ───────── */
function pedestal(rim: string, rimHi: string, front: boolean) {
  const W = 46, H = 18, cx = 22.5;
  const stoneT = ['#4a4a7a', '#3a3a66', '#2d2c52'];
  const side = ['#211f40', '#17152f'];
  return paint(W, H, (x, y) => {
    const dx = (x - cx) / 22.5;
    // 顶面椭圆 (cy=6, ry=5.5)，侧面向下延伸 4 像素
    const top = dx * dx + ((y - 6) / 5.6) ** 2;
    const bot = dx * dx + ((y - 10) / 5.6) ** 2;
    if (top <= 1) {
      if (top > 0.8) return y < 6 ? rimHi : rim;
      // 符文：内圈点线
      const ring = dx * dx + ((y - 6) / 5.6) ** 2;
      if (ring > 0.36 && ring < 0.5 && (x + y) % 3 === 0) return front ? rimHi : rim;
      if (front && Math.abs(x - cx) < 1.5 && Math.abs(y - 6) < 1.2) return rimHi;
      const k = (y - 1) / 10 + bayer(x, y) * 0.5 - 0.25;
      return stoneT[k < 0.2 ? 0 : k < 0.55 ? 1 : 2];
    }
    if (bot <= 1 && y >= 6) {
      if (bot > 0.86) return '#0a0918';
      return (x + (y >> 1)) % 7 === 0 ? '#2a2850' : side[y > 12 ? 1 : 0];
    }
    return null;
  });
}

/* ───────── 战场背景：320×180 ───────── */
function backdrop() {
  const W = 320, H = 180;
  const [c, x] = canvas(W, H);
  const img = x.createImageData(W, H);
  const put = (i: number, j: number, col: RGBA) => {
    if (i < 0 || j < 0 || i >= W || j >= H) return;
    img.data.set(col, (j * W + i) * 4);
  };
  // 天空：抖动渐变色带
  const sky = ['#07071c', '#0b0b28', '#111036', '#171444', '#1f1750', '#2a1a5c', '#331d5e'].map((h) => rgba(h));
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const glow = Math.max(0, 1 - Math.hypot((i - 160) / 150, (j - 80) / 60));
      const v = Math.min(sky.length - 1, (j / H) * 4.2 + glow * 2.6 + bayer(i, j) - 0.5);
      put(i, j, sky[Math.max(0, Math.floor(v))]);
    }
  // 月亮（像素圆 + 光晕抖动）
  const mx = 262, my = 30;
  for (let j = my - 30; j <= my + 30; j++)
    for (let i = mx - 30; i <= mx + 30; i++) {
      const d = Math.hypot(i - mx, j - my);
      if (d <= 9) {
        // 新月：被偏移的暗圆切掉一块
        if (Math.hypot(i - mx - 4, j - my + 3) < 7.5) continue;
        const inner = Math.hypot(i - mx - 4, j - my + 3) < 8.5;
        put(i, j, rgba(d > 8 || inner ? '#d8b784' : i < mx - 3 && j < my + 3 ? '#fff6dc' : '#f4ddb0'));
      } else if (d < 20 && bayer(i, j) < (1 - (d - 9) / 11) * 0.4) put(i, j, rgba(d < 13 ? '#4a3270' : '#2e2060'));
    }
  // 星星
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 90; k++) {
    const i = Math.floor(rnd() * W), j = Math.floor(rnd() * 100);
    if (Math.hypot(i - mx, j - my) < 22) continue;
    const big = rnd() < 0.12;
    const col = rgba(rnd() < 0.7 ? '#cfd2ff' : '#ffe2a6');
    put(i, j, col);
    if (big) {
      const dim = rgba('#6a6aa8');
      put(i - 1, j, dim); put(i + 1, j, dim); put(i, j - 1, dim); put(i, j + 1, dim);
    }
  }
  // 山脉：三层锯齿，带亮边
  const ridge = (base: number, amp: number, freq: number, ph: number, j: number) =>
    base - amp * (0.55 * Math.abs(Math.sin(j * freq + ph)) + 0.3 * Math.abs(Math.sin(j * freq * 2.3 + ph * 1.7)) + 0.06 * Math.sin(j * freq * 5.1));
  const layers = [
    { base: 108, amp: 40, f: 0.021, ph: 0.6, fill: ['#1d1850', '#17133f'], rim: '#3d3388' },
    { base: 122, amp: 26, f: 0.034, ph: 2.2, fill: ['#141136', '#100d2c'], rim: '#2c2668' },
    { base: 134, amp: 14, f: 0.05, ph: 4.1, fill: ['#0c0a22', '#09081b'], rim: '#1f1b4a' },
  ];
  for (const L of layers) {
    for (let i = 0; i < W; i++) {
      // 量化成 2 像素台阶，让山脊呈像素阶梯
      const top = Math.round(ridge(L.base, L.amp, L.f, L.ph, i - (i % 2)));
      const prev = Math.round(ridge(L.base, L.amp, L.f, L.ph, i - 2 - (i % 2)));
      for (let j = top; j < H; j++) {
        const lit = j - top < 1 || (j - top < 2 && prev > top);
        const depth = (j - top) / 40 + bayer(i, j) * 0.6 - 0.3;
        put(i, j, rgba(lit ? L.rim : L.fill[depth > 0.4 ? 1 : 0]));
      }
    }
  }
  // 底部压暗：抖动过渡到地面色
  for (let j = 150; j < H; j++)
    for (let i = 0; i < W; i++) if (bayer(i, j) < (j - 150) / 22) put(i, j, rgba('#06061a'));
  x.putImageData(img, 0, 0);
  return c;
}

/* ───────── 调色板 ───────── */
const P = {
  gold: { o: '#0b0716', h: '#fff1b8', m: '#e0a63a', s: '#8a5414', d: '#2a1a08', g: '#fff1b8' },
  steel: { o: '#05051a', h: '#8e8ad6', m: '#4b4896', s: '#26235a', d: '#0e0c2a', g: '#ffd36b' },
  teal: { o: '#04121a', h: '#c4fff4', m: '#3cc8b4', s: '#16665e', d: '#082422', g: '#c4fff4' },
  red: { o: '#14040a', h: '#ffb8c3', m: '#e8394f', s: '#7a1024', d: '#2a0610', g: '#ffd36b' },
  dim: { o: '#05051a', h: '#5c5a9a', m: '#33306a', s: '#1c1a44', d: '#0b0a22' },
} satisfies Record<string, Pal>;

function factionPal(f: Faction): Pal {
  const { color, dark } = FACTION_INFO[f];
  return { o: '#07051a', h: mix(color, '#ffffff', 0.5), m: color, s: dark, d: mix(dark, '#000000', 0.55), g: mix(color, '#ffffff', 0.7) };
}

export let BACKDROP_URL = '';

/** 启动时调用一次：生成全部精灵并写入 CSS 变量 */
export function installPixelSprites() {
  const vars: Record<string, string> = {};
  for (const [k, p] of Object.entries(P)) {
    vars[`--pxf-${k}`] = url(frame(p));
    vars[`--pxd-${k}`] = url(dividerTile(p));
    vars[`--pxv-${k}`] = url(dividerTileV(p));
    vars[`--pxg-${k}`] = url(gem(p));
  }
  for (const f of Object.keys(FACTION_INFO) as Faction[]) vars[`--pxf-${f}`] = url(frame(factionPal(f)));
  const atk = { o: '#000', h: '#ffe9a8', m: '#f5a83a', s: '#c0601a', d: '#7a3008' };
  const hp = { o: '#000', h: '#ffc0c6', m: '#e8394f', s: '#a81c34', d: '#5c0a1c' };
  const hurt = { o: '#000', h: '#e8a0a8', m: '#a8263c', s: '#781428', d: '#3a0612' };
  const zero = { o: '#000', h: '#c8cce0', m: '#8a90aa', s: '#5c6280', d: '#353a52' };
  vars['--px-atk'] = url(statGem('atk', atk));
  vars['--px-hp'] = url(statGem('hp', hp));
  vars['--px-hp-hurt'] = url(statGem('hp', hurt));
  vars['--px-atk-zero'] = url(statGem('atk', zero));
  vars['--px-hp-zero'] = url(statGem('hp', zero));
  vars['--px-heart'] = url(heart('#ffc0c6', '#ff4d64', '#b01c38'));
  vars['--px-heart-off'] = url(heart('#3a3450', '#2a2540', '#1f1b30', '#0c0a18'));
  vars['--px-ped-0'] = url(pedestal('#a8761e', '#ffd36b', false));
  vars['--px-ped-0f'] = url(pedestal('#e0a63a', '#fff1b8', true));
  vars['--px-ped-1'] = url(pedestal('#8a1c34', '#ff6a85', false));
  vars['--px-ped-1f'] = url(pedestal('#c8304a', '#ffb8c3', true));
  const bd = backdrop();
  BACKDROP_URL = bd.toDataURL();
  vars['--px-backdrop'] = `url("${BACKDROP_URL}")`;
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
}

/** 说明页等内联 svg 用的小台座 */
export function pedestalUrl(enemy: boolean) {
  return pedestal(enemy ? '#8a1c34' : '#a8761e', enemy ? '#ff6a85' : '#ffd36b', false).toDataURL();
}
