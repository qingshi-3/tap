// 人为极端阵容的真实战斗引擎审计；不代表自然商店中的成型率。
// @ts-ignore node 内置模块，仅由 vite-node 执行
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import ghostData from '../../src/core/ghosts.json';
import { simulate, type UnitSpec } from '../../src/core/engine';
import { grantPrepMilk, newRun, playerTeam, sell, useFood, type Owned, type RunState, type ShopItem } from '../../src/core/run';

const SAMPLE_N = 300;
const copies = (lv: number) => [1, 3, 6][lv - 1];
const unit = (def: string, lv = 1, oid = 1): Owned => ({ oid, def, copies: copies(lv), atkBonus: 0, hpBonus: 0, foodHistory: [] });
function state(): RunState {
  const r = newRun(97531, { diff: 0 });
  r.turn = 11; r.gold = 999; r.queue = Array(5).fill(null); r.shop = []; r.nextId = 1000;
  r.tc = { foods: 0, bought: 0, bear: {} }; r.relics = []; r.milkTurn = undefined;
  return r;
}
function food(r: RunState, def: string, val?: [number, number]) {
  const s: ShopItem = { sid: r.nextId++, kind: 'food', def, locked: false, free: def === 'f_milk', val };
  r.shop.push(s); return s;
}
const team = (r: RunState) => playerTeam(r).map(({ oid: _oid, ...u }) => u);
const totals = (t: UnitSpec[]) => t.reduce((s, u) => ({ atk: s.atk + u.atk, hp: s.hp + u.hp }), { atk: 0, hp: 0 });
function distributeSameTotals(source: UnitSpec[]): UnitSpec[] {
  const total = totals(source); const n = source.length;
  const spread = (sum: number, i: number) => Math.floor(sum / n) + (i < sum % n ? 1 : 0);
  return source.map((u, i) => ({ ...u, atk: spread(total.atk, i), hp: spread(total.hp, i) }));
}

type Scenario = { id: string; description: string; artificialCost: string; actual: UnitSpec[]; noReplay: UnitSpec[]; distributed: UnitSpec[]; formationNotes: string[] };

function catRoasts(): Scenario {
  const make = (replay: boolean) => {
    const r = state(); r.queue = [unit('v_guard', 1, 1), unit('v_queen', 3, 2), unit('l_shield', 2, 3), unit('l_shield', 2, 4), unit('l_shield', 2, 5)];
    for (let i = 0; i < 5; i++) { const s = food(r, 'f_roast'); useFood(r, s.sid, 0); }
    if (replay) sell(r, 0); else r.queue[0] = null;
    return team(r);
  };
  const actual = make(true), noReplay = make(false);
  return { id: 'cat-five-roasts', description: '3星霜冠执政官接收卖出单位记录的5份烤全羊，真实重吃并受50上限。', artificialCost: '标称5份补给=15金；另需3星执政官6份=18金、记录载体1份=3金，未计刷新与存活机会，总计至少36金。', actual, noReplay, distributed: distributeSameTotals(actual), formationNotes: ['实际与无重吃控制最终都是执政官+3名2星银盾侍卫。', '等总属性控制保留相同单位/星级/顺序，只把实际阵容总攻血均匀分散。'] };
}

function cowMilkCat(): Scenario {
  const make = (eat: boolean) => {
    const r = state(); r.queue = [unit('v_sentinel', 3, 1), unit('v_queen', 3, 2), unit('l_shield', 2, 3), unit('l_shield', 2, 4), unit('l_shield', 2, 5)];
    grantPrepMilk(r);
    if (eat) { const m = r.shop.find((x) => x.def === 'f_milk')!; useFood(r, m.sid, 1); }
    return team(r);
  };
  const actual = make(true), noReplay = make(false);
  return { id: 'cow-milk-cat', description: '3星冰角战兽在整备入口产3/3免费牛奶，3星执政官直接吃成+9/+9。', artificialCost: '牛奶0金；两张3星单位各6份，标称单位购买36金，未计刷新与阶层开放。', actual, noReplay, distributed: distributeSameTotals(actual), formationNotes: ['控制阵容同阵但不使用免费奶。', '等总属性控制保留同单位/星级/顺序并均匀分散实际总攻血。'] };
}

function wyvernChain(): Scenario {
  const make = (feed: boolean) => {
    const r = state(); r.queue = [unit('l_shield', 2, 1), unit('v_wyvern', 3, 2), unit('l_shield', 2, 3), unit('v_wyvern', 3, 4), unit('l_shield', 2, 5)];
    if (feed) for (let i = 0; i < 5; i++) { const s = food(r, 'f_roast'); useFood(r, s.sid, 2); }
    return team(r);
  };
  const actual = make(true), noReplay = make(false);
  return { id: 'two-wyverns-five-roasts', description: '两只3星白霜巨龙夹住直接吃者；连续5份烤全羊，每次只向各自外侧物理邻格分发且不递归。', artificialCost: '5份烤全羊15金；两只3星白龙12份单位=36金，其余阵容另计，且需要6阶开放与精确站位。', actual, noReplay, distributed: distributeSameTotals(actual), formationNotes: ['控制阵容单位、星级、顺序相同但不吃5份羊。', '等总属性控制把联动后的全队总攻血均匀分散，隔离属性集中位置的影响。'] };
}

