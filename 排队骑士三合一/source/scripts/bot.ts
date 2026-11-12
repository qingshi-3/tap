// 启发式 bot：和玩家同一套商店规则选卡、合卡、吃补给、排站位。sim、幽灵生成、整局验收共用。
import { card, EQUIP, FOOD, RELIC, hasTag, type CardDef, type Line, type RelicId } from '../src/core/data';
import { canPayBlood, payBlood, playerTeam, simOpts, autoSlot, buy, cellAt, HAND_BASE, HAND_MAX, isHand, moveOwned, upgradeTavern, chestPick, pickRelic, resolveEvent, MAX_COPIES, endTurn, equipFromBag, nodeOpts, pickNode, curNode, isCombat, leaveNode, passNode, tavernPrice, handCap, fireCopyOk, buyGoods, foodNeedsTarget, foodTargetOk, foodPrice, itemPrice, lvlOf, maxLives, ownedAtk, ownedHp, pickDiscover, PRICE, reroll, sell, spellTargetOk, useFood, isHeldSpell, castHandSpell, claimReward, discardReward, discardHandSpell, type Owned, type RunState } from '../src/core/run';

import { simulate, type BattleOut } from '../src/core/engine';
import { ruleNumber, type ArchetypeId, type BattleRule, type PrepRule, type ReworkRule } from '../src/core/archetypes';
import { relatedCards } from '../src/core/archetypePool';

export type BotFocus = Line | ArchetypeId;
export type BotTrace = (action: string, before: string, r: RunState, detail: unknown) => void;
let trace: BotTrace | undefined;
let comboFocus = false;
export function setComboFocus(enabled: boolean) { comboFocus = enabled; }
export function setBotTrace(next?: BotTrace) { trace = next; }
function observe<T>(r: RunState, action: string, detail: unknown, fn: () => T): T {
  const before = trace ? JSON.stringify(r) : '';
  const out = fn();
  trace?.(action, before, r, { detail, out });
  return out;
}

