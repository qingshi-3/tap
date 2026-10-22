import { describe, expect, it } from 'vitest';
import { SPELLS } from '../src/core/content';
import {
  applyResult, beginBattle, buildBattle, canSell, cloneRun, finishBattle, newRun,
  recoverEmptyRoster, sell, settleRewardedRetry, takeDraft, unuseSpell, useSpell,
  type RunState,
} from '../src/core/run';
import type { BattleResult } from '../src/core/types';

function roster(slot = 0): RunState {
  const r = newRun('lilithe', 624);
  r.picks = 0;
  if (slot < 5) r.slots[slot] = { defId: 'n_merc', ownedId: 1, copies: 1 };
  else r.bench[slot - 5] = { defId: 'n_merc', ownedId: 1, copies: 1 };
  return r;
}
const spell = SPELLS[0].id;

describe('卖出保护与旧空阵容恢复', () => {
  it.each([0, 5])('招募耗尽时不能卖掉最后一个持有单位（位置 %s）', slot => {
    const r = roster(slot), before = cloneRun(r);
    expect(canSell(r, slot)).toBe(false);
    expect(sell(r, slot)).toBe(false);
    expect(r).toEqual(before);
  });
  it('阿尔吉昂亲征单位始终不可出售，且算作持有单位', () => {
    const r = newRun('argeon', 624); r.picks = 0;
    expect(r.slots[0]?.defId).toBe('x_argeon');
    expect(canSell(r, 0)).toBe(false); expect(sell(r, 0)).toBe(false);
    r.bench[0] = { defId: 'n_merc', ownedId: 99, copies: 1 };
    expect(canSell(r, 5)).toBe(true);
    expect(recoverEmptyRoster(r)).toBe(false);
  });
  it('场上与备战共同计数，正常卖出仍返还金币、培养点和装备', () => {
    const r = roster();
    r.bench[0] = { defId: 'n_merc', ownedId: 2, copies: 2, train: { power: 2 }, equips: ['eq_flame'] };
    r.allocLog = [{ to: 2, type: 'power' }];
    expect(canSell(r, 5)).toBe(true);
    expect(sell(r, 5)).toBe(true);
    expect(r.gold).toBe(2);
    expect(r.stash.power).toBe(2);
    expect(r.bag).toEqual(['eq_flame']);
    expect(r.allocLog).toEqual([]);
    expect(canSell(r, 0)).toBe(false);
  });
  it('剩余招募与商店允许卖出最后一个单位', () => {
    const draft = roster(); draft.picks = 1;
    expect(sell(draft, 0)).toBe(true);
    const shop = roster(); shop.node = 3;
    expect(sell(shop, 0)).toBe(true);
  });
  it.each(['pending', 'over', 'empty', 'invalid'] as const)('拒绝 %s 出售且无副作用', state => {
    const r = roster();
    if (state === 'pending') beginBattle(r, 'win');
    if (state === 'over') r.over = 'defeat';
    const slot = state === 'empty' ? 1 : state === 'invalid' ? -1 : 0;
    const before = cloneRun(r);
    expect(canSell(r, slot)).toBe(false); expect(sell(r, slot)).toBe(false);
    expect(r).toEqual(before);
  });
  it('仅恢复一次招募，保留进度、资源与广告次数，并可真实招募', () => {
    const r = newRun('lilithe', 626);
    Object.assign(r, { node: 4, picks: 0, gold: 17, lives: 2, wins: 2, rerolls: 0,
      stash: { power: 3 }, bag: ['eq_flame'], spells: [spell], activeSpells: [spell],
      rewardedRetryCount: 2, rewardedRerollCount: 1 });
    const before = cloneRun(r);
    expect(recoverEmptyRoster(r)).toBe(true);
    expect(r.picks).toBe(1); expect(r.draft).toHaveLength(3);
    for (const key of Object.keys(before) as (keyof RunState)[]) {
      if (!['picks', 'draft', 'rngState', 'rec'].includes(key)) expect(r[key]).toEqual(before[key]);
    }
    const recovered = cloneRun(r);
    expect(recoverEmptyRoster(r)).toBe(false); expect(r).toEqual(recovered);
    expect(takeDraft(r, 0, 0)).toBe('place');
    expect(r.slots[0]).not.toBeNull(); expect(r.picks).toBe(0);
    expect(recoverEmptyRoster(r)).toBe(false);
  });
  it.each(['owned', 'picks', 'pending', 'over', 'shop', 'fork', 'reward', 'promo'] as const)('不误修 %s 状态', state => {
    const r = newRun('lilithe', 627); r.picks = 0;
    if (state === 'owned') r.bench[0] = roster(5).bench[0];
    if (state === 'picks') r.picks = 1;
    if (state === 'pending') beginBattle(r, 'lose');
    if (state === 'over') r.over = 'defeat';
    if (state === 'shop') r.node = 3;
    if (state === 'fork') r.node = 5;
    if (state === 'reward') r.reward = ['eq_flame'];
    if (state === 'promo') r.promo = ['g_pay'];
    const before = cloneRun(r);
    expect(recoverEmptyRoster(r)).toBe(false); expect(r).toEqual(before);
  });
});

