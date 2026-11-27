#!/usr/bin/env node
'use strict';
// 《日蚀战团》强度回归模拟器 · 命令行入口。用法见 sim/README.md 或 `node sim/cli.js help`
const fs = require('fs');
const path = require('path');
const { loadGame, checkDrift, writeLock, loadOverridesFile } = require('./lib/loadGame');
const { Pool } = require('./lib/pool');
const S = require('./lib/stats');

const DEFAULT_THEMES = ['discard', 'shield', 'poison'];
const REPORT_DIR = path.join(__dirname, 'reports');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const nxt = argv[i + 1];
      if (nxt === undefined || nxt.startsWith('--')) args[key] = true;
      else { args[key] = nxt; i++; }
    } else args._.push(a);
  }
  return args;
}
const list = (v) => (v && v !== true ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);

function baseCfg(args) {
  const themes = args.themes === 'random' ? 'random' : (list(args.themes).length ? list(args.themes) : DEFAULT_THEMES);
  let overrides = loadOverridesFile(args.override);
  const aiParams = args.ai ? JSON.parse(fs.readFileSync(path.resolve(args.ai), 'utf8')) : {};
  if (args.level) aiParams.level = args.level;
  return {
    heroId: args.hero || 'hero_01',
    ascension: Number(args.asc || 0),
    themes,
    ads: Boolean(args.ads),
    forceCards: list(args['force-card']),
    forceRelics: list(args['force-relic']),
    banCards: list(args['ban-card']),
    overrides,
    aiParams
  };
}

function mergeOverrides(a, b) {
  if (!a) return b;
  if (!b) return a;
  const out = JSON.parse(JSON.stringify(a));
  const merge = (t, p) => {
    for (const [k, v] of Object.entries(p)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object') merge(t[k], v);
      else t[k] = v;
    }
  };
  merge(out, b);
  if (a.bossHpMult && b.bossHpMult) out.bossHpMult = a.bossHpMult * b.bossHpMult;
  if (a.bossDmgMult && b.bossDmgMult) out.bossDmgMult = a.bossDmgMult * b.bossDmgMult;
  return out;
}

function driftBanner() {
  const d = checkDrift();
  if (d.firstRun) {
    writeLock('首次运行自动记录');
    return;
  }
  if (!d.ok) {
    console.warn('\n⚠ 游戏流程代码有改动：v14Main.js 中 ' + d.changed.join('、') + ' 的数值逻辑和模拟器记录的版本不一致。');
    console.warn('  请核对 sim/lib/flow.js 里对应的镜像方法，确认同步后运行 `node sim/cli.js check --accept`。\n');
  }
}

function makePool(args) {
  const n = args.workers ? Number(args.workers) : undefined;
  return new Pool(n);
}

function progress(label) {
  let last = 0;
  return (done, total) => {
    const now = Date.now();
    if (now - last > 800 || done === total) {
      last = now;
      process.stderr.write(`\r${label} ${done}/${total}   `);
      if (done === total) process.stderr.write('\n');
    }
  };
}

function saveReport(name, md, json) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const base = path.join(REPORT_DIR, `${stamp}-${name}`);
  fs.writeFileSync(base + '.md', md);
  if (json) fs.writeFileSync(base + '.json', JSON.stringify(json, null, 1));
  console.log(`\n报告已保存：${path.relative(process.cwd(), base)}.md`);
}

function cfgLabel(cfg) {
  const t = cfg.themes === 'random' ? '随机3流派' : cfg.themes.join('/');
  const bits = [(cfg.aiParams && cfg.aiParams.level === 'novice') ? '新手AI' : '老手AI', `英雄 ${cfg.heroId}`, `进阶 ${cfg.ascension}`, `流派 ${t}`, cfg.ads ? '含广告复活' : '零广告'];
  if (cfg.forceCards.length) bits.push('强制带卡 ' + cfg.forceCards.join(','));
  if (cfg.forceRelics.length) bits.push('强制秘宝 ' + cfg.forceRelics.join(','));
  return bits.join(' · ');
}

