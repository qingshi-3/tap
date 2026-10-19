import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createGame,configureRun,startGame,updateGame} from '../dist/simulation.js';
import {DUNGEONS} from '../dist/campaign.js';
import {getEncounterWave} from '../dist/enemy-content.js';
const rows=[], cases=[];
function fixture(d,time=0){const g=createGame({seed:127,duration:d?.duration||360});configureRun(g,{dungeon:d?{...d,boss:{...d.boss,spawnAt:1e9},eliteWaves:[]}:undefined});startGame(g);g.time=time;g._eliteWaves=3;g._nextSupplyAt=1e6;g._attackClock=g._orbClock=g._daggerClock=g._lightningClock=g._frostClock=1e6;g.heroKit={heroId:'commander',attackClock:1e6,combo:0,statuses:[]};g.mapObjects=[];g.player.hp=g.player.maxHp=1e9;return g;}
function pulse(g){g._spawnClock=0;updateGame(g,1/60);}
for(const d of DUNGEONS){
  const stages=[];
  for(let index=0;index<7;index++){
    const at=index*60*d.duration/360, wave=getEncounterWave(d.id,index), counts={};
    assert(wave);assert(wave.table.every(([kind,weight])=>d.enemies.includes(kind)&&weight>0));
    const sampleTime=at+4, g=fixture(d,sampleTime);
    for(let n=0;n<500;n++){g.time=sampleTime;g.enemies=[];pulse(g);for(const e of g.enemies){assert(!e.elite&&!e.boss);assert(wave.table.some(([kind])=>kind===e.kind));counts[e.kind]=(counts[e.kind]||0)+1;}}
    assert.equal(g.encounter.name,wave.name);assert(Object.keys(counts).length===wave.table.length);
    const sum=wave.table.reduce((s,[,w])=>s+w,0),probability=(wave.table.find(([k])=>k==='archer_elite')?.[1]||0)/sum;
    stages.push({index,at,name:wave.name,archerProbability:probability,counts,sampled:Object.values(counts).reduce((a,b)=>a+b,0)});
  }
  const g=fixture(d);assert.equal(g.announcement.text,getEncounterWave(d.id,0).name);assert(!stages[0].counts.archer_elite);
  rows.push({id:d.id,stages,boss:d.boss.abilityId,eliteWaves:d.eliteWaves});
}
for(const d of [null,{id:'unknown',duration:360,enemies:['grunt','runner']}]){const g=fixture(d);assert.equal(g.encounter.name,'荒野初潮');pulse(g);assert(g.enemies.length);}
for(const enemies of [[],['not-an-enemy']]){const g=fixture({id:'moss-gate',duration:360,enemies});pulse(g);assert.equal(g.enemies.length,0);}
cases.push('known waves legally spawn via production updateGame; absent/unknown dungeon retains base; empty/invalid roster stays empty');
const moss=DUNGEONS[0],g=fixture(moss,185);
for(let n=0;n<400;n++){pulse(g);g.enemies=g.enemies.filter(e=>e.kind==='archer_elite');assert(g.enemies.filter(e=>!e.dead).length<=6);}
assert.equal(g.enemies.length,6);const dead=g.enemies[0];dead.dead=true;dead.deathLife=999;
let refilled=false;for(let n=0;n<400;n++){pulse(g);g.enemies=g.enemies.filter(e=>e.kind==='archer_elite');assert(g.enemies.filter(e=>!e.dead).length<=6);if(g.enemies.filter(e=>!e.dead).length===6){refilled=true;break;}}
assert(refilled);cases.push('six live ordinary archers cap; dead owner releases slot without waiting for corpse cleanup');
for(const time of [22.1,89,181,270.1]){const g=fixture(moss,time);pulse(g);assert.equal(g.enemies.length,0);assert(g._spawnClock>0);}
const full=fixture(moss,185);pulse(full);const template=full.enemies[0];full.enemies=Array.from({length:40},(_,i)=>({...template,id:100+i,kind:'grunt'}));pulse(full);assert.equal(full.enemies.length,40);
const boss=fixture(moss,305);boss.enemies=Array.from({length:24},(_,i)=>({...template,id:100+i,kind:'grunt'}));boss.boss={dead:false};pulse(boss);assert.equal(boss.enemies.length,24);cases.push('first-gate rest pulses, forty-enemy midgame cap and twenty-four ordinary boss cap preserved');
const baseline=[0,0,0,1/13,2/17,3/15,1/5];
const report={passed:true,scope:'Configuration probabilities and controlled production-updateGame pulses; not natural-run balance validation',cases,rows,mossBaselineArcherProbability:baseline,mossNewArcherProbability:rows[0].stages.map(s=>s.archerProbability),ordinaryArcherCap:{before:4,after:6},unchanged:'stage timing, intervals, bursts, total caps, rest windows, enemy stats, elites, bosses and ranged shot scheduler'};
await mkdir(new URL('../output/encounter-tuning/',import.meta.url),{recursive:true});await writeFile(new URL('../output/encounter-tuning/composition-checks.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,cases,probabilities:rows.map(r=>({id:r.id,archer:r.stages.map(s=>s.archerProbability)}))},null,2));
