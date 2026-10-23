import {describe,it,expect} from 'vitest';
import {Battle} from '../src/core/engine';
import {unitDef} from '../src/core/data';
import type {EnemyEntry,Effect} from '../src/core/types';
const e=(defId:string,atk=1,hp=1000):EnemyEntry=>({defId,atk,hp});
const api=(b:Battle):any=>b;
const extra=(b:Battle)=>b.log.filter(x=>x.ev.t==='act'&&x.ev.mode==='extra');
function fixture(effects:Effect[],fn:()=>void){const d=unitDef('a_spine'),old=d.onRattle;d.onRattle=effects;try{fn();}finally{d.onRattle=old;}}
function ritual(side=0,fodder='a_spine',surge=false){const team=[e(fodder,5,21),e('n_ritualist'),e('n_merc',12)];return new Battle({player:side?[e('t_statue')]:team,enemy:side?team:[e('t_statue')],general:surge?{id:'reva',power:0,passives:['g_surge']}:undefined});}
function castReal(b:Battle){const r=b.units.find(u=>u.defId==='n_ritualist')!;for(const u of b.units)if(u.side===r.side&&u!==r)u.actionsLeft=0;api(b).doBeat();return r;}

describe('paid sacrifice pursuit: death queue and real action contracts',()=>{
 it.each([0,1])('void on side %i pursues only after rebirth and deathrattle, then retains its regular action',side=>{
  const team=[e('a_void',6),e('a_spine',5,21)],b=new Battle({player:side?[e('t_statue')]:team,enemy:side?team:[e('t_statue')]}),v=b.units.find(u=>u.defId==='a_void')!;
  const budget=v.actionsLeft;api(b).roundStart();expect(v.actionsLeft).toBe(budget);expect(extra(b)).toHaveLength(1);
  const ev=b.log.map(x=>x.ev),p=ev.findIndex(x=>x.t==='act'&&x.mode==='extra');expect(ev.findIndex(x=>x.t==='revive')).toBeLessThan(p);expect(ev.findIndex(x=>x.t==='trigger'&&x.kind==='rattle')).toBeLessThan(p);
  expect(ev.slice(0,p).some(x=>x.t==='dmg'&&x.kind==='ability')).toBe(true);
 });
 it.each([0,1])('ritual side %i regular cast pays a real victim and preserves recipient normal budget',side=>{
  const b=ritual(side),r=b.units.find(u=>u.defId==='n_ritualist')!,receiver=b.units.find(u=>u.defId==='n_merc')!,budget=receiver.actionsLeft;
  api(b).cast(r,{});api(b).flush();expect(receiver.actionsLeft).toBe(budget);expect(extra(b)).toHaveLength(1);expect(extra(b)[0].ev).toMatchObject({uid:receiver.uid});
  const ev=b.log.map(x=>x.ev),p=ev.findIndex(x=>x.t==='act'&&x.mode==='extra');expect(ev.findIndex(x=>x.t==='revive')).toBeLessThan(p);expect(ev.findIndex(x=>x.t==='trigger'&&x.kind==='rattle')).toBeLessThan(p);
 });
 it('a real regular cast and summoned deathrattle complete before recipient pursuit',()=>{
  const b=ritual(0,'a_seed');const r=castReal(b),ev=b.log.map(x=>x.ev),p=ev.findIndex(x=>x.t==='act'&&x.mode==='extra');
  expect(ev.some(x=>x.t==='act'&&x.uid===r.uid&&x.mode==='cast')).toBe(true);expect(r.actionsLeft).toBe(0);expect(ev.findIndex(x=>x.t==='summon')).toBeLessThan(p);expect(p).toBeGreaterThan(0);
 });
 it.each(['source','recipient'])('no pursuit when the %s dies in the paid victim deathrattle',which=>fixture([{op:'dmg',to:which==='source'?'lowest':'highestAtk',v:[5000,5000,5000]}],()=>{
  const b=ritual(),r=b.units.find(u=>u.defId==='n_ritualist')!;r.hp=1;api(b).cast(r,{});api(b).flush();expect(extra(b)).toHaveLength(0);
 }));
 it('void does not pursue when its paid victim deathrattle kills it',()=>fixture([{op:'dmg',to:'highestAtk',v:[5000,5000,5000]}],()=>{
  const b=new Battle({player:[e('a_void',20),e('a_spine',5)],enemy:[e('t_statue')]});api(b).roundStart();expect(extra(b)).toHaveLength(0);expect(b.units[0].alive).toBe(false);
 }));
 it('cold skips the paid recipient pursuit without consuming normal action',()=>{
  const b=ritual(),r=b.units[1],receiver=b.units[2];receiver.chill=100;const budget=receiver.actionsLeft;api(b).cast(r,{});api(b).flush();
  expect(extra(b)).toHaveLength(1);expect(b.log.some(x=>x.ev.t==='frozenSkip'&&x.ev.uid===receiver.uid)).toBe(true);expect(receiver.actionsLeft).toBe(budget);expect(b.log.some(x=>x.ev.t==='attack')).toBe(false);
 });
 it('isolated recipients do not receive a pursuit',()=>{
  const b=ritual();api(b).isolated.add(b.units[2].uid);api(b).cast(b.units[1],{});api(b).flush();expect(extra(b)).toHaveLength(0);
 });
 it('no eligible victim or no third recipient means no sacrifice pursuit',()=>{
  const b=ritual(0,'n_merc');castReal(b);expect(b.log.some(x=>x.ev.t==='sacrifice')).toBe(false);expect(extra(b)).toHaveLength(0);
  const c=new Battle({player:[e('a_spine'),e('n_ritualist')],enemy:[e('t_statue')]});api(c).cast(c.units[1],{});api(c).flush();expect(extra(c)).toHaveLength(0);
  const d=new Battle({player:[e('a_void'),e('n_merc')],enemy:[e('t_statue')]});api(d).roundStart();expect(extra(d)).toHaveLength(0);
 });
 it('copied casts need another real victim and cannot manufacture a second free pursuit',()=>{
  const b=ritual(0,'a_imp',true);castReal(b);expect(b.log.filter(x=>x.ev.t==='sacrifice')).toHaveLength(1);expect(extra(b)).toHaveLength(1);expect(b.metrics.casts).toBe(1);
 });
 it('a copied cast may pay a second actual reborn victim but cannot recurse beyond the existing chain',()=>{
  const b=ritual(0,'a_spine',true);castReal(b);expect(b.log.filter(x=>x.ev.t==='sacrifice')).toHaveLength(2);expect(extra(b)).toHaveLength(2);expect(b.metrics.casts).toBe(2);
  const c=ritual();api(c).chain=1;api(c).cast(c.units[1],{});api(c).flush();expect(c.log.filter(x=>x.ev.t==='sacrifice')).toHaveLength(1);expect(extra(c)).toHaveLength(0);
 });
 it('terminal deathrattle leaves no enemy target and produces no empty pursuit',()=>{
  const b=new Battle({player:[e('a_spine',5),e('n_ritualist'),e('n_merc',12)],enemy:[e('e_skel',1,1)]});api(b).cast(b.units[1],{});api(b).flush();expect(extra(b)).toHaveLength(0);
 });
 it('older explicit sacrifice effects remain buff-only without pursuit opt-in',()=>{
  const b=ritual();api(b).apply(b.units[1],[{op:'sacrifice',to:'ahead',v:[2,2,2],requireFodder:true}],{});api(b).flush();expect(extra(b)).toHaveLength(0);
 });
});
