// 像素场景：低分辨率缓冲画布 + 程序绘制的分层风景（天空色带、云、山、松林、水面倒影）。
export const LH = 360;
export const PIXEL_H = 240;
export const FONT = '"GuildPixel","PingFang SC","Microsoft YaHei",sans-serif';

// 缓冲画布高度约 240 像素，整数倍放大并保持像素锐利。返回的 LW 为 360 高逻辑坐标下的宽度。
export function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = window.innerWidth, h = window.innerHeight;
  const k = Math.max(1, Math.round((h * dpr) / PIXEL_H));
  const BW = Math.ceil((w * dpr) / k), BH = Math.ceil((h * dpr) / k);
  if (canvas.width !== BW || canvas.height !== BH) {
    canvas.width = BW;
    canvas.height = BH;
  }
  const px = BH / LH;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(px, 0, 0, px, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return {ctx, LW: BW / px, scale: px, px, BW, BH, k, dpr};
}

export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function rect(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function pixelCircle(ctx, cx, cy, r) {
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('');
}

export function mix(a, b, t) {
  const p = s => parseInt(s.slice(1), 16);
  const A = p(a), B = p(b);
  const c = sh => Math.round(((A >> sh) & 255) * (1 - t) + ((B >> sh) & 255) * t);
  return '#' + [16, 8, 0].map(sh => c(sh).toString(16).padStart(2, '0')).join('');
}

// 阶梯色带天空，色带交界处用棋盘格抖动过渡
export function skyBands(ctx, W, y0, y1, cols) {
  const n = cols.length;
  const bh = (y1 - y0) / n;
  for (let i = 0; i < n; i++) rect(ctx, 0, y0 + i * bh, W, bh + 1, cols[i]);
  for (let i = 1; i < n; i++) {
    const y = Math.round(y0 + i * bh);
    ctx.fillStyle = cols[i - 1];
    for (let x = 0; x < W; x += 2) ctx.fillRect(x + (i % 2), y, 1, 1);
    for (let x = 0; x < W; x += 4) ctx.fillRect(x + 1, y + 1, 1, 1);
    ctx.fillStyle = cols[i];
    for (let x = 0; x < W; x += 2) ctx.fillRect(x + ((i + 1) % 2), y - 1, 1, 1);
    for (let x = 0; x < W; x += 4) ctx.fillRect(x + 3, y - 2, 1, 1);
  }
}

export function stars(ctx, W, H, seed, n, col = '#fff6dc') {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash(i + seed) * W), y = Math.floor(hash(i * 3.7 + seed) * H);
    ctx.globalAlpha = 0.35 + hash(i * 9 + seed) * 0.65;
    ctx.fillRect(x, y, 1, 1);
    if (hash(i * 5.1 + seed) > 0.93) {
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
    }
  }
  ctx.globalAlpha = 1;
}

export function moon(ctx, x, y, r, col = '#fff1cf', rim = '#e0c79a', halo = 'rgba(255,240,200,0.10)') {
  ctx.fillStyle = halo;
  pixelCircle(ctx, x, y, r * 3);
  pixelCircle(ctx, x, y, Math.round(r * 2));
  ctx.fillStyle = rim;
  pixelCircle(ctx, x, y, r);
  ctx.fillStyle = col;
  pixelCircle(ctx, x - 1, y - 1, r - 1);
  ctx.fillStyle = rim;
  ctx.fillRect(x - Math.round(r / 3), y - 2, 3, 2);
  ctx.fillRect(x + 2, y + Math.round(r / 3), 2, 2);
  ctx.fillRect(x - 2, y + Math.round(r / 2), 2, 1);
}

