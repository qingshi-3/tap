import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,act,tick,derived} from '../js/core.js';
const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
const {loadGame,saveGame,SAVE_KEY}=await import('../js/persistence.js');
const fixedSaveKey='forest-lantern.save.v1';
const go=(s,a)=>{const result=act(s,a);assert.equal(result.ok,true,`${JSON.stringify(a)}: ${result.message}`);};
function saveAndReload(s){
 assert.equal(SAVE_KEY,fixedSaveKey);
 const result=saveGame(s);assert.equal(result.ok,true,result.error);
 assert.equal(memory.get(fixedSaveKey),JSON.stringify(s));
 const loaded=loadGame();assert.equal(loaded.error,null);assert.deepEqual(loaded.state,s);return loaded.state;
}
function playService(s){
 go(s,{type:'start'});
 for(let step=0;step<120;step++){
  tick(s,.5);
  for(const guest of [...s.guests])if(guest.status==='waiting')go(s,{type:'serve',id:guest.id});
  if(step===59)s=saveAndReload(s);
 }
 assert.equal(s.phase,'summary');return saveAndReload(s);
}
test('stable storage: continue, save, reload, continue and save',()=>{
 memory.clear();assert.equal(loadGame().state,null);let s=createGame();assert.equal(saveGame(s).ok,true);
 act(s,{type:'start'});tick(s,4);assert.equal(saveGame(s).ok,true);s=loadGame().state;
 tick(s,4);assert.equal(saveGame(s).ok,true);assert.ok(Math.abs(loadGame().state.service.elapsed-8)<1e-6);assert.ok(memory.has(SAVE_KEY+'.backup'));
});
test('unknown/corrupt saves and concurrent changes preserve the original',()=>{
 memory.set(SAVE_KEY,'broken');assert.ok(loadGame().error);assert.equal(saveGame(createGame()).ok,false);assert.equal(memory.get(SAVE_KEY),'broken');
 memory.clear();loadGame();const s=createGame();saveGame(s);memory.set(SAVE_KEY,'other-page');assert.equal(saveGame(s).ok,false);assert.equal(memory.get(SAVE_KEY),'other-page');
});
test('storage failure does not silently create a fresh game',()=>{
 const get=localStorage.getItem;localStorage.getItem=()=>{throw new Error('denied');};assert.ok(loadGame().error);assert.equal(saveGame(createGame()).ok,false);localStorage.getItem=get;
});
test('full occupancy with departing diners remains saveable through service and reload',()=>{
 memory.clear();loadGame();let s=createGame(1);s.coins=20000;
 for(const id of ['tables','sign','decor'])for(let i=0;i<3;i++)assert.equal(act(s,{type:'upgrade',id}).ok,true);
 for(const id of Object.keys(s.inventory))assert.equal(act(s,{type:'buy',id,quantity:200}).ok,true);
 assert.equal(act(s,{type:'event',choice:1}).ok,true);assert.equal(act(s,{type:'start'}).ok,true);
 for(let i=0;i<600;i++){tick(s,.1);assert.ok(s.guests.length<=6);assert.equal(new Set(s.guests.map(g=>g.table)).size,s.guests.length);assert.equal(saveGame(s).ok,true,`save after ${i/10}s`);}
 s=loadGame().state;assert.equal(s.phase,'summary');assert.equal(act(s,{type:'next'}).ok,true);assert.equal(saveGame(s).ok,true);
});

test('frozen 1.0.0 and real 1.0.1 saves keep the fixed storage key through service, reload and next day',()=>{
 for(const file of ['save-v1.0.0-day11.json','save-v1.0.1-real-day30.json']){
  memory.clear();const raw=readFileSync(new URL(`fixtures/${file}`,import.meta.url),'utf8');memory.set(fixedSaveKey,raw);
  const loaded=loadGame();assert.equal(loaded.error,null);let s=loaded.state;
  const original=structuredClone(s);assert.equal(s.operations,undefined);assert.equal(memory.get(fixedSaveKey),raw);
  go(s,{type:'gather',id:'forest'});s=playService(s);assert.ok(s.summary.served>0);
  assert.deepEqual(s.staff,original.staff);assert.deepEqual(s.upgrades,original.upgrades);assert.deepEqual(s.completedContracts,original.completedContracts);
  assert.ok(s.totals.served>original.totals.served);
  const summary=structuredClone(s.summary),coins=s.coins;tick(s,120);assert.deepEqual(s.summary,summary);assert.equal(s.coins,coins);
  go(s,{type:'next'});s=saveAndReload(s);go(s,{type:'gather',id:'forest'});s=playService(s);
  assert.equal(s.day,original.day+1);assert.ok(s.totals.served>original.totals.served);
 }
});

