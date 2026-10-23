import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = resolve('../output/balance-20261022/simulation');
const source = readFileSync(resolve(dir, 'final-runner.mjs'), 'utf8');
const modulePath = resolve(dir, 'faie-final-trace-core.mjs');
writeFileSync(modulePath, source.slice(0, source.lastIndexOf('// scripts/balance-revision.ts')) + '\nexport { playRun, simulate, unitDef };\n');
const { playRun, simulate, unitDef } = await import(pathToFileURL(modulePath).href);
const data = JSON.parse(readFileSync(resolve(dir, 'final.json'), 'utf8'));
const rows = [];
for (const strategy of ['steady', 'synergy']) {
  const selected = data.rows.find(r => r.general === 'faie' && r.strategy === strategy && !r.clear && !r.stopped && r.battles.at(-1).key === '3-9');
  if (!selected) throw new Error('Faie final boss sample missing');
  let setup, prep;
  const run = playRun({ general: 'faie', strategy, seed: selected.seed, requireLegalGeneral: true,
    onBattle: (r, s) => { setup = structuredClone(s); prep = structuredClone(r); } });
  if (run.wins !== selected.wins || run.clear !== selected.clear) throw new Error('Frozen replay differs');
  const out = simulate({ ...setup, record: true });
  let round = 1;
  const counter = { momentum: 0, earlyEnemyDeaths: 0, casts: [0, 0], healing: [0, 0], freezes: [0, 0], fatigue: [0, 0] };
  for (const { ev, snap } of out.log) {
    const side = uid => snap.find(u => u.uid === uid)?.side;
    if (ev.t === 'beat') round = ev.round ?? round;
    if (ev.t === 'gen' && ev.label === '乘胜') counter.momentum++;
    if (ev.t === 'death' && round <= 2 && side(ev.tgt) === 1) counter.earlyEnemyDeaths++;
    if (ev.t === 'act' && ev.mode === 'cast') counter.casts[ev.side]++;
    if (ev.t === 'heal') counter.healing[side(ev.tgt)] += ev.n;
    if (ev.t === 'frozenSkip') counter.freezes[side(ev.uid)]++;
    if (ev.t === 'dmg' && ev.kind === 'fatigue') counter.fatigue[side(ev.tgt)] += ev.n;
  }
  const row = { version: 'final frozen 0.8.2, momentum +1 cap2', seed: selected.seed, strategy,
    passives: prep.passives, generalPower: prep.genPower, slots: prep.slots, bench: prep.bench,
    setup, result: out.result, beats: out.beats, rounds: out.rounds, counters: counter, metrics: out.metrics,
    initial: out.initial.map(u => ({ ...u, name: unitDef(u.defId).name })),
    final: out.log.at(-1).snap.map(u => ({ ...u, name: unitDef(u.defId).name })) };
  writeFileSync(resolve(dir, `faie-final-failure-${strategy}-${selected.seed}.json`), JSON.stringify({ ...row, log: out.log }, null, 2));
  rows.push(row);
}
writeFileSync(resolve(dir, 'faie-final-failures.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows.map(r => ({ seed: r.seed, strategy: r.strategy, result: r.result, passives: r.passives, counters: r.counters, metrics: r.metrics }))));
