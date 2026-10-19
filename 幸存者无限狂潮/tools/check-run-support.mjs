import assert from 'node:assert/strict';
import {createGame,configureRun,startGame,updateGame,canRevive,reviveGame,canRerollUpgrade,rerollUpgrade} from '../dist/simulation.js';
import {makeUpgradeChoices,buildUpgradePool,GROWTH_STATS,findAlternativeUpgradeChoices} from '../dist/growth.js';
import {WEAPONS} from '../dist/combat-content.js';
import {HERO_PERKS} from '../dist/hero-kit.js';
function run(seed=7){const g=createGame({seed,duration:1e6});configureRun(g);startGame(g);g.time=65;g._spawnClock=g._nextSupplyAt=1e9;return g;}
function foe(g,id=1){return {id,kind:'grunt',x:g.player.x,y:g.player.y,radius:17,hp:1e9,maxHp:1e9,speed:0,damage:1000,xp:0,spawnDelay:0,anim:'move',animTime:0};}
function kill(g){g.player.hp=1;g.player.invulnerable=0;g.enemies.push(foe(g));updateGame(g,1/60);assert.equal(g.phase,'defeat');}
function draft(g){g.phase='upgrade';g._pendingLevels=2;g.choices=makeUpgradeChoices(g,()=>.3);}
const signature=g=>g.choices.map(c=>c.id).sort().join('|');
const build=g=>JSON.stringify({upgrades:g.upgrades,growth:g.growth,evolutions:g.evolutions,attack:g.attackProgress,stats:g.stats,hp:g.player.hp,level:g.player.level,pending:g._pendingLevels});
{
 const g=run();g.boss={hp:321,maxHp:999,dead:false};g.heroState.blinkAnchors=[{id:10,x:10,y:10,remaining:14}];
 g.enemyHazards=[{ownerId:8,x:10,y:10,radius:1,remaining:5,life:5}];kill(g);
 const time=g.time,kills=g.kills,boss=g.boss,skills=JSON.stringify(g.skills);
 assert.equal(g.enemyHazards.length,1);assert.equal(g.heroState.blinkAnchors.length,1);
 g.enemyProjectiles=[{x:g.player.x,y:g.player.y,radius:8},{x:20,y:20,radius:8}];
 g.enemyHazards.push({ownerId:1,x:g.player.x-500,y:g.player.y,toX:g.player.x+500,toY:g.player.y,width:20,remaining:5});
 assert.ok(canRevive(g));assert.ok(reviveGame(g));assert.equal(g.player.hp,g.player.maxHp*.5);assert.equal(g.player.invulnerable,3);
 assert.equal(g.enemyProjectiles.length,1);assert.equal(g.enemyProjectiles[0].x,20);assert.equal(g.enemyHazards.length,1);assert.equal(g.enemyHazards[0].ownerId,8);
 assert.equal(g.time,time);assert.equal(g.kills,kills);assert.equal(g.boss,boss);assert.equal(boss.hp,321);assert.equal(JSON.stringify(g.skills),skills);
 assert.ok(Math.hypot(g.enemies[0].x-g.player.x,g.enemies[0].y-g.player.y)>=200);
 const enemy=g.enemies[0];enemy.x=g.player.x;enemy.y=g.player.y;
 const hp=g.player.hp;for(let i=0;i<120;i++)updateGame(g,1/60);assert.equal(g.player.hp,hp);assert.equal(boss.hp,321);
 kill(g);assert.equal(canRevive(g),false);assert.equal(reviveGame(g),false);
 draft(g);assert.ok(rerollUpgrade(g));assert.equal(canRerollUpgrade(g,'ad'),false);
}
{
 const g=run();draft(g);const before=build(g),first=signature(g);
 assert.equal(canRerollUpgrade(g,'ad'),false);assert.ok(rerollUpgrade(g));assert.notEqual(signature(g),first);assert.equal(build(g),before);
 const second=signature(g);assert.ok(rerollUpgrade(g,'ad'));assert.notEqual(signature(g),second);assert.equal(build(g),before);
 assert.equal(rerollUpgrade(g),false);assert.equal(rerollUpgrade(g,'ad'),false);g.phase='playing';kill(g);assert.equal(canRevive(g),false);
}
{
 const g=run();g._pendingLevels=2;g.choices=makeUpgradeChoices(g,()=>.3);kill(g);assert.ok(reviveGame(g));
 const time=g.time;updateGame(g,1/60);assert.equal(g.phase,'upgrade');assert.equal(g._pendingLevels,2);assert.equal(g.time,time);
}
for(let seed=1;seed<=40;seed++){
 const g=run(seed);g.time=90;g.upgrades.orb=5;g.upgrades.dagger=5;g.growth.haste=1;g.growth.damage=1;g.attackProgress.rank=3;
 draft(g);if(rerollUpgrade(g)){
  const pool=new Set(buildUpgradePool(g).map(c=>c.id));assert.ok(g.choices.every(c=>pool.has(c.id)||c.category==='supply'));
  for(const c of g.choices.filter(c=>c.category==='evolution'))assert.equal(g.choices.filter(other=>other.category==='evolution'&&other.weaponId===c.weaponId).length,2);
 }
}
{
 const g=run();for(const w of WEAPONS)g.upgrades[w.id]=w.max;for(const s of GROWTH_STATS)g.growth[s.id]=s.max;
 for(const p of HERO_PERKS.commander)g.heroPerks[p.id]=p.max;g.attackProgress={rank:4,branch:'a'};
 draft(g);const state=JSON.stringify(g);assert.equal(canRerollUpgrade(g),false);assert.equal(rerollUpgrade(g),false);assert.equal(JSON.stringify(g),state);
}
{const g=run();g.time=59;kill(g);assert.equal(canRevive(g),false);}
{
 const g=run();draft(g);const probe=findAlternativeUpgradeChoices(g);
 assert.ok(probe);for(let frame=0;frame<120;frame++)assert.equal(findAlternativeUpgradeChoices(g),probe);
 g.growth.damage=4;const changed=findAlternativeUpgradeChoices(g);assert.notEqual(changed,probe);
 assert.ok(changed.choices.every(c=>c.id!=='stat:damage'));assert.ok(rerollUpgrade(g));assert.equal(g.choices,changed.choices);
}
{
 const g=run();kill(g);const boss=foe(g,99);boss.boss=true;boss.hp=321;g.enemies.push(boss);g.boss=boss;
 const position={x:boss.x,y:boss.y};assert.ok(reviveGame(g));assert.equal(boss.hp,321);assert.equal(boss.x,position.x);assert.equal(boss.y,position.y);
}
console.log('run support checks passed: real death/rescue, immunity, shared tactical chance, queued levels, legal rerolls and exhausted pool');
