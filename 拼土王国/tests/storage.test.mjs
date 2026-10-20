import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../dist/rules.js';
import { SAVE_KEY, RECORD_KEY, readSave, writeSave, replaceSave, readRecords, writeRecords } from '../dist/storage.js';

const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), m }; };

test('empty storage reads as no save', () => {
  assert.deepEqual(readSave(mem()), { ok: true, state: null });
});
test('round trip', () => {
  const s = mem(), g = createGame(5);
  assert.ok(writeSave(s, g).ok);
  assert.equal(JSON.stringify(readSave(s).state), JSON.stringify(g));
});
test('corrupt save is never silently overwritten, replace backs it up', () => {
  const s = mem({ [SAVE_KEY]: '{bad' });
  assert.equal(readSave(s).ok, false);
  assert.equal(writeSave(s, createGame(1)).ok, false);
  assert.equal(s.m.get(SAVE_KEY), '{bad');
  assert.ok(replaceSave(s, createGame(1)).ok);
  assert.equal(s.m.get(SAVE_KEY + '.backup'), '{bad');
  assert.ok(readSave(s).state);
});
test('old v2 save key is ignored', () => {
  const s = mem({ 'patchwork-kingdom.v2': '{"version":2}' });
  assert.deepEqual(readSave(s), { ok: true, state: null });
});
test('throwing storage reports failure', () => {
  const s = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(readSave(s).ok, false);
  assert.equal(writeSave(s, createGame(1)).ok, false);
});
test('records default and persist', () => {
  const s = mem();
  assert.deepEqual(readRecords(s), { best: 0, runs: 0, wins: 0, daily: {} });
  writeRecords(s, { best: 9, runs: 1, wins: 1, daily: { '2026-10-20': 9 } });
  assert.equal(readRecords(s).best, 9);
  s.setItem(RECORD_KEY, 'nope');
  assert.equal(readRecords(s).best, 0);
});
