// Final v4 candidate-B paired intervals and stage-pressure summary.
// @ts-ignore node builtin
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../../output/balance-v4/', import.meta.url);
const baseline = JSON.parse(readFileSync(new URL('baseline.json', dir), 'utf8'));
const candidateA = JSON.parse(readFileSync(new URL('candidate-a.json', dir), 'utf8'));
const candidateB = JSON.parse(readFileSync(new URL('after.json', dir), 'utf8'));
const REPS = 20_000;
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
function percentile(xs: number[], p: number) { const at = (xs.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at); return xs[lo] + (xs[hi] - xs[lo]) * (at - lo); }
function paired(from: any, to: any, seed: number) {
  const clear: number[] = [], turn: number[] = [];
  for (let i = 0; i < from.runs.length; i++) { if (from.runs[i].seed !== to.runs[i].seed) throw new Error(`seed mismatch ${from.group.id} ${i}`); clear.push(+to.runs[i].cleared - +from.runs[i].cleared); turn.push(to.runs[i].terminalTurn - from.runs[i].terminalTurn); }
  const random = rng(seed), cb: number[] = [], tb: number[] = [];
  for (let rep = 0; rep < REPS; rep++) { let c = 0, t = 0; for (let i = 0; i < clear.length; i++) { const j = Math.floor(random() * clear.length); c += clear[j]; t += turn[j]; } cb.push(c / clear.length); tb.push(t / turn.length); }
  cb.sort((a, b) => a - b); tb.sort((a, b) => a - b);
  return { clearRateDelta: mean(clear), clearRateDelta95: [percentile(cb, .025), percentile(cb, .975)], terminalTurnDelta: mean(turn), terminalTurnDelta95: [percentile(tb, .025), percentile(tb, .975)] };
}
function compare(from: any, to: any, seed: number) { return from.groups.map((g: any, i: number) => ({ group: g.group.id, ...paired(g, to.groups.find((x: any) => x.group.id === g.group.id), seed + i * 7919) })); }
const stages = candidateB.groups.map((bg: any) => {
  const base = baseline.groups.find((x: any) => x.group.id === bg.group.id);
  const a = candidateA.groups.find((x: any) => x.group.id === bg.group.id);
  return { group: bg.group.id, stages: bg.summary.stages.map((s: any) => ({ stage: s.stage,
    baseline: base.summary.stages.find((x: any) => x.stage === s.stage).winRate,
    candidateA: a.summary.stages.find((x: any) => x.stage === s.stage).winRate, candidateB: s.winRate })),
    authoredRateA: a.summary.t9PlusCoverage.authoredEncounterRate, authoredRateB: bg.summary.t9PlusCoverage.authoredEncounterRate };
});
const out = { schemaVersion: 1, reps: REPS, candidateBVsBaseline: compare(baseline, candidateB, 0xb4000001), candidateBVsA: compare(candidateA, candidateB, 0xb4000002), stages };
writeFileSync(new URL('candidate-b-intervals.json', dir), JSON.stringify(out, null, 2));
const pp = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} pp`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const num = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`;
const table = (title: string, rows: any[]) => ['## ' + title, '', '| Group | Clear-rate delta (paired 95% CI) | Terminal-turn delta (paired 95% CI) |', '|---|---:|---:|', ...rows.map((x) => `| ${x.group} | ${pp(x.clearRateDelta)} [${pp(x.clearRateDelta95[0])}, ${pp(x.clearRateDelta95[1])}] | ${num(x.terminalTurnDelta)} [${num(x.terminalTurnDelta95[0])}, ${num(x.terminalTurnDelta95[1])}] |`), ''];
const md = ['# Balance v4 candidate B', '', '80 matched seeds per group; 20,000 deterministic paired bootstrap resamples.', '', ...table('Candidate B versus frozen baseline', out.candidateBVsBaseline), ...table('Candidate B versus candidate A', out.candidateBVsA),
  '## Stage battle win rates and authored coverage', '', '| Group | Early baseline→B | Mid baseline→B | Late baseline→B | T9+ authored A→B |', '|---|---:|---:|---:|---:|',
  ...stages.map((x: any) => `| ${x.group} | ${pct(x.stages[0].baseline)}→${pct(x.stages[0].candidateB)} | ${pct(x.stages[1].baseline)}→${pct(x.stages[1].candidateB)} | ${pct(x.stages[2].baseline)}→${pct(x.stages[2].candidateB)} | ${pct(x.authoredRateA)}→${pct(x.authoredRateB)} |`), '',
  'Early is T1–4, mid T5–10, late T11+. Stage rates are encounter win rates among reached battles, so later stages have survivor-composition bias.', ''];
writeFileSync(new URL('candidate-b-intervals.md', dir), md.join('\n'));
console.log('BALANCE_V4_CANDIDATE_B_INTERVALS_OK');
