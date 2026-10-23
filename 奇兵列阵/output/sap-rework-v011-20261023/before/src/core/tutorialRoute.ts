import { EQUIP_MAP } from './content';
import { battleNo, newRun, type RunState } from './run';

export type TutAction =
  | { kind: 'place'; idx: number; slot: number }
  | { kind: 'move'; from: number; to: number }
  | { kind: 'sell'; slot: number }
  | { kind: 'alloc'; to: number | 'general'; type: string }
  | { kind: 'reroll' | 'battle' | 'leave-shop' | 'refund' | 'unequip' | 'shop-refresh' | 'spell' | 'order' }
  | { kind: 'buy'; category: string; index: number }
  | { kind: 'equip'; index: number; slot: number };

export function newTutorialRun(): RunState {
  // 教学用不上场的主将：卡雷奥斯「压轴」吃法强，培养主将一步立刻有收益
  const r = newRun('kaleos', 20261017, { legacyEconomy: true });
  r.tutorialMode = true;
  r.picks = 3;
  return r;
}

/** The final lesson supplies one scroll; the Tutorial instance owns the one-time grant. */
export function giveTutorialActionScroll(r: RunState): boolean {
  if (battleNo(r) !== 3) return false;
  if (!r.spells.includes('sp_haste') && !r.activeSpells.includes('sp_haste')) r.spells.push('sp_haste');
  return true;
}

/** 商店课固定第一件装备为战旗：只换可见货架，不动随机数 */
export function scriptShop(r: RunState) {
  if (battleNo(r) !== 3 || !r.shop || r.shop.equips[0]?.id === 'eq_banner') return;
  r.shop.equips = [{ id: 'eq_banner', price: EQUIP_MAP.eq_banner.price, sold: false }, ...r.shop.equips.filter((e) => e.id !== 'eq_banner')].slice(0, Math.max(2, r.shop.equips.length));
}

/** Keep core draft rolls intact: overriding only the visible choice preserves reward RNG. */
export function scriptDraft(r: RunState): string[] {
  const b = battleNo(r);
  if (r.picks <= 0) return [];
  if (b === 0) return [r.picks >= 2 ? 'n_merc' : 'l_vigil'];
  if (b === 1) return [r.rerolls > 0 ? 's_backstab' : r.picks === 2 ? 'n_bulwark' : 'd_sentry'];
  if (b === 2) return ['v_chaser'];
  return [];
}

/** Every mutation needs both an active lesson and its exact intended destination. */
export function tutorialAllows(step: string, r: RunState, a: TutAction): boolean {
  const places: Record<string, [number, number, string, number]> = {
    'recruit-first': [0, 3, 'n_merc', 0], 'merge-first': [0, 2, 'n_merc', 0],
    'recruit-guard': [0, 1, 'l_vigil', 1], 'recruit-bulwark': [1, 2, 'n_bulwark', 2],
    'recruit-sentry': [1, 1, 'd_sentry', 3], 'recruit-chaser': [2, 2, 'v_chaser', 1],
    'merge-chaser': [2, 1, 'v_chaser', 1],
  };
  const p = places[step];
  if (p) return a.kind === 'place' && battleNo(r) === p[0] && r.picks === p[1]
    && a.idx === 0 && r.draft[0] === p[2] && a.slot === p[3];
  switch (step) {
    case 'train-general': return a.kind === 'alloc' && a.to === 'general' && a.type === 'power' && r.stash.power > 0;
    case 'train-unit': return a.kind === 'alloc' && a.to === 0 && a.type !== 'power' && r.stash[a.type] > 0;
    case 'reroll': return a.kind === 'reroll' && r.rerolls === 1;
    case 'swap-front': return a.kind === 'move' && ((a.from === 0 && a.to === 2) || (a.from === 2 && a.to === 0));
    case 'sell-guard': return a.kind === 'sell' && a.slot === 1 && r.slots[1]?.defId === 'l_vigil';
    case 'fight-first': case 'fight-second': case 'fight-third': return a.kind === 'battle' && r.picks === 0;
    case 'fight-final': return a.kind === 'battle' && battleNo(r) === 3 && r.history.length === 3
      && r.history.every(result => result === 'win') && r.picks === 0 && r.slots[2]?.equips?.includes('eq_banner') === true
      && r.activeSpells.includes('sp_haste');
    case 'shop-buy': return a.kind === 'buy' && a.category === 'equips' && a.index === 0 && r.shop?.equips[0]?.id === 'eq_banner';
    case 'shop-leave': return a.kind === 'leave-shop';
    case 'equip-banner': return a.kind === 'equip' && a.index === 0 && a.slot === 2 && r.bag[0] === 'eq_banner';
    case 'use-haste': return a.kind === 'spell' && battleNo(r) === 3 && r.spells.includes('sp_haste') && !r.activeSpells.includes('sp_haste');
    default: return false;
  }
}

/** Only show the ending once the fourth victory has settled and result controls are ready. */
export function tutorialComplete(r: RunState, mode: string): boolean {
  return mode === 'result' && !r.pending && r.history.length === 4
    && r.history.every(result => result === 'win');
}

