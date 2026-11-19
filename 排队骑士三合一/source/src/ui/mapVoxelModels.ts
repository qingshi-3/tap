import type { Box, Motion } from './mapVoxelBatch';
import type { Biome } from './mapVoxelThemes';
import type { Site } from './mapVoxelTerrain';

const WOOD = 0x684b42,
  BARK = 0x795742,
  GOLD = 0xe4b458,
  IVORY = 0xf0d8aa;
const flame: Motion = (o, t) => {
  const v = 0.9 + 0.18 * Math.sin(t * 8 + o.position.x * 3) + 0.08 * Math.sin(t * 15 + o.position.z);
  o.position.y += ((v - 1) * o.scale.y) / 2;
  o.scale.y *= v;
};
function fire(box: Box, x: number, y: number, z: number, s: number) {
  box(x, y, z, 0.65 * s, 0.65 * s, 0.64 * s, 0xff732c, 'light', flame);
  box(x - 0.13 * s, y + 0.3 * s, z + 0.12 * s, 0.36 * s, 0.77 * s, 0.36 * s, 0xffcf53, 'light', flame);
  box(x + 0.19 * s, y + 0.51 * s, z - 0.13 * s, 0.22 * s, 0.66 * s, 0.22 * s, 0xffa23c, 'light', flame);
  box(x - 0.08 * s, y + 0.13 * s, z + 0.3 * s, 0.22 * s, 0.43 * s, 0.16 * s, 0xffed9b, 'light', flame);
}

export function tree(box: Box, theme: string, b: Biome, x: number, y: number, z: number, s: number, r: number) {
  const block = (dx: number, dy: number, dz: number, w: number, h: number, d: number, c: number) =>
    box(x + dx * s, y + dy * s, z + dz * s, w * s, h * s, d * s, c);
  const f = b.leaf;
  if (theme === 'golden_oasis') {
    for (let i = 0; i < 5; i++) block(i * 0.08, i * 0.51, 0, 0.45 - i * 0.033, 0.53, 0.42, i % 2 ? BARK : 0xa17c50);
    for (let arm = 0; arm < 5; arm++) {
      const a = arm * Math.PI * 0.4 + r * 3;
      for (let j = 0; j < 3; j++) {
        const offset = 0.32 + j * 0.52;
        block(
          0.32 + Math.cos(a) * offset,
          2.5 - j * j * 0.13,
          Math.sin(a) * offset,
          0.84 - j * 0.1,
          0.24,
          0.73 - j * 0.1,
          f[(arm + j) % 4],
        );
      }
    }
    block(0.4, 2.18, 0.22, 0.4, 0.36, 0.42, 0xc98b43);
  } else if (theme === 'ashen_citadel') {
    // Basalt organ pipes with glowing seams, and a broken carbonised bough.
    for (let j = 0; j < 4; j++) {
      const h = 0.9 + ((r * 7 + j * 0.38) % 1) * 2.4;
      block(((j % 2) - 0.5) * 0.52, 0, (Math.floor(j / 2) - 0.5) * 0.54, 0.52, h, 0.54, f[j % 3]);
      if (j === 1) block(0.26, h * 0.66, 0.016, 0.16, h * 0.25, 0.08, 0xef7444);
    }
    block(-0.48, 1.1, 0, 0.64, 0.28, 0.34, f[1]);
    block(-0.72, 1.38, 0, 0.22, 0.56, 0.28, f[2]);
  } else if (theme === 'autumn_sunset' || (theme === 'emerald_day' && r > 0.65)) {
    block(0, 0, 0, 0.5, 2.1, 0.48, BARK);
    block(-0.39, 1.28, 0, 0.68, 0.25, 0.29, WOOD);
    const autumn = theme === 'autumn_sunset',
      k = Math.floor(r * 3);
    const shade = autumn ? [0x983f32, 0xbb572e, 0xb37b32][k] : f[1];
    const crown = autumn ? f[k + 1] : f[2];
    block(0, 1.7, 0, 1.96, 0.75, 1.78, shade);
    block(-0.16, 2.34, -0.08, 1.76, 0.86, 1.64, crown);
    block(-0.32, 3.14, -0.13, 1.01, 0.45, 1.14, autumn ? [0xf58b46, 0xffb357, 0xf3cf68][k] : f[3]);
    block(0.87, 2.13, 0.08, 0.65, 0.7, 1.09, crown);
    block(-0.92, 2.04, 0.2, 0.57, 0.63, 0.98, crown);
  } else {
    block(0, 0, 0, 0.45, 1.55, 0.45, BARK);
    for (let i = 0; i < 4; i++) {
      const w = 2.28 - i * 0.53,
        bottom = 0.91 + i * 0.66;
      block(0, bottom, 0, w, 0.64, w * 0.87, f[Math.min(2, i)]);
      block(0, bottom + 0.06, 0, w * 0.72, 0.58, w * 1.11, f[Math.min(2, i)]);
      if (theme === 'alpine_snow') block(-0.04, bottom + 0.53, 0, w * 0.94, 0.17, w * 0.91, f[3]);
    }
    block(0, 3.48, 0, 0.28, 0.46, 0.28, f[3]);
  }
}

