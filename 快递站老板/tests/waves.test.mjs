import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dispatch, tick, validate, managementView, orderPreview, arrivalView, CONTENT, pipelineWorkerPoint } from '../js/engine.js';
import { durationFor, pipelineParcels } from '../js/pipeline.js';
import { SAVE_KEY, saveGame, loadGame } from '../js/storage.js';
const clone=s=>JSON.parse(JSON.stringify(s));
const act=(s,a)=>{const r=dispatch(s,a);assert.equal(r.ok,true,r.message);};
const valid=s=>assert.equal(validate(s).ok,true,validate(s).message);
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
function planning(day=1,staff=3,equipment={}) {
  const s=createGame();
  while(s.day<day){act(s,{type:'START'});tick(s,999);act(s,{type:'NEXT'});}
  s.upgrades={...equipment,...(staff>3?{worker:staff-3}:{})};
  act(s,{type:'ENABLE_MANAGEMENT'});return s;
}
const owned=s=>[...s.shift.parcels,...(s.shift.arrivals?.waiting||[]),...pipelineParcels(s.shift),...s.shift.loading.flat()];
function steer(s) {
  const v=managementView(s),staff={sort:1,pack:1,load:1};
  for(let i=3;i<v.total;i++) {
    const role=['sort','pack','load'].sort((a,b)=>v.roles[b].workSeconds/staff[b]-v.roles[a].workSeconds/staff[a])[0];
    staff[role]++;
  }
  if(Object.keys(staff).every(k=>staff[k]===s.management.staff[k]))return false;
  act(s,{type:'SET_STAFF',staff});return true;
}
function finish(s,dynamic=false) {
  const changes=[];
  while(s.phase==='running') {
    if(dynamic && Math.round(s.shift.elapsed)%10===0 && steer(s))changes.push(s.shift.elapsed);
    tick(s,1);valid(s);
  }
  return {delivered:s.shift.delivered,onTime:s.shift.delivered-(s.shift.missed-(s.shift.total-s.shift.delivered)),elapsed:s.shift.elapsed,changes};
}

test('blocked conveyor receives real batches outside, ages them, conserves ownership across two reloads and timeout',()=>{
  let s=planning(16,5);act(s,{type:'SET_STAFF',staff:{sort:0,pack:2,load:3}});act(s,{type:'START'});
  const expected=orderPreview(s).waves; const manifest=s.shift.arrivals.waves;
  assert.deepEqual(manifest,expected);
  tick(s,45);valid(s);
  assert.equal(s.shift.spawned,manifest.filter(w=>w.at<=45).reduce((n,w)=>n+w.count,0));
  assert.equal(owned(s).length,s.shift.spawned);
  assert.ok(arrivalView(s).waiting>0);
  for(const p of owned(s)) {
    let first=1,wave;
    for(const w of manifest){if(p.id>=first && p.id<first+w.count){wave=w;break;}first+=w.count;}
    assert.ok(Math.abs(p.age-(s.shift.elapsed-wave.at))<1e-7);
  }
  assert.equal(s.shift.earnings,0);
  const store=storage();assert.equal(saveGame(store,s).ok,true);s=loadGame(store).state;
  assert.deepEqual(s.shift.arrivals.waves,manifest);
  tick(s,10);valid(s);assert.equal(saveGame(store,s).ok,true);s=loadGame(store).state;
  tick(s,999);valid(s);
  assert.equal(s.shift.delivered,0);assert.equal(s.shift.missed,s.shift.total);
  assert.equal(owned(s).length,0);assert.equal(s.shift.earnings,0);
  assert.equal(s.cash,s.history.slice(0,-1).reduce((n,r)=>n+r.profit,80)+20);
  assert.equal(saveGame(store,s).ok,true);assert.equal(loadGame(store).state.dayResult.missed,s.shift.total);
});

test('empty belt never advances a future wave and planning never starts its clock',()=>{
  const s=planning();const preview=orderPreview(s);tick(s,30);assert.equal(s.shift,null);
  act(s,{type:'START'});assert.equal(s.shift.spawned,1);
  act(s,{type:'SET_STAFF',staff:{sort:3,pack:0,load:0}});
  tick(s,5);assert.equal(s.shift.spawned,1);assert.ok(arrivalView(s).next.inSeconds>0);
  tick(s,1);assert.equal(s.shift.spawned,2);assert.deepEqual(s.shift.arrivals.waves,preview.waves);
});

