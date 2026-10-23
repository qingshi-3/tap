import {type RunState,buildBattle,allOwned} from '../src/core/run';
import {EQUIP_MAP,PASSIVES} from '../src/core/content';
import {playerCombos,type RunOpts,type SimAction} from './simlib';
import {createFormationPolicy,type FormationMode} from './pve-formation-policy';
import {formationBoard,evaluateFormation,type Direction} from './pve-formation-contract';
import {benchmarkPrepare,benchmarkShop,benchmarkCore} from './pve-benchmark-v012-policy';
import {familyPrepare,familyShop,familyCore} from './pve-benchmark-v012-families';
import {buildPrepare,buildShop,buildCore,buildPromo,buildReward,type Build} from './pve-all-builds-v0121-policy';

export const CLOSURE_POLICY_VERSION='formation-then-visible-combat-0.12.1-2-summon-bridge';
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
type CoreSnapshot={ownedId:number;defId:string;train:Record<string,number|undefined>;growth:Record<string,number|undefined>}|null;

/** Preserve the original greedy acquisition until an actual battle has a basic formation.
 * The latch affects the next decision only; it never rewrites that first formation battle.
 */
export function createClosurePolicy(mode:FormationMode){
 const greedy=createFormationPolicy(mode),directed=mode!=='casual'&&mode!=='anti3';
 const direction=mode as Direction;
 const closure={switched:false,firstReadyBattle:null as number|null,switches:[] as {battle:number;firstReadyBattle:number;hook:string;fromCore:CoreSnapshot;toCore:CoreSnapshot}[],decisions:[] as {battle:number;hook:string;phase:'bridge'|'combat';core:CoreSnapshot;basicReady:boolean}[],battles:[] as {battle:number;phase:'formation'|'bridge'|'combat';basicReady:boolean;started:boolean;core:CoreSnapshot}[]};
 let firstReady=false,announced=false;
 let preparedPhase:'formation'|'bridge'|'combat'='formation';
 const oldCore=(r:RunState)=>mode==='multi'?benchmarkCore(r):mode==='summon'||mode==='frost'?familyCore(r,mode):buildCore(r,mode as Build);
 const snapshot=(u:ReturnType<typeof benchmarkCore>):CoreSnapshot=>u?{ownedId:u.ownedId,defId:u.defId,train:{...u.train},growth:{...u.growth}}:null;
 const combatPrepare=(r:RunState,report?: (a:SimAction)=>void)=>mode==='multi'?benchmarkPrepare(r,report):mode==='summon'||mode==='frost'?familyPrepare(r,mode,report):buildPrepare(r,mode as Build,report);
 const combatShop=(r:RunState,report?: (a:SimAction)=>void)=>mode==='multi'?benchmarkShop(r,report):mode==='summon'||mode==='frost'?familyShop(r,mode,report):buildShop(r,mode as Build,report);
 const enter=(r:RunState,hook:string,report?: (a:SimAction)=>void)=>{
  if(!firstReady)return false;
  if(!announced){
   const event={battle:r.history.length+1,firstReadyBattle:closure.firstReadyBattle!,hook,fromCore:snapshot(greedy.selectedCore(r)),toCore:snapshot(oldCore(r))};
   closure.switches.push(event);announced=true;closure.switched=true;
   report?.({battle:event.battle,chapter:r.chapter,node:r.node,type:'closureSwitch',ok:true,goldBefore:r.gold,goldAfter:r.gold,detail:{mode,...event}});
  }
  return true;
 };
 const runHook=(r:RunState,hook:'prepare'|'shop',report?: (a:SimAction)=>void)=>{
  const combat=enter(r,hook,report),bridge=!combat&&mode==='summon'&&!allOwned(r).some(u=>u&&['d_goldob','d_pharaoh'].includes(u.defId));
  if(hook==='prepare')preparedPhase=combat?'combat':bridge?'bridge':'formation';
  if(!combat&&!bridge){(hook==='prepare'?greedy.options.prepare:greedy.options.visitShop)?.(r,report);return;}
  // Before inheritance is owned, use the established combat-body fallback rather
  // than investing indefinitely in a nest of low-output summon sources.
  if(bridge)report?.({battle:r.history.length+1,chapter:r.chapter,node:r.node,type:'closureBridge',ok:true,goldBefore:r.gold,goldAfter:r.gold,detail:{mode,hook,reason:'no owned inheritance source before real formation'}});
  // Old policies already report every mutation. Observe each transaction separately so
  // purchases/sales/merges retain exact growth provenance instead of diffing a whole hook.
  let before=clone(r);
  const observe=(a:SimAction)=>{greedy.observeExternalAction(before,r,a);before=clone(r);report?.(a);};
  (hook==='prepare'?combatPrepare:combatShop)(r,observe);
  if(hook==='prepare')greedy.observeExternalPreparation(r,oldCore(r));
  const f=evaluateFormation(direction,formationBoard(buildBattle(r),greedy.receipts));
  closure.decisions.push({battle:r.history.length+1,hook,phase:bridge?'bridge':'combat',core:snapshot(oldCore(r)),basicReady:f.basicReady});
 };
 const options:typeof greedy.options=directed?{
  ...greedy.options,
  prepare:(r,report)=>runHook(r,'prepare',report),
  visitShop:(r,report)=>runHook(r,'shop',report),
  ...(!['multi','summon','frost'].includes(mode)?{
   chooseTactic:(r:RunState)=>enter(r,'tactic')?buildPromo(r,mode as Build):growthTactic(r),
   chooseEquipmentReward:(r:RunState)=>enter(r,'equipmentReward')?buildReward(r,mode as Build):growthReward(r),
  }:{}),
 }:greedy.options;
 const observeBattle:NonNullable<RunOpts['onBattle']>=(r,setup,out,node)=>{
  greedy.observeBattle?.(r,setup,out,node);
  if(!directed)return;
  const f=evaluateFormation(direction,formationBoard(setup,greedy.receipts)),battle=r.history.length+1;
  closure.battles.push({battle,phase:closure.switched?'combat':preparedPhase,basicReady:f.basicReady,started:f.started,core:snapshot(preparedPhase==='formation'?greedy.selectedCore(r):oldCore(r))});
  if(f.basicReady&&!firstReady){
   firstReady=true;closure.firstReadyBattle=battle;
  }
 };
 return {...greedy,options,observeBattle,closure};
}

