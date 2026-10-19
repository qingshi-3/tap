import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createGame,configureRun,startGame} from '../dist/simulation.js';
import {HEROES,getHeroJobs} from '../dist/heroes.js';
import {updateOriginalHero,onOriginalEnemyDeath} from '../dist/original-heroes.js';
import {updateSpecialHero} from '../dist/special-heroes.js';
import {updateMythicHero} from '../dist/mythic-heroes.js';

// Deterministic kit-only pressure fixture: actual attack state machines and death
// hooks, no skills/common weapons/perks, no saves. Inward-moving targets are a
// controlled coverage comparison, not a natural-run balance or survival claim.
export function pressure(hero,tier,rank,branch,scenario='crowd'){
 const g=createGame({seed:31});configureRun(g,{heroId:hero,heroJob:getHeroJobs(hero)[tier-1].id});startGame(g);
 g.player.x=900;g.player.y=900;g.mapObjects=[];g.enemies=[];g.companions=[];g.heroEffects=[];g.attackProgress={rank,branch};g.growth={};g.heroPerks={};
 const total=scenario==='boss'?1:72,hp=scenario==='boss'?1e7:180,hurt=new Set(),samples=[];let damage=0,kills=0,closeExposure=0;
 for(let i=0;i<total;i++){const ring=Math.floor(i/18),a=(i%18)*Math.PI*2/18+ring*.17,r=scenario==='boss'?85:86+ring*62;g.enemies.push({id:1000+i,x:900+Math.cos(a)*r,y:900+Math.sin(a)*r,radius:16,kind:'grunt',hp,maxHp:hp,boss:scenario==='boss',speed:28,spawnDelay:0,facing:-1,anim:'idle',animTime:0,hitFlash:0,frozen:0,slow:0});}
 const api={damage(e,n,color,source){assert(Number.isFinite(n)&&n>=0);if(e.dead||e.hp<=0)return;damage+=Math.min(n,e.hp);e.hp-=n;hurt.add(e.id);if(e.hp<=0){e.dead=true;kills++;onOriginalEnemyDeath(g,e,api);}},movementHitsWall:()=>false,isUnsafePosition:()=>false};
 const update=['commander','summoner','blink','mage'].includes(hero)?updateOriginalHero:['grappler','rift','magnet'].includes(hero)?updateSpecialHero:updateMythicHero;
 for(let f=0;f<720;f++){g.time=f/60;for(const e of g.enemies){if(e.dead)continue;e.frozen=Math.max(0,e.frozen-1/60);e.slow=Math.max(0,e.slow-1/60);const d=Math.hypot(e.x-900,e.y-900);if(d<100)closeExposure+=1/60;if(scenario==='crowd'&&!e.specialHeld&&!e.frozen&&d>42){const step=Math.min(d-42,28/60*(e.slow?.55:1));e.x+=(900-e.x)/d*step;e.y+=(900-e.y)/d*step;}}update(g,1/60,api);assert.equal(g.player.x,900,'basics must not move the player');assert.equal(g.player.y,900);if([179,359,719].includes(f))samples.push({seconds:(f+1)/60,kills,hitTargets:hurt.size,damage:Math.round(damage),closeExposure:Math.round(closeExposure)});}
 return {hero,tier,rank,branch,scenario,kills,hitTargets:hurt.size,damage:Math.round(damage),closeExposure:Math.round(closeExposure),samples};
}
const output=new URL('../output/basic-pressure/',import.meta.url);await mkdir(output,{recursive:true});
const baseline=process.argv.includes('--baseline');const rows=[];
for(const hero of HEROES)for(const tier of[2,3])for(const [rank,branch]of[[1,null],[3,null],[4,'a'],[4,'b']])for(const scenario of['crowd','boss'])rows.push(pressure(hero.id,tier,rank,branch,scenario));
const report={fixture:'72 targets, 180HP, 12 seconds, no actives/growth/perks; controlled inward movement, no player/army contact damage. Boss isolates concentrated output.',rows};
if(!baseline){
 const old=JSON.parse(await readFile(new URL('baseline.json',output),'utf8'));
 const key=r=>[r.hero,r.tier,r.rank,r.branch,r.scenario].join('/'),previous=new Map(old.rows.map(r=>[key(r),r]));
 report.comparisons=rows.map(r=>{const b=previous.get(key(r));assert(b,`Missing baseline ${key(r)}`);return {...r,oldKills:b.kills,oldTargets:b.hitTargets,damageRatio:Math.round(r.damage/Math.max(1,b.damage)*100)/100};});
 // A high-tier crowd weapon must clear earlier, not only reach the same final
 // result after every enemy has piled onto the player. Keep concentrated output.
 for(const r of rows.filter(r=>r.tier===3&&r.rank===4)){
  const b=previous.get(key(r));
  if(r.scenario==='crowd'&&r.branch==='a')assert(r.samples[1].kills>=b.samples[1].kills+Math.min(3,72-b.samples[1].kills),`${r.hero} must open space earlier at 6 seconds`);
  if(r.scenario==='boss')assert(r.damage>=b.damage*.9,`${r.hero}/${r.branch} must not lose concentrated hits through the new routing`);
 }
 report.passed=true;
}
await writeFile(new URL(baseline?'baseline.json':'current.json',output),JSON.stringify(report,null,2),{flag:baseline?'wx':'w'});
console.log(JSON.stringify({baseline,passed:report.passed,cases:rows.length,results:(report.comparisons||rows).filter(r=>r.tier===3&&r.rank===4&&r.branch==='a'&&r.scenario==='crowd').map(r=>({hero:r.hero,killsAt6:r.samples[1].kills,killsAt12:r.kills,oldKillsAt12:r.oldKills}))}));
