import { normalizeExpeditionState } from './expedition-progress.js';
import { validateMatch } from './engine.js';
import { LEVELS } from './levels.js';

import { SAVE_NAMESPACE, SAVE_KEYS, LEGACY_KEYS, CLOUD_META_KEY } from './storage-keys.js';
export * from './storage-keys.js';
const MARKER = `${SAVE_NAMESPACE}.namespace`, JOURNAL = `${SAVE_NAMESPACE}.migration-journal`;
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join('|') === [...keys].sort().join('|');
export function validMatchRecord(record) {
  return exact(record, ['game','schemaVersion','slotId','runId','revision','savedAt','playtimeSeconds','snapshot'])
    && record.game === 'duelyst-h5' && record.schemaVersion === 1 && record.slotId === 'duelyst-main'
    && validateMatch(record.snapshot) && record.runId === record.snapshot.runId && record.revision === record.snapshot.revision
    && Number.isSafeInteger(record.revision) && record.revision >= 0 && Number.isFinite(record.savedAt) && record.savedAt >= 0
    && Number.isSafeInteger(record.playtimeSeconds) && record.playtimeSeconds >= 0;
}
export function validCampaignRecord(record) {
  const known = new Set(LEVELS.map(v => v.id));
  const ids = a => Array.isArray(a) && new Set(a).size === a.length && a.every(id => known.has(id));
  return exact(record, ['game','schemaVersion','completedLevelIds','attemptedLevelIds','lastLevelId','updatedAt'])
    && record.game === 'duelyst-h5' && record.schemaVersion === 1 && ids(record.completedLevelIds) && ids(record.attemptedLevelIds)
    && (record.lastLevelId === null || known.has(record.lastLevelId)) && Number.isFinite(record.updatedAt) && record.updatedAt >= 0;
}
export function validateSlot(name, raw) {
  if (raw === null) return true;
  const value = JSON.parse(raw);
  return name === 'expedition' ? !!normalizeExpeditionState(value) : name === 'campaign' ? validCampaignRecord(value) : validMatchRecord(value);
}
// One permanent namespace isolates current writes from already released clients.
// The journal contains exact source bytes; a failed migration never alters legacy keys.
export function ensureSaveNamespace(storage) {
  if (!storage?.getItem || !storage?.setItem || !storage?.removeItem) throw new Error('storage is unavailable');
  const metaRaw = storage.getItem(CLOUD_META_KEY);
  if (metaRaw !== null) {
    const meta = JSON.parse(metaRaw);
    const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
    if (!exact(meta,['schemaVersion','token','fingerprint','baseData','syncedAt']) || meta.schemaVersion !== 1
      || !(meta.token === null || typeof meta.token === 'string') || !Number.isFinite(meta.syncedAt) || meta.syncedAt < 0
      || !exact(meta.baseData,Object.keys(SAVE_KEYS)) || ![JSON.stringify(meta.baseData),JSON.stringify(canonical(meta.baseData))].includes(meta.fingerprint)
      || Object.entries(meta.baseData).some(([name,value])=>!validateSlot(name,value === null ? null : JSON.stringify(value)))) throw new Error('云同步元数据版本不支持，原件已保留。');
  }
  const marker = storage.getItem(MARKER), pending = storage.getItem(JOURNAL);
  if (marker !== null) {
    if (marker !== '{"version":1}') throw new Error('新存档命名空间版本不支持，原件已保留。');
    for (const [name,key] of Object.entries(SAVE_KEYS)) if (!validateSlot(name,storage.getItem(key))) throw new Error('新存档格式不支持，原件已保留。');
    if (pending !== null) {
      const journal = JSON.parse(pending);
      if (!exact(journal, ['version','entries']) || journal.version !== 1 || !exact(journal.entries,Object.keys(SAVE_KEYS))) throw new Error('迁移日志不支持，原件已保留。');
      for (const [name,raw] of Object.entries(journal.entries)) if (!(raw === null || typeof raw === 'string') || !validateSlot(name,raw) || storage.getItem(SAVE_KEYS[name]) !== raw) throw new Error('已提交迁移日志发生冲突，原件已保留。');
      storage.removeItem(JOURNAL);
    }
    return;
  }
  if (pending !== null) {
    const journal = JSON.parse(pending);
    if (!exact(journal, ['version','entries']) || journal.version !== 1 || !exact(journal.entries, Object.keys(SAVE_KEYS))) throw new Error('迁移日志不支持，原件已保留。');
    for (const name of Object.keys(SAVE_KEYS)) {
      const raw = journal.entries[name], current = storage.getItem(SAVE_KEYS[name]);
      if (!(raw === null || typeof raw === 'string') || !validateSlot(name, raw) || (current !== null && current !== raw)) throw new Error('迁移记录发生冲突，原件已保留。');
    }
    for (const [name,key] of Object.entries(SAVE_KEYS)) if (journal.entries[name] !== null) storage.setItem(key,journal.entries[name]);
    for (const [name,key] of Object.entries(LEGACY_KEYS)) if (storage.getItem(key) !== journal.entries[name]) throw new Error('旧存档在迁入期间变化，迁入已暂停，原件已保留。');
    storage.setItem(MARKER, '{"version":1}'); storage.removeItem(JOURNAL); return;
  }
  // Existing new slots are authoritative even without a marker; never fall back.
  if (Object.values(SAVE_KEYS).some(key => storage.getItem(key) !== null)) {
    for (const [name,key] of Object.entries(SAVE_KEYS)) if (!validateSlot(name,storage.getItem(key))) throw new Error('新存档格式不支持，原件已保留。');
    storage.setItem(MARKER, '{"version":1}'); return;
  }
  const entries = Object.fromEntries(Object.entries(LEGACY_KEYS).map(([name,key]) => [name,storage.getItem(key)]));
  for (const [name,raw] of Object.entries(entries)) if (!validateSlot(name,raw)) throw new Error('旧存档格式不支持，原件已保留。');
  storage.setItem(JOURNAL, JSON.stringify({version:1,entries}));
  for (const [name,key] of Object.entries(SAVE_KEYS)) if (entries[name] !== null) storage.setItem(key,entries[name]);
  for (const [name,key] of Object.entries(LEGACY_KEYS)) if (storage.getItem(key) !== entries[name]) throw new Error('旧存档在迁入期间变化，迁入已暂停，原件已保留。');
  storage.setItem(MARKER, '{"version":1}'); storage.removeItem(JOURNAL);
}
export function guardedWrite(storage,key,expected,next) {
  ensureSaveNamespace(storage);
  if (storage.getItem(key) !== expected) throw new Error('存档已被其他页面更新，请刷新后继续；较新原件已保留。');
  try { storage.setItem(key,next); }
  catch (error) {
    // Synchronous adapters may mutate and then throw. Only undo our own bytes.
    if (storage.getItem(key) === next) expected === null ? storage.removeItem(key) : storage.setItem(key,expected);
    throw error;
  }
  return next;
}
