import { describe, expect, it } from 'vitest';
import { levelStats, simulate } from '../src/core/engine';
import type { Copies, Slotted } from '../src/core/types';

const owned = (defId: string, level = 1, ownedId = 1): Slotted => ({ defId, ownedId, copies: [1, 2, 4][level - 1] as Copies });

describe('定向单位调整：真实内容能力结算', () => {
  it.each([1, 2, 3])('幽火灵蛇 %i 星阵亡后召唤偏输出暗影', level => {
    const out = simulate({ player: [owned('a_seed', level)], enemy: [{ defId: 'e_void' }] });
    const summoned = out.log.find(line => line.ev.t === 'summon' && line.ev.src === 1);
    expect(summoned).toBeDefined();
    if (!summoned || summoned.ev.t !== 'summon') throw new Error('灵蛇没有生成暗影');
    const summonedUid = summoned.ev.uid;
    expect(summoned.snap.find(unit => unit.uid === summonedUid)).toMatchObject({
      defId: 't_shade', atk: [4, 5, 7][level - 1], hp: [2, 3, 4][level - 1], maxHp: [2, 3, 4][level - 1],
    });
  });

  it.each([1, 2, 3])('沙灵塑师 %i 星加挡同时增加当前与最大生命', level => {
    const out = simulate({ player: [owned('d_dunecaster', level)], enemy: [{ defId: 'e_golem' }] });
    const growth = out.log.find(line => line.ev.t === 'buff' && line.ev.src === 1 && line.ev.hp > 0);
    expect(growth?.ev).toMatchObject({ t: 'buff', src: 1, tgt: 1, atk: 0, hp: level });
    const base = levelStats('d_dunecaster', level);
    expect(growth?.snap.find(unit => unit.uid === 1)).toMatchObject({ hp: base.hp + level, maxHp: base.hp + level, block: level });
  });

  it.each([1, 2, 3])('唤亡祭师 %i 星首轮群伤随星级成长', level => {
    const out = simulate({ player: [owned('a_ritualist', level)], enemy: [{ defId: 'e_nightk' }, { defId: 'e_void' }] });
    const hits = out.log.filter(line => line.ev.t === 'dmg' && line.ev.src === 1 && line.ev.kind === 'ability');
    expect(hits.slice(0, 2).map(line => line.ev)).toMatchObject([{ n: level }, { n: level }]);
    const casts = out.log.filter(line => line.ev.t === 'act' && line.ev.uid === 1 && line.ev.mode === 'cast');
    expect(casts.length).toBeLessThanOrEqual(3);
  });

  it.each([1, 2, 3])('永夜吟诵者 %i 星在友军施法后赋予对应法强', level => {
    const out = simulate({
      player: [owned('n_thorn', 1, 1), owned('a_devour', 1, 2), owned('a_solus', level, 3)],
      enemy: [{ defId: 'e_nightk' }],
    });
    const growth = out.log.find(line => line.ev.t === 'buff' && line.ev.src === 3 && line.ev.tgt === 2);
    expect(growth).toBeDefined();
    expect(growth?.snap.find(unit => unit.uid === 2)?.grants.power).toBe(level);
  });

  it.each([1, 2, 3])('落日灵驹 %i 星护甲与生命增益都锁定原最高血目标', level => {
    // 巨像加血后会超过原最高血巨兽；用正式内容构成排序翻转，不覆写面板。
    const out = simulate({
      player: [owned('n_paragon', level, 1), owned('n_colossus', 1, 2), owned('a_jugg', 3, 3)],
      enemy: [{ defId: 'e_nightk' }],
    });
    const amount = level + 1;
    expect(out.afterStart.find(unit => unit.ownedId === 2)).toMatchObject({ atk: 7 + amount, hp: 14 + amount });
    expect(out.afterStart.find(unit => unit.ownedId === 2)?.grants.armor).toBeUndefined();
    expect(out.afterStart.find(unit => unit.ownedId === 3)).toMatchObject({ atk: 5 + amount, hp: 15 + amount, grants: { armor: level } });
  });

  it.each([1, 2, 3])('棘背兽 %i 星以更高生命区分墓园守卫', level => {
    const out = simulate({ player: [owned('n_thorn', level, 1), owned('a_graveguard', level, 2)], enemy: [{ defId: 'e_golem' }] });
    const thorn = out.afterStart.find(unit => unit.ownedId === 1)!;
    const graveguard = out.afterStart.find(unit => unit.ownedId === 2)!;
    expect(thorn.atk).toBe(graveguard.atk);
    expect(thorn.maxHp).toBe(graveguard.maxHp + 2);
  });
});
