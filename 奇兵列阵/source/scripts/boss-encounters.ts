// S5: Boss 遭遇战。每个推荐阵容打每章 Boss，不同星级，报告胜率。
declare const process: { env: Record<string, string | undefined>; exit(code: number): never; stderr: { write(s: string): void } };
import { COMBOS } from '../src/core/combos';
import { simulate } from '../src/core/engine';
import { chapter, type RouteNode } from '../src/core/route';
import type { Copies } from '../src/core/types';

const SEEDS = Number(process.env.SEEDS ?? 50);

const copies = (lv: number): Copies => (lv === 3 ? 4 : lv === 2 ? 2 : 1);
const team = (ids: string[], lv: number) => ids.map((defId, i) => ({ defId, ownedId: i + 1, copies: copies(lv) }));

const BOSSES = [
  { ch: 0, lv: 1, label: '1章1★ 虚空领主' },
  { ch: 1, lv: 2, label: '2章2★ 霜魇女皇' },
  { ch: 2, lv: 2, label: '3章2★ 永夜君王' },
  { ch: 2, lv: 3, label: '3章3★ 永夜君王' },
];

function getBoss(ch: number): RouteNode {
  return chapter(ch).stages.find(s => s.type === 'boss')!.main;
}

const pct = (a: number, b: number) => b ? ((a / b) * 100).toFixed(1) + '%' : '-';

console.log(`# Boss 遭遇战 (${COMBOS.length}阵容 × ${BOSSES.length}场景, seeds=${SEEDS})`);
console.log('');
console.log('| 阵容 | ' + BOSSES.map(b => b.label).join(' | ') + ' |');
console.log('|---|' + BOSSES.map(() => '---:|').join(''));

for (const c of COMBOS) {
  const row: string[] = [c.name];
  for (const boss of BOSSES) {
    let wins = 0, beats = 0;
    for (let s = 0; s < SEEDS; s++) {
      const out = simulate({
        player: team(c.units, boss.lv),
        enemy: getBoss(boss.ch).lineup,
        general: { id: c.general, power: boss.ch, passives: [] },
        seed: s * 7919 + boss.ch * 1000,
        record: false,
      });
      beats += out.beats;
      if (out.result === 'win') wins++;
    }
    row.push(`${pct(wins, SEEDS)} (均${(beats / SEEDS).toFixed(1)}拍)`);
  }
  console.log('| ' + row.join(' | ') + ' |');
}

// 汇总：平均胜率
console.log('');
console.log('## 各 Boss 平均胜率');
for (let i = 0; i < BOSSES.length; i++) {
  let total = 0;
  for (const c of COMBOS) {
    for (let s = 0; s < SEEDS; s++) {
      const out = simulate({
        player: team(c.units, BOSSES[i].lv),
        enemy: getBoss(BOSSES[i].ch).lineup,
        general: { id: c.general, power: BOSSES[i].ch, passives: [] },
        seed: s * 7919 + BOSSES[i].ch * 1000,
        record: false,
      });
      if (out.result === 'win') total++;
    }
  }
  console.log(`- ${BOSSES[i].label}: 平均胜率 ${pct(total, COMBOS.length * SEEDS)}`);
}