import { newRun, type RunState, type ShopItem } from './run';

/** 教程只准备货架和对手；购买、升星、战斗、结算仍走正式规则。 */
export const TUTORIAL_STEPS = ['buy', 'merge', 'star', 'lock', 'reroll', 'battle1', 'ally', 'food', 'position', 'equip', 'battle2', 'done'] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];
export const TUTORIAL_UNIT = 'rw_charge_sling';
export const TUTORIAL_ALLY = 'rw_charge_bunker';
export const TUTORIAL_EQUIP = 'w_mail';
const prepared = new WeakMap<RunState, Set<TutorialStep>>();

function stock(r: RunState, kind: ShopItem['kind'], def: string): ShopItem {
  return { sid: r.nextId++, kind, def, locked: false, free: false };
}

function enemy(r: RunState, second: boolean) {
  // 第一战学习普通交锋；第二战让盾手先承伤，投石手在后排真实蓄能。
  const specs = second
    ? [{ def:'e_skel', atk:4, hp:8 }, { def:'e_guardian', atk:2, hp:10 }]
    : [{ def:'e_skel', atk:2, hp:4 }];
  r.enemy = { boss:null, units:specs.map(u => ({ ...u, lvl:1 as const })) };
  r.event = null;
}

/** 独立的临时局，不读写存档，不改变普通开局。 */
export function newTutorialRun(): RunState {
  const r = newRun(20261028, { solo: true });
  r.activeArchetypes = ['supply','charge','formation','hunt','rune','blood'];
  // 独立教学不插入首战遗物选择；正式 newRun 仍按正常流程发奖。
  r.firstRelicGiven = true;
  // 教程两回合都给满 10 金，第二回合演示二阶货架。
  r.gold = 10;
  r.shop = [stock(r, 'unit', TUTORIAL_UNIT), stock(r, 'unit', TUTORIAL_UNIT), stock(r, 'unit', TUTORIAL_UNIT), stock(r, 'food', 'f_bread')];
  enemy(r, false);
  return r;
}

/** 每步入口调用；同一临时局重复渲染不会补货或重复赠装。 */
export function prepareTutorialStep(r: RunState, step: TutorialStep): void {
  let seen = prepared.get(r);
  if (!seen) { seen = new Set(); prepared.set(r, seen); }
  if (seen.has(step)) return;
  seen.add(step);
  if (step === 'ally') {
    // 保留第一回合锁住的面包，让锁定跨回合的结果可见。
    const bread = r.shop.find((s) => s.def === 'f_bread' && s.locked);
    r.gold = 10;
    r.tavern = 2;
    r.shop = [stock(r, 'unit', TUTORIAL_ALLY), stock(r, 'unit', TUTORIAL_UNIT), stock(r, 'unit', TUTORIAL_ALLY), bread ?? stock(r, 'food', 'f_bread')];
    enemy(r, true);
  }
  if (step === 'equip' && !r.bag.includes(TUTORIAL_EQUIP) && !r.queue.some((o) => o?.ench === TUTORIAL_EQUIP)) r.bag.push(TUTORIAL_EQUIP);
  if (step === 'battle1') enemy(r, false);
  if (step === 'battle2') enemy(r, true);
}

/** UI 在成功执行正式操作后查询；战斗在正式结算后完成。 */
export function tutorialStepDone(r: RunState, step: TutorialStep): boolean {
  switch (step) {
    case 'buy': return r.queue[0]?.def === TUTORIAL_UNIT && r.queue[0].copies >= 1;
    case 'merge': return r.queue[0]?.def === TUTORIAL_UNIT && r.queue[0].copies >= 2;
    case 'star': return r.queue[0]?.def === TUTORIAL_UNIT && r.queue[0].copies >= 3;
    case 'lock': return r.shop.some((s) => s.def === 'f_bread' && s.locked);
    case 'reroll': return r.rerolls >= 1 && r.shop.some((s) => s.def === 'f_bread' && s.locked);
    case 'battle1': return r.history.length >= 1;
    case 'ally': return r.queue[1]?.def === TUTORIAL_ALLY;
    case 'food': return r.tc.foods >= 1 && (r.queue[0]?.atkBonus ?? 0) >= 1 && (r.queue[0]?.hpBonus ?? 0) >= 1;
    case 'position': return r.queue[0]?.def === TUTORIAL_ALLY && r.queue[1]?.def === TUTORIAL_UNIT;
    case 'equip': return r.queue[0]?.def === TUTORIAL_ALLY && r.queue[0].ench === TUTORIAL_EQUIP;
    case 'battle2': case 'done': return r.history.length >= 2;
  }
}

/** 两个高亮单位交换站位，两种拖动方向等价。 */
export function tutorialPositionAllowed(from?: number, to?: number): boolean {
  return (from === 0 && to === 1) || (from === 1 && to === 0);
}
