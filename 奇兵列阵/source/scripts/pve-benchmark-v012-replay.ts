// Single frozen replay of a held-out first-deployment exception. No policy changes or selection.
// @ts-expect-error Node runtime API.
import {writeFileSync} from 'node:fs';
import {playRun} from './simlib';
import {benchmarkPrepare,benchmarkShop} from './pve-benchmark-v012-policy';
let battle=0;
playRun({general:'reva',seed:896863133,requireLegalGeneral:true,recordBattles:true,playerPolicy:'growth',prepare:benchmarkPrepare,visitShop:benchmarkShop,onBattle:(r,setup,out,node)=>{battle++;if(battle===18)writeFileSync('../output/pve-benchmark-v012-20261023/validation/holdout-first-master-exception.json',JSON.stringify({general:r.general,seed:r.seed,battle,node,setup,out},null,2));}});
