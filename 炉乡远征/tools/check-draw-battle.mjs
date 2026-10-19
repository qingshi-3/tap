import { PRE_EXPANSION_LEVEL_IDS } from '../dist/js/campaign-content.js';
import assert from 'node:assert/strict';
import {createExpeditionMatch,validateMatch,restoreMatch,confirmMulligan,toggleMulligan,drawCard,replaceHandCard,canReplaceHandCard,autoAct,endTurn,findGeneral,playCard,summonPositions,castSpell,useBattleCommand,getBattleCard} from '../dist/js/engine.js';
import {STARTER_FACTION_UNITS} from '../dist/js/battle-deck.js';
const makeStarterDeck=heroId=>{const faction=getFaction(getHero(heroId).faction);return [...STARTER_FACTION_UNITS[faction.id],10021,10981,10019,19027,...faction.spellIds.slice(0,2)].flatMap(id=>[id,id,id]);};
import {getHero,getFaction,FACTIONS} from '../dist/js/factions.js';
import {getEnemyPlan} from '../dist/js/enemy-plans.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
const clone=value=>JSON.parse(JSON.stringify(value));
const loadout=heroId=>({deck:makeStarterDeck(heroId),spells:getFaction(getHero(heroId).faction).spellIds.slice(0,2),spellTraining:{},spellModes:{},specializations:{}});
const fresh=(heroId=1,level='border-01',options={})=>createExpeditionMatch(level,{},null,heroId,loadout(heroId),options);
const playing=hero=>{const state=fresh(hero);assert.equal(confirmMulligan(state),true);return state;};
function arrangeHand(state,ids){const all=[...state.loadout.deck];for(const id of ids){const i=all.indexOf(id);assert.ok(i>=0);all.splice(i,1);}state.players[0].hand=[...ids];state.players[0].deck=all;}
for(const faction of FACTIONS){const state=fresh(faction.heroIds[0]);assert.equal(state.schemaVersion,6);assert.equal(validateMatch(state),true);assert.equal(state.phase,'mulligan');assert.equal(state.players[0].hand.length,5);assert.equal(state.players[0].deck.length,25);assert.equal(state.units.filter(u=>u.owner===0).length,1);assert.equal(state.campaignSupply,undefined);assert.deepEqual(restoreMatch(clone(state)),{...state,selectedUnitId:null});}
const mulligan=fresh();arrangeHand(mulligan,[14,14,14,9,9]);
assert.equal(toggleMulligan(mulligan,0),true);toggleMulligan(mulligan,1);toggleMulligan(mulligan,2);assert.deepEqual(mulligan.mulligan,[0,1]);
assert.equal(confirmMulligan(mulligan),true);assert.ok(mulligan.players[0].hand[0]!==14&&mulligan.players[0].hand[1]!==14);assert.equal(mulligan.players[0].deck.filter(id=>id===14).length,2);assert.equal(mulligan.players[0].deck.length,25);assert.equal(mulligan.round,1);assert.equal(mulligan.players[0].mana,EXPEDITION_LEVELS[0].mana);assert.equal(validateMatch(mulligan),true);
const replacing=playing();arrangeHand(replacing,[14]);const beforeMana=replacing.players[0].mana,beforeTriggers=clone(replacing.players[0].turnTriggers);assert.equal(canReplaceHandCard(replacing,0),true);assert.equal(replaceHandCard(replacing,0),true);assert.notEqual(replacing.players[0].hand[0],14);assert.equal(replacing.players[0].deck.length,29);assert.equal(replacing.players[0].mana,beforeMana);assert.deepEqual(replacing.players[0].turnTriggers,beforeTriggers);assert.equal(replacing.players[0].replacesUsed,1);assert.equal(canReplaceHandCard(replacing,0),false);assert.equal(restoreMatch(clone(replacing)).players[0].replacesUsed,1);const immutable=JSON.stringify(replacing);assert.equal(replaceHandCard(replacing,0),false);assert.equal(JSON.stringify(replacing),immutable);
const same=playing();same.players[0].hand=[14];same.players[0].deck=[14];assert.equal(replaceHandCard(same,0),true);assert.deepEqual(same.players[0].hand,[14]);assert.deepEqual(same.players[0].deck,[14]);same.players[0].replacesUsed=0;same.players[0].deck=[];assert.equal(canReplaceHandCard(same,0),false);
const full=playing();arrangeHand(full,[14,14,14,9,9,9]);const fullHand=[...full.players[0].hand],count=full.players[0].deck.length;assert.equal(drawCard(full,0),null);assert.deepEqual(full.players[0].hand,fullHand);assert.equal(full.players[0].deck.length,count-1);assert.equal(validateMatch(full),true);
const fatigue=playing();fatigue.players[0].deck=[];let general=findGeneral(fatigue,0),health=general.health;drawCard(fatigue,0);assert.equal(general.health,health-2);drawCard(fatigue,0);assert.equal(general.health,health-4);assert.equal(validateMatch(fatigue),true);const resumed=restoreMatch(clone(fatigue));drawCard(resumed,0);assert.equal(findGeneral(resumed,0).health,health-6);
// Fatigue bypasses a nearby bodyguard without spending its once-per-turn trigger.
const guarded=createExpeditionMatch('border-01',{11:4},null,1,{...loadout(1),specializations:{11:'bodyguard'}});confirmMulligan(guarded);arrangeHand(guarded,[11]);guarded.players[0].mana=9;let cell=summonPositions(guarded,0,11)[0];assert.equal(playCard(guarded,0,cell.x,cell.y),true);const guard=guarded.units.at(-1);general=findGeneral(guarded,0);guard.x=general.x+1;guard.y=general.y;guarded.players[0].deck=[];health=general.health;drawCard(guarded,0);assert.equal(general.health,health-2);assert.equal(guard.bodyguardUsed,false);
// Drawing the last real card is safe; only the next attempt hurts.
const last=playing();last.players[0].hand=[];last.players[0].deck=[14];health=findGeneral(last,0).health;assert.equal(drawCard(last,0),14);assert.equal(findGeneral(last,0).health,health);drawCard(last,0);assert.equal(findGeneral(last,0).health,health-2);
const lethal=playing();lethal.players[0].deck=[];findGeneral(lethal,0).health=2;assert.equal(endTurn(lethal),true);assert.equal(lethal.phase,'over');assert.equal(lethal.result,'loss');assert.equal(lethal.currentPlayer,0);const ended=JSON.stringify(lethal);assert.equal(drawCard(lethal,1),null);assert.equal(JSON.stringify(lethal),ended);assert.equal(validateMatch(lethal),true);
// First Wish removes itself, applies the buff, and draws from the real pile.
const spell=playing(201);arrangeHand(spell,[213,20095]);spell.players[0].mana=9;cell=summonPositions(spell,0,213)[0];playCard(spell,0,cell.x,cell.y);const target=spell.units.find(u=>u.owner===0&&u.cardId===213),drawBefore=spell.players[0].deck.length;assert.equal(castSpell(spell,0,target.unitId),true);assert.equal(spell.players[0].deck.length,drawBefore-1);assert.equal(spell.players[0].hand.length,1);assert.equal(target.attackBuff,1);assert.match(getBattleCard(spell,20095).description,/抽1张牌/);
const star=playing(418);star.players[0].deck=[];health=findGeneral(star,0).health;const enemyCount=star.players[1].deck.length;assert.equal(useBattleCommand(star,null),true);assert.equal(findGeneral(star,0).health,health-2);assert.equal(star.players[1].deck.length,Math.max(0,enemyCount-1));
const dyingStar=playing(418);dyingStar.players[0].deck=[];findGeneral(dyingStar,0).health=2;const unchangedEnemy=clone(dyingStar.players[1]);assert.equal(useBattleCommand(dyingStar,null),true);assert.equal(dyingStar.phase,'over');assert.deepEqual(dyingStar.players[1],unchangedEnemy);assert.equal(validateMatch(dyingStar),true);
const resumeOpening=restoreMatch(clone(fresh()));assert.equal(confirmMulligan(resumeOpening),true);assert.equal(validateMatch(resumeOpening),true);endTurn(resumeOpening);const resumeEnemy=restoreMatch(clone(resumeOpening));assert.equal(resumeEnemy.currentPlayer,1);assert.equal(endTurn(resumeEnemy,1),true);assert.equal(validateMatch(resumeEnemy),true);assert.equal(restoreMatch(clone(resumeEnemy)).round,2);
const timing=playing();let pCount=timing.players[0].deck.length,eCount=timing.players[1].deck.length;endTurn(timing);assert.equal(timing.players[0].deck.length,pCount-1);assert.equal(timing.players[1].deck.length,eCount);endTurn(timing,1);assert.equal(timing.players[0].deck.length,pCount-1);assert.equal(timing.players[1].deck.length,Math.max(0,eCount-1));assert.equal(timing.players[0].replacesUsed,0);
for(const mutate of [s=>delete s.deckRules,s=>delete s.players[0].replacesUsed,s=>s.players[0].replacesUsed=2,s=>delete s.deckRules[0].fatigueDamage,s=>s.deckRules[0].handLimit=7,s=>s.loadout.deck.pop(),s=>delete s.battleCards[0][315],s=>s.schemaVersion=7,s=>s.campaignSupply={},s=>s.mulligan=[0,0]]){const invalid=clone(fresh());mutate(invalid);assert.equal(validateMatch(invalid),false);assert.equal(restoreMatch(invalid),null);}
// Freeze an asymmetric enemy configuration independently of later edits.
const override=clone(getEnemyPlan('border-01',2));override.players[1]={...override.players[1],deck:[20081,20081,20081,20081,14,14],openingHandSize:4,drawPerTurn:2,handLimit:8,fatigueDamage:2,replacePerTurn:0,shuffleDeck:false};
const asymmetric=fresh(1,'border-01',{enemyPlanOverride:override});override.players[1].deck=[];assert.equal(asymmetric.players[1].hand.length,4);assert.equal(asymmetric.players[1].deck.length,2);assert.equal(asymmetric.deckRules[1].drawPerTurn,2);assert.equal(validateMatch(asymmetric),true);assert.deepEqual(restoreMatch(clone(asymmetric)).enemyPlan,asymmetric.enemyPlan);
const frozenEncounter=clone(playing()), liveLevel=EXPEDITION_LEVELS.find(level=>level.id===frozenEncounter.levelId), originalEnemies=[...liveLevel.enemies];
try {
  liveLevel.enemies.push({cardId:101,owner:2,x:8,y:4});
  assert.equal(validateMatch(frozenEncounter),true,'updated encounter owners cannot alter an existing battle');
  const continued=restoreMatch(clone(frozenEncounter));assert.ok(continued);endTurn(continued);assert.equal(validateMatch(continued),true);
  const savedAgain=restoreMatch(clone(continued));assert.ok(savedAgain);assert.equal(savedAgain.players.length,2);assert.deepEqual(savedAgain.enemyPlan,frozenEncounter.enemyPlan);
} finally { liveLevel.enemies.splice(0,liveLevel.enemies.length,...originalEnemies); }
const threePlan=clone(getEnemyPlan('banners-01',2));threePlan.players[1].drawPerTurn=3;
const three=fresh(1,'banners-01',{enemyPlanOverride:threePlan});confirmMulligan(three);three.currentPlayer=1;three.phase='ai';three.players[1].deck=[];findGeneral(three,1).health=2;
const fatigueLogs=three.log.filter(line=>line.includes('抽空牌库')).length;endTurn(three,1);
assert.equal(three.log.filter(line=>line.includes('抽空牌库')).length,fatigueLogs+1,'eliminated army stops its remaining draw attempts');
assert.equal(findGeneral(three,1),null);assert.equal(three.currentPlayer,2);assert.equal(three.phase,'ai');assert.equal(validateMatch(three),true);
const deadArmy=JSON.stringify(three);assert.equal(drawCard(three,1),null);assert.equal(JSON.stringify(three),deadArmy);
for(const mutate of [p=>p.players[1].openingHandSize=p.players[1].deck.length+1,p=>delete p.players[1],p=>p.players[1].deck[0]=1,p=>p.players[1].mana=p.players[1].manaCap+1,p=>delete p.players[1].fatigueDamage,p=>delete p.players[1].shuffleDeck]) {
  const invalid=clone(getEnemyPlan('border-01',2));mutate(invalid);
  assert.throws(()=>fresh(1,'border-01',{enemyPlanOverride:invalid}),/敌军抽牌配置无效/);
}
// Fatigue belongs to the completed turn and its terminal result must not be
// overwritten by the subsequent survival or turn-limit checks.
const failedSurvival=playing();failedSurvival.objective={type:'survive',rounds:1};failedSurvival.players[0].deck=[];findGeneral(failedSurvival,0).health=2;
endTurn(failedSurvival);assert.equal(failedSurvival.result,'loss');assert.equal(failedSurvival.resultReason,'general-defeated');
for(const objective of [{type:'survive',rounds:1},{type:'eliminate'}]) {
  const finalEnemy=playing();finalEnemy.objective=objective;finalEnemy.turnLimit=1;finalEnemy.currentPlayer=1;finalEnemy.phase='ai';finalEnemy.players[1].deck=[];findGeneral(finalEnemy,1).health=2;
  endTurn(finalEnemy,1);assert.equal(finalEnemy.result,'win');assert.equal(finalEnemy.resultReason,'enemies-eliminated');assert.equal(finalEnemy.currentPlayer,1);assert.equal(validateMatch(finalEnemy),true);
}
for(const level of EXPEDITION_LEVELS.filter(level=>PRE_EXPANSION_LEVEL_IDS.includes(level.id))){const state=fresh(1,level.id);let guard=0;while(state.phase!=='over'&&guard++<1200){assert.equal(autoAct(state),true,`${level.id} action ${guard}`);assert.equal(validateMatch(state),true,`${level.id} snapshot ${guard}`);}assert.equal(state.phase,'over',`${level.id} bounded completion`);assert.deepEqual(restoreMatch(clone(state)),{...state,selectedUnitId:null});}
const old=createExpeditionMatch('border-01');assert.equal(old.schemaVersion,4);assert.equal(validateMatch(old),true);const oldLoadout=loadout(1);delete oldLoadout.deck;const supply=createExpeditionMatch('border-01',{},null,1,oldLoadout);assert.equal(supply.schemaVersion,5);assert.deepEqual(supply.campaignSupply.remaining,[1,1,3,3,3]);assert.equal(validateMatch(supply),true);
console.log('schema6 draw battle passed: opening/replace, burn, fixed true fatigue, extra draws, terminal stop, frozen asymmetric rules and 18 complete simulations.');
