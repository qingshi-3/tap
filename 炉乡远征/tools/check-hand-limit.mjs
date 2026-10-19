import assert from 'node:assert/strict';
import {createMatch,createExpeditionMatch,drawCard,castSpell,useBattleCommand,endTurn,restoreMatch,validateMatch} from '../dist/js/engine.js';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {getCard} from '../dist/js/cards.js';
const make=(hero=401)=>createExpeditionMatch('border-01',{},null,hero);
const fill=(s,n=6)=>{s.players[0].hand=Array(n).fill(20116);s.players[0].mana=9;s.players[0].maxMana=9;};
const ally=s=>s.units.find(u=>u.owner===0&&getCard(u.cardId).type==='unit');
{
  const s=make();fill(s,5);const p=s.players[0],deck=[...p.deck],top=deck[0];
  assert.equal(drawCard(s,0),top);assert.equal(p.hand.length,6);
  for(let i=0;i<3;i++)assert.equal(drawCard(s,0),null);
  assert.deepEqual(p.deck,deck.slice(1));
  assert(castSpell(s,0,ally(s).unitId));assert.equal(p.hand.length,5);
  assert.equal(drawCard(s,0),deck[1]);assert.equal(p.hand.length,6);
}
{
  const s=make(418);fill(s);s.players[1].hand=Array(5).fill(14);s.players[1].deck=[14,9];
  const decks=s.players.map(p=>[...p.deck]);
  assert(useBattleCommand(s,null,0));assert.deepEqual(s.players[0].deck,decks[0]);
  assert.equal(s.players[0].hand.length,6);assert.equal(s.players[1].hand.length,6);
  assert.deepEqual(s.players[1].deck,decks[1].slice(1));
}
{
  const s=make(201);fill(s);s.players[0].hand[0]=20095;const p=s.players[0],deck=[...p.deck];
  assert(castSpell(s,0,ally(s).unitId));assert.equal(p.hand.length,6);
  assert.deepEqual(p.deck,deck.slice(1),'a spell spends its card before drawing its replacement');
}
{
  const s=make();fill(s);const before=[...s.players[0].deck];
  endTurn(s,0);while(s.currentPlayer!==0&&s.phase!=='over')endTurn(s,s.currentPlayer);
  assert.equal(s.currentPlayer,0);assert.equal(s.players[0].hand.length,6);
  assert.deepEqual(s.players[0].deck,before,'turn-start draw pauses too');
  const legacy=createMatch(),p=legacy.players[0];p.hand=Array(6).fill(14);p.deck=[];
  const general=legacy.units.find(u=>u.owner===0),hp=general.health;
  assert.equal(drawCard(legacy,0),null);assert.equal(general.health,hp,'paused empty-deck draw does not cause fatigue');
  p.hand.pop();drawCard(legacy,0);assert.equal(general.health,hp-1,'under cap, existing fatigue still applies');
}
// Supported over-cap saves keep their cards and can play/save/reload until draws resume.
for(const count of [7,8,9]){
  const storage={data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,String(v));},removeItem(k){this.data.delete(k);}};
  let progress=new ExpeditionProgress(storage),s=make();fill(s,count);
  assert(validateMatch(s));assert(progress.saveBattle(s).ok);
  const original=[...s.players[0].deck];
  while(s.players[0].hand.length>=6){
    assert.equal(drawCard(s,0),null);assert.deepEqual(s.players[0].deck,original);
    assert(castSpell(s,0,ally(s).unitId));assert(progress.saveBattle(s).ok);
    progress=new ExpeditionProgress(storage);assert.equal(progress.error,'');
    s=restoreMatch(progress.state.activeBattle);assert(s);
  }
  assert.equal(s.players[0].hand.length,5);assert.equal(drawCard(s,0),original[0]);
  assert(progress.saveBattle(s).ok);progress=new ExpeditionProgress(storage);
  assert.equal(progress.state.activeBattle.players[0].hand.length,6);
  assert.deepEqual(progress.state.activeBattle.players[0].deck,original.slice(1));
}
{const s=make();fill(s,10);assert.equal(validateMatch(s),false,'unsupported oversized saves remain rejected');}
console.log('Six-card cap: normal/turn/skill/spell draws, deck preservation, fatigue and 7–9 card save/play/reload passed.');
