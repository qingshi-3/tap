// 拼土王国 · 纯程序化 Canvas 美术（无外部图片/字体/emoji）。
// 所有绘制都在 32 单位 = 1 格的设计空间里完成，再按 s/32 缩放；每个导出函数 save/restore，不残留状态。
// 随机全部由 seed 派生（mix + LCG），同参数结果稳定。

const INK = '#3b3a2c';
const GOLD = '#e3b65c', GOLD_L = '#f5d98e', GOLD_D = '#b5872f';
const TAU = Math.PI * 2;

/* ---------------- 随机 ---------------- */
function toInt(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed | 0;
  if (typeof seed === 'string') { let h = 7; for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0; return h; }
  return 0;
}
function mix(n) {
  n |= 0; n ^= n >>> 16; n = Math.imul(n, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return n;
}
function rng(seed) {
  let n = mix(toInt(seed) + 0x6d2b79f5);
  return () => { n = (Math.imul(n, 1664525) + 1013904223) | 0; return (mix(n) >>> 0) / 4294967296; };
}

/* ---------------- 基础图元 ---------------- */
function poly(c, pts) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
}
function fp(c, pts, fill, ink = INK, lw = 1) {
  poly(c, pts); c.fillStyle = fill; c.fill();
  if (ink) { c.strokeStyle = ink; c.lineWidth = lw; c.stroke(); }
}
function ell(c, x, y, rx, ry, fill, ink, lw = 1) {
  c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (ink) { c.strokeStyle = ink; c.lineWidth = lw; c.stroke(); }
}
function rect(c, x, y, w, h, fill, ink, lw = 1) {
  if (fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); }
  if (ink) { c.strokeStyle = ink; c.lineWidth = lw; c.strokeRect(x, y, w, h); }
}
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function line(c, x1, y1, x2, y2, color, lw = 1) {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = lw; c.stroke();
}
function shadow(c, x, y, rx, ry, a = .26) { ell(c, x, y, rx, ry, `rgba(40,36,18,${a})`); }

/* 3/4 视角山墙小屋：正面五边形 + 右侧墙 + 右坡屋面 */
function gable(c, x, by, fw, wh, gh, dx, dy, wall, side, roof, roofD, o = {}) {
  const ov = 1.4, top = by - wh, rx = x + fw / 2, ry = top - gh;
  shadow(c, x + (fw + dx) / 2 + 1, by + .3, (fw + dx) / 2 + 1.5, 2.4);
  fp(c, [x + fw, by, x + fw + dx, by + dy, x + fw + dx, top + dy, x + fw, top], side);
  fp(c, [x, by, x + fw, by, x + fw, top, rx, ry, x, top], wall);
  fp(c, [rx, ry, rx + dx, ry + dy, x + fw + dx + ov, top + dy + ov * .7, x + fw + ov, top + ov * .7], roof);
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - ov, top + ov * .7); c.lineTo(rx, ry); c.lineTo(x + fw + ov, top + ov * .7);
  c.strokeStyle = INK; c.lineWidth = 3.4; c.stroke(); c.strokeStyle = roofD; c.lineWidth = 1.6; c.stroke();
  line(c, rx + .6, ry + .3, rx + dx + .4, ry + dy + .3, 'rgba(255,255,255,.35)', .8);
  if (o.trim) { c.beginPath(); c.moveTo(x - ov + .6, top + ov * .7 - .4); c.lineTo(rx, ry + .6); c.lineTo(x + fw + ov - .6, top + ov * .7 - .4); c.strokeStyle = GOLD; c.lineWidth = .9; c.stroke(); }
  if (o.door !== false) rect(c, rx - 1.8, by - (o.doorH || 5), 3.6, o.doorH || 5, o.doorC || '#5a3b24', INK, .8);
  if (o.win !== false) {
    const wx = x + fw + dx / 2, wy = by + dy / 2 - wh * .55;
    fp(c, [wx - 1.3, wy - 1.2 + dy * .1, wx + 1.3, wy - 1.2 - dy * .1, wx + 1.3, wy + 1.4 - dy * .1, wx - 1.3, wy + 1.4 + dy * .1], o.winC || '#f7e3a1', INK, .7);
  }
  return [rx + dx / 2, ry + dy / 2];
}

/* 3/4 视角四坡顶大屋 */
function hip(c, x, by, fw, wh, rh, dx, dy, wall, side, roof, roofS, o = {}) {
  const ov = 1.4, top = by - wh;
  shadow(c, x + (fw + dx) / 2 + 1, by + .3, (fw + dx) / 2 + 1.8, 2.6);
  fp(c, [x + fw, by, x + fw + dx, by + dy, x + fw + dx, top + dy, x + fw, top], side);
  fp(c, [x, by, x + fw, by, x + fw, top, x, top], wall);
  const ry = top - rh + dy * .5, ins = Math.min(rh * .9, fw * .3);
  const rx1 = x + dx * .5 + ins, rx2 = Math.max(rx1 + .5, x + fw + dx * .5 - ins);
  fp(c, [x + fw + ov, top + ov * .5, x + fw + dx + ov * .6, top + dy + ov * .3, rx2, ry], roofS);
  fp(c, [x - ov, top + ov * .5, x + fw + ov, top + ov * .5, rx2, ry, rx1, ry], roof);
  line(c, x - ov + .8, top + ov * .5 - .6, x + fw + ov - .8, top + ov * .5 - .6, 'rgba(255,255,255,.28)', .8);
  if (o.trim) line(c, rx1, ry + .4, rx2, ry + .4, GOLD, 1.2);
  return { top, ry, rx1, rx2 };
}

/* 简单立方体（正面 + 右侧 + 顶面） */
function box(c, x, by, w, h, dx, dy, front, side, topC) {
  fp(c, [x + w, by, x + w + dx, by + dy, x + w + dx, by + dy - h, x + w, by - h], side);
  fp(c, [x, by, x + w, by, x + w, by - h, x, by - h], front);
  if (dx || dy) fp(c, [x, by - h, x + w, by - h, x + w + dx, by - h + dy, x + dx, by - h + dy], topC);
}

/* 圆塔：圆柱身 + 雉堞/锥顶 */
function tower(c, cx, by, w, h, o) {
  const x = cx - w / 2, ry = w * .24, top = by - h;
  shadow(c, cx + 1.5, by + .4, w * .65, 2.4);
  c.beginPath(); c.moveTo(x, top); c.lineTo(x, by); c.ellipse(cx, by, w / 2, ry, 0, Math.PI, 0, true); c.lineTo(x + w, top); c.closePath();
  c.fillStyle = o.wall; c.fill();
  c.save(); c.clip(); rect(c, cx + w * .16, top - 2, w, h + ry + 3, o.shade);
  if (o.bricks) { c.strokeStyle = 'rgba(70,60,45,.28)'; c.lineWidth = .6; for (let yy = by - 3; yy > top + 1; yy -= 3.6) line(c, x, yy, x + w, yy, 'rgba(70,60,45,.25)', .6); }
  c.restore();
  c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  if (o.slit) { rect(c, cx - .8, top + h * .3, 1.6, 3.4, '#2e2a22'); if (h > 14) rect(c, cx - .8, top + h * .62, 1.6, 3, '#2e2a22'); }
  let apex = top;
  if (o.crenel) {
    ell(c, cx, top, w / 2, ry, o.topC || o.shade, INK, .8);
    for (let i = 0; i < 3; i++) { const tx = x + .4 + i * (w - 2.2) / 2; rect(c, tx, top - 2.4, 2.2, 2.6, i === 2 ? o.shade : o.wall, INK, .7); }
    apex = top - 2.4;
  }
  if (o.roof) {
    const rh = o.roofH, b = top + (o.crenel ? -1 : .5);
    c.beginPath(); c.moveTo(x - 1.4, b); c.lineTo(cx, b - rh); c.lineTo(x + w + 1.4, b); c.ellipse(cx, b, w / 2 + 1.4, ry * .9, 0, 0, Math.PI, false); c.closePath();
    c.fillStyle = o.roof; c.fill();
    c.save(); c.clip(); fp(c, [cx, b - rh, x + w + 2, b, x + w + 2, b + ry + 1, cx + 1, b + ry + 1], o.roofS, null); c.restore();
    c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
    if (o.gold) line(c, x - .6, b + .3, x + w + .6, b + .3, GOLD, 1.1);
    apex = b - rh;
  }
  return apex;
}

function flag(c, x, yb, h, color, o = {}) {
  const yt = yb - h;
  line(c, x, yb, x, yt - .5, INK, 1);
  const fw = o.w || 6, fh = o.h || 3.6;
  if (o.tail) fp(c, [x + .4, yt, x + fw, yt + .3, x + fw - 1.6, yt + fh / 2, x + fw, yt + fh, x + .4, yt + fh], color, INK, .7);
  else fp(c, [x + .4, yt, x + fw, yt + fh * .45, x + .4, yt + fh], color, INK, .7);
  if (o.gold) ell(c, x, yt - .9, .9, .9, GOLD, INK, .5);
}

function puff(c, x, y, r) { ell(c, x, y, r, r * .85, '#ece8df', 'rgba(59,58,44,.55)', .7); ell(c, x - r * .3, y - r * .3, r * .35, r * .28, 'rgba(255,255,255,.8)'); }
function smoke(c, x, y, t, n = 3, dark = false, sc = 1) {
  const k = ((t || 0) * .6) % 1;
  for (let i = 0; i < n; i++) {
    const f = i + k, r = (1.7 + f * .7) * sc;
    const px = x + (f * 1.6 + Math.sin(f * 2.1) * .8) * sc, py = y - f * 3.4 * sc;
    if (dark) ell(c, px, py, r, r * .85, `rgba(92,86,78,${.92 - f * .2})`, `rgba(30,26,20,${.6 - f * .15})`, .7); else puff(c, px, py, r);
  }
}
function sparkle(c, x, y, r, color = '#fffbe6') {
  fp(c, [x, y - r, x + r * .28, y - r * .28, x + r, y, x + r * .28, y + r * .28, x, y + r, x - r * .28, y + r * .28, x - r, y, x - r * .28, y - r * .28], color, null);
}
function bush(c, x, y, r, col = '#5f9446', hi = '#7fb35a') {
  shadow(c, x + .6, y + r * .6, r * 1.05, r * .45, .22);
  ell(c, x, y, r, r * .88, col, INK, .8); ell(c, x - r * .3, y - r * .3, r * .45, r * .35, hi);
}
function coin(c, x, y, r) {
  ell(c, x, y, r, r, GOLD, INK, Math.max(.7, r * .14)); ell(c, x, y, r * .66, r * .66, null, GOLD_D, Math.max(.5, r * .1));
  ell(c, x - r * .3, y - r * .32, r * .26, r * .2, GOLD_L);
}

/* ---------------- 地形 ---------------- */
function tileStart(ctx, px, py, s) {
  ctx.save(); ctx.beginPath(); ctx.rect(px, py, s, s); ctx.clip();
  ctx.translate(px, py); ctx.scale(s / 32, s / 32); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
}
function bevel(c, strength = 1) {
  rect(c, 0, 30.6, 32, 1.4, `rgba(30,40,20,${.16 * strength})`);
  rect(c, 31.2, 0, .8, 32, `rgba(30,40,20,${.08 * strength})`);
  rect(c, 0, 0, 32, .7, `rgba(255,255,240,${.18 * strength})`);
}