function castle(box: Box, x: number, y: number, z: number, theme: string, b: Biome) {
  const dark = theme === 'ashen_citadel',
    oasis = theme === 'golden_oasis';
  const wall = dark ? 0x544857 : oasis ? 0xc7976d : 0xb3ac9f;
  const trim = dark ? 0x937078 : oasis ? 0xf0c894 : 0xe9d6b2;
  const roof = dark ? 0x533548 : oasis ? 0x437d7c : 0x355564;
  const window = dark ? 0xff8449 : 0xffdc80;
  const bld = (dx: number, dy: number, dz: number, w: number, h: number, d: number, c: number) =>
    box(x + dx, y + dy, z + dz, w, h, d, c);
  function standard(dx: number, dy: number, dz: number) {
    bld(dx, dy, dz, 0.12, 1.48, 0.12, GOLD);
    bld(dx + 0.42, dy + 0.81, dz, 0.81, 0.48, 0.1, b.flag);
    bld(dx + 0.91, dy + 0.81, dz, 0.27, 0.25, 0.1, b.flag);
    bld(dx + 0.19, dy + 0.79, dz + 0.06, 0.14, 0.49, 0.05, GOLD);
  }
  function tower(dx: number, dz: number, w: number, h: number) {
    bld(dx, 0, dz, w + 0.28, 0.45, w + 0.28, trim);
    bld(dx, 0.45, dz, w, h - 0.45, w, wall);
    bld(dx, h * 0.55, dz, w + 0.11, 0.17, w + 0.11, trim);
    bld(dx, h - 0.44, dz, w + 0.24, 0.21, w + 0.24, trim);
    bld(dx, h - 0.23, dz, w + 0.45, 0.23, w + 0.45, wall);
    bld(dx, h * 0.65, dz + w / 2, 0.3, 0.8, 0.09, roof);
    box(x + dx, y + h * 0.65 + 0.08, z + dz + w / 2 + 0.05, 0.12, 0.52, 0.05, window, 'light');
    for (let i = 0; i < 5; i++) {
      const a = (w + 0.62) * (1 - i * 0.195);
      bld(dx, h + i * 0.41, dz, a, 0.42, a, i % 2 ? roof : dark ? 0x714153 : 0x456778);
    }
    standard(dx, h + 2.04, dz);
  }
  bld(0, 0, -1.55, 4.64, 3.65, 2.55, wall);
  bld(0, 3.45, -1.55, 4.9, 0.34, 2.82, trim);
  for (let i = -2; i <= 2; i++) bld(i * 0.94, 3.79, -0.28, 0.53, 0.51, 0.52, wall);
  tower(-2.32, -1.82, 1.55, 4.75);
  tower(2.12, -2.55, 1.72, 5.9);
  tower(0.43, -3.45, 1.48, 7.05);
  // Freestanding gatehouse. The stepped arch leaves a recess with a lit portcullis.
  bld(0, 0.15, -0.16, 1.69, 2.42, 0.26, roof);
  for (const side of [-1, 1]) {
    bld(side * 1.07, 0, 0.32, 0.66, 2.84, 0.98, wall);
    bld(side * 0.76, 1.85, 0.32, 0.29, 0.65, 1, trim);
    bld(side * 0.52, 2.25, 0.32, 0.27, 0.41, 1, trim);
    bld(side * 1.07, 2.84, 0.32, 0.86, 0.42, 1.21, trim);
    bld(side * 1.6, 0.12, 0.64, 0.48, 0.82, 0.48, roof);
    fire(box, x + side * 1.6, y + 0.94, z + 0.64, 0.57);
  }
  bld(0, 2.6, 0.32, 2.58, 0.44, 0.99, trim);
  for (const dx of [-0.44, 0, 0.44]) box(x + dx, y + 0.25, z - 0.005, 0.1, 1.6, 0.07, window, 'light');
  standard(-1.08, 3.26, 0.32);
}

