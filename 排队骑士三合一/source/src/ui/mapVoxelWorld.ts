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
import type { MapPathState, MapPulse } from './mapArt';
import { voxelBatches, type Box, type Motion } from './mapVoxelBatch';
import { expeditionMarker, landmark, summit, tree, type MarkerStamp } from './mapVoxelModels';
import { crossing, distantSkyline, landing } from './mapVoxelArchitecture';
import { BIOMES, type Biome, type VoxelThemeInfo } from './mapVoxelThemes';
import { clamp, follow, GRID, TILE_WIDTH, noise, random, type Site, type Terrain } from './mapVoxelTerrain';

type Rand = () => number;
const INSTANCE_LIMIT = 7500;
const FX_RESERVE = 500;
const SCENERY_LIMIT = INSTANCE_LIMIT - FX_RESERVE;
const PULSE_SLOTS = 48;
const pick = (c: number[], r: number) => c[Math.min(c.length - 1, Math.floor(r * c.length))];
function tint(c: number, factor: number) {
  return (
    (Math.min(255, Math.round((c >> 16) * factor)) << 16) |
    (Math.min(255, Math.round(((c >> 8) & 255) * factor)) << 8) |
    Math.min(255, Math.round((c & 255) * factor))
  );
}
function geology(box: Box, land: Terrain, b: Biome, theme: VoxelThemeInfo) {
  const greenCliffs = ['emerald_day', 'autumn_sunset', 'moonlit_woods'].includes(theme.id);
  const exposures = [
    [TILE_WIDTH, 0],
    [-TILE_WIDTH, 0],
    [0, GRID],
    [0, -GRID],
  ];
  for (const cell of land.cells.values()) {
    const { x, z, h, root, wet } = cell;
    const neighbours = exposures.map(([dx, dz]) => land.at(x + dx, z + dz));
    const recess = neighbours.filter(n => n && n.h > h + 0.4).length;
    const patch = 0.5 + 0.25 * Math.sin(x * 0.14 + z * 0.09) + 0.2 * Math.cos(z * 0.19 - x * 0.055);
    const top = wet
      ? tint(b.water, 0.56)
      : tint(pick(b.turf, clamp(patch, 0, 0.999)), 1 - recess * 0.025);
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
      box(x, low, z, TILE_WIDTH, high - low, GRID, tint(b.rock[[0, 1, 2, 4][i - 1]], 0.94 + 0.055 * patch));
      if (i === 3 && high - low > 1.35 && patch > 0.68)
        box(x, high - 0.65, z, TILE_WIDTH + 0.025, 0.24, GRID + 0.025, tint(b.rock[3], 0.94));
    }
    if (wet) {
      const level = land.waterLevel(z);
      box(x, h, z, TILE_WIDTH, level - h, GRID, b.water, 'water');
    }
    // A few nearby columns share a spur, so each buttress reads as a single rock mass.
    if (wet || land.at(x, z + GRID)) continue;
    const spur = Math.max(...[-29, -13, 9, 29].map(crest => 1 - Math.abs(x - crest) / 3.4));
    if (spur <= 0) continue;
    const base = root - 0.6 - 1.8 * spur;
    const crown = Math.min(h - 0.64, 1.2 + 1.4 * spur);
    box(x, base, z + 0.48, TILE_WIDTH, crown - base, 0.85 + spur * 0.51, b.rock[1]);
    box(x, crown, z + 0.5, TILE_WIDTH, 0.4, 0.95 + spur * 0.54, b.rock[2]);
    if (greenCliffs && spur > 0.49)
      box(x, h - 0.76 - spur, z + GRID * 0.49, 0.84, 0.71 + spur, 0.23, b.turf[0]);
  }
}

// A hard-edged, two-colour glint. All three bars share their centre and motion,
// so it stays coherent as it swells and fades, including in the still renderer.
function glint(box: Box, x: number, y: number, z: number, size: number, rim: number, motion: Motion) {
  function bar(w: number, h: number, depth: number, color: number) {
    box(x, y - h * size / 2, z, w * size, h * size, depth * size, color, 'light', motion);
  }
  bar(1.38, 0.19, 0.18, rim);
  bar(0.21, 1.26, 0.18, rim);
  bar(0.42, 0.42, 0.34, 0xfff4cf);
}

