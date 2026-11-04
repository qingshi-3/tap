import { curNode, fight, newRun, settleBattle } from '../src/core/run';
import { nodeStep, shopTurn } from './bot';
const st: Record<string, [number, number]> = {}; const byAct: Record<string, [number, number]> = {};
const deathAt: Record<string, number> = {}; const lossBy: Record<string, number> = {};
let cleared = 0; const N = 200;
for (let i = 0; i < N; i++) {
  const r = newRun(i * 104729 + 11);
  while (r.phase === 'prep' && r.turn <= 40) {
    shopTurn(r, 1);
    if (nodeStep(r, 1)) continue;
    const n = curNode(r)!; const k = n.k + (n.form ? '' : '-nf');
    const out = fight(r); const a = `${r.act}:${n.k}`;
    const s = (st[k] ??= [0, 0]); s[1]++; const b = (byAct[a] ??= [0, 0]); b[1]++;
    if (out.result === 'win') { s[0]++; b[0]++; } else lossBy[a] = (lossBy[a] ?? 0) + (n.k === 'fight' ? 1 : 2);
    settleBattle(r, out);
    if ((r.phase as string) === 'lost') deathAt[`${r.act}:${r.layer}`] = (deathAt[`${r.act}:${r.layer}`] ?? 0) + 1;
  }
  if (r.phase === 'won') cleared++;
}
const pc = (x: [number, number]) => `${Math.round(x[0] / x[1] * 100)}%/${x[1]}`;
console.log('cleared', cleared / N);
console.log(Object.entries(st).map(([k, v]) => `${k} ${pc(v)}`).join('  '));
console.log(Object.entries(byAct).sort().map(([k, v]) => `${k} ${pc(v)}`).join('  '));
console.log('hearts lost', JSON.stringify(lossBy)); console.log('death', JSON.stringify(deathAt));
