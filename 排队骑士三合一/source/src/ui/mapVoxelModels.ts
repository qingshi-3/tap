import type { Box, Motion } from './mapVoxelBatch';
import type { Biome } from './mapVoxelThemes';
import type { Site } from './mapVoxelTerrain';

const WOOD = 0x684b42,
  BARK = 0x795742,
  GOLD = 0xe4b458,
  IVORY = 0xf0d8aa;
const flame: Motion = (o, t) => {
  const v = 0.94 + 0.12 * Math.sin(t * 4.7 + o.position.x * 3) + 0.055 * Math.sin(t * 8.3 + o.position.z);
  o.position.y += ((v - 1) * o.scale.y) / 2;
  o.scale.y *= v;
};
function fire(box: Box, x: number, y: number, z: number, s: number) {
  box(x, y - 0.01 * s, z + 0.23 * s, 1.39 * s, 1.42 * s, 1, 0xff8c3f, 'aura');
  box(x, y, z, 0.91 * s, 0.46 * s, 0.75 * s, 0xea522b, 'light', flame);
  box(x - 0.14 * s, y + 0.32 * s, z, 0.6 * s, 0.68 * s, 0.5 * s, 0xff9a32, 'light', flame);
  box(x - 0.24 * s, y + 0.89 * s, z - 0.04 * s, 0.3 * s, 0.42 * s, 0.32 * s, 0xffb442, 'light', flame);
  box(x + 0.25 * s, y + 0.24 * s, z + 0.13 * s, 0.33 * s, 0.48 * s, 0.4 * s, 0xffde72, 'light', flame);
  box(x + 0.14 * s, y + 0.68 * s, z, 0.15 * s, 0.19 * s, 0.15 * s, 0xffde86, 'light', (o, t) => {
    const u = (t * 0.38 + Math.abs(x * 0.37 + z * 0.71)) % 1;
    o.position.x += u * 0.42 * s;
    o.position.y += u * 0.62 * s;
    o.scale.multiplyScalar(0.02 + 0.98 * Math.sin(Math.PI * u));
  });
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
  } else if (theme === 'moonlit_woods') {
    // A pale split stem supports a wide cap with a luminous underside.
    block(0, 0, 0, 0.49, 1.74, 0.49, 0x899894);
    block(0.27, 1.5, -0.08, 0.77, 0.77, 0.62, 0xb6c1aa);
    block(0.2, 2.12, -0.04, 2.28, 0.26, 1.76, 0x75c3c1);
    block(0.2, 2.38, -0.04, 2.44, 0.46, 1.9, 0x46627c);
    block(0.05, 2.84, -0.07, 1.71, 0.49, 1.39, 0x627995);
    block(-0.09, 3.33, -0.1, 0.9, 0.24, 0.76, 0x8294ad);
    block(-0.65, 0, 0.27, 0.26, 0.66, 0.3, 0x8b9b96);
    block(-0.7, 0.66, 0.3, 0.86, 0.23, 0.75, 0x689ea7);
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
  const ash = theme === 'ashen_citadel', oasis = theme === 'golden_oasis';
  const wall = ash ? 0x766071 : oasis ? 0x657e89 : 0x9b9fb0;
  const trim = ash ? 0xcb9982 : oasis ? 0xdfd8b5 : 0xe1cdb0;
  const roof = ash ? 0x95314d : oasis ? 0x174c5d : 0x4b4772;
  const stone = (dx: number, dy: number, dz: number, w: number, h: number, d: number, color: number) =>
    box(x + dx, y + dy, z + dz, w, h, d, color);

  // The single high keep carries the standard. Shorter, broad gate towers frame the approach.
  stone(0, 0, -2.32, 5.52, 2.48, 2.44, wall);
  stone(0, 2.48, -2.32, 5.74, 0.38, 2.58, trim);
  stone(0.36, 2.86, -2.78, 2.46, 2.95, 2.05, wall);
  stone(0.36, 5.81, -2.78, 2.8, 0.33, 2.32, trim);
  for (const dx of [-0.12, 0.83]) {
    stone(dx, 3.94, -1.73, 0.48, 1.13, 0.16, 0x3c344b);
    box(x + dx, y + 4.04, z - 1.62, 0.24, 0.87, 0.09, 0xffc878, 'light');
  }
  for (let i = 0; i < 4; i++)
    stone(0.36, 6.14 + i * 0.48, -2.78, 3.08 - i * 0.68, 0.48, 2.72 - i * 0.58, roof);
  stone(0.36, 8.06, -2.78, 0.19, 1.82, 0.19, GOLD);
  stone(1.29, 8.98, -2.78, 1.72, 0.75, 0.16, b.flag);
  stone(2.32, 9.22, -2.78, 0.4, 0.51, 0.16, b.flag);
  stone(0.99, 8.98, -2.67, 0.26, 0.75, 0.1, IVORY);

  for (const side of [-1, 1]) {
    const dx = side * 2.24;
    stone(dx, 0, -0.62, 1.82, 3.05, 1.8, wall);
    stone(dx, 0, -0.62, 2.12, 0.5, 2.11, 0x424353);
    stone(dx, 3.05, -0.62, 2.1, 0.48, 2.08, trim);
    stone(dx, 3.53, -0.62, 2.27, 0.48, 2.21, roof);
    stone(dx, 4.01, -0.62, 1.56, 0.52, 1.52, roof);
    stone(dx, 4.53, -0.62, 0.78, 0.6, 0.76, roof);
    stone(dx, 0.92, 0.32, 0.74, 1.58, 0.17, 0x963949);
    stone(dx, 0.78, 0.32, 0.36, 0.16, 0.17, 0x963949);
    stone(dx, 1.76, 0.42, 0.28, 0.48, 0.12, GOLD);
  }
  // Only the portcullis sits at the back of the arch, preserving the shadow around the opening.
  stone(0, 0, -1, 2.7, 2.55, 0.35, 0x322d40);
  for (const dx of [-0.62, 0, 0.62]) stone(dx, 0.32, -0.77, 0.23, 2.2, 0.18, GOLD);
  stone(0, 1.66, -0.66, 2.15, 0.22, 0.2, BARK);
  for (const side of [-1, 1]) {
    stone(side * 1.13, 0, 0.04, 0.48, 2.58, 1.01, trim);
    stone(side * 0.79, 2.02, 0.04, 0.48, 0.56, 1.01, trim);
    stone(side * 1.13, 0, 0.7, 0.54, 0.64, 0.55, wall);
    fire(box, x + side * 1.13, y + 0.64, z + 0.7, 0.63);
  }
  stone(0, 2.58, 0.04, 2.85, 0.54, 1.04, trim);
  stone(0, 3.12, 0.04, 0.72, 0.48, 0.98, GOLD);
  stone(0, 2.54, 0.6, 1.01, 0.89, 0.23, 0x75394e);
  stone(0, 2.35, 0.6, 0.59, 0.19, 0.23, 0x75394e);
  box(x, y + 2.34, z + 0.78, 1.24, 1.22, 1, 0xffb757, 'aura');
  box(x, y + 2.7, z + 0.76, 0.51, 0.51, 0.15, 0xffce76, 'light', (o, t) => {
    o.rotation.z = Math.PI / 4;
    const crest = 0.92 + 0.12 * Math.cos(t * 1.17 + x);
    o.scale.x *= crest;
    o.scale.y *= crest;
  });
}

