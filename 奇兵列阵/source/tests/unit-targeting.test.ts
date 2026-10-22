import { describe, expect, it } from 'vitest';
import { simulate } from '../src/core/engine';
import { unitDef } from '../src/core/data';
import type { BattleOutput, EnemyEntry } from '../src/core/types';

const play = (player: EnemyEntry[], enemy: EnemyEntry[], surge = false) => simulate({
  player: [...player, null, null, null, null].slice(0, 5),
  enemy: [...enemy, null, null, null, null].slice(0, 5),
  general: surge ? { id: 'argeon', power: 0, passives: ['g_surge'] } : undefined,
});
const firstBeat = (out: BattleOutput) => {
  const end = out.log.findIndex(x => x.ev.t === 'beat' && x.ev.n === 2);
  return out.log.slice(0, end < 0 ? undefined : end);
};
const enemy = (atk: number, hp: number): EnemyEntry => ({ defId: 'e_skel', atk, hp });

describe('单次关联技能目标锁定', () => {
  it('四风术士杀死原目标后不向其他敌人转移攻击削弱', () => {
    const out = play([{ defId: 's_caster', hp: 99 }], [enemy(9, 4), enemy(8, 99)]);
    expect(firstBeat(out).map(x => x.ev)).toContainEqual({ t: 'dmg', src: 1, tgt: 2, n: 4, kind: 'ability' });
    expect(firstBeat(out).some(x => x.ev.t === 'buff' && x.ev.src === 1)).toBe(false);
  });

  it('四风术士未击杀时伤害与削弱落在同一目标', () => {
    const out = play([{ defId: 's_caster', hp: 99 }], [enemy(9, 30), enemy(8, 99)]);
    const log = firstBeat(out).map(x => x.ev);
    expect(log).toContainEqual({ t: 'dmg', src: 1, tgt: 2, n: 4, kind: 'ability' });
    expect(log).toContainEqual({ t: 'buff', src: 1, tgt: 2, atk: -1, hp: 0 });
    expect(log.some(ev => ev.t === 'buff' && ev.src === 1 && ev.tgt === 3)).toBe(false);
  });

  it('落日灵驹在任何增益前分别选择最高攻击与最高生命', () => {
    const out = play([{ defId: 'n_paragon', atk: 1, hp: 1 }, enemy(9, 10), enemy(1, 11)], [enemy(1, 999)]);
    expect(out.afterStart[1]).toMatchObject({ atk: 11, hp: 12 });
    expect(out.afterStart[2]).toMatchObject({ atk: 3, hp: 13 });
  });

  it('原本同时最高攻和最高血的同一友军得到两次增益', () => {
    const out = play([{ defId: 'n_paragon', atk: 1, hp: 1 }, enemy(9, 12), enemy(1, 11)], [enemy(1, 999)]);
    expect(out.afterStart[1]).toMatchObject({ atk: 13, hp: 16 });
    expect(out.afterStart[2]).toMatchObject({ atk: 1, hp: 11 });
  });

  it('嘲讽不改变技能目标，锁定探测不发嘲讽事件', () => {
    const out = play([{ defId: 's_caster', hp: 99 }], [{ defId: 'l_cliff', atk: 1, hp: 20 }, enemy(9, 30)]);
    const log = firstBeat(out);
    expect(log.some(x => x.ev.t === 'taunt')).toBe(false);
    expect(log.map(x => x.ev)).toContainEqual({ t: 'dmg', src: 1, tgt: 3, n: 4, kind: 'ability' });
    expect(log.map(x => x.ev)).toContainEqual({ t: 'buff', src: 1, tgt: 3, atk: -1, hp: 0 });
    expect(log.some(x => x.ev.t === 'dmg' && x.ev.src === 1 && x.ev.tgt === 2)).toBe(false);
  });

  it('法涌免费复制单独重新锁定，不跨本次技能缓存目标', () => {
    const out = play([{ defId: 's_caster', hp: 99 }], [enemy(9, 4), enemy(8, 99)], true);
    const log = firstBeat(out);
    expect(log.filter(x => x.ev.t === 'dmg' && x.ev.src === 1).map(x => x.ev)).toMatchObject([
      { tgt: 2, n: 4 }, { tgt: 3, n: 4 },
    ]);
    expect(log.filter(x => x.ev.t === 'buff' && x.ev.src === 1).map(x => x.ev)).toMatchObject([{ tgt: 3, atk: -1 }]);
    expect(log.filter(x => x.ev.t === 'act' && x.ev.uid === 1 && x.ev.mode === 'cast')).toHaveLength(1);
  });

  it('未开启锁定的定义保持原来逐效果重选语义', () => {
    const def = unitDef('s_caster'), prior = def.lockTargets;
    try {
      def.lockTargets = false;
      const out = play([{ defId: 's_caster', hp: 99 }], [enemy(9, 4), enemy(8, 99)]);
      expect(firstBeat(out).map(x => x.ev)).toContainEqual({ t: 'buff', src: 1, tgt: 3, atk: -1, hp: 0 });
    } finally { def.lockTargets = prior; }
  });

  it('后续施法和下一场分别重新选目标', () => {
    const run = () => play([{ defId: 's_caster', hp: 99 }], [enemy(9, 4), enemy(8, 99)]);
    const first = run();
    const damage = first.log.filter(x => x.ev.t === 'dmg' && x.ev.src === 1 && x.ev.kind === 'ability');
    expect(damage.slice(0, 2).map(x => x.ev)).toMatchObject([{ tgt: 2 }, { tgt: 3 }]);
    const next = run();
    expect(firstBeat(next).filter(x => x.ev.t === 'dmg' && x.ev.src === 1).map(x => x.ev)).toMatchObject([{ tgt: 2 }]);
    expect(firstBeat(next).some(x => x.ev.t === 'buff' && x.ev.src === 1)).toBe(false);
  });

  it('数值授予0不触发技能或无效buff，布尔授予无数值仍有效', () => {
    const def = unitDef('n_paragon'), prior = def.onStart;
    try {
      def.onStart = [{ op: 'grant', to: 'allies', grant: 'armor', v: [0, 0, 0] }];
      const zero = play([{ defId: 'n_paragon' }], [enemy(1, 999)]);
      expect(zero.log.some(x => x.ev.t === 'trigger' && x.ev.src === 1 && x.ev.kind === 'start')).toBe(false);
      expect(zero.log.some(x => x.ev.t === 'buff' && x.ev.src === 1)).toBe(false);
      expect(zero.afterStart[0].grants.armor).toBeUndefined();
      def.onStart = [{ op: 'grant', to: 'allies', grant: 'combo' }];
      const bool = play([{ defId: 'n_paragon' }], [enemy(1, 999)]);
      expect(bool.afterStart[0].grants.combo).toBe(true);
      expect(bool.log.some(x => x.ev.t === 'trigger' && x.ev.src === 1 && x.ev.kind === 'start')).toBe(true);
    } finally { def.onStart = prior; }
  });
});
