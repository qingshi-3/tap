import assert from 'node:assert/strict';
import {drawCard,castSpell,useBattleCommand,endTurn,restoreMatch,validateMatch,findGeneral} from '../dist/js/engine.js';
import {PlayerProfile} from '../dist/js/profile.js';
import {getCard} from '../dist/js/cards.js';
import {campaignMatch,makeUnit} from './battle-fixture.mjs';
// Spell targets need a friendly minion; campaign matches start with only the hero.
const make=(heroId=401)=>{const s=campaignMatch({heroId}),hero=findGeneral(s,0);s.units.push(makeUnit(9,0,hero.x,hero.y===0?1:hero.y-1,100));return s;};
const fill=(s,n=6)=>{s.players[0].hand=Array(n).fill(20116);s.players[0].mana=9;s.players[0].maxMana=9;};
const ally=s=>s.units.find(u=>u.owner===0&&getCard(u.cardId).type==='unit');
const memoryStorage=()=>({data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,String(v));},removeItem(k){this.data.delete(k);}});
assert.equal(make().deckRules[0].handLimit,6);
{
  // At the cap, a drawn card is burned: it leaves the deck and does not enter the hand.
  const s=make();fill(s,5);const p=s.players[0],deck=[...p.deck];
  assert.equal(drawCard(s,0),deck[0]);assert.equal(p.hand.length,6);
  for(let i=1;i<=3;i++)assert.equal(drawCard(s,0),null);
  assert.equal(p.hand.length,6);assert.deepEqual(p.deck,deck.slice(4),'full-hand draws burn the top card');
  assert(castSpell(s,0,ally(s).unitId));assert.equal(p.hand.length,5);
  assert.equal(drawCard(s,0),deck[4]);assert.equal(p.hand.length,6);
}
{
  const s=make(418);fill(s);s.players[1].hand=Array(5).fill(14);s.players[1].deck=[14,9];
  const decks=s.players.map(p=>[...p.deck]);
  assert(useBattleCommand(s,null,0));
  assert.equal(s.players[0].hand.length,6);assert.deepEqual(s.players[0].deck,decks[0].slice(1),'418 command burns at cap');
  assert.equal(s.players[1].hand.length,6);assert.deepEqual(s.players[1].deck,decks[1].slice(1));
}
{
  const s=make(201);fill(s);s.players[0].hand[0]=20095;const p=s.players[0],deck=[...p.deck];
  assert(castSpell(s,0,ally(s).unitId));assert.equal(p.hand.length,6);assert.equal(p.hand.at(-1),deck[0]);
  assert.deepEqual(p.deck,deck.slice(1),'a spell spends its card before drawing its replacement');
}
{
  const s=make();fill(s);const before=[...s.players[0].deck];
  endTurn(s,0);while(s.currentPlayer!==0&&s.phase!=='over')endTurn(s,s.currentPlayer);
  assert.equal(s.currentPlayer,0);assert.equal(s.players[0].hand.length,6);
  assert.deepEqual(s.players[0].deck,before.slice(1),'turn-start draw burns too');
}
{
  // Empty deck: fatigue applies regardless of hand size and grows by one each time.
  const s=make();fill(s);s.players[0].deck=[];const general=findGeneral(s,0),hp=general.health;
  assert.equal(drawCard(s,0),null);assert.equal(general.health,hp-1);
  s.players[0].hand.pop();assert.equal(drawCard(s,0),null);assert.equal(general.health,hp-3);assert.equal(s.players[0].fatigueCount,2);
}
{
  // A full-hand battle saves and reloads through the profile.
  // Draw from the real deck: saves must account for every card in hand.
  const storage=memoryStorage();let profile=new PlayerProfile(storage);const s=make(),p=s.players[0];while(p.hand.length<6)p.hand.push(p.deck.shift());
  assert(validateMatch(s));assert(profile.saveBattle(s).ok);
  profile=new PlayerProfile(storage);assert.equal(profile.error,'');
  const restored=restoreMatch(profile.state.activeBattle);assert(restored);assert.equal(restored.players[0].hand.length,6);
}
for(const count of [7,8,10]){const s=make();fill(s,count);assert.equal(validateMatch(s),false,`a ${count}-card hand is rejected`);
  const profile=new PlayerProfile(memoryStorage());assert.equal(profile.saveBattle(s).ok,false);}
console.log('Six-card cap: normal/turn/skill/spell draws burn at cap, fatigue, save/reload and oversized-hand rejection passed.');
