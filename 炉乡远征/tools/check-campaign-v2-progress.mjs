import { starterInventory } from '../dist/js/battle-deck.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ExpeditionProgress, normalizeExpeditionState } from '../dist/js/expedition-progress.js';
import { createExpeditionMatch, confirmMulligan, useBattleCommand, validateMatch } from '../dist/js/engine.js';
import { CAMPAIGN_UNIT_IDS, SPELL_IDS, NEUTRAL_IDS, unlockedInventory, getUnitSpecializations } from '../dist/js/campaign-rules.js';
import { EXPEDITION_LEVELS } from '../dist/js/expedition-data.js';
import { FACTIONS } from '../dist/js/factions.js';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';
const KEY=SAVE_KEYS.expedition;
const ownedInventory=(completed,options)=>{const base=unlockedInventory(completed,options),starter=starterInventory();return {units:[...new Set([...base.units,...starter.units])],spells:[...new Set([...base.spells,...starter.spells])]};};
class Storage {
  data=new Map(); fail=false; after=false;
  getItem(k){return this.data.get(k)??null;}
  setItem(k,v){if(this.fail)throw Error('planned failure');this.data.set(k,String(v));if(this.after && k===KEY){this.after=false;throw Error('after write');}}
  removeItem(k){this.data.delete(k);}
}
const reload = storage => { const p=new ExpeditionProgress(storage);assert.equal(p.error,'');return p; };
const fresh=new ExpeditionProgress(new Storage());
assert.equal(fresh.state.schemaVersion,13);
assert.deepEqual(fresh.state.inventory,ownedInventory([],{legacy:false}));
assert.equal(Object.keys(fresh.state.training).length,120);
assert.equal(Object.keys(fresh.state.spellTraining).length,48);
assert.equal(Object.keys(fresh.state.specializations).length,120);
assert.equal(fresh.train(19037).ok,false);
assert.equal(fresh.train(17).ok,false);
assert.equal(fresh.setSpells([20174,20044]).ok,false);
assert.equal(fresh.trainSpell(20174).ok,false);
assert.equal(fresh.setSpellMode(20174,'power').ok,false);
assert.equal(fresh.setSpecialization(14,'bodyguard').ok,false);
for(const f of FACTIONS){assert.ok(fresh.selectHero(f.heroIds[0]).ok);assert.deepEqual(fresh.getLoadout().spells,f.spellIds.slice(0,2));}
const fixtures=JSON.parse(await readFile(new URL('./fixtures/save-contract-0.1.9.json',import.meta.url)));
for(const old of fixtures.profiles){
 const storage=new Storage(),raw=` ${JSON.stringify(old)}\n`;storage.setItem(KEY,raw);let progress=reload(storage);
 const backup=old.schemaVersion===1?`${KEY}.legacy-v1-backup`:`${KEY}.legacy-v${old.schemaVersion}-backup`;
 assert.equal(storage.getItem(backup),raw);
 for (const failStage of ['backup','profile']) {
  const failed=new Storage();failed.setItem(KEY,raw);
  const write=failed.setItem.bind(failed);failed.setItem=(key,value)=>{if(key===(failStage==='backup'?backup:KEY))throw Error('migration failure');write(key,value);};
  const rejected=new ExpeditionProgress(failed);assert.ok(rejected.error);assert.equal(rejected.train(14).ok,false);assert.equal(failed.getItem(KEY),raw);
 }
 const corrupt=structuredClone(old);corrupt.training[10021]=0;assert.equal(normalizeExpeditionState(corrupt),null,'historical profile must reject nonhistorical roster');

 for(const field of ['coins','completed','squad','activeBattle','settlements'])assert.deepEqual(progress.state[field],old[field]);
 assert.deepEqual(progress.state.inventory,ownedInventory(old.completed,{legacy:true}));
 assert.equal(progress.state.inventory.units.filter(id=>!NEUTRAL_IDS.includes(id)).length,36);
 assert.equal(progress.state.inventory.spells.length,15);
 for(const id of Object.keys(old.training))assert.equal(progress.state.training[id],old.training[id]);
 assert.ok(progress.train(14).ok);progress=reload(storage);assert.ok(progress.train(progress.getTrainingAvailability(14).canTrain?14:9).ok);progress=reload(storage);
 assert.deepEqual(progress.state.activeBattle,old.activeBattle);
}
{
 const storage=new Storage();let p=reload(storage),state=p.state;
 const gate=structuredClone(state);gate.completed=EXPEDITION_LEVELS.slice(0,3).map(v=>v.id);gate.factionCompleted[1]=[...gate.completed];gate.accountStageClaims=Object.fromEntries(gate.completed.map(id=>[id,'legacy']));gate.inventory=ownedInventory(gate.completed,{legacy:false});gate.coins=500;
 assert.ok(p.replaceState(gate).ok);assert.ok(p.trainSpell(20174).ok);assert.equal(p.trainSpell(20174).ok,false,'second rank requires six completed levels');
 state=fresh.state; state.selectedHeroId=1; state.squad=[14,9,11];

 state.completed=EXPEDITION_LEVELS.slice(0,6).map(v=>v.id);state.factionCompleted[1]=[...state.completed];state.accountStageClaims=Object.fromEntries(state.completed.map(id=>[id,'legacy']));state.inventory=ownedInventory(state.completed,{legacy:false});state.coins=2000;
 assert.ok(p.replaceState(state).ok);
 assert.ok(p.train(10021).ok);p=reload(storage);assert.ok(p.train(10021).ok);p=reload(storage);
 const option=getUnitSpecializations(10021)[0];assert.ok(p.setSpecialization(10021,option.id).ok);assert.ok(p.setSquad([14,10021,11]).ok);
 assert.ok(p.trainSpell(20174).ok);assert.equal(p.state.spellModes[20174],'power');p=reload(storage);
 assert.ok(p.trainSpell(20174).ok);assert.equal(p.state.spellModes[20174],'power');assert.ok(p.setSpellMode(20174,'tactical').ok);assert.ok(p.setSpells([20174,20066]).ok);p=reload(storage);
 assert.deepEqual(p.getLoadout().spells,[20174,20066]);assert.equal(p.getLoadout().spellModes[20174],'tactical');assert.equal(p.getLoadout().specializations[10021],option.id);
 const snap=p.getLoadout();snap.spells.reverse();assert.deepEqual(p.getLoadout().spells,[20174,20066]);
 for(const action of [()=>p.train(14),()=>p.trainSpell(20066),()=>p.setSpellMode(20174,'base'),()=>p.setSpells([20043,20174]),()=>p.setSpecialization(10021,'none'),()=>p.setSquad([14,9,11])]){
  const before=p.state,raw=storage.getItem(KEY);storage.after=true;assert.equal(action().ok,false);assert.deepEqual(p.state,before);assert.equal(storage.getItem(KEY),raw);
 }
}
{
 const storage=new Storage();let p=reload(storage);assert.ok(p.replaceState({...p.state,legacyUnlockedLevels:['border-01','border-02']}).ok);
 for(let i=0;i<2;i++){
  let match=createExpeditionMatch(EXPEDITION_LEVELS[i].id,p.state.training,p.state.squad,p.state.selectedHeroId,p.getLoadout());
  assert.equal(match.schemaVersion,5);assert.ok(validateMatch(match));assert.ok(p.saveBattle(match).ok);p=reload(storage);
  match=structuredClone(p.state.activeBattle);confirmMulligan(match,[]);useBattleCommand(match);assert.ok(p.saveBattle(match).ok);p=reload(storage);
  match=structuredClone(p.state.activeBattle);match.phase='over';match.winner=0;match.result='win';
  const reward=p.settle(match);assert.ok(reward.ok);assert.deepEqual(reward.unlocked,{units:i===1?[10]:[],spells:[]},'old starter cards are not reissued; new milestone card is granted once');
  assert.deepEqual(p.settle(match).unlocked,{units:[],spells:[]});p=reload(storage);assert.ok(p.state.inventory.units.includes([10021,19027][i]));
 }
}
for(const mutate of [s=>s.schemaVersion=99,s=>s.training[999]=0,s=>s.inventory.units.push(999),s=>s.spellTraining[SPELL_IDS[0]]=3,s=>s.specializations[14]='skirmish']){
 const s=fresh.state;mutate(s);assert.equal(normalizeExpeditionState(s),null);const storage=new Storage(),raw=JSON.stringify(s);storage.setItem(KEY,raw);const p=new ExpeditionProgress(storage);assert.ok(p.error);assert.equal(p.train(14).ok,false);assert.equal(storage.getItem(KEY),raw);
}
console.log('campaign schema5 progress passed: frozen migration, inventory, twice-save reload, training gates, modes, specializations, settlement and transactional failures');
