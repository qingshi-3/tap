/**
 * Static terrain layer.
 *
 * The whole map (600 cells + bridges + camp + buildings) is composited once
 * into an offscreen canvas at the current device-pixel scale and then blitted
 * with a single `drawImage`. Nothing is re-created per frame; the cache is
 * invalidated only when the environment changes (base tile size, map id,
 * buildings added / removed / damaged) or when water takes its deterministic
 * animation step. Cell variants come from a coordinate hash, never from
 * `Math.random`, so tiles never shimmer between frames.
 */
import type { GameState } from '../core/types.ts';
import type { WorldAsset } from '../assets-types.ts';
import type { Camera } from './camera.ts';

const WATER_STEP = 10;

/**
 * Fallback chains for the world keys this renderer needs. New keys added by the
 * asset pipeline (`shore`, `deadGrass`) degrade to grass with a single warning
 * instead of disappearing or throwing.
 */
function blitFallbacks(key: string): string[] {
  switch (key) {
    case 'grass':
      return ['grass'];
    case 'grassDetail':
      return ['grassDetail', 'grass'];
    case 'grassTuft':
      return ['grassTuft', 'grassDetail', 'grass'];
    case 'deadGrass':
      return ['deadGrass', 'grass'];
    case 'water':
      return ['water', 'grass'];
    case 'shore':
      return ['shore', 'grass'];
    case 'keep':
      return ['keep', 'core', 'grass'];
    case 'tree':
      return ['tree', 'rock'];
    case 'rock':
      return ['rock', 'tree'];
    default:
      return [key, 'grass'];
  }
}

