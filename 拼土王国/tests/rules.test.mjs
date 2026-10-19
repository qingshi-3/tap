import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TERRAIN, BUILDINGS, createGame, rotateCells, canPlaceLand, placeLand,
  build, upgrade, demolish, reroll, setPolicy, forecast, nextTurn, validateSave,
} from '../dist/rules.js';

const clone = state => JSON.parse(JSON.stringify(state));
function placement(state) {
  for (let offer = 0; offer < 3; offer++) for (let rotation = 0; rotation < 4; rotation++) {
    for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
      if (canPlaceLand(state, offer, x, y, rotation).ok) return [offer, x, y, rotation];
    }
  }
  return null;
}
function unchangedFailure(state, action) {
  const before = clone(state);
  assert.equal(action().ok, false);
  assert.deepEqual(state, before);
}

test('seed determines offers, mixed terrain and continued simulation without global randomness', () => {
  const a = createGame('river-kingdom'), b = createGame('river-kingdom');
  assert.deepEqual(a, b);
  const terrains = new Set();
  for (let i = 0; i < 30; i++) {
    assert.equal(a.offers.length, 3);
    for (const offer of a.offers) {
      assert.ok(offer.cells.length >= 3 && offer.cells.length <= 5);
      assert.ok(new Set(offer.cells.map(cell => cell.terrain)).size >= 2);
      for (const cell of offer.cells) terrains.add(cell.terrain);
    }
    nextTurn(a); nextTurn(b);
    assert.deepEqual(a, b);
  }
  assert.deepEqual([...terrains].sort(), Object.keys(TERRAIN).sort());
});

test('rotation preserves terrain, normalizes coordinates and returns to original after four turns', () => {
  const cells = [{ x: 0, y: 0, terrain: 'water' }, { x: 1, y: 0, terrain: 'forest' }, { x: 1, y: 1, terrain: 'grass' }];
  const before = clone(cells);
  const rotated = rotateCells(cells, 1);
  assert.deepEqual(rotated, [{ x: 1, y: 0, terrain: 'water' }, { x: 1, y: 1, terrain: 'forest' }, { x: 0, y: 1, terrain: 'grass' }]);
  assert.deepEqual(rotateCells(cells, 4), cells);
  assert.deepEqual(rotateCells(rotateCells(cells, -1), 1), cells);
  assert.deepEqual(cells, before);
});

test('land purchase rejects disconnection, corners, boundaries, overlap and insufficient gold atomically', () => {
  const state = createGame(1);
  state.offers[0].cells = [{ x: 0, y: 0, terrain: 'grass' }, { x: 1, y: 0, terrain: 'water' }, { x: 0, y: 1, terrain: 'forest' }];
  unchangedFailure(state, () => placeLand(state, 0, 0, 0));
  unchangedFailure(state, () => placeLand(state, 0, 3, 3)); // Only diagonal contact at (4,4).
  unchangedFailure(state, () => placeLand(state, 0, 13, 13));
  unchangedFailure(state, () => placeLand(state, 0, 5, 5));
  unchangedFailure(state, () => placeLand(state, 0, 4.5, 5));
  state.gold = 0;
  unchangedFailure(state, () => placeLand(state, 0, 3, 5));
  state.gold = 150;
  const cost = state.offers[0].cost;
  assert.equal(placeLand(state, 0, 3, 5).ok, true);
  assert.equal(state.tiles.length, 12);
  assert.equal(state.gold, 150 - cost);
  assert.equal(state.landBought, true);
  assert.equal(state.offers.length, 3);
  unchangedFailure(state, () => placeLand(state, 0, 1, 5));
  unchangedFailure(state, () => reroll(state));
  nextTurn(state);
  assert.equal(state.landBought, false);
  assert.equal(state.rerolls, 0);
  assert.equal(validateSave(state).ok, true);
});

test('rerolls charge increasing prices, preserve failures and reset each quarter', () => {
  const state = createGame(2);
  const initial = clone(state.offers);
  assert.equal(reroll(state).cost, 5);
  assert.equal(state.gold, 145);
  assert.notDeepEqual(state.offers, initial);
  assert.equal(reroll(state).cost, 10);
  assert.equal(state.gold, 135);
  state.gold = 0;
  unchangedFailure(state, () => reroll(state));
  nextTurn(state);
  assert.equal(state.rerolls, 0);
  assert.equal(reroll(state).cost, 5);
});

