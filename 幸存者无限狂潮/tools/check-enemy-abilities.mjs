import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createGame, startGame, updateGame, togglePause, castSkill } from '../dist/simulation.js';
import { initEnemyAbility, updateEnemyAbility, updateEnemyHazards, pointHitsEnemyGeometry, onEnemyDamaged, cancelEnemyOwned } from '../dist/enemy-abilities.js';
import { getBattleCamera } from '../dist/battle-camera.js';

const cases = [];
function test(name, fn) { fn(); cases.push({ name, passed: true }); }
function fixture(id = 'faultwarden', viewport = { width: 844, height: 390 }) {
  const game = createGame({ seed: 19, duration: 10000 }); game.viewport = viewport;
  const e = { id: game._nextId++, boss: ['faultwarden','cinderweaver'].includes(id), elite: true, x: 1200, y: 900,
    hp: 1000, maxHp: 1000, radius: 28, damage: 20, speed: 0, xp: 5, hitFlash: 0, anim: 'move', animTime: 0, spawnDelay: 0, facing: 1 };
  game.enemies = [e]; if (e.boss) game.boss = e;
  initEnemyAbility(game,e,id); e.abilityState.remaining = 0;
  game.player.hp=game.player.maxHp=1000;
  const hits = [];
  const api = { hurtPlayer: n=>{game.player.hp-=n;hits.push({time:game.time,amount:n,target:'player'});},
    hurtCompanion: (c,n)=>{c.hp-=n;hits.push({time:game.time,amount:n,target:c.id});},
    damageEnemy: (target,n)=>{if(target.dead)return;target.hp-=n;if(target.hp<=0){target.dead=true;game.kills++;game.gems.push({value:target.xp});cancelEnemyOwned(game,target.id);}}, random:()=>.5 };
  function tick(seconds, move=null) { for(let i=0;i<Math.ceil(seconds*60);i++){if(move)move(game,e,i);game.time+=1/60;updateEnemyAbility(game,e,1/60,api);updateEnemyHazards(game,1/60,api);} }
  return {game,e,api,hits,tick};
}
function warning(f) { return f.game.enemyHazards.filter(h=>h.type==='warning'); }
function forceMove(f,index) { Object.assign(f.e.abilityState,{stage:'idle',index,remaining:0}); }
function integrate(f) {
  startGame(f.game); f.game._attackClock=1e6;f.game._spawnClock=1e6; f.game.player.xpNext=1e6;
  // Suspend automatic player attacks only in collision/lifecycle fixtures, so
  // tests observe the chosen source without an unrelated auto-attack killing it.
  f.game.heroKit={heroId:'commander',attackClock:1e6,combo:0,element:0,shots:0,empowered:0,empoweredTime:0,focusId:null,focusTime:0,afterimage:0,afterimageTime:0,statuses:[]};
  f.game._orbClock=f.game._daggerClock=f.game._lightningClock=f.game._frostClock=1e6;
}

