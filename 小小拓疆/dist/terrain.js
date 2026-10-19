import { LEVEL } from './level.js';

const PIXEL_WORLD = 2;
const MAP_WIDTH = Math.ceil(LEVEL.world.width / PIXEL_WORLD);
const MAP_HEIGHT = Math.ceil(LEVEL.world.height / PIXEL_WORLD);
const SOURCE_ROOT = './assets/terrain-rpg/';
const SOURCE_PATHS = Object.freeze({
  nature: `${SOURCE_ROOT}Trees_rocks.png`,
});

const TREE_FRAMES = Object.freeze([
  Object.freeze({ x: 0, y: 0, w: 64, h: 80 }),
  Object.freeze({ x: 64, y: 0, w: 64, h: 80 }),
  Object.freeze({ x: 128, y: 0, w: 64, h: 80 }),
  Object.freeze({ x: 192, y: 0, w: 64, h: 80 }),
]);
const SHRUB_FRAMES = Object.freeze([
  Object.freeze({ x: 2, y: 83, w: 58, h: 42 }),
  Object.freeze({ x: 64, y: 86, w: 48, h: 37 }),
  Object.freeze({ x: 117, y: 80, w: 39, h: 48 }),
  Object.freeze({ x: 162, y: 86, w: 43, h: 41 }),
]);
const ROCK_FRAMES = Object.freeze([
  Object.freeze({ x: 3, y: 244, w: 58, h: 57 }),
  Object.freeze({ x: 73, y: 256, w: 47, h: 45 }),
  Object.freeze({ x: 129, y: 244, w: 61, h: 59 }),
  Object.freeze({ x: 198, y: 256, w: 53, h: 47 }),
]);

