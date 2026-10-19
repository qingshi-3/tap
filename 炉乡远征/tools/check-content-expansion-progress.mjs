import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ExpeditionProgress,normalizeExpeditionState,validateExpeditionState} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch,validateMatch,confirmMulligan} from '../dist/js/engine.js';
import {EXPEDITION_LEVELS,EXPEDITION_CHAPTERS} from '../dist/js/expedition-data.js';
import {CARD_ACQUISITION,NEW_ACQUISITION_IDS,PRE_EXPANSION_LEVEL_IDS} from '../dist/js/campaign-content.js';
import {getEnemyPlan,validateEnemyPlan} from '../dist/js/enemy-plans.js';
import {FACTIONS} from '../dist/js/factions.js';
import {PREMIUM_IDS} from '../dist/js/recruitment.js';
import {ALL_RECRUITMENT_IDS} from '../dist/js/recruitment-catalog.js';
import {SAVE_KEYS} from '../dist/js/storage-contract.js';

const bytes=await readFile(new URL('./fixtures/save-contract-0.3.8-pre-expansion.json',import.meta.url));
const fixture=JSON.parse(bytes),copy=structuredClone;
class Memory {
 data=new Map();failKey=null;writes=[];
 getItem(key){return this.data.get(key)??null;}
 setItem(key,value){if(key===this.failKey)throw Error('controlled backup failure');this.data.set(key,String(value));this.writes.push(key);}
 removeItem(key){this.data.delete(key);}
}
const storageFor=profile=>{const m=new Memory();m.data.set(SAVE_KEYS.expedition,JSON.stringify(profile));return m;};
const checks=[];
for(const [index,old] of fixture.profiles.entries()){
 const migrated=normalizeExpeditionState(old);assert.ok(migrated,`profile9 fixture ${index}`);assert.equal(migrated.schemaVersion,13);
 for(const key of ['coins','activeBattle','battleRewards','settlements','accountStageClaims','factionChapterClaims','dailyAds','factionCompleted'])assert.deepEqual(migrated[key],old[key],key);
 const preservedRecruitment=copy(migrated.recruitment);delete preservedRecruitment.random;delete preservedRecruitment.lastReceipt;delete preservedRecruitment.doubles;assert.deepEqual(preservedRecruitment,{...old.recruitment,fragments:Object.fromEntries(Object.entries(old.recruitment.fragments).map(([id,n])=>[id,Math.ceil(n*30/12)]))});assert.deepEqual(normalizeExpeditionState(migrated),migrated);
 const m=storageFor(old),p=new ExpeditionProgress(m);assert.equal(p.error,'');assert.equal(p.state.schemaVersion,13);
 assert.equal(m.getItem(`${SAVE_KEYS.expedition}.legacy-v9-backup`),JSON.stringify(old));
 assert.ok(p.selectHero(p.state.selectedHeroId).ok);const reopened=new ExpeditionProgress(m);assert.equal(reopened.error,'');assert.deepEqual(reopened.state,p.state);
 if(old.activeBattle)assert.ok(validateMatch(old.activeBattle));
}
checks.push('profile9 migration preserves active battle, frozen rewards, all ledger facts, backup and save/reopen');
for(const corrupt of [{...copy(fixture.profiles[0]),schemaVersion:99},(()=>{const p=copy(fixture.profiles[0]);delete p.training[14];return p;})(),(()=>{const p=copy(fixture.profiles[0]);p.training[99999]=0;return p;})(),(()=>{const p=copy(fixture.profiles[0]);p.completed.push(EXPEDITION_LEVELS[18].id);p.accountStageClaims[EXPEDITION_LEVELS[18].id]='legacy';return p;})()]){
 assert.equal(normalizeExpeditionState(corrupt),null);const m=storageFor(corrupt),raw=m.getItem(SAVE_KEYS.expedition),p=new ExpeditionProgress(m);assert.ok(p.error);assert.equal(p.selectHero(1).ok,false);assert.equal(m.getItem(SAVE_KEYS.expedition),raw);
}
{
 const old=fixture.profiles[0],m=storageFor(old),raw=m.getItem(SAVE_KEYS.expedition);m.failKey=`${SAVE_KEYS.expedition}.legacy-v9-backup`;
 const p=new ExpeditionProgress(m);assert.ok(p.error);assert.equal(m.getItem(SAVE_KEYS.expedition),raw);assert.equal(p.selectHero(1).ok,false);
}
checks.push('future/corrupt profile9 refused without overwrite; backup failure keeps original and disables writes');
{
 const historical=JSON.parse(await readFile(new URL('./fixtures/save-contract-0.1.9.json',import.meta.url))),old=historical.profiles.find(p=>p.schemaVersion===4);
 assert.ok(old);assert.ok(normalizeExpeditionState(old));const forged=copy(old);forged.completed.push(EXPEDITION_LEVELS[18].id);assert.equal(normalizeExpeditionState(forged),null);
 const m=storageFor(forged),raw=m.getItem(SAVE_KEYS.expedition),p=new ExpeditionProgress(m);assert.ok(p.error);assert.equal(m.getItem(SAVE_KEYS.expedition),raw);
}
checks.push('historical profile4 migrates while counterfeit new-level completion is refused');
{
 // Controlled historical facts test ownership migration, not gameplay success.
 const earned=copy(fixture.profiles[0]);earned.activeBattle=null;earned.completed=PRE_EXPANSION_LEVEL_IDS.slice(0,14);earned.accountStageClaims=Object.fromEntries(earned.completed.map(id=>[id,'legacy']));earned.factionCompleted[1]=[...earned.completed];
 const migrated=normalizeExpeditionState(earned);assert.ok(migrated);
 for(const entry of CARD_ACQUISITION.filter(e=>NEW_ACQUISITION_IDS.includes(e.id))){
  const list=migrated.inventory[entry.type==='unit'?'units':'spells'],eligible=entry.level<=14&&(entry.faction===0||entry.faction===1);
  assert.equal(list.includes(entry.id),eligible,`retroactive grant ${entry.id}`);
 }
 assert.equal(migrated.coins,earned.coins);assert.deepEqual(migrated.recruitment,{...earned.recruitment,fragments:Object.fromEntries(Object.entries(earned.recruitment.fragments).map(([id,n])=>[id,Math.ceil(n*30/12)])),lastReceipt:null,doubles:{claims:{}},random:{totalDraws:0,drawsSinceUnit:0,legacyUnitGuarantee:null,legacyGuarantees:Object.fromEntries(Object.entries(earned.recruitment.misses).filter(([,n])=>n>0).map(([id,n])=>[id,4-n]))}});assert.deepEqual(migrated.battleRewards,earned.battleRewards);
 const preservedRecruitment=copy(migrated.recruitment);delete preservedRecruitment.random;delete preservedRecruitment.lastReceipt;delete preservedRecruitment.doubles;assert.deepEqual(preservedRecruitment,{...earned.recruitment,fragments:Object.fromEntries(Object.entries(earned.recruitment.fragments).map(([id,n])=>[id,Math.ceil(n*30/12)]))});assert.deepEqual(normalizeExpeditionState(migrated),migrated);
 const legacyOnly=copy(earned);legacyOnly.factionCompleted[1]=[];const inherited=normalizeExpeditionState(legacyOnly);assert.ok(inherited);
 assert.ok(CARD_ACQUISITION.filter(e=>NEW_ACQUISITION_IDS.includes(e.id)&&e.faction>0).every(e=>!inherited.inventory[e.type==='unit'?'units':'spells'].includes(e.id)));
}
checks.push('only new already-earned card IDs granted once; shared legacy completion never fabricates faction completion');
{
 // A controlled schema7 snapshot retains the old frozen cards and receipt.
 // Changing its known level ID models an old active battle at a new milestone.
 const old=copy(fixture.profiles[1]),battle=old.activeBattle;assert.equal(battle.contentVersion,'campaign-2026-10-13-v1');
 battle.levelId='border-02';const receipt=old.battleRewards[battle.runId];Object.assign(receipt,{levelId:'border-02',accountFirst:true,factionFirst:true,baseCoins:110,chapterCoins:0,compensationCoins:0,rawTickets:1,tickets:1,coins:110,cards:{units:[],spells:[]},allOwned:false});
 assert.ok(validateMatch(battle));assert.ok(normalizeExpeditionState(old));const frozen=copy(receipt),m=storageFor(old),p=new ExpeditionProgress(m),before=p.state;
 const continued=p.state.activeBattle;if(continued.phase==='mulligan')assert.ok(confirmMulligan(continued));continued.phase='over';continued.winner=0;continued.result='win';continued.resultReason='enemies-eliminated';assert.ok(validateMatch(continued));
 const settled=p.settle(continued);assert.ok(settled.ok,JSON.stringify(settled));assert.ok(settled.unlocked.units.includes(10));assert.ok(p.state.inventory.units.includes(10));
 assert.equal(p.state.coins,before.coins+110);assert.equal(p.state.recruitment.tickets,before.recruitment.tickets+1);assert.deepEqual(p.state.battleRewards[battle.runId],frozen);
 const after=p.state;assert.equal(p.settle(continued).duplicate,true);assert.deepEqual(p.state,after);assert.deepEqual(new ExpeditionProgress(m).state,after);
}
checks.push('continued old milestone battle grants new card10 once while keeping exact old receipt and110/1 currency');
assert.equal(EXPEDITION_LEVELS.length,30);assert.equal(EXPEDITION_CHAPTERS.length,10);
assert.deepEqual(EXPEDITION_LEVELS.slice(0,18).map(l=>l.id),fixture.content.levels.map(l=>l.id));
for(let i=0;i<18;i++)assert.deepEqual(EXPEDITION_LEVELS[i],fixture.content.levels[i],`old level ${i+1} unchanged`);
let planCount=0;
for(const level of EXPEDITION_LEVELS){
 const fingerprints=new Set();
 for(const faction of FACTIONS){
  const p=getEnemyPlan(level.id,3,faction.id);assert.ok(validateEnemyPlan(p,level.id));fingerprints.add(JSON.stringify(p.players));planCount++;
  const occupied=new Set([`${level.playerStart.x}:${level.playerStart.y}`]);
  for(const army of Object.values(p.players))for(const entry of army.garrison){assert.ok(entry.x>=0&&entry.x<level.columns&&entry.y>=0&&entry.y<level.rows);const key=`${entry.x}:${entry.y}`;assert.ok(!occupied.has(key),`spawn overlap ${level.id}/${faction.id}/${key}`);occupied.add(key);assert.ok(!level.tiles.some(t=>t.type==='wall'&&t.x===entry.x&&t.y===entry.y));}
 }
 assert.equal(fingerprints.size,6,`six actual enemy configurations ${level.id}`);
}
checks.push('old18 definitions unchanged; 30 maps, 10 chapters and 180 distinct legal enemy encounter plans');

