import {
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  HemisphereLight,
  Object3D,
  PointLight,
  Scene,
  Vector3,
} from 'three';
import type { MapPathState } from './mapArt';
import { voxelBatches, type Box, type Motion } from './mapVoxelBatch';
import { landmark, relic, summit, tree } from './mapVoxelModels';
import { BIOMES, type Biome, type VoxelThemeInfo } from './mapVoxelThemes';
import { bridgeTop, clamp, follow, GATE_X, GRID, TILE_WIDTH, noise, random, type Terrain } from './mapVoxelTerrain';

type Rand = () => number;
const pick = (c: number[], r: number) => c[Math.min(c.length - 1, Math.floor(r * c.length))];
function tint(c: number, factor: number) {
  return (
    (Math.min(255, Math.round((c >> 16) * factor)) << 16) |
    (Math.min(255, Math.round(((c >> 8) & 255) * factor)) << 8) |
    Math.min(255, Math.round((c & 255) * factor))
  );
}
function geology(box: Box, land: Terrain, b: Biome, theme: VoxelThemeInfo) {
  const exposures = [
    [TILE_WIDTH, 0],
    [-TILE_WIDTH, 0],
    [0, GRID],
    [0, -GRID],
  ];
  for (const cell of land.cells.values()) {
    const { x, z, h, root, wet } = cell,
      r = noise(x, z);
    const neighbours = exposures.map(([dx, dz]) => land.at(x + dx, z + dz));
    const recess = neighbours.filter(n => n && n.h > h + 0.4).length;
    const patch = 0.5 + 0.24 * Math.sin(x * 0.38 + z * 0.21) + 0.18 * Math.cos(z * 0.52 - x * 0.13) + (r - 0.5) * 0.23;
    const top = wet
      ? tint(b.water, 0.56)
      : tint(pick(b.turf, clamp(patch, 0, 0.999)), 1 - recess * 0.024 + (r - 0.5) * 0.035);
    box(x, h - 0.4, z, TILE_WIDTH, 0.4, GRID, top);
    const cuts = [
      root,
      Math.max(root, -2.6 + Math.round(Math.sin(x * 0.39 + z * 0.2) * 2) * 0.4),
      Math.min(h - 1.52, 0.43 + Math.round(Math.sin(x * 0.24 - z * 0.19) * 2) * 0.36),
      h - 1.52,
      h - 0.4,
    ];
    for (let i = 1; i < cuts.length; i++) {
      const low = cuts[i - 1],
        high = cuts[i];
      if (high <= low || neighbours.every(n => n && n.h >= high && n.root <= low)) continue;
      box(x, low, z, TILE_WIDTH, high - low, GRID, tint(b.rock[[0, 1, 2, 4][i - 1]], 0.94 + 0.1 * r));
      if (i === 3 && high - low > 1.35 && r > 0.38)
        box(x, high - 0.65, z, TILE_WIDTH + 0.025, 0.24, GRID + 0.025, tint(b.rock[3], 0.88 + r * 0.12));
    }
    if (wet) {
      const level = land.waterLevel(z);
      box(x, h, z, TILE_WIDTH, level - h, GRID, b.water, 'water');
      if (r > 0.7)
        box(x + (r - 0.78) * 0.5, level + 0.012, z, 0.12, 0.065, 0.45 + r * 0.41, b.foam, 'light', (o, t) => {
          o.position.z += Math.sin(t * 1.9 + r * 21) * 0.27;
          o.scale.z *= 0.7 + 0.29 * Math.sin(t * 2 + r * 41);
        });
    }
    // Projecting shelves break the continuous cliff bands into columnar buttresses.
    // The outcrop and mineral vein sit on the outward-facing side of the actual cell.
    if (!wet && !land.at(x, z + GRID) && r > 0.48) {
      const base = root - 0.8 - r * 1.85,
        crown = Math.min(h - 0.52, 1.4 + r * 1.65);
      box(x, base, z + 0.48, 0.68 + r * 0.39, crown - base, 0.74, tint(b.rock[1], 0.87 + r * 0.22));
      box(x, crown - 0.12, z + 0.5, 0.82 + r * 0.38, 0.38, 0.82, b.rock[2]);
      box(x, base - 0.77, z + 0.4, 0.47, 0.81, 0.43, b.rock[0]);
      if (r > 0.58) {
        box(x + 0.18, base - 0.85, z + 0.62, 0.22, 0.92, 0.27, tint(b.foam, 0.83), 'light');
        box(x + 0.18, base - 1.16, z + 0.62, 0.12, 0.32, 0.16, b.foam, 'light');
      }
      if (theme.id === 'emerald_day' || theme.id === 'autumn_sunset' || theme.id === 'moonlit_woods') {
        box(x - 0.25, h - 1.17, z + 0.62, 0.37, 1.18, 0.23, b.turf[0]);
        box(x - 0.19, h - 1.62, z + 0.65, 0.19, 0.5, 0.19, b.leaf[2]);
      }
    }
    if (theme.id === 'ashen_citadel' && !wet && Math.abs(x - land.river(z)) < 3.7 && r > 0.5) {
      box(x, h + 0.015, z, 0.33 + r * 0.37, 0.052, 0.09, 0xfa7239, 'light');
      box(x + 0.15, h + 0.015, z + 0.13, 0.11, 0.052, 0.31, 0xff9d4e, 'light');
    }
    if (z > 0 && neighbours.some(n => !n || n.root > root + 2) && r > 0.68) {
      box(x, root - 0.57, z, 0.56, 1.14, 0.62, b.rock[1]);
      if (r > 0.8) {
        box(x, root - 1.17, z, 0.32, 0.8, 0.34, tint(b.foam, 0.76), 'light');
        box(x, root - 1.48, z, 0.15, 0.34, 0.18, b.foam, 'light');
      }
    }
  }
}

