import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
import {getEnemyPlan} from '../dist/js/enemy-plans.js';
import {createExpeditionMatch,confirmMulligan,validateMatch,restoreMatch,drawCard,findGeneral,endTurn,playCard,summonPositions,castSpell,useBattleCommand} from '../dist/js/engine.js';
import {drainBattlePresentation} from '../dist/js/battle-presentation-events.js';
const clone=value=>JSON.parse(JSON.stringify(value));
class Memory {
 constructor(){this.data=new Map();this.failKey=null;}
 getItem(key){return this.data.get(key)??null;}
 setItem(key,value){if(key===this.failKey)throw new Error('Controlled storage failure');this.data.set(key,String(value));}
 removeItem(key){this.data.delete(key);}
}
function fresh({hero=1,level='border-01',extra=[],opening=false}={}) {
 const progress=new ExpeditionProgress(new Memory());assert.ok(progress.selectHero(hero).ok);
 const loadout=progress.getBattleLoadout();
 for(const id of extra){if(loadout.deck.includes(id))continue;const index=loadout.deck.findIndex(card=>!extra.includes(card));assert.ok(index>=0);loadout.deck.splice(index,1,id);}
 const match=createExpeditionMatch(level,progress.state.training,null,hero,loadout);
 assert.equal(match.schemaVersion,7);assert.equal(match.fatigueVersion,1);assert.ok(validateMatch(match));
 for(const p of match.players){assert.equal(p.fatigueCount,0);assert.equal(match.deckRules[p.id].fatigueDamage,1);if(p.id>0)assert.equal(match.enemyPlan.players[p.id].fatigueDamage,1);}
 if(!opening)assert.ok(confirmMulligan(match));return match;
}
function hand(match,ids){match.players[0].hand=[...ids];match.players[0].deck=[];match.players[0].mana=9;}
const report={checks:[],passed:false};
const successive=fresh();successive.players[0].deck=[];
const general=findGeneral(successive,0),initial=general.health;drainBattlePresentation(successive);
for(let i=1;i<=3;i++){drawCard(successive,0);assert.equal(successive.players[0].fatigueCount,i);assert.equal(general.health,initial-i*(i+1)/2);assert.ok(validateMatch(successive));}
assert.deepEqual(drainBattlePresentation(successive).filter(e=>e.kind==='fatigue').map(e=>e.amount),[1,2,3]);
assert.match(successive.log.at(-1),/3点疲劳伤害/);
assert.ok(endTurn(successive));assert.equal(successive.players[0].fatigueCount,3);
assert.ok(endTurn(successive,1));assert.equal(successive.players[0].fatigueCount,4);assert.equal(general.health,initial-10);
report.checks.push('same-turn 1/2/3, exact receipts/log, persists across turns');
const normal=fresh();normal.players[0].hand=[];normal.players[0].deck=[14];const normalHealth=findGeneral(normal,0).health;
assert.equal(drawCard(normal,0),14);assert.equal(normal.players[0].fatigueCount,0);assert.equal(findGeneral(normal,0).health,normalHealth);
normal.players[0].hand=[14,14,14,9,9,9];normal.players[0].deck=[11];assert.equal(drawCard(normal,0),null);assert.equal(normal.players[0].fatigueCount,0);assert.equal(normal.players[0].deck.length,0);
drawCard(normal,0);assert.equal(normal.players[0].fatigueCount,1);assert.equal(findGeneral(normal,0).health,normalHealth-1);assert.ok(validateMatch(normal));
report.checks.push('last real card safe, full-hand burn safe, full-hand empty pile fatigues');
const three=fresh({level:'banners-01'});assert.equal(three.players.length,3);
for(const p of three.players)p.deck=[];
const healths=three.players.map(p=>findGeneral(three,p.id).health);
for(const owner of [0,1,0,2,1,0])drawCard(three,owner);
assert.deepEqual(three.players.map(p=>p.fatigueCount),[3,2,1]);assert.deepEqual(three.players.map(p=>findGeneral(three,p.id).health),healths.map((h,i)=>h-[6,3,1][i]));assert.ok(validateMatch(three));
report.checks.push('three independent armies');
const nested=fresh({hero:418,extra:[10013]});for(const p of nested.players)p.deck=[];hand(nested,[10013]);
const cell=summonPositions(nested,0,10013)[0];drainBattlePresentation(nested);assert.ok(playCard(nested,0,cell.x,cell.y));
assert.deepEqual(nested.players.map(p=>p.fatigueCount),[2,1]);assert.deepEqual(drainBattlePresentation(nested).filter(e=>e.kind==='fatigue'&&e.owner===0).map(e=>e.amount),[1,2]);assert.ok(validateMatch(nested));
report.checks.push('real costly-summon passive plus opening effect, nested draws count independently');
const spell=fresh({hero:201,extra:[213,20095]});hand(spell,[213,20095]);const spawn=summonPositions(spell,0,213)[0];assert.ok(playCard(spell,0,spawn.x,spawn.y));const ally=spell.units.find(u=>u.owner===0&&u.cardId===213);assert.ok(castSpell(spell,0,ally.unitId));assert.equal(spell.players[0].fatigueCount,1);assert.ok(validateMatch(spell));
const command=fresh({hero:418});for(const p of command.players)p.deck=[];assert.ok(useBattleCommand(command,null));assert.deepEqual(command.players.map(p=>p.fatigueCount),[1,1]);assert.ok(validateMatch(command));
report.checks.push('real First Wish spell and Starhorn command');
const lethal=fresh({hero:418});for(const p of lethal.players)p.deck=[];findGeneral(lethal,0).health=1;
const opponent=clone(lethal.players[1]);assert.ok(useBattleCommand(lethal,null));assert.equal(lethal.phase,'over');assert.equal(lethal.result,'loss');assert.deepEqual(lethal.players[1],opponent);assert.equal(lethal.players[0].fatigueCount,1);
const terminal=JSON.stringify(lethal);drawCard(lethal,0);drawCard(lethal,1);assert.equal(JSON.stringify(lethal),terminal);assert.ok(validateMatch(lethal));
const dead=fresh({level:'banners-01'});dead.players[1].deck=[];findGeneral(dead,1).health=1;drawCard(dead,1);assert.equal(findGeneral(dead,1),null);assert.notEqual(dead.phase,'over');const eliminated=JSON.stringify(dead);drawCard(dead,1);assert.equal(JSON.stringify(dead),eliminated);assert.ok(validateMatch(dead));
report.checks.push('lethal stops later effect draws, dead army requests are inert');
// Store the actual opening first so ExpeditionProgress freezes its reward receipt.
const memory=new Memory();let progress=new ExpeditionProgress(memory);
let persisted=createExpeditionMatch('border-01',progress.state.training,null,1,progress.getBattleLoadout());assert.ok(progress.saveBattle(persisted).ok);assert.ok(confirmMulligan(persisted));persisted.players[0].deck=[];
for(let expected=1;expected<=2;expected++){
 drawCard(persisted,0);assert.equal(persisted.players[0].fatigueCount,expected);assert.ok(progress.saveBattle(persisted).ok);
 const saved=clone(persisted);progress=new ExpeditionProgress(memory);assert.equal(progress.error,'');assert.deepEqual(progress.state.activeBattle,saved);persisted=restoreMatch(progress.state.activeBattle);assert.ok(persisted);
}
const bytes=memory.getItem(SAVE_KEYS.expedition),beforeFailure=clone(progress.state);drawCard(persisted,0);assert.equal(persisted.players[0].fatigueCount,3);
memory.failKey=SAVE_KEYS.expedition;assert.equal(progress.saveBattle(persisted).ok,false);assert.equal(memory.getItem(SAVE_KEYS.expedition),bytes);assert.deepEqual(progress.state,beforeFailure);
memory.failKey=null;assert.ok(progress.saveBattle(persisted).ok);progress=new ExpeditionProgress(memory);assert.equal(progress.state.activeBattle.players[0].fatigueCount,3);persisted=restoreMatch(progress.state.activeBattle);drawCard(persisted,0);assert.equal(persisted.players[0].fatigueCount,4);assert.ok(progress.saveBattle(persisted).ok);assert.equal(new ExpeditionProgress(memory).state.activeBattle.players[0].fatigueCount,4);
report.checks.push('real profile save/reload twice, failed save preserves bytes and profile, retry then continue');
for(const mutate of [
 s=>s.fatigueVersion=2,s=>s.fatigueVersion=null,s=>s.fatigueVersion=undefined,
 s=>delete s.players[0].fatigueCount,s=>s.players[0].fatigueCount=-1,s=>s.players[0].fatigueCount=.5,s=>s.players[0].fatigueCount='0',s=>s.players[0].fatigueCount=Number.MAX_SAFE_INTEGER,
 s=>s.players[0].fatigueCount=Number.MAX_SAFE_INTEGER+1,s=>s.players[1].fatigueCount=NaN,
 s=>delete s.fatigueVersion,s=>s.deckRules[0].fatigueDamage=2,s=>s.deckRules[1].fatigueDamage=2,s=>s.enemyPlan.players[1].fatigueDamage=2,
 s=>s.schemaVersion=6,s=>s.mode='challenge',
]){const invalid=clone(successive);mutate(invalid);assert.equal(validateMatch(invalid),false);assert.equal(restoreMatch(invalid),null);}
const badOpening=fresh({opening:true});badOpening.players[1].fatigueCount=1;assert.equal(validateMatch(badOpening),false);
const boundary=fresh();boundary.players[0].deck=[];boundary.players[0].fatigueCount=Number.MAX_SAFE_INTEGER-1;assert.ok(validateMatch(boundary));const beforeBoundary=JSON.stringify(boundary);assert.throws(()=>drawCard(boundary,0),RangeError);assert.equal(JSON.stringify(boundary),beforeBoundary);
report.checks.push('unknown/unsupported/missing/invalid/overflow counters and inconsistent frozen rules rejected, overflow attempt inert');
function findSnapshot(value,schema){if(value&&typeof value==='object'){if(value.schemaVersion===schema&&value.mode==='expedition'&&Array.isArray(value.players))return value;for(const child of Object.values(value)){const found=findSnapshot(child,schema);if(found)return found;}}return null;}
for(const [file,schema] of [['save-contract-0.2.1.json',6],['save-contract-profile8-pre-daily-2026-10-13.json',7]]){
 const fixture=JSON.parse(readFileSync(new URL(`./fixtures/${file}`,import.meta.url),'utf8'));const source=findSnapshot(fixture,schema);assert.ok(source);const historic=restoreMatch(clone(source));assert.ok(historic);assert.equal(historic.fatigueVersion,undefined);if(historic.phase==='mulligan')assert.ok(confirmMulligan(historic));
 historic.players[0].deck=[];const h=findGeneral(historic,0).health,d=historic.deckRules[0].fatigueDamage;
 drawCard(historic,0);drawCard(historic,0);assert.equal(findGeneral(historic,0).health,h-2*d);assert.equal(historic.players[0].fatigueCount,undefined);assert.ok(validateMatch(historic));const restored=restoreMatch(clone(historic));drawCard(restored,0);assert.equal(findGeneral(restored,0).health,h-3*d);assert.ok(validateMatch(restored));
}
assert.equal(getEnemyPlan('border-01',3).players[1].fatigueDamage,2,'authored enemy defaults stay unchanged');
report.checks.push('immutable schema6 and schema7 fixtures retain fixed fatigue through restore, authored plans unchanged');
report.passed=true;console.log(JSON.stringify(report));
