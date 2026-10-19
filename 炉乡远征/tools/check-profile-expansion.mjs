import assert from 'node:assert/strict';
import { ExpeditionProgress, normalizeExpeditionState } from '../dist/js/expedition-progress.js';
import { createExpeditionMatch } from '../dist/js/expedition-engine.js';
import { TRAINABLE_IDS } from '../dist/js/expedition-data.js';
import { PlayerCloud } from '../dist/js/player-cloud.js';
const KEY = 'duelyst-h5.safe-v1.expedition', META = 'duelyst-h5.safe-v1.cloud-meta';
const OLD_UNITS = {1:[14,9,15,16,11,17],2:[110,115,109],3:[213,211,214],4:[308,317,311],5:[406,412,410],6:[505,506,503]};
const OLD_IDS = Object.values(OLD_UNITS).flat();
class Storage {
  data = new Map([['duelyst-h5.safe-v1.namespace', '{"version":1}']]); writes = 0; failAt = 0;
  getItem(k) { return this.data.get(k) ?? null; }
  setItem(k,v) { if (++this.writes === this.failAt) throw Error('planned failure'); this.data.set(k,String(v)); }
  removeItem(k) { this.data.delete(k); }
}
function legacy(version) {
  const state = new ExpeditionProgress(new Storage()).state;
  state.schemaVersion = version; state.coins = 713;
  for (const key of ['giftCodeClaims','dailyAds','inventory','spellTraining','factionSpells','spellModes','specializations','recruitment','factionDecks','factionCompleted','legacyUnlockedLevels','growthVersion','accountStageClaims','factionChapterClaims','battleRewards']) delete state[key];
  state.training = Object.fromEntries(OLD_IDS.map((id,i) => [id,i%5]));
  state.selectedHeroId = 123;
  state.factionSquads = Object.fromEntries(Object.entries(OLD_UNITS).map(([id,units]) => [id,units.slice(-3).reverse()]));
  state.squad = [...state.factionSquads[2]];
  state.completed = ['border-01','border-02'];
  state.settlements = {'old-run': {levelId:'border-01',amount:100,firstClear:true}};
  state.rewardClaims = {'old-run':{status:'pending',requestId:'old-request',levelId:'border-01',amount:25}};
  state.activeBattle = createExpeditionMatch('border-02',state.training,[110,115,109],123);
  state.activeBattle.training = {...state.training};
  if(version===2) delete state.rewardClaims;
  return state;
}
for (const version of [2,3]) {
  const old = legacy(version), raw = `  ${JSON.stringify(old)}\n`;
  const storage = new Storage(); storage.data.set(KEY,raw);
  const progress = new ExpeditionProgress(storage), next = progress.state;
  assert.equal(progress.error,''); assert.equal(next.schemaVersion,13);
  assert.equal(storage.getItem(`${KEY}.legacy-v${version}-backup`),raw);
  for(const field of ['coins','selectedHeroId','factionSquads','squad','completed','settlements','activeBattle']) assert.deepEqual(next[field],old[field],field);
  assert.deepEqual(next.rewardClaims,old.rewardClaims ?? {});
  for(const id of TRAINABLE_IDS) assert.equal(next.training[id],old.training[id] ?? 0);
  if(version===3) { assert.equal(progress.completeReward('old-run','old-request').ok,false); assert.equal(progress.state.coins,713); assert.equal(progress.state.rewardClaims['old-run'].amount,25); }
  for(const failAt of [1,2]) {
    const failed = new Storage(); failed.data.set(KEY,raw); failed.failAt=failAt;
    const rejected = new ExpeditionProgress(failed);
    assert.match(rejected.error,/迁移/); assert.equal(failed.getItem(KEY),raw); assert.equal(rejected.selectHero(1).ok,false);
  }
  const invalid = structuredClone(old); invalid.training[99999]=0;
  assert.equal(normalizeExpeditionState(invalid),null,'old roster contract rejects unknown IDs');
}
// A schema-3 cloud envelope and its historical baseline normalize together without a false conflict.
{
  const old=legacy(3), data={expedition:old,campaign:null,match:null};
  const storage=new Storage(); storage.data.set(KEY,JSON.stringify(old));
  storage.data.set(META,JSON.stringify({schemaVersion:1,token:'old-token',fingerprint:JSON.stringify(data),baseData:data,syncedAt:100}));
  new ExpeditionProgress(storage);
  const envelope={game:'duelyst-h5',appId:970030,schemaVersion:1,saveId:'123e4567-e89b-42d3-a456-426614174000',savedAt:100,data};
  let writes=0;
  const cloud=new PlayerCloud({storage,transport:{available:true,async read(){return {token:'old-token',data:structuredClone(envelope)};},async write(){writes++;throw Error('unexpected write');}}});
  assert.equal((await cloud.initialize()).ok,true); assert.equal(cloud.state.status,'synced'); assert.equal(writes,0); cloud.dispose();
  const empty=new Storage(), restored=new PlayerCloud({storage:empty,transport:{available:true,async read(){return {token:'old-token',data:structuredClone(envelope)};}}});
  assert.equal((await restored.initialize()).ok,true);
  assert.deepEqual(JSON.parse(empty.getItem(KEY)),normalizeExpeditionState(old)); restored.dispose();
}
console.log('profile roster expansion checks passed: old profile bytes, active battle, reward claims, failed writes, cloud baseline and restore');

