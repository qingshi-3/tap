import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import * as c from '../dist/campaign.js';
const copy=x=>JSON.parse(JSON.stringify(x));
class Storage {
  data=new Map(); fail=false;
  getItem(k){return this.data.get(k)??null;}
  setItem(k,v){if(this.fail)throw Error('injected storage failure');this.data.set(k,String(v));}
}
function fresh(){const storage=new Storage();globalThis.localStorage=storage;const {profile,error}=c.loadProfile();assert.equal(error,null);profile.gold=1000000;profile.materials=1000000;assert(c.saveProfile(profile).ok);return {profile,storage};}
const cases=[];
function test(name,fn){fn();cases.push({name,passed:true});}
const training=[];
test('all paid levels preserve base prices and apply bounded material discount',()=>{
  for(let b=0;b<=5;b++){
    const {profile:p}=fresh();for(let i=0;i<b;i++)assert(c.upgradeBuilding(p,'barracks','gold').ok);
    let totalGold=0,totalMaterials=0;const levels=[];
    for(let level=1;level<30;level++){
      const cost=c.getHeroTrainingCost(p);assert.deepEqual(cost,{gold:80+30*level-10*b,materials:Math.ceil((10+5*level)*(1-b*.05))});
      const before=copy(p);assert(c.trainHero(p).ok);assert.equal(p.gold,before.gold-cost.gold);assert.equal(p.materials,before.materials-cost.materials);assert.equal(p.heroes.commander.level,level+1);
      totalGold+=cost.gold;totalMaterials+=cost.materials;levels.push({from:level,...cost});
    }
    assert.equal(c.getHeroTrainingCost(p),null);const before=copy(p);assert.equal(c.trainHero(p).ok,false);assert.deepEqual(p,before);
    training.push({barracks:b,totalGold,totalMaterials,levels});
  }
  assert.equal(training[0].totalGold,15370);assert.equal(training[0].totalMaterials,2465);
});
test('all facility levels accept exact independent full payments and retain defaults',()=>{
  for(const payment of ['materials','gold'])for(const b of c.BUILDINGS){
    const {profile:p}=fresh();for(let level=0;level<5;level++){
      const materials=b.baseCost*(level+1),gold=materials*8;assert.equal(c.getBuildingCost(p,b.id),materials);assert.equal(c.getBuildingGoldCost(p,b.id),gold);
      const before=copy(p);assert((payment==='materials'?c.upgradeBuilding(p,b.id):c.upgradeBuilding(p,b.id,payment)).ok);
      assert.equal(p.gold,before.gold-(payment==='gold'?gold:0));assert.equal(p.materials,before.materials-(payment==='materials'?materials:0));
    }
    assert.equal(c.getBuildingCost(p,b.id),null);assert.equal(c.getBuildingGoldCost(p,b.id),null);const before=copy(p);assert.equal(c.upgradeBuilding(p,b.id,payment).ok,false);assert.deepEqual(p,before);
  }
});
test('invalid, unaffordable and save-failing purchases do not alter progress',()=>{
  for(const payment of ['mixed','gold','materials']){
    const {profile:p,storage}=fresh();p.gold=0;p.materials=0;assert(c.saveProfile(p).ok);const before=copy(p),raw=storage.getItem(c.STORAGE_KEY);
    assert.equal(c.upgradeBuilding(p,'hall',payment).ok,false);assert.deepEqual(p,before);assert.equal(storage.getItem(c.STORAGE_KEY),raw);
  }
  for(const mutate of [p=>c.upgradeBuilding(p,'unknown','gold'),p=>c.upgradeBuilding(p,'hall','gold'),p=>c.upgradeBuilding(p,'hall'),p=>c.trainHero(p)]){
    const {profile:p,storage}=fresh(),before=copy(p),raw=storage.getItem(c.STORAGE_KEY);storage.fail=true;assert.equal(mutate(p).ok,false);assert.deepEqual(p,before);assert.equal(storage.getItem(c.STORAGE_KEY),raw);
  }
  const {profile:p}=fresh();p.materials=14;assert(c.saveProfile(p).ok);const before=copy(p);assert.equal(c.trainHero(p).ok,false);assert.deepEqual(p,before);
});
const fixtureRoot=new URL('fixtures/save/',import.meta.url);
const current=JSON.parse(await readFile(new URL('current-sources.json',fixtureRoot),'utf8'));
test('existing current saves keep every field and existing barracks immediately benefit',()=>{
  const {profile:p}=fresh();p.buildings.barracks=5;assert(c.saveProfile(p).ok);const before=copy(p),loaded=c.loadProfile().profile;assert.deepEqual(loaded,before);assert.deepEqual(c.getHeroTrainingCost(loaded),{gold:60,materials:12});
});
for(const entry of current){
  const original=JSON.parse(await readFile(new URL(entry.file,fixtureRoot),'utf8')),storage=new Storage();globalThis.localStorage=storage;storage.setItem(c.STORAGE_KEY,JSON.stringify(original));const p=c.loadProfile().profile;assert(p);assert.deepEqual(p,original);
  const hero=p.heroes[p.selectedHero];if(hero.level<30){const cost=c.getHeroTrainingCost(p);assert.equal(cost.materials,Math.ceil((10+5*hero.level)*(1-p.buildings.barracks*.05)));}
  assert(c.saveProfile(p).ok);assert.deepEqual(JSON.parse(storage.getItem(c.STORAGE_KEY)),original);
}
const firstDays=[];
test('frozen reward values and two ads remain finite early acceleration',()=>{
  assert.deepEqual(c.DAILY_CHECKIN_REWARD,{gold:60,materials:8});assert.deepEqual(c.DUNGEONS.map(d=>d.rewards),[{gold:420,materials:48,xp:120},{gold:620,materials:72,xp:180},...Array.from({length:5},()=>({gold:180,materials:24,xp:90}))]);
  for(const ads of [false,true]){
    const {profile:p}=fresh();p.gold=300;p.materials=30;assert(c.saveProfile(p).ok);
    const date=new Date('2026-10-12T04:00:00Z');const daily=c.claimDailyCheckin(p,date);assert(daily.ok);if(ads)assert(c.grantDailyCheckinBonus(p,daily.day,date).ok);
    const run={id:'economy-first',dungeonId:'moss-gate',heroId:'commander',victory:true,time:360,kills:650};assert(c.settleRun(p,run).ok);assert(c.claimQuest(p,'main-moss').ok);if(ads)assert(c.grantAdGoldBonus(p,run.id).ok);
    const before={gold:p.gold,materials:p.materials};while(c.getHeroTrainingCost(p)&&p.gold>=c.getHeroTrainingCost(p).gold&&p.materials>=c.getHeroTrainingCost(p).materials)assert(c.trainHero(p).ok);
    firstDays.push({ads,before,after:{gold:p.gold,materials:p.materials,level:p.heroes.commander.level}});
  }
  assert.deepEqual(firstDays.map(x=>x.before),[{gold:980,materials:106},{gold:1250,materials:126}]);assert.deepEqual(firstDays.map(x=>x.after.level),[5,6]);
});
await mkdir(new URL('../output/economy-audit/',import.meta.url),{recursive:true});
await writeFile(new URL('../output/economy-audit/cost-comparison.json',import.meta.url),JSON.stringify({passed:true,cases,training,firstDays,facilities:c.BUILDINGS.map(b=>({id:b.id,totalMaterials:b.baseCost*15,totalGold:b.baseCost*15*8})),scope:'Production APIs in isolated memory storage; no player saves or historical fixtures modified.'},null,2)+'\n');
console.log(`Economy checks passed: ${cases.length} behavior groups; all 174 hero training prices and both full-payment paths verified.`);
