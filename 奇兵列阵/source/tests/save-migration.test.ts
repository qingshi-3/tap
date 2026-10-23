import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import historicalSave from './fixtures/boss-save-v014.json';
import { CONTENT_STRUCTURE, CONTENT_VERSION, newRun, takeDraft } from '../src/core/run';
import { clearAllData, loadRun, saveRun, SAVE_KEY } from '../src/core/save';
import { CAREER_KEY, loadCareer } from '../src/core/career';

let values: Map<string, string>;
beforeEach(() => {
  values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

it('0.8.0 存档（无结构版本号）在兼容的当前内容版本里照常续玩，并记下新版本号', () => {
  values.set(SAVE_KEY, JSON.stringify(historicalSave));
  const loaded = loadRun();
  expect(loaded.kind).toBe('ok');
  if (loaded.kind !== 'ok') throw new Error('load failed');
  expect(loaded.run.contentVersion).toBe(CONTENT_VERSION);
  expect(loaded.run.contentStructure).toBe(CONTENT_STRUCTURE);
  expect(loaded.run.slots).toEqual(historicalSave.slots);
});

it('结构版本号不同：远征作废，生涯保留', () => {
  const run = newRun('lilithe', 9801);
  takeDraft(run, 0, 0);
  expect(saveRun(run)).toBe(true);
  const career = values.get(CAREER_KEY);
  expect(career).toBeTruthy();
  values.set(SAVE_KEY, JSON.stringify({ ...run, contentStructure: CONTENT_STRUCTURE + 1 }));
  expect(loadRun().kind).toBe('incompatible');
  expect(values.get(CAREER_KEY)).toBe(career);
});

it('存档引用了已删除的单位：判不兼容而不是崩溃', () => {
  const run = newRun('lilithe', 9802);
  takeDraft(run, 0, 0);
  values.set(SAVE_KEY, JSON.stringify({ ...run, slots: [{ defId: 'gone_unit', ownedId: 1, copies: 1 }, null, null, null, null] }));
  expect(loadRun().kind).toBe('incompatible');
});

it('清除全部数据：远征、生涯、教学、提示都删，声音偏好保留', () => {
  const run = newRun('argeon', 9803);
  takeDraft(run, 0, 0);
  expect(saveRun(run)).toBe(true);
  values.set('zl_tutorial_done', '1');
  values.set('zl_coach', 'drag,g_reva');
  values.set('zl_muted', '1');
  clearAllData();
  expect(values.has(SAVE_KEY)).toBe(false);
  expect(values.has(CAREER_KEY)).toBe(false);
  expect(values.has('zl_tutorial_done')).toBe(false);
  expect(values.has('zl_coach')).toBe(false);
  expect(values.get('zl_muted')).toBe('1');
  expect(loadRun().kind).toBe('none');
  expect(loadCareer().activeRunId ?? null).toBeNull();
});
