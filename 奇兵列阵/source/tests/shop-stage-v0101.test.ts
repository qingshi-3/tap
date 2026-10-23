import {afterEach,expect,it,vi} from 'vitest';
import {newRun,applyResult,cloneRun,buy,refreshShop,leaveShop,takeDraft,buildBattle,beginBattle,finishBattle,shopUnitBuysRemaining,type RunState} from '../src/core/run';
import {loadRun,saveRun,SAVE_KEY} from '../src/core/save';
import {simulate} from '../src/core/engine';
function shop(chapter:number,seed:number,legacyRules=false){const r=newRun('reva',seed,{legacyRules});r.chapter=chapter;r.node=2;applyResult(r,'win');expect(r.shop).not.toBeNull();return r;}
function slots(r:RunState){const s=r.shop!;return s.equips.length+s.spells.length+Number(!!s.pack)+Number(!!s.order)+Number(!!s.boon);}
function store(){const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,String(v)),removeItem:(k:string)=>values.delete(k)});return values;}
afterEach(()=>vi.unstubAllGlobals());
it('new shops keep six unique auxiliary goods and chapter exclusion boundaries and refuse every new-rule refresh',()=>{
 for(let ch=0;ch<3;ch++)for(let seed=1;seed<=80;seed++){
  const r=shop(ch,seed);for(let step=0;step<3;step++){
   const s=r.shop!;expect(s.units).toHaveLength(3);expect(slots(r)).toBe(6);expect(new Set(s.equips.map(i=>i.id)).size).toBe(s.equips.length);expect(new Set(s.spells.map(i=>i.id)).size).toBe(s.spells.length);
   expect(s.equips.length).toBe(s.pack?2:3);expect(s.spells.length).toBe(s.order?2:3);if(ch===0)expect(s.order).toBeNull();if(ch===2)expect(s.pack).toBeNull();expect(s.boon).toBeUndefined();
   if(step<2){const before=cloneRun(r);expect(refreshShop(r)).toBe(false);expect(r).toEqual(before);}
  }
 }
});
it('RNG results are deterministic and sampled frequencies follow the broad early/late bias',()=>{
 const counts=[{pack:0,order:0},{pack:0,order:0},{pack:0,order:0}],n=400;
 for(let ch=0;ch<3;ch++)for(let seed=1;seed<=n;seed++){
  const r=newRun('reva',seed);r.chapter=ch;r.node=2;const copy=cloneRun(r);applyResult(r,'win');applyResult(copy,'win');expect(r.shop).toEqual(copy.shop);expect(r.rngState).toBe(copy.rngState);
  counts[ch].pack+=Number(!!r.shop!.pack);counts[ch].order+=Number(!!r.shop!.order);
 }
 for(let ch=0;ch<3;ch++){expect(Math.abs(counts[ch].pack/n-[.75,.25,0][ch])).toBeLessThan(.10);expect(Math.abs(counts[ch].order/n-[0,.5,.75][ch])).toBeLessThan(.10);}
});
it('present goods buy once with exact debit; missing pack/order rejects without any mutation',()=>{
 for(const kind of ['pack','order'] as const){
  const ch=kind==='pack'?0:2;let r=shop(ch,1);for(let seed=2;!r.shop![kind]&&seed<100;seed++)r=shop(ch,seed);const item=r.shop![kind]!;expect(item).toBeTruthy();const price=item.price,points=kind==='pack'?[...r.shop!.pack!.points]:[];
  expect(buy(r,kind)).toBe(true);expect(r.gold).toBe(10-price);expect(item.sold).toBe(true);if(kind==='pack')for(const id of points)expect(r.stash[id]).toBeGreaterThan(0);else expect(r.orders).toContain(r.shop!.order!.id);
  const before=cloneRun(r);expect(buy(r,kind)).toBe(false);expect(r).toEqual(before);
 }
 for(const [ch,kind]of [[0,'order'],[2,'pack']] as const){const r=shop(ch,4),before=cloneRun(r);expect(buy(r,kind)).toBe(false);expect(r).toEqual(before);}
});
it.each([0,1,2])('chapter %i shop saves/reloads the same optional shelf and continues a real battle without rerolling',ch=>{
 store();const r=newRun('reva',42);expect(takeDraft(r,0,0)).toBe('place');r.chapter=ch;r.node=2;applyResult(r,'win');const shelf=structuredClone(r.shop),rng=r.rngState;expect(saveRun(r)).toBe(true);
 let result=loadRun();expect(result.kind).toBe('ok');if(result.kind!=='ok')throw Error();expect(result.run.shop).toEqual(shelf);expect(result.run.rngState).toBe(rng);expect(leaveShop(result.run)).toBe(true);expect(result.run.gold).toBe(10);
 const out=simulate(buildBattle(result.run));expect(out.fault).toBeUndefined();beginBattle(result.run,out.result,out.gold,out.eggStats);expect(finishBattle(result.run)).toBe(true);expect(saveRun(result.run)).toBe(true);result=loadRun();if(result.kind!=='ok')throw Error();expect(result.run.history).toHaveLength(2);expect(saveRun(result.run)).toBe(true);
});
it('legacy rules retain fixed pack/order at all chapters, and old generated shelves are never regenerated on load',()=>{
 for(let ch=0;ch<3;ch++){store();const r=shop(ch,15,true);expect(r.shop!.pack).toBeTruthy();expect(r.shop!.order).toBeTruthy();const old=cloneRun(r);expect(saveRun(r)).toBe(true);const got=loadRun();if(got.kind!=='ok')throw Error();expect(got.run.shop).toEqual(old.shop);expect(got.run.rngState).toBe(old.rngState);expect(refreshShop(got.run)).toBe(true);expect(got.run.shop!.pack).toBeTruthy();expect(got.run.shop!.order).toBeTruthy();}
});
it('null and historically missing optional fields load without repair, invalid pack/order retains raw original',()=>{
 const values=store();const r=shop(1,23,true);delete (r.shop as unknown as Record<string,unknown>).pack;delete (r.shop as unknown as Record<string,unknown>).order;values.set(SAVE_KEY,JSON.stringify(r));const missing=loadRun();expect(missing.kind).toBe('ok');if(missing.kind==='ok'){expect(missing.run.shop!.pack).toBeUndefined();expect(missing.run.shop!.order).toBeUndefined();}
 for(const [field,value]of [['pack',{points:['bogus'],price:4,sold:false}],['pack',{points:['atk'],price:-1,sold:false}],['order',{id:'bogus',price:3,sold:false}],['order',{id:'o_tag',price:1.5,sold:false}]] as const){
  const x=shop(1,24);(x.shop as unknown as Record<string,unknown>)[field]=value;const raw=JSON.stringify(x);values.set(SAVE_KEY,raw);expect(loadRun().kind).toBe('incompatible');expect(values.get(SAVE_KEY)).toBe(raw);
 }
});

