/**
 * BattleRenderer — the ONLY render entry point `src/app.ts` may use.
 *
 * Hand-written Canvas 2D engine (no PixiJS, no rendering library):
 *   - one offscreen canvas caches the whole static terrain layer,
 *   - one never-re-decoded atlas set feeds a frame cache,
 *   - every stroke and blit is aligned to whole device pixels,
 *   - the camera keeps cells legible and clamps so the map never shows a gap.
 *
 * `draw(state)` only reads the state. All presentation state (clip playback,
 * projectile lifetimes, particles, damage numbers) lives here and is derived
 * from `state.tick` plus hp deltas, which keeps a frame reproducible.
 */
import type { AssetManifest } from '../assets-types.ts';
import type { GameState, Point, Unit } from '../core/types.ts';
import { Camera, type Insets } from './camera.ts';
import { SpriteStore, frameKey } from './sprites.ts';
import { Terrain } from './terrain.ts';
import { Timeline, UnitPainter } from './units.ts';
import { Effects } from './effects.ts';
import { Hud, type PlacementPreview } from './hud.ts';

export type { Insets, PlacementPreview };

interface PreviousBody {
  hp: number;
  team: 'player' | 'enemy';
  x: number;
  y: number;
  fly: boolean;
}

interface RenderedBody {
  canvas: HTMLCanvasElement;
  scale: number;
  anchorX: number;
  anchorY: number;
}

export class BattleRenderer {
  /** true disables camera shake, particles and animation interpolation. */
  reduced = false;

  private readonly camera: Camera;
  private readonly store: SpriteStore;
  private readonly terrain: Terrain;
  private readonly timeline = new Timeline();
  private readonly effects = new Effects();
  private readonly hud = new Hud();
  private readonly painter: UnitPainter;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private ready = false;
  private destroyed = false;

  private selected: number | null = null;
  private preview: PlacementPreview | null = null;
  private lastState: GameState | null = null;
  private lastTick = -1;
  private pendingDelta = 0;

  private readonly previous = new Map<number, PreviousBody>();
  private readonly rendered = new Map<number, RenderedBody>();
  private coreHp = -1;
  private bossOnMap = false;
  private bossWarned = false;
  private lastMapKey = '';
  private lastTile = -1;
  private onWindowResize: (() => void) | null = null;

  constructor(private readonly container: HTMLElement, manifest: AssetManifest) {
    this.camera = new Camera(container);
    this.store = new SpriteStore(manifest);
    this.terrain = new Terrain(container);
    this.painter = new UnitPainter({
      store: this.store,
      tierOf: (unit) => this.tierOf(unit),
      selected: null,
      reduced: false,
      hurtFlash: true,
    });
  }

  /** Load every atlas and build the first frame; throws instead of faking art. */
  async init(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    await this.store.loadAll(onProgress);
    if (this.destroyed) return;
    this.terrain.bind({
      worldAsset: (...keys) => this.store.worldAsset(...keys),
      worldAssetSilent: (...keys) => this.store.worldAssetSilent(...keys),
      worldCanvas: (asset) => this.store.worldCanvas(asset),
      worldCanvasFor: (key) => this.store.worldCanvasFor(key),
    });
    const canvas = this.container.ownerDocument.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.imageRendering = 'pixelated';
    this.container.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ready = true;
    this.resize();
    if (this.lastState) this.draw(this.lastState);
    if (typeof window !== 'undefined') {
      this.onWindowResize = () => this.resize();
      window.addEventListener('resize', this.onWindowResize);
    }
  }

  /** Safe-area pixels; the HUD is DOM, so this only affects the camera. */
  setInsets(insets: Insets): void {
    this.camera.setInsets(insets);
    this.afterCameraChange();
  }

