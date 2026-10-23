import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const dir = resolve('../output/balance-20261022/simulation');
const frozen = resolve(dir, 'faie-sensitivity-source/src/core');
const core = resolve('src/core');
const sha = value => createHash('sha256').update(value).digest('hex');
const patch = JSON.parse(readFileSync(resolve(dir, 'faie-plus2-cap2-patch.json'), 'utf8'));
const changed = [], hashes = {};
for (const file of readdirSync(frozen).filter(x => x.endsWith('.ts'))) {
  const before = readFileSync(resolve(frozen, file), 'utf8').replaceAll('\r\n', '\n');
  const after = readFileSync(resolve(core, file), 'utf8').replaceAll('\r\n', '\n');
  let expected = before;
  if (file === 'engine.ts') {
    if (before.split(patch.before).length !== 2) throw new Error('Faie engine patch is not unique');
    expected = before.replace(patch.before, patch.after);
  }
  if (file === 'content.ts') {
    const text = '友军普攻或技能击杀敌人后，全体友军本场 +1 攻（每场最多2次，后发也生效）';
    if (before.split(text).length !== 2) throw new Error('Faie description patch is not unique');
    expected = before.replace(text, text.replace('+1', '+2'));
  }
  if (expected !== after) throw new Error(`Unexpected final to release core change: ${file}`);
  if (before !== after) changed.push(file);
  hashes[file] = sha(readFileSync(resolve(core, file)));
}
if (sha(readFileSync('scripts/simlib.ts')) !== sha(readFileSync(resolve(dir, 'faie-sensitivity-source/scripts/simlib.ts')))) throw new Error('Strategy changed since final');
const target = resolve(dir, 'release-faie-runner.mjs');
const built = await build({ entryPoints: ['scripts/balance-faie-sensitivity.ts'], bundle: true, platform: 'node', format: 'esm', metafile: true, outfile: target });
process.env.FAIE_CANDIDATE = 'release actual core, +2 cap2';
process.env.OUT = resolve(dir, 'release-faie.json');
await import(pathToFileURL(target).href);
for (const [file, hash] of Object.entries(hashes)) if (sha(readFileSync(resolve(core, file))) !== hash) throw new Error('Core changed during release run');
const actual = JSON.parse(readFileSync(resolve(dir, 'release-faie.json'), 'utf8'));
const candidate = JSON.parse(readFileSync(resolve(dir, 'faie-plus2-cap2.json'), 'utf8'));
if (JSON.stringify(actual.rows) !== JSON.stringify(candidate.rows)) throw new Error('Actual release Faie differs from +2 cap2 sensitivity');
const final = JSON.parse(readFileSync(resolve(dir, 'final.json'), 'utf8'));
const previous = new Map(final.rows.map(r => [`${r.general}/${r.strategy}/${r.seed}`, r]));
const rows = final.rows.filter(r => r.general !== 'faie').map(r => ({ ...r, evidenceSource: 'reused-final-1200; unchanged non-Faie behavior proven by core diff' }));
for (const r of actual.rows) {
  const old = previous.get(`faie/${r.strategy}/${r.seed}`);
  if (!old) throw new Error('Release Faie seed not in final');
  let lastPassive = '';
  const battles = r.battles.map((b, index) => {
    const passives = b.passives.join('+');
    const firstBattleAfterPassive = passives !== lastPassive && !!passives;
    lastPassive = passives;
    return { ...b, passives, firstBattle: index === 0, firstBossAttempt: b.kind === 'boss' && b.attempt === 1, firstBattleAfterPassive };
  });
  rows.push({ ...r, general: 'faie', pool: old.pool, battles, evidenceSource: 'actual-release-faie-100' });
}
if (rows.length !== 1300 || actual.rows.length !== 100) throw new Error('Release composition wrong');
const provenance = { actualReleaseRuns: 100, reusedFinalRuns: 1200, aggregateRows: 1300,
  warning: 'Composite audit: only Faie 100 runs executed on release; other 1200 reused from final after exact guarded difference review.',
  changedCoreFiles: changed, allowedChanges: 'Faie-only momentum +1 -> +2 and matching descriptive text; cap2 unchanged',
  actualFaieExactlyMatchesSensitivity: true, coreHashes: hashes, actualRunnerHash: sha(readFileSync(target)),
  reusedFinalRunnerHash: sha(readFileSync(resolve(dir, 'final-runner.mjs'))), strategyHash: sha(readFileSync('scripts/simlib.ts')) };
writeFileSync(resolve(dir, 'release-inputs.json'), JSON.stringify(built.metafile.inputs, null, 2));
writeFileSync(resolve(dir, 'release-provenance.json'), JSON.stringify(provenance, null, 2));
writeFileSync(resolve(dir, 'release.json'), JSON.stringify({ ...final, core: 'release composite audit (+2 Faie cap2)', provenance, rows }, null, 2));
console.log(JSON.stringify(provenance));
