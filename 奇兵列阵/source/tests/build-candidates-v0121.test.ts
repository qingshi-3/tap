import {describe,expect,it} from 'vitest';
import {Battle} from '../src/core/engine';
import {unitDef} from '../src/core/data';
import type {EnemyEntry,Slotted,UnitState} from '../src/core/types';
const e=(defId='e_skel',atk=1,hp=100,level=1):EnemyEntry=>({defId,atk,hp,level});
const api=(b:Battle):any=>b;
const make=(player:EnemyEntry[],enemy:EnemyEntry[]=[e()])=>new Battle({player,enemy});
const extras=(b:Battle)=>b.log.filter(x=>x.ev.t==='act'&&x.ev.mode==='extra');
function win(b:Battle,winner:UnitState){api(b).duelKill(winner,b.units.find(u=>u.side!==winner.side)!);api(b).flush();}

describe('0.12.1 build candidates: lord team relay',()=>{
 it.each([1,2,3])('level %i highest living lord shares budget and grants the winning mature duelist pursuit',level=>{
  const b=make([e('s_lord',1,100,1),e('s_lord',1,100,level),e('s_fox',12)], [e('e_skel',1,1000)]);
  const w=b.units[2];for(let i=0;i<4;i++)win(b,w);
  expect(extras(b)).toHaveLength(level===3?2:1);
  expect(extras(b).every(x=>x.ev.t==='act'&&x.ev.uid===w.uid)).toBe(true);
  expect(b.log.filter(x=>x.ev.t==='dmg'&&x.ev.src===w.uid).map(x=>x.ev.t==='dmg'?x.ev.n:0)).toEqual(Array(level===3?2:1).fill(12+level));
 });
 it('keeps opening duel grant and relays a real ordinary kill without consuming normal action',()=>{
  const b=make([e('n_merc',12),e('s_lord',1)], [e('e_skel',1,1),e('e_skel',1,100)]);
  api(b).startPhase();const w=b.units[0],budget=w.actionsLeft;
  expect(b.hasTrait(w,'duel')).toBe(true);api(b).attack([{a:w,bonus:0}]);
  expect(extras(b)).toHaveLength(1);expect(extras(b)[0].ev).toMatchObject({uid:w.uid});expect(w.actionsLeft).toBe(budget);
 });
 it('pursuit kills cannot recursively relay without chain permission',()=>{
  const b=make([e('s_lord',1,100,3),e('s_fox',12)], [e('e_skel',1,1),e('e_skel',1,1),e('e_skel',1,100)]);
  api(b).attack([{a:b.units[1],bonus:0}]);expect(extras(b)).toHaveLength(1);
 });
 it('chain permission allows a second shared-budget relay but never a third',()=>{
  const b=new Battle({player:[e('s_lord',1,100,3),e('s_fox',12)],enemy:[e('e_skel',1,1),e('e_skel',1,1),e('e_skel',1,1),e('e_skel',1,100)],general:{id:'reva',power:0,passives:['g_chain']}});
  api(b).attack([{a:b.units[1],bonus:0}]);expect(extras(b)).toHaveLength(2);
 });
 it.each(['source','winner','isolated'] as const)('rejects %s before queued relay resolves',kind=>{
  const b=make([e('s_lord'),e('s_fox')]),[lord,w]=b.units;
  api(b).duelKill(w,b.units[2]);if(kind==='source')lord.hp=0;else if(kind==='winner')w.hp=0;else api(b).isolated.add(w.uid);
  api(b).flush();expect(extras(b)).toHaveLength(0);
 });
 it('cold cancels the accepted pursuit and still spends shared budget',()=>{
  const b=make([e('s_lord'),e('s_fox',4)]),w=b.units[1];w.chill=5;win(b,w);win(b,w);
  expect(extras(b)).toHaveLength(1);expect(b.log.some(x=>x.ev.t==='frozenSkip'&&x.ev.uid===w.uid)).toBe(true);
  expect(b.log.some(x=>x.ev.t==='dmg'&&x.ev.src===w.uid)).toBe(false);
 });
 it('enemy lords obey the same team limits and the next round restores the team budget',()=>{
  const b=make([e('e_skel',1,1000)],[e('s_lord'),e('s_lord'),e('s_fox',6)]),w=b.units[3];win(b,w);win(b,w);
  expect(extras(b)).toHaveLength(1);for(const u of b.units)u.actionsLeft=0;api(b).prepareWave();win(b,w);
  expect(extras(b)).toHaveLength(2);
 });
});

