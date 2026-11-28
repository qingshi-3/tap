import { getCard } from './cards.js';
import { getHero, getFaction } from './factions.js';
import { CARD_ACQUISITION } from './campaign-content.js';
import { trainingBonus } from './expedition-data.js';
import { getSpellUpgrade, getUnitSpecializations } from './campaign-rules.js';
import { MAX_CARD_COPIES, PLAYER_DECK_SIZE, validatePlayerDeck } from './battle-deck.js';

// Authored local archetypes, not imported competitive lists or measured win rates.
// Each order combines an engine with enablers and interaction; missing cards are
// replaced inside their mana/role slot before relaxing the curve.
const PLANS = {
  1: {units:[21,11,17,9,16,8,14,10,15,22],spells:[20067,20090,20174,20068,20066,20043],name:'邻近护卫'},
  23:{units:[15,22,11,16,21,17,9,14],spells:[20043,20067,20090,20068,20066,20174],name:'治疗成长'},
  101:{units:[110,112,111,108,122,115,121,109],spells:[20168,20081,20086,20102,20087,20129],name:'背刺突击'},
  123:{units:[115,108,116,122,109,110,121],spells:[20081,20168,20129,20086,20087,20082],name:'施法远程'},
  201:{units:[214,216,215,211,212,221,213,220],spells:[20095,20097,20096,20077,20151,20074],name:'沙魔召唤'},
  223:{units:[213,212,210,221,209,220,211,214],spells:[20095,20077,20074,20151,20096,20073],name:'沙海控场'},
  301:{units:[317,311,310,318,321,314,308,313],spells:[20072,20057,20061,20052,20133,20049],name:'暗灵死亡成长'},
  323:{units:[308,316,309,319,318,317,311,310],spells:[20051,20049,20061,20052,20057,20072],name:'腐化控场'},
  401:{units:[406,412,410,402,413,405,403,404],spells:[20116,20125,20119,20113,20117,20157],name:'成长重生'},
  418:{units:[417,410,402,413,405,406,412,403],spells:[20116,20125,20113,20117,20119,20157],name:'随从推进'},
  501:{units:[505,511,503,507,513,506,510,515],spells:[20134,20144,20139,20163,20149,20165],name:'潜入推进'},
  527:{units:[512,519,533,510,515,503,505,508],spells:[20165,20134,20144,20149,20147,20139],name:'冰灵召唤'},
};
const neutrals = new Set(CARD_ACQUISITION.filter(c=>c.type==='unit'&&c.faction===0).map(c=>c.id));
const band = card => card.cost<=2 ? 0 : card.cost<=4 ? 1 : 2;
const priority = (ids,id) => { const index=ids.indexOf(id);return index<0?0:4-index*.22; };

/** Pure recommendation. Accepts ExpeditionProgress.state fields; no writes. */
export function recommendDeck({heroId, selectedHeroId, inventory, training={}, growthVersion={}, specializations={}, spellTraining={}, spellModes={}} = {}) {
  heroId ??= selectedHeroId;
  const hero=getHero(heroId), faction=getFaction(hero?.faction), plan=PLANS[heroId];
  if(!hero||!faction||!plan)return {ok:false,error:'未知主将，无法推荐配牌。'};
  const units=new Set(inventory?.units??[]),spells=new Set(inventory?.spells??[]);
  const pool=[...units,...spells].filter((id,index,all)=>all.indexOf(id)===index).map(getCard).filter(c=>c&&(c.type==='unit'?units.has(c.id)&&(faction.unitIds.includes(c.id)||neutrals.has(c.id)):c.type==='spell'&&spells.has(c.id)&&faction.spellIds.includes(c.id))).map(c=>c.type==='spell'?getSpellUpgrade(c.id,spellTraining[c.id],spellModes[c.id]):c);
  if(pool.length*MAX_CARD_COPIES<PLAYER_DECK_SIZE)return {ok:false,error:'已拥有的可用卡牌不足，无法组成30张牌组。'};
  const owned=new Set(pool.map(c=>c.id)),counts=new Map(),deck=[];
  const score=c=>{
    let value=priority(plan[c.type==='unit'?'units':'spells'],c.id);
    if(c.type==='unit'){
      const bonus=trainingBonus(c.id,training[c.id]??0,growthVersion[c.id]);
      value+=bonus.attack*.9+bonus.health*.45;
      if(getUnitSpecializations(c.id,growthVersion[c.id]).some(s=>s.id===specializations[c.id]&&(training[c.id]??0)>=s.rank))value+=.6;
      // Small utility floor keeps neutral substitutes useful without ranking
      // giant bodies above an authored engine solely by printed attack/health.
      value+=(c.ranged||c.rush||c.provoke||c.openingHeal)?.7:0;
      if(c.healWatch&&!owned.has(20043)&&heroId!==23)value-=3;
      if(c.id===211&&![214,215,216].some(id=>owned.has(id))&&heroId!==201)value-=3;
      if([309,316].includes(c.id)&&!owned.has(308)&&!owned.has(20051)&&heroId!==323)value-=3;
    }else{
      value+=c.campaignMode==='power'?(c.campaignRank??0)*.65:c.tactical?.4:0;
      if(c.id===20097&&!owned.has(212)&&![214,215,216].some(id=>owned.has(id))&&heroId!==201)value-=5;
    }
    return value;
  };
  const pick=(type,targetBand)=>{
    const available=pool.filter(c=>(counts.get(c.id)??0)<MAX_CARD_COPIES&&(!type||c.type===type));
    available.sort((a,b)=>(score(b)-(targetBand===undefined?0:Math.abs(band(b)-targetBand)*5))-(score(a)-(targetBand===undefined?0:Math.abs(band(a)-targetBand)*5))||(counts.get(a.id)??0)-(counts.get(b.id)??0)||a.cost-b.cost||a.id-b.id);
    const card=available[0];if(!card)return false;
    deck.push(card.id);counts.set(card.id,(counts.get(card.id)??0)+1);return true;
  };
  // 21 bodies / 9 spells with nine early bodies, nine midgame and three
  // finishers. Limited collections relax slots, never ownership or legality.
  for(const [target,count] of [[0,9],[1,9],[2,3]])for(let i=0;i<count;i++)pick('unit',target);
  for(let i=0;i<9;i++)pick('spell');
  while(deck.length<PLAYER_DECK_SIZE&&pick()){}
  deck.sort((a,b)=>pool.find(c=>c.id===a).cost-pool.find(c=>c.id===b).cost||a-b);
  if(!validatePlayerDeck(deck,heroId,inventory))return {ok:false,error:'当前收藏无法组成合法的30张牌组。'};
  return {ok:true,deck,summary:`${plan.name}：按已拥有卡牌、培养收益与费用曲线推荐；未经对战胜率验证。`};
}