// 蓬松的像素云：暗部、中间色、亮边三层
export function cloud(ctx, x, y, w, [hi, mid, lo], seed = 1) {
  const n = Math.max(3, Math.round(w / 14));
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const r = Math.round((5 + hash(seed + i * 1.3) * 7) * (1 - Math.abs(t - 0.5) * 0.9) + 3);
    puffs.push([x + t * w, y - r * 0.4, r]);
  }
  ctx.fillStyle = lo;
  for (const [px, py, r] of puffs) pixelCircle(ctx, px + 1, py + 2, r);
  rect(ctx, x - 2, y, w + 4, 4, lo);
  ctx.fillStyle = mid;
  for (const [px, py, r] of puffs) pixelCircle(ctx, px, py, r);
  rect(ctx, x, y - 1, w, 3, mid);
  ctx.fillStyle = hi;
  for (const [px, py, r] of puffs) pixelCircle(ctx, px - 1, py - 2, Math.max(1, r - 3));
  ctx.fillStyle = mid;
  for (const [px, py, r] of puffs) pixelCircle(ctx, px + 1, py, Math.max(1, r - 4));
}

// 连绵山脉：受光侧带亮边，可选雪顶
export function mountains(ctx, W, baseY, amp, col, seed, {light, snow, step = 1, rough = 1} = {}) {
  let prev = 0;
  for (let x = 0; x < W; x += step) {
    const n = x * 0.011 + seed * 13;
    const h = (Math.sin(n) * 0.55 + Math.sin(n * 2.7 + 1.3) * 0.28 * rough + Math.sin(n * 6.1 + seed) * 0.12 * rough + 0.6) * amp;
    const top = Math.round(baseY - h);
    rect(ctx, x, top, step, baseY - top + 1, col);
    if (light && top < prev) rect(ctx, x, top, step, 2, light);
    if (snow && h > amp * 0.85) rect(ctx, x, top, step, Math.round((h - amp * 0.85) * 0.8) + 1, snow);
    prev = top;
  }
}

export function pine(ctx, x, base, h, col, light) {
  const tiers = Math.max(2, Math.round(h / 8));
  rect(ctx, x - 1, base - 3, 2, 3, shade(col, 0.7));
  for (let t = 0; t < tiers; t++) {
    const ty = base - 3 - t * (h / tiers) * 0.85;
    const tw = Math.round((tiers - t) * (h / tiers) * 0.55 + 2);
    const th = Math.round(h / tiers + 2);
    for (let r = 0; r < th; r++) {
      const ww = Math.round(tw * (r / th));
      rect(ctx, x - ww, ty - th + r, ww * 2 + 1, 1, col);
      if (light && r > 1) rect(ctx, x - ww, ty - th + r, 1, 1, light);
    }
  }
}

export function pineRow(ctx, W, base, hMin, hMax, col, light, seed, gap = 7) {
  for (let x = -6, i = 0; x < W + 8; i++) {
    const h = hMin + hash(seed + i * 2.3) * (hMax - hMin);
    pine(ctx, x, base, h, col, light);
    x += gap + Math.round(hash(seed * 3 + i) * gap);
  }
  rect(ctx, 0, base - 2, W, 3, col);
}

export function roundTree(ctx, x, base, r, col, light, trunk) {
  rect(ctx, x - 1, base - r, 3, r, trunk);
  ctx.fillStyle = col;
  pixelCircle(ctx, x, base - r - r * 0.6, r);
  pixelCircle(ctx, x - r * 0.6, base - r - r * 0.2, r * 0.7);
  pixelCircle(ctx, x + r * 0.6, base - r - r * 0.2, r * 0.7);
  ctx.fillStyle = light;
  pixelCircle(ctx, x - r * 0.3, base - r - r * 0.9, Math.max(1, r * 0.45));
}

// 光晕：同心色阶圆（无平滑渐变）
export function pglow(ctx, x, y, r, color, alpha = 0.18) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = alpha;
    pixelCircle(ctx, x, y, Math.round(r * (1 - i * 0.3)));
  }
  ctx.restore();
}

