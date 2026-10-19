import {survival} from './check-basic-survival.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const file=new URL('../output/basic-survival/mythic-evolution.json',import.meta.url);await mkdir(new URL('../output/basic-survival/',import.meta.url),{recursive:true});
const rows=[];for(const hero of ['sword','spiral','petal'])for(const branch of ['a','b'])for(const route of ['stationary','orbit'])rows.push(survival({hero,branch,route,build:'public',formation:'ring',seconds:24}));
let report={};if(!process.argv.includes('--before'))try{report=JSON.parse(await readFile(file,'utf8'));}catch{}report[process.argv.includes('--before')?'before':'after']=rows;await writeFile(file,JSON.stringify(report,null,2));
console.log(JSON.stringify(rows.map(({events,spawnStats,samples,...r})=>r)));
