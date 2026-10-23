import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allOwned, applyResult, beginBattle, choosePromo, claimPendingEggs, finishBattle, moveSlot, newRun, sell, takeDraft, type RunState } from '../src/core/run';
import { loadRun, saveRun, SAVE_KEY } from '../src/core/save';

const stats = { death: 12, burn: 0, freeze: 0, move: 0, summon: 0 };
const count = (r: RunState, id: string) => allOwned(r).filter((u) => u?.defId === id).length;
function fill(r: RunState) {
  for (let i = 0; i < 8; i++) {
    const slots = i < 5 ? r.slots : r.bench;
    const at = i < 5 ? i : i - 5;
    slots[at] ??= { defId: 'n_bulwark', copies: 1, ownedId: r.nextOwnedId++ };
  }
}
function takeTwin(r: RunState) { r.promo = ['xingjiao_2']; expect(choosePromo(r, 0)).toBe(true); }
function reload() {
  const loaded = loadRun();
  if (loaded.kind !== 'ok') throw new Error(`load: ${loaded.kind}`);
  return loaded.run;
}

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, String(v)),
    removeItem: (k: string) => values.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('星角双黄：待领蛋归属与更新续玩', () => {
  it('已有龙无蛋时取得双黄补一次，优先备战；重复选择不发奖', () => {
    const r = newRun('xingjiao', 8001);
    r.slots[0]!.defId = 'x_bone';
    takeTwin(r);
    expect(r.bench[0]?.defId).toBe('x_egg');
    expect(r.pendingEggs).toBe(0);
    expect(choosePromo(r, 0)).toBe(false);
    expect(claimPendingEggs(r)).toBe(0);
    expect(count(r, 'x_egg')).toBe(1);
  });

  it('蛋在备战也算持有，取得双黄不再补；没有龙也不凭空发蛋', () => {
    const r = newRun('xingjiao', 8002);
    r.slots[0]!.defId = 'x_bone';
    r.bench[0] = { defId: 'x_egg', copies: 1, ownedId: r.nextOwnedId++ };
    takeTwin(r);
    expect(count(r, 'x_egg')).toBe(1);
    const none = newRun('xingjiao', 8003);
    none.slots[0]!.defId = 'n_bulwark';
    takeTwin(none);
    expect(count(none, 'x_egg')).toBe(0);
  });

  it('满位孵化不覆盖，待领可累计；出售和合并后兑现空位', () => {
    const r = newRun('xingjiao', 8004);
    r.picks = 0; fill(r); takeTwin(r);
    const others = allOwned(r).slice(1).map((u) => u!.ownedId);
    applyResult(r, 'win', 0, stats);
    expect(count(r, 'x_bone')).toBe(1);
    expect(r.pendingEggs).toBe(1);
    expect(allOwned(r).slice(1).map((u) => u!.ownedId)).toEqual(others);
    expect(sell(r, 5)).toBe(true);
    expect(r.bench[0]?.defId).toBe('x_egg');
    expect(r.pendingEggs).toBe(0);
    r.pendingEggs = 2;
    expect(moveSlot(r, 1, 2)).toBe('merge');
    expect(r.slots[1]?.defId).toBe('x_egg');
    expect(r.pendingEggs).toBe(1);
  });

  it('覆盖招募不让待领蛋抢占目标位或被覆盖丢失', () => {
    const r = newRun('xingjiao', 8005);
    fill(r); r.pendingEggs = 1; r.picks = 1; r.draft = ['n_merc'];
    expect(takeDraft(r, 0, 1, true)).toBe('replace');
    expect(r.slots[1]?.defId).toBe('n_merc');
    expect(r.pendingEggs).toBe(1);
    expect(count(r, 'x_egg')).toBe(1);
    expect(sell(r, 5)).toBe(true);
    expect(count(r, 'x_egg')).toBe(2);
    expect(r.pendingEggs).toBe(0);
  });

  it('满位取得双黄保留奖励，保存、重进、继续游玩再保存不会重复发蛋', () => {
    const r = newRun('xingjiao', 8006);
    r.slots[0]!.defId = 'x_bone'; r.picks = 0; fill(r); takeTwin(r);
    expect(r.pendingEggs).toBe(1);
    expect(saveRun(r)).toBe(true);
    const loaded = reload();
    expect(loaded.pendingEggs).toBe(1);
    expect(sell(loaded, 5)).toBe(true);
    beginBattle(loaded, 'win', 0, { ...stats, death: 4 });
    expect(finishBattle(loaded)).toBe(true);
    expect(finishBattle(loaded)).toBe(false);
    expect(saveRun(loaded)).toBe(true);
    const again = reload();
    expect(count(again, 'x_egg')).toBe(1);
    expect(again.eggStats?.death).toBe(4);
    expect(again.pendingEggs).toBe(0);
    expect(sell(again, 6)).toBe(true);
    expect(saveRun(again)).toBe(true);
    expect(count(reload(), 'x_egg')).toBe(1);
  });

  it('保存中的孵化结算只执行一次，连续重进不重复孵化或发待领蛋', () => {
    const r = newRun('xingjiao', 8007);
    r.picks = 0; fill(r); takeTwin(r); beginBattle(r, 'win', 0, stats);
    expect(saveRun(r)).toBe(true);
    const loaded = reload();
    expect(loaded.pending).toBeNull();
    expect(loaded.pendingEggs).toBe(1);
    expect(count(loaded, 'x_bone')).toBe(1);
    const again = reload();
    expect(again.wins).toBe(1);
    expect(again.pendingEggs).toBe(1);
    expect(sell(again, 5)).toBe(true);
    expect(saveRun(again)).toBe(true);
    expect(count(reload(), 'x_egg')).toBe(1);
  });

  it('重进兑现已保存待领蛋并立即持久化，不影响下一次招募', () => {
    const r = newRun('xingjiao', 8010);
    r.slots[0]!.defId = 'x_bone'; r.pendingEggs = 1;
    expect(saveRun(r)).toBe(true);
    const loaded = reload();
    expect(loaded.bench[0]?.defId).toBe('x_egg');
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).pendingEggs).toBe(0);
    expect(count(reload(), 'x_egg')).toBe(1);
    const recruited = loaded.draft[0];
    expect(takeDraft(loaded, 0, 1)).toBe('place');
    expect(loaded.slots[1]?.defId).toBe(recruited);
    expect(saveRun(loaded)).toBe(true);
    const again = reload();
    expect(again.slots[1]?.defId).toBe(recruited);
    expect(saveRun(again)).toBe(true);
  });

  it('旧档无字段按0，不回溯已领取双黄；继续结算保存和重进仍可玩', () => {
    const r = newRun('xingjiao', 8008);
    r.picks = 0; r.slots[0]!.defId = 'x_bone'; r.passives.push('xingjiao_2');
    delete r.pendingEggs;
    localStorage.setItem(SAVE_KEY, JSON.stringify(r));
    const loaded = reload();
    expect(loaded.pendingEggs).toBe(0);
    expect(count(loaded, 'x_egg')).toBe(0);
    beginBattle(loaded, 'win', 0, stats); finishBattle(loaded);
    expect(saveRun(loaded)).toBe(true);
    const again = reload();
    expect(again.wins).toBe(1);
    expect(count(again, 'x_egg')).toBe(0);
    expect(saveRun(again)).toBe(true);
  });

  it('拒绝损坏的待领计数并保留原档', () => {
    for (const pendingEggs of [-1, 0.5, '1']) {
      const raw = JSON.stringify({ ...newRun('xingjiao', 8009), pendingEggs });
      localStorage.setItem(SAVE_KEY, raw);
      expect(loadRun().kind).toBe('incompatible');
      expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
    }
  });
});
