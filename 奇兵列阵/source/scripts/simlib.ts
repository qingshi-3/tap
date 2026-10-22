// 整局模拟共享启发式：sim.ts（S1）、passive-strength.ts（S4）、boss-probe.ts 共用一套，保证口径一致。
import { PASSIVES } from '../src/core/content';
import { unitDef } from '../src/core/data';
import { simulate, levelStats } from '../src/core/engine';
import { addSwap, allocPoint, applyResult, buildBattle, buy, chooseReward, choosePromo, currentNode, equip, getOwned, hireMerc, leaveShop, moveSlot, newRun, pickFork, reserveSlots, rollDraft, screen, signMerc, swapCap, takeDraft, useSpell, type RunState } from '../src/core/run';
import type { RouteNode } from '../src/core/route';
import { levelFromCopies, type Slotted, type UnitDef } from '../src/core/types';
import type { BattleSetup } from '../src/core/engine';

const EGG_TAG: Record<string, string> = { death: '亡语', burn: '灼烧', freeze: '寒意', move: '轮换', summon: '召唤' };

const lvl = (u: Slotted) => levelFromCopies(u.copies);
const tri = (t: [number, number, number] | undefined, l: number) => (t ? t[l - 1] : 0);

/** 粗估单位价值：身材 + 稀有度 + 能力 */
function worth(d: UnitDef, level: number) {
  const s = levelStats(d.id, level);
  return s.atk * 1.4 + s.hp * 0.7 + d.tier * 3 + (d.cast ? 3 : 0) + tri(d.traits?.power, level) * 3 + tri(d.traits?.armor, level) * 3;
}
/** 适合站前排的程度 */
function tank(d: UnitDef, level: number) {
  const s = levelStats(d.id, level), t = d.traits ?? {};
  let v = s.hp + tri(t.armor, level) * 4 + tri(t.thorns, level) * 2 + (t.reborn ? 4 : 0);
  if (d.special === 'keeper') v += 6;
  if (d.onHurt) v += 4;
  if (d.cast || t.snipe || t.power) v -= 8;
  if (d.onRattle?.some(e => e.op === 'summon')) v += 3;
  if (t.taunt) v += 8; // v0.8: 嘲讽优先前排
  return v;
}

const SLOTS_ALL = [0, 1, 2, 3, 4, 5, 6, 7];
function owned(r: RunState) { return SLOTS_ALL.map(i => ({ i, u: getOwned(r, i) })).filter(x => x.u) as { i: number; u: Slotted }[]; }
function factionCount(r: RunState) {
  const c: Record<string, number> = {};
  for (const { u } of owned(r)) c[unitDef(u.defId).faction] = (c[unitDef(u.defId).faction] ?? 0) + 1;
  return c;
}

function pickScore(r: RunState, id: string) {
  const d = unitDef(id), fc = factionCount(r);
  let s = worth(d, 1) + (d.faction !== 'neutral' ? (fc[d.faction] ?? 0) * 1.5 : 0);
  if (owned(r).some(x => x.u.defId === id && x.u.copies === 1)) s += 10;
  if (owned(r).some(x => x.u.defId === id && x.u.copies === 2)) s += 4;
  // v0.8: 主将涌现方向额外权重
  const g = r.general;
  const tags = d.tags ?? [];
  // 轮换（齐兰/阿尔吉昂王誓）
  if ((g === 'zilan' || r.passives.includes('argeon_4')) && tags.some(t => t === '轮换')) s += 5;
  // 决斗（阿尔吉昂剑誓）
  if ((g === 'argeon' || r.passives.includes('argeon_2')) && tags.some(t => t === '决斗')) s += 4;
  // 压轴/连击（卡雷奥斯）
  if (g === 'kaleos' && (tags.some(t => t === '连击') || !!d.cast)) s += 4;
  // 蓄力（萨吉）
  if (g === 'sajj' && tags.some(t => t === '蓄力')) s += 5;
  // 灼烧（瓦尔坎）
  if (g === 'vulkan' && tags.some(t => t === '灼烧')) s += 4;
  // 召唤/亡语（莉莉丝/卡西瓦）
  if ((g === 'lilithe' || g === 'kasiva') && (tags.some(t => t === '亡语' || t === '召唤') || d.onRattle)) s += 4;
  // 寒意/冻结（法伊）
  if (g === 'faie' && tags.some(t => t === '寒意')) s += 4;
  // 星角：偏好龙蛋当前领先的事件类型
  if (g === 'xingjiao' && r.eggStats) {
    const top = (Object.entries(r.eggStats) as [string, number][]).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    if (tags.some(t => t === EGG_TAG[top])) s += 4;
  }
  return s;
}

