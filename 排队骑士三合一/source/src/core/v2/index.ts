// v2 战斗模块入口（排队战斗系统核心设计文档 v1.1 + CONTENT-DESIGN.md）。
// 与旧引擎 core/engine.ts 并存，用 useEngineV2() 切换；逐层替换完成后再移除旧引擎。
export * from './types';
export {
  CFG, API, HEROES, HERO_SKILLS, BRANCHES,
  createBattle, startBattle, advance, runToEnd, heroOptions, heroAct, snapshot, triggerOf,
  line, front, idx, cap, freeSlots, isFull,
} from './engine';
export type { Branch } from './engine';
export { CARDS, POOL, ENEMY_POOL, FACTION_NAME } from './cards';
export { STAGES, ENCOUNTERS, ENC_SCALE, makeTeam, makeEncounter, mulberry } from './teams';
export type { Stage, StageKey, EncScale, Rng } from './teams';
export { arrangeTeam, choosePre, playWithHero, rollout, value, score } from './ai';

/**
 * 引擎开关：地址栏带 `?engine=v2`，或 localStorage `engine` 为 `v2` 时使用新引擎。
 * 第 1 步（引擎移植）只提供开关；第 2 步改造战斗界面时接入。
 */
export function useEngineV2(): boolean {
  const g = globalThis as { location?: { search: string }; localStorage?: { getItem(k: string): string | null } };
  try {
    if (g.location && new URLSearchParams(g.location.search).get('engine') === 'v2') return true;
    return g.localStorage?.getItem('engine') === 'v2';
  } catch {
    return false;
  }
}
