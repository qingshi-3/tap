import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import type { BattleEvent, Effect, UnitDef, UnitState } from '../src/core/types';

type Internals = {
  doBeat(): void; startPhase(): void; flush(): void;
  apply(u: UnitState, effects: Effect[], ctx: object): boolean;
  extraAct(u: UnitState, bonus: number): void;
  summon(src: UnitState, side: 0 | 1, slot: number, token: string, atk: number, hp: number): void;
  recall(u: UnitState): void;
};
const intern = (b: Battle) => b as unknown as Internals;
function game(p = 1, e = 1, spells: string[] = []) {
  const entry = () => ({ defId: 'e_skel', atk: 2, hp: 999 });
  return new Battle({ player: Array.from({ length: p }, entry), enemy: Array.from({ length: e }, entry), spells });
}
function customize(b: Battle, uid: number, patch: Partial<UnitDef>) {
  const previous = b.def.bind(b), d = { ...previous(b.u(uid)), ...patch };
  b.def = u => u.uid === uid ? d : previous(u);
}
const events = <T extends BattleEvent['t']>(b: Battle, t: T) => b.log.filter(l => l.ev.t === t).map(l => l.ev as Extract<BattleEvent, { t: T }>);
function step(b: Battle, n = 1) { for (let i = 0; i < n; i++) intern(b).doBeat(); }
function acts(b: Battle, side: number) { return events(b, 'act').filter(x => x.side === side && x.mode !== 'extra').map(x => x.uid); }
const gain: Effect = { op: 'addAction', to: 'behind', v: [1, 1, 1], oncePerRound: true };

describe('回合行动账本', () => {
  it('5 对 3：短队用完等待，直到双方全部结束才开启下一回合', () => {
    const b = game(5, 3); step(b, 6);
    expect(acts(b, 0)).toEqual([1, 2, 3, 4, 5, 1]);
    expect(acts(b, 1)).toEqual([6, 7, 8, 6]);
    expect(events(b, 'beat').map(x => [x.round, x.wave])).toEqual([[1,1],[1,1],[1,1],[1,1],[1,1],[2,1]]);
    expect(events(b, 'beat')[3].next.enemy).toEqual([]);
  });
  it('开战次数保留，额外轮按位置各一次，不产生空拍', () => {
    const b = game(3, 2, ['sp_haste']); intern(b).startPhase(); b.addAction(undefined, b.u(2), 2);
    step(b, 7);
    expect(acts(b, 0)).toEqual([1,2,3,1,2,2,1]);
    expect(events(b, 'beat').map(x => [x.round,x.wave])).toEqual([[1,1],[1,1],[1,1],[1,2],[1,2],[1,3],[2,1]]);
    expect(acts(b, 1)).toEqual([4,5,4]);
  });
  it('动态授予给已行动的人留到下一轮，来源死后不撤销', () => {
    const b = game(3); step(b); b.addAction(b.u(2), b.u(1), 1); b.u(2).hp = 0; intern(b).flush(); step(b, 2);
    expect(acts(b,0)).toEqual([1,3,1]); expect(b.round).toBe(1); expect(b.wave).toBe(2);
  });
  it('同 UID 复生和换位不刷新已消耗次数', () => {
    const b = game(2); customize(b,1,{ traits:{reborn:true} }); step(b); b.u(1).hp = 0; intern(b).flush();
    expect(b.u(1).alive).toBe(true); expect(b.u(1).actionsLeft).toBe(0);
    b.grid[0] = [2,1,null,null,null]; b.u(1).slot=1; b.u(2).slot=0; step(b);
    expect(acts(b,0)).toEqual([1,2]); expect(b.u(1).actionsLeft).toBe(0);
  });
  it('新召唤和召回不发放本回合的基础次数', () => {
    const b = game(2); step(b); b.u(1).hp=0; intern(b).flush(); intern(b).recall(b.u(2));
    expect(b.u(1).actionsLeft).toBe(0);
    intern(b).summon(b.u(2),0,2,'e_skel',2,999);
    const token=b.units.at(-1)!; expect(token.actionsLeft).toBe(0); step(b);
    expect(acts(b,0)).toEqual([1,2]); step(b); expect(b.round).toBe(2); expect(b.u(1).actionsLeft).toBe(0); expect(token.actionsLeft).toBe(1);
  });
  it('尚有基础与额外次数的单位死亡后召回，本回合机会归零、下回合恢复基础机会', () => {
    const b=game(3); b.addAction(undefined,b.u(2),2);
    expect(b.u(2).actionsLeft).toBe(3);
    b.u(2).hp=0; intern(b).flush(); intern(b).recall(b.u(3));
    expect(b.u(2).alive).toBe(true); expect(b.u(2).actionsLeft).toBe(0);
    step(b,2); expect(acts(b,0)).toEqual([1,3]);
    expect(events(b,'beat').map(x=>x.next.player)).toEqual([[1,3],[3]]);
    step(b,2); expect(b.round).toBe(2); expect(acts(b,0)).toEqual([1,3,1,2]);
    expect(b.u(2).actionsLeft).toBe(0);
  });
  it('目标死亡不把行动次数转移给其他单位', () => {
    const b=game(2); b.addAction(b.u(1),b.u(2),3); b.u(2).hp=0; intern(b).flush(); step(b,2);
    expect(events(b,'beat').map(x=>x.round)).toEqual([1,2]); expect(acts(b,0)).toEqual([1,1]);
  });
  it('两个授予者相互加次数，每来源每效果每回合仅成功一次', () => {
    const b=game(2); customize(b,1,{cast:[gain]}); customize(b,2,{cast:[{...gain,to:'ahead'}]}); step(b,4);
    expect(acts(b,0)).toEqual([1,2,1,2]); expect(b.round).toBe(1);
    expect(events(b,'actionGain')).toHaveLength(2);
    expect(events(b,'act').filter(x=>x.side===0).map(x=>x.mode)).toEqual(['cast','cast','attack','attack']);
    step(b); expect(b.round).toBe(2); expect(events(b,'actionGain')).toHaveLength(3);
  });
});

