/** Printed geometry: an absent range belongs to a legacy, unlimited ranged card. */
export function cardAttackRange(card) {
  if (!card || card.type === 'spell') return null;
  if (!card.ranged && !card.blast) return 1;
  return Number.isInteger(card.attackRange) && card.attackRange > 0 ? card.attackRange : Infinity;
}