const scenarios = [catRoasts(), cowMilkCat(), wyvernChain()];
const lateTurns = Object.entries((ghostData as { turns: Record<string, UnitSpec[][]> }).turns).filter(([turn]) => Number(turn) >= 11);
const opponents = lateTurns.flatMap(([turn, teams]) => teams.map((units) => ({ turn: Number(turn), units })));
if (opponents.length < 200) throw new Error(`后期幽灵样本不足200，实际${opponents.length}`);
const sample = Array.from({ length: SAMPLE_N }, (_, i) => ({ seed: i * 104729 + 11, opponent: opponents[(i * 7919 + 17) % opponents.length] }));

function evaluate(t: UnitSpec[]) {
  let wins = 0, draws = 0, losses = 0;
  const byTurn: Record<string, { n: number; wins: number; draws: number }> = {};
  for (const x of sample) {
    const result = simulate(t, x.opponent.units, x.seed).result;
    if (result === 'win') wins++; else if (result === 'draw') draws++; else losses++;
    const b = byTurn[x.opponent.turn] ??= { n: 0, wins: 0, draws: 0 }; b.n++; if (result === 'win') b.wins++; if (result === 'draw') b.draws++;
  }
  return { n: sample.length, wins, draws, losses, winRate: wins / sample.length, scoreRate: (wins + draws * 0.5) / sample.length, byOpponentTurn: byTurn };
}

const results = scenarios.map((s) => ({
  ...s,
  totals: { actual: totals(s.actual), noReplay: totals(s.noReplay), distributed: totals(s.distributed) },
  capUnits: s.actual.filter((u) => u.atk >= 50 || u.hp >= 50).map((u) => ({ def: u.def, atk: u.atk, hp: u.hp })),
  battles: { actual: evaluate(s.actual), noReplay: evaluate(s.noReplay), distributed: evaluate(s.distributed) },
}));

const comparison = JSON.parse(readFileSync(new URL('../../output/supply-audit/comparison.json', import.meta.url), 'utf8'));
const foodGroup = comparison.groups.find((g: any) => g.group === 'food');
const pre = JSON.parse(readFileSync(new URL('../../output/supply-audit/baseline-pre-change.json', import.meta.url), 'utf8'));
const post = JSON.parse(readFileSync(new URL('../../output/supply-audit/baseline-post-change.json', import.meta.url), 'utf8'));
const preFood = pre.groups.find((g: any) => g.group.id === 'food').summary.stages;
const postFood = post.groups.find((g: any) => g.group.id === 'food').summary.stages;
const foodStages = foodGroup.stageAggregateDeltas.map((d: any) => ({
  stage: d.stage,
  before: preFood.find((x: any) => x.stage === d.stage),
  after: postFood.find((x: any) => x.stage === d.stage),
  delta: d,
  winRatePercentagePoints: d.winRate * 100,
  caution: '只统计实际到达阶段的遭遇；后期到达人数变化会改变幸存者构成。',
}));
const output = {
  generatedAt: new Date().toISOString(),
  method: {
    engine: 'src/core/engine.ts simulate',
    opponentSource: 'src/core/ghosts.json，普通难度校准使用的后期(turn>=11)幽灵池',
    availableLateGhosts: opponents.length,
    samples: SAMPLE_N,
    seedFormula: 'i * 104729 + 11',
    opponentSelection: '(i * 7919 + 17) % availableLateGhosts',
    warning: '这些阵容由脚本定向购买/喂食/出售构造，仅测机制上界与战斗形状；标称金币不含刷新、阶层等待、商店概率和败退风险，不能解释为自然成型率。',
  },
  foodStageChanges: foodStages,
  results,
};
const dir = new URL('../../output/supply-audit/', import.meta.url); mkdirSync(dir, { recursive: true });
writeFileSync(new URL('extreme-battles.json', dir), JSON.stringify(output, null, 2));
for (const r of results) console.log(`${r.id}: actual ${(r.battles.actual.winRate * 100).toFixed(1)}% noReplay ${(r.battles.noReplay.winRate * 100).toFixed(1)}% distributed ${(r.battles.distributed.winRate * 100).toFixed(1)}% totals ${r.totals.actual.atk}/${r.totals.actual.hp}`);
console.log(`lateGhosts=${opponents.length} samples=${SAMPLE_N} saved extreme-battles.json`);
