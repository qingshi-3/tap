import { attackPositions, boardOf, getUnitBattleCard } from './engine.js';

export class AttackCoverageCache {
  get(state, unit) {
    const board = boardOf(state);
    // The engine mutates matches in place. Snapshot every dependency used by
    // attackPositions rather than relying on state identity or animation time.
    // Card abilities are included because battleCards may also change in place.
    const key = JSON.stringify([unit?.unitId, state.schemaVersion, state.attackRangeVersion, state.currentPlayer,
      board.columns, board.rows, unit?.attacked, unit?.summonedThisTurn,
      state.units.map(other => {
        const card = getUnitBattleCard(state, other);
        return [other.unitId, other.cardId, other.owner, other.x, other.y, other.health,
          other.silenced, other.provokeBuff, card?.ranged, card?.blast, card?.attackRange, card?.provoke];
      })]);
    if (key !== this.key) {
      this.key = key;
      this.positions = attackCoverage(state, unit);
      this.computations = (this.computations ?? 0) + 1;
    }
    return this.positions;
  }
}

// Ask the combat engine about a harmless enemy on each empty square. This
// preserves its silence, blast, ranged, provoke and action-availability rules
// without maintaining a second combat ruleset in the renderer. Existing units
// stay in place so an adjacent provoke continues to restrict the whole area.
export function attackCoverage(state, unit) {
  if (!unit) return [];
  const board = boardOf(state), positions = attackPositions(state, unit);
  const occupied = new Set(state.units.map(other => `${other.x},${other.y}`));
  const probe = { unitId: -1, cardId: 1, owner: 1 - unit.owner, health: 1, maxHealth: 1 };
  const probeState = { ...state, units: [...state.units, probe] };
  for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.columns; x++) {
    if (occupied.has(`${x},${y}`)) continue;
    probe.x = x; probe.y = y;
    if (attackPositions(probeState, unit).some(target => target.unitId === probe.unitId)) positions.push({ x, y });
  }
  return positions;
}
