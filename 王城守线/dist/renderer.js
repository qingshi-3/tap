import { WORLD, getStage } from './levels.js';
import { ENEMY_TYPES, TOWER_TYPES, getTowerStats } from './simulation.js';

const ASSET_FILE = /^assets\/.+\.png$/i;
const VISUAL_CLOCKS = new WeakMap();
const TOWER_VISUAL_STATES = new WeakMap();
const PROJECTILE_VISUAL_STATES = new WeakMap();
const BATTLEFIELD_VIEWS = new WeakMap();
const ENEMY_VISIBLE_HEIGHTS = Object.freeze({ grunt: 52, runner: 64, armored: 66, flyer: 64, boss: 96 });
const MIN_BATTLEFIELD_ZOOM = 1;
const MAX_BATTLEFIELD_ZOOM = 2.5;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function visualTimeFor(game, wallTime, reducedMotion) {
  const safeWallTime = Number.isFinite(wallTime) ? wallTime : 0;
  let clock = VISUAL_CLOCKS.get(game);
  if (!clock) {
    clock = { wallTime: safeWallTime, visualTime: 0 };
    VISUAL_CLOCKS.set(game, clock);
  }
  const delta = Math.max(0, Math.min(.1, safeWallTime - clock.wallTime));
  clock.wallTime = safeWallTime;
  if (!game.paused && !reducedMotion) clock.visualTime += delta;
  return reducedMotion ? 0 : clock.visualTime;
}

function pathsIn(value, out = new Set()) {
  if (typeof value === 'string' && ASSET_FILE.test(value)) out.add(value);
  else if (Array.isArray(value)) for (const child of value) pathsIn(child, out);
  else if (value && typeof value === 'object') for (const child of Object.values(value)) pathsIn(child, out);
  return out;
}

export async function loadArtwork() {
  const response = await fetch('./assets/asset-manifest.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`素材清单读取失败 (${response.status})`);
  const manifest = await response.json();
  const unitResponse = await fetch('./assets/duelyst/manifest.json');
  if (!unitResponse.ok) throw new Error(`驻军素材读取失败 (${unitResponse.status})`);
  manifest.duelyst = await unitResponse.json();
  const images = new Map();
  const urls = [...pathsIn(manifest)];
  await Promise.all(urls.map(path => new Promise(resolve => {
    const image = new Image();
    image.onload = () => { images.set(path, image); resolve(); };
    image.onerror = () => { resolve(); };
    image.src = `./${path}`;
  })));
  return { manifest, images, loaded: images.size, total: urls.length };
}

export function imageFor(art, path) { return path ? art?.images.get(path) ?? null : null; }

// Atlas offsets keep the feet stable when an attack expands beyond the idle silhouette.
function drawDuelystFrame(ctx, image, frame, x, y, scale, footX, footY, flip = false) {
  if (!image || !frame) return false;
  const dx = (frame.sourceX ?? 0) - footX;
  const dy = (frame.sourceY ?? 0) - footY;
  ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -scale : scale, scale);
  if (frame.rotated) {
    ctx.translate(dx, dy + frame.width); ctx.rotate(-Math.PI / 2);
    ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
  } else ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, dx, dy, frame.width, frame.height);
  ctx.restore(); return true;
}

export function drawDuelystUnit(ctx, art, id, state, time, x, y, flip = false, height = null) {
  const spec = art?.manifest?.duelyst?.units?.[id];
  if (!spec) return false;
  const frames = spec.states[state]?.length ? spec.states[state] : spec.states.idle;
  const frameIndex = state === 'attack'
    ? Math.min(frames.length - 1, Math.floor(time / .55 * frames.length))
    : Math.floor(time * 1000 / (spec.frameMs || 100)) % frames.length;
  const frame = frames?.[frameIndex];
  return drawDuelystFrame(ctx, imageFor(art, spec.path), frame, x, y,
    (height ?? spec.visibleHeight ?? 72) / Math.max(1, spec.referenceHeight), spec.footX, spec.footY, flip);
}

export function drawUnitPreview(canvas, art, id) {
  const ctx = canvas.getContext('2d');
  canvas.width = 96; canvas.height = 100;
  ctx.clearRect(0, 0, 96, 100); ctx.imageSmoothingEnabled = false;
  drawDuelystUnit(ctx, art, id, 'idle', 0, 48, 96, false, 86);
}

function repeatPattern(ctx, image) {
  if (!image) return null;
  try { return ctx.createPattern(image, 'repeat'); } catch { return null; }
}

