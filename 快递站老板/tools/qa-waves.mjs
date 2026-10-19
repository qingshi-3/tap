/** Deterministic developer simulation only; never allocates staff in the game UI. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGame, dispatch, tick, validate, managementView } from '../js/engine.js';
const output=fileURLToPath(new URL('../output/qa/waves/',import.meta.url));
mkdirSync(output,{recursive:true});
const copy=s=>JSON.parse(JSON.stringify(s));
const act=(s,a)=>{const r=dispatch(s,a);if(!r.ok)throw Error(r.message);};
const write=(name,data)=>writeFileSync(output+name,JSON.stringify(data,null,2));
function steer(s){
  const view=managementView(s),staff={sort:1,pack:1,load:1};
  for(let i=3;i<view.total;i++){
    const target=['sort','pack','load'].sort((a,b)=>view.roles[b].workSeconds/staff[b]-view.roles[a].workSeconds/staff[a])[0];staff[target]++;
  }
  if(Object.keys(staff).every(k=>staff[k]===s.management.staff[k]))return false;
  act(s,{type:'SET_STAFF',staff});return true;
}
function finish(s,dynamic){
  const changes=[];
  while(s.phase==='running'){
    if(dynamic&&Math.round(s.shift.elapsed)%10===0&&steer(s))changes.push({at:+s.shift.elapsed.toFixed(1),staff:{...s.management.staff}});
    tick(s,1);if(!validate(s).ok)throw Error(validate(s).message);
  }
  return {delivered:s.shift.delivered,onTime:s.shift.delivered-(s.shift.missed-(s.shift.total-s.shift.delivered)),elapsed:+s.shift.elapsed.toFixed(1),profit:s.dayResult.profit,changes};
}
function campaign(){
  const s=createGame(),days=[];act(s,{type:'ENABLE_MANAGEMENT'});
  const purchases={5:['worker'],8:['widegate'],10:['packer','dispatch'],12:['worker'],13:['scanner'],16:['sorter']};
  for(let day=1;day<=18;day++){
    if(day===8)write('day8-planning.json',s);
    for(const id of purchases[day]||[])act(s,{type:'BUY',id});
    if(day===14){act(s,{type:'SET_STAFF',staff:{sort:2,pack:1,load:2}});write('day14-prepared.json',s);const running=copy(s);act(running,{type:'START'});tick(running,35);write('day14-running.json',running);}
    act(s,{type:'START'});const result=finish(s,true);days.push({day,...result,cash:s.cash,success:s.dayResult.success,upgrades:{...s.upgrades}});
    if(day<18)act(s,{type:'NEXT'});
  }
  return days;
}
function planning(day,n,equipment){
  const s=createGame();while(s.day<day){act(s,{type:'START'});tick(s,999);act(s,{type:'NEXT'});}
  s.upgrades={...equipment,worker:n-3};act(s,{type:'ENABLE_MANAGEMENT'});return s;
}
const benchmarks=[];
for(const day of [8,16])for(const equipment of [{},{sorter:1,packer:1,scanner:1,widegate:1,dispatch:1}]){
  const n=day===8?4:5,template=planning(day,n,equipment),fixed=[];
  for(let sort=1;sort<n-1;sort++)for(let pack=1;pack<n-sort;pack++){
    const s=copy(template),staff={sort,pack,load:n-sort-pack};act(s,{type:'SET_STAFF',staff});act(s,{type:'START'});fixed.push({staff,...finish(s,false)});
  }
  const s=copy(template);act(s,{type:'START'});const dynamic=finish(s,true);
  benchmarks.push({day,workers:n,equipment,waves:s.shift.arrivals.waves,fixed,dynamic});
}
const equipped=planning(16,5,{sorter:1,packer:1,scanner:1,widegate:1,dispatch:1});
act(equipped,{type:'SET_STAFF',staff:{sort:2,pack:1,load:2}});write('day16-equipped-prepared.json',equipped);act(equipped,{type:'START'});tick(equipped,45);write('day16-equipped-running.json',equipped);
const legacy=planning(14,5,{});act(legacy,{type:'START'});delete legacy.shift.flow.rules;delete legacy.shift.arrivals;
legacy.shift.spawned=1;legacy.shift.nextId=2;legacy.shift.parcels=legacy.shift.parcels.slice(0,1);legacy.shift.parcels[0].kind='exception';
tick(legacy,20);if(!validate(legacy).ok)throw Error(validate(legacy).message);write('legacy-running.json',legacy);
write('simulation.json',{strategy:'Every 10 seconds keep one employee at each role. Assign each extra employee to the largest current workSeconds / provisional assigned headcount. Ties use sort, pack, load. Busy workers finish and unload their parcel before walking to the target. No future manifests or future arrivals enter this strategy.',notes:'Fixed allocations are chosen before opening, all allocations with at least one person per stage are enumerated; a permanently unstaffed stage delivers zero. Equipment identical within each comparison. Only deterministic simulation, not human balance acceptance.',benchmarks,campaign:campaign()});
console.log('Wrote wave simulations and isolated QA save fixtures.');
