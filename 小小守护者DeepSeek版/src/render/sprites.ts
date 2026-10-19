/**
 * Atlas loading + frame cache + per-unit body profiles.
 *
 * `Image` decoding is shared by file: every `SpriteFrame` in the manifest points
 * into an atlas PNG which is decoded exactly once and never re-decoded. Frames
 * are blitted with the source rect of the manifest, so the original artwork is
 * preserved 1:1 and is never recoloured.
 */
import type { AssetManifest, SpriteFrame, UnitAsset, WorldAsset } from '../assets-types.ts';
import type { Unit } from '../core/types.ts';

export type Ctx2D = CanvasRenderingContext2D;

export interface BodyProfile {
  /** Width of one unit body in cells. */
  body: number;
  /** Idle frame used for the ghost / sizing measurement. */
  idle: SpriteFrame;
  /** Opaque pixel box of `idle` inside its source image. */
  box: { x: number; y: number; w: number; h: number };
  /** Feet of the artwork in source pixels. */
  anchor: { x: number; y: number };
  /** Resolved clips; never empty (falls back to idle). */
  idleFrames: SpriteFrame[];
  walkFrames: SpriteFrame[];
  attackFrames: SpriteFrame[];
}

export const LEGION_BODY: Record<string, number> = {
  shield: 1.16, archer: 1.08, mage: 1.1, spear: 1.14, rider: 1.38,
};
export const ENEMY_BODY: Record<string, number> = {
  grunt: 1.02, siege: 1.42, flyer: 1.12, boss: 2.6, healer: 1.0,
  armored: 1.22, splitter: 1.06, raider: 1.1,
};
export const HERO_BODY: Record<string, number> = { engineer: 1.24, captain: 1.26, ranger: 1.18 };

export function bodyWidthFor(kind: Unit['kind']): number {
  return LEGION_BODY[kind] ?? ENEMY_BODY[kind] ?? HERO_BODY[kind] ?? 1.1;
}

export const LEGION_KINDS = ['shield', 'archer', 'mage', 'spear', 'rider'] as const;
const TIERED = new Set<string>(LEGION_KINDS);

export function frameKey(frame: SpriteFrame): string {
  return `${frame.file}|${frame.rect[0]},${frame.rect[1]},${frame.rect[2]},${frame.rect[3]}`;
}

interface Measured {
  image: CanvasImageSource;
  box: { x: number; y: number; w: number; h: number };
}

export class SpriteStore {
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly frames = new Map<string, HTMLCanvasElement>();
  private readonly measured = new Map<string, Measured>();
  private readonly profiles = new Map<string, BodyProfile | null>();
  private readonly frameLookup = new Map<string, SpriteFrame>();
  readonly warnings: string[] = [];
  /** Manifest tile-rect corrections the renderer applied (not degradation). */
  readonly corrections: string[] = [];
  private warned = new Set<string>();

  constructor(readonly manifest: AssetManifest) {}

  /** Every distinct atlas file referenced by the manifest. */
  files(): string[] {
    const files = new Set<string>();
    for (const asset of Object.values(this.manifest.world)) files.add(asset.file);
    for (const unit of Object.values(this.manifest.units)) {
      for (const clip of Object.values(unit.animations)) for (const frame of clip) files.add(frame.file);
    }
    return [...files];
  }

