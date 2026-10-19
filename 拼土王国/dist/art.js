// MiniWorldSprites sheets remain unmodified; crop coordinates are documented in assets/SOURCES.md.
const sheets = {
  keep: 'Buildings/Wood/Keep.png', house: 'Buildings/Wood/Houses.png',
  market: 'Buildings/Wood/Market.png', barracks: 'Buildings/Wood/Barracks.png',
  docks: 'Buildings/Wood/Docks.png', workshop: 'Buildings/Wood/Workshops.png',
  chapel: 'Buildings/Wood/Chapels.png', resources: 'Buildings/Wood/Resources.png',
  cave: 'Buildings/Wood/CaveV2.png', grass: 'Ground/TexturedGrass.png',
  dry: 'Ground/DeadGrass.png', trees: 'Nature/Trees.png',
  rocks: 'Nature/Rocks.png', wheat: 'Nature/Wheatfield.png',
};
const images = {};
let loading;

/** Call once before the first frame. A missing sheet keeps the painted fallback usable. */
export async function loadArt() {
  if (!loading) loading = Promise.all(Object.entries(sheets).map(([key, path]) => new Promise(resolve => {
    const image = new Image();
    image.onload = () => { images[key] = image; resolve(true); };
    image.onerror = () => resolve(false);
    image.src = new URL(`./assets/world/${path}`, import.meta.url).href;
  }))).then(results => ({ loaded: results.filter(Boolean).length, total: results.length }));
  return loading;
}

function rect(c, color, x, y, w, h) { c.fillStyle = color; c.fillRect(x, y, w, h); }
function sprite(c, key, sx, sy, sw, sh, x, y, w, h = w) {
  if (!images[key]) return false;
  c.drawImage(images[key], sx, sy, sw, sh, x, y, w, h);
  return true;
}
function start(c, x, y, size) {
  c.save(); c.imageSmoothingEnabled = false;
  c.beginPath(); c.rect(x, y, size, size); c.clip();
  c.translate(x, y); c.scale(size / 32, size / 32);
}
function noise(seed) {
  let n = Number.isFinite(Number(seed)) ? Number(seed) | 0 : 0;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) | 0; return (n >>> 0) / 4294967296; };
}
function tree(c, x, y, size = 16) {
  if (sprite(c, 'trees', 16, 0, 16, 16, x, y, size)) return;
  rect(c, '#805338', x + size * .43, y + size * .5, size * .16, size * .45);
  rect(c, '#356847', x + size * .12, y + size * .28, size * .8, size * .42);
  rect(c, '#568943', x + size * .22, y + size * .12, size * .6, size * .45);
  rect(c, '#86ab51', x + size * .35, y, size * .35, size * .3);
}
function rock(c, x, y, size = 16, variant = 0) {
  if (sprite(c, 'rocks', (variant % 3) * 16, 0, 16, 16, x, y, size)) return;
  rect(c, '#697a7b', x + 2, y + 7, size - 3, size - 8);
  rect(c, '#96a4a0', x + 4, y + 3, size - 7, size - 6);
  rect(c, '#ced1bb', x + 5, y + 3, size - 10, 3);
}

/** Full square terrain tile; all decoration stays inside its own cell. */
export function drawTerrain(ctx, terrain, x, y, size, seed = 0) {
  start(ctx, x, y, size);
  const c = ctx, rand = noise(seed);
  const ground = terrain === 'fertile' ? '#9ba847' : terrain === 'forest' ? '#83a14d' : '#bbc863';
  rect(c, terrain === 'water' ? '#248e9e' : '#8c744a', 0, 0, 32, 32);
  rect(c, ground, 0, 0, 31, 29.5);
  if (terrain !== 'water' && terrain !== 'fertile') {
    sprite(c, 'grass', 16, 0, 16, 16, 0, 0, 16);
    sprite(c, 'grass', 32, 16, 16, 16, 16, 0, 15, 16);
    sprite(c, 'grass', 16, 0, 16, 16, 0, 16, 16, 13.5);
    sprite(c, 'grass', 32, 16, 16, 16, 16, 16, 15, 13.5);
    if (terrain === 'forest') {
      c.fillStyle = '#2d62352b'; c.fillRect(0, 0, 31, 29.5);
    }
  }
  if (terrain === 'water') {
    rect(c, '#43abb3', 0, 0, 31, 29.5);
    rect(c, '#55bdc1', 1, 1, 29, 3);
    for (let i = 0; i < 7; i++) {
      const px = 2 + Math.floor(rand() * 24), py = 5 + Math.floor(rand() * 21);
      rect(c, i % 2 ? '#80d0c7' : '#319fae', px, py, 3 + Math.floor(rand() * 4), 1);
      if (i % 3 === 0) rect(c, '#68c3c0', px + 1, py + 1, 3, 1);
    }
    rect(c, '#d9cc87', 0, 0, 2, 7); rect(c, '#b8bd76', 0, 7, 1, 5);
  } else if (terrain === 'forest') {
    tree(c, 4, 2, 19); tree(c, 14, 9, 17); tree(c, 1, 13, 17);
  } else if (terrain === 'mountain') {
    rect(c, '#989b78', 3, 16, 25, 11);
    rock(c, 2, 9, 21, 1); rock(c, 11, 2, 22, 0); rock(c, 13, 16, 15, 2);
  } else if (terrain === 'fertile') {
    rect(c, '#8a633b', 2, 4, 27, 23);
    for (let row = 0; row < 4; row++) {
      rect(c, '#694c32', 3, 6 + row * 5, 25, 2);
      for (let col = 0; col < 5; col++) {
        const px = 4 + col * 5, py = 4 + row * 5;
        rect(c, '#b5c85c', px, py, 2, 3); rect(c, '#d5d88a', px + 1, py, 2, 1);
      }
    }
  } else {
    for (let i = 0; i < 6; i++) {
      rect(c, i % 2 ? '#a5b552' : '#d2d97c', 2 + Math.floor(rand() * 27), 2 + Math.floor(rand() * 25), 1, 1);
    }
  }
  // A shallow soil lip gives loose backpack pieces a solid thickness without an outline.
  if (terrain !== 'water') {
    rect(c, '#b59a61', 1, 29.5, 28, 1);
    rect(c, '#6b68433d', 31, 2, 1, 30);
  }
  c.restore();
}

