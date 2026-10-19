/**
 * Battle overlays: range arcs, selection rings, alert banners and
 * off-screen edge hints.
 *
 * All of it is drawn with explicit strokes and translucent fills — no blurred
 * glow sprites, no saturated washes. Cyan-blue marks a legal / friendly target,
 * orange-red marks an illegal or hostile one.
 */
import type { GameState, Point, Unit } from '../core/types.ts';
import { BUILDING_DEFS, HERO_DEFS, LEGION_DEFS, SPELL_DEFS } from '../core/content.ts';
import type { Camera, Insets } from './camera.ts';
import { cellPx } from './scale.ts';
import { drawRing } from './units.ts';

export interface PlacementPreview {
  /** Snapped landing point (cell centre for buildings, cell corner for legions). */
  point: Point;
  valid: boolean;
  /** Alert / effect radius in cells; 0 draws nothing. */
  radius: number;
  kind: string;
  tier: number;
  shape: 'legion' | 'building' | 'spell' | 'none';
  /** Spell preview centre, which may differ from `point`. */
  center?: Point;
}

export const LEGAL = { ring: '#3f9aa6', edge: '#123037', fill: 'rgba(75,184,196,0.03)' } as const;
export const ILLEGAL = { ring: '#c86b45', edge: '#341a11', fill: 'rgba(224,122,82,0.04)' } as const;

/**
 * Stroke weight for a range guide, in WORLD units.
 *
 * `radius` is the radius in world cells, `cell` the current device pixels per
 * cell. A unit ring is ~7px across and wants 1-2px of ink; a legion alert ring
 * is 150px+ across, where the same weight would read as a drawn ellipse
 * competing with the battlefield. Outlines therefore taper with radius.
 */
function strokeWeights(radius: number, cell: number): { edge: number; ring: number } {
  const radiusPx = radius * cell;
  const edge = radiusPx <= 24 ? 1.5 : radiusPx <= 60 ? 1 : 0.75;
  const ring = radiusPx <= 24 ? 1.4 : radiusPx <= 60 ? 1 : 0.85;
  return { edge: cellPx(edge, cell), ring: cellPx(ring, cell) };
}

export interface Alert {
  title: string;
  subtitle: string;
  tone: 'danger' | 'warn' | 'info';
  born: number;
  ttl: number;
}

const FONT = 'system-ui, "Microsoft YaHei", "PingFang SC", sans-serif';

export class Hud {
  alert: Alert | null = null;
  /** Buildings that changed hp this frame, so they can flash white. */
  readonly hurtBuildings = new Set<number>();

  /** Clear the per-frame flash set; called at the start of `draw`. */
  beginFrame(): void {
    this.hurtBuildings.clear();
  }

  notify(title: string, subtitle: string, tone: Alert['tone'], tick: number, ttl = 130): void {
    this.alert = { title, subtitle, tone, born: tick, ttl };
  }

