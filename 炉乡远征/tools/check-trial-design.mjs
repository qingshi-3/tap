import assert from 'node:assert/strict';
import { createChallengeMatch, movementPositions, attackPositions, moveUnit, attackUnit,
  getBattleCard, castSpell, battleCommandTargets, useBattleCommand, spellTargets, spellPositions } from '../dist/js/engine.js';

const copy = value => structuredClone(value);
const keyOf = state => JSON.stringify(state, (key, value) => ['log','lastAction','runId','revision','selectedUnitId','playtimeSeconds'].includes(key) ? undefined : value);

// Exhaust the legal moves, attacks, spells and commands of these single-turn
// lessons. End-turn is already a loss; no player data or browser is involved.
function searchTurn(id, allowed) {
  const stack = [{ state:createChallengeMatch(id), path:[] }], seen = new Set();
  while (stack.length) {
    const { state, path } = stack.pop(), key = keyOf(state);
    if (seen.has(key)) continue;
    seen.add(key);
    assert.ok(seen.size <= 100000, `${id}: search budget exhausted; no conclusion`);
    if (state.phase === 'over') { if (state.winner === 0) return { win:true, path, explored:seen.size }; continue; }
    const actions = [];
    for (const unit of state.units.filter(unit => unit.owner === 0)) {
      for (const cell of movementPositions(state,unit)) actions.push({ kind:'move', unit:unit.unitId, ...cell });
      for (const target of attackPositions(state,unit)) actions.push({ kind:'attack', unit:unit.unitId, target:target.unitId });
    }
    for (const [index,id] of state.players[0].hand.entries()) {
      const card = getBattleCard(state,id,0);
      if (card?.type !== 'spell') continue;
      const targets = card.target === 'none' ? [null] : card.target === 'cell' ? spellPositions(state,card) : spellTargets(state,card).map(unit => unit.unitId);
      for (const target of targets) actions.push({ kind:'spell', index, card:id, target });
    }
    const command = battleCommandTargets(state,0);
    for (const target of command.type === 'self' && command.available ? [null] : command.type === 'cell' ? command.cells : command.unitIds) actions.push({ kind:'command', target });
    for (const action of actions) {
      if (!allowed(action,state)) continue;
      const next = copy(state);
      const valid = action.kind === 'move' ? moveUnit(next,action.unit,action.x,action.y)
        : action.kind === 'attack' ? attackUnit(next,action.unit,action.target)
        : action.kind === 'spell' ? castSpell(next,action.index,action.target)
        : useBattleCommand(next,action.target);
      if (valid) stack.push({ state:next, path:[...path,action] });
    }
  }
  return { win:false, explored:seen.size };
}

const results = [];
for (const [id,label,allowed] of [
  ['roar-lethal','no strengthening',action => !['spell','command'].includes(action.kind)],
  ['lightchaser-bond','no healing',action => !(action.kind === 'spell' && action.card === 20043)],
  ['lightchaser-bond','no life-to-attack spell',action => !(action.kind === 'spell' && action.card === 20068)],
  ['command-before-attack','no general command',action => action.kind !== 'command'],
  // Fresh summons in this one-turn board cannot attack; moving the existing
  // bodies and using their command still must not bypass the living guard.
  ['break-the-guard','leave the provoking guard unharmed',(action,state) => !(action.kind === 'attack' && state.units.find(unit => unit.unitId === action.target)?.cardId === 11)],
]) {
  const outcome = searchTurn(id,allowed);
  assert.equal(outcome.win,false,`${id}: ${label} unexpectedly wins: ${JSON.stringify(outcome.path)}`);
  results.push({ id,label,...outcome });
}
console.log(JSON.stringify({ ok:true, singleTurnMechanismChecks:results }));
