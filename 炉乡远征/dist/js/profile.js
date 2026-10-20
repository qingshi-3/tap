// safe-v2 player profile: one record, one currency (gold), account-wide campaign progress.
// The safe-v1 expedition save is imported once, read-only; its keys are never written.
import { findGiftCode, validateGiftCodeClaims } from './gift-codes.js';
import { initialDailyAds, beijingDay, validateDailyAds, dailyAdStatus, dailyRewardRange, rollDailyReward } from './daily-ad-rewards.js';
import { starterInventory, makeStarterDeck, validatePlayerDeck } from './battle-deck.js';
import { SAVE_KEYS, V1_KEYS } from './storage-keys.js';
import { ensureStorage, guardedWrite } from './storage-contract.js';
import { validateMatch } from './engine.js';
import { EXPEDITION_LEVELS } from './expedition-data.js';
import { CAMPAIGN_UNIT_IDS, SPELL_IDS, getUnlockRewards } from './campaign-rules.js';
import { FACTIONS, getFaction, getHero } from './factions.js';
import { cardPrice, shopKind } from './shop.js';

const STORAGE_KEY = SAVE_KEYS.profile;
const VERSION = 1;
const STARTING_COINS = 200;
const KEEP_SETTLEMENTS = 30;
// safe-v1 compensation rates.
const V1_ORB_GOLD = 20, V1_FRAGMENT_GOLD = 5;
const V1_UNIT_TRAINING_COSTS = [40, 70, 110, 160], V1_SPELL_TRAINING_COSTS = [60, 100];
const STATE_KEYS = ['version','coins','inventory','selectedHeroId','decks','completed','activeBattle','settlements','dailyAds','giftCodeClaims','imported'];

const LEVEL_IDS = () => EXPEDITION_LEVELS.map(level => level.id);
const levelById = id => EXPEDITION_LEVELS.find(level => level.id === id) ?? null;
const FACTION_IDS = FACTIONS.map(({ id }) => id);
const copy = value => JSON.parse(JSON.stringify(value));
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => plain(value) && Object.keys(value).sort().join('|') === [...keys].map(String).sort().join('|');
const count = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
const message = cause => cause?.message ?? String(cause ?? 'unknown error');
const uniqueIds = (list, allowed) => Array.isArray(list) && new Set(list).size === list.length && list.every(id => allowed.includes(id));
const factionOf = heroId => getFaction(getHero(heroId)?.faction);

function defaultDecks(inventory) { return Object.fromEntries(FACTIONS.map(f => [f.id, makeStarterDeck(f.heroIds[0], inventory)])); }
export function initialProfile() {
  const inventory = starterInventory();
  return { version: VERSION, coins: STARTING_COINS, inventory, selectedHeroId: FACTIONS[0].heroIds[0], decks: defaultDecks(inventory), completed: [],
    activeBattle: null, settlements: {}, dailyAds: initialDailyAds(), giftCodeClaims: {}, imported: null };
}

