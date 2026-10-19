// Natural v1.3 continuation from the frozen real-play save; no asset/day injection.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const workspace=resolve(import.meta.dirname,'../../..');
const output=resolve(workspace,'output/miaomiao-pawnshop/expansion-20261019');
const G=await import(pathToFileURL(resolve(output,'baseline/js/game.js')));
const P=await import(pathToFileURL(resolve(output,'baseline/js/persistence.js')));
const raw=await readFile(resolve(import.meta.dirname,'fixtures/growth-v3/hands-on-day17.json'),'utf8');
const seed=11;let random=seed;Math.random=()=>((random=Math.imul(random,1664525)+1013904223>>>0)/4294967296);
G.setState(P.normalizeRun(JSON.parse(raw)));
const actions=[],days=[];let visitorDecisions=0,delegatedVisitors=0;
const command=(name,args)=>{const result=G.businessCommand(name,args);assert(result.ok,`${name}: ${result.reason}`);actions.push({day:G.S.day,name,args,cash:G.S.money});};
command('setOperations',{enabled:true,reserve:150,routes:{water:'regular',fish:'regular'}});
const declineVisitors=()=>{
 while(G.current()){
  if(G.canDelegateReception()){delegatedVisitors+=G.delegateReception().count;continue;}
  const c=G.current();visitorDecisions++;
  if(c.kind==='police'){
   const result=G.inspect();if(result.found.length)G.acceptFine(result);else {G.S.st.clean++;G.addRep('law',1);}
  }
  // UI's refusal/exit changes queue state. No guessed offer, bounty, ad, or retail income.
  if(c.who==='lady'&&c.story===G.S.story.lady)G.S.story.lady++;
  c.resolved=true;G.S.qi++;
 }
 if(G.rentToday()&&!G.S.rentDone&&!G.S.business.ownership.owned)assert(G.payRent());
 G.startNight();
};
await mkdir(resolve(output,'natural'),{recursive:true});
for(let i=0;i<200;i++){
 if(G.S.phase==='day')declineVisitors();
 if(G.S.money>=8400){
  await writeFile(resolve(output,'natural/pre-buyout.json'),JSON.stringify(G.S,null,2));
  command('buyout',{});break;
 }
 G.sleep();G.expireOrders();G.voidFakeCash();G.startDay();
 P.validateRun(G.S);G.setState(P.normalizeRun(JSON.parse(JSON.stringify(G.S))));
 days.push({day:G.S.day,cash:G.S.money,contractsCompleted:G.S.business.contracts.filter(c=>c.status==='completed').length,failures:G.S.business.contracts.filter(c=>c.status==='failed').length,visitorDecisions,delegatedVisitors});
}
assert(G.S.business.ownership.owned,'baseline must naturally buy its shop');
P.validateRun(G.S);
await writeFile(resolve(output,'natural/post-buyout.json'),JSON.stringify(G.S,null,2));
const report={origin:'Unmodified real day17 night save / 669 cash; v1.3.0 baseline modules',originSha256:createHash('sha256').update(raw).digest('hex'),seed,startDay:17,endDay:G.S.day,cashAfterBuyout:G.S.money,actions,visitorDecisions,delegatedVisitors,limitations:'Economic continuation: refusals modeled as queue exits, police actually resolved; no human duration or total UI-click estimate. No injected assets, dates or milestones. JSON save/reload validated daily.',days};
await writeFile(resolve(output,'natural/baseline-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({endDay:G.S.day,cash:G.S.money,visitorDecisions,delegatedVisitors}));
