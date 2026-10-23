import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import { unitDef } from '../src/core/data';
import type { BattleSetup } from '../src/core/engine';
import type { Effect, UnitState } from '../src/core/types';

const E = (defId = 'e_skel', extra = {}) => ({ defId, atk: 1, hp: 1000, ...extra });
const make = (id: string, passives: string[], player: BattleSetup['player'], enemy: BattleSetup['enemy'] = [E()], rest: Partial<BattleSetup> = {}) =>
  new Battle({ player, enemy, general: { id, power: 0, passives }, ...rest });
interface Internal {
  startPhase(): void; doBeat(): void; flush(): void;
  apply(u: UnitState, effects: Effect[], ctx: object): boolean;
  grant(src: UnitState | undefined, t: UnitState, grant: string, n: number): void;
  addCharge(src: UnitState | undefined, t: UnitState, n: number): void;
  reviveUnit(u: UnitState): boolean;
  summon(src: UnitState | undefined, side: 0 | 1, origin: number, token: string, atk: number, hp: number): UnitState | null;
}
const internal = (b: Battle) => b as unknown as Internal;
const events = (b: Battle) => b.log.map(x => x.ev);
function step(b: Battle, n = 1) {
  if (!b.beat) internal(b).startPhase();
  for (let i = 0; i < n && !b.outcome(); i++) internal(b).doBeat();
  return b;
}
const gens = (b: Battle, name: string) => events(b).filter(e => e.t === 'gen' && e.label === name);

describe('莉莉丝：替代分支并行与死亡归属', () => {
  it('每3魂收割和魂火各一次，收割产生的新死亡不重复计魂', () => {
    const b = make('lilithe', ['lilithe_1', 'lilithe_2'], [E('a_chanter')], [E('e_skel', { hp: 1 }), E('e_skel', { hp: 1 }), E('e_skel', { hp: 1 }), E('e_skel', { hp: 4 })]);
    b.units[0].charge = 2; step(b);
    expect(events(b).filter(e => e.t === 'death')).toHaveLength(4);
    expect(gens(b, '收割')).toHaveLength(1);
    expect(gens(b, '魂火')).toHaveLength(1);
    expect(gens(b, '魂潮')).toHaveLength(0);
    expect(b.metrics.summons).toBe(1);
    expect(b.units[0].atk).toBe(1);
  });

  it('冥约独立执行且全场最多复活2次', () => {
    const b = make('lilithe', ['lilithe_1', 'lilithe_2', 'lilithe_4'], [E(), E(), E()], [E(), E(), E(), E(), E()]);
    internal(b).startPhase();
    const kill = (uids: number[]) => {
      for (const uid of uids) b.hit(undefined, b.u(uid), 10000, 'ability');
      internal(b).flush();
    };
    kill([2, 3, 4]);
    expect(gens(b, '冥约')).toHaveLength(1);
    kill([2, 5, 6]);
    expect(gens(b, '冥约')).toHaveLength(2);
    kill([3, 7, 8]);
    expect(gens(b, '冥约')).toHaveLength(2);
    // 第三次魂爆发时敌人已经全灭，没有收割目标，但魂火仍独立执行。
    expect(gens(b, '收割')).toHaveLength(2);
    expect(gens(b, '魂火')).toHaveLength(3);
  });
});