  /** Every frame; reads `state` only. */
  draw(state: GameState): void {
    const ctx = this.ctx;
    if (!this.ready || !ctx || !this.canvas) {
      this.lastState = state;
      this.lastTick = state.tick;
      return;
    }
    this.lastState = state;
    this.painter.setSelected(this.selected);
    this.painter.setReduced(this.reduced);

    this.camera.setMapSize(state.map.width, state.map.height);
    this.afterCameraChange();
    const mapKey = `${state.mapId}:${state.seed}`;
    if (this.lastMapKey !== mapKey) {
      this.lastMapKey = mapKey;
      this.previous.clear();
      this.rendered.clear();
      this.effects.clearTransient();
      this.timeline.clear();
      this.coreHp = -1;
      this.bossOnMap = false;
      this.bossWarned = false;
      this.camera.focus({ x: state.map.core.x, y: state.map.core.y });
      this.afterCameraChange();
      this.terrain.markDirty();
    }

    const dt = this.advanceTick(state);
    this.timeline.begin(state);
    this.effects.update(this.reduced ? Math.min(1, dt) : dt);
    this.effects.syncProjectiles(state);
    this.hud.beginFrame();
    this.detectCombat(state);

    const dpr = this.camera.devicePixelRatio;
    const cell = this.camera.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b1015';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const shake = this.reduced ? { x: 0, y: 0 } : Hud.shakeOffset(this.hud.shakeFor(this.hud.alert, state.tick), state.tick);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(shake.x, shake.y);
    this.camera.applyTransform(ctx);
    ctx.imageSmoothingEnabled = false;

    this.terrain.render(ctx, this.camera, state);
    this.drawGroundOverlays(ctx, state, cell);
    this.hud.drawViewportHint(ctx, this.camera);
    this.effects.drawCorpses(ctx);
    this.drawUnits(ctx, state, cell);
    this.effects.drawParticles(ctx, cell);
    this.effects.drawProjectiles(ctx, cell);
    this.effects.drawEffectRings(ctx, state, cell);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(shake.x, shake.y);
    this.effects.drawDamageNumbers(ctx, (p) => this.camera.toScreen(p), dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.hud.drawAlert(ctx, this.camera, state);
    this.hud.drawEdgeHints(ctx, this.camera, state, this.bossOnMap);
  }

  private drawGroundOverlays(ctx: CanvasRenderingContext2D, state: GameState, cell: number): void {
    if (this.preview) {
      this.hud.drawPreview(ctx, this.preview, cell, (kind, tier, at, valid) => this.drawGhost(ctx, kind, tier, at, valid, cell));
    }
    if (this.selected !== null) this.hud.drawSelection(ctx, state, this.selected, cell);
  }

  /** Translucent, mirrored-atlas ghost for the pending placement. */
  private drawGhost(
    ctx: CanvasRenderingContext2D,
    kind: string,
    tier: number,
    at: Point,
    valid: boolean,
    cell: number,
  ): void {
    const profile = this.painter.profileFor(kind as Unit['kind'], tier);
    if (!profile) {
      ctx.save();
      ctx.fillStyle = valid ? 'rgba(87,224,234,0.35)' : 'rgba(255,122,77,0.35)';
      ctx.fillRect(at.x - cell * 0.25, at.y - cell * 0.25, cell * 0.5, cell * 0.5);
      ctx.restore();
      return;
    }
    const frame = this.store.frameByKey(frameKey(profile.idle), profile.idle);
    const canvas = this.store.frameCanvas(frame);
    if (!canvas) return;
    const scale = this.painter.scaleFor(kind as Unit['kind'], tier, 1);
    ctx.save();
    ctx.globalAlpha = valid ? 0.5 : 0.32;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(at.x, at.y);
    ctx.scale(-1, 1);
    ctx.drawImage(
      canvas,
      0,
      0,
      canvas.width,
      canvas.height,
      -profile.anchor.x * scale,
      -profile.anchor.y * scale,
      canvas.width * scale,
      canvas.height * scale,
    );
    ctx.restore();
  }

  private drawUnits(ctx: CanvasRenderingContext2D, state: GameState, cell: number): void {
    const order = [...state.units].sort((a, b) => a.y - b.y || a.x - b.x || a.id - b.id);
    this.rendered.clear();
    for (const unit of order) {
      if (unit.hp <= 0) continue;
      const profile = this.painter.profileFor(unit.kind, this.tierOf(unit));
      if (!profile) continue;
      const key = frameKey(this.store.frameByKey(this.timeline.frameOf(unit, profile, this.reduced), profile.idle));
      const frame = this.store.frameByKey(key, profile.idle);
      const canvas = this.store.frameCanvas(frame);
      this.painter.draw(ctx, state, unit, cell, frame);
      if (canvas) {
        this.rendered.set(unit.id, {
          canvas,
          scale: this.painter.totalScale(unit, state),
          anchorX: profile.anchor.x,
          anchorY: profile.anchor.y,
        });
      }
    }
  }

  /** Read-only combat bookkeeping: hp deltas drive numbers, bursts and shake. */
  private detectCombat(state: GameState): void {
    const seen = new Set<number>();
    for (const unit of state.units) {
      if (unit.hp <= 0) continue;
      seen.add(unit.id);
      const previous = this.previous.get(unit.id);
      if (previous) {
        const delta = previous.hp - unit.hp;
        if (delta >= 1) {
          this.effects.damageNumber({ x: unit.x, y: unit.y - 1.05 }, delta);
          this.effects.spawnImpact({ x: unit.x, y: unit.y - 0.2 }, unit.team === 'player');
        }
      }
      this.previous.set(unit.id, { hp: unit.hp, team: unit.team, x: unit.x, y: unit.y, fly: unit.fly });
    }
    // Deaths: an enemy that was alive last frame and is gone now.
    for (const [id, previous] of this.previous) {
      if (seen.has(id)) continue;
      this.effects.killBurst({ x: previous.x, y: previous.y }, previous.team);
      const body = this.rendered.get(id);
      if (body) this.effects.addCorpse({ x: previous.x, y: previous.y }, body.canvas, body.scale, body.anchorX, body.anchorY);
      this.previous.delete(id);
    }
    for (const id of this.rendered.keys()) {
      if (!this.previous.has(id)) this.rendered.delete(id);
    }
    // Camp damage: flash at the keep + camera nudge.
    if (this.coreHp < 0) {
      this.coreHp = state.coreHp;
    } else if (state.coreHp < this.coreHp) {
      const lost = Math.round(this.coreHp - state.coreHp);
      this.coreHp = state.coreHp;
      this.effects.spawnImpact({ x: state.map.core.x, y: state.map.core.y }, true);
      this.effects.killBurst({ x: state.map.core.x, y: state.map.core.y }, 'enemy');
      this.hud.notify(`营地受击 -${lost}`, `剩余 ${Math.max(0, Math.round(state.coreHp))} / 100`, 'danger', state.tick, 44);
    } else if (state.coreHp > this.coreHp) {
      this.coreHp = state.coreHp;
    }
    // Interlude cues from `state.message`.
    this.trackMessage(state);
    // Boss arrival: one recognisable warning while it is on the map.
    const boss = state.units.some((u) => u.kind === 'boss' && u.team === 'enemy' && u.hp > 0);
    if (boss && !this.bossWarned) {
      this.bossWarned = true;
      this.hud.notify('警告 · 首领出现', '防线压力骤增，集中火力拦截', 'warn', state.tick, 150);
    }
    if (!boss && this.bossOnMap) this.bossWarned = false;
    this.bossOnMap = boss;
  }

  private trackMessage(state: GameState): void {
    const marker = `${state.phase}|${state.wave}|${state.message}`;
    if (marker === this.lastMessage) return;
    this.lastMessage = marker;
    if (state.phase === 'combat' && state.wave > 0) {
      this.hud.notify(`第 ${state.wave} 波`, state.message || '敌人正在推进', 'info', state.tick, 80);
    } else if (state.phase === 'won') {
      this.hud.notify('守住营地', '全部波次已清空', 'info', state.tick, 400);
    } else if (state.phase === 'lost') {
      this.hud.notify('营地失守', state.message || '本局结束', 'danger', state.tick, 400);
    }
  }

  private lastMessage = '';

  private advanceTick(state: GameState): number {
    if (state.tick < this.lastTick) {
      this.timeline.clear();
      this.effects.clearTransient();
      this.previous.clear();
      this.rendered.clear();
      this.coreHp = -1;
      this.pendingDelta = 0;
      this.lastMessage = '';
    }
    this.pendingDelta += Math.max(0, state.tick - this.lastTick);
    this.lastTick = state.tick;
    this.pendingDelta = Math.min(6, this.pendingDelta);
    return this.pendingDelta;
  }

  private tierOf(unit: Unit): number {
    if (unit.legionId === null) return 1;
    const legion = this.lastState?.legions.find((l) => l.id === unit.legionId);
    return legion?.tier ?? 1;
  }

  private afterCameraChange(): void {
    if (this.lastTile !== this.camera.scale) {
      this.lastTile = this.camera.scale;
      this.terrain.markDirty();
    }
  }

  resize(): void {
    this.camera.resize();
    this.afterCameraChange();
    if (this.canvas) {
      const dpr = this.camera.devicePixelRatio;
      const w = Math.max(1, Math.round(this.camera.hostSize.width * dpr));
      const h = Math.max(1, Math.round(this.camera.hostSize.height * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
    }
    if (this.lastState && this.ready) this.draw(this.lastState);
  }

  select(id: number | null): void {
    this.selected = id;
  }

  place(preview: PlacementPreview | null): void {
    this.preview = preview;
  }

  toScreen(p: Point): Point {
    return this.camera.toScreen(p);
  }

  toWorld(x: number, y: number): Point {
    return this.camera.toWorld(x, y);
  }

  pan(dx: number, dy: number): void {
    this.camera.panScreen(dx, dy);
  }

  /** Smoothly focus the camp and return to the play camera (leaves `fit()`). */
  focusCamp(state: GameState): void {
    this.camera.setMapSize(state.map.width, state.map.height);
    this.camera.focusPlay({ x: state.map.core.x, y: state.map.core.y });
    this.afterCameraChange();
  }

  /** Fit the whole map; the only mode allowed to shrink cells below 16px. */
  fit(): void {
    this.camera.fit();
    this.afterCameraChange();
  }

  toggleZoom(center: Point): void {
    this.camera.toggleZoom(center);
    this.afterCameraChange();
  }

  isVisible(p: Point): boolean {
    return this.camera.isVisible(p);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.onWindowResize && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onWindowResize);
      this.onWindowResize = null;
    }
    this.terrain.dispose();
    this.effects.clearTransient();
    this.previous.clear();
    this.rendered.clear();
    if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null;
    this.ctx = null;
    this.ready = false;
  }

  /** Asset keys the manifest could not provide; reported once each. */
  get warnings(): readonly string[] {
    return this.store.warnings;
  }

  /** Correctable manifest tile-rect fixes the renderer applied at draw time. */
  get corrections(): readonly string[] {
    return this.store.corrections;
  }

  /** Diagnostic: draw only the terrain layer, to isolate it from actors. */
  drawTerrainOnly(state: GameState): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;
    this.camera.setMapSize(state.map.width, state.map.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b1015';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.camera.devicePixelRatio, 0, 0, this.camera.devicePixelRatio, 0, 0);
    this.camera.applyTransform(ctx);
    ctx.imageSmoothingEnabled = false;
    this.terrain.render(ctx, this.camera, state);
  }

  /** Diagnostic: average RGB of every resolved world tile (colour audit). */
  tileColours(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(this.store.manifest.world)) {
      out[key] = this.terrain.sampleWorld(key);
    }
    return out;
  }

