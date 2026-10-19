import assert from 'node:assert/strict';

const data=new Map();
let writes=0,failWrites=false;
globalThis.localStorage={
  getItem:key=>data.has(key)?data.get(key):null,
  setItem(key,value){if(failWrites)throw new Error('quota');writes++;data.set(key,String(value));},
};

const heroes=await import('../dist/heroes.js');
const campaign=await import('../dist/campaign.js');
const {updateHeroKit}=await import('../dist/hero-kit.js');
const key='pixel-survivor.campaign.v2';
const deep=value=>JSON.parse(JSON.stringify(value));

let loaded=campaign.loadProfile();
assert.equal(loaded.error,null);
let profile=loaded.profile;
const raw=data.get(key);writes=0;
loaded=campaign.loadProfile();
assert.equal(data.get(key),raw,'a current base save must load without migration');
assert.equal(writes,0,'loading a valid save must not write it');
profile=loaded.profile;

assert.deepEqual(heroes.HEROES.slice(0,4).map(hero=>hero.kind),['base_commander','base_summoner','base_blink','base_mage'],'existing hero appearances and ordering remain intact');
assert.deepEqual(heroes.HEROES.slice(4).map(hero=>hero.id),['grappler','rift','magnet','sword','spiral','petal'],'both additions preserve their ordered IDs');
assert.equal(heroes.getHeroKind('commander','swift_blade'),'general_swift');
assert.equal(heroes.getHeroKind('summoner','blink_master'),'base_summoner','cross-family jobs must not change appearance');
assert.deepEqual(heroes.getHeroJobs('mage').map(job=>job.id),['mage','mage_master','mage_sovereign']);

const paths=[
  {heroId:'commander',base:'fighter',job:'blade_master',trial:'blade-trial',quest:'job-blade',kind:'general_commander'},
  {heroId:'summoner',base:'summoner',job:'summoner_master',trial:'summoner-trial',quest:'job-summoner',kind:'general_summoner'},
  {heroId:'blink',base:'blink',job:'blink_master',trial:'blink-trial',quest:'job-blink',kind:'general_blink'},
  {heroId:'mage',base:'mage',job:'mage_master',trial:'mage-trial',quest:'job-mage',kind:'general_mage'},
];

profile.cleared.push('moss-gate');
profile.progression.dungeonWins['moss-gate']=1;
for(const path of paths){
  profile.selectedHero=path.heroId;
  profile.heroes[path.heroId].level=3;
  assert.equal(campaign.switchJob(profile,path.job).ok,false,'locked advancement must reject switching');
  const wrong=paths.find(other=>other.heroId!==path.heroId).job;
  assert.equal(campaign.switchJob(profile,wrong).ok,false,'cross-family job switching must reject');
  const beforeWrong=profile.progression.dungeonWins[path.trial]||0;
  const wrongHero=paths.find(other=>other.heroId!==path.heroId).heroId;
  assert.equal(campaign.settleRun(profile,{id:`wrong-${path.trial}`,dungeonId:path.trial,heroId:wrongHero,victory:true,kills:1,time:120}).ok,false);
  assert.equal(profile.progression.dungeonWins[path.trial]||0,beforeWrong);
  const run={id:`win-${path.trial}`,dungeonId:path.trial,heroId:path.heroId,victory:true,kills:25,time:120};
  assert.equal(campaign.settleRun(profile,run).ok,true);
  const afterWin=deep(profile);
  assert.equal(campaign.settleRun(profile,run).ok,true,'duplicate settlement is idempotent');
  assert.deepEqual(profile,afterWin);
  const gold=profile.gold,materials=profile.materials,oldJobs=[...profile.heroes[path.heroId].unlockedJobs];
  assert.equal(campaign.claimQuest(profile,path.quest).ok,true);
  assert.equal(profile.gold,gold+100);assert.equal(profile.materials,materials+15);
  assert.deepEqual(profile.heroes[path.heroId].unlockedJobs,oldJobs,'trial challenge reward no longer grants a career stage');
  const afterClaim=deep(profile);assert.equal(campaign.claimQuest(profile,path.quest).ok,false);assert.deepEqual(profile,afterClaim);
  const jobs=heroes.getHeroJobs(path.heroId),second=jobs.find(j=>j.tier===2),third=jobs.find(j=>j.tier===3);
  const state=campaign.getJobState(profile,second.id);assert(state.readyToClaim);assert.equal(state.steps.length,3);
  const skills=[...profile.heroes[path.heroId].skillLoadout],beforeAscension=deep(profile);failWrites=true;
  assert.equal(campaign.claimQuest(profile,second.questId).ok,false);failWrites=false;assert.deepEqual(profile,beforeAscension,'failed stage claim must not commit entitlement or job');
  assert.equal(campaign.claimQuest(profile,second.questId).ok,true);assert.equal(profile.heroes[path.heroId].job,path.base,'claim only unlocks');assert.equal(campaign.switchJob(profile,second.id).ok,true);
  assert.deepEqual(profile.heroes[path.heroId].skillLoadout,skills,'compatible old three skills remain equipped');
  assert.equal(campaign.switchJob(profile,path.base).ok,true,'owned lower stages can be selected');
  profile.heroes[path.heroId].level=6;if(!profile.cleared.includes('ember-trail'))profile.cleared.push('ember-trail');
  assert.equal(campaign.claimQuest(profile,third.questId).ok,true);assert.equal(profile.heroes[path.heroId].job,path.base);assert.equal(campaign.switchJob(profile,third.id).ok,true);
  assert.equal(campaign.getExpedition(profile,path.trial).heroKind,heroes.getHeroKind(path.heroId,third.id));
  assert.equal(campaign.switchJob(profile,second.id).ok,true,'owned middle stage can be selected');

}