const lerpHex = (a, b, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
/** deep: 0 = shallows by the island, 1 = open sea. */
export function drawSea(ctx, px, py, s, seed = 0, t = 0, deep = 1) {
  tileStart(ctx, px, py, s);
  const c = ctx, R = rng(seed);
  rect(c, 0, 0, 32, 32, lerpHex('#86c3c6', '#4f8ea8', Math.max(0, Math.min(1, deep))));
  for (let i = 0; i < 3; i++) ell(c, R() * 32, R() * 32, 4 + R() * 5, 2 + R() * 2, deep < .5 ? 'rgba(170,220,215,.3)' : 'rgba(60,120,150,.35)');
  const sh = (t || 0) * 3;
  for (let i = 0; i < 2; i++) {
    const wy = 7 + i * 14 + R() * 6, base = R() * 40, wx = ((base + sh * (i ? .7 : 1)) % 40) - 6;
    c.beginPath(); c.moveTo(wx, wy); c.quadraticCurveTo(wx + 2.5, wy - 2.2, wx + 5, wy); c.quadraticCurveTo(wx + 7.5, wy - 2.2, wx + 10, wy);
    c.strokeStyle = 'rgba(225,244,242,.75)'; c.lineWidth = 1.1; c.stroke();
  }
  if (R() < .35) sparkle(c, 4 + R() * 24, 4 + R() * 24, 1.3, 'rgba(255,255,255,.7)');
  ctx.restore();
}

export function drawWild(ctx, px, py, s, seed = 0) {
  tileStart(ctx, px, py, s);
  const c = ctx, R = rng(seed ^ 0x51ed);
  // Unclaimed land: quiet, low-contrast so the owned kingdom reads first.
  rect(c, 0, 0, 32, 32, '#939a7d');
  for (let i = 0; i < 3; i++) ell(c, R() * 32, R() * 32, 5 + R() * 6, 3 + R() * 3, R() < .5 ? 'rgba(140,146,110,.45)' : 'rgba(186,186,150,.45)');
  for (let i = 0; i < 2; i++) {
    const x = 6 + R() * 20, y = 8 + R() * 18;
    c.beginPath(); c.moveTo(x - 1.4, y - 1.4); c.lineTo(x, y); c.lineTo(x + 1.4, y - 1.4);
    c.strokeStyle = 'rgba(110,118,84,.5)'; c.lineWidth = .8; c.stroke();
  }
  c.strokeStyle = 'rgba(255,253,240,.16)'; c.lineWidth = .6; c.strokeRect(.3, .3, 31.4, 31.4);
  ctx.restore();
}

function tree(c, x, y, h, kind, R) {
  shadow(c, x + 1, y + .3, h * .32, h * .13, .3);
  rect(c, x - .8, y - h * .3, 1.6, h * .3 + .3, '#7a5233');
  if (kind === 0) { // 针叶
    const w = h * .42;
    fp(c, [x - w, y - h * .26, x, y - h * .72, x + w, y - h * .26], '#29483d');
    fp(c, [x - w * .78, y - h * .55, x, y - h * 1.02, x + w * .78, y - h * .55], '#365e4c');
    fp(c, [x, y - h * 1.02, x + w * .78, y - h * .55, x + .2, y - h * .55], '#24402f', null);
    line(c, x - w * .5, y - h * .62, x - .4, y - h * .9, 'rgba(160,200,150,.45)', .8);
  } else { // 阔叶
    const r = h * .36;
    ell(c, x, y - h * .55, r, r * .95, '#4c7f42', INK, 1);
    ell(c, x + r * .35, y - h * .45, r * .55, r * .5, '#3e6c37');
    ell(c, x - r * .32, y - h * .7, r * .45, r * .38, '#6fa45a');
    if (R() < .3) ell(c, x + r * .2, y - h * .62, .9, .9, '#d9503f');
  }
}

const BASE = { forest: '#6f9a52', water: '#5ea6bb', mountain: '#a9a389', fertile: '#8c6d44', grass: '#82ad61', wild: '#939a7d' };
// Flat ground texture, safe to clip to one cell.
function terrainDetail(c, terrain, R) {
  switch (terrain) {
    case 'forest':
      for (let i = 0; i < 4; i++) ell(c, R() * 32, R() * 32, 5 + R() * 4, 3 + R() * 2, 'rgba(60,100,55,.35)');
      for (let i = 0; i < 4; i++) { const x = 2 + R() * 28, y = 3 + R() * 26; c.beginPath(); c.moveTo(x - 1.2, y - 1.4); c.lineTo(x, y); c.lineTo(x + 1.3, y - 1.5); c.strokeStyle = '#557f3e'; c.lineWidth = .9; c.stroke(); }
      break;
    case 'water':
      for (let i = 0; i < 3; i++) ell(c, R() * 32, R() * 32, 5 + R() * 5, 2 + R() * 2, 'rgba(70,140,165,.45)');
      for (let i = 0; i < 3; i++) {
        const x = 3 + R() * 20, y = 5 + i * 9 + R() * 4, w = 5 + R() * 5;
        line(c, x, y, x + w, y, 'rgba(200,236,240,.8)', 1.1);
        if (R() < .6) line(c, x + 2, y + 2.2, x + w - 1.5, y + 2.2, 'rgba(200,236,240,.4)', .8);
      }
      sparkle(c, 6 + R() * 20, 6 + R() * 20, 1.8, 'rgba(255,255,255,.95)');
      if (R() < .5) sparkle(c, 6 + R() * 20, 6 + R() * 20, 1.2, 'rgba(255,255,255,.8)');
      break;
    case 'mountain':
      for (let i = 0; i < 3; i++) ell(c, R() * 32, R() * 32, 5 + R() * 4, 3 + R() * 2, 'rgba(130,124,104,.3)');
      for (let i = 0; i < 6; i++) ell(c, R() * 32, R() * 32, 1 + R() * 1.4, .8 + R(), 'rgba(110,104,88,.45)');
      break;
    case 'fertile': {
      const ph = R() * 5;
      for (let y = 2 + ph % 5; y < 32; y += 5) { rect(c, 0, y, 32, 2.2, '#6a4f30'); rect(c, 0, y - 1, 32, .9, 'rgba(180,145,100,.55)'); }
      for (let i = 0; i < 7; i++) {
        const x = 2 + R() * 28, y = 3 + Math.floor(R() * 6) * 5 + ph % 5 - 1.5;
        c.beginPath(); c.moveTo(x, y + 1); c.lineTo(x - 1.2, y - .8); c.moveTo(x, y + 1); c.lineTo(x + 1.3, y - .9);
        c.strokeStyle = '#8fc35a'; c.lineWidth = 1; c.stroke();
      }
      break;
    }
    case 'wild':
      for (let i = 0; i < 3; i++) ell(c, R() * 32, R() * 32, 5 + R() * 6, 3 + R() * 3, R() < .5 ? 'rgba(140,146,110,.45)' : 'rgba(176,178,142,.45)');
      for (let i = 0; i < 3; i++) { const x = 4 + R() * 24, y = 6 + R() * 22; c.beginPath(); c.moveTo(x - 1.4, y - 1.4); c.lineTo(x, y); c.lineTo(x + 1.4, y - 1.4); c.strokeStyle = 'rgba(110,118,84,.5)'; c.lineWidth = .8; c.stroke(); }
      if (R() < .25) ell(c, 6 + R() * 20, 8 + R() * 18, 1.8, 1.2, '#8a8a76', 'rgba(59,58,44,.4)', .5);
      break;
    case 'grass':
    default:
      for (let i = 0; i < 3; i++) ell(c, R() * 32, R() * 32, 4 + R() * 5, 2.5 + R() * 2.5, R() < .5 ? 'rgba(150,195,110,.4)' : 'rgba(105,150,80,.35)');
      for (let i = 0; i < 6; i++) {
        const x = 2 + R() * 28, y = 3 + R() * 26;
        c.beginPath(); c.moveTo(x - 1.2, y - 1.4); c.lineTo(x, y); c.lineTo(x + 1.3, y - 1.5);
        c.strokeStyle = '#668f4b'; c.lineWidth = .9; c.stroke();
      }
      if (R() < .5) { const x = 4 + R() * 24, y = 4 + R() * 24, col = ['#f6f1dc', '#f2cf5a', '#e98aa6'][Math.floor(R() * 3)]; ell(c, x, y, 1, 1, col); ell(c, x + 2.2, y + 1.4, .8, .8, col); ell(c, x + .6, y + 2.6, .7, .7, col); }
  }
}
// Tall things (trees, peaks) that may poke into the cell above.
function terrainProps(c, terrain, R) {
  if (terrain === 'forest') {
    const n = 3 + (R() < .5 ? 1 : 0), pts = [];
    const slots = [[8, 13], [22, 11], [14, 22], [26, 25], [7, 27], [18, 30]];
    const off = Math.floor(R() * 6);
    for (let i = 0; i < n; i++) { const sl = slots[(off + i * 2) % 6]; pts.push([sl[0] + (R() - .5) * 3, sl[1] + (R() - .5) * 2, 12 + R() * 4, R() < .62 ? 0 : 1]); }
    pts.sort((a, b) => a[1] - b[1]);
    for (const p of pts) tree(c, p[0], Math.min(29.5, p[1]), p[2], p[3], R);
  } else if (terrain === 'mountain') {
    const big = R() < .5;
    const draw = (cx, by, w, h, snow) => {
      shadow(c, cx + 2, by, w * .62, 2.2, .28);
      fp(c, [cx - w / 2, by, cx - w * .06, by - h, cx + w / 2, by], '#8a8678');
      fp(c, [cx - w / 2, by, cx - w * .06, by - h, cx - w * .02, by], '#bdb8a8', null);
      fp(c, [cx - w * .06, by - h, cx + w * .12, by - h * .55, cx + w * .02, by - h * .42], '#6f6c62', null);
      poly(c, [cx - w / 2, by, cx - w * .06, by - h, cx + w / 2, by]); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
      if (snow) fp(c, [cx - w * .2, by - h * .62, cx - w * .06, by - h, cx + w * .13, by - h * .6, cx + .5, by - h * .68, cx - w * .08, by - h * .56], '#f6f3ea', INK, .7);
    };
    if (big) { draw(9 + R() * 2, 25, 13, 12, false); draw(19, 28, 21, 22, true); }
    else { draw(14, 27, 20, 20, true); draw(25, 29, 11, 10, false); }
    ell(c, 5 + R() * 4, 29, 1.6, 1.1, '#9a9585', INK, .6);
  } else if (terrain === 'wild' && R() < .18) {
    bush(c, 8 + R() * 16, 12 + R() * 14, 2.2, '#7d8a5e', '#97a374');
  }
}

/** One terrain square (icons, chips): flat, clipped to the cell. */
export function drawTerrain(ctx, terrain, px, py, s, seed = 0) {
  tileStart(ctx, px, py, s);
  const c = ctx, R = rng(toInt(seed) * 7 + toInt(terrain).toString().length);
  rect(c, 0, 0, 32, 32, BASE[terrain] || BASE.grass);
  terrainDetail(c, terrain, R);
  terrainProps(c, terrain, rng(toInt(seed) ^ 0x9e37));
  bevel(c, 1);
  ctx.restore();
}

/* ---------------- 立体地块 ---------------- */
// Side faces, top to bottom: [lip, body, deep, strata line].
const SIDE = {
  grass: ['#6c9a4c', '#9a7449', '#7a5636', '#6a4a2e'], forest: ['#5b8a43', '#937047', '#735233', '#634529'],
  fertile: ['#76583a', '#614630', '#4d3724', '#3f2c1c'], mountain: ['#9b9580', '#827d6e', '#6b675b', '#5a574d'],
  water: ['#8fd0de', '#4b95ac', '#3a7f97', '#316d82'], wild: ['#848b6f', '#8f7656', '#735e44', '#5f4d38'],
  cliff: ['#8e8a72', '#9c8463', '#806a4d', '#68563f'],
};
// Higher priority bulges over lower at material borders.
const PRI = { water: 0, fertile: 1, mountain: 2, grass: 3, forest: 4, wild: 1 };
const hashXY = (x, y) => (Math.imul(x + 101, 73856093) ^ Math.imul(y + 211, 19349663)) >>> 0;

function sideFace(c, t, X, Y, D, R, leftOpen, rightOpen) {
  const [lip, body, deep, strata] = SIDE[t] || SIDE.grass;
  const top = Y + 32, lipH = Math.min(3, D * .28);
  rect(c, X, top, 32, D, body);
  rect(c, X, top + D * .62, 32, D * .38, deep);
  if (t === 'water') {
    // A glassy water block: light streaks and a bright rim.
    for (let i = 0; i < 3; i++) { const x = X + 4 + R() * 24; line(c, x, top + lipH + 1, x - 1.5, top + D - 1.5, 'rgba(210,244,248,.35)', 1.2); }
  } else if (t === 'mountain' || t === 'cliff') {
    for (let i = 0; i < 3; i++) { const x = X + 3 + R() * 26, y = top + lipH + 1 + R() * (D - lipH - 3); fp(c, [x, y, x + 2.4, y + 1.6, x + .6, y + 3], 'rgba(60,56,46,.35)', null); }
    line(c, X, top + D * .55, X + 32, top + D * .5, strata, .7);
  } else {
    line(c, X, top + D * .5, X + 32, top + D * .5 + (R() - .5), strata, .7);
    for (let i = 0; i < 4; i++) ell(c, X + 3 + R() * 26, top + lipH + 2 + R() * (D - lipH - 4), .9 + R() * .6, .6, 'rgba(50,34,20,.4)');
  }
  rect(c, X, top, 32, lipH, lip);
  if (t === 'grass' || t === 'forest' || t === 'wild') {
    // Turf hanging over the soil.
    c.beginPath(); c.moveTo(X, top + lipH);
    for (let x = 0; x <= 32; x += 4) c.lineTo(X + x + 2, top + lipH + 1 + R() * 1.8), c.lineTo(X + x + 4, top + lipH);
    c.closePath(); c.fillStyle = lip; c.fill();
  }
  if (leftOpen) rect(c, X, top, .9, D, 'rgba(255,250,230,.18)');
  if (rightOpen) rect(c, X + 31.1, top, .9, D, 'rgba(20,24,14,.28)');
  rect(c, X, top + D - .9, 32, .9, 'rgba(20,24,14,.4)');
}

// Scallops of the higher terrain spilling across a border, clipped to the lower cell.
function seam(c, hi, lo, X, Y, dx, dy, R) {
  const nX = X + dx * 32, nY = Y + dy * 32;
  c.save(); c.beginPath(); c.rect(nX, nY, 32, 32); c.clip();
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const u = 3 + i * 6.5 + (R() - .5) * 2, r = 2.4 + R() * 1.6;
    const ex = dx ? (dx > 0 ? X + 32 : X) : X + u, ey = dy ? (dy > 0 ? Y + 32 : Y) : Y + u;
    pts.push([ex, ey, r]);
  }
  if (lo === 'water') for (const [x, y, r] of pts) ell(c, x, y, r + 1.6, r + 1.6, 'rgba(236,250,250,.85)');
  for (const [x, y, r] of pts) ell(c, x, y, r, r, BASE[hi]);
  if (hi === 'forest') for (const [x, y, r] of pts) if (R() < .6) bush(c, x + dx * r * .5, y + dy * r * .5, 1.8, '#4c7f42', '#6fa45a');
  if (hi === 'mountain' || lo === 'mountain') for (const [x, y] of pts) if (R() < .5) ell(c, x + dx * 4 + (dy ? (R() - .5) * 4 : 0), y + dy * 4 + (dx ? (R() - .5) * 4 : 0), 1.3, 1, '#9a9585', 'rgba(59,58,44,.5)', .5);
  if (hi === 'grass' && lo === 'fertile') for (const [x, y] of pts) { const xx = x + dx * 3, yy = y + dy * 3; c.beginPath(); c.moveTo(xx - 1, yy - 1.2); c.lineTo(xx, yy); c.lineTo(xx + 1.1, yy - 1.3); c.strokeStyle = '#668f4b'; c.lineWidth = .9; c.stroke(); }
  c.restore();
}

/**
 * A set of tiles as a raised slab: drop shadow, layered side faces, tops with material seams, props.
 * tiles: [{x,y,t}] in cell coords. depth/lift in cells. Origin = cell (0,0) at the current transform.
 */
export function drawLand(ctx, tiles, s, o = {}) {
  const depth = o.depth ?? .18, lift = o.lift || 0, D = depth * 32, L = lift * 32;
  const map = new Map(tiles.map(t => [t.x + ',' + t.y, t]));
  const at = (x, y) => map.get(x + ',' + y);
  const seedOf = o.seed || hashXY;
  const c = ctx;
  c.save(); c.scale(s / 32, s / 32); c.lineJoin = 'round'; c.lineCap = 'round';
  if (o.shadow !== false) {
    const sx = 2.5 + L * .35, sy = D + 2 + L * .15;
    c.beginPath(); for (const t of tiles) c.rect(t.x * 32 + sx, t.y * 32 + sy - D, 32, 32);
    c.fillStyle = `rgba(16,28,24,${o.shadowA ?? (.26 - Math.min(.1, lift * .08))})`; c.fill();
  }
  c.translate(0, -L);
  // Sides first, row by row, so tops of lower rows cover nothing they shouldn't.
  if (D > 0) for (const t of tiles) {
    if (at(t.x, t.y + 1)) continue;
    sideFace(c, o.side || t.t, t.x * 32, t.y * 32, D, rng(seedOf(t.x, t.y) ^ 0x5eed), !at(t.x - 1, t.y + 1) && !at(t.x - 1, t.y), !at(t.x + 1, t.y));
  }
  for (const t of tiles) rect(c, t.x * 32, t.y * 32, 32, 32, BASE[t.t] || BASE.grass);
  for (const t of tiles) {
    const X = t.x * 32, Y = t.y * 32;
    c.save(); c.beginPath(); c.rect(X, Y, 32, 32); c.clip(); c.translate(X, Y);
    terrainDetail(c, t.t, rng(seedOf(t.x, t.y)));
    c.restore();
  }
  for (const t of tiles) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = at(t.x + dx, t.y + dy);
    if (n && n.t !== t.t && PRI[t.t] > PRI[n.t]) seam(c, t.t, n.t, t.x * 32, t.y * 32, dx, dy, rng(seedOf(t.x, t.y) ^ (dx * 7 + dy * 13 + 50)));
  }
  // Rim light on north edges, a soft dark line on the open west/east edges.
  for (const t of tiles) {
    const X = t.x * 32, Y = t.y * 32;
    if (!at(t.x, t.y - 1)) rect(c, X, Y, 32, 1.1, 'rgba(255,252,226,.55)');
    if (!at(t.x - 1, t.y)) rect(c, X, Y, 1, 32, 'rgba(255,252,226,.3)');
    if (!at(t.x + 1, t.y)) rect(c, X + 31, Y, 1, 32, 'rgba(20,30,16,.3)');
  }
  if (o.props !== false) {
    const sorted = [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const t of sorted) {
      if (o.skipProps && o.skipProps(t)) continue;
      c.save(); c.translate(t.x * 32, t.y * 32);
      terrainProps(c, t.t, rng(seedOf(t.x, t.y) ^ 0x9e37));
      c.restore();
    }
  }
  c.restore();
}
/* ---------------- 建筑 ---------------- */
export const BUILDING_SHAPES = {
  hall: [[0, 0], [1, 0], [0, 1], [1, 1]], house: [[0, 0], [1, 0]], farm: [[0, 0], [1, 0], [2, 0]],
  lumber: [[0, 0], [1, 0]], tower: [[0, 0]], fishery: [[0, 0], [1, 0]], granary: [[0, 0]],
  market: [[0, 0], [1, 0], [0, 1]], workshop: [[0, 0], [1, 0], [1, 1]], mine: [[0, 0], [1, 0], [0, 1], [1, 1]],
  temple: [[1, 0], [0, 1], [1, 1], [2, 1]], barracks: [[0, 0], [1, 0], [2, 0], [1, 1]],
  manor: [[1, 0], [2, 0], [0, 1], [1, 1]], guild: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
  wonder: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
};
/** 默认形状按 (x,y)->(-y,x) 旋转 rot 次并平移到非负坐标。 */
export function rotateShape(cells, rot = 0) {
  let out = cells.map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y });
  for (let i = 0; i < (((rot | 0) % 4) + 4) % 4; i++) out = out.map(p => ({ x: -p.y, y: p.x }));
  const mx = Math.min(...out.map(p => p.x)), my = Math.min(...out.map(p => p.y));
  return out.map(p => ({ x: p.x - mx, y: p.y - my }));
}

