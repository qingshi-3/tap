import { describe, expect, it } from 'vitest';
import { unitDef } from '../src/core/data';
import { applyResult, eggThreshold, getOwned, hireMerc, newRun, reserveSlots, screen, signMerc, swapCap, type RunState } from '../src/core/run';

/** 赢一场，进入下一个战斗节点（会重新生成佣兵 / 军需官法术） */
function nextBattle(r: RunState) {
  r.picks = 0;
  applyResult(r, 'win');
  while (screen(r) !== 'prep') {
    if (screen(r) === 'shop') { r.shop = null; r.node++; }
    else throw new Error(`unexpected screen ${screen(r)}`);
  }
}

describe('v0.8 局外被动（作用在 RunState，不经过战斗引擎）', () => {
  it('赫克：佣兵默认二阶，精锐合同改三阶', () => {
    for (let s = 1; s <= 6; s++) {
      const a = newRun('hank', s);
      expect(unitDef(a.merc!.id).tier).toBe(2);
      a.passives.push('hank_3'); nextBattle(a);
      expect(unitDef(a.merc!.id).tier).toBe(3);
    }
  });
  it('赫克：长约才能转正，转正后战后不遣散', () => {
    const r = newRun('hank', 7); r.gold = 10; r.picks = 0;
    expect(hireMerc(r)).toBe(true);
    const at = [0, 1, 2, 3, 4].find(i => getOwned(r, i)?.temp)!;
    expect(signMerc(r, at)).toBe(false);
    r.passives.push('hank_1');
    expect(signMerc(r, at)).toBe(true);
    const id = getOwned(r, at)!.defId;
    nextBattle(r);
    expect(getOwned(r, at)?.defId).toBe(id);
  });
  it('赫克：没签的佣兵战后离队', () => {
    const r = newRun('hank', 8); r.gold = 10; r.picks = 0;
    hireMerc(r);
    const at = [0, 1, 2, 3, 4].find(i => getOwned(r, i)?.temp)!;
    nextBattle(r);
    expect(getOwned(r, at)).toBeNull();
  });
  it('赫克：军需官每场送一张法术', () => {
    const r = newRun('hank', 9);
    nextBattle(r); expect(r.spells.length).toBe(0);
    r.passives.push('hank_4'); nextBattle(r); expect(r.spells.length).toBe(1);
  });
  it('萨吉：预备位 1 格，sajj_3 改 2 格；其他主将 0 格', () => {
    const r = newRun('sajj', 1);
    expect(reserveSlots(r)).toBe(1);
    r.passives.push('sajj_3'); expect(reserveSlots(r)).toBe(2);
    expect(reserveSlots(newRun('kaleos', 1))).toBe(0);
  });
  it('蕾娃：换位 1 次，reva_1 改 2 次', () => {
    const r = newRun('reva', 1);
    expect(swapCap(r)).toBe(1);
    r.passives.push('reva_1'); expect(swapCap(r)).toBe(2);
  });
  it('星角：孵化阈值 12，xingjiao_1 改 8；xingjiao_2 孵化后再给一颗蛋', () => {
    const r = newRun('xingjiao', 1);
    expect(eggThreshold(r)).toBe(12);
    r.passives.push('xingjiao_1', 'xingjiao_2'); expect(eggThreshold(r)).toBe(8);
    r.picks = 0;
    applyResult(r, 'win', 0, { death: 0, burn: 8, freeze: 0, move: 0, summon: 0 });
    expect(r.lastHatch).toBe('x_fire');
    expect([...r.slots, ...r.bench].some(u => u?.defId === 'x_egg')).toBe(true);
  });
});