describe('法伊：后发只替换首回合', () => {
  it('真实连续推进到第三回合，撤销后发临时攻并恢复长冬/凝滞/冰封', () => {
    const b = make('faie', ['faie_3', 'faie_2', 'faie_1', 'faie_4'], [E('a_chanter'), E()], [E('e_skel', { atk: 10 }), E('e_skel', { atk: 10 }), E('e_skel', { atk: 10 })]);
    for (let guard = 0; b.round <= 3 && guard < 24; guard++) step(b);
    expect(b.round).toBe(4);
    const firstBeat = (round: number) => b.log.find(x => x.ev.t === 'beat' && x.ev.round === round)!;
    expect(firstBeat(1).snap[0].atk).toBe(4);
    expect(firstBeat(2).snap[0].atk).toBe(1);
    expect(firstBeat(3).snap[0].atk).toBe(1);
    expect(firstBeat(1).ev).toMatchObject({ next: { player: [], enemy: [3, 4, 5] } });
    expect(firstBeat(2).ev).toMatchObject({ next: { player: [1, 2], enemy: [] } });
    expect(firstBeat(3).ev).toMatchObject({ next: { player: [1, 2], enemy: [3] } });
    expect(firstBeat(2).snap[0].charge).toBe(1);
    expect(firstBeat(3).snap[0].charge).toBe(0);
    let round = 0;
    const chills: number[] = [], releases: number[] = [];
    for (const { ev } of b.log) {
      if (ev.t === 'beat') round = ev.round!;
      if (ev.t === 'chill' && ev.src === undefined) chills.push(round);
      if (ev.t === 'act' && ev.uid === 1 && ev.mode === 'charge') releases.push(round);
    }
    expect(chills).not.toContain(1);
    expect(chills).toContain(2); expect(chills).toContain(3);
    expect(releases[0]).toBe(2);
  });
  it.each([1, 2, 3, 4])('第%i回合后发/先机/长冬及凝滞窗口一致', round => {
    const b = make('faie', ['faie_3', 'faie_2', 'faie_1'], [E()], [E(), E(), E()]);
    b.round = round; step(b);
    const beat = events(b).find(e => e.t === 'beat');
    expect(beat?.t === 'beat' ? beat.next.enemy.length : -1).toBe(round === 2 ? 0 : round === 3 ? 1 : 3);
    const chill = b.units[1].chill;
    b.hit(b.units[0], b.units[1], 1, 'attack');
    expect(b.units[1].chill - chill).toBe(round === 2 || round === 3 ? 2 : 0);
  });

  it.each([1, 2, 3])('后发第%i回合冰封时刻只在真实先机窗增加蓄力', round => {
    const b = make('faie', ['faie_3', 'faie_2', 'faie_4'], [E('a_chanter')]);
    b.round = round; step(b, round === 1 ? 2 : 1);
    expect(b.units[0].charge).toBe(round === 1 ? 1 : 2);
  });
});

