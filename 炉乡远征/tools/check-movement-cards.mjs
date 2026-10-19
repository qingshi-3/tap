import assert from 'node:assert/strict';
import { createChallengeMatch, castSpell, moveUnit, playCard } from '../dist/js/engine.js';

function setup(hand, mana) {
  const state = createChallengeMatch('roar-lethal');
  state.players[0].hand = [...hand];
  state.players[0].mana = mana;
  return state;
}

function generalOf(state) {
  return state.units.find((unit) => unit.cardId === 1);
}

function windbladeOf(state) {
  return state.units.find((unit) => unit.cardId === 9);
}

// Moving is free and does not prevent a later summon in the same turn.
const summon = setup([14], 3);
const summonGeneral = generalOf(summon);
assert.equal(moveUnit(summon, summonGeneral.unitId, 1, 3), true);
assert.equal(summon.players[0].mana, 3);
assert.equal(playCard(summon, 0, 0, 3), true);
assert.deepEqual(summon.players[0].hand, []);
assert.equal(summon.players[0].mana, 2);
assert.ok(summon.units.some((unit) => unit.cardId === 14 && unit.x === 0 && unit.y === 3));

// Roar remains legal after a move when the target is still next to the general.
const nearRoar = setup([20174], 1);
const nearGeneral = generalOf(nearRoar);
const nearWindblade = windbladeOf(nearRoar);
assert.equal(moveUnit(nearRoar, nearGeneral.unitId, 2, 3), true);
assert.equal(nearRoar.players[0].mana, 1);
assert.equal(castSpell(nearRoar, 0, nearWindblade.unitId), true);
assert.equal(nearWindblade.attackBuff, 2);
assert.deepEqual(nearRoar.players[0].hand, []);
assert.equal(nearRoar.players[0].mana, 0);

// Moving to (1,3) puts the windblade at (3,2) outside Roar's one-cell range.
// Rejection must leave both the card and mana untouched.
const farRoar = setup([20174], 1);
const farGeneral = generalOf(farRoar);
const farWindblade = windbladeOf(farRoar);
assert.equal(moveUnit(farRoar, farGeneral.unitId, 1, 3), true);
assert.equal(farRoar.players[0].mana, 1);
const handBeforeRejectedRoar = [...farRoar.players[0].hand];
const manaBeforeRejectedRoar = farRoar.players[0].mana;
assert.equal(castSpell(farRoar, 0, farWindblade.unitId), false);
assert.deepEqual(farRoar.players[0].hand, handBeforeRejectedRoar);
assert.equal(farRoar.players[0].mana, manaBeforeRejectedRoar);
assert.equal(farWindblade.attackBuff, 0);

// A legal spell without the general-adjacency requirement still works after moving.
const strike = setup([20066], 1);
const strikeGeneral = generalOf(strike);
const strikeTarget = windbladeOf(strike);
assert.equal(moveUnit(strike, strikeGeneral.unitId, 1, 3), true);
assert.equal(strike.players[0].mana, 1);
assert.equal(castSpell(strike, 0, strikeTarget.unitId), true);
assert.equal(strikeTarget.health, 1);
assert.deepEqual(strike.players[0].hand, []);
assert.equal(strike.players[0].mana, 0);

console.log('Movement/card regression passed: movement is free; summon and non-adjacent spells remain usable; Roar follows current general adjacency without spending resources on rejection.');
