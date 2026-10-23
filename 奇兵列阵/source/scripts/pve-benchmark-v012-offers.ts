import {getOwned,canSell,sell,sellPrice,takeUpgradeOffer,freezeUpgradeOffer,type RunState} from '../src/core/run';
import {unitDef} from '../src/core/data';
import {EQUIP_MAP} from '../src/core/content';
import {preparationStat} from '../src/core/preparation';
import {levelFromCopies,type Slotted} from '../src/core/types';
const inspected=new WeakMap<RunState,string>();
/** Visible SAP reward offers only. Each caller re-enters after every merge/purchase. */
export function evaluateUpgradeOffers(r:RunState,score:(u:Slotted)=>number,command:(type:string,detail:Record<string,unknown>,fn:()=>boolean)=>boolean,options:{protectedIds?:Set<number>;banned?:Set<string>}={}) {
 const signature=JSON.stringify(r.upgradeOffers??[]);if(inspected.get(r)!==signature){inspected.set(r,signature);command('upgradeInspect',{offers:(r.upgradeOffers??[]).map(g=>({...g,choices:[...g.choices]}))},()=>true);}
 const all=Array.from({length:8},(_,i)=>({i,u:getOwned(r,i)})).filter((x):x is {i:number;u:Slotted}=>!!x.u);
 const weak=all.filter(x=>!options.protectedIds?.has(x.u.ownedId)&&canSell(r,x.i)).sort((a,b)=>score(a.u)-score(b.u))[0];
 const candidates=(r.upgradeOffers??[]).flatMap(group=>group.choices.flatMap((id,choiceIdx)=>{
  if(options.banned?.has(id))return[];const duplicate=all.find(x=>x.u.defId===id&&x.u.copies===1);const fresh:Slotted={defId:id,ownedId:-1,copies:1};const value=score(duplicate?.u??fresh)+(duplicate?10:0);const useful=!!duplicate||all.length<5||!!weak&&value>score(weak.u)+4;
  const destination=duplicate?.i??Array.from({length:8},(_,i)=>i).find(i=>!getOwned(r,i))??weak?.i;
  return useful&&destination!==undefined?[{group,id,choiceIdx,destination,value,replace:!duplicate&&!!getOwned(r,destination)}]:[];
 })).sort((a,b)=>b.value-a.value);
 for(const group of r.upgradeOffers??[]){const wanted=candidates.some(x=>x.group.id===group.id);const keep=wanted&&r.gold<3;if(group.locked!==keep)command('upgradeLock',{groupId:group.id,locked:keep,choices:[...group.choices],tier:group.tier},()=>freezeUpgradeOffer(r,group.id));}
 const best=candidates[0];if(!best||r.gold<3)return false;
 if(best.replace){const victim=getOwned(r,best.destination)!;if(!command('sell',{slot:best.destination,id:victim.defId,price:sellPrice(victim,r),reason:'visible upgrade reward improvement'},()=>sell(r,best.destination)))return false;}
 return command('upgradeBuy',{groupId:best.group.id,choiceIdx:best.choiceIdx,id:best.id,slot:best.destination,choices:[...best.group.choices],tier:best.group.tier,price:3},()=>!['invalid','confirm'].includes(takeUpgradeOffer(r,best.group.id,best.choiceIdx,best.destination)));
}

export function visibleBlocks(u:Slotted,r?:RunState){let n=u.train?.block??0;const field=r?.slots.filter((x):x is Slotted=>!!x)??[u];for(const src of field){const level=levelFromCopies(src.copies)-1;for(const fx of [...(unitDef(src.defId).onStart??[]),...(src.equips??[]).flatMap(id=>EQUIP_MAP[id]?.onStart??[])])if(fx.op==='block'){const at=field.indexOf(src),to=field.indexOf(u);const targets=fx.to==='self'?src===u:fx.to==='allies'?true:fx.to==='others'?src!==u:fx.to==='front'?to===0:fx.to==='rear'?to===field.length-1:fx.to==='highestHp'?u===[...field].sort((a,b)=>preparationStat(b,'hp')-preparationStat(a,'hp'))[0]:fx.to==='adjacent'?Math.abs(at-to)===1:false;if(targets)n+=fx.v?.[level]??0;}}return n;}