describe('立即攻击与有限施法', () => {
  it('施法单位立即攻击绝不施法，也不消耗常规行动', () => {
    const b=game(); customize(b,1,{cast:[{op:'dmg',to:'enemyFront',v:[8,8,8]}]});
    intern(b).extraAct(b.u(1),0); intern(b).extraAct(b.u(1),0);
    expect(b.u(1).actionsLeft).toBe(1); expect(events(b,'attack')).toHaveLength(2); expect(events(b,'dmg').map(x=>x.kind)).toEqual(['attack','attack']);
    step(b); expect(events(b,'act').filter(x=>x.uid===1).map(x=>x.mode)).toEqual(['extra','extra','cast']);
  });
  it('有限施法三次耗尽后改普攻，额外次数也走同一判断', () => {
    const b=game(); customize(b,1,{cast:[{op:'dmg',to:'enemyFront',v:[1,1,1]}]}); b.u(1).charges=3; b.addAction(undefined,b.u(1),3); step(b,4);
    expect(events(b,'act').filter(x=>x.uid===1).map(x=>x.mode)).toEqual(['cast','cast','cast','attack']); expect(b.u(1).charges).toBe(0);
  });
});

describe('寒意按实际行动机会消耗', () => {
  it.each([0,1] as const)('任一方施法都可冻结已选中的对方普通攻击（施法侧 %s）', side => {
    const b=game(); const caster=b.u(side===0?1:2), victim=b.u(side===0?2:1);
    customize(b,caster.uid,{cast:[{op:'chill',to:'enemyNext',v:[2,2,2]}]}); step(b);
    expect(events(b,'frozenSkip').map(x=>x.uid)).toEqual([victim.uid]);
    expect(events(b,'attack').flatMap(x=>x.pairs.map(p=>p.atk))).not.toContain(victim.uid);
    expect(victim.actionsLeft).toBe(0);
  });
  it('等待方挂寒意留到下回合，不因预测未来目标重派行动', () => {
    const b=game(2,1); step(b); b.chill(undefined,b.u(3),2); step(b);
    expect(b.u(3).chill).toBe(2); expect(acts(b,1)).toEqual([3]); step(b);
    expect(events(b,'frozenSkip').map(x=>x.uid)).toContain(3); expect(b.u(3).chill).toBe(0);
  });
  it('施法回应新增寒意不会被施法后的清理清掉', () => {
    const b=game(2,1); customize(b,1,{cast:[{op:'dmg',to:'enemyFront',v:[1,1,1]}]});
    customize(b,3,{onHurt:[{op:'chill',to:'attacker',v:[2,2,2]}]});
    step(b); expect(b.u(1).chill).toBe(2);
    step(b); expect(b.u(1).chill).toBe(2); step(b); expect(events(b,'frozenSkip').map(x=>x.uid)).toContain(1);
  });
});

describe('献祭', () => {
  const sacrifice: Effect={op:'sacrifice',to:'ahead',v:[2,2,2]};
  it('无视盾甲、正常亡语复生、不是敌方击杀，祭司死亡后奖励仍在', () => {
    const b=game(3); customize(b,2,{cast:[sacrifice]}); customize(b,1,{traits:{reborn:true,armor:[99,99,99]},onRattle:[{op:'buff',to:'rear',v:[1,1,1]}]});
    b.u(1).block=3; b.u(3).atk=10; step(b,2);
    expect(events(b,'sacrifice')).toEqual([{t:'sacrifice',src:2,tgt:1}]); expect(b.u(1).alive).toBe(true); expect(b.u(1).hp).toBe(1);
    expect(b.u(3).atk).toBe(13); b.u(2).hp=0; intern(b).flush(); expect(b.u(3).atk).toBe(13);
    expect(events(b,'trigger').filter(x=>x.kind==='kill')).toEqual([]);
  });
  it('真实核心→传令使→祭仪师：立即行动保留原预算且安全献祭不会吃辅助', () => {
    const b=new Battle({player:[{defId:'e_skel',atk:10,hp:999},{defId:'n_envoy',hp:999},{defId:'n_ritualist',hp:999}],enemy:[{defId:'e_skel',atk:1,hp:999}]});
    step(b,3);
    expect(acts(b,0)).toEqual([1,2,3,3]); expect(b.round).toBe(1); expect(b.wave).toBe(1);
    expect(events(b,'actionGain')).toEqual([]);
    expect(events(b,'sacrifice')).toEqual([]);
    expect(b.u(2).alive).toBe(true); expect(b.u(1).atk).toBe(10); expect(b.u(3).actionsLeft).toBe(0);
    expect(events(b,'dmg').filter(x=>x.src===1&&x.kind==='attack').map(x=>x.n)).toEqual([10]);
  });

  it('无祭品或无受益者按规则改普攻', () => {
    const b=game(2); customize(b,1,{cast:[sacrifice]}); customize(b,2,{cast:[sacrifice]}); step(b,2);
    expect(events(b,'sacrifice')).toHaveLength(0); expect(events(b,'act').filter(x=>x.side===0).every(x=>x.mode==='attack')).toBe(true);
  });
});
