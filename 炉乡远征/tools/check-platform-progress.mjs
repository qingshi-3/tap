import { ORIGINAL_CAMPAIGN_LEVEL_IDS } from '../dist/js/adventure-access.js';
import assert from 'node:assert/strict';
import {createPlatformProgress,collectionProgressStats,platformProgressStats,localAchievements,PLATFORM_PROGRESS_BINDING,ACHIEVEMENT_CATALOG,CONFIRMED_ACHIEVEMENTS,ACHIEVEMENTS_PUBLISHED} from '../dist/js/platform-progress.js';
import {EXPEDITION_LEVELS,EXPEDITION_CHAPTERS} from '../dist/js/expedition-data.js';
import {CARD_ACQUISITION} from '../dist/js/campaign-content.js';
import {readFileSync} from 'node:fs';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
const historicalSix=Object.freeze({'first-victory':'LXFirstVictory','faction-3':'LXFaction3','faction-15':'LXFaction15','faction-30':'LXFaction30','all-factions':'LXAllFactions','collection-150':'LXCollection150'});
const planned=JSON.parse(readFileSync(new URL('../platform/achievements/publication-20261022/planned-catalog.json',import.meta.url),'utf8'));
const expectedBindings={...historicalSix,...planned.newIdMapping};
const baseline=JSON.parse(readFileSync(new URL('./fixtures/ranked-challenge-v1-current.json',import.meta.url),'utf8')).bestResult;
let best=structuredClone(baseline);
const ids=EXPEDITION_LEVELS.map(level=>level.id);
const state={factionCompleted:{1:[ids[0],ids[0],'forged'],2:[ids[0]],7:ids},legacyUnlockedLevels:ids,inventory:{units:[14,14,999999],spells:[]}};
assert.deepEqual(platformProgressStats(state),{score:2,factions:[1,1,0,0,0,0],collection:1});
const complete={factionCompleted:Object.fromEntries([1,2,3,4,5,6].map(id=>[id,ids])),inventory:{units:CARD_ACQUISITION.filter(c=>c.type==='unit').map(c=>c.id),spells:CARD_ACQUISITION.filter(c=>c.type==='spell').map(c=>c.id)}};
assert.equal(platformProgressStats(complete).score,EXPEDITION_LEVELS.length*6);
const winningReceipt={...baseline,round:5,deaths:0,health:25,score:95125};
assert(localAchievements(complete,{},winningReceipt).every(a=>a.achieved&&!a.configured));
assert.equal(ACHIEVEMENT_CATALOG.length,59);assert.equal(new Set(ACHIEVEMENT_CATALOG.map(a=>a.key)).size,59);
assert.deepEqual(CONFIRMED_ACHIEVEMENTS,expectedBindings,'production bindings must match all read-back-confirmed IDs and retain the historical six');
assert.equal(localAchievements(complete).filter(a=>!a.configured).length,6,'new six chapters remain local until separately published');
assert.equal(ACHIEVEMENTS_PUBLISHED,true,'full rollout requires confirmed platform publication');
assert.equal(localAchievements(complete,CONFIRMED_ACHIEVEMENTS,winningReceipt).filter(a=>a.configured&&a.achieved).length,53);
assert.deepEqual(collectionProgressStats(complete),{units:120,spells:48,total:168,available:168});
const achievement=(value,key,result=null)=>localAchievements(value,{},result).find(a=>a.key===key);
for(const chapter of EXPEDITION_CHAPTERS){
 const key=`chapter-${chapter.id}`,[a,b,c]=chapter.levelIds;
 assert(!achievement({factionCompleted:{1:[a,b],2:[c]}},key).achieved,'chapters cannot combine records across factions');
 assert(!achievement({factionCompleted:{1:[a,a,b,'forged',...ids.filter(id=>!chapter.levelIds.includes(id))]}},key).achieved,'other chapters and duplicates cannot replace the missing level');
 assert(achievement({factionCompleted:{6:[c,b,a]}},key).achieved,'any one faction can complete each chapter');
}
for(let faction=1;faction<=6;faction++)for(const target of [10,20,30]){
 const key=`faction-${faction}-${target}`;
 assert(achievement({factionCompleted:{[faction]:ids.slice(0,target)}},key).achieved);
 assert(!achievement({factionCompleted:{[faction]:ids.slice(0,target-1),[faction===6?1:faction+1]:ids}},key).achieved,'another faction cannot supply missing completions');
}
const missingOld={factionCompleted:Object.fromEntries([1,2,3,4,5,6].map(id=>[id,ids.filter(level=>level!=='border-01')]))};
assert(platformProgressStats(missingOld).score>180);assert(!achievement(missingOld,'all-factions').achieved,'new108 victories cannot replace missing original facts');
assert(achievement({factionCompleted:Object.fromEntries([1,2,3,4,5,6].map(id=>[id,[...ORIGINAL_CAMPAIGN_LEVEL_IDS]]))},'all-factions').achieved);
assert.equal(achievement({legacyUnlockedLevels:ids},'factions-started-2').progress,0,'shared access is not faction history');
assert.equal(achievement(state,'factions-started-2').progress,2);
assert.equal(achievement(state,'total-30').progress,2);
for(const invalid of [null,{...winningReceipt,won:false},{...winningReceipt,score:99999},{...winningReceipt,challengeId:'forged'},{...winningReceipt,attemptId:''}]){
 assert(localAchievements(complete,{},invalid).filter(a=>a.category==='challenge').every(a=>!a.achieved&&a.progress===0),'only validated fixed-challenge winning receipts count');
}
assert(achievement({},'challenge-first-victory',baseline).achieved);
assert(!achievement({},'challenge-90000',{...winningReceipt,round:15,score:85125}).achieved);
assert(achievement({},'challenge-80000',{...winningReceipt,round:15,score:85125}).achieved);
const previous=localAchievements(state,{},baseline),later=localAchievements(complete,{},winningReceipt);
assert(previous.every(item=>later.find(next=>next.key===item.key).progress>=item.progress),'normal persistent growth never lowers achievement progress');
let current=structuredClone(state),calls=[],openCalls=[],host={getLeaderboardManager:()=>({submitScores:options=>calls.push(options),openLeaderboard:options=>{openCalls.push(options);options.callback.onSuccess();}})};
const timers=new Map();let tick=0;
const service=createPlatformProgress({readState:()=>current,readChallengeResult:()=>best,getTap:()=>host,confirmedAchievements:{},setTimer:fn=>{timers.set(++tick,fn);return tick;},clearTimer:id=>timers.delete(id)});
const before=JSON.stringify(current);
let request=service.syncChallengeLeaderboard();assert.equal(calls.length,1);assert.equal(service.getStatus().submittedChallengeScore,-1);
const concurrent=service.syncChallengeLeaderboard();assert.equal(calls.length,1,'in-flight requests coalesce');
calls[0].callback.onFailure({errMsg:'denied'});assert.equal((await request).ok,false);assert.equal((await concurrent).ok,false);
request=service.syncChallengeLeaderboard();assert.equal(calls.length,2);calls[0].callback.onSuccess();assert.equal(service.getStatus().submittedChallengeScore,-1,'late failed callback cannot confirm new request');
calls[1].callback.onSuccess();calls[1].callback.onFailure('duplicate');assert((await request).ok);assert.equal(service.getStatus().submittedChallengeScore,baseline.score);
assert((await service.syncChallengeLeaderboard()).skipped);assert.equal(calls.length,2);
request=service.syncChallengeLeaderboard({force:true});assert.equal(calls.length,3);[...timers.values()][0]();assert.equal((await request).ok,false);
request=service.syncChallengeLeaderboard({force:true});calls[2].callback.onSuccess();assert.equal(calls.length,4);calls[3].callback.onSuccess();assert((await request).ok);
current={...current,factionCompleted:{1:[ids[0]]}};
best={...baseline,round:baseline.round+1,score:baseline.score-1000};
request=service.syncChallengeLeaderboard({force:true});assert.equal(calls[4].scores[0].score,baseline.score,'best score cannot regress');calls[4].callback.onSuccess();await request;
assert((await service.openChallengeLeaderboard()).ok);assert.equal(openCalls[0].leaderboardId,PLATFORM_PROGRESS_BINDING.challengeLeaderboardId);assert.equal(openCalls[0].collection,'public');
const nativeFailure=createPlatformProgress({readState:()=>state,readChallengeResult:()=>baseline,getTap:()=>({getLeaderboardManager:()=>({
  submitScores:options=>options.callback.onFailure(500,'提交失败，请重试。'),
  openLeaderboard:options=>options.callback.onFailure(500,'打开失败，请重试。'),
})})});
assert.equal((await nativeFailure.syncChallengeLeaderboard()).error,'提交失败，请重试。（500）');
assert.equal((await nativeFailure.openChallengeLeaderboard()).error,'打开失败，请重试。（500）');
current=structuredClone(state);assert.equal(JSON.stringify(current),before);
assert((await service.syncAchievements()).unconfigured);assert(service.openAchievements().unconfigured);
const absent=createPlatformProgress({readState:()=>state,readChallengeResult:()=>baseline,getTap:()=>undefined});assert.equal((await absent.syncChallengeLeaderboard()).ok,false);assert.equal((await absent.openChallengeLeaderboard()).ok,false);
const throwing=createPlatformProgress({readState:()=>state,readChallengeResult:()=>baseline,getTap:()=>({getLeaderboardManager(){throw new Error('host failure');}})});assert.match((await throwing.syncChallengeLeaderboard()).error,/host failure/);
const zero=createPlatformProgress({readState:()=>({}),getTap:()=>{throw new Error('must not touch host');}});assert((await zero.syncChallengeLeaderboard()).skipped);
const progressOnly=createPlatformProgress({readState:()=>complete,getTap:()=>{throw new Error('180 progress is not a challenge result');}});assert((await progressOnly.syncChallengeLeaderboard()).skipped);
for(const invalid of [{...baseline,challengeId:'another-edition'},{...baseline,score:baseline.score+1},{...baseline,won:false},null]) {
 const rejected=createPlatformProgress({readState:()=>state,readChallengeResult:()=>invalid,getTap:()=>{throw new Error('invalid receipt must not submit');}});
 assert((await rejected.syncChallengeLeaderboard()).skipped);assert.equal(rejected.challengeScore(),0);
}
let listener,unlocks=[],shown=0;
const achievements=createPlatformProgress({readState:()=>state,confirmedAchievements:{'first-victory':'verified-id'},achievementsPublished:true,getTap:()=>({createAchievementManager:options=>{assert.deepEqual(options,{toastEnable:true});return {registerListener:value=>{listener=value;},unlockAchievement:value=>unlocks.push(value),showAchievements:()=>{shown++;}};}})});
let prematureViewCalls=0;
const unpublished=createPlatformProgress({readState:()=>state,achievementsPublished:false,getTap:()=>({createAchievementManager(){prematureViewCalls++;throw new Error('Unconfirmed platform view must not open');}})});
assert.equal(unpublished.getCapabilities().achievementView,false);
assert.match(unpublished.showAchievements().error,/发布状态待确认/);
assert.equal(prematureViewCalls,0);
const partialHost=createPlatformProgress({readState:()=>state,getTap:()=>({getLeaderboardManager:()=>({submitScores(){}})})});
assert.equal(partialHost.getCapabilities().leaderboard,false,'submit-only bridge cannot advertise a visible native page');
request=achievements.syncAchievements();assert.deepEqual(unlocks,[{achievementId:'verified-id'}]);assert.equal(achievements.getAchievements()[0].synced,false);
listener.onAchievementSuccess(0,{achievementId:'unknown'});assert.equal(achievements.getAchievements()[0].synced,false);
listener.onAchievementFailure('verified-id',1,'retry');assert.equal((await request).ok,false);
request=achievements.syncAchievements();assert.equal(unlocks.length,2);listener.onAchievementSuccess(0,{achievementId:'verified-id'});assert((await request).ok);assert(achievements.getAchievements()[0].synced);
assert((await achievements.syncAchievements()).skipped);assert(achievements.openAchievements().ok);assert.equal(shown,1);
assert.equal((await createPlatformProgress({readState:()=>state,confirmedAchievements:{'first-victory':'verified-id'},getTap:()=>undefined}).syncAchievements()).ok,false);
service.dispose();achievements.dispose();assert.equal((await service.syncChallengeLeaderboard()).ok,false);
// Migrated progress is evaluated directly; no new local victory is required.
let lateListener,lateUnlocks=0,lateTimers=new Map(),lateTick=0;
const late=createPlatformProgress({readState:()=>complete,confirmedAchievements:historicalSix,achievementsPublished:false,getTap:()=>({createAchievementManager:()=>({
 registerListener:value=>{lateListener=value;},unlockAchievement:()=>{lateUnlocks++;},
})}),setTimer:fn=>{lateTimers.set(++lateTick,fn);return lateTick;},clearTimer:id=>lateTimers.delete(id)});
const lateRequest=late.syncAchievements(),lateConcurrent=late.syncAchievements();
assert.equal(lateUnlocks,6,'all six old-save achievements submit once across concurrent syncs');
assert.equal(late.getStatus().achievements.state,'pending');
for(const fn of [...lateTimers.values()])fn();
assert.equal((await lateRequest).ok,false);assert.equal((await lateConcurrent).ok,false);
for(const item of localAchievements(complete,historicalSix))lateListener.onAchievementSuccess(0,{achievementId:({
 'first-victory':'LXFirstVictory','faction-3':'LXFaction3','faction-15':'LXFaction15',
 'faction-30':'LXFaction30','all-factions':'LXAllFactions','collection-150':'LXCollection150',
})[item.key]});
assert(late.getAchievements().filter(item=>item.configured).every(item=>item.synced));
assert(late.getAchievements().filter(item=>!item.configured).every(item=>!item.synced));
assert.equal(late.getStatus().achievements.state,'synced','late authoritative success repairs timeout status');
assert((await late.syncAchievements()).skipped);assert.equal(lateUnlocks,6);
assert.deepEqual(late.getCapabilities(),{leaderboard:false,collection:false,challenge:false,achievements:true,achievementView:false});
late.dispose();lateListener.onAchievementFailure('LXFirstVictory',1,'late failure');
assert.equal(late.getStatus().achievements.state,'stopped');
let openingCallback;
let openTimer;
const delayedPanel=createPlatformProgress({readState:()=>state,setTimer:fn=>(openTimer=fn,1),clearTimer(){},getTap:()=>({getLeaderboardManager:()=>({openLeaderboard(){}})})});
const delayedOpen=delayedPanel.openLeaderboard();openTimer();
assert.equal((await delayedOpen).uncertain,true,'missing panel callback cannot authorize showing the game modal over a host page');
delayedPanel.dispose();
const stopping=createPlatformProgress({readState:()=>state,getTap:()=>({getLeaderboardManager:()=>({openLeaderboard:value=>{openingCallback=value.callback;}})})});
const opening=stopping.openChallengeLeaderboard();stopping.dispose();
assert.equal((await opening).ok,false,'dispose cancels pending native panel request');
openingCallback.onSuccess();assert.equal(stopping.getStatus().challenge.state,'stopped');
assert.deepEqual(stopping.getCapabilities(),{leaderboard:false,collection:false,challenge:false,achievements:false,achievementView:false});
const unreadable=createPlatformProgress({readState:()=>{throw new Error('存档不可读');},readChallengeResult:()=>{throw new Error('挑战不可读');}});
assert.equal((await unreadable.syncAchievements()).error,'存档不可读');
assert.equal(unreadable.getStatus().achievements.state,'error');
assert.equal((await unreadable.syncChallengeLeaderboard()).error,'挑战不可读');
assert.equal(unreadable.getStatus().challenge.state,'error');unreadable.dispose();
// Campaign progress has an independent binding and independent best score.
const unbound=createPlatformProgress({readState:()=>complete,binding:{...PLATFORM_PROGRESS_BINDING,campaignLeaderboardId:'',leaderboardId:''},getTap:()=>{throw new Error('unbound must not touch host');}});
assert((await unbound.syncLeaderboard()).unconfigured);assert((await unbound.openLeaderboard()).unconfigured);
assert.equal(unbound.score(),EXPEDITION_LEVELS.length*6);assert.equal(PLATFORM_PROGRESS_BINDING.leaderboardId,PLATFORM_PROGRESS_BINDING.campaignLeaderboardId);
let campaignState={legacyUnlockedLevels:ids},campaignCalls=[],campaignOpen=[];
const campaign=createPlatformProgress({readState:()=>campaignState,readChallengeResult:()=>baseline,
 binding:{...PLATFORM_PROGRESS_BINDING,campaignLeaderboardId:'test-campaign'},
 getTap:()=>({getLeaderboardManager:()=>({submitScores:value=>campaignCalls.push(value),openLeaderboard:value=>{campaignOpen.push(value);value.callback.onSuccess();}})})});
