import { describe, expect, it } from 'vitest';
import { Battle, previewAttackTarget } from '../src/core/engine';
import { unitDef } from '../src/core/data';
import type { BattleSetup } from '../src/core/engine';
import type { EnemyEntry } from '../src/core/types';
const E = (defId = 'e_skel', extra: Partial<EnemyEntry> = {}): EnemyEntry => ({ defId, atk: 1, hp: 100, ...extra });
// Advance the real combat pipeline only as far as the behavior under inspection.
const step = (b: Battle, n = 1) => {
  const internal = b as unknown as { startPhase(): void; doBeat(): void };
  if (b.beat === 0) internal.startPhase();
  for (let i = 0; i < n && !b.outcome(); i++) internal.doBeat();
  return b;
};
const make = (player: BattleSetup['player'], enemy: BattleSetup['enemy'] = [E()], passives: string[] = [], id = 'reva') =>
  new Battle({ player, enemy, general: { id, power: 0, passives } });
const events = (b: Battle) => b.log.map(x => x.ev);
const damage = (b: Battle, uid = 1) => events(b).filter(e => e.t === 'dmg' && e.src === uid);

describe('平衡修订：统一施法与限次', () => {
  it.each([[], ['g_surge'], ['kaleos_2'], ['g_surge', 'kaleos_2']].map(passives => [passives] as const))('追加施法共享两次技能限额 %j', passives => {
    const b = step(make([E('s_dart')], [E()], passives, 'kaleos'), 5);
    expect(damage(b).filter(e => e.t === 'dmg' && e.kind === 'ability')).toHaveLength(2);
    expect(b.units[0].charges).toBe(0);
  });
  it('蓄力技能通知施法后，法涌复制同一技能且不递归', () => {
    const b = make([E('a_chanter'), E('v_sentinel')], [E()], ['g_surge']);
    b.units[0].charge = 2;
    step(b);
    expect(damage(b)).toHaveLength(2);
    expect(events(b).filter(e => e.t === 'trigger' && e.src === 2 && e.kind === 'afterCast')).toHaveLength(2);
    expect(b.metrics.casts).toBe(2);
  });
  it('余韵复制刚才蓄力技能，不改成普攻或普通施法', () => {
    const b = make([E('a_chanter')], [E()], ['kaleos_2'], 'kaleos');
    b.units[0].charge = 2; step(b);
    expect(damage(b)).toHaveLength(2);
    expect(damage(b).every(e => e.t === 'dmg' && e.kind === 'ability')).toBe(true);
    expect(b.metrics.casts).toBe(2);
  });
  it('光誓通知施法后，复制后仍使用主将治疗值', () => {
    const b = make([E('x_argeon'), E('v_sentinel')], [E()], ['argeon_3', 'g_surge'], 'argeon');
    b.units[0].hp -= 10; step(b);
    expect(events(b).filter(e => e.t === 'heal' && e.src === 1 && e.tgt === 1)).toHaveLength(2);
    expect(events(b).filter(e => e.t === 'trigger' && e.src === 2 && e.kind === 'afterCast')).toHaveLength(2);
  });
  it('蓄力普攻仍是普攻，不通知施法', () => {
    const b = make([E('v_rhyno'), E('v_sentinel')], [E()], ['g_surge']);
    b.units[0].charge = 3; step(b);
    expect(b.metrics.casts).toBe(0);
    expect(damage(b).some(e => e.t === 'dmg' && e.kind === 'attack')).toBe(true);
    expect(events(b).some(e => e.t === 'trigger' && e.kind === 'afterCast')).toBe(false);
  });
  it('法涌不突破效果级本场上限，显式三次召唤fixture仍各消耗一次', () => {
    const producer = unitDef('d_artificer'), receiver = unitDef('d_glass');
    const before = { uses: producer.castUses, cast: producer.cast, faint: producer.onAllyFaint, reaction: receiver.onAllySummon };
    try {
      producer.castUses = [3, 3, 3];
      producer.onAllyFaint = undefined;
      producer.cast = [{ op: 'summon', to: 'self', v: [2, 3, 4], v2: [2, 3, 4], token: 't_dervish' }];
      receiver.onAllySummon = [{ op: 'buff', to: 'self', v: [1, 1, 1], capBattle: [1, 1, 1] }];
      const b = make([E('d_artificer'), E('d_glass')], [E()], ['g_surge']);
      step(b, 10);
      expect(b.units.find(u => u.defId === 'd_glass')!.atk).toBe(2);
      expect(events(b).filter(e => e.t === 'summon' && e.src === 1)).toHaveLength(3);
      expect(b.units[0].charges).toBe(0);
    } finally { producer.castUses = before.uses; producer.cast = before.cast; producer.onAllyFaint = before.faint; receiver.onAllySummon = before.reaction; }
  });
});

