import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../dist/rules.js';

const fresh = (seed = 7) => R.createGame(seed);
const snapshot = s => JSON.stringify(s);

test('new game: 4x4 territory, hall/house/farm, valid save', () => {
  const s = fresh();
  assert.equal(s.tiles.length, 16);
  assert.deepEqual(s.buildings.map(b => b.type), ['hall', 'house', 'farm']);
  assert.equal(s.landOffers.length, 3);
  assert.equal(s.draft.length, 3);
  assert.ok(R.validateSave(JSON.stringify(s)).ok);
});

test('same seed gives the same game; string seeds hash deterministically', () => {
  assert.equal(snapshot(R.createGame('daily-2026-10-20')), snapshot(R.createGame('daily-2026-10-20')));
  const a = fresh(1), b = fresh(1);
  R.nextTurn(a); R.nextTurn(b);
  assert.equal(snapshot(a), snapshot(b));
});

test('rotation keeps shape size and normalises to origin', () => {
  for (const type of Object.keys(R.BUILDINGS)) for (let rot = 0; rot < 4; rot++) {
    const cells = R.rotateCells(R.BUILDINGS[type].cells, rot);
    assert.equal(cells.length, R.BUILDINGS[type].cells.length);
    assert.equal(Math.min(...cells.map(c => c.x)), 0);
    assert.equal(Math.min(...cells.map(c => c.y)), 0);
  }
});

test('failed actions never mutate state', () => {
  const s = fresh();
  const before = snapshot(s);
  assert.equal(R.build(s, 'house', 0, 0).ok, false);              // outside territory
  assert.equal(R.build(s, 'house', 6, 7).ok, false);              // overlaps hall
  assert.equal(R.build(s, 'market', 6, 6).ok, false);             // not in hand
  assert.equal(R.placeLand(s, 0, 0, 0).ok, false);                // not adjacent / sea
  assert.equal(R.upgrade(s, s.buildings[0].id).ok, false);        // hall
  assert.equal(R.demolish(s, s.buildings[0].id).ok, false);
  assert.equal(R.repair(s, s.buildings[1].id).ok, false);
  assert.equal(snapshot(s), before);
});

test('buildings respect terrain and requirements', () => {
  const s = fresh();
  s.gold = 999; s.wood = 99;
  // (6,6),(7,6) are forest: lumber allowed, farm on forest not (farm needs land types incl forest? check text)
  assert.equal(R.canBuild(s, 'lumber', 6, 6, 0).ok, true);
  s.hand.push('fishery');
  // fishery must touch water and not be all water: (8,6) grass + (9,6) water
  assert.equal(R.canBuild(s, 'fishery', 8, 6, 0).ok, true);
  assert.equal(R.canBuild(s, 'fishery', 9, 6, 1).ok, false);      // both water
});

test('placing land joins territory, costs gold, once per season', () => {
  const s = fresh();
  s.gold = 200;
  let spot = null;
  for (let rot = 0; rot < 4 && !spot; rot++) for (let y = 0; y < R.H && !spot; y++) for (let x = 0; x < R.W && !spot; x++)
    if (R.canPlaceLand(s, 0, x, y, rot).ok) spot = { x, y, rot };
  assert.ok(spot);
  const cost = s.landOffers[0].cost, n = s.landOffers[0].cells.length;
  const r = R.placeLand(s, 0, spot.x, spot.y, spot.rot);
  assert.ok(r.ok);
  assert.equal(s.tiles.length, 16 + n);
  assert.equal(s.gold, 200 - cost + r.treasure + r.regions.reduce((a, g) => a + g.gold, 0));
  assert.equal(R.canPlaceLand(s, 1, spot.x, spot.y, spot.rot).ok, false);
});

test('hand: draft adds card, limit enforced, discard refunds', () => {
  const s = fresh();
  const t = s.draft[0];
  assert.ok(R.takeDraft(s, 0).ok);
  assert.deepEqual(s.hand, [t]);
  assert.equal(R.takeDraft(s, 1).ok, false);
  const g = s.gold;
  assert.ok(R.discard(s, 0).ok);
  assert.equal(s.gold, g + 3);
  s.hand = ['market', 'market', 'market', 'market'];
  s.drafted = false;
  assert.equal(R.takeDraft(s, 0).ok, false);
});