test('shared line/sector/ring geometry, gap edges and inner-circle safety',()=>{
  const line={shape:'line',x:0,y:0,toX:240,toY:0,width:42};
  assert(pointHitsEnemyGeometry({x:120,y:20,radius:0},line));assert(!pointHitsEnemyGeometry({x:120,y:22,radius:0},line));
  const sector={shape:'sector',x:0,y:0,radius:120,width:110*Math.PI/180,angle:0};
  assert(pointHitsEnemyGeometry({x:90,y:0},sector));assert(!pointHitsEnemyGeometry({x:-90,y:0},sector));
  const ring={shape:'ring',x:0,y:0,innerRadius:90,outerRadius:112,gapAngle:0,gapWidth:100*Math.PI/180};
  assert(!pointHitsEnemyGeometry({x:30,y:0,radius:18},ring));assert(!pointHitsEnemyGeometry({x:101,y:0,radius:18},ring));
  assert(pointHitsEnemyGeometry({x:-101,y:0,radius:18},ring));
});
test('wedge locks its target, cannot hit before 1.15s, walking escapes',()=>{
  const f=fixture();f.tick(1/60);const g={...warning(f)[0]};assert.equal(f.hits.length,0);
  f.tick(.9,game=>{game.player.x+=205/60;});assert.equal(f.hits.length,0);
  assert.equal(warning(f)[0].x,g.x);f.tick(.4);assert.equal(f.hits.length,0);
  assert.equal(f.game.enemyHazards.filter(h=>h.type==='scar').length,1);
});
test('stationary wedge hits once; same-place second wedge keeps one scar',()=>{
  const f=fixture();f.tick(1.3);assert.equal(f.hits.length,1);assert.equal(f.hits[0].amount,16);
  f.tick(1.9);assert.equal(f.hits.length,2);assert.equal(f.game.enemyHazards.filter(h=>h.type==='scar').length,1);
});
test('two marks cap at two, fault length caps at 240, marks consume and recovery is 1.4s',()=>{
  const f=fixture();f.tick(1.2);f.game.player.x+=250;f.tick(1.9);
  assert.equal(f.game.enemyHazards.filter(h=>h.type==='scar').length,2);f.tick(.7);
  const h=warning(f)[0];assert.equal(h.shape,'line');assert(h.length<=240+.001);
  f.tick(1.3);assert.equal(f.game.enemyHazards.filter(h=>h.type==='scar').length,0);
  assert.equal(f.e.abilityState.stage,'rest');assert.equal(f.e.abilityState.total,1.4);
});
test('offscreen old marks cancel the loop instead of stalling or moving anchors',()=>{
  const f=fixture('faultwarden',{width:667,height:320});f.game.player.x=900;f.e.x=850;
  for(const x of [600,700])f.game.enemyHazards.push({ownerId:f.e.id,type:'scar',shape:'circle',x,y:900,radius:48,remaining:30,life:30});
  forceMove(f,2);f.tick(1/60);assert.equal(f.e.abilityState.stage,'rest');assert.equal(f.e.abilityState.index,0);assert.equal(f.game.enemyHazards.length,0);
});
test('low-health change finishes the current warning, cues and reorders sweep between wedges',()=>{
  const f=fixture();f.tick(.4);f.e.hp=440;assert.equal(f.e.abilityState.phase,1);f.tick(.8);
  assert.equal(f.e.abilityState.phase,2);assert.equal(f.e.abilityState.stage,'phase');
  f.tick(1.05);assert.equal(f.e.abilityState.move,'wedge');f.tick(1.9);assert.equal(f.e.abilityState.move,'sweep');
});
test('two complete boss loops retain caps and show their recovery windows',()=>{
  for(const id of ['faultwarden','cinderweaver'])for(const phase of [1,2]){
    const f=fixture(id);f.e.abilityState.phase=phase;if(phase===2)f.e.hp=440;
    const moves=new Set();for(let i=0;i<1200;i++){f.tick(1/60);moves.add(f.e.abilityState.move);
      assert(f.game.enemyHazards.filter(h=>h.type==='seed').length<=2);assert(f.game.enemyHazards.filter(h=>h.type==='scar').length<=2);}
    for(const move of id==='faultwarden'?['wedge','fault','sweep','recovery']:['sow','emberRing','ignite','recovery'])assert(moves.has(move),`${id}/${phase} missing ${move}`);
  }
});
test('cinder seed coordinates stay locked, ignite unions targets for one hit',()=>{
  const f=fixture('cinderweaver');f.tick(1/60);const x=warning(f)[0].x;f.game.player.x+=150;f.tick(.8);assert.equal(warning(f)[0].x,x);f.tick(.4);
  const seeds=f.game.enemyHazards.filter(h=>h.type==='seed');assert.equal(seeds[0].x,x);
  f.game.enemyHazards.push({...seeds[0],id:99,x:x+50,remaining:7,life:7,contacts:new Map()});
  f.game.player.x=x+25;f.hits.length=0;forceMove(f,3);f.tick(1/60);f.hits.length=0;f.tick(1.22);
  assert.equal(f.hits.filter(h=>h.amount===17).length,1);assert.equal(f.game.enemyHazards.filter(h=>h.type==='seed').length,0);
  assert.equal(f.e.abilityState.total,1.6);
});
test('short-screen ring shares actual bounds; safe gap and inner circle, one outside hit',()=>{
  for(const size of [{width:667,height:320},{width:844,height:390}])for(const route of ['gap','inner','outside']){
    const f=fixture('cinderweaver',size);f.game.player.x=f.e.x+90;forceMove(f,2);f.tick(1/60);
    if(size.height===320){f.e.y+=31;forceMove(f,2);f.tick(1/60);}
    const g=warning(f)[0];assert(g&&g.shape==='ring');const camera=getBattleCamera(f.game);assert(g.outerRadius<=f.e.y-camera.y-74+.001);
    if(route==='inner')f.game.player.x=f.e.x;else if(route==='outside')f.game.player.x=f.e.x-90;
    f.tick(1.1);assert.equal(f.hits.length,0);f.tick(1.3);
    assert.equal(f.hits.filter(h=>h.amount===18).length,route==='outside'?1:0);
  }
});
test('boss/elite danger budget is symmetric, pending attacks never queue a catch-up salvo',()=>{
  const f=fixture();forceMove(f,2);
  f.game.enemyProjectiles.push({kind:'laneShell',ownerId:99,life:2});f.tick(.5);assert.equal(warning(f).length,0);
  f.game.enemyProjectiles=[];f.tick(1/60);assert.equal(warning(f).length,1);
  const gun={id:99,x:1200,y:900,hp:500,maxHp:500,radius:20,damage:20,elite:true};f.game.enemies.push(gun);initEnemyAbility(f.game,gun,'laneGunner');gun.abilityState.remaining=0;
  assert.equal(updateEnemyAbility(f.game,gun,1/60,f.api),false);assert.equal(gun.abilityState.stage,'idle');
});
test('kiln aura is singular and protects only other ordinary neighbours without stacking',()=>{
  const f=fixture('kilnGuard');integrate(f);const ordinary={id:99,x:1250,y:900,hp:500,maxHp:500,radius:16,damage:0,speed:0,xp:0,spawnDelay:0,animTime:0,hitFlash:0};
  const otherElite={...ordinary,id:100,x:1260,elite:true};f.game.enemies.push(ordinary,otherElite);
  for(let i=0;i<55;i++)updateGame(f.game,1/60);assert.equal(f.game.enemyHazards.filter(h=>h.type==='aura').length,1);
  f.game.enemyHazards.push({...f.game.enemyHazards.find(h=>h.type==='aura'),id:111});
  const before=[ordinary.hp,otherElite.hp,f.e.hp];
  f.game.skills.cleave.remaining=0;assert(castSkill(f.game,'cleave',{x:1,y:0}));
  assert(Math.abs(before[0]-ordinary.hp-105*.65)<.001);assert.equal(before[1]-otherElite.hp,105);assert.equal(before[2]-f.e.hp,105);
  cancelEnemyOwned(f.game,f.e.id);assert.equal(f.game.enemyHazards.length,0);
});
test('gunner locks two parallel lanes with 72 clear units and fixed direction',()=>{
  const f=fixture('laneGunner');f.game.player.x+=180;f.tick(1/60);const lanes=warning(f).map(h=>({...h}));assert.equal(lanes.length,2);
  assert.equal(Math.hypot(lanes[1].x-lanes[0].x,lanes[1].y-lanes[0].y)-18,72);
  f.game.player.y+=25;f.tick(1);assert.equal(f.game.enemyProjectiles.length,2);
  for(const p of f.game.enemyProjectiles){assert.equal(p.vy,0);assert.equal(p.vx,155);assert(p.life<=300/155);}
  assert.equal(f.e.abilityState.total,1.5);
});
test('rock wall blocks enemy shells and high-speed swept shots hit instead of tunnelling',()=>{
  const f=fixture('laneGunner');integrate(f);f.e.abilityState.remaining=100;
  f.e.x=1300;
  f.game.fields.push({type:'rockWall',x:1200,y:900,angle:Math.PI,arcRadius:80,arcAngle:1,depth:20,segments:18,life:5,tick:99});
  f.game.enemyProjectiles.push({ownerId:f.e.id,x:1080,y:900,vx:6000,vy:0,radius:9,life:1,damage:20});
  updateGame(f.game,1/60);assert.equal(f.game.player.hp,1000);assert.equal(f.game.enemyProjectiles.length,0);
  f.game.fields=[];f.game.enemyProjectiles.push({ownerId:f.e.id,x:1150,y:900,vx:6000,vy:0,radius:9,life:1,damage:20});
  updateGame(f.game,1/60);assert.equal(f.game.player.hp,980);
});
test('boss hits use guard/shield and shared companion damage, not a bypass',()=>{
  const f=fixture();integrate(f);f.game.player.guardTime=5;f.game.player.commonShield=3;
  f.game.companions.push({id:98,x:1200,y:900,hp:200,maxHp:200,radius:20,damage:0,speed:0,anim:'idle',animTime:0,attackClock:99,invulnerable:0});
  for(let i=0;i<73;i++)updateGame(f.game,1/60);
  assert(Math.abs(f.game.player.hp-(1000-3.4))<.001);assert.equal(f.game.player.commonShield,0);assert.equal(f.game.companions[0].hp,184);
  assert(Math.abs(f.game.stats.damageTaken-3.4)<.001);
  assert(Math.abs(f.game.stats.damageTakenBySource.mechanic-3.4)<.001);assert.equal(f.game.stats.damageTakenBySource.projectile,0);
});
test('beetle actual-damage interruption, stagger/cooldown and no explosion',()=>{
  const f=fixture('blastBeetle');f.tick(.2);f.e.hp-=170;onEnemyDamaged(f.game,f.e,170);assert.equal(f.e.abilityState.stage,'warning');
  f.e.hp-=10;onEnemyDamaged(f.game,f.e,10);assert.equal(f.e.abilityState.stage,'rest');assert.equal(f.e.abilityState.total,1.2);
  f.tick(1.6);assert.equal(f.e.dead,undefined);assert.equal(f.hits.length,0);assert(f.e.abilityState.remaining>4);
});
test('beetle natural explosion awards once; damage kill is ordinary death with no posthumous bomb',()=>{
  const f=fixture('blastBeetle');f.tick(1.6);assert.equal(f.e.dead,true);assert.equal(f.game.kills,1);assert.equal(f.game.gems.length,1);assert.equal(f.hits.length,1);assert.equal(f.e.anim,'explode');f.tick(3);assert.equal(f.hits.length,1);assert.equal(f.game.kills,1);
  const killed=fixture('blastBeetle');integrate(killed);killed.e.hp=50;killed.e.maxHp=50;updateGame(killed.game,1/60);assert(castSkill(killed.game,'cleave',{x:1,y:0}));
  assert.equal(killed.e.anim,'death');assert.equal(killed.game.kills,1);assert.equal(killed.game.gems.length,1);assert.equal(killed.game.enemyHazards.length,0);
  for(let i=0;i<120;i++)updateGame(killed.game,1/60);assert.equal(killed.game.player.hp,1000);assert.equal(killed.game.kills,1);
});
test('pause/portrait/upgrade choice freeze warnings and resume keeps the remaining reaction time',()=>{
  const f=fixture();integrate(f);updateGame(f.game,.2);const remaining=f.e.abilityState.remaining;
  togglePause(f.game);updateGame(f.game,10);assert.equal(f.e.abilityState.remaining,remaining);togglePause(f.game);
  f.game.phase='portrait';updateGame(f.game,10);assert.equal(f.e.abilityState.remaining,remaining);
  f.game.phase='upgrade';updateGame(f.game,10);assert.equal(f.e.abilityState.remaining,remaining);f.game.phase='playing';
  updateGame(f.game,1/60);assert(f.e.abilityState.remaining>remaining-.02);assert.equal(f.game.player.hp,1000);
});
test('freeze holds both runtime geometry and warning timer; owner death clears damage and terminal states clear leftovers',()=>{
  const f=fixture();integrate(f);updateGame(f.game,1/60);const r=f.e.abilityState.remaining;f.e.frozen=.3;
  updateGame(f.game,.2);assert.equal(f.e.abilityState.remaining,r);assert.equal(warning(f)[0].remaining,r);
  f.game.enemyProjectiles.push({ownerId:f.e.id,x:1200,y:900,vx:0,vy:0,life:3,radius:9,damage:20});
  f.e.dead=true;cancelEnemyOwned(f.game,f.e.id);assert.equal(f.game.enemyHazards.length,0);assert.equal(f.game.enemyProjectiles.length,0);
  const dead=fixture();integrate(dead);dead.game.player.hp=1;for(let i=0;i<74;i++)updateGame(dead.game,1/60);
  assert.equal(dead.game.phase,'defeat');assert.equal(dead.game.enemyHazards.length,0);assert.equal(dead.game.enemyProjectiles.length,0);
});
test('public updateGame approaches a visible casting position at short-screen top and corner boundaries',()=>{
  for(const id of ['faultwarden','cinderweaver'])for(const corner of [false,true]){
    const f=fixture(id,{width:667,height:320});integrate(f);f.e.speed=60;
    f.game.player.y=18;if(corner)f.game.player.x=18;f.e.y=95;if(corner)f.e.x=95;
    forceMove(f,id==='faultwarden'?3:2);
    let started=false;for(let i=0;i<600;i++){updateGame(f.game,1/60);if(warning(f).length){started=true;break;}}
    assert(started,`${id} ${corner?'corner':'top'} did not find a readable casting position`);
    assert(f.e.y>=55+f.e.radius);if(corner)assert(f.e.x>=20+f.e.radius);
  }
});
test('natural explosion goes through death rewards but adds no player damage statistics',()=>{
  const f=fixture('blastBeetle');integrate(f);
  for(let i=0;i<98;i++)updateGame(f.game,1/60);
  assert.equal(f.game.kills,1);assert.equal(f.game.stats.damageDealt,0);assert.equal(f.game.stats.heroDamage,0);assert.equal(f.game.stats.commonDamage,0);
  assert.equal(f.e.anim,'explode');assert.equal(f.game.enemyHazards.length,0);assert.equal(f.game.player.xp,5);
});
test('two bosses at eight edges/corners lock real player snapshots, progress two cycles and punish standing still',()=>{
  const inset=18,positions=[['top',1200,inset],['bottom',1200,1800-inset],['left',inset,900],['right',2400-inset,900],
    ['top-left',inset,inset],['top-right',2400-inset,inset],['bottom-left',inset,1800-inset],['bottom-right',2400-inset,1800-inset]];
  for(const id of ['faultwarden','cinderweaver'])for(const [label,x,y] of positions){
    const f=fixture(id,{width:667,height:320});integrate(f);Object.assign(f.game.player,{x,y});
    f.e.x=Math.max(80,Math.min(2320,x));f.e.y=Math.max(80,Math.min(1720,y));f.e.speed=50;
    let lockWarnings=0,previousStage='';const snapshots=new Map(),moves=[];
    for(let i=0;i<2400;i++){
      updateGame(f.game,1/60);
      const s=f.e.abilityState;
      if(s.stage==='warning'&&previousStage!=='warning')moves.push(s.move);
      if(s.stage==='warning'&&previousStage!=='warning'&&(['wedge','sow'].includes(s.move))){
        if(s.move==='wedge'||s.index===0){assert.equal(s.geometry.x,f.game.player.x);assert.equal(s.geometry.y,f.game.player.y);lockWarnings++;}
      }
      for(const h of warning(f)){const old=snapshots.get(h.id);if(old){assert.equal(h.x,old.x);assert.equal(h.y,old.y);}else snapshots.set(h.id,{x:h.x,y:h.y});}
      previousStage=s.stage;
    }
    assert(lockWarnings>=4,`${id}/${label}: did not reach two point-lock cycles (${lockWarnings})`);
    const expected=id==='faultwarden'?['wedge','wedge','fault','sweep']:['sow','sow','emberRing','ignite'];
    assert.deepEqual(moves.slice(0,8),[...expected,...expected],`${id}/${label}: incomplete two-cycle choreography`);
    assert(f.game.stats.damageTaken>0,`${id}/${label}: stationary edge is a damage-free terrace`);
  }
});
test('ordinary inward/along-edge movement escapes both point-lock attacks at eight edges/corners',()=>{
  const positions=[[1200,18],[1200,1782],[18,900],[2382,900],[18,18],[2382,18],[18,1782],[2382,1782]];
  for(const id of ['faultwarden','cinderweaver'])for(const [x,y] of positions){
    const f=fixture(id,{width:667,height:320});integrate(f);Object.assign(f.game.player,{x,y});f.e.x=Math.max(80,Math.min(2320,x));f.e.y=Math.max(80,Math.min(1720,y));
    f.e.speed=50;updateGame(f.game,1/60);assert.equal(f.e.abilityState.stage,'warning');
    const locked={...f.e.abilityState.geometry};
    const input={x:x<1200?1:x>1200?-1:1,y:y<900?1:y>900?-1:0};
    for(let i=0;i<73;i++)updateGame(f.game,1/60,input);
    assert.equal(f.game.stats.damageTaken,0,`${id}/${x},${y} had no basic movement escape`);
    assert(!pointHitsEnemyGeometry(f.game.player,locked));
  }
});
test('first-dungeon normal caps, rest windows, elite isolation and capped-arrow reroll do not accumulate backfill',()=>{
  const ordinary=(id,kind='grunt')=>({id,kind,x:100,y:100,radius:16,hp:1e5,maxHp:1e5,speed:0,damage:0,xp:0,spawnDelay:0,anim:'move',animTime:0,hitFlash:0});
  for(const [time,cap] of [[0,24],[60,30],[120,36],[183.1,40],[240,44]]){
    const f=fixture();integrate(f);f.game.boss=null;f.game.dungeon={id:'moss-gate',enemies:['grunt'],eliteWaves:[],boss:null};f.game.time=time;f.game.enemies=Array.from({length:cap-1},(_,i)=>ordinary(100+i));f.game._spawnClock=0;
    f.game.duration=360;updateGame(f.game,1/60);assert.equal(f.game.enemies.filter(e=>!e.dead&&!e.elite&&!e.boss).length,cap);
  }
  for(const time of [22.1,87.1,90,92.8]){
    const f=fixture();integrate(f);f.game.boss=null;f.game.dungeon={id:'moss-gate',enemies:['grunt'],eliteWaves:[],boss:null};f.game.time=time;f.game.enemies=[];f.game._spawnClock=0;
    f.game.duration=360;updateGame(f.game,1/60);assert.equal(f.game.enemies.length,0);assert(f.game._spawnClock>0);
  }
  const f=fixture();integrate(f);f.game.boss=null;f.game.dungeon={id:'moss-gate',enemies:['archer_elite','grunt'],eliteWaves:[],boss:null};f.game.time=185;f.game.enemies=Array.from({length:6},(_,i)=>ordinary(100+i,'archer_elite'));f.game._spawnClock=0;
  f.game.duration=360;updateGame(f.game,1/60);assert.equal(f.game.enemies.filter(e=>e.kind==='archer_elite').length,6);assert(f.game.enemies.some(e=>e.kind==='grunt'));
  const boss=fixture();integrate(boss);boss.game.dungeon={id:'moss-gate',enemies:['grunt'],eliteWaves:[],boss:null};boss.game.time=305;boss.game.enemies.push(...Array.from({length:24},(_,i)=>ordinary(100+i)));boss.game._spawnClock=0;
  updateGame(boss.game,1/60);assert.equal(boss.game.enemies.filter(e=>!e.boss&&!e.elite).length,24);
});

const output = fileURLToPath(new URL('../output/enemy-content/behavior-checks.json', import.meta.url));
await mkdir(fileURLToPath(new URL('../output/enemy-content/',import.meta.url)),{recursive:true});
await writeFile(output,JSON.stringify({generatedAt:new Date().toISOString(),method:'Deterministic fixed-step ability fixtures plus public simulation damage, collision, pause and terminal-state checks. This is behavior evidence, not touch UX or balance acceptance.',cases},null,2)+'\n');
console.log(`${cases.length} behavior cases passed; ${output}`);
