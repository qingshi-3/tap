import assert from 'node:assert/strict';
import {
  attackUnit, battleCommandTargets, castSpell, createExpeditionMatch, endTurn, findGeneral,
  drawCard, playCard, restoreMatch, spellPositions, validateMatch
} from '../dist/js/engine.js';
import { getCard } from '../dist/js/cards.js';
import { HEROES, getFaction } from '../dist/js/factions.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const heroIds = [1, 23, 101, 123, 201, 223, 301, 323, 401, 418, 501, 527];

for (const heroId of heroIds) {
  const state = createExpeditionMatch('border-01', {}, null, heroId);
  const hero = HEROES[heroId], faction = getFaction(hero.faction);
  if (heroId === 23) state.units.find((unit) => unit.owner === 0 && getCard(unit.cardId)?.type === 'unit').health -= 1;
  assert.equal(state.schemaVersion, 4);
  assert.deepEqual(state.squad, faction.defaultSquad);
  assert.equal(validateMatch(state), true);
  const targets = battleCommandTargets(state);
  assert.deepEqual(Object.keys(targets).sort(), ['available', 'cells', 'type', 'unitIds']);
  assert.equal(targets.available, true, `${heroId} starts with a legal command`);
  const target = targets.type === 'cell' ? targets.cells[0] : targets.type === 'self' ? null : targets.unitIds[0];
  const mana = state.players[0].mana;
  assert.equal(useCommand(state, target), true, `${heroId} command resolves`);
  assert.equal(state.players[0].mana, mana - 1);
  assert.equal(state.players[0].bbsUsed, true);
  assert.equal(state.lastAction.cardId, hero.bbsCardId);
  assert.equal(useCommand(state, target), false, 'command is once per turn');
  assert.equal(validateMatch(state), true);
  assert.equal(validateMatch(clone(state)), true);
  assert.equal(validateMatch(restoreMatch(clone(state))), true);
}

function useCommand(state, target) {
  // Dynamic import binding remains explicit in this check's public API surface.
  return command(state, target);
}
import { useBattleCommand as command } from '../dist/js/engine.js';

const noMana = createExpeditionMatch('border-01', {}, null, 401);
noMana.players[0].mana = 0;
assert.equal(battleCommandTargets(noMana).available, false);
assert.equal(command(noMana, null), false);

const starhornDeck = createExpeditionMatch('border-01', {}, null, 418);
assert.equal(starhornDeck.players[0].deck.length, 24, 'new factions use the deterministic 24-card expedition deck');
for (let turn = 1; turn <= 3; turn++) assert.notEqual(drawCard(starhornDeck, 0), null, `Starhorn fills hand on draw ${turn}`);
for (let turn = 4; turn <= 10; turn++) assert.equal(drawCard(starhornDeck, 0), null, 'full hand pauses extra draws');
assert.equal(starhornDeck.players[0].hand.length, 6, 'draws respect the six-card hand limit');
assert.equal(starhornDeck.players[0].deck.length, 21, 'paused draws preserve every remaining deck card');

const malformedTraining = clone(createExpeditionMatch('border-01', {}, null, 101));
delete malformedTraining.training[110];
assert.equal(validateMatch(malformedTraining), false, 'schema 4 requires every faction training rank');

const zirixCommand = createExpeditionMatch('border-01', {}, null, 201);
const zirixCell = battleCommandTargets(zirixCommand).cells[0];
assert.equal(command(zirixCommand, zirixCell), true);
const ironDervish = zirixCommand.units.find((unit) => unit.cardId === 225);
assert.equal(ironDervish.summonedThisTurn, true, 'Iron Dervish has no Rush');
endTurn(zirixCommand, 0);
assert.equal(zirixCommand.units.some((unit) => unit.unitId === ironDervish.unitId), true, 'Iron Dervish persists after end turn');

const obelyskState = createExpeditionMatch('border-01', {}, null, 201);
obelyskState.players[0].hand = [214]; obelyskState.players[0].mana = 9;
const obelyskCell = { x: obelyskState.units[0].x, y: obelyskState.units[0].y - 1 };
assert.equal(playCard(obelyskState, 0, obelyskCell.x, obelyskCell.y), true);
assert.equal(obelyskState.units.some((unit) => unit.cardId === 217), false, 'Obelysk does not create a Wind Dervish on play');

const warbird = createExpeditionMatch('border-01', {}, null, 501);
assert.equal(battleCommandTargets(warbird).type, 'self');
const enemyGeneral = warbird.units.filter((unit) => unit.owner !== 0 && getCard(unit.cardId)?.type === 'general').sort((a, b) => a.owner - b.owner)[0];
const enemyHealth = enemyGeneral.health;
assert.equal(command(warbird, null), true);
assert.equal(enemyGeneral.health, enemyHealth - 2);
assert.deepEqual(warbird.lastAction.statChanges, [{ unitId: enemyGeneral.unitId, kind: 'damage', amount: 2 }]);

const terminalLifecycle = createExpeditionMatch('border-01', {}, null, 323);
const doomedGeneral = findGeneral(terminalLifecycle, 1);
doomedGeneral.health = 1;
terminalLifecycle.creepCells[`${doomedGeneral.x},${doomedGeneral.y}`] = 0;
const serialBeforeLethalEnd = terminalLifecycle.turnSerial;
assert.equal(endTurn(terminalLifecycle, 0), true);
assert.equal(terminalLifecycle.phase, 'over');
assert.equal(terminalLifecycle.turnSerial, serialBeforeLethalEnd, 'lethal end-turn effects never begin another faction turn');
assert.equal(findGeneral(terminalLifecycle, 1), null, 'defeated faction is not revived by turn-start lifecycle');

