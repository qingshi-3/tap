// Shared test fixture: a real campaign match reduced to a blank board.
// createCampaignMatch is the only match factory; tests start from it and then
// arrange units, hands and mana directly.
import { createExpeditionMatch, confirmMulligan, createContentBattleCardTables } from '../dist/js/engine.js';
import { makeStarterDeck } from '../dist/js/battle-deck.js';
import { getCard } from '../dist/js/cards.js';
import { CAMPAIGN_UNIT_IDS } from '../dist/js/campaign-rules.js';
import { getFaction, getHero } from '../dist/js/factions.js';

export const FIXTURE_LEVEL = 'border-01'; // 9x5 board, one enemy army (owner 1, general 23)

export function campaignMatch({ heroId = 1, levelId = FIXTURE_LEVEL, mulligan = true, options = {} } = {}) {
  const state = createExpeditionMatch(levelId, {}, null, heroId, { deck: makeStarterDeck(heroId), spells: getFaction(getHero(heroId).faction).spellIds.slice(0, 2), spellTraining: {}, spellModes: {}, specializations: {}, growthVersion: Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id => [id, 'low-v2'])) }, {encounters:false,...options});
  if (mulligan) confirmMulligan(state);
  return state;
}

/** Printed (unmodified) per-owner card tables; the level's enemy plan stat overrides are dropped. */
export function printedBattleCards(enemyGeneralId = 23) {
  const general = getCard(enemyGeneralId);
  // JSON round-trip drops undefined fields so snapshots compare equal after clone().
  return JSON.parse(JSON.stringify(createContentBattleCardTables({ players: { 1: { unitStats: {}, generalId: enemyGeneralId, generalAttack: general.attack, generalHealth: general.health } } })));
}

export function makeUnit(cardId, owner, x, y, unitId, extra = {}) {
  const card = getCard(cardId);
  return { unitId, cardId, owner, x, y, attack: card.attack, health: card.health, maxHealth: card.health,
    attackBuff: 0, healthBuff: 0, moved: false, attacked: false, summonedThisTurn: false,
    token: false, reborn: false, silenced: false, bodyguardUsed: false, skirmishUsed: false, ...(owner === 0 && !card.token ? { specialization: 'none' } : {}), ...extra };
}

/**
 * Blank player-turn board: printed cards, empty hands/decks, no tiles.
 * Units default to the two generals (player hero at (0,2), enemy general 23 at (8,2)).
 */
export function blankMatch({ heroId = 1, enemyGeneralId = 23, units = null, mana = 0, tiles = [] } = {}) {
  const state = campaignMatch({ heroId });
  state.battleCards = printedBattleCards(enemyGeneralId);
  state.board = { ...state.board, tiles: structuredClone(tiles) };
  state.outposts = {}; state.creepCells = {};
  state.players[1].generalId = enemyGeneralId;
  state.players[1].name = getCard(enemyGeneralId).name;
  for (const player of state.players) Object.assign(player, { hand: [], deck: [], mana, maxMana: Math.max(mana, player.maxMana), bbsUsed: false, turnTriggers: {}, replacesUsed: 0, fatigueCount: 0 });
  state.units = units ?? [makeUnit(heroId, 0, 0, 2, 1), makeUnit(enemyGeneralId, 1, 8, 2, 2)];
  state.selectedUnitId = null; state.lastAction = null;
  return state;
}

