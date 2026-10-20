import { validateSave } from './rules.js';
// v3 is a new game; the old v1/v2 sandbox save under its own key is left untouched.
export const SAVE_KEY = 'patchwork-kingdom.v3';
export const RECORD_KEY = 'patchwork-kingdom.v3.records';
const EMPTY_RECORDS = { best: 0, runs: 0, wins: 0, daily: {} };

export function readSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { ok: true, state: null };
    const checked = validateSave(raw);
    return checked.ok ? { ok: true, state: checked.state } : { ok: false, reason: checked.reason, raw };
  } catch (error) {
    return { ok: false, reason: '无法读取存档：' + error.message };
  }
}
/** Never overwrites an unreadable save; the player must explicitly start over (which backs it up). */
export function writeSave(storage, state) {
  const checked = validateSave(state);
  if (!checked.ok) return checked;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw !== null && !validateSave(raw).ok) return { ok: false, reason: '原存档损坏，未覆盖。' };
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch {
    return { ok: false, reason: '浏览器没有保存成功。' };
  }
}
export function replaceSave(storage, state) {
  try {
    const old = storage.getItem(SAVE_KEY);
    if (old !== null && !validateSave(old).ok) storage.setItem(SAVE_KEY + '.backup', old);
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch {
    return { ok: false, reason: '浏览器没有保存成功。' };
  }
}
export function readRecords(storage) {
  try {
    const value = JSON.parse(storage.getItem(RECORD_KEY) || 'null');
    if (!value || typeof value !== 'object') return { ...EMPTY_RECORDS, daily: {} };
    return { ...EMPTY_RECORDS, ...value, daily: value.daily && typeof value.daily === 'object' ? value.daily : {} };
  } catch {
    return { ...EMPTY_RECORDS, daily: {} };
  }
}
export function writeRecords(storage, records) {
  try { storage.setItem(RECORD_KEY, JSON.stringify(records)); return true; } catch { return false; }
}
