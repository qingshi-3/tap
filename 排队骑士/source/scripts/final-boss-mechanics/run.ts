// @ts-ignore -- project scripts run under Node, while the app tsconfig intentionally omits @types/node.
import { mkdirSync, writeFileSync } from 'node:fs';
import { BOSSES, CARDS, FOODS, RELICS } from '../../src/core/data';
import { bossTeam } from '../../src/core/run';
import { simulate, type BattleOut, type Ev, type UnitSpec } from '../../src/core/engine';
import { BOSSES as OLD_BOSSES, CARDS as OLD_CARDS, FOODS as OLD_FOODS, RELICS as OLD_RELICS } from '../final-hurt-boss/baseline/data';

type Level = 2 | 3;
type Check = { id: string; pass: boolean; expected: unknown; actual: unknown };
const checks: Check[] = [];
const check = (id: string, pass: boolean, expected: unknown, actual: unknown) => checks.push({ id, pass, expected, actual });
const spec = (def: string, lvl: Level, atk = 10, hp = 40, extra: Partial<UnitSpec> = {}): UnitSpec => ({ def, lvl, atk, hp, ...extra });
const candidate = (lvl: Level, stat = 10): UnitSpec[] => [
  spec('l_windblade', lvl, stat, Math.max(10, stat)), spec('d_worm', lvl, stat, Math.max(10, stat)),
  spec('l_warden', lvl, stat, Math.max(10, stat)), spec('l_archon', lvl, stat, Math.max(10, stat)),
  spec('l_storm', lvl, stat, Math.max(10, stat)),
];
const events = <T extends Ev['t']>(out: BattleOut, t: T) => out.events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);
const uid = (out: BattleOut, def: string, side = 1) => out.init.find((u) => u.side === side && u.def === def)!.uid;
const preClash = (out: BattleOut) => out.events.slice(0, out.events.findIndex((e) => e.t === 'clash'));

for (const lvl of [2, 3] as const) {
  const out = simulate([spec('l_shield', lvl, 1, 1000)], candidate(lvl), 17);
  const window = preClash(out);
  const worm = uid(out, 'd_worm'), warden = uid(out, 'l_warden'), storm = uid(out, 'l_storm');
  const hurtTargets = window.filter((e): e is Extract<Ev, { t: 'dmg' }> => e.t === 'dmg' && e.src === uid(out, 'l_windblade') && !e.blocked).map((e) => e.tgt);
  const wormTriggers = window.filter((e) => e.t === 'trigger' && e.uid === worm && e.label === '受伤').length;
  const wardenShots = window.filter((e): e is Extract<Ev, { t: 'dmg' }> => e.t === 'dmg' && e.src === warden && e.kind === 'shot');
  const stormTriggers = window.filter((e) => e.t === 'trigger' && e.uid === storm && e.label === '友军受伤').length;
  const stormBuffs = window.filter((e): e is Extract<Ev, { t: 'buff' }> => e.t === 'buff' && e.tgt === storm);
  const expectedTargets = lvl === 2 ? 3 : 4;
  check(`lv${lvl}.first-wave-targets`, hurtTargets.length === expectedTargets, expectedTargets, hurtTargets);
  check(`lv${lvl}.worm-feeds-front`, wormTriggers === 1 && window.some((e) => e.t === 'buff' && e.src === worm && e.tgt === uid(out, 'l_windblade')), '巨虫触发1次且反哺队首', { wormTriggers, frontBuffed: window.some((e) => e.t === 'buff' && e.src === worm && e.tgt === uid(out, 'l_windblade')) });
  check(`lv${lvl}.warden-archon-double`, wardenShots.length === 2 && wardenShots.every((e) => e.n === (lvl === 2 ? 6 : 9)), `2次×${lvl === 2 ? 6 : 9}`, wardenShots.map((e) => e.n));
  // 风暴不观察自身受伤：二星风刃伤3名且都不是风暴；三星伤4名但风暴只观察另外3名。
  check(`lv${lvl}.storm-observed-hurts`, stormTriggers === 3, 3, stormTriggers);
  const finalStorm = stormBuffs.at(-1);
  const expectedStormStat = 10 + (lvl === 2 ? 4 : 6) * 4; // 3次风暴自身成长 + 1次巨虫全队成长
  check(`lv${lvl}.storm-actual-growth`, finalStorm?.nowAtk === expectedStormStat && finalStorm?.nowHp === expectedStormStat, expectedStormStat, finalStorm ? [finalStorm.nowAtk, finalStorm.nowHp] : null);
}

