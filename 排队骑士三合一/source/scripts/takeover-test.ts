// 接替（商店单位拖到不同名队员身上）与阶层身材曲线的回归
import { SHOP_POOL } from '../src/core/data';
import { TIER_STAT } from '../src/core/reworkCatalog';
import {
  activeCardPool, equipmentPool, itemPrice, newRun, sellPrice, shopTierWeight, takeover, takeoverCheck,
  type Owned, type RunState,
} from '../src/core/run';

const ok = (value: unknown, label: string) => { if (!value) throw new Error(label); };
let checks = 0;
const check = (value: unknown, label: string) => { ok(value, label); checks++; };

/** 五人满队 + 一张不同名的商店单位；只用本局开放卡池里没有出售/购买技能的单位，结算干净 */
function setup(seed: number) {
  const r: RunState = newRun(seed, { solo: true });
  const quiet = activeCardPool(r).filter(c => !c.rules?.some(rule => rule.phase === 'prep') && !c.pl && !c.disc && c.archetype !== 'supply');
  ok(quiet.length >= 6, 'need six quiet units in the open pool');
  r.queue = quiet.slice(0, 5).map((c, i): Owned => ({ oid: r.nextId++, def: c.id, copies: i === 2 ? 3 : 1, atkBonus: 0, hpBonus: 0 }));
  r.shop = [{ sid: r.nextId++, kind: 'unit', def: quiet[5].id, locked: false, free: false }];
  r.hand = r.hand.map(() => null);
  r.gold = 10;
  r.relics = [];
  return { r, incoming: quiet[5].id };
}

// 1. 正常接替：卖旧单位、新单位进同一格，继承永久加成和装备，金币 = 原有 + 退款 − 价格
{
  const { r, incoming } = setup(9101);
  const old = r.queue[2]!;
  old.atkBonus = 7; old.hpBonus = 9;
  const ench = equipmentPool(r)[0]?.id;
  if (ench) old.ench = ench;
  const sid = r.shop[0].sid;
  const price = itemPrice(r.shop[0]);
  const refund = sellPrice(old);
  const goldBefore = r.gold;
  const res = takeover(r, sid, 2);
  check(res.ok, 'takeover succeeds on a different, non-mercenary unit');
  const now = r.queue[2]!;
  check(now.def === incoming && now.copies === 1, 'incoming unit takes the same slot as a single copy');
  check(now.atkBonus === 7 && now.hpBonus === 9, 'permanent bonuses are inherited exactly');
  if (ench) check(now.ench === ench && !r.bag.includes(ench), 'equipment moves straight onto the incoming unit');
  check(r.gold === goldBefore + refund - price, 'gold = before + sell refund - price');
  check(!r.shop.some(s => s.sid === sid), 'shop item is consumed');
  check(r.tc.sold === 1 && r.tc.bought === 1, 'takeover counts as one sale and one purchase');
  check(r.queue.filter(Boolean).length === 5, 'team size is unchanged');
  if (res.ok) check(res.inherited[0] === 7 && res.inherited[1] === 9, 'result reports the inherited bonus');
}

// 2. 负加成不继承
{
  const { r } = setup(9102);
  r.queue[1]!.atkBonus = -2; r.queue[1]!.hpBonus = 4;
  const res = takeover(r, r.shop[0].sid, 1);
  check(res.ok && r.queue[1]!.atkBonus === 0 && r.queue[1]!.hpBonus === 4, 'negative bonuses are not inherited');
}

// 3. 拒绝情况：同名、雇佣兵、空格、手牌格、钱不够；被拒绝时状态不变
{
  const { r } = setup(9103);
  r.shop[0].def = r.queue[0]!.def;
  check(takeoverCheck(r, r.shop[0].sid, 0)?.ok === false, 'same-name unit is a merge, not a takeover');
  const { r: r2 } = setup(9103);
  r2.queue[0]!.merc = 2;
  const merc = takeover(r2, r2.shop[0].sid, 0);
  check(!merc.ok && merc.why === 'full', 'mercenaries cannot be taken over');
  const { r: r3 } = setup(9103);
  r3.queue[4] = null;
  check(!takeover(r3, r3.shop[0].sid, 4).ok, 'empty slot is a normal purchase, not a takeover');
  check(!takeover(r3, r3.shop[0].sid, 5).ok, 'hand slots cannot be taken over');
  const { r: r4 } = setup(9103);
  r4.gold = itemPrice(r4.shop[0]) - sellPrice(r4.queue[0]!) - 1;
  const before = JSON.stringify(r4);
  const poor = takeover(r4, r4.shop[0].sid, 0);
  check(!poor.ok && poor.why === 'gold' && JSON.stringify(r4) === before, 'not enough gold even with the refund: nothing changes');
}

// 4. 退款可以抵扣：金币刚好等于价格 − 退款
{
  const { r } = setup(9104);
  r.gold = itemPrice(r.shop[0]) - sellPrice(r.queue[2]!);
  check(takeover(r, r.shop[0].sid, 2).ok && r.gold === 0, 'sell refund can pay part of the price');
}

// 5. 阶层身材曲线：高阶单卡平均身材不低于低两阶的金色（翻倍）
{
  const avg = (t: number) => { const cs = SHOP_POOL.filter(c => c.tier === t); return cs.reduce((s, c) => s + c.atk + c.hp, 0) / cs.length; };
  for (let t = 2; t <= 6; t++) check(TIER_STAT[t as 1] >= TIER_STAT[(t - 1) as 1], `tier stat factor is non-decreasing at tier ${t}`);
  check(avg(6) > avg(2) * 2 && avg(5) > avg(1) * 2, 'a single high-tier card out-sizes a gold card two tiers lower');
  check(SHOP_POOL.every(c => c.atk >= 1 && c.hp >= 1), 'scaled stats stay at least 1');
}

// 6. 高本商店：比酒馆低 4 阶及以上的卡降权，其余不变
{
  check(shopTierWeight(1, 6) === 0.5 && shopTierWeight(2, 6) === 0.5 && shopTierWeight(3, 6) === 1, 'tavern 6 halves tiers 1-2 only');
  check(shopTierWeight(1, 4) === 1 && shopTierWeight(1, 5) === 0.5, 'tavern 5 starts halving tier 1');
}

console.log(`takeover: ${checks} checks passed (inherit, equipment, refund, rejections, tier curve, shop weights)`);
