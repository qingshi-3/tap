import assert from 'node:assert/strict';
import { campaignMatch } from './battle-fixture.mjs';
import { ADVENTURE_LEVELS } from '../dist/js/adventure-content.js';
import {
  restoreMatch,
  validateMatch,
  endTurn,
  useAdventureAbility,
  getAdventureAbilityOptions,
  previewAdventureAbility,
  findGeneral,
} from '../dist/js/engine.js';
const results = [];
const test = (name, fn) => {
  fn();
  results.push(name);
  console.log('PASS', name);
};
const save = (s) => {
  assert.equal(validateMatch(s), true, s.levelId);
  const value = JSON.stringify(s);
  const restored = restoreMatch(JSON.parse(value));
  assert.ok(restored, s.levelId);
  assert.deepEqual(restored.adventure, s.adventure);
  return restored;
};
test('all 18 mulligan and turn-event snapshots continue, save and re-enter repeatedly', () => {
  for (const l of ADVENTURE_LEVELS) {
    let s = campaignMatch({ levelId: l.id, mulligan: false });
    s = save(s);
    s = campaignMatch({ levelId: l.id });
    for (let n = 0; n < 18 && s.phase !== 'over'; n++) {
      s = save(s);
      assert.equal(endTurn(s, s.currentPlayer), true);
    }
    save(s);
  }
});
test('committed charge and once-per-turn action survive two reloads', () => {
  let s = campaignMatch({ levelId: 'storm-02' });
  const u = s.units.find((u) => u.cardId === 9202);
  assert.equal(
    useAdventureAbility(s, {
      unitId: u.unitId,
      abilityId: 'arcane-beam',
      direction: 'east',
      revision: s.revision,
    }),
    true,
  );
  s = save(s);
  assert.equal(getAdventureAbilityOptions(s, u.unitId).available, false);
  assert.equal(s.adventure.units.find((q) => q.unitId === u.unitId).charge, 0);
  assert.equal(endTurn(s, 0), true);
  assert.equal(endTurn(s, 1), true);
  s = save(s);
  assert.equal(getAdventureAbilityOptions(s, u.unitId).used, false);
});
test('preview does not alter snapshot, random state, reserve, event IDs or allocator', () => {
  const a = campaignMatch({ levelId: 'starfall-02' }),
    g = a.units.find((u) => u.cardId === 9203),
    command = {
      unitId: g.unitId,
      abilityId: 'black-hole',
      cell: { x: 6, y: 3 },
      revision: a.revision,
    },
    before = JSON.stringify(a);
  for (let i = 0; i < 3; i++) assert.equal(previewAdventureAbility(a, command).ok, true);
  assert.equal(JSON.stringify(a), before);
  assert.equal(useAdventureAbility(a, command), true);
  save(a);
});
test('paired metadata/config, forged costs, charges, identity and events are refused', () => {
  const base = campaignMatch({ levelId: 'storm-09' });
  endTurn(base, 0);
  endTurn(base, 1);
  assert.equal(base.adventure.events.length, 1);
  for (const mutate of [
    (s) => delete s.adventure,
    (s) => delete s.enemyPlan.adventureVersion,
    (s) => s.adventure.revision++,
    (s) => (s.adventure.config.allies[0].cardId = 9211),
    (s) => (s.adventure.units[0].charge = 3),
    (s) => (s.adventure.units[0].usedTurn = 999),
    (s) => (s.adventure.events[0].damage = 7),
    (s) => (s.adventure.events[0].due = 99),
    (s) => (s.adventure.events[0].kind = 'meteor'),
    (s) => s.adventure.events[0].cells.push({ ...s.adventure.events[0].cells[0] }),
    (s) => (s.adventure.sources[0].unitId = s.adventure.units[0].unitId),
    (s) => (s.adventure.units[0].cardId = 9204),
    (s) => (s.adventure.reserves[9201] = 2),
    (s) => s.adventure.pending.push({ cardId: 9201, due: 2 }),
    (s) => (s.adventure.deployments = 3),
  ]) {
    const b = structuredClone(base);
    mutate(b);
    assert.equal(restoreMatch(b), null);
  }
});
test('half-life phase changes once; established event damage stays frozen', () => {
  let s = campaignMatch({ levelId: 'starfall-09' });
  endTurn(s, 0);
  endTurn(s, 1);
  const event = structuredClone(s.adventure.events[0]);
  const boss = findGeneral(s, 1);
  boss.health = 42;
  s.players[0].mana = 9;
  const source = s.units.find((u) => u.cardId === 9204);
  source.x = 5;
  source.y = 3;
  assert.equal(
    useAdventureAbility(s, {
      unitId: source.unitId,
      abilityId: 'meteor',
      cell: { x: 9, y: 3 },
      revision: s.revision,
    }),
    true,
  );
  assert.equal(s.adventure.phase, 1);
  assert.deepEqual(s.adventure.events[0], event);
  s = save(s);
  assert.equal(s.adventure.phase, 1);
});
test('storm09 frozen independent cannon restores, keeps prior damage across phase change and rejects forged source binding', () => {
  let s = campaignMatch({ levelId: 'storm-09' });
  for (let n = 0; n < 6; n++) assert.equal(endTurn(s, s.currentPlayer), true);
  const frozen = structuredClone(s.adventure.events[0]);
  assert.equal(frozen.kind, 'beam');
  assert.equal(frozen.damage, 6);
  s.adventure.phase = 1;
  findGeneral(s, 1).attack = 6;
  s = save(s);
  assert.deepEqual(s.adventure.events[0], frozen);
  const bad = structuredClone(s);
  bad.adventure.events[0].bound = true;
  bad.adventure.events[0].sources = [bad.adventure.sources[0].unitId];
  assert.equal(restoreMatch(bad), null);
  assert.equal(endTurn(s, 0), true);
  assert.equal(s.adventure.events.length, 0);
  s = save(s);
  assert.equal(endTurn(s, 1), true);
  s = save(s);
  assert.equal(s.adventure.events.length, 2);
  assert.ok(s.adventure.events.every((e) => e.kind === 'stormStrike'));
});
console.log(JSON.stringify({ passed: results.length, cases: results }, null, 2));
