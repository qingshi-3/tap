import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import type { GeneralSetup, UnitState, UnitDef } from '../src/core/types';
type Internal={doBeat():void;startPhase():void;flush():void;rotateToRear(u:UnitState):boolean;swapUnits(a:UnitState,b:UnitState):boolean;roundStart():void;summon(src:UnitState,side:0,slot:number,id:string,atk:number,hp:number):UnitState|null;extraAct(u:UnitState,n:number):void};
const inside=(b:Battle)=>b as unknown as Internal;
const body=(ownedId:number)=>({defId:'e_skel',ownedId,copies:1 as const});
function fixture(id:string,commandTarget:number|undefined=11,count=2,rest:Partial<GeneralSetup>={}) {
 const b=new Battle({player:Array.from({length:count},(_,i)=>body(11+i)),enemy:[{defId:'e_skel',atk:1,hp:10000},{defId:'e_skel',atk:1,hp:10000}],general:{id,power:0,passives:[],tacticsVersion:1,commandTarget,...rest}});
 for(const u of b.living(0)){u.hp=u.maxHp=1000;u.atk=2;}
 return b;
}
function step(b:Battle,n=1){if(!b.beat)inside(b).startPhase();for(let i=0;i<n;i++)inside(b).doBeat();}
const acts=(b:Battle,uid=1)=>b.log.flatMap(x=>x.ev.t==='act'&&x.ev.uid===uid?[x.ev]:[]);
const heals=(b:Battle)=>b.log.flatMap(x=>x.ev.t==='heal'&&x.ev.src===undefined?[x.ev]:[]);
function customize(b:Battle,uid:number,patch:Partial<UnitDef>){const old=b.def.bind(b),d={...old(b.u(uid)),...patch};b.def=u=>u.uid===uid?d:old(u);}

describe('0.10齐兰指定实体轮换',()=>{
 it('只授予指定ownedId轮换，实际成功轮换后每回合仅回2生命',()=>{
  const b=fixture('zilan');b.u(1).hp=980;b.addAction(undefined,b.u(1),2);step(b);
  expect(b.hasTrait(b.u(1),'rotate')).toBe(true);expect(b.hasTrait(b.u(2),'rotate')).toBe(false);
  expect(b.living(0).map(u=>u.uid)).toEqual([2,1]);expect(heals(b).map(e=>e.n)).toEqual([2]);
  inside(b).swapUnits(b.u(1),b.u(2));step(b,2);
  expect(heals(b).map(e=>e.n)).toEqual([2]);
 });
 it('独自或已在队尾时轮换不成功，不领治疗；换位也不领',()=>{
  const solo=fixture('zilan',11,1);solo.u(1).hp=900;step(solo);expect(heals(solo)).toEqual([]);
  const tail=fixture('zilan',12);tail.u(2).hp=900;step(tail,2);expect(heals(tail)).toEqual([]);
  inside(tail).swapUnits(tail.u(1),tail.u(2));expect(heals(tail)).toEqual([]);
 });
 it('下一回合重新允许治疗，禁用旧全队回合结束轮转',()=>{
  const b=fixture('zilan');b.u(1).hp=900;step(b,2);
  expect(b.living(0).map(u=>u.uid)).toEqual([2,1]);step(b);
  expect(b.round).toBe(2);expect(b.living(0).map(u=>u.uid)).toEqual([2,1]);
  inside(b).swapUnits(b.u(1),b.u(2));step(b);expect(heals(b).map(e=>e.n)).toEqual([2,2]);
 });
 it('无目标、被售出身份、不在战位的目标都不影响其它实体',()=>{
  for(const target of [undefined,999]){const b=fixture('zilan',target,2,{commandTarget:target});step(b,3);expect(b.living(0).map(u=>u.uid)).toEqual([1,2]);expect(heals(b)).toEqual([]);}
 });
 it('满血首次成功轮换也消耗当回合响应，不借第二次轮换补领',()=>{
  const b=fixture('zilan');inside(b).rotateToRear(b.u(1));b.u(1).hp-=20;
  inside(b).swapUnits(b.u(1),b.u(2));inside(b).rotateToRear(b.u(1));expect(heals(b)).toEqual([]);
 });
 it('重复ownedId不产生两份指令，也不会按同defId重找目标',()=>{
  const b=new Battle({player:[body(11),body(11)],enemy:[{defId:'e_skel',atk:1,hp:1000}],general:{id:'zilan',power:0,passives:[],tacticsVersion:1,commandTarget:11}});
  expect(b.living(0).some(u=>b.hasTrait(u,'rotate'))).toBe(false);
 });
 it('召唤物不继承标记，来源死亡后也不转移',()=>{
  const b=fixture('zilan');const s=inside(b).summon(b.u(1),0,0,'t_shade',2,20)!;
  expect(s.ownedId).toBeUndefined();expect(b.hasTrait(s,'rotate')).toBe(false);
  b.u(1).hp=0;inside(b).flush();expect(b.living(0).every(u=>!b.hasTrait(u,'rotate'))).toBe(true);
 });
});

