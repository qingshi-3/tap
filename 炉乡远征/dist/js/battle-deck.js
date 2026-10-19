import {CARD_ACQUISITION} from './campaign-content.js';
import {getCard} from './cards.js';
import {getHero, getFaction, FACTIONS} from './factions.js';

export const PLAYER_DECK_SIZE = 30;
export const MAX_CARD_COPIES = 3;
// Existing, implemented portion of the approved starter roster. Additional
// authored content can expand this pool without changing the deck contract.
export const STARTER_FACTION_UNITS = Object.freeze({1:[9,11,14,15],2:[108,109,110,115],3:[211,213,214,216],4:[308,311,316,317],5:[402,406,410,412],6:[503,505,506,511]});
export const STARTER_NEUTRAL_UNITS = Object.freeze([10021,10981,10019,19027,10001,10018,19026,10204]);
const NEUTRAL_UNITS = CARD_ACQUISITION.filter(c=>c.type==='unit'&&c.faction===0).map(c=>c.id);
export function starterInventory() {
  return {units:[...Object.values(STARTER_FACTION_UNITS).flat(),...STARTER_NEUTRAL_UNITS],
    spells:FACTIONS.flatMap(f=>f.id===1?f.spellIds.slice(0,3):f.spellIds.slice(0,2))};
}
export function validatePlayerDeck(deck, heroId, inventory=null) {
  const faction=getFaction(getHero(heroId)?.faction);
  if(!faction||!Array.isArray(deck)||deck.length!==PLAYER_DECK_SIZE)return false;
  const counts=new Map();
  return deck.every(id=>{
    const card=getCard(id);if(!Number.isInteger(id)||!card)return false;
    const valid=card.type==='unit'?(faction.unitIds.includes(id)||NEUTRAL_UNITS.includes(id)):card.type==='spell'&&faction.spellIds.includes(id);
    if(!valid||inventory&&!inventory[card.type==='unit'?'units':'spells']?.includes(id))return false;
    counts.set(id,(counts.get(id)??0)+1);return counts.get(id)<=MAX_CARD_COPIES;
  });
}
export function makeStarterDeck(heroId, inventory=starterInventory()) {
  const faction=getFaction(getHero(heroId)?.faction);
  if(!faction)throw new Error('未知主将。');
  const ids=[...STARTER_FACTION_UNITS[faction.id],...STARTER_NEUTRAL_UNITS.slice(0,4),...faction.spellIds.slice(0,2)];
  const deck=[...STARTER_FACTION_UNITS[faction.id].flatMap(id=>[id,id,id]),...STARTER_NEUTRAL_UNITS.filter(id=>![10001,10018].includes(id)).flatMap(id=>[id,id]),...faction.spellIds.slice(0,2).flatMap(id=>[id,id,id])];
  if(!validatePlayerDeck(deck,heroId,inventory))throw new Error('初始牌组需要的卡牌尚未拥有。');
  return deck;
}
