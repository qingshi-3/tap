/**
 * TEMPORARY self-test fixtures. Not shipped, not referenced by the game.
 *
 * Writes placeholder atlases + an `AssetManifest` into
 * `output/render-check/assets/` so the renderer can be exercised end to end
 * before the real `public/assets/manifest.json` exists. Nothing here is ever
 * copied into `public/assets/`.
 *
 * Run: node --experimental-strip-types src/render/fixture-manifest.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from './png.ts';
import type { AssetManifest, SpriteFrame, UnitAsset } from '../assets-types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../../output/render-check/assets');

const CELL = 40;
const COLS = 5;
const ROWS = 4;
const WORLD_TILE = 16;

type RGBA = { r: number; g: number; b: number; a: number };

function blank(width: number, height: number): Uint8Array {
  const px = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 10 : 16;
      px[i] = checker;
      px[i + 1] = checker + 4;
      px[i + 2] = checker + 8;
      px[i + 3] = 255;
    }
  }
  return px;
}

function paint(
  px: Uint8Array,
  width: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  color: RGBA,
): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x0 + x;
      const gy = y0 + y;
      if (gx < 0 || gy < 0 || gx >= width) continue;
      const i = (gy * width + gx) * 4;
      px[i] = color.r;
      px[i + 1] = color.g;
      px[i + 2] = color.b;
      px[i + 3] = color.a;
    }
  }
}

function tile(px: Uint8Array, width: number, col: number, row: number, fill: RGBA, edge: RGBA): void {
  const x0 = col * WORLD_TILE;
  const y0 = row * WORLD_TILE;
  paint(px, width, x0, y0, WORLD_TILE, WORLD_TILE, fill);
  for (let i = 0; i < WORLD_TILE; i++) {
    paint(px, width, x0 + i, y0, 1, 1, edge);
    paint(px, width, x0 + i, y0 + WORLD_TILE - 1, 1, 1, edge);
    paint(px, width, x0, y0 + i, 1, 1, edge);
    paint(px, width, x0 + WORLD_TILE - 1, y0 + i, 1, 1, edge);
  }
}

const WORLD_KEYS = [
  'grass', 'grassDetail', 'grassTuft', 'water',
  'tree', 'rock', 'bridge', 'shore',
  'deadGrass', 'keep', 'core', 'tower',
  'wall', 'slow', 'water-2', 'grass-2',
] as const;

const WORLD_COLORS: Record<string, [RGBA, RGBA]> = {
  grass: [{ r: 58, g: 92, b: 62, a: 255 }, { r: 40, g: 66, b: 44, a: 255 }],
  grassDetail: [{ r: 66, g: 104, b: 66, a: 255 }, { r: 42, g: 70, b: 46, a: 255 }],
  grassTuft: [{ r: 74, g: 110, b: 70, a: 255 }, { r: 44, g: 72, b: 48, a: 255 }],
  water: [{ r: 36, g: 74, b: 102, a: 255 }, { r: 24, g: 54, b: 78, a: 255 }],
  'water-2': [{ r: 42, g: 82, b: 112, a: 255 }, { r: 26, g: 58, b: 84, a: 255 }],
  tree: [{ r: 32, g: 62, b: 34, a: 255 }, { r: 20, g: 42, b: 24, a: 255 }],
  rock: [{ r: 96, g: 100, b: 98, a: 255 }, { r: 62, g: 66, b: 66, a: 255 }],
  'rock-2': [{ r: 104, g: 108, b: 106, a: 255 }, { r: 68, g: 72, b: 72, a: 255 }],
  shore: [{ r: 206, g: 188, b: 132, a: 255 }, { r: 168, g: 150, b: 104, a: 255 }],
  deadGrass: [{ r: 178, g: 172, b: 118, a: 255 }, { r: 140, g: 134, b: 90, a: 255 }],
  bridge: [{ r: 126, g: 96, b: 62, a: 255 }, { r: 86, g: 62, b: 40, a: 255 }],
  keep: [{ r: 96, g: 108, b: 116, a: 255 }, { r: 62, g: 74, b: 84, a: 255 }],
  core: [{ r: 122, g: 140, b: 152, a: 255 }, { r: 74, g: 92, b: 104, a: 255 }],
  tower: [{ r: 112, g: 96, b: 78, a: 255 }, { r: 74, g: 62, b: 50, a: 255 }],
  wall: [{ r: 138, g: 130, b: 118, a: 255 }, { r: 92, g: 86, b: 78, a: 255 }],
  slow: [{ r: 74, g: 96, b: 138, a: 255 }, { r: 48, g: 66, b: 98, a: 255 }],
  'grass-2': [{ r: 62, g: 98, b: 66, a: 255 }, { r: 42, g: 70, b: 46, a: 255 }],
};

interface UnitSpec {
  key: string;
  color: RGBA;
}

const UNITS: UnitSpec[] = [
  { key: 'shield-1', color: { r: 120, g: 158, b: 196, a: 255 } },
  { key: 'shield-2', color: { r: 138, g: 174, b: 210, a: 255 } },
  { key: 'shield-3', color: { r: 158, g: 192, b: 226, a: 255 } },
  { key: 'archer-1', color: { r: 128, g: 176, b: 132, a: 255 } },
  { key: 'archer-2', color: { r: 146, g: 192, b: 148, a: 255 } },
  { key: 'archer-3', color: { r: 166, g: 208, b: 166, a: 255 } },
  { key: 'engineer', color: { r: 220, g: 186, b: 112, a: 255 } },
  { key: 'grunt', color: { r: 210, g: 130, b: 108, a: 255 } },
  { key: 'siege', color: { r: 176, g: 132, b: 116, a: 255 } },
  { key: 'flyer', color: { r: 200, g: 148, b: 176, a: 255 } },
  { key: 'boss', color: { r: 214, g: 96, b: 74, a: 255 } },
  { key: 'mage-1', color: { r: 158, g: 132, b: 214, a: 255 } },
  { key: 'spear-1', color: { r: 190, g: 190, b: 150, a: 255 } },
  { key: 'rider-1', color: { r: 150, g: 190, b: 190, a: 255 } },
];

function build(): AssetManifest {
  mkdirSync(OUT, { recursive: true });

  // ---- world atlas ----
  const worldCols = 4;
  const worldRows = Math.ceil(WORLD_KEYS.length / worldCols);
  const worldW = worldCols * WORLD_TILE;
  const worldH = worldRows * WORLD_TILE;
  const worldPixels = blank(worldW, worldH);
  const world: AssetManifest['world'] = {};
  WORLD_KEYS.forEach((key, index) => {
    const col = index % worldCols;
    const row = Math.floor(index / worldCols);
    const [fill, edge] = WORLD_COLORS[key] ?? WORLD_COLORS.grass!;
    tile(worldPixels, worldW, col, row, fill, edge);
    world[key] = { file: 'atlas-world.png', rect: [col * WORLD_TILE, row * WORLD_TILE, WORLD_TILE, WORLD_TILE] };
  });
  writeFileSync(resolve(OUT, 'atlas-world.png'), encodePNG(worldW, worldH, worldPixels));

  // ---- unit atlas ----
  const atlasW = COLS * CELL;
  const atlasH = ROWS * CELL;
  const unitPixels = blank(atlasW, atlasH);
  const units: Record<string, UnitAsset> = {};
  const sequence = (row: number, count: number): SpriteFrame[] =>
    Array.from({ length: count }, (_, i) => ({
      file: 'atlas-units.png',
      rect: [0, row * CELL, CELL, CELL] as [number, number, number, number],
      offset: [i, row] as [number, number],
      duration: 0.1 + i * 0.02,
    }));
  UNITS.forEach((spec, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x0 = col * CELL;
    const y0 = row * CELL;
    paint(unitPixels, atlasW, x0 + 10, y0 + 4, 20, 32, spec.color);
    paint(unitPixels, atlasW, x0 + 14, y0, 12, 6, { r: 24, g: 30, b: 36, a: 255 });
    paint(unitPixels, atlasW, x0 + 13, y0 + 30, 6, 6, { r: 24, g: 30, b: 36, a: 255 });
    paint(unitPixels, atlasW, x0 + 21, y0 + 30, 6, 6, { r: 24, g: 30, b: 36, a: 255 });
    // Animation phases nudge the silhouette so frame changes are visible.
    for (let i = 1; i < COLS; i++) paint(unitPixels, atlasW, x0 + 10 + i, y0 + 4 - (i % 2), 20, 32, spec.color);
    const rect = [x0, y0, CELL, CELL] as [number, number, number, number];
    const at = (count: number, row_: number): SpriteFrame[] =>
      sequence(row_, count).map((f) => ({ ...f, rect }));
    units[spec.key] = {
      width: CELL,
      height: CELL,
      animations: { idle: at(COLS, row), walk: at(COLS, row), attack: at(4, row) },
      sourceId: `fixture-${spec.key}`,
      anchor: [20, 36],
    };
  });
  writeFileSync(resolve(OUT, 'atlas-units.png'), encodePNG(atlasW, atlasH, unitPixels));

  const manifest: AssetManifest = { units, world, ui: {} };
  writeFileSync(resolve(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('fixture-manifest.ts')) {
  const manifest = build();
  console.log(JSON.stringify({ out: OUT, units: Object.keys(manifest.units).length, world: Object.keys(manifest.world).length }));
}

export { build, OUT };
