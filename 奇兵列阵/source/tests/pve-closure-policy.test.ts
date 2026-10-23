import {describe,it,expect} from 'vitest';
import {newRun,buildBattle,currentNode,takeDraft,moveSlot,sell,type RunState} from '../src/core/run';
import {createClosurePolicy} from '../scripts/pve-closure-policy';
import {createFormationPolicy,FORMATION_POLICIES} from '../scripts/pve-formation-policy';
import {evaluateFormation,formationBoard} from '../scripts/pve-formation-contract';
import {buildPromo,buildReward} from '../scripts/pve-all-builds-v0121-policy';
import {familyPrepare} from '../scripts/pve-benchmark-v012-families';

const unit=(defId:string,ownedId:number,train:Record<string,number>={})=>({defId,ownedId,copies:1 as const,train});
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
function fixture(){const r=newRun('sajj',199933377);r.slots=[unit('d_sentry',1),unit('a_devour',2,{power:1}),unit('a_solus',3),unit('a_chanter',4),unit('n_merc',5)];r.bench=[null,null,null];r.draft=[];r.gold=0;r.stash={};r.bag=[];r.upgradeOffers=[];r.nextOwnedId=20;return r;}
const observe=(p:ReturnType<typeof createClosurePolicy>,r:RunState)=>p.observeBattle(r,buildBattle(r),{} as any,currentNode(r));

describe('formation then combat policy',()=>{
 it('does not switch on preview or preparation; latches only an actual ready board and uses old spell placement next time',()=>{
  const r=fixture(),p=createClosurePolicy('spell');
  expect(evaluateFormation('spell',formationBoard(buildBattle(r))).basicReady).toBe(true);
  p.options.prepare!(r);expect(p.closure.switched).toBe(false);expect(p.closure.firstReadyBattle).toBe(null);
  observe(p,r);expect(p.closure.firstReadyBattle).toBe(1);expect(p.closure.switched).toBe(false);
  // Loss of the trio does not unlatch the next combat decision.
  r.slots=r.slots.map(u=>u?.defId==='a_chanter'?null:u);r.history.push({} as any);
  const actions:any[]=[];p.options.prepare!(r,a=>actions.push(a));
  expect(p.closure.switched).toBe(true);expect(p.closure.switches).toHaveLength(1);
  const core=r.slots.findIndex(u=>u?.defId==='a_devour');expect(core).toBeGreaterThan(0);expect(r.slots[core-1]?.defId).toBe('d_sentry');
  expect(actions.every(a=>a.ok)).toBe(true);p.options.prepare!(r);expect(p.closure.switches).toHaveLength(1);
 });
 it('does not switch when actual battle arrangement lacks the protection required by its preview',()=>{
  const r=fixture(),p=createClosurePolicy('spell');r.slots=[r.slots[1],r.slots[3],r.slots[4],r.slots[0],r.slots[2]];
  expect(evaluateFormation('spell',formationBoard(buildBattle(r))).basicReady).toBe(false);
  observe(p,r);expect(p.closure.firstReadyBattle).toBe(null);
 });
 it('routes reward and tactic callbacks after readiness even when options were spread',()=>{
  const r=fixture(),p=createClosurePolicy('spell'),options={...p.options};r.reward=['eq_belt','eq_tome'];r.promo=['g_drill','g_surge'];
  observe(p,r);expect(options.chooseTactic!(r)).toBe(buildPromo(r,'spell'));expect(options.chooseEquipmentReward!(r)).toBe(buildReward(r,'spell'));expect(p.closure.switches).toHaveLength(1);
 });
 for(const mode of ['casual','anti3'] as const)it(mode+' never switches',()=>{const r=fixture(),p=createClosurePolicy(mode);observe(p,r);expect(p.closure.firstReadyBattle).toBe(null);expect(p.closure.switches).toHaveLength(0);expect(p.options.chooseTactic).toBeUndefined();});
 it('bridges summon acquisition without inheritance, resumes greedy when it is owned, and latches only actual readiness',()=>{
  const r=fixture(),p=createClosurePolicy('summon');r.slots=[unit('d_dune',1,{atk:2}),unit('a_seed',2),unit('n_merc',3),null,null];
  const expected=copy(r);familyPrepare(expected,'summon');const actions:any[]=[];p.options.prepare!(r,a=>actions.push(a));
  expect(r).toEqual(expected);expect(actions.some(a=>a.type==='closureBridge')).toBe(true);expect(p.closure.decisions.at(-1)?.phase).toBe('bridge');expect(p.closure.switched).toBe(false);expect(p.closure.firstReadyBattle).toBe(null);
  observe(p,r);expect(p.closure.battles.at(-1)?.phase).toBe('bridge');expect(p.closure.firstReadyBattle).toBe(null);
  r.bench[0]=unit('d_goldob',10);const count=p.closure.decisions.length;actions.length=0;p.options.prepare!(r,a=>actions.push(a));
  expect(actions.some(a=>a.type==='closureBridge')).toBe(false);expect(p.closure.decisions).toHaveLength(count);expect(p.closure.firstReadyBattle).toBe(null);
  expect(evaluateFormation('summon',formationBoard(buildBattle(r),p.receipts)).basicReady).toBe(true);observe(p,r);expect(p.closure.firstReadyBattle).toBe(1);expect(p.closure.switched).toBe(false);
  // Once actually ready, losing the inheritance source cannot return to the bridge.
  r.slots=r.slots.map(u=>u?.defId==='d_goldob'?null:u);r.bench=r.bench.map(u=>u?.defId==='d_goldob'?null:u);r.history.push({} as any);p.options.prepare!(r);
  expect(p.closure.switched).toBe(true);expect(p.closure.decisions.at(-1)?.phase).toBe('combat');expect(p.closure.switches).toHaveLength(1);
 });
 for(const mode of FORMATION_POLICIES.filter(m=>m!=='casual'&&m!=='summon'))it(mode+' preserves pre-readiness greedy decisions',()=>{
  const a=newRun('sajj',199933377),b=copy(a),greedy=createFormationPolicy(mode),closure=createClosurePolicy(mode);const aa:any[]=[],bb:any[]=[];
  greedy.options.prepare!(a,x=>aa.push(x));closure.options.prepare!(b,x=>bb.push(x));expect(b).toEqual(a);expect(bb).toEqual(aa);expect(closure.receipts).toEqual(greedy.receipts);
 });
});