// [顶面, 侧面]
const GROUND = {
  stone: ['#d9cfb6', '#a3967a'], marble: ['#ece7dc', '#b4ad9d'], wood: ['#c69460', '#8a6038'],
  dirt: ['#c9a774', '#94744a'], yard: ['#dccb9f', '#a8956a'], gravel: ['#b1a998', '#827a6a'],
  field: ['#b98838', '#85602a'], garden: ['#9cc46a', '#6a9044'], harbor: ['#6db3c3', '#47899a'],
  lilac: ['#e0d6ec', '#a596c0'], grey: ['#bdbab2', '#8a877e'],
};
const TYPE_GROUND = {
  hall: 'stone', house: 'yard', farm: 'field', lumber: 'dirt', tower: 'stone', fishery: 'harbor', granary: 'yard',
  market: 'stone', workshop: 'gravel', mine: 'gravel', temple: 'marble', barracks: 'dirt', manor: 'garden',
  guild: 'stone', wonder: 'lilac',
};

function cellInfo(cells) {
  const list = [];
  for (const p of cells || []) {
    const x = Array.isArray(p) ? p[0] : p && p.x, y = Array.isArray(p) ? p[1] : p && p.y;
    if (Number.isFinite(x) && Number.isFinite(y)) list.push({ x: x | 0, y: y | 0 });
  }
  if (!list.length) list.push({ x: 0, y: 0 });
  const set = new Set(list.map(p => p.x + ',' + p.y));
  const has = (x, y) => set.has(x + ',' + y);
  list.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const p of list) p.d = (has(p.x + 1, p.y) ? 1 : 0) + (has(p.x - 1, p.y) ? 1 : 0) + (has(p.x, p.y + 1) ? 1 : 0) + (has(p.x, p.y - 1) ? 1 : 0);
  let sq = null;
  for (const p of list) if (has(p.x + 1, p.y) && has(p.x, p.y + 1) && has(p.x + 1, p.y + 1)) { sq = p; break; }
  const bw = Math.max(...list.map(p => p.x)) + 1, bh = Math.max(...list.map(p => p.y)) + 1;
  let main = list[0]; for (const p of list) if (p.d > main.d) main = p;
  return { cells: list, set, has, sq, bw, bh, main };
}

function footPath(c, I, l, t, r, b) {
  c.beginPath();
  for (const { x, y } of I.cells) {
    const X = x * 32, Y = y * 32;
    c.rect(X + l, Y + t, 32 - l - r, 32 - t - b);
    const R = I.has(x + 1, y), D = I.has(x, y + 1);
    if (R) c.rect(X + 32 - r - .01, Y + t, r + l + .02, 32 - t - b);
    if (D) c.rect(X + l, Y + 32 - b - .01, 32 - l - r, b + t + .02);
    if (R && D && I.has(x + 1, y + 1)) c.rect(X + 32 - r - .01, Y + 32 - b - .01, r + l + .02, b + t + .02);
  }
}
const TOP = [3.2, 3.2, 3.2, 5.6];
function clipTop(c, I) { footPath(c, I, TOP[0], TOP[1], TOP[2], TOP[3]); c.clip(); }

function groundTex(c, I, g, R) {
  const [top] = GROUND[g];
  for (const { x, y } of I.cells) {
    const X = x * 32, Y = y * 32;
    if (g === 'stone' || g === 'marble' || g === 'lilac' || g === 'grey') {
      const jc = g === 'marble' ? 'rgba(120,130,150,.28)' : g === 'lilac' ? 'rgba(181,135,47,.5)' : 'rgba(110,95,70,.32)';
      for (let r = 0; r < 4; r++) {
        const yy = Y + 3 + r * 7.5; line(c, X, yy, X + 32, yy, jc, .7);
        const o = (r % 2) * 5;
        for (let xx = X + o + 2; xx < X + 32; xx += 10) line(c, xx, yy, xx, yy + 7.5, jc, .7);
      }
      if (g !== 'lilac') for (let i = 0; i < 3; i++) rect(c, X + 3 + Math.floor(R() * 3) * 10, Y + 3.4 + Math.floor(R() * 3) * 7.5, 9, 6.8, 'rgba(255,255,255,.18)');
    } else if (g === 'wood') {
      for (let yy = Y + 4; yy < Y + 32; yy += 4.5) line(c, X, yy, X + 32, yy, 'rgba(90,60,30,.45)', .7);
    } else if (g === 'dirt' || g === 'yard' || g === 'gravel') {
      const dc = g === 'gravel' ? 'rgba(90,82,70,.4)' : 'rgba(120,90,50,.32)';
      for (let i = 0; i < 9; i++) ell(c, X + 3 + R() * 26, Y + 3 + R() * 24, .9 + R() * .7, .6 + R() * .5, dc);
      if (g === 'gravel') for (let i = 0; i < 5; i++) ell(c, X + 3 + R() * 26, Y + 3 + R() * 24, .8, .6, 'rgba(255,255,255,.35)');
    } else if (g === 'garden') {
      for (let i = 0; i < 6; i++) { const xx = X + 3 + R() * 26, yy = Y + 4 + R() * 22; c.beginPath(); c.moveTo(xx - 1, yy - 1.2); c.lineTo(xx, yy); c.lineTo(xx + 1.1, yy - 1.3); c.strokeStyle = '#6e9a4c'; c.lineWidth = .8; c.stroke(); }
    } else if (g === 'harbor') {
      for (let i = 0; i < 3; i++) { const xx = X + 3 + R() * 20, yy = Y + 6 + i * 8 + R() * 3; line(c, xx, yy, xx + 4 + R() * 4, yy, 'rgba(210,240,244,.7)', .9); }
    }
  }
  void top;
}

// Union of inset rects grown back by `rad`: convex corners come out rounded.
function roundFoot(c, I, l, t, r, b, rad, fill) {
  footPath(c, I, l + rad, t + rad, r + rad, b + rad);
  c.fillStyle = fill; c.fill();
  c.strokeStyle = fill; c.lineWidth = rad * 2; c.lineJoin = 'round'; c.stroke();
}
function drawFoot(c, I, g, lvl, R) {
  const [top, side] = GROUND[g] || GROUND.grey;
  c.save(); c.translate(2.2, 2.6); roundFoot(c, I, 2.4, 3.4, 2.4, 1.6, 3, 'rgba(18,26,14,.24)'); c.restore();
  if (lvl >= 3) roundFoot(c, I, 2.2, 2.2, 2.2, 1.6, 3.4, GOLD);
  roundFoot(c, I, TOP[0], TOP[1], TOP[2], 2.2, 3, side);
  roundFoot(c, I, TOP[0], TOP[1], TOP[2], TOP[3], 3, top);
  c.save(); clipTop(c, I); groundTex(c, I, g, R);
  // Light from the top-left: a soft highlight along the slab's upper edge.
  for (const { x, y } of I.cells) if (!I.has(x, y - 1)) rect(c, x * 32, y * 32 + TOP[1], 32, 1.6, 'rgba(255,252,230,.35)');
  c.restore();
}

const XY = p => [p.x * 32, p.y * 32];
// 一组按 y 排序的绘制项
function painter() {
  const items = [];
  return { add(y, f) { items.push([y, f]); }, run() { items.sort((a, b) => a[0] - b[0]); for (const it of items) it[1](); } };
}
// T 形：中心格的对边臂 / 单独臂
function tArms(I, C) {
  const arms = I.cells.filter(p => p !== C && Math.abs(p.x - C.x) + Math.abs(p.y - C.y) === 1);
  const paired = [], single = [];
  for (const a of arms) (arms.some(b => b !== a && b.x - C.x === C.x - a.x && b.y - C.y === C.y - a.y) ? paired : single).push(a);
  return { arms, paired, single };
}

/* --- 王城 --- */
function castle(c, lvl, t) {
  const st = '#d6cfbf', stS = '#a59d8d', stT = '#e8e2d4', navy = lvl >= 3 ? '#2f4f95' : '#3d5a9c', navyS = '#2a3f73';
  const hh = (lvl - 1) * 3, gold = lvl >= 3;
  const tw = { wall: st, shade: stS, roof: navy, roofS: navyS, roofH: 11, crenel: false, slit: true, bricks: true, gold };
  // 后墙
  rect(c, 13, 14, 38, 12, stS, INK, 1);
  for (let x = 15; x < 50; x += 5) rect(c, x, 11.6, 2.6, 2.6, stS, INK, .7);
  let a = tower(c, 13, 27, 11, 15 + hh, tw); if (lvl >= 2) flag(c, 13, a, 5, '#c8352b', { w: 4.5, h: 3 });
  a = tower(c, 51, 27, 11, 15 + hh, tw); if (lvl >= 2) flag(c, 51, a, 5, '#c8352b', { w: 4.5, h: 3 });
  // 主楼
  const T = 45 - 22 - hh;
  shadow(c, 34, 45, 14, 2.5);
  box(c, 21, 45, 20, 22 + hh, 4, -3, st, stS, stT);
  for (let yy = 41; yy > T + 2; yy -= 4) line(c, 21.5, yy, 40.5, yy, 'rgba(70,60,45,.22)', .6);
  c.beginPath(); c.moveTo(29.3, T + 13); c.lineTo(29.3, T + 9); c.arc(31, T + 9, 1.7, Math.PI, 0); c.lineTo(32.7, T + 13); c.closePath(); c.fillStyle = gold ? '#f7d77a' : '#2e2a22'; c.fill();
  fp(c, [45, T - 3, 33, T - 14, 42.5, T + 1], navyS);
  fp(c, [19.5, T + 1, 42.5, T + 1, 33, T - 14], navy);
  line(c, 21, T + .2, 41.5, T + .2, 'rgba(255,255,255,.3)', .8);
  if (gold) { line(c, 19.8, T + 1.2, 42.3, T + 1.2, GOLD, 1.1); ell(c, 33, T - 14.5, 1.3, 1.3, GOLD, INK, .6); }
  flag(c, 33, T - 14, 8, gold ? GOLD : '#c8352b', { w: 7.5, h: 4.4, tail: true, gold });
  // 前墙 + 城门
  rect(c, 12, 47, 40, 10, st, INK, 1);
  rect(c, 12, 47, 40, 1.6, stT);
  for (let x = 13; x < 51; x += 5) rect(c, x, 44.4, 2.8, 2.8, st, INK, .7);
  c.beginPath(); c.moveTo(27.5, 57); c.lineTo(27.5, 52); c.arc(32, 52, 4.5, Math.PI, 0); c.lineTo(36.5, 57); c.closePath();
  c.fillStyle = '#3a2c20'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  for (let x = 29; x < 36; x += 2) line(c, x, 49, x, 57, gold ? GOLD : '#7a6a58', .6);
  if (lvl >= 2) for (const bx of [19, 42]) { fp(c, [bx - 2.2, 47.5, bx + 2.2, 47.5, bx + 2.2, 54, bx, 52.6, bx - 2.2, 54], '#c8352b', INK, .7); if (gold) rect(c, bx - 2.2, 47.5, 4.4, 1.2, GOLD); }
  // 前塔
  const ft = { ...tw, roofH: 12 };
  tower(c, 12, 58, 12, 17 + hh, ft); tower(c, 52, 58, 12, 17 + hh, ft);
  return [33, T - 12];
}
function hall(c, I, lvl, t) {
  if (I.sq) { const [X, Y] = XY(I.sq); c.save(); c.translate(X, Y); const a = castle(c, lvl, t); c.restore(); return [X + a[0], Y + a[1]]; }
  const [X, Y] = XY(I.main); c.save(); c.translate(X, Y + 2); c.scale(.5, .46); const a = castle(c, lvl, t); c.restore(); return [X + a[0] / 2, Y + 2 + a[1] * .46];
}

/* --- 民居 --- */
const HOUSE_ROOF = [['#d4593b', '#9e3d28'], ['#e8893a', '#ad5f22'], ['#c9483f', '#8f2f29']];
function house(c, I, lvl) {
  let anchor = null;
  I.cells.forEach((p, i) => {
    const [X, Y] = XY(p), [roof, roofD] = HOUSE_ROOF[(i + p.x + p.y) % 3];
    const wh = lvl >= 2 ? 12.5 : 9.5;
    if (lvl >= 3 && i === 0) bush(c, X + 7, Y + 12, 2.6);
    const a = gable(c, X + 4.2, Y + 25.5, 16, wh, 8.5, 7.5, -5, '#f4e6c6', '#d6c19a', roof, roofD, { trim: lvl >= 3 });
    if (lvl >= 2) { rect(c, X + 22.5, Y + 25 - wh - 10, 2.8, 5, '#9a5a3a', INK, .7); rect(c, X + 10.6, Y + 25.5 - wh + 1.6, 2.8, 2.6, '#f7e3a1', INK, .6); }
    bush(c, X + 4.8, Y + 25.4, 1.9);
    if (lvl >= 3) { ell(c, X + 9, Y + 24.6, .8, .8, '#e86d8f'); ell(c, X + 16.6, Y + 24.6, .8, .8, '#f0d14a'); }
    if (!anchor) anchor = a;
  });
  return anchor;
}