// 兼容旧接口
export function glow(ctx, x, y, r, color, alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// 水面倒影：把 srcY 以上的像素行翻转复制到 dstY 以下，逐行正弦错位
export function reflect(ctx, src, W, srcY, dstY, h, now, {tint = '#10183a', alpha = 0.45, squash = 1.4, amp = 2} = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < h; i++) {
    const sy = Math.round(srcY - 1 - i * squash);
    if (sy < 0) break;
    const off = Math.round(Math.sin(now / 420 + i * 0.75) * amp * (0.4 + i / h));
    ctx.drawImage(src, 0, sy, W, 1, off, dstY + i, W, 1);
  }
  ctx.globalAlpha = alpha;
  rect(ctx, 0, dstY, W, h, tint);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 26; i++) {
    const y = dstY + 2 + Math.floor(hash(i * 3.1) * (h - 3));
    const x = Math.floor((hash(i * 7.7) * W + now / (40 + i * 3)) % (W + 20)) - 10;
    ctx.fillRect(x, y, 3 + (i % 4) * 2, 1);
  }
  rect(ctx, 0, dstY, W, 1, 'rgba(255,255,255,0.25)');
  ctx.restore();
}

// ---------- 区域战场布景 ----------
const PAL = {
  knight: {sky: ['#2b2a5e', '#3d3d84', '#5f53a2', '#9a62a4', '#d77c8a', '#f5a77a', '#ffd38e'], far: '#6a5a9a', farL: '#8a7ab4', mid: '#433d78', near: '#232650', nearL: '#33386a', grass: '#4d7a3c', grassL: '#7aa84a', soil: '#3a2e3a', soilL: '#4f3f48', water: '#2a3770', cloud: ['#ffe0b0', '#e9a29a', '#9a6a9a'], sun: 'moon'},
  eastern: {sky: ['#1a1438', '#2a1b50', '#43246a', '#6e2e7a', '#a84584', '#e06a8e', '#ffab9a'], far: '#5e356e', farL: '#7e4a88', mid: '#3e2458', near: '#221636', nearL: '#3a2350', grass: '#5a3a5a', grassL: '#e88aac', soil: '#2e2032', soilL: '#40283e', water: '#2a2050', cloud: ['#ffc6c6', '#d7849a', '#7a4a78'], sun: 'moonRed'},
  desert: {sky: ['#2a1d4a', '#45276a', '#74396e', '#b35366', '#e5765a', '#f9a659', '#ffd88a'], far: '#b0685e', farL: '#d08a6a', mid: '#7e4250', near: '#4c2838', nearL: '#6a3848', grass: '#c58a48', grassL: '#e8b060', soil: '#8a5a3a', soilL: '#a8703e', water: '#355a7a', cloud: ['#ffe2a8', '#f0a070', '#a05a60'], sun: 'sun'},
  undead: {sky: ['#08081a', '#10102a', '#17173a', '#20204c', '#2c2a5e', '#3d3872', '#544a8a'], far: '#2c2852', farL: '#3c3668', mid: '#1c1a3a', near: '#0f0e22', nearL: '#1c1a34', grass: '#2e4030', grassL: '#4e6a48', soil: '#211e30', soilL: '#2e2a40', water: '#141a34', cloud: ['#6a6a9a', '#45457a', '#2a2a52'], sun: 'moonGreen'},
  darkelf: {sky: ['#0b0d26', '#15133a', '#241a50', '#371f68', '#53287e', '#7a3a96', '#a858b8'], far: '#3a2a6a', farL: '#5a3a8a', mid: '#241a48', near: '#130f2a', nearL: '#221a40', grass: '#2a2a4a', grassL: '#5a4a8a', soil: '#1a1630', soilL: '#28203e', water: '#1a1a48', cloud: ['#c49ae0', '#7a58a8', '#3e2a68'], sun: 'moon'},
  ogre: {sky: ['#1e1028', '#331530', '#55202e', '#86302c', '#bc4a30', '#e8743a', '#ffb05c'], far: '#6a3030', farL: '#8a4038', mid: '#45202a', near: '#26121a', nearL: '#3a1c22', grass: '#5a4030', grassL: '#7a5a38', soil: '#3a2420', soilL: '#4e3026', water: '#4a1e28', cloud: ['#ffc080', '#d0604a', '#6a2a3a'], sun: 'sunRed'},
  beast: {sky: ['#0d2533', '#123544', '#184852', '#21605e', '#347a68', '#5a9870', '#9ec084'], far: '#2c5a5a', farL: '#3e7a6a', mid: '#1c4040', near: '#0f2626', nearL: '#1a3a34', grass: '#3a7040', grassL: '#6aa04a', soil: '#2a3328', soilL: '#384434', water: '#1a4a5a', cloud: ['#e0f0c0', '#90c0a0', '#4a7a70'], sun: 'moon'},
  frost: {sky: ['#0d1736', '#142a54', '#1c4374', '#285f92', '#3d80ae', '#62a6c8', '#a8dcee'], far: '#6a8ab0', farL: '#c8e4f4', mid: '#3a5a86', near: '#1e3258', nearL: '#2e4a74', grass: '#c8dcec', grassL: '#f0faff', soil: '#5a7090', soilL: '#7a90ae', water: '#1e3a64', cloud: ['#f0faff', '#a8c8e4', '#5a7aa8'], sun: 'moon'},
};

