import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import { statsOf } from '../src/ui/board';
import { unitAbilityText } from '../src/ui/tip';

const stats = { atk: 2, hp: 11, block: 0, chill: 0, burn: 0 };

describe('instance armor details avoid repeating static armor', () => {
  it.each([0, 2, 5])('uses known total armor %i rather than repeating base armor 2', armor => {
    expect(unitAbilityText('e_golem', 2, { ...stats, armor })).toBe('');
    expect(unitAbilityText('e_golem', 2, { ...stats, kw: { power: 0, armor } })).toBe('');
  });

  it('keeps static armor when there is no instance or its armor is unknown', () => {
    expect(unitAbilityText('e_golem', 2)).toBe('护甲 2');
    expect(unitAbilityText('e_golem', 2, stats)).toBe('护甲 2');
    expect(unitAbilityText('e_golem', 2, { ...stats, kw: { power: 0 } })).toBe('护甲 2');
  });

  it('preserves conditional armor, aura and armor growth mechanisms', () => {
    expect(unitAbilityText('v_keeper', 2, { ...stats, armor: 3 })).toBe('任一敌人被冻结时：我方队首获得 1 层格挡（每回合限 1 次）');
    expect(unitAbilityText('v_sentinel', 2, { ...stats, armor: 1 })).toBe('相邻友军施法后：敌方下一个出手者获得 2 层寒意');
    expect(unitAbilityText('l_warden', 2, { ...stats, armor: 2 })).toContain('自己每消耗 1 层格挡：本场护甲 +1');
    expect(unitAbilityText('v_conduit', 2, { ...stats, armor: 0 })).toBe('在场且备战结束时：相邻其他寒意法术受益友军永久 +1 法强（每次备战限 1 次）');
  });

  it('uses real battle armor including equipped armor', () => {
    const b = new Battle({ player: [{ defId: 'e_golem', ownedId: 1, copies: 2, equips: ['eq_ice'] }], enemy: [{ defId: 'e_skel' }] });
    const unit = b.at(0, 0)!;
    const current = statsOf(b.snap().find(u => u.uid === unit.uid)!);
    expect(current.kw?.armor).toBe(3);
    expect(unitAbilityText(unit.defId, unit.level, current)).toBe('');
  });
});
