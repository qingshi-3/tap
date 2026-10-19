import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame,configureRun,startGame,updateGame,castSkill,getSkillState } from '../dist/simulation.js';
import { HERO_JOBS,HEROES } from '../dist/heroes.js';
import { applyAttackUpgrade } from '../dist/attack-progression.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dt=1/60,seconds=30;
const sources=['basic','basicSecondary','active','companion','reaction','common'];
const stages=[{stage:'early-I',rank:1,branch:null,stats:0},{stage:'early-II',rank:2,branch:null,stats:1},{stage:'middle-III',rank:3,branch:null,stats:2},{stage:'late-IVa',rank:4,branch:'a',stats:4},{stage:'late-IVb',rank:4,branch:'b',stats:4}];
const origin={x:1200,y:900};
function createFixture(job,stage,scenario,commons,layout='ring'){
 const hero=HEROES.find(h=>h.id===job.heroId),loadout=hero.skills.map(s=>s.id);
 const g=createGame({seed:20261011,duration:1e6});
 assert.ok(configureRun(g,{heroId:hero.id,heroJob:job.id,heroSkills:loadout}));assert.ok(startGame(g));
 Object.assign(g.player,origin);g.player.hp=g.player.maxHp=1e6;g.viewport={width:844,height:390};g.previewMode=true;
 g.mapObjects=[];g._spawnClock=g._nextSupplyAt=1e9;g._eliteWaves=3;g.gems=[];
 if(stage.rank>=2)assert.ok(applyAttackUpgrade(g,'attack:rank2'));
 if(stage.rank>=3)assert.ok(applyAttackUpgrade(g,'attack:rank3'));
 if(stage.rank===4)assert.ok(applyAttackUpgrade(g,`attack:${stage.branch}`));
 Object.assign(g.growth,{damage:stage.stats,area:stage.stats,haste:stage.stats,attackSpeed:stage.stats,duration:Math.min(stage.stats,3)});
 for(const id of commons)g.upgrades[id]=3;
 const bossRange={commander:80,summoner:80,blink:180,mage:100}[hero.id];
 const count=scenario==='boss'?1:20;
 g.enemies=Array.from({length:count},(_,i)=>{
  const angle=count===1?0:i*Math.PI*2/count;
  const r=layout==='anchor-compact'?(count===1?0:28+i%3*8):(count===1?bossRange:bossRange-20+(i%3)*24);
  const center=layout==='anchor-compact'?{x:origin.x+250,y:origin.y}:origin;
  return {id:g._nextId++,kind:'grunt',x:center.x+Math.cos(angle)*r,y:center.y+Math.sin(angle)*r,radius:12,hp:1e9,maxHp:1e9,speed:0,damage:0,xp:0,spawnDelay:0,boss:count===1,elite:count===1,hitFlash:0,anim:'idle',animTime:0,animDuration:0,facing:-1,aiClock:1e9,contactClock:1e9};
 });
 for(const [i,c] of g.companions.entries()){c.x=origin.x+50;c.y=origin.y+i*25;}
 if(layout==='anchor-compact'){const targets=g.enemies;g.enemies=[];assert.ok(castSkill(g,'markBlade',{x:1,y:0}));for(let i=0;i<36;i++)updateGame(g,dt,{x:0,y:0});assert.ok(g.heroState.blinkAnchors.length,'prime a real grounded Q anchor');g.enemies=targets;g.stats.damageDealt=g.stats.heroDamage=g.stats.commonDamage=0;for(const key of sources){g.stats.damageBySource[key]=0;g.stats.damageHits[key]=0;}}
 return g;
}
function direction(g){const e=g.enemies[0],dx=e.x-g.player.x,dy=e.y-g.player.y,length=Math.hypot(dx,dy)||1;return {x:dx/length,y:dy/length};}
function sample(job,stage,scenario,commons,mode,layout='ring'){
 const g=createFixture(job,stage,scenario,commons,layout),casts={},attempts={},bounds={maxProjectiles:0,maxHeroEffects:0,maxPending:0,maxCompanions:0,maxAnchors:0,maxBasicShotSerial:0},trajectory={secondsOutsideHome:0,maxDistanceFromHome:0,secondsPrimaryNearAnchor:0};
 for(let frame=0;frame<seconds/dt;frame++){
  const distance=Math.hypot(g.player.x-origin.x,g.player.y-origin.y);
  trajectory.maxDistanceFromHome=Math.max(trajectory.maxDistanceFromHome,distance);if(distance>140)trajectory.secondsOutsideHome+=dt;
  if(g.heroId==='blink'&&g.heroState.blinkAnchors.some(a=>a.remaining>0&&Math.hypot(a.x-g.enemies[0].x,a.y-g.enemies[0].y)<=96))trajectory.secondsPrimaryNearAnchor+=dt;
  if(mode!=='basic-only')for(const skill of getSkillState(g)){
   if(skill.remaining>1e-8)continue;
   if(mode==='anchor-maintained-basic'&&skill.id!=='markBlade')continue;
   if(['dash','quickCut'].includes(skill.id)&&distance>90)continue;
   if(['blinkStrike','blinkStorm'].includes(skill.id)&&(!g.heroState.blinkAnchors.some(a=>a.remaining>0)||g.heroState.blinkTravel))continue;
   // One keyboard-equivalent aim at the first target; actual Q creates real anchors and all cooldowns are natural.
   attempts[skill.id]=(attempts[skill.id]||0)+1;
   if(castSkill(g,skill.id,direction(g)))casts[skill.id]=(casts[skill.id]||0)+1;
  }
  const moving=g.player.dash||g.heroState.blinkTravel;
  const delta={x:origin.x-g.player.x,y:origin.y-g.player.y},length=Math.hypot(delta.x,delta.y);
  const input=mode==='skill-cycle'&&!moving&&length>12?{x:delta.x/length,y:delta.y/length}:{x:0,y:0};
  updateGame(g,dt,input);
  bounds.maxProjectiles=Math.max(bounds.maxProjectiles,g.heroKit?.projectiles?.length||0);
  bounds.maxHeroEffects=Math.max(bounds.maxHeroEffects,g.heroEffects.length);
  bounds.maxPending=Math.max(bounds.maxPending,g.jobMechanics?.pending?.length||0);
  bounds.maxCompanions=Math.max(bounds.maxCompanions,g.companions.length);
  bounds.maxAnchors=Math.max(bounds.maxAnchors,g.heroState.blinkAnchors.length);
  bounds.maxBasicShotSerial=Math.max(bounds.maxBasicShotSerial,g.heroKit?.mainSerial||0);
  assert.equal(g.phase,'playing');
 }
 const damage=Object.fromEntries(sources.map(k=>[k,Math.round((g.stats.damageBySource[k]||0)*100)/100])),hits=Object.fromEntries(sources.map(k=>[k,g.stats.damageHits[k]||0]));
 for(const value of Object.values(damage))assert.ok(Number.isFinite(value)&&value>=0);
 assert.ok(Math.abs(Object.values(g.stats.damageBySource).reduce((n,v)=>n+v,0)-g.stats.damageDealt)<1e-6);
 assert.ok(bounds.maxAnchors<=4&&bounds.maxCompanions<=4&&bounds.maxPending<30&&bounds.maxProjectiles<100&&bounds.maxBasicShotSerial<250);
 const total=Object.values(damage).reduce((n,v)=>n+v,0),heroTotal=total-damage.common;
 return {job:job.id,hero:job.heroId,stage:stage.stage,rank:stage.rank,branch:stage.branch,growthStats:stage.stats,scenario,mode,layout,commons,damage,hits,totalDamage:Math.round(total*100)/100,heroShare:total?Math.round(heroTotal/total*1e4)/100:0,basicShotLaunches:bounds.maxBasicShotSerial,successfulCasts:casts,attemptedCasts:attempts,bounds,trajectory:{secondsOutsideHome:Math.round(trajectory.secondsOutsideHome*100)/100,maxDistanceFromHome:Math.round(trajectory.maxDistanceFromHome),secondsPrimaryNearAnchor:Math.round(trajectory.secondsPrimaryNearAnchor*100)/100}};
}
const rows=[];
for(const job of Object.values(HERO_JOBS))for(const stage of stages)for(const scenario of ['boss','crowd20'])for(const commons of [[],['orb','frost']])for(const mode of ['basic-only','skill-cycle'])rows.push(sample(job,stage,scenario,commons,mode));
const fixedStatRows=[];for(const job of Object.values(HERO_JOBS))for(const stage of stages)for(const scenario of ['boss','crowd20'])for(const mode of ['basic-only','skill-cycle'])fixedStatRows.push(sample(job,{...stage,stage:`fixed-stats2-${stage.stage}`,stats:2},scenario,[],mode));
const compactAnchorRows=[];for(const job of Object.values(HERO_JOBS).filter(j=>j.heroId==='blink'))for(const branch of ['a','b'])for(const scenario of ['boss','crowd20'])for(const mode of ['anchor-maintained-basic','skill-cycle'])compactAnchorRows.push(sample(job,{stage:`compact-IV${branch}`,rank:4,branch,stats:4},scenario,[],mode,'anchor-compact'));
const comparisons=[];
for(const job of Object.values(HERO_JOBS))for(const mode of ['basic-only','skill-cycle'])for(const commons of [[],['orb','frost']]){
 const find=(branch,scenario)=>rows.find(r=>r.job===job.id&&r.branch===branch&&r.mode===mode&&r.scenario===scenario&&r.commons.length===commons.length);
 const bossA=find('a','boss'),bossB=find('b','boss'),crowdA=find('a','crowd20'),crowdB=find('b','crowd20');
 const heroDamage=r=>r.totalDamage-r.damage.common;
 const aBoss=heroDamage(bossA),bBoss=heroDamage(bossB),aCrowd=heroDamage(crowdA),bCrowd=heroDamage(crowdB);
 comparisons.push({job:job.id,mode,commons,boss:{a:aBoss,b:bBoss},crowd20:{a:aCrowd,b:bCrowd},strictlyDominatedBranch:aBoss>bBoss&&aCrowd>bCrowd?'b':bBoss>aBoss&&bCrowd>aCrowd?'a':null});
}
const monotonicIssues=[];
for(const job of Object.values(HERO_JOBS))for(const scenario of ['boss','crowd20'])for(const mode of ['basic-only','skill-cycle'])for(const commons of [[],['orb','frost']]){
 const path=stages.slice(0,3).map(s=>rows.find(r=>r.job===job.id&&r.stage===s.stage&&r.scenario===scenario&&r.mode===mode&&r.commons.length===commons.length));
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];if(b.totalDamage-b.damage.common<a.totalDamage-a.damage.common)monotonicIssues.push({job:job.id,scenario,mode,commons,from:a.stage,to:b.stage,heroDamageBefore:a.totalDamage-a.damage.common,heroDamageAfter:b.totalDamage-b.damage.common});}
}
const fixedStatIssues=[];
for(const job of Object.values(HERO_JOBS))for(const scenario of ['boss','crowd20'])for(const mode of ['basic-only','skill-cycle'])for(const branch of ['a','b']){
 const path=[1,2,3,4].map(rank=>fixedStatRows.find(r=>r.job===job.id&&r.rank===rank&&(rank!==4||r.branch===branch)&&r.scenario===scenario&&r.mode===mode));
 for(let i=1;i<path.length;i++)if(path[i].totalDamage+1e-8<path[i-1].totalDamage)fixedStatIssues.push({job:job.id,scenario,mode,branch,fromRank:i,toRank:i+1,before:path[i-1].totalDamage,after:path[i].totalDamage});
}
const compactAnchorComparisons=[];
for(const job of Object.values(HERO_JOBS).filter(j=>j.heroId==='blink'))for(const scenario of ['boss','crowd20'])for(const mode of ['anchor-maintained-basic','skill-cycle']){
 const a=compactAnchorRows.find(r=>r.job===job.id&&r.branch==='a'&&r.scenario===scenario&&r.mode===mode),b=compactAnchorRows.find(r=>r.job===job.id&&r.branch==='b'&&r.scenario===scenario&&r.mode===mode);
 compactAnchorComparisons.push({job:job.id,scenario,mode,basicAndSecondary:{a:a.damage.basic+a.damage.basicSecondary,b:b.damage.basic+b.damage.basicSecondary},secondaryHits:{a:a.hits.basicSecondary,b:b.hits.basicSecondary},secondsPrimaryNearAnchor:a.trajectory.secondsPrimaryNearAnchor});
}
const report={generatedAt:new Date().toISOString(),regenerationReason:'Final local bug fix: blink_master I/II E/R completion now produces its promised 20% afterimage blade; III strengthens it to35%. Mage fire/three-phase splash radius now inherits area and matches FX. Full bounded fixture rerun refreshes affected counts and final root integration.',seconds,step:dt,fixture:{seed:20261011,jobCount:9,rows:rows.length,stageDefinitions:stages,permanentBonus:'none; runtime growth stats paired with each stage, so I-to-IV differences include shared stat growth',loadout:'each hero original Q/E/R for every job, no unlocked advanced skill swaps',enemies:'immortal stationary targets, zero outgoing damage, no spawn, no XP, no maps/walls, deterministic full-circle crowd',positioning:'hero-specific initial ranges (commander/summoner80, blink180, mage100); group twenty on three staggered radii around hero. Skill mode walks back to home after movement, never teleports hero/targets, dash skipped when displaced >90.',modes:'basic-only uses production full update with no active casts (summoner starter companion remains); skill-cycle casts original skills at natural cooldowns and requires real blink anchors, no cooldown resets.',commonLoadout:'none or orb/frost Lv3, no evolution',attribution:'production stats.damageBySource and damageHits; hits count actual damage applications, not unique reaction/proc events. basicShotLaunches counts main attack launches; successfulCasts records natural skill triggers.',appendices:{fixedStatRows:'all 9 jobs, all ranks and both modes, zero common, identical shared stats rank2 (duration2) and zero permanent bonus to isolate pure attack rank.',compactAnchorRows:'blink/base-master, Boss and 20 enemies packed around real Q anchor at +240. Q naturally maintains anchors for 30s in anchor-maintained-basic (Q active damage counted separately); skill-cycle also runs E/R naturally. No anchor lifetime or cooldown reset.'},limits:['Controlled damage evidence only; different hero ranges prevent fair cross-hero ranking.','No incoming attack means guards, healing, avoidance, wall interception and utility have no survival value.','Targets do not die or dodge; this overstates many areas and does not test death cancellation (covered separately).','Crowd ring rewards surrounding coverage; another lane/chokepoint arrangement may change branch value. Dominance here is a fixture finding, not universal proof.','Stages include shared stat upgrades; separate unchanged-stat comparison is needed for pure rank causality.','Real input, renderer/audio readability and encounter pressure require browser/manual acceptance.']},rows,fixedStatRows,compactAnchorRows,comparisons,monotonicIssues,fixedStatIssues,compactAnchorComparisons};
const output=resolve(root,'output/hero-progression/balance.json');await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,rows:rows.length,fixedStatRows:fixedStatRows.length,compactAnchorRows:compactAnchorRows.length,monotonicIssues:monotonicIssues.length,dominated:comparisons.filter(r=>r.strictlyDominatedBranch).map(r=>({job:r.job,mode:r.mode,commons:r.commons,branch:r.strictlyDominatedBranch}))},null,2));
