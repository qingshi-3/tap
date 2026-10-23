import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRAFT_POOL, UNIT_MAP } from '../src/core/data';
import { applyResult, battleNo, buy, cloneRun, freezeDraft, freezeUpgradeOffer, leaveShop, moveSlot, newRun, reroll, rollDraft, takeDraft, takeUpgradeOffer, tierCap, type RunState } from '../src/core/run';
import { loadRun, SAVE_KEY, saveRun } from '../src/core/save';
import type { Slotted } from '../src/core/types';

afterEach(() => vi.unstubAllGlobals());
const unit = (r: RunState, defId = 'n_merc', copies: Slotted['copies'] = 1): Slotted => ({ defId, ownedId: r.nextOwnedId++, copies });
function pair(r: RunState, defId = 'n_merc') {
  r.slots[0] = unit(r, defId); r.bench[0] = unit(r, defId);
  expect(moveSlot(r, 5, 0)).toBe('merge');
  return r.upgradeOffers?.at(-1);
}
function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
  return values;
}
function loaded() { const result = loadRun(); if (result.kind !== 'ok') throw Error(result.kind); return result.run; }

describe('0.12 one-star-pair upgrade choice shelves', () => {
  it('paid direct merges award one distinct higher-shop-tier pair without changing ordinary shelf positions', () => {
    const r = newRun('reva', 12001); r.draft[0] = r.draft[1] = 'n_merc';
    expect(takeDraft(r, 0, 0)).toBe('place'); expect(r.upgradeOffers).toBeUndefined();
    const before = [...r.draft];
    expect(takeDraft(r, 1, 0)).toBe('merge'); expect(r.gold).toBe(4); expect(r.slots[0]?.copies).toBe(2);
    expect(r.draft).toEqual(before.map((id, i) => i === 1 ? '' : id));
    expect(r.upgradeOffers).toHaveLength(1);
    const g = r.upgradeOffers![0]; expect(g).toMatchObject({ id: 1, tier: 2, battle: 0, locked: false });
    expect(new Set(g.choices).size).toBe(2);
    expect(g.choices.every(id => DRAFT_POOL.some(d => d.id === id && d.tier === 2))).toBe(true);
    expect(r.nextUpgradeOfferId).toBe(2);
  });
  it('uses persisted RNG deterministically and always bases tier on the shop cap, including six-tier ceiling', () => {
    for (const [chapter, node] of [[0, 0], [0, 4], [1, 4], [2, 0], [2, 8]]) {
      const a = newRun('reva', 12002); a.chapter = chapter; a.node = node;
      const b = cloneRun(a), before = [...a.draft];
      const ga = pair(a, 's_master')!, gb = pair(b, 's_master')!;
      expect(ga).toEqual(gb); expect(a.rngState).toBe(b.rngState);
      expect(ga.tier).toBe(Math.min(6, tierCap(battleNo(a)) + 1)); expect(a.draft).toEqual(before);
    }
    // A restricted historical faction set still has a valid two-choice ordinary pool.
    for (let tier = 2; tier <= 6; tier++) expect(DRAFT_POOL.filter(d => d.faction === 'neutral' && d.tier === tier).length).toBeGreaterThanOrEqual(2);
  });
  it('never rewards two-star pairs, retroactively rewards old two-stars, or enables legacy/tutorial rewards', () => {
    const r = newRun('reva', 12003); r.slots[0] = unit(r, 'n_merc', 2); r.bench[0] = unit(r, 'n_merc', 2);
    const rng = r.rngState; expect(moveSlot(r, 5, 0)).toBe('merge'); expect(r.slots[0]?.copies).toBe(4);
    expect(r.upgradeOffers).toBeUndefined(); expect(r.rngState).toBe(rng);
    for (const mode of ['legacy', 'tutorial']) {
      const old = newRun('reva', 12003, { legacyEconomy: mode === 'legacy' });
      if (mode === 'tutorial') old.tutorialMode = true;
      pair(old); expect(old.upgradeOffers).toBeUndefined(); expect(old.nextUpgradeOfferId).toBeUndefined();
    }
  });
  it('buying one offer removes its whole group and a resulting merge creates a fresh group at shop cap plus one', () => {
    const r = newRun('reva', 12004), g = pair(r)!;
    r.slots[1] = unit(r, g.choices[0]); const draft = [...r.draft], gold = r.gold;
    expect(takeUpgradeOffer(r, g.id, 0, 1)).toBe('merge');
    expect(r.gold).toBe(gold - 3); expect(r.slots[1]?.copies).toBe(2); expect(r.draft).toEqual(draft);
    expect(r.upgradeOffers).toHaveLength(1); expect(r.upgradeOffers![0]).toMatchObject({ id: 2, tier: 2 });
    expect(r.nextUpgradeOfferId).toBe(3);
    const before = cloneRun(r); expect(takeUpgradeOffer(r, g.id, 1, 2)).toBe('invalid'); expect(r).toEqual(before);
  });
  it('invalid IDs, choice indices, destination, insufficient gold and confirmation do not consume or reroll', () => {
    const r = newRun('reva', 12005), g = pair(r)!;
    for (const [id, choice, slot] of [[999, 0, 1], [g.id, -1, 1], [g.id, 2, 1], [g.id, 0.5, 1], [g.id, 0, 99]]) {
      const before = cloneRun(r); expect(takeUpgradeOffer(r, id, choice, slot)).toBe('invalid'); expect(r).toEqual(before);
    }
    r.gold = 2; let before = cloneRun(r); expect(takeUpgradeOffer(r, g.id, 0, 1)).toBe('invalid'); expect(r).toEqual(before);
    r.gold = 10; r.slots = Array.from({ length: 5 }, () => unit(r)); r.bench = Array.from({ length: 3 }, () => unit(r));
    before = cloneRun(r); expect(takeUpgradeOffer(r, g.id, 0, 0)).toBe('confirm'); expect(r).toEqual(before);
  });
  it('confirmed replacement uses normal sell refunds and preserves permanent-growth nonrefund semantics', () => {
    const r = newRun('reva', 12006), g = pair(r)!;
    r.slots = Array.from({ length: 5 }, () => unit(r)); r.bench = Array.from({ length: 3 }, () => unit(r));
    r.slots[0]!.train = { atk: 2 }; r.slots[0]!.growth = { atk: 8 };
    r.slots[0]!.equips = ['eq_bow']; const gold = r.gold;
    expect(takeUpgradeOffer(r, g.id, 0, 0, true)).toBe('replace');
    expect(r.slots[0]?.defId).toBe(g.choices[0]); expect(r.gold).toBe(gold - 3 + 1);
    expect(r.stash.atk).toBe(2); expect(r.bag).toContain('eq_bow'); expect(r.upgradeOffers).toEqual([]);
  });
  it('offer purchases retain buy-before-upgrade event ordering', () => {
    const r = newRun('reva', 12007), g = pair(r)!, id = g.choices[0];
    const original = UNIT_MAP[id].prep;
    UNIT_MAP[id].prep = [{ event: 'buy', scope: 'self', target: 'self', atk: [2, 20, 200] }, { event: 'upgrade', scope: 'self', target: 'self', hp: [3, 30, 300] }];
    try {
      r.slots[1] = unit(r, id);
      expect(takeUpgradeOffer(r, g.id, 0, 1)).toBe('merge');
      expect(r.slots[1]?.growth).toMatchObject({ atk: 2, hp: 30 });
    } finally { UNIT_MAP[id].prep = original; }
  });
  it('successful refresh deletes only unfrozen groups; failed refresh leaves groups, money and RNG intact', () => {
    const r = newRun('reva', 12008), locked = pair(r)!, loose = pair(r)!;
    expect(freezeUpgradeOffer(r, locked.id)).toBe(true);
    const frozenDraft = r.draft[2]; expect(freezeDraft(r, 2)).toBe(true);
    expect(reroll(r)).toBe(true); expect(r.upgradeOffers).toEqual([locked]); expect(r.draft[2]).toBe(frozenDraft);
    expect(r.upgradeOffers?.some(g => g.id === loose.id)).toBe(false);
    pair(r); r.gold = 0; const before = cloneRun(r); expect(reroll(r)).toBe(false); expect(r).toEqual(before);
    expect(freezeUpgradeOffer(r, locked.id)).toBe(true); expect(locked.locked).toBe(false);
  });
  it('node transitions expire older unfrozen groups, retain frozen groups and carry shop merges into adjacent preparation', () => {
    const r = newRun('reva', 12009), locked = pair(r)!; freezeUpgradeOffer(r, locked.id); pair(r);
    applyResult(r, 'win'); expect(r.upgradeOffers).toEqual([locked]);
    r.node = 2; applyResult(r, 'win'); expect(r.shop).not.toBeNull();
    const item = r.shop!.units[0];
    r.slots = Array.from({ length: 5 }, () => unit(r)); r.bench = Array.from({ length: 3 }, () => unit(r));
    r.slots[0] = unit(r, item.id);
    expect(buy(r, 'units', 0)).toBe(true); const shopGroup = r.upgradeOffers!.at(-1)!;
    expect(shopGroup.battle).toBe(battleNo(r)); const before = cloneRun(r);
    expect(takeUpgradeOffer(r, shopGroup.id, 0, 1)).toBe('invalid'); expect(r).toEqual(before);
    expect(leaveShop(r)).toBe(true); expect(r.upgradeOffers?.find(g => g.id === shopGroup.id)).toEqual(shopGroup);
    r.bench[0] = null; expect(takeUpgradeOffer(r, shopGroup.id, 0, 1)).toBe('reserve');
    expect(r.upgradeOffers?.find(g => g.id === locked.id)).toEqual(locked);
  });
  it('special-shop merging issues a reward without bypassing the two-unit purchase limit', () => {
    const r = newRun('reva', 12010); r.node = 2; applyResult(r, 'win'); r.gold = 30;
    r.slots = Array.from({ length: 5 }, () => unit(r)); r.bench = Array.from({ length: 3 }, () => unit(r));
    r.slots[0] = unit(r, r.shop!.units[0].id); expect(buy(r, 'units', 0)).toBe(true);
    expect(r.upgradeOffers).toHaveLength(1); r.bench[0] = null; expect(buy(r, 'units', 1)).toBe(true);
    const before = cloneRun(r); expect(buy(r, 'units', 2)).toBe(false); expect(r).toEqual(before);
    expect(takeUpgradeOffer(r, r.upgradeOffers![0].id, 0, 2)).toBe('invalid'); expect(r).toEqual(before);
  });
  it('boss loss starts fresh preparation and clears only unlocked upgrade groups at the same battle index', () => {
    const r = newRun('reva', 12014); r.node = 8;
    const locked = pair(r)!; freezeUpgradeOffer(r, locked.id); const loose = pair(r)!;
    const index = battleNo(r), beforeLives = r.lives, nextId = r.nextUpgradeOfferId;
    r.gold = 0;
    applyResult(r, 'lose');
    expect(battleNo(r)).toBe(index); expect(r.node).toBe(8); expect(r.chapter).toBe(0);
    expect(r.lives).toBe(beforeLives - 1); expect(r.gold).toBe(10);
    expect(r.draft.filter(Boolean)).toHaveLength(5);
    expect(r.upgradeOffers).toEqual([locked]); expect(r.nextUpgradeOfferId).toBe(nextId);
    const before = cloneRun(r);
    expect(takeUpgradeOffer(r, loose.id, 0, 1)).toBe('invalid'); expect(r).toEqual(before);
    expect(takeUpgradeOffer(r, locked.id, 0, 1)).toBe('place');
  });
  it('failed durable save after an offer purchase leaves the old shelf reloadable without minting or losing rewards', () => {
    const values = storage(), r = newRun('reva', 12015), group = pair(r)!;
    freezeUpgradeOffer(r, group.id); expect(saveRun(r)).toBe(true);
    const raw = values.get(SAVE_KEY)!, savedRng = r.rngState, savedGold = r.gold;
    expect(takeUpgradeOffer(r, group.id, 0, 1)).toBe('place');
    const afterPurchase = cloneRun(r);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, value: string) => { if (k === SAVE_KEY) throw new Error('quota'); values.set(k, value); },
      removeItem: (k: string) => values.delete(k),
    });
    expect(saveRun(r)).toBe(false); expect(values.get(SAVE_KEY)).toBe(raw);
    expect(r).toEqual(afterPurchase);
    const restored = loaded();
    expect(restored.upgradeOffers).toEqual([group]); expect(restored.gold).toBe(savedGold);
    expect(restored.rngState).toBe(savedRng); expect(restored.slots[1]).toBeNull();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, value: string) => values.set(k, value),
      removeItem: (k: string) => values.delete(k),
    });
    expect(takeUpgradeOffer(restored, group.id, 0, 1)).toBe('place'); expect(saveRun(restored)).toBe(true);
    const reloaded = loaded(); expect(reloaded.upgradeOffers).toEqual([]);
    expect(reloaded.gold).toBe(savedGold - 3); expect(reloaded.slots[1]?.defId).toBe(group.choices[0]);
    const before = cloneRun(reloaded);
    expect(takeUpgradeOffer(reloaded, group.id, 1, 2)).toBe('invalid'); expect(reloaded).toEqual(before);
  });
  it('locked groups and monotonic IDs survive repeated save/load, continued purchases, merging and saving', () => {
    storage(); const r = newRun('reva', 12011), g = pair(r)!; freezeUpgradeOffer(r, g.id);
    const rng = r.rngState; expect(saveRun(r)).toBe(true); const next = loaded();
    expect(next.upgradeOffers).toEqual(r.upgradeOffers); expect(next.rngState).toBe(rng);
    next.slots[1] = unit(next, g.choices[0]); expect(takeUpgradeOffer(next, g.id, 0, 1)).toBe('merge');
    expect(next.upgradeOffers![0].id).toBe(2); expect(saveRun(next)).toBe(true);
    const again = loaded(); expect(again.upgradeOffers).toEqual(next.upgradeOffers); expect(again.nextUpgradeOfferId).toBe(3);
    expect(takeUpgradeOffer(again, 2, 1, 2)).not.toBe('invalid'); expect(saveRun(again)).toBe(true);
    expect(loaded().upgradeOffers).toEqual([]);
  });
  it('old saves without offer fields load with no retroactive rewards for an existing two-star', () => {
    const values = storage(), r = newRun('reva', 12012); r.slots[0] = unit(r, 'n_merc', 2);
    values.set(SAVE_KEY, JSON.stringify(r)); const next = loaded();
    expect(next.upgradeOffers).toBeUndefined(); expect(next.nextUpgradeOfferId).toBeUndefined(); expect(next.slots[0]?.copies).toBe(2);
    expect(saveRun(next)).toBe(true); expect(loaded().upgradeOffers).toBeUndefined();
  });
  it.each(['missing counter', 'duplicate id', 'counter behind', 'duplicate choice', 'unknown card', 'wrong tier', 'future battle', 'negative battle', 'nonboolean lock', 'unknown field', 'malformed groups'])('rejects %s without replacing raw saves', defect => {
    const values = storage(), r = newRun('reva', 12013); pair(r);
    const rawState = JSON.parse(JSON.stringify(r)); const g = rawState.upgradeOffers[0];
    if (defect === 'missing counter') delete rawState.nextUpgradeOfferId;
    if (defect === 'duplicate id') rawState.upgradeOffers.push({ ...g });
    if (defect === 'counter behind') rawState.nextUpgradeOfferId = g.id;
    if (defect === 'duplicate choice') g.choices[1] = g.choices[0];
    if (defect === 'unknown card') g.choices[0] = 'nonexistent';
    if (defect === 'wrong tier') g.tier = 3;
    if (defect === 'future battle') g.battle = 99;
    if (defect === 'negative battle') g.battle = -1;
    if (defect === 'nonboolean lock') g.locked = 1;
    if (defect === 'unknown field') g.futureReward = true;
    if (defect === 'malformed groups') rawState.upgradeOffers = {};
    const raw = JSON.stringify(rawState); values.set(SAVE_KEY, raw);
    expect(loadRun().kind).toBe('incompatible'); expect(values.get(SAVE_KEY)).toBe(raw);
    // A stale valid tab must not overwrite an incompatible shelf with the same run identity.
    expect(saveRun(r)).toBe(false); expect(values.get(SAVE_KEY)).toBe(raw);
  });
});
