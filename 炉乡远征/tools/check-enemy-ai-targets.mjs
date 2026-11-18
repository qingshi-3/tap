import assert from 'node:assert/strict';
import { autoAct, spellTargets, getBattleCard, castSpell } from '../dist/js/engine.js';
import { blankMatch, makeUnit } from './battle-fixture.mjs';

function battle() {
  const s = blankMatch({ mana: 9 });
  s.currentPlayer = 1; s.phase = 'ai'; s.players[1].bbsUsed = true;
  s.players[1].hand = [20139];
  return s;
}
// With no hostile minions, skip freeze and continue to another legal action.
{
  const s = battle(), friend = makeUnit(19027, 1, 7, 2, 100);
  s.units.push(friend); s.players[1].hand.push(14);
  assert.ok(spellTargets(s, getBattleCard(s, 20139, 1), 1).includes(friend), 'shared spell still legally allows allied targets');
  assert.ok(autoAct(s, 1));
  assert.equal(friend.stunTurns, undefined);
  assert.deepEqual(s.players[1].hand, [20139]);
  assert.equal(s.lastAction.kind, 'summon', 'skipped freeze does not stall other actions');
}
// A valuable allied minion must never outrank an actual hostile minion.
{
  const s = battle(), friend = makeUnit(19027, 1, 7, 2, 100, { attack: 100, health: 100, maxHealth: 100 });
  const enemy = makeUnit(14, 0, 1, 2, 101);
  s.units.push(friend, enemy);
  assert.ok(autoAct(s, 1));
  assert.equal(friend.stunTurns, undefined); assert.equal(enemy.stunTurns, 1);
  assert.equal(s.players[1].hand.length, 0);
}
// Both other seats are hostile in a three-army fight, including seat 2.
for (const owner of [0, 2]) {
  const s = battle();
  s.players.push({ ...structuredClone(s.players[1]), id: 2, hand: [], deck: [] });
  s.battleCards[2] = structuredClone(s.battleCards[1]);
  const friend = makeUnit(19027, 1, 7, 2, 100, { attack: 100, health: 100, maxHealth: 100 });
  const enemy = makeUnit(14, owner, 1, 2, 101);
  s.units.push(friend, enemy);
  assert.ok(autoAct(s, 1));
  assert.equal(friend.stunTurns, undefined); assert.equal(enemy.stunTurns, 1, `owner ${owner} remains hostile`);
}
// Player-directed allied freeze remains a legal deliberate action.
{
  const s = blankMatch({ mana: 9 }), friend = makeUnit(14, 0, 1, 2, 101);
  s.units.push(friend); s.players[0].hand = [20139];
  assert.ok(castSpell(s, 0, friend.unitId, 0)); assert.equal(friend.stunTurns, 1);
}
console.log('Enemy AI freeze targeting passed: no self-freeze, action continuation, hostile priority, three-army ownership and unchanged player targeting.');
