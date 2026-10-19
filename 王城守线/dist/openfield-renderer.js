import { OF_MAP, OF_TYPES, ofRoutePreview, ofWaveInfo } from './openfield.js';
import { getBattlefieldView, drawDuelystUnit, frameImage, imageFor, drawFivePointStar } from './renderer.js';

const OF_VISUAL_CLOCKS = new WeakMap();
const OF_PROJECTILE_VISUALS = new WeakMap();
const OF_TOWER_IDS = new Set(['arrowTower', 'mageTower', 'cannonTower', 'barracks']);
const OF_TOWER_SPRITES = Object.freeze({
  arrowTower: 'archer', mageTower: 'mage', cannonTower: 'catapult', barracks: 'guardian'
});
const OF_UNIT_HEIGHTS = Object.freeze({
  guard: 72, sentinel: 78, berserker: 78, archer: 68, ranger: 70, sniper: 72,
  mage: 70, flame: 72, frost: 70, storm: 72, healer: 68, summoner: 76
});

function ofTypeData(entityOrType) {
  const value = entityOrType?.type ?? entityOrType;
  if (value && typeof value === 'object') return value;
  return OF_TYPES[value] ?? null;
}

function ofTypeId(entityOrType) {
  const value = entityOrType?.type ?? entityOrType;
  return typeof value === 'string' ? value : value?.id ?? '';
}

function ofReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function ofVisualTime(game, wallTime, reducedMotion) {
  const now = Number.isFinite(wallTime) ? wallTime : 0;
  let clock = OF_VISUAL_CLOCKS.get(game);
  if (!clock) {
    clock = { wallTime: now, visualTime: 0 };
    OF_VISUAL_CLOCKS.set(game, clock);
  }
  const delta = Math.max(0, Math.min(.1, now - clock.wallTime));
  clock.wallTime = now;
  if (!game?.paused && !reducedMotion) clock.visualTime += delta;
  return reducedMotion ? 0 : clock.visualTime;
}

function ofEllipse(ctx, x, y, rx, ry, fill, stroke = null, width = 1) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function ofGround(ctx, art) {
  const ground = imageFor(art, art?.manifest?.terrain?.field?.base?.path);
  ctx.fillStyle = '#647f45'; ctx.fillRect(0, 0, OF_MAP.width, OF_MAP.height);
  if (ground) {
    try {
      const pattern = ctx.createPattern(ground, 'repeat');
      if (pattern) { ctx.fillStyle = pattern; ctx.fillRect(0, 0, OF_MAP.width, OF_MAP.height); }
    } catch { /* A flat woodland base still renders if a browser rejects the pattern. */ }
  }

  const patches = [
    [170, 170, 145, 82, -.24, '#8c8b58', .22], [430, 390, 170, 92, .16, '#43683d', .22],
    [690, 165, 188, 98, -.08, '#8f8150', .18], [835, 455, 142, 68, .28, '#3f643b', .2],
    [535, 270, 115, 64, .1, '#a0905a', .12]
  ];
  for (const [x, y, rx, ry, rotation, color, alpha] of patches) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = '#203a2b';
  ctx.globalAlpha = .42;
  ctx.fillRect(0, 0, OF_MAP.width, 31); ctx.fillRect(0, OF_MAP.height - 27, OF_MAP.width, 27);
  ctx.fillRect(0, 0, 29, OF_MAP.height); ctx.fillRect(OF_MAP.width - 29, 0, 29, OF_MAP.height);
  ctx.restore();
}

function ofObstacle(ctx, art, obstacle) {
  const fieldDecor = art?.manifest?.terrain?.field?.decorations;
  const path = obstacle.kind === 'tree' ? fieldDecor?.tree : fieldDecor?.rock;
  const texture = imageFor(art, path);
  const radius = Math.max(12, obstacle.radius || (obstacle.kind === 'tree' ? 27 : 20));
  ofEllipse(ctx, obstacle.x, obstacle.y + radius * .25, radius * .88, radius * .34, '#172a1db0');
  if (texture) {
    const size = radius * (obstacle.kind === 'tree' ? 2.45 : 2.15);
    ctx.drawImage(texture, obstacle.x - size / 2, obstacle.y - size * .7, size, size);
  } else if (obstacle.kind === 'tree') {
    ctx.fillStyle = '#59442c'; ctx.fillRect(obstacle.x - 5, obstacle.y - radius, 10, radius * 1.2);
    ofEllipse(ctx, obstacle.x, obstacle.y - radius, radius, radius * .82, '#315838', '#203e29', 2);
  } else ofEllipse(ctx, obstacle.x, obstacle.y - radius * .25, radius, radius * .72, '#747761', '#4a5144', 2);
}

