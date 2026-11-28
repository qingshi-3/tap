import { ORIGINAL_CAMPAIGN_LEVEL_IDS } from './adventure-access.js';
import { EXPEDITION_LEVELS, EXPEDITION_CHAPTERS } from './expedition-data.js';
import { CARD_ACQUISITION } from './campaign-content.js';
import { rankedChallengeScore } from './ranked-challenge.js';
import { FACTIONS } from './factions.js';

// Public application bindings only. Campaign/collection boards were created and
// published on 2026-10-21; the challenge retains its separate historical board.
export const PLATFORM_PROGRESS_BINDING = Object.freeze({developerId:488823,appId:970030,miniAppId:'tapmc7l6utbabjpzgk',leaderboardId:'fr0m7qzhn7va29tri8',campaignLeaderboardId:'fr0m7qzhn7va29tri8',collectionLeaderboardId:'kwas6xeb3nql1ovw5v',challengeLeaderboardId:'du5ahriaooqy2yejyy'});
// All 53 IDs were read back as published for app 970030 on 2026-10-22.
// Keep these stable: existing player unlocks belong to these platform IDs.
export const ACHIEVEMENTS_PUBLISHED = true;
export const CONFIRMED_ACHIEVEMENTS = Object.freeze({
  "first-victory": "LXFirstVictory",
  "faction-3": "LXFaction3",
  "faction-15": "LXFaction15",
  "faction-30": "LXFaction30",
  "all-factions": "LXAllFactions",
  "collection-150": "LXCollection150",
  "chapter-border-march": "LX_chapter_border_march",
  "chapter-sunken-road": "LX_chapter_sunken_road",
  "chapter-three-banners": "LX_chapter_three_banners",
  "chapter-sand-front": "LX_chapter_sand_front",
  "chapter-shadow-pass": "LX_chapter_shadow_pass",
  "chapter-frost-siege": "LX_chapter_frost_siege",
  "chapter-crossroads-front": "LX_chapter_crossroads_front",
  "chapter-citadel-circuit": "LX_chapter_citadel_circuit",
  "chapter-ruins-watch": "LX_chapter_ruins_watch",
  "chapter-confluence-final": "LX_chapter_confluence_final",
  "faction-1-10": "LX_faction_1_10",
  "faction-1-20": "LX_faction_1_20",
  "faction-1-30": "LX_faction_1_30",
  "faction-2-10": "LX_faction_2_10",
  "faction-2-20": "LX_faction_2_20",
  "faction-2-30": "LX_faction_2_30",
  "faction-3-10": "LX_faction_3_10",
  "faction-3-20": "LX_faction_3_20",
  "faction-3-30": "LX_faction_3_30",
  "faction-4-10": "LX_faction_4_10",
  "faction-4-20": "LX_faction_4_20",
  "faction-4-30": "LX_faction_4_30",
  "faction-5-10": "LX_faction_5_10",
  "faction-5-20": "LX_faction_5_20",
  "faction-5-30": "LX_faction_5_30",
  "faction-6-10": "LX_faction_6_10",
  "faction-6-20": "LX_faction_6_20",
  "faction-6-30": "LX_faction_6_30",
  "collection-60": "LX_collection_60",
  "collection-100": "LX_collection_100",
  "collection-125": "LX_collection_125",
  "collection-168": "LX_collection_168",
  "units-60": "LX_units_60",
  "units-90": "LX_units_90",
  "units-120": "LX_units_120",
  "spells-20": "LX_spells_20",
  "spells-35": "LX_spells_35",
  "spells-48": "LX_spells_48",
  "factions-started-2": "LX_factions_started_2",
  "factions-started-3": "LX_factions_started_3",
  "factions-started-6": "LX_factions_started_6",
  "total-30": "LX_total_30",
  "total-60": "LX_total_60",
  "total-120": "LX_total_120",
  "challenge-first-victory": "LX_challenge_first_victory",
  "challenge-80000": "LX_challenge_80000",
  "challenge-90000": "LX_challenge_90000"
});
export const CAMPAIGN_PROGRESS_MAX = EXPEDITION_LEVELS.length * FACTIONS.length;
const levels=new Set(EXPEDITION_LEVELS.map(level=>level.id));
const cards=new Set(CARD_ACQUISITION.map(card=>card.id));
const cardTypes=new Map(CARD_ACQUISITION.map(card=>[card.id,card.type]));
export function collectionProgressStats(state={}) {
  const inventory=state?.inventory;
  const owned=new Set([...(Array.isArray(inventory?.units)?inventory.units:[]),...(Array.isArray(inventory?.spells)?inventory.spells:[])].filter(id=>cards.has(id)));
  let units=0,spells=0;for(const id of owned){if(cardTypes.get(id)==='unit')units++;else if(cardTypes.get(id)==='spell')spells++;}
  return {units,spells,total:owned.size,available:cards.size};
}
const countLegal=values=>new Set((Array.isArray(values)?values:[]).filter(id=>levels.has(id))).size;
export function platformProgressStats(state={}) {
  const factions=Array.from({length:6},(_,index)=>countLegal(state?.factionCompleted?.[index+1]));
  const collection=collectionProgressStats(state).total;
  return {factions,score:factions.reduce((sum,count)=>sum+count,0),collection};
}
export const ACHIEVEMENT_CATALOG = Object.freeze([
  {key:'first-victory',name:'首场胜利',target:1,metric:'total',category:'expedition'},
  ...[3,15,30].map(target=>({key:`faction-${target}`,name:target===3?'初露锋芒（单阵营3关）':`任一阵营通关${target}关`,target,metric:'faction',category:'faction'})),
  {key:'all-factions',name:'六阵营全通',target:ORIGINAL_CAMPAIGN_LEVEL_IDS.length*FACTIONS.length,metric:'original-total',category:'expedition'},
  {key:'collection-150',name:'收藏150种卡牌',target:150,metric:'collection',category:'collection'},
  ...EXPEDITION_CHAPTERS.map(chapter=>({key:`chapter-${chapter.id}`,name:`同阵营通关${chapter.title.split(' · ')[1]}`,description:'同一阵营通过本章全部三关。',target:chapter.levelIds.length,metric:'chapter',chapterId:chapter.id,category:'expedition'})),
  ...FACTIONS.flatMap(faction=>[10,20,30].map(target=>({key:`faction-${faction.id}-${target}`,name:`${faction.name}通关${target}关`,target,metric:'specific-faction',factionId:faction.id,category:'faction'}))),
  ...[60,100,125,168].map(target=>({key:`collection-${target}`,name:`收藏${target}种卡牌`,target,metric:'collection',category:'collection'})),
  ...[60,90,120].map(target=>({key:`units-${target}`,name:`收藏${target}种随从`,target,metric:'units',category:'collection'})),
  ...[20,35,48].map(target=>({key:`spells-${target}`,name:`收藏${target}种法术`,target,metric:'spells',category:'collection'})),
  ...[2,3,6].map(target=>({key:`factions-started-${target}`,name:`${target}阵营首胜`,description:`${target}个阵营各至少通关一关。`,target,metric:'factions-started',category:'faction'})),
  ...[30,60,120].map(target=>({key:`total-${target}`,name:`累计通关${target}关`,description:'各阵营通关记录合计，同阵营同关不重复计数。',target,metric:'total',category:'expedition'})),
  {key:'challenge-first-victory',name:'铁崖首胜',target:1,metric:'challenge-victory',category:'challenge'},
  ...[80000,90000].map(target=>({key:`challenge-${target}`,name:`铁崖${target/10000}万分`,target,metric:'challenge-score',category:'challenge'})),
].map(Object.freeze));
export function localAchievements(state,confirmed=CONFIRMED_ACHIEVEMENTS,challengeResult=null) {
  const stats=platformProgressStats(state);
  const collection=collectionProgressStats(state),challengeScore=rankedChallengeScore(challengeResult);
  const completed=FACTIONS.map(faction=>new Set((Array.isArray(state?.factionCompleted?.[faction.id])?state.factionCompleted[faction.id]:[]).filter(id=>levels.has(id))));
  return ACHIEVEMENT_CATALOG.map(item=>{
    let progress;
    switch(item.metric){
      case 'original-total':progress=completed.reduce((sum,ids)=>sum+ORIGINAL_CAMPAIGN_LEVEL_IDS.filter(id=>ids.has(id)).length,0);break;
      case 'faction':progress=Math.max(...stats.factions);break;
      case 'specific-faction':progress=stats.factions[item.factionId-1];break;
      case 'collection':progress=collection.total;break;
      case 'units':progress=collection.units;break;
      case 'spells':progress=collection.spells;break;
      case 'factions-started':progress=stats.factions.filter(count=>count>0).length;break;
      case 'chapter':{
        const chapter=EXPEDITION_CHAPTERS.find(chapter=>chapter.id===item.chapterId);
        progress=Math.max(...completed.map(ids=>chapter.levelIds.filter(id=>ids.has(id)).length));break;
      }
      case 'challenge-victory':progress=challengeScore>0?1:0;break;
      case 'challenge-score':progress=challengeScore;break;
      default:progress=stats.score;
    }
    return {...item,progress:Math.min(progress,item.target),achieved:progress>=item.target,configured:typeof confirmed[item.key]==='string'&&!!confirmed[item.key].trim()};
  });
}
const errorText=error=>typeof error==='string'?error:typeof error==='number'?`平台错误（${error}），请重试。`:error?.message||error?.errMsg||'平台操作失败，请重试。';
const platformError=(code,message)=>message?`${message}${code!==undefined&&code!==null?`（${code}）`:''}`:errorText(code);

