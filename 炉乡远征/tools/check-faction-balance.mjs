import assert from 'node:assert/strict';
import { autoAct, createExpeditionMatch, findGeneral } from '../dist/js/expedition-engine.js';
import { EXPEDITION_LEVELS, TRAINABLE_IDS } from '../dist/js/expedition-data.js';
import { FACTIONS, HEROES } from '../dist/js/factions.js';

const RANKS = [0, 2, 4];
const MAX_ACTIONS = 1500;

function simulate(heroId, levelId, rank) {
  const faction = FACTIONS.find((entry) => entry.heroIds.includes(heroId));
  const training = Object.fromEntries(TRAINABLE_IDS.map((id) => [id, faction.unitIds.includes(id) ? rank : 0]));
  const state = createExpeditionMatch(levelId, training, faction.defaultSquad, heroId);
  const starvedTurnSerials = new Set();
  let actions = 0;
  while (state.phase !== 'over' && actions < MAX_ACTIONS) {
    const player = state.players[0];
    if (state.currentPlayer === 0 && player.hand.length === 0 && player.deck.length === 0) starvedTurnSerials.add(state.turnSerial);
    autoAct(state, state.currentPlayer);
    actions += 1;
  }
  return {
    heroId, hero: HEROES[heroId].name, factionId: faction.id, levelId, rank, terminated: state.phase === 'over',
    result: state.phase === 'over' ? state.result : 'timeout', round: state.round, actions,
    generalHealth: findGeneral(state, 0)?.health ?? 0, starvedTurns: starvedTurnSerials.size
  };
}

const results = [];
for (const faction of FACTIONS) {
  for (const heroId of faction.heroIds) {
    for (const rank of RANKS) {
      for (const { id: levelId } of EXPEDITION_LEVELS) results.push(simulate(heroId, levelId, rank));
    }
  }
}

const expectedCount = FACTIONS.length * 2 * RANKS.length * EXPEDITION_LEVELS.length;
assert.equal(results.length, expectedCount);
assert.equal(results.every((entry) => entry.terminated), true, 'all deterministic simulations must terminate within the action cap');

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const summary = Object.values(HEROES).map((hero) => {
  const byRank = Object.fromEntries(RANKS.map((rank) => [rank, results.filter((entry) => entry.heroId === hero.id && entry.rank === rank)]));
  const wins = Object.fromEntries(RANKS.map((rank) => [rank, byRank[rank].filter((entry) => entry.result === 'win').length]));
  const rounds = Object.fromEntries(RANKS.map((rank) => [rank, median(byRank[rank].map((entry) => entry.round))]));
  return {
    faction: hero.faction, heroId: hero.id, hero: hero.name,
    winsR0: wins[0], winsR2: wins[2], winsR4: wins[4], lossesR4: byRank[4].filter((entry) => entry.result === 'loss').length,
    terminated: RANKS.reduce((sum, rank) => sum + byRank[rank].filter((entry) => entry.terminated).length, 0),
    medianRoundsR0: rounds[0], medianRoundsR2: rounds[2], medianRoundsR4: rounds[4],
    rank4WinDelta: wins[4] - wins[0], rank4RoundDelta: rounds[4] - rounds[0],
    starvedTurns: RANKS.reduce((sum, rank) => sum + byRank[rank].reduce((rankSum, entry) => rankSum + entry.starvedTurns, 0), 0)
  };
});

console.log(`Deterministic autoAct matrix: ${results.length} runs (${Object.keys(HEROES).length} heroes × ${EXPEDITION_LEVELS.length} levels × ${RANKS.length} ranks). This is a tuning signal, not a human win-rate estimate.`);
console.table(summary);

const levelSummary = EXPEDITION_LEVELS.map((level) => {
  const rows = results.filter((entry) => entry.levelId === level.id);
  return {
    level: level.id, runs: rows.length, wins: rows.filter((entry) => entry.result === 'win').length,
    losses: rows.filter((entry) => entry.result === 'loss').length, timeouts: rows.filter((entry) => !entry.terminated).length,
    medianRounds: median(rows.map((entry) => entry.round)), starvedTurns: rows.reduce((sum, entry) => sum + entry.starvedTurns, 0)
  };
});
console.table(levelSummary);

const unchangedByRank = summary.filter((entry) => entry.winsR0 === entry.winsR2 && entry.winsR2 === entry.winsR4 && entry.medianRoundsR0 === entry.medianRoundsR2 && entry.medianRoundsR2 === entry.medianRoundsR4);
if (unchangedByRank.length) console.warn(`Rank signal unchanged for: ${unchangedByRank.map((entry) => `${entry.hero}(${entry.heroId})`).join(', ')}`);
const alwaysWins = summary.filter((entry) => entry.winsR0 === EXPEDITION_LEVELS.length);
if (alwaysWins.length) console.warn(`Possible rank-0 trivialization: ${alwaysWins.map((entry) => `${entry.hero}(${entry.heroId})`).join(', ')}`);
const neverWins = summary.filter((entry) => entry.winsR4 === 0);
if (neverWins.length) console.warn(`Possible rank-4 wall: ${neverWins.map((entry) => `${entry.hero}(${entry.heroId})`).join(', ')}`);
const starved = summary.filter((entry) => entry.starvedTurns > 0);
if (starved.length) console.warn(`Empty hand+deck turns observed for: ${starved.map((entry) => `${entry.hero}=${entry.starvedTurns}`).join(', ')}`);

console.log('faction balance checks passed');
