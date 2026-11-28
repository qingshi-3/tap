import {encounterScore as localMechanicsScore} from './encounter-policy-score.mjs';
// Strategic extension: actively approach one visible, live mechanism objective.
// Public board/config data only. No scripted victory, hidden draws or future rewards.
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const adjacent=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))<=1;
const sourcePriority=(kind,e)=>({bossGate:e.overload?0:16,iron:e.half?0:12,altar:11,power:9,spawn:7,cannon:6,medic:5,guard:4,anchor:4,shot:3,portal:8,gate:7,attackFlag:6,healFlag:5}[kind]??0);
export function encounterScore(s){
 let value=localMechanicsScore(s);const e=s.encounter;
 const queen=s.boss?.id==='frost-queen'?s.units.find(u=>u.owner===s.boss.owner&&u.cardId===s.players[s.boss.owner].generalId&&u.health>0):null;
 const queenShards=queen?s.units.filter(u=>u.cardId===9001&&u.health>0&&adjacent(u,queen)):[];
 if(queen){
  for(const mark of s.boss.marks??[]){const u=s.units.find(u=>u.owner===0&&u.health>0&&u.x===mark.x&&u.y===mark.y);if(u)value-=3*(u.cardId===s.players[0].generalId?13:7)+8;}
  if(queenShards.length>=3)value-=35;
  if(queenShards.length>=3)for(const shard of queenShards)value-=shard.health*6;
  for(const u of s.units.filter(u=>u.owner===0&&u.health>0))if(queenShards.some(shard=>adjacent(shard,u)))value-=u.cardId===s.players[0].generalId?6:2;
 }
 if(!e)return value;
 const army=s.units.filter(u=>u.owner===0&&u.health>0&&u.attack+(u.attackBuff??0)>0),g=army.find(u=>u.cardId===s.players[0].generalId);if(!army.length)return value;
 const targets=[];
 if(queenShards.length>=3)for(const shard of queenShards){const priority=13,nearest=Math.min(...army.map(u=>distance(u,shard)));targets.push({point:shard,unit:shard,portal:false,priority,nearest,rank:priority-nearest*.45});}
 for(let i=0;i<e.sources.length;i++){
  const q=e.sources[i],d=e.config.sources[i];if(q.closed||q.spent)continue;
  const unit=s.units.find(u=>u.unitId===q.unitId&&u.owner!==0&&u.health>0),portal=d.kind==='portal';if(!portal&&!unit)continue;
  const finite=Array.isArray(d.times)&&d.times.length>0||['medic','altar','portal'].includes(d.kind);
  if(finite&&q.remaining===0&&!e.events.some(ev=>ev.source===i))continue;
  const priority=sourcePriority(d.kind,e);if(!priority)continue;const point=unit??q;
  // Pick a single achievable front rather than dividing the army between gates.
  const nearest=Math.min(...army.map(u=>distance(u,point)));
  targets.push({point,unit,portal,priority,nearest,rank:priority-nearest*.45});
 }
 for(const corpse of e.corpses??[]){const nearest=Math.min(...army.map(u=>distance(u,corpse)));if(nearest<=4)targets.push({point:corpse,portal:true,priority:9,nearest,rank:9-nearest*.45});}
 for(const event of e.events??[])if(event.kind==='hunt')for(const point of event.cells??[]){const nearest=Math.min(...army.map(u=>distance(u,point)));targets.push({point,portal:true,priority:11,nearest,rank:11-nearest*.45});}
 targets.sort((a,b)=>b.rank-a.rank||a.nearest-b.nearest||a.point.y-b.point.y||a.point.x-b.point.x);
 const focus=targets[0];if(!focus)return value;
 const approaches=army.map(u=>{const c=s.battleCards?.[0]?.[u.cardId]??{},range=c.ranged||c.blast?(c.attackRange??Infinity):1,dx=Math.abs(u.x-focus.point.x),dy=Math.abs(u.y-focus.point.y),gap=focus.portal?distance(u,focus.point):Math.max(0,dx-range)+Math.max(0,dy-range);return{gap,u};}).sort((a,b)=>a.gap-b.gap||(b.u.attack+(b.u.attackBuff??0))-(a.u.attack+(a.u.attackBuff??0)));
 const nearest=approaches[0];
 // Retain the tactical evaluator's safety cost; low-health generals get no
 // additional advance reward unless no friendly soldier can do the job.
 const frontline=approaches.find(a=>a.u!==g)||nearest;
 value-=frontline.gap*focus.priority*.65;
 if(nearest.u!==g||!g||g.health>=10)value-=nearest.gap*focus.priority*.35;
 if(focus.unit)value-=focus.unit.health*focus.priority*.35;
 if(focus.portal&&army.some(u=>u.x===focus.point.x&&u.y===focus.point.y))value+=focus.priority*2;
 return value;
}
