// @ts-ignore node builtin
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../../output/balance-v3/', import.meta.url);
const before = JSON.parse(readFileSync(new URL('baseline.json', dir), 'utf8'));
const target = (globalThis as any).process.argv[2] ?? 'after';
if (!['after', 'candidate-a', 'candidate-b'].includes(target)) throw new Error('target must be after, candidate-a, or candidate-b');
const after = JSON.parse(readFileSync(new URL(`${target}.json`, dir), 'utf8'));
if (before.config.nPerGroup !== after.config.nPerGroup) throw new Error('sample size mismatch');

const comparison = before.groups.map((bg: any) => {
  const ag = after.groups.find((x: any) => x.group.id === bg.group.id);
  if (!ag) throw new Error(`missing after group ${bg.group.id}`);
  for (let i = 0; i < bg.runs.length; i++) if (bg.runs[i].seed !== ag.runs[i].seed) throw new Error(`seed mismatch ${bg.group.id} ${i}`);
  const flips = { lossToClear: 0, clearToLoss: 0 };
  for (let i = 0; i < bg.runs.length; i++) {
    if (!bg.runs[i].cleared && ag.runs[i].cleared) flips.lossToClear++;
    if (bg.runs[i].cleared && !ag.runs[i].cleared) flips.clearToLoss++;
  }
  const checkpoints = bg.summary.checkpoints.map((bc: any) => {
    const ac = ag.summary.checkpoints.find((x: any) => x.turn === bc.turn);
    const delta = (key: string) => ac[key] == null || bc[key] == null ? null : ac[key] - bc[key];
    return { turn: bc.turn, reachedBefore: bc.reachedRuns, reachedAfter: ac.reachedRuns,
      atkDelta: delta('avgAtk'), hpDelta: delta('avgHp'), tier4Delta: delta('avgTier4Slots'),
      tier5Delta: delta('avgTier5Slots'), tier6Delta: delta('avgTier6Slots') };
  });
  return { group: bg.group, before: bg.summary, after: ag.summary,
    delta: { clearRate: ag.summary.clearRate - bg.summary.clearRate,
      avgTerminalTurn: ag.summary.avgTerminalTurn - bg.summary.avgTerminalTurn,
      avgReplacements: ag.summary.avgReplacements - bg.summary.avgReplacements,
      avgFoodUses: ag.summary.avgFoodUses - bg.summary.avgFoodUses }, flips, checkpoints };
});
const out = { schemaVersion: 1, baselineGeneratedAt: before.generatedAt, afterGeneratedAt: after.generatedAt,
  pairedBy: 'group + index + identical seed', limitations: [
    'The frozen heuristic bot was not adapted to choose optimal adjacent targets for the new around supply behavior.',
    'Checkpoint means include only runs reaching that turn and have survivor-composition bias.',
    'Replacement proxy may include rare event-driven removals; food-only gold spend is unavailable.'
  ], comparison };
const outputStem = target === 'after' ? 'comparison' : `${target}-comparison`;
writeFileSync(new URL(`${outputStem}.json`, dir), JSON.stringify(out, null, 2));

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const signed = (x: number, digits = 2) => `${x >= 0 ? '+' : ''}${x.toFixed(digits)}`;
const lines = ['# Balance v3 comparison', '',
  'Same 560 seeds, frozen strategy and enemy generation. The bot was not adapted to optimize the new `around` adjacency target.', '',
  '| Group | Clear before → after | Delta | Avg terminal turn | Replacement proxy Δ | Supply uses Δ | Paired flips loss→clear / clear→loss |',
  '|---|---:|---:|---:|---:|---:|---:|'];
for (const x of comparison) lines.push(`| ${x.group.id} | ${pct(x.before.clearRate)} → ${pct(x.after.clearRate)} | ${signed(x.delta.clearRate * 100, 1)} pp | ${x.before.avgTerminalTurn.toFixed(2)} → ${x.after.avgTerminalTurn.toFixed(2)} | ${signed(x.delta.avgReplacements)} | ${signed(x.delta.avgFoodUses)} | ${x.flips.lossToClear} / ${x.flips.clearToLoss} |`);
lines.push('', '## Checkpoint attack/health deltas', '', '| Group | T6 | T8 | T10 | T12 | T15 |', '|---|---:|---:|---:|---:|---:|');
for (const x of comparison) lines.push(`| ${x.group.id} | ${x.checkpoints.map((c: any) => `${signed(c.atkDelta, 1)}/${signed(c.hpDelta, 1)}`).join(' | ')} |`);
lines.push('', 'Cells are average total attack delta / average total health delta among runs reaching that turn.', '', '## Limitations', '', ...out.limitations.map((x: string) => `- ${x}`), '');
writeFileSync(new URL(`${outputStem}-report.md`, dir), lines.join('\n'));
