import { describe, expect, it } from 'vitest';
import { applyAction, createGame, serializeGame, step } from './core/index';
import { importReplay, exportReplay, loadRun, saveRun, startFreshRun, type StoragePort } from './storage';

/** 内存存储端口，用来在没有浏览器的环境里验证存档契约。 */
function memoryPort(): StoragePort & { dump: Map<string, string> } {
  const dump = new Map<string, string>();
  return {
    dump,
    getItem: (key) => dump.get(key) ?? null,
    setItem: (key, value) => { dump.set(key, value); },
    removeItem: (key) => { dump.delete(key); },
  };
}

describe('规则核心在 DeepSeek 版仍可用', () => {
  it('同一局可以推进到战斗并产生敌人，守住后回到准备阶段', () => {
    const state = createGame(20261013);
    expect(applyAction(state, { type: 'buyLegion', kind: 'shield', x: 22, y: 10 }).ok).toBe(true);
    expect(applyAction(state, { type: 'startWave' }).ok).toBe(true);
    expect(state.phase).toBe('combat');
    step(state, 30);
    expect(state.units.some((u) => u.team === 'enemy')).toBe(true);
    // 单个盾卫能守住第一波，波次结束后回到准备阶段并给出奖励三选一。
    step(state, 3000);
    expect(state.phase).toBe('prep');
    expect(state.stats.wavesCleared).toBe(1);
    expect(state.cardChoices.length).toBe(3);
  });

  it('未注册的部署点被拒绝，且不扣金币', () => {
    const state = createGame(7);
    const before = state.gold;
    const result = applyAction(state, { type: 'buyLegion', kind: 'shield', x: 0, y: 0 });
    expect(result.ok).toBe(false);
    expect(state.gold).toBe(before);
  });
});

describe('存档契约', () => {
  it('准备阶段保存后能读回同一战局', () => {
    const port = memoryPort();
    const state = startFreshRun(1234, port);
    applyAction(state, { type: 'buyLegion', kind: 'archer', x: 20, y: 12 });
    expect(saveRun(state, port).ok).toBe(true);
    const loaded = loadRun(port);
    expect(loaded.error).toBeUndefined();
    expect(loaded.state).not.toBeNull();
    expect(serializeGame(loaded.state!)).toBe(serializeGame(state));
  });

  it('战斗中不写存档：检查点保持开波前的样子', () => {
    const port = memoryPort();
    const state = startFreshRun(99, port);
    applyAction(state, { type: 'buyLegion', kind: 'shield', x: 22, y: 10 });
    // 开波前持久化检查点（与 app 的开战流程一致）。
    expect(saveRun(state, port).ok).toBe(true);
    const checkpoint = port.getItem('deepseek-guardians.run.v1')!;
    expect(JSON.parse(JSON.parse(checkpoint).snapshot).wave).toBe(0);

    applyAction(state, { type: 'startWave' });
    step(state, 200);
    expect(state.phase).toBe('combat');
    // 战斗进行中保存必须被拒绝，存储字节不变。
    const during = saveRun(state, port);
    expect(during.ok).toBe(true);
    expect(during.message).toContain('检查点');
    expect(port.getItem('deepseek-guardians.run.v1')).toBe(checkpoint);
  });

  it('波次结束后才写入新进度，重进可继续下一波', () => {
    const port = memoryPort();
    const state = startFreshRun(77, port);
    applyAction(state, { type: 'buyLegion', kind: 'shield', x: 22, y: 10 });
    saveRun(state, port);
    applyAction(state, { type: 'startWave' });
    step(state, 3000);
    expect(state.phase).toBe('prep');
    expect(saveRun(state, port).ok).toBe(true);
    const loaded = loadRun(port);
    expect(loaded.state).not.toBeNull();
    expect(loaded.state!.wave).toBe(1);
    expect(loaded.state!.stats.wavesCleared).toBe(1);
    expect(serializeGame(loaded.state!)).toBe(serializeGame(state));
  });

  it('未知结构保留原件并报错，不清空存档', () => {
    const port = memoryPort();
    startFreshRun(5, port);
    const original = port.getItem('deepseek-guardians.run.v1')!;
    port.setItem('deepseek-guardians.run.v1', JSON.stringify({ version: 99, runId: 'x', snapshot: '{}' }));
    const broken = port.getItem('deepseek-guardians.run.v1')!;
    const loaded = loadRun(port);
    expect(loaded.state).toBeNull();
    expect(loaded.error).toBeTruthy();
    // 读取失败不得改动存储内容。
    expect(port.getItem('deepseek-guardians.run.v1')).toBe(broken);
    expect(original).not.toBe(broken);
  });

  it('新局先备份旧档，备份成功后才替换', () => {
    const port = memoryPort();
    startFreshRun(111, port);
    const first = port.getItem('deepseek-guardians.run.v1')!;
    startFreshRun(222, port);
    const backups = [...port.dump.keys()].filter((key) => key.includes('.backup.'));
    expect(backups.length).toBe(1);
    expect(port.dump.get(backups[0])).toBe(first);
    expect(port.getItem('deepseek-guardians.run.v1')).not.toBe(first);
  });

  it('另一个页面改了进度时拒绝覆盖', () => {
    const port = memoryPort();
    const state = startFreshRun(333, port);
    port.setItem('deepseek-guardians.run.v1', JSON.stringify({ version: 1, runId: 'other', snapshot: serializeGame(createGame(444)) }));
    const result = saveRun(state, port);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('另一个页面');
  });
});

describe('回放契约', () => {
  it('导出后能重现到相同最终 tick', () => {
    const state = createGame(4321);
    applyAction(state, { type: 'buyLegion', kind: 'shield', x: 22, y: 10 });
    applyAction(state, { type: 'startWave' });
    step(state, 300);
    const text = exportReplay(state);
    const restored = importReplay(text);
    expect(restored.tick).toBe(state.tick);
    expect(serializeGame(restored)).toBe(serializeGame(state));
  });

  it('规则版本不匹配时拒绝载入', () => {
    const state = createGame(1);
    const raw = JSON.parse(exportReplay(state)) as Record<string, unknown>;
    raw.rulesVersion = 'someone-elses-9.9.9';
    expect(() => importReplay(JSON.stringify(raw))).toThrow();
  });
});