const units = (r: RunState) => r.queue.filter((o): o is Owned => !!o);
const matchesFocus = (d: CardDef, focus?: BotFocus) => !!focus && (d.archetype ? d.archetype === focus || d.bridge === focus : hasTag(d, focus as Line));
/** 持有者的完整规则用于选补给、装备、站位；装备候选可替换后比较。 */
const ownedRules = (o: Owned, equip = o.ench): ReworkRule[] => [
  ...(card(o.def).rules ?? []), ...(equip ? EQUIP[equip]?.rules ?? [] : []),
  ...(o.supportFoods ?? []).flatMap(id => FOOD[id]?.battleRules ?? []),
];
const ownedBattleRules = (o: Owned, equip = o.ench) => ownedRules(o,equip).filter((rule): rule is BattleRule => rule.phase === 'battle');
const ownedPrepRules = (o: Owned) => ownedRules(o).filter((rule): rule is PrepRule => rule.phase === 'prep');
const teamBattleRules = (r: RunState) => units(r).flatMap(o => ownedBattleRules(o));
const teamPrepRules = (r: RunState) => [...units(r).flatMap(o => ownedPrepRules(o)), ...r.relics.flatMap(id => RELIC[id]?.prepRules ?? [])];
function supportFit(r: RunState, archetypes?: readonly ArchetypeId[], focus?: BotFocus): number {
  if (!archetypes?.length) return 1;
  const fit = units(r).filter(o => archetypes.includes(card(o.def).archetype!)).length;
  return fit * 2 + (archetypes.some(a => a === focus) ? 4 : 0);
}
/** 规则触发需要已有承接者；选装备时同时计算候选自己提供的能力。 */
function ruleReady(r: RunState, rule: ReworkRule, o?: Owned, equip = o?.ench): number {
  const us = units(r), at = o ? r.queue.indexOf(o) : -1;
  const own = o ? ownedBattleRules(o,equip) : teamBattleRules(r);
  const team = teamBattleRules(r);
  const has = (effect: BattleRule['effect']) => own.some(x => x.effect === effect);
  const next = at >= 0 ? r.queue[at + 1] : undefined;
  if (rule.phase === 'prep') {
    if (rule.on === 'bloodPay') return us.some(x => ownedPrepRules(x).some(y => y.on === 'bloodPay') && ownedHp(x) > 3) ? 1 : 0;
    if (rule.on === 'spell') return us.some(x => card(x.def).archetype === 'rune') ? 1 : 0.35;
    if (rule.on === 'sell' || rule.on === 'buy') return us.some(x => card(x.def).archetype === 'trade') ? 1 : 0.3;
    return 1;
  }
  if (rule.on === 'move' && !has('rotate')) return 0;
  if (rule.on === 'released' && !has('release')) return 0;
  if (rule.on === 'inherited') {
    const donors = o ? us.slice(0, Math.max(0,us.indexOf(o))) : us;
    if (!donors.some(x => ownedBattleRules(x).some(y => y.effect === 'inherit'))) return 0;
  }
  if (rule.on === 'summon' && !team.some(x => x.effect === 'summon') && !us.some(x => x.lamp || x.granted?.id === 'bone')) return 0;
  if (rule.when === 'paired' && !(o ? us.some(x => x !== o && x.def === o.def) : us.some(x => us.some(y => x !== y && x.def === y.def)))) return 0;
  if (rule.effect === 'charge') {
    const receivers = rule.target === 'self' ? [o].filter((x): x is Owned => !!x) : next ? [next] : o ? [] : us;
    if (!receivers.some(x => ownedBattleRules(x, x === o ? equip : x.ench).some(y => y.effect === 'release'))) return 0;
  }
  if (rule.effect === 'inherit' && o && us.indexOf(o) === us.length - 1) return 0.3;
  if (rule.scale === 'marks' || rule.effect === 'detonate') return team.some(x => x.effect === 'mark') ? 1 : 0.1;
  if (rule.scale === 'gold') return Math.min(1.5, r.gold / 4);
  if (rule.scale === 'edges') return Math.min(1.5, Math.max(0,us.length - 1) / 2);
  if (rule.scale === 'laps') return has('rotate') ? 1.3 : 0.4;
  return 1;
}
function supportRuleValue(rule: ReworkRule): number {
  const n = ruleNumber(rule.n,1), hp = ruleNumber(rule.hp,1);
  const base = rule.phase === 'prep'
    ? ({buff:n + hp, block:n * 3, gold:n * 3, spell:n * 4, ration:n * 3, seal:n})[rule.effect]
    : ({buff:n + hp, block:n * 3, damage:n, rotate:5, charge:n * 2, release:n * 3, inherit:n / 5, summon:n + hp, coalesce:6, mark:n * 2, detonate:n * 2, guard:n * 2, share:n * 2, pairEcho:6, survive:8})[rule.effect];
  return Math.min(16, Math.max(1,base) * Math.min(2,rule.limit ?? 2));
}
/** 品质和协同一起比较；返回指定持有者使用这件装备的总价值。 */
export function equipmentValue(r: RunState, id: string, o: Owned, focus?: BotFocus): number {
  const e = EQUIP[id];
  if (!e) return 0;
  const rules = e.rules ?? [];
  const ready = rules.reduce((sum, rule) => sum + supportRuleValue(rule) * ruleReady(r,rule,o,id),0);
  const live = !rules.length || ready > 0;
  const affinity = e.archetypes?.includes(card(o.def).archetype!) ? 6 : 0;
  return e.q * 2 + (e.atk ?? 0) + (e.hp ?? 0) + (e.block ?? 0) * 3 + (e.melee ?? 0)
    + (e.splash ?? 0) * ownedAtk(o) / 100 + (e.atoms?.length ?? 0) * 6 + (e.reborn ? 8 : 0) + (e.sp ? 7 : 0)
    + ready + (live ? affinity + supportFit(r,e.archetypes,focus) * 0.5 + Math.min(5, ownedValue(o,focus) * 0.04) : 0);
}
export function equipmentGain(r: RunState, id: string, o: Owned, focus?: BotFocus): number {
  return equipmentValue(r,id,o,focus) - (o.ench ? equipmentValue(r,o.ench,o,focus) : 0);
}
/** 已有触发链决定当下收益，开放流派和指定路线保留成长空间。 */
export function relicValue(r: RunState, id: RelicId, focus?: BotFocus): number {
  const d = RELIC[id];
  if (!d) return 0;
  const rules: ReworkRule[] = [...(d.battleRules ?? []), ...(d.prepRules ?? [])];
  const ruleValue = rules.reduce((n,rule) => n + supportRuleValue(rule) * ruleReady(r,rule),0);
  const generic: Partial<Record<RelicId,number>> = {r_reserve:8, r_training:8, r_vanguard:7, r_medal:6, r_heavy:7, r_relay:5, r_motley:6, r_ember:6, r_runebox:5, r_pouch:5, r_brood:4, r_few:units(r).length <= 4 ? 8 : 2, r_share:5};
  return (generic[id] ?? 2) + ruleValue + supportFit(r,d.archetypes,focus) * 3
    + (d.archetypes?.some(a => r.activeArchetypes.includes(a)) ? 1 : 0);
}
export function chooseRelic(r: RunState, opts: readonly RelicId[], focus?: BotFocus): number {
  return opts.reduce((best,id,i) => relicValue(r,id,focus) > relicValue(r,opts[best],focus) ? i : best,0);
}
/** 单张能力价值与阶层分开：低阶引擎不会仅因低阶被替掉。 */
export function intrinsicValue(d: CardDef): number {
  if (!d.rules) return d.tier * 7 + d.atk + d.hp + (d.perm ? 5 : 0);
  const ability = d.rules.reduce((score, rule) => {
    const n = ruleNumber(rule.n, 1), h = ruleNumber(rule.hp, 1);
    if (rule.phase === 'prep') {
      const base = rule.effect === 'buff' ? (n + h) * 2 : rule.effect === 'gold' ? n * 4 : rule.effect === 'seal' ? n * 1.5 : n * 3;
      return score + Math.min(13, base * (rule.on === 'bloodPay' ? 0.65 : 1));
    }
    const base = ({ buff: 5, block: 5, damage: 5, rotate: 2, charge: 6, release: 7, inherit: 7, summon: 8, coalesce: 6, mark: 6, detonate: 5, guard: 6, share: 7, pairEcho: 9, survive: 10 })[rule.effect];
    return score + base * (rule.when === 'paired' ? 0.65 : 1);
  }, 0);
  return d.tier * 3 + d.atk + d.hp + Math.min(24, ability) + (d.role === 'engine' ? 5 : d.role === 'terminal' ? 3 : 0);
}
export function want(r: RunState, def: string, skill = 1, engine?: BotFocus) {
  const d = card(def), team = units(r).map(o => card(o.def));
  const fit = team.filter(c => d.archetype ? relatedCards(d, c) : hasTag(c, d.line)).length;
  const bridge = d.bridge && team.some(c => c.archetype === d.bridge) ? 5 : 0;
  const pref = engine ? matchesFocus(d, engine) ? 20 : !d.archetype ? 3 : -8 : 0;
  const same = units(r).filter(o => o.def === def);
  const pairBonus = d.archetype === 'pair' && same.length === 1 ? 13 : 0;
  return intrinsicValue(d) + (comboFocus && d.archetype === 'rune' ? 8 : 0) + pref + (fit * 4 + bridge + pairBonus) * skill + keyFit(r, d) * 5 * skill;
}
/** 关键卡：队里吃它放大的单位越多越想要 */
const KEY_ABS: Record<string, string[]> = {
  hurt: ['peacock', 'camel', 'blowfish', 'gorilla', 'thornback', 'idol'],
  start: ['mosquito', 'anvil', 'dodo', 'dolphin', 'croc', 'skunk'],
  faint: ['cricket', 'egg', 'sheep', 'deer', 'rooster', 'spider', 'eagle', 'ant', 'flamingo', 'hedgehog', 'turtle', 'badger', 'mammoth'],
  end: ['tfish', 'backstab', 'egg', 'giraffe', 'penguin', 'rhyno'],
};
function keyFit(r: RunState, d: CardDef) {
  if (!d.key) return 0;
  return units(r).filter((o) => { const c = card(o.def); return d.key === 'play' ? !!c.pl : KEY_ABS[d.key!].includes(c.ab ?? ''); }).length;
}
/** 入场目标：最值钱的友军 */
const playPt = (r: RunState, line?: BotFocus) => units(r).sort((a, b) => ownedValue(b, line) - ownedValue(a, line))[0]?.oid;
export const ownedValue = (o: Owned, engine?: BotFocus) =>
  intrinsicValue(card(o.def)) + (ownedAtk(o) - card(o.def).atk) + (ownedHp(o) - card(o.def).hp)
  + (lvlOf(o.copies) - 1) * 10 + (matchesFocus(card(o.def), engine) ? 20 : 0)
  + (o.seal ?? 0) + (o.startBlock ?? 0) * 3;
