import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {STORAGE_KEY as KEY,LEGACY_STORAGE_KEY as OLD,PROFILE_SCHEMA_VERSION,loadProfile,saveProfile,migrateLegacyProfile,validateProfile,getSaveContentIds,upgradeBuilding,trainHero,getHeroTrainingCost,settleRun,grantAdGoldBonus,claimDailyCheckin,grantDailyCheckinBonus,restoreCloudProfile} from '../dist/campaign.js';
import {CloudSave,CLOUD_SLOT,LEGACY_CLOUD_SLOT,validCloudEnvelope} from '../dist/cloud-save.js';
const copy=v=>JSON.parse(JSON.stringify(v));
// Independent expected additions for this content update. Frozen published samples
// remain byte-for-byte intact; every old field must still match exactly.
const addedHeroDefaults={
  sword:{level:1,experience:0,job:'sword_apprentice',unlockedJobs:['sword_apprentice'],skillLoadout:['swordFocus','swordRecall','swordUnion']},
  spiral:{level:1,experience:0,job:'shadow_novice',unlockedJobs:['shadow_novice'],skillLoadout:['spiralOrb','spiralClone','spiralConvergence']},
  petal:{level:1,experience:0,job:'petal_apprentice',unlockedJobs:['petal_apprentice'],skillLoadout:['petalSweep','petalPierce','petalBloom']},
  grappler:{level:1,experience:0,job:'brawler',unlockedJobs:['brawler'],skillLoadout:['grappleHook','grappleSlam','grappleClash']},
  rift:{level:1,experience:0,job:'rift_apprentice',unlockedJobs:['rift_apprentice'],skillLoadout:['riftGate','riftStep','riftBarrage']},
  magnet:{level:1,experience:0,job:'scrap_apprentice',unlockedJobs:['scrap_apprentice'],skillLoadout:['magnetField','magnetLance','magnetCrush']},
};
function expectedHeroAddition(profile){const expected=copy(profile);expected.heroes={...copy(addedHeroDefaults),...expected.heroes};return expected;}
const fixtureRoot=new URL('fixtures/save/',import.meta.url);
const reportPath=new URL('../output/save-compatibility/report.json',import.meta.url);
const runId=process.env.SAVE_COMPATIBILITY_RUN_ID||`standalone-${Date.now()}`;
const startedAt=new Date().toISOString();
await mkdir(new URL('../output/save-compatibility/',import.meta.url),{recursive:true});
// Invalidate an earlier successful standalone report before any test can fail.
await writeFile(reportPath,JSON.stringify({passed:false,runId,status:'running',startedAt},null,2)+'\n');
const sources=JSON.parse(await readFile(new URL('sources.json',fixtureRoot),'utf8'));
const report={contractVersion:2,profileSchema:PROFILE_SCHEMA_VERSION,localKey:KEY,cloudSlot:CLOUD_SLOT,scope:'Single-device update round trips in isolated memory storage; existing cloud callback checks retained without new cross-device behavior. No real player data or platform writes.',preserved:['gold','materials','roster','squad','buildings','cleared','settledRuns','lastReward','existing hero progress','existing progression','optional dailyCheckin'],migrationAdditions:['Default missing heroes and selection','Legacy without progression: active cleared dungeon wins inferred as one, kills/claimed quests initialized'],limits:['No saved active battle','No bidirectional v1/v2 merge','localStorage has no cross-process atomic CAS; existing cloud service limits unchanged'],fixtures:[],roundTripDetails:[],cases:[]};
class Storage {
  constructor(){this.data=new Map();this.readFail=null;this.writeFail=null;this.afterWrite=null;this.writes=[];}
  getItem(k){if(this.readFail?.(k))throw Error('injected read failure');return this.data.get(k)??null;}
  setItem(k,v){if(this.writeFail?.(k))throw Error('injected write failure');this.data.set(k,String(v));this.writes.push(k);this.afterWrite?.(k,v);}
}
function setup(){const storage=new Storage();globalThis.localStorage=storage;return storage;}
function fresh(){const storage=setup(),profile=loadProfile().profile;assert(profile);return {storage,profile};}
async function test(name,fn){await fn();report.cases.push({name,passed:true});}
const fixtures=[];
const historicalShape=p=>!p.heroes?'warband':p.selectedHero?'four-heroes':p.progression?'commander-growth':p.heroes.commander.job?'commander-job':'commander-level';
for(const source of sources){
  const bytes=await readFile(new URL(source.file,fixtureRoot));assert.equal(createHash('sha256').update(bytes).digest('hex'),source.fixtureSha256,'Frozen fixtures must not be silently regenerated');
  fixtures.push({source,profile:JSON.parse(bytes)});report.fixtures.push({file:source.file,sha256:source.fixtureSha256,source:source.source,shape:historicalShape(JSON.parse(bytes))});
}
report.historicalShapes=[...new Set(fixtures.map(f=>historicalShape(f.profile)))].sort();
assert.deepEqual(report.historicalShapes,['commander-growth','commander-job','commander-level','four-heroes','warband'],'Every supported historical shape needs a frozen fixture');
const storageContract=JSON.parse(await readFile(new URL('storage-contract-v2.json',fixtureRoot),'utf8'));
const currentSources=JSON.parse(await readFile(new URL('current-sources.json',fixtureRoot),'utf8')),currentFixtures=[];
for(const source of currentSources){
  const bytes=await readFile(new URL(source.file,fixtureRoot));assert.equal(createHash('sha256').update(bytes).digest('hex'),source.fixtureSha256);
  const profile=JSON.parse(bytes);currentFixtures.push({source,profile});report.fixtures.push({file:source.file,sha256:source.fixtureSha256,source:source.source,shape:profile.dailyCheckin?'v2-daily':'v2-optional-free'});
}
await test('published storage location and schema stay fixed across ordinary package updates',()=>{
  assert.equal(KEY,storageContract.localKey);assert.equal(OLD,storageContract.legacyLocalKey);assert.equal(PROFILE_SCHEMA_VERSION,storageContract.profileSchema);assert.equal(CLOUD_SLOT,storageContract.cloudSlot);assert.equal(LEGACY_CLOUD_SLOT,storageContract.legacyCloudSlot);
  for(const {profile:p} of currentFixtures){assert.equal(p.version,storageContract.profileSchema);assert(validCloudEnvelope({game:storageContract.game,app:storageContract.app,schemaVersion:storageContract.profileSchema,slotId:storageContract.cloudSlot,savedAt:'2026-10-12T04:00:00Z',revision:'contract-fixture',profile:p}));}
});
function reloadExact(s,expected){const raw=s.getItem(storageContract.localKey),writes=s.writes.length;assert.deepEqual(JSON.parse(raw),expected);const loaded=loadProfile();assert.equal(loaded.error,null);assert.deepEqual(loaded.profile,expected);assert.equal(s.getItem(storageContract.localKey),raw);assert.equal(s.writes.length,writes,'ordinary reload must not re-migrate or rewrite');return loaded.profile;}
function playableRoundTrip(p,s,label){
  const initial=copy(p),cost=getHeroTrainingCost(p),heroId=p.selectedHero;assert(cost);
  assert(trainHero(p).ok,`${label}: training after update`);const expected=copy(initial);expected.gold-=cost.gold;expected.materials-=cost.materials;expected.heroes[heroId].level++;if(expected.heroes[heroId].level===30)expected.heroes[heroId].experience=0;assert.deepEqual(p,expected,'training must retain every unrelated existing field');
  p=reloadExact(s,expected);
  const run={id:`update-roundtrip-${label}`,heroId,dungeonId:'moss-gate',victory:true,kills:31,time:360},before=copy(p),settled=settleRun(p,run);assert(settled.ok);assert.equal(p.gold,before.gold+settled.reward.gold);assert.equal(p.materials,before.materials+settled.reward.materials);assert.equal(p.progression.kills,before.progression.kills+31);assert.equal(p.progression.dungeonWins['moss-gate'],(before.progression.dungeonWins['moss-gate']||0)+1);assert.deepEqual(p.progression.claimedQuests,before.progression.claimedQuests);assert.deepEqual(p.dailyCheckin,before.dailyCheckin);
  for(const field of ['roster','squad','buildings'])assert.deepEqual(p[field],before[field]);for(const id of before.cleared)assert(p.cleared.includes(id));for(const id of before.settledRuns)assert(p.settledRuns.includes(id));
  for(const [id,hero] of Object.entries(before.heroes)){assert.equal(p.heroes[id].job,hero.job);assert.deepEqual(p.heroes[id].unlockedJobs,hero.unlockedJobs);assert.deepEqual(p.heroes[id].skillLoadout,hero.skillLoadout);if(id!==heroId)assert.deepEqual(p.heroes[id],hero);}
  const totalExperience=hero=>100*hero.level*(hero.level-1)/2+hero.experience;
  assert.equal(totalExperience(p.heroes[heroId]),totalExperience(before.heroes[heroId])+settled.reward.xp,'settlement adds XP instead of replacing existing growth');
  p=reloadExact(s,copy(p));let raw=s.getItem(KEY),snapshot=copy(p);assert(settleRun(p,run).ok);assert.deepEqual(p,snapshot);assert.equal(s.getItem(KEY),raw,'reloaded run must not pay twice');
  const bonus=grantAdGoldBonus(p,run.id);assert(bonus.ok);assert.equal(p.gold,snapshot.gold+Math.floor(settled.reward.gold*.5));assert.equal(p.materials,snapshot.materials+Math.floor(settled.reward.materials*.25));p=reloadExact(s,copy(p));raw=s.getItem(KEY);snapshot=copy(p);assert(grantAdGoldBonus(p,run.id).ok);assert.deepEqual(p,snapshot);assert.equal(s.getItem(KEY),raw,'reloaded ad reward must not pay twice');
  const continuedCost=getHeroTrainingCost(p);assert(trainHero(p).ok,`${label}: continue playing after reload`);const continued=copy(snapshot);continued.gold-=continuedCost.gold;continued.materials-=continuedCost.materials;continued.heroes[heroId].level++;if(continued.heroes[heroId].level===30)continued.heroes[heroId].experience=0;assert.deepEqual(p,continued,'continued play preserves all unrelated progress and optional data');assert.deepEqual(p.dailyCheckin,initial.dailyCheckin);assert(saveProfile(p).ok);reloadExact(s,continued);
  report.roundTripDetails.push({label,passed:true,sequence:['load/migrate','trainHero+persist','reload unchanged','settleRun+persist','reload+duplicate rejected','ad reward+persist','reload+duplicate rejected','continue trainHero+save','reload unchanged']});
}
await test('every frozen historical save remains playable after migration, saving and re-entry',()=>{
  for(const {source,profile:legacy} of fixtures){const s=setup(),raw=JSON.stringify(legacy,null,2);s.data.set(storageContract.legacyLocalKey,raw);const p=loadProfile().profile;assert(p);const snapshot=copy(p),runId=legacy.settledRuns[0];if(runId){assert(settleRun(p,{id:runId,heroId:p.selectedHero,dungeonId:'moss-gate',victory:true,kills:0,time:360}).ok);assert.deepEqual(p,snapshot,'existing historical reward must not replay');}playableRoundTrip(p,s,source.file);assert.equal(s.getItem(storageContract.legacyLocalKey),raw);assert.equal(s.getItem(`${storageContract.localKey}.imported-v1`),raw);}
});
await test('published v2 optional-free and daily saves update in place without losing optional data',()=>{
  for(const {source,profile:seed} of currentFixtures){const s=setup(),raw=JSON.stringify(seed,null,2);s.data.set(storageContract.localKey,raw);s.data.set(storageContract.legacyLocalKey,'intentionally unreadable legacy');s.readFail=k=>k===storageContract.legacyLocalKey;const p=loadProfile().profile;assert.deepEqual(p,expectedHeroAddition(seed),'only the six specified default heroes may be added; all published progress and optional fields are exact');assert.equal(s.writes.length,0,'v2 content additions must not write until an explicit save transaction');assert.equal(s.getItem(KEY),raw,'loading preserves original published bytes');playableRoundTrip(p,s,source.file);assert(!s.data.has(`${storageContract.localKey}.imported-v1`));assert.equal(s.data.get(storageContract.legacyLocalKey),'intentionally unreadable legacy');
    if(seed.dailyCheckin){const now=Date.parse(`${seed.dailyCheckin.day}T04:00:00Z`),current=loadProfile().profile,before=copy(current),saved=s.getItem(KEY);assert(!claimDailyCheckin(current,now).ok);assert(!grantDailyCheckinBonus(current,seed.dailyCheckin.day,now).ok);assert.deepEqual(current,before);assert.equal(s.getItem(KEY),saved);}
  }
});
await test('read, backup and write failures can be cleared then re-entered for continued play',()=>{
  for(const kind of ['current-read','legacy-read','import-backup','import-write','import-after']){const s=setup(),legacy=fixtures.at(-1).profile,raw=JSON.stringify(legacy);s.data.set(storageContract.legacyLocalKey,raw);s.readFail=k=>kind==='current-read'?k===KEY:kind==='legacy-read'&&k===OLD;s.writeFail=k=>kind==='import-backup'?k.includes('imported-v1'):kind==='import-write'&&k===KEY;s.afterWrite=k=>{if(kind==='import-after'&&k===KEY)throw Error('committed then threw');};assert.equal(loadProfile().profile,null);assert.equal(s.data.get(OLD),raw);s.readFail=null;s.writeFail=null;s.afterWrite=null;const recovered=loadProfile().profile;assert(recovered);playableRoundTrip(recovered,s,`recovered-${kind}`);assert.equal(s.getItem(OLD),raw);}
  for(const kind of ['backup','write','after']){const {storage:s,profile:p}=fresh();p.gold=999;p.materials=999;assert(saveProfile(p).ok);const before=copy(p),raw=s.getItem(KEY);s.writeFail=k=>kind==='backup'?k===`${KEY}.before-write`:kind==='write'&&k===KEY;s.afterWrite=k=>{if(kind==='after'&&k===KEY)throw Error('committed then threw');};assert(!trainHero(p).ok);assert.deepEqual(p,before);s.writeFail=null;s.afterWrite=null;const recovered=loadProfile().profile;assert(recovered);if(kind==='after')assert.equal(s.getItem(`${KEY}.before-write`),raw);else assert.deepEqual(recovered,before);playableRoundTrip(recovered,s,`recovered-play-${kind}`);}
});
await test('frozen historical schemas migrate without changing original bytes or progress',()=>{
  for(const {profile:legacy} of fixtures){
    const s=setup(),raw=JSON.stringify(legacy,null,2);s.data.set(OLD,raw);const result=loadProfile();assert.equal(result.error,null);const p=result.profile;assert(validateProfile(p));assert.equal(p.version,2);
    for(const field of ['gold','materials','roster','squad','buildings','cleared','settledRuns','lastReward'])assert.deepEqual(p[field],legacy[field],field);
    if(legacy.progression)assert.deepEqual(p.progression,legacy.progression);
    if(legacy.heroes?.commander){for(const [field,value] of Object.entries(legacy.heroes.commander))assert.deepEqual(p.heroes.commander[field],value);}
    if(legacy.selectedHero){assert.equal(p.selectedHero,legacy.selectedHero);assert.deepEqual(p.heroes,expectedHeroAddition(legacy).heroes,'all four historical heroes preserved exactly, only specified new defaults added');}
    assert.equal(s.getItem(OLD),raw);assert.equal(s.getItem(`${KEY}.imported-v1`),raw);assert(!s.writes.includes(OLD));
    const before=s.getItem(KEY);s.data.set(OLD,'old page overwrote legacy');assert.equal(loadProfile().profile.gold,p.gold);assert.equal(s.getItem(KEY),before);
  }
});
await test('saved content identifiers cannot disappear without explicit compatibility work',async()=>{
  const frozen=JSON.parse(await readFile(new URL('content-ids.json',fixtureRoot),'utf8')),current=getSaveContentIds();
  for(const [kind,ids] of Object.entries(frozen))for(const id of ids)assert(current[kind].includes(id),`Saved ${kind} ID removed: ${id}`);
  const p=migrateLegacyProfile(fixtures.at(-1).profile);p.cleared.push('iron-quarry','moon-ruins');p.progression.dungeonWins['iron-quarry']=2;p.progression.dungeonWins['moon-ruins']=4;assert(validateProfile(p));
  assert.equal(migrateLegacyProfile({...p,version:1}),null,'a ten-hero v1 shape never existed and must not be guessed as a supported legacy format');
});
await test('unknown, damaged, additional-field v2 never falls back to healthy v1 or accepts stale writer',()=>{
  for(const kind of ['future','extra','damaged']){
    const {storage:s,profile:p}=fresh();s.data.set(OLD,JSON.stringify(fixtures[0].profile));const bad=kind==='damaged'?'{bad':JSON.stringify({...p,...(kind==='future'?{version:99}:{futureField:true})});s.data.set(KEY,bad);s.writes=[];
    assert.equal(loadProfile().profile,null);assert(!saveProfile(p).ok);assert(!upgradeBuilding(p,'hall').ok);assert.equal(s.getItem(KEY),bad);assert.equal(s.writes.length,0);
  }
});
await test('unknown legacy does not initialize new profile',()=>{
  for(const p of [{...fixtures[0].profile,version:99},{...fixtures[0].profile,future:true},'{broken']){const s=setup(),raw=typeof p==='string'?p:JSON.stringify(p);s.data.set(OLD,raw);assert.equal(loadProfile().profile,null);assert.equal(s.getItem(KEY),null);assert.equal(s.getItem(OLD),raw);assert.equal(s.writes.length,0);}
});
await test('read and import backup failures never create or replace profile',()=>{
  for(const kind of ['current-read','legacy-read','backup','write']){const s=setup(),raw=JSON.stringify(fixtures[0].profile);s.data.set(OLD,raw);s.readFail=k=>kind==='current-read'?k===KEY:kind==='legacy-read'&&k===OLD;s.writeFail=k=>kind==='backup'?k.includes('imported-v1'):kind==='write'&&k===KEY;assert.equal(loadProfile().profile,null);assert.equal(s.data.get(OLD),raw);assert(!s.data.has(KEY));}
});
await test('migration write-then-throw retains legacy bytes and recovery backup',()=>{
  const s=setup(),raw=JSON.stringify(fixtures.at(-1).profile);s.data.set(OLD,raw);s.afterWrite=k=>{if(k===KEY)throw Error('migration write committed then threw');};
  assert.equal(loadProfile().profile,null);assert.equal(s.getItem(OLD),raw);assert.equal(s.getItem(`${KEY}.imported-v1`),raw);assert(validateProfile(JSON.parse(s.getItem(KEY))));s.afterWrite=null;assert.equal(loadProfile().profile.gold,fixtures.at(-1).profile.gold);
});
await test('intervening writes during migration or local save retain the external value',()=>{
  {const s=setup(),raw=JSON.stringify(fixtures[0].profile),changed=JSON.stringify({...fixtures[0].profile,gold:888});s.data.set(OLD,raw);s.afterWrite=k=>{if(k.includes('imported-v1'))s.data.set(OLD,changed);};assert.equal(loadProfile().profile,null);assert.equal(s.getItem(OLD),changed);assert.equal(s.getItem(KEY),null);}
  for(const phase of ['backup','write']){const {storage:s,profile:p}=fresh();p.materials=999;assert(saveProfile(p).ok);const before=copy(p),external=JSON.stringify({...p,gold:888});s.afterWrite=k=>{if(k===(phase==='backup'?`${KEY}.before-write`:KEY))s.data.set(KEY,external);};assert(!upgradeBuilding(p,'hall').ok);assert.deepEqual(p,before);assert.equal(s.getItem(KEY),external);}
});
await test('two loaded pages, detached objects and legacy code cannot overwrite current progress',()=>{
  const {storage:s,profile:a}=fresh(),b=loadProfile().profile;a.gold=999;assert(saveProfile(a).ok);const before=s.getItem(KEY),old=copy(b);assert(!upgradeBuilding(b,'hall').ok);assert.deepEqual(b,old);assert(!saveProfile(copy(a)).ok);s.setItem(OLD,JSON.stringify({...fixtures[0].profile,gold:1}));assert.equal(s.getItem(KEY),before);assert.equal(loadProfile().profile.gold,999);
});
await test('backup/write failures preserve memory; write-then-throw leaves recoverable original and blocks retry',()=>{
  for(const kind of ['backup','write','after']){const {storage:s,profile:p}=fresh();p.materials=999;assert(saveProfile(p).ok);const old=copy(p),raw=s.getItem(KEY);s.writeFail=k=>kind==='backup'?k===`${KEY}.before-write`:kind==='write'&&k===KEY;s.afterWrite=k=>{if(kind==='after'&&k===KEY)throw Error('write committed then transport threw');};assert(!upgradeBuilding(p,'hall').ok);assert.deepEqual(p,old);if(kind==='after'){assert.equal(s.getItem(`${KEY}.before-write`),raw);assert.notEqual(s.getItem(KEY),raw);s.afterWrite=null;assert(!saveProfile(p).ok);}else assert.equal(s.getItem(KEY),raw);}
});
await test('cloud restore original backup failure and write-then-throw do not commit object',()=>{
  for(const kind of ['backup','after']){const {storage:s,profile:p}=fresh(),raw=s.getItem(KEY),incoming=copy(p);incoming.gold=999;s.writeFail=k=>kind==='backup'&&k.includes('before-cloud-restore');s.afterWrite=k=>{if(kind==='after'&&k===KEY)throw Error('committed then threw');};assert(!restoreCloudProfile(p,incoming,raw).ok);assert.equal(p.gold,300);if(kind==='backup')assert.equal(s.getItem(KEY),raw);else assert([...s.data.values()].includes(raw));}
});
await test('settlement and ad rewards remain persistent and idempotent',()=>{
  const {profile:p}=fresh(),run={id:'compat-run',heroId:'commander',dungeonId:'moss-gate',victory:true,time:360,kills:30};assert(settleRun(p,run).ok);const first=p.gold;assert(settleRun(p,run).ok);assert.equal(p.gold,first);assert(grantAdGoldBonus(p,run.id).ok);const rewarded=p.gold;assert(grantAdGoldBonus(p,run.id).ok);assert.equal(p.gold,rewarded);assert.equal(loadProfile().profile.gold,rewarded);
});
function envelope(p,legacy=false){return {game:'pixel-survivor',app:968359,schemaVersion:legacy?1:2,slotId:legacy?LEGACY_CLOUD_SLOT:CLOUD_SLOT,savedAt:'2026-10-12T00:00:00.000Z',revision:'fixture-rev',profile:copy(p)};}
function host(archives=[]){
  const state={archives:copy(archives),files:new Map(),writes:[],failList:false,failData:false};
  const ok=(o,fn)=>queueMicrotask(()=>{try{o.success(fn());}catch(e){o.fail(e);}});
  const cloud={getArchiveList:o=>ok(o,()=>{if(state.failList)throw Error();return {saves:state.archives.map(a=>({name:a.name,uuid:a.uuid,fileId:a.fileId}))};}),getArchiveData:o=>ok(o,()=>{if(state.failData)throw Error();const a=state.archives.find(a=>a.uuid===o.archiveUUID);state.files.set(o.targetFilePath,JSON.stringify(a.data));return {filePath:o.targetFilePath};}),createArchive:o=>ok(o,()=>{state.writes.push('create');state.archives.push({name:o.archiveMetaData.name,uuid:'v2-created',fileId:'v2-file',data:JSON.parse(state.files.get(o.archiveFilePath))});return {uuid:'v2-created'};}),updateArchive:o=>ok(o,()=>{state.writes.push(o.archiveUUID);state.archives.find(a=>a.uuid===o.archiveUUID).data=JSON.parse(state.files.get(o.archiveFilePath));return {};})};
  const fs={readFile:o=>ok(o,()=>({data:state.files.get(o.filePath)})),writeFile:o=>ok(o,()=>{state.files.set(o.filePath,o.data);return {};})};
  return {state,tap:{env:{USER_DATA_PATH:'/isolated'},getCloudSaveManager:()=>cloud,getFileSystemManager:()=>fs}};
}
const archive=(data,name=data.slotId)=>({name,uuid:name,fileId:`${name}-file`,data});
await test('each frozen v1 cloud migrates read-only; backup creates independent v2 slot',async()=>{
  for(const {profile:legacy} of fixtures){const {profile:p}=fresh(),old=envelope(legacy,true),h=host([archive(old)]),service=new CloudSave({tap:h.tap}),epoch=service.begin(),remote=await service.read(epoch);assert(remote.legacy);assert.equal(remote.data.profile.gold,legacy.gold);await service.restore(p,service.prepare(p,remote),epoch);assert.equal(p.gold,legacy.gold);await service.backup(p,service.prepare(p,remote),epoch);assert.deepEqual(h.state.archives[0].data,old);assert.deepEqual(h.state.writes,['create']);assert.equal(h.state.archives[1].name,CLOUD_SLOT);}
});
await test('v2 cloud is preferred; unknown v2 and failed reads never fall back or write',async()=>{
  for(const kind of ['prefer','future','extra','list-fail','download-fail']){const {storage:s,profile:p}=fresh(),before=s.getItem(KEY),newer=envelope(p);newer.profile.gold=777;if(kind==='future')newer.schemaVersion=99;if(kind==='extra')newer.future=true;const h=host([archive(envelope(fixtures[0].profile,true)),archive(newer)]);h.state.failList=kind==='list-fail';h.state.failData=kind==='download-fail';const service=new CloudSave({tap:h.tap}),epoch=service.begin();if(kind==='prefer'){const remote=await service.read(epoch);assert(!remote.legacy);assert.equal(remote.data.profile.gold,777);}else{await assert.rejects(service.read(epoch));await assert.rejects(service.backup(p,service.prepare(p,null),epoch));await assert.rejects(service.restore(p,service.prepare(p,null),epoch));}assert.equal(h.state.writes.length,0);assert.equal(s.getItem(KEY),before);}
});
await test('unknown legacy cloud and failed legacy reads never mean an empty slot',async()=>{
  for(const kind of ['future','extra','download-fail']){const {profile:p}=fresh(),old=envelope(fixtures[0].profile,true);if(kind==='future')old.schemaVersion=99;if(kind==='extra')old.profile.future=true;const h=host([archive(old)]);h.state.failData=kind==='download-fail';const service=new CloudSave({tap:h.tap}),epoch=service.begin();await assert.rejects(service.read(epoch));await assert.rejects(service.backup(p,service.prepare(p,null),epoch));assert.equal(h.state.writes.length,0);assert.deepEqual(h.state.archives[0].data,old);}
});
await test('v2 appearing after legacy confirmation and future local profile reject cloud mutation',async()=>{
  const {storage:s,profile:p}=fresh(),h=host([archive(envelope(fixtures[0].profile,true))]),service=new CloudSave({tap:h.tap}),epoch=service.begin(),remote=await service.read(epoch),confirmation=service.prepare(p,remote);h.state.archives.push(archive(envelope(p)));await assert.rejects(service.backup(p,confirmation,epoch));assert.equal(h.state.writes.length,0);
  const latest=await service.read(epoch),confirmed=service.prepare(p,latest),future=JSON.stringify({...p,version:99});s.data.set(KEY,future);await assert.rejects(service.backup(p,confirmed,epoch));await assert.rejects(service.restore(p,confirmed,epoch));assert.equal(s.getItem(KEY),future);assert.equal(h.state.writes.length,0);
  // Even a new confirmation must not adopt the latest bytes as this old object's baseline.
  const staleConfirmation=service.prepare(p,latest);await assert.rejects(service.backup(p,staleConfirmation,epoch));await assert.rejects(service.restore(p,staleConfirmation,epoch));assert.equal(s.getItem(KEY),future);assert.equal(p.gold,300);assert.equal(h.state.writes.length,0);
});
report.singleDeviceUpdate={passed:true,storageContractChecked:true,roundTrips:report.roundTripDetails.length};
report.storageContract={...storageContract,sha256:createHash('sha256').update(await readFile(new URL('storage-contract-v2.json',fixtureRoot))).digest('hex')};
report.passed=true;
report.runId=runId;report.status='passed';report.startedAt=startedAt;report.finishedAt=new Date().toISOString();
await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,contractVersion:report.contractVersion,schema:PROFILE_SCHEMA_VERSION,cases:report.cases.length,fixtures:report.fixtures.length}));
