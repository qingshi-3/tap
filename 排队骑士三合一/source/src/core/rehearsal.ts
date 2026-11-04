import { adRetry, AD_RETRY_MAX, type RunState } from './run';

export interface Rehearsal {
  /** 正式战后状态；试打及调整期间保持原样。 */
  readonly settled: RunState;
  /** 原战前状态的独立副本；只允许交换站位，不得合并单位。 */
  readonly working: RunState;
  canRetry(): boolean;
  /** 仅在 UI 已确认奖励广告完成后调用。重复或失效的提交返回 null。 */
  commitRetry(): RunState | null;
}

/** 关闭调整页时直接丢弃对象即可返回原战报，不需要回滚正式状态。 */
export function createRehearsal(settled: RunState, before: RunState, result: 'win' | 'lose' | 'draw'): Rehearsal {
  // 私有快照作为重打的唯一内容来源，外部修改只能提供单位的排列顺序。
  const original = structuredClone(before);
  const working = structuredClone(original);
  let committed = false;
  const canRetry = () => !committed && result === 'lose' && settled.lastLoss > 0 && (settled.adRetry ?? 0) < AD_RETRY_MAX;
  return {
    settled,
    working,
    canRetry,
    commitRetry() {
      if (!canRetry() || working.queue.length !== original.queue.length) return null;
      const retry = structuredClone(original);
      const remaining = new Map(retry.queue.filter(o => o !== null).map(o => [o.oid, o]));
      if (remaining.size !== retry.queue.filter(o => o !== null).length) return null;
      const queue: RunState['queue'] = [];
      for (const unit of working.queue) {
        if (unit === null) {
          queue.push(null);
          continue;
        }
        const saved = unit && remaining.get(unit.oid);
        if (!saved) return null;
        queue.push(saved);
        remaining.delete(saved.oid);
      }
      // 买入、卖出、合并、复制或丢失单位都不是站位调整，不能消耗重打次数。
      if (remaining.size > 0) return null;
      retry.queue = queue;
      if (!adRetry(settled, retry)) return null;
      committed = true;
      return settled;
    },
  };
}