/** 并肩先保留两个独立身体；第3份或没有部署空间时可合金。 */
export function keepPair(r: RunState, def: string) {
  return card(def).archetype === 'pair' && units(r).filter(o => o.def === def).length === 1 && units(r).length < 5;
}
function purchaseSlot(r: RunState, def: string) {
  if (keepPair(r, def)) return r.queue.findIndex(o => !o);
  if (card(def).archetype === 'pair') {
    const merge = r.queue.findIndex(o => o?.def === def && o.copies < MAX_COPIES && !o.merc);
    if (merge >= 0) return merge;
  }
  // 足够两名同名后优先合第一份，留下普通搭档供旗主应援。
  return autoSlot(r, def);
}
export function retentionValue(r: RunState, o: Owned, focus?: BotFocus): number {
  const d = card(o.def), team = units(r);
  const fit = team.filter(x => x !== o && relatedCards(d,card(x.def))).length;
  const pair = d.archetype === 'pair' && team.filter(x => x.def === d.id).length === 2 ? 12 : 0;
  return ownedValue(o,focus) + Math.min(16,fit * 4) + pair;
}
const EATERS = ['cat', 'worm', 'seal', 'tabby'];

/** 发现：挑想要程度最高的（随手玩随机挑） */
function discover(r: RunState, skill: number, line?: BotFocus) {
  while (r.discover?.length) {
    const opts = r.discover[0].opts;
    if (r.discover[0].mode === 'spell') {
      const i = opts.reduce((b,id,j) => foodValue(r,id,line) > foodValue(r,opts[b],line) ? j : b,0);
      observe(r, 'discover', { options: opts, index: i }, () => pickDiscover(r, i));
      continue;
    }
    const i = skill < 0 ? Math.floor(Math.random() * opts.length)
      : opts.reduce((b, id, j) => (want(r, id, skill, line) > want(r, opts[b], skill, line) ? j : b), 0);
    observe(r, 'discover', { options: opts, index: i }, () => pickDiscover(r, i));
  }
}

/** 法术目标：复刻给份数最多的，转生/遣散给最不值钱的，招募令给最值钱的 */
function spellTarget(r: RunState, id: string, line?: BotFocus): Owned | undefined {
  if (id === 'x_dismiss' && units(r).length < 5) return undefined;
  const us = units(r).filter((o) => spellTargetOk(r, id, o));
  if (id === 'x_echo') return us.find((o) => o.def === 's_fox') ?? us.find((o) => !!card(o.def).pl);
  if (id === 'x_bonepact') return us.find((o) => !o.granted) ?? us[0];
  if (id === 'x_copy') return us.sort((a, b) => b.copies - a.copies)[0];
  const byVal = us.sort((a, b) => ownedValue(a, line) - ownedValue(b, line));
  return id === 'x_recruit' ? byVal[byVal.length - 1] : byVal[0];
}

/** skill 0..1：越高越会凑引擎、越肯刷新；skill < 0 随手玩 */
/** 消费已持有法术并处理溢出；无法使用时保留空间，以免 bot 陷入等待。 */
function useHeld(r: RunState, line?: BotFocus) {
  for (let guard = 0; guard < 20; guard++) {
    let acted = false;
    for (let i = 0; i < handCap(r); i++) {
      const held = r.hand[i];
      if (!isHeldSpell(held)) continue;
      const f = FOOD[held.def];
      const target = f.target ? spellTarget(r, held.def,line) : (!f.spell && foodNeedsTarget(f.id) ? foodTarget(r, f.id,line,held.val) : undefined);
      if (foodNeedsTarget(f.id) && !target) continue;
      if (observe(r, 'cast-held', { spell: held.def, target: target?.oid }, () => castHandSpell(r, HAND_BASE + i, target ? r.queue.indexOf(target) : null)).ok) { acted = true; break; }
    }
    if (acted) continue;
    if (r.rewards?.length) {
      if (observe(r, 'claim-reward', { id: r.rewards[0].id }, () => claimReward(r, r.rewards![0].id))) continue;
      const spell = r.hand.findIndex(isHeldSpell);
      if (spell >= 0) { observe(r, 'discard-hand', { cell: HAND_BASE + spell }, () => discardHandSpell(r, HAND_BASE + spell)); continue; }
      observe(r, 'discard-reward', { id: r.rewards[0].id }, () => discardReward(r, r.rewards![0].id));
      continue;
    }
    break;
  }
}

