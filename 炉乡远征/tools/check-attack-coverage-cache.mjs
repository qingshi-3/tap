import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createMatch, attackPositions } from '../dist/js/engine.js';
import { AttackCoverageCache, attackCoverage } from '../dist/js/attack-coverage.js';
import { mkdirSync, writeFileSync } from 'node:fs';

const state = createMatch();
const source = state.units[0];
Object.assign(source, { x: 3, y: 2, cardId: 109, attacked: false, summonedThisTurn: false });
const enemy = state.units[1];
Object.assign(enemy, { x: 4, y: 2 });
const cache = new AttackCoverageCache();
let positions = cache.get(state, source);
const start = performance.now();
for (let frame = 0; frame < 1000; frame++) assert.equal(cache.get(state, source), positions);
const cachedMs = performance.now() - start;
assert.equal(cache.computations, 1, 'unchanged animation frames calculate once');
const checks = ['1000 unchanged frames reuse same coverage'];
function changed(label, mutate, verify = () => {}) {
  const before = cache.computations;
  mutate();
  positions = cache.get(state, source);
  assert.equal(cache.computations, before + 1, label + ' invalidates');
  assert.deepEqual(positions, attackCoverage(state, source), label + ' matches engine coverage');
  verify(positions);
  assert.equal(cache.get(state, source), positions);
  checks.push(label);
}
changed('source movement', () => source.x--);
changed('enemy movement', () => enemy.x--);
changed('provoke applied in place', () => enemy.provokeBuff = true, p => assert.deepEqual(p, attackPositions(state, source)));
changed('provoke dispelled in place', () => enemy.provokeBuff = false, p => assert.ok(p.length > 8));
changed('attack consumed', () => source.attacked = true, p => assert.equal(p.length, 0));
changed('new turn action restored', () => source.attacked = false);
changed('new summon', () => source.summonedThisTurn = true, p => assert.equal(p.length, 0));
changed('summon action restored', () => source.summonedThisTurn = false);
changed('player changed', () => state.currentPlayer = 1, p => assert.equal(p.length, 0));
changed('player restored', () => state.currentPlayer = 0);
// Frozen battle-card snapshots and silence are schema-7 dependencies.
changed('schema/card snapshots', () => {
  state.schemaVersion = 7;
  state.battleCards = [{ 109: { id:109, ranged:true } }, { 23:{ id:23 }, 1:{ id:1 } }];
});
changed('silence', () => source.silenced = true, p => assert.ok(p.length <= 8));
changed('silence removed', () => source.silenced = false, p => assert.ok(p.length > 8));
changed('battle card mutated', () => state.battleCards[0][109].ranged = false, p => assert.ok(p.length <= 8));
changed('enemy card gains provoke', () => state.battleCards[1][23].provoke = true, p => assert.deepEqual(p, attackPositions(state, source)));
changed('enemy removed', () => state.units.pop());
changed('board changed', () => state.board = { columns: 8, rows: 4 });
const report = { passed:true, checks, unchangedFrames:1000, unchangedCoverageComputations:1, cachedMs };
const out = new URL('../output/ui-refinement/range/', import.meta.url);
mkdirSync(out, {recursive:true});
writeFileSync(new URL('cache-report.json', out), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