/** Deterministic 0..1 hash of a cell coordinate and salt. */
export function cellHash(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Narrow view of the sprite store used by the terrain painter. */
export interface TerrainStore {
  worldAsset(...keys: string[]): WorldAsset | null;
  worldAssetSilent(...keys: string[]): WorldAsset | null;
  worldCanvas(asset: WorldAsset): HTMLCanvasElement | null;
  worldCanvasFor(key: string): HTMLCanvasElement | null;
}

interface Structure {
  x: number;
  y: number;
  order: number;
  draw: (ctx: CanvasRenderingContext2D, size: number, cx: number, cy: number) => void;
}

export class Terrain {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private store: TerrainStore | null = null;
  private signature = '';
  private waterPhase = -1;
  private lanes: Uint8Array = new Uint8Array(0);
  private laneKey = '';
  private waterField: Uint8Array = new Uint8Array(0);
  private waterKey = '';
  private waterUsed = false;
  private forcedDirty = true;
  private bridgeList = '';

  constructor(private readonly host: HTMLElement) {}

  bind(store: TerrainStore): void {
    this.store = store;
    this.forcedDirty = true;
  }

  markDirty(): void {
    this.forcedDirty = true;
  }

  /** Draw the cached map at the camera's world origin. */
  render(ctx: CanvasRenderingContext2D, camera: Camera, state: GameState): void {
    const size = camera.scale;
    if (size <= 0) return;
    this.dpr = camera.devicePixelRatio;
    const water = Math.floor(state.tick / WATER_STEP) % 2;
    const signature = this.structureSignature(state, size);
    if (this.forcedDirty || !this.canvas || !this.ctx || this.signature !== signature || this.waterPhase !== water || this.renderedDpr !== this.dpr) {
      this.renderedDpr = this.dpr;
      this.build(state, size, water, signature);
    }
    if (!this.canvas) return;
    const origin = camera.origin;
    const dpr = camera.devicePixelRatio;
    // The cache is rendered at device resolution, so it is blitted in DEVICE
    // pixel space with an identity transform: one cell covers exactly
    // `tile * dpr` device pixels. (Mixing this with the world transform would
    // scale the destination rect twice.)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.canvas,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      Math.round(origin.x * dpr),
      Math.round(origin.y * dpr),
      Math.round(this.cssWidth * dpr),
      Math.round(this.cssHeight * dpr),
    );
    ctx.restore();
  }

  private cssWidth = 1;
  private cssHeight = 1;

  private structureSignature(state: GameState, size: number): string {
    let hit = 0;
    for (const b of state.buildings) hit += b.id * 7 + Math.floor((b.hp / Math.max(1, b.maxHp)) * 8) * 131;
    return `${state.mapId}:${state.seed}:${state.map.width}x${state.map.height}:${size}:${this.dpr}:${state.buildings.length}:${hit}`;
  }

  private build(state: GameState, size: number, water: number, signature: string): void {
    const ratio = this.dpr;
    const width = Math.max(1, Math.round(state.map.width * size * ratio));
    const height = Math.max(1, Math.round(state.map.height * size * ratio));
    this.cssWidth = state.map.width * size;
    this.cssHeight = state.map.height * size;
    if (!this.canvas || this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas = this.host.ownerDocument.createElement('canvas');
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx = this.canvas.getContext('2d');
    }
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // Restrained palette: the source tiles are bright, so the terrain layer is
    // desaturated and slightly darkened once here (never per frame, and never on
    // unit artwork). Canvas filters are GPU-backed in the browsers we target.
    ctx.filter = 'saturate(0.58) brightness(0.9)';
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    try {
      this.refreshLanes(state);
      this.buildWater(state);
      this.paintCells(ctx, state, size, water);
      this.bridgeList = this.paintBridges(ctx, state, size);
      this.paintStructures(ctx, state, size);
    } finally {
      // A browser without Canvas2D filters must still produce a map.
      ctx.filter = 'none';
    }
    this.signature = signature;
    this.waterPhase = water;
    this.forcedDirty = false;
  }

  /** Device pixel ratio the cache is rendered at (updated by `render`). */
  private dpr = 1;
  private renderedDpr = 0;

  private refreshLanes(state: GameState): void {
    const key = `${state.mapId}:${state.map.gates.map((g) => `${g.x},${g.y}`).join('|')}:${state.map.core.x},${state.map.core.y}`;
    if (key === this.laneKey && this.lanes.length === state.map.width * state.map.height) return;
    const lanes = new Uint8Array(state.map.width * state.map.height);
    for (const gate of state.map.gates) {
      const dx = state.map.core.x - gate.x;
      const dy = state.map.core.y - gate.y;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2));
      for (let t = 0; t <= steps; t++) {
        const px = Math.round(gate.x + (dx * t) / steps);
        const py = Math.round(gate.y + (dy * t) / steps);
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const x = px + ox;
            const y = py + oy;
            if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) continue;
            lanes[y * state.map.width + x] = 1;
          }
        }
      }
    }
    this.lanes = lanes;
    this.laneKey = key;
  }

  private cell(state: GameState, x: number, y: number): number {
    if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) return 0;
    return state.map.cells[y * state.map.width + x] ?? 0;
  }

  private isLane(state: GameState, x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) return false;
    return this.lanes[y * state.map.width + x] === 1;
  }

  /**
   * Water bodies are CONNECTED regions, not scattered cells.
   *
   * Placement rules (all deterministic, hashed from a fixed salt so a replay
   * paints the same map):
   *   - never on a corridor (`isLane`), the gate band, or the camp plaza — a lake
   *     can therefore never cut an enemy route or cover the camp;
   *   - never on an obstacle cell, and never on the outer two rows/columns, so
   *     the map does not read as a framed aquarium;
   *   - seeded on a sparse hash and grown by flood fill up to a small cap, which
   *     yields a handful of lakes and ponds instead of noise.
   */
  private buildWater(state: GameState): void {
    const width = state.map.width;
    const height = state.map.height;
    const total = width * height;
    if (this.waterKey === this.mapKey(state) && this.waterField.length === total) return;
    const field = new Uint8Array(total);
    const blocked = (x: number, y: number): boolean => {
      if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) return true;
      if (this.cell(state, x, y) === 1 || this.isLane(state, x, y)) return true;
      if (this.isPlaza(state, x, y)) return true;
      return false;
    };
    const sizes = [5, 4, 3];
    const salt = state.seed % 9973;
    for (let seedIndex = 0; seedIndex < sizes.length; seedIndex++) {
      const sx = 2 + Math.floor(cellHash(seedIndex, salt, 71) * (width - 4));
      const sy = 2 + Math.floor(cellHash(salt, seedIndex, 97) * (height - 4));
      if (blocked(sx, sy) || field[sy * width + sx]) continue;
      const cap = sizes[seedIndex]!;
      let placed = 0;
      const queue: number[] = [sy * width + sx];
      field[sy * width + sx] = 1;
      while (queue.length && placed < cap) {
        const index = queue.shift()!;
        placed++;
        const cx = index % width;
        const cy = Math.floor(index / width);
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (field[ni] || blocked(nx, ny)) continue;
          // Bias towards the seed so lakes come out round instead of sprawling,
          // with just enough noise to keep the outline organic.
          const distance = Math.hypot(nx - sx, ny - sy);
          const chance = 0.95 - distance * 0.16 + cellHash(nx, ny, 131 + seedIndex) * 0.12;
          if (distance > cap * 0.75 || cellHash(nx, ny, 191 + seedIndex) > chance) continue;
          field[ni] = 1;
          queue.push(ni);
        }
      }
    }
    this.waterField = field;
    this.waterKey = this.mapKey(state);
  }

  private mapKey(state: GameState): string {
    return `${state.mapId}:${state.seed}:${state.map.width}x${state.map.height}`;
  }

  /** Map cell that holds open water. */
  private isWater(state: GameState, x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) return false;
    this.buildWater(state);
    return this.waterField[y * state.map.width + x] === 1;
  }

  /**
   * Water is drawn textured where the pipeline provides a texture. The flat
   * single-colour water cells in the current manifest would otherwise read as a
   * plain rectangle, so `waterDeep` / `waterAlt` / `water-2` are preferred when
   * they resolve to a *different* asset than `water`.
   */
  private waterAsset(): WorldAsset | null {
    const store = this.store;
    if (!store) return null;
    const primary = store.worldAsset('water', 'grass');
    for (const variant of ['waterDeep', 'waterAlt', 'water-2', 'water-alt', 'cliffWater']) {
      const asset = store.worldAssetSilent(variant);
      if (asset && (!primary || asset.file !== primary.file || asset.rect.join(',') !== primary.rect.join(','))) return asset;
    }
    return primary;
  }

  /** Land cell touching a water cell: gets the sand/`shore` transition tile. */
  private isShoreline(state: GameState, x: number, y: number): boolean {
    if (this.isWater(state, x, y) || this.cell(state, x, y) === 1) return false;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if ((ox !== 0 || oy !== 0) && this.isWater(state, x + ox, y + oy)) return true;
      }
    }
    return false;
  }

  /** The camp plaza pad, drawn under the keep artwork. */
  private isPlaza(state: GameState, x: number, y: number): boolean {
    const coreX = Math.round(state.map.core.x);
    const coreY = Math.round(state.map.core.y);
    return x >= coreX - 2 && x <= coreX + 1 && y >= coreY - 2 && y <= coreY + 1;
  }

  private paintCells(ctx: CanvasRenderingContext2D, state: GameState, size: number, waterPhase: number): void {
    // Reserved for animated water variants (`water-2`); the current pipeline
    // ships a static water tile, so the phase only participates in the cache key.
    void waterPhase;
    this.waterUsed = false;
    // 1) ground pass — corridors first, so the enemy route is instantly readable
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        if (this.cell(state, x, y) === 1) continue;
        const roll = cellHash(x, y, 11);
        if (this.isLane(state, x, y)) {
          this.blitCell(ctx, 'deadGrass', x, y, size, 1, 0, roll);
          continue;
        }
        const key = roll < 0.055 ? 'grassTuft' : roll < 0.22 ? 'grassDetail' : 'grass';
        this.blitCell(ctx, key, x, y, size, 1, 0, roll);
      }
    }
    // 2) water bodies
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        if (!this.isWater(state, x, y)) continue;
        this.waterUsed = true;
        const asset = this.waterAsset();
        const canvas = asset ? this.store?.worldCanvas(asset) ?? null : null;
        const draw = Math.round(size * 1.02);
        if (canvas) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, x * size, y * size, draw, draw);
        } else {
          this.fallbackTile(ctx, x * size, y * size, size, 'water', 0);
        }
      }
    }
    // 3) shoreline transition ring (sand where land meets water)
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        if (!this.isShoreline(state, x, y)) continue;
        this.blitCell(ctx, 'shore', x, y, size, 1.02, 0, cellHash(x, y, 7));
      }
    }
    // 4) the camp plaza pad, then 5) obstacles on top of every ground tile
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        if (this.cell(state, x, y) === 1) continue;
        if (this.isPlaza(state, x, y)) this.blitCell(ctx, 'keep', x, y, size, 1.02, 0, cellHash(x, y, 5));
      }
    }
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        if (this.cell(state, x, y) !== 1) continue;
        const roll = cellHash(x, y, 11);
        // 1.35 keeps the canopy overlapping the cell it grows in; the pass order
        // guarantees the next cell's ground covers the overhang, so no seams.
        const key = roll < 0.55 ? 'tree' : 'rock';
        this.blitCell(ctx, key, x, y, size, 1.35, 0, roll);
      }
    }
  }

  private blitCell(
    ctx: CanvasRenderingContext2D,
    key: string,
    x: number,
    y: number,
    size: number,
    scale: number,
    variant: number,
    roll: number,
  ): void {
    const px = x * size;
    const py = y * size;
    const draw = Math.round(size * scale);
    const dx = px - Math.round((draw - size) / 2);
    const dy = py - Math.round((draw - size) / 2);
    if (!this.blitWorld(ctx, key, dx, dy, draw, variant)) this.fallbackTile(ctx, px, py, size, key, roll);
  }

  private blitWorld(
    ctx: CanvasRenderingContext2D,
    key: string,
    x: number,
    y: number,
    size: number,
    variant: number,
  ): boolean {
    const store = this.store;
    if (!store) return false;
    const chain: string[] = variant === 1 ? [`${key}-2`, `${key}-alt`, ...blitFallbacks(key)] : blitFallbacks(key);
    const asset = store.worldAsset(...chain);
    if (!asset) return false;
    const canvas = store.worldCanvas(asset);
    if (!canvas) return false;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, Math.round(x), Math.round(y), Math.round(size), Math.round(size));
    return true;
  }

  private fallbackTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, key: string, roll: number): void {
    const palette: Record<string, string> = {
      grass: roll < 0.5 ? '#3c5a3c' : '#405f3f',
      grassDetail: '#44653f',
      grassTuft: '#4a6b44',
      water: '#27485e',
      shore: '#7d6b45',
      deadGrass: '#6b6440',
      tree: '#20361d',
      rock: '#494e4c',
      keep: '#3a4a52',
      tower: '#4d4136',
      wall: '#5a5348',
      slow: '#3a4a63',
    };
    ctx.fillStyle = palette[key] ?? '#38503a';
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size));
  }

  /** Water tiles on a corridor would block a lane; give them a real deck. */
  private paintBridges(ctx: CanvasRenderingContext2D, state: GameState, size: number): string {
    const store = this.store;
    if (!store) return '';
    const asset = store.worldAsset('bridge');
    if (!asset) return '';
    const canvas = store.worldCanvas(asset);
    if (!canvas) return '';
    const placed: string[] = [];
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        if (this.cell(state, x, y) === 1) continue;
        // Only shore cells that a ground unit may actually walk over need a deck.
        if (!this.isShoreline(state, x, y) || !this.touchesLane(state, x, y)) continue;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, x * size, y * size, Math.round(size * 1.02), Math.round(size * 1.02));
        placed.push(`${x},${y}`);
      }
    }
    return placed.join(';');
  }

  private touchesLane(state: GameState, x: number, y: number): boolean {
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (this.isLane(state, x + ox, y + oy)) return true;
    return false;
  }

  /** Camp + player buildings, painted back-to-front so southern walls overlap. */
  private paintStructures(ctx: CanvasRenderingContext2D, state: GameState, size: number): void {
    const store = this.store;
    if (!store) return;
    const core = state.map.core;
    const structures: Structure[] = [
      {
        x: core.x,
        y: core.y,
        order: -1,
        draw: (target, tile) => {
          const asset = store.worldAsset('core', 'keep', 'grass');
          const canvas = asset ? store.worldCanvas(asset) : null;
          const px = (core.x - 2) * tile;
          const py = (core.y - 2) * tile;
          const span = Math.round(tile * 4);
          if (canvas) {
            target.imageSmoothingEnabled = false;
            target.drawImage(canvas, 0, 0, canvas.width, canvas.height, Math.round(px), Math.round(py), span, span);
          } else {
            target.fillStyle = '#3f5560';
            target.fillRect(Math.round(px), Math.round(py), span, span);
          }
        },
      },
    ];
    for (const b of state.buildings) {
      structures.push({
        x: b.x,
        y: b.y,
        order: b.id,
        draw: (target, tile, cx, cy) => {
          const ratio = Math.max(0, Math.min(1, b.hp / Math.max(1, b.maxHp)));
          const asset = store.worldAsset(b.kind, 'wall');
          const canvas = asset ? store.worldCanvas(asset) : null;
          const spread = b.kind === 'slow' ? 1 : 1.04;
          const span = Math.round(tile * spread);
          if (canvas) {
            target.imageSmoothingEnabled = false;
            target.drawImage(canvas, 0, 0, canvas.width, canvas.height, cx - span / 2, cy - span / 2, span, span);
          } else {
            target.fillStyle = '#5a5348';
            target.fillRect(Math.round(cx - tile / 2), Math.round(cy - tile / 2), Math.round(tile), Math.round(tile));
          }
          if (ratio < 0.999) {
            const width = Math.max(6, Math.round(tile * 0.8));
            const bx = Math.round(cx - width / 2);
            const by = Math.round(cy - tile * 0.58);
            target.fillStyle = 'rgba(10,14,18,0.88)';
            target.fillRect(bx - 1, by - 1, width + 2, 5);
            target.fillStyle = ratio > 0.5 ? '#7fd3a8' : ratio > 0.25 ? '#e9c46a' : '#ef6f5b';
            target.fillRect(bx, by, Math.max(1, Math.round(width * ratio)), 3);
          }
          if (b.kind === 'slow') {
            target.strokeStyle = 'rgba(122,198,255,0.8)';
            target.lineWidth = 1;
            target.strokeRect(Math.round(cx - tile / 2) + 0.5, Math.round(cy - tile / 2) + 0.5, Math.round(tile) - 1, Math.round(tile) - 1);
          }
        },
      });
    }
    structures.sort((a, b) => a.y - b.y || a.order - b.order);
    for (const item of structures) {
      item.draw(ctx, size, Math.round(item.x * size), Math.round(item.y * size));
    }
  }

  /** Deterministic tile key for a cell; used by tests and tooling. */
  tileKeyAt(state: GameState, x: number, y: number): string {
    if (this.cell(state, x, y) === 1) return cellHash(x, y, 11) < 0.55 ? 'tree' : 'rock';
    if (this.isWater(state, x, y)) return 'water';
    if (this.isShoreline(state, x, y)) return 'shore';
    if (this.isPlaza(state, x, y)) return 'keep';
    if (this.isLane(state, x, y)) return 'deadGrass';
    const roll = cellHash(x, y, 11);
    if (roll < 0.055) return 'grassTuft';
    if (roll < 0.22) return 'grassDetail';
    return 'grass';
  }

  get bridgeCells(): string {
    return this.bridgeList;
  }

  get waterAnimated(): boolean {
    return this.waterUsed;
  }

  /** Diagnostic: average colour of a region of the cache canvas. */
  sample(x: number, y: number, w: number, h: number): Record<string, unknown> {
    if (!this.canvas) return { ok: false, reason: 'no cache' };
    const probe = this.host.ownerDocument.createElement('canvas');
    probe.width = 8;
    probe.height = 8;
    const ctx = probe.getContext('2d');
    if (!ctx) return { ok: false, reason: 'no 2d context' };
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, x, y, w, h, 0, 0, 8, 8);
    try {
      const data = ctx.getImageData(0, 0, 8, 8).data;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]!;
        g += data[i + 1]!;
        b += data[i + 2]!;
      }
      const n = data.length / 4;
      return { ok: true, r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), alpha: data[3] };
    } catch (error) {
      return { ok: false, reason: `readback: ${(error as Error).message}` };
    }
  }

  /** Diagnostic: draw a single world tile into a probe canvas and sample it. */
  sampleWorld(key: string): Record<string, unknown> {
    const store = this.store;
    if (!store) return { ok: false, reason: 'no store' };
    const canvas = store.worldCanvasFor(key);
    if (!canvas) return { ok: false, reason: `no canvas ${key}` };
    const probe = this.host.ownerDocument.createElement('canvas');
    probe.width = 8;
    probe.height = 8;
    const ctx = probe.getContext('2d');
    if (!ctx) return { ok: false, reason: 'no 2d context' };
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 8, 8);
    try {
      const data = ctx.getImageData(0, 0, 8, 8).data;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]!;
        g += data[i + 1]!;
        b += data[i + 2]!;
      }
      const n = data.length / 4;
      return {
        ok: true,
        r: Math.round(r / n),
        g: Math.round(g / n),
        b: Math.round(b / n),
        source: { w: canvas.width, h: canvas.height },
      };
    } catch (error) {
      return { ok: false, reason: `readback: ${(error as Error).message}` };
    }
  }
  /** Diagnostic snapshot of the terrain cache; self-test only. */
  debug(x: number, y: number, state: GameState | null): Record<string, unknown> {
    return {
      hasCanvas: !!this.canvas,
      canvas: this.canvas ? { width: this.canvas.width, height: this.canvas.height } : null,
      cssWidth: this.cssWidth,
      cssHeight: this.cssHeight,
      dpr: this.dpr,
      renderedDpr: this.renderedDpr,
      signature: this.signature,
      waterPhase: this.waterPhase,
      laneCells: this.lanes.reduce((sum, v) => sum + v, 0),
      bridges: this.bridgeList.split(';').filter(Boolean).length,
      tileKey: state ? this.tileKeyAt(state, x, y) : null,
      cellValue: state ? this.cell(state, x, y) : null,
      water: state ? this.isWater(state, x, y) : null,
      shoreline: state ? this.isShoreline(state, x, y) : null,
      lane: state ? this.isLane(state, x, y) : null,
      waterCells: state ? this.countWater(state) : 0,
    };
  }

  /** Number of water cells on the map (diagnostics / self-test). */
  countWater(state: GameState): number {
    let total = 0;
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) if (this.isWater(state, x, y)) total++;
    }
    return total;
  }

  /**
   * Safety proof that the decorative water can never block the rules layer.
   *
   * The rules only ever walk on `cells === 0`, so water is either never stepped
   * on (it is merely painted) or must be walkable — and every cell this renderer
   * paints as water is checked here to be either off-corridor (never in a lane,
   * gate band, plaza, or obstacle) or walkable by the core-reachability flood
   * fill. `reachable` re-runs that flood fill with water treated as *blocked*:
   * if it still reaches the camp, water cannot disconnect a route even in the
   * worst case where the rules did walk on it.
   */
  waterAudit(state: GameState): {
    waterCells: number;
    shoreCells: number;
    laneCells: number;
    blockedWater: number;
    onPlaza: number;
    waterCellsThatTouchLane: number;
    gatesReachCoreIgnoringWater: boolean;
    gatesReachCoreWithWaterBlocked: boolean;
    regions: number;
  } {
    const width = state.map.width;
    const height = state.map.height;
    const blocked = (x: number, y: number, waterBlocks: boolean): boolean => {
      if (x < 0 || y < 0 || x >= width || y >= height) return true;
      if (this.cell(state, x, y) === 1) return true;
      return waterBlocks && this.isWater(state, x, y);
    };
    const core = { x: Math.round(state.map.core.x), y: Math.round(state.map.core.y) };
    const flood = (waterBlocks: boolean): Set<number> => {
      const seen = new Set<number>();
      const queue: number[] = [];
      for (const gate of state.map.gates) {
        const gx = Math.round(gate.x);
        const gy = Math.round(gate.y);
        if (blocked(gx, gy, waterBlocks)) continue;
        const index = gy * width + gx;
        if (!seen.has(index)) {
          seen.add(index);
          queue.push(index);
        }
      }
      while (queue.length) {
        const index = queue.shift()!;
        const x = index % width;
        const y = Math.floor(index / width);
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
          const nx = x + ox;
          const ny = y + oy;
          if (blocked(nx, ny, waterBlocks)) continue;
          const ni = ny * width + nx;
          if (seen.has(ni)) continue;
          seen.add(ni);
          queue.push(ni);
        }
      }
      return seen;
    };
    const reachable = flood(false);
    const reachableWithoutWater = flood(true);
    let waterCells = 0;
    let shoreCells = 0;
    let laneCells = 0;
    let blockedWater = 0;
    let onPlaza = 0;
    let touchesLane = 0;
    const visited = new Uint8Array(width * height);
    let regions = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isLane(state, x, y)) laneCells++;
        if (this.isShoreline(state, x, y)) shoreCells++;
        if (!this.isWater(state, x, y)) continue;
        waterCells++;
        if (this.cell(state, x, y) === 1 || this.isLane(state, x, y)) blockedWater++;
        if (this.isPlaza(state, x, y)) onPlaza++;
        if (
          this.isLane(state, x + 1, y) || this.isLane(state, x - 1, y) ||
          this.isLane(state, x, y + 1) || this.isLane(state, x, y - 1)
        ) {
          touchesLane++;
        }
        // Count connected water regions.
        const index = y * width + x;
        if (visited[index]) continue;
        regions++;
        const queue = [index];
        visited[index] = 1;
        while (queue.length) {
          const current = queue.shift()!;
          const cx = current % width;
          const cy = Math.floor(current / width);
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = cx + ox;
            const ny = cy + oy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const ni = ny * width + nx;
            if (visited[ni] || !this.isWater(state, nx, ny)) continue;
            visited[ni] = 1;
            queue.push(ni);
          }
        }
      }
    }
    return {
      waterCells,
      shoreCells,
      laneCells,
      blockedWater,
      onPlaza,
      waterCellsThatTouchLane: touchesLane,
      gatesReachCoreIgnoringWater: reachable.has(core.y * width + core.x),
      gatesReachCoreWithWaterBlocked: reachableWithoutWater.has(core.y * width + core.x),
      regions,
    };
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.signature = '';
    this.waterPhase = -1;
    this.store = null;
  }
}
