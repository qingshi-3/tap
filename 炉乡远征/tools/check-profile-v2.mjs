// safe-v2 profile gate: fresh start, v1 import, reload round trip, settlement, shop economy, gift codes.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PlayerProfile, importV1Profile, normalizeProfile } from '../dist/js/profile.js';
import { SAVE_KEYS, V1_KEYS } from '../dist/js/storage-keys.js';
import { shopCatalog, cardPrice } from '../dist/js/shop.js';
import { createCampaignMatch, confirmMulligan, validateMatch } from '../dist/js/engine.js';
import { EXPEDITION_LEVELS } from '../dist/js/expedition-data.js';
import { CAMPAIGN_UNIT_IDS } from '../dist/js/campaign-rules.js';

const memory = (entries = {}) => { const m = new Map(Object.entries(entries)); return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const [first, second] = EXPEDITION_LEVELS;

// Fresh profile: one currency, first level open, nothing written until the player acts.
const fresh = memory(), profile = new PlayerProfile(fresh);
assert.equal(profile.writable, true);
assert.equal(profile.state.coins, 200);
assert.equal(profile.isUnlocked(first.id), true);
assert.equal(profile.isUnlocked(second.id), false);
assert.equal(fresh.m.has(SAVE_KEYS.profile), false);

// Every historical safe-v1 fixture imports; the v1 key is read, never written.
let imported = 0;
for (const file of readdirSync(new URL('./fixtures/', import.meta.url)).filter(f => f.startsWith('save-contract-'))) {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/' + file, import.meta.url), 'utf8'));
  for (const entry of fixture.profiles ?? []) {
    const old = typeof entry === 'string' ? JSON.parse(entry) : entry.state ?? entry;
    if (!old || typeof old !== 'object' || !old.inventory) continue;
    const raw = JSON.stringify(old), storage = memory({ [V1_KEYS.expedition]: raw }), p = new PlayerProfile(storage);
    assert.equal(p.error, '', file);
    assert.equal(p.state.imported?.source, 'safe-v1', file);
    assert.ok(p.state.coins >= (old.coins ?? 0), file);
    for (const id of old.inventory.units ?? []) if (CAMPAIGN_UNIT_IDS.includes(id)) assert.ok(p.state.inventory.units.includes(id), `${file} keeps unit ${id}`);
    assert.equal(storage.getItem(V1_KEYS.expedition), raw, `${file} v1 untouched`);
    assert.deepEqual(new PlayerProfile(storage).state, p.state, `${file} reload`);
    imported++;
  }
}
assert.ok(imported >= 3, `imported ${imported} fixtures`);

// Compensation: orbs, fragments and training spend all become gold.
const compensated = importV1Profile({ coins: 500, recruitment: { tickets: 3, fragments: { a: 4 } }, training: { 11: 2 }, spellTraining: { 20043: 1 }, inventory: { units: [], spells: [] } });
assert.equal(compensated.coins, 500 + 3 * 20 + 4 * 5 + (40 + 70) + 60);

// A corrupt v2 record is preserved and the profile refuses to write.
const corrupt = memory({ [SAVE_KEYS.profile]: '{"version":99}' }), locked = new PlayerProfile(corrupt);
assert.equal(locked.writable, false);
assert.equal(locked.buyCard(shopCatalog(locked.state.inventory)[0].id).ok, false);
assert.equal(corrupt.getItem(SAVE_KEYS.profile), '{"version":99}');

// Content shrink: unknown levels are dropped rather than rejecting the save.
const shrunk = profile.state; shrunk.completed = [first.id, 'removed-level'];
assert.deepEqual(normalizeProfile(shrunk).completed, [first.id]);

// Settlement: first clear pays once, unlocks the next level, duplicate settles are idempotent.
const loadout = profile.getBattleLoadout(), match = createCampaignMatch(first.id, loadout.heroId, loadout.deck);
confirmMulligan(match);
assert.equal(profile.saveBattle(match).ok, true);
assert.equal(profile.settle(match).ok, false, 'unfinished battle cannot settle');
match.phase = 'over'; match.winner = 0; match.result = 'win';
assert.equal(validateMatch(match), true);
const before = profile.state.coins, won = profile.settle(match);
assert.equal(won.ok, true); assert.equal(won.firstClear, true);
assert.equal(profile.state.coins, before + first.reward.first);
assert.equal(profile.state.activeBattle, null);
assert.equal(profile.isUnlocked(second.id), true);
const again = profile.settle(match);
assert.equal(again.duplicate, true); assert.equal(profile.state.coins, before + first.reward.first);
assert.equal(profile.rewardPreview(first.id).coins, first.reward.repeat);
assert.equal(profile.saveBattle(match).ok, false, 'settled run cannot be reactivated');

// Shop: price by rarity, owned cards and short funds are rejected, catalog hides owned cards.
const offer = shopCatalog(profile.state.inventory)[0];
assert.equal(offer.price, cardPrice(offer.id));
const coins = profile.state.coins, bought = profile.buyCard(offer.id);
assert.equal(bought.ok, true); assert.equal(profile.state.coins, coins - offer.price);
assert.ok(profile.state.inventory[offer.kind].includes(offer.id));
assert.equal(profile.buyCard(offer.id).ok, false);
assert.ok(!shopCatalog(profile.state.inventory).some(item => item.id === offer.id));
const expensive = shopCatalog(profile.state.inventory).at(-1);
while (profile.state.coins >= expensive.price) { const cheap = shopCatalog(profile.state.inventory).find(item => item.id !== expensive.id); if (!cheap || !profile.buyCard(cheap.id).ok) break; }
if (profile.state.coins < expensive.price) assert.equal(profile.buyCard(expensive.id).ok, false);

// Gift codes pay gold once; the whole profile survives a reload.
const gift = profile.redeemGiftCode('LX2026');
assert.equal(gift.ok, true);
assert.equal(profile.redeemGiftCode('lx2026').ok, false);
assert.deepEqual(new PlayerProfile(fresh).state, profile.state);
console.log(`Profile v2 checks passed: fresh start, ${imported} v1 imports, compensation, corrupt-save guard, settlement, shop, gift code, reload.`);
