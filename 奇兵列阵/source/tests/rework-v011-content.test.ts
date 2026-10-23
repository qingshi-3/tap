import { describe, expect, it } from 'vitest';
import { commitPreparation } from '../src/core/preparation';
import type { RunState } from '../src/core/run';
import type { Slotted } from '../src/core/types';
const unit = (defId: string, ownedId: number): Slotted => ({ defId, ownedId, copies: 1 });
const state = (slots: Slotted[]) => ({ slots, bench: [], allocLog: [], prepCommitted: false, prepUses: {} } as unknown as RunState);
describe('0.11 existing-core growth', () => {
  it('mentor grows only adjacent combo cores on commitment and cannot double-commit', () => {
    const core=unit('s_wind',1), mentor=unit('s_choreo',2), other=unit('n_merc',3);
    const r=state([core,mentor,other]); commitPreparation(r);
    expect(core.growth?.atk).toBe(2); expect(other.growth).toBeUndefined();
    commitPreparation(r); expect(core.growth?.atk).toBe(2);
  });
  it('paragon pays first preparation without a future upgrade', () => {
    const front=unit('n_bulwark',1), source=unit('n_paragon',2), rear=unit('s_wind',3);
    const r=state([front,source,rear]); commitPreparation(r);
    expect(front.growth?.atk).toBe(3); expect(rear.growth?.hp).toBe(4);
    commitPreparation(r); expect(front.growth?.atk).toBe(3); expect(rear.growth?.hp).toBe(4);
  });
  it('gold obelisk grows adjacent summoner without requiring rear placement', () => {
    const summoner=unit('d_dune',1), source=unit('d_goldob',2), rear=unit('n_merc',3);
    commitPreparation(state([summoner,source,rear]));
    expect(summoner.growth).toEqual({atk:1,hp:2}); expect(rear.growth).toBeUndefined();
  });
});
