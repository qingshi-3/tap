import { ASSETS } from './assets.js';
import { LEVEL, UNIT_TYPES } from './level.js';
import { loadTerrain, drawTerrain } from './terrain.js';

const COLORS = Object.freeze({ player: '#5fd4ee', enemy: '#ef705e', rival: '#b783ef', neutral: '#d8d0a8' });
const NODE_SIZE = Object.freeze({ castle: 168, town: 124, tower: 84, chest: 48, ogre: 128 });
const images = new Map();
const keyedImages = new Map();
const thumbnails = new Map();
const animationStates = new Map();
let loadingPromise = null;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load art asset: ${src}`));
    image.src = src;
  });
}

function keyMagenta(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const rules = ASSETS.keyColorRules;
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (pixels.data[i] > rules.minRed * 255 && pixels.data[i + 2] > rules.minBlue * 255 && pixels.data[i + 1] < rules.maxGreen * 255) {
      pixels.data[i + 3] = 0;
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export async function loadArt() {
  if (loadingPromise) return loadingPromise;
  const sources = new Set();
  for (const group of [ASSETS.units || {}, ASSETS.buildings || {}, ASSETS.world || {}]) {
    for (const asset of Object.values(group)) sources.add(asset.src);
  }
  loadingPromise = Promise.all([loadTerrain(), ...[...sources].map(async (src) => images.set(src, await loadImage(src)))]).then(() => {
    for (const group of [ASSETS.buildings || {}, ASSETS.world || {}]) {
      for (const asset of Object.values(group)) {
        if (!keyedImages.has(asset.src)) keyedImages.set(asset.src, asset.nativeAlpha ? images.get(asset.src) : keyMagenta(images.get(asset.src)));
      }
    }
    return ASSETS;
  });
  return loadingPromise;
}

function cropURL(source, region, key) {
  if (!source || !region) return '';
  if (thumbnails.has(key)) return thumbnails.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = region.w;
  canvas.height = region.h;
  canvas.getContext('2d').drawImage(source, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
  const url = canvas.toDataURL('image/png');
  thumbnails.set(key, url);
  return url;
}

function croppedUnitURL(source, region, key) {
  if (!source || !region) return '';
  if (thumbnails.has(key)) return thumbnails.get(key);
  const sample = document.createElement('canvas');
  sample.width = region.w;
  sample.height = region.h;
  const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
  sampleCtx.drawImage(source, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
  const data = sampleCtx.getImageData(0, 0, region.w, region.h).data;
  let left = region.w;
  let top = region.h;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < region.h; y += 1) {
    for (let x = 0; x < region.w; x += 1) {
      if (data[(y * region.w + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return cropURL(source, region, key);
  const padding = 2;
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(region.w - 1, right + padding);
  bottom = Math.min(region.h - 1, bottom + padding);
  const canvas = document.createElement('canvas');
  canvas.width = right - left + 1;
  canvas.height = bottom - top + 1;
  canvas.getContext('2d').drawImage(sample, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/png');
  thumbnails.set(key, url);
  return url;
}

export function artURL(key) {
  const unit = ASSETS.units?.[key];
  if (unit) return croppedUnitURL(images.get(unit.src), unit.animations.idle.frames[0], `unit:${key}`);
  const asset = ASSETS.buildings?.[key] || ASSETS.world?.[key];
  if (asset?.clip && !thumbnails.has(`object:${key}`)) {
    const canvas = document.createElement('canvas');
    canvas.width = asset.region.w; canvas.height = asset.region.h;
    drawRegion(canvas.getContext('2d'), asset, canvas.width / 2, canvas.height, canvas.width);
    thumbnails.set(`object:${key}`, canvas.toDataURL('image/png'));
  }
  return asset ? cropURL(keyedImages.get(asset.src), asset.region, `object:${key}`) : '';
}

function point(x, y, camera) {
  return { x: (x - camera.x) * camera.zoom, y: (y - camera.y) * camera.zoom };
}

export function unitScreenPoint(unit, state, camera) {
  const members = [...(state?.units || []), ...(state?.casualties || [])]
    .filter((other) => !other.garrisoned && other.owner === unit.owner
      && Math.hypot(other.x - unit.x, other.y - unit.y) <= 28)
    .sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
  const index = Math.max(0, members.findIndex((other) => other === unit
    || (other.id === unit.id && other.deathStartedAt === unit.deathStartedAt)));
  const row = index % 3;
  const column = Math.floor(index / 3) % 3;
  const inCombat = Boolean(unit.meleeTarget);
  const rowGap = inCombat ? 66 : 26;
  const columnGap = inCombat ? 38 : 20;
  let visualX = unit.x + (column - Math.min(2, Math.floor((members.length - 1) / 3)) / 2) * columnGap;
  let visualY = unit.y + (row - (Math.min(3, members.length) - 1) / 2) * rowGap;

  if (unit.meleeTarget) {
    const target = state.units?.find((other) => other.id === unit.meleeTarget);
    let dx = target ? unit.x - target.x : -(unit.facing === -1 || unit.facing === 'left' ? -1 : 1);
    let dy = target ? unit.y - target.y : 0;
    const length = Math.hypot(dx, dy) || 1;
    visualX += dx / length * 45;
    visualY += dy / length * 45;
  }
  return point(visualX, visualY, camera);
}

function isVisible(x, y, radius, camera, w, h) {
  const p = point(x, y, camera);
  const r = radius * camera.zoom;
  return p.x + r >= 0 && p.y + r >= 0 && p.x - r <= w && p.y - r <= h;
}

function drawRegion(ctx, asset, x, footY, width) {
  const source = keyedImages.get(asset.src);
  if (!source) return;
  const height = width * asset.region.h / asset.region.w;
  ctx.save();
  // Atlas props above the roof belong to neighboring objects, not the building.
  if (asset.clip) {
    const scale = width / asset.region.w;
    ctx.beginPath();
    asset.clip.forEach(([px, py], i) => ctx[i ? 'lineTo' : 'moveTo'](x - width / 2 + px * scale, footY - height + py * scale));
    ctx.closePath(); ctx.clip();
  }
  ctx.drawImage(source, asset.region.x, asset.region.y, asset.region.w, asset.region.h, x - width / 2, footY - height, width, height);
  ctx.restore();
}

// Touch targets follow the displayed sprite, including the tall mage tower.
export function nodeArtSize(node) {
  const asset = ASSETS.buildings[`${node.kind}_${node.owner}`] || ASSETS.buildings[node.kind] || ASSETS.world?.[node.kind];
  const width = NODE_SIZE[node.kind] || 100;
  return { width, height: asset ? width * asset.region.h / asset.region.w : width };
}

function selectionRing(ctx, x, y, radius, color = '#fff2a6') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * .42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function flag(ctx, x, groundY, scale, owner) {
  const pole = 48 * scale;
  const width = 29 * scale;
  ctx.save();
  ctx.strokeStyle = '#3b3025';
  ctx.lineWidth = Math.max(1.5, 3 * scale);
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.lineTo(x, groundY - pole);
  ctx.stroke();
  ctx.fillStyle = COLORS[owner] || COLORS.neutral;
  ctx.beginPath();
  ctx.moveTo(x, groundY - pole);
  if (owner === 'player') {
    ctx.lineTo(x + width, groundY - pole + 4 * scale);
    ctx.lineTo(x + width * .72, groundY - pole + 13 * scale);
    ctx.lineTo(x + width, groundY - pole + 22 * scale);
  } else if (owner === 'rival') {
    ctx.lineTo(x + width * .55, groundY - pole + 8 * scale);
    ctx.lineTo(x + width, groundY - pole + 18 * scale);
  } else {
    ctx.lineTo(x + width, groundY - pole + 12 * scale);
  }
  ctx.lineTo(x, groundY - pole + 25 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function hpBar(ctx, x, y, width, ratio, color) {
  ctx.fillStyle = 'rgba(10,18,18,.88)';
  ctx.fillRect(x - width / 2, y, width, 7);
  ctx.fillStyle = color;
  ctx.fillRect(x - width / 2 + 1, y + 1, Math.max(0, width - 2) * Math.max(0, Math.min(1, ratio)), 5);
}

function engaged(node, state) {
  return state.units.some((unit) => !unit.garrisoned && unit.visualAction === 'attack' && Math.hypot(unit.x - node.x, unit.y - node.y) < 150);
}

function drawNode(ctx, node, state, selection, camera, w, h) {
  if (node.kind === 'road' || node.kind === 'ogre' || (node.kind === 'chest' && node.owner !== 'neutral')) return;
  if (!isVisible(node.x, node.y, 190, camera, w, h)) return;
  const p = point(node.x, node.y, camera);
  const size = (NODE_SIZE[node.kind] || 100) * camera.zoom;
  const asset = node.kind === 'castle' || node.kind === 'town' || node.kind === 'tower'
    ? ASSETS.buildings[`${node.kind}_${node.owner}`] || ASSETS.buildings[node.kind] : ASSETS.world?.[node.kind];
  if (selection.nodeId === node.id) selectionRing(ctx, p.x, p.y + 3, Math.max(24, size * .48));
  ctx.fillStyle = 'rgba(36,43,27,.16)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 3, size * .34, size * .1, 0, 0, Math.PI * 2);
  ctx.fill();
  if (asset) drawRegion(ctx, asset, p.x, p.y + 4 * camera.zoom, size);
  if (!['chest', 'ogre', 'road'].includes(node.kind)) flag(ctx, p.x + size * .28, p.y, camera.zoom, node.owner);
  if ((selection.nodeId === node.id || engaged(node, state)) && Number.isFinite(node.hp) && node.maxHp > 0) {
    hpBar(ctx, p.x, p.y + 13 * camera.zoom, Math.max(42, size * .72), node.hp / node.maxHp, COLORS[node.owner] || COLORS.neutral);
  }
  if (node.captureOwner && node.captureProgress > 0) {
    const progress = Math.min(1, node.captureProgress / 4);
    ctx.save();
    ctx.strokeStyle = COLORS[node.captureOwner] || '#fff2a6';
    ctx.lineWidth = Math.max(3, 6 * camera.zoom);
    ctx.beginPath();
    ctx.arc(p.x, p.y + 2, Math.max(27, size * .55), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSlot(ctx, slot, selection, camera, w, h) {
  if (!isVisible(slot.x, slot.y, 80, camera, w, h)) return;
  const p = point(slot.x, slot.y, camera);
  const key = slot.building?.type || slot.building || 'empty';
  const asset = ASSETS.buildings[`${key}_${slot.owner}`] || ASSETS.buildings[key];
  const size = 80 * camera.zoom;
  const selected = selection.slotId === slot.id;
  if(key==='empty'){
    const pixel=3*camera.zoom, x=Math.round((p.x-size*.38)/pixel)*pixel, y=Math.round((p.y-size*.46)/pixel)*pixel;
    // A small staked construction lot on the ground, not a network node.
    ctx.fillStyle=selected?'#dec896':'#c4b37a';
    ctx.fillRect(x+pixel,y,size*.72,size*.40);ctx.fillRect(x,y+pixel,size*.76,size*.34);
    ctx.fillStyle='#a29365';ctx.fillRect(x+pixel*3,y+pixel*3,pixel*3,pixel);ctx.fillRect(x+size*.5,y+size*.23,pixel*2,pixel);
    for(const dx of [-.37,.37])for(const dy of [-.37,.02]) {
      const sx=Math.round(p.x+size*dx), sy=Math.round(p.y+size*dy);
      ctx.fillStyle='#665038';ctx.fillRect(sx,sy-12*camera.zoom,4*camera.zoom,13*camera.zoom);
      ctx.fillStyle='#c5ac77';ctx.fillRect(sx,sy-12*camera.zoom,2*camera.zoom,10*camera.zoom);
    }
  }else if(asset){
    if(selected)selectionRing(ctx,p.x,p.y+2,Math.max(19,size*.5),'#ffe7aa');
    drawRegion(ctx, asset, p.x, p.y + 3 * camera.zoom, size);
  }
}

function frameAt(animation, elapsed, reducedMotion) {
  if (!animation?.frames?.length) return null;
  if (reducedMotion && animation.loop) return animation.frames[0];
  const durations = animation.frames.map((frame) => (frame.duration || 1) / (animation.fps || 8));
  const total = durations.reduce((sum, value) => sum + value, 0) || 1;
  let cursor = animation.loop ? elapsed % total : Math.min(elapsed, total - .0001);
  for (let i = 0; i < durations.length; i += 1) {
    if (cursor < durations[i]) return animation.frames[i];
    cursor -= durations[i];
  }
  return animation.frames.at(-1);
}

function animationDuration(animation) {
  if (!animation?.frames?.length) return 0;
  return animation.frames.reduce((sum, frame) => sum + (frame.duration || 1), 0) / (animation.fps || 8);
}

function drawUnit(ctx, unit, selectedIds, state, reducedMotion, camera, w, h, casualty = false) {
  if (unit.garrisoned || !isVisible(unit.x, unit.y, 180, camera, w, h)) return;
  const asset = ASSETS.units[unit.owner==='ogre'?'ogre':unit.kind] || ASSETS.units.guard;
  const attackStarted = typeof unit.attackStartedAt === 'number' && Number.isFinite(unit.attackStartedAt);
  const attackElapsed = attackStarted ? Math.max(0, state.time - unit.attackStartedAt) : Infinity;
  const attackDuration = animationDuration(asset.animations.attack);
  const attackWindow = Math.min(attackDuration, (unit.owner==='ogre'?1.2:UNIT_TYPES[unit.kind]?.interval) || attackDuration);
  const requestedAction = casualty ? 'death' : unit.visualAction;
  const action = requestedAction === 'attack'
    ? attackElapsed < attackWindow ? 'attack' : !unit.inCombat && unit.route?.length ? 'move' : 'idle'
    : asset.animations[requestedAction] ? requestedAction : unit.route?.length ? 'move' : 'idle';
  const prior = animationStates.get(unit.id);
  const serialChanged = action === 'attack' && prior?.attackSerial !== unit.attackSerial;
  if (!prior || prior.action !== action || serialChanged || state.time < prior.enteredAt) {
    animationStates.set(unit.id, {
      action,
      enteredAt: action === 'attack' ? unit.attackStartedAt : casualty ? unit.deathStartedAt : state.time,
      attackSerial: unit.attackSerial,
    });
  }
  let elapsed = state.time - animationStates.get(unit.id).enteredAt;
  if (action === 'attack' && attackWindow > 0 && attackDuration > attackWindow) {
    elapsed *= attackDuration / attackWindow;
  }
  if (casualty && Number.isFinite(unit.expiresAt) && unit.expiresAt > unit.deathStartedAt) {
    const lifetime = unit.expiresAt - unit.deathStartedAt;
    elapsed = Math.min(animationDuration(asset.animations.death), Math.max(0, elapsed) / lifetime * animationDuration(asset.animations.death));
  }
  const frame = frameAt(asset.animations[action], elapsed, reducedMotion);
  const source = images.get(asset.src);
  if (!frame || !source) return;
  const p = unitScreenPoint(unit, state, camera);
  const frameSize = (unit.owner==='ogre'?150:82) * camera.zoom;
  const selected = selectedIds.has(unit.id);
  const bob = 0; // Locomotion is authored in the sprite frames; do not shake the whole squad.
  const caps = { guard: 9, archer: 9, cavalry: 5, magic: 6, siege: 1 };
  const hpRatio = unit.maxHp > 0 ? Math.max(0, Math.min(1, unit.hp / unit.maxHp)) : 1;
  const surviving = Math.max(1, Math.min(caps[unit.kind] || 9, Math.ceil((unit.soldiers || 1) * hpRatio)));
  const columns = unit.kind === 'siege' ? 1 : unit.kind === 'cavalry' ? Math.min(3, surviving) : 3;
  const xStep = 23 * camera.zoom;
  const yStep = 15 * camera.zoom;
  const rows = Math.ceil(surviving / columns);
  const formationWidth = frameSize + (Math.min(columns, surviving) - 1) * xStep;
  if (selected) selectionRing(ctx, p.x, p.y + 2, Math.max(22, formationWidth * .48));
  ctx.fillStyle = 'rgba(9,16,17,.55)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 3, Math.max(frameSize * .18, formationWidth * .4), Math.max(4, rows * yStep * .35), 0, 0, Math.PI * 2);
  ctx.fill();
  const casualtyLife = casualty && Number.isFinite(unit.expiresAt) && unit.expiresAt > unit.deathStartedAt
    ? Math.max(0, Math.min(1, (unit.expiresAt - state.time) / (unit.expiresAt - unit.deathStartedAt))) : 1;
  for (let i = surviving - 1; i >= 0; i -= 1) {
    const row = Math.floor(i / columns);
    const countInRow = Math.min(columns, surviving - row * columns);
    const column = i % columns;
    const ox = (column - (countInRow - 1) / 2) * xStep + (row % 2 ? xStep * .2 : 0);
    const oy = -(rows - 1 - row) * yStep;
    ctx.save();
    if (casualty) ctx.globalAlpha = Math.min(1, casualtyLife * 4);
    if (unit.facing === 'left' || unit.facing === -1 || unit.facing === false) {
      ctx.translate(p.x + ox, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(p.x + ox), 0);
    }
    ctx.drawImage(source, frame.x, frame.y, frame.w, frame.h,
      p.x + ox - frameSize / 2, p.y + oy - frameSize * .8 + bob, frameSize, frameSize);
    ctx.restore();
  }
  if (casualty) return;
  flag(ctx, p.x + formationWidth * .38, p.y, camera.zoom * .55, unit.owner);
  const hurt = Number.isFinite(unit.hp) && unit.maxHp > 0 && unit.hp < unit.maxHp;
  if (selected || hurt) hpBar(ctx, p.x, p.y - frameSize * .68 - (rows - 1) * yStep, Math.max(34, formationWidth * .68), hpRatio, COLORS[unit.owner] || COLORS.neutral);
  const count = unit.count ?? unit.soldiers;
  if (Number.isFinite(count) && count > 1) {
    ctx.font = `700 ${Math.max(10, Math.round(16 * camera.zoom))}px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(13,22,22,.9)';
    ctx.fillRect(p.x - 14, p.y + 3, 28, 17);
    ctx.fillStyle = '#fff8d5';
    ctx.fillText(String(surviving), p.x, p.y + 12);
  }
}