describe('0.10卡雷奥斯完整行动预算',()=>{
 it('前2回合各加1完整行动，双方正常按行动轮调度，第3回合停止',()=>{
  const b=fixture('kaleos');step(b,7);
  const round1=b.log.filter(x=>x.ev.t==='beat').slice(0,3).map(x=>x.ev.t==='beat'?x.ev.round:0);expect(round1).toEqual([1,1,1]);
  expect(acts(b).filter(e=>e.mode==='extra')).toEqual([]);
  expect(b.log.flatMap(x=>x.ev.t==='actionGain'&&x.ev.uid===1?[x.ev.n]:[])).toEqual([1,1]);
  expect(acts(b).filter(e=>e.mode!=='extra')).toHaveLength(5);expect(b.round).toBe(3);
 });
 it('完整额外行动能积蓄并释放技能，追击不会递归获得预算',()=>{
  const b=fixture('kaleos',11,1);customize(b,1,{traits:{charge:2},chargeSkill:[{op:'dmg',to:'enemyFront',v:[3,3,3]}]});b.u(1).chargeMax=2;b.u(1).charge=0;
  step(b);inside(b).extraAct(b.u(1),0);step(b,2);
  expect(acts(b).map(e=>e.mode)).toEqual(['attack','extra','charge']);
  expect(b.log.filter(x=>x.ev.t==='actionGain'&&x.ev.uid===1)).toHaveLength(1);
 });
 it('冻结消耗当次正常预算但不抹掉获授的另一行动，也不积蓄',()=>{
  const b=fixture('kaleos',11,1);b.u(1).chill=2;b.u(1).charge=0;b.u(1).chargeMax=2;
  step(b);expect(acts(b)).toHaveLength(0);expect(b.u(1).charge).toBe(0);expect(b.u(1).actionsLeft).toBe(1);
  step(b,2);expect(acts(b)).toHaveLength(1);expect(b.u(1).charge).toBe(1);
 });
 it('指定者死后第二回合不把完整行动交给同名幸存者',()=>{
  const b=fixture('kaleos');step(b);b.u(1).hp=0;inside(b).flush();step(b,4);
  expect(b.log.filter(x=>x.ev.t==='actionGain'&&x.ev.uid===2)).toEqual([]);
 });
 it('不重入roundStart重复加预算，无目标不借用其它人，专属旧压轴不启动',()=>{
  const b=fixture('kaleos',11,2,{passives:['kaleos_1','kaleos_3']});step(b);inside(b).roundStart();
  expect(b.log.filter(x=>x.ev.t==='actionGain'&&x.ev.uid===1)).toHaveLength(1);expect(acts(b).filter(x=>x.mode==='extra')).toEqual([]);
  const missing=fixture('kaleos',999);step(missing,5);expect(missing.log.filter(x=>x.ev.t==='actionGain')).toEqual([]);expect(acts(missing).filter(x=>x.mode==='extra')).toEqual([]);
 });
});

