import assert from 'node:assert/strict';
import { LEVELS, TRIAL_GROUPS, isTrialUnlocked, nextTrialLevel } from '../dist/js/levels.js';
import { CARDS } from '../dist/js/cards.js';
import { attackUnit, autoAct, castSpell, createChallengeMatch, effectiveAttack, endTurn, findGeneral,
  moveUnit, movementPositions, occupiedUnit, playCard, restoreMatch, useBattleCommand, validateMatch } from '../dist/js/engine.js';
import { SaveManager } from '../dist/js/save-manager.js';
import { CampaignProgress } from '../dist/js/campaign-progress.js';

const results = [];
const clone = (value) => JSON.parse(JSON.stringify(value));
const xy = (unit) => ({ x: unit.x, y: unit.y });
function context(id) {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
  const c = { id, s: createChallengeMatch(id), storage, steps: [], saves: 0 };
  c.unit = (cardId, owner = 0) => {
    const unit = c.s.units.find((entry) => entry.cardId === cardId && entry.owner === owner);
    assert.ok(unit, `${id}: missing ${cardId} owner ${owner}`); return unit;
  };
  c.reload = () => {
    assert.equal(validateMatch(c.s), true, `${id}: valid snapshot`);
    const manager = new SaveManager(() => {}, storage);
    assert.equal(manager.saveLocal(c.s), true, `${id}: save`);
    const loaded = new SaveManager(() => {}, storage);
    assert.equal(loaded.localError, null, `${id}: read saved snapshot`);
    c.s = restoreMatch(loaded.localSnapshot);
    assert.ok(c.s, `${id}: restore`);
    new CampaignProgress(LEVELS, storage).observe(c.s);
    c.saves += 1;
  };
  c.act = (step, command) => {
    assert.equal(command(), true, `${id}: ${JSON.stringify(step)}`);
    c.steps.push(step); c.reload();
  };
  c.move = (unit, x, y) => c.act({ type: 'move', cardId: unit.cardId, from: xy(unit), to: { x, y } }, () => moveUnit(c.s, unit.unitId, x, y));
  c.attack = (unit, target) => c.act({ type: 'attack', cardId: unit.cardId, from: xy(unit), target: { ...xy(target), cardId: target.cardId, owner: target.owner } }, () => attackUnit(c.s, unit.unitId, target.unitId));
  c.play = (cardId, x, y) => c.act({ type: 'summon', cardId, to: { x, y } }, () => playCard(c.s, c.s.players[0].hand.indexOf(cardId), x, y));
  c.spell = (cardId, target) => c.act({ type: 'spell', cardId, target: target?.unitId ? { ...xy(target), cardId: target.cardId, owner: target.owner } : target }, () => castSpell(c.s, c.s.players[0].hand.indexOf(cardId), target?.unitId ?? target));
  c.bbs = (target) => c.act({ type: 'skill', target: target?.unitId ? { ...xy(target), cardId: target.cardId, owner: target.owner } : target }, () => useBattleCommand(c.s, target?.unitId ?? target));
  c.turn = () => {
    c.act({ type: 'end-turn', round: c.s.round }, () => endTurn(c.s, 0));
    let count = 0;
    // Real AI, including skills, movement, attacks and deaths: no scripted empty turns.
    while (c.s.phase === 'ai') {
      assert.ok(count++ < 100, `${id}: enemy loop terminates`);
      assert.equal(autoAct(c.s, c.s.currentPlayer), true, `${id}: enemy action`);
      c.reload();
    }
  };
  c.approach = (unit, target) => {
    if (Math.max(Math.abs(unit.x - target.x), Math.abs(unit.y - target.y)) <= 1) return;
    const to = movementPositions(c.s, unit).find((cell) => Math.max(Math.abs(cell.x - target.x), Math.abs(cell.y - target.y)) <= 1);
    assert.ok(to, `${id}: ${unit.cardId} can approach ${target.cardId}`);
    c.move(unit, to.x, to.y);
  };
  c.reload(); return c;
}