/** 法术只触发咒印、补给只触发进食；按各自已有引擎估算边际收益。 */
export function foodValue(r: RunState, id: string, focus?: BotFocus): number {
  const f = FOOD[id];
  if (!f || !units(r).length || f.spell && !f.target && !spellTargetOk(r,id,null)) return -30;
  const target = f.spell ? (f.target ? spellTarget(r,id,focus) : undefined) : foodTarget(r,id,focus);
  if (foodNeedsTarget(id) && !target) return -30;
  const trigger = f.spell ? 'spell' : 'food';
  const engines = teamPrepRules(r).filter(rule => rule.on === trigger).reduce((n,rule) => {
    const next = (f.spell ? r.tc.spells : r.tc.foods) + 1;
    const due = !rule.at || rule.at.includes(next);
    return n + supportRuleValue(rule) * (due ? 0.7 : 0.2);
  },0);
  const resource = f.resources;
  const rules = (f.battleRules ?? []).reduce((n,rule) => n + supportRuleValue(rule) * ruleReady(r,rule,target),0);
  const stats = ((f.atk ?? 0) + (f.hp ?? 0)) * (f.n ? Math.min(units(r).length,f.n) : 1) * (f.tmp ? 0.6 : 1);
  const resources = (resource?.charge ?? 0) * 3 + (resource?.seal ?? 0) * 1.5 + (resource?.block ?? 0) * 3
    + (resource?.wounds ? 2 : 0);
  // 余金食谱在付费后仍需保留射击本金。
  if (f.battleRules?.some(rule => rule.scale === 'gold') && r.gold < (f.price ?? PRICE) + 3) return -10;
  return 2 + engines + stats + resources + rules + (f.fx ? 5 : 0)
    + (f.inheritable && card(target?.def ?? units(r)[0].def).archetype === 'supply' ? 3 : 0)
    + (f.spell ? 2 : supportFit(r,f.archetypes,focus) * 0.5);
}
export function foodTarget(r: RunState, id: string, focus?: BotFocus, val?: [number,number]): Owned | undefined {
  const f = FOOD[id];
  if (!f) return undefined;
  const eligible = units(r).filter(o => foodTargetOk(r,id,o,val));
  const priority = (o: Owned) => ownedValue(o,focus) * 0.1 + (EATERS.includes(card(o.def).ab ?? '') ? 6 : 0)
    + ownedPrepRules(o).filter(rule => rule.on === (f.spell ? 'spell' : 'food') && rule.when !== 'otherEvent')
      .reduce((n,rule) => n + supportRuleValue(rule),0)
    + (f.archetypes?.includes(card(o.def).archetype!) ? 5 : 0)
    + (f.battleRules ?? []).reduce((n,rule) => n + supportRuleValue(rule) * ruleReady(r,rule,o),0)
    + (f.resources?.charge ? ownedBattleRules(o).filter(rule => rule.effect === 'release').reduce((n,rule) => n + ruleNumber(rule.n,lvlOf(o.copies)) * 2,0) : 0)
    + (f.resources?.wounds ? ownedBattleRules(o).filter(rule => rule.on === 'hurt' || rule.when === 'half' || rule.when === 'critical').length * 3 : 0)
    + (f.inheritable && card(o.def).archetype === 'supply' ? 5 : 0);
  return eligible.sort((a,b) => priority(b) - priority(a))[0];
}
export function buyBestFood(r: RunState, line?: BotFocus, synergyOnly = false): boolean {
  const opts = r.shop.filter(s => s.kind === 'food' && foodPrice(s) <= r.gold - goldReserve(r))
    .map(s => ({s, value:foodValue(r,s.def,line), target:FOOD[s.def].spell ? (FOOD[s.def].target ? spellTarget(r,s.def,line) : undefined) : foodTarget(r,s.def,line,s.val)}))
    .filter(({s,value,target}) => value > (synergyOnly ? 6 : 0) && (!foodNeedsTarget(s.def) || target && foodTargetOk(r,s.def,target,s.val)))
    .sort((a,b) => b.value / Math.max(1,foodPrice(b.s)) - a.value / Math.max(1,foodPrice(a.s)));
  const best = opts[0];
  if (!best) return false;
  return observe(r,'cast-shop',{spell:best.s.def,target:best.target?.oid,price:foodPrice(best.s)},() => useFood(r,best.s.sid,best.target ? r.queue.indexOf(best.target) : null)).ok;
}
/** 有真实生命代价；只支付有用收益，留至少3生命，绝不改写金币或成长。 */
export function bloodTurn(r: RunState): number {
  let paid = 0;
  for (let slot = 0; slot < r.queue.length; slot++) {
    const o = r.queue[slot];
    if (!o || ownedHp(o) <= 3 || !canPayBlood(r, slot)) continue;
    const useful = ownedPrepRules(o).some(rule => rule.on === 'bloodPay' &&
      (rule.effect === 'buff' || (rule.effect === 'gold' && r.gold < 12) || (rule.effect === 'spell' && (units(r).some(x => card(x.def).archetype === 'rune') || r.hand.some(x => !x)))));
    if (useful && observe(r, 'pay-blood', { slot, oid: o.oid }, () => payBlood(r, slot)).ok) paid++;
  }
  return paid;
}

