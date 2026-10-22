import { describe, expect, it } from 'vitest';
import { simulate } from '../src/core/engine';
import type { BattleEvent, LoggedEvent } from '../src/core/types';

const team = [{ defId: 'n_bulwark', ownedId: 1, copies: 1 as const, train: { hp: 60 } }, { defId: 'n_merc', ownedId: 2, copies: 1 as const, train: { hp: 60 } }, { defId: 'n_archer', ownedId: 3, copies: 1 as const, train: { hp: 60 } }];
const foes = [{ defId: 'e_skel', atk: 1, hp: 80 }, { defId: 'e_skel', atk: 1, hp: 80 }, { defId: 'e_skel', atk: 1, hp: 80 }];
const run = (id: string, passives: string[] = []) => simulate({ player: team, enemy: foes, general: { id, power: 0, passives }, seed: 3 });
const sideOf = (l: LoggedEvent, uid: number) => l.snap.find(u => u.uid === uid)?.side;
const evs = <T extends BattleEvent['t']>(log: LoggedEvent[], t: T) => log.filter(l => l.ev.t === t) as (LoggedEvent & { ev: Extract<BattleEvent, { t: T }> })[];

describe('v0.8 修订：瓦尔坎/齐瑞克斯基础技能只作用于敌方', () => {
  it('火山战场只烧敌方；浴火才烧自己并加攻；熔岩护体给我方队首格挡', () => {
    const base = run('vulkan').log!;
    const burns = evs(base, 'burn').filter(l => l.ev.src === undefined);
    expect(burns.length).toBeGreaterThan(0);
    expect(burns.every(l => sideOf(l, l.ev.uid) === 1)).toBe(true);

    const fire = run('vulkan', ['vulkan_1']).log!;
    expect(evs(fire, 'burn').some(l => l.ev.src === undefined && sideOf(l, l.ev.uid) === 0)).toBe(true);
    expect(evs(fire, 'buff').some(l => sideOf(l, l.ev.tgt) === 0 && l.ev.atk === 1)).toBe(true);

    const guard = run('vulkan', ['vulkan_4']).log!;
    expect(evs(guard, 'block').some(l => l.ev.src === undefined && sideOf(l, l.ev.uid) === 0)).toBe(true);
    expect(evs(guard, 'burn').every(l => sideOf(l, l.ev.uid) === 1)).toBe(true);
  });

  it('星轨只换敌方；星痕给被换的敌人寒意；轨迹每次换位给全体友军 +1 攻', () => {
    const moveSides = (log: LoggedEvent[]) => evs(log, 'move').map(l => l.ev.side);
    const base = run('zirix').log!;
    expect(moveSides(base).length).toBeGreaterThan(0);
    expect(moveSides(base).every(s => s === 1)).toBe(true);

    const mark = run('zirix', ['zirix_1']).log!;
    const chills = evs(mark, 'chill').filter(l => l.ev.src === undefined);
    expect(chills.length).toBeGreaterThan(0);
    expect(chills.every(l => sideOf(l, l.ev.uid) === 1)).toBe(true);

    const trail = run('zirix', ['zirix_2']).log!;
    expect(moveSides(trail).every(s => s === 1)).toBe(true);
    const moves = moveSides(trail).length, gains = evs(trail, 'buff').filter(l => l.ev.src === undefined && sideOf(l, l.ev.tgt) === 0 && l.ev.atk === 1);
    expect(moves).toBeGreaterThan(0);
    expect(gains.length).toBeGreaterThan(0);
  });
});

describe('v0.8 机制替换：回马枪 / 纯色', () => {
  it('回马枪：轮转前离开队首的友军追击一次', () => {
    const acts = (log: LoggedEvent[]) => evs(log, 'act').filter(l => l.ev.mode === 'extra' && l.ev.side === 0).length;
    expect(acts(run('zilan').log!)).toBe(0);
    expect(acts(run('zilan', ['zilan_1']).log!)).toBeGreaterThan(0);
  });

  it('纯色：最多友军共有的关键词，带它的友军各 +(N+3)/+(N+3)', () => {
    const archers = [team[0], { ...team[2], ownedId: 4 }, { ...team[2], ownedId: 5 }];
    const log = simulate({ player: archers, enemy: foes, general: { id: 'kara', power: 0, passives: ['kara_1'] }, seed: 3 }).log!;
    const b = evs(log, 'buff').filter(l => l.ev.src === undefined && sideOf(l, l.ev.tgt) === 0);
    expect(b.length).toBeGreaterThanOrEqual(2);
    expect(b.every(l => l.ev.atk === b.length + 3 && l.ev.hp === b.length + 3)).toBe(true);
  });
});