function doPick(r: RunState) {
  const scored = r.draft.map((id, i) => ({ i, id, s: pickScore(r, id) })).sort((a, b) => b.s - a.s);
  const best = scored[0];
  if (!best) { r.picks = 0; return; }
  const all = owned(r);
  const same = all.find(x => x.u.defId === best.id && x.u.copies === 1);
  let slot: number | undefined = same?.i;
  if (slot === undefined) for (const i of SLOTS_ALL) if (slot === undefined && !getOwned(r, i)) slot = i;
  if (slot === undefined) {
    const weakest = all.filter(x => x.u.copies === 1).sort((a, b) => worth(unitDef(a.u.defId), 1) - worth(unitDef(b.u.defId), 1))[0];
    if (!weakest || worth(unitDef(weakest.u.defId), 1) >= best.s - 4) { r.picks--; if (r.picks > 0) rollDraft(r); return; }
    slot = weakest.i;
  }
  const k = takeDraft(r, best.i, slot, true);
  if (k === 'invalid' || k === 'confirm') { r.picks--; return; }
  // 星角：龙蛋放第一格，让自己更容易拿到
  if (r.general === 'xingjiao' && best.id === 'x_egg' && slot !== 0 && getOwned(r, 0) && getOwned(r, 0)!.defId !== 'x_egg') {
    moveSlot(r, slot, 0);
  }
  const twos = owned(r).filter(x => x.u.copies === 2);
  for (const a of twos) for (const b of twos) if (a.i !== b.i && a.u.defId === b.u.defId && getOwned(r, a.i) && getOwned(r, b.i)) moveSlot(r, a.i, b.i);
}

// ───────────── v0.8 主将专属备战 ─────────────

/** 蕾娃：把敌方最脆的输出依次换到队首（第 n 次换到第 n 格），用满 swapCap */
function revaSwaps(r: RunState) {
  const cap = swapCap(r);
  if (cap <= 0) return;
  const enemy = currentNode(r).lineup.map(e => {
    if (!e) return null;
    const d = unitDef(e.defId), lv = e.level ?? 1, s = levelStats(e.defId, lv);
    const atk = e.atk ?? s.atk, hp = e.hp ?? s.hp;
    return atk * 2 - hp * 0.3 + (d.traits?.snipe ? 3 : 0) + (d.cast ? 3 : 0);
  });
  const order = enemy.map((s, i) => ({ s, i }));
  for (let n = 0; n < cap; n++) {
    const best = order.slice(n).filter(x => x.s != null).sort((a, b) => b.s! - a.s!)[0];
    if (!best || best.i === order[n].i) continue;
    const j = order.indexOf(best);
    addSwap(r, n, j);
    [order[n], order[j]] = [order[j], order[n]];
  }
}

/** 赫克：有余钱就雇本场佣兵；有「长约」且佣兵够强时签下 */
function hankPrep(r: RunState) {
  const m = r.merc;
  if (r.general !== 'hank' || !m || m.sold || r.gold < m.price + 1) return;
  if (!hireMerc(r)) return;
  if (!r.passives.includes('hank_1')) return;
  const at = SLOTS_ALL.find(i => getOwned(r, i)?.temp);
  if (at === undefined) return;
  const mine = owned(r).filter(x => !x.u.temp).map(x => worth(unitDef(x.u.defId), lvl(x.u)));
  if (mine.length < 5 || worth(unitDef(m.id), 1) >= Math.min(...mine)) signMerc(r, at);
}