describe('平衡修订：当前槽位决斗与实际目标', () => {
  it('决斗使用当前格位，优先于狙击，空位回队首', () => {
    const b = make([E(), E('s_backstab')], [E(), E(), E()]);
    const a = b.units[1], foes = b.units.filter(u => u.side === 1); a.grants.snipe = true;
    expect(previewAttackTarget(a, foes)?.uid).toBe(4);
    foes[1].alive = false;
    expect(previewAttackTarget(a, foes)?.uid).toBe(3);
    a.slot = 2;
    expect(previewAttackTarget(a, foes)?.uid).toBe(5);
    foes[0].grants.taunt = true;
    expect(previewAttackTarget(a, foes)?.uid).toBe(3);
  });
  it('一次连击目标死亡后不转火', () => {
    const b = step(make([E('s_wind', { atk: 10 })], [E('e_skel', { hp: 1 }), E()]));
    expect(damage(b).filter(e => e.t === 'dmg' && e.kind === 'attack')).toHaveLength(1);
    expect(b.units[2].hp).toBe(100);
  });
  it('击败嘲讽拦截者触发决斗收益，独立追击重新选目标', () => {
    const b = step(make([null, E('s_backstab', { atk: 10 })], [E('v_wall', { hp: 1 }), E()]));
    expect(events(b).some(e => e.t === 'trigger' && e.src === 1 && e.kind === 'duelKill')).toBe(true);
    expect(events(b).some(e => e.t === 'act' && e.uid === 1 && e.mode === 'extra')).toBe(true);
    expect(damage(b).some(e => e.t === 'dmg' && e.tgt === 3 && e.kind === 'attack')).toBe(true);
  });
  it('对手削弱施加到实际嘲讽目标', () => {
    const b = step(make([null, E('s_fox')], [E('v_wall'), E()]));
    expect(events(b).some(e => e.t === 'buff' && e.src === 1 && e.tgt === 2 && e.atk < 0)).toBe(true);
  });
  it('溅射旁伤和技能击杀不计击败对手', () => {
    const b = make([E('n_breaker', { atk: 10 })], [E(), E('e_skel', { hp: 1 })]);
    step(b); expect(b.metrics.duelKills).toBe(0);
    const c = step(make([E('a_devour')], [E('e_skel', { hp: 1 })]));
    expect(c.metrics.duelKills).toBe(0);
  });
  it('赤蛇在实际锁定的嘲讽目标死亡后追击', () => {
    const b = step(make([null, E('s_viper', {atk:10})], [E('v_wall', {hp:1}), E()]));
    expect(events(b).filter(e => e.t === 'act' && e.uid === 1 && e.mode === 'extra')).toHaveLength(1);
    expect(damage(b).some(e => e.t === 'dmg' && e.tgt === 2)).toBe(true);
  });
  it('蕾娃开战换位后决斗采用换后当前格位', () => {
    const b = new Battle({ player:[E(), E('s_backstab')], enemy:[E(),E(),E()], general:{id:'reva',power:0,passives:[]},swaps:[[0,1]] });
    step(b,2);
    const attack = events(b).filter(e => e.t === 'attack').find(e => e.t === 'attack' && e.pairs.some(p => p.atk===2));
    expect(attack).toMatchObject({pairs:expect.arrayContaining([{atk:2,tgt:3}])});
  });
  it('岚刃每段对有护甲目标追加伤害', () => {
    const armored = step(make([E('s_xyle', { atk: 4 })], [E('e_skel', { armor: 1 })]));
    const plain = step(make([E('s_xyle', { atk: 4 })], [E('e_skel', { armor: 0 })]));
    expect(damage(armored).map(e => e.t === 'dmg' ? e.n : 0)).toEqual([3, 3]);
    expect(damage(plain).map(e => e.t === 'dmg' ? e.n : 0)).toEqual([2, 2]);
  });
  it.each([0, 1, -3])('关卡护甲覆盖初始化和实时一致 %i', armor => {
    const b = make([E()], [E('n_bulwark', { armor })]);
    const u = b.units[1];
    expect(u.armor).toBe(Math.max(0, armor)); expect(b.armor(u)).toBe(Math.max(0, armor));
  });
});

