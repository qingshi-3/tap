/**
 * Unit / legion rendering.
 *
 * Every unit is blitted from its authored frame; the artwork is never tinted or
 * recoloured. Team ownership is communicated by a crisp double-stroked ring at
 * the unit's feet (cyan-blue for the player, orange-red for enemies), which is
 * also the anchor for the selection highlight.
 */
import type { GameState, Point, Unit } from '../core/types.ts';
import { CARD_DEFS } from '../core/content.ts';
import type { SpriteFrame } from '../assets-types.ts';
import { cellPx } from './scale.ts';
import { frameKey, type BodyProfile, type SpriteStore } from './sprites.ts';

export const TEAM_RING = { player: '#4bb8c4', enemy: '#d9704c' } as const;
const RING_DARK = { player: '#0d2a33', enemy: '#33150d' } as const;
const SELECT_RING = '#e8f1f2';

interface TimelineState {
  tick: number;
  attackStarted: number;
}

/**
 * Clip playback derived from `state.tick`, so it is deterministic and immune to
 * dropped frames: the frame index is a pure function of the tick delta, never
 * of an accumulated per-frame timer.
 */
export class Timeline {
  private readonly clips = new Map<number, TimelineState>();

  begin(state: GameState): void {
    this.tick = state.tick;
    if (this.tick <= 0) this.clips.clear();
  }

  tick = 0;

  frameOf(unit: Unit, profile: BodyProfile, reduced: boolean): string {
    let entry = this.clips.get(unit.id);
    if (!entry) {
      entry = { tick: this.tick, attackStarted: Number.NEGATIVE_INFINITY };
      this.clips.set(unit.id, entry);
    }
    const attacks = profile.attackFrames;
    const attackTotal = attacks.reduce((sum, f) => sum + Math.max(0, f.duration), 0);
    if (unit.anim === 'attack' && unit.animTick !== entry.tick) {
      const over = (this.tick - entry.attackStarted) / 30;
      if (entry.attackStarted === Number.NEGATIVE_INFINITY || over >= attackTotal - 1e-6) entry.attackStarted = unit.animTick;
    }
    entry.tick = this.tick;
    const first = profile.idleFrames[0] ?? profile.walkFrames[0] ?? attacks[0];
    if (!first) return '';
    if (reduced) return frameKey((unit.anim === 'attack' && attacks[0]) || first);
    if (unit.anim === 'attack' && entry.attackStarted !== Number.NEGATIVE_INFINITY) {
      const elapsed = (this.tick - entry.attackStarted) / 30;
      if (elapsed < attackTotal) return frameKey(frameAt(attacks, elapsed, false));
      entry.attackStarted = Number.NEGATIVE_INFINITY;
    }
    if (unit.anim === 'walk') return frameKey(frameAt(profile.walkFrames, (this.tick / 30) * 1.6, true));
    return frameKey(frameAt(profile.idleFrames, (this.tick / 30) * 0.75, true));
  }

  forget(ids: Set<number>): void {
    for (const id of this.clips.keys()) if (!ids.has(id)) this.clips.delete(id);
  }

  clear(): void {
    this.clips.clear();
  }
}

export function frameAt<T extends { duration: number }>(frames: T[], elapsed: number, loop: boolean): T {
  const total = frames.reduce((sum, f) => sum + Math.max(0, f.duration), 0);
  if (total <= 0) return frames[0]!;
  let time = loop ? ((elapsed % total) + total) % total : Math.max(0, Math.min(elapsed, total));
  for (const frame of frames) {
    if (time < Math.max(0, frame.duration) - 1e-9) return frame;
    time -= Math.max(0, frame.duration);
  }
  return frames[frames.length - 1]!;
}

export interface RingOptions {
  /** Draw the extra bright outer ring for the current selection. */
  bright?: boolean;
}

/** Point on the unit's ellipse ring for an angle, in world units. */
export function ringPoint(unit: Point, radius: number, angle: number, squash = 0.42): Point {
  return { x: unit.x + Math.cos(angle) * radius, y: unit.y + Math.sin(angle) * radius * squash };
}

/**
 * Elliptical team ring with a dark inner outline: legible, never a blurred glow.
 * `pixels` is device pixels per cell, so all strokes are 1-2 physical pixels.
 */
