import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ExpeditionProgress, normalizeExpeditionState, validateExpeditionState } from '../dist/js/expedition-progress.js';
import { validateRecruitmentConfig, recruitmentDraw } from '../dist/js/recruitment.js';
import { RECRUITMENT_CONFIG } from '../dist/js/recruitment-config.js';
import { CAMPAIGN_UNIT_IDS, SPELL_IDS } from '../dist/js/campaign-rules.js';
import { createExpeditionMatch } from '../dist/js/expedition-engine.js';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';

const clone = v => structuredClone(v);
class Storage {
  data = new Map([['duelyst-h5.safe-v1.namespace','{"version":1}']]); fail = false; mutateFail = false; writes = 0;
  getItem(k) { return this.data.get(k) ?? null; }
  removeItem(k) { this.data.delete(k); }
  setItem(k,v) { if (this.fail) throw Error('quota'); this.data.set(k,v); this.writes++; if (this.mutateFail && k === SAVE_KEYS.expedition) { this.mutateFail = false; throw Error('write after mutation'); } }
}
const initial = new ExpeditionProgress(new Storage()).state;
const unit = CAMPAIGN_UNIT_IDS.find(id=>!initial.inventory.units.includes(id));
const spell = SPELL_IDS.filter(id=>!initial.inventory.spells.includes(id)).at(-1);
// Deliberately artificial fixtures are never exported to the production pool.
const config = { schemaVersion:1, victoryTickets:4, adTickets:3, adEnabled:true,
  recipes:[{cardId:unit,fragmentsRequired:2},{cardId:spell,fragmentsRequired:2}],
  pools:[{id:'fixture',name:'Test fixture',ticketCost:1,entries:[{cardId:unit,weight:1,fragments:2},{cardId:spell,weight:3,fragments:2}]}] };
{
  // Load the real profile implementation with a damaged production export,
  // without touching the production file or creating a second fixture asset.
  const sourceUrl=new URL('../dist/js/expedition-progress.js',import.meta.url);
  const source=(await readFile(sourceUrl,'utf8'))
    .replace("import { RECRUITMENT_CONFIG } from './recruitment-config.js';",'const RECRUITMENT_CONFIG = { schemaVersion: 1, pools: null, recipes: null };')
    .replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${new URL(path,sourceUrl).href}'`);
  const {ExpeditionProgress: BrokenProduction}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const p=new BrokenProduction(new Storage()); assert.match(p.recruitmentStatus().error,/配置/);
  assert.equal(validateRecruitmentConfig(p.recruitmentConfig),true); assert.deepEqual(p.recruitmentConfig.pools,[]); assert.deepEqual(p.recruitmentConfig.recipes,[]);
  assert.equal(p.drawRecruitment('fixture').ok,false); assert.equal(p.settle(win(p,'broken-config-win')).ok,true);
}
function win(p,id) { const s=p.state, m=createExpeditionMatch('border-01',s.training,s.squad,s.selectedHeroId); Object.assign(m,{runId:id,phase:'over',winner:0,result:'win'}); return m; }
function ready(options={}) { const storage=new Storage(), p=new ExpeditionProgress(storage,{recruitmentConfig:config,rng:()=>0,...options}); assert.equal(p.state.recruitment.tickets,10,'new-account starter orbs'); const fixtureState=p.state; fixtureState.recruitment.tickets=0; assert.equal(p.replaceState(fixtureState).ok,true); assert.equal(p.settle(win(p,'fixture-win')).ok,true); return {storage,p}; }
assert.equal(validateRecruitmentConfig(RECRUITMENT_CONFIG),true);
// The production pool is content data and may be filled without changing these tests.
const empty = new ExpeditionProgress(new Storage(), { recruitmentConfig: { ...clone(config), pools: [], recipes: [] } });
assert.equal(empty.drawRecruitment('fixture').ok, false);
assert.equal(validateRecruitmentConfig(config),true);
for (const mutate of [c=>c.pools[0].entries[0].weight=0,c=>c.pools[0].entries[0].weight=-1,c=>c.pools.push(clone(c.pools[0])),c=>c.recipes.push(clone(c.recipes[0])),c=>c.pools[0].entries.push(clone(c.pools[0].entries[0])),c=>c.recipes[0].cardId=1,c=>c.victoryTickets=1.5,c=>c.pools[0].entries[0].weight=Number.MAX_SAFE_INTEGER]) {
  const bad=clone(config); mutate(bad); assert.equal(validateRecruitmentConfig(bad),false);
  const p=new ExpeditionProgress(new Storage(),{recruitmentConfig:bad}); assert.match(p.recruitmentStatus().error,/配置/); assert.equal(p.drawRecruitment('fixture').ok,false);
}
for (const [roll,id] of [[0,unit],[0.249999,unit],[0.25,spell],[0.999999,spell]]) assert.equal(recruitmentDraw(config.pools[0],()=>roll).cardId,id);
for (const roll of [1,-1,NaN,Infinity]) assert.throws(()=>recruitmentDraw(config.pools[0],()=>roll));
{
  const {storage,p}=ready(); assert.equal(p.state.recruitment.tickets,4); const raw=storage.getItem(SAVE_KEYS.expedition);
  assert.equal(p.settle(win(p,'fixture-win')).duplicate,true); assert.equal(storage.getItem(SAVE_KEYS.expedition),raw);
  assert.equal(p.drawRecruitment('missing').ok,false); assert.equal(p.synthesizeCard(unit).ok,false);
  assert.equal(p.drawRecruitment('fixture').cardId,unit); assert.equal(p.synthesizeCard(unit).ok,true); assert.ok(p.state.inventory.units.includes(unit));
  const after=p.state; assert.equal(p.synthesizeCard(unit).ok,false); assert.deepEqual(p.state,after);
  assert.equal(p.drawRecruitment('fixture').ok,true); assert.equal(p.state.recruitment.fragments[unit],2,'owned cards retain new fragments');
  const q=new ExpeditionProgress(storage,{recruitmentConfig:config,rng:()=>0.25}); assert.equal(q.drawRecruitment('fixture').cardId,spell); assert.equal(q.synthesizeCard(spell).ok,true); assert.ok(q.state.inventory.spells.includes(spell));
  assert.equal(q.drawRecruitment('fixture').ok,true); assert.equal(q.drawRecruitment('fixture').ok,false); assert.equal(q.state.recruitment.tickets,0);
  const reload=new ExpeditionProgress(storage); assert.equal(reload.error,''); assert.equal(reload.state.recruitment.fragments[spell],2,'removed pool does not invalidate ledger');
  const stale=p.state; assert.equal(p.drawRecruitment('fixture').ok,false,'stale page rejects'); assert.deepEqual(p.state,stale);
}
{
  const {storage,p}=ready(); const old=p.state; storage.fail=true;
  assert.equal(p.drawRecruitment('fixture').ok,false); assert.deepEqual(p.state,old); storage.fail=false;
  storage.mutateFail=true; const raw=storage.getItem(SAVE_KEYS.expedition); assert.equal(p.drawRecruitment('fixture').ok,false); assert.deepEqual(p.state,old); assert.equal(storage.getItem(SAVE_KEYS.expedition),raw);
  assert.equal(p.drawRecruitment('fixture').ok,true); const fragments=p.state; storage.fail=true; assert.equal(p.synthesizeCard(unit).ok,false); assert.deepEqual(p.state,fragments);
}
{
 const {storage,p}=ready();assert.equal(p.recruitmentAdOffer('fixture-win').eligible,false);assert.equal(p.beginRecruitmentAd('fixture-win','legacy').ok,false);assert.ok(p.beginDailyAd('orb','ad1').ok);assert.ok(p.beginDailyAd('orb','ad1').duplicate);
 const q=new ExpeditionProgress(storage,{recruitmentConfig:{...clone(config),adTickets:99,adEnabled:false},rng:()=>0});assert.equal(q.completeDailyAd('orb','ad2').ok,false);const before=q.state;storage.fail=true;assert.equal(q.completeDailyAd('orb','ad1').ok,false);assert.deepEqual(q.state,before);storage.fail=false;
 assert.equal(q.completeDailyAd('orb','ad1').amount,1);assert.equal(q.state.recruitment.tickets,5);assert.ok(q.completeDailyAd('orb','ad1').duplicate);assert.equal(q.beginDailyAd('orb','ad3').ok,false);assert.equal(p.completeDailyAd('orb','ad1').ok,false,'stale pending cannot overwrite');
}
{
 const {storage,p}=ready();assert.ok(p.beginDailyAd('orb','lost').ok);const frozen=p.state.dailyAds.orb.roll;
 const q=new ExpeditionProgress(storage,{rng:()=>0.99});assert.ok(q.beginDailyAd('orb','resumed').ok);assert.deepEqual(q.state.dailyAds.orb.roll,frozen);assert.equal(q.completeDailyAd('orb','lost').ok,false);assert.ok(q.completeDailyAd('orb','resumed').ok);assert.ok(q.completeDailyAd('orb','resumed').duplicate);
}
{
 const {p}=ready();assert.ok(p.beginDailyAd('orb','cancelled').ok);assert.ok(p.cancelDailyAd('orb','cancelled').ok);assert.equal(p.completeDailyAd('orb','cancelled').ok,false);assert.ok(p.beginDailyAd('orb','new').ok);assert.equal(p.completeDailyAd('orb','cancelled').ok,false);assert.ok(p.cancelDailyAd('orb','new').ok);assert.ok(p.beginDailyAd('orb','third').ok);assert.ok(p.completeDailyAd('orb','third').ok);assert.equal(p.dailyAdOffer('orb').eligible,false);
}
{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/save-contract-0.1.9.json',import.meta.url),'utf8'));
  for (const old of fixture.profiles) {
    const storage=new Storage(), raw=JSON.stringify(old); storage.data.set(SAVE_KEYS.expedition,raw);
    const p=new ExpeditionProgress(storage,{recruitmentConfig:config}); assert.equal(p.error,'',`schema ${old.schemaVersion}`); assert.equal(p.state.schemaVersion,13); assert.equal(p.state.recruitment.tickets,0);
    assert.equal(p.state.coins,old.coins); assert.deepEqual(p.state.completed,old.completed);
    assert.equal(p.selectHero(p.state.selectedHeroId).ok,true); const reload=new ExpeditionProgress(storage,{recruitmentConfig:config}); assert.equal(reload.error,''); assert.equal(reload.selectHero(reload.state.selectedHeroId).ok,true);
  }
}
{
  const {p}=ready(), legacy=p.state; legacy.schemaVersion=5; delete legacy.giftCodeClaims; delete legacy.dailyAds; delete legacy.recruitment; delete legacy.factionDecks; for(const key of ['factionCompleted','legacyUnlockedLevels','growthVersion','accountStageClaims','factionChapterClaims','battleRewards'])delete legacy[key]; legacy.training=Object.fromEntries(Object.entries(legacy.training).filter(([id])=>[14,9,15,16,11,17,110,115,109,108,111,116,213,211,214,209,215,216,308,317,311,309,310,316,406,412,410,402,404,413,505,506,503,526,511,513,10021,19027,10981,10019,19037,10012,19050].includes(Number(id))));legacy.spellTraining=Object.fromEntries(Object.entries(legacy.spellTraining).filter(([id])=>[20174,20043,20066,20044,20068,20081,20086,20095,20151,20052,20072,20116,20117,20139,20149].includes(Number(id))));legacy.spellModes=Object.fromEntries(Object.keys(legacy.spellTraining).map(id=>[id,legacy.spellModes[id]]));legacy.specializations=Object.fromEntries(Object.keys(legacy.training).map(id=>[id,legacy.specializations[id]]));legacy.inventory.units=legacy.inventory.units.filter(id=>Object.hasOwn(legacy.training,id)); const storage=new Storage(), raw=JSON.stringify(legacy); storage.data.set(SAVE_KEYS.expedition,raw);
  const migrated=new ExpeditionProgress(storage,{recruitmentConfig:config}); assert.equal(migrated.error,''); assert.equal(migrated.state.schemaVersion,13); assert.equal(migrated.state.recruitment.tickets,0);
  assert.equal(storage.getItem(`${SAVE_KEYS.expedition}.legacy-v5-backup`),raw); assert.equal(migrated.settle(win(migrated,'fixture-win')).tickets,0); assert.equal(migrated.recruitmentAdOffer('fixture-win').eligible,false);
  assert.equal(migrated.settle(win(migrated,'new-win')).tickets,4); const reload=new ExpeditionProgress(storage,{recruitmentConfig:config,rng:()=>0}); assert.equal(reload.drawRecruitment('fixture').ok,true); assert.equal(reload.synthesizeCard(unit).ok,true);
  assert.equal(new ExpeditionProgress(storage).state.inventory.units.includes(unit),true);
  const future={...reload.state,schemaVersion:99}, futureRaw=JSON.stringify(future); storage.data.set(SAVE_KEYS.expedition,futureRaw); const blocked=new ExpeditionProgress(storage,{recruitmentConfig:config}); assert.equal(blocked.settle(win(blocked,'blocked')).ok,false); assert.equal(storage.getItem(SAVE_KEYS.expedition),futureRaw); assert.equal(normalizeExpeditionState(future),null);
}
{
  const {p}=ready(); for (const mutate of [s=>s.recruitment.tickets=-1,s=>s.recruitment.tickets=Number.MAX_SAFE_INTEGER+1,s=>s.recruitment.fragments[unit]=0.5,s=>s.recruitment.victoryClaims.missing=1]) { const bad=p.state; mutate(bad); assert.equal(validateExpeditionState(bad),false); }
  const cap=p.state; cap.recruitment.tickets=Number.MAX_SAFE_INTEGER; assert.equal(p.replaceState(cap).ok,true); const before=p.state; assert.equal(p.settle(win(p,'overflow')).ok,false); assert.deepEqual(p.state,before);
}
console.log('Recruitment checks passed: configuration, weighted boundaries, atomic draw/synthesis/settlement, receipts, stale pages, migration and reload.');
