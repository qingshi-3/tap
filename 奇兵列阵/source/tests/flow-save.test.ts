import { legacyRun } from './legacyRun';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {  takeDraft, beginBattle } from '../src/core/run';
import { loadRun, saveRun, SAVE_KEY } from '../src/core/save';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

it('已保存的空队伍可恢复、招募、保存并重进，补员机会不重复发放', () => {
  const run = legacyRun('lilithe', 9701);
  run.picks = 0; run.draft = []; run.gold = 8; run.lives = 2;
  localStorage.setItem(SAVE_KEY, JSON.stringify(run));
  const loaded = loadRun();
  expect(loaded.kind).toBe('ok');
  if (loaded.kind !== 'ok') throw new Error('load failed');
  expect(loaded.run.picks).toBe(1);
  expect(loaded.run.gold).toBe(8); expect(loaded.run.lives).toBe(2);
  expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).picks).toBe(1);
  expect(takeDraft(loaded.run, 0, 0)).toBe('place');
  expect(saveRun(loaded.run)).toBe(true);
  const again = loadRun();
  expect(again.kind).toBe('ok');
  if (again.kind !== 'ok') throw new Error('reload failed');
  expect(again.run.picks).toBe(0);
  expect(again.run.slots.filter(Boolean)).toHaveLength(1);
  expect(saveRun(again.run)).toBe(true);
});

it('战斗中重载先完成首领战结算，消耗本场法术', () => {
  const run = legacyRun('argeon', 9702);
  takeDraft(run, 0, 0); run.node = 8; run.activeSpells = ['sp_shield'];
  beginBattle(run, 'lose');
  localStorage.setItem(SAVE_KEY, JSON.stringify(run));
  const loaded = loadRun();
  expect(loaded.kind).toBe('ok');
  if (loaded.kind !== 'ok') throw new Error('load failed');
  expect(loaded.run.lives).toBe(2);
  expect(loaded.run.activeSpells).toEqual([]);
  expect(saveRun(loaded.run)).toBe(true);
  const again = loadRun();
  if (again.kind !== 'ok') throw new Error('reload failed');
  expect(again.run.lives).toBe(2);
  expect(again.run.activeSpells).toEqual([]);
});