it('an already-generated new-rules shelf keeps valid old guaranteed goods despite new chapter exclusions',()=>{
 store();const r=shop(0,31);r.shop!.pack={points:['atk','hp'],price:4,sold:false};r.shop!.order={id:'o_tag',price:4,sold:false};
 // Fixture represents a durable 0.10.0 shelf; loading must not apply 0.10.1 generation rules.
 const shelf=structuredClone(r.shop),rng=r.rngState;expect(saveRun(r)).toBe(true);const result=loadRun();if(result.kind!=='ok')throw Error();expect(result.run.shop).toEqual(shelf);expect(result.run.rngState).toBe(rng);expect(buy(result.run,'order')).toBe(true);expect(result.run.gold).toBe(6);expect(saveRun(result.run)).toBe(true);
});

it('two unit purchases cap a visit, with merges counting but auxiliary goods not counting',()=>{
 const r=shop(1,51);r.gold=30;r.slots[0]={defId:r.shop!.units[0].id,ownedId:20,copies:1};
 // Filled inventory forces the first purchased copy to merge into the existing one-star body.
 r.slots[1]={defId:'n_merc',ownedId:21,copies:4};r.slots[2]={defId:'n_merc',ownedId:22,copies:4};r.slots[3]={defId:'n_merc',ownedId:23,copies:4};r.slots[4]={defId:'n_merc',ownedId:24,copies:4};r.bench=Array.from({length:3},(_,i)=>({defId:'n_merc',ownedId:25+i,copies:4 as const}));r.nextOwnedId=30;
 expect(shopUnitBuysRemaining(r)).toBe(2);expect(buy(r,'units',0)).toBe(true);expect(r.slots[0]!.copies).toBe(2);expect(shopUnitBuysRemaining(r)).toBe(1);
 const before=cloneRun(r);expect(buy(r,'units',1)).toBe(false);expect(r).toEqual(before);expect(r.shop!.unitsBought).toBe(1);
 expect(buy(r,'equips',0)).toBe(true);expect(shopUnitBuysRemaining(r)).toBe(1);r.bench[2]=null;expect(buy(r,'units',1)).toBe(true);expect(shopUnitBuysRemaining(r)).toBe(0);expect(r.shop!.unitsBought).toBe(2);
 r.bench[1]=null;const capped=cloneRun(r);expect(buy(r,'units',2)).toBe(false);expect(r).toEqual(capped);
});
it('missing historical counter is derived from sold offers including all three previous sales',()=>{
 for(const sold of [0,1,2,3]){const r=shop(1,52);delete r.shop!.unitsBought;r.shop!.units.forEach((u,i)=>u.sold=i<sold);expect(shopUnitBuysRemaining(r)).toBe(Math.max(0,2-sold));const before=cloneRun(r);if(sold>=2){expect(buy(r,'units',2)).toBe(false);expect(r).toEqual(before);}else{expect(buy(r,'units',sold)).toBe(true);expect(r.shop!.unitsBought).toBe(sold+1);}}
});
it('unit quota and refresh refusal persist across save/reload and auxiliary purchases',()=>{
 store();const r=shop(1,53);expect(buy(r,'units',0)).toBe(true);expect(saveRun(r)).toBe(true);let loaded=loadRun();if(loaded.kind!=='ok')throw Error();expect(shopUnitBuysRemaining(loaded.run)).toBe(1);expect(buy(loaded.run,'units',1)).toBe(true);expect(saveRun(loaded.run)).toBe(true);loaded=loadRun();if(loaded.kind!=='ok')throw Error();expect(shopUnitBuysRemaining(loaded.run)).toBe(0);
 const before=cloneRun(loaded.run);expect(refreshShop(loaded.run)).toBe(false);expect(buy(loaded.run,'units',2)).toBe(false);expect(loaded.run).toEqual(before);
 loaded.run.gold=20;expect(buy(loaded.run,'spells',0)).toBe(true);expect(shopUnitBuysRemaining(loaded.run)).toBe(0);expect(saveRun(loaded.run)).toBe(true);const again=loadRun();if(again.kind!=='ok')throw Error();expect(shopUnitBuysRemaining(again.run)).toBe(0);
});
it('legacy shops can still buy all three offers and refresh normally',()=>{
 const r=shop(1,54,true);r.gold=30;expect(buy(r,'units',0)).toBe(true);expect(buy(r,'units',1)).toBe(true);expect(buy(r,'units',2)).toBe(true);expect(r.shop!.unitsBought).toBeUndefined();expect(refreshShop(r)).toBe(true);
});
it('historical three-sold shelves load while invalid explicit purchase counters preserve raw saves',()=>{
 const values=store();const r=shop(2,55);delete r.shop!.unitsBought;r.shop!.units.forEach(u=>u.sold=true);values.set(SAVE_KEY,JSON.stringify(r));let loaded=loadRun();if(loaded.kind!=='ok')throw Error();expect(shopUnitBuysRemaining(loaded.run)).toBe(0);expect(saveRun(loaded.run)).toBe(true);
 for(const unitsBought of [-1,0.5,4]){const x=cloneRun(r);x.shop!.unitsBought=unitsBought;const raw=JSON.stringify(x);values.set(SAVE_KEY,raw);expect(loadRun().kind).toBe('incompatible');expect(values.get(SAVE_KEY)).toBe(raw);}
});