  /**
   * Range arc: a single restrained dashed guide, not a wash of colour. The
   * semantic still reads (cyan-blue legal / orange-red illegal) through hue and
   * an unbroken outer hairline, while the fill is almost invisible so the units
   * and terrain stay dominant.
   */
  drawRange(ctx: CanvasRenderingContext2D, p: Point, radius: number, valid: boolean, cell: number): void {
    if (!Number.isFinite(radius) || radius <= 0) return;
    const tone = valid ? LEGAL : ILLEGAL;
    const dash = Math.max(4, cell * 0.55) / cell;
    const weights = strokeWeights(radius, cell);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = tone.fill;
    ctx.fill();
    // Thin dark backing keeps the guide readable over bright terrain …
    ctx.lineWidth = weights.edge;
    ctx.strokeStyle = tone.edge;
    ctx.stroke();
    // … and one dashed hue pass carries the semantics (cyan legal / red illegal).
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.lineWidth = weights.ring;
    ctx.strokeStyle = tone.ring;
    ctx.setLineDash([dash * 1.7, dash * 1.2]);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Selection highlight for a building / legion / hero.
   *
   * `cell` is device pixels per cell; everything drawn here lives in world units,
   * so pixel measurements are converted with `cellPx` (0.6–2px of ink).
   */
  drawSelection(ctx: CanvasRenderingContext2D, state: GameState, id: number, cell: number): void {
    const building = state.buildings.find((b) => b.id === id);
    if (building) {
      const span = 1.02;
      ctx.save();
      ctx.lineWidth = cellPx(2.4, cell);
      ctx.strokeStyle = LEGAL.edge;
      ctx.strokeRect(building.x - span / 2 - cellPx(1, cell), building.y - span / 2 - cellPx(1, cell), span + cellPx(2, cell), span + cellPx(2, cell));
      ctx.strokeStyle = LEGAL.ring;
      ctx.lineWidth = cellPx(1.6, cell);
      ctx.strokeRect(building.x - span / 2, building.y - span / 2, span, span);
      const radius = BUILDING_DEFS[building.kind].range;
      if (radius > 0) this.drawRange(ctx, { x: building.x, y: building.y }, radius, true, cell);
      ctx.restore();
      return;
    }
    const legion = state.legions.find((l) => l.id === id);
    if (legion) {
      ctx.save();
      ctx.lineWidth = cellPx(2.4, cell);
      ctx.strokeStyle = LEGAL.edge;
      ctx.beginPath();
      ctx.ellipse(legion.x, legion.y, cellPx(20, cell), cellPx(9, cell), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = LEGAL.ring;
      ctx.lineWidth = cellPx(1.6, cell);
      ctx.beginPath();
      ctx.ellipse(legion.x, legion.y, cellPx(18, cell), cellPx(8, cell), 0, 0, Math.PI * 2);
      ctx.stroke();
      this.drawRange(ctx, { x: legion.x, y: legion.y }, legion.alertRadius, true, cell);
      for (const unit of state.units) {
        if (unit.legionId !== legion.id) continue;
        this.unitRing(ctx, unit, cell);
      }
      ctx.restore();
      return;
    }
    if (state.hero && state.hero.id === id) {
      const hero = state.hero;
      ctx.save();
      ctx.lineWidth = cellPx(2.4, cell);
      ctx.strokeStyle = LEGAL.edge;
      ctx.beginPath();
      ctx.ellipse(hero.x, hero.y, cellPx(14, cell), cellPx(6.5, cell), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = cellPx(1.6, cell);
      ctx.beginPath();
      ctx.ellipse(hero.x, hero.y, cellPx(12, cell), cellPx(5.5, cell), 0, 0, Math.PI * 2);
      ctx.stroke();
      const radius = HERO_DEFS[hero.kind]?.aura.radius ?? 0;
      if (radius > 0) this.drawRange(ctx, { x: hero.x, y: hero.y }, radius, true, cell);
      ctx.restore();
    }
  }

  /** Small bright ring marking one selected legion member. */
  private unitRing(ctx: CanvasRenderingContext2D, unit: Unit, cell: number): void {
    drawRing(ctx, unit, Math.min(0.42, Math.max(0.26, cellPx(10, cell))), cell, unit.team, { bright: true });
  }

  /** Ghost footprint + radius for the pending placement (world units). */
  drawPreview(
    ctx: CanvasRenderingContext2D,
    preview: PlacementPreview,
    cell: number,
    ghost: (kind: string, tier: number, at: Point, valid: boolean) => void,
  ): void {
    const tone = preview.valid ? LEGAL : ILLEGAL;
    const centre = preview.shape === 'spell' ? preview.center ?? preview.point : preview.point;
    if (preview.shape === 'building') {
      const def = BUILDING_DEFS[preview.kind as keyof typeof BUILDING_DEFS];
      const x = Math.floor(preview.point.x) + 0.5;
      const y = Math.floor(preview.point.y) + 0.5;
      ctx.save();
      ctx.fillStyle = tone.fill;
      ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
      ctx.lineWidth = cellPx(2, cell);
      ctx.strokeStyle = tone.edge;
      ctx.strokeRect(x - 0.5 - cellPx(1, cell), y - 0.5 - cellPx(1, cell), 1 + cellPx(2, cell), 1 + cellPx(2, cell));
      ctx.lineWidth = cellPx(1.4, cell);
      ctx.strokeStyle = tone.ring;
      ctx.strokeRect(x - 0.5, y - 0.5, 1, 1);
      ctx.restore();
      ghost(preview.kind, 1, { x, y }, preview.valid);
      const radius = preview.radius > 0 ? preview.radius : def ? Math.max(0.6, def.range) : 0.6;
      this.drawRange(ctx, { x, y }, radius, preview.valid, cell);
      return;
    }
    if (preview.shape === 'legion') {
      const def = LEGION_DEFS[preview.kind as keyof typeof LEGION_DEFS];
      const formation = def?.formation ?? [];
      for (let i = 0; i < formation.length; i++) {
        const offset = formation[i]!;
        ghost(preview.kind, preview.tier, { x: preview.point.x + offset.x, y: preview.point.y + offset.y }, preview.valid);
      }
      this.drawRange(ctx, preview.point, preview.radius > 0 ? preview.radius : 6, preview.valid, cell);
      return;
    }
    if (preview.shape === 'spell') {
      const def = SPELL_DEFS[preview.kind as keyof typeof SPELL_DEFS];
      const radius = preview.radius > 0 ? preview.radius : def ? def.radius : 3;
      this.drawRange(ctx, centre, radius, preview.valid, cell);
      ctx.save();
      ctx.translate(centre.x, centre.y);
      ctx.lineWidth = cellPx(2.4, cell);
      ctx.strokeStyle = tone.edge;
      ctx.beginPath();
      ctx.moveTo(cellPx(-7, cell), 0);
      ctx.lineTo(cellPx(7, cell), 0);
      ctx.moveTo(0, cellPx(-7, cell));
      ctx.lineTo(0, cellPx(7, cell));
      ctx.stroke();
      ctx.strokeStyle = tone.ring;
      ctx.lineWidth = cellPx(1.4, cell);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (preview.radius > 0) this.drawRange(ctx, centre, preview.radius, preview.valid, cell);
  }

  /** Top-of-view alert banner: boss arrival, core damage, wave changes. */
  drawAlert(ctx: CanvasRenderingContext2D, camera: Camera, state: GameState): void {
    const alert = this.alert;
    if (!alert) return;
    const age = state.tick - alert.born;
    if (age > alert.ttl) {
      this.alert = null;
      return;
    }
    const fade = age < 12 ? age / 12 : age > alert.ttl - 26 ? Math.max(0, (alert.ttl - age) / 26) : 1;
    const accent = alert.tone === 'danger' ? '#ff7a4d' : alert.tone === 'warn' ? '#ffce6a' : '#57e0ea';
    const width = Math.min(camera.view.width - 24, Math.max(180, alert.title.length * 20 + 28));
    const height = 40;
    const x = Math.round(camera.view.x + (camera.view.width - width) / 2);
    const y = Math.round(camera.view.y + 10);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));
    ctx.fillStyle = 'rgba(11,18,24,0.9)';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 4, height);
    ctx.strokeStyle = 'rgba(220,238,246,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(alert.title, x + width / 2 + 2, y + 15);
    ctx.fillStyle = 'rgba(226,238,244,0.86)';
    ctx.font = `400 11px ${FONT}`;
    ctx.fillText(alert.subtitle, x + width / 2 + 2, y + 30);
    ctx.restore();
  }

  /**
   * When the map is fitted, outline the area the play camera would show, so the
   * player can see how much they are about to zoom into.
   */
  drawViewportHint(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!camera.overview) return;
    const rect = camera.viewportRect();
    if (rect.width >= camera.mapWidth - 0.2 && rect.height >= camera.mapHeight - 0.2) return;
    // One cell is `camera.scale` device pixels here, so a 0.5-cell stroke reads
    // as a fixed hairline instead of one that grows with the cell size.
    ctx.save();
    ctx.lineWidth = camera.scale * 0.5;
    ctx.strokeStyle = 'rgba(10,18,24,0.7)';
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.lineWidth = camera.scale * 0.3;
    ctx.strokeStyle = 'rgba(232,246,252,0.8)';
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  }

