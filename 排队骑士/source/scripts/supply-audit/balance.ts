// 补给专项平衡基线。只读游戏数据，不生成幽灵，也不修改任何校准参数。
// 用法：node_modules/.bin/vite-node.cmd scripts/supply-audit/balance.ts <label> <N>
// @ts-ignore node 内置模块，脚本只在 vite-node 下运行
import { mkdirSync, writeFileSync } from 'node:fs';
// @ts-ignore node 内置模块，脚本只在 vite-node 下运行
import { execFileSync } from 'node:child_process';
import { fight, newRun, playerTeam, settleBattle, type RunState } from '../../src/core/run';
import type { Line } from '../../src/core/data';
import { shopTurn } from '../bot';

type StageId = 'early' | 'mid' | 'late';
type Strategy = 'strong' | 'mixed';
type GroupSpec = { id: string; strategy: Strategy; line?: Line };
type Encounter = { turn: number; stage: StageId; result: 'win' | 'lose' | 'draw'; atk: number; hp: number; units: number };
type RunResult = {
  index: number;
  seed: number;
  randomSeed: number;
  strategySeed: number;
  terminalPhase: RunState['phase'];
  terminalTurn: number;
  cleared: boolean;
  hitTurnCap: boolean;
  encounters: Encounter[];
};

const groups: GroupSpec[] = [
  { id: 'global-strong', strategy: 'strong' },
  { id: 'global-mixed', strategy: 'mixed' },
  { id: 'food', strategy: 'strong', line: 'food' },
  { id: 'death', strategy: 'strong', line: 'death' },
  { id: 'hurt', strategy: 'strong', line: 'hurt' },
  { id: 'start', strategy: 'strong', line: 'start' },
  { id: 'grow', strategy: 'strong', line: 'grow' },
];
const MAX_TURN = 40;
const args = (globalThis as unknown as { process: { argv: string[]; cwd(): string } }).process.argv.slice(2);
const label = (args[0] ?? 'baseline').replace(/[^a-zA-Z0-9._-]+/g, '-');
const N = Number(args[1] ?? 300);
if (!Number.isInteger(N) || N <= 0) throw new Error(`N 必须是正整数，收到 ${args[1] ?? ''}`);

/** 轻量、稳定、跨平台的 32 位确定 PRNG。 */
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

const stageOf = (turn: number): StageId => turn <= 4 ? 'early' : turn <= 10 ? 'mid' : 'late';
const sumStats = (r: RunState) => playerTeam(r).reduce((s, u) => ({ atk: s.atk + u.atk, hp: s.hp + u.hp, units: s.units + 1 }), { atk: 0, hp: 0, units: 0 });
const winScore = (result: Encounter['result']) => result === 'win' ? 1 : 0;

function wilson95(successes: number, total: number): [number, number] {
  if (!total) return [0, 0];
  const z = 1.959963984540054;
  const p = successes / total;
  const den = 1 + z * z / total;
  const mid = (p + z * z / (2 * total)) / den;
  const half = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / den;
  return [mid - half, mid + half];
}

function play(spec: GroupSpec, index: number): RunResult {
  const seed = index * 104729 + 11;
  // Math.random 与策略抽样分流：改变 mixed 抽样不会扰动 bot 的随机序列。
  const randomSeed = (seed ^ 0xa341316c) >>> 0;
  const strategySeed = (seed ^ 0xc8013ea4) >>> 0;
  const botRandom = mulberry32(randomSeed);
  const strategyRandom = mulberry32(strategySeed);
  const originalRandom = Math.random;
  const encounters: Encounter[] = [];
  let r: RunState;
  Math.random = botRandom;
  try {
    r = newRun(seed, { diff: 0 });
    while (r.phase === 'prep' && r.turn <= MAX_TURN) {
      const skill = spec.strategy === 'mixed' && strategyRandom() < 0.3 ? -0.01 : 1;
      shopTurn(r, skill, spec.line);
      const stats = sumStats(r);
      const turn = r.turn;
      const out = fight(r);
      encounters.push({ turn, stage: stageOf(turn), result: out.result, ...stats });
      settleBattle(r, out);
    }
  } finally {
    Math.random = originalRandom;
  }
  return {
    index, seed, randomSeed, strategySeed,
    terminalPhase: r!.phase,
    terminalTurn: r!.turn,
    cleared: r!.phase === 'won',
    hitTurnCap: r!.phase === 'prep' && r!.turn > MAX_TURN,
    encounters,
  };
}