function waterfall(box: Box, land: Terrain, b: Biome, rng: Rand) {
  // Each wet column ends at its own cliff lip, even on a diagonally stepped shoreline.
  const lip = [...land.cells.values()].filter(c => c.wet && c.z > 8 && !land.at(c.x, c.z + GRID));
  const outlet = lip.length
    ? lip
    : [...land.cells.values()]
        .filter(c => c.wet && c.z > 8)
        .sort((a, b) => b.z - a.z)
        .slice(0, 2);
  const center = new Vector3();
  for (const c of outlet) {
    const z = c.z + GRID * 0.48,
      level = land.waterLevel(c.z),
      base = c.root - 3.8;
    center.add(new Vector3(c.x, level, z));
    for (let strand = 0; strand < 4; strand++) {
      const x = c.x + (TILE_WIDTH * (strand - 1.5)) / 4,
        bottom = base - rng() * 1.4;
      box(x, bottom, z, TILE_WIDTH / 4, level - bottom, 0.29, tint(b.water, 0.9 + strand * 0.055), 'water');
      for (let j = 0; j < 3; j++) {
        const phase = rng(),
          height = 0.42 + rng() * 1.14;
        box(x, bottom, z + 0.17, 0.1 + rng() * 0.085, height, 0.11, b.foam, 'light', (o, t) => {
          o.position.y = level - height / 2 - ((phase + t * 0.76) % 1) * (level - bottom - height);
        });
      }
    }
    for (let j = 0; j < 13; j++) {
      const a = rng() * Math.PI * 2,
        phase = rng(),
        s = 0.18 + rng() * 0.46;
      box(c.x, base, z, s, s * 0.67, s, b.foam, 'cloud', (o, t) => {
        const u = (phase + t * 0.57) % 1;
        o.position.x += Math.cos(a) * u * 1.6;
        o.position.z += Math.sin(a) * u * 1.1;
        o.position.y += Math.sin(u * Math.PI) * 0.85;
        o.scale.multiplyScalar(0.1 + Math.sin(u * Math.PI) * 0.95);
      });
    }
  }
  return center.divideScalar(outlet.length || 1);
}

