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
  const now = performance.now(), reduced = renderer.motionPreference?.matches;
  const pulse = reduced ? 0.5 : 0.5 + Math.sin(now / 220) * 0.5;
  for (const position of attacks) {
    const cell = renderer.cellGeometry(metrics, position.x, position.y);
    const locked = position.unitId === gesture?.targetId && !gesture.cancelled;
    const [p0, p1, p2, p3] = cell.points;
    const lerpPt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const quadPt = (u, v) => lerpPt(lerpPt(p0, p1, u), lerpPt(p3, p2, u), v);
    ctx.save();
    // Animated flanking pixel chevrons pointing inward at attackable enemies
    const nudge = reduced ? 0 : (locked ? 2.5 : 1.5) * pulse;
    for (const side of [-1, 1]) {
      const cx = Math.round(cell.center.x + side * (cell.width * .44 - nudge));
      const cy = Math.round(cell.center.y + cell.height * .15);
      const px = locked ? 2.2 : 1.8;
      ctx.save();
      ctx.translate(cx, cy);
      if (side > 0) ctx.scale(-1, 1);
      const pts = [[-1,-2],[0,-1],[1,0],[0,1],[-1,2]];
      ctx.fillStyle = '#380a08';
      for (const [bx, by] of pts) ctx.fillRect(bx * px - 1, by * px - 1, px + 2, px + 2);
      ctx.fillStyle = locked ? '#ff543e' : '#f79a7c';
      for (const [bx, by] of pts) ctx.fillRect(bx * px, by * px, px, px);
      ctx.fillStyle = locked ? '#fff2b2' : '#ffe6cc';
      ctx.fillRect(0.6 * px, -0.4 * px, px, px);
      ctx.restore();
    }
    // Breathing crimson-gold pixel corner lock-on brackets when target is locked
    if (locked) {
      const inset = reduced ? 0.06 : 0.04 + pulse * 0.05;
      const arm = 0.24;
      const corners = [
        [quadPt(inset + arm, inset), quadPt(inset, inset), quadPt(inset, inset + arm)],
        [quadPt(1 - inset - arm, inset), quadPt(1 - inset, inset), quadPt(1 - inset, inset + arm)],
        [quadPt(1 - inset - arm, 1 - inset), quadPt(1 - inset, 1 - inset), quadPt(1 - inset, 1 - inset - arm)],
        [quadPt(inset + arm, 1 - inset), quadPt(inset, 1 - inset), quadPt(inset, 1 - inset - arm)],
      ];
      ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
      for (const [a, c, b] of corners) {
        ctx.strokeStyle = 'rgba(48, 8, 8, 0.92)'; ctx.lineWidth = 4.4;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.strokeStyle = '#ff543e'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.fillStyle = '#fff0a8';
        ctx.fillRect(Math.round(c.x - 1.5), Math.round(c.y - 1.5), 3, 3);
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
  const p0 = { x: from.x, y: from.y - 14 };
  const p2 = { x: to.x, y: to.y - 8 };
  const dx = p2.x - p0.x, dy = p2.y - p0.y, distance = Math.hypot(dx, dy);
  if (distance < 12) return;
  const lift = Math.min(48, Math.max(20, distance * 0.22));
  const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - lift };
  const bezPt = t => {
    const u = 1 - t;
    return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
  };
  const bezTan = t => {
    const u = 1 - t;
    return { x: 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x), y: 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y) };
  };
  const reduced = renderer.motionPreference?.matches;
  const count = Math.max(3, Math.min(8, Math.round(distance / 32)));
  const phase = reduced ? 0.5 : (performance.now() / 520) % 1;
  const px = legal ? 2.5 : 2.0;

  ctx.save();
  ctx.strokeStyle = legal ? 'rgba(255, 86, 52, 0.28)' : 'rgba(148, 134, 146, 0.22)';
  ctx.lineWidth = legal ? 5.5 : 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y); ctx.stroke();

  for (let i = 0; i < count; i++) {
    const t = ((i + phase) / count) % 1;
    if (t < 0.05 || t > 0.96) continue;
    const pt = bezPt(t), tan = bezTan(t);
    const angle = Math.atan2(tan.y, tan.x);
    const edgeFade = Math.min(1, t / 0.16, (1 - t) / 0.12);
    const scale = 0.85 + t * 0.25;
    ctx.save();
    ctx.translate(Math.round(pt.x), Math.round(pt.y));
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.globalAlpha = edgeFade * (legal ? 0.96 : 0.45);
    const body = [[-2,-2],[-1,-1],[0,0],[-1,1],[-2,2]];
    ctx.fillStyle = legal ? '#380907' : '#1b1a24';
    for (const [bx, by] of body) ctx.fillRect(bx * px - 1, by * px - 1, px + 2, px + 2);
    ctx.fillStyle = legal ? '#ff553c' : '#9b91a6';
    for (const [bx, by] of body) ctx.fillRect(bx * px, by * px, px, px);
    ctx.fillStyle = legal ? '#fff2b0' : '#d6d0de';
    ctx.fillRect(0.5 * px, -0.4 * px, px, px);
    ctx.restore();
  }
  ctx.restore();
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
      const lethalBonus = dead ? 28 : 0;
      return { unit, anchor, text: healthText, dead, attackOnly: !showHealth, primary,
        width: Math.ceil(ctx.measureText(healthText).width) + (primary || !showHealth ? 28 : 16) + lethalBonus, height: 22 };
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
  ctx.save(); ctx.font = '700 13px "Luxiang UI", sans-serif';
  // Visible HUD controls change when dragging starts/ends, even if the target
  // and forecast stay identical. Always use current visible-control geometry.
  const labels = previewLayout(renderer, metrics, preview, gesture, ctx);
  const traceCut = (ox, oy, ow, oh, c = 3) => {
    ctx.beginPath();
    ctx.moveTo(ox + c, oy); ctx.lineTo(ox + ow - c, oy); ctx.lineTo(ox + ow, oy + c);
    ctx.lineTo(ox + ow, oy + oh - c); ctx.lineTo(ox + ow - c, oy + oh);
    ctx.lineTo(ox + c, oy + oh); ctx.lineTo(ox, oy + oh - c); ctx.lineTo(ox, oy + c);
    ctx.closePath();
  };
  for (const label of labels) {
    const bx = Math.round(label.x), by = Math.round(label.y);
    const bw = Math.round(label.width), bh = Math.round(label.height);
    // Pixel-cut notched tactical badge backing
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
    traceCut(bx, by, bw, bh, 3);
    ctx.fillStyle = label.dead ? '#6b1414' : '#1b1832';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = label.dead ? 'rgba(255, 214, 128, 0.24)' : 'rgba(220, 200, 255, 0.14)';
    ctx.fillRect(bx + 3, by + 1, bw - 6, 2);
    traceCut(bx + 0.5, by + 0.5, bw - 1, bh - 1, 3);
    ctx.strokeStyle = label.dead ? '#ffd978' : '#d6b266';
    ctx.lineWidth = 1.5; ctx.stroke();

    const image = renderer.images.get(label.attackOnly ? 'stat-attack-bw' : 'stat-health-bw');
    const icon = label.primary || label.attackOnly;
    if (icon && image) renderer.drawStat(ctx, bx + 11, by + bh / 2, 18, label.attackOnly ? label.unit.attackBefore : label.unit.healthBefore, image);
    const textX = bx + (icon ? 22 : 6);
    const mainText = icon ? label.text.slice(label.text.indexOf('→')) : label.text;
    ctx.font = '700 12.5px "Luxiang UI", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = label.dead ? '#fff2c2' : '#ffe0be';
    ctx.fillText(mainText, textX, by + bh / 2 + 0.5);
    if (label.dead) {
      ctx.font = '700 10.5px "Luxiang UI", sans-serif';
      ctx.fillStyle = '#ffd978';
      ctx.textAlign = 'right';
      ctx.fillText('斩杀', bx + bw - 5, by + bh / 2 + 0.5);
    }
    ctx.restore();
  }
  ctx.restore();
  // Exposed only on the renderer for layout audits; no game state mutation.
  renderer.attackPreviewLayout = labels.map(({ unit, x, y, width, height }) => ({ unitId: unit.unitId, x, y, width, height }));
}
