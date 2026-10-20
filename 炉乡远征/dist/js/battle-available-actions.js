import {
  movementPositions, attackPositions, canReplaceHandCard, canUseHandCard,
  getBattleCard, getUnitBattleCard, summonPositions, getOpeningFollowup,
  spellPositions, spellTargets, getSpellFollowup, battleCommandTargets,
} from './engine.js';
import { enemyHalf, EXPANSION_SPELL_IDS } from './expansion-mechanics.js';

function canSummon(state, card, owner) {
  return summonPositions(state, owner, card.id).some(cell => {
    const choice = getOpeningFollowup(state, card.id, cell, owner);
    if (!choice || choice.optional) return true;
    if (choice.type === 'cell') return choice.cells.length > 0;
    return choice.unitIds.some(id => !card.openingTeleport ||
      getOpeningFollowup(state, card.id, cell, owner, id)?.cells.length > 0);
  });
}

function canCast(state, spell, owner) {
  const expanded = EXPANSION_SPELL_IDS.includes(spell.id);
  if (expanded) {
    if (spell.effect === 'twinStrike' && state.units.filter(unit => unit.owner !== owner && getUnitBattleCard(state, unit)?.type === 'unit').length < 2) return false;
    if (spell.effect === 'spiritWild' && !state.units.some(unit => unit.owner === owner && getUnitBattleCard(state, unit)?.type === 'unit' && enemyHalf(state, unit))) return false;
    if (spell.target === 'none') return true;
  }
  if (spell.summon || ['cell', 'areaCell'].includes(spell.target) || spell.effect === 'chromaticCold') return spellPositions(state, spell, owner).length > 0;
  // These legacy area spells deliberately allow spending mana with no victims.
  if (!expanded && (spell.effect === 'tempest' || spell.target === 'enemyArea')) return true;
  return spellTargets(state, spell, owner).some(unit => {
    if (expanded && spell.effect === 'eggMorph' && unit.cardId === 411 && !unit.hatchCardId) return false;
    const followup = getSpellFollowup(state, spell, unit.unitId, owner);
    return !followup || (followup.type === 'unit' ? followup.unitIds.length > 0 : followup.cells.length > 0);
  });
}

// A query only: never executes commands on snapshots (which can consume IDs or
// random draws). Reuse the engine's target/position rules and remaining-action flags.
export function hasAvailablePlayerAction(state, owner = 0) {
  if (!state || state.currentPlayer !== owner || !['playing', 'ai'].includes(state.phase) || !state.players?.[owner]) return false;
  if (state.units.some(unit => unit.owner === owner && (movementPositions(state, unit).length || attackPositions(state, unit).length))) return true;
  if (battleCommandTargets(state, owner).available) return true;
  const player = state.players[owner];
  return player.hand.some((id, index) => {
    if (canReplaceHandCard(state, index, owner)) return true;
    if (!canUseHandCard(state, index, owner)) return false;
    const card = getBattleCard(state, id, owner);
    if (!card || player.mana < card.cost) return false;
    return card.type === 'unit' ? canSummon(state, card, owner) : card.type === 'spell' && canCast(state, card, owner);
  });
}
