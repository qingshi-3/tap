// Frozen pre-redesign Boss v1 continuation contract. Current scene rules are covered by check-encounter-mechanics/persistence.
import assert from 'node:assert/strict';
import {createExpeditionMatch,confirmMulligan,validateMatch,restoreMatch,autoAct,findGeneral,endTurn,getBattleCard,attackUnit} from '../dist/js/engine.js';
import {makeStarterDeck} from '../dist/js/battle-deck.js';
import {CAMPAIGN_UNIT_IDS} from '../dist/js/campaign-rules.js';
import {getHero,getFaction} from '../dist/js/factions.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
import {ORIGINAL_CAMPAIGN_LEVEL_IDS} from '../dist/js/adventure-access.js';
import {bossDefinition,bossTurnEnd,bossTurnStart,bossDamage,bossDeath,bossAfterDamage} from '../dist/js/boss-mechanics.js';
const clone=x=>JSON.parse(JSON.stringify(x));
const make=(level,hero=1)=>{const s=createExpeditionMatch(level,{},null,hero,{deck:makeStarterDeck(hero),spells:getFaction(getHero(hero).faction).spellIds.slice(0,2),spellTraining:{},spellModes:{},specializations:{},growthVersion:Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id=>[id,'low-v2']))},{encounters:false});confirmMulligan(s);return s;};
const roundTrip=s=>{assert.ok(validateMatch(s),s.levelId);const r=restoreMatch(clone(s));assert.ok(r,s.levelId);assert.deepEqual(r.boss,s.boss);return r;};
// Actual factories and saved continuation cover every live per-faction encounter.
let starts=0;
assert.equal(ORIGINAL_CAMPAIGN_LEVEL_IDS.length,30);
const originalLevels=ORIGINAL_CAMPAIGN_LEVEL_IDS.map(id=>EXPEDITION_LEVELS.find(level=>level.id===id));
assert.ok(originalLevels.every(Boolean),'all 30 historical Boss-v1 maps must remain available');
for(const level of originalLevels)for(const hero of [1,101,201,301,401,501]){let s=make(level.id,hero);assert.equal(!!s.boss,level.id.endsWith('-03'));roundTrip(s);assert.ok(autoAct(s));s=roundTrip(s);assert.ok(autoAct(s));roundTrip(s);starts++;}
assert.equal(starts,180,'retain all six-faction/original-level starts');
// A narrow API harness exercises the shared boss rules, using actual created armies.
// Damage/summons are recorded so each counterexample can be compared without AI choices.
function harness(s){return {rule:u=>getBattleCard(s,u.cardId,u.owner),attack:u=>u.attack+u.attackBuff,general:o=>findGeneral(s,o),damage:(u,n)=>{u.health-=n;},free:g=>[{x:g.x-1,y:g.y}],summon:(id,owner,x,y)=>{s.units.push({unitId:10000+s.units.length,cardId:id,owner,x,y,health:2});}};}
for(const id of ['border-03','shadow-03','crossroads-03','confluence-03']){
 const s=make(id),api=harness(s),g=findGeneral(s,0),def=bossDefinition(s.boss.id);
 bossTurnEnd(s,1,api);assert.ok(s.boss.marks.length);roundTrip(s);
 const hp=g.health,mark=clone(s.boss.marks);bossTurnStart(s,1,api);if(mark.some(c=>c.x===g.x&&c.y===g.y))assert.equal(g.health,hp-def.intentDamage);
 const dodge=make(id),dapi=harness(dodge),dg=findGeneral(dodge,0);bossTurnEnd(dodge,1,dapi);const dhp=dg.health;dg.x=0;dg.y=0;dodge.boss.marks=dodge.boss.marks.filter(c=>c.x!==0||c.y!==0);bossTurnStart(dodge,1,dapi);assert.equal(dg.health,dhp,'leaving marked cell avoids damage');
}
for(const id of ['road-03','banners-03','sand-03','citadel-03','ruins-03']){
 const s=make(id),api=harness(s),g=findGeneral(s,1),def=bossDefinition(s.boss.id),guard=s.units.find(u=>u.owner===1&&u!==g);
 s.units=s.units.filter(u=>u===guard||u.owner!==1||u===g);guard.x=g.x-1;guard.y=g.y;guard.silenced=false;
 if(['road-03','citadel-03'].includes(id)){guard.cardId=11;assert.ok(bossDamage(s,g,6,{},api)<6);guard.silenced=true;assert.equal(bossDamage(s,g,6,{},api),6);guard.silenced=false;s.units=s.units.filter(u=>u===guard||u.owner!==1||u===g);guard.owner=0;assert.equal(bossDamage(s,g,6,{},api),6,'player copy gives no protection');guard.owner=1;}
 const counter=id==='sand-03'?214:id==='ruins-03'?308:11;guard.cardId=counter;
 if(id!=='citadel-03'){const hp=g.health;bossDeath(s,{...guard,owner:0},api);assert.equal(g.health,hp,'player copy death never backlashes');bossDeath(s,guard,api);assert.ok(g.health<hp,'boss servant death backlashes');}
 if(def.phases.length){g.health=1;const n=s.units.length;bossAfterDamage(s,g,api);assert.equal(s.boss.phase,1);assert.ok(s.units.length>n);const after=s.units.length;bossAfterDamage(s,g,api);assert.equal(s.units.length,after,'reinforcements are finite');}
}
// Real combat deaths must reach the boss hook, and guard removal must persist.
for(const [id,cards] of [['road-03',[11,17]],['banners-03',[11,17]],['sand-03',[214,215]],['ruins-03',[308,311]]]) {
 let s=make(id),boss=findGeneral(s,1),guard=s.units.find(u=>u.owner===1&&cards.includes(u.cardId)),hero=findGeneral(s,0);
 assert.ok(guard,id+' has a counter target at the start');
 const cells=[];for(let y=0;y<s.board.rows;y++)for(let x=0;x<s.board.columns;x++)if(Math.max(Math.abs(x-guard.x),Math.abs(y-guard.y))===1&&!s.units.some(u=>u!==hero&&u.x===x&&u.y===y))cells.push({x,y});
 assert.ok(cells.length);Object.assign(hero,cells[0],{attackBuff:100,attacked:false,attacksUsed:0});guard.health=1;
 const before=boss.health;assert.ok(attackUnit(s,hero.unitId,guard.unitId),id+' real strike');assert.ok(boss.health<before,id+' real death backlash');roundTrip(s);
}
// Real engine telegraph/save/resolve: early captain marks the main hero.
{let s=make('border-03');assert.ok(endTurn(s,0));assert.ok(endTurn(s,1));assert.ok(s.boss.marks.length);s=roundTrip(s);const g=findGeneral(s,0),hp=g.health;assert.ok(endTurn(s,0));assert.equal(g.health,hp-2);roundTrip(s);}
console.log(`Enemy encounters passed: ${starts} faction/level starts and saved continuations; 10 bosses; telegraphs, dodge, guard dispel, ownership, backlash and finite phase rules.`);

// All authored campaign bosses belong to the primary enemy, including dual-army maps.
{ const s=make('confluence-03');s.boss.owner=2;assert.equal(validateMatch(s),false);assert.equal(restoreMatch(clone(s)),null); }