function aura(box: Box, x: number, y: number, z: number, w: number, h: number, color: number, phase = 0) {
  box(x, y - h / 2, z, w, h, 1, color, 'aura', (o, t) => {
    const breath = 0.94 + 0.10 * Math.cos(t * 1.8 + phase);
    o.scale.x *= breath;
    o.scale.y *= breath;
  });
}

function riverLight(box: Box, land: Terrain, b: Biome) {
  // Small crests drift downstream in the gaps between the bridges. Each patch
  // breaks into two offset steps; the bridge and its route stay visually clear.
  const spans = [...land.spans.values()];
  const placed: number[] = [];
  const sheen = new Color(b.water).lerp(new Color(b.foam), 0.55).getHex();
  for (const target of [-12, -4, 4, 13]) {
    const start = [0, -1.25, 1.25, -2.5, 2.5].map(dz => target + dz).find(z => {
      if (spans.some(s => Math.abs(s.z - z) < 2.65) || placed.some(p => Math.abs(p - z) < 3.8)) return false;
      return [-0.95, 0, 0.95].every(dz => land.at(land.river(z + dz), z + dz)?.wet);
    });
    if (start === undefined) continue;
    placed.push(start);
    for (const [side, offset] of [[-1, 0], [1, 0.48]]) {
      const phase = ((target + 16) * 0.09 + offset) % 1;
      for (const [dx, dz, width] of [[0, 0, 0.88], [0.48, -0.24, 0.43]]) {
        box(0, 0, 0, width, 0.12, 0.19, dx === 0 ? sheen : b.foam, 'light', (o, t) => {
          const u = (phase + t * 0.34) % 1;
          const z = start + (u - 0.5) * 1.65 + dz;
          o.position.set(land.river(z) + side * (0.29 + dx), land.waterLevel(z) + 0.10, z);
          o.scale.x *= 0.18 + Math.sin(u * Math.PI) * 0.95;
        });
      }
    }
  }
}

