// 敌人强度校准（DESIGN-v0.4 §4：三档全部来自真实商店对局）。
//   npm run calib                 ：受伤引擎 bot 的满/中/低三档，二分每回合 k_r 与 Boss 系数，写回 src/core/ghosts.json
//   npm run calib -- engines [N]  ：用已写入的系数，打印各引擎满/中档对普通敌人的胜率
//   npm run calib -- runs N mix0.5 [hurt,mix]：各引擎 bot + 混搭 bot 打整局，看通关率差距（引擎平衡验收）
// @ts-ignore node 内置模块，脚本只在 vite-node 下跑
import { writeFileSync } from 'node:fs';
import { BOSSES, LINES, type Line } from '../src/core/data';
import { simulate, type UnitSpec } from '../src/core/engine';
import { DIFFS, setEquipK, BOSS_TURNS, bossTeam, fight, settleBattle, GHOSTS, ghostPool, newRun, playerTeam, scaleTeam, type BossKey } from '../src/core/run';
import { shopTurn } from './bot';

const EK = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.EK;
if (EK) setEquipK(Number(EK));
const DK = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.DK;
const DIFF = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.DIFF;
if (DK) DIFFS[Number(DIFF ?? 0)].k = Number(DK);
const argv = (globalThis as unknown as { process: { argv: string[] } }).process.argv.slice(2);
const TURNS = 22;
const VARIANTS = 20;
const FINAL_TURNS = [14, 15, 16, 17, 18, 19, 20, 21, 22];
const ENGINES = LINES.filter((l) => l !== 'any');
const SLOPPY = -0.01;
type Tier = 'full' | 'mid' | 'low';
type Tiers = Record<number, Record<Tier, UnitSpec[][]>>;

/** bot 用真实商店打 N 局，记录每回合开战阵容。不让局提前结束（心和胜场不计），后期没有幸存者偏差 */
function snapshots(N: number, skill: number, engine: Line | undefined, seed: number) {
  const by: Record<number, UnitSpec[][]> = {};
  for (let i = 0; i < N; i++) {
    const r = newRun(seed + i * 7919);
    for (let t = 1; t <= TURNS; t++) {
      shopTurn(r, skill, engine);
      (by[t] ??= []).push(playerTeam(r).map(({ oid: _o, ...u }) => u));
      const out = fight(r);
      r.lives = 99;
      r.wins = 0;
      settleBattle(r, out);
    }
  }
  return by;
}
/** 按对未缩放幽灵的胜率排序后均匀取 VARIANTS 个 */
function strengthSort(teams: UnitSpec[][], R: number) {
  const foes = ghostPool(R).filter((_, i) => i % 2 === 0);
  return teams.map((t, i) => ({ t, s: rateVs([t], foes) + i * 1e-9 })).sort((a, b) => a.s - b.s).map((x) => x.t);
}
const spread = (a: UnitSpec[][]) => Array.from({ length: Math.min(VARIANTS, a.length) }, (_, i) => a[Math.floor((i * a.length) / Math.min(VARIANTS, a.length))]);
/** 满档 = 前 10%；中档 = 中位数附近（45%～55%）；低档 = 随手玩 bot 均匀取样 */
function tiersOf(engine: Line | undefined, N: number): Tiers {
  const good = snapshots(N, 1, engine, 11);
  const bad = snapshots(Math.max(VARIANTS, N / 2), SLOPPY, engine, 977);
  const out: Tiers = {};
  for (let R = 1; R <= TURNS; R++) {
    const s = strengthSort(good[R], R);
    const n = s.length;
    out[R] = {
      full: spread(s.slice(Math.floor(n * 0.9))),
      mid: spread(s.slice(Math.floor(n * 0.45), Math.max(Math.floor(n * 0.45) + 1, Math.ceil(n * 0.55)))),
      low: spread(strengthSort(bad[R], R)),
    };
  }
  return out;
}

function rateVs(teams: UnitSpec[][], foes: UnitSpec[][]) {
  let w = 0;
  let n = 0;
  teams.forEach((team, i) => foes.forEach((foe, j) => {
    n++;
    if (simulate(team, foe, i * 131 + j * 7 + 1).result === 'win') w++;
  }));
  return w / Math.max(1, n);
}
const ghostRate = (teams: UnitSpec[][], R: number, k: number) => rateVs(teams, ghostPool(R).map((g) => scaleTeam(g, k)));
const bossRate = (teams: UnitSpec[][], key: BossKey, R: number, s: number) => {
  const boss = bossTeam(BOSSES[key], R, 1, s);
  return rateVs(teams, Array.from({ length: 30 }, () => boss));
};
// 中档目标：认真玩通关约 70% 对应 0.74（v0.4 初版 0.55 约 40%）
const MID = Number((globalThis as any).process?.env?.MID ?? 0.74);
function bisect(f: (k: number) => number, target = MID, lo = 0.2, hi = 4) {
  for (let it = 0; it < 14; it++) {
    const m = (lo + hi) / 2;
    if (f(m) > target) lo = m;
    else hi = m;
  }
  return Math.round(((lo + hi) / 2) * 100) / 100;
}
const pc = (x: number) => `${Math.round(x * 100)}%`.padStart(4);
const bossList = (): [BossKey, number][] => [
  ...Object.entries(BOSS_TURNS).map(([t, k]) => [k, Number(t)] as [BossKey, number]),
  ...FINAL_TURNS.map((t) => ['final', t] as [BossKey, number]),
];

