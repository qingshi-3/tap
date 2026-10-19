import assert from 'node:assert/strict';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';
import { createExpeditionMatch } from '../dist/js/expedition-engine.js';
import { FACTIONS } from '../dist/js/factions.js';
import { CAMPAIGN_UNIT_IDS } from '../dist/js/campaign-rules.js';

const KEY = 'duelyst-h5.safe-v1.expedition';
const BACKUP_KEY = `${KEY}.legacy-v1-backup`;
class MemoryStorage {
  data = new Map([['duelyst-h5.safe-v1.namespace', '{"version":1}']]); writes = 0; failAt = 0;
  removeItem(key) { this.data.delete(key); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.writes += 1; if (this.writes === this.failAt) throw new Error('planned write failure'); this.data.set(key, value); }
}

const legacy = (overrides = {}) => ({
  schemaVersion: 1, coins: 321, training: { 9: 1, 11: 2, 14: 3, 15: 4, 16: 0, 17: 1 }, squad: [17, 16, 15],
  completed: [], activeBattle: null, settlements: {}, ...overrides
});

{
  const oldTraining = legacy().training;
  const activeBattle = createExpeditionMatch('border-01', oldTraining, [14, 9, 11], 1);
  activeBattle.schemaVersion = 3;
  activeBattle.training = { ...oldTraining };
  const storage = new MemoryStorage(), source = JSON.stringify(legacy({ activeBattle })); storage.data.set(KEY, source);
  const progress = new ExpeditionProgress(storage), state = progress.state;
  assert.equal(progress.error, ''); assert.equal(state.schemaVersion, 13); assert.equal(state.coins, 321);
  assert.deepEqual(state.squad, [17, 16, 15]); assert.deepEqual(state.factionSquads[1], [17, 16, 15]);
  assert.equal(state.training[14], 3); assert.equal(state.training[110], 0);
  assert.deepEqual(state.activeBattle, activeBattle, 'migration must preserve legacy schema-3 battles verbatim');
  assert.equal(storage.getItem(BACKUP_KEY), source, 'legacy bytes must be backed up before conversion');
  assert.equal(JSON.parse(storage.getItem(KEY)).schemaVersion, 13);
}

for (const failAt of [1, 2]) {
  const storage = new MemoryStorage(), source = JSON.stringify(legacy()); storage.data.set(KEY, source); storage.failAt = failAt;
  const progress = new ExpeditionProgress(storage);
  assert.match(progress.error, /迁移远征存档失败/); assert.equal(storage.getItem(KEY), source);
  assert.equal(progress.train(14).ok, false, 'failed migration must leave profile read-only');
}

{
  const storage = new MemoryStorage(), progress = new ExpeditionProgress(storage);
  for (const faction of FACTIONS) {
    assert.equal(progress.selectHero(faction.heroIds[0]).ok, true);
    assert.deepEqual(progress.state.squad, faction.defaultSquad);
    assert.deepEqual(progress.setSquad(faction.defaultSquad), { ok: true, squad: faction.defaultSquad });
  }
  assert.equal(Object.keys(progress.state.factionSquads).length, 6);
  assert.equal(progress.selectHero(1).ok, true);
  assert.equal(progress.setSquad([14, 9, 110]).ok, false, 'mixed-faction squads must be rejected');
  const before = progress.state, availability = progress.getTrainingAvailability(110);
  assert.ok(before.inventory.units.includes(110), 'cross-faction specimen must already be owned');
  assert.equal(availability.canTrain, true);
  const trained = progress.train(110);
  assert.equal(trained.ok, true, 'owned collection units can train independently of active faction');
  assert.equal(trained.cost, availability.cost);
  const expected = structuredClone(before);
  expected.coins -= availability.cost; expected.training[110] += 1;
  assert.deepEqual(progress.state, expected, 'training changes only this card rank and coins');
  let reloaded = new ExpeditionProgress(storage);
  assert.equal(reloaded.error, ''); assert.deepEqual(reloaded.state, expected);
  assert.equal(reloaded.train(14).ok, true, 'the active faction remains usable after cross-faction training');
  const continued = reloaded.state;
  assert.equal(continued.selectedHeroId, before.selectedHeroId);
  assert.deepEqual(continued.factionDecks, before.factionDecks);
  assert.deepEqual(continued.factionSquads, before.factionSquads);
  reloaded = new ExpeditionProgress(storage);
  assert.equal(reloaded.error, ''); assert.deepEqual(reloaded.state, continued);
  const unowned = CAMPAIGN_UNIT_IDS.find(id => !continued.inventory.units.includes(id));
  assert.ok(unowned, 'rejection specimen must be an actual unowned collection unit');
  for (const id of [unowned, 999999]) {
    const state = reloaded.state, raw = storage.getItem(KEY), writes = storage.writes;
    assert.equal(reloaded.getTrainingAvailability(id).canTrain, false);
    assert.equal(reloaded.train(id).ok, false, 'unowned and unknown IDs remain rejected');
    assert.deepEqual(reloaded.state, state); assert.equal(storage.getItem(KEY), raw); assert.equal(storage.writes, writes);
  }
}

{
  const storage = new MemoryStorage(), progress = new ExpeditionProgress(storage);
  assert.equal(progress.train(14).ok, true);
  const squad = [...progress.state.squad];
  assert.equal(progress.selectHero(23).ok, true);
  assert.equal(progress.state.training[14], 1); assert.deepEqual(progress.state.squad, squad);
  const active = createExpeditionMatch('border-01', progress.state.training, progress.state.squad, 1);
  assert.equal(progress.saveBattle(active).ok, true);
  assert.equal(progress.selectHero(101).ok, true);
  assert.equal(progress.state.activeBattle.players[0].generalId, 1, 'hero selection must not rewrite an active battle');
}

for (const raw of ['{bad json', JSON.stringify({ schemaVersion: 99, coins: 1 })]) {
  const storage = new MemoryStorage(); storage.data.set(KEY, raw);
  const progress = new ExpeditionProgress(storage);
  assert.ok(progress.error); assert.equal(progress.selectHero(1).ok, false); assert.equal(storage.getItem(KEY), raw); assert.equal(storage.writes, 0);
}

{
  const storage = new MemoryStorage(), progress = new ExpeditionProgress(storage);
  const match = createExpeditionMatch('border-01', progress.state.training, progress.state.squad, progress.state.selectedHeroId);
  match.runId = 'idempotent-run'; match.phase = 'over'; match.winner = 0; match.result = 'win';
  assert.equal(progress.settle(match).duplicate, false); const coins = progress.state.coins, writes = storage.writes;
  assert.equal(progress.settle(match).duplicate, true); assert.equal(progress.state.coins, coins); assert.equal(storage.writes, writes);
}

console.log('hero progress checks passed');
