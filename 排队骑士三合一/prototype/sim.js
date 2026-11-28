// 无界面模拟：检验两个核心目标
//   ① 均势战斗 6～9 轮交锋，疲劳（第 10 轮）很少触发
//   ② 英雄（调度者）每场能提供 2～3 次"转折"
// 用法：node sim.js [每档局数=300] [种子=1]
import { createBattle, startBattle, advance, heroOptions, heroAct, runToEnd, CFG, HERO_SKILLS } from './engine.js';
import { POOL } from './cards.js';
import { makeTeam, makeEncounter, ENCOUNTERS, STAGES, mulberry } from './teams.js';

const N = Number(process.argv[2] || 300);
const SEED = Number(process.argv[3] || 1);
if (process.argv[4]) CFG.hpScale = Number(process.argv[4]);
if (process.argv[5]) CFG.fatigueStart = Number(process.argv[5]);
const FOCUS = process.argv.includes('focus');
const BOSS = process.argv.includes('boss');
const PRE = process.argv.includes('pre');       // AI 在布阵阶段使用整局技
const PREONLY = process.argv.includes('preonly'); // 只用整局技，战中不操作
const ARRANGE = PRE || PREONLY || process.argv.includes('arrange'); // 整备时看着敌阵预告排好己方站位（双方对照组都用）
let ONLY = null, TEAM = null;
for (const a of process.argv) {
  const m = a.match(/^(\w+)=([\w.]+)$/);
  if (!m) continue;
  if (m[1] === 'stage') ONLY = m[2];
  else if (m[1] === 'team') TEAM = m[2];
  else if (m[1] in CFG) CFG[m[1]] = isNaN(Number(m[2])) ? m[2] : Number(m[2]);
}

const score = (s) => (s.result === 'win' ? 1 : s.result === 'draw' ? 0.5 : 0);
const hpLeft = (s, side) => s.lines[side].reduce((a, id) => a + s.units[id].hp, 0);
const value = (s) => score(s) * 1000 + hpLeft(s, 0) - hpLeft(s, 1);

// 不再使用英雄，把当前局面打完
function rollout(s) {
  const c = structuredClone(s);
  while (!c.result) advance(c);
  return c;
}

// 从布阵阶段直接打完（不用英雄）
function rolloutSetup(s) {
  const c = structuredClone(s);
  startBattle(c);
  while (!c.result) advance(c);
  return c;
}
const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));

// 整备：看着敌阵预告，试遍己方站位的全排列，选不用英雄时结果最好的（模拟玩家的布阵决策，不算英雄操作）
function arrangeTeam(L, R, seed) {
  let best = L, bestV = -Infinity;
  for (const order of perms(L.map((_, i) => i))) {
    const team = order.map((i) => L[i]);
    const v = value(runToEnd(createBattle(team, R, seed)));
    if (v > bestV + 0.5) { bestV = v; best = team; }
  }
  return best;
}

// 整局技：试遍所有选择（重整 = 全排列），推演到底，选最好的；比不用好才用
// 布阵阶段（侦察、预演）和第 0 轮窗口（重整）各调用一次
function choosePre(s) {
  const roll = s.phase === 'setup' ? rolloutSetup : rollout;
  const opts = [];
  for (const o of heroOptions(s)) {
    if (o.type === 'regroup') for (const order of perms(s.lines[0])) { if (order.some((id, i) => id !== s.lines[0][i])) opts.push({ type: 'regroup', order }); }
    else opts.push(o);
  }
  if (!opts.length) return null;
  const base = roll(s);
  let best = null, bestV = value(base);
  for (const o of opts) {
    const c = structuredClone(s);
    if (!heroAct(c, o)) continue;
    const v = value(roll(c));
    if (v > bestV + 0.5) { bestV = v; best = o; }
  }
  if (!best) return null;
  heroAct(s, best);
  const after = roll(s);
  return { type: best.type, flip: score(after) > score(base), key: score(after) > score(base) || value(after) - value(base) >= 5 };
}

