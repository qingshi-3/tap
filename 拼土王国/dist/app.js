import * as R from './rules.js';
import * as A from './art.js';
import { readSave, writeSave, replaceSave, readRecords, writeRecords } from './storage.js';
import { Spotlight } from './tutorial.js';

const { BUILDINGS, TERRAIN, W, H } = R;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const signed = n => (n > 0 ? '+' : '') + n;
const S = 64;                      // resolution of the cached map layer, px per cell
const BASE = 44;                   // CSS px per cell at zoom 1
const RES_NAMES = { gold: '金', food: '粮', wood: '木', fame: '声望', pop: '人口' };
const TUT_FLAG = 'patchwork-kingdom.v3.tutorial-done', TIPS_KEY = 'patchwork-kingdom.v3.tips', TUT_SEED = 20261020;

// ---------- state ----------
let storage = null;
try { storage = window.localStorage; } catch { storage = null; }
const memory = new Map();
const store = storage || { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)) };
let records = readRecords(store);
let loaded = readSave(store);
let state = loaded.ok && loaded.state ? loaded.state : null;
let saveBlocked = !loaded.ok;
let liveRun = !!(loaded.ok && loaded.state);   // false while the map shows a placeholder kingdom behind the title

let mode = null;          // {kind:'land', index, rot, ax, ay} | {kind:'build', type, rot, ax, ay}
let drag = null;          // active pointer drag of a card or ghost
let press = null;         // pointer pressed on a card, not yet a drag
let pan = null;
const pointers = new Map();
let pinch = null;
let sheet = null;         // 'land' | 'draft' | null
const dismissed = { land: 0, draft: 0 };
let guardView = false, yieldView = true;
let floaters = [];
let drops = [], particles = [];   // pieces falling into place, and the bits they kick up
let cam = { x: 0, y: 0, z: 1 };
let dirty = true, frameQueued = false, busy = false;
let toastTimer = 0, bannerTimer = 0;
let lastPointerType = 'touch';

if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
};
const canvas = $('#map'), ctx = canvas.getContext('2d');
const cache = document.createElement('canvas'); cache.width = W * S; cache.height = H * S;
const seaTile = document.createElement('canvas'); seaTile.width = seaTile.height = S * 4;
let seaPattern = null;
let dpr = 1, vw = 0, vh = 0;

