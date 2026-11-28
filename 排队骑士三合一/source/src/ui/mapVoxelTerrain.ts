import { MathUtils, Vector3 } from 'three';
import { expeditionLandform } from './mapVoxelLandforms';
import type { MapNodeKind, MapNodeSpec } from './mapArt';

export const GRID = 1.25;
export const TILE_WIDTH = 1.5;
export const DECK = 0.28;
export const ROAD_LIFT = 0.12;
export const clamp = MathUtils.clamp;
export function noise(x: number, z: number, seed = 0) {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
export function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function terrace(h: number) {
  return Math.round(h / 0.48) * 0.48;
}
const snap = (v: number) => Math.round(v / GRID) * GRID;
const ease = (v: number) => v * v * (3 - 2 * v);
export const nodeKey = (l: number, i: number) => `${l}-${i}`;

// A complete miniature expedition also serves the element-only mapArt() entry point.
function exhibition(): MapNodeSpec[] {
  const layers: MapNodeKind[][] = [
    ['fight', 'camp'],
    ['shop', 'fight', 'event'],
    ['elite', 'treasure'],
    ['camp', 'fight', 'shop'],
    ['event', 'elite'],
    ['camp', 'treasure'],
    ['boss'],
  ];
  return layers.flatMap((row, layer) =>
    row.map((kind, index) => {
      const count = row.length,
        n = layers[layer + 1]?.length ?? 0;
      const next = Array.from({ length: n }, (_, i) => i).filter(
        i => Math.abs((i + 0.5) / n - (index + 0.5) / count) <= 0.43 || n === 1,
      );
      return { layer, index, count, cols: layers.length, kind, next };
    }),
  );
}

export interface Site {
  spec: MapNodeSpec;
  pos: Vector3;
}
export interface Cell {
  x: number;
  z: number;
  h: number;
  root: number;
  wet: boolean;
}
export interface Span {
  x: number;
  z: number;
  half: number;
  bank: number;
}
export function bridgeTop(s: Span, x: number) {
  return s.bank + 0.72 * (1 - Math.min(1, ((x - s.x) / s.half) ** 2));
}
export interface Road {
  key: string;
  points: Vector3[];
  distances: number[];
  length: number;
  span?: Span;
}
export function follow(road: Road, t: number, result = new Vector3()) {
  const d = clamp(t, 0, 1) * road.length,
    ends = road.distances;
  let lo = 1,
    hi = ends.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ends[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  return result.lerpVectors(road.points[lo - 1], road.points[lo], (d - ends[lo - 1]) / (ends[lo] - ends[lo - 1] || 1));
}

export function survey(specs: MapNodeSpec[], themeId = 'emerald_day') {
  const nodes = specs.length ? specs : exhibition();
  const cols = Math.max(2, ...nodes.map(s => Math.max(s.cols, s.layer + 1)));
  const shape = expeditionLandform(themeId);
  const station = (l: number) => shape.station(l / (cols - 1));
  const crossing = Math.min(cols - 2, Math.round(shape.crossing * (cols - 1) / 6));
  const skyRift = themeId === 'moonlit_woods';
  const riverBase = (station(crossing)[0] + station(crossing + 1)[0]) / 2;
  const river = (z: number) => {
    switch (themeId) {
      case 'autumn_sunset': return riverBase + 0.11 * z + 0.45 * Math.sin(z * 0.18);
      case 'moonlit_woods': return riverBase + z * 0.09 + 0.87 * Math.sin(z * 0.18);
      case 'golden_oasis': return riverBase + 0.8 * Math.cos(z * 0.16 + 0.4);
      case 'alpine_snow': return riverBase - 0.095 * z + 0.38 * Math.abs(z + 5) / 8;
      case 'ashen_citadel': return riverBase + 1.65 * (2 / Math.PI) * Math.asin(Math.sin(z * 0.32 + 0.3));
      default: return riverBase + 1.8 * Math.sin(z * 0.21 + 0.7) + 0.32 * Math.sin(z * 0.44);
    }
  };
  const riverHalfWidth = (z: number) => {
    const mouth = ease(clamp((z - 5) / 10, 0, 1));
    switch (themeId) {
      case 'autumn_sunset': return 1.15 + 0.23 * Math.sin(z * 0.19) + 0.6 * mouth;
      case 'moonlit_woods': return 3.3 + 1.05 * (1 + Math.sin(z * 0.17)) + 1.2 * mouth;
      case 'golden_oasis': return 1.18 + 5.1 * Math.exp(-(((z - 3.5) / 8.6) ** 2));
      case 'alpine_snow': return 1.5 + 1.65 * ease(clamp((z + 11) / 16, 0, 1));
      case 'ashen_citadel': return 1.11 + 0.75 * (1 + Math.cos(z * 0.31)) + mouth * 0.45;
      default: return 1.48 + 1.55 * mouth;
    }
  };
  const waterRise = themeId === 'autumn_sunset' ? 0.9 : themeId === 'alpine_snow' ? 0.64 : 0.23;
  const waterBase = themeId === 'ashen_citadel' ? -0.2 : themeId === 'alpine_snow' ? 0.8 : 1.65;
  const waterLevel = (z: number) => waterBase + Math.floor((23 - z) / 9) * waterRise;
  function upland(x: number, z: number) {
    const base = shape.section(x).elevation;
    const back = Math.max(0, -z - 7);
    switch (themeId) {
      case 'autumn_sunset': return base + Math.floor((8 - z) / 8) * 0.73;
      case 'moonlit_woods': return base + back * 0.16 - 1.15 * Math.exp(-(((x + 2) / 15) ** 2)) - z * 0.04;
      case 'golden_oasis': return Math.round(base / 1.3) * 1.3 + Math.max(0, 1 - Math.abs(z + 8) / 5) * 0.7;
      case 'alpine_snow': {
        const needles = Math.max(0, 5.7 - Math.abs(x + 25) * 0.72 - Math.abs(z + 18) * 0.85,
          7.15 - Math.abs(x - 16) * 0.76 - Math.abs(z + 18) * 0.92);
        return base + back * 0.29 + needles - z * 0.055;
      }
      case 'ashen_citadel': return base + Math.floor(back / 4) * 0.55 + 0.5 * Math.cos((x + z) * 0.24);
      default: return base + 0.65 * Math.sin(x * 0.12 + z * 0.1) + back * 0.22 - z * 0.055;
    }
  }
  const sites = new Map<string, Site>(),
    entries = new Map<number, Vector3>();
  const gate = new Vector3(shape.gate[0], terrace(upland(...shape.gate)) + ROAD_LIFT, shape.gate[1]);
  const pads: { p: Vector3; back: number; width: number }[] = [];
  for (const spec of nodes) {
    const [cx, cz] = station(spec.kind === 'boss' ? cols - 1 : spec.layer);
    const x = Math.round(cx / TILE_WIDTH) * TILE_WIDTH;
    const fraction = spec.count > 1 ? spec.index / (spec.count - 1) - 0.5 : 0;
    const z = snap(cz + fraction * (spec.count === 2 ? shape.lanes * 1.45 : shape.lanes * 2));
    const h = spec.kind === 'boss' ? shape.bossHeight : terrace(upland(x, z));
    const p = new Vector3(x, h + DECK, z);
    sites.set(nodeKey(spec.layer, spec.index), { spec, pos: p });
    pads.push({ p, back: spec.kind === 'boss' ? 6 : 3.1, width: spec.kind === 'boss' ? 4 : 1.9 });
    if (spec.layer === 0) {
      const ep = gate.clone();
      ep.z += fraction * 1.7;
      entries.set(spec.index, ep);
      pads.push({ p: ep.clone().add(new Vector3(0, DECK - ROAD_LIFT, 0)), back: 1.5, width: 1.5 });
    }
  }
  // Give the skyline model its own contiguous shelf, behind the buildings and their approach roads.
  const focal = { x: Math.round(shape.focal[0] / TILE_WIDTH) * TILE_WIDTH, z: shape.focal[1] };
  for (const { pos } of sites.values()) {
    if (Math.abs(pos.x - focal.x) < 7) focal.z = Math.min(focal.z, pos.z - 8);
  }
  focal.z = snap(focal.z);
  const summitFloor = terrace(upland(focal.x, focal.z));
  pads.push({ p: new Vector3(focal.x, summitFloor + DECK, focal.z + 2.5), back: 5.7, width: 4.5 });
  const cells = new Map<number, Cell>();
  const cellId = (x: number, z: number) => Math.round(z / GRID) * 256 + Math.round(x / TILE_WIDTH);
  for (let ix = -31; ix <= 31; ix++) {
    const x = ix * TILE_WIDTH;
    const { rear, front } = shape.section(x);
    for (let iz = -30; iz <= 25; iz++) {
      const z = iz * GRID;
      const shore = Math.min(z - rear, front - z, x - shape.sections[0][0], shape.sections.at(-1)![0] - x);
      let edge = shore / 7;
      // A node near a scalloped shoreline grows its own contiguous rock footing.
      for (const { p, back, width } of pads) {
        const outside = Math.max(Math.abs(x - p.x) - width, p.z - z - back, z - p.z - 1.88);
        edge = Math.max(edge, 0.22 - outside * 0.22);
      }
      if (edge < 0) continue;
      const bankDistance = Math.abs(x - river(z));
      const halfChannel = riverHalfWidth(z);
      if (skyRift && bankDistance <= halfChannel) continue;
      let wet = bankDistance <= halfChannel;
      const bankBlend = ease(clamp((bankDistance - halfChannel) / 3.1, 0, 1));
      let h = wet ? waterLevel(z) - 0.38 : terrace(skyRift ? upland(x, z) : MathUtils.lerp(waterLevel(z) + 0.26, upland(x, z), bankBlend));
      for (const { p, back, width } of pads) {
        const d = Math.max(Math.abs(x - p.x) - width, p.z - z - back, z - p.z - 1.88);
        if (d > 2 || (wet && d > 0)) continue;
        if (d <= 0) wet = false;
        h = terrace(MathUtils.lerp(p.y - DECK, h, ease(clamp(d / 2, 0, 1))));
      }
      // The outer lip ends early. Deeper columns form irregular, visible inward steps.
      const buttress = 0.5 + 0.5 * Math.cos(x * 0.23 + z * 0.12);
      const thickness = shape.rockDepth * (0.72 + buttress * 0.45);
      const root = -0.9 - Math.min(edge, 1) * thickness - buttress * 1.35;
      cells.set(cellId(x, z), { x, z, h, root: terrace(root), wet });
    }
  }
  const at = (x: number, z: number) => cells.get(cellId(x, z));
  const ground = (x: number, z: number) => at(x, z)?.h ?? terrace(upland(x, z));
  // When a branch skirts a concave bay, carry its paving on a small shelf of
  // the same strata. Bridge decks remain completely open underneath.
  function supportRoad(x: number, z: number) {
    for (const dx of [-0.62, 0, 0.62]) for (const dz of [-0.48, 0, 0.48]) {
      const px = Math.round((x + dx) / TILE_WIDTH) * TILE_WIDTH;
      const pz = snap(z + dz);
      const key = cellId(px, pz);
      if (cells.has(key) || (skyRift && Math.abs(px - river(pz)) <= riverHalfWidth(pz))) continue;
      cells.set(key, { x: px, z: pz, h: terrace(upland(px, pz)), root: -2.4, wet: false });
    }
  }
  function approachHeight(x: number, z: number) {
    let high = ground(x, z);
    for (let dx = -5; dx <= 5; dx++) for (let dz = -6; dz <= 6; dz++) {
      const c = at(x + dx * TILE_WIDTH, z + dz * GRID);
      if (!c || c.wet) continue;
      const distance = Math.hypot(Math.max(0, Math.abs(x - c.x) - TILE_WIDTH / 2),
        Math.max(0, Math.abs(z - c.z) - GRID / 2));
      high = Math.max(high, c.h - distance * 0.9);
    }
    return high;
  }
  const spans = new Map<number, Span>(),
    roads = new Map<string, Road>();
  function makeRoad(key: string, a: Vector3, b: Vector3): Road {
    const controls = [a];
    let span: Span | undefined;
    if ((a.x - river(a.z)) * (b.x - river(b.z)) < 0) {
      const z = clamp(
        Math.round(MathUtils.lerp(a.z, b.z, clamp((riverBase - a.x) / (b.x - a.x || 1), 0, 1)) / 3.75) * 3.75,
        -22.5,
        22.5,
      );
      span = spans.get(z);
      if (!span) {
        const x = river(z),
          half = riverHalfWidth(z) + (skyRift ? 1.65 : 1.17);
        supportRoad(x - half, z);
        supportRoad(x + half, z);
        span = {
          x,
          z,
          half,
          bank: Math.max(approachHeight(x - half, z), approachHeight(x + half, z), waterLevel(z) + 0.65) + ROAD_LIFT,
        };
        spans.set(z, span);
      }
      const dir = Math.sign(b.x - a.x) || 1;
      for (const side of [-dir, dir]) controls.push(new Vector3(span.x + side * span.half, span.bank, z));
    }
    controls.push(b);
    const points = [a.clone()];
    for (let k = 1; k < controls.length; k++) {
      const first = points.length - 1;
      const u = controls[k - 1],
        v = controls[k],
        crossing = span && k === 2;
      const steps = Math.max(2, Math.ceil(Math.hypot(v.x - u.x, v.z - u.z) / 0.56));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, z = MathUtils.lerp(u.z, v.z, ease(t));
        let x = MathUtils.lerp(u.x, v.x, t);
        if (!crossing && i < steps) {
          const side = Math.sign(u.x - river(u.z));
          const bank = river(z) + side * (riverHalfWidth(z) + 0.92);
          x = side < 0 ? Math.min(x, bank) : Math.max(x, bank);
        }
        if (!crossing) supportRoad(x, z);
        let y = crossing ? bridgeTop(span!, x) : ground(x, z) + ROAD_LIFT;
        // Seat the approaches on the raised paving and on the bridge abutments.
        const approach = (p: Vector3) => clamp(1 - Math.hypot(x - p.x, z - p.z) / 1.8, 0, 1);
        if (!crossing) y = Math.max(y, MathUtils.lerp(y, u.y, approach(u)), MathUtils.lerp(y, v.y, approach(v)));
        const p = i === steps ? v.clone() : new Vector3(x, y, z);
        points.push(p);
      }
      if (!crossing) {
        // Carry low paving up to a steep terrace with a flight of steps. The
        // first and last stones still meet the exact landing or bridge deck.
        const raiseStep = (i: number, neighbour: number) => {
          const p = points[i], q = points[neighbour];
          const run = Math.hypot(p.x - q.x, p.z - q.z);
          p.y = Math.max(p.y, q.y - run * 0.9);
        };
        for (let i = first + 1; i < points.length - 1; i++) raiseStep(i, i - 1);
        for (let i = points.length - 2; i > first; i--) raiseStep(i, i + 1);
      }
    }
    const distances = [0];
    for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + points[i].distanceTo(points[i - 1]));
    return { key, points, distances, length: distances.at(-1)!, span };
  }
  for (const [key, { spec, pos }] of sites) {
    const entry = entries.get(spec.index);
    if (spec.layer === 0 && entry) {
      const id = `camp-${spec.index}->${key}`;
      roads.set(id, makeRoad(id, entry, pos));
    }
    for (const j of spec.next) {
      const dest = nodeKey(spec.layer + 1, j),
        next = sites.get(dest);
      if (next) roads.set(`${key}->${dest}`, makeRoad(`${key}->${dest}`, pos, next.pos));
    }
  }
  return { sites, entries, cells, roads, spans, river, waterLevel, at, ground, gate, focal, themeId, viewAngles: shape.viewAngles };
}
export type Terrain = ReturnType<typeof survey>;