function waterfall(box: Box, land: Terrain, b: Biome, rng: Rand, lava: boolean) {
  // Each wet column ends at its own cliff lip, even on a diagonally stepped shoreline.
  const outlet = [...land.cells.values()].filter(c => c.wet && !land.at(c.x, c.z + GRID));
  if (!outlet.length) return null;
  const center = new Vector3();
  const cascade = new Color(b.water).lerp(new Color(b.foam), 0.25).getHex();
  const vapor = lava ? 0xaa655d : new Color(b.foam).lerp(new Color(0xd1e2ea), 0.52).getHex();
  for (const c of outlet) {
    const z = c.z + GRID * 0.48,
      level = land.waterLevel(c.z),
      base = c.root - 3.8;
    center.add(new Vector3(c.x, level, z));
    let impact = 0;
    for (let strand = 0; strand < 2; strand++) {
      const x = c.x + (TILE_WIDTH * (strand - 0.5)) / 2,
        bottom = base - rng() * 1.4;
      impact += bottom / 2;
      box(x, bottom, z, TILE_WIDTH / 2, level - bottom, 0.29, tint(cascade, 0.91 + strand * 0.1), 'water');
      box(x, level - 0.17, z + 0.05, TILE_WIDTH / 2, 0.19, 0.40, cascade, 'light');
      // A bright head and a longer blue (or molten) tail travel together. The
      // current gathers into a band across the lip, then breaks up as it falls.
      const phase = (0.26 + (c.x - outlet[0].x) * 0.088 + strand * 0.23) % 1;
      for (const [length, width, offset, color] of [
        [1.48, 0.23, 0.92, cascade], [0.77, 0.32, 0, b.foam],
      ]) {
        box(x, bottom, z + 0.23, width, length, 0.16, color, 'light', (o, t) => {
          const u = (1 + phase + t * 0.68) % 1;
          const weight = Math.min(1, u * 9, (1 - u) * 7);
          o.position.y = level - 0.88 - (level - bottom - 1.36) * u + offset;
          o.scale.y *= weight;
          o.scale.x *= 0.42 + 0.58 * weight;
        });
      }
      if (strand === 0) {
        glint(box, x, level + 0.29, z + 0.15, 0.82, b.foam, (o, t) => {
          const pulse = Math.max(0, Math.cos(t * 2.1 - c.x * 0.8));
          o.scale.multiplyScalar(0.04 + pulse ** 3 * 0.96);
        });
      }
    }
    // A low, overlapping bed catches the ends of both strands. Vapour rolls
    // out from this same stepped shoreline, with sparks rising above hot rock.
    box(c.x, impact - 0.48, z + 0.26, TILE_WIDTH * 1.7, 1.08, 1.73, vapor, 'mist');
    for (let j = 0; j < 5; j++) {
      const a = rng() * Math.PI * 2,
        phase = rng(),
        size = rng(),
        puff = j < 3,
        w = puff ? 1.15 + size * 0.9 : 0.17 + size * 0.18;
      box(c.x, impact, z + 0.48, w, w * (puff ? 0.57 : 1.25), w * 0.84,
        puff ? vapor : lava ? 0xffa150 : b.foam, puff ? 'mist' : 'light', (o, t) => {
        const u = (phase + t * (puff ? 0.38 : 0.55)) % 1;
        const envelope = Math.sin(u * Math.PI);
        o.position.x += Math.cos(a) * (0.25 + u * 2.35);
        o.position.z += (0.4 + Math.sin(a) * 0.72) * u;
        o.position.y += puff ? u * 1.1 : lava ? u * 2.8 : envelope * 1.38;
        o.scale.multiplyScalar(envelope * (puff ? 0.7 + u * 1.2 : 1));
      });
    }
  }
  center.divideScalar(outlet.length);
  const middle = outlet.reduce((closest, c) => Math.abs(c.x - center.x) < Math.abs(closest.x - center.x) ? c : closest);
  const front = middle.z + GRID * 0.48 + 0.3;
  aura(box, middle.x, land.waterLevel(middle.z) - 0.26, front, 3.7, 1.75, b.foam);
  aura(box, middle.x, middle.root - 4.35, front + 0.78, 4.6, 2.15, lava ? 0xeb593c : cascade, 2.1);
  return center;
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
      const bottom = Math.min(p.y - 0.28, land.ground(p.x, p.z) - 0.08);
      box(
        p.x,
        bottom,
        p.z,
        1.03,
        p.y - bottom,
        Math.hypot(v.x - a.x, v.z - a.z) + 0.045,
        tint(b.road, 0.97 + r * 0.04),
        'solid',
        undefined,
        Math.atan2(v.x - a.x, v.z - a.z),
      );
    }
  }
  for (const span of land.spans.values()) {
    crossing(box, land, span, theme.id, b);
    for (let dx = -span.half; dx <= span.half; dx += 1) reserve(span.x + dx, span.z, 2);
  }
  for (const site of land.sites.values()) {
    landmark(box, site, theme.id, b);
    reserve(site.pos.x, site.pos.z - 1, site.spec.kind === 'boss' ? 5 : 3);
  }
  landing(box, land, theme.id, b);
  reserve(land.gate.x, land.gate.z, 3);
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
  const sites = [...land.sites.values()];
  const roads = [...land.roads.values()].flatMap(road => road.points.filter((_, i) => i % 2 === 0));
  const used: { x: number; z: number; radius: number }[] = [];
  const [bearing, elevation] = land.viewAngles;
  const azimuth = bearing * Math.PI / 180;
  const sightX = Math.tan(azimuth);
  const sightY = Math.tan(elevation * Math.PI / 180) / Math.cos(azimuth);
  // Each grove has one tall silhouette and two smaller companions. Search the
  // actual dry cells, since routes and their reserved viewing corridors vary by run.
  function placeNear(x: number, z: number, radius: number, reach: number, treeScale: number) {
    let best: ReturnType<Terrain['at']>;
    let nearest = reach;
    for (const cell of land.cells.values()) {
      const d = Math.hypot(cell.x - x, cell.z - z);
      if (d >= nearest || cell.wet || Math.abs(cell.x - land.river(cell.z)) < radius + 1.8) continue;
      if (used.some(p => Math.hypot(p.x - cell.x, p.z - cell.z) < radius + p.radius)) continue;
      if (sites.some(s => {
        const depth = cell.z - s.pos.z;
        return depth > -1 && depth < 8 && Math.abs(s.pos.x + depth * sightX - cell.x) < radius + 2;
      })) continue;
      const clear = [[0, 0], [-radius, 0], [radius, 0], [0, -radius], [0, radius]].every(([dx, dz]) => {
        const ground = land.at(cell.x + dx, cell.z + dz);
        return ground && !ground.wet && Math.abs(ground.h - cell.h) <= 1.45 && !busy(cell.x + dx, cell.z + dz);
      });
      if (!clear) continue;
      // Look through the crown toward the road from the map's oblique viewing angle.
      // Terrain height matters near the high eastern shelf and the stepped riverbanks.
      if (treeScale && roads.some(p => {
        const depth = cell.z - p.z;
        const height = p.y + depth * sightY - cell.h;
        const sideways = p.x - cell.x + depth * sightX;
        return depth > 0 && height > 0.8 * treeScale && height < 3.9 * treeScale && Math.abs(sideways) < 1.35 * treeScale;
      })) continue;
      nearest = d;
      best = cell;
    }
    if (best) used.push({ x: best.x, z: best.z, radius });
    return best;
  }
  // The terrain survey levels this rear terrace and keeps branches off its footprint.
  const { x, z } = land.focal;
  const wonder = { x, z, h: land.ground(x, z) };
  summit(box, theme.id, b, x, wonder.h, z, 1.48, land.ground);
  used.push({ x, z, radius: 4.65 });

  // Give the foreground one broad mass per shoulder, with clear ground between it and the wonder.
  const groves: Record<string, number[][]> = {
    emerald_day: [[-24, 12, 1.45], [32, 8.5, 1.64], [18, -14, 0.94]],
    autumn_sunset: [[-32, 6, 1.62], [17, 15, 1.29]],
    moonlit_woods: [[-21, 14, 1.32], [29, -9, 1.52]],
    golden_oasis: [[-31, -7, 1.42], [26, 12, 1.64]],
    alpine_snow: [[-29, 12, 1.42], [31, -8.5, 1.34]],
    ashen_citadel: [[-33, 4, 1.7], [16, 14, 1.54]],
  };
  for (const [x, z, scale] of groves[theme.id]) {
    if (remaining() < 90) break;
    const radius = 1.25 * scale;
    const cell = placeNear(x, z, radius, 9, scale);
    if (!cell) {
      // Where branches run immediately behind the cliff lip, use low, broad
      // outcrops. Each stone finds its own terrace and has a distinct sunlit cap.
      const ledge = placeNear(x, z, 1.7, 8, 0.42);
      if (!ledge) continue;
      for (const [dx, dz, size] of [[0, 0, 1.38], [-1.8, -0.27, 0.86], [1.59, 0.44, 0.62]]) {
        const px = ledge.x + dx, pz = ledge.z + dz;
        const ledgeCell = land.at(px, pz);
        if (!ledgeCell || ledgeCell.wet || busy(px, pz)) continue;
        const base = Math.min(ledgeCell.h, land.ground(px - size * 0.62, pz), land.ground(px + size * 0.62, pz));
        box(px, base - 0.08, pz, size * 1.62, ledgeCell.h - base + size * 0.64 + 0.08, size * 1.35, b.rock[2]);
        box(px - 0.12, ledgeCell.h + size * 0.64, pz, size * 1.34, size * 0.38, size * 1.09, b.rock[3]);
        box(px - 0.19, ledgeCell.h + size * 1.02, pz, size * 0.92, size * 0.18, size * 0.88, b.turf[0]);
      }
      continue;
    }
    // Broad deciduous crowns on the sunny foreground, conifers receding along the ridge.
    const shape = theme.id === 'emerald_day' ? (z > 0 ? 0.83 : 0.28) : rng();
    tree(box, theme.id, b, cell.x, cell.h, cell.z, scale, shape);
    for (const [dx, dz, size] of [[-1.9, -0.75, 0.77], [1.54, 0.66, 0.64]]) {
      const flank = placeNear(cell.x + dx * scale, cell.z + dz * scale, size * scale, 3.2, size * scale);
      if (flank) tree(box, theme.id, b, flank.x, flank.h, flank.z, size * scale, rng());
    }
  }
  return wonder;
}

