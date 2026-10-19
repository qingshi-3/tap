import assert from 'node:assert/strict';
import {autoAct,battleCommandTargets,castSpell,createExpeditionMatch,findGeneral,restoreMatch,validateMatch} from '../dist/js/engine.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {getCard} from '../dist/js/cards.js';
const clone=x=>JSON.parse(JSON.stringify(x));
const first=createExpeditionMatch('border-01');const general=findGeneral(first,1);
assert.deepEqual([general.health,general.maxHealth,general.attack],[12,12,1]);
assert.deepEqual(first.units.filter(u=>u.owner===1).map(u=>u.cardId),[23,14]);
first.currentPlayer=1;first.phase='ai';assert.equal(battleCommandTargets(first,1).available,false,'full-health opening has no healing command target');
assert.equal(autoAct(first,1),true);assert.equal(first.lastAction.kind,'summon','opening spends mana on a unit instead of healing/buffing full-health general');assert.equal(general.attack,1);
general.health=11;first.players[1].hand=[20043];first.players[1].mana=9;assert.equal(castSpell(first,0,general.unitId,1),true);assert.equal(general.health,12,'healing cannot exceed scenario cap');
assert.equal(validateMatch(first),true);
const uncapped=createExpeditionMatch('road-01'),oldGeneral=findGeneral(uncapped,1);assert.equal(oldGeneral.health,23);assert.equal(oldGeneral.maxHealth,Math.max(23,getCard(23).health));
const storage=new Map([['duelyst-h5.safe-v1.namespace','{"version":1}']]);const adapter={removeItem:k=>storage.delete(k),getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
assert.deepEqual(restoreMatch(clone(uncapped)).units,uncapped.units);
for(const state of [createExpeditionMatch('border-01')]){const p=new ExpeditionProgress(adapter);assert.equal(p.saveBattle(state).ok,true);const loaded=new ExpeditionProgress(adapter).state.activeBattle;assert.deepEqual(loaded.units,state.units);assert.deepEqual(restoreMatch(clone(loaded)).units,state.units);}
const legacy=clone(createExpeditionMatch('border-01'));findGeneral(legacy,1).health=18;findGeneral(legacy,1).maxHealth=25;findGeneral(legacy,1).attack=2;assert.equal(validateMatch(legacy),true);const p=new ExpeditionProgress(adapter);assert.equal(p.saveBattle(legacy).ok,true);assert.deepEqual(restoreMatch(new ExpeditionProgress(adapter).state.activeBattle).units,legacy.units,'existing snapshots retain old stats');
const config=EXPEDITION_LEVELS[0].enemies[0],original={...config};
try{for(const maxHealth of [0,-1,NaN,Infinity,11]){config.maxHealth=maxHealth;assert.throws(()=>createExpeditionMatch('border-01'),/Invalid scenario health cap/);}config.maxHealth=12;for(const health of [0,-1,NaN,Infinity,13]){config.health=health;assert.throws(()=>createExpeditionMatch('border-01'),/Invalid scenario health cap/);}}finally{Object.assign(config,original);}
for(const [id,cap,count,deck] of [['border-02',16,3,[14,9,14,20043]],['border-03',22,3,[14,9,14,20043]],['road-02',22,3,[14,15,20043,14]]]){const s=createExpeditionMatch(id);assert.equal(findGeneral(s,1).health,cap);assert.equal(s.units.filter(u=>u.owner===1).length,count);assert.deepEqual([...s.players[1].hand,...s.players[1].deck],deck);assert.equal(validateMatch(s),true);}
assert.equal(createExpeditionMatch('road-02').units.find(u=>u.owner===1&&u.x===8&&u.y===4).cardId,14);
const road2=createExpeditionMatch('road-02'),road3=createExpeditionMatch('road-03');
assert.equal(findGeneral(road2,1).cardId,1);assert.equal(findGeneral(road2,1).maxHealth,22);
assert.deepEqual(road2.units.filter(u=>u.owner===1).map(u=>u.cardId),[1,15,14]);
assert.deepEqual(road3.units.filter(u=>u.owner===1).map(u=>u.cardId),[23,17,11]);
assert.deepEqual([findGeneral(road3,1).health,findGeneral(road3,1).maxHealth],[22,22]);
const iron=road3.units.find(u=>u.cardId===17&&u.owner===1);assert.deepEqual([iron.attack,iron.health,iron.maxHealth],[2,7,7]);
assert.equal(battleCommandTargets(road3,1).unitIds.length,0,'road-03 starts without free healing/growth targets');
assert.deepEqual([...road3.players[1].hand,...road3.players[1].deck],[11,14,20066,15,16]);
console.log('Scenario enemy stats: caps, healing/AI opening, invalid configuration, four encounters, new/legacy save restore passed.');





