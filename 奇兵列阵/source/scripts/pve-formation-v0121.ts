declare const process:{env:Record<string,string|undefined>};
// @ts-expect-error Node runtime API.
import {mkdirSync,existsSync,readdirSync,readFileSync,writeFileSync,appendFileSync,openSync,readSync,closeSync} from 'node:fs';
// @ts-expect-error Node runtime API.
import {createHash} from 'node:crypto';
import {generalChoices} from '../src/core/run';
import {playRun,type SimAction} from './simlib';
import {DIRECTIONS,CONTRACT_VERSION,formationBoard,evaluateFormation,cooperationGraph,auditBattleCooperation} from './pve-formation-contract';
import {createFormationPolicy,FORMATION_ROLE_IDS,FORMATION_POLICY_VERSION} from './pve-formation-policy';
const root='../output/pve-formation-v0121-20261023';
const phase=process.env.FORMATION_PHASE??'development';
if(!['development','final','smoke'].includes(phase))throw Error('Unknown phase');
const label=process.env.FORMATION_LABEL??phase;
if(!/^[a-z0-9-]+$/.test(label))throw Error('Unsafe label');
const modes=[...DIRECTIONS,'casual','anti3'] as const;
const selected=process.env.FORMATION_MODE?modes.filter(m=>m===process.env.FORMATION_MODE):modes;
if(!selected.length)throw Error('Unknown mode');
const perGeneral=phase==='final'?25:phase==='smoke'?1:4;
const base=phase==='final'?1882100011:phase==='smoke'?1612100011:1719100031,stride=170141;
const folder=`${root}/validation/${label}`;
if(existsSync(folder))throw Error('Evidence already exists; use a fresh label (never overwrite)');
mkdirSync(folder,{recursive:true});
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const files=[...readdirSync('src/core').filter((f:string)=>f.endsWith('.ts')).map((f:string)=>`src/core/${f}`),...readdirSync('scripts').filter((f:string)=>f.endsWith('.ts')).map((f:string)=>`scripts/${f}`)];
const hashes=Object.fromEntries(files.map(f=>[f,sha(readFileSync(f,'utf8'))]));
// Audit every retained historical seed-bearing evidence file, including interrupted batches.
const historical=new Set<number>();let auditedFiles=0;
function scan(dir:string){for(const item of readdirSync(dir,{withFileTypes:true})){const path=`${dir}/${item.name}`;if(path===folder)continue;if(item.isDirectory())scan(path);else if(/\.(jsonl|json|md|txt)$/.test(item.name)){const fd=openSync(path,'r'),buffer=new Uint8Array(262144);let carry='',n=0;auditedFiles++;while((n=readSync(fd,buffer,0,buffer.length,null))>0){const text=carry+new TextDecoder().decode(buffer.subarray(0,n));for(const match of text.matchAll(/"seed"\s*:\s*(\d+)(?=\s*[,}])/g))historical.add(Number(match[1]));carry=text.slice(-80);}closeSync(fd);}}}
scan('../output');
const generals=['reva','zilan','sajj','kaleos'];const quotas=Object.fromEntries(generals.map(g=>[g,0]));
const pairs:{seed:number;general:string}[]=[];const rejected:{seed:number;reason:string}[]=[];
for(let n=0;pairs.length<perGeneral*4;n++){if(n>100000)throw Error('Seed allocation exhausted');const seed=base+n*stride;if(seed>0xffffffff)throw Error('Seed wraps uint32');if(historical.has(seed)){rejected.push({seed,reason:'historical-used'});continue;}const eligible=generals.filter(g=>quotas[g]<perGeneral&&generalChoices(seed).includes(g)).sort((a,b)=>quotas[a]-quotas[b]||generals.indexOf(a)-generals.indexOf(b));if(!eligible.length)continue;const general=eligible[0];quotas[general]++;pairs.push({seed,general});}
const manifest={phase,label,base,stride,perGeneral,pairs,modes:selected,hashes,roleIds:FORMATION_ROLE_IDS,policyVersion:FORMATION_POLICY_VERSION,contractVersion:CONTRACT_VERSION,audit:{auditedFiles,historicalUniqueSeeds:historical.size,rejected},createdAt:new Date().toISOString(),authorizationGate:'FORMATION_RUN=1 required; final batch must follow main-agent contract review'};
writeFileSync(`${folder}/manifest.json`,JSON.stringify(manifest,null,2));
if(process.env.FORMATION_RUN!=='1'){console.log(JSON.stringify({planned:true,folder,samples:pairs.length*selected.length}));}else{
 let batchFailedActions=0,batchBudgetErrors=0,batchAuditErrors=0;
 const emit=(kind:string,row:unknown)=>appendFileSync(`${folder}/${kind}.jsonl`,JSON.stringify(row)+'\n');
 for(const mode of selected)for(const pair of pairs){const runStarted=Date.now();const policy=createFormationPolicy(mode);const runId=`${label}/${mode}/${pair.general}/${pair.seed}`;let attempts=0,uniqueFights=0,settled=0,budgetErrors=0,failedActions=0;const seen=new Map<string,number>();const rows:any[]=[];const firstReady:Record<string,number>={},firstStarted:Record<string,number>={};const formationTimes:Record<string,{started?:unknown;basic?:unknown}>={};
 const action=(a:SimAction)=>{let expected:number|undefined;if(['buy','upgradeBuy'].includes(a.type))expected=3;else if(a.type==='refresh')expected=1;else if(a.type==='sell')expected=-Number(a.detail.price);else if(a.type==='specialBuy')expected=Number(a.detail.price);const spent=a.goldBefore-a.goldAfter;const budgetError=a.goldAfter<0||!a.ok&&spent!==0||a.ok&&expected!==undefined&&Number.isFinite(expected)&&spent!==expected;if(budgetError)budgetErrors++;if(!a.ok)failedActions++;emit('actions',{runId,...a,budgetError});};
 let result;let exception:string|undefined;
 try{result=playRun({...policy.options,...pair,requireLegalGeneral:true,recordBattles:true,routePolicy:'normal',onAction:action,onSettled:()=>{settled++;},onBattle:(r,setup,out,node)=>{attempts++;policy.observeBattle?.(r,setup,out,node);const board=formationBoard(setup,policy.receipts);const formations=DIRECTIONS.map(d=>evaluateFormation(d,board));const graph=cooperationGraph(board);const key=`${r.chapter+1}:${r.node+1}:${node.name}:${r.forkPick??''}:${r.variantChoices[`${r.chapter}:${r.node}`]??''}`;const retry=seen.get(key)??0;seen.set(key,retry+1);if(!retry)uniqueFights++;const time={attempt:attempts,uniqueFightOrdinal:uniqueFights,chapter:r.chapter+1,node:r.node+1,key};for(const f of formations){const times=formationTimes[f.direction]??={};if(f.started&&firstStarted[f.direction]===undefined){firstStarted[f.direction]=attempts;times.started=time;}if(f.basicReady&&firstReady[f.direction]===undefined){firstReady[f.direction]=attempts;times.basic=time;}}
 const row={runId,mode,...pair,attempt:attempts,uniqueFightOrdinal:uniqueFights,chapter:r.chapter+1,node:r.node+1,nodeName:node.name,nodeKind:node.kind,key,retry,firstEncounter:retry===0,result:out.result,fault:out.fault??null,winsBefore:r.wins,livesBefore:r.lives,gold:r.gold,formations,firstReady:{...firstReady},firstStarted:{...firstStarted},graph,receipts:[...policy.receipts],board,actualAudit:auditBattleCooperation(setup,out,policy.receipts),actual:{initial:out.initial,log:out.log,metrics:out.metrics},fatigue:out.log.some(x=>x.ev.t==='dmg'&&x.ev.kind==='fatigue')};rows.push(row);emit('battles',row);}});}catch(e){exception=e instanceof Error?(e.stack??e.message):String(e);}
 const last=rows.at(-1),drawStop=rows.slice(-3).length===3&&rows.slice(-3).every(x=>x.result==='draw'&&x.nodeKind==='boss'&&x.key===last.key);const termination=exception?'exception':result?.clear?'victory':result?.faults?'fault':result?.r.over==='defeat'?'defeat':drawStop?'three-boss-draw-stop':'unresolved';
 const structuralViolations=rows.filter(b=>b.graph.violates).length,actualViolations=rows.filter(b=>b.actualAudit.violates).length,unknownLineages=rows.reduce((n,b)=>n+b.actualAudit.unknownPlayerLineages,0);batchAuditErrors+=unknownLineages+(mode==='anti3'?structuralViolations+actualViolations:0);
 emit('runs',{runStartedAt:new Date(runStarted).toISOString(),elapsedMs:Date.now()-runStarted,structuralViolations,actualViolations,unknownLineages,runId,mode,...pair,clear:result?.clear??false,wins:result?.wins??0,attempts,settled,engineBattles:result?.battles,faults:result?.faults??0,exception,termination,truncated:!['victory','defeat'].includes(termination),unsettledLastBattle:result?.battles!==settled,budgetErrors,failedActions,firstReady,firstStarted,formationTimes,policyMetrics:policy.metrics,receipts:policy.receipts,lastCheckpoint:last?{chapter:last.chapter,node:last.node,key:last.key}:null,lastLegalState:result?.faults?result.r:undefined});
 batchFailedActions+=failedActions;batchBudgetErrors+=budgetErrors;
 if(result?.faults||exception){writeFileSync(`${folder}/completion.json`,JSON.stringify({aborted:true,runId,termination,exception,reason:'Fault/exception gate: retained all preceding evidence; no acceptance result'},null,2));throw Error(`Batch aborted at ${runId}: ${termination}`);}
 }
 const changed=files.filter(f=>sha(readFileSync(f,'utf8'))!==hashes[f]);writeFileSync(`${folder}/completion.json`,JSON.stringify({changed,batchFailedActions,batchBudgetErrors,batchAuditErrors,finishedAt:new Date().toISOString()},null,2));if(changed.length||batchFailedActions||batchBudgetErrors||batchAuditErrors)throw Error('Source/action/budget/audit gate failed: evidence retained but invalid');console.log(JSON.stringify({folder,complete:true}));
}






