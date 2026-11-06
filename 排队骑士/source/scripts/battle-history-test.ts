const assert = {
  ok(value: unknown, label = 'assertion failed') { if (!value) throw new Error(label); },
  equal(actual: unknown, expected: unknown, label = 'values differ') { if (actual !== expected) throw new Error(`${label}: ${String(actual)} != ${String(expected)}`); },
  deepEqual(actual: unknown, expected: unknown, label = 'values differ') { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`); },
};
import { simulate, type Ev } from '../src/core/engine';
import { battleMoments, groupMomentActions } from '../src/ui/battleTimeline';

const out = simulate([{ def: 'v_guard', lvl: 1, atk: 4, hp: 10 }], [{ def: 'v_guard', lvl: 1, atk: 3, hp: 10 }]);
const [ally, enemy] = out.init;
const summoned = { ...ally, uid: 99, atk: 2, hp: 3, maxHp: 3 };
const order: [number[], number[]] = [[ally.uid, summoned.uid], [enemy.uid]];
out.events = [
  { t: 'clash', n: 1, a: ally.uid, b: enemy.uid },
  { t: 'trigger', uid: ally.uid, label: '友军受伤' },
  { t: 'buff', src: ally.uid, tgt: ally.uid, atk: 1, hp: 1, nowAtk: 5, nowHp: 11 },
  { t: 'dmg', src: ally.uid, tgt: enemy.uid, n: 2, blocked: false, kind: 'shot', hp: 8, block: 0, shield: 0 },
  { t: 'dmg', src: ally.uid, tgt: enemy.uid, n: 2, blocked: false, kind: 'shot', hp: 6, block: 0, shield: 0 },
  { t: 'kw', src: ally.uid, tgt: ally.uid, kws: ['reborn', 'splash'] },
  { t: 'heal', src: enemy.uid, tgt: enemy.uid, n: 1, hp: 7 },
  { t: 'trigger', uid: ally.uid, label: '再次释放' },
  { t: 'trigger', uid: enemy.uid, label: '反击' },
  { t: 'stat', uid: enemy.uid, shield: 2, burn: 1 },
  { t: 'summon', src: ally.uid, unit: summoned, order },
  { t: 'fizzle', uid: ally.uid, label: '队伍满了' },
  { t: 'die', uid: enemy.uid, order },
] satisfies Ev[];

const { moments, units } = battleMoments(out);
assert.equal(moments.length, 2);
const moment = moments[1];
const groups = groupMomentActions(moment.actions);
assert.deepEqual(groups.map(g => g.map(a => a.kind)), [
  ['trigger', 'buff', 'damage', 'damage', 'kw'], ['heal'], ['trigger'], ['trigger'], ['stat'], ['summon'], ['fizzle'], ['die'],
]);
assert.deepEqual(groups.flat(), moment.actions, 'grouping must retain each action in original order');
assert.equal(moment.actions.length, out.events.length - 1, 'every displayable event survives separately');
assert.deepEqual(moment.actions.slice(2, 4).map(a => [a.src, a.tgt, a.value, a.damageKind]), [
  [ally.uid, enemy.uid, 2, 'shot'], [ally.uid, enemy.uid, 2, 'shot'],
], 'consecutive damage events keep their individual values and participants');
assert.deepEqual(moment.damage, [4, 0]);
assert.deepEqual(moment.actions.find(a => a.kind === 'stat'), { kind: 'stat', src: null, tgt: enemy.uid, label: '护盾 2 · 灼烧 1', side: 1 });
assert.deepEqual([units.get(enemy.uid)?.shield, units.get(enemy.uid)?.burn], [2, 1], 'status snapshot reflects the recorded state');
assert.deepEqual(moment.actions.find(a => a.kind === 'summon'), { kind: 'summon', src: ally.uid, tgt: summoned.uid, label: '2/3', side: 0 });
assert.deepEqual(moment.actions.find(a => a.kind === 'kw'), { kind: 'kw', src: ally.uid, tgt: ally.uid, label: '复生、溅射', side: 0 });
assert.ok(units.get(ally.uid)?.kws.includes('reborn'));
assert.ok(units.get(ally.uid)?.kws.includes('splash'));
assert.equal(ally.kws.includes('reborn'), false, 'review must not mutate the initial snapshot');
assert.equal(units.get(summoned.uid)?.def, summoned.def);
assert.equal(moment.dead.has(enemy.uid), true);
assert.equal(moment.dead.has(summoned.uid), false);
console.log('battle history behavior checks passed');