function infrastructure(box: Box, land: Terrain, theme: VoxelThemeInfo, b: Biome) {
  const occupied = new Set<string>();
  const gridKey = (x: number, z: number) => Math.round(x) + ',' + Math.round(z);
  function reserve(x: number, z: number, radius: number) {
    for (let dx = -radius; dx <= radius; dx++)
      for (let dz = -radius; dz <= radius; dz++)
        if (dx * dx + dz * dz <= radius * radius + 1) occupied.add(gridKey(x + dx, z + dz));
  }
  const laid = new Set<string>();
  for (const road of land.roads.values()) {
    const n = Math.ceil(road.length / 0.87),
      { span } = road;
    for (let i = 0; i < n; i++) {
      const p = follow(road, (i + 0.5) / n);
      reserve(p.x, p.z, 1);
      if (span && Math.abs(p.x - span.x) < span.half && Math.abs(p.z - span.z) < 0.74) continue;
      const key = gridKey(p.x * 1.8, p.z * 1.8);
      if (laid.has(key)) continue;
      laid.add(key);
      const a = follow(road, i / n),
        v = follow(road, (i + 1) / n);
      const r = noise(i, road.length);
      box(
        p.x,
        p.y - 0.28,
        p.z,
        0.96 + r * 0.16,
        0.28,
        Math.hypot(v.x - a.x, v.z - a.z) + 0.045,
        tint(b.road, 0.9 + r * 0.12),
        'solid',
        undefined,
        Math.atan2(v.x - a.x, v.z - a.z),
      );
    }
  }
  for (const span of land.spans.values()) {
    const { x, z, half } = span,
      step = (half * 2) / 11;
    for (let i = 0; i < 11; i++) {
      const dx = -half + (i + 0.5) * step,
        top = bridgeTop(span, x + dx);
      const thick = 0.35 + Math.pow(Math.abs(dx) / half, 2) * 0.95;
      box(x + dx, top - thick, z, step + 0.008, thick, 1.72, i % 2 ? b.rock[3] : b.road);
      for (const sign of [-1, 1]) {
        box(x + dx, top - 0.21, z + sign * 0.8, step, 0.32, 0.21, b.rock[3]);
        box(x + dx, top + 0.55, z + sign * 0.83, step + 0.012, 0.14, 0.15, b.road);
        if (i % 3 === 0 || i === 10) box(x + dx, top, z + sign * 0.83, 0.17, 0.59, 0.18, b.rock[2]);
      }
    }
    for (const dir of [-1, 1]) {
      const px = x + dir * (half - 0.3),
        floor = land.ground(px, z) - 0.3;
      box(px, floor, z, 0.65, Math.max(0.3, bridgeTop(span, px) - floor), 1.9, b.rock[2]);
      box(px, bridgeTop(span, px) + 0.6, z - 0.84, 0.23, 0.22, 0.24, 0xffcf76, 'light');
    }
  }
  for (const site of land.sites.values()) {
    landmark(box, site, theme.id, b);
    reserve(site.pos.x, site.pos.z - 1, site.spec.kind === 'boss' ? 5 : 3);
  }
  // Western landing pier, with a square timber gate and a hanging banner.
  const gateZ = 0,
    gateX = GATE_X,
    h = land.ground(gateX, gateZ);
  reserve(gateX, gateZ, 3);
  for (let i = 0; i < 7; i++) box(gateX - i * 0.43, h - 0.18, gateZ, 0.41, 0.28, 2.45, i % 2 ? 0x96704e : 0xaa8158);
  for (const side of [-1, 1]) {
    box(gateX, h, gateZ + side * 1.26, 0.34, 2.58, 0.34, 0x725747);
    box(gateX - 0.14, h + 1.48, gateZ + side * 1.26, 0.34, 0.41, 0.31, 0xffcc71, 'light');
    box(gateX - 2.3, h - 1.7, gateZ + side * 0.98, 0.31, 1.8, 0.31, 0x695346);
  }
  box(gateX, h + 2.58, gateZ, 0.48, 0.34, 2.98, 0x745343);
  box(gateX, h + 2.08, gateZ - 0.55, 0.18, 0.51, 0.8, b.flag);
  return (x: number, z: number) => occupied.has(gridKey(x, z));
}

