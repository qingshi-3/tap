// Replays a small final-Boss sample directly from JSONL audit inputs.
// @ts-ignore node builtins
import { createReadStream } from 'node:fs';
// @ts-ignore node builtins
import { createInterface } from 'node:readline';

for (const label of ['baseline', 'candidate'] as const) {
  const engine: any = label === 'baseline' ? await import('./baseline/engine') : await import('../../src/core/engine');
  const path = new URL(`../../output/final-hurt-boss/${label}-battles.jsonl`, import.meta.url);
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let checked = 0;
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (record.boss !== 'final') continue;
    const out = engine.simulate(record.playerTeam, record.enemyTeam, record.battleSeed, record.relics);
    if (out.result !== record.result) throw new Error(`${label}/${record.group}/${record.index}: result replay mismatch`);
    if (JSON.stringify(out.stats) !== JSON.stringify(record.stats)) throw new Error(`${label}/${record.group}/${record.index}: stats replay mismatch`);
    checked++;
    if (checked === 3) break;
  }
  lines.close();
  if (checked !== 3) throw new Error(`${label}: only ${checked} final battles found`);
  console.log(`${label}: replayed ${checked} final battles; result and stats exact`);
}
