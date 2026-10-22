import { describe, expect, it } from 'vitest';
import { simulate } from '../src/core/engine';
import type { BattleOutput, EnemyEntry, Slotted } from '../src/core/types';

const owned = (level = 1, block = 0, defId = 'l_warden'): Slotted => ({
  defId, ownedId: 9901, copies: ([1, 2, 4] as const)[level - 1], train: { block, hp: 30 },
});
const play = (unit: Slotted, foe: EnemyEntry = { defId: 'e_skel', atk: 6, hp: 999 }) =>
  simulate({ player: [unit, null, null, null, null], enemy: [foe, null, null, null, null] });
const gains = (out: BattleOutput) => out.log.filter(({ ev }) => ev.t === 'buff' && ev.src === 1 && ev.tgt === 1 && ev.atk === 0 && ev.hp === 0);
const attacks = (out: BattleOutput) => out.log.filter(({ ev }) => ev.t === 'dmg' && ev.tgt === 1 && ev.kind === 'attack');

describe('晨光盾卫：格挡转本场护甲', () => {
  it.each([[1, 1], [2, 2], [3, 2]])('%i星默认获得%i层格挡，每次固定加1护甲且满血有效', (level, blocks) => {
    const out = play(owned(level));
    expect(out.fault).toBeUndefined();
    expect(out.initial[0].block).toBe(0);
    expect(out.afterStart[0].block).toBe(blocks);
    const first = gains(out)[0];
    expect(first).toBeDefined();
    expect(first.snap[0].grants.armor).toBe(1);
    expect(first.snap[0].armor).toBe(1);
    expect(gains(out).map(x => x.snap[0].grants.armor)).toEqual(blocks === 1 ? [1] : [1, 2]);
    expect(first.snap[0].hp).toBe(first.snap[0].maxHp);
    expect(out.log.some(({ ev }) => ev.t === 'heal' && ev.src === 1 && ev.tgt === 1)).toBe(false);
  });

  it('多层格挡分别触发并叠加，之后的直接伤害使用累计护甲', () => {
    const out = play(owned(3));
    expect(gains(out).slice(0, 2).map(x => x.snap[0].grants.armor)).toEqual([1, 2]);
    expect(attacks(out).slice(0, 3).map(x => x.ev)).toMatchObject([
      { blocked: true, n: 0 }, { blocked: true, n: 0 }, { n: 4 },
    ]);
    expect(gains(out)).toHaveLength(2);
  });

  it('累计护甲不会将直接伤害减至0', () => {
    const out = play(owned(3), { defId: 'e_skel', atk: 2, hp: 999 });
    expect(gains(out)).toHaveLength(2);
    expect(attacks(out)[2].ev).toMatchObject({ n: 1 });
  });

  it('默认格挡耗尽后受击不再触发加甲', () => {
    const out = play(owned(1));
    expect(gains(out)).toHaveLength(1);
    expect(attacks(out)[1].ev).toMatchObject({ n: 5 });
    expect(attacks(out)[1].snap[0].block).toBe(0);
  });

  it.each([[1, 1, 2], [2, 1, 3], [3, 3, 3]])('星级%i叠加%i整备格挡后最多3层（实际%i）', (level, trained, total) => {
    const out = play(owned(level, trained));
    expect(out.initial[0].block).toBe(trained);
    expect(out.afterStart[0].block).toBe(total);
    expect(gains(out)).toHaveLength(total);
    expect(gains(out).at(-1)!.snap[0].grants.armor).toBe(total);
  });

  it('灼烧绕过格挡和护甲，不触发转甲', () => {
    // A caster supplies burn; a separate attacker consumes the blocks.
    const out = simulate({ player: [owned(3), null, null, null, null],
      enemy: [{ defId: 'm_shaman', hp: 999 }, { defId: 'e_skel', atk: 1, hp: 999 }, null, null, null] });
    const burns = out.log.filter(({ ev }) => ev.t === 'dmg' && ev.tgt === 1 && ev.kind === 'burn');
    expect(burns.length).toBeGreaterThan(1);
    expect(burns[0].snap[0].block).toBe(2);
    expect(burns[0].snap[0].grants.armor ?? 0).toBe(0);
    const armoredBurn = burns.find(x => (x.snap[0].grants.armor ?? 0) > 0);
    expect(armoredBurn).toBeDefined();
    expect(armoredBurn!.ev).toMatchObject({ n: armoredBurn!.snap[0].burn });
    expect(gains(out)).toHaveLength(2);
  });

  it('其他单位破挡不获得盾卫护甲', () => {
    const out = play(owned(1, 1, 'n_medic'));
    expect(attacks(out)[0].ev).toMatchObject({ blocked: true });
    expect(gains(out)).toHaveLength(0);
    expect(attacks(out)[1].ev).toMatchObject({ n: 6 });
  });

  it('同一拥有单位下一场护甲归零，不污染培养数据', () => {
    const unit = owned(3);
    const before = structuredClone(unit);
    const first = play(unit);
    expect(gains(first).at(-1)!.snap[0].grants.armor).toBe(2);
    const second = play(unit);
    expect(second.initial[0].grants.armor ?? 0).toBe(0);
    expect(second.afterStart[0].armor).toBe(0);
    expect(second.afterStart[0].block).toBe(2);
    expect(gains(second)[0].snap[0].grants.armor).toBe(1);
    expect(unit).toEqual(before);
  });
});