export function frameImage(ctx, art, spec, time, x, y, width, height, { flip = false, frameOverride = null } = {}) {
  if (!spec) return false;
  const source = imageFor(art, typeof spec === 'string' ? spec : spec.path);
  if (!source) return false;
  const frameWidth = typeof spec === 'string' ? source.width : spec.frameWidth || source.width;
  const frameHeight = typeof spec === 'string' ? source.height : spec.frameHeight || source.height;
  const frameCount = typeof spec === 'string' ? 1 : spec.frameCount || 1;
  const frame = frameOverride ?? (frameCount > 1 ? Math.floor(time * 7.5) % frameCount : 0);
  const sx = Math.min(frameCount - 1, frame) * frameWidth;
  ctx.save();
  if (flip) {
    ctx.translate(x + width, 0);
    ctx.scale(-1, 1);
    x = 0;
  }
  ctx.drawImage(source, sx, 0, frameWidth, frameHeight, x, y, width, height);
  ctx.restore();
  return true;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampViewCenter(state, width, height, scale) {
  const viewportWidth = width / scale;
  const viewportHeight = height / scale;
  state.centerX = viewportWidth >= WORLD.width
    ? WORLD.width / 2
    : clamp(state.centerX, viewportWidth / 2, WORLD.width - viewportWidth / 2);
  state.centerY = viewportHeight >= WORLD.height
    ? WORLD.height / 2
    : clamp(state.centerY, viewportHeight / 2, WORLD.height - viewportHeight / 2);
}

export function getBattlefieldView(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  }
  let state = BATTLEFIELD_VIEWS.get(canvas);
  if (!state) {
    state = { zoom: MIN_BATTLEFIELD_ZOOM, centerX: WORLD.width / 2, centerY: WORLD.height / 2 };
    BATTLEFIELD_VIEWS.set(canvas, state);
  }
  state.zoom = clamp(Number.isFinite(state.zoom) ? state.zoom : MIN_BATTLEFIELD_ZOOM, MIN_BATTLEFIELD_ZOOM, MAX_BATTLEFIELD_ZOOM);
  const baseScale = Math.min(width / WORLD.width, height / WORLD.height);
  const scale = baseScale * state.zoom;
  clampViewCenter(state, width, height, scale);
  return {
    rect, dpr, width, height, scale,
    x: width / 2 - state.centerX * scale,
    y: height / 2 - state.centerY * scale,
    zoom: state.zoom
  };
}

export function canvasPoint(canvas, clientX, clientY) {
  const view = getBattlefieldView(canvas);
  return { x: (clientX - view.rect.left - view.x) / view.scale, y: (clientY - view.rect.top - view.y) / view.scale, scale: view.scale };
}

export function canvasPosition(canvas, worldX, worldY) {
  const view = getBattlefieldView(canvas);
  return {
    clientX: view.rect.left + view.x + worldX * view.scale,
    clientY: view.rect.top + view.y + worldY * view.scale,
    scale: view.scale
  };
}

export function resetBattlefieldView(canvas) {
  BATTLEFIELD_VIEWS.set(canvas, { zoom: MIN_BATTLEFIELD_ZOOM, centerX: WORLD.width / 2, centerY: WORLD.height / 2 });
  return getBattlefieldView(canvas);
}

export function moveBattlefieldView(canvas, fromClientX, fromClientY, toClientX, toClientY, zoomRatio = 1) {
  const view = getBattlefieldView(canvas);
  if (![fromClientX, fromClientY, toClientX, toClientY, zoomRatio].every(Number.isFinite) || zoomRatio <= 0) return view;

  const worldX = (fromClientX - view.rect.left - view.x) / view.scale;
  const worldY = (fromClientY - view.rect.top - view.y) / view.scale;
  const state = BATTLEFIELD_VIEWS.get(canvas);
  state.zoom = clamp(view.zoom * zoomRatio, MIN_BATTLEFIELD_ZOOM, MAX_BATTLEFIELD_ZOOM);
  const baseScale = Math.min(view.width / WORLD.width, view.height / WORLD.height);
  const scale = baseScale * state.zoom;
  state.centerX = worldX + (view.width / 2 - (toClientX - view.rect.left)) / scale;
  state.centerY = worldY + (view.height / 2 - (toClientY - view.rect.top)) / scale;
  clampViewCenter(state, view.width, view.height, scale);
  return getBattlefieldView(canvas);
}

const DECOR = {
  field: [[42, 63, 'tree'], [77, 508, 'rock'], [275, 62, 'tree'], [507, 57, 'rock'], [744, 70, 'tree'], [982, 95, 'rock'], [972, 515, 'tree'], [340, 525, 'tree']],
  river: [[42, 60, 'shore'], [290, 76, 'shore'], [500, 66, 'shore'], [745, 77, 'shore'], [962, 503, 'shore']],
  swamp: [[39, 66, 'tree'], [284, 72, 'tree'], [487, 75, 'waterDetail'], [753, 66, 'tree'], [977, 503, 'waterDetail'], [68, 520, 'waterDetail']]
};

