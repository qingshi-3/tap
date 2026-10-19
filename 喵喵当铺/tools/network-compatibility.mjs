import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as G from '../js/game.js';
import * as Network from '../js/network.js';
import {createPersistence,validateRun,normalizeRun} from '../js/persistence.js';
const clone=value=>JSON.parse(JSON.stringify(value));
let seed=140019;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const output=new URL('../../../output/miaomiao-pawnshop/expansion-20261019/compatibility/',import.meta.url);
const report={seed:140019,status:'running',checks:[],milestones:[],limitations:['Real core commands with isolated memory storage; not browser or TapTap host evidence.','Retail and important-visitor refusal is represented explicitly; no new retail, bounty or advertising proceeds are added.']};
const check=(name,detail={})=>report.checks.push({name,status:'passed',...detail});
class Storage{map=new Map();fail=false;getItem(k){return this.map.get(k)??null;}setItem(k,v){if(this.fail)throw Error('quota');this.map.set(k,v);}removeItem(k){this.map.delete(k);}}
function locks(){let held=false;return{async request(_,__,fn){if(held)return fn(null);held=true;try{return await fn({});}finally{held=false;}}};}
async function open(raw){const storage=new Storage(),lock=locks();storage.map.set('mmdp_run',raw);let session=createPersistence({storage,locks:lock});assert.equal(await session.acquire(),true);let state=session.load(),seq=0;return{storage,get locks(){return lock;},get state(){return state;},get session(){return session;},run(name,fn,id){const previous=state;const commit=session.transactSync(state,id||`${state.runId}:network-compat:${name}:${seq++}`,draft=>{G.setState(draft);try{return fn(draft);}finally{G.setState(previous);}});if(!name.startsWith('attempt:'))assert.notEqual(commit.rejected,true,commit.result?.reason);state=commit.state;G.setState(state);return commit;},async reopen(){const before=clone(state);session.release();await new Promise(r=>setTimeout(r,0));session=createPersistence({storage,locks:lock});assert.equal(await session.acquire(),true);state=session.load();assert.deepEqual(clone(state),before);G.setState(state);},close(){session.release();}};}
function failWrite(test,name,fn){const before=clone(test.state),disk=test.storage.getItem('mmdp_run');test.storage.fail=true;try{assert.throws(()=>test.run(name,fn),/未保存/);}finally{test.storage.fail=false;}assert.deepEqual(test.state,before);assert.equal(test.storage.getItem('mmdp_run'),disk);}
const legacyAssets=s=>clone({day:s.day,money:s.money,uid:s.uid,shelf:s.shelf,hidden:s.hidden,machines:s.machines,business:{...s.business,network:undefined}});
function nextDay(){
 // Explicit manual decisions decline remaining visitors without adding any proceeds.
 if(G.S.phase==='day'){
  while(G.current()){if(G.canDelegateReception()){G.delegateReception();continue;}G.current().resolved=true;G.S.qi++;}
  if(G.rentToday()&&!G.S.business.ownership.owned&&!G.S.rentDone)assert.equal(G.payRent(),true);
  G.startNight();
 }
 G.sleep();G.expireOrders();G.voidFakeCash();G.startDay();
}
await mkdir(output,{recursive:true});
try{
 const raw=await readFile(new URL('./fixtures/network/v1.3.0-day28.json',import.meta.url),'utf8');
 assert.equal(createHash('sha256').update(raw).digest('hex'),'560141df335deef9507218ef0cbf8bb09ba1dda0cbe71d0e95b64fd8bbab11c0');
 const old=JSON.parse(raw),test=await open(raw);const other=createPersistence({storage:test.storage,locks:test.locks});assert.equal(await other.acquire(),false);assert.throws(()=>other.transactSync(test.state,'other-network-writer',()=>({ok:true})),error=>error.code==='READ_ONLY');check('second session cannot start network transactions while current session holds the writer lock');assert.deepEqual(legacyAssets(test.state),legacyAssets(old));
 assert.equal(test.state.business.network.policy.enabled,false);
 check('frozen natural v1.3.0 day28 loads with network unbuilt/disabled while preserving every pre-existing asset and policy');
 const beforePreview=clone(test.state);G.setState(test.state);G.networkPreview({...test.state.business.network.policy,production:'fish',quality:'premium'});assert.deepEqual(test.state,beforePreview);check('network preview does not mutate legacy goods, money, UID, policy, progression or period markers');
 test.run('old-continue',()=>{nextDay();});await test.reopen();test.run('old-continue-again',()=>{nextDay();});await test.reopen();
 check('missing optional network → real continued gameplay → save/reload → continued gameplay and second save');
 for(const mutate of [
  s=>{s.business.network=null;},s=>{s.business.network.v=99;},s=>{s.business.network.policy.reserve=-1;},s=>{s.business.network.policy.quality='unknown';},s=>{s.business.network.marks.opened=99999;},s=>{s.business.network.legacyMargins={invalid:12};},s=>{s.business.network.profitable.harbor=true;},
 ]){
  const bad=normalizeRun(JSON.parse(raw));mutate(bad);const storage=new Storage(),bytes=JSON.stringify(bad);storage.map.set('mmdp_run',bytes);const session=createPersistence({storage,locks:locks()});await session.acquire();assert.throws(()=>session.load(),e=>e.code==='INVALID_SAVE');assert.equal(storage.getItem('mmdp_run'),bytes);session.release();
 }
 check('corrupt existing network state/version/budget/quality/period/margins/profitability is rejected without resetting or overwriting original bytes');

 const milestone=async name=>{report.milestones.push({name,day:test.state.day,money:test.state.money,uid:test.state.uid});await writeFile(new URL(`${name}.json`,output),JSON.stringify(test.state,null,2)+'\n');await test.reopen();};
 const command=(action,args,name=action)=>test.run(name,()=>G.businessCommand(action,args));
 let failedConstruction=false,failedSettlement=false,failedPolicy=false;
 const oldItemUIDs=old.shelf.concat(old.hidden,old.business.warehouse).map(i=>i.uid);
 for(let guard=0;guard<250;guard++){
  const state=test.state,n=state.business.network;
  if(!state.business.ownership.owned&&state.money>=7600){
   failWrite(test,'buyout-write-failure',()=>G.businessCommand('buyout',{}));
   command('buyout',{});await milestone('ownership');
  }
  if(test.state.business.ownership.owned){
   for(const id of ['workshop','harbor','capacity','boutique']){
    if(test.state.business.network.builds[id])continue;
    const previous=G.S;let possible;G.setState(clone(test.state));try{possible=G.businessCommand('networkBuild',{id});}finally{G.setState(previous);}
    if(possible.ok&&!failedConstruction){failWrite(test,'construction-failure',()=>G.businessCommand('networkBuild',{id}));failedConstruction=true;check('legal paid construction write failure leaves original cash, construction and every legacy field unchanged');}
    const buildId=`${test.state.runId}:network-build:${id}`;const result=test.run(`attempt:${id}`,()=>G.businessCommand('networkBuild',{id}),buildId);
    if(!result.rejected){
     // Reopening immediately verifies that construction and paid cash share the same durable record.
     await milestone(`built-${id}`);
     const before=clone(test.state);const duplicate=test.run(`attempt:duplicate-${id}`,()=>G.businessCommand('networkBuild',{id}));assert.equal(duplicate.rejected,true);assert.deepEqual(test.state,before);
     const replay=test.run('build-replay-repeat',()=>assert.fail('stored construction replay ran twice'),buildId);assert.equal(replay.duplicate,true);
     if(id==='workshop')command('networkPolicy',{enabled:true,production:'balanced',quality:'standard',priority:'harbor',reserve:150});
     if(id==='boutique')command('networkPolicy',{enabled:true,production:'balanced',quality:'mixed',priority:'boutique',reserve:150});
    }
   }
  }
  const live=test.state.business.network;
  if(live.current&&!failedPolicy){
   // A legal policy edit is a representative network transaction even while its batch is locked.
   const snapshot=clone(live.current);failWrite(test,'policy-failure',()=>G.businessCommand('networkPolicy',{...live.policy,reserve:live.policy.reserve+1}));assert.deepEqual(test.state.business.network.current,snapshot);failedPolicy=true;
  }
  if(live.current&&test.state.day===live.current.end&&!failedSettlement){
   failWrite(test,'settlement-failure',()=>{nextDay();});failedSettlement=true;
   check('period-close settlement write failure preserves complete cash, goods, current batch, history, goal and ledger state');
  }
  if(live.completedDay!==null){await milestone('network-complete');break;}
  test.run('natural-next-day',()=>{nextDay();});
  validateRun(test.state);await test.reopen();
  const beforeDuplicate=clone({cash:test.state.money,network:test.state.business.network,ledger:test.state.business.ledger});
  test.run('repeat-network-boundary',()=>{Network.networkMorning(G.S,{record:G.recordCash});if(!G.S.business.network.current||G.S.day<G.S.business.network.current.end)Network.networkEvening(G.S,{record:G.recordCash});});
  assert.deepEqual({cash:test.state.money,network:test.state.business.network,ledger:test.state.business.ledger},beforeDuplicate);
 }
 assert(test.state.business.network.completedDay!==null,'natural old-save continuation never reached three-period goal');
 assert(failedSettlement);assert(failedConstruction);
 const settled=clone(test.state);
 for(const mutate of [
  s=>{s.business.network.history.at(-1).income+=1;},s=>{s.business.network.history.at(-1).production.standard+=1;},s=>{s.business.network.history.at(-1).stores[0].spending+=1;},s=>{s.business.network.history.at(-1).oldStoreProfit+=1;},s=>{s.business.network.builds.workshop.cost=-1;},s=>{s.business.network.completedDay=1;},s=>{s.business.network.streak=-1;},s=>{if(s.business.network.current)s.business.network.current.costs.total+=1;else s.business.network.marks.settled=99999;},
 ]){const bad=clone(settled);mutate(bad);assert.throws(()=>validateRun(bad),e=>e.code==='INVALID_SAVE');}
 check('settled quantity/material/store allocation/legacy goal totals, paid building and goal date corruption are rejected');

 check('natural old v1.3 save earns and pays property/construction, runs paid network batches and completes three-period goal',{milestones:report.milestones,originalLegacyStockUIDs:oldItemUIDs});
 test.run('continue-after-goal',()=>{nextDay();});await test.reopen();test.run('save-after-goal-again',()=>{nextDay();});await test.reopen();
 check('completed network remains playable and can save/reload/continue/save again without rebuilding');
 report.end={day:test.state.day,money:test.state.money,uid:test.state.uid,streak:test.state.business.network.streak,completedDay:test.state.business.network.completedDay};
 await writeFile(new URL('continued-run.json',output),JSON.stringify(test.state,null,2)+'\n');test.close();report.status='passed';
}catch(error){report.status='failed';report.error={name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}
await writeFile(new URL('report.json',output),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
