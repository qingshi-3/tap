import {evaluateUpgradeOffers,visibleBlocks} from './pve-benchmark-v012-offers';
import {unitDef} from '../src/core/data';
import {EQUIP_MAP} from '../src/core/content';
import {preparationStat,benefitsFromSpellPower} from '../src/core/preparation';
import {battleNo,allOwned,getOwned,takeDraft,reroll,freezeDraft,moveSlot,sell,canSell,sellPrice,unitDestination,allocPoint,equip,equipCap,buy,leaveShop,shopUnitBuysRemaining,currentNode,setGeneralOrder,useSpell,type RunState} from '../src/core/run';
import {type Slotted} from '../src/core/types';
import {playerValue,fieldKey,type SimAction} from './simlib';
export const POLICY_VERSION='benchmark-growth-chain-0.12-upgrade-d';
export const POLICY_RULES={core:'Retain first acquired wind/raptor; change only if absent; train atk there. Gladiator/current highest attack is fallback.',selection:'Current owned stats and visible shelf only. Dancer preferred immediate pursuit. Envoy substitutes dancer or late mentor; never automatic dancer replacement.',mentor:'Choreo bonus scales with max(0,21-battleNo(r)); deploy next to retained combo core, share committed formation.',defense:'Visible current enemy frontline armor>=2 promotes breaker before core; visible snipe/duel/control promotes a second durable body over mentor. No battle preview.',terminal:'Master is late payoff, never required or injected. No rerun selecting winning formation. HP first lifts core above 1.5 times current visible enemy maximum raw hit +2; blocks spread below 3 including native/equipped layers; power requires actual scalable spells. Zilan orders durable front, Kaleos core.',economy:'Real run API for every transaction; current shelves only; refresh only with >=4 gold; preserve growth-bearing core; sales target replaceable units and preserve the retained core.'};
const slots=Array.from({length:8},(_,i)=>i);
const entries=(r:RunState)=>slots.flatMap(i=>{const u=getOwned(r,i);return u?[{i,u}]:[];});
const state=new WeakMap<RunState,{core?:number}>();
export function benchmarkCore(r:RunState):Slotted|undefined {
 const s=state.get(r)??{};state.set(r,s);let u=allOwned(r).find(u=>u?.ownedId===s.core)??undefined;
 if(u)return u;
 u=allOwned(r).find(u=>u&&['s_wind','m_raptor'].includes(u.defId))??undefined;
 if(u)s.core=u.ownedId;return u;
}
const atk=(u:Slotted)=>preparationStat(u,'atk');
export function benchmarkValue(r:RunState,u:Slotted) {
 const c=benchmarkCore(r),id=u.defId,remain=Math.max(0,21-battleNo(r));
 let score=playerValue(u).total;
 if(u.ownedId===c?.ownedId)score+=65;
 else if(['s_wind','m_raptor'].includes(id))score+=c?1:22;
 if(id==='s_dancer')score+=c?28:7;
 if(id==='s_choreo')score+=c&&unitDef(c.defId).traits?.combo?Math.min(30,remain*3):0;
 if(id==='n_envoy')score+=c?(allOwned(r).some(x=>x?.defId==='s_dancer')?5:23):3;
 if(id==='s_master')score+=c?36:9;
 if(id==='n_gladiator'&&!c)score+=12;
 return score;
}
function command(r:RunState,report:((a:SimAction)=>void)|undefined) {
 return (type:string,detail:Record<string,unknown>,fn:()=>boolean)=>{const before=r.gold,shelf=[...r.draft],ok=fn();report?.({battle:r.history.length+1,chapter:r.chapter,node:r.node,type,ok,goldBefore:before,goldAfter:r.gold,detail:{...detail,shelf,owned:entries(r).map(x=>({...x.u,slot:x.i}))}});return ok;};
}
export function benchmarkArrange(r:RunState,report?: (a:SimAction)=>void) {
 const cmd=command(r,report),all=entries(r).map(x=>x.u),core=benchmarkCore(r)??[...all].sort((a,b)=>atk(b)-atk(a))[0];if(!core)return;
 const enemies=currentNode(r).lineup.filter(Boolean),front=enemies[0];
 const armor=front?front.armor??unitDef(front.defId).traits?.armor?.[(front.level??1)-1]??0:0;
 const danger=enemies.some(e=>{const d=unitDef(e!.defId);return d.traits?.snipe||d.traits?.duel||[d.cast,d.afterAttack].some(es=>es?.some(f=>f.op==='freeze'||f.op==='chill'));});
 const rest=all.filter(u=>u!==core),tank=[...rest].sort((a,b)=>fieldKey(b)-fieldKey(a))[0];
 const chosen:Slotted[]=[];const add=(u:Slotted|undefined)=>{if(u&&!chosen.includes(u)&&chosen.length<5)chosen.push(u);};
 add(tank);add(core);add(rest.find(u=>u.defId==='s_dancer'));add(rest.find(u=>u.defId==='s_master'));
 if(armor>=2)add(rest.find(u=>u.defId==='n_breaker'));
 if(danger)add([...rest].filter(u=>!chosen.includes(u)).sort((a,b)=>fieldKey(b)-fieldKey(a))[0]);
 const mentor=rest.find(u=>u.defId==='s_choreo'),envoy=rest.find(u=>u.defId==='n_envoy');
 if(21-battleNo(r)>=3&&unitDef(core.defId).traits?.combo)add(mentor);else add(envoy);
 if(!chosen.some(u=>u.defId==='s_dancer'))add(envoy);
 for(const u of [...rest].sort((a,b)=>benchmarkValue(r,b)-benchmarkValue(r,a)))add(u);
 const protection=chosen.filter(u=>u!==core&&!['s_dancer','s_choreo','s_master','n_envoy','n_breaker'].includes(u.defId));
 const before=chosen.filter(u=>u!==core&&['s_dancer','n_breaker'].includes(u.defId));
 const ordered=[...protection,...before,...chosen.filter(u=>u!==core&&u.defId==='n_envoy'),core,...chosen.filter(u=>u!==core&&u.defId==='s_choreo'),...chosen.filter(u=>u!==core&&u.defId==='s_master')];
 const desired=[...ordered,...Array(5-ordered.length).fill(null),...all.filter(u=>!chosen.includes(u))];
 for(let i=0;i<8;i++)if(desired[i]){const at=entries(r).find(x=>x.u.ownedId===desired[i].ownedId)?.i;if(at!==undefined&&at!==i)cmd('arrange',{from:at,to:i},()=>moveSlot(r,at,i,'swap')!=='invalid');}
 cmd('formationRule',{armor,danger,core:core.ownedId,remainingBattles:21-battleNo(r),mentor:chosen.includes(mentor!),envoy:chosen.includes(envoy!)},()=>true);
}
export {visibleBlocks} from './pve-benchmark-v012-offers';