describe('平衡修订：主将组合', () => {
  it('早孵与硬壳对已孵化龙生效，蛋规则保留', () => {
    const b = make([E('x_bone'), E('x_egg')], [E()], ['xingjiao_1', 'xingjiao_4'], 'xingjiao');
    // Explicit encounter stats above are overridden after general preparation; use normal entries here.
    const normal = new Battle({ player: [{defId:'x_bone'}, {defId:'x_egg'}], enemy:[E()], general:{id:'xingjiao',power:0,passives:['xingjiao_1','xingjiao_4']} });
    expect(normal.units[0].atk).toBe(unitDef('x_bone').atk+1);
    expect(normal.units[0].maxHp).toBe(unitDef('x_bone').hp+2);
    expect(normal.armor(normal.units[0])).toBe(1);
    expect(normal.armor(normal.units[1])).toBe(2);
    expect(b.hasTrait(b.units[1], 'taunt')).toBe(true);
  });
  it('纯色不会屏蔽达标分光的全队法强', () => {
    const b = make([E('s_backstab'), E('s_fox'), E('n_merc')], [E()], ['kara_1','kara_3'], 'kara');
    Object.assign(b.units[0].grants, { combo:true, snipe:true, taunt:true, reborn:true, splash:true, rotate:true });
    step(b);
    expect(b.units.map(u => u.side === 0 ? u.grants.power : 0).slice(0,3)).toEqual([1,1,1]);
    expect(b.units[2].maxHp).toBe(100);
  });
  it('纯色与折射组合保留攻击、替生命为队首格挡', () => {
    const b = step(make([E('s_backstab'), E('s_fox')], [E()], ['kara_1','kara_2'], 'kara'));
    expect(b.units[0].maxHp).toBe(100); expect(b.units[1].maxHp).toBe(100);
    expect(b.units[0].atk).toBeGreaterThanOrEqual(6);
    expect(events(b).some(e => e.t === 'block' && e.uid === 1 && e.n === 3)).toBe(true);
  });
});

