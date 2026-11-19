import { MathUtils, Vector3 } from 'three';
import type { MapNodeKind, MapNodeSpec } from './mapArt';

export const GRID = 1.25;
export const TILE_WIDTH = 1.5;
export const GATE_X = -39;
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

export function survey(specs: MapNodeSpec[]) {
  const nodes = specs.length ? specs : exhibition();
  const cols = Math.max(2, ...nodes.map(s => Math.max(s.cols, s.layer + 1)));
  const column = (l: number) => -33 + (66 * l) / (cols - 1);
  const riverBase =
    (column(Math.max(0, Math.floor((cols - 1) * 0.44))) + column(Math.max(0, Math.floor((cols - 1) * 0.44)) + 1)) / 2;
  const river = (z: number) => riverBase + Math.sin(z * 0.235 + 0.7) * 2.25 + Math.sin(z * 0.47) * 0.55;
  const waterLevel = (z: number) => 1.92 + Math.floor((18 - z) / 9) * 0.22;
  function upland(x: number, z: number) {
    const east = ease(clamp((x - 6) / 27, 0, 1));
    const hill = Math.sin(x * 0.22 + z * 0.13) * 0.64 + Math.cos(z * 0.37 - x * 0.1) * 0.45;
    const ridge = Math.max(0, -z - 6) * (0.15 + 0.19 * (0.5 + 0.5 * Math.sin(x * 0.41)) - east * 0.45);
    return 3.38 + east * 4.25 + hill + ridge - z * 0.052;
  }
  const sites = new Map<string, Site>(),
    entries = new Map<number, Vector3>();
  const pads: { p: Vector3; back: number; width: number }[] = [];
  for (const spec of nodes) {
    const x = Math.round(column(spec.kind === 'boss' ? cols - 1 : spec.layer) / TILE_WIDTH) * TILE_WIDTH;
    const fraction = spec.count > 1 ? spec.index / (spec.count - 1) - 0.5 : 0;
    const z = snap(fraction * (spec.count === 2 ? 15.5 : 24) + Math.sin(spec.layer * 1.8) * 1.05);
    const h = spec.kind === 'boss' ? 9.12 : terrace(upland(x, z));
    const p = new Vector3(x, h + DECK, z);
    sites.set(nodeKey(spec.layer, spec.index), { spec, pos: p });
    pads.push({ p, back: spec.kind === 'boss' ? 6 : 3.1, width: spec.kind === 'boss' ? 4 : 1.9 });
    if (spec.layer === 0) {
      const ez = fraction * 1.7,
        ep = new Vector3(GATE_X, terrace(upland(GATE_X, 0)) + ROAD_LIFT, ez);
      entries.set(spec.index, ep);
      pads.push({ p: ep.clone().add(new Vector3(0, DECK - ROAD_LIFT, 0)), back: 1.5, width: 1.5 });
    }
  }
  const cells = new Map<number, Cell>();
  const cellId = (x: number, z: number) => Math.round(z / GRID) * 256 + Math.round(x / TILE_WIDTH);
  for (let iz = -17; iz <= 17; iz++)
    for (let ix = -30; ix <= 30; ix++) {
      const x = ix * TILE_WIDTH,
        z = iz * GRID;
      const bay = z > 0 ? 1.65 * Math.cos((x - riverBase) * 0.3) + 1.05 * Math.sin(x * 0.45) : 1.1 * Math.sin(x * 0.32);
      const silhouette = (Math.abs(x) / 41.4) ** 3.8 + (Math.abs(z) / (16.65 - bay)) ** 3.8;
      let edge = 1 - silhouette + 0.16 * Math.sin(x * 0.38 + z * 0.21) + 0.075 * Math.cos(z * 0.83 - x);
      // A node near a scalloped shoreline grows its own contiguous rock footing.
      for (const { p, back, width } of pads) {
        const outside = Math.max(Math.abs(x - p.x) - width, p.z - z - back, z - p.z - 1.88);
        edge = Math.max(edge, 0.22 - outside * 0.22);
      }
      if (edge < 0) continue;
      const bankDistance = Math.abs(x - river(z));
      let wet = bankDistance <= 1.48;
      const bankBlend = ease(clamp((bankDistance - 1.45) / 3.1, 0, 1));
      let h = wet ? waterLevel(z) - 0.38 : terrace(MathUtils.lerp(waterLevel(z) + 0.26, upland(x, z), bankBlend));
      for (const { p, back, width } of pads) {
        const d = Math.max(Math.abs(x - p.x) - width, p.z - z - back, z - p.z - 1.88);
        if (d > 2 || (wet && d > 0)) continue;
        if (d <= 0) wet = false;
        h = terrace(MathUtils.lerp(p.y - DECK, h, ease(clamp(d / 2, 0, 1))));
      }
      // The outer lip ends early. Deeper columns form irregular, visible inward steps.
      const buttress = 1.2 + 1.15 * Math.cos(x * 0.52 + z * 0.32);
      const root = -0.95 - Math.min(edge, 0.83) * (3.7 + buttress * 2.1) - noise(ix, iz) * 1.15;
      cells.set(cellId(x, z), { x, z, h, root: terrace(root), wet });
    }
  const at = (x: number, z: number) => cells.get(cellId(x, z));
  const ground = (x: number, z: number) => at(x, z)?.h ?? terrace(upland(x, z));
  const spans = new Map<number, Span>(),
    roads = new Map<string, Road>();
  function makeRoad(key: string, a: Vector3, b: Vector3): Road {
    const controls = [a];
    let span: Span | undefined;
    if ((a.x - river(a.z)) * (b.x - river(b.z)) < 0) {
      const z = clamp(
        Math.round(MathUtils.lerp(a.z, b.z, clamp((riverBase - a.x) / (b.x - a.x || 1), 0, 1)) / 3.75) * 3.75,
        -12,
        12,
      );
      span = spans.get(z);
      if (!span) {
        const x = river(z),
          half = 2.65;
        span = {
          x,
          z,
          half,
          bank: Math.max(ground(x - half, z), ground(x + half, z), waterLevel(z) + 0.65) + ROAD_LIFT,
        };
        spans.set(z, span);
      }
      const dir = Math.sign(b.x - a.x) || 1;
      for (const side of [-dir, dir]) controls.push(new Vector3(span.x + side * span.half, span.bank, z));
    }
    controls.push(b);
    const points = [a.clone()],
      distances = [0];
    for (let k = 1; k < controls.length; k++) {
      const u = controls[k - 1],
        v = controls[k],
        crossing = span && k === 2;
      const steps = Math.max(2, Math.ceil(Math.hypot(v.x - u.x, v.z - u.z) / 0.56));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps,
          x = MathUtils.lerp(u.x, v.x, t),
          z = MathUtils.lerp(u.z, v.z, ease(t));
        let y = crossing ? bridgeTop(span!, x) : ground(x, z) + ROAD_LIFT;
        // Seat the approaches on the raised paving and on the bridge abutments.
        const approach = (p: Vector3) => clamp(1 - Math.hypot(x - p.x, z - p.z) / 1.8, 0, 1);
        if (!crossing) y = Math.max(y, MathUtils.lerp(y, u.y, approach(u)), MathUtils.lerp(y, v.y, approach(v)));
        const p = i === steps ? v.clone() : new Vector3(x, y, z);
        distances.push(distances.at(-1)! + p.distanceTo(points.at(-1)!));
        points.push(p);
      }
    }
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
  return { sites, entries, cells, roads, spans, river, waterLevel, at, ground };
}
export type Terrain = ReturnType<typeof survey>;
