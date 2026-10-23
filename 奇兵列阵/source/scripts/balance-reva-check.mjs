import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = resolve('../output/balance-20261022/simulation');
const file = resolve(dir, 'reva-v2-check-runner.mjs');
await build({ stdin: { contents: "export { revaSwaps } from './scripts/simlib'; export { newRun, swapCap } from './src/core/run';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: file });
const { revaSwaps, newRun, swapCap } = await import(pathToFileURL(file).href);
const traces = JSON.parse(readFileSync(resolve(dir, 'failure-traces.json'), 'utf8')).filter(x => x.general === 'reva');
const rows = [];
for (const trace of traces) {
  const r = newRun('reva', trace.seed);
  Object.assign(r, structuredClone(trace.prep), { chapter: 2, node: 8, general: 'reva', swaps: [] });
  const resources = JSON.stringify({ gold: r.gold, stash: r.stash, slots: r.slots, bench: r.bench });
  revaSwaps(r);
  if (!r.swaps?.length || r.swaps.length > swapCap(r)) throw new Error('Swap skill still unused/over cap');
  if (JSON.stringify({ gold: r.gold, stash: r.stash, slots: r.slots, bench: r.bench }) !== resources) throw new Error('Swap changed player resources');
  if (r.swaps.some(([a, b]) => a === b || a < 0 || b > 4)) throw new Error('Illegal swap');
  rows.push({ seed: trace.seed, strategy: trace.strategy, passives: r.passives, swaps: r.swaps });
}
writeFileSync(resolve(dir, 'reva-v2-check.json'), JSON.stringify({ rows, policy: 'visible board only; no simulate call or victory oracle in swap selection' }, null, 2));
console.log(JSON.stringify(rows));