describe('新旧标记隔离',()=>{
 it('缺tacticsVersion仍保留旧齐兰全队轮转及卡雷奥斯压轴',()=>{
  const z=fixture('zilan',undefined,2,{tacticsVersion:undefined});step(z,3);expect(z.living(0).map(u=>u.uid)).toEqual([2,1]);
  const k=fixture('kaleos',undefined,1,{tacticsVersion:undefined});step(k);expect(acts(k).some(x=>x.mode==='extra')).toBe(true);
 });
 it('新蕾娃忽略旧专属额外调动但保留一次基础交换',()=>{
  const b=new Battle({player:[body(11)],enemy:[{defId:'e_skel',atk:3,hp:1000},{defId:'e_skel',atk:7,hp:1000},{defId:'e_skel',atk:9,hp:1000}],swaps:[[0,1],[1,2]],general:{id:'reva',power:0,passives:['reva_1','reva_2'],tacticsVersion:1}});
  expect(b.living(1).map(u=>u.uid)).toEqual([3,2,4]);
 });
 it('新萨吉预备目标入场后不获得齐兰/卡雷奥斯标记，基础预备接力保持',()=>{
  const b=new Battle({player:[body(11)],enemy:[{defId:'e_skel',atk:1,hp:10000}],reserve:[body(77)],general:{id:'sajj',power:0,passives:['sajj_3'],tacticsVersion:1,commandTarget:77}});
  b.u(1).hp=0;inside(b).flush();const reserve=b.units.find(u=>u.ownedId===77)!;
  expect(reserve.reserve).toBe(false);expect(b.hasTrait(reserve,'rotate')).toBe(false);expect(reserve.actionsLeft).toBe(1);
 });
});


describe('被动响应分组预算不改变旧cap',()=>{
 function support(count=1) {
  const b=fixture('reva',undefined,2+count);
  for(let uid=3;uid<=2+count;uid++)customize(b,uid,{onAllyFront:[{op:'heal',to:'opponent',v:[2,2,2],responseGroup:'frontCare'},{op:'block',to:'opponent',v:[1,1,1],responseGroup:'frontCare'}]});
  return b;
 }
 it('首个队首满血且格挡已满仍占整组，下一队首不借用治疗预算',()=>{
  const b=support();b.u(1).block=3;b.u(2).hp=900;inside(b).flush();
  expect(heals(b)).toEqual([]);inside(b).rotateToRear(b.u(1));inside(b).flush();
  expect(b.u(2).hp).toBe(900);expect(b.u(2).block).toBe(0);
 });
 it('每来源独立持组，治疗和格挡同一事件均结算',()=>{
  const b=support(2);b.u(1).hp=900;inside(b).flush();
  expect(b.u(1).hp).toBe(904);expect(b.u(1).block).toBe(2);
  inside(b).rotateToRear(b.u(1));inside(b).flush();expect(b.u(2).block).toBe(0);
 });
 it('真实推进下一回合重置组预算，并允许来源自己成为新队首受益',()=>{
  const b=support();b.u(3).hp=900;inside(b).flush();inside(b).rotateToRear(b.u(1));inside(b).flush();
  step(b,4);expect(b.round).toBe(2);inside(b).rotateToRear(b.u(2));inside(b).flush();
  expect(b.front(0)?.uid).toBe(3);expect(b.u(3).hp).toBe(902);expect(b.u(3).block).toBe(1);
 });
 it('没有responseGroup的旧Effect仍分别按有效效果消费cap',()=>{
  const b=fixture('reva',undefined,3);customize(b,3,{onAllyFront:[{op:'heal',to:'opponent',v:[2,2,2],cap:[1,1,1]},{op:'block',to:'opponent',v:[1,1,1],cap:[1,1,1]}]});
  b.u(2).hp=900;inside(b).flush();inside(b).rotateToRear(b.u(1));inside(b).flush();
  expect(b.u(2).hp).toBe(902);expect(b.u(2).block).toBe(0);
 });
});