/* --- 农田 --- */
function farm(c, I, lvl) {
  const horiz = I.bw >= I.bh;
  c.save(); clipTop(c, I);
  const W = I.bw * 32, H = I.bh * 32;
  if (horiz) for (let y = 0; y < H; y += 32) for (let r = 0; r < 4; r++) {
    const yy = y + 5.6 + r * 5.3; rect(c, 0, yy, W, 3.4, '#e3b65c'); rect(c, 0, yy, W, 1, '#f5d88c');
    for (let x = 1 + r % 2 * 1.5; x < W; x += 3) line(c, x, yy + 1.2, x + .6, yy + 3, '#c08a2e', .55);
  } else for (let x = 0; x < W; x += 32) for (let r = 0; r < 4; r++) {
    const xx = x + 6 + r * 5.3; rect(c, xx, 0, 3.4, H, '#e3b65c'); rect(c, xx, 0, 1, H, '#f5d88c');
    for (let y = 1 + r % 2 * 1.5; y < H; y += 3) line(c, xx + 1.2, y, xx + 3, y + .6, '#c08a2e', .55);
  }
  c.restore();
  const cs = I.cells, last = cs[cs.length - 1], first = cs[0], mid = cs[Math.floor(cs.length / 2)];
  const P = painter();
  if (cs.length >= 2) {
    P.add(first.y, () => {
      const [X, Y] = XY(first);
      if (lvl >= 3) { // 风车
        fp(c, [X + 11, Y + 25, X + 21, Y + 25, X + 19, Y + 11, X + 13, Y + 11], '#efe2c4');
        fp(c, [X + 16, Y + 25, X + 21, Y + 25, X + 19, Y + 11, X + 16, Y + 11], '#cdbd98', null);
        poly(c, [X + 11, Y + 25, X + 21, Y + 25, X + 19, Y + 11, X + 13, Y + 11]); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
        fp(c, [X + 12, Y + 11.5, X + 16, Y + 6.5, X + 20, Y + 11.5], '#c8473a');
        rect(c, X + 14.8, Y + 20.5, 2.4, 4.5, '#5a3b24', INK, .6);
        const cx = X + 16, cy = Y + 10;
        for (let k = 0; k < 4; k++) {
          const an = Math.PI / 4 + k * Math.PI / 2, ex = cx + Math.cos(an) * 9, ey = cy + Math.sin(an) * 9;
          line(c, cx, cy, ex, ey, INK, 1.4); line(c, cx, cy, ex, ey, GOLD, .7);
        }
        ell(c, cx, cy, 1.4, 1.4, GOLD, INK, .6);
      } else if (lvl >= 2) {
        shadow(c, X + 17, Y + 24.5, 7, 2);
        c.beginPath(); c.moveTo(X + 9, Y + 24.5); c.quadraticCurveTo(X + 10, Y + 14, X + 16, Y + 14); c.quadraticCurveTo(X + 22, Y + 14, X + 23, Y + 24.5); c.closePath();
        c.fillStyle = '#e8c068'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
        line(c, X + 11, Y + 20, X + 21, Y + 20, '#b98a3a', .7); line(c, X + 12.5, Y + 17, X + 19.5, Y + 17, '#b98a3a', .7);
      }
    });
  }
  if (cs.length >= 3) P.add(mid.y, () => {
    const [X, Y] = XY(mid);
    shadow(c, X + 16.5, Y + 24.5, 3, 1.2);
    line(c, X + 16, Y + 25, X + 16, Y + 11, '#6b4426', 1.4);
    line(c, X + 10.5, Y + 15.5, X + 21.5, Y + 15.5, '#6b4426', 1.2);
    fp(c, [X + 13.4, Y + 14.5, X + 18.6, Y + 14.5, X + 18, Y + 20, X + 14, Y + 20], '#4f7fb8', INK, .7);
    ell(c, X + 16, Y + 12, 2.2, 2.2, '#f1d48a', INK, .7);
    fp(c, [X + 12.6, Y + 11, X + 19.4, Y + 11, X + 16, Y + 7.6], '#9a6a3a', INK, .7);
  });
  let anchor;
  P.add(last.y + .1, () => {
    const [X, Y] = XY(last);
    anchor = gable(c, X + 8, Y + 25, 12, 8.5, 6, 6, -4, '#c14b38', '#97372a', '#5e4636', '#3e2c22', { doorC: '#f3e6c8', doorH: 5.4, win: false, trim: lvl >= 3 });
    line(c, X + 12.4, Y + 19.8, X + 15.6, Y + 25, '#c14b38', .7); line(c, X + 15.6, Y + 19.8, X + 12.4, Y + 25, '#c14b38', .7);
  });
  P.run();
  return anchor;
}

/* --- 伐木场 --- */
function logPile(c, X, Y, rows) {
  const L = 6, r = 3.1;
  shadow(c, X + 17, Y + 25, 11, 2.2);
  const lay = [[9, 22.5], [15.5, 22.5], [22, 22.5], [12.2, 17], [18.7, 17], [15.5, 11.5]];
  for (let i = 0; i < Math.min(rows, lay.length); i++) {
    const [lx, ly] = lay[i], x = X + lx, y = Y + ly;
    fp(c, [x, y - r, x + L * .6, y - r - 1.6, x + L * .6, y + r - 1.6, x, y + r], '#7d4f2c');
    ell(c, x, y, r * .78, r, '#e8cb93', INK, .8); ell(c, x, y, r * .38, r * .5, null, '#b98a50', .6);
  }
}
function lumber(c, I, lvl) {
  const cs = I.cells, A = cs[0], B = cs[cs.length - 1];
  const P = painter(); let anchor;
  P.add(A.y, () => {
    const [X, Y] = XY(A);
    anchor = gable(c, X + 4.5, Y + 25, 15, 9.5, 6, 7, -5, '#a8743f', '#82582f', '#6b4428', '#4b2f1b', { door: false, winC: '#d9b07a', trim: lvl >= 3 });
    rect(c, X + 7, Y + 18, 10, 7, '#3f2a1a', INK, .8);
    for (let x = X + 7.5; x < X + 17; x += 2.2) line(c, x, Y + 15.2, x, Y + 17.6, 'rgba(60,35,15,.5)', .5);
    rect(c, X + 8.5, Y + 21.5, 7, 2, '#e8cb93');
    // 圆锯
    const sx = X + 25.2, sy = Y + 21.6, R0 = 3.6;
    c.beginPath(); for (let k = 0; k < 20; k++) { const an = k / 20 * TAU, rr0 = k % 2 ? R0 : R0 + 1; c.lineTo(sx + Math.cos(an) * rr0, sy + Math.sin(an) * rr0); } c.closePath();
    c.fillStyle = lvl >= 3 ? GOLD : '#d5d9dc'; c.fill(); c.strokeStyle = INK; c.lineWidth = .7; c.stroke();
    ell(c, sx, sy, 1, 1, '#6b6f73');
  });
  if (B !== A) P.add(B.y + .1, () => {
    const [X, Y] = XY(B);
    logPile(c, X, Y, lvl >= 2 ? 6 : 5);
    if (lvl >= 3) { ell(c, X + 26, Y + 25, 2.6, 1.3, '#9a6a3a', INK, .6); line(c, X + 26, Y + 25, X + 28, Y + 19.5, '#6b4426', 1); fp(c, [X + 27, Y + 19, X + 29.6, Y + 18, X + 29.6, Y + 21.2], GOLD, INK, .6); }
  });
  P.run();
  return anchor;
}

/* --- 哨塔 --- */
function towerB(c, I, lvl) {
  const [X, Y] = XY(I.main);
  const h = 19 + 3 * (lvl - 1);
  if (lvl >= 2) { rect(c, X + 23.5, Y + 20, 4.8, 5.5, '#a07a4c', INK, .7); line(c, X + 23.5, Y + 22.7, X + 28.3, Y + 22.7, '#6b4426', .6); }
  const apex = tower(c, X + 15, Y + 26.5, 16.5, h, { wall: '#c3beb2', shade: '#958f84', topC: '#a39d92', roof: '#4b5868', roofS: '#35404d', roofH: 8, crenel: true, slit: true, bricks: true, gold: lvl >= 3 });
  flag(c, X + 15, apex, 7.5, lvl >= 3 ? GOLD : '#c8352b', { w: 6.5, h: 3.8, tail: lvl >= 2, gold: lvl >= 3 });
  if (lvl >= 3) ell(c, X + 15, Y + 26.5 - h * .45, 1.4, 1.4, GOLD, INK, .5);
  return [X + 15, apex - 2];
}

/* --- 渔港 --- */
function fishery(c, I, lvl) {
  const horiz = I.bw >= I.bh, cs = I.cells, A = cs[0], B = cs[cs.length - 1];
  c.save(); clipTop(c, I);
  const W = I.bw * 32, H = I.bh * 32;
  if (horiz) {
    for (let y = 0; y < H; y += 32) {
      rect(c, 0, y + 5, W, 10.5, '#c79a63');
      for (let x = 1.5; x < W; x += 3.2) line(c, x, y + 5, x, y + 15.5, 'rgba(90,58,28,.55)', .6);
      rect(c, 0, y + 15.5, W, 1.4, '#7d5631');
      for (let x = 4; x < W; x += 8) rect(c, x, y + 16.5, 1.4, 3, '#5d4026');
    }
  } else {
    for (let x = 0; x < W; x += 32) {
      rect(c, x + 3, 0, 11.5, H, '#c79a63');
      for (let y = 1.5; y < H; y += 3.2) line(c, x + 3, y, x + 14.5, y, 'rgba(90,58,28,.55)', .6);
      rect(c, x + 14.5, 0, 1.4, H, '#7d5631');
      for (let y = 4; y < H; y += 8) rect(c, x + 15.5, y, 2.6, 1.3, '#5d4026');
    }
  }
  c.restore();
  const P = painter(); let anchor;
  P.add(A.y, () => {
    const [X, Y] = XY(A);
    const hx = horiz ? X + 6 : X + 3.5, hb = horiz ? Y + 16 : Y + 22;
    anchor = gable(c, hx, hb, 12, 7.5, 5.5, 5, -4, '#e2d3b2', '#bfae8a', '#5f8f97', '#3f6a72', { trim: lvl >= 3 });
    if (lvl >= 2) { // 渔网架
      const nx = horiz ? X + 24 : X + 23, ny = horiz ? Y + 25 : Y + 13;
      if (horiz) { line(c, X + 22, Y + 14.5, X + 22, Y + 8, INK, .9); line(c, X + 29, Y + 14.5, X + 29, Y + 8, INK, .9); c.strokeStyle = 'rgba(59,58,44,.6)'; c.lineWidth = .5; c.beginPath(); for (let k = 0; k < 4; k++) { c.moveTo(X + 22, Y + 9 + k * 1.6); c.lineTo(X + 29, Y + 9 + k * 1.6); c.moveTo(X + 23.5 + k * 1.6, Y + 8.5); c.lineTo(X + 23.5 + k * 1.6, Y + 14); } c.stroke(); }
      else { ell(c, nx, ny + 12, 2.4, 1.4, '#c8a978', INK, .6); }
    }
  });
  P.add(B.y + .1, () => {
    const [X, Y] = XY(B);
    // 鱼篓
    const kx = horiz ? (B === A ? X + 24 : X + 8) : X + 9, ky = horiz ? Y + 14 : (B === A ? Y + 27 : Y + 16);
    shadow(c, kx + .5, ky + .4, 3.6, 1.2);
    fp(c, [kx - 3, ky - 4.5, kx + 3, ky - 4.5, kx + 2.4, ky, kx - 2.4, ky], '#b98a50');
    line(c, kx - 2.7, ky - 2.6, kx + 2.7, ky - 2.6, '#7d5631', .6);
    fp(c, [kx - 2, ky - 4.6, kx - .5, ky - 8, kx + .6, ky - 4.6], '#c9d6dc', INK, .6);
    fp(c, [kx + .2, ky - 4.6, kx + 2, ky - 7.4, kx + 2.6, ky - 4.6], '#aebfc7', INK, .6);
    // 小船
    const bx = horiz ? X + 16 : X + 22.5, by = horiz ? Y + 23 : Y + 26;
    const bw = horiz ? 9 : 6.2;
    fp(c, [bx - bw, by - 2.6, bx + bw, by - 2.6, bx + bw - 2.6, by + 1.6, bx - bw + 2.4, by + 1.6], '#9a5f35');
    line(c, bx - bw + .8, by - 1.6, bx + bw - .8, by - 1.6, '#c9874c', .8);
    line(c, bx, by - 2.6, bx, by - 13, INK, .9);
    fp(c, [bx + .5, by - 12.5, bx + .5, by - 3.6, bx + bw * .85, by - 4.2], '#f7f2e6', INK, .7);
    if (lvl >= 3) line(c, bx + 1, by - 7, bx + bw * .5, by - 6.2, GOLD, 1);
    if (lvl >= 2) flag(c, bx, by - 13, 0, '#c8352b', { w: 3.5, h: 2 });
    line(c, bx - bw + 1, by + 2.7, bx + bw - 2, by + 2.7, 'rgba(220,245,248,.7)', .8);
  });
  P.run();
  return anchor;
}

/* --- 粮仓 --- */
function silo(c, cx, by, w, h, lvl) {
  return tower(c, cx, by, w, h, { wall: '#efdcaa', shade: '#cdb582', roof: '#c8692f', roofS: '#9c4d22', roofH: 8, bricks: true, gold: lvl >= 3 });
}
function granary(c, I, lvl) {
  const [X, Y] = XY(I.main);
  if (lvl >= 2) silo(c, X + 23.5, Y + 20, 10, 10, lvl);
  const ap = silo(c, X + 13.5, Y + 26.5, 17.5, 14 + (lvl >= 2 ? 3 : 0), lvl);
  rect(c, X + 11.8, Y + 21, 3.4, 5.5, '#6b4426', INK, .6);
  if (lvl >= 3) { line(c, X + 13.5, ap, X + 13.5, ap - 3.5, INK, .8); ell(c, X + 13.5, ap - 3.8, 1.3, 1.3, GOLD, INK, .5); }
  // 麦垛
  const hx = X + 25, hy = Y + 26.5;
  shadow(c, hx + .5, hy, 4.5, 1.4);
  c.beginPath(); c.moveTo(hx - 4.5, hy); c.quadraticCurveTo(hx - 4, hy - 7, hx, hy - 7); c.quadraticCurveTo(hx + 4, hy - 7, hx + 4.5, hy); c.closePath();
  c.fillStyle = '#e8c068'; c.fill(); c.strokeStyle = INK; c.lineWidth = .9; c.stroke();
  line(c, hx - 3, hy - 3, hx + 3, hy - 3, '#b98a3a', .6);
  return [X + 13.5, ap - 2];
}

