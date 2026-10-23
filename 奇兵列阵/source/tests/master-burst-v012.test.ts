import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import type { BattleEvent, EnemyEntry, UnitState } from '../src/core/types';

const entry = (defId = 'e_skel', extra: Partial<EnemyEntry> = {}): EnemyEntry => ({ defId, atk: 7, hp: 999, ...extra });
type Internals = {
  startPhase(): void; doBeat(): void; flush(): void;
  attack(plans: { a: UnitState; bonus: number }[]): void;
  extraAct(a: UnitState, bonus: number): void;
  bonusAct(source: UnitState, a: UnitState): void;
  inMasterAction(job: () => void, independent?: boolean): void;
  enqueue(job: () => void): void;
};
const inner = (b: Battle) => b as unknown as Internals;
const setup = (player = [entry('s_wind', { atk: 20 }), entry('s_master')], enemy = [entry(), entry()]) => {
  const b = new Battle({ player, enemy }); inner(b).startPhase(); return b;
};
const attack = (b: Battle, uid = 1) => { inner(b).attack([{ a: b.u(uid), bonus: 0 }]); inner(b).flush(); };
const progress = (b: Battle, uid = 2) => b.snap().find(u => u.uid === uid)?.masterHits;
const bursts = (b: Battle) => b.log.map(l => l.ev).filter((ev): ev is Extract<BattleEvent, { t: 'rule' }> => ev.t === 'rule' && ev.id === 'master_burst');

