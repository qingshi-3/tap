import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, configureRun, startGame, updateGame, chooseUpgrade, castSkill, getHud } from '../dist/simulation.js';
import { DUNGEONS } from '../dist/campaign.js';
import { getHero } from '../dist/heroes.js';
import { getOwnedCommon } from '../dist/growth.js';
import { getBlinkAnchors } from '../dist/skill-targeting.js';

const STEP=1/30, CAP_SECONDS=900, HERO_IDS=['commander','summoner','blink','mage'];
const here=dirname(fileURLToPath(import.meta.url));
const length=(x,y)=>Math.hypot(x,y)||1;
const unit=(x,y)=>{const d=length(x,y);return{x:x/d,y:y/d}};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const readyEnemy=e=>!e.dead&&(e.spawnDelay||0)<=0;

function nearest(origin,items){let found=null,best=Infinity;for(const item of items){const d=distance(origin,item);if(d<best){best=d;found=item}}return found?{item:found,distance:best}:null}
function enemyAim(game){const target=nearest(game.player,game.enemies.filter(readyEnemy))?.item;return target?unit(target.x-game.player.x,target.y-game.player.y):{x:game.player.facing||1,y:0}}
function lineDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)}

function movement(game,heroId){
  const p=game.player,enemies=game.enemies.filter(readyEnemy),near=nearest(p,enemies),low=p.hp/p.maxHp<.72;
  const heal=low?nearest(p,game.supplies.filter(s=>!s.collected&&s.type==='heal')):null,gem=nearest(p,game.gems.filter(g=>!g.collected));
  const candidates=[{x:0,y:0},...Array.from({length:16},(_,i)=>({x:Math.cos(i*Math.PI/8),y:Math.sin(i*Math.PI/8)}))],look=.42,speed=p.speed||205;
  let best=candidates[0],bestScore=-Infinity;
  for(const move of candidates){const at={x:p.x+move.x*speed*look,y:p.y+move.y*speed*look};let score=0;
    const edge=Math.min(at.x,at.y,game.world.width-at.x,game.world.height-at.y);if(edge<90)score-=(90-edge)*8;
    for(const e of enemies){const d=distance(at,e),contact=(e.radius||20)+(p.radius||18)+24;if(d<contact)score-=900+(contact-d)*18;else if(d<150)score-=(150-d)*3.5;if(e.boss&&d<230)score-=120;}
    for(const fx of game.effects.filter(e=>e.hostile||e.type==='telegraph')){const radius=fx.radius||fx.length||0;if((fx.shape==='circle'||fx.type==='bossSlam')&&distance(at,fx)<radius+(p.radius||18))score-=1100;else if(fx.shape==='line'&&lineDistance(at,fx,{x:fx.toX??fx.x+Math.cos(fx.angle||0)*(fx.length||320),y:fx.toY??fx.y+Math.sin(fx.angle||0)*(fx.length||320)})<(fx.width||70)/2+(p.radius||18))score-=900;}
    if(heal&&heal.distance<650)score+=Math.max(0,520-distance(at,heal.item))*1.8;
    if(gem&&gem.distance<320)score+=Math.max(0,260-distance(at,gem.item))*.22;
    if(near){const desired=heroId==='commander'?88:245,after=distance(at,near.item);score-=Math.abs(after-desired)*(heroId==='commander'?.32:.18);}
    if(move.x||move.y)score+=3;
    if(score>bestScore){bestScore=score;best=move}
  }
  return best;
}

function useSkills(game,heroId){
  const aim=enemyAim(game),enemies=game.enemies.filter(readyEnemy),crowd=enemies.filter(e=>distance(game.player,e)<125).length;
  if(heroId==='commander'){
    if(crowd>=4&&game.skills.dash.remaining<=0){const close=nearest(game.player,enemies)?.item,n=close?unit(game.player.x-close.x,game.player.y-close.y):aim;castSkill(game,'dash',n)}
    if(game.skills.cleave.remaining<=0)castSkill(game,'cleave',aim);
    if((crowd>=2||game.player.hp/game.player.maxHp<.55)&&game.skills.guard.remaining<=0)castSkill(game,'guard',aim);
  }else if(heroId==='summoner'){
    if(game.skills.summonElite.remaining<=0)castSkill(game,'summonElite',aim);
    if(game.companions.some(c=>c.hp/c.maxHp<.55)&&game.skills.recallSummons.remaining<=0)castSkill(game,'recallSummons',aim);
    if(game.companions.filter(c=>!c.elite).length<3&&game.skills.summonGuard.remaining<=0)castSkill(game,'summonGuard',aim);
  }else if(heroId==='blink'){
    if(game.heroState.blinkTravel)return;
    if(game.skills.markBlade.remaining<=0)castSkill(game,'markBlade',aim);
    const anchors=getBlinkAnchors(game);
    if(anchors.length>=2&&game.skills.blinkStorm.remaining<=0)castSkill(game,'blinkStorm',aim);
    else if(anchors.length&&game.skills.blinkStrike.remaining<=0)castSkill(game,'blinkStrike',{...aim,anchorId:anchors[0].id});
  }else{
    if(game.skills.frostAura.remaining<=0)castSkill(game,'frostAura',aim);
    if(game.skills.rockWall.remaining<=0&&crowd>=2)castSkill(game,'rockWall',aim);
    if(game.skills.flameBreath.remaining<=0)castSkill(game,'flameBreath',aim);
  }
}