test('forecast predicts nextTurn exactly', () => {
  const s = fresh(3);
  const f = R.forecast(s), g = s.gold, food = s.food, wood = s.wood;
  R.nextTurn(s);
  assert.equal(s.gold, g + f.gold);
  assert.equal(s.food, food + f.food);
  assert.equal(s.wood, wood + f.wood);
});

test('adjacency: market next to houses earns more', () => {
  const s = fresh();
  s.gold = 999; s.wood = 99; s.hand = ['market'];
  for (let y = 5; y <= 10; y++) for (const x of [10, 11]) if (R.isIsland(s, x, y)) s.tiles.push({ x, y, t: 'grass' });
  // House sits at (8,7)-(8,8); the market's best legal spot must use that neighbour.
  let best = -1, far = Infinity;
  for (const t of s.tiles) for (let rot = 0; rot < 4; rot++) {
    const p = R.previewBuild(s, 'market', t.x, t.y, rot);
    if (!p.ok) continue;
    const touchesHouse = R.adjacentCells(s, 'market', t.x, t.y, rot).some(c => R.buildingAt(s, c.x, c.y)?.type === 'house');
    if (touchesHouse) best = Math.max(best, p.delta.gold); else far = Math.min(far, p.delta.gold);
  }
  assert.ok(best >= far + 3, `${best} vs ${far}`);
});

test('unstaffed buildings go idle', () => {
  const s = fresh();
  s.gold = 999; s.wood = 99;
  s.buildings = s.buildings.filter(b => b.type === 'hall');      // pop 6
  s.hand = ['mine'];
  for (let i = 0; i < 7; i++) s.buildings.push({ id: s.nextId++, type: 'tower', x: 6 + (i % 4), y: i < 4 ? 6 : 9, rot: 0, level: 1, damaged: false });
  const f = R.forecast(s);
  assert.equal(f.per.filter(p => p.idle).length, 1);
});

test('tribute: unpaid ends the run, paying all six wins', () => {
  const s = fresh();
  for (let i = 0; i < 3; i++) R.nextTurn(s);
  s.gold = 0; s.buildings = s.buildings.filter(b => b.type !== 'hall');
  s.buildings = [];
  R.nextTurn(s);
  assert.equal(s.status, 'lost');
  assert.equal(R.nextTurn(s).ok, false);

  const w = fresh();
  while (w.status === 'playing') { w.gold = 10000; w.threats = []; R.nextTurn(w); }
  assert.equal(w.status, 'won');
  assert.equal(R.yearOf(w), R.YEARS);
  assert.ok(R.score(w).stars >= 1);
});

test('raids: threats appear in year-2 summer and unguarded ones plunder', () => {
  const s = fresh(11);
  s.gold = 5000;
  while (!(R.yearOf(s) === 2 && R.seasonOf(s) === 1)) R.nextTurn(s);
  assert.ok(s.threats.length >= 1);
  const guard = R.guardMap(s);
  const open = s.threats.filter(t => !guard.has(`${t.x},${t.y}`)).length;
  const before = s.stats.plundered;
  R.nextTurn(s); // summer -> autumn
  const r = R.nextTurn(s).report; // autumn end resolves raid
  assert.ok(r.raid);
  assert.equal(r.raid.filter(x => !x.defended).length, open);
  assert.equal(s.threats.length, 0);
  assert.ok(s.stats.plundered >= before);
});

test('validateSave rejects corrupt data', () => {
  assert.equal(R.validateSave('{').ok, false);
  assert.equal(R.validateSave(JSON.stringify({ version: 2 })).ok, false);
  const s = fresh();
  s.buildings.push({ ...s.buildings[1], id: 99 });   // overlapping copy
  s.nextId = 100;
  assert.equal(R.validateSave(JSON.stringify(s)).ok, false);
});