let terrainPromise = null;
let terrainCanvas = null;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load terrain asset: ${src}`));
    image.src = src;
  });
}

function seededRandom(seed = 0x7a7067) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function distanceToSegment(x, y, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2)) : 0;
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
}

function nearReserved(x, y, padding) {
  if (LEVEL.nodes.some((node) => Math.hypot(x - node.x, y - node.y) < padding + (node.kind === 'road' ? 32 : 105))) return true;
  if (LEVEL.slots.some((slot) => Math.hypot(x - slot.x, y - slot.y) < padding + 64)) return true;
  return LEVEL.roads.some((road) => road.points.some((point, index) => index > 0
    && distanceToSegment(x, y, road.points[index - 1], point) < padding + 34));
}

function drawSprite(ctx, image, frame, worldX, worldY, width, height, flip = false) {
  ctx.save();
  ctx.translate(Math.round(worldX / PIXEL_WORLD), Math.round(worldY / PIXEL_WORLD));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, -width / 2, -height, width, height);
  ctx.restore();
}

function traceRoads(ctx, roads = LEVEL.roads) {
  for (const road of roads) {
    if (!road.points.length) continue;
    ctx.moveTo(road.points[0].x / PIXEL_WORLD, road.points[0].y / PIXEL_WORLD);
    for (let index = 1; index < road.points.length; index += 1) {
      ctx.lineTo(road.points[index].x / PIXEL_WORLD, road.points[index].y / PIXEL_WORLD);
    }
  }
}

function noise(x, y, scale) {
  const hash = (a, b) => ((Math.imul(a, 374761393) ^ Math.imul(b, 668265263)) >>> 0) / 4294967295;
  const gx = Math.floor(x / scale), gy = Math.floor(y / scale);
  const sx = x / scale - gx, sy = y / scale - gy;
  const u = sx * sx * (3 - 2 * sx), v = sy * sy * (3 - 2 * sy);
  const a = hash(gx, gy) * (1 - u) + hash(gx + 1, gy) * u;
  const b = hash(gx, gy + 1) * (1 - u) + hash(gx + 1, gy + 1) * u;
  return a * (1 - v) + b * v;
}

function drawGround(ctx, random) {
  // One continuous road mask follows the real navigation graph. Ground is drawn
  // here rather than rotating tile corners into arbitrary diagonal road pieces.
  const mask = document.createElement('canvas');
  mask.width = MAP_WIDTH; mask.height = MAP_HEIGHT;
  const pen = mask.getContext('2d', { willReadFrequently: true });
  pen.lineCap = 'round'; pen.lineJoin = 'round';
  pen.filter = 'blur(1.5px)'; pen.strokeStyle = '#fff';
  const roadWidths = { main: 23, flank: 16, pass: 17, spur: 11 };
  for (const [role, roadWidth] of Object.entries(roadWidths)) {
    pen.lineWidth = roadWidth;
    pen.beginPath(); traceRoads(pen, LEVEL.roads.filter(road => (road.role || 'main') === role)); pen.stroke();
  }
  const coverage = pen.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT).data;
  const pixels = ctx.createImageData(MAP_WIDTH, MAP_HEIGHT);
  for (let y = 0; y < MAP_HEIGHT; y++) for (let x = 0; x < MAP_WIDTH; x++) {
    const i = (y * MAP_WIDTH + x) * 4;
    const meadow = noise(x + 31, y + 19, 117) * 8 + noise(x, y, 41) * 3;
    const grain = Math.floor(noise(x, y, 7) * 3);
    const edge = noise(x + 200, y, 4) * .24;
    const road = Math.max(0, Math.min(1, (coverage[i + 3] / 255 - .13 + edge) * 1.12));
    const grass = [134 + meadow, 158 + meadow, 91 + meadow * .55];
    const soil = [182 + grain, 157 + grain, 112 + grain];
    for (let c = 0; c < 3; c++) pixels.data[i + c] = grass[c] * (1 - road) + soil[c] * road;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  // Small, quiet grass tufts break up empty ground without repeating a tile grid.
  for (let i = 0; i < 950; i++) {
    const x = Math.floor(random() * MAP_WIDTH), y = Math.floor(random() * MAP_HEIGHT);
    if (coverage[(y * MAP_WIDTH + x) * 4 + 3] > 12) continue;
    ctx.fillStyle = i % 3 ? 'rgba(87,126,59,.17)' : 'rgba(216,222,150,.20)';
    ctx.fillRect(x, y, 1, 2); ctx.fillRect(x + 2, y - 1, 1, 3);
  }
}

function drawNature(ctx, art, random) {
  const props = [];
  const placeClusters = (frames, clusterCount, members, spread, padding, width, height) => {
    let placed = 0;
    for (let attempt = 0; attempt < clusterCount * 24 && placed < clusterCount; attempt += 1) {
      const border = random() < .5;
      const centerX = border
        ? (random() < .5 ? 60 + random() * 260 : LEVEL.world.width - 320 + random() * 260)
        : 90 + random() * (LEVEL.world.width - 180);
      const centerY = 70 + random() * (LEVEL.world.height - 140);
      if (nearReserved(centerX, centerY, padding)) continue;
      for (let member = 0; member < members; member += 1) {
        const angle = random() * Math.PI * 2;
        const radius = member ? 22 + random() * spread : 0;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (nearReserved(x, y, padding * .72)) continue;
        const frame = frames[Math.floor(random() * frames.length)];
        props.push({frame,x,y,width,height:width*frame.h/frame.w,flip:random()<.5});
      }
      placed += 1;
    }
  };

  placeClusters(TREE_FRAMES, 17, 3, 130, 78, 44, 57);
  placeClusters(SHRUB_FRAMES, 12, 3, 105, 56, 25, 27);
  placeClusters(ROCK_FRAMES, 10, 2, 100, 62, 34, 36);
  for(const p of props.sort((a,b)=>a.y-b.y))drawSprite(ctx,art.nature,p.frame,p.x,p.y,p.width,p.height,p.flip);
}

function buildTerrain(art) {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const random = seededRandom();
  drawGround(ctx, random);
  drawNature(ctx, art, random);
  return canvas;
}

export async function loadTerrain() {
  if (terrainCanvas) return terrainCanvas;
  if (!terrainPromise) {
    terrainPromise = Promise.all(Object.entries(SOURCE_PATHS).map(async ([key, src]) => [key, await loadImage(src)]))
      .then((entries) => {
        terrainCanvas = buildTerrain(Object.fromEntries(entries));
        return terrainCanvas;
      });
  }
  return terrainPromise;
}

export function drawTerrain(ctx, w, h, camera) {
  if (!terrainCanvas || !ctx || w <= 0 || h <= 0) return false;
  const zoom = Number.isFinite(camera?.zoom) && camera.zoom > 0 ? camera.zoom : 1;
  const cameraX = Number.isFinite(camera?.x) ? camera.x : 0;
  const cameraY = Number.isFinite(camera?.y) ? camera.y : 0;
  const sx = Math.max(0, cameraX / PIXEL_WORLD);
  const sy = Math.max(0, cameraY / PIXEL_WORLD);
  const sw = Math.max(0, Math.min(MAP_WIDTH - sx, w / zoom / PIXEL_WORLD));
  const sh = Math.max(0, Math.min(MAP_HEIGHT - sy, h / zoom / PIXEL_WORLD));
  if (!sw || !sh) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(terrainCanvas, sx, sy, sw, sh, 0, 0, sw * PIXEL_WORLD * zoom, sh * PIXEL_WORLD * zoom);
  ctx.restore();
  return true;
}