export function landmark(box: Box, site: Site, theme: string, b: Biome) {
  const { spec, pos } = site, { x, y } = pos;
  const z = pos.z - 1.66;
  const phase = spec.layer * 1.71 + spec.index * 2.36;
  const put = (dx: number, dy: number, dz: number, w: number, h: number, d: number, color: number) =>
    box(x + dx, y + dy, z + dz, w, h, d, color);

  // The node marker occupies the front apron. Scenery stands on the rear terrace.
  const boss = spec.kind === 'boss';
  put(0, -0.28, boss ? -1.18 : -0.25, boss ? 6.85 : 3.72, 0.28, boss ? 5.3 : 2.66, b.rock[1]);
  box(x, y - 0.24, pos.z + 0.16, 2.56, 0.26, 1.86, b.road);
  switch (spec.kind) {
    case 'boss':
      castle(box, x, y, z, theme, b);
      break;
    case 'fight':
      // A steel blade buried in a split fieldstone, with its broad guard silhouetted against the ground.
      put(-0.12, 0, 0, 2.57, 0.48, 1.63, 0x354556);
      put(0.1, 0.48, -0.08, 1.96, 0.56, 1.38, 0x536778);
      put(0.15, 1.04, -0.12, 1.29, 0.28, 0.97, 0x79919c);
      put(-0.91, 0.48, 0.23, 0.65, 0.3, 0.81, 0x657383);
      put(0, 1.27, -0.12, 0.99, 1.75, 0.53, 0x245574);
      put(-0.23, 1.29, 0.16, 0.44, 1.73, 0.13, 0xb4e4e5);
      put(0.14, 1.29, 0.16, 0.29, 1.73, 0.13, 0x548ea4);
      box(x, y + 1.48, z + 0.28, 0.82, 0.23, 0.11, 0xd7fbff, 'light', (o, t) => {
        // A narrow glint climbs the blade, then rests between passes.
        const cycle = (t + phase + 0.6) % 4.9;
        const sweep = Math.min(1, cycle / 1.42);
        const shine = 0.01 + 0.99 * Math.sin(Math.PI * sweep);
        o.position.y += 1.13 * sweep;
        o.rotation.z = 0.32;
        o.scale.x *= shine;
        o.scale.y *= shine;
      });
      put(0, 3.02, -0.12, 2.43, 0.26, 0.69, 0x744b3b);
      put(0, 3.28, -0.12, 2.43, 0.25, 0.69, 0xedbd64);
      for (const side of [-1, 1]) put(side * 1.07, 2.82, -0.12, 0.31, 0.21, 0.58, 0xc88e49);
      put(0, 3.53, -0.12, 0.47, 0.65, 0.47, 0x663645);
      put(0, 4.18, -0.12, 0.76, 0.4, 0.64, GOLD);
      break;
    case 'elite':
      // A retired warlord's horned helm, mounted above a single long crimson pennon.
      put(0, 0, 0, 2.22, 0.42, 1.62, 0x493749);
      put(0, 0.42, 0, 1.4, 0.24, 1.19, 0x9a6d72);
      put(0, 0.66, 0, 0.81, 0.99, 0.77, WOOD);
      put(0, 0.53, 0.65, 1.15, 1.18, 0.21, 0xbc344e);
      put(0, 0.32, 0.65, 0.49, 0.23, 0.21, 0x9b324b);
      put(0, 1.64, -0.05, 2.22, 1.35, 1.53, 0x3e344d);
      put(0, 2.99, -0.08, 1.7, 0.58, 1.33, 0x86657f);
      put(0, 3.56, -0.16, 0.63, 0.56, 1.13, 0xcd4258);
      for (const side of [-1, 1]) {
        put(side * 0.56, 1.61, 0.66, 0.56, 0.47, 0.25, 0x8d6870);
        box(x + side * 0.5, y + 2.33, z + 0.76, 0.63, 0.31, 0.15, 0xff934f, 'light', (o, t) => {
          // The visor narrows over both eyes together.
          const watch = Math.max(0, Math.cos(t * 1.31 + phase));
          o.scale.y *= 1 - 0.54 * watch * watch;
          o.rotation.z = side * 0.17;
        });
        put(side * 1.12, 2.9, -0.1, 0.74, 0.46, 0.68, 0xb77a53);
        put(side * 1.48, 3.25, -0.1, 0.46, 0.66, 0.54, IVORY);
        put(side * 1.64, 3.89, -0.1, 0.31, 0.44, 0.4, IVORY);
      }
      put(0, 1.99, 0.78, 0.3, 1.12, 0.28, GOLD);
      break;
    case 'camp':
      // The indigo tent has a recessed entrance; its cool canvas frames the warm hearth.
      put(-0.53, 0, -0.29, 2.59, 0.18, 2.15, 0x434656);
      put(-0.59, 0.18, -1.04, 1.86, 1.17, 0.32, 0x35364f);
      for (let i = 0; i < 4; i++) {
        const height = 0.18 + i * 0.54;
        for (const side of [-1, 1])
          put(-0.59 + side * (1.06 - i * 0.28), height, -0.34, 0.57, 0.54, 1.98,
            side < 0 ? (i < 2 ? 0x454780 : 0x646aab) : (i < 2 ? 0x333d6a : 0x4b5792));
      }
      put(-0.59, 2.34, -0.34, 0.55, 0.29, 2.16, 0xb6cdd6);
      put(-0.59, 0.18, 0.63, 0.2, 2.17, 0.19, 0xa47d59);
      put(1.07, 0, 0.17, 1.51, 0.32, 1.3, 0x41475b);
      put(1.07, 0.32, 0.17, 1.27, 0.21, 1.14, 0x776572);
      for (const dz of [-0.28, 0.28]) put(1.07, 0.53, 0.17 + dz, 1.23, 0.22, 0.27, WOOD);
      fire(box, x + 1.07, y + 0.66, z + 0.17, 1.42);
      break;
    case 'shop': {
      // A travelling merchant's wagon with three bold awning stripes and an exposed pair of wheels.
      for (const dx of [-1.02, 1.02]) {
        put(dx, 0, 0.59, 0.79, 0.71, 0.41, 0x533e3e);
        put(dx, 0.19, 0.81, 0.34, 0.34, 0.12, GOLD);
        put(dx, 0.79, -0.64, 0.21, 1.79, 0.23, WOOD);
        put(dx, 0.79, 0.48, 0.21, 1.46, 0.23, WOOD);
      }
      put(0, 0.39, 0, 2.48, 0.24, 1.24, 0x39394a);
      put(0, 0.58, 0, 2.95, 0.76, 1.54, 0x784453);
      put(0, 1.34, 0.2, 3.12, 0.24, 1.38, 0xd7a162);
      put(-0.73, 1.58, 0.19, 0.59, 0.35, 0.58, 0xc15a44);
      put(0.1, 1.58, 0.19, 0.54, 0.32, 0.52, 0x80aaaa);
      for (let i = -1; i <= 1; i++) {
        const color = i === 0 ? 0xf6e7cc : theme === 'golden_oasis' ? 0x773756 : b.flag;
        put(i * 1.1, 2.58, -0.54, 1.1, 0.4, 1.02, color);
        put(i * 1.1, 2.26, 0.37, 1.1, 0.4, 0.84, color);
        put(i * 1.1, 2.02, 0.82, 1.1, i === 0 ? 0.28 : 0.39, 0.26, color);
      }
      // A brass hook suspends an amber trade lantern at the canopy's edge.
      put(1.45, 2.34, 0.84, 0.66, 0.14, 0.23, WOOD);
      const swing: Motion = (o, t) => {
        const sway = 0.21 * Math.sin(t * 1.63 + phase);
        const arm = y + 2.36 - o.position.y;
        o.rotation.z = sway;
        o.position.x += arm * Math.sin(sway);
        o.position.y += arm * (1 - Math.cos(sway));
      };
      box(x + 1.56, y + 1.98, z + 0.9, 0.13, 0.39, 0.16, GOLD, 'solid', swing);
      box(x + 1.56, y + 1.64, z + 0.9, 0.35, 0.38, 0.34, 0xffc86b, 'light', swing);
      break;
    }
    case 'treasure': {
      // Upright lid and a pile of bright loot keep the open coffer legible from above.
      put(0, 0, 0, 2.94, 0.35, 1.94, 0x47455c);
      put(0, 0.35, 0.05, 2.65, 0.98, 1.58, 0x264d61);
      put(0, 1.33, 0.05, 2.82, 0.24, 1.73, GOLD);
      put(0, 1.55, 0.05, 2.55, 0.06, 1.45, 0x32495b);
      put(0, 1.57, -0.56, 2.76, 1.29, 0.49, 0x512c50);
      put(0, 2.86, -0.56, 2.84, 0.19, 0.55, 0xe7bb6b);
      put(0, 3.05, -0.56, 2.78, 0.2, 0.51, 0x315669);
      for (const dx of [-0.96, 0.96]) {
        put(dx, 0.35, 0.06, 0.32, 0.98, 1.65, GOLD);
        put(dx, 1.57, -0.56, 0.32, 1.29, 0.55, GOLD);
      }
      put(-0.24, 1.57, 0.14, 1.51, 0.28, 0.87, 0xffc85a);
      put(-0.43, 1.85, 0.07, 0.95, 0.27, 0.64, 0xffdd81);
      box(x + 0.65, y + 1.58, z + 0.17, 0.56, 0.53, 0.53, 0x53dace, 'light');
      box(x + 0.65, y + 1.29, z + 0.31, 1.1, 1.1, 1, 0x73ead3, 'aura');
      // The gold catches a brief four-point glint over the exposed top coin.
      const glint: Motion = (o, t) => {
        const catchLight = (1 + Math.cos(t * 1.82 + phase)) / 2;
        const size = 0.14 + 0.86 * catchLight ** 4;
        o.scale.x *= size;
        o.scale.y *= size;
      };
      box(x - 0.47, y + 2.24, z + 0.19, 0.64, 0.17, 0.17, 0xffecae, 'light', glint);
      box(x - 0.47, y + 2.05, z + 0.19, 0.17, 0.55, 0.17, 0xffecae, 'light', glint);
      put(0, 0.92, 0.95, 0.62, 0.59, 0.24, IVORY);
      put(0, 1.06, 1.08, 0.22, 0.22, 0.09, 0x494359);
      break;
    }
    case 'event': {
      // Two stepped basalt arms cradle a suspended amethyst. The open centre reads as sky.
      put(0, 0, 0, 2.83, 0.37, 1.69, 0x353951);
      put(0, 0.37, 0, 1.94, 0.41, 1.25, 0x646685);
      for (const side of [-1, 1]) {
        put(side * 0.87, 0.78, 0, 0.8, 0.81, 0.91, 0x504363);
        put(side * 1.23, 1.59, 0, 0.67, 1.12, 0.88, 0x69567e);
        put(side * 1.23, 2.71, 0, 0.76, 0.24, 0.98, 0x8cc9c4);
        put(side * 1.07, 2.95, 0, 0.47, 0.59, 0.58, 0x9989ad);
      }
      // Both pieces pivot around the crystal centre so its luminous seam follows every facet.
      const crystal: Motion = (o, t) => {
        o.position.y += 0.12 * Math.sin(t * 1.37 + phase);
        o.rotation.set(0.56, t * 0.48 + phase, 0.72);
      };
      box(x, y + 1.55, z + 0.12, 0.99, 1.32, 0.99, 0xa362cb, 'solid', crystal);
      box(x, y + 2.04, z + 0.12, 1.05, 0.34, 1.05, 0xf2ccff, 'light', crystal);
      box(x, y + 1.26, z + 0.21, 1.91, 1.9, 1, 0xd697ff, 'aura');
      break;
    }
  }
}

