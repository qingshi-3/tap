import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ExpeditionProgress, normalizeExpeditionState } from '../dist/js/expedition-progress.js';
import { CampaignProgress } from '../dist/js/campaign-progress.js';
import { SaveManager } from '../dist/js/save-manager.js';
import { PlayerCloud } from '../dist/js/player-cloud.js';
import { validateMatch,restoreMatch,confirmMulligan,moveUnit,movementPositions,createExpeditionMatch,useBattleCommand,attackUnit } from '../dist/js/engine.js';
import { NEW_ACQUISITION_IDS } from '../dist/js/campaign-content.js';
import { NEW_RECRUITMENT_IDS } from '../dist/js/recruitment-catalog.js';
import { CARDS } from '../dist/js/cards.js';
import { FACTIONS } from '../dist/js/factions.js';
import { EXPEDITION_LEVELS,TRAINING_COSTS } from '../dist/js/expedition-data.js';
import { SAVE_NAMESPACE,SAVE_KEYS,LEGACY_KEYS,CLOUD_META_KEY,CLOUD_ARCHIVE_NAME,LEGACY_ARCHIVE_NAME,ensureSaveNamespace } from '../dist/js/storage-contract.js';
const fixtureBytes=await readFile(new URL('./fixtures/save-contract-0.1.9.json',import.meta.url));
const f=JSON.parse(fixtureBytes);
const storageFixtureBytes=await readFile(new URL('./fixtures/storage-contract-safe-v1.json',import.meta.url));
const storageContract=JSON.parse(storageFixtureBytes);
assert.equal(SAVE_NAMESPACE,storageContract.namespace);
assert.deepEqual(SAVE_KEYS,storageContract.keys);
assert.deepEqual(LEGACY_KEYS,storageContract.legacyKeys);
assert.equal(CLOUD_META_KEY,storageContract.meta);
assert.equal(CLOUD_ARCHIVE_NAME,storageContract.cloudArchive);
assert.equal(LEGACY_ARCHIVE_NAME,storageContract.legacyCloudArchive);
let roundTrips=0;
const copy=v=>structuredClone(v);
class Memory { data=new Map(); writes=[]; failKey=null; afterThrow=false; getItem(k){return this.data.get(k)??null} setItem(k,v){this.writes.push(k);if(this.failKey===k&&!this.afterThrow)throw Error('quota');this.data.set(k,String(v));if(this.failKey===k&&this.afterThrow){this.failKey=null;throw Error('after write')}} removeItem(k){this.data.delete(k)} }
class Transport {available=true;remote=null;writes=[];failRead=false;async read(){if(this.failRead)throw Error('offline');return copy(this.remote)} async write(data,expected){this.writes.push(copy(data));if((this.remote?.token??null)!==expected)return {ok:false,conflict:true,remote:copy(this.remote)};this.remote={token:'new-token',data:copy(data)};return {ok:true,token:'new-token'}}}
const env=profile=>({game:'duelyst-h5',appId:970030,schemaVersion:1,saveId:'123e4567-e89b-42d3-a456-426614174000',savedAt:1,data:{expedition:copy(profile),campaign:null,match:null}});
const record=snapshot=>({game:'duelyst-h5',schemaVersion:1,slotId:'duelyst-main',runId:snapshot.runId,revision:snapshot.revision,savedAt:1,playtimeSeconds:0,snapshot:copy(snapshot)});
for(const profile of f.profiles){
 const m=new Memory(),raw=JSON.stringify(profile);m.setItem(LEGACY_KEYS.expedition,raw);m.setItem(LEGACY_KEYS.campaign,JSON.stringify(f.campaign));m.setItem(LEGACY_KEYS.match,JSON.stringify(record(f.battles[1])));
 const p=new ExpeditionProgress(m);assert.equal(p.error,'');assert.equal(p.state.coins,321);assert.deepEqual(p.state.activeBattle,profile.activeBattle);assert.equal(m.getItem(LEGACY_KEYS.expedition),raw);assert.equal(p.state.schemaVersion,13);
 // Emulate an already shipped writer: it can only clobber the old slot.
 m.setItem(LEGACY_KEYS.expedition,JSON.stringify({...profile,coins:0}));assert.equal(new ExpeditionProgress(m).state.coins,321);
}
for(const battle of f.battles){assert.ok(validateMatch(battle),`battle schema${battle.schemaVersion}`);assert.ok(restoreMatch(copy(battle)));}
// IDs and rank meanings remain stable; prices and new map/reward tuning may evolve.
for(const id of f.content.cardIds)assert.ok(CARDS[id],`removed card ${id}`);
for(const faction of f.content.factions){const live=FACTIONS.find(v=>v.id===faction.id);assert.ok(live);for(const id of faction.unitIds)assert.ok(live.unitIds.includes(id));}
assert.equal(TRAINING_COSTS.length,f.content.trainingCosts.length,'existing four-rank meaning must remain supported');
assert.ok(TRAINING_COSTS.every(cost=>Number.isSafeInteger(cost)&&cost>=0));
for(const frozen of f.content.levels)assert.ok(EXPEDITION_LEVELS.some(level=>level.id===frozen.id),`removed level ${frozen.id}`);
// Stale loaded objects cannot rewrite any new slot or future format.
{
 const m=new Memory(),a=new ExpeditionProgress(m),b=new ExpeditionProgress(m);assert.ok(a.train(14).ok);const raw=m.getItem(SAVE_KEYS.expedition);assert.equal(b.train(14).ok,false);assert.equal(m.getItem(SAVE_KEYS.expedition),raw);
 const c=new CampaignProgress(f.content.levels.map(v=>v.id),m);m.setItem(SAVE_KEYS.campaign,'{"schemaVersion":99}');c.observe({mode:'challenge',levelId:'border-01',runId:'run',phase:'over',winner:0,completedLevels:[]});assert.equal(m.getItem(SAVE_KEYS.campaign),'{"schemaVersion":99}');
 const saves=new SaveManager(()=>{},m);m.setItem(SAVE_KEYS.match,JSON.stringify({...record(f.battles[1]),schemaVersion:99}));assert.equal(saves.saveLocal(copy(f.battles[1])),false);
}
for(const name of Object.keys(SAVE_KEYS)){
 const m=new Memory();m.setItem(LEGACY_KEYS.expedition,JSON.stringify(f.profiles[3]));m.setItem(SAVE_KEYS[name],'{bad');assert.throws(()=>ensureSaveNamespace(m));assert.equal(m.getItem(SAVE_KEYS[name]),'{bad');
}
// Mid-migration failure resumes from exact immutable source; external new data blocks recovery.
{
 const m=new Memory();for(const [name,key]of Object.entries(LEGACY_KEYS))m.setItem(key,JSON.stringify(name==='expedition'?f.profiles[3]:name==='campaign'?f.campaign:record(f.battles[1])));
 m.failKey=SAVE_KEYS.campaign;assert.throws(()=>ensureSaveNamespace(m));assert.ok(m.getItem(`${SAVE_NAMESPACE}.migration-journal`));m.failKey=null;ensureSaveNamespace(m);assert.equal(m.getItem(SAVE_KEYS.campaign),m.getItem(LEGACY_KEYS.campaign));
}
{
 const m=new Memory();m.setItem(LEGACY_KEYS.expedition,JSON.stringify(f.profiles[3]));m.failKey=SAVE_KEYS.expedition;assert.throws(()=>ensureSaveNamespace(m));m.failKey=null;m.setItem(SAVE_KEYS.expedition,'{"schemaVersion":99}');assert.throws(()=>ensureSaveNamespace(m));assert.equal(m.getItem(SAVE_KEYS.expedition),'{"schemaVersion":99}');
}
{
 const m=new Memory(),p=new ExpeditionProgress(m);assert.ok(p.train(14).ok);const raw=m.getItem(SAVE_KEYS.expedition);m.failKey=SAVE_KEYS.expedition;m.afterThrow=true;assert.equal(p.selectHero(23).ok,false);assert.equal(m.getItem(SAVE_KEYS.expedition),raw);
}
// Legacy cloud is read only after successful proof of a missing new slot.
{
 const m=new Memory(),newCloud=new Transport(),oldCloud=new Transport();oldCloud.remote={token:'old-token',data:env(f.profiles[2])};const cloud=new PlayerCloud({storage:m,transport:newCloud,legacyTransport:oldCloud});assert.ok((await cloud.initialize()).ok);assert.equal(newCloud.writes.length,1);assert.equal(oldCloud.writes.length,0);assert.equal(new ExpeditionProgress(m).state.coins,321);assert.equal(cloud.state.status,'synced');cloud.dispose();
}
for(const bad of ['future','corrupt','offline']){
 const m=new Memory(),newCloud=new Transport(),oldCloud=new Transport();oldCloud.remote={token:'old-token',data:env(f.profiles[3])};let reads=0;const read=oldCloud.read.bind(oldCloud);oldCloud.read=()=>{reads++;return read()};
 if(bad==='offline')newCloud.failRead=true;else newCloud.remote={token:'bad-token',data:bad==='future'?{...env(f.profiles[3]),schemaVersion:99}:{broken:true}};
 const cloud=new PlayerCloud({storage:m,transport:newCloud,legacyTransport:oldCloud});assert.equal((await cloud.initialize()).ok,false);assert.equal(reads,0);assert.equal(newCloud.writes.length,0);cloud.dispose();
}
{
 const m=new Memory(),t=new Transport(),cloud=new PlayerCloud({storage:m,transport:t});await cloud.initialize();m.setItem(CLOUD_META_KEY,'{"schemaVersion":99}');assert.equal((await cloud.sync()).ok,false);assert.equal(t.writes.length,0);cloud.dispose();
}
// A future sibling slot or migration journal freezes already loaded writers.
for (const badKey of [SAVE_KEYS.campaign, CLOUD_META_KEY, `${SAVE_NAMESPACE}.migration-journal`, `${SAVE_NAMESPACE}.namespace`]) {
 const m=new Memory(),p=new ExpeditionProgress(m);assert.ok(p.train(14).ok);const before=m.getItem(SAVE_KEYS.expedition);m.setItem(badKey,'{"version":99,"schemaVersion":99}');assert.equal(p.selectHero(23).ok,false);assert.equal(m.getItem(SAVE_KEYS.expedition),before);assert.equal(m.getItem(badKey),'{"version":99,"schemaVersion":99}');
}
// Identical local and legacy cloud data still establish the new cloud slot.
{
 const m=new Memory(),t=new Transport(),old=new Transport();m.setItem(LEGACY_KEYS.expedition,JSON.stringify(f.profiles[3]));old.remote={token:'legacy-equal',data:env(f.profiles[3])};const cloud=new PlayerCloud({storage:m,transport:t,legacyTransport:old});assert.ok((await cloud.initialize()).ok);assert.equal(t.writes.length,1);assert.equal(old.writes.length,0);assert.equal(cloud.state.status,'synced');cloud.dispose();
}
// Cloud restore recovery cannot roll back another page's later progress.
for (const external of [false,true]) {
 const m=new Memory();ensureSaveNamespace(m);
 const originals=Object.entries(SAVE_KEYS).map(([name,key])=>({name,key,raw:null}));
 const intended=originals.map(entry=>({...entry,raw:entry.name==='expedition'?JSON.stringify(f.profiles[3]):null}));
 const current=copy(f.profiles[3]);if(external)current.coins=999;m.setItem(SAVE_KEYS.expedition,JSON.stringify(current));
 const key=`${CLOUD_META_KEY}.restore-journal`,raw=JSON.stringify({schemaVersion:2,originals,intended});m.setItem(key,raw);
 const cloud=new PlayerCloud({storage:m,transport:new Transport()});
 if(external){assert.equal(cloud.state.blocked,true);assert.equal(m.getItem(key),raw);assert.equal(JSON.parse(m.getItem(SAVE_KEYS.expedition)).coins,999);}
 else {assert.equal(cloud.state.blocked,false);assert.equal(m.getItem(SAVE_KEYS.expedition),null);assert.equal(m.getItem(key),null);}
 cloud.dispose();
}
// Each historical profile completes two real purchases across fresh loaded instances.
function assertHistoricalProfile(state, source) {
 assert.equal(state.schemaVersion,13);assert.equal(state.coins,source.coins);
 for(const [id,rank] of Object.entries(source.training))assert.equal(state.training[id],rank,`rank ${id}`);
 for(const id of Object.keys(state.training))if(!(id in source.training))assert.equal(state.training[id],0);
 assert.equal(state.selectedHeroId,source.selectedHeroId??1);assert.deepEqual(state.squad,source.squad);
 if(source.factionSquads)assert.deepEqual(state.factionSquads,source.factionSquads);else assert.deepEqual(state.factionSquads[1],source.squad);
 for(const field of ['completed','settlements','activeBattle'])assert.deepEqual(state[field],source[field],field);
 assert.deepEqual(state.rewardClaims,source.rewardClaims??{});
}
for(const source of f.profiles) {
 const m=new Memory();const seedKey=source.schemaVersion===4?storageContract.keys.expedition:storageContract.legacyKeys.expedition;
 m.setItem(seedKey,JSON.stringify(source));m.setItem(storageContract.legacyKeys.campaign,JSON.stringify(f.campaign));
 // A released safe-v1 schema4 slot is authoritative; seed its actual companion location.
 if(source.schemaVersion===4)m.setItem(storageContract.keys.campaign,JSON.stringify(f.campaign));
 let p=new ExpeditionProgress(m);assert.equal(p.error,'');assertHistoricalProfile(p.state,source);assert.equal(p.isUnlocked('border-02'),true);assert.equal(p.isUnlocked('border-03'),false);
 const initial=p.state,cardId=initial.squad.find(id=>initial.training[id]+2<=TRAINING_COSTS.length);assert.ok(cardId,'fixture has two trainable ranks');
 const firstCost=TRAINING_COSTS[initial.training[cardId]];assert.ok(p.train(cardId).ok);
 let expected=copy(initial);expected.coins-=firstCost;expected.training[cardId]++;assert.deepEqual(p.state,expected);
 assert.deepEqual(new CampaignProgress(f.campaign.completedLevelIds,m).completed,new Set(f.campaign.completedLevelIds));
 const beforeReloadWrites=m.writes.length;p=new ExpeditionProgress(m);assert.equal(m.writes.length,beforeReloadWrites,'same schema reload must not remigrate');assert.deepEqual(p.state,expected);
 const secondId=p.getTrainingAvailability(cardId).canTrain?cardId:initial.squad.find(id=>p.getTrainingAvailability(id).canTrain);assert.ok(secondId,'second legal purchase under new gates');const secondCost=TRAINING_COSTS[expected.training[secondId]];assert.ok(p.train(secondId).ok);expected.coins-=secondCost;expected.training[secondId]++;
 p=new ExpeditionProgress(m);assert.deepEqual(p.state,expected);assert.equal(p.isUnlocked('border-02'),true);assert.equal(p.isUnlocked('border-03'),false);
 assert.deepEqual(p.state.activeBattle,source.activeBattle);assert.deepEqual(p.state.settlements,source.settlements);assert.deepEqual(p.state.rewardClaims,source.rewardClaims??{});
 roundTrips++;
}
// Real engine commands, not synthesized completion flags, verify each old battle can continue.
function act(match) {
 if(match.phase==='mulligan'){assert.equal(confirmMulligan(match),true);return;}
 const unit=match.units.find(unit=>unit.owner===match.currentPlayer&&movementPositions(match,unit).length);
 assert.ok(unit,'historical match must have a legal real movement');const target=movementPositions(match,unit)[0];assert.equal(moveUnit(match,unit.unitId,target.x,target.y),true);
}
for(const source of f.battles) {
 const m=new Memory();let match=restoreMatch(copy(source));assert.ok(match);
 const expedition=source.mode==='expedition';
 if(expedition){const profile=copy(f.profiles[3]);profile.activeBattle=copy(source);m.setItem(storageContract.legacyKeys.expedition,JSON.stringify(profile));}
 else m.setItem(storageContract.legacyKeys.match,JSON.stringify(record(source)));
 let owner=expedition?new ExpeditionProgress(m):new SaveManager(()=>{},m);
 let before=copy(match);act(match);assert.notDeepEqual(match,before);assert.ok(validateMatch(match));
 assert.equal(expedition?owner.saveBattle(match).ok:owner.saveLocal(match),true);
 let expected=copy(match);owner=expedition?new ExpeditionProgress(m):new SaveManager(()=>{},m);
 assert.deepEqual(expedition?owner.state.activeBattle:owner.localSnapshot,expected);
 match=restoreMatch(expedition?owner.state.activeBattle:owner.localSnapshot);before=copy(match);act(match);assert.notDeepEqual(match,before);assert.ok(validateMatch(match));
 assert.equal(expedition?owner.saveBattle(match).ok:owner.saveLocal(match),true);expected=copy(match);
 owner=expedition?new ExpeditionProgress(m):new SaveManager(()=>{},m);assert.deepEqual(expedition?owner.state.activeBattle:owner.localSnapshot,expected);
 if(expedition){assert.deepEqual(owner.state.completed,f.profiles[3].completed);assert.deepEqual(owner.state.settlements,f.profiles[3].settlements);assert.deepEqual(owner.state.rewardClaims,f.profiles[3].rewardClaims);}
 roundTrips++;
}
// Single-device recovery after a transient failure must return to normal public saving.
for(const failure of ['namespace-migration','profile-migration','profile-save','match-save','campaign-save']) {
 const m=new Memory();
 if(failure==='namespace-migration')m.setItem(storageContract.legacyKeys.expedition,JSON.stringify(f.profiles[0]));
 if(failure==='profile-migration')m.setItem(storageContract.keys.expedition,JSON.stringify(f.profiles[0]));
 let owner;
 if(failure==='namespace-migration'||failure==='profile-migration'){
   m.failKey=failure==='namespace-migration'?storageContract.keys.expedition:`${storageContract.keys.expedition}.legacy-v1-backup`;
   owner=new ExpeditionProgress(m);assert.ok(owner.error);assert.equal(owner.train(14).ok,false);
   m.failKey=null;owner=new ExpeditionProgress(m);assert.equal(owner.error,'');assertHistoricalProfile(owner.state,f.profiles[0]);assert.ok(owner.train(14).ok);
   const first=owner.state;owner=new ExpeditionProgress(m);assert.deepEqual(owner.state,first);assert.ok(owner.train(14).ok);assert.deepEqual(new ExpeditionProgress(m).state,owner.state);
 }else if(failure==='profile-save'){
   owner=new ExpeditionProgress(m);m.failKey=storageContract.keys.expedition;assert.equal(owner.train(14).ok,false);m.failKey=null;assert.ok(owner.train(14).ok);const first=owner.state;owner=new ExpeditionProgress(m);assert.deepEqual(owner.state,first);assert.ok(owner.selectHero(23).ok);assert.deepEqual(new ExpeditionProgress(m).state,owner.state);
 }else if(failure==='match-save'){
   owner=new SaveManager(()=>{},m);let match=restoreMatch(copy(f.battles[1]));act(match);m.failKey=storageContract.keys.match;assert.equal(owner.saveLocal(match),false);m.failKey=null;assert.equal(owner.saveLocal(match),true);const first=copy(match);owner=new SaveManager(()=>{},m);assert.deepEqual(owner.localSnapshot,first);match=restoreMatch(owner.localSnapshot);act(match);assert.ok(owner.saveLocal(match));assert.deepEqual(new SaveManager(()=>{},m).localSnapshot,match);
 }else {
   const ids=['roar-lethal','break-the-guard','lightchaser-bond'];owner=new CampaignProgress(ids,m);let match=restoreMatch(copy(f.battles[1]));assert.ok(useBattleCommand(match,2));m.failKey=storageContract.keys.campaign;owner.observe(match);assert.ok(owner.error);
   m.failKey=null;owner=new CampaignProgress(ids,m);owner.observe(match);assert.equal(owner.error,null);assert.ok(owner.attempted.has('roar-lethal'));let saves=new SaveManager(()=>{},m);assert.ok(saves.saveLocal(match));
   owner=new CampaignProgress(ids,m);saves=new SaveManager(()=>{},m);match=restoreMatch(saves.localSnapshot);assert.ok(moveUnit(match,1,3,1));assert.ok(attackUnit(match,1,3));assert.ok(attackUnit(match,2,3));assert.equal(match.winner,0);assert.equal(owner.observe(match).firstClear,true);assert.ok(saves.saveLocal(match));
   owner=new CampaignProgress(ids,m);assert.ok(owner.completed.has('roar-lethal'));assert.ok(owner.attempted.has('roar-lethal'));assert.equal(owner.lastLevelId,'roar-lethal');assert.deepEqual(new SaveManager(()=>{},m).localSnapshot,match);
 }
 roundTrips++;
}
// Ordinary reward/map edits use the existing slots. Old ledger and pending entitlements survive.
{
 const level=EXPEDITION_LEVELS.find(level=>level.id==='border-01'),oldReward=copy(level.reward),oldTiles=copy(level.tiles),oldObjective=copy(level.objective);
 try {
   level.reward.first+=13;level.reward.repeat+=7;level.tiles.push({x:8,y:0,type:'wall'});level.objective.type='survive';level.objective.rounds=5;
   const m=new Memory(),source=copy(f.profiles[3]);source.rewardClaims['frozen-win'].status='pending';m.setItem(storageContract.keys.expedition,JSON.stringify(source));
   let p=new ExpeditionProgress(m);assert.equal(p.error,'');assertHistoricalProfile(p.state,source);assert.ok(p.train(14).ok);
   let battle=restoreMatch(p.state.activeBattle);assert.deepEqual(battle.board.tiles,source.activeBattle.board.tiles);assert.deepEqual(battle.objective,source.activeBattle.objective);act(battle);assert.ok(p.saveBattle(battle).ok);
   p=new ExpeditionProgress(m);assert.deepEqual(p.state.activeBattle,battle);assert.equal(p.rewardOffer('frozen-win').amount,25);
   const before=p.state.coins;assert.equal(p.completeReward('frozen-win','frozen-ad').ok,false);assert.equal(p.state.coins,before);assert.equal(p.state.rewardClaims['frozen-win'].status,'pending');
   assert.ok(p.beginDailyAd('gold','new-daily-gold').ok);const awarded=p.completeDailyAd('gold','new-daily-gold');assert.ok(awarded.ok);assert.equal(p.state.coins,before+awarded.amount);
   p=new ExpeditionProgress(m);assert.ok(p.completeDailyAd('gold','new-daily-gold').duplicate);assert.equal(p.state.coins,before+awarded.amount);assert.equal(p.dailyAdOffer('gold').eligible,false);assert.equal(p.state.rewardClaims['frozen-win'].amount,25);
   assert.ok(p.train(9).ok);assert.deepEqual(new ExpeditionProgress(m).state,p.state);
   const fresh=createExpeditionMatch('border-01',p.state.training,p.state.squad,p.state.selectedHeroId);assert.deepEqual(fresh.board.tiles,level.tiles);assert.deepEqual(fresh.objective,level.objective);
   const ready=new ExpeditionProgress(new Memory());const won=createExpeditionMatch('border-01',ready.state.training,ready.state.squad,ready.state.selectedHeroId);won.phase='over';won.winner=0;won.result='win';assert.equal(ready.settle(won).amount,level.reward.first);assert.equal(ready.rewardOffer(won.runId).amount,level.reward.repeat);
   roundTrips++;
 }finally {Object.assign(level.reward,oldReward);level.tiles.splice(0,level.tiles.length,...oldTiles);for(const key of Object.keys(level.objective))delete level.objective[key];Object.assign(level.objective,oldObjective);}
}
// Compare every historical field exactly, excluding only explicitly introduced roster IDs.
function historicalProfileProjection(current, source) {
 const restored=copy(current); delete restored.giftCodeClaims; restored.schemaVersion=source.schemaVersion;
 if(source.recruitment){const scaled=Object.fromEntries(Object.entries(source.recruitment.fragments).map(([id,n])=>[id,Math.ceil(n*30/12)]));assert.deepEqual(restored.recruitment.fragments,scaled,'historical fragment progress upgraded from 12 to 30');restored.recruitment.fragments=copy(source.recruitment.fragments);}
 delete restored.recruitment.lastReceipt;delete restored.recruitment.doubles;
 if(!Object.hasOwn(source.recruitment ?? {},'random'))delete restored.recruitment.random;else delete restored.recruitment.random.legacyUnitGuarantee;
 if(!Object.hasOwn(source,'dailyAds'))delete restored.dailyAds;
 for(const key of ['training','spellTraining','spellModes','specializations','growthVersion']) {
  if(source[key]) restored[key]=Object.fromEntries(Object.entries(restored[key]).filter(([id])=>!NEW_ACQUISITION_IDS.includes(Number(id))&&!NEW_RECRUITMENT_IDS.includes(Number(id))));
 }
 for(const key of ['units','spells'])restored.inventory[key]=restored.inventory[key].filter(id=>!NEW_ACQUISITION_IDS.includes(id)&&!NEW_RECRUITMENT_IDS.includes(id));
 return restored;
}
// Freeze the actual prior profile8 contract, including pending/claimed ads and a schema7 battle.
const profile8Bytes=await readFile(new URL('./fixtures/save-contract-profile8-pre-daily-2026-10-13.json',import.meta.url));
const profile8Fixture=JSON.parse(profile8Bytes);
for(const source of profile8Fixture.profiles){
 const m=new Memory(),raw=JSON.stringify(source);m.setItem(SAVE_KEYS.expedition,raw);let p=new ExpeditionProgress(m);assert.equal(p.error,'');assert.equal(p.state.schemaVersion,13);assert.equal(m.getItem(`${SAVE_KEYS.expedition}.legacy-v8-backup`),raw);
 assert.deepEqual(historicalProfileProjection(p.state,source),source,'profile8 migration preserves every existing field');
 assert.equal(p.completeReward('profile8-frozen-win','profile8-gold-pending').ok,source.rewardClaims['profile8-frozen-win'].status==='claimed');
 if(source.activeBattle){let battle=restoreMatch(p.state.activeBattle);act(battle);assert.ok(p.saveBattle(battle).ok);p=new ExpeditionProgress(m);assert.deepEqual(p.state.activeBattle,battle);battle=restoreMatch(p.state.activeBattle);act(battle);assert.ok(p.saveBattle(battle).ok);assert.deepEqual(new ExpeditionProgress(m).state.activeBattle,battle);}
 else {assert.ok(p.train(14).ok);const first=p.state;p=new ExpeditionProgress(m);assert.deepEqual(p.state,first);assert.ok(p.train(9).ok);assert.deepEqual(new ExpeditionProgress(m).state,p.state);}
 assert.deepEqual(p.state.rewardClaims,source.rewardClaims);assert.deepEqual(p.state.recruitment.adClaims,source.recruitment.adClaims);roundTrips++;
}
// The last shipped profile9 and active content-v1 battle remain playable after expansion.
const profile9Bytes=await readFile(new URL('./fixtures/save-contract-0.3.8-pre-expansion.json',import.meta.url));
for(const source of JSON.parse(profile9Bytes).profiles) {
 const m=new Memory(),raw=JSON.stringify(source);m.setItem(SAVE_KEYS.expedition,raw);
 let p=new ExpeditionProgress(m);assert.equal(p.error,'');assert.equal(p.state.schemaVersion,13);
 assert.equal(m.getItem(SAVE_KEYS.expedition+'.legacy-v9-backup'),raw);
 assert.deepEqual(historicalProfileProjection(p.state,source),source);
 if(source.activeBattle) {
  let battle=restoreMatch(p.state.activeBattle);act(battle);assert.ok(p.saveBattle(battle).ok);
  p=new ExpeditionProgress(m);assert.deepEqual(p.state.activeBattle,battle);
  battle=restoreMatch(p.state.activeBattle);act(battle);assert.ok(p.saveBattle(battle).ok);
  assert.deepEqual(new ExpeditionProgress(m).state.activeBattle,battle);
 } else {
  assert.ok(p.train(14).ok);const once=p.state;p=new ExpeditionProgress(m);assert.deepEqual(p.state,once);
  assert.ok(p.train(9).ok);assert.deepEqual(new ExpeditionProgress(m).state,p.state);
 }
 assert.deepEqual(p.state.rewardClaims,source.rewardClaims);assert.deepEqual(p.state.recruitment.adClaims,source.recruitment.adClaims);roundTrips++;
}
// The released profile10 keeps inventory, outstanding pity and frozen active rewards.
const profile10Bytes=await readFile(new URL('./fixtures/save-contract-profile10-pre-random-2026-10-14.json',import.meta.url));
for(const source of JSON.parse(profile10Bytes).profiles){
 const m=new Memory(),raw=JSON.stringify(source);m.setItem(SAVE_KEYS.expedition,raw);
 let p=new ExpeditionProgress(m);assert.equal(p.error,'');assert.equal(p.state.schemaVersion,13);
 assert.equal(m.getItem(SAVE_KEYS.expedition+'.legacy-v10-backup'),raw);
 const projected=historicalProfileProjection(p.state,source);
 // v10 already contains the previous campaign expansion roster; remove only new recruits.
 for(const field of ['training','spellTraining','spellModes','specializations','growthVersion'])projected[field]=Object.fromEntries(Object.entries(p.state[field]).filter(([id])=>!NEW_RECRUITMENT_IDS.includes(Number(id))));
 projected.inventory=copy(p.state.inventory);projected.inventory.units=projected.inventory.units.filter(id=>!NEW_RECRUITMENT_IDS.includes(id));
 assert.deepEqual(projected,source,'all historical profile10 fields retained');
 if(source.activeBattle){let battle=restoreMatch(p.state.activeBattle);act(battle);assert.ok(p.saveBattle(battle).ok);p=new ExpeditionProgress(m);assert.deepEqual(p.state.activeBattle,battle);battle=restoreMatch(p.state.activeBattle);act(battle);assert.ok(p.saveBattle(battle).ok);assert.deepEqual(new ExpeditionProgress(m).state.activeBattle,battle);}
 else{assert.ok(p.train(14).ok);const once=p.state;p=new ExpeditionProgress(m);assert.deepEqual(p.state,once);assert.ok(p.train(9).ok);assert.deepEqual(new ExpeditionProgress(m).state,p.state);}
 assert.deepEqual(p.state.battleRewards,source.battleRewards);assert.deepEqual(p.state.recruitment.adClaims,source.recruitment.adClaims);roundTrips++;
}
// Frozen profile11 preserves its paid entitlements, old battle and every asset.
const profile11Bytes=await readFile(new URL('./fixtures/save-contract-profile11-pre-fragments-2026-10-15.json',import.meta.url));
for(const source of JSON.parse(profile11Bytes).profiles){
 const m=new Memory(),raw=JSON.stringify(source);m.setItem(SAVE_KEYS.expedition,raw);let p=new ExpeditionProgress(m,{rng:()=>0});assert.equal(p.error,'');
 const expected=copy(source);expected.schemaVersion=13;expected.giftCodeClaims={};expected.recruitment.fragments=Object.fromEntries(Object.entries(source.recruitment.fragments).map(([id,n])=>[id,Math.ceil(n*30/12)]));expected.recruitment.random.legacyUnitGuarantee=source.recruitment.random.totalDraws>0?10-source.recruitment.random.drawsSinceUnit:null;expected.recruitment.lastReceipt=null;expected.recruitment.doubles={claims:{}};
 assert.deepEqual(p.state,expected,'only explicit recipe migration and new ledgers may change profile11');assert.equal(m.getItem(SAVE_KEYS.expedition+'.legacy-v11-backup'),raw);
 const bad=copy(source);bad.recruitment.random.unknown=1;assert.equal(normalizeExpeditionState(bad),null,'unknown historical fields still rejected');
 if(source.activeBattle){let battle=restoreMatch(p.state.activeBattle);act(battle);assert.ok(p.saveBattle(battle).ok);p=new ExpeditionProgress(m,{rng:()=>0});assert.deepEqual(p.state.activeBattle,battle);battle=restoreMatch(p.state.activeBattle);act(battle);assert.ok(p.saveBattle(battle).ok);assert.deepEqual(new ExpeditionProgress(m).state.activeBattle,battle);}
 for(let i=0;i<2;i++){const before=p.state,draw=p.drawRecruitment();assert.ok(draw.ok,draw.error);assert.equal(draw.draws[0].rewards[0].kind,'fragments');assert.ok([1,2,5].includes(draw.draws[0].rewards[0].amount));assert.equal(p.state.coins,before.coins+20);assert.equal(p.state.recruitment.tickets,before.recruitment.tickets-1);const saved=p.state;p=new ExpeditionProgress(m,{rng:()=>0});assert.equal(p.error,'');assert.deepEqual(p.state,saved);assert.equal(JSON.parse(m.getItem(storageContract.keys.expedition)).schemaVersion,13);}
 assert.deepEqual(p.state.dailyAds,source.dailyAds);assert.deepEqual(p.state.battleRewards,source.battleRewards);assert.deepEqual(p.state.settlements,source.settlements);assert.deepEqual(p.state.recruitment.adClaims,source.recruitment.adClaims);roundTrips++;
}
export const compatibilityReport={check:'duelyst-save-compatibility-v1',passed:true,singleDeviceUpdate:{passed:true,storageContractChecked:true,roundTrips},storageContractFixture:{file:'tools/fixtures/storage-contract-safe-v1.json',sha256:createHash('sha256').update(storageFixtureBytes).digest('hex')},namespace:SAVE_NAMESPACE,cloudArchive:CLOUD_ARCHIVE_NAME,profileSchemas:[1,2,3,4,5,6,7,8,9,10,11,12,13],profile11Fixture:{file:"tools/fixtures/save-contract-profile11-pre-fragments-2026-10-15.json",sha256:createHash("sha256").update(profile11Bytes).digest("hex")},profile10Fixture:{file:"tools/fixtures/save-contract-profile10-pre-random-2026-10-14.json",sha256:createHash("sha256").update(profile10Bytes).digest("hex")},profile9Fixture:{file:"tools/fixtures/save-contract-0.3.8-pre-expansion.json",sha256:createHash("sha256").update(profile9Bytes).digest("hex")},profile8Fixture:{file:"tools/fixtures/save-contract-profile8-pre-daily-2026-10-13.json",sha256:createHash("sha256").update(profile8Bytes).digest("hex")},battleSchemas:[1,2,3,4],fixture:{file:'tools/fixtures/save-contract-0.1.9.json',sha256:createHash('sha256').update(fixtureBytes).digest('hex'),profiles:f.profiles.length,battles:f.battles.length,provenance:f.provenance}};
console.log(JSON.stringify(compatibilityReport));
