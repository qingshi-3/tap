import { Color } from 'three';
import type { Box } from './mapVoxelBatch';
import { bridgeTop, type Terrain, type Span } from './mapVoxelTerrain';
import type { Biome } from './mapVoxelThemes';

// The middle of each tread follows the height profile of the route across the gap.
// Rails, lanterns and towers only occupy the outer edges of the crossing.
export function crossing(box: Box, land: Terrain, span: Span, theme: string, b: Biome) {
  const { x, z, half } = span;
  const count = Math.max(7, 2 * Math.ceil(half / 0.65) + 1);
  const step = half * 2 / count;
  const topAt = (dx: number) => bridgeTop(span, x + dx);
  const edge = half - step * 0.5;
  const pier = (dx: number, w: number, depth: number, color: number) => {
    const top = topAt(dx), floor = Math.min(land.ground(x + dx, z) - 0.24, top - 0.6);
    box(x + dx, floor, z, w, top - floor, depth, color);
  };
  const timber = theme === 'autumn_sunset', moon = theme === 'moonlit_woods';
  const sand = theme === 'golden_oasis', ice = theme === 'alpine_snow', forge = theme === 'ashen_citadel';
  const deck = timber ? 0xb77951 : moon ? 0x707391 : sand ? 0xd4ac80 : ice ? 0xc1e2df : forge ? 0x7b6065 : 0xb5b79d;
  for (let i = 0; i < count; i++) {
    const dx = -half + (i + 0.5) * step, u = Math.abs(dx) / half;
    const top = topAt(dx);
    const thick = ice ? 0.44 + 0.98 * u * u : sand ? 0.44 : timber || moon || forge ? 0.26 : 0.43 + 1.21 * u * u;
    const shade = !timber || i % 3 ? deck : 0x956043;
    box(x + dx, top - thick, z, step + 0.012, thick, 1.91, shade);
    for (const side of [-1, 1]) {
      const rz = z + side * 0.96;
      if (timber) {
        // Pigmented timber rail in a low arc, over exposed dark stringers.
        box(x + dx, top - 0.52, rz, step + 0.02, 0.38, 0.23, 0x75433a);
        box(x + dx, top + 0.47, rz, step + 0.02, 0.15, 0.19, 0xad3e32);
        if (i % 4 === 0 || i === count - 1) box(x + dx, top, rz, 0.23, 0.65, 0.23, 0x904236);
      } else if (moon) {
        // A shallow catenary links the two tall moorings above each side of the deck.
        const wire = 0.45 + u * u * 1.23;
        box(x + dx, top + wire, rz, step + 0.02, 0.17, 0.16, 0xb2a6df, 'light');
        if (i % 3 === 0) box(x + dx, top, rz, 0.12, wire, 0.12, 0x696884);
        if (i < count - 1) {
          const next = dx + step;
          const rise = topAt(next) + 0.45 + (next / half) ** 2 * 1.23 - top - wire;
          if (Math.abs(rise) > 0.12)
            box(x + dx + step / 2, top + wire + Math.min(0, rise), rz, 0.13, Math.abs(rise) + 0.12, 0.16, 0xb2a6df, 'light');
        }
        box(x + dx, top - 0.32, rz, step + 0.01, 0.16, 0.25, 0x4f4976);
      } else if (sand) {
        // Each half has its own dark culvert beneath the sun-baked stone cap.
        const haunch = 0.32 + Math.abs(u * 2 - 1) ** 2 * 0.97;
        box(x + dx, top - haunch - 0.28, rz, step + 0.015, haunch, 0.36, 0x9c6551);
        if (i % 3 === 0) box(x + dx, top, rz, step * 0.94, 0.29, 0.41, 0xe3c49c);
      } else if (ice) {
        box(x + dx, top - thick, rz, step + 0.01, thick * 0.7, 0.34, i % 3 ? 0x5494ad : 0x73acbe);
        if (i % 3 === 1) box(x + dx, top - thick - 0.57 - u * 0.33, rz, step * 0.53, 0.6 + u * 0.33, 0.26, 0x88c5cf);
      } else if (forge) {
        // Perforations through the iron truss reveal the lava under the deck.
        box(x + dx, top - 0.93, rz, step + 0.015, 0.23, 0.31, 0x453846);
        box(x + dx, top - 0.36, rz, step + 0.015, 0.2, 0.34, 0x584452);
        if (i % 2 === 0) box(x + dx, top - 0.74, rz, 0.19, 0.43, 0.26, 0x8c5960);
      } else {
        box(x + dx, top - thick, rz, step + 0.013, thick, 0.29, 0x74827b);
        if (i % 4 === 1 || i % 4 === 2) box(x + dx, top, rz, step + 0.01, 0.19, 0.32, 0x75915e);
      }
    }
  }
  for (const dir of [-1, 1]) {
    const dx = dir * edge, top = topAt(dx);
    pier(dx, Math.min(0.9, step * 1.5), 2.14, sand ? 0xad7858 : ice ? 0x6b99a9 : forge ? 0x514352 : b.rock[2]);
    for (const side of [-1, 1]) {
      const rz = z + side * 1.03;
      if (moon) {
        box(x + dx, top, rz, 0.43, 1.67, 0.44, 0x544866);
        box(x + dx, top + 1.67, rz, 0.51, 0.36, 0.48, 0xd4b5f1, 'light');
      } else if (forge) {
        box(x + dx, top, rz, 0.55, 0.82, 0.55, 0x4b3d4c);
        box(x + dx, top + 0.82, rz, 0.48, 0.36, 0.49, 0xff9d4e, 'light');
        box(x + dx, top + 1.18, rz, 0.62, 0.15, 0.57, 0x62505b);
      } else if (sand) {
        box(x + dx, top, rz, 0.57, 0.64, 0.52, 0xb58262);
        box(x + dx, top + 0.64, rz, 0.62, 0.18, 0.58, 0x49837e);
      } else if (timber && side < 0) {
        box(x + dx, top, rz, 0.25, 1.02, 0.25, 0x904236);
        box(x + dx, top + 1.02, rz, 0.35, 0.39, 0.33, 0xffc47a, 'light');
      }
    }
  }
  if (moon) {
    box(x, topAt(0) - 1.08, z + 0.89, 0.14, 0.77, 0.14, 0x9c91ad);
    box(x, topAt(0) - 1.49, z + 0.89, 0.38, 0.45, 0.36, 0xe7cd9b, 'light');
  }
  if (sand) pier(0, Math.min(0.91, half * 0.28), 2.16, 0x96664f);
}

