// 补给改动局部消融：固定同队、同敌、同种子，只切换被测变量；不是整局胜率。
// @ts-ignore node 内置模块，仅由 vite-node 执行
import { mkdirSync, writeFileSync } from 'node:fs';
import ghostData from '../../src/core/ghosts.json';
import { simulate, type UnitSpec } from '../../src/core/engine';
import { newRun, playerTeam, sell, useFood, type Owned, type RunState, type ShopItem } from '../../src/core/run';

const N = 300;
const copies = (lv: number) => [1, 3, 6][lv - 1];
const unit = (def: string, lv = 1, oid = 1): Owned => ({ oid, def, copies: copies(lv), atkBonus: 0, hpBonus: 0, foodHistory: [] });
function state(turn: number): RunState {
  const r = newRun(86420 + turn, { diff: 0 }); r.turn = turn; r.gold = 999; r.queue = Array(5).fill(null); r.shop = []; r.nextId = 1000;
  r.tc = { foods: 0, bought: 0, bear: {} }; r.relics = []; r.milkTurn = undefined; return r;
}
function food(r: RunState, def: string) { const s: ShopItem = { sid: r.nextId++, kind: 'food', def, locked: false, free: false }; r.shop.push(s); return s; }
const team = (r: RunState) => playerTeam(r).map(({ oid: _oid, ...u }) => u);
const totals = (t: UnitSpec[]) => t.reduce((s, u) => ({ atk: s.atk + u.atk, hp: s.hp + u.hp }), { atk: 0, hp: 0 });
const ghosts = (turns: number[]) => turns.flatMap((turn) => ((ghostData as { turns: Record<string, UnitSpec[][]> }).turns[String(turn)] ?? []).map((units) => ({ turn, units })));
function compare(a: UnitSpec[], b: UnitSpec[], pool: { turn: number; units: UnitSpec[] }[]) {
  let aw = 0, bw = 0, ad = 0, bd = 0, changed = 0;
  for (let i = 0; i < N; i++) {
    const seed = i * 104729 + 11; const enemy = pool[(i * 7919 + 17) % pool.length].units;
    const ar = simulate(a, enemy, seed).result, br = simulate(b, enemy, seed).result;
    if (ar === 'win') aw++; if (br === 'win') bw++; if (ar === 'draw') ad++; if (br === 'draw') bd++; if (ar !== br) changed++;
  }
  return { n: N, a: { wins: aw, draws: ad, winRate: aw / N, scoreRate: (aw + ad * 0.5) / N }, b: { wins: bw, draws: bd, winRate: bw / N, scoreRate: (bw + bd * 0.5) / N }, changedOutcomes: changed };
}

const scoutGhosts = ghosts([3, 4]);
const mageGhosts = ghosts([5, 6]);
const guardGhosts = ghosts([2, 3, 4]);
const mediumGhosts = ghosts([5, 6, 7, 8, 9, 10]);

// 身材消融按合法开放时点拆开：霜狼二阶对3-4回合，法师三阶对5-6回合。
const scoutNew: UnitSpec[] = [{ def: 'l_windblade', lvl: 1, atk: 3, hp: 6 }, { def: 'l_shield', lvl: 1, atk: 2, hp: 6 }, { def: 'v_scout', lvl: 1, atk: 3, hp: 4 }, { def: 'a_spine', lvl: 1, atk: 3, hp: 2 }, { def: 's_dart', lvl: 1, atk: 2, hp: 3 }];
const scoutOld = scoutNew.map((u) => u.def === 'v_scout' ? { ...u, atk: 2, hp: 2 } : { ...u });
const mageNew: UnitSpec[] = [{ def: 'l_windblade', lvl: 1, atk: 4, hp: 7 }, { def: 'l_shield', lvl: 1, atk: 3, hp: 7 }, { def: 'v_mage', lvl: 1, atk: 3, hp: 4 }, { def: 'a_spine', lvl: 1, atk: 4, hp: 3 }, { def: 's_dart', lvl: 1, atk: 4, hp: 4 }];
const mageOld = mageNew.map((u) => u.def === 'v_mage' ? { ...u, atk: 2, hp: 2 } : { ...u });

