import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = resolve('../output/balance-20261022/simulation');
const frozen = readFileSync(resolve(dir, 'candidate1-runner.mjs'), 'utf8');
const marker = '// scripts/balance-revision.ts';
if (!frozen.includes(marker)) throw new Error('Frozen bundle marker changed');
const modulePath = resolve(dir, 'candidate1-trace-core.mjs');
writeFileSync(modulePath, frozen.slice(0, frozen.lastIndexOf(marker)) + '\nexport { playRun, simulate, unitDef };\n');
const { playRun, simulate, unitDef } = await import(pathToFileURL(modulePath).href);
const data = JSON.parse(readFileSync(resolve(dir, 'candidate1.json'), 'utf8'));
const selected = [];
for (const strategy of ['steady', 'synergy']) {
  for (const stopped of [true, false]) {
    const row = data.rows.find(r => r.general === 'faie' && r.strategy === strategy && r.stopped === stopped && !r.clear);
    if (!row) throw new Error('Faie sample missing');
    selected.push(row);
  }
  const row = data.rows.find(r => r.general === 'reva' && r.strategy === strategy && !r.clear && !r.stopped && r.battles.at(-1).key === '3-9' && !selected.some(x => x.general === 'reva' && x.seed === r.seed));
  if (!row) throw new Error('Reva chapter-three failure missing');
  selected.push(row);
}
const result = [];
for (const selectedRow of selected) {
  let finalSetup, prep, nodeName;
  const run = playRun({ general: selectedRow.general, strategy: selectedRow.strategy, seed: selectedRow.seed,
    requireLegalGeneral: true, onBattle: (r, setup, _out, node) => {
      finalSetup = structuredClone(setup);
      prep = structuredClone(r);
      nodeName = node.name;
    } });
  if (run.wins !== selectedRow.wins || run.clear !== selectedRow.clear || (!run.r.over) !== selectedRow.stopped) throw new Error('Frozen replay differs');
  const out = simulate({ ...finalSetup, record: true });
  const byUnit = {};
  const counters = { loggedDamage: [0, 0], healing: [0, 0], earlyEnemyDeaths: 0, earlyPlayerDeaths: 0,
    playerCasts: 0, enemyCasts: 0, frozenSkip: [0, 0], fatigueDamage: [0, 0] };
  let round = 1, beat = 0;
  for (const { ev, snap } of out.log) {
    if (ev.t === 'beat') { round = ev.round ?? round; beat = ev.n; }
    const side = uid => snap.find(u => u.uid === uid)?.side;
    if (ev.t === 'dmg') {
      const targetSide = side(ev.tgt);
      if (targetSide !== undefined) {
        counters.loggedDamage[1 - targetSide] += ev.n;
        if (ev.kind === 'fatigue') counters.fatigueDamage[targetSide] += ev.n;
      }
      if (ev.src !== undefined) {
        const u = byUnit[ev.src] ??= { damage: 0, healing: 0, casts: 0 };
        u.damage += ev.n;
      }
    }
    if (ev.t === 'heal') {
      const targetSide = side(ev.tgt);
      if (targetSide !== undefined) counters.healing[targetSide] += ev.n;
      if (ev.src !== undefined) (byUnit[ev.src] ??= { damage: 0, healing: 0, casts: 0 }).healing += ev.n;
    }
    if (ev.t === 'death' && round <= 2) {
      if (side(ev.tgt) === 1) counters.earlyEnemyDeaths++;
      if (side(ev.tgt) === 0) counters.earlyPlayerDeaths++;
    }
    if (ev.t === 'act' && ev.mode === 'cast') {
      counters[ev.side === 0 ? 'playerCasts' : 'enemyCasts']++;
      (byUnit[ev.uid] ??= { damage: 0, healing: 0, casts: 0 }).casts++;
    }
    if (ev.t === 'frozenSkip') { const s = side(ev.uid); if (s !== undefined) counters.frozenSkip[s]++; }
    for (const u of snap) {
      if (u.charges === 0) {
        const entry = byUnit[u.uid] ??= { damage: 0, healing: 0, casts: 0 };
        entry.firstZeroCharges ??= { beat, round };
      }
    }
  }
  const final = out.log.at(-1)?.snap ?? [];
  const unit = u => ({ ...u, name: unitDef(u.defId).name, ...(byUnit[u.uid] ?? {}) });
  const moved = new Set((finalSetup.swaps ?? []).flat());
  const debuffedSetup = { ...finalSetup, enemy: finalSetup.enemy.map((u, i) => !u || !moved.has(i) ? u :
    { ...u, atk: Math.max(0, (u.atk ?? unitDef(u.defId).atk) - 1) }) };
  const debuffed = selectedRow.general === 'reva' ? simulate({ ...debuffedSetup, record: false }) : null;
  const legalSwap = selectedRow.general === 'reva' ? simulate({ ...finalSetup, swaps: [[0, 3]], record: false }) : null;
  const legalSwapDebuffed = selectedRow.general === 'reva' ? simulate({ ...finalSetup, swaps: [[0, 3]], enemy: finalSetup.enemy.map((u, i) => !u || ![0, 3].includes(i) ? u : { ...u, atk: Math.max(0, (u.atk ?? unitDef(u.defId).atk) - 1) }), record: false }) : null;
  const compact = o => o ? { result: o.result, beats: o.beats, rounds: o.rounds, metrics: o.metrics } : null;
  const entry = { version: 'candidate1 frozen bundle, before duel qualification guard',
    general: selectedRow.general, strategy: selectedRow.strategy, seed: selectedRow.seed,
    terminalKey: selectedRow.battles.at(-1).key, nodeName, stopped: selectedRow.stopped,
    setup: finalSetup, prep: { slots: prep.slots, bench: prep.bench, passives: prep.passives,
      generalPower: prep.genPower, gold: prep.gold, lives: prep.lives, stash: prep.stash },
    battle: { result: out.result, beats: out.beats, rounds: out.rounds, metrics: out.metrics, counters,
      initial: out.initial.map(unit), afterStart: out.afterStart.map(unit), final: final.map(unit) },
    counterfactualLegalSwap03: compact(legalSwap),
    counterfactualLegalSwap03MinusOne: compact(legalSwapDebuffed),
    counterfactualMovedMinusOne: debuffed ? { result: debuffed.result, beats: debuffed.beats, rounds: debuffed.rounds, metrics: debuffed.metrics } : null };
  const id = `${entry.general}-${entry.strategy}-${entry.seed}`;
  writeFileSync(resolve(dir, `failure-${id}.json`), JSON.stringify({ ...entry, log: out.log }, null, 2));
  result.push(entry);
}
writeFileSync(resolve(dir, 'failure-traces.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result.map(x => ({ general: x.general, strategy: x.strategy, seed: x.seed,
  key: x.terminalKey, stopped: x.stopped, result: x.battle.result, rounds: x.battle.rounds,
  beats: x.battle.beats, counters: x.battle.counters, swaps: x.setup.swaps,
  revaMinusOne: x.counterfactualMovedMinusOne?.result })), null, 2));