export function landing(box: Box, land: Terrain, theme: string, b: Biome) {
  const { x, z } = land.gate, h = land.ground(x, z);
  const stone = theme === 'golden_oasis' || theme === 'ashen_citadel' || theme === 'alpine_snow';
  const wood = 0x705146;
  const sill = stone ? b.rock[2] : wood;
  for (let i = 0; i < 6; i++) {
    box(x - i * 0.46, h - 0.24, z, 0.46, 0.36, 2.45, stone ? b.road : i % 2 ? 0xa57b58 : 0x936e50);
  }
  for (const side of [-1, 1])
    box(x - 2.15, h - 1.65, z + side * 0.96, 0.43, 1.77, 0.44, sill);
  // The standard stands on the far side of the quay, leaving the entry beacon in view.
  box(x - 0.94, h + 0.1, z - 1.19, 0.49, 0.38, 0.49, sill);
  box(x - 0.94, h + 0.48, z - 1.19, 0.22, 2.32, 0.22, sill);
  box(x - 1.36, h + 2.64, z - 1.19, 1.12, 0.17, 0.25, 0xb7a174);
  box(x - 1.46, h + 1.8, z - 1.19, 0.67, 0.85, 0.12, b.flag);
  box(x - 1.46, h + 1.57, z - 1.19, 0.36, 0.24, 0.12, b.flag);
}