function heavens(box: Box, theme: VoxelThemeInfo, b: Biome, rng: Rand) {
  distantSkyline(box, theme.id, b);
  // Broad, widely separated cloud banks frame the sky and leave the cliff face open.
  for (const [x, y, z, size] of [
    [-37, -8, -31, 1.35], [-15, -13, -34, 1.05], [12, -6.8, -33, 1.4], [36, -8, -27, 0.95],
    [-30, -13, 12, 0.78], [23, -15, 9, 1.1],
  ]) {
    const phase = rng() * 6;
    const thin = theme.id === 'golden_oasis' || theme.id === 'alpine_snow';
    const stretch = thin ? 1.46 : 1;
    const drift: Motion = (o, t) => {
      o.position.x += Math.sin(t * 0.09 + phase) * 1.05;
      o.position.y += Math.cos(t * 0.14 + phase) * 0.18;
    };
    for (const [dx, dy, dz, w, h, d] of [
      [-2.7, 0, 0, 3.8, 0.65, 2], [0, 0, -0.3, 4.4, 1.35, 2.65],
      [0.1, 1.35, -0.4, 2, 0.57, 1.8], [3, 0.05, -0.2, 2.9, 0.79, 2.1],
    ]) box(x + dx * size * stretch, y + dy * size / stretch, z + dz * size, w * size * stretch, h * size / stretch, d * size, b.cloud, 'cloud', drift);
  }
  if (theme.tone === 'night')
    for (let i = 0; i < 24; i++) {
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
}

// Keep the strongest light attached to each theme's actual source. Secondary
// motes share a short, staggered cycle rather than covering the entire board.
function wonderLight(box: Box, x: number, y: number, z: number, id: string, b: Biome) {
  const pulse = (phase: number, speed = 1.8): Motion => (o, t) => {
    const crest = 0.5 + 0.5 * Math.cos(t * speed + phase);
    o.scale.multiplyScalar(0.15 + 0.85 * crest ** 2);
  };
  if (id === 'golden_oasis') {
    // Lapis inlay kindles from the two sandstone piers up to the keystone.
    for (const side of [-1, 1]) {
      for (const [step, [dx, dy]] of [[2.48, 2.7], [2.48, 3.45], [2.39, 5.09], [1.9, 6.14]].entries()) {
        box(x + dx * side, y + dy, z + 1.35, 0.42, 0.47, 0.21, step < 2 ? 0x71e6cf : 0xffde8a, 'light', (o, t) => {
          const wave = 0.5 + 0.5 * Math.cos(t * 2.5 - step * 0.78);
          o.scale.multiplyScalar(0.32 + 0.68 * wave ** 2);
        });
      }
    }
    aura(box, x, y + 6.93, z + 1.59, 3.55, 3.05, 0x60e9cc);
    glint(box, x, y + 6.93, z + 1.66, 1.18, 0x81fff1, pulse(-0.6, 2.5));
    // A small star of sand rises through the open arch and dissolves below the lintel.
    for (let i = 0; i < 4; i++) {
      const rise: Motion = (o, t) => {
        const u = (0.21 + i / 4 + t * 0.23) % 1;
        o.position.x += Math.sin(u * 4.6 + i * 1.5) * 0.82;
        o.position.y += u * 4.5;
        o.scale.multiplyScalar(Math.sin(u * Math.PI) ** 1.25);
      };
      if (i % 2 === 0) glint(box, x, y + 0.73, z + 0.82, 0.74, 0xfbc875, rise);
      else box(x, y + 0.81, z + 0.78, 0.29, 0.32, 0.29, 0xa6ffdf, 'light', rise);
    }
  } else if (id === 'moonlit_woods') {
    for (let i = 0; i < 3; i++) {
      glint(box, x, y + 5.14, z + 0.85, i ? 0.67 : 0.94, i === 1 ? 0xa18cf2 : b.foam, (o, t) => {
        const angle = t * 0.46 + i * Math.PI * 2 / 3;
        o.position.x += Math.cos(angle) * 3.45;
        o.position.y += Math.sin(angle) * 3.05;
        o.position.z += Math.sin(angle) * 0.45;
        o.scale.multiplyScalar(0.52 + 0.48 * (0.5 + Math.sin(t * 1.5 + i) * 0.5));
      });
    }
    aura(box, x, y + 5.23, z + 0.55, 4.4, 3.8, 0xffbd73);
    glint(box, x, y + 5.29, z + 0.75, 1.05, 0xffda9d, pulse(0));
  } else if (id === 'alpine_snow') {
    aura(box, x + 0.24, y + 7.6, z + 0.28, 2.9, 3.8, 0x7cdeef);
    for (const [i, [dx, dy, dz]] of [[0.24, 7.6, 0.2], [-2.4, 4.1, 0.82], [2.34, 5.2, 1.13]].entries())
      glint(box, x + dx, y + dy, z + dz, i === 0 ? 1.24 : 0.9, b.foam, pulse(-i * 1.6));
  } else if (id === 'autumn_sunset' || id === 'ashen_citadel') {
    const ember = id === 'ashen_citadel';
    if (ember) {
      aura(box, x, y + 1.9, z + 1.56, 5.1, 3.45, 0xff832d);
    } else {
      for (const side of [-1, 1]) {
        const lanternX = x + (0.78 + side * 1.9) * 1.48;
        box(lanternX, y + 4.5, z + 1.48, 0.11, 0.76, 0.12, 0x714134);
        box(lanternX, y + 4.0, z + 1.48, 0.49, 0.58, 0.47, 0xffbf57, 'light');
        aura(box, lanternX, y + 4.3, z + 1.76, 2.3, 2.26, 0xff9e41, side);
      }
    }
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1;
      const sx = ember ? side * 1.76 : -1.8 + side * 1.4;
      const sy = ember ? (side < 0 ? 8.9 : 7.35) : 6.4;
      const width = ember ? 0.28 + (i % 3) * 0.09 : 0.46;
      const color = ember ? (i % 3 ? 0xff9738 : 0xffdb75) : (i % 3 ? 0xffb74f : 0xe7733c);
      box(x + sx, y + sy, z + (ember ? -0.59 : 1.2), width, width * (ember ? 1.5 : 0.58), width * 0.68, color, 'light', (o, t) => {
        const u = (0.17 + i / 9 + t * (ember ? 0.32 : 0.22)) % 1;
        o.position.x += u * (ember ? 1.35 : 3.6) + Math.sin(u * 5 + i * 1.9) * 0.53;
        o.position.z += Math.cos(i * 2 + u * 4.5) * 0.52;
        o.position.y += u * (ember ? 3.1 : -4.6);
        o.rotation.z = u * (ember ? 0.55 : 4) + i;
        o.scale.multiplyScalar(0.1 + Math.sin(u * Math.PI) * 0.9);
      });
    }
  } else {
    // Two flights of sunlit chaff peel off the windmill sails in a short gust.
    for (let i = 0; i < 6; i++) {
      box(x, y + 4.9, z + 2.2, i % 3 ? 0.52 : 0.93, 0.16, 0.18, i % 3 ? 0xffd68c : 0xfff2bc, 'light', (o, t) => {
        const u = (0.22 + (i % 3) * 0.07 + Math.floor(i / 3) * 0.5 + t * 0.24) % 1;
        o.position.x += 1.85 + u * 4.5;
        o.position.y += 0.75 * Math.sin(u * Math.PI * 1.65) + Math.floor(i / 3) * 0.73;
        o.scale.x *= Math.sin(u * Math.PI);
      });
    }
  }
}

