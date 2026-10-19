// Matched natural continuation, not a human click or win-rate estimate.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as Current from '../js/game.js';
import {UPGRADES} from '../js/data.js';
const root=resolve(import.meta.dirname,'../../..');
const out=resolve(root,'output/miaomiao-pawnshop/operations-20261019/simulation');
const before=resolve(root,'output/miaomiao-pawnshop/operations-20261019/baseline/js/game.js');
const Legacy=await import(pathToFileURL(before));
const legacyData=await import(pathToFileURL(resolve(before,'../data.js')));
const original=JSON.parse(await readFile(resolve(import.meta.dirname,'fixtures/growth-v3/hands-on-day17.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const period=day=>Math.floor((day-1)/5)+1;
const seeded=seed=>()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const configs={water:{machine:'purifier',raw:'water',product:'water'},fish:{machine:'tank',raw:'fry',product:'fish'}};
function execute(G,upgrades,automated,{reserve=80,seed=11}={}){
 const random=Math.random;Math.random=seeded(seed);G.setState(clone(original));
 const counts={configure:0,contracts:0,purchases:0,filters:0,wages:0,plans:0,starts:0,deliveries:0,visitorDecisions:0,rent:0};
 const trace=[],initialIds=new Set(G.S.business.contracts.map(c=>c.id));
 const command=(type,args,key)=>{const result=G.businessCommand(type,args);assert(result.ok,`${type}: ${result.reason}`);if(key)counts[key]++;return result;};
 const floor=()=>reserve+G.rentInfo().amount;
 const spendable=()=>Math.max(0,G.S.money-floor());
 const knownStock=()=>G.businessView().warehouse.items.concat(G.S.shelf).filter(i=>i.known&&!i.fake&&!i.stolen&&!G.businessView().reservations[i.uid]&&!G.S.win.includes(i.uid));
 const countFinished=route=>knownStock().filter(i=>route==='water'?i.id==='water'&&i.gk&&i.g===4:i.id==='fish').length;
 const countRaw=route=>knownStock().filter(i=>route==='water'?i.id==='water'&&i.gk&&i.g===2:i.id==='fry').length;
 const deliver=()=>{for(const c of G.businessView().contracts.filter(c=>c.status==='active'&&G.S.day>=c.start&&G.S.day<=c.due&&c.available>0)){
  const r=G.businessCommand('deliverContract',{id:c.id});if(r.ok)counts.deliveries++;
 }};
 const manual=()=>{
  deliver();
  let v=G.businessView();
  if(v.employee.hired&&v.employee.days<=1&&spendable()>=30)command('renew',{},'wages');
  // Same selected customers and end-of-period commitment policy as managed mode.
  if(G.S.day%5===0)for(const route of ['water','fish']){
   const offer=G.businessView().offers.find(o=>o.route===route&&o.kind==='regular');
   if(offer?.eligible)command('acceptContract',{route,kind:'regular'},'contracts');
  }
  // Fish's two-night recipe needs first-night material before water fills the warehouse.
  for(const route of ['fish','water']){
   v=G.businessView();const supplier=v.suppliers.find(s=>s.route===route),cfg=configs[route];
   const demand=v.contracts.filter(c=>c.route===route&&c.status==='active'&&c.due>=supplier.arrivalDay).reduce((n,c)=>n+c.qty-c.delivered,0);
   const inbound=v.purchases.filter(p=>p.route===route&&['ordered','blocked'].includes(p.status)).reduce((n,p)=>n+p.qty,0);
   const need=Math.max(0,demand-countFinished(route)-countRaw(route)-(G.S.machines[cfg.machine]?.n||0)-inbound);
   const qty=Math.min(need,supplier.remaining,v.warehouse.capacity-v.warehouse.items.length-v.warehouse.reserved,Math.floor(spendable()/supplier.price));
   if(qty>0&&supplier.batches<2)command('purchase',{route,qty},'purchases');
  }
  const waterDemand=G.businessView().contracts.filter(c=>c.route==='water'&&c.status==='active').reduce((n,c)=>n+c.qty-c.delivered,0);
  if(waterDemand>0&&G.S.filter<Math.min(G.machineCapacity('purifier'),countRaw('water'))&&spendable()>=30){assert(G.buyUpgrade(upgrades.find(u=>u.id==='filter')));counts.filters++;}
  for(const route of ['water','fish']){
   const mid=configs[route].machine,p=G.productionPlan(mid);if(!p.ok)continue;
   if(route==='water'&&G.S.business.employee.active&&G.S.business.employee.days>0){
    const old=G.businessView().plans[0];if(old?.machine!==mid||old.qty!==p.batches)command('plan',{machine:mid,qty:p.batches},'plans');
   }else if(G.runMachine(mid,{uids:p.inputUids}))counts.starts++;
  }
 };
 const visitors=()=>{
  while(G.current()){
   if(G.canDelegateReception()){G.delegateReception();continue;}
   // Economic comparison only: no retail, bounty, scavenging, advertisement or story income.
   counts.visitorDecisions++;G.current().resolved=true;G.S.qi++;
  }
  if(G.rentToday()&&!G.S.rentDone&&!G.S.business.ownership.owned){assert(G.payRent(),'rent funds');counts.rent++;}
  G.startNight();
 };
 try{
  if(automated)command('setOperations',{enabled:true,reserve,routes:{water:'regular',fish:'regular'}},'configure');
  for(let n=0;n<20;n++){
   if(!automated)manual();
   const beforeDay=G.S.day;G.sleep();assert.equal(G.S.day,beforeDay+1);
   G.expireOrders();G.voidFakeCash();G.startDay();
   if(!automated)deliver();
   const newContracts=G.S.business.contracts.filter(c=>!initialIds.has(c.id));
   trace.push({day:G.S.day,cash:G.S.money,filter:G.S.filter,warehouse:G.S.business.warehouse.length,manual:clone(counts),contracts:newContracts.map(c=>({id:c.id,route:c.route,start:c.start,qty:c.qty,delivered:c.delivered,status:c.status})),operations:automated?clone(G.businessView().operations):null});
   if(n<19)visitors();
  }
  const contracts=G.S.business.contracts.filter(c=>!initialIds.has(c.id));
  const routine=['contracts','purchases','filters','wages','plans','starts','deliveries'].reduce((n,k)=>n+counts[k],0);
  const inboundPaid=G.S.business.purchases.filter(p=>['ordered','blocked'].includes(p.status)).reduce((n,p)=>n+p.qty*p.price,0);
  return{mode:automated?'managed':'manual-maintenance',seed,reserve,from:{day:17,phase:'night',cash:669},to:{day:G.S.day,phase:G.S.phase,cash:G.S.money,inboundPaid,filter:G.S.filter,paidStaffDays:G.S.business.employee.days},manualActions:counts,routineActions:routine,completed:contracts.filter(c=>c.status==='completed').length,failed:contracts.filter(c=>c.status==='failed').length,contracts:contracts.map(c=>({id:c.id,route:c.route,start:c.start,qty:c.qty,delivered:c.delivered,status:c.status})),trace,endState:clone(G.S)};
 }finally{Math.random=random;}
}
await mkdir(out,{recursive:true});
const results=[];
for(const seed of [11,29])for(const automated of [false,true])results.push(execute(automated?Current:Legacy,automated?UPGRADES:legacyData.UPGRADES,automated,{seed}));
function marketBranch(kind){
 const random=Math.random;Math.random=seeded(73);const G=Current;
 G.setState(clone(results.find(r=>r.mode==='managed'&&r.seed===11).endState));
 const declineAndClose=()=>{while(G.current()){if(G.canDelegateReception())G.delegateReception();else{G.current().resolved=true;G.S.qi++;}}if(G.rentToday()&&!G.S.rentDone)assert(G.payRent());G.startNight();};
 try{
  declineAndClose();assert(G.businessCommand('invest',{id:'waterLogistics'}).ok);
  assert(G.businessCommand('setOperations',{enabled:true,reserve:80,routes:{water:kind,fish:'regular'}}).ok);
  while(G.S.day<46){G.sleep();G.expireOrders();G.voidFakeCash();G.startDay();if(G.S.day<46)declineAndClose();}
  const c=G.S.business.contracts.find(c=>c.route==='water'&&c.start===41);
  assert(c&&c.status==='completed',`${kind} must really deliver its selected contract`);
  const rows=G.S.business.ledger.filter(row=>row.type==='contract'&&row.detail===c.id);
  return{kind,fromDay:37,toDay:G.S.day,investment:600,contract:{kind:c.kind,start:c.start,due:c.due,qty:c.qty,delivered:c.delivered,windows:c.windows,price:c.price,fee:c.fee,status:c.status},cash:G.S.money,deliveryLedger:rows,limitations:'Policy branch starts from the naturally continued day37 save; logistics paid through actual command; no date/cash edits. All visitor handling remains simplified.'};
 }finally{Math.random=random;}
}
const marketChoices=['regular','harbor','boutique'].map(marketBranch);
await writeFile(resolve(out,'market-choices.json'),JSON.stringify(marketChoices,null,2));
await writeFile(resolve(out,'trajectories.json'),JSON.stringify(results,null,2));
const summary={scope:'Same frozen actual day17 night 669-cash save, 20 real overnight advances to day37 morning; no money/day edits. No extra investments. Ordinary visitors delegated, other visitors declined without income. Script commands are not UI clicks; important-visitor experience verified separately in browser.',results:results.map(({trace,endState,...r})=>r)};
await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
assert(results.filter(r=>r.mode==='managed').every(r=>r.failed===0),'Managed continuation must not silently miss accepted contracts');
assert(results.filter(r=>r.mode==='managed').every(r=>r.completed>=4),'Managed mode must complete repeated real contracts');