// 成对差值（同种子 A/B）
function pairedDelta(A, B) {
  const n = Math.min(A.length, B.length);
  const d = [];
  const dw = [];
  for (let i = 0; i < n; i++) {
    if (A[i].error || B[i].error) continue;
    d.push((A[i].won ? 1 : 0) - (B[i].won ? 1 : 0));
    dw.push(A[i].wavesCleared - B[i].wavesCleared);
  }
  const m = S.avg(d);
  const sd = Math.sqrt(S.avg(d.map((x) => (x - m) ** 2)));
  return { delta: m, se: sd / Math.sqrt(Math.max(1, d.length)), dWaves: S.avg(dw) };
}

// ========== 命令 ==========

async function cmdRun(args) {
  const cfg = baseCfg(args);
  const runs = Number(args.runs || 500);
  const seed = Number(args.seed || 1);
  const pool = makePool(args);
  const t0 = Date.now();
  const res = await pool.run(cfg, runs, seed, progress('跑局中'));
  pool.close();
  const Sm = S.summarize(res);
  console.log(S.formatSummary(Sm, cfgLabel(cfg)));
  console.log(`耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (Sm.errors) console.log('报错示例：\n' + Sm.errorSamples.map((e) => e.error.split('\n').slice(0, 4).join('\n')).join('\n---\n'));

  const G = loadGame({ overrides: cfg.overrides });
  const nameOf = (id) => (G.D.ALL_HERO_MAP[id] && G.D.ALL_HERO_MAP[id].name) || (G.D.RELICS.find((r) => r.id === id) || {}).name || id;
  const cardRows = Object.entries(Sm.cardStat)
    .filter(([id]) => !id.startsWith('st_'))
    .map(([id, s]) => [nameOf(id), id, s.offered, s.offered ? S.pct(s.picked / s.offered, 0) : '-', s.owned, s.owned ? S.pct(s.wins / s.owned, 0) : '-'])
    .sort((a, b) => b[4] - a[4]);
  const relicRows = Object.entries(Sm.relicStat)
    .map(([id, s]) => [nameOf(id), id, s.owned, S.pct(s.wins / s.owned, 0)])
    .sort((a, b) => b[2] - a[2]);
  const md = [
    `# 模拟报告 · ${cfgLabel(cfg)}`,
    '',
    `生成时间 ${new Date().toLocaleString('zh-CN')}，种子 ${seed}~${seed + runs - 1}`,
    '',
    S.formatSummaryMd(Sm, '总览'),
    '',
    '## 侠客卡（相关性统计：持有该卡的局通关率，受 AI 选牌偏好影响，因果结论请用 scan）',
    '',
    S.mdTable(['卡牌', 'id', '被提供次数', 'AI 选取率', '持有局数', '持有局通关率'], cardRows),
    '',
    '## 秘宝',
    '',
    S.mdTable(['秘宝', 'id', '持有局数', '持有局通关率'], relicRows)
  ].join('\n');
  if (!args['no-report']) saveReport(args.name || 'run', md, { cfg: { ...cfg, overrides: cfg.overrides || null }, summary: Sm });
}

