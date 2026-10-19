import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import * as c from '../dist/campaign.js';
import {getHeroJobs,HEROES} from '../dist/heroes.js';
const copy=v=>JSON.parse(JSON.stringify(v));
const rows=[];
class Storage {data=new Map();fail=false;getItem(k){return this.data.get(k)??null;}setItem(k,v){if(this.fail)throw Error('quota');this.data.set(k,String(v));}}
for(const name of ['v2-0.14.1.json','v2-0.14.1-daily.json']){
 const original=JSON.parse(await readFile(new URL(`fixtures/save/${name}`,import.meta.url),'utf8'));
 const raw=JSON.stringify(original),storage=new Storage();globalThis.localStorage=storage;storage.data.set(c.STORAGE_KEY,raw);
 let p=c.loadProfile().profile;assert(p);assert.equal(HEROES.length,10);assert.equal(storage.getItem(c.STORAGE_KEY),raw,'load preserves old bytes');
 for(const [id,h] of Object.entries(original.heroes))assert.deepEqual(p.heroes[id],h);
 for(const key of Object.keys(original).filter(k=>k!=='heroes'))assert.deepEqual(p[key],original[key]);
 assert.deepEqual(c.normalizeProfile(original),p);assert.deepEqual(JSON.parse(raw),original);
 for(const id of ['grappler','rift','magnet']){
  assert(c.selectCampaignHero(p,id).ok);const jobs=getHeroJobs(id);assert.equal(jobs.length,3);
  if(id==='grappler')assert.equal(storage.getItem(`${c.STORAGE_KEY}.before-write`),raw,'first write backs up exact historical bytes');
  assert.equal(p.heroes[id].level,1);assert(c.getExpedition(p,'moss-gate'));
  assert(!c.claimQuest(p,jobs[1].questId).ok,'level gate applies even when old cleared progress exists');
  const skills=[...p.heroes[id].skillLoadout];
  // Test fixtures grant training resources, then use production transactions for growth.
  p.gold+=30000;p.materials+=5000;assert(c.saveProfile(p).ok);
  while(p.heroes[id].level<3)assert(c.trainHero(p).ok);
  p.cleared=p.cleared.filter(x=>!['moss-gate','ember-trail'].includes(x));assert(c.saveProfile(p).ok);
  assert(!c.claimQuest(p,jobs[1].questId).ok,'wins without explicit clear do not qualify');
  assert(c.settleRun(p,{id:`${name}-${id}-moss`,heroId:id,dungeonId:'moss-gate',victory:true,kills:20,time:360}).ok);
  assert(c.getJobState(p,jobs[1].id).readyToClaim);
  assert(!c.switchJob(p,jobs[1].id).ok,'ready still requires explicit claim');
  const gold=p.gold,materials=p.materials;assert(c.claimQuest(p,jobs[1].questId).ok);assert.equal(p.gold,gold);assert.equal(p.materials,materials);
  const after=copy(p);assert(!c.claimQuest(p,jobs[1].questId).ok);assert.deepEqual(p,after);
  assert(c.switchJob(p,jobs[1].id).ok);assert.deepEqual(p.heroes[id].skillLoadout,skills);
  while(p.heroes[id].level<6)assert(c.trainHero(p).ok);
  assert(!c.claimQuest(p,jobs[2].questId).ok,'tier3 clear required');
  assert(c.settleRun(p,{id:`${name}-${id}-ember`,heroId:id,dungeonId:'ember-trail',victory:true,kills:20,time:420}).ok);
  const tier2=jobs[1].id;p.heroes[id].unlockedJobs=p.heroes[id].unlockedJobs.filter(x=>x!==tier2);p.heroes[id].job=jobs[0].id;assert(c.saveProfile(p).ok);
  assert(!c.claimQuest(p,jobs[2].questId).ok,'tier3 needs tier2 already unlocked');
  p.heroes[id].unlockedJobs.push(tier2);assert(c.saveProfile(p).ok);
  assert(c.selectCampaignHero(p,'commander').ok);assert(!c.claimQuest(p,jobs[2].questId).ok,'cross-hero claim rejects');
  assert(c.selectCampaignHero(p,id).ok);const beforeFail=copy(p);storage.fail=true;assert(!c.claimQuest(p,jobs[2].questId).ok);assert.deepEqual(p,beforeFail);storage.fail=false;
  assert(c.claimQuest(p,jobs[2].questId).ok);assert(c.switchJob(p,jobs[2].id).ok);assert.equal(c.getExpedition(p,'moss-gate').heroKind,`hero_${id}_3`);
  p=c.loadProfile().profile;assert.equal(p.heroes[id].job,jobs[2].id);assert(c.trainHero(p).ok);assert(c.saveProfile(p).ok);p=c.loadProfile().profile;assert.equal(p.heroes[id].level,7);
  const final=copy(p);assert(!c.switchJob(p,jobs[2].id).ok);assert.deepEqual(p,final,'already active tier does not write');assert(c.switchJob(p,jobs[0].id).ok);assert.deepEqual(p.heroes[id].unlockedJobs,final.heroes[id].unlockedJobs,'selecting lower tier preserves unlocked progression');assert(c.switchJob(p,jobs[2].id).ok);
  rows.push({fixture:name,hero:id,roundTrip:true,tiers:3,failedWriteAtomic:true});
 }
 const stale=c.loadProfile().profile;assert(c.trainHero(p).ok);assert(!c.trainHero(stale).ok,'stale writer cannot overwrite');
 for(const mutate of [x=>x.heroes.unknown=copy(x.heroes.commander),x=>x.unknown=1,x=>delete x.heroes.rift,x=>x.heroes.grappler.extra=1,x=>x.heroes.grappler.job='fighter',x=>x.progression.claimedQuests.push('unknown-quest')]){
  const invalid=copy(p);mutate(invalid);const bad=JSON.stringify(invalid);storage.data.set(c.STORAGE_KEY,bad);assert.equal(c.loadProfile().profile,null);assert.equal(storage.getItem(c.STORAGE_KEY),bad);assert.equal(c.normalizeProfile(invalid),null);
 }
}
await mkdir(new URL('../output/new-heroes/',import.meta.url),{recursive:true});
await writeFile(new URL('../output/new-heroes/progression-check.json',import.meta.url),JSON.stringify({passed:true,scope:'isolated in-memory storage, production campaign APIs; not browser input',rows},null,2));
console.log('New hero progression: six old-v2 → growth → tier claims → save → reload → further-save round trips passed.');