export function landmark(box: Box, site: Site, theme: string, b: Biome) {
  const { spec, pos } = site,
    { x, y } = pos,
    z = pos.z - 1.66;
  const put = (dx: number, dy: number, dz: number, w: number, h: number, d: number, c: number) =>
    box(x + dx, y + dy, z + dz, w, h, d, c);
  // A dressed three-by-three pavement has a low, readable front edge beneath the icon.
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      box(x + i * 0.87, y - 0.28, pos.z + j * 0.87, 0.85, 0.28, 0.85, (i + j) % 2 ? b.road : b.rock[3]);
  box(x, y - 0.28, z - 0.46, spec.kind === 'boss' ? 6.8 : 2.72, 0.28, spec.kind === 'boss' ? 6.8 : 2.55, b.rock[2]);
  switch (spec.kind) {
    case 'boss':
      castle(box, x, y, z, theme, b);
      break;
    case 'camp':
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        put(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.65, 0.42, 0.32, 0.39, b.rock[2 + (i % 2)]);
      }
      for (const dz of [-0.28, 0.28]) put(0, 0.12, dz, 1.25, 0.22, 0.22, WOOD);
      for (const dx of [-0.27, 0.27]) put(dx, 0.34, 0, 0.25, 0.22, 1.1, BARK);
      fire(box, x, y + 0.4, z, 1.12);
      put(-1.12, 0, -0.14, 0.34, 0.92, 0.35, WOOD);
      put(-1.12, 0.92, -0.14, 0.4, 0.31, 0.4, GOLD);
      break;
    case 'shop':
      for (const dx of [-1.06, 1.06]) for (const dz of [-0.64, 0.64]) put(dx, 0, dz, 0.16, 1.95, 0.16, WOOD);
      put(0, 0.28, 0.48, 2.25, 0.55, 0.48, BARK);
      put(0, 0.83, 0.48, 2.4, 0.16, 0.58, GOLD);
      for (let i = 0; i < 7; i++) {
        const dx = (i - 3) * 0.37,
          c = i % 2 ? IVORY : b.flag;
        for (let j = -2; j <= 2; j++) put(dx, 2.18 - Math.abs(j) * 0.21, j * 0.39, 0.37, 0.24, 0.4, c);
        put(dx, 1.54, 0.81, 0.36, i % 2 ? 0.24 : 0.32, 0.19, c);
      }
      for (const dx of [-0.73, -0.32, 0.15]) put(dx, 0.99, 0.45, 0.27, 0.22, 0.25, dx < -0.5 ? 0xb84639 : 0xe5a84f);
      put(1.16, 1.32, 0.65, 0.38, 0.1, 0.36, WOOD);
      box(x + 1.16, y + 1.42, z + 0.65, 0.28, 0.32, 0.26, 0xffce68, 'light');
      break;
    case 'treasure':
      put(0, 0, 0, 2.24, 0.23, 1.7, b.rock[3]);
      put(0, 0.23, 0, 1.83, 0.21, 1.39, b.rock[2]);
      put(0, 0.44, 0, 1.53, 0.66, 0.95, 0x895332);
      put(0, 1.1, 0, 1.53, 0.22, 0.95, 0xbd793d);
      put(0, 1.32, 0, 1.38, 0.2, 0.72, 0xa56639);
      for (const dx of [-0.53, 0.53]) put(dx, 0.45, 0, 0.16, 1.02, 0.99, GOLD);
      put(0, 0.89, 0.49, 1.55, 0.14, 0.08, GOLD);
      box(x, y + 0.83, z + 0.55, 0.27, 0.33, 0.11, 0xffe36f, 'light');
      break;
    case 'event':
      put(0, 0, 0, 1.55, 0.28, 1.48, b.rock[3]);
      put(0, 0.28, 0, 1.01, 1.83, 0.84, b.rock[1]);
      put(0, 2.11, 0, 0.77, 0.31, 0.72, b.rock[2]);
      for (const [dx, dy, w, h] of [
        [-0.16, 0.64, 0.13, 0.7],
        [0.03, 1.28, 0.49, 0.13],
        [0.21, 1.42, 0.13, 0.35],
      ])
        box(x + dx, y + dy, z + 0.43, w, h, 0.055, b.foam, 'light');
      box(x, y + 2.76, z, 0.51, 0.51, 0.51, b.foam, 'light', (o, t) => {
        o.position.y += 0.13 * Math.sin(t * 1.6);
        o.rotation.set(0.53, t * 0.65, 0.72);
      });
      break;
    case 'elite':
      put(0, 0, 0, 2.53, 0.24, 1.42, b.rock[0]);
      put(0, 0.24, 0, 1.85, 0.22, 1.06, b.rock[1]);
      for (const sign of [-1, 1]) {
        put(sign * 0.99, 0.24, 0, 0.15, 2.49, 0.16, WOOD);
        put(sign * 0.76, 2.51, 0, 0.86, 0.13, 0.16, GOLD);
        put(sign * 0.74, 1.53, 0, 0.58, 0.98, 0.13, 0xad394a);
        put(sign * 0.84, 1.29, 0, 0.36, 0.24, 0.13, 0x953044);
        put(sign * 0.74, 1.86, 0.08, 0.13, 0.43, 0.08, IVORY);
      }
      break;
    case 'fight':
      put(-0.3, 0, 0.1, 0.95, 0.37, 0.81, b.rock[2]);
      put(-0.39, 0.37, 0.1, 0.6, 0.3, 0.51, b.rock[3]);
      put(0.31, 0, 0, 0.24, 1.79, 0.25, WOOD);
      put(0.45, 1.17, 0, 1.28, 0.47, 0.26, BARK);
      put(1.17, 1.27, 0, 0.23, 0.26, 0.25, GOLD);
      put(0.04, 1.34, 0.14, 0.14, 0.15, 0.05, IVORY);
      break;
  }
}