function choiceScore(game,c){
  const owned=getOwnedCommon(game),newCommon=c.category==='common'&&!game.upgrades[c.weaponId];
  if(c.id==='supply:heal')return game.player.hp/game.player.maxHp<.55?95:5;
  if(newCommon)return owned.length<2?120:-100;
  if(c.category==='evolution')return 105;
  if(c.category==='common')return 100;
  if(c.category==='heroSkill')return 92;
  if(c.category==='hero')return 86;
  if(c.category==='stat')return c.id==='stat:damage'||c.id==='stat:attackSpeed'?76:68;
  return 20;
}
function choose(game){const selected=[...game.choices].sort((a,b)=>choiceScore(game,b)-choiceScore(game,a))[0];return selected?chooseUpgrade(game,selected.id):false}

function snapshotBuild(game){return{commons:Object.fromEntries(Object.entries(game.upgrades).filter(([,rank])=>rank>0)),evolutions:{...game.evolutions},heroPerks:{...game.heroPerks},growth:{...game.growth}}}
function runEncounter(heroId,seed){
  const hero=getHero(heroId),game=createGame({seed,duration:DUNGEONS[0].duration});
  configureRun(game,{dungeon:DUNGEONS[0],heroId,heroKind:hero.kind,heroName:hero.name,heroJob:hero.job,heroSkills:hero.skills.map(s=>s.id)});startGame(game);
  const peak={enemies:0,projectiles:0,enemyProjectiles:0,commonEntities:0,effects:0,heroEffects:0,companions:game.companions.length};
  let wallSeconds=0,upgrades=0,bossSeen=false;
  while(!['victory','defeat'].includes(game.phase)&&wallSeconds<CAP_SECONDS){
    if(game.phase==='upgrade'){if(choose(game))upgrades++;else break}
    else {if(game.phase==='playing')useSkills(game,heroId);updateGame(game,STEP,movement(game,heroId))}
    wallSeconds+=STEP;bossSeen ||= !!game.boss;
    peak.enemies=Math.max(peak.enemies,game.enemies.length);peak.projectiles=Math.max(peak.projectiles,game.projectiles.length);peak.enemyProjectiles=Math.max(peak.enemyProjectiles,game.enemyProjectiles.length);peak.commonEntities=Math.max(peak.commonEntities,game.commonEntities.length);peak.effects=Math.max(peak.effects,game.effects.length);peak.heroEffects=Math.max(peak.heroEffects,game.heroEffects.length);peak.companions=Math.max(peak.companions,game.companions.length);
  }
  const hud=getHud(game),owned=getOwnedCommon(game);
  return{hero:heroId,seed,result:game.phase,simTime:+game.time.toFixed(2),wallSteps:Math.round(wallSeconds/STEP),hp:+game.player.hp.toFixed(2),maxHp:game.player.maxHp,level:game.player.level,xp:+game.player.xp.toFixed(2),upgrades,ownedCommon:owned.map(w=>w.id),commonSlots:owned.length,bossSeen,bossHpRemaining:hud.boss?+hud.boss.hp.toFixed(2):null,kills:game.kills,heroDamage:+game.stats.heroDamage.toFixed(2),commonDamage:+game.stats.commonDamage.toFixed(2),totalDamage:+game.stats.damageDealt.toFixed(2),build:snapshotBuild(game),peakEntities:peak};
}

const runs=[];for(const hero of HERO_IDS)for(const seed of[1103,7717])runs.push(runEncounter(hero,seed));
const flags=[];
for(const run of runs){if(run.commonSlots>2)flags.push({type:'slot-overflow',hero:run.hero,seed:run.seed,value:run.commonSlots});if(run.totalDamage<=0)flags.push({type:'zero-damage',hero:run.hero,seed:run.seed});if(run.simTime>=300&&!run.bossSeen)flags.push({type:'boss-never-appeared',hero:run.hero,seed:run.seed});if(run.peakEntities.enemies>170||run.peakEntities.commonEntities>200||run.peakEntities.projectiles>200)flags.push({type:'entity-growth',hero:run.hero,seed:run.seed,peak:run.peakEntities})}
if(runs.every(r=>r.level<5))flags.push({type:'gross-progression-stall',levels:runs.map(r=>r.level)});
if(runs.every(r=>r.result==='defeat'&&!r.bossSeen))flags.push({type:'all-runs-defeated-before-boss',timeRange:[Math.min(...runs.map(r=>r.simTime)),Math.max(...runs.map(r=>r.simTime))],note:'Boss-health pacing could not be assessed because this deterministic bot never reached the boss. Treat as a survivability/heuristic warning, not a human-play verdict.'});
const summary={runs:runs.length,victories:runs.filter(r=>r.result==='victory').length,defeats:runs.filter(r=>r.result==='defeat').length,capped:runs.filter(r=>!['victory','defeat'].includes(r.result)).length,levelRange:[Math.min(...runs.map(r=>r.level)),Math.max(...runs.map(r=>r.level))],damageRange:[Math.min(...runs.map(r=>r.totalDamage)),Math.max(...runs.map(r=>r.totalDamage))],flags};
const report={generatedAt:new Date().toISOString(),dungeon:{id:DUNGEONS[0].id,name:DUNGEONS[0].name,duration:DUNGEONS[0].duration,boss:DUNGEONS[0].boss},method:'Public simulation APIs, unchanged first-dungeon clock and spawns, base hero bonuses, 16-direction short-horizon danger avoidance, safe pickup routing, deterministic skill use, and only offered upgrades.',methodRevision:'Replaces an invalid first helper whose heal lookup used the wrong supply field and whose gem routing overrode danger avoidance.',caveat:'Bot tuning evidence only. Its movement, aiming, pickup routing, and skill timing are not a human-play verdict or a required win-rate target.',summary,runs};
const output=resolve(here,'../output/dual-axis-encounters.json');await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));console.log(`wrote ${output}`);
