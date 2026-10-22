import { describe, expect, it } from 'vitest';
import { simulate } from '../src/core/engine';
import type { BattleOutput, EnemyEntry, Slotted } from '../src/core/types';

const unit = (defId: string, level = 1): EnemyEntry => ({ defId, level });
const dummy: EnemyEntry = { defId: 'e_curser', hp: 999, atk: 1 };
const play = (player: (EnemyEntry | Slotted | null)[], enemy: EnemyEntry = dummy) =>
  simulate({ player, enemy: [enemy] });
const beatLog = (out: BattleOutput, beat: number) => {
  const begin = out.log.findIndex(x => x.ev.t === 'beat' && x.ev.n === beat);
  const end = out.log.findIndex(x => x.ev.t === 'beat' && x.ev.n === beat + 1);
  return out.log.slice(begin, end < 0 ? undefined : end);
};

describe('四卡数值与能力回归', () => {
  const blocksFrom = (out: BattleOutput, src: number, beat: number) =>
    beatLog(out, beat).flatMap(x => x.ev.t === 'block' && x.ev.src === src ? [x.ev] : []);

  it.each([[1, 1], [2, 1], [3, 2]])('守誓者%i星在队尾时：每次交锋结束给我方队首%i挡', (level, v) => {
    const out = play([unit('n_merc'), unit('n_medic'), null, unit('l_vigil', level)]);
    expect(out.fault).toBeUndefined();
    expect(out.afterStart.filter(u => u.side === 0).map(u => u.block)).toEqual([0, 0, 0]);
    expect(blocksFrom(out, 3, 1)).toMatchObject([{ uid: 1, n: v }]);
    expect(beatLog(out, 1).at(-1)!.snap[0].block).toBe(v);
  });

  it.each([1, 2, 3])('守誓者%i星不在队尾或只剩自己时不触发', level => {
    const front = play([unit('l_vigil', level), unit('n_merc')]);
    expect(front.fault).toBeUndefined();
    expect(front.log.some(x => x.ev.t === 'block' && x.ev.src === 1)).toBe(false);
    const alone = play([null, null, unit('l_vigil', level)]);
    expect(alone.fault).toBeUndefined();
    expect(alone.log.some(x => x.ev.t === 'block' && x.ev.src === 1)).toBe(false);
  });

  it.each([[1, 2], [2, 3], [3, 3]])('旭日守望%i星开战最高血目标获得%i挡，节拍3刷新，不再给护甲', (level, blocks) => {
    const out = play([{ defId: 'n_merc', hp: 1000 }, unit('l_sunriser', level)]);
    expect(out.fault).toBeUndefined();
    const target = out.afterStart[0];
    expect(target.block).toBe(blocks);
    expect(target.armor ?? 0).toBe(0);
    expect(out.afterStart[1].block).toBe(0);
    expect(out.afterStart[1].pulseMax).toBe(3);
    for (const beat of [1, 2]) {
      expect(beatLog(out, beat).some(x => x.ev.t === 'trigger' && x.ev.src === 2)).toBe(false);
    }
    // 目标未满挡时节拍才实际触发；满挡不空触发。
    expect(beatLog(out, 3).some(x => x.ev.t === 'trigger' && x.ev.src === 2 && x.ev.kind === 'pulse')).toBe(blocks < 3);
    const at3 = beatLog(out, 3).at(-1)!.snap;
    expect(at3[0].block).toBe(3);
    expect(at3[1].block).toBe(0);
    expect(out.log.some(x => x.ev.t === 'buff' && x.ev.src === 2)).toBe(false);
  });

  it.each([1, 2])('旭日守望%i星最高血目标满挡时不开战或拍末空触发', level => {
    const out = play([{ defId: 'n_merc', hp: 1000, block: 3 }, unit('l_sunriser', level)]);
    expect(out.afterStart[0].block).toBe(3);
    const beforeFatigue = out.log.slice(0, out.log.findIndex(x => x.ev.t === 'beat' && x.ev.n === 20));
    expect(beforeFatigue.some(x => x.ev.t === 'trigger' && x.ev.src === 2)).toBe(false);
  });

  it('三星旭日守望重复开战结果一致，不修改拥有数据', () => {
    const target: Slotted = { defId: 'n_merc', ownedId: 8801, copies: 1, train: { hp: 100 } };
    const source: Slotted = { defId: 'l_sunriser', ownedId: 8802, copies: 4 };
    const input = [target, source];
    const before = structuredClone(input);
    play(input);
    const second = play(input);
    expect(second.initial[0].block).toBe(0);
    expect(second.afterStart[0].block).toBe(3);
    expect(second.afterStart[1].pulse ?? 0).toBe(0);
    expect(input).toEqual(before);
  });

  it.each([[1, 4], [2, 5], [3, 7]])('献祭术士%i星固有法强计入首次施法实际%i伤害', (level, damage) => {
    const out = play([unit('a_cult', level)], { defId: 'e_skel', hp: 999, atk: 1 });
    expect(out.fault).toBeUndefined();
    expect(out.initial[0].power).toBe(1);
    const first = beatLog(out, 1).find(x => x.ev.t === 'dmg' && x.ev.src === 1 && x.ev.kind === 'ability');
    expect(first?.ev).toMatchObject({ n: damage, tgt: 2 });
    expect(beatLog(out, 1).some(x => x.ev.t === 'attack' && x.ev.pairs.some(p => p.atk === 1))).toBe(false);
  });

  it.each([[1, 9, 1], [2, 11, 1], [3, 13, 2]])('冰墙%i星生命%i且护甲%i', (level, hp, armor) => {
    const out = play([unit('v_wall', level)], { defId: 'e_skel', atk: 3, hp: 999 });
    expect(out.fault).toBeUndefined();
    expect(out.initial[0]).toMatchObject({ hp, maxHp: hp, armor });
    const first = beatLog(out, 1).find(x => x.ev.t === 'dmg' && x.ev.tgt === 1 && x.ev.kind === 'attack');
    expect(first?.ev).toMatchObject({ n: 3 - armor });
    expect(first?.snap[0].hp).toBe(hp - (3 - armor));
  });
});
