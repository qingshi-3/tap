import { describe, expect, it } from 'vitest';
import { simulate } from '../src/core/engine';
import { unitDef } from '../src/core/data';
import { chapter } from '../src/core/route';
import { allocPoint, allOwned, applyResult, buildBattle, currentNode, leaveShop, moveSlot, newRun, screen, takeDraft, type RunState } from '../src/core/run';
import type { Slotted } from '../src/core/types';

const owned = (defId: string, ownedId: number, copies: 1 | 2 = 1): Slotted => ({ defId, ownedId, copies });
function beforeFatigue(out: ReturnType<typeof simulate>) {
  expect(out.fault).toBeUndefined();
  expect(out.result).toBe('win');
  expect(out.log.some((x) => x.ev.t === 'dmg' && x.ev.kind === 'fatigue')).toBe(false);
}
const first = () => {
  const stage = chapter(0).stages[0];
  if (stage.type !== 'battle') throw new Error('opening battle missing');
  return stage.main.lineup;
};
function recruit(r: RunState) {
  for (let purchases=0; r.gold>=3 && purchases<8; purchases++) {
    const choice = r.draft.map((id, i) => ({ i, id, score: id ? unitDef(id).hp + unitDef(id).atk * 2 : -Infinity })).filter(x=>!!x.id).sort((a, b) => b.score - a.score)[0];
    const at = allOwned(r).findIndex((u) => !u);
    if (at<0 || !choice) break;
    expect(takeDraft(r, choice.i, at)).toBe('place');
  }
  const order = allOwned(r).filter((u): u is Slotted => !!u).sort((a, b) => unitDef(b.defId).hp - unitDef(a.defId).hp);
  order.forEach((u, i) => {
    const from = allOwned(r).findIndex((x) => x?.ownedId === u.ownedId);
    if (from !== i) expect(moveSlot(r, from, i, 'swap')).not.toBe('invalid');
  });
  for (const key of Object.keys(r.stash)) while (r.stash[key]) expect(allocPoint(r, 0, key)).toBe(true);
}

describe('开局教学：正常低阶起手与前四战衔接', () => {
  it('正常合并的二星战地医师首战直接取胜，不靠疲劳磨死敌人', () => {
    // 两份医师的正常合并结果；不借助主将伤害、培养或装备。
    const r = newRun('reva', 120);
    r.slots[0] = owned('n_medic', 1); r.slots[1] = owned('n_medic', 2); r.nextOwnedId = 3;
    expect(moveSlot(r, 1, 0)).toBe('merge');
    const out = simulate(buildBattle(r));
    beforeFatigue(out);
    expect(out.log.filter((x) => x.ev.t === 'beat')).toHaveLength(1);
  });

  it.each([['n_archer'], ['n_bulwark'], ['n_medic', 'n_medic'], ['d_howler', 'n_medic'], ['m_egg', 'x_egg']].map(ids => ({ ids })))('基础起手$ids不需培养或稀有卡即可疲劳前取胜', ({ ids }) => {
    const out = simulate({ player: ids.map((id, i) => owned(id, i + 1)), enemy: first() });
    beforeFatigue(out);
    if (ids.includes('m_egg')) expect(out.log.some((x) => x.ev.t === 'summon')).toBe(true);
  });

  it.each([11, 23, 41])('合法种子%i连续招募、打三战并培养后进入第四战', seed => {
    const r = newRun('reva', seed);
    for (let battle = 0; battle < 3; battle++) {
      recruit(r);
      const out = simulate(buildBattle(r));
      beforeFatigue(out);
      applyResult(r, out.result, out.gold, out.eggStats);
      expect(Object.values(r.stash).reduce((a, b) => a + b, 0)).toBe(3);
    }
    expect(screen(r)).toBe('shop');
    expect(leaveShop(r)).toBe(true);
    expect(screen(r)).toBe('prep');
    expect(currentNode(r).kind).toBe('normal');
    recruit(r);
    beforeFatigue(simulate(buildBattle(r)));
  });

  it.each([false, true])('第四战变体%s，一星基础未成型队有疲劳前取胜布阵', variant => {
    const stage = chapter(0).stages[4];
    if (stage.type !== 'battle') throw new Error('fourth battle missing');
    const enemy = variant ? stage.variant!.lineup : stage.main.lineup;
    const out = simulate({ player: ['n_bulwark', 'n_merc', 'd_howler', 'n_medic', 'n_archer'].map((id, i) => owned(id, i + 1)), enemy });
    beforeFatigue(out);
  });
});