function ofCore(ctx, art, visualTime) {
  const core = OF_MAP.core;
  const spec = art?.manifest?.towers?.guardian?.completed ?? art?.manifest?.towers?.guardian?.idle?.[0];
  ofEllipse(ctx, core.x, core.y + 7, 54, 19, '#14251cab', '#79bba1', 3);
  if (!frameImage(ctx, art, spec, visualTime, core.x - 55, core.y - 157, 110, 204)) {
    ctx.fillStyle = '#756345'; ctx.fillRect(core.x - 35, core.y - 85, 70, 88);
    ctx.fillStyle = '#b49d64'; ctx.fillRect(core.x - 43, core.y - 94, 86, 18);
    ctx.fillStyle = '#27372e'; ctx.fillRect(core.x - 11, core.y - 33, 22, 36);
  }
  ctx.save(); ctx.fillStyle = '#70c9b7'; ctx.strokeStyle = '#173b37'; ctx.lineWidth = 2;
  ctx.fillRect(core.x - 2, core.y - 137, 4, 38);
  ctx.beginPath(); ctx.moveTo(core.x + 2, core.y - 137); ctx.lineTo(core.x + 28, core.y - 128); ctx.lineTo(core.x + 2, core.y - 118); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function ofRange(ctx, game, viewState) {
  const selected = (game?.units ?? []).find(unit => unit.id === viewState?.selectedId);
  if (!selected) return;
  const range = selected.range ?? ofTypeData(selected)?.range;
  if (Number.isFinite(range) && range > 0) {
    ctx.save(); ctx.setLineDash([7, 7]);
    ofEllipse(ctx, selected.x, selected.y, range, range, '#66c9bc14', '#83d7c9a8', 2);
    ctx.restore();
  }
  if (Number.isFinite(selected.homeX) && Number.isFinite(selected.homeY)) {
    ctx.save(); ctx.strokeStyle = '#8fd6c4b8'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(selected.x, selected.y); ctx.lineTo(selected.homeX, selected.homeY); ctx.stroke();
    ofEllipse(ctx, selected.homeX, selected.homeY, 12, 5, '#70c6b333', '#86dfca', 1.5); ctx.restore();
  }
}

function ofRoute(ctx, game, viewState) {
  if (!viewState?.showRoutes || typeof ofRoutePreview !== 'function') return;
  let points;
  try { points = ofRoutePreview(game); } catch { return; }
  if (!Array.isArray(points)) return;
  const routes = points.length && Array.isArray(points[0]?.points) ? points.map(route => route.points) : [points];
  ctx.save(); ctx.strokeStyle = '#e4c87883'; ctx.lineWidth = 3; ctx.setLineDash([8, 10]);
  for (const route of routes) {
    if (route.length < 2) continue;
    ctx.beginPath();
    route.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.stroke();
  }
  ctx.restore();
}

function ofEntranceFlags(ctx, game) {
  if (!['deploy', 'intermission', 'setup', 'prewave', 'ready'].includes(game?.phase)) return;
  let info = null;
  if (typeof ofWaveInfo === 'function') {
    try { info = ofWaveInfo(game); } catch { info = null; }
  }
  const groups = info?.entrances ?? info?.groups ?? [];
  for (const entrance of OF_MAP.entrances ?? []) {
    const group = groups.find(item => item.entrance === entrance.id || item.entranceId === entrance.id || item.id === entrance.id);
    const count = group?.count ?? group?.remaining;
    const dx = OF_MAP.core.x - entrance.x, dy = OF_MAP.core.y - entrance.y;
    const length = Math.hypot(dx, dy) || 1;
    const flagX = entrance.x + dx / length * 24, flagY = entrance.y + dy / length * 24;
    ctx.save(); ctx.translate(flagX, flagY); ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = '#4b2522'; ctx.fillRect(-2, -23, 4, 40);
    ctx.fillStyle = '#b84f45'; ctx.beginPath(); ctx.moveTo(1, -23); ctx.lineTo(25, -15); ctx.lineTo(1, -7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0d99a'; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(20, -5); ctx.lineTo(20, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (Number.isFinite(count)) {
      ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#261d18c9'; ctx.fillRect(flagX - 15, flagY + 18, 30, 20);
      ctx.fillStyle = '#fff0c2'; ctx.fillText(String(count), flagX, flagY + 28);
    }
  }
}

function ofHealthAndLevel(ctx, entity, selected, top, enemy = false) {
  if (!selected && !(entity.hp < entity.maxHp)) return;
  const ratio = Math.max(0, Math.min(1, (entity.hp ?? 0) / Math.max(1, entity.maxHp ?? 1)));
  const width = enemy ? 42 : 48;
  ctx.fillStyle = '#142019e6'; ctx.fillRect(entity.x - width / 2, top - 8, width, 5);
  ctx.fillStyle = enemy ? '#d65c51' : '#69bea3'; ctx.fillRect(entity.x - width / 2 + 1, top - 7, (width - 2) * ratio, 3);
  if (!enemy && selected && (entity.level ?? 1) > 0) {
    const level = Math.min(3, entity.level ?? 1);
    for (let index = 0; index < level; index++) {
      drawFivePointStar(ctx, entity.x + (index - (level - 1) / 2) * 12, top - 17, 5, 2.2);
      ctx.fillStyle = '#f4cf68'; ctx.strokeStyle = '#493719'; ctx.lineWidth = 1; ctx.stroke(); ctx.fill();
    }
  }
}

function ofDeathMarker(ctx, unit) {
  const max = Math.max(.1, unit.respawnTime ?? unit.deadDuration ?? ofTypeData(unit)?.respawn ?? unit.deadLeft ?? 1);
  const ratio = Math.max(0, Math.min(1, (unit.deadLeft ?? 0) / max));
  ctx.save(); ctx.globalAlpha = .62;
  ofEllipse(ctx, unit.x, unit.y, 18, 7, '#263d33a8', '#7ba896', 1);
  ctx.strokeStyle = '#9ad4c1'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(unit.x, unit.y, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - ratio)); ctx.stroke();
  ctx.restore();
}

