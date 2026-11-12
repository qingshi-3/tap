const assert = {
  ok(value: unknown, message = 'expected truthy value') { if (!value) throw Error(message); },
  equal(actual: unknown, expected: unknown) { if (actual !== expected) throw Error(`expected ${String(expected)}, received ${String(actual)}`); },
  deepEqual(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('state differs'); },
};
import { ARCHETYPE_IDS, type ArchetypeId } from '../src/core/archetypes';
import { FOOD, EQUIPS, supportAvailable, equipOf } from '../src/core/data';
import { SUPPORT_FOODS } from '../src/core/supportCatalog';
import { newRun, activeCardPool, reroll, useFood, foodTargetOk, playerTeam, settleBattle, trialFight, endTurn, equipFromBag, unequip, openRelic, adRelic, relicPool, rollChest, save, load, SAVE_KEY, LEGACY_SAVE_KEY, saveStatus, discardBag, payBlood, sell, adRetry, supportTargetHint, resolveEvent, fireSmithOk, adUpgradeChest, chestCanUp, chestPick, orangeCapped, ORANGE_MAX, FOOD_SHOP_MAX, effectiveQuarry, simOpts, sharesFood, goodsUnavailableReason, buyGoods, type RunState, type Owned } from '../src/core/run';
const storage = new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,String(v)),removeItem:(k:string)=>storage.delete(k)},configurable:true});
let checks=0;
function test(name:string,run:()=>void){run();checks++;console.log(`PASS ${name}`);}
function fixture(a:ArchetypeId='supply') {for(let seed=1;seed<500;seed++){const r=newRun(seed);if(r.activeArchetypes.includes(a)){r.gold=200;r.tavern=6;r.act=2;return r;}}throw Error(a);}
function unit(r:RunState,a:ArchetypeId='supply'):Owned {const d=activeCardPool(r).find(c=>c.archetype===a)!;assert.ok(d);return {oid:r.nextId++,def:d.id,copies:1,atkBonus:0,hpBonus:0};}
function feed(r:RunState,id:string,slot=0){const sid=r.nextId++;r.shop.push({sid,kind:'food',def:id,locked:false,free:true});return useFood(r,sid,slot);}
for(const a of ARCHETYPE_IDS) test(`${a}: real support intake and filtered rewards`,()=>{
  const r=fixture(a);r.queue[0]=unit(r,a);
  const cards=activeCardPool(r).filter(c=>c.archetype===a);
  if(a==='charge')r.queue[0]!.def=cards.find(c=>c.rules?.some(rule=>rule.phase==='battle'&&rule.effect==='release'))!.id;
  if(a==='blood')r.queue[0]!.def=cards.find(c=>c.rules?.some(rule=>rule.phase==='battle'&&(rule.on==='hurt'||rule.when==='half')))!.id;
  if(a==='ember'){r.queue[1]=r.queue[0];r.queue[0]=unit(r,a);r.queue[0]!.def=cards.find(c=>c.rules?.some(rule=>rule.phase==='battle'&&rule.effect==='inherit'))!.id;}
  if(a==='nest')r.queue[1]={...unit(r,a),def:cards.find(c=>c.rules?.some(rule=>rule.phase==='battle'&&rule.effect==='summon'))!.id};
  if(a==='pair'||a==='formation')r.queue[1]={...unit(r,a),def:r.queue[0]!.def};
  for(let i=0;i<12;i++){assert.ok(reroll(r));for(const item of r.shop.filter(s=>s.kind==='food'))assert.ok(supportAvailable(FOOD[item.def],r.activeArchetypes));}
  assert.ok(feed(r,'f_travel_rusk').ok);
  const themed=SUPPORT_FOODS.filter(f=>f.archetypes?.includes(a));assert.ok(themed.length,`${a} food`);
  let themedUsed=0;
  for(const f of themed){const slot=a==='ember'?1:0;if(!foodTargetOk(r,f.id,r.queue[slot]))continue;const out=feed(r,f.id,slot);assert.ok(out.ok);themedUsed++;}assert.ok(themedUsed,`${a} actual themed intake`);
  for(let i=0;i<12;i++)for(const id of rollChest(r,'boss').items)assert.ok(supportAvailable(equipOf(id)!,r.activeArchetypes));
  r.relicDue=1;r.firstRelicPending=true;openRelic(r);assert.ok(r.relicPick?.opts.length);adRelic(r);for(const id of r.relicPick!.opts)assert.ok(relicPool(r).includes(id));
});
test('charge rejects unsupported recipient without spending, preserves release gear path',()=>{
  const r=fixture('charge');r.queue[0]=unit(r,'supply');
  const f=SUPPORT_FOODS.find(f=>f.resources?.charge)!;assert.ok(f);
  const sid=r.nextId++;r.shop.push({sid,kind:'food',def:f.id,locked:false,free:false});const before=JSON.stringify(r);assert.equal(useFood(r,sid,0).ok,false);assert.equal(JSON.stringify(r),before);
  const cannon=activeCardPool(r).find(c=>c.rules?.some(rule=>rule.phase==='battle'&&rule.effect==='release'))!;assert.ok(cannon);r.queue[0]!.def=cannon.id;
  assert.ok(useFood(r,sid,0).ok);assert.equal(playerTeam(r)[0].startCharge,f.resources!.charge);
});
test('preloaded resources and rules survive preview and clear after one settled battle',()=>{
  const r=fixture('rune');r.queue[0]=unit(r,'rune');
  const resource=SUPPORT_FOODS.find(f=>f.resources?.seal&&supportAvailable(f,r.activeArchetypes))!;assert.ok(feed(r,resource.id).ok);
  const ruleFood=SUPPORT_FOODS.find(f=>f.battleRules?.length&&supportAvailable(f,r.activeArchetypes))!;assert.ok(feed(r,ruleFood.id).ok);
  const before=JSON.stringify(r);trialFight(r);assert.equal(JSON.stringify(r),before);
  const out={result:'draw' as const,perm:{},settlementId:'support-once'};settleBattle(r,out);
  for(const o of r.queue)if(o){assert.equal(o.seal,undefined);assert.equal(o.startCharge,undefined);assert.equal(o.supportFoods,undefined);}
  const settled=JSON.stringify(r);settleBattle(r,out);assert.equal(JSON.stringify(r),settled);
});
test('equipment replacement and full inventory retain capacity',()=>{
  const r=fixture();r.queue[0]=unit(r);const items=EQUIPS.filter(e=>supportAvailable(e,r.activeArchetypes)&&!e.food).slice(0,4);assert.equal(items.length,4);
  r.bag=items.slice(0,3).map(e=>e.id);r.queue[0]!.ench=items[3].id;
  assert.ok(equipFromBag(r,0,0));assert.equal(r.bag.length,3);assert.ok(r.bag.includes(items[3].id));assert.equal(unequip(r,0),false);
  endTurn(r);const after=JSON.stringify(r);assert.equal(discardBag(r,0),0);endTurn(r);assert.equal(JSON.stringify(r),after);
});
test('v5 save validates resources, support identities and reward payloads while preserving v4',()=>{
  const r=newRun(17);storage.clear();storage.set(LEGACY_SAVE_KEY,'prior-progress');assert.equal(saveStatus(),'unsupported');save(r);assert.ok(load());assert.equal(storage.get(LEGACY_SAVE_KEY),'prior-progress');
  const corruptions=[(x:RunState)=>{x.bag=['invalid' as never];},(x:RunState)=>{x.relics=['invalid' as never];},(x:RunState)=>{const o=unit(x);o.startCharge=-1;x.queue[0]=o;},(x:RunState)=>{const o=unit(x);o.supportFoods=['f_bread'];x.queue[0]=o;},(x:RunState)=>{x.rewards=[{id:x.nextId++,source:'bad',card:{kind:'spell',oid:x.nextId++,def:'invalid',source:'bad',obtainedTurn:x.turn}}];}];
  for(const corrupt of corruptions){const x=structuredClone(r);corrupt(x);storage.set(SAVE_KEY,JSON.stringify(x));assert.equal(load(),null);}
});
test('same seed reproduces full shop, chest and relic choices',()=>{
  const a=fixture('blood'),b=structuredClone(a);for(const r of[a,b]){r.queue[0]=unit(r,'blood');reroll(r);r.chest=rollChest(r,'boss');r.relicDue=1;openRelic(r);}assert.deepEqual(a,b);
});
test('blood relic and food relic share stable turn counters',()=>{
  const r=fixture('blood');const d=activeCardPool(r).find(c=>c.rules?.some(rule=>rule.phase==='prep'&&rule.on==='bloodPay'))!;assert.ok(d);r.queue[0]=unit(r,'blood');r.queue[0]!.def=d.id;r.relics.push('r_blood_pact');
  assert.ok(payBlood(r,0).ok);assert.equal(r.queue[0]!.startBlock,1);if(payBlood(r,0).ok)assert.equal(r.queue[0]!.startBlock,1);
  r.relics.push('r_mess_bell');assert.ok(feed(r,'f_travel_rusk').ok);const first=r.queue[0]!.seal??0;assert.ok(feed(r,'f_travel_rusk').ok);assert.equal(r.queue[0]!.seal,first+2);
});
test('milk uses shelf payload and share relic includes new inheritable rations',()=>{
  const r=fixture('wheel');r.queue[0]=unit(r,'wheel');r.queue[1]=unit(r,'wheel');r.relics=['r_share'];
  const a=r.nextId++;r.shop.push({sid:a,kind:'food',def:'f_milk',locked:false,free:true,val:[2,3]});assert.ok(useFood(r,a,0).ok);assert.equal(r.queue[0]!.atkBonus,2);assert.equal(r.queue[1]!.hpBonus,3);
  const x=fixture('wheel');x.queue[0]=unit(x,'wheel');x.queue[1]=unit(x,'wheel');x.relics=['r_share'];assert.ok(feed(x,'f_travel_rusk').ok);assert.equal(x.queue[1]!.hpBonus,2);
});
test('trade support honors sale count and attributes equipment seal',()=>{
  const r=fixture('trade');r.queue[0]=unit(r,'trade');r.queue[0]!.ench='e_till_chain';r.relics=['r_tally_book'];
  for(let i=1;i<4;i++)r.queue[i]=unit(r,'supply');
  assert.ok(sell(r,1));assert.equal(r.queue[0]!.sealSources?.['equipment:e_till_chain'],2);assert.equal(r.tc.generatedRations,0);
  assert.ok(sell(r,2));assert.equal(r.queue[0]!.sealSources?.['equipment:e_till_chain'],4);assert.equal(r.tc.generatedRations,1);
  assert.ok(sell(r,3));assert.equal(r.queue[0]!.sealSources?.['equipment:e_till_chain'],4);assert.equal(r.tc.generatedRations,1);
});
test('corrupt retry snapshot leaves live state intact',()=>{
  const r=newRun(7);const snap=structuredClone(r);snap.queue[0]=unit(snap);snap.queue[0]!.seal=2;snap.queue[0]!.sealSources={'supply:invalid':2};const before=JSON.stringify(r);assert.equal(adRetry(r,snap),false);assert.equal(JSON.stringify(r),before);
  const valid=structuredClone(r);assert.equal(adRetry(r,valid),true);assert.equal(r.adRetry,1);
});
test('legacy granted basic abilities retain food and save behavior',()=>{
  const r=newRun(25);r.queue[0]=unit(r);r.queue[0]!.granted={id:'bone',duration:'permanent',value:2,source:'old-basic'};
  assert.ok(feed(r,'f_bread').ok);assert.equal(playerTeam(r)[0].granted?.id,'bone');save(r);assert.equal(load()?.queue[0]?.granted?.value,2);
});
test('retry shares complete load validation for counters, identities and reward payloads',()=>{
  const r=newRun(7);const mutations=[
    (x:RunState)=>{delete (x.tc as Partial<typeof x.tc>).ruleUses;},
    (x:RunState)=>{x.tc.ruleEvents={bad:-1};},
    (x:RunState)=>{x.queue[0]=unit(x);x.queue[1]={...x.queue[0]};},
    (x:RunState)=>{x.rewards=[{id:x.nextId++,source:'bad',card:{kind:'spell',oid:x.nextId++,def:'missing',source:'bad',obtainedTurn:1}}];},
  ];
  for(const mutate of mutations){const snap=structuredClone(r);mutate(snap);const before=JSON.stringify(r);assert.equal(adRetry(r,snap),false);assert.equal(JSON.stringify(r),before);}
});
test('sparse team uses battle order for pair and formation meals',()=>{
  const p=fixture('pair');p.queue[0]=unit(p,'pair');p.queue[3]={...unit(p,'pair'),def:p.queue[0]!.def};assert.equal(supportTargetHint(p,'f_twincake',p.queue[0]),null);assert.ok(feed(p,'f_twincake').ok);
  const f=fixture('formation');f.queue[0]=unit(f,'formation');f.queue[3]=unit(f,'formation');assert.equal(supportTargetHint(f,'f_line_broth',f.queue[0]),null);assert.ok(feed(f,'f_line_broth').ok);
});
test('nest feed distinguishes token generation from revival and rejects duplicate revive gear',()=>{
  const n=fixture('nest');n.queue[0]={...unit(n),def:'rw_common_veteran'};n.queue[3]={...unit(n),def:'rw_common_veteran',lamp:true};
  const sid=n.nextId++;n.shop.push({sid,kind:'food',def:'f_den_feed',locked:false,free:false});const before=JSON.stringify(n);assert.equal(useFood(n,sid,0).ok,false);assert.equal(JSON.stringify(n),before);
  n.queue[3]!.granted={id:'bone',duration:'permanent',value:2,source:'骨契'};assert.ok(useFood(n,sid,0).ok);
  const r=fixture();r.queue[0]=unit(r);r.queue[0]!.ench='shroom';const lamp=r.nextId++;r.shop.push({sid:lamp,kind:'food',def:'f_lamp',locked:false,free:false});const snapshot=JSON.stringify(r);assert.equal(useFood(r,lamp,0).ok,false);assert.equal(JSON.stringify(r),snapshot);
});
test('shared meal preserves one direct meal across chef and bell counters',()=>{
  const r=fixture();r.queue[0]={...unit(r),def:'rw_supply_feast'};r.queue[1]={...unit(r),def:'rw_supply_pup'};r.relics=['r_share','r_mess_bell'];assert.ok(feed(r,'f_travel_rusk').ok);assert.equal(r.tc.foods,1);assert.equal(r.tc.ruleEvents['global:relic:r_mess_bell:0'],1);endTurn(r);assert.equal(r.queue[0]!.seal,1);assert.equal(r.queue[1]!.seal,1);
});
test('advertised relic expansion and camp upgrade preserve state when no reward is available',()=>{
  const r=fixture();const pool=relicPool(r);r.relics=pool.slice(1);r.relicDue=1;openRelic(r);assert.equal(r.relicPick!.opts.length,1);const before=JSON.stringify(r);assert.equal(adRelic(r),false);assert.equal(JSON.stringify(r),before);
  const f=fixture('ember');f.hero='smith';f.queue[0]=unit(f,'ember');f.queue[0]!.ench='e_testament';f.oranges=EQUIPS.filter(e=>e.q===3&&supportAvailable(e,f.activeArchetypes)).slice(0,2).map(e=>e.id);f.event='fire';assert.equal(fireSmithOk(f.queue[0],f),false);const original=JSON.stringify(f);assert.equal(resolveEvent(f,3,0).ok,false);assert.equal(JSON.stringify(f),original);
});
test('advertised purple upgrades respect global orange cap and preserve rejected state',()=>{
  const r=newRun(3);r.oranges=['o_crown','o_storm'];r.adOrange=1;r.chest={items:['p_thorn'],src:'elite',ad:false};
  assert.equal(r.oranges.length,ORANGE_MAX);assert.equal(orangeCapped(r),true);assert.equal(chestCanUp(r),false);
  const before=JSON.stringify(r);assert.equal(adUpgradeChest(r),false);assert.equal(JSON.stringify(r),before);
  r.hero='smith';r.event='fire';r.queue[0]={...unit(r),ench:'p_thorn'};assert.equal(fireSmithOk(r.queue[0],r),false);
  const camp=JSON.stringify(r);assert.equal(resolveEvent(r,3,0).ok,false);assert.equal(JSON.stringify(r),camp);
  r.chest={items:['p_thorn','w_sword','w_mail'],src:'elite',ad:false};assert.equal(chestCanUp(r),true);assert.equal(adUpgradeChest(r),true);
  assert.equal(r.chest.items[0],'p_thorn');assert.ok(r.chest.items.every(id=>(equipOf(id)?.q??0)<3));assert.equal(r.adOrange,1);
});
test('advertised orange quota and camp upgrade keep separate counters under one global cap',()=>{
  const r=newRun(3);r.oranges=['o_crown'];r.adOrange=0;r.chest={items:['p_thorn'],src:'elite',ad:false};
  assert.equal(chestCanUp(r),true);assert.equal(adUpgradeChest(r),true);assert.equal(equipOf(r.chest.items[0])?.q,3);assert.equal(r.adOrange,1);
  chestPick(r,0);assert.equal(r.oranges.length,ORANGE_MAX);assert.equal(orangeCapped(r),true);
  const x=newRun(3);x.adOrange=ORANGE_MAX;x.chest={items:['p_thorn'],src:'elite',ad:false};assert.equal(orangeCapped(x),false);assert.equal(chestCanUp(x),false);
  const before=JSON.stringify(x);assert.equal(adUpgradeChest(x),false);assert.equal(JSON.stringify(x),before);
  x.hero='smith';x.event='fire';x.queue[0]={...unit(x),ench:'p_thorn'};assert.equal(fireSmithOk(x.queue[0],x),true);assert.equal(resolveEvent(x,3,0).ok,true);assert.equal(x.oranges.length,1);assert.equal(x.adOrange,ORANGE_MAX);
});
test('effective quarry follows the selected existing enemy and falls back without changing selection',()=>{
  const r=newRun(23);r.enemy.units=[{def:'t_wisp',lvl:1,atk:1,hp:10},{def:'t_bonelet',lvl:1,atk:1,hp:10}];
  r.quarry=1;assert.equal(effectiveQuarry(r),1);assert.equal(simOpts(r).quarry,1);
  r.quarry=4;const before=JSON.stringify(r);assert.equal(effectiveQuarry(r),0);assert.equal(simOpts(r).quarry,0);assert.equal(JSON.stringify(r),before);
  r.quarry=undefined;assert.equal(effectiveQuarry(r),0);r.enemy.units=[];assert.equal(effectiveQuarry(r),0);
});
test('travel rusk sharing query matches actual first-meal eligibility',()=>{
  const r=fixture('supply');r.queue[0]=unit(r);r.queue[1]=unit(r);assert.equal(sharesFood(r,'f_travel_rusk'),false);r.relics=['r_share'];
  const before=JSON.stringify(r);assert.equal(sharesFood(r,'f_travel_rusk'),true);assert.equal(sharesFood(r,'f_sigil_ink'),false);assert.equal(sharesFood(r,'missing'),false);assert.equal(JSON.stringify(r),before);
  assert.ok(feed(r,'f_travel_rusk').ok);assert.equal(r.queue[1]!.hpBonus,2);assert.equal(sharesFood(r,'f_travel_rusk'),false);assert.equal(r.tc.foods,1);
});
test('merchant availability covers full shelf, missing spell recipient and successful purchase',()=>{
  const r=fixture();r.queue.fill(null);r.hand.fill(null);r.shop=[];r.merchant=[{kind:'spell',id:'x_bonepact',price:2}];
  for(let i=0;i<FOOD_SHOP_MAX;i++)r.shop.push({sid:r.nextId++,kind:'food',def:'f_bread',locked:false,free:false});
  let before=JSON.stringify(r);assert.equal(goodsUnavailableReason(r,0),'补给栏已满，先用掉一份');assert.equal(buyGoods(r,0),false);assert.equal(JSON.stringify(r),before);
  r.shop=[];before=JSON.stringify(r);assert.equal(goodsUnavailableReason(r,0),'先上阵一名队员');assert.equal(buyGoods(r,0),false);assert.equal(JSON.stringify(r),before);
  r.queue[0]=unit(r);const gold=r.gold;before=JSON.stringify(r);assert.equal(goodsUnavailableReason(r,0),null);assert.equal(JSON.stringify(r),before);assert.equal(buyGoods(r,0),true);
  assert.equal(r.gold,gold-2);assert.equal(r.merchant[0].sold,true);assert.ok(r.shop.some(s=>s.def==='x_bonepact'&&s.free));
  before=JSON.stringify(r);assert.equal(goodsUnavailableReason(r,0),'商品已售出');assert.equal(buyGoods(r,0),false);assert.equal(JSON.stringify(r),before);
  r.merchant=[{kind:'equip',id:'w_sword',price:4}];r.gold=3;before=JSON.stringify(r);assert.equal(goodsUnavailableReason(r,0),'金币不足');assert.equal(buyGoods(r,0),false);assert.equal(JSON.stringify(r),before);
  r.gold=10;r.endTurnCommitted=true;before=JSON.stringify(r);assert.equal(goodsUnavailableReason(r,0),'备战已结束');assert.equal(buyGoods(r,0),false);assert.equal(JSON.stringify(r),before);
});
console.log(`${checks} support preparation checks passed`);
