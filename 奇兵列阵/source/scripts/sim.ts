// v0.8 整局无头模拟（S1）：3 章 × 9 节点。启发式在 simlib.ts，与 S4 / 首领探针共用。
// SEEDS=300 默认；轮换 13 名主将。DUMP_BOSS=文件 时把每场首领战的阵容存成 JSON（boss-probe 用）。
declare const process: { env: Record<string, string | undefined>; exit(code: number): never };
// @ts-expect-error Node host module; the browser project does not install @types/node.
import { writeFileSync } from 'node:fs';
import { GENERALS, unitDef } from '../src/core/data';
import { TOTAL_BATTLES } from '../src/core/route';
import { battleNo } from '../src/core/run';
import type { BattleSetup } from '../src/core/engine';
import { playRun } from './simlib';

const SEEDS = Number(process.env.SEEDS ?? 300);
const DUMP = process.env.DUMP_BOSS;
const dumped: { general: string; node: string; chapter: number; result: string; setup: BattleSetup }[] = [];

interface Stat { n: number; win: number; draw: number; beats: number; timeout: number; name: string }
const stage: Stat[] = Array.from({ length: TOTAL_BATTLES }, () => ({ n: 0, win: 0, draw: 0, beats: 0, timeout: 0, name: '' }));
const gens: Record<string, { runs: number; wins: number; clears: number }> = {};
const trig: Record<string, { battles: number; fires: number; wins: number }> = {};
const nodes: Record<string, { n: number; win: number }> = {};
let battles = 0, faults = 0, runs = 0, clears = 0, winsTotal = 0;

for (let s = 0; s < SEEDS; s++) {
  const g = GENERALS[s % GENERALS.length].id;
  const run = playRun({
    general: g, seed: 1000 + s * 7919,
    onBattle: (r, setup, out, node) => {
      const b = battleNo(r);
      battles++;
      if (out.fault) faults++;
      const S = stage[b]; S.n++; S.beats += out.beats; S.name ||= `${r.chapter + 1}-${r.node + 1}`;
      if (out.result === 'win') S.win++;
      const N = (nodes[`${r.chapter + 1}-${r.node + 1} ${node.name}`] ??= { n: 0, win: 0 }); N.n++; if (out.result === 'win') N.win++;
      if (out.beats >= 60) S.timeout++;
      if (out.result === 'draw') S.draw++;
      for (const id of new Set(r.slots.filter(Boolean).map(u => u!.defId))) {
        const t = (trig[id] ??= { battles: 0, fires: 0, wins: 0 });
        t.battles++; if (out.result === 'win') t.wins++; t.fires += out.triggers?.[id] ?? 0;
      }
      if (DUMP && node.kind === 'boss') dumped.push({ general: g, node: node.name, chapter: r.chapter + 1, result: out.result, setup });
    },
  });
  const r = run.r;
  runs++; winsTotal += r.wins;
  if (r.over === 'victory') clears++;
  const G = (gens[g] ??= { runs: 0, wins: 0, clears: 0 }); G.runs++; G.wins += r.wins; if (r.over === 'victory') G.clears++;
}
if (DUMP) writeFileSync(DUMP, JSON.stringify(dumped));

const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) + '%' : '-');
console.log(`局数 ${runs}，战斗 ${battles}，fault ${faults}，平均胜场 ${(winsTotal / runs).toFixed(2)}/${TOTAL_BATTLES}，通关率 ${pct(clears, runs)}`);
console.log('\n战  节点  场次  胜率   平局  平均拍');
stage.forEach((S, i) => console.log(`${String(i + 1).padStart(2)} ${S.name.padEnd(5)} ${String(S.n).padStart(5)} ${pct(S.win, S.n).padStart(6)} ${pct(S.draw, S.n).padStart(6)} ${(S.beats / (S.n || 1)).toFixed(1)}`));
console.log('\n节点胜率：\n' + Object.entries(nodes).sort().map(([k, N]) => `  ${k} ${pct(N.win, N.n)}(${N.n})`).join('\n'));
console.log('\n主将     平均胜场  通关率');
for (const [k, G] of Object.entries(gens)) console.log(`${k.padEnd(8)} ${(G.wins / G.runs).toFixed(2).padStart(6)}  ${pct(G.clears, G.runs)}`);
console.log('\n卡牌　　　　 每场触发 上场胜率 (上场数)');
Object.entries(trig).filter(([, t]) => t.battles >= 50).sort((a, b) => b[1].wins / b[1].battles - a[1].wins / a[1].battles).slice(0, 40)
  .forEach(([id, t]) => console.log(`${unitDef(id).name.padEnd(6, '　')} ${(t.fires / t.battles).toFixed(2).padStart(6)}  ${pct(t.wins, t.battles).padStart(6)}  (${t.battles})`));
const silent = Object.entries(trig).filter(([id, t]) => t.battles >= 30 && t.fires === 0 && !!(unitDef(id).cast || unitDef(id).chargeSkill || unitDef(id).chargeAttack || unitDef(id).onKill || unitDef(id).onRear || unitDef(id).onFront || unitDef(id).onRattle));
console.log('\n上场 ≥30 次但能力从未触发：' + (silent.length ? silent.map(([id, t]) => `${unitDef(id).name}(${t.battles})`).join('、') : '无'));
if (process.env.CARDS) for (const id of process.env.CARDS.split(',')) { const t = trig[id]; console.log(`${id} ${unitDef(id).name} 上场 ${t?.battles ?? 0} 每场触发 ${t ? (t.fires / t.battles).toFixed(2) : '-'}`); }
