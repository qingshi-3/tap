import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import type { Effect, UnitDef, UnitState } from '../src/core/types';

type Internal = { doBeat(): void; startPhase(): void; flush(): void; extraAct(u: UnitState, n: number): void; addCharge(src: undefined, u: UnitState, n: number): void; summon(src: UnitState, side: 0, slot: number, token: string, atk: number, hp: number, opts?: {inherit?: number}): UnitState | null };
const inside = (b: Battle) => b as unknown as Internal;
const entry = () => ({ defId: 'e_skel', atk: 2, hp: 1000 });
function fixture(count = 1, passives: string[] = []) {
  const b = new Battle({ player: Array.from({length: count}, entry), enemy: [entry()], general: {id: 'argeon', power: 0, passives} });
  return b;
}
function patch(b: Battle, uid: number, def: Partial<UnitDef>) {
  const old = b.def.bind(b), changed = {...old(b.u(uid)), ...def};
  b.def = u => u.uid === uid ? changed : old(u);
}
function charged(b: Battle, effects: Effect[] = [{op:'dmg', to:'enemyFront', v:[4,4,4]}], max = 2) {
  patch(b, 1, {traits:{charge:max}, chargeSkill: effects}); b.u(1).chargeMax = max; b.u(1).charge = 0;
}
function step(b: Battle, n = 1) { for (let i = 0; i < n; i++) inside(b).doBeat(); }
const acts = (b: Battle) => b.log.flatMap(x => x.ev.t === 'act' && x.ev.uid === 1 ? [x.ev.mode] : []);

describe('个人蓄力与召唤兑现契约', () => {
  it('需求2在第二次行动释放，清零后仍按两次循环', () => {
    const b=fixture(); charged(b); step(b,4);
    expect(acts(b)).toEqual(['attack','charge','attack','charge']); expect(b.u(1).charge).toBe(0);
  });
  it('冻结不积能，追击不积能，额外常规行动仍积能', () => {
    const b=fixture(); charged(b); b.u(1).chill=2; step(b);
    expect(b.u(1).charge).toBe(0); inside(b).extraAct(b.u(1),0); expect(b.u(1).charge).toBe(0);
    b.addAction(undefined,b.u(1),2); step(b,2);
    expect(acts(b)).toEqual(['extra','attack','charge']); expect(b.u(1).charge).toBe(0);
  });
  it('外部加能封顶且下一次常规行动只释放一次', () => {
    const b=fixture(); charged(b); inside(b).addCharge(undefined,b.u(1),99);
    expect(b.u(1).charge).toBe(2); step(b); expect(acts(b)).toEqual(['charge']); expect(b.metrics.charges).toBe(1);
  });
  it('相邻额外加能仍在行动后，满条等下一次有效行动兑现', () => {
    const b=fixture(2); charged(b); patch(b,2,{special:'hourglass'});
    step(b); expect(b.u(1).charge).toBe(2); expect(acts(b)).toEqual(['attack']);
    step(b,2); expect(acts(b)).toEqual(['attack','charge']); expect(b.u(1).charge).toBe(0);
  });
  it('释放中自充能不会在同一次行动再释放', () => {
    const b=fixture(); charged(b,[{op:'charge',to:'self',v:[2,2,2]}]); b.u(1).charge=1;
    // 用同一技能的伤害分量保证满条时有有效效果；自充能在清零后结算。
    patch(b,1,{chargeSkill:[{op:'dmg',to:'enemyFront',v:[1,1,1]},{op:'charge',to:'self',v:[2,2,2]}]});
    step(b); expect(acts(b)).toEqual(['charge']); expect(b.metrics.charges).toBe(1); expect(b.u(1).charge).toBe(2);
  });
  it('无有效目标保留满条并普攻，目标出现后再兑现', () => {
    const b=fixture(); charged(b,[{op:'heal',to:'self',v:[4,4,4]}]); step(b); b.u(1).hp=b.u(1).maxHp; step(b);
    expect(acts(b)).toEqual(['attack','attack']); expect(b.u(1).charge).toBe(2); expect(b.metrics.charges).toBe(0);
    b.u(1).hp-=20; step(b); expect(acts(b).at(-1)).toBe('charge'); expect(b.u(1).charge).toBe(0);
  });
  it('满场1/1召唤每只兑现至少1/1，不广播召唤与额外行动', () => {
    const b=fixture(5); charged(b,[{op:'summon',to:'self',token:'t_shade',v:[1,1,1],v2:[1,1,1],count:2}]);
    b.u(1).charge=2; const atk=b.u(1).atk, hp=b.u(1).maxHp; step(b);
    expect(b.u(1).atk).toBe(atk+2); expect(b.u(1).maxHp).toBe(hp+2);
    expect(b.metrics.summons).toBe(0); expect(b.units).toHaveLength(6); expect(b.u(1).actionsLeft).toBe(0);
    expect(b.log.some(x=>x.ev.t==='summon')).toBe(false);
  });
  it('普通施法满场回普攻且保留次数', () => {
    const b=fixture(5); patch(b,1,{cast:[{op:'summon',to:'self',token:'t_shade',v:[1,1,1]}]}); b.u(1).charges=2;
    step(b); expect(acts(b)).toEqual(['attack']); expect(b.u(1).charges).toBe(2);
  });
  it('正常召唤下回合行动，亡语传入的剩余预算原样继承', () => {
    const b=fixture(); inside(b).startPhase();
    const normal=inside(b).summon(b.u(1),0,0,'t_shade',1,1)!;
    const inherited=inside(b).summon(b.u(1),0,0,'t_shade',1,1,{inherit:2})!;
    expect(normal.actionsLeft).toBe(0); expect(inherited.actionsLeft).toBe(2);
  });
  it('强化普攻不走施法复制，普通有限施法复制同样耗次数', () => {
    const b=fixture(1,['g_surge']); patch(b,1,{traits:{charge:2},chargeAttack:{mult:2}}); b.u(1).chargeMax=2; b.u(1).charge=1;
    step(b); expect(b.metrics.casts).toBe(0); expect(b.metrics.charges).toBe(1);
    const c=fixture(1,['g_surge']); patch(c,1,{cast:[{op:'dmg',to:'enemyFront',v:[1,1,1]}]}); c.u(1).charges=1;
    step(c); expect(c.metrics.casts).toBe(1); expect(c.u(1).charges).toBe(0);
  });
});

describe('跨战成长只应用到战斗副本',()=> {
  it('成长与培养分开，战斗buff不回写原始成长',()=> {
    const slotted={defId:'e_skel',ownedId:1,copies:1 as const,growth:{atk:3,hp:7,power:2}};
    const b=new Battle({player:[slotted],enemy:[entry()]}); const u=b.u(1);
    const base=new Battle({player:[{defId:'e_skel',ownedId:2,copies:1}],enemy:[entry()]}).u(1);
    expect(u.atk).toBe(base.atk+3); expect(u.maxHp).toBe(base.maxHp+7); expect(b.power(u)).toBe(2); expect(u.train).toBeUndefined();
    b.buff(u,u,9,9); expect(slotted.growth).toEqual({atk:3,hp:7,power:2});
  });
});
