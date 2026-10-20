import assert from 'node:assert/strict';
import { recommendDeck } from '../dist/js/deck-recommendation.js';
import { FACTIONS } from '../dist/js/factions.js';
import { CARD_ACQUISITION } from '../dist/js/campaign-content.js';
import { getCard } from '../dist/js/cards.js';
import { starterInventory, validatePlayerDeck } from '../dist/js/battle-deck.js';

const full={units:CARD_ACQUISITION.filter(c=>c.type==='unit').map(c=>c.id),spells:CARD_ACQUISITION.filter(c=>c.type==='spell').map(c=>c.id)};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
let cases=0;
for(const inventory of [starterInventory(),full])for(const faction of FACTIONS)for(const heroId of faction.heroIds){
  const input=freeze({selectedHeroId:heroId,inventory:structuredClone(inventory)}),before=JSON.stringify(input);
  const result=recommendDeck(input);assert.equal(result.ok,true);assert(validatePlayerDeck(result.deck,heroId,inventory));
  assert.equal(JSON.stringify(input),before);assert.deepEqual(recommendDeck(input),result);
  const bodies=result.deck.filter(id=>getCard(id).type==='unit');
  assert.equal(bodies.length,30-Math.min(9,faction.spellIds.filter(id=>inventory.spells.includes(id)).length*3),'available spells determine the role fallback');
  assert(bodies.filter(id=>getCard(id).cost<=2).length>=9,'early turns have playable bodies');
  assert(bodies.filter(id=>getCard(id).cost>=5).length<=3,'finishers cannot crowd out the curve');cases++;
}
const heroA=recommendDeck({heroId:301,inventory:full}),heroB=recommendDeck({heroId:323,inventory:full});
assert.notDeepEqual(heroA.deck,heroB.deck,'same-faction heroes receive different engine plans');
assert(heroA.deck.includes(310)&&heroB.deck.includes(316),'summon and corruption engines are represented');
assert.equal(recommendDeck({heroId:1,inventory:{units:[14,9],spells:[]}}).ok,false);
assert.equal(recommendDeck({heroId:999,inventory:full}).ok,false);
const foreign=recommendDeck({heroId:1,inventory:{units:[...full.units,1,999999],spells:full.spells}});
assert(validatePlayerDeck(foreign.deck,1,full),'unknown, general and foreign cards cannot enter the deck');
// Unusual but legal collections relax the role split instead of inventing cards.
const onlyUnits={units:full.units,spells:[]},relaxed=recommendDeck({heroId:1,inventory:onlyUnits});
assert(relaxed.ok&&validatePlayerDeck(relaxed.deck,1,onlyUnits));
console.log(`deck recommendation: ${cases} starter/full hero cases; engines, legality, failure, purity and fallback passed`);
