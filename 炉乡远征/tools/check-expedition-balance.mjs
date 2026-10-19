import assert from 'node:assert/strict';
import { autoAct, createExpeditionMatch, endTurn, findGeneral } from '../dist/js/expedition-engine.js';
import {
  EXPEDITION_CHAPTERS, EXPEDITION_LEVELS, TRAINING_COSTS, TRAINABLE_IDS
} from '../dist/js/expedition-data.js';

const SQUAD = [14, 9, 11];
const RANKS = [0, 2, 4];
const MAX_ACTIONS = 1500;

function simulate(levelId, rank) {
  const training = Object.fromEntries(SQUAD.map((id) => [id, rank]));
  const state = createExpeditionMatch(levelId, training, SQUAD);
  let actions = 0;
  while (state.phase !== 'over' && actions++ < MAX_ACTIONS) autoAct(state, state.currentPlayer);
  assert.equal(state.phase, 'over', `${levelId} rank ${rank} simulation must terminate`);
  return {
    levelId,
    rank,
    result: state.result,
    round: state.round,
    generalHealth: findGeneral(state, 0)?.health ?? 0
  };
}

function runBaseline() {
  return RANKS.flatMap((rank) => EXPEDITION_LEVELS.map(({ id }) => simulate(id, rank)));
}

const baseline = runBaseline();
const repeated = runBaseline();
assert.deepEqual(repeated, baseline, 'fixed autoAct baseline must be deterministic');

// These are deterministic AI-vs-AI smoke results. They are a tuning reference,
// not a measurement or promise of human win rate.
console.log(`Fixed squad: [${SQUAD.join(', ')}]. Strategy: deterministic autoAct (not human win rate).`);
console.table(baseline.map((entry) => ({
  rank: entry.rank,
  level: entry.levelId,
  result: entry.result,
  round: entry.round,
  playerGeneralHealth: entry.generalHealth
})));

const levelById = new Map(EXPEDITION_LEVELS.map((level) => [level.id, level]));
const chapterEconomy = EXPEDITION_CHAPTERS.map((chapter) => ({
  chapter: chapter.id,
  firstClearCoins: chapter.levelIds.reduce((sum, id) => sum + levelById.get(id).reward.first, 0),
  oneRepeatOfEach: chapter.levelIds.reduce((sum, id) => sum + levelById.get(id).reward.repeat, 0)
}));
console.table(chapterEconomy);

const oneUnitMax = TRAINING_COSTS.reduce((sum, cost) => sum + cost, 0);
const defaultSquadMax = oneUnitMax * SQUAD.length;
const rosterMax = oneUnitMax * TRAINABLE_IDS.length;
const firstClearTotal = chapterEconomy.reduce((sum, row) => sum + row.firstClearCoins, 0);
const initialCoins = 80;
console.table([{
  initialCoins,
  oneUnitRank4: oneUnitMax,
  defaultSquadRank4: defaultSquadMax,
  fullRosterRank4: rosterMax,
  allFirstClears: firstClearTotal,
  afterDefaultSquad: initialCoins + firstClearTotal - defaultSquadMax,
  remainingForFullRoster: rosterMax - initialCoins - firstClearTotal
}]);

assert.equal(oneUnitMax, 380);
assert.equal(EXPEDITION_LEVELS.length, 18);
assert.equal(firstClearTotal, 3330);
assert.equal(initialCoins + chapterEconomy[0].firstClearCoins >= oneUnitMax, true,
  'initial coins plus chapter one first clears fund one rank-4 unit');
assert.equal(initialCoins + firstClearTotal >= defaultSquadMax, true,
  'all first clears fund the default squad to rank 4');

console.log('expedition balance checks passed');