function ofTower(ctx, art, tower, visualTime, reducedMotion, selected) {
  const type = ofTypeData(tower);
  const typeId = ofTypeId(tower);
  const sprite = tower.sprite ?? type?.sprite ?? OF_TOWER_SPRITES[typeId];
  const spec = art?.manifest?.towers?.[sprite]?.completed ?? art?.manifest?.towers?.[sprite]?.idle?.[0];
  ofEllipse(ctx, tower.x, tower.y + 4, 29, 11, '#173027a8', selected ? '#8de0cc' : '#477d6d', selected ? 3 : 1.5);
  const drawn = frameImage(ctx, art, spec, reducedMotion ? 0 : visualTime + String(tower.id).length * .17,
    tower.x - 36, tower.y - 105, 72, 134, { frameOverride: reducedMotion ? 0 : null });
  if (!drawn) {
    ctx.fillStyle = type?.color ?? '#be9d62'; ctx.fillRect(tower.x - 12, tower.y - 54, 24, 55);
  }
  ofHealthAndLevel(ctx, tower, selected, tower.y - 104, false);
}

function ofUnit(ctx, art, unit, visualTime, reducedMotion, selected) {
  if (unit.temporary && (unit.expired || unit.hp <= 0 || unit.lifeLeft <= 0)) return;
  if ((unit.deadLeft ?? 0) > 0 || unit.hp <= 0) { ofDeathMarker(ctx, unit); return; }
  const type = ofTypeData(unit);
  const typeId = ofTypeId(unit);
  const height = OF_UNIT_HEIGHTS[typeId] ?? (typeId === 'militia' ? 58 : typeId === 'swarm' ? 54 : 70);
  const state = unit.moving ? 'run' : unit.attackLeft > 0 && unit.attackAge < .55 ? 'attack' : 'idle';
  ofEllipse(ctx, unit.x, unit.y + 1, 17, 6, selected ? '#4cae9b70' : '#16312791', selected ? '#89dfcc' : null, 2);
  drawDuelystUnit(ctx, art, unit.sprite ?? type?.sprite ?? typeId, state,
    reducedMotion ? 0 : state === 'attack' ? unit.attackAge ?? 0 : visualTime + String(unit.id).length * .13,
    unit.x, unit.y, unit.facing < 0, height);
  ofHealthAndLevel(ctx, unit, selected, unit.y - height, false);
}

function ofEnemyHeight(enemy) {
  if (enemy.boss || enemy.type === 'boss' || /boss|chief|king/i.test(enemy.sprite ?? '')) return 100;
  return Math.max(50, Math.min(78, enemy.visibleHeight ?? OF_TYPES[enemy.type]?.visibleHeight ?? 62));
}

