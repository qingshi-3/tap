// 主将技能的专属像素演出。每位主将四拍：起手（压暗/氛围）→ 蓄势（预兆）→ 命中（大件+震屏）→ 余韵（残留印记）。
// 每位都有一个占画面 1/3 以上的「大件」，并占用不同的画面方向：
//   阿尔吉昂 天→地光柱 · 卡雷奥斯 全屏斜斩 · 莉莉丝 跨两军锁链 · 瓦尔坎 屏外陨石
//   法伊 地面冰封 · 齐瑞克斯 夜空星座 · 赫克 阵地中央插旗
// 精灵首次使用时逐像素生成并缓存；1 个精灵像素 = 4 个舞台像素，同屏颗粒统一。
// 演出只动 transform/opacity；lite（2 倍速及以上）跳过起手与蓄势，只留大件与命中。
import { h } from './dom';
import type { FX } from './fx';

export interface Pt { x: number; y: number }
export interface GfxUnit { lunge(): void; pulse(color: string): void }
export interface GfxHost {
  fx: FX;
  lite: boolean;
  /** 放一个临时节点并播放关键帧，结束后自动移除；ms 为 1 倍速时长；back = 放在单位之上、粒子之下 */
  play(el: HTMLElement, frames: Keyframe[], ms: number, o?: { delay?: number; easing?: string; back?: boolean }): Promise<void>;
  wait(ms: number): Promise<void>;
}
/** tgts/units 一一对应；allies = 我方在场单位（前排在前） */
export interface GenFxArgs { tgts: Pt[]; units: GfxUnit[]; allies: Pt[]; color: string }

// ───────── 精灵生成 ─────────
type Px = string | null;
type Plot = (x: number, y: number, c: Px) => void;
const cache = new Map<string, string>();
function canvas(key: string, w: number, hgt: number, draw: (px: Plot) => void) {
  let u = cache.get(key);
  if (u) return u;
  const c = document.createElement('canvas');
  c.width = w; c.height = hgt;
  const g = c.getContext('2d')!;
  draw((x, y, v) => { if (v) { g.fillStyle = v; g.fillRect(Math.round(x), Math.round(y), 1, 1); } });
  u = c.toDataURL();
  cache.set(key, u);
  return u;
}
const sprite = (key: string, w: number, hgt: number, fn: (x: number, y: number) => Px) =>
  canvas(key, w, hgt, (px) => { for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) px(i, j, fn(i, j)); });
const art = (key: string, rows: string[], pal: Record<string, string>) =>
  sprite(key, rows[0].length, rows.length, (x, y) => pal[rows[y][x]] ?? null);
function line(px: Plot, x0: number, y0: number, x1: number, y1: number, c: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
}
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const dith = (x: number, y: number) => B4[(y & 3) * 4 + (x & 3)];

// 光
const pillar = () => sprite('pillar', 20, 96, (x, y) => {
  const d = Math.abs(x - 9.5) / 10, top = Math.min(1, y / 26);
  const v = (1 - d) * top + dith(x, y) * 0.35 - 0.2;
  if (v < 0.12) return null;
  return v > 0.62 ? '#ffffff' : v > 0.42 ? '#fff3b0' : v > 0.26 ? '#ffd36b' : '#c98a1e';
});
const ray = () => sprite('ray', 5, 64, (x, y) => {
  const v = (1 - Math.abs(x - 2) / 2.5) * Math.min(1, y / 10) * (1 - y / 64) + dith(x, y) * 0.4 - 0.2;
  return v < 0.15 ? null : v > 0.45 ? '#fff6cc' : 'rgba(255,211,107,.8)';
});
const dome = () => sprite('dome', 24, 28, (x, y) => {
  const dx = x - 11.5, dy = y - 13.5;
  const ins = (W: number, H: number) => Math.abs(dx) <= W && Math.abs(dy) <= H - (Math.abs(dx) * H) / 2 / W;
  if (!ins(11, 13.5)) return null;
  if (!ins(9.6, 11.6)) return dx < 0 && dy < 0 ? '#ffffff' : '#ffe08a';
  if (!ins(8.4, 10.2)) return dith(x, y) > 0.5 ? 'rgba(255,233,168,.7)' : null;
  return dith(x, y) < 0.18 ? 'rgba(255,240,180,.55)' : null;
});

// 影
const gash = () => sprite('gash', 320, 7, (x, y) => {
  const th = 3.5 * Math.pow(Math.sin((Math.PI * x) / 319), 0.6), e = Math.abs(y - 3);
  if (e > th) return null;
  return e < th * 0.4 ? '#ffffff' : e < th * 0.75 ? '#ffc2c8' : '#ff3b4f';
});
const wound = () => sprite('wound', 15, 15, (x, y) => {
  const d = Math.min(Math.abs(x - y), Math.abs(x + y - 14));
  return d <= 0.6 ? '#ff8a95' : d <= 1.6 ? '#c41a30' : null;
});