  /** Safety proof that decorative water cannot disconnect a route. */
  waterAudit(): Record<string, unknown> | null {
    return this.lastState ? { ...this.terrain.waterAudit(this.lastState) } : null;
  }

  /** Diagnostic: terrain cache geometry + the tile key at a map cell. */
  groundDebug(x: number, y: number): Record<string, unknown> {    const state = this.lastState;
    return {
      ...this.terrain.debug(x, y, state),
      sampleGrass: this.terrain.sample(13 * 26, 10 * 26, 26, 26),
      sampleWorldGrass: this.terrain.sampleWorld('grass'),
      sampleWorldTree: this.terrain.sampleWorld('tree'),
      viewport: this.camera.snapshot(),
    };
  }

  /** Diagnostics for the self-test harness (never used by the game loop). */
  get debug(): {
    ready: boolean;
    tile: number;
    zoom: number;
    overview: boolean;
    particles: number;
    projectiles: number;
    numbers: number;
    corpses: number;
  } {
    return {
      ready: this.ready,
      tile: this.camera.scale,
      zoom: this.camera.zoom,
      overview: this.camera.overview,
      particles: this.effects.particleCount,
      projectiles: this.effects.projectileCount,
      numbers: this.effects.numberCount,
      corpses: this.effects.corpseCount,
    };
  }
}