export function buildWorld(land: Terrain, theme: VoxelThemeInfo) {
  const scene = new Scene(),
    b = BIOMES[theme.id],
    lava = theme.id === 'ashen_citadel';
  const batch = voxelBatches(scene, lava, SCENERY_LIMIT),
    { box } = batch,
    rng = random(51793);
  geology(box, land, b, theme);
  riverLight(box, land, b);
  const lip = waterfall(box, land, b, rng, lava);
  const busy = infrastructure(box, land, theme, b);
  heavens(box, theme, b, random(16123));
  const wonder = garden(box, land, theme, b, rng, busy, () => SCENERY_LIMIT - batch.count);
  wonderLight(box, wonder.x, wonder.h, wonder.z, theme.id, b);
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
  const spill = lip ? new PointLight(lava ? 0xff6a28 : b.foam, lava ? 34 : 8, 9) : null;
  if (spill && lip) {
    spill.position.copy(lip).y += 0.65;
    scene.add(spill);
  }

  // Markers, visible route beads and interaction bursts share one emissive draw.
  const trails = [...land.roads.values()].map(road => ({
    road,
    destination: land.sites.get(road.key.split('->')[1])!,
    mode: 0,
    wanted: Math.max(2, Math.ceil(road.length / 0.48)),
  }));
  const routeSlots = trails.reduce((sum, trail) => sum + trail.wanted, 0);
  const fxCapacity = Math.min(INSTANCE_LIMIT - batch.count, routeSlots + FX_RESERVE);
  const beads: { p: Vector3; yaw: number; tilt: number; length: number; dist: number; mode: number }[] = [];
  const fx = batch.effects(fxCapacity);
  fx.count = 0;
  fx.instanceMatrix.setUsage(DynamicDrawUsage);
  const pose = new Object3D(),
    paint = new Color();
  const pulse = new Vector3();
  let burst = -10;
  let pulseKind: MapPulse = 'depart';
  let current: Site | undefined;
  const reachable = new Set<Site>();
  function markers(stamp: MarkerStamp, t: number) {
    expeditionMarker(stamp, 'current', current?.pos ?? land.gate, current?.spec.kind, t);
    for (const site of reachable) expeditionMarker(stamp, 'can', site.pos, site.spec.kind, t);
  }
  function state(st: MapPathState) {
    let wanted = 0;
    current = undefined;
    reachable.clear();
    for (const t of trails) {
      const key = t.road.key;
      t.mode = st.walked.has(key) ? 1 : st.chosen === key ? 4 : st.available.has(key) ? 2 : st.preview.has(key) ? 3 : 0;
      if (t.mode) wanted += t.wanted;
      // The last visited layer owns the flag even when inspecting a future branch or the final keep.
      if (t.mode === 1 && t.destination.spec.layer > (current?.spec.layer ?? -1)) current = t.destination;
      if (st.available.has(key)) reachable.add(t.destination);
    }
    let markerCount = 0;
    markers(() => { markerCount++; }, 0);
    let budget = Math.min(wanted, Math.max(0, fxCapacity - PULSE_SLOTS - markerCount));
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
  const hues = [0, 0xffd266, 0x74ffe6, 0xb8d4c8, 0x5effd8];
  let slot = 0;
  function stamp(c: number) {
    if (slot >= fxCapacity) return;
    pose.updateMatrix();
    fx.setMatrixAt(slot, pose.matrix);
    fx.setColorAt(slot++, paint.setHex(c));
  }
  const stampMarker: MarkerStamp = (x, y, z, w, h, d, color, yaw = 0, roll = 0) => {
    pose.position.set(x, y, z);
    pose.rotation.set(0, yaw, roll, 'YXZ');
    pose.scale.set(w, h, d);
    stamp(color);
  };
  function frame(t: number) {
    batch.animate(t);
    fires.forEach((f, i) => {
      f.intensity = 12 + 1.9 * Math.sin(t * 8.3 + i) + Math.sin(t * 13 + i);
    });
    if (lava && spill) spill.intensity = 31 + 5 * Math.sin(t * 2.6);
    slot = 0;
    markers(stampMarker, t);
    for (const bead of beads) {
      const { mode } = bead;
      const wave = 0.5 + 0.5 * Math.cos(bead.dist * 1.78 - t * (mode === 4 ? 8 : 3.6));
      const w = mode === 1 ? 0.25 : mode === 3 ? 0.16 : 0.21 + wave * 0.18;
      pose.position.copy(bead.p).y += 0.28;
      pose.rotation.set(bead.tilt, bead.yaw, 0, 'YXZ');
      pose.scale.set(w, 0.095 + w * 0.2, mode === 1 || mode === 4 ? bead.length + 0.025 : 0.22 + 0.14 * wave);
      stamp(mode === 4 && wave > 0.55 ? 0xb1ffe1 : mode === 2 && wave > 0.8 ? 0x9af4ce : hues[mode]);
    }
    const u = (t - burst) / (pulseKind === 'inspect' ? 0.48 : 0.72);
    if (u >= 0 && u < 1 && pulseKind === 'inspect') {
      // Four pairs of brass corner marks close around the chosen tile.
      const radius = 1.22 + 1.5 * (1 - u) ** 2;
      const size = 1 - u ** 3;
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
        pose.rotation.set(0, 0, 0);
        pose.position.set(pulse.x + dx * (radius - 0.26), pulse.y + 0.28, pulse.z + dz * radius);
        pose.scale.set(0.69 * size, 0.14 * size, 0.18 * size);
        stamp(0xffedaa);
        pose.position.set(pulse.x + dx * radius, pulse.y + 0.28, pulse.z + dz * (radius - 0.26));
        pose.scale.set(0.18 * size, 0.14 * size, 0.69 * size);
        stamp(0xffdf88);
      }
    } else if (u >= 0 && u < 1)
      for (let i = 0; i < PULSE_SLOTS; i++) {
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
    pulse(p: Vector3, t: number, kind: MapPulse = 'depart') {
      pulse.copy(p);
      burst = t;
      pulseKind = kind;
    },
    dispose() {
      batch.dispose();
      key.shadow.dispose();
      scene.clear();
    },
  };
}
