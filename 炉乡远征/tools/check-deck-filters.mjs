import assert from 'node:assert/strict';
import { toggleDeckCost, matchesDeckInventory } from '../dist/js/deck-filters.js';

const cards = [{ owned:true, cost:2 }, { owned:false, cost:2 }, { owned:true, cost:8 }, { owned:true, cost:10 }];
const visible = options => cards.filter(card => matchesDeckInventory(card, options));
assert.equal(visible().length, 3, 'The default library excludes unowned cards');
assert.equal(visible({ showUnowned:true }).length, 4);
assert.equal(visible({ selectedCost:2 }).length, 1, 'Ownership and cost intersect');
assert.equal(visible({ showUnowned:true, selectedCost:2 }).length, 2);
assert.deepEqual(visible({ selectedCost:8 }).map(card => card.cost), [8,10], 'The final bucket includes high costs');
assert.equal(visible({ selectedCost:0 }).length, 0);
let selection = toggleDeckCost(null, 2);
selection = toggleDeckCost(selection, 5);
assert.equal(selection, 5, 'A second cost replaces the first');
assert.equal(toggleDeckCost(selection, 5), null, 'Tapping the active cost clears it');
assert.equal(matchesDeckInventory({ owned:true, cost:0 }, { selectedCost:0 }), true);
console.log('Deck inventory ownership, exclusive cost selection and 8+ bucket passed.');
