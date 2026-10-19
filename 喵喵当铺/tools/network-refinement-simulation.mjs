// Same natural mature save, seeds and actual advance commands; no injected progression or funds.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as Current from '../js/game.js';
import * as Persistence from '../js/persistence.js';
const output=resolve(import.meta.dirname,'../../../output/miaomiao-pawnshop/refinement-20261019');
const Legacy=await import(pathToFileURL(resolve(output,'baseline/js/game.js')));
const LegacyPersistence=await import(pathToFileURL(resolve(output,'baseline/js/persistence.js')));
const raw=await readFile(resolve(output,'../expansion-20261019/natural/mature.json'),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x));
await mkdir(resolve(output,'simulation'),{recursive:true});
const results=[];
for(const seed of [11,29])for(const mode of ['v140','all','stock']){
 const G=mode==='v140'?Legacy:Current,P=mode==='v140'?LegacyPersistence:Persistence;
 let rng=seed;const originalRandom=Math.random;Math.random=()=>((rng=Math.imul(rng,1664525)+1013904223>>>0)/4294967296);
 G.setState(P.normalizeRun(JSON.parse(raw)));
 const fromDay=G.S.day,target=fromDay+80;
 const counts={advanceCalls:0,visitorDecisions:0,filteredOrders:0,emptyFences:0},visitors={},stops={},trail=[];
 assert(G.businessCommand('networkPolicy',{enabled:true,production:'balanced',quality:'mixed',priority:'boutique',reserve:300}).ok);
 if(mode!=='v140')assert(G.businessCommand('networkReception',{mode}).ok);
 try{
  for(let guard=0;G.S.day<target&&guard<500;guard++){
   const before={day:G.S.day,phase:G.S.phase,qi:G.S.qi};
   const result=G.advanceManaged();assert(result.ok,result.reason);counts.advanceCalls++;
   counts.filteredOrders+=result.filteredOrders||0;counts.emptyFences+=result.emptyFences||0;
   stops[result.stop]=(stops[result.stop]||0)+1;
   if(result.stop==='important'){
    const c=G.current();assert(c);counts.visitorDecisions++;visitors[c.kind]=(visitors[c.kind]||0)+1;
    if(c.kind==='police'){const check=G.inspect();if(check.found.length)G.acceptFine(check);else{G.S.st.clean++;G.addRep('law',1);}}
    if(c.who==='lady'&&c.story===G.S.story.lady)G.S.story.lady++;
    c.resolved=true;G.S.qi++;
   }else assert(['planning','period','goal','investment'].includes(result.stop),`Unexpected operational stop: ${result.reason}`);
   trail.push({from:before,to:{day:G.S.day,phase:G.S.phase,qi:G.S.qi,cash:G.S.money},...result});
   P.validateRun(G.S);G.setState(P.normalizeRun(clone(G.S)));
  }
  assert.equal(G.S.day,target);assert(G.S.business.network.completedDay);
  const report={seed,mode,fromDay,toDay:G.S.day,cash:G.S.money,completedDay:G.S.business.network.completedDay,counts,visitors,stops,
   contracts:clone(G.S.business.contracts),ledger:clone(G.S.business.ledger),goods:clone({shelf:G.S.shelf,hidden:G.S.hidden,warehouse:G.S.business.warehouse}),network:clone(G.S.business.network)};
  results.push(report);
  await writeFile(resolve(output,`simulation/${mode}-${seed}.json`),JSON.stringify({...report,trail},null,2));
 }finally{Math.random=originalRandom;}
}
for(const seed of [11,29]){
 const [old,all,stock]=results.filter(r=>r.seed===seed);
 for(const changed of [all,stock]){
  for(const key of ['cash','completedDay','contracts','ledger','goods'])assert.deepEqual(changed[key],old[key],`${seed}: ${key} changed by reception filtering`);
  const n=clone(changed.network);delete n.reception;assert.deepEqual(n,old.network,'Reception must not alter production, period profit or goal outcome');
 }
 assert(stock.counts.visitorDecisions<all.counts.visitorDecisions);
 assert(all.counts.visitorDecisions<=old.counts.visitorDecisions);
 assert.equal(stock.counts.filteredOrders,all.visitors.order-(stock.visitors.order||0));
}
const compact=results.map(({contracts,ledger,goods,network,...r})=>r);
await writeFile(resolve(output,'simulation/comparison.json'),JSON.stringify({scope:'Same natural day106 save, two seeds, 80 actual nights using advanceManaged. Baseline rejects optional visits explicitly; new opt-in stock mode only delegates insufficient-stock offers. Identical cash, goods, contracts, ledger, production and goal. Counts are engine decisions/advance commands, not total UI clicks or human enjoyment.',results:compact},null,2));
console.log(JSON.stringify(compact));
