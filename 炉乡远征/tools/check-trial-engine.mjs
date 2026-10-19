import assert from 'node:assert/strict';
import { LEVELS } from '../dist/js/levels.js';
import { createChallengeMatch, createExpeditionMatch, validateMatch, restoreMatch, isTacticalMatch, endTurn, attackUnit, findGeneral, autoAct, useBattleCommand, playCard, effectiveAttack, castSpell } from '../dist/js/engine.js';
import { SaveManager } from '../dist/js/save-manager.js';

const fixtures = [];
function lesson(id, extra = {}) {
  const level = { id: `engine-check-${id}`, extended: true, title: id, goal: '测试战术规则', mana: 3, maxMana: 3,
    hand: [], turnLimit: 3, objective: { type: 'eliminate' },
    board: [{ cardId: 1, owner: 0, x: 1, y: 2 }, { cardId: 23, owner: 1, x: 7, y: 2 }], ...extra };
  LEVELS.push(level); fixtures.push(level);
  return createChallengeMatch(level.id);
}
const roundTrip = (state) => {
  assert.ok(validateMatch(state), `invalid ${state.levelId} ${state.phase}`);
  const restored = restoreMatch(JSON.parse(JSON.stringify(state)));
  assert.ok(restored); return restored;
};

try {
  // Released three single-action trials retain their original schema and end-turn failure.
  for (const level of LEVELS.filter((level) => !level.extended)) {
    const state = roundTrip(createChallengeMatch(level.id));
    assert.equal(state.schemaVersion, 2); assert.equal(isTacticalMatch(state), false);
    assert.equal(endTurn(state), true); assert.equal(state.result, 'loss'); roundTrip(state);
  }

  const timing = lesson('full-round', { turnLimit: 1 });
  assert.equal(timing.schemaVersion, 4); assert.ok(isTacticalMatch(timing));
  assert.equal(timing.training, undefined); assert.equal(timing.squad, undefined);
  assert.equal(endTurn(timing), true); assert.equal(timing.phase, 'ai'); roundTrip(timing);
  assert.equal(endTurn(timing, 1), true); assert.equal(timing.resultReason, 'turn-limit'); roundTrip(timing);

  const survive = lesson('survive', { objective: { type: 'survive', rounds: 2 }, turnLimit: 2 });
  endTurn(survive); endTurn(survive, 1);
  assert.equal(survive.round, 2); assert.equal(survive.phase, 'playing');
  endTurn(survive); endTurn(survive, 1);
  assert.equal(survive.resultReason, 'survived'); assert.ok(survive.completedLevels.includes(survive.levelId)); roundTrip(survive);

  const multi = lesson('multi-enemy', { board: [
    { cardId: 1, owner: 0, x: 2, y: 2, attack: 30 },
    { cardId: 23, owner: 1, x: 3, y: 2, health: 1 },
    { cardId: 9, owner: 1, x: 6, y: 2 },
    { cardId: 123, owner: 2, x: 2, y: 3, health: 1 },
    { cardId: 9, owner: 0, x: 1, y: 3, attack: 30 }
  ] });
  const human = findGeneral(multi, 0), enemy1 = findGeneral(multi, 1), enemy2 = findGeneral(multi, 2);
  assert.ok(attackUnit(multi, human.unitId, enemy1.unitId));
  assert.equal(multi.phase, 'playing'); assert.equal(multi.units.some((unit) => unit.owner === 1), false); roundTrip(multi);
  assert.ok(attackUnit(multi, multi.units.find((unit) => unit.cardId === 9).unitId, enemy2.unitId));
  assert.equal(multi.result, 'win'); assert.deepEqual(multi.completedLevels, [multi.levelId]); roundTrip(multi);

  const terrain = lesson('outpost', { map: { columns: 11, rows: 6, tiles: [{ x: 1, y: 2, type: 'outpost' }, { x: 4, y: 2, type: 'wall' }] } });
  endTurn(terrain); endTurn(terrain, 1);
  assert.equal(terrain.outposts['1,2'], 0); assert.equal(terrain.players[0].mana, 5); roundTrip(terrain);

  const passive = lesson('hero-passive', { board: [{ cardId: 1, owner: 0, x: 1, y: 2 }, { cardId: 9, owner: 0, x: 2, y: 2 }, { cardId: 23, owner: 1, x: 7, y: 2 }] });
  const ally = passive.units.find((unit) => unit.cardId === 9);
  assert.equal(effectiveAttack(passive, ally), ally.attack + 1);
  assert.ok(useBattleCommand(passive, ally.unitId)); assert.equal(ally.attackBuff, 2); roundTrip(passive);
  const summon = lesson('hero-summon-passive', { hand: [9] });
  assert.ok(playCard(summon, 0, 2, 2));
  assert.equal(summon.players[0].turnTriggers.adjacentSummon, true);
  assert.equal(summon.units.find((unit) => unit.cardId === 9).healthBuff, 1); roundTrip(summon);
  const ai = lesson('real-ai', { enemyDecks: { 1: [14, 14, 14] } });
  endTurn(ai); let actions = 0;
  while (ai.phase === 'ai' && actions++ < 80) { assert.ok(autoAct(ai, ai.currentPlayer)); roundTrip(ai); }
  assert.ok(actions < 80); assert.notEqual(ai.phase, 'ai');

  // New tactical snapshots reject malformed map/state; expedition training remains mandatory.
  const base = lesson('validation');
  for (const mutate of [s => { delete s.outposts; }, s => { delete s.creepCells; }, s => { delete s.players[0].turnTriggers; }, s => { s.board.columns = 21; }, s => { s.objective.type = 'unknown'; }, s => { s.players[1].ai = false; }, s => { s.training = {}; }, s => { s.units[0].moved = 'yes'; }]) {
    const malformed = structuredClone(base); mutate(malformed); assert.equal(validateMatch(malformed), false);
  }
  const expedition = createExpeditionMatch('border-01'); delete expedition.training; assert.equal(validateMatch(expedition), false);

  class Memory { data = new Map(); getItem(key) { return this.data.get(key) ?? null; } setItem(key, value) { this.data.set(key, String(value)); } removeItem(key) { this.data.delete(key); } }
  // A real all-board spell resolves both general deaths before the caller saves.
  // Neither unit ordering nor a previous clear may change its loss/completion result.
  for (const schema of [2, 4]) for (const enemyFirst of [false, true]) for (const previouslyCleared of [false, true]) {
    const state = schema === 4 ? lesson(`simultaneous-${enemyFirst}-${previouslyCleared}`, { hand: [20044],
      board: [{ cardId: 1, owner: 0, x: 1, y: 2, health: 1 }, { cardId: 23, owner: 1, x: 7, y: 2, health: 1 }] })
      : createChallengeMatch('roar-lethal');
    state.units = state.units.filter((unit) => [1, 23].includes(unit.cardId));
    for (const unit of state.units) unit.health = 1;
    state.players[0].hand = [20044]; state.players[0].mana = 3; state.players[0].maxMana = 3;
    state.completedLevels = previouslyCleared ? [state.levelId] : [];
    state.units.sort((a, b) => enemyFirst ? b.owner - a.owner : a.owner - b.owner);
    roundTrip(state);
    assert.ok(castSpell(state, 0));
    assert.equal(state.result, 'loss'); assert.equal(state.winner, 1);
    assert.deepEqual(state.completedLevels, previouslyCleared ? [state.levelId] : []);
    roundTrip(state);
    const memory = new Memory(), saves = new SaveManager(() => {}, memory);
    assert.ok(saves.saveLocal(state));
    const reentered = roundTrip(new SaveManager(() => {}, memory).localSnapshot);
    assert.equal(reentered.result, 'loss'); assert.deepEqual(reentered.completedLevels, state.completedLevels);
    assert.ok(new SaveManager(() => {}, memory).saveLocal(reentered));
  }
  const storage = new Memory(), save = new SaveManager(() => {}, storage);
  assert.ok(save.saveLocal(base));
  const continued = roundTrip(new SaveManager(() => {}, storage).localSnapshot);
  endTurn(continued); assert.ok(new SaveManager(() => {}, storage).saveLocal(continued));
  assert.equal(new SaveManager(() => {}, storage).localSnapshot.phase, 'ai');

  for (const level of LEVELS.filter((level) => level.extended && !fixtures.includes(level))) roundTrip(createChallengeMatch(level.id));
  console.log('Trial engine checks passed: legacy rules, full rounds, survival, multi-enemy victory, outposts, hero commands, real AI, validation and save/resume.');
} finally {
  for (const level of fixtures) LEVELS.splice(LEVELS.indexOf(level), 1);
}
