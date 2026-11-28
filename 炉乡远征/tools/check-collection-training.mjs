import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ExpeditionProgress,validateExpeditionState} from '../dist/js/expedition-progress.js';
import {FACTIONS} from '../dist/js/factions.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
import {CAMPAIGN_UNIT_IDS,NEUTRAL_IDS,SPELL_IDS,getSpellTrainingPolicy,getUnitSpecializations} from '../dist/js/campaign-rules.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
import {createExpeditionMatch,validateMatch} from '../dist/js/engine.js';

class Storage {
  data=new Map(); fail=false;
  getItem(k){return this.data.get(k)??null;}
  removeItem(k){this.data.delete(k);}
  setItem(k,v){if(this.fail)throw Error('quota');this.data.set(k,String(v));}
}
const storage=new Storage();
let p=new ExpeditionProgress(storage);
function seed(mutate){const state=p.state;mutate(state);assert.ok(validateExpeditionState(state));assert.ok(p.replaceState(state).ok);}
function reload(){p=new ExpeditionProgress(storage);assert.equal(p.error,'');assert.ok(validateExpeditionState(p.state));}
const foreign=FACTIONS[1],unit=foreign.defaultSquad[0],spell=foreign.spellIds.find(id=>getSpellTrainingPolicy(id).trainable);
assert.ok(p.selectHero(foreign.heroIds[0]).ok);
for(const level of EXPEDITION_LEVELS.slice(0,6)){
  const s=p.state,match=createExpeditionMatch(level.id,s.training,s.squad,s.selectedHeroId,p.getBattleLoadout());
  assert.ok(p.saveBattle(match).ok);Object.assign(match,{phase:'over',winner:0,result:'win'});assert.ok(validateMatch(match));assert.ok(p.settle(match).ok);
}
assert.ok(p.selectHero(FACTIONS[0].heroIds[0]).ok);
seed(s=>{s.coins=10000;});
const selection=()=>{const s=p.state;return {selectedHeroId:s.selectedHeroId,squad:s.squad,factionSquads:s.factionSquads,factionDecks:s.factionDecks,factionSpells:s.factionSpells};};
const originalSelection=selection();
assert.equal(p.getFactionProgress().spellRankCap,0,'active faction has no spell training rights');
assert.ok(p.getTrainingAvailability(unit).canTrain);
assert.ok(p.getTrainingAvailability(spell).canTrain);
const beforeCoins=p.state.coins,unitCost=p.getTrainingAvailability(unit).cost,spellCost=p.getTrainingAvailability(spell).cost;
assert.ok(p.train(unit).ok);assert.ok(p.trainSpell(spell).ok);
assert.equal(p.state.coins,beforeCoins-unitCost-spellCost);
assert.deepEqual(selection(),originalSelection);
const saved=p.state;reload();assert.deepEqual(p.state,saved);
assert.ok(p.train(unit).ok);assert.ok(p.trainSpell(spell).ok);
assert.ok(p.setSpellMode(spell,'tactical').ok);
const specialization=getUnitSpecializations(unit,p.state.growthVersion[unit])[0].id;
assert.ok(p.setSpecialization(unit,specialization).ok);
assert.deepEqual(selection(),originalSelection);
reload();assert.equal(p.state.training[unit],2);assert.equal(p.state.spellTraining[spell],2);assert.equal(p.state.spellModes[spell],'tactical');assert.equal(p.state.specializations[unit],specialization);assert.deepEqual(selection(),originalSelection);

