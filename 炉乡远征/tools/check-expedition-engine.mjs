import assert from 'node:assert/strict';
import {
  autoAct, boardOf, castSpell, createExpeditionMatch, endTurn, findGeneral, movementPath, movementPositions,
  objectiveText, occupiedUnit, playCard, restoreMatch, startBotTurn, terrainAt, useBattleCommand, validateMatch
} from '../dist/js/engine.js';
import { DEPLOYMENT_BUDGET, EXPEDITION_LEVELS, deploymentCost, trainingBonus } from '../dist/js/expedition-data.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

for (const level of EXPEDITION_LEVELS) {
  const state = createExpeditionMatch(level.id);
  assert.equal(validateMatch(state), true, `${level.id} must create a valid snapshot`);
  assert.deepEqual(boardOf(state), { columns: level.columns, rows: level.rows, tiles: level.tiles });
  assert.equal(objectiveText(state).length > 0, true);
  assert.equal(restoreMatch(clone(state))?.levelId, level.id);
}

const trained = createExpeditionMatch('border-01', { 9: 4 }, [14, 9, 11]);
const trainedWindblade = trained.units.find((unit) => unit.owner === 0 && unit.cardId === 9);
assert.equal(trainedWindblade.attack, 2 + trainingBonus(9, 4).attack);
assert.equal(trainedWindblade.maxHealth, 3 + trainingBonus(9, 4).health);
trained.training[9] = 0;
assert.equal(trainedWindblade.attack, 4, 'battle stats are snapshots and do not follow later training changes');

assert.equal(deploymentCost([14, 9, 17]), 3);
assert.equal(DEPLOYMENT_BUDGET, 4);
assert.throws(() => createExpeditionMatch('border-01', {}, [17, 16, 15]), /\u603b\u8d39\u7528\u4e0d\u80fd\u8d85\u8fc7 4/);
const reserveHeavy = createExpeditionMatch('border-01', { 17: 4 }, [14, 9, 17]);
assert.equal(reserveHeavy.units.some((unit) => unit.owner === 0 && unit.cardId === 17), false, 'third squad slot starts in the deck rather than deploying for free');
reserveHeavy.players[0].hand = [17];
reserveHeavy.players[0].mana = 5;
const heavySpot = { x: reserveHeavy.units[0].x, y: reserveHeavy.units[0].y - 1 };
assert.equal(playCard(reserveHeavy, 0, heavySpot.x, heavySpot.y), true);
assert.equal(reserveHeavy.players[0].mana, 0, 'reserve unit pays its normal summon cost');
assert.equal(occupiedUnit(reserveHeavy, heavySpot.x, heavySpot.y).maxHealth, 10 + trainingBonus(17, 4).health);
const legacyOverBudgetBattle = clone(createExpeditionMatch('border-01'));
legacyOverBudgetBattle.squad = [17, 16, 15];
assert.equal(validateMatch(legacyOverBudgetBattle), true, 'existing over-budget battle snapshots remain loadable');
assert.equal(restoreMatch(legacyOverBudgetBattle)?.squad[0], 17);

const road = createExpeditionMatch('road-02');
const walker = road.units.find((unit) => unit.owner === 0 && unit.cardId !== 1);
road.units = road.units.filter((unit) => unit.owner === 0);
walker.x = 3; walker.y = 2; walker.moved = false; walker.summonedThisTurn = false;
assert.deepEqual(movementPath(road, walker, 4, 2).map(({ x, y }) => [x, y]), [[3, 2], [4, 2]], 'rough tile costs both movement points');
const wallMap = createExpeditionMatch('road-01');
const wallWalker = wallMap.units.find((unit) => unit.owner === 0 && unit.cardId !== 1);
wallMap.units = wallMap.units.filter((unit) => unit.owner === 0);
wallWalker.x = 4; wallWalker.y = 0; wallWalker.moved = false; wallWalker.summonedThisTurn = false;
assert.equal(movementPositions(wallMap, wallWalker).some((pos) => pos.x === 5 && pos.y === 0), false);
assert.equal(terrainAt(wallMap, 5, 0), 'wall');

const outpost = createExpeditionMatch('border-01');
const post = outpost.board.tiles.find((tile) => tile.type === 'outpost');
const occupier = outpost.units.find((unit) => unit.owner === 0 && unit.cardId !== 1);
outpost.units = outpost.units.filter((unit) => unit.x !== post.x || unit.y !== post.y);
occupier.x = post.x; occupier.y = post.y;
outpost.players[0].maxMana = 4;
endTurn(outpost, 0);
while (outpost.phase !== 'over' && outpost.currentPlayer !== 0) endTurn(outpost, outpost.currentPlayer, true);
assert.equal(outpost.players[0].mana, 6, 'normal growth plus captured outpost mana applies at turn start');

const tri = createExpeditionMatch('banners-01');
assert.equal(tri.players.length, 3);
assert.equal(tri.players[2].generalId, 1, 'each faction derives its command from its actual general');
const thirdGeneral = findGeneral(tri, 2);
const thirdUnit = tri.units.find((unit) => unit.owner === 2 && unit.cardId !== thirdGeneral.cardId);
thirdUnit.x = thirdGeneral.x - 1; thirdUnit.y = thirdGeneral.y;
tri.currentPlayer = 2; tri.phase = 'ai'; tri.players[2].mana = 1;
assert.equal(useBattleCommand(tri, thirdUnit.unitId, 2), true);
assert.equal(thirdUnit.attackBuff, 2, 'third faction Aegnor uses Lion Roar instead of Ziran healing');
tri.currentPlayer = 0; tri.phase = 'playing';
endTurn(tri, 0); assert.equal(tri.currentPlayer, 1);
endTurn(tri, 1); assert.equal(tri.currentPlayer, 2);
endTurn(tri, 2); assert.equal(tri.currentPlayer, 0);

