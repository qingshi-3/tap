import assert from 'node:assert/strict';
import { createGame } from '../dist/simulation.js';
import { buildUpgradePool, applyGrowthUpgrade, makeUpgradeChoices } from '../dist/growth.js';
import { getCommonUnlocks, getUnlockedCommonIds } from '../dist/common-unlocks.js';
import { loadProfile, settleRun, validateProfile } from '../dist/campaign.js';
import { WEAPONS } from '../dist/combat-content.js';

const storage = new Map();
let failSave = false;
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => { if (failSave) throw new Error('isolated storage failure'); storage.set(key, String(value)); },
};
const profile = loadProfile().profile;
assert(validateProfile(profile));
const snapshot = () => { const game = createGame(); game.availableCommonIds = getUnlockedCommonIds(profile); return game; };
const acquisitions = game => buildUpgradePool(game).filter(choice => choice.category === 'common' && !game.upgrades[choice.weaponId]).map(choice => choice.weaponId);
const initial = snapshot();
assert.deepEqual(acquisitions(initial), ['orb', 'orbit', 'nova']);
assert.equal(applyGrowthUpgrade(initial, 'common:dagger'), false);
for (let i = 0; i < 50; i++) {
  const choices = makeUpgradeChoices(initial, () => i / 50);
  assert(choices.filter(choice => choice.category === 'common').every(choice => initial.availableCommonIds.includes(choice.weaponId)));
}
const settle = (id, kills, victory = false, dungeonId = 'moss-gate') => settleRun(profile, { id, kills, victory, dungeonId, time: 360 });
assert(settle('before-threshold', 249).ok);
assert.equal(getCommonUnlocks(profile).find(row => row.id === 'dagger').progress, 249);
assert(!acquisitions(snapshot()).includes('dagger'));
failSave = true;
assert.equal(settle('failed-threshold', 1).ok, false);
assert(!getUnlockedCommonIds(profile).includes('dagger'));
failSave = false;
assert(settle('at-threshold', 1).ok);
assert(acquisitions(snapshot()).includes('dagger'));
assert(!acquisitions(initial).includes('dagger'), 'in-flight snapshot stays stable');
assert(settle('at-threshold', 1).ok);
assert.equal(profile.progression.kills, 250, 'duplicate settlement cannot add unlock progress');
assert(settle('moss-clear', 0, true).ok);
assert(getUnlockedCommonIds(profile).includes('lightning'));
assert(settle('ember-clear', 0, true, 'ember-trail').ok);
assert(getUnlockedCommonIds(profile).includes('meteor'));
assert(settle('third-win', 0, true).ok);
assert(getUnlockedCommonIds(profile).includes('beam'));
for (let i = 4; i <= 6; i++) assert(settle(`win-${i}`, 0, true).ok);
assert(getUnlockedCommonIds(profile).includes('familiar'));
assert(settle('full-kill-progression', 3750).ok);
assert.equal(getUnlockedCommonIds(profile).length, WEAPONS.length);
assert(validateProfile(profile), 'derived unlocks retain strict save schema');
assert.deepEqual(getUnlockedCommonIds(loadProfile().profile), getUnlockedCommonIds(profile), 'saved profile reload preserves unlocks');
const owned = createGame(); owned.availableCommonIds = []; owned.upgrades.dagger = 1;
assert(applyGrowthUpgrade(owned, 'common:dagger'));
assert(applyGrowthUpgrade(owned, 'common:dagger'));
assert(applyGrowthUpgrade(owned, 'common:dagger'));
assert(applyGrowthUpgrade(owned, 'common:dagger'));
owned.growth.area=1;owned.time=90;
assert.equal(buildUpgradePool(owned).filter(choice => choice.weaponId === 'dagger' && choice.category === 'evolution').length, 2);
assert(applyGrowthUpgrade(owned, 'evolve:dagger:a'));
assert.deepEqual(acquisitions(createGame()), WEAPONS.map(weapon => weapon.id), 'standalone simulation keeps full pool');
assert.deepEqual(acquisitions(Object.assign(createGame(), { availableCommonIds: [] })), []);
console.log('Common unlock behavior verified: initial pool, saved thresholds, failed/duplicate settlement, reload, run snapshot, owned upgrades/evolution, legacy simulation.');
