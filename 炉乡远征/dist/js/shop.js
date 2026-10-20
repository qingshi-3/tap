import { getCardRarity } from './card-rarity.js';
import { CAMPAIGN_UNIT_IDS, SPELL_IDS } from './campaign-rules.js';

// 军需：金币是唯一货币。Boss 专属卡只能击败 Boss 获得，不进商店。
export const SHOP_PRICES = Object.freeze({ basic: 60, common: 100, rare: 200, epic: 400, legendary: 800 });
export const BOSS_CARD_IDS = Object.freeze([]);
const kindOf = id => CAMPAIGN_UNIT_IDS.includes(id) ? 'units' : SPELL_IDS.includes(id) ? 'spells' : null;
export function cardPrice(id) {
  id = Number(id);
  if (!kindOf(id) || BOSS_CARD_IDS.includes(id)) return null;
  return SHOP_PRICES[getCardRarity(id)?.key] ?? SHOP_PRICES.common;
}
export function shopCatalog(inventory) {
  return [...CAMPAIGN_UNIT_IDS, ...SPELL_IDS]
    .filter(id => cardPrice(id) !== null && !inventory[kindOf(id)].includes(id))
    .map(id => ({ id, kind: kindOf(id), price: cardPrice(id), rarity: getCardRarity(id)?.key ?? 'common' }))
    .sort((a, b) => a.price - b.price || a.id - b.id);
}
export function shopKind(id) { return kindOf(Number(id)); }