async function cmdScan(args) {
  const what = args._[1] || 'cards';
  const cfg0 = baseCfg(args);
  const runs = Number(args.runs || 300);
  const seed = Number(args.seed || 1);
  const pool = makePool(args);
  const G = loadGame({ overrides: cfg0.overrides });
  const only = list(args.only);
  const t0 = Date.now();
  const baseCache = new Map();
  const baseline = async (cfg) => {
    const key = JSON.stringify([cfg.themes, cfg.heroId, cfg.ascension, cfg.stopAfterWave || 0, cfg.overrides || null]);
    if (!baseCache.has(key)) baseCache.set(key, await pool.run(cfg, runs, seed));
    return baseCache.get(key);
  };
  const withTheme = (theme) => {
    if (cfg0.themes === 'random' || !theme || theme === 'core' || cfg0.themes.includes(theme)) return cfg0.themes;
    return [theme, ...cfg0.themes.slice(0, 2)];
  };

  const rows = [];
  let items;
  if (what === 'cards') items = G.D.SHOP_HEROES.map((h) => ({ id: h.id, name: h.name, tier: h.tier, theme: h.theme }));
  else if (what === 'relics') items = G.D.RELICS.map((r) => ({ id: r.id, name: r.name, tier: r.tier, theme: r.theme }));
  else if (what === 'heroes') items = G.HEROES.map((h) => ({ id: h.id, name: h.name, tier: '-', theme: 'core' }));
  else if (what === 'bosses') items = G.D.BOSS_POOL.map((b, i) => ({ id: b.id, name: b.name, tier: '-', theme: 'core', idx: i }));
  else throw new Error('scan 只支持 cards / relics / heroes / bosses');
  if (only.length) items = items.filter((x) => only.includes(x.id));
  if (args.theme) items = items.filter((x) => x.theme === args.theme);

  const bossWave = Number(args.wave || 4);
  let i = 0;
  for (const it of items) {
    i++;
    process.stderr.write(`\r扫描 ${what} ${i}/${items.length} ${it.id}            `);
    let A, B;
    if (what === 'cards' || what === 'relics') {
      const cfgB = { ...cfg0, themes: withTheme(it.theme) };
      const cfgA = { ...cfgB, [what === 'cards' ? 'forceCards' : 'forceRelics']: [...(what === 'cards' ? cfg0.forceCards : cfg0.forceRelics), it.id] };
      B = await baseline(cfgB);
      A = await pool.run(cfgA, runs, seed);
    } else if (what === 'heroes') {
      B = await baseline({ ...cfg0, heroId: 'hero_01' });
      A = await pool.run({ ...cfg0, heroId: it.id }, runs, seed);
    } else {
      const ov = mergeOverrides(cfg0.overrides, { data: { WAVE_CONFIG: { [bossWave]: { bossIdx: it.idx } } } });
      A = await pool.run({ ...cfg0, overrides: ov, stopAfterWave: bossWave }, runs, seed);
      B = null;
    }
    const SA = S.summarize(A);
    if (what === 'bosses') {
      const w = SA.perWave[bossWave - 1];
      rows.push({ ...it, pass: w.passRate, rounds: w.avgRounds, hpLost: w.avgHpLost, berserk: w.berserkRate, ult: w.ultRate, cap: w.capRate });
      continue;
    }
    const SB = S.summarize(B);
    const pd = pairedDelta(A, B);
    rows.push({ ...it, clearA: SA.clearRate, clearB: SB.clearRate, delta: pd.delta, se: pd.se, dWaves: pd.dWaves });
  }
  process.stderr.write('\n');
  pool.close();

  let md;
  if (what === 'bosses') {
    rows.sort((a, b) => a.pass - b.pass);
    const head = ['Boss', 'id', `放在第${bossWave}波通过率`, '平均回合', '掉血', '狂暴率', '吃大招', '触顶'];
    const body = rows.map((r) => [r.name, r.id, S.pct(r.pass), r.rounds.toFixed(1), r.hpLost.toFixed(1), S.pct(r.berserk, 0), S.pct(r.ult, 0), S.pct(r.cap, 0)]);
    console.log(S.table(head, body, [12, 14, 14, 8, 6, 6, 6, 5]));
    md = [`# Boss 扫描 · 统一放在第 ${bossWave} 波`, '', cfgLabel(cfg0) + ` · 每个 ${runs} 局`, '', S.mdTable(head, body)].join('\n');
  } else {
    rows.sort((a, b) => b.delta - a.delta);
    // 与同档位中位数比较，标出「越档」的
    const byTier = {};
    for (const r of rows) (byTier[r.tier] = byTier[r.tier] || []).push(r.delta);
    const med = {};
    for (const [t, ds] of Object.entries(byTier)) { const s = ds.slice().sort((a, b) => a - b); med[t] = s[Math.floor(s.length / 2)]; }
    const flag = (r) => {
      const m = med[r.tier];
      if (r.tier === '-' || m === undefined) return '';
      if (r.delta - m > Math.max(0.05, 2.5 * r.se)) return '偏强';
      if (m - r.delta > Math.max(0.05, 2.5 * r.se)) return '偏弱';
      return '';
    };
    const head = ['名称', 'id', '档', '带上它通关率', '基线', '提升', '±', '多打波数', '判断'];
    const body = rows.map((r) => [r.name, r.id, r.tier, S.pct(r.clearA), S.pct(r.clearB), (r.delta >= 0 ? '+' : '') + S.pct(r.delta), S.pct(1.96 * r.se), (r.dWaves >= 0 ? '+' : '') + r.dWaves.toFixed(2), flag(r)]);
    console.log(S.table(head, body, [22, 16, 3, 12, 6, 7, 6, 8, 4]));
    const tierLine = Object.entries(med).filter(([t]) => t !== '-').map(([t, m]) => `${t} 档中位提升 ${S.pct(m)}`).join('，');
    md = [
      `# ${what === 'cards' ? '侠客卡' : what === 'relics' ? '秘宝' : '英雄'}强度扫描（A/B）`,
      '',
      `${cfgLabel(cfg0)} · 每项 ${runs} 局，A/B 使用同一批随机种子`,
      '',
      what === 'heroes' ? '「提升」= 用该英雄 − 用英雄01 的通关率。' : '「提升」= 开局强制带上它 − 不带 的通关率（流派卡会自动打开它所属的流派）。「判断」= 与同档位中位数相比明显越档。',
      tierLine ? '\n' + tierLine : '',
      '',
      S.mdTable(head, body)
    ].join('\n');
  }
  console.log(`耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  saveReport('scan-' + what, md, { cfg: { ...cfg0, overrides: cfg0.overrides || null }, runs, rows });
}

// ---- 调参：二分搜索一个旋钮，让指标达到目标 ----
function knobOverride(knob, v) {
  if (knob === 'wave.hp') return { bossHpMult: v };
  if (knob === 'wave.dmg') return { bossDmgMult: v };
  const [kind, id, field] = knob.split('.');
  if (kind === 'data') return { data: { [id]: v } };
  const map = { card: 'cards', relic: 'relics', hero: 'heroes', boss: 'bosses', starter: 'starters' };
  if (map[kind] && id && field) return { [map[kind]]: { [id]: { [field]: v } } };
  throw new Error('无法识别的旋钮 ' + knob + '（支持 wave.hp / wave.dmg / data.KEY / card.ID.字段 / relic.ID.字段 / hero.ID.字段 / starter.ID.字段）');
}
function knobBase(G, knob) {
  if (knob.startsWith('wave.')) return 1;
  const [kind, id, field] = knob.split('.');
  if (kind === 'data') return G.D[id];
  if (kind === 'card') return (G.D.ALL_HERO_MAP[id] || {})[field];
  if (kind === 'starter') return (G.D.STARTER_TEMPLATES[id] || {})[field];
  if (kind === 'relic') return (G.D.RELICS.find((r) => r.id === id) || {})[field];
  if (kind === 'hero') return (G.HEROES.find((h) => h.id === id) || {})[field];
  if (kind === 'boss') return (G.D.BOSS_POOL.find((b) => b.id === id) || {})[field];
  return undefined;
}

async function cmdTune(args) {
  const cfg0 = baseCfg(args);
  const runs = Number(args.runs || 300);
  const seed = Number(args.seed || 1);
  const knob = args.knob || 'wave.hp';
  const iters = Number(args.iters || 8);
  const G = loadGame({ overrides: cfg0.overrides });
  const base = knobBase(G, knob);
  if (typeof base !== 'number' && !knob.startsWith('wave.')) throw new Error(`旋钮 ${knob} 当前值不是数字（${base}）`);
  let [lo, hi] = args.range ? list(args.range).map(Number) : (knob.startsWith('wave.') ? [0.3, 3] : [base * 0.25 || 0, (base || 1) * 3]);
  const integer = !knob.startsWith('wave.') && Number.isInteger(base);
  const pool = makePool(args);

  const metricName = args.metric || 'clear';
  let baselineRes = null;
  if (args['target-delta'] !== undefined) baselineRes = await pool.run(cfg0, runs, seed);
  const evalAt = async (v) => {
    const cfg = { ...cfg0, overrides: mergeOverrides(cfg0.overrides, knobOverride(knob, v)) };
    const res = await pool.run(cfg, runs, seed);
    const Sm = S.summarize(res);
    let m;
    if (metricName === 'clear') m = Sm.clearRate;
    else if (/^reach\d$/.test(metricName)) m = Sm.perWave[Number(metricName.slice(5)) - 1].clearRate;
    else if (metricName === 'waves') m = Sm.avgWavesCleared;
    else throw new Error('metric 只支持 clear / reach1..reach8 / waves');
    if (baselineRes) m = metricName === 'clear' ? pairedDelta(res, baselineRes).delta : m - S.summarize(baselineRes).avgWavesCleared;
    return { m, Sm };
  };
  const target = Number(args['target-delta'] !== undefined ? args['target-delta'] : args.target);
  if (Number.isNaN(target)) throw new Error('请给 --target 0.3（目标通关率）或 --target-delta 0.03（目标提升）');
  console.log(`调参：旋钮 ${knob}（当前 ${base}），指标 ${metricName}${baselineRes ? '（相对基线提升）' : ''}，目标 ${target}，搜索区间 [${lo}, ${hi}]，每步 ${runs} 局`);
  const geo = knob.startsWith('wave.');
  let fLo = await evalAt(lo);
  let fHi = await evalAt(hi);
  console.log(`  区间端点：${lo} → ${fLo.m.toFixed(3)}，${hi} → ${fHi.m.toFixed(3)}`);
  const inc = fHi.m > fLo.m;
  if ((target - fLo.m) * (target - fHi.m) > 0) {
    console.log('⚠ 目标不在这个区间能达到的范围内，用 --range 放宽区间再试。');
    pool.close();
    return;
  }
  let best = null;
  for (let k = 0; k < iters; k++) {
    let mid = geo ? Math.sqrt(lo * hi) : (lo + hi) / 2;
    if (integer) mid = Math.round(mid);
    const f = await evalAt(mid);
    console.log(`  第 ${k + 1} 步：${knob} = ${geo ? mid.toFixed(3) : mid} → ${f.m.toFixed(3)}`);
    if (!best || Math.abs(f.m - target) < Math.abs(best.m - target)) best = { v: mid, ...f };
    if ((f.m < target) === inc) lo = mid; else hi = mid;
    if (integer && hi - lo <= 1) break;
  }
  pool.close();
  console.log(`\n推荐：${knob} = ${geo ? best.v.toFixed(3) : best.v}（指标 ${best.m.toFixed(3)}）`);
  let advice = '';
  if (knob === 'wave.hp') {
    advice = '把 v14Data.js 的 WAVE_CONFIG.hp 改成：\n' + G.D.WAVE_CONFIG.map((c) => `  第 ${c.wave} 波 hp: ${c.hp} → ${Math.round((c.hp * best.v) / 10) * 10}`).join('\n');
  } else if (knob === 'wave.dmg') {
    advice = '把 v14Data.js 的 WAVE_CONFIG 伤害改成：\n' + G.D.WAVE_CONFIG.map((c) => `  第 ${c.wave} 波 heavyDmg ${c.heavyDmg} → ${Math.round(c.heavyDmg * best.v)}，ultDmg ${c.ultDmg} → ${Math.round(c.ultDmg * best.v)}`).join('\n');
  } else {
    advice = `把 ${knob} 从 ${base} 改成 ${best.v}`;
  }
  console.log(advice);
  console.log('\n' + S.formatSummary(best.Sm, '推荐值下的表现'));
  saveReport('tune', [`# 调参结果 · ${knob}`, '', cfgLabel(cfg0), '', `目标 ${metricName} = ${target}，推荐值 **${geo ? best.v.toFixed(3) : best.v}**（实测 ${best.m.toFixed(3)}）`, '', '```', advice, '```', '', S.formatSummaryMd(best.Sm, '推荐值下的表现')].join('\n'), null);
}

// ---- 按每波目标「累计通过率」逐波调 Boss 血量 ----
async function cmdTuneCurve(args) {
  const cfg0 = baseCfg(args);
  const runs = Number(args.runs || 300);
  const seed = Number(args.seed || 1);
  const targets = list(args.target).map(Number);
  if (targets.length !== 8) throw new Error('--target 需要 8 个数，例如 0.98,0.95,0.9,0.8,0.7,0.6,0.5,0.35（打过第 1..8 波的累计比例）');
  const pool = makePool(args);
  const G = loadGame({ overrides: cfg0.overrides });
  const hp = G.D.WAVE_CONFIG.map((c) => c.hp);
  const iters = Number(args.iters || 7);
  const waveOv = (arr) => ({ data: { WAVE_CONFIG: Object.fromEntries(arr.map((h, i) => [i + 1, { hp: h }])) } });
  for (let w = 1; w <= 8; w++) {
    let lo = 0.3, hi = 3, best = null;
    for (let k = 0; k < iters; k++) {
      const m = Math.sqrt(lo * hi);
      const arr = hp.slice();
      arr[w - 1] = Math.round(hp[w - 1] * m);
      const cfg = { ...cfg0, overrides: mergeOverrides(cfg0.overrides, waveOv(arr)), stopAfterWave: w };
      const Sm = S.summarize(await pool.run(cfg, runs, seed));
      const got = Sm.perWave[w - 1].clearRate;
      if (!best || Math.abs(got - targets[w - 1]) < Math.abs(best.got - targets[w - 1])) best = { m, got };
      if (got > targets[w - 1]) lo = m; else hi = m;
    }
    const old = hp[w - 1];
    hp[w - 1] = Math.round((hp[w - 1] * best.m) / 10) * 10;
    console.log(`第 ${w} 波：hp ${old} → ${hp[w - 1]}，累计通过 ${S.pct(best.got)}（目标 ${S.pct(targets[w - 1])}）`);
  }
  const finalCfg = { ...cfg0, overrides: mergeOverrides(cfg0.overrides, waveOv(hp)) };
  const Sm = S.summarize(await pool.run(finalCfg, runs, seed + 100000));
  pool.close();
  console.log('\n用新血量、换一批种子复测：\n' + S.formatSummary(Sm));
  const ovPath = path.join(REPORT_DIR, 'tuned-wave-hp.json');
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(ovPath, JSON.stringify(waveOv(hp), null, 2));
  console.log(`\n新血量已存为 overrides：${path.relative(process.cwd(), ovPath)}（可用 --override 带上它复测，确认后再改 v14Data.js）`);
  saveReport('tune-curve', ['# 逐波血量调参', '', cfgLabel(cfg0), '', `目标累计通过率：${targets.map((t) => S.pct(t, 0)).join(' / ')}`, '', S.mdTable(['波次', '原 hp', '新 hp'], G.D.WAVE_CONFIG.map((c, i) => ['W' + c.wave, c.hp, hp[i]])), '', S.formatSummaryMd(Sm, '复测（新种子）')].join('\n'), null);
}

function cmdCheck(args) {
  if (args.accept) {
    writeLock(typeof args.accept === 'string' ? args.accept : '手动确认同步');
    console.log('已记录当前 v14Main.js 流程指纹。');
    return;
  }
  const d = checkDrift();
  if (d.firstRun) { writeLock('首次运行自动记录'); console.log('首次运行，已记录流程指纹。'); return; }
  if (d.ok) console.log('✓ v14Main.js 的流程逻辑与模拟器一致。');
  else console.log('⚠ 这些方法的数值逻辑变了，需要同步 sim/lib/flow.js：' + d.changed.join('、'));
  // 冒烟：每个英雄 × 随机流派各跑几局，确认不报错
  const { runOne } = require('./lib/pool');
  const G = loadGame({});
  let errs = 0, n = 0;
  for (const h of G.HEROES) {
    for (let s = 1; s <= 3; s++) {
      n++;
      const r = runOne(G, { heroId: h.id, ascension: 0, themes: 'random', forceCards: [], forceRelics: [], banCards: [] }, s);
      if (r.error) { errs++; console.log(`  ✗ ${h.id} 种子 ${s}：${r.error.split('\n')[0]}`); }
    }
  }
  console.log(`冒烟测试：${n} 局，报错 ${errs} 局`);
}

function cmdList(args) {
  const G = loadGame({ overrides: loadOverridesFile(args.override) });
  const what = args._[1] || 'cards';
  if (what === 'cards') for (const h of G.D.SHOP_HEROES) console.log(`${h.id.padEnd(18)} ${h.theme.padEnd(8)} ${h.tier.padEnd(4)} ${h.name}`);
  if (what === 'relics') for (const r of G.D.RELICS) console.log(`${r.id.padEnd(18)} ${r.theme.padEnd(8)} ${r.tier.padEnd(4)} ${r.cost}G ${r.name}`);
  if (what === 'heroes') for (const h of G.HEROES) console.log(`${h.id.padEnd(10)} ${h.name}  ${h.desc}`);
  if (what === 'bosses') G.D.BOSS_POOL.forEach((b, i) => console.log(`${i} ${b.id.padEnd(14)} ${b.name} ${b.pattern.join(',')}`));
  if (what === 'waves') for (const c of G.D.WAVE_CONFIG) console.log(`W${c.wave} hp ${c.hp} 重击 ${c.heavyDmg} 大招 ${c.ultDmg} 赏金 ${c.baseReward} Boss ${G.D.BOSS_POOL[c.bossIdx].name}`);
}

const HELP = `
《日蚀战团》强度回归模拟器

  node sim/cli.js run   [--runs 500] [--hero hero_01] [--asc 0] [--themes discard,shield,poison|random]
                        [--force-card id,...] [--force-relic id,...] [--ban-card id,...] [--ads]
                        [--override 文件.json] [--level expert|novice] [--ai ai参数.json] [--seed 1] [--workers N] [--name 报告名]
  node sim/cli.js scan  cards|relics|heroes|bosses [--runs 300] [--only id,...] [--theme shield] [--wave 4]
  node sim/cli.js tune  --target 0.30 [--knob wave.hp] [--metric clear|reach4|waves] [--range lo,hi]
  node sim/cli.js tune  --knob card.c_lone_wolf.atk --force-card c_lone_wolf --target-delta 0.03
  node sim/cli.js tune-curve --target 0.98,0.95,0.9,0.8,0.7,0.6,0.5,0.35
  node sim/cli.js check [--accept]      校验游戏流程是否改动 + 冒烟测试
  node sim/cli.js list  cards|relics|heroes|bosses|waves
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || 'help';
  if (cmd !== 'help' && cmd !== 'check') driftBanner();
  if (cmd === 'run') return cmdRun(args);
  if (cmd === 'scan') return cmdScan(args);
  if (cmd === 'tune') return cmdTune(args);
  if (cmd === 'tune-curve') return cmdTuneCurve(args);
  if (cmd === 'check') return cmdCheck(args);
  if (cmd === 'list') return cmdList(args);
  console.log(HELP);
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