// Larger architectural and natural silhouettes belong to the far ridge. Every
// ground-bearing block has its own footing at the lowest terrace below its footprint.
export function summit(
  box: Box, theme: string, b: Biome, x: number, y: number, z: number, scale: number,
  ground: (x: number, z: number) => number,
) {
  const put: Box = (dx, dy, dz, w, h, d, color, batch, motion, yaw) => {
    const px = x + dx * scale, pz = z + dz * scale;
    const width = w * scale, depth = d * scale, top = y + (dy + h) * scale;
    let base = y + dy * scale;
    if (dy === 0) {
      for (const sx of [-0.48, 0, 0.48])
        for (const sz of [-0.48, 0, 0.48])
          base = Math.min(base, ground(px + sx * width, pz + sz * depth) - 0.08);
    }
    box(px, base, pz, width, top - base, depth, color, batch, motion, yaw);
  };
  switch (theme) {
    case 'emerald_day': {
      // A tapering limestone mill with a tiled hood and four cloth-covered sails.
      put(-0.24, 0, -0.06, 3.44, 0.26, 2.48, 0x868a75);
      put(0, 0, 0, 2.32, 1.76, 1.96, 0xab9477);
      put(0, 1.76, 0, 2.06, 1.52, 1.76, 0xe1cda3);
      put(0, 3.28, 0, 1.8, 0.88, 1.6, 0xf0dcad);
      put(0, 0, 1.005, 0.66, 1.25, 0.16, 0x584238);
      put(0, 1.25, 1.005, 0.86, 0.19, 0.26, BARK);
      put(0, 4.16, 0, 2.52, 0.42, 2.21, 0x924838);
      put(0, 4.58, 0, 1.96, 0.43, 1.72, 0xbd5841);
      put(0, 5.01, 0, 1.3, 0.48, 1.2, 0xcd6948);
      put(0, 5.49, 0, 0.61, 0.29, 0.58, 0x854737);
      put(-1.49, 0, -0.17, 1, 1.49, 1.65, 0xb6a07b);
      put(-1.49, 1.49, -0.17, 1.2, 0.4, 1.94, 0xac503a);
      put(-1.63, 0, 0.73, 0.94, 0.93, 0.42, 0x6a6a61);
      put(-1.63, 0.2, 0.96, 0.59, 0.53, 0.18, 0xb8b396);
      const hub = 3.8;
      put(0, hub - 0.26, 1.05, 0.54, 0.53, 0.92, WOOD);
      for (let arm = 0; arm < 4; arm++) {
        // The wood spar, canvas and stripe share an axle even when time is frozen.
        function sail(dx: number, dy: number, width: number, height: number, face: number, color: number) {
          const revolve: Motion = (pose, t) => {
            const turn = arm * Math.PI / 2 - 0.39 + t * 0.34;
            const cosine = Math.cos(turn), sine = Math.sin(turn);
            pose.position.x = x + (dx * cosine - dy * sine) * scale;
            pose.position.y = y + (hub + dx * sine + dy * cosine) * scale;
            pose.rotation.z = turn;
          };
          put(dx, hub + dy - height / 2, face, width, height, 0.16, color, 'solid', revolve);
        }
        sail(0, 1.28, 0.19, 2.55, 1.48, 0x624536);
        sail(0.36, 1.72, 0.59, 1.63, 1.47, 0xf3d49b);
        sail(0.36, 2.25, 0.59, 0.24, 1.57, 0x3c807f);
      }
      put(0, hub - 0.23, 1.68, 0.46, 0.46, 0.21, GOLD);
      break;
    }
    case 'autumn_sunset': {
      // A maple canopy leans over the vermilion shrine gate. Open sky reads between the posts.
      tree(put, theme, b, -1.17, 0, -0.83, 1.67, 0.26);
      for (const side of [-1, 1]) {
        const post = 0.78 + side * 1.36;
        put(post, 0, 0.93, 0.67, 0.56, 0.73, b.rock[1]);
        put(post, 0.56, 0.93, 0.43, 2.52, 0.44, 0xb83d2e);
        put(post, 3.08, 0.93, 0.71, 0.4, 0.72, 0xe16a3d);
        put(0.78 + side * 2.05, 3.87, 0.93, 0.66, 0.34, 1.01, 0x523e44);
      }
      put(0.78, 2.35, 0.93, 3.5, 0.26, 0.34, 0xad3d2f);
      put(0.78, 3.48, 0.93, 4.32, 0.4, 0.74, 0xd65b35);
      put(0.78, 3.88, 0.93, 3.8, 0.24, 0.89, 0x533c40);
      put(0.78, 2.64, 0.93, 0.56, 0.84, 0.36, 0xe1af57);
      put(0.78, 4.12, 0.93, 2.91, 0.29, 0.73, 0x704b49);
      put(0.78, 0, 0.95, 3.43, 0.18, 1.31, 0x847667);
      break;
    }
    case 'moonlit_woods': {
      // A pierced moon dial of silver-blue stone on a pair of broad steps.
      put(0, 0, 0, 3.55, 0.48, 2.15, 0x48496a);
      put(0, 0.48, 0, 2.55, 0.52, 1.65, 0x82809c);
      put(0, 1, 0, 1.01, 0.42, 1.03, 0xbdac9d);
      const ring = [1, 1.6, 2, 2.2, 2.2, 2.2, 2, 1.6, 1];
      for (const [row, outer] of ring.entries()) {
        const inner = [0, 0.9, 1.35, 1.58, 1.62, 1.58, 1.35, 0.9, 0][row];
        const width = outer - inner, height = 0.46, base = 1.42 + row * height;
        for (const side of [-1, 1]) {
          const dx = side * (outer + inner) / 2;
          put(dx, base, 0, width, height, 0.87, 0x747794);
          put(dx, base, 0.455, width, height, 0.13, side > 0 ? 0x72c7d0 : 0xd7edca, 'light');
        }
      }
      put(0, 2.92, 0.09, 0.46, 1.21, 0.45, 0xffd893, 'light');
      put(0, 3.29, 0.09, 1.01, 0.43, 0.46, 0xffedaf, 'light');
      // Broken counterweight at the dial's foot.
      put(-2.06, 0, -0.5, 1.05, 1.1, 1.18, 0x4e526f);
      put(-2.06, 1.1, -0.5, 0.68, 1.24, 0.8, 0x8787aa);
      put(-2.06, 2.34, -0.5, 0.46, 0.36, 0.56, 0xa3c5cb);
      break;
    }
    case 'golden_oasis': {
      // Wind-cut sandstone arch; the middle opening remains completely clear.
      for (const side of [-1, 1]) {
        put(side * 1.65, 0, 0, 1.52, 1.03, 1.89, b.rock[2]);
        put(side * 1.67, 1.03, 0, 1.04, 2.02, 1.49, 0xcf9164);
        put(side * 1.65, 3.05, 0, 1.31, 0.67, 1.64, 0xe6ae78);
        put(side * 1.34, 3.72, 0, 1.62, 0.55, 1.51, 0xc18a66);
        put(side * 1.02, 4.27, 0, 1.61, 0.46, 1.42, 0xe8bc88);
        put(side * 1.69, 1.51, 0.78, 0.43, 1.01, 0.14, 0x328b81);
      }
      put(0, 4.73, 0, 3.93, 0.52, 1.58, 0xe9c68d);
      put(0, 4.02, 0.07, 0.73, 1.58, 1.72, 0xd59c65);
      put(0, 4.26, 0.98, 0.43, 0.71, 0.18, 0x55c9ae);
      // A surviving lapis-tipped obelisk gives the aqueduct its asymmetric skyline.
      put(2.09, 0, -0.93, 1.38, 1.04, 1.32, 0xac795c);
      put(2.09, 1.04, -0.93, 0.98, 3.63, 1.03, 0xbe8f69);
      put(2.09, 4.67, -0.93, 0.86, 0.98, 0.91, 0x407e7d);
      put(2.09, 5.65, -0.93, 0.51, 0.53, 0.57, 0x73aaa0);
      break;
    }
    case 'alpine_snow': {
      // Asymmetric glacier needles: a blue shadow plane and a white upper facet.
      put(-0.16, 0, -0.11, 4.44, 0.41, 2.16, 0x698699);
      put(-0.47, 0.41, -0.41, 3.25, 0.61, 1.83, 0x87acbc);
      for (const [dx, dz, size] of [[-1.55, 0.38, 0.54], [0, -0.16, 1], [1.49, 0.64, 0.67]]) {
        put(dx, 0, dz, 1.8 * size, 0.74 * size, 1.62 * size, b.rock[2]);
        put(dx, 0.74 * size, dz, 1.67 * size, 2.7 * size, 1.48 * size, 0x4c9bb2);
        put(dx - 0.34 * size, 0.74 * size, dz + 0.5 * size, 0.68 * size, 2.7 * size, 0.52 * size, 0xabe4e6);
        for (let i = 0; i < 4; i++) {
          const width = (1.53 - i * 0.34) * size;
          put(dx + i * 0.07 * size, (3.44 + i * 0.53) * size, dz, width, 0.53 * size, width * 0.92,
            i > 1 ? 0xe7f7ed : 0x98d9e2);
        }
      }
      break;
    }
    case 'ashen_citadel': {
      // An open furnace mouth, black iron lintel and two mismatched chimney stacks.
      put(0, 0, 0, 4.43, 0.62, 2.33, b.rock[1]);
      put(0, 0.62, -0.39, 3.57, 2.21, 1.42, 0x6a4549);
      put(0, 0.62, 0.48, 2.17, 1.43, 0.55, 0xff7331, 'light');
      put(0, 0.62, 0.8, 1.12, 0.84, 0.3, 0xffcc68, 'light');
      for (const side of [-1, 1]) {
        put(side * 1.59, 0.62, 0.59, 0.72, 1.75, 0.98, 0x463a48);
        put(side * 1.27, 2.37, 0.59, 1.15, 0.47, 1.02, 0x8e5d59);
        const height = side < 0 ? 2.39 : 1.31;
        put(side * 1.2, 3.27, -0.39, 0.91, height, 0.96, 0x4e3947);
        put(side * 1.2, 3.27 + height, -0.39, 1.2, 0.38, 1.21, 0x936655);
        put(side * 1.2, 3.65 + height, -0.39, 0.77, 0.12, 0.81, 0xffa344, 'light');
      }
      put(0, 2.84, 0, 4.11, 0.43, 2.09, 0x70505b);
      // A great front-facing flywheel drives the left bellows.
      put(-1.88, 0.59, 1.02, 1.43, 1.56, 0.54, 0x3f374a);
      put(-1.88, 0.97, 1.02, 1.95, 0.82, 0.54, 0x51404e);
      put(-1.88, 0.95, 1.35, 0.87, 0.86, 0.29, 0xa76954);
      put(-1.88, 1.15, 1.54, 0.44, 0.45, 0.23, 0x654553);
      break;
    }
  }
}
