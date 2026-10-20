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
  it.each([[1, 1], [2, 2], [3, 3]])('守誓者%i星自己%i挡，隔空位只给身后最近友军1挡', (level, ownBlock) => {
    const out = play([unit('n_merc'), unit('l_vigil', level), null, unit('n_medic'), unit('n_archer')]);
    expect(out.fault).toBeUndefined();
    expect(out.afterStart.map(u => u.block)).toEqual([0, ownBlock, 1, 0, 0]);
  });

  it.each([1, 2, 3])('守誓者%i星没有后排仍正常获得自身格挡', level => {
    const out = play([unit('n_merc'), null, unit('l_vigil', level)]);
    expect(out.fault).toBeUndefined();
    expect(out.afterStart[0].block).toBe(0);
    expect(out.afterStart[1].block).toBe(level);
    expect(out.log.some(x => x.ev.t === 'fizzle')).toBe(false);
  });

  it.each([[1, 2, 0], [2, 3, 0], [3, 3, 1]])('旭日守望%i星开战最高血目标获得%i挡和%i甲，每3拍刷新', (level, blocks, armor) => {
    const out = play([{ defId: 'n_merc', hp: 1000 }, unit('l_sunriser', level)]);
    expect(out.fault).toBeUndefined();
    const target = out.afterStart[0];
    expect(target.block).toBe(blocks);
    expect(target.armor).toBe(armor);
    expect(out.afterStart[1].block).toBe(0);
    expect(out.afterStart[1].armor).toBe(0);
    for (const beat of [1, 2]) {
      expect(beatLog(out, beat).some(x => x.ev.t === 'trigger' && x.ev.src === 2)).toBe(false);
    }
    const at3 = beatLog(out, 3).at(-1)!.snap;
    expect(at3[0].block).toBe(3);
    expect(at3[0].armor).toBe(armor * 2);
    expect(at3[1].armor).toBe(0);
    const at6 = beatLog(out, 6).at(-1)!.snap;
    expect(at6[0].armor).toBe(armor * 3);
    expect(at6[1].armor).toBe(0);
    const armorEvents = out.log.filter(x => x.ev.t === 'buff' && x.ev.src === 2 && x.ev.atk === 0 && x.ev.hp === 0);
    expect(armorEvents.every(x => x.ev.t === 'buff' && x.ev.tgt === target.uid)).toBe(true);
    if (level === 3) expect(armorEvents.length).toBeGreaterThanOrEqual(3);
    else expect(armorEvents).toHaveLength(0);
  });

  it.each([1, 2])('旭日守望%i星最高血目标满挡时不开战或拍末空触发', level => {
    const out = play([{ defId: 'n_merc', hp: 1000, block: 3 }, unit('l_sunriser', level)]);
    expect(out.afterStart[0].block).toBe(3);
    const beforeFatigue = out.log.slice(0, out.log.findIndex(x => x.ev.t === 'beat' && x.ev.n === 20));
    expect(beforeFatigue.some(x => x.ev.t === 'trigger' && x.ev.src === 2)).toBe(false);
  });

  it('三星旭日守望满挡仍逐次加甲，下一场清除累计甲且不修改拥有数据', () => {
    const target: Slotted = { defId: 'n_merc', ownedId: 8801, copies: 1, train: { hp: 100 } };
    const source: Slotted = { defId: 'l_sunriser', ownedId: 8802, copies: 4 };
    const input = [target, source];
    const before = structuredClone(input);
    const first = play(input);
    expect(beatLog(first, 6).at(-1)!.snap[0].grants.armor).toBe(3);
    const second = play(input);
    expect(second.initial[0].grants.armor ?? 0).toBe(0);
    expect(second.initial[0].block).toBe(0);
    expect(second.afterStart[0].armor).toBe(1);
    expect(second.afterStart[0].block).toBe(3);
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

  it.each([[1, 9, 1], [2, 11, 2], [3, 13, 2]])('冰墙%i星生命%i且保留护甲%i', (level, hp, armor) => {
    const out = play([unit('v_wall', level)], { defId: 'e_skel', atk: 3, hp: 999 });
    expect(out.fault).toBeUndefined();
    expect(out.initial[0]).toMatchObject({ hp, maxHp: hp, armor });
    const first = beatLog(out, 1).find(x => x.ev.t === 'dmg' && x.ev.tgt === 1 && x.ev.kind === 'attack');
    expect(first?.ev).toMatchObject({ n: 3 - armor });
    expect(first?.snap[0].hp).toBe(hp - (3 - armor));
  });
});