/** 临时雇工走手牌完成真实买卖；每回合额外周转最多花四枚购入预算。 */
export function tradeTurn(r: RunState, budget = 4): number {
  if (units(r).length < 3 || !teamPrepRules(r).some(rule => rule.on === 'buy' || rule.on === 'sell')) return 0;
  const hand = r.hand.slice(0,handCap(r)).findIndex(o => !o);
  if (hand < 0) return 0;
  const cell = HAND_BASE + hand;
  const value = (copy: RunState) => units(copy).reduce((n,o) => n + o.atkBonus + o.hpBonus + (o.seal ?? 0) + (o.startBlock ?? 0) * 3,0)
    + (copy.hand.filter(isHeldSpell).length + (copy.rewards?.length ?? 0)) * 4
    + copy.shop.filter(s => s.kind === 'food' && foodPrice(s) === 0).length * 3;
  const baseline = value(r);
  const options = r.shop.filter(s => s.kind === 'unit' && itemPrice(s) > 0 && itemPrice(s) <= budget && r.gold >= itemPrice(s) + 3 + goldReserve(r))
    .map(s => {
      const copy = structuredClone(r);
      if (!buy(copy,s.sid,cell).ok || !sell(copy,cell)) return {s,gain:-Infinity};
      return {s,gain:value(copy) - baseline - Math.max(0,r.gold - copy.gold) * 3};
    }).sort((a,b) => b.gain - a.gain);
  const best = options[0];
  if (!best || best.gain <= 0) return 0;
  const price = itemPrice(best.s);
  if (!observe(r,'trade-buy',{unit:best.s.def,cell,price},() => buy(r,best.s.sid,cell)).ok) return 0;
  observe(r,'trade-sell',{cell},() => sell(r,cell));
  return price;
}

/** 留金终端有当场伤害收益；只在已有四名战力时保留少量余金。 */
export function goldReserve(r: RunState): number {
  if (units(r).length < 4) return 0;
  const perGold = units(r).reduce((n,o) => n + ownedBattleRules(o).filter(rule => rule.scale === 'gold').reduce((v,rule) => v + ruleNumber(rule.n,lvlOf(o.copies)),0),0);
  return Math.min(6, Math.ceil(perGold * r.enemy.units.length / 2));
}

/** 升本节奏：3 回合 2 本、之后约每 2 回合升一级（每回合都要打仗，比炉石慢一点）；随手玩只在很便宜时升 */
function tavernUp(r: RunState, skill: number) {
  const cost = tavernPrice(r);
  if (r.tavern >= 6 || r.gold < cost) return;
  const target = Math.min(6, 1 + Math.floor((r.turn - 1) / 2));
  // 认真玩：落后节奏时，等到升完还买得起一张卡（或落后两级）才升，避免整回合空过
  const ok = r.tavern < target && (r.gold - cost >= 3 + goldReserve(r) || (r.tavern < target - 1 && !goldReserve(r)));
  if (skill < 0 ? cost <= 1 && Math.random() < 0.6 : ok) observe(r, 'upgrade', { cost }, () => upgradeTavern(r));
}

/** 手牌：有空位就上场；没空位时比队里最差的强就替换，否则卖掉换钱 */
function playHand(r: RunState, skill: number, line?: BotFocus) {
  for (let k = 0; k < Math.min(HAND_MAX, handCap(r)); k++) {
    const cell = HAND_BASE + k;
    const o = cellAt(r, cell);
    if (!o) continue;
    const same = r.queue.findIndex((t) => t?.def === o.def && t.copies < MAX_COPIES && !t.merc);
    if (same >= 0 && o.copies < MAX_COPIES && !keepPair(r, o.def)) { observe(r, 'move', { from: cell, to: same }, () => moveOwned(r, cell, same)); continue; }
    const empty = r.queue.findIndex((t) => !t);
    if (empty >= 0) { observe(r, 'move', { from: cell, to: empty }, () => moveOwned(r, cell, empty, playPt(r, line))); continue; }
    if (skill < 0) continue;
    let wi = -1, wv = 1e9;
    r.queue.forEach((t, i) => { if (t && retentionValue(r, t, line) < wv) { wv = retentionValue(r, t, line); wi = i; } });
    if (wi >= 0 && wv + 6 < ownedValue(o, line)) { observe(r, 'sell', { slot: wi }, () => sell(r, wi)); observe(r, 'move', { from: cell, to: wi }, () => moveOwned(r, cell, wi, playPt(r, line))); }
    else observe(r, 'sell', { slot: cell }, () => sell(r, cell));
  }
}