export function distantSkyline(box: Box, theme: string, b: Biome) {
  const haze = new Color(b.sky[1]).lerp(new Color(b.sky[0]), 0.56);
  const stone = haze.clone().lerp(new Color(b.rock[1]), 0.34).getHex();
  const rim = haze.clone().lerp(new Color(b.turf[1]), 0.27).getHex();
  const shade = haze.clone().lerp(new Color(b.rock[0]), 0.39).getHex();
  // Offset the far shelves outward and above the near shore so their rooflines
  // remain visible behind the island when its framing changes between themes.
  const far = (x: number, y: number, z: number, w: number, h: number, d: number, c = stone) =>
    box(x + (x < 0 ? -6 : 19), y + (x < 0 ? 6 : 10), z - 3.5, w, h, d, c, 'light');
  function shelf(x: number, z: number, width: number) {
    far(x + 1, -26, z, width * 0.59, 4, 5.5, shade);
    far(x, -22, z, width, 4, 8);
    far(x, -18, z, width * 1.025, 0.58, 8.1, rim);
  }
  const floor = -17.42;
  if (theme === 'emerald_day') {
    shelf(-47, -45, 23);
    for (const [dx, size] of [[-6, 0.85], [0, 1.26], [4.6, 0.78]]) {
      far(-47 + dx, floor, -46, 0.72 * size, 2 * size, 0.65 * size, shade);
      for (let i = 0; i < 3; i++)
        far(-47 + dx, floor + (1.34 + i * 1.18) * size, -46, (4.7 - i * 1.22) * size,
          1.22 * size, (3.1 - i * 0.82) * size, i === 2 ? rim : stone);
    }
  } else if (theme === 'autumn_sunset') {
    shelf(47, -42, 23);
    for (let i = 0; i < 3; i++) {
      const w = 5.8 - i * 1.26, y = floor + i * 2.5;
      far(46, y, -43, w, 1.71, w * 0.74);
      far(46, y + 1.71, -43, w + 3.2, 0.5, w * 0.81 + 1.7, shade);
      far(46, y + 2.21, -43, w + 1.1, 0.29, w * 0.81, rim);
    }
    far(46, floor + 7.5, -43, 0.6, 1.57, 0.61, shade);
  } else if (theme === 'moonlit_woods') {
    shelf(-48, -44, 21);
    for (const [dx, ht] of [[-5.1, 3.1], [0, 7.2], [4, 4.3]]) {
      far(-48 + dx, floor, -45, 2.8, ht, 2.4, shade);
      far(-48 + dx, floor + ht, -45, 1.82, 1.55, 1.76);
      far(-48 + dx + 0.32, floor + ht + 1.55, -45, 0.75, 1.2, 0.81, rim);
    }
  } else if (theme === 'golden_oasis') {
    shelf(-46, -45, 24);
    for (const dx of [-7, 0, 7]) {
      far(-46 + dx, floor, -46, 2.2, 4.15, 2.61, shade);
      far(-46 + dx, floor + 4.15, -46, 3.65, 1.23, 2.69);
      far(-46 + dx, floor + 5.38, -46, 5.48, 0.98, 2.76);
    }
    far(-46, floor + 6.36, -46, 21.3, 1.06, 2.81);
    far(-46, floor + 7.42, -46, 21.8, 0.37, 2.96, rim);
  } else if (theme === 'alpine_snow') {
    for (const [x, y, z, size] of [[-47,-23,-44,1.4],[-36,-23,-48,0.88],[48,-22,-43,1.22]]) {
      for (let i = 0; i < 5; i++)
        far(x - i * 0.62 * size, y + i * 2.2 * size, z, (15.4 - i * 3.2) * size,
          2.22 * size, (7.9 - i * 1.47) * size, i >= 3 ? rim : stone);
    }
  } else {
    shelf(47, -43, 27);
    far(46, floor, -43, 16.2, 2.75, 5.4, shade);
    for (const [dx, ht] of [[-5.5, 3.3], [-1.7, 6.7], [4.5, 4.4]]) {
      far(46 + dx, floor + 2.75, -43, 1.63, ht, 1.62, shade);
      far(46 + dx, floor + 2.75 + ht, -43, 2.23, 0.58, 2.11);
    }
    far(46, floor + 4.12, -43, 11.2, 0.77, 1.13);
  }
}