/* --- 集市 --- */
const AWN = ['#d9503f', '#3f7fc0', '#e9a23a', '#5aa36a'];
function stall(c, X, Y, col, lvl, R) {
  shadow(c, X + 16.5, Y + 25, 11, 2);
  line(c, X + 7, Y + 25, X + 7, Y + 13, '#6b4426', 1.2); line(c, X + 25, Y + 25, X + 25, Y + 13, '#6b4426', 1.2);
  rect(c, X + 6, Y + 19.5, 20, 5.5, '#b98250', INK, .9);
  line(c, X + 12.6, Y + 19.5, X + 12.6, Y + 25, 'rgba(60,35,15,.4)', .6); line(c, X + 19.3, Y + 19.5, X + 19.3, Y + 25, 'rgba(60,35,15,.4)', .6);
  rect(c, X + 5.6, Y + 17.6, 20.8, 2, '#dcae78', INK, .7);
  const goods = ['#d9503f', '#f0a43a', '#8fbf4a', '#f2d34a', '#9b6fd0'];
  for (let k = 0; k < 5; k++) ell(c, X + 8.5 + k * 3.8, Y + 16.6, 1.5, 1.4, goods[(k + Math.floor(R() * 5)) % 5], INK, .5);
  const aw = [X + 4.2, Y + 13.6, X + 27.8, Y + 13.6, X + 25.6, Y + 6.8, X + 6.4, Y + 6.8];
  c.save(); poly(c, aw); c.fillStyle = '#f8f1e2'; c.fill(); c.clip();
  for (let k = 0; k < 7; k += 2) { const x0 = X + 4.2 + k * 3.4, x1 = x0 + 3.4; fp(c, [x0, Y + 13.6, x1, Y + 13.6, x1 - (x1 - X - 16) * .1, Y + 6.8, x0 - (x0 - X - 16) * .1, Y + 6.8], col, null); }
  c.restore(); poly(c, aw); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  for (let k = 0; k < 7; k++) {
    c.beginPath(); c.arc(X + 5.9 + k * 3.4, Y + 13.6, 1.7, 0, Math.PI); c.fillStyle = lvl >= 3 ? (k % 2 ? GOLD : col) : (k % 2 ? '#f8f1e2' : col); c.fill(); c.strokeStyle = INK; c.lineWidth = .6; c.stroke();
  }
  if (lvl >= 2) flag(c, X + 16, Y + 6.8, 4.5, lvl >= 3 ? GOLD : col, { w: 4.5, h: 2.6 });
}
function market(c, I, lvl, t, R) {
  let anchor = null;
  I.cells.forEach((p, i) => {
    const [X, Y] = XY(p);
    stall(c, X, Y, AWN[i % AWN.length], lvl, R);
    if (p.d >= 2) { // 拐角格加木桶
      ell(c, X + 4.5, Y + 26, 2.2, 1, 'rgba(40,36,18,.25)');
      rect(c, X + 2.8, Y + 21.2, 3.6, 4.6, '#9a6a3a', INK, .6); line(c, X + 2.8, Y + 23.4, X + 6.4, Y + 23.4, '#5d4026', .6);
    }
    if (!anchor) anchor = [X + 16, Y + 5];
  });
  return anchor;
}

/* --- 工坊 --- */
function gear(c, x, y, r, col) {
  c.beginPath();
  for (let k = 0; k < 32; k++) { const an = k / 32 * TAU + .2, rr0 = (k >> 1) % 2 ? r : r * 1.3; c.lineTo(x + Math.cos(an) * rr0, y + Math.sin(an) * rr0); }
  c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = INK; c.lineWidth = .9; c.stroke();
  ell(c, x, y, r * .45, r * .45, '#5a4a3a', INK, .6); ell(c, x - r * .35, y - r * .4, r * .3, r * .2, 'rgba(255,255,255,.4)');
}
function workshop(c, I, lvl, t) {
  const cs = I.cells; let C = cs[0]; for (const p of cs) if (p.d > C.d) C = p;
  const arms = cs.filter(p => p !== C);
  const P = painter(); let anchor;
  P.add(C.y, () => {
    const [X, Y] = XY(C), wh = lvl >= 2 ? 12 : 10;
    rect(c, X + 19.2, Y + 25 - wh - 13, 5, 11, '#8e4a33', INK, .8); rect(c, X + 18.4, Y + 25 - wh - 14.5, 6.6, 2, '#5a3a2a', INK, .6);
    if (lvl >= 2) { rect(c, X + 8.5, Y + 25 - wh - 9, 3.6, 7, '#8e4a33', INK, .7); }
    anchor = gable(c, X + 3.6, Y + 25.5, 15.5, wh, 6, 7.5, -5, '#c97a52', '#a35d3c', '#545a63', '#3a3f47', { doorC: '#3a2a20', trim: lvl >= 3, winC: lvl >= 2 ? '#ffb347' : '#f7e3a1' });
    rect(c, X + 19.2, Y + 25 - wh - 13, 5, 11, null, INK, .8);
    for (let yy = Y + 25 - 2.5; yy > Y + 25 - wh; yy -= 2.6) line(c, X + 5, yy, X + 18, yy, 'rgba(110,50,30,.35)', .5);
    if (lvl >= 2) { rect(c, X + 6.3, Y + 25 - wh + 2, 3, 3, '#ffb347', INK, .6); }
    smoke(c, X + 21.7, Y + 25 - wh - 16.5, t, 3, false, 1.25);
    anchor = [X + 16, Y + 25 - wh - 10];
  });
  arms.forEach((p, i) => P.add(p.y + .1 * i, () => {
    const [X, Y] = XY(p);
    if (i % 2 === 0) { // 铁砧
      shadow(c, X + 16.5, Y + 25, 7, 1.8);
      tower(c, X + 16, Y + 25, 9, 4.5, { wall: '#9a6a3a', shade: '#7a5030' });
      ell(c, X + 16, Y + 20.5, 4.5, 1.1, '#c79a63', INK, .6);
      fp(c, [X + 7, Y + 14, X + 24, Y + 14, X + 22.5, Y + 16.8, X + 19.5, Y + 16.8, X + 19.5, Y + 19.8, X + 12.5, Y + 19.8, X + 12.5, Y + 16.8, X + 10, Y + 16.8], '#5d626b', INK, 1);
      rect(c, X + 10, Y + 14, 14, 1.1, '#b3bac4');
      line(c, X + 22, Y + 23.5, X + 26.5, Y + 18, '#7a5030', 1.1); rect(c, X + 25, Y + 16, 3.6, 2.6, '#5d626b', INK, .6);
      if (lvl >= 2) for (let k = 0; k < 3; k++) ell(c, X + 10 + k * 3, Y + 13 - k * .8, .6, .6, '#ffb347');
    } else { // 齿轮
      shadow(c, X + 16, Y + 25, 8, 1.8);
      line(c, X + 11, Y + 25, X + 14.5, Y + 17, '#6b4426', 1.3); line(c, X + 21, Y + 25, X + 17.5, Y + 17, '#6b4426', 1.3);
      gear(c, X + 16, Y + 14.5, 7.2, lvl >= 3 ? GOLD : '#b9895a');
      rect(c, X + 22, Y + 21, 5, 4.5, '#b98250', INK, .7); line(c, X + 22, Y + 21, X + 27, Y + 25.5, '#7d5631', .6);
    }
  }));
  P.run();
  return anchor;
}

/* --- 矿场 --- */
function mineBlock(c, lvl) {
  fp(c, [4, 40, 5, 28, 12, 18, 21, 12, 30, 7, 40, 9, 48, 14, 56, 21, 60, 31, 60, 40], '#958b7c');
  fp(c, [5, 28, 12, 18, 21, 12, 30, 7, 26, 20, 16, 26], '#b2a895', null);
  fp(c, [40, 9, 48, 14, 56, 21, 60, 31, 50, 26, 44, 18], '#766c5f', null);
  poly(c, [4, 40, 5, 28, 12, 18, 21, 12, 30, 7, 40, 9, 48, 14, 56, 21, 60, 31, 60, 40]); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  line(c, 26, 20, 30, 7, 'rgba(59,58,44,.35)', .7); line(c, 44, 18, 50, 26, 'rgba(59,58,44,.35)', .7);
  for (const [x, y] of [[14, 30], [48, 30], [38, 18], [20, 22]]) ell(c, x, y, 1.6, 1, '#6f8f4a');
  // 洞口
  c.beginPath(); c.moveTo(21, 40); c.lineTo(21, 31); c.arc(29, 31, 8, Math.PI, 0); c.lineTo(37, 40); c.closePath(); c.fillStyle = '#2a241e'; c.fill();
  rect(c, 19, 28.5, 2.8, 11.5, '#8a5a32', INK, .8); rect(c, 36.2, 28.5, 2.8, 11.5, '#8a5a32', INK, .8);
  rect(c, 17.5, 26, 23, 3, lvl >= 3 ? GOLD : '#9c6a3c', INK, .8);
  // 轨道
  for (let y = 42; y < 60; y += 3.6) { const k = (y - 40) / 20; line(c, 24.5 - k * 3.5, y, 33.5 + k * 3.5, y, '#7a5030', 1.3); }
  line(c, 26, 40, 23, 60, '#6c7076', 1.2); line(c, 32, 40, 35, 60, '#6c7076', 1.2);
  // 矿石堆
  shadow(c, 50, 56, 8, 2);
  const rocks = [[45, 55, 3.4], [51, 55.5, 3.6], [56, 54.5, 2.8], [48, 51, 3], [53.5, 51, 2.8], [50.5, 47.6, 2.6]];
  for (const [x, y, r] of rocks) ell(c, x, y, r, r * .8, '#8f887c', INK, .8);
  for (const [x, y] of [[46, 54], [52, 50.5], [55, 54], [50, 47]]) fp(c, [x, y - 2, x + 1.2, y, x, y + 1.6, x - 1.2, y], '#6fd0e0', INK, .5);
  if (lvl >= 2) fp(c, [52.5, 56, 53.6, 54, 52.5, 52.4, 51.4, 54], '#b07ad8', INK, .5);
  // 矿车
  shadow(c, 29, 55, 8, 1.6);
  fp(c, [21.5, 46, 36.5, 46, 35, 53.5, 23, 53.5], '#7d6a58');
  rect(c, 22.2, 48.8, 13.6, 1.4, '#5a4a3a');
  ell(c, 25, 54.5, 1.9, 1.9, '#3b3a2c'); ell(c, 33, 54.5, 1.9, 1.9, '#3b3a2c');
  const ore = lvl >= 3 ? [GOLD, GOLD_L, GOLD] : ['#9a958a', '#6fd0e0', '#9a958a'];
  ell(c, 25.5, 45.4, 2.6, 2, ore[0], INK, .7); ell(c, 29.5, 44.4, 2.8, 2.2, ore[1], INK, .7); ell(c, 33, 45.4, 2.4, 1.9, ore[2], INK, .7);
  // 镐
  line(c, 9, 57, 13, 46, '#7a5030', 1.3); c.beginPath(); c.moveTo(9, 46.5); c.quadraticCurveTo(13, 44, 17, 47.5); c.strokeStyle = '#5d626b'; c.lineWidth = 1.6; c.stroke();
  if (lvl >= 2) { line(c, 42, 40, 42, 30, '#6b4426', 1); rect(c, 40.6, 30, 2.8, 3.2, '#ffd36a', INK, .6); }
  return [29, 14];
}
function mine(c, I, lvl) {
  if (I.sq) { const [X, Y] = XY(I.sq); c.save(); c.translate(X, Y); const a = mineBlock(c, lvl); c.restore(); return [X + a[0], Y + a[1]]; }
  const [X, Y] = XY(I.main); c.save(); c.translate(X, Y); c.scale(.5, .5); const a = mineBlock(c, lvl); c.restore(); return [X + a[0] / 2, Y + a[1] / 2];
}

