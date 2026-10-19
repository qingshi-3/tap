import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,act,tick,derived,validateState} from '../js/core.js';
import {INGREDIENTS,RECIPES,UPGRADES,REGIONS,STAFF,EVENTS,CONTRACTS} from '../js/content.js';
import {loadGame,saveGame,SAVE_KEY} from '../js/persistence.js';
const checked=s=>{const x=JSON.parse(JSON.stringify(s)),v=validateState(x);assert.equal(v.ok,true,v.message);return x;};
const action=(s,a)=>{const result=act(s,a);assert.equal(result.ok,true,`${JSON.stringify(a)}: ${result.message}`);return result;};
const menu=(s,ids)=>{for(const id of [...s.menu])action(s,{type:'menu',id});for(const id of ids)action(s,{type:'menu',id});};
const day=s=>{action(s,{type:'start'});tick(s,120);assert.equal(s.phase,'summary');return s;};
const claimAll=s=>{for(const m of derived(s).milestones)if(m.complete&&!m.claimed)action(s,{type:'claim',id:m.id});};
function stock(s,requirements){for(const [id,target] of Object.entries(requirements)){const quantity=Math.max(0,target-s.inventory[id]);if(quantity&&s.coins>=Math.ceil(derived(s).purchasePrices[id]*quantity))action(s,{type:'buy',id,quantity});}}
function simulate(route,seed=12345,days=35){
 let s=createGame(seed);const evidence={researchDay:null,regionDay:null,events:[],revenues:[],day28:null,menus:new Set(),investments:[],contracts:0,festivalResults:[],daily:[]};
 for(let n=0;n<days;n++){
  claimAll(s);
  const expansion=route==='supply'?'takeaway':'salon';if(s.day>=8&&!derived(s).expansions.find(x=>x.id===expansion).owned&&s.coins>850)action(s,{type:'buyExpansion',id:expansion});
  action(s,{type:'price',mode:['value','normal','premium'][(s.day-1)%3]});
  if(derived(s).serviceOrder?.canClaim)action(s,{type:'claimServiceOrder'});
  if(!derived(s).serviceOrder){const offer=derived(s).serviceOffers.find(x=>x.canAccept&&x.id==='threeDays')||derived(s).serviceOffers.find(x=>x.canAccept);if(offer)action(s,{type:'acceptServiceOrder',id:offer.id});}
  for(const r of REGIONS.slice(1))if(!s.regions.includes(r.id)&&derived(s).regions.find(x=>x.id===r.id).canUnlock&&s.coins>r.cost+50){action(s,{type:'unlockRegion',id:r.id});evidence.regionDay??=s.day;}
  const e=derived(s).event,choice=(s.day+ (route==='supply'?1:0))%2;if(e.choices[choice].canChoose){action(s,{type:'event',choice});evidence.events.push(`${e.id}:${choice}`);}
  const priority=route==='supply'?['garden','decor','tables','kitchen','sign']:['kitchen','tables','sign','decor','garden'];
  if(s.day>3)for(const id of priority){const u=UPGRADES.find(u=>u.id===id),cost=u.cost[s.upgrades[id]];if(cost&&s.coins>cost+160){action(s,{type:'upgrade',id});evidence.investments.push(id);break;}}
  const worker=route==='supply'?'oak':'moss';if(s.day>=4&&!s.staff.includes(worker)&&s.coins>STAFF.find(p=>p.id===worker).cost+100)action(s,{type:'hire',id:worker});
  if(!s.contract&&s.contractOffer&&s.day%3===1)action(s,{type:'acceptContract'});
  const targetContract=s.contract?CONTRACTS.find(c=>c.id===s.contract.id):null;
  // Spend each expedition where its materials remove the largest current shortage.
  while(s.gatherActions){const target=Object.fromEntries(INGREDIENTS.map(i=>[i.id,10+(targetContract?.ingredients[i.id]||0)]));const options=derived(s).regions.filter(r=>r.unlocked);options.sort((a,b)=>Object.entries(b.yields).reduce((n,[id,q])=>n+Math.min(q,Math.max(0,target[id]-s.inventory[id])),0)-Object.entries(a.yields).reduce((n,[id,q])=>n+Math.min(q,Math.max(0,target[id]-s.inventory[id])),0));action(s,{type:'gather',id:options[0].id});}
  for(const r of derived(s).researchableRecipes)if(r.canResearch&&s.coins>r.researchCost+70){action(s,{type:'research',id:r.id});evidence.researchDay??=s.day;break;}
  if(targetContract){if(derived(s).contract.canDeliver){action(s,{type:'deliverContract'});evidence.contracts++;}else if(s.day===s.contract.dueDay&&s.coins>180){stock(s,targetContract.ingredients);if(derived(s).contract.canDeliver){action(s,{type:'deliverContract'});evidence.contracts++;}}}
  const d=derived(s),tag=d.festival?.tag||d.demand.tag;let choices=d.availableRecipes.filter(r=>r.tag===tag).sort((a,b)=>b.price-a.price);
  if(d.festival?.day===21)choices=choices.slice(0,2);else choices=choices.slice(0,3);
  if(!choices.length)choices=[RECIPES[0]];
  menu(s,choices.map(r=>r.id));evidence.menus.add(s.menu.join(','));
  const needs={};for(const r of choices)for(const [id,q] of Object.entries(r.ingredients))needs[id]=(needs[id]||0)+q*Math.ceil(16/choices.length);stock(s,needs);
  if(!derived(s).canStart){menu(s,['soup']);stock(s,{mushroom:2});}
  action(s,{type:'start'});tick(s,30);s=checked(s);tick(s,90);assert.ok(s.coins>=0);assert.ok(s.summary.served>0,`no meals day ${s.day}`);evidence.revenues.push(s.summary.revenue);evidence.daily.push({day:s.day,coins:s.coins,profit:s.summary.profit,served:s.summary.served,inventory:{...s.inventory},menu:[...s.menu],festival:s.summary.festival,commission:derived(s).serviceOrder});if(s.day===28)evidence.day28={coins:s.coins,upgrades:{...s.upgrades},research:s.researched.length};if(s.summary.festival)evidence.festivalResults.push({day:s.day,...s.summary.festival});s=checked(s);if(n<days-1)action(s,{type:'next'});
 }
 return {s,evidence};
}
test('two distinct investment routes remain solvent through full seasons and freeplay',()=>{
 const food=simulate('kitchen',12345),supply=simulate('supply',777);
 for(const {s,evidence:e} of [food,supply]){assert.ok(e.researchDay<=3);assert.ok(e.regionDay<=3);assert.ok(s.researched.length>=10);assert.equal(s.regions.length,3);assert.ok(e.menus.size>=8);assert.ok(s.completedContracts.length>=5);assert.ok(s.totals.served>300);assert.ok(s.coins>300);assert.equal(s.day,35);assert.ok(s.ending);assert.ok(e.festivalResults.length>=5);assert.ok(e.events.length>20);assert.ok(Object.values(s.mastery).some(n=>n>=24));}
 assert.ok(food.s.staff.includes('moss'));assert.ok(supply.s.staff.includes('oak'));assert.equal(food.evidence.investments[0],'kitchen');assert.equal(supply.evidence.investments[0],'garden');assert.notDeepEqual(food.evidence.revenues,supply.evidence.revenues);
 console.log(JSON.stringify([food,supply].map(({s,evidence:e})=>({coins:s.coins,served:s.totals.served,research:s.researched.length,contracts:s.completedContracts.length,day28:e.day28,firstResearch:e.researchDay,firstRegion:e.regionDay,expansion:s.operations.expansion,commissions:s.operations.completedServices.length,...(process.env.ECONOMY_EVIDENCE?{daily:e.daily}:{}),festivals:e.festivalResults.map(f=>[f.day,f.won,f.current,f.target])}))));
});
test('regional gathering has finite actions, weather yields and zero-coin recovery',()=>{const s=createGame();for(const i of INGREDIENTS)s.inventory[i.id]=0;s.coins=0;const before=s.inventory.fish;for(let i=0;i<4;i++)action(s,{type:'gather'});assert.equal(s.inventory.fish,before);assert.equal(s.inventory.mushroom,12);assert.equal(act(s,{type:'gather'}).ok,false);menu(s,['soup']);day(s);assert.ok(s.summary.served>0);assert.ok(s.coins>0);action(s,{type:'next'});assert.equal(s.gatherActions,4);checked(s);});
test('research requires stage, reputation and materials and never double-charges',()=>{let s=createGame();for(const change of [()=>{},()=>s.day=3]){change();if(s.day===3)s.totals.days=2;const before=JSON.stringify(s);assert.equal(act(s,{type:'research',id:'fishrice'}).ok,s.day===3);if(s.day===1)assert.equal(JSON.stringify(s),before);}
 const balance=s.coins,items=structuredClone(s.inventory);assert.equal(act(s,{type:'research',id:'fishrice'}).ok,false);assert.equal(s.coins,balance);assert.deepEqual(s.inventory,items);assert.ok(s.researched.includes('fishrice'));assert.equal(act(s,{type:'research',id:'nonsense'}).ok,false);
 s=createGame();s.day=5;s.totals.days=4;s.event={id:EVENTS[4].id,choice:null};s.contractOffer={id:CONTRACTS[1].id,offerDay:4};s.inventory.flour=0;s.reputation=100;const copy=JSON.stringify(s);assert.equal(act(s,{type:'research',id:'bread'}).ok,false);assert.equal(JSON.stringify(s),copy);
});
test('daily branches have different prices, traffic and ingredient costs, applied once',()=>{let a=createGame(),b=createGame();action(a,{type:'event',choice:0});action(b,{type:'event',choice:1});assert.equal(a.coins,142);assert.equal(b.coins,184);assert.equal(b.inventory.rice,4);for(const s of [a,b]){const before=JSON.stringify(s);assert.equal(act(s,{type:'event',choice:0}).ok,false);assert.equal(JSON.stringify(s),before);for(let n=0;n<4;n++)action(s,{type:'gather'});menu(s,['soup']);s.inventory.mushroom=100;}day(a);day(b);assert.ok(a.service.spawned>b.service.spawned);
 a=createGame();a.day=5;a.totals.days=4;a.event={id:'critic',choice:null};const normal=derived(a).prices.soup;action(a,{type:'event',choice:1});assert.ok(derived(a).prices.soup<normal);
});
test('orders compete with menu inventory, pay once, expire without penalties and refresh',()=>{const s=createGame();action(s,{type:'acceptContract'});assert.equal(s.contract.dueDay,3);s.inventory.mushroom=12;s.inventory.herb=6;const before=derived(s).servings.soup;action(s,{type:'deliverContract'});assert.ok(derived(s).servings.soup<before);const coins=s.coins;assert.equal(act(s,{type:'deliverContract'}).ok,false);assert.equal(act(s,{type:'acceptContract'}).ok,false);assert.equal(s.coins,coins);assert.equal(s.completedContracts.length,1);
 while(s.day<4){if(!derived(s).canStart){action(s,{type:'gather'});menu(s,['soup']);}day(s);action(s,{type:'next'});}assert.equal(s.contractOffer.id,'tea');action(s,{type:'acceptContract'});const due=s.contract.dueDay;while(s.day<=due){while(s.gatherActions)action(s,{type:'gather'});menu(s,['soup']);day(s);const balance=s.coins;action(s,{type:'next'});assert.equal(s.coins,balance);}assert.equal(s.contract,null);assert.equal(s.expiredContracts.length,1);assert.equal(act(s,{type:'deliverContract'}).ok,false);checked(s);
});
test('staff specialties change cooking, buying, gathering and tips',()=>{const base=createGame(),buyer=createGame();buyer.staff.push('oak');const c1=base.coins,c2=buyer.coins;action(base,{type:'buy',id:'fish',quantity:10});action(buyer,{type:'buy',id:'fish',quantity:10});assert.ok(c1-base.coins>c2-buyer.coins);action(base,{type:'gather'});action(buyer,{type:'gather'});assert.equal(buyer.inventory.mushroom,base.inventory.mushroom+1);
 const chef=createGame(),plain=createGame();chef.staff.push('moss');for(const s of [chef,plain]){action(s,{type:'start'});tick(s,4.3);const g=s.guests.find(g=>g.status==='waiting');assert.ok(g);action(s,{type:'serve',id:g.id});}assert.ok(chef.guests[0].timer<plain.guests[0].timer);
 const tipped=createGame(),normal=createGame();tipped.staff.push('luna');for(const s of [tipped,normal]){s.staff=s.staff.filter(id=>id!=='pip');action(s,{type:'start'});tick(s,4.3);action(s,{type:'serve',id:s.guests[0].id});tick(s,5);}assert.equal(tipped.service.tips-normal.service.tips,3);
});
test('season, weather, mastery and preferred guests change real selling prices',()=>{const s=createGame(),spring=derived(s).prices.soup;for(let i=0;i<4;i++)action(s,{type:'gather'});menu(s,['soup']);day(s);assert.ok(s.mastery.soup>=8);action(s,{type:'next'});assert.ok(derived(s).prices.soup>spring);const before=derived(s).prices.fishrice;s.day=10;s.totals.days=9;assert.ok(derived(s).prices.fishrice>before);s.day=12;assert.equal(derived(s).weather,'细雨');const rain=derived(s).prices.ricebowl;s.day=11;assert.ok(rain>derived(s).prices.ricebowl);
});
test('failed festival has no award, no false champion and returns next annual cycle',()=>{let s=createGame();s.staff=[];for(let i=0;i<35;i++){while(s.gatherActions)action(s,{type:'gather'});menu(s,['soup']);day(s);if(s.summary.festival)assert.equal(s.summary.festival.won,false);s=checked(s);if(i<34)action(s,{type:'next'});}assert.equal(s.festivalWins,0);assert.equal(s.ending.title,'不熄的小馆');assert.equal(s.festivalRecords['7'].attempts,2);assert.equal(s.festivalRecords['7'].wins,0);const coins=s.coins,totals=structuredClone(s.totals);tick(s,120);assert.equal(s.coins,coins);assert.deepEqual(s.totals,totals);
});
test('bad states and illegal transactions are rejected, originals unmodified',()=>{const s=createGame();for(const a of [{type:'buy',id:'fish',quantity:-2},{type:'buy',id:'fake',quantity:1},{type:'buy',id:'rice',quantity:Infinity},{type:'unlockRegion',id:'mountain'},{type:'research',id:'lantern'},{type:'event',choice:4}]){const before=JSON.stringify(s);assert.equal(act(s,a).ok,false);assert.equal(JSON.stringify(s),before);}for(const mutate of [x=>x.schema=2,x=>x.coins=NaN,x=>x.inventory.mushroom=-1,x=>x.menu=['unknown'],x=>x.regions=['unknown'],x=>x.researched=['unknown'],x=>x.mastery.soup=NaN,x=>x.gatherActions=8,x=>x.event.id='fake',x=>x.contractOffer.id='fake',x=>x.contract={id:'picnic',acceptedDay:1,dueDay:999},x=>x.completedContracts=['1:fake'],x=>x.festivalRecords={'8':{attempts:1,wins:1,lastDay:8}},x=>x.upgrades.tables=99,x=>x.settings.sound='yes',x=>x.service.staffClocks.fake=2,x=>x.service.spawned=.5,x=>x.totals.days=5]){const bad=structuredClone(s);mutate(bad);assert.equal(validateState(bad).ok,false,JSON.stringify(bad));}assert.equal(validateState(null).ok,false);});

