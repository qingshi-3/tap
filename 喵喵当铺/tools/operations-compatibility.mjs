import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as G from '../js/game.js';
import {createPersistence,validateRun,normalizeRun} from '../js/persistence.js';
const clone=s=>JSON.parse(JSON.stringify(s));
let seed=130019;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const output=new URL('../../../output/miaomiao-pawnshop/operations-20261019/compatibility/',import.meta.url);
const report={seed:130019,status:'running',checks:[],limitations:['Actual core and storage transactions, not browser controls or TapTap host validation.','Natural day advancement uses the same sleep/startDay calls while manually declining retail visitors; it does not fabricate retail income.']};
const check=(name,detail={})=>report.checks.push({name,status:'passed',...detail});
class Storage{map=new Map();fail=false;getItem(k){return this.map.get(k)??null;}setItem(k,v){if(this.fail)throw Error('quota');this.map.set(k,v);}removeItem(k){this.map.delete(k);}}
function locks(){let held=false;return{async request(_,__,fn){if(held)return fn(null);held=true;try{return await fn({});}finally{held=false;}}};}
async function open(raw){const storage=new Storage(),lock=locks();storage.map.set('mmdp_run',raw);let session=createPersistence({storage,locks:lock});assert.equal(await session.acquire(),true);let state=session.load(),seq=0;return{storage,get locks(){return lock;},get state(){return state;},get session(){return session;},run(name,fn,id){const old=state;const commit=session.transactSync(state,id||`${state.runId}:ops-compat:${name}:${seq++}`,draft=>{G.setState(draft);try{return fn(draft);}finally{G.setState(old);}});assert.notEqual(commit.rejected,true,commit.result?.reason);state=commit.state;G.setState(state);return commit;},async reopen(){const before=clone(state);session.release();await new Promise(r=>setTimeout(r,0));session=createPersistence({storage,locks:lock});assert.equal(await session.acquire(),true);state=session.load();assert.deepEqual(clone(state),before);G.setState(state);},close(){session.release();}};}
const fingerprint=s=>clone({money:s.money,uid:s.uid,shelf:s.shelf,warehouse:s.business.warehouse,machines:s.machines,purchases:s.business.purchases,contracts:s.business.contracts,ledger:s.business.ledger,reservations:s.business.reservations,employee:s.business.employee});
await mkdir(output,{recursive:true});
try{
 for(const relative of ['./fixtures/growth-v3/hands-on-day17.json','./fixtures/operations/v1.2.1-day18.json']){
  const raw=await readFile(new URL(relative,import.meta.url),'utf8'),original=JSON.parse(raw);const expected=relative.includes('day17')?'6b75b1b25e982b5ec9110f048f4d374e4a8de9d2c2c79c2654ac691f8f1938de':'864d8be621f9850b7750edd047d5ebb4d1726bac0d68e55cf64b088d3376741b';assert.equal(createHash('sha256').update(raw).digest('hex'),expected);assert.equal(original.business.operations,undefined);
  const test=await open(raw);assert.equal(test.state.business.operations.enabled,false);assert.deepEqual(fingerprint(test.state),fingerprint(original));
  test.run('old-continue',()=>{G.sleep();G.startDay();G.startNight();});await test.reopen();test.run('old-save-again',()=>G.businessCommand('inspectStock',{uid:test.state.business.warehouse.find(i=>i.id==='can').uid}));await test.reopen();test.close();
  check('missing optional policy loads disabled without changing original assets; old run continues and saves twice',{fixture:relative,sha256:createHash('sha256').update(raw).digest('hex')});
 }
 const raw=await readFile(new URL('./fixtures/operations/v1.2.1-day18.json',import.meta.url),'utf8');
 for(const modify of [s=>{s.business.operations=null;},s=>{s.business.operations={v:9,enabled:false,reserve:0,routes:{water:'off',fish:'off'}};},s=>{s.business.operations={v:1,enabled:true,reserve:-1,routes:{water:'regular',fish:'off'}};},s=>{s.business.operations={v:1,enabled:true,reserve:0,routes:{water:'unknown',fish:'off'}};},s=>{s.business.contracts[0].managed='yes';}]){
  const bad=JSON.parse(raw);modify(bad);const bytes=JSON.stringify(bad),storage=new Storage();storage.map.set('mmdp_run',bytes);const session=createPersistence({storage,locks:locks()});await session.acquire();assert.throws(()=>session.load(),e=>e.code==='INVALID_SAVE');assert.equal(storage.getItem('mmdp_run'),bytes);session.release();
 }
 for(const modify of [
  s=>{s.business.operations.reports=[];},
  s=>{s.business.operations.reports={'4':{id:4,start:16,end:20,income:-1,spending:0,deliveries:0,productionStarts:0,purchases:0}};},
  s=>{s.business.operations.issues=[{route:'other',code:'cash',text:'bad'}];},
  s=>{s.business.marks['operations-morning']=s.day+1;},
  s=>{s.business.ledger[0].managed=1;}
 ]){
  const bad=normalizeRun(JSON.parse(raw));modify(bad);const bytes=JSON.stringify(bad),storage=new Storage();storage.map.set('mmdp_run',bytes);const session=createPersistence({storage,locks:locks()});await session.acquire();assert.throws(()=>session.load(),e=>e.code==='INVALID_SAVE');assert.equal(storage.getItem('mmdp_run'),bytes);session.release();
 }
 check('invalid policy/version/reserve/customer, reports/issues, future settlement marks and managed flags reject while preserving original bytes');
 const test=await open(raw);const second=createPersistence({storage:test.storage,locks:test.locks});assert.equal(await second.acquire(),false);assert.throws(()=>second.transactSync(test.state,'other-page',draft=>{draft.money=0;}),error=>error.code==='READ_ONLY');
 check('a second session cannot run or save policy commands while the first holds the exclusive writer lock');
 test.run('enable',()=>G.businessCommand('setOperations',{enabled:true,reserve:50,routes:{water:'regular',fish:'regular'}}));await test.reopen();
 const prior=clone(test.state),disk=test.storage.getItem('mmdp_run');test.storage.fail=true;assert.throws(()=>test.run('failed-auto',()=>{G.sleep();G.startDay();}),/未保存/);assert.deepEqual(test.state,prior);assert.equal(test.storage.getItem('mmdp_run'),disk);test.storage.fail=false;
 check('enabled automatic day transaction write failure rolls back every field, money, goods, UID, reports and business marks');
 const days=[];
 while(test.state.day<27){
  if(test.state.day===20){
   const before=clone(test.state),saved=test.storage.getItem('mmdp_run');test.storage.fail=true;
   assert.throws(()=>test.run('failed-sign-procure',()=>{G.sleep();G.startDay();}),/未保存/);assert.deepEqual(test.state,before);assert.equal(test.storage.getItem('mmdp_run'),saved);test.storage.fail=false;
   check('period-boundary auto signing and paid procurement are rolled back together on failed storage, then retried once');
  }
  test.run('next-day',()=>{G.sleep();G.startDay();if(G.rentToday()&&!G.S.rentDone)assert.equal(G.payRent(),true);G.startNight();});
  days.push({day:test.state.day,money:test.state.money,contracts:test.state.business.contracts.filter(c=>c.managed).map(c=>({id:c.id,start:c.start,status:c.status,delivered:c.delivered,qty:c.qty})),purchases:test.state.business.purchases.length,filter:test.state.filter});
  const before=fingerprint(test.state),reports=clone(test.state.business.operations);test.run('repeat-morning',()=>{G.operateManaged('morning');});assert.deepEqual(fingerprint(test.state),before);assert.deepEqual(test.state.business.operations,reports);
  await test.reopen();
 }
 assert(test.state.business.contracts.some(c=>c.managed&&c.delivered>0));assert(test.state.business.purchases.some(p=>p.arrivalDay>=20));validateRun(test.state);
 test.run('save-policy-again',()=>G.businessCommand('setOperations',{enabled:true,reserve:50,routes:{water:'regular',fish:'regular'}}));await test.reopen();
 const beforeRecompute=fingerprint(test.state),beforeReport=clone(test.state.business.operations.reports);test.run('same-day-policy-recompute',()=>{G.operateManaged('morning');});assert.deepEqual(fingerprint(test.state),beforeRecompute);assert.deepEqual(test.state.business.operations.reports,beforeReport);await test.reopen();
 check('same-day saved policy reconfiguration may clear stage marks but recomputation does not repeat spending, deliveries, production, goods, UID or period reports');
 check('old v1.2.1 policy enable → real automatic purchase/production/delivery → each-day reload → continue and save; repeated same-day morning does not duplicate economics',{days});
 const beforeAdvance=clone(test.state),savedAdvance=test.storage.getItem('mmdp_run');test.storage.fail=true;
 assert.throws(()=>test.run('advance-failed',()=>G.advanceManaged()),/未保存/);assert.deepEqual(test.state,beforeAdvance);assert.equal(test.storage.getItem('mmdp_run'),savedAdvance);test.storage.fail=false;
 const advanceId=`${test.state.runId}:advance-compat-once`,advanced=test.run('advance',()=>G.advanceManaged(),advanceId);await test.reopen();
 const committed=clone(test.state);const duplicate=test.run('advance-repeat',()=>assert.fail('same advance command re-executed'),advanceId);assert.equal(duplicate.duplicate,true);assert.deepEqual(test.state,committed);
 check('advance runs inside durable transaction, write failure rolls back; persisted identical command ID cannot replay after reload',{result:advanced.result});
 report.end={day:test.state.day,money:test.state.money,uid:test.state.uid};await writeFile(new URL('continued-run.json',output),JSON.stringify(test.state,null,2)+'\n');test.close();
 report.status='passed';
}catch(error){report.status='failed';report.error={name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}
await mkdir(output,{recursive:true});await writeFile(new URL('report.json',output),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));


