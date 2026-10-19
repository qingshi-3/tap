import { SAVE_KEYS, ensureSaveNamespace, guardedWrite, validMatchRecord } from './storage-contract.js';
import { validateMatch } from './engine.js';

const LOCAL_KEY = SAVE_KEYS.match;

function localRead(storage) {
  let raw = null;
  try {
    raw = storage.getItem(LOCAL_KEY);
    if (raw === null) return { raw, snapshot: null, error: null };
    const record = JSON.parse(raw);
    if (!validMatchRecord(record)) throw new Error('不支持的棋局格式');
    return { raw, snapshot: record.snapshot, error: null };
  } catch (error) {
    return { raw, snapshot: null, error: new Error('无法读取本地棋局，原存档已保留：' + error.message) };
  }
}

// The existing trial slot is local. PlayerCloud owns all TapTap SDK calls,
// sharing one archive and upload budget across trials and expeditions.
export class SaveManager {
  cloudAvailable = false;
  archive = null;
  writeError = null;
  constructor(onStatus = () => {}, storage) {
    try { this.storage = storage || globalThis.localStorage; } catch { this.storage = null; }
    this.onStatus = onStatus;
    try { ensureSaveNamespace(this.storage); this.local = localRead(this.storage); }
    catch (error) { this.local = { raw: null, snapshot: null, error }; }
  }
  get localSnapshot() { return this.local.snapshot; }
  get localError() { return this.writeError || this.local.error; }

  saveLocal(snapshot) {
    if (this.local.error || !validateMatch(snapshot)) return false;
    const current = localRead(this.storage);
    if (current.error) { this.writeError = current.error; this.setStatus(current.error.message); return false; }
    try {
      const next = JSON.parse(JSON.stringify(snapshot));
      next.revision = (Number.isSafeInteger(next.revision) ? next.revision : 0) + 1;
      const record = {
        game: 'duelyst-h5', schemaVersion: 1, slotId: 'duelyst-main',
        runId: next.runId, revision: next.revision, savedAt: Date.now(),
        playtimeSeconds: Math.max(0, Math.floor(next.playtimeSeconds || 0)), snapshot: next
      };
      const raw = JSON.stringify(record);
      guardedWrite(this.storage, LOCAL_KEY, this.local.raw, raw);
      snapshot.revision = next.revision;
      this.local = { raw, snapshot: next, error: null };
      this.writeError = null;
      return true;
    } catch (error) {
      this.writeError = new Error('本地棋局未能保存：' + error.message);
      this.setStatus(this.writeError.message);
      return false;
    }
  }
  setStatus(message) {
    try { this.onStatus(message, { cloudAvailable: false, hasCloudArchive: false }); } catch { /* Status rendering cannot change a save result. */ }
  }
}