export function regionPalette(id) {
  return PAL[id] || PAL.knight;
}

function drawSun(ctx, kind, x, y) {
  if (kind === 'sun') moon(ctx, x, y, 14, '#fff2b0', '#ffc860', 'rgba(255,220,140,0.14)');
  else if (kind === 'sunRed') moon(ctx, x, y, 16, '#ffd080', '#ff8a40', 'rgba(255,140,60,0.16)');
  else if (kind === 'moonRed') moon(ctx, x, y, 12, '#ffd6d0', '#e88a8a', 'rgba(255,160,170,0.12)');
  else if (kind === 'moonGreen') moon(ctx, x, y, 12, '#d8ffd0', '#8ad8a0', 'rgba(150,255,170,0.10)');
  else moon(ctx, x, y, 11);
}

function castle(ctx, x, base, s, col, win) {
  const w = (tx, ty, tw, th) => rect(ctx, x + tx * s, base - ty * s - th * s, tw * s, th * s, col);
  w(0, 0, 60, 18);
  w(4, 0, 10, 34); w(46, 0, 10, 34); w(24, 0, 12, 44);
  for (const [tx, ty, tw] of [[4, 34, 10], [46, 34, 10], [24, 44, 12]]) {
    for (let i = 0; i < tw; i += 3) w(tx + i, ty, 2, 2);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(Math.round(x + tx * s), Math.round(base - ty * s - 2 * s));
    ctx.lineTo(Math.round(x + (tx + tw / 2) * s), Math.round(base - ty * s - 12 * s));
    ctx.lineTo(Math.round(x + (tx + tw) * s), Math.round(base - ty * s - 2 * s));
    ctx.fill();
  }
  for (let i = 0; i < 60; i += 4) w(i, 18, 2, 2);
  if (win) for (const [tx, ty] of [[8, 24], [50, 22], [29, 30], [29, 20], [16, 8], [40, 10]]) rect(ctx, x + tx * s, base - ty * s, Math.max(1, s), Math.max(2, s * 2), win);
}

function pagoda(ctx, x, base, col, light, win) {
  for (let t = 0; t < 4; t++) {
    const y = base - 12 - t * 13;
    const w = 26 - t * 4;
    rect(ctx, x - w / 2 + 3, y, w - 6, 12, col);
    rect(ctx, x - w / 2 - 3, y - 2, w + 6, 2, col);
    rect(ctx, x - w / 2 - 5, y - 3, 3, 1, light);
    rect(ctx, x + w / 2 + 2, y - 3, 3, 1, light);
    rect(ctx, x - 1, y + 4, 2, 3, win);
  }
  rect(ctx, x, base - 72, 1, 10, col);
  rect(ctx, x - 12, base - 12, 24, 12, col);
}

