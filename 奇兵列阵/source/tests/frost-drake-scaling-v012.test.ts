import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import { chapter } from '../src/core/route';
import type { Effect, EnemyEntry, UnitState } from '../src/core/types';

const entry = (defId: string, atk = 1, hp = 200, level = 1): EnemyEntry => ({ defId, atk, hp, level });
const api = (b: Battle) => b as unknown as {
  frozen(u: UnitState): boolean; flush(): void; prepareWave(): boolean;
  apply(u: UnitState, effects: Effect[], ctx: { cast?: boolean }): boolean;
};
function freeze(b: Battle, target: UnitState) {
  b.chill(undefined, target, target.atk); expect(api(b).frozen(target)).toBe(true); api(b).flush();
}
const make = (level = 1, atk = 5) => new Battle({ player: [entry('v_drake', atk, 200, level)], enemy: [entry('e_skel'), entry('e_skel')] });
const hits = (b: Battle) => b.log.flatMap(x => x.ev.t === 'dmg' && x.ev.kind === 'ability' ? [x.ev] : []);

describe('0.12 frost drake attack-scaled freeze payoff', () => {
  it.each([[1, 5, 6], [2, 5, 8], [3, 5, 10], [1, 6, 7]])('level %i attack %i resolves base plus floored half attack', (level, atk, expected) => {
    const b = make(level, atk), front = b.units[1], rear = b.units[2];
    freeze(b, front); expect(rear.hp).toBe(200 - expected); expect(front.hp).toBe(200);
    expect(hits(b)[0]).toMatchObject({ src: b.units[0].uid, tgt: rear.uid, n: expected });
  });
  it('reads current attack after buffs and weakening, while passive damage ignores spell power', () => {
    const b = make(), source = b.units[0], target = b.units[1];
    b.grant(undefined, source, 'power', 100);
    b.buff(undefined, source, 4, 0); freeze(b, target);
    b.buff(undefined, source, -6, 0); freeze(b, target);
    expect(hits(b).map(e => e.n)).toEqual([8, 5]);
  });
  it('retains rear targeting, ordinary armor and block mitigation and the real damage source', () => {
    const b = make(), source = b.units[0], front = b.units[1], rear = b.units[2];
    b.grant(undefined, rear, 'armor', 2); b.block(undefined, rear, 1);
    freeze(b, front); freeze(b, front);
    expect(hits(b)).toHaveLength(2);
    expect(hits(b)[0]).toMatchObject({ src: source.uid, tgt: rear.uid, blocked: true, n: 0 });
    expect(hits(b)[1]).toMatchObject({ src: source.uid, tgt: rear.uid, n: 4 });
    expect(b.metrics.spellDamage).toBe(0); expect(b.metrics.attackDamage).toBe(0);
  });
  it('allows only two responses per round and resets through the actual round transition', () => {
    const b = make(), front = b.units[1];
    freeze(b, front); freeze(b, front); freeze(b, front);
    expect(hits(b)).toHaveLength(2);
    for (const u of b.units) u.actionsLeft = 0;
    expect(api(b).prepareWave()).toBe(true); expect(b.round).toBe(2);
    freeze(b, front); expect(hits(b)).toHaveLength(3);
  });
  it('does not apply attack scaling metadata to other operations or effects that omit it', () => {
    const b = make(1, 100), source = b.units[0];
    api(b).apply(source, [{ op: 'dmg', to: 'enemyRear', v: [4, 4, 4] }, { op: 'burn', to: 'enemyRear', v: [2, 2, 2], sourceAttackPercent: 50 }], {});
    expect(hits(b).map(e => e.n)).toEqual([4]); expect(b.units[2].burn).toBe(2);
  });
  it('is symmetric for enemy drakes and preserves skill-source attribution', () => {
    const b = new Battle({ player: [entry('n_merc'), entry('n_merc')], enemy: [entry('v_drake', 7, 200, 2)] });
    freeze(b, b.units[0]);
    expect(hits(b)[0]).toMatchObject({ src: b.units[2].uid, tgt: b.units[1].uid, n: 9 });
  });
  it('recorded and unrecorded runs of the actual third-chapter 3:7 enemy lineup agree', () => {
    const stage = chapter(2).stages[6]; if (stage.type !== 'battle') throw Error('expected 3:7 battle');
    const player = [entry('v_wall', 4, 300), entry('n_merc', 10, 300), entry('v_chaser', 2, 200)];
    const run = (record: boolean) => { const b = new Battle({ player, enemy: stage.main.lineup, seed: 12027, record }); const out = b.run_(); return { b, out }; };
    const a = run(true), b = run(false);
    expect(a.out.fault).toBeUndefined(); expect(b.out.fault).toBeUndefined();
    const drake = a.b.units.find(u => u.side === 1 && u.defId === 'v_drake')!;
    expect(hits(a.b).some(e => e.src === drake.uid)).toBe(true);
    const combat = (battle: Battle) => battle.units.map(({ armor: _armor, power: _power, ...s }) => s);
    expect([a.out.result, a.out.beats, a.out.metrics, combat(a.b)]).toEqual([b.out.result, b.out.beats, b.out.metrics, combat(b.b)]);
  });
});
