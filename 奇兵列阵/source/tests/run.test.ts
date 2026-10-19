import { describe, expect, it, vi } from 'vitest';
import { DRAFT_POOL, ROUTE } from '../src/core/data';
import {
  applyResult,
  applyRewardedReroll,
  canRewardedReroll,
  cloneRun,
  consumeRewardedRetry,
  newRun,
  MAX_REWARDED_RETRIES,
  MAX_REWARDED_REROLLS,
  remainingRewardedRetries,
  remainingRewardedRerolls,
  reroll,
  rollDraft,
  settleRewardedRetry,
  type RunState,
} from '../src/core/run';
import type { BattleResult, Slotted } from '../src/core/types';

const replayLineup = (): (Slotted | null)[] => [
  { defId: 'n_merc', ownedId: 21, copies: 2 },
  null,
  { defId: 'l_shield', ownedId: 22, copies: 1 },
  { defId: 'a_seed', ownedId: 23, copies: 4 },
  null,
];

describe('RunState 快照', () => {
  it('newRun 初始化奖励资格，cloneRun 深复制所有可变成员', () => {
    const run = newRun('argeon', 101);
    expect(run.rewardedRetryCount).toBe(0);
    expect(run.rewardedRerollCount).toBe(0);

    run.slots[0] = { defId: 'n_merc', ownedId: 24, copies: 1 };
    run.history.push('win');
    run.rewardedRetryCount = 1;
    run.rewardedRerollCount = 1;
    const snapshot = cloneRun(run);

    expect(snapshot).toEqual(run);
    expect(snapshot.slots).not.toBe(run.slots);
    expect(snapshot.slots[0]).not.toBe(run.slots[0]);
    expect(snapshot.draft).not.toBe(run.draft);
    expect(snapshot.history).not.toBe(run.history);

    snapshot.slots[0]!.copies = 4;
    snapshot.draft[0] = 'a_seed';
    snapshot.history[0] = 'lose';
    snapshot.rewardedRetryCount = 0;
    snapshot.rewardedRerollCount = 0;

    expect(run.slots[0]?.copies).toBe(1);
    expect(run.draft[0]).not.toBe('a_seed');
    expect(run.history).toEqual(['win']);
    expect(run.rewardedRetryCount).toBe(1);
    expect(run.rewardedRerollCount).toBe(1);
  });
});

