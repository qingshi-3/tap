import { describe, expect, it } from 'vitest';
import { levelStats, simulate } from '../src/core/engine';
import type { Copies, Slotted } from '../src/core/types';

const owned = (defId: string, level = 1, ownedId = 1): Slotted => ({ defId, ownedId, copies: [1, 2, 4][level - 1] as Copies });

describe('定向单位调整：真实内容能力结算', () => {
  it.each([1, 2, 3])('幽火灵蛇 %i 星亡语召唤 2 个对应星级暗影', level => {
    const out = simulate({ player: [owned('a_seed', level)], enemy: [{ defId: 'e_void' }] });
    const summoned = out.log.filter(line => line.ev.t === 'summon' && line.ev.src === 1);
    expect(summoned).toHaveLength(2);
    expect(out.log.some(line => line.ev.t === 'trigger' && line.ev.src === 1 && line.ev.kind === 'rattle')).toBe(true);
    const last = summoned.at(-1)!;
    const shades = last.snap.filter(unit => unit.defId === 't_shade' && unit.side === 0);
    expect(shades.map(u => u.slot)).toEqual([0, 1]);
    for (const shade of shades) expect(shade).toMatchObject({ atk: level, hp: level, maxHp: level, summoned: true });
  });

  it.each([1, 2, 3])('沙灵塑师 %i 星施法召唤嘲讽沙像，本场最多 2 次', level => {
    const out = simulate({ player: [owned('d_dunecaster', level)], enemy: [{ defId: 'e_golem' }] });
    const summons = out.log.filter(line => line.ev.t === 'summon' && line.ev.src === 1);
    expect(summons).toHaveLength(2);
    const hp = [6, 8, 10][level - 1];
    for (const line of summons) {
      if (line.ev.t !== 'summon') continue;
      const uid = line.ev.uid;
      expect(line.snap.find(unit => unit.uid === uid)).toMatchObject({ defId: 't_statue', atk: 0, hp, maxHp: hp, slot: 1 });
    }
    expect(out.log.filter(line => line.ev.t === 'act' && line.ev.uid === 1 && line.ev.mode === 'cast')).toHaveLength(2);
    expect(out.log.some(line => line.ev.t === 'taunt' && line.ev.from === 1)).toBe(true);
    expect(out.log.some(line => line.ev.t === 'attack' && line.ev.pairs.some(p => p.atk === 2 && p.tgt === 1))).toBe(false);
  });

  it.each([[1, 1], [2, 1], [3, 2]])('唤亡祭师 %i 星复活第一个阵亡友军（半血、插到身后），本场最多 %i 次', (level, uses) => {
    const out = simulate({ player: [owned('n_merc', 1, 1), owned('a_ritualist', level, 2)], enemy: [{ defId: 'e_brute', atk: 6, hp: 99 }] });
    const revive = out.log.find(line => line.ev.t === 'revive' && line.ev.uid === 1);
    expect(revive).toBeDefined();
    const merc = revive!.snap.find(unit => unit.uid === 1)!;
    const base = levelStats('n_merc', 1);
    expect(merc).toMatchObject({ alive: true, hp: Math.max(1, Math.ceil(base.hp / 2)), slot: 1 });
    expect(revive!.snap.find(unit => unit.uid === 2)?.slot).toBe(0);
    const casts = out.log.filter(line => line.ev.t === 'act' && line.ev.uid === 2 && line.ev.mode === 'cast');
    expect(casts.length).toBeLessThanOrEqual(uses);
    expect(out.afterStart.find(unit => unit.uid === 2)?.charges).toBe(uses);
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
    expect(out.afterStart.find(unit => unit.ownedId === 3)).toMatchObject({ atk: 5 + amount, hp: 15 + amount, grants: { armor: [1, 2, 2][level - 1] } });
  });

  it.each([1, 2, 3])('棘背兽 %i 星以更高生命区分墓园守卫', level => {
    const out = simulate({ player: [owned('n_thorn', level, 1), owned('a_graveguard', level, 2)], enemy: [{ defId: 'e_golem' }] });
    const thorn = out.afterStart.find(unit => unit.ownedId === 1)!;
    const graveguard = out.afterStart.find(unit => unit.ownedId === 2)!;
    expect(thorn.atk).toBe(graveguard.atk);
    expect(thorn.maxHp).toBe(graveguard.maxHp + 2);
  });
});
