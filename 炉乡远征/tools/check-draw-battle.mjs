import assert from 'node:assert/strict';
import {createCampaignMatch,validateMatch,restoreMatch,confirmMulligan,toggleMulligan,drawCard,replaceHandCard,canReplaceHandCard,autoAct,endTurn,findGeneral,playCard,summonPositions,castSpell,useBattleCommand,getBattleCard,BATTLE_SCHEMA} from '../dist/js/engine.js';
import {makeStarterDeck} from '../dist/js/battle-deck.js';
import {FACTIONS} from '../dist/js/factions.js';
import {getEnemyPlan} from '../dist/js/enemy-plans.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
const clone=value=>JSON.parse(JSON.stringify(value));
const fresh=(heroId=1,level='border-01',options={})=>createCampaignMatch(level,heroId,makeStarterDeck(heroId),options);
const playing=hero=>{const state=fresh(hero);assert.equal(confirmMulligan(state),true);return state;};
function arrangeHand(state,ids){const all=[...state.playerDeck];for(const id of ids){const i=all.indexOf(id);assert.ok(i>=0);all.splice(i,1);}state.players[0].hand=[...ids];state.players[0].deck=all;}
for(const faction of FACTIONS){const state=fresh(faction.heroIds[0]);assert.equal(state.schemaVersion,BATTLE_SCHEMA);assert.equal(validateMatch(state),true);assert.equal(state.phase,'mulligan');assert.equal(state.players[0].hand.length,5);assert.equal(state.players[0].deck.length,25);assert.equal(state.units.filter(u=>u.owner===0).length,1);assert.deepEqual(clone(restoreMatch(clone(state))),clone({...state,selectedUnitId:null}));}
// Mulligan returns the chosen cards to the pile, then the first turn draws one.
const mulligan=fresh();arrangeHand(mulligan,[14,14,14,9,9]);
assert.equal(toggleMulligan(mulligan,0),true);toggleMulligan(mulligan,1);toggleMulligan(mulligan,2);assert.deepEqual(mulligan.mulligan,[0,1]);
assert.equal(confirmMulligan(mulligan),true);assert.ok(mulligan.players[0].hand[0]!==14&&mulligan.players[0].hand[1]!==14);assert.equal(mulligan.players[0].hand.length+mulligan.players[0].deck.length,30);assert.equal(mulligan.players[0].hand.length,6);assert.equal(mulligan.round,1);assert.equal(mulligan.players[0].mana,EXPEDITION_LEVELS[0].mana);assert.equal(validateMatch(mulligan),true);
const replacing=playing();arrangeHand(replacing,[14]);const beforeMana=replacing.players[0].mana,beforeTriggers=clone(replacing.players[0].turnTriggers);assert.equal(canReplaceHandCard(replacing,0),true);assert.equal(replaceHandCard(replacing,0),true);assert.notEqual(replacing.players[0].hand[0],14);assert.equal(replacing.players[0].deck.length,29);assert.equal(replacing.players[0].mana,beforeMana);assert.deepEqual(replacing.players[0].turnTriggers,beforeTriggers);assert.equal(replacing.players[0].replacesUsed,1);assert.equal(canReplaceHandCard(replacing,0),false);assert.equal(restoreMatch(clone(replacing)).players[0].replacesUsed,1);const immutable=JSON.stringify(replacing);assert.equal(replaceHandCard(replacing,0),false);assert.equal(JSON.stringify(replacing),immutable);
const same=playing();same.players[0].hand=[14];same.players[0].deck=[14];assert.equal(replaceHandCard(same,0),true);assert.deepEqual(same.players[0].hand,[14]);assert.deepEqual(same.players[0].deck,[14]);same.players[0].replacesUsed=0;same.players[0].deck=[];assert.equal(canReplaceHandCard(same,0),false);
// Drawing at the 6-card cap burns the top card.
const full=playing();arrangeHand(full,[14,14,14,9,9,9]);const fullHand=[...full.players[0].hand],count=full.players[0].deck.length;assert.equal(drawCard(full,0),null);assert.deepEqual(full.players[0].hand,fullHand);assert.equal(full.players[0].deck.length,count-1);assert.equal(validateMatch(full),true);
// Fatigue is progressive (1,2,3...) and its counter survives a save round-trip.
const fatigue=playing();fatigue.players[0].deck=[];let general=findGeneral(fatigue,0),health=general.health;drawCard(fatigue,0);assert.equal(general.health,health-1);drawCard(fatigue,0);assert.equal(general.health,health-3);assert.equal(fatigue.players[0].fatigueCount,2);assert.equal(validateMatch(fatigue),true);const resumed=restoreMatch(clone(fatigue));drawCard(resumed,0);assert.equal(findGeneral(resumed,0).health,health-6);
// Drawing the last real card is safe; only the next attempt hurts.
const last=playing();last.players[0].hand=[];last.players[0].deck=[14];health=findGeneral(last,0).health;assert.equal(drawCard(last,0),14);assert.equal(findGeneral(last,0).health,health);drawCard(last,0);assert.equal(findGeneral(last,0).health,health-1);
// Turn-start fatigue can end the match before the player acts.
const lethal=playing();lethal.players[0].deck=[];findGeneral(lethal,0).health=1;lethal.currentPlayer=1;lethal.phase='ai';assert.equal(endTurn(lethal,1),true);assert.equal(lethal.phase,'over');assert.equal(lethal.result,'loss');assert.equal(lethal.currentPlayer,0);const ended=JSON.stringify(lethal);assert.equal(drawCard(lethal,1),null);assert.equal(JSON.stringify(lethal),ended);assert.equal(validateMatch(lethal),true);
// First Wish removes itself, applies the buff, and draws from the real pile.
const spell=playing(201);arrangeHand(spell,[213,20095]);spell.players[0].mana=9;let cell=summonPositions(spell,0,213)[0];playCard(spell,0,cell.x,cell.y);const target=spell.units.find(u=>u.owner===0&&u.cardId===213),drawBefore=spell.players[0].deck.length;assert.equal(castSpell(spell,0,target.unitId),true);assert.equal(spell.players[0].deck.length,drawBefore-1);assert.equal(spell.players[0].hand.length,1);assert.equal(target.attackBuff,1);assert.match(getBattleCard(spell,20095).description,/抽1张牌/);
const star=playing(418);star.players[0].deck=[];health=findGeneral(star,0).health;const enemyCount=star.players[1].deck.length;assert.equal(useBattleCommand(star,null),true);assert.equal(findGeneral(star,0).health,health-1);assert.equal(star.players[1].deck.length,Math.max(0,enemyCount-1));
const dyingStar=playing(418);dyingStar.players[0].deck=[];findGeneral(dyingStar,0).health=1;const unchangedEnemy=clone(dyingStar.players[1]);assert.equal(useBattleCommand(dyingStar,null),true);assert.equal(dyingStar.phase,'over');assert.deepEqual(dyingStar.players[1],unchangedEnemy);assert.equal(validateMatch(dyingStar),true);
const resumeOpening=restoreMatch(clone(fresh()));assert.equal(confirmMulligan(resumeOpening),true);assert.equal(validateMatch(resumeOpening),true);endTurn(resumeOpening);const resumeEnemy=restoreMatch(clone(resumeOpening));assert.equal(resumeEnemy.currentPlayer,1);assert.equal(endTurn(resumeEnemy,1),true);assert.equal(validateMatch(resumeEnemy),true);assert.equal(restoreMatch(clone(resumeEnemy)).round,2);
// Each side draws at the start of its own turn.
const timing=playing();let pCount=timing.players[0].deck.length,eCount=timing.players[1].deck.length;endTurn(timing);assert.equal(timing.players[0].deck.length,pCount);assert.equal(timing.players[1].deck.length,Math.max(0,eCount-1));endTurn(timing,1);assert.equal(timing.players[0].deck.length,pCount-1);assert.equal(timing.players[1].deck.length,Math.max(0,eCount-1));assert.equal(timing.players[0].replacesUsed,0);
for(const mutate of [s=>delete s.deckRules,s=>delete s.players[0].replacesUsed,s=>s.players[0].replacesUsed=2,s=>delete s.players[0].fatigueCount,s=>s.players[0].fatigueCount=-1,s=>delete s.playerDeck,s=>s.schemaVersion=BATTLE_SCHEMA+1,s=>s.mulligan=[0,0]]){const invalid=clone(fresh());mutate(invalid);assert.equal(validateMatch(invalid),false,String(mutate));assert.equal(restoreMatch(invalid),null);}
// Saved-battle invariants that a806feb's validDrawBattle enforced: deckRules must equal the
// rules derived from the frozen plan, playerDeck must be a legal 30-card deck, and hand+deck
// may not hold more copies than the original deck. Collected so the remaining checks still run.
const invariantFailures=[];
for(const mutate of [s=>s.deckRules[0].handLimit=7,s=>s.deckRules[0].replacePerTurn=5,s=>s.deckRules[1].drawPerTurn=5,s=>s.playerDeck.pop(),s=>s.players[0].deck.push(9,9,9)]){const invalid=clone(fresh());mutate(invalid);if(validateMatch(invalid)!==false||restoreMatch(invalid)!==null)invariantFailures.push(String(mutate));}
// Freeze an asymmetric enemy configuration independently of later edits.
const override=clone(getEnemyPlan('border-01'));override.players[1]={...override.players[1],deck:[20081,20081,20081,20081,14,14],openingHandSize:4,drawPerTurn:2,handLimit:8,fatigueDamage:2,replacePerTurn:0,shuffleDeck:false,unitStats:{14:override.players[1].unitStats[14]}};
const asymmetric=fresh(1,'border-01',{enemyPlanOverride:override});override.players[1].deck=[];assert.equal(asymmetric.players[1].hand.length,4);assert.equal(asymmetric.players[1].deck.length,2);assert.equal(asymmetric.deckRules[1].drawPerTurn,2);assert.equal(validateMatch(asymmetric),true);assert.deepEqual(restoreMatch(clone(asymmetric)).enemyPlan,asymmetric.enemyPlan);
const frozenEncounter=clone(playing()), liveLevel=EXPEDITION_LEVELS.find(level=>level.id===frozenEncounter.levelId), originalEnemies=[...liveLevel.enemies];
try {
  liveLevel.enemies.push({cardId:101,owner:2,x:8,y:4});
  assert.equal(validateMatch(frozenEncounter),true,'updated encounter owners cannot alter an existing battle');
  const continued=restoreMatch(clone(frozenEncounter));assert.ok(continued);endTurn(continued);assert.equal(validateMatch(continued),true);
  const savedAgain=restoreMatch(clone(continued));assert.ok(savedAgain);assert.equal(savedAgain.players.length,2);assert.deepEqual(savedAgain.enemyPlan,frozenEncounter.enemyPlan);
} finally { liveLevel.enemies.splice(0,liveLevel.enemies.length,...originalEnemies); }
const threePlan=clone(getEnemyPlan('banners-01'));threePlan.players[1].drawPerTurn=3;
const three=fresh(1,'banners-01',{enemyPlanOverride:threePlan});confirmMulligan(three);three.players[1].deck=[];findGeneral(three,1).health=1;
const fatigueLogs=three.log.filter(line=>line.includes('抽空牌库')).length;endTurn(three);
assert.equal(three.log.filter(line=>line.includes('抽空牌库')).length,fatigueLogs+1,'eliminated army stops its remaining draw attempts');
assert.equal(findGeneral(three,1),null);assert.equal(three.currentPlayer,2);assert.equal(three.phase,'ai');assert.equal(validateMatch(three),true);
const deadArmy=JSON.stringify(three);assert.equal(drawCard(three,1),null);assert.equal(JSON.stringify(three),deadArmy);
for(const mutate of [p=>p.players[1].openingHandSize=p.players[1].deck.length+1,p=>delete p.players[1],p=>p.players[1].deck[0]=1,p=>p.players[1].mana=p.players[1].manaCap+1,p=>delete p.players[1].fatigueDamage,p=>delete p.players[1].shuffleDeck]) {
  const invalid=clone(getEnemyPlan('border-01'));mutate(invalid);
  assert.throws(()=>fresh(1,'border-01',{enemyPlanOverride:invalid}),/敌军配置无效/);
}
// The draw belongs to the new turn: a completed survival goal wins before it,
// while a lethal turn-start draw is not overwritten by later survival/turn-limit checks.
const survived=playing();survived.objective={type:'survive',rounds:1};survived.players[0].deck=[];findGeneral(survived,0).health=1;survived.currentPlayer=1;survived.phase='ai';
endTurn(survived,1);assert.equal(survived.result,'win');assert.equal(survived.resultReason,'survived');assert.equal(findGeneral(survived,0).health,1);assert.equal(survived.players[0].fatigueCount,0);
const failedSurvival=playing();failedSurvival.objective={type:'survive',rounds:2};failedSurvival.players[0].deck=[];findGeneral(failedSurvival,0).health=1;failedSurvival.currentPlayer=1;failedSurvival.phase='ai';
endTurn(failedSurvival,1);assert.equal(failedSurvival.result,'loss');assert.equal(failedSurvival.resultReason,'general-defeated');assert.equal(validateMatch(failedSurvival),true);
for(const objective of [{type:'survive',rounds:1},{type:'eliminate'}]) {
  const finalEnemy=playing();finalEnemy.objective=objective;finalEnemy.turnLimit=1;finalEnemy.players[1].deck=[];findGeneral(finalEnemy,1).health=1;
  endTurn(finalEnemy);assert.equal(finalEnemy.result,'win');assert.equal(finalEnemy.resultReason,'enemies-eliminated');assert.equal(finalEnemy.currentPlayer,1);assert.equal(validateMatch(finalEnemy),true);
}
let sims=0;
for(const level of EXPEDITION_LEVELS){const state=fresh(1,level.id);let guard=0;while(state.phase!=='over'&&guard++<1500){assert.equal(autoAct(state),true,`${level.id} action ${guard}`);assert.equal(validateMatch(state),true,`${level.id} snapshot ${guard}`);}assert.equal(state.phase,'over',`${level.id} bounded completion`);assert.deepEqual(clone(restoreMatch(clone(state))),clone({...state,selectedUnitId:null}));sims++;}
if(invariantFailures.length){console.error(`FAIL: validateMatch accepts ${invariantFailures.length} invariant-breaking saves:\n  ${invariantFailures.join('\n  ')}`);process.exitCode=1;}
else console.log(`draw battle passed: opening/replace, burn, progressive fatigue, extra draws, terminal stop, frozen asymmetric rules and ${sims} complete simulations.`);
