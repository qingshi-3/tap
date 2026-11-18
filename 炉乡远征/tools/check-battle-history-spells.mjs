import assert from 'node:assert/strict';
import { blankMatch, makeUnit } from './battle-fixture.mjs';
import { castSpell } from '../dist/js/engine.js';
import { CARDS } from '../dist/js/cards.js';
import { buildBattleHistory } from '../dist/js/battle-history-model.js';
import { SPELL_HISTORY_PREFIX } from '../dist/js/battle-history-log.js';
const cases = [
  { id:20044, name:'all-board damage', target:null, expected:'damage' },
  { id:20072, name:'summon on cell', target:{x:2,y:1}, expected:'summon' },
  { id:20043, name:'actual healing', target:900, expected:'heal', arrange:s=>{s.units.find(u=>u.unitId===900).health=1;} },
  { id:20139, name:'damage and freeze', target:901, expected:'status' },
  { id:20049, name:'damage and teleport', target:{unitId:901,cell:{x:6,y:1}}, expected:'move' },
  { id:20116, name:'attack and health buff', target:900, expected:'status' },
  { id:20073, name:'dispel', target:901, expected:'status', arrange:s=>{s.units.find(u=>u.unitId===901).x=0;s.units.find(u=>u.unitId===901).y=1;} },
  { id:20064, name:'empty dispel cell', target:{x:5,y:3}, expected:null },
];
const report=[];
for (const sample of cases) {
  const s=blankMatch({mana:9, units:[makeUnit(1,0,0,2,1),makeUnit(23,1,8,2,2),makeUnit(14,0,1,2,900),makeUnit(14,1,2,2,901)]});
  s.log=[];s.players[0].hand=[sample.id];sample.arrange?.(s);
  assert.equal(castSpell(s,0,sample.target,0),true,sample.name+' cast accepted');
  const events=buildBattleHistory(s).groups.flatMap(group=>group.events);
  assert.equal(events.length,1,sample.name+' is one transaction, including early-return branches');
  const action=events[0];assert.equal(action.kind,'spell',sample.name);assert.equal(action.sourceId,sample.id);assert.equal(action.casterId,1);
  if(sample.expected)assert.ok(action.effects.some(effect=>effect.kind===sample.expected),sample.name+' includes actual effect');
  if(sample.id===20072)assert.equal(action.effects.filter(effect=>effect.kind==='summon').length,3,'same-card summons each retain their cell and unit identity');
  if(sample.id===20044)assert.equal(action.effects.filter(effect=>effect.kind==='damage').length,4,'aggregate storm prose cannot become a fifth damage target');
  if(sample.target&&typeof sample.target==='object'&&'x'in sample.target)assert.deepEqual(action.cell,sample.target);
  const reloaded=JSON.parse(JSON.stringify(s));assert.deepEqual(buildBattleHistory(reloaded),buildBattleHistory(s),'survives save/reload');
  assert.equal(buildBattleHistory({...s,round:s.round+2}).groups.length,0,'expires after two rounds');
  report.push({name:sample.name,card:CARDS[sample.id].name,effects:action.effects.map(e=>({kind:e.kind,label:e.label,amount:e.amount,targetId:e.targetId}))});
}
{
 const s=blankMatch({mana:0});s.log=[];s.players[0].hand=[20044];assert.equal(castSpell(s,0),false);assert.equal(s.log.length,0,'failed casts produce no transaction');
}
{
 const s=blankMatch({mana:9});s.log=[];s.players[0].hand=[20044];s.units.push(makeUnit(14,0,1,1,900,{health:1}),makeUnit(14,1,2,1,901));assert.ok(castSpell(s,0));
 const events=buildBattleHistory(s).groups.flatMap(group=>group.events);assert.equal(events.length,1);assert.equal(events[0].effects.filter(e=>e.kind==='death').length,1);assert.equal(events[0].effects.filter(e=>e.kind==='damage').length,4);
}
console.log(JSON.stringify(report,null,2));
{
 const bad=['{','null','[]',JSON.stringify({cardId:20044,rows:[],changes:[],targets:{}}),JSON.stringify({cardId:20044,rows:[null],changes:[]}),JSON.stringify({cardId:20044,rows:[],changes:[null]})];
 const s=blankMatch();s.log=[`第1回合 · 我方｜玩家施放风暴。`,...bad.map(text=>`第1回合 · 我方｜${SPELL_HISTORY_PREFIX}${text}`)];
 const saved=JSON.stringify(s);assert.doesNotThrow(()=>buildBattleHistory(s));assert.equal(JSON.stringify(s),saved,'malformed public history never rewrites save state');
 assert.doesNotThrow(()=>buildBattleHistory(JSON.parse(saved)),'legacy and malformed string history survives JSON reload');
}


