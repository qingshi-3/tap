import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { scheduleOrdinaryRanged,launchOrdinaryShot } from '../dist/ranged-pressure.js';
import { createGame,startGame,updateGame,togglePause,castSkill } from '../dist/simulation.js';

const cases=[];
function test(name,fn){fn();cases.push({name,passed:true});}
function fixture(count=1){
  const g=createGame({seed:19,duration:10000});startGame(g);g.viewport={width:844,height:390};
  g.mapObjects=[];g._spawnClock=g._attackClock=g._orbClock=g._daggerClock=g._lightningClock=g._frostClock=1e6;
  g.heroKit={heroId:'commander',attackClock:1e6,combo:0,statuses:[]};
  g.enemies=Array.from({length:count},(_,i)=>({id:g._nextId++,kind:'archer_elite',x:1450+(i%4)*10,y:850+Math.floor(i/4)*15,radius:18,hp:10000,maxHp:10000,damage:12,speed:0,xp:1,spawnDelay:0,anim:'move',animTime:0,hitFlash:0,aiClock:0}));
  return g;
}
function tick(g,n,input={x:0,y:0}){for(let i=0;i<n;i++)updateGame(g,1/60,input);}
test('pure scheduler: twenty shooters share caps, stagger and fair rotation (collision excluded)',()=>{
  const g=fixture(20),seen=new Set(),owners=new Set(),times=[];let maxLive=0,maxWarning=0;
  for(let i=0;i<1800&&g.phase==='playing';i++){
    // Isolated scheduling pressure excludes collision; real updateGame dodge/hit is checked separately.
    g.time+=1/60;scheduleOrdinaryRanged(g,1/60);
    for(const e of g.enemies)if(e.attackWarning){e.attackWarning.remaining-=1/60;if(e.attackWarning.remaining<=0&&launchOrdinaryShot(g,e,e.attackWarning)){e.attackWarning=null;e.aiClock=2.5;}}
    for(const shot of g.enemyProjectiles)shot.life-=1/60;
    g.enemyProjectiles=g.enemyProjectiles.filter(shot=>shot.life>0);
    const warnings=g.enemies.filter(e=>e.attackWarning?.type==='shot');
    maxLive=Math.max(maxLive,g.enemyProjectiles.length);maxWarning=Math.max(maxWarning,warnings.length);
    assert(warnings.length<=2);assert(g.enemyProjectiles.length+warnings.length<=6);
    for(const s of g.enemyProjectiles)if(!seen.has(s.id)){seen.add(s.id);owners.add(s.ownerId);times.push(g.time);assert.equal(s.kind,'enemyOrb');assert.equal(s.radius,8);assert.equal(s.damage,12);assert(Math.abs(Math.hypot(s.vx,s.vy)-125)<1e-8);}
  }
  assert.equal(g.phase,'playing');assert(Math.abs(g.time-30)<1e-6);assert(times.length>30);for(let i=1;i<times.length;i++)assert(times[i]-times[i-1]>=.35-1e-8);
  assert.equal(owners.size,20);cases.push({maxLive,maxWarning,shots:times.length,seconds:g.time,scope:'pure scheduler, collision excluded'});
});
test('warning is visible for at least .6 seconds, locks aim, walking dodges while standing is hit',()=>{
  const still=fixture();tick(still,35);assert.equal(still.enemyProjectiles.length,0);assert(still.enemies[0].attackWarning);
  tick(still,150);assert(still.stats.damageTakenBySource.projectile>0);
  const move=fixture();tick(move,1);const angle=move.enemies[0].attackWarning.angle;tick(move,40,{x:0,y:-1});
  assert.equal(move.stats.damageTakenBySource.projectile,0);assert(move.enemyProjectiles.length);assert(Math.abs(Math.atan2(move.enemyProjectiles[0].vy,move.enemyProjectiles[0].vx)-angle)<1e-8);
  tick(move,130,{x:0,y:-1});assert.equal(move.stats.damageTakenBySource.projectile,0);
});
test('real updateGame: changing slow keeps caps/spacing and zero warning wait below .35s',()=>{
  const g=fixture(20),seen=new Set(),times=[],zeroFrames=new Map();let maximumZeroWait=0;
  for(let i=0;i<360;i++){
    // Alternate the first warning owner between slowed and normal simulation time.
    g.enemies[0].slow=Math.floor(i/42)%2===0?2:0;
    tick(g,1);
    const warnings=g.enemies.filter(e=>e.attackWarning?.type==='shot');
    assert(warnings.length<=2);assert(warnings.length+g.enemyProjectiles.length<=6);
    for(const e of g.enemies){const n=e.attackWarning?.remaining<=0?(zeroFrames.get(e.id)||0)+1:0;zeroFrames.set(e.id,n);maximumZeroWait=Math.max(maximumZeroWait,n/60);}
    for(const s of g.enemyProjectiles)if(!seen.has(s.id)){seen.add(s.id);times.push(g.time);}
  }
  assert.equal(g.phase,'playing');assert(times.length>=6);
  for(let i=1;i<times.length;i++)assert(times[i]-times[i-1]>=.35-1e-8);
  assert(maximumZeroWait<=.35+1/60);cases.push({scope:'real updateGame, six seconds changing slow',maximumZeroWait,shots:times.length,hp:g.player.hp});
});
test('freeze cancels warning and thaw requires fresh warning; dead owner removes bullet',()=>{
  const g=fixture();tick(g,10);g.enemies[0].frozen=.8;tick(g,1);assert.equal(g.enemies[0].attackWarning,null);tick(g,40);assert.equal(g.enemyProjectiles.length,0);tick(g,60);assert(g.enemies[0].attackWarning||g.enemyProjectiles.length);
  tick(g,60);g.enemies[0].dead=true;g.enemies[0].deathLife=1;tick(g,1);assert.equal(g.enemyProjectiles.length,0);assert.equal(g.enemies[0].attackWarning,null);
});
test('pause preserves warning time; terminal clears shots and restart has clean scheduling',()=>{
  const g=fixture();tick(g,10);togglePause(g);const remaining=g.enemies[0].attackWarning.remaining,time=g.time;tick(g,100);assert.equal(g.time,time);assert.equal(g.enemies[0].attackWarning.remaining,remaining);togglePause(g);tick(g,35);assert(g.enemyProjectiles.length);
  g.player.hp=0;tick(g,1);assert.equal(g.phase,'defeat');assert.equal(g.enemyProjectiles.length,0);assert.equal(g.enemies[0].attackWarning,null);
  const fresh=fixture();assert(!fresh.rangedPressure);tick(fresh,1);assert.equal(fresh.enemies[0].attackWarning.total,.6);
});
test('short-phone offscreen archer approaches then warns; moving offscreen cancels without backfill',()=>{
  const g=fixture();g.viewport={width:667,height:320};const e=g.enemies[0];e.x=1200;e.y=620;e.speed=56;
  tick(g,245);assert(e.y>620);assert(e.attackWarning||g.enemyProjectiles.length);
  e.x=1900;tick(g,1);assert.equal(e.attackWarning,null);assert.equal(g.enemyProjectiles.length,0);
});
test('rock wall intercepts ordinary orbs before player damage',()=>{
  const g=fixture();g.enemies[0].x=1460;g.enemies[0].y=900;g.skillLoadout=['rockWall'];assert(castSkill(g,'rockWall',{x:1,y:0}));tick(g,200);assert.equal(g.stats.damageTakenBySource.projectile,0);assert(g.effects.some(e=>e.weapon==='rockWall')||g.enemyProjectiles.length===0);
});
await mkdir(new URL('../output/controls-polish/',import.meta.url),{recursive:true});
await writeFile(new URL('../output/controls-polish/ranged-checks.json',import.meta.url),JSON.stringify({passed:true,cases},null,2));
console.log(JSON.stringify({passed:true,cases},null,2));