function torii(ctx, x, base, col) {
  rect(ctx, x - 14, base - 24, 3, 24, col);
  rect(ctx, x + 11, base - 24, 3, 24, col);
  rect(ctx, x - 18, base - 26, 36, 3, col);
  rect(ctx, x - 20, base - 28, 3, 2, col);
  rect(ctx, x + 17, base - 28, 3, 2, col);
  rect(ctx, x - 13, base - 20, 26, 2, col);
}

function sakura(ctx, x, base, r, trunk, petal, petalL) {
  rect(ctx, x - 1, base - r, 2, r, trunk);
  rect(ctx, x - 4, base - r - 2, 4, 1, trunk);
  ctx.fillStyle = petal;
  pixelCircle(ctx, x, base - r - 3, r * 0.8);
  pixelCircle(ctx, x - r * 0.7, base - r + 1, r * 0.55);
  pixelCircle(ctx, x + r * 0.7, base - r, r * 0.6);
  ctx.fillStyle = petalL;
  for (let i = 0; i < 10; i++) ctx.fillRect(Math.round(x - r + hash(x + i) * r * 2), Math.round(base - r * 1.6 + hash(x * 2 + i) * r), 1, 1);
}

function pyramid(ctx, x, base, h, col, light) {
  for (let r = 0; r < h; r++) {
    rect(ctx, x - r, base - h + r, r * 2 + 1, 1, col);
    rect(ctx, x - r, base - h + r, Math.ceil(r * 0.9), 1, light);
    if (r % 4 === 3) rect(ctx, x - r, base - h + r, r * 2 + 1, 1, 'rgba(0,0,0,0.12)');
  }
}

function tombstones(ctx, W, base, col, light, seed) {
  for (let i = 0; i < W / 16; i++) {
    const x = Math.round(i * 16 + hash(seed + i) * 8);
    const kind = Math.floor(hash(i * 4.4 + seed) * 3);
    if (kind === 0) {
      rect(ctx, x, base - 9, 6, 9, col);
      rect(ctx, x + 1, base - 10, 4, 1, col);
      rect(ctx, x, base - 9, 1, 9, light);
    } else if (kind === 1) {
      rect(ctx, x + 2, base - 12, 2, 12, col);
      rect(ctx, x, base - 9, 6, 2, col);
    }
  }
}

function deadTree(ctx, x, base, h, col) {
  rect(ctx, x - 1, base - h, 3, h, col);
  for (let i = 0; i < 4; i++) {
    const y = base - h + 4 + i * (h / 5);
    const d = i % 2 ? 1 : -1;
    for (let j = 0; j < 6 - i; j++) rect(ctx, x + d * (2 + j), y - j, 1, 1, col);
  }
}

function cathedral(ctx, x, base, col, win) {
  rect(ctx, x, base - 30, 40, 30, col);
  rect(ctx, x + 14, base - 58, 12, 28, col);
  for (let r = 0; r < 14; r++) rect(ctx, x + 20 - r / 2, base - 72 + r, r + 1, 1, col);
  for (let r = 0; r < 8; r++) { rect(ctx, x + 4 - r / 2, base - 40 + r, r + 1, 1, col); rect(ctx, x + 36 - r / 2, base - 40 + r, r + 1, 1, col); }
  rect(ctx, x, base - 32, 8, 2, col); rect(ctx, x + 32, base - 32, 8, 2, col);
  rect(ctx, x + 18, base - 50, 4, 7, win);
  rect(ctx, x + 6, base - 22, 3, 6, win); rect(ctx, x + 31, base - 22, 3, 6, win);
}

