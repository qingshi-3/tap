import {unitDef} from '../src/core/data';
import {EQUIP_MAP} from '../src/core/content';
import {preparationStat,benefitsFromSpellPower} from '../src/core/preparation';
import {allOwned,getOwned,takeDraft,reroll,freezeDraft,moveSlot,sell,canSell,sellPrice,unitDestination,allocPoint,equip,equipCap,buy,leaveShop,shopUnitBuysRemaining,currentNode,setGeneralOrder,useSpell,battleNo,type RunState} from '../src/core/run';
import {levelFromCopies,type Slotted} from '../src/core/types';
import {playerValue,fieldKey,type SimAction} from './simlib';
import {evaluateUpgradeOffers,visibleBlocks} from './pve-benchmark-v012-offers';
import {visibleThreat,equipmentScore} from './pve-benchmark-v012-policy';
export type Family='summon'|'frost';
export const FAMILY_VERSION='family-history-0.12-upgrade-d';
export const FAMILY_RULES={summon:'Retain a naturally obtained dune/seed/howler original source. Invest attack and survival HP in that source for original-source inheritance; goldob adjacent. Rattle source can lead to create real space. Keeper/incubator/pharaoh/matriarch compete for five actual positions; no inherited-child recursion assumption. Missing sources use combat bodies, no forced supply.',frost:'Retain naturally obtained chaser/mage; train actual spell power there, not attack, stopping at current visible maximum enemy attack +2 chill dose; then support a second chill caster/scalable damage spell, leaving surplus unspent. Bench conduit when the selected primary meets the current threshold; low-power bench casters never keep it active. Conduit adjacent to core and another chill caster when available. Protect with durable front; retain a real attack payoff/body directly behind its taunt, and meet its visible-threat HP floor; do not fill the team with control-only bodies; drake/keeper/queen/wyvern are competing payoffs. Attack points support owned scout/drake/wyvern after comparing visible three-action cold-payoff estimates at one freeze opportunity; require >15%+2 improvement to transfer, so a new dragon does not automatically replace a mature scout/drake; legal sales refund the previous attack body training during this visible finisher transition and record lost permanent growth; current body is fallback; no source, no imaginary freeze combo.',shared:'Only current visible shelf/offers and enemy threat; legal budgets, full history branches, no simulation selection. Shared SAP upgrade-offer buying/locking. No dependency on a unique general or six-tier.'};
const ids=Array.from({length:8},(_,i)=>i),entries=(r:RunState)=>ids.flatMap(i=>{const u=getOwned(r,i);return u?[{i,u}]:[];});
const cores=new WeakMap<RunState,number>();
const originals=['d_dune','a_seed','d_howler'];
const chills=['v_chaser','v_mage'];
export function familyCore(r:RunState,family:Family){const list=family==='summon'?originals:chills;const owned=allOwned(r).filter((u):u is Slotted=>!!u);const retained=owned.find(u=>u.ownedId===cores.get(r)&&list.includes(u.defId));if(retained)return retained;const core=owned.find(u=>list.includes(u.defId));if(core)cores.set(r,core.ownedId);return core;}
export function frostFinisher(r:RunState){
 const core=familyCore(r,'frost'),all=allOwned(r).filter((u):u is Slotted=>!!u&&u!==core&&!unitDef(u.defId).traits?.idle&&!benefitsFromSpellPower(u.defId));const pool=all.reduce((n,u)=>n+(u.train?.atk??0),0);
 const expected=(u:Slotted)=>{const d=unitDef(u.defId),level=levelFromCopies(u.copies)-1,attack=preparationStat(u,'atk')+pool-(u.train?.atk??0);if(u.defId==='v_drake'){const base=d.onEnemyFreeze?.find(e=>e.op==='dmg')?.v?.[level]??0;return attack+base+Math.floor(attack*.5);}if(u.defId==='v_wyvern')return attack*2+2*(d.values?.[level]??1);if(u.defId==='v_scout'){const growth=d.onEnemyFreeze?.find(e=>e.op==='buff')?.v?.[level]??0;return attack+growth*2;}return attack;};
 const current=[...all].sort((a,b)=>(b.train?.atk??0)-(a.train?.atk??0)||expected(b)-expected(a))[0];const candidate=all.filter(u=>['v_scout','v_drake','v_wyvern'].includes(u.defId)).sort((a,b)=>expected(b)-expected(a))[0];if(!candidate)return current;if(!current||candidate===current)return candidate;return expected(candidate)>expected(current)*1.15+2?candidate:current;
}
export function chillGoal(r:RunState){return Math.max(1,...currentNode(r).lineup.flatMap(e=>e?[e.atk??unitDef(e.defId).atk+(e.level??1)-1]:[]))+2;}
export function chillDose(u:Slotted){const d=unitDef(u.defId),level=levelFromCopies(u.copies)-1;const base=Math.max(0,...(d.cast??[]).filter(e=>e.op==='chill').map(e=>e.v?.[level]??0));const power=(d.traits?.power?.[level]??0)+(u.train?.power??0)+(u.growth?.power??0)+(u.equips??[]).reduce((n,id)=>n+(EQUIP_MAP[id]?.grants?.power??0),0);return base+power;}
const needsConduit=(r:RunState)=>{const core=familyCore(r,'frost');return !!core&&chillDose(core)<chillGoal(r);};
export function familyValue(r:RunState,u:Slotted,family:Family){const core=familyCore(r,family),id=u.defId,remaining=Math.max(0,21-battleNo(r));let score=playerValue(u).total;
 if(u.ownedId===core?.ownedId)score+=60;
 if(family==='summon'){
  if(originals.includes(id))score+=core?8:24;
  if(id==='d_goldob')score+=core?Math.min(30,remaining*3)+12:2;
  if(id==='d_keeper')score+=core?25:8;
  if(id==='m_incubator')score+=core?28:3;
  if(id==='d_pharaoh')score+=core?40:3;
  if(id==='a_matriarch')score+=core?30:3;
  if(id==='a_reaper'||id==='a_ritualist'||id==='a_brood')score+=core?14:2;
 }else{
  if(chills.includes(id))score+=core?18:25;
  if(id==='v_conduit')score+=core&&needsConduit(r)?Math.min(30,remaining*3)+8:-15;
  if(['v_keeper','v_sentinel','v_scout'].includes(id))score+=core?18:3;
  if(['v_drake','v_queen','v_wyvern'].includes(id))score+=core?32:5;
  if(id==='a_solus')score+=core&&remaining>=3?22:3;
 }
 if(['s_master','s_dancer','s_choreo','n_envoy'].includes(id))score-=30;
 return score;
}
function command(r:RunState,report?: (a:SimAction)=>void){return(type:string,detail:Record<string,unknown>,fn:()=>boolean)=>{const before=r.gold,shelf=[...r.draft],ok=fn();report?.({battle:r.history.length+1,chapter:r.chapter,node:r.node,type,ok,goldBefore:before,goldAfter:r.gold,detail:{...detail,shelf,owned:entries(r).map(x=>({...x.u,slot:x.i}))}});return ok;};}
function formation(r:RunState,family:Family,report?:(a:SimAction)=>void){const cmd=command(r,report),all=entries(r).map(x=>x.u),core=familyCore(r,family);const ranking=[...all].sort((a,b)=>familyValue(r,b,family)-familyValue(r,a,family));const chosen:Slotted[]=[];const add=(u:Slotted|undefined)=>{if(u&&!chosen.includes(u)&&chosen.length<5)chosen.push(u);};add(core);
 const tank=[...all].filter(u=>u!==core&&!['d_goldob','v_conduit'].includes(u.defId)).sort((a,b)=>fieldKey(b)-fieldKey(a))[0];add(tank);const damageBody=family==='frost'?frostFinisher(r)??[...all].filter(u=>u!==core&&u!==tank&&!unitDef(u.defId).traits?.idle&&!benefitsFromSpellPower(u.defId)).sort((a,b)=>preparationStat(b,'atk')-preparationStat(a,'atk'))[0]:undefined;add(damageBody);const growth=all.find(u=>u.defId===(family==='summon'?'d_goldob':'v_conduit'));if(core&&(21-battleNo(r)>=3||family==='summon'&&!all.some(u=>u.defId==='d_pharaoh'))&&(family!=='frost'||needsConduit(r)))add(growth);
 for(const u of ranking)add(u);
 let field:Slotted[];
 if(family==='summon'&&core&&chosen.includes(core)){const rest=chosen.filter(u=>u!==core&&u!==growth);field=[core,...(chosen.includes(growth!)?[growth!]:[]),...rest.sort((a,b)=>fieldKey(b)-fieldKey(a))];}
 else if(family==='frost'&&core){const second=chosen.find(u=>u!==core&&chills.includes(u.defId));field=[...(chosen.includes(tank!)?[tank!]:[]),...(chosen.includes(damageBody!)?[damageBody!]:[]),...chosen.filter(u=>u!==core&&u!==growth&&u!==second&&u!==tank&&u!==damageBody).sort((a,b)=>fieldKey(b)-fieldKey(a)),...(second?[second]:[]),...(chosen.includes(growth!)?[growth!]:[]),core];}
 else field=[...chosen].sort((a,b)=>fieldKey(b)-fieldKey(a));
 field=[...new Set(field)];
 const desired=[...field,...Array(5-field.length).fill(null),...all.filter(u=>!chosen.includes(u))];for(let i=0;i<8;i++)if(desired[i]){const from=entries(r).find(x=>x.u.ownedId===desired[i].ownedId)?.i;if(from!==undefined&&from!==i)cmd('arrange',{from,to:i},()=>moveSlot(r,from,i,'swap')!=='invalid');}
 cmd('familyFormation',{family,core:core?.ownedId,remainingBattles:21-battleNo(r),publicEnemy:currentNode(r).lineup.map(e=>e?.defId??null)},()=>true);
}
function equipValue(r:RunState,id:string,u:Slotted,family:Family){const core=familyCore(r,family);const score=equipmentScore(r,id,u,core);if(score<=0)return score;const e=EQUIP_MAP[id];if(e.grants?.rotate)return -1;if(family==='frost'&&e.grants?.power&&chills.includes(u.defId)&&chillDose(u)>=chillGoal(r))return -1;return score+(family==='frost'&&e.grants?.power&&u===core?20:0)+(family==='summon'&&e.hp&&u===core?5:0);}
export function familyPrepare(r:RunState,family:Family,report?:(a:SimAction)=>void){const cmd=command(r,report),value=(u:Slotted)=>familyValue(r,u,family);
 for(let guard=0;guard<40;guard++){
  const core=familyCore(r,family);const finisher=family==='frost'?frostFinisher(r):undefined;if(finisher){const donor=entries(r).find(x=>x.u!==finisher&&x.u!==core&&(x.u.train?.atk??0)>0&&canSell(r,x.i));if(donor){if(!cmd('sell',{slot:donor.i,id:donor.u.defId,price:sellPrice(donor.u,r),lostPermanentGrowth:donor.u.growth??{},refundedTraining:donor.u.train??{},reason:'visible frost finisher transition',finisher:finisher.ownedId},()=>sell(r,donor.i)))return;continue;}}if(evaluateUpgradeOffers(r,value,cmd,{protectedIds:new Set(core?[core.ownedId]:[])}))continue;
  const all=entries(r);let merged=false;for(const a of all){const b=all.find(b=>b.i>a.i&&b.u.defId===a.u.defId&&b.u.copies===a.u.copies&&a.u.copies<4);if(b){const was=core?.ownedId;const ok=cmd('merge',{from:a.i,to:b.i,id:a.u.defId},()=>moveSlot(r,a.i,b.i)==='merge');if(ok&&[a.u.ownedId,b.u.ownedId].includes(was??-1))cores.set(r,getOwned(r,b.i)!.ownedId);merged=true;break;}}if(merged)continue;
  const ranked=r.draft.flatMap((id,i)=>{if(!id)return[];const duplicate=all.find(x=>x.u.defId===id&&x.u.copies===1);return[{id,i,duplicate,score:value(duplicate?.u??{defId:id,ownedId:-1,copies:1})+(duplicate?12:0)}];}).sort((a,b)=>b.score-a.score);let purchased=false;
  if(r.gold>=3)for(const item of ranked){const weak=all.filter(x=>x.u!==core&&canSell(r,x.i)).sort((a,b)=>value(a.u)-value(b.u))[0];if(!item.duplicate&&all.length>=5&&weak&&item.score<=value(weak.u)+4)continue;let dst=item.duplicate?.i??ids.find(i=>!getOwned(r,i));if(dst===undefined&&weak){if(!cmd('sell',{slot:weak.i,id:weak.u.defId,price:sellPrice(weak.u,r)},()=>sell(r,weak.i)))return;dst=unitDestination(r,item.id)??undefined;}if(dst===undefined)continue;const target=dst;purchased=cmd('buy',{id:item.id,shelf:item.i,slot:target,merge:!!item.duplicate},()=>!['invalid','confirm'].includes(takeDraft(r,item.i,target)));if(!purchased)return;break;}
  if(purchased)continue;for(let i=0;i<r.draft.length;i++){const keep=!!r.draft[i]&&r.gold<3&&all.some(x=>x.u.defId===r.draft[i]&&x.u.copies<4);if(!!r.draftLocked?.[i]!==keep)cmd('lock',{shelf:i,locked:keep},()=>freezeDraft(r,i));}if(r.gold>=4){if(!cmd('refresh',{},()=>reroll(r)))return;continue;}break;
 }
 formation(r,family,report);const field=entries(r).filter(x=>x.i<5),core=familyCore(r,family),threat=visibleThreat(r);const preferred=family==='frost'?frostFinisher(r):undefined;const attack=preferred?field.find(x=>x.u===preferred):[...field].filter(x=>!unitDef(x.u.defId).traits?.idle&&(family!=='frost'||!benefitsFromSpellPower(x.u.defId))).sort((a,b)=>preparationStat(b.u,'atk')-preparationStat(a.u,'atk'))[0];
 for(const type of Object.keys(r.stash))while(r.stash[type]>0){let target:typeof field[number]|undefined;
  if(type==='atk')target=family==='summon'&&core?field.find(x=>x.u===core):attack;
  else if(type==='power')target=family==='frost'?[...field].filter(x=>chills.includes(x.u.defId)&&chillDose(x.u)<chillGoal(r)).sort((a,b)=>(a.u===core?-1:b.u===core?1:chillDose(a.u)-chillDose(b.u)))[0]??field.find(x=>[unitDef(x.u.defId).cast,unitDef(x.u.defId).chargeSkill].some(es=>es?.some(e=>['dmg','burn','heal'].includes(e.op)))):field.find(x=>benefitsFromSpellPower(x.u.defId));
  else if(type==='hp')target=core&&preparationStat(core,'hp')<threat+(family==='frost'?4:1)?field.find(x=>x.u===core):family==='frost'&&attack&&preparationStat(attack.u,'hp')<=Math.ceil(threat*1.5)+2?attack:family==='summon'?field.find(x=>x.u!==core&&unitDef(x.u.defId).traits?.taunt)??field.find(x=>x.u!==core&&!unitDef(x.u.defId).traits?.idle)??field[0]:field[0];
  else if(type==='block')target=field.find(x=>visibleBlocks(x.u,r)<3);
  if(!target)break;if(!cmd('train',{family,slot:target.i,id:target.u.defId,point:type,threat,blocksBefore:visibleBlocks(target.u,r)},()=>allocPoint(r,target.i,type)))break;
 }
 for(let n=0;n<r.bag.length;){const id=r.bag[n];const target=field.filter(x=>(x.u.equips?.length??0)<equipCap(r)).map(x=>({...x,score:equipValue(r,id,x.u,family)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score)[0];if(!target||!cmd('equip',{id,slot:target.i,score:target.score},()=>equip(r,n,target.i)))n++;}
 for(let n=r.spells.length-1;n>=0;n--)cmd('spell',{index:n},()=>useSpell(r,n));
 if(['zilan','kaleos'].includes(r.general)){const target=r.general==='zilan'?field.find(x=>x.i>1&&x.u!==core&&x.u!==attack?.u&&!unitDef(x.u.defId).traits?.idle)??field.find(x=>x.i>0&&x.u!==attack?.u)??field.at(-1):family==='frost'?field.find(x=>x.u===core)??attack:attack;cmd('generalOrder',{family,ownedId:target?.u.ownedId},()=>setGeneralOrder(r,target?.u.ownedId??null));}
}
export function familyShop(r:RunState,family:Family,report?:(a:SimAction)=>void){const cmd=command(r,report),s=r.shop!;const purchase=(kind:'units'|'pack'|'equips'|'boon',i=0)=>{const item=kind==='pack'?s.pack:kind==='boon'?s.boon:s[kind][i];return!!item&&!item.sold&&r.gold>=item.price&&cmd('specialBuy',{kind,i,id:'id'in item?item.id:undefined,price:item.price},()=>buy(r,kind,i));};if(s.pack)purchase('pack');for(const item of s.units.map((u,i)=>({u,i,score:familyValue(r,{defId:u.id,copies:1,ownedId:-1},family)})).sort((a,b)=>b.score-a.score))if(shopUnitBuysRemaining(r)>0&&unitDestination(r,item.u.id)!==null&&item.score>25)purchase('units',item.i);for(let i=0;i<s.equips.length;i++)if(r.slots.some(u=>u&&(u.equips?.length??0)<equipCap(r)&&equipValue(r,s.equips[i].id,u,family)>0))purchase('equips',i);if(s.boon)purchase('boon');leaveShop(r);}
