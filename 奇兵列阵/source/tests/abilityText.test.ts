import { describe, expect, it } from 'vitest';
import { abilityText, generalAbilityText, ownedPower } from '../src/core/abilityText';
import { describe as baseDescription } from '../src/core/run';
import { effectAmount } from '../src/core/power';
import { simulate, tri } from '../src/core/engine';
import { UNITS } from '../src/core/data';
import type { Slotted } from '../src/core/types';

const owned = (defId: string, power = 0): Slotted => ({ defId, ownedId: 99, copies: 1, train: { power } });
describe('实时技能描述', () => {
  it('单体公式与实际施法量相同，默认包含内置法强', () => {
    expect(abilityText('a_cult', 1)).toContain('4 伤害（3+1法强）');
    const out = simulate({ player: [owned('a_cult', 1)], enemy: [{ defId: 'e_skel', atk: 1, hp: 99 }] });
    const u = out.afterStart[0];
    expect(u.power).toBe(2);
    expect(abilityText(u.defId, u.level, u.power)).toContain('5 伤害（3+2法强）');
    expect(out.log.some(l => l.ev.t === 'dmg' && l.ev.src === u.uid && l.ev.n === 5)).toBe(true);
  });
  it('群体奇数法强向下取整，多项施法分别计算', () => {
    expect(abilityText('v_drake', 1, 3)).toContain('2 层寒意（1+⌊3法强/2⌋）');
    expect(abilityText('n_alchemist', 1, 2)).toContain('4 层灼烧（2+2法强）和 3 层寒意（1+2法强）');
    expect(abilityText('s_caster', 1, 2)).toContain('5 伤害（3+2法强），并获得 4 层易伤（2+2法强）');
  });
  it('不强化非施法、格挡、加攻、额外出手或零基础', () => {
    for (const id of ['m_raptor', 'a_spine', 'l_shield', 'd_artificer', 's_dancer', 'a_engulf']) {
      const text = abilityText(id, 1, 5);
      if (id === 'a_engulf') expect(text).toContain('击杀时：相邻友军本场法强 +1');
      else expect(text).toBe(baseDescription(id, 1));
    }
    expect(effectAmount({ op: 'dmg', to: 'enemyFront' }, 2, 5, false)).toBe(2);
    expect(effectAmount({ op: 'dmg', to: 'enemyAll' }, 0, 5, true)).toBe(0);
  });
  it('当前卡表所有受法强施法均有对应描述，失败不静默漏算', () => {
    for (const d of UNITS) for (const level of [1, 2, 3]) {
      const effects = (d.cast ?? []).filter(e => ['dmg', 'heal', 'burn', 'chill', 'vuln'].includes(e.op) && tri(e.v, level) > 0);
      if (!effects.length) continue;
      const text = abilityText(d.id, level, 3);
      expect((text.match(/法强[\/）]/g) ?? []).length, `${d.id} ★${level}`).toBe(effects.length);
    }
  });
  it('备战自身法强包含培养和装备，升级基础描述保持纯基础', () => {
    expect(ownedPower('a_cult', 1, { ...owned('a_cult', 2), equips: ['eq_tome'] })).toBe(5);
    const before = baseDescription('a_cult', 2);
    abilityText('a_cult', 1, 20);
    expect(baseDescription('a_cult', 2)).toBe(before);
    expect(before).toContain('受 4 伤害');
    expect(before).not.toContain('20法强');
  });
});
describe('主将沿用实际公式', () => {
  it('七名主将基础效果均显示已代入法强', () => {
    for (const [id, value] of [['argeon', 4], ['kaleos', 5], ['lilithe', 4], ['vulkan', 4], ['faie', 4], ['zirix', 5]] as const) {
      expect(generalAbilityText(id, 2)).toContain(String(value));
      expect(generalAbilityText(id, 2)).toContain('2法强');
    }
    expect(generalAbilityText('hank', 2)).toContain('攻击 +2（2法强）');
  });
  it('主将专属公式、作用对象、频率正确', () => {
    expect(generalAbilityText('argeon', 3, ['argeon_1', 'argeon_2', 'argeon_4'])).toBe('每第 2 拍结束：全体友军获得 2 层格挡，并恢复 3 生命（⌈(2+3法强)/2⌉）');
    expect(generalAbilityText('lilithe', 2, ['lilithe_2', 'lilithe_3'])).toContain('全体敌人受 3 伤害（max(1,2+2法强−1)），全体友军恢复等量生命');
    expect(generalAbilityText('vulkan', 3, ['vulkan_1', 'vulkan_4'])).toContain('敌方前两位获得 8 层灼烧（2+3法强×2）');
    expect(generalAbilityText('zirix', 3, ['zirix_1'])).toContain('全体敌人获得 2 层易伤（1+⌊3法强/2⌋）');
    expect(generalAbilityText('faie', 2, ['faie_1', 'faie_4'])).toContain('每第 2 拍结束：敌方前两个出手者');
    expect(generalAbilityText('hank', 3, ['hank_1', 'hank_3', 'hank_4'])).toContain('攻击 +5（2+3法强）；立即攻击改为攻击敌方队尾');
    expect(generalAbilityText('kaleos', 2, ['kaleos_2', 'kaleos_4'])).toContain('技能额外命中敌方队尾；技能目标获得 2 层易伤');
  });
});
