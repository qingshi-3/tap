import { describe, expect, it } from 'vitest';
import { simulate } from '../src/core/engine';
import { newRun, commitPreparation, takeDraft } from '../src/core/run';
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

  it.each([1, 2, 3])('守誓者%i星结束备战永久培育队首，不因重复提交再领', level => {
    const r = newRun('kaleos', 89);
    r.slots = [{ defId: 'n_merc', ownedId: 1, copies: 1 }, { defId: 'l_vigil', ownedId: 2, copies: [1,2,4][level-1] as 1|2|4 }, null, null, null];
    r.allocLog = []; r.prepUses = {}; r.prepCommitted = false;
    commitPreparation(r); commitPreparation(r);
    expect(r.slots[0]?.growth).toEqual({ hp: level });
    expect(r.slots[1]?.growth).toBeUndefined();
    const out = play(r.slots);
    expect(out.initial[0].maxHp).toBe(5 + level);
    expect(out.log.some(x => x.ev.t === 'block' && x.ev.src === 2)).toBe(false);
  });

  it('备战席守誓者不能免费培育场上队首', () => {
    const r = newRun('kaleos', 90);
    r.slots = [{ defId: 'n_merc', ownedId: 1, copies: 1 }, null, null, null, null];
    r.bench = [{ defId: 'l_vigil', ownedId: 2, copies: 1 }, null, null];
    r.allocLog = []; r.prepCommitted = false;
    commitPreparation(r);
    expect(r.slots[0]?.growth).toBeUndefined();
  });

  it.each([[1, 2], [2, 3], [3, 3]])('旭日守望%i星开战最高血目标获得%i挡，战中不再节拍刷新或给护甲', (level, blocks) => {
    const out = play([{ defId: 'n_merc', hp: 1000 }, unit('l_sunriser', level)]);
    expect(out.fault).toBeUndefined();
    const target = out.afterStart[0];
    expect(target.block).toBe(blocks);
    expect(target.armor ?? 0).toBe(0);
    expect(out.afterStart[1].block).toBe(0);
    expect(out.afterStart[1].pulseMax).toBeUndefined();
    for (const beat of [1, 2]) {
      expect(beatLog(out, beat).some(x => x.ev.t === 'trigger' && x.ev.src === 2)).toBe(false);
    }
    expect(out.log.some(x => x.ev.t === 'trigger' && x.ev.src === 2 && x.ev.kind === 'pulse')).toBe(false);
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

  it.each([[1, 6], [2, 8], [3, 10]])('四风术士%i星固有法强计入首次施法实际%i伤害', (level, damage) => {
    const out = play([unit('s_caster', level)], { defId: 'e_skel', hp: 999, atk: 1 });
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
