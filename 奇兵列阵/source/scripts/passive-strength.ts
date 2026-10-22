// S4: 被动强度（force vs ban，同种子配对）。
// 每个专属被动跑 SEEDS 局：force＝第一次晋升必拿该被动；ban＝整局不拿（换成该主将其他专属）。
// 第一次晋升前两臂完全相同，只统计到达晋升的局：Δ晋升后胜场、Δ通关率。
// SEEDS=200 默认；SHARD=i/n 按主将分片并行；输出 TSV 行，汇总用 PASSIVE_TSV=文件1,文件2… 运行 summarize。
declare const process: { env: Record<string, string | undefined> };
import { GENERALS } from '../src/core/data';
import { PASSIVES } from '../src/core/content';
import { playRun } from './simlib';

const SEEDS = Number(process.env.SEEDS ?? 200);
const ONLY = process.env.ONLY?.split(',');
const [si, sn] = (process.env.SHARD ?? '0/1').split('/').map(Number);
const gens = GENERALS.map(g => g.id).filter((_, i) => i % sn === si);

for (const g of gens) {
  for (const p of PASSIVES.filter(x => x.general === g && (!ONLY || ONLY.includes(x.id)))) {
    let n = 0, dWins = 0, fClear = 0, bClear = 0, fWins = 0, bWins = 0;
    for (let s = 0; s < SEEDS; s++) {
      const seed = 9000 + s * 7;
      const f = playRun({ general: g, seed, forcePassive: p.id });
      if (!f.reachedPromo) continue;
      const b = playRun({ general: g, seed, banPassive: p.id });
      n++; fWins += f.winsAfterPromo; bWins += b.winsAfterPromo; dWins += f.winsAfterPromo - b.winsAfterPromo;
      fClear += f.clear ? 1 : 0; bClear += b.clear ? 1 : 0;
    }
    const pct = (x: number) => (n ? (100 * x / n).toFixed(1) : '-');
    console.log([g, p.id, p.name, n, (fWins / (n || 1)).toFixed(2), (bWins / (n || 1)).toFixed(2), (dWins / (n || 1)).toFixed(2), pct(fClear), pct(bClear), n ? (100 * (fClear - bClear) / n).toFixed(1) : '-'].join('\t'));
  }
}
