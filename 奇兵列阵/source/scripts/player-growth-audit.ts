declare const process:{env:Record<string,string|undefined>};
// @ts-expect-error Node host.
import {openSync,writeSync,closeSync,mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
// @ts-expect-error Node host.
import {createHash} from 'node:crypto';
import {GENERALS,unitDef} from '../src/core/data';
import {battleNo,currentStage,generalChoices,allOwned} from '../src/core/run';
import {simulate,levelStats} from '../src/core/engine';
import {playRun,playerValue,playerRoute,playerSelectedRoute,playerCombos,playerBattery,type PlayerPolicy,type SimAction} from './simlib';
import type {Slotted} from '../src/core/types';
import type {BattleSetup} from '../src/core/engine';

const folder=process.env.AUDIT_OUTPUT??'../output/strength-audit-20261022/player';mkdirSync(folder,{recursive:true});
const phase=process.env.AUDIT_PHASE??'calibration',count=Number(process.env.AUDIT_COUNT??(phase==='holdout'?20:10));
const recovery=phase==='recovery',ablation=phase==='ablation';
const legacyAuditClassifier=process.env.LEGACY_AUDIT_CLASSIFIER==='1';
const policies:PlayerPolicy[]=phase==='shop-sensitivity'?['upgrade']:phase==='coverage-charge'?['mechanism']:phase==='casual'?['casual']:['growth','upgrade','mechanism'];
const generals=GENERALS.filter(g=>!process.env.AUDIT_GENERALS||process.env.AUDIT_GENERALS.split(',').includes(g.id));
const fd=openSync(`${folder}/${phase}-battles.jsonl`,'w'),runfd=openSync(`${folder}/${phase}-runs.jsonl`,'w'),offfd=openSync(`${folder}/${phase}-offline.jsonl`,'w');
const emit=(file:number,data:unknown)=>writeSync(file,JSON.stringify(data)+'\n');
const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const files=[...readdirSync('src/core').filter((x:string)=>x.endsWith('.ts')).map((x:string)=>`src/core/${x}`),'scripts/simlib.ts','scripts/player-growth-audit.ts'];
const hashes=Object.fromEntries(files.map(p=>[p,hash(p)]));
const summary:Record<string,any>={};let runs=0,battles=0,failed=0,illegal=0,faults=0;const start=Date.now();
const seeds=(general:string)=> {const values:number[]=[];for(let n=0;values.length<30;n++){const seed=(Number(process.env.AUDIT_SEED_BASE??23010011)+n*104729)|0;if(generalChoices(seed).includes(general))values.push(seed);}return values;};
for(const general of generals) {
 const chosen=seeds(general.id).slice(phase==='holdout'?10:0,phase==='holdout'?10+count:count);
 for(const [index,seed] of chosen.entries())for(const policy of policies)for(const shopPolicy of (phase==='shop-sensitivity'?['boon','equipment'] as const:[undefined]))for(const recoveryMode of (phase==='recovery-effective'?['skipFirstIntendedRefresh'] as const:recovery?['wrongBuy','skipRefresh'] as const:[undefined])) {
  const id=`${phase}/${general.id}/${seed}/${policy}/${recoveryMode??shopPolicy??'normal'}`;
  let actions:SimAction[]=[],seen=new Map<string,number>(),attempt=0;const firstCombo:Record<string,number>={};let refreshes=0;
  const result=playRun({general:general.id,seed,requireLegalGeneral:true,playerPolicy:policy,legacyAuditClassifier,shopPolicy,chargeIntent:phase==='coverage-charge',heroRefinement:true,recordBattles:true,recovery:recoveryMode,
   onAction:a=> {
    actions.push(a);if(!a.ok)failed++;
    const expected=['buy','recoveryBuy','signMerc'].includes(a.type)?3:a.type==='refresh'?1:['sell','recoverySell'].includes(a.type)?-Number(a.detail.price):['specialBuy','hireMerc'].includes(a.type)?Number(a.detail.price):0;
    if(a.goldAfter<0||(!a.ok&&a.goldAfter!==a.goldBefore)||(a.ok&&Number.isFinite(expected)&&a.goldBefore-a.goldAfter!==expected))illegal++;
    if(a.type==='refresh')refreshes++;
   },
   onBattle:(r,setup,out,node)=> {
    attempt++;battles++;const key=`${r.chapter+1}:${r.node+1}:${r.forkPick??'main'}:${node.name}`;const retry=seen.get(key)??0;seen.set(key,retry+1);
    const owned=allOwned(r).filter((u):u is Slotted=>!!u),field=setup.player.filter((u):u is Slotted=>!!u&&'ownedId' in u);
    const combo=playerCombos(field,legacyAuditClassifier);for(const [k,v]of Object.entries(combo))if(v)firstCombo[k]??=attempt;
    if(combo.summon&&combo.summonPayoff)firstCombo.summonPair??=attempt;if(combo.charge&&combo.battery)firstCombo.chargePair??=attempt;
    const rows=field.map(u=>({id:u.defId,ownedId:u.ownedId,star:u.copies===4?3:u.copies===2?2:1,tier:unitDef(u.defId).tier,...playerValue(u),train:u.train,growth:u.growth,equips:u.equips}));
    const enemy=setup.enemy.flatMap(u=>{if(!u)return[];const d=unitDef(u.defId),s=levelStats(u.defId,u.level??1);return[{id:u.defId,atk:u.atk??s.atk,hp:u.hp??s.hp,armor:u.armor??d.traits?.armor?.[(u.level??1)-1]??0,abilities:[!!d.cast,!!d.chargeSkill,!!d.onRattle,!!d.onAllyFaint],rule:node.rules?.length??0}];});
    const deaths=out.log.filter(x=>x.ev.t==='death').length,fatigue=out.log.some(x=>x.ev.t==='dmg'&&x.ev.kind==='fatigue');
    const stage=`${general.id}/${policy}/${r.chapter+1}/${r.node+1}/${node.name}/${retry?'retry':'first'}`;
    const s=summary[stage]??={n:0,win:0,lose:0,draw:0,fatigue:0,beats:0};s.n++;s[out.result]++;s.beats+=out.beats;if(fatigue)s.fatigue++;
    const chargeCoverage={offers:[...new Set(actions.flatMap(a=>(a.detail.shelf??[]) as string[]))].filter(id=>id&&playerBattery(unitDef(id))),bought:actions.filter(a=>a.type==='buy'&&playerBattery(unitDef(String(a.detail.id)))).map(a=>a.detail.id),adjacentPairs:out.initial.flatMap(u=>u.side===0&&playerBattery(unitDef(u.defId))?out.initial.filter(t=>t.side===0&&t.chargeMax&&Math.abs(t.slot-u.slot)===1).map(t=>({battery:u.defId,target:t.defId})):[]),gains:out.log.flatMap(frame=>{const ev=frame.ev;if(ev.t!=='charge'||!ev.src)return[];const src=frame.snap.find(u=>u.uid===ev.src),target=frame.snap.find(u=>u.uid===ev.uid);return src?.side===0&&playerBattery(unitDef(src.defId))?[{src:src.defId,target:target?.defId,n:ev.n,adjacent:!!target&&Math.abs(src.slot-target.slot)===1}]:[];})};
    emit(fd,{id,phase,general:general.id,seed,policy,shopPolicy,recoveryMode,index,attempt,battleNo:battleNo(r),chapter:r.chapter+1,node:r.node+1,path:r.forkPick,variants:r.variantChoices,encounterName:node.name,enemyIds:setup.enemy.map(u=>u?.defId??null),key,retry,result:out.result,beats:out.beats,rounds:out.rounds,lives:r.lives,goldUnused:r.gold,refreshes,actions,owned,field:rows,stash:r.stash,bag:r.bag,genPower:r.genPower,passives:r.passives,chargeCoverage,route:phase==='coverage-charge'?'charge':playerSelectedRoute(r,legacyAuditClassifier),fieldRoute:playerRoute(field,legacyAuditClassifier),combo,firstCombo,enemy,metrics:out.metrics,deaths,fatigue,triggers:out.triggers,...(out.result!=='win'?{setup,trace:out.log.map(x=>x.ev)}:{})});
    if(ablation&&index<5)for(const remove of ['training','growth','equipment'] as const) {
      const clone:BattleSetup=structuredClone(setup);
      for(const u of [...clone.player,...(clone.reserve??[])])if(u&&'ownedId'in u){if(remove==='training')delete u.train;else if(remove==='growth')delete u.growth;else delete u.equips;}
      if(remove==='training'&&clone.general)clone.general.power=0;
      const off=simulate({...clone,record:false});
      emit(offfd,{id,attempt,key,remove,causal:'frozen legal setup; offline only; no feedback into policy',baseline:{result:out.result,beats:out.beats,metrics:out.metrics},removed:{result:off.result,beats:off.beats,metrics:off.metrics},setupSeed:setup.seed});
    }
    if(ablation&&index<5) {
      const stage=currentStage(r);
      if(stage.type==='fork'&&retry===0)for(const branch of ['normal','elite'] as const) {
        const clone:BattleSetup={...structuredClone(setup),enemy:structuredClone(stage[branch].lineup),rules:structuredClone(stage[branch].rules)};
        const off=simulate({...clone,record:false});emit(offfd,{id,attempt,key,branch,causal:'frozen own setup and seed, alternate visible fork enemy/rules, no policy feedback or branch reward',result:off.result,beats:off.beats,metrics:off.metrics,enemy:clone.enemy,setupSeed:setup.seed});
      }
    }
    actions=[];refreshes=0;
   }
  });
  runs++;faults+=result.faults;emit(runfd,{id,general:general.id,seed,policy,shopPolicy,recoveryMode,phase,wins:result.wins,battles:result.battles,clear:result.clear,faults:result.faults,firstCombo,finalOwned:allOwned(result.r),finalStash:result.r.stash,lastActions:actions});
 }
}
closeSync(fd);closeSync(runfd);closeSync(offfd);
const changed=files.filter(p=>hash(p)!==hashes[p]);
const evidence={phase,legacyAuditClassifier,runs,battles,failed,illegal,faults,elapsedMs:Date.now()-start,changed,hashes,seedRule:'23010011+n*104729; first 30 legal per general; first10 calibration, next20 holdout',policies,ablation:'offline frozen setup per stat group; no policy feedback',summary};
writeFileSync(`${folder}/${phase}-summary.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify({phase,runs,battles,failed,illegal,faults,changed,elapsedMs:evidence.elapsedMs}));
if(failed||illegal||faults||changed.length)throw new Error('Audit gate failed');