function ofEnemy(ctx, art, enemy, visualTime, reducedMotion, selected) {
  if ((enemy.deadLeft ?? 0) > 0 || enemy.hp <= 0) return;
  const height = ofEnemyHeight(enemy);
  const state = enemy.moving ? 'run' : enemy.attackLeft > 0 && enemy.attackAge < .55 ? 'attack' : 'idle';
  ofEllipse(ctx, enemy.x, enemy.y + 1, height * .24, 7, '#8c29295c', '#dc665c', selected ? 3 : 1.5);
  drawDuelystUnit(ctx, art, enemy.sprite ?? enemy.type, state,
    reducedMotion ? 0 : state === 'attack' ? enemy.attackAge ?? 0 : visualTime + String(enemy.id).length * .19,
    enemy.x, enemy.y, enemy.facing < 0, height);
  ofHealthAndLevel(ctx, enemy, selected, enemy.y - height, true);
}

function ofProjectileEnd(game, shot) {
  const target = (game?.enemies ?? []).find(enemy => enemy.id === shot.targetId && !enemy.dead);
  let visual = OF_PROJECTILE_VISUALS.get(shot);
  if (!visual) {
    const recentEffects = (game?.effects ?? []).filter(effect => Number.isFinite(effect.x) && Number.isFinite(effect.y) && (effect.age ?? 0) <= .12);
    const fallback = recentEffects.sort((a, b) => Math.hypot(a.x - shot.x, a.y - shot.y) - Math.hypot(b.x - shot.x, b.y - shot.y))[0];
    visual = { x: target?.x ?? fallback?.x ?? shot.x, y: target?.y ?? fallback?.y ?? shot.y };
    OF_PROJECTILE_VISUALS.set(shot, visual);
  }
  if (target) { visual.x = target.x; visual.y = target.y; }
  return visual;
}

