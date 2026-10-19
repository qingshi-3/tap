// Calls production rules. The policy consumes public views/quotes, never hidden price/fake flags.
import * as G from '../js/game.js';
import { UPGRADES, ITEMS } from '../js/data.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const out = process.env.GROWTH_SIM_OUTPUT ? resolve(process.env.GROWTH_SIM_OUTPUT) : resolve(import.meta.dirname, '../../../output/miaomiao-pawnshop/growth-20261019/simulation');
await mkdir(out, { recursive: true });
const routes = {water:{machine:'purifier',raw:'water',product:'water'},fish:{machine:'tank',raw:'fry',product:'fish'}};
const clone = x => JSON.parse(JSON.stringify(x));
function seeded(seed) { let n=seed; return ()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296); }
function simulate({route,seed,retail=false,employee=true,market=true,late=false,newGame=false}) {
 const random=Math.random; Math.random=seeded(seed);
 const stats={commands:0,productionStarts:0,deliveries:0,retailIncome:0,retailCost:0,reportIncome:0,checks:0,skips:0,receptionActions:0,receptionVisitors:0,employeeStarts:0,lowestCash:Infinity};
 const trace=[],milestones={},rejections=[];
 try {
  G.newRun(); G.S.tutorial=true;
  if(!newGame){G.S.money=1000;G.S.day=6;}
  const startDay=G.S.day, cashStart=G.S.money;
  const track=()=>{stats.lowestCash=Math.min(stats.lowestCash,G.S.money);};
  const command=(action,args)=>{const r=G.businessCommand(action,args);if(r.ok){stats.commands++;track();}else rejections.push({day:G.S.day,action,args,reason:r.reason});return r;};
  const publicStock=()=>G.businessView().warehouse.items.concat(G.S.shelf).map(i=>({uid:i.uid,id:i.id,cost:i.cost,known:i.known===true,grade:i.gk?i.g:null}));
  for(let turn=0;turn<115;turn++) {
   G.startDay(); G.voidFakeCash(); G.expireOrders();
   let view=G.businessView();
   // Fulfil actual current demand first. No speculative sale price or random revenue is credited.
   const deliver=()=>{for(const c of G.businessView().contracts.filter(c=>c.status==='active'&&c.start<=G.S.day&&c.due>=G.S.day&&c.available>0)){
    const r=command('deliverContract',{id:c.id});if(r.ok){stats.deliveries++;milestones.firstDelivery??=G.S.day;}
   }};
   deliver();
   while(G.current()) {
    if(!retail&&employee&&G.canDelegateReception()){
     if(!G.S.business.employee.reception){G.S.business.employee.reception=true;stats.commands++;stats.receptionActions++;}
     const r=G.delegateReception();stats.receptionVisitors+=r.count;continue;
    }
    const c=G.current();
    if(retail&&c.kind==='buy') {
     const stock=G.S.shelf.filter(i=>!['water','fry','fish'].includes(i.id));
     const it=stock.find(i=>G.wants(c,i));
     if(it){G.buyerLooks(c,it);if(!c.caught&&c.bid>=it.cost){const price=c.bid;G.sellItem(c,price);stats.retailIncome+=price;stats.retailCost+=it.cost;stats.commands++;}else if(c.caught)G.removeItem(it);}
    } else if(retail&&c.kind==='sell') {
     const clue=G.observationClue(c);
     if(clue){c.obs||=[null,null,null];const observation=G.observe(c,clue.index);stats.checks++;if(observation.bad){const r=G.report(c);stats.reportIncome+=r.bounty||0;G.S.qi++;continue;}}
     // Only one publicly indicated inspection; counteroffers are public, no probing hidden bounds.
     const itemClue=G.itemClue(c); if(itemClue&&c.pat>1){G.checkSpot(c,itemClue.index);stats.checks++;}
     const estimate=G.estimate(c.item), reserve=G.rentInfo().amount+150;
     if(c.pat>0&&G.S.money-reserve>=c.ask&&G.S.shelf.length<G.S.shelfCap&&c.item.known&&!c.item.stolenKnown&&c.ask<=estimate.lo*.65){G.buyItem(c,c.ask);stats.commands++;}
    } else if(c.kind==='police') {const inspection=G.inspect();if(inspection.found.length){G.acceptFine(inspection);G.S.money=Math.max(0,G.S.money);}}
    stats.skips++; G.S.qi++; track();
   }
   deliver();
   if(G.rentToday()&&!G.S.rentDone&&!G.payRent()) return finish('rent-failed');
   G.startNight();
   if(retail){const idx=G.S.night.crates.findIndex((_,i)=>!G.S.night.opened.includes(i));if(idx>=0)G.openCrate(idx);}
   // Invest with an explicit working-cash reserve, not just enough cash for the purchase.
   for(const r of [route,...Object.keys(routes).filter(r=>r!==route)]){
    const cfg=routes[r];
    if(!G.S.owned[cfg.machine]){const u=UPGRADES.find(u=>u.id===cfg.machine);const earlyWater=newGame&&r==='water'&&G.S.day>=3&&G.S.day<=3;
     const reserve=earlyWater?24:G.rentInfo().amount+60;
     if(G.S.money>=u.cost+reserve){G.buyUpgrade(u);stats.commands++;milestones[cfg.machine]??=G.S.day;}}
   }
   view=G.businessView();
   for(const id of [route+'1','warehouse',route+'2',...(market?[route+'Logistics']:[])]){
    const i=view.investments.find(i=>i.id===id);const reserve=G.rentInfo().amount+(id.includes('Logistics')?520:270);
    if(i?.eligible&&G.S.money>=i.cost+reserve&&(id!=='warehouse'||view.routes[route].level>=1)){if(command('invest',{id}).ok)milestones[id]??=G.S.day;view=G.businessView();}
   }
   if(employee&&view.routes[route].level>=1){
    if(!view.employee.hired&&G.S.money>=400){command('hire',{});milestones.employee??=G.S.day;}
    else if(view.employee.hired&&view.employee.days<=1&&G.S.money>=90)command('renew',{});
   }
   view=G.businessView();
   for(const r of Object.keys(routes)){
    const trial=view.offers.find(o=>o.route===r&&o.kind==='trial');
    if(!view.routes[r].trial&&trial?.eligible)command('acceptContract',{route:r,kind:'trial'});
    const kind=r===route&&market&&view.routes[r].level===3?'harbor':'regular';
    const offer=view.offers.find(o=>o.route===r&&o.kind===kind);
    if(offer?.eligible&&!view.contracts.some(c=>c.route===r&&c.start===offer.start&&c.kind!=='trial'&&c.status!=='cancelled'))command('acceptContract',{route:r,kind});
   }
   view=G.businessView();
   // Demand minus inventory, underway production and inbound purchases determines procurement.
   for(const r of Object.keys(routes)){
    const supplier=view.suppliers.find(s=>s.route===r),cfg=routes[r];
    if(!supplier.unlocked||!G.S.owned[cfg.machine])continue;
    const demand=view.contracts.filter(c=>c.route===r&&c.status==='active'&&c.due>=supplier.arrivalDay).reduce((n,c)=>n+c.qty-c.delivered,0);
    const stocked=publicStock().filter(i=>i.id===cfg.raw||i.id===cfg.product).length;
    const producing=G.S.machines[cfg.machine]?.n||0;
    const inbound=view.purchases.filter(o=>o.route===r&&['ordered','blocked'].includes(o.status)).reduce((n,o)=>n+o.qty,0);
    const need=Math.max(0,demand-stocked-producing-inbound);
    const space=view.warehouse.capacity-view.warehouse.items.length-view.warehouse.reserved;
    const qty=Math.min(need,supplier.remaining,space,Math.floor(G.S.money/supplier.price));
    if(qty>0){command('purchase',{route:r,qty});view=G.businessView();}
   }
   const p=G.productionPlan('purifier');
   if(G.S.owned.purifier&&G.S.filter<6&&G.S.money>=30){G.buyUpgrade(UPGRADES.find(u=>u.id==='filter'));stats.commands++;}
   for(const r of Object.keys(routes)){
    const mid=routes[r].machine,plan=G.productionPlan(mid);if(!plan.ok)continue;
    if(late&&G.S.day%15===1)continue;
    if(employee&&r===route&&view.employee.hired){const existing=G.businessView().plans[0];if(existing?.machine!==mid||existing?.qty!==plan.outputCount)command('plan',{machine:mid,qty:plan.outputCount});}
    else if(G.runMachine(mid,{uids:plan.inputUids})){stats.productionStarts++;stats.commands++;}
   }
   if(G.canBuyout()){const r=command('buyout',{});if(r.ok){milestones.buyout=G.S.day;return finish('owned');}}
   track(); trace.push({day:G.S.day,cash:G.S.money,filter:G.S.filter,levels:clone(G.businessView().routes),warehouse:G.businessView().warehouse.items.length,commands:stats.commands,stats:clone(stats)});
   const before=G.S.business.plans?.[0];G.sleep();if(before?.status==='已开工')stats.employeeStarts++;
  }
  return finish('horizon');
  function finish(status){return{route,seed,retail,employee,market,late,newGame,status,startDay,cashStart,day:G.S.day,elapsed:G.S.day-startDay+1,cash:G.S.money,stats,milestones,trace,rejections,ledger:clone(G.businessView().ledger)};}
 } finally {Math.random=random;}
}
const configs=[];
for(const route of ['water','fish'])for(const seed of [11,29,47,83])for(const variant of [{},{employee:false},{late:true},{newGame:true,retail:true}]) configs.push({route,seed,...variant});
const results=configs.map(simulate);
await writeFile(resolve(out,'trajectories.json'),JSON.stringify(results,null,2));
const routineComparison=['water','fish'].map(route=>{
 const rows=[false,true].map(employee=>{const run=results.find(r=>r.route===route&&r.seed===11&&!r.late&&!r.newGame&&r.employee===employee);const a=run.trace.find(t=>t.day===40)?.stats,b=run.trace.find(t=>t.day===60)?.stats;
 return a&&b?{employee,manualGuestDecisions:b.skips-a.skips,manualProductionStarts:b.productionStarts-a.productionStarts}:{employee,unavailable:'Run completed before the fixed day 41–60 comparison window ended'};});
 if(rows.some(r=>r.unavailable))return {route,days:'41–60',rows,unavailable:true};
 const before=rows[0].manualGuestDecisions+rows[0].manualProductionStarts,after=rows[1].manualGuestDecisions+rows[1].manualProductionStarts;
 return {route,days:'41–60',rows,before,after,reduction:1-after/before};
});
await writeFile(resolve(out,'routine-comparison.json'),JSON.stringify({scope:'Same seed and same game-day window; counts manual guest decisions plus manual production starts, not all UI taps. Contracts/procurement/important decisions remain.',runs:routineComparison},null,2));
const summary=results.map(({trace,ledger,rejections,...r})=>({...r,rejectionCount:rejections.length}));
await writeFile(resolve(out,'summary.json'),JSON.stringify({limitations:['Script decisions call actual core; no human usability evidence','Random customer handling simplified; no advertising rewards','1000-coin scenarios start on day 6 without purchased production machines','Fresh scenarios use initial quotes only; their failure is not a human win-rate estimate'],runs:summary},null,2));
console.log(JSON.stringify(summary.map(r=>({route:r.route,seed:r.seed,employee:r.employee,late:r.late,newGame:r.newGame,status:r.status,elapsed:r.elapsed,cash:r.cash,milestones:r.milestones})),null,2));
