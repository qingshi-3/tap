// 同种子规则前后对照；baseline 使用 HEAD 固化模块，after 使用当前生产模块。
// 用法：vite-node scripts/balance-compare/run.ts baseline|after [N]
// @ts-ignore node builtin
import { mkdirSync, writeFileSync } from 'node:fs';
// @ts-ignore node builtin
import { execFileSync } from 'node:child_process';

type Stage = 'early' | 'mid' | 'late';
type Group = { id: string; diff: 0 | 1; strategy: 'strong' | 'mixed'; line?: string };
const groups: Group[] = [
  { id: 'hard-mix', diff: 1, strategy: 'strong' },
  { id: 'hard-food', diff: 1, strategy: 'strong', line: 'food' },
  { id: 'hard-hurt', diff: 1, strategy: 'strong', line: 'hurt' },
  { id: 'hard-grow', diff: 1, strategy: 'strong', line: 'grow' },
  { id: 'hard-death', diff: 1, strategy: 'strong', line: 'death' },
  { id: 'hard-start', diff: 1, strategy: 'strong', line: 'start' },
  { id: 'normal-mixed', diff: 0, strategy: 'mixed' },
];
const argv = (globalThis as any).process.argv.slice(2);
const label = argv[0];
if (label !== 'baseline' && label !== 'after') throw new Error('label 必须是 baseline 或 after');
const N = Number(argv[1] ?? 80);
if (!Number.isInteger(N) || N <= 0) throw new Error('N 必须是正整数');
const MAX_TURN = 40;

const runMod: any = label === 'baseline' ? await import('./baseline/run') : await import('../../src/core/run');
const botMod: any = label === 'baseline' ? await import('./baseline/bot') : await import('../bot');
const { newRun, playerTeam, fight, settleBattle } = runMod;
const { shopTurn } = botMod;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const stageOf = (turn: number): Stage => turn <= 4 ? 'early' : turn <= 10 ? 'mid' : 'late';
const wilson95 = (successes: number, total: number): [number, number] => {
  if (!total) return [0, 0];
  const z = 1.959963984540054, p = successes / total, den = 1 + z * z / total;
  const mid = (p + z * z / (2 * total)) / den;
  const half = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / den;
  return [mid - half, mid + half];
};

function play(group: Group, index: number) {
  const seed = index * 104729 + 11;
  const randomSeed = (seed ^ 0xa341316c) >>> 0;
  const strategySeed = (seed ^ 0xc8013ea4) >>> 0;
  const botRandom = mulberry32(randomSeed), strategyRandom = mulberry32(strategySeed);
  const originalRandom = Math.random;
  const encounters: any[] = [];
  let r: any;
  Math.random = botRandom;
  try {
    r = newRun(seed, { diff: group.diff });
    while (r.phase === 'prep' && r.turn <= MAX_TURN) {
      const skill = group.strategy === 'mixed' && strategyRandom() < 0.3 ? -0.01 : 1;
      shopTurn(r, skill, group.line);
      const us = playerTeam(r);
      const stats = us.reduce((s: any, u: any) => ({ atk: s.atk + u.atk, hp: s.hp + u.hp, units: s.units + 1 }), { atk: 0, hp: 0, units: 0 });
      const turn = r.turn, out = fight(r);
      encounters.push({ turn, stage: stageOf(turn), result: out.result, ...stats });
      settleBattle(r, out);
    }
  } finally { Math.random = originalRandom; }
  return { index, seed, randomSeed, strategySeed, terminalPhase: r.phase, terminalTurn: r.turn,
    cleared: r.phase === 'won', hitTurnCap: r.phase === 'prep' && r.turn > MAX_TURN, encounters };
}

function summarize(runs: any[]) {
  const cleared = runs.filter((r) => r.cleared).length;
  const stages = (['early', 'mid', 'late'] as Stage[]).map((stage) => {
    const es = runs.flatMap((r) => r.encounters.filter((e: any) => e.stage === stage));
    const wins = es.filter((e: any) => e.result === 'win').length;
    return { stage, turns: stage === 'early' ? '1-4' : stage === 'mid' ? '5-10' : '11+',
      reachedRuns: runs.filter((r) => r.encounters.some((e: any) => e.stage === stage)).length,
      encounters: es.length, wins, winRate: es.length ? wins / es.length : 0,
      draws: es.filter((e: any) => e.result === 'draw').length,
      avgAtk: es.length ? es.reduce((s: number, e: any) => s + e.atk, 0) / es.length : 0,
      avgHp: es.length ? es.reduce((s: number, e: any) => s + e.hp, 0) / es.length : 0,
      avgUnits: es.length ? es.reduce((s: number, e: any) => s + e.units, 0) / es.length : 0 };
  });
  return { runs: runs.length, cleared, clearRate: cleared / runs.length, clearWilson95: wilson95(cleared, runs.length),
    avgTerminalTurn: runs.reduce((s, r) => s + r.terminalTurn, 0) / runs.length,
    terminalTurnSd: Math.sqrt(runs.reduce((s, r) => s + (r.terminalTurn - runs.reduce((a, x) => a + x.terminalTurn, 0) / runs.length) ** 2, 0) / Math.max(1, runs.length - 1)),
    hitTurnCap: runs.filter((r) => r.hitTurnCap).length, stages };
}

const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: new URL('../../../', import.meta.url), encoding: 'utf8' }).trim();
const results = groups.map((group) => {
  const runs = Array.from({ length: N }, (_, i) => play(group, i));
  const summary = summarize(runs);
  console.log(`${group.id}: clear=${(summary.clearRate * 100).toFixed(1)}% avgTurn=${summary.avgTerminalTurn.toFixed(2)}`);
  return { group, summary, runs };
});
const output = { schemaVersion: 1, label, generatedAt: new Date().toISOString(), sourceHead,
  baselineSource: { commit: '88a987ddacc6a113135c3780190df950c8f7ac98', runBlob: 'd42ab1ed1360e65296b30c1f017651a62b71997f', dataBlob: '1ec278af04c4715f8bf46ec2c95a9f6f39580462', botBlob: '3e4fbae5918494b759da5b45eca22b1052c2f318', sharedEngineBlob: 'a86d6bb9e7ca96179ec3295a2385ed1905dee8ff', sharedGhostsBlob: 'aa0a1e8844f09efe99330cebb0fa9d2919d154e0' },
  config: { nPerGroup: N, maxTurn: MAX_TURN, seedFormula: 'i * 104729 + 11', stages: { early: '1-4', mid: '5-10', late: '11+' },
    strategy: 'hard groups use unchanged strong bot; normal-mixed independently chooses weak skill=-0.01 on 30% of turns; unchanged shopTurn behavior',
    limitation: '启发式 bot 沿用旧策略，未针对新补给触发上限、巨熊补货门槛或精英 lift 调整决策；结果不是人类试玩。阶段率仅含到达该阶段的局，存在幸存者偏差。' }, groups: results };
const dir = new URL('../../output/balance-compare/', import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL(`${label}.json`, dir), JSON.stringify(output, null, 2));
