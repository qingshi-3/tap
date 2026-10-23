import { describe, expect, it } from 'vitest';
import { Battle, FATIGUE_BEAT, fatigueStartForChapter, MAX_BEATS, type BattleSetup } from '../src/core/engine';

const setup = (chapter?: number, record = true): BattleSetup => ({
  player: [{ defId: 'e_golem', atk: 1, hp: 10000, armor: 100 }],
  enemy: [{ defId: 'e_golem', atk: 1, hp: 10000, armor: 100 }],
  ...(chapter === undefined ? {} : { chapter }), record, seed: 12028,
});
const api = (b: Battle) => b as unknown as { doBeat(): void };
const fatigue = (b: Battle) => {
  let beat = 0;
  return b.log.flatMap(x => {
    if (x.ev.t === 'beat') beat = x.ev.n;
    return x.ev.t === 'dmg' && x.ev.kind === 'fatigue' ? [{ beat, event: x.ev }] : [];
  });
};

describe('0.12 chapter fatigue windows', () => {
  it.each([[undefined, 20], [1, 20], [2, 24], [3, 28]] as const)('chapter %s starts at %i and increases by one per beat', (chapter, start) => {
    const b = new Battle(setup(chapter));
    for (let n = 0; n < start - 1; n++) api(b).doBeat();
    expect(fatigue(b)).toHaveLength(0);
    api(b).doBeat(); api(b).doBeat(); api(b).doBeat();
    expect(fatigue(b).map(x => [x.beat, x.event.n])).toEqual([[start, 1], [start, 1], [start + 1, 2], [start + 1, 2], [start + 2, 3], [start + 2, 3]]);
    expect(fatigueStartForChapter(chapter)).toBe(start);
  });
  it('keeps the default constant and uses the battle chapter captured at construction', () => {
    expect(FATIGUE_BEAT).toBe(20); expect(fatigueStartForChapter()).toBe(20);
    const input = setup(2), b = new Battle(input); input.chapter = 3;
    for (let n = 0; n < 24; n++) api(b).doBeat();
    expect(fatigue(b)[0].beat).toBe(24);
  });
  it('bypasses armor and block while regular attacks still consume their own blocks', () => {
    const b = new Battle(setup(3));
    for (let n = 0; n < 27; n++) api(b).doBeat();
    for (const u of b.units) b.block(undefined, u, 3);
    const before = b.units.map(u => u.hp);
    api(b).doBeat();
    expect(b.units.map(u => u.hp)).toEqual(before.map(hp => hp - 1));
    expect(b.units.map(u => u.block)).toEqual([2, 2]);
    api(b).doBeat();
    expect(b.units.map(u => u.hp)).toEqual(before.map(hp => hp - 3));
    expect(b.units.map(u => u.block)).toEqual([1, 1]);
    expect(fatigue(b).every(x => !x.event.blocked)).toBe(true);
  });
  it.each([1, 2, 3])('chapter %i keeps the 60-beat draw ceiling and record-independent combat', chapter => {
    const run = (record: boolean) => { const b = new Battle(setup(chapter, record)); return { b, out: b.run_() }; };
    const a = run(true), b = run(false);
    expect(MAX_BEATS).toBe(60); expect(a.out.beats).toBe(60); expect(a.out.result).toBe('draw');
    expect(a.out.fault).toBeUndefined(); expect(b.out.fault).toBeUndefined();
    expect(a.b.standing(0)).toHaveLength(1); expect(a.b.standing(1)).toHaveLength(1);
    expect([a.out.result, a.out.beats, a.out.metrics, a.b.snap()]).toEqual([b.out.result, b.out.beats, b.out.metrics, b.b.snap()]);
    expect(fatigue(a.b).at(-1)?.event.n).toBe(60 - fatigueStartForChapter(chapter) + 1);
  });
});
