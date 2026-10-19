import assert from 'node:assert/strict';
import {createGame,configureRun,startGame,updateGame,togglePause,getSkillState} from '../dist/simulation.js';
import {getHeroIdentity} from '../dist/hero-kit.js';
const heroes={commander:['blade_master',['dash','cleave','whirlwind']],summoner:['summoner_sovereign',['summonGuard','recallSummons','summonElite']],blink:['blink_sovereign',['markBlade','blinkStrike','blinkStorm']],mage:['mage_sovereign',['flameBreath','frostAura','rockWall']],grappler:['titan_grappler',['grappleHook','grappleSlam','grappleClash']],rift:['rift_sovereign',['riftGate','riftStep','riftBarrage']],magnet:['magnet_sovereign',['magnetField','magnetLance','magnetCrush']],sword:['sword_sage',['swordFocus','swordRecall','swordUnion']],spiral:['spiral_sage',['spiralOrb','spiralClone','spiralConvergence']],petal:['petal_sovereign',['petalSweep','petalPierce','petalBloom']]};
function queries(g){for(let i=0;i<20;i++){assert.ok(getHeroIdentity(g).name);assert.equal(getSkillState(g).length,2);}}
function untouchedQueries(g){const snapshot=()=>JSON.stringify(g,(_key,v)=>typeof v==='function'?'[function]':v instanceof Map||v instanceof Set?[...v]:v);const before=snapshot();queries(g);assert.equal(snapshot(),before,'HUD/skill queries do not create or mutate run state');for(const key of ['originalHero','specialHero','mythicHero','heroKit'])assert.ok(!g[key],`${key} stays disposed`);}
for(const [hero,[job,skills]]of Object.entries(heroes)){
 const g=createGame({seed:78,duration:1000});configureRun(g,{heroId:hero,heroJob:job,heroSkills:skills});untouchedQueries(g);
 startGame(g);g.previewMode=true;updateGame(g,.2);assert.ok(g.originalHero||g.specialHero||g.mythicHero,'production update creates actual runtime');
 const refs=[g.originalHero,g.specialHero,g.mythicHero];togglePause(g);queries(g);assert.deepEqual([g.originalHero,g.specialHero,g.mythicHero],refs,'pause HUD preserves existing runtime references');
 // titleScreen replaces the disposed battle with this exact production constructor.
 const title=createGame({seed:79});untouchedQueries(title);
 // A terminal result retains its selected hero identity, with cleared entities.
 g.phase='victory';g.originalHero=g.specialHero=g.mythicHero=g.heroKit=null;g.heroEffects=[];untouchedQueries(g);
}
console.log('Production HUD lifecycle passed: ten heroes, ready→playing→pause→fresh title and disposed terminal; identity/skill queries never reconstruct runtime.');