// Match simlib's growth defaults before the latch. Hooks must exist from construction:
// playRun receives a spread of options, so adding callbacks after a battle would be lost.
function growthReward(r:RunState){return (r.reward??[]).map((id,i)=>({i,score:(EQUIP_MAP[id]?.atk??0)*1.5+(EQUIP_MAP[id]?.hp??0)*.65+Object.keys(EQUIP_MAP[id]?.grants??{}).length*3})).sort((a,b)=>b.score-a.score)[0]?.i??0;}
function growthTactic(r:RunState){
 if(r.general==='hank'||r.general==='xingjiao'){const weights:Record<string,number>=r.general==='hank'?{hank_4:14,hank_1:r.wins<10?10:2,hank_3:r.wins<10?7:1,hank_2:0}:{xingjiao_1:15,xingjiao_2:4,xingjiao_3:r.genPower>0?10:2,xingjiao_4:8};return (r.promo??[]).map((id,i)=>({i,score:weights[id]??5})).sort((a,b)=>b.score-a.score)[0]?.i??0;}
 const c=playerCombos(allOwned(r).filter((u):u is NonNullable<typeof u>=>!!u));
 return (r.promo??[]).map((id,i)=>{const p=PASSIVES.find(p=>p.id===id),need=p?.need;return {i,score:(p?.general===r.general?5:4)+(need==='charge'&&c.charge||need==='summon'&&c.summon||need==='rattle'&&c.death||need==='chill'&&c.freeze?5:0)+(id==='g_drill'&&r.wins<10?4:0)};}).sort((a,b)=>b.score-a.score)[0]?.i??0;
}

