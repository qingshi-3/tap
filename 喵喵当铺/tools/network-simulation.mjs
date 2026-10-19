// Public-information policies using actual commands and full natural days.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import * as G from '../js/game.js';
import {normalizeRun,validateRun} from '../js/persistence.js';
const output=resolve(import.meta.dirname,'../../../output/miaomiao-pawnshop/expansion-20261019');
const base=JSON.parse(await readFile(resolve(output,'natural/post-buyout.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const modes=[
 {id:'adaptive-harbor',adaptive:true,first:'harbor'},
 {id:'adaptive-boutique',adaptive:true,first:'boutique'},
 {id:'fixed-mixed',first:'harbor',production:'balanced',quality:'mixed',priority:'harbor'},
 {id:'fixed-premium',first:'boutique',production:'water',quality:'premium',priority:'boutique'},
 {id:'fixed-volume',first:'harbor',production:'fish',quality:'standard',priority:'harbor'},
];
const candidates=()=>['water','balanced','fish'].flatMap(production=>['standard','mixed','premium'].flatMap(quality=>['harbor','boutique'].map(priority=>({enabled:true,production,quality,priority,reserve:300}))));
const publicChoices=()=>candidates().map(policy=>({policy,plan:G.networkPreview(policy)}));
function choose(mode){
 if(!mode.adaptive)return {enabled:true,production:mode.production,quality:mode.quality,priority:mode.priority,reserve:300};
 // Favor each open store paying its own bills, then net receipts; the same figures appear in UI.
 const choices=publicChoices();
 choices.sort((a,b)=>b.plan.stores.filter(s=>s.profit>0).length-a.plan.stores.filter(s=>s.profit>0).length||b.plan.profit-a.plan.profit||a.plan.spending-b.plan.spending);
 return choices[0].policy;
}
await mkdir(resolve(output,'simulation'),{recursive:true});
const reports=[],choicesAtMaturity=[];
for(const mode of modes)for(const seed of [11,29]){
 let rng=seed;const originalRandom=Math.random;Math.random=()=>((rng=Math.imul(rng,1664525)+1013904223>>>0)/4294967296);
 G.setState(normalizeRun(clone(base)));
 const counts={builds:0,policies:0,visitorDecisions:0,delegatedVisitors:0,rent:0},visitors={},actions=[],cycles=[],days=[],milestones=[];
 const seen=new Set();let minimumCash=G.S.money,firstGoal=null,countsAtGoal=null,maturitySampled=false;
 const saveStage=async name=>{if(mode.id==='adaptive-harbor'&&seed===11)await writeFile(resolve(output,`natural/${name}.json`),JSON.stringify(G.S,null,2));};
 const cmd=(name,args)=>{const result=G.businessCommand(name,args);assert(result.ok,`${mode.id} ${name}: ${result.reason}`);actions.push({day:G.S.day,name,args:clone(args),cash:G.S.money});return result;};
 const snapshot=()=>{validateRun(G.S);G.setState(normalizeRun(clone(G.S)));};
 try{
  for(let i=0;i<=80;i++){
   if(G.S.phase==='day'){
    while(G.current()){
     if(G.canDelegateReception()){counts.delegatedVisitors+=G.delegateReception().count;continue;}
     const c=G.current();counts.visitorDecisions++;visitors[c.kind]=(visitors[c.kind]||0)+1;
     if(c.kind==='police'){const check=G.inspect();if(check.found.length)G.acceptFine(check);else{G.S.st.clean++;G.addRep('law',1);}}
     if(c.who==='lady'&&c.story===G.S.story.lady)G.S.story.lady++;
     c.resolved=true;G.S.qi++;
    }
    if(G.rentToday()&&!G.S.rentDone&&!G.S.business.ownership.owned){assert(G.payRent());counts.rent++;}
    G.startNight();
   }
   let n=G.businessView().network;
   const last=n.last;
   if(last&&!seen.has(last.period.id)){
    seen.add(last.period.id);cycles.push(clone(last));
    if(!milestones.some(m=>m.name==='first-period')){milestones.push({name:'first-period',day:G.S.day,cash:G.S.money});await saveStage('first-period');}
   }
   if(n.goal.completedDay&&!firstGoal){firstGoal=n.goal.completedDay;countsAtGoal=clone(counts);milestones.push({name:'goal',day:firstGoal,cash:G.S.money});await saveStage('goal');}
   if(i===80)break;
   const order=['workshop',mode.first,'capacity',mode.first==='harbor'?'boutique':'harbor'];
   const next=order.find(id=>!n.builds.find(b=>b.id===id)?.built);
   const build=n.builds.find(b=>b.id===next);
   if(build?.eligible){
    await saveStage(`before-${next}`);cmd('networkBuild',{id:next});counts.builds++;
    milestones.push({name:next,day:G.S.day,cash:G.S.money});await saveStage(`after-${next}`);n=G.businessView().network;
   }
   if(n.builds.find(b=>b.id==='workshop')?.built){
    const policy=choose(mode);
    if(JSON.stringify(policy)!==JSON.stringify(n.policy)){
     // Object key order is not a policy decision.
     if(Object.keys(policy).some(k=>policy[k]!==n.policy[k])){cmd('networkPolicy',policy);counts.policies++;}
    }
   }
   n=G.businessView().network;
   if(n.builds.filter(b=>['harbor','boutique','capacity'].includes(b.id)&&b.effective).length===3&&!maturitySampled){
    maturitySampled=true;await saveStage('mature');
    if(mode.id==='adaptive-harbor'&&seed===11){
     const nextId=n.preview.period.id;
     for(let offset=0;offset<4;offset++)choicesAtMaturity.push({period:nextId+offset,choices:candidates().map(policy=>{const p=G.networkPreview(policy,nextId+offset);return{policy,market:p.market,profit:p.profit,spending:p.spending,stores:p.stores.map(s=>({id:s.id,profit:s.profit,units:s.units,demand:s.demand}))};})});
    }
   }
   if(n.goal.streak===2&&!n.goal.completedDay)await saveStage('two-streak');
   if(n.current&&G.S.day===n.current.plan.period.end&&n.goal.streak===2&&!n.goal.completedDay)await saveStage('before-goal-settlement');
   days.push({day:G.S.day,cash:G.S.money,counts:clone(counts),goal:clone(n.goal),status:n.status,policy:clone(n.policy),currentPeriod:n.current?.plan.period.id||null});
   minimumCash=Math.min(minimumCash,G.S.money);
   G.sleep();G.expireOrders();G.voidFakeCash();G.startDay();minimumCash=Math.min(minimumCash,G.S.money);snapshot();
  }
  const state=G.S,n=G.businessView().network;
  const report={id:mode.id,seed,from:{day:base.day,cash:base.money},to:{day:state.day,cash:state.money},completedDay:firstGoal,countsAtGoal,minimumCash,counts,visitors,milestones,cycleCount:cycles.length,networkProfit:cycles.reduce((sum,c)=>sum+c.profit,0),failedContracts:state.business.contracts.filter(c=>c.due>=base.day&&c.status==='failed').length,finalGoal:n.goal,actions,cycles,days};
  if(mode.id==='fixed-volume'){
   if(seed===11)await writeFile(resolve(output,'natural/recovery-before.json'),JSON.stringify(G.S,null,2));
   const recoveryStart=G.S.day,previous=clone(n.goal);
   assert(G.businessCommand('networkPolicy',{enabled:true,production:'balanced',quality:'mixed',priority:'boutique',reserve:300}).ok);
   for(let retry=0;retry<25&&!G.businessView().network.goal.completedDay;retry++){
    if(G.S.phase==='day'){
     while(G.current()){
      if(G.canDelegateReception()){G.delegateReception();continue;}
      const c=G.current();if(c.kind==='police'){const check=G.inspect();if(check.found.length)G.acceptFine(check);else{G.S.st.clean++;G.addRep('law',1);}}
      if(c.who==='lady'&&c.story===G.S.story.lady)G.S.story.lady++;
      c.resolved=true;G.S.qi++;
     }G.startNight();
    }
    G.sleep();G.expireOrders();G.voidFakeCash();G.startDay();snapshot();
   }
   const fixed=G.businessView().network.goal;assert(fixed.completedDay,'Unsuitable mix must be recoverable by an explicit next-period policy change');
   report.recovery={fromDay:recoveryStart,previous,policyChanges:1,completedDay:fixed.completedDay,cash:G.S.money};
   if(seed===11)await writeFile(resolve(output,'natural/recovery-after.json'),JSON.stringify(G.S,null,2));
  }
  reports.push(report);
  await writeFile(resolve(output,`simulation/${mode.id}-${seed}.json`),JSON.stringify(report,null,2));
 }finally{Math.random=originalRandom;}
}
await writeFile(resolve(output,'simulation/strategy-options.json'),JSON.stringify(choicesAtMaturity,null,2));
await writeFile(resolve(output,'simulation/summary.json'),JSON.stringify({scope:'Same natural day78 post-buyout save, 2639 cash. 80 natural overnight advances each. No injected cash/day/levels. Public plan quotes only, no hidden bids or guesses. Visitor refusals modeled; police resolved. Commands are not total UI clicks or human enjoyment.',runs:reports.map(({actions,cycles,days,...r})=>r)},null,2));
console.log(JSON.stringify(reports.map(r=>({id:r.id,seed:r.seed,goal:r.completedDay,cash:r.to.cash,min:r.minimumCash,counts:r.counts,failed:r.failedContracts}))));
assert(reports.filter(r=>r.id.startsWith('adaptive')).every(r=>r.completedDay),'Adaptive routes must naturally reach the finite goal');
