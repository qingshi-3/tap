import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const dir = resolve('../output/balance-20261022/simulation');
const hashes = JSON.parse(readFileSync(resolve(dir, 'final-hashes.json'), 'utf8'));
const frozen = resolve(dir, 'faie-sensitivity-source');
mkdirSync(resolve(frozen, 'src/core'), { recursive: true });
mkdirSync(resolve(frozen, 'scripts'), { recursive: true });
const sha = contents => createHash('sha256').update(contents).digest('hex');
for (const [file, hash] of Object.entries(hashes)) {
  const actual = resolve('../../..', file);
  if (sha(readFileSync(actual)) !== hash) throw new Error(`Final source has changed: ${actual}`);
  if (file.includes('/src/core/') || file.includes('\\src\\core\\')) copyFileSync(actual, resolve(frozen, 'src/core', basename(actual)));
  if (basename(actual) === 'simlib.ts') copyFileSync(actual, resolve(frozen, 'scripts/simlib.ts'));
}
const enginePath = resolve(frozen, 'src/core/engine.ts');
const source = readFileSync(enginePath, 'utf8').replaceAll('\r\n', '\n');
const oldBlock = source.slice(source.indexOf("        if (this.gen?.id === 'faie' && killer.side === 0"), source.indexOf("        if (duelKiller === killer.uid && kind === 'attack')"));
if (!oldBlock.includes('this.faieKillRewards < 2') || !oldBlock.includes('for (const a of ours) this.buff(undefined, a, 1, 0);')) throw new Error('Final Faie block changed');
const variants = [
  { label: 'faie-plus2-cap2', block: oldBlock.replace('this.buff(undefined, a, 1, 0)', 'this.buff(undefined, a, 2, 0)') },
  { label: 'faie-plus1-cap4', block: oldBlock.replace('this.faieKillRewards < 2', 'this.faieKillRewards < 4') },
];
for (const variant of variants) {
  let matched = 0;
  const target = resolve(dir, variant.label + '-runner.mjs');
  const built = await build({ entryPoints: ['scripts/balance-faie-sensitivity.ts'], bundle: true, platform: 'node', format: 'esm', metafile: true, outfile: target,
    plugins: [{ name: 'frozen-final-one-faiekill-patch', setup(b) {
      b.onResolve({ filter: /src[\\/]core[\\/]/ }, args => ({ path: resolve(frozen, 'src/core', args.path.split(/src[\\/]core[\\/]/)[1] + '.ts') }));
      b.onResolve({ filter: /^\.\/simlib$/ }, () => ({ path: resolve(frozen, 'scripts/simlib.ts') }));
      b.onLoad({ filter: /[\\/]engine\.ts$/ }, args => {
        if (args.path !== enginePath) throw new Error('Unexpected engine path');
        const count = source.split(oldBlock).length - 1;
        if (count !== 1 || matched++) throw new Error('Expected exactly one engine patch');
        return { contents: source.replace(oldBlock, variant.block), loader: 'ts' };
      });
    } }] });
  if (matched !== 1) throw new Error('Engine patch did not load exactly once');
  writeFileSync(resolve(dir, variant.label + '-patch.json'), JSON.stringify({ baseEngineHash: sha(readFileSync(enginePath)), patchedEngineHash: sha(source.replace(oldBlock, variant.block)), before: oldBlock, after: variant.block, replacements: matched, bundleHash: sha(readFileSync(target)), inputs: built.metafile.inputs }, null, 2));
  process.env.FAIE_CANDIDATE = variant.label;
  process.env.OUT = resolve(dir, variant.label + '.json');
  await import(pathToFileURL(target).href);
}