describe('0.12.1 build candidates: HP-scaled thorns',()=>{
 it.each([1,2,3])('level %i adds floored 20 percent of actual max HP once, on either side',level=>{
  const b=make([e('n_thorn',2,29,level)],[e('n_thorn',2,29,level)]);api(b).startPhase();
  for(const u of b.units)expect(b.thorns(u)).toBe(level+5);
  b.units[0].grants.reborn=true;b.hit(b.units[1],b.units[0],100,'attack');api(b).flush();
  expect(b.units[0].hp).toBe(1);expect(b.thorns(b.units[0])).toBe(level+5);
  api(b).respond(b.units[0],'start',unitDef('n_thorn').onStart,{});expect(b.thorns(b.units[0])).toBe(level+5);
 });
 it('HP training/growth affect real retaliation and never mutate the owned unit',()=>{
  const owned:Slotted={defId:'n_thorn',ownedId:20,copies:1,train:{hp:10},growth:{hp:6}},saved=JSON.stringify(owned);
  const b=new Battle({player:[owned],enemy:[e('e_skel',1,100)]});api(b).startPhase();
  expect(b.units[0].maxHp).toBe(35);expect(b.thorns(b.units[0])).toBe(8);
  api(b).attack([{a:b.units[1],bonus:0}]);expect(b.log.some(x=>x.ev.t==='dmg'&&x.ev.kind==='thorns'&&x.ev.n===8)).toBe(true);
  expect(JSON.stringify(owned)).toBe(saved);expect(b.units[0].grants.thorns).toBe(7);
 });
});

describe('0.12.1 build candidates: safe sacrifice stats',()=>{
 it.each([0,1])('void gains full current attack/max HP on side %i and preserves rebirth/deathrattle',side=>{
  const team=[e('a_void',3,11),e('a_spine',9,15)],b=side?make([e()],team):make(team),v=b.units.find(u=>u.defId==='a_void')!,fodder=b.units.find(u=>u.defId==='a_spine')!;
  fodder.hp=2;api(b).roundStart();expect(v.atk).toBe(12);expect(v.maxHp).toBe(26);expect(v.hp).toBe(26);expect(fodder.hp).toBe(1);expect(fodder.revived).toBe(true);
  expect(b.log.some(x=>x.ev.t==='trigger'&&x.ev.src===fodder.uid&&x.ev.kind==='rattle')).toBe(true);
  api(b).roundStart();expect(v.atk).toBe(21);expect(fodder.alive).toBe(false);
 });
 it('void rejects a normal tail even if heavily invested',()=>{
  const b=make([e('a_void',3),e('n_merc',99)]);api(b).roundStart();expect(b.units[0].atk).toBe(3);expect(b.units[1].alive).toBe(true);
 });
 it.each([0,1])('ritual captures half victim stats before rebirth, ignores spell power and preserves the highest recipient on side %i',side=>{
  const team=[e('a_spine',9,15),e('n_ritualist',1,10,2),e('n_merc',12,20),e('n_merc',4,20)],b=side?make([e()],team):make(team);
  const r=b.units.find(u=>u.defId==='n_ritualist')!,fodder=b.units.find(u=>u.defId==='a_spine')!,receiver=b.units.find(u=>u.defId==='n_merc'&&u.atk===12)!;
  r.grants.power=100;fodder.hp=2;api(b).cast(r,{});api(b).flush();
  expect(receiver.atk).toBe(18);expect(receiver.maxHp).toBe(27);expect(receiver.hp).toBe(27);expect(fodder.hp).toBe(1);expect(fodder.revived).toBe(true);
  expect(b.log.some(x=>x.ev.t==='trigger'&&x.ev.src===fodder.uid&&x.ev.kind==='rattle')).toBe(true);
 });
 it('ritual needs fodder and another receiver; old sacrifice effects gain no inherited stats',()=>{
  const b=make([e('n_merc',9),e('n_ritualist'),e('n_merc',12)]),r=b.units[1];expect(b.canCast(r)).toBe(false);
  b.units[0].grants.reborn=true;api(b).apply(r,[{op:'sacrifice',to:'ahead',v:[2,2,2],requireFodder:true}],{cast:true});api(b).flush();expect(b.units[2].atk).toBe(14);expect(b.units[2].maxHp).toBe(100);
  const c=make([e('a_spine'),e('n_ritualist')]);expect(c.canCast(c.units[1])).toBe(false);
 });
 it('battle sacrifice changes never persist into owned growth/train',()=>{
  const units:Slotted[]=[{defId:'a_spine',copies:1,ownedId:1,growth:{atk:6,hp:8}},{defId:'n_ritualist',copies:1,ownedId:2},{defId:'n_merc',copies:1,ownedId:3,train:{atk:10}}];
  const before=JSON.stringify(units),b=new Battle({player:units,enemy:[e()]});api(b).cast(b.units[1],{});api(b).flush();expect(JSON.stringify(units)).toBe(before);
 });
});
