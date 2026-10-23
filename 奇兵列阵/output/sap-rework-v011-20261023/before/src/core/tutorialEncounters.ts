import type { EnemyEntry } from './types';
import type { Stage } from './route';

const E = (defId: string, atk: number, hp: number, extra: Partial<EnemyEntry> = {}): EnemyEntry => ({ defId, atk, hp, ...extra });
const lineup = (...entries: EnemyEntry[]): (EnemyEntry | null)[] => [...entries, ...Array<null>(5 - entries.length).fill(null)];

// 教学依赖这些交锋长度来演示冻结、培养与额外行动；正式远征调参不改变课程。
// 前三课沿用0.8.2遭遇；第四课按0.9佣兵取消战内增攻后的固定课程阵容校准。
// 不使用正式路线的可调系数，且必须保留额外行动的第二行动波。
const STAGES: Record<number, Stage> = {
  0: { type: 'battle', main: { kind: 'normal', name: '石魔', hint: '护甲减少每次受到的伤害（最少 1）；高攻单发、施法和灼烧能破',
    lineup: lineup(E('e_golem', 2, 7, { armor: 1 }), E('e_skel', 2, 4)) } },
  1: { type: 'battle', main: { kind: 'normal', name: '影袭者', hint: '狙击：影袭者的普攻打你的队尾',
    lineup: lineup(E('e_brute', 3, 7), E('e_assassin', 3, 4), E('e_raider', 3, 5)) } },
  2: { type: 'battle', main: { kind: 'normal', name: '焚火者', hint: '灼烧：每次交锋结束受伤，无视格挡和护甲',
    lineup: lineup(E('e_brute', 4, 8), E('e_pyre', 3, 6), E('e_golem', 2, 9), E('e_raider', 3, 5)) } },
  3: { type: 'shop' },
  4: { type: 'battle',
    main: { kind: 'normal', name: '碎岩者', hint: '溅射：碎岩者普攻时，目标身后的单位也受一半伤害',
      lineup: lineup(E('e_crusher', 3, 10), E('e_golem', 2, 10), E('e_brute', 4, 8), E('e_raider', 3, 6)) },
    variant: { kind: 'normal', name: '亡魂骑士', hint: '复生：亡魂骑士第一次阵亡会以 1 生命复活',
      lineup: lineup(E('e_revenant', 3, 9), E('e_shield', 2, 8), E('e_revenant', 3, 7), E('e_assassin', 3, 5)) } },
};

/** 每次返回独立数据，预览或草案修改不能污染下一次教学。 */
export function tutorialStage(chapter: number, node: number): Stage | undefined {
  const stage = chapter === 0 ? STAGES[node] : undefined;
  return stage ? structuredClone(stage) : undefined;
}
