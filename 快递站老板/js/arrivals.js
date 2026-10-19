/** Versioned manifests: persisted batches, never inferred from an empty belt. */
export function waveSchedule(day, total, plan, weights) {
  if (day <= 2) return Array.from({length:total}, (_,i)=>({kind:'normal',count:1,at:i*6}));
  const kinds = [...new Set(weights)];
  const offset = (day + (plan === 'rush' ? 1 : 0)) % kinds.length;
  const ordered = kinds.slice(offset).concat(kinds.slice(0,offset));
  const batches = Math.max(ordered.length, Math.ceil(total / (day < 7 ? 3 : 5)));
  const waves=[]; let left=total;
  for(let i=0;i<batches;i++) {
    const count=Math.ceil(left/(batches-i)); left-=count;
    waves.push({kind:ordered[i%ordered.length],count,at:Math.round(i*(day < 7 ? 17 : Math.min(20,80/(batches-1)))*10)/10});
  }
  // Urgent vans carry small consignments: the deadline remains 25 real seconds.
  const excess=waves.reduce((n,w)=>n+(w.kind==='urgent'?Math.max(0,w.count-2):0),0);
  for(const w of waves) if(w.kind==='urgent') w.count=Math.min(2,w.count);
  const ordinary=waves.filter(w=>w.kind!=='urgent');
  for(let i=0;i<excess;i++) ordinary[i%ordinary.length].count++;
  return waves;
}
export function arrivalView(state) {
  const a=state.shift?.arrivals;
  if(!a) return {enabled:false,current:null,next:null,waiting:0,waitingKinds:[]};
  const elapsed=state.shift.elapsed;
  const current=a.cursor ? a.waves[a.cursor-1] : null;
  const next=a.waves[a.cursor];
  const firstCurrentId=1+a.waves.slice(0,Math.max(0,a.cursor-1)).reduce((n,w)=>n+w.count,0);
  const waitingKinds=[];
  for(const p of a.waiting) { let g=waitingKinds.find(g=>g.kind===p.kind); if(!g) waitingKinds.push(g={kind:p.kind,count:0}); g.count++; }
  return {enabled:true,current:current?{kind:current.kind,count:current.count,remaining:a.waiting.filter(p=>p.id>=firstCurrentId && p.id<firstCurrentId+current.count).length}:null,
    next:next?{kind:next.kind,count:next.count,inSeconds:Math.max(0,next.at-elapsed)}:null,waiting:a.waiting.length,waitingKinds};
}
