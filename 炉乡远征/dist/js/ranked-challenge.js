import {createExpeditionMatch,validateMatch,restoreMatch,findGeneral,challengeContext,bindChallengeContext,unbindChallengeContext,createContentBattleCardTables} from './engine.js';
import {CARD_ACQUISITION} from './campaign-content.js';
import {CAMPAIGN_UNIT_IDS} from './campaign-rules.js';
import {getFaction} from './factions.js';
import {validatePlayerDeck} from './battle-deck.js';
import {getEnemyPlan} from './enemy-plans.js';
import {EXPEDITION_LEVELS} from './expedition-data.js';

export const RANKED_CHALLENGE_KEY='duelyst-h5.safe-v1.ranked-challenge-v1';
const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const faction=getFaction(1);
const level=EXPEDITION_LEVELS.find(level=>level.id==='road-03');
const expectedEnemyPlan=clone(getEnemyPlan('road-03',3,1));
for(const plan of Object.values(expectedEnemyPlan.players))plan.fatigueDamage=1;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const expectedBattleCards=JSON.stringify(canonical(createContentBattleCardTables(expectedEnemyPlan)));
export const RANKED_CHALLENGE=freeze({
  id:'ironcliff-v1',title:'铁崖挑战',heroId:1,levelId:'road-03',seed:20261018,
  inventory:{units:CARD_ACQUISITION.filter(card=>card.type==='unit'&&(card.faction===0||faction.unitIds.includes(card.id))).map(card=>card.id),spells:CARD_ACQUISITION.filter(card=>card.type==='spell'&&faction.spellIds.includes(card.id)).map(card=>card.id)},
  initialDeck:[14,20174,9,21,11,20090,8,16,20067,17].flatMap(id=>[id,id,id]),
  squad:[14,9,11],scoreDescription:'胜利100000 − 回合×1000 − 己方非衍生随从阵亡×25 + 主将剩余生命×5',
});
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const validDeck=deck=>validatePlayerDeck(deck,1,RANKED_CHALLENGE.inventory);
function validContext(value,match) {
  return exact(value,['rng','deaths'])&&Number.isInteger(value.rng)&&value.rng>=0&&value.rng<=4294967295&&value.rng===match.expansionRandom&&Number.isSafeInteger(value.deaths)&&value.deaths>=0;
}
function validChallengeMatch(match) {
  return validateMatch(match)&&match.schemaVersion===7&&match.mode==='expedition'&&match.levelId===RANKED_CHALLENGE.levelId&&match.players[0].generalId===1
    &&JSON.stringify(canonical(match.battleCards))===expectedBattleCards
    &&JSON.stringify(match.enemyPlan)===JSON.stringify(expectedEnemyPlan)&&match.turnLimit===level.turnLimit&&JSON.stringify(match.objective)===JSON.stringify(level.objective)
    &&JSON.stringify(match.board)===JSON.stringify({columns:level.columns,rows:level.rows,tiles:level.tiles??[]})
    &&validDeck(match.loadout.deck)&&JSON.stringify(match.squad)===JSON.stringify(RANKED_CHALLENGE.squad)
    &&Object.values(match.training).every(rank=>rank===0)&&Object.values(match.loadout.growthVersion).every(value=>value==='low-v2')
    &&Object.values(match.loadout.specializations).every(value=>value==='none')&&Object.values(match.loadout.spellTraining).every(value=>value===0)&&Object.values(match.loadout.spellModes).every(value=>value==='base');
}
function makeResult(match,audit) {
  const won=match.phase==='over'&&match.winner===0&&match.result==='win',health=Math.max(0,findGeneral(match,0)?.health??0);
  const score=won?100000-match.round*1000-audit.deaths*25+health*5:0;
  if(!Number.isSafeInteger(score)||score<0||score>100125||!Number.isSafeInteger(health)||health>25)return null;
  return {won,round:match.round,deaths:audit.deaths,health,score,attemptId:match.runId,challengeId:RANKED_CHALLENGE.id};
}
function validResult(value) {
  return value===null||exact(value,['won','round','deaths','health','score','attemptId','challengeId'])&&value.won===true&&value.challengeId===RANKED_CHALLENGE.id&&typeof value.attemptId==='string'&&!!value.attemptId
    &&['round','deaths','health','score'].every(key=>Number.isSafeInteger(value[key])&&value[key]>=0)&&value.round>=1&&value.health<=25&&value.score<=100125&&value.score===100000-value.round*1000-value.deaths*25+value.health*5;
}
/** Only this configured challenge's internally consistent victories can submit. */
export function rankedChallengeScore(result){return result&&validResult(result)?result.score:0;}
function validRecord(value) {
  return exact(value,['schemaVersion','challengeId','deck','bestResult','match','context'])&&value.schemaVersion===1&&value.challengeId===RANKED_CHALLENGE.id&&validDeck(value.deck)&&validResult(value.bestResult)
    &&validChallengeMatch(value.match)&&JSON.stringify(value.deck)===JSON.stringify(value.match.loadout.deck)&&validContext(value.context,value.match);
}