test('exhausted expeditions and inventory have an explicit once-daily emergency recovery',()=>{const s=createGame();for(const i of INGREDIENTS)s.inventory[i.id]=0;s.coins=0;s.gatherActions=0;s.gathered=true;s.menu=[];assert.equal(derived(s).reliefAvailable,true);action(s,{type:'relief'});assert.equal(s.inventory.mushroom,4);assert.equal(act(s,{type:'relief'}).ok,false);assert.equal(derived(s).canStart,true);day(s);assert.ok(s.summary.served>=1);action(s,{type:'next'});assert.equal(s.reliefUsed,false);checked(s);});

test('service milestones include meals and revenue already earned, remain claimable once through reload and settlement',()=>{
 const memory=new Map(),previousStorage=globalThis.localStorage;
 globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 try{
  loadGame();let s=createGame();s.totals.revenue=490;
  const milestone=id=>derived(s).milestones.find(m=>m.id===id);
  assert.equal(act(s,{type:'claim',id:'first'}).ok,false);
  action(s,{type:'start'});
  for(let i=0;i<300&&s.service.served===0;i++)tick(s,.1);
  assert.equal(s.phase,'service');assert.ok(s.service.served>0);
  assert.equal(milestone('first').current,s.service.served);
  assert.equal(milestone('revenue500').current,490+s.service.revenue+s.service.tips);
  assert.equal(milestone('first').complete,true);assert.equal(milestone('revenue500').complete,true);
  assert.equal(derived(s).goal.title,'第一碗热汤');assert.ok(derived(s).goal.current>=1);
  const coins=s.coins;action(s,{type:'claim',id:'first'});action(s,{type:'claim',id:'revenue500'});assert.equal(s.coins,coins+100);
  for(const id of ['first','revenue500'])assert.equal(act(s,{type:'claim',id}).ok,false);
  assert.equal(saveGame(s).ok,true);assert.ok(memory.has(SAVE_KEY));s=loadGame().state;
  assert.equal(s.phase,'service');assert.equal(milestone('first').claimed,true);assert.equal(milestone('revenue500').claimed,true);
  tick(s,4);assert.equal(saveGame(s).ok,true);s=loadGame().state;tick(s,120);
  assert.equal(s.phase,'summary');assert.equal(s.totals.served,s.service.served);
  assert.equal(s.totals.revenue,490+s.service.revenue+s.service.tips);
  assert.equal(milestone('first').current,s.totals.served);assert.equal(milestone('revenue500').current,s.totals.revenue);
  for(const id of ['first','revenue500'])assert.equal(act(s,{type:'claim',id}).ok,false);
  assert.equal(saveGame(s).ok,true);s=loadGame().state;action(s,{type:'next'});action(s,{type:'gather'});action(s,{type:'start'});tick(s,4);assert.equal(saveGame(s).ok,true);checked(s);
 }finally{if(previousStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=previousStorage;}
});
