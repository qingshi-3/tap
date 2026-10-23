declare const process:any;
// @ts-ignore Node
import {writeFileSync,mkdirSync} from 'node:fs';
import {chapter} from '../../output/sap-rework-v011-20261023/before/src/core/route';
import {unitDef} from '../../output/sap-rework-v011-20261023/before/src/core/data';
const folder=`../output/sap-rework-v011-20261023/validation/${process.env.REWORK_VERSION??'before'}`;mkdirSync(folder,{recursive:true});const rows:any[]=[];
for(let c=0;c<3;c++)for(const [i,s] of chapter(c).stages.entries())for(const key of ['main','variant','normal','elite']){const node=(s as any)[key];if(!node)continue;for(const [slot,u] of node.lineup.entries()){if(!u)continue;const d=unitDef(u.defId);if(d.prep?.length)rows.push({chapter:c+1,node:i+1,variant:key,name:node.name,slot,id:d.id,unit:d.name,text:d.text,prep:d.prep,reason:'enemy has no legal prep transaction; prep component cannot trigger (other battle skills may remain useful)'});}}
writeFileSync(`${folder}/enemy-prep-audit.json`,JSON.stringify(rows,null,2));console.log(rows);
