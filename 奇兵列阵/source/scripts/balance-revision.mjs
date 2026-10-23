import { build } from 'esbuild';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const out = resolve('../output/balance-20261022/simulation');
mkdirSync(out, { recursive: true });
const frozen = process.env.FROZEN_CORE;
const core = frozen ? resolve(frozen) : null;
const label = process.env.AUDIT_LABEL ?? (frozen ? 'baseline' : 'candidate');
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid audit label');
const target = resolve(out, label + '-runner.mjs');
const built = await build({ metafile: true, entryPoints: ['scripts/balance-revision.ts'], bundle: true, platform: 'node', format: 'esm', outfile: target,
  plugins: core ? [{ name: 'freeze-all-core-imports', setup(b) {
    b.onResolve({ filter: /src[\\/]core[\\/]/ }, args => {
      const tail = args.path.split(/src[\\/]core[\\/]/)[1];
      return { path: resolve(core, tail + '.ts') };
    });
  } }] : [] });
if (core && Object.keys(built.metafile.inputs).some(p => p.replaceAll('\\', '/').includes('source/src/core/') && !resolve(p).startsWith(core))) throw new Error('Frozen core isolation failed');
writeFileSync(resolve(out, label + '-inputs.json'), JSON.stringify(built.metafile.inputs, null, 2));
process.env.CORE_LABEL = core ?? 'current';
process.env.OUT ??= resolve(out, label + '.json');
await import(pathToFileURL(target).href);
