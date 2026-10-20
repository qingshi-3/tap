// 拼土王国 v3 — pure deterministic rules. One run = 6 years × 4 seasons.
// Every function takes the state as its first argument; failed actions never mutate it.
export const W = 16, H = 16, YEARS = 6, SEASONS_PER_YEAR = 4, HAND_LIMIT = 4;
export const TERRAIN = Object.freeze({
  grass: { name: '草地' }, forest: { name: '森林' }, water: { name: '水域' },
  mountain: { name: '山地' }, fertile: { name: '沃土' },
});
export const SEASONS = Object.freeze([
  { name: '春', tip: '农田正常产粮' },
  { name: '夏', tip: '渔港+2粮；蛮族开始集结' },
  { name: '秋', tip: '农田×1.5；季末蛮族来袭' },
  { name: '冬', tip: '农田×0.5；季末缴纳年贡' },
]);
export const TRIBUTE = Object.freeze([15, 30, 50, 80, 120, 170]);
const FARM_SEASON = [1, 1, 1.5, 0.5];
const LAND = ['grass', 'fertile'];
// cells are the rot=0 footprint. tags drive adjacency; basic = always available.
export const BUILDINGS = Object.freeze({
  hall: { name: '王城', cells: [[0, 0], [1, 0], [0, 1], [1, 1]], gold: 0, wood: 0, workers: 0, terrains: LAND, unlock: 9, text: '金+10，木+2，人口+6，守卫2格。' },
  house: { name: '民居', cells: [[0, 0], [1, 0]], gold: 10, wood: 2, workers: 0, terrains: LAND, basic: true, unlock: 1, text: '人口+4，金+1；挨着集市每座再+1。' },
  farm: { name: '农田', cells: [[0, 0], [1, 0], [2, 0]], gold: 8, wood: 0, workers: 1, terrains: LAND, basic: true, unlock: 1, text: '草地格粮+2、沃土格粮+3，邻水+2。秋×1.5，冬×0.5。' },
  lumber: { name: '伐木场', cells: [[0, 0], [1, 0]], gold: 10, wood: 0, workers: 1, terrains: ['grass', 'forest'], basic: true, unlock: 1, text: '木+2，每块相邻森林+1（最多+5）。' },
  tower: { name: '哨塔', cells: [[0, 0]], gold: 12, wood: 3, workers: 1, terrains: ['grass', 'fertile', 'forest', 'mountain'], basic: true, unlock: 1, text: '守卫周围2格（3级为3格）。' },
  fishery: { name: '渔港', cells: [[0, 0], [1, 0]], gold: 12, wood: 2, workers: 1, terrains: ['grass', 'fertile', 'forest', 'water'], need: { water: 1 }, unlock: 1, text: '须占1格水域。粮+2，占用及相邻水域每格+1（最多+6）；夏+2。' },
  granary: { name: '粮仓', cells: [[0, 0]], gold: 10, wood: 2, workers: 0, terrains: LAND, unlock: 1, text: '粮食上限+25；相邻每片农田粮+1。' },
  market: { name: '集市', cells: [[0, 0], [1, 0], [0, 1]], gold: 18, wood: 4, workers: 1, terrains: LAND, unlock: 1, text: '金+2，每座相邻民居+3，其它相邻建筑+1。' },
  workshop: { name: '工坊', cells: [[0, 0], [1, 0], [1, 1]], gold: 16, wood: 4, workers: 1, terrains: ['grass', 'fertile', 'mountain'], unlock: 1, text: '木材多于6时，每季最多耗木3、每木换金2；挨着伐木场再+2金。' },
  mine: { name: '矿场', cells: [[0, 0], [1, 0], [0, 1], [1, 1]], gold: 22, wood: 5, workers: 2, terrains: ['grass', 'mountain'], need: { mountain: 1 }, unlock: 2, text: '须占山地。金+4，占用山地每格+2，相邻山地每格+1。' },
  temple: { name: '神庙', cells: [[1, 0], [0, 1], [1, 1], [2, 1]], gold: 28, wood: 6, workers: 1, terrains: LAND, unlock: 2, text: '声望+1，每座相邻民居/庄园+1（最多+4）。' },
  barracks: { name: '兵营', cells: [[0, 0], [1, 0], [2, 0], [1, 1]], gold: 26, wood: 8, workers: 2, terrains: ['grass', 'mountain'], unlock: 3, text: '守卫周围3格；守住的进攻声望再+1。' },
  manor: { name: '庄园', cells: [[1, 0], [2, 0], [0, 1], [1, 1]], gold: 26, wood: 8, workers: 0, terrains: LAND, unlock: 3, text: '人口+6，金+2，相邻森林/水域每格金+1（最多+4）。' },
  guild: { name: '商会', cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], gold: 40, wood: 10, workers: 2, terrains: LAND, unlock: 4, text: '金+6，每座相邻集市/工坊/渔港/矿场+3。' },
  wonder: { name: '星塔', cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], gold: 70, wood: 18, workers: 3, terrains: LAND, unlock: 5, text: '奇观。建成声望+10，之后每季声望+4。' },
});
export const BASIC = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].basic);
const SPECIAL = Object.keys(BUILDINGS).filter(k => k !== 'hall' && !BUILDINGS[k].basic);
const GUARD = { hall: 2, tower: 2, barracks: 3 };
const LEVEL_MULT = [1, 1.5, 2];
export const REGION = Object.freeze({
  grass: '草原', forest: '古林', water: '大湖', mountain: '群峰', fertile: '沃野',
});
const REGION_STEPS = [{ size: 6, fame: 2, gold: 6 }, { size: 10, fame: 3, gold: 10 }, { size: 15, fame: 5, gold: 16 }];
const LAND_SHAPES = [
  [[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
  [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
];
const TERRAIN_WEIGHTS = [['grass', 30], ['fertile', 16], ['forest', 21], ['water', 15], ['mountain', 18]];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ok = (extra = {}) => ({ ok: true, reason: '', ...extra });
const fail = reason => ({ ok: false, reason });
const key = (x, y) => `${x},${y}`;
const clone = value => JSON.parse(JSON.stringify(value));

export const yearOf = state => Math.ceil(state.turn / SEASONS_PER_YEAR);
export const seasonOf = state => (state.turn - 1) % SEASONS_PER_YEAR;
export const tributeOf = state => TRIBUTE[yearOf(state) - 1];

function rand(holder) {
  holder.seed = (Math.imul(holder.seed, 1664525) + 1013904223) >>> 0;
  return holder.seed / 4294967296;
}
const pick = (holder, list) => list[Math.floor(rand(holder) * list.length)];
export function hashSeed(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Island mask from the seed: '1' = land that can be bought, '0' = sea. Start area is always land. */
const islandCache = new Map();
export function island(seed) {
  if (islandCache.has(seed)) return islandCache.get(seed);
  const r = { seed: seed ^ 0x9e3779b9 };
  const waves = Array.from({ length: 4 }, (_, i) => ({ k: i + 2, a: 0.35 + rand(r) * 0.75, p: rand(r) * Math.PI * 2 }));
  let mask = '';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - 7.5, dy = y - 7.5, angle = Math.atan2(dy, dx);
    const radius = 6.3 + waves.reduce((sum, w) => sum + w.a * Math.sin(angle * w.k + w.p), 0) * 0.55;
    const inside = Math.hypot(dx, dy) <= radius || (x >= 5 && x <= 10 && y >= 5 && y <= 10);
    mask += inside && x > 0 && y > 0 && x < W - 1 && y < H - 1 ? '1' : '0';
  }
  islandCache.set(seed, mask);
  return mask;
}
export const isIsland = (state, x, y) => x >= 0 && y >= 0 && x < W && y < H && island(state.seed)[y * W + x] === '1';

export function rotateCells(cells, rot = 0) {
  const turns = ((rot % 4) + 4) % 4;
  const turned = cells.map(c => {
    let x = Array.isArray(c) ? c[0] : c.x, y = Array.isArray(c) ? c[1] : c.y;
    for (let i = 0; i < turns; i++) [x, y] = [-y, x];
    return Array.isArray(c) ? { x, y } : { ...c, x, y };
  });
  const minX = Math.min(...turned.map(c => c.x)), minY = Math.min(...turned.map(c => c.y));
  return turned.map(c => ({ ...c, x: c.x - minX, y: c.y - minY }));
}
export const footprint = (type, x, y, rot) => rotateCells(BUILDINGS[type].cells, rot).map(c => ({ x: c.x + x, y: c.y + y }));
export const buildingCells = b => footprint(b.type, b.x, b.y, b.rot);

function index(state) {
  const tiles = new Map(state.tiles.map(t => [key(t.x, t.y), t]));
  const owner = new Map();
  for (const b of state.buildings) for (const c of buildingCells(b)) owner.set(key(c.x, c.y), b);
  return { tiles, owner };
}
export function tileAt(state, x, y) { return state.tiles.find(t => t.x === x && t.y === y) || null; }
export function buildingAt(state, x, y) {
  return state.buildings.find(b => buildingCells(b).some(c => c.x === x && c.y === y)) || null;
}
/** Cells orthogonally touching the footprint from outside, plus the distinct buildings on them. */
function surroundings(state, b, idx) {
  const own = new Set(buildingCells(b).map(c => key(c.x, c.y)));
  const cells = [], seen = new Set(), neighbors = new Map();
  for (const c of buildingCells(b)) for (const [dx, dy] of DIRS) {
    const k = key(c.x + dx, c.y + dy);
    if (own.has(k) || seen.has(k)) continue;
    seen.add(k);
    const tile = idx.tiles.get(k);
    if (tile) cells.push(tile);
    const other = idx.owner.get(k);
    if (other) neighbors.set(other.id, other);
  }
  return { cells, buildings: [...neighbors.values()] };
}
export function adjacentCells(state, type, x, y, rot) {
  const temp = { id: -1, type, x, y, rot };
  const own = new Set(buildingCells(temp).map(c => key(c.x, c.y)));
  const out = new Map();
  for (const c of buildingCells(temp)) for (const [dx, dy] of DIRS) {
    const k = key(c.x + dx, c.y + dy);
    if (!own.has(k)) out.set(k, { x: c.x + dx, y: c.y + dy });
  }
  return [...out.values()];
}

function weightedTerrain(holder) {
  let roll = rand(holder) * TERRAIN_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  for (const [t, w] of TERRAIN_WEIGHTS) if ((roll -= w) < 0) return t;
  return 'grass';
}
const PURE_NAME = { grass: '草原', forest: '密林', water: '湖湾', mountain: '群山', fertile: '沃野' };
const HEAD = { grass: '草', forest: '林', water: '水', mountain: '山', fertile: '田' };
const TAIL = { grass: '原', forest: '林', water: '湾', mountain: '岭', fertile: '野' };
function landName(cells) {
  const n = {}; cells.forEach(c => n[c.t] = (n[c.t] || 0) + 1);
  const [a, b] = Object.entries(n).sort((p, q) => q[1] - p[1]);
  return !b || a[1] / cells.length > 0.6 ? PURE_NAME[a[0]] : HEAD[b[0]] + TAIL[a[0]];
}
function makeLandOffers(state) {
  const year = yearOf(state);
  return [0, 1, 2].map(i => {
    const shape = pick(state, LAND_SHAPES);
    // Terrain clusters: each cell copies an earlier neighbour half the time, so pieces read as patches.
    const cells = [];
    for (const [x, y] of shape) {
      const near = cells.filter(c => Math.abs(c.x - x) + Math.abs(c.y - y) === 1);
      const t = near.length && rand(state) < 0.55 ? pick(state, near).t : weightedTerrain(state);
      cells.push({ x, y, t });
    }
    if (rand(state) < 0.2) cells[Math.floor(rand(state) * cells.length)].treasure = true;
    const rotated = rotateCells(cells, Math.floor(rand(state) * 4));
    return { id: `${state.turn}.${state.landRerolls}.${i}`, name: landName(cells), cost: 3 * cells.length + 2 * year, treasure: 6 + 4 * year, cells: rotated };
  });
}
function makeDraft(state) {
  const year = yearOf(state);
  const pool = SPECIAL.filter(t => BUILDINGS[t].unlock <= year);
  const fresh = SPECIAL.filter(t => BUILDINGS[t].unlock === year && year > 1);
  const out = [];
  // A freshly unlocked building is guaranteed in the first draft of its year.
  if (seasonOf(state) === 0 && fresh.length && !state.draftRerolls) out.push(pick(state, fresh));
  while (out.length < 3 && out.length < pool.length) {
    const t = pick(state, pool);
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export function createGame(seed = Date.now(), mode = 'free') {
  const s = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  const state = {
    version: 3, seed: s, mode, turn: 1, status: 'playing', endReason: '',
    gold: 30, food: 12, wood: 6, fame: 0,
    tiles: [], buildings: [], nextId: 1,
    landOffers: [], landBought: false, landRerolls: 0,
    draft: [], drafted: false, draftRerolls: 0, hand: [],
    threats: [], regions: {}, stats: { defended: 0, plundered: 0, built: 0, lands: 0 },
    log: [], report: null,
  };
  const layout = [
    ['forest', 'forest', 'grass', 'water'],
    ['grass', 'grass', 'grass', 'water'],
    ['grass', 'grass', 'fertile', 'fertile'],
    ['mountain', 'grass', 'fertile', 'grass'],
  ];
  layout.forEach((row, dy) => row.forEach((t, dx) => state.tiles.push({ x: 6 + dx, y: 6 + dy, t })));
  state.buildings.push({ id: state.nextId++, type: 'hall', x: 6, y: 7, rot: 0, level: 1, damaged: false });
  state.buildings.push({ id: state.nextId++, type: 'house', x: 8, y: 7, rot: 1, level: 1, damaged: false });
  state.buildings.push({ id: state.nextId++, type: 'farm', x: 7, y: 9, rot: 0, level: 1, damaged: false });
  state.landOffers = makeLandOffers(state);
  state.draft = makeDraft(state);
  log(state, '王城落成。六年内每个冬天都要缴纳年贡。');
  return state;
}
function log(state, text) { state.log.push(text); state.log = state.log.slice(-30); }

// ---------- economy ----------
/** Population and worker assignment. Older buildings are staffed first; unstaffed ones idle. */
function staffing(state) {
  let population = 0;
  for (const b of state.buildings) {
    if (b.damaged) continue;
    const m = LEVEL_MULT[b.level - 1];
    if (b.type === 'hall') population += 6;
    if (b.type === 'house') population += Math.floor(4 * m);
    if (b.type === 'manor') population += Math.floor(6 * m);
  }
  let left = population;
  const idle = new Set();
  for (const b of [...state.buildings].sort((a, z) => a.id - z.id)) {
    const need = BUILDINGS[b.type].workers;
    if (!need || b.damaged) continue;
    if (left >= need) left -= need; else idle.add(b.id);
  }
  return { population, free: left, idle };
}
export function workers(state) { const s = staffing(state); return { population: s.population, free: s.free, used: s.population - s.free }; }
export function foodCap(state) {
  return 30 + state.buildings.filter(b => b.type === 'granary' && !b.damaged).reduce((s, b) => s + Math.floor(25 * LEVEL_MULT[b.level - 1]), 0);
}

/** Next settlement without mutation. Per-building numbers feed the UI floaters and previews. */
export function forecast(state) {
  const idx = index(state), season = seasonOf(state), { population, idle } = staffing(state);
  const per = [];
  let gold = Math.floor(population / 2), food = 0, wood = 0, fame = 0, woodUse = 0;
  let woodStock = state.wood;
  // Producers of wood settle before the workshop converts it.
  const order = [...state.buildings].sort((a, z) => (a.type === 'workshop') - (z.type === 'workshop') || a.id - z.id);
  for (const b of order) {
    const out = { id: b.id, gold: 0, food: 0, wood: 0, fame: 0, idle: idle.has(b.id), damaged: b.damaged };
    per.push(out);
    if (b.damaged || idle.has(b.id)) continue;
    const m = LEVEL_MULT[b.level - 1], around = surroundings(state, b, idx);
    const own = buildingCells(b).map(c => idx.tiles.get(key(c.x, c.y)));
    const near = t => around.cells.filter(c => c.t === t).length;
    const nearB = (...types) => around.buildings.filter(o => types.includes(o.type)).length;
    switch (b.type) {
      case 'hall': out.gold = 10; out.wood = 2; break;
      case 'house': out.gold = 1 + nearB('market'); break;
      case 'farm': {
        const base = own.reduce((s, t) => s + (t.t === 'fertile' ? 3 : 2), 0) + (near('water') ? 2 : 0);
        out.food = Math.floor(base * m * FARM_SEASON[season]) + nearB('granary');
        break;
      }
      case 'lumber': out.wood = Math.floor((2 + Math.min(5, near('forest'))) * m); break;
      case 'fishery': {
        const water = own.filter(t => t.t === 'water').length + near('water');
        out.food = Math.floor((2 + Math.min(6, water)) * m) + (season === 1 ? 2 : 0);
        break;
      }
      case 'granary': break;
      case 'market': {
        const homes = nearB('house'), others = around.buildings.length - homes;
        out.gold = Math.floor((2 + 3 * homes + others) * m);
        break;
      }
      case 'workshop': {
        const available = woodStock + wood;
        const use = Math.min(Math.floor(3 * m), Math.max(0, available - 6));
        out.wood = -use; out.gold = use * 2 + (use && nearB('lumber') ? 2 : 0);
        woodUse += use;
        break;
      }
      case 'mine': {
        const peaks = own.filter(t => t.t === 'mountain').length;
        out.gold = Math.floor((4 + 2 * peaks + near('mountain')) * m);
        break;
      }
      case 'temple': out.fame = Math.floor((1 + Math.min(4, nearB('house', 'manor'))) * m); break;
      case 'manor': out.gold = Math.floor((2 + Math.min(4, near('forest') + near('water'))) * m); break;
      case 'guild': out.gold = Math.floor((6 + 3 * nearB('market', 'workshop', 'fishery', 'mine')) * m); break;
      case 'wonder': out.fame = Math.floor(4 * m); break;
    }
    gold += out.gold; food += out.food; wood += out.wood; fame += out.fame;
  }
  const eat = Math.ceil(population / 2);
  const famine = state.food + food - eat < 0;
  if (famine) gold = Math.floor(gold / 2);
  const foodAfter = Math.min(foodCap(state), Math.max(0, state.food + food - eat));
  return {
    gold, food: foodAfter - state.food, produced: food, eat, wood, woodUse, fame: fame - (famine ? 1 : 0),
    famine, spoiled: Math.max(0, state.food + food - eat - foodCap(state)), population, per,
    tax: Math.floor(population / 2),
  };
}

// ---------- land ----------
export function landCells(state, offerIndex, x, y, rot) {
  const offer = state.landOffers[offerIndex];
  return offer ? rotateCells(offer.cells, rot).map(c => ({ ...c, x: c.x + x, y: c.y + y })) : [];
}
export function canPlaceLand(state, offerIndex, x, y, rot = 0) {
  if (state.status !== 'playing') return fail('本局已结束。');
  const offer = state.landOffers[offerIndex];
  if (!offer) return fail('请选择一块土地。');
  if (state.landBought) return fail('本季已经买过地。');
  if (!Number.isInteger(x) || !Number.isInteger(y)) return fail('位置无效。');
  const cells = landCells(state, offerIndex, x, y, rot);
  const owned = new Set(state.tiles.map(t => key(t.x, t.y)));
  if (cells.some(c => !isIsland(state, c.x, c.y))) return fail('不能拼到海里。');
  if (cells.some(c => owned.has(key(c.x, c.y)))) return fail('和已有领土重叠。');
  if (!cells.some(c => DIRS.some(([dx, dy]) => owned.has(key(c.x + dx, c.y + dy))))) return fail('要和领土边缘相连。');
  if (state.gold < offer.cost) return fail(`金币不足，需要${offer.cost}。`);
  return ok({ cells });
}
function largestRegion(state, terrain) {
  const cells = new Set(state.tiles.filter(t => t.t === terrain).map(t => key(t.x, t.y)));
  let best = 0;
  while (cells.size) {
    const [first] = cells; cells.delete(first);
    const queue = [first.split(',').map(Number)];
    let size = 0;
    while (queue.length) {
      const [x, y] = queue.pop(); size++;
      for (const [dx, dy] of DIRS) if (cells.delete(key(x + dx, y + dy))) queue.push([x + dx, y + dy]);
    }
    best = Math.max(best, size);
  }
  return best;
}
export function regionProgress(state) {
  return Object.keys(TERRAIN).map(t => {
    const size = largestRegion(state, t), step = state.regions[t] || 0, next = REGION_STEPS[step];
    return { terrain: t, name: REGION[t], size, step, next: next ? next.size : null };
  });
}
function claimRegions(state) {
  const gained = [];
  for (const t of Object.keys(TERRAIN)) {
    const size = largestRegion(state, t);
    while ((state.regions[t] || 0) < REGION_STEPS.length && size >= REGION_STEPS[state.regions[t] || 0].size) {
      const step = REGION_STEPS[state.regions[t] || 0];
      state.regions[t] = (state.regions[t] || 0) + 1;
      state.fame += step.fame; state.gold += step.gold;
      gained.push({ terrain: t, name: REGION[t], size: step.size, fame: step.fame, gold: step.gold });
      log(state, `${REGION[t]}连成${step.size}格：声望+${step.fame}，金+${step.gold}。`);
    }
  }
  return gained;
}
export function placeLand(state, offerIndex, x, y, rot = 0) {
  const check = canPlaceLand(state, offerIndex, x, y, rot);
  if (!check.ok) return check;
  const offer = state.landOffers[offerIndex];
  state.gold -= offer.cost;
  let treasure = 0;
  for (const c of check.cells) {
    state.tiles.push({ x: c.x, y: c.y, t: c.t });
    if (c.treasure) treasure += offer.treasure;
  }
  state.gold += treasure;
  state.landBought = true;
  state.stats.lands++;
  log(state, `拼入${offer.name}，领土+${check.cells.length}格${treasure ? `，挖到宝箱金+${treasure}` : ''}。`);
  return ok({ cost: offer.cost, treasure, regions: claimRegions(state), cells: check.cells });
}
export function rerollLand(state) {
  if (state.status !== 'playing') return fail('本局已结束。');
  if (state.landBought) return fail('本季已经买过地。');
  const cost = 3 + 3 * state.landRerolls;
  if (state.gold < cost) return fail(`刷新需要${cost}金。`);
  state.gold -= cost; state.landRerolls++;
  state.landOffers = makeLandOffers(state);
  return ok({ cost });
}
export const landRerollCost = state => 3 + 3 * state.landRerolls;

// ---------- buildings ----------
export function canBuild(state, type, x, y, rot = 0, { from = 'auto' } = {}) {
  if (state.status !== 'playing') return fail('本局已结束。');
  const def = BUILDINGS[type];
  if (!def || type === 'hall') return fail('未知建筑。');
  if (!def.basic && !state.hand.includes(type)) return fail('背包里没有这张建筑卡。');
  if (!Number.isInteger(x) || !Number.isInteger(y)) return fail('位置无效。');
  const idx = index(state), cells = footprint(type, x, y, rot);
  const tiles = cells.map(c => idx.tiles.get(key(c.x, c.y)));
  if (tiles.some(t => !t)) return fail('要建在自己的领土上。');
  if (cells.some(c => idx.owner.has(key(c.x, c.y)))) return fail('和其它建筑重叠。');
  const bad = tiles.find(t => !def.terrains.includes(t.t));
  if (bad) return fail(`${def.name}不能压在${TERRAIN[bad.t].name}上。`);
  for (const [t, n] of Object.entries(def.need || {})) {
    if (tiles.filter(tile => tile.t === t).length < n) return fail(`${def.name}至少要占${n}格${TERRAIN[t].name}。`);
  }
  if (type === 'fishery' && tiles.every(t => t.t === 'water')) return fail('渔港要有一格靠岸。');
  if (state.gold < def.gold) return fail(`金币不足，需要${def.gold}。`);
  if (state.wood < def.wood) return fail(`木材不足，需要${def.wood}。`);
  if (def.workers > staffing(state).free) return fail(`空闲人口不足，需要${def.workers}人。先建民居。`);
  return ok({ cells });
}
export function build(state, type, x, y, rot = 0) {
  const check = canBuild(state, type, x, y, rot);
  if (!check.ok) return check;
  const def = BUILDINGS[type];
  state.gold -= def.gold; state.wood -= def.wood;
  if (!def.basic) state.hand.splice(state.hand.indexOf(type), 1);
  const b = { id: state.nextId++, type, x, y, rot: ((rot % 4) + 4) % 4, level: 1, damaged: false };
  state.buildings.push(b);
  state.stats.built++;
  if (type === 'wonder') state.fame += 10;
  log(state, `建成${def.name}。`);
  return ok({ id: b.id, cost: def.gold });
}
/** Forecast difference if the building were placed now. Used for the drag preview. */
export function previewBuild(state, type, x, y, rot = 0) {
  const check = canBuild(state, type, x, y, rot);
  const before = forecast(state);
  const temp = clone(state);
  temp.gold = 1e9; temp.wood = 1e9;
  if (!BUILDINGS[type].basic && !temp.hand.includes(type)) temp.hand.push(type);
  const placed = canBuild(temp, type, x, y, rot);
  if (!placed.ok) return { ...check, delta: null };
  temp.gold = state.gold; temp.wood = state.wood;
  temp.buildings.push({ id: temp.nextId++, type, x, y, rot, level: 1, damaged: false });
  const after = forecast(temp);
  const guard = GUARD[type] || 0;
  return {
    ...check,
    delta: {
      gold: after.gold - before.gold, food: after.produced - before.produced, wood: after.wood - before.wood,
      fame: after.fame - before.fame + (type === 'wonder' ? 10 : 0), pop: after.population - before.population, guard,
    },
  };
}
export function upgradeCost(b) {
  if (!b || b.type === 'hall' || b.level >= 3) return null;
  const def = BUILDINGS[b.type];
  return { gold: Math.max(8, def.gold) * b.level, wood: def.wood + 2 * b.level };
}
export function upgrade(state, id) {
  const b = state.buildings.find(o => o.id === id);
  if (!b) return fail('找不到建筑。');
  if (b.damaged) return fail('先修复再升级。');
  const cost = upgradeCost(b);
  if (!cost) return fail(b.type === 'hall' ? '王城不能升级。' : '已是最高3级。');
  if (state.gold < cost.gold || state.wood < cost.wood) return fail(`升级需要${cost.gold}金、${cost.wood}木。`);
  state.gold -= cost.gold; state.wood -= cost.wood; b.level++;
  log(state, `${BUILDINGS[b.type].name}升到${b.level}级。`);
  return ok({ cost });
}
export const repairCost = b => Math.max(5, Math.ceil(BUILDINGS[b.type].gold / 2));
export function repair(state, id) {
  const b = state.buildings.find(o => o.id === id);
  if (!b?.damaged) return fail('这座建筑完好。');
  const cost = repairCost(b);
  if (state.gold < cost) return fail(`修复需要${cost}金。`);
  state.gold -= cost; b.damaged = false;
  log(state, `修复${BUILDINGS[b.type].name}。`);
  return ok({ cost });
}
export function demolish(state, id) {
  const b = state.buildings.find(o => o.id === id);
  if (!b) return fail('找不到建筑。');
  if (b.type === 'hall') return fail('王城不可拆除。');
  const refund = b.damaged ? 0 : Math.floor(BUILDINGS[b.type].gold * 0.4);
  state.buildings.splice(state.buildings.indexOf(b), 1);
  state.gold += refund;
  log(state, `拆除${BUILDINGS[b.type].name}${refund ? `，回收${refund}金` : ''}。`);
  return ok({ refund });
}

// ---------- draft & hand ----------
export function takeDraft(state, i) {
  if (state.status !== 'playing') return fail('本局已结束。');
  if (state.drafted) return fail('本季已经选过建筑卡。');
  const type = state.draft[i];
  if (!type) return fail('请选择一张卡。');
  if (state.hand.length >= HAND_LIMIT) return fail(`背包最多${HAND_LIMIT}张，先建造或丢弃一张。`);
  state.hand.push(type); state.drafted = true;
  return ok({ type });
}
export function skipDraft(state) { if (state.drafted) return fail('本季已经选过。'); state.drafted = true; return ok(); }
export const draftRerollCost = state => 3 + 3 * state.draftRerolls;
export function rerollDraft(state) {
  if (state.drafted) return fail('本季已经选过建筑卡。');
  const cost = draftRerollCost(state);
  if (state.gold < cost) return fail(`刷新需要${cost}金。`);
  state.gold -= cost; state.draftRerolls++;
  state.draft = makeDraft(state);
  return ok({ cost });
}
export function discard(state, handIndex) {
  if (!state.hand[handIndex]) return fail('没有这张卡。');
  const [type] = state.hand.splice(handIndex, 1);
  state.gold += 3;
  return ok({ type, refund: 3 });
}

// ---------- raids ----------
export function borderCells(state) {
  const owned = new Set(state.tiles.map(t => key(t.x, t.y)));
  return state.tiles.filter(t => DIRS.some(([dx, dy]) => !owned.has(key(t.x + dx, t.y + dy))));
}
export function raidSize(state) { return yearOf(state) < 2 ? 0 : yearOf(state) - 1 + Math.floor(borderCells(state).length / 12); }
export const plunderOf = state => 3 + 2 * yearOf(state);
/** Each guard building protects cells within its Chebyshev radius of any footprint cell. */
export function guardMap(state, extra = null) {
  const covered = new Map();
  const list = extra ? [...state.buildings, extra] : state.buildings;
  for (const b of list) {
    let r = GUARD[b.type];
    if (!r || b.damaged) continue;
    if (b.type === 'tower' && b.level >= 3) r = 3;
    for (const c of buildingCells(b)) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const k = key(c.x + dx, c.y + dy);
      if (!covered.has(k)) covered.set(k, []);
      if (!covered.get(k).includes(b.id)) covered.get(k).push(b.id);
    }
  }
  return covered;
}
function markThreats(state) {
  const n = raidSize(state);
  const pool = borderCells(state).map(t => ({ x: t.x, y: t.y }));
  state.threats = [];
  while (state.threats.length < n && pool.length) state.threats.push(pool.splice(Math.floor(rand(state) * pool.length), 1)[0]);
  if (state.threats.length) log(state, `斥候来报：蛮族盯上${state.threats.length}处边境，秋末来袭。`);
}
function resolveRaid(state) {
  const covered = guardMap(state), result = [];
  for (const threat of state.threats) {
    const k = key(threat.x, threat.y), guards = covered.get(k);
    if (guards?.length) {
      const barracks = guards.some(id => state.buildings.find(b => b.id === id)?.type === 'barracks');
      const fame = 1 + (barracks ? 1 : 0);
      state.fame += fame; state.stats.defended++;
      result.push({ ...threat, defended: true, fame });
      continue;
    }
    const loss = Math.min(state.gold, plunderOf(state));
    state.gold -= loss; state.stats.plundered++;
    const b = buildingAt(state, threat.x, threat.y);
    const hit = b && b.type !== 'hall' && !b.damaged ? b : null;
    if (hit) hit.damaged = true;
    result.push({ ...threat, defended: false, loss, damaged: hit ? hit.id : null });
  }
  const held = result.filter(r => r.defended).length;
  if (result.length) log(state, `蛮族来袭：守住${held}处，失守${result.length - held}处。`);
  state.threats = [];
  return result;
}

// ---------- season ----------
export function nextTurn(state) {
  if (state.status !== 'playing') return fail('本局已结束。');
  const season = seasonOf(state), year = yearOf(state);
  const f = forecast(state);
  state.gold += f.gold; state.food += f.food; state.wood += f.wood; state.fame += f.fame;
  const report = { turn: state.turn, year, season, economy: f, raid: null, tribute: null, threats: 0 };
  log(state, `${year}年${SEASONS[season].name}结算：金${f.gold >= 0 ? '+' : ''}${f.gold}，粮${f.food >= 0 ? '+' : ''}${f.food}，木${f.wood >= 0 ? '+' : ''}${f.wood}${f.famine ? '。饥荒！税收减半' : ''}。`);
  if (season === 2 && state.threats.length) report.raid = resolveRaid(state);
  if (season === 3) {
    const due = TRIBUTE[year - 1];
    if (state.gold < due) {
      report.tribute = { due, paid: false };
      state.status = 'lost';
      state.endReason = `第${year}年年贡${due}金交不上，王国陷落。`;
      log(state, state.endReason);
      state.report = report;
      return ok({ report });
    }
    state.gold -= due; state.fame += 2;
    report.tribute = { due, paid: true };
    log(state, `缴纳第${year}年年贡${due}金，声望+2。`);
    if (year === YEARS) {
      state.status = 'won';
      state.endReason = '六年年贡全部交齐，王国屹立。';
      log(state, state.endReason);
      state.report = report;
      return ok({ report });
    }
  }
  state.turn++;
  state.landBought = false; state.landRerolls = 0;
  state.drafted = false; state.draftRerolls = 0;
  state.landOffers = makeLandOffers(state);
  state.draft = makeDraft(state);
  if (seasonOf(state) === 1) { markThreats(state); report.threats = state.threats.length; }
  state.report = report;
  return ok({ report });
}

export function score(state) {
  const buildings = state.buildings.length;
  const parts = [
    { label: '声望', value: state.fame * 10 },
    { label: '金币', value: state.gold },
    { label: '人口', value: workers(state).population * 2 },
    { label: '建筑', value: buildings * 5 },
    { label: '存活', value: state.status === 'won' ? 200 : (yearOf(state) - 1) * 25 },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  const stars = state.status !== 'won' ? 0 : total >= 1100 ? 3 : total >= 750 ? 2 : 1;
  return { parts, total, stars };
}

// ---------- save validation ----------
const isInt = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
export function validateSave(raw) {
  let s;
  try { s = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return fail('存档不是有效 JSON。'); }
  if (!s || typeof s !== 'object' || s.version !== 3) return fail('不支持的存档版本。');
  try {
    if (!isInt(s.seed, 0, 4294967295) || !isInt(s.turn, 1, YEARS * 4) || !['playing', 'won', 'lost'].includes(s.status)) throw 0;
    for (const k of ['gold', 'food', 'wood', 'fame', 'nextId', 'landRerolls', 'draftRerolls']) if (!isInt(s[k], 0, 1e9)) throw 0;
    if (typeof s.landBought !== 'boolean' || typeof s.drafted !== 'boolean' || typeof s.mode !== 'string') throw 0;
    const owned = new Set();
    for (const t of s.tiles) {
      if (!isInt(t.x, 0, W - 1) || !isInt(t.y, 0, H - 1) || !TERRAIN[t.t] || owned.has(key(t.x, t.y)) || !isIsland(s, t.x, t.y)) throw 0;
      owned.add(key(t.x, t.y));
    }
    const used = new Set(), ids = new Set();
    for (const b of s.buildings) {
      if (!BUILDINGS[b.type] || !isInt(b.id, 1, s.nextId - 1) || ids.has(b.id) || !isInt(b.rot, 0, 3) || !isInt(b.level, 1, 3) || typeof b.damaged !== 'boolean') throw 0;
      ids.add(b.id);
      for (const c of buildingCells(b)) {
        if (!owned.has(key(c.x, c.y)) || used.has(key(c.x, c.y))) throw 0;
        used.add(key(c.x, c.y));
      }
    }
    if (s.buildings.filter(b => b.type === 'hall').length !== 1) throw 0;
    if (!Array.isArray(s.hand) || s.hand.length > HAND_LIMIT || s.hand.some(t => !BUILDINGS[t] || BUILDINGS[t].basic || t === 'hall')) throw 0;
    if (!Array.isArray(s.draft) || s.draft.some(t => !SPECIAL.includes(t))) throw 0;
    if (!Array.isArray(s.landOffers) || s.landOffers.length !== 3) throw 0;
    for (const o of s.landOffers) if (!Array.isArray(o.cells) || o.cells.length < 3 || o.cells.length > 5 || !isInt(o.cost, 0, 999) || o.cells.some(c => !TERRAIN[c.t] || !isInt(c.x, 0, 4) || !isInt(c.y, 0, 4))) throw 0;
    if (!Array.isArray(s.threats) || s.threats.some(c => !isInt(c.x, 0, W - 1) || !isInt(c.y, 0, H - 1))) throw 0;
    if (!Array.isArray(s.log) || !s.stats || typeof s.regions !== 'object') throw 0;
  } catch { return fail('存档数据损坏。'); }
  return ok({ state: clone(s) });
}
