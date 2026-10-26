// @ts-ignore node builtins
import { readFileSync, writeFileSync } from 'node:fs';

const base = JSON.parse(readFileSync(new URL('../../output/final-hurt-boss/baseline.json', import.meta.url), 'utf8'));
const cand = JSON.parse(readFileSync(new URL('../../output/final-hurt-boss/candidate.json', import.meta.url), 'utf8'));
if (base.config.nPerGroup !== cand.config.nPerGroup) throw new Error('N differs');
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const preShape = (e: any) => ({ turn: e.turn, result: e.result, boss: e.boss, before: e.before,
  relics: e.relics, ownedTeam: e.ownedTeam, combatTeam: e.combatTeam, enemyTeam: e.enemyTeam,
  authoredEncounter: e.authoredEncounter });
const firstFinal = (r: any) => r.encounters.findIndex((e: any) => e.boss === 'final');
function paired95(values: number[]) {
  const n = values.length;
  const mean = n ? values.reduce((s, x) => s + x, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  const half = n ? 1.959963984540054 * sd / Math.sqrt(n) : 0;
  return { n, delta: mean, ci95: [mean - half, mean + half] };
}
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))];

let assertedPairs = 0;
const groups = base.groups.map((bg: any, gi: number) => {
  const cg = cand.groups[gi];
  if (bg.group.id !== cg.group.id) throw new Error(`Group mismatch at ${gi}`);
  const pairs = bg.runs.map((br: any, i: number) => {
    const cr = cg.runs[i];
    if (br.seed !== cr.seed) throw new Error(`${bg.group.id}/${i}: seed mismatch`);
    const bi = firstFinal(br), ci = firstFinal(cr);
    if (bi !== ci) throw new Error(`${bg.group.id}/${br.seed}: first-final boundary differs ${bi}/${ci}`);
    const bpre = br.encounters.slice(0, bi < 0 ? undefined : bi).map(preShape);
    const cpre = cr.encounters.slice(0, ci < 0 ? undefined : ci).map(preShape);
    if (!same(bpre, cpre)) throw new Error(`${bg.group.id}/${br.seed}: pre-final battle trajectory differs`);
    if (bi >= 0) {
      const bf = br.encounters[bi], cf = cr.encounters[ci];
      const playerEntry = (e: any) => ({ turn: e.turn, before: e.before, relics: e.relics, ownedTeam: e.ownedTeam, combatTeam: e.combatTeam });
      if (!same(playerEntry(bf), playerEntry(cf))) throw new Error(`${bg.group.id}/${br.seed}: first-final player entry differs`);
    }
    assertedPairs++;
    return { br, cr };
  });
  const reachedBoth = pairs.filter(({ br, cr }: any) => br.reachedFinalBoss && cr.reachedFinalBoss);
  const failedBoth = reachedBoth.filter(({ br, cr }: any) => !br.firstFinalBossWin && !cr.firstFinalBossWin);
  return { group: bg.group, baseline: bg.summary, candidate: cg.summary,
    paired: {
      clearRate: paired95(pairs.map(({ br, cr }: any) => Number(cr.cleared) - Number(br.cleared))),
      reachFinalBossRate: paired95(pairs.map(({ br, cr }: any) => Number(cr.reachedFinalBoss) - Number(br.reachedFinalBoss))),
      firstFinalBossWinRateAmongBothReached: paired95(reachedBoth.map(({ br, cr }: any) => Number(cr.firstFinalBossWin) - Number(br.firstFinalBossWin))),
      finalBossAttemptsPerRun: paired95(pairs.map(({ br, cr }: any) => cr.finalBossAttempts - br.finalBossAttempts)),
      retryClearRateAmongBothFirstFailed: paired95(failedBoth.map(({ br, cr }: any) => Number(cr.cleared) - Number(br.cleared))),
    } };
});
function aggregate(groupIndexes: number[]) {
  const pairs = groupIndexes.flatMap((gi) => base.groups[gi].runs.map((br: any, i: number) => ({ br, cr: cand.groups[gi].runs[i] })));
  const raw = (side: 'br' | 'cr') => {
    const rs = pairs.map((p: any) => p[side]);
    const reached = rs.filter((r: any) => r.reachedFinalBoss);
    const failed = reached.filter((r: any) => !r.firstFinalBossWin);
    return { runs: rs.length, clearRate: rs.filter((r: any) => r.cleared).length / rs.length,
      reachRate: reached.length / rs.length,
      firstFinalBossWinRate: reached.filter((r: any) => r.firstFinalBossWin).length / reached.length,
      finalBossAttempts: reached.reduce((s: number, r: any) => s + r.finalBossAttempts, 0),
      retryClearRateAmongFirstFailures: failed.length ? failed.filter((r: any) => r.cleared).length / failed.length : 0 };
  };
  type Metric = 'clear' | 'reach' | 'first' | 'attempts' | 'retry';
  const stat = (ps: any[], metric: Metric) => {
    const rate = (side: 'br' | 'cr') => {
      const rs = ps.map((p: any) => p[side]);
      if (metric === 'clear') return rs.filter((r: any) => r.cleared).length / rs.length;
      if (metric === 'reach') return rs.filter((r: any) => r.reachedFinalBoss).length / rs.length;
      if (metric === 'attempts') return rs.reduce((s: number, r: any) => s + r.finalBossAttempts, 0) / rs.length;
      if (metric === 'first') { const d = rs.filter((r: any) => r.reachedFinalBoss); return d.length ? d.filter((r: any) => r.firstFinalBossWin).length / d.length : 0; }
      const d = rs.filter((r: any) => r.reachedFinalBoss && !r.firstFinalBossWin);
      return d.length ? d.filter((r: any) => r.cleared).length / d.length : 0;
    };
    return rate('cr') - rate('br');
  };
  const clustered = (metric: Metric) => {
    const random = mulberry32(0x51f15e ^ groupIndexes.reduce((s, x) => s * 31 + x, 0) ^ metric.length);
    const reps: number[] = [];
    for (let b = 0; b < 20000; b++) {
      const sampled: any[] = [];
      for (let k = 0; k < base.config.nPerGroup; k++) {
        const index = Math.floor(random() * base.config.nPerGroup);
        for (const gi of groupIndexes) sampled.push({ br: base.groups[gi].runs[index], cr: cand.groups[gi].runs[index] });
      }
      reps.push(stat(sampled, metric));
    }
    reps.sort((a, b) => a - b);
    return { nClusters: base.config.nPerGroup, delta: stat(pairs, metric), ci95: [percentile(reps, 0.025), percentile(reps, 0.975)] };
  };
  return { baseline: raw('br'), candidate: raw('cr'), paired: {
    clearRate: clustered('clear'), reachFinalBossRate: clustered('reach'),
    firstFinalBossWinRate: clustered('first'), finalBossAttemptsPerRun: clustered('attempts'),
    retryClearRateAmongFirstFailures: clustered('retry'),
  } };
}
const output = { schemaVersion: 1, generatedAt: new Date().toISOString(), assertedPreFinalPairs: assertedPairs,
  intervalMethod: 'Per-group intervals use normal 95% CI of same-seed paired differences. Six-group hard and all-group aggregates use 20,000 deterministic cluster-bootstrap resamples of the 200 shared seed indexes; every resample carries all selected groups for that seed. Conditional first-Boss and retry metrics recompute numerator and denominator inside each resample.',
  caveat: 'Heuristic-bot results, not human-player estimates.',
  aggregates: { hard: aggregate([0, 1, 2, 3, 4, 5]), all: aggregate([0, 1, 2, 3, 4, 5, 6]) }, groups };
writeFileSync(new URL('../../output/final-hurt-boss/comparison.json', import.meta.url), JSON.stringify(output, null, 2));
console.log(`paired pre-final assertions passed: ${assertedPairs}`);
for (const g of groups) console.log(`${g.group.id}: clear delta=${(g.paired.clearRate.delta * 100).toFixed(1)}pp, first-final delta=${(g.paired.firstFinalBossWinRateAmongBothReached.delta * 100).toFixed(1)}pp`);