/** 萨吉预备席得分：蓄力 > 施法 > 高费 */
function reserveScore(u: Slotted) {
  const d = unitDef(u.defId);
  return (d.traits?.charge ? 20 : 0) + (d.cast ? 10 : 0) + d.tier * 3 + lvl(u) * 2;
}

/** 法术：首领 / 精英战全用；普通战手里有 2 张以上时用 1 张 */
function useSpells(r: RunState) {
  const big = currentNode(r).kind !== 'normal';
  let budget = big ? r.spells.length : r.spells.length >= 2 ? 1 : 0;
  for (let i = 0; i < r.spells.length && budget > 0;) { if (useSpell(r, i)) budget--; else i++; }
}

/** 主将专属备战入口 */
function doPrep(r: RunState) {
  useSpells(r);
  if (r.general === 'reva') revaSwaps(r);
  if (r.general === 'hank') hankPrep(r);
}

/** 站位排序键（大的在前）：嘲讽 > 成为队首时 > 高血；在队尾时最后 */
export function fieldKey(u: Slotted) {
  const d = unitDef(u.defId);
  return (d.traits?.taunt ? 2000 : 0) + (d.onFront ? 1000 : 0) - (d.onRear ? 3000 : 0) + tank(d, lvl(u));
}

/** v0.8 站位：嘲讽 > 成为队首时 > 高血；在队尾时的单位放最后；阿尔吉昂固定 slot 0；萨吉先挑预备席（备战区最前） */
function arrange(r: RunState) {
  let all = owned(r).map(x => x.u);
  if (!all.length) { r.slots = Array(5).fill(null); r.bench = Array(3).fill(null); return; }
  const reserve: Slotted[] = [];
  const rn = reserveSlots(r);
  if (rn && all.length >= 4) {
    const pick = [...all].sort((a, b) => reserveScore(b) - reserveScore(a)).slice(0, Math.min(rn, all.length - 3));
    reserve.push(...pick);
    all = all.filter(u => !pick.includes(u));
  }
  const key = fieldKey;
  const lead = all.filter(u => u.defId === 'x_argeon');
  const rest = all.filter(u => u.defId !== 'x_argeon').sort((a, b) => key(b) - key(a));
  const field = [...lead, ...rest].slice(0, 5);
  // 在队尾时：确保真的站在最后一个有人的格子
  const tail = field.filter(u => unitDef(u.defId).onRear);
  let ordered = [...field.filter(u => !unitDef(u.defId).onRear), ...tail];
  // 卡西瓦：队尾会被献祭——放亡语/召唤或最不值钱的单位，「在队尾时」单位挪到倒数第 n+1
  if (r.general === 'kasiva' && ordered.length > 1) {
    const n = r.passives.includes('kasiva_1') ? 2 : 1;
    if (ordered.length > n) {
      const victimScore = (u: Slotted) => { const d = unitDef(u.defId); return (d.onRattle ? 100 : 0) + ((d.keywords ?? []).includes('召唤') ? 30 : 0) - worth(d, lvl(u)) - (d.onRear ? 200 : 0) - (d.traits?.taunt ? 50 : 0); };
      const victims = [...ordered].sort((a, b) => victimScore(b) - victimScore(a)).slice(0, n);
      ordered = [...ordered.filter(u => !victims.includes(u)), ...victims];
    }
  }
  r.slots = [...ordered];
  while (r.slots.length < 5) r.slots.push(null);
  const extra = [...lead, ...rest].slice(5);
  const bench = [...reserve, ...extra];
  r.bench = [bench[0] ?? null, bench[1] ?? null, bench[2] ?? null];
}

/** 培养：法强给施法者或主将，生命/格挡给队首，其余给最强输出；装备依次给队首、最强输出 */
function train(r: RunState) {
  const field = r.slots.map((u, i) => ({ u, i })).filter(x => x.u) as { i: number; u: Slotted }[];
  if (!field.length) return;
  const carry = [...field].sort((a, b) => levelStatsAtk(b.u) - levelStatsAtk(a.u))[0].i;
  const caster = field.find(x => unitDef(x.u.defId).cast)?.i;
  for (const type of Object.keys(r.stash)) {
    while (r.stash[type] > 0) {
      const to = type === 'power' ? (caster ?? 'general') : type === 'hp' || type === 'block' ? 0 : carry;
      if (!allocPoint(r, to, type) && !allocPoint(r, carry, type) && !allocPoint(r, 'general', type)) break;
    }
  }
  let k = 0;
  while (r.bag.length && k < 4) {
    const target = [0, carry, 1, 2][k++];
    if (getOwned(r, target) && !(getOwned(r, target)!.equips?.length)) equip(r, 0, target);
  }
}
const levelStatsAtk = (u: Slotted) => levelStats(u.defId, lvl(u)).atk;