export function shopTurn(r: RunState, skill = 1, line?: BotFocus) {
  intro(r, skill, line);
  let tradeSpent = 0;
  for (let guard = 0; guard < 40; guard++) {
    discover(r, skill, line);
    playHand(r, skill, line);
    useHeld(r,line);
    if (skill >= 0) bloodTurn(r);
    tavernUp(r, skill);
    const free = r.shop.find((s) => s.free && s.kind === 'unit');
    const unitsShop = r.shop.filter((s) => s.kind === 'unit');
    const owned = (def: string) => units(r).some((o) => o.def === def && o.copies < MAX_COPIES);
    const score = (def: string) => (owned(def) ? 25 : 0) + want(r, def, skill, line);
    // skill < 0：随手玩（随机买、不吃补给、不刷新、不排站位），用来模拟弱玩家
    const best = skill < 0 ? unitsShop[Math.floor(Math.random() * unitsShop.length)] : free ?? [...unitsShop].sort((a, b) => score(b.def) - score(a.def))[0];
    if (skill >= 0 && r.gold <= goldReserve(r) && !(free && itemPrice(free) === 0)) break;
    if (skill >= 0 && units(r).length >= 3 && r.tc.foods + r.tc.spells < 3 && buyBestFood(r,line,true)) continue;
    if (best && r.gold - (skill >= 0 ? goldReserve(r) : 0) >= itemPrice(best)) {
      let slot = purchaseSlot(r, best.def);
      // 手牌只给 bot 用来接发现；买卡不往手牌里囤
      if (slot >= 0 && isHand(slot) && !cellAt(r, slot)) slot = -1;
      if (slot < 0) {
        let wi = -1;
        let wv = 1e9;
        r.queue.forEach((o, i) => {
          if (o && retentionValue(r, o, line) < wv) {
            wv = retentionValue(r, o, line);
            wi = i;
          }
        });
        if (wv + 6 < want(r, best.def, skill, line)) {
          observe(r, 'sell', { slot: wi }, () => sell(r, wi));
          slot = wi;
        } else slot = -1;
      }
      if (slot >= 0) {
        observe(r, 'buy', { unit: best.def, slot, price: itemPrice(best) }, () => buy(r, best.sid, slot, playPt(r, line)));
        continue;
      }
    }
    if (skill < 0) {
      if (r.gold >= PRICE + 1 && Math.random() < -skill) {
        observe(r, 'reroll', {}, () => reroll(r));
        continue;
      }
      break;
    }
    if (buyBestFood(r,line)) continue;
    const spent = tradeTurn(r,4 - tradeSpent);
    if (spent > 0) { tradeSpent += spent; continue; }
    if (r.gold - goldReserve(r) >= (skill > 0.5 ? 1 : 4)) {
      observe(r, 'reroll', {}, () => reroll(r));
      continue;
    }
    break;
  }
  discover(r, skill, line);
  playHand(r, skill, line);
  if (skill >= 0) arrange(r, skill);
  observe(r, 'end-turn', {}, () => endTurn(r));
  for (let i = 0; i < 40 && (r.discover?.length || r.rewards?.length); i++) {
    discover(r, skill, line);
    if (r.rewards?.length && !observe(r, 'claim-reward', { id: r.rewards[0].id }, () => claimReward(r, r.rewards![0].id)))
      observe(r, 'discard-reward', { id: r.rewards[0].id }, () => discardReward(r, r.rewards![0].id));
  }
}

function eventPick(r: RunState, skill: number, line?: BotFocus) {
  const us = units(r).filter((o) => !o.merc).sort((a, b) => ownedValue(b, line) - ownedValue(a, line));
  const ev = r.event;
  const resolve = (choice: number, slot: number | null = null) => observe(r, 'event-choice', { event: r.event, choice, slot }, () => resolveEvent(r, choice, slot));
  if (skill < 0) resolve(ev === 'treasure' || ev === 'quest' ? 0 : ev === 'fire' && us[0] ? 1 : -1, us[0] ? r.queue.indexOf(us[0]) : null);
  else if (ev === 'camp' && us[0]) resolve(0, r.queue.indexOf(us[0]));
  else if (ev === 'smith' && us.length >= 4) {
    const t = us.find((o) => o.copies < MAX_COPIES);
    resolve(t ? 0 : -1, t ? r.queue.indexOf(t) : null);
  } else if (ev === 'merc') resolve(0);
  else if (ev === 'chaos' && r.lives >= maxLives(r)) resolve(0);
  else if (ev === 'fire') {
    if (r.lives <= 2 && r.lives < maxLives(r)) resolve(2);
    else {
      const t = us.find((o) => fireCopyOk(o) && o.copies % 3 >= 1);
      if (t) resolve(0, r.queue.indexOf(t));
      else if (us[0]) resolve(1, r.queue.indexOf(us[0]));
    }
  } else if (ev === 'treasure' || ev === 'quest') resolve(0);
  else resolve(-1);
  if (r.event) resolve(-1);
}

/** 选路：优先战斗/篝火；心多时打精英；少去商人 */
function pickRoute(r: RunState, skill: number) {
  const opts = nodeOpts(r);
  const val = (i: number) => {
    const k = r.map[r.layer][i].k;
    if (skill < 0) return Math.random();
    return k === 'elite' ? (r.lives >= 6 ? 5 : -2) : k === 'fight' ? 3 : k === 'camp' ? 4 : k === 'treasure' ? 2 : k === 'event' ? 1 : 0;
  };
  const chosen = opts.reduce((b, i) => (val(i) > val(b) ? i : b), opts[0]);
  observe(r, 'route', { opts, chosen, kind: r.map[r.layer][chosen].k }, () => pickNode(r, chosen));
}

/** 非战斗节点：回合结束后处理节点内容并走到下一层。返回 false 表示本回合是战斗 */
export function nodeStep(r: RunState, skill = 1, line?: BotFocus): boolean {
  const n = curNode(r);
  if (!n || isCombat(n.k)) return false;
  observe(r, 'leave-node', {}, () => leaveNode(r));
  if (r.event) observe(r, 'event', { event: r.event }, () => eventPick(r, skill, line));
  observe(r, 'pass-node', {}, () => passNode(r));
  return true;
}