describe('萨吉：收容到入场只有一次召唤事实', () => {
  it('普通召唤满员可收容，预备期不计召唤；入场才触发附加收益，复活不重复', () => {
    // Explicit former two-use summon payload isolates the generic shelter contract.
    const def = unitDef('d_artificer'), saved = { cast: def.cast, castUses: def.castUses, onAllyFaint: def.onAllyFaint };
    try {
    def.cast = [{ op: 'summon', to: 'self', v: [2,3,4], v2: [2,3,4], token: 't_dervish' }];
    def.castUses = [2,2,2]; def.onAllyFaint = undefined;
    const b = make('sajj', ['sajj_4', 'g_horde', 'g_surge'], [E('d_artificer'), E('d_glass'), E('m_incubator'), E('n_bulwark'), E('n_archer')]);
    expect(b.canCast(b.units[0])).toBe(true);
    step(b);
    const token = b.units.find(u => u.reserve && u.summoned)!;
    expect(token).toBeTruthy();
    expect(b.metrics.casts).toBe(1);
    expect(b.units[0].charges).toBe(1);
    expect(b.canCast(b.units[0])).toBe(false);
    expect(b.metrics.summons).toBe(0);
    expect(b.eggStats.summon).toBe(0);
    expect(b.units[1].atk).toBe(1);
    expect(events(b).filter(e => e.t === 'summon' && e.uid === token.uid)).toHaveLength(0);
    b.hit(undefined, b.units[3], 10000, 'ability'); internal(b).flush();
    expect(token.reserve).toBe(false);
    expect(token).toMatchObject({ atk: 4, hp: 4, actionsLeft: 1 });
    expect(b.metrics.summons).toBe(1); expect(b.eggStats.summon).toBe(1);
    expect(b.units[1].atk).toBe(2);
    expect(events(b).filter(e => e.t === 'summon' && e.uid === token.uid)).toHaveLength(1);
    internal(b).flush();
    b.hit(undefined, token, 10000, 'ability'); internal(b).flush();
    expect(internal(b).reviveUnit(token)).toBe(true); internal(b).flush();
    expect(b.metrics.summons).toBe(1);
    expect(b.units[1].atk).toBe(2);    } finally { Object.assign(def, saved); }
  });

  it('普通初始预备补位不广播召唤词条，也不获得召唤附加身材', () => {
    const b = make('sajj', ['g_horde'], [E('n_bulwark'), E('d_glass'), E(), E(), E()], [E()], { reserve: [{ defId: 'n_archer' }] });
    const reserve = b.units.find(u => u.reserve)!;
    internal(b).startPhase();
    b.hit(undefined, b.units[0], 10000, 'ability'); internal(b).flush();
    expect(reserve.reserve).toBe(false);
    expect(reserve.atk).toBe(3);
    expect(b.metrics.summons).toBe(0);
    expect(b.eggStats.summon).toBe(0);
    expect(b.units[1].atk).toBe(1);
  });

  it('沙嚎亡语双召共用预备容量，不会重复收容同一个实体', () => {
    const b = make('sajj', ['sajj_4', 'g_surge'], [E('d_howler'), E('d_glass'), E(), E(), E()]);
    internal(b).startPhase();
    b.hit(undefined, b.units[0], 10000, 'fatigue'); internal(b).flush();
    expect(b.units.filter(u => u.reserve && u.summoned)).toHaveLength(1);
    expect(gens(b, '收容')).toHaveLength(1);
    expect(b.metrics.summons).toBe(1);
    b.hit(undefined, b.units[2], 10000, 'ability'); internal(b).flush();
    expect(b.metrics.summons).toBe(2);
    expect(b.units[1].atk).toBe(3);
  });

  it('无来源收容的idle单位补位后仍不会进入行动队列', () => {
    const b = make('sajj', ['sajj_4'], [E(), E(), E(), E(), E()]);
    internal(b).startPhase(); internal(b).summon(undefined, 0, -1, 'x_egg', 0, 6);
    const idle = b.units.find(u => u.reserve)!;
    b.hit(undefined, b.units[2], 10000, 'ability'); internal(b).flush();
    expect(idle.reserve).toBe(false);
    expect(b.order(0).some(u => u.uid === idle.uid)).toBe(false);
    step(b, 3);
    expect(events(b).some(e => e.t === 'act' && e.uid === idle.uid)).toBe(false);
    expect(b.metrics.summons).toBe(1);
  });
});

