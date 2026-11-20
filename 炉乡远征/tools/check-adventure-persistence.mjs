import assert from 'node:assert/strict';
import { campaignMatch } from './battle-fixture.mjs';
import { ADVENTURE_LEVELS } from '../dist/js/adventure-content.js';
import { adventureFinishAction, adventureRules } from '../dist/js/adventure-system.js';
import {
  confirmMulligan,
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
const oldBossHealth = { 9222: 64, 9226: 84 };
function useOldAdventureBalance(match) {
  for (const table of Object.values(match.battleCards))
    for (const [id, health] of Object.entries(oldBossHealth)) table[id].health = health;
  const boss = findGeneral(match, 1), health = oldBossHealth[boss.cardId];
  if (health === undefined) return match;
  const plan = match.enemyPlan.players[1];
  plan.generalHealth = plan.garrison.find((unit) => unit.id === boss.cardId).health = health;
  boss.health = boss.maxHealth = health;
  match.adventure.config.boss.threshold = health / 2;
  return match;
}
test('old and new Starfall battles use their own boss stats and keep queued events frozen', () => {
  for (const [levelId, oldHealth, newHealth, attack2] of [
    ['starfall-03', 64, 56, 5],
    ['starfall-09', 84, 72, 6],
  ]) {
    for (const health of [oldHealth, newHealth]) {
      const threshold = health / 2;
      let match = campaignMatch({ levelId, mulligan: false });
      if (health === oldHealth) useOldAdventureBalance(match);
      match = save(match);
      assert.equal(match.phase, 'mulligan');
      const boss = findGeneral(match, 1);
      assert.deepEqual([boss.health, boss.maxHealth, match.adventure.config.boss.threshold], [health, health, threshold]);
      assert.match(adventureRules(match)[0].text, new RegExp(`${threshold}血及以下`));
      assert.equal(confirmMulligan(match), true);
      boss.health = threshold + 1;
      const nextPlayerTurn = () => {
        assert.equal(endTurn(match, 0), true);
        assert.equal(endTurn(match, 1), true);
        match = save(match);
        return match.adventure.events[0];
      };
      const gravity = nextPlayerTurn();
      assert.deepEqual([gravity.kind, gravity.rounds, match.adventure.phase], ['gravity', 1, 0]);
      const meteor = structuredClone(nextPlayerTurn());
      assert.deepEqual([meteor.kind, meteor.damage, match.adventure.phase], ['meteor', 4, 0]);
      findGeneral(match, 1).health = threshold;
      adventureFinishAction(match);
      match = save(match);
      assert.deepEqual([match.adventure.phase, findGeneral(match, 1).attack], [1, attack2]);
      assert.deepEqual(match.adventure.events[0], meteor);
      const nextGravity = nextPlayerTurn(), nextMeteor = nextPlayerTurn();
      assert.deepEqual([nextGravity.kind, nextGravity.rounds, nextMeteor.kind, nextMeteor.damage], ['gravity', 2, 'meteor', 6]);
      const continuedBoss = findGeneral(match, 1);
      assert.equal(continuedBoss.maxHealth, health);
      continuedBoss.maxHealth += 2;
      assert.equal(findGeneral(save(match), 1).maxHealth, health + 2);
    }
  }
  save(useOldAdventureBalance(campaignMatch({ levelId: 'storm-01', mulligan: false })));
});
test('mixed balance, forged cards, and inconsistent boss health are refused', () => {
  const base = useOldAdventureBalance(campaignMatch({ levelId: 'starfall-03', mulligan: false }));
  for (const mutate of [
    (match) => (match.battleCards[0][9222].health = 56),
    (match) => (match.battleCards[1][9226].health = 72),
    (match) => (match.battleCards[0][9222].attack++),
    (match) => (match.adventure.config.boss.threshold = 28),
    (match) => (match.adventure.config.boss.threshold = 31),
    (match) => (match.adventure.config.boss.attack2++),
    (match) => (match.enemyPlan.players[1].generalHealth = 56),
    (match) => (match.enemyPlan.players[1].garrison[0].health = 56),
    (match) => { const boss = findGeneral(match, 1); boss.health = boss.maxHealth + 1; },
  ]) {
    const invalid = structuredClone(base);
    mutate(invalid);
    assert.equal(restoreMatch(invalid), null);
  }
});
test('both boss balance versions reject missing, swapped, and mixed-health opening bosses', () => {
  for (const [levelId, oldHealth, newHealth, otherBoss] of [
    ['starfall-03', 64, 56, 9226],
    ['starfall-09', 84, 72, 9222],
  ]) {
    for (const useOld of [true, false]) {
      const base = campaignMatch({ levelId, mulligan: false });
      if (useOld) useOldAdventureBalance(base);
      assert.ok(restoreMatch(structuredClone(base)));
      for (const mutate of [
        (match, boss) => (boss.cardId = otherBoss),
        (match, boss) => (match.units = match.units.filter(unit => unit.unitId !== boss.unitId)),
        (match, boss) => (boss.health = boss.maxHealth = useOld ? newHealth : oldHealth),
      ]) {
        const invalid = structuredClone(base);
        mutate(invalid, findGeneral(invalid, 1));
        assert.equal(restoreMatch(invalid), null);
      }
    }
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