function mushroom(ctx, x, base, h, cap, capL, stem, dot) {
  rect(ctx, x - 2, base - h, 4, h, stem);
  ctx.fillStyle = cap;
  const r = Math.round(h * 0.55);
  for (let y = 0; y < r; y++) {
    const w = Math.round(Math.sqrt(r * r - (r - y) * (r - y)));
    ctx.fillRect(x - w, base - h - r + y, w * 2, 1);
  }
  rect(ctx, x - r, base - h - 1, r * 2, 2, shade(cap, 0.7));
  rect(ctx, x - r / 2, base - h - r + 1, r / 2, 2, capL);
  ctx.fillStyle = dot;
  ctx.fillRect(x - 3, base - h - r + 4, 2, 2);
  ctx.fillRect(x + 3, base - h - r + 6, 2, 2);
}

function spike(ctx, x, base, h, w, col, light) {
  for (let r = 0; r < h; r++) {
    const ww = Math.max(1, Math.round((r / h) * w));
    rect(ctx, x - ww / 2, base - h + r, ww, 1, col);
    if (light) rect(ctx, x - ww / 2, base - h + r, 1, 1, light);
  }
}

function totem(ctx, x, base, col, eye, seed) {
  for (let i = 0; i < 3; i++) {
    const y = base - 12 - i * 12;
    rect(ctx, x - 5, y, 10, 12, shade(col, 1 - i * 0.08));
    rect(ctx, x - 3, y + 3, 2, 2, eye);
    rect(ctx, x + 1, y + 3, 2, 2, eye);
    rect(ctx, x - 3, y + 8, 6, 1, '#1a0f10');
    if (i === 2) { rect(ctx, x - 9, y + 2, 4, 2, col); rect(ctx, x + 5, y + 2, 4, 2, col); }
  }
  if (hash(seed) > 0.5) rect(ctx, x - 1, base - 44, 2, 8, eye);
}