test('preview and actual manifests share every kind, route, quantity and base fare for both plans',()=>{
  for(const day of [3,8,14,18])for(const plan of ['steady','rush'])for(const route of [null,0,2]) {
    const s=planning(day,5);const p=orderPreview(s,{plan,route});
    act(s,{type:'SET_STAFF',staff:{sort:0,pack:0,load:5}});act(s,{type:'START',plan,route});
    tick(s,Math.max(...p.waves.map(w=>w.at))+0.1);valid(s);
    assert.equal(s.shift.spawned,p.total);
    const actual=owned(s).sort((a,b)=>a.id-b.id);
    assert.deepEqual(actual.map(x=>x.kind),p.waves.flatMap(w=>Array(w.count).fill(w.kind)));
    assert.deepEqual([0,1,2].map(d=>actual.filter(x=>x.dest===d).length),p.routeCounts);
    assert.equal(actual.reduce((n,x)=>n+CONTENT.days[day-1].basePay+(x.kind==='normal'?0:2),0),p.baseRevenue);
    assert.equal(route===null?0:actual.filter(x=>x.dest===route).length*2,p.routeExtra);
  }
});

test('rule-two busy-work and outside backlog reload follows the identical future without reroll or duplicated income',()=>{
  let s=planning(14,5);act(s,{type:'START'});tick(s,35);
  assert.ok(s.shift.arrivals.waiting.length>0);assert.ok(s.shift.flow.workers.some(w=>w.parcel));
  const expected=clone(s),store=storage();assert.equal(saveGame(store,s).ok,true);s=loadGame(store).state;
  assert.deepEqual(s,expected);tick(s,7);tick(expected,7);
  assert.equal(saveGame(store,s).ok,true);s=loadGame(store).state;
  tick(s,999);tick(expected,999);valid(s);assert.deepEqual(s,expected);
});

test('freeplay schedules every accepted parcel before closing with cleanup runway',()=>{
  for(const day of [19,30,60])for(const plan of ['steady','rush']) {
    const s=planning(day,5,{sorter:1,scanner:1,packer:1,widegate:1,dispatch:1});
    const preview=orderPreview(s,{plan});act(s,{type:'START',plan});
    assert.ok(preview.waves.every(w=>w.at<=s.shift.duration-40));
    tick(s,80.1);valid(s);assert.equal(s.shift.spawned,s.shift.total);
    assert.deepEqual(s.shift.arrivals.waves,preview.waves);
  }
});

test('new rules put each special bottleneck at its own bench and equipment shortens without erasing it',()=>{
  const s=planning(16,5);act(s,{type:'START'});
  const base={},upgraded={};
  for(const kind of ['normal','fragile','large','exception'])base[kind]=['sort','pack','load'].map(stage=>durationFor(s,stage,{kind,prepared:false},3));
  s.upgrades={...s.upgrades,packer:1,widegate:1,scanner:1,sorter:1};
  for(const kind of Object.keys(base))upgraded[kind]=['sort','pack','load'].map(stage=>durationFor(s,stage,{kind,prepared:true},3));
  for(const [kind,index] of [['exception',0],['fragile',1],['large',2]]) {
    assert.ok(base[kind][index]>Math.max(...base[kind].filter((_,i)=>i!==index))*2);
    assert.ok(upgraded[kind][index]<base[kind][index]);
    assert.ok(upgraded[kind][index]>upgraded.normal[index]+2);
  }
});

test('persisted batch shape, cursor, counts and rules version reject corruption',()=>{
  const s=planning(14,5);act(s,{type:'START'});tick(s,15);valid(s);
  for(const damage of [x=>x.shift.arrivals.cursor++,x=>x.shift.arrivals.waves[0].count++,x=>x.shift.arrivals.waves[0].at++,x=>x.shift.arrivals.extra=true,x=>x.shift.flow.rules=3,x=>delete x.shift.arrivals,x=>delete x.shift.flow.rules,x=>x.shift.parcels[0].age++,x=>x.shift.parcels[0].kind='large',x=>x.shift.parcels[0].dest=(x.shift.parcels[0].dest+1)%3]) {
    const bad=clone(s);damage(bad);assert.equal(validate(bad).ok,false);
  }
});

