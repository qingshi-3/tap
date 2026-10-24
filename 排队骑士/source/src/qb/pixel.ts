import { FACTION_INFO } from './shim';
import type { Faction } from './shim';
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

/* ───────── 阵营卡框：24×24，切片 9 ─────────
   每个阵营一套轮廓（角的形状）+ 边纹 + 角饰，让不看颜色也能分辨阵营。
   坐标约定：u/v = 到最近外缘的距离（四角镜像），a = 沿边位置（中段周期 6），d = 离外缘深度。 */
type Role = 'o' | 'L' | 'h' | 'm' | 's' | 'd' | 'g' | '.';
interface FrameSpec {
  /** 边带距外缘的内缩，留出空间给向外突出的角饰 */
  inset?: number;
  /** 角区域被切掉的像素 */
  cut?: (u: number, v: number) => boolean;
  /** 角区域额外补上的像素（突出部分） */
  add?: (u: number, v: number) => boolean;
  /** 角饰，画在边带之上 */
  corner?: (u: number, v: number) => Role | undefined;
  /** 边纹 */
  edge?: (a: number, d: number) => Role | undefined;
}
const FRAME_SPECS: Record<Faction, FrameSpec> = {
  // 圣光：圆角 + 十字铆钉 + 珠串边
  light: {
    cut: (u, v) => u < 4 && v < 4 && (4 - u) ** 2 + (4 - v) ** 2 > 17,
    corner: (u, v) => {
      const k = Math.abs(u - 6) + Math.abs(v - 6);
      if ((u === 6 && Math.abs(v - 6) <= 1) || (v === 6 && Math.abs(u - 6) <= 1)) return k === 0 ? 'h' : 'g';
      if ((u === 6 && Math.abs(v - 6) === 2) || (v === 6 && Math.abs(u - 6) === 2) || (Math.abs(u - 6) === 1 && Math.abs(v - 6) === 1)) return 'o';
    },
    edge: (a, d) => (d === 2 && a % 3 === 1 ? 'h' : undefined),
  },
  // 影刃：大斜切角 + 贯穿角的刀刃 + 带缺口的刃边
  shadow: {
    inset: 1,
    cut: (u, v) => u + v < 6,
    add: (u, v) => Math.abs(u - v) <= 1 && u + v <= 6,
    corner: (u, v) => {
      if (u === v && u <= 6) return u === 0 ? 'o' : 'h';
      if (Math.abs(u - v) === 1 && u + v <= 7) return u + v <= 1 ? '.' : 'o';
    },
    edge: (a, d) => (d === 2 && a % 3 === 2 ? 'o' : undefined),
  },
  // 深渊：内凹的圆弧缺口 + 悬浮的眼珠 + 滴落
  abyss: {
    cut: (u, v) => Math.hypot(u, v) < 7.6,
    corner: (u, v) => {
      const r = Math.hypot(u - 1.5, v - 1.5);
      if (r < 1.1) return 'g';
      if (r < 2.1) return 'o';
    },
    edge: (a, d) => (a === 2 && d === 4 ? 's' : a === 2 && d === 5 ? 'o' : d === 2 && a === 2 ? 'g' : undefined),
  },
  // 熔岩：锯齿尖角 + 外侧岩壳凸起 + 火星
  magma: {
    inset: 2,
    cut: (u, v) => u + v < 4,
    add: (u, v) => {
      const tooth = (w: number, a: number) => (w === 1 && a >= 4 && a <= 7) || (w === 0 && (a === 5 || a === 6));
      return tooth(u, v) || tooth(v, u) || (u <= 2 && v <= 2 && Math.abs(u - v) <= 1);
    },
    corner: (u, v) => (u === 4 && v === 4 ? 'g' : undefined),
    edge: (a, d) => (d === -1 && a % 3 !== 2 ? (a % 3 === 0 ? 'o' : 's') : d === -2 && a % 6 === 0 ? 'o' : d === 2 && a % 6 === 3 ? 'g' : undefined),
  },
  // 寒冰：菱形冰晶角 + 外侧冰棱
  frost: {
    inset: 2,
    add: (u, v) => Math.abs(u - 3) + Math.abs(v - 3) <= 3,
    corner: (u, v) => {
      const k = Math.abs(u - 3) + Math.abs(v - 3);
      if (k > 3) return undefined;
      if (k === 3) return 'o';
      if (k === 0) return 'h';
      return u + v < 6 ? 'g' : u + v === 6 ? 'm' : 's';
    },
    edge: (a, d) => (d === -1 && (a === 1 || a === 4) ? 'g' : d === -2 && a === 1 ? 'h' : d === 1 && a === 4 ? 'h' : undefined),
  },
  // 沙域：直角方缺口（城垛）+ 砖缝
  desert: {
    cut: (u, v) => u < 5 && v < 5,
    corner: (u, v) => (u === 2 && v === 2 ? 'g' : (u === 1 || u === 3) && v === 2 || (v === 1 || v === 3) && u === 2 ? 'o' : undefined),
    edge: (a, d) => (d === 1 && a % 6 === 0 ? 'o' : d === 2 && a % 6 === 3 ? 'o' : undefined),
  },
  // 中立：方正小切角 + 单铆钉，不加边纹
  neutral: {
    cut: (u, v) => u + v < 2,
    corner: (u, v) => (u === 5 && v === 5 ? 'g' : u === 6 && v === 6 ? 's' : undefined),
  },
  enemy: {
    cut: (u, v) => u + v < 2,
  },
};

