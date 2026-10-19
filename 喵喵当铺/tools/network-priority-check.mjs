// Two actual continuations of one natural mature save, differing only in delivery priority.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import * as G from '../js/game.js';
import {normalizeRun,validateRun} from '../js/persistence.js';
const output=resolve(import.meta.dirname,'../../../output/miaomiao-pawnshop/expansion-20261019');
const raw=await readFile(resolve(output,'natural/mature.json'),'utf8');
const results=[];
for(const priority of ['harbor','boutique']){
 G.setState(normalizeRun(JSON.parse(raw)));
 let seed=81;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 assert(G.businessCommand('networkPolicy',{enabled:true,production:'balanced',quality:'standard',priority,reserve:300}).ok);
 let target=G.networkPreview().period.id;while(G.networkPreview(undefined,target).market.id!=='fish')target++;
 const predicted=G.networkPreview(G.S.business.network.policy,target);
 while(!G.businessView().network.last||G.businessView().network.last.period.id<target){
  if(G.S.phase==='day'){
   while(G.current()){
    if(G.canDelegateReception()){G.delegateReception();continue;}
    const c=G.current();if(c.kind==='police'){const r=G.inspect();if(r.found.length)G.acceptFine(r);else{G.S.st.clean++;G.addRep('law',1);}}
    if(c.who==='lady'&&c.story===G.S.story.lady)G.S.story.lady++;
    c.resolved=true;G.S.qi++;
   }G.startNight();
  }
  G.sleep();G.expireOrders();G.voidFakeCash();G.startDay();validateRun(G.S);G.setState(normalizeRun(JSON.parse(JSON.stringify(G.S))));
 }
 const actual=G.businessView().network.last;
 assert.equal(actual.profit,predicted.profit);assert.deepEqual(actual.stores,predicted.stores);
 results.push({priority,fromDay:JSON.parse(raw).day,settledDay:actual.settledDay,market:actual.market,production:actual.production,profit:actual.profit,stores:actual.stores.map(s=>({id:s.id,units:s.units,profit:s.profit})),goalQualified:actual.goalQualified,goalReason:actual.goalReason});
}
assert.equal(results[0].profit,results[1].profit,'same fish price redistributes store earnings rather than inventing extra income');
assert(results[0].stores.find(s=>s.id==='boutique').profit<0);
assert(results[1].stores.find(s=>s.id==='boutique').profit>0);
assert(!results[0].goalQualified&&results[1].goalQualified);
await writeFile(resolve(output,'simulation/delivery-priority.json'),JSON.stringify({scope:'Natural mature save, real day advancement and actual settlement; only priority differs. No money/day or completion injection.',results},null,2));
console.log(JSON.stringify(results));