describe('奖励刷新', () => {
  it('只在免费刷新耗尽后发放，且不消耗 picks/rerolls', () => {
    const run = newRun('argeon', 202);
    const unavailable = cloneRun(run);
    expect(canRewardedReroll(run)).toBe(false);
    expect(applyRewardedReroll(run)).toBe(false);
    expect(run).toEqual(unavailable);

    run.rerolls = 0;
    const expected = cloneRun(run);
    expected.rewardedRerollCount = 1;
    rollDraft(expected);
    const picks = run.picks;

    expect(canRewardedReroll(run)).toBe(true);
    expect(applyRewardedReroll(run)).toBe(true);
    expect(run.draft).toEqual(expected.draft);
    expect(run.rngState).toBe(expected.rngState);
    expect(run.picks).toBe(picks);
    expect(run.rerolls).toBe(0);
    expect(run.rewardedRerollCount).toBe(1);
  });

  it('同一关可成功刷新两次，第三次拒绝且不推进 RNG 或修改候选', () => {
    const run = newRun('argeon', 303);
    run.rerolls = 0;
    expect(applyRewardedReroll(run)).toBe(true);
    expect(run.rewardedRerollCount).toBe(1);
    expect(remainingRewardedRerolls(run)).toBe(1);
    expect(canRewardedReroll(run)).toBe(true);
    expect(applyRewardedReroll(run)).toBe(true);
    expect(run.rewardedRerollCount).toBe(MAX_REWARDED_REROLLS);
    expect(remainingRewardedRerolls(run)).toBe(0);
    const twice = cloneRun(run);
    expect(canRewardedReroll(run)).toBe(false);
    expect(applyRewardedReroll(run)).toBe(false);
    expect(run).toEqual(twice);
    expect(newRun('argeon',303).rewardedRerollCount).toBe(0);
  });

  it('跨关累计且不恢复额度，下一关仍需先用完免费刷新', () => {
    const run = newRun('argeon', 404);
    run.rerolls = 0;
    expect(applyRewardedReroll(run)).toBe(true);
    const rewardedAt = run.stage;

    applyResult(run, 'win');
    expect(run.stage).toBe(rewardedAt + 1);
    expect(run.rewardedRerollCount).toBe(1);
    expect(canRewardedReroll(run)).toBe(false);
    expect(reroll(run)).toBe(true);
    expect(canRewardedReroll(run)).toBe(true);
    expect(applyRewardedReroll(run)).toBe(true);
    expect(run.rewardedRerollCount).toBe(2);
    applyResult(run,'win');
    expect(reroll(run)).toBe(true);
    const exhausted=cloneRun(run);
    expect(applyRewardedReroll(run)).toBe(false);expect(run).toEqual(exhausted);
  });

  it('Boss 失败保留已用次数，原来剩余的一次仍可在正常刷新后使用', () => {
    const run = newRun('argeon', 505);
    run.stage = ROUTE.length - 1;
    run.rerolls = 0;
    expect(applyRewardedReroll(run)).toBe(true);

    applyResult(run, 'lose');
    expect(run.stage).toBe(ROUTE.length - 1);
    expect(reroll(run)).toBe(true);
    expect(run.rewardedRerollCount).toBe(1);
    expect(canRewardedReroll(run)).toBe(true);
    expect(applyRewardedReroll(run)).toBe(true);
    applyResult(run,'lose');expect(reroll(run)).toBe(true);
    const exhausted = cloneRun(run);
    expect(canRewardedReroll(run)).toBe(false);
    expect(applyRewardedReroll(run)).toBe(false);
    expect(run).toEqual(exhausted);
  });

  it.each([
    ['没有招募次数', (run: RunState) => { run.picks = 0; }],
    ['远征已结束', (run: RunState) => { run.over = 'defeat'; }],
    ['整局两次已耗尽', (run: RunState) => { run.rewardedRerollCount = 2; }],
  ] as const)('%s 时不修改牌组或 RNG', (_label, arrange) => {
    const run = newRun('argeon', 606);
    run.rerolls = 0;
    arrange(run);
    const before = cloneRun(run);

    expect(canRewardedReroll(run)).toBe(false);
    expect(applyRewardedReroll(run)).toBe(false);
    expect(run).toEqual(before);
  });
  it('生成候选失败不扣广告额度、不推进 RNG',()=>{
    const run=newRun('argeon',607);run.rerolls=0;const before=cloneRun(run);
    const filter=vi.spyOn(DRAFT_POOL,'filter').mockReturnValueOnce([]);
    try {expect(applyRewardedReroll(run)).toBe(false);expect(run).toEqual(before);}
    finally {filter.mockRestore();}
  });
  it.each(['win','lose','draw'] as const)('旧快照的奖励重打%s不返还广告刷新，复盘克隆也不影响正式额度',result=>{
    const checkpoint=newRun('argeon',608);checkpoint.slots=replayLineup();
    const run=cloneRun(checkpoint);run.rerolls=0;
    expect(applyRewardedReroll(run)).toBe(true);expect(applyRewardedReroll(run)).toBe(true);
    const sandbox=cloneRun(checkpoint);sandbox.slots.reverse();
    expect(run.rewardedRerollCount).toBe(2);
    const saved=cloneRun(run);sandbox.rewardedRerollCount=0;expect(run).toEqual(saved);
    settleRewardedRetry(run,checkpoint,checkpoint.slots,result,checkpoint.bench);
    expect(run.rewardedRerollCount).toBe(2);
    run.rerolls=0;expect(canRewardedReroll(run)).toBe(false);
  });
});

describe('奖励重打资格', () => {
  it('每局最多消费三次，跨关保留次数，新局重置', () => {
    const run = newRun('argeon', 707);
    expect(remainingRewardedRetries(run)).toBe(MAX_REWARDED_RETRIES);
    for (let count = 1; count <= MAX_REWARDED_RETRIES; count++) {
      expect(consumeRewardedRetry(run)).toBe(true);
      expect(run.rewardedRetryCount).toBe(count);
      expect(remainingRewardedRetries(run)).toBe(MAX_REWARDED_RETRIES - count);
      applyResult(run, 'win');
      expect(run.rewardedRetryCount).toBe(count);
    }
    const consumed = cloneRun(run);

    expect(consumeRewardedRetry(run)).toBe(false);
    expect(run).toEqual(consumed);
    expect(remainingRewardedRetries(newRun('argeon', 708))).toBe(MAX_REWARDED_RETRIES);
  });
});

