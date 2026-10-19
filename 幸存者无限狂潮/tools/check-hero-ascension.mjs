import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import * as c from '../dist/campaign.js';
import {HEROES,HERO_JOBS,getHeroJobs,SKILL_DEFINITIONS} from '../dist/heroes.js';
const copy=x=>JSON.parse(JSON.stringify(x));
class Storage{data=new Map();fail=false;writes=0;getItem(k){return this.data.get(k)??null;}setItem(k,v){if(this.fail)throw Error('quota');this.writes++;this.data.set(k,String(v));}}
let storage;function reset(raw=null){storage=new Storage();globalThis.localStorage=storage;if(raw)storage.data.set(c.STORAGE_KEY,raw);return c.loadProfile();}
const report={passed:false,scope:'Production campaign API in isolated memory storage. Exact historical four/seven shapes preserved; current ten heroes grow and claim linear stages. Not browser or gameplay rendering.',roundTrips:[],stages:[],cases:[]};
assert.equal(HEROES.length,10);for(const h of HEROES)assert.deepEqual(getHeroJobs(h.id).map(j=>j.tier),[1,2,3]);
assert(SKILL_DEFINITIONS.whirlwind.jobs.includes('blade_master'));assert(SKILL_DEFINITIONS.quickCut.jobs.includes('blade_master'));
const fixtures=[];for(const file of ['v2-0.14.1.json','v2-0.14.1-daily.json'])fixtures.push({name:file,profile:JSON.parse(await readFile(new URL('fixtures/save/'+file,import.meta.url),'utf8'))});
// Seven-hero fixture is built with the prior snapshotted production campaign API.
reset();const old=await import('../output/hero-ascension/before/campaign.js');storage.data.clear();let seven=old.loadProfile().profile;assert.equal(Object.keys(seven.heroes).length,7);
seven.heroes.commander={level:3,experience:37,job:'blade_master',unlockedJobs:['fighter','blade_master'],skillLoadout:['dash','cleave','swordField']};
seven.cleared=['moss-gate','ember-trail'];seven.progression.dungeonWins={'moss-gate':2,'ember-trail':1};seven.progression.claimedQuests=['job-blade'];assert(old.saveProfile(seven).ok);fixtures.push({name:'prior-production-seven',profile:copy(seven)});
for(const source of fixtures){
 const raw=JSON.stringify(source.profile);let p=reset(raw).profile;assert(p);assert.equal(storage.writes,0);assert.equal(storage.getItem(c.STORAGE_KEY),raw);
 for(const [key,value]of Object.entries(source.profile))if(key!=='heroes')assert.deepEqual(p[key],value);
 for(const[id,hero]of Object.entries(source.profile.heroes))assert.deepEqual(p.heroes[id],hero);
 const before=copy(source.profile);assert.deepEqual(c.normalizeProfile(source.profile),p);assert.deepEqual(source.profile,before);
 p.gold+=30000;p.materials+=5000;assert(c.saveProfile(p).ok);assert.equal(storage.getItem(c.STORAGE_KEY+'.before-write'),raw);
 if(source.name==='prior-production-seven'){
  assert.equal(p.heroes.commander.job,'blade_master');assert.equal(p.heroes.commander.level,3);assert.deepEqual(p.heroes.commander.unlockedJobs,['fighter','blade_master']);
  assert(c.getJobState(p,'swift_blade').completed);assert(!c.claimQuest(p,'ascend-commander-2').ok);assert(c.switchJob(p,'swift_blade').ok);assert(c.switchJob(p,'blade_master').ok);
  assert(c.getExpedition(p,'moss-gate'));assert(c.trainHero(p).ok);assert(c.saveProfile(p).ok);p=c.loadProfile().profile;assert(c.trainHero(p).ok);
 }
 for(const id of ['sword','spiral','petal']){
  assert.equal(p.heroes[id].level,1);assert(c.selectCampaignHero(p,id).ok);const jobs=getHeroJobs(id),skills=[...p.heroes[id].skillLoadout];assert(c.getExpedition(p,'moss-gate'));
  assert(!c.claimQuest(p,jobs[1].questId).ok,'other high-level heroes cannot confer level qualification');
  while(p.heroes[id].level<3)assert(c.trainHero(p).ok);
  if(!p.cleared.includes('moss-gate'))assert(c.settleRun(p,{id:source.name+'-'+id+'-moss',heroId:id,dungeonId:'moss-gate',victory:true,kills:10,time:360}).ok);
  assert(c.claimQuest(p,jobs[1].questId).ok);assert.equal(p.heroes[id].job,jobs[0].id);assert.deepEqual(p.heroes[id].skillLoadout,skills);assert(c.switchJob(p,jobs[1].id).ok);assert(c.switchJob(p,jobs[0].id).ok);
  while(p.heroes[id].level<6)assert(c.trainHero(p).ok);
  if(!p.cleared.includes('ember-trail'))assert(c.settleRun(p,{id:source.name+'-'+id+'-ember',heroId:id,dungeonId:'ember-trail',victory:true,kills:10,time:420}).ok);
  assert(c.claimQuest(p,jobs[2].questId).ok);assert.equal(p.heroes[id].job,jobs[0].id);assert(c.switchJob(p,jobs[2].id).ok);assert(c.saveProfile(p).ok);p=c.loadProfile().profile;assert(c.trainHero(p).ok);assert(c.saveProfile(p).ok);p=c.loadProfile().profile;assert.equal(p.heroes[id].job,jobs[2].id);assert.equal(p.heroes[id].level,7);
  report.roundTrips.push({source:source.name,hero:id,steps:'load → train → claim II → train → claim III → save → reload → train → save → reload',passed:true});
 }
}
// All ten paths claim and ascend without entering any trial or paying a reward cost.
for(const hero of HEROES){
 let p=reset().profile;p.gold=50000;p.materials=5000;p.selectedHero=hero.id;p.heroes[hero.id].level=6;assert(c.saveProfile(p).ok);const jobs=getHeroJobs(hero.id);
 assert(!c.claimQuest(p,jobs[2].questId).ok,'tier3 requires tier2 entitlement');assert(!c.claimQuest(p,jobs[1].questId).ok,'moss clear required');
 p.cleared=['moss-gate','ember-trail'];assert(c.saveProfile(p).ok);const gold=p.gold,materials=p.materials;
 const wrong=HEROES.find(h=>h.id!==hero.id);assert(!c.claimQuest(p,getHeroJobs(wrong.id)[1].questId).ok);
 for(const job of jobs.slice(1)){
  assert(c.getJobState(p,job.id).readyToClaim);const before=copy(p);storage.fail=true;assert(!c.claimQuest(p,job.questId).ok);assert.deepEqual(p,before);storage.fail=false;
  assert(c.claimQuest(p,job.questId).ok);assert.equal(p.heroes[hero.id].job,jobs[0].id);assert.equal(p.gold,gold);assert.equal(p.materials,materials);
  const claimed=copy(p);assert(!c.claimQuest(p,job.questId).ok);assert.deepEqual(p,claimed);assert(!c.switchJob(p,jobs[0].id).ok,'already active stage does not write');
 }
 assert(c.switchJob(p,jobs[2].id).ok);assert(c.switchJob(p,jobs[1].id).ok);assert(c.switchJob(p,jobs[0].id).ok);p=c.loadProfile().profile;assert.equal(p.heroes[hero.id].job,jobs[0].id);assert(c.trainHero(p).ok);report.stages.push({hero:hero.id,tiers:jobs.map(j=>j.id),atomicClaims:true,noTrial:true,noCost:true,ownedTiersSelectable:true});
}
for(const file of JSON.parse(await readFile(new URL('fixtures/save/sources.json',import.meta.url),'utf8')).map(x=>x.file)){const parsed=JSON.parse(await readFile(new URL('fixtures/save/'+file,import.meta.url),'utf8'));assert(c.migrateLegacyProfile(parsed));}
let p=reset().profile;for(const ids of [['commander','summoner','blink','mage','grappler'],['commander','summoner','blink','mage','grappler','rift'],HEROES.slice(0,8).map(h=>h.id),HEROES.slice(0,9).map(h=>h.id)]){const partial=copy(p);partial.heroes=Object.fromEntries(ids.map(id=>[id,partial.heroes[id]]));assert.equal(c.normalizeProfile(partial),null);}
for(const source of [copy(seven),copy(p)]){source.version=1;assert.equal(c.migrateLegacyProfile(source),null,'seven/ten heroes are not historic v1');}
for(const change of [p=>p.heroes.unknown=copy(p.heroes.commander),p=>p.future=1,p=>p.heroes.sword.unlockedJobs.push('unknown'),p=>p.progression.claimedQuests.push('unknown'),p=>p.heroes.sword.skillLoadout[0]='petalSweep']){const bad=copy(p);change(bad);const raw=JSON.stringify(bad);storage.data.set(c.STORAGE_KEY,raw);assert.equal(c.loadProfile().profile,null);assert.equal(storage.getItem(c.STORAGE_KEY),raw);}
const oldFour=copy(fixtures[0].profile);oldFour.heroes.summoner.unlockedJobs.push('summoner_sovereign');assert.equal(c.normalizeProfile(oldFour),null,'future job ID in historical shape is rejected');
report.cases=['exact 4/7 incrementally normalized without writes','all old fields and historical blade rights preserved','10 linear paths, no trial requirement','free tier unlocks and failure atomicity','unknown/partial/unsupported v1 shapes preserve raw','six frozen v1 sources accepted'];report.passed=true;
await mkdir(new URL('../output/hero-ascension/',import.meta.url),{recursive:true});await writeFile(new URL('../output/hero-ascension/content-check.json',import.meta.url),JSON.stringify(report,null,2));console.log('Hero ascension: ten linear paths, nine historical update round trips, six frozen v1 migrations passed.');
