import { EXPEDITION_LEVELS } from './expedition-data.js';
import { CARD_ACQUISITION } from './campaign-content.js';
import { rankedChallengeScore } from './ranked-challenge.js';

// Public application binding only. The leaderboard currently requires whitelist
// access; this module does not publish it or store authentication/player data.
export const PLATFORM_PROGRESS_BINDING = Object.freeze({developerId:488823,appId:970030,miniAppId:'tapmc7l6utbabjpzgk',leaderboardId:'du5ahriaooqy2yejyy'});
// IDs read back from app 970030 on 2026-10-18. Creation/review is separate
// from publication; unpublished achievements remain limited by TapTap testing.
export const ACHIEVEMENTS_PUBLISHED = false;
export const CONFIRMED_ACHIEVEMENTS = Object.freeze({
  'first-victory':'LXFirstVictory','faction-3':'LXFaction3','faction-15':'LXFaction15',
  'faction-30':'LXFaction30','all-factions':'LXAllFactions','collection-150':'LXCollection150',
});
const levels=new Set(EXPEDITION_LEVELS.map(level=>level.id));
const cards=new Set(CARD_ACQUISITION.map(card=>card.id));
const countLegal=values=>new Set((Array.isArray(values)?values:[]).filter(id=>levels.has(id))).size;
export function platformProgressStats(state={}) {
  const factions=Array.from({length:6},(_,index)=>countLegal(state?.factionCompleted?.[index+1]));
  const collection=new Set([...(state?.inventory?.units??[]),...(state?.inventory?.spells??[])].filter(id=>cards.has(id))).size;
  return {factions,score:factions.reduce((sum,count)=>sum+count,0),collection};
}
export const ACHIEVEMENT_CATALOG = Object.freeze([
  Object.freeze({key:'first-victory',name:'首场胜利',target:1,metric:'total'}),
  ...[3,15,30].map(target=>Object.freeze({key:`faction-${target}`,name:target===3?'初露锋芒（单阵营3关）':`任一阵营通关${target}关`,target,metric:'faction'})),
  Object.freeze({key:'all-factions',name:'六阵营全通',target:180,metric:'total'}),
  Object.freeze({key:'collection-150',name:'收藏150张卡牌',target:150,metric:'collection'}),
]);
export function localAchievements(state,confirmed=CONFIRMED_ACHIEVEMENTS) {
  const stats=platformProgressStats(state);
  return ACHIEVEMENT_CATALOG.map(item=>{
    const progress=item.metric==='faction'?Math.max(...stats.factions):item.metric==='collection'?stats.collection:stats.score;
    return {...item,progress:Math.min(progress,item.target),achieved:progress>=item.target,configured:typeof confirmed[item.key]==='string'&&!!confirmed[item.key].trim()};
  });
}
const errorText=error=>typeof error==='string'?error:error?.message||error?.errMsg||'平台操作失败，请重试。';