const retryContexts = [
  { label: '普通关', stage: 2, lives: 3 },
  { label: 'Boss', stage: ROUTE.length - 1, lives: 3 },
  { label: '最后一命', stage: 2, lives: 1 },
] as const;

const actualResults: BattleResult[] = ['win', 'lose', 'draw'];

describe.each(retryContexts)('$label奖励重打', ({ stage, lives }) => {
  it.each(actualResults)('实际结果 %s 只从战前 checkpoint 权威结算一次', (actualResult) => {
    const checkpoint = newRun('argeon', 800 + stage + lives);
    checkpoint.stage = stage;
    checkpoint.lives = lives;
    checkpoint.wins = 2;
    checkpoint.history = ['win', 'lose'];
    checkpoint.slots = replayLineup();
    checkpoint.rewardedRerollCount = 1;
    const untouchedCheckpoint = cloneRun(checkpoint);

    const run = cloneRun(checkpoint);
    applyResult(run, 'lose');
    const stateAfterOriginalLoss = cloneRun(run);
    expect(consumeRewardedRetry(run)).toBe(true);
    const historyLength = run.history.length;
    const replaySlots = replayLineup();
    const replayBefore = replaySlots.map((slot) => (slot ? { ...slot } : null));

    const authoritativeResult = actualResult === 'win' ? 'win' : 'lose';
    const expected = cloneRun(checkpoint);
    expected.rewardedRetryCount = 1;
    expected.slots = replayBefore.map((slot) => (slot ? { ...slot } : null));
    applyResult(expected, authoritativeResult);
    const expectedLifeRestored = expected.lives > stateAfterOriginalLoss.lives;

    const identity = run;
    const settlement = settleRewardedRetry(run, checkpoint, replaySlots, actualResult);

    expect(run).toBe(identity);
    expect(settlement).toEqual({
      actualResult,
      authoritativeResult,
      lifeRestored: expectedLifeRestored,
    });
    expect(run).toEqual(expected);
    expect(run.history).toHaveLength(historyLength);
    expect(run.history.at(-1)).toBe(authoritativeResult);
    expect(run.rngState).toBe(expected.rngState);
    expect(run.rewardedRetryCount).toBe(1);
    expect(remainingRewardedRetries(run)).toBe(2);
    expect(checkpoint).toEqual(untouchedCheckpoint);
    expect(replaySlots).toEqual(replayBefore);
    expect(run.slots).not.toBe(replaySlots);

    if (authoritativeResult === 'lose') {
      expect(run.lives).toBe(stateAfterOriginalLoss.lives);
    } else {
      expect(run.lives).toBeGreaterThan(stateAfterOriginalLoss.lives);
    }
  });
});

describe.each(retryContexts)('$label连续奖励重打', ({ stage, lives }) => {
  it('同一原始 checkpoint 失败、平局、胜利仅替换一次结算，累计消耗三次额度', () => {
    const checkpoint = newRun('argeon', 900 + stage + lives);
    checkpoint.stage = stage;
    checkpoint.lives = lives;
    checkpoint.slots = replayLineup();
    checkpoint.history = ['win'];
    checkpoint.wins = 1;
    const untouched = cloneRun(checkpoint);
    const run = cloneRun(checkpoint);
    applyResult(run, 'lose');
    const originalLoss = cloneRun(run);

    const outcomes: BattleResult[] = ['lose', 'draw', 'win'];
    outcomes.forEach((result, index) => {
      expect(consumeRewardedRetry(run)).toBe(true);
      const slots = replayLineup();
      const settlement = settleRewardedRetry(run, checkpoint, slots, result);
      const expected = cloneRun(checkpoint);
      expected.rewardedRetryCount = index + 1;
      expected.slots = slots;
      applyResult(expected, result === 'win' ? 'win' : 'lose');

      expect(run).toEqual(expected);
      expect(run.history).toHaveLength(checkpoint.history.length + 1);
      expect(run.rngState).toBe(expected.rngState);
      expect(run.stage).toBe(expected.stage);
      expect(run.rewardedRetryCount).toBe(index + 1);
      expect(remainingRewardedRetries(run)).toBe(MAX_REWARDED_RETRIES - index - 1);
      expect(run.lives).toBe(result === 'win' ? checkpoint.lives : originalLoss.lives);
      expect(settlement.lifeRestored).toBe(result === 'win');
      expect(checkpoint).toEqual(untouched);
    });

    const exhausted = cloneRun(run);
    expect(consumeRewardedRetry(run)).toBe(false);
    expect(run).toEqual(exhausted);
  });
});
