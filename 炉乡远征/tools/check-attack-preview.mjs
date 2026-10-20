import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { getCard } from '../dist/js/cards.js';
import { attackUnit, effectiveAttack } from '../dist/js/engine.js';
import { previewAttack } from '../dist/js/attack-preview.js';
import { blankMatch } from './battle-fixture.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));
const evidence = [];
function fixture(entries) {
  const state = blankMatch();
  for (const player of state.players) { player.deck = [9]; player.hand = []; }
  // IDs start above the match's actual allocator so simulated death summons are
  // distinguishable from the existing units, just as restored matches are.
  state.units = entries.map((entry, index) => {
    const card = getCard(entry.cardId);
    return { unitId: 100 + index, owner: 0, x: 2, y: 2,
      attack: card.attack, health: card.health, maxHealth: card.health,
      attackBuff: 0, healthBuff: 0, moved: false, attacked: false,
      summonedThisTurn: false, token: false, reborn: false, silenced: false, ...entry };
  });
  return state;
}
const generals = [{ cardId: 1, owner: 0, x: 0, y: 0 }, { cardId: 23, owner: 1, x: 8, y: 4 }];
function check(name, entries, expected, configure = () => {}) {
  const state = fixture([...generals, ...entries]);
  configure(state);
  const initial = clone(state);
  const random = Math.random;
  let forecast;
  Math.random = () => { throw Error('attack preview consumed randomness'); };
  try { forecast = previewAttack(state, 102, 103); } finally { Math.random = random; }
  assert.deepEqual(state, initial, `${name}: input unchanged`);
  assert.ok(forecast, name);
  const repeated = previewAttack(state, 102, 103);
  assert.deepEqual(repeated, forecast, `${name}: repeat deterministic`);
  const actual = clone(state);
  assert.equal(attackUnit(actual, 102, 103), true);
  assert.equal(forecast.retaliated, !!actual.lastAction.retaliated);
  assert.deepEqual(forecast.targetIds, actual.lastAction.targetIds);
  for (const entry of forecast.units) {
    const before = state.units.find(unit => unit.unitId === entry.unitId);
    const after = actual.units.find(unit => unit.unitId === entry.unitId);
    assert.equal(entry.healthBefore, before.health);
    assert.equal(entry.healthAfter, after?.health ?? 0);
    assert.equal(entry.attackBefore, effectiveAttack(state, before));
    assert.equal(entry.attackAfter, after ? effectiveAttack(actual, after) : 0);
    assert.equal(entry.removed, !after);
    assert.equal(entry.shieldLost, false);
  }
  for (const before of state.units) {
    const after = actual.units.find(unit => unit.unitId === before.unitId);
    if (!after || JSON.stringify(before) !== JSON.stringify(after) || effectiveAttack(state, before) !== effectiveAttack(actual, after)) {
      assert.ok(forecast.units.some(entry => entry.unitId === before.unitId), `${name}: changed unit included`);
    }
  }
  expected(forecast, actual);
  evidence.push({ name, forecast });
}
const row = (forecast, id) => forecast.units.find(unit => unit.unitId === id);
check('ordinary retaliation', [{ cardId: 9, attack: 2, health: 5 }, { cardId: 9, owner: 1, x: 3, attack: 3, health: 5 }], f => {
  assert.equal(f.retaliated, true); assert.equal(row(f, 102).healthAfter, 2); assert.equal(row(f, 103).healthAfter, 3);
});
check('lethal prevents retaliation', [{ cardId: 9, attack: 5 }, { cardId: 9, owner: 1, x: 3, health: 2 }], f => {
  assert.equal(f.retaliated, false); assert.equal(row(f, 103).removed, true); assert.equal(row(f, 102).healthAfter, row(f, 102).healthBefore);
});
check('ranged attack outside melee', [{ cardId: 109, attack: 2 }, { cardId: 9, owner: 1, x: 6, health: 5 }], f => {
  assert.equal(f.retaliated, false); assert.equal(row(f, 103).healthAfter, 3);
});
check('backstab bonus prevents retaliation', [{ cardId: 110, x: 4, attack: 2 }, { cardId: 9, owner: 1, x: 3, health: 10 }], f => {
  assert.equal(f.retaliated, false); assert.equal(row(f, 103).healthAfter, 10 - 2 - getCard(110).backstab);
});
check('blast reaches line units', [{ cardId: 213, attack: 2, health: 5 }, { cardId: 9, owner: 1, x: 4, health: 5 }, { cardId: 9, owner: 1, x: 5, health: 5 }, { cardId: 9, owner: 1, x: 6, health: 5 }], f => {
  assert.deepEqual(f.targetIds, [103, 104]); assert.equal(row(f, 104).healthAfter, 3);
  // Range 3: the third unit in the ray is out of reach.
  assert.equal(row(f, 105), undefined);
});
// Current (v3) frenzy contract: only the primary target retaliates; check-campaign-content covers the same rule.
check('frenzy hits adjacent enemies, only primary retaliates', [{ cardId: 10307, attack: 2, health: 10 }, { cardId: 9, owner: 1, x: 3, health: 5, attack: 1 }, { cardId: 9, owner: 1, x: 2, y: 3, health: 5, attack: 2 }], f => {
  assert.deepEqual(f.targetIds, [103, 104]); assert.equal(row(f, 102).healthAfter, 9); assert.equal(row(f, 104).healthAfter, 3);
});
check('death watch and death summon allocator', [{ cardId: 9, attack: 5 }, { cardId: 503, owner: 1, x: 3, health: 2 }, { cardId: 311, owner: 1, x: 6, health: 2, attack: 2 }], (f, actual) => {
  assert.equal(row(f, 104).healthAfter, 3); assert.equal(row(f, 104).attackAfter, 3);
  assert.ok(actual.units.some(unit => unit.cardId === 504));
});
check('death allied health growth', [{ cardId: 9, attack: 5 }, { cardId: 19050, owner: 1, x: 3, health: 2 }, { cardId: 9, owner: 1, x: 4, health: 2 }], f => {
  assert.equal(row(f, 104).healthAfter, 6);
});
check('death draw fatigue kills distant general', [{ cardId: 9, attack: 5 }, { cardId: 10982, owner: 1, x: 3, health: 2 }], (f, actual) => {
  assert.equal(row(f, 101).removed, true);
  assert.equal(row(f, 101).healthAfter, 0);
  assert.equal(actual.phase, 'over'); assert.equal(actual.winner, 0);
}, state => { state.players[1].deck = []; state.units[1].health = 1; });
// Compare actual death summon IDs with and without repeated forecasts, resetting
// via the same real match entrypoint before each branch.
function deathSummonIds(withForecast) {
  const state = fixture([...generals, { cardId: 9, attack: 5 }, { cardId: 503, owner: 1, x: 3, health: 2 }]);
  if (withForecast) for (let index = 0; index < 10; index++) previewAttack(state, 102, 103);
  attackUnit(state, 102, 103);
  return state.units.filter(unit => unit.cardId === 504).map(unit => unit.unitId);
}
assert.deepEqual(deathSummonIds(true), deathSummonIds(false));
const invalid = fixture([...generals, { cardId: 9 }, { cardId: 9, owner: 1, x: 8, y: 2 }]);
const invalidBefore = clone(invalid);
assert.equal(previewAttack(invalid, 102, 103), null);
assert.equal(previewAttack(invalid, 102, 101, 1), null);
assert.deepEqual(invalid, invalidBefore);
evidence.push({ name: 'invalid attack and allocator preserved', passed: true });
const output = new URL('../output/mobile-attack/rules/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('attack-preview-results.json', output), JSON.stringify(evidence, null, 2) + '\n');
console.log(`Attack forecast behavior passed: ${evidence.length} scenarios; source state and death-summon IDs preserved.`);