function ofProjectiles(ctx, game) {
  for (const shot of game?.projectiles ?? []) {
    const color = shot.color || '#ffe39b';
    const end = ofProjectileEnd(game, shot);
    const linear = Math.max(0, Math.min(1, (shot.age ?? 0) / Math.max(.01, shot.duration ?? .22)));
    const progress = linear * linear * (3 - 2 * linear);
    const x = shot.x + (end.x - shot.x) * progress;
    const y = shot.y + (end.y - shot.y) * progress;
    const angle = Math.atan2(end.y - shot.y, end.x - shot.x);
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = color; ctx.strokeStyle = color;
    if (/arrow|bolt/i.test(shot.kind ?? '')) {
      ctx.rotate(angle); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(7, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(2, -3); ctx.lineTo(2, 3); ctx.closePath(); ctx.fill();
    } else {
      ctx.shadowColor = color; ctx.shadowBlur = 7; ctx.beginPath(); ctx.arc(0, 0, /cannon|rock/i.test(shot.kind ?? '') ? 6 : 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function ofEffects(ctx, art, game, reducedMotion) {
  for (const effect of game?.effects ?? []) {
    const progress = Math.max(0, Math.min(1, (effect.age ?? 0) / Math.max(.01, effect.duration ?? .4)));
    const spec = art?.manifest?.duelyst?.effects?.[effect.kind];
    ctx.save(); ctx.globalAlpha = reducedMotion ? .65 : 1 - progress;
    if (effect.kind === 'lightning' && Number.isFinite(effect.fromX)) {
      ctx.strokeStyle = effect.color || '#ccecff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(effect.fromX, effect.fromY - 28);
      ctx.lineTo((effect.fromX + effect.x) / 2 + 7, (effect.fromY + effect.y) / 2 - 28);
      ctx.lineTo(effect.x, effect.y - 25); ctx.stroke();
    }
    if (spec?.frames?.length) {
      const frame = spec.frames[Math.min(spec.frames.length - 1, Math.floor((reducedMotion ? .45 : progress) * spec.frames.length))];
      const source = imageFor(art, spec.path);
      if (source) {
        const size = effect.kind === 'summon' ? 108 : effect.kind === 'fire' ? 90 : 76;
        const scale = size / Math.max(frame.canvasWidth ?? frame.width, frame.canvasHeight ?? frame.height, 1);
        ctx.translate(effect.x, effect.y - 24); ctx.scale(scale, scale);
        const x = (frame.sourceX ?? 0) - (frame.canvasWidth ?? frame.width) / 2;
        const y = (frame.sourceY ?? 0) - (frame.canvasHeight ?? frame.height) / 2;
        if (frame.rotated) {
          ctx.translate(x, y + frame.width); ctx.rotate(-Math.PI / 2);
          ctx.drawImage(source, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
        } else ctx.drawImage(source, frame.x, frame.y, frame.width, frame.height, x, y, frame.width, frame.height);
      }
    } else if (effect.kind === 'heal') {
      ctx.strokeStyle = effect.color || '#a5efb1'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(effect.x - 7, effect.y - 45); ctx.lineTo(effect.x + 7, effect.y - 45);
      ctx.moveTo(effect.x, effect.y - 52); ctx.lineTo(effect.x, effect.y - 38); ctx.stroke();
    } else if (effect.kind !== 'lightning') {
      ctx.strokeStyle = effect.color || '#ffe2a1'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(effect.x, effect.y - 20, 8 + progress * 22, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

function ofPlacement(ctx, art, placement, visualTime, reducedMotion) {
  if (!placement || !Number.isFinite(placement.x) || !Number.isFinite(placement.y)) return;
  const valid = placement.valid !== false;
  const color = valid ? '#78d5af' : '#e45f56';
  ctx.save(); ctx.globalAlpha = .82; ctx.setLineDash([7, 5]);
  ofEllipse(ctx, placement.x, placement.y, 31, 15, valid ? '#4bb58d29' : '#c946462b', color, 3);
  ctx.setLineDash([]);
  const type = placement.type ?? placement.typeId;
  const typeId = ofTypeId(type);
  if (typeId && OF_TOWER_IDS.has(typeId)) ofTower(ctx, art, { id: 'ghost', type: ofTypeData(type) ?? OF_TYPES[typeId], x: placement.x, y: placement.y, level: 1 }, visualTime, reducedMotion, false);
  if (!valid) {
    ctx.strokeStyle = '#ff8b82'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(placement.x - 13, placement.y - 13); ctx.lineTo(placement.x + 13, placement.y + 13);
    ctx.moveTo(placement.x + 13, placement.y - 13); ctx.lineTo(placement.x - 13, placement.y + 13); ctx.stroke();
  }
  ctx.restore();
}

export function ofRender(canvas, art, game, viewState = {}, wallTime = 0) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx || !game) return;
  const view = getBattlefieldView(canvas);
  const reducedMotion = ofReducedMotion();
  const visualTime = ofVisualTime(game, wallTime, reducedMotion);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = '#203427'; ctx.fillRect(0, 0, view.width, view.height);
  ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.scale, view.scale); ctx.imageSmoothingEnabled = false;
  ofGround(ctx, art); ofRoute(ctx, game, viewState); ofRange(ctx, game, viewState); ofEntranceFlags(ctx, game);

  const actors = [
    ...(OF_MAP.obstacles ?? []).map(value => ({ kind: 'obstacle', value, y: value.y })),
    { kind: 'core', value: OF_MAP.core, y: OF_MAP.core.y },
    ...(game.units ?? []).filter(value => !value.expired).map(value => ({ kind: ofTypeData(value)?.category === 'tower' ? 'tower' : 'unit', value, y: value.y })),
    ...(game.enemies ?? []).map(value => ({ kind: 'enemy', value, y: value.y }))
  ].sort((a, b) => a.y - b.y);
  for (const actor of actors) {
    if (actor.kind === 'obstacle') ofObstacle(ctx, art, actor.value);
    else if (actor.kind === 'core') ofCore(ctx, art, visualTime);
    else if (actor.kind === 'tower') ofTower(ctx, art, actor.value, visualTime, reducedMotion, actor.value.id === viewState.selectedId);
    else if (actor.kind === 'unit') ofUnit(ctx, art, actor.value, visualTime, reducedMotion, actor.value.id === viewState.selectedId);
    else ofEnemy(ctx, art, actor.value, visualTime, reducedMotion, actor.value.id === viewState.selectedId);
  }
  ofProjectiles(ctx, game); ofEffects(ctx, art, game, reducedMotion); ofPlacement(ctx, art, viewState.placement, visualTime, reducedMotion);
  ctx.restore();
}

export function ofDrawTypePreview(canvas, art, typeId) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.clientWidth || 96, height = canvas.clientHeight || 100;
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height); ctx.imageSmoothingEnabled = false;
  if (OF_TOWER_IDS.has(typeId)) {
    const sprite = OF_TOWER_SPRITES[typeId];
    const spec = art?.manifest?.towers?.[sprite]?.completed ?? art?.manifest?.towers?.[sprite]?.idle?.[0];
    frameImage(ctx, art, spec, 0, width / 2 - 27, height - 100, 54, 100, { frameOverride: 0 });
  } else drawDuelystUnit(ctx, art, typeId, 'idle', 0, width / 2, height - 5, false, Math.min(82, height - 10));
}
