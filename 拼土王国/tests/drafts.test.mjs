import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BUILDINGS, createGame, getBuildingOffers, rerollBuildings, build, nextTurn,
  validateSave, reroll,
} from '../dist/rules.js';
import { SAVE_KEY, readSave, writeSave } from '../dist/storage.js';

const frozenV1Text = readFileSync(new URL('./fixtures/save-v1-before-drafts.json', import.meta.url), 'utf8');
const frozenV1 = () => JSON.parse(frozenV1Text);
const copy = state => JSON.parse(JSON.stringify(state));
const combination = types => types.slice().sort().join(',');
const usable = (state, type) => state.tiles.some(tile => !tile.building && BUILDINGS[type].terrains.includes(tile.terrain));
function assertValidDraft(state) {
  const offers = getBuildingOffers(state);
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers).size, 3);
  for (const type of offers) {
    assert.notEqual(type, 'hall');
    assert.ok(Object.hasOwn(BUILDINGS, type));
    assert.ok(BUILDINGS[type].unlock <= state.level);
  }
  return offers;
}

test('building drafts are deterministic, pure and preserved by save/reload rather than free rerolls', () => {
  for (let seed = 0; seed < 25; seed++) {
    const state = createGame(seed), before = copy(state);
    const offers = assertValidDraft(state);
    for (let read = 0; read < 5; read++) assert.deepEqual(getBuildingOffers(state), offers);
    assert.deepEqual(state, before);
    assert.deepEqual(getBuildingOffers(createGame(seed)), offers);
    assert.deepEqual(getBuildingOffers(validateSave(JSON.stringify(state)).state), offers);
    assert.ok(offers.every(type => usable(state, type)));
  }
});

test('drafts prioritize all possible compatible types and fill only the remaining slots with unavailable terrain', () => {
  const state = createGame(31);
  state.level = 3;
  const water = state.tiles.find(tile => tile.terrain === 'water');
  const forest = state.tiles.find(tile => tile.terrain === 'forest');
  // Occupy all empty cells except one forest and the water. Exactly two building
  // types can use these cells; the third card must explain its unavailable terrain.
  for (const tile of state.tiles) if (!tile.building && tile !== water && tile !== forest) {
    tile.building = tile.terrain === 'mountain' ? 'mine' : tile.terrain === 'forest' ? 'lumber' : 'house';
  }
  for (let draw = 0; draw < 12; draw++) {
    state.buildingDraws = draw;
    const offers = assertValidDraft(state);
    assert.ok(offers.includes('fishery'));
    assert.ok(offers.includes('lumber'));
    assert.equal(offers.filter(type => usable(state, type)).length, 2);
  }
  forest.building = 'lumber';
  assert.ok(assertValidDraft(state).includes('fishery'));
  water.building = 'fishery';
  assert.equal(assertValidDraft(state).filter(type => usable(state, type)).length, 0);
  assert.equal(validateSave(state).ok, true);
});

test('paid building rerolls charge increasing prices and change combinations without changing land offers', () => {
  const state = createGame(32);
  state.gold = 10000;
  const land = copy(state.offers), seed = state.seed;
  for (let index = 0; index < 12; index++) {
    const previous = getBuildingOffers(state), gold = state.gold;
    const result = rerollBuildings(state);
    assert.equal(result.ok, true);
    assert.equal(result.cost, 5 * (index + 1));
    assert.equal(state.gold, gold - result.cost);
    assert.equal(state.buildingRerolls, index + 1);
    assert.notEqual(combination(getBuildingOffers(state)), combination(previous));
    assert.deepEqual(state.offers, land);
    assert.equal(state.seed, seed);
    assert.equal(state.rerolls, 0);
    const loaded = validateSave(JSON.stringify(state));
    assert.equal(loaded.ok, true);
    assert.deepEqual(getBuildingOffers(loaded.state), getBuildingOffers(state));
  }
});

test('insufficient building-reroll funds and invalid builds preserve the complete state', () => {
  const state = createGame(33);
  state.gold = 4;
  const before = copy(state);
  assert.equal(rerollBuildings(state).ok, false);
  assert.deepEqual(state, before);
  assert.equal(build(state, 'house', 6, 5).ok, false);
  assert.deepEqual(state, before);
  assert.equal(build(state, 'school', 6, 6).ok, false);
  assert.deepEqual(state, before);
});

test('successful builds advance drafts while allowing repeated construction in the same quarter', () => {
  const state = createGame(34);
  const previous = getBuildingOffers(state), turn = state.turn;
  assert.equal(build(state, 'house', 6, 5).ok, true);
  assert.ok(state.buildingDraws > 0);
  assert.notEqual(combination(getBuildingOffers(state)), combination(previous));
  const draws = state.buildingDraws;
  assert.equal(build(state, 'lumber', 5, 5).ok, true);
  assert.ok(state.buildingDraws > draws);
  assert.equal(state.turn, turn);
  assert.equal(state.buildingRerolls, 0);
  assert.equal(state.landBought, false);
});

