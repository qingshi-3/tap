import { describe, expect, it } from 'vitest';
import { PASSIVES, PASSIVE_MAP, generalPowerSources } from '../src/core/content';
import { allocPoint, applyResult, canSell, canTrainGeneral, choosePromo, cloneRun, deallocPoint, DRAGON_OF, moveSlot, newRun, placeKind, sell, sellBlockReason, takeDraft, type RunState } from '../src/core/run';
const promote = (general = 'vulkan', held: string[] = [], seed = 1) => {
  const r = newRun(general, seed, {legacyRules:true}); r.passives = [...held]; r.node = 8; r.picks = 0;
  applyResult(r, 'win'); return r;
};
const owned = (defId: string, ownedId: number) => ({ defId, ownedId, copies: 1 as const });
const filled = () => {
  const r = newRun('xingjiao', 42); r.slots = [owned('x_egg',1),...['n_merc','n_bulwark','s_backstab','s_fox'].map((id,i)=>owned(id,i+2))];
  r.bench = ['l_vigil','m_rex','d_sentry'].map((id,i)=>owned(id,i+6));
  r.nextOwnedId=9;r.picks=2;r.draft=['n_archer'];return r;
};

describe('主将晋升候选', () => {
  it.each([1,2,3,44,901])('晋升保留原节点并提供2专属1通用，无重复 seed=%i', seed => {
    const r = promote('vulkan',[],seed);
    expect(r.chapter).toBe(1); expect(r.node).toBe(0);
    expect(r.promo).toHaveLength(3); expect(new Set(r.promo).size).toBe(3);
    expect(r.promo!.filter(id=>PASSIVE_MAP[id].general==='vulkan')).toHaveLength(2);
    expect(r.promo!.filter(id=>!PASSIVE_MAP[id].general)).toHaveLength(1);
  });
  it.each([0,1])('未持专属只剩%i个时通用补足3个', remaining => {
    const own=PASSIVES.filter(p=>p.general==='reva').map(p=>p.id);
    const held=own.slice(0,own.length-remaining);const r=promote('reva',held);
    expect(r.promo).toHaveLength(3);
    expect(r.promo!.filter(id=>PASSIVE_MAP[id].general==='reva')).toHaveLength(remaining);
    expect(r.promo!.some(id=>held.includes(id))).toBe(false);
    expect(r.passives).toEqual(held);
  });
  it('历史已持多个通用/专属不会被丢弃或重新提供', () => {
    const held=['vulkan_1','g_wall','g_pay','g_morale'];const r=promote('vulkan',held);
    expect(r.passives).toEqual(held);expect(r.promo!.some(id=>held.includes(id))).toBe(false);
    const selected=r.promo![0];expect(choosePromo(r,0)).toBe(true);
    expect(r.passives).toEqual([...held,selected]);
  });
});

describe('主将法强用途与历史值', () => {
  it.each(['kasiva','kara','hank','argeon','reva','faie','xingjiao'])('%s当前无受益技能时拒绝投入且完全不耗点', general => {
    const r=newRun(general,1);r.stash.power=2;r.genPower=7;
    const before=JSON.stringify(r);
    expect(canTrainGeneral(r)).toBe(false);expect(allocPoint(r,'general','power')).toBe(false);
    expect(JSON.stringify(r)).toBe(before);
  });
  it.each([['vulkan',[]],['kaleos',[]],['argeon',['argeon_3']],['reva',['reva_2']],['faie',['faie_1']],['xingjiao',['xingjiao_3']]] as [string,string[]][])('%s实际受益技能允许投入并逐点退款', (general,passives) => {
    const r=newRun(general,2,{legacyRules:true});r.passives=passives;r.stash.power=2;r.genPower=4;
    expect(generalPowerSources(general,passives).length).toBeGreaterThan(0);expect(canTrainGeneral(r)).toBe(true);
    expect(allocPoint(r,'general','power')).toBe(true);expect(r.genPower).toBe(5);expect(r.stash.power).toBe(1);
    expect(deallocPoint(r,'general','power')).toBe(true);expect(r.genPower).toBe(4);expect(r.stash.power).toBe(2);
  });
  it('用途失效后仍允许退回已有本轮投入，历史法强保留', () => {
    const r=newRun('argeon',3);r.passives=['argeon_3'];r.genPower=9;r.stash.power=1;
    expect(allocPoint(r,'general','power')).toBe(true);r.passives=[];
    const restored=cloneRun(JSON.parse(JSON.stringify(r)) as RunState);
    expect(restored.genPower).toBe(10);expect(canTrainGeneral(restored)).toBe(false);
    expect(deallocPoint(restored,'general','power')).toBe(true);expect(restored.genPower).toBe(9);
    expect(restored.stash.power).toBe(1);
  });
});

describe('星角最后血脉保护', () => {
  it.each(['x_egg',...Object.values(DRAGON_OF)])('最后%s不能出售但普通单位可卖', id => {
    const r=newRun('xingjiao',1);r.slots=[owned(id,1),owned('n_merc',2),null,null,null];
    expect(canSell(r,0)).toBe(false);expect(sellBlockReason(r,0)).toContain('最后');
    const before=JSON.stringify(r);expect(sell(r,0)).toBe(false);expect(JSON.stringify(r)).toBe(before);
    expect(canSell(r,1)).toBe(true);
  });
  it('满库存时最后血脉覆盖无效，确认参数也不能绕过且不耗资源', () => {
    const r=filled();expect(placeKind(r,'n_archer',0)).toBe('invalid');
    const before=JSON.stringify(r);expect(takeDraft(r,0,0,true)).toBe('invalid');expect(JSON.stringify(r)).toBe(before);
  });
  it('空备战可移动最后蛋保留身份，不强禁替换位置', () => {
    const r=filled();r.bench[1]=null;
    expect(placeKind(r,'n_archer',0)).toBe('reserve');expect(takeDraft(r,0,0)).toBe('reserve');
    expect(r.slots[0]?.defId).toBe('n_archer');expect(r.bench[1]?.defId).toBe('x_egg');
    expect(canSell(r,6)).toBe(false);
  });
  it('备战第二只龙也算血脉，允许出售或确认覆盖前一只', () => {
    const r=filled();r.bench[2]=owned('x_fire',8);
    expect(canSell(r,0)).toBe(true);expect(placeKind(r,'n_archer',0)).toBe('replace');
    expect(takeDraft(r,0,0)).toBe('confirm');expect(takeDraft(r,0,0,true)).toBe('replace');
    expect(r.bench[2]?.defId).toBe('x_fire');expect(canSell(r,7)).toBe(false);
  });
  it('有待补蛋允许出售并正常兑现，不覆盖新招募的格位', () => {
    const r=filled();r.pendingEggs=1;
    expect(canSell(r,0)).toBe(true);expect(sell(r,0)).toBe(true);expect(r.pendingEggs).toBe(0);
    expect(r.slots[0]?.defId).toBe('x_egg');
    const replace=filled();replace.pendingEggs=1;
    expect(takeDraft(replace,0,0,true)).toBe('replace');expect(replace.slots[0]?.defId).toBe('n_archer');
    expect(replace.pendingEggs).toBe(1);
  });
  it('换位和同名合并不被出售保护拦截', () => {
    const r=filled();expect(moveSlot(r,0,1)).toBe('swap');expect(r.slots[1]?.defId).toBe('x_egg');
    r.bench[0]=owned('x_egg',6);expect(moveSlot(r,5,1)).toBe('merge');
    expect(r.slots[1]?.copies).toBe(2);expect(canSell(r,1)).toBe(false);
  });
});
