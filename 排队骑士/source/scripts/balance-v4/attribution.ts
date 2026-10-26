// Paired same-seed attribution: v4 candidate with and without authored encounter injection.
// @ts-ignore node builtin
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../../output/balance-v4/', import.meta.url);
const baseline = JSON.parse(readFileSync(new URL('baseline.json', dir), 'utf8'));
const noAuthored = JSON.parse(readFileSync(new URL('no-authored.json', dir), 'utf8'));
const candidate = JSON.parse(readFileSync(new URL('after.json', dir), 'utf8'));
const REPS = 20_000;
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
function percentile(xs: number[], p: number) { const at = (xs.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at); return xs[lo] + (xs[hi] - xs[lo]) * (at - lo); }
function paired(from: any, to: any, seed: number) {
  const clear: number[] = [], turn: number[] = [];
  for (let i = 0; i < from.runs.length; i++) {
    if (from.runs[i].seed !== to.runs[i].seed) throw new Error(`seed mismatch ${from.group.id} ${i}`);
    clear.push(Number(to.runs[i].cleared) - Number(from.runs[i].cleared));
    turn.push(to.runs[i].terminalTurn - from.runs[i].terminalTurn);
  }
  const random = rng(seed), cb: number[] = [], tb: number[] = [];
  for (let rep = 0; rep < REPS; rep++) { let c = 0, t = 0; for (let i = 0; i < clear.length; i++) { const j = Math.floor(random() * clear.length); c += clear[j]; t += turn[j]; } cb.push(c / clear.length); tb.push(t / turn.length); }
  cb.sort((a, b) => a - b); tb.sort((a, b) => a - b);
  return { clearRateDelta: mean(clear), clearRateDelta95: [percentile(cb, .025), percentile(cb, .975)], terminalTurnDelta: mean(turn), terminalTurnDelta95: [percentile(tb, .025), percentile(tb, .975)] };
}
function compare(from: any, to: any, seed: number) { return from.groups.map((g: any, i: number) => ({ group: g.group.id, ...paired(g, to.groups.find((x: any) => x.group.id === g.group.id), seed + i * 7919) })); }
const out = { schemaVersion: 1, reps: REPS,
  newSystemsWithoutAuthoredVsBaseline: compare(baseline, noAuthored, 0x4a71b001),
  authoredInjectionVsNoAuthored: compare(noAuthored, candidate, 0x4a71b002) };
writeFileSync(new URL('attribution.json', dir), JSON.stringify(out, null, 2));
const pp = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} pp`;
const num = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`;
const table = (title: string, rows: any[]) => ['## ' + title, '', '| Group | Clear-rate delta (paired 95% CI) | Terminal-turn delta (paired 95% CI) |', '|---|---:|---:|',
  ...rows.map((x) => `| ${x.group} | ${pp(x.clearRateDelta)} [${pp(x.clearRateDelta95[0])}, ${pp(x.clearRateDelta95[1])}] | ${num(x.terminalTurnDelta)} [${num(x.terminalTurnDelta95[0])}, ${num(x.terminalTurnDelta95[1])}] |`), ''];
const md = ['# Balance v4 attribution', '', '80 matched seeds per group; paired nonparametric percentile bootstrap with 20,000 deterministic resamples.', '',
  ...table('New supply/relic/grail systems, authored injection disabled — versus frozen baseline', out.newSystemsWithoutAuthoredVsBaseline),
  ...table('Authored injection contribution — full candidate versus the same candidate with injection disabled', out.authoredInjectionVsNoAuthored),
  'The second table isolates candidate selection only: its no-authored snapshot preserves the candidate data, engine, run logic, enemy budgets/scaling/lift, ghosts, and bot.', ''];
writeFileSync(new URL('attribution.md', dir), md.join('\n'));
console.log('BALANCE_V4_ATTRIBUTION_OK');
