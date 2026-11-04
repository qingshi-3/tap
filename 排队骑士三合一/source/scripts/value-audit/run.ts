// @ts-ignore Node built-ins are used only by this offline audit, matching the existing sim script.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// @ts-ignore See above.
import { createHash } from 'node:crypto';
import { CARDS, FOODS, LINE_INFO, SHOP_POOL, card } from '../../src/core/data';
import { runBattleContracts } from './battle-contracts';
import { runEconomyContracts } from './economy-contracts';
import { runComparison, runSensitivity, type Cell } from './comparison';
import { runCampaign } from './campaign';
import { ROLE_NOTES } from './role-notes';
import { runInvariants } from './invariants';
import { runLifecycle } from './lifecycle';
import { writeReview } from './review';
import { runNiche } from './niche';

const argv = (globalThis as unknown as { process: { argv: string[]; exitCode?: number } }).process.argv.slice(2);
const flag = (name: string, fallback: number) => Number(argv.find((v) => v.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const seeds = flag('seeds', 16), limit = flag('limit', 60), games = flag('games', 1500);
if (![seeds, limit, games].every((x) => Number.isInteger(x) && x > 0)) throw new Error('seeds/limit/games must be positive integers');
const directory = new URL('../../output/value-audit/', import.meta.url);
mkdirSync(directory, { recursive: true });
const started = Date.now();
const hashes = Object.fromEntries(['src/core/data.ts', 'src/core/engine.ts', 'src/core/run.ts', 'src/core/ghosts.json', 'scripts/bot.ts'].map((p) => [p,
  createHash('sha256').update(readFileSync(p)).digest('hex')]));
console.log('执行逐单位行为契约…');
const battle = runBattleContracts();
const economy = runEconomyContracts();
const checks = [...battle.checks, ...economy.checks];
console.log(`行为契约 ${checks.length}，失败 ${checks.filter((c) => c.status === 'fail').length}`);
writeFileSync(new URL('contracts.json', directory), JSON.stringify({ battle, economy }, null, 2));
console.log(`执行配对比较（seeds=${seeds}，units=${limit}）…`);
const comparison = runComparison({ seeds, limit, progress: (s) => console.log(s) });
writeFileSync(new URL('comparison.json', directory), JSON.stringify(comparison));
console.log('执行固定面板升星、重复副本和生命周期配对…');
const sensitivity = runSensitivity(comparison.cells, seeds);
const lifecycle = runLifecycle(seeds);
const niche = runNiche(seeds);
writeFileSync(new URL('niche.json', directory), JSON.stringify(niche, null, 2));
console.log('执行随机状态不变量与终止性检查…');
const invariants = runInvariants(limit >= 60 ? 10000 : 100);
console.log(`执行正常局辅助采样（3档×${games}局）…`);
const campaign = runCampaign(games);
const aggregate = (rows: Cell[]) => {
  const n = rows.reduce((s, c) => s + c.n, 0);
  const sum = (key: 'delta' | 'factual' | 'blank' | 'triggers' | 'fizzles' | 'left' | 'right') => rows.reduce((s, c) => s + c[key], 0);
  return { n, score: sum('factual') / Math.max(1, n), blank: sum('blank') / Math.max(1, n), delta: sum('delta') / Math.max(1, n),
    triggers: sum('triggers') / Math.max(1, n), fizzles: sum('fizzles') / Math.max(1, n), left: 2 * sum('left') / Math.max(1, n), right: 2 * sum('right') / Math.max(1, n) };
};
const groups = (rows: Cell[], key: 'context' | 'stage' | 'level' | 'position') => [...new Set(rows.map((c) => String(c[key])))].map((value) => ({ value,
  ...aggregate(rows.filter((c) => String(c[key]) === value)) }));
const unitReports = SHOP_POOL.slice(0, limit).map((d) => {
  const rows = comparison.cells.filter((c) => c.unit === d.id);
  const contexts = groups(rows, 'context').sort((a, b) => b.delta - a.delta);
  const star = groups(rows, 'level'), stages = groups(rows, 'stage'), positions = groups(rows, 'position');
  const contracts = checks.filter((c) => c.unitIds.includes(d.id));
  const replacements = comparison.replacements.filter((r) => r.unit === d.id).sort((a, b) => a.delta / a.n - b.delta / b.n);
  const natural = campaign.units.find((u) => u.id === d.id)!;
  const hasEconomicRole = !!d.perm || ['dune', 'pharaoh'].includes(d.ab ?? '');
  const maxTier = d.tier * 10;
  const shelf = d.tier <= 2 ? 3 : d.tier <= 4 ? 4 : 5;
  return { id: d.id, name: d.name, line: d.line, tier: d.tier, hasEconomicRole, role: ROLE_NOTES[d.id],
    summary: aggregate(rows), contexts, star, stages, positions, contracts, replacements, natural,
    sensitivity: sensitivity.rows.filter((r) => r.unit === d.id), lifecycle: lifecycle.rows.filter((r) => r.unit === d.id),
    acquisition: { unlockTurn: d.tier * 2 - 1, shelf, unlockedUnits: maxTier, chancePerFullReroll: 1 - (1 - 1 / maxTier) ** shelf,
      expectedShelvesPerCopy: maxTier / shelf, extraCopiesForLevel2: 2, extraCopiesForLevel3: 5,
      note: '仅对该阶首次正常解锁时、无锁定满货架、均匀卡池的近似机会成本；不计升星奖励、秘药和未来扩池。' } };
});
const result = { generatedAt: new Date().toISOString(), elapsedSeconds: (Date.now() - started) / 1000, seeds, gamesPerSkill: games,
  hashes, counts: { units: SHOP_POOL.length, tokens: CARDS.filter((c) => c.token).length, enemies: CARDS.filter((c) => c.enemy).length,
    foods: FOODS.length, contracts: checks.length, failedContracts: checks.filter((c) => c.status === 'fail').length,
    comparisonBattles: comparison.battles, sensitivityBattles: sensitivity.battles, lifecycleBattles: lifecycle.battles,
    invariantBattles: invariants.battles, invariantFailures: invariants.failures.length, campaignBattles: campaign.battles, nicheBattles: niche.battles },
  battle, economy, campaign, sensitivity, lifecycle, invariants, niche, units: unitReports, comparisonMethod: comparison.method };
writeFileSync(new URL('results.json', directory), JSON.stringify(result, null, 2));
const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const pp = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)} 个百分点`;
const names: Record<string, string> = { neutral: '白板队', rotate: '轮换', blade: '影刃', soul: '亡魂', 'beast-open': '兽群四人', 'beast-full': '兽群满编', frost: '霜甲', mixed: '混搭', base: '基础身材', grown: '各+6/+6', late: '各+18/+18' };
const report: string[] = ['# 排队骑士 · 逐单位价值审计', '', '状态：已完成本次离线规则与价值实验；未改玩法、数值、存档、幽灵库或既有界面。', '',
  `覆盖 ${unitReports.length}/60 单位；${checks.length} 条行为契约，其中 ${result.counts.failedContracts} 条失败；配对比较 ${comparison.battles.toLocaleString()} 场模拟；固定面板升星/副本 ${sensitivity.battles.toLocaleString()} 场；生命周期 ${lifecycle.battles.toLocaleString()} 场；随机状态 ${invariants.cases.toLocaleString()} 组；正常局辅助 ${games * 3} 局（含消融 ${campaign.battles.toLocaleString()} 场）。`, '',
  '## 如何阅读', '',
  '“边际”是同身材同队伍中，保留/移除该单位原生技能与关键词的配对胜平积分差（胜1、平0.5、负0），不是单位单独胜率。商店成长牌的历史收益不在当场消融中，必须连同成长测量一起看。', '',
  '每张牌覆盖1/2/3星、基础/+6/+6/+18/+18三个成长档、8类我方壳、全部合法位置、8类等总攻血敌方、两侧与固定种子。支持牌按目标阶段可解锁阶层筛选；四人和满编召唤壳分开。', '',
  '总体平均使用人为等权环境，不代表真实环境出场率。最佳/最差环境是探索性结果；同阶替换使用预注册的中立/混搭/双方流派共同壳、全部位置与独立种子，并排除双方在支持位重复，能说明即时替换竞争情况，不能证明全局严格压制。高星成型不等同于可获得。', '',
  '## 行为失败与契约歧义', ''];
for (const c of checks.filter((c) => c.status === 'fail')) report.push(`- **${c.id}**（${c.unitIds.map((id) => card(id)?.name ?? id).join('、')}）：预期 ${c.expected}；实际 ${c.observed}`);
if (!checks.some((c) => c.status === 'fail')) report.push('当前行为检查未出现失败；这不等于所有设计有价值。');
for (const d of unitReports.filter((u) => u.role?.contractRisk)) report.push(`- ${d.name}：${d.role.contractRisk}`);
report.push('', `随机状态检查 ${invariants.cases} 组，记录 ${invariants.failures.length} 个不变量失败；最大事件数 ${invariants.largestEvents}。测试覆盖确定性、输入不变、有限数、存活上限、30交锋、结算结果与终止性。镜像压力样本中的先侧积分偏差 ${pp(invariants.firstSideAdvantage)}，仅作顺序敏感性诊断。`);
for (const f of invariants.failures.slice(0, 20)) report.push(`- 随机状态 ${f.case} ${f.id}：${f.detail}（完整可复现输入在results.json）`);
report.push('', '## 正常局辅助证据', '', '| bot参数 | 局数 | 通关 | 通关平均剩心 | 平均结束回合 |', '|---|---:|---:|---:|---:|');
for (const r of campaign.runs) report.push(`| ${r.skill} | ${r.games} | ${percent(r.cleared / r.games)} | ${(r.livesOnClear / Math.max(1, r.cleared)).toFixed(1)} | ${(r.turns / r.games).toFixed(1)} |`);
report.push('', ...campaign.caveats.map((s) => `- ${s}`), '', '## 60单位总览', '',
  '| 单位 | 阶/流派 | 角色 | 战斗技能平均边际 | 最有利壳边际 | 自身技能平均失效次数/场 |', '|---|---|---|---:|---|---:|');
for (const u of unitReports) report.push(`| ${u.name} | ${u.tier}/${LINE_INFO[u.line].name} | ${u.role.role} | ${u.hasEconomicRole ? '另看生命周期' : pp(u.summary.delta)} | ${names[u.contexts[0].value]} ${pp(u.contexts[0].delta)} | ${u.summary.fizzles.toFixed(2)} |`);
report.push('', '## 逐单位证据', '');
for (const u of unitReports) {
  const n = u.natural, r = u.replacements;
  report.push(`### ${u.name} · ${u.id}`, '',
    `- **存在价值**：${u.role.role}。成立条件：${u.role.enabling}。`,
    `- **失效与代价**：${u.role.failure}。`,
    `- **配对结果**：${u.summary.n.toLocaleString()} 个配对，平均边际 ${pp(u.summary.delta)}；原生技能平均触发 ${u.summary.triggers.toFixed(2)} 次/场、失效 ${u.summary.fizzles.toFixed(2)} 次/场。${u.hasEconomicRole ? '该牌含经济/永久成长，不能以当前战斗边际判无价值。' : ''}`,
    `- **环境**：最好 ${names[u.contexts[0].value]} ${pp(u.contexts[0].delta)}；最差 ${names[u.contexts.at(-1)!.value]} ${pp(u.contexts.at(-1)!.delta)}。`,
    `- **星级敏感性**：${u.star.map((s) => `${s.value}星 ${pp(s.delta)}`).join('；')}。这是各星相对本星白板的边际，不是升星因果收益。`,
    `- **成长敏感性**：${u.stages.map((s) => `${names[s.value]} ${pp(s.delta)}`).join('；')}。`,
    `- **站位敏感性**：${u.positions.map((s) => `${Number(s.value) + 1}位 ${pp(s.delta)}`).join('；')}（含动态队列变化，非纯开场单挑）。`,
    `- **同阶替代**：${u.role.replacementConcern}。共同壳、另一组固定种子下，本组差值最不利的同阶替换为 ${card(r[0].alternative).name}，差 ${pp(r[0].delta / r[0].n)}；最有利的同阶替换为 ${card(r.at(-1)!.alternative).name}，差 ${pp(r.at(-1)!.delta / r.at(-1)!.n)}。${u.hasEconomicRole ? '此处不计成长/经济，因此不能据此淘汰本牌。' : ''}`,
    `- **固定面板升星**：${u.sensitivity.filter((s) => s.type !== 'duplicate').map((s) => `${s.type === 'upgrade-1-2' ? '1→2' : '2→3'}星纯技能 ${pp(s.delta / s.n)}`).join('；')}。复制份数带来的额外身材/成本不在此项。`,
    `- **第二张技能**：${u.sensitivity.filter((s) => s.type === 'duplicate').map((s) => `${s.position + 1}位 ${pp(s.delta / s.n)}`).join('；')}（第一张保留，第二张与同身材空能力比较，候选有利壳）。`,
    `- **先后侧**：置左 ${percent(u.summary.left)}，置右 ${percent(u.summary.right)}；绝对积分依赖测试环境，不是该单位单卡胜率。`,
    `- **自然局证据**：出场 ${n.appearances} 个单位回合，1/2/3星次数 ${n.levels.join('/')}；平均面板 ${(n.sumAtk / Math.max(1, n.appearances)).toFixed(1)}/${(n.sumHp / Math.max(1, n.appearances)).toFixed(1)}；当前战斗消融 ${pp(n.marginal / Math.max(1, n.ablationN))}。出场是bot选择结果，不是玩家偏好或因果强度。`,
    `- **获取门槛**：通常第 ${u.acquisition.unlockTurn} 回合解锁；解锁当阶一次无锁定满货架看到指定该牌概率 ${percent(u.acquisition.chancePerFullReroll)}；已有一份后2/3星仍需2/5份（不计秘药/升星奖励）。`,
    `- **行为覆盖**：相关检查 ${u.contracts.length} 条，失败 ${u.contracts.filter((c) => c.status === 'fail').length} 条。${u.role.contractRisk ? `契约注意：${u.role.contractRisk}。` : ''}`, '');
  for (const l of u.lifecycle.filter((l) => l.level === 1)) report.push(`- **一星持有${l.horizon}回合的状态级对照**：面板额外 ${l.statGainDelta.map((n) => n.toFixed(2)).join('/')}，蛋bank额外 ${l.bankDelta.toFixed(2)}；额外收入 ${l.goldEarnedDelta.toFixed(2)}金、额外支出 ${l.goldSpentDelta.toFixed(2)}金；最终固定敌阵积分差 ${pp(l.scoreDelta)}。${l.notes.filter((n) => !n.startsWith('各Delta')).join('；')}。`);
  if (u.lifecycle.length) report.push('');
}
report.push('## 生命周期方法', '', ...lifecycle.method.map((s) => `- ${s}`), '', sensitivity.note, '',
  '## 复跑与复核', '', '`cd 排队骑士/source` 后执行 `npm run audit:units`。快速检查可加 `-- --seeds=1 --limit=1 --games=10`，快速结果不代替全量验收。', '',
  '详细行为观测在 `source/output/value-audit/contracts.json`；情境与同阶替换全部汇总在 `comparison.json`；每单位自然局证据、源码SHA256、参数在 `results.json`。固定种子保证同代码可复跑，不代表样本独立或统计置信区间。', '',
  ...comparison.method.caveats.map((s) => `- ${s}`), '',
  '边界：本轮是离线机制/策略价值审计；未进行玩家盲测、留存测试或逐单位视觉/操作验收，不能据此宣称真实玩家觉得好玩。没有修改玩法来消除测试发现。');
writeFileSync(limit >= 60 ? new URL('../../../UNIT-VALUE-AUDIT.md', import.meta.url) : new URL('preview-report.md', directory), report.join('\n') + '\n');
if (limit >= 60) writeReview();
console.log(JSON.stringify({ ...result.counts, elapsedSeconds: result.elapsedSeconds, campaign: campaign.runs }));
if (result.counts.failedContracts || invariants.failures.length) (globalThis as unknown as { process: { exitCode: number } }).process.exitCode = 1;
