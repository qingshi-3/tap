import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import { unitDef } from '../src/core/data';
import type { EnemyEntry } from '../src/core/types';
const E=(defId='e_skel', extra:Partial<EnemyEntry>={})=>({defId,atk:1,hp:100,...extra});
const internal=(b:Battle)=>b as unknown as {startPhase():void;flush():void;doBeat():void};
const fixture=(front='e_skel')=>new Battle({player:[E(front),E('d_artificer'),E('d_glass'),E(),E()],enemy:[E()]});
function kill(b:Battle, ids:number[]){for(const id of ids)b.hit(undefined,b.u(id),10000,'ability');internal(b).flush();}
function nextRound(b:Battle){const r=b.round;for(let i=0;b.round===r&&i<20;i++)internal(b).doBeat();}
const summons=(b:Battle)=>b.log.filter(x=>x.ev.t==='summon'&&x.ev.src===2);
describe('构装学徒阵亡接力候选',()=>{
 it('满编队友阵亡腾位后真实入场，镜沙只响应一次且新兵不立即行动',()=>{
  const b=fixture();internal(b).startPhase();kill(b,[1]);
  expect(summons(b)).toHaveLength(1);expect(b.metrics.summons).toBe(1);
  const token=b.units.find(u=>u.summoned)!;expect(token).toMatchObject({atk:2,maxHp:2,actionsLeft:0});
  expect(b.u(3).atk).toBe(2);expect(b.standing(0)).toHaveLength(5);
 });
 it('同回合同时两死亡最多一次，下回合第二次，本场第三次不再生产',()=>{
  const b=fixture();internal(b).startPhase();kill(b,[1,4]);expect(summons(b)).toHaveLength(1);
  nextRound(b);kill(b,[5]);expect(summons(b)).toHaveLength(2);
  nextRound(b);const t=b.units.find(u=>u.summoned&&u.alive)!;kill(b,[t.uid]);expect(summons(b)).toHaveLength(2);
 });
 it('学徒与队友同时阵亡不响应；无人阵亡时正常普攻而非免费产兵',()=>{
  const b=fixture();internal(b).startPhase();kill(b,[1,2]);expect(summons(b)).toHaveLength(0);
  const c=fixture();internal(c).startPhase();for(let i=0;i<3;i++)internal(c).doBeat();
  expect(summons(c)).toHaveLength(0);expect(c.log.some(x=>x.ev.t==='act'&&x.ev.uid===2&&x.ev.mode==='attack')).toBe(true);
 });
 it.each(['a_seed','a_spine'])('亡语或复生%s先占满：溢出不冒充召唤，不给镜沙事件',front=>{
  const b=fixture(front);internal(b).startPhase();kill(b,[1]);
  const expected=front==='a_seed'?1:0;
  expect(b.metrics.summons).toBe(expected);expect(summons(b)).toHaveLength(0);
  expect(b.u(3).atk).toBe(1+expected);
 });
 it('同预算五人旧/新隔离对照：无预留空位，旧版等自己行动仍因满场普攻，新版死亡腾位可接力',()=>{
  const d=unitDef('d_artificer'),saved={cast:d.cast,castUses:d.castUses,onAllyFaint:d.onAllyFaint};
  let old:Battle; let oldInitial:unknown;
  try{d.onAllyFaint=undefined;d.cast=[{op:'summon',to:'self',v:[2,3,4],v2:[2,3,4],token:'t_dervish'}];d.castUses=[2,2,2];
   old=fixture();oldInitial=old.snap().filter(u=>u.side===0).map(u=>[u.defId,u.atk,u.maxHp]);internal(old).startPhase();internal(old).doBeat();internal(old).doBeat();expect(old.metrics.summons).toBe(0);
   expect(old.log.some(x=>x.ev.t==='act'&&x.ev.uid===2&&x.ev.mode==='attack')).toBe(true);
   kill(old,[1]);expect(old.metrics.summons).toBe(0);
  }finally{Object.assign(d,saved);}
  const candidate=fixture();const candidateInitial=candidate.snap().filter(u=>u.side===0).map(u=>[u.defId,u.atk,u.maxHp]);internal(candidate).startPhase();internal(candidate).doBeat();internal(candidate).doBeat();kill(candidate,[1]);
  expect(candidate.metrics.summons).toBe(1);expect(candidateInitial).toEqual(oldInitial);
 });
});