function fallbackHouse(c, roof = '#bd7a45') {
  rect(c, '#594638', 6, 25, 22, 2);
  rect(c, '#dfc58c', 8, 14, 17, 11); rect(c, '#ae8c5d', 23, 14, 3, 11);
  rect(c, '#725139', 6, 11, 22, 7); rect(c, roof, 8, 7, 17, 9);
  rect(c, roof, 11, 5, 11, 3); rect(c, '#e1ad65', 10, 8, 12, 2);
  rect(c, '#654838', 15, 19, 5, 7);
  rect(c, '#5c7473', 10, 18, 3, 4); rect(c, '#f8d77a', 10, 18, 2, 2);
  rect(c, '#5c7473', 22, 18, 2, 4);
}
function pennant(c, x, y, color) {
  rect(c, '#604b35', x, y, 1, 9);
  rect(c, color, x + 1, y, 5, 3); rect(c, color, x + 1, y + 3, 3, 1);
}
function book(c, x, y) {
  rect(c, '#583e36', x, y + 1, 9, 6);
  rect(c, '#f0e1aa', x + 1, y, 3, 6); rect(c, '#fff0ba', x + 5, y, 3, 6);
  rect(c, '#b9a777', x + 4, y + 1, 1, 6);
}

/** Draw after drawTerrain. The occupied clearing covers forest/rock decorations. */
export function drawBuilding(ctx, type, x, y, size, level = 1) {
  start(ctx, x, y, size);
  const c = ctx, tier = Math.min(3, Math.max(1, Math.trunc(Number(level)) || 1));
  // Opaque clearing prevents terrain trees from showing through a building's transparent pixels.
  rect(c, '#b9bf6b', .5, .5, 30.5, 29);
  rect(c, '#b7a674', 3, 7, 26, 20);
  rect(c, '#8c865332', 4, 24, 25, 4);
  rect(c, '#dac18b', 13, 23, 7, 6.5);
  let drawn = false;
  switch (type) {
    case 'hall':
      drawn = sprite(c, 'keep', tier > 1 ? 32 : 0, tier > 2 ? 32 : 0, 32, 32, 2, 0, 28);
      pennant(c, 25, 2, '#437f9d');
      break;
    case 'house':
      drawn = sprite(c, 'house', (tier - 1) * 16, 16, 16, 16, 5, 3, 23);
      break;
    case 'farm':
      rect(c, '#795632', 2, 17, 28, 10);
      sprite(c, 'wheat', 16, 0, 16, 16, 1, 14, 16);
      sprite(c, 'wheat', 16, 0, 16, 16, 15, 14, 16);
      drawn = sprite(c, 'resources', 16, 16, 16, 16, 7, 0, 21);
      break;
    case 'lumber':
      tree(c, 0, 0, 16);
      drawn = sprite(c, 'workshop', 0, 0, 16, 16, 8, 6, 22);
      for (let i = 0; i < 3; i++) {
        rect(c, '#745035', 1, 22 + i * 2, 10, 2);
        rect(c, '#d9ba7a', 1, 22 + i * 2, 2, 2);
      }
      break;
    case 'mine':
      rock(c, 1, 0, 25, 0);
      drawn = sprite(c, 'cave', 0, 16, 16, 16, 4, 6, 25);
      rect(c, '#5c5546', 22, 24, 7, 2); rect(c, '#c9aa56', 23, 21, 5, 3);
      break;
    case 'fishery':
      rect(c, '#409ea9', 1, 14, 30, 14);
      rect(c, '#76c2bd', 3, 24, 24, 1);
      drawn = sprite(c, 'docks', 32, 0, 32, 32, 1, 1, 29);
      break;
    case 'market':
      drawn = sprite(c, 'market', (tier - 1) * 16, 16, 16, 16, 4, 3, 25);
      break;
    case 'school':
      drawn = sprite(c, 'workshop', 16, 16, 16, 16, 4, 3, 25);
      rect(c, '#426a73', 10, 16, 13, 9);
      book(c, 12, 17);
      break;
    case 'clinic':
      drawn = sprite(c, 'chapel', 0, 16, 16, 16, 4, 3, 25);
      rect(c, '#ece7bb', 11, 14, 10, 8);
      rect(c, '#bd5750', 15, 15, 2, 6); rect(c, '#bd5750', 13, 17, 6, 2);
      break;
    case 'barracks':
      drawn = sprite(c, 'barracks', 16, 16, 16, 16, 3, 3, 26);
      pennant(c, 26, 1, '#b65742');
      rect(c, '#475e6b', 1, 20, 5, 6); rect(c, '#8fa3a0', 2, 20, 3, 4);
      break;
  }
  if (!drawn) fallbackHouse(c);
  // Upgrades are visible on the object, without floating labels or extra frames.
  if (tier > 1 && type !== 'hall') {
    for (let i = 0; i < tier - 1; i++) rect(c, '#f1cd6c', 7 + i * 4, 26, 3, 2);
  }
  c.restore();
}

