import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as G from '../js/game.js';
import {UPGRADES} from '../js/data.js';
import {createPersistence,validateRun} from '../js/persistence.js';
const clone=s=>JSON.parse(JSON.stringify(s));
let rngState=170019;Math.random=()=>{rngState=(Math.imul(rngState,1664525)+1013904223)>>>0;return rngState/4294967296;};
const fixtureUrl=new URL('./fixtures/growth-v3/hands-on-day17.json',import.meta.url);
const output=new URL('../../../output/miaomiao-pawnshop/hands-on-fix-20261019/',import.meta.url);
const report={seed:170019,fixture:'hands-on-day17.json',status:'running',checks:[],limitations:['Core-level isolated storage validation; this script does not prove browser UI or TapTap host behavior.','Synthetic boundary branches are identified separately and never overwrite the frozen real-play fixture.']};
class Storage {map=new Map();fail=false;getItem(k){return this.map.get(k)??null;}setItem(k,v){if(this.fail)throw Error('quota');this.map.set(k,v);}removeItem(k){this.map.delete(k);}}
function locks(){let held=false;return{async request(_,__,fn){if(held)return fn(null);held=true;try{return await fn({});}finally{held=false;}}};}
async function open(raw){const storage=new Storage();storage.map.set('mmdp_run',raw);const lock=locks();let session=createPersistence({storage,locks:lock});assert.equal(await session.acquire(),true);let state=session.load();let seq=0;return {storage,get state(){return state;},get session(){return session;},run(name,fn){const before=state;const committed=session.transactSync(state,`${state.runId}:compat:${name}:${seq++}`,draft=>{G.setState(draft);try{return fn(draft);}finally{G.setState(before);}});assert.notEqual(committed.rejected,true,committed.result?.reason);state=committed.state;G.setState(state);return committed.result;},async reopen(){const before=clone(state);session.release();await new Promise(r=>setTimeout(r,0));session=createPersistence({storage,locks:lock});assert.equal(await session.acquire(),true);state=session.load();assert.deepEqual(clone(state),before);G.setState(state);},close(){session.release();}};}
const check=(name,detail={})=>report.checks.push({name,status:'passed',...detail});
try {
 const raw=await readFile(fixtureUrl,'utf8');report.sha256=createHash('sha256').update(raw).digest('hex');assert.equal(report.sha256,'6b75b1b25e982b5ec9110f048f4d374e4a8de9d2c2c79c2654ac691f8f1938de');
 const real=await open(raw);assert.equal(real.state.day,17);assert.equal(real.state.money,669);check('frozen real day17 v3 loads without resetting cash, day, inventory or progression');
 const oldCan=clone(real.state.business.warehouse.find(i=>i.id==='can'));assert(oldCan);
 const before=clone(real.state),disk=real.storage.getItem('mmdp_run');real.storage.fail=true;
 assert.throws(()=>real.run('inspect-failed',()=>G.businessCommand('inspectStock',{uid:oldCan.uid})),/未保存/);assert.deepEqual(real.state,before);assert.equal(real.storage.getItem('mmdp_run'),disk);real.storage.fail=false;
 check('real original unknown stock inspection write failure preserves all live fields and stored bytes');
 const inspected=real.run('inspect',()=>G.businessCommand('inspectStock',{uid:oldCan.uid}));assert.equal(inspected.ok,true);const known=real.state.business.warehouse.find(i=>i.uid===oldCan.uid);assert.equal(known.known,true);assert.equal(known.fake,oldCan.fake);assert.equal(known.stolen,oldCan.stolen);assert.equal(known.cost,oldCan.cost);assert.equal(known.q,oldCan.q);await real.reopen();
 check('real inventory inspection commits identification only and survives reload');
 real.run('contract',()=>G.businessCommand('acceptContract',{route:'water',kind:'regular'}));
 const contract=real.state.business.contracts.at(-1);assert.equal(contract.start,21);
 real.run('purchase',()=>G.businessCommand('purchase',{route:'water',qty:3}));
 real.run('filter',()=>{assert.equal(G.buyUpgrade(UPGRADES.find(u=>u.id==='filter')),true);});
 const sleep=()=>real.run('sleep',()=>{G.sleep();G.startDay();if(G.rentToday()&&!G.S.rentDone)assert.equal(G.payRent(),true);G.startNight();});
 sleep();assert.equal(real.state.day,18);const rawUids=real.state.business.warehouse.filter(i=>i.id==='water').map(i=>i.uid);assert.equal(rawUids.length,3);
 if(!real.state.machines.purifier)real.run('produce',()=>{assert.equal(G.runMachine('purifier',{uids:rawUids}),3);});
 sleep();assert.equal(real.state.day,19);assert.equal(real.state.shelf.filter(i=>i.id==='water').length,3);
 while(real.state.day<21)sleep();
 const delivered=real.run('deliver',()=>G.businessCommand('deliverContract',{id:contract.id}));assert.equal(delivered.ok,true);assert.equal(delivered.count,3);
 await real.reopen();real.run('save-again',()=>G.businessCommand('inspectStock',{uid:oldCan.uid}));await real.reopen();validateRun(real.state);
 check('real day17 → purchase → arrival → production → natural day21 partial contract delivery → save → reload → continue → save',{endDay:real.state.day,endMoney:real.state.money,contract:contract.id,delivered:3});
 report.realEnd={day:real.state.day,money:real.state.money,uid:real.state.uid};real.close();
 // Boundary-only branch: seeded existing fake stock and a ready reserved product, derived from original run.
 const boundary=clone(JSON.parse(raw));G.setState(boundary);const fake=G.mkItem('can',{fake:true,known:false,stolen:true,heat:2,cost:7,q:1});boundary.shelf.push(fake);
 const fish=G.mkItem('fish',{known:true,cost:12,q:1});boundary.machines.tank={left:0,n:1,ready:true,products:[fish]};
 const nextId=`c${boundary.business.nextId++}`;boundary.business.contracts.push({id:nextId,route:'fish',kind:'regular',qty:4,delivered:0,windows:[0,0],start:21,due:25,price:56,status:'active',level:0});boundary.business.reservations[fish.uid]=nextId;
 const branch=await open(JSON.stringify(boundary));const preserved=clone(branch.state),branchDisk=branch.storage.getItem('mmdp_run');
 for(const [action,args] of [['inspectStock',{uid:fake.uid}],['collectMachine',{machine:'tank'}]]){branch.storage.fail=true;assert.throws(()=>branch.run(action,()=>G.businessCommand(action,args)),/未保存/);assert.deepEqual(branch.state,preserved);assert.equal(branch.storage.getItem('mmdp_run'),branchDisk);branch.storage.fail=false;}
 check('synthetic boundary: both command write failures preserve UID counter, all goods, reservations and stored bytes');
 const inspectFake=branch.run('inspect-fake',()=>G.businessCommand('inspectStock',{uid:fake.uid}));assert.equal(inspectFake.inspection.fake,true);assert.equal(inspectFake.inspection.stolen,true);assert.equal(branch.state.shelf.find(i=>i.uid===fake.uid).fake,true);assert.equal(branch.state.shelf.find(i=>i.uid===fake.uid).stolen,true);assert.equal(branch.state.shelf.find(i=>i.uid===fake.uid).cost,7);
 const collected=branch.run('collect-reserved',()=>G.businessCommand('collectMachine',{machine:'tank'}));assert.equal(collected.count,1);assert.equal(branch.state.business.reservations[fish.uid],nextId);assert.equal(branch.state.machines.tank,null);assert.deepEqual(branch.state.shelf.find(i=>i.uid===fish.uid),fish);
 await branch.reopen();branch.run('save-reserved-again',()=>G.businessCommand('inspectStock',{uid:fake.uid}));await branch.reopen();assert.equal(branch.state.business.reservations[fish.uid],nextId);assert.equal(branch.state.shelf.find(i=>i.uid===fake.uid).fake,true);assert.equal(branch.state.shelf.find(i=>i.uid===fake.uid).stolen,true);assert.equal(branch.state.shelf.find(i=>i.uid===fake.uid).cost,7);branch.close();
 check('synthetic boundary: fake/stolen inspection never launders truth; reserved completed UID moves to shelf without releasing reservation and survives repeated reload');
 report.status='passed';
} catch(error){report.status='failed';report.error={name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}
await mkdir(output,{recursive:true});await writeFile(new URL('compatibility.json',output),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));