function regionProps(ctx, id, P, W, G, seed) {
  if (id === 'knight') {
    castle(ctx, Math.round(W * 0.62), G - 18, 1, P.mid, '#ffd27a');
    for (let i = 0; i < 4; i++) roundTree(ctx, Math.round(W * (0.08 + i * 0.07)), G - 6, 5 + i % 2 * 2, P.near, P.nearL, shade(P.near, 0.7));
  } else if (id === 'eastern') {
    pagoda(ctx, Math.round(W * 0.7), G - 10, P.mid, P.farL, '#ffb060');
    torii(ctx, Math.round(W * 0.28), G - 4, '#a8304a');
    for (let i = 0; i < 5; i++) sakura(ctx, Math.round(W * (0.06 + i * 0.1) + (i > 2 ? W * 0.45 : 0)), G - 4, 7 + (i % 3), '#2a1830', '#d86a9a', '#ffc0d8');
  } else if (id === 'desert') {
    pyramid(ctx, Math.round(W * 0.68), G - 12, 46, P.mid, shade(P.mid, 1.35));
    pyramid(ctx, Math.round(W * 0.8), G - 12, 30, shade(P.mid, 0.9), shade(P.mid, 1.25));
    rect(ctx, Math.round(W * 0.2), G - 52, 6, 40, P.mid);
    spike(ctx, Math.round(W * 0.2) + 3, G - 52, 6, 6, P.mid);
    for (let i = 0; i < 3; i++) {
      const x = Math.round(W * (0.08 + i * 0.32));
      rect(ctx, x, G - 18, 3, 12, P.near);
      rect(ctx, x - 3, G - 14, 3, 2, P.near); rect(ctx, x - 3, G - 18, 2, 4, P.near);
      rect(ctx, x + 3, G - 12, 3, 2, P.near); rect(ctx, x + 5, G - 16, 2, 4, P.near);
    }
  } else if (id === 'undead') {
    cathedral(ctx, Math.round(W * 0.64), G - 8, P.mid, '#9aff9a');
    for (let i = 0; i < 4; i++) deadTree(ctx, Math.round(W * (0.06 + i * 0.09)), G - 6, 18 + (i % 2) * 8, P.near);
    tombstones(ctx, W, G - 5, P.nearL, shade(P.nearL, 1.4), seed);
  } else if (id === 'darkelf') {
    for (let i = 0; i < 5; i++) {
      const x = Math.round(W * (0.08 + i * 0.2));
      spike(ctx, x, G - 6, 50 + (i % 2) * 20, 10, P.mid, P.farL);
      rect(ctx, x - 1, G - 40 - (i % 2) * 10, 2, 3, '#e0a0ff');
    }
    for (let i = 0; i < 6; i++) mushroom(ctx, Math.round(W * (0.05 + i * 0.17)), G - 4, 10 + (i % 3) * 5, '#6a3ab0', '#c890ff', '#2a2040', '#ffe0ff');
  } else if (id === 'ogre') {
    const vx = Math.round(W * 0.7);
    for (let r = 0; r < 60; r++) rect(ctx, vx - 20 - r, G - 70 + r, 40 + r * 2, 1, P.mid);
    rect(ctx, vx - 18, G - 70, 36, 3, '#ff7a30');
    rect(ctx, vx - 4, G - 66, 3, 20, '#ff9a40');
    for (let i = 0; i < 8; i++) spike(ctx, Math.round(W * (0.05 + i * 0.07)), G - 6, 10 + (i % 3) * 6, 5, P.near, '#c8b8a0');
    for (let i = 0; i < 3; i++) {
      const x = Math.round(W * (0.15 + i * 0.12));
      rect(ctx, x, G - 8, 8, 2, '#d8c8a8'); rect(ctx, x - 1, G - 9, 2, 4, '#d8c8a8'); rect(ctx, x + 7, G - 9, 2, 4, '#d8c8a8');
    }
  } else if (id === 'beast') {
    const wx = Math.round(W * 0.74);
    rect(ctx, wx - 26, G - 80, 52, 74, P.mid);
    for (let y = G - 72; y < G - 6; y++) for (let x = wx - 8; x < wx + 8; x++) if (hash(x * 3 + y) > 0.35) rect(ctx, x, y, 1, 1, hash(x + y * 7) > 0.6 ? '#e8fff8' : '#8ad0d8');
    for (let i = 0; i < 4; i++) totem(ctx, Math.round(W * (0.1 + i * 0.13)), G - 4, '#6a4a30', '#ffd24a', i);
    for (let i = 0; i < 5; i++) roundTree(ctx, Math.round(W * (0.02 + i * 0.22)), G - 4, 8 + i % 2 * 3, P.near, P.nearL, '#2a1c14');
  } else if (id === 'frost') {
    for (let i = 0; i < 7; i++) spike(ctx, Math.round(W * (0.04 + i * 0.15)), G - 6, 22 + (i % 3) * 12, 9, '#a8d8f0', '#f0ffff');
    for (let i = 0; i < 5; i++) pine(ctx, Math.round(W * (0.1 + i * 0.2)), G - 5, 18, P.near, '#e0f4ff');
  }
}