describe('正式战斗的一次性法术消耗', () => {
  it('战前可撤销，构建战斗或复盘计算不改动法术', () => {
    const r = roster(); r.spells = [spell];
    expect(useSpell(r, 0)).toBe(true);
    const before = cloneRun(r);
    expect(buildBattle(r).spells).toEqual([spell]); expect(r).toEqual(before);
    expect(unuseSpell(r, spell)).toBe(true); expect(r.spells).toEqual([spell]);
  });
  it.each(['win', 'lose', 'draw'] as BattleResult[])('首领 %s 结算消耗，结算后不能退款', result => {
    const r = roster(); r.node = 8; r.spells = [spell];
    expect(useSpell(r, 0)).toBe(true);
    beginBattle(r, result);
    expect(unuseSpell(r, spell)).toBe(false);
    expect(finishBattle(r)).toBe(true);
    expect(r.activeSpells).toEqual([]); expect(r.spells).toEqual([]);
    expect(unuseSpell(r, spell)).toBe(false);
    expect(buildBattle(r).spells).toEqual([]);
    expect(finishBattle(r)).toBe(false);
  });
  it.each(['win', 'lose'] as BattleResult[])('终局 %s 同样消耗', result => {
    const r = roster(); r.node = 8; r.chapter = 2; r.lives = 1; r.activeSpells = [spell];
    applyResult(r, result);
    expect(r.over).toBe(result === 'win' ? 'victory' : 'defeat');
    expect(r.activeSpells).toEqual([]); expect(unuseSpell(r, spell)).toBe(false);
  });
  it('无合法战斗或已结束不触碰法术', () => {
    const r = roster(); r.node = 3; r.activeSpells = [spell];
    const before = cloneRun(r); applyResult(r, 'win'); expect(r).toEqual(before);
    r.over = 'defeat'; const over = cloneRun(r); applyResult(r, 'lose'); expect(r).toEqual(over);
  });
  it.each(['win', 'lose', 'draw'] as BattleResult[])('广告重打 %s 使用战前法术快照，正式结算只消耗一次', result => {
    const r = roster(); r.node = 8; r.activeSpells = [spell];
    const checkpoint = cloneRun(r);
    applyResult(r, 'lose'); r.rewardedRetryCount = 1;
    expect(r.activeSpells).toEqual([]);
    expect(buildBattle(checkpoint).spells).toEqual([spell]);
    settleRewardedRetry(r, checkpoint, checkpoint.slots, result);
    expect(r.activeSpells).toEqual([]); expect(r.spells).toEqual([]);
    expect(r.history).toEqual([result === 'win' ? 'win' : 'lose']);
    expect(r.rewardedRetryCount).toBe(1);
    expect(checkpoint.activeSpells).toEqual([spell]);
    expect(unuseSpell(r, spell)).toBe(false);
  });
});