/* --- 神庙 --- */
function column(c, x, yt, yb, w = 2.6) {
  rect(c, x, yt, w, yb - yt, '#fbf8f0', INK, .7); rect(c, x + w * .62, yt + .4, w * .3, yb - yt - .8, '#d6cfbf');
  rect(c, x - .6, yt - 1, w + 1.2, 1.2, '#f1ece2', INK, .5);
}
function templeMain(c, X, Y, lvl) {
  shadow(c, X + 17, Y + 27, 13, 2);
  rect(c, X + 4, Y + 23.5, 24, 3.5, '#efe9dd', INK, .8); rect(c, X + 5.5, Y + 21, 21, 2.6, '#f6f2e9', INK, .7);
  rect(c, X + 7, Y + 12.5, 18, 8.5, '#b9b2a2');
  rect(c, X + 14.4, Y + 15, 3.2, 6, lvl >= 2 ? '#f7d77a' : '#5d564a');
  for (const cx of [7, 11.6, 17.8, 22.4]) column(c, X + cx, Y + 12.6, Y + 21, 2.6);
  rect(c, X + 4.5, Y + 9.6, 23, 3, '#f8f5ee', INK, .8);
  if (lvl >= 2) line(c, X + 5, Y + 11.1, X + 27, Y + 11.1, GOLD, .9);
  const rx = lvl >= 2 ? 9.5 : 8.5, ry = lvl >= 2 ? 9 : 8, dc = lvl >= 3 ? GOLD : '#4f9fcf', dl = lvl >= 3 ? GOLD_L : '#8fc9e6', dd = lvl >= 3 ? GOLD_D : '#3a7fae';
  c.beginPath(); c.ellipse(X + 16, Y + 9.6, rx, ry, 0, Math.PI, 0); c.closePath(); c.fillStyle = dc; c.fill();
  c.save(); c.clip(); ell(c, X + 16 + rx * .55, Y + 9.6, rx * .6, ry, dd); ell(c, X + 16 - rx * .45, Y + 9.6 - ry * .55, rx * .28, ry * .3, dl); c.restore();
  c.beginPath(); c.ellipse(X + 16, Y + 9.6, rx, ry, 0, Math.PI, 0); c.closePath(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  rect(c, X + 16 - rx, Y + 8.4, rx * 2, 1.4, GOLD, INK, .5);
  const tip = Y + 9.6 - ry;
  line(c, X + 16, tip, X + 16, tip - 3.4, INK, 1.4); line(c, X + 16, tip, X + 16, tip - 3.4, GOLD, .7); ell(c, X + 16, tip - 3.6, 1.2, 1.2, GOLD, INK, .5);
  return [X + 16, tip - 2];
}
function brazier(c, X, Y, lvl, t) {
  shadow(c, X + 16.5, Y + 25, 5, 1.5);
  rect(c, X + 13, Y + 18, 6, 7, '#efe9dd', INK, .8); rect(c, X + 17, Y + 18.4, 1.6, 6.2, '#cfc8b8');
  fp(c, [X + 11, Y + 16, X + 21, Y + 16, X + 19, Y + 18.4, X + 13, Y + 18.4], GOLD, INK, .7);
  const f = Math.sin((t || 0) * 7) * .6;
  fp(c, [X + 13, Y + 16, X + 15.4, Y + 9.5 + f, X + 16.5, Y + 12, X + 17.8, Y + 8.4 - f, X + 19, Y + 16], lvl >= 3 ? '#6fd6f0' : '#f08a3a', INK, .6);
  fp(c, [X + 14.6, Y + 16, X + 16.4, Y + 11.5, X + 17.4, Y + 16], lvl >= 3 ? '#e8fbff' : '#ffd36a', null);
}
function colonnade(c, X, Y, lvl) {
  shadow(c, X + 16.5, Y + 25, 10, 1.6);
  rect(c, X + 6.5, Y + 23, 19, 2.6, '#efe9dd', INK, .7);
  column(c, X + 9, Y + 12, Y + 23, 2.8); column(c, X + 20.2, Y + 12, Y + 23, 2.8);
  rect(c, X + 7, Y + 9.2, 18, 2.8, '#f8f5ee', INK, .8);
  fp(c, [X + 7.5, Y + 9.2, X + 16, Y + 5.6, X + 24.5, Y + 9.2], '#f1ece2', INK, .8);
  if (lvl >= 2) ell(c, X + 16, Y + 7.8, 1.2, 1.1, GOLD, INK, .5);
}
function temple(c, I, lvl, t) {
  const C = I.main, { paired, single } = tArms(I, C);
  const P = painter(); let anchor;
  for (const a of paired) P.add(a.y, () => { const [X, Y] = XY(a); brazier(c, X, Y, lvl, t); });
  for (const a of single) P.add(a.y, () => { const [X, Y] = XY(a); colonnade(c, X, Y, lvl); });
  P.add(C.y + .05, () => { const [X, Y] = XY(C); anchor = templeMain(c, X, Y, lvl); });
  P.run();
  return anchor;
}

/* --- 兵营 --- */
function tent(c, X, Y, lvl) {
  shadow(c, X + 17, Y + 25, 10, 2);
  fp(c, [X + 16, Y + 11, X + 21.5, Y + 7.5, X + 28, Y + 21, X + 24, Y + 24.5], '#cbbd96');
  line(c, X + 18.6, Y + 9.4, X + 25.7, Y + 22.8, '#a8333a', 1.6);
  fp(c, [X + 7.5, Y + 24.5, X + 16, Y + 11, X + 24, Y + 24.5], '#efe5c8');
  fp(c, [X + 13.6, Y + 24.5, X + 16, Y + 17, X + 18.4, Y + 24.5], '#4a3a2a', null);
  line(c, X + 9.3, Y + 21.6, X + 22.2, Y + 21.6, '#a8333a', 1.3);
  line(c, X + 16, Y + 11, X + 16, Y + 6.5, INK, .8);
  fp(c, [X + 16.3, Y + 6.5, X + 20, Y + 7.6, X + 16.3, Y + 8.8], lvl >= 3 ? GOLD : '#a8333a', INK, .5);
}
function shield(c, x, y, r, gold) {
  c.beginPath(); c.moveTo(x - r, y - r * .9); c.lineTo(x + r, y - r * .9); c.lineTo(x + r, y); c.quadraticCurveTo(x + r * .8, y + r * .8, x, y + r * 1.25); c.quadraticCurveTo(x - r * .8, y + r * .8, x - r, y); c.closePath();
  c.fillStyle = '#a8333a'; c.fill(); c.strokeStyle = INK; c.lineWidth = .8; c.stroke();
  line(c, x, y - r * .7, x, y + r * .95, gold ? GOLD : '#f3e6c8', r * .32); line(c, x - r * .75, y - r * .2, x + r * .75, y - r * .2, gold ? GOLD : '#f3e6c8', r * .32);
}
function rack(c, X, Y, lvl) {
  shadow(c, X + 16, Y + 25, 10, 1.6);
  for (let k = 0; k < 4; k++) { const x = X + 9.5 + k * 3.6; line(c, x, Y + 25, x, Y + 9, '#7a5030', 1); fp(c, [x - 1.1, Y + 9, x, Y + 5.6, x + 1.1, Y + 9], lvl >= 3 ? GOLD : '#d5d9dc', INK, .5); }
  line(c, X + 7.5, Y + 25, X + 7.5, Y + 15, '#6b4426', 1.4); line(c, X + 23.5, Y + 25, X + 23.5, Y + 15, '#6b4426', 1.4);
  line(c, X + 6.5, Y + 16, X + 24.5, Y + 16, '#6b4426', 1.4);
  shield(c, X + 24, Y + 20.5, 3.6, lvl >= 3);
}
function barracks(c, I, lvl) {
  const C = I.main, { paired, single } = tArms(I, C);
  const P = painter(); let anchor;
  for (const a of paired) P.add(a.y, () => { const [X, Y] = XY(a); tent(c, X, Y, lvl); });
  for (const a of single) P.add(a.y, () => { const [X, Y] = XY(a); rack(c, X, Y, lvl); });
  P.add(C.y + .05, () => {
    const [X, Y] = XY(C), wh = lvl >= 2 ? 12 : 9.5;
    const r = hip(c, X + 4.5, Y + 25, 16, wh, 7, 7, -5, '#cdb48a', '#a88f66', '#9b3a2f', '#76281f', { trim: lvl >= 3 });
    line(c, X + 4.5, Y + 25 - wh + 2, X + 20.5, Y + 25 - wh + 2, '#7a5a3a', .8);
    rect(c, X + 6.5, Y + 19, 3.4, 6, '#4a3020', INK, .7);
    rect(c, X + 22.2, Y + 25 - wh + 1.5, 2, 2.2, '#f7e3a1', INK, .5);
    shield(c, X + 14.5, Y + 25 - wh * .5, 3.2, lvl >= 3);
    if (lvl >= 2) flag(c, (r.rx1 + r.rx2) / 2, r.ry, 6, lvl >= 3 ? GOLD : '#a8333a', { w: 5.5, h: 3.4, tail: true, gold: lvl >= 3 });
    anchor = [(r.rx1 + r.rx2) / 2, r.ry - 3];
  });
  P.run();
  return anchor;
}

/* --- 庄园 --- */
function hedgeGarden(c, X, Y, lvl, fountain, R) {
  if (fountain) {
    shadow(c, X + 16, Y + 22, 9, 2.6);
    ell(c, X + 16, Y + 20, 9, 4.6, '#efe9dd', INK, .9); ell(c, X + 16, Y + 19.6, 7, 3.4, '#6fb7d0');
    rect(c, X + 15, Y + 12.5, 2, 7, '#efe9dd', INK, .6);
    ell(c, X + 16, Y + 12, 3, 1.3, lvl >= 3 ? GOLD : '#efe9dd', INK, .6);
    line(c, X + 13.5, Y + 12, X + 11.5, Y + 17, 'rgba(210,240,250,.9)', .8); line(c, X + 18.5, Y + 12, X + 20.5, Y + 17, 'rgba(210,240,250,.9)', .8);
    bush(c, X + 6, Y + 25, 2.6, '#3f7a42', '#62a25a'); bush(c, X + 26, Y + 25, 2.6, '#3f7a42', '#62a25a');
  } else {
    // 树篱 + 花坛
    for (let k = 0; k < 3; k++) bush(c, X + 8 + k * 8, Y + 11, 3.4, '#3f7a42', '#62a25a');
    rr(c, X + 7, Y + 17, 18, 6.5, 2.6); c.fillStyle = '#7d5a3a'; c.fill(); c.strokeStyle = INK; c.lineWidth = .8; c.stroke();
    const fl = ['#e86d8f', '#f6f1dc', '#f0d14a', '#b07ad8'];
    for (let k = 0; k < 7; k++) ell(c, X + 9 + k * 2.4, Y + 19.6 + (k % 2) * 1.6, 1, 1, fl[(k + Math.floor(R() * 4)) % 4]);
    if (lvl >= 3) { line(c, X + 16, Y + 26, X + 16, Y + 22.5, '#7a5030', .9); ell(c, X + 16, Y + 21.6, 1.6, 1.6, GOLD, INK, .5); }
  }
}
function manor(c, I, lvl, t, R) {
  const cs = I.cells, pair = cs.filter(p => p.d === 2), ends = cs.filter(p => p.d !== 2);
  const P = painter(); let anchor;
  const purple = '#7d5aa9', purpleS = '#5d4185', wall = '#f3e8d2', wallS = '#d4c6a8';
  if (pair.length === 2) {
    const [A, B] = pair[0].y === pair[1].y ? (pair[0].x < pair[1].x ? pair : [pair[1], pair[0]]) : (pair[0].y < pair[1].y ? pair : [pair[1], pair[0]]);
    c.save(); clipTop(c, I);
    for (const p of pair) { const [X, Y] = XY(p); rect(c, X, Y, 32, 32, '#d8ccb2'); for (let r = 0; r < 4; r++) line(c, X, Y + 3 + r * 7.5, X + 32, Y + 3 + r * 7.5, 'rgba(110,95,70,.3)', .6); }
    c.restore();
    if (A.y === B.y) {
      P.add(A.y + .05, () => {
        const [X, Y] = XY(A), wh = lvl >= 2 ? 14 : 11;
        const r = hip(c, X + 5, Y + 25, 34, wh, 9, 13, -7, wall, wallS, purple, purpleS, { trim: lvl >= 3 });
        for (let k = 0; k < 6; k++) if (k !== 2 && k !== 3) rect(c, X + 7.5 + k * 5.2, Y + 25 - wh + 2.2, 2.6, 3.4, '#a9d3e8', INK, .5);
        if (lvl >= 2) for (let k = 0; k < 6; k++) rect(c, X + 7.5 + k * 5.2, Y + 25 - wh + 7.5, 2.6, 3, '#a9d3e8', INK, .5);
        c.beginPath(); c.moveTo(X + 19.5, Y + 25); c.lineTo(X + 19.5, Y + 20.5); c.arc(X + 22, Y + 20.5, 2.5, Math.PI, 0); c.lineTo(X + 24.5, Y + 25); c.closePath(); c.fillStyle = '#5a3b24'; c.fill(); c.strokeStyle = INK; c.lineWidth = .7; c.stroke();
        rect(c, X + 47.8, Y + 18 - wh * .3, 2.2, 3, '#a9d3e8', INK, .5);
        if (lvl >= 2) { rect(c, (r.rx1 + r.rx2) / 2 - 1.5, r.ry - 4, 3, 4.5, '#b3876a', INK, .6); }
        anchor = [(r.rx1 + r.rx2) / 2, r.ry - 3];
      });
    } else {
      P.add(A.y, () => {
        const [X, Y] = XY(A);
        const ap = tower(c, X + 15.5, Y + 25, 14.5, lvl >= 2 ? 18 : 15, { wall, shade: wallS, roof: purple, roofS: purpleS, roofH: 9, gold: lvl >= 3 });
        rect(c, X + 14.4, Y + 13, 2.4, 3.6, '#a9d3e8', INK, .5);
        if (lvl >= 2) flag(c, X + 15.5, ap, 5, lvl >= 3 ? GOLD : '#e86d8f', { w: 4.5, h: 2.8 });
      });
      P.add(B.y + .05, () => {
        const [X, Y] = XY(B), wh = lvl >= 2 ? 15 : 12.5;
        const r = hip(c, X + 3.4, Y + 26.5, 19, wh, 9.5, 6.4, -9, wall, wallS, purple, purpleS, { trim: lvl >= 3 });
        rect(c, X + 5.6, Y + 26.5 - wh + 2.2, 2.6, 3.4, '#a9d3e8', INK, .5); rect(c, X + 16.4, Y + 26.5 - wh + 2.2, 2.6, 3.4, '#a9d3e8', INK, .5);
        if (lvl >= 2) { rect(c, X + 5.6, Y + 26.5 - wh + 8, 2.6, 3, '#a9d3e8', INK, .5); rect(c, X + 16.4, Y + 26.5 - wh + 8, 2.6, 3, '#a9d3e8', INK, .5); }
        c.beginPath(); c.moveTo(X + 10.6, Y + 26.5); c.lineTo(X + 10.6, Y + 22.4); c.arc(X + 12.9, Y + 22.4, 2.3, Math.PI, 0); c.lineTo(X + 15.2, Y + 26.5); c.closePath(); c.fillStyle = '#5a3b24'; c.fill(); c.strokeStyle = INK; c.lineWidth = .7; c.stroke();
        anchor = [(r.rx1 + r.rx2) / 2, r.ry - 3];
      });
    }
  } else {
    const [X, Y] = XY(I.main);
    P.add(I.main.y, () => { const r = hip(c, X + 4.5, Y + 25, 16, 10, 8, 7, -5, wall, wallS, purple, purpleS); anchor = [(r.rx1 + r.rx2) / 2, r.ry - 3]; });
  }
  ends.forEach((p, i) => { if (pair.length === 2 || p !== I.main) P.add(p.y + .1, () => { const [X, Y] = XY(p); hedgeGarden(c, X, Y, lvl, lvl >= 2 && i === 0, R); }); });
  P.run();
  return anchor;
}

/* --- 商会 --- */
function guildBlock(c, lvl) {
  const wh = 21 + (lvl - 1) * 5.5, by = 58, x = 7, fw = 36;
  const r = hip(c, x, by, fw, wh, 10, 12, -9, '#f0e2c2', '#cdb991', '#2f8a80', '#216760', { trim: lvl >= 3 });
  // 楼层腰线与窗
  const floors = Math.floor((wh - 2) / 7.2);
  for (let f = 0; f < floors; f++) {
    const wy = by - 6.6 - f * 7.2;
    if (f > 0) line(c, x, wy + 4.9, x + fw, wy + 4.9, '#b39b6b', .9);
    for (let k = 0; k < 5; k++) { if (f === 0 && k === 2) continue; rect(c, x + 3 + k * 6.6, wy - 1.6, 3.2, 4, '#a9d3e8', INK, .5); }
    rect(c, x + fw + 3.6, wy - 2.6 - 4.5, 2.6, 4, '#8fbcd0', INK, .5);
  }
  c.beginPath(); c.moveTo(x + 15.5, by); c.lineTo(x + 15.5, by - 5); c.arc(x + 18, by - 5, 2.5, Math.PI, 0); c.lineTo(x + 20.5, by); c.closePath(); c.fillStyle = '#5a3b24'; c.fill(); c.strokeStyle = INK; c.lineWidth = .7; c.stroke();
  // 金币招牌（挂在正面）
  line(c, x + fw - 2, by - wh + 5, x + fw + 4.5, by - wh + 5, INK, 1.1);
  line(c, x + fw + 3.8, by - wh + 5, x + fw + 3.8, by - wh + 7, INK, .7);
  coin(c, x + fw + 3.8, by - wh + 11, 4.2);
  if (lvl >= 3) { const cx = (r.rx1 + r.rx2) / 2; line(c, cx, r.ry, cx, r.ry - 5, INK, 1); coin(c, cx, r.ry - 6.5, 2.2); }
  else if (lvl >= 2) flag(c, (r.rx1 + r.rx2) / 2, r.ry, 6, '#2f8a80', { w: 5, h: 3 });
  return [(r.rx1 + r.rx2) / 2, r.ry - 3];
}
function guild(c, I, lvl) {
  const P = painter(); let anchor;
  if (I.sq) {
    const q = I.sq, inSq = p => p.x >= q.x && p.x <= q.x + 1 && p.y >= q.y && p.y <= q.y + 1;
    P.add(q.y + 1, () => { const [X, Y] = XY(q); c.save(); c.translate(X, Y); const a = guildBlock(c, lvl); c.restore(); anchor = [X + a[0], Y + a[1]]; });
    for (const p of I.cells) if (!inSq(p)) P.add(p.y + (p.y > q.y ? .5 : 0), () => {
      const [X, Y] = XY(p);
      shadow(c, X + 12, Y + 25, 4, 1.3);
      line(c, X + 11, Y + 25, X + 11, Y + 15, '#6b4426', 1.6);
      coin(c, X + 11, Y + 11.5, 6);
      box(c, X + 17.5, Y + 25.4, 7, 6, 2.6, -2, '#b98250', '#8f6338', '#d3a26c');
      line(c, X + 17.5, Y + 19.4, X + 24.5, Y + 25.4, '#7d5631', .6);
      ell(c, X + 23.5, Y + 16.6, 2.6, 2.4, '#cdb27c', INK, .7); line(c, X + 22.4, Y + 14.6, X + 24.6, Y + 14.6, '#7d5631', .8);
      if (lvl >= 2) coin(c, X + 6, Y + 24, 2);
    });
  } else {
    const [X, Y] = XY(I.main); P.add(0, () => { c.save(); c.translate(X, Y); c.scale(.5, .5); const a = guildBlock(c, lvl); c.restore(); anchor = [X + a[0] / 2, Y + a[1] / 2]; });
  }
  P.run();
  return anchor;
}

/* --- 星塔奇观 --- */
function obelisk(c, X, Y, lvl) {
  shadow(c, X + 16.5, Y + 25, 5, 1.5);
  rect(c, X + 11.5, Y + 22, 9, 3.4, '#cbbfdf', INK, .7);
  fp(c, [X + 13, Y + 22, X + 19, Y + 22, X + 17.6, Y + 11, X + 14.4, Y + 11], '#efe9f7');
  fp(c, [X + 16, Y + 22, X + 19, Y + 22, X + 17.6, Y + 11, X + 16, Y + 11], '#c5b8de', null);
  poly(c, [X + 13, Y + 22, X + 19, Y + 22, X + 17.6, Y + 11, X + 14.4, Y + 11]); c.strokeStyle = INK; c.lineWidth = .8; c.stroke();
  fp(c, [X + 16, Y + 5.6, X + 18.2, Y + 9, X + 16, Y + 12, X + 13.8, Y + 9], lvl >= 3 ? GOLD_L : '#7fe6ff', INK, .6);
  ell(c, X + 15.5, Y + 8.4, .6, .9, '#ffffff');
}
function spire(c, X, Y, lvl, t) {
  const H = 30 + (lvl - 1) * 5, base = Y + 23, top = base - H;
  shadow(c, X + 17, Y + 27.5, 13, 2.2);
  box(c, X + 3.5, Y + 27.5, 23, 4.5, 2.2, -2, '#d9cdea', '#a99cc4', '#ece5f5');
  rect(c, X + 3.5, Y + 24.6, 23, 1.1, GOLD);
  fp(c, [X + 6.5, base, X + 25.5, base, X + 18.6, top, X + 13.4, top], '#f4f0fa');
  fp(c, [X + 16.6, base, X + 25.5, base, X + 18.6, top, X + 16.4, top], '#c9bfe0', null);
  poly(c, [X + 6.5, base, X + 25.5, base, X + 18.6, top, X + 13.4, top]); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  for (let k = 1; k <= 3; k++) {
    const yy = base - H * k / 4, hw = 9.5 - 6.9 * k / 4;
    rect(c, X + 16 - hw - .4, yy - 1, 2 * hw + .8, 2, GOLD, INK, .6);
  }
  for (let k = 0; k < 3; k++) { const yy = base - 4 - k * H / 4; rect(c, X + 14.8, yy - 3.4, 2.4, 3.4, '#7fe6ff', INK, .5); }
  const cy = top - 4.5, pulse = .5 + .5 * Math.sin((t || 0) * 2.4);
  const g = c.createRadialGradient(X + 16, cy, 0, X + 16, cy, 11);
  g.addColorStop(0, `rgba(170,245,255,${.75 + .2 * pulse})`); g.addColorStop(1, 'rgba(170,245,255,0)');
  c.fillStyle = g; c.fillRect(X + 5, cy - 11, 22, 22);
  if (lvl >= 2) { c.beginPath(); c.ellipse(X + 16, base - H * .5, 9, 2.4, 0, 0, TAU); c.strokeStyle = 'rgba(227,182,92,.95)'; c.lineWidth = 1.1; c.stroke(); }
  fp(c, [X + 16, cy - 6.5, X + 19.6, cy, X + 16, cy + 4.5, X + 12.4, cy], lvl >= 3 ? '#9ff0ff' : '#7fe6ff', INK, .8);
  fp(c, [X + 16, cy - 6.5, X + 19.6, cy, X + 16, cy + 4.5], '#4fc4e0', null);
  poly(c, [X + 16, cy - 6.5, X + 19.6, cy, X + 16, cy + 4.5, X + 12.4, cy]); c.strokeStyle = INK; c.lineWidth = .8; c.stroke();
  ell(c, X + 14.8, cy - 1.6, .8, 1.4, '#ffffff');
  if (lvl >= 3) { fp(c, [X + 12, cy + 4.6, X + 13, cy + 1.6, X + 14.5, cy + 3.6, X + 16, cy + .8, X + 17.5, cy + 3.6, X + 19, cy + 1.6, X + 20, cy + 4.6], GOLD, INK, .6); sparkle(c, X + 7, cy - 4, 2.2); sparkle(c, X + 25, cy + 3, 1.8); }
  sparkle(c, X + 21.5, cy - 6, 1.6 + pulse * .6);
  return [X + 16, cy - 7];
}
function wonder(c, I, lvl, t) {
  const C = I.main, P = painter(); let anchor;
  c.save(); clipTop(c, I);
  const [CX, CY] = XY(C);
  for (const p of I.cells) if (p !== C) { const [X, Y] = XY(p); line(c, CX + 16, CY + 16, X + 16, Y + 16, 'rgba(227,182,92,.75)', 2.4); }
  c.restore();
  for (const p of I.cells) if (p !== C) P.add(p.y, () => { const [X, Y] = XY(p); obelisk(c, X, Y, lvl); });
  P.add(C.y + .05, () => { anchor = spire(c, CX, CY, lvl, t); });
  P.run();
  return anchor;
}

/* --- 未知类型 --- */
function generic(c, I) {
  const [X, Y] = XY(I.main);
  const r = hip(c, X + 5, Y + 25, 15, 10, 7, 7, -5, '#cfccc4', '#a8a59c', '#8a8780', '#6c6a64');
  rect(c, X + 10.8, Y + 20, 3.4, 5, '#5d5a52', INK, .6);
  return [(r.rx1 + r.rx2) / 2, r.ry - 3];
}

const BUILDERS = { hall, house, farm, lumber, tower: towerB, fishery, granary, market, workshop, mine, temple, barracks, manor, guild, wonder };

function zz(c, x, y) {
  rr(c, x - 5.2, y - 4.2, 10.4, 8, 3.6); c.fillStyle = 'rgba(255,253,244,.95)'; c.fill(); c.strokeStyle = INK; c.lineWidth = .9; c.stroke();
  fp(c, [x - 1.2, y + 3.8, x - 3, y + 5.6, x + .6, y + 3.8], 'rgba(255,253,244,.95)', null);
  c.lineJoin = 'miter';
  c.beginPath(); c.moveTo(x - 3.4, y - 1.8); c.lineTo(x - .4, y - 1.8); c.lineTo(x - 3.4, y + 1.8); c.lineTo(x - .4, y + 1.8);
  c.moveTo(x + .9, y - 2.4); c.lineTo(x + 3.2, y - 2.4); c.lineTo(x + .9, y + .4); c.lineTo(x + 3.2, y + .4);
  c.strokeStyle = '#4f6f9a'; c.lineWidth = 1.1; c.stroke(); c.lineJoin = 'round';
}

let scratch = null;
function getScratch(w, h) {
  try {
    if (!scratch) scratch = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
    if (!scratch) return null;
    if (scratch.width < w) scratch.width = w;
    if (scratch.height < h) scratch.height = h;
    const sc = scratch.getContext('2d');
    return sc;
  } catch { return null; }
}

function paintBuilding(c, type, I, lvl, t) {
  const R = rng(toInt(type) ^ (I.cells.length * 977) ^ (I.bw * 31 + I.bh));
  const g = TYPE_GROUND[type] || 'grey';
  c.lineJoin = 'round'; c.lineCap = 'round';
  drawFoot(c, I, g, lvl, R);
  const f = BUILDERS[type] || generic;
  let a;
  try { a = f(c, I, lvl, t, R); } catch { a = null; }
  return a || [I.main.x * 32 + 16, I.main.y * 32 + 8];
}

export function drawBuilding(ctx, type, cells, s, opts = {}) {
  const I = cellInfo(cells);
  const lvl = Math.max(1, Math.min(3, (opts && opts.level) | 0 || 1));
  const damaged = !!(opts && opts.damaged), idle = !!(opts && opts.idle), t = (opts && +opts.t) || 0;
  const k = s / 32;
  ctx.save();
  ctx.scale(k, k);
  let anchor;
  if (damaged || idle) {
    // 先画到复用的离屏层，再整体着色，避免染到周围地形
    const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : { a: k, b: 0 };
    const dpr = Math.max(.25, Math.hypot(m.a, m.b));
    const pad = 20, W = I.bw * 32, H = I.bh * 32 + pad;
    const sw = Math.ceil(W * dpr) + 2, sh = Math.ceil(H * dpr) + 2;
    const sc = getScratch(sw, sh);
    if (sc) {
      sc.save(); sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, sw, sh);
      sc.setTransform(dpr, 0, 0, dpr, 0, pad * dpr);
      anchor = paintBuilding(sc, type, I, lvl, t);
      sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalCompositeOperation = 'source-atop';
      sc.fillStyle = damaged ? 'rgba(48,34,24,.52)' : 'rgba(178,178,168,.58)'; sc.fillRect(0, 0, sw, sh);
      sc.restore();
      ctx.drawImage(scratch, 0, 0, sw, sh, 0, -pad, sw / dpr, sh / dpr);
    } else {
      anchor = paintBuilding(ctx, type, I, lvl, t);
      ctx.save(); footPath(ctx, I, 1.8, 1.8, 1.8, 1.3); ctx.fillStyle = damaged ? 'rgba(48,34,24,.45)' : 'rgba(178,178,168,.5)'; ctx.fill(); ctx.restore();
    }
  } else anchor = paintBuilding(ctx, type, I, lvl, t);

  if (damaged) {
    const R = rng(toInt(type) + 99);
    ctx.lineJoin = 'round';
    for (const p of I.cells) {
      const X = p.x * 32, Y = p.y * 32;
      for (let i = 0; i < 2; i++) {
        const x = X + 6 + R() * 18, y = Y + 18 + R() * 7;
        fp(ctx, [x - 3, y + 2, x - 1.6, y - 1.6, x + .6, y - 2.4, x + 3, y - .4, x + 2.6, y + 2], i ? '#8a7f70' : '#6f6558', INK, .7);
      }
      line(ctx, X + 8 + R() * 6, Y + 24, X + 18 + R() * 8, Y + 14 + R() * 4, '#2a2018', 1.6);
      if (R() < .6) { ell(ctx, X + 10 + R() * 12, Y + 22 + R() * 3, 1.2, .9, '#ff8a3a'); }
    }
    ell(ctx, anchor[0] - 2, anchor[1] + 6, 2.2, 1.6, '#ff9a3a', '#c8352b', .6);
    ell(ctx, anchor[0] - 2, anchor[1] + 6.4, 1, .8, '#ffe08a');
    smoke(ctx, anchor[0] - 2, anchor[1] + 3, t, 3, true, 1.7);
  }
  if (idle) zz(ctx, Math.min(anchor[0] + 6, I.bw * 32 - 6), Math.max(-6, anchor[1] - 2));
  ctx.restore();
}

