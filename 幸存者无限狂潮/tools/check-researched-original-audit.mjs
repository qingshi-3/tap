import assert from 'node:assert/strict';
import {fixture,enemy,tick,cast} from './check-researched-original.mjs';
import {ensureOriginal,getOriginalHeroAim} from '../dist/original-heroes.js';
// Rushes settle only the actually traversed segment, and stop at walls.
{const g=fixture('summoner',2);g.enemies=[enemy(1,650)];tick(g,.1);g.hits=[];const before=g.companions.map(c=>[c.id,c.x,c.y]);g.api.movementHitsWall=()=>true;cast(g,'summonElite');tick(g,.1);assert.equal(g.hits.filter(h=>h.n===38).length,0);for(const [id,x,y]of before){const c=g.companions.find(c=>c.id===id);assert.equal(c.x,x);assert.equal(c.y,y);}}
{const g=fixture('summoner',2);g.enemies=[enemy(1,680),enemy(2,760)];tick(g,.1);g.hits=[];cast(g,'summonElite');tick(g,.6);assert.ok(g.hits.some(h=>h.n===38&&h.id===2));}
// IVB in the shadow career requires body and its real replay before the next knife tears.
{const g=fixture('blink',2,4,'b');g.enemies=[enemy(1)];tick(g,2);assert.ok(g.hits.some(h=>h.source==='wound'));}
// Priest IVB leaves one consumable soul fire, rather than two corpse resources.
{const g=fixture('summoner',3,4,'b');g.enemies=[enemy(1,650)];tick(g,.1);g.originalHero.clock=100;for(const c of g.companions)c.attackClock=100;const priest=g.companions.find(c=>c.role==='priest');priest.attackClock=0;priest.round=2;priest.soulRound=2;g.originalHero.corpses=[];tick(g,.05);assert.equal(g.originalHero.corpses.length,1);assert.equal(g.originalHero.corpses[0].soulFire,true);cast(g,'recallSummons');assert.equal(g.originalHero.corpses.length,0);assert.equal(g.originalHero.flames.filter(f=>f.kind==='soulFire').length,1);}
// A ground fire must actually touch a living enemy to fork; removal cannot fire a timer fork.
{const g=fixture('mage',2,2);g.enemies=[enemy(1,650)];tick(g,.12);g.originalHero.clock=100;g.enemies=[];tick(g,.2);assert.equal(g.originalHero.waves.length,1);assert.equal(g.originalHero.waves[0].electric.canFork,true);}
{const g=fixture('mage',2,2);g.enemies=[enemy(1,650)];tick(g,.2);g.originalHero.clock=100;assert.equal(g.originalHero.waves.length,3);assert.equal(g.originalHero.waves.filter(w=>w.electric.canFork).length,0);}
// RankIII discharges the live moving fire positions and consumes this round once.
{const g=fixture('mage',2,3);g.enemies=[enemy(1,650)];tick(g,.15);g.originalHero.clock=100;tick(g,.24);const positions=g.originalHero.waves.map(w=>({x:w.x,y:w.y}));assert.ok(positions.some(p=>p.x>675));g.enemies.push(enemy(2,730,545));g.hits=[];tick(g,.15);assert.equal(g.originalHero.waves.length,0);assert.ok(g.heroEffects.some(f=>f.visualKind==='originalDischarge'&&f.x>675));}
// Focused ground fire attaches to the target and returns energy without spread branches.
{const g=fixture('mage',2,4,'b');g.enemies=[enemy(1,650)];tick(g,.2);g.originalHero.clock=100;assert.equal(g.originalHero.waves.length,1);assert.equal(g.originalHero.waves[0].attachId,1);g.enemies[0].x=690;tick(g,.05);assert.equal(g.originalHero.waves[0].x,690);tick(g,.3);assert.equal(g.originalHero.waves.length,0);}
// Low-weapon commander career changes retain their distinct actions.
{const g=fixture('commander',1,2);g.enemies=[enemy(1)];tick(g,1.55);assert.ok(g.enemies[0].frozen>0);}
{const g=fixture('commander',3,2);g.enemies=[enemy(1)];tick(g,.2);assert.ok(g.hits.some(h=>h.source==='basicSecondary'));}
{const g=fixture('commander',3,4,'a');g.enemies=[enemy(1)];ensureOriginal(g).momentum=12;g.originalHero.combo=2;tick(g,.15);g.player.y=530;g.originalHero.clock=100;tick(g,.15);assert.ok(g.heroEffects.some(f=>f.visualKind==='originalSpin'&&f.y===530));}
{const g=fixture('commander',3);g.enemies=[enemy(1,600)];ensureOriginal(g).momentum=12;cast(g,'dash');assert.ok(g.heroEffects.some(f=>f.visualKind==='originalSpin'&&f.radius===100));}
{const g=fixture('commander',2);g.enemies=[enemy(1)];ensureOriginal(g).momentum=12;g.originalHero.combo=2;tick(g,.15);assert.equal(g.player.x,500);assert.equal(g.originalHero.momentum,0);assert.ok(g.hits.some(h=>h.source==='basicSecondary'));}
// Autonomous army ignores retired command state and keeps real role bodies.
{const g=fixture('summoner',2);g.enemies=[enemy(1,380)];tick(g,.1);g.originalHero.orderTime=4;g.originalHero.orderPoint={x:1000,y:500};tick(g,.8);const shield=g.companions.find(c=>c.role==='shield');assert.ok(shield.x<g.player.x);assert.equal(g.originalHero.orderTime,0);}
// Final soldiers pursue and perform a real automatic swept charge without Q orders.
{const g=fixture('summoner',3,4,'a');g.enemies=[enemy(1,700)];tick(g,.2);assert.ok(g.companions.some(c=>c.originalRush));assert.deepEqual(g.companions.map(c=>c.role),['shield','spear','priest']);}
// Spear rankI is one target, rankII can hit exactly one further target.
for(const rank of [1,2]){const g=fixture('summoner',2,rank);g.enemies=[enemy(1,650),enemy(2,700)];tick(g,.1);g.originalHero.clock=100;g.hits=[];const spear=g.companions.find(c=>c.role==='spear');for(const c of g.companions)c.attackClock=100;spear.x=500;spear.y=500;spear.attackClock=0;tick(g,.01);assert.equal(new Set(g.hits.map(h=>h.id)).size,rank);}
// Priest guarding branch genuinely repels light enemies around the healed unit.
{const g=fixture('summoner',3,4,'a');g.enemies=[enemy(1,465,535)];tick(g,.1);g.originalHero.clock=100;for(const c of g.companions)c.attackClock=100;const shield=g.companions.find(c=>c.role==='shield'),priest=g.companions.find(c=>c.role==='priest');shield.x=450;shield.y=530;shield.hp=50;priest.attackClock=0;const before=g.enemies[0].x;tick(g,.01);assert.ok(g.enemies[0].x>before);assert.ok(shield.hp>50);}
// R owns its ice/fire/lightning sequence; no retired fire skill is needed.
{const g=fixture('mage',3);g.enemies=[enemy(1,600,515),enemy(2,620,540)];cast(g,'rockWall',{x:1,y:0,targetX:600,targetY:500});g.originalHero.clock=100;tick(g,1.65);assert.ok(g.heroEffects.some(f=>f.visualKind==='originalMeteor'&&f.element==='lightning'));assert.ok(g.originalHero.iceFields.length>0);assert.ok(g.hits.some(h=>h.n===65&&h.source==='meteor'));}
// Vertical aiming matches casting exactly, including a zero horizontal component.
{const g=fixture('blink');const aim=getOriginalHeroAim(g,'markBlade',{x:0,y:1});assert.equal(aim.toX,500);assert.equal(aim.toY,720);}
// Guarding final shield intercepts on an actual attack, without a retired command.
{const g=fixture('summoner',2,4,'a');g.enemies=[enemy(1,565)];tick(g,.1);g.originalHero.clock=100;const shield=g.companions.find(c=>c.role==='shield');shield.x=500;shield.y=500;shield.attackClock=0;shield.originalRush=null;shield.nextAutoRush=100;g.enemyProjectiles=[{x:shield.x+25,y:shield.y,kind:'arrow',life:2},{x:shield.x+30,y:shield.y,kind:'arrow',life:2}];tick(g,.01);assert.equal(g.enemyProjectiles.filter(p=>p.hit).length,1);}
// Healing can share a real attack turn; only completed attacks advance corpse cadence.
{const g=fixture('summoner',3,3);g.enemies=[enemy(1,650)];tick(g,.1);g.originalHero.clock=100;const priest=g.companions.find(c=>c.role==='priest'),shield=g.companions.find(c=>c.role==='shield');for(const c of g.companions)c.attackClock=100;for(let i=0;i<2;i++){shield.hp=50;priest.attackClock=0;tick(g,.01);}shield.hp=110;priest.attackClock=0;tick(g,.01);assert.equal(priest.soulRound,3);assert.equal(g.originalHero.corpses.length,1);}
// Duration growth extends real ember pits; armor remains one consumable charge.
{const sample=rank=>{const g=fixture('mage',3);g.growth.duration=rank;cast(g,'frostAura');cast(g,'rockWall',{x:1,y:0,targetX:550,targetY:500});g.originalHero.clock=100;tick(g,.8);return {pit:g.originalHero.flames.find(f=>f.kind==='pit').life,armor:g.originalHero.iceArmor};};const base=sample(0),grown=sample(3);assert.ok(grown.pit>base.pit);assert.equal(grown.armor,base.armor);}
console.log('Original independent audit regressions passed: swept wall-safe charges, branch-specific wounds/resources, collision-owned fire and discharge, commander choreography, autonomous role charges and the self-contained elemental sequence.');


