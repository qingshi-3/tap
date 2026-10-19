import { createGame, validate } from './engine.js';

export const SAVE_KEY = 'courier-depot.save.v1';
export const BACKUP_KEY = `${SAVE_KEY}.backup`;

// Each loaded state remembers the exact document it may replace. Comparing the
// entire raw value also catches another tab's edit at the same numeric revision.
const snapshots = new WeakMap();
const response = (ok, code, message, extra = {}) => ({ ok, code, message, ...extra });
const storageError = () => response(false, 'storage_unavailable', '无法访问本机存档；本次进度仍保留在当前页面');

function decode(raw) {
  let state;
  try { state = JSON.parse(raw); }
  catch { return response(false, 'corrupt', '存档无法读取，原件已保留；请导出原件后处理', { state: null }); }
  if (state && typeof state === 'object' && typeof state.schema === 'number' && state.schema > 1) return response(false, 'future', '这是较新版本的存档，原件已保留', { state: null });
  const checked = validate(state);
  if (!checked.ok) return response(false, 'corrupt', `${checked.message}；原件已保留`, { state: null });
  return response(true, 'loaded', '', { state });
}

/** Returns {ok,code,message,state}; bad/future documents never become new games. */
export function loadGame(storage) {
  let raw;
  try { raw = storage.getItem(SAVE_KEY); }
  catch { return { ...storageError(), state: null }; }
  if (raw === null) {
    const state = createGame();
    snapshots.set(state, { storage, raw: null });
    return response(true, 'empty', '', { state });
  }
  const loaded = decode(raw);
  if (loaded.ok) snapshots.set(loaded.state, { storage, raw });
  return loaded;
}

/** Before replacing a valid save, persist its exact original as BACKUP_KEY.
 * Backup failure aborts the write. A stale/unloaded page cannot replace a save.
 * Failure leaves the in-memory state and previous expected document untouched,
 * so callers can retry after freeing space or restoring storage access.
 */
export function saveGame(storage, state) {
  const checked = validate(state);
  if (!checked.ok) return response(false, 'invalid', checked.message);
  let raw;
  try { raw = storage.getItem(SAVE_KEY); }
  catch { return storageError(); }
  const snapshot = snapshots.get(state);
  // A previous write may have committed while its read-back was unavailable.
  // Recognize that exact document on retry without accepting another tab's edit.
  if (snapshot?.storage === storage && snapshot.pendingRaw === raw) {
    snapshot.raw = raw;
    delete snapshot.pendingRaw;
  }
  if ((snapshot && (snapshot.storage !== storage || snapshot.raw !== raw)) || (!snapshot && raw !== null)) return response(false, 'stale', '另一个页面已更新存档，请重新载入后继续');
  let previous = null;
  if (raw !== null) {
    const decoded = decode(raw);
    if (!decoded.ok) return response(false, decoded.code, decoded.message);
    previous = decoded.state;
  }
  const next = JSON.stringify(state);
  if (raw === next) {
    snapshots.set(state, { storage, raw: next });
    return response(true, 'unchanged', '已保存');
  }
  if (previous && state.revision <= previous.revision) return response(false, 'stale', '进度版本没有更新，请重新载入后继续');
  try {
    if (raw !== null) storage.setItem(BACKUP_KEY, raw);
  } catch { return response(false, 'backup_failed', '备份失败，旧存档未覆盖；请释放存储空间后重试'); }
  try { storage.setItem(SAVE_KEY, next); }
  catch {
    // Some hosts report failure after committing. Read back before allowing a
    // retry, so a successful settlement is never mistaken for a lost write.
    snapshots.set(state, { storage, raw, pendingRaw: next });
    try {
      if (storage.getItem(SAVE_KEY) === next) {
        snapshots.set(state, { storage, raw: next });
        return response(true, 'saved', '已保存', { recovered: true });
      }
    } catch { /* Original failure remains actionable; no destructive recovery. */ }
    return response(false, 'write_failed', '保存未确认；请保留本页，恢复存储空间后重试');
  }
  snapshots.set(state, { storage, raw: next });
  return response(true, 'saved', '已保存');
}

/** Raw originals are available even when validation fails; no repair/reset. */
export function exportRaw(storage) {
  try { return response(true, 'exported', '', { raw: storage.getItem(SAVE_KEY), backup: storage.getItem(BACKUP_KEY) }); }
  catch { return { ...storageError(), raw: null, backup: null }; }
}