if (argv[0] === 'runs') {
  // 整局验收：各引擎 bot + 混搭 bot（不指定引擎，哪个契合拿哪个）打完整局
  const N = Number(argv[1] ?? 200);
  // argv[2]：bot 水平；写成 mix0.3 表示每回合 30% 概率随手玩、其余认真玩
  const mix = argv[2]?.startsWith('mix') ? Number(argv[2].slice(3)) : -1;
  const skill = mix >= 0 ? 1 : Number(argv[2] ?? 1);
  const only = argv[3]?.split(',');
  for (const line of [undefined, ...ENGINES] as (Line | undefined)[]) {
    if (only && !only.includes(line ?? 'mix')) continue;
    let cleared = 0;
    let w = 0;
    let n = 0;
    let turns = 0;
    const bossW: Record<string, [number, number]> = {};
    for (let i = 0; i < N; i++) {
      const r = newRun(i * 104729 + 11, { diff: Number(DIFF ?? 0) as 0 | 1 | 2 });
      while (r.phase === 'prep' && r.turn <= 40) {
        shopTurn(r, mix >= 0 && Math.random() < mix ? SLOPPY : skill, line);
        const out = fight(r);
        n++;
        if (out.result === 'win') w++;
        if (r.enemy.boss) {
          const b = (bossW[r.enemy.boss] ??= [0, 0]);
          b[1]++;
          if (out.result === 'win') b[0]++;
        }
        settleBattle(r, out);
      }
      turns += r.turn;
      if (r.phase === 'won') cleared++;
    }
    console.log(`${(line ?? '混搭').padEnd(6)} 单场 ${pc(w / n)}  通关 ${pc(cleared / N)}  平均回合 ${(turns / N).toFixed(1)}  Boss ${Object.entries(bossW).map(([k, [a, b]]) => `${k}${pc(a / b)}`).join(' ')}`);
  }
} else if (argv[0] === 'engines') {
  const N = Number(argv[1] ?? 100);
  for (const e of ENGINES) {
    const T = tiersOf(e, N);
    const row: string[] = [];
    for (let R = 2; R <= 20; R += 2) {
      const k = GHOSTS.scale?.[String(R)] ?? 1;
      row.push(`${R}:${pc(ghostRate(T[R].full, R, k))}/${pc(ghostRate(T[R].mid, R, k))}`);
    }
    console.log(`${e.padEnd(6)} 满/中 ` + row.join(' '));
  }
} else if (argv[0] !== 'lib') {
  const T = tiersOf('hurt', Number(argv[0] ?? 200));
  const scale: Record<string, number> = {};
  for (let R = 1; R <= TURNS; R++) {
    if (!ghostPool(R).length) break;
    const mid = T[R].mid;
    const lowT = T[R].low;
    // 中档定在 MID；低档超过 20% 时再抬到低档 20%（两者冲突时以低档为准，并在输出里能看出来）
    let k = bisect((k) => ghostRate(mid, R, k));
    // 前两回合随手玩和认真玩拼不出差距，低档约束最多把中档压到 45%，免得开局白丢心
    if (ghostRate(lowT, R, k) > 0.2) k = Math.max(k, Math.min(bisect((k) => ghostRate(lowT, R, k), 0.2), bisect((k) => ghostRate(mid, R, k), MID - 0.1)));
    scale[R] = k;
    const full = ghostRate(T[R].full, R, k);
    const low = ghostRate(lowT, R, k);
    const avg = mid.reduce((s, t) => s + t.reduce((a, u) => a + u.atk + u.hp, 0) / Math.max(1, t.length), 0) / mid.length;
    console.log(`回合${R}: k=${k}  满 ${pc(full)}  中 ${pc(ghostRate(mid, R, k))}  低 ${pc(low)}  中档单位均值 ${avg.toFixed(1)}`);
  }
  GHOSTS.scale = scale;
  const bossScale: Record<string, number> = {};
  for (const [key, R] of bossList()) {
    const mid = T[R].mid;
    const lowT = T[R].low;
    // Boss 阵容固定，胜率随系数呈台阶状，二分不稳；改为网格扫描，取中档最接近 MID、低档不超 20% 的系数
    let s = 1;
    let best = 1e9;
    for (let x = 0.2; x <= 3; x += 0.03) {
      const m = bossRate(mid, key, R, x);
      const score = Math.abs(m - MID) + Math.max(0, bossRate(lowT, key, R, x) - 0.2) * 0.5;
      if (score < best) [best, s] = [score, Math.round(x * 100) / 100];
    }
    bossScale[`${key}@${R}`] = s;
    console.log(`Boss ${key}@${R}: ×${s}  满 ${pc(bossRate(T[R].full, key, R, s))}  中 ${pc(bossRate(mid, key, R, s))}  低 ${pc(bossRate(lowT, key, R, s))}`);
  }
  GHOSTS.bossScale = bossScale;
  writeFileSync(new URL('../src/core/ghosts.json', import.meta.url), JSON.stringify(GHOSTS));
}
