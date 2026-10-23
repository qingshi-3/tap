// @ts-expect-error Node host API.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
// @ts-expect-error Node host API.
import {createHash} from 'node:crypto';
// @ts-expect-error Node host API.
import assert from 'node:assert/strict';
import {generalChoices,setGeneralOrder} from '../src/core/run';
import {preparationStat} from '../src/core/preparation';
import {playRun,type PlayerPolicy} from './simlib';
const folder='../output/shop-stage-v0101-20261023/player-smoke';mkdirSync(folder,{recursive:true});
const profiles:any[]=[],ledger:any[]=[];let failures=0,illegal=0,faults=0;
const hash=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
const files=['src/core/run.ts','src/core/save.ts','src/core/content.ts','src/core/data.ts','src/core/engine.ts','scripts/simlib.ts'];const hashes=Object.fromEntries(files.map(f=>[f,hash(f)]));
for(const general of ['reva','zilan','sajj','kaleos']){
 const seeds:number[]=[];for(let n=0;seeds.length<3;n++){const seed=25100021+n*177211;if(generalChoices(seed).includes(general))seeds.push(seed);}
 for(const [index,seed]of seeds.entries()){
 const policy:PlayerPolicy=(['growth','upgrade','mechanism']as const)[index],shopBuys:Record<string,number>={};let battles=0,settled=0;
 const result=playRun({general,seed,playerPolicy:policy,requireLegalGeneral:true,recordBattles:false,
 onAction:a=>{ledger.push({general,seed,policy,...a});if(!a.ok)failures++;assert(a.ok,JSON.stringify(a));const diff=a.goldBefore-a.goldAfter;
 const expected=['buy','signMerc'].includes(a.type)?3:a.type==='refresh'?1:a.type==='sell'?-Number(a.detail.price):['specialBuy','hireMerc'].includes(a.type)?Number(a.detail.price):0;
 if(a.goldAfter<0||diff!==expected)illegal++;assert.equal(diff,expected);
 if(a.type==='refresh')assert(![3,7].includes(a.node),'special shop refresh attempted');
 if(a.type==='specialBuy'&&a.detail.kind==='units'){const key=`${a.chapter}:${a.node}`;shopBuys[key]=(shopBuys[key]??0)+1;assert(shopBuys[key]<=2,'more than two unit purchases');}
 },beforeBattle:r=>{if(['zilan','kaleos'].includes(general)){const u=r.slots.filter(Boolean).sort((a,b)=>preparationStat(b!,'atk')-preparationStat(a!,'atk'))[0];assert(setGeneralOrder(r,u?.ownedId??null));}},onBattle:()=>battles++,onSettled:()=>settled++});
 faults+=result.faults;assert.equal(result.faults,0);profiles.push({general,seed,policy,battles,settled,truncated:battles!==settled,shopBuys,clear:result.clear,outcome:result.r.over});
 }
}
const changed=files.filter(f=>hash(f)!==hashes[f]);assert.equal(changed.length,0);writeFileSync(folder+'/actions.jsonl',ledger.map(x=>JSON.stringify(x)).join('\n')+'\n');
writeFileSync(folder+'/report.json',JSON.stringify({scope:'12 independent real trajectories:4 generals x3 legal seeds, one growth/upgrade/mechanism each; action legality smoke only, not strength tuning.',failures,illegal,faults,changed,hashes,profiles,totalActions:ledger.length,shopsWithUnitPurchases:profiles.reduce((n,r)=>n+Object.keys(r.shopBuys).length,0),maxUnitPurchasesInVisit:Math.max(0,...profiles.flatMap(r=>Object.values(r.shopBuys)as number[])),specialRefreshAttempts:ledger.filter(a=>a.type==='refresh'&&[3,7].includes(a.node)).length},null,2));console.log(JSON.stringify({runs:profiles.length,battles:profiles.reduce((n,r)=>n+r.battles,0),failures,illegal,faults,changed}));
