import assert from 'node:assert/strict';
import { castSpell } from '../dist/js/engine.js';
import { hasAvailablePlayerAction as available } from '../dist/js/battle-available-actions.js';
import { EXPANSION_CARDS } from '../dist/js/expansion-mechanics.js';
import { blankMatch } from './battle-fixture.mjs';

const base = () => {
  const s = blankMatch();
  s.players.forEach(p => Object.assign(p, { hand: [], mana: 0, bbsUsed: true }));
  s.units.forEach(u => Object.assign(u, { moved: true, attacked: true, summonedThisTurn: false }));
  return s;
};
let checks = 0;
function check(label, setup, expected) {
  const s = base(); setup(s); const before = structuredClone(s);
  assert.equal(available(s), expected, label);
  assert.deepEqual(s, before, `${label}: query preserves input`); checks++;
}
check('exhausted', () => {}, false);
check('movement', s => s.units[0].moved = false, true);
check('summoning sickness', s => Object.assign(s.units[0], { moved: false, attacked: false, summonedThisTurn: true }), false);
check('attack including zero damage', s => { Object.assign(s.units[0], { attacked: false, x: 3, y: 2 }); Object.assign(s.units[1], { x: 4, y: 2 }); }, true);
for (const phase of ['mulligan', 'over']) check(phase, s => { s.phase = phase; s.units[0].moved = false; }, false);
check('other turn', s => { s.currentPlayer = 1; s.phase = 'ai'; s.units[0].moved = false; }, false);
function hand(s, id, mana = 9) { s.players[0].hand = [id]; s.players[0].mana = mana; }
check('unit affordable', s => hand(s, 10019), true);
check('unit unaffordable', s => hand(s, 10019, 0), false);
check('no deployment cells', s => { hand(s, 10019); s.board = { columns: 1, rows: 1 }; Object.assign(s.units[0], { x: 0, y: 0 }); }, false);
check('replace card', s => { hand(s, 10019, 0); s.players[0].replacesUsed = 0; s.players[0].deck = [10019]; }, true);
check('replace exhausted', s => { hand(s, 10019, 0); s.players[0].replacesUsed = 1; s.players[0].deck = [10019]; }, false);
check('replace needs a deck', s => { hand(s, 10019, 0); s.players[0].replacesUsed = 0; }, false);
check('self hero skill', s => Object.assign(s.players[0], { generalId:223, mana:1, bbsUsed:false }), true);
check('hero skill needs ally', s => Object.assign(s.players[0], { generalId:1, mana:1, bbsUsed:false }), false);
// Inject a spell definition into the player's per-battle card table.
function frozen(s, spell) { s.creepCells = {}; s.battleCards[0][spell.id] = spell; hand(s,spell.id); }
check('target spell with no target', s => frozen(s, {id:20129,type:'spell',cost:1,target:'minion',effect:'juxtaposition',followup:'swap'}), false);
check('cell spell permits empty target', s => frozen(s, {id:20134,type:'spell',cost:1,target:'occupiedCell',effect:'chromaticCold'}), true);
check('empty area spell permits spending', s => frozen(s, {id:999,type:'spell',cost:1,target:'enemyArea',effect:'damageArea'}), true);
check('mandatory second target absent', s => { frozen(s, {id:20129,type:'spell',cost:1,target:'minion',effect:'juxtaposition',followup:'swap'}); s.battleCards[0][10019] = {id:10019,type:'unit',cost:1}; s.units.push({...s.units[0],unitId:100,cardId:10019}); }, false);
check('mandatory second target present', s => { frozen(s, {id:20129,type:'spell',cost:1,target:'minion',effect:'juxtaposition',followup:'swap'}); s.battleCards[0][10019] = {id:10019,type:'unit',cost:1}; s.units.push({...s.units[0],unitId:100,cardId:10019}, {...s.units[0],unitId:101,cardId:10019}); }, true);
const expansionSpell = effect => Object.values(EXPANSION_CARDS).find(c => c.effect === effect);
for (const effect of ['twinStrike','spiritWild']) check(`${effect} extra requirement`, s => frozen(s, expansionSpell(effect)), false);
check('second action remains available', s => { Object.assign(s.units[0],{movesUsed:1,moved:false}); }, true);
check('second attack remains available', s => { Object.assign(s.units[0],{attacksUsed:1,attacked:false,x:3,y:2}); Object.assign(s.units[1],{x:4,y:2}); }, true);
{
  const s=base(); s.currentPlayer=1; s.phase='ai'; s.units[1].moved=false;
  const before=structuredClone(s); assert.equal(available(s,1),true); assert.equal(available(s,0),false); assert.deepEqual(s,before); checks++;
}
// Verify the unusual empty casts against actual engine commands, separately from
// the read-only query. No IDs or random state are consumed while querying.
for(const spell of [
  {id:20134,type:'spell',cost:1,target:'occupiedCell',effect:'chromaticCold',amount:2},
  {id:999,type:'spell',cost:1,target:'enemyArea',effect:'damageArea',amount:1},
]) {
  const s=base(); frozen(s,spell);
  assert.equal(available(s),true);
  assert.equal(castSpell(s,0,spell.id===20134?{x:4,y:2}:null,0),true);
  assert.equal(s.players[0].hand.length,0); checks++;
}
console.log(`Battle available actions: ${checks} behavior checks passed; all preserve input.`);