export function drawCard(ctx, type, w, h, opts = {}) {
  const shape = BUILDING_SHAPES[type] || [[0, 0]];
  const rot = (opts && opts.rot) | 0;
  const cells = rotateShape(shape, rot);
  const bw = Math.max(...cells.map(p => p.x)) + 1, bh = Math.max(...cells.map(p => p.y)) + 1;
  const s = Math.min(w * .88 / bw, h * .86 / (bh + .3));
  const ox = (w - bw * s) / 2, oy = (h - bh * s) / 2 + s * .14;
  ctx.save();
  ctx.translate(ox, oy);
  const k = s / 32;
  ctx.save(); ctx.scale(k, k);
  for (const p of cells) { rr(ctx, p.x * 32 + .8, p.y * 32 + .8, 30.4, 30.4, 5); ctx.fillStyle = '#a9c886'; ctx.fill(); ctx.strokeStyle = 'rgba(59,58,44,.25)'; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.restore();
  drawBuilding(ctx, type, cells, s, { level: (opts && opts.level) || 1, rot, t: (opts && opts.t) || 0 });
  ctx.restore();
}

/* ---------------- 图标（24 单位） ---------------- */
function person(c, x, shirt, hat) {
  c.beginPath(); c.moveTo(x - 6.5, 21.5); c.quadraticCurveTo(x - 6.5, 13.5, x, 13.5); c.quadraticCurveTo(x + 6.5, 13.5, x + 6.5, 21.5); c.closePath();
  c.fillStyle = shirt; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
  ell(c, x, 8.6, 4, 4, '#f1c9a0', INK, 1.4);
  if (hat) { c.beginPath(); c.ellipse(x, 7.4, 4.6, 3.6, 0, Math.PI, 0); c.closePath(); c.fillStyle = hat; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke(); rect(c, x - 5.6, 6.8, 11.2, 1.4, hat, INK, .9); }
}
const ICONS = {
  gold(c) { coin(c, 9, 15, 6.5); coin(c, 15, 9.5, 7); },
  food(c) {
    c.beginPath(); c.moveTo(12, 6.5); c.bezierCurveTo(6, 3.5, 2.5, 9, 3.5, 13.5); c.bezierCurveTo(4.5, 19, 8.5, 22, 12, 20.5); c.bezierCurveTo(15.5, 22, 19.5, 19, 20.5, 13.5); c.bezierCurveTo(21.5, 9, 18, 3.5, 12, 6.5); c.closePath();
    c.fillStyle = '#d9503f'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
    ell(c, 7.6, 10.5, 1.8, 2.6, '#f08a7a');
    line(c, 12, 7, 12.6, 2.8, '#6b4426', 1.5);
    c.beginPath(); c.moveTo(13, 4.4); c.quadraticCurveTo(17, 1, 19.5, 3.6); c.quadraticCurveTo(16.5, 6.6, 13, 4.4); c.fillStyle = '#6fa84a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  },
  wood(c) {
    const log = (x, y) => { fp(c, [x, y - 4, x + 12, y - 4, x + 12, y + 4, x, y + 4], '#8a5a32', INK, 1.3); ell(c, x + 12, y, 2.6, 4, '#e8cb93', INK, 1.2); ell(c, x + 12, y, 1, 1.8, null, '#b98a50', .8); line(c, x + 2, y - 1, x + 8, y - 1, '#6b4426', .8); };
    log(2.5, 16.5); log(7.5, 8.5);
  },
  pop(c) { person(c, 12, '#4f7fb8'); },
  worker(c) {
    person(c, 10.5, '#b98250', '#e3b65c');
    line(c, 15, 21.5, 21, 11, '#7a5030', 2); fp(c, [17.4, 9, 22.8, 12.2, 21.6, 14.2, 16.2, 11], '#6c7076', INK, 1);
  },
  fame(c) {
    const pts = []; for (let k = 0; k < 10; k++) { const an = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4.4 : 10; pts.push(12 + Math.cos(an) * r, 12.8 + Math.sin(an) * r); }
    fp(c, pts, '#f2c94c', INK, 1.4); ell(c, 9.6, 10, 1.6, 1.2, '#fff3c2');
  },
  guard(c) {
    c.beginPath(); c.moveTo(3.5, 4); c.lineTo(20.5, 4); c.lineTo(20.5, 11); c.quadraticCurveTo(20, 18.5, 12, 22); c.quadraticCurveTo(4, 18.5, 3.5, 11); c.closePath();
    c.fillStyle = '#4f7fb8'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
    line(c, 12, 6.5, 12, 19, '#f3e6c8', 2.4); line(c, 6.5, 10.5, 17.5, 10.5, '#f3e6c8', 2.4);
  },
  threat(c) {
    c.beginPath(); c.moveTo(12, 2); c.bezierCurveTo(14, 7, 20, 9, 19.5, 15); c.bezierCurveTo(19, 20, 15.5, 22, 12, 22); c.bezierCurveTo(8, 22, 4.5, 19.5, 4.5, 15); c.bezierCurveTo(4.5, 11, 8, 10, 8.5, 6.5); c.bezierCurveTo(10.5, 8.5, 10.5, 10, 10.5, 11); c.bezierCurveTo(12.5, 8.5, 12.5, 5, 12, 2); c.closePath();
    c.fillStyle = '#d6402f'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
    c.beginPath(); c.moveTo(12, 11); c.bezierCurveTo(14, 13.5, 16, 15, 15.5, 17.5); c.bezierCurveTo(15, 20, 9, 20, 8.6, 17.5); c.bezierCurveTo(8.4, 15.5, 10.5, 14, 12, 11); c.fillStyle = '#ffc24a'; c.fill();
  },
  treasure(c) { chest(c, 12, 20, 18, 13); },
  tribute(c) {
    c.beginPath(); c.moveTo(8.5, 8); c.bezierCurveTo(2, 12, 2.5, 21.5, 12, 21.5); c.bezierCurveTo(21.5, 21.5, 22, 12, 15.5, 8); c.closePath();
    c.fillStyle = '#9b6fd0'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
    fp(c, [8, 8, 9.5, 3.5, 12, 5.5, 14.5, 3.5, 16, 8], '#b48ae0', INK, 1.2);
    line(c, 8, 8.2, 16, 8.2, GOLD, 1.8);
    coin(c, 12, 15.2, 3.6);
  },
  rotate(c) {
    c.beginPath(); c.arc(12, 12.5, 7.5, Math.PI * 1.15, Math.PI * .75); c.strokeStyle = INK; c.lineWidth = 4.6; c.stroke();
    c.strokeStyle = '#f1e5c9'; c.lineWidth = 2; c.stroke();
    const an = Math.PI * 1.15, ex = 12 + Math.cos(an) * 7.5, ey = 12.5 + Math.sin(an) * 7.5;
    fp(c, [ex - 4.6, ey + 1.2, ex + 2.6, ey - 3.6, ex + 2.4, ey + 4.2], '#f1e5c9', INK, 1.3);
  },
  land(c) {
    // A patchwork plot: three coloured squares and a fresh one sliding in.
    rect(c, 3, 10, 8, 8, '#82ad61', INK, 1.3); rect(c, 11, 10, 8, 8, '#c9a35a', INK, 1.3); rect(c, 3, 18 - 16, 8, 8, '#4f86a8', INK, 1.3);
    rect(c, 13.5, 2.5, 8, 8, '#f5d98e', INK, 1.3); line(c, 15.5, 6.5, 19.5, 6.5, INK, 1.4); line(c, 17.5, 4.5, 17.5, 8.5, INK, 1.4);
    rect(c, 3, 18, 16, 3.5, '#6b8f4f', INK, 1.1);
  },
  card(c) {
    c.save(); c.translate(12, 12); c.rotate(-.18); rr(c, -9, -10, 13, 18, 2); c.fillStyle = '#e6d5ac'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke(); c.restore();
    rr(c, 8, 3.5, 13, 18, 2); c.fillStyle = '#fff8e6'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
    fp(c, [10.5, 13, 14.5, 8.5, 18.5, 13], '#c4553f', INK, 1.1); rect(c, 11.5, 13, 6, 5, '#f3e6c8', INK, 1.1);
  },
  next(c) {
    // Hourglass: the season turns.
    fp(c, [5, 3, 19, 3, 19, 5, 13.5, 12, 19, 19, 19, 21, 5, 21, 5, 19, 10.5, 12, 5, 5], '#fbf6ea', INK, 1.4);
    fp(c, [8, 5.5, 16, 5.5, 12, 10], GOLD); fp(c, [7.5, 19.5, 16.5, 19.5, 12, 15.5], GOLD);
    line(c, 4, 3, 20, 3, '#8a5a32', 2.6); line(c, 4, 21, 20, 21, '#8a5a32', 2.6);
  },
  yield(c) {
    rect(c, 3.5, 13, 4.5, 8, '#82ad61', INK, 1.2); rect(c, 9.75, 9, 4.5, 12, GOLD, INK, 1.2); rect(c, 16, 5, 4.5, 16, '#d9503f', INK, 1.2);
    line(c, 2.5, 21.5, 21.5, 21.5, INK, 1.6);
  },
  center(c) {
    ell(c, 12, 12, 8.5, 8.5, '#fbf6ea', INK, 1.5); ell(c, 12, 12, 4.5, 4.5, '#c4553f', INK, 1.3);
    for (const [a, b, d, e] of [[12, 1, 12, 4.5], [12, 19.5, 12, 23], [1, 12, 4.5, 12], [19.5, 12, 23, 12]]) line(c, a, b, d, e, INK, 1.8);
  },
  eye(c) {
    c.beginPath(); c.moveTo(2, 12); c.quadraticCurveTo(12, 2.5, 22, 12); c.quadraticCurveTo(12, 21.5, 2, 12); c.closePath();
    c.fillStyle = '#fbf6ea'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.7; c.stroke();
    ell(c, 12, 12, 4.6, 4.6, '#4f8ea8', INK, 1.4); ell(c, 12, 12, 2, 2, INK); ell(c, 10.4, 10.3, 1.1, 1.1, '#fff');
  },
  eyeOff(c) {
    c.beginPath(); c.moveTo(2, 12); c.quadraticCurveTo(12, 2.5, 22, 12); c.quadraticCurveTo(12, 21.5, 2, 12); c.closePath();
    c.fillStyle = '#e6dcc4'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.7; c.stroke();
    ell(c, 12, 12, 4.6, 4.6, '#9aa7a8', INK, 1.4);
    line(c, 4, 20, 20, 4, '#fbf6ea', 4.5); line(c, 4, 20, 20, 4, '#c8483a', 2.4);
  },
  // 相邻：中间是自己，四边亮起
  adj(c) {
    const sq = (x, y, f) => { rr(c, x, y, 6.4, 6.4, 1.4); c.fillStyle = f; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.1; c.stroke(); };
    sq(8.8, 8.8, '#6b5a44'); for (const [x, y] of [[8.8, 1.6], [8.8, 16], [1.6, 8.8], [16, 8.8]]) sq(x, y, GOLD);
  },
  // 占用：建在这一格上
  own(c) {
    rr(c, 2.5, 8, 19, 13.5, 2.4); c.fillStyle = GOLD; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke();
    fp(c, [7, 11.5, 12, 3, 17, 11.5], '#c4553f', INK, 1.2);
    rect(c, 8.2, 11.5, 7.6, 6.5, '#efe2c4', INK, 1.1);
  },
  bldg(c) {
    fp(c, [4, 11, 12, 4, 20, 11], '#c4553f', INK, 1.3);
    rect(c, 5.5, 11, 13, 9.5, '#efe2c4', INK, 1.3); rect(c, 10.4, 14.5, 3.2, 6, '#7a5030', INK, .9);
  },
  summer(c) {
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; line(c, 12 + Math.cos(a) * 7.5, 12 + Math.sin(a) * 7.5, 12 + Math.cos(a) * 10.5, 12 + Math.sin(a) * 10.5, '#e39a2c', 2); }
    ell(c, 12, 12, 5.6, 5.6, '#f5c84c', INK, 1.3); ell(c, 10.4, 10.2, 1.6, 1.2, '#fff3c2');
  },
  autumn(c) {
    const pts = []; for (let k = 0; k < 10; k++) { const an = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4.6 : 9.5; pts.push(12 + Math.cos(an) * r, 11.5 + Math.sin(an) * r); }
    fp(c, pts, '#e0762f', INK, 1.3); line(c, 12, 11.5, 12, 22, '#7a4a22', 1.5); line(c, 12, 11.5, 12, 5, '#a8521f', .9);
  },
  winter(c) {
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; const dx = Math.cos(a) * 9.5, dy = Math.sin(a) * 9.5; line(c, 12 - dx, 12 - dy, 12 + dx, 12 + dy, INK, 3.6); }
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; const dx = Math.cos(a) * 9.5, dy = Math.sin(a) * 9.5; line(c, 12 - dx, 12 - dy, 12 + dx, 12 + dy, '#a9d6ea', 2); }
    ell(c, 12, 12, 2.2, 2.2, '#fff', INK, .9);
  },
  zoomIn(c) { ell(c, 10, 10, 7, 7, '#fbf6ea', INK, 1.6); line(c, 15, 15, 21, 21, INK, 3); line(c, 6.5, 10, 13.5, 10, INK, 2); line(c, 10, 6.5, 10, 13.5, INK, 2); },
  zoomOut(c) { ell(c, 10, 10, 7, 7, '#fbf6ea', INK, 1.6); line(c, 15, 15, 21, 21, INK, 3); line(c, 6.5, 10, 13.5, 10, INK, 2); },
  menu(c) { for (const y of [6, 12, 18]) line(c, 5, y, 19, y, INK, 2.6); },
  codex(c) {
    fp(c, [2.5, 5, 11, 6.5, 11, 21, 2.5, 19.5], '#4f7fb8', INK, 1.3); fp(c, [21.5, 5, 13, 6.5, 13, 21, 21.5, 19.5], '#4f7fb8', INK, 1.3);
    fp(c, [4, 4, 11.4, 5.4, 11.4, 19, 4, 17.6], '#fbf6ea', INK, 1); fp(c, [20, 4, 12.6, 5.4, 12.6, 19, 20, 17.6], '#fbf6ea', INK, 1);
    for (const y of [8.5, 11.5, 14.5]) { line(c, 5.5, y, 9.8, y + .7, '#9a9585', 1); line(c, 18.5, y, 14.2, y + .7, '#9a9585', 1); }
  },
  space(c) {
    // No room: a dashed footprint with a red cross.
    c.setLineDash([2.4, 2]); rect(c, 3.5, 3.5, 17, 17, '#fbf6ea', INK, 1.4); c.setLineDash([]);
    line(c, 7, 7, 17, 17, '#c4553f', 3); line(c, 17, 7, 7, 17, '#c4553f', 3);
  },
  year(c) {
    rr(c, 3.5, 5, 17, 16, 2.4); c.fillStyle = '#fbf6ea'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
    c.save(); rr(c, 3.5, 5, 17, 16, 2.4); c.clip(); rect(c, 3.5, 5, 17, 5, '#d6402f'); c.restore();
    rr(c, 3.5, 5, 17, 16, 2.4); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
    line(c, 8, 3, 8, 7.2, INK, 1.8); line(c, 16, 3, 16, 7.2, INK, 1.8);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) rect(c, 6.5 + k * 4.2, 12.5 + r * 4, 2.6, 2.4, r === 1 && k === 1 ? GOLD : '#9a9585');
  },
};
function chest(c, cx, by, w, h) {
  const x = cx - w / 2, lidH = h * .42, y = by - h;
  shadow(c, cx + .8, by + .3, w * .55, h * .14, .3);
  rect(c, x, y + lidH, w, h - lidH, '#a8693a', INK, Math.max(.8, w * .06));
  c.beginPath(); c.moveTo(x, y + lidH); c.lineTo(x, y + lidH * .6); c.quadraticCurveTo(cx, y - lidH * .5, x + w, y + lidH * .6); c.lineTo(x + w, y + lidH); c.closePath();
  c.fillStyle = '#c47e44'; c.fill(); c.strokeStyle = INK; c.lineWidth = Math.max(.8, w * .06); c.stroke();
  rect(c, x + w * .14, y + lidH * .1, w * .14, h - lidH * .1, GOLD); rect(c, x + w * .72, y + lidH * .1, w * .14, h - lidH * .1, GOLD);
  rect(c, x, y + lidH - h * .06, w, h * .12, GOLD_D);
  rect(c, cx - w * .1, y + lidH - h * .08, w * .2, h * .26, GOLD_L, INK, Math.max(.5, w * .04));
}

