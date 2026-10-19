import assert from 'node:assert/strict';
import {ensureAttackProgress,getAttackUpgradeChoices,applyAttackUpgrade,getAttackProgressionInfo} from '../dist/attack-progression.js';
import {makeUpgradeChoices,applyGrowthUpgrade} from '../dist/growth.js';
import {make,foe} from './check-basic-weapons.mjs';
for(const hero of ['commander','summoner','blink','mage']){
 const g=make(hero);assert.equal(ensureAttackProgress(g).rank,1);
 for(let i=0;i<8;i++)assert.ok(makeUpgradeChoices(g,()=>.2).some(c=>c.id==='attack:rank2'));
 assert.ok(applyGrowthUpgrade(g,'attack:rank2'));assert.ok(!applyAttackUpgrade(g,'attack:rank2'));assert.ok(applyAttackUpgrade(g,'attack:rank3'));
 assert.deepEqual(getAttackUpgradeChoices(g).map(c=>c.id),['attack:a','attack:b']);
 g.upgrades.orb=5;g.growth.haste=1;g.time=90;const first=makeUpgradeChoices(g,()=>0),second=makeUpgradeChoices(g,()=>0);
 assert.ok(first.some(c=>c.id==='attack:a')&&first.some(c=>c.id==='attack:b'));assert.equal(second.filter(c=>c.category==='evolution').length,2);assert.ok(!second.some(c=>c.category==='attack'));
 assert.ok(applyAttackUpgrade(g,'attack:a'));assert.ok(!applyAttackUpgrade(g,'attack:b'));assert.equal(getAttackProgressionInfo(g).branch,'a');assert.equal(getAttackUpgradeChoices(g).length,0);assert.equal(ensureAttackProgress(make(hero)).rank,1);
 for(const invalid of [{rank:0},{rank:5},{rank:4,branch:null},{rank:2.5}]){g.attackProgress=invalid;assert.deepEqual(ensureAttackProgress(g),{rank:1,branch:null});}
}
// Career actives remain independent of weapon ranks: Q leaves one real return shadow,
// its replay is one-shot, a second Q returns to the saved location, and neither operation changes rank.
{const {createGame,configureRun,startGame,castSkill,updateGame}=await import('../dist/simulation.js');function replay(rank,perk){const g=createGame({seed:11,duration:1e6});configureRun(g,{heroId:'blink',heroJob:'blink_master',heroSkills:['markBlade','blinkStrike','blinkStorm']});startGame(g);g.previewMode=true;g.mapObjects=[];g._spawnClock=g._nextSupplyAt=1e9;g.heroPerks.blink_afterimage=perk;g.attackProgress={rank,branch:null};const origin={x:g.player.x,y:g.player.y};g.enemies=[{...foe(100,g.player.x+200,g.player.y),kind:'grunt',speed:0,damage:0,xp:0,aiClock:1e9,contactClock:1e9,anim:'idle',animTime:0}];assert.ok(castSkill(g,'markBlade',{x:1,y:0}));assert.ok(g.originalHero.returnShadow);assert.ok(g.originalHero.qEcho);g.originalHero.clock=100;const before=g.stats.heroDamage;for(let i=0;i<30;i++)updateGame(g,1/60,{x:0,y:0});const damage=g.stats.heroDamage-before;assert.ok(damage>0);assert.equal(g.originalHero.qEcho,null);assert.ok(castSkill(g,'markBlade',{x:1,y:0}));assert.equal(g.player.x,origin.x);assert.equal(g.player.y,origin.y);assert.equal(g.originalHero.returnShadow,null);assert.ok(g.originalHero.decoy);assert.equal(ensureAttackProgress(g).rank,rank);return damage;}assert.equal(replay(1,0),replay(3,0),'same career Q replay stays independent of weapon rank');assert.ok(replay(1,2)>replay(1,0),'afterimage perk strengthens actual Q replay');}
console.log('Attack progression checks passed: four-stage growth, exclusive branches, common evolution rotation, invalid state reset, real same-button return and one-shot replay.');