function drawGround(ctx, art, stage) {
  const terrain = art?.manifest?.terrain?.[stage.theme];
  const ground = imageFor(art, terrain?.base?.path);
  const groundPattern = repeatPattern(ctx, ground);
  ctx.fillStyle = stage.palette.grass;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  if (groundPattern) { ctx.fillStyle = groundPattern; ctx.fillRect(0, 0, WORLD.width, WORLD.height); }
  // Quiet terrain groupings communicate clearings and wooded edges without HUD labels.
  for (const [index, zone] of (stage.zones ?? []).entries()) {
    ctx.save(); ctx.globalAlpha = .13; ctx.fillStyle = index % 2 ? stage.palette.dark : stage.palette.light;
    ctx.beginPath(); ctx.ellipse(zone.x, zone.y, 155, 92, -.25, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  if (stage.theme === 'river') {
    const fieldPattern = repeatPattern(ctx, imageFor(art, art?.manifest?.terrain?.field?.base?.path));
    ctx.save();
    ctx.fillStyle = fieldPattern || stage.palette.light;
    const islands = stage.islands ?? [[94, 166, 132, 174], [274, 445, 161, 125], [407, 129, 160, 160], [699, 129, 173, 169], [892, 387, 150, 165]];
    for (const [x, y, rx, ry] of islands) {
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, .12, 0, Math.PI * 2);
      ctx.strokeStyle = '#a5ad7880'; ctx.lineWidth = 8; ctx.stroke(); ctx.fill();
    }
    ctx.restore();
  } else if (stage.theme === 'swamp') {
    const water = imageFor(art, art?.manifest?.terrain?.swamp?.decorations?.waterDetail);
    for (const [x, y, w, h] of [[34, 70, 86, 34], [438, 54, 100, 34], [952, 432, 120, 45], [514, 527, 82, 28]]) {
      ctx.fillStyle = '#344f4b'; ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, -.1, 0, Math.PI * 2); ctx.fill();
      if (water) ctx.drawImage(water, x - 19, y - 13, 38, 26);
    }
  }

  const decorations = terrain?.decorations ?? {};
  const decorPaths = {
    tree: typeof decorations.tree === 'string' ? decorations.tree : art?.manifest?.terrain?.field?.decorations?.tree,
    rock: typeof decorations.rock === 'string' ? decorations.rock : art?.manifest?.terrain?.field?.decorations?.rock,
    shore: typeof decorations.shore === 'string' ? decorations.shore : null,
    waterDetail: typeof decorations.waterDetail === 'string' ? decorations.waterDetail : null
  };
  for (const [x, y, kind] of stage.decor ?? DECOR[stage.theme] ?? []) {
    const image = imageFor(art, decorPaths[kind]);
    if (image) {
      const size = kind === 'tree' ? 66 : kind === 'shore' ? 54 : 39;
      ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
    }
  }
  for (const mark of stage.landmarks ?? []) {
    ctx.save(); ctx.translate(mark.x, mark.y);
    ctx.fillStyle = '#333c2966'; ctx.beginPath(); ctx.ellipse(0, 7, 28, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#797f61'; ctx.strokeStyle = '#454d3a'; ctx.lineWidth = 2;
    for (const [x,y,w,h] of [[-22,-12,14,22],[-7,-7,16,17],[10,-17,12,27]]) { ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h); }
    ctx.fillStyle = '#a7a982'; ctx.fillRect(-22,-14,14,4); ctx.fillRect(10,-19,12,4);
    ctx.restore();
  }
}

function drawRoad(ctx, art, stage) {
  const points = stage.path;
  const pathImage = imageFor(art, art?.manifest?.terrain?.[stage.theme]?.path?.path);
  const pathPattern = repeatPattern(ctx, pathImage);
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = stage.palette.roadEdge; ctx.lineWidth = 50; ctx.stroke();
  ctx.strokeStyle = pathPattern || stage.palette.road; ctx.lineWidth = 42; ctx.stroke();
  ctx.restore();

  const start = points[0], end = points[points.length - 1];
  // Entrances and exits can face any edge; place the gate inward along its road.
  const inward = (edge, neighbour, distance) => {
    const dx = neighbour[0] - edge[0], dy = neighbour[1] - edge[1];
    const length = Math.hypot(dx, dy) || 1;
    return [edge[0] + dx / length * distance, edge[1] + dy / length * distance];
  };
  drawGate(ctx, ...inward(start, points[1], 62), false);
  drawGate(ctx, ...inward(end, points[points.length - 2], 62), true);
}