  /**
   * Off-screen hints: an arrow on the edge nearest to whatever the camera
   * cannot see (camp / boss), so the player is never blind.
   */
  drawEdgeHints(ctx: CanvasRenderingContext2D, camera: Camera, state: GameState, bossOnMap: boolean): void {
    const boss = bossOnMap ? state.units.find((u) => u.kind === 'boss' && u.team === 'enemy' && u.hp > 0) : undefined;
    const targets: { p: Point; color: string }[] = [];
    if (!camera.isVisible(state.map.core)) targets.push({ p: state.map.core, color: '#e9f4f8' });
    if (boss && !camera.isVisible(boss)) targets.push({ p: boss, color: '#ff7a4d' });
    if (!targets.length) return;
    const pulse = 0.6 + 0.4 * Math.sin((state.tick / 24) * Math.PI);
    const dpr = camera.devicePixelRatio;
    for (const target of targets) {
      const screen = camera.toScreen(target.p);
      const cx = Math.round(Math.max(camera.view.x + 10, Math.min(camera.view.x + camera.view.width - 10, screen.x)));
      const cy = Math.round(Math.max(camera.view.y + 10, Math.min(camera.view.y + camera.view.height - 10, screen.y)));
      const angle = Math.atan2(screen.y - cy, screen.x - cx);
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = target.color === '#ff7a4d' ? Math.max(0.4, pulse) : 0.8;
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(11,18,24,0.78)';
      ctx.fillRect(-7, -9, 15, 18);
      ctx.fillStyle = target.color;
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-2, -7);
      ctx.lineTo(-2, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /** Camera shake magnitude; disabled entirely when `reduced` is set. */
  shakeFor(alert: Alert | null, tick: number): number {
    if (!alert) return 0;
    const age = tick - alert.born;
    if (age > 18 || alert.tone !== 'danger') return 0;
    return 3.2 * (1 - age / 18);
  }

  /** Deterministic shake pattern: no RNG, so replays look identical. */
  static shakeOffset(magnitude: number, tick: number): Point {
    if (magnitude <= 0) return { x: 0, y: 0 };
    const phase = tick * 1.7;
    return { x: Math.round(Math.sin(phase) * magnitude), y: Math.round(Math.cos(phase * 1.3) * magnitude * 0.6) };
  }
}

export type { Camera, Insets };