test('a new quarter resets both refresh prices and changes the building selection', () => {
  for (let seed = 0; seed < 30; seed++) {
    const state = createGame(seed);
    assert.equal(rerollBuildings(state).cost, 5);
    assert.equal(rerollBuildings(state).cost, 10);
    assert.equal(reroll(state).cost, 5);
    const previous = getBuildingOffers(state), draws = state.buildingDraws;
    nextTurn(state);
    assert.equal(state.buildingRerolls, 0);
    assert.equal(state.rerolls, 0);
    assert.ok(state.buildingDraws > draws);
    assert.notEqual(combination(getBuildingOffers(state)), combination(previous));
    assert.equal(rerollBuildings(state).cost, 5);
  }
});

test('one possible compatible trio still changes its displayed order on refresh and next quarter', () => {
  const state = createGame(35);
  // Fertile soil permits exactly house/farm/school at level 1. Empty mountains
  // add no unlocked type; forest/water buildings occupy their special terrain.
  for (const tile of state.tiles) if (!tile.building) {
    if (tile.terrain === 'grass') tile.terrain = 'fertile';
    if (tile.terrain === 'forest') tile.building = 'lumber';
    if (tile.terrain === 'water') tile.building = 'fishery';
  }
  let previous = getBuildingOffers(state);
  assert.deepEqual(previous.slice().sort(), ['farm', 'house', 'school']);
  assert.equal(rerollBuildings(state).ok, true);
  assert.notDeepEqual(getBuildingOffers(state), previous);
  assert.equal(combination(getBuildingOffers(state)), combination(previous));
  previous = getBuildingOffers(state);
  nextTurn(state);
  assert.notDeepEqual(getBuildingOffers(state), previous);
});

test('frozen genuine v1 migrates only by adding draft fields, then builds, saves, reloads and continues', () => {
  const original = frozenV1();
  assert.equal(original.version, 1);
  const before = copy(original);
  const migrated = validateSave(original);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.state.version, 2);
  assert.equal(migrated.state.buildingRerolls, 0);
  assert.equal(migrated.state.buildingDraws, 0);
  assert.deepEqual(original, before);
  const { buildingRerolls, buildingDraws, ...preserved } = migrated.state;
  assert.deepEqual({ ...preserved, version: 1 }, original);
  const values = new Map([[SAVE_KEY, frozenV1Text]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const loaded = readSave(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.version, 2);
  assert.equal(values.get(SAVE_KEY), frozenV1Text); // Loading is read-only.
  const offers = getBuildingOffers(loaded.state);
  const type = offers.find(type => usable(loaded.state, type));
  const tile = loaded.state.tiles.find(tile => !tile.building && BUILDINGS[type].terrains.includes(tile.terrain));
  assert.equal(build(loaded.state, type, tile.x, tile.y).ok, true);
  assert.equal(writeSave(storage, loaded.state).ok, true);
  assert.equal(JSON.parse(values.get(SAVE_KEY)).version, 2);
  const resumed = readSave(storage);
  assert.equal(resumed.ok, true);
  assert.deepEqual(getBuildingOffers(resumed.state), getBuildingOffers(loaded.state));
  assert.equal(rerollBuildings(resumed.state).ok, true);
  nextTurn(resumed.state);
  assert.equal(writeSave(storage, resumed.state).ok, true);
  const resumedAgain = readSave(storage);
  assert.equal(resumedAgain.ok, true);
  nextTurn(resumedAgain.state);
  assert.equal(writeSave(storage, resumedAgain.state).ok, true);
  assert.equal(readSave(storage).state.turn, original.turn + 2);
});

test('legacy corruption cannot be repaired or admitted by migration; v2 draft counters are strict', () => {
  const corruptions = [
    state => { state.gold = -1; },
    state => { state.food = 1.5; },
    state => { state.seed = Infinity; },
    state => { state.turn = 0; },
    state => { state.happiness = 101; },
    state => { state.level = 6; },
    state => { state.policy = 'unknown'; },
    state => { state.tiles[0] = { ...state.tiles[1] }; },
    state => { state.tiles[0].terrain = 'lava'; },
    state => { state.tiles[0].building = 'fishery'; },
    state => { state.tiles[0].building = 'barracks'; },
    state => { state.tiles[0].x = 0; state.tiles[0].y = 0; },
    state => { state.tiles.find(tile => tile.building === 'hall').building = null; },
    state => { state.offers[0].cost = 1; },
    state => { state.offers[0].cells[1] = { ...state.offers[0].cells[0] }; },
    state => { state.offers[0].cells.forEach(cell => { cell.terrain = 'grass'; }); },
    state => { state.achievements.push('unknown'); },
    state => { state.log.push(null); },
    state => { state.extra = true; },
    state => { state.buildingDraws = 0; }, // v1 must reject unexpected v2 fields.
    state => { state.version = 2; }, // A version change cannot omit new fields.
    state => { state.version = 99; },
  ];
  for (const corrupt of corruptions) {
    const state = frozenV1();
    corrupt(state);
    const before = structuredClone(state);
    assert.equal(validateSave(state).ok, false);
    assert.deepEqual(state, before);
  }
  for (const field of ['buildingDraws', 'buildingRerolls']) {
    for (const value of [-1, 0.5, Infinity, NaN, '0', null, Number.MAX_SAFE_INTEGER + 1]) {
      const state = createGame(36);
      state[field] = value;
      assert.equal(validateSave(state).ok, false);
    }
    const missing = createGame(36);
    delete missing[field];
    assert.equal(validateSave(missing).ok, false);
  }
});
