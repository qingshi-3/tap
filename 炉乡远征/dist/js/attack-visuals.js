import { AttackCoverageCache } from './attack-coverage.js';

const CORAL = '#ff6358';
const ICE = '#effcff';

function polygon(ctx, points) {
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
}

function sword(ctx, x, y, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  polygon(ctx, [{ x: -2, y: -size / 2 + 3 }, { x: 0, y: -size / 2 }, { x: 2, y: -size / 2 + 3 }, { x: 2, y: 3 }, { x: -2, y: 3 }]); ctx.fill();
  ctx.fillRect(-5, 3, 10, 2); ctx.fillRect(-1.5, 5, 3, 5);
  ctx.restore();
}

export function drawAttackGround(renderer, ctx, metrics, movement, attacks, preview, gesture, texturedQuad) {
  const query = renderer.rangePreview;
  const sourceUnit = query?.unit;
  renderer.attackCoverageCache ??= new AttackCoverageCache();
  const coverage = renderer.attackCoverageCache.get(query?.state ?? renderer.state, sourceUnit);
  renderer.attackCoveragePositions = coverage;
  // A blue underlay separates the white range from snow and sky; the soft
  // centre stays bright on dark maps without relying on a thin outline.
  for (const position of movement) {
    const cell = renderer.cellGeometry(metrics, position.x, position.y);
    ctx.save();
    polygon(ctx, cell.points); ctx.clip();
    ctx.fillStyle = 'rgba(5,43,91,.35)';
    ctx.fillRect(cell.center.x-cell.width,cell.center.y-cell.height,cell.width*2,cell.height*2);
    const light = ctx.createRadialGradient(cell.center.x,cell.center.y,0,cell.center.x,cell.center.y,cell.width*.64);
    light.addColorStop(0,'rgba(255,255,255,.76)');
    light.addColorStop(.38,'rgba(231,251,255,.60)');
    light.addColorStop(.72,'rgba(106,199,255,.28)');
    light.addColorStop(1,'rgba(45,135,235,.08)');
    ctx.fillStyle = light;
    ctx.fillRect(cell.center.x-cell.width,cell.center.y-cell.height,cell.width*2,cell.height*2);
    ctx.restore();
  }
  renderer.drawMergedRegion(ctx, metrics, movement, [], ICE, .52);
  for (const position of coverage) {
    const cell = renderer.cellGeometry(metrics, position.x, position.y);
    ctx.save();
    polygon(ctx, cell.points);
    const inner = cell.points.map(p => ({x:cell.center.x+(p.x-cell.center.x)*.76,y:cell.center.y+(p.y-cell.center.y)*.76}));
    ctx.moveTo(inner[0].x, inner[0].y);
    for (const p of inner.slice(1)) ctx.lineTo(p.x,p.y);
    ctx.closePath(); ctx.clip('evenodd');
    const material = ctx.createRadialGradient(cell.center.x,cell.center.y,0,cell.center.x,cell.center.y,cell.width*.65);
    material.addColorStop(0,'rgba(255,96,79,0)');
    material.addColorStop(.32,'rgba(255,96,79,.08)');
    material.addColorStop(.57,'rgba(255,120,94,.64)');
    material.addColorStop(1,'rgba(255,96,79,.08)');
    ctx.fillStyle=material; ctx.fillRect(cell.center.x-cell.width,cell.center.y-cell.width,cell.width*2,cell.width*2);
    texturedQuad(ctx, renderer.tintedTile('tile-hover',CORAL),cell.points,.48);
    ctx.restore();
  }
  const affected = renderer.state.units.filter(unit => preview?.targetIds?.includes(unit.unitId));
  const source = renderer.state.units.find(unit => unit.unitId === preview?.attackerId);
  if (affected.length > 1 && source) {
    const from = renderer.cellGeometry(metrics, source.x, source.y).center;
    const farthest = affected.map(unit => renderer.cellGeometry(metrics, unit.x, unit.y).center)
      .sort((a, b) => Math.hypot(b.x - from.x, b.y - from.y) - Math.hypot(a.x - from.x, a.y - from.y))[0];
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(237,158,120,.15)'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(from.x, from.y + 6); ctx.lineTo(farthest.x, farthest.y + 6); ctx.stroke(); ctx.restore();
  }
}

// These flank the existing stat rings in the foreground: standing sprites must
// not hide the only indication that a target can be attacked.
export function drawAttackTargets(renderer, ctx, metrics, attacks, gesture) {
  for (const position of attacks) {
    const cell = renderer.cellGeometry(metrics, position.x, position.y);
    const locked = position.unitId === gesture?.targetId && !gesture.cancelled;
    ctx.save(); ctx.globalAlpha = locked ? 1 : .9;
    ctx.fillStyle = locked ? '#fff0d8' : '#f7a18c';
    ctx.strokeStyle = '#583a36'; ctx.lineWidth = 1.5;
    for (const side of [-1, 1]) {
      const x = cell.center.x + side * cell.width * .44, y = cell.center.y + cell.height * .17;
      polygon(ctx, [{x:x-side*4,y}, {x:x+side*3,y:y-5}, {x:x+side*3,y:y+5}]); ctx.stroke(); ctx.fill();
    }
    if (locked) {
      ctx.strokeStyle = '#edb299'; ctx.lineWidth = 2;
      for (const start of [0, Math.PI]) {
        ctx.beginPath(); ctx.ellipse(cell.center.x, cell.center.y + cell.height * .14, cell.width * .34, cell.height * .25, 0, start + .2, start + 1.1); ctx.stroke();
      }
    }
    ctx.restore();
  }
}

