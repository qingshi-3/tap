import { describe, expect, it } from 'vitest';
import { Battle, FATIGUE_BEAT, MAX_BEATS, simulate } from '../src/core/engine';
import { DRAFT_POOL } from '../src/core/data';
import type { BattleEvent, BattleOutput, EnemyEntry, Slotted } from '../src/core/types';

let nextOwned = 1;
const P = (defId: string, level = 1): Slotted => ({ defId, ownedId: nextOwned++, copies: ([1, 2, 4] as const)[level - 1] });
const E = (defId: string, extra: Partial<EnemyEntry> = {}): EnemyEntry => ({ defId, ...extra });
const fill = <T>(a: (T | null)[]) => [...a, null, null, null, null, null].slice(0, 5);
const DUMMY = E('e_skel', { atk: 1, hp: 999 });
const play = (player: (Slotted | EnemyEntry | null)[], enemy: (EnemyEntry | null)[] = [DUMMY], general?: string) =>
  simulate({ player: fill(player), enemy: fill(enemy), general });
type Ev<T extends BattleEvent['t']> = Extract<BattleEvent, { t: T }>;
const evs = <T extends BattleEvent['t']>(o: BattleOutput | BattleOutput['log'], t: T): Ev<T>[] =>
  ('log' in o ? o.log : o).filter(l => l.ev.t === t).map(l => l.ev as Ev<T>);
const beatLog = (o: BattleOutput, n: number) => {
  const s = o.log.findIndex(l => l.ev.t === 'beat' && l.ev.n === n);
  const e = o.log.findIndex(l => l.ev.t === 'beat' && l.ev.n === n + 1);
  return o.log.slice(s, e < 0 ? undefined : e);
};
const uidOf = (o: BattleOutput, defId: string, side = 0) => o.initial.find(u => u.defId === defId && u.side === side)!.uid;

describe('轮转出手', () => {
  it('每拍从指针往后各出手一名，轮完回到队首', () => {
    const o = play([P('n_merc'), P('n_bulwark'), P('v_wall')]);
    const acts = [1, 2, 3, 4].map(n => evs(beatLog(o, n), 'act').find(a => a.side === 0)!.uid);
    expect(acts).toEqual([1, 2, 3, 1]);
  });
  it('拍事件预告下一轮双方出手顺序', () => {
    const o = play([P('n_merc'), P('n_bulwark')], [E('e_skel', { hp: 99 }), E('e_raider', { hp: 99 })]);
    expect(evs(beatLog(o, 2), 'beat')[0].next).toEqual({ player: [2, 1], enemy: [4, 3] });
  });
  it('阵亡留空格，后排不前移', () => {
    const o = play([E('e_skel', { hp: 1 }), P('n_bulwark')], [E('e_brute', { hp: 99 })]);
    const last = o.log.at(-1)!.snap.find(u => u.uid === 2)!;
    expect(last.slot).toBe(1);
  });
});

describe('先施法后普攻', () => {
  it('施法击杀对面出手者，它的普攻作废', () => {
    const o = play([P('a_devour')], [E('e_skel', { atk: 9, hp: 3 })]);
    expect(o.result).toBe('win');
    expect(evs(o, 'attack')).toHaveLength(0);
  });
  it('施法冻住对面出手者：寒意 ≥ 攻击则跳过，寒意清空', () => {
    const o = play([P('v_mage')], [E('e_skel', { atk: 3, hp: 99 })]);
    const enemy = uidOf(o, 'e_skel', 1);
    expect(evs(beatLog(o, 1), 'frozenSkip').map(e => e.uid)).toEqual([enemy]);
    expect(beatLog(o, 1).at(-1)!.snap.find(u => u.uid === enemy)!.chill).toBe(0);
  });
  it('施法没有有用目标时改为普攻', () => {
    const o = play([P('n_medic')]);
    expect(evs(beatLog(o, 1), 'act').find(a => a.side === 0)!.mode).toBe('attack');
  });
});

describe('格挡 / 护甲 / 灼烧', () => {
  it('格挡抵消一次伤害', () => {
    const o = play([P('n_merc')], [E('e_shield', { hp: 20 })]);
    const first = evs(o, 'dmg').find(d => d.kind === 'attack' && d.tgt === uidOf(o, 'e_shield', 1))!;
    expect(first).toMatchObject({ n: 0, blocked: true });
  });
  it('护甲减伤最少 1，灼烧无视护甲', () => {
    const a = play([E('e_skel', { atk: 2, hp: 99 })], [E('e_golem', { hp: 99 })]);
    expect(evs(a, 'dmg').find(d => d.kind === 'attack' && d.src === 1)!.n).toBe(1);
    const b = play([P('m_shaman')], [E('e_golem', { hp: 99 })]);
    expect(evs(beatLog(b, 1), 'dmg').find(d => d.kind === 'burn')!.n).toBe(3);
  });
  it('灼烧每拍结束后 −1 层', () => {
    const b = play([P('m_shaman')], [E('e_golem', { hp: 99 })]);
    const g = uidOf(b, 'e_golem', 1);
    expect(beatLog(b, 2)[0].snap.find(u => u.uid === g)!.burn).toBe(2);
  });
});

