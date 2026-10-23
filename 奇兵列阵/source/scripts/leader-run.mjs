import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const dir = resolve('../output/leader-design-20261022');
mkdirSync(dir, { recursive: true });
const label = process.env.LEADER_LABEL ?? 'baseline-policy-smoke';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid label');
const freeze = resolve(dir, 'policy-freeze.json');
if (existsSync(freeze)) {
  const expected = JSON.parse(readFileSync(freeze, 'utf8')).sourceHashes;
  for (const [file, hash] of Object.entries(expected)) if (createHash('sha256').update(readFileSync(file)).digest('hex') !== hash) throw new Error('Frozen policy changed: ' + file);
}
const core = process.env.LEADER_CORE === 'current' ? resolve('src/core') : resolve(process.env.LEADER_CORE ?? '../output/leader-design-20261022/before-0.8.3/src/core');
const target = resolve(dir, label + '-runner.mjs');
const built = await build({ entryPoints: ['scripts/leader-run.ts'], bundle: true, platform: 'node', format: 'esm', metafile: true, outfile: target,
  plugins: [{ name: 'freeze-selected-leader-core', setup(b) {
    b.onResolve({ filter: /src[\\/]core[\\/]/ }, args => ({ path: resolve(core, args.path.split(/src[\\/]core[\\/]/)[1] + '.ts') }));
  } }] });
for (const input of Object.keys(built.metafile.inputs)) if (input.replaceAll('\\', '/').includes('/src/core/') && !resolve(input).startsWith(core)) throw new Error('Mixed core module graph');
const sha = value => createHash('sha256').update(value).digest('hex');
process.env.SEED_INPUT = resolve('../output/balance-20261022/opening/route-new.json');
process.env.LEADER_CORE_LABEL = core;
process.env.LEADER_OUT = resolve(dir, label + '.json');
process.env.LEADER_TRACE_OUT = resolve(dir, label + '-boundaries.json');
writeFileSync(resolve(dir, label + '-inputs.json'), JSON.stringify(built.metafile.inputs, null, 2));
writeFileSync(resolve(dir, label + '-hashes.json'), JSON.stringify({ sourceHashes: Object.fromEntries(Object.keys(built.metafile.inputs).map(file => [file, sha(readFileSync(file))])), seedInputHash: sha(readFileSync(process.env.SEED_INPUT)), runnerHash: sha(readFileSync(target)), samples: Number(process.env.LEADER_SAMPLES ?? 10) }, null, 2));
await import(pathToFileURL(target).href);