// 渊
const vortex = () => sprite('vortex', 45, 45, (x, y) => {
  const dx = x - 22, dy = y - 22, r = Math.hypot(dx, dy);
  if (r > 22.2) return null;
  if (Math.abs(Math.sin(Math.atan2(dy, dx) + r * 0.26)) < 0.55 - dith(x, y) * 0.3) return null;
  return r < 5 ? '#ffffff' : r < 11 ? '#e2b8ff' : r < 17 ? '#b77bff' : '#4a1f88';
});
const link = () => art('link', ['..hhhhh..', '.hhwwwhh.', 'hm.....mh', 'mm.....mm', '.mmmmmmm.', '..ddddd..'], { h: '#f0d6ff', w: '#ffffff', m: '#9d5cf0', d: '#4a1f88' });
const heart = () => {
  const ins = (x: number, y: number) => {
    const X = ((x - 5) / 5.2) * 1.3, Y = ((4.5 - y) / 4.5) * 1.3 + 0.2;
    return (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0;
  };
  return sprite('heart', 11, 10, (x, y) => {
    if (!ins(x, y)) return null;
    if (!ins(x - 1, y) || !ins(x + 1, y) || !ins(x, y - 1) || !ins(x, y + 1)) return '#2a0b3d';
    return x < 4 && y < 4 ? '#ffd6ff' : x > 6 && y > 4 ? '#8a3ccf' : '#d77bff';
  });
};

// 炎
const shadow = () => sprite('shadow', 24, 8, (x, y) => {
  const r = Math.hypot((x - 11.5) / 12, (y - 3.5) / 4);
  return r < 1 && dith(x, y) < 0.6 * (1 - r) + 0.25 ? 'rgba(0,0,0,.6)' : null;
});
const meteor = () => sprite('meteor', 56, 20, (x, y) => {
  const dy = y - 9.5, r = Math.hypot(x - 46, dy);
  if (r < 8) return r < 3 ? '#ffffff' : r < 5.5 ? '#fff0a0' : '#ffb340';
  if (x > 46) return null;
  const spread = 8 * (x / 46), d = Math.abs(dy);
  if (d > spread) return null;
  const v = (x / 46) * (1 - d / (spread + 0.01)) + dith(x, y) * 0.4 - 0.2;
  if (v < 0.12) return null;
  return v > 0.6 ? '#ffd24a' : v > 0.35 ? '#ff8a2a' : '#c8301a';
});
const crater = () => sprite('crater', 32, 8, (x, y) => {
  const r = Math.hypot((x - 15.5) / 16, (y - 3.5) / 4);
  if (r > 1) return null;
  return r > 0.75 ? '#5a1a0a' : r > 0.45 ? (dith(x, y) > 0.3 ? '#ff6a2a' : '#b82814') : dith(x, y) > 0.5 ? '#ffd24a' : '#ff8a2a';
});
const flame = () => sprite('flame', 18, 56, (x, y) => {
  const top = 8 + Math.abs(Math.sin(x * 1.3)) * 12 + (x % 3) * 3, edge = Math.abs(x - 8.5) / 9;
  if (y < top || edge > 1 - (y - top) / 90) return null;
  const v = (y - top) / (56 - top) + dith(x, y) * 0.3 - edge * 0.5;
  return v > 0.75 ? '#fff1a0' : v > 0.45 ? '#ffb340' : v > 0.2 ? '#ff6a2a' : '#b82814';
});

// 霜
const icefloor = () => sprite('icefloor', 16, 6, (x, y) =>
  y === 0 ? (x % 4 !== 3 ? '#e6fbff' : null) : y === 1 ? '#9ff0ff' : dith(x, y) > 0.55 ? 'rgba(111,230,255,.55)' : 'rgba(58,168,216,.35)');
const crystal = () => sprite('crystal', 22, 34, (x, y) => {
  const half = y < 8 ? (10 * y) / 8 : y > 28 ? (10 * (33 - y)) / 5 : 10, dx = x - 10.5;
  if (Math.abs(dx) > half) return null;
  if (Math.abs(dx) > half - 1.2) return '#e6fbff';
  if ((x + y) % 9 === 0 && dx < 0) return '#ffffff';
  return dx < -3 ? 'rgba(200,245,255,.85)' : dx < 3 ? 'rgba(140,225,255,.75)' : 'rgba(60,160,220,.8)';
});
const icicle = () => sprite('icicle', 7, 24, (x, y) => {
  const half = (y / 23) * 3.5, dx = x - 3;
  if (Math.abs(dx) > half) return null;
  return dx < -half * 0.4 ? '#ffffff' : dx < half * 0.3 ? '#9ff0ff' : '#3aa8d8';
});
const FLAKE = ['.....w.....', '..w..w..w..', '...w.w.w...', '....bwb....', '.w..wcw..w.', 'wwwwcccwwww', '.w..wcw..w.', '....bwb....', '...w.w.w...', '..w..w..w..', '.....w.....'];
const flake = () => art('flake', FLAKE, { w: '#e6fbff', b: '#6fe6ff', c: '#ffffff' });

// 沙
const SIGIL: [number, number][] = [[4, 20], [14, 10], [32, 5], [50, 10], [60, 20], [50, 30], [32, 35], [14, 30], [32, 20]];
const sigilStars = () => canvas('sigilS', 64, 40, (px) => {
  SIGIL.forEach(([x, y], i) => {
    const r = i === 8 ? 2 : 1;
    for (let k = -r; k <= r; k++) { px(x + k, y, '#ffd36b'); px(x, y + k, '#ffd36b'); }
    px(x, y, '#ffffff');
  });
});
const sigilLines = () => canvas('sigilL', 64, 40, (px) => {
  const c = 'rgba(255,226,160,.75)';
  for (let i = 0; i < 8; i++) line(px, ...SIGIL[i], ...SIGIL[(i + 1) % 8], c);
  line(px, 32, 5, 32, 35, c); line(px, 14, 20, 50, 20, 'rgba(197,144,255,.7)');
});
const starbeam = () => sprite('starbeam', 8, 40, (x, y) => {
  const v = 1 - Math.abs(x - 3.5) / 4 + dith(x, y) * 0.3 - 0.15;
  return v > 0.7 ? '#ffffff' : v > 0.45 ? '#ffe2a0' : v > 0.2 ? '#c590ff' : null;
});
const rune = () => sprite('rune', 48, 18, (x, y) => {
  const dx = (x - 23.5) / 23.5, dy = (y - 8.5) / 8.5, r = Math.hypot(dx, dy);
  if (Math.abs(r - 0.92) < 0.09) return '#ffe2a0';
  if (Math.abs(r - 0.62) < 0.08 && dith(x, y) > 0.35) return '#e9bd72';
  if (r < 0.62 && r > 0.15 && Math.abs(Math.sin(Math.atan2(dy, dx) * 2.5)) < 0.12) return '#c590ff';
  return null;
});
const sight = () => sprite('sight', 17, 17, (x, y) => {
  if (Math.abs(x - 8) + Math.abs(y - 8) <= 1) return '#ffffff';
  const border = x < 2 || x > 14 || y < 2 || y > 14, corner = (x < 5 || x > 11) && (y < 5 || y > 11);
  return border && corner ? '#ff9ad5' : null;
});
const STAR = ['...w...', '...w...', '..wyw..', 'wwyWyww', '..wyw..', '...w...', '...w...'];
const star = () => art('star', STAR, { w: '#fff3c8', y: '#ffd36b', W: '#ffffff' });

// 号令
const bigBanner = () => sprite('bigBanner', 24, 72, (x, y) => {
  if (Math.abs(x - 4) + Math.abs(y - 2) <= 2) return '#ffd36b';
  if (x >= 3 && x <= 5 && y >= 4 && y <= 68) return x === 3 ? '#e0b070' : '#8a5a2a';
  if (x === 4 && y > 68) return '#cfd6e6';
  if (x < 6 || y < 6 || y > 44) return null;
  if (y > 36 && Math.abs(x - 15) < (y - 36) * 1.3) return null;
  if (x === 23 || y === 6) return '#7a1e0c';
  if (y < 10) return '#ffd36b';
  const c1 = y - 16 - Math.abs(x - 15), c2 = y - 23 - Math.abs(x - 15);
  if ((c1 >= 0 && c1 <= 2) || (c2 >= 0 && c2 <= 2)) return '#ffd36b';
  return x > 15 && dith(x, y) > 0.55 ? '#d94a1f' : '#ff6a33';
});
const wave = () => sprite('wave', 8, 40, (x, y) => {
  const e = Math.abs(Math.hypot(x + 10, (y - 20) * 0.9) - 15.5), th = 1.8 * (1 - Math.abs(y - 20) / 22);
  return e > th ? null : e < th * 0.45 ? '#ffffff' : '#ffd36b';
});
const streak = () => sprite('streak', 16, 2, (x, y) => (y === 0 ? (x > 3 ? '#fff3c8' : null) : x > 6 ? '#ffd36b' : null));

// ───────── 公用 ─────────
const PX = 4;
function node(url: string, w: number, hgt: number, at: Pt, origin = '50% 50%') {
  const [ox, oy] = origin.split(' ').map((s) => parseFloat(s) / 100);
  const W = w * PX, H = hgt * PX;
  return h('div', {
    class: 'gfx',
    style: `left:${at.x - W * ox}px;top:${at.y - H * oy}px;width:${W}px;height:${H}px;background-image:url("${url}");transform-origin:${origin}`,
  });
}
const feet = (p: Pt) => ({ x: p.x, y: p.y + 40 });
const head = (p: Pt) => ({ x: p.x, y: p.y - 58 });
const deg = (r: number) => (r * 180) / Math.PI;
const hold = (peak = 1): Keyframe[] => [{ opacity: 0 }, { opacity: peak, offset: 0.2 }, { opacity: peak, offset: 0.75 }, { opacity: 0 }];
/** 整屏氛围层（单位之上、粒子之下） */
const backdrop = (g: GfxHost, bg: string, ms: number, peak = 1) =>
  g.play(h('div', { class: 'gfx-full', style: `background:${bg}` }), hold(peak), ms, { back: true });
const vignette = (g: GfxHost, c: string, ms: number) =>
  backdrop(g, `radial-gradient(ellipse 70% 65% at 50% 45%, transparent 42%, ${c} 100%)`, ms);
const shakeS = (g: GfxHost) => g.fx.shake(3, 160);
const shakeM = (g: GfxHost, xOnly = false) => g.fx.shake(6, 240, xOnly);
const shakeL = (g: GfxHost) => g.fx.shake(11, 320);
const stagger = (g: GfxHost, a: GenFxArgs, gap: number, fn: (p: Pt, i: number) => Promise<void>) =>
  Promise.all(a.tgts.map(async (p, i) => { await g.wait(i * gap); await fn(p, i); }));

// ───────── 阿尔吉昂：云开天光，圣光柱落下，六边形圣盾合拢 ─────────
async function argeon(g: GfxHost, a: GenFxArgs) {
  if (!g.lite) { void backdrop(g, '#1a1206', 1400, 0.35); void vignette(g, 'rgba(255,211,107,.5)', 1400); }
  await stagger(g, a, 90, async (p) => {
    const f = feet(p);
    if (!g.lite) {
      [-70, -25, 25, 70].forEach((dx, k) => {
        const r = node(ray(), 5, 64, { x: p.x + dx * 1.6, y: 0 }, '50% 0%');
        const ang = deg(Math.atan2(dx * 1.3, f.y));
        void g.play(r, [
          { opacity: 0, transform: `rotate(${ang}deg) scaleY(.3)` },
          { opacity: 0.85, transform: `rotate(${ang}deg) scaleY(1)`, offset: 0.35 },
          { opacity: 0, transform: `rotate(${ang}deg) scaleY(1.05)` },
        ], 1000, { delay: k * 50 });
      });
      await g.wait(240);
    }
    void g.play(node(pillar(), 20, 96, f, '50% 100%'), [
      { opacity: 0, transform: 'scaleX(.2) scaleY(.2)' },
      { opacity: 1, transform: 'scaleX(1.15) scaleY(1)', offset: 0.22 },
      { opacity: 0.95, transform: 'scaleX(.85) scaleY(1)', offset: 0.7 },
      { opacity: 0, transform: 'scaleX(.2) scaleY(1)' },
    ], 1000, { easing: 'ease-out' });
    g.fx.ring(f.x, f.y, '#ffe9a8', 100, 30);
    await g.wait(180);
    shakeS(g);
    g.fx.flash('#fff3b0', 0.12, 200);
    g.fx.burst(p.x, f.y, '#fff3b0', { n: 20, speed: 1.4, kind: 'mote', size: 2.6, up: 3.2, gravity: -0.04, life: 44 });
    g.fx.burst(p.x, p.y, '#7dff9a', { n: 8, speed: 1, kind: 'plus', size: 3, up: 2.2, gravity: -0.03, life: 50 });
    await g.play(node(dome(), 24, 28, { x: p.x, y: p.y - 4 }), [
      { opacity: 0, transform: 'scale(1.7)' },
      { opacity: 1, transform: 'scale(.94)', offset: 0.22 },
      { opacity: 1, transform: 'scale(1)', offset: 0.6 },
      { opacity: 0, transform: 'scale(.72)' },
    ], 820, { easing: 'cubic-bezier(.2,.9,.3,1)' });
    g.fx.burst(p.x, p.y, '#ffe08a', { n: 10, speed: 2, kind: 'mote', size: 2.4, life: 20, gravity: 0 });
  });
}

// ───────── 卡雷奥斯：画面骤暗，两道贯穿全屏的血色斩痕 ─────────
async function kaleos(g: GfxHost, a: GenFxArgs) {
  if (!g.lite) {
    void backdrop(g, '#05000a', 1000, 0.62);
    a.units.forEach((u) => u.pulse('#ffffff'));
    await g.wait(160);
  }
  await stagger(g, a, 140, async (p) => {
    const L = 640;
    const cut = (d: number) => {
      const r = (d * Math.PI) / 180;
      const s = node(gash(), 320, 7, { x: p.x - Math.cos(r) * L, y: p.y - Math.sin(r) * L }, '0% 50%');
      return g.play(s, [
        { opacity: 1, transform: `rotate(${d}deg) scaleX(0) scaleY(1)` },
        { opacity: 1, transform: `rotate(${d}deg) scaleX(1) scaleY(1)`, offset: 0.18 },
        { opacity: 1, transform: `rotate(${d}deg) scaleX(1) scaleY(.6)`, offset: 0.55 },
        { opacity: 0, transform: `rotate(${d}deg) scaleX(1) scaleY(0)` },
      ], 540, { easing: 'cubic-bezier(.2,.9,.3,1)' });
    };
    const spill = (d: number) => {
      const r = (d * Math.PI) / 180;
      for (const k of [-120, -50, 0, 50, 120])
        g.fx.burst(p.x + Math.cos(r) * k, p.y + Math.sin(r) * k, '#ff5f6d', { n: k ? 4 : 14, speed: k ? 2.5 : 6, kind: 'shard', size: 4, life: 24, gravity: 0.2 });
    };
    void cut(32);
    await g.wait(110);
    shakeM(g); spill(32);
    void cut(148);
    await g.wait(110);
    shakeL(g); spill(148);
    g.fx.flash('#ff2a40', 0.14, 220);
    g.fx.burst(p.x, p.y, '#2a0b18', { n: 12, speed: 3, kind: 'mote', size: 3, life: 30, gravity: 0 });
    await g.play(node(wound(), 15, 15, p), [
      { opacity: 0, transform: 'scale(1.4)' },
      { opacity: 1, transform: 'scale(1)', offset: 0.15 },
      { opacity: 1, transform: 'scale(1)', offset: 0.6 },
      { opacity: 0, transform: 'scale(1)' },
    ], 640);
  });
}

// ───────── 莉莉丝：深渊漩涡张开，紫色锁链跨越两军把生命抽回我方 ─────────
const bez = (a: Pt, m: Pt, b: Pt, t: number) => ({
  x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * m.x + t * t * b.x,
  y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * m.y + t * t * b.y,
});
async function lilithe(g: GfxHost, a: GenFxArgs) {
  if (!g.lite) void vignette(g, 'rgba(90,20,150,.75)', 1700);
  a.tgts.forEach((p) => {
    void g.play(node(vortex(), 45, 45, feet(p)), [
      { opacity: 0, transform: 'scaleY(.42) rotate(0deg) scale(.3)' },
      { opacity: 1, transform: 'scaleY(.42) rotate(-200deg) scale(1)', offset: 0.3 },
      { opacity: 1, transform: 'scaleY(.42) rotate(-420deg) scale(1.05)', offset: 0.7 },
      { opacity: 0, transform: 'scaleY(.42) rotate(-600deg) scale(.6)' },
    ], 1400);
    g.fx.burst(p.x, p.y, '#b77bff', { n: 12, speed: 2, kind: 'mote', size: 2.6, up: -1, gravity: 0.05, life: 34 });
  });
  await g.wait(g.lite ? 120 : 320);
  const src = a.tgts[0], dst = a.allies[0];
  if (!src || !dst) { await g.wait(400); return; }
  const m = { x: (src.x + dst.x) / 2, y: Math.min(src.y, dst.y) - 240 };
  const n = Math.max(8, Math.round(Math.hypot(dst.x - src.x, dst.y - src.y) / 22));
  for (let k = 0; k <= n; k++) {
    const t = k / n, q = bez(src, m, dst, t), q2 = bez(src, m, dst, Math.min(1, t + 0.01));
    const r = deg(Math.atan2(q2.y - q.y, q2.x - q.x));
    void g.play(node(link(), 9, 6, q), [
      { opacity: 0, transform: `rotate(${r}deg) scale(.4)` },
      { opacity: 1, transform: `rotate(${r}deg) scale(1)`, offset: 0.12 },
      { opacity: 1, transform: `rotate(${r}deg) scale(1)`, offset: 0.8 },
      { opacity: 0, transform: `rotate(${r}deg) scale(.6)` },
    ], 1100, { delay: k * 18 });
  }
  shakeM(g);
  g.fx.burst(src.x, src.y, '#d77bff', { n: 16, speed: 4.5, kind: 'shard', size: 3.4, life: 26, gravity: 0.12 });
  await Promise.all(Array.from({ length: 8 }, async (_, i) => {
    await g.wait(140 + i * 60);
    const o = h('div', { class: 'gfx gfx-dot', style: `left:${src.x - 6}px;top:${src.y - 6}px` });
    const frames: Keyframe[] = [];
    for (let k = 0; k <= 10; k++) {
      const q = bez(src, m, dst, k / 10);
      frames.push({ opacity: k === 0 ? 0 : 1, transform: `translate(${q.x - src.x}px,${q.y - src.y}px) scale(${1 + Math.sin((k / 10) * Math.PI) * 0.4})` });
    }
    await g.play(o, frames, 520, { easing: 'ease-in' });
  }));
  g.fx.ring(dst.x, feet(dst).y, '#d77bff', 80);
  g.fx.burst(dst.x, dst.y, '#ffd6ff', { n: 12, speed: 2, kind: 'mote', size: 2.4, up: 1.5, gravity: -0.03, life: 34 });
  await g.play(node(heart(), 11, 10, head(dst)), [
    { opacity: 0, transform: 'scale(.3)' },
    { opacity: 1, transform: 'scale(1.3)', offset: 0.25 },
    { opacity: 1, transform: 'scale(1)', offset: 0.55 },
    { opacity: 0, transform: 'translateY(-18px) scale(1)' },
  ], 700);
}

// ───────── 瓦尔坎：地面阴影扩大，巨型陨石从屏外砸下，火坑与火柱 ─────────
async function vulkan(g: GfxHost, a: GenFxArgs) {
  if (!g.lite) void backdrop(g, '#3a0800', 1600, 0.32);
  await stagger(g, a, 170, async (p) => {
    const f = feet(p), fall = g.lite ? 320 : 520;
    if (!g.lite) void g.play(node(shadow(), 24, 8, f), [
      { opacity: 0, transform: 'scale(.2)' },
      { opacity: 0.9, transform: 'scale(1)', offset: 0.95 },
      { opacity: 0, transform: 'scale(1.1)' },
    ], fall + 60);
    const start = { x: p.x + 440, y: -140 };
    const d = Math.hypot(p.x - start.x, p.y - start.y), ang = deg(Math.atan2(p.y - start.y, p.x - start.x));
    await g.play(node(meteor(), 56, 20, start, '82% 50%'), [
      { opacity: 1, transform: `rotate(${ang}deg) translateX(0) scale(.8)` },
      { opacity: 1, transform: `rotate(${ang}deg) translateX(${d}px) scale(1.05)` },
    ], fall, { easing: 'cubic-bezier(.55,0,1,.7)' });
    shakeL(g);
    g.fx.flash('#ff8a2a', 0.18, 240);
    g.fx.ring(p.x, f.y, '#ffb340', 130, 28);
    g.fx.burst(p.x, p.y + 20, '#ffb340', { n: 30, speed: 7, kind: 'spark', size: 3, life: 30, gravity: 0.18 });
    g.fx.burst(p.x, p.y + 20, '#ff5a2a', { n: 16, speed: 1.4, kind: 'mote', size: 2.4, up: 3, gravity: -0.05, life: 54 });
    void g.play(node(crater(), 32, 8, f), hold(), 1000);
    await g.play(node(flame(), 18, 56, f, '50% 100%'), [
      { opacity: 0, transform: 'scaleY(.2) scaleX(.6)' },
      { opacity: 1, transform: 'scaleY(1.1) scaleX(1)', offset: 0.25 },
      { opacity: 0.9, transform: 'scaleY(.9) scaleX(1.05)', offset: 0.6 },
      { opacity: 0, transform: 'scaleY(1.2) scaleX(.5)' },
    ], 700, { easing: 'ease-out' });
  });
}

// ───────── 法伊：冰面从我方脚下铺向敌阵，冰晶封住目标后碎裂 ─────────
async function faie(g: GfxHost, a: GenFxArgs) {
  if (!g.lite) {
    void backdrop(g, '#02121c', 1600, 0.32);
    const y = feet(a.tgts[0]).y, from = (a.allies[0]?.x ?? 540) - 30;
    const to = Math.max(...a.tgts.map((p) => p.x)) + 70;
    const floor = h('div', {
      class: 'gfx gfx-tile',
      style: `left:${from}px;top:${y - 10}px;width:${Math.max(40, to - from)}px;height:24px;background-image:url("${icefloor()}");transform-origin:0 50%`,
    });
    void g.play(floor, [
      { opacity: 0, transform: 'scaleX(0)' },
      { opacity: 0.9, transform: 'scaleX(1)', offset: 0.25 },
      { opacity: 0.9, transform: 'scaleX(1)', offset: 0.8 },
      { opacity: 0, transform: 'scaleX(1)' },
    ], 1500, { easing: 'ease-out' });
    await g.wait(380);
  }
  await stagger(g, a, 110, async (p) => {
    const f = feet(p);
    const spikes = [-56, -30, 30, 56].map((dx) => g.play(node(icicle(), 7, 24, { x: f.x + dx, y: f.y + 4 }, '50% 100%'), [
      { opacity: 0, transform: `rotate(${dx * 0.4}deg) scaleY(0)`, easing: 'cubic-bezier(.2,1.4,.4,1)' },
      { opacity: 1, transform: `rotate(${dx * 0.4}deg) scaleY(1.1)`, offset: 0.2 },
      { opacity: 1, transform: `rotate(${dx * 0.4}deg) scaleY(1)`, offset: 0.7 },
      { opacity: 0, transform: `rotate(${dx * 0.4}deg) scaleY(1) translateY(6px)` },
    ], 860, { delay: 60 + Math.abs(dx) }));
    const block = g.play(node(crystal(), 22, 34, { x: f.x, y: f.y + 4 }, '50% 100%'), [
      { opacity: 0, transform: 'scaleY(0)', easing: 'cubic-bezier(.2,1.2,.4,1)' },
      { opacity: 1, transform: 'scaleY(1.08)', offset: 0.18 },
      { opacity: 1, transform: 'scaleY(1) translateX(0)', offset: 0.3 },
      { opacity: 1, transform: 'translateX(-3px)', offset: 0.52 },
      { opacity: 1, transform: 'translateX(3px)', offset: 0.58 },
      { opacity: 1, transform: 'translateX(0) scale(1)', offset: 0.64 },
      { opacity: 0, transform: 'scale(1.15)' },
    ], 900);
    await g.wait(580);
    shakeM(g);
    g.fx.flash('#bff4ff', 0.14, 200);
    g.fx.burst(p.x, p.y, '#e6fbff', { n: 26, speed: 5.5, kind: 'shard', size: 3.4, life: 30, gravity: 0.16 });
    g.fx.burst(p.x, p.y, '#6fe6ff', { n: 10, speed: 1.2, kind: 'mote', size: 2.2, up: 1, gravity: -0.02, life: 40 });
    void g.play(node(flake(), 11, 11, head(p)), [
      { opacity: 0, transform: 'rotate(-60deg) scale(.4)' },
      { opacity: 1, transform: 'rotate(0deg) scale(1)', offset: 0.3 },
      { opacity: 0, transform: 'rotate(40deg) scale(1)' },
    ], 640);
    await Promise.all([block, ...spikes]);
  });
}

// ───────── 齐瑞克斯：夜幕降临，星座拼出天眼，一束星光锁定目标 ─────────
async function zirix(g: GfxHost, a: GenFxArgs) {
  const c = { x: a.tgts.reduce((s, p) => s + p.x, 0) / a.tgts.length, y: 120 };
  if (!g.lite) {
    void backdrop(g, 'linear-gradient(#0a0820 0%, rgba(20,12,50,.85) 35%, transparent 64%)', 1800);
    const sk = (o0: number): Keyframe[] => [
      { opacity: 0, transform: 'scale(.92)' },
      { opacity: 0, transform: 'scale(.92)', offset: o0 },
      { opacity: 1, transform: 'scale(1)', offset: o0 + 0.25 },
      { opacity: 1, transform: 'scale(1)', offset: 0.72 },
      { opacity: 0, transform: 'scale(.1)' },
    ];
    void g.play(node(sigilStars(), 64, 40, c), sk(0), 980);
    void g.play(node(sigilLines(), 64, 40, c), sk(0.25), 980);
    await g.wait(720);
  }
  await stagger(g, a, 90, async (p) => {
    const top = g.lite ? { x: p.x, y: p.y - 260 } : c;
    const d = Math.hypot(p.x - top.x, p.y - top.y), r = deg(Math.atan2(-(p.x - top.x), p.y - top.y));
    void g.play(node(starbeam(), 8, 40, top, '50% 0%'), [
      { opacity: 1, transform: `rotate(${r}deg) scaleY(0)` },
      { opacity: 1, transform: `rotate(${r}deg) scaleY(${d / 160})`, offset: 0.3 },
      { opacity: 0, transform: `rotate(${r}deg) scaleY(${d / 160}) scaleX(.2)` },
    ], 460, { easing: 'ease-out' });
    await g.wait(140);
    shakeM(g);
    g.fx.flash('#c590ff', 0.1, 180);
    g.fx.burst(p.x, p.y, '#ffe2a0', { n: 20, speed: 4, kind: 'mote', size: 2.6, life: 30, gravity: 0 });
    g.fx.ring(p.x, feet(p).y, '#c590ff', 90);
    void g.play(node(rune(), 48, 18, feet(p)), [
      { opacity: 0, transform: 'scale(.2)' },
      { opacity: 1, transform: 'scale(1)', offset: 0.3 },
      { opacity: 1, transform: 'scale(1.05)', offset: 0.75 },
      { opacity: 0, transform: 'scale(1.2)' },
    ], 900, { easing: 'ease-out' });
    await g.play(node(sight(), 17, 17, p), [
      { opacity: 0, transform: 'scale(2.2) rotate(45deg)' },
      { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: 0.35 },
      { opacity: 1, transform: 'scale(1)', offset: 0.8 },
      { opacity: 0, transform: 'scale(.9)' },
    ], 640, { easing: 'cubic-bezier(.2,.9,.3,1)' });
    void g.play(node(star(), 7, 7, head(p)), [
      { opacity: 0, transform: 'scale(.4) rotate(0deg)' },
      { opacity: 1, transform: 'scale(1) rotate(90deg)', offset: 0.3 },
      { opacity: 0, transform: 'scale(.8) rotate(180deg)' },
    ], 520);
  });
}

// ───────── 赫克：宽银幕黑边压入，巨型战旗插进我方阵地，号令冲击波推着目标抢先出手 ─────────
async function hank(g: GfxHost, a: GenFxArgs) {
  const p0 = a.tgts[0];
  if (!p0) return;
  const xs = a.allies.length ? a.allies.map((p) => p.x) : [p0.x - 90];
  const home = { x: Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) / 2 - (a.allies.length > 1 ? 0 : 90), y: p0.y };
  const f = feet(home), total = g.lite ? 900 : 1400;
  if (!g.lite) for (const side of ['t', 'b']) {
    const y = side === 't' ? -64 : 64;
    void g.play(h('div', { class: `gfx-bar ${side}`, style: `--c:${a.color}` }), [
      { opacity: 1, transform: `translateY(${y}px)` },
      { opacity: 1, transform: 'translateY(0)', offset: 0.14 },
      { opacity: 1, transform: 'translateY(0)', offset: 0.86 },
      { opacity: 1, transform: `translateY(${y}px)` },
    ], total + 200);
  }
  const drop = 0.26;
  void g.play(node(bigBanner(), 24, 72, { x: home.x, y: f.y + 6 }, '18% 100%'), [
    { opacity: 1, transform: 'translateY(-480px)', easing: 'cubic-bezier(.5,0,1,1)' },
    { opacity: 1, transform: 'translateY(0) skewY(0deg)', offset: drop },
    { opacity: 1, transform: 'translateY(4px) skewY(0deg)', offset: drop + 0.04 },
    { opacity: 1, transform: 'translateY(0) skewY(-4deg)', offset: drop + 0.18 },
    { opacity: 1, transform: 'skewY(3deg)', offset: drop + 0.32 },
    { opacity: 1, transform: 'skewY(0deg) rotate(0deg)', offset: 0.85 },
    { opacity: 0, transform: 'rotate(-10deg)' },
  ], total);
  await g.wait(total * drop);
  shakeM(g, true);
  g.fx.ring(home.x, f.y, '#e0c8a0', 110, 22);
  g.fx.burst(home.x, f.y, '#b9a27a', { n: 18, speed: 3.5, kind: 'mote', size: 3, up: 1, gravity: 0.08, life: 28 });
  void g.play(node(wave(), 8, 40, { x: home.x + 10, y: f.y - 70 }), [
    { opacity: 1, transform: 'translateX(0) scaleX(.6)' },
    { opacity: 0, transform: `translateX(${Math.max(140, p0.x - home.x + 120)}px) scaleX(1.5)` },
  ], 460, { easing: 'ease-out' });
  await g.wait(200);
  await stagger(g, a, 80, async (p, i) => {
    a.units[i]?.lunge();
    g.fx.ring(p.x, feet(p).y, '#ffd36b', 90, 22);
    g.fx.burst(p.x, p.y, '#ffd36b', { n: 18, speed: 6, kind: 'spark', size: 2.6, life: 18, gravity: 0 });
    await Promise.all([-40, -18, 6, 26, 44].map((dy, k) => g.play(node(streak(), 16, 2, { x: p.x - 20 - (k % 2) * 24, y: p.y + dy }), [
      { opacity: 0, transform: 'translateX(30px)' },
      { opacity: 1, transform: 'translateX(0)', offset: 0.25 },
      { opacity: 0, transform: 'translateX(-90px)' },
    ], 380, { delay: k * 30 })));
  });
  await g.wait(total * (0.85 - drop) - 560);
}

const PLAYS: Record<string, (g: GfxHost, a: GenFxArgs) => Promise<void>> = { argeon, kaleos, lilithe, vulkan, faie, zirix, hank };
export const hasGenFx = (id: string) => id in PLAYS;
export const playGenFx = (id: string, g: GfxHost, a: GenFxArgs) => PLAYS[id](g, a);