const survive = createExpeditionMatch('border-03');
survive.round = survive.objective.rounds;
endTurn(survive, 0);
endTurn(survive, 1);
assert.equal(survive.result, 'win');
assert.equal(survive.resultReason, 'survived');

const malformed = clone(createExpeditionMatch('border-01'));
malformed.units[0].x = malformed.board.columns;
assert.equal(validateMatch(malformed), false);
const wallUnit = clone(createExpeditionMatch('road-01'));
wallUnit.units[0].x = 5; wallUnit.units[0].y = 0;
assert.equal(validateMatch(wallUnit), false);
for (const corrupt of [null, [], { schemaVersion: 3 }, { schemaVersion: 3, mode: 'expedition', players: [null] }]) {
  assert.doesNotThrow(() => validateMatch(corrupt));
  assert.equal(validateMatch(corrupt), false);
}
for (const mutate of [
  (state) => { state.players[0] = null; },
  (state) => { state.units[0] = null; },
  (state) => { state.board.tiles[0] = null; },
  (state) => { state.players.reverse(); },
  (state) => { state.units[0].x = 1.5; },
  (state) => { state.units[0].moved = 'false'; },
  (state) => { state.winner = 0; },
  (state) => { state.runId = null; }
]) {
  const state = clone(createExpeditionMatch('border-01'));
  mutate(state);
  assert.doesNotThrow(() => validateMatch(state));
  assert.equal(validateMatch(state), false);
}

const summon = createExpeditionMatch('border-01', { 14: 4 });
summon.players[0].hand = [14];
const index = summon.players[0].hand.indexOf(14);
const spot = { x: summon.units[0].x, y: summon.units[0].y - 1 };
assert.equal(playCard(summon, index, spot.x, spot.y), true);
const summoned = occupiedUnit(summon, spot.x, spot.y);
assert.equal(summoned.maxHealth, 4 + trainingBonus(14, 4).health);

const cancellable = createExpeditionMatch('border-01');
endTurn(cancellable, 0);
let notifications = 0;
await startBotTurn(cancellable, async (beforeUnits, action) => {
  assert.equal(Array.isArray(beforeUnits), true);
  assert.equal(typeof action.kind, 'string');
  await Promise.resolve();
  notifications += 1;
}, { delayMs: 0, isCancelled: () => notifications >= 1 });
assert.equal(notifications, 1, 'bot cancellation stops after the awaited notification');

const reentered = createExpeditionMatch('border-01');
endTurn(reentered, 0);
let releaseOld;
const oldGate = new Promise((resolve) => { releaseOld = resolve; });
let oldNotifications = 0;
const oldRun = startBotTurn(reentered, async () => { oldNotifications += 1; await oldGate; }, { delayMs: 0 });
const newRun = startBotTurn(reentered, async () => {}, { delayMs: 0 });
await newRun;
releaseOld();
await oldRun;
assert.equal(oldNotifications, 1, 're-entering the same battle retires the older bot session after its in-flight callback');
assert.equal(reentered.phase === 'over' || reentered.currentPlayer === 0, true);

const resumed = restoreMatch(clone(createExpeditionMatch('border-01')));
endTurn(resumed, 0);
const savedAiTurn = restoreMatch(clone(resumed));
const aiActions = [];
await startBotTurn(savedAiTurn, async (_beforeUnits, action) => aiActions.push(action), { delayMs: 0 });
assert.equal(savedAiTurn.phase === 'over' || savedAiTurn.currentPlayer === 0, true, 'a restored AI turn can continue to completion');
assert.equal(aiActions.length > 0, true);
assert.equal(aiActions.at(-1).kind, savedAiTurn.phase === 'over' ? aiActions.at(-1).kind : 'end-turn', 'turn notification never reuses the previous combat action');

const simultaneous = createExpeditionMatch('banners-01');
simultaneous.players[0].hand = [20044];
simultaneous.players[0].mana = 9;
for (const player of simultaneous.players) findGeneral(simultaneous, player.id).health = 2;
assert.equal(castSpell(simultaneous, 0, null, 0), true);
assert.equal(simultaneous.result, 'loss', 'player general death has priority when a spell kills every general');
assert.equal(simultaneous.resultReason, 'general-defeated');
assert.equal(simultaneous.units.some((unit) => unit.owner === 0), false, 'defeated faction units retreat together with its general');

const outcomes = [];
for (const level of EXPEDITION_LEVELS) {
  const state = createExpeditionMatch(level.id, { 9: 2, 11: 2, 14: 2 });
  let actions = 0;
  while (state.phase !== 'over' && actions++ < 1200) autoAct(state, state.currentPlayer);
  assert.equal(state.phase, 'over', `${level.id} autoplay must terminate`);
  outcomes.push(`${level.id}:${state.result}@${state.round}`);
}

console.log(`Expedition engine checks passed. Deterministic baseline: ${outcomes.join(', ')}`);