const solutions = {
  'roar-lethal'(c) { c.spell(20174, c.unit(9)); c.attack(c.unit(9), c.unit(23, 1)); },
  'break-the-guard'(c) { c.attack(c.unit(9), c.unit(11, 1)); c.move(c.unit(1), 4, 2); c.attack(c.unit(1), c.unit(23, 1)); },
  'lightchaser-bond'(c) { c.spell(20043, c.unit(15)); c.spell(20068, c.unit(15)); assert.equal(effectiveAttack(c.s, c.unit(15)), 7); c.attack(c.unit(15), c.unit(23, 1)); },
  'move-and-strike'(c) {
    const hero = c.unit(1); assert.equal(attackUnit(c.s, hero.unitId, c.unit(23, 1).unitId), false);
    c.move(hero, 3, 2); c.attack(c.unit(1), c.unit(23, 1));
  },
  'trade-and-retaliate'(c) {
    const bypass = createChallengeMatch(c.id);
    assert.equal(moveUnit(bypass, findGeneral(bypass, 0).unitId, 3, 3), true);
    assert.equal(attackUnit(bypass, findGeneral(bypass, 0).unitId, findGeneral(bypass, 1).unitId), true);
    assert.equal(bypass.phase, 'over'); assert.equal(bypass.winner, 1, 'main general cannot bypass the minion trade');
    c.attack(c.unit(14), c.unit(23, 1)); assert.equal(c.unit(14).health, 2); assert.equal(c.unit(23, 1).health, 2);
    assert.equal(c.s.lastAction.retaliated, true);
    c.move(c.unit(1), 3, 3); c.attack(c.unit(1), c.unit(23, 1));
  },
  'summon-next-turn'(c) {
    assert.equal(effectiveAttack(c.s, c.unit(1)), 0, 'main general cannot bypass recruitment');
    assert.equal(c.unit(23, 1).health, 1, 'one-attack lesson without AI retaliation damage');
    c.play(14, 5, 2); assert.equal(c.s.players[0].mana, 0); assert.equal(c.unit(14).health, 5, 'royal guard passive');
    assert.equal(attackUnit(c.s, c.unit(14).unitId, c.unit(23, 1).unitId), false, 'summoning fatigue');
    assert.equal(movementPositions(c.s, c.unit(14)).length, 0);
    c.turn(); assert.equal(c.s.round, 2); assert.equal(c.s.players[0].maxMana, 2); assert.equal(c.s.players[0].mana, 2);
    assert.equal(c.unit(23, 1).health, 1, 'enemy survives its turn without taking retaliation');
    assert.equal(c.unit(14).summonedThisTurn, false); c.move(c.unit(14), 6, 3); c.attack(c.unit(14), c.unit(23, 1));
  },
  'command-before-attack'(c) {
    c.bbs(c.unit(14)); assert.equal(c.s.players[0].mana, 0); assert.equal(effectiveAttack(c.s, c.unit(14)), 3);
    assert.equal(useBattleCommand(c.s, c.unit(14).unitId), false, 'one command per turn'); c.attack(c.unit(14), c.unit(23, 1));
  },
  'terrain-detour'(c) {
    assert.equal(moveUnit(c.s, c.unit(1).unitId, 2, 2), false, 'wall blocks');
    assert.equal(movementPositions(c.s, c.unit(1)).some((cell) => cell.x === 2 && cell.y === 1), false, 'rough costs two steps');
    c.move(c.unit(1), 2, 3); c.turn(); assert.equal(c.s.round, 2); assert.equal(c.s.phase, 'playing');
    c.move(c.unit(1), 3, 3); c.attack(c.unit(1), c.unit(23, 1)); assert.equal(c.s.resultReason, 'enemies-eliminated');
  },
  'outpost-hold'(c) {
    assert.equal(c.s.players[0].mana, 0); assert.equal(c.s.players[0].maxMana, 1);
    assert.equal(effectiveAttack(c.s, c.unit(23)), 0); assert.equal(effectiveAttack(c.s, c.unit(14)), 0);
    c.move(c.unit(14), 3, 2); c.turn(); assert.equal(c.s.outposts['3,2'], 0); assert.equal(c.s.players[0].mana, 3);
    c.play(11, 3, 3); assert.equal(c.s.players[0].mana, 0); assert.equal(c.unit(11).summonedThisTurn, true);
    c.turn(); assert.equal(c.s.round, 3); assert.equal(c.s.phase, 'playing');
    c.move(c.unit(11), 4, 3); c.attack(c.unit(11), c.unit(1, 1)); assert.equal(c.s.resultReason, 'enemies-eliminated');
  },
  'three-way-crossfire'(c) {
    assert.equal(c.s.players.length, 3); c.turn();
    const living = c.s.units.filter((unit) => unit.owner !== 0 && CARDS[unit.cardId].type === 'general');
    assert.equal(living.length, 1, 'enemy factions actually fight each other'); assert.equal(living[0].health, 2);
    assert.equal(c.s.phase, 'playing', 'one enemy eliminated is not victory'); c.attack(c.unit(109), living[0]);
  },
  'lyonar-healing'(c) {
    c.bbs(c.unit(15)); assert.equal(c.unit(15).health, 3); assert.equal(effectiveAttack(c.s, c.unit(15)), 5);
    c.attack(c.unit(15), c.unit(1, 1));
  },
  'songhai-backstab'(c) {
    const hp = c.unit(109).health; c.attack(c.unit(109), c.unit(23, 1)); assert.equal(c.unit(109).health, hp, 'distant ranged has no retaliation');
    assert.equal(c.unit(23, 1).health, 4); c.attack(c.unit(110), c.unit(23, 1));
    assert.equal(c.unit(110).health, 3, 'backstab has no retaliation'); assert.equal(c.s.players[0].turnTriggers.backstab, true);
  },
  'flight-and-airdrop'(c) {
    assert.deepEqual(c.s.players[0].hand, []); assert.equal(c.s.players[0].mana, 0);
    assert.equal(moveUnit(c.s, c.unit(511).unitId, 4, 2), false, 'flying cannot land on wall');
    c.move(c.unit(511), 6, 2); assert.equal(effectiveAttack(c.s, c.unit(511)), 4, 'infiltrate follows position');
    c.attack(c.unit(511), c.unit(23, 1));
  },
  'vetruvian-obelysk'(c) {
    assert.equal(movementPositions(c.s, c.unit(215)).length, 0, 'stationary obelysk');
    c.turn(); const sand = c.unit(217); assert.equal(sand.summonedThisTurn, false); assert.equal(effectiveAttack(c.s, sand), 3);
    c.approach(sand, c.unit(23, 1)); c.attack(c.unit(217), c.unit(23, 1));
  },
  'abyssian-death-and-creep'(c) {
    c.bbs(c.unit(23, 1)); assert.equal(c.s.creepCells['7,2'], 0); assert.equal(c.unit(23, 1).health, 2);
    c.turn(); assert.equal(c.unit(23, 1).health, 1, 'end-turn creep damage'); c.bbs(c.unit(23, 1));
  },
  'magmar-grow-and-rebirth'(c) {
    c.attack(c.unit(402), c.unit(23, 1)); assert.equal(c.unit(23, 1).health, 4);
    c.turn(); assert.equal(effectiveAttack(c.s, c.unit(402)), 4, 'grow adds one attack');
    c.approach(c.unit(402), c.unit(23, 1)); c.attack(c.unit(402), c.unit(23, 1));
  },
  'vanar-wall-and-infiltrate'(c) {
    assert.equal(effectiveAttack(c.s, c.unit(505)), 2, 'own-half attack');
    c.move(c.unit(505), 5, 3); assert.equal(effectiveAttack(c.s, c.unit(505)), 4, 'infiltrate adds two attack in enemy half');
    c.attack(c.unit(505), c.unit(23, 1));
  }
};

