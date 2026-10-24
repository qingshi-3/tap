// 平衡工具。
//   npm run sim -- ghosts [人口] [lo] [hi]  ：bot 人口互打（异步幽灵），生成 src/core/ghosts.json
//   npm run sim -- [局数] [skill]           ：bot 正常打局，看每回合胜率、通关率、强度曲线
// @ts-ignore node 内置模块，脚本只在 vite-node 下跑
import { writeFileSync } from 'node:fs';
import { card } from '../src/core/data';
import { simulate, type UnitSpec } from '../src/core/engine';
import { BOSSES } from '../src/core/data';
import { bossTeam, fight, newRun, playerTeam, settleBattle, type RunState } from '../src/core/run';
import { shopTurn } from './bot';

const argv = (globalThis as unknown as { process: { argv: string[] } }).process.argv.slice(2);
const MAX_TURN = 20;
const total = (t: UnitSpec[]) => t.reduce((s, u) => s + u.atk + u.hp, 0);
const avgUnit = (t: UnitSpec[]) => (t.length ? total(t) / t.length : 0);

if (argv[0] === 'ghosts') {
  const P = Number(argv[1] ?? 300);
  const lo = Number(argv[2] ?? 0.25);
  const hi = Number(argv[3] ?? 0.5);
  const pop = Array.from({ length: P }, (_, i) => ({ r: newRun(i * 7919 + 13), skill: 0.3 + 0.7 * ((i * 37) % P) / P }));
  const byTurn: Record<number, UnitSpec[][]> = {};
  for (let turn = 1; turn <= MAX_TURN; turn++) {
    const live = pop.filter((p) => p.r.phase === 'prep');
    if (live.length < 6) break;
    for (const p of live) shopTurn(p.r, p.skill);
    const teams = live.map((p) => playerTeam(p.r).map(({ oid: _o, ...u }) => u));
    byTurn[turn] = teams;
    live.forEach((p, i) => {
      let j = Math.floor(Math.random() * teams.length);
      if (j === i) j = (j + 1) % teams.length;
      p.r.enemy = { boss: null, units: teams[j] };
      settleBattle(p.r, fight(p.r));
    });
  }
  const out: { turns: Record<string, UnitSpec[][]>; median: Record<string, number>; bossScale: Record<string, number> } = { turns: {}, median: {}, bossScale: {} };
  const mids: Record<string, UnitSpec[][]> = {};
  for (const [t, teams] of Object.entries(byTurn)) {
    const scored = teams.map((team) => {
      let s = 0;
      for (let k = 0; k < 40; k++) {
        const res = simulate(team, teams[Math.floor(Math.random() * teams.length)], k + 1).result;
        s += res === 'win' ? 1 : res === 'draw' ? 0.5 : 0;
      }
      return { team, s: s / 40 };
    }).sort((a, b) => a.s - b.s);
    const n = scored.length;
    const mid = scored.slice(Math.floor(n * 0.4), Math.ceil(n * 0.6));
    mids[t] = mid.map((x) => x.team);
    out.median[t] = Math.round(mid.reduce((s, x) => s + total(x.team), 0) / Math.max(1, mid.length));
    // 后期人口只剩强者（幸存者偏差），档位往下挪
    const [l2, h2] = Number(t) >= 10 ? [0, hi - lo] : [lo, hi];
    const band = scored.slice(Math.floor(n * l2), Math.max(Math.floor(n * l2) + 1, Math.ceil(n * h2)));
    out.turns[t] = band.filter((_, i) => i % Math.max(1, Math.floor(band.length / 30)) === 0).slice(0, 30).map((x) => x.team);
    console.log(`回合${t}: 人口 ${n}  中位总攻血 ${out.median[t]}  单位均值 ${(mid.reduce((s, x) => s + avgUnit(x.team), 0) / Math.max(1, mid.length)).toFixed(1)}  幽灵 ${out.turns[t].length}`);
  }
  // Boss 机制校准：中位阵容打 ×1.0 Boss 胜率约 60%
  for (const [key, turn] of [['wall', 4], ['tide', 8], ['wheel', 12], ['final', 11]] as const) {
    const teams = mids[turn] ?? [];
    if (!teams.length) continue;
    let a = 0.2;
    let b = 3;
    for (let it = 0; it < 14; it++) {
      const k = (a + b) / 2;
      const boss = bossTeamWith(key, turn, k, out.median[turn]);
      let w = 0;
      teams.forEach((team, i) => {
        for (let s = 0; s < 4; s++) {
          const res = simulate(team, boss, i * 4 + s + 1).result;
          w += res === 'win' ? 1 : res === 'draw' ? 0.5 : 0;
        }
      });
      if (w / (teams.length * 4) > (key === 'wheel' ? 0.8 : 0.6)) a = k;
      else b = k;
    }
    out.bossScale[key] = Math.round(((a + b) / 2) * 100) / 100;
    console.log(`Boss ${key}: 校准系数 ${out.bossScale[key]}`);
  }
  writeFileSync(new URL('../src/core/ghosts.json', import.meta.url), JSON.stringify(out));
} else {
  const N = Number(argv[0] ?? 400);
  const skill = Number(argv[1] ?? 0.65);
  const tries = Array(MAX_TURN + 2).fill(0);
  const wins = Array(MAX_TURN + 2).fill(0);
  const unitAvg = Array(MAX_TURN + 2).fill(0);
  const topU = Array(MAX_TURN + 2).fill(0);
  const boss: Record<string, [number, number]> = {};
  let cleared = 0;
  let livesLeft = 0;
  let turnsSum = 0;
  const used = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    const r: RunState = newRun(i * 104729 + 7);
    while (r.phase === 'prep' && r.turn <= MAX_TURN) {
      shopTurn(r, skill);
      const t = r.turn;
      unitAvg[t] += avgUnit(playerTeam(r));
      topU[t] += Math.max(0, ...playerTeam(r).map((u) => u.atk + u.hp));
      const out = fight(r);
      tries[t]++;
      if (out.result === 'win') wins[t]++;
      if (r.enemy.boss) {
        const b = (boss[r.enemy.boss] ??= [0, 0]);
        b[1]++;
        if (out.result === 'win') b[0]++;
      }
      settleBattle(r, out);
    }
    turnsSum += r.turn;
    if (r.phase === 'won') {
      cleared++;
      livesLeft += r.lives;
      r.queue.forEach((o) => o && used.set(o.def, (used.get(o.def) ?? 0) + 1));
    }
  }
  console.log(`通关 ${((cleared / N) * 100).toFixed(1)}%  通关剩心 ${(livesLeft / Math.max(1, cleared)).toFixed(1)}  平均回合 ${(turnsSum / N).toFixed(1)}`);
  for (let t = 1; t <= MAX_TURN; t++) if (tries[t]) console.log(`回合${t}: ${tries[t]} 场  胜率 ${((wins[t] / tries[t]) * 100).toFixed(0)}%  单位均值 ${(unitAvg[t] / tries[t]).toFixed(1)}  最强 ${(topU[t] / tries[t]).toFixed(1)}`);
  console.log('Boss', Object.entries(boss).map(([k, [w, n]]) => `${k} ${((w / n) * 100).toFixed(0)}%(${n})`).join('  '));
  console.log([...used].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([d, n]) => `${card(d).name}${n}`).join(' '));
}

function bossTeamWith(key: keyof typeof BOSSES, turn: number, k: number, median: number): UnitSpec[] {
  const base = bossTeam(BOSSES[key], turn, 1, 1);
  const sum = base.reduce((s, u) => s + u.atk + u.hp, 0);
  const f = (median * k) / sum;
  return base.map((u) => ({ ...u, atk: Math.max(1, Math.min(50, Math.round(u.atk * f))), hp: Math.max(1, Math.min(50, Math.round(u.hp * f))) }));
}
