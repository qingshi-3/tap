import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import type { DmgKind, EnemyEntry } from '../src/core/types';

const E = (defId = 'e_skel', extra: Partial<EnemyEntry> = {}): EnemyEntry => ({ defId, atk: 1, hp: 100, ...extra });
function step(b: Battle, n = 1) {
  const pipeline = b as unknown as { startPhase(): void; doBeat(): void };
  if (!b.beat) pipeline.startPhase();
  for (let i = 0; i < n && !b.outcome(); i++) pipeline.doBeat();
  return b.log.map((x) => x.ev);
}

describe('第二候选：法伊前期击杀与蕾娃换位压力', () => {
  it('法伊后发仍从普攻击杀获全队永久攻击收益', () => {
    const b = new Battle({ player: [E('e_skel', { atk: 10 }), E('e_skel', { atk: 2 })], enemy: [E('e_skel', { hp: 1 }), E()], general: { id: 'faie', power: 0, passives: ['faie_3'] } });
    step(b, 3);
    expect(b.metrics.kills).toBe(1);
    expect(b.units.slice(0, 2).map((u) => u.atk)).toEqual([15, 7]);
    step(b, 2);
    // 后发的临时3攻击已消失，击杀的2攻击仍在。
    expect(b.units.slice(0, 2).map((u) => u.atk)).toEqual([12, 4]);
  });

  it('技能同次杀三个敌人最多奖励两次，第三回合技能击杀不奖励', () => {
    for (const round of [1, 3]) {
      const b = new Battle({ player: [E('a_chanter'), E()], enemy: [E('e_skel', { hp: 1 }), E('e_skel', { hp: 1 }), E('e_skel', { hp: 1 }), E('e_skel', { hp: 1000 })], general: { id: 'faie', power: 0, passives: [] } });
      b.round = round; b.units[0].charge = 2;
      const ev = step(b);
      expect(b.metrics.kills).toBe(3);
      expect(b.units[1].atk).toBe(round === 1 ? 5 : 1);
      expect(ev.filter((e) => e.t === 'gen' && e.label === '乘胜')).toHaveLength(round === 1 ? 2 : 0);
    }
  });

  it('敌人复生前的阵亡仍计一次收益', () => {
    const b = new Battle({ player: [E('e_skel', { atk: 10 })], enemy: [E('a_spine', { hp: 1 }), E()], general: { id: 'faie', power: 0, passives: [] } });
    const ev = step(b);
    expect(ev.some((e) => e.t === 'revive' && e.uid === 2)).toBe(true);
    expect(b.units[0].atk).toBe(12);
  });

  it.each(['burn', 'thorns', 'fatigue', 'splash'] as DmgKind[])('%s击杀不发放收益', kind => {
    const b = new Battle({ player: [E()], enemy: [E(), E()], general: { id: 'faie', power: 0, passives: [] } });
    b.hit(b.units[0], b.units[1], 1000, kind);
    const ev = step(b);
    expect(b.units[0].atk).toBe(1);
    expect(ev.some((e) => e.t === 'gen' && e.label === '乘胜')).toBe(false);
  });

  it('无来源技能击杀不发放收益', () => {
    const b = new Battle({ player: [E()], enemy: [E(), E()], general: { id: 'faie', power: 0, passives: [] } });
    b.hit(undefined, b.units[1], 1000, 'ability'); step(b);
    expect(b.units[0].atk).toBe(1);
  });

  it('蕾娃没有交换不减攻，重复交换每实体只减1，惊扰额外叠加', () => {
    for (const disturb of [false, true]) for (const swapped of [false, true]) {
      const b = new Battle({ player: [E('x_egg')], enemy: [E('e_skel', { atk: 10 }), E('e_skel', { atk: 10 }), E('e_skel', { atk: 10 })], general: { id: 'reva', power: 4, passives: ['reva_1', ...(disturb ? ['reva_2'] : [])] }, swaps: swapped ? [[0, 1], [1, 0]] : [] });
      step(b);
      expect(b.units.slice(1).map((u) => u.atk)).toEqual(swapped ? [disturb ? 6 : 9, disturb ? 6 : 9, 10] : [10, 10, 10]);
    }
  });
});
