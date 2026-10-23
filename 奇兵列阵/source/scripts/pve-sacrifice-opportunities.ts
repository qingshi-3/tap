import {unitDef} from '../src/core/data';
import {type BattleOutput,type Snap} from '../src/core/types';
/** Read recorded real events only; no candidate simulation or decisions. */
export function voidRoundOpportunities(out:BattleOutput){
 const log=out.log,seenRounds=new Set<number>(),assigned=new Set<number>();const rows:Record<string,unknown>[]=[];
 const eligible=(u:Snap[number])=>!!unitDef(u.defId).token||!!unitDef(u.defId).onRattle?.length||!!(unitDef(u.defId).traits?.reborn||u.grants.reborn)&&!u.revived;
 const body=(u:Snap[number]|undefined)=>u?{uid:u.uid,id:u.defId,slot:u.slot,atk:u.atk,maxHp:u.maxHp,eligible:eligible(u),rotates:!!(unitDef(u.defId).traits?.rotate||u.grants.rotate)}:null;
 const recordActual=(j:number,round:number|null)=>{const e=log[j].ev;if(e.t!=='sacrifice')return;const prior=j?log[j-1].snap:out.initial,src=prior.find(u=>u.uid===e.src);if(src?.side!==0||src.defId!=='a_void')return;assigned.add(j);rows.push({round,source:body(src),tail:body(prior.find(u=>u.uid===e.tgt)),status:'actual-sacrifice',eventIndex:j,ambiguous:false});};
 for(let i=0;i<log.length;i++){const e=log[i].ev;if(e.t!=='beat'||seenRounds.has(e.round??0))continue;const round=e.round??0;seenRounds.add(round);let previousBeat=i-1;while(previousBeat>=0&&log[previousBeat].ev.t!=='beat')previousBeat--;
  const actualSources=new Set<number>();for(let j=previousBeat+1;j<i;j++){const ev=log[j].ev;if(ev.t==='sacrifice'){const prior=j?log[j-1].snap:out.initial,src=prior.find(u=>u.uid===ev.src);if(src?.side===0&&src.defId==='a_void'){actualSources.add(src.uid);recordActual(j,round);}}}
  const standing=log[i].snap.filter(u=>u.side===0&&u.alive&&u.hp>0&&!u.reserve).sort((a,b)=>a.slot-b.slot),tail=standing.at(-1),ambiguous=standing.some(u=>unitDef(u.defId).special==='worm');
  for(const src of standing.filter(u=>u.defId==='a_void'&&!actualSources.has(u.uid)))rows.push({round,source:body(src),tail:body(tail),status:tail?.uid===src.uid?'only-core-at-tail':tail&&!eligible(tail)?'ineligible-tail':tail?'eligible-tail-no-trigger':'no-tail',eventIndex:i,ambiguous,note:'No void sacrifice before the recorded first beat of this real round; observed tail after round-start effects. Worm presence is explicitly ambiguous.'});
 }
 for(let j=0;j<log.length;j++)if(!assigned.has(j))recordActual(j,null);
 return rows;
}
