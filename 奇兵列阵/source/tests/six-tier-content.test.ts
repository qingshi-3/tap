import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import { unitDef } from '../src/core/data';
import { allocPoint, commitPreparation, newRun, sell, takeDraft, undoAlloc } from '../src/core/run';
import type { EnemyEntry, Slotted } from '../src/core/types';

const owned = (defId: string, ownedId: number): Slotted => ({ defId, ownedId, copies: 1 });
function preparation(ids: string[]) {
  const r = newRun('kaleos', 17);
  r.slots = Array.from({ length: 5 }, (_, i) => ids[i] ? owned(ids[i], i + 1) : null);
  r.bench = [null, null, null]; r.nextOwnedId = 20;
  r.gold = 10; r.picks = 2; r.allocLog = []; r.prepUses = {}; r.prepCommitted = false;
  return r;
}
function battle(player: EnemyEntry[], enemy: EnemyEntry[]) { return new Battle({ player, enemy }); }
function step(b: Battle, n = 1) {
  const internal = b as unknown as { startPhase(): void; doBeat(): void };
  if (!b.beat) internal.startPhase();
  for (let i = 0; i < n && !b.outcome(); i++) internal.doBeat();
}

describe('六阶逐卡重做：真实投入与可区分结果', () => {
  it('佣兵买卖以净2金换一次攻转移，拒绝购买不能领成长', () => {
    const r = preparation(['s_fox']); r.draft = ['n_merc', '', '', '', ''];
    expect(takeDraft(r, 0, 1)).toBe('place');
    expect(r.gold).toBe(7); expect(r.slots[1]?.growth?.atk).toBe(1);
    expect(sell(r, 1)).toBe(true);
    expect(r.gold).toBe(8); expect(r.slots[0]?.growth?.atk).toBe(1);
    const before = JSON.stringify(r.slots);
    expect(takeDraft(r, 0, 1)).toBe('invalid'); expect(JSON.stringify(r.slots)).toBe(before);
  });

  it('角斗士培养撤销不领永久收益，净投入只在提交时兑现一次', () => {
    const r = preparation(['n_gladiator', 'l_mender']); r.stash.atk = 2;
    expect(allocPoint(r, 0, 'atk')).toBe(true); expect(undoAlloc(r)).toBe(true);
    commitPreparation(r); expect(r.slots[0]?.growth).toBeUndefined();
    r.prepCommitted = false;
    expect(allocPoint(r, 0, 'atk')).toBe(true); commitPreparation(r); commitPreparation(r);
    expect(r.slots[0]?.growth).toEqual({ atk: 1, hp: 3 });
  });

  it('连击教练结束备战只强化相邻连击者，备战席教练不能提供免费收益', () => {
    const r = preparation(['s_choreo']); r.draft = ['s_wind', 's_fox', '', '', ''];
    expect(takeDraft(r, 0, 1)).toBe('place'); expect(r.slots[1]?.growth).toBeUndefined();
    expect(takeDraft(r, 1, 2)).toBe('place'); commitPreparation(r); expect(r.slots[1]?.growth?.atk).toBe(2); expect(r.slots[2]?.growth).toBeUndefined();
    const off = preparation([]); off.bench[0] = owned('s_choreo', 10); off.draft = ['s_wind', '', '', '', ''];
    expect(takeDraft(off, 0, 0)).toBe('place'); commitPreparation(off); expect(off.slots[0]?.growth).toBeUndefined();
  });

  it('育魂者结束备战只培育相邻亡语，不能无限重复提交', () => {
    const r = preparation(['a_seed', 'a_brood', 'a_devour']);
    commitPreparation(r); commitPreparation(r);
    expect(r.slots[0]?.growth?.hp).toBe(1); expect(r.slots[2]?.growth).toBeUndefined();
  });

  it('碎石兵首击拆甲，熔岩巨蜥第二次行动释放；不再纯溅射换身材', () => {
    const breaker = battle([{ defId: 'n_breaker', hp: 100 }], [{ defId: 'e_golem', hp: 100, armor: 3, atk: 1 }]);
    step(breaker); expect(breaker.armor(breaker.units[1])).toBe(2);
    const rex = battle([{ defId: 'm_rex', hp: 100 }], [{ defId: 'e_golem', hp: 100, armor: 3, atk: 1 }, { defId: 'e_skel', hp: 100, atk: 1 }]);
    step(rex);
    expect(rex.log.some(x => x.ev.t === 'dmg' && x.ev.kind === 'splash')).toBe(false);
    for (let i = 0; i < 5 && !rex.metrics.charges; i++) step(rex);
    expect(rex.metrics.charges).toBe(1);
    expect(rex.log.some(x => x.ev.t === 'dmg' && x.ev.kind === 'splash')).toBe(true);
  });

  it('碎石兵反复打零甲不会积护甲债，巨犀之后蓄力获得的护甲仍有效', () => {
    const b = battle([{ defId: 'n_breaker', atk: 1, hp: 100 }], [{ defId: 'v_rhyno', armor: 0, atk: 1, hp: 100 }]);
    step(b, 2);
    expect(b.armor(b.units[1])).toBe(0);
    step(b);
    expect(b.armor(b.units[1])).toBe(1);
    expect(b.units[1].alive).toBe(true);
  });

  it('灵蛇接力产生亡语盾，沙丘接力产生轮换；后继者承担不同队形职责', () => {
    for (const id of ['a_seed', 'd_dune']) {
      const b = battle([{ defId: id, hp: 1 }, { defId: 'e_skel', hp: 100, atk: 1 }], [{ defId: 'e_skel', hp: 100, atk: 20 }]);
      step(b, 2);
      const token = b.units.find(u => u.summoned);
      expect(token).toBeDefined();
      const d = unitDef(token!.defId);
      expect(!!d.traits?.rotate).toBe(id === 'd_dune');
      expect(!!d.onRattle?.length).toBe(id === 'a_seed');
    }
  });

  it('飞镖手只施法两次，然后实际执行狙击普攻', () => {
    const b = battle([{ defId: 's_dart', hp: 1000 }], [{ defId: 'e_skel', hp: 1000, atk: 1 }]);
    step(b, 4);
    expect(b.metrics.casts).toBe(2);
    expect(b.log.some(x => x.ev.t === 'act' && x.ev.uid === 1 && x.ev.mode === 'attack')).toBe(true);
  });

  it('寒冬守望者响应真实冻结，同回合第二次冻结不再给挡，下回合重新可用', () => {
    const b = battle([{ defId: 'e_skel', hp: 1000, atk: 1 }, { defId: 'v_keeper', level: 3, hp: 1000, atk: 1 }], [{ defId: 'e_skel', hp: 1000, atk: 1 }, { defId: 'e_skel', hp: 1000, atk: 1 }]);
    for (const u of b.units.filter(u => u.side === 1)) b.chill(undefined, u, 1);
    step(b, 2);
    const freezeRewards = () => b.log.filter(x => x.ev.t === 'trigger' && x.ev.src === 2 && x.ev.kind === 'freeze');
    expect(b.metrics.freezes).toBe(2);
    expect(freezeRewards()).toHaveLength(1);
    expect(b.units[0].block).toBe(2); expect(b.units[1].block).toBe(0);
    for (const u of b.units.filter(u => u.side === 1)) b.chill(undefined, u, 1);
    step(b, 2);
    expect(b.metrics.freezes).toBe(4); expect(freezeRewards()).toHaveLength(2);
    expect(b.units[0].block).toBe(3);
  });

  it('寒冬守望者没有冻结就不补盾，也不再复制守誓者的跨战培养', () => {
    const b = battle([{ defId: 'v_keeper', hp: 100, atk: 1 }], [{ defId: 'e_skel', hp: 100, atk: 1 }]);
    step(b, 3);
    expect(b.log.some(x => x.ev.t === 'block' && x.ev.src === 1)).toBe(false);
    const keeper = preparation(['n_merc', 'v_keeper']); commitPreparation(keeper);
    expect(keeper.slots[0]?.growth).toBeUndefined();
    const vigil = preparation(['n_merc', 'l_vigil']); commitPreparation(vigil);
    expect(vigil.slots[0]?.growth).toEqual({ hp: 1 });
  });

});