const growingCreep = createExpeditionMatch('border-01', {}, null, 323);
endTurn(growingCreep, 0);
const firstCreep = Object.keys(growingCreep.creepCells).filter((key) => growingCreep.creepCells[key] === 0);
assert.equal(firstCreep.length, 1, 'Crawler creates exactly one new creep cell per end turn');
endTurn(growingCreep, 1);
endTurn(growingCreep, 0);
const secondCreep = Object.keys(growingCreep.creepCells).filter((key) => growingCreep.creepCells[key] === 0);
assert.equal(secondCreep.length, 2, 'Crawler deterministically expands into a different free creep cell');

const recurringRebirth = createExpeditionMatch('border-01', {}, null, 401);
let rebirthUnit = recurringRebirth.units.find((unit) => unit.owner === 0 && unit.cardId === 412);
const rebirthAttacker = findGeneral(recurringRebirth, 1);
rebirthUnit.health = 1;
rebirthAttacker.x = rebirthUnit.x + 1; rebirthAttacker.y = rebirthUnit.y;
rebirthAttacker.moved = false; rebirthAttacker.attacked = false; rebirthAttacker.summonedThisTurn = false;
recurringRebirth.currentPlayer = 1; recurringRebirth.phase = 'ai';
assert.equal(attackUnit(recurringRebirth, rebirthAttacker.unitId, rebirthUnit.unitId, 1), true);
assert.equal(recurringRebirth.units.some((unit) => unit.cardId === 411 && unit.hatchCardId === 412), true, 'first death creates an egg');
endTurn(recurringRebirth, 1);
rebirthUnit = recurringRebirth.units.find((unit) => unit.owner === 0 && unit.cardId === 412);
assert.equal(rebirthUnit.reborn, true, 'egg hatches back into the original Rebirth unit');
rebirthUnit.health = 1;
rebirthAttacker.moved = false; rebirthAttacker.attacked = false;
recurringRebirth.currentPlayer = 1; recurringRebirth.phase = 'ai';
assert.equal(attackUnit(recurringRebirth, rebirthAttacker.unitId, rebirthUnit.unitId, 1), true);
assert.equal(recurringRebirth.units.some((unit) => unit.cardId === 411 && unit.hatchCardId === 412), true, 'a reborn unit creates another egg on every later death');

for (const heroId of [101, 123, 201, 301, 323, 401, 418, 501, 527]) {
  const state = createExpeditionMatch('border-01', {}, null, heroId);
  const hand = state.players[0].hand;
  const spellIndex = hand.findIndex((id) => getCard(id)?.type === 'spell');
  assert.notEqual(spellIndex, -1, `${heroId} faction has an opening spell`);
  const spell = getCard(hand[spellIndex]);
  state.players[0].mana = 9;
  let target = null;
  if (spell.target === 'cell') {
    const cells = spellPositions(state, spell, 0);
    assert.ok(cells.length);
    target = cells[0];
  } else if (spell.target === 'ally') target = state.units.find((unit) => unit.owner === 0 && getCard(unit.cardId)?.type === 'unit')?.unitId;
  else if (spell.target === 'enemy') target = state.units.find((unit) => unit.owner !== 0 && (spell.effect !== 'flashFreeze' || getCard(unit.cardId)?.type === 'unit'))?.unitId;
  else if (spell.target === 'minion') target = state.units.find((unit) => getCard(unit.cardId)?.type === 'unit')?.unitId;
  assert.equal(castSpell(state, spellIndex, target, 0), true, `${spell.name} resolves`);
}

// Passive/lifecycle probes: nearby summon bonus, spellwatch, ranged attack, death triggers and turn reset.
const lyonar = createExpeditionMatch('border-01', {}, null, 1);
lyonar.players[0].hand = [14]; lyonar.players[0].mana = 9;
const summonCell = { x: lyonar.units[0].x, y: lyonar.units[0].y - 1 };
assert.equal(playCard(lyonar, 0, summonCell.x, summonCell.y), true);
assert.equal(lyonar.units.find((unit) => unit.x === summonCell.x && unit.y === summonCell.y).healthBuff, 1);

const songhai = createExpeditionMatch('border-01', {}, null, 123);
const ranged = songhai.units.find((unit) => getCard(unit.cardId)?.ranged);
if (ranged) {
  ranged.summonedThisTurn = false; ranged.attacked = false;
  const enemy = songhai.units.find((unit) => unit.owner !== 0);
  assert.equal(attackUnit(songhai, ranged.unitId, enemy.unitId), true, 'ranged attacks across the board');
}

const resumed = restoreMatch(clone(createExpeditionMatch('border-01', {}, null, 527)));
assert.equal(command(resumed, null), true);
const beforeSerial = resumed.turnSerial;
endTurn(resumed, 0);
assert.ok(resumed.turnSerial > beforeSerial);
assert.equal(validateMatch(resumed), true);

console.log('Hero, faction, command, spell, passive lifecycle and resume checks passed.');
