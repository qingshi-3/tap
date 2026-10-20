import { CARD_ACQUISITION } from './campaign-content.js';
import { CARDS } from './cards.js';
import { FACTIONS } from './factions.js';
import { EXPEDITION_LEVELS } from './expedition-data.js';

// These are permanent ownership milestones, independent of the active battle.
export const NEUTRAL_IDS = Object.freeze(CARD_ACQUISITION.filter(c=>c.type==='unit'&&c.faction===0).map(c=>c.id));
export const CAMPAIGN_UNIT_IDS = Object.freeze([...FACTIONS.flatMap(f=>f.unitIds),...NEUTRAL_IDS]);
export const SPELL_IDS = Object.freeze(FACTIONS.flatMap(f=>f.spellIds));
const milestones = new Map(CARD_ACQUISITION.map(c=>[c.id,c.acquisition==='initial'?0:c.acquisition==='campaign'?c.level:null]));
export function getCardAcquisition(id) { return CARD_ACQUISITION.find(c=>c.id===Number(id)) ?? null; }
export function getUnlockRewards(levelId, factionId = null) {
  const count = EXPEDITION_LEVELS.findIndex(level => level.id === levelId) + 1;
  return { units: CAMPAIGN_UNIT_IDS.filter(id => milestones.get(id) === count && count > 0 && (factionId===null || CARDS[id].faction===0 || CARDS[id].faction===Number(factionId))),
    spells: SPELL_IDS.filter(id => milestones.get(id) === count && count > 0 && (factionId===null || CARDS[id].faction===0 || CARDS[id].faction===Number(factionId))) };
}
// Every non-Boss card can also be bought in 军需 (shop.js).
export function getUnlockLabel(id) {
  const count = milestones.get(Number(id));
  return count === 0 ? '初始可用' : count ? `通关「${EXPEDITION_LEVELS[count - 1].title}」获得，或在军需购买` : '可在军需购买';
}