// 甲虫两回合：每回合喂同规格面包。旧语义只模拟额外+1/+1临时并在回合后清除；面包本身永久保留。
function guardTwoRoundsNew() {
  const r = state(2); r.queue = [unit('l_shield', 1, 1), unit('v_guard', 1, 2), unit('s_dart', 1, 3), null, null];
  for (let round = 0; round < 2; round++) { const s = food(r, 'f_bread'); useFood(r, s.sid, 1); r.queue[1]!.tmpAtk = 0; r.queue[1]!.tmpHp = 0; }
  return team(r);
}
function guardTwoRoundsOld() {
  const r = state(2); r.queue = [unit('l_shield', 1, 1), unit('v_guard', 1, 2), unit('s_dart', 1, 3), null, null];
  const g = r.queue[1]!;
  for (let round = 0; round < 2; round++) {
    // 面包永久+1/+1；旧甲虫的购买补给额外仅为本场，随后清空。
    g.atkBonus += 1; g.hpBonus += 1; g.tmpAtk = 1; g.tmpHp = 1; g.tmpAtk = 0; g.tmpHp = 0;
  }
  return team(r);
}
const guardOld = guardTwoRoundsOld(), guardNew = guardTwoRoundsNew();

function saleCase(count: number) {
  const r = state(8);
  r.queue = [unit('v_guard', 1, 1), unit('l_storm', 2, 2), unit('l_shield', 2, 3), unit('s_dancer', 2, 4), unit('a_engulf', 2, 5)];
  const spent = count * 3;
  for (let i = 0; i < count; i++) { const s = food(r, 'f_roast'); useFood(r, s.sid, 0); }
  const before = team(r); const sale = sell(r, 0)!; const after = team(r);
  return {
    count,
    construction: `甲虫定向吃${count}份烤全羊后卖给最近身后的2星风暴剑圣；其余阵容固定。`,
    economics: { foodSpend: spent, saleRefund: sale.gold, netGoldCost: spent - sale.gold, excludes: '未计甲虫本体购买、刷新、阶层等待和机会成本' },
    before: { team: before, totals: totals(before) }, after: { team: after, totals: totals(after) },
    battle: compare(before, after, mediumGhosts),
  };
}

const output = {
  generatedAt: new Date().toISOString(),
  warning: '局部消融固定阵容、敌人和seed，只回答单项机制改变在给定队形中的战斗差异；不是bot整局运营结果、自然成型率或全局早期胜率，不能用于声称早期差距缩小。',
  method: { engine: '真实 engine.simulate', n: N, seedFormula: 'i*104729+11', legalTiming: { scout: [3, 4], mage: [5, 6], guard: [2, 3, 4] }, mediumGhostTurns: [5, 6, 7, 8, 9, 10], ghostCounts: { scout: scoutGhosts.length, mage: mageGhosts.length, guard: guardGhosts.length, medium: mediumGhosts.length } },
  early: {
    scoutBodyOnly: { description: '二阶霜狼在合法开放后的3-4回合，仅基础身材2/2→3/4，其他完全一致。', oldTotals: totals(scoutOld), newTotals: totals(scoutNew), battle: compare(scoutOld, scoutNew, scoutGhosts) },
    mageBodyOnly: { description: '三阶法师在合法开放后的5-6回合，仅基础身材2/2→3/4，其他完全一致。', oldTotals: totals(mageOld), newTotals: totals(mageNew), battle: compare(mageOld, mageNew, mageGhosts) },
    guardTwoRounds: { description: '一阶甲虫对2-4回合幽灵；两回合均使用同规格面包，旧额外临时成长每回合清除，新额外永久成长保留。', oldTotals: totals(guardOld), newTotals: totals(guardNew), oldTeam: guardOld, newTeam: guardNew, battle: compare(guardOld, guardNew, guardGhosts) },
  },
  mediumGuardSales: [3, 4, 5].map(saleCase),
};
const dir = new URL('../../output/supply-audit/', import.meta.url); mkdirSync(dir, { recursive: true });
writeFileSync(new URL('early-control.json', dir), JSON.stringify(output, null, 2));
console.log(`scout body ${(output.early.scoutBodyOnly.battle.a.winRate * 100).toFixed(1)}% -> ${(output.early.scoutBodyOnly.battle.b.winRate * 100).toFixed(1)}%`);
console.log(`mage body ${(output.early.mageBodyOnly.battle.a.winRate * 100).toFixed(1)}% -> ${(output.early.mageBodyOnly.battle.b.winRate * 100).toFixed(1)}%`);
console.log(`guard ${(output.early.guardTwoRounds.battle.a.winRate * 100).toFixed(1)}% -> ${(output.early.guardTwoRounds.battle.b.winRate * 100).toFixed(1)}%`);
for (const x of output.mediumGuardSales) console.log(`sale${x.count}: totals ${x.before.totals.atk}/${x.before.totals.hp} -> ${x.after.totals.atk}/${x.after.totals.hp}, win ${(x.battle.a.winRate * 100).toFixed(1)}% -> ${(x.battle.b.winRate * 100).toFixed(1)}%, net ${x.economics.netGoldCost}g`);