function drawGate(ctx, x, y, castle) {
  ctx.save(); ctx.translate(x, y);
  const size = castle ? 1.18 : .82;
  ctx.scale(size, size);
  ctx.fillStyle = '#392d24'; ctx.fillRect(-22, -28, 44, 48);
  ctx.fillStyle = castle ? '#b98752' : '#78844f'; ctx.fillRect(-19, -31, 38, 8);
  ctx.fillRect(-23, -24, 7, 15); ctx.fillRect(-7, -24, 14, 15); ctx.fillRect(16, -24, 7, 15);
  ctx.fillStyle = castle ? '#d7b36d' : '#a2aa68'; ctx.fillRect(-16, -20, 32, 38);
  ctx.fillStyle = '#42372b'; ctx.fillRect(-7, 3, 14, 15);
  ctx.fillStyle = '#271f19'; ctx.fillRect(-20, 18, 40, 4);
  ctx.restore();
}

function drawPads(ctx, art, stage, game, visualTime) {
  const decor = art?.manifest?.terrain?.[stage.theme]?.decorations;
  const slotPath = typeof decor?.towerSlot === 'string' ? decor.towerSlot : art?.manifest?.terrain?.field?.decorations?.towerSlot;
  const slot = imageFor(art, slotPath);
  stage.pads.forEach(([x, y], index) => {
    const occupied = game.towers.some(tower => tower.padIndex === index);
    const focused = game.focusPadIndex === index;
    if (occupied && !focused) return;
    ctx.save();
    if (focused) {
      ctx.beginPath(); ctx.arc(x, y, 26 + Math.sin(visualTime * 4) * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#b7e3a0'; ctx.lineWidth = 3; ctx.stroke();
    }
    if (occupied) { ctx.restore(); return; }
    ctx.globalAlpha = game.placementType ? .95 : .56;
    if (slot) ctx.drawImage(slot, x - 20, y - 20, 40, 40);
    ctx.beginPath(); ctx.arc(x, y, game.placementType ? 22 : 17, 0, Math.PI * 2);
    ctx.strokeStyle = game.placementType ? '#f2d47c' : 'rgba(238,220,165,.72)'; ctx.lineWidth = 2; ctx.setLineDash(game.placementType ? [] : [4, 4]); ctx.stroke();
    if (game.placementType) {
      ctx.beginPath(); ctx.arc(x, y, 4 + Math.sin(visualTime * 4) * 1.4, 0, Math.PI * 2); ctx.fillStyle = '#f3dc91'; ctx.fill();
    }
    ctx.restore();
  });
}

function directionFor(enemy, stage) {
  const path = stage.paths?.[enemy.pathIndex ?? 0] ?? stage.path;
  const next = path[Math.min(enemy.waypoint, path.length - 1)];
  const dx = next[0] - enemy.x, dy = next[1] - enemy.y;
  if (Math.abs(dx) > Math.abs(dy)) return { direction: 'side', flip: dx < 0 };
  return { direction: dy >= 0 ? 'down' : 'up', flip: false };
}

function isContentBounds(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y)
    && value.width > 0 && value.height > 0
    && Number.isFinite(value.footX) && Number.isFinite(value.footY);
}

function enemyVisual(enemy, metadata, direction, flip) {
  const frameWidth = metadata?.frameWidth || 48;
  const frameHeight = metadata?.frameHeight || 48;
  const directionalBounds = metadata?.contentBounds?.[direction];
  const bounds = isContentBounds(directionalBounds)
    ? directionalBounds
    : { x: 0, y: 0, width: frameWidth, height: frameHeight, footX: frameWidth / 2, footY: frameHeight };
  const boundSet = Object.values(metadata?.contentBounds ?? {}).filter(isContentBounds);
  const referenceHeight = boundSet.length ? Math.max(...boundSet.map(value => value.height)) : frameHeight;
  const targetHeight = ENEMY_TYPES[enemy.type]?.visibleHeight ?? ENEMY_VISIBLE_HEIGHTS[enemy.type] ?? 56;
  const pixelScale = targetHeight / Math.max(1, referenceHeight);
  const width = bounds.width * pixelScale;
  const height = bounds.height * pixelScale;
  const footOffsetX = (bounds.footX - bounds.x) * pixelScale;
  const footOffsetY = (bounds.footY - bounds.y) * pixelScale;
  const bodyFootY = enemy.y - (enemy.type === 'flyer' ? 12 : 0);
  const left = flip ? enemy.x + footOffsetX - width : enemy.x - footOffsetX;
  const top = bodyFootY - footOffsetY;
  return {
    bounds, frameWidth, frameHeight, pixelScale, width, height,
    left, top, right: left + width, bottom: top + height,
    centerX: left + width / 2, centerY: top + height / 2, bodyFootY
  };
}

function drawEnemyFrame(ctx, art, path, metadata, visual, enemy, flip, time) {
  const source = imageFor(art, path);
  if (!source) return false;
  const frameCount = metadata?.frameCount || 1;
  const frameIndex = frameCount > 1 ? Math.floor(time * 7.5) % frameCount : 0;
  const { bounds, frameWidth, pixelScale } = visual;
  ctx.save();
  ctx.translate(enemy.x, visual.bodyFootY);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(
    source,
    frameIndex * frameWidth + bounds.x, bounds.y, bounds.width, bounds.height,
    -(bounds.footX - bounds.x) * pixelScale,
    -(bounds.footY - bounds.y) * pixelScale,
    bounds.width * pixelScale, bounds.height * pixelScale
  );
  ctx.restore();
  return true;
}