export function visibleThreat(r:RunState){return Math.max(1,...currentNode(r).lineup.flatMap(e=>{if(!e)return[];const d=unitDef(e.defId),level=(e.level??1)-1;return [e.atk??d.atk+level,...[d.cast,d.chargeSkill].flatMap(es=>(es??[]).filter(f=>f.op==='dmg').map(f=>f.v?.[level]??0))];}));}
export function equipmentScore(r:RunState,id:string,u:Slotted,preferredCore:Slotted|undefined=benchmarkCore(r)){
 const e=EQUIP_MAP[id],d=unitDef(u.defId);if(!e)return -1;
 const has=(key:string)=>!!(d.traits as Record<string,unknown>|undefined)?.[key]||(u.equips??[]).some(x=>!!(EQUIP_MAP[x]?.grants as Record<string,unknown>|undefined)?.[key]);
 if(e.grants?.power&&!benefitsFromSpellPower(u.defId))return -1;
 for(const key of ['combo','reborn','snipe','duel','rotate','taunt'])if((e.grants as Record<string,unknown>|undefined)?.[key]&&has(key))return -1;
 if(e.special==='hourglass'&&!d.traits?.charge)return -1;
 const core=u.ownedId===preferredCore?.ownedId,front=r.slots.find(Boolean)?.ownedId===u.ownedId;
 if(e.grants?.rotate&&(core||front)&&!d.onRotate)return -1;
 if(e.grants?.taunt&&!front)return -1;
 return (e.hp??0)*(core&&preparationStat(u,'hp')<=visibleThreat(r)*1.5+2?4:front?2:1)+(e.atk??0)*(core?3:1)+(e.grants?.power?5:0)+(e.grants?.combo?atk(u):0)+(e.grants?.armor?front?8:core?5:2:0)+(e.grants?.thorns?front?6:1:0)+(e.grants?.reborn?core?12:6:0)+(e.grants?.taunt?5:0)+(e.grants?.snipe||e.grants?.duel?core?6:2:0)+(e.grants?.rotate?front?4:1:0)+(e.afterAttack?core?8:3:0)+(e.onStart?4:0)+(e.special?3:0);
}
export function benchmarkPrepare(r:RunState,report?:(a:SimAction)=>void,noMaster=false) {
 const cmd=command(r,report);
 for(let guard=0;guard<40;guard++) {
  const all=entries(r);const retained=benchmarkCore(r);if(evaluateUpgradeOffers(r,u=>benchmarkValue(r,u),cmd,{protectedIds:new Set(retained?[retained.ownedId]:[]),banned:noMaster?new Set(['s_master']):undefined}))continue;
  let merge=false;
  for(const a of all){const b=all.find(b=>b.i>a.i&&b.u.defId===a.u.defId&&b.u.copies===a.u.copies&&a.u.copies<4);if(b){const oldCore=benchmarkCore(r);const ok=cmd('merge',{from:a.i,to:b.i,id:a.u.defId},()=>moveSlot(r,a.i,b.i)==='merge');if(ok&&[a.u.ownedId,b.u.ownedId].includes(oldCore?.ownedId??-1))state.get(r)!.core=getOwned(r,b.i)!.ownedId;merge=true;break;}}if(merge)continue;
  const ranked=r.draft.flatMap((id,i)=>{if(!id||noMaster&&id==='s_master')return[];const duplicate=all.find(x=>x.u.defId===id&&x.u.copies===1);const sample:Slotted={defId:id,ownedId:-1,copies:1};return[{id,i,duplicate,score:benchmarkValue(r,duplicate?.u??sample)+(duplicate?12:0)}];}).sort((a,b)=>b.score-a.score);
  let bought=false;
  if(r.gold>=3)for(const item of ranked){const core=benchmarkCore(r);const weak=all.filter(x=>x.u.ownedId!==core?.ownedId&&canSell(r,x.i)).sort((a,b)=>benchmarkValue(r,a.u)-benchmarkValue(r,b.u))[0];if(!item.duplicate&&all.length>=5&&weak&&item.score<=benchmarkValue(r,weak.u)+4)continue;
   let dst=item.duplicate?.i??slots.find(i=>!getOwned(r,i));if(dst===undefined&&weak){if(!cmd('sell',{slot:weak.i,id:weak.u.defId,price:sellPrice(weak.u,r)},()=>sell(r,weak.i)))return;dst=unitDestination(r,item.id)??undefined;}if(dst===undefined)continue;
   const oldCore=core?.ownedId;const target=dst;bought=cmd('buy',{shelf:item.i,id:item.id,slot:target,merge:!!item.duplicate},()=>!['invalid','confirm'].includes(takeDraft(r,item.i,target)));if(bought&&oldCore!==undefined&&item.duplicate?.u.ownedId===oldCore)state.get(r)!.core=getOwned(r,target)!.ownedId;if(!bought)return;benchmarkCore(r);break;
  }if(bought)continue;
  for(let i=0;i<r.draft.length;i++){const id=r.draft[i];const keep=!!id&&r.gold<3&&all.some(x=>x.u.defId===id&&x.u.copies<4);if(!!r.draftLocked?.[i]!==keep)cmd('lock',{shelf:i,locked:keep},()=>freezeDraft(r,i));}
  if(r.gold>=4){if(!cmd('refresh',{},()=>reroll(r)))return;continue;}break;
 }
 benchmarkArrange(r,report);const field=entries(r).filter(x=>x.i<5),core=benchmarkCore(r)??[...field].sort((a,b)=>atk(b.u)-atk(a.u))[0]?.u;
 const maxThreat=visibleThreat(r),hpFloor=Math.ceil(maxThreat*1.5)+2;
 for(const type of Object.keys(r.stash))while(r.stash[type]>0){
  let target:typeof field[number]|undefined;
  if(type==='atk')target=field.find(x=>x.u===core);
  else if(type==='hp')target=core&&preparationStat(core,'hp')<=hpFloor?field.find(x=>x.u===core):field[0];
  else if(type==='block')target=[field[0],field.find(x=>x.u===core),...field].find(x=>x&&visibleBlocks(x.u,r)<3);
  else target=field.filter(x=>benefitsFromSpellPower(x.u.defId)).sort((a,b)=>playerValue(b.u).ability-playerValue(a.u).ability)[0];
  if(!target)break;if(!cmd('train',{slot:target.i,id:target.u.defId,point:type,maxThreat,hpFloor,blocksBefore:visibleBlocks(target.u,r)},()=>allocPoint(r,target.i,type)))break;
 }
 for(let n=0;n<r.bag.length;){const id=r.bag[n];const target=field.filter(x=>(x.u.equips?.length??0)<equipCap(r)).map(x=>({...x,score:equipmentScore(r,id,x.u)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score)[0];if(!target||!cmd('equip',{id,slot:target.i,score:target.score},()=>equip(r,n,target.i)))n++;}

 for(let n=r.spells.length-1;n>=0;n--)cmd('spell',{index:n},()=>useSpell(r,n));
 if(['zilan','kaleos'].includes(r.general)){const gold=r.gold;const target=r.general==='kaleos'?core:field.find(x=>x.i>0&&x.u!==core&&!unitDef(x.u.defId).traits?.taunt&&!unitDef(x.u.defId).traits?.idle)?.u??field.at(-1)?.u;const ok=setGeneralOrder(r,target?.ownedId??null);report?.({battle:r.history.length+1,chapter:r.chapter,node:r.node,type:'generalOrder',ok,goldBefore:gold,goldAfter:r.gold,detail:{ownedId:target?.ownedId,rule:r.general==='zilan'?'rotate supporting non-front body; preserve guard adjacency':'retained attack core'}});}
}
export function benchmarkShop(r:RunState,report?:(a:SimAction)=>void,noMaster=false) {
 const cmd=command(r,report),s=r.shop!;
 const purchase=(kind:'units'|'pack'|'equips'|'boon',i=0)=>{const item=kind==='pack'?s.pack:kind==='boon'?s.boon:s[kind][i];return !!item&&!item.sold&&r.gold>=item.price&&cmd('specialBuy',{kind,i,id:'id'in item?item.id:undefined,price:item.price},()=>buy(r,kind,i));};
 if(s.pack)purchase('pack');
 for(const item of s.units.map((u,i)=>({u,i,score:benchmarkValue(r,{defId:u.id,copies:1,ownedId:-1})})).sort((a,b)=>b.score-a.score))if(!(noMaster&&item.u.id==='s_master')&&shopUnitBuysRemaining(r)>0&&unitDestination(r,item.u.id)!==null&&item.score>25)purchase('units',item.i);
 for(let i=0;i<s.equips.length;i++)if(r.slots.some(u=>u&&(u.equips?.length??0)<equipCap(r)&&equipmentScore(r,s.equips[i].id,u)>0))purchase('equips',i);
 if(s.boon)purchase('boon');leaveShop(r);
}

