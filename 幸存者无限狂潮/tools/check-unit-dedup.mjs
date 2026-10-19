import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unitAssets} from '../dist/assets.js';
import {HERO_JOBS,getHeroKind} from '../dist/heroes.js';
import {DUNGEONS} from '../dist/campaign.js';
import {ENEMY_ABILITIES,ENCOUNTER_WAVES} from '../dist/enemy-content.js';
import {ORIGINAL_ARMY_KINDS} from '../dist/original-heroes.js';
import {createOriginalHeroRenderer} from '../dist/original-hero-renderer.js';
import {createGame,configureRun,startGame,updateGame,castSkill} from '../dist/simulation.js';

// Compare actual image bytes, not filenames: renamed copies caused this regression.
const hashes=new Map(),sources=new Map();
for(const [kind,asset] of Object.entries(unitAssets)){
 const bytes=await readFile(new URL('../dist/'+asset.src,import.meta.url));
 const hash=createHash('sha256').update(bytes).digest('hex');
 hashes.set(kind,hash);sources.set(kind,asset.sourceIdentity);
}
const heroKinds=Object.values(HERO_JOBS).map(j=>j.kind);
const enemyKinds=new Set([
 ...DUNGEONS.flatMap(d=>[...d.enemies,d.boss.kind]),
 ...Object.values(ENEMY_ABILITIES).map(e=>e.kind),
 ...Object.values(ENCOUNTER_WAVES).flatMap(w=>w.flatMap(s=>s.table.map(([kind])=>kind))),
]);
const summonKinds=Object.values(ORIGINAL_ARMY_KINDS);
assert.equal(new Set(heroKinds).size,30);
assert.equal(new Set(summonKinds).size,5);
for(const kind of [...heroKinds,...summonKinds])assert(!enemyKinds.has(kind),`Friendly uses enemy kind: ${kind}`);
for(const kind of summonKinds)assert(!heroKinds.includes(kind),`Summon uses hero kind: ${kind}`);
// Legacy aliases (e.g. hero/general_swift) are one character's fallback, not
// separate combatants. All currently selectable/hostile/summoned kinds must differ.
const activeKinds=[...heroKinds,...summonKinds,...enemyKinds];
for(let i=0;i<activeKinds.length;i++)for(let j=i+1;j<activeKinds.length;j++){
 const a=activeKinds[i],b=activeKinds[j];
 assert(hashes.has(a)&&hashes.has(b),`Missing atlas ${a}/${b}`);
 assert.notEqual(hashes.get(a),hashes.get(b),`Same atlas bytes: ${a} / ${b}`);
 if(sources.get(a)&&sources.get(b))assert.notEqual(sources.get(a),sources.get(b),`Same source: ${a} / ${b}`);
}
const tick=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)updateGame(g,1/60,{x:0,y:0});};
const observed=[];
for(const job of ['summoner','summoner_master','summoner_sovereign']){
 const g=createGame({seed:123});
 configureRun(g,{heroId:'summoner',heroJob:job,heroKind:getHeroKind('summoner',job),heroSkills:['summonGuard','recallSummons','summonElite']});
 // Even the initial compatibility summon must not flash an enemy before first update.
 assert(g.companions.every(c=>summonKinds.includes(c.kind)));
 startGame(g);g._spawnClock=1000;g.mapObjects=[];tick(g,.2);
 for(const c of g.companions)assert.equal(c.kind,ORIGINAL_ARMY_KINDS[c.role]);
 observed.push({job,regular:g.companions.map(c=>({role:c.role,kind:c.kind}))});
 assert(castSkill(g,'summonElite',{x:1,y:0}));tick(g,.2);
 if(job!=='summoner_sovereign'){
  assert.equal(g.companions.find(c=>c.elite)?.kind,ORIGINAL_ARMY_KINDS.leader);
 }else{
  assert(g.originalHero.fusion);assert.equal(g.companions.length,0);
  const calls=[],renderer=createOriginalHeroRenderer({ctx:{save(){},restore(){}},drawVfx(){},drawAtlasLine(){},unit:(entity,kind)=>calls.push({kind,time:entity.animTime}),unitAssets,images:{}});
  const draw=reduced=>{calls.length=0;renderer.render(g,{x:0,y:0},reduced,'above');const giants=calls.filter(c=>c.kind===ORIGINAL_ARMY_KINDS.giant);assert.equal(giants.length,1,'Fusion plus pulse effects render one body');return giants[0].time;};
  const first=draw(false);tick(g,.15);assert.notEqual(draw(false),first,'Giant attack pose advances');
  const reduced=draw(true);tick(g,.15);assert.equal(draw(true),reduced,'Reduced motion keeps a stable pose');
  tick(g,6);assert(!g.originalHero.fusion);assert.equal(g.companions.length,3);
  assert(g.companions.every(c=>c.kind===ORIGINAL_ARMY_KINDS[c.role]));
 }
}
const out=new URL('../output/unit-dedup/',import.meta.url);await mkdir(out,{recursive:true});
const report={passed:true,activeUniqueAtlases:activeKinds.length,heroAppearances:heroKinds.length,summonKinds,enemyKinds:[...enemyKinds],observed,giant:{singleBody:true,animationAdvances:true,reducedMotion:true},scope:'Actual PNG/source identity uniqueness for all active hero/summon/enemy appearances (unused legacy aliases excluded), encounter faction separation, production summon initialization/update/R/fusion return, renderer body count and animation.'};
await writeFile(new URL('check.json',out),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
