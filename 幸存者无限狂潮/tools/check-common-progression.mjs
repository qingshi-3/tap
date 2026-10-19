import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createGame } from '../dist/simulation.js';
import { WEAPONS } from '../dist/combat-content.js';
import { buildUpgradePool, makeUpgradeChoices, applyGrowthUpgrade, getCommonEvolutionState } from '../dist/growth.js';
import { getCommonSpec, updateCommonAbilities } from '../dist/common-abilities.js';
import { applyAttackUpgrade } from '../dist/attack-progression.js';

const enemy=(id,x=120,y=0)=>({id,x,y,radius:0,hp:1e9,maxHp:1e9});
const game=()=>{const g=createGame({duration:360});g.phase='playing';Object.assign(g.player,{x:0,y:0});g.enemies=[enemy(100)];return g;};
const step=(g,dt=.2,hits=[])=>{g.time+=dt;updateCommonAbilities(g,dt,{damage:(e,n)=>{assert(Number.isFinite(n)&&n>0);hits.push({id:e.id,damage:n});},random:()=>.5});return hits;};
for(const weapon of WEAPONS){
  const g=game();
  for(let rank=1;rank<=5;rank++){
    assert(applyGrowthUpgrade(g,`common:${weapon.id}`));
    assert.equal(g.upgrades[weapon.id],rank);
    assert.equal(weapon.levelDescriptions.length,5);
    const q=getCommonSpec(g,weapon.id);assert.equal(q.rank,rank);
    for(const [key,value] of Object.entries(q))if(typeof value==='number')assert(Number.isFinite(value)&&value>=0,`${weapon.id} ${rank} ${key}`);
    assert(!buildUpgradePool(g).some(c=>c.category==='evolution'));
  }
  assert(!applyGrowthUpgrade(g,`common:${weapon.id}`));
  assert(!applyGrowthUpgrade(g,`evolve:${weapon.id}:a`));
  assert(buildUpgradePool(g).some(c=>c.id===`stat:${weapon.requiredGrowth}`),'required stat reachable');
  for(const random of[()=>0,()=>.999])assert(makeUpgradeChoices(g,random).some(c=>c.id===`stat:${weapon.requiredGrowth}`),'missing stat guaranteed');
  assert(applyGrowthUpgrade(g,`stat:${weapon.requiredGrowth}`));
  g.time=89.999;assert(!getCommonEvolutionState(g,weapon.id).eligible);
  assert(!applyGrowthUpgrade(g,`evolve:${weapon.id}:a`));
  g.time=90;assert(getCommonEvolutionState(g,weapon.id).eligible);
  assert.equal(buildUpgradePool(g).filter(c=>c.weaponId===weapon.id&&c.category==='evolution').length,2);
  for(const branch of['a','b']){const fork=structuredClone(g);assert(applyGrowthUpgrade(fork,`evolve:${weapon.id}:${branch}`));assert.equal(fork.upgrades[weapon.id],6);assert(!applyGrowthUpgrade(fork,`evolve:${weapon.id}:${branch==='a'?'b':'a'}`));for(let i=0;i<300;i++)step(fork,1/60);assert(fork.commonEntities.every(e=>e.life>0));assert(fork.commonEffects.length<=180);}
}
for(const [duration,expected]of[[120,40],[240,60],[360,90],[1e6,90],[0,90],['bad',90]]){const g=game();g.duration=duration;assert.equal(getCommonEvolutionState(g,'orb').requiredTime,expected);}
{const g=game();g.upgrades.orb=5;g.upgrades.dagger=5;g.time=90;const choices=makeUpgradeChoices(g,()=>0);assert(choices.some(c=>['stat:haste','stat:area'].includes(c.id)));assert(!buildUpgradePool(g).some(c=>c.id==='common:meteor'));}
{const g=game();applyAttackUpgrade(g,'attack:rank2');applyAttackUpgrade(g,'attack:rank3');g.upgrades.orb=5;g.upgrades.dagger=5;g.growth.haste=1;g.time=90;const first=makeUpgradeChoices(g,()=>0),second=makeUpgradeChoices(g,()=>0);assert.equal(first.filter(c=>c.category==='attack').length,2);assert(first.some(c=>c.id==='stat:area'));assert.equal(second.filter(c=>c.category==='evolution').length,2);assert(second.some(c=>c.id==='stat:area'));}
{const g=game();g.upgrades.orbit=6;g.evolutions.orbit='a';step(g);assert.equal(g.commonEntities.filter(e=>e.weapon==='orbit').length,4);assert(g.commonEntities.every(e=>e.radius===26&&Math.abs(Math.hypot(e.x,e.y)-150)<1e-9));g.evolutions.orbit='b';step(g);assert.equal(g.commonEntities.length,5);assert(g.commonEntities.every(e=>e.radius===23.4));}
{const g=game();g.upgrades.dagger=6;g.evolutions.dagger='b';step(g);const blade=g.commonEntities.find(e=>e.kind==='boomerang');assert.equal(blade.radius,18);assert.equal(blade.cycloneRadius,140);blade.phase='cyclone';blade.cycloneAngle=0;blade.cycloneTime=1;step(g,.1);assert(Math.abs(Math.hypot(blade.x,blade.y)-140)<1e-9);}
{const g=game();g.upgrades.mine=6;g.evolutions.mine='a';step(g);assert.equal(g.commonEntities.filter(e=>e.kind==='mine').length,2);}
{const g=game();g.upgrades.familiar=5;step(g);const f=g.commonEntities.find(e=>e.kind==='familiar');assert.equal(f.radius,13);g.upgrades.familiar=6;g.evolutions.familiar='b';step(g);assert.equal(f.radius,19);g.commonEntities=g.commonEntities.filter(e=>e.kind==='familiar');f.clock=0;g.enemies=[enemy(100,f.x+30,f.y),enemy(101,f.x+30,f.y+15),enemy(102,f.x+30,f.y-15)];step(g,.01);const bolt=g.commonEntities.find(e=>e.kind==='bolt');assert.equal(bolt.radius,11);bolt.x=g.enemies[0].x;bolt.y=g.enemies[0].y;bolt.vx=bolt.vy=0;const hits=step(g,.01);assert.equal(hits.filter(h=>h.id===100).length,1);assert.equal(hits.filter(h=>h.id!==100).length,2);assert(Math.abs(hits.filter(h=>h.id!==100).reduce((s,h)=>s+h.damage,0)-bolt.damage*.5)<1e-9);}
{const g=game();g.upgrades.meteor=1;step(g);const meteor=g.commonEntities.find(e=>e.kind==='meteor');const hits=step(g,2);assert(meteor.struck);assert(hits.some(h=>h.id===100));}
{const g=game();g.enemies=[enemy(100,50)];g.commonEntities=[{weapon:'mine',kind:'mine',x:0,y:0,life:1,maxLife:1,arming:0,trigger:200,blast:100,damage:10,chain:true},{weapon:'mine',kind:'mine',x:0,y:0,life:0,maxLife:1,arming:0,trigger:200,blast:100,damage:999,chain:true}];const hits=step(g,.01);assert.equal(hits.length,1);assert(hits.every(h=>h.damage===10));}
{const g=game();g.enemies=[enemy(100,50)];g.commonEntities=[{weapon:'mine',kind:'mine',x:0,y:0,life:10,maxLife:10,arming:0,trigger:200,blast:100,damage:10,chain:true},{weapon:'mine',kind:'mine',x:0,y:0,life:.01,maxLife:10,arming:0,trigger:200,blast:100,damage:50,chain:true}];const hits=step(g,.1);assert.deepEqual(hits.map(h=>h.damage),[10],'a later mine expiring this frame cannot chain explode');}
for(const branch of[null,'a','b']){const g=game();g.upgrades.mine=branch?6:5;if(branch)g.evolutions.mine=branch;g.growth.haste=4;const cap=getCommonSpec(g,'mine').cap;g.enemies=[];for(let i=0;i<7200;i++){step(g,1/60);assert(g.commonEntities.filter(e=>e.kind==='mine'&&e.life>0).length<=cap);assert(g.commonEntities.length<=cap);assert(g.commonEffects.length<=180);}g.enemies=[enemy(100,-45)];const hits=step(g,.5);assert(hits.length<=cap*(branch==='b'?2:1));assert(g.commonEntities.filter(e=>e.kind==='mine'&&e.life>0).length<=cap);}

const before=JSON.parse(await readFile(new URL('../output/hero-progression/common-before-growth.json',import.meta.url),'utf8'));
const after=JSON.parse(await readFile(new URL('../output/hero-progression/integration-balance.json',import.meta.url),'utf8'));
const comparison=after.commonResults.filter(r=>r.level>=5).map(row=>{const old=before.commonResults.find(r=>r.ability===row.ability&&r.branch===row.branch&&r.scenario===row.scenario);return {...row,oldDamage30s:old.damage30s,ratio:old.damage30s?row.damage30s/old.damage30s:null};});
for(const row of comparison.filter(r=>r.level===5))assert.equal(row.damage30s,row.oldDamage30s,`${row.ability} base V preserves old III behavior`);
await writeFile(new URL('../output/hero-progression/common-growth-comparison.json',import.meta.url),JSON.stringify({note:'Controlled stationary target samples; coverage changes can reduce damage when targets sit outside the new orbit. Shield utility is not damage.',comparison},null,2)+'\n');
console.log('Common progression verified: five basics, both evolutions, gates, missing-stat drafts, slots, actual geometry, splash budget, coarse meteor update and expired mines; old III/base V measurements match.');
