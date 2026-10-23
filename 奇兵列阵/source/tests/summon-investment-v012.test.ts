import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import type { Slotted, UnitState } from '../src/core/types';

const u = (defId: string, ownedId: number, extra: Partial<Slotted> = {}): Slotted => ({ defId, ownedId, copies: 1, ...extra });
// Isolated entry/death boundaries exercise the same queue used by full battles.
const internals = (b: Battle) => b as unknown as {
  summon(src: UnitState | undefined, side: 0, origin: number, token: string, atk: number, hp: number): UnitState | null;
  flush(): void;
  reviveUnit(m: UnitState): boolean;
};
const make = (auras: Slotted[], source = u('d_dune', 1, { train: { atk: 2, hp: 3 }, growth: { atk: 3, hp: 5 } })) =>
  new Battle({ player: [source, ...auras], enemy: [{ defId: 'e_skel', hp: 999, atk: 1 }] });
const summon = (b: Battle, source = b.units[0]) => internals(b).summon(source, 0, source.slot, 't_dervish', 2, 2)!;

describe('0.12 summon investment inheritance', () => {
  it.each([['d_goldob', 1, 4, 7], ['d_pharaoh', 1, 7, 13], ['d_pharaoh', 2, 8, 15], ['d_pharaoh', 4, 9, 18]] as const)
  ('%s copies %i inherits only committed investment with floor rounding', (id, copies, atk, hp) => {
    const b = make([u(id, 2, { copies })]);
    b.buff(undefined, b.units[0], 100, 100);
    const s = summon(b); expect([s.atk, s.maxHp]).toEqual([atk, hp]);
  });
  it('selects the highest aura without stacking, then adds nursery stats and immediate action', () => {
    const b = make([u('d_goldob', 2), u('d_pharaoh', 3, { copies: 2 }), u('m_incubator', 4)]);
    const s = summon(b); expect([s.atk, s.maxHp, s.actionsLeft]).toEqual([9, 16, 1]);
  });
  it('does not inherit equipment, base/star stats, power, or negative net investment', () => {
    const source = u('d_dune', 1, { copies: 4, equips: ['eq_ice'], train: { atk: 1, hp: 1, power: 8 }, growth: { atk: -4, hp: -5, power: 10 } });
    const b = make([u('d_pharaoh', 2)], source);
    expect([summon(b).atk, b.units.at(-1)!.maxHp]).toEqual([2, 2]);
  });
  it('requires a living field aura and never inherits from a summoned descendant or unowned enemy', () => {
    const b = make([u('d_pharaoh', 2)]), parent = summon(b);
    b.buff(undefined, parent, 99, 99);
    const child = summon(b, parent); expect([child.atk, child.maxHp]).toEqual([2, 2]);
    b.units[1].hp = 0;
    const plain = summon(b); expect([plain.atk, plain.maxHp]).toEqual([2, 2]);
    const other = make([u('d_pharaoh', 2)]), enemy = other.units.find(x => x.side === 1)!;
    const foreign = summon(other, enemy); expect([foreign.atk, foreign.maxHp]).toEqual([2, 2]);
  });
  it('keeps the dead summoner snapshot for real deathrattles but excludes a simultaneously dying aura', () => {
    for (const auraDies of [false, true]) {
      const b = make([u('d_goldob', 2)]);
      b.hit(undefined, b.units[0], 999, 'ability');
      if (auraDies) b.hit(undefined, b.units[1], 999, 'ability');
      internals(b).flush();
      const s = b.units.find(x => x.defId === 't_dervish')!;
      expect([s.atk, s.maxHp]).toEqual(auraDies ? [2, 2] : [4, 7]);
    }
  });
  it('full-board conversion uses only original summon stats, not investment or aura', () => {
    const b = make([u('d_pharaoh', 2), u('n_merc', 3), u('n_merc', 4), u('n_merc', 5)]);
    const source = b.units[0], before = [source.atk, source.maxHp];
    expect(summon(b)).toBeNull();
    expect([source.atk, source.maxHp]).toEqual(before.map(n => n + 1));
    expect(b.metrics.summons).toBe(0);
  });
  it('sheltered summons inherit once on actual entry using the then-living aura', () => {
    for (const auraDies of [false, true]) {
      const b = new Battle({ player: [u('d_dune', 1, { growth: { atk: 4, hp: 8 } }), u('d_pharaoh', 2), u('n_merc', 3), u('n_merc', 4), u('n_merc', 5)], enemy: [{ defId: 'e_skel', hp: 999 }], general: { id: 'sajj', power: 0, passives: ['sajj_4'] } });
      expect(summon(b)).toBeNull();
      const sheltered = b.units.find(x => x.summoned)!;
      expect([sheltered.atk, sheltered.maxHp, sheltered.reserve]).toEqual([2, 2, true]);
      expect(b.metrics.summons).toBe(0);
      b.hit(undefined, b.units[auraDies ? 1 : 4], 999, 'ability');
      internals(b).flush();
      expect(sheltered.reserve).toBe(false);
      expect([sheltered.atk, sheltered.maxHp]).toEqual(auraDies ? [2, 2] : [6, 10]);
      expect(b.metrics.summons).toBe(1);
    }
  });
  it('an invested egg passes no stats by default and inherits its dead-body snapshot with an aura', () => {
    for (const withAura of [false, true]) {
      const b = make(withAura ? [u('d_pharaoh', 2)] : [], u('m_egg', 1, { train: { atk: 2, hp: 2 }, growth: { atk: 3, hp: 4 } }));
      b.hit(undefined, b.units[0], 999, 'ability'); internals(b).flush();
      const hatch = b.units.find(x => x.defId === 't_hatch')!;
      expect([hatch.atk, hatch.maxHp]).toEqual(withAura ? [8, 11] : [3, 3]);
    }
  });
  it('revival does not apply investment a second time or broadcast a summon', () => {
    const b = make([u('d_pharaoh', 2)]), s = summon(b), hp = s.maxHp;
    b.hit(undefined, s, 999, 'ability'); internals(b).flush();
    const count = b.metrics.summons;
    expect(internals(b).reviveUnit(s)).toBe(true);
    expect(s.maxHp).toBe(hp); expect(b.metrics.summons).toBe(count);
  });
  it('full recorded and unrecorded battles agree and input investment remains unchanged', () => {
    const player = [u('d_dune', 1, { train: { atk: 2, hp: 3 }, growth: { atk: 3, hp: 5 } }), u('d_pharaoh', 2), u('m_incubator', 3)];
    const before = structuredClone(player);
    const run = (record: boolean) => { const b = new Battle({ player, enemy: [{ defId: 'e_brute', atk: 15, hp: 100 }], seed: 71, record }); return { out: b.run_(), snap: b.snap() }; };
    const a = run(true), b = run(false);
    expect(a.out.fault).toBeUndefined(); expect(b.out.fault).toBeUndefined();
    expect(a.out.metrics.summons).toBeGreaterThan(0);
    // record emits refresh presentation-only armor/power caches, including dead units.
    const combat = (rows: typeof a.snap) => rows.map(({ armor: _armor, power: _power, ...state }) => state);
    expect([a.out.result, a.out.beats, a.out.metrics, combat(a.snap)]).toEqual([b.out.result, b.out.beats, b.out.metrics, combat(b.snap)]);
    expect(player).toEqual(before);
  });
});
