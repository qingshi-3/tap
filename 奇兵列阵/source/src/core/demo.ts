// 图鉴实机演示的战斗配置：纯数据 + 真实引擎模拟，不碰 DOM（校验脚本也用）。
import { simulate, type BattleSetup } from './engine';
import type { BattleEvent, BattleOutput, EnemyEntry, Slotted, Snap } from './types';

export interface DemoUnit {
  id: string;
  lv?: 1 | 2 | 3;
  eq?: string[];
  /** 自定义数值（木桩等），给了就按 EnemyEntry 摆放 */
  atk?: number;
  hp?: number;
  block?: number;
}
export interface DemoSpec {
  me: DemoUnit[];
  foe: DemoUnit[];
  general?: { id: string; power?: number; passives?: string[] };
  spells?: string[];
  /** 目标效果：第一次出现的事件 */
  hit: (ev: BattleEvent, snap: Snap) => boolean;
  /** 目标出现后再播几次交锋（默认 1） */
  tail?: number;
  seed?: number;
}

const COPIES = { 1: 1, 2: 2, 3: 4 } as const;

const enemyEntry = (u: DemoUnit): EnemyEntry =>
  ({ defId: u.id, level: u.lv ?? 1, ...(u.atk != null ? { atk: u.atk } : {}), ...(u.hp != null ? { hp: u.hp } : {}), ...(u.block ? { block: u.block } : {}) });
const playerEntry = (u: DemoUnit, i: number): Slotted | EnemyEntry =>
  u.atk != null || u.hp != null || u.block != null ? enemyEntry(u)
    : { defId: u.id, ownedId: 9000 + i, copies: COPIES[u.lv ?? 1], ...(u.eq ? { equips: [...u.eq] } : {}) };

export function demoSetup(spec: DemoSpec): BattleSetup {
  const pad = <T,>(a: T[]) => [...a, ...Array<null>(Math.max(0, 5 - a.length)).fill(null)];
  return {
    player: pad(spec.me.map(playerEntry)),
    enemy: pad(spec.foe.map(enemyEntry)),
    general: spec.general ? { id: spec.general.id, power: spec.general.power ?? 0, passives: spec.general.passives ?? [] } : null,
    spells: spec.spells ?? [],
    chapter: 1,
    seed: spec.seed ?? 7,
    record: true,
  };
}

/** 模拟并截取：返回截断后的输出与是否命中目标（校验脚本也用它） */
export function demoOutput(spec: DemoSpec): { out: BattleOutput; hit: boolean } {
  const out = simulate(demoSetup(spec));
  const log = out.log;
  const k = log.findIndex(l => spec.hit(l.ev, l.snap));
  let end = log.length;
  if (k >= 0) {
    let beats = 0;
    for (let i = k + 1; i < log.length; i++) {
      if (log[i].ev.t === 'beat' && ++beats > (spec.tail ?? 1)) { end = i; break; }
    }
  } else {
    let beats = 0;
    for (let i = 0; i < log.length; i++) if (log[i].ev.t === 'beat' && ++beats > 4) { end = i; break; }
  }
  return { out: { ...out, log: log.slice(0, end) }, hit: k >= 0 };
}

