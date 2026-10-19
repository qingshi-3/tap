import {createGame,applyAction,step,hashState,serializeGame,restoreGame,replayGame,LEGION_DEFS} from '../src/core/index.ts';
declare const process:{argv:string[]};
export function runStrategy(seed:number, strategy:'defend'|'empty'){
 const s=createGame(seed),waves:{wave:number;coreHp:number;legions:number;gold:number}[]=[];
 const buy=(kind:'shield'|'archer',x:number,y:number)=>applyAction(s,{type:'buyLegion',kind,x,y});
 if(strategy==='defend'){buy('archer',23,8);buy('archer',23,12);buy('shield',23,10);}
 while(s.phase==='prep'){
  if(s.cardChoices.length){applyAction(s,{type:'chooseCard',kind:s.cardChoices.includes('giant')?'giant':s.cardChoices.includes('sharp')?'sharp':s.cardChoices[0]});const c=s.cards.at(-1);const l=s.legions.find(l=>l.kind==='archer');if(c&&l)applyAction(s,{type:'assignCard',cardId:c.id,legionId:l.id});}
  if(strategy==='defend'){for(const l of s.legions)applyAction(s,{type:'upgradeLegion',id:l.id});let n=0;while(s.gold>=LEGION_DEFS.archer!.price&&n++<30){const i=s.legions.length;buy('archer',21+(i%4),5+Math.floor(i/4)*2);}
  }
  applyAction(s,{type:'startWave'});step(s,6000);waves.push({wave:s.wave,coreHp:s.coreHp,legions:s.legions.length,gold:s.gold});const replay=replayGame(seed,s.actions);step(replay,s.tick-replay.tick);if(hashState(replay)!==hashState(s))throw new Error('wave replay mismatch');if(s.phase==='prep'){const checkpoint=restoreGame(serializeGame(s));if(hashState(checkpoint)!==hashState(s))throw new Error('checkpoint mismatch');}
 }
 return {seed,strategy,result:s.phase,waves,hash:hashState(s)};
}
if(process.argv[1]?.endsWith('sim.ts')){const count=Number(process.argv[2]??10);const rows=[];for(let seed=1;seed<=count;seed++)for(const strategy of ['defend','empty'] as const)rows.push(runStrategy(seed,strategy));console.log(JSON.stringify({rules:'guardians-1.0.0',runs:rows.length,wins:rows.filter(r=>r.result==='won').length,losses:rows.filter(r=>r.result==='lost').length,rows},null,2));}