function drawEnemies(ctx, art, game, stage, enemies = game.enemies) {
  const entries = enemies.map((enemy, index) => {
    const metadata = art?.manifest?.enemies?.[ENEMY_TYPES[enemy.type]?.sprite];
    const { direction, flip } = directionFor(enemy, stage);
    const path = metadata?.[metadata?.movement]?.[direction];
    return { enemy, index, metadata, direction, flip, path, visual: enemyVisual(enemy, metadata, direction, flip) };
  }).sort((a, b) => a.enemy.y - b.enemy.y || a.index - b.index);

  for (const { enemy, visual } of entries) {
    const targetHeight = ENEMY_TYPES[enemy.type]?.visibleHeight ?? ENEMY_VISIBLE_HEIGHTS[enemy.type] ?? 56;
    const shadowRadiusX = Math.max(11, Math.min(visual.width * .42, targetHeight * .36));
    const shadowRadiusY = Math.max(4, shadowRadiusX * .28);
    ctx.save();
    ctx.fillStyle = enemy.type === 'boss' ? 'rgba(24,17,14,.55)' : 'rgba(25,27,18,.35)';
    ctx.beginPath(); ctx.ellipse(enemy.x, enemy.y - 2, shadowRadiusX, shadowRadiusY, 0, 0, Math.PI * 2); ctx.fill();
    if (enemy.slowLeft > 0) {
      ctx.beginPath(); ctx.ellipse(enemy.x, enemy.y - 3, targetHeight * .35, targetHeight * .16, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(124,190,228,.7)'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }

  for (const { enemy, metadata, flip, path, visual } of entries) {
    ctx.save();
    const drawn = ENEMY_TYPES[enemy.type]?.duelyst
      ? drawDuelystUnit(ctx, art, enemy.type, 'run', game.elapsed, enemy.x, enemy.y, flip, ENEMY_TYPES[enemy.type].visibleHeight)
      : drawEnemyFrame(ctx, art, path, metadata, visual, enemy, flip, game.elapsed);
    if (!drawn) {
      ctx.fillStyle = enemy.type === 'boss' ? '#8b5640' : enemy.type === 'runner' ? '#c79a55' : '#b86854';
      const fallbackWidth = Math.max(22, Math.min(visual.width, (ENEMY_VISIBLE_HEIGHTS[enemy.type] ?? 56) * .72));
      ctx.beginPath();
      ctx.ellipse(visual.centerX, visual.centerY, fallbackWidth / 2, visual.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (enemy.burnLeft > 0) { ctx.fillStyle = '#ffad46'; ctx.beginPath(); ctx.arc(enemy.x - 10, enemy.y - 24, 4, 0, Math.PI * 2); ctx.fill(); }
    if (enemy.stunLeft > 0) { drawFivePointStar(ctx, enemy.x, visual.top - 12, 7, 3); ctx.fillStyle = '#fff0a2'; ctx.fill(); }
    if (enemy.type === 'boss' || enemy.hp < enemy.maxHp) {
      const width = Math.max(36, Math.min(enemy.type === 'boss' ? 84 : 60, visual.width * .82));
      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      const barY = visual.top - 8;
      ctx.fillStyle = '#1c1d18'; ctx.fillRect(visual.centerX - width / 2, barY, width, 5);
      ctx.fillStyle = enemy.type === 'boss' ? '#d74d48' : '#a4c269'; ctx.fillRect(visual.centerX - width / 2 + 1, barY + 1, (width - 2) * ratio, 3);
    }
    if (enemy.flash > 0) {
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = Math.min(.72, enemy.flash * 4); ctx.fillStyle = '#fff8ce';
      ctx.beginPath(); ctx.ellipse(visual.centerX, visual.centerY, Math.max(8, visual.width * .42), visual.height * .44, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

export function drawFivePointStar(ctx, x, y, outerRadius, innerRadius) {
  ctx.beginPath();
  for (let point = 0; point < 10; point++) {
    const radius = point % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + point * Math.PI / 5;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (point === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawTowerLevel(ctx, tower) {
  const level = Math.max(1, Math.min(3, tower.level));
  const radius = 7;
  const gap = 3;
  const width = level * radius * 2 + (level - 1) * gap;
  const centerY = tower.y + (TOWER_TYPES[tower.type]?.category === 'unit' ? 18 : 42);
  const left = tower.x - width / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(31,25,16,.82)';
  ctx.strokeStyle = 'rgba(255,226,137,.38)';
  ctx.lineWidth = 1;
  roundedRectPath(ctx, left - 5, centerY - 10, width + 10, 20, 10);
  ctx.fill(); ctx.stroke();
  for (let index = 0; index < level; index++) {
    const x = left + radius + index * (radius * 2 + gap);
    drawFivePointStar(ctx, x, centerY, radius, 3.15);
    ctx.fillStyle = index === 2 ? '#fff0a2' : '#f0c55f';
    ctx.strokeStyle = '#5b3e18';
    ctx.lineWidth = 2;
    ctx.stroke(); ctx.fill();
  }
  ctx.restore();
}

function drawTowerParticles(ctx, tower, type, visualTime) {
  const level = Math.max(1, Math.min(3, tower.level));
  const count = 2 + level;
  const seed = (Number.isFinite(tower.id) ? tower.id : tower.padIndex + 1) * .71;
  ctx.save();
  ctx.fillStyle = type.color;
  ctx.shadowColor = type.color;
  ctx.shadowBlur = 5;
  for (let index = 0; index < count; index++) {
    const angle = visualTime * (.42 + level * .04) + seed + index * Math.PI * 2 / count;
    const depth = (Math.sin(angle) + 1) / 2;
    const x = tower.x + Math.cos(angle) * (31 + level * 1.5);
    const y = tower.y - 33 + Math.sin(angle) * 43;
    ctx.globalAlpha = .28 + depth * .28;
    ctx.beginPath();
    ctx.arc(x, y, 1.35 + depth * .8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function towerUpgradeAge(tower, visualTime, reducedMotion) {
  let state = TOWER_VISUAL_STATES.get(tower);
  if (!state) {
    state = { level: tower.level, changedAt: null };
    TOWER_VISUAL_STATES.set(tower, state);
  } else if (state.level !== tower.level) {
    state.level = tower.level;
    state.changedAt = reducedMotion ? null : visualTime;
  }
  if (state.changedAt === null) return null;
  const age = visualTime - state.changedAt;
  if (age > .7) state.changedAt = null;
  return age <= .7 ? age : null;
}

function drawUpgradeBurst(ctx, tower, type, age) {
  const progress = Math.max(0, Math.min(1, age / .7));
  const alpha = 1 - progress;
  const centerY = tower.y - 30;
  ctx.save();
  ctx.globalAlpha = alpha * .8;
  ctx.strokeStyle = '#fff0a2';
  ctx.lineWidth = 3 - progress * 1.5;
  ctx.beginPath(); ctx.arc(tower.x, centerY, 25 + progress * 22, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = type.color;
  ctx.shadowColor = type.color;
  ctx.shadowBlur = 8;
  for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI / 4 + progress * .45;
    const distance = 22 + progress * 31;
    ctx.beginPath();
    ctx.arc(tower.x + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance, 2.5 - progress, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTowers(ctx, art, game, visualTime, reducedMotion, towers = game.towers) {
  for (const tower of towers) {
    const selected = tower.id === game.selectedTowerId;
    const keyboardFocused = game.focusPadIndex === tower.padIndex;
    const type = TOWER_TYPES[tower.type];
    const levelData = art?.manifest?.towers?.[tower.type];
    const completed = levelData?.completed ?? levelData?.idle?.[0];
    const upgradeAge = towerUpgradeAge(tower, visualTime, reducedMotion);
    ctx.save();
    drawTowerParticles(ctx, tower, type, visualTime);
    if (selected) {
      ctx.beginPath(); ctx.arc(tower.x, tower.y, 34 + Math.sin(visualTime * 4) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#f3d880'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(tower.x, tower.y, 39, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(245,222,139,.28)'; ctx.lineWidth = 1; ctx.stroke();
    }
    else if (keyboardFocused) {
      ctx.beginPath(); ctx.arc(tower.x, tower.y, 39 + Math.sin(visualTime * 4) * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#b7e3a0'; ctx.lineWidth = 3; ctx.stroke();
    }
    if (type.category === 'unit') {
      ctx.fillStyle = '#213a2d88'; ctx.beginPath(); ctx.ellipse(tower.x,tower.y,23,8,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = type.color; ctx.lineWidth = 2; ctx.stroke();
      drawDuelystUnit(ctx, art, tower.type, tower.attackLeft > 0 ? 'attack' : 'idle', reducedMotion ? 0 : tower.attackLeft > 0 ? tower.attackAge || 0 : visualTime + tower.id*.23, tower.x, tower.y, tower.facing < 0);
    } else frameImage(ctx, art, completed, reducedMotion ? 0 : visualTime + tower.id * .23, tower.x - 35, tower.y - 100, 70, 130);
    if (type.category !== 'unit' && (!completed || !imageFor(art, completed.path))) {
      ctx.fillStyle = '#674d32'; ctx.beginPath(); ctx.ellipse(tower.x, tower.y, 26, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = type.color; ctx.fillRect(tower.x - 7, tower.y - 30, 14, 31);
    }
    if (!reducedMotion && upgradeAge !== null) drawUpgradeBurst(ctx, tower, type, upgradeAge);
    drawTowerLevel(ctx, tower);
    ctx.restore();
  }
}

function projectileDisplayY(shot, art, game, stage) {
  if (TOWER_TYPES[shot.kind]?.family === 'artillery' || shot.kind === 'catapult') return shot.y;
  const target = game.enemies.find(enemy => enemy.id === shot.targetId);
  let state = PROJECTILE_VISUAL_STATES.get(shot);
  if (!state) {
    const initialDistance = target ? Math.hypot(target.x - shot.x, target.y - shot.y) : 1;
    state = { initialDistance: Math.max(1, initialDistance), aimOffset: 0 };
    PROJECTILE_VISUAL_STATES.set(shot, state);
  }
  if (target) {
    const metadata = art?.manifest?.enemies?.[ENEMY_TYPES[target.type]?.sprite];
    const { direction, flip } = directionFor(target, stage);
    const visual = enemyVisual(target, metadata, direction, flip);
    const desiredOffset = visual.centerY - target.y;
    state.aimOffset += (desiredOffset - state.aimOffset) * .35;
    const distance = Math.hypot(target.x - shot.x, target.y - shot.y);
    const progress = Math.max(0, Math.min(1, 1 - distance / state.initialDistance));
    const easedProgress = progress * progress * (3 - 2 * progress);
    return shot.y + state.aimOffset * easedProgress;
  }
  return shot.y + state.aimOffset;
}

function drawProjectiles(ctx, art, game, stage) {
  for (const shot of game.projectiles) {
    if (shot.kind === 'sentinel') continue;
    const displayY = projectileDisplayY(shot, art, game, stage);
    ctx.save();
    ctx.shadowColor = shot.color; ctx.shadowBlur = ['mage', 'flame', 'storm'].includes(shot.kind) ? 12 : 3;
    ctx.fillStyle = shot.color;
    const angle = Math.atan2(shot.impactY - shot.y, shot.impactX - shot.x);
    ctx.translate(shot.x, displayY); ctx.rotate(angle);
    if (shot.kind === 'archer' || shot.kind === 'guardian') {
      ctx.strokeStyle = shot.color; ctx.lineWidth = shot.kind === 'guardian' ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(6,0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(1,-3); ctx.lineTo(1,3); ctx.fill();
    } else if (shot.kind === 'frost') {
      ctx.beginPath(); ctx.moveTo(9,0); ctx.lineTo(-4,-5); ctx.lineTo(-9,0); ctx.lineTo(-4,5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#dfffff'; ctx.lineWidth = 1; ctx.stroke();
    } else {
      if (shot.kind === 'flame') { ctx.fillStyle = '#ff8a3baa'; ctx.beginPath(); ctx.moveTo(-17,0); ctx.lineTo(0,-6); ctx.lineTo(0,6); ctx.fill(); ctx.fillStyle = '#ffe0a0'; }
      ctx.beginPath(); ctx.arc(0, 0, shot.kind === 'catapult' ? 6 : 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawRange(ctx, game) {
  const tower = game.towers.find(item => item.id === game.selectedTowerId);
  if (!tower) return;
  const range = getTowerStats(tower).range;
  ctx.save(); ctx.beginPath(); ctx.arc(tower.x, tower.y, range, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(236,207,117,.075)'; ctx.fill(); ctx.strokeStyle = 'rgba(246,219,140,.62)'; ctx.lineWidth = 2; ctx.setLineDash([6, 7]); ctx.stroke(); ctx.restore();
  if (tower.rally) {
    ctx.save(); ctx.strokeStyle = '#87dcea'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(tower.x, tower.y); ctx.lineTo(tower.rally.x, tower.rally.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#84dbe7'; ctx.fillRect(tower.rally.x - 1, tower.rally.y - 32, 2, 32);
    ctx.beginPath(); ctx.moveTo(tower.rally.x + 1, tower.rally.y - 32); ctx.lineTo(tower.rally.x + 18, tower.rally.y - 25); ctx.lineTo(tower.rally.x + 1, tower.rally.y - 18); ctx.fill();
    ctx.beginPath(); ctx.ellipse(tower.rally.x, tower.rally.y, 19, 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
}

function drawSoldier(ctx, art, soldier, game, visualTime, reducedMotion) {
  if (soldier.hp <= 0 || soldier.deadLeft > 0) return;
  const height = soldier.reinforcement ? 42 : 48;
  const state = soldier.attackLeft > 0 ? 'attack' : soldier.moving ? 'run' : 'idle';
  ctx.save();
  ctx.fillStyle = '#15291d88'; ctx.beginPath(); ctx.ellipse(soldier.x, soldier.y - 1, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  drawDuelystUnit(ctx, art, soldier.level >= 3 ? 'sentinel' : 'militia', state,
    reducedMotion ? 0 : state === 'attack' ? soldier.attackAge || 0 : visualTime + soldier.id * .11,
    soldier.x, soldier.y, soldier.facing < 0, height);
  if (soldier.hp < soldier.maxHp || soldier.towerId === game.selectedTowerId) {
    ctx.fillStyle = '#18241c'; ctx.fillRect(soldier.x - 15, soldier.y - height - 7, 30, 5);
    ctx.fillStyle = soldier.reinforcement ? '#d9c58c' : '#88c39d'; ctx.fillRect(soldier.x - 14, soldier.y - height - 6, 28 * Math.max(0, soldier.hp / soldier.maxHp), 3);
  }
  ctx.restore();
}

function drawCombatEffects(ctx, art, game, reducedMotion) {
  for (const effect of game.effects ?? []) {
    const progress = Math.min(1, effect.age / Math.max(.01, effect.duration));
    const spec = art?.manifest?.duelyst?.effects?.[effect.kind];
    ctx.save();
    ctx.globalAlpha = reducedMotion ? .45 : Math.min(1, (1 - progress) * 2);
    if (effect.kind === 'lightning' && Number.isFinite(effect.fromX)) {
      ctx.strokeStyle = '#d1eeff'; ctx.lineWidth = 3; ctx.shadowColor = '#78bcff'; ctx.shadowBlur = reducedMotion ? 0 : 9;
      ctx.beginPath(); ctx.moveTo(effect.fromX, effect.fromY - 30);
      const dx = effect.x - effect.fromX, dy = effect.y - effect.fromY;
      for (let i = 1; i < 5; i++) ctx.lineTo(effect.fromX + dx * i / 5 + (i % 2 ? 7 : -7), effect.fromY - 30 + dy * i / 5);
      ctx.lineTo(effect.x, effect.y - 25); ctx.stroke();
    }
    if (spec?.frames?.length) {
      const frame = spec.frames[Math.min(spec.frames.length - 1, Math.floor((reducedMotion ? .45 : progress) * spec.frames.length))];
      const size = effect.kind === 'summon' ? 112 : effect.kind === 'fire' ? 98 : 78;
      drawDuelystFrame(ctx, imageFor(art, spec.path), frame, effect.x, effect.y - 24,
        size / Math.max(frame.canvasWidth, frame.canvasHeight, 1), frame.canvasWidth / 2, frame.canvasHeight / 2);
    } else if (effect.kind === 'heal') {
      ctx.strokeStyle = '#a8f4ac'; ctx.lineWidth = 4;
      const y = effect.y - 52 - progress * (reducedMotion ? 0 : 14);
      ctx.beginPath(); ctx.moveTo(effect.x - 7, y); ctx.lineTo(effect.x + 7, y); ctx.moveTo(effect.x, y - 7); ctx.lineTo(effect.x, y + 7); ctx.stroke();
    } else {
      ctx.strokeStyle = effect.color || '#ffe6ab'; ctx.lineWidth = effect.kind === 'melee' ? 5 : 2;
      ctx.beginPath(); ctx.arc(effect.x, effect.y - 25, 8 + progress * (effect.kind === 'melee' ? 34 : 16), -.7, effect.kind === 'melee' ? 2.2 : Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

export function render(canvas, game, art, time = 0) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  const view = getBattlefieldView(canvas);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = '#26382a'; ctx.fillRect(0, 0, view.width, view.height);
  ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.scale, view.scale);
  ctx.imageSmoothingEnabled = false;
  const reducedMotion = prefersReducedMotion();
  const visualTime = visualTimeFor(game, time, reducedMotion);
  const stage = getStage(game.stageId);
  drawGround(ctx, art, stage);
  drawRoad(ctx, art, stage);
  drawPads(ctx, art, stage, game, visualTime);
  drawRange(ctx, game);
  const actors = [...game.towers.map(value => ({ kind: 'tower', value })), ...game.enemies.map(value => ({ kind: 'enemy', value })), ...(game.soldiers ?? []).map(value => ({ kind: 'soldier', value }))];
  actors.sort((a, b) => a.value.y - b.value.y);
  for (const actor of actors) {
    if (actor.kind === 'tower') drawTowers(ctx, art, game, visualTime, reducedMotion, [actor.value]);
    else if (actor.kind === 'soldier') drawSoldier(ctx, art, actor.value, game, visualTime, reducedMotion);
    else drawEnemies(ctx, art, game, stage, [actor.value]);
  }
  drawProjectiles(ctx, art, game, stage);
  drawCombatEffects(ctx, art, game, reducedMotion);
  if (game.paused) {
    ctx.fillStyle = 'rgba(17,25,18,.28)'; ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }
  ctx.restore();
}