export function drawIcon(ctx, key, x, y, size) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(size / 24, size / 24);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const f = ICONS[key];
  if (f) f(ctx);
  else { ell(ctx, 12, 12, 8, 8, '#bdbab2', INK, 1.4); ell(ctx, 12, 12, 2.4, 2.4, INK); }
  ctx.restore();
}

/* ---------------- 标记 ---------------- */
export function drawThreat(ctx, px, py, s, t = 0) {
  tileStart(ctx, px, py, s);
  const c = ctx, p = .5 + .5 * Math.sin((t || 0) * 4);
  rect(c, 0, 0, 32, 32, `rgba(205,45,30,${.14 + .14 * p})`);
  c.strokeStyle = `rgba(214,52,36,${.55 + .4 * p})`; c.lineWidth = 2 + p; c.setLineDash([5, 3]); c.lineDashOffset = -(t || 0) * 6;
  c.strokeRect(1.8, 1.8, 28.4, 28.4); c.setLineDash([]);
  // 战旗 + 火把
  shadow(c, 12, 28, 5, 1.4, .35);
  line(c, 11, 28.5, 11, 6, '#5a3b24', 1.8);
  fp(c, [11.8, 9, 25, 9, 22, 13.2, 25, 17.4, 11.8, 17.4], '#c8352b', INK, 1);
  line(c, 15, 11, 20, 15.6, '#2a2018', 1.4); line(c, 20, 11, 15, 15.6, '#2a2018', 1.4);
  rect(c, 9.4, 5.2, 3.2, 2.4, '#7a5030', INK, .7);
  const fl = Math.sin((t || 0) * 13) * .8;
  fp(c, [8.6, 5.4, 9.8, 1.2 + fl, 11, 3.2, 12.4, .2 - fl, 13.4, 5.4], '#ff9a3a', INK, .6);
  fp(c, [10, 5.4, 11.2, 2.6, 12.2, 5.4], '#ffe08a', null);
  ctx.restore();
}

export function drawTreasure(ctx, px, py, s) {
  tileStart(ctx, px, py, s);
  const c = ctx;
  chest(c, 16, 25.5, 15, 11);
  sparkle(c, 24.5, 11.5, 2.6); sparkle(c, 8.5, 13, 1.6);
  ctx.restore();
}

/** 兼容旧入口：新美术无需加载任何资源。 */
export async function loadArt() { return { loaded: 0, total: 0 }; }
