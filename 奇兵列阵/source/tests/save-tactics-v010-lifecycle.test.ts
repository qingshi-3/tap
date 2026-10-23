import { afterEach, describe, expect, it, vi } from 'vitest';
import { simulate } from '../src/core/engine';
import { loadRun, saveRun, SAVE_KEY } from '../src/core/save';
import { allOwned, beginBattle, buildBattle, buy, choosePromo, cloneRun, finishBattle, leaveShop, modernTactics, newRun, screen, type RunState } from '../src/core/run';

/** Synthetic 0.9 modern-economy / legacy-rules saves; not frozen player saves or original-version exports. */
function fixture(general='vulkan'): RunState {
  const r=newRun(general,9017,{legacyRules:true});
  r.contentVersion='0.9.0'; delete r.tacticsVersion; delete r.commandTarget;
  r.slots=[{defId:'m_rex',ownedId:50,copies:2,train:{atk:40,hp:70},equips:['eq_hourglass']},null,null,null,null];
  r.bench=[null,null,null];r.nextOwnedId=51;r.prepUses={};r.prepCommitted=false;r.allocLog=[];
  return r;
}
function storage(r:RunState){
  const values=new Map<string,string>([['zl_expedition_v1',JSON.stringify(r)]]);
  vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,String(v)),removeItem:(k:string)=>values.delete(k)});
  expect(SAVE_KEY).toBe('zl_expedition_v1');return values;
}
function loaded(){const result=loadRun();if(result.kind!=='ok')throw Error(`load=${result.kind}`);return result.run;}
function roundTrip(r:RunState,values:Map<string,string>){
  const before={general:r.general,economy:r.economyVersion,passives:[...r.passives],history:[...r.history],gold:r.gold,inventory:structuredClone(allOwned(r)),wins:r.wins};
  expect(saveRun(r)).toBe(true);expect(values.has('zl_expedition_v1')).toBe(true);
  const next=loaded();expect(modernTactics(next)).toBe(false);expect(next.tacticsVersion).toBeUndefined();
  expect({general:next.general,economy:next.economyVersion,passives:next.passives,history:next.history,gold:next.gold,inventory:allOwned(next),wins:next.wins}).toEqual(before);
  expect(saveRun(next)).toBe(true);return next;
}
function fight(r:RunState){
  const count=r.history.length;const setup=buildBattle(r);
  expect(setup.general?.tacticsVersion).toBeUndefined();
  const out=simulate(setup);expect(out.fault).toBeUndefined();expect(out.result).toBe('win');
  beginBattle(r,out.result,out.gold,out.eggStats);expect(finishBattle(r)).toBe(true);expect(finishBattle(r)).toBe(false);expect(r.history).toHaveLength(count+1);
}
afterEach(()=>vi.unstubAllGlobals());

describe('0.10 loads explicit synthetic 0.9 legacy-rule lifecycle fixtures',()=>{
 it('disabled general keeps a pending exclusive promotion, selects it, fights, saves and re-enters',()=>{
  const raw=fixture();raw.promo=['vulkan_2','vulkan_1','g_pay'];raw.promoCount=0;
  const values=storage(raw),r=loaded();expect(r.general).toBe('vulkan');expect(r.economyVersion).toBe(2);expect(screen(r)).toBe('promo');
  expect(choosePromo(r,0)).toBe(true);expect(r.passives).toContain('vulkan_2');expect(r.promoCount).toBe(1);
  expect(choosePromo(r,0)).toBe(false);fight(r);
  const again=roundTrip(r,values);expect(again.passives).toContain('vulkan_2');expect(again.slots[0]?.equips).toEqual(['eq_hourglass']);
  expect(saveRun(loaded())).toBe(true);
 });
 it('legacy waiting shop boon can still be bought and owned hourglass remains effective after a real next battle',()=>{
  const raw=fixture('faie');raw.node=3;raw.gold=10;
  raw.shop={units:[],equips:[],spells:[],order:{id:'o_named',price:5,sold:false},pack:{points:['atk'],price:2,sold:false},refreshCost:1,boon:{id:'g_store',price:6,sold:false}};
  const values=storage(raw),r=loaded();expect(screen(r)).toBe('shop');expect(r.shop?.boon?.sold).toBe(false);
  expect(buy(r,'boon')).toBe(true);expect(r.gold).toBe(4);expect(r.passives).toContain('g_store');expect(r.shop?.boon?.sold).toBe(true);
  expect(buy(r,'boon')).toBe(false);expect(r.gold).toBe(4);
  const shopping=roundTrip(r,values);expect(shopping.shop?.boon?.sold).toBe(true);
  leaveShop(shopping);expect(screen(shopping)).toBe('prep');
  const before=cloneRun(shopping),out=simulate(buildBattle(shopping));expect(out.fault).toBeUndefined();expect(out.result).toBe('win');
  // The legacy equipment lowers charge2 to1; the purchased legacy boon starts it full.
  expect(out.initial[0].chargeMax).toBe(1);expect(out.afterStart[0].charge).toBe(1);
  beginBattle(shopping,out.result,out.gold,out.eggStats);expect(finishBattle(shopping)).toBe(true);expect(shopping.history).toHaveLength(before.history.length+1);
  const again=roundTrip(shopping,values);expect(again.passives).toContain('g_store');expect(again.slots[0]?.equips).toEqual(['eq_hourglass']);expect(saveRun(loaded())).toBe(true);
 });
 it('saved real pending result settles on load once and continues fighting/saving without replayed rewards',()=>{
  const raw=fixture('hank');const out=simulate(buildBattle(raw));expect(out.fault).toBeUndefined();expect(out.result).toBe('win');
  beginBattle(raw,out.result,out.gold,out.eggStats);expect(raw.pending).not.toBeNull();
  const beforeHistory=raw.history.length,beforeWins=raw.wins,values=storage(raw);
  const r=loaded();expect(r.pending).toBeNull();expect(r.history).toHaveLength(beforeHistory+1);expect(r.wins).toBe(beforeWins+1);expect(r.general).toBe('hank');
  const settled={gold:r.gold,stash:structuredClone(r.stash),history:[...r.history],wins:r.wins,budgetBonus:r.budgetBonus};
  expect(finishBattle(r)).toBe(false);roundTrip(r,values);const again=loaded();
  expect({gold:again.gold,stash:again.stash,history:again.history,wins:again.wins,budgetBonus:again.budgetBonus}).toEqual(settled);
  fight(again);expect(again.history).toHaveLength(beforeHistory+2);roundTrip(again,values);expect(saveRun(loaded())).toBe(true);
 });
});
