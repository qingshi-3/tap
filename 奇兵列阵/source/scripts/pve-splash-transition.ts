import {unitDef} from '../src/core/data';
import {EQUIP_MAP} from '../src/core/content';
import {preparationStat} from '../src/core/preparation';
import {allOwned,currentNode,type RunState} from '../src/core/run';
import {levelFromCopies,type Slotted} from '../src/core/types';
const targetArmor=(e:NonNullable<ReturnType<typeof currentNode>['lineup'][number]>)=>e.armor??unitDef(e.defId).traits?.armor?.[(e.level??1)-1]??0;
/** Bounded arithmetic on currently visible panels, never battle simulation or future supply. */
export function splashPanelEstimate(r:RunState,u:Slotted,refundedAtk=0){
 const d=unitDef(u.defId),level=levelFromCopies(u.copies)-1,enemy=currentNode(r).lineup.filter((e):e is NonNullable<typeof e>=>!!e);let armor=enemy[0]?targetArmor(enemy[0]):0;const rearArmor=enemy[1]?targetArmor(enemy[1]):0;let blocks=enemy[0]?.block??0,rearBlocks=enemy[1]?.block??0;
 const combo=!!d.traits?.combo||(u.equips??[]).some(id=>EQUIP_MAP[id]?.grants?.combo),hasSplash=!!d.traits?.splash||(u.equips??[]).some(id=>EQUIP_MAP[id]?.grants?.splash);let atk=preparationStat(u,'atk')+refundedAtk,primary=0,secondary=0,burnOneTick=0;
 const power=(d.traits?.power?.[level]??0)+(u.train?.power??0)+(u.growth?.power??0)+(u.equips??[]).reduce((n,id)=>n+(EQUIP_MAP[id]?.grants?.power??0),0);
 for(let action=1;action<=6;action++){
  const charged=!!d.traits?.charge&&action%d.traits.charge===0;
  if(charged&&d.chargeSkill){burnOneTick+=((d.chargeSkill.find(e=>e.op==='burn')?.v?.[level]??0)+Math.floor(power*.5))*enemy.length;continue;}
  const bonus=charged?(d.chargeAttack?.bonus?.[level]??0):0,base=atk*(charged?(d.chargeAttack?.mult??1):1)+bonus;
  for(let hit=0;hit<(combo?2:1);hit++){
   const attack=combo?Math.ceil(base/2):base;
   if(blocks>0)blocks--;else primary+=Math.max(1,attack-armor);
   if(hit===0&&enemy.length>1&&(hasSplash||charged&&d.chargeAttack?.splash)){
    if(rearBlocks>0)rearBlocks--;else secondary+=Math.max(1,Math.floor(base/2)-rearArmor);
    if(u.defId==='m_whelp')burnOneTick+=d.values?.[level]??0;
   }

  }
  if(u.defId==='n_breaker')armor=Math.max(0,armor-(level===0?1:level===1?2:3));
  if(u.defId==='m_rager')atk+=d.afterAttack?.find(e=>e.op==='buff')?.v?.[level]??0;
  if(u.defId==='m_titan')burnOneTick+=(d.values?.[level]??0)*(enemy.length>1?2:1);
 }
 // Burn is only one conservative tick per application, not assumed full lifetime or recursive bloodcaller value.

 return {horizonOwnRegularActions:6,primary,secondary,burnOneTick,total:primary+secondary+burnOneTick,attackWithRefund:preparationStat(u,'atk')+refundedAtk,enemyCount:enemy.length,visibleFrontArmor:enemy[0]?targetArmor(enemy[0]):0};
}
export function splashUpgradeCandidate(r:RunState,old:Slotted,threat:number){
 const current=splashPanelEstimate(r,old),hpFloor=Math.min(preparationStat(old,'hp'),Math.ceil(threat*1.5)+2);
 const candidates=allOwned(r).filter((u):u is Slotted=>!!u&&u!==old&&['m_rager','m_vindicator','m_titan','n_colossus'].includes(u.defId)&&unitDef(u.defId).tier>unitDef(old.defId).tier).map(u=>({u,estimate:splashPanelEstimate(r,u,old.train?.atk??0),projectedHp:preparationStat(u,'hp')+(old.train?.hp??0)*2})).filter(x=>x.projectedHp>=hpFloor&&x.estimate.total>current.total*1.15+3).sort((a,b)=>b.estimate.total-a.estimate.total);
 const best=candidates[0];return best?{...best,current,hpFloor,lostGrowth:old.growth??{},returnedTraining:old.train??{},returnedEquipment:old.equips??[],rule:'Owned higher tier only; >15%+3 six-action visible panel gain and refundable HP floor. Old growth stays only in old estimate; returned old equipment is not credited in candidate estimate.'}:undefined;
}
