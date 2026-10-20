export * from './storage-keys.js';

export function ensureStorage(storage) {
  if (!storage?.getItem || !storage?.setItem || !storage?.removeItem) throw new Error('storage is unavailable');
}
// Compare-and-swap write: never overwrite bytes another page wrote after we read them.
export function guardedWrite(storage,key,expected,next) {
  ensureStorage(storage);
  if (storage.getItem(key) !== expected) throw new Error('存档已被其他页面更新，请刷新后继续；较新原件已保留。');
  try { storage.setItem(key,next); }
  catch (error) {
    // Synchronous adapters may mutate and then throw. Only undo our own bytes.
    if (storage.getItem(key) === next) expected === null ? storage.removeItem(key) : storage.setItem(key,expected);
    throw error;
  }
  return next;
}
