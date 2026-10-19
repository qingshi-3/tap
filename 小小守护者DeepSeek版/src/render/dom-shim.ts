/**
 * Minimal DOM / Canvas 2D shim so `BattleRenderer` can be exercised in Node
 * without a browser. It records geometry instead of rasterising; browser-side
 * visual verification runs in `output/render-check/check.html` (Playwright).
 *
 * The shim is only here to catch exceptions, NaN transforms and contract
 * violations in the draw path — it is never used by the game.
 */

export interface RecordedCall {
  op: string;
  args: number[];
}

export class FakeContext {
  readonly calls: RecordedCall[] = [];
  readonly ops = new Map<string, number>();
  canvas: FakeCanvas | null = null;
  imageSmoothingEnabled = true;
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  fillStyle: unknown = '#000';
  strokeStyle: unknown = '#000';
  lineWidth = 1;
  lineJoin = 'miter';
  textAlign = 'left';
  textBaseline = 'alphabetic';
  font = '10px sans-serif';
  private stack = 0;

  private note(op: string, ...args: number[]): void {
    this.ops.set(op, (this.ops.get(op) ?? 0) + 1);
    if (this.calls.length < 20000) this.calls.push({ op, args });
    for (const value of args) {
      if (!Number.isFinite(value)) throw new Error(`非有限坐标传入 ${op}: ${args.join(',')}`);
    }
    if (this.stack < 0) throw new Error('ctx 变换栈下溢');
  }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.note('setTransform', a, b, c, d, e, f);
  }

  resetTransform(): void {
    this.note('resetTransform');
  }

  save(): void {
    this.stack++;
    this.note('save');
  }

  restore(): void {
    if (this.stack <= 0) throw new Error('ctx 变换栈下溢');
    this.stack--;
    this.note('restore');
  }

  translate(x: number, y: number): void {
    this.note('translate', x, y);
  }

  scale(x: number, y: number): void {
    this.note('scale', x, y);
  }

  rotate(a: number): void {
    this.note('rotate', a);
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    this.note('clearRect', x, y, w, h);
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.note('fillRect', x, y, w, h);
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    this.note('strokeRect', x, y, w, h);
  }

  beginPath(): void {
    this.note('beginPath');
  }

  closePath(): void {
    this.note('closePath');
  }

  moveTo(x: number, y: number): void {
    this.note('moveTo', x, y);
  }

  lineTo(x: number, y: number): void {
    this.note('lineTo', x, y);
  }

  arc(x: number, y: number, r: number, s: number, e: number): void {
    this.note('arc', x, y, r, s, e);
  }

  ellipse(x: number, y: number, rx: number, ry: number, rot: number, s: number, e: number): void {
    this.note('ellipse', x, y, rx, ry, rot, s, e);
  }

  fill(): void {
    this.note('fill');
  }

  stroke(): void {
    this.note('stroke');
  }

  setLineDash(dash: number[]): void {
    this.note('setLineDash', ...dash);
  }

  fillText(text: string, x: number, y: number): void {
    this.note('fillText', x, y);
    this.ops.set(`text:${text}`, (this.ops.get(`text:${text}`) ?? 0) + 1);
  }

  strokeText(_text: string, x: number, y: number): void {
    this.note('strokeText', x, y);
  }

  measureText(text: string): { width: number } {
    return { width: text.length * 8 };
  }

  drawImage(...args: unknown[]): void {
    const numbers = args.filter((a): a is number => typeof a === 'number');
    this.note('drawImage', ...numbers);
  }

  createRadialGradient(): { addColorStop: () => void } {
    return { addColorStop: () => undefined };
  }

  getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray; width: number; height: number } {
    this.note('getImageData', x, y, w, h);
    // Fully transparent: the store then falls back to the manifest anchor and
    // the frame rect, which is the documented degraded path.
    return { data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h };
  }

  putImageData(): void {
    /* unused */
  }

  get width(): number {
    return this.canvas?.width ?? 300;
  }

  get height(): number {
    return this.canvas?.height ?? 150;
  }
}

export class FakeCanvas {
  style: Record<string, string> = {};
  parentNode: FakeElement | null = null;
  private context: FakeContext | null = null;

  constructor(public width = 300, public height = 150) {}

  /** Mirrors the real 2D context, whose `canvas` back-reference sees live size. */
  getContext(): FakeContext {
    if (!this.context) {
      this.context = new FakeContext();
      this.context.canvas = this;
    }
    return this.context;
  }

  getContexts(): FakeContext[] {
    return this.context ? [this.context] : [];
  }

  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }
}

export class FakeElement {
  style: Record<string, string> = {};
  clientWidth = 0;
  clientHeight = 0;
  readonly children: unknown[] = [];
  ownerDocument: FakeDocument;

  constructor(owner: FakeDocument, width: number, height: number) {
    this.ownerDocument = owner;
    this.clientWidth = width;
    this.clientHeight = height;
  }

  get width(): number {
    return this.clientWidth;
  }

  set width(value: number) {
    this.clientWidth = value;
  }

  get height(): number {
    return this.clientHeight;
  }

  set height(value: number) {
    this.clientHeight = value;
  }

  appendChild(child: unknown): unknown {
    this.children.push(child);
    if (child && typeof child === 'object' && 'parentNode' in child) {
      (child as { parentNode: unknown }).parentNode = this;
    }
    return child;
  }

  removeChild(child: unknown): unknown {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    return child;
  }

  addEventListener(): void {
    /* no-op */
  }

  removeEventListener(): void {
    /* no-op */
  }

  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
  }
}

export class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = 'async';
  width = 64;
  height = 64;
  crossOrigin: string | null = null;
  private source = '';

  set src(value: string) {
    this.source = value;
    if (value.includes('missing')) {
      queueMicrotask(() => this.onerror?.());
    } else {
      queueMicrotask(() => this.onload?.());
    }
  }

  get src(): string {
    return this.source;
  }
}

export class FakeDocument {
  private canvases: FakeCanvas[] = [];

  createElement(tag: string): FakeCanvas | FakeElement {
    if (tag === 'canvas') {
      const canvas = new FakeCanvas();
      this.canvases.push(canvas);
      return canvas;
    }
    return new FakeElement(this, 300, 150);
  }

  get createdCanvases(): readonly FakeCanvas[] {
    return this.canvases;
  }
}

export interface ShimEnv {
  host: FakeElement;
  document: FakeDocument;
  canvasOps(): Map<string, number>;
}

/** Install globals for `document` / `Image` / `window` and return a host element. */
export function installShim(width = 844, height = 390, devicePixelRatio = 1): ShimEnv {
  const document = new FakeDocument();
  const host = new FakeElement(document, width, height);
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.document = document;
  globals.Image = FakeImage;
  globals.devicePixelRatio = devicePixelRatio;
  globals.window = {
    devicePixelRatio,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  return {
    host,
    document,
    canvasOps: () => {
      const ops = new Map<string, number>();
      for (const canvas of document.createdCanvases) {
        for (const ctx of canvas.getContexts()) {
          for (const [op, count] of ctx.ops) ops.set(op, (ops.get(op) ?? 0) + count);
        }
      }
      return ops;
    },
  };
}

/** The canvas element the renderer appended to its host. */
export function mainCanvas(host: FakeElement): FakeCanvas | null {
  for (const child of host.children) {
    if (child instanceof FakeCanvas) return child;
  }
  return null;
}
