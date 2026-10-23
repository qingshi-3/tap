import type { BattleRule } from './types';
export type { BattleRule } from './types';

/** Intrinsic boss abilities apply even outside a campaign encounter. */
export const INTRINSIC_BOSS_RULES: readonly BattleRule[] = [
  { id: 'void_pull', label: '虚空牵引', intrinsic: true, side: 1, source: { side: 1, defId: 'e_void' }, trigger: { on: 'beatEnd', every: 3 }, effects: [{ op: 'pullRearToFront', oncePerTarget: true, blockedBy: 'sp_anchor' }] },
  { id: 'frostq_freeze', label: '霜魇凝视', intrinsic: true, side: 1, source: { side: 1, defId: 'e_frostq' }, trigger: { on: 'beatEnd', every: 5 }, maxTriggers: 2, effects: [{ op: 'chillHighestAttack' }] },
  { id: 'nightk_recall', label: '永夜召回', intrinsic: true, side: 1, source: { side: 1, defId: 'e_nightk' }, trigger: { on: 'hpBelow', ratio: 0.5 }, maxTriggers: 1, effects: [{ op: 'recall', hpRatio: 0.5 }, { op: 'block', to: 'source', amount: 3 }] },
];

export const BOSS_ENCOUNTER_RULES: Readonly<Record<string, readonly BattleRule[]>> = {
  e_void: [{ id: 'void_rally', label: '虚空战意', side: 1, source: { side: 1, defId: 'e_void' }, trigger: { on: 'beatEnd', every: 9 }, maxTriggers: 2, effects: [{ op: 'buff', to: 'allies', atk: 1 }] }],
  e_frostq: [{ id: 'frostq_barrier', label: '霜魇屏障', side: 1, source: { side: 1, defId: 'e_frostq' }, trigger: { on: 'beatEnd', every: 9 }, maxTriggers: 1, effects: [{ op: 'block', to: 'allies', amount: 1 }] }],
  e_nightk: [{ id: 'nightk_return', label: '永夜归军', side: 1, source: { side: 1, defId: 'e_nightk' }, trigger: { on: 'afterRecall' }, effects: [{ op: 'buff', to: 'recalled', atk: 2 }] }],
};
