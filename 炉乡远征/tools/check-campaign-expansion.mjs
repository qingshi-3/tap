import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { autoAct, createExpeditionMatch, restoreMatch, validateMatch } from '../dist/js/engine.js';
import { EXPEDITION_CHAPTERS, EXPEDITION_LEVELS, TRAINABLE_IDS } from '../dist/js/expedition-data.js';
import { CARDS } from '../dist/js/cards.js';
import { FACTIONS } from '../dist/js/factions.js';
const clone = value => JSON.parse(JSON.stringify(value));
assert.equal(EXPEDITION_CHAPTERS.length, 6);
assert.equal(EXPEDITION_LEVELS.length, 18);
const oldIds = [14,9,15,16,11,17,110,115,109,213,211,214,308,317,311,406,412,410,505,506,503];
const old = createExpeditionMatch('border-01');
old.training = Object.fromEntries(oldIds.map(id => [id, 0]));
old.players[0].hand = [14,20043];
old.players[0].deck = [14,14,9,9,11,11];
assert.deepEqual(restoreMatch(clone(old)), old, 'legacy supply and training snapshot are preserved');
delete old.training[503];
assert.equal(validateMatch(old), false, 'partial legacy training cannot resume');
old.training = Object.fromEntries(TRAINABLE_IDS.map(id => [id, 0]));
old.training[999999] = 0;
assert.equal(validateMatch(old), false, 'unknown training keys cannot resume');
// Every trainable card can be supplied as a paid reserve on every chapter entry.
for (const faction of FACTIONS) for (const reserve of faction.unitIds) {
 const candidates=faction.unitIds.filter(id=>id!==reserve).sort((a,b)=>CARDS[a].cost-CARDS[b].cost);
 const squad=CARDS[candidates[0]].cost+CARDS[candidates[1]].cost<=4 ? [...candidates.slice(0,2),reserve] : [reserve,...candidates.slice(0,2)];
 for(const chapter of EXPEDITION_CHAPTERS) {
  const state=createExpeditionMatch(chapter.levelIds[0],{},squad,faction.heroIds[0]);
  assert.ok(state.players[0].hand.includes(reserve) || state.units.some(unit=>unit.owner===0 && unit.cardId===reserve));
  assert.ok(restoreMatch(clone(state)), `${reserve}/${chapter.id} reserve snapshot`);
 }
}
const results = [];
for (const faction of FACTIONS) for (const rank of [0,2,4]) for (const level of EXPEDITION_LEVELS) {
  const training = Object.fromEntries(faction.unitIds.map(id => [id,rank]));
  let state = createExpeditionMatch(level.id, training, faction.defaultSquad, faction.heroIds[0]);
  assert.equal(state.players[0].deck.length, 24);
  assert.equal(state.players[0].hand.length, 3);
  assert.deepEqual(state.players[0].hand, [faction.defaultSquad[2], ...faction.spellIds.slice(0,2)]);
  let actions = 0;
  while (state.phase !== 'over' && actions++ < 1800) {
    autoAct(state, state.currentPlayer);
    assert.equal(validateMatch(state), true, `${level.id}/${faction.id}/${rank}: legal action snapshot`);
    if (actions % 9 === 0) state = restoreMatch(clone(state));
  }
  assert.equal(state.phase, 'over', `${level.id}/${faction.id}/${rank}: objective must terminate`);
  assert.ok(['general-defeated','enemies-eliminated','survived','turn-limit'].includes(state.resultReason));
  results.push({level:level.id,faction:faction.id,rank,result:state.result,reason:state.resultReason,round:state.round,actions});
}
mkdirSync(new URL('../output/', import.meta.url), {recursive:true});
writeFileSync(new URL('../output/campaign-expansion-check.json', import.meta.url), JSON.stringify({strategy:'deterministic autoAct; not human balance or win rate',results},null,2));
console.log(`Campaign checks passed: ${results.length} six-faction/rank/level runs; action validation and save/resume, exact old/current training rosters, 24-card supply.`);
