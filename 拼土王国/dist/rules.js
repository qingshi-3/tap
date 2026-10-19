// Pure deterministic rules. Coordinates are cells on a 14 × 14 map; a turn is a quarter.
export const MAP_SIZE = 14;
export const TERRAIN = Object.freeze({
  grass: { name: '草地', color: '#a5b96d' },
  forest: { name: '森林', color: '#527b59' },
  water: { name: '水域', color: '#70b8c9' },
  mountain: { name: '山地', color: '#8e929b' },
  fertile: { name: '沃土', color: '#c3a66b' },
});
export const BUILDINGS = Object.freeze({
  hall: { name: '王城', cost: 0, woodCost: 0, terrains: ['grass', 'fertile'], description: '每季金币+16、学识+1，提供8人口容量；不可拆除。', unlock: 1 },
  house: { name: '民居', cost: 24, woodCost: 0, terrains: ['grass', 'fertile'], description: '每级容量+8、金币+2；邻接市场增加税收。', unlock: 1 },
  farm: { name: '农田', cost: 20, woodCost: 0, terrains: ['grass', 'fertile'], description: '每级粮食+10；沃土+3，邻水+4。', unlock: 1 },
  lumber: { name: '伐木场', cost: 26, woodCost: 0, terrains: ['grass', 'forest'], description: '每级木材+4；每块相邻森林再+2。', unlock: 1 },
  mine: { name: '矿场', cost: 40, woodCost: 0, terrains: ['mountain'], description: '每级金币+12；每块相邻山地再+3。', unlock: 2 },
  fishery: { name: '渔场', cost: 28, woodCost: 0, terrains: ['water'], description: '每级粮食+9；不受冬季减产影响。', unlock: 1 },
  market: { name: '集市', cost: 45, woodCost: 0, terrains: ['grass', 'fertile'], description: '每级金币+6；每座相邻民居再+4。', unlock: 2 },
  school: { name: '学堂', cost: 35, woodCost: 0, terrains: ['grass', 'fertile'], description: '每级学识+4；每座相邻民居再+2。', unlock: 1 },
  clinic: { name: '医馆', cost: 55, woodCost: 0, terrains: ['grass', 'fertile'], description: '每级幸福+7，促进人口增长。', unlock: 3 },
  barracks: { name: '兵营', cost: 60, woodCost: 0, terrains: ['grass', 'mountain'], description: '每级防卫+12，减少年度风暴损失。', unlock: 3 },
});
export const LEVELS = Object.freeze({
  1: { name: '村落', population: 8, knowledge: 0 },
  2: { name: '乡镇', population: 12, knowledge: 12 },
  3: { name: '城邦', population: 20, knowledge: 40 },
  4: { name: '公国', population: 32, knowledge: 90 },
  5: { name: '王国', population: 48, knowledge: 180 },
});
export const POLICIES = Object.freeze({
  balanced: { name: '均衡', description: '幸福+4，平稳发展。' },
  growth: { name: '安居', description: '粮食+20%，人口额外增长1；金币−4。' },
  trade: { name: '商贸', description: '金币+8，粮食−3，幸福−6。' },
});
export const SEASONS = Object.freeze([
  { name: '春', description: '春耕：农田产粮+20%。' },
  { name: '夏', description: '盛夏：渔场产粮+3。' },
  { name: '秋', description: '秋收：农田产粮+40%。' },
  { name: '冬', description: '寒冬：农田产粮−30%。' },
]);
const TERRAIN_KEYS = Object.keys(TERRAIN);
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SHAPES = [
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
];
const LAND_NAMES = ['河湾', '林间', '山麓', '田野', '溪岸', '丘陵', '新境'];
const ACHIEVEMENTS = ['first-land', 'first-upgrade', 'level-2', 'level-3', 'level-4', 'level-5', 'population-32', 'territory-40'];
const ok = (extra = {}) => ({ ok: true, reason: '', ...extra });
const fail = reason => ({ ok: false, reason });
const has = (object, key) => typeof key === 'string' && Object.hasOwn(object, key);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const keyOf = (x, y) => `${x},${y}`;
const tileAt = (state, x, y) => state.tiles.find(tile => tile.x === x && tile.y === y);
function record(state, message) { state.log.push(message); state.log = state.log.slice(-24); }
function award(state, key) { if (!state.achievements.includes(key)) state.achievements.push(key); }
function random(state) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}
function initialSeed(seed) {
  if (Number.isSafeInteger(seed)) return seed >>> 0;
  let value = 2166136261;
  for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
function generateOffers(state) {
  return Array.from({ length: 3 }, (_, index) => {
    const shape = SHAPES[Math.floor(random(state) * SHAPES.length)];
    const cells = shape.map(([x, y]) => ({ x, y, terrain: TERRAIN_KEYS[Math.floor(random(state) * TERRAIN_KEYS.length)] }));
    if (cells.every(cell => cell.terrain === cells[0].terrain)) {
      cells[cells.length - 1].terrain = TERRAIN_KEYS[(TERRAIN_KEYS.indexOf(cells[0].terrain) + 1) % TERRAIN_KEYS.length];
    }
    const rotation = Math.floor(random(state) * 4);
    return { id: `${state.turn}-${state.rerolls}-${index}-${state.seed}`, name: LAND_NAMES[Math.floor(random(state) * LAND_NAMES.length)], cost: 18 + cells.length * 6, cells: rotateCells(cells, rotation) };
  });
}
export function createGame(seed = 20261019) {
  const state = {
    version: 1, seed: initialSeed(seed), turn: 1, gold: 150, food: 30, wood: 12,
    population: 8, happiness: 70, knowledge: 0, level: 1, tiles: [], offers: [],
    landBought: false, rerolls: 0, log: [], policy: 'balanced', achievements: [],
  };
  const terrain = [['forest', 'grass', 'water'], ['grass', 'grass', 'fertile'], ['mountain', 'grass', 'forest']];
  for (let y = 5; y <= 7; y++) for (let x = 5; x <= 7; x++) {
    state.tiles.push({ x, y, terrain: terrain[y - 5][x - 5], building: y === 6 ? ({ 5: 'house', 6: 'hall', 7: 'farm' })[x] : null, level: 1 });
  }
  state.offers = generateOffers(state);
  record(state, '王城建立。拼接土地，建设你的国家。');
  return state;
}
export function rotateCells(cells, turns = 1) {
  const count = ((Math.trunc(turns) % 4) + 4) % 4;
  const rotated = cells.map(cell => {
    let { x, y } = cell;
    for (let i = 0; i < count; i++) [x, y] = [-y, x];
    return { ...cell, x, y };
  });
  const minX = Math.min(...rotated.map(cell => cell.x));
  const minY = Math.min(...rotated.map(cell => cell.y));
  return rotated.map(cell => ({ ...cell, x: cell.x - minX, y: cell.y - minY }));
}
export function canPlaceLand(state, offerIndex, x, y, rotation = 0) {
  if (!integer(offerIndex, 0, 2) || !state.offers[offerIndex]) return fail('请选择一块土地。');
  if (!integer(x, 0, MAP_SIZE - 1) || !integer(y, 0, MAP_SIZE - 1) || !Number.isInteger(rotation)) return fail('土地超出国界。');
  if (state.landBought) return fail('本季已买地，下季再来。');
  const offer = state.offers[offerIndex];
  if (state.gold < offer.cost) return fail(`金币不足，需要${offer.cost}。`);
  const cells = rotateCells(offer.cells, rotation).map(cell => ({ ...cell, x: cell.x + x, y: cell.y + y }));
  const occupied = new Set(state.tiles.map(tile => keyOf(tile.x, tile.y)));
  if (cells.some(cell => cell.x >= MAP_SIZE || cell.y >= MAP_SIZE)) return fail('土地超出国界。');
  if (cells.some(cell => occupied.has(keyOf(cell.x, cell.y)))) return fail('土地不能重叠。');
  if (!cells.some(cell => DIRECTIONS.some(([dx, dy]) => occupied.has(keyOf(cell.x + dx, cell.y + dy))))) return fail('新地必须与领土边缘相连。');
  return ok();
}
export function placeLand(state, offerIndex, x, y, rotation = 0) {
  const result = canPlaceLand(state, offerIndex, x, y, rotation);
  if (!result.ok) return result;
  const offer = state.offers[offerIndex];
  const cells = rotateCells(offer.cells, rotation);
  state.gold -= offer.cost;
  state.tiles.push(...cells.map(cell => ({ ...cell, x: cell.x + x, y: cell.y + y, building: null, level: 1 })));
  state.landBought = true;
  award(state, 'first-land');
  if (state.tiles.length >= 40) award(state, 'territory-40');
  record(state, `买下${offer.name}，新增${cells.length}格土地。`);
  return ok({ cost: offer.cost });
}
export function build(state, type, x, y) {
  if (!has(BUILDINGS, type)) return fail('未知建筑。');
  const definition = BUILDINGS[type];
  const tile = tileAt(state, x, y);
  if (!tile) return fail('请先买下这块土地。');
  if (tile.building) return fail('这里已有建筑。');
  if (type === 'hall') return fail('王城只有一座。');
  if (state.level < definition.unlock) return fail(`城镇${definition.unlock}级解锁。`);
  if (!definition.terrains.includes(tile.terrain)) return fail(`${definition.name}不能建在${TERRAIN[tile.terrain].name}上。`);
  if (state.gold < definition.cost) return fail(`金币不足，需要${definition.cost}。`);
  state.gold -= definition.cost;
  tile.building = type;
  tile.level = 1;
  record(state, `建成${definition.name}。`);
  return ok({ cost: definition.cost });
}
export function upgradeCost(tile) {
  if (!tile?.building || !has(BUILDINGS, tile.building) || tile.level >= 3) return null;
  return { gold: (tile.building === 'hall' ? 50 : BUILDINGS[tile.building].cost) * tile.level, wood: 4 * tile.level };
}
export function upgrade(state, x, y) {
  const tile = tileAt(state, x, y);
  if (!tile?.building) return fail('请选择已有建筑。');
  if (tile.level >= 3) return fail('建筑已达最高3级。');
  const cost = upgradeCost(tile);
  if (state.gold < cost.gold || state.wood < cost.wood) return fail(`升级需要${cost.gold}金币、${cost.wood}木材。`);
  state.gold -= cost.gold;
  state.wood -= cost.wood;
  tile.level++;
  award(state, 'first-upgrade');
  record(state, `${BUILDINGS[tile.building].name}升至${tile.level}级。`);
  return ok({ cost });
}
export function demolish(state, x, y) {
  const tile = tileAt(state, x, y);
  if (!tile?.building) return fail('这里没有建筑。');
  if (tile.building === 'hall') return fail('王城不可拆除。');
  const refund = Math.floor(BUILDINGS[tile.building].cost * (1 + (tile.level - 1) * 0.5) * 0.4);
  record(state, `拆除${BUILDINGS[tile.building].name}，回收${refund}金币。`);
  state.gold += refund;
  tile.building = null;
  tile.level = 1;
  return ok({ refund });
}
export function reroll(state) {
  if (state.landBought) return fail('本季已买地，下季再刷新。');
  const cost = 5 * (state.rerolls + 1);
  if (state.gold < cost) return fail(`刷新需要${cost}金币。`);
  state.gold -= cost;
  state.rerolls++;
  state.offers = generateOffers(state);
  return ok({ cost });
}
export function setPolicy(state, key) {
  if (!has(POLICIES, key)) return fail('未知政策。');
  state.policy = key;
  return ok();
}
function neighbors(state, tile) {
  return DIRECTIONS.map(([dx, dy]) => tileAt(state, tile.x + dx, tile.y + dy)).filter(Boolean);
}
function annualEvent(state, defense) {
  if (state.turn % 4 !== 0) return null;
  // The year, not random call order, chooses the event. Forecast never consumes RNG.
  const index = ((Math.imul(Math.floor(state.turn / 4), 2654435761) >>> 0) + state.seed) % 4;
  return [
    { gold: 16, food: 0, happiness: 3, text: '年度商队：金币+16，幸福+3。' },
    { gold: 0, food: 18, happiness: 2, text: '丰年余粮：粮食+18，幸福+2。' },
    { gold: 0, food: 0, happiness: 6, text: '岁末庆典：幸福+6。' },
    { gold: 0, food: -Math.max(0, 10 - Math.floor(defense / 3)), happiness: -2, text: defense >= 30 ? '风暴来袭：守军护住粮仓。' : '风暴来袭：损失部分粮食，兵营可减损。' },
  ][index];
}
// Resource fields are actual next-settlement NET changes after stock floors.
// happiness/population/capacity/defense are ABSOLUTE values at that settlement.
// Capacity is housing; defense prevents annual storm losses. No workers are assigned.
export function forecast(state) {
  let gold = 0, production = 0, wood = 0, knowledge = 0, capacity = 0, defense = 0, upkeep = 0, care = 0;
  const seasonIndex = (state.turn - 1) % 4;
  const effects = [SEASONS[seasonIndex].description];
  for (const tile of state.tiles) {
    if (!tile.building) continue;
    const level = tile.level;
    const adjacent = neighbors(state, tile);
    const terrainCount = terrain => adjacent.filter(other => other.terrain === terrain).length;
    const buildingCount = building => adjacent.filter(other => other.building === building).length;
    const bonus = (amount, text) => { if (amount) effects.push(`${BUILDINGS[tile.building].name}（${tile.x + 1},${tile.y + 1}）：${text}+${amount}。`); return amount; };
    if (tile.building !== 'hall') upkeep += level;
    switch (tile.building) {
      case 'hall': gold += 16 * level; knowledge += level; capacity += 8; defense += 2 * level; break;
      case 'house': capacity += 8 * level; gold += 2 * level + bonus(buildingCount('market') * 2, '邻市金币'); break;
      case 'farm': {
        const base = 10 * level + (tile.terrain === 'fertile' ? 3 : 0) + bonus(terrainCount('water') ? 4 : 0, '邻水粮食');
        production += Math.floor(base * [1.2, 1, 1.4, 0.7][seasonIndex]);
        break;
      }
      case 'lumber': wood += 4 * level + bonus(terrainCount('forest') * 2, '邻林木材'); break;
      case 'mine': gold += 12 * level + bonus(terrainCount('mountain') * 3, '邻山金币'); break;
      case 'fishery': production += 9 * level + (seasonIndex === 1 ? 3 : 0); break;
      case 'market': gold += 6 * level + bonus(buildingCount('house') * 4, '邻居金币'); break;
      case 'school': knowledge += 4 * level + bonus(buildingCount('house') * 2, '邻居学识'); break;
      case 'clinic': care += 7 * level; break;
      case 'barracks': defense += 12 * level; break;
    }
  }
  gold += Math.floor(state.population * 0.75) - upkeep;
  if (state.policy === 'growth') { production = Math.floor(production * 1.2); gold -= 4; }
  if (state.policy === 'trade') { gold += 8; production -= 3; }
  let food = production - Math.ceil(state.population * 0.65);
  effects.push(`居民耗粮${Math.ceil(state.population * 0.65)}，建筑维护${upkeep}金币。`);
  let happiness = 64 + care + (state.policy === 'balanced' ? 4 : 0) - (state.policy === 'trade' ? 6 : 0);
  const event = annualEvent(state, defense);
  if (event) { gold += event.gold; food += event.food; happiness += event.happiness; effects.push(event.text); }
  const shortage = state.food + food < 0;
  if (shortage) { happiness -= 28; effects.push('缺粮：幸福下降，人口停止增长；保留现有人口。'); }
  else if (state.food + food >= state.population * 2) happiness += 6;
  if (state.population >= capacity) happiness -= 5;
  happiness = clamp(Math.round((state.happiness + happiness) / 2), 10, 100);
  let population = state.population;
  if (!shortage && happiness >= 50 && population < capacity) {
    population = Math.min(capacity, population + 1 + (state.policy === 'growth' ? 1 : 0) + (care >= 14 ? 1 : 0));
  }
  // Royal emergency income guarantees recovery even after extravagant construction.
  gold = Math.max(4, gold);
  return {
    gold: Math.min(1e9 - state.gold, gold), food: clamp(food, -state.food, 1e9 - state.food),
    wood: Math.min(1e9 - state.wood, wood), knowledge: Math.min(1e9 - state.knowledge, knowledge),
    happiness, population, capacity, defense, effects,
  };
}
export function nextTurn(state) {
  const result = forecast(state);
  for (const resource of ['gold', 'food', 'wood', 'knowledge']) state[resource] = Math.min(1e9, state[resource] + result[resource]);
  state.happiness = result.happiness;
  state.population = result.population;
  const event = result.effects.find(text => /年度商队|丰年余粮|岁末庆典|风暴来袭/.test(text));
  record(state, `第${state.turn}季结算：金币+${result.gold}，粮食${result.food >= 0 ? '+' : ''}${result.food}，人口${state.population}。`);
  if (event) record(state, event);
  while (state.level < 5) {
    const threshold = LEVELS[state.level + 1];
    if (state.population < threshold.population || state.knowledge < threshold.knowledge) break;
    state.level++;
    award(state, `level-${state.level}`);
    record(state, `城镇升至${state.level}级。`);
  }
  if (state.population >= 32) award(state, 'population-32');
  state.turn++;
  state.landBought = false;
  state.rerolls = 0;
  state.offers = generateOffers(state);
  return ok({ ...result, level: state.level });
}
function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function connected(cells) {
  if (!cells.length) return false;
  const unseen = new Set(cells.map(cell => keyOf(cell.x, cell.y)));
  const queue = [cells[0]];
  unseen.delete(keyOf(cells[0].x, cells[0].y));
  for (let i = 0; i < queue.length; i++) for (const [dx, dy] of DIRECTIONS) {
    const x = queue[i].x + dx, y = queue[i].y + dy;
    if (unseen.delete(keyOf(x, y))) queue.push({ x, y });
  }
  return unseen.size === 0;
}
export function validateSave(raw) {
  let state;
  try { state = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return fail('存档不是有效JSON，原档已保留。'); }
  const fields = ['version', 'seed', 'turn', 'gold', 'food', 'wood', 'population', 'happiness', 'knowledge', 'level', 'tiles', 'offers', 'landBought', 'rerolls', 'log', 'policy', 'achievements'];
  if (!exactKeys(state, fields) || state.version !== 1) return fail('不支持的存档版本或字段，原档已保留。');
  if (!integer(state.seed, 0, 4294967295) || !integer(state.turn, 1, 1e6) || !integer(state.level, 1, 5)
    || !integer(state.population, 1, MAP_SIZE * MAP_SIZE * 24 + 8) || !integer(state.happiness, 0, 100)
    || !['gold', 'food', 'wood', 'knowledge'].every(key => integer(state[key], 0, 1e9))
    || typeof state.landBought !== 'boolean' || !integer(state.rerolls, 0, 1e5) || !has(POLICIES, state.policy)) return fail('存档数值或政策损坏，原档已保留。');
  if (!Array.isArray(state.log) || state.log.length > 24 || !state.log.every(item => typeof item === 'string' && item.length <= 300)
    || !Array.isArray(state.achievements) || state.achievements.length > ACHIEVEMENTS.length
    || new Set(state.achievements).size !== state.achievements.length || !state.achievements.every(item => ACHIEVEMENTS.includes(item))) return fail('存档记录损坏，原档已保留。');
  if (!Array.isArray(state.tiles) || state.tiles.length < 9 || state.tiles.length > MAP_SIZE * MAP_SIZE) return fail('领土数据损坏，原档已保留。');
  const occupied = new Set();
  let halls = 0;
  for (const tile of state.tiles) {
    if (!exactKeys(tile, ['x', 'y', 'terrain', 'building', 'level']) || !integer(tile.x, 0, MAP_SIZE - 1) || !integer(tile.y, 0, MAP_SIZE - 1)
      || !has(TERRAIN, tile.terrain) || !integer(tile.level, 1, 3) || occupied.has(keyOf(tile.x, tile.y))) return fail('领土坐标或地形损坏，原档已保留。');
    occupied.add(keyOf(tile.x, tile.y));
    if (tile.building !== null && (!has(BUILDINGS, tile.building) || !BUILDINGS[tile.building].terrains.includes(tile.terrain)
      || BUILDINGS[tile.building].unlock > state.level)) return fail('建筑类型、地形或等级不合法，原档已保留。');
    if (tile.building === null && tile.level !== 1) return fail('空地等级损坏，原档已保留。');
    if (tile.building === 'hall') halls++;
  }
  // Population may exceed capacity after demolishing housing; it is not discarded.
  if (halls !== 1 || !connected(state.tiles)) return fail('王城或领土连接损坏，原档已保留。');
  if (!Array.isArray(state.offers) || state.offers.length !== 3) return fail('土地报价损坏，原档已保留。');
  const ids = new Set();
  for (const offer of state.offers) {
    if (!exactKeys(offer, ['id', 'name', 'cost', 'cells']) || typeof offer.id !== 'string' || !offer.id.length || offer.id.length > 80
      || ids.has(offer.id) || typeof offer.name !== 'string' || !LAND_NAMES.includes(offer.name)
      || !Array.isArray(offer.cells) || offer.cells.length < 3 || offer.cells.length > 5
      || offer.cost !== 18 + offer.cells.length * 6) return fail('土地报价损坏，原档已保留。');
    ids.add(offer.id);
    const positions = new Set();
    for (const cell of offer.cells) {
      if (!exactKeys(cell, ['x', 'y', 'terrain']) || !integer(cell.x, 0, 4) || !integer(cell.y, 0, 4) || !has(TERRAIN, cell.terrain)
        || positions.has(keyOf(cell.x, cell.y))) return fail('土地形状损坏，原档已保留。');
      positions.add(keyOf(cell.x, cell.y));
    }
    if (!connected(offer.cells) || Math.min(...offer.cells.map(cell => cell.x)) !== 0 || Math.min(...offer.cells.map(cell => cell.y)) !== 0
      || new Set(offer.cells.map(cell => cell.terrain)).size < 2) return fail('土地形状或地形损坏，原档已保留。');
  }
  // Return a detached state; validation never repairs or mutates the original.
  return ok({ state: JSON.parse(JSON.stringify(state)) });
}
