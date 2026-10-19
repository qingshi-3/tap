import assert from 'node:assert/strict';
import {updateOriginalHero as updateHeroKit} from '../dist/original-heroes.js';
import {castOriginalHero,ensureOriginal,onOriginalEnemyDeath,absorbOriginalDamage} from '../dist/original-heroes.js';
const jobs={commander:['fighter','swift_blade','blade_master'],summoner:['summoner','summoner_master','summoner_sovereign'],blink:['blink','blink_master','blink_sovereign'],mage:['mage','mage_master','mage_sovereign']};
export function fixture(hero,tier=1,rank=1,branch=null){const g={_nextId:10,time:0,phase:'playing',heroId:hero,heroJob:jobs[hero][tier-1],world:{width:2400,height:1800},player:{x:500,y:500,radius:20,hp:100,maxHp:100,facing:1,damageMultiplier:1},growth:{},attackProgress:{rank,branch},companions:[],heroEffects:[],heroPerks:{},fields:[],heroState:{blinkAnchors:[]},enemyProjectiles:[],skills:{markBlade:{remaining:6},flameBreath:{remaining:8},frostAura:{remaining:8}},enemies:[]};g.hits=[];g.api={damage(e,n,color,source){g.hits.push({id:e.id,n,source});e.hp-=n;if(e.hp<=0&&!e.dead){e.dead=true;onOriginalEnemyDeath(g,e,g.api);}},movementHitsWall(){return false;}};return g;}
export const enemy=(id,x=565,y=500,options={})=>({id,x,y,radius:15,hp:100000,maxHp:100000,spawnDelay:0,facing:-1,...options});
export function tick(g,seconds){for(let i=0;i<Math.ceil(seconds*60);i++){g.time+=1/60;updateHeroKit(g,1/60,g.api);}}
export const cast=(g,id,aim={x:1,y:0})=>castOriginalHero(g,id,aim,g.api);
// Every career/rank can complete a real basic cycle and all legacy active IDs.
for(const hero of Object.keys(jobs))for(let t=1;t<=3;t++)for(const [rank,branch]of [[1,null],[2,null],[3,null],[4,'a'],[4,'b']]){const g=fixture(hero,t,rank,branch);g.enemies=[enemy(1),enemy(2,610,515),enemy(3,620,485)];tick(g,2.8);assert.ok(g.hits.some(h=>h.source==='basic'),`${hero} ${t} ${rank}${branch} direct basic`);assert.ok(g.hits.every(h=>Number.isFinite(h.n)&&h.n>0));const ids={commander:['dash','whirlwind'],summoner:['recallSummons','summonElite'],blink:['markBlade','blinkStorm'],mage:['frostAura','rockWall']}[hero];for(const id of ids)assert.equal(cast(g,id),true,`${hero} ${t} ${id}`);tick(g,2);}
// Low weapons stay melee; full momentum now discharges automatically on a third strike.
{const g=fixture('commander',3);g.enemies=[enemy(1,850)];tick(g,2);assert.equal(g.hits.length,0);g.enemies[0].x=565;ensureOriginal(g).momentum=12;g.originalHero.combo=2;g.originalHero.clock=0;tick(g,.02);assert.equal(g.originalHero.momentum,0);assert.ok(g.hits.some(h=>h.source==='basicSecondary'));assert.equal(g.player.x,500);assert.equal(g.player.y,500);}
// T2 third strike really reaches a back row while T1 stays near the player.
{const sample=t=>{const g=fixture('commander',t);g.enemies=[enemy(1),enemy(2,700)];tick(g,2.5);return g.hits;};assert.ok(!sample(1).some(h=>h.id===2));assert.ok(sample(2).some(h=>h.id===2));}
// Whirlwind substitutes for ordinary basics during its finite budget, then basics resume.
{const g=fixture('commander',3);g.enemies=[enemy(1)];cast(g,'whirlwind');tick(g,1);assert.ok(!g.hits.some(h=>h.source==='basic'));tick(g,1.7);assert.equal(g.originalHero.spin,null);assert.ok(g.hits.some(h=>h.source==='basic'));}
// Exactly three living role slots, replenishment cadence and actual fusion custody.
{const g=fixture('summoner',3);g.enemies=[enemy(1)];tick(g,.2);assert.deepEqual(g.companions.map(c=>c.role),['shield','spear','priest']);const dead=g.companions[1];dead.hp=0;tick(g,.3);assert.equal(g.companions.length,2);tick(g,2);assert.equal(g.companions.length,3);cast(g,'summonElite');assert.equal(g.companions.length,0);assert.equal(g.originalHero.fusion.members.length,3);tick(g,3);assert.equal(g.companions.length,0);tick(g,3.3);assert.equal(g.companions.filter(c=>!c.elite).length,3);}
// Isolated Boss supplies finite corpses without deaths; E consumes each once.
{const g=fixture('summoner',2);g.enemies=[enemy(1,680,500,{boss:true})];tick(g,10);assert.ok(g.originalHero.corpses.length>0);const before=g.originalHero.corpses.length;cast(g,'recallSummons');assert.equal(g.originalHero.corpses.length,0);assert.equal(g.originalHero.flames.filter(f=>f.kind==='soulFire').length,before);g.originalHero.clock=100;tick(g,2);assert.equal(g.originalHero.flames.filter(f=>f.kind==='soulFire').length,0);assert.equal(g.hits.filter(h=>h.source==='corpse').length,before);}
// Moving away leaves exactly one basic replay; Q has its own separate replay.
{const g=fixture('blink',2,3);g.enemies=[enemy(1)];tick(g,.15);assert.ok(g.originalHero.basicEcho);g.player.x=850;g.originalHero.clock=100;tick(g,.5);assert.ok(g.hits.some(h=>h.source==='basicEcho'));assert.equal(g.originalHero.basicEcho,null);g.player.x=500;cast(g,'markBlade');assert.ok(g.originalHero.qEcho);assert.ok(g.originalHero.returnShadow);const returnX=g.originalHero.returnShadow.x;cast(g,'markBlade');assert.equal(g.player.x,returnX);assert.equal(g.originalHero.returnShadow,null);}
// Shadow/derived/R hits never record themselves into death mark.
{const g=fixture('blink',2,3);g.enemies=[enemy(1)];cast(g,'blinkStorm');assert.equal(g.originalHero.deathMark.recorded,0);tick(g,.15);const recorded=g.originalHero.deathMark.recorded;assert.ok(recorded>0);g.originalHero.clock=100;tick(g,.6);assert.equal(g.originalHero.deathMark.recorded,recorded);assert.ok(g.hits.some(h=>h.source==='basicEcho'));}
// R now supplies its own elemental sequence; direct lightning and frost trigger one window each.
{const g=fixture('mage',3);g.enemies=[enemy(1,650,500,{boss:true})];cast(g,'rockWall');g.originalHero.clock=100;tick(g,.9);assert.equal(g.originalHero.elementWindow.used.size,0);g.originalHero.clock=0;tick(g,.15);assert.deepEqual([...g.originalHero.elementWindow.used],['lightning']);g.originalHero.clock=100;g.player.x=600;cast(g,'frostAura');assert.equal(g.originalHero.elementWindow.used.size,2);tick(g,1);assert.equal(g.originalHero.elementWindow.used.size,2);assert.ok(g.heroEffects.some(f=>f.visualKind==='originalMeteor'&&f.element==='lightning'));}
// Frozen deaths propagate once; armor is consumed and cannot recursively rearm.
{const g=fixture('mage',3);g.enemies=[enemy(1,550,500,{hp:100}),enemy(2,680)];cast(g,'frostAura');assert.equal(g.originalHero.iceArmor,1);const n=absorbOriginalDamage(g,20,'contact',g.enemies[0],g.api);assert.equal(n,8);assert.equal(g.originalHero.iceArmor,0);assert.equal(absorbOriginalDamage(g,20,'contact',g.enemies[0],g.api),20);}
// Pause freezes run-owned queues and clocks.
{const g=fixture('blink',2);g.enemies=[enemy(1)];tick(g,.15);g.phase='paused';const delay=g.originalHero.basicEcho.delay;updateHeroKit(g,2,g.api);assert.equal(g.originalHero.basicEcho.delay,delay);}
// A kill transfers only the unused death-mark window and starts from zero damage.
{const g=fixture('blink',3);g.enemies=[enemy(1,565,500,{hp:50}),enemy(2,690,500,{elite:true})];cast(g,'blinkStorm');tick(g,.25);assert.equal(g.originalHero.deathMark.targetId,2);assert.equal(g.originalHero.deathMark.recorded,0);assert.equal(g.originalHero.deathMark.transfers,1);assert.equal(g.player.x,500);}
// Meteor placement accepts a close explicit point; far aim clamps along its own direction.
{const g=fixture('mage');cast(g,'rockWall',{x:1,y:0,targetX:540,targetY:620});let f=g.heroEffects.find(f=>f.visualKind==='originalMeteor');assert.equal(f.x,540);assert.equal(f.y,620);g.heroEffects=[];cast(g,'rockWall',{x:1,y:0,targetX:500,targetY:1200});f=g.heroEffects.find(f=>f.visualKind==='originalMeteor');assert.equal(f.x,500);assert.equal(f.y,760);}
// Every preserved selectable perk changes its declared actual combat behavior.
for(const id of ['commander_reach','commander_third','commander_reserve','summoner_bond','summoner_mend','summoner_echo','blink_quarry','blink_precision','blink_afterimage','mage_fire','mage_frost','mage_stone']){
 const sample=level=>{const hero=id.split('_')[0],g=fixture(hero,hero==='blink'?2:1);g.heroPerks[id]=level;g.enemies=[enemy(1,id==='commander_reach'?625:565)];
  if(id==='commander_reserve'){ensureOriginal(g).momentum=12;g.originalHero.combo=2;g.originalHero.clock=0;tick(g,.02);}
  else if(id==='summoner_mend'){tick(g,.2);g.enemies=[];g.companions[0].hp=40;tick(g,1);return g.companions[0].hp;}
  else if(id==='summoner_bond'){tick(g,2);return g.hits.filter(h=>h.source==='companion').reduce((n,h)=>n+h.n,0);}
  else if(id==='blink_afterimage'){cast(g,'markBlade');return g.originalHero.qEcho.n;}
  else if(id==='blink_quarry'){cast(g,'blinkStorm');tick(g,.3);return g.hits.filter(h=>h.source==='basic').reduce((n,h)=>n+h.n,0);}
  else if(id==='mage_fire'){cast(g,'rockWall',{x:1,y:0,targetX:565,targetY:500});ensureOriginal(g).clock=99;tick(g,1.5);}
  else if(id==='mage_frost'){cast(g,'frostAura');return g.enemies[0].frozen;}
  else if(id==='mage_stone'){cast(g,'rockWall',{x:1,y:0,targetX:565,targetY:500});g.originalHero.clock=99;tick(g,.6);}
  else tick(g,id==='summoner_echo'?4:2.7);
  return g.hits.reduce((n,h)=>n+h.n,0);
 };assert.ok(sample(2)>sample(0),`${id} has an actual useful effect`);
}
console.log('Researched original heroes passed: 60 career/rank basics, all active tiers, real melee/charge, finite army/fusion/corpse budgets, single echo/provenance, elemental window and pause.');