describe('external transaction provenance',()=>{
 it('captures a purchase receipt, moves its target through a real merge, and captures final endPrep growth once',()=>{
  const r=fixture(),p=createFormationPolicy('spell');r.slots=[unit('d_pyro',1),unit('a_devour',2),unit('a_solus',3),null,null];r.draft=['a_devour'];r.gold=3;
  let before=copy(r);expect(takeDraft(r,0,3)).not.toBe('invalid');
  p.observeExternalAction(before,r,{battle:1,chapter:r.chapter,node:r.node,type:'buy',ok:true,goldBefore:3,goldAfter:0,detail:{}});
  const bought=r.slots[3]!;expect(p.receipts.some(x=>x.sourceOwnedId===1&&x.targetOwnedId===bought.ownedId&&x.event==='buy'&&x.stat==='power')).toBe(true);
  before=copy(r);expect(moveSlot(r,3,1)).toBe('merge');
  p.observeExternalAction(before,r,{battle:1,chapter:r.chapter,node:r.node,type:'merge',ok:true,goldBefore:0,goldAfter:0,detail:{from:3,to:1}});
  expect(p.receipts.some(x=>x.targetOwnedId===bought.ownedId)).toBe(false);expect(p.receipts.some(x=>x.targetOwnedId===2&&x.event==='buy')).toBe(true);
  p.observeExternalPreparation(r,r.slots[1]!);expect(p.receipts.some(x=>x.sourceOwnedId===3&&x.targetOwnedId===2&&x.event==='endPrep')).toBe(true);expect(p.metrics.purchases).toBe(1);const count=p.receipts.length;p.observeExternalPreparation(r,r.slots[1]!);expect(p.receipts).toHaveLength(count);
 });
 it('preserves sold-source provenance and remaps a merged growth source without inventing another buy',()=>{
  const r=fixture(),p=createFormationPolicy('spell');r.slots=[unit('d_pyro',1),unit('d_pyro',6),unit('a_devour',2),unit('n_archer',7),null];r.draft=['a_devour'];r.gold=3;
  let before=copy(r);expect(takeDraft(r,0,5)).not.toBe('invalid');const bought=r.bench[0]!;
  p.observeExternalAction(before,r,{battle:1,chapter:r.chapter,node:r.node,type:'specialBuy',ok:true,goldBefore:3,goldAfter:0,detail:{}});
  expect(p.receipts.filter(x=>x.targetOwnedId===bought.ownedId&&x.event==='buy')).toHaveLength(2);
  before=copy(r);expect(moveSlot(r,0,1)).toBe('merge');p.observeExternalAction(before,r,{battle:1,chapter:r.chapter,node:r.node,type:'merge',ok:true,goldBefore:0,goldAfter:0,detail:{from:0,to:1}});
  expect(p.receipts.filter(x=>x.event==='buy')).toHaveLength(2);expect(p.receipts.every(x=>x.sourceOwnedId===6)).toBe(true);
  before=copy(r);const gold=r.gold;expect(sell(r,3)).toBe(true);p.observeExternalAction(before,r,{battle:1,chapter:r.chapter,node:r.node,type:'sell',ok:true,goldBefore:gold,goldAfter:r.gold,detail:{slot:3}});
  expect(p.receipts.some(x=>x.sourceOwnedId===7&&x.targetOwnedId===2&&x.event==='sell'&&x.stat==='atk')).toBe(true);
 });

});