function factionFrame(p: Pal, spec: FrameSpec) {
  const N = 24, C = 9, I = spec.inset ?? 0;
  const uv = (x: number, y: number) => [Math.min(x, N - 1 - x), Math.min(y, N - 1 - y)] as const;
  const inside = new Uint8Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const [u, v] = uv(x, y);
      const corner = u < C && v < C;
      let on = u >= I && v >= I && !(corner && spec.cut?.(u, v));
      if (corner && spec.add?.(u, v)) on = true;
      inside[y * N + x] = on ? 1 : 0;
    }
  // 4 邻域距离：离轮廓越远越往内，0..3 依次是描边 / 受光 / 主色 / 暗部
  const dist = new Int16Array(N * N).fill(99);
  const q: number[] = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (!inside[y * N + x]) continue;
      const out = (i: number, j: number) => i < 0 || j < 0 || i >= N || j >= N || !inside[j * N + i];
      if (out(x - 1, y) || out(x + 1, y) || out(x, y - 1) || out(x, y + 1)) {
        dist[y * N + x] = 0;
        q.push(y * N + x);
      }
    }
  for (let k = 0; k < q.length; k++) {
    const i = q[k], x = i % N, y = (i / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, j = ny * N + nx;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || !inside[j] || dist[j] <= dist[i] + 1) continue;
      dist[j] = dist[i] + 1;
      q.push(j);
    }
  }
  const BAND: Role[] = ['o', 'L', 'm', 'd'];
  const role = (x: number, y: number) => {
    const [u, v] = uv(x, y);
    let r: Role | undefined = inside[y * N + x] ? BAND[dist[y * N + x]] : undefined;
    // 边纹：只铺在离角 6 像素以外，保证和中段平铺周期对齐
    if (spec.edge) {
      const d = Math.min(x, y, N - 1 - x, N - 1 - y);
      const a = d === y || d === N - 1 - y ? x : y;
      if (a >= 6 && a < N - 6) r = spec.edge((((a - C) % 6) + 6) % 6, d - I) ?? r;
    }
    if (u < C && v < C && spec.corner) r = spec.corner(u, v) ?? r;
    return r;
  };
  const frame = paint(N, N, (x, y) => {
    const r = role(x, y);
    if (!r || r === '.') return null;
    if (r === 'L') return Math.min(x, y) <= Math.min(N - 1 - x, N - 1 - y) ? p.h : p.s;
    return r === 'g' ? (p.g ?? p.h) : p[r];
  });
  // 遮罩：轮廓内部 + 所有画出来的像素，卡面底色按它裁切，切掉的角才是真的空
  const mask = paint(N, N, (x, y) => {
    const r = role(x, y);
    return (r && r !== '.') || (inside[y * N + x] && r !== '.') ? '#000000' : null;
  });
  return { frame, mask };
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

