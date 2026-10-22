// 首领归因探针：读 sim.ts DUMP_BOSS 导出的真实首领战阵容，逐项关掉首领规则 / 削血，看胜率变化。
// BOSS_FILE=/tmp/boss.json BOSS=霜魇女皇 npx vite-node scripts/boss-probe.ts
declare const process: { env: Record<string, string | undefined> };
// @ts-expect-error Node host module; the browser project does not install @types/node.
import { readFileSync } from 'node:fs';
import { INTRINSIC_BOSS_RULES } from '../src/core/encounterRules';
import { simulate, type BattleSetup } from '../src/core/engine';

const all: { node: string; result: string; setup: BattleSetup }[] = JSON.parse(readFileSync(process.env.BOSS_FILE ?? '/tmp/boss.json', 'utf8'));
const want = process.env.BOSS ?? '霜魇女皇';
const cases = all.filter(c => c.node === want);
const intrinsic = INTRINSIC_BOSS_RULES as unknown as BattleSetup['rules'] & object[];
const saved = [...intrinsic];

type Variant = { name: string; mut: (s: BattleSetup) => BattleSetup; dropIntrinsic?: string; gazeEvery?: number };
const scaleUnit = (id: string, k: { atk?: number; hp?: number }) => (s: BattleSetup): BattleSetup => ({
  ...s, enemy: s.enemy.map(e => e && e.defId === id ? { ...e, atk: e.atk != null && k.atk ? Math.round(e.atk * k.atk) : e.atk, hp: e.hp != null && k.hp ? Math.round(e.hp * k.hp) : e.hp } : e),
});
const barrierEvery = (n: number) => (s: BattleSetup): BattleSetup => ({ ...s, rules: (s.rules ?? []).map(r => r.id === 'frostq_barrier' ? { ...r, trigger: { on: 'beatEnd' as const, every: n } } : r) });
const dropEnemy = (i: number) => (s: BattleSetup): BattleSetup => ({ ...s, enemy: s.enemy.map((e, j) => (j === i ? null : e)) });
const variants: Variant[] = [
  { name: '原样', mut: s => s },
  { name: '去掉凝视(固有)', mut: s => s, dropIntrinsic: 'frostq_freeze' },
  { name: '去掉屏障(遭遇)', mut: s => ({ ...s, rules: (s.rules ?? []).filter(r => r.id !== 'frostq_barrier') }) },
  { name: '两条都去掉', mut: s => ({ ...s, rules: (s.rules ?? []).filter(r => r.id !== 'frostq_barrier') }), dropIntrinsic: 'frostq_freeze' },
  { name: '女皇血 -20%', mut: scaleUnit('e_frostq', { hp: 0.8 }) },
  { name: '女皇攻 -25%', mut: scaleUnit('e_frostq', { atk: 0.75 }) },
  { name: '护卫兵去嘲讽', mut: s => ({ ...s, enemy: s.enemy.map(e => e && e.defId === 'e_guardian' ? { ...e, defId: 'e_brute' } : e) }) },
  { name: '去嘲讽+去屏障', mut: s => ({ ...s, rules: (s.rules ?? []).filter(r => r.id !== 'frostq_barrier'), enemy: s.enemy.map(e => e && e.defId === 'e_guardian' ? { ...e, defId: 'e_brute' } : e) }) },
  ...[4, 5].map(n => ({ name: `凝视每${n}拍`, mut: (s: BattleSetup) => s, gazeEvery: n })),
  ...[8, 9].map(n => ({ name: `屏障每${n}拍`, mut: barrierEvery(n) })),
  { name: '凝视4+屏障9', mut: barrierEvery(9), gazeEvery: 4 },
  { name: '双刃兵攻-33%', mut: scaleUnit('e_twin', { atk: 0.67 }) },
  { name: '双刃兵攻-33%+凝视5', mut: scaleUnit('e_twin', { atk: 0.67 }), gazeEvery: 5 },
  { name: '女皇血-30%', mut: scaleUnit('e_frostq', { hp: 0.7 }) },
  { name: '女皇血-20%+凝视5', mut: scaleUnit('e_frostq', { hp: 0.8 }), gazeEvery: 5 },
  { name: '女皇血-20%+凝视5+屏障9', mut: (s: BattleSetup) => barrierEvery(9)(scaleUnit('e_frostq', { hp: 0.8 })(s)), gazeEvery: 5 },
  { name: '凝视6', mut: (s: BattleSetup) => s, gazeEvery: 6 },
  { name: '凝视5+屏障9', mut: barrierEvery(9), gazeEvery: 5 },
  { name: '凝视6+屏障9', mut: barrierEvery(9), gazeEvery: 6 },
  { name: '凝视5+屏障12', mut: barrierEvery(12), gazeEvery: 5 },
  { name: '凝视4+屏障8', mut: barrierEvery(8), gazeEvery: 4 },
  { name: '凝视4+女皇血-15%', mut: scaleUnit('e_frostq', { hp: 0.85 }), gazeEvery: 4 },
  ...[0, 1, 2, 3, 4].map(i => ({ name: `删敌方第${i + 1}格`, mut: dropEnemy(i) })),
];
const ruleEvery = (id: string, n: number) => (s: BattleSetup): BattleSetup => ({ ...s, rules: (s.rules ?? []).map(r => r.id === id ? { ...r, trigger: { on: 'beatEnd' as const, every: n } } : r) });
const dropRule = (id: string) => (s: BattleSetup): BattleSetup => ({ ...s, rules: (s.rules ?? []).filter(r => r.id !== id) });
/** 虚空领主（1-9）：牵引为固有规则，战意为遭遇规则 */
const voidVariants: Variant[] = [
  { name: '原样', mut: s => s },
  { name: '去掉牵引(固有)', mut: s => s, dropIntrinsic: 'void_pull' },
  { name: '去掉战意(遭遇)', mut: dropRule('void_rally') },
  { name: '战意每12拍', mut: ruleEvery('void_rally', 12) },
  { name: '领主血 -15%', mut: scaleUnit('e_void', { hp: 0.85 }) },
  { name: '领主血 -25%', mut: scaleUnit('e_void', { hp: 0.75 }) },
  { name: '领主攻 -20%', mut: scaleUnit('e_void', { atk: 0.8 }) },
  { name: '领主血-15%+去战意', mut: (s: BattleSetup) => dropRule('void_rally')(scaleUnit('e_void', { hp: 0.85 })(s)) },
  ...[0, 1, 2, 3, 4].map(i => ({ name: `删敌方第${i + 1}格`, mut: dropEnemy(i) })),
];
const active = want === '虚空领主' ? voidVariants : variants;

console.log(`${want}：${cases.length} 场真实阵容`);
console.log('敌方：' + JSON.stringify(cases[0]?.setup.enemy));
for (const v of active) {
  intrinsic.length = 0; intrinsic.push(...saved.filter(r => (r as { id: string }).id !== v.dropIntrinsic).map(r => (r as { id: string }).id === 'frostq_freeze' && v.gazeEvery ? { ...r, trigger: { on: 'beatEnd', every: v.gazeEvery } } : r));
  let w = 0, d = 0, beats = 0;
  for (const c of cases) { const o = simulate({ ...v.mut(c.setup), record: false }); if (o.result === 'win') w++; if (o.result === 'draw') d++; beats += o.beats; }
  console.log(`${v.name.padEnd(12, '　')} 胜 ${(w / cases.length * 100).toFixed(1).padStart(5)}%  平 ${(d / cases.length * 100).toFixed(1).padStart(5)}%  拍 ${(beats / cases.length).toFixed(1)}`);
}
intrinsic.length = 0; intrinsic.push(...saved);
