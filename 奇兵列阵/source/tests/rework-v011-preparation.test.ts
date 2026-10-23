import {expect,it} from 'vitest';
import {newRun,allocPoint,deallocPoint,sell,cloneRun,applyResult,moveSlot} from '../src/core/run';
import {commitPreparation,previewPreparation,prepEvent,preparationChanged} from '../src/core/preparation';
import type {Slotted} from '../src/core/types';
const u=(defId:string,ownedId:number):Slotted=>({defId,ownedId,copies:1});
it('attack and block investment preview training once, refund cancels, and preview never commits allowances',()=>{
 const r=newRun('reva',72);r.slots=[u('n_gladiator',10),null,null,null,null];r.nextOwnedId=11;r.stash={atk:2,block:1};
 expect(allocPoint(r,0,'atk')).toBe(true);expect(allocPoint(r,0,'block')).toBe(true);
 const old=cloneRun(r);for(let i=0;i<3;i++){const p=previewPreparation(r);expect(p.slots[0]!.growth).toEqual({atk:1,hp:1});expect(r).toEqual(old);}
 expect(deallocPoint(r,0,'atk')).toBe(true);expect(previewPreparation(r).slots[0]!.growth).toEqual({atk:1,hp:1});
 expect(deallocPoint(r,0,'block')).toBe(true);expect(previewPreparation(r).slots[0]!.growth).toBeUndefined();
 expect(allocPoint(r,0,'atk')).toBe(true);expect(allocPoint(r,0,'atk')).toBe(true);commitPreparation(r);expect(r.slots[0]!.growth).toEqual({atk:1,hp:1});
 preparationChanged(r);commitPreparation(r);expect(r.slots[0]!.growth).toEqual({atk:1,hp:1});
});
it('sale growth is not a training event and does not recursively reward gladiator',()=>{
 const r=newRun('reva',73);r.slots=[u('a_imp',10),u('n_gladiator',11),null,null,null];r.nextOwnedId=12;
 expect(sell(r,0)).toBe(true);expect(r.slots[1]!.growth).toEqual({atk:1});commitPreparation(r);expect(r.slots[1]!.growth).toEqual({atk:1});
});
it('ranked power benefit recipient filters before picking the lowest stat',()=>{
 const r=newRun('reva',74);r.slots=[u('n_obelisk',10),u('m_egg',11),u('a_chanter',12),u('v_guard',13),u('s_caster',14)];
 prepEvent(r,'sell',u('a_devour',20),5);expect(r.slots[1]!.growth).toBeUndefined();expect(r.slots[3]!.growth).toBeUndefined();
 expect(r.slots[4]!.growth?.power).toBe(1);
});
it('cold end-prep growth requires adjacent powered cold spells, not purchases or passive cold',()=>{
 for(const id of ['v_guard','v_shard','v_snowman','n_envoy','v_chaser','v_stag','v_mage']) {
  const r=newRun('reva',75),caster=u(id,21),far=u('v_chaser',22);
  r.slots=[caster,u('v_conduit',10),null,far,null];
  prepEvent(r,'buy',caster);expect(caster.growth).toBeUndefined();
  commitPreparation(r);
  expect(caster.growth?.power).toBe(['v_chaser','v_stag','v_mage'].includes(id)?1:undefined);
  expect(far.growth).toBeUndefined();commitPreparation(r);
  expect(caster.growth?.power).toBe(['v_chaser','v_stag','v_mage'].includes(id)?1:undefined);
 }
});
it('solus supports charged damage but does not put power on adjacent utility spells',()=>{
 const r=newRun('reva',76);r.slots=[u('a_chanter',10),u('a_solus',11),u('n_envoy',12),null,null];
 commitPreparation(r);expect(r.slots[0]!.growth?.power).toBe(1);expect(r.slots[2]!.growth).toBeUndefined();
});
it('ending a second prep is a real growth window, moving units cannot reset the current allowance',()=>{
 const r=newRun('reva',77);r.slots=[u('n_gladiator',10),u('n_paragon',11),u('s_wind',12),null,null];
 commitPreparation(r);const first=cloneRun(r);moveSlot(r,0,2);commitPreparation(r);
 expect(r.slots[2]!.growth).toEqual(first.slots[0]!.growth);expect(r.slots[0]!.growth).toEqual(first.slots[2]!.growth);
 applyResult(r,'win');commitPreparation(r);expect(r.slots[0]!.growth?.atk).toBe(3);expect(r.slots[2]!.growth?.hp).toBe(4);
});
