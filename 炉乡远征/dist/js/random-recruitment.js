import {recruitmentDraw} from './recruitment.js';
export function safeAdd(a,b){if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||a>Number.MAX_SAFE_INTEGER-b)throw Error('招募资产或计数超出安全范围。');return a+b;}
export function fragmentReward(state,id,amount,config,source='random'){
 const r=state.recruitment;r.fragments[id]=safeAdd(r.fragments[id]??0,amount);
 const recipe=config.recipes.find(v=>v.cardId===id);if(!recipe)throw Error('招募合成配置无效。');
 const newUnit=!state.inventory.units.includes(id)&&r.fragments[id]>=recipe.fragmentsRequired;
 if(newUnit){r.fragments[id]-=recipe.fragmentsRequired;state.inventory.units.push(id);}
 return {kind:'fragments',cardId:id,amount,source,converted:false,newUnit,remainingFragments:r.fragments[id]};
}
// The entire batch is generated into a disposable candidate and committed once.
export function applyRandomRecruitment(state,config,count,rng){
 const r=state.recruitment,draws=[];
 for(let i=0;i<count;i++){
  // Recompute after every award: synthesis or a historical unit entitlement
  // can remove a target before the next draw in this same atomic batch.
  const entries=config.pools[0].entries.filter(e=>!state.inventory.units.includes(e.cardId));
  if(!entries.length)break;
  const reward=recruitmentDraw({entries:config.random.rewards},rng),id=recruitmentDraw({entries},rng).cardId;
  const main=fragmentReward(state,id,reward.amount,config);
  state.coins=safeAdd(state.coins,config.random.coinsPerDraw);
  const rewards=[main,{kind:'coins',cardId:null,amount:config.random.coinsPerDraw,source:'companion',converted:false,newUnit:false}];
  // Old targeted 2/12 progress is 5/30 under the new recipe.
  for(const [key,remaining] of Object.entries(r.random.legacyGuarantees)){
   if(Number(key)===id||remaining===1){rewards.push(fragmentReward(state,Number(key),5,config,'legacy'));delete r.random.legacyGuarantees[key];}
   else r.random.legacyGuarantees[key]=remaining-1;
  }
  const entitlement=r.random.legacyUnitGuarantee;
  if(entitlement){
   const unowned=config.pools[0].entries.map(e=>e.cardId).filter(card=>!state.inventory.units.includes(card));
   if(main.newUnit||!unowned.length)r.random.legacyUnitGuarantee=null;
   else if(entitlement===1){const unit=recruitmentDraw({entries:unowned.map(cardId=>({cardId,weight:1}))},rng).cardId;state.inventory.units.push(unit);rewards.push({kind:'unit',cardId:unit,amount:1,source:'legacy-unit',converted:false,newUnit:true});r.random.legacyUnitGuarantee=null;}
   else r.random.legacyUnitGuarantee=entitlement-1;
  }
  r.random.totalDraws=safeAdd(r.random.totalDraws,1);
  r.random.drawsSinceUnit=rewards.some(e=>e.newUnit)?0:Math.min(9,r.random.drawsSinceUnit+1);
  draws.push({index:i+1,guaranteed:false,rewards,newUnitIds:rewards.filter(e=>e.newUnit).map(e=>e.cardId)});
 }
 if(!draws.length)throw Error('已拥有全部招募单位。');
 // The caller reserved the requested batch cost; refund only undrawn slots.
 r.tickets=safeAdd(r.tickets,count-draws.length);
 const actual=draws.length;
 const result={id:`recruit-${r.random.totalDraws}`,count:actual,ticketCost:actual,draws,newUnitIds:draws.flatMap(d=>d.newUnitIds),coins:actual*config.random.coinsPerDraw,tickets:r.tickets,pity:structuredClone(r.random)};
 r.lastReceipt=structuredClone(result);return result;
}
