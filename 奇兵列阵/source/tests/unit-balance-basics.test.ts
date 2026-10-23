import { describe, expect, it } from 'vitest';
import { levelStats, simulate } from '../src/core/engine';
import { newRun, commitPreparation, takeDraft } from '../src/core/run';
import type { Copies, Slotted } from '../src/core/types';

const owned = (defId: string, level = 1, ownedId = 1): Slotted => ({ defId, ownedId, copies: [1, 2, 4][level - 1] as Copies });

describe('定向单位调整：真实内容能力结算', () => {
  it.each([1, 2, 3])('幽火灵蛇 %i 星亡语召唤一个带护盾亡语的对应星级暗影', level => {
    const out = simulate({ player: [owned('a_seed', level)], enemy: [{ defId: 'e_void' }] });
    const summoned = out.log.filter(line => line.ev.t === 'summon' && line.ev.src === 1);
    expect(summoned).toHaveLength(1);
    expect(out.log.some(line => line.ev.t === 'trigger' && line.ev.src === 1 && line.ev.kind === 'rattle')).toBe(true);
    const last = summoned.at(-1)!;
    const shades = last.snap.filter(unit => unit.defId === 't_shade' && unit.side === 0);
    expect(shades.map(u => u.slot)).toEqual([0]);
    for (const shade of shades) expect(shade).toMatchObject({ atk: level + 1, hp: level + 1, maxHp: level + 1, summoned: true });
  });

  it.each([1, 2, 3])('沙灵塑师 %i 星施法召唤一次大嘲讽沙像，之后普攻', level => {
    const out = simulate({ player: [owned('d_dunecaster', level)], enemy: [{ defId: 'e_golem' }] });
    const summons = out.log.filter(line => line.ev.t === 'summon' && line.ev.src === 1);
    expect(summons).toHaveLength(1);
    const hp = [7, 10, 13][level - 1];
    for (const line of summons) {
      if (line.ev.t !== 'summon') continue;
      const uid = line.ev.uid;
      expect(line.snap.find(unit => unit.uid === uid)).toMatchObject({ defId: 't_statue', atk: 0, hp, maxHp: hp, slot: 1 });
    }
    expect(out.log.filter(line => line.ev.t === 'act' && line.ev.uid === 1 && line.ev.mode === 'cast')).toHaveLength(1);
    expect(out.log.some(line => line.ev.t === 'taunt' && line.ev.from === 1)).toBe(false);
    expect(out.log.some(line => line.ev.t === 'attack' && line.ev.pairs.some(p => p.atk === 2 && p.tgt === 1))).toBe(true);
  });

  it.each([[1, 1], [2, 1], [3, 2]])('唤亡祭师 %i 星复活最高攻非召唤物阵亡友军（半血、插到身后），本场最多 %i 次', (level, uses) => {
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

  it.each([1, 2, 3])('永夜吟诵者 %i 星备战培育相邻法术受益者，开战即时供法强且不污染永久成长', level => {
    const r = newRun('kaleos', 73);
    r.slots = [owned('a_devour', 1, 1), owned('a_solus', level, 2), owned('n_thorn', 1, 3), null, null];
    r.allocLog = []; r.prepCommitted = false; r.prepUses = {};
    commitPreparation(r); commitPreparation(r);
    const power = [1, 2, 3][level - 1];
    expect(r.slots[0]?.growth?.power).toBe(power);
    expect(r.slots[2]?.growth).toBeUndefined();
    const out = simulate({ player: r.slots, enemy: [{ defId: 'e_nightk' }] });
    expect(out.initial[0].power).toBe(power);
    expect(out.afterStart[0].power).toBe(power + [2,3,4][level - 1]);
    expect(out.log.some(l => l.ev.t === 'buff' && l.ev.src === 2 && l.ev.tgt === 1)).toBe(true);
    expect(r.slots[0]?.growth?.power).toBe(power);
  });

  it.each([1, 2, 3])('落日灵驹 %i 星结束备战给队首攻和队尾血，升星不再额外触发', level => {
    const r = newRun('kaleos', 74);
    r.slots = [owned('n_colossus', 1, 1), owned('n_paragon', level, 2), owned('s_wind', 1, 3), null, null];
    r.draft = ['s_wind', '', '', '', '']; r.gold = 10; r.picks = 2;
    expect(takeDraft(r, 0, 2)).toBe('merge');
    expect(r.slots[0]?.growth).toBeUndefined();
    commitPreparation(r); commitPreparation(r);
    expect(r.slots[0]?.growth).toEqual({ atk: [3, 4, 5][level - 1] });
    expect(r.slots[2]?.growth?.hp).toBe([4, 6, 8][level - 1]);
    const out = simulate({ player: r.slots, enemy: [{ defId: 'e_nightk' }] });
    expect(out.afterStart[0].atk).toBe(7 + [3, 4, 5][level - 1]);
    expect(out.afterStart[0].grants.armor).toBeUndefined();
    expect(out.afterStart[2].maxHp).toBe(5 + [4, 6, 8][level - 1]);
  });

  it.each([1, 2, 3])('棘背兽 %i 星以更高生命区分墓园守卫', level => {
    const out = simulate({ player: [owned('n_thorn', level, 1), owned('a_graveguard', level, 2)], enemy: [{ defId: 'e_golem' }] });
    const thorn = out.afterStart.find(unit => unit.ownedId === 1)!;
    const graveguard = out.afterStart.find(unit => unit.ownedId === 2)!;
    expect(thorn.atk).toBe(graveguard.atk);
    expect(thorn.maxHp).toBe(graveguard.maxHp + 2);
  });
});
