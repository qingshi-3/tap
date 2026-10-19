// Differential acceptance for the visual-only patch, against the retained 0.12.1 package.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import * as before from '../output/vfx-full-fix/baseline/simulation.js';
import * as after from '../dist/simulation.js';
import {WEAPONS} from '../dist/combat-content.js';
import {HERO_PERKS} from '../dist/hero-kit.js';
import {applyGrowthUpgrade} from '../dist/growth.js';
const skills={commander:['dash','cleave','guard'],summoner:['summonGuard','recallSummons','summonElite'],blink:['markBlade','blinkStrike','blinkStorm'],mage:['flameBreath','rockWall','frostAura']};
const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o?.[k]??null]));
function setup(api,hero,id,branch,advanced){
 const g=api.createGame({seed:419,duration:1e6});
 api.configureRun(g,{heroId:hero,heroJob:hero,heroSkills:advanced||skills[hero]});api.startGame(g);
 g._spawnClock=g._nextSupplyAt=1e9;g.player.x=1200;g.player.y=900;
 g.enemies=Array.from({length:14},(_,i)=>({id:900+i,kind:'grunt',x:1200+Math.cos(i*Math.PI*2/14)*(55+i%3*80),y:900+Math.sin(i*Math.PI*2/14)*(55+i%3*80),radius:12,hp:1e9,maxHp:1e9,speed:0,damage:0,xp:0,spawnDelay:0,anim:'move',animTime:0}));
 if(id){g.upgrades[id]=branch?4:1;if(branch)g.evolutions[id]=branch;}
 for(const p of HERO_PERKS[hero])g.heroPerks[p.id]=2;
 return g;
}
function outcome(g){return {
 phase:g.phase,time:g.time,player:pick(g.player,['x','y','hp','commonShield','invulnerable','dash','facing']),
 stats:pick(g.stats,['heroDamage','commonDamage','damageDealt','damageTaken']),skills:g.skills,
 enemies:g.enemies.map(e=>pick(e,['id','x','y','hp','slow','frozen','dead','poisonEffects','poisonTick'])),
 companions:g.companions.map(c=>pick(c,['id','x','y','hp','damage','focusTargetId','focusDamageMultiplier'])),
 anchors:g.heroState.blinkAnchors,travel:g.heroState.blinkTravel,
 projectiles:g.projectiles.map(p=>pick(p,['id','x','y','vx','vy','life','damage','radius'])),
 common:g.commonEntities.map(e=>pick(e,['id','kind','x','y','vx','vy','life','damage','radius','phase','delay','clock','hitIds','targetId','tick','arming'])),
 kit:pick(g.heroKit,['attackClock','combo','element','shots','empowered','empoweredTime','focusId','focusTime','afterimage','afterimageTime','statuses']),
 clocks:g._commonClocks
};}
const cases=[];
for(const w of WEAPONS)for(const branch of [null,'a','b'])cases.push({hero:'commander',id:w.id,branch});
for(const hero of Object.keys(skills))cases.push({hero,cast:true});
cases.push({hero:'commander',cast:true,advanced:['swordField','bladeWave','whirlwind','quickCut']});
for(const c of cases){
 const a=setup(before,c.hero,c.id,c.branch,c.advanced),b=setup(after,c.hero,c.id,c.branch,c.advanced);
 for(let frame=0;frame<480;frame++){
  if(c.cast&&frame%60===0){const id=(c.advanced||skills[c.hero])[Math.floor(frame/60)%(c.advanced||skills[c.hero]).length];
   assert.equal(after.castSkill(b,id,{x:1,y:0}),before.castSkill(a,id,{x:1,y:0}),`${JSON.stringify(c)} cast ${id}`);}
  const input=frame<90?{x:.35,y:0}:{x:0,y:0};
  before.updateGame(a,1/60,input);after.updateGame(b,1/60,input);
  assert.deepEqual(outcome(b),outcome(a),`${JSON.stringify(c)} frame ${frame}`);
 }
}
const evolving=setup(after,'commander','familiar',null);
after.updateGame(evolving,1/60);const familiar=evolving.commonEntities.find(e=>e.kind==='familiar');
const oldRadius=familiar.radius;assert.equal(!!familiar.heavy,false);
assert.ok(applyGrowthUpgrade(evolving,'common:familiar'));assert.ok(applyGrowthUpgrade(evolving,'common:familiar'));assert.ok(applyGrowthUpgrade(evolving,'evolve:familiar:b'));
after.updateGame(evolving,1/60);assert.ok(evolving.commonEntities.includes(familiar));assert.equal(familiar.heavy,true);assert.equal(familiar.radius,oldRadius,'visual transition must preserve existing collision size');
const result={baseline:'0.12.1',cases:cases.length,framesPerCase:480,matched:true,existingFamiliarEvolution:true,scope:'Per-frame damage, positions, cooldowns, targets, statuses and common entities; ignores renderer and cosmetic event metadata.'};
await writeFile(new URL('../output/vfx-full-fix/mechanics.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
