import { battleDelay, battleElapsed } from './battle-motion.js';
import { getCard } from './cards.js';
import { BOARD, boardOf, isTacticalMatch, MANA_TILES, effectiveAttack, summonPositions, spellTargets, spellPositions, occupiedUnit, findGeneral, getBattleCard, getUnitBattleCard } from './engine.js';
import { EFFECT_MANIFEST } from './effect-manifest.js';
import { bossMarks, bossArmored } from './boss-mechanics.js';
import { EffectsPlayer } from './effects-player.js';
import { CardAssetLoader } from './card-asset-loader.js';
import { drawAtlasFrame } from './atlas.js';
import { drawAttackGround, drawAttackTargets, drawAttackGesture, drawAttackResults } from './attack-visuals.js';
import { RangePreviewCache } from './range-preview.js';

const SCENE_ANIMATION_FRAME_MS = 80;

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function colorForUnit(unit) { return ['#6bb8df', '#dc7767', '#bd91ee'][unit.owner] ?? '#dc7767'; }

function pointInPolygon(point, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function affineForTriangle(source, target) {
  const [s0, s1, s2] = source, [t0, t1, t2] = target;
  const sx1 = s1.x - s0.x, sy1 = s1.y - s0.y, sx2 = s2.x - s0.x, sy2 = s2.y - s0.y;
  const tx1 = t1.x - t0.x, ty1 = t1.y - t0.y, tx2 = t2.x - t0.x, ty2 = t2.y - t0.y;
  const determinant = sx1 * sy2 - sx2 * sy1;
  if (!determinant) return null;
  const a = (tx1 * sy2 - tx2 * sy1) / determinant;
  const c = (-tx1 * sx2 + tx2 * sx1) / determinant;
  const b = (ty1 * sy2 - ty2 * sy1) / determinant;
  const d = (-ty1 * sx2 + ty2 * sx1) / determinant;
  return [a, b, c, d, t0.x - a * s0.x - c * s0.y, t0.y - b * s0.x - d * s0.y];
}

function drawTexturedQuad(ctx, image, vertices, alpha = 1) {
  if (!image) return;
  const [topLeft, topRight, bottomRight, bottomLeft] = vertices;
  const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
  if (!width || !height) return;
  const triangles = [
    [[{ x: 0, y: 0 }, { x: width, y: 0 }, { x: 0, y: height }], [topLeft, topRight, bottomLeft]],
    [[{ x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }], [topRight, bottomRight, bottomLeft]]
  ];
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const [source, target] of triangles) {
    const matrix = affineForTriangle(source, target);
    if (!matrix) continue;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(target[0].x, target[0].y);
    ctx.lineTo(target[1].x, target[1].y);
    ctx.lineTo(target[2].x, target[2].y);
    ctx.closePath();
    ctx.clip();
    ctx.transform(...matrix);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

export class BoardRenderer {
  #loadPromise = null;
  #loadListeners = new Set();
  #loadProgress = { completed: 0, total: 0 };
  constructor(canvas, { backCanvas = null, frontCanvas = null, onVisualFrame = null } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: true });
    this.backCanvas = backCanvas;
    this.frontCanvas = frontCanvas;
    this.backContext = backCanvas?.getContext('2d', { alpha: true }) ?? null;
    this.frontContext = frontCanvas?.getContext('2d', { alpha: true }) ?? null;
    this.onVisualFrame = typeof onVisualFrame === 'function' ? onVisualFrame : null;
    this.images = new Map();
    this.atlases = new Map();
    this.cardArt = new Map();
    this.cardIdleLayouts = new Map();
    this.cardIdleFrames = new WeakMap();
    this.unitBaselines = new Map();
    this.boardFloor = null;
    this.tintedTiles = new Map();
    this.ready = false;
    this.pending = null;
    this.lastFrame = 0;
    this.state = null;
    this.camera = { x: 0, y: 0 };
    this.options = {};
    this.movement = null;
    this.cardTargetingActive = false;
    this.effects = new EffectsPlayer(this);
    this.assets = new CardAssetLoader(this);
    this.facings = new Map();
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.motionPreference.addEventListener('change', () => {
      if (this.motionPreference.matches) this.finishMovement();
      if (this.motionPreference.matches) this.finishAction();
      if (this.motionPreference.matches && this.pending !== null) {
        cancelAnimationFrame(this.pending);
        this.pending = null;
      }
      this.paint();
      this.scheduleAnimation();
    });
  }

  // Full preparation remains available to offline audits. Normal UI requests
  // visible card art; battle entry prepares only its rules closure.
  load(onProgress = () => {}) {
    const listener = typeof onProgress === 'function' ? onProgress : null;
    if (this.#loadPromise) { this.#reportLoadProgress(listener); return this.#loadPromise; }
    if (listener) this.#loadListeners.add(listener);
    let resolve, reject;
    this.#loadPromise = new Promise((done, fail) => { resolve = done; reject = fail; });
    this.assets.loadAll(value => {
      this.#loadProgress = value;
      for (const current of [...this.#loadListeners]) this.#reportLoadProgress(current);
    }).then(result => { this.#loadListeners.clear(); resolve(result); }, error => { this.#loadListeners.clear(); this.#loadPromise = null; reject(error); });
    return this.#loadPromise;
  }
  #reportLoadProgress(listener) {
    if (listener) { this.#loadListeners.add(listener); try { listener({ ...this.#loadProgress }); } catch { /* Presentation listener only. */ } }
  }
  loadCards(ids, options = {}) { return this.assets.loadCards(ids, options); }
  loadBattle(state, onProgress = () => {}) { return this.assets.loadBattle(state, onProgress); }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const width = Math.round(bounds.width * ratio), height = Math.round(bounds.height * ratio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  prepareEffectContext(canvas, context, boardRect) {
    if (!canvas || !context) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * ratio), height = Math.round(rect.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.translate(boardRect.left - rect.left, boardRect.top - rect.top);
    return context;
  }

  clearEffectLayers() {
    for (const [canvas, context] of [[this.backCanvas, this.backContext], [this.frontCanvas, this.frontContext]]) {
      if (!canvas || !context) continue;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  positionFromPointer(event, { preferUnits = true, unitIds = null } = {}) {
    const rect = this.canvas.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const metrics = this.boardMetrics(rect.width, rect.height);
    let tile = null;
    for (let y = 0; y < metrics.rows && !tile; y++) {
      for (let x = 0; x < metrics.columns; x++) {
        if (pointInPolygon(point, this.cellPoints(metrics, x, y))) { tile = { x, y }; break; }
      }
    }
    if (!preferUnits) return tile;
    // Every occupied tile remains a distinct touch target, including a rear
    // unit whose feet are covered by the next row's tall sprite. Filtering is
    // applied first so an ineligible occupant cannot steal a legal target.
    const units = preferUnits ? [...(this.state?.units ?? [])].filter(unit => !unitIds || unitIds.includes(unit.unitId)).sort((a, b) => b.y - a.y || b.x - a.x) : [];
    if (tile && units.some(unit => unit.x === tile.x && unit.y === tile.y)) return tile;
    let spriteTarget = null, nearest = Infinity;
    for (const unit of units) {
      const card = getCard(unit.cardId), art = this.getSpriteArt(card);
      const atlas = card?.sprite ? this.atlases.get(card.sprite.sheet) : null;
      const frame = atlas?.animations.breathing?.frames[0] ?? atlas?.animations.idle?.frames[0];
      if (!art || !frame) continue;
      const cell = this.cellGeometry(metrics, unit.x, unit.y);
      const scale = this.unitScale(cell, frame, card.type === 'general');
      const visibleWidth = art.width * scale, visibleHeight = art.height * scale;
      const centerX = cell.center.x + (unit.owner === 0 ? 1 : -1) * (art.x + art.width / 2 - art.image.width / 2) * scale;
      const centerY = cell.center.y + cell.height * .145 - visibleHeight / 2;
      if (visibleWidth <= 0 || visibleHeight <= 0) continue;
      const dx = (point.x - centerX) / (visibleWidth / 2);
      const dy = (point.y - centerY) / (visibleHeight / 2);
      // Outside occupied tiles, heads/bodies are still selectable. Use actual
      // art bounds, without expanding overlapping rectangles to claim 44px.
      // Resolve body overlap by proximity; draw order only breaks equal scores.
      const distance = dx * dx + dy * dy;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && distance < nearest) {
        spriteTarget = { x: unit.x, y: unit.y }; nearest = distance;
      }
    }
    return spriteTarget ?? tile;
  }

  getUnitAnchor(unit) {
    const rect = this.canvas.getBoundingClientRect();
    const cell = this.cellGeometry(this.boardMetrics(rect.width, rect.height), unit.x, unit.y);
    return { x: rect.left + cell.center.x, y: rect.top + cell.center.y };
  }

  boardMetrics(width, height) {
    const { columns, rows } = boardOf(this.state);
    // The canvas covers the screen; the layout row still defines the initial
    // camera framing and the lower gesture-cancel boundary, not a clipping box.
    const row = this.canvas.closest('.battle-row')?.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    const framingHeight = row?.height || height;
    const framingTop = row ? row.top - canvasRect.top : 0;
    if (isTacticalMatch(this.state)) {
      const cellWidth = Math.max(64, Math.min(92, width / 9));
      const cellHeight = Math.max(44, Math.min(64, framingHeight / 5));
      const boardWidth = columns * cellWidth, boardHeight = rows * cellHeight;
      const maxX = Math.max(0, (boardWidth - width) / 2 + 32);
      const initialTop = Math.max(64, framingTop + (framingHeight - boardHeight) / 2);
      // Keep standing sprite heads inside the real viewport at both pan limits.
      // HUDs can float over the scene without ever slicing it at their row edge.
      const minimumTop = Math.min(64, framingTop + framingHeight - boardHeight);
      const maximumTop = Math.max(64, height - boardHeight - 16);
      this.camera.x = Math.max(-maxX, Math.min(maxX, this.camera.x));
      this.camera.y = Math.max(minimumTop - initialTop, Math.min(maximumTop - initialTop, this.camera.y));
      return { width, height, columns, rows, centerX: width / 2 + this.camera.x,
        top: initialTop + this.camera.y,
        bottom: initialTop + boardHeight + this.camera.y, halfWidth: boardWidth / 2, topScale: .94 };
    }
    return {
      width, height, columns, rows,
      centerX: width / 2,
      top: framingTop + framingHeight * (framingHeight < 280 ? .03 : .12),
      bottom: framingTop + framingHeight * (framingHeight < 280 ? .97 : .90),
      halfWidth: width * 0.435,
      topScale: 0.90
    };
  }

  boardPoint(metrics, gridX, gridY) {
    const depth = gridY / metrics.rows;
    const scale = metrics.topScale + (1 - metrics.topScale) * depth;
    return {
      x: metrics.centerX + (gridX / metrics.columns - 0.5) * metrics.halfWidth * 2 * scale,
      y: metrics.top + (metrics.bottom - metrics.top) * depth
    };
  }

  cellPoints(metrics, x, y) {
    return [
      this.boardPoint(metrics, x, y), this.boardPoint(metrics, x + 1, y),
      this.boardPoint(metrics, x + 1, y + 1), this.boardPoint(metrics, x, y + 1)
    ];
  }

  cellGeometry(metrics, x, y) {
    const points = this.cellPoints(metrics, x, y);
    const center = points.reduce((sum, point) => ({ x: sum.x + point.x / 4, y: sum.y + point.y / 4 }), { x: 0, y: 0 });
    const width = (Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
      + Math.hypot(points[2].x - points[3].x, points[2].y - points[3].y)) / 2;
    const height = (Math.hypot(points[3].x - points[0].x, points[3].y - points[0].y)
      + Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y)) / 2;
    return { points, center, width, height, foot: { x: (points[2].x + points[3].x) / 2, y: (points[2].y + points[3].y) / 2 } };
  }

  draw(state, options = {}) {
    if (!state || !this.context) return;
    if (this.state !== state) {
      this.finishMovement();
      this.finishAction();
      this.facings.clear();
      this.camera = { x: 0, y: 0 };
    }
    this.state = state;
    this.options = options;
    this.effects.warmBattleAudio(state);
    this.requestPaint();
  }

  pan(dx, dy) {
    this.camera.x += dx; this.camera.y += dy;
    this.paint();
  }

  focusCell(x, y) {
    if (!isTacticalMatch(this.state)) return;
    const rect = this.canvas.getBoundingClientRect();
    const metrics = this.boardMetrics(rect.width, rect.height);
    const point = this.cellGeometry(metrics, x, y).center;
    this.pan(rect.width / 2 - point.x, rect.height / 2 + 18 - point.y);
  }

  drawOverview(canvas) {
    if (!canvas || !isTacticalMatch(this.state)) return;
    const ctx = canvas.getContext('2d'), board = boardOf(this.state);
    const w = canvas.width / board.columns, h = canvas.height / board.rows;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#14212a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.columns; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#223e47' : '#2c4b53';
      ctx.fillRect(x * w + 1, y * h + 1, w - 2, h - 2);
    }
    for (const tile of board.tiles ?? []) {
      ctx.fillStyle = tile.type === 'wall' ? '#889799' : tile.type === 'rough' ? '#927a55' : '#e3bf66';
      ctx.fillRect(tile.x * w + 2, tile.y * h + 2, w - 4, h - 4);
      if (tile.type === 'wall') { ctx.strokeStyle = '#c6d1cf'; ctx.lineWidth = 2; ctx.strokeRect(tile.x*w+4,tile.y*h+4,w-8,h-8); }
      if (tile.type === 'rough') { ctx.strokeStyle = '#cfb884'; ctx.beginPath(); ctx.moveTo(tile.x*w+3,(tile.y+1)*h-4);ctx.lineTo((tile.x+1)*w-3,tile.y*h+4);ctx.stroke(); }
    }
    for (const unit of this.state.units) {
      const x = (unit.x + .5)*w, y = (unit.y + .5)*h, r = Math.max(3,Math.min(w,h)*.33);
      ctx.fillStyle = colorForUnit(unit); ctx.strokeStyle = '#f1efdc'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (getCard(unit.cardId)?.type === 'general') { ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath(); }
      else ctx.arc(x,y,r*.65,0,Math.PI*2);
      ctx.fill(); ctx.stroke();
    }
    const rect = this.canvas.getBoundingClientRect(), metrics = this.boardMetrics(rect.width, rect.height);
    const left = (0 - metrics.centerX + metrics.halfWidth) / (metrics.halfWidth * 2) * canvas.width;
    const top = -metrics.top / (metrics.bottom - metrics.top) * canvas.height;
    const right = Math.min(canvas.width - 1, left + rect.width / (metrics.halfWidth * 2) * canvas.width);
    const bottom = Math.min(canvas.height - 1, top + rect.height / (metrics.bottom - metrics.top) * canvas.height);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(Math.max(1,left), Math.max(1,top), Math.max(0,right-Math.max(1,left)), Math.max(0,bottom-Math.max(1,top)));
  }

  animateMovement(unitId, path) {
    this.finishMovement();
    if (path.length < 2) {
      this.paint();
      return Promise.resolve();
    }
    const unit = this.state?.units.find((entry) => entry.unitId === unitId);
    const card = unit && getCard(unit.cardId);
    // Several original general bodies reuse an impact/death cue for walk.
    // Use the existing running cue for heroes, independently of motion settings.
    this.effects.playSound(card?.type === 'general' ? 'resources/sfx/sfx_unit_run_charge_4.m4a'
      : EFFECT_MANIFEST.bodies?.[unit?.cardId]?.sounds?.walk);
    if (this.motionPreference.matches) {
      this.paint();
      return Promise.resolve();
    }
    const run = card?.sprite && this.atlases.get(card.sprite.sheet)?.animations.run;
    const cycleMs = (run?.frames.length || 6) * (run?.frameMs || 80);
    let resolve;
    const completed = new Promise((done) => { resolve = done; });
    this.movement = {
      unitId, path: path.map((point) => ({ ...point })), startedAt: performance.now(),
      duration: battleDelay((path.length - 1 + .8) * cycleMs), resolve
    };
    this.paint();
    this.scheduleAnimation();
    return completed;
  }

  finishMovement() {
    const movement = this.movement;
    if (!movement) return;
    this.movement = null;
    movement.resolve();
  }

  animateSummon(unitId) {
    const unit = this.state?.units.find((entry) => entry.unitId === unitId);
    return this.animateAction({ kind: 'summon', unitId, sourceId: unitId, cardId: unit?.cardId }, []);
  }

  animateAction(action, beforeUnits = []) {
    const completed = this.effects.play(action, beforeUnits);
    if (this.motionPreference.matches) this.onVisualFrame?.(this.state?.units ?? []);
    return completed;
  }

  finishAction() {
    this.effects.finish();
    this.onVisualFrame?.(this.state?.units ?? []);
    this.clearEffectLayers();
  }

  sampleMovement(now = performance.now()) {
    const movement = this.movement;
    if (!movement) return null;
    const elapsed = now - movement.startedAt;
    if (elapsed >= movement.duration) {
      this.finishMovement();
      return null;
    }
    const progress = Math.min(movement.path.length - 1, elapsed / movement.duration * (movement.path.length - 1));
    const index = Math.min(movement.path.length - 2, Math.floor(progress));
    const start = movement.path[index], end = movement.path[index + 1], fraction = progress - index;
    if (end.x !== start.x) this.facings.set(movement.unitId, end.x < start.x);
    return {
      unitId: movement.unitId, elapsed: battleElapsed(now, movement.startedAt),
      x: start.x + (end.x - start.x) * fraction,
      y: start.y + (end.y - start.y) * fraction
    };
  }

  paint() {
    const state = this.state, options = this.options;
    this.cardTargetingActive = false;
    if (!this.context) return;
    const rawRect = this.canvas.getBoundingClientRect();
    const backFX = this.prepareEffectContext(this.backCanvas, this.backContext, rawRect);
    const frontFX = this.prepareEffectContext(this.frontCanvas, this.frontContext, rawRect);
    if (!state || !rawRect.width || !rawRect.height) return;
    this.resize();
    const ctx = this.context;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width, height = rect.height;
    const metrics = this.boardMetrics(width, height);
    const playback = this.sampleMovement();
    const observed = options.observedUnitId != null;
    const movingUnit = !playback && !this.effects.playback ? state.units.find((unit) => unit.unitId === (observed ? options.observedUnitId : options.selectedUnitId)) ?? null : null;
    this.rangePreviewCache ??= new RangePreviewCache();
    const ranges = this.rangePreviewCache.get(state, movingUnit, observed);
    const { movement, attacks } = ranges;
    this.rangePreview = ranges;
    this.selectedAttackCoverageId = movingUnit?.unitId ?? null;
    const targetingOptions = this.effects.playback || playback ? {} : options;
    const selectedSpell = targetingOptions.selectedCardId ? getBattleCard(state, targetingOptions.selectedCardId, state.currentPlayer) : null;
    const deploy = targetingOptions.commandTargets?.type === 'cell' ? targetingOptions.commandTargets.cells
      : selectedSpell?.type === 'unit' ? summonPositions(state, state.currentPlayer, targetingOptions.selectedCardId)
      : ['cell', 'occupiedCell', 'areaCell'].includes(selectedSpell?.target) ? spellPositions(state, selectedSpell) : [];
    const targets = targetingOptions.commandTargets ? state.units.filter((unit) => targetingOptions.commandTargets.unitIds.includes(unit.unitId))
      : selectedSpell?.type === 'spell' ? spellTargets(state, selectedSpell) : [];

    ctx.clearRect(0, 0, width, height);
    this.drawBoardFloor(ctx, metrics, width, height, state.mode);
    const marks = new Set(bossMarks(state).map(cell => `${cell.x},${cell.y}`));

    for (let y = 0; y < metrics.rows; y++) {
      for (let x = 0; x < metrics.columns; x++) {
        const cell = this.cellGeometry(metrics, x, y);
        // Trials end as soon as their single turn ends, so their copied legacy mana
        // tiles can never award mana. Keep the wells visible only in legacy matches.
        const isMana = state.mode === 'local-ai' && MANA_TILES.some((tile) => tile.x === x && tile.y === y);
        const terrain = state.board?.tiles?.find((tile) => tile.x === x && tile.y === y);
        const occupied = occupiedUnit(state, x, y);
        const isTarget = targets.some((unit) => unit.x === x && unit.y === y);

        if (isMana && !occupied) this.drawManaRune(ctx, cell.center.x, cell.center.y, cell.width * .19);
        if (terrain) this.drawTerrain(ctx, cell, terrain, occupied);
        if (state.creepCells?.[`${x},${y}`] != null) this.drawCreep(ctx, cell, state.creepCells[`${x},${y}`]);
        if (marks.has(`${x},${y}`)) this.drawBossMark(ctx, cell);
        if (isTarget) drawTexturedQuad(ctx, this.images.get('tile-spell'), cell.points, .34);
      }
    }

    drawAttackGround(this, ctx, metrics, movement, attacks, targetingOptions.attackPreview, targetingOptions.attackGesture, drawTexturedQuad);
    const softCellTargets = selectedSpell?.target === 'areaCell' || options.cardFollowupActive && options.commandTargets?.type === 'cell';
    if (softCellTargets) for (const cell of deploy) this.drawSoftCell(ctx, metrics, cell, .25);
    else this.drawMergedRegion(ctx, metrics, deploy, [], '#f0f0f0');
    const legalCardTarget = selectedSpell?.type === 'unit' || ['cell', 'occupiedCell', 'areaCell'].includes(selectedSpell?.target) || options.commandTargets?.type === 'cell'
      ? deploy.find((position) => position.x === options.cardPreviewPosition?.x && position.y === options.cardPreviewPosition?.y)
      : targets.find((position) => position.x === options.cardPreviewPosition?.x && position.y === options.cardPreviewPosition?.y);
    this.cardTargetingActive = Boolean(legalCardTarget && options.cardSourcePoint && frontFX);
    if (legalCardTarget) {
      // Show the actual clipped footprint while aiming a 2x2 spell.
      if (selectedSpell?.target === 'areaCell') {
        for (const dx of [0, 1]) for (const dy of [0, 1]) {
          const x = legalCardTarget.x + dx, y = legalCardTarget.y + dy;
          if (x >= metrics.columns || y >= metrics.rows) continue;
          this.drawSoftCell(ctx, metrics, { x, y }, .72);
        }
      }
      if (softCellTargets && selectedSpell?.target !== 'areaCell') this.drawSoftCell(ctx, metrics, legalCardTarget, .75);
      if (!softCellTargets) {
      const cell = this.cellGeometry(metrics, legalCardTarget.x, legalCardTarget.y);
      drawTexturedQuad(ctx, this.tintedTile('tile-hover', '#ffd900'), cell.points, 200 / 255);
      // Player._showPulsingScaleTile: 0.85 to 1 at PULSE_MEDIUM_DURATION (0.7s).
      const scale = this.motionPreference.matches ? 1 : .925 + Math.cos(performance.now() / 700 * Math.PI * 2) * .075;
      const vertices = cell.points.map((point) => ({
        x: cell.center.x + (point.x - cell.center.x) * scale,
        y: cell.center.y + (point.y - cell.center.y) * scale
      }));
      const targetTile = selectedSpell?.type === 'spell'
        ? this.tintedTile('tile-spell', '#ffffff') : this.images.get('tile-spawn');
      drawTexturedQuad(ctx, targetTile, vertices, 200 / 255);
      }
    }
    if (movingUnit) this.drawSelectionBox(ctx, metrics, movingUnit);

    this.effects.draw(backFX ?? ctx, metrics, performance.now(), 'back');
    const displayUnits = this.effects.displayUnits();
    const visualState = displayUnits === state.units ? state : { ...state, units: displayUnits };
    this.onVisualFrame?.(displayUnits);
    const orderedUnits = displayUnits.map((unit) => unit.unitId === playback?.unitId
      ? { ...unit, x: playback.x, y: playback.y } : unit).sort((a, b) => a.y - b.y || a.x - b.x);
    const unitOptions = { ...options, selectedUnitId: movingUnit?.unitId, attackableUnitIds: attacks.map(target => target.unitId) };
    for (const unit of orderedUnits) this.drawUnit(ctx, visualState, unit, metrics, unitOptions, playback);
    this.effects.draw(frontFX ?? ctx, metrics, performance.now(), 'front');
    if ((options.handDragging ? options.handDragPointer : legalCardTarget) && options.cardSourcePoint && frontFX) {
      this.drawCardTargetPath(frontFX, metrics,
        { x: options.cardSourcePoint.x - rect.left, y: options.cardSourcePoint.y - rect.top },
        legalCardTarget ? this.cellGeometry(metrics, legalCardTarget.x, legalCardTarget.y).center : { x:options.handDragPointer.x-rect.left, y:options.handDragPointer.y-rect.top },
        Boolean(legalCardTarget));
    }
    const path = this.effects.playback ? null : this.movement?.path ?? options.movementPreview?.path;
    if (path?.length > 1) this.drawMovementPath(ctx, metrics, path);
    const attackTarget = attacks.find((target) => target.unitId === options.hoveredUnitId);
    drawAttackTargets(this, frontFX ?? ctx, metrics, attacks, targetingOptions.attackGesture);
    if (!observed && (targetingOptions.attackGesture || movingUnit && attackTarget)) drawAttackGesture(this, frontFX ?? ctx, metrics, targetingOptions.attackGesture, movingUnit, attackTarget);
    // Stats are a final foreground pass, as in the original EntityNode support
    // overlay. This keeps them above front FX while retaining action snapshots,
    // movement interpolation, death fades, and their per-unit opacity.
    const statsContext = frontFX ?? ctx;
    statsContext.save();
    if (isTacticalMatch(state)) { statsContext.beginPath(); statsContext.rect(0, 0, width, height); statsContext.clip(); }
    for (const unit of orderedUnits) this.drawUnitStats(statsContext, visualState, unit, metrics);
    if (state.boss) { this.drawBossArmor(statsContext, visualState, metrics); this.drawBossMarkBadges(statsContext, visualState, metrics); }
    statsContext.restore();
    this.attackPreviewLayout = [];
    drawAttackResults(this, statsContext, metrics, targetingOptions.attackPreview, targetingOptions.attackGesture);
  }

  drawBoardFloor(ctx, metrics, width, height, mode) {
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const key = [width,height,ratio,metrics.columns,metrics.rows,metrics.centerX,metrics.top,metrics.bottom,metrics.halfWidth,metrics.topScale,mode,this.images.size].join(':');
    if (this.boardFloor?.key !== key) {
      const canvas = document.createElement('canvas'); canvas.width = Math.round(width*ratio);canvas.height = Math.round(height*ratio);
      const ctx = canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);
    const board = [this.boardPoint(metrics, 0, 0), this.boardPoint(metrics, metrics.columns, 0),
      this.boardPoint(metrics, metrics.columns, metrics.rows), this.boardPoint(metrics, 0, metrics.rows)];
    ctx.beginPath();
    ctx.moveTo(board[0].x, board[0].y);
    for (const point of board.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(38, 24, 19, .06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 240, 216, .12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

      for (let y=0;y<metrics.rows;y++) for(let x=0;x<metrics.columns;x++) {
        const cell=this.cellGeometry(metrics,x,y);
        const isMana=mode==='local-ai' && MANA_TILES.some(tile=>tile.x===x&&tile.y===y);
        ctx.beginPath();
        ctx.moveTo(cell.points[0].x, cell.points[0].y);
        for (const point of cell.points.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.closePath();
        ctx.fillStyle = isMana ? 'rgba(24, 85, 91, .08)' : 'rgba(64, 34, 24, .035)';
        ctx.fill();
        ctx.strokeStyle = isMana ? 'rgba(134, 239, 244, .25)' : 'rgba(255, 241, 213, .16)';
        ctx.lineWidth = Math.max(1, cell.width * .012);
        ctx.stroke();

        const boardTexture = this.images.get('tile-board');
        if (boardTexture) drawTexturedQuad(ctx, boardTexture, cell.points, isMana ? .18 : .12);

      }
      this.boardFloor={key,canvas};
    }
    ctx.drawImage(this.boardFloor.canvas,0,0,width,height);
  }

  drawTerrain(ctx, cell, tile, occupied) {
    ctx.save();
    if (tile.type === 'wall') {
      // Standing scenery has its own perspective. Warping it onto the ground
      // quad flattens the front face and makes a solid obstacle look walkable.
      const image = this.images.get('terrain-wall');
      const width = cell.width * .9;
      const height = image ? Math.min(cell.height * .74, width * image.naturalHeight / image.naturalWidth) : cell.height * .64;
      const bottom = cell.center.y + cell.height * .31;
      ctx.fillStyle = 'rgba(24, 20, 18, .32)';
      ctx.beginPath();
      ctx.ellipse(cell.center.x, bottom - cell.height * .07, width * .48, cell.height * .13, 0, 0, Math.PI * 2);
      ctx.fill();
      if (image) ctx.drawImage(image, cell.center.x - width / 2, bottom - height, width, height);
      else {
        ctx.fillStyle = '#817563';
        roundRect(ctx, cell.center.x - width / 2, bottom - height, width, height, 4);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    if (tile.type === 'rough' && this.images.get('terrain-rough')) {
      // Debris stays flat and traversable; the low ground projection prevents
      // the larger source stones from acquiring the silhouette of a wall.
      const points = cell.points.map(point => ({
        x: cell.center.x + (point.x - cell.center.x) * .88,
        y: cell.center.y + (point.y - cell.center.y) * .68
      }));
      drawTexturedQuad(ctx, this.images.get('terrain-rough'), points);
      ctx.restore();
      return;
    }
    ctx.beginPath(); cell.points.forEach((p, i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath();
    ctx.fillStyle = tile.type === 'rough' ? 'rgba(136,105,63,.38)' : 'rgba(42,145,158,.35)';
    ctx.fill();
    if (tile.type === 'outpost') {
      drawTexturedQuad(ctx, this.images.get('tile-mana'), cell.points, .7);
      if (!occupied) this.drawManaRune(ctx, cell.center.x, cell.center.y, cell.width * .2);
    } else {
      ctx.strokeStyle = 'rgba(229,202,148,.6)'; ctx.lineWidth=2;
      for (let i=-1;i<=1;i++) { ctx.beginPath();ctx.moveTo(cell.center.x+i*cell.width*.18-4,cell.center.y+3);ctx.lineTo(cell.center.x+i*cell.width*.18+4,cell.center.y-4);ctx.stroke(); }
    }
    ctx.restore();
  }

  // Telegraphed boss intent: a frosted cell that resolves on the boss's next turn.
  drawBossMark(ctx, cell) {
    const pulse = this.motionPreference.matches ? .5 : .5 + Math.sin(performance.now() / 260) * .5;
    ctx.save();
    ctx.beginPath(); cell.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    ctx.fillStyle = `rgba(120,210,255,${.34 + pulse * .2})`; ctx.fill();
    ctx.strokeStyle = '#dff6ff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }

  // Drawn with the stats pass so units standing on a mark never hide the warning.
  drawBossMarkBadges(ctx, state, metrics) {
    for (const mark of bossMarks(state)) {
      const cell = this.cellGeometry(metrics, mark.x, mark.y), r = Math.max(13, cell.width * .17);
      const x = cell.center.x - cell.width * .3, y = cell.center.y - cell.height * .95;
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(16,52,86,.94)'; ctx.fill(); ctx.strokeStyle = '#8fdcff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = '#eafaff'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * r * .62, y - Math.sin(a) * r * .62); ctx.lineTo(x + Math.cos(a) * r * .62, y + Math.sin(a) * r * .62); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0d2840'; ctx.lineWidth = 3.5; ctx.font = `800 ${Math.round(r * 1.05)}px "Luxiang UI", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeText('3', x + r * .95, y + r * .55); ctx.fillText('3', x + r * .95, y + r * .55);
      ctx.restore();
    }
  }

  drawBossArmor(ctx, state, metrics) {
    const boss = findGeneral(state, state.boss.owner);
    if (!boss || !bossArmored(state, { general: owner => findGeneral(state, owner) })) return;
    const cell = this.cellGeometry(metrics, boss.x, boss.y), size = Math.max(18, cell.width * .26);
    const x = cell.center.x + cell.width * .34, y = cell.center.y - cell.height * 1.15;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x, y - size * .55); ctx.lineTo(x + size * .45, y - size * .35); ctx.lineTo(x + size * .38, y + size * .2);
    ctx.lineTo(x, y + size * .55); ctx.lineTo(x - size * .38, y + size * .2); ctx.lineTo(x - size * .45, y - size * .35); ctx.closePath();
    ctx.fillStyle = 'rgba(120,205,255,.92)'; ctx.fill(); ctx.strokeStyle = '#f2fbff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#0d2840'; ctx.font = `700 ${Math.round(size * .5)}px "Luxiang UI", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('1', x, y + 1);
    ctx.restore();
  }

  drawCreep(ctx, cell, owner) {
    const atlas = this.effects.atlases.get('fxShadowCreepIdle');
    if (!atlas) return;
    const frames = this.effects.atlasFrames(atlas, atlas.prefix);
    const index = this.motionPreference.matches ? 0 : Math.floor(performance.now() / atlas.frameMs) % frames.length;
    const frame = frames[index];
    if (!frame) return;
    const logicalWidth = frame.canvasWidth || frame.sourceWidth || frame.width;
    drawAtlasFrame(ctx, atlas.image, frame, cell.center.x, cell.center.y, {
      scaleX: cell.width * 1.1 / logicalWidth, scaleY: cell.height * 1.35 / (frame.canvasHeight || frame.sourceHeight || frame.height), alpha: .85
    });
    ctx.save(); ctx.strokeStyle = colorForUnit({owner}); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cell.points[3].x,cell.points[3].y);ctx.lineTo(cell.points[2].x,cell.points[2].y);ctx.stroke();ctx.restore();
  }

  requestPaint() {
    // Several input/HUD updates can commit in one task; paint their final options once.
    this.paintRequested = true;
    this.scheduleAnimation();
  }

  scheduleAnimation() {
    if (this.pending !== null || !this.state || (!this.paintRequested && (this.motionPreference.matches || (['mulligan', 'over'].includes(this.state.phase) && !this.effects.playback)))) return;
    this.pending = requestAnimationFrame((now) => {
      this.pending = null;
      const currentBounds = this.canvas.getBoundingClientRect();
      if (currentBounds.width && currentBounds.height && this.state && (this.paintRequested || !['mulligan', 'over'].includes(this.state.phase) || this.effects.playback)) {
        if (this.paintRequested || this.movement || this.effects.playback || this.cardTargetingActive || now - this.lastFrame >= SCENE_ANIMATION_FRAME_MS) {
          this.paintRequested = false;
          this.lastFrame = now;
          this.paint();
        }
        this.scheduleAnimation();
      }
    });
  }

  tintedTile(key, color, rotation = 0, flippedY = false) {
    const image = this.images.get(key);
    if (!image) return null;
    const cacheKey = `${key}:${color}:${rotation}:${flippedY}`;
    if (this.tintedTiles.has(cacheKey)) return this.tintedTiles.get(cacheKey);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(rotation * Math.PI / 180);
    if (flippedY) context.scale(1, -1);
    context.drawImage(image, -canvas.width / 2, -canvas.height / 2);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    this.tintedTiles.set(cacheKey, canvas);
    return canvas;
  }

  drawSoftCell(ctx, metrics, position, opacity) {
    const cell = this.cellGeometry(metrics, position.x, position.y);
    ctx.save(); ctx.beginPath();
    cell.points.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath(); ctx.clip();
    const glow = ctx.createRadialGradient(cell.center.x, cell.center.y, 0, cell.center.x, cell.center.y, cell.width * .65);
    glow.addColorStop(0, `rgba(109, 207, 255, ${opacity})`);
    glow.addColorStop(.65, `rgba(93, 191, 248, ${opacity * .53})`);
    glow.addColorStop(1, 'rgba(93, 191, 248, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cell.center.x - cell.width, cell.center.y - cell.width, cell.width * 2, cell.width * 2);
    ctx.restore();
  }

  drawMergedRegion(ctx, metrics, positions, alternatePositions, color, alpha = .78) {
    const region = new Set(positions.map((position) => `${position.x},${position.y}`));
    const alternate = new Set(alternatePositions.map((position) => `${position.x},${position.y}`));
    const has = (x, y) => region.has(`${x},${y}`);
    const alt = (x, y) => alternate.has(`${x},${y}`);
    for (const { x, y } of positions) {
      const cell = this.cellGeometry(metrics, x, y);
      const [tl, tr, br, bl] = cell.points;
      const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const top = midpoint(tl, tr), right = midpoint(tr, br), bottom = midpoint(bl, br), left = midpoint(tl, bl);
      const corners = [
        { quad: [tl, top, cell.center, left], edges: [[x - 1, y], [x, y - 1]], diagonal: [x - 1, y - 1] },
        { quad: [top, tr, right, cell.center], edges: [[x, y - 1], [x + 1, y]], diagonal: [x + 1, y - 1] },
        { quad: [cell.center, right, br, bottom], edges: [[x + 1, y], [x, y + 1]], diagonal: [x + 1, y + 1] },
        { quad: [left, cell.center, bottom, bl], edges: [[x, y + 1], [x - 1, y]], diagonal: [x - 1, y + 1] }
      ];
      for (const [index, corner] of corners.entries()) {
        const first = has(...corner.edges[0]), second = has(...corner.edges[1]);
        const diagonal = first && second && has(...corner.diagonal);
        let variant = first && second ? diagonal ? '0123' : '013' : first ? '01' : second ? '03' : '0';
        if (variant === '0' && (alt(...corner.edges[0]) || alt(...corner.edges[1]) || alt(...corner.diagonal))) variant = '0_seam';
        const image = this.tintedTile(`tile-merged-${variant}`, color, index * 90);
        if (image) drawTexturedQuad(ctx, image, corner.quad, alpha);
      }
    }
  }

  drawSelectionBox(ctx, metrics, unit) {
    const cell = this.cellGeometry(metrics, unit.x, unit.y);
    const pulse = this.motionPreference.matches ? 1 : .95 + Math.cos(performance.now()/700*Math.PI*2)*.05;
    ctx.save(); ctx.translate(cell.center.x,cell.center.y+cell.height*.12); ctx.scale(1,.44);
    const halo = ctx.createRadialGradient(0,0,cell.width*.14,0,0,cell.width*.48*pulse);
    const rgb = unit.owner === 0 ? '134,231,255' : '255,146,119';
    halo.addColorStop(0,`rgba(${rgb},.06)`); halo.addColorStop(.5,`rgba(${rgb},.64)`); halo.addColorStop(1,`rgba(${rgb},0)`);
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,cell.width*.48*pulse,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  drawAttackPath(ctx, metrics, source, target) {
    const image = this.images.get('tile-path-attack');
    if (!image) return;
    const start = this.cellGeometry(metrics, source.x, source.y).center;
    const end = this.cellGeometry(metrics, target.x, target.y).center;
    const dx = end.x - start.x, dy = end.y - start.y, distance = Math.hypot(dx, dy);
    if (!distance) return;
    const cell = this.cellGeometry(metrics, source.x, source.y);
    const spacing = cell.width * .4;
    const phase = this.motionPreference.matches ? 0 : (performance.now() / 1500 * cell.width) % spacing;
    for (let offset = phase + spacing * .5; offset < distance; offset += spacing) {
      const progress = offset / distance;
      const arc = Math.sin(progress * Math.PI) * cell.height * .34;
      ctx.save();
      ctx.globalAlpha = .78 * Math.min(1, offset / (spacing * .65), (distance - offset) / (spacing * .65));
      ctx.translate(start.x + dx * progress, start.y + dy * progress - arc);
      ctx.rotate(Math.atan2(dy - cell.height * .34 * Math.cos(progress * Math.PI), dx));
      ctx.drawImage(image, -spacing / 2, -spacing * image.naturalHeight / image.naturalWidth / 2,
        spacing, spacing * image.naturalHeight / image.naturalWidth);
      ctx.restore();
    }
  }

  drawCardTargetPath(ctx, metrics, start, end, legal = true) {
    const image = this.tintedTile('tile-path-attack', legal ? '#ffffff' : '#c95353');
    if (!image) return;
    const dx = end.x - start.x, dy = end.y - start.y, distance = Math.hypot(dx, dy);
    if (!distance) return;
    const cell = this.cellGeometry(metrics, 0, 0);
    const spacing = cell.width * .4;
    const fadeDistance = cell.width * (40 / 95);
    const arcDistance = cell.width * .5;
    const phase = this.motionPreference.matches ? 0 : (performance.now() / 1500 * cell.width) % spacing;
    for (let offset = phase + spacing * .5; offset < distance; offset += spacing) {
      const progress = offset / distance;
      const arc = Math.sin(progress * Math.PI) * arcDistance;
      ctx.save();
      ctx.globalAlpha = .78 * Math.min(1, offset / fadeDistance, (distance - offset) / fadeDistance);
      ctx.translate(start.x + dx * progress, start.y + dy * progress - arc);
      ctx.rotate(Math.atan2(dy - arcDistance * Math.cos(progress * Math.PI), dx));
      ctx.drawImage(image, -spacing / 2, -spacing * image.height / image.width / 2,
        spacing, spacing * image.height / image.width);
      ctx.restore();
    }
  }

  drawMovementPath(ctx, metrics, path) {
    for (let index = 0; index < path.length; index++) {
      const point = path[index], previous = path[index - 1], next = path[index + 1];
      const incoming = previous && { x: point.x - previous.x, y: point.y - previous.y };
      const outgoing = next && { x: next.x - point.x, y: next.y - point.y };
      const direction = outgoing ?? incoming;
      let part, flippedY = false, rotation = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
      if (!previous) part = 'start';
      else if (!next) part = index === 1 ? 'end_from_start' : 'end';
      else if (incoming.x !== outgoing.x || incoming.y !== outgoing.y) {
        part = index === 1 ? 'corner_from_start' : 'corner';
        rotation = Math.atan2(incoming.y, incoming.x) * 180 / Math.PI;
        flippedY = incoming.x * outgoing.y - incoming.y * outgoing.x < 0;
      } else part = index === 1 ? 'straight_from_start' : 'straight';
      const image = this.tintedTile(`tile-path-move-${part}`, '#ffffff', rotation, flippedY);
      if (image) drawTexturedQuad(ctx, image, this.cellPoints(metrics, point.x, point.y), .78);
    }
  }

  drawManaRune(ctx, x, y, radius) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(7, 26, 37, .72)';
    ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.2, radius * 0.72, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(69, 216, 236, .9)';
    ctx.lineWidth = Math.max(1, radius * 0.11);
    ctx.beginPath(); ctx.ellipse(0, 0, radius * 0.88, radius * 0.53, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#a9f5ff';
    ctx.font = `bold ${radius * 1.2}px Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✦', 0, -1);
    ctx.restore();
  }

  getSpriteArt(card) {
    if (!card?.sprite) return null;
    if (this.cardArt.has(card.id)) return this.cardArt.get(card.id);
    const atlas = card?.sprite ? this.atlases.get(card.sprite.sheet) : null;
    const frames = atlas?.animations.breathing?.frames.length
      ? atlas.animations.breathing.frames
      : atlas?.animations.idle.frames ?? [];
    if (!atlas?.image || !frames.length) return null;
    const frame = frames[0];
    const crop = document.createElement('canvas');
    crop.width = frame.rotated ? frame.height : frame.width;
    crop.height = frame.rotated ? frame.width : frame.height;
    const cropContext = crop.getContext('2d', { willReadFrequently: true });
    if (frame.rotated) {
      cropContext.translate(0, crop.height);
      cropContext.rotate(-Math.PI / 2);
    }
    // Frame coordinates are top-left PNG coordinates, including transparent margins.
    cropContext.drawImage(atlas.image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
    const pixels = cropContext.getImageData(0, 0, crop.width, crop.height).data;
    let left = crop.width, top = crop.height, right = -1, bottom = -1;
    for (let y = 0; y < crop.height; y++) {
      for (let x = 0; x < crop.width; x++) {
        if (pixels[(y * crop.width + x) * 4 + 3] < 16) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    const art = right < left ? { image: crop, x: 0, y: 0, width: crop.width, height: crop.height }
      : { image: crop, x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
    this.cardArt.set(card.id, art);
    return art;
  }

  drawCardArt(canvas, cardId) {
    this.cardIdleFrames.delete(canvas);
    const context = canvas.getContext('2d');
    if (!context) return;
    const card = getCard(cardId);
    this.assets.requestCanvas(canvas, cardId);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (card?.type === 'spell' && this.images.get(`spell-${card.effect}`)) {
      const icon = this.images.get(`spell-${card.effect}`);
      const size = Math.min(canvas.width * .7, canvas.height * .86);
      context.imageSmoothingEnabled = false;
      context.drawImage(icon, (canvas.width - size) / 2, (canvas.height - size) / 2, size, size);
      return;
    }
    const art = this.getSpriteArt(card);
    if (!art) {
      context.fillStyle = card?.type === 'spell' ? '#dbcaee' : '#e7d288';
      context.font = '36px Georgia, serif';
      context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(card?.type === 'spell' ? '✦' : '♜', canvas.width / 2, canvas.height / 2);
      return;
    }
    const scale = Math.min(canvas.width * .88 / art.width, canvas.height * .91 / art.height);
    const drawWidth = art.width * scale, drawHeight = art.height * scale;
    context.imageSmoothingEnabled = false;
    context.drawImage(art.image, art.x, art.y, art.width, art.height,
      (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
  }

  cardIdleLayout(card, atlas, frames) {
    if (this.cardIdleLayouts.has(card.id)) return this.cardIdleLayouts.get(card.id);
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const frame of frames) {
      const width = Math.max(1, Math.ceil(frame.canvasWidth || frame.sourceWidth || (frame.rotated ? frame.height : frame.width)));
      const height = Math.max(1, Math.ceil(frame.canvasHeight || frame.sourceHeight || (frame.rotated ? frame.width : frame.height)));
      const sample = document.createElement('canvas');
      sample.width = width; sample.height = height;
      const sampleContext = sample.getContext('2d', { willReadFrequently: true });
      if (!sampleContext) continue;
      drawAtlasFrame(sampleContext, atlas.image, frame, width / 2, height / 2);
      const pixels = sampleContext.getImageData(0, 0, width, height).data;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (pixels[(y * width + x) * 4 + 3] < 16) continue;
          left = Math.min(left, x - width / 2);
          top = Math.min(top, y - height / 2);
          right = Math.max(right, x + 1 - width / 2);
          bottom = Math.max(bottom, y + 1 - height / 2);
        }
      }
    }
    const layout = Number.isFinite(left)
      ? { left, top, width: right - left, height: bottom - top }
      : null;
    this.cardIdleLayouts.set(card.id, layout);
    return layout;
  }

  drawCardIdle(canvas, cardId, timeMs) {
    const card = getCard(cardId);
    const atlas = card?.sprite ? this.atlases.get(card.sprite.sheet) : null;
    const animation = atlas?.animations.idle;
    const frames = animation?.frames ?? [];
    const frameMs = animation?.frameMs ?? 0;
    if (card?.type === 'spell' || !atlas?.image || frames.length < 2 || frameMs <= 0) {
      this.drawCardArt(canvas, cardId);
      return 0;
    }
    const layout = this.cardIdleLayout(card, atlas, frames);
    if (!layout?.width || !layout?.height) {
      this.drawCardArt(canvas, cardId);
      return 0;
    }
    const elapsed = Math.max(0, Number(timeMs) || 0);
    const frameIndex = Math.floor(elapsed / frameMs) % frames.length;
    const cached = this.cardIdleFrames.get(canvas);
    if (cached?.cardId === cardId && cached.frameIndex === frameIndex
      && cached.width === canvas.width && cached.height === canvas.height) {
      return frameMs - elapsed % frameMs;
    }
    const context = canvas.getContext('2d');
    if (!context) return 0;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    const scale = Math.min(canvas.width * .88 / layout.width, canvas.height * .91 / layout.height);
    drawAtlasFrame(context, atlas.image, frames[frameIndex],
      canvas.width / 2 - (layout.left + layout.width / 2) * scale,
      canvas.height / 2 - (layout.top + layout.height / 2) * scale,
      { scale });
    this.cardIdleFrames.set(canvas, { cardId, frameIndex, width: canvas.width, height: canvas.height });
    return frameMs - elapsed % frameMs;
  }

  unitRestingAfterAction(unit, playback = null, effectBody = this.effects.bodyState(unit.unitId)) {
    // Combat presentation may still show a before-hit snapshot. Action marks
    // belong to the live unit, while its current body/movement playback wins.
    // The engine's flags include extra action quotas; partial use is still ready.
    const logicalUnit = this.state?.units.find((entry) => entry.unitId === unit.unitId) ?? unit;
    return Boolean(logicalUnit.summonedThisTurn || (logicalUnit.moved && logicalUnit.attacked))
      && playback?.unitId !== unit.unitId && this.movement?.unitId !== unit.unitId && !effectBody;
  }

  drawUnit(ctx, state, unit, metrics, options, playback) {
    const card = getUnitBattleCard(state, unit);
    if (!card) return;
    const cell = this.cellGeometry(metrics, unit.x, unit.y);
    const centerX = cell.center.x;
    const footY = cell.center.y + cell.height * .13;
    const isGeneral = card.type === 'general';
    const color = colorForUnit(unit);
    const isSelected = options.selectedUnitId === unit.unitId;
    const isHovered = options.hoveredUnitId === unit.unitId || (!options.attackGesture?.cancelled && options.attackGesture?.targetId === unit.unitId);
    const isAttackable = options.attackableUnitIds?.includes(unit.unitId);
    const effectBody = this.effects.bodyState(unit.unitId);
    const restingAfterAction = this.unitRestingAfterAction(unit, playback, effectBody);

    ctx.save();
    ctx.globalAlpha *= this.effects.unitOpacity(unit.unitId);

    if (!unit.silenced && card.provoke || unit.provokeBuff) this.effects.drawPersistent(ctx, metrics, unit, 'FX.Modifiers.ModifierProvoke');
    if (!unit.silenced && card.zeal) {
      const general = state.units.find((entry) => entry.owner === unit.owner && getCard(entry.cardId)?.type === 'general');
      if (general && Math.max(Math.abs(general.x - unit.x), Math.abs(general.y - unit.y)) <= 1) {
        this.effects.drawPersistent(ctx, metrics, unit, 'FX.Modifiers.ModifierZealed');
      }
    }

    ctx.save();
    const ringY = footY + cell.height * .015;
    const ringColor = restingAfterAction ? [138, 145, 150]
      : [[54, 204, 239], [234, 91, 106], [188, 137, 243]][unit.owner] ?? [234, 91, 106];
    const ringGlow = ctx.createRadialGradient(centerX, ringY, 1, centerX, ringY, cell.width * .42);
    ringGlow.addColorStop(0, `rgba(${ringColor.join(',')},.34)`);
    ringGlow.addColorStop(.72, `rgba(${ringColor.join(',')},.17)`);
    ringGlow.addColorStop(1, `rgba(${ringColor.join(',')},0)`);
    ctx.fillStyle = ringGlow;
    ctx.beginPath(); ctx.ellipse(centerX, ringY, cell.width * .42, cell.height * .20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(4, 14, 24, .8)';
    ctx.beginPath(); ctx.ellipse(centerX, ringY, cell.width * .32, cell.height * .13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${ringColor.join(',')},.95)`;
    ctx.lineWidth = Math.max(2, cell.width * .022);
    ctx.beginPath(); ctx.ellipse(centerX, ringY, cell.width * .31, cell.height * .12, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(224, 246, 252, .54)';
    ctx.lineWidth = Math.max(1, cell.width * .007);
    ctx.beginPath(); ctx.ellipse(centerX, ringY, cell.width * .25, cell.height * .075, 0, Math.PI * .1, Math.PI * .9); ctx.stroke();
    if (isHovered) {
      ctx.strokeStyle = unit.owner === 0 ? 'rgba(69,224,255,.95)' : 'rgba(255,92,139,.95)';
      ctx.lineWidth = Math.max(2, cell.width * .023);
      ctx.beginPath(); ctx.ellipse(centerX, ringY, cell.width * .37, cell.height * .17, 0, 0, Math.PI * 2); ctx.stroke();
    }

    const atlas = card.sprite ? this.atlases.get(card.sprite.sheet) : null;
    const isWalking = playback?.unitId === unit.unitId;
    const desiredState = effectBody?.state ?? (isWalking ? 'run' : restingAfterAction || isSelected ? 'idle' : 'breathing');
    const animation = atlas?.animations[desiredState] ?? atlas?.animations[desiredState === 'hit' ? 'damage' : desiredState === 'run' ? 'walk' : desiredState] ?? atlas?.animations.idle;
    const frames = animation?.frames.length ? animation.frames : atlas?.animations.idle.frames ?? [];
    if (atlas?.image && frames.length) {
      const frameIndex = this.motionPreference.matches || restingAfterAction ? 0
        : Math.floor((effectBody ? effectBody.elapsed : isWalking ? playback.elapsed : performance.now()) / (animation?.frameMs ?? 120)) % frames.length;
      const frame = frames[frameIndex];
      const scale = this.unitScale(cell, frame, isGeneral);
      const logicalHeight = frame.canvasHeight || frame.sourceHeight || (frame.rotated ? frame.width : frame.height);
      const baseline = this.unitBaseline(card);
      ctx.translate(centerX, ringY);
      ctx.imageSmoothingEnabled = false;
      if (this.facings.get(unit.unitId) ?? unit.owner !== 0) ctx.scale(-1, 1);
      if (isHovered || isAttackable) {
        ctx.shadowColor = unit.owner === 0 ? 'rgba(40,170,255,.98)' : 'rgba(255,65,105,.98)';
        ctx.shadowBlur = cell.width * (isHovered ? .18 : .1);
      }
      drawAtlasFrame(ctx, atlas.image, frame, 0, (logicalHeight / 2 - baseline) * scale, { scale, resting: restingAfterAction });
    } else {
      ctx.fillStyle = restingAfterAction ? '#899096' : color;
      ctx.font = `bold ${Math.round(cell.width * 0.48)}px Georgia, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(isGeneral ? '♜' : '✦', centerX, ringY - cell.height * .52);
    }
    ctx.restore();

    if ((card.provoke || unit.provokeBuff) && !this.effects.staticImages.has('resources/decals/provoke.png')) {
      ctx.save();
      ctx.strokeStyle = 'rgba(242,201,116,.84)';
      ctx.setLineDash([cell.width * .045, cell.width * .026]);
      ctx.lineWidth = Math.max(1, cell.width * .015);
      ctx.beginPath(); ctx.ellipse(centerX, footY, cell.width * .43, cell.height * .2, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  drawUnitStats(ctx, state, unit, metrics) {
    const cell = this.cellGeometry(metrics, unit.x, unit.y);
    const centerX = cell.center.x;
    const footY = cell.center.y + cell.height * .13;
    const logicalUnit = state.units.find((entry) => entry.unitId === unit.unitId) ?? unit;
    const iconSize = Math.max(17, cell.width * .29);
    const spacing = cell.width * .22;
    const suffix = unit.owner === 0 && !this.unitRestingAfterAction(unit) ? '' : '-bw';
    const opacity = this.effects.unitOpacity(unit.unitId);
    ctx.save();
    ctx.globalAlpha *= opacity;
    this.drawStat(ctx, centerX - spacing, footY - cell.height * .11, iconSize,
      effectiveAttack(state, logicalUnit), this.images.get(`stat-attack${suffix}`));
    this.drawStat(ctx, centerX + spacing, footY - cell.height * .11, iconSize,
      Math.max(0, unit.health), this.images.get(`stat-health${suffix}`));
    ctx.restore();
  }

  unitScale(cell, frame, isGeneral) {
    const width = frame.canvasWidth || frame.sourceWidth || (frame.rotated ? frame.height : frame.width);
    const height = frame.canvasHeight || frame.sourceHeight || (frame.rotated ? frame.width : frame.height);
    return Math.min(cell.width * (isGeneral ? 2.15 : 1.95) / width,
      cell.height * (isGeneral ? 3.0 : 2.8) / height);
  }

  unitBaseline(card) {
    if (this.unitBaselines.has(card.id)) return this.unitBaselines.get(card.id);
    const atlas = this.atlases.get(card.sprite?.sheet);
    const reference = atlas?.animations?.breathing?.frames?.[0] ?? atlas?.animations?.idle?.frames?.[0];
    const art = this.getSpriteArt(card);
    if (!reference || !art) return reference?.canvasHeight ?? reference?.height ?? 0;
    const logicalHeight = reference.canvasHeight || reference.sourceHeight || (reference.rotated ? reference.width : reference.height);
    const sourceHeight = reference.rotated ? reference.width : reference.height;
    const placedY = reference.sourceY || (logicalHeight - sourceHeight) / 2 - (reference.offsetY ?? 0);
    const baseline = placedY + art.y + art.height;
    this.unitBaselines.set(card.id, baseline);
    return baseline;
  }

  drawStat(ctx, x, y, size, number, image) {
    ctx.save();
    if (image) ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(12, size * .52)}px "Duelyst Lato", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = Math.max(1, size * .045);
    ctx.fillText(String(number), x, y - size * .025);
    ctx.restore();
  }
}