assert((await campaign.syncLeaderboard()).skipped);assert.equal(campaignCalls.length,0,'legacy shared access is not campaign completion');
campaignState=structuredClone(state);
let campaignRequest=campaign.syncLeaderboard();assert.equal(campaignCalls[0].scores[0].score,2,'old progress submits without a new victory');
campaignCalls[0].callback.onFailure(1,'retry');assert.equal((await campaignRequest).ok,false);assert.equal(campaign.getStatus().submittedScore,-1);
campaignRequest=campaign.syncLeaderboard();campaignCalls[1].callback.onSuccess();await campaignRequest;
assert((await campaign.syncLeaderboard()).skipped);assert.equal(campaignCalls.length,2,'same score deduplicates after success');
campaignState={factionCompleted:{1:ids.slice(0,3)}};
campaignRequest=campaign.syncLeaderboard();
campaignState={factionCompleted:{1:ids.slice(0,4)}};
const campaignHigher=campaign.syncLeaderboard();assert.equal(campaignCalls.length,3,'higher concurrent score waits for current submit');
campaignCalls[2].callback.onSuccess();await campaignRequest;await Promise.resolve();
assert.equal(campaignCalls.length,4);assert.equal(campaignCalls[3].scores[0].score,4);campaignCalls[3].callback.onSuccess();await campaignHigher;
campaignState=structuredClone(state);campaignRequest=campaign.syncLeaderboard({force:true});
assert.equal(campaignCalls[4].scores[0].score,4,'confirmed campaign best cannot regress');campaignCalls[4].callback.onSuccess();await campaignRequest;
const challengeRequest=campaign.syncChallengeLeaderboard();assert.equal(campaignCalls[5].scores[0].leaderboardId,PLATFORM_PROGRESS_BINDING.challengeLeaderboardId);
assert.equal(campaignCalls[5].scores[0].score,baseline.score);campaignCalls[5].callback.onSuccess();await challengeRequest;
assert.equal(campaign.getStatus().submittedScore,4);assert.equal(campaign.getStatus().submittedChallengeScore,baseline.score);
await campaign.openLeaderboard();await campaign.openChallengeLeaderboard();
assert.deepEqual(campaignOpen.map(value=>value.leaderboardId),['test-campaign',PLATFORM_PROGRESS_BINDING.challengeLeaderboardId]);
assert.deepEqual(campaign.getCapabilities(),{leaderboard:true,collection:true,challenge:true,achievements:false,achievementView:false});campaign.dispose();unbound.dispose();
assert.equal(PLATFORM_PROGRESS_BINDING.campaignLeaderboardId,'fr0m7qzhn7va29tri8');
assert.equal(PLATFORM_PROGRESS_BINDING.collectionLeaderboardId,'kwas6xeb3nql1ovw5v');
assert.equal(new Set([PLATFORM_PROGRESS_BINDING.campaignLeaderboardId,PLATFORM_PROGRESS_BINDING.collectionLeaderboardId,PLATFORM_PROGRESS_BINDING.challengeLeaderboardId]).size,3);
const legalUnit=CARD_ACQUISITION.find(card=>card.type==='unit').id,otherUnit=CARD_ACQUISITION.filter(card=>card.type==='unit')[1].id,legalSpell=CARD_ACQUISITION.find(card=>card.type==='spell').id;
const dirtyCollection={inventory:{units:[legalUnit,legalUnit,1,9101,999999],spells:[legalSpell,legalSpell,legalUnit,999999]}};
assert.deepEqual(collectionProgressStats(dirtyCollection),{units:1,spells:1,total:2,available:CARD_ACQUISITION.length});
assert.equal(collectionProgressStats(complete).total,168);assert.equal(collectionProgressStats(complete).available,168);
assert.equal(achievement(dirtyCollection,'collection-60').progress,2,'collection achievement excludes duplicates, tokens, generals and unknown cards');
assert.equal(achievement(dirtyCollection,'units-60').progress,1);
assert.equal(achievement(dirtyCollection,'spells-20').progress,1);
for(const [metric,targets,type] of [['collection',[60,100,125,150,168],null],['units',[60,90,120],'unit'],['spells',[20,35,48],'spell']])for(const target of targets){
 const pool=CARD_ACQUISITION.filter(card=>!type||card.type===type);
 const inventoryFor=count=>({inventory:{units:pool.slice(0,count).filter(card=>card.type==='unit').map(card=>card.id),spells:pool.slice(0,count).filter(card=>card.type==='spell').map(card=>card.id)}});
 assert(!achievement(inventoryFor(target-1),`${metric}-${target}`).achieved);
 assert(achievement(inventoryFor(target),`${metric}-${target}`).achieved);
}
let collectionState={inventory:{units:[1,9101],spells:[]}},collectionCalls=[],collectionOpens=[];
const collector=createPlatformProgress({readState:()=>collectionState,readChallengeResult:()=>baseline,confirmedAchievements:{},getTap:()=>({getLeaderboardManager:()=>({
 submitScores:value=>collectionCalls.push(value),openLeaderboard:value=>{collectionOpens.push(value.leaderboardId);value.callback.onSuccess();},
})})});
assert((await collector.syncCollectionLeaderboard()).skipped);assert.equal(collectionCalls.length,0,'generals and enemy tokens do not submit');
collectionState=structuredClone(dirtyCollection);let collecting=collector.syncCollectionLeaderboard();
assert.deepEqual(collectionCalls[0].scores,[{leaderboardId:PLATFORM_PROGRESS_BINDING.collectionLeaderboardId,score:2}]);
const collectionDuplicate=collector.syncCollectionLeaderboard();assert.equal(collectionCalls.length,1,'in-flight same collection coalesces');
collectionCalls[0].callback.onFailure(500,'收藏失败');assert.equal((await collecting).ok,false);assert.equal((await collectionDuplicate).ok,false);assert.equal(collector.getStatus().submittedCollectionScore,-1);
collecting=collector.syncCollectionLeaderboard();collectionCalls[1].callback.onSuccess();await collecting;
assert((await collector.syncCollectionLeaderboard()).skipped);assert.equal(collectionCalls.length,2);
collectionState.inventory.units.push(otherUnit);collecting=collector.syncCollectionLeaderboard();assert.equal(collectionCalls[2].scores[0].score,3);collectionCalls[2].callback.onSuccess();await collecting;
assert.equal(collector.collectionScore(),3);assert.equal(collector.getStatus().collection.state,'synced');assert.equal(collector.getStatus().submittedScore,-1,'collection does not confirm campaign score');
await collector.openCollectionLeaderboard();assert.deepEqual(collectionOpens,[PLATFORM_PROGRESS_BINDING.collectionLeaderboardId]);collector.dispose();
// Startup synchronization submits existing campaign and collection progress only.
const startupCalls=[],startup=createPlatformProgress({readState:()=>({...dirtyCollection,factionCompleted:state.factionCompleted}),readChallengeResult:()=>baseline,confirmedAchievements:{},getTap:()=>({getLeaderboardManager:()=>({submitScores:value=>{startupCalls.push(value.scores[0]);value.callback.onSuccess();}})})});
const startupResult=await startup.sync();assert(startupResult.leaderboard.ok&&startupResult.collection.ok);
assert.deepEqual(startupCalls.sort((a,b)=>a.leaderboardId.localeCompare(b.leaderboardId)),[
 {leaderboardId:PLATFORM_PROGRESS_BINDING.campaignLeaderboardId,score:2},{leaderboardId:PLATFORM_PROGRESS_BINDING.collectionLeaderboardId,score:2},
].sort((a,b)=>a.leaderboardId.localeCompare(b.leaderboardId)));
assert.equal(startup.getStatus().submittedChallengeScore,-1);await startup.sync();assert.equal(startupCalls.length,2,'unchanged startup progress does not repeat submit');startup.dispose();
// The service derives existing persisted best results without requiring another attempt.
let existingBest=winningReceipt,challengeAchievementListener,challengeAchievementUnlocks=[];
const challengeAchievements=createPlatformProgress({readState:()=>({}),readChallengeResult:()=>existingBest,confirmedAchievements:{'challenge-first-victory':'test-challenge'},getTap:()=>({createAchievementManager:()=>({
 registerListener:value=>{challengeAchievementListener=value;},unlockAchievement:value=>{challengeAchievementUnlocks.push(value.achievementId);},
})})});
assert(challengeAchievements.getAchievements().filter(item=>item.category==='challenge').every(item=>item.achieved));
const challengeAchievementSync=challengeAchievements.syncAchievements();assert.deepEqual(challengeAchievementUnlocks,['test-challenge']);
challengeAchievementListener.onAchievementSuccess(0,{achievementId:'test-challenge'});assert((await challengeAchievementSync).ok);
existingBest={...winningReceipt,score:95126};
assert(challengeAchievements.getAchievements().filter(item=>item.category==='challenge').every(item=>!item.achieved));
challengeAchievements.dispose();
// The published default binding drains all 53 already-earned entries without a new battle.
const allBefore=JSON.stringify({state:complete,receipt:winningReceipt}),allCalls=[];
let allListener,allShown=0;
const allPublished=createPlatformProgress({readState:()=>complete,readChallengeResult:()=>winningReceipt,getTap:()=>({createAchievementManager:()=>({
 registerListener:value=>{allListener=value;},unlockAchievement:({achievementId})=>{allCalls.push(achievementId);allListener.onAchievementSuccess(0,{achievementId});},showAchievements:()=>{allShown++;},
})})});
assert((await allPublished.syncAchievements()).ok);
assert.deepEqual([...allCalls].sort(),Object.values(expectedBindings).sort());
assert.equal(new Set(allCalls).size,53);assert(allPublished.getAchievements().filter(item=>item.configured).every(item=>item.achieved&&item.synced));
assert((await allPublished.syncAchievements()).skipped);assert.equal(allCalls.length,53);
assert(allPublished.showAchievements().ok);assert.equal(allShown,1);
assert.equal(JSON.stringify({state:complete,receipt:winningReceipt}),allBefore,'achievement synchronization never grants rewards or alters profile/schema/challenge');allPublished.dispose();
// All published IDs coalesce independently; one failure and one timeout cannot mark the cohort synced.
let cohortListener,cohortTick=0;const cohortUnlocks=[],cohortTimers=new Map();
const cohort=createPlatformProgress({readState:()=>complete,readChallengeResult:()=>winningReceipt,setTimer:fn=>{cohortTimers.set(++cohortTick,fn);return cohortTick;},clearTimer:id=>cohortTimers.delete(id),getTap:()=>({createAchievementManager:()=>({registerListener:value=>{cohortListener=value;},unlockAchievement:({achievementId})=>{cohortUnlocks.push(achievementId);}})})});
const cohortRequest=cohort.syncAchievements(),cohortConcurrent=cohort.syncAchievements();assert.equal(cohortUnlocks.length,53);
cohortListener.onAchievementSuccess(0,{achievementId:'unknown-unconfigured'});assert.equal(cohort.getAchievements().filter(item=>item.synced).length,0);
for(const id of cohortUnlocks.slice(2))cohortListener.onAchievementSuccess(0,{achievementId:id});
cohortListener.onAchievementFailure(cohortUnlocks[0],500,'cohort retry');
assert.equal(cohortTimers.size,1);[...cohortTimers.values()][0]();
assert.equal((await cohortRequest).ok,false);assert.equal((await cohortConcurrent).ok,false);
assert.equal(cohort.getAchievements().filter(item=>item.synced).length,51);
const cohortRetry=cohort.syncAchievements();assert.deepEqual(cohortUnlocks.slice(53),cohortUnlocks.slice(0,2),'only unresolved IDs retry');
for(const id of cohortUnlocks.slice(0,2))cohortListener.onAchievementSuccess(0,{achievementId:id});
assert((await cohortRetry).ok);assert.equal(cohort.getStatus().achievements.state,'synced');assert(cohort.getAchievements().filter(item=>item.configured).every(item=>item.synced));cohort.dispose();
// An unconfigured catalog key and an unknown mapped key must never be submitted.
const partialIds={...expectedBindings,'not-in-catalog':'must-not-submit'};delete partialIds['chapter-border-march'];
let partialListener;const partialUnlocks=[];
const partial=createPlatformProgress({readState:()=>complete,readChallengeResult:()=>winningReceipt,confirmedAchievements:partialIds,getTap:()=>({createAchievementManager:()=>({registerListener:value=>{partialListener=value;},unlockAchievement:({achievementId})=>{partialUnlocks.push(achievementId);partialListener.onAchievementSuccess(0,{achievementId});}})})});
assert((await partial.syncAchievements()).ok);assert.equal(partialUnlocks.length,52);
assert(!partialUnlocks.includes(expectedBindings['chapter-border-march']));assert(!partialUnlocks.includes('must-not-submit'));partial.dispose();
// Frozen historical profiles migrate through the production loader before backlog sync.
let historicalEarned=0;
for(const file of ['save-contract-profile8-pre-daily-2026-10-13.json','save-contract-profile10-pre-random-2026-10-14.json','save-contract-profile11-pre-fragments-2026-10-15.json','save-contract-profile12-pre-gifts-2026-10-16.json']){
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/'+file,import.meta.url),'utf8'));
 for(const profile of fixture.profiles){
  const saved=new Map([[SAVE_KEYS.expedition,JSON.stringify(profile)]]),storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
  const migrated=new ExpeditionProgress(storage);assert.equal(migrated.error,'',file);
  const beforeSync=JSON.stringify([...saved]),profileBefore=JSON.stringify(migrated.state),sent=[];let migratedListener;
  const backlog=createPlatformProgress({readState:()=>migrated.state,getTap:()=>({createAchievementManager:()=>({registerListener:value=>{migratedListener=value;},unlockAchievement:({achievementId})=>{sent.push(achievementId);migratedListener.onAchievementSuccess(0,{achievementId});}})})});
  const earned=localAchievements(migrated.state).filter(item=>item.achieved).map(item=>expectedBindings[item.key]);historicalEarned+=earned.length;
  assert((await backlog.syncAchievements()).ok);assert.deepEqual(sent.sort(),earned.sort(),file+' migrated earned backlog');
  assert.equal(JSON.stringify([...saved]),beforeSync,file+' platform sync must not write save bytes or rewards');
  assert.equal(JSON.stringify(migrated.state),profileBefore,file+' profile/schema unchanged by platform sync');backlog.dispose();
 }
}
assert(historicalEarned>0,'frozen fixtures must exercise real earned backlog, not only empty progress');
console.log('platform progress: campaign/collection/challenge binding isolation, legal unique collection, startup backlog, zero guards, best/idempotency, concurrent increments, failure/timeout retry, late callbacks, dispose and achievements passed');
