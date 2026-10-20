// Shared test fixture: a real campaign match reduced to a blank board.
// createCampaignMatch is the only match factory; tests start from it and then
// arrange units, hands and mana directly.
import { createCampaignMatch, confirmMulligan, createBattleCardTables } from '../dist/js/engine.js';
import { makeStarterDeck } from '../dist/js/battle-deck.js';
import { getCard } from '../dist/js/cards.js';
import { getFaction, getHero } from '../dist/js/factions.js';

export const FIXTURE_LEVEL = 'border-01'; // 9x5 board, one enemy army (owner 1, general 23)

export function campaignMatch({ heroId = 1, levelId = FIXTURE_LEVEL, mulligan = true, options = {} } = {}) {
  const state = createCampaignMatch(levelId, heroId, makeStarterDeck(heroId), options);
  if (mulligan) confirmMulligan(state);
  return state;
}

/** Printed (unmodified) per-owner card tables; the level's enemy plan stat overrides are dropped. */
export function printedBattleCards(enemyGeneralId = 23) {
  const general = getCard(enemyGeneralId);
  // JSON round-trip drops undefined fields so snapshots compare equal after clone().
  return JSON.parse(JSON.stringify(createBattleCardTables({ players: { 1: { generalId: enemyGeneralId, generalAttack: general.attack, generalHealth: general.health } } })));
}

export function makeUnit(cardId, owner, x, y, unitId, extra = {}) {
  const card = getCard(cardId);
  return { unitId, cardId, owner, x, y, attack: card.attack, health: card.health, maxHealth: card.health,
    attackBuff: 0, healthBuff: 0, moved: false, attacked: false, summonedThisTurn: false,
    token: false, reborn: false, silenced: false, ...extra };
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

// Former fixed teaching scenarios (levels.js was removed); unit ids start at 101 (board order) so engine-assigned summon ids never collide.
const SCENARIOS = {
  'roar-lethal': { mana: 1, hand: [20174], board: [[1, 0, 2, 2, { attack: 0 }], [9, 0, 3, 2], [23, 1, 4, 2, { health: 5 }]] },
  'break-the-guard': { mana: 1, hand: [14], board: [[1, 0, 2, 2], [9, 0, 3, 1], [11, 1, 4, 1, { health: 3 }], [23, 1, 5, 2, { health: 2 }]] },
  'lightchaser-bond': { mana: 4, hand: [20043, 20068], board: [[1, 0, 2, 3, { attack: 0 }], [15, 0, 3, 2, { health: 1 }], [23, 1, 4, 2, { health: 7 }]] },
};
export function scenarioMatch(name) {
  const scenario = SCENARIOS[name];
  const state = blankMatch({ mana: scenario.mana, units: scenario.board.map(([cardId, owner, x, y, extra], i) => makeUnit(cardId, owner, x, y, 101 + i, extra)) });
  state.players[0].hand = [...scenario.hand];
  return state;
}

/**
 * Campaign match with two of the faction's default-squad units at the old border-01 ally starts (2,2),(1,3)
 * (ids 100/101) and the old expedition opening hand [squad[2], spell0, spell1].
 */
export function squadMatch(heroId = 1, options = {}) {
  const state = campaignMatch({ heroId, ...options });
  const faction = getFaction(getHero(heroId).faction), hero = state.units.find(unit => unit.owner === 0);
  state.units.push(makeUnit(faction.defaultSquad[0], 0, hero.x + 1, hero.y, 100), makeUnit(faction.defaultSquad[1], 0, hero.x, hero.y + 1, 101));
  setHand(state, [faction.defaultSquad[2], ...faction.spellIds.slice(0, 2)]);
  return state;
}

/** Give the player exactly these cards in hand while keeping deck + hand accountable to playerDeck. */
export function setHand(state, ids, owner = 0) {
  const player = state.players[owner], list = owner === 0 ? state.playerDeck : state.enemyPlan.players[owner].deck;
  player.deck.push(...player.hand.splice(0));
  for (const id of ids) {
    let index = player.deck.indexOf(id);
    if (index < 0) {
      index = player.deck.findIndex(other => !ids.includes(other));
      list[list.indexOf(player.deck[index])] = id;
      player.deck[index] = id;
    }
    player.hand.push(...player.deck.splice(index, 1));
  }
  return state;
}

/**
 * Re-shape a recorded schema-7 battle (tools/fixtures/*-v2.json evidence) into the
 * current schema so the captured rule situation can still be replayed. Removed
 * features (training, squads, loadout spell modes, unit growth, specializations)
 * are dropped; frozen card tables, decks, units and RNG are kept as recorded.
 */
export function currentSchemaBattle(snapshot) {
  const s = structuredClone(snapshot);
  s.schemaVersion = 8;
  s.playerDeck ??= [...(s.loadout?.deck ?? [])];
  for (const key of ['attackRangeVersion', 'training', 'squad', 'loadout', 'unitGrowth', 'contentVersion']) delete s[key];
  for (const player of s.players) player.fatigueCount ??= 0;
  for (const rules of Object.values(s.deckRules ?? {})) delete rules.fatigueDamage;
  delete s.fatigueVersion;
  for (const unit of s.units) { delete unit.bodyguardUsed; delete unit.skirmishUsed; delete unit.specialization; }
  return s;
}
