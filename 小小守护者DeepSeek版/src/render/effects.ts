/**
 * Combat effects layer: real projectiles, impact flashes, floating damage
 * numbers, kill bursts, fading corpses and spell rings.
 *
 * Presentation-only. The pools are reused, the particle count is hard-capped
 * and the projectile list is pruned every frame, so a long seven-wave battle
 * never grows memory.
 */
import type { Effect, GameState, Point } from '../core/types.ts';
import { SPELL_DEFS } from '../core/content.ts';
import type { SpriteFrame } from '../assets-types.ts';

export const PARTICLE_CAP = 220;
const CORPSE_CAP = 40;
const CORPSE_TTL = 26;

export interface Projectile {
  id: number;
  ox: number;
  oy: number;
  tx: number;
  ty: number;
  age: number;
  ttl: number;
  fromEnemy: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  color: string;
}

interface DamageNumber {
  x: number;
  y: number;
  age: number;
  ttl: number;
  text: string;
  size: number;
  color: string;
}

interface Corpse {
  x: number;
  y: number;
  age: number;
  canvas: HTMLCanvasElement;
  scale: number;
  anchorX: number;
  anchorY: number;
}

export class Effects {
  private readonly projectiles: Projectile[] = [];
  private readonly liveShots = new Set<number>();
  private readonly particles: Particle[] = [];
  private readonly numbers: DamageNumber[] = [];
  private readonly corpses: Corpse[] = [];

  clearTransient(): void {
    this.projectiles.length = 0;
    this.liveShots.clear();
    this.particles.length = 0;
    this.numbers.length = 0;
    this.corpses.length = 0;
  }

  /** Real damage read out of a hp delta; bigger hits are bigger and brighter. */
  damageNumber(p: Point, amount: number): void {
    const value = Math.max(1, Math.round(amount));
    const size = value >= 60 ? 20 : value >= 30 ? 17 : value >= 12 ? 14 : 12;
    const color = value >= 60 ? '#ffd166' : value >= 30 ? '#ffb257' : '#f2f6f4';
    if (this.numbers.length >= 48) this.numbers.shift();
    this.numbers.push({ x: p.x, y: p.y, age: 0, ttl: value >= 30 ? 40 : 30, text: String(value), size, color });
  }