{
  const durable = candidate(3, 1).map((u) => ({ ...u, hp: 50 }));
  const out = simulate([spec('l_shield', 3, 1, 1000)], durable, 23);
  const worm = uid(out, 'd_worm');
  const triggers = events(out, 'trigger').filter((e) => e.uid === worm && e.label === '受伤').length;
  check('worm.three-use-cap', triggers === 3, 3, triggers);
}

{
  const team = candidate(3, 49);
  const out = simulate([spec('l_shield', 3, 1, 1000)], team, 29);
  const window = preClash(out);
  const bossUids = new Set(out.init.filter((u) => u.side === 1).map((u) => u.uid));
  const over = window.filter((e): e is Extract<Ev, { t: 'buff' }> => e.t === 'buff' && bossUids.has(e.tgt) && (e.nowAtk > 50 || e.nowHp > 50));
  const stormBuffs = window.filter((e): e is Extract<Ev, { t: 'buff' }> => e.t === 'buff' && e.tgt === uid(out, 'l_storm'));
  check('battle-stat-cap-50', over.length === 0 && stormBuffs.at(-1)?.nowAtk === 50 && stormBuffs.at(-1)?.nowHp === 50, '所有事件<=50且风暴50/50', { over: over.map((e) => ({ src: e.src, tgt: e.tgt, nowAtk: e.nowAtk, nowHp: e.nowHp })), storm: stormBuffs.at(-1) && [stormBuffs.at(-1)!.nowAtk, stormBuffs.at(-1)!.nowHp] });
}

{
  const team = candidate(3);
  team[1] = { ...team[1], ench: 'amulet' };
  const out = simulate([spec('l_shield', 3, 1, 1000)], team, 31);
  const window = preClash(out), worm = uid(out, 'd_worm');
  const blocked = window.filter((e) => e.t === 'dmg' && e.tgt === worm && e.blocked).length;
  const broadcasts = window.filter((e) => e.t === 'trigger' && e.uid === worm && e.label === '受伤').length;
  check('blocked-hurt-does-not-broadcast', blocked === 1 && broadcasts === 0, { blocked: 1, broadcasts: 0 }, { blocked, broadcasts });
}

const unchanged = {
  otherBosses: (['wall', 'tide', 'forge', 'horde'] as const).every((k) => JSON.stringify(BOSSES[k]) === JSON.stringify(OLD_BOSSES[k])),
  playerCards: JSON.stringify(CARDS) === JSON.stringify(OLD_CARDS),
  foods: JSON.stringify(FOODS) === JSON.stringify(OLD_FOODS),
  relics: JSON.stringify(RELICS) === JSON.stringify(OLD_RELICS),
};
check('baseline-non-final-unchanged', Object.values(unchanged).every(Boolean), 'all true', unchanged);
check('final-definition', JSON.stringify(BOSSES.final.units) === JSON.stringify(['l_windblade', 'd_worm', 'l_warden', 'l_archon', 'l_storm']) && BOSSES.final.lvl === undefined, '冻结顺序，保留默认星级', BOSSES.final);

const budgetSnapshots = [15, 18, 21].map((turn) => ({ turn, units: bossTeam(BOSSES.final, turn, 1.1) }));
const result = { generatedAt: new Date().toISOString(), scope: '小型行为契约；未运行完整通关模拟或自适应lift', checks, passed: checks.filter((x) => x.pass).length, failed: checks.filter((x) => !x.pass).length, budgetSnapshots };
mkdirSync('output/final-boss-mechanics', { recursive: true });
writeFileSync('output/final-boss-mechanics/verification.json', JSON.stringify(result, null, 2));
const report = [`# 最终 Boss 受伤流机制验证`, ``, `结果：${result.passed}/${checks.length} 通过。`, ``, ...checks.map((x) => `- ${x.pass ? 'PASS' : 'FAIL'} \`${x.id}\`：期望 ${JSON.stringify(x.expected)}；实际 ${JSON.stringify(x.actual)}`), ``, `## 口径`, ``, `仅做事件级行为验证，并保存 T15/T18/T21 在相同 mul=1.1 下的 bossTeam 初始属性。未调用 makeEnemy/lift，不能解释为完整通关率或实际自适应后的强度。`, ``].join('\n');
writeFileSync('output/final-boss-mechanics/report.md', report);
console.log(JSON.stringify({ passed: result.passed, failed: result.failed, output: 'output/final-boss-mechanics/verification.json' }));
if (result.failed) (globalThis as any).process.exitCode = 1;
