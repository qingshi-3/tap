import {describe,it,expect} from 'vitest';
import {newRun,allOwned} from '../src/core/run';
import {benefitsFromSpellPower} from '../src/core/preparation';
import {unitDef} from '../src/core/data';
import {playRun} from './simlib';
import {benchmarkPrepare,benchmarkShop,benchmarkCore,benchmarkArrange} from './pve-benchmark-v012-policy';
describe('legal benchmark growth policy',()=>{
 it('does not designate an ordinary first purchase as the combo core',()=>{
  const r=newRun('reva',731930583);benchmarkPrepare(r);
  expect(allOwned(r).some(u=>u?.defId==='n_bulwark')).toBe(true);
  expect(benchmarkCore(r)).toBeUndefined();
 });
 it('retains and grows a legally acquired core over real battles, with paid transactions',()=>{
  const trace:{id:number;atk:number;growth:number}[]=[];let failed=0,budget=0,mentor=false;
  const out=playRun({general:'reva',seed:731590301,requireLegalGeneral:true,prepare:benchmarkPrepare,visitShop:benchmarkShop,playerPolicy:'growth',onAction:a=>{if(!a.ok)failed++;if(a.goldAfter<0)budget++;},onBattle:(r)=>{const c=benchmarkCore(r);if(c)trace.push({id:c.ownedId,atk:c.train?.atk??0,growth:c.growth?.atk??0});if(r.slots.some(u=>u?.defId==='s_choreo'))mentor=true;}});
  expect(out.faults).toBe(0);expect(failed).toBe(0);expect(budget).toBe(0);expect(trace.length).toBeGreaterThan(10);expect(new Set(trace.map(x=>x.id)).size).toBe(1);expect(trace.at(-1)!.atk).toBeGreaterThan(0);expect(trace.at(-1)!.growth).toBeGreaterThan(trace[0].growth);expect(mentor).toBe(true);
 });
 it('spreads capped block, filters useless equipment and preserves Zilan frontline guard',()=>{
  let blocks=0,orders=0,nonCoreOrders=0;
  const out=playRun({general:'zilan',seed:742480170,requireLegalGeneral:true,prepare:benchmarkPrepare,visitShop:benchmarkShop,playerPolicy:'growth',onAction:a=>{
   if(a.type==='train'&&a.detail.point==='block'){blocks++;expect(Number(a.detail.blocksBefore)).toBeLessThan(3);}
   if(a.type==='equip'){const owned=a.detail.owned as any[];const target=owned.find(u=>u.slot===a.detail.slot);if(a.detail.id==='eq_tome')expect(benefitsFromSpellPower(target.defId)).toBe(true);if(a.detail.id==='eq_combo')expect(unitDef(target.defId).traits?.combo).not.toBe(true);}
  },onBattle:r=>{if(r.slots.filter(Boolean).length>1)expect(r.commandTarget).not.toBe(r.slots[0]?.ownedId);if(r.commandTarget!==null){orders++;if(r.commandTarget!==benchmarkCore(r)?.ownedId)nonCoreOrders++;}}});
  expect(out.faults).toBe(0);expect(blocks).toBeGreaterThan(0);expect(orders).toBeGreaterThan(0);expect(nonCoreOrders).toBeGreaterThan(0);
 });

 it('places a fallback breaker core once even though breaker also belongs to the before-core category',()=>{const r=newRun('zilan',1894390567);r.gold=0;r.draft=[];r.slots=['l_martyr','a_devour','v_wall','n_breaker','m_hide'].map((defId,i)=>({defId,copies:1,ownedId:i+1,...(defId==='n_breaker'?{train:{atk:10}}:{})}));r.bench=[null,null,null];expect(benchmarkCore(r)).toBeUndefined();expect(()=>benchmarkArrange(r)).not.toThrow();expect(r.slots.filter(Boolean)).toHaveLength(5);expect(new Set(r.slots.map(u=>u?.ownedId)).size).toBe(5);expect(r.gold).toBe(0);});

});

