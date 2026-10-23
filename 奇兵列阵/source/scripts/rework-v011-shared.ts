// @ts-ignore Node host
import {writeFileSync} from 'node:fs';
import {chapter} from '../src/core/route';
import {unitDef} from '../src/core/data';
import {chapter as oldChapter} from '../../output/sap-rework-v011-20261023/before/src/core/route';
import {unitDef as oldDef} from '../../output/sap-rework-v011-20261023/before/src/core/data';
const rows:any[]=[];for(let c=0;c<3;c++)for(const [n,s]of chapter(c).stages.entries())for(const variant of ['main','normal','elite','variant']){const node=(s as any)[variant],before=(oldChapter(c).stages[n]as any)[variant];if(!node)continue;for(const [slot,u]of node.lineup.entries()){if(!u)continue;const current=unitDef(u.defId),old=oldDef(u.defId);const prior=before?.lineup[slot];if(JSON.stringify(current)!==JSON.stringify(old)||JSON.stringify(u)!==JSON.stringify(prior))rows.push({chapter:c+1,node:n+1,name:node.name,variant,slot,beforeEntry:prior,currentEntry:u,beforeSharedDefinition:old,currentSharedDefinition:current,definitionChanged:JSON.stringify(current)!==JSON.stringify(old),lineupChanged:JSON.stringify(u)!==JSON.stringify(prior),warning:'Enemy fixed atk/hp overrides remain; authored definition changes affect abilities too. Prep-only component needs separate audit.'});}}
writeFileSync('../output/sap-rework-v011-20261023/validation/current/enemy-shared-changes.json',JSON.stringify(rows,null,2));console.log({changedEnemySlots:rows.length,changedIds:[...new Set(rows.map(r=>r.currentEntry.defId))]});