test('buildings obey terrain, ownership, unlock and uniqueness; upgrades and demolition charge once', () => {
  const state = createGame(3);
  unchangedFailure(state, () => build(state, 'mine', 5, 7));
  unchangedFailure(state, () => build(state, 'fishery', 6, 5));
  unchangedFailure(state, () => build(state, 'house', 1, 1));
  unchangedFailure(state, () => build(state, 'hall', 6, 5));
  unchangedFailure(state, () => build(state, 'unknown', 6, 5));
  unchangedFailure(state, () => build(state, '__proto__', 6, 5));
  assert.equal(build(state, 'lumber', 5, 5).ok, true);
  unchangedFailure(state, () => build(state, 'lumber', 5, 5));
  assert.equal(build(state, 'fishery', 7, 5).ok, true);
  assert.equal(upgrade(state, 5, 5).ok, true);
  assert.equal(upgrade(state, 5, 5).ok, true);
  unchangedFailure(state, () => upgrade(state, 5, 5));
  unchangedFailure(state, () => demolish(state, 6, 6));
  const before = state.gold;
  const result = demolish(state, 5, 5);
  assert.equal(result.ok, true);
  assert.ok(result.refund > 0);
  assert.equal(state.gold, before + result.refund);
  assert.deepEqual(state.tiles.find(tile => tile.x === 5 && tile.y === 5), { x: 5, y: 5, terrain: 'forest', building: null, level: 1 });
  unchangedFailure(state, () => demolish(state, 5, 5));
});

test('water, forest, mountain and neighboring homes affect the relevant production', () => {
  const state = createGame(4);
  const farm = state.tiles.find(tile => tile.building === 'farm');
  const water = state.tiles.find(tile => tile.terrain === 'water');
  const irrigated = forecast(state).food;
  water.terrain = 'grass';
  assert.ok(forecast(state).food < irrigated);
  water.terrain = 'water';
  state.gold = 1000;
  state.level = 3;
  build(state, 'lumber', 6, 7);
  const timber = forecast(state).wood;
  state.tiles.find(tile => tile.x === 7 && tile.y === 7).terrain = 'grass';
  assert.equal(forecast(state).wood, timber - 2);
  build(state, 'school', 6, 5);
  // Move school adjacent to the initial house on an empty grass cell.
  state.tiles.find(tile => tile.x === 6 && tile.y === 5).building = null;
  const extra = { x: 4, y: 6, terrain: 'grass', building: 'school', level: 1 };
  state.tiles.push(extra);
  const educated = forecast(state).knowledge;
  extra.building = null;
  assert.equal(forecast(state).knowledge, educated - 6);
  extra.building = 'market';
  const marketGold = forecast(state).gold;
  extra.building = null;
  assert.equal(marketGold - forecast(state).gold, 11); // Market 6 + adjacency 4 + house 2 - upkeep 1.
  build(state, 'mine', 5, 7);
  state.tiles.push({ x: 4, y: 7, terrain: 'mountain', building: null, level: 1 });
  const mineGold = forecast(state).gold;
  state.tiles.at(-1).terrain = 'grass';
  assert.equal(mineGold - forecast(state).gold, 3);
  assert.equal(farm.terrain, 'fertile');
});

test('forecast is pure and matches settlement, with seasons, annual events and policy choices', () => {
  const state = createGame(5);
  const spring = forecast(state).food;
  state.turn = 4;
  const winter = forecast(state).food;
  assert.ok(spring > winter);
  assert.ok(forecast(state).effects.some(text => /年度商队|丰年余粮|岁末庆典|风暴来袭/.test(text)));
  const before = clone(state), prediction = forecast(state);
  assert.deepEqual(state, before);
  nextTurn(state);
  for (const field of ['gold', 'food', 'wood', 'knowledge']) assert.equal(state[field], before[field] + prediction[field]);
  assert.equal(state.population, prediction.population);
  assert.equal(state.happiness, prediction.happiness);
  const balanced = forecast(state);
  assert.equal(setPolicy(state, 'trade').ok, true);
  assert.ok(forecast(state).gold > balanced.gold);
  assert.ok(forecast(state).food < balanced.food);
  assert.equal(setPolicy(state, 'growth').ok, true);
  assert.ok(forecast(state).population >= balanced.population);
  unchangedFailure(state, () => setPolicy(state, 'unknown'));
});