/* ───────── 传说冠饰 17×10 ───────── */
const CROWN = [
  '..o.....o.....o..',
  '.oho...oho...oho.',
  '.ohmo..ohmo.ohso.',
  '.ohmmoohmmsoomso.',
  '.ohmmmmhmmmmmmso.',
  'oohhhhhhhhhhhhhoo',
  'ohmmbmmmrmmmbmmso',
  'ohmmmmmmmmmmmmmso',
  'ossssssssssssssso',
  'ooooooooooooooooo',
];
function crown() {
  const c: Record<string, string> = { o: '#1a0c02', h: '#fff1b8', m: '#f0b53e', s: '#9a5c12', r: '#ff4d64', b: '#6fe6ff' };
  return paint(17, 10, (x, y) => c[CROWN[y][x]] ?? null);
}

/* ───────── 阵营徽记 13×13（外加 1 像素描边 = 15×15） ─────────
   卡面水印与场上单位共用，单位离开卡牌后靠它认阵营。o 为内部暗色（瞳孔等），描边自动生成。 */
const SIGILS: Record<Faction, string[]> = {
  // 圣光：四芒圣星
  light: [
    '......h......',
    '.....hmh.....',
    '..h..hmh..h..',
    '...h.hmh.h...',
    '....hhmhh....',
    '.hhhhmmmhhhh.',
    'hmmmmmhmmmmms',
    '.ssssmmmssss.',
    '....ssmss....',
    '...s.hms.s...',
    '..s..hms..s..',
    '.....hms.....',
    '......s......',
  ],
  // 影刃：斜握匕首
  shadow: [
    '...........hh',
    '..........hhm',
    '.........hhm.',
    '........hhm..',
    '.......hhm...',
    '..m...hhm....',
    '...m.hhm.....',
    '....mms......',
    '....smm......',
    '...ss..m.....',
    '..ss....m....',
    '.ss..........',
    'ss...........',
  ],
  // 深渊：竖瞳之眼 + 触须
  abyss: [
    '.............',
    '....sssss....',
    '..ssmmmmmss..',
    '.smhhhhhhhms.',
    'smhhmmommhhms',
    'smhmmooommhms',
    'smhhmmommhhms',
    '.smhhhhhhhms.',
    '..ssmmmmmss..',
    '....sssss....',
    '...s..s..s...',
    '..s...s...s..',
    '..s..s.....s.',
  ],
  // 熔岩：火焰
  magma: [
    '......h......',
    '.....hm......',
    '.....hm..h...',
    '....hmm..m...',
    '...hmmms.mm..',
    '...hmmsmmmm..',
    '..hmmsssmmms.',
    '..hmsshhssms.',
    '.hmmshhhhsmms',
    '.hmshhhhhhsms',
    '.hmshhhhhhsms',
    '..smshhhhsms.',
    '...ssmmmmss..',
  ],
  // 寒冰：雪花
  frost: [
    '......h......',
    '....h.h.h....',
    '.....hmh.....',
    '..h...m...h..',
    '...h..m..h...',
    'h...hmmmh...h',
    '.hmmmmhmmmmh.',
    'h...hmmmh...h',
    '...h..m..h...',
    '..h...m...h..',
    '.....hmh.....',
    '....h.h.h....',
    '......h......',
  ],
  // 沙域：金字塔
  desert: [
    '......h......',
    '.....hhm.....',
    '....hhmms....',
    '....hmmms....',
    '...hhmmmss...',
    '...hmmmmss...',
    '..hhmmmmsss..',
    '..hmmmmmsss..',
    '.hhmmmmmmsss.',
    '.hmmmmmmmsss.',
    'hhmmmmmmmssss',
    '.............',
    'mmmmmmmmmmmmm',
  ],
  // 中立：十字盾
  neutral: [
    '.............',
    '.hhhhhhhhhhm.',
    '.hmmmmmmmmms.',
    '.hmmmmhmmmms.',
    '.hmmmmhmmmms.',
    '.hmhhhhhhhms.',
    '.hmmmmhmmmms.',
    '.hmmmmhmmmms.',
    '..hmmmhmmms..',
    '..hmmmmmmms..',
    '...hmmmmms...',
    '....hmmms....',
    '......s......',
  ],
  // 敌军：骷髅
  enemy: [
    '...hhhhhhh...',
    '..hmmmmmmmh..',
    '.hmmmmmmmmms.',
    '.hmmmmmmmmms.',
    '.hmooommooom.',
    '.hmooommooom.',
    '.hmmmmommmms.',
    '..smmmmmmms..',
    '...smmmmms...',
    '...sosmsos...',
    '...smsmsms...',
    '....sssss....',
    '.............',
  ],
};
function sigil(f: Faction, p: Pal) {
  const g = SIGILS[f];
  const at = (x: number, y: number) => (x >= 1 && y >= 1 && x <= 13 && y <= 13 ? g[y - 1][x - 1] : '.');
  return paint(15, 15, (x, y) => {
    const c = at(x, y);
    if (c !== '.') return c === 'o' ? p.o : (p as Record<string, string>)[c];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) !== '.') return p.o;
    return null;
  });
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