describe('连击 / 溅射 / 反击', () => {
  it('连击每段各吃一次反击', () => {
    const o = play([E('s_wind', { hp: 20 })], [E('e_thorn', { hp: 30 })]);
    expect(evs(beatLog(o, 1), 'dmg').filter(d => d.kind === 'thorns')).toHaveLength(2);
  });
  it('溅射不触发反击', () => {
    const o = play([P('m_rex')], [E('e_skel', { hp: 30 }), E('e_thorn', { hp: 30 })]);
    const log = beatLog(o, 1);
    expect(evs(log, 'dmg').some(d => d.kind === 'splash')).toBe(true);
    expect(evs(log, 'dmg').some(d => d.kind === 'thorns')).toBe(false);
  });
  it('寒意削减普攻并在出手后清空', () => {
    const b = new Battle({ player: fill([E('e_skel', { atk: 1, hp: 99 })]), enemy: fill([E('e_brute', { atk: 4, hp: 99 })]) });
    b.u(2).chill = 2;
    const o = b.run_();
    expect(evs(beatLog(o, 1), 'dmg').find(d => d.src === 2)!.n).toBe(2);
    expect(beatLog(o, 1).at(-1)!.snap[1].chill).toBe(0);
  });
});

describe('复生 / 放逐 / 立即出手 / 法强', () => {
  it('复生在原位以 1 生命复活', () => {
    const o = play([P('l_martyr')], [E('e_brute', { hp: 99 })]);
    expect(evs(o, 'revive').map(r => r.uid)).toContain(1);
  });
  it('被放逐者击杀不能复生', () => {
    const o = play([P('l_martyr')], [E('e_exile', { hp: 99 })]);
    expect(evs(o, 'revive')).toHaveLength(0);
    expect(evs(o, 'death')[0]).toMatchObject({ tgt: 1, exiled: true });
  });
  it('立即出手每方每拍最多 1 次，不能链式', () => {
    const o = play([P('s_dancer'), P('s_ninja')], [E('e_skel', { hp: 1 }), E('e_skel', { hp: 1 }), E('e_skel', { hp: 1 })]);
    const extras = evs(beatLog(o, 1), 'act').filter(a => a.mode === 'extra');
    expect(extras).toHaveLength(1);
    expect(extras[0].uid).toBe(2);
  });
  it('法强只加施法数值', () => {
    const cast = play([P('a_cult')], [E('e_skel', { hp: 99 })]);
    expect(evs(cast, 'dmg').find(d => d.kind === 'ability')!.n).toBe(3);
    const atk = play([P('n_merc'), P('n_obelisk')], [E('e_skel', { hp: 99 })]);
    expect(evs(atk, 'dmg').find(d => d.kind === 'attack' && d.src === 1)!.n).toBe(3);
  });
});

describe('传说与首领', () => {
  it('千刃宗师：友军每段普攻命中都追打队尾', () => {
    const o = play([P('s_wind'), P('s_master')], [E('e_skel', { hp: 99 }), E('e_skel', { hp: 99 })]);
    const m = uidOf(o, 's_master');
    expect(evs(beatLog(o, 1), 'trigger').filter(t => t.src === m)).toHaveLength(2);
    expect(o.triggers!.s_master).toBeGreaterThanOrEqual(8);
  });
  it('虚空领主每 3 拍把队尾拉到队首', () => {
    const o = play([P('n_bulwark'), P('v_wall'), P('l_vigil')], [E('e_void', { atk: 1, hp: 999 })]);
    const pull = evs(beatLog(o, 3), 'pull')[0];
    expect(pull.uid).toBe(3);
    expect(beatLog(o, 3).at(-1)!.snap.find(u => u.uid === 3)!.slot).toBe(0);
  });
});

describe('收束与安全', () => {
  it(`第 ${FATIGUE_BEAT} 拍起疲劳伤害，战斗在上限前结束`, () => {
    const o = play([E('e_golem', { atk: 1, hp: 150 })], [E('e_golem', { atk: 1, hp: 150 })]);
    expect(evs(o, 'dmg').some(d => d.kind === 'fatigue')).toBe(true);
    expect(o.beats).toBeLessThan(MAX_BEATS);
  });
  it('全卡池两两对战不触发故障', () => {
    const ids = DRAFT_POOL.map(d => d.id);
    for (let i = 0; i < ids.length; i++) {
      const a = ids.slice(i, i + 5).map(id => P(id, 1 + (i % 3)));
      const b = ids.slice((i + 17) % ids.length).concat(ids).slice(0, 5).map(id => E(id, { level: 2 }));
      const o = simulate({ player: fill(a), enemy: fill(b), record: false });
      expect(o.fault).toBeUndefined();
      expect(o.beats).toBeLessThanOrEqual(MAX_BEATS);
    }
  });
});