// 区域静态布景：返回整张缓存画布与地平线/水面/地面的 y 坐标（缓冲像素）
export function regionScene(id, BW, BH) {
  const P = regionPalette(id);
  const c = document.createElement('canvas');
  c.width = BW;
  c.height = BH;
  const ctx = c.getContext('2d');
  const seed = id.length * 7 + id.charCodeAt(0);
  const H0 = Math.round(BH * 0.5);
  const W0 = Math.round(BH * 0.62);
  skyBands(ctx, BW, 0, H0 + 2, P.sky);
  stars(ctx, BW, H0 * 0.55, seed, Math.round(BW / 5));
  if (id === 'frost' || id === 'darkelf') {
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.25 - i * 0.06;
      for (let x = 0; x < BW; x += 2) {
        const y = Math.round(20 + i * 8 + Math.sin(x * 0.02 + i) * 10 + Math.sin(x * 0.05) * 4);
        rect(ctx, x, y, 2, 14 + i * 4, id === 'frost' ? (i % 2 ? '#7affd0' : '#6ad8ff') : '#d070ff');
      }
    }
    ctx.globalAlpha = 1;
  }
  drawSun(ctx, P.sun, Math.round(BW * 0.82), Math.round(BH * 0.16));
  for (let i = 0; i < 6; i++) cloud(ctx, Math.round(hash(seed + i * 5) * BW), Math.round(BH * (0.12 + hash(seed + i) * 0.22)), 30 + Math.round(hash(i + seed * 2) * 40), P.cloud, seed + i);
  mountains(ctx, BW, H0 - 8, 30, P.far, seed, {light: P.farL, snow: id === 'frost' || id === 'knight' ? '#f0f4ff' : null});
  mountains(ctx, BW, H0 - 2, 16, P.mid, seed + 3, {light: shade(P.mid, 1.25), rough: 1.4});
  regionProps(ctx, id, P, BW, H0, seed);
  if (id !== 'desert') pineRow(ctx, BW, H0 + 1, 8, 16, P.near, P.nearL, seed, 6);
  else rect(ctx, 0, H0 - 2, BW, 3, P.near);
  // 水面（每帧绘制倒影覆盖）
  rect(ctx, 0, H0, BW, W0 - H0, P.water);
  // 近处地面：草沿 + 土层 + 横纹
  rect(ctx, 0, W0, BW, BH - W0, P.soil);
  for (let y = W0 + 6, i = 0; y < BH; y += 5 + i, i++) rect(ctx, 0, y, BW, 1, P.soilL);
  for (let i = 0; i < BW / 3; i++) {
    const x = Math.floor(hash(i * 1.7 + seed) * BW), y = W0 + 4 + Math.floor(hash(i * 3.3 + seed) * (BH - W0 - 4));
    rect(ctx, x, y, 2 + (i % 3), 1, i % 2 ? P.soilL : shade(P.soil, 0.8));
  }
  rect(ctx, 0, W0, BW, 3, P.grass);
  rect(ctx, 0, W0, BW, 1, P.grassL);
  for (let x = 0; x < BW; x += 2) {
    const h = Math.floor(hash(x * 0.37 + seed) * 4);
    if (h) rect(ctx, x, W0 - h, 1, h, hash(x) > 0.5 ? P.grass : P.grassL);
  }
  return {canvas: c, H0, W0, P};
}

// 氛围粒子：方块像素的灰烬 / 雪 / 萤火（在缓冲像素坐标中绘制）
export class Ambient {
  constructor(kind, count = 40) {
    this.kind = kind;
    this.ps = Array.from({length: count}, () => this.spawn(true));
  }

  spawn(init) {
    return {x: Math.random(), y: init ? Math.random() : (this.kind === 'snow' ? -0.05 : 1.05), v: 0.3 + Math.random() * 0.7, ph: Math.random() * 6.28, s: Math.random() > 0.8 ? 2 : 1};
  }

  draw(ctx, _kit, W, H, dt) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const BW = ctx.canvas.width, BH = ctx.canvas.height;
    const now = performance.now();
    if (this.kind !== 'snow') ctx.globalCompositeOperation = 'lighter';
    for (const p of this.ps) {
      const dir = this.kind === 'snow' ? 1 : -1;
      p.y += dir * p.v * dt * 0.00005;
      p.x += Math.sin(p.ph + p.y * 9) * 0.00005 * dt;
      if (p.y > 1.06 || p.y < -0.06) Object.assign(p, this.spawn(false));
      const flick = this.kind === 'firefly' ? 0.3 + 0.7 * Math.abs(Math.sin(now / 500 + p.ph)) : 1;
      ctx.globalAlpha = (this.kind === 'snow' ? 0.85 : 0.7) * flick;
      ctx.fillStyle = this.kind === 'snow' ? '#f0f8ff' : this.kind === 'firefly' ? '#c8ff8a' : (p.ph > 3 ? '#ffb060' : '#ff7a3a');
      ctx.fillRect(Math.round(p.x * BW), Math.round(p.y * BH), p.s, p.s);
    }
    ctx.restore();
  }
}
