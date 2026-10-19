import { LOCAL_DECKS_KEY } from './storage-keys.js';
import { guardedWrite } from './storage-contract.js';
import { CARD_ACQUISITION } from './campaign-content.js';
import { getCard } from './cards.js';
import { getFaction } from './factions.js';
import { PLAYER_DECK_SIZE, MAX_CARD_COPIES } from './battle-deck.js';

const neutrals = new Set(CARD_ACQUISITION.filter(card => card.type === 'unit' && card.faction === 0).map(card => card.id));
export const localDeckKey = factionId => `${LOCAL_DECKS_KEY}.${factionId}`;
const message = error => error?.message || String(error);

// Partial editing snapshots have their own contract. A combat/profile deck
// still has to pass validatePlayerDeck's unchanged exact-30-card contract.
export function validateLocalDeck(deck, factionId, inventory) {
  const faction = getFaction(factionId);
  if (!Number.isInteger(factionId) || !faction || faction.id !== factionId) return '未知阵营。';
  if (!Array.isArray(deck) || deck.length > PLAYER_DECK_SIZE) return '牌组最多30张。';
  const counts = new Map();
  for (const id of deck) {
    const card = Number.isInteger(id) ? getCard(id) : null;
    if (!card) return '牌组包含未知卡牌。';
    const compatible = card.type === 'unit' ? faction.unitIds.includes(id) || neutrals.has(id) : card.type === 'spell' && faction.spellIds.includes(id);
    if (!compatible) return '牌组包含其他阵营或不可出战的卡牌。';
    if (!inventory?.[card.type === 'unit' ? 'units' : 'spells']?.includes(id)) return '牌组包含尚未拥有的卡牌。';
    counts.set(id,(counts.get(id) || 0) + 1);
    if (counts.get(id) > MAX_CARD_COPIES) return '同名卡牌最多3张。';
  }
  return '';
}

export class LocalDecks {
  constructor(storage) {
    this.entries = new Map(); this.storageError = '';
    try { this.storage = arguments.length ? storage : globalThis.localStorage; }
    catch (error) { this.storageError = `读取本地牌组失败：${message(error)}`; }
  }
  get(factionId, fallback, inventory) {
    if (!this.entries.has(factionId)) {
      const entry = { deck:[...fallback], raw:null, blocked:'', error:'' };
      try {
        if (this.storageError) throw new Error(this.storageError);
        if (!this.storage?.getItem) throw new Error('本机存储不可用。');
        entry.raw = this.storage.getItem(localDeckKey(factionId));
        if (entry.raw !== null) {
          let record;
          try { record = JSON.parse(entry.raw); } catch { throw new Error('本地牌组格式损坏，原件已保留。'); }
          if (!record || record.schemaVersion !== 1 || record.factionId !== factionId || Object.keys(record).sort().join(',') !== 'deck,factionId,schemaVersion') throw new Error('本地牌组格式不受支持，原件已保留。');
          const error = validateLocalDeck(record.deck,factionId,inventory);
          if (error) throw new Error(`${error} 本地牌组原件已保留。`);
          entry.deck = [...record.deck];
        }
      } catch (error) { entry.blocked = entry.error = message(error); }
      this.entries.set(factionId,entry);
    }
    return [...this.entries.get(factionId).deck];
  }
  error(factionId) { return this.entries.get(factionId)?.error || ''; }
  set(factionId, deck, inventory) {
    const error = validateLocalDeck(deck,factionId,inventory);
    if (error) return {ok:false,error};
    const entry = this.entries.get(factionId);
    if (!entry) return {ok:false,error:'本地牌组尚未加载。'};
    entry.deck = [...deck];
    entry.error = entry.blocked;
    return {ok:true};
  }
  save(factionId, inventory) {
    const entry = this.entries.get(factionId);
    if (!entry) return {ok:false,error:'本地牌组尚未加载。'};
    if (entry.blocked) return {ok:false,error:entry.blocked};
    const invalid = validateLocalDeck(entry.deck,factionId,inventory);
    if (invalid) return {ok:false,error:invalid};
    try {
      const raw = JSON.stringify({schemaVersion:1,factionId,deck:entry.deck});
      // Always check expected bytes, including unchanged edits. Another tab
      // must never be silently replaced by a stale return/navigation action.
      entry.raw = guardedWrite(this.storage,localDeckKey(factionId),entry.raw,raw);
      entry.error = '';
      return {ok:true};
    } catch (error) {
      entry.error = `保存本地牌组失败：${message(error)}`;
      return {ok:false,error:entry.error};
    }
  }
}
