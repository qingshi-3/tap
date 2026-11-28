import assert from 'node:assert/strict';
import { createChallengeMatch, castSpell, useBattleCommand, attackUnit, playCard, restoreMatch } from '../dist/js/engine.js';
import { EFFECT_MANIFEST } from '../dist/js/effect-manifest.js';
import { CARDS } from '../dist/js/cards.js';

// Exercise committed rule events; rendering and actual input are checked separately in the browser.
const bbs = createChallengeMatch('roar-lethal');
const ally = bbs.units.find((unit) => unit.cardId === 9);
assert.equal(useBattleCommand(bbs, ally.unitId), true);
assert.equal(ally.attackBuff, 2);
assert.equal(bbs.lastAction.cardId, 20174);
assert.deepEqual(bbs.lastAction.targetIds, [ally.unitId]);
assert.equal(bbs.players[0].mana, 0);
assert.equal(useBattleCommand(bbs, ally.unitId), false);

const spell = createChallengeMatch('roar-lethal');
const fighter = spell.units.find((unit) => unit.cardId === 9);
const enemy = spell.units.find((unit) => unit.cardId === 23);
assert.equal(castSpell(spell, 0, fighter.unitId), true);
assert.equal(fighter.attackBuff, ally.attackBuff);
assert.equal(spell.lastAction.cardId, bbs.lastAction.cardId);
const beforeAttack = structuredClone(spell.units);
assert.equal(attackUnit(spell, fighter.unitId, enemy.unitId), true);
assert.equal(spell.phase, 'over');
assert.equal(spell.lastAction.retaliated, false);
assert.deepEqual(spell.lastAction.statChanges, [{ unitId: enemy.unitId, kind: 'damage', amount: 5 }]);
assert.ok(beforeAttack.some((unit) => unit.unitId === enemy.unitId));
assert.ok(!spell.units.some((unit) => unit.unitId === enemy.unitId));
assert.ok(restoreMatch(JSON.parse(JSON.stringify(spell))));

const counter = createChallengeMatch('roar-lethal');
counter.units.find((unit) => unit.cardId === 23).health = 20;
assert.equal(attackUnit(counter, counter.units[1].unitId, counter.units[2].unitId), true);
assert.equal(counter.lastAction.retaliated, true);
assert.equal(counter.units[1].health, 1);
assert.deepEqual(counter.lastAction.statChanges.map(({ amount }) => amount), [3, 2]);

const storm = createChallengeMatch('roar-lethal');
storm.players[0].hand = [20044];
storm.players[0].mana = 2;
storm.units[1].health = 1;
const affected = storm.units.map((unit) => unit.unitId);
assert.equal(castSpell(storm, 0), true);
assert.deepEqual(storm.lastAction.targetIds, affected);
assert.equal(storm.lastAction.cardId, 20044);
assert.equal(storm.units.length, 2);
assert.deepEqual(storm.lastAction.statChanges, affected.map((unitId) => ({ unitId, kind: 'damage', amount: 2 })));

const heal = createChallengeMatch('lightchaser-bond');
const chaser = heal.units.find((unit) => unit.cardId === 15);
assert.equal(castSpell(heal, 0, chaser.unitId), true);
assert.equal(chaser.health, 3);
assert.equal(chaser.attackBuff, 1);
assert.equal(heal.lastAction.cardId, 20043);
// Healing restores one HP here; the extra HP from the subsequent growth is a separate modifier.
assert.deepEqual(heal.lastAction.statChanges, [{ unitId: chaser.unitId, kind: 'heal', amount: 1 }]);
assert.equal(castSpell(heal, 0, chaser.unitId), true);
assert.equal(chaser.attackBuff, 4);
assert.equal(heal.lastAction.cardId, 20068);

// Original NeutralDirect healing and HealWatch include the opponent's units.
const anyHeal = createChallengeMatch('lightchaser-bond');
const ownChaser = anyHeal.units.find((unit) => unit.cardId === 15);
const enemyGeneral = anyHeal.units.find((unit) => unit.cardId === 23);
enemyGeneral.health = 24;
const enemyChaser = { ...ownChaser, unitId: 4, owner: 1, x: 7, y: 4, health: 2 };
anyHeal.units.push(enemyChaser);
assert.equal(castSpell(anyHeal, 0, enemyGeneral.unitId), true);
assert.equal(enemyGeneral.health, 25);
assert.equal(ownChaser.attackBuff, 1);
assert.equal(enemyChaser.attackBuff, 1);
assert.deepEqual(anyHeal.lastAction.statChanges, [{ unitId: enemyGeneral.unitId, kind: 'heal', amount: 1 }]);

const summon = createChallengeMatch('break-the-guard');
const unchanged = JSON.stringify(summon);
assert.equal(playCard(summon, 0, 8, 4), false);
assert.equal(JSON.stringify(summon), unchanged);
assert.equal(playCard(summon, 0, 2, 3), true);
assert.equal(summon.lastAction.cardId, 14);
assert.equal(summon.units.find((unit) => unit.unitId === summon.lastAction.unitId).summonedThisTurn, true);

assert.equal(CARDS[23].sprite.sheet, 'f1_altgeneral');
for (const card of Object.values(CARDS)) {
  const identifiers = (card.type === 'spell' ? EFFECT_MANIFEST.spellRecipes : EFFECT_MANIFEST.cardRecipes)[card.id];
  assert.ok(identifiers?.length, `Missing mapping: ${card.name}`);
  for (const identifier of identifiers) assert.ok(EFFECT_MANIFEST.recipes[identifier], identifier);
}
console.log('Action events, BBS reuse, lethal/counterattack, multi-target spell, heal/buff, legal summon and current card mappings passed.');
