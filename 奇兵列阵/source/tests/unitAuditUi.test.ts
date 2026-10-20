import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import { unitAbilityText } from '../src/ui/tip';
import { statsOf } from '../src/ui/board';

describe('finite spell use details follow actual battle state', () => {
  it.each([1, 2, 3])('shows 3/2/1 remaining and exhausted at star %i', level => {
    const b = new Battle({
      player: [{ defId: 'a_ritualist', ownedId: 1, copies: [1, 2, 4][level - 1], train: { hp: 100 } }],
      enemy: [{ defId: 'e_skel', atk: 1, hp: 999 }],
    });
    const caster = b.at(0, 0)!;
    const advance = b as unknown as { startPhase(): void; doBeat(): void };
    advance.startPhase();
    for (const remaining of [3, 2, 1, 0]) {
      expect(caster.charges).toBe(remaining);
      const text = unitAbilityText(caster.defId, caster.level, statsOf(caster));
      if (remaining) expect(text).toContain(`本场剩余 ${remaining} 次`);
      else expect(text).toContain('本场已用完，改普攻');
      advance.doBeat();
    }
    expect(caster.charges).toBe(0);
    expect(b.log.filter(l => l.ev.t === 'act' && l.ev.side === 0).map(l => l.ev.t === 'act' ? l.ev.mode : '')).toEqual(['cast', 'cast', 'cast', 'attack']);
  });

  it('retains total uses without a battle instance and does not invent limits for unlimited casters', () => {
    expect(unitAbilityText('a_ritualist', 1)).toContain('本场 3 次');
    const b = new Battle({ player: [{ defId: 'a_devour' }], enemy: [{ defId: 'e_skel' }] });
    const caster = b.at(0, 0)!;
    expect(statsOf(caster).charges).toBeUndefined();
    expect(unitAbilityText(caster.defId, 1, statsOf(caster))).not.toMatch(/剩余|已用完/);
  });
});
