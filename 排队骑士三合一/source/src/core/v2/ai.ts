// v2 模拟 AI：从 prototype/sim.js 移植。用于平衡模拟、回归测试，以后也可以做自动战斗和托管。
//   - arrangeTeam：整备时看着敌阵预告，试遍己方站位全排列，选不用英雄时结果最好的（模拟玩家的布阵决策）
//   - choosePre：整局技，试遍所有选择，推演到底，比不用好才用
//   - playWithHero：贪心英雄，每个窗口试遍所有合法操作（含"不操作"），各自推演到底，选结果最好的
import { advance, createBattle, heroAct, heroOptions, runToEnd, startBattle } from './engine';
import type { BattleState, HeroAction, UnitSpec } from './types';

export const score = (s: BattleState): number => (s.result === 'win' ? 1 : s.result === 'draw' ? 0.5 : 0);
const hpLeft = (s: BattleState, side: 0 | 1): number => s.lines[side].reduce((a, id) => a + s.units[id].hp, 0);
/** 局面价值：胜负为主，剩余血量差为辅 */
export const value = (s: BattleState): number => score(s) * 1000 + hpLeft(s, 0) - hpLeft(s, 1);

/** 不再使用英雄，把当前局面打完（不改动原状态） */
export function rollout(s: BattleState): BattleState {
  const c = structuredClone(s);
  while (!c.result) advance(c);
  return c;
}

/** 从布阵阶段直接打完（不用英雄） */
export function rolloutSetup(s: BattleState): BattleState {
  const c = structuredClone(s);
  startBattle(c);
  while (!c.result) advance(c);
  return c;
}

export const perms = <T>(a: T[]): T[][] =>
  a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));

/** 整备：看着敌阵预告，试遍己方站位的全排列，选不用英雄时结果最好的（不算英雄操作） */
export function arrangeTeam(L: UnitSpec[], R: UnitSpec[], seed: number): UnitSpec[] {
  let best = L, bestV = -Infinity;
  for (const order of perms(L.map((_, i) => i))) {
    const team = order.map((i) => L[i]);
    const v = value(runToEnd(createBattle(team, R, seed)));
    if (v > bestV + 0.5) { bestV = v; best = team; }
  }
  return best;
}

export interface PreResult { type: string; flip: boolean; key: boolean }

/** 整局技：布阵阶段（侦察、预演、再部署）和第 0 轮窗口各调用一次 */
export function choosePre(s: BattleState): PreResult | null {
  const roll = s.phase === 'setup' ? rolloutSetup : rollout;
  const opts = heroOptions(s);
  if (!opts.length) return null;
  const base = roll(s);
  let best: HeroAction | null = null, bestV = value(base);
  for (const o of opts) {
    const c = structuredClone(s);
    if (!heroAct(c, o)) continue;
    const v = value(roll(c));
    if (v > bestV + 0.5) { bestV = v; best = o; }
  }
  if (!best) return null;
  heroAct(s, best);
  const after = roll(s);
  return { type: best.type, flip: score(after) > score(base), key: score(after) > score(base) || value(after) - value(base) >= 5 };
}

export interface HeroPlayResult {
  /** 翻盘：最佳操作的胜负严格好于不操作 */
  turns: number;
  /** 关键操作：翻盘，或推演血量差 ≥ 5 */
  key: number;
  used: Record<string, number>;
  windows: number;
  readyWindows: number;
}

/** 贪心英雄打完一场。pre：使用整局技；preOnly：只用整局技，战中不操作 */
export function playWithHero(s: BattleState, opts: { pre?: boolean; preOnly?: boolean } = {}): HeroPlayResult {
  let turns = 0, key = 0;
  const used: Record<string, number> = {};
  const usePre = () => {
    if (!opts.pre && !opts.preOnly) return;
    const r = choosePre(s);
    if (r) { used[r.type] = (used[r.type] || 0) + 1; if (r.flip) turns++; if (r.key) key++; }
  };
  usePre();
  startBattle(s);
  if (!s.result) usePre();
  let windows = 0, readyWindows = 0;
  while (!s.result) {
    if (s.round > 0 && !opts.preOnly) {
      windows++;
      // 一个窗口里可以连续操作，直到选择"不操作"
      for (let k = 0; k < 3 && !s.result; k++) {
        const cand = heroOptions(s);
        if (!cand.length) break;
        if (k === 0) readyWindows++;
        const base = rollout(s);
        let best: HeroAction | null = null, bestV = value(base);
        for (const o of cand) {
          const c = structuredClone(s);
          heroAct(c, o);
          const v = value(rollout(c));
          if (v > bestV + 0.5) { bestV = v; best = o; }
        }
        if (!best) break;
        const before = score(base);
        heroAct(s, best);
        used[best.type] = (used[best.type] || 0) + 1;
        const after = rollout(s);
        if (score(after) > before) turns++;
        if (score(after) > before || value(after) - value(base) >= 5) key++;
      }
    }
    if (!s.result) advance(s);
  }
  return { turns, key, used, windows, readyWindows };
}