function garden(
  box: Box,
  land: Terrain,
  theme: VoxelThemeInfo,
  b: Biome,
  rng: Rand,
  busy: (x: number, z: number) => boolean,
  remaining: () => number,
) {
  const trunks: Vector3[] = [],
    sites = [...land.sites.values()];
  for (let attempt = 0; attempt < 490 && trunks.length < 47 && remaining() > 230; attempt++) {
    const x = (rng() - 0.5) * 80,
      z = (rng() - 0.5) * 33,
      c = land.at(x, z),
      r = rng();
    if (!c || c.wet || busy(x, z) || Math.abs(x - land.river(z)) < 2.3) continue;
    const grove = Math.sin(x * 0.31 + z * 0.18) + Math.cos(z * 0.46 - x * 0.11);
    if ((grove < -0.23 && r < 0.85) || trunks.some(p => Math.hypot(p.x - x, p.z - z) < 2.05)) continue;
    // Preserve foreground sight lines to the platform, including from either end of the orbit.
    if (sites.some(s => Math.abs(s.pos.x - x) < 2.4 && z > s.pos.z && z < s.pos.z + 6)) continue;
    tree(box, theme.id, b, x, c.h, z, (z > 6 ? 0.58 : 0.76) + r * 0.51, r);
    trunks.push(new Vector3(x, c.h, z));
  }
  let relics = 0;
  for (let i = 0; i < 235 && remaining() > 28; i++) {
    const x = (rng() - 0.5) * 80,
      z = (rng() - 0.5) * 34,
      c = land.at(x, z);
    if (!c || c.wet || busy(x, z) || trunks.some(p => Math.hypot(p.x - x, p.z - z) < 1)) continue;
    if (relics < (theme.id === 'golden_oasis' ? 2 : 11) && i % 5 === 0 && z < 4) {
      relic(box, theme.id, b, x, c.h, z);
      relics++;
      continue;
    }
    const r = rng(),
      snow = theme.id === 'alpine_snow',
      ash = theme.id === 'ashen_citadel';
    box(x, c.h, z, 0.23 + r * 0.25, 0.19 + r * 0.31, 0.2 + r * 0.19, ash || snow ? b.rock[2] : b.leaf[2]);
    box(x + 0.18, c.h, z + 0.12, 0.16, 0.23, 0.17, ash ? b.rock[3] : b.leaf[3]);
    if (r > 0.58)
      box(
        x,
        c.h + 0.17 + r * 0.31,
        z,
        0.21,
        0.16,
        0.22,
        ash ? b.foam : snow ? b.turf[0] : pick([0xe4c66d, 0xffeac1, 0xd98997], rng()),
        ash ? 'light' : 'solid',
      );
  }
  if (theme.id === 'moonlit_woods')
    for (const { pos } of sites.filter((_, i) => i % 3 === 0)) {
      const x = pos.x - 1.62,
        z = pos.z - 0.52,
        y = land.ground(x, z);
      box(x, y, z, 0.14, 1.81, 0.15, 0x5f5551);
      box(x + 0.18, y + 1.8, z, 0.52, 0.12, 0.16, b.road);
      box(x + 0.37, y + 1.37, z, 0.31, 0.4, 0.31, 0xffd47b, 'light');
    }
}