// Settlement API contract probes deliberately synthesize terminal snapshots.
// This verifies accounting only and must never be reported as combat completion.
const m=new Memory(),p=new ExpeditionProgress(m),ledger=[];
for(const faction of FACTIONS){
 assert.ok(p.selectHero(faction.heroIds[0]).ok);let coins=0,orbs=0,newCoins=0,newOrbs=0;
 for(const [index,level] of EXPEDITION_LEVELS.entries()){
  const state=p.state,match=createExpeditionMatch(level.id,state.training,state.squad,state.selectedHeroId,p.getBattleLoadout());assert.ok(validateMatch(match));assert.ok(p.saveBattle(match).ok);assert.ok(confirmMulligan(match));
  match.phase='over';match.winner=0;match.result='win';match.resultReason='enemies-eliminated';assert.ok(validateMatch(match));
  const reward=p.settle(match);assert.ok(reward.ok,JSON.stringify(reward));coins+=reward.amount;orbs+=reward.tickets;if(index>=18){newCoins+=reward.amount;newOrbs+=reward.tickets;}
  const before=p.state;assert.equal(p.settle(match).duplicate,true);assert.deepEqual(p.state,before);assert.equal(new ExpeditionProgress(m).error,'');
 }
 assert.equal(newCoins,faction.id===1?2200:740);assert.equal(newOrbs,faction.id===1?16:4);if(faction.id===1){assert.equal(coins,5890);assert.equal(orbs,40);}
 ledger.push({factionId:faction.id,coins,orbs,newCoins,newOrbs});
}
assert.ok(validateExpeditionState(p.state));assert.equal(p.state.coins,100+ledger.reduce((sum,l)=>sum+l.coins,0));
checks.push('six sequential30 settlement ledgers, per-faction unlocks, finite currency, duplicate settlement and save/reopen');
{
 const owned=copy(p.state);owned.inventory.units=[...new Set([...owned.inventory.units,...PREMIUM_IDS])];const storage=storageFor(owned),q=new ExpeditionProgress(storage);assert.equal(q.error,'');
 const reward=q.rewardPreview(EXPEDITION_LEVELS.at(-1).id,1);assert.equal(reward.tickets,0);assert.equal(reward.compensationCoins,0);
 // First-clear compensations are frozen at entry; fresh all-owned test retains no campaign claims.
 const fresh=new ExpeditionProgress(new Memory()).state;fresh.inventory.units=[...new Set([...fresh.inventory.units,...PREMIUM_IDS])];const partial=new ExpeditionProgress(storageFor(fresh)).rewardPreview(EXPEDITION_LEVELS[0].id,1);assert.equal(partial.tickets,1);assert.equal(partial.compensationCoins,0);
 fresh.inventory.units=[...new Set([...fresh.inventory.units,...ALL_RECRUITMENT_IDS])];const r=new ExpeditionProgress(storageFor(fresh)).rewardPreview(EXPEDITION_LEVELS[0].id,1);assert.equal(r.tickets,0);assert.equal(r.compensationCoins,20);
}
checks.push('original six preserve new collection orb eligibility; full24 converts eligible orbs at20 coins with no repeat farming compensation');
const report={fixtureSha256:createHash('sha256').update(bytes).digest('hex'),checks,planCount,ledger,combatVictoryEvidence:false};
await mkdir(new URL('../output/content-expansion',import.meta.url),{recursive:true});await writeFile(new URL('../output/content-expansion/progress-contract-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
