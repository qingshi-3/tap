import { describe, expect, it } from 'vitest';
import { Battle, previewAttackTarget } from '../src/core/engine';
import { unitDef } from '../src/core/data';
import type { EnemyEntry, Effect } from '../src/core/types';
const e = (defId = 'e_skel', atk = 2, hp = 100): EnemyEntry => ({ defId, atk, hp });
const battle = (player: EnemyEntry[], enemy = [e('e_skel', 1, 999)], surge = false) => new Battle({
  player: [...player, null, null, null, null].slice(0, 5), enemy: [...enemy, null, null, null, null].slice(0, 5),
  general: surge ? { id: 'argeon', power: 0, passives: ['g_surge'] } : undefined,
});
function fixture(ids: string[], run: () => void) {
  const old = ids.map(id => [unitDef(id), { ...unitDef(id) }] as const);
  try { run(); } finally { for (const [def, saved] of old) { for (const k of Object.keys(def)) delete (def as any)[k]; Object.assign(def, saved); } }
}
const api = (b: Battle): any => b;
const bonus: Effect = { op: 'bonusAct', to: 'behind', oncePerRound: true };
const dmg: Effect = { op: 'dmg', to: 'enemyFront', v: [3, 3, 3] };
describe('0.11 battle contracts', () => {
  it('rear taunt cannot steal front hits; adjacent guard catches snipe across gaps', () => {
    const b = battle([e()], [e(), e('v_wall'), e()]); const [a, front, guard, rear] = b.units;
    expect(previewAttackTarget(a, [front, guard, rear])).toBe(front);
    expect(previewAttackTarget(a, [front, guard, rear], true)).toBe(guard);
    guard.slot = 2; rear.slot = 4;
    expect(previewAttackTarget(a, [front, guard, rear], true)).toBe(guard);
    rear.grants.taunt = true; expect(previewAttackTarget(a, [front, guard, rear], true)).toBe(rear);
  });
  it('rotation shields the replacement and respects round cap', () => fixture(['l_shield'], () => {
    unitDef('l_shield').onRotate = [{ op: 'block', to: 'front', v: [1, 1, 1], cap: [1, 1, 1] }];
    const b = battle([e('l_shield'), e()]); const [shield, next] = b.units;
    api(b).rotateToRear(shield); api(b).flush(); expect(next.block).toBe(1); expect(shield.block).toBe(0);
    api(b).rotateToRear(next); api(b).rotateToRear(shield); api(b).flush(); expect(next.block).toBe(1);
  }));
  it('rotation response retains its actual replacement if another rotation runs before the queue', () => fixture(['l_shield'], () => {
    unitDef('l_shield').onRotate = [{ op: 'block', to: 'front', v: [1, 1, 1] }];
    const b = battle([e('l_shield'), e(), e()]); const [shield, first, second] = b.units;
    api(b).rotateToRear(shield); api(b).rotateToRear(first); api(b).flush();
    expect(first.block).toBe(1); expect(second.block).toBe(0);
  }));
  it('caliber captures each replacement at rotation time', () => fixture(['l_caliber'], () => {
    unitDef('l_caliber').values = [3, 3, 3]; const b = battle([e('l_caliber'), e(), e()]); const [c, f, n] = b.units;
    api(b).rotateToRear(c); api(b).rotateToRear(f); api(b).flush(); expect(f.atk).toBe(5); expect(n.atk).toBe(5);
  }));
  it('bonus preserves budget and beat, respects cast uses, surge, and rotation', () => fixture(['s_caster'], () => {
    Object.assign(unitDef('s_caster'), { cast: [dmg], traits: { rotate: true }, castUses: [3, 3, 3] });
    const b = battle([e(), e('s_caster'), e()], undefined, true); const [src, t] = b.units; const budget = t.actionsLeft;
    api(b).bonusAct(src, t); expect(t.actionsLeft).toBe(budget); expect(b.beat).toBe(0);
    expect(b.metrics.casts).toBe(2); expect(t.charges).toBe(1); expect(t.slot).toBe(2);
    api(b).bonusAct(src, t); expect(b.metrics.casts).toBe(2);
    b.round++; api(b).bonusAct(src, t); expect(t.charges).toBe(0); expect(b.metrics.casts).toBe(3);
  }));
  it('double envoys cannot recursively bounce complete actions with surge', () => fixture(['n_envoy'], () => {
    Object.assign(unitDef('n_envoy'), { cast: [{ op: 'bonusAct', to: 'highestAtk', oncePerRound: true }], traits: undefined });
    const b = battle([e('n_envoy', 2), e('n_envoy', 3)], undefined, true); api(b).doBeat();
    expect(b.beat).toBe(1); expect(b.metrics.extraActions).toBe(1);
    expect(b.log.filter(x => x.ev.t === 'act' && x.ev.side === 0)).toHaveLength(2);
  }));
  it('source oncePerRound prevents a second recipient after rotation', () => {
    const b = battle([e(), e(), e()]); const [src, first, second] = b.units;
    api(b).apply(src, [bonus], {}); api(b).rotateToRear(first); api(b).flush(); api(b).apply(src, [bonus], {});
    expect(b.log.filter(x => x.ev.t === 'act' && x.ev.uid === second.uid)).toHaveLength(0);
  });
  it('frozen acceptance consumes no normal action or charge and cannot retry this round', () => {
    const b = battle([e(), e()]); const [src, t] = b.units; t.chill = t.atk; const budget = t.actionsLeft;
    api(b).bonusAct(src, t); api(b).bonusAct(src, t); expect(t.chill).toBe(0); expect(t.actionsLeft).toBe(budget);
    expect(b.log.filter(x => x.ev.t === 'frozenSkip')).toHaveLength(1); expect(b.log.some(x => x.ev.t === 'act')).toBe(false);
  });
  it('bonus advances personal charge and releases the real skill before rotation', () => fixture(['s_caster'], () => {
    Object.assign(unitDef('s_caster'), { cast: undefined, traits: { charge: 2, rotate: true }, chargeSkill: [dmg] });
    const b = battle([e(), e('s_caster'), e()]); const [src, t] = b.units; t.charge = 1;
    api(b).bonusAct(src, t); expect(t.charge).toBe(0); expect(b.metrics.charges).toBe(1); expect(b.metrics.casts).toBe(1); expect(t.slot).toBe(2);
    b.round++; api(b).bonusAct(src, t); expect(t.charge).toBe(1); expect(b.metrics.charges).toBe(1);
  }));
  it('dead and reserve targets do not act', () => {
    const b = battle([e(), e()]); const [src, t] = b.units; t.reserve = true; api(b).bonusAct(src, t);
    t.reserve = false; t.hp = 0; api(b).bonusAct(src, t); expect(b.log.some(x => x.ev.t === 'act')).toBe(false);
  });
  it('spellAllies accepts scalable charge skills but excludes passive, block-only and self', () => fixture(['a_solus', 's_caster', 'l_shield', 's_wind'], () => {
    unitDef('a_solus').cast = [dmg]; Object.assign(unitDef('s_caster'), { cast: undefined, chargeSkill: [dmg] });
    Object.assign(unitDef('l_shield'), { cast: [{ op: 'block', to: 'self', v: [1, 1, 1] }], chargeSkill: undefined });
    Object.assign(unitDef('s_wind'), { cast: undefined, chargeSkill: undefined, afterAttack: [dmg] });
    const b = battle([e('a_solus'), e('s_caster'), e('l_shield'), e('s_wind')]); expect(api(b).targets(b.units[0], 'spellAllies', {})).toEqual([b.units[1]]);
  }));
  it('lion gains lasting attack only when its own block breaks', () => fixture(['l_lion'], () => {
    unitDef('l_lion').values = [2, 3, 4]; const b = battle([e('l_lion', 3)]); const lion = b.units[0]; lion.block = 1;
    b.hit(b.units[1], lion, 20, 'attack'); api(b).flush(); expect(lion.atk).toBe(5); expect(lion.hp).toBe(100);
    b.hit(b.units[1], lion, 2, 'attack'); api(b).flush(); expect(lion.atk).toBe(5);
  }));
  it('final burning layer summons behind harvester; terminal deaths grant nothing', () => fixture(['m_harvester'], () => {
    unitDef('m_harvester').values = [3, 4, 5]; const b = battle([e('m_harvester'), e()], [e('e_skel', 1, 1), e('e_skel', 1, 999)]);
    const [h, ally, victim, survivor] = b.units; victim.burn = 1; api(b).beatEnd(); const flame = b.units.find(x => x.defId === 't_flame')!;
    expect(flame).toBeDefined(); expect(flame.slot).toBe(h.slot + 1); expect(flame.atk).toBe(3); expect(ally.slot).toBe(2);
    survivor.burn = 1; survivor.hp = 0; api(b).flush(); expect(b.metrics.summons).toBe(1);
  }));
  it('ritualist chooses non-token highest attack; generic firstDead remains chronological', () => {
    const b = battle([e('a_ritualist'), e('t_flame', 30), e('e_skel', 5), e('e_skel', 9)]); const [r, token, low, high] = b.units;
    for (const u of [token, low, high]) { u.hp = 0; api(b).flush(); }
    expect(api(b).firstDead(0)).toBe(token); expect(api(b).reviveTarget(r)).toBe(high);
    api(b).apply(r, [{ op: 'revive', to: 'self' }], {}); expect(high.alive).toBe(true);
  });
  it('safe sacrifice rejects normal cores but accepts unused reborn', () => {
    const b = battle([e(), e('e_skel', 30), e()]); const [src, t] = b.units;
    const effect: Effect = { op: 'sacrifice', to: 'behind', v: [4, 4, 4], requireFodder: true };
    expect(api(b).apply(src, [effect], {})).toBe(false); expect(t.hp).toBe(100);
    t.grants.reborn = true; expect(api(b).apply(src, [effect], {})).toBe(true); api(b).flush();
    expect(t.revived).toBe(true); expect(api(b).isFodder(t)).toBe(false);
  });
  it('harvester stops after three nonterminal deaths and attributes full-board overflow to itself', () => fixture(['m_harvester'], () => {
    unitDef('m_harvester').values = [3, 4, 5];
    const b = battle([e('m_harvester'), e(), e(), e(), e()], [e('e_skel', 1, 10), e('e_skel', 1, 999)]);
    const [h] = b.units; const victim = b.units[5]; const initialAtk = h.atk;
    for (let i = 0; i < 4; i++) {
      victim.burn = 1; victim.hp = 0; api(b).flush();
      victim.alive = true; victim.hp = 10; b.grid[1][victim.slot] = victim.uid;
    }
    expect(h.atk).toBe(initialAtk + 3); expect(b.metrics.summons).toBe(0);
    const rewards = b.log.filter(x => x.ev.t === 'buff' && x.ev.src === h.uid);
    expect(rewards).toHaveLength(3); expect(rewards.every(x => x.ev.t === 'buff' && x.ev.tgt === h.uid)).toBe(true);
  }));
  it('devourer never eats an ordinary tail and eats only eligible other tails', () => fixture(['a_void'], () => {
    unitDef('a_void').special = 'devourer'; const b = battle([e('a_void'), e('e_skel', 20)]); const [d, tail] = b.units;
    api(b).roundStart(); expect(tail.hp).toBe(100); expect(d.atk).toBe(2);
    tail.grants.reborn = true; api(b).roundStart(); expect(tail.revived).toBe(true); expect(d.atk).toBe(22);
    api(b).roundStart(); expect(tail.alive).toBe(true); expect(d.atk).toBe(22);
  }));
  it('ritualist stable ties preserve death order and falls back to tokens', () => {
    const b = battle([e('a_ritualist'), e('e_skel', 7), e('e_skel', 7), e('t_flame', 50)]); const [r, first, second, token] = b.units;
    for (const u of [token, first, second]) { u.hp = 0; api(b).flush(); }
    expect(api(b).reviveTarget(r)).toBe(first); api(b).reviveUnit(first, r);
    expect(api(b).reviveTarget(r)).toBe(second); api(b).reviveUnit(second, r);
    expect(api(b).reviveTarget(r)).toBe(token);
  });

});
