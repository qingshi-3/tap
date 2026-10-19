import { findGiftCode, validateGiftCodeClaims } from './gift-codes.js';
import { PRE_EXPANSION_UNIT_IDS, PRE_EXPANSION_SPELL_IDS, PRE_EXPANSION_LEVEL_IDS, NEW_ACQUISITION_IDS, CARD_ACQUISITION } from './campaign-content.js';
import { initialDailyAds, beijingDay, validateDailyAds, dailyAdStatus, dailyRewardRange, rollDailyReward } from './daily-ad-rewards.js';
import { starterInventory, makeStarterDeck, validatePlayerDeck } from './battle-deck.js';
import { RECRUITMENT_CONFIG } from './recruitment-config.js';
import { initialRecruitment, validateRecruitmentConfig, validateRecruitmentState, recruitmentCardKind, recruitmentDraw, PREMIUM_IDS, normalizeRecruitment, upgradeRecruitment } from './recruitment.js';
import { SAVE_KEYS } from './storage-keys.js';
import { ensureSaveNamespace, guardedWrite } from './storage-contract.js';
import { validateMatch } from './expedition-engine.js';
import { DEPLOYMENT_BUDGET, EXPEDITION_LEVELS, TRAINING_COSTS, trainingBonus, deploymentCost } from './expedition-data.js';
import { CAMPAIGN_UNIT_IDS, SPELL_IDS, NEUTRAL_IDS, SPELL_TRAINING_COSTS, getUnitSpecializations, getSpellTrainingPolicy, unlockedInventory, spellTrainingGate } from './campaign-rules.js';
import { FACTIONS, getFaction, getHero } from './factions.js';
import { PROFILE10_UNIT_IDS, PROFILE10_SPELL_IDS } from './profile10-roster.js';
import {doubleOffer} from './recruitment-double.js';
import {fragmentReward,safeAdd} from './random-recruitment.js';
import { applyRandomRecruitment } from './random-recruitment.js';
import { ALL_RECRUITMENT_IDS } from './recruitment-catalog.js';

const STORAGE_KEY = SAVE_KEYS.expedition;
const LEGACY_BACKUP_KEY = `${STORAGE_KEY}.legacy-v1-backup`;
const LEGACY_V2_BACKUP_KEY = `${STORAGE_KEY}.legacy-v2-backup`;
const IMPORT_BACKUP_KEY = `${STORAGE_KEY}.pre-import-backup`;
const LEGACY_V3_BACKUP_KEY = `${STORAGE_KEY}.legacy-v3-backup`;
const SCHEMA_VERSION = 13;
const OLD_UNIT_IDS = Object.freeze([14,9,15,16,11,17,110,115,109,108,111,116,213,211,214,209,215,216,308,317,311,309,310,316,406,412,410,402,404,413,505,506,503,526,511,513,10021,19027,10981,10019,19037,10012,19050]);
const OLD_SPELL_IDS = Object.freeze([20174,20043,20066,20044,20068,20081,20086,20095,20151,20052,20072,20116,20117,20139,20149]);
// Keep startup recovery independent of the production configuration module.
const SAFE_RECRUITMENT_CONFIG = Object.freeze({ schemaVersion: 1, victoryTickets: 0, adTickets: 0, adEnabled: false, pools: Object.freeze([]), recipes: Object.freeze([]) });
const LEGACY_V4_FACTION_UNITS = Object.freeze({1:[14,9,15,16,11,17],2:[110,115,109,108,111,116],3:[213,211,214,209,215,216],4:[308,317,311,309,310,316],5:[406,412,410,402,404,413],6:[505,506,503,526,511,513]});
const LEGACY_V4_TRAINABLE_IDS = Object.freeze(Object.values(LEGACY_V4_FACTION_UNITS).flat());
const LEGACY_TRAINABLE_IDS = Object.freeze([9, 11, 14, 15, 16, 17]);
// Historical profile contracts are frozen independently of the growing live roster.
const LEGACY_FACTION_UNITS = Object.freeze({ 1: [14, 9, 15, 16, 11, 17], 2: [110, 115, 109], 3: [213, 211, 214],
  4: [308, 317, 311], 5: [406, 412, 410], 6: [505, 506, 503] });
const LEGACY_V2_V3_TRAINABLE_IDS = Object.freeze(Object.values(LEGACY_FACTION_UNITS).flat());
const LEGACY_LEVEL_IDS = new Set(['border-01', 'border-02', 'border-03', 'road-01', 'road-02', 'road-03', 'banners-01', 'banners-02', 'banners-03']);
const LEVEL_IDS = EXPEDITION_LEVELS.map(({ id }) => id);
const LEVEL_BY_ID = new Map(EXPEDITION_LEVELS.map((level) => [level.id, level]));
const FACTION_IDS = FACTIONS.map(({ id }) => id);
const copy = (value) => JSON.parse(JSON.stringify(value));
const defaultSquads = () => Object.fromEntries(FACTIONS.map((faction) => [faction.id, [...faction.defaultSquad]]));
const initialState = ({ starterResources = false } = {}) => {
  const factionSquads = defaultSquads(), growth = initialGrowth();
  // Migration scaffolding must not grant the new-player resources to old profiles.
  const recruitment = initialRecruitment();
  if (starterResources) recruitment.tickets = 10;
  return { schemaVersion: SCHEMA_VERSION, giftCodeClaims: {}, coins: starterResources ? 100 : 80, training: Object.fromEntries(CAMPAIGN_UNIT_IDS.map((id) => [id, 0])), selectedHeroId: 1,
    ...growth, factionDecks: defaultDecks(growth.inventory), recruitment, dailyAds: initialDailyAds(), factionSquads, squad: [...factionSquads[1]], completed: [], activeBattle: null, settlements: {}, rewardClaims: {}, ...initialCampaignFields() };
};