test('a kingdom can run for decades and expand through knowledge and housing milestones', () => {
  const state = createGame(6);
  assert.equal(build(state, 'school', 6, 5).ok, true);
  for (let i = 0; i < 12; i++) nextTurn(state);
  assert.equal(state.level, 2);
  assert.ok(state.gold > 150);
  assert.ok(state.food >= 0);
  assert.ok(state.population <= forecast(state).capacity);
  state.gold += 300;
  assert.equal(build(state, 'house', 6, 7).ok, true);
  assert.equal(build(state, 'fishery', 7, 5).ok, true);
  for (let i = 0; i < 20; i++) nextTurn(state);
  assert.equal(state.level, 3);
  assert.ok(state.achievements.includes('level-3'));
  for (let i = 0; i < 80; i++) {
    nextTurn(state);
    assert.equal(validateSave(state).ok, true);
  }
  assert.ok(state.gold > 0);
  assert.ok(state.food > 0);
  assert.ok(state.population >= 20);
});

test('starvation and overbuilding never destroy population or remove the route to recovery', () => {
  const state = createGame(7);
  demolish(state, 7, 6);
  state.food = 0;
  state.gold = 0;
  const population = state.population;
  for (let i = 0; i < 3; i++) nextTurn(state);
  assert.equal(state.population, population);
  assert.ok(state.happiness < 60);
  for (let i = 0; i < 7; i++) nextTurn(state);
  assert.ok(state.population >= population); // Annual grain relief can briefly allow growth.
  assert.ok(state.gold >= BUILDINGS.farm.cost);
  assert.equal(build(state, 'farm', 7, 6).ok, true);
  for (let i = 0; i < 10; i++) nextTurn(state);
  assert.ok(state.food > 0);
  assert.ok(state.population > population);
  assert.ok(state.happiness > 50);
});

test('serialized saves load as detached state and continue buying, building, settling and saving', () => {
  const original = createGame(8);
  build(original, 'school', 6, 5);
  for (let i = 0; i < 10; i++) nextTurn(original);
  const loaded = validateSave(JSON.stringify(original));
  assert.equal(loaded.ok, true);
  assert.notEqual(loaded.state, original);
  const resumed = loaded.state;
  const move = placement(resumed);
  assert.ok(move);
  assert.equal(placeLand(resumed, ...move).ok, true);
  const empty = resumed.tiles.find(tile => !tile.building && BUILDINGS.house.terrains.includes(tile.terrain));
  assert.ok(empty);
  assert.equal(build(resumed, 'house', empty.x, empty.y).ok, true);
  nextTurn(resumed);
  const again = validateSave(JSON.stringify(resumed));
  assert.equal(again.ok, true);
  nextTurn(resumed); nextTurn(again.state);
  assert.deepEqual(again.state, resumed);
  assert.notEqual(original.tiles.length, resumed.tiles.length);
});

test('save validation rejects unknown, disconnected, duplicate, incompatible and corrupt data without repair', () => {
  const valid = createGame(9);
  const corruptions = [
    state => { state.version = 2; },
    state => { state.extra = true; },
    state => { state.gold = -1; },
    state => { state.food = 1.2; },
    state => { state.seed = Infinity; },
    state => { state.policy = 'unknown'; },
    state => { state.tiles[0].x = 14; },
    state => { state.tiles[0] = { ...state.tiles[1] }; },
    state => { state.tiles[0].terrain = 'lava'; },
    state => { state.tiles[0].building = 'fishery'; },
    state => { state.tiles[0].building = '__proto__'; },
    state => { state.tiles[0].level = 3; },
    state => { state.tiles[0].building = 'barracks'; },
    state => { state.tiles.find(tile => tile.building === 'hall').building = null; },
    state => { state.tiles[0].x = 0; state.tiles[0].y = 0; },
    state => { state.offers.pop(); },
    state => { state.offers[0].cost = 1; },
    state => { state.offers[0].cells[0].x = 20; },
    state => { state.offers[0].cells[1] = { ...state.offers[0].cells[0] }; },
    state => { state.offers[0].cells.forEach(cell => { cell.terrain = 'grass'; }); },
    state => { state.achievements.push('made-up'); },
  ];
  for (const corrupt of corruptions) {
    const state = clone(valid);
    corrupt(state);
    const before = structuredClone(state);
    assert.equal(validateSave(state).ok, false);
    assert.deepEqual(state, before);
  }
  assert.equal(validateSave('{broken').ok, false);
  assert.equal(validateSave(null).ok, false);
  assert.equal(validateSave(valid).ok, true);
});
