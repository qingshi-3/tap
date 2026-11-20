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
  const haze = new Color(b.sky[1]).lerp(new Color(b.sky[0]), 0.48);
  const tint = (color: number, amount: number) => haze.clone().lerp(new Color(color), amount).getHex();
  const dark = tint(b.rock[0], 0.57), stone = tint(b.rock[2], 0.47);
  const roof = tint(b.flag, 0.46), grass = tint(b.turf[1], 0.42);
  const distantRock = tint(b.rock[1], 0.28), distantTop = tint(b.turf[1], 0.22);
  const night = theme === 'moonlit_woods' || theme === 'ashen_citadel';
  const cloud = tint(b.cloud, night ? 0.13 : 0.34), cloudTop = tint(b.cloud, night ? 0.22 : 0.52);
  const far = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) =>
    box(x, y, z, w, h, d, color, 'light');

  const swatch = new Color(), skylight = new Color(b.cloud);
  function faceted(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    const sideColor = swatch.setHex(color).multiplyScalar(0.71).getHex();
    const topColor = swatch.setHex(color).lerp(skylight, night ? 0.075 : 0.17).getHex();
    // Split the existing volume at its top and front. The exposed side keeps
    // a soft shadow in both renderers, with no coincident exterior faces.
    const cap = Math.min(0.1, h * 0.18), front = Math.min(0.09, d * 0.18), body = h - cap;
    far(x, y, z - front * 0.5, w, body, d - front, sideColor);
    far(x, y, z + (d - front) * 0.5, w, body, front, color);
    far(x, y + body, z, w, cap, d, topColor);
  }

  // Two tiers of stepped vapour sit behind the rocks. Breaks in each band leave
  // clear sky around the route's landmark, especially when the camera orbits.
  function cloudBank(x: number, y: number, z: number, w: number, h: number) {
    far(x, y, z, w, h, 2.8, cloud);
    far(x - w * 0.08, y + h, z - 0.43, w * 0.73, h * 0.8, 2.75, cloud);
    far(x - w * 0.17, y + h * 1.8, z - 0.73, w * 0.35, h * 0.67, 2.23, cloudTop);
    far(x + w * 0.47, y + h * 0.19, z + 0.21, w * 0.22, h * 0.48, 2.1, cloudTop);
  }
  const leansRight = theme === 'emerald_day' || theme === 'ashen_citadel';
  const side = leansRight ? 1 : -1;
  // The glacier and caldera rise far above their western/eastern shores respectively.
  const highShore = theme === 'alpine_snow' ? 8.8 : theme === 'ashen_citadel' ? 6.5 : 0;
  const mainX = theme === 'alpine_snow' ? -56 : theme === 'ashen_citadel' ? 49 : side * 44;
  const cloudLift = highShore * 0.79;
  cloudBank(mainX - side * 4, -14.8 + cloudLift, -89, 33, 1.14);
  cloudBank(-side * 54, -16.1 + cloudLift, -74, 25, 0.88);
  cloudBank(mainX + side * 14, -20.6 + cloudLift, -67, 16, 0.56);

  // A broken underside and offset toes give each silhouette a suspended mass.
  function island(x: number, y: number, z: number, w: number, d: number, near: boolean) {
    const block = near ? faceted : far;
    const depth = Math.min(w * 0.24, 4.2);
    const base = near ? dark : distantRock, top = near ? grass : distantTop;
    block(x + w * 0.06, y - depth, z, w * 0.88, depth, d * 0.88, base);
    block(x - w * 0.1, y - depth * 1.81, z - 0.25, w * 0.49, depth, d * 0.65, base);
    block(x - w * 0.13, y - depth * 2.24, z, w * 0.2, depth * 0.58, d * 0.41, base);
    block(x + w * 0.28, y - depth * 1.55, z, w * 0.17, depth * 0.72, d * 0.49, base);
    block(x, y - 1.02, z, w, 0.72, d, near ? stone : distantRock);
    block(x, y - 0.3, z, w * 0.98, 0.3, d * 0.98, top);
  }

  // The large silhouette is on the shoulder opposite the main island's wonder.
  // The smaller outcrop recedes by 18 world units; both have open sky behind them.
  function crown(x: number, y: number, z: number, scale: number, near: boolean) {
    const wall = near ? stone : distantRock, cap = near ? roof : distantTop;
    const shadow = near ? dark : distantRock;
    const block = near ? faceted : far;
    const piece = (dx: number, base: number, dz: number, w: number, h: number, d: number, color = wall) =>
      block(x + dx * scale, y + base * scale, z + dz * scale, w * scale, h * scale, d * scale, color);
    island(x, y, z, 22 * scale, 7 * scale, near);
    if (theme === 'autumn_sunset') {
      // Temple roofs turn up at each end, above a lower gatehouse.
      for (let tier = 0; tier < 3; tier++) {
        const w = 8.3 - tier * 1.8, level = tier * 2.65;
        piece(-3, level, 0, w * 0.75, 1.83, w * 0.47);
        piece(-3, level + 1.83, 0, w + 1.7, 0.49, w * 0.69, cap);
        for (const dir of [-1, 1]) piece(-3 + dir * (w * 0.5 + 0.51), level + 2.32, 0, 0.69, 0.37, w * 0.61, cap);
        piece(-3, level + 2.32, 0, w * 0.78, 0.33, w * 0.53, cap);
      }
      piece(-3, 7.95, 0, 0.62, 1.55, 0.61, cap);
      for (const dx of [3.2, 7.2]) piece(dx, 0, 0, 0.72, 2.55, 0.81, shadow);
      piece(5.2, 2.55, 0, 6.6, 0.58, 2.1, cap);
    } else if (theme === 'golden_oasis') {
      // A column arcade terminating in a stepped sandstone obelisk.
      for (const dx of [-8, -3.6, 0.8]) {
        piece(dx, 0, 0, 1.42, 3.5, 2.3, shadow);
        piece(dx, 3.5, 0, 2.8, 0.83, 2.62);
      }
      piece(-3.6, 4.33, 0, 11.65, 0.99, 2.85);
      for (const [level, w, h] of [[0, 6.1, 1.1], [1.1, 4.1, 3.5], [4.6, 3, 3.1], [7.7, 1.91, 1.9], [9.6, 0.81, 1.1]])
        piece(6.5, level, -0.35, w, h, w * 0.82, level === 9.6 ? cap : wall);
    } else if (theme === 'alpine_snow') {
      // Offset summit and shoulder create two asymmetric snow cornices.
      for (const [dx, dz, size, lean] of [[-3.8, -0.7, 1.23, 1], [5.8, 0.65, 0.76, -1]]) {
        for (let i = 0; i < 6; i++) {
          const width = (10.1 - 1.75 * i) * size;
          piece(dx + lean * i * 0.49 * size, i * 1.67 * size, dz, width, 1.68 * size,
            (5.35 - i * 0.85) * size, i >= 3 ? (near ? grass : distantTop) : wall);
        }
      }
    } else if (theme === 'moonlit_woods') {
      // A high stone walkway ties the forked observatory to a shorter needle.
      for (const [dx, h, w] of [[-4.2, 8.5, 3.7], [5.4, 5, 2.65]]) {
        piece(dx, 0, 0, w + 1.2, 1.3, w);
        piece(dx, 1.3, 0, w * 0.69, h - 1.3, w * 0.66, shadow);
        piece(dx, h, 0, w, 0.84, w * 0.86, cap);
        for (const dir of [-1, 1]) {
          piece(dx + dir * w * 0.34, h + 0.84, 0, w * 0.31, w * 0.63, w * 0.43, cap);
          piece(dx + dir * w * 0.38, h + 0.84 + w * 0.63, 0, w * 0.18, w * 0.41, w * 0.26, cap);
        }
      }
      piece(0.6, 3.74, 0, 9.5, 0.68, 1.23);
    } else if (theme === 'ashen_citadel') {
      // A heavy furnace wall, a raised gantry and a staggered chimney cluster.
      piece(-3.4, 0, 0, 10.3, 2.4, 4.4, shadow);
      for (const [dx, h, w] of [[-6.8, 8.5, 2.08], [-2.7, 10.6, 2.48], [4.9, 5.6, 3.26]]) {
        piece(dx, 0, -0.41, w + 0.72, h * 0.42, w);
        piece(dx, h * 0.42, -0.41, w * 0.71, h * 0.58, w * 0.72, shadow);
        piece(dx, h, -0.41, w + 0.33, 0.87, w + 0.12, cap);
      }
      piece(1.3, 3.82, -0.35, 7.5, 1.08, 1.31);
    } else {
      // Pale hill fort with steep roofs and a lower curtain opening between towers.
      for (const [dx, dz, h, w] of [[-6.7, 0.55, 4.5, 2.65], [-1.6, -0.8, 7.7, 3.83], [6.25, 0.2, 4.9, 3.1]]) {
        piece(dx, 0, dz, w, h, w * 0.82);
        for (let i = 0; i < 3; i++) {
          const width = w * (1.33 - i * 0.44);
          piece(dx, h + i * w * 0.38, dz, width, w * 0.38, width * 0.86, cap);
        }
      }
      piece(2.5, 2.4, 0, 5.2, 0.88, 1.7, shadow);
    }
  }
  crown(mainX - side * 17, -20.8 + highShore * 0.83, -72, 0.62, false);
  crown(mainX, -12.6 + highShore, -52, 1.08, true);
  const flank = -side * 61;
  island(flank, -12.7, -48, 15, 5, true);
  for (const [dx, size] of [[-2.8, 1], [2.4, 0.59]]) {
    faceted(flank + dx, -12.7, -48, 3.3 * size, 2.72 * size, 2.74 * size, stone);
    faceted(flank + dx, -12.7 + 2.72 * size, -48, 2 * size, 1.73 * size, 1.83 * size, roof);
    faceted(flank + dx + 0.13, -12.7 + 4.45 * size, -48, 0.79 * size, 1.05 * size, 0.72 * size, roof);
  }
  island(-side * 49, -15.7, -53, 6.8, 3.4, false);
  island(mainX + side * 16, -15.8, -55, 5.6, 3.5, false);
}