describe('蕾娃：孤立只拒绝其他同侧实体的增益', () => {
  const isolated = () => make('reva', ['reva_4'], [E()], [E('a_chanter'), E('l_archon', { level: 2 }), E('n_merc')], { swaps: [[0, 2]] });
  it('开战群体复生和格挡不再绕过孤立，自身授予仍保留', () => {
    const b = isolated(); internal(b).startPhase();
    const t = b.units[1], source = b.units[2];
    expect(b.hasTrait(t, 'reborn')).toBe(false); expect(t.block).toBe(0);
    expect(b.hasTrait(source, 'reborn')).toBe(true); expect(source.block).toBe(1);
    expect(b.power(t)).toBe(2);
  });

  it('其他友军治疗、属性、授予、充能、额外行动及追击均被挡；self与无来源保留', () => {
    const b = isolated(); internal(b).startPhase();
    const t = b.units[1], source = b.units[2]; t.hp -= 5;
    const before = { hp: t.hp, atk: t.atk, actions: t.actionsLeft, charge: t.charge };
    const effects: Effect[] = [
      { op: 'heal', to: 'rear', v: [3, 3, 3] }, { op: 'buff', to: 'rear', v: [2, 2, 2], v2: [2, 2, 2] },
      { op: 'block', to: 'rear', v: [1, 1, 1] }, { op: 'grant', to: 'rear', grant: 'combo', v: [1, 1, 1] },
      { op: 'grant', to: 'rear', grant: 'power', v: [1, 1, 1] }, { op: 'charge', to: 'rear', v: [1, 1, 1] },
      { op: 'addAction', to: 'rear', v: [1, 1, 1] }, { op: 'extraAct', to: 'rear', v: [1, 1, 1] },
    ];
    expect(internal(b).apply(source, effects, {})).toBe(false); internal(b).flush();
    expect({ hp: t.hp, atk: t.atk, actions: t.actionsLeft, charge: t.charge }).toEqual(before);
    expect(t.block).toBe(0); expect(t.grants.combo).not.toBe(true); expect(t.grants.power ?? 0).toBe(0);
    expect(events(b).some(e => e.t === 'act' && e.uid === t.uid && e.mode === 'extra')).toBe(false);
    b.buff(source, t, -1, 2); expect(t.atk).toBe(Math.max(1, before.atk - 1)); expect(t.hp).toBe(before.hp);
    b.heal(t, t, 2); b.block(t, t, 1); internal(b).grant(t, t, 'combo', 1); internal(b).addCharge(t, t, 1); b.addAction(t, t, 1);
    expect(t.hp).toBe(before.hp + 2); expect(t.block).toBe(1); expect(t.grants.combo).toBe(true); expect(t.charge).toBe(1); expect(t.actionsLeft).toBe((before.actions ?? 0) + 1);
    b.buff(undefined, t, 2, 2); b.block(undefined, t, 1); internal(b).grant(undefined, t, 'power', 1);
    expect(t.hp).toBe(before.hp + 4); expect(t.block).toBe(2); expect(t.grants.power).toBe(1);
    internal(b).grant(t, t, 'armor', 2);
    internal(b).grant(source, t, 'armor', -1);
    expect(b.armor(t)).toBe(1);
    expect(internal(b).apply(t, [{ op: 'extraAct', to: 'self', v: [0, 0, 0] }], {})).toBe(true);
    expect(events(b).some(e => e.t === 'act' && e.uid === t.uid && e.mode === 'extra')).toBe(true);
  });

  it.each(['v_conduit', 'a_brood', 'n_obelisk', 'd_hourglass'])('隔离动态相邻光环fixture %s，但保留固有法强/蓄力', aura => {
    // Three production cards moved to preparation roles. Keep the engine isolation regression
    // explicit and local, with a non-isolated control proving the fixture actually grants an aura.
    const def = unitDef(aura), prior = { special: def.special, values: def.values };
    try {
      def.special = { v_conduit: 'conduit', a_brood: 'brood', n_obelisk: 'nobelisk', d_hourglass: 'hourglass' }[aura];
      def.values = [2, 2, 2];
      const control = make('reva', [], [E()], [E(), E(aura), E('a_chanter')]);
      if (aura === 'v_conduit') expect(control.armor(control.units[3])).toBe(2);
      if (aura === 'a_brood' || aura === 'n_obelisk') expect(control.power(control.units[3])).toBe(4);
      const b = make('reva', ['reva_4'], [E()], [E('a_chanter'), E(aura), E()], { swaps: [[0, 2]] });
      const t = b.units[1];
      expect(b.armor(t)).toBe(0); expect(b.power(t)).toBe(2);
      step(b, 3);
      const gain = events(b).filter(e => e.t === 'charge' && e.uid === t.uid);
      expect(gain).toHaveLength(1);
      expect(gain.every(e => e.t === 'charge' && e.n === 1)).toBe(true);
      expect(t.chargeMax).toBe(2);
      if (aura === 'd_hourglass') {
        step(control, 3);
        expect(events(control).filter(e => e.t === 'charge' && e.uid === 4).length).toBeGreaterThan(gain.length);
      }
    } finally { Object.assign(def, prior); }
  });

  it('孤立不阻止复活，也不抹掉固有词条', () => {
    const b = isolated(); internal(b).startPhase(); const target = b.units[1];
    b.hit(b.units[0], target, 10000, 'ability'); internal(b).flush();
    expect(internal(b).reviveUnit(target)).toBe(true); internal(b).flush();
    expect(target.alive).toBe(true); expect(b.power(target)).toBe(2);
  });
});