describe('余韵失败语义与目标死亡边界', () => {
  it('末次正常施法耗尽后不追加施法也不退为追击', () => {
    const b = make([E('d_dunecaster')], [E()], ['kaleos_2'], 'kaleos');
    b.units[0].charges = 1; step(b);
    expect(events(b).filter(e => e.t === 'summon' && e.src === 1)).toHaveLength(1);
    expect(events(b).filter(e => e.t === 'act' && e.uid === 1 && e.mode === 'extra')).toHaveLength(0);
  });
  it('正常治疗填满后余韵无目标，不退为追击', () => {
    const b = make([E('l_priest')], [E('t_statue')], ['kaleos_2'], 'kaleos');
    b.units[0].hp -= 1; step(b);
    expect(events(b).filter(e => e.t === 'heal' && e.src === 1)).toHaveLength(1);
    expect(events(b).filter(e => e.t === 'act' && e.uid === 1 && e.mode === 'extra')).toHaveLength(0);
  });
  it('实际普攻的余韵主将仍按压轴追击', () => {
    const b = step(make([E('n_merc')], [E()], ['kaleos_2'], 'kaleos'));
    expect(events(b).filter(e => e.t === 'act' && e.uid === 1 && e.mode === 'extra')).toHaveLength(1);
  });
  it('赤蛇目标复生时，阵亡事实触发一次追击并重选复生目标', () => {
    const b = step(make([E('s_viper', {atk:10})], [E('a_spine', {hp:1}), E()]));
    expect(events(b).some(e => e.t === 'revive' && e.uid === 2)).toBe(true);
    expect(events(b).filter(e => e.t === 'act' && e.uid === 1 && e.mode === 'extra')).toHaveLength(1);
    expect(damage(b).filter(e => e.t === 'dmg' && e.kind === 'attack' && e.tgt === 2)).toHaveLength(2);
  });
  it('双方同时阵亡时死亡事实仍计直接击杀，但死亡赤蛇不追击', () => {
    const b = step(make([E('s_viper', {atk:10,hp:1})], [E('e_skel', {atk:10,hp:1})]));
    expect(b.units[0].alive).toBe(false); expect(b.units[1].alive).toBe(false);
    expect(b.metrics.duelKills).toBe(1);
    expect(events(b).filter(e => e.t === 'act' && e.uid === 1 && e.mode === 'extra')).toHaveLength(0);
  });
});

describe('可配对评估的主将数值候选', () => {
  it('亲征一章仍3/8，二章5/12、三章7/16', () => {
    for (const [chapter, atk, hp] of [[1,3,8],[2,5,12],[3,7,16]]) {
      const b = new Battle({player:[{defId:'x_argeon'}],enemy:[E()],chapter,general:{id:'argeon',power:0,passives:[]}});
      expect(b.units[0]).toMatchObject({atk,maxHp:hp});
    }
  });
  it.each([[1,[],0],[2,[],0],[3,[],3],[1,['faie_2'],0],[2,['faie_2'],0],[3,['faie_2'],1],[4,['faie_2'],3]] as const)('法伊第%i回合延后目标符合先机/长冬窗口', (round, passives, ready) => {
    const b = make([E()], [E(),E(),E()], [...passives], 'faie'); b.round = round; step(b);
    const beat = events(b).find(e => e.t === 'beat');
    expect(beat?.t === 'beat' ? beat.next.enemy.length : -1).toBe(ready);
  });
  it.each([[2,[],true],[3,[],false],[3,['faie_2'],true],[4,['faie_2'],false]] as const)('凝滞先机窗口第%i回合一致', (round, passives, active) => {
    const b = make([E()], [E()], ['faie_1',...passives], 'faie'); b.round=round;
    b.hit(b.units[0], b.units[1],1,'attack');
    expect(b.units[1].chill).toBe(active ? 2 : 0);
  });
  it('纯色四名同关键词时攻血最多+6', () => {
    const b = make([E('s_backstab'),E('s_fox'),E('s_viper'),E('s_monk')], [E()], ['kara_1'], 'kara'); step(b);
    expect(b.units.slice(0,4).map(u=>u.maxHp)).toEqual([106,106,106,106]);
  });
  it('熔岩护体只在第2、4回合结束发格挡', () => {
    const b = make([E()], [E('e_skel',{hp:1000})], ['vulkan_4'], 'vulkan');
    step(b,2);
    expect(events(b).filter(e=>e.t==='block')).toHaveLength(0);
    step(b);
    expect(events(b).filter(e=>e.t==='block')).toHaveLength(1);
    step(b,2);
    expect(events(b).filter(e=>e.t==='block')).toHaveLength(2);
  });
});
