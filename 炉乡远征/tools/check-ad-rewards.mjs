import assert from 'node:assert/strict';
import { ExpeditionProgress, normalizeExpeditionState, validateExpeditionState } from '../dist/js/expedition-progress.js';
import { createExpeditionMatch } from '../dist/js/expedition-engine.js';

const KEY = 'duelyst-h5.safe-v1.expedition';
const V2_BACKUP_KEY = `${KEY}.legacy-v2-backup`;
const IMPORT_BACKUP_KEY = `${KEY}.pre-import-backup`;

class MemoryStorage {
  data = new Map([['duelyst-h5.safe-v1.namespace', '{"version":1}']]); writes = 0; failWrites = false;
  removeItem(key) { this.data.delete(key); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { if (this.failWrites) throw new Error('planned failure'); this.writes += 1; this.data.set(key, value); }
}

function win(progress, runId, levelId = 'border-01') {
  const state = progress.state;
  const match = createExpeditionMatch(levelId, state.training, state.squad, state.selectedHeroId);
  match.runId = runId; match.phase = 'over'; match.winner = 0; match.result = 'win';
  return match;
}

{
 const storage=new MemoryStorage(),progress=new ExpeditionProgress(storage,{rng:()=>0});
 assert.equal(progress.dailyAdOffer('gold').eligible,true,'no victory required');
 assert.equal(progress.beginReward('missing','legacy').ok,false);
 assert.ok(progress.beginDailyAd('gold','request-a').ok);
 const reloaded=new ExpeditionProgress(storage);
 assert.equal(reloaded.completeDailyAd('gold','late-request').ok,false);
 assert.equal(reloaded.completeDailyAd('gold','request-a').amount,100);assert.equal(reloaded.state.coins,200);
 assert.ok(reloaded.completeDailyAd('gold','request-a').duplicate);assert.equal(reloaded.state.coins,200);
 assert.equal(reloaded.dailyAdOffer('gold').eligible,false);
}
{
 const storage=new MemoryStorage(),progress=new ExpeditionProgress(storage,{rng:()=>0});
 assert.ok(progress.beginDailyAd('gold','cancel-me').ok);assert.deepEqual(progress.cancelDailyAd('gold','cancel-me'),{ok:true,changed:true});assert.equal(progress.completeDailyAd('gold','cancel-me').ok,false);assert.equal(progress.state.coins,100);assert.equal(progress.dailyAdOffer('gold').eligible,true);
 assert.ok(progress.beginDailyAd('gold','atomic-request').ok);const before=progress.state;storage.failWrites=true;assert.equal(progress.completeDailyAd('gold','atomic-request').ok,false);assert.deepEqual(progress.state,before);
}

{
  const sourceStorage = new MemoryStorage(), sourceProgress = new ExpeditionProgress(sourceStorage);
  const v2 = sourceProgress.state; for (const key of ['giftCodeClaims','dailyAds','inventory','spellTraining','factionSpells','spellModes','specializations','recruitment','factionDecks','factionCompleted','legacyUnlockedLevels','growthVersion','accountStageClaims','factionChapterClaims','battleRewards']) delete v2[key]; delete v2.rewardClaims; v2.schemaVersion = 2; v2.coins = 777; v2.training = Object.fromEntries([9,11,14,15,16,17,110,115,109,213,211,214,308,317,311,406,412,410,505,506,503].map(id => [id, v2.training[id]]));
  const raw = ` ${JSON.stringify(v2)}\n`;
  const storage = new MemoryStorage(); storage.data.set(KEY, raw);
  const migrated = new ExpeditionProgress(storage);
  assert.equal(migrated.state.schemaVersion, 13); assert.equal(migrated.state.coins, 777);
  assert.deepEqual(migrated.state.rewardClaims, {}); assert.equal(storage.getItem(V2_BACKUP_KEY), raw);
  assert.equal(validateExpeditionState(v2), false);
  const normalized = normalizeExpeditionState(v2);
  assert.equal(normalized.schemaVersion, 13); assert.deepEqual(normalized.rewardClaims, {});
  assert.equal(v2.schemaVersion, 2, 'normalization must not mutate its input');
  assert.equal(normalizeExpeditionState({ ...v2, schemaVersion: 99 }), null);
}

{
  const storage = new MemoryStorage(), progress = new ExpeditionProgress(storage);
  let notifications = 0; const unsubscribe = progress.subscribe(() => { notifications += 1; });
  assert.equal(progress.train(14).ok, true);
  assert.equal(notifications, 1);
  const replacement = progress.state; replacement.coins = 432;
  const oldRaw = storage.getItem(KEY);
  assert.deepEqual(progress.replaceState(replacement), { ok: true, changed: true });
  assert.equal(storage.getItem(IMPORT_BACKUP_KEY), oldRaw);
  assert.equal(progress.state.coins, 432); assert.equal(notifications, 2);
  assert.deepEqual(progress.replaceState(replacement), { ok: true, changed: false });
  assert.equal(notifications, 2);
  unsubscribe(); progress.train(14); assert.equal(notifications, 2);
  const before = progress.state; const failed = { ...before, coins: 999 };
  storage.failWrites = true;
  assert.equal(progress.replaceState(failed).ok, false);
  assert.deepEqual(progress.state, before, 'failed import must not update memory');
}

console.log('ad reward checks passed');
