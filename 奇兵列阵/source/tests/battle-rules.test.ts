import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import { BOSS_ENCOUNTER_RULES } from '../src/core/encounterRules';
import type { BattleRule, UnitState } from '../src/core/types';
const entry = (defId: string, hp = 100) => ({ defId, atk: 1, hp });
const intern = (b: Battle) => b as unknown as { beatEnd(): void; flush(): void; recall(u: UnitState): void };
const end = (b: Battle, beat: number) => { b.beat = beat; intern(b).beatEnd(); };
const rules = (b: Battle, id: string) => b.log.filter(x => x.ev.t === 'rule' && x.ev.id === id);
function game(ids: string[], extra: readonly BattleRule[] = [], spells: string[] = []) {
  return new Battle({ player: [entry('e_skel', 999), entry('e_raider', 999), entry('e_brute', 999)], enemy: ids.map(id => entry(id)), rules: extra, spells });
}
describe('declarative boss rules', () => {
  it('preserves intrinsic pull timing, once per target, and anchor immunity', () => {
    const b = game(['e_void']); end(b, 2); expect(b.front(0)!.uid).toBe(1);
    end(b, 3); expect(b.front(0)!.uid).toBe(3); end(b, 6); expect(b.front(0)!.uid).toBe(2);
    end(b, 9); expect(b.front(0)!.uid).toBe(1); end(b, 12); expect(b.front(0)!.uid).toBe(1);
    const anchored = game(['e_void'], [], ['sp_anchor']); end(anchored, 3); expect(anchored.front(0)!.uid).toBe(1);
  });
  it('preserves freeze amount and independent identical sources', () => {
    const b = game(['e_frostq', 'e_frostq']); b.u(2).atk = 7;
    end(b, 3); expect(b.u(2).chill).toBe(14);
  });
  it('half-health is strict, one-shot, and direct lethal damage skips recall', () => {
    const b = game(['e_skel', 'e_nightk']); b.u(4).hp = 0; intern(b).flush();
    b.hit(undefined, b.u(5), 50, 'ability'); intern(b).flush(); expect(b.u(4).alive).toBe(false);
    b.hit(undefined, b.u(5), 1, 'ability'); intern(b).flush();
    expect(b.u(4).hp).toBe(50); expect(b.u(5).block).toBe(3); expect(b.u(4).actionsLeft).toBe(0);
    b.u(4).hp = 0; intern(b).flush(); b.hit(undefined,b.u(5),1,'burn'); intern(b).flush(); expect(b.u(4).alive).toBe(false);
    const lethal = game(['e_skel','e_nightk']); lethal.u(4).hp=0; intern(lethal).flush(); lethal.hit(undefined, lethal.u(5), 100, 'ability'); intern(lethal).flush(); expect(lethal.u(4).alive).toBe(false);
  });
  it('empty recall consumes trigger and separate bosses own separate threshold state', () => {
    const b = game(['e_skel','e_nightk','e_nightk']);
    b.hit(undefined,b.u(5),51,'ability'); intern(b).flush(); b.u(4).hp=0; intern(b).flush();
    b.hit(undefined,b.u(5),1,'burn'); intern(b).flush(); expect(b.u(4).alive).toBe(false);
    b.hit(undefined,b.u(6),51,'ability'); intern(b).flush(); expect(b.u(4).alive).toBe(true);
  });
  it('caps periodic rally and stops immediately when its source dies', () => {
    const b = game(['e_void'], BOSS_ENCOUNTER_RULES.e_void);
    end(b, 6); end(b, 8); expect(rules(b,'void_rally')).toHaveLength(0);
    end(b, 9); expect(b.u(4).atk).toBe(2);
    for (const n of [18,27,36]) end(b,n);
    expect(rules(b,'void_rally')).toHaveLength(2); expect(b.u(4).atk).toBe(3);
    const dead = game(['e_void','e_skel'],BOSS_ENCOUNTER_RULES.e_void); dead.u(4).hp=0; end(dead,9);
    expect(dead.u(4).alive).toBe(false); expect(rules(dead,'void_rally')).toHaveLength(0);
  });
  it('recall bonus affects only units recalled by that source and preserves revival history', () => {
    const b=game(['e_skel','e_nightk','e_nightk'],BOSS_ENCOUNTER_RULES.e_nightk);
    b.u(4).revived=true; b.u(4).hp=0; intern(b).flush();
    b.hit(undefined,b.u(5),51,'ability'); intern(b).flush();
    expect(b.u(4).atk).toBe(3); expect(b.u(4).revived).toBe(true); expect(b.u(5).atk).toBe(1); expect(b.u(6).atk).toBe(1);
    expect(rules(b,'nightk_return')).toHaveLength(1);
  });
  it('source killed before queued threshold response cannot recall', () => {
    const b=game(['e_skel','e_nightk']); b.u(4).hp=0; intern(b).flush();
    b.hit(undefined,b.u(5),51,'ability'); b.hit(undefined,b.u(5),49,'ability'); intern(b).flush(); expect(b.u(4).alive).toBe(false);
  });
  it('death reconciliation precedes recall and revives all same-batch casualties', () => {
    const b=game(['e_skel','e_nightk'],BOSS_ENCOUNTER_RULES.e_nightk);
    b.hit(undefined,b.u(5),51,'ability'); b.hit(undefined,b.u(4),100,'ability'); intern(b).flush();
    expect(b.u(4).alive).toBe(true); expect(b.u(4).hp).toBe(50); expect(b.u(4).atk).toBe(3);
  });
  it('periodic barrier respects block cap and source-less encounter rules work', () => {
    const environmental: BattleRule={ id:'weather',label:'weather',side:0,trigger:{on:'beatEnd',every:2},effects:[{op:'buff',to:'allies',atk:1}],maxTriggers:1 };
    const b=game(['e_frostq'],[...BOSS_ENCOUNTER_RULES.e_frostq,environmental]);
    b.u(4).block=3; end(b,6); expect(b.u(4).block).toBe(3); expect(b.u(1).atk).toBe(2);
    end(b,12); expect(b.u(1).atk).toBe(2);
  });
  it('source-less recall enhancement ignores the opposite side and empty recalls', () => {
    const r: BattleRule={id:'return',label:'return',side:1,trigger:{on:'afterRecall'},maxTriggers:1,effects:[{op:'buff',to:'recalled',atk:2}]};
    const b=game(['e_skel','e_nightk'],[r]);
    intern(b).recall(b.u(5)); expect(rules(b,'return')).toHaveLength(0);
    b.u(1).hp=0; intern(b).flush(); intern(b).recall(b.u(2));
    expect(b.u(1).atk).toBe(1); expect(rules(b,'return')).toHaveLength(0);
    b.u(4).hp=0; intern(b).flush(); intern(b).recall(b.u(5));
    expect(b.u(4).atk).toBe(3); expect(rules(b,'return')).toHaveLength(1);
  });
  it('empty intrinsic recall consumes its threshold but emits no enhancement feedback', () => {
    const b=game(['e_skel','e_nightk'],BOSS_ENCOUNTER_RULES.e_nightk);
    b.hit(undefined,b.u(5),51,'ability'); intern(b).flush();
    expect(rules(b,'nightk_return')).toHaveLength(0);
    b.u(4).hp=0; intern(b).flush(); b.hit(undefined,b.u(5),1,'burn'); intern(b).flush();
    expect(b.u(4).alive).toBe(false); expect(rules(b,'nightk_return')).toHaveLength(0);
  });
  it('resources and counters never leak between battles', () => {
    const snapshot=JSON.stringify(BOSS_ENCOUNTER_RULES);
    const a=game(['e_void'],BOSS_ENCOUNTER_RULES.e_void); end(a,9);
    const b=game(['e_void'],BOSS_ENCOUNTER_RULES.e_void); end(b,9);
    expect(b.u(4).atk).toBe(2); expect(JSON.stringify(BOSS_ENCOUNTER_RULES)).toBe(snapshot);
  });
});
