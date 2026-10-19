import { effectiveAttack, simulateAttackUnit } from './engine.js';

/** Read-only forecast of the engine's complete attack settlement. */
export function previewAttack(state, attackerId, targetId, playerId = state.currentPlayer) {
  const after = simulateAttackUnit(state, attackerId, targetId, playerId);
  if (!after) return null;
  const survivors = new Map(after.units.map((unit) => [unit.unitId, unit]));
  const units = state.units.flatMap((before) => {
    const unit = survivors.get(before.unitId);
    const attackBefore = effectiveAttack(state, before);
    const attackAfter = unit ? effectiveAttack(after, unit) : 0;
    if (before.unitId !== attackerId && before.unitId !== targetId && unit &&
        JSON.stringify(before) === JSON.stringify(unit) && attackBefore === attackAfter) return [];
    return [{ unitId: before.unitId, owner: before.owner, cardId: before.cardId,
      x: before.x, y: before.y, healthBefore: before.health,
      healthAfter: unit ? unit.health : 0, attackBefore, attackAfter,
      removed: !unit, shieldLost: false,
      // Current rules implement one-use adjacent protection, not a shield.
      guardConsumed: !before.bodyguardUsed && !!unit?.bodyguardUsed }];
  });
  return { attackerId, targetId, retaliated: !!after.lastAction.retaliated,
    targetIds: [...after.lastAction.targetIds], units };
}