describe('0.12 shared master attack burst', () => {
  it.each([[1, 20], [2, 25], [3, 30]])('star %i uses current donor attack without spell power: %i per enemy', (level, damage) => {
    const b = setup([entry('s_wind', { atk: 20 }), entry('s_master', { level })]);
    b.u(1).grants.power = 100; b.u(2).grants.power = 100;
    attack(b); attack(b); expect(progress(b)).toBe(4); attack(b);
    expect(bursts(b)).toMatchObject([{ src: 2, provider: 1, label: '千刃齐发' }]);
    expect(b.log.map(l => l.ev).filter(e => e.t === 'dmg' && e.src === 2 && e.kind === 'ability').map(e => e.t === 'dmg' ? e.n : 0)).toEqual([damage, damage]);
    expect(progress(b)).toBe(0);
    expect(b.snap().find(u => u.uid === 1)).not.toHaveProperty('masterHits');
  });
  it('counts blocked hits and masters themselves, but excludes splash and skill damage', () => {
    const b = setup([entry('n_breaker'), entry('s_master')]);
    b.u(3).block = 3; attack(b); expect(progress(b)).toBe(1);
    b.hit(b.u(1), b.u(3), 3, 'ability'); inner(b).flush(); expect(progress(b)).toBe(1);
    attack(b, 2); expect(progress(b)).toBe(3);
  });
  it('does not count a combo second segment against an already dead target', () => {
    const b = setup(undefined, [entry('e_skel', { hp: 1 }), entry()]);
    attack(b); expect(progress(b)).toBe(1);
  });
  it('shares progress and uses only highest-star living master, stable ties and floored damage', () => {
    const b = setup([entry('s_wind', { atk: 7 }), entry('s_master'), entry('s_master', { level: 2 }), entry('s_master', { level: 2 })]);
    attack(b); attack(b); attack(b);
    expect(bursts(b)).toMatchObject([{ src: 3, provider: 1 }]);
    expect(progress(b, 2)).toBe(0); expect(progress(b, 3)).toBe(0);
    expect(b.log.map(l => l.ev).filter(e => e.t === 'dmg' && e.src === 3 && e.kind === 'ability').map(e => e.t === 'dmg' ? e.n : 0)).toEqual([8, 8]);
  });
  it('settles after queued pursuits once per root, retaining excess for the next action', () => {
    const b = setup();
    inner(b).inMasterAction(() => {
      attack(b); attack(b);
      inner(b).enqueue(() => { inner(b).extraAct(b.u(1), 0); inner(b).enqueue(() => inner(b).extraAct(b.u(1), 0)); });
      inner(b).flush(); expect(bursts(b)).toHaveLength(0);
    });
    expect(bursts(b)).toHaveLength(1); expect(progress(b)).toBe(2);
    attack(b); expect(progress(b)).toBe(4); attack(b); expect(bursts(b)).toHaveLength(2);
  });
  it('cannot spend twice even with more than twelve hits in one action and carries a full threshold forward', () => {
    const b = setup();
    inner(b).inMasterAction(() => { for (let i = 0; i < 7; i++) attack(b); });
    expect(bursts(b)).toHaveLength(1); expect(progress(b)).toBe(8);
    attack(b); expect(bursts(b)).toHaveLength(2); expect(progress(b)).toBe(4);
  });
  it('reselects both surviving source and current highest donor after queued deaths', () => {
    const b = setup([entry('s_wind', { atk: 20 }), entry('s_master'), entry('s_master', { level: 3 }), entry('e_skel', { atk: 15 })]);
    inner(b).inMasterAction(() => {
      attack(b); attack(b); attack(b);
      inner(b).enqueue(() => { b.hit(undefined, b.u(1), 9999, 'fatigue'); b.hit(undefined, b.u(3), 9999, 'fatigue'); });
    });
    expect(bursts(b)).toMatchObject([{ src: 2, provider: 4 }]);
    expect(b.log.map(l => l.ev).filter(e => e.t === 'dmg' && e.src === 2 && e.kind === 'ability').map(e => e.t === 'dmg' ? e.n : 0)).toEqual([15, 15]);
    expect(progress(b)).toBe(0);
  });
  it('permits independent full actions inside a root and does not disable pursuit chains globally', () => {
    const b = setup([entry('s_wind', { atk: 20 }), entry('s_master'), entry('n_envoy')]);
    inner(b).inMasterAction(() => {
      for (let i = 0; i < 6; i++) attack(b);
      inner(b).bonusAct(b.u(3), b.u(1));
    });
    expect(bursts(b)).toHaveLength(2); expect(progress(b)).toBe(2);
    inner(b).extraAct(b.u(1), 0); inner(b).flush(); expect(progress(b)).toBe(4);
    inner(b).extraAct(b.u(1), 0); inner(b).flush(); expect(bursts(b)).toHaveLength(3);
  });
  it('cancels if the donor dies in queued responses, retaining progress until a later valid donor', () => {
    const b = setup();
    inner(b).inMasterAction(() => {
      attack(b); attack(b); attack(b);
      inner(b).enqueue(() => b.hit(undefined, b.u(1), 9999, 'fatigue'));
    });
    expect(bursts(b)).toHaveLength(0); expect(progress(b)).toBe(6);
    attack(b, 2); expect(progress(b)).toBe(8); expect(bursts(b)).toHaveLength(0);
  });
  it('clears when all masters fall, even if the last master immediately revives', () => {
    const b = setup(); attack(b); attack(b); b.u(2).grants.reborn = true;
    b.hit(undefined, b.u(2), 9999, 'fatigue'); inner(b).flush();
    expect(b.u(2).alive).toBe(true); expect(progress(b)).toBe(0);
    attack(b); expect(progress(b)).toBe(2); expect(bursts(b)).toHaveLength(0);
  });
  it('does not consume the sixth hit when the attack leaves no enemies', () => {
    const b = setup(undefined, [entry('e_skel', { hp: 60 })]);
    attack(b); attack(b); attack(b);
    expect(progress(b)).toBe(6); expect(bursts(b)).toHaveLength(0);
  });
  it('preserves progress across real rounds and allows regular dancer pursuit to contribute', () => {
    const b = setup([entry('s_dancer', { atk: 1 }), entry('s_wind', { atk: 20 }), entry('s_master')]);
    inner(b).doBeat(); expect(progress(b, 3)).toBe(2);
    inner(b).doBeat(); expect(progress(b, 3)).toBe(4);
    inner(b).doBeat(); expect(bursts(b)).toHaveLength(1); expect(progress(b, 3)).toBe(0);
    inner(b).doBeat(); expect(progress(b, 3)).toBe(2);
  });
  it('opening pursuit uses the same counter without requiring a regular beat', () => {
    const b = new Battle({ player: [entry('s_wind', { atk: 20 }), entry('s_master')], enemy: [entry()], general: { id: 'kaleos', power: 0, passives: ['g_haste'] } });
    inner(b).startPhase(); expect(progress(b)).toBe(2); expect(bursts(b)).toHaveLength(0);
    inner(b).doBeat(); expect(progress(b)).toBe(4);
  });
  it.each([false, true])('settles both sides of a real simultaneous sixth-hit clash serially (opposing master killed: %s)', killOpposingMaster => {
    const b = setup(
      [entry('s_wind', { atk: 20 }), entry('s_master')],
      [entry('s_wind', { atk: 20 }), entry('s_master', { hp: killOpposingMaster ? 15 : 999 })],
    );
    inner(b).doBeat(); inner(b).doBeat();
    expect(progress(b, 2)).toBe(4); expect(progress(b, 4)).toBe(4);
    const before = b.log.length;
    inner(b).doBeat();
    const clash = b.log.slice(before).map(l => l.ev);
    // Both sixth segments actually land before either team can burst.
    expect(clash.filter(e => e.t === 'dmg' && e.kind === 'attack')).toHaveLength(4);
    expect(bursts(b).map(e => e.side)).toEqual(killOpposingMaster ? [0] : [0, 1]);
    expect(progress(b, 2)).toBe(0);
    if (killOpposingMaster) {
      expect(b.u(4).alive).toBe(false);
      expect(progress(b, 4)).toBeUndefined();
      // Source loss clears the opposing counter instead of scheduling a dead source.
      expect(b.triggers.s_master).toBe(1);
    } else {
      expect(b.u(4).alive).toBe(true); expect(progress(b, 4)).toBe(0);
    }
  });
  it('recording affects logs only, preserving outcome, final attributes and shared progress', () => {
    const make = (record: boolean) => new Battle({
      player: [entry('s_dancer', { atk: 1 }), entry('s_wind', { atk: 40 }), entry('s_master', { level: 2 })],
      enemy: [entry('s_wind', { atk: 3, hp: 500 }), entry('s_master', { atk: 3, hp: 500 })],
      seed: 12023, record,
    });
    const recorded = make(true), unrecorded = make(false);
    const visible = recorded.run_(), silent = unrecorded.run_();
    expect(bursts(recorded).length).toBeGreaterThan(0);
    expect(silent.log).toHaveLength(0);
    expect(silent.fault).toBeUndefined(); expect(visible.fault).toBeUndefined();
    for (const key of ['result', 'beats', 'rounds', 'triggers', 'metrics'] as const) expect(silent[key]).toEqual(visible[key]);
    expect(unrecorded.snap()).toEqual(recorded.snap());
    expect(unrecorded.snap().map(u => u.masterHits)).toEqual(recorded.snap().map(u => u.masterHits));
  });
});
