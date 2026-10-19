import assert from 'node:assert/strict';
import * as c from '../dist/campaign.js';
import {HEROES,getHeroJobs,getHeroKind,SKILL_DEFINITIONS} from '../dist/heroes.js';
const copy=x=>JSON.parse(JSON.stringify(x));
class Storage{data=new Map();writes=0;fail=false;getItem(k){return this.data.get(k)??null;}setItem(k,v){if(this.fail)throw Error('quota');this.writes++;this.data.set(k,String(v));}}
let storage;
function reset(){storage=new Storage();globalThis.localStorage=storage;return c.loadProfile().profile;}
for(const meta of HEROES){
 let p=reset();const jobs=getHeroJobs(meta.id),hero=p.heroes[meta.id];
 hero.level=6;hero.experience=37;p.cleared=['moss-gate','ember-trail'];p.gold=50000;p.materials=5000;
 p.selectedHero=meta.id;assert(c.saveProfile(p).ok);
 const locked=copy(p),lockedRaw=storage.getItem(c.STORAGE_KEY),lockedWrites=storage.writes;
 assert(!c.selectCampaignHero(p,meta.id,jobs[2].id).ok);assert(!c.selectCampaignHero(p,'unknown',jobs[0].id).ok);
 assert(!c.selectCampaignHero(p,meta.id,getHeroJobs(HEROES.find(h=>h.id!==meta.id).id)[0].id).ok);
 assert.deepEqual(p,locked);assert.equal(storage.getItem(c.STORAGE_KEY),lockedRaw);assert.equal(storage.writes,lockedWrites);
 for(const job of jobs.slice(1)){
  const before=copy(p),raw=storage.getItem(c.STORAGE_KEY);storage.fail=true;assert(!c.claimQuest(p,job.questId).ok);storage.fail=false;
  assert.deepEqual(p,before);assert.equal(storage.getItem(c.STORAGE_KEY),raw);
  const skills=[...hero.skillLoadout];assert(c.claimQuest(p,job.questId).ok);assert.equal(p.heroes[meta.id].job,jobs[0].id);assert.deepEqual(p.heroes[meta.id].skillLoadout,skills);
 }
 for(const job of [jobs[2],jobs[1],jobs[0],jobs[2],jobs[0]]){
  const before=copy(p),raw=storage.getItem(c.STORAGE_KEY);storage.fail=true;assert(!c.selectCampaignHero(p,meta.id,job.id).ok);storage.fail=false;
  assert.deepEqual(p,before);assert.equal(storage.getItem(c.STORAGE_KEY),raw);
  assert(c.selectCampaignHero(p,meta.id,job.id).ok);assert(c.validateProfile(p));
  const run=c.getExpedition(p,'moss-gate');assert.equal(run.heroJob,job.id);assert.equal(run.heroKind,getHeroKind(meta.id,job.id));assert.deepEqual(run.heroSkills,c.getActiveCampaignSkills(p));
  assert.equal(run.heroSkills.length,2);assert.equal(new Set(run.heroSkills).size,2);
  assert.equal(p.heroes[meta.id].skillLoadout.length,3,'historical save payload remains compatible');
  for(const id of run.heroSkills)assert(SKILL_DEFINITIONS[id].jobs.includes(job.id)&&SKILL_DEFINITIONS[id].level<=6);
  const writes=storage.writes;assert(!c.selectCampaignHero(p,meta.id,job.id).ok);assert.equal(storage.writes,writes);
  p=c.loadProfile().profile;assert.equal(p.heroes[meta.id].job,job.id);assert(c.saveProfile(p).ok);p=c.loadProfile().profile;assert.equal(p.heroes[meta.id].job,job.id);
  assert.equal(p.heroes[meta.id].level,6);assert.equal(p.heroes[meta.id].experience,37);assert.equal(p.gold,50000);assert.equal(p.materials,5000);
 }
 const other=HEROES.find(h=>h.id!==meta.id);assert(c.selectCampaignHero(p,other.id).ok);assert(c.selectCampaignHero(p,meta.id).ok);assert.equal(p.heroes[meta.id].job,jobs[0].id);
 // Non-contiguous historic ownership implies the middle tier without changing the schema.
 p.heroes[meta.id].unlockedJobs=[jobs[0].id,jobs[2].id];assert(c.saveProfile(p).ok);
 assert(c.switchJob(p,jobs[1].id).ok);assert(p.heroes[meta.id].unlockedJobs.includes(jobs[1].id));assert(c.validateProfile(p));
 assert(c.switchJob(p,jobs[0].id).ok);
}
// Switching both hero and tier is a single transaction, including skill filtering.
{
 const p=reset(),target=HEROES[1],job=getHeroJobs(target.id)[1];p.heroes[target.id].level=6;p.heroes[target.id].unlockedJobs.push(job.id);assert(c.saveProfile(p).ok);
 const before=copy(p),raw=storage.getItem(c.STORAGE_KEY);storage.fail=true;assert(!c.selectCampaignHero(p,target.id,job.id).ok);storage.fail=false;
 assert.deepEqual(p,before);assert.equal(storage.getItem(c.STORAGE_KEY),raw);assert(c.selectCampaignHero(p,target.id,job.id).ok);assert.equal(p.selectedHero,target.id);assert.equal(p.heroes[target.id].job,job.id);
}
{
 const p=reset();Object.assign(p.heroes.commander,{level:6,job:'blade_master',unlockedJobs:['fighter','swift_blade','blade_master'],skillLoadout:['bladeWave','dash','swordField']});assert(c.saveProfile(p).ok);
 assert(c.selectCampaignHero(p,'commander','fighter').ok);assert.deepEqual(p.heroes.commander.skillLoadout,['dash','whirlwind','cleave'],'keep legal skills, fill the two active recommendations, and retain a legal historical third ID');
 p.heroes.commander.skillLoadout=['whirlwind','dash','cleave'];assert(c.saveProfile(p).ok);assert(c.switchJob(p,'blade_master').ok);assert.deepEqual(p.heroes.commander.skillLoadout,['whirlwind','dash','cleave']);
}
console.log('Hero tier selection passed: ten heroes, all tiers, explicit unlocks, persisted lower tiers, implicit historic tiers, run configs and atomic failures.');