describe('卡拉：共鸣让纯色按双方持词人数选择', () => {
  it('一个友军加一个敌人持同词也达门槛，仅强化友军', () => {
    const b = make('kara', ['kara_1', 'kara_4'], [E('n_bulwark'), E('n_archer')], [E('n_bulwark')]);
    internal(b).startPhase();
    expect(b.units[0].maxHp).toBe(1005); expect(b.units[1].maxHp).toBe(1000); expect(b.units[2].maxHp).toBe(1000);
  });
  it('同总数优先己方持有者更多，仍封顶6', () => {
    const b = make('kara', ['kara_1', 'kara_4'], [E('n_bulwark'), E('n_archer'), E('n_archer')], [E('n_bulwark'), E('n_bulwark'), E('n_archer')]);
    internal(b).startPhase();
    expect(b.units.slice(0, 3).map(u => u.maxHp)).toEqual([1000, 1006, 1006]);
  });
  it('同总数同友军数保持原先词序，无共鸣不统计敌人', () => {
    for (const resonance of [false, true]) {
      const b = make('kara', ['kara_1', ...(resonance ? ['kara_4'] : [])], [E('n_bulwark'), E('n_archer')], [E('n_bulwark'), E('n_archer')]);
      internal(b).startPhase();
      expect(b.units.slice(0, 2).map(u => u.maxHp)).toEqual(resonance ? [1005, 1000] : [1000, 1000]);
    }
  });
});

describe('瓦尔坎：扩散支持队尾与复生', () => {
  it.each([false, true])('尾兵死亡复生%s时扩散给其他同侧队首，绝不回到死者', reborn => {
    const b = make('vulkan', ['vulkan_2', 'vulkan_3'], [E()], [E(), E(reborn ? 'a_spine' : 'e_skel')]);
    internal(b).startPhase(); const tail = b.units[2];
    b.burn(undefined, tail, 5); b.hit(b.units[0], tail, 10000, 'ability'); internal(b).flush();
    expect(b.units[1].burn).toBe(5); expect(tail.burn).toBe(0);
    expect(tail.alive).toBe(reborn);
  });
});

describe('卡雷奥斯：影步兼容成功的追加技能', () => {
  it('余韵成功追加后只交换一次，法涌追加不能再递归', () => {
    const b = make('kaleos', ['kaleos_2', 'kaleos_4', 'g_surge'], [E(), E('a_devour')]);
    step(b, 2);
    expect(b.units[1].slot).toBe(0); expect(b.units[0].slot).toBe(1);
    expect(b.metrics.casts).toBe(3); expect(gens(b, '影步')).toHaveLength(1);
  });
  it('末次施法余韵无次数，不移动也不退为追击', () => {
    const b = make('kaleos', ['kaleos_2', 'kaleos_4'], [E(), E('d_dunecaster')]); b.units[1].charges = 1;
    step(b, 2);
    expect(b.units[1].slot).toBe(1); expect(gens(b, '影步')).toHaveLength(0);
    expect(events(b).some(e => e.t === 'act' && e.uid === 2 && e.mode === 'extra')).toBe(false);
  });
});
