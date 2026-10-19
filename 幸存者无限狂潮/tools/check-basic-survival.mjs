import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createGame,configureRun,startGame,updateGame} from '../dist/simulation.js';
import {HEROES,getHeroJobs} from '../dist/heroes.js';
import {applyGrowthUpgrade} from '../dist/growth.js';

// Fixed-build ordinary-pressure experiment. Every movement, hit, death, shield,
// stagger and companion reaction executes through production updateGame.
// New ordinary enemy XP alone is zeroed to prevent upgrade transitions granting
// protection or changing this explicitly fixed build. Supplies remain real.
const DT=1/60;
const SIMULATION_SOURCE=await readFile(new URL('../dist/simulation.js',import.meta.url),'utf8');
const ORDINARY_KINDS=[...SIMULATION_SOURCE.match(/const ENEMY = \{[\s\S]*?\n\};/)[0].matchAll(/^  (\w+):/gm)].map(m=>m[1]);
export const PUBLIC_BUILD=Object.freeze({damage:2,area:2,attackSpeed:2,vitality:2,speed:1});
const round=n=>Math.round(n*1000)/1000;
function q(values,p){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return round(sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))]);}
export function survival({hero,tier=3,rank=4,branch='a',formation='ring',route='stationary',build='zero',seconds=24,seed=31}={}){
 const g=createGame({seed,duration:360});assert(configureRun(g,{heroId:hero,heroJob:getHeroJobs(hero)[tier-1].id,dungeon:{id:'survival-ordinary-fixture',duration:360,difficulty:1,spawnScale:1,enemies:ORDINARY_KINDS,boss:{spawnAt:1e9}}}));
 for(let r=2;r<=rank;r++)assert(applyGrowthUpgrade(g,r===4?`attack:${branch}`:`attack:rank${r}`));
 if(build==='public')for(const [id,count]of Object.entries(PUBLIC_BUILD))for(let i=0;i<count;i++)assert(applyGrowthUpgrade(g,`stat:${id}`));
 assert(startGame(g));
 g.time=270;g._eliteWaves=3;g._nextSupplyAt=287;g.player.x=1400;g.player.y=900;
 assert(!g.previewMode);assert.equal(g.player.invulnerable,0);
 const known=new Map(),kills=[],damageEvents=[],samples=[],spawnStats={},births=[];let firstContact=null,firstDamage=null,nearIntegral=0,nearPeak=0,elapsed=0,lastTaken=0,healing=0,lastHp=g.player.hp,phaseProtectionSeconds=0;
 const startHp=g.player.hp,startMaxHp=g.player.maxHp,startSpeed=g.player.speed,center={x:1200,y:900};
 for(let frame=0;frame<Math.ceil(seconds/DT)&&g.phase==='playing';frame++){
  const beforeTime=g.time;
  let input={x:0,y:0};if(route==='orbit'){const angle=(elapsed+DT)*startSpeed/200,target={x:center.x+Math.cos(angle)*200,y:center.y+Math.sin(angle)*200};input={x:target.x-g.player.x,y:target.y-g.player.y};}
  updateGame(g,DT,input);elapsed=g.time-270;
  if(['upgrade_slowdown','upgrade_resume'].includes(g.phase))phaseProtectionSeconds+=g.time-beforeTime;
  assert(!['upgrade','upgrade_slowdown','upgrade_resume'].includes(g.phase),'Fixed-build fixture must never enter protected upgrade phases');
  for(const e of g.enemies)if(!known.has(e.id)){
   assert(!e.boss&&!e.elite,'Ordinary pressure fixture unexpectedly spawned elite/boss');
   if(formation==='front'){const d=Math.hypot(e.x-g.player.x,e.y-g.player.y),a=((e.id%17)/16-.5)*Math.PI*.6;e.x=g.player.x+Math.cos(a)*d;e.y=g.player.y+Math.sin(a)*d;}
   // XP is an economy-only fixture adaptation, never a combat stat adjustment.
   e.xp=0;known.set(e.id,{entity:e,recordedDead:false});births.push({time:round(elapsed),id:e.id,kind:e.kind,distance:round(Math.hypot(e.x-g.player.x,e.y-g.player.y)),hp:round(e.maxHp),speed:round(e.speed),damage:round(e.damage),radius:round(e.radius),spawnDelay:round(e.spawnDelay)});
   const row=spawnStats[e.kind]||={count:0,hp:[Infinity,-Infinity],speed:[Infinity,-Infinity],damage:[Infinity,-Infinity],radius:e.radius};row.count++;for(const [key,value]of [['hp',e.maxHp],['speed',e.speed],['damage',e.damage]]){row[key][0]=Math.min(row[key][0],value);row[key][1]=Math.max(row[key][1],value);}
  }
  let near=0;for(const e of g.enemies){if(e.dead||e.hp<=0||e.spawnDelay>0)continue;const d=Math.hypot(e.x-g.player.x,e.y-g.player.y);if(d<=90)near++;if(firstContact===null&&d<g.player.radius+e.radius-4)firstContact=round(elapsed);}
  nearIntegral+=near*(g.time-beforeTime);nearPeak=Math.max(nearPeak,near);
  for(const [id,entry]of known)if(entry.entity.dead&&!entry.recordedDead){entry.recordedDead=true;kills.push({time:round(elapsed),id,kind:entry.entity.kind,distance:round(Math.hypot(entry.entity.x-g.player.x,entry.entity.y-g.player.y))});}
  const received=g.stats.damageTaken-lastTaken;if(received>0){if(firstDamage===null)firstDamage=round(elapsed);damageEvents.push({time:round(elapsed),received:round(received),hp:round(g.player.hp),bySource:{...g.stats.damageTakenBySource}});}healing+=Math.max(0,g.player.hp-lastHp+received);lastTaken=g.stats.damageTaken;lastHp=g.player.hp;
  if((frame+1)%180===0||g.phase!=='playing')samples.push({seconds:round(elapsed),hp:round(g.player.hp),spawned:known.size,kills:kills.length,live:g.enemies.filter(e=>!e.dead&&e.hp>0).length,near90:near,damageTaken:round(g.stats.damageTaken),damageBySource:{...g.stats.damageTakenBySource}});
 }
 assert(known.size>0,'Production ordinary spawns must actually occur');const killDistances=kills.map(k=>k.distance),entryTime=Math.max(DT,elapsed);
 return {hero,tier,rank,branch,formation,route,build,seed,requestedSeconds:seconds,elapsed:round(elapsed),survived:g.phase!=='defeat',phase:g.phase,hp:round(g.player.hp),startHp,startMaxHp,playerRadius:g.player.radius,startSpeed,growth:{...g.growth},firstGeometricContactSeconds:firstContact,firstDamageSeconds:firstDamage,near90EnemySeconds:round(nearIntegral),near90Peak:nearPeak,kills:kills.length,spawned:known.size,spawnRate:round(known.size/entryTime),killRate:round(kills.length/entryTime),killDistance:{min:q(killDistances,0),p25:q(killDistances,.25),median:q(killDistances,.5),p75:q(killDistances,.75),max:q(killDistances,1),before90:kills.filter(k=>k.distance>=90).length},damageTaken:round(g.stats.damageTaken),damageTakenBySource:{...g.stats.damageTakenBySource},healing:round(healing),phaseProtectionSeconds,spawnStats,samples,events:{births,kills,damage:damageEvents}};
}
export async function writeSurvivalReport({heroes=HEROES.map(h=>h.id),tiers=[3],seconds=24,seeds=[31],baseline=false}={}){
 const source=SIMULATION_SOURCE;
 const report={status:'measurement-only; no balance pass threshold assigned',combatPath:'createGame -> configureRun -> startGame -> updateGame',scenario:{startTime:270,duration:360,difficulty:1,spawnScale:1,formation:'production ordinary births; front changes birth direction only',routes:'stationary; fixed 200-world-unit circular route at real player movement speed',publicGrowth:PUBLIC_BUILD,adaptations:['ordinary-only: past elite counters consumed, boss scheduled outside fixture','fixed-build: newborn ordinary XP=0 to prevent protected upgrade transitions','supply schedule continues at time287 then production cadence; map objects retained'],excludedClaims:['natural complete-run survival','stationary must never take damage','any preview test proves survival']},sourceEvidence:{enemyTable:source.match(/const ENEMY = \{[\s\S]*?\n\};/)?.[0],lateStages:source.match(/\{ at: 240[^\n]*\n[^\n]*/)?.[0],contact:'non-boss, center distance < player.radius+enemy.radius-4; real 0.72s damage invulnerability',protection:'protectPlayer true only in upgrade_slowdown/resume; no previewMode immunity in simulation'},rows:[]};
 for(const hero of heroes)for(const tier of tiers)for(const [rank,branch]of [[3,null],[4,'a'],[4,'b']])for(const build of ['zero','public'])for(const formation of ['ring','front'])for(const route of ['stationary','orbit'])for(const seed of seeds)report.rows.push(survival({hero,tier,rank,branch,build,formation,route,seconds,seed}));
 const out=new URL('../output/basic-survival/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL(baseline?'baseline.json':'current.json',out),JSON.stringify(report,null,2),{flag:baseline?'wx':'w'});
 console.log(JSON.stringify({cases:report.rows.length,measurementOnly:true,rows:report.rows.map(({events,spawnStats,samples,...row})=>row)}));return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const pick=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)||fallback;await writeSurvivalReport({heroes:pick('heroes',HEROES.map(h=>h.id).join(',')).split(','),tiers:pick('tiers','3').split(',').map(Number),seconds:Number(pick('seconds','24')),seeds:pick('seeds','31').split(',').map(Number),baseline:process.argv.includes('--baseline')});}