assert.deepEqual(LEVELS.slice(0, 3).map((level) => level.id), ['roar-lethal', 'break-the-guard', 'lightchaser-bond']);
for (const group of TRIAL_GROUPS) {
  const levels = LEVELS.filter((level) => level.group === group.id);
  assert.ok(levels.length);
  for (const [index, level] of levels.entries()) assert.equal(nextTrialLevel(level.id)?.id ?? null, levels[index + 1]?.id ?? null);
}
assert.equal(isTrialUnlocked('unknown'), false);
for (const level of LEVELS) {
  assert.equal(isTrialUnlocked(level.id, []), true, 'freely selectable practice');
  assert.ok(level.lesson.summary && level.lesson.steps.length && level.lesson.takeaway && level.solution);
  const c = context(level.id);
  assert.equal(c.s.schemaVersion, level.extended ? 4 : 2);
  assert.equal(typeof solutions[level.id], 'function', `solution coverage ${level.id}`);
  solutions[level.id](c);
  assert.equal(c.s.phase, 'over', `${level.id}: complete`); assert.equal(c.s.winner, 0, `${level.id}: victory`);
  assert.ok(c.s.completedLevels.includes(level.id), `${level.id}: battle completion`);
  assert.ok(new CampaignProgress(LEVELS, c.storage).completed.has(level.id), `${level.id}: campaign completion survives reload`);
  c.reload(); assert.equal(c.s.winner, 0, `${level.id}: final result survives reload`);
  results.push({ id: level.id, group: level.group, saves: c.saves, steps: c.steps });
}
console.log(JSON.stringify({ ok: true, lessons: results.length, saves: results.reduce((total, result) => total + result.saves, 0), results }, null, process.argv.includes('--json') ? 2 : 0));