/** Independent local challenge slot. No profile, reward, cloud or campaign calls. */
export class RankedChallengeSession {
  constructor(options={}) {
    this.storage=null;this.raw=null;this.record=null;this.active=null;this.blocked='';this.lastError='';
    try{
      this.storage=Object.hasOwn(options,'storage')?options.storage:globalThis.localStorage;
      if(!this.storage?.getItem||!this.storage?.setItem)throw new Error('本机存储不可用。');
      this.raw=this.storage.getItem(RANKED_CHALLENGE_KEY);
      if(this.raw!==null){const value=JSON.parse(this.raw);if(!validRecord(value))throw new Error('挑战存档格式不受支持，原件已保留。');this.record=value;}
    }catch(error){this.blocked=this.lastError=`无法读取挑战存档：${error.message}`;}
  }
  get error(){return this.lastError;}
  get deck(){return clone(this.record?.deck??RANKED_CHALLENGE.initialDeck);}
  get bestResult(){return clone(this.record?.bestResult??null);}
  get hasResume(){return !this.blocked&&!!this.record&&this.record.match.phase!=='over';}
  owns(match){return !!match&&match===this.active&&!!challengeContext(match);}
  write(record) {
    if(this.blocked)return {ok:false,error:this.blocked};
    try{
      if(!validRecord(record))throw new Error('挑战状态无效，未保存。');
      if(this.storage.getItem(RANKED_CHALLENGE_KEY)!==this.raw)throw new Error('挑战存档已在其他页面更新，请重新进入。');
      const raw=JSON.stringify(record);
      try{this.storage.setItem(RANKED_CHALLENGE_KEY,raw);}
      catch(error){
        // Some synchronous adapters commit then throw. Exact readback is the
        // persisted result; adopt only our candidate, never unrelated bytes.
        if(this.storage.getItem(RANKED_CHALLENGE_KEY)!==raw)throw error;
      }
      if(this.storage.getItem(RANKED_CHALLENGE_KEY)!==raw)throw new Error('挑战存档写入未确认，请重新进入。');
      this.raw=raw;this.record=clone(record);this.lastError='';return {ok:true};
    }catch(error){this.lastError=error.message;return {ok:false,error:this.lastError};}
  }
  createAttempt(deck=this.deck) {
    if(this.blocked)return {ok:false,error:this.blocked};
    if(!validDeck(deck))return {ok:false,error:'挑战牌组须为30张借用卡牌，同名最多3张。'};
    try{
      // Editing order is not a gameplay input: identical multisets must shuffle
      // identically under the fixed seed, regardless of add/remove history.
      deck=[...deck].sort((a,b)=>a-b);
      const growthVersion=Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id=>[id,'low-v2']));
      const match=createExpeditionMatch(RANKED_CHALLENGE.levelId,{},RANKED_CHALLENGE.squad,1,{deck:[...deck],spells:[20174,20043],spellTraining:{},spellModes:{},specializations:{},growthVersion},{challengeSeed:RANKED_CHALLENGE.seed});
      const record={schemaVersion:1,challengeId:RANKED_CHALLENGE.id,deck:[...deck],bestResult:this.bestResult,match:clone(match),context:challengeContext(match)};
      const saved=this.write(record);if(!saved.ok){unbindChallengeContext(match);if(this.active)restoreMatch(clone(this.active));return saved;}
      this.leave();this.active=match;return {ok:true,match};
    }catch(error){if(this.active)restoreMatch(clone(this.active));this.lastError=error.message;return {ok:false,error:this.lastError};}
  }
  checkpoint(match) {
    if(!this.owns(match))return {ok:false,error:'当前棋局不属于远征挑战。'};
    const context=challengeContext(match),result=makeResult(match,context);
    if(!result)return {ok:false,error:'挑战成绩无效，未保存。'};
    let bestResult=this.bestResult;
    if(result.won&&(!bestResult||result.score>bestResult.score))bestResult=result;
    return this.write({schemaVersion:1,challengeId:RANKED_CHALLENGE.id,deck:[...match.loadout.deck],bestResult,match:clone(match),context});
  }
  result(match) {
    if(!this.owns(match)||!validChallengeMatch(match))return null;
    return makeResult(match,challengeContext(match));
  }
  restore() {
    if(this.blocked||!this.record)return null;
    try{
      const match=restoreMatch(clone(this.record.match));if(!match)throw new Error('挑战棋局无效，原件已保留。');
      bindChallengeContext(match,this.record.context);this.leave();this.active=match;this.lastError='';return match;
    }catch(error){this.lastError=error.message;return null;}
  }
  leave(){if(this.active)unbindChallengeContext(this.active);this.active=null;}
}
