/** Read-only baseline inspection. Never imports simulate or runs a game. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve('../output');
const input = resolve(root, 'balance-20261022/opening/route-new.json');
const manifest = resolve(root, 'balance-20261022/opening/route-new-hashes.json');
const data = JSON.parse(readFileSync(input, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceHashes = JSON.parse(readFileSync(manifest, 'utf8'));
const sourceMismatches = Object.entries(sourceHashes).filter(([file, hash]) => sha(readFileSync(file)) !== hash).map(([file]) => file);
const groups = {};
for (const r of data.rows) {
  const s = groups[`${r.general}/${r.strategy}`] ??= { runs: 0, clear: 0, wins: 0, censored: 0,
    chapter: {}, passiveRuns: {}, hatchRuns: 0, firstHatchBattles: [] };
  s.runs++; s.clear += +r.clear; s.wins += r.wins; s.censored += +r.stopped;
  const seen = new Set(), passiveSeen = new Set();
  let hatch = false;
  for (const [index, b] of r.battles.entries()) {
    const chapter = b.key.split('-')[0];
    const c = s.chapter[chapter] ??= { reachedRuns: 0, firstBoss: { n: 0, win: 0, draw: 0, lose: 0 }, retryBoss: { n: 0, win: 0, draw: 0, lose: 0 }, nonBoss: { n: 0, win: 0, draw: 0, lose: 0 } };
    if (!seen.has(chapter)) { c.reachedRuns++; seen.add(chapter); }
    const bucket = b.kind === 'boss' ? b.attempt === 1 ? c.firstBoss : c.retryBoss : c.nonBoss;
    bucket.n++; bucket[b.result]++;
    for (const id of b.passives.split('+')) if (id) passiveSeen.add(id);
    if (b.hatchAfterBattle && !hatch) { s.hatchRuns++; s.firstHatchBattles.push(index + 1); hatch = true; }
  }
  for (const id of passiveSeen) s.passiveRuns[id] = (s.passiveRuns[id] ?? 0) + 1;
}
if (data.rows.length !== 1300 || Object.values(groups).some(s => s.runs !== 50)) throw new Error('Unexpected baseline size');
const audit = { evidence: { input, inputHash: sha(readFileSync(input)), manifest, manifestHash: sha(readFileSync(manifest)), core: data.core, strategyMetadata: data.strategyMetadata, reusedExistingRuns: 1300, newlySimulatedRuns: 0, sourceMismatches, sourceHashes }, groups };
const compact = { evidence: { ...audit.evidence, sourceHashes: undefined }, groups: Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, { runs: value.runs, clear: value.clear, meanWins: value.wins / value.runs, censored: value.censored, chapter: value.chapter, hatchRuns: value.hatchRuns }])) };
console.log(JSON.stringify(process.env.AUDIT_FULL === '1' ? audit : compact, null, 2));
