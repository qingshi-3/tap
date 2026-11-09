// @ts-ignore node builtin
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../../output/balance-compare/', import.meta.url);
const before = JSON.parse(readFileSync(new URL('baseline.json', dir), 'utf8'));
const after = JSON.parse(readFileSync(new URL('after.json', dir), 'utf8'));
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function pairedCI(xs: number[], ys: number[], seed: number) {
  const random = rng(seed), deltas: number[] = [];
  for (let b = 0; b < 10000; b++) { let d = 0; for (let i = 0; i < xs.length; i++) { const k = Math.floor(random() * xs.length); d += ys[k] - xs[k]; } deltas.push(d / xs.length); }
  deltas.sort((a, b) => a - b);
  return [deltas[249], deltas[9749]];
}
const comparison = before.groups.map((bg: any, gi: number) => {
  const ag = after.groups.find((x: any) => x.group.id === bg.group.id);
  const bx = bg.runs.map((r: any) => Number(r.cleared)), ax = ag.runs.map((r: any) => Number(r.cleared));
  const bt = bg.runs.map((r: any) => r.terminalTurn), at = ag.runs.map((r: any) => r.terminalTurn);
  const stages = bg.summary.stages.map((bs: any) => { const as = ag.summary.stages.find((x: any) => x.stage === bs.stage); return { stage: bs.stage, before: bs.winRate, after: as.winRate, delta: as.winRate - bs.winRate, beforeEncounters: bs.encounters, afterEncounters: as.encounters }; });
  return { group: bg.group, before: { clearRate: bg.summary.clearRate, avgTerminalTurn: bg.summary.avgTerminalTurn, clearWilson95: bg.summary.clearWilson95 },
    after: { clearRate: ag.summary.clearRate, avgTerminalTurn: ag.summary.avgTerminalTurn, clearWilson95: ag.summary.clearWilson95 },
    delta: { clearRate: ag.summary.clearRate - bg.summary.clearRate, clearRatePairedBootstrap95: pairedCI(bx, ax, 9001 + gi), avgTerminalTurn: ag.summary.avgTerminalTurn - bg.summary.avgTerminalTurn, terminalTurnPairedBootstrap95: pairedCI(bt, at, 19001 + gi) },
    pairedOutcomes: { lossToWin: bx.filter((x: number, i: number) => !x && ax[i]).length, winToLoss: bx.filter((x: number, i: number) => x && !ax[i]).length, unchanged: bx.filter((x: number, i: number) => x === ax[i]).length }, stages };
});
const out = { schemaVersion: 1, generatedAt: new Date().toISOString(), nPerGroup: before.config.nPerGroup, baselineSource: before.baselineSource,
  method: '同种子、同 bot；通关率与终局回合差的区间为逐局配对 bootstrap 10000 次 percentile 95% CI。单侧各自通关率区间为 Wilson 95%。',
  limitations: ['启发式 bot 沿用基线 shopTurn，未针对寒冬守望者每回合限次改变喂食目标或时机。', 'bot 也未针对巨熊最低补货阶数或精英默认 lift 调整购买、分路策略。', '这是自动 bot 仿真，不是真人试玩；80 局/组的区间较宽，小幅差异可能是样本波动。', '阶段胜率按实际遭遇数计算，后期存在到达/幸存者构成变化，不宜单独解释为战斗强度的因果变化。'], comparison };
writeFileSync(new URL('comparison.json', dir), JSON.stringify(out, null, 2));
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
let md = `# 同种子 bot 平衡对照\n\nN=80/组。差值为 after - baseline；括号为逐局配对 bootstrap 95% CI。\n\n| 分组 | 通关率前→后 | 差值 (95% CI) | 平均终局回合前→后 | 差值 (95% CI) | 前→后翻转 |\n|---|---:|---:|---:|---:|---:|\n`;
for (const x of comparison) md += `| ${x.group.id} | ${pct(x.before.clearRate)} → ${pct(x.after.clearRate)} | ${pct(x.delta.clearRate)} (${pct(x.delta.clearRatePairedBootstrap95[0])}, ${pct(x.delta.clearRatePairedBootstrap95[1])}) | ${x.before.avgTerminalTurn.toFixed(2)} → ${x.after.avgTerminalTurn.toFixed(2)} | ${x.delta.avgTerminalTurn.toFixed(2)} (${x.delta.terminalTurnPairedBootstrap95[0].toFixed(2)}, ${x.delta.terminalTurnPairedBootstrap95[1].toFixed(2)}) | 败→胜 ${x.pairedOutcomes.lossToWin} / 胜→败 ${x.pairedOutcomes.winToLoss} |\n`;
md += `\n## 阶段遭遇胜率（前→后）\n\n| 分组 | 前期 1–4 | 中期 5–10 | 后期 11+ |\n|---|---:|---:|---:|\n`;
for (const x of comparison) md += `| ${x.group.id} | ${pct(x.stages[0].before)} → ${pct(x.stages[0].after)} | ${pct(x.stages[1].before)} → ${pct(x.stages[1].after)} | ${pct(x.stages[2].before)} → ${pct(x.stages[2].after)} |\n`;
md += `\n## 限制\n\n${out.limitations.map((x: string) => `- ${x}`).join('\n')}\n`;
writeFileSync(new URL('report.md', dir), md);
console.log(md);
