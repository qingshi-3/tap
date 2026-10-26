// Deterministic paired bootstrap over already-saved same-seed raw runs. No simulation.
// @ts-ignore node builtin
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../../output/balance-v3/', import.meta.url);
const baseline = JSON.parse(readFileSync(new URL('baseline.json', dir), 'utf8'));
const candidateA = JSON.parse(readFileSync(new URL('candidate-a.json', dir), 'utf8'));
const candidateB = JSON.parse(readFileSync(new URL('candidate-b.json', dir), 'utf8'));
const REPS = 20_000;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
function percentile(sorted: number[], p: number) {
  const at = (sorted.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}
function paired(from: any, to: any, seed: number) {
  const clear: number[] = [], turn: number[] = [];
  for (let i = 0; i < from.runs.length; i++) {
    if (from.runs[i].seed !== to.runs[i].seed) throw new Error(`seed mismatch at ${i}`);
    clear.push(Number(to.runs[i].cleared) - Number(from.runs[i].cleared));
    turn.push(to.runs[i].terminalTurn - from.runs[i].terminalTurn);
  }
  const random = rng(seed), clearBoot: number[] = [], turnBoot: number[] = [];
  for (let rep = 0; rep < REPS; rep++) {
    let cs = 0, ts = 0;
    for (let i = 0; i < clear.length; i++) {
      const j = Math.floor(random() * clear.length);
      cs += clear[j]; ts += turn[j];
    }
    clearBoot.push(cs / clear.length); turnBoot.push(ts / turn.length);
  }
  clearBoot.sort((a, b) => a - b); turnBoot.sort((a, b) => a - b);
  return { pairs: clear.length, clearRateDelta: mean(clear), clearRateDelta95: [percentile(clearBoot, .025), percentile(clearBoot, .975)],
    terminalTurnDelta: mean(turn), terminalTurnDelta95: [percentile(turnBoot, .025), percentile(turnBoot, .975)] };
}
function compare(from: any, to: any, seedBase: number) {
  return from.groups.map((fg: any, i: number) => {
    const tg = to.groups.find((x: any) => x.group.id === fg.group.id);
    if (!tg) throw new Error(`missing group ${fg.group.id}`);
    return { group: fg.group.id, ...paired(fg, tg, seedBase + i * 7919) };
  });
}
const out = { schemaVersion: 1, method: 'Paired nonparametric bootstrap percentile interval; resample the 80 matched seed-pairs with replacement; 20,000 deterministic replicates per group and comparison.',
  finalBVsBaseline: compare(baseline, candidateB, 0xb41a9ce1), finalBVsAbandonedA: compare(candidateA, candidateB, 0xa2b7c441) };
writeFileSync(new URL('paired-intervals.json', dir), JSON.stringify(out, null, 2));
const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} pp`;
const num = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`;
const table = (title: string, rows: any[]) => ['## ' + title, '', '| Group | Clear-rate delta (95% CI) | Terminal-turn delta (95% CI) |', '|---|---:|---:|',
  ...rows.map((x) => `| ${x.group} | ${pct(x.clearRateDelta)} [${pct(x.clearRateDelta95[0])}, ${pct(x.clearRateDelta95[1])}] | ${num(x.terminalTurnDelta)} [${num(x.terminalTurnDelta95[0])}, ${num(x.terminalTurnDelta95[1])}] |`), ''];
const md = ['# Paired same-seed intervals', '', out.method, '', ...table('Final B vs baseline', out.finalBVsBaseline), ...table('Final B vs abandoned A', out.finalBVsAbandonedA)];
writeFileSync(new URL('paired-intervals.md', dir), md.join('\n'));
console.log('PAIRED_INTERVALS_OK');
