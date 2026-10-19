import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPersistence, normalizeRun, validateRun } from '../js/persistence.js';
import * as G from '../js/game.js';
const clone = s => JSON.parse(JSON.stringify(s));
class MemoryStorage {
  map = new Map(); fail = false;
  getItem(k) { return this.map.get(k) ?? null; }
  setItem(k,v) { if(this.fail) throw Error('quota'); this.map.set(k,v); }
  removeItem(k) { if(this.fail) throw Error('quota'); this.map.delete(k); }
}
function lockService() {
  let held = false;
  return { async request(_name, _options, fn) { if(held) return fn(null); held=true; try { return await fn({name:_name}); } finally { held=false; } } };
}
const locks = lockService(), storage = new MemoryStorage();
let checks = 0;
for (const name of ['legacycontinue','patience-buyer','night-production-mixed-waters','order-selected-buyer']) {
  const raw = await readFile(new URL(`./fixtures/growth-v2/${name}.json`, import.meta.url),'utf8');
  storage.map.set('mmdp_run',raw);
  const session = createPersistence({storage,locks}); assert.equal(await session.acquire(),true);
  let state = session.load(); assert.equal(state.v,3); assert.equal(state.money,JSON.parse(raw).money); assert.equal(storage.getItem('mmdp_run_backup_v2') !== null,true);
  const before = clone(state); storage.fail=true;
  await assert.rejects(session.transact(state,'failure', draft => { draft.money+=99; })); assert.deepEqual(state,before);
  storage.fail=false;
  const committed=await session.transact(state,`${state.runId}:continue`, draft=> { G.setState(draft); if(draft.phase==='night') G.sleep(); else G.startDay(); });
  state=committed.state; const balance=state.money;
  const duplicate=await session.transact(state,`${state.runId}:continue`,draft=> {draft.money+=999;}); assert.equal(duplicate.duplicate,true); assert.equal(state.money,balance);
  session.release(); await new Promise(r=>setTimeout(r,0));
  const reopened=createPersistence({storage,locks}); assert.equal(await reopened.acquire(),true);
  const reloaded=reopened.load(); assert.deepEqual(reloaded,state);
  const again=await reopened.transact(reloaded,`${state.runId}:save-again`,draft=> { draft.tutorial=true; }); assert.equal(again.state.tutorial,true); reopened.release(); await new Promise(r=>setTimeout(r,0)); checks++;
}
const owner=createPersistence({storage,locks}), other=createPersistence({storage,locks});
assert.equal(await owner.acquire(),true); assert.equal(await other.acquire(),false); assert.throws(()=>other.save(JSON.parse(storage.getItem('mmdp_run'))),/只读/); owner.release(); await new Promise(r=>setTimeout(r,0));
const invalid=clone(G.newRun()); invalid.v=99; assert.throws(()=>validateRun(invalid),/版本/);
const original='{"v":2,"day":'; storage.map.set('mmdp_run',original);
const broken=createPersistence({storage,locks}); await broken.acquire(); assert.throws(()=>broken.load(),/损坏/); assert.equal(storage.getItem('mmdp_run'),original); broken.release();
await new Promise(r=>setTimeout(r,0));
// A failed backup must never replace the authoritative v2 source.
const oldRaw=await readFile(new URL('./fixtures/growth-v2/legacycontinue.json',import.meta.url),'utf8');
storage.map.set('mmdp_run',oldRaw); storage.fail=true;
const backupFailure=createPersistence({storage,locks}); await backupFailure.acquire();
assert.throws(()=>backupFailure.load(),/未保存/); assert.equal(storage.getItem('mmdp_run'),oldRaw);
storage.fail=false; backupFailure.release(); await new Promise(r=>setTimeout(r,0));
const sync=createPersistence({storage,locks}); await sync.acquire(); let syncState=sync.load();
const syncBefore=clone(syncState); storage.fail=true;
assert.throws(()=>sync.transactSync(syncState,'sync-failed',draft=>{draft.money-=1;}),/未保存/); assert.deepEqual(syncState,syncBefore); storage.fail=false;
syncState=sync.transactSync(syncState,'sync-ok',draft=>{draft.money-=1;}).state;
assert.equal(syncState.money,syncBefore.money-1); assert.equal(sync.transactSync(syncState,'sync-ok',()=>assert.fail('duplicate ran')).duplicate,true);
sync.release();// Corrupt semantic records must fail before initialization can reset missing systems.
const clean=G.newRun();
for (const corrupt of [
  s=>{delete s.business;},
  s=>{s.shelf[0].q=0;},
  s=>{s.shelf[0].id='missing-item';},
  s=>{s.shelf.push({...s.shelf[0]});},
  s=>{s.shelf[0].id='water';s.shelf[0].g=99;},
  s=>{s.business.capacity=0;s.business.warehouse=[s.shelf.pop()];},
  s=>{s.business.routes.water=null;},
  s=>{s.business.ledger=[{id:'bad',day:1,type:'retail',amount:12,cost:-1}];},
  s=>{s.business.contracts=[{id:'bad',route:'water',kind:'regular',qty:3,delivered:4,start:2,due:6,price:36,status:'active',windows:[4,0]}];},
  s=>{s.machines.unknown={left:1,n:1};},
  s=>{s.machines.furnace={left:0,ready:true,n:2,products:[]};},
]) {
  const bad=clone(clean); corrupt(bad); assert.throws(()=>normalizeRun(bad),error=>error.code==='INVALID_SAVE');
}
// Stable finished products survive a full shelf and repeated collection without new UIDs.
G.setState(G.newRun()); G.S.shelfCap=G.S.shelf.length;
G.S.machines.furnace={left:1,n:1,items:[{q:1,cost:9,known:true,stolen:false,heat:0}]};
G.sleep(); validateRun(G.S); const productUid=G.S.machines.furnace.products[0].uid;
G.collectMachines(); assert.equal(G.S.machines.furnace.products[0].uid,productUid);
validateRun(normalizeRun(clone(G.S)));console.log(`Persistence regression passed: ${checks} frozen v2 load → continue → save → reload → save scenarios; failed writes, duplicate commands, exclusive writer and corrupt saves.`);