test('oak procurement lock survives actual storage in preparation, service and summary and clears next day',()=>{
 for(const command of [{type:'buy',id:'rice',quantity:1},{type:'gather',id:'forest'},{type:'gatherPlanned'}]){
  memory.clear();loadGame();let s=createGame();go(s,{type:'hire',id:'oak'});
  if(command.type==='gatherPlanned')go(s,{type:'planGather',id:'forest',quantity:1});
  go(s,command);s=saveAndReload(s);assert.deepEqual(derived(s).committedStaff,['oak']);
  const before=JSON.stringify(s);assert.equal(act(s,{type:'shift',id:'oak'}).ok,false);assert.equal(JSON.stringify(s),before);
  s=playService(s);assert.deepEqual(derived(s).committedStaff,['oak']);
  go(s,{type:'next'});s=saveAndReload(s);assert.deepEqual(derived(s).committedStaff,[]);
  go(s,{type:'shift',id:'oak'});s=saveAndReload(s);assert.equal(derived(s).activeStaff.includes('oak'),false);
 }
});

test('earned commission survives deadline, service reload and next day and pays once after storage reload',()=>{
 memory.clear();loadGame();let s=createGame();
 for(const id of [...s.menu])if(id!=='soup')go(s,{type:'menu',id});
 go(s,{type:'acceptServiceOrder',id:'forestLunch'});
 for(let day=1;day<=3;day++){
  while(s.gatherActions)go(s,{type:'gather',id:'forest'});
  s=playService(s);
  if(day===2)assert.equal(derived(s).serviceOrder.canClaim,true);
  go(s,{type:'next'});s=saveAndReload(s);
 }
 assert.ok(s.day>s.operations.serviceOrder.dueDay);assert.equal(derived(s).serviceOrder.canClaim,true);
 assert.deepEqual(s.operations.expiredServices,[]);const coins=s.coins,reputation=s.reputation;
 go(s,{type:'claimServiceOrder'});s=saveAndReload(s);assert.equal(s.coins,coins+90);assert.equal(s.reputation,reputation+3);
 assert.deepEqual(s.operations.completedServices,['1:forestLunch']);assert.equal(derived(s).serviceOrder,null);
 const paid=JSON.stringify(s);assert.equal(act(s,{type:'claimServiceOrder'}).ok,false);assert.equal(JSON.stringify(s),paid);
 s=saveAndReload(s);assert.equal(s.coins,coins+90);
});

test('three actual consecutive services persist their streak and remain payable after the deadline',()=>{
 memory.clear();memory.set(fixedSaveKey,readFileSync(new URL('fixtures/save-v1.0.0-day11.json',import.meta.url),'utf8'));
 let s=loadGame().state;for(const id of [...s.menu])if(id!=='soup')go(s,{type:'menu',id});
 go(s,{type:'acceptServiceOrder',id:'threeDays'});const acceptedDay=s.day;
 for(let progress=1;progress<=3;progress++){
  while(s.gatherActions)go(s,{type:'gather',id:'forest'});
  const shortage=Math.max(0,40-s.inventory.mushroom);if(shortage)go(s,{type:'buy',id:'mushroom',quantity:shortage});
  s=playService(s);assert.ok(s.summary.served>=8);assert.equal(s.operations.serviceOrder.progress,progress);
  assert.equal(s.operations.serviceOrder.lastProgressDay,s.day);go(s,{type:'next'});s=saveAndReload(s);
 }
 assert.ok(s.day>s.operations.serviceOrder.dueDay);assert.equal(derived(s).serviceOrder.canClaim,true);
 const coins=s.coins;go(s,{type:'claimServiceOrder'});s=saveAndReload(s);assert.equal(s.coins,coins+180);
 assert.deepEqual(s.operations.completedServices,[`${acceptedDay}:threeDays`]);assert.deepEqual(s.operations.expiredServices,[]);
 assert.equal(act(s,{type:'claimServiceOrder'}).ok,false);saveAndReload(s);
});
