'use strict';

function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - r) / d, (c + r) / d];
}

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const median = (a) => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';

function summarize(results, maxWaves = 8) {
  const errors = results.filter((r) => r.error);
  const rs = results.filter((r) => !r.error);
  const n = rs.length;
  const wins = rs.filter((r) => r.won).length;
  const [lo, hi] = wilson(wins, n);
  const perWave = [];
  for (let w = 1; w <= maxWaves; w++) {
    const fights = [];
    for (const r of rs) for (const x of r.waves) if (x.wave === w) fights.push(x);
    const reached = rs.filter((r) => r.wavesCleared >= w - 1 && (r.waves.some((x) => x.wave === w))).length;
    const cleared = rs.filter((r) => r.wavesCleared >= w).length;
    const won = fights.filter((x) => x.won);
    perWave.push({
      wave: w,
      reachRate: n ? reached / n : 0,
      clearRate: n ? cleared / n : 0,                 // 累计：打过第 w 波的局占比
      passRate: reached ? cleared / reached : 0,      // 条件：到达第 w 波后打过的比例
      deaths: rs.filter((r) => r.deathWave === w).length,
      avgRounds: avg(won.map((x) => x.rounds)),
      avgHpStart: avg(fights.map((x) => x.hpStart)),
      avgHpLost: avg(fights.map((x) => x.hpLost)),
      berserkRate: fights.length ? fights.filter((x) => x.berserkRounds > 0).length / fights.length : 0,
      capRate: fights.length ? fights.filter((x) => x.capHit).length / fights.length : 0,
      ultRate: fights.length ? fights.filter((x) => x.ultTaken > 0).length / fights.length : 0,
      avgPeakHit: avg(fights.map((x) => x.peakHit)),
      avgShieldBlocked: avg(fights.map((x) => x.shieldBlocked))
    });
  }
  // 卡 / 秘宝出场统计（相关性，不等于因果；因果看 scan 的 A/B）
  const cardStat = {};
  const relicStat = {};
  for (const r of rs) {
    const cards = new Set(r.roster);
    for (const id of cards) { const s = (cardStat[id] = cardStat[id] || { owned: 0, wins: 0, offered: 0, picked: 0 }); s.owned++; if (r.won) s.wins++; }
    for (const id of new Set(r.relics)) { const s = (relicStat[id] = relicStat[id] || { owned: 0, wins: 0 }); s.owned++; if (r.won) s.wins++; }
    for (const p of r.picks || []) {
      if (p.type === 'hero') {
        for (const o of new Set(p.offered)) { const s = (cardStat[o] = cardStat[o] || { owned: 0, wins: 0, offered: 0, picked: 0 }); s.offered++; }
        cardStat[p.id].picked++;
      }
    }
  }
  return {
    runs: n, errors: errors.length, errorSamples: errors.slice(0, 3),
    clearRate: n ? wins / n : 0, ci: [lo, hi],
    avgWavesCleared: avg(rs.map((r) => r.wavesCleared)),
    revivesUsed: avg(rs.map((r) => r.revivesUsed || 0)),
    medianPeakHit: median(rs.map((r) => r.peakHit)),
    avgFinalRoster: avg(rs.map((r) => r.roster.length)),
    avgFinalRelics: avg(rs.map((r) => r.relics.length)),
    perWave, cardStat, relicStat
  };
}

function pad(s, n, right = false) {
  s = String(s);
  // 中文按 2 宽度
  const w = [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 2 : 1), 0);
  const sp = ' '.repeat(Math.max(0, n - w));
  return right ? sp + s : s + sp;
}

function table(headers, rows, widths) {
  const line = (cells) => cells.map((c, i) => pad(c, widths[i], i > 0)).join('  ');
  return [line(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

function mdTable(headers, rows) {
  return ['| ' + headers.join(' | ') + ' |', '|' + headers.map(() => '---').join('|') + '|', ...rows.map((r) => '| ' + r.join(' | ') + ' |')].join('\n');
}

function waveRows(S) {
  return S.perWave.map((w) => [
    'W' + w.wave, pct(w.clearRate), pct(w.passRate), w.avgRounds.toFixed(1), w.avgHpStart.toFixed(0),
    w.avgHpLost.toFixed(1), pct(w.berserkRate, 0), pct(w.ultRate, 0), pct(w.capRate, 0), Math.round(w.avgPeakHit)
  ]);
}
const WAVE_HEAD = ['波次', '累计通过', '本波通过', '平均回合', '开局血', '掉血', '狂暴率', '吃大招', '触顶', '峰值伤害'];

function formatSummary(S, title = '') {
  const out = [];
  if (title) out.push('== ' + title + ' ==');
  out.push(`局数 ${S.runs}${S.errors ? `（另有 ${S.errors} 局报错）` : ''} · 通关率 ${pct(S.clearRate)}（95% 区间 ${pct(S.ci[0])}~${pct(S.ci[1])}）· 平均打过 ${S.avgWavesCleared.toFixed(2)} 波 · 峰值伤害中位数 ${S.medianPeakHit}`);
  out.push(table(WAVE_HEAD, waveRows(S), [4, 8, 8, 8, 6, 6, 6, 6, 5, 8]));
  return out.join('\n');
}

function formatSummaryMd(S, title = '') {
  const out = [];
  if (title) out.push('## ' + title);
  out.push(`- 局数 **${S.runs}**${S.errors ? `（另有 ${S.errors} 局报错）` : ''}`);
  out.push(`- 通关率 **${pct(S.clearRate)}**（95% 置信区间 ${pct(S.ci[0])} ~ ${pct(S.ci[1])}）`);
  out.push(`- 平均打过 ${S.avgWavesCleared.toFixed(2)} 波，峰值单手伤害中位数 ${S.medianPeakHit}，结束时平均牌组 ${S.avgFinalRoster.toFixed(1)} 张、秘宝 ${S.avgFinalRelics.toFixed(1)} 件`);
  out.push('');
  out.push(mdTable(WAVE_HEAD, waveRows(S)));
  return out.join('\n');
}

module.exports = { summarize, formatSummary, formatSummaryMd, wilson, pct, avg, table, mdTable, pad };
