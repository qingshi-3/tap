import {describe,it,expect} from 'vitest';
import {Battle} from '../src/core/engine';
import {DRAFT_POOL,unitDef} from '../src/core/data';
import {ACTIVE_GENERAL_IDS,TACTIC_IDS,GENERAL_MAP,PASSIVE_MAP,EQUIP_MAP,generalDefinition} from '../src/core/content';
import {COMBOS} from '../src/core/combos';
import {benefitsFromSpellPower,prepEvent} from '../src/core/preparation';
import {newRun} from '../src/core/run';
import type {UnitState} from '../src/core/types';
const E=(defId='e_skel')=>({defId,atk:1,hp:100});
const I=(b:Battle)=>b as unknown as {startPhase():void;flush():void;doBeat():void;summon(src:UnitState,side:0,slot:number,token:string,atk:number,hp:number):UnitState|null};
const kill=(b:Battle,id:number)=>{b.hit(undefined,b.u(id),10000,'fatigue');I(b).flush();};
describe('0.10 content contracts',()=>{
 it('new supply and display versions retain legacy content',()=>{
  expect(ACTIVE_GENERAL_IDS).toEqual(['reva','zilan','sajj','kaleos']);expect(TACTIC_IDS).toHaveLength(12);
  for(const id of TACTIC_IDS)expect(PASSIVE_MAP[id]).toBeDefined();
  expect(Object.keys(GENERAL_MAP)).toHaveLength(13);expect(EQUIP_MAP.eq_hourglass).toBeDefined();expect(PASSIVE_MAP.g_store).toBeDefined();expect(PASSIVE_MAP.zilan_4).toBeDefined();
  const before=structuredClone(GENERAL_MAP);
  for(const id of ['zilan','kaleos']){expect(generalDefinition(id)).toBe(GENERAL_MAP[id]);expect(generalDefinition(id,1)).not.toBe(GENERAL_MAP[id]);}
  expect(GENERAL_MAP).toEqual(before);
  for(const c of COMBOS){expect(ACTIVE_GENERAL_IDS as readonly string[]).toContain(c.general);expect(c.units).toHaveLength(5);expect(c.roles).toHaveLength(5);for(const id of c.units)expect(unitDef(id).unique).not.toBe(true);}
 });
 it('nine individual timing units remain after howler becomes a death relay and rebuilt supports do not feed energy',()=>{
  expect(DRAFT_POOL.filter(d=>d.traits?.charge)).toHaveLength(9);
  for(const id of ['d_keeper','d_hourglass','d_pyro']){const d=unitDef(id);expect(d.special).not.toBe('hourglass');expect(d.tags).not.toContain('给蓄力');expect(d.onAttacked?.some(e=>e.op==='charge')).not.toBe(true);}
 });
 it('keeper shields only the actual new body in a full-field relay',()=>{
  const b=new Battle({player:[E(),E('d_keeper'),E('d_artificer'),E('d_glass'),E()],enemy:[E()]});I(b).startPhase();kill(b,1);
  const t=b.units.find(u=>u.summoned)!;expect(t.block).toBe(1);expect(b.u(2).block).toBe(0);expect(t.actionsLeft).toBe(0);
 });
 it.each([[1,3],[2,4],[3,5]])('keeper star%i caps protection at%i actual summons', (level,cap)=>{
  const b=new Battle({player:[{...E('d_keeper'),level}],enemy:[E()]});I(b).startPhase();
  for(let n=0;n<cap+1;n++){const t=I(b).summon(b.u(1),0,0,'t_wolf',2,2)!;I(b).flush();expect(t.block).toBe(n<cap?1:0);kill(b,t.uid);}
 });
 it('overflow has no new-body shield or summon broadcast',()=>{
  const b=new Battle({player:[E('d_keeper'),E(),E(),E(),E()],enemy:[E()]});I(b).startPhase();expect(I(b).summon(b.u(1),0,0,'t_wolf',2,2)).toBeNull();I(b).flush();expect(b.metrics.summons).toBe(0);expect(b.units.filter(u=>u.side===0).every(u=>u.block===0)).toBe(true);
 });
 it('hourglass heals and shields the identity actually becoming front after death',()=>{
  const b=new Battle({player:[E(),E(),E('d_hourglass')],enemy:[E()]});I(b).startPhase();b.u(2).hp-=5;kill(b,1);expect(b.u(2).hp).toBe(98);expect(b.u(2).block).toBe(1);expect(b.u(3).block).toBe(0);
 });
 it('hourglass spends one combined response even when first-front healing overflows',()=>{
  const b=new Battle({player:[E(),E(),E(),E('d_hourglass')],enemy:[E()]});I(b).startPhase();b.u(3).hp-=5;
  kill(b,1);expect(b.u(2).hp).toBe(100);expect(b.u(2).block).toBe(1);
  kill(b,2);expect(b.u(3).hp).toBe(95);expect(b.u(3).block).toBe(0);
 });
 it('pyro rewards only real spell beneficiaries, twice per prep and never attack',()=>{
  for(const id of ['d_shriek','l_priest','m_shaman','v_chaser','v_snowman','d_howler','m_rex','s_dancer']){
   const r=newRun('reva',81);r.slots=[{defId:'d_pyro',ownedId:1,copies:1},{defId:id,ownedId:2,copies:1},null,null,null];r.prepUses={};const t=r.slots[1]!;
   for(let n=0;n<3;n++)prepEvent(r,'buy',t);expect(t.growth?.power??0).toBe(benefitsFromSpellPower(id)?2:0);expect(t.growth?.atk??0).toBe(0);
  }
 });
});
