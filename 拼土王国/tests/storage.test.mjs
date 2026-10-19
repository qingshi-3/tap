import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAVE_KEY, readSave, writeSave, replaceSave } from '../dist/storage.js';
import { createGame, build, nextTurn } from '../dist/rules.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  return {
    values, calls, failRead: false, failKey: null,
    getItem(key) {
      calls.push(['get', key]);
      if (this.failRead) throw new Error('storage access denied');
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      calls.push(['set', key]);
      if (this.failKey === key) throw new Error('quota exceeded');
      values.set(key, String(value));
    },
  };
}

test('writing or explicitly importing a validated v1 persists normalized v2 at the fixed key', () => {
  const legacy=JSON.parse(readFileSync(new URL('./fixtures/save-v1-before-drafts.json',import.meta.url),'utf8'));
  const storage=memoryStorage({[SAVE_KEY]:JSON.stringify(legacy)});
  assert.equal(writeSave(storage,legacy).ok,true);
  assert.equal(JSON.parse(storage.values.get(SAVE_KEY)).version,2);
  assert.equal(replaceSave(storage,legacy).ok,true);
  const saved=JSON.parse(storage.values.get(SAVE_KEY));
  assert.equal(saved.version,2);
  assert.deepEqual(saved.tiles,legacy.tiles);
  assert.equal(saved.gold,legacy.gold);
  nextTurn(saved);
  assert.equal(writeSave(storage,saved).ok,true);
  const reloaded=readSave(storage).state;
  nextTurn(reloaded);
  assert.equal(writeSave(storage,reloaded).ok,true);
  assert.equal(readSave(storage).state.turn,legacy.turn+2);
});

test('missing saves are distinguishable from corrupt saves, and reading never repairs or deletes data', () => {
  const empty = memoryStorage();
  assert.deepEqual(readSave(empty), { ok: true, state: null });
  assert.equal(empty.values.size, 0);
  for (const raw of ['{broken', 'null', '{"version":2}', JSON.stringify({ ...createGame(10), gold: -1 })]) {
    const storage = memoryStorage({ [SAVE_KEY]: raw });
    const result = readSave(storage);
    assert.equal(result.ok, false);
    assert.ok(result.reason.length > 0);
    assert.equal(storage.values.get(SAVE_KEY), raw);
    assert.ok(storage.calls.every(([operation]) => operation === 'get'));
  }
});

test('ordinary autosave refuses to overwrite a corrupt existing save', () => {
  for (const raw of ['{broken', JSON.stringify({ ...createGame(11), version: 99 })]) {
    const storage = memoryStorage({ [SAVE_KEY]: raw });
    const result = writeSave(storage, createGame(12));
    assert.equal(result.ok, false);
    assert.ok(result.reason.length > 0);
    assert.equal(storage.values.get(SAVE_KEY), raw);
    assert.ok(storage.calls.every(([operation]) => operation !== 'set'));
  }
});

test('invalid replacement state does not touch either current save or backup', () => {
  const current = JSON.stringify(createGame(13));
  const storage = memoryStorage({ [SAVE_KEY]: current, [SAVE_KEY + '.backup']: 'older-backup' });
  const damaged = createGame(14);
  damaged.tiles[0].terrain = 'unknown';
  assert.equal(writeSave(storage, damaged).ok, false);
  assert.equal(replaceSave(storage, damaged).ok, false);
  assert.equal(storage.values.get(SAVE_KEY), current);
  assert.equal(storage.values.get(SAVE_KEY + '.backup'), 'older-backup');
  assert.equal(storage.calls.length, 0);
});

test('explicit replacement preserves the complete original, including an unreadable original', () => {
  for (const old of [JSON.stringify(createGame(15)), '{unreadable-original']) {
    const storage = memoryStorage({ [SAVE_KEY]: old });
    const next = createGame(16);
    assert.equal(replaceSave(storage, next).ok, true);
    assert.equal(storage.values.get(SAVE_KEY + '.backup'), old);
    assert.deepEqual(readSave(storage).state, next);
    const writes = storage.calls.filter(([operation]) => operation === 'set').map(([, key]) => key);
    assert.deepEqual(writes, [SAVE_KEY + '.backup', SAVE_KEY]);
  }
});

test('failed backup prevents primary replacement and leaves old primary and old backup intact', () => {
  const original = '{damaged-but-valuable';
  const storage = memoryStorage({ [SAVE_KEY]: original, [SAVE_KEY + '.backup']: 'previous-backup' });
  storage.failKey = SAVE_KEY + '.backup';
  const result = replaceSave(storage, createGame(17));
  assert.equal(result.ok, false);
  assert.ok(result.reason.length > 0);
  assert.equal(storage.values.get(SAVE_KEY), original);
  assert.equal(storage.values.get(SAVE_KEY + '.backup'), 'previous-backup');
  assert.ok(!storage.calls.some(([operation, key]) => operation === 'set' && key === SAVE_KEY));
});

test('quota failure is reported and cannot pretend that progress was saved', () => {
  const original = JSON.stringify(createGame(18));
  const storage = memoryStorage({ [SAVE_KEY]: original });
  storage.failKey = SAVE_KEY;
  const changed = createGame(19);
  const autosave = writeSave(storage, changed);
  assert.equal(autosave.ok, false);
  assert.ok(autosave.reason.length > 0);
  assert.equal(storage.values.get(SAVE_KEY), original);
  const replacement = replaceSave(storage, changed);
  assert.equal(replacement.ok, false);
  assert.ok(replacement.reason.length > 0);
  assert.equal(storage.values.get(SAVE_KEY), original);
  assert.equal(storage.values.get(SAVE_KEY + '.backup'), original);
});

test('unreadable current storage cannot be overwritten by an ordinary or explicit save', () => {
  const original = JSON.stringify(createGame(20));
  const storage = memoryStorage({ [SAVE_KEY]: original });
  storage.failRead = true;
  assert.equal(readSave(storage).ok, false);
  assert.equal(writeSave(storage, createGame(21)).ok, false);
  assert.equal(replaceSave(storage, createGame(21)).ok, false);
  assert.equal(storage.values.get(SAVE_KEY), original);
  assert.ok(storage.calls.every(([operation]) => operation !== 'set'));
});

test('throwing storage method getters return visible failures rather than uncaught exceptions', () => {
  const denied = {};
  for (const method of ['getItem', 'setItem']) {
    Object.defineProperty(denied, method, { get() { throw new Error('security policy denied storage'); } });
  }
  assert.equal(readSave(denied).ok, false);
  assert.equal(writeSave(denied, createGame(22)).ok, false);
  assert.equal(replaceSave(denied, createGame(22)).ok, false);
});

test('reading and autosaving a real kingdom supports building, settlement, reload and another save', () => {
  const storage = memoryStorage();
  const state = createGame(23);
  assert.equal(writeSave(storage, state).ok, true);
  const loaded = readSave(storage);
  assert.equal(loaded.ok, true);
  assert.notEqual(loaded.state, state);
  assert.equal(build(loaded.state, 'school', 6, 5).ok, true);
  nextTurn(loaded.state);
  assert.equal(writeSave(storage, loaded.state).ok, true);
  const reloaded = readSave(storage);
  assert.equal(reloaded.ok, true);
  assert.equal(reloaded.state.turn, 2);
  assert.ok(reloaded.state.tiles.some(tile => tile.building === 'school'));
  assert.ok(reloaded.state.knowledge > state.knowledge);
  nextTurn(reloaded.state);
  assert.equal(writeSave(storage, reloaded.state).ok, true);
  assert.equal(readSave(storage).state.turn, 3);
});