export function drawAttackGesture(renderer, ctx, metrics, gesture, fallbackSource = null, fallbackTarget = null) {
  const source = gesture ? renderer.state.units.find(unit => unit.unitId === gesture.unitId) : fallbackSource;
  const target = gesture ? renderer.state.units.find(unit => unit.unitId === gesture.targetId) : fallbackTarget;
  if (!source || (!gesture && !target)) return;
  const rect = renderer.canvas.getBoundingClientRect();
  const from = renderer.cellGeometry(metrics, source.x, source.y).center;
  const to = target ? renderer.cellGeometry(metrics, target.x, target.y).center : { x: gesture.clientX - rect.left, y: gesture.clientY - rect.top };
  if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) return;
  const legal = Boolean(target && !gesture?.cancelled);
  const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy);
  if (distance < 12) return;
  const image = renderer.tintedTile('tile-path-attack', legal ? '#ffe7cd' : '#99878a');
  if (!image) return;
  const spacing = 18;
  const normal = Math.abs(dy) > Math.abs(dx) ? { x: 1, y: 0 } : { x: 0, y: -1 };
  const arc = Math.min(48, Math.max(44, distance * .2), normal.y ? Math.max(12, Math.min(from.y, to.y) - 60) : 48);
  const phase = renderer.motionPreference.matches ? 0 : performance.now() / 65 % spacing;
  for (let offset = phase + spacing / 2; offset < distance - 7; offset += spacing) {
    const t = offset / distance, lift = Math.sin(t * Math.PI) * arc;
    const tangentX = dx + normal.x * Math.cos(t * Math.PI) * arc * Math.PI;
    const tangentY = dy + normal.y * Math.cos(t * Math.PI) * arc * Math.PI;
    ctx.save(); ctx.globalAlpha = (legal ? .94 : .32) * Math.min(1, offset / 14, (distance - offset) / 14);
    ctx.translate(from.x + dx * t + normal.x * lift, from.y + dy * t + normal.y * lift - 4);
    ctx.rotate(Math.atan2(tangentY, tangentX));
    const h = 14 * image.height / image.width;
    ctx.drawImage(image, -7, -h / 2, 14, h); ctx.restore();
  }
}

function overlaps(a, b, gap = 3) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

