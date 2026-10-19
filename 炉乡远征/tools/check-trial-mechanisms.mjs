import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { LEVELS } from '../dist/js/levels.js';
import * as E from '../dist/js/engine.js';

// Negative behavioral checks use the shipped scenarios without mutating LEVELS.
// A rejected input is recorded separately; it never counts as a losing outcome.
const results = [];
const evidence = new URL('../../../output/trial-design-optimization/mechanism-regressions.json', import.meta.url);
function check(id, label, script) {
  const state = E.createChallengeMatch(id), steps = [];
  const unit = (card, owner = 0) => {
    const found = state.units.find(u => u.cardId === card && u.owner === owner);
    assert.ok(found, `${id}: expected unit ${card}, owner ${owner}`);
    return found;
  };
  const action = (name, execute, expected = true) => {
    assert.notEqual(state.phase, 'over', `${id}: scenario attempted input after terminal result`);
    const accepted = execute();
    steps.push({ name, accepted, expected, kind: accepted ? 'legal-action' : 'rejected-input', round: state.round, phase: state.phase });
    assert.equal(accepted, expected, `${id}: ${name}`);
  };
  const c = {
    state, unit,
    move(card, x, y, expected = true) { action(`move ${card} to ${x},${y}`, () => E.moveUnit(state, unit(card).unitId, x, y), expected); },
    attack(card, target = 23, expected = true) { action(`attack ${card} -> ${target}`, () => E.attackUnit(state, unit(card).unitId, unit(target, 1).unitId), expected); },
    summon(x, y, expected = true) { action(`summon hand[0] at ${x},${y}`, () => E.playCard(state, 0, x, y), expected); },
    skill(card, owner = 0) { action(`skill -> ${card}`, () => E.useBattleCommand(state, unit(card, owner).unitId)); },
    turn() {
      action('end turn', () => E.endTurn(state, 0));
      let actions = 0;
      while (state.phase !== 'over' && state.currentPlayer !== 0) {
        assert.ok(actions++ < 100, `${id}: real AI must terminate`);
        action(`AI ${state.currentPlayer}`, () => E.autoAct(state, state.currentPlayer));
      }
    },
    finish() {
      let turns = 0;
      while (state.phase !== 'over') {
        assert.ok(turns++ <= (state.turnLimit ?? 1) + 2, `${id}: omitted-mechanic route must reach a result`);
        c.turn();
      }
    }
  };
  const record = { id, label, steps };
  results.push(record);
  try {
    script(c);
    c.finish();
    Object.assign(record, { phase: state.phase, result: state.result, winner: state.winner, reason: state.resultReason ?? null,
      rejectedInputs: steps.filter(s => s.kind === 'rejected-input').length,
      enemyHealth: state.units.filter(u => u.owner !== 0).map(u => ({ card: u.cardId, health: u.health })), log: state.log });
    assert.equal(state.phase, 'over', `${id}: must actually finish`);
    assert.notEqual(state.winner, 0, `${id}: ${label} unexpectedly won`);
    assert.equal(state.result, 'loss', `${id}: expected an engine loss`);
  } catch (error) {
    Object.assign(record, { error: error.message, phase: state.phase, result: state.result, winner: state.winner });
    throw error;
  }
}

try {
  assert.equal(LEVELS.length, 17, 'all 17 shipped lessons are covered');
  for (const level of LEVELS) check(level.id, 'all-pass', () => {});

  check('move-and-strike', 'omit approach; out-of-range attack rejected', c => { c.attack(1, 23, false); });
  check('trade-and-retaliate', 'omit guard trade; general attacks first', c => { c.move(1, 3, 3); c.attack(1); });
  check('summon-next-turn', 'summon fatigue rejects immediate movement and attack', c => {
    c.summon(5, 2); c.move(14, 6, 3, false); c.attack(14, 23, false);
    // Continue by passing, deliberately never using the recruit after fatigue ends.
  });
  check('summon-next-turn', 'never summon; zero-attack general cannot substitute', () => {});
  check('command-before-attack', 'omit command; original combined attacks', c => { c.attack(14); c.move(1, 3, 1); c.attack(1); });
  check('terrain-detour', 'wrong detour cannot approach in time', c => {
    c.move(1, 1, 1); c.turn(); c.move(1, 3, 1, false); c.attack(1, 23, false);
  });
  check('outpost-hold', 'delay capture; insufficient early mana and late recruit', c => {
    c.turn(); c.summon(3, 3, false); c.turn(); c.move(14, 3, 2); c.summon(4, 3);
  });
  check('three-way-crossfire', 'wait for crossfire but omit finishing shot', c => { c.turn(); });

  check('lyonar-healing', 'omit healing; original general and minion combination', c => {
    c.move(23, 3, 3); c.attack(23, 1); c.attack(15, 1);
  });
  check('songhai-backstab', 'omit ranged attack', c => { c.attack(110); });
  check('songhai-backstab', 'omit backstab; attack from side', c => {
    c.attack(109); c.move(110, 6, 3); c.attack(110);
  });
  check('flight-and-airdrop', 'omit flying crossing', () => {});
  check('vetruvian-obelysk', 'ignore spawned sand; general advances alone', c => {
    c.move(201, 2, 3); c.turn(); c.move(201, 4, 3);
  });
  check('abyssian-death-and-creep', 'omit first-turn creep setup', c => { c.turn(); c.skill(23, 1); });
  check('magmar-grow-and-rebirth', 'omit first hit; grown attack alone insufficient', c => { c.turn(); c.attack(402); });
  check('magmar-grow-and-rebirth', 'only initial attack; omit grown attack', c => { c.attack(402); });
  check('magmar-grow-and-rebirth', 'omit growing unit; general alone', c => {
    c.move(401, 3, 2); c.attack(401); c.turn(); c.attack(401);
  });
  check('vanar-wall-and-infiltrate', 'omit infiltrate; own-half attack', c => { c.move(505, 3, 2); c.attack(505); });
} finally {
  mkdirSync(new URL('.', evidence), { recursive: true });
  writeFileSync(evidence, JSON.stringify({
    ok: results.length === 35 && results.every(r => !r.error && r.phase === 'over' && r.result === 'loss'),
    scenarios: results.length, allPass: results.filter(r => r.label === 'all-pass').length,
    rejectedInputs: results.reduce((sum, r) => sum + r.steps.filter(s => s.kind === 'rejected-input').length, 0), results
  }, null, 2));
}
console.log(`Passed ${results.length} negative scenarios against actual product data (17 all-pass, 18 omissions); evidence: ${evidence.pathname}`);
