import { simulate, type UnitSpec } from '../src/core/engine';
const unit = (def: string, atk: number, hp: number, extra: Partial<UnitSpec> = {}): UnitSpec => ({ def, lvl: 1, atk, hp, ...extra });
const ok = (v: unknown, message: string) => { if (!v) throw new Error(message); };
const bone = { id: 'bone', duration: 'permanent', value: 4, source: '骨契' } as const;
const spark = { id: 'spark', duration: 'permanent', value: 2, source: '铭刻' } as const;
const blood = { id: 'blood', duration: 'battle', value: 2, source: '苦修' } as const;
const faint = simulate([unit('a_imp', 1, 1, { granted: bone })], [unit('e_skel', 10, 50)], 1);
const summons = faint.events.filter(e => e.t === 'summon' && e.src === 1);
ok(summons.length === 2 && summons.some(e => e.t === 'summon' && e.unit.atk === 4), 'native and granted faint coexist');
const start = simulate([unit('a_imp', 1, 10, { granted: spark })], [unit('e_skel', 1, 20)], 1);
ok(start.stats.units[0].damageBySource.some(s => s.label === '铭刻' && s.damage === 2), 'granted damage source');
const hurt = simulate([unit('a_imp', 1, 10, { granted: blood })], [unit('e_skel', 1, 20)], 1);
ok(hurt.stats.units[0].selfDamage === 1 && hurt.events.some(e => e.t === 'buff' && e.src === 1 && e.atk === 2), 'blood self damage and buff');
const revive = simulate([unit('a_imp', 1, 1, { granted: bone, lamp: true })], [unit('e_skel', 20, 100)], 1);
ok(revive.events.filter(e => e.t === 'summon' && e.unit.atk === 4).length === 2, 'revived unit inherits ability');
const repeats = simulate([unit('a_imp', 1, 10, { granted: spark }), unit('l_archon', 1, 10), unit('s_lord', 1, 10)], [unit('e_skel', 1, 100)], 1);
ok(repeats.stats.units[0].damageBySource.find(s => s.label === '铭刻')?.damage === 6, 'key and tiger add one repeat each');
const input = [unit('a_imp', 1, 10, { granted: spark, startBlock: 1 })];
const snapshot = JSON.stringify(input);
ok(JSON.stringify(simulate(input, [unit('e_skel', 1, 20)], 42)) === JSON.stringify(simulate(input, [unit('e_skel', 1, 20)], 42)) && JSON.stringify(input) === snapshot, 'simulation is deterministic and isolated');
const full = simulate([
  unit('a_imp', 1, 1, { granted: bone }),
  ...Array.from({ length: 4 }, () => unit('d_artificer', 1, 30)),
], [unit('e_skel', 20, 100)], 1);
const initialFaints = full.events.filter(e => e.t === 'summon' && e.src === 1);
ok(initialFaints.length === 1 && full.events.some(e => e.t === 'fizzle' && e.uid === 1), 'full queue consumes native summon slot before granted and reports failure');
const barrier = simulate([unit('a_imp', 1, 10, { startBlock: 1 })], [unit('a_imp', 1, 10, { granted: spark })], 1);
ok(barrier.events.some(e => e.t === 'dmg' && e.tgt === 1 && e.src === 2 && e.blocked), 'pre-battle block protects against opposing start ability');
const killed = simulate([unit('a_imp', 1, 1, { granted: blood })], [unit('e_skel', 1, 100)], 1);
ok(!killed.events.some(e => e.t === 'buff' && e.src === 1), 'fatal blood does not grant attack');

console.log('v0.9 combat behavior checks passed');