profile.selectedHero='summoner';
assert.equal(campaign.getQuestStates(profile).length,5);
assert.deepEqual(campaign.getQuestStates(profile).filter(q=>q.id.startsWith('job-')).map(q=>q.id),['job-summoner']);
profile.selectedHero='commander';
assert.equal(campaign.getQuestStates(profile).length,6);

profile.selectedHero='summoner';
const atomicBefore=deep(profile);
failWrites=true;
assert.equal(campaign.switchJob(profile,'summoner_sovereign').ok,false);
failWrites=false;
assert.deepEqual(profile,atomicBefore,'a storage failure must not commit the in-memory job change');

// Recommended loadouts are an explicit, atomic action and respect permanent skill gates.
{
 const sample=campaign.loadProfile().profile;sample.selectedHero='commander';sample.heroes.commander.level=3;sample.heroes.commander.unlockedJobs=['fighter','blade_master'];sample.heroes.commander.job='fighter';
 assert.equal(campaign.switchJob(sample,'blade_master').ok,true);
 assert.deepEqual(sample.heroes.commander.skillLoadout,['dash','cleave','whirlwind']);
 assert.equal(campaign.equipRecommendedSkills(sample).ok,true);
 assert.deepEqual(sample.heroes.commander.skillLoadout,['dash','cleave','whirlwind']);
 sample.heroes.commander.level=5;const before=deep(sample);failWrites=true;
 assert.equal(campaign.equipRecommendedSkills(sample).ok,false);assert.deepEqual(sample,before);
 failWrites=false;assert.equal(campaign.equipRecommendedSkills(sample).ok,true);
 assert.deepEqual(sample.heroes.commander.skillLoadout,['dash','cleave','whirlwind']);
}

// Retired numerical masteries are covered by the researched runtime tests now.
// Legacy equipped IDs must survive an explicit restore of an already-owned career.
for(const legacy of [['dash','cleave','guard'],['dash','bladeWave','swordField'],['quickCut','cleave','whirlwind']]){
 const sample=campaign.loadProfile().profile;sample.selectedHero='commander';Object.assign(sample.heroes.commander,{level:6,job:'blade_master',unlockedJobs:['fighter','swift_blade','blade_master'],skillLoadout:[...legacy]});
 assert(campaign.validateProfile(sample));assert.equal(campaign.switchJob(sample,'blade_master').ok,false,'already active combination does not write');assert.deepEqual(sample.heroes.commander.skillLoadout,legacy);
}
console.log('Profession checks passed: compatibility, linear stages, historical rewards, ownership, atomicity, expedition kinds, recommended current kit and preserved legacy loadouts.');
