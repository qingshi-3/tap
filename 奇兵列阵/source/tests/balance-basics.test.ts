import { describe, expect, it } from 'vitest';
import { simulate } from '../src/core/engine';
import { PASSIVES } from '../src/core/content';
import { unitDef } from '../src/core/data';
import { chapter } from '../src/core/route';
import { applyResult, newRun } from '../src/core/run';
import type { BattleOutput, Copies, Slotted } from '../src/core/types';

const card = (defId: string, ownedId: number, copies: Copies = 1): Slotted => ({ defId, ownedId, copies });
const general = (id: string, passives: string[]) => ({ id, power: 0, passives });
const shieldEncounter = () => {
  const stage = chapter(0).stages[5];
  if (stage.type !== 'fork') throw new Error('expected the existing first-chapter fork');
  return stage.elite;
};
const firstAttack = (out: BattleOutput, uid: number) => out.log.find(({ ev }) => ev.t === 'dmg' && ev.kind === 'attack' && ev.src === uid)!.ev;

describe('基础机制修复：真实内容组合，不代表远征已取得', () => {
  it('破阵在敌方开战加挡之后、先机之前清挡，护甲只减一次', () => {
    const encounter = shieldEncounter();
    const out = simulate({ player: [card('n_merc', 1)], enemy: encounter.lineup, general: general('argeon', ['g_breach', 'g_first']) });
    expect(out.fault).toBeUndefined();
    const shield = out.initial.find(u => u.side === 1 && u.defId === 'e_shield')!;
    expect(out.log.some(({ ev }) => ev.t === 'block' && ev.uid === shield.uid)).toBe(true);
    const openingAttack = firstAttack(out, 1);
    expect(openingAttack).toMatchObject({ t: 'dmg', kind: 'attack', tgt: shield.uid });
    if (openingAttack.t !== 'dmg') throw new Error('expected damage');
    expect(openingAttack.blocked).not.toBe(true);
    expect(out.log.find(({ ev }) => ev.t === 'beat')!.snap.find(u => u.uid === shield.uid)!.grants.armor).toBe(-1);
    expect(out.afterStart.find(u => u.uid === shield.uid)!.block).toBe(0);
  });

  it('没有破阵时，真实盾卫的开战格挡仍能挡住先机', () => {
    const out = simulate({ player: [card('n_merc', 1)], enemy: shieldEncounter().lineup, general: general('argeon', ['g_first']) });
    expect(firstAttack(out, 1)).toMatchObject({ n: 0, blocked: true });
  });

  // Exercise promotion generation, isolating candidates by marking other generic passives
  // as already owned. This is a selection-rule check, never a player strength claim.
  function chainOffer(id: string, source: string, forced: string[] = []) {
    const r = newRun(id, 31);
    r.slots = [card(source, 1), null, null, null, null];
    r.bench = Array(r.bench.length).fill(null);
    r.passives = [...PASSIVES.filter(p => !p.general && p.id !== 'g_chain').map(p => p.id), ...forced];
    r.chapter = 0; r.node = 8;
    applyResult(r, 'win');
    return r.promo ?? [];
  }

  it.each([
    ['hank', 'n_merc', []],
    ['kaleos', 'n_merc', ['kaleos_3']],
    ['argeon', 'a_seed', []],
  ] as [string, string, string[]][])('连锁排除无普通立即攻击来源：%s/%s', (id, source, forced) => {
    expect(chainOffer(id, source, forced)).not.toContain('g_chain');
  });

  it.each(['s_dancer', 's_ninja', 'v_wyvern'])('连锁识别真实普通来源：%s', source => {
    expect(chainOffer('argeon', source)).toContain('g_chain');
  });

  it.each([[1, 4], [4, 1]] as [Copies, Copies][])('多个黑曜豹神按最强星级取值且不叠加：%s/%s份', (frontCopies, rearCopies) => {
    const stage = chapter(0).stages[0];
    if (stage.type !== 'battle') throw new Error('expected stone golem encounter');
    const out = simulate({ player: [card('d_onyx', 1, frontCopies), card('d_onyx', 2, rearCopies)], enemy: stage.main.lineup, general: general('argeon', ['g_weak']) });
    expect(out.fault).toBeUndefined();
    const hit = firstAttack(out, 1);
    if (hit.t !== 'dmg') throw new Error('expected damage');
    const actor = out.initial.find(u => u.uid === 1)!;
    const target = out.initial.find(u => u.uid === hit.tgt)!;
    const strongest = unitDef('d_onyx').values![2];
    expect(hit.n).toBe(Math.max(1, actor.atk + 1 + strongest - target.armor!));
    expect(hit.vuln).toBe(2);
  });

});