/* ───────── 词条图标 13×13（自动描边 → 15×15，显示 30px） ─────────
   只给「图标能单独读懂」的数值类词条：护甲/格挡/法强/反击/寒意/冻结/灼烧，以及蓄力进度。
   其余词条一律用「」短词，不做图标。 */
type GlyphPal = Record<string, string>;
const GLYPH_MAP: Record<string, string[]> = {
  armor: ['....hhhhs....', '..hhmmmmmss..', '.hmmmmmmmmms.', '.hmmmmmmmmms.', 'hmmmmmmmmmmms', 'hmdddddddddms', 'hmmmmmdmmmmms', 'hmmmmmdmmmmms', 'hmmmmmdmmmmms', '.hmmmmdmmmms.', '.hmmmmmmmmss.', '..sssssssss..', '.............'],
  block: ['.hhhhhhhhhhs.', 'hwmmmmdmmmmms', 'hmmmmmdmmmmms', 'hmmmmmdmmmmms', 'hmdddddddddms', 'hmmmmmdmmmmms', '.hmmmmdmmmms.', '.hmmmmdmmmms.', '..hmmmdmmms..', '..hmmmdmmms..', '...hmmdmms...', '....hmdms....', '......s......'],
  power: ['......h......', '......h......', '.....hms.....', '.....hms.....', '....hmmms....', '..hhmmwmmss..', 'hhmmmwwwmmmss', '..hsmmwmmss..', '....smmms....', '.....sms.....', '.....sms.....', '......s......', '......s......'],
  burn: ['.....h.......', '.....hh......', '....hmh......', '....hmmh..h..', '...hmmmh.hh..', '..hmmmmmhmh..', '..hmmymmmmmh.', '.hmmyymmmmmh.', '.hmyywymmmms.', '.hmyywwymmms.', '.hmmyywymmms.', '..smmyymmss..', '...sssssss...'],
  duel: ['hh.........hh', 'hmh.......hmh', '.hmh.....hmh.', '..hmh...hmh..', '...hmh.hmh...', '....hmwmh....', '.....mwm.....', '....hmsmh....', '...hms.hms...', '.dddd...dddd.', '..ss.....ss..', '.ss.......ss.', 'yy.........yy'],
  idle: ['.............', '.....hhhhhhh.', '.........hms.', '........hms..', '.......hms...', '......hms....', '.....hmmmmmm.', '.............', 'hhhhh........', '..hms........', '.hms.........', 'hmmmm........', '.............'],
  rattle: ['...hhhhhhh...', '..hmmmmmmms..', '.hmmmmmmmmms.', '.hmmmmmmmmms.', '.hmddmmmddms.', '.hmddmmmddms.', '.hmmmmdmmmms.', '..hmmmmmmms..', '...smmmmms...', '...mdmdmdm...', '...sssssss...', '.............', '.............'],
  charge: ['.......hhhh..', '......hmms...', '.....hmms....', '....hmms.....', '...hmmmhhhh..', '..hmmmmmmms..', '..sssmmmms...', '.....hmms....', '....hmms.....', '...hmms......', '..hms........', '.hs..........', '.............'],
};
function glyphFn(id: string): (x: number, y: number) => string | null {
  const m = GLYPH_MAP[id];
  if (m) return (x, y) => (m[y][x] === '.' ? null : m[y][x]);
  const c = 6;
  if (id === 'thorns') return (x, y) => {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy);
    if (r <= 3.3) return r < 1.5 ? 'w' : dx + dy < 0 ? 'h' : dx + dy > 2 ? 's' : 'm';
    if ((dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) && r <= 6.1) return r > 5 ? 'h' : 'm';
    return null;
  };
  if (id === 'chill') return (x, y) => {
    const dx = x - c, dy = y - c, ax = Math.abs(dx), ay = Math.abs(dy);
    if (!dx && !dy) return 'w';
    if ((!dx || !dy || ax === ay) && Math.max(ax, ay) <= 6) return Math.max(ax, ay) >= 5 ? 'h' : 'm';
    if ((ax === 1 && ay === 4) || (ay === 1 && ax === 4)) return 'h';
    return null;
  };
  // 机制徽记：狙击准星 / 溅射水花 / 连击双斩 / 轮换环箭
  if (id === 'snipe') return (x, y) => {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy), ax = Math.abs(dx), ay = Math.abs(dy);
    if (!dx && !dy) return 'w';
    if ((!dx && ay >= 2) || (!dy && ax >= 2)) return Math.max(ax, ay) >= 5 ? 'h' : 'm';
    if (r >= 3.6 && r <= 5.2 && ax > 1 && ay > 1) return r > 4.5 ? 'h' : 's';
    return null;
  };
  if (id === 'splash') return (x, y) => {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy);
    if (r <= 2.2) return r < 1.2 ? 'w' : 'h';
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + Math.PI / 6;
      if (Math.hypot(dx - 4.6 * Math.cos(a), dy - 4.6 * Math.sin(a)) <= 1.3) return 'm';
      if (Math.hypot(dx - 3 * Math.cos(a - Math.PI / 6), dy - 3 * Math.sin(a - Math.PI / 6)) <= 0.6) return 's';
    }
    return null;
  };
  if (id === 'combo') return (x, y) => {
    if (x < 1 || x > 11 || y < 1 || y > 11) return null;
    for (const k of [9, 15]) { const d = Math.abs(x + y - k); if (d === 0) return 'w'; if (d === 1) return 'm'; }
    return null;
  };
  if (id === 'rotate') return (x, y) => {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy);
    let a = Math.atan2(dy, dx); if (a < 0) a += Math.PI;
    if (a < 0.35 || a > Math.PI - 0.05) return null;
    const hw = a < 0.95 ? 0.9 + (1.6 * (a - 0.35)) / 0.6 : 0.9;
    const d = Math.abs(r - 4.5);
    if (d <= hw) return a < 0.95 ? 'w' : d < 0.4 ? 'h' : 'm';
    return null;
  };
  // freeze：冰块
  return (x, y) => {
    if (x < 1 || y < 1 || x > 11 || y > 11) return null;
    if (x === 11 || y === 11) return 's';
    if (x === 1 || y === 1) return 'h';
    if (x + y === 7 || x + y === 8 || x + y === 15) return 'w';
    return 'm';
  };
}
function glyph(id: string, pal: GlyphPal, o = '#0b0612') {
  const f = glyphFn(id);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x > 12 || y > 12 ? null : f(x, y));
  return paint(15, 15, (x, y) => {
    const v = at(x - 1, y - 1);
    if (v) return pal[v] ?? pal.m;
    return at(x - 2, y - 1) || at(x, y - 1) || at(x - 1, y - 2) || at(x - 1, y) ? o : null;
  });
}
const GLYPH_PAL: Record<string, GlyphPal> = {
  armor: { h: '#eef3fb', m: '#9aa8c0', s: '#56627c', d: '#1a1e2c' },
  block: { h: '#fff1b8', m: '#e0a63a', s: '#8a5414', d: '#6a3a0c', w: '#ffffff' },
  power: { h: '#f2dcff', m: '#b46cff', s: '#5e2a9e', w: '#ffffff' },
  thorns: { h: '#ffd0b8', m: '#e8603a', s: '#8a2a14', w: '#ffe9a8' },
  chill: { h: '#e8fdff', m: '#6fdcff', s: '#3a9ec0', w: '#ffffff' },
  freeze: { h: '#ffffff', m: '#9fe4ff', s: '#3f8fbf', w: '#e8fbff' },
  burn: { h: '#ffb347', m: '#f0522a', s: '#8a1a10', y: '#ffd84a', w: '#fffbe0' },
  charge: { h: '#fff6b0', m: '#ffcf4a', s: '#a8700e' },
  snipe: { h: '#d6ffb0', m: '#7ee05a', s: '#3a8a26', w: '#ffffff' },
  duel: { h: '#ffffff', m: '#c9d3e6', s: '#7a3a1e', d: '#e8394f', y: '#ffd36b', w: '#ffffff' },
  splash: { h: '#ffe0a0', m: '#ff9a3d', s: '#c0501a', w: '#ffffff' },
  combo: { h: '#ffd0e6', m: '#ff7ab0', s: '#a83a6a', w: '#ffffff' },
  rotate: { h: '#c4fff4', m: '#3cc8b4', s: '#16665e', w: '#ffffff' },
  idle: { h: '#e6ecff', m: '#9aa6cc', s: '#4a5478' },
  rattle: { h: '#f2dcff', m: '#c9a8f0', s: '#6a3aa8', d: '#1a0830' },
};
/** 嘲讽：身后的钢盾（金边、左亮右暗、中央盾钉），19×23 + 描边 */
function tauntShield() {
  const W = 19, H = 23, cx = 9;
  // 凸顶、两侧从上往下收、底部尖：像纹章盾而不是门板
  const top = (x: number) => 2.4 * ((x - cx) / 9.5) ** 2;
  const half = (y: number) => (y <= 3 ? 9.5 : 9.5 * Math.sqrt(Math.max(0, 1 - ((y - 3) / 20) ** 2)));
  const inside = (x: number, y: number) => y >= top(x) && y < H && Math.abs(x - cx) <= half(y) - 0.4;
  return paint(W + 2, H + 2, (i, j) => {
    const x = i - 1, y = j - 1;
    if (!inside(x, y)) return inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1) ? '#0b0612' : null;
    const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1) || !inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2);
    if (rim) return x + y < 12 ? '#fff1b8' : x - y > 6 || y > 15 ? '#8a5414' : '#e0a63a';
    const br = Math.hypot(x - cx, y - 8);
    if (br <= 2.6) return br < 1.2 ? '#ffffff' : x + y < 17 ? '#fff1b8' : '#c08428';
    if (x === cx) return '#3a3f5c';
    if (y === 8) return x < cx ? '#a8b2cc' : '#3a3f5c';
    return x < cx ? (x <= 3 ? '#b8c2da' : '#8e98b8') : '#56607c';
  });
}

