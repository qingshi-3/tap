export const DECK_COST_FILTERS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]);

export function toggleDeckCost(current, next) {
  return current === next ? null : next;
}

// Cost 8 is the shared 8+ bucket; costs come from the active spell upgrade.
export function matchesDeckInventory({ owned, cost }, { showUnowned = false, selectedCost = null } = {}) {
  return (showUnowned || owned) && (selectedCost == null || (selectedCost === 8 ? cost >= 8 : cost === selectedCost));
}
