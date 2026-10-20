import assert from 'node:assert/strict';
import {CARDS,getCard} from '../dist/js/cards.js';
import {FACTIONS} from '../dist/js/factions.js';
import {CAMPAIGN_UNIT_IDS,SPELL_IDS,NEUTRAL_IDS} from '../dist/js/campaign-rules.js';
import {makeStarterDeck,starterInventory,validatePlayerDeck} from '../dist/js/battle-deck.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
import {getEnemyPlan} from '../dist/js/enemy-plans.js';
import {createCampaignMatch,confirmMulligan,validateMatch,restoreMatch,playCard,summonPositions,castSpell,spellTargets,getSpellFollowup,getOpeningFollowup,attackUnit,endTurn,autoAct,findGeneral,dispelCell,effectiveAttack,drawCard,movementPositions,attackPositions} from '../dist/js/engine.js';
const clone=x=>JSON.parse(JSON.stringify(x));
function fresh({hero=1,extra=[],level='border-01'}={}) {
 const deck=makeStarterDeck(hero);for(const id of extra){if(deck.includes(id))continue;const replace=deck.findIndex(existing=>!extra.includes(existing));deck.splice(replace,1,id);}
 const state=createCampaignMatch(level,hero,deck);
 assert.equal(validateMatch(state),true);confirmMulligan(state);return state;
}
function hand(state,ids){const deck=[...state.playerDeck];for(const id of ids){const index=deck.indexOf(id);assert.ok(index>=0,`deck contains ${id}`);deck.splice(index,1);}state.players[0].hand=[...ids];state.players[0].deck=deck;state.players[0].mana=9;}
function spawn(state,id,cell=null){hand(state,[id]);const pos=cell??summonPositions(state,0,id)[0];assert.equal(playCard(state,0,pos.x,pos.y),true,`deploy ${id}`);return state.units.find(u=>u.owner===0&&u.cardId===id&&u.x===pos.x&&u.y===pos.y);}
function enemy(state,id,x,y,{attack=0,health=10}={}){const template=state.units.find(u=>u.owner===1&&CARDS[u.cardId].type==='unit');const u={...clone(template),unitId:Math.max(...state.units.map(u=>u.unitId))+1000,cardId:id,owner:1,x,y,attack,maxHealth:health,health,attackBuff:0,healthBuff:0,moved:false,attacked:false,summonedThisTurn:false,token:!!CARDS[id].token,reborn:false,silenced:false};state.units.push(u);return u;}
assert.equal(CAMPAIGN_UNIT_IDS.length,120);assert.equal(SPELL_IDS.length,48);assert.equal(NEUTRAL_IDS.length,40);assert.equal(Object.keys(CARDS).length,193);
for(const faction of FACTIONS){const inventory=starterInventory(),available=[...inventory.units,...inventory.spells].filter(id=>CARDS[id].faction===0||CARDS[id].faction===faction.id);assert.ok(available.length>=14);assert.equal(validatePlayerDeck(makeStarterDeck(faction.heroIds[0]),faction.heroIds[0],inventory),true);assert.equal(makeStarterDeck(faction.heroIds[0]).length,30);}
// Mist Dragon Seal validates both targets atomically.
{const rank=0;const s=fresh({hero:101,extra:[20168]}),u=spawn(s,110);u.moved=true;u.attacked=true;hand(s,[20168]);const before=u.attackBuff,cap=u.maxHealth+u.healthBuff;
 const saved=JSON.stringify(s);assert.equal(castSpell(s,0,{unitId:u.unitId,cell:{x:7,y:2}}),false);assert.equal(JSON.stringify(s),saved);
 assert.equal(castSpell(s,0,{unitId:u.unitId,cell:{x:3,y:0}}),true);assert.equal(u.attackBuff,before+1+rank);assert.equal(u.maxHealth+u.healthBuff,cap+1+rank);assert.equal(u.x,3);assert.equal(u.moved,true);assert.equal(u.attacked,true);assert.equal(validateMatch(s),true);
}
// Swaps cannot target the same entity, a general, or a missing entity.
const swap=fresh({hero:101,extra:[20129]}),swapper=spawn(swap,110),swapTarget=enemy(swap,14,4,0);hand(swap,[20129]);const swapBefore=JSON.stringify(swap);
for(const ids of [[swapper.unitId,swapper.unitId],[swapper.unitId,findGeneral(swap,1).unitId],[swapper.unitId,99999]]){assert.equal(castSpell(swap,0,{unitIds:ids}),false);assert.equal(JSON.stringify(swap),swapBefore);}
const oldPos={x:swapper.x,y:swapper.y};assert.equal(castSpell(swap,0,{unitIds:[swapper.unitId,swapTarget.unitId]}),true);assert.equal(swapper.x,4);assert.deepEqual({x:swapTarget.x,y:swapTarget.y},oldPos);assert.equal(validateMatch(swap),true);
// Single-cell dispel clears battlefield buffs/keywords and creep, preserves
// printed stats, and removes a producer's aura from its recipients.
const silence=fresh({extra:[10020]}),printed=spawn(silence,14),baseAtk=printed.attack,baseCap=printed.maxHealth;printed.attackBuff+=4;printed.healthBuff+=5;printed.health+=5;silence.creepCells[`${printed.x},${printed.y}`]=1;
dispelCell(silence,printed.x,printed.y);assert.equal(printed.attack,baseAtk);assert.equal(printed.maxHealth,baseCap);assert.equal(printed.attackBuff,0);assert.equal(printed.healthBuff,0);assert.equal(silence.creepCells[`${printed.x},${printed.y}`],undefined);assert.equal(printed.silenced,true);assert.equal(validateMatch(silence),true);
const shroud=spawn(silence,10020);assert.equal(shroud.silenced,false);assert.ok(getOpeningFollowup(silence,10020,{x:2,y:1}).cells.length>0);
const opening=fresh({extra:[10020]}),openingVictim=enemy(opening,11,2,1);openingVictim.attackBuff=8;hand(opening,[10020]);const beforeOpening=JSON.stringify(opening);assert.equal(playCard(opening,0,1,1,0,{x:8,y:4}),false);assert.equal(JSON.stringify(opening),beforeOpening);assert.equal(playCard(opening,0,1,1,0,{x:2,y:1}),true);assert.equal(openingVictim.silenced,true);assert.equal(openingVictim.attackBuff,0);assert.equal(validateMatch(opening),true);assert.ok(restoreMatch(clone(opening)));
const aura=fresh({hero:201,extra:[215]}),tower=spawn(aura,215);endTurn(aura);endTurn(aura,1);const dervish=aura.units.find(u=>u.owner===0&&u.cardId===217);assert.ok(dervish);const boosted=effectiveAttack(aura,dervish);dispelCell(aura,tower.x,tower.y);assert.equal(effectiveAttack(aura,dervish),boosted-1);assert.equal(validateMatch(aura),true);
const guard=fresh({hero:201,extra:[20073]}),victim=enemy(guard,11,2,2);victim.attackBuff=7;hand(guard,[20073]);assert.equal(castSpell(guard,0,victim.unitId),true);assert.equal(victim.attackBuff,0);assert.equal(victim.silenced,true);
// Kill resolves death, not damage reduction; transformation has neither death
// nor opening effects, and discards every original ability and modifier.
const kill=fresh({hero:201,extra:[20077]}),killed=enemy(kill,412,2,2,{health:50});hand(kill,[20077]);assert.equal(castSpell(kill,0,killed.unitId),true);assert.ok(kill.units.some(u=>u.cardId===411&&u.owner===1));
const transform=fresh({hero:501,extra:[20144]}),wolf=enemy(transform,412,4,0);wolf.moved=true;wolf.attacked=true;wolf.attackBuff=10;hand(transform,[20144]);assert.equal(castSpell(transform,0,wolf.unitId),true);assert.equal(wolf.cardId,520);assert.equal(wolf.attack,3);assert.equal(wolf.health,3);assert.equal(wolf.attackBuff,0);assert.equal(wolf.moved,true);assert.equal(wolf.attacked,true);assert.equal(transform.units.some(u=>u.cardId===411),false);assert.equal(validateMatch(transform),true);
const dark=fresh({hero:301,extra:[20061]}),darkTarget=enemy(dark,14,4,0);hand(dark,[20061]);assert.equal(castSpell(dark,0,darkTarget.unitId),true);assert.ok(dark.units.some(u=>u.cardId===315&&u.owner===0&&u.x===4&&u.y===0));
const natural=fresh({hero:401,extra:[20125]});const weak=enemy(natural,14,4,0,{attack:1}),strong=enemy(natural,14,5,0,{attack:4});hand(natural,[20125]);assert.ok(spellTargets(natural,getCard(20125)).some(u=>u.unitId===weak.unitId));assert.equal(castSpell(natural,0,strong.unitId),false);assert.equal(castSpell(natural,0,weak.unitId),true);
{const rank=0;const s=fresh({hero:401,extra:[20122]});const edge=enemy(s,14,4,0,{attack:3+rank}),safe=enemy(s,14,5,0,{attack:4+rank});hand(s,[20122]);assert.equal(castSpell(s,0,null),true);assert.equal(s.units.includes(edge),false);assert.equal(s.units.includes(safe),true);assert.equal(validateMatch(s),true);}
for(const [id,hero] of [[20049,301],[20134,501]]){const rank=0;const s=fresh({hero,extra:[id]}),t=enemy(s,14,4,0);hand(s,[id]);const health=t.health;assert.equal(castSpell(s,0,id===20049?{unitId:t.unitId,cell:{x:3,y:0}}:{x:t.x,y:t.y}),true);assert.equal(t.health,health-1-rank);if(id===20049)assert.equal(t.x,3);if(id===20134)assert.equal(t.silenced,true);assert.equal(validateMatch(s),true);}
// New neutral draw, death, directional damage, nearby friendly damage, frenzy.
const hound=fresh({extra:[10013]});const counts=hound.players.map(p=>p.deck.length);spawn(hound,10013);assert.equal(hound.players[1].deck.length,counts[1]-1);
const dying=fresh({hero:201,extra:[10982,20077]});const drawBody=spawn(dying,10982);const pile=dying.players[0].deck.length;enemy(dying,14,drawBody.x+1,drawBody.y,{attack:20});drawBody.summonedThisTurn=false;drawBody.attacked=false;const attacker=dying.units.at(-1);attackUnit(dying,drawBody.unitId,attacker.unitId);assert.equal(dying.units.includes(drawBody),false);assert.equal(dying.players[0].deck.length,pile-1);
const naga=fresh({extra:[19042]});const close=enemy(naga,14,2,1),own=findGeneral(naga,0),ownBefore=own.health;spawn(naga,19042,{x:1,y:1});assert.equal(close.health,8);assert.equal(own.health,ownBefore-2);
const blades=fresh({extra:[10959]});const front=enemy(blades,14,2,1);spawn(blades,10959,{x:1,y:1});assert.equal(front.health,7);
const drawAttack=fresh({extra:[19049]}),traveler=spawn(drawAttack,19049),opponent=enemy(drawAttack,14,traveler.x+1,traveler.y);traveler.summonedThisTurn=false;traveler.attacked=false;const remaining=drawAttack.players[0].deck.length;assert.equal(attackUnit(drawAttack,traveler.unitId,opponent.unitId),true);assert.equal(drawAttack.players[0].deck.length,remaining-1);
function checkFrenzyRetaliation(frenzy,expectedCounters){const serpent=spawn(frenzy,10307),one=enemy(frenzy,11,serpent.x+1,serpent.y,{attack:1,health:20}),two=enemy(frenzy,14,serpent.x,serpent.y+1,{attack:1,health:20});serpent.summonedThisTurn=false;serpent.attacked=false;const hp=serpent.health;assert.ok(attackUnit(frenzy,serpent.unitId,one.unitId));assert.equal(one.health,13);assert.equal(two.health,13);assert.equal(serpent.health,hp-expectedCounters);assert.equal(validateMatch(frenzy),true);assert.ok(restoreMatch(clone(frenzy)));}
checkFrenzyRetaliation(fresh({extra:[10307]}),1);
// Entire planned encounter snapshots are valid; selected functional slices
// terminate under the actual AI. Losses here are not balance conclusions.
for(const level of EXPEDITION_LEVELS){const plan=getEnemyPlan(level.id),s=fresh({level:level.id});for(const owner of Object.keys(plan.players)){for(const [id,stats] of Object.entries(plan.players[owner].unitStats))for(const key of ['attack','health','cost'])assert.equal(s.battleCards[owner][id][key],stats[key]);for(const g of plan.players[owner].garrison){const actual=s.units.find(u=>u.owner===Number(owner)&&u.cardId===g.id&&u.x===g.x&&u.y===g.y);assert.ok(actual);assert.equal(actual.attack,g.attack);assert.equal(actual.maxHealth,g.health);}}assert.ok(restoreMatch(clone(s)));}
for(const id of [10001,10018,19026,10204,10017,10978,19033,19034,10207]){const s=fresh({extra:[id]}),u=spawn(s,id);u.summonedThisTurn=false;u.moved=false;u.attacked=false;assert.equal(u.attack,CARDS[id].attack);assert.equal(u.maxHealth,CARDS[id].health);if(CARDS[id].flying)assert.ok(movementPositions(s,u).some(p=>p.x===8&&p.y===0));if(CARDS[id].ranged){const target=enemy(s,14,u.x+CARDS[id].attackRange,u.y);assert.ok(attackPositions(s,u).some(p=>p.unitId===target.unitId));target.x++;assert.ok(!attackPositions(s,u).some(p=>p.unitId===target.unitId));}assert.equal(validateMatch(s),true);}
const representative=[];
for(const stage of [1,4,9,13,19,25,30]){const s=fresh({level:EXPEDITION_LEVELS[stage-1].id});let n=0;while(s.phase!=='over'&&n++<1000){assert.equal(autoAct(s),true);assert.equal(validateMatch(s),true,`stage${stage} step${n}`);}assert.equal(s.phase,'over');assert.ok(restoreMatch(clone(s)));representative.push({stage,result:s.result,reason:s.resultReason,round:s.round,actions:n,phase:s.phase,playerHP:findGeneral(s,0)?.health??0,missingGeneralExpected:s.resultReason==='general-defeated'});}
// The frozen enemy plan used to be re-validated with every snapshot (a806feb validDrawBattle -> validateEnemyPlan); collected so the run finishes.
const invariantFailures=[];
for(const mutate of [s=>delete s.enemyPlan.players[1].unitStats[14]]){const s=fresh();mutate(s);if(validateMatch(s)!==false||restoreMatch(s)!==null)invariantFailures.push(String(mutate));}
for(const mutate of [s=>delete s.units[0].silenced]){const s=fresh();mutate(s);assert.equal(validateMatch(s),false,String(mutate));assert.equal(restoreMatch(s),null);}
if(invariantFailures.length){console.error(`FAIL: validateMatch accepts a corrupted frozen enemy plan:\n  ${invariantFailures.join('\n  ')}`);process.exitCode=1;}
else console.log(`campaign content passed: 120 units/48 spells, starter decks, real neutral/spell rules, frenzy single retaliation, strict snapshots, all ${EXPEDITION_LEVELS.length} enemy plans and ${representative.length} bounded AI slices.`);