export class ExpeditionProgress {
  #pendingDraw = null; #watchedDoubles = new Set(); #config; #configError = ''; #rng; #now; #raw = null; #storage; #state = initialState({ starterResources: true }); #error = ''; #writable = true; #listeners = new Set();
  constructor(storage, { recruitmentConfig = RECRUITMENT_CONFIG, rng = Math.random, now = Date.now } = {}) {
    this.#config = validateRecruitmentConfig(recruitmentConfig) ? copy(recruitmentConfig) : copy(SAFE_RECRUITMENT_CONFIG);
    if (!validateRecruitmentConfig(recruitmentConfig)) this.#configError = '招募配置无效，暂时无法抽奖或合成。';
    this.#rng = rng; this.#now = now;
    if (arguments.length) this.#storage = storage;
    else { try { this.#storage = globalThis.localStorage; } catch (cause) { this.#reject(`读取远征存档失败：${message(cause)}`); return; } }
    try { ensureSaveNamespace(this.#storage); } catch (cause) { this.#reject(`存档迁入失败：${message(cause)}`); return; }
    this.#load();
  }
  get state() { return copy(this.#state); }
  get error() { return this.#error; }
  get recruitmentConfig() { return copy(this.#config); }
  recruitmentStatus() {
    if(this.#config.schemaVersion>=2){
      const r=this.#state.recruitment,eligibleTargets=ALL_RECRUITMENT_IDS.filter(id=>!owns(this.#state,id)),locked=this.#config.schemaVersion===2&&!this.#state.completed.includes(LEVEL_IDS[2]);
      return {...copy(r),pendingDrawCount:this.#pendingDraw?.count??null,pity:copy(r.random),legacyGuarantees:Object.entries(r.random.legacyGuarantees).map(([id,remaining])=>({cardId:Number(id),remaining})),randomConfig:copy(this.#config.random),drawOptions:[1,10],ownedCount:ALL_RECRUITMENT_IDS.length-eligibleTargets.length,totalCount:ALL_RECRUITMENT_IDS.length,remainingCount:eligibleTargets.length,eligibleTargets,locked,allOwned:eligibleTargets.length===0,disabledReason:locked?'完成账号第3关后开放招募。':'',pools:copy(this.#config.pools).map(p=>({...p,entries:this.#config.schemaVersion===3?p.entries.filter(e=>eligibleTargets.includes(e.cardId)):p.entries})),recipes:copy(this.#config.recipes).filter(r=>this.#config.schemaVersion!==3||eligibleTargets.includes(r.cardId)),transferSources:PREMIUM_IDS.filter(id=>owns(this.#state,id)&&(r.fragments[id]??0)>0),adEnabled:this.#config.adEnabled&&!this.#configError,error:this.#configError||(!this.#writable?this.#error:'')};
    }
    const r=this.#state.recruitment,eligibleTargets=PREMIUM_IDS.filter(id=>!owns(this.#state,id)),locked=!this.#state.completed.includes(LEVEL_IDS[2]);
    const pools=copy(this.#config.pools).map(pool=>pool.id==='premium'?{...pool,entries:pool.entries.map(e=>({...e,weight:e.cardId===r.focus?5:1,probability:r.focus===null?1/6:r.misses[r.focus]===3?(e.cardId===r.focus?1:0):(e.cardId===r.focus?0.5:0.1),redirectTo:r.focus!==null&&owns(this.#state,e.cardId)?r.focus:null}))}:pool);
    return { ...copy(r),focusProbability:r.focus===null?null:r.misses[r.focus]===3?1:0.5+PREMIUM_IDS.filter(id=>id!==r.focus&&owns(this.#state,id)).length*0.1,pityNextGuaranteed:r.focus!==null&&r.misses[r.focus]===3,eligibleTargets,locked,allOwned:eligibleTargets.length===0,disabledReason:locked?'完成账号第3关后开放招募。':!eligibleTargets.length?'已完成全部收集，未来奖励宝珠将按开战权益转换金币。':'',transferSources:PREMIUM_IDS.filter(id=>owns(this.#state,id)&&(r.fragments[id]??0)>0),pools, recipes: copy(this.#config.recipes), adEnabled: this.#config.adEnabled && !this.#configError, error: this.#configError || (!this.#writable ? this.#error : '') };
  }
  getUnitTrainingBonus(id,rank=this.#state.training[id]) {return trainingBonus(id,rank,this.#state.growthVersion[id]);}
  getTrainingAvailability(id) {
    const state=this.#state,spell=SPELL_IDS.includes(id),known=spell||CAMPAIGN_UNIT_IDS.includes(id),rank=known?(spell?state.spellTraining[id]:state.training[id]):0,cap=known?(spell?spellCap(state,id):unitCap(state,id)):0,cost=known?((spell?SPELL_TRAINING_COSTS:TRAINING_COSTS)[rank]??null):null;
    let reason='';
    if(!known||!(spell?state.inventory.spells:state.inventory.units).includes(id))reason='只能培养已拥有的卡牌。';
    else if(spell&&!getSpellTrainingPolicy(id).trainable)reason=getSpellTrainingPolicy(id).reason;
    else if(cost===null)reason='已达到最高培养等级。';
    else if(rank+1>cap)reason='尚未开放此阶培养。';
    else if(state.coins<cost)reason='金币不足。';
    return {id,rank,nextRank:rank+1,cap,cost,growthVersion:state.growthVersion[id]??null,canTrain:!reason,reason};
  }
  setRecruitmentFocus(id) {
    if(this.#config.schemaVersion>=2)return {ok:false,error:'随机招募无需选择目标。'};
    if (!PREMIUM_IDS.includes(id) || owns(this.#state,id)) return {ok:false,error:'请选择尚未拥有的招募目标。'};
    const candidate=copy(this.#state);candidate.recruitment.focus=id;return this.#change(candidate,{focus:id});
  }
  transferFragments(fromId,toId) {
    if (!PREMIUM_IDS.includes(fromId)||!PREMIUM_IDS.includes(toId)||fromId===toId||!owns(this.#state,fromId)||owns(this.#state,toId)) return {ok:false,error:'只能将已合成卡的剩余碎片转给尚未拥有目标。'};
    const candidate=copy(this.#state),amount=candidate.recruitment.fragments[fromId]??0;
    candidate.recruitment.fragments[fromId]=0;candidate.recruitment.fragments[toId]=(candidate.recruitment.fragments[toId]??0)+amount;
    return this.#change(candidate,{fromId,toId,amount});
  }
  drawRecruitment(poolId='premium',count=1) {
    if (!this.#writable) return {ok:false,error:this.#error};
    if (this.#configError) return {ok:false,error:this.#configError};
    const pool=this.#config.pools.find(p=>p.id===poolId);if(!pool)return {ok:false,error:'该卡池尚未开放。'};
    if(![1,10].includes(count))return {ok:false,error:'请选择单抽或十抽。'};
    const candidate=copy(this.#state),r=candidate.recruitment;
    if(r.tickets<pool.ticketCost*count)return {ok:false,error:'灵魂宝珠不足。'};
    if(this.#config.schemaVersion>=2){
      if(this.#config.schemaVersion===3&&ALL_RECRUITMENT_IDS.every(id=>owns(candidate,id)))return {ok:false,error:'已拥有全部招募单位。'};
      if(this.#config.schemaVersion===2&&!candidate.completed.includes(LEVEL_IDS[2]))return {ok:false,error:'完成账号第3关后开放招募。'};
      if(Object.values(r.doubles.claims).some(c=>['pending','watched'].includes(c.status)))return {ok:false,error:'请先处理待完成的招募翻倍。'};
      if(this.#pendingDraw){if(this.#pendingDraw.count!==count)return {ok:false,error:'请先重试上次招募保存。'};const pending=this.#pendingDraw;if(JSON.stringify(this.#state)!==pending.base)return {ok:false,error:'存档已变化，不能覆盖上次招募结果。'};const result=this.#change(copy(pending.candidate),pending.result);if(result.ok)this.#pendingDraw=null;return result;}
      r.tickets-=pool.ticketCost*count;
      try{const result=applyRandomRecruitment(candidate,this.#config,count,this.#rng);this.#pendingDraw={count,base:JSON.stringify(this.#state),candidate:copy(candidate),result:copy(result)};const committed=this.#change(candidate,result);if(committed.ok)this.#pendingDraw=null;return committed;}
      catch(cause){return {ok:false,error:message(cause)};}
    }
    if(count!==1)return {ok:false,error:'此历史卡池不支持十抽。'};
    let entry;
    try {
      if(poolId==='premium') {
        if(!candidate.completed.includes(LEVEL_IDS[2]))return {ok:false,error:'完成账号第3关后开放招募。'};
        if(PREMIUM_IDS.every(id=>owns(candidate,id)))return {ok:false,error:'已完成全部招募收集，保留剩余宝珠。'};
        const focus=r.focus;if(!PREMIUM_IDS.includes(focus)||owns(candidate,focus))return {ok:false,error:'请先选择未拥有目标。'};
        const weighted={...pool,entries:pool.entries.map(e=>({...e,weight:e.cardId===focus?5:1}))};
        entry=r.misses[focus]===3?pool.entries.find(e=>e.cardId===focus):recruitmentDraw(weighted,this.#rng);
        if(owns(candidate,entry.cardId))entry={...entry,cardId:focus};
        r.misses[focus]=entry.cardId===focus?0:r.misses[focus]+1;
      } else entry=recruitmentDraw(pool,this.#rng);
    }catch(cause){return {ok:false,error:message(cause)};}
    r.tickets-=pool.ticketCost;r.fragments[entry.cardId]=(r.fragments[entry.cardId]??0)+entry.fragments;
    return this.#change(candidate,{cardId:entry.cardId,fragments:entry.fragments,tickets:r.tickets,focus:r.focus,misses:copy(r.misses)});
  }
  recruitmentDoubleOffer(receiptId,index) {
    let offer;try{offer=doubleOffer(this.#state.recruitment,receiptId,index,beijingDay(this.#now()));}catch(cause){return {eligible:false,remaining:0,error:message(cause)};}
    if(offer.pending&&this.#hasDoubleEvidence(offer.pending.requestId))offer.watched=true;
    if(!this.#writable||this.#configError||!this.#config.adEnabled)return {...offer,eligible:false,reason:this.#configError||this.#error||'广告暂不可用。'};
    return offer;
  }
  beginRecruitmentDouble(receiptId,index,requestId) {
    if(typeof requestId!=='string'||!requestId||requestId.length>200)return {ok:false,error:'广告请求无效。'};
    const old=this.#state.recruitment.doubles.claims[requestId];
    if(old)return old.receiptId===receiptId&&old.index===index&&old.status!=='cancelled'?{ok:true,duplicate:true,watched:old.status!=='pending'||this.#hasDoubleEvidence(requestId),claimed:old.status==='claimed'}:{ok:false,error:'广告请求已使用。'};
    if(Object.values(this.#state.recruitment.doubles.claims).some(c=>['pending','watched'].includes(c.status)))return {ok:false,error:'请先完成当前广告请求。'};
    const offer=this.recruitmentDoubleOffer(receiptId,index);if(!offer.eligible||offer.pending)return {ok:false,error:offer.reason||'该结果已有广告请求。'};
    const candidate=copy(this.#state),reward=candidate.recruitment.lastReceipt.draws[index-1].rewards[0];
    candidate.recruitment.doubles.claims[requestId]={receiptId,index,day:beijingDay(this.#now()),status:'pending',cardId:reward.cardId,fragments:reward.amount,coins:20,rewards:candidate.recruitment.lastReceipt.draws[index-1].rewards.filter(e=>['fragments','coins'].includes(e.kind)).map(({kind,cardId,amount})=>({kind,cardId,amount}))};
    return this.#change(candidate,{requestId,watched:false});
  }
  #hasDoubleEvidence(requestId){
    if(this.#watchedDoubles.has(requestId))return true;
    try{const evidence=JSON.parse(this.#storage.getItem(`${STORAGE_KEY}.recruit-double-success`));const claim=this.#state.recruitment.doubles.claims[requestId];return evidence?.requestId===requestId&&evidence?.claim===JSON.stringify(claim);}catch{return false;}
  }
  completeRecruitmentDouble(requestId) {
    if(!this.#writable)return {ok:false,error:this.#error};
    const claim=this.#state.recruitment.doubles.claims[requestId];if(!claim||claim.status==='cancelled')return {ok:false,error:'广告请求已失效。'};
    if(claim.status==='claimed')return {ok:true,duplicate:true,cardId:claim.cardId,fragments:claim.fragments,coins:claim.coins};
    // Successful SDK callback evidence is written before asset delivery. It binds
    // to the exact saved reservation, so reload can retry without watching again.
    this.#watchedDoubles.add(requestId);
    try{this.#storage.setItem(`${STORAGE_KEY}.recruit-double-success`,JSON.stringify({requestId,claim:JSON.stringify(claim)}));}catch(cause){return {ok:false,watched:true,error:`广告已完成，请重试保存：${message(cause)}`};}
    const candidate=copy(this.#state),c=candidate.recruitment.doubles.claims[requestId];
    try{const rewards=c.rewards.map(e=>{if(e.kind==='fragments')return fragmentReward(candidate,e.cardId,e.amount,this.#config,'double');candidate.coins=safeAdd(candidate.coins,e.amount);return {...e,newUnit:false};});c.status='claimed';const result=this.#change(candidate,{requestId,cardId:c.cardId,fragments:c.fragments,coins:c.coins,rewards,newUnit:rewards.some(e=>e.newUnit),duplicate:false});return {...result,watched:true};}catch(cause){return {ok:false,watched:true,error:message(cause)};}
  }
  cancelRecruitmentDouble(requestId) {
    const claim=this.#state.recruitment.doubles.claims[requestId];if(!claim||claim.status==='cancelled')return {ok:true,changed:false};
    if(claim.status==='claimed'||claim.status==='watched'||this.#hasDoubleEvidence(requestId))return {ok:false,watched:true,error:'广告已完成，请重试到账。'};
    const candidate=copy(this.#state);candidate.recruitment.doubles.claims[requestId].status='cancelled';return this.#change(candidate,{changed:true});
  }
  synthesizeCard(cardId) {
    if (this.#configError) return { ok: false, error: this.#configError };
    const recipe = this.#config.recipes.find(r => r.cardId === cardId), kind = recruitmentCardKind(cardId);
    if (!recipe || !kind) return { ok: false, error: '该卡牌暂未开放合成。' };
    if (this.#state.inventory[kind].includes(cardId)) return { ok: false, error: '该卡牌已经拥有。' };
    if ((this.#state.recruitment.fragments[cardId] ?? 0) < recipe.fragmentsRequired) return { ok: false, error: '卡牌碎片不足。' };
    const candidate = copy(this.#state); candidate.recruitment.fragments[cardId] -= recipe.fragmentsRequired; candidate.inventory[kind].push(cardId); if(candidate.recruitment.focus===cardId)candidate.recruitment.focus=null;
    return this.#change(candidate, { cardId, kind, fragments: candidate.recruitment.fragments[cardId], tickets: candidate.recruitment.tickets });
  }
  synthesizeAvailableCards() {
    if(!this.#writable)return {ok:false,error:this.#error};
    if(this.#configError)return {ok:false,error:this.#configError};
    const candidate=copy(this.#state),cardIds=[];
    for(const recipe of this.#config.recipes){const kind=recruitmentCardKind(recipe.cardId);if(!kind||candidate.inventory[kind].includes(recipe.cardId)||(candidate.recruitment.fragments[recipe.cardId]??0)<recipe.fragmentsRequired)continue;candidate.recruitment.fragments[recipe.cardId]-=recipe.fragmentsRequired;candidate.inventory[kind].push(recipe.cardId);cardIds.push(recipe.cardId);}
    if(!cardIds.length)return {ok:false,error:'暂无可合成的随从。'};
    return this.#change(candidate,{cardIds});
  }
  dailyAdOffer(kind) {
    const range = dailyRewardRange(kind);
    if (!range) return { eligible:false, available:false, reason:'未知广告奖励。' };
    try { const status=dailyAdStatus(this.#state.dailyAds[kind],beijingDay(this.#now()));return { ...range,...status,claimed:!status.available,eligible:this.#writable&&status.available,reason:!this.#writable?this.#error:status.reason }; }
    catch (error) { return { ...range, day:null, eligible:false, available:false, reason:error.message }; }
  }
  beginDailyAd(kind,requestId) {
    if(this.#pendingDraw)return {ok:false,error:'请先重试保存招募结果。'};
    if(!this.#writable)return {ok:false,error:this.#error};
    if (typeof requestId!=='string'||!requestId) return {ok:false,error:'广告请求编号无效。'};
    const quota=this.#state.dailyAds[kind];
    if(!quota)return {ok:false,error:'未知广告奖励。'};
    if (quota.pending?.requestId===requestId) return {ok:true,day:quota.pending.day,duplicate:true};
    const offer=this.dailyAdOffer(kind);
    if (!offer.eligible) return {ok:false,error:offer.reason};
    if (quota.lastClaim?.requestId===requestId) return {ok:false,error:'广告请求已领取，请使用新的请求编号。'};
    const candidate=copy(this.#state);
    try {
      const roll=quota.roll?.day===offer.day?copy(quota.roll):{day:offer.day,amount:rollDailyReward(kind,this.#rng)};
      candidate.dailyAds[kind].roll=roll;
      candidate.dailyAds[kind].pending={...roll,requestId};
    } catch(error) {return {ok:false,error:error.message};}
    return this.#change(candidate,{day:offer.day,duplicate:false});
  }
  completeDailyAd(kind,requestId) {
    if (!this.#writable) return {ok:false,error:this.#error};
    const quota=this.#state.dailyAds[kind];
    if (!quota) return {ok:false,error:'未知广告奖励。'};
    if (quota.lastClaim?.requestId===requestId) return {ok:true,amount:quota.lastClaim.amount,day:quota.lastClaim.day,duplicate:true};
    const pending=quota.pending;
    if (!pending||pending.requestId!==requestId) return {ok:false,error:'广告奖励请求已失效，请重新观看。'};
    if (quota.claimedDay!==null&&pending.day<=quota.claimedDay) return {ok:false,error:'该日期奖励已领取，没有重复发放。'};
    const candidate=copy(this.#state);
    if(kind==='gold')candidate.coins+=pending.amount;else candidate.recruitment.tickets+=pending.amount;
    candidate.dailyAds[kind]={...candidate.dailyAds[kind],claimedDay:pending.day,lastClaim:copy(pending),pending:null};
    return this.#change(candidate,{amount:pending.amount,day:pending.day,duplicate:false});
  }
  cancelDailyAd(kind,requestId) {
    const pending=this.#state.dailyAds[kind]?.pending;
    if(!pending||pending.requestId!==requestId)return {ok:true,changed:false};
    const candidate=copy(this.#state);candidate.dailyAds[kind].pending=null;
    return this.#change(candidate,{changed:true});
  }
  recruitmentAdOffer(runId) {
    const r=this.#state.recruitment;
    if(runId===undefined)runId=Object.keys(r.victoryClaims).reverse().find(id=>r.adClaims[id]?.status!=='claimed')??null;
    const claim=r.adClaims[runId];
    return {eligible:false,runId,amount:claim?.amount??this.#config.adTickets,claimed:claim?.status==='claimed',reason:'请使用每日广告奖励入口。'};
  }
  resourceRewardOffer(kind) { return this.dailyAdOffer(kind); }
  beginRecruitmentAd() { return {ok:false,error:'旧胜利广告入口已停止，请使用每日宝珠奖励入口。'}; }
  completeRecruitmentAd(runId,requestId) {
    const claim=this.#state.recruitment.adClaims[runId];
    if(claim?.status==='claimed'&&claim.requestId===requestId)return {ok:true,amount:claim.amount,duplicate:true,tickets:this.#state.recruitment.tickets};
    return {ok:false,error:'旧广告请求已失效，请从每日入口重新观看。'};
  }
  cancelRecruitmentAd(runId, requestId) {
    const claim = this.#state.recruitment.adClaims[runId];
    if (!claim || claim.status !== 'pending' || claim.requestId !== requestId) return { ok: true, changed: false };
    const candidate = copy(this.#state); candidate.recruitment.adClaims[runId].status = 'cancelled';
    return this.#change(candidate, { changed: true });
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  replaceState(value) {
    if (!this.#writable) return { ok: false, error: this.#error };
    const candidate = normalizeExpeditionState(value);
    if (!candidate) return { ok: false, error: '拒绝导入无效的远征存档。' };
    const changed = JSON.stringify(candidate) !== JSON.stringify(this.#state);
    if (!changed) return { ok: true, changed: false };
    if(this.#pendingDraw)return {ok:false,error:'请先重试保存已冻结的招募结果。'};
    let original;
    try {
      if (!this.#storage || typeof this.#storage.getItem !== 'function' || typeof this.#storage.setItem !== 'function') throw new Error('storage is unavailable');
      original = this.#storage.getItem(STORAGE_KEY);
      if (original !== this.#raw) throw new Error('存档已被其他页面更新，请刷新。');
      if (original !== null) this.#storage.setItem(IMPORT_BACKUP_KEY, original);
      this.#raw = guardedWrite(this.#storage, STORAGE_KEY, this.#raw, JSON.stringify(candidate));
    } catch (cause) {
      this.#error = `导入远征存档失败，未保存：${message(cause)}`;
      return { ok: false, error: this.#error };
    }
    this.#state = candidate; this.#error = ''; this.#notify();
    return { ok: true, changed: true };
  }

  selectHero(heroId) {
    if (!this.#writable) return { ok: false, error: this.#error };
    const hero = getHero(heroId), faction = hero && getFaction(hero.faction);
    if (!hero || !faction) return { ok: false, error: '未知英雄。' };
    const candidate = copy(this.#state);
    candidate.selectedHeroId = hero.id;
    candidate.squad = [...candidate.factionSquads[faction.id]];
    if (!this.#commit(candidate)) return { ok: false, error: this.#error };
    return { ok: true, heroId: hero.id, factionId: faction.id, squad: [...candidate.squad] };
  }

  train(cardId) {
    if (!this.#writable) return { ok: false, error: this.#error };
    if (!CAMPAIGN_UNIT_IDS.includes(cardId) || !this.#state.inventory.units.includes(cardId)) return { ok: false, error: '只能培养已拥有的单位。' };
    const rank = this.#state.training[cardId];
    if (rank >= TRAINING_COSTS.length) return { ok: false, error: '该单位已达到最高训练等级。' };
    if (rank+1>unitCap(this.#state,cardId)) return {ok:false,error:'尚未开放此阶单位培养。'};
    const cost = TRAINING_COSTS[rank];
    if (this.#state.coins < cost) return { ok: false, error: '金币不足。', cost, coins: this.#state.coins };
    const candidate = copy(this.#state); candidate.coins -= cost; candidate.training[cardId] += 1;
    if (!this.#commit(candidate)) return { ok: false, error: this.#error };
    return { ok: true, cardId, rank: candidate.training[cardId], cost, coins: candidate.coins };
  }

  setSquad(ids) {
    if (!this.#writable) return { ok: false, error: this.#error };
    const faction = selectedFaction(this.#state);
    if (!faction || !validSquad(ids, allowedUnits(this.#state, faction))) return { ok: false, error: '队伍必须由当前阵营的 3 个不同单位组成。' };
    if (deploymentCost(ids) > DEPLOYMENT_BUDGET) return { ok: false, error: `前两名部署单位的总费用不能超过 ${DEPLOYMENT_BUDGET}。` };
    const candidate = copy(this.#state); candidate.squad = [...ids]; candidate.factionSquads[faction.id] = [...ids];
    if (!this.#commit(candidate)) return { ok: false, error: this.#error };
    return { ok: true, squad: [...ids] };
  }

  setBattleDeck(deck) {
    if (!validatePlayerDeck(deck, this.#state.selectedHeroId, this.#state.inventory)) return { ok: false, error: '牌组必须包含30张已拥有的本阵营或中立卡牌，每种至多3张。' };
    const candidate = copy(this.#state); candidate.factionDecks[selectedFaction(candidate).id] = [...deck];
    return this.#change(candidate, { deck: [...deck] });
  }
  getBattleLoadout() { return { ...this.getLoadout(), growthVersion: copy(this.#state.growthVersion), deck: [...this.#state.factionDecks[selectedFaction(this.#state).id]] }; }
  getLoadout() {
    return { spells: [...this.#state.factionSpells[selectedFaction(this.#state).id]], spellTraining: copy(this.#state.spellTraining), spellModes: copy(this.#state.spellModes), specializations: copy(this.#state.specializations) };
  }
  setSpells(ids) {
    const faction = selectedFaction(this.#state);
    if (!Array.isArray(ids) || ids.length !== 2 || new Set(ids).size !== 2 || ids.some(id => !faction.spellIds.includes(id) || !this.#state.inventory.spells.includes(id))) return { ok: false, error: '请选择当前阵营已解锁的两个不同法术。' };
    const candidate = copy(this.#state); candidate.factionSpells[faction.id] = [...ids];
    return this.#change(candidate, { spells: [...ids] });
  }
  trainSpell(id) {
    if (!this.#writable) return { ok: false, error: this.#error };
    const rank = this.#state.spellTraining[id];
    if (!SPELL_IDS.includes(id) || !this.#state.inventory.spells.includes(id)) return { ok: false, error: '只能培养已拥有的法术。' };
    const policy = getSpellTrainingPolicy(id);
    if (!policy.trainable) return {ok:false,error:policy.reason};
    if (rank >= 2) return { ok: false, error: '法术已达到最高阶。' };
    if (rank+1 > spellCap(this.#state,id)) return { ok: false, error: '尚未开放此阶法术培养。' };
    const cost = SPELL_TRAINING_COSTS[rank];
    if (this.#state.coins < cost) return { ok: false, error: '金币不足。', cost };
    const candidate = copy(this.#state); candidate.coins -= cost; candidate.spellTraining[id]++;
    if (rank === 0) candidate.spellModes[id] = 'power';
    return this.#change(candidate, { cardId: id, rank: rank + 1, cost, coins: candidate.coins });
  }
  setSpellMode(id, mode) {
    if (!SPELL_IDS.includes(id) || !this.#state.inventory.spells.includes(id) || !validMode(mode, this.#state.spellTraining[id])) return { ok: false, error: '该法术模式尚未开放。' };
    const candidate = copy(this.#state); candidate.spellModes[id] = mode;
    return this.#change(candidate, { cardId: id, mode });
  }
  setSpecialization(id, specialization) {
    if (!CAMPAIGN_UNIT_IDS.includes(id) || !this.#state.inventory.units.includes(id) || !validSpecialization(id, specialization, this.#state.training[id], this.#state.growthVersion[id])) return { ok: false, error: '该专精尚未开放。' };
    const candidate = copy(this.#state); candidate.specializations[id] = specialization;
    return this.#change(candidate, { cardId: id, specialization });
  }
  redeemGiftCode(input) {
    if (!this.#writable) return { ok: false, error: this.#error };
    if (this.#pendingDraw) return { ok: false, error: '请先重试保存已冻结的招募结果。' };
    const gift = findGiftCode(input);
    if (!gift) return { ok: false, error: '兑换码无效。' };
    if (Object.hasOwn(this.#state.giftCodeClaims, gift.id)) return { ok: false, error: '该兑换码已领取。' };
    const candidate = copy(this.#state);
    try {
      candidate.coins = safeAdd(candidate.coins, gift.coins);
      candidate.recruitment.tickets = safeAdd(candidate.recruitment.tickets, gift.orbs);
    } catch (cause) { return { ok: false, error: message(cause) }; }
    candidate.giftCodeClaims[gift.id] = { code: gift.code, coins: gift.coins, orbs: gift.orbs };
    return this.#change(candidate, { duplicate: false, coins: gift.coins, orbs: gift.orbs, code: gift.code });
  }
  #change(candidate, result) {
    if (!this.#writable) return { ok: false, error: this.#error };
    if (!this.#commit(candidate)) return { ok: false, error: this.#error };
    return { ok: true, ...result };
  }
  getFactionProgress(factionId=selectedFaction(this.#state).id) {
    const completed=this.#state.factionCompleted[factionId]??[];
    return {factionId,completed:copy(completed),unlocked:LEVEL_IDS.filter(id=>this.isUnlocked(id,factionId)),legacyUnlocked:copy(this.#state.legacyUnlockedLevels),legacyExplanation:this.#state.legacyUnlockedLevels.length?'继承旧共享远征的解锁资格；不计作该阵营首通。':'',unitRankCap:rankCap(progressDepth(this.#state,factionId)),spellRankCap:progressDepth(this.#state,factionId)>=6?2:progressDepth(this.#state,factionId)>=3?1:0};
  }
  isUnlocked(levelId,factionId=selectedFaction(this.#state).id) {const index=LEVEL_IDS.indexOf(levelId);return index===0||this.#state.legacyUnlockedLevels.includes(levelId)||index>0&&this.#state.factionCompleted[factionId]?.includes(LEVEL_IDS[index-1]);}
  rewardPreview(levelId,factionId=selectedFaction(this.#state).id) {const r=buildReward(this.#state,levelId,factionId);return r?{...r,orbs:r.tickets,chapterBonus:r.chapterCoins,units:[...r.cards.units],spells:[...r.cards.spells]}:null;}
  saveBattle(match) {
    if(!this.#writable)return {ok:false,error:this.#error};
    const factionId=getHero(match?.players?.[0]?.generalId)?.faction;
    if(!validateMatch(match)||match.mode!=='expedition'||!LEVEL_BY_ID.has(match.levelId)){this.#error='战斗快照无效。';return {ok:false,error:this.#error};}
    if(!this.isUnlocked(match.levelId,factionId)){this.#error='该阵营关卡尚未解锁。';return {ok:false,error:this.#error};}
    if(Object.hasOwn(this.#state.settlements,match.runId)){this.#error='该次战斗已经结算，不能重新激活。';return {ok:false,error:this.#error};}
    if(match.schemaVersion>=7&&!Object.hasOwn(this.#state.battleRewards,match.runId)&&(match.phase!=='mulligan'||match.round!==0))return {ok:false,error:'新战斗必须在开局换牌前冻结奖励。'};
    const candidate=copy(this.#state);candidate.activeBattle=copy(match);
    candidate.battleRewards[match.runId]??=buildReward(candidate,match.levelId,factionId,match.schemaVersion<=6,this.#configError?0:this.#config.victoryTickets);
    if(!this.#commit(candidate))return {ok:false,error:this.#error};return {ok:true,reward:copy(candidate.battleRewards[match.runId])};
  }
  settle(match) {
    if(!this.#writable)return {ok:false,error:this.#error};
    if(!validateMatch(match)||match.mode!=='expedition'||match.phase!=='over'||match.winner!==0||!LEVEL_BY_ID.has(match.levelId))return {ok:false,error:'只有已获胜的远征战斗可以结算。'};
    const prior=this.#state.settlements[match.runId];
    if(prior){if(this.#state.activeBattle?.runId===match.runId){const candidate=copy(this.#state);candidate.activeBattle=null;if(!this.#commit(candidate))return {ok:false,error:this.#error};}return {ok:true,amount:prior.amount,firstClear:prior.firstClear,duplicate:true,coins:this.#state.coins,tickets:this.#state.recruitment.victoryClaims[match.runId]??0,unlocked:{units:[],spells:[]}};}
    const factionId=getHero(match.players[0].generalId)?.faction;
    if(!this.isUnlocked(match.levelId,factionId)){this.#error='该阵营关卡尚未解锁。';return {ok:false,error:this.#error};}
    const receipt=this.#state.battleRewards[match.runId] ?? (match.schemaVersion<=6?buildReward(this.#state,match.levelId,factionId,true,this.#configError?0:this.#config.victoryTickets):null);
    if(!receipt||receipt.levelId!==match.levelId||receipt.factionId!==factionId)return {ok:false,error:'缺少开战奖励凭据，请重新开战。'};
    if(receipt.accountFirst!==!Object.hasOwn(this.#state.accountStageClaims,match.levelId) || !receipt.legacy&&receipt.factionFirst!==!this.#state.factionCompleted[factionId].includes(match.levelId))return {ok:false,error:'奖励资格已被其他战斗提交，原凭据保留，请刷新。'};
    if(!receipt.legacy&&receipt.chapterCoins&&Object.hasOwn(this.#state.factionChapterClaims,receipt.chapterKey))return {ok:false,error:'章节奖励已经提交，请刷新。'};
    const candidate=copy(this.#state),unlocked={units:[],spells:[]};
    candidate.coins+=receipt.coins;candidate.recruitment.tickets+=receipt.tickets;
    if(!candidate.completed.includes(match.levelId))candidate.completed.push(match.levelId);
    candidate.accountStageClaims[match.levelId]??=match.runId;
    // This victory has an observed faction even when its frozen payout belongs to the old rules.
    if(!candidate.factionCompleted[factionId].includes(match.levelId))candidate.factionCompleted[factionId].push(match.levelId);
    if(!receipt.legacy&&receipt.chapterCoins)candidate.factionChapterClaims[receipt.chapterKey]=match.runId;
    for(const kind of ['units','spells'])for(const id of receipt.cards[kind])if(!candidate.inventory[kind].includes(id)){candidate.inventory[kind].push(id);unlocked[kind].push(id);}
    // A preserved pre-expansion receipt pays its original currency and cards.
    // The newly observed victory independently earns only the new content IDs.
    const contentGrants=grantEarnedExpansionCards(candidate);
    for(const kind of ['units','spells'])unlocked[kind].push(...contentGrants[kind]);
    candidate.recruitment.victoryClaims[match.runId]=receipt.tickets;
    candidate.settlements[match.runId]={levelId:match.levelId,amount:receipt.coins,firstClear:receipt.accountFirst};candidate.battleRewards[match.runId]=copy(receipt);candidate.activeBattle=null;
    if(!this.#commit(candidate))return {ok:false,error:this.#error};
    return {ok:true,amount:receipt.coins,firstClear:receipt.accountFirst,factionFirst:receipt.factionFirst,duplicate:false,coins:candidate.coins,tickets:receipt.tickets,unlocked,reward:copy(receipt)};
  }
  rewardOffer(runId) {
    const settlement=typeof runId==='string'?this.#state.settlements[runId]:null,claim=this.#state.rewardClaims[runId];
    return {eligible:false,amount:claim?.amount??(settlement?LEVEL_BY_ID.get(settlement.levelId).reward.repeat:0),claimed:claim?.status==='claimed',reason:'请使用每日金币奖励入口。'};
  }
  beginReward() { return {ok:false,error:'旧胜利广告入口已停止，请使用每日金币奖励入口。'}; }
  completeReward(runId,requestId) {
    const claim=this.#state.rewardClaims[runId];
    if(claim?.status==='claimed'&&claim.requestId===requestId)return {ok:true,amount:claim.amount,duplicate:true,coins:this.#state.coins};
    return {ok:false,error:'旧广告请求已失效，请从每日入口重新观看。'};
  }
  cancelReward(runId, requestId) {
    if (!this.#writable) return { ok: false, error: this.#error };
    const claim = typeof runId === 'string' ? this.#state.rewardClaims[runId] : null;
    if (!claim || claim.status !== 'pending' || claim.requestId !== requestId) return { ok: true, changed: false };
    const candidate = copy(this.#state); delete candidate.rewardClaims[runId];
    if (!this.#commit(candidate)) return { ok: false, error: this.#error };
    return { ok: true, changed: true };
  }
  clearBattle() {
    if (!this.#writable) return { ok: false, error: this.#error };
    if (this.#state.activeBattle && this.#state.activeBattle.phase !== 'over') return { ok: false, error: '进行中的战斗不能清除。' };
    if (this.#state.activeBattle === null) return { ok: true, changed: false };
    const candidate = copy(this.#state); candidate.activeBattle = null;
    if (!this.#commit(candidate)) return { ok: false, error: this.#error }; return { ok: true, changed: true };
  }

  #load() {
    let raw;
    try { if (!this.#storage || typeof this.#storage.getItem !== 'function') throw new Error('storage is unavailable'); raw = this.#storage.getItem(STORAGE_KEY); }
    catch (cause) { this.#reject(`读取远征存档失败：${message(cause)}`); return; }
    this.#raw = raw;
    if (raw == null) return;
    let record; try { record = JSON.parse(raw); } catch { this.#reject('远征存档格式不支持，原件已保留。'); return; }
    if (validState(record)) { this.#state = copy(record); return; }
    const migrated = normalizeExpeditionState(record);
    if (!migrated || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(record.schemaVersion)) { this.#reject('远征存档格式不支持，原件已保留。'); return; }
    const backupKey = record.schemaVersion === 1 ? LEGACY_BACKUP_KEY : record.schemaVersion === 2 ? LEGACY_V2_BACKUP_KEY : record.schemaVersion === 3 ? LEGACY_V3_BACKUP_KEY : `${STORAGE_KEY}.legacy-v${record.schemaVersion}-backup`;
    try { this.#storage.setItem(backupKey, raw); this.#raw = guardedWrite(this.#storage, STORAGE_KEY, raw, JSON.stringify(migrated)); }
    catch (cause) {
      // guardedWrite restores only our own failed bytes; never overwrite a newer page.
      this.#reject(`迁移远征存档失败，原件未转换：${message(cause)}`); return;
    }
    this.#state = migrated;
  }
  #commit(candidate) {
    if(this.#pendingDraw&&JSON.stringify(candidate)!==JSON.stringify(this.#pendingDraw.candidate)){this.#error='请先重试保存已冻结的招募结果。';return false;}
    if (!validState(candidate)) { this.#error = '拒绝写入无效的远征存档。'; return false; }
    try { if (!this.#storage || typeof this.#storage.setItem !== 'function') throw new Error('storage is unavailable'); this.#raw = guardedWrite(this.#storage, STORAGE_KEY, this.#raw, JSON.stringify(candidate)); }
    catch (cause) { this.#error = `写入远征存档失败，未保存：${message(cause)}`; return false; }
    const changed = JSON.stringify(candidate) !== JSON.stringify(this.#state);
    this.#state = candidate; this.#error = ''; if (changed) this.#notify(); return true;
  }
  #notify() { for (const listener of [...this.#listeners]) { try { listener(this.state); } catch {} } }
  #reject(error) { this.#error = error; this.#writable = false; }
}

function migrateLegacy(legacy) {
  const migrated = initialState(); migrated.coins = legacy.coins;
  for (const id of LEGACY_TRAINABLE_IDS) migrated.training[id] = legacy.training[id];
  migrated.factionSquads[1] = [...legacy.squad]; migrated.squad = [...legacy.squad]; migrated.completed = copy(legacy.completed);
  migrated.activeBattle = copy(legacy.activeBattle); migrated.settlements = copy(legacy.settlements); return addBattleDecks(addLegacyGrowth(migrated));
}
function migrateRoster(legacy) {
  const migrated = { ...copy(legacy), schemaVersion: SCHEMA_VERSION, recruitment: initialRecruitment(), rewardClaims: copy(legacy.rewardClaims ?? {}) };
  migrated.training = Object.fromEntries(CAMPAIGN_UNIT_IDS.map((id) => [id, legacy.training[id] ?? 0]));
  return addBattleDecks(addLegacyGrowth(migrated));
}
export function validateExpeditionState(value) { return validState(value); }
export function normalizeExpeditionState(value) {
  try{const state=normalizeProfile(value);if(state&&!Object.hasOwn(state,'giftCodeClaims'))state.giftCodeClaims={};return state&&validState(state)?state:null;}catch{return null;}
}
function normalizeProfile(value) {
  if(validState(value))return copy(value);
  if(value?.schemaVersion===12&&validProfile(value,12))return {...copy(value),schemaVersion:SCHEMA_VERSION,giftCodeClaims:{}};
  if(value?.schemaVersion===11&&validProfile(value,11)){try{return {...copy(value),schemaVersion:SCHEMA_VERSION,recruitment:upgradeRecruitment(value.recruitment)};}catch{return null;}}
  if([8,9,10].includes(value?.schemaVersion) && validProfile(value,value.schemaVersion))return expandContentProfile({...copy(value),schemaVersion:SCHEMA_VERSION,recruitment:normalizeRecruitment(value.recruitment),dailyAds:value.dailyAds??initialDailyAds()});
  let migrated=null;
  if([5,6,7].includes(value?.schemaVersion)&&validProfile(value,value.schemaVersion))migrated={...copy(value),schemaVersion:SCHEMA_VERSION,recruitment:value.recruitment??{tickets:0,fragments:{},victoryClaims:{},adClaims:{}}};
  else if(validV4State(value)||validOldRosterState(value))migrated=migrateRoster(value);
  else if(validLegacyState(value))migrated=migrateLegacy(value);
  if(!migrated)return null;
  const upgraded=upgradeCampaign(migrated,value);
  return upgraded?expandContentProfile(upgraded):null;
}
function validState(value) { return validProfile(value, SCHEMA_VERSION); }
function validV5State(value) { return validProfile(value, 5); }
function validV6State(value) { return validProfile(value, 6); }
function validProfile(value, version) {
  if (!plainObject(value)) return false;
  const expected = ['activeBattle', 'coins', 'completed', 'factionSquads', 'rewardClaims', 'schemaVersion', 'selectedHeroId', 'settlements', 'squad', 'training', 'inventory', 'spellTraining', 'factionSpells', 'spellModes', 'specializations'];
  if (version >= 13) expected.push('giftCodeClaims');
  if (version >= 13 && !validateGiftCodeClaims(value.giftCodeClaims)) return false;
  if (version >= 9) expected.push('dailyAds');
  if (version >= 6) expected.push('recruitment');
  if (version >= 7) expected.push('factionDecks');
  if(version>=8)expected.push('factionCompleted','legacyUnlockedLevels','growthVersion','accountStageClaims','factionChapterClaims','battleRewards');
  if (!exactKeys(value, expected) || value.schemaVersion !== version || !safeInteger(value.coins, 0) || !validTraining(value.training, profileUnitIds(version))) return false;
  const hero = getHero(value.selectedHeroId), faction = hero && getFaction(hero.faction);
  return !!faction && (version < 6 || validateRecruitmentState(value.recruitment, value.settlements,version<8,version)) && validGrowth(value,version) && (version<8||validCampaignFields(value,version)) && (version < 7 || validFactionDecks(value)) && validFactionSquads(value.factionSquads, Object.fromEntries(FACTIONS.map(f => [f.id, allowedUnits(value, f)]))) && sameArray(value.squad, value.factionSquads[faction.id]) && validSharedState(value,version>=10?LEVEL_BY_ID:new Set(PRE_EXPANSION_LEVEL_IDS)) && validRewardClaims(value) && (version<9 || validateDailyAds(value.dailyAds,value));
}
function validV4State(value) {
  const keys = ['activeBattle','coins','completed','factionSquads','rewardClaims','schemaVersion','selectedHeroId','settlements','squad','training'];
  if (!plainObject(value) || !exactKeys(value, keys) || value.schemaVersion !== 4 || !safeInteger(value.coins,0) || !validTraining(value.training,LEGACY_V4_TRAINABLE_IDS)) return false;
  const faction = selectedFaction(value);
  return !!faction && validFactionSquads(value.factionSquads, LEGACY_V4_FACTION_UNITS) && sameArray(value.squad,value.factionSquads[faction.id]) && validSharedState(value,new Set(PRE_EXPANSION_LEVEL_IDS)) && validRewardClaims(value);
}
function validOldRosterState(value) {
  if (!plainObject(value) || ![2, 3].includes(value.schemaVersion)) return false;
  const expected = ['activeBattle', 'coins', 'completed', 'factionSquads', 'schemaVersion', 'selectedHeroId', 'settlements', 'squad', 'training'];
  if (value.schemaVersion === 3) expected.push('rewardClaims');
  if (!exactKeys(value, expected) || !safeInteger(value.coins, 0) || !validTraining(value.training, LEGACY_V2_V3_TRAINABLE_IDS)) return false;
  const hero = getHero(value.selectedHeroId), faction = hero && getFaction(hero.faction);
  return !!faction && validFactionSquads(value.factionSquads, LEGACY_FACTION_UNITS)
    && sameArray(value.squad, value.factionSquads[faction.id]) && validSharedState(value, LEGACY_LEVEL_IDS)
    && (value.schemaVersion === 2 || validRewardClaims(value));
}
// Paid settlements and reserved advertisement amounts are historical ledger facts.
// Balance updates change newly created records, never an existing reward entitlement.
function validRewardClaims(value) {
  if (!plainObject(value.rewardClaims)) return false;
  for (const [runId, claim] of Object.entries(value.rewardClaims)) {
    const settlement = value.settlements[runId], level = settlement && LEVEL_BY_ID.get(settlement.levelId);
    if (!settlement || !level || !plainObject(claim) || !exactKeys(claim, ['amount', 'levelId', 'requestId', 'status'])) return false;
    if (!['pending', 'claimed'].includes(claim.status) || typeof claim.requestId !== 'string' || claim.requestId.length < 1) return false;
    if (claim.levelId !== settlement.levelId || !safeInteger(claim.amount, 0)) return false;
  }
  return true;
}
function validLegacyState(value) {
  if (!plainObject(value)) return false;
  const expected = ['activeBattle', 'coins', 'completed', 'schemaVersion', 'settlements', 'squad', 'training'];
  return exactKeys(value, expected) && value.schemaVersion === 1 && safeInteger(value.coins, 0)
    && validTraining(value.training, LEGACY_TRAINABLE_IDS) && validSquad(value.squad, LEGACY_TRAINABLE_IDS) && validSharedState(value, LEGACY_LEVEL_IDS);
}
function validSharedState(value, allowedLevels = LEVEL_BY_ID) {
  if (!Array.isArray(value.completed) || new Set(value.completed).size !== value.completed.length || value.completed.some((id) => !allowedLevels.has(id))) return false;
  if (value.activeBattle !== null && (!validateMatch(value.activeBattle) || value.activeBattle.mode !== 'expedition' || !allowedLevels.has(value.activeBattle.levelId))) return false;
  if (!plainObject(value.settlements)) return false;
  for (const [runId, settlement] of Object.entries(value.settlements)) {
    if (!runId || !plainObject(settlement) || !exactKeys(settlement, ['amount', 'firstClear', 'levelId'])) return false;
    const level = LEVEL_BY_ID.get(settlement.levelId);
    if (!level || !allowedLevels.has(settlement.levelId) || typeof settlement.firstClear !== 'boolean' || !safeInteger(settlement.amount, 0)) return false;
  }
  return true;
}
function validTraining(training, ids) { return plainObject(training) && exactKeys(training, ids.map(String)) && ids.every((id) => safeInteger(training[id], 0, TRAINING_COSTS.length)); }
function validFactionSquads(squads, historicalUnits = null) { return plainObject(squads) && exactKeys(squads, FACTION_IDS.map(String)) && FACTIONS.every((faction) => validSquad(squads[faction.id], historicalUnits?.[faction.id] ?? faction.unitIds)); }
function validSquad(squad, ids) { return Array.isArray(squad) && squad.length === 3 && new Set(squad).size === 3 && squad.every((id) => ids.includes(id)); }
function selectedFaction(state) { return getFaction(getHero(state.selectedHeroId)?.faction); }
function sameArray(a, b) { return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]); }
function exactKeys(value, expected) { const actual = Object.keys(value).sort(), sorted = [...expected].map(String).sort(); return actual.length === sorted.length && actual.every((key, index) => key === sorted[index]); }
function plainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function safeInteger(value, min, max = Number.MAX_SAFE_INTEGER) { return Number.isSafeInteger(value) && value >= min && value <= max; }
function message(cause) { return cause instanceof Error ? cause.message : String(cause); }

function initialGrowth() {
  return { inventory: mergeInventory(unlockedInventory([], { legacy: false }), starterInventory()), spellTraining: Object.fromEntries(SPELL_IDS.map(id=>[id,0])),
    factionSpells: Object.fromEntries(FACTIONS.map(f=>[f.id,f.spellIds.slice(0,2)])), spellModes: Object.fromEntries(SPELL_IDS.map(id=>[id,'base'])), specializations: Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id=>[id,'none'])) };
}
function addLegacyGrowth(value) { return { ...value, ...initialGrowth(), inventory: unlockedInventory(value.completed, { legacy: true }) }; }
function allowedUnits(state, faction) { return faction ? [...faction.unitIds,...NEUTRAL_IDS].filter(id=>state.inventory.units.includes(id)) : []; }
function validMode(mode, rank) { return mode === 'base' || mode === 'power' && rank >= 1 || mode === 'tactical' && rank >= 2; }
function validSpecialization(id,spec,rank,growthVersion='legacy-v1'){return spec==='none'||getUnitSpecializations(id,growthVersion).some((option,index)=>(option.id??option.specialization)===spec&&rank>=(growthVersion==='low-v2'?2:index===0?2:4));}
function profileUnitIds(version){return version>=11?CAMPAIGN_UNIT_IDS:version===10?PROFILE10_UNIT_IDS:version>=8?PRE_EXPANSION_UNIT_IDS:OLD_UNIT_IDS;}
function profileSpellIds(version){return version>=11?SPELL_IDS:version===10?PROFILE10_SPELL_IDS:version>=8?PRE_EXPANSION_SPELL_IDS:OLD_SPELL_IDS;}
function validGrowth(v,version=8) {
  const units=profileUnitIds(version),spells=profileSpellIds(version);
  const uniqueIds = (a,ids)=>Array.isArray(a)&&new Set(a).size===a.length&&a.every(id=>ids.includes(id));
  return plainObject(v.inventory)&&exactKeys(v.inventory,['units','spells'])&&uniqueIds(v.inventory.units,units)&&uniqueIds(v.inventory.spells,spells)
    && plainObject(v.spellTraining)&&exactKeys(v.spellTraining,spells)&&spells.every(id=>safeInteger(v.spellTraining[id],0,2))
    && plainObject(v.spellModes)&&exactKeys(v.spellModes,spells)&&spells.every(id=>validMode(v.spellModes[id],v.spellTraining[id]))
    && plainObject(v.specializations)&&exactKeys(v.specializations,units)&&units.every(id=>validSpecialization(id,v.specializations[id],v.training[id],version>=8?v.growthVersion?.[id]:'legacy-v1'))
    && plainObject(v.factionSpells)&&exactKeys(v.factionSpells,FACTION_IDS)&&FACTIONS.every(f=>uniqueIds(v.factionSpells[f.id],f.spellIds)&&v.factionSpells[f.id].length===2&&v.factionSpells[f.id].every(id=>v.inventory.spells.includes(id)));
}

function mergeInventory(old, added) { return { units: [...new Set([...old.units,...added.units])], spells: [...new Set([...old.spells,...added.spells])] }; }
function defaultDecks(inventory) { return Object.fromEntries(FACTIONS.map(f=>[f.id,makeStarterDeck(f.heroIds[0],inventory)])); }
function addBattleDecks(value) { const inventory = mergeInventory(value.inventory,starterInventory()); return { ...value, inventory, factionDecks: defaultDecks(inventory) }; }
function validFactionDecks(value) { return plainObject(value.factionDecks) && exactKeys(value.factionDecks,FACTION_IDS) && FACTIONS.every(f=>validatePlayerDeck(value.factionDecks[f.id],f.heroIds[0],value.inventory)); }
function initialCampaignFields(){return {factionCompleted:Object.fromEntries(FACTIONS.map(f=>[f.id,[]])),legacyUnlockedLevels:[],growthVersion:Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id=>[id,'low-v2'])),accountStageClaims:{},factionChapterClaims:{},battleRewards:{}};}
const owns=(state,id)=>state.inventory.units.includes(id)||state.inventory.spells.includes(id);
function progressDepth(state,factionId){const own=state.factionCompleted[factionId]??[];const ownDepth=Math.max(0,...own.map(id=>LEVEL_IDS.indexOf(id)+1));const inheritedDepth=Math.max(0,...Object.entries(state.accountStageClaims).filter(([,run])=>run==='legacy').map(([id])=>LEVEL_IDS.indexOf(id)+1),...state.legacyUnlockedLevels.map(id=>Math.max(0,LEVEL_IDS.indexOf(id))));return Math.max(ownDepth,inheritedDepth);}
function rankCap(depth){return depth>=15?4:depth>=9?3:depth>=3?2:1;}
function unitCap(state,id){if(state.growthVersion[id]==='legacy-v1')return 4;const faction=FACTIONS.find(f=>f.unitIds.includes(id));return rankCap(faction?progressDepth(state,faction.id):Math.max(...FACTION_IDS.map(fid=>progressDepth(state,fid))));}
// Collection growth uses the card's own campaign rights, independent of the active hero.
function spellCap(state,id){const faction=FACTIONS.find(f=>f.spellIds.includes(id));const depth=faction?progressDepth(state,faction.id):Math.max(...FACTION_IDS.map(fid=>progressDepth(state,fid)));return depth>=spellTrainingGate(1)?2:depth>=spellTrainingGate(0)?1:0;}
function buildReward(state,levelId,factionId,legacy=false,legacyTickets=1){
 const level=LEVEL_BY_ID.get(levelId),faction=getFaction(factionId),index=LEVEL_IDS.indexOf(levelId),chapter=Math.floor(index/3)+1,chapterKey=`${factionId}:${chapter}`;
 if(!level||!faction)return null;
 const accountFirst=legacy?!state.completed.includes(levelId):!Object.hasOwn(state.accountStageClaims,levelId),factionFirst=!state.factionCompleted[factionId].includes(levelId),chapterCoins=!legacy&&factionFirst&&(index+1)%3===0&&!Object.hasOwn(state.factionChapterClaims,chapterKey)?60:0;
 const baseCoins=accountFirst?level.reward.first:level.reward.repeat;
 const rawTickets=legacy?legacyTickets:accountFirst?1+((index+1)%3===0?1:0):factionFirst&&(index+1)%3===0?1:0;
 const allOwned=(state.schemaVersion>=11?ALL_RECRUITMENT_IDS:PREMIUM_IDS).every(id=>owns(state,id)),compensationCoins=!legacy&&allOwned?rawTickets*20:0,tickets=compensationCoins?0:rawTickets;
 const rewards=unlockedInventory([levelId],{legacy:false}),cards={units:[],spells:[]};
 if(legacy){const oldMilestones={16:6,17:9,111:6,116:9,209:3,215:6,309:3,310:6,404:6,413:9,526:3,513:9,19037:9,10012:12,19050:15,20044:4,20068:7};const finished=new Set([...state.completed,levelId]);for(const [key,stage] of Object.entries(oldMilestones)){const id=Number(key),kind=OLD_SPELL_IDS.includes(id)?'spells':'units';if(finished.has(LEVEL_IDS[stage-1])&&!state.inventory[kind].includes(id))cards[kind].push(id);}}
 else {cards.units=rewards.units.filter(id=>!state.inventory.units.includes(id)&&(NEUTRAL_IDS.includes(id)?accountFirst:faction.unitIds.includes(id)&&factionFirst));cards.spells=rewards.spells.filter(id=>!state.inventory.spells.includes(id)&&faction.spellIds.includes(id)&&factionFirst);}
 return {version:1,legacy,levelId,factionId,chapter,chapterKey,accountFirst,factionFirst,baseCoins,chapterCoins,compensationCoins,rawTickets,tickets,coins:baseCoins+chapterCoins+compensationCoins,cards,allOwned};
}
function upgradeCampaign(value,source){
 const inherited=source.completed.length?LEVEL_IDS.slice(0,Math.min(LEVEL_IDS.length,Math.max(...source.completed.map(id=>LEVEL_IDS.indexOf(id)+1))+1)):[];
 const state={...value,...initialCampaignFields(),schemaVersion:SCHEMA_VERSION,dailyAds:initialDailyAds(),legacyUnlockedLevels:inherited,recruitment:normalizeRecruitment(value.recruitment)};
 state.training=Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id=>[id,source.training[id]??0]));
 state.spellTraining=Object.fromEntries(SPELL_IDS.map(id=>[id,source.spellTraining?.[id]??0]));
 state.spellModes=Object.fromEntries(SPELL_IDS.map(id=>[id,source.spellModes?.[id]??'base']));
 state.specializations=Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id=>[id,source.specializations?.[id]??'none']));
 state.growthVersion=Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id=>[id,(source.training[id]??0)>0?'legacy-v1':'low-v2']));
 state.accountStageClaims=Object.fromEntries(source.completed.map(id=>[id,'legacy']));
 state.inventory=mergeInventory(value.inventory,starterInventory());state.factionDecks=value.factionDecks??defaultDecks(state.inventory);
 if(state.activeBattle&&!Object.hasOwn(state.settlements,state.activeBattle.runId))state.battleRewards[state.activeBattle.runId]=buildReward(state,state.activeBattle.levelId,getHero(state.activeBattle.players[0].generalId).faction,true);
 state.giftCodeClaims??={};return validState(state)?state:null;
}
function validCampaignFields(v,version=SCHEMA_VERSION){
 const unitIds=profileUnitIds(version),spellIds=profileSpellIds(version);
 const allowedLevelIds=version>=10?LEVEL_IDS:PRE_EXPANSION_LEVEL_IDS;
 const levels=a=>Array.isArray(a)&&new Set(a).size===a.length&&a.every(id=>allowedLevelIds.includes(id));
 if(!plainObject(v.factionCompleted)||!exactKeys(v.factionCompleted,FACTION_IDS)||!FACTION_IDS.every(id=>levels(v.factionCompleted[id])&&v.factionCompleted[id].every(level=>v.completed.includes(level)))||!levels(v.legacyUnlockedLevels))return false;
 if(!plainObject(v.growthVersion)||!exactKeys(v.growthVersion,unitIds)||unitIds.some(id=>!['legacy-v1','low-v2'].includes(v.growthVersion[id])))return false;
 if(!plainObject(v.accountStageClaims)||!exactKeys(v.accountStageClaims,v.completed)||Object.entries(v.accountStageClaims).some(([id,run])=>run!=='legacy'&&v.settlements[run]?.levelId!==id))return false;
 if(!plainObject(v.factionChapterClaims)||Object.entries(v.factionChapterClaims).some(([key,run])=>!validChapterKey(key,version)||!Object.hasOwn(v.settlements,run)||v.battleRewards?.[run]?.chapterKey!==key||v.battleRewards[run].chapterCoins!==60||!v.factionCompleted[Number(key.split(':')[0])].includes(v.settlements[run].levelId)))return false;
 if(!plainObject(v.battleRewards))return false;
 for(const [runId,r] of Object.entries(v.battleRewards)){
  if(!runId||!plainObject(r)||!exactKeys(r,['version','legacy','levelId','factionId','chapter','chapterKey','accountFirst','factionFirst','baseCoins','chapterCoins','compensationCoins','rawTickets','tickets','coins','cards','allOwned'])||r.version!==1||!allowedLevelIds.includes(r.levelId)||!FACTION_IDS.includes(r.factionId)||typeof r.legacy!=='boolean'||typeof r.accountFirst!=='boolean'||typeof r.factionFirst!=='boolean'||typeof r.allOwned!=='boolean')return false;
  if(r.chapter!==Math.floor(LEVEL_IDS.indexOf(r.levelId)/3)+1||r.chapterKey!==`${r.factionId}:${r.chapter}`||['baseCoins','chapterCoins','compensationCoins','rawTickets','tickets','coins'].some(k=>!safeInteger(r[k],0))||r.coins!==r.baseCoins+r.chapterCoins+r.compensationCoins||r.tickets+(r.compensationCoins/20)!==r.rawTickets)return false;
  if(!r.legacy){const end=(LEVEL_IDS.indexOf(r.levelId)+1)%3===0,expected=r.accountFirst?1+(end?1:0):r.factionFirst&&end?1:0;if(r.rawTickets!==expected||r.accountFirst&&!r.factionFirst||r.chapterCoins&&!end||(r.allOwned?(r.compensationCoins!==r.rawTickets*20||r.tickets!==0):r.compensationCoins!==0))return false;}
  if(!plainObject(r.cards)||!exactKeys(r.cards,['units','spells'])||!Array.isArray(r.cards.units)||!Array.isArray(r.cards.spells)||new Set(r.cards.units).size!==r.cards.units.length||new Set(r.cards.spells).size!==r.cards.spells.length||r.cards.units.some(id=>!unitIds.includes(id))||r.cards.spells.some(id=>!spellIds.includes(id)))return false;
 }
 if(v.activeBattle&&!Object.hasOwn(v.settlements,v.activeBattle.runId)){const r=v.battleRewards[v.activeBattle.runId];if(!r||r.levelId!==v.activeBattle.levelId||r.factionId!==getHero(v.activeBattle.players[0].generalId)?.faction)return false;}
 for(const [run,r] of Object.entries(v.battleRewards)){if(!r.legacy&&(r.rawTickets>2||![0,60].includes(r.chapterCoins)))return false;if(!r.legacy&&(r.cards.units.some(id=>!NEUTRAL_IDS.includes(id)&&!getFaction(r.factionId).unitIds.includes(id))||r.cards.spells.some(id=>!getFaction(r.factionId).spellIds.includes(id))))return false;if(v.settlements[run]&&(v.settlements[run].amount!==r.coins||v.settlements[run].levelId!==r.levelId||v.recruitment.victoryClaims[run]!==r.tickets))return false;}
 return true;
}

// The pre-expansion roster is checked before introducing defaults. Never infer
// faction victories from the historical account-wide entitlement list.
function expandContentProfile(source) {
 const state=copy(source);state.schemaVersion=SCHEMA_VERSION;
 for(const id of CAMPAIGN_UNIT_IDS){state.training[id]??=0;state.growthVersion[id]??='low-v2';state.specializations[id]??='none';}
 for(const id of SPELL_IDS){state.spellTraining[id]??=0;state.spellModes[id]??='base';}
 grantEarnedExpansionCards(state);
 state.giftCodeClaims??={};return validState(state)?state:null;
}
function grantEarnedExpansionCards(state){
 const grants={units:[],spells:[]};
 for(const entry of CARD_ACQUISITION){
  if(!NEW_ACQUISITION_IDS.includes(entry.id)||entry.acquisition!=='campaign')continue;
  const levelId=LEVEL_IDS[entry.level-1];
  const eligible=entry.faction===0?Object.hasOwn(state.accountStageClaims,levelId):state.factionCompleted[entry.faction]?.includes(levelId);
  const kind=entry.type==='unit'?'units':'spells',list=state.inventory[kind];
  if(eligible&&!list.includes(entry.id)){list.push(entry.id);grants[kind].push(entry.id);}
 }
 return grants;
}
function validChapterKey(key,version) {
 const parts=key.split(':');
 return parts.length===2&&String(Number(parts[0]))===parts[0]&&String(Number(parts[1]))===parts[1]&&FACTION_IDS.includes(Number(parts[0]))&&Number(parts[1])>=1&&Number(parts[1])<=Math.ceil((version>=10?LEVEL_IDS:PRE_EXPANSION_LEVEL_IDS).length/3);
}
