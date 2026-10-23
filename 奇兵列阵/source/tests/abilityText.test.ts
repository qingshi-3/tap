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
    expect(abilityText('s_caster', 1)).toContain('6 伤害（5+1法强）');
    const out = simulate({ player: [owned('s_caster', 1)], enemy: [{ defId: 'e_skel', atk: 1, hp: 99 }] });
    const u = out.afterStart[0];
    expect(u.power).toBe(2);
    expect(abilityText(u.defId, u.level, u.power)).toContain('7 伤害（5+2法强）');
    expect(out.log.some(l => l.ev.t === 'dmg' && l.ev.src === u.uid && l.ev.n === 7)).toBe(true);
  });
  it('群体奇数法强向下取整，多项施法分别计算', () => {
    expect(abilityText('a_chanter', 1, 3)).toContain('3 伤害（2+⌊3法强/2⌋）');
    expect(abilityText('v_stag', 1, 3)).toContain('3 层寒意（2+⌊3法强/2⌋）');
    expect(abilityText('s_caster', 1, 2)).toContain('7 伤害（5+2法强），本场攻击 −1');
  });
  it('不强化非施法、格挡、加攻、额外出手或零基础', () => {
    for (const id of ['m_raptor', 'a_spine', 'l_shield', 'd_artificer', 's_dancer', 'n_alchemist']) {
      const text = abilityText(id, 1, 5);
      expect(text).toBe(baseDescription(id, 1));
    }
    expect(effectAmount({ op: 'dmg', to: 'enemyFront' }, 2, 5, false)).toBe(2);
    expect(effectAmount({ op: 'dmg', to: 'enemyAll' }, 0, 5, true)).toBe(0);
  });
  it('当前卡表所有受法强施法均有对应描述，失败不静默漏算', () => {
    for (const d of UNITS) for (const level of [1, 2, 3]) {
      const effects = (d.cast ?? d.chargeSkill ?? []).filter(e => ['dmg', 'heal', 'burn', 'chill'].includes(e.op) && tri(e.v, level) > 0);
      if (!effects.length) continue;
      const text = abilityText(d.id, level, 3);
      expect((text.match(/法强[\/）]/g) ?? []).length, `${d.id} ★${level}`).toBe(effects.length);
    }
  });
  it('备战自身法强包含培养和装备，升级基础描述保持纯基础', () => {
    expect(ownedPower('s_caster', 1, { ...owned('s_caster', 2), equips: ['eq_tome'] })).toBe(5);
    const before = baseDescription('s_caster', 2);
    abilityText('s_caster', 1, 20);
    expect(baseDescription('s_caster', 2)).toBe(before);
    expect(before).toContain('受 7 伤害');
    expect(before).not.toContain('20法强');
  });
});
describe('主将沿用实际公式', () => {
  it('带「N+法强」的主将技能显示已代入法强，无法强时只留基础值', () => {
    expect(generalAbilityText('vulkan', 2)).toContain('敌方队首获得 4（2+2法强） 层灼烧');
    expect(generalAbilityText('vulkan', 0)).toContain('敌方队首获得 2 层灼烧');
    expect(generalAbilityText('kaleos', 2)).toContain('本次攻击 +2');
    expect(generalAbilityText('kaleos', 0)).not.toContain('法强');
    for (const id of ['argeon', 'zilan', 'reva', 'lilithe', 'kasiva', 'xingjiao', 'faie', 'kara', 'zirix', 'sajj', 'hank']) {
      expect(generalAbilityText(id, 2), id).not.toContain('2法强');
    }
  });
  it('主将专属被动公式代入法强，只拼接本主将的被动', () => {
    expect(generalAbilityText('argeon', 3, ['argeon_3'])).toContain('光誓：有友军受伤时，阿尔吉昂改为施法：全体友军恢复 5（2+3法强） 生命；否则普攻');
    expect(generalAbilityText('lilithe', 2, ['lilithe_1'])).toContain('对敌方队首造成 6（4+2法强） 伤害');
    expect(generalAbilityText('zilan', 2, ['zilan_2', 'zilan_3'])).toContain('下回合 +4（2+2法强） 攻；换防：被轮转到队尾的友军恢复 5（3+2法强） 生命');
    expect(generalAbilityText('zirix', 3, ['zirix_3'])).toContain('各受 6（3+3法强） 伤害');
    expect(generalAbilityText('reva', 3, ['reva_2'])).toContain('惊扰：被你调动的敌人本场额外减攻 2');
    expect(generalAbilityText('reva', 0, ['reva_2'])).toContain('额外减攻 1');
    expect(generalAbilityText('faie', 2, ['faie_1'])).toContain('获得 4（2+2法强） 层寒意');
    expect(generalAbilityText('sajj', 2, ['sajj_2'])).toContain('本场 +4（2+2法强）/+4（2+2法强）');
    expect(generalAbilityText('xingjiao', 2, ['xingjiao_3'])).toContain('龙本场 +2/+4');
    expect(generalAbilityText('hank', 3, ['hank_1', 'vulkan_1'])).toBe(
      '每场战斗前可免费招 1 名临时佣兵（随机二阶，只参加本场）；每场胜利 +1 金；长约：临时佣兵可以花 3 金转正');
  });
});
