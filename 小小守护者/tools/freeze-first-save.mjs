import {createGame,applyAction,step,serializeGame} from '../src/core/index.ts';
import {writeFileSync} from 'node:fs';
const state=createGame(20261013);
for(const a of [{type:'buyLegion',kind:'archer',x:23,y:8},{type:'buyLegion',kind:'archer',x:23,y:12},{type:'buyLegion',kind:'shield',x:23,y:10},{type:'startWave'}]){if(!applyAction(state,a).ok)throw new Error('fixture setup failed')}
step(state,6000);if(state.phase!=='prep'||state.wave!==1)throw new Error('fixture wave failed');
writeFileSync('src/fixtures/run-v1-wave1.json',JSON.stringify({version:1,runId:'frozen-guardians-0.1.0-wave1',snapshot:serializeGame(state)},null,2));