function drawRoutes(ctx, state, selectedIds, camera, w, h) {
  ctx.save();
  ctx.strokeStyle = '#fff1a1';
  ctx.fillStyle = '#fff1a1';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([9, 7]);
  for (const unit of state.units) {
    if (!selectedIds.has(unit.id) || !unit.route?.length) continue;
    const remaining = unit.route.slice(Math.max(0, unit.routeIndex || 0));
    if (!remaining.length) continue;
    const points = [unitScreenPoint(unit, state, camera), ...remaining.map((item) => point(item.x, item.y, camera))];
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    const tip = points.at(-1);
    if (tip.x >= 0 && tip.x <= w && tip.y >= 0 && tip.y <= h) {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.setLineDash([9, 7]);
    }
  }
  ctx.restore();
}

function drawEffects(ctx, state, reducedMotion, camera, w, h) {
  for (const effect of state.effects || []) {
    if (!isVisible(effect.x, effect.y, effect.radius || 80, camera, w, h)) continue;
    const p = point(effect.x, effect.y, camera);
    const radius = (effect.radius || 70) * camera.zoom;
    const hostile = effect.owner === 'enemy' || effect.owner === 'rival';
    ctx.save();
    const pulse = reducedMotion ? 1 : .88 + Math.sin(state.time * 10) * .12;
    ctx.fillStyle = effect.type === 'heal' ? 'rgba(101,240,189,.10)' : hostile ? 'rgba(255,121,95,.45)' : 'rgba(255,226,138,.42)';
    ctx.strokeStyle = effect.type === 'heal' ? `rgba(150,255,217,${.75 * pulse})` : '#fff3c5';
    ctx.lineWidth = Math.max(2, 4 * camera.zoom);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (effect.type === 'heal') {
      const mark = Math.max(7, 13 * camera.zoom);
      ctx.strokeStyle = `rgba(225,255,241,${.9 * pulse})`;
      ctx.lineWidth = Math.max(3, 6 * camera.zoom);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - mark, p.y);
      ctx.lineTo(p.x + mark, p.y);
      ctx.moveTo(p.x, p.y - mark);
      ctx.lineTo(p.x, p.y + mark);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawBattle(ctx, w, h, state, selection = {}, reducedMotion = false, camera = {}) {
  if (!ctx || !state || w <= 0 || h <= 0) return;
  const view = {
    x: Number.isFinite(camera.x) ? camera.x : 0,
    y: Number.isFinite(camera.y) ? camera.y : 0,
    zoom: Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : .6,
  };
  const reduce = typeof reducedMotion === 'object' ? Boolean(reducedMotion.matches) : Boolean(reducedMotion);
  const selectedIds = new Set(selection.unitIds || []);
  ctx.clearRect(0, 0, w, h);
  drawTerrain(ctx, w, h, view);
  drawRoutes(ctx, state, selectedIds, view, w, h);
  for (const slot of [...(state.slots || [])].sort((a, b) => a.y - b.y)) drawSlot(ctx, slot, selection, view, w, h);
  for (const node of [...state.nodes].sort((a, b) => a.y - b.y)) drawNode(ctx, node, state, selection, view, w, h);
  const activeIds = new Set(state.units.map((unit) => unit.id));
  for (const id of animationStates.keys()) if (!activeIds.has(id)) animationStates.delete(id);
  for (const unit of [...state.units].filter((item) => !item.garrisoned)
    .sort((a, b) => unitScreenPoint(a, state, view).y - unitScreenPoint(b, state, view).y)) {
    drawUnit(ctx, unit, selectedIds, state, reduce, view, w, h);
  }
  for (const casualty of [...(state.casualties || [])]
    .sort((a, b) => unitScreenPoint(a, state, view).y - unitScreenPoint(b, state, view).y)) {
    drawUnit(ctx, casualty, selectedIds, state, reduce, view, w, h, true);
  }
  drawEffects(ctx, state, reduce, view, w, h);
}
