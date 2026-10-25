// 真实战斗统计回归：vite-node scripts/battle-stats-test.ts [--baseline=/path/to/old-engine.ts]
// @ts-ignore Node built-in, this script runs only in vite-node.
import { readFileSync } from 'node:fs';
import * as ts from 'typescript';
import * as data from '../src/core/data';
import { simulate, type BattleOut, type UnitSpec } from '../src/core/engine';
import { BattleStatsCollector, type BattleDamageSource, type UnitBattleStats } from '../src/core/battleStats';

let checks = 0;
function assert(ok: unknown, message: string): asserts ok {
  checks++;
  if (!ok) throw new Error(message);
}
function eq(a: unknown, b: unknown, message: string) { assert(JSON.stringify(a) === JSON.stringify(b), `${message}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
const u = (atk = 3, hp = 10, extra: Partial<UnitSpec> = {}): UnitSpec => ({ def: 'd_artificer', lvl: 1, atk, hp, ...extra });
const row = (b: BattleOut, uid = 1) => b.stats.units.find((s) => s.uid === uid)!;
const sourceDamage = (s: UnitBattleStats, kind: string) => s.damageBySource.filter((x) => x.kind === kind).reduce((n, x) => n + x.damage, 0);
function invariant(b: BattleOut) {
  for (const s of b.stats.units) {
    eq(s.damageDealt, s.damageBySource.reduce((n, x) => n + x.damage, 0), `source sum ${s.uid}`);
    assert(s.damageTaken >= s.shieldAbsorbed && s.hitsTaken >= s.blockedHits, `taken counters ${s.uid}`);
    for (const n of [s.damageDealt, s.damageTaken, s.kills, s.hitsTaken, s.blockedHits, s.shieldAbsorbed, s.selfDamage, s.friendlyDamageTaken]) assert(Number.isInteger(n) && n >= 0, `nonnegative integer ${s.uid}`);
  }
  for (const side of [0, 1]) eq(b.stats.units.filter((s) => s.side === side).reduce((n, s) => n + s.damageDealt, 0), b.stats.units.filter((s) => s.side !== side).reduce((n, s) => n + s.damageTaken, 0), 'opposing damage totals');
}
function battle(left: UnitSpec[], right: UnitSpec[], relics: string[] = [], seed = 1) { const b = simulate(left, right, seed, relics); invariant(b); return b; }

{
  const b = battle([u(3, 10)], [u(2, 8)]);
  eq([row(b).damageDealt, row(b).damageTaken, row(b).kills, row(b).hitsTaken], [8, 6, 1, 3], 'ordinary simultaneous melee');
  eq(sourceDamage(row(b), 'attack'), 8, 'ordinary category');
}
{
  const b = battle([u(50)], [u(1, 3)]);
  eq(row(b).damageDealt, 3, 'overkill excluded');
  eq(row(b, 2).damageDealt, 1, 'simultaneous attack after own fatal hit retained');
}
{
  const b = battle([u(3, 30)], [u(1, 10, { ench: 'iron' })]);
  eq(row(b, 2).blockedHits, 1, 'block counts once');
  eq(row(b).damageDealt, 10, 'blocked damage excluded');
  eq(row(b, 2).hitsTaken, 5, 'blocked hit included');
}
{
  const b = battle([u(5, 30)], [u(1, 10, { ax: ['shield'] })]);
  eq(row(b).damageDealt, 12, 'partial shield plus actual health');
  eq(row(b, 2).shieldAbsorbed, 2, 'partial shield amount');
  eq(row(b, 2).blockedHits, 0, 'shield is not block layer');
  eq(row(b, 2).hitsTaken, 3, 'partial shield hits');
}
{
  const b = battle([u(2, 30)], [u(1, 20, { ax: ['shield'] })]);
  eq(row(b).damageDealt, 24, 'full shield absorption included');
  eq(row(b, 2).shieldAbsorbed, 4, 'full shield amount');
  eq(row(b, 2).blockedHits, 0, 'full shield hit not block');
}
{
  const b = battle([u(99, 30)], [u(1, 5, { ax: ['undying'] })]);
  eq(row(b).damageDealt, 4, 'undying lock excludes prevented health loss');
  eq(row(b).kills, 0, 'undying exhaustion has no fictitious killer');
  assert(b.events.some((e) => e.t === 'trigger' && e.label === '不屈耗尽'), 'undying exhaustion fixture');
}
{
  const b = battle([u(10, 10, { def: 'l_windblade', tfx: ['berry'] }), u(1, 20)], [u(1, 10)]);
  eq(row(b).selfDamage, 1, 'self damage recorded separately');
  eq(row(b, 2).friendlyDamageTaken, 1, 'friendly damage recorded separately');
  eq(row(b, 2).damageTaken, 0, 'friendly damage excluded from enemy taken');
  eq(row(b, 2).hitsTaken, 0, 'friendly damage excluded from hits');
  eq(row(b).damageDealt, 10, 'self and friendly damage excluded from output');
}
{
  const b = battle([u(1, 1, { def: 'a_imp' })], [u(1, 6)]);
  eq(b.stats.units.length, 2, 'summon has no duplicate owner row');
  eq(row(b).summons, 1, 'summon count');
  eq(row(b).runtimeUids.length, 2, 'summon lineage');
  eq(sourceDamage(row(b), 'summon'), 4, 'summon damage attributed to summoner');
  eq(row(b).damageDealt, 5, 'owner plus summon damage counted once');
}
{
  const b = battle([u(2, 1, { lamp: true })], [u(1, 6)]);
  eq(b.stats.units.length, 2, 'revival no duplicate row');
  eq([row(b).revives, row(b).summons, row(b).runtimeUids.length], [1, 0, 2], 'revival lineage');
  eq(sourceDamage(row(b), 'attack'), 4, 'revived initial unit preserves ordinary attack source');
  eq(sourceDamage(row(b), 'summon'), 0, 'revived initial unit is not summon damage');
}
{
  const b = battle([u(1, 20, { ench: 'b_torch' })], [u(1, 3)]);
  eq(sourceDamage(row(b), 'equipment'), 2, 'burn tracks equipment source');
  eq(row(b).kills, 1, 'burn lethal credited to original applier');
  eq(row(b, 2).hitsTaken, 2, 'burn one tick is one hit');
  assert(b.events.some((e) => e.t === 'dmg' && e.kind === 'burn' && e.src === null), 'burn legacy event kept');
}
{
  const b = battle([u(1, 1, { ench: 'b_torch' })], [u(1, 10)]);
  eq(sourceDamage(row(b), 'equipment'), 2, 'dead applier retains burn output');
}
{
  const b = battle([u(1, 1, { ench: 'b_torch' }), u(1, 1, { ench: 'b_torch' })], [u(1, 6)]);
  eq([row(b).damageDealt, row(b, 2).damageDealt], [5, 1], 'multiple burn stacks oldest layer consumes effective damage first');
  eq([row(b).kills, row(b, 2).kills], [1, 0], 'last effective burn layer owns lethal');
}
{
  const b = battle([u(1, 30, { def: 's_dart' })], [u(1, 10)]);
  eq(sourceDamage(row(b), 'skill'), 1, 'direct skill source');
}
for (const [extra, kind, label] of [
  [{ ench: 'chili' }, 'equipment', 'equipment splash'],
  [{ tfx: ['splash'] }, 'supply', 'supply splash'],
  [{ def: 'e_twin' }, 'skill', 'innate splash'],
  [{ ench: 'o_spear' }, 'equipment', 'spear'],
  [{ ench: 'b_lance' }, 'equipment', 'pierce'],
] as const) {
  const b = battle([u(10, 30, extra as Partial<UnitSpec>)], [u(1, 2), u(1, 20)]);
  assert(sourceDamage(row(b), kind) > 0, label);
}
for (const ench of ['p_thorn', 'o_storm'] as const) {
  const b = battle([u(1, 30, { ench })], [u(1, 10)]);
  assert(sourceDamage(row(b), 'equipment') > 0, `${ench} direct proc`);
}
for (const fx of ['bomb', 'thunder'] as const) {
  const b = battle([u(1, 30, { tfx: [fx] })], [u(1, 10)]);
  eq(sourceDamage(row(b), 'supply'), fx === 'bomb' ? 3 : 2, `${fx} supply source`);
}
for (const id of ['r_volley', 'r_rear']) {
  const b = battle([u(1, 30)], [u(1, 10)], [id]);
  const r = b.stats.units.find((s) => s.kind === 'relic' && s.def === id);
  assert(r && r.uid < 0 && r.damageDealt > 0, `${id} independent relic row`);
  eq(sourceDamage(row(b), 'relic'), 0, 'relic not falsely assigned to hero');
  eq(sourceDamage(r, 'relic'), r.damageDealt, 'relic category');
}
{
  const b = battle([u(1, 1)], [u(1, 2)], ['r_volley']);
  const relic = b.stats.units.find((s) => s.kind === 'relic')!;
  eq([row(b).kills, relic.kills, relic.damageDealt], [0, 1, 2], 'relic lethal belongs to relic');
}
{
  const b = battle([u(3, 20, { ench: 'wine' })], [u(1, 20)]);
  eq(sourceDamage(row(b), 'attack'), 20, 'melee bonus stays in ordinary attack without reverse allocation');
}
{
  const c = new BattleStatsCollector();
  const a = { uid: 1, def: 'd_artificer', lvl: 1 as const, side: 0 as const };
  const b = { ...a, uid: 2 };
  const t = { ...a, uid: 3, side: 1 as const };
  [a, b, t].forEach((x) => c.register(x, x.def));
  const source = (uid: number): BattleDamageSource => ({ uid, side: 0, kind: 'equipment', label: '火把' });
  c.hit(t, [{ source: source(1), amount: 2 }, { source: source(2), amount: 2 }], 3, 0, false, true);
  const s = c.finish().units;
  eq([s[0].damageDealt, s[1].damageDealt, s[0].kills, s[1].kills, s[2].hitsTaken], [2, 1, 0, 1, 1], 'mixed-source tick effective split and last lethal');
}
{
  const left = [u(1, 5, { ench: 'b_torch', lamp: true }), u(1, 10, { tfx: ['bomb'] })];
  const right = [u(1, 15), u(1, 10)];
  const b = battle(left, right, ['r_rear']);
  const before = JSON.stringify(b.stats);
  // 回放消费者可读取同一事件任意多次；统计由simulate固定产出，读取事件不会累加。
  for (let repeat = 0; repeat < 3; repeat++) for (const event of b.events) JSON.stringify(event);
  eq(JSON.stringify(b.stats), before, 'replay/event reads do not mutate stats');
  eq(simulate(left, right, 1, ['r_rear']).stats, b.stats, 'repeated simulation deterministic without shared counters');
}

const baselineArg = (globalThis as unknown as { process: { argv: string[] } }).process.argv.find((s) => s.startsWith('--baseline='));
if (baselineArg) {
  const oldSource: string = readFileSync(baselineArg.slice('--baseline='.length), 'utf8');
  const compiled = ts.transpileModule(oldSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: { simulate?: (l: UnitSpec[], r: UnitSpec[], seed: number, relics: string[]) => Omit<BattleOut, 'stats'> } = {};
  new Function('exports', 'require', compiled)(exports, (name: string) => { assert(name === './data', `baseline dependency ${name}`); return data; });
  assert(exports.simulate, 'baseline simulate loaded');
  let state = 1234567;
  const rnd = (n: number) => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
  const make = (): UnitSpec => ({ def: data.CARDS[rnd(data.CARDS.length)].id, lvl: (rnd(3) + 1) as 1 | 2 | 3, atk: rnd(20) + 1, hp: rnd(25) + 1,
    ench: rnd(3) ? data.EQUIPS[rnd(data.EQUIPS.length)].id : null, lamp: !rnd(7), bank: rnd(8),
    ax: rnd(4) ? [] : [data.ATOMS[rnd(data.ATOMS.length)]], tfx: rnd(3) ? [] : [['bomb', 'thunder', 'bone', 'berry', 'splash', 'undy'] as const][0].filter(() => !rnd(3)) });
  for (let i = 0; i < 200; i++) {
    const left = Array.from({ length: rnd(6) }, make);
    const right = Array.from({ length: rnd(6) }, make);
    const relics = data.RELICS.filter(() => !rnd(4)).map((r) => r.id);
    const seed = rnd(0x7fffffff);
    const actual = battle(left, right, relics, seed);
    const { stats: _stats, ...legacy } = actual;
    eq(legacy, exports.simulate(left, right, seed, relics), `legacy rules and exact event order fixture ${i}, seed ${seed}`);
  }
  console.log('BATTLE_STATS_LEGACY_PARITY_OK 200 fixed-seed teams, exact full legacy output/event parity');
}
console.log(`BATTLE_STATS_OK ${checks} assertions (melee/block/shield/overkill/undying/friendly/summon/revival/burn/skill/equipment/supply/relic/replay)`);
