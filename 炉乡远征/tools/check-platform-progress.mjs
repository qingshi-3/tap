import assert from 'node:assert/strict';
import {createPlatformProgress,platformProgressStats,localAchievements,PLATFORM_PROGRESS_BINDING} from '../dist/js/platform-progress.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
import {CARD_ACQUISITION} from '../dist/js/campaign-content.js';
import {readFileSync} from 'node:fs';
const baseline=JSON.parse(readFileSync(new URL('./fixtures/ranked-challenge-v1-current.json',import.meta.url),'utf8')).bestResult;
let best=structuredClone(baseline);
const ids=EXPEDITION_LEVELS.map(level=>level.id);
const state={factionCompleted:{1:[ids[0],ids[0],'forged'],2:[ids[0]],7:ids},legacyUnlockedLevels:ids,inventory:{units:[14,14,999999],spells:[]}};
assert.deepEqual(platformProgressStats(state),{score:2,factions:[1,1,0,0,0,0],collection:1});
const complete={factionCompleted:Object.fromEntries([1,2,3,4,5,6].map(id=>[id,ids])),inventory:{units:CARD_ACQUISITION.filter(c=>c.type==='unit').map(c=>c.id),spells:CARD_ACQUISITION.filter(c=>c.type==='spell').map(c=>c.id)}};
assert.equal(platformProgressStats(complete).score,180);assert(localAchievements(complete).every(a=>a.achieved&&a.configured));
assert(localAchievements(complete,{}).every(a=>a.achieved&&!a.configured));
let current=structuredClone(state),calls=[],openCalls=[],host={getLeaderboardManager:()=>({submitScores:options=>calls.push(options),openLeaderboard:options=>{openCalls.push(options);options.callback.onSuccess();}})};
const timers=new Map();let tick=0;
const service=createPlatformProgress({readState:()=>current,readChallengeResult:()=>best,getTap:()=>host,confirmedAchievements:{},setTimer:fn=>{timers.set(++tick,fn);return tick;},clearTimer:id=>timers.delete(id)});
const before=JSON.stringify(current);
let request=service.syncLeaderboard();assert.equal(calls.length,1);assert.equal(service.getStatus().submittedScore,-1);
const concurrent=service.syncLeaderboard();assert.equal(calls.length,1,'in-flight requests coalesce');
calls[0].callback.onFailure({errMsg:'denied'});assert.equal((await request).ok,false);assert.equal((await concurrent).ok,false);
request=service.syncLeaderboard();assert.equal(calls.length,2);calls[0].callback.onSuccess();assert.equal(service.getStatus().submittedScore,-1,'late failed callback cannot confirm new request');
calls[1].callback.onSuccess();calls[1].callback.onFailure('duplicate');assert((await request).ok);assert.equal(service.getStatus().submittedScore,baseline.score);
assert((await service.syncLeaderboard()).skipped);assert.equal(calls.length,2);
request=service.syncLeaderboard({force:true});assert.equal(calls.length,3);[...timers.values()][0]();assert.equal((await request).ok,false);
request=service.syncLeaderboard({force:true});calls[2].callback.onSuccess();assert.equal(calls.length,4);calls[3].callback.onSuccess();assert((await request).ok);
current={...current,factionCompleted:{1:[ids[0]]}};
best={...baseline,round:baseline.round+1,score:baseline.score-1000};
request=service.syncLeaderboard({force:true});assert.equal(calls[4].scores[0].score,baseline.score,'best score cannot regress');calls[4].callback.onSuccess();await request;
assert((await service.openLeaderboard()).ok);assert.equal(openCalls[0].leaderboardId,PLATFORM_PROGRESS_BINDING.leaderboardId);assert.equal(openCalls[0].collection,'public');
const nativeFailure=createPlatformProgress({readState:()=>state,readChallengeResult:()=>baseline,getTap:()=>({getLeaderboardManager:()=>({
  submitScores:options=>options.callback.onFailure(500,'提交失败，请重试。'),
  openLeaderboard:options=>options.callback.onFailure(500,'打开失败，请重试。'),
})})});
assert.equal((await nativeFailure.syncLeaderboard()).error,'提交失败，请重试。');
assert.equal((await nativeFailure.openLeaderboard()).error,'打开失败，请重试。');
current=structuredClone(state);assert.equal(JSON.stringify(current),before);
assert((await service.syncAchievements()).unconfigured);assert(service.openAchievements().unconfigured);
const absent=createPlatformProgress({readState:()=>state,readChallengeResult:()=>baseline,getTap:()=>undefined});assert.equal((await absent.syncLeaderboard()).ok,false);assert.equal((await absent.openLeaderboard()).ok,false);
const throwing=createPlatformProgress({readState:()=>state,readChallengeResult:()=>baseline,getTap:()=>({getLeaderboardManager(){throw new Error('host failure');}})});assert.match((await throwing.syncLeaderboard()).error,/host failure/);
const zero=createPlatformProgress({readState:()=>({}),getTap:()=>{throw new Error('must not touch host');}});assert((await zero.syncLeaderboard()).skipped);
const progressOnly=createPlatformProgress({readState:()=>complete,getTap:()=>{throw new Error('180 progress is not a challenge result');}});assert((await progressOnly.syncLeaderboard()).skipped);
for(const invalid of [{...baseline,challengeId:'another-edition'},{...baseline,score:baseline.score+1},{...baseline,won:false},null]) {
 const rejected=createPlatformProgress({readState:()=>state,readChallengeResult:()=>invalid,getTap:()=>{throw new Error('invalid receipt must not submit');}});
 assert((await rejected.syncLeaderboard()).skipped);assert.equal(rejected.score(),0);
}
let listener,unlocks=[],shown=0;
const achievements=createPlatformProgress({readState:()=>state,confirmedAchievements:{'first-victory':'verified-id'},getTap:()=>({createAchievementManager:options=>{assert.deepEqual(options,{toastEnable:true});return {registerListener:value=>{listener=value;},unlockAchievement:value=>unlocks.push(value),showAchievements:()=>{shown++;}};}})});
request=achievements.syncAchievements();assert.deepEqual(unlocks,[{achievementId:'verified-id'}]);assert.equal(achievements.getAchievements()[0].synced,false);
listener.onAchievementSuccess(0,{achievementId:'unknown'});assert.equal(achievements.getAchievements()[0].synced,false);
listener.onAchievementFailure('verified-id',1,'retry');assert.equal((await request).ok,false);
request=achievements.syncAchievements();assert.equal(unlocks.length,2);listener.onAchievementSuccess(0,{achievementId:'verified-id'});assert((await request).ok);assert(achievements.getAchievements()[0].synced);
assert((await achievements.syncAchievements()).skipped);assert(achievements.openAchievements().ok);assert.equal(shown,1);
assert.equal((await createPlatformProgress({readState:()=>state,confirmedAchievements:{'first-victory':'verified-id'},getTap:()=>undefined}).syncAchievements()).ok,false);
service.dispose();achievements.dispose();assert.equal((await service.syncLeaderboard()).ok,false);
console.log('platform progress: legal score, zero guard, best/idempotency, failure/timeout retry, duplicate/late callback isolation, host failures and confirmed/unconfigured achievements passed');