function heavens(box: Box, theme: VoxelThemeInfo, b: Biome, rng: Rand) {
  // Distant stepped silhouettes, with a second band of clouds below the island roots.
  for (let n = 0; n < 24; n++) {
    const x = ((n % 8) - 3.5) * 12 + (rng() - 0.5) * 9,
      far = n < 10;
    const z = far ? -27 - rng() * 21 : 3 + rng() * 17,
      y = far ? -13 - rng() * 5 : -10 - rng() * 4;
    const phase = rng() * 6,
      size = far ? 1.2 + rng() * 0.8 : 0.68 + rng() * 0.65;
    const drift: Motion = (o, t) => {
      o.position.x += Math.sin(t * 0.1 + phase) * 1.15;
      o.position.y += Math.cos(t * 0.17 + phase) * 0.24;
    };
    for (let j = 0; j < 6; j++) {
      const dx = (j - 2.5) * 1.46,
        dome = 1 - Math.abs(j - 2.5) / 3;
      box(
        x + dx * size,
        y + rng() * 0.36,
        z + rng() * 1.1,
        2.75 * size,
        (0.5 + dome * 1.08) * size,
        (1.8 + rng()) * size,
        tint(b.cloud, 0.97 + rng() * 0.03),
        'cloud',
        drift,
      );
      if (j === 2 || j === 3)
        box(
          x + dx * size,
          y + size,
          z + 0.5,
          2.1 * size,
          (0.83 + rng() * 0.3) * size,
          2 * size,
          b.cloud,
          'cloud',
          drift,
        );
    }
  }
  const night = theme.tone === 'night',
    crescent = theme.id === 'moonlit_woods',
    eclipse = theme.id === 'ashen_citadel';
  const sunX = -37,
    sunZ = -38,
    sunY = -1.8,
    unit = 0.59;
  // Build the heavenly body from contiguous horizontal voxel runs; the crescent has a real cutout.
  for (let row = -5; row <= 5; row++) {
    let start = -6,
      color = 0;
    for (let col = -5; col <= 6; col++) {
      const rr = col * col + row * row;
      let pixel = rr <= 29 ? (eclipse ? (col + row < 1 ? 0xff805f : 0xf5534f) : 0xffe8a4) : 0;
      if (crescent) pixel = rr <= 29 && (col - 2.5) ** 2 + (row - 1.65) ** 2 > 22 ? 0xffecc1 : 0;
      if (eclipse && rr <= 19) pixel = 0x7b3547;
      if (pixel === color) continue;
      if (color)
        box(
          sunX + ((start + col - 1) * unit) / 2,
          sunY + row * unit,
          sunZ,
          (col - start) * unit,
          unit,
          0.68,
          color,
          'light',
        );
      color = pixel;
      start = col;
    }
  }
  if (night)
    for (let i = 0; i < 85; i++) {
      const x = (rng() - 0.5) * 118,
        z = -37 - rng() * 26,
        y = -28 + rng() * 28,
        s = 0.065 + rng() * 0.14;
      box(x, y, z, s, s, s, i % 4 ? 0xbfcbde : 0xffdd9a, 'light');
      if (i % 14 === 0) {
        box(x, y + s * 0.4, z, s * 2.6, s * 0.28, s * 0.6, b.foam, 'light');
        box(x, y - s * 0.55, z, s * 0.28, s * 2.2, s * 0.6, b.foam, 'light');
      }
    }
  for (const [n, coords] of [
    [-44, 2, -8],
    [-30, 3.3, -24],
    [-8, 4, -23],
    [40, 3, -22],
    [44, -3, 7],
    [-39, -4, 13],
  ].entries()) {
    const [x, y, z] = coords,
      phase = n * 1.9;
    const float: Motion = (o, t) => {
      o.position.y += 0.36 * Math.sin(t * 0.52 + phase);
    };
    const part: Box = (dx, dy, dz, w, h, d, c, batch) => box(x + dx, y + dy, z + dz, w, h, d, c, batch, float);
    const s = 0.73 + (n % 3) * 0.2;
    for (let ix = -2; ix <= 2; ix++)
      for (let iz = -1; iz <= 1; iz++) {
        if (Math.abs(ix) + Math.abs(iz) > 2 && rng() > 0.36) continue;
        const depth = (3 - Math.abs(ix) * 0.62 - Math.abs(iz) * 0.61) * s;
        part(ix * s, -depth, iz * s, s, depth, s, b.rock[Math.abs(ix) % 3]);
        part(ix * s, 0, iz * s, s, 0.31, s, pick(b.turf, rng()));
      }
    if (n === 1 || n === 2 || n === 4) summit(part, theme.id, b, 0, 0.31, 0, 0.76);
    else tree(part, theme.id, b, 0, 0.31, 0, 0.54 + rng() * 0.24, rng());
    if (n % 2 === 0) {
      part(0.68 * s, -2.33, s * 1.45, 0.38, 2.65, 0.19, b.water, 'water');
      part(0.67 * s, -2.71, s * 1.46, 0.12, 2.9, 0.22, b.foam, 'light');
    }
  }
}

