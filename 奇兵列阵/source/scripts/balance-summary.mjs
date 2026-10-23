import { readFileSync, writeFileSync } from 'node:fs';
const [input, output] = process.argv.slice(2);
const data = JSON.parse(readFileSync(input, 'utf8'));
const groups = {};
const metric = () => ({ n: 0, win: 0, draw: 0, lose: 0 });
const add = (m, b) => { m.n++; m[b.result]++; };
for (const r of data.rows) {
  const k = `${r.general}/${r.strategy}`;
  const s = groups[k] ??= { runs: 0, clear: 0, wins: 0, faults: 0, censored: 0, firstBattle: metric(),
    bossFirst: metric(), bossRematch: metric(), bossReached: {}, stages: {}, pools: {},
    hatchRuns: 0, hatches: 0, hatchFirstBattle: [], passiveWindows: {} };
  s.runs++; s.clear += +r.clear; s.wins += r.wins; s.faults += r.faults; s.censored += +r.stopped;
  s.pools[r.pool] = (s.pools[r.pool] ?? 0) + 1;
  let hatched = false;
  for (const [index, b] of r.battles.entries()) {
    if (b.firstBattle) add(s.firstBattle, b);
    const stage = s.stages[b.key] ??= { first: metric(), rematch: metric() };
    add(b.attempt === 1 ? stage.first : stage.rematch, b);
    if (b.kind === 'boss') {
      add(b.attempt === 1 ? s.bossFirst : s.bossRematch, b);
      const boss = s.bossReached[b.key] ??= { reached: 0, eventualWin: 0, finalClearAfterReached: 0 };
      if (b.attempt === 1) { boss.reached++; boss.finalClearAfterReached += +r.clear; }
      if (b.result === 'win') boss.eventualWin++;
    }
    if (b.hatchAfterBattle) { s.hatches++; if (!hatched) s.hatchFirstBattle.push(index + 1); hatched = true; }
    const window = s.passiveWindows[b.passives || '(none)'] ??= { battles: metric(), first: metric(), hatches: 0 };
    add(window.battles, b); if (b.firstBattleAfterPassive) add(window.first, b);
    window.hatches += +!!b.hatchAfterBattle;
  }
  s.hatchRuns += +hatched;
}
writeFileSync(output, JSON.stringify({ core: data.core, samplesPerGeneral: data.samplesPerGeneral, ...(data.provenance ? { provenance: data.provenance } : {}), groups }, null, 2));
for (const [key, s] of Object.entries(groups)) console.log(`${key.padEnd(20)} wins ${(s.wins/s.runs).toFixed(2)} clear ${s.clear}/${s.runs} first ${s.firstBattle.win}/${s.firstBattle.n} boss1 ${s.bossFirst.win}/${s.bossFirst.n} retry ${s.bossRematch.win}/${s.bossRematch.n} hatch ${s.hatchRuns} fault ${s.faults} censored ${s.censored}`);