function previewLayout(renderer, metrics, preview, gesture, ctx) {
  const rect = renderer.canvas.getBoundingClientRect(), width = rect.width, height = rect.height;
  const obstacles = [];
  const local = element => { const r = element.getBoundingClientRect(); return { x: r.left - rect.left, y: r.top - rect.top, width: r.width, height: r.height }; };
  // Canvas spans the screen, while battle controls float above it. Read only
  // visible controls in this battle; geometry is local to the same canvas.
  const match = renderer.canvas.closest('.match');
  const topbar = match?.querySelector('.match-topbar');
  const safeBottom = parseFloat(getComputedStyle(match ?? renderer.canvas).getPropertyValue('--safe-bottom')) || 0;
  let top = 58, bottom = height - Math.max(0, safeBottom) - 8;
  if (topbar?.getBoundingClientRect().height) top = Math.max(top, local(topbar).y + local(topbar).height + 3);
  // Containers include empty board space and padding; reserve only the
  // controls/cards that actually cover pixels, rather than cutting off an
  // entire screen strip at the hand container's top edge.
  for (const selector of ['.general-panel', '.map-controls button', '#hand .hand-card', '#hand-count', '#draw-hand-status', '#replace-hand-card', '#bbs-button', '#end-turn', '.mana-track', '.battle-log', '#selected-unit-label', '#hand-instruction', '#level-goal']) {
    for (const element of match?.querySelectorAll(selector) ?? []) {
      const r = local(element);
      if (r.width && r.height && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none') {
        obstacles.push(r);
      }
    }
  }
  // Preserve the existing attack/health digits: forecast numbers must not
  // become a second layer of digits on top of those native stat icons.
  for (const unit of renderer.state.units) {
    const cell = renderer.cellGeometry(metrics, unit.x, unit.y), size = Math.max(17, cell.width * .29);
    for (const side of [-1, 1]) obstacles.push({ x: cell.center.x + side * cell.width * .22 - size / 2,
      y: cell.center.y + cell.height * .02 - size / 2, width: size, height: size });
  }
  const touch = gesture && Number.isFinite(gesture.clientX) ? { x: gesture.clientX - rect.left, y: gesture.clientY - rect.top } : null;
  const labels = preview.units.filter(unit => unit.unitId === preview.targetId || unit.healthBefore !== unit.healthAfter || unit.removed || unit.attackBefore !== unit.attackAfter)
    .map(unit => {
      const anchor = renderer.cellGeometry(metrics, unit.x, unit.y).center;
      const primary = unit.unitId === preview.attackerId || unit.unitId === preview.targetId;
      const dead = unit.removed || unit.healthAfter <= 0;
      const showHealth = primary || unit.healthBefore !== unit.healthAfter || dead;
      const text = primary ? `${unit.healthBefore}→${dead ? 0 : unit.healthAfter}` : `${Math.max(0, unit.healthAfter) - unit.healthBefore}`;
      const attackText = !dead && unit.attackBefore !== unit.attackAfter ? `${unit.attackBefore}→${unit.attackAfter}` : null;
      const healthText = showHealth ? text.replace('-', '−') : attackText;
      return { unit, anchor, text: healthText, dead, attackOnly: !showHealth, primary,
        width: Math.ceil(ctx.measureText(healthText).width) + (primary || !showHealth ? 22 : dead ? 12 : 6), height: 20 };
    }).sort((a, b) => Number(b.primary) - Number(a.primary) || a.anchor.y - b.anchor.y || a.anchor.x - b.anchor.x);
  const placed = [];
  for (const label of labels) {
    let best = null;
    const left = Math.max(8, label.anchor.x - 100 - label.width / 2), right = Math.min(width - label.width - 8, label.anchor.x + 100 - label.width / 2);
    const firstY = Math.max(top, label.anchor.y - 100 - label.height / 2), lastY = Math.min(bottom - label.height, label.anchor.y + 100 - label.height / 2);
    // Results belong beside their unit, never in a distant free screen corner.
    const search = step => {
    for (let y = firstY; y <= lastY; y += step) for (let x = left; x <= right; x += step) {
      const candidate = { x, y, width: label.width, height: label.height };
      const centerDistance = Math.hypot(x + label.width / 2 - label.anchor.x, y + label.height / 2 - label.anchor.y);
      if (centerDistance > 100) continue;
      if (obstacles.some(r => overlaps(candidate, r)) || placed.some(r => overlaps(candidate, r, 5))) continue;
      if (touch) {
        const nearX = Math.max(x, Math.min(touch.x, x + label.width)), nearY = Math.max(y, Math.min(touch.y, y + label.height));
        if (Math.hypot(nearX - touch.x, nearY - touch.y) < 38) continue;
      }
      const desiredX = label.anchor.x + (label.unit.owner === 0 ? -1 : 1) * (label.width / 2 + 18);
      const dx = x + label.width / 2 - desiredX, dy = y + label.height / 2 - (label.anchor.y - 22);
      const score = dx * dx + dy * dy;
      if (!best || score < best.score) best = { ...candidate, score };
    }
    };
    search(8);
    // A narrow gap between real controls can be missed by the coarse pass.
    if (!best) search(2);
    if (best) placed.push({ ...label, ...best });
  }
  renderer.attackPreviewMissingUnitIds = labels.filter(label => !placed.some(item => item.unit.unitId === label.unit.unitId)).map(label => label.unit.unitId);
  return placed;
}

export function drawAttackResults(renderer, ctx, metrics, preview, gesture) {
  if (!preview?.units?.length) return;
  ctx.save(); ctx.font = '16px "Duelyst Lato", sans-serif';
  // Visible HUD controls change when dragging starts/ends, even if the target
  // and forecast stay identical. Always use current visible-control geometry.
  const labels = previewLayout(renderer, metrics, preview, gesture, ctx);
  for (const label of labels) {
    const { x, y } = label;
    ctx.fillStyle = label.dead ? '#ffd2b9' : '#ffd0b8';
    ctx.font = '16px "Duelyst Lato", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#18212b'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    const image = renderer.images.get(label.attackOnly ? 'stat-attack-bw' : 'stat-health-bw');
    const icon = label.primary || label.attackOnly;
    if (icon && image) renderer.drawStat(ctx, x + 9, y + 10, 20, label.attackOnly ? label.unit.attackBefore : label.unit.healthBefore, image);
    const textX = x + (icon ? 20 : label.dead ? 10 : 2);
    if (label.dead && !label.primary) { ctx.strokeText('×', x, y + 10); ctx.fillText('×', x, y + 10); }
    const text = icon ? label.text.slice(label.text.indexOf('→')) : label.text;
    ctx.strokeText(text, textX, y + 10); ctx.fillText(text, textX, y + 10);
    if (label.dead && label.primary) {
      ctx.font = '11px "Duelyst Lato", sans-serif'; ctx.strokeText('×', x + label.width - 8, y + 10); ctx.fillText('×', x + label.width - 8, y + 10);
    }
  }
  ctx.restore();
  // Exposed only on the renderer for layout audits; no game state mutation.
  renderer.attackPreviewLayout = labels.map(({ unit, x, y, width, height }) => ({ unitId: unit.unitId, x, y, width, height }));
}