function weather(box: Box, land: Terrain, id: string, b: Biome, rng: Rand) {
  const snow = id === 'alpine_snow',
    leaf = id === 'autumn_sunset',
    ash = id === 'ashen_citadel',
    night = id === 'moonlit_woods';
  for (let i = 0; i < (snow || night ? 91 : 54); i++) {
    const x = (rng() - 0.5) * 70,
      z = (rng() - 0.5) * 34,
      y = land.ground(x, z),
      p = rng(),
      a = rng() * 6.28;
    const s = snow ? 0.1 + p * 0.11 : leaf ? 0.15 + p * 0.12 : 0.065 + p * 0.1;
    const c = leaf ? pick(b.leaf, rng()) : snow ? 0xf5faff : ash ? 0xff9b45 : night ? 0xffe991 : 0xffe7a6;
    box(x, y + 0.5, z, s, leaf ? s * 0.39 : s, leaf ? s * 0.69 : s, c, leaf ? 'solid' : 'light', (o, t) => {
      const u = (p + t * (snow ? 0.11 : ash ? 0.22 : 0.15)) % 1;
      o.position.x += Math.sin(t * 0.73 + a) * 0.71 + (snow || leaf ? u * 0.94 : 0);
      o.position.z += Math.cos(t * 0.63 + a) * 0.52;
      o.position.y += snow || leaf ? (1 - u) * 6 : ash ? u * 5 : 1.2 + Math.sin(t * 0.79 + a) * 0.92;
      if (leaf) o.rotation.set(t + a, t * 0.74, 0.43);
      o.scale.multiplyScalar(
        snow || leaf || ash ? 0.12 + 0.88 * Math.sin(u * Math.PI) : 0.68 + 0.32 * Math.sin(t * 2 + a),
      );
    });
  }
}

