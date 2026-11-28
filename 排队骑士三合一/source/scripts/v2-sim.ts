// v2 战斗模拟（prototype/sim.js 的 TypeScript 版）：检验交锋轮数、英雄撬动力、遭遇难度。
// 用法：pnpm sim:v2 [每组局数=300] [种子=1] [血量系数] [疲劳起始轮] [开关…]
//   开关：focus（我方单流派成型）、boss（追加机制遭遇）、arrange（排好站位）、pre（排站位 + 整局技 + 战中技能）、
//         preonly（排站位 + 只用整局技）、stage=early|mid|late、team=shield|blade|abyss|frost、hero=…、branches=a+b、
//         以及任意 CFG 字段（如 energyPerRound=3）。
import { CFG, HERO_SKILLS, createBattle, runToEnd } from '../src/core/v2/engine';
import { POOL } from '../src/core/v2/cards';
import { ENCOUNTERS, STAGES, makeEncounter, makeTeam, mulberry, type Rng, type Stage } from '../src/core/v2/teams';
import { arrangeTeam, playWithHero } from '../src/core/v2/ai';
import type { Faction, UnitSpec } from '../src/core/v2/types';

const proc = (globalThis as unknown as { process: { argv: string[]; exit(code: number): never } }).process;
const argv = proc.argv.slice(2);
const N = Number(argv[0] || 300);
const SEED = Number(argv[1] || 1);
if (argv[2] && !isNaN(Number(argv[2]))) CFG.hpScale = Number(argv[2]);
if (argv[3] && !isNaN(Number(argv[3]))) CFG.fatigueStart = Number(argv[3]);
const FOCUS = argv.includes('focus');
const BOSS = argv.includes('boss');
const PRE = argv.includes('pre');
const PREONLY = argv.includes('preonly');
const ARRANGE = PRE || PREONLY || argv.includes('arrange');
let ONLY: string | null = null, TEAM: Faction | null = null;
const cfg = CFG as unknown as Record<string, number | string>;
for (const a of argv) {
  const m = a.match(/^(\w+)=([\w.+]+)$/);
  if (!m) continue;
  if (m[1] === 'stage') ONLY = m[2];
  else if (m[1] === 'team') TEAM = m[2] as Faction;
  else if (m[1] in cfg) cfg[m[1]] = isNaN(Number(m[2])) ? m[2] : Number(m[2]);
}

const FACTIONS: Faction[] = ['shield', 'blade', 'abyss', 'frost'];
const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-');
const quant = (arr: number[], p: number) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };

function runSet(stage: Stage, rnd: Rng, makeRight: () => UnitSpec[]) {
  const rounds: number[] = [];
  let fatigue = 0, winsNo = 0, winsHero = 0, turnsTotal = 0, keyTotal = 0;
  const keyHist = [0, 0, 0, 0, 0];
  const usedTotal: Record<string, number> = {};
  for (let i = 0; i < N; i++) {
    const fL = TEAM || (FOCUS ? FACTIONS[Math.floor(rnd() * FACTIONS.length)] : null);
    let L = makeTeam(stage, rnd, fL);
    const R = makeRight();
    const seed = Math.floor(rnd() * 2 ** 31);
    if (ARRANGE) L = arrangeTeam(L, R, seed);
    const a = runToEnd(createBattle(L, R, seed));
    rounds.push(a.round);
    if (a.round >= CFG.fatigueStart) fatigue++;
    if (a.result === 'win') winsNo++;
    const b = createBattle(L, R, seed);
    const r = playWithHero(b, { pre: PRE, preOnly: PREONLY });
    if (b.result === 'win') winsHero++;
    turnsTotal += r.turns; keyTotal += r.key; keyHist[Math.min(4, r.key)]++;
    for (const k in r.used) usedTotal[k] = (usedTotal[k] || 0) + r.used[k];
  }
  return { rounds, fatigue, winsNo, winsHero, turnsTotal, keyTotal, keyHist, usedTotal };
}

function report(name: string, r: ReturnType<typeof runSet>) {
  const used = Object.entries(r.usedTotal).map(([k, v]) => `${HERO_SKILLS[k].name} ${(v / N).toFixed(1)}`).join(' ');
  console.log(`  ${name.padEnd(8)} 轮数中位 ${quant(r.rounds, 0.5)}（疲劳 ${pct(r.fatigue, N)}）｜胜率 无英雄 ${pct(r.winsNo, N)} → 英雄 ${pct(r.winsHero, N)}（+${((100 * (r.winsHero - r.winsNo)) / N).toFixed(0)}）｜关键操作 ${(r.keyTotal / N).toFixed(2)}（≥2 次 ${pct(r.keyHist[2] + r.keyHist[3] + r.keyHist[4], N)}）翻盘 ${(r.turnsTotal / N).toFixed(2)}｜${used}`);
}

console.log(`英雄 ${CFG.hero}${CFG.branches ? '（分支 ' + CFG.branches + '）' : ''}，血量系数 ${CFG.hpScale}，疲劳起始第 ${CFG.fatigueStart} 轮，能量 开局 ${CFG.energyStart} / 每轮 +${CFG.energyPerRound} / 上限 ${CFG.energyCap}，奥义充能 ${CFG.ultCharge}，卡池 ${POOL.length} 张，每组 ${N} 局${TEAM ? '，我方 ' + TEAM : FOCUS ? '，我方单流派' : ''}${ARRANGE ? '，排好站位' : ''}\n`);
for (const stage of STAGES.filter((st) => !ONLY || st.key === ONLY)) {
  console.log(`== ${stage.name} ==`);
  const rnd = mulberry(SEED * 7919 + stage.key.length);
  report('随机对手', runSet(stage, rnd, () => makeTeam(stage, rnd)));
  if (BOSS) for (const name of Object.keys(ENCOUNTERS)) report(name, runSet(stage, rnd, () => makeEncounter(name, stage, rnd)));
  console.log('');
}
