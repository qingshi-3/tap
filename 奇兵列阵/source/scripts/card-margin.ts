// S3: 单卡边际胜率（真实阵容替换法）。
// 1) 跑 RUNS 局整局模拟，收集每场战斗的真实 setup（略过饱和的第 2 章普通关）；
// 2) 对每张卡 X：在每个含「同阵营、同费、非 X」可替换单位的 setup 里，把其中一个换成 X（星级/装备沿用），
//    两边都按通用站位规则重排后比胜率（各 2 个战斗种子，平局计 0.5）。不重排的话肉盾补后排也占便宜、辅助被塞前排吃亏。
// 真实阵容里出现的费用即当时可获得的费用，天然满足「只在可获得的章节测」。
// RUNS=1300、MAX_PER_CARD=600 默认；ONLY=卡id,阵营:费 只测这些（同费均值也只在其中算）。
declare const process: { env: Record<string, string | undefined>; stderr: { write(s: string): void } };
import { DRAFT_POOL, GENERALS, unitDef } from '../src/core/data';
import { simulate, type BattleSetup } from '../src/core/engine';
import type { Slotted } from '../src/core/types';
import { fieldKey, playRun } from './simlib';

const RUNS = Number(process.env.RUNS ?? 1300);
const MAX_PER_CARD = Number(process.env.MAX_PER_CARD ?? 600);
const DRAFT = new Set(DRAFT_POOL.map(d => d.id));

const setups: BattleSetup[] = [];
for (let s = 0; s < RUNS; s++) {
  playRun({
    general: GENERALS[s % GENERALS.length].id, seed: 20000 + s,
    onBattle: (_r, setup, _out, node) => {
      if (node.kind === 'normal' && setup.chapter === 2) return;
      setups.push(JSON.parse(JSON.stringify({ ...setup, record: false })));
    },
  });
}
process.stderr.write(`setups ${setups.length}\n`);

const score = (st: BattleSetup) => {
  let v = 0;
  for (const sd of [1, 2]) { const o = simulate({ ...st, seed: sd * 7717 + (st.seed ?? 0) }); v += o.result === 'win' ? 1 : o.result === 'draw' ? 0.5 : 0; }
  return v / 2;
};
const baseCache = new Map<BattleSetup, number>();
const base = (st: BattleSetup) => { let v = baseCache.get(st); if (v === undefined) { v = score(reorder(st)); baseCache.set(st, v); } return v; };
/** 按通用站位规则重排（阿尔吉昂本人固定队首）；原阵容和换卡阵容都过一遍，两边可比 */
const reorder = (st: BattleSetup): BattleSetup => {
  const units = st.player.filter(Boolean) as Slotted[];
  const lead = units.filter(u => u.defId === 'x_argeon'), rest = units.filter(u => u.defId !== 'x_argeon').sort((a, b) => fieldKey(b) - fieldKey(a));
  const player: BattleSetup['player'] = [...lead, ...rest];
  while (player.length < st.player.length) player.push(null);
  return { ...st, player };
};
const isSlot = (u: unknown): u is Slotted => !!u && typeof (u as Slotted).copies === 'number' && DRAFT.has((u as Slotted).defId);

interface Row { id: string; name: string; tier: number; faction: string; n: number; base: number; with: number; delta: number }
const rows: Row[] = [];
let k = 0;
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
for (const d of DRAFT_POOL) {
  if (ONLY && !ONLY.has(d.id) && !ONLY.has(`${d.faction}:${d.tier}`)) continue;
  let n = 0, b = 0, w = 0;
  for (let i = 0; i < setups.length && n < MAX_PER_CARD; i++) {
    const st = setups[(i * 7919 + k * 31) % setups.length];
    if (st.player.some(u => isSlot(u) && u.defId === d.id)) continue;
    const idx = st.player.findIndex(u => isSlot(u) && unitDef(u.defId).tier === d.tier && unitDef(u.defId).faction === d.faction);
    if (idx < 0) continue;
    const player = st.player.slice();
    player[idx] = { ...(player[idx] as Slotted), defId: d.id };
    b += base(st); w += score(reorder({ ...st, player })); n++;
  }
  rows.push({ id: d.id, name: d.name, tier: d.tier, faction: d.faction, n, base: n ? b / n : 0, with: n ? w / n : 0, delta: n ? (w - b) / n : 0 });
  if (++k % 10 === 0) process.stderr.write(`  卡 ${k}/${DRAFT_POOL.length}\n`);
}

const pp = (x: number) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1);
console.log(`# 单卡边际胜率（真实阵容替换，runs=${RUNS}，setups=${setups.length}）\n`);
console.log('Δ = 把阵中一个同阵营同费单位换成该卡后的胜率变化；「同费偏离」= Δ 减去同阵营同费卡的平均 Δ。样本 <100 不下结论。\n');
const groupMean = new Map<string, number>();
for (const r of rows) {
  const g = rows.filter(x => x.faction === r.faction && x.tier === r.tier && x.n >= 100);
  groupMean.set(r.id, g.length ? g.reduce((s, x) => s + x.delta, 0) / g.length : 0);
}
console.log('| 卡 | 名 | 阵营 | 费 | 样本 | 原胜率 | 换上后 | Δ | 同费偏离 |');
console.log('|---|---|---|---:|---:|---:|---:|---:|---:|');
for (const r of [...rows].sort((a, b) => a.faction.localeCompare(b.faction) || a.tier - b.tier || b.delta - a.delta))
  console.log(`| ${r.id} | ${r.name} | ${r.faction} | ${r.tier} | ${r.n} | ${(r.base * 100).toFixed(1)}% | ${(r.with * 100).toFixed(1)}% | ${pp(r.delta)} | ${pp(r.delta - groupMean.get(r.id)!)} |`);
console.log('\n## 离群（样本 ≥100，同费偏离超过 ±8pp）\n');
const out = rows.filter(r => r.n >= 100 && Math.abs(r.delta - groupMean.get(r.id)!) > 0.08).sort((a, b) => (b.delta - groupMean.get(b.id)!) - (a.delta - groupMean.get(a.id)!));
console.log(out.length ? out.map(r => `- ${r.id} ${r.name}（${r.faction} ${r.tier}费）同费偏离 ${pp(r.delta - groupMean.get(r.id)!)}pp，样本 ${r.n}`).join('\n') : '无');
const thin = rows.filter(r => r.n < 100);
if (thin.length) console.log(`\n样本不足（<100）：${thin.map(r => `${r.id}(${r.n})`).join(' ')}`);
