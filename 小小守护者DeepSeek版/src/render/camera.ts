/**
 * Camera: integer-pixel world <-> screen mapping for the Canvas 2D battle view.
 *
 * World units are map cells (0,0 at the top-left corner of cell 0,0), screen
 * units are CSS pixels relative to the top-left of the canvas. Every transform
 * is snapped to whole device pixels and every scale factor is a whole number of
 * device pixels per cell, so terrain tiles and outline strokes never land on a
 * half pixel.
 */
import type { Point } from '../core/types.ts';

export interface Insets { top: number; right: number; bottom: number; left: number }

export interface Viewport { width: number; height: number; x: number; y: number }

const DEFAULT_WIDTH = 844;
const DEFAULT_HEIGHT = 390;

export class Camera {
  readonly insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  zoom: 1 | 2 = 1;
  overview = false;
  devicePixelRatio = 1;

  mapWidth = 30;
  mapHeight = 20;

  private size = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  /** Viewport in CSS pixels inside the safe area. */
  view: Viewport = { x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  /** Camera offset in CSS pixels, snapped to whole device pixels. */
  private offset = { x: 0, y: 0 };
  /** CSS pixels per cell. Always an integer, so cells are pixel-crisp. */
  tile = 24;

  constructor(private readonly host: HTMLElement) {
    this.resize();
  }

  setMapSize(width: number, height: number): void {
    const w = Number.isFinite(width) && width > 0 ? Math.round(width) : 30;
    const h = Number.isFinite(height) && height > 0 ? Math.round(height) : 20;
    if (w === this.mapWidth && h === this.mapHeight) return;
    this.mapWidth = w;
    this.mapHeight = h;
    this.resize();
  }

  setInsets(insets: Insets): void {
    const clean = (n: number) => (Number.isFinite(n) && n > 0 ? Math.min(400, Math.round(n)) : 0);
    this.insets.top = clean(insets.top);
    this.insets.right = clean(insets.right);
    this.insets.bottom = clean(insets.bottom);
    this.insets.left = clean(insets.left);
    this.resize();
  }

  /** Re-read host size + DPR, choose a readable tile size, keep the map on screen. */
  resize(): void {
    const measured = this.host.clientWidth > 0 && this.host.clientHeight > 0;
    this.size = measured
      ? { width: this.host.clientWidth, height: this.host.clientHeight }
      : { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    const dpr = typeof globalThis.devicePixelRatio === 'number' ? globalThis.devicePixelRatio : 1;
    this.devicePixelRatio = Math.min(2, Math.max(1, Number.isFinite(dpr) && dpr > 0 ? dpr : 1));

    const width = Math.max(64, this.size.width - this.insets.left - this.insets.right);
    const height = Math.max(64, this.size.height - this.insets.top - this.insets.bottom);
    this.view = { x: this.insets.left, y: this.insets.top, width, height };

    this.tile = this.overview ? this.overviewTile() : this.playTile();
    this.layout();
  }

  private overviewTile(): number {
    const fitW = this.view.width / this.mapWidth;
    const fitH = this.view.height / this.mapHeight;
    return Math.max(3, Math.floor(Math.min(fitW, fitH)));
  }

  /** Readable cells by default: the map may be larger than the viewport. */
  private playTile(): number {
    const target = Math.max(this.view.width / this.mapWidth, this.view.height / this.mapHeight);
    return Math.max(16, Math.min(48, Math.floor(target))) * this.zoom;
  }

  /** Size of the host element in CSS pixels (canvas backing store source). */
  get hostSize(): { width: number; height: number } {
    return { width: this.size.width, height: this.size.height };
  }

  /** Device pixels per cell actually used for drawing. */
  get scale(): number {
    return this.tile;
  }

  get origin(): Point {
    return { x: this.view.x + this.offset.x, y: this.view.y + this.offset.y };
  }

  get mapPixelWidth(): number {
    return this.mapWidth * this.tile;
  }

  get mapPixelHeight(): number {
    return this.mapHeight * this.tile;
  }

  /** CSS pixels per cell the play camera would use right now (no overview). */
  playScale(): number {
    const target = Math.max(this.view.width / this.mapWidth, this.view.height / this.mapHeight);
    return Math.max(16, Math.min(48, Math.floor(target))) * this.zoom;
  }

  /** Live camera snapshot, for the self-test report only. */
  snapshot(): string {
    return JSON.stringify({
      tile: this.tile, zoom: this.zoom, overview: this.overview, offset: this.offset,
      view: this.view, map: [this.mapWidth, this.mapHeight], dpr: this.devicePixelRatio,
    });
  }

  /** Clamp a CSS-pixel offset so the map never leaves a gap inside the viewport. */
  private clampOffset(x: number, y: number): { x: number; y: number } {
    const mapW = this.mapWidth * this.tile;
    const mapH = this.mapHeight * this.tile;
    const overflowX = mapW - this.view.width;
    const overflowY = mapH - this.view.height;
    // Overflowing axis: the map must always cover the viewport, so the offset
    // stays inside [-overflow, 0]. Fitting axis: the map is centred instead
    // (`(view - map) / 2`, a positive offset because a negative overflow would
    // otherwise push the map off screen).
    let cx: number;
    let cy: number;
    if (overflowX > 0) {
      cx = Math.min(0, Math.max(-overflowX, x));
    } else {
      cx = -overflowX / 2;
    }
    if (overflowY > 0) {
      cy = Math.min(0, Math.max(-overflowY, y));
    } else {
      cy = -overflowY / 2;
    }
    // Snap to whole device pixels: sub-pixel camera positions cause seams and
    // shimmering text on the scaled 2D context.
    const dpr = this.devicePixelRatio;
    return { x: Math.round(cx * dpr) / dpr, y: Math.round(cy * dpr) / dpr };
  }

  private layout(): void {
    const clamped = this.clampOffset(this.offset.x, this.offset.y);
    this.offset = clamped;
  }

  /** Keep a world point where it is on screen across a scale change. */
  private applyScale(previousTile: number, anchor: Point): void {
    const before = this.worldToScreen(anchor, previousTile);
    this.tile = this.overview ? this.overviewTile() : this.playTile();
    const after = this.worldToScreen(anchor, this.tile);
    this.offset = this.clampOffset(
      this.offset.x + (before.x - after.x),
      this.offset.y + (before.y - after.y),
    );
  }

  private worldToScreen(p: Point, tile: number): Point {
    return {
      x: this.view.x + this.offset.x + p.x * tile,
      y: this.view.y + this.offset.y + p.y * tile,
    };
  }

  toScreen(p: Point): Point {
    return this.worldToScreen(p, this.tile);
  }

  toWorld(x: number, y: number): Point {
    return {
      x: (x - this.view.x - this.offset.x) / this.tile,
      y: (y - this.view.y - this.offset.y) / this.tile,
    };
  }

  screenToWorldFromEvent(x: number, y: number): Point {
    const rect = this.host.getBoundingClientRect();
    return this.toWorld(x - rect.left, y - rect.top);
  }

  panScreen(dx: number, dy: number): void {
    this.offset = this.clampOffset(this.offset.x + dx, this.offset.y + dy);
  }

  /** Centre the view on a world point at the current zoom, then clamp. */
  focus(world: Point): void {
    this.offset = this.clampOffset(
      this.view.width / 2 - world.x * this.tile,
      this.view.height / 2 - world.y * this.tile,
    );
  }

  /** Back to the play camera (1x, readable cells) centred on a world point. */
  focusPlay(world: Point): void {
    this.overview = false;
    this.zoom = 1;
    this.tile = this.playTile();
    this.focus(world);
  }

  fit(): void {
    this.overview = true;
    this.zoom = 1;
    this.tile = this.overviewTile();
    this.offset = this.clampOffset(0, 0);
  }

  toggleZoom(anchor: Point): void {
    const previous = this.tile;
    this.overview = false;
    this.zoom = this.zoom === 1 ? 2 : 1;
    this.applyScale(previous, anchor);
  }

  /** True when the whole map is inside the viewport. */
  get mapFullyVisible(): boolean {
    return this.mapWidth * this.tile <= this.view.width + 0.5 && this.mapHeight * this.tile <= this.view.height + 0.5;
  }

  /** Map rectangle in screen CSS pixels. */
  mapScreenRect(): { x: number; y: number; width: number; height: number } {
    const o = this.origin;
    return { x: o.x, y: o.y, width: this.mapWidth * this.tile, height: this.mapHeight * this.tile };
  }

  /**
   * Region the play camera (zoom 1) would cover, projected into the current
   * overview. Used to draw the navigation rectangle when fitted.
   */
  viewportRect(): { x: number; y: number; width: number; height: number } {
    const scale = this.playScale();
    const o = this.origin;
    return {
      x: (this.view.x - o.x) / this.tile,
      y: (this.view.y - o.y) / this.tile,
      width: this.view.width / scale,
      height: this.view.height / scale,
    };
  }

  isVisible(p: Point): boolean {
    const s = this.toScreen(p);
    const margin = this.tile * 2;
    return (
      s.x >= this.view.x - margin &&
      s.y >= this.view.y - margin &&
      s.x <= this.view.x + this.view.width + margin &&
      s.y <= this.view.y + this.view.height + margin
    );
  }

  /**
   * World transform. Callers must already have `ctx.setTransform(dpr,0,0,dpr,0,0)`
   * applied so the context works in CSS pixels; cells then measure `tile` CSS
   * pixels on every display density.
   */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    const o = this.origin;
    ctx.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
    ctx.translate(o.x, o.y);
    ctx.scale(this.tile, this.tile);
  }
}