/** In-memory adapter: readState is evaluated on every sync after profile refresh. */
export function createPlatformProgress({readState,readChallengeResult=()=>null,getTap=()=>globalThis.tap,confirmedAchievements=CONFIRMED_ACHIEVEMENTS,timeoutMs=10000,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  if(typeof readState!=='function')throw new TypeError('readState must be a function');
  let submitted=-1,leaderPending=null,achievementManager=null,disposed=false;
  const unlocked=new Set(),pending=new Map(),confirmed={...confirmedAchievements};
  let leaderboardStatus={state:'idle',message:'排行榜尚未同步。'},achievementStatus=Object.values(confirmed).some(id=>typeof id==='string'&&id.trim())
    ? {state:'idle',message:'平台成就已配置，尚未发布。'}
    : {state:'unconfigured',message:'平台成就尚未配置，达成记录按本机进度显示。'};
  function timedRequest(invoke,onSuccess) {
    let finish;
    const promise=new Promise(resolve=>{
      let settled=false,timer;
      finish=result=>{if(settled)return;settled=true;clearTimer(timer);if(result.ok)onSuccess?.();resolve(result);};
      timer=setTimer(()=>finish({ok:false,error:'平台响应超时，请重试。'}),timeoutMs);
      try{invoke(()=>finish({ok:true}),error=>finish({ok:false,error:errorText(error)}));}catch(error){finish({ok:false,error:errorText(error)});}
    });
    return {promise,cancel:()=>finish({ok:false,error:'平台同步已停止。'})};
  }
  function managerForLeaderboard() {
    const tap=getTap();if(typeof tap?.getLeaderboardManager!=='function')throw new Error('请在支持排行榜的TapTap游戏内使用。');
    const manager=tap.getLeaderboardManager();if(!manager)throw new Error('排行榜暂不可用。');return manager;
  }
  async function syncLeaderboard({force=false}={}) {
    if(disposed)return {ok:false,error:'平台同步已停止。'};
    let score;try{score=rankedChallengeScore(readChallengeResult());}catch(error){return {ok:false,error:errorText(error)};}
    if(score===0)return {ok:true,skipped:true};
    if(leaderPending){const active=leaderPending,result=await active.promise;return score<=active.score?result:syncLeaderboard({force});}
    if(!force&&score<=submitted)return {ok:true,skipped:true};
    // A best-score leaderboard must not be replaced by a lower refreshed profile.
    score=Math.max(score,submitted);
    leaderboardStatus={state:'pending',message:'正在同步挑战成绩。'};
    const request=timedRequest((success,failure)=>{
      const manager=managerForLeaderboard();if(typeof manager.submitScores!=='function')throw new Error('当前宿主不支持提交排行榜。');
      manager.submitScores({scores:[{leaderboardId:PLATFORM_PROGRESS_BINDING.leaderboardId,score}],callback:{onSuccess:success,onFailure:(code,message)=>failure(message??code)}});
    },()=>{submitted=Math.max(submitted,score);});
    request.score=score;leaderPending=request;
    const result=await request.promise;
    if(leaderPending===request)leaderPending=null;
    leaderboardStatus={state:result.ok?'synced':'error',message:result.ok?'挑战成绩已同步。':result.error};
    return result;
  }
  async function openLeaderboard() {
    if(disposed)return {ok:false,error:'平台同步已停止。'};
    return timedRequest((success,failure)=>{
      const manager=managerForLeaderboard();if(typeof manager.openLeaderboard!=='function')throw new Error('当前宿主不支持查看排行榜。');
      manager.openLeaderboard({leaderboardId:PLATFORM_PROGRESS_BINDING.leaderboardId,collection:'public',callback:{onSuccess:success,onFailure:(code,message)=>failure(message??code)}});
    }).promise;
  }
  // Verified official contracts (2026-10-18): creation returns a synchronous
  // singleton; showAchievements takes no arguments and has no completion callback.
  // https://developer.taptap.cn/minigameapidoc/dev/api/open-api/achievements/tap.createAchievementManager/
  // https://developer.taptap.cn/minigameapidoc/dev/api/open-api/achievements/AchievementManager.registerListener/
  // https://developer.taptap.cn/minigameapidoc/dev/api/open-api/achievements/AchievementManager.unlockAchievement/
  // https://developer.taptap.cn/minigameapidoc/dev/api/open-api/achievements/AchievementManager.showAchievements/
  function getAchievementManager() {
    if(achievementManager)return achievementManager;
    const tap=getTap();if(typeof tap?.createAchievementManager!=='function')throw new Error('请在支持成就的TapTap游戏内使用。');
    const manager=tap.createAchievementManager({toastEnable:true});
    if(typeof manager?.registerListener!=='function'||typeof manager?.unlockAchievement!=='function')throw new Error('当前宿主不支持同步成就。');
    manager.registerListener({
      onAchievementSuccess:(_code,achievement)=>{
        if(disposed)return;
        const id=achievement?.achievementId;
        // Tap supplies no request ID. A matching success is authoritative for
        // this achievement, including a response arriving after a timeout.
        if(!Object.values(confirmed).includes(id))return;
        unlocked.add(id);pending.get(id)?.success();
      },
      onAchievementFailure:(id,_code,message)=>{if(!disposed)pending.get(id)?.failure(message);},
    });
    achievementManager=manager;return manager;
  }
  async function syncAchievements() {
    if(disposed)return {ok:false,error:'平台同步已停止。'};
    let achievements;try{achievements=localAchievements(readState(),confirmed);}catch(error){return {ok:false,error:errorText(error)};}
    if(!achievements.some(item=>item.configured))return {ok:false,unconfigured:true,error:achievementStatus.message};
    const eligible=achievements.filter(item=>item.configured&&item.achieved&&!unlocked.has(confirmed[item.key]));
    if(!eligible.length)return {ok:true,skipped:true};
    const results=await Promise.all(eligible.map(item=>{
      const id=confirmed[item.key];if(pending.has(id))return pending.get(id).promise;
      // Initialize listener before registering the attempt, to handle a host
      // that invokes success synchronously from unlockAchievement.
      let manager;try{manager=getAchievementManager();}catch(error){return Promise.resolve({ok:false,error:errorText(error)});}
      let success,failure;
      const request=timedRequest((ok,fail)=>{success=ok;failure=fail;});
      const entry={...request,success,failure};pending.set(id,entry);
      try{manager.unlockAchievement({achievementId:id});}catch(error){failure(error);}
      return request.promise.then(result=>{if(pending.get(id)===entry)pending.delete(id);return result;});
    }));
    const failed=results.find(result=>!result.ok);
    achievementStatus={state:failed?'error':'synced',message:failed?failed.error:'已达成成就已同步。'};
    return failed??{ok:true};
  }
  function showAchievements() {
    if(disposed)return {ok:false,error:'平台同步已停止。'};
    if(!Object.values(confirmed).some(id=>typeof id==='string'&&id.trim()))return {ok:false,unconfigured:true,error:'平台成就尚未配置，达成记录按本机进度显示。'};
    try{const manager=getAchievementManager();if(typeof manager.showAchievements!=='function')throw new Error('当前宿主不支持查看成就。');manager.showAchievements();return {ok:true};}catch(error){return {ok:false,error:errorText(error)};}
  }
  return {
    syncLeaderboard,openLeaderboard,syncAchievements,showAchievements,openAchievements:showAchievements,
    score(){return rankedChallengeScore(readChallengeResult());},
    async sync(options){const [leaderboard,achievements]=await Promise.all([syncLeaderboard(options),syncAchievements()]);return {leaderboard,achievements};},
    getStatus(){return {leaderboard:{...leaderboardStatus},achievements:{...achievementStatus},submittedScore:submitted};},
    getAchievements(){return localAchievements(readState(),confirmed).map(item=>({...item,synced:item.configured&&unlocked.has(confirmed[item.key])}));},
    dispose(){disposed=true;leaderPending?.cancel();for(const request of pending.values())request.cancel();pending.clear();},
  };
}