/** In-memory adapter: readState is evaluated on every sync after profile refresh. */
export function createPlatformProgress({readState,readChallengeResult=()=>null,getTap=()=>globalThis.tap,confirmedAchievements=CONFIRMED_ACHIEVEMENTS,achievementsPublished=ACHIEVEMENTS_PUBLISHED,binding=PLATFORM_PROGRESS_BINDING,timeoutMs=10000,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  if(typeof readState!=='function')throw new TypeError('readState must be a function');
  let achievementManager=null,disposed=false;
  const boards={collection:{id:binding.collectionLeaderboardId,submitted:-1,pending:null,label:'收藏进度',read:()=>collectionProgressStats(readState()).total},leaderboard:{id:binding.campaignLeaderboardId??binding.leaderboardId,submitted:-1,pending:null,label:'战役进度',read:()=>platformProgressStats(readState()).score},challenge:{id:binding.challengeLeaderboardId,submitted:-1,pending:null,label:'挑战成绩',read:()=>rankedChallengeScore(readChallengeResult())}};
  for(const board of Object.values(boards))board.status={state:board.id?'idle':'unconfigured',message:board.id?'排行榜尚未同步。':'排行榜尚未配置。'};
  const unlocked=new Set(),pending=new Map(),requests=new Set(),confirmed={...confirmedAchievements};
  let achievementStatus=Object.values(confirmed).some(id=>typeof id==='string'&&id.trim())
    ? {state:'idle',message:achievementsPublished?'平台成就已配置。':'平台成就发布状态待确认，全部成就可在游戏内查看。'}
    : {state:'unconfigured',message:'平台成就尚未配置，达成记录按本机进度显示。'};
  function timedRequest(invoke,onSuccess,{timeoutUncertain=false}={}) {
    let finish;
    const promise=new Promise(resolve=>{
      let settled=false,timer;
      finish=result=>{if(settled)return;settled=true;clearTimer(timer);if(result.ok&&!disposed)onSuccess?.();resolve(result);};
      timer=setTimer(()=>finish(timeoutUncertain
        ? {ok:false,uncertain:true,error:'未收到TapTap打开结果，请返回游戏后重试。'}
        : {ok:false,error:'平台响应超时，请重试。'}),timeoutMs);
      try{invoke(()=>finish({ok:true}),error=>finish({ok:false,error:errorText(error)}));}catch(error){finish({ok:false,error:errorText(error)});}
    });
    const request={promise,cancel:()=>finish({ok:false,error:'平台同步已停止。'})};
    requests.add(request);promise.then(()=>requests.delete(request));return request;
  }
  function managerForLeaderboard() {
    const tap=getTap();if(typeof tap?.getLeaderboardManager!=='function')throw new Error('请在支持排行榜的TapTap游戏内使用。');
    const manager=tap.getLeaderboardManager();if(!manager)throw new Error('排行榜暂不可用。');return manager;
  }
  function unconfigured(board) {
    return {ok:false,unconfigured:true,error:board.status.message};
  }
  async function syncBoard(key,{force=false}={}) {
    const board=boards[key];
    if(disposed)return {ok:false,error:'平台同步已停止。'};
    if(!board.id)return unconfigured(board);
    let score;try{score=board.read();}catch(error){const message=errorText(error);if(!board.pending)board.status={state:'error',message};return {ok:false,error:message};}
    if(score===0){if(!board.pending)board.status={state:'empty',message:`尚无可同步${board.label}。`};return {ok:true,skipped:true};}
    if(board.pending){const active=board.pending,result=await active.promise;return score<=active.score?result:syncBoard(key,{force});}
    if(!force&&score<=board.submitted)return {ok:true,skipped:true};
    // A refreshed older profile cannot lower this session's confirmed best.
    score=Math.max(score,board.submitted);
    board.status={state:'pending',message:`正在同步${board.label}。`};
    const request=timedRequest((success,failure)=>{
      const manager=managerForLeaderboard();if(typeof manager.submitScores!=='function')throw new Error('当前宿主不支持提交排行榜。');
      manager.submitScores({scores:[{leaderboardId:board.id,score}],callback:{onSuccess:success,onFailure:(code,message)=>failure(platformError(code,message))}});
    },()=>{board.submitted=Math.max(board.submitted,score);});
    request.score=score;board.pending=request;
    const result=await request.promise;
    if(board.pending===request)board.pending=null;
    if(!disposed)board.status={state:result.ok?'synced':'error',message:result.ok?`${board.label}已同步。`:result.error};
    return result;
  }
  async function openBoard(key) {
    const board=boards[key];
    if(disposed)return {ok:false,error:'平台同步已停止。'};
    if(!board.id)return unconfigured(board);
    return timedRequest((success,failure)=>{
      const manager=managerForLeaderboard();if(typeof manager.openLeaderboard!=='function')throw new Error('当前宿主不支持查看排行榜。');
      manager.openLeaderboard({leaderboardId:board.id,collection:'public',callback:{onSuccess:success,onFailure:(code,message)=>failure(platformError(code,message))}});
    },undefined,{timeoutUncertain:true}).promise;
  }
  const syncLeaderboard=options=>syncBoard('leaderboard',options),openLeaderboard=()=>openBoard('leaderboard');
  const syncCollectionLeaderboard=options=>syncBoard('collection',options),openCollectionLeaderboard=()=>openBoard('collection');
  const syncChallengeLeaderboard=options=>syncBoard('challenge',options),openChallengeLeaderboard=()=>openBoard('challenge');
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
        // Late success remains authoritative even after the request timed out.
        refreshAchievementStatus();
      },
      onAchievementFailure:(id,_code,message)=>{if(!disposed)pending.get(id)?.failure(message);},
    });
    achievementManager=manager;return manager;
  }
  function refreshAchievementStatus() {
    if(disposed)return;
    let achieved;try{achieved=localAchievements(readState(),confirmed,readChallengeResult()).filter(item=>item.configured&&item.achieved);}catch{return;}
    if(achieved.every(item=>unlocked.has(confirmed[item.key])))achievementStatus={state:achieved.length?'synced':'empty',message:achieved.length?'已达成成就已同步。':'尚未达成成就。'};
    else if(pending.size)achievementStatus={state:'pending',message:'正在同步已达成成就。'};
  }
  async function syncAchievements() {
    if(disposed)return {ok:false,error:'平台同步已停止。'};
    let achievements;try{achievements=localAchievements(readState(),confirmed,readChallengeResult());}catch(error){const message=errorText(error);achievementStatus={state:'error',message};return {ok:false,error:message};}
    if(!achievements.some(item=>item.configured))return {ok:false,unconfigured:true,error:achievementStatus.message};
    const eligible=achievements.filter(item=>item.configured&&item.achieved&&!unlocked.has(confirmed[item.key]));
    if(!eligible.length){refreshAchievementStatus();return {ok:true,skipped:true};}
    achievementStatus={state:'pending',message:'正在同步已达成成就。'};
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
    if(!disposed){achievementStatus={state:failed?'error':'synced',message:failed?failed.error:'已达成成就已同步。'};refreshAchievementStatus();}
    return failed??{ok:true};
  }
  function showAchievements() {
    if(disposed)return {ok:false,error:'平台同步已停止。'};
    if(!Object.values(confirmed).some(id=>typeof id==='string'&&id.trim()))return {ok:false,unconfigured:true,error:'平台成就尚未配置，达成记录按本机进度显示。'};
    if(!achievementsPublished)return {ok:false,unconfigured:true,error:'平台成就发布状态待确认，全部成就可在游戏内查看。'};
    try{const manager=getAchievementManager();if(typeof manager.showAchievements!=='function')throw new Error('当前宿主不支持查看成就。');manager.showAchievements();return {ok:true,requested:true};}catch(error){return {ok:false,error:errorText(error)};}
  }
  return {
    syncLeaderboard,openLeaderboard,syncCollectionLeaderboard,openCollectionLeaderboard,syncChallengeLeaderboard,openChallengeLeaderboard,syncAchievements,showAchievements,openAchievements:showAchievements,
    score(){return platformProgressStats(readState()).score;},
    collectionScore(){return collectionProgressStats(readState()).total;},
    challengeScore(){return rankedChallengeScore(readChallengeResult());},
    async sync(options){const [leaderboard,collection,achievements]=await Promise.all([syncLeaderboard(options),syncCollectionLeaderboard(options),syncAchievements()]);return {leaderboard,collection,achievements};},
    getStatus(){return {collection:{...boards.collection.status},leaderboard:{...boards.leaderboard.status},challenge:{...boards.challenge.status},achievements:{...achievementStatus},submittedCollectionScore:boards.collection.submitted,submittedScore:boards.leaderboard.submitted,submittedChallengeScore:boards.challenge.submitted};},
    getAchievements(){return localAchievements(readState(),confirmed,readChallengeResult()).map(item=>({...item,synced:item.configured&&unlocked.has(confirmed[item.key])}));},
    getCapabilities(){let tap,canOpenBoard=false;try{tap=getTap();canOpenBoard=!disposed&&typeof tap?.getLeaderboardManager==='function'&&typeof tap.getLeaderboardManager()?.openLeaderboard==='function';}catch{}const achievements=!disposed&&typeof tap?.createAchievementManager==='function';return {collection:canOpenBoard&&!!boards.collection.id,leaderboard:canOpenBoard&&!!boards.leaderboard.id,challenge:canOpenBoard&&!!boards.challenge.id,achievements,achievementView:achievements&&achievementsPublished};},
    dispose(){disposed=true;for(const request of requests)request.cancel();pending.clear();for(const board of Object.values(boards))board.status={state:'stopped',message:'平台同步已停止。'};achievementStatus={state:'stopped',message:'平台同步已停止。'};},
  };
}
