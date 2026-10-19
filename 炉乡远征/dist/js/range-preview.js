import { movementPositions, attackPositions } from './engine.js';

// Observation is a query about this position, not a command or a prediction
// of the AI's turn. Reset spent actions only on a detached unit; retain stun,
// hatch, terrain, blockers, provoke and every rule supplied by the engine.
export function rangePreview(state, unit, observed = false) {
  if (!unit) return { state, unit: null, movement: [], attacks: [] };
  const queryUnit = observed ? { ...unit, moved: Boolean(unit.stunTurns),
    attacked: Boolean(unit.stunTurns), movesUsed: 0, attacksUsed: 0, summonedThisTurn: false } : unit;
  const queryState = observed ? { ...state, currentPlayer: unit.owner,
    units: state.units.map(other => other === unit ? queryUnit : other) } : state;
  return { state: queryState, unit: queryUnit,
    movement: movementPositions(queryState, queryUnit), attacks: attackPositions(queryState, queryUnit) };
}

export class RangePreviewCache {
  get(state, unit, observed = false) {
    const key = JSON.stringify([unit?.unitId, observed, state.currentPlayer,
      state.schemaVersion, state.attackRangeVersion, state.board, state.battleCards,
      state.units.map(u => [u.unitId,u.cardId,u.owner,u.x,u.y,u.health,u.moved,u.attacked,
        u.movesUsed,u.attacksUsed,u.summonedThisTurn,u.stunTurns,u.hatchCardId,u.silenced,
        u.provokeBuff,u.flyingBuff,u.frenzyBuff,u.generalImmuneBuff])]);
    if (key !== this.key) { this.key = key; this.result = rangePreview(state, unit, observed); }
    return this.result;
  }
}