function validInventory(inv) { return exactKeys(inv, ['units','spells']) && uniqueIds(inv.units, CAMPAIGN_UNIT_IDS) && uniqueIds(inv.spells, SPELL_IDS); }
function validDeckFor(factionId, deck, inventory) { const f = getFaction(factionId); return !!f && f.heroIds.some(id => validatePlayerDeck(deck, id, inventory)); }
function validImported(value) { return value === null || exactKeys(value, ['source','coins','units','spells']) && value.source === 'safe-v1' && count(value.coins) && count(value.units) && count(value.spells); }
export function validProfile(v) {
  if (!exactKeys(v, STATE_KEYS) || v.version !== VERSION || !count(v.coins) || !validInventory(v.inventory) || !getHero(v.selectedHeroId)) return false;
  if (!exactKeys(v.decks, FACTION_IDS) || !FACTION_IDS.every(id => validDeckFor(id, v.decks[id], v.inventory))) return false;
  if (!uniqueIds(v.completed, LEVEL_IDS())) return false;
  if (v.activeBattle !== null && (!validateMatch(v.activeBattle) || v.activeBattle.mode !== 'expedition' || Object.hasOwn(v.settlements, v.activeBattle.runId))) return false;
  if (!plain(v.settlements) || Object.values(v.settlements).some(s => !exactKeys(s, ['levelId','amount','firstClear']) || !levelById(s.levelId) || !count(s.amount) || typeof s.firstClear !== 'boolean')) return false;
  return validateDailyAds(v.dailyAds) && validateGiftCodeClaims(v.giftCodeClaims) && validImported(v.imported);
}
// Content may shrink between releases: drop unknown levels/cards instead of rejecting the profile.
export function normalizeProfile(value) {
  if (!plain(value) || value.version !== VERSION) return null;
  const v = copy(value);
  if (plain(v.inventory)) for (const [kind, ids] of [['units', CAMPAIGN_UNIT_IDS], ['spells', SPELL_IDS]]) if (Array.isArray(v.inventory[kind])) v.inventory[kind] = [...new Set(v.inventory[kind].filter(id => ids.includes(id)))];
  if (Array.isArray(v.completed)) v.completed = [...new Set(v.completed.filter(id => levelById(id)))];
  if (plain(v.settlements)) for (const [run, s] of Object.entries(v.settlements)) if (!levelById(s?.levelId)) delete v.settlements[run];
  if (v.activeBattle && (!validateMatch(v.activeBattle) || !levelById(v.activeBattle.levelId))) v.activeBattle = null;
  if (plain(v.decks) && validInventory(v.inventory)) for (const f of FACTIONS) if (!validDeckFor(f.id, v.decks[f.id], v.inventory)) v.decks[f.id] = makeStarterDeck(f.heroIds[0], v.inventory);
  return validProfile(v) ? v : null;
}

// One-time compensation: owned cards, gold, orbs/fragments and training spend become gold.
export function importV1Profile(old) {
  if (!plain(old)) return null;
  const profile = initialProfile();
  const sum = (costs, rank) => costs.slice(0, Math.max(0, Math.min(costs.length, Number(rank) || 0))).reduce((a, b) => a + b, 0);
  const orbs = count(old.recruitment?.tickets) ? old.recruitment.tickets : 0;
  const fragments = plain(old.recruitment?.fragments) ? Object.values(old.recruitment.fragments).filter(n => count(n)).reduce((a, b) => a + b, 0) : 0;
  const training = (plain(old.training) ? Object.values(old.training).reduce((a, r) => a + sum(V1_UNIT_TRAINING_COSTS, r), 0) : 0)
    + (plain(old.spellTraining) ? Object.values(old.spellTraining).reduce((a, r) => a + sum(V1_SPELL_TRAINING_COSTS, r), 0) : 0);
  const coins = (count(old.coins) ? old.coins : 0) + orbs * V1_ORB_GOLD + fragments * V1_FRAGMENT_GOLD + training;
  const units = Array.isArray(old.inventory?.units) ? old.inventory.units.filter(id => CAMPAIGN_UNIT_IDS.includes(id)) : [];
  const spells = Array.isArray(old.inventory?.spells) ? old.inventory.spells.filter(id => SPELL_IDS.includes(id)) : [];
  profile.inventory.units = [...new Set([...profile.inventory.units, ...units])];
  profile.inventory.spells = [...new Set([...profile.inventory.spells, ...spells])];
  profile.coins = Math.max(profile.coins, coins);
  if (getHero(old.selectedHeroId)) profile.selectedHeroId = old.selectedHeroId;
  for (const f of FACTIONS) profile.decks[f.id] = validDeckFor(f.id, old.factionDecks?.[f.id], profile.inventory) ? [...old.factionDecks[f.id]] : makeStarterDeck(f.heroIds[0], profile.inventory);
  if (Array.isArray(old.completed)) profile.completed = [...new Set(old.completed.filter(id => levelById(id)))];
  if (plain(old.giftCodeClaims)) for (const [id, r] of Object.entries(old.giftCodeClaims)) {
    const gift = findGiftCode(r?.code);
    if (gift?.id === id) profile.giftCodeClaims[id] = { code: gift.code, coins: (count(r.coins) ? r.coins : 0) + (count(r.orbs) ? r.orbs * V1_ORB_GOLD : 0) };
  }
  profile.imported = { source: 'safe-v1', coins: profile.coins, units: units.length, spells: spells.length };
  return validProfile(profile) ? profile : null;
}

