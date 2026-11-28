import assert from 'node:assert/strict';
import { createExpeditionMatch, validateMatch, restoreMatch, playCard, summonPositions, drawCard, canUseHandCard, getBattleCard, autoAct, findGeneral, castSpell, attackUnit, movementPositions, endTurn, spellTargets, spellPositions, useBattleCommand } from '../dist/js/engine.js';
import { getCard } from '../dist/js/cards.js';
import { EXPEDITION_LEVELS } from '../dist/js/expedition-data.js';
import { CAMPAIGN_UNIT_IDS, getUnitSpecializations } from '../dist/js/campaign-rules.js';
const clone = value => JSON.parse(JSON.stringify(value));
const loadout = () => ({spells:[20174,20043],spellTraining:{20174:2,20043:2},spellModes:{20174:'power',20043:'tactical'},specializations:{14:'medic',9:'skirmish',11:'bodyguard'}});
const training = Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id => [id,4]));
const fresh = level => createExpeditionMatch(level ?? 'border-01',training,[14,9,11],1,loadout());
for (const level of EXPEDITION_LEVELS) {
  const state = fresh(level.id);
  assert.equal(validateMatch(state),true,level.id);
  assert.deepEqual(restoreMatch(clone(state)),state);
  assert.equal(createExpeditionMatch(level.id).schemaVersion,4);
  const reinforcement=restoreMatch(clone(state)), army=reinforcement.players[1];
  const unitId=[...army.hand,...army.deck].find(id=>getBattleCard(reinforcement,id,1).type==='unit'&&!getBattleCard(reinforcement,id,1).token);
  army.hand=[unitId]; army.mana=9; reinforcement.currentPlayer=1; reinforcement.phase='ai';
  const reinforcementCell=summonPositions(reinforcement,1,unitId)[0];
  if(reinforcementCell) {
    assert.equal(playCard(reinforcement,0,reinforcementCell.x,reinforcementCell.y,1),true);
    const made=reinforcement.units.find(unit=>unit.owner===1&&unit.x===reinforcementCell.x&&unit.y===reinforcementCell.y), frozen=getBattleCard(reinforcement,unitId,1), plan=reinforcement.enemyPlan.players[1];
    assert.equal(made.attack,frozen.attack+plan.attackBonus);
    assert.equal(made.maxHealth,frozen.health+plan.healthBonus);
    assert.equal(made.specialization,undefined);
  }
  let guard = 0;
  while (state.phase !== 'over' && guard++ < 700) {
    assert.equal(autoAct(state),true,`${level.id} action ${guard}`);
    assert.equal(validateMatch(state),true,`${level.id} snapshot ${guard}`);
  }
  assert.equal(state.phase,'over',`${level.id} terminates`);
}
const state = fresh();
assert.deepEqual(state.players[0].hand,[14,9,11,20174,20043]);
assert.deepEqual(state.players[0].deck,[]);
assert.equal(drawCard(state,0),null);
assert.equal(state.campaignSupply.resupply,3);
state.players[0].mana = 9;
let cell = summonPositions(state,0,14)[0];
assert.equal(playCard(state,0,cell.x,cell.y),true);
assert.equal(canUseHandCard(state,0),false);
assert.equal(playCard(state,0,cell.x,cell.y),false);
assert.equal(state.players[0].hand.length,5);
assert.equal(drawCard(state,0),14);
assert.equal(state.campaignSupply.resupply,2);
assert.equal(canUseHandCard(state,0),true);
for (const mutate of [s=>s.campaignSupply.remaining[0]=2,s=>s.campaignSupply.resupply=4,s=>s.players[0].deck.push(14),s=>s.loadout.spellModes[20043]='bad',s=>s.enemyPlan.players[1].behavior='bad',s=>s.unitGrowth[14].attack=-1]) {
  const bad=clone(state); mutate(bad); assert.equal(validateMatch(bad),false); assert.equal(restoreMatch(bad),null);
}
const restored=restoreMatch(clone(state));
assert.deepEqual(getBattleCard(restored,20043),getBattleCard(state,20043));
assert.equal(getBattleCard(restored,20043).tactical,true);
assert.equal(getBattleCard(restored,20043).cost,2);
const healing=fresh(); findGeneral(healing,0).health-=4; healing.players[0].mana=9;
const target=findGeneral(healing,0), before=target.health;
assert.equal(castSpell(healing,4,target.unitId),true);
assert.equal(target.health,before+4);
assert.equal(healing.campaignSupply.remaining[4],2);
assert.equal(getUnitSpecializations(11).some(spec=>spec.id==='bodyguard'),true);
// An adjacent guard reduces one independent hit, without redirecting damage.
const guarded=fresh(), protectedGeneral=findGeneral(guarded,0), guard=guarded.units.find(u=>u.cardId===11 && u.owner===0);
guarded.players[0].mana=9;
const guardCell=summonPositions(guarded,0,11).find(p=>Math.max(Math.abs(p.x-protectedGeneral.x),Math.abs(p.y-protectedGeneral.y))===1);
assert.equal(playCard(guarded,2,guardCell.x,guardCell.y),true);
const activeGuard=guarded.units.at(-1), enemy=guarded.players[1];
guarded.currentPlayer=1; guarded.phase='ai'; enemy.hand=[20081,20081]; enemy.mana=9;
const original=protectedGeneral.health;
assert.equal(castSpell(guarded,0,protectedGeneral.unitId,1),true);
assert.equal(protectedGeneral.health,original-2);
assert.equal(activeGuard.bodyguardUsed,true);
assert.equal(castSpell(guarded,0,protectedGeneral.unitId,1),true);
assert.equal(protectedGeneral.health,original-5);
// Skirmish restores movement once and preserves the spent attack.
const skirmish=fresh(), scout=skirmish.units.find(u=>u.owner===0&&u.cardId===9);
const opponent=skirmish.units.find(u=>u.owner===1&&u.cardId!==guarded.players[1].generalId);
opponent.x=scout.x+1; opponent.y=scout.y; opponent.attack=0; opponent.health=opponent.maxHealth=100;
scout.moved=true;
assert.equal(attackUnit(skirmish,scout.unitId,opponent.unitId),true);
assert.equal(scout.moved,false); assert.equal(scout.attacked,true); assert.equal(scout.skirmishUsed,true);
assert.ok(movementPositions(skirmish,scout).length>0);
// Entry healing and neutral rush are usable through the same deployment API.
const medical=fresh(); medical.players[0].mana=9; const patient=findGeneral(medical,0); patient.health-=4;
cell=summonPositions(medical,0,14)[0]; assert.equal(playCard(medical,0,cell.x,cell.y),true);
assert.equal(patient.health,patient.maxHealth-2);
const neutralLoadout=loadout(); neutralLoadout.specializations={};
for (const id of [10021,19027,10981,10019,19037,10012,19050]) {
  const n=createExpeditionMatch('border-01',{},[14,9,id],1,neutralLoadout);
  n.players[0].mana=9; findGeneral(n,0).health-=4;
  cell=summonPositions(n,0,id)[0]; assert.equal(playCard(n,2,cell.x,cell.y),true);
  const made=n.units.at(-1);
  if(id===10012) { assert.equal(made.summonedThisTurn,false); assert.equal(made.moved,false); assert.equal(made.attacked,false); }
  if(id===10981) assert.equal(findGeneral(n,0).health,findGeneral(n,0).maxHealth-2);
  assert.equal(validateMatch(n),true,`neutral ${id} snapshot`);
}
const fist=createExpeditionMatch('border-01',{},[14,9,19037],1,neutralLoadout);
fist.players[0].mana=9;
const firstAlly=fist.units.find(u=>u.owner===0&&u.cardId===14), oldAttack=firstAlly.attackBuff;
cell=summonPositions(fist,0,19037).find(p=>Math.max(Math.abs(p.x-firstAlly.x),Math.abs(p.y-firstAlly.y))===1);
assert.equal(playCard(fist,2,cell.x,cell.y),true); assert.equal(firstAlly.attackBuff,oldAttack+2);
assert.equal(validateMatch(fist),true); assert.equal(restoreMatch(clone(fist)).units.find(u=>u.unitId===firstAlly.unitId).tempAlliedAttackBuff,2);
endTurn(fist); assert.equal(firstAlly.attackBuff,oldAttack);
const shaman=createExpeditionMatch('border-01',{},[14,9,19050],1,neutralLoadout);
shaman.players[0].mana=9;
const beneficiary=shaman.units.find(u=>u.owner===0&&u.cardId===14);
cell=summonPositions(shaman,0,19050).find(p=>Math.max(Math.abs(p.x-beneficiary.x),Math.abs(p.y-beneficiary.y))===1);
assert.equal(playCard(shaman,2,cell.x,cell.y),true);
const doomed=shaman.units.at(-1), oldHealth=beneficiary.health, oldCap=beneficiary.maxHealth+beneficiary.healthBuff;
shaman.currentPlayer=1; shaman.phase='ai'; shaman.players[1].mana=9; shaman.players[1].hand=[20081,20081];
assert.equal(castSpell(shaman,0,doomed.unitId,1),true); assert.equal(castSpell(shaman,0,doomed.unitId,1),true);
assert.equal(shaman.units.includes(doomed),false); assert.equal(beneficiary.health,oldHealth+4); assert.equal(beneficiary.maxHealth+beneficiary.healthBuff,oldCap+4);
assert.equal(validateMatch(shaman),true);
// Reject incomplete rules closures before any command can spend resources.
const summoner=createExpeditionMatch('border-01',{},[308,317,311],301,{spells:[20052,20072],spellTraining:{},spellModes:{},specializations:{}});
assert.equal(validateMatch(summoner),true);
for (const id of [315,411,504,525,217]) {
  const missing=clone(summoner); delete missing.battleCards[0][id];
  assert.equal(validateMatch(missing),false,`missing frozen token ${id}`);
  assert.equal(restoreMatch(missing),null);
}
assert.equal(useBattleCommand(summoner,null),true);
assert.ok(summoner.units.some(unit=>unit.cardId===315&&unit.token));
// A consumed specialization flag must never be silently recreated on restore.
for (const [battle,unit,key] of [[guarded,activeGuard,'bodyguardUsed'],[skirmish,scout,'skirmishUsed']]) {
  assert.equal(unit[key],true);
  const missing=clone(battle); delete missing.units.find(other=>other.unitId===unit.unitId)[key];
  assert.equal(validateMatch(missing),false); assert.equal(restoreMatch(missing),null);
}
const focused=createExpeditionMatch('border-01',{},[110,115,109],101,{spells:[20081,20086],spellTraining:{20086:2},spellModes:{20086:'power'},specializations:{}});
const focusAlly=focused.units.find(unit=>unit.owner===0&&unit.cardId===110); focusAlly.attack=4;
assert.equal(getCard(20086).maxAttack,3);
assert.ok(spellTargets(focused,getCard(20086)).some(unit=>unit.unitId===focusAlly.unitId),'target previews resolve the frozen upgraded maxAttack');
assert.deepEqual(spellPositions(summoner,getCard(20072)),spellPositions(summoner,getBattleCard(summoner,20072)));
// Required fields cannot disappear while the frozen card itself remains present.
for (const [id,key] of [[20043,'amount'],[20044,'amount'],[20066,'amount'],[20068,'bondBonus'],[20174,'amount'],[20052,'heal'],[20072,'count'],[20072,'summon'],[20081,'amount'],[20086,'maxAttack'],[20086,'refresh'],[20095,'attackBuff'],[20095,'draw'],[20116,'healthBuff'],[20117,'heal'],[20139,'amount'],[20139,'stun'],[20149,'count'],[20149,'summon'],[20151,'amount'],[10021,'ranged'],[19027,'provoke'],[10981,'openingHeal'],[19037,'openingTempAttack'],[10012,'rush'],[19050,'dyingAlliedHealth'],[310,'deathWatchSpawn'],[503,'dyingWolf'],[412,'rebirth']]) {
  const missing=clone(state); delete missing.battleCards[0][id][key];
  assert.equal(validateMatch(missing),false,`required frozen ${id}.${key}`); assert.equal(restoreMatch(missing),null);
}
assert.match(getBattleCard(state,20095,0).description,/补给1次/);
assert.match(getBattleCard(state,20095,1).description,/抽1张牌/);
assert.doesNotMatch(getBattleCard(state,20095,1).description,/补给1次/);
console.log('Campaign v2 engine: 18 complete simulations, frozen round trips, limited supply and invalid snapshot rejection passed.');
