/** Paired legal economy sample. No forced passives, rewards, resources or battle lookahead. */
declare const process: {env: Record<string,string|undefined>};
// @ts-expect-error Node host API.
import {mkdirSync, writeFileSync, readFileSync, readdirSync} from 'node:fs';
// @ts-expect-error Node host API.
import {createHash} from 'node:crypto';
import {GENERALS, DRAFT_POOL, unitDef} from '../src/core/data';
import {allOwned, generalChoices, CONTENT_VERSION, sellPrice, battleNo} from '../src/core/run';
import {playRun, type SimAction, type Strategy, type SummonFormation} from './simlib';
import {FATIGUE_BEAT} from '../src/core/engine';

const perGeneral=Number(process.env.PER_GENERAL ?? 10), smoke=process.env.SMOKE==='1';
const selected=new Set((process.env.GENERAL_IDS??'').split(',').filter(Boolean));
const excluded=new Set((process.env.EXCLUDE_SEEDS??'').split(',').filter(Boolean).map(Number));
const calibrationOnly=process.env.CALIBRATION_ONLY==='1', heroRefinement=process.env.HERO_REFINEMENT==='1';
const focus=process.env.FOCUS==='summon'?'summon':process.env.FOCUS==='charge'?'charge':undefined;
const summonFormation:SummonFormation=['natural','relay','conditional','open'].includes(process.env.SUMMON_FORMATION??'')?process.env.SUMMON_FORMATION as SummonFormation:'open';
const label=process.env.LABEL??(smoke?'smoke':'sample');
const output=process.env.OUTPUT ?? '../output/six-tier-rework-20261022/simulation';
mkdirSync(output,{recursive:true});
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const sourceFiles=[...readdirSync('src/core').filter((p:string)=>p.endsWith('.ts')).map((p:string)=>`src/core/${p}`),'scripts/simlib.ts','scripts/six-tier-balance.ts'].sort();
const before=Object.fromEntries(sourceFiles.map(p=>[p,sha(p)]));
const started=Date.now();
const records: unknown[]=[];
const summary: Record<string, {runs:number; clears:number; faults:number; failedActions:number; negativeGold:number; illegalGains:number; firstFour:{n:number;win:number;lose:number;draw:number;fatigue:number}[]; reach:Record<string,number>; tiers:Record<string,number[]>; stars:Record<string,number[]>; summons:number; charges:number; transactions:Record<string,number>; costs:Record<string,number>}>={};
for(const general of (smoke ? GENERALS.slice(0,1) : GENERALS.filter(g=>!selected.size||selected.has(g.id)))) {
  const seeds:number[]=[];
  for(let index=0;seeds.length<(smoke?1:perGeneral);index++) {
    const seed=(Number(process.env.SEED_BASE??1022003)+index*7919)|0;
    if(!excluded.has(seed)&&generalChoices(seed).includes(general.id)) seeds.push(seed);
  }
  for(let index=0;index<seeds.length;index++) for(const strategy of ['steady','synergy'] as Strategy[]) {
    const seed=seeds[index], group=process.env.HOLDOUT_ONLY==='1'?'holdout':calibrationOnly||index<Math.ceil(perGeneral/2)?'calibration':'holdout';
    const key=`${general.id}/${strategy}/${group}`;
    const stats=summary[key]??= {runs:0,clears:0,faults:0,failedActions:0,negativeGold:0,illegalGains:0,firstFour:Array.from({length:4},()=>({n:0,win:0,lose:0,draw:0,fatigue:0})),reach:{},tiers:{},stars:{},summons:0,charges:0,transactions:{},costs:{}};
    const actions:SimAction[]=[], battles:unknown[]=[], tiers:Record<string,number>={}, stars:Record<string,number>={};
    let battle=0;
    const ordinary=new Set(DRAFT_POOL.map(d=>d.id));
    const observe=(bodies: {id:string;copies:number}[],at:number)=> {
      for(const u of bodies) if(ordinary.has(u.id)) {
        const tier=unitDef(u.id).tier, star=u.copies===4?3:u.copies===2?2:1;
        tiers[tier]??=at; stars[star]??=at;
      }
    };
    const result=playRun({general:general.id,seed,strategy,requireLegalGeneral:true,recordBattles:true,heroRefinement,focus,summonFormation,
      onAction:a=> {actions.push(a); observe((a.detail.owned??[]) as {id:string;copies:number}[],battle+1); stats.transactions[a.type]=(stats.transactions[a.type]??0)+1; stats.costs[a.type]=(stats.costs[a.type]??0)+(a.goldBefore-a.goldAfter); if(!a.ok)stats.failedActions++; if(a.goldAfter<0)stats.negativeGold++; const expected=a.type==='buy'?3:a.type==='refresh'?1:a.type==='sell'?-Number(a.detail.price):a.type==='signMerc'?3:['specialBuy','hireMerc'].includes(a.type)?Number(a.detail.price):['merge','lock','endPrep'].includes(a.type)?0:undefined; if((!a.ok && a.goldAfter!==a.goldBefore)||(a.ok && expected!==undefined && a.goldBefore-a.goldAfter!==expected))stats.illegalGains++;},
      onBattle:(r,setup,out,node)=> {
        battle++; observe(allOwned(r).filter(u=>!!u).map(u=>({id:u!.defId,copies:u!.copies})),battle);
        const fatigue=out.log.some(x=>x.ev.t==='dmg' && x.ev.kind==='fatigue');
        const reach=`${r.chapter+1}-${r.node+1}`; stats.reach[reach]=(stats.reach[reach]??0)+1;
        const encounter=battleNo(r)+1;
        if(encounter<=4) {const f=stats.firstFour[encounter-1]; f.n++; f[out.result]++; if(fatigue) f.fatigue++;}
        stats.summons+=out.metrics?.summons??0; stats.charges+=out.metrics?.charges??0;
        let beat=0,round=0; const ownActions=new Map<number,number>();
        const chargeTiming:unknown[]=[], summonTiming:unknown[]=[], summoned=new Set<number>();
        for(const frame of out.log) {
          const ev=frame.ev;
          if(ev.t==='beat') {beat=ev.n;round=ev.round??0;}
          if(ev.t==='act' && ev.side===0) {
            if(ev.mode!=='extra')ownActions.set(ev.uid,(ownActions.get(ev.uid)??0)+1);
            const unit=frame.snap.find(u=>u.uid===ev.uid);
            if(ev.mode==='charge')chargeTiming.push({beat,round,uid:ev.uid,id:unit?.defId,ownAction:ownActions.get(ev.uid)});
            if(summoned.has(ev.uid)) {summonTiming.push({type:'firstAction',beat,round,uid:ev.uid,id:unit?.defId,mode:ev.mode});summoned.delete(ev.uid);}
          }
          if(ev.t==='death' && summoned.has(ev.tgt)) {summonTiming.push({type:'diedBeforeFirstAction',beat,round,uid:ev.tgt});summoned.delete(ev.tgt);}
          if(ev.t==='summon') {
            const unit=frame.snap.find(u=>u.uid===ev.uid);
            if(unit?.side===0){summoned.add(ev.uid);summonTiming.push({type:'enter',beat,round,uid:ev.uid,id:unit.defId,idle:!!unitDef(unit.defId).traits?.idle,actionsLeft:unit.actionsLeft});}
          }
        }
        for(const uid of summoned) summonTiming.push({type:'noActionBeforeBattleEnd',beat,round,uid});
        battles.push({battle,encounter,reach,chargeTiming,summonTiming,setupSeed:setup.seed,spells:setup.spells,rules:setup.rules,generalSetup:setup.general,node:node.name,result:out.result,beats:out.beats,fatigue,lives:r.lives,gold:r.gold,shelf:[...r.draft],locked:[...(r.draftLocked??[])],team:setup.player,reserve:setup.reserve,enemy:setup.enemy,metrics:out.metrics,passives:[...r.passives],merc:r.merc,eggProgress:r.eggStats,eggEvents:out.eggStats,pendingEggs:r.pendingEggs,bench:r.bench,fault:out.fault,triggers:out.triggers,chargeReleases:out.log.flatMap(x=>{const ev=x.ev; return ev.t==='act' && ev.mode==='charge' && ev.side===0?[{event:ev,snapshot:x.snap.find(u=>u.uid===ev.uid)}]:[];}),summonEvents:out.log.flatMap(x=>x.ev.t==='summon'?[x.ev]:[])});
      },
      onSettled:r=> {for(const u of allOwned(r)) if(u && sellPrice(u,r)!==(u.temp?0:u.copies===4?3:u.copies===2?2:1)) throw new Error('Unexpected sell price');}
    });
    for(const [tier,first] of Object.entries(tiers)) (stats.tiers[tier]??=[]).push(first);
    for(const [star,first] of Object.entries(stars)) (stats.stars[star]??=[]).push(first);
    stats.runs++; if(result.clear)stats.clears++; stats.faults+=result.faults;
    records.push({general:general.id,seed,strategy,group,wins:result.wins,clear:result.clear,battlesReached:result.battles,over:result.r.over,faults:result.faults,firstTier:tiers,firstStar:stars,actions,battles});
  }
}
const after=Object.fromEntries(sourceFiles.map(p=>[p,sha(p)]));
const evidence={contentVersion:CONTENT_VERSION,seedRule:'1022003 + index*7919, selected general must be in public starting three',perGeneral,smoke,label,heroRefinement,focus,summonFormation,calibrationOnly,excludedSeeds:[...excluded],started:new Date(started).toISOString(),elapsedMs:Date.now()-started,sourceSha256:before,changedDuringRun:sourceFiles.filter(p=>before[p]!==after[p]),rules:{buy:3,refresh:1,sell:'star 1/2/3',goldCarry:false,forcePassive:false,mutateSetup:false,battleLookahead:false,realCommit:'buildBattle preview -> simulate once -> beginBattle -> finishBattle',fatigue:`actual fatigue damage events, engine begins at beat ${FATIGUE_BEAT}`},summary};
writeFileSync(`${output}/${label}-evidence.json`,JSON.stringify(evidence,null,2));
writeFileSync(`${output}/${label}-runs.json`,JSON.stringify(records,null,2));
console.log(JSON.stringify({runs:records.length,elapsedMs:evidence.elapsedMs,changedDuringRun:evidence.changedDuringRun,summary},null,2));
