import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import type { EnemyEntry } from '../src/core/types';

const E = (defId: string, atk = 1, hp = 100): EnemyEntry => ({ defId, atk, hp });
function battle(defId: string, sniper: boolean, taunt = false) {
  return new Battle({
    player: taunt ? [E('s_panda'), E(defId, 10)] : [E(defId, 10), E('s_panda')],
    enemy: taunt ? [E('e_guardian', 1, 1), E('e_skel')] : sniper ? [E('e_skel'), E('e_skel',1,1)] : [E('e_skel', 1, 1), E('e_skel')],
    general: { id: 'reva', power: 0, passives: ['g_arena'] },
  });
}
function step(b: Battle) {
  const pipeline = b as unknown as { startPhase(): void; doBeat(): void };
  pipeline.startPhase(); pipeline.doBeat();
  return b.log.map((x) => x.ev);
}

describe('击败对手：仅实际攻击者带决斗才有资格', () => {
  it.each([['n_merc', false], ['n_archer', true]] as const)('%s 普攻击杀不计决斗、不触发熊猫或竞技场', (id, sniper) => {
    const b = battle(id, sniper), ev = step(b);
    expect(ev.some((e) => e.t === 'death')).toBe(true);
    expect(b.metrics.kills).toBe(1);
    expect(b.metrics.duelKills).toBe(0);
    expect(ev.filter((e) => e.t === 'buff' && e.src === 2)).toHaveLength(0);
    expect(ev.filter((e) => e.t === 'heal')).toHaveLength(0);
  });

  it('带决斗击杀嘲讽拦截者，广播熊猫增益并触发竞技场治疗', () => {
    const b = battle('s_fox', false, true); b.units[0].actionsLeft = 0; b.units[1].hp -= 10; const ev = step(b);
    expect(ev.some((e) => e.t === 'dmg' && e.src === 2 && e.tgt === 3 && e.kind === 'attack')).toBe(true);
    expect(b.metrics.duelKills).toBe(1);
    expect(ev.filter((e) => e.t === 'buff' && e.src === 1)).toHaveLength(2);
    expect(ev.some((e) => e.t === 'heal' && e.tgt === 2)).toBe(true);
  });

  it('后天获得决斗同样有资格，仍由自然目标前邻嘲讽拦截', () => {
    const b = battle('n_archer', true, true);
    b.units[0].actionsLeft = 0; b.units[1].grants.duel = true;
    const ev = step(b);
    expect(b.metrics.duelKills).toBe(1);
    expect(ev.filter((e) => e.t === 'buff' && e.src === 1)).toHaveLength(2);
  });
});