test('historical busy fragile, large and exception jobs retain exact rule-one clocks through play/save/reload',()=>{
  for(const [kind,stage,seconds] of [['fragile','pack',4.2],['large','load',2.805],['exception','pack',5.2]]) {
    let s=planning(13);act(s,{type:'START'});
    delete s.shift.arrivals;delete s.shift.flow.rules;
    s.shift.spawned=1;s.shift.nextId=2;
    const parcel={id:1,dest:0,kind,x:0.04,prepared:false,age:0};s.shift.parcels=[];
    const worker=s.shift.flow.workers.find(w=>w.role===stage);
    Object.assign(worker,{parcel,phase:'work',job:{stage,duration:seconds,remaining:seconds*0.6},progress:0.4},pipelineWorkerPoint(stage,worker.id));
    valid(s);const bad=clone(s);bad.shift.flow.workers[worker.id-1].job.duration=seconds+0.01;assert.equal(validate(bad).ok,false);
    const store=storage();assert.equal(saveGame(store,s).ok,true);s=loadGame(store).state;
    assert.equal(s.shift.arrivals,undefined);assert.equal(s.shift.flow.rules,undefined);
    tick(s,0.1);valid(s);assert.ok(Math.abs(s.shift.flow.workers[worker.id-1].job.remaining-(seconds*0.6-0.1))<1e-7);
    assert.equal(saveGame(store,s).ok,true);s=loadGame(store).state;tick(s,999);valid(s);
    act(s,{type:'NEXT'});act(s,{type:'START'});assert.equal(s.shift.flow.rules,2);assert.equal(s.shift.arrivals.version,1);
  }
});

test('observable backlog reallocation every ten seconds beats every fixed allocation on mid/late identical manifests, including all equipment',()=>{
  for(const day of [8,16])for(const equipment of [{},{packer:1,widegate:1,scanner:1,sorter:1,dispatch:1}]) {
    const n=day===8?4:5,template=planning(day,n,equipment),fixed=[];
    for(let sort=1;sort<n-1;sort++)for(let pack=1;pack<n-sort;pack++) {
      const s=clone(template);act(s,{type:'SET_STAFF',staff:{sort,pack,load:n-sort-pack}});act(s,{type:'START'});fixed.push(finish(s));
    }
    const dynamic=clone(template);act(dynamic,{type:'START'});const result=finish(dynamic,true);
    assert.ok(result.delivered>Math.max(...fixed.map(r=>r.delivered)),JSON.stringify({day,equipment,result,fixed}));
    assert.ok(result.onTime>Math.max(...fixed.map(r=>r.onTime)));
    assert.ok(result.changes.length<=Math.ceil(result.elapsed/10));
    for(let i=1;i<result.changes.length;i++)assert.ok(result.changes[i]-result.changes[i-1]>=9.99);
    console.log(JSON.stringify({day,equipped:!!equipment.packer,bestFixedDelivered:Math.max(...fixed.map(r=>r.delivered)),bestFixedOnTime:Math.max(...fixed.map(r=>r.onTime)),dynamic:result}));
  }
});

test('earned-income purchases plus limited workload staffing complete all eighteen new-wave days',()=>{
  const s=createGame();act(s,{type:'ENABLE_MANAGEMENT'});
  const purchases={5:['worker'],8:['widegate'],10:['packer','dispatch'],12:['worker'],13:['scanner'],16:['sorter']};
  for(let day=1;day<=18;day++) {
    for(const id of purchases[day]||[])act(s,{type:'BUY',id});
    act(s,{type:'START'});finish(s,true);
    assert.equal(s.dayResult.success,true,`day ${day}: ${JSON.stringify(s.dayResult)}`);
    if(day<=3)assert.equal(s.shift.delivered,s.shift.total,'first three days forgive baseline three-person staffing');
    assert.ok(s.cash>=0);if(day<18)act(s,{type:'NEXT'});
  }
  assert.equal(s.phase,'ending');assert.equal(s.history.length,18);assert.equal(s.upgrades.worker,2);assert.equal(s.upgrades.sorter,1);
});
