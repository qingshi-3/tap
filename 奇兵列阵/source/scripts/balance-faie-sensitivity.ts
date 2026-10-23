declare const process: { env: Record<string, string | undefined> };
// @ts-expect-error Node host module; browser project has no Node types.
import { writeFileSync } from 'node:fs';
import { generalChoices } from '../src/core/run';
import { playRun, type Strategy } from './simlib';
const rows: unknown[] = [];
let accepted = 0;
for (let index = 0; index < 20000 && accepted < 50; index++) {
  const seed = 1000 + index * 7919;
  if (!generalChoices(seed).includes('faie')) continue;
  accepted++;
  for (const strategy of ['steady', 'synergy'] as Strategy[]) {
    const battles: unknown[] = [], attempts: Record<string, number> = {};
    const run = playRun({ general: 'faie', strategy, seed, requireLegalGeneral: true,
      onBattle: (r, _setup, out, node) => {
        const key = `${r.chapter + 1}-${r.node + 1}`;
        const attempt = attempts[key] = (attempts[key] ?? 0) + 1;
        battles.push({ key, kind: node.kind, attempt, result: out.result, beats: out.beats, rounds: out.rounds, passives: [...r.passives] });
      } });
    rows.push({ seed, strategy, wins: run.wins, clear: run.clear, stopped: !run.r.over, faults: run.faults, battles });
  }
}
if (accepted !== 50) throw new Error('Faie legal seed count differs');
writeFileSync(process.env.OUT!, JSON.stringify({ candidate: process.env.FAIE_CANDIDATE, rows }, null, 2));
console.log(JSON.stringify({ candidate: process.env.FAIE_CANDIDATE, runs: rows.length }));
