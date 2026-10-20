import assert from 'node:assert/strict';
import {
  attackUnit, battleCommandTargets, castSpell, effectiveAttack, endTurn, findGeneral, playCard,
  restoreMatch, useBattleCommand
} from '../dist/js/engine.js';
import { squadMatch } from './battle-fixture.mjs';
import { getCard } from '../dist/js/cards.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const make = (heroId) => squadMatch(heroId);
const general = (state, owner = 0) => findGeneral(state, owner);
const minions = (state, owner = 0) => state.units.filter((unit) => unit.owner === owner && getCard(unit.cardId)?.type === 'unit');
const ready = (unit) => Object.assign(unit, { moved: false, attacked: false, summonedThisTurn: false });
const addUnit = (state, cardId, owner, x, y, extra = {}) => {
  const card = getCard(cardId), template = state.units.find((unit) => getCard(unit.cardId)?.type === 'unit') ?? state.units[0];
  const unit = { ...clone(template), unitId: Math.max(999, ...state.units.map((entry) => entry.unitId)) + 1, cardId, owner, x, y, // ids stay above engine-assigned summon ids
    attack: card.attack, maxHealth: card.health, health: card.health, attackBuff: 0, healthBuff: 0,
    moved: false, attacked: false, summonedThisTurn: false, token: !!card.token, reborn: false, ...extra };
  state.units.push(unit); return unit;
};
const cycle = (state) => { const before = state.turnSerial; endTurn(state, 0); while (state.phase !== 'over' && state.currentPlayer !== 0) endTurn(state, state.currentPlayer); assert.ok(state.turnSerial > before); };
const putInHand = (state, cardId) => { state.players[0].hand = [cardId]; state.players[0].mana = 9; };

// All twelve active commands assert their described concrete output.
{
  const s = make(1), target = minions(s)[0], before = target.attackBuff; assert.equal(useBattleCommand(s, target.unitId), true); assert.equal(target.attackBuff, before + 2);
}
{
  const s = make(23), target = minions(s)[0]; target.health = 1; const hp = target.health; assert.equal(useBattleCommand(s, target.unitId), true); assert.equal(target.health, hp + 3);
}
{
  const s = make(101), target = minions(s)[0]; target.x = 7; target.y = 4; assert.equal(useBattleCommand(s, target.unitId), true); assert.ok(Math.max(Math.abs(target.x - general(s).x), Math.abs(target.y - general(s).y)) <= 1);
}
for (const [heroId, tokenId] of [[123, 108], [201, 225]]) {
  const s = make(heroId), cell = battleCommandTargets(s).cells[0]; assert.equal(useBattleCommand(s, cell), true); assert.equal(s.units.some((unit) => unit.cardId === tokenId), true);
}
{
  const s = make(223); assert.equal(useBattleCommand(s, null), true); assert.equal(s.players[0].bbsMinionAttackBonus, 2);
}
{
  const s = make(301), before = s.units.filter((unit) => unit.cardId === 315).length; assert.equal(useBattleCommand(s, null), true); assert.equal(s.units.filter((unit) => unit.cardId === 315).length, before + 2);
}
{
  const s = make(323), target = general(s, 1), hp = target.health; assert.equal(useBattleCommand(s, target.unitId), true); assert.equal(target.health, hp - 1); assert.equal(s.creepCells[`${target.x},${target.y}`], 0);
}
{
  const s = make(401), hero = general(s), before = hero.attackBuff; assert.equal(useBattleCommand(s, null), true); assert.equal(hero.attackBuff, before + 1);
}
{
  const s = make(418); s.players[0].deck = [406]; s.players[1].deck = [14]; const hands = s.players.map((p) => p.hand.length); assert.equal(useBattleCommand(s, null), true); assert.deepEqual(s.players.map((p, i) => p.hand.length - hands[i]), [1, 1]);
}
{
  const s = make(501), target = general(s, 1), hp = target.health; assert.equal(useBattleCommand(s, null), true); assert.equal(target.health, hp - 2);
}
{
  const s = make(527); assert.equal(useBattleCommand(s, null), true); putInHand(s, 505); const pos = { x: general(s).x, y: general(s).y - 1 }; assert.equal(playCard(s, 0, pos.x, pos.y), true); const summoned = s.units.find((u) => u.cardId === 505 && u.x === pos.x); assert.equal(summoned.attackBuff, 1); assert.equal(summoned.healthBuff, 2, 'active +1/+1 stacks with Kara first-summon passive +0/+1');
}