function rejected(id,method){const before=p.state,raw=storage.getItem(SAVE_KEYS.expedition);assert.equal(p[method](id).ok,false);assert.deepEqual(p.state,before);assert.equal(storage.getItem(SAVE_KEYS.expedition),raw);}
rejected(unit,'train');rejected(spell,'trainSpell');
const gatedUnit=FACTIONS[2].defaultSquad[0],gatedSpell=FACTIONS[2].spellIds.find(id=>getSpellTrainingPolicy(id).trainable);
seed(s=>{s.inventory.spells.push(...[gatedSpell].filter(id=>!s.inventory.spells.includes(id)));s.training[gatedUnit]=1;});
assert.equal(p.getTrainingAvailability(gatedUnit).canTrain,false);assert.equal(p.getTrainingAvailability(gatedSpell).canTrain,false);
rejected(gatedUnit,'train');rejected(gatedSpell,'trainSpell');
const missingUnit=CAMPAIGN_UNIT_IDS.find(id=>!p.state.inventory.units.includes(id));
const missingSpell=SPELL_IDS.find(id=>!p.state.inventory.spells.includes(id));
assert.ok(missingUnit);assert.ok(missingSpell);
for(const [id,method,option] of [[missingUnit,'setSpecialization','none'],[missingSpell,'setSpellMode','base'],[999999,'setSpecialization','none'],[999999,'setSpellMode','base'],[unit,'setSpecialization','invalid'],[spell,'setSpellMode','invalid'],[gatedSpell,'setSpellMode','tactical'],[gatedUnit,'setSpecialization',specialization]]){
  const before=p.state,raw=storage.getItem(SAVE_KEYS.expedition);assert.equal(p[method](id,option).ok,false);assert.deepEqual(p.state,before);assert.equal(storage.getItem(SAVE_KEYS.expedition),raw);
}
for(const [id,method] of [[missingUnit,'train'],[missingSpell,'trainSpell'],[999999,'train'],[999999,'trainSpell'],[spell,'train'],[unit,'trainSpell']])rejected(id,method);
assert.equal(p.getTrainingAvailability(999999).canTrain,false);
const neutral=NEUTRAL_IDS.find(id=>p.state.inventory.units.includes(id));assert.ok(neutral);
seed(s=>{s.training[neutral]=1;});
assert.equal(p.getTrainingAvailability(neutral).cap,2,'neutral uses any faction progress');assert.ok(p.train(neutral).ok);
const policySpells=SPELL_IDS.filter(id=>!getSpellTrainingPolicy(id).trainable);
seed(s=>{s.inventory.spells.push(...policySpells.filter(id=>!s.inventory.spells.includes(id)));});
for(const id of policySpells){assert.equal(p.getTrainingAvailability(id).canTrain,false);rejected(id,'trainSpell');}
seed(s=>{s.training[unit]=4;s.coins=0;s.spellTraining[spell]=0;s.spellModes[spell]='base';s.training[neutral]=0;});
rejected(unit,'train');rejected(neutral,'train');rejected(spell,'trainSpell');
assert.equal(p.getTrainingAvailability(neutral).reason,'金币不足。');assert.equal(p.getTrainingAvailability(spell).reason,'金币不足。');
seed(s=>{s.coins=1000;s.training[unit]=0;s.specializations[unit]='none';});
const beforeFailure=p.state,raw=storage.getItem(SAVE_KEYS.expedition);storage.fail=true;
assert.equal(p.train(unit).ok,false);assert.deepEqual(p.state,beforeFailure);assert.equal(storage.getItem(SAVE_KEYS.expedition),raw);
storage.fail=false;reload();assert.ok(p.train(unit).ok);reload();assert.equal(p.state.training[unit],1);assert.deepEqual(selection(),originalSelection);
const output=new URL('../output/collection-refinement/',import.meta.url);await mkdir(output,{recursive:true});
await writeFile(new URL('training-rules-report.json',output),JSON.stringify({passed:true,foreignFaction:foreign.id,unit,spell,activeHero:p.state.selectedHeroId,checks:['foreign owned unit and spell without selecting faction','card faction gates independent of active campaign','neutral any-faction gate','non-owned, unknown and wrong-type IDs reject without spending','non-trainable spell policies','insufficient coins and max rank','selection and decks preserved','save reload train save reload','failed storage write preserves state and retry'],coverage:'Public progress API with isolated in-memory storage; UI validated separately.'},null,2));
console.log('Collection training rules passed, including persistence and unchanged active faction/decks.');