// The outline of each distant islet is readable at a much smaller scale than a node.
export function summit(box: Box, theme: string, b: Biome, x: number, y: number, z: number, s: number) {
  if (theme === 'alpine_snow' || theme === 'ashen_citadel') {
    const snow = theme === 'alpine_snow';
    for (const [dx, dz, size] of [
      [-1.05, 0.14, 0.61],
      [0.46, -0.4, 1],
      [1.25, 0.44, 0.49],
    ]) {
      for (let i = 0; i < 5; i++) {
        const wide = (2.45 - i * 0.47) * size * s;
        box(
          x + (dx + i * 0.065) * s,
          y + i * 0.59 * s * size,
          z + dz * s,
          wide,
          0.61 * size * s,
          wide * 0.82,
          snow && i > 1 ? b.turf[3] : b.rock[1 + (i % 3)],
        );
        if (snow && i < 3)
          box(
            x + (dx + i * 0.065) * s,
            y + (i + 0.82) * 0.59 * s * size,
            z + dz * s,
            wide * 1.02,
            0.16 * s,
            wide * 0.84,
            b.turf[0],
          );
      }
      if (!snow)
        box(x + dx * s, y + 0.15 * s, z + (dz + 0.55 * size) * s, 0.17 * s, 0.88 * size * s, 0.33 * s, b.foam, 'light');
    }
  } else if (theme === 'golden_oasis') {
    relic(box, theme, b, x, y, z);
  } else {
    tree(box, theme, b, x - 0.46 * s, y, z, s, theme === 'autumn_sunset' ? 0.97 : 0.24);
    if (theme === 'moonlit_woods') relic(box, theme, b, x + 0.58 * s, y, z + 0.46 * s);
  }
}

export function relic(box: Box, theme: string, b: Biome, x: number, y: number, z: number) {
  if (theme === 'golden_oasis') {
    for (const s of [-1, 1]) {
      box(x + s * 1.23, y, z, 0.86, 0.35, 0.87, b.rock[3]);
      box(x + s * 1.23, y + 0.35, z, 0.59, 2.4, 0.63, b.rock[2]);
      box(x + s * 1.02, y + 2.75, z, 0.9, 0.52, 0.77, b.rock[3]);
      box(x + s * 0.68, y + 3.27, z, 1, 0.33, 0.74, b.turf[1]);
    }
    box(x, y + 3.5, z, 0.68, 0.46, 0.85, b.rock[3]);
    box(x + 2, y, z - 0.7, 0.61, 2.98, 0.59, b.rock[3]);
    box(x + 2, y + 2.98, z - 0.7, 0.36, 0.36, 0.34, GOLD);
  } else if (theme === 'moonlit_woods') {
    for (const [dx, dz, s] of [
      [0, 0, 1],
      [0.65, 0.3, 0.62],
      [-0.36, 0.51, 0.43],
    ]) {
      box(x + dx, y, z + dz, 0.22 * s, 0.68 * s, 0.22 * s, IVORY);
      box(x + dx, y + 0.6 * s, z + dz, 0.9 * s, 0.27 * s, 0.82 * s, 0x69d7db, 'light');
      box(x + dx, y + 0.86 * s, z + dz, 0.55 * s, 0.18 * s, 0.51 * s, 0x9ce5e6, 'light');
    }
  } else {
    box(x, y, z, 0.54, 0.88, 0.49, b.rock[2]);
    box(x + 0.38, y, z + 0.12, 0.42, 0.43, 0.58, b.rock[3]);
    box(x - 0.1, y + 0.88, z, 0.31, 0.19, 0.29, theme === 'alpine_snow' ? b.turf[0] : b.leaf[2]);
  }
}