// 贪心英雄：每个窗口试遍所有合法操作（含"不操作"），各自推演到底，选结果最好的
// "转折" = 最佳操作的胜负结果严格好于不操作
function playWithHero(s) {
  let turns = 0, key = 0;
  const used = {};
  const usePre = () => {
    if (!PRE && !PREONLY) return;
    const r = choosePre(s);
    if (r) { used[r.type] = (used[r.type] || 0) + 1; if (r.flip) turns++; if (r.key) key++; }
  };
  usePre();
  startBattle(s);
  if (!s.result) usePre();
  let windows = 0, readyWindows = 0;
  while (!s.result) {
    if (s.round > 0 && !PREONLY) {
      windows++;
      // 一个窗口里可以连续操作，直到选择"不操作"
      for (let k = 0; k < 3 && !s.result; k++) {
        const opts = heroOptions(s).filter((o) => o.type !== 'regroup');
        if (!opts.length) break;
        if (k === 0) readyWindows++;
        const base = rollout(s);
        let best = null, bestV = value(base);
        for (const o of opts) {
          const c = structuredClone(s);
          heroAct(c, o);
          const v = value(rollout(c));
          if (v > bestV + 0.5) { bestV = v; best = o; }
        }
        if (!best) break;
        const before = score(base);
        heroAct(s, best);
        used[best.type] = (used[best.type] || 0) + 1;
        const after = rollout(s);
        if (score(after) > before) turns++;
        if (score(after) > before || value(after) - value(base) >= 5) key++;
      }
    }
    if (!s.result) advance(s);
  }
  return { turns, key, used, windows, readyWindows };
}

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-');
const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
const mean = (arr) => (arr.reduce((a, b) => a + b, 0) / (arr.length || 1));

function runSet(stage, rnd, makeRight) {
  const rounds = [], heroRounds = [];
  let fatigue = 0, draws = 0, winsNo = 0, winsHero = 0, turnsTotal = 0, keyTotal = 0;
  const keyHist = [0, 0, 0, 0, 0];
  const usedTotal = {};
  for (let i = 0; i < N; i++) {
    const fL = TEAM || (FOCUS ? ['shield', 'blade', 'abyss'][Math.floor(rnd() * 3)] : null);
    let L = makeTeam(stage, rnd, fL);
    const R = makeRight();
    const seed = Math.floor(rnd() * 2 ** 31);
    if (ARRANGE) L = arrangeTeam(L, R, seed);
    const a = runToEnd(createBattle(L, R, seed));
    rounds.push(a.round);
    if (a.round >= CFG.fatigueStart) fatigue++;
    if (a.result === 'draw') draws++;
    if (a.result === 'win') winsNo++;
    const b = createBattle(L, R, seed);
    const r = playWithHero(b);
    heroRounds.push(b.round);
    if (b.result === 'win') winsHero++;
    turnsTotal += r.turns; keyTotal += r.key; keyHist[Math.min(4, r.key)]++;
    for (const k in r.used) usedTotal[k] = (usedTotal[k] || 0) + r.used[k];
  }
  return { rounds, heroRounds, fatigue, draws, winsNo, winsHero, turnsTotal, keyTotal, keyHist, usedTotal };
}

function report(name, r) {
  console.log(`  ${name.padEnd(8)} 轮数中位 ${q(r.rounds, 0.5)}（疲劳 ${pct(r.fatigue, N)}）｜胜率 无英雄 ${pct(r.winsNo, N)} → 英雄 ${pct(r.winsHero, N)}（+${((100 * (r.winsHero - r.winsNo)) / N).toFixed(0)}）｜关键操作 ${(r.keyTotal / N).toFixed(2)}（≥2 次 ${pct(r.keyHist[2] + r.keyHist[3] + r.keyHist[4], N)}）翻盘 ${(r.turnsTotal / N).toFixed(2)}｜${Object.entries(r.usedTotal).map(([k, v]) => `${HERO_SKILLS[k].name} ${(v / N).toFixed(1)}`).join(' ')}`);
}

console.log(`英雄 ${CFG.hero}，血量系数 ${CFG.hpScale}，疲劳起始第 ${CFG.fatigueStart} 轮，英雄能量 开局 ${CFG.energyStart} / 上限 ${CFG.energyCap} / 奥义 ${CFG.ultCost}，卡池 ${POOL.length} 张，每组 ${N} 局${TEAM ? '，我方 ' + TEAM : FOCUS ? '，我方单流派' : ''}\n`);
for (const stage of STAGES.filter((st) => !ONLY || st.key === ONLY)) {
  console.log(`== ${stage.name} ==`);
  const rnd = mulberry(SEED * 7919 + stage.key.length);
  report('随机对手', runSet(stage, rnd, () => makeTeam(stage, rnd)));
  if (BOSS) for (const name of Object.keys(ENCOUNTERS)) report(name, runSet(stage, rnd, () => makeEncounter(name, stage, rnd)));
  console.log('');
}
