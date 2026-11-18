import assert from 'node:assert/strict';
import { createExpeditionMatch, confirmMulligan, autoAct, restoreMatch, validateMatch } from '../dist/js/engine.js';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';
import { EXPEDITION_LEVELS } from '../dist/js/expedition-data.js';
import { ORIGINAL_CAMPAIGN_LEVEL_IDS } from '../dist/js/adventure-access.js';
import { getHero, getFaction } from '../dist/js/factions.js';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';

// Disposable storage exercises the product persistence boundary, not just JSON
// parsing. Each checkpoint must support another action and another saved update.
class Memory {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

let checkpoints = 0, actions = 0, forecasts = 0;
const outcomes = [];
// v1 belongs to the 30 published encounters. New adventure rules have their own
// full save/action/reload gate; appending content must not rewrite this contract.
assert.equal(ORIGINAL_CAMPAIGN_LEVEL_IDS.length, 30);
const originalLevels = ORIGINAL_CAMPAIGN_LEVEL_IDS.map(id => EXPEDITION_LEVELS.find(level => level.id === id));
assert.ok(originalLevels.every(Boolean), 'all 30 historical encounter IDs must remain available');
for (const level of originalLevels) {
  const memory = new Memory();
  let progress = new ExpeditionProgress(memory);
  const profile = progress.state;
  profile.legacyUnlockedLevels = [...ORIGINAL_CAMPAIGN_LEVEL_IDS];
  memory.setItem(SAVE_KEYS.expedition, JSON.stringify(profile));
  progress = new ExpeditionProgress(memory);
  const hero = profile.selectedHeroId;
  const faction = getFaction(getHero(hero).faction);
  let battle = createExpeditionMatch(level.id, profile.training, profile.squad, hero, {
    deck: profile.factionDecks[faction.id], spells: profile.factionSpells[faction.id],
    spellTraining: profile.spellTraining, spellModes: profile.spellModes,
    specializations: profile.specializations, growthVersion: profile.growthVersion,
  }, { encounters: true });
  assert.equal(battle.encounter?.version, 1, level.id);

  function checkpoint() {
    assert.ok(validateMatch(battle), `${level.id}: invalid live state`);
    const before = structuredClone(battle);
    const saved = progress.saveBattle(battle);
    assert.ok(saved.ok, `${level.id}: save failed: ${saved.error}`);
    const raw = memory.getItem(SAVE_KEYS.expedition);
    progress = new ExpeditionProgress(memory);
    assert.equal(progress.error, '', `${level.id}: profile reload failed`);
    const active = progress.state.activeBattle;
    assert.ok(active, `${level.id}: battle missing after reload`);
    battle = restoreMatch(structuredClone(active));
    assert.ok(battle, `${level.id}: restored battle invalid`);
    before.selectedUnitId = null;
    assert.deepEqual(battle, before, `${level.id}: state changed across save/reload`);
    assert.equal(memory.getItem(SAVE_KEYS.expedition), raw, 'reading must not rewrite the profile');
    checkpoints++;
  }

  checkpoint();
  assert.ok(confirmMulligan(battle));
  for (let step = 0; step < 220 && battle.phase !== 'over' && battle.round <= 7; step++) {
    assert.ok(autoAct(battle), `${level.id}: action rejected`);
    actions++;
    assert.ok(validateMatch(battle), `${level.id}: invalid after action ${step}`);
    if (battle.encounter.events.length) forecasts++;
    if (step % 9 === 0 || battle.encounter.events.length && step % 4 === 0) checkpoint();
  }
  checkpoint();
  // A second save after continued gameplay is required; mere parsing is not a
  // successful update loop. Non-terminal samples take one more real action.
  if (battle.phase !== 'over') { assert.ok(autoAct(battle)); actions++; }
  checkpoint();
  const missingRuntime = structuredClone(battle);
  delete missingRuntime.encounter;
  assert.equal(validateMatch(missingRuntime), false, `${level.id}: missing runtime accepted`);
  const missingPlanVersion = structuredClone(battle);
  delete missingPlanVersion.enemyPlan.encounterVersion;
  assert.equal(validateMatch(missingPlanVersion), false, `${level.id}: missing version accepted`);
  const unknownVersion = structuredClone(battle);
  unknownVersion.encounter.version++;
  assert.equal(validateMatch(unknownVersion), false, `${level.id}: future version accepted`);
  outcomes.push({ levelId: level.id, round: battle.round, result: battle.result });
}
assert.ok(forecasts > 0, 'the update loops must include saved forecasts');
assert.equal(outcomes.length, 30, 'retain all original encounter continuation loops');
console.log(JSON.stringify({ check: 'encounter-persistence-v1', passed: true,
  levels: outcomes.length, actions, checkpoints, actionsWithForecasts: forecasts }));
