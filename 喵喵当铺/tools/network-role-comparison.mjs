// Same owned-shop save and 80-day window; measure visitor decisions, not UI click totals.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const output=resolve(import.meta.dirname,'../../../output/miaomiao-pawnshop/expansion-20261019');
const G=await import(pathToFileURL(resolve(output,'baseline/js/game.js')));
const P=await import(pathToFileURL(resolve(output,'baseline/js/persistence.js')));
const raw=await readFile(resolve(output,'natural/post-buyout.json'),'utf8');
const runs=JSON.parse(await readFile(resolve(output,'simulation/summary.json'),'utf8')).runs;
const results=[];
for(const seed of [11,29]){
 let rng=seed;Math.random=()=>((rng=Math.imul(rng,1664525)+1013904223>>>0)/4294967296);
 G.setState(P.normalizeRun(JSON.parse(raw)));let decisions=0,delegated=0;const kinds={};
 for(let day=0;day<=80;day++){
  if(G.S.phase==='day'){
   while(G.current()){
    if(G.canDelegateReception()){delegated+=G.delegateReception().count;continue;}
    const c=G.current();decisions++;kinds[c.kind]=(kinds[c.kind]||0)+1;
    if(c.kind==='police'){const r=G.inspect();if(r.found.length)G.acceptFine(r);else{G.S.st.clean++;G.addRep('law',1);}}
    if(c.who==='lady'&&c.story===G.S.story.lady)G.S.story.lady++;
    c.resolved=true;G.S.qi++;
   }G.startNight();
  }
  if(day===80)break;
  G.sleep();G.expireOrders();G.voidFakeCash();G.startDay();P.validateRun(G.S);G.setState(P.normalizeRun(JSON.parse(JSON.stringify(G.S))));
 }
 const newer=runs.find(r=>r.id==='adaptive-harbor'&&r.seed===seed);
 assert.equal(G.S.day,newer.to.day);assert(newer.counts.visitorDecisions<decisions);
 results.push({seed,fromDay:78,toDay:G.S.day,v13:{visitorDecisions:decisions,delegatedVisitors:delegated,kinds,expansionDecisions:0},v14:{visitorDecisions:newer.counts.visitorDecisions,delegatedVisitors:newer.counts.delegatedVisitors,kinds:newer.visitors,buildDecisions:newer.counts.builds,policyChanges:newer.counts.policies,goalDay:newer.completedDay,atGoal:newer.countsAtGoal}});
}
await writeFile(resolve(output,'simulation/role-comparison.json'),JSON.stringify({scope:'Same natural owned-shop save, same seeds and 80 overnight advances. v1.3 stable managed single shop versus v1.4 paid central manager plus regional investment/public policy. No hidden pricing guesses or income from visitor refusal; not total clicks or enjoyment scores.',results},null,2));
console.log(JSON.stringify(results));