  async loadAll(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const list = this.files();
    let done = 0;
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const file = list[next++];
        const image = await decodeImage(assetURL(file));
        this.images.set(file, image);
        done++;
        onProgress?.(done, list.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, Math.max(1, list.length)) }, worker));
    if (done !== list.length) throw new Error('素材加载不完整');
    this.indexFrames();
  }

  private indexFrames(): void {
    for (const unit of Object.values(this.manifest.units)) {
      for (const clip of Object.values(unit.animations)) for (const frame of clip) this.frameLookup.set(frameKey(frame), frame);
    }
  }

  /** Resolve a clip frame back from its `frameKey`, so the timeline stays pure. */
  frameByKey(key: string, fallback: SpriteFrame): SpriteFrame {
    return this.frameLookup.get(key) ?? fallback;
  }

  warnOnce(key: string, message: string, into: string[] = this.warnings): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    into.push(message);
  }

  /** World tile lookup with an ordered fallback chain; warns once per miss. */
  worldAsset(...keys: string[]): WorldAsset | null {
    for (const key of keys) {
      const asset = this.manifest.world[key];
      if (asset) return asset;
    }
    this.warnOnce(`world:${keys[0]}`, `地景素材缺失 ${keys.join('/')}，已降级`);
    return null;
  }

  /** Same lookup, but optional keys never produce a degradation warning. */
  worldAssetSilent(...keys: string[]): WorldAsset | null {
    for (const key of keys) {
      const asset = this.manifest.world[key];
      if (asset) return asset;
    }
    return null;
  }

  /** Resolved world tile canvas by manifest key (rect corrections included). */
  worldCanvasFor(key: string): HTMLCanvasElement | null {
    const asset = this.worldAsset(key);
    return asset ? this.worldCanvas(asset) : null;
  }

  /** World tiles are small and reused; one canvas per distinct file+rect. */
  worldCanvas(asset: WorldAsset): HTMLCanvasElement | null {    const key = `world|${asset.file}|${asset.rect.join(',')}`;
    const cached = this.frames.get(key);
    if (cached) return cached;
    const image = this.images.get(asset.file);
    if (!image) {
      this.warnOnce(`worldfile:${asset.file}`, `图集未加载：${asset.file}`);
      return null;
    }
    const [sx, sy, sw, sh] = asset.rect;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw));
    canvas.height = Math.max(1, Math.round(sh));
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    this.frames.set(key, canvas);
    return canvas;
  }

  /** `shield-3` for tiered legions, the raw key otherwise. */
  keyFor(kind: Unit['kind'], tier: number): string {
    if (!TIERED.has(kind)) return kind;
    const wanted = Math.min(3, Math.max(1, Math.round(tier)));
    return `${kind}-${wanted}`;
  }

  assetFor(kind: Unit['kind'], tier: number): { key: string; asset: UnitAsset } | null {
    const key = this.keyFor(kind, tier);
    const direct = this.manifest.units[key];
    if (direct) return { key, asset: direct };
    if (TIERED.has(kind)) {
      for (let t = 1; t <= 3; t++) {
        const fallbackKey = `${kind}-${t}`;
        const fallback = this.manifest.units[fallbackKey];
        if (fallback) {
          this.warnOnce(`unit:${key}`, `素材缺失 ${key}，降级使用 ${fallbackKey}`);
          return { key: fallbackKey, asset: fallback };
        }
      }
    }
    this.warnOnce(`unit:${kind}`, `素材缺失 ${key}，改用占位标记`);
    return null;
  }

  /** Frame canvas keyed by source rect, built lazily and never rebuilt. */
  frameCanvas(frame: SpriteFrame): HTMLCanvasElement | null {    const key = frameKey(frame);
    const cached = this.frames.get(key);
    if (cached) return cached;
    const image = this.images.get(frame.file);
    if (!image) {
      this.warnOnce(`frame:${frame.file}`, `图集未加载：${frame.file}`);
      return null;
    }
    const [sx, sy, sw, sh] = frame.rect;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw));
    canvas.height = Math.max(1, Math.round(sh));
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    this.frames.set(key, canvas);
    return canvas;
  }

  /** Opaque bounding box of a frame, measured once from the decoded pixels. */
  measure(frame: SpriteFrame): Measured | null {
    const key = frameKey(frame);
    const cache = this.measured.get(key);
    if (cache) return cache;
    const canvas = this.frameCanvas(frame);
    if (!canvas) return null;
    const full = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    let box = full;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx && canvas.width > 0 && canvas.height > 0) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3]! > 12) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX >= 0) box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
    const value: Measured = { image: canvas, box };
    this.measured.set(key, value);
    return value;
  }

  idleFrame(asset: UnitAsset): SpriteFrame | null {
    return asset.animations.idle[0] ?? asset.animations.walk[0] ?? asset.animations.attack[0] ?? null;
  }

  /**
   * Sizing data for a unit key; measured from the artwork, cached by key.
   *
   * `anchor` is the frame's opaque bottom-centre, computed by the asset pipeline
   * across every frame of every clip, so it is the authoritative feet position.
   * The painted box is read from the decoded pixels; when a canvas cannot be
   * read back (tainted / restricted context) the box is estimated from the
   * anchor instead of falling back to the full padded frame, which would make
   * rings and shadows several times too large.
   */
  profile(kind: Unit['kind'], tier: number): BodyProfile | null {
    const found = this.assetFor(kind, tier);
    if (!found) return null;
    const resolvedKey = found.key;
    const cached = this.profiles.get(resolvedKey);
    if (cached !== undefined) return cached;
    const idle = this.idleFrame(found.asset);
    if (!idle) {
      this.warnOnce(`idle:${found.key}`, `${found.key} 缺少 idle 帧`);
      this.profiles.set(resolvedKey, null);
      return null;
    }
    const [ax, ay] = found.asset.anchor;
    const anchor = {
      x: Number.isFinite(ax) ? ax : idle.rect[2] / 2,
      y: Number.isFinite(ay) ? ay : idle.rect[3],
    };
    const measured = this.measure(idle)?.box;
    const box = measured ?? {
      x: anchor.x - idle.rect[2] * 0.25,
      y: anchor.y - idle.rect[3] * 0.68,
      w: idle.rect[2] * 0.5,
      h: idle.rect[3] * 0.68,
    };
    const idleFrames = found.asset.animations.idle.length ? found.asset.animations.idle : [idle];
    const walkFrames = found.asset.animations.walk.length ? found.asset.animations.walk : idleFrames;
    const attackFrames = found.asset.animations.attack.length ? found.asset.animations.attack : idleFrames;
    const value: BodyProfile = {
      body: bodyWidthFor(kind),
      idle,
      box,
      anchor,
      idleFrames,
      walkFrames,
      attackFrames,
    };
    this.profiles.set(resolvedKey, value);
    return value;
  }

  /** World units per source pixel for a profile. */
  scaleOf(profile: BodyProfile): number {
    return profile.body / Math.max(1, profile.box.w);
  }

  /** World-space box a unit occupies (for shadows, rings and hit flashes). */
  boxWorld(profile: BodyProfile): { x: number; y: number; w: number; h: number } {
    const scale = this.scaleOf(profile);
    // The sprite is positioned so the artwork anchor lands on the unit's feet.
    return {
      x: (profile.box.x - profile.anchor.x) * scale,
      y: (profile.box.y - profile.anchor.y) * scale,
      w: profile.box.w * scale,
      h: profile.box.h * scale,
    };
  }
}

export function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`素材加载失败：${src}`));
    image.src = src;
  });
}

export function assetURL(path: string): string {
  if (path.startsWith('data:') || path.startsWith('/') || /^[a-z]+:\/\//i.test(path)) return path;
  if (path.startsWith('./') || path.startsWith('../')) return path;
  // Note: the manifest stores paths relative to the site root, e.g.
  // `assets/atlases/x.png`; an already-prefixed path must not be doubled.
  if (path.startsWith('assets/')) return `./${path}`;
  return `./assets/${path}`;
}