/* ───────── 调色板 ───────── */
const P = {
  gold: { o: '#0b0716', h: '#fff1b8', m: '#e0a63a', s: '#8a5414', d: '#2a1a08', g: '#fff1b8' },
  steel: { o: '#05051a', h: '#8e8ad6', m: '#4b4896', s: '#26235a', d: '#0e0c2a', g: '#ffd36b' },
  teal: { o: '#04121a', h: '#c4fff4', m: '#3cc8b4', s: '#16665e', d: '#082422', g: '#c4fff4' },
  red: { o: '#14040a', h: '#ffb8c3', m: '#e8394f', s: '#7a1024', d: '#2a0610', g: '#ffd36b' },
  dim: { o: '#05051a', h: '#5c5a9a', m: '#33306a', s: '#1c1a44', d: '#0b0a22' },
  moss: { o: '#04140a', h: '#c8ffb0', m: '#4ea844', s: '#1f5a26', d: '#0a2410', g: '#ffd36b' },
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
  for (const f of Object.keys(FACTION_INFO) as Faction[]) {
    const { frame: fr, mask } = factionFrame(factionPal(f), FRAME_SPECS[f]);
    vars[`--pxf-${f}`] = url(fr);
    vars[`--pxm-${f}`] = url(mask);
    vars[`--pxs-${f}`] = url(sigil(f, factionPal(f)));
  }
  const atk = { o: '#000', h: '#ffe9a8', m: '#f5a83a', s: '#c0601a', d: '#7a3008' };
  const hp = { o: '#000', h: '#ffc0c6', m: '#e8394f', s: '#a81c34', d: '#5c0a1c' };
  const hurt = { o: '#000', h: '#e8a0a8', m: '#a8263c', s: '#781428', d: '#3a0612' };
  const zero = { o: '#000', h: '#c8cce0', m: '#8a90aa', s: '#5c6280', d: '#353a52' };
  vars['--px-atk'] = url(statGem('atk', atk));
  vars['--px-hp'] = url(statGem('hp', hp));
  vars['--px-hp-hurt'] = url(statGem('hp', hurt));
  vars['--px-atk-zero'] = url(statGem('atk', zero));
  vars['--px-hp-zero'] = url(statGem('hp', zero));
  // 稀有度宝石：普通灰 / 稀有蓝 / 史诗紫 / 传说金，卡底按星数排列
  // 六阶稀有度：铜 / 青绿 / 蓝 / 紫 / 橙金 / 赤金（与 card-tiers.css 的 --tc 系列一致）
  const RARITY_PAL: Pal[] = [
    { o: '#140b04', h: '#f6e6c8', m: '#bf9a70', s: '#6e5236', d: '#2e2214' },
    { o: '#03140c', h: '#d8ffe8', m: '#46d890', s: '#1a7a4c', d: '#0c3220' },
    { o: '#040c1e', h: '#d6ecff', m: '#4a9cff', s: '#1c4fa8', d: '#0a2050' },
    { o: '#10061e', h: '#f2dcff', m: '#b46cff', s: '#5e2a9e', d: '#260c44' },
    { o: '#1a0c02', h: '#fff6cc', m: '#ffac2e', s: '#a8580e', d: '#3a1e04' },
    { o: '#1e0206', h: '#fff2b0', m: '#ff4a4a', s: '#a8162a', d: '#4a0610' },
  ];
  RARITY_PAL.forEach((p, i) => (vars[`--pxr-${i + 1}`] = url(gem(p, 7, 7))));
  for (const [k, p] of Object.entries(GLYPH_PAL)) vars[`--pxk-${k}`] = url(glyph(k, p));
  vars['--px-taunt'] = url(tauntShield());
  vars['--px-crown'] = url(crown());
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
