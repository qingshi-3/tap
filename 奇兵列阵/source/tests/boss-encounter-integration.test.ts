import { afterEach, describe, expect, it, vi } from 'vitest';
import historicalSave from './fixtures/boss-save-v014.json';
import { simulate } from '../src/core/engine';
import { beginBattle, buildBattle, choosePromo, finishBattle, newRun } from '../src/core/run';
import { loadRun, saveRun, SAVE_KEY } from '../src/core/save';

afterEach(() => vi.unstubAllGlobals());

describe('关卡规则接入与历史存档续玩', () => {
  it('仅首领关附加遭遇规则，改变站位不改变单位固有定义', () => {
    const r = newRun('hank', 20);
    expect(buildBattle(r).rules).toBeUndefined();
    r.node = 8;
    for (let ch = 0; ch < 3; ch++) {
      r.chapter = ch;
      const setup = buildBattle(r);
      expect(setup.rules).toHaveLength(1);
      expect(setup.rules?.[0].source?.defId).toBe(['e_void', 'e_frostq', 'e_nightk'][ch]);
    }
    expect(buildBattle(r).enemy.map(e => e?.defId)).toEqual(['e_guardian', 'e_revenant', 'e_twin', 'e_nightk', 'e_lich']);
  });

  it('无规则字段的旧档继续战斗、保存、重进及再保存；进行中结果只结算一次', () => {
    const storage = new Map([[SAVE_KEY, JSON.stringify(historicalSave)]]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    });
    const loaded = loadRun();
    expect(loaded.kind).toBe('ok');
    if (loaded.kind !== 'ok') return;
    const r = loaded.run;
    expect(r.gold).toBe(historicalSave.gold);
    expect(r.slots).toEqual(historicalSave.slots);
    expect(buildBattle(r).rules?.[0].id).toBe('void_rally');
    const out = simulate(buildBattle(r));
    expect(out.fault).toBeUndefined();
    beginBattle(r, out.result, out.gold ?? 0);
    saveRun(r);
    const resumed = loadRun();
    expect(resumed.kind).toBe('ok');
    if (resumed.kind !== 'ok') return;
    expect(resumed.run.history).toHaveLength(historicalSave.history.length + 1);
    expect(resumed.run.pending).toBeNull();
    const after = JSON.stringify(resumed.run);
    expect(loadRun()).toEqual(resumed);
    expect(finishBattle(resumed.run)).toBe(false);
    expect(JSON.stringify(resumed.run)).toBe(after);
    expect(resumed.run.over).toBeNull();
    expect(out.result).toBe('win');
    expect(resumed.run.chapter).toBe(1);
    expect(choosePromo(resumed.run, 0)).toBe(true);
    // 验证可继续下一次战斗，而非只成功解析存档。
    const second = simulate(buildBattle(resumed.run));
    expect(second.fault).toBeUndefined();
    beginBattle(resumed.run, second.result, second.gold ?? 0);
    finishBattle(resumed.run);
    saveRun(resumed.run);
    const reloaded = loadRun();
    expect(reloaded.kind).toBe('ok');
    if (reloaded.kind !== 'ok') return;
    expect(reloaded.run.history).toHaveLength(historicalSave.history.length + 2);
    expect(reloaded.run.slots).toEqual(resumed.run.slots);
    expect(reloaded.run.gold).toBe(resumed.run.gold);
    expect(storage.get(SAVE_KEY)).not.toContain('void_rally');
    expect(storage.get(SAVE_KEY)).not.toContain('actionsLeft');
  });
});