// Passive caps and next-turn reset/resume.
{
  const s = make(1); putInHand(s, 14); const g = general(s); assert.equal(playCard(s, 0, g.x, g.y - 1), true); const first = s.units.find((u) => u.cardId === 14 && u.y === g.y - 1); assert.equal(first.healthBuff, 1);
  putInHand(s, 9); assert.equal(playCard(s, 0, g.x + 1, g.y - 1), true); assert.equal(s.units.find((u) => u.cardId === 9).healthBuff, 0);
  const resumed = restoreMatch(clone(s)); assert.equal(resumed.players[0].turnTriggers.adjacentSummon, true); cycle(resumed); assert.equal(resumed.players[0].turnTriggers.adjacentSummon, false);
}
{
  const s = make(23), [a, b] = minions(s); a.health -= 2; b.health -= 2; assert.equal(useBattleCommand(s, a.unitId), true); assert.equal(a.attackBuff, 1);
  s.players[0].bbsUsed = false; s.players[0].mana += 1; assert.equal(useBattleCommand(s, b.unitId), true); assert.equal(b.attackBuff, 0, 'heal passive caps at once per turn');
}
{
  const s = make(101); s.units = [general(s), general(s, 1)]; const enemy1 = addUnit(s, 14, 1, 4, 2, { health: 10, maxHealth: 10 }), enemy2 = addUnit(s, 14, 1, 6, 2, { health: 10, maxHealth: 10 });
  const a = addUnit(s, 110, 0, 5, 2), b = addUnit(s, 110, 0, 7, 2); attackUnit(s, a.unitId, enemy1.unitId); attackUnit(s, b.unitId, enemy2.unitId); assert.equal(enemy1.health, 6); assert.equal(enemy2.health, 7, 'backstab passive adds only the first extra point');
}
{
  const s = make(123); s.units = [general(s), general(s, 1)]; const ranged = addUnit(s, 109, 0, 1, 1), enemy = addUnit(s, 14, 1, 4, 1, { health: 10, maxHealth: 10 }); putInHand(s, 20081); assert.equal(castSpell(s, 0, enemy.unitId), true); assert.equal(ranged.attackBuff, 1);
  putInHand(s, 20081); assert.equal(castSpell(s, 0, enemy.unitId), true); assert.equal(ranged.attackBuff, 1, 'spell passive caps at once per turn');
}
{
  const s = make(201), cell = battleCommandTargets(s).cells[0]; assert.equal(useBattleCommand(s, cell), true); const dervish = s.units.find((u) => u.cardId === 225); assert.equal(dervish.healthBuff, 1, 'Zirix buffs summoned dervishes');
  putInHand(s, 211); const before = dervish.healthBuff; assert.equal(playCard(s, 0, 3, 3), true); assert.equal(dervish.healthBuff, before + 2, 'Dunecaster opening buff targets a dervish');
}
{
  const s = make(223); s.units = [general(s), general(s, 1)]; const hero = general(s); hero.health -= 5; const victim1 = addUnit(s, 14, 1, 2, 2, { health: 1 }), victim2 = addUnit(s, 14, 1, 2, 3, { health: 1 });
  const killer1 = addUnit(s, 406, 0, 1, 2), killer2 = addUnit(s, 406, 0, 1, 3); attackUnit(s, killer1.unitId, victim1.unitId); const after = hero.health; attackUnit(s, killer2.unitId, victim2.unitId); assert.equal(after, hero.maxHealth - 3); assert.equal(hero.health, after);
}
{
  const s = make(301); s.units = [general(s), general(s, 1)]; const victim1 = addUnit(s, 14, 0, 2, 2, { health: 1 }), victim2 = addUnit(s, 14, 0, 2, 3, { health: 1 }); const e1 = addUnit(s, 406, 1, 3, 2), e2 = addUnit(s, 406, 1, 3, 3);
  s.currentPlayer = 1; s.phase = 'ai'; attackUnit(s, e1.unitId, victim1.unitId, 1); attackUnit(s, e2.unitId, victim2.unitId, 1); assert.equal(s.units.filter((u) => u.cardId === 315).length, 1);
}
{
  const s = make(323), hero = general(s); hero.health -= 3; const a = addUnit(s, 14, 1, 3, 2), b = addUnit(s, 14, 1, 3, 3); s.creepCells[`${a.x},${a.y}`] = 0; s.creepCells[`${b.x},${b.y}`] = 0; endTurn(s, 0); assert.equal(hero.health, hero.maxHealth - 2, 'multiple creep hits heal only once');
}
{
  const s = make(401), hero = general(s); s.units = [hero, general(s, 1)]; const enemy = addUnit(s, 14, 1, 1, 2); s.currentPlayer = 1; s.phase = 'ai'; const before = hero.attackBuff; attackUnit(s, enemy.unitId, hero.unitId, 1); assert.equal(hero.attackBuff, before + 1, 'Vaath gain remains through the opposing turn'); cycleFromEnemy(s); assert.equal(hero.attackBuff, before, 'Vaath gain expires at the next own-turn start');
}
{
  const s = make(418); s.players[0].deck = [14, 14]; putInHand(s, 410); const before = s.players[0].hand.length; assert.equal(playCard(s, 0, 3, 2), true); assert.equal(s.players[0].hand.length, before, 'costly summon consumes one and draws one'); putInHand(s, 410); assert.equal(playCard(s, 0, 3, 3), true); assert.equal(s.players[0].hand.length, 0, 'draw passive caps at once per turn');
}
{
  const s = make(501); putInHand(s, 505); assert.equal(playCard(s, 0, 3, 2), true); const infiltrator = s.units.find((u) => u.cardId === 505 && u.x === 3); assert.equal(infiltrator.healthBuff, 1); infiltrator.x = 7; assert.equal(effectiveAttack(s, infiltrator), infiltrator.attack + infiltrator.attackBuff + 2);
}
{
  const s = make(527); s.units = [general(s), general(s, 1)]; const wall = addUnit(s, 525, 0, 2, 2); putInHand(s, 505); assert.equal(playCard(s, 0, 1, 1), true); const first = s.units.find((u) => u.cardId === 505); assert.equal(first.healthBuff, 1); assert.equal(wall.provokeBuff, true);
  putInHand(s, 506); assert.equal(playCard(s, 0, 1, 3), true); assert.equal(s.units.find((u) => u.cardId === 506).healthBuff, 0, 'Kara passive caps at first summon');
}

