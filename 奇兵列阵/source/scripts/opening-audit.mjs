import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const dir = resolve('../output/balance-20261022/opening');
mkdirSync(dir, { recursive: true });
const label = process.env.OPENING_LABEL ?? 'opening-final';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid label');
const target = resolve(dir, label + '-runner.mjs');
const built = await build({ entryPoints: [process.env.OPENING_MODE === 'run' ? 'scripts/balance-revision.ts' : 'scripts/opening-audit.ts'], bundle: true, platform: 'node', format: 'esm', metafile: true, outfile: target });
writeFileSync(resolve(dir, label + '-inputs.json'), JSON.stringify(built.metafile.inputs, null, 2));
writeFileSync(resolve(dir, label + '-hashes.json'), JSON.stringify(Object.fromEntries(Object.keys(built.metafile.inputs).map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')])), null, 2));
process.env.OUT = resolve(dir, label + '.json');
if (process.env.OPENING_MODE === 'run') { process.env.SAMPLES = '50'; process.env.CORE_LABEL = '0.8.3 opening route revision'; }
await import(pathToFileURL(target).href);