/** Filled pixel objects, drawn in the same palette as the world; no font/emoji dependency. */
export function drawIcon(ctx, key, x, y, size) {
  if (['grass', 'forest', 'water', 'mountain', 'fertile'].includes(key)) return drawTerrain(ctx, key, x, y, size, 7);
  if (['hall', 'house', 'farm', 'lumber', 'mine', 'fishery', 'market', 'school', 'clinic', 'barracks'].includes(key)) return drawBuilding(ctx, key, x, y, size);
  start(ctx, x, y, size);
  const c = ctx;
  // Work at 16 px to keep small HUD glyphs as crisp as the source sprites.
  c.scale(2, 2);
  switch (key) {
    case 'gold':
      rect(c, '#a16d31', 4, 3, 9, 10); rect(c, '#a16d31', 3, 5, 11, 6);
      rect(c, '#e4ac3f', 4, 4, 9, 8); rect(c, '#f8d46c', 5, 3, 6, 9);
      rect(c, '#fff0a0', 5, 4, 2, 5); rect(c, '#b98431', 9, 6, 2, 4);
      break;
    case 'food':
      rect(c, '#846138', 7, 3, 1, 11);
      for (let i = 0; i < 4; i++) {
        rect(c, '#e2ac43', 4, 4 + i * 2, 3, 2); rect(c, '#f2cf6a', 8, 3 + i * 2, 3, 2);
      }
      rect(c, '#f6df8a', 7, 1, 2, 3);
      break;
    case 'wood':
      rect(c, '#745039', 2, 6, 12, 7); rect(c, '#b08048', 3, 5, 10, 5);
      rect(c, '#dcba77', 2, 7, 4, 4); rect(c, '#a97845', 3, 8, 2, 2);
      rect(c, '#d1a162', 7, 6, 6, 1); rect(c, '#8d603c', 7, 10, 6, 1);
      rect(c, '#9b693e', 5, 2, 8, 3); rect(c, '#dfbd7a', 4, 2, 3, 3);
      break;
    case 'population':
      rect(c, '#d6a36b', 6, 2, 5, 5); rect(c, '#6c4d37', 6, 1, 5, 2);
      rect(c, '#487d89', 4, 8, 9, 5); rect(c, '#6da3a4', 5, 8, 6, 2);
      rect(c, '#334e59', 5, 13, 3, 2); rect(c, '#334e59', 10, 13, 2, 2);
      rect(c, '#e1b882', 2, 9, 2, 3); rect(c, '#e1b882', 13, 9, 2, 3);
      break;
    case 'happiness':
      rect(c, '#bb6551', 2, 3, 5, 5); rect(c, '#bb6551', 9, 3, 5, 5);
      rect(c, '#da8968', 3, 2, 3, 4); rect(c, '#da8968', 10, 2, 3, 4);
      rect(c, '#d9775d', 3, 6, 10, 3); rect(c, '#d9775d', 4, 9, 8, 2);
      rect(c, '#d9775d', 6, 11, 4, 2); rect(c, '#d9775d', 7, 13, 2, 1);
      rect(c, '#edaa83', 4, 4, 2, 2);
      break;
    case 'knowledge':
      c.scale(1.3, 1.3); book(c, 2, 3);
      break;
    case 'defense':
      rect(c, '#576f7c', 3, 2, 10, 8); rect(c, '#576f7c', 4, 10, 8, 2);
      rect(c, '#576f7c', 6, 12, 4, 2); rect(c, '#a8b8ad', 4, 3, 8, 6);
      rect(c, '#819b9d', 5, 9, 6, 2); rect(c, '#dcc57d', 7, 3, 2, 9);
      rect(c, '#e9d599', 5, 5, 6, 2);
      break;
    default:
      // Unknown resource keys still have a recognizable material object.
      rect(c, '#997946', 3, 5, 10, 8); rect(c, '#cfad6c', 3, 4, 10, 3);
      rect(c, '#6f5b3d', 5, 5, 1, 8); rect(c, '#6f5b3d', 10, 5, 1, 8);
  }
  c.restore();
}