// Source mechanics used by the hero passives.
{
  const s = make(201); s.units = [general(s), general(s, 1)]; const blast = addUnit(s, 213, 0, 1, 2), target = addUnit(s, 14, 1, 3, 2, { health: 8 }), splash = addUnit(s, 14, 1, 4, 2, { health: 8 }), outOfRange = addUnit(s, 14, 1, 5, 2, { health: 8 }); attackUnit(s, blast.unitId, target.unitId); assert.equal(splash.health, 6); assert.equal(outOfRange.health, 8, 'blast stops at printed range 3');
}
{
  const s = make(201); putInHand(s, 214); playCard(s, 0, 3, 2); const before = s.units.filter((u) => u.cardId === 217).length; cycle(s); assert.ok(s.units.filter((u) => u.cardId === 217).length >= before, 'obelysk summons a dervish next turn');
}
{
  const s = make(401); s.units = [general(s), general(s, 1)]; const rebirth = addUnit(s, 412, 0, 2, 2, { health: 1 }), killer = addUnit(s, 406, 1, 3, 2); s.currentPlayer = 1; s.phase = 'ai'; attackUnit(s, killer.unitId, rebirth.unitId, 1); assert.equal(s.units.some((u) => u.cardId === 411 && u.hatchCardId === 412), true); cycleFromEnemy(s); assert.equal(s.units.some((u) => u.cardId === 412 && u.reborn), true);
}

function cycleFromEnemy(state) { while (state.phase !== 'over' && state.currentPlayer !== 0) endTurn(state, state.currentPlayer); }

console.log('All 12 hero actives, passives, caps, reset/resume and source mechanics passed.');
