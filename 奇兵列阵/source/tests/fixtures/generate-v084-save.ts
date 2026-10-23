// Generates an authentic frozen save by executing the unmodified 0.8.4 backup source.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import * as Old from '../../../output/six-tier-rework-20261022/before-0.8.4/src/core/run';
import { simulate } from '../../../output/six-tier-rework-20261022/before-0.8.4/src/core/engine';
const root=resolve('..','output/six-tier-rework-20261022/before-0.8.4/src/core');
const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const run=Old.newRun('reva',20261022);
if(run.contentVersion!=='0.8.4')throw Error('source is not 0.8.4');
Old.takeDraft(run,0,0); Old.takeDraft(run,0,1);
const battle=simulate(Old.buildBattle(run));
if(battle.fault)throw Error(battle.fault);
Old.beginBattle(run,battle.result,battle.gold,battle.eggStats); Old.finishBattle(run);
const raw=JSON.stringify(run,null,2)+'\n';
writeFileSync('tests/fixtures/expedition-v084.json',raw);
const sources=Object.fromEntries(readdirSync(root).filter(f=>f.endsWith('.ts')).sort().map(file=>[file,hash(readFileSync(resolve(root,file)))]));
writeFileSync('tests/fixtures/expedition-v084.source.json',JSON.stringify({source:'output/six-tier-rework-20261022/before-0.8.4/src/core',contentVersion:Old.CONTENT_VERSION,seed:20261022,generator:'tests/fixtures/generate-v084-save.ts',steps:['newRun(reva,20261022)','takeDraft(0,0)','takeDraft(0,1)','simulate(buildBattle)','beginBattle + finishBattle'],fixtureSha256:hash(raw),sources},null,2)+'\n');