// ---------- helpers ----------
const cellHash = (x, y) => ((x * 73856093) ^ (y * 19349663) ^ (state ? state.seed : 0)) >>> 0;
const cp = () => BASE * cam.z;
const year = () => R.yearOf(state), season = () => R.seasonOf(state);
function iconHtml(key, cls = '') { return `<canvas class="ic ${cls}" data-icon="${key}" width="44" height="44" aria-hidden="true"></canvas>`; }
function paintIcons(root) {
  root.querySelectorAll('canvas[data-icon]').forEach(c => { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); A.drawIcon(g, c.dataset.icon, 0, 0, c.width); });
  root.querySelectorAll('canvas[data-card]').forEach(c => {
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    A.drawCard(g, c.dataset.card, c.width, c.height, { rot: +(c.dataset.rot || 0) });
  });
  root.querySelectorAll('canvas[data-land]').forEach(c => paintLand(c, state.landOffers[+c.dataset.land]));
  root.querySelectorAll('canvas[data-terrain]').forEach(c => { const g = c.getContext('2d'); A.drawTerrain(g, c.dataset.terrain, 0, 0, c.width, 5); });
}
function paintLand(c, offer) {
  if (!offer) return;
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  const w = Math.max(...offer.cells.map(t => t.x)) + 1, h = Math.max(...offer.cells.map(t => t.y)) + 1;
  const s = Math.floor(Math.min(c.width / (w + 0.4), c.height / (h + 0.6), c.height / 2));
  const ox = Math.round((c.width - w * s) / 2), oy = Math.round((c.height - (h + 0.25) * s) / 2);
  g.save(); g.translate(ox, oy); A.drawLand(g, offer.cells, s, { depth: 0.28, shadowA: 0.25 }); g.restore();
  for (const t of offer.cells) if (t.treasure) A.drawTreasure(g, ox + t.x * s, oy + t.y * s, s);
}
function outline(g, cells, ox, oy, s) {
  const set = new Set(cells.map(c => `${c.x},${c.y}`));
  g.beginPath();
  for (const c of cells) {
    const x = ox + c.x * s, y = oy + c.y * s;
    if (!set.has(`${c.x},${c.y - 1}`)) { g.moveTo(x, y); g.lineTo(x + s, y); }
    if (!set.has(`${c.x},${c.y + 1}`)) { g.moveTo(x, y + s); g.lineTo(x + s, y + s); }
    if (!set.has(`${c.x - 1},${c.y}`)) { g.moveTo(x, y); g.lineTo(x, y + s); }
    if (!set.has(`${c.x + 1},${c.y}`)) { g.moveTo(x + s, y); g.lineTo(x + s, y + s); }
  }
  g.stroke();
}
function toast(text, ms = 2600) {
  const t = $('#toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function banner(title, sub = '') {
  const b = $('#banner'); b.innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`; b.classList.add('show');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), 1300);
}
function costText(def) { return `${def.gold}金${def.wood ? ` ${def.wood}木` : ''}`; }
/** Cost as little icon chips: gold, wood, workers. */
function costChips(def, cls = '') {
  return `<span class="costs ${cls}"><span>${iconHtml('gold')}${def.gold}</span>${def.wood ? `<span>${iconHtml('wood')}${def.wood}</span>` : ''}${def.workers ? `<span>${iconHtml('worker')}${def.workers}</span>` : ''}</span>`;
}
// What each building does, as icon rows. Text in BUILDINGS stays only as a codex footnote.
const T = t => ({ t }), B = b => ({ b }), OTHER = { other: true };
const FX = {
  hall: { base: { gold: 10, wood: 2, pop: 6 }, guard: 2 },
  house: { base: { pop: 4, gold: 1 }, rows: [{ on: ['adj'], src: [B('market')], res: 'gold', v: 1 }] },
  farm: { rows: [{ on: ['own'], src: [T('grass')], res: 'food', v: 2 }, { on: ['own'], src: [T('fertile')], res: 'food', v: 3 }, { on: ['adj'], src: [T('water')], res: 'food', v: 2, cap: 2 }],
    season: [['autumn', '×1.5'], ['winter', '×0.5']] },
  lumber: { base: { wood: 2 }, rows: [{ on: ['adj'], src: [T('forest')], res: 'wood', v: 1, cap: 5 }] },
  tower: { guard: 2 },
  fishery: { need: 'water', base: { food: 2 }, rows: [{ on: ['own', 'adj'], src: [T('water')], res: 'food', v: 1, cap: 6 }], season: [['summer', '+2', 'food']] },
  granary: { store: 25, rows: [{ on: ['adj'], src: [B('farm')], res: 'food', v: 1 }] },
  market: { base: { gold: 2 }, rows: [{ on: ['adj'], src: [B('house')], res: 'gold', v: 3 }, { on: ['adj'], src: [OTHER], res: 'gold', v: 1 }] },
  workshop: { convert: true, rows: [{ on: ['adj'], src: [B('lumber')], res: 'gold', v: 2, cap: 2 }] },
  mine: { need: 'mountain', base: { gold: 4 }, rows: [{ on: ['own'], src: [T('mountain')], res: 'gold', v: 2 }, { on: ['adj'], src: [T('mountain')], res: 'gold', v: 1 }] },
  temple: { base: { fame: 1 }, rows: [{ on: ['adj'], src: [B('house'), B('manor')], res: 'fame', v: 1, cap: 4 }] },
  barracks: { guard: 3, rows: [{ on: ['guard'], src: [{ icon: 'threat' }], res: 'fame', v: 1 }] },
  manor: { base: { pop: 6, gold: 2 }, rows: [{ on: ['adj'], src: [T('forest'), T('water')], res: 'gold', v: 1, cap: 4 }] },
  guild: { base: { gold: 6 }, rows: [{ on: ['adj'], src: [B('market'), B('workshop'), B('fishery'), B('mine')], res: 'gold', v: 3 }] },
  wonder: { base: { fame: 4 }, once: 10 },
};
const fxVal = (k, text) => `<span class="fx-v">${iconHtml(k)}${text}</span>`;
function fxSrc(q, full) {
  if (q.t) return `<span class="fx-src">${`<canvas data-terrain="${q.t}" width="36" height="36"></canvas>`}${full ? TERRAIN[q.t].name : ''}</span>`;
  if (q.b) return full ? `<span class="fx-src b"><canvas data-card="${q.b}" width="56" height="40"></canvas>${BUILDINGS[q.b].name}</span>` : `<span class="fx-name">${BUILDINGS[q.b].name}</span>`;
  if (q.other) return full ? `<span class="fx-src">${iconHtml('bldg')}其它</span>` : `<span class="fx-name">其它</span>`;
  return `<span class="fx-src">${iconHtml(q.icon)}</span>`;
}
/** Icon rows: base yield first, then where-it-comes-from rows (glyph · source → resource). */
function fxHtml(type, full = false, { base: showBase = true } = {}) {
  const f = FX[type]; if (!f) return '';
  const out = [];
  const base = [...OUT_KEYS, 'pop'].filter(k => f.base?.[k]).map(k => fxVal(k, signed(f.base[k])));
  if (f.guard) base.push(fxVal('guard', `${f.guard}格`));
  if (f.store) base.push(fxVal('food', `上限+${f.store}`));
  if (f.once) base.push(`<span class="fx-tag">建成</span>${fxVal('fame', `+${f.once}`)}`);
  if (f.need) out.push(`<div class="fx-row need">${iconHtml('own', 'glyph')}${fxSrc(T(f.need), full)}<span class="fx-tag red">必需</span></div>`);
  if (base.length && showBase) out.push(`<div class="fx-row base">${base.join('')}</div>`);
  if (f.convert) out.push(`<div class="fx-row">${fxVal('wood', '−1')}<span class="fx-arrow">→</span>${fxVal('gold', '+2')}<span class="fx-cap">≤3次</span></div>`);
  for (const r of f.rows || []) out.push(`<div class="fx-row">${r.on.map(o => iconHtml(o, 'glyph')).join('')}<span class="fx-srcs">${r.src.map(q => fxSrc(q, full)).join('')}</span><span class="fx-out"><span class="fx-arrow">→</span>${fxVal(r.res, signed(r.v))}${r.cap ? `<span class="fx-cap">≤${r.cap}</span>` : ''}</span></div>`);
  if (f.season) out.push(`<div class="fx-row">${f.season.map(([k, t, res]) => `<span class="fx-v">${iconHtml(k)}${res ? iconHtml(res) : ''}${t}</span>`).join('')}</div>`);
  return out.length ? `<div class="fx ${full ? 'full' : ''}">${out.join('')}</div>` : '';
}
function save() {
  if (saveBlocked) return;
  const r = writeSave(store, state);
  if (!r.ok) toast('未保存：' + r.reason);
}
function invalidate() { dirty = true; requestFrame(); }
function requestFrame() { if (!frameQueued) { frameQueued = true; requestAnimationFrame(frame); } }

// ---------- modal ----------
let modalResolve = null;
function modal(html, buttons = [{ label: '好的', value: true, primary: true }], { onOpen, dismissable = true, cls = '' } = {}) {
  return new Promise(resolve => {
    modalResolve?.(null);
    modalResolve = resolve;
    const body = $('#modal-body');
    body.innerHTML = html + `<div class="modal-actions">${buttons.map((b, i) => `<button class="act ${b.primary ? 'primary' : ''} ${b.danger ? 'danger' : ''}" data-i="${i}" ${b.disabled ? 'disabled' : ''}>${b.label}</button>`).join('')}</div>`;
    $('#modal').hidden = false;
    $('#modal .modal-card').className = 'modal-card ' + cls;
    $('#modal').dataset.dismissable = dismissable ? '1' : '';
    paintIcons(body);
    body.querySelectorAll('.modal-actions [data-i]').forEach(el => el.onclick = () => closeModal(buttons[+el.dataset.i].value));
    onOpen?.(body);
    body.querySelector('.modal-actions .primary, .modal-actions button')?.focus({ preventScroll: true });
  });
}
function closeModal(value) {
  $('#modal').hidden = true;
  const r = modalResolve; modalResolve = null; r?.(value);
}
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal' && $('#modal').dataset.dismissable) closeModal(null); });

// ---------- layout & camera ----------
// The map area is the space between the top bar and the two rails.
function viewArea() {
  const tray = $('#sheet'), top = $('#hud').offsetTop + $('#hud').offsetHeight + 4, bottom = tray.hidden ? 0 : tray.offsetHeight;
  const left = $('#dock').offsetWidth, right = $('#side').offsetWidth;
  const w = vw - left - right, h = vh - top - bottom;
  return { top, bottom, left, right, w, h, cx: left + w / 2, cy: top + h / 2 };
}
const mapRect = () => { const a = viewArea(); return { x: a.left, y: a.top, w: a.w, h: a.h }; };
function resize() {
  dpr = Math.min(2.5, window.devicePixelRatio || 1);
  vw = window.innerWidth; vh = window.innerHeight;
  canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
  clampCam(); requestFrame();
}
function territoryBox() {
  const xs = state.tiles.map(t => t.x), ys = state.tiles.map(t => t.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs) + 1, y1: Math.max(...ys) + 1 };
}
function centerCamera(fit = true) {
  const box = territoryBox(), area = viewArea();
  if (fit) {
    const want = Math.min(area.w / (box.x1 - box.x0 + 3), area.h / (box.y1 - box.y0 + 3), 50);
    cam.z = Math.max(0.6, Math.min(1.6, want / BASE));
  }
  const c = cp();
  cam.x = ((box.x0 + box.x1) / 2) * c - area.cx;
  cam.y = ((box.y0 + box.y1) / 2) * c - area.cy;
  clampCam(); requestFrame();
}
function clampCam() {
  const c = cp(), margin = 2 * c;
  cam.x = Math.max(-vw + margin + 0, Math.min(W * c - margin, cam.x));
  cam.y = Math.max(-vh + margin, Math.min(H * c - margin, cam.y));
}
function zoomAt(factor, sx, sy) {
  const before = cp(), z = Math.max(0.55, Math.min(2.2, cam.z * factor));
  const wx = (sx + cam.x) / before, wy = (sy + cam.y) / before;
  cam.z = z;
  cam.x = wx * cp() - sx; cam.y = wy * cp() - sy;
  clampCam(); requestFrame();
}
const toCell = (sx, sy) => ({ x: Math.floor((sx + cam.x) / cp()), y: Math.floor((sy + cam.y) / cp()) });
const toScreen = (x, y) => ({ x: x * cp() - cam.x, y: y * cp() - cam.y });

// ---------- map drawing ----------
function rebuildStatic() {
  const g = cache.getContext('2d');
  g.clearRect(0, 0, cache.width, cache.height);
  // Pieces still in the air are drawn by the frame loop, not baked in.
  const hideTiles = new Set(drops.filter(d => d.kind === 'land').flatMap(d => d.tiles.map(t => `${t.x},${t.y}`)));
  const hideB = new Set(drops.filter(d => d.kind === 'build').map(d => d.id));
  const isle = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (R.isIsland(state, x, y)) isle.push({ x, y, t: 'wild' });
    else A.drawSea(g, x * S, y * S, S, cellHash(x, y), 0, 1);
  }
  // Shallows fading out from the island, then surf at the cliff foot.
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [w, a] of [[2.6, .16], [1.7, .2], [1.0, .26]]) { g.strokeStyle = `rgba(150,214,208,${a})`; g.lineWidth = S * w; outline(g, isle, 0, 0, S); }
  g.translate(0, S * 0.3);
  g.strokeStyle = 'rgba(236,250,248,.35)'; g.lineWidth = S * 0.34; outline(g, isle, 0, 0, S);
  g.strokeStyle = 'rgba(244,253,252,.9)'; g.lineWidth = S * 0.1; outline(g, isle, 0, 0, S);
  g.restore();
  A.drawLand(g, isle, S, { depth: 0.3, side: 'cliff', shadowA: 0.22, seed: cellHash });
  A.drawLand(g, state.tiles.filter(t => !hideTiles.has(`${t.x},${t.y}`)), S, { depth: 0.18, shadowA: 0.3, seed: cellHash });
  const f = R.forecast(state), idle = new Set(f.per.filter(p => p.idle).map(p => p.id));
  perCache = f.per;
  const list = [...state.buildings].filter(b => !hideB.has(b.id)).sort((a, b) => (a.y - b.y) || (a.x - b.x));
  for (const b of list) drawBuildingAt(g, b.type, R.buildingCells(b), S, 0, 0, { level: b.level, damaged: b.damaged, idle: idle.has(b.id), rot: b.rot, t: 0 });
  dirty = false;
}
function drawBuildingAt(g, type, cells, s, ox, oy, opts) {
  const minX = Math.min(...cells.map(c => c.x)), minY = Math.min(...cells.map(c => c.y));
  g.save(); g.translate(ox + minX * s, oy + minY * s);
  A.drawBuilding(g, type, cells.map(c => ({ x: c.x - minX, y: c.y - minY })), s, opts);
  g.restore();
}
function buildSeaPattern() {
  const g = seaTile.getContext('2d');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) A.drawSea(g, x * S, y * S, S, x * 31 + y * 17, 0);
  seaPattern = ctx.createPattern(seaTile, 'repeat');
}
function ghost() {
  if (!mode) return null;
  if (mode.kind === 'land') {
    const cells = R.landCells(state, mode.index, mode.ax, mode.ay, mode.rot);
    return { cells, check: R.canPlaceLand(state, mode.index, mode.ax, mode.ay, mode.rot) };
  }
  const cells = R.footprint(mode.type, mode.ax, mode.ay, mode.rot);
  const preview = R.previewBuild(state, mode.type, mode.ax, mode.ay, mode.rot);
  return { cells, check: preview, preview };
}
let ghostCache = null, ghostKey = '', perCache = [];
function currentGhost() {
  const k = mode ? `${mode.kind}|${mode.index}|${mode.type}|${mode.ax}|${mode.ay}|${mode.rot}|${state.gold}|${state.wood}|${state.turn}|${state.buildings.length}|${state.tiles.length}` : '';
  if (k !== ghostKey) { ghostKey = k; ghostCache = ghost(); renderPlaceBar(); }
  return ghostCache;
}
function frame(now) {
  frameQueued = false;
  const t = now / 1000;
  if (dirty) rebuildStatic();
  if (drag) edgePan();
  const c = cp();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save(); ctx.translate(-cam.x, -cam.y); ctx.scale(c / S, c / S);
  ctx.fillStyle = seaPattern || '#5d9fb1';
  ctx.fillRect((cam.x / c) * S - S, (cam.y / c) * S - S, (vw / c + 2) * S, (vh / c + 2) * S);
  ctx.restore();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cache, -cam.x, -cam.y, W * c, H * c);
  const g = currentGhost();
  if (mode) drawLegal();
  const showGuard = guardView || (mode?.kind === 'build' && GUARDS.includes(mode.type));
  if (showGuard) drawGuard(g && mode.kind === 'build' && GUARDS.includes(mode.type) ? { id: -1, type: mode.type, x: mode.ax, y: mode.ay, rot: mode.rot, level: 1, damaged: false } : null);
  if (yieldView && !mode) drawYields();
  drawThreats(t);
  if (g) drawGhost(g);
  drawDrops(now);
  drawParticles(now);
  drawFloaters(now);
  if (state.threats.length || floaters.length || drag || drops.length || particles.length) requestFrame();
}
// Cells any legal placement of the current piece would cover (current rotation). Ignores cost: the card says what is short.
let legalCache = { k: '', cells: [], anchors: 0 };
function legalCells() {
  const k = mode ? `${mode.kind}|${mode.type}|${mode.index}|${mode.rot}|${state.turn}|${state.nextId}|${state.buildings.length}|${state.tiles.length}|${state.landBought}` : '';
  if (legalCache.k === k) return legalCache;
  const seen = new Map();
  let anchors = 0;
  if (mode) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const land = mode.kind === 'land';
    const ok = land ? R.canPlaceLand(state, mode.index, x, y, mode.rot).ok : R.canBuild(state, mode.type, x, y, mode.rot, { fitOnly: true }).ok;
    if (!ok) continue;
    anchors++;
    for (const cell of land ? R.landCells(state, mode.index, x, y, mode.rot) : R.footprint(mode.type, x, y, mode.rot)) seen.set(`${cell.x},${cell.y}`, cell);
  }
  legalCache = { k, cells: [...seen.values()], anchors };
  return legalCache;
}
function drawLegal() {
  const L = legalCells(), c = cp();
  ctx.save();
  // Dim everything except where the piece can go.
  ctx.beginPath(); ctx.rect(-4, -4, vw + 8, vh + 8);
  for (const cell of L.cells) { const p = toScreen(cell.x, cell.y); ctx.rect(p.x, p.y, c, c); }
  ctx.fillStyle = 'rgba(10, 22, 28, .42)'; ctx.fill('evenodd');
  ctx.fillStyle = 'rgba(190, 245, 150, .12)';
  for (const cell of L.cells) { const p = toScreen(cell.x, cell.y); ctx.fillRect(p.x, p.y, c, c); }
  ctx.strokeStyle = '#d9ffb8'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
  outline(ctx, L.cells, -cam.x, -cam.y, c);
  ctx.restore();
}
function drawGuard(extra) {
  const covered = R.guardMap(state, extra), c = cp();
  ctx.save(); ctx.fillStyle = '#4f86a83a'; ctx.strokeStyle = '#cfe6f5aa'; ctx.lineWidth = 1;
  for (const k of covered.keys()) {
    const [x, y] = k.split(',').map(Number);
    if (!R.isIsland(state, x, y)) continue;
    const p = toScreen(x, y); ctx.fillRect(p.x, p.y, c, c);
  }
  ctx.restore();
}
function drawThreats(t) {
  if (!state.threats.length) return;
  const covered = R.guardMap(state, mode?.kind === 'build' && GUARDS.includes(mode.type) ? { id: -1, type: mode.type, x: mode.ax, y: mode.ay, rot: mode.rot, level: 1, damaged: false } : null), c = cp();
  for (const th of state.threats) {
    const p = toScreen(th.x, th.y), safe = covered.has(`${th.x},${th.y}`);
    A.drawThreat(ctx, p.x, p.y, c, safe ? 0 : t);
    if (safe) A.drawIcon(ctx, 'guard', p.x + c * 0.52, p.y + c * 0.02, c * 0.46);
  }
}
const GUARDS = ['tower', 'barracks'];
/** A dark pill of icon+number pairs centred at (x, y). */
function pill(x, y, parts, { size = 14, bad = false, text = '' } = {}) {
  ctx.save();
  ctx.font = `800 ${size}px system-ui, sans-serif`; ctx.textBaseline = 'middle';
  const ic = size * 1.1, gap = size * 0.3, pad = size * 0.4;
  const items = parts.map(p => ({ ...p, s: p.text ?? signed(p.v) })).map(p => ({ ...p, w: (p.key ? ic + 1 : 0) + ctx.measureText(p.s).width }));
  const tw = text ? ctx.measureText(text).width : 0;
  const w = items.reduce((s, p) => s + p.w, 0) + gap * Math.max(0, items.length - 1) + tw + pad * 2, h = size * 1.55;
  const x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2);
  ctx.beginPath(); ctx.roundRect(x0, y0, w, h, h / 2);
  ctx.fillStyle = bad ? '#b8412fee' : '#2b2a20e6'; ctx.fill();
  ctx.strokeStyle = bad ? '#ffd0c8' : '#fff3d266'; ctx.lineWidth = 1; ctx.stroke();
  let cx = x0 + pad;
  if (text) { ctx.fillStyle = '#fff'; ctx.fillText(text, cx, y0 + h / 2 + 1); cx += tw; }
  for (const p of items) {
    if (p.key) { A.drawIcon(ctx, p.key, cx, y0 + (h - ic) / 2, ic); cx += ic + 1; }
    ctx.fillStyle = p.v < 0 ? '#ff9b8a' : '#fff4c2'; ctx.fillText(p.s, cx, y0 + h / 2 + 1); cx += ctx.measureText(p.s).width + gap;
  }
  ctx.restore();
  return { w, h };
}
const OUT_KEYS = ['gold', 'food', 'wood', 'fame'];
// Every building's yield this season, floating over its roof.
function drawYields() {
  const c = cp(), size = Math.max(11, Math.min(14, c * 0.26));
  if (c < 26) return;
  for (const p of perCache) {
    const b = state.buildings.find(x => x.id === p.id);
    if (!b) continue;
    const cells = R.buildingCells(b), x = (Math.min(...cells.map(q => q.x)) + Math.max(...cells.map(q => q.x)) + 1) / 2, y = Math.min(...cells.map(q => q.y));
    const s = toScreen(x, y);
    if (s.x < -60 || s.y < -30 || s.x > vw + 60 || s.y > vh + 30) continue;
    if (p.damaged) { pill(s.x, s.y + size * 1.05, [], { size, bad: true, text: '损毁' }); continue; }
    if (p.idle) { pill(s.x, s.y + size * 1.05, [{ key: 'worker', text: '停工' }], { size, bad: true }); continue; }
    const parts = OUT_KEYS.filter(k => p[k]).map(k => ({ key: k, v: p[k] }));
    if (parts.length) pill(s.x, s.y + size * 1.05, parts, { size });
  }
}
// Cells of the ghost that break the rules on their own (off the kingdom, overlapping, wrong terrain).
function badCells(g) {
  const bad = new Set();
  for (const cell of g.cells) {
    const k = `${cell.x},${cell.y}`;
    if (mode.kind === 'land') { if (!R.isIsland(state, cell.x, cell.y) || R.tileAt(state, cell.x, cell.y)) bad.add(k); continue; }
    const tile = R.tileAt(state, cell.x, cell.y);
    if (!tile || R.buildingAt(state, cell.x, cell.y) || !BUILDINGS[mode.type].terrains.includes(tile.t)) bad.add(k);
  }
  return bad;
}
/** A light chip on a contributing cell: resource icon + number, sized to sit inside the cell. */
function badge(x, y, key, v, size) {
  ctx.save();
  const t = signed(v); ctx.font = `900 ${size}px system-ui, sans-serif`; ctx.textBaseline = 'middle';
  const ic = size * 1.15, w = ic + ctx.measureText(t).width + size * 0.55, h = size * 1.5;
  const x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2);
  ctx.beginPath(); ctx.roundRect(x0, y0, w, h, h / 2);
  ctx.fillStyle = '#fffaf0'; ctx.shadowColor = '#0006'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 1.5; ctx.fill(); ctx.shadowColor = 'transparent';
  A.drawIcon(ctx, key, x0 + size * 0.2, y0 + (h - ic) / 2, ic);
  ctx.fillStyle = v < 0 ? '#c4402f' : '#3b3a2c'; ctx.fillText(t, x0 + size * 0.25 + ic, y0 + h / 2 + 1);
  ctx.restore();
}
const GHOST_LIFT = 0.16;
function drawGhost(g) {
  const c = cp(), okay = g.check.ok, bad = badCells(g);
  ctx.save();
  if (mode.kind === 'build') {
    // A see-through blueprint: the terrain underneath stays readable.
    ctx.globalAlpha = drag ? 0.3 : 0.42;
    drawBuildingAt(ctx, mode.type, g.cells, c, -cam.x, -cam.y, { level: 1, damaged: false, idle: false, rot: mode.rot, t: 0 });
    ctx.globalAlpha = 1;
  } else {
    // Held a little above the ground: its shadow shows where it lands, the see-through top shows what's below.
    ctx.globalAlpha = 0.82;
    ctx.save(); ctx.translate(-cam.x, -cam.y); A.drawLand(ctx, g.cells, c, { depth: 0.18, lift: GHOST_LIFT, seed: cellHash }); ctx.restore();
    for (const cell of g.cells) if (cell.treasure) { const p = toScreen(cell.x, cell.y); A.drawTreasure(ctx, p.x, p.y - GHOST_LIFT * c, c); }
    ctx.globalAlpha = 1;
  }
  const gl = mode.kind === 'land' ? GHOST_LIFT * c : 0;
  for (const cell of g.cells) {
    const p = toScreen(cell.x, cell.y), wrong = bad.has(`${cell.x},${cell.y}`);
    p.y -= gl;
    ctx.fillStyle = wrong ? '#e0503c66' : okay ? '#7fd36b2e' : '#ffd36b22';
    ctx.fillRect(p.x, p.y, c, c);
    if (wrong) {
      const m = c * 0.18, cx = p.x + c / 2, cy = p.y + c / 2;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(3, c * 0.1); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - m, cy - m); ctx.lineTo(cx + m, cy + m); ctx.moveTo(cx + m, cy - m); ctx.lineTo(cx - m, cy + m); ctx.stroke();
      ctx.strokeStyle = '#c4402f'; ctx.lineWidth = Math.max(1.5, c * 0.05); ctx.stroke();
    }
  }
  ctx.strokeStyle = okay ? '#efffe0' : '#ffd0c8'; ctx.lineWidth = 3;
  outline(ctx, g.cells, -cam.x, -cam.y - gl, c);
  const size = Math.max(12, Math.min(16, c * 0.32));
  if (mode.kind === 'build' && okay && c >= 22) {
    // Where the yield comes from: neighbouring cells glow softly and carry one small badge each.
    const own = new Set(g.cells.map(q => `${q.x},${q.y}`)), byCell = new Map();
    for (const q of R.contributions(state, mode.type, mode.ax, mode.ay, mode.rot)) {
      const k = `${q.x},${q.y}`; if (own.has(k)) continue;
      const e = byCell.get(k) || { x: q.x, y: q.y, res: q.res, v: 0 }; if (e.res === q.res) e.v += q.v; byCell.set(k, e);
    }
    for (const e of byCell.values()) {
      const p = toScreen(e.x, e.y);
      ctx.fillStyle = 'rgba(255,226,130,.22)'; ctx.beginPath(); ctx.roundRect(p.x + 2, p.y + 2, c - 4, c - 4, c * 0.14); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,190,.75)'; ctx.lineWidth = 1.5; ctx.stroke();
      badge(p.x + c / 2, p.y + c / 2, e.res, e.v, Math.max(11, Math.min(16, c * 0.26)));
    }
  }
  // Summary above the piece: the season's change, or why it can't go here.
  const minX = Math.min(...g.cells.map(q => q.x)), maxX = Math.max(...g.cells.map(q => q.x)) + 1, minY = Math.min(...g.cells.map(q => q.y));
  const top = toScreen((minX + maxX) / 2, minY), ty = Math.max(viewArea().top + size, top.y - size * 1.2);
  if (!okay && g.check.reason) pill(top.x, ty, [], { size, bad: true, text: g.check.reason.replace(/[。.]$/, '') });
  else if (mode.kind === 'build' && g.preview?.delta) {
    const d = g.preview.delta;
    const parts = [...OUT_KEYS, 'pop'].filter(k => d[k]).map(k => ({ key: k, v: d[k] }));
    if (d.guard) parts.push({ key: 'guard', text: `${d.guard}格`, v: 1 });
    if (parts.length) pill(top.x, ty, parts, { size });
  } else if (mode.kind === 'land') {
    const o = state.landOffers[mode.index], tr = o.cells.some(q => q.treasure);
    if (tr) pill(top.x, ty, [{ key: 'treasure', v: o.treasure }], { size });
  }
  ctx.restore();
}
// ---------- landing: the piece drops in, then the ground answers by material ----------
const FALL_MS = 340, HOP_MS = 170, FALL_H = 1.6;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function dropIn(d) {
  if (reduceMotion()) { burst(d); return; }
  drops.push({ ...d, t0: performance.now(), landed: false });
  invalidate();
}
function dropLift(d, now) {
  const e = now - d.t0;
  if (e < FALL_MS) { const k = e / FALL_MS; return FALL_H * (1 - k * k); }
  const u = (e - FALL_MS) / HOP_MS;
  return u < 1 ? 0.07 * Math.sin(Math.PI * u) : 0;
}
function drawDrops(now) {
  if (!drops.length) return;
  const c = cp();
  for (const d of drops) {
    const e = now - d.t0, lift = dropLift(d, now);
    if (!d.landed && e >= FALL_MS) { d.landed = true; burst(d); buzz('light'); }
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    ctx.globalAlpha = Math.min(1, 0.35 + e / 160);
    if (d.kind === 'land') A.drawLand(ctx, d.tiles, c, { depth: 0.18, lift, shadowA: 0.3 - lift * 0.1, seed: cellHash });
    else {
      ctx.fillStyle = `rgba(16,28,24,${0.28 - lift * 0.12})`;
      for (const q of d.cells) ctx.fillRect(q.x * c + c * 0.12, q.y * c + c * 0.16, c * 0.84, c * 0.84);
      drawBuildingAt(ctx, d.type, d.cells, c, 0, -lift * c, { level: 1, damaged: false, idle: false, rot: d.rot, t: 0 });
    }
    ctx.restore();
  }
  const before = drops.length;
  drops = drops.filter(d => now - d.t0 < FALL_MS + HOP_MS);
  if (drops.length !== before) dirty = true;
}
// Per material: colours, particle shape, gravity (cells/s²), and extras.
const PFX = {
  grass: { cols: ['#7a5a3a', '#6a4a2e', '#8fc35a', '#a3cf6a'], shape: 'chunk', g: 9 },
  forest: { cols: ['#4c7f42', '#6fa45a', '#8fbf5f', '#7a5a3a'], shape: 'leaf', g: 2.2 },
  water: { cols: ['#f2fdff', '#bfe8f0', '#86cddd'], shape: 'drop', g: 11, ring: true },
  mountain: { cols: ['#8a8678', '#a9a389', '#6f6c62'], shape: 'chunk', g: 10, dust: '#ddd6c2' },
  fertile: { cols: ['#5b4128', '#6a4f30', '#8c6d44'], shape: 'chunk', g: 9, dust: '#cdb084' },
  build: { cols: ['#e9e1cc'], shape: 'puff', g: 0 },
};
function burst(d) {
  const now = performance.now(), rnd = Math.random;
  const cells = d.kind === 'land' ? d.tiles : d.cells.map(q => ({ ...q, t: 'build' }));
  const set = new Set(cells.map(q => `${q.x},${q.y}`));
  for (const q of cells) {
    const P = PFX[q.t] || PFX.grass;
    // Only the outer edges throw things: bottom edge most, then the sides.
    const edges = [];
    if (!set.has(`${q.x},${q.y + 1}`)) edges.push('b', 'b');
    if (!set.has(`${q.x - 1},${q.y}`)) edges.push('l');
    if (!set.has(`${q.x + 1},${q.y}`)) edges.push('r');
    if (!set.has(`${q.x},${q.y - 1}`)) edges.push('t');
    if (!edges.length) edges.push('c');
    const n = P.shape === 'puff' ? 3 : P.shape === 'drop' ? 9 : 7;
    for (let i = 0; i < n; i++) {
      const side = edges[Math.floor(rnd() * edges.length)], u = rnd();
      let x = q.x + u, y = q.y + 1.1, vx = (rnd() - 0.5) * 1.6, vy = -(1.4 + rnd() * 2.2);
      if (side === 'l') { x = q.x - 0.02; y = q.y + u; vx = -(0.8 + rnd() * 1.4); }
      if (side === 'r') { x = q.x + 1.02; y = q.y + u; vx = 0.8 + rnd() * 1.4; }
      if (side === 't') { y = q.y; vy -= 0.6; }
      if (side === 'c') { y = q.y + u; }
      if (P.shape === 'drop') vy -= 1.2;
      if (P.shape === 'leaf') { vy *= 0.7; vx *= 0.8; }
      if (P.shape === 'puff') { vx *= 0.35; vy = -0.25 - rnd() * 0.3; }
      particles.push({ x, y, vx, vy, g: P.g, shape: P.shape, col: P.cols[Math.floor(rnd() * P.cols.length)], t0: now + rnd() * 40,
        life: P.shape === 'leaf' ? 1100 : P.shape === 'puff' ? 700 : 650, size: P.shape === 'puff' ? 0.16 + rnd() * 0.1 : 0.05 + rnd() * 0.05, spin: rnd() * 6, ph: rnd() * 6 });
    }
    if (P.ring) particles.push({ shape: 'ring', x: q.x + 0.5, y: q.y + 0.55, vx: 0, vy: 0, g: 0, t0: now, life: 650, size: 0.3, col: 'rgba(240,252,255,.7)', spin: 0, ph: 0 });
    if (P.dust) for (let i = 0; i < 2; i++) particles.push({ shape: 'puff', x: q.x + rnd(), y: q.y + 1.05, vx: (rnd() - 0.5) * 0.6, vy: -0.3, g: 0, t0: now, life: 700, size: 0.14 + rnd() * 0.08, col: P.dust, spin: 0, ph: 0 });
  }
  requestFrame();
}
function drawParticles(now) {
  if (!particles.length) return;
  particles = particles.filter(p => now - p.t0 < p.life);
  const c = cp();
  ctx.save();
  for (const p of particles) {
    const e = now - p.t0;
    if (e < 0) continue;
    const a = e / 1000, k = e / p.life;
    let x = p.x + p.vx * a, y = p.y + p.vy * a + 0.5 * p.g * a * a;
    if (p.shape === 'leaf') x += Math.sin(a * 7 + p.ph) * 0.12;
    const sx = x * c - cam.x, sy = y * c - cam.y, r = p.size * c;
    ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    ctx.fillStyle = p.col;
    if (p.shape === 'chunk') { ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.spin + a * 9); ctx.fillRect(-r, -r * 0.8, r * 2, r * 1.6); ctx.restore(); }
    else if (p.shape === 'leaf') { ctx.beginPath(); ctx.ellipse(sx, sy, r * 1.5, r * 0.75, p.spin + Math.sin(a * 5 + p.ph), 0, Math.PI * 2); ctx.fill(); }
    else if (p.shape === 'drop') { const vy = p.vy + p.g * a; ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.8, r * (1 + Math.min(1.2, Math.abs(vy) * 0.25)), Math.atan2(vy, p.vx) - Math.PI / 2, 0, Math.PI * 2); ctx.fill(); }
    else if (p.shape === 'puff') { ctx.globalAlpha *= 0.7; ctx.beginPath(); ctx.arc(sx, sy, r * (1 + k * 1.6), 0, Math.PI * 2); ctx.fill(); }
    else if (p.shape === 'ring') { ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(1, c * 0.025) * (1 - k); ctx.beginPath(); ctx.ellipse(sx, sy, r * (1 + k * 2.2), r * (0.5 + k * 1.1), 0, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.restore();
}
function addFloater(x, y, parts, delay = 0) {
  const now = performance.now();
  parts.filter(p => p.v).forEach((p, i) => floaters.push({ x, y, key: p.key, text: signed(p.v), bad: p.v < 0, t0: now + delay + i * 140 }));
  requestFrame();
}
function drawFloaters(now) {
  if (!floaters.length) return;
  const c = cp(), size = Math.max(16, Math.min(24, c * 0.5));
  floaters = floaters.filter(f => now - f.t0 < 1500);
  ctx.save(); ctx.font = `800 ${size}px system-ui, sans-serif`; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
  for (const f of floaters) {
    const age = (now - f.t0) / 1500;
    if (age < 0) continue;
    const p = toScreen(f.x, f.y), y = p.y - age * c * 0.9;
    ctx.globalAlpha = age < 0.75 ? 1 : 1 - (age - 0.75) / 0.25;
    A.drawIcon(ctx, f.key, p.x - size * 1.05, y - size * 0.5, size);
    ctx.strokeStyle = '#2b2a20'; ctx.fillStyle = f.bad ? '#ff9b8a' : '#fff4c2';
    ctx.strokeText(f.text, p.x, y); ctx.fillText(f.text, p.x, y);
  }
  ctx.restore();
}
function edgePan() {
  if (!drag || drag.sx == null) return;
  const area = viewArea(), edge = 36, speed = 9;
  let dx = 0, dy = 0;
  const l = area.left, r = vw - area.right;
  if (drag.sx < l + edge && drag.sx > l - 10) dx = -speed; else if (drag.sx > r - edge && drag.sx < r + 10) dx = speed;
  if (drag.sy < area.top + edge && drag.sy > area.top - 30) dy = -speed; else if (drag.sy > vh - edge) dy = speed;
  if (dx || dy) { cam.x += dx; cam.y += dy; clampCam(); updateDrag(drag.sx, drag.sy); }
}

// ---------- HUD & dock ----------
function renderHud() {
  const f = R.forecast(state), w = R.workers(state);
  $('#season').innerHTML = `第${year()}年 · ${R.SEASONS[season()].name}<small>${R.SEASONS[season()].tip.split('；')[0]}</small>`;
  const res = [
    ['gold', state.gold, signed(f.gold), f.gold < 0],
    ['food', state.food, signed(f.food), f.famine],
    ['wood', state.wood, signed(f.wood), f.wood < 0],
    ['worker', w.free, `/${w.population}`, w.free === 0],
    ['fame', state.fame, '', false],
  ];
  $('#resources').innerHTML = res.map(([k, v, sub, bad]) => `<div class="res" data-res="${k}" aria-label="${RES_NAMES[k] || '空闲人口'} ${v} ${sub}" title="${k === 'food' ? `粮仓上限 ${R.foodCap(state)}` : ''}">${iconHtml(k)}<div><b>${v}</b>${sub ? `<small class="${bad ? 'neg' : ''}">${sub}</small>` : ''}</div></div>`).join('');
  paintIcons($('#resources'));
  renderAlerts(f);
}
function tributeProjection(f) {
  const left = 4 - season();
  return { due: R.tributeOf(state), projected: state.gold + f.gold * left, left };
}
function renderAlerts(f = R.forecast(state)) {
  const out = [];
  const tp = tributeProjection(f);
  const short = tp.projected < tp.due;
  out.push(`<div class="alert tribute ${season() === 3 && state.gold + f.gold < tp.due ? 'danger' : short ? 'warn' : ''}">${iconHtml('tribute')}年贡 ${tp.due} · ${tp.left === 1 ? '本季末' : `${tp.left}季后`}</div>`);
  if (state.threats.length) {
    const covered = R.guardMap(state), open = state.threats.filter(t => !covered.has(`${t.x},${t.y}`)).length;
    out.push(`<div class="alert threat ${open ? 'danger' : ''}">${iconHtml('threat')}蛮族 ${state.threats.length}处 · ${season() === 2 ? '本季末' : '秋末'}${open ? ` · ${open}处无守` : ' · 全守住'}</div>`);
  }
  if (f.famine) out.push(`<div class="alert famine danger">${iconHtml('food')}粮食不够，会饥荒</div>`);
  const broken = state.buildings.filter(b => b.damaged).length;
  if (broken) out.push(`<div class="alert warn">${broken}座建筑损毁，点击修复</div>`);
  $('#alerts').innerHTML = out.join('');
  paintIcons($('#alerts'));
}
function renderDock() {
  const basic = R.BASIC.map(type => cardHtml(type, 'basic')).join('');
  let hand = state.hand.map((type, i) => cardHtml(type, 'hand', i)).join('');
  for (let i = state.hand.length; i < R.HAND_LIMIT; i++) hand += '<div class="card slot"></div>';
  $('#cards').innerHTML = `<div class="col basic"><div class="col-h">常备</div>${basic}</div><div class="col hand"><div class="col-h">背包 ${state.hand.length}/${R.HAND_LIMIT}</div>${hand}</div>`;
  paintIcons($('#cards'));
  $('#cards').querySelectorAll('[data-type]').forEach(el => el.addEventListener('pointerdown', e => cardDown(e, { kind: 'build', type: el.dataset.type }, el)));
  const playing = state.status === 'playing';
  const land = $('#open-land'), draft = $('#open-draft'), next = $('#next-turn');
  land.disabled = !playing || state.landBought; draft.disabled = !playing || state.drafted;
  land.innerHTML = `${iconHtml('land')}<span>${state.landBought ? '已拿地' : '拿地'}</span>${state.landBought ? '' : '<i class="badge"></i>'}`;
  draft.innerHTML = `${iconHtml('card')}<span>${state.drafted ? '已选卡' : '选卡'}</span>${state.drafted ? '' : '<i class="badge"></i>'}`;
  next.disabled = !playing;
  next.innerHTML = season() === 3 ? `${iconHtml('tribute')}<span>交年贡</span><small>${R.tributeOf(state)}金</small>` : `${iconHtml('next')}<span>下一季</span>`;
  paintIcons($('#actions'));
}
// Whether a building fits anywhere on the kingdom in any rotation, ignoring cost. Cached per board.
let fitCache = { k: '', v: {} };
function fits(type) {
  const k = `${state.turn}|${state.nextId}|${state.buildings.length}|${state.tiles.length}|${state.hand.join()}`;
  if (fitCache.k !== k) fitCache = { k, v: {} };
  if (!(type in fitCache.v)) {
    let ok = false;
    for (let rot = 0; rot < 4 && !ok; rot++) for (const t of state.tiles) if (R.canBuild(state, type, t.x, t.y, rot, { fitOnly: true }).ok) { ok = true; break; }
    fitCache.v[type] = ok;
  }
  return fitCache.v[type];
}
/** Why a card can't be built right now, most fundamental first; null when it can. */
function blockReason(type) {
  const def = BUILDINGS[type], free = R.workers(state).free;
  if (!fits(type)) return { key: 'space', text: '没空地', long: `领土上放不下${def.name}，先拿地` };
  if (state.gold < def.gold) return { key: 'gold', text: `差${def.gold - state.gold}`, long: `金币不足，还差${def.gold - state.gold}` };
  if (state.wood < def.wood) return { key: 'wood', text: `差${def.wood - state.wood}`, long: `木材不足，还差${def.wood - state.wood}` };
  if (def.workers > free) return { key: 'worker', text: `缺${def.workers - free}人`, long: `空闲人口不足，还缺${def.workers - free}人，先建民居` };
  return null;
}
function cardHtml(type, kind, handIndex) {
  const def = BUILDINGS[type];
  const why = state.status === 'playing' ? blockReason(type) : null;
  const active = mode?.kind === 'build' && mode.type === type;
  return `<button class="card ${kind} ${why ? 'blocked' : ''} ${active ? 'active' : ''}" data-type="${type}" ${kind === 'hand' ? `data-hand="${handIndex}"` : ''} ${why ? `data-why="${why.key}"` : ''} aria-label="${def.name}，${costText(def)}，${def.workers ? `需${def.workers}人，` : ''}${why ? why.long + '，' : ''}拖到地图上建造，长按看图鉴">
    <canvas data-card="${type}" width="116" height="76"></canvas><span class="nm">${def.name}</span>${why ? `<span class="why">${iconHtml(why.key)}${why.text}</span>` : costChips(def)}</button>`;
}
function renderPlaceBar() {
  const bar = $('#place-bar');
  if (!mode) { bar.hidden = true; $('#actions').hidden = false; return; }
  bar.hidden = false; $('#actions').hidden = true;
  const g = ghostCache || ghost();
  let info = '';
  if (mode.kind === 'land') {
    const o = state.landOffers[mode.index];
    info = `<b>${esc(o.name)}</b><span class="muted">${o.cells.length}格 · 点虚影旋转</span>`;
  } else {
    const def = BUILDINGS[mode.type];
    info = `<b>${def.name}</b>${costChips(def)}`;
    const d = g?.preview?.delta;
    if (d) {
      const parts = [['gold', d.gold], ['food', d.food], ['wood', d.wood], ['fame', d.fame], ['pop', d.pop]].filter(([, v]) => v);
      info += `<div class="deltas"><span class="muted">每季</span>${parts.map(([k, v]) => `<span class="delta ${v < 0 ? 'neg' : ''}">${iconHtml(k)}${signed(v)}</span>`).join('')}${d.guard ? `<span class="delta">${iconHtml('guard')}${d.guard}格</span>` : ''}${!parts.length && !d.guard ? '<span class="muted">无产出</span>' : ''}</div>`;
    }
    info += fxHtml(mode.type, false, { base: false });
  }
  if (g && !g.check.ok) info += `<span class="bad">${esc(g.check.reason)}</span>`;
  $('#place-info').innerHTML = info;
  paintIcons($('#place-info'));
  $('#place-confirm').disabled = !g?.check.ok;
  $('#place-confirm').textContent = mode.kind === 'land' ? '拿下' : '建造';
}

// ---------- three-pick popups ----------
function openSheet(kind) {
  if (state.status !== 'playing') return;
  if (kind === 'land' && state.landBought) return;
  if (kind === 'draft' && state.drafted) return;
  sheet = kind; renderSheet();
}
function closeSheet(remember = true) {
  if (remember && sheet) dismissed[sheet] = state.turn;
  sheet = null; $('#sheet').hidden = true;
}
function renderSheet() {
  const el = $('#sheet'), box = el.querySelector('.pick');
  const open = !!sheet && !mode;
  if (!open) { el.hidden = true; return; }
  const wasHidden = el.hidden, newKind = box.dataset.kind !== sheet;
  el.hidden = false;
  if (wasHidden) { $('#banner').classList.remove('show'); box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); }
  if (sheet === 'land') {
    const cost = R.landRerollCost(state);
    box.dataset.kind = 'land';
    box.innerHTML = `<div class="pick-bar"><div class="pick-head">${iconHtml('land')}<h2>选一块地</h2><small>免费</small></div>
      <div class="pick-actions"><button class="act" id="sheet-reroll" ${state.gold < cost ? 'disabled' : ''}>换一批 <span class="costs"><span>${iconHtml('gold')}${cost}</span></span></button><button class="act" id="sheet-close">稍后</button></div></div>
      <div class="offers">${state.landOffers.map((o, i) => {
        const counts = {}; o.cells.forEach(c => counts[c.t] = (counts[c.t] || 0) + 1);
        const desc = Object.entries(counts).map(([t, n]) => `${TERRAIN[t].name}${n}`).join(' ');
        const treasure = o.cells.some(c => c.treasure);
        return `<button class="offer" data-land-i="${i}" aria-label="${esc(o.name)}，${desc}${treasure ? `，宝箱金${o.treasure}` : ''}">
          ${treasure ? `<span class="ribbon gold">${iconHtml('treasure')}+${o.treasure}</span>` : ''}
          <span class="art"><canvas data-land="${i}" width="264" height="180"></canvas></span><span class="body"><b>${esc(o.name)}</b>
          <span class="chips">${Object.entries(counts).map(([t, n]) => `<span class="terr"><canvas data-terrain="${t}" width="36" height="36"></canvas>${n}</span>`).join('')}</span></span></button>`;
      }).join('')}</div>`;
    box.querySelectorAll('[data-land-i]').forEach(b => b.addEventListener('pointerdown', e => cardDown(e, { kind: 'land', index: +b.dataset.landI }, b)));
    $('#sheet-reroll').onclick = () => { const r = R.rerollLand(state); if (!r.ok) return toast(r.reason); save(); renderAll(); };
    $('#sheet-close').onclick = () => closeSheet();
  } else {
    const cost = R.draftRerollCost(state), full = state.hand.length >= R.HAND_LIMIT;
    box.dataset.kind = 'draft';
    box.innerHTML = `<div class="pick-bar"><div class="pick-head">${iconHtml('card')}<h2>选一张建筑卡</h2><small>长按看图鉴</small></div>
      <div class="pick-actions"><button class="act" id="sheet-reroll" ${state.gold < cost ? 'disabled' : ''}>换一批 <span class="costs"><span>${iconHtml('gold')}${cost}</span></span></button><button class="act" id="sheet-skip">跳过</button><button class="act" id="sheet-close">稍后</button></div></div>
      ${full ? '<p class="hint">背包满了：先建掉或丢弃一张</p>' : ''}
      <div class="offers">${state.draft.map((type, i) => {
        const def = BUILDINGS[type];
        return `<button class="offer" data-draft-i="${i}" ${full ? 'disabled' : ''}>${def.unlock === year() && year() > 1 ? '<span class="ribbon">新</span>' : ''}
          <span class="art"><canvas data-card="${type}" width="264" height="180"></canvas></span><span class="body"><b>${def.name}</b>${costChips(def)}${fxHtml(type)}</span></button>`;
      }).join('')}</div>`;
    box.querySelectorAll('[data-draft-i]').forEach(b => {
      b.onclick = () => {
        if (b.dataset.longpressed) { delete b.dataset.longpressed; return; }
        const r = R.takeDraft(state, +b.dataset.draftI);
        if (!r.ok) return toast(r.reason);
        buzz(); save(); closeSheet(); toast(`${BUILDINGS[r.type].name}放进背包`); renderAll(); tutNotify('draft');
      };
      longPress(b, () => { b.dataset.longpressed = '1'; openCodex({ type: state.draft[+b.dataset.draftI] }); });
    });
    $('#sheet-reroll').onclick = () => { const r = R.rerollDraft(state); if (!r.ok) return toast(r.reason); save(); renderAll(); };
    $('#sheet-skip').onclick = () => { R.skipDraft(state); save(); closeSheet(); renderAll(); };
    $('#sheet-close').onclick = () => closeSheet();
  }
  paintIcons(box);
  if (wasHidden || newKind) revealTerritory();
}
// The pick tray docks at the bottom so the map stays live above it: pan just enough
// (zoom out only if needed) for the whole territory to sit in the visible strip.
function revealTerritory() {
  const box = territoryBox(), area = viewArea(), c = cp();
  if ((box.x1 - box.x0 + 1) * c > area.w || (box.y1 - box.y0 + 1) * c > area.h) return centerCamera(true);
  const x0 = box.x0 * c - cam.x, x1 = box.x1 * c - cam.x, y0 = box.y0 * c - cam.y, y1 = box.y1 * c - cam.y;
  if (x0 >= area.left + c && x1 <= area.left + area.w - c && y0 >= area.top + c && y1 <= area.top + area.h - c * 0.5) return;
  centerCamera(false);
}
function maybeAutoSheet() {
  if (state.status !== 'playing' || mode || busy || !$('#modal').hidden) return;
  if (!state.landBought && dismissed.land !== state.turn) openSheet('land');
  else if (!state.drafted && dismissed.draft !== state.turn) openSheet('draft');
}

// ---------- placement ----------
function shapeSize() {
  const cells = mode.kind === 'land' ? R.landCells(state, mode.index, 0, 0, mode.rot) : R.footprint(mode.type, 0, 0, mode.rot);
  return { w: Math.max(...cells.map(c => c.x)) + 1, h: Math.max(...cells.map(c => c.y)) + 1 };
}
function enterMode(spec, keepRot = true) {
  const same = mode && mode.kind === spec.kind && mode.type === spec.type && mode.index === spec.index;
  const rot = same && keepRot ? mode.rot : 0;
  mode = { ...spec, rot, ax: 0, ay: 0 };
  $('#sheet').hidden = true;
  renderDock();
}
function suggestSpot() {
  // Nearest legal anchor to the view centre; otherwise just centre the ghost.
  // Tries the current rotation first, then the others, so a piece that only fits turned still lands somewhere.
  const area = viewArea(), centre = toCell(area.cx, area.cy);
  let best = null;
  for (let k = 0; k < 4 && !best; k++) {
    const rot = (mode.rot + k) % 4;
    const cells = mode.kind === 'land' ? R.landCells(state, mode.index, 0, 0, rot) : R.footprint(mode.type, 0, 0, rot);
    const w = Math.max(...cells.map(c => c.x)) + 1, h = Math.max(...cells.map(c => c.y)) + 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ok = mode.kind === 'land' ? R.canPlaceLand(state, mode.index, x, y, rot).ok : R.canBuild(state, mode.type, x, y, rot, { fitOnly: true }).ok;
      if (!ok) continue;
      const d = Math.hypot(x + w / 2 - centre.x, y + h / 2 - centre.y);
      if (!best || d < best.d) best = { x, y, d, rot };
    }
  }
  if (best) { mode.ax = best.x; mode.ay = best.y; mode.rot = best.rot; }
  else {
    const { w, h } = shapeSize();
    mode.ax = centre.x - Math.floor(w / 2); mode.ay = centre.y - Math.floor(h / 2);
    toast(mode.kind === 'land' ? '这块地哪里都拼不上，换一块' : whyNoSpot(mode.type));
  }
  ensureVisible();
}
function whyNoSpot(type) { return blockReason(type)?.long || `领土上放不下${BUILDINGS[type].name}，先拿地`; }
function ensureVisible() {
  const { w, h } = shapeSize(), c = cp(), area = viewArea();
  const p = toScreen(mode.ax, mode.ay);
  const l = area.left + 12, r = vw - area.right - 12, t = area.top + 36, b = vh - 60;
  if (p.x < l) cam.x += p.x - l; else if (p.x + w * c > r) cam.x += p.x + w * c - r;
  if (p.y < t) cam.y += p.y - t; else if (p.y + h * c > b) cam.y += p.y + h * c - b;
  clampCam();
}
function cancelMode() { mode = null; drag = null; renderAll(); maybeAutoSheet(); }
function rotate() {
  if (!mode) return;
  const { w: w0, h: h0 } = shapeSize();
  mode.rot = (mode.rot + 1) % 4;
  const { w, h } = shapeSize();
  // Rotate around the visual centre so the piece stays under the finger.
  mode.ax += Math.round((w0 - w) / 2); mode.ay += Math.round((h0 - h) / 2);
  renderDock(); requestFrame();
}
function commit() {
  const g = currentGhost();
  if (!g?.check.ok) { if (g) toast(g.check.reason); return; }
  if (mode.kind === 'land') {
    const r = R.placeLand(state, mode.index, mode.ax, mode.ay, mode.rot);
    if (!r.ok) return toast(r.reason);
    dropIn({ kind: 'land', tiles: g.cells.map(q => ({ x: q.x, y: q.y, t: q.t })) });
    const cx = mode.ax + shapeSize().w / 2, cy = mode.ay + shapeSize().h / 2;
    if (r.treasure) addFloater(cx, cy - 0.6, [{ key: 'gold', v: r.treasure }], 200);
    mode = null; sheet = null; buzz('medium'); save(); invalidate(); renderAll(); tutNotify('land');
    if (r.regions.length) {
      for (const g2 of r.regions) addFloater(cx, cy - 1, [{ key: 'fame', v: g2.fame }, { key: 'gold', v: g2.gold }], 600);
      banner(`${r.regions.map(x => x.name).join('、')}成形！`, r.regions.map(x => `连成${x.size}格 · 声望+${x.fame} 金+${x.gold}`).join('；'));
    } else if (r.treasure) toast(`挖到宝箱，金+${r.treasure}`);
    setTimeout(maybeAutoSheet, reduceMotion() ? 0 : 700);
  } else {
    const type = mode.type, d = g.preview?.delta;
    const r = R.build(state, type, mode.ax, mode.ay, mode.rot);
    if (!r.ok) return toast(r.reason);
    const nb = state.buildings[state.buildings.length - 1];
    dropIn({ kind: 'build', id: nb.id, type, rot: nb.rot, cells: R.buildingCells(nb) });
    const { w, h } = shapeSize(), cx = mode.ax + w / 2, cy = mode.ay + h / 2;
    addFloater(cx, cy, [{ key: 'gold', v: -BUILDINGS[type].gold }, { key: 'wood', v: -BUILDINGS[type].wood }]);
    if (d) addFloater(cx, cy - 0.5, [{ key: 'gold', v: d.gold }, { key: 'food', v: d.food }, { key: 'wood', v: d.wood }, { key: 'fame', v: d.fame }, { key: 'pop', v: d.pop }].map(p => ({ ...p })), 450);
    mode = null; buzz('medium'); save(); invalidate(); renderAll(); tutNotify('build');
    toast(`${BUILDINGS[type].name}建成`, 1400);
  }
}
$('#place-rotate').onclick = rotate;
$('#place-cancel').onclick = cancelMode;
$('#place-confirm').onclick = commit;

// ---------- pointer input ----------
function cardDown(e, spec, el) {
  if (state.status !== 'playing' || busy) return;
  if (el.dataset.why === 'space' && el.dataset.hand === undefined) {
    e.preventDefault(); clearTimeout(press?.timer);
    press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, spec, el, noRoom: true };
    press.timer = setTimeout(() => { if (press?.el === el) { press = null; buzz(); openCodex({ type: spec.type }); } }, 480);
    return;
  }
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  lastPointerType = e.pointerType;
  clearTimeout(press?.timer);
  press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, spec, el };
  el.classList.add('pressing');
  // Hold still on a building card to open its codex entry.
  if (spec.kind === 'build') press.timer = setTimeout(() => {
    if (!press || press.el !== el) return;
    el.classList.remove('pressing'); press = null; buzz();
    openCodex({ type: spec.type });
  }, 480);
}
function releasePress() { if (press) { clearTimeout(press.timer); press.el.classList.remove('pressing'); } press = null; }
// Generic long-press for plain buttons (draft offers); fires cb and lets the caller swallow the click.
function longPress(el, cb) {
  let t = 0, x0 = 0, y0 = 0;
  el.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; clearTimeout(t); t = setTimeout(() => { buzz(); cb(); }, 480); });
  el.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 9) clearTimeout(t); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => clearTimeout(t));
}
function startDrag(spec, e, source) {
  if (source === 'card') { enterMode(spec); buzz(); }
  const lift = e.pointerType === 'mouse' ? 0 : cp() * 1.1;
  drag = { id: e.pointerId, source, lift, sx: e.clientX, sy: e.clientY, x0: e.clientX, y0: e.clientY, moved: false, grabX: 0, grabY: 0 };
  if (source === 'ghost') {
    const cell = toCell(e.clientX, e.clientY);
    drag.grabX = cell.x - mode.ax; drag.grabY = cell.y - mode.ay; drag.lift = 0;
  }
  updateDrag(e.clientX, e.clientY);
}
function updateDrag(sx, sy) {
  drag.sx = sx; drag.sy = sy;
  if (Math.hypot(sx - drag.x0, sy - drag.y0) > 8) drag.moved = true;
  if (drag.source === 'ghost') {
    if (!drag.moved) return;
    const cell = toCell(sx, sy);
    mode.ax = cell.x - drag.grabX; mode.ay = cell.y - drag.grabY;
  } else {
    const { w, h } = shapeSize(), c = cp();
    mode.ax = Math.round((sx + cam.x) / c - w / 2);
    mode.ay = Math.round((sy - drag.lift + cam.y) / c - h / 2);
  }
  requestFrame();
}
// Dropping a card back onto either rail cancels it.
function overRail(sx) { const a = viewArea(); return sx < a.left - 4 || sx > vw - a.right + 4; }
function endDrag(e) {
  const d = drag; drag = null;
  if (d.source === 'card' && overRail(e.clientX)) { cancelMode(); return; }
  if (d.source === 'ghost' && !d.moved) { rotate(); return; }
  const g = currentGhost();
  if (g?.check.ok && d.source === 'card') commit();
  else { renderAll(); requestFrame(); }
}
window.addEventListener('pointermove', e => {
  if (press && e.pointerId === press.id && !drag) {
    if (Math.hypot(e.clientX - press.x0, e.clientY - press.y0) > 9) { const p = press; releasePress(); if (p.noRoom) { toast(whyNoSpot(p.spec.type)); return; } startDrag(p.spec, e, 'card'); }
    return;
  }
  if (drag && e.pointerId === drag.id) { updateDrag(e.clientX, e.clientY); return; }
});
window.addEventListener('pointerup', e => {
  if (press && e.pointerId === press.id) { const p = press; releasePress(); tapCard(p.spec, p.el); return; }
  if (drag && e.pointerId === drag.id) endDrag(e);
});
window.addEventListener('pointercancel', e => {
  if (press && e.pointerId === press.id) releasePress();
  if (drag && e.pointerId === drag.id) { drag = null; requestFrame(); renderAll(); }
});
function tapCard(spec, el) {
  if (el?.dataset.why === 'space' && el.dataset.hand === undefined) { toast(whyNoSpot(spec.type)); buzz(); return; }
  if (spec.kind === 'build' && el?.dataset.hand !== undefined && mode?.kind === 'build' && mode.type === spec.type) {
    // Second tap on a selected backpack card offers to discard it.
    handMenu(+el.dataset.hand); return;
  }
  enterMode(spec); suggestSpot(); renderAll(); requestFrame();
}
async function handMenu(i) {
  const type = state.hand[i], def = BUILDINGS[type];
  const v = await modal(`<div class="insp"><canvas class="big-preview" data-card="${type}" width="240" height="160"></canvas><div><h2>${def.name}</h2>${costChips(def, 'big')}${fxHtml(type, true)}</div></div>`,
    [{ label: '去建造', value: 'build', primary: true }, { label: '图鉴', value: 'codex' }, { label: '丢弃 +3金', value: 'discard' }, { label: '关闭', value: null }]);
  if (v === 'codex') { cancelMode(); openCodex({ type }); }
  else if (v === 'discard') { mode = null; R.discard(state, i); save(); renderAll(); maybeAutoSheet(); }
  else if (v === null) cancelMode();
}

canvas.addEventListener('pointerdown', e => {
  if (busy) return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  lastPointerType = e.pointerType;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z };
    pan = null; if (drag?.source === 'ghost') drag = null;
    return;
  }
  if (mode) {
    const cell = toCell(e.clientX, e.clientY), g = currentGhost();
    const hit = g?.cells.some(c => Math.abs(c.x - cell.x) <= (e.pointerType === 'mouse' ? 0 : 1) && Math.abs(c.y - cell.y) <= (e.pointerType === 'mouse' ? 0 : 1));
    if (hit) { startDrag(null, e, 'ghost'); return; }
  }
  pan = { id: e.pointerId, x0: e.clientX, y0: e.clientY, cx: cam.x, cy: cam.y, moved: false };
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    zoomAt((pinch.z * d / pinch.d) / cam.z, (a.x + b.x) / 2, (a.y + b.y) / 2); return;
  }
  if (pan && e.pointerId === pan.id) {
    const dx = e.clientX - pan.x0, dy = e.clientY - pan.y0;
    if (Math.hypot(dx, dy) > 7) pan.moved = true;
    if (pan.moved) { cam.x = pan.cx - dx; cam.y = pan.cy - dy; clampCam(); requestFrame(); }
  }
});
function pointerEnd(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pan && e.pointerId === pan.id) {
    const p = pan; pan = null;
    if (!p.moved && e.type === 'pointerup') tapMap(e.clientX, e.clientY);
  }
}
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });

function tapMap(sx, sy) {
  const cell = toCell(sx, sy);
  if (mode) {
    const { w, h } = shapeSize();
    mode.ax = cell.x - Math.floor(w / 2); mode.ay = cell.y - Math.floor(h / 2);
    requestFrame(); return;
  }
  const b = R.buildingAt(state, cell.x, cell.y);
  if (b) { inspect(b); return; }
  const tile = R.tileAt(state, cell.x, cell.y);
  const threat = state.threats.some(t => t.x === cell.x && t.y === cell.y);
  if (tile) toast(`${TERRAIN[tile.t].name}${threat ? ' · 蛮族目标！在2格内建哨塔可守住' : ''}`);
  else if (R.isIsland(state, cell.x, cell.y)) toast('未开拓的土地：拿地拼到这里');
}

// ---------- inspector ----------
function describeOutput(p) {
  if (!p) return '';
  if (p.damaged) return '<p class="muted">已损毁，不产出也不提供人口。</p>';
  if (p.idle) return '<p class="muted">人手不足，停工中。建民居增加人口。</p>';
  const parts = [['gold', p.gold], ['food', p.food], ['wood', p.wood], ['fame', p.fame]].filter(([, v]) => v);
  return parts.length ? `<div class="fx-now"><span class="fx-tag">本季</span>${parts.map(([k, v]) => fxVal(k, signed(v))).join('')}</div>` : '';
}
async function inspect(b) {
  const def = BUILDINGS[b.type], f = R.forecast(state), p = f.per.find(x => x.id === b.id);
  const up = R.upgradeCost(b), playing = state.status === 'playing';
  const buttons = [];
  if (b.damaged) buttons.push({ label: `修复 ${R.repairCost(b)}金`, value: 'repair', primary: true, disabled: !playing || state.gold < R.repairCost(b) });
  else if (up) buttons.push({ label: `升${b.level + 1}级 ${fxVal('gold', up.gold)}${up.wood ? fxVal('wood', up.wood) : ''}`, value: 'upgrade', primary: true, disabled: !playing || state.gold < up.gold || state.wood < up.wood });
  if (b.type !== 'hall') buttons.push({ label: '拆除', value: 'demolish', disabled: !playing });
  buttons.push({ label: '图鉴', value: 'codex' }, { label: '关闭', value: null });
  const v = await modal(`<div class="insp"><canvas class="big-preview" data-card="${b.type}" data-rot="${b.rot}" width="240" height="160"></canvas>
    <div><h2>${def.name} <small class="muted">${b.type === 'hall' ? '' : `${b.level}级`}</small></h2>${describeOutput(p)}${fxHtml(b.type, true)}${up && !b.damaged ? '<p class="muted">升级：产出×1.5，3级×2</p>' : ''}</div></div>`, buttons, { cls: 'insp-m' });
  if (v === 'codex') openCodex({ type: b.type });
  if (v === 'upgrade') act(R.upgrade(state, b.id), `${def.name}升到${b.level}级`);
  if (v === 'repair') act(R.repair(state, b.id), `${def.name}已修复`);
  if (v === 'demolish') {
    const sure = await modal(`<h2>拆除${def.name}？</h2><p>${b.damaged ? '损毁建筑拆除不退款。' : `回收${Math.floor(def.gold * 0.4)}金，背包卡不返还。`}</p>`, [{ label: '拆除', value: true, danger: true }, { label: '取消', value: false }]);
    if (sure) act(R.demolish(state, b.id), `已拆除${def.name}`);
  }
}
function act(r, ok) { if (!r.ok) { toast(r.reason); return false; } save(); invalidate(); renderAll(); if (ok) toast(ok); return true; }

// ---------- season flow ----------
async function nextSeason() {
  if (busy || state.status !== 'playing') return;
  if (mode) cancelMode();
  closeSheet(false);
  const f = R.forecast(state), due = R.tributeOf(state);
  if (season() === 3 && state.gold + f.gold < due) {
    const go = await modal(`<h2>${iconHtml('tribute', 'inline')}年贡不够</h2><p>结算后预计有 <b>${state.gold + f.gold}</b> 金，年贡要 <b>${due}</b> 金。交不上王国就会陷落。</p><p class="muted">还可以拆除建筑回收金币，或先别花钱。</p>`,
      [{ label: '再想想', value: false, primary: true }, { label: '仍然结算', value: true, danger: true }]);
    if (!go) return;
  }
  if (season() === 2 && state.threats.length) {
    const covered = R.guardMap(state), open = state.threats.filter(t => !covered.has(`${t.x},${t.y}`)).length;
    if (open) {
      const go = await modal(`<h2>${iconHtml('threat', 'inline')}还有${open}处边境无人守</h2><p>本季末蛮族来袭。无人守卫的格子每处被抢 ${R.plunderOf(state)} 金，上面的建筑会损毁。</p><p class="muted">哨塔守周围2格，王城守2格。打开「盾」看守卫范围。</p>`,
        [{ label: '去布防', value: false, primary: true }, { label: '仍然结算', value: true }]);
      if (!go) { guardView = true; $('#guard-view').setAttribute('aria-pressed', 'true'); requestFrame(); return; }
    }
  }
  busy = true; tutNotify('turn');
  const r = R.nextTurn(state);
  save();
  const rep = r.report;
  // Floating yields over every producing building.
  for (const p of rep.economy.per) {
    const b = state.buildings.find(x => x.id === p.id);
    if (!b) continue;
    const cells = R.buildingCells(b), cx = cells.reduce((s, c) => s + c.x, 0) / cells.length + 0.5, cy = Math.min(...cells.map(c => c.y)) + 0.3;
    addFloater(cx, cy, [{ key: 'gold', v: p.gold }, { key: 'food', v: p.food }, { key: 'wood', v: p.wood }, { key: 'fame', v: p.fame }]);
  }
  const hall = state.buildings.find(b => b.type === 'hall');
  if (rep.economy.tax) addFloater(hall.x + 1, hall.y - 0.2, [{ key: 'gold', v: rep.economy.tax }], 300);
  invalidate(); renderAll();
  await wait(rep.economy.per.length ? 900 : 300);
  if (rep.economy.famine) toast('饥荒！税收减半，声望−1。多建农田或渔港。', 3400);
  if (rep.raid) { buzz('heavy'); await raidReport(rep.raid); }
  if (rep.tribute?.paid) {
    await modal(`<h2>${iconHtml('tribute', 'inline')}第${rep.year}年年贡已缴</h2><p>上缴 <b>${rep.tribute.due}</b> 金，声望+2。</p>${state.status === 'playing' ? `<p class="muted">下一年年贡：${R.tributeOf(state)} 金。${unlockText()}</p>` : ''}`);
  }
  busy = false;
  if (state.status !== 'playing') { await endScreen(); return; }
  banner(`第${year()}年 · ${R.SEASONS[season()].name}`, R.SEASONS[season()].tip);
  if (rep.threats) {
    await wait(700);
    toast(`斥候：蛮族盯上${rep.threats}处边境（红旗），秋末来袭`, 3600);
    guardView = true; $('#guard-view').setAttribute('aria-pressed', 'true');
  }
  renderAll(); requestFrame();
  setTimeout(() => { if (!contextTips()) maybeAutoSheet(); }, 500);
}
function unlockText() {
  const fresh = Object.entries(BUILDINGS).filter(([, d]) => d.unlock === year()).map(([, d]) => d.name);
  return fresh.length ? `新建筑卡：${fresh.join('、')}。` : '';
}
async function raidReport(raid) {
  const held = raid.filter(r => r.defended), lost = raid.filter(r => !r.defended);
  for (const r of raid) addFloater(r.x + 0.5, r.y + 0.3, r.defended ? [{ key: 'fame', v: r.fame }] : [{ key: 'gold', v: -r.loss }]);
  invalidate(); requestFrame();
  await wait(600);
  await modal(`<h2>${iconHtml('threat', 'inline')}蛮族来袭</h2>
    <ul class="list">${held.length ? `<li class="good"><span>守住</span><b>${held.length}处 · 声望+${held.reduce((s, r) => s + r.fame, 0)}</b></li>` : ''}
    ${lost.length ? `<li class="bad"><span>失守</span><b>${lost.length}处 · 金−${lost.reduce((s, r) => s + r.loss, 0)}</b></li>` : ''}
    ${lost.filter(r => r.damaged).map(r => `<li class="bad"><span>${BUILDINGS[state.buildings.find(b => b.id === r.damaged)?.type]?.name || '建筑'}损毁</span><b>点击修复</b></li>`).join('')}</ul>
    <p class="muted">边境越长，下一年蛮族目标越多。</p>`);
}
const wait = ms => new Promise(r => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? Math.min(ms, 150) : ms));

// ---------- screens ----------
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function newRun(daily, tutorial = false) {
  const seed = daily ? `daily-${today()}` : tutorial ? TUT_SEED : Math.floor(Math.random() * 4294967295);
  state = R.createGame(seed, daily ? `daily:${today()}` : 'free'); liveRun = true;
  const r = replaceSave(store, state);
  saveBlocked = !r.ok;
  if (!r.ok) toast('未能保存：' + r.reason);
  mode = null; sheet = null; floaters = []; dismissed.land = dismissed.draft = 0; guardView = false;
  $('#guard-view').setAttribute('aria-pressed', 'false');
  invalidate(); centerCamera(); renderAll();
  stopTutorial();
  if (tutorial) { startTutorial(); return; }
  banner('第1年 · 春', '拼地、建城，熬过六年年贡');
  setTimeout(maybeAutoSheet, 700);
}
async function titleScreen() {
  const daily = records.daily[today()];
  const canContinue = liveRun && state && state.status === 'playing';
  const v = await modal(`<div class="title-card"><h1>拼土王国</h1><p class="tag">拼地块 · 摆建筑 · 撑过六年年贡</p>
    <div class="stat-grid"><div class="stat"><b>${records.best}</b>最高分</div><div class="stat"><b>${records.wins}/${records.runs}</b>胜/局</div><div class="stat"><b>${daily ?? '—'}</b>今日挑战</div></div></div>`,
    [...(canContinue ? [{ label: '继续这一局', value: 'continue', primary: true }] : []),
      { label: '新王国', value: 'new', primary: !canContinue }, { label: '今日挑战', value: 'daily' }, { label: '教学', value: 'tutorial' }, { label: '图鉴', value: 'codex' }],
    { dismissable: false, cls: 'title' });
  if (v === 'codex') { await openCodex({ tab: 'rules' }); return titleScreen(); }
  if (v === 'tutorial') {
    if (canContinue && !await modal('<h2>开始教学？</h2><p class="muted">当前这一局会被教学局覆盖。</p>', [{ label: '开始教学', value: true, primary: true }, { label: '返回', value: false }])) return titleScreen();
    newRun(false, true); return;
  }
  if (v === 'new' || v === 'daily') {
    if (canContinue) {
      const sure = await modal('<h2>放弃当前这一局？</h2><p class="muted">当前进度会被新王国覆盖。</p>', [{ label: '开始新局', value: true, danger: true }, { label: '返回', value: false }]);
      if (!sure) return titleScreen();
    }
    // The very first new kingdom (not the daily) runs the tutorial.
    newRun(v === 'daily', v === 'new' && !tutorialDone());
  } else { renderAll(); maybeAutoSheet(); }
}
async function endScreen() {
  const sc = R.score(state), won = state.status === 'won';
  if (!state.recorded) {
    records.runs++; if (won) records.wins++;
    records.best = Math.max(records.best, sc.total);
    if (state.mode.startsWith('daily:')) { const k = state.mode.slice(6); records.daily[k] = Math.max(records.daily[k] || 0, sc.total); }
    writeRecords(store, records);
    state.recorded = true; save();
  }
  const v = await modal(`<h2>${won ? '王国屹立' : '王国陷落'}</h2><p class="muted">${esc(state.endReason)}</p>
    ${won ? `<div class="stars">${[1, 2, 3].map(i => `<span class="${i <= sc.stars ? '' : 'off'}">★</span>`).join('')}</div>` : ''}
    <div class="score-total">${sc.total}</div>
    <ul class="list">${sc.parts.map(p => `<li><span>${p.label}</span><b>${p.value}</b></li>`).join('')}</ul>
    <div class="stat-grid"><div class="stat"><b>${state.tiles.length}</b>领土格</div><div class="stat"><b>${state.buildings.length}</b>建筑</div><div class="stat"><b>${state.stats.defended}</b>守住进攻</div><div class="stat"><b>${records.best}</b>最高分</div></div>`,
    [{ label: '再来一局', value: 'new', primary: true }, { label: '今日挑战', value: 'daily' }, { label: '看看王国', value: null }], { dismissable: false });
  if (v === 'new' || v === 'daily') newRun(v === 'daily');
  else renderAll();
}
async function overview() {
  const f = R.forecast(state), w = R.workers(state);
  const regions = R.regionProgress(state);
  await modal(`<h2>第${year()}年 · ${R.SEASONS[season()].name}</h2><p class="muted">${esc(R.SEASONS[season()].tip)}</p>
    <div class="stat-grid"><div class="stat"><b>${signed(f.gold)}</b>每季金（税${f.tax}）</div><div class="stat"><b>${signed(f.produced)}/−${f.eat}</b>产粮/吃粮</div><div class="stat"><b>${w.used}/${w.population}</b>在岗/人口</div><div class="stat"><b>${R.borderCells(state).length}</b>边境格</div></div>
    <h3>年贡</h3><p>${R.TRIBUTE.map((t, i) => i + 1 === year() ? `<b>${t}</b>` : i + 1 < year() ? `<s>${t}</s>` : t).join(' → ')}</p>
    <h3>地形连片</h3>${regions.map(r => `<div class="region-row">${iconHtml('year', 'inline')}<span style="width:44px">${r.name}</span><div class="bar"><i style="width:${Math.min(100, r.next ? r.size / r.next * 100 : 100)}%"></i></div><span>${r.next ? `${r.size}/${r.next}` : '已满'}</span></div>`).join('')}
    <h3>最近</h3><ul class="list">${state.log.slice(-5).reverse().map(l => `<li>${esc(l)}</li>`).join('')}</ul>`, [{ label: '返回', value: null, primary: true }]);
}
async function menu() {
  const v = await modal('<h2>菜单</h2>', [{ label: '王国概况', value: 'overview' }, { label: '图鉴', value: 'codex' }, { label: '重玩教学', value: 'tutorial' }, { label: '回到标题', value: 'title' }, { label: '继续', value: null, primary: true }], { cls: 'title' });
  if (v === 'overview') overview();
  if (v === 'codex') openCodex();
  if (v === 'tutorial') {
    const sure = await modal('<h2>重玩教学？</h2><p class="muted">会开一局新的教学局，当前进度被覆盖。</p>', [{ label: '开始教学', value: true, primary: true }, { label: '返回', value: false }]);
    if (sure) newRun(false, true);
  }
  if (v === 'title') { stopTutorial(); titleScreen(); }
}

// ---------- codex ----------
const TERRAIN_NOTE = {
  grass: '大多数建筑都能建。', fertile: '农田每格粮+3（草地+2）。', forest: '伐木场旁的森林每块木+1。',
  water: '渔港必须占1格水域；邻水的农田、庄园有加成。', mountain: '矿场必须占山地；挨着山地的工坊更好。',
};
const RULES = () => [
  ['tribute', '年贡', `每年冬末交年贡：${R.TRIBUTE.join('→')}金。交不上王国陷落；撑满${R.YEARS}年获胜。`],
  ['year', '四季', R.SEASONS.map(x => `${x.name}：${x.tip}`).join('<br>')],
  ['land', '拿地', '每季可免费拿1块地，拖到领土边上拼接，点虚影旋转。地形决定能建什么；宝箱地块拼上就给金币。'],
  ['pop', '人口与粮', '民居、庄园提供人口；生产建筑要占人手，人手不够会停工。每2人每季吃1粮，粮不够就饥荒：税收减半、声望−1。'],
  ['threat', '蛮族', '第2年起，夏季在边境插红旗，秋末来袭。王城、哨塔、兵营守卫范围内的格子能守住并得声望；失守被抢金币、建筑损毁。'],
  ['guard', '守卫', '王城守2格，哨塔守2格（3级3格），兵营守3格。点地图右下的盾牌可看全部范围。'],
  ['yield', '产出', '每座建筑头上是它每季的产出。摆放时，亮起的格子是能放的位置，格子上的小数字是这块地带来的产出。'],
  ['fame', '连片', `同种地形连成6/10/15格时获得声望与金币：${Object.values(R.REGION).join('、')}。`],
  ['wood', '升级与拆除', '点地图上的建筑可升级（产出×1.5，3级×2）、修复或拆除（回收40%金）。'],
  ['food', '背包', `每季可选1张特殊建筑卡，背包最多${R.HAND_LIMIT}张；常备建筑随时可建。背包卡可丢弃换3金。`],
];
function codexDetail(type) {
  const d = BUILDINGS[type], locked = state && d.unlock > year() && type !== 'hall';
  const terr = d.terrains.map(t => `<span class="terr"><canvas data-terrain="${t}" width="36" height="36"></canvas></span>`).join('');
  return `<h3>${d.name}<small>${type === 'hall' ? '开局自带' : d.basic ? '常备 · 随时可建' : `建筑卡 · 第${d.unlock}年起`}</small></h3>
    <canvas class="big-preview" data-card="${type}" width="300" height="200"></canvas>
    ${fxHtml(type, true)}
    <div class="facts">${type === 'hall' ? '' : costChips(d, 'big')}<span class="fact">${d.cells.length}格</span><span class="terr-row">${terr}</span></div>
    <p class="rule muted">${esc(d.text)}</p>${locked ? '<p class="muted">还没解锁，到那一年的选卡里会出现。</p>' : ''}`;
}
function paintTerrains(root) {
  root.querySelectorAll('canvas[data-terrain]').forEach(c => { const g = c.getContext('2d'); A.drawTerrain(g, c.dataset.terrain, 0, 0, c.width, 5); });
}
function openCodex({ tab = 'build', type } = {}) {
  let cur = type || (mode?.kind === 'build' ? mode.type : 'house');
  let curTab = type ? 'build' : tab;
  const order = Object.keys(BUILDINGS).sort((a, b) => (BUILDINGS[a].basic ? 0 : 1) - (BUILDINGS[b].basic ? 0 : 1) || BUILDINGS[a].unlock - BUILDINGS[b].unlock);
  order.unshift(...order.splice(order.indexOf('hall'), 1));
  const render = body => {
    const content = curTab === 'build'
      ? `<div class="codex-body"><div class="codex-grid" role="listbox">${order.map(t => {
          const d = BUILDINGS[t], locked = state && d.unlock > year() && t !== 'hall';
          return `<button class="cx ${locked ? 'locked' : ''}" data-cx="${t}" aria-selected="${t === cur}"><canvas data-card="${t}" width="116" height="76"></canvas><span>${d.name}</span>${d.basic ? '<i class="tag">常备</i>' : t !== 'hall' && d.unlock > 1 ? `<i class="tag">${d.unlock}年</i>` : ''}</button>`;
        }).join('')}</div><div class="codex-detail">${codexDetail(cur)}</div></div>`
      : curTab === 'terrain'
        ? `<div class="codex-rules">${Object.keys(TERRAIN).map(t => `<div class="rule-card"><canvas data-terrain="${t}" width="80" height="80"></canvas><div><b>${TERRAIN[t].name}</b>${TERRAIN_NOTE[t]}<br><span class="muted">可建：${order.filter(k => k !== 'hall' && BUILDINGS[k].terrains.includes(t)).map(k => BUILDINGS[k].name).join('、')}</span></div></div>`).join('')}</div>`
        : `<div class="codex-rules">${RULES().map(([ic, h, t]) => `<div class="rule-card">${iconHtml(ic)}<div><b>${h}</b>${t}</div></div>`).join('')}</div>`;
    body.innerHTML = `<div class="codex-head"><h2>图鉴</h2><div class="tabs" role="tablist">${[['build', '建筑'], ['terrain', '地形'], ['rules', '规则']].map(([k, l]) => `<button class="tab" data-tab="${k}" role="tab" aria-selected="${k === curTab}">${l}</button>`).join('')}</div><button class="act primary codex-close">关闭</button></div>${content}<div class="modal-actions"></div>`;
    paintIcons(body); paintTerrains(body);
    body.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { curTab = b.dataset.tab; render(body); });
    body.querySelectorAll('[data-cx]').forEach(b => b.onclick = () => {
      cur = b.dataset.cx;
      body.querySelectorAll('[data-cx]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      const det = body.querySelector('.codex-detail'); det.innerHTML = codexDetail(cur); det.scrollTop = 0; paintIcons(det); paintTerrains(det);
    });
    body.querySelector('.codex-close').onclick = () => closeModal(null);
    body.querySelector('[aria-selected="true"][data-cx]')?.scrollIntoView({ block: 'nearest' });
  };
  tutNotify('codex');
  return modal('', [], { cls: 'codex', onOpen: render });
}

// ---------- tutorial & one-time tips ----------
let tut = null;
const tutorialDone = () => { try { return store.getItem(TUT_FLAG) === '1'; } catch { return true; } };
const idle = () => !busy && $('#modal').hidden && !!state && state.status === 'playing';
const terrRect = () => {
  const b = territoryBox(), a = toScreen(b.x0, b.y0), z = toScreen(b.x1, b.y1), m = mapRect();
  const x = Math.max(a.x, m.x), y = Math.max(a.y, m.y);
  return { x, y, w: Math.min(z.x, m.x + m.w) - x, h: Math.min(z.y, m.y + m.h) - y };
};
/** Ghost footprint plus a one-cell ring (the neighbour highlights). */
const ghostRect = () => {
  if (!mode) return null;
  const { w, h } = shapeSize(), c = cp(), p = toScreen(mode.ax - 1, mode.ay - 1);
  return { x: p.x, y: p.y, w: (w + 2) * c, h: (h + 2) * c };
};
const TUT_AVOID = ['#dock', '#side', '#hud', '#map-tools'];
function tutNotify(ev) { tut?.notify(ev); }
function stopTutorial() { if (tut) { const t = tut; tut = null; t.opts.onDone = null; t.finish(true); } }
function startTutorial() {
  const steps = [
    { at: ['#alerts .tribute', '#season'], until: 'tap', text: '目标：每年<b>冬末交年贡</b>，撑过6年就赢。<br>这里是季节和今年的年贡。' },
    { at: ['#resources'], until: 'tap', text: '金、粮、木、空闲人口、声望。<br>小字是<b>每季变化</b>，红色说明在亏。' },
    { at: [terrRect], until: 'tap', text: '这是你的领土。<b>拖动</b>平移地图，<b>双指</b>缩放；点建筑可以升级、拆除。' },
    { skip: () => sheet === 'land' || state.landBought, at: ['#open-land'], until: () => sheet === 'land', text: '先扩张：点<b>拿地</b>。' },
    { gate: () => sheet === 'land', at: ['#sheet .offers'], until: () => mode?.kind === 'land' || state.landBought,
      text: '每季可<b>免费</b>拿1块地。<b>点一块</b>，或按住拖到地图上。' },
    { gate: () => mode?.kind === 'land', at: ['#place-bar'], allow: [mapRect], avoid: [ghostRect], until: () => state.landBought,
      text: '<b>亮起的地方</b>能放。拖虚影换位置，<b>点虚影旋转</b>，再点<b>拿下</b>。' },
    { skip: () => sheet === 'draft' || state.drafted, gate: () => state.landBought && !mode, at: ['#open-draft'], until: () => sheet === 'draft', text: '再点<b>选卡</b>。' },
    { gate: () => sheet === 'draft', at: ['#sheet .offers'], until: () => state.drafted, text: '每季可选1张<b>特殊建筑卡</b>放进背包。<b>点一张</b>拿走；长按看规则。' },
    { gate: () => state.drafted && !mode && !sheet, at: ['#dock'], until: () => mode?.kind === 'build',
      text: '左边是建筑：<b>常备</b>随时可建，<b>背包</b>是选来的卡。<br><b>按住拖到地图上</b>，或点一下。长按看图鉴。' },
    { gate: () => mode?.kind === 'build', at: ['#place-bar'], allow: [mapRect, '#dock'], avoid: [ghostRect], until: 'build',
      text: '亮起的格子能放；格子上的<b>小数字</b>是这块地带来的产出，头顶是<b>每季合计</b>。<br>位置合适就点<b>建造</b>。' },
    { gate: () => !mode && !sheet, at: ['#next-turn'], until: 'turn', text: '这一季做完了。点<b>下一季</b>：结算产出、吃粮，冬末交年贡。' },
    { at: ['#codex'], until: 'codex', text: '每座建筑的规则、地形和玩法都在<b>图鉴</b>里，随时点开查。' },
    { until: 'tap', ok: '开始', text: '教学完成！<br>第2年起夏天会有<b>蛮族</b>在边境插红旗、秋末来袭——用哨塔守住。祝王国长久。' },
  ];
  tut = new Spotlight($('#tut'), steps, {
    idle, skippable: true, avoid: TUT_AVOID,
    onDone: () => { try { store.setItem(TUT_FLAG, '1'); } catch {} tut = null; maybeAutoSheet(); },
  });
}
function readTips() { try { return JSON.parse(store.getItem(TIPS_KEY) || '{}') || {}; } catch { return {}; } }
/** One-time contextual tips; returns true when one is showing. */
function contextTips() {
  if (tut || !state || state.status !== 'playing') return false;
  const seen = readTips(), f = R.forecast(state);
  const tips = [
    ['threat', state.threats.length > 0, ['#alerts .threat', '#guard-view'], '<b>红旗</b>是蛮族目标，<b>秋末</b>来袭。<br>王城、哨塔、兵营守卫范围内能守住。点<b>盾</b>看范围。'],
    ['winter', season() === 3, ['#alerts .tribute', '#next-turn'], '冬天了：本季末结算时<b>交年贡</b>。<br>金币不够王国就会陷落，可以拆建筑回收金币。'],
    ['famine', f.famine, ['[data-res="food"]'], '粮食不够了，会<b>饥荒</b>：税收减半、声望−1。<br>多建农田、渔港或粮仓。'],
    ['unlock', year() > 1 && season() === 0, ['#open-draft'], () => `第${year()}年解锁新建筑卡，这一季的<b>选卡</b>里一定有。`],
  ];
  const t = tips.find(([k, on]) => on && !seen[k]);
  if (!t) return false;
  const [k, , at, text] = t;
  seen[k] = 1; try { store.setItem(TIPS_KEY, JSON.stringify(seen)); } catch {}
  tut = new Spotlight($('#tut'), [{ at, until: 'tap', ok: '知道了', text }], { idle, label: false, avoid: TUT_AVOID, onDone: () => { tut = null; maybeAutoSheet(); } });
  return true;
}

// ---------- app shell: haptics, orientation, gestures ----------
function buzz(kind = 'light') {
  try { if (window.tap?.vibrateShort) { window.tap.vibrateShort({ type: kind }); return; } } catch {}
  try { navigator.vibrate?.(kind === 'heavy' ? 30 : kind === 'medium' ? 16 : 8); } catch {}
}
function lockLandscape() { try { screen.orientation?.lock?.('landscape')?.catch?.(() => {}); } catch {} }
window.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('selectstart', e => e.preventDefault());
window.addEventListener('pointerdown', lockLandscape, { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && liveRun) save(); });
window.addEventListener('pagehide', () => { if (liveRun) save(); });

// ---------- wiring ----------
function renderAll() { renderHud(); renderDock(); renderSheet(); renderPlaceBar(); requestFrame(); }
$('#open-land').onclick = () => { if (mode) cancelMode(); openSheet('land'); };
$('#open-draft').onclick = () => { if (mode) cancelMode(); openSheet('draft'); };
$('#next-turn').onclick = nextSeason;
$('#season').onclick = overview;
$('#menu').onclick = menu;
$('#zoom-in').onclick = () => zoomAt(1.2, viewArea().cx, viewArea().cy);
$('#zoom-out').onclick = () => zoomAt(1 / 1.2, viewArea().cx, viewArea().cy);
$('#codex').onclick = () => openCodex();
$('#center').onclick = () => centerCamera();
$('#yield-view').onclick = () => { yieldView = !yieldView; $('#yield-view').setAttribute('aria-pressed', String(yieldView)); requestFrame(); };
$('#guard-view').onclick = () => { guardView = !guardView; $('#guard-view').setAttribute('aria-pressed', String(guardView)); requestFrame(); };
window.addEventListener('keydown', e => {
  if (!$('#modal').hidden) { if (e.key === 'Escape' && $('#modal').dataset.dismissable) closeModal(null); return; }
  if (mode) {
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[e.key]) { e.preventDefault(); mode.ax += moves[e.key][0]; mode.ay += moves[e.key][1]; ensureVisible(); requestFrame(); }
    else if (e.key === 'r' || e.key === 'R') rotate();
    else if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') cancelMode();
  } else if (e.key === 'Escape' && sheet) closeSheet();
});
window.addEventListener('resize', () => { resize(); renderPlaceBar(); if (sheet) renderSheet(); });
// Debug/QA hook: read-only snapshot of the running game.
window.__pt = { get state() { return state; }, R, renderAll, openSheet, openCodex, cam: () => ({ ...cam, cell: cp() }), toScreen, viewArea, get tutStep() { return tut ? tut.i : -1; } };

async function boot() {
  buildSeaPattern(); lockLandscape(); paintIcons(document);
  if (!loaded.ok) {
    state = R.createGame(Math.floor(Math.random() * 4294967295));
    resize(); centerCamera(); renderAll();
    const v = await modal(`<h2>存档无法读取</h2><p>${esc(loaded.reason)}</p><p class="muted">原存档不会被自动覆盖。开始新王国时会先把它备份到 .backup。</p>`, [{ label: '开始新王国', value: true, primary: true }], { dismissable: false });
    if (v) { saveBlocked = false; newRun(false); }
    return;
  }
  if (!state) state = R.createGame(Math.floor(Math.random() * 4294967295));
  resize(); centerCamera(); renderAll();
  if (!loaded.state || state.status !== 'playing') { if (state.status !== 'playing' && loaded.state) { await endScreen(); return; } return titleScreen(); }
  banner(`第${year()}年 · ${R.SEASONS[season()].name}`, '欢迎回来');
  setTimeout(() => { if (!contextTips()) maybeAutoSheet(); }, 400);
}
boot();