/** 回合开始：按构筑选遗物与装备箱，再根据实际替换增益分配背包装备。 */
function intro(r: RunState, skill: number, line?: BotFocus) {
  while (r.relicPick) { const opts = [...r.relicPick.opts]; const i = skill < 0 ? Math.floor(Math.random() * opts.length) : chooseRelic(r,opts,line); observe(r, 'relic', { opts, index: i }, () => pickRelic(r, i)); }
  if (r.event) eventPick(r, skill, line);
  discover(r, skill, line);
  if (r.chest) {
    const it = r.chest.items;
    const chestValue = (id: string) => Math.max(0,...units(r).map(o => equipmentGain(r,id,o,line))) + EQUIP[id].q + supportFit(r,EQUIP[id].archetypes,line);
    const best = it.reduce((b,id,i) => chestValue(id) > chestValue(it[b]) ? i : b,0);
    observe(r, 'chest', { index: best }, () => chestPick(r, skill < 0 ? Math.floor(Math.random() * it.length) : best));
  }
  if (r.path[r.layer] === undefined) pickRoute(r, skill);
  if (r.merchant && skill >= 0) {
    // 商人开销上限三枚，先保留本回合部署与余金终端预算。
    let spent = 0;
    r.merchant.forEach((g,i) => {
      if (g.kind !== 'equip' || g.sold || spent + g.price > 3 || r.gold < g.price + 3 + goldReserve(r)) return;
      if (Math.max(0,...units(r).map(o => equipmentGain(r,g.id,o,line))) < g.price * 3) return;
      if (observe(r,'buy-goods',{index:i},() => buyGoods(r,i))) spent += g.price;
    });
  }
  equipBag(r,line);
}
/** 只接受严格正增益，每次换装后重新比较退回背包的旧装备。 */
export function equipBag(r: RunState, focus?: BotFocus): number {
  let equipped = 0;
  for (let guard = 0; guard < 20; guard++) {
    const opts = r.bag.flatMap((id,index) => units(r).map(o => ({index,o,gain:equipmentGain(r,id,o,focus)})))
      .sort((a,b) => b.gain - a.gain);
    const best = opts[0];
    if (!best || best.gain <= 0.5) break;
    if (!observe(r,'equip',{index:best.index,slot:r.queue.indexOf(best.o)},() => equipFromBag(r,best.index,r.queue.indexOf(best.o)))) break;
    equipped++;
  }
  return equipped;
}