function summarize(runs: RunResult[]) {
  const cleared = runs.filter((r) => r.cleared).length;
  const stages = (['early', 'mid', 'late'] as StageId[]).map((stage) => {
    const reachedRuns = runs.filter((r) => r.encounters.some((e) => e.stage === stage)).length;
    const es = runs.flatMap((r) => r.encounters.filter((e) => e.stage === stage));
    const wins = es.reduce((s, e) => s + winScore(e.result), 0);
    return {
      stage,
      turns: stage === 'early' ? '1-4' : stage === 'mid' ? '5-10' : '11+',
      reachedRuns,
      encounters: es.length,
      wins,
      winRate: es.length ? wins / es.length : 0,
      draws: es.filter((e) => e.result === 'draw').length,
      avgAtk: es.length ? es.reduce((s, e) => s + e.atk, 0) / es.length : 0,
      avgHp: es.length ? es.reduce((s, e) => s + e.hp, 0) / es.length : 0,
      avgUnits: es.length ? es.reduce((s, e) => s + e.units, 0) / es.length : 0,
    };
  });
  return {
    runs: runs.length,
    cleared,
    clearRate: cleared / runs.length,
    clearWilson95: wilson95(cleared, runs.length),
    avgTerminalTurn: runs.reduce((s, r) => s + r.terminalTurn, 0) / runs.length,
    hitTurnCap: runs.filter((r) => r.hitTurnCap).length,
    stages,
  };
}

const started = Date.now();
const head = (() => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: new URL('../../../', import.meta.url), encoding: 'utf8' }).trim(); }
  catch { return 'unavailable'; }
})();
const results = groups.map((group) => {
  const t0 = Date.now();
  const runs = Array.from({ length: N }, (_, i) => play(group, i));
  const summary = summarize(runs);
  const elapsedMs = Date.now() - t0;
  console.log(`${group.id}: N=${N} clear=${(summary.clearRate * 100).toFixed(1)}% CI=[${summary.clearWilson95.map((x) => (x * 100).toFixed(1)).join(', ')}]% avgTurn=${summary.avgTerminalTurn.toFixed(2)} cap=${summary.hitTurnCap} ${(elapsedMs / 1000).toFixed(1)}s`);
  return { group, elapsedMs, summary, runs };
});
const output = {
  schemaVersion: 1,
  label,
  generatedAt: new Date().toISOString(),
  sourceHead: head,
  config: {
    nPerGroup: N,
    maxTurn: MAX_TURN,
    difficulty: 0,
    seedFormula: 'i * 104729 + 11',
    random: 'mulberry32(seed ^ 0xa341316c), injected into Math.random per run and restored in finally',
    mixedStrategy: 'independent mulberry32(seed ^ 0xc8013ea4); each turn 30% skill=-0.01, otherwise skill=1',
    stages: { early: '1-4', mid: '5-10', late: '11+' },
    note: '阶段攻血与胜率只统计实际到达该阶段的对局，后期数值含幸存者偏差；runs 保留配对复算所需逐局结果。',
  },
  elapsedMs: Date.now() - started,
  groups: results,
};
const dir = new URL('../../output/supply-audit/', import.meta.url);
mkdirSync(dir, { recursive: true });
const file = new URL(`baseline-${label}.json`, dir);
writeFileSync(file, JSON.stringify(output, null, 2));
console.log(`saved ${file.pathname} total=${(output.elapsedMs / 1000).toFixed(1)}s head=${head}`);
