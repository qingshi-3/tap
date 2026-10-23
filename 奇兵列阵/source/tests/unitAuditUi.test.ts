import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import { unitAbilityText } from '../src/ui/tip';
import { statsOf } from '../src/ui/board';

describe('finite spell use details follow actual battle state', () => {
  it.each([1, 2, 3])('counts down remaining uses and exhausts at star %i', level => {
    const b = new Battle({
      player: [{ defId: 's_dart', ownedId: 1, copies: [1, 2, 4][level - 1], train: { hp: 100 } }],
      enemy: [{ defId: 'e_skel', atk: 1, hp: 999 }],
    });
    const caster = b.at(0, 0)!;
    const advance = b as unknown as { startPhase(): void; doBeat(): void };
    advance.startPhase();
    const uses = 2;
    for (let remaining = uses; remaining >= 0; remaining--) {
      expect(caster.charges).toBe(remaining);
      const text = unitAbilityText(caster.defId, caster.level, statsOf(caster));
      if (remaining) expect(text).toContain(`本场剩余 ${remaining} 次`);
      else expect(text).toContain('本场已用完，改普攻');
      // 召唤物也占行动轮：推进到施法者本人再出手一次
      const acted = () => b.log.filter(l => l.ev.t === 'act' && l.ev.uid === caster.uid).length;
      const n = acted();
      for (let i = 0; i < 30 && acted() === n; i++) advance.doBeat();
    }
    expect(caster.charges).toBe(0);
    expect(b.log.filter(l => l.ev.t === 'act' && l.ev.uid === caster.uid).map(l => l.ev.t === 'act' ? l.ev.mode : '')).toEqual([...Array(uses).fill('cast'), 'attack']);
  });

  it('retains total uses without a battle instance and does not invent limits for unlimited casters', () => {
    expect(unitAbilityText('a_ritualist', 1)).toContain('本场最多 1 次');
    const b = new Battle({ player: [{ defId: 'a_devour' }], enemy: [{ defId: 'e_skel' }] });
    const caster = b.at(0, 0)!;
    expect(statsOf(caster).charges).toBeUndefined();
    expect(unitAbilityText(caster.defId, 1, statsOf(caster))).not.toMatch(/剩余|已用完/);
  });
});