  killBurst(p: Point, team: 'player' | 'enemy'): void {
    const count = team === 'enemy' ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (i % 3) * 0.31;
      const speed = 0.055 + ((i * 37) % 11) * 0.006;
      this.spawn(p.x, p.y, Math.cos(angle) * speed, Math.sin(angle) * speed - 0.03, 16 + (i % 5) * 4, team);
    }
  }

  private spawn(x: number, y: number, vx: number, vy: number, ttl: number, team: 'player' | 'enemy' | 'neutral'): void {
    if (this.particles.length >= PARTICLE_CAP) this.particles.shift();
    const color = team === 'enemy' ? '#ff9a6a' : team === 'player' ? '#7fe4ef' : '#cfe6f2';
    this.particles.push({ x, y, vx, vy, age: 0, ttl, color });
  }

  addCorpse(p: Point, canvas: HTMLCanvasElement, scale: number, anchorX: number, anchorY: number): void {
    if (this.corpses.length >= CORPSE_CAP) this.corpses.shift();
    this.corpses.push({ x: p.x, y: p.y, age: 0, canvas, scale, anchorX, anchorY });
  }

  /** Promote newly seen `shot` effects into flying projectiles. */
  syncProjectiles(state: GameState): void {
    this.liveShots.clear();
    for (const effect of state.effects) {
      if (effect.kind !== 'shot' || effect.toX === undefined || effect.toY === undefined) continue;
      this.liveShots.add(effect.id);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.liveShots.has(this.projectiles[i]!.id)) this.projectiles.splice(i, 1);
    }
    for (const effect of state.effects) {
      if (effect.kind !== 'shot' || effect.toX === undefined || effect.toY === undefined) continue;
      if (this.projectiles.some((p) => p.id === effect.id)) continue;
      if (this.projectiles.length >= 96) this.projectiles.shift();
      const target = { x: effect.toX, y: effect.toY };
      const distance = Math.hypot(target.x - effect.x, target.y - effect.y);
      const owner = state.units.find((u) => u.x === effect.x && u.y === effect.y);
      this.projectiles.push({
        id: effect.id,
        ox: effect.x,
        oy: effect.y,
        tx: target.x,
        ty: target.y,
        age: 0,
        ttl: Math.max(4, Math.min(16, Math.round(5 + distance * 0.55))),
        fromEnemy: owner?.team === 'enemy',
      });
    }
  }

  /** Advance every transient by `dt` ticks. */
  update(dt: number): void {
    const step = Math.max(0, Math.min(6, dt));
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      p.age += step;
      if (p.age >= p.ttl) {
        // Visual settles on impact, never before the arrow reaches the target.
        this.spawnImpact({ x: p.tx, y: p.ty }, p.fromEnemy);
        this.projectiles.splice(i, 1);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i]!;
      part.age += step;
      part.x += part.vx * step;
      part.y += part.vy * step;
      part.vy += 0.006 * step;
      part.vx *= 1 - 0.015 * step;
      if (part.age >= part.ttl) this.particles.splice(i, 1);
    }
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i]!;
      n.age += step;
      n.y -= 0.011 * step;
      if (n.age >= n.ttl) this.numbers.splice(i, 1);
    }
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i]!;
      c.age += step;
      if (c.age >= CORPSE_TTL) this.corpses.splice(i, 1);
    }
  }

  drawCorpses(ctx: CanvasRenderingContext2D): void {
    for (const c of this.corpses) {
      const age = Math.min(1, c.age / CORPSE_TTL);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age) * 0.7;
      ctx.imageSmoothingEnabled = false;
      ctx.translate(c.x, c.y + age * 0.1);
      ctx.drawImage(
        c.canvas,
        0,
        0,
        c.canvas.width,
        c.canvas.height,
        -c.anchorX * c.scale,
        -c.anchorY * c.scale,
        c.canvas.width * c.scale,
        c.canvas.height * c.scale,
      );
      ctx.restore();
    }
  }

  drawParticles(ctx: CanvasRenderingContext2D, cell: number): void {
    const unit = 1 / cell;
    for (const part of this.particles) {
      const age = Math.max(0, Math.min(1, part.age / part.ttl));
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = part.color;
      const size = Math.max(1, Math.round(cell * 0.07 * (1 - age * 0.45))) * unit;
      ctx.fillRect(part.x, part.y, size, size);
    }
    ctx.globalAlpha = 1;
  }

  /** Arrow / bolt in flight: sized in pixels (converted to world units). */
  drawProjectiles(ctx: CanvasRenderingContext2D, cell: number): void {
    const px = (n: number) => n / cell;
    for (const p of this.projectiles) {
      const t = Math.max(0, Math.min(1, p.age / Math.max(1, p.ttl)));
      const x = p.ox + (p.tx - p.ox) * t;
      const y = p.oy + (p.ty - p.oy) * t - Math.sin(Math.PI * t) * 0.14;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(p.ty - p.oy, p.tx - p.ox));
      ctx.fillStyle = '#101c24';
      ctx.fillRect(px(-4), px(-1.5), px(8), px(3));
      ctx.fillStyle = p.fromEnemy ? '#ffab6e' : '#dceeff';
      ctx.fillRect(px(-3), px(-0.5), px(6), px(1));
      // Arrow head keeps the flight readable at small cell sizes.
      ctx.beginPath();
      ctx.moveTo(px(5), 0);
      ctx.lineTo(px(2), px(-2.5));
      ctx.lineTo(px(2), px(2.5));
      ctx.closePath();
      ctx.fillStyle = p.fromEnemy ? '#ffd0a0' : '#ffffff';
      ctx.fill();
      ctx.restore();
    }
  }

  /** Rings / flashes described by `state.effects` (hit, heal, freeze, burst). */
  drawEffectRings(ctx: CanvasRenderingContext2D, state: GameState, cell: number): void {
    for (const effect of state.effects) {
      if (effect.kind === 'shot') continue;
      const age = Math.max(0, Math.min(1, (state.tick - effect.born) / Math.max(1, effect.ttl)));
      if (effect.kind === 'hit') {
        ctx.save();
        ctx.globalAlpha = 1 - age;
        ctx.fillStyle = '#fff1c4';
        const size = cell * (0.16 + age * 0.1);
        ctx.fillRect(effect.x - size / 2, effect.y - size / 2, size, size);
        ctx.restore();
        continue;
      }
      if (effect.kind === 'heal' || effect.kind === 'freeze') {
        const heal = effect.kind === 'heal';
        // Radius mirrors SPELL_DEFS so the drawn ring is truthful.
        const radius = heal ? SPELL_DEFS.heal.radius : SPELL_DEFS.freeze.radius;
        const radiusNow = radius * Math.min(1, 0.3 + age * 0.8);
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age) * 0.9;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, Math.max(0.05, radiusNow), 0, Math.PI * 2);
        ctx.fillStyle = heal ? 'rgba(88,224,160,0.13)' : 'rgba(128,205,255,0.14)';
        ctx.fill();
        ctx.lineWidth = Math.max(1, cell * 0.07);
        ctx.strokeStyle = heal ? '#6fe0a0' : '#8fd4ff';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, Math.max(0.05, radiusNow * 0.7), 0, Math.PI * 2);
        ctx.globalAlpha = Math.max(0, 1 - age) * 0.45;
        ctx.stroke();
        ctx.restore();
        continue;
      }
      if (effect.kind === 'burst') {
        ctx.save();
        ctx.globalAlpha = 1 - age;
        ctx.lineWidth = Math.max(1, cell * 0.06);
        ctx.strokeStyle = '#ffd9a8';
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, cell * (0.12 + age * 0.34), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /**
   * Floating damage numbers, drawn in device pixels: a 12-20px monospace figure
   * with a dark outline, so it stays crisp at any zoom (a world-space font would
   * scale with the cell size and become enormous).
   */
  drawDamageNumbers(ctx: CanvasRenderingContext2D, toScreen: (p: Point) => Point, dpr: number): void {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const n of this.numbers) {
      const age = Math.max(0, Math.min(1, n.age / n.ttl));
      const fontPx = n.size;
      const screen = toScreen({ x: n.x, y: n.y });
      ctx.font = `700 ${fontPx}px Consolas, "SFMono-Regular", "DejaVu Sans Mono", monospace`;
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, (age - 0.5) / 0.5));
      ctx.lineWidth = Math.max(2, fontPx * 0.24);
      ctx.strokeStyle = 'rgba(8,12,16,0.92)';
      ctx.strokeText(n.text, screen.x, screen.y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, screen.x, screen.y);
    }
    ctx.restore();
  }

  /** Impact flash for a projectile that just landed. */
  spawnImpact(p: Point, fromEnemy: boolean): void {
    for (let i = 0; i < 3; i++) {
      const angle = (Math.PI * 2 * i) / 3 + 0.4;
      this.spawn(p.x, p.y, Math.cos(angle) * 0.04, Math.sin(angle) * 0.04, 9, fromEnemy ? 'enemy' : 'neutral');
    }
  }

  get projectileCount(): number {
    return this.projectiles.length;
  }

  get particleCount(): number {
    return this.particles.length;
  }

  get numberCount(): number {
    return this.numbers.length;
  }

  get corpseCount(): number {
    return this.corpses.length;
  }
}

export type { Effect, SpriteFrame };