function shop(r: RunState) {
  const s = r.shop!;
  for (let i = 0; i < s.equips.length; i++) if (r.gold >= s.equips[i].price + 2) buy(r, 'equips', i);
  if (r.gold >= s.pack.price) buy(r, 'pack');
  for (let i = 0; i < s.units.length; i++) if (r.gold >= s.units[i].price && pickScore(r, s.units[i].id) >= 18) buy(r, 'units', i);
  leaveShop(r);
}


export interface RunOpts {
  /** 消融实验：开战前改 setup */
  mutateSetup?(setup: BattleSetup): void;
  general: string;
  seed: number;
  /** 第一次升阶强制拿到这个专属被动 */
  forcePassive?: string;
  /** 永远拿不到这个专属被动（换成另一个未拥有的专属） */
  banPassive?: string;
  onBattle?: (r: RunState, setup: BattleSetup, out: ReturnType<typeof simulate>, node: RouteNode) => void;
}
export interface RunOut { r: RunState; wins: number; clear: boolean; reachedPromo: boolean; winsAfterPromo: number; battles: number; faults: number }

/** 升阶：默认拿专属（选项 0）；S4 用 force/ban 改写专属那一项，其余随机性不变 */
function promo(r: RunState, o: RunOpts) {
  const own = r.promo![0];
  const isOwn = PASSIVES.find(p => p.id === own)?.general === r.general;
  if (isOwn) {
    if (o.forcePassive && r.promoCount === 0 && !r.passives.includes(o.forcePassive)) r.promo![0] = o.forcePassive;
    else if (o.banPassive && own === o.banPassive) {
      const alt = PASSIVES.filter(p => p.general === r.general && p.id !== o.banPassive && !r.passives.includes(p.id) && p.id !== o.forcePassive);
      if (alt.length) r.promo![0] = alt[(r.seed >>> 0) % alt.length].id;
    }
  }
  choosePromo(r, 0);
}

export function playRun(o: RunOpts): RunOut {
  const r = newRun(o.general, o.seed);
  let guard = 0, bossDraws = 0, battles = 0, faults = 0, winsAtPromo = -1;
  while (!r.over && guard++ < 300) {
    const sc = screen(r);
    if (sc === 'promo') { if (winsAtPromo < 0) winsAtPromo = r.wins; promo(r, o); continue; }
    if (sc === 'reward') { chooseReward(r, 0); continue; }
    if (sc === 'shop') { shop(r); continue; }
    if (sc === 'fork') { pickFork(r, r.lives >= 2 ? 'elite' : 'normal'); continue; }
    while (r.picks > 0) doPick(r);
    doPrep(r);
    arrange(r);
    train(r);
    const node = currentNode(r);
    const setup = buildBattle(r);
    o.mutateSetup?.(setup);
    const out = simulate({ ...setup, record: false });
    battles++; if (out.fault) faults++;
    o.onBattle?.(r, setup, out, node);
    // 首领平局：游戏里原地重新调阵再打；连平 3 次按败计，避免死循环
    let res = out.result;
    if (res === 'draw' && node.kind === 'boss') { if (++bossDraws >= 3) { res = 'lose'; bossDraws = 0; } } else bossDraws = 0;
    applyResult(r, res, out.gold ?? 0, out.eggStats);
  }
  return { r, wins: r.wins, clear: r.over === 'victory', reachedPromo: winsAtPromo >= 0, winsAfterPromo: winsAtPromo >= 0 ? r.wins - winsAtPromo : 0, battles, faults };
}

export { worth, tank, pickScore };
