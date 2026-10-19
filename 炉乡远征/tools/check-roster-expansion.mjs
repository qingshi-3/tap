import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARDS } from '../dist/js/cards.js';
import { FACTIONS } from '../dist/js/factions.js';
import { EFFECT_MANIFEST } from '../dist/js/effect-manifest.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audit = JSON.parse(fs.readFileSync(path.join(root, '.unit-fx-audit.json'), 'utf8'));
const sourceRoot = audit.sourceRoot;
const lookup = fs.readFileSync(path.join(sourceRoot, 'app/sdk/cards/cardsLookup.coffee'), 'utf8');
const included = new Set();

for (const faction of FACTIONS) {
  assert.equal(faction.unitIds.length, 6, `Faction ${faction.id} must offer six trainable units`);
  assert.equal(new Set(faction.unitIds).size, 6, 'Roster must not contain duplicate units');
  assert.equal(faction.defaultSquad.length, 3);
  for (const id of faction.defaultSquad) assert.ok(faction.unitIds.includes(id), 'Default squad must belong to its roster');
  assert.ok(faction.defaultSquad.slice(0, 2).reduce((cost, id) => cost + CARDS[id].cost, 0) <= 4, 'Default opening must be playable with four mana');
  assert.ok(faction.unitIds.some((id) => CARDS[id].cost <= 2), 'Roster needs cheap deployment');
  assert.ok(faction.unitIds.some((id) => CARDS[id].cost >= 4), 'Roster needs a larger reinforcement');
  for (const id of faction.unitIds) {
    const card = CARDS[id], original = audit.cards[id];
    assert.ok(card && original, `Missing card/source audit ${id}`);
    assert.equal(card.type, 'unit');
    assert.equal(card.faction, faction.id, 'No cross-faction units');
    assert.ok(!card.token, 'Trainable roster must not contain tokens');
    assert.ok(!included.has(id), 'A unit cannot belong to multiple faction rosters');
    included.add(id);
    assert.deepEqual({ cost: card.cost, attack: card.attack, health: card.health }, original.sourceStats, `Original stats differ for ${id}`);
    assert.match(lookup, new RegExp(`\\b${original.name}:\\s*${id}\\b`), `Original ID differs for ${id}`);
    assert.ok(fs.existsSync(path.join(sourceRoot, original.factoryLines)), 'Source factory must exist');
    const body = EFFECT_MANIFEST.bodies[id];
    assert.ok(body, `Missing animation for ${id}`);
    const sheet = path.join(root, 'dist/assets/units', `${body.sheet}.png`);
    const plist = path.join(root, 'dist/assets/units', `${body.plist}.plist`);
    assert.ok(fs.existsSync(sheet) && fs.existsSync(plist), `Missing atlas for ${id}`);
    const frames = fs.readFileSync(plist, 'utf8');
    for (const state of ['idle', 'run', 'attack', 'hit', 'death']) {
      assert.ok(body.states[state]?.prefix, `Missing ${state} animation for ${id}`);
      assert.ok(frames.includes(body.states[state].prefix), `No frames for ${id}.${state}`);
    }
    assert.ok(EFFECT_MANIFEST.cardRecipes[id]?.length, `Missing FX mapping for ${id}`);
    if (original.factoryFxRegistered) assert.ok(EFFECT_MANIFEST.cardRecipes[id].includes(original.factoryFx), `Missing original card FX for ${id}`);
    if (original.h5FxFallback) assert.ok(EFFECT_MANIFEST.cardRecipes[id].includes(original.h5FxFallback), `Missing documented FX fallback for ${id}`);
    for (const key of EFFECT_MANIFEST.cardRecipes[id]) assert.ok(EFFECT_MANIFEST.recipes[key], `Missing FX recipe ${key}`);
  }
}
assert.equal(included.size, 36);
console.log('Roster verified: six factions, 36 trainable units; original IDs/stats, legal openings, animation atlases and card FX present.');