export function buildWorld(land: Terrain, theme: VoxelThemeInfo) {
  const scene = new Scene(),
    b = BIOMES[theme.id],
    lava = theme.id === 'ashen_citadel';
  const batch = voxelBatches(scene, lava),
    { box } = batch,
    rng = random(51793);
  geology(box, land, b, theme);
  const lip = waterfall(box, land, b, rng);
  const busy = infrastructure(box, land, theme, b);
  heavens(box, theme, b, random(16123));
  weather(box, land, theme.id, b, random(20911));
  garden(box, land, theme, b, rng, busy, () => 7000 - batch.count);
  batch.finish();
  const key = new DirectionalLight(b.key, theme.tone === 'night' ? 1.72 : 2.02);
  key.position.set(-27, 48, 21);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -49, right: 49, top: 40, bottom: -40, near: 0.5, far: 125 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.normalBias = 0.042;
  key.shadow.bias = -0.00032;
  key.shadow.radius = 2;
  const rim = new DirectionalLight(b.rim, theme.tone === 'night' ? 1.62 : 1.14);
  rim.position.set(16, 12, -20);
  scene.add(key, rim, new HemisphereLight(b.fill, b.rock[1], theme.tone === 'night' ? 1.26 : 1.47));
  const fires = [...land.sites.values()]
    .filter(s => s.spec.kind === 'camp')
    .slice(0, 4)
    .map(s => {
      const lamp = new PointLight(0xff9744, 12, 6);
      lamp.position.copy(s.pos).add(new Vector3(0, 1.1, -1.66));
      scene.add(lamp);
      return lamp;
    });
  const spill = new PointLight(lava ? 0xff6a28 : b.foam, lava ? 34 : 8, 9);
  spill.position.copy(lip).y += 0.65;
  scene.add(spill);

  // Pack only visible route beads and pulse particles in one extra emissive draw call.
  const trails = [...land.roads.values()].map(road => ({
    road,
    mode: 0,
    wanted: Math.max(2, Math.ceil(road.length / 0.48)),
  }));
  const beadBudget = Math.max(
    0,
    Math.min(
      trails.reduce((sum, e) => sum + e.wanted, 0),
      7500 - batch.count - 48,
    ),
  );
  const beads: { p: Vector3; yaw: number; tilt: number; length: number; dist: number; mode: number }[] = [];
  const fx = batch.effects(beadBudget + 48);
  fx.count = 0;
  fx.instanceMatrix.setUsage(DynamicDrawUsage);
  const pose = new Object3D(),
    paint = new Color();
  const pulse = new Vector3();
  let burst = -10;
  function state(st: MapPathState) {
    let wanted = 0;
    for (const t of trails) {
      const key = t.road.key;
      t.mode = st.chosen === key ? 4 : st.walked.has(key) ? 1 : st.available.has(key) ? 2 : st.preview.has(key) ? 3 : 0;
      if (t.mode) wanted += t.wanted;
    }
    let budget = Math.min(wanted, beadBudget);
    beads.length = 0;
    for (const trail of trails) {
      if (!trail.mode) continue;
      const { road, mode } = trail,
        count = Math.round((trail.wanted / wanted) * budget);
      wanted -= trail.wanted;
      budget -= count;
      let a = follow(road, 0);
      for (let i = 0; i < count; i++) {
        const v = follow(road, (i + 1) / count),
          dx = v.x - a.x,
          dz = v.z - a.z;
        beads.push({
          p: follow(road, (i + 0.5) / count),
          yaw: Math.atan2(dx, dz),
          tilt: -Math.atan2(v.y - a.y, Math.hypot(dx, dz)),
          length: a.distanceTo(v),
          dist: ((i + 0.5) * road.length) / count,
          mode,
        });
        a = v;
      }
    }
  }
  const hues = [0, 0xffc359, 0x66e6d5, 0xeabf7a, 0xfff0ab];
  function frame(t: number) {
    batch.animate(t);
    fires.forEach((f, i) => {
      f.intensity = 12 + 1.9 * Math.sin(t * 8.3 + i) + Math.sin(t * 13 + i);
    });
    if (lava) spill.intensity = 31 + 5 * Math.sin(t * 2.6);
    let slot = 0;
    const stamp = (c: number) => {
      pose.updateMatrix();
      fx.setMatrixAt(slot, pose.matrix);
      fx.setColorAt(slot++, paint.setHex(c));
    };
    for (const bead of beads) {
      const { mode } = bead;
      const wave = 0.5 + 0.5 * Math.cos(bead.dist * 1.78 - t * (mode === 4 ? 8 : 3.3));
      const w = mode === 1 ? 0.23 : mode === 3 ? 0.14 : 0.16 + wave * 0.16;
      pose.position.copy(bead.p).y += 0.28;
      pose.rotation.set(bead.tilt, bead.yaw, 0, 'YXZ');
      pose.scale.set(w, 0.095 + w * 0.2, mode === 1 || mode === 4 ? bead.length + 0.025 : 0.22 + 0.14 * wave);
      stamp(mode === 4 && wave > 0.55 ? 0xfffbe6 : mode === 2 && wave > 0.8 ? 0xffe5a0 : hues[mode]);
    }
    const u = (t - burst) / 0.72;
    if (u >= 0 && u < 1)
      for (let i = 0; i < 48; i++) {
        const a = (i * Math.PI * 2) / 32,
          ring = i < 32,
          radius = ring ? 0.62 + 3.08 * (1 - (1 - u) ** 2) : 0.6 + u * (1.3 + (i % 5) * 0.32);
        pose.position.set(
          pulse.x + Math.cos(a) * radius,
          pulse.y + (ring ? 0.24 + 0.56 * u : 0.5 + Math.sin(u * Math.PI) * (1.2 + (i % 4) * 0.46)),
          pulse.z + Math.sin(a) * radius,
        );
        pose.rotation.set(0, -a, 0);
        const s = (ring ? 0.24 : 0.18) * (1 - u * 0.88);
        pose.scale.set(s, s, ring ? 0.4 * (1 - u * 0.6) : s);
        stamp(ring ? b.foam : 0xffde79);
      }
    fx.count = slot;
    if (slot && fx.instanceColor) {
      for (const [attr, stride] of [
        [fx.instanceMatrix, 16],
        [fx.instanceColor, 3],
      ] as const) {
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, slot * stride);
        attr.needsUpdate = true;
      }
    }
  }
  return {
    scene,
    state,
    frame,
    pulse(p: Vector3, t: number) {
      pulse.copy(p);
      burst = t;
    },
    dispose() {
      batch.dispose();
      key.shadow.dispose();
      scene.clear();
    },
  };
}