export function drawRing(
  ctx: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  pixels: number,
  team: 'player' | 'enemy',
  options: RingOptions = {},
): void {
  const squash = 0.42;
  const thin = cellPx(1, pixels);
  const mid = cellPx(1.3, pixels);
  // Very light interior: enough to seat the unit, never a colour blob.
  const fill = options.bright ? 'rgba(232,241,242,0.10)' : 'rgba(10,20,26,0.08)';
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, radius, radius * squash, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = thin;
  ctx.strokeStyle = RING_DARK[team];
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(center.x, center.y + thin * 0.5, Math.max(0.05, radius - thin), Math.max(0.02, (radius - thin) * squash), 0, 0, Math.PI * 2);
  ctx.lineWidth = mid;
  ctx.strokeStyle = TEAM_RING[team];
  ctx.stroke();
  if (options.bright) {
    const outer = radius + mid * 1.4;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, outer, outer * squash, 0, 0, Math.PI * 2);
    ctx.lineWidth = thin;
    ctx.strokeStyle = SELECT_RING;
    ctx.stroke();
  }
  ctx.restore();
}

export interface UnitRendererDeps {
  store: SpriteStore;
  /** Returns the legion tier for a unit, or 1 for heroes / enemies. */
  tierOf(unit: Unit): number;
  selected: number | null;
  reduced: boolean;
  /** Draw a white hit flash for units hurt within the last few ticks. */
  hurtFlash: boolean;
}

export interface DrawUnitResult {
  profile: BodyProfile;
  /** Sprite anchor position in world space. */
  x: number;
  y: number;
}

export class UnitPainter {
  private readonly profiles = new Map<string, BodyProfile | null>();
  private selected: number | null = null;
  private reduced = false;

  constructor(private readonly deps: UnitRendererDeps) {}

  setSelected(id: number | null): void {
    this.selected = id;
  }

  setReduced(value: boolean): void {
    this.reduced = value;
  }

  profileFor(kind: Unit['kind'], tier: number): BodyProfile | null {
    const key = `${kind}:${tier}`;
    const cached = this.profiles.get(key);
    if (cached !== undefined) return cached;
    const profile = this.deps.store.profile(kind, tier);
    this.profiles.set(key, profile);
    return profile;
  }

  /** World units per source pixel for a unit body (boss is deliberately larger). */
  scaleFor(kind: Unit['kind'], tier: number, bodyMultiplier: number): number {
    const profile = this.profileFor(kind, tier);
    if (!profile) return 0;
    const base = profile.body / Math.max(1, profile.box.w);
    const boss = kind === 'boss' ? Math.max(base, 2.15 / Math.max(1, profile.box.w)) : base;
    return boss * bodyMultiplier;
  }

  /** Total scale applied to a unit's artwork this frame, cards included. */
  totalScale(unit: Unit, state: GameState): number {
    return this.scaleFor(unit.kind, this.deps.tierOf(unit), this.bodyScale(state, unit));
  }

  bodyScale(state: GameState, unit: Unit): number {
    if (unit.team !== 'player' || unit.legionId === null) return 1;
    let scale = 1;
    for (const card of state.cards) {
      if (card.carrier === unit.legionId || CARD_DEFS[card.kind].scope === 'global') {
        scale *= CARD_DEFS[card.kind].bodyScale ?? 1;
      }
    }
    return scale;
  }

