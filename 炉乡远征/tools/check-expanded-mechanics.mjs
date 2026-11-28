import assert from 'node:assert/strict';
import { CARDS } from '../dist/js/cards.js';
import { attackUnit, castSpell, createExpeditionMatch, effectiveAttack, endTurn, findGeneral, moveUnit, movementPositions, occupiedUnit, playCard, restoreMatch, useBattleCommand, validateMatch } from '../dist/js/engine.js';
const clone = value => JSON.parse(JSON.stringify(value));
function fixture(hero=1) {
 const s=createExpeditionMatch('border-01',{},null,hero);
 s.units=s.units.filter(u=>CARDS[u.cardId].type==='general');
 s.players[0].mana=s.players[0].maxMana=9;
 return s;
}
function summon(s,id,x,y) {
 s.players[0].mana=9;s.players[0].hand=[id];
 assert.equal(playCard(s,0,x,y),true,`${id} legal summon`);
 return occupiedUnit(s,x,y);
}
function spell(s,id,target,owner=0) {
 s.players[owner].mana=9;s.players[owner].hand=[id];
 assert.equal(castSpell(s,0,target,owner),true,`${id} legal spell`);
}
function resumed(s) {assert.equal(validateMatch(s),true);const t=restoreMatch(clone(s));assert.ok(t);return t;}
// Flying crosses occupied/wall squares, but has a legal landing and respects provoke.
{
 let s=fixture(101);const fly=summon(s,111,2,2);fly.summonedThisTurn=false;fly.moved=false;fly.attacked=false;
 s.board.tiles.push({x:3,y:2,type:'wall'});
 assert.equal(moveUnit(s,fly.unitId,6,2),true);
 assert.equal(movementPositions(s,fly).length,0);
 fly.moved=false;assert.equal(moveUnit(s,fly.unitId,3,2),false);
 assert.equal(moveUnit(s,fly.unitId,7,2),false,'occupied general cannot be landed on');
 const foe=findGeneral(s,1);foe.provokeBuff=true;
 assert.equal(movementPositions(s,fly).length,0,'adjacent provoke pins flying unit');delete foe.provokeBuff;
 assert.equal(moveUnit(s,fly.unitId,8,2),true);
 const before=foe.health;assert.equal(attackUnit(s,fly.unitId,foe.unitId),true);
 assert.equal(before-foe.health,7,'2 attack + 4 backstab + first Kaelos bonus');
 s=resumed(s);
}
// Dervish auras stack, add/remove exact stats, retain suffered damage and settle aura deaths.
{
 let s=fixture(201);const healthA=summon(s,216,2,1),healthB=summon(s,216,2,3),attackA=summon(s,215,1,1);
 s.players[0].bbsUsed=false;assert.equal(useBattleCommand(s,{x:0,y:2}),true);
 const d=s.units.find(u=>u.cardId===225);assert.equal(d.auraHealthBuff,2);assert.equal(d.auraAttackBuff,1);
 const max=d.maxHealth+d.healthBuff;
 s=resumed(s);const dd=s.units.find(u=>u.unitId===d.unitId),aa=s.units.find(u=>u.unitId===healthA.unitId);
 // Enemy Phoenix Fire kills the 0/4 source in two casts; the other source remains.
 endTurn(s,0);spell(s,20081,aa.unitId,1);spell(s,20081,aa.unitId,1);
 assert.equal(dd.auraHealthBuff,1);assert.equal(dd.maxHealth+dd.healthBuff,max-1);
 assert.equal(effectiveAttack(s,dd),CARDS[225].attack+1);
 s=resumed(s);
 const bad=clone(s);bad.units.find(u=>u.unitId===dd.unitId).auraHealthBuff=99;assert.equal(validateMatch(bad),false);
}
{
 let s=fixture(223);const aura=summon(s,216,2,1);s.players[0].generalId=201;findGeneral(s,0).cardId=201;
 assert.equal(useBattleCommand(s,{x:0,y:2}),true);const d=s.units.find(u=>u.cardId===225);
 s.players[0].bbsUsed=false;assert.equal(useBattleCommand(s,{x:0,y:3}),true);const second=s.units.find(u=>u.cardId===225&&u.unitId!==d.unitId);
 d.health=1;second.health=1;endTurn(s,0);spell(s,20081,aura.unitId,1);spell(s,20081,aura.unitId,1);
 assert.equal(s.units.some(u=>u.unitId===d.unitId),false,'removing last health aura kills critically wounded dervish');assert.equal(s.units.some(u=>u.unitId===second.unitId),false,'cascade cleans every dead recipient');resumed(s);
}
// Creep stats depend on friendly tile count and preserve damage when ownership changes.
{
 let s=fixture(323);s.creepCells={'3,0':0,'4,0':0,'5,0':1};const jug=summon(s,309,2,2);
 assert.equal(jug.auraAttackBuff,2);assert.equal(jug.auraHealthBuff,2);
 jug.health-=2;s.creepCells['3,0']=1;endTurn(s,0);
 assert.equal(jug.auraAttackBuff,1);assert.equal(jug.health,jug.maxHealth+jug.healthBuff-2);
 s=resumed(s);const restored=s.units.find(u=>u.unitId===jug.unitId);
 s.creepCells['4,0']=1;endTurn(s,1);endTurn(s,0);
 assert.equal(restored.auraHealthBuff,undefined);assert.equal(restored.health,restored.maxHealth+restored.healthBuff-2);resumed(s);
}
// Darkspine multipliers multiply; leaving play removes the source.
{
 let s=fixture(323);const a=summon(s,316,2,1),b=summon(s,316,2,3);const foe=findGeneral(s,1);
 s.creepCells[`${foe.x},${foe.y}`]=0;const hp=foe.health;endTurn(s,0);assert.equal(foe.health,hp-4);
 spell(s,20081,a.unitId,1);spell(s,20081,a.unitId,1);endTurn(s,1);
 const hp2=foe.health;endTurn(s,0);assert.equal(foe.health,hp2-2);resumed(s);
}
// Deathwatch summons after removing the dead unit, only for minion deaths and living watchers.
{
 let s=fixture(323);const priest=summon(s,310,2,2);const victim=summon(s,308,1,1);
 const count=s.units.filter(u=>u.cardId===315).length;endTurn(s,0);spell(s,20081,victim.unitId,1);
 assert.equal(s.units.filter(u=>u.cardId===315).length,count+1);assert.ok(s.units.some(u=>u.cardId===315&&Math.max(Math.abs(u.x-priest.x),Math.abs(u.y-priest.y))<=1));
 spell(s,20081,priest.unitId,1);
 assert.equal(s.units.some(u=>u.unitId===priest.unitId),false);resumed(s);
}
// Grow happens only at the owner's turn start, persists and increases current/max health.
for(const id of [402,404]) {
 let s=fixture(401);const unit=summon(s,id,2,2),g=CARDS[id].grow,before={a:unit.attackBuff,h:unit.health,max:unit.maxHealth+unit.healthBuff};
 endTurn(s,0);assert.equal(unit.attackBuff,before.a);s=resumed(s);const u=s.units.find(v=>v.unitId===unit.unitId);
 endTurn(s,1);assert.equal(u.attackBuff,before.a+g);assert.equal(u.health,before.h+g);assert.equal(u.maxHealth+u.healthBuff,before.max+g);resumed(s);
}
// Four Winds reacts to each allied spell, once per watcher, and heals only actual injury.
{
 let s=fixture(101);summon(s,116,2,1);summon(s,116,2,3);const own=findGeneral(s,0),foe=findGeneral(s,1);own.health-=5;
 const hp=foe.health,ours=own.health;spell(s,20081,foe.unitId);
 assert.equal(foe.health,hp-5);assert.equal(own.health,ours+2,'two actual heals');assert.equal(s.lastAction.statChanges.filter(change=>change.kind==='heal').length,2,'watcher healing is visible in action feedback');
 s=resumed(s);endTurn(s,0);const hp2=findGeneral(s,1).health;spell(s,20117,null,1);assert.equal(findGeneral(s,1).health,Math.min(findGeneral(s,1).maxHealth,hp2+8),'enemy spell does not trigger allied watchers');
}
// Razorback excludes self/general, buffs all other minions, stacks and expires this turn.
{
 let s=fixture(501);const ally=summon(s,505,2,2);const base=ally.attackBuff;const r=summon(s,513,2,1);
 assert.equal(ally.attackBuff,base+2);assert.equal(r.tempAlliedAttackBuff,undefined);assert.equal(findGeneral(s,0).tempAlliedAttackBuff,undefined);
 summon(s,513,2,3);assert.equal(ally.attackBuff,base+4);assert.equal(r.tempAlliedAttackBuff,2);
 s=resumed(s);endTurn(s,0);assert.equal(s.units.find(u=>u.unitId===ally.unitId).attackBuff,base);assert.ok(s.units.every(u=>u.tempAlliedAttackBuff===undefined));resumed(s);
}
// Rebirth produces an egg, hatches on owner's next turn, and can be restored in between.
{
 let s=fixture(401);const reborn=summon(s,413,2,2);endTurn(s,0);spell(s,20081,reborn.unitId,1);spell(s,20081,reborn.unitId,1);
 assert.ok(s.units.some(u=>u.hatchCardId===413));s=resumed(s);endTurn(s,1);assert.ok(s.units.some(u=>u.cardId===413&&u.reborn));resumed(s);
}
console.log('Expanded faction mechanics checks passed: flight/provoke/backstab, dervish health/attack aura cleanup, creep stats/multipliers, deathwatch, grow, Four Winds, Razorback expiry, rebirth, restore/tamper validation.');
