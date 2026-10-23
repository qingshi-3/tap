import { readFileSync, writeFileSync } from 'node:fs';
const [oldPath, newPath, outPath] = process.argv.slice(2);
const oldData = JSON.parse(readFileSync(oldPath, 'utf8'));
const newData = JSON.parse(readFileSync(newPath, 'utf8'));
const key = r => `${r.general}/${r.strategy}/${r.seed}`;
const before = new Map(oldData.rows.map(r => [key(r), r]));
if (before.size !== newData.rows.length) throw new Error('Sample sizes differ');
const pairs = [], groups = {};
for (const b of newData.rows) {
  const a = before.get(key(b));
  if (!a || a.pool !== b.pool) throw new Error(`Seed/pool mismatch: ${key(b)}`);
  before.delete(key(b));
  const firstA = a.battles[0], firstB = b.battles[0];
  const delta = { general: b.general, strategy: b.strategy, seed: b.seed, pool: b.pool,
    wins: b.wins - a.wins, clearBefore: a.clear, clearAfter: b.clear,
    firstBefore: firstA.result, firstAfter: firstB.result,
    censoredBefore: a.stopped, censoredAfter: b.stopped };
  pairs.push(delta);
  const s = groups[`${b.general}/${b.strategy}`] ??= { n: 0, winsBefore: 0, winsAfter: 0,
    clearBefore: 0, clearAfter: 0, clearGained: 0, clearLost: 0,
    firstWinBefore: 0, firstWinAfter: 0, firstWinGained: 0, firstWinLost: 0,
    faultsBefore: 0, faultsAfter: 0, censoredBefore: 0, censoredAfter: 0 };
  s.n++; s.winsBefore += a.wins; s.winsAfter += b.wins;
  s.clearBefore += +a.clear; s.clearAfter += +b.clear;
  s.clearGained += +(!a.clear && b.clear); s.clearLost += +(a.clear && !b.clear);
  s.firstWinBefore += +(firstA.result === 'win'); s.firstWinAfter += +(firstB.result === 'win');
  s.firstWinGained += +(firstA.result !== 'win' && firstB.result === 'win');
  s.firstWinLost += +(firstA.result === 'win' && firstB.result !== 'win');
  s.faultsBefore += a.faults; s.faultsAfter += b.faults;
  s.censoredBefore += +a.stopped; s.censoredAfter += +b.stopped;
}
if (before.size) throw new Error('Unpaired baseline samples');
writeFileSync(outPath, JSON.stringify({ oldCore: oldData.core, newCore: newData.core, groups, pairs }, null, 2));
for (const [key, s] of Object.entries(groups)) console.log(`${key.padEnd(20)} meanWins ${(s.winsBefore/s.n).toFixed(2)} -> ${(s.winsAfter/s.n).toFixed(2)} clear ${s.clearBefore} -> ${s.clearAfter} (+${s.clearGained}/-${s.clearLost}) first ${s.firstWinBefore} -> ${s.firstWinAfter}`);