  /**
   * Draw one unit: ground shadow, authored frame, hit flash, team ring and
   * health bar. The caller supplies the depth-sorted order and the current
   * clip frame, so nothing here depends on per-frame allocation.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    unit: Unit,
    cell: number,
    frameHint?: SpriteFrame,
  ): DrawUnitResult | null {
    const profile = this.profileFor(unit.kind, this.deps.tierOf(unit));
    if (!profile) return null;
    const scale = this.totalScale(unit, state);
    const spriteX = unit.x - profile.anchor.x * scale;
    const spriteY = unit.y - profile.anchor.y * scale;
    const canvas = this.deps.store.frameCanvas(frameHint ?? profile.idle);
    if (!canvas) return null;

    // Ground shadow: an ellipse directly under the feet, smaller when flying.
    const box = this.deps.store.boxWorld(profile);
    const shadowW = Math.max(2, Math.min(cell * 0.95, box.w * 0.8));
    const shadowY = unit.y + (unit.fly ? cell * 0.1 : cell * 0.02);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(unit.x, shadowY, shadowW / 2, shadowW / 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = unit.fly ? 'rgba(8,14,18,0.22)' : 'rgba(8,14,18,0.34)';
    ctx.fill();
    ctx.restore();

    // Face the current target (artwork is authored facing right).
    const target = unit.targetId !== null ? state.units.find((u) => u.id === unit.targetId) : undefined;
    const facing = target ? (target.x < unit.x ? -1 : 1) : unit.team === 'enemy' ? -1 : 1;
    const width = canvas.width * scale;
    const height = canvas.height * scale;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(unit.x, unit.y);
    ctx.scale(facing, 1);
    ctx.drawImage(canvas, -profile.anchor.x * scale, -profile.anchor.y * scale, width, height);
    ctx.restore();

    const hurtAge = state.tick - unit.lastHurtTick;
    if (this.deps.hurtFlash && !this.reduced && hurtAge >= 0 && hurtAge <= 3) {
      this.flash(ctx, canvas, spriteX, spriteY, width, height, 0.62 - hurtAge * 0.18);
    }

    // Ring radius comes from the painted artwork width (world units), clamped so
    // it never swallows the whole cell.
    const ringRadius = Math.max(cellPx(3, cell), Math.min(cell * 0.42, box.w * 0.62));
    drawRing(ctx, unit, ringRadius, cell, unit.team, {
      bright: this.selected === unit.id || (unit.team === 'player' && hurtAge >= 0 && hurtAge <= 2),
    });
    if (unit.hp < unit.maxHp) {
      const barWidth = Math.max(12, Math.min(34, box.w * cell)) / cell;
      this.healthBar(ctx, unit.x, spriteY - cellPx(8, cell), barWidth, unit.hp / unit.maxHp, unit.team);
    }
    return { profile, x: unit.x, y: unit.y };
  }

  /** White hit flash: composites through the artwork's own alpha only. */
  private flash(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
    width: number,
    height: number,
    alpha: number,
  ): void {
    const scratch = flashCanvas(canvas.width, canvas.height);
    if (!scratch) return;
    const sctx = scratch.getContext('2d');
    if (!sctx) return;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'source-over';
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(canvas, 0, 0);
    sctx.globalCompositeOperation = 'source-atop';
    sctx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.min(1, alpha))})`;
    sctx.fillRect(0, 0, scratch.width, scratch.height);
    sctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scratch, 0, 0, scratch.width, scratch.height, x, y, width, height);
    ctx.restore();
  }

  /** 4px-tall health bar; only drawn for damaged units. */
  healthBar(ctx: CanvasRenderingContext2D, cx: number, y: number, width: number, ratio: number, team: 'player' | 'enemy'): void {
    const w = Math.max(12, Math.min(34, width));
    const x = Math.round(cx - w / 2);
    const top = Math.round(y);
    ctx.fillStyle = 'rgba(8,12,16,0.86)';
    ctx.fillRect(x, top, w, 4);
    const fill = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = team === 'player' ? (fill > 0.4 ? '#63d6a2' : '#e0c15c') : fill > 0.4 ? '#f0775a' : '#e0c15c';
    ctx.fillRect(x + 1, top + 1, Math.max(0, Math.round((w - 2) * fill)), 2);
  }

  /** Ring drawn for a selected legion member, without the sprite. */
  drawSelectionRing(ctx: CanvasRenderingContext2D, unit: Unit, cell: number): void {
    const radius = Math.max(cell * 0.3, cell * 0.34);
    drawRing(ctx, unit, radius, cell, unit.team, { bright: true });
  }

  clear(): void {
    this.profiles.clear();
  }
}

let flashScratch: HTMLCanvasElement | null = null;
function flashCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (!flashScratch) flashScratch = document.createElement('canvas');
  if (flashScratch.width !== width || flashScratch.height !== height) {
    flashScratch.width = width;
    flashScratch.height = height;
  }
  return flashScratch;
}