function buildReward(state, levelId) {
  const level = levelById(levelId);
  if (!level) return null;
  const firstClear = !state.completed.includes(levelId), cards = firstClear ? getUnlockRewards(levelId) : { units: [], spells: [] };
  return { levelId, firstClear, coins: firstClear ? level.reward.first : level.reward.repeat,
    units: cards.units.filter(id => !state.inventory.units.includes(id)), spells: cards.spells.filter(id => !state.inventory.spells.includes(id)) };
}

export class PlayerProfile {
  #storage; #raw = null; #state = initialProfile(); #error = ''; #writable = true; #listeners = new Set(); #rng; #now;
  constructor(storage, { rng = Math.random, now = Date.now } = {}) {
    this.#rng = rng; this.#now = now;
    try { this.#storage = arguments.length ? storage : globalThis.localStorage; ensureStorage(this.#storage); }
    catch (cause) { this.#reject(`读取存档失败：${message(cause)}`); return; }
    this.#load();
  }
  get state() { return copy(this.#state); }
  get error() { return this.#error; }
  get writable() { return this.#writable; }
  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.#listeners.add(listener); return () => this.#listeners.delete(listener);
  }
  replaceState(value) {
    if (!this.#writable) return { ok: false, error: this.#error };
    const candidate = normalizeProfile(value);
    if (!candidate) return { ok: false, error: '拒绝导入无效的存档。' };
    if (JSON.stringify(candidate) === JSON.stringify(this.#state)) return { ok: true, changed: false };
    return this.#change(candidate, { changed: true });
  }

  selectHero(heroId) {
    const hero = getHero(heroId);
    if (!hero || !getFaction(hero.faction)) return { ok: false, error: '未知主将。' };
    const candidate = copy(this.#state); candidate.selectedHeroId = hero.id;
    return this.#change(candidate, { heroId: hero.id, factionId: hero.faction });
  }
  setBattleDeck(deck) {
    if (!validatePlayerDeck(deck, this.#state.selectedHeroId, this.#state.inventory)) return { ok: false, error: '牌组必须包含30张已拥有的本阵营或中立卡牌，每种至多3张。' };
    const candidate = copy(this.#state); candidate.decks[factionOf(candidate.selectedHeroId).id] = [...deck];
    return this.#change(candidate, { deck: [...deck] });
  }
  getBattleLoadout() { return { heroId: this.#state.selectedHeroId, deck: [...this.#state.decks[factionOf(this.#state.selectedHeroId).id]] }; }

  // Campaign progress is account-wide; the factionId argument is kept for callers that show per-hero views.
  getFactionProgress(factionId = factionOf(this.#state.selectedHeroId).id) {
    return { factionId, completed: copy(this.#state.completed), unlocked: LEVEL_IDS().filter(id => this.isUnlocked(id)) };
  }
  isUnlocked(levelId) {
    const ids = LEVEL_IDS(), index = ids.indexOf(levelId);
    return index === 0 || index > 0 && (this.#state.completed.includes(levelId) || this.#state.completed.includes(ids[index - 1]));
  }
  rewardPreview(levelId) { const r = buildReward(this.#state, levelId); return r && copy(r); }

  saveBattle(match) {
    if (!validateMatch(match) || match.mode !== 'expedition' || !levelById(match.levelId)) { this.#error = '战斗快照无效。'; return { ok: false, error: this.#error }; }
    if (!this.isUnlocked(match.levelId)) return { ok: false, error: '该关卡尚未解锁。' };
    if (Object.hasOwn(this.#state.settlements, match.runId)) return { ok: false, error: '该次战斗已经结算，不能重新激活。' };
    const candidate = copy(this.#state); candidate.activeBattle = copy(match);
    return this.#change(candidate, { reward: buildReward(candidate, match.levelId) });
  }
  settle(match) {
    if (!validateMatch(match) || match.mode !== 'expedition' || match.phase !== 'over' || match.winner !== 0 || !levelById(match.levelId)) return { ok: false, error: '只有已获胜的战斗可以结算。' };
    const prior = this.#state.settlements[match.runId];
    if (prior) {
      if (this.#state.activeBattle?.runId === match.runId) { const candidate = copy(this.#state); candidate.activeBattle = null; if (!this.#commit(candidate)) return { ok: false, error: this.#error }; }
      return { ok: true, duplicate: true, amount: prior.amount, firstClear: prior.firstClear, coins: this.#state.coins, unlocked: { units: [], spells: [] } };
    }
    if (!this.isUnlocked(match.levelId)) return { ok: false, error: '该关卡尚未解锁。' };
    const reward = buildReward(this.#state, match.levelId), candidate = copy(this.#state);
    candidate.coins += reward.coins;
    if (reward.firstClear) candidate.completed.push(match.levelId);
    candidate.inventory.units.push(...reward.units); candidate.inventory.spells.push(...reward.spells);
    candidate.settlements[match.runId] = { levelId: match.levelId, amount: reward.coins, firstClear: reward.firstClear };
    const runs = Object.keys(candidate.settlements);
    for (const run of runs.slice(0, Math.max(0, runs.length - KEEP_SETTLEMENTS))) delete candidate.settlements[run];
    candidate.activeBattle = null;
    return this.#change(candidate, { duplicate: false, amount: reward.coins, firstClear: reward.firstClear, coins: candidate.coins, unlocked: { units: reward.units, spells: reward.spells }, reward });
  }
  clearBattle() {
    if (this.#state.activeBattle === null) return { ok: true, changed: false };
    if (this.#state.activeBattle.phase !== 'over') return { ok: false, error: '进行中的战斗不能清除。' };
    const candidate = copy(this.#state); candidate.activeBattle = null;
    return this.#change(candidate, { changed: true });
  }
  abandonBattle() {
    if (this.#state.activeBattle === null) return { ok: true, changed: false };
    const candidate = copy(this.#state); candidate.activeBattle = null;
    return this.#change(candidate, { changed: true });
  }

  shopOffer(cardId) {
    const kind = shopKind(cardId), price = cardPrice(cardId);
    if (!kind || price === null) return { eligible: false, reason: '该卡不在军需中出售。' };
    if (this.#state.inventory[kind].includes(cardId)) return { eligible: false, owned: true, price, reason: '已拥有。' };
    return { eligible: this.#state.coins >= price, price, reason: this.#state.coins >= price ? '' : '金币不足。' };
  }
  buyCard(cardId) {
    if (!this.#writable) return { ok: false, error: this.#error };
    const offer = this.shopOffer(cardId);
    if (!offer.eligible) return { ok: false, error: offer.reason };
    const candidate = copy(this.#state); candidate.coins -= offer.price; candidate.inventory[shopKind(cardId)].push(cardId);
    return this.#change(candidate, { cardId, price: offer.price, coins: candidate.coins });
  }

  dailyAdOffer(kind) {
    const range = dailyRewardRange(kind);
    if (!range) return { eligible: false, available: false, reason: '未知广告奖励。' };
    try { const status = dailyAdStatus(this.#state.dailyAds[kind], beijingDay(this.#now())); return { ...range, ...status, claimed: !status.available, eligible: this.#writable && status.available, reason: !this.#writable ? this.#error : status.reason }; }
    catch (error) { return { ...range, day: null, eligible: false, available: false, reason: error.message }; }
  }
  beginDailyAd(kind, requestId) {
    if (typeof requestId !== 'string' || !requestId) return { ok: false, error: '广告请求编号无效。' };
    const quota = this.#state.dailyAds[kind];
    if (!quota) return { ok: false, error: '未知广告奖励。' };
    if (quota.pending?.requestId === requestId) return { ok: true, day: quota.pending.day, duplicate: true };
    const offer = this.dailyAdOffer(kind);
    if (!offer.eligible) return { ok: false, error: offer.reason };
    if (quota.lastClaim?.requestId === requestId) return { ok: false, error: '广告请求已领取，请使用新的请求编号。' };
    const candidate = copy(this.#state);
    try {
      const roll = quota.roll?.day === offer.day ? copy(quota.roll) : { day: offer.day, amount: rollDailyReward(kind, this.#rng) };
      candidate.dailyAds[kind].roll = roll; candidate.dailyAds[kind].pending = { ...roll, requestId };
    } catch (error) { return { ok: false, error: error.message }; }
    return this.#change(candidate, { day: offer.day, duplicate: false });
  }
  completeDailyAd(kind, requestId) {
    const quota = this.#state.dailyAds[kind];
    if (!quota) return { ok: false, error: '未知广告奖励。' };
    if (quota.lastClaim?.requestId === requestId) return { ok: true, amount: quota.lastClaim.amount, day: quota.lastClaim.day, duplicate: true };
    const pending = quota.pending;
    if (!pending || pending.requestId !== requestId) return { ok: false, error: '广告奖励请求已失效，请重新观看。' };
    if (quota.claimedDay !== null && pending.day <= quota.claimedDay) return { ok: false, error: '该日期奖励已领取，没有重复发放。' };
    const candidate = copy(this.#state); candidate.coins += pending.amount;
    candidate.dailyAds[kind] = { ...candidate.dailyAds[kind], claimedDay: pending.day, lastClaim: copy(pending), pending: null };
    return this.#change(candidate, { amount: pending.amount, day: pending.day, duplicate: false });
  }
  cancelDailyAd(kind, requestId) {
    const pending = this.#state.dailyAds[kind]?.pending;
    if (!pending || pending.requestId !== requestId) return { ok: true, changed: false };
    const candidate = copy(this.#state); candidate.dailyAds[kind].pending = null;
    return this.#change(candidate, { changed: true });
  }
  redeemGiftCode(input) {
    const gift = findGiftCode(input);
    if (!gift) return { ok: false, error: '兑换码无效。' };
    if (Object.hasOwn(this.#state.giftCodeClaims, gift.id)) return { ok: false, error: '该兑换码已领取。' };
    const candidate = copy(this.#state); candidate.coins += gift.coins;
    candidate.giftCodeClaims[gift.id] = { code: gift.code, coins: gift.coins };
    return this.#change(candidate, { duplicate: false, coins: gift.coins, code: gift.code });
  }

  #load() {
    let raw;
    try { raw = this.#storage.getItem(STORAGE_KEY); } catch (cause) { this.#reject(`读取存档失败：${message(cause)}`); return; }
    this.#raw = raw;
    if (raw === null) { this.#importV1(); return; }
    let record; try { record = JSON.parse(raw); } catch { this.#reject('存档格式不支持，原件已保留。'); return; }
    const state = normalizeProfile(record);
    if (!state) { this.#reject('存档格式不支持，原件已保留。'); return; }
    this.#state = state;
  }
  #importV1() {
    let old = null;
    try { const raw = this.#storage.getItem(V1_KEYS.expedition); old = raw === null ? null : JSON.parse(raw); } catch { old = null; }
    const imported = old && importV1Profile(old);
    if (imported) this.#commit(imported);
  }
  #commit(candidate) {
    if (!this.#writable) return false;
    if (!validProfile(candidate)) { this.#error = '拒绝写入无效的存档。'; return false; }
    try { this.#raw = guardedWrite(this.#storage, STORAGE_KEY, this.#raw, JSON.stringify(candidate)); }
    catch (cause) { this.#error = `写入存档失败，未保存：${message(cause)}`; return false; }
    const changed = JSON.stringify(candidate) !== JSON.stringify(this.#state);
    this.#state = candidate; this.#error = ''; if (changed) this.#notify(); return true;
  }
  #change(candidate, result) {
    if (!this.#writable) return { ok: false, error: this.#error };
    if (!this.#commit(candidate)) return { ok: false, error: this.#error };
    return { ok: true, ...result };
  }
  #reject(error) { this.#writable = false; this.#error = error; }
  #notify() { for (const listener of this.#listeners) { try { listener(this.state); } catch {} } }
}