/** 只读候选启发式：炮留后、遗产交接、同名成对、保护者避开队首。 */
export function formationValue(lineup: readonly Owned[]): number {
  let value = 0;
  lineup.forEach((o, i) => {
    const rules = ownedBattleRules(o), next = lineup[i + 1], prev = lineup[i - 1];
    value += front(o) * (lineup.length - i) * 0.04;
    if (rules.some(r => r.effect === 'charge' && r.when === 'rear')) value += i === 0 ? -24 : 4 + i;
    if (rules.some(r => r.effect === 'release')) value -= i === 0 ? 12 : 0;
    if (rules.some(r => r.effect === 'inherit')) value += next ? 10 + Math.min(10, ownedHp(next) * 0.3) - i : -18;
    if (rules.some(r => r.effect === 'guard' || r.effect === 'share' || r.effect === 'pairEcho')) value += i === 0 ? -12 : 5;
    if (rules.some(r => r.effect === 'summon' && r.on !== 'faint')) value += i === 0 ? -6 : 3;
    if (rules.some(r => r.effect === 'rotate')) value += 5 - i;
    if (next?.def === o.def) value += 18 + (lvlOf(o.copies) !== lvlOf(next.copies) ? 3 : 0);
    for (const rule of ownedPrepRules(o)) {
      if (rule.on !== 'turnEnd') continue;
      if (rule.target === 'ahead') value += prev ? ownedValue(prev) * 0.05 + 3 : -8;
      if (rule.target === 'neighbors') value += (Number(!!prev) + Number(!!next)) * 4;
    }
  });
  return value;
}
export interface BotLineup { oids: number[]; quarry?: number; score: number; trials: number; seed: number }
export const BOT_TRIAL_SEED = 0x51a71e;
/** 固定种子、最多24次模拟。比较合法阵容副本，不消耗真实资源。 */
export function lineupCandidates(r: RunState, limit = 24): Owned[][] {
  const team = units(r), candidates: Owned[][] = [];
  const permutations = (rest: Owned[], head: Owned[] = []) => {
    if (!rest.length) { candidates.push(head); return; }
    rest.forEach((o,i) => permutations(rest.filter((_,j) => i !== j), [...head,o]));
  };
  permutations(team);
  candidates.sort((a,b) => formationValue(b) - formationValue(a));
  const cap = Math.max(1, Math.min(24, limit));
  const out = [team, ...candidates.slice(0, Math.max(1, cap - 5))];
  // 空位有真实机会成本：只允许把至多一名已有队员存进空手牌。
  if (team.length === 5 && r.hand.slice(0, handCap(r)).some(o => !o)
    && team.some(o => ownedBattleRules(o).some(rule => rule.effect === 'summon' && rule.on === 'start'))
    && !team.some(o => ownedBattleRules(o).some(rule => rule.effect === 'coalesce'))) {
    for (const omitted of [...team].sort((a,b) => ownedValue(a) - ownedValue(b)).slice(0,3)) {
      const smaller = candidates.find(c => c[0].oid !== omitted.oid) ?? team;
      out.push(smaller.filter(o => o !== omitted));
    }
  }
  const keys = new Set<string>();
  return out.filter(c => { const k = c.map(o => o.oid).join(','); if (keys.has(k)) return false; keys.add(k); return true; }).slice(0,cap);
}
function trialScore(out: BattleOut): number {
  const hp = new Map(out.init.map(o => [o.uid, o.hp]));
  const sides = new Map(out.init.map(o => [o.uid, o.side]));
  const alive = new Set(out.init.map(o => o.uid));
  for (const e of out.events) {
    if (e.t === 'dmg' || e.t === 'heal') hp.set(e.tgt,e.hp);
    if (e.t === 'buff') hp.set(e.tgt,e.nowHp);
    if (e.t === 'die') alive.delete(e.uid);
    if (e.t === 'summon') { alive.add(e.unit.uid); hp.set(e.unit.uid,e.unit.hp); sides.set(e.unit.uid,e.unit.side); }
  }
  let remaining = 0;
  for (const uid of alive) remaining += (sides.get(uid) === 0 ? 1 : -1) * Math.max(0,hp.get(uid) ?? 0);
  return (out.result === 'win' ? 10000 : out.result === 'lose' ? -10000 : 0) + out.survivors * 50 + remaining;
}
export function chooseLineup(r: RunState, limit = 24): BotLineup {
  const candidates = lineupCandidates(r, limit);
  // 猎物选择只看公开敌阵：优先能被叠标击穿的薄弱中后排。
  const quarry = r.enemy.units.reduce((best,u,i,all) => {
    const priority = (n: number) => 10 / Math.max(1,all[n].hp) + (n > 0 ? 0.3 : 0);
    return priority(i) > priority(best) ? i : best;
  }, 0);
  let best: BotLineup = { oids: units(r).map(o => o.oid), score: -Infinity, trials: 0, seed: BOT_TRIAL_SEED, quarry };
  for (const lineup of candidates) {
    const copy = structuredClone(r);
    copy.queue = [...lineup.map(o => structuredClone(o)), ...Array(5 - lineup.length).fill(null)];
    const omitted = units(r).find(o => !lineup.some(x => x.oid === o.oid));
    if (omitted) { const empty = copy.hand.findIndex(o => !o); if (empty >= 0) copy.hand[empty] = structuredClone(omitted); }
    copy.quarry = quarry;
    // 投影真实回合结束的经营加成；发现奖励留给正常流程处理。
    endTurn(copy);
    const out = simulate(playerTeam(copy), copy.enemy.units, BOT_TRIAL_SEED, copy.relics, simOpts(copy));
    const score = trialScore(out) + formationValue(lineup) * 0.05;
    best.trials++;
    if (score > best.score) best = { oids: lineup.map(o => o.oid), score, trials: best.trials, seed: BOT_TRIAL_SEED, quarry };
  }
  best.trials = candidates.length;
  return best;
}
/** 相同名字的交换用空位或第三种名字作中转，永远不把同名当成普通交换。 */
export function applyLineup(r: RunState, oids: readonly number[]): boolean {
  const existing = units(r);
  if (new Set(oids).size !== oids.length || oids.some(oid => !existing.some(o => o.oid === oid)) || existing.length - oids.length > r.hand.slice(0,handCap(r)).filter(o => !o).length) return false;
  const selected = new Set(oids);
  for (const o of units(r)) if (!selected.has(o.oid)) {
    const hand = r.hand.slice(0,handCap(r)).findIndex(x => !x);
    if (hand < 0 || !observe(r,'bench',{oid:o.oid,cell:HAND_BASE+hand},() => moveOwned(r,r.queue.indexOf(o),HAND_BASE+hand))) return false;
  }
  const swap = (from: number, to: number) => !!observe(r,'move',{from,to},() => moveOwned(r,from,to));
  for (let i = 0; i < oids.length; i++) {
    const from = r.queue.findIndex(o => o?.oid === oids[i]);
    if (from < 0) return false;
    if (from === i) continue;
    const a = r.queue[from]!, b = r.queue[i];
    if (!b || a.def !== b.def || a.merc || b.merc || a.copies >= MAX_COPIES || b.copies >= MAX_COPIES) { if (!swap(from,i)) return false; continue; }
    const emptyQueue = r.queue.findIndex(o => !o);
    const emptyHand = r.hand.slice(0,handCap(r)).findIndex(o => !o);
    const empty = emptyQueue >= 0 ? emptyQueue : emptyHand >= 0 ? HAND_BASE+emptyHand : -1;
    if (empty >= 0) { if (!swap(from,empty) || !swap(i,from) || !swap(empty,i)) return false; }
    else {
      const third = r.queue.findIndex(o => o && o.def !== a.def);
      if (third < 0 || !swap(from,third) || !swap(i,from) || !swap(third,i)) return false;
    }
  }
  return true;
}
export function arrange(r: RunState, skill = 1) {
  const chosen = chooseLineup(r, skill < 0.5 ? 4 : skill < 0.8 ? 8 : 24);
  observe(r,'quarry',{target:chosen.quarry},() => { r.quarry = chosen.quarry; });
  applyLineup(r,chosen.oids);
}
function front(o: Owned) {
  const d = card(o.def);
  let s = ownedHp(o) * 1.2 + ownedAtk(o);
  if (['boar', 'hippo', 'rhino', 'gorilla'].includes(d.ab ?? '') || (o.ench && (EQUIP[o.ench].block || EQUIP[o.ench].atoms?.includes('undying') || EQUIP[o.ench].atoms?.includes('shield')))) s += 6;
  if (['egg', 'cricket', 'sheep', 'deer', 'spider', 'eagle', 'rooster', 'ant', 'flamingo', 'hedgehog', 'badger', 'mammoth', 'turtle'].includes(d.ab ?? '') || d.kws.includes('reborn')) s += 5;
  if (['shark', 'fly', 'tiger', 'horse', 'dog', 'turkey', 'heart', 'giraffe', 'mosquito', 'dolphin', 'croc', 'skunk'].includes(d.ab ?? '') || d.key) s -= 8;
  return s;
}
