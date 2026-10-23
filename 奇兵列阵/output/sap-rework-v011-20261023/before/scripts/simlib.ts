// 整局模拟共享启发式：sim.ts（S1）、passive-strength.ts（S4）、boss-probe.ts 共用一套，保证口径一致。
import { GENERAL_MAP, PASSIVES, EQUIP_MAP } from '../src/core/content';
import { GENERALS, unitDef } from '../src/core/data';
import { simulate, levelStats } from '../src/core/engine';
import { addSwap, allocPoint, beginBattle, finishBattle, buildBattle, buy, chooseReward, choosePromo, currentNode, currentStage, equip, getOwned, generalChoices, hireMerc, leaveShop, moveSlot, newRun, pickFork, reserveSlots, screen, signMerc, swapCap, takeDraft, reroll, freezeDraft, equipCap, canTrainGeneral, canSell, sell, sellPrice, unitDestination, shopUnitBuysRemaining, useSpell, type RunState } from '../src/core/run';
import { preparationStat } from '../src/core/preparation';
import type { RouteNode } from '../src/core/route';
import { levelFromCopies, type Slotted, type UnitDef } from '../src/core/types';
import type { BattleSetup } from '../src/core/engine';

const EGG_TAG: Record<string, string> = { death: '亡语', burn: '灼烧', freeze: '寒意', move: '轮换', summon: '召唤' };

const lvl = (u: Slotted) => levelFromCopies(u.copies);
const tri = (t: [number, number, number] | undefined, l: number) => (t ? t[l - 1] : 0);

/** 粗估单位价值：身材 + 稀有度 + 能力 */
function worth(d: UnitDef, level: number) {
  const s = levelStats(d.id, level);
  return s.atk * 1.4 + s.hp * 0.7 + d.tier * 3 + (d.cast || d.chargeSkill || d.chargeAttack ? 3 : 0) + tri(d.traits?.power, level) * 3 + tri(d.traits?.armor, level) * 3;
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

export type Strategy = 'steady' | 'synergy';
export type Focus = 'summon' | 'charge';
export type SummonFormation = 'natural' | 'relay' | 'conditional' | 'open';
const focusBonus=(d:UnitDef,focus?:Focus)=>focus==='charge'?(d.traits?.charge?8: d.special==='hourglass'||d.special==='keeper'?7:0):focus==='summon'?(d.id==='m_incubator'?12:d.id==='d_pharaoh'||d.id==='d_glass'||d.id==='a_matriarch'?7:(d.tags??[]).includes('召唤')?8:0):0;

function pickScore(r: RunState, id: string, strategy: Strategy = 'synergy') {
  const d = unitDef(id), fc = factionCount(r);
  let s = worth(d, 1) + (d.faction !== 'neutral' ? (fc[d.faction] ?? 0) * 1.5 : 0);
  if (owned(r).some(x => x.u.defId === id && x.u.copies === 1)) s += 10;
  if (owned(r).some(x => x.u.defId === id && x.u.copies === 2)) s += 4;
  if (strategy === 'steady') return s;
  // 主将协同策略
  const g = r.general;
  const tags = d.tags ?? [];
  const faction = GENERALS.find(x => x.id === g)?.faction;
  if (d.faction === faction) s += g === 'kara' ? 8 : 2;
  if (g === 'reva' && (d.traits?.snipe || d.cast)) s += 4;
  if (g === 'zirix' && (d.onRattle || tags.includes('召唤'))) s += 4;
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

function legacyPick(r: RunState, strategy: Strategy) {
  const scored = r.draft.map((id, i) => ({ i, id, s: id ? pickScore(r, id, strategy) : -Infinity })).filter(x => x.id).sort((a, b) => b.s - a.s);
  const best = scored[0];
  if (!best) return false;
  const all = owned(r);
  const same = all.find(x => x.u.defId === best.id && x.u.copies === 1);
  let slot: number | undefined = same?.i;
  if (slot === undefined) for (const i of SLOTS_ALL) if (slot === undefined && !getOwned(r, i)) slot = i;
  if (slot === undefined) {
    const weakest = all.filter(x => x.u.copies === 1 && !['x_egg', 'x_argeon'].includes(x.u.defId)).sort((a, b) => worth(unitDef(a.u.defId), 1) - worth(unitDef(b.u.defId), 1))[0];
    if (!weakest || worth(unitDef(weakest.u.defId), 1) >= best.s - 4) return false;
    slot = weakest.i;
  }
  const k = takeDraft(r, best.i, slot, true);
  if (k === 'invalid' || k === 'confirm') return false;
  // 星角：龙蛋放第一格，让自己更容易拿到
  if (r.general === 'xingjiao' && best.id === 'x_egg' && slot !== 0 && getOwned(r, 0) && getOwned(r, 0)!.defId !== 'x_egg') {
    moveSlot(r, slot, 0);
  }
  const twos = owned(r).filter(x => x.u.copies === 2);
  for (const a of twos) for (const b of twos) if (a.i !== b.i && a.u.defId === b.u.defId && getOwned(r, a.i) && getOwned(r, b.i)) moveSlot(r, a.i, b.i);
  return true;
}

export interface SimAction {
  battle: number; chapter: number; node: number; type: string; ok: boolean;
  goldBefore: number; goldAfter: number; detail: Record<string, unknown>;
}
const bodyWorth = (u: Slotted) => worth(unitDef(u.defId), lvl(u)) + (u.growth?.atk ?? 0)*1.4 + (u.growth?.hp ?? 0)*0.7 + (u.growth?.power ?? 0)*3;
const deployedWorth=(u:Slotted)=>bodyWorth(u)+(u.train?.atk??0)*1.4+(u.train?.hp??0)*1.4+(u.train?.block??0)*3+(u.train?.power??0)*3;
const heroRefined=(r:RunState,refined:boolean)=>refined && (r.general==='hank'||r.general==='xingjiao');
/** Only visible shelves, bodies and prices inform purchases; never simulate candidate battles. */
function recruit(r: RunState, strategy: Strategy, report?: (a: SimAction) => void, focus?:Focus, formation:SummonFormation='open') {
  if (r.economyVersion !== 2) { while(r.picks > 0 && legacyPick(r,strategy)) {} return; }
  const action = (type: string, detail: Record<string, unknown>, fn: () => boolean) => {
    const before=r.gold, ok=fn(); report?.({battle:r.history.length+1,chapter:r.chapter,node:r.node,type,ok,goldBefore:before,goldAfter:r.gold,detail:{...detail,owned:owned(r).map(x=>({id:x.u.defId,copies:x.u.copies,growth:x.u.growth}))}}); return ok;
  };
  // Merging equal two-star bodies costs no gold; use the public movement transaction.
  const mergePairs = () => {
    for (const a of owned(r)) for (const b of owned(r)) if (a.i<b.i && a.u.defId===b.u.defId && a.u.copies===b.u.copies && a.u.copies<4)
      return action('merge',{from:a.i,to:b.i,id:a.u.defId,copies:a.u.copies},()=>moveSlot(r,a.i,b.i)==='merge');
    return false;
  };
  if(focus==='summon' && formation==='open' && owned(r).length>7 && !(r.pendingEggs??0)) {
    const spare=owned(r).filter(x=>canSell(r,x.i)).sort((a,b)=>deployedWorth(a.u)-deployedWorth(b.u))[0];
    if(spare)action('sell',{slot:spare.i,id:spare.u.defId,level:lvl(spare.u),price:sellPrice(spare.u,r),reason:'reserve summon opening'},()=>sell(r,spare.i));
  }
  let guard=0;
  for (;guard<36;guard++) {
    if (mergePairs()) continue;
    const all=owned(r), weakest=all.filter(x=>canSell(r,x.i)).sort((a,b)=>bodyWorth(a.u)-bodyWorth(b.u))[0];
    const ranked=r.draft.map((id,i)=>({id,i,score:id?pickScore(r,id,strategy)+focusBonus(unitDef(id),focus):-Infinity})).filter(x=>x.id).sort((a,b)=>b.score-a.score);
    let bought=false;
    if(r.gold>=3) for(const best of ranked) {
      const same=all.find(x=>x.u.defId===best.id && x.u.copies===1), empty=all.length<(focus==='summon'&&formation==='open'?7:8)?SLOTS_ALL.find(i=>!getOwned(r,i)):undefined;
      let slot=same?.i ?? empty;
      if(slot===undefined && (r.pendingEggs??0)===0 && weakest && best.score>bodyWorth(weakest.u)+5) {
        if(!action('sell',{slot:weakest.i,id:weakest.u.defId,level:lvl(weakest.u),price:sellPrice(weakest.u,r)},()=>sell(r,weakest.i))) return;
        // Successful sales may claim pending eggs; recompute public destination.
        slot=unitDestination(r,best.id) ?? undefined;
      }
      if(slot===undefined) continue;
      // When five are already deployed, save bench space for upgrades or clear improvements.
      if(!same && all.length>=5 && best.score<(weakest?bodyWorth(weakest.u)+2:0)) continue;
      const destination=slot;
      bought=action('buy',{shelf:best.i,id:best.id,slot:destination,merge:!!same},()=>!['invalid','confirm'].includes(takeDraft(r,best.i,destination)));
      if(!bought) return;
      break;
    }
    if(bought) continue;
    // Reserve a visible desirable upgrade for next round; unlocking stale goods costs nothing.
    for(const item of ranked) {
      const keep=owned(r).some(x=>x.u.defId===item.id && x.u.copies<4) && r.gold<3;
      if(!!r.draftLocked?.[item.i]!==keep) action('lock',{shelf:item.i,id:item.id,locked:keep},()=>freezeDraft(r,item.i));
    }
    // Do not pay away a purchase: refresh only when at least 3 gold remains after it.
    if(r.gold>=4 && r.draft.some((id,i)=>!id || !r.draftLocked?.[i])) {
      if(!action('refresh',{},()=>reroll(r))) return;
      continue;
    }
    break;
  }
  if(guard>=36) action('guard',{reason:'recruit action limit'},()=>false);
}

// ───────────── v0.8 主将专属备战 ─────────────

/** 蕾娃：只看可见阵容评分，不模拟胜负；嘲讽仍覆盖狙击和决斗。 */
export function revaSwaps(r: RunState) {
  if (r.general !== 'reva') return;
  const cap = swapCap(r);
  const original = currentNode(r).lineup;
  const board = original.map((entry, id) => entry ? { entry, id } : null);
  const moved = new Set<number>();
  type Enemy = NonNullable<(typeof board)[number]>;
  const stats = (e: Enemy) => {
    const d = unitDef(e.entry.defId), st = levelStats(d.id, e.entry.level ?? 1);
    return { d, atk: e.entry.atk ?? st.atk, hp: e.entry.hp ?? st.hp,
      armor: e.entry.armor ?? tri(d.traits?.armor, e.entry.level ?? 1) };
  };
  // 两个core共享策略，但只对公开技能确实具备的基础减攻计分。
  const baseDisrupt = GENERAL_MAP.reva.text.includes('被调动') && GENERAL_MAP.reva.text.includes('−1');
  const healers = board.filter(e => e && unitDef(e.entry.defId).cast?.some(f => f.op === 'heal')).length;
  const score = (line: typeof board, shifted: Set<number>) => {
    const enemies = line.filter((e): e is Enemy => !!e);
    if (!enemies.length) return 0;
    const taunt = enemies.find(e => stats(e).d.traits?.taunt);
    let value = 0;
    for (let slot = 0; slot < r.slots.length; slot++) {
      const ally = r.slots[slot];
      if (!ally) continue;
      const d = unitDef(ally.defId), eq = ally.equips ?? [];
      const duel = d.traits?.duel || eq.includes('eq_duel');
      const snipe = d.traits?.snipe || eq.includes('eq_bow');
      const target = taunt ?? (duel ? line[slot] ?? enemies[0] : snipe ? enemies.at(-1)! : enemies[0]);
      const t = stats(target);
      const attack = levelStats(ally.defId, lvl(ally)).atk + (ally.train?.atk ?? 0);
      // 可见的低血高威胁目标更适合我方普攻击杀，不假定嘲讽会因换位失效。
      value += Math.max(1, attack - t.armor) * (3 + t.atk + (t.d.cast ? 3 : 0)) / Math.max(1, t.hp);
    }
    if (baseDisrupt || r.passives.includes('reva_2')) for (const e of enemies) {
      if (shifted.has(e.id)) value += (baseDisrupt ? 1 : 0) + (r.passives.includes('reva_2') ? 1 : 0) + stats(e).atk * 0.35;
    }
    const front = enemies[0], rear = enemies.at(-1)!;
    if (r.passives.includes('reva_3') && shifted.has(front.id)) value += 2 + stats(front).atk * 0.6;
    if (r.passives.includes('reva_4') && shifted.has(rear.id)) {
      const t = stats(rear);
      // 孤军阻止接收友方治疗/增益，优先隔离有治疗支援的高威胁受益者。
      value += 1 + healers * (2 + t.atk * 0.3 + t.hp * 0.05);
    }
    return value;
  };
  let value = score(board, moved);
  for (let n = 0; n < cap; n++) {
    let best: { a: number; b: number; score: number; moved: Set<number> } | null = null;
    for (let a = 0; a < board.length; a++) for (let b = a + 1; b < board.length; b++) {
      if (!board[a] && !board[b]) continue;
      const next = [...board], shifted = new Set(moved);
      if (next[a]) shifted.add(next[a]!.id);
      if (next[b]) shifted.add(next[b]!.id);
      [next[a], next[b]] = [next[b], next[a]];
      const candidate = score(next, shifted);
      if (candidate > (best?.score ?? value) + 0.05) best = { a, b, score: candidate, moved: shifted };
    }
    if (!best || !addSwap(r, best.a, best.b)) break;
    [board[best.a], board[best.b]] = [board[best.b], board[best.a]];
    for (const id of best.moved) moved.add(id);
    value = best.score;
  }
}

/** 赫克：有余钱就雇本场佣兵；有「长约」且佣兵够强时签下 */
function hankPrep(r: RunState, refined=false, report?: (a:SimAction)=>void) {
  const m = r.merc;
  if (r.general !== 'hank' || !m || m.sold || r.gold < m.price) return;
  if (refined && owned(r).filter(x=>!x.u.temp).length>=5 && worth(unitDef(m.id),1)<Math.min(...owned(r).filter(x=>!x.u.temp).map(x=>deployedWorth(x.u)))) return;
  const goldBefore=r.gold;
  if (!hireMerc(r)) return;
  report?.({battle:r.history.length+1,chapter:r.chapter,node:r.node,type:'hireMerc',ok:true,goldBefore,goldAfter:r.gold,detail:{id:m.id,price:m.price}});
  if (!r.passives.includes('hank_1')) return;
  const at = SLOTS_ALL.find(i => getOwned(r, i)?.temp);
  if (at === undefined) return;
  const mine = owned(r).filter(x => !x.u.temp).map(x => refined?deployedWorth(x.u):worth(unitDef(x.u.defId), lvl(x.u)));
  if (r.gold>=3 && (mine.length < 5 || worth(unitDef(m.id), 1) >= Math.min(...mine))) {const before=r.gold; const ok=signMerc(r,at); report?.({battle:r.history.length+1,chapter:r.chapter,node:r.node,type:'signMerc',ok,goldBefore:before,goldAfter:r.gold,detail:{id:m.id}});}
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
function doPrep(r: RunState, refined=false, report?: (a:SimAction)=>void,focus?:Focus) {
  useSpells(r);
  if (r.general === 'hank' && !(focus==='summon' && owned(r).length>=7)) hankPrep(r,refined,report);
}

/** 站位排序键（大的在前）：嘲讽 > 成为队首时 > 高血；在队尾时最后 */
export function fieldKey(u: Slotted) {
  const d = unitDef(u.defId);
  return (d.traits?.taunt ? 2000 : 0) + (d.onFront ? 1000 : 0) - (d.onRear ? 3000 : 0) + tank(d, lvl(u)) + (u.growth?.hp ?? 0) + (u.growth?.atk ?? 0)*0.2;
}

/** v0.8 站位：嘲讽 > 成为队首时 > 高血；在队尾时的单位放最后；阿尔吉昂保证上场但按被动站位；萨吉先挑预备席（备战区最前） */
function arrange(r: RunState, refined=false, focus?:Focus,formation:SummonFormation='open') {
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
  // 光誓主将保护在后；剑誓/盾誓按身材与被动争前排，不硬锁第一格。
  const lead: Slotted[] = [];
  const rest = all.sort((a, b) => {
    const score = (u: Slotted) => key(u) + (u.defId === 'x_argeon' ? (r.passives.includes('argeon_1') ? 2000 : r.passives.includes('argeon_3') ? -500 : 0) : 0);
    return score(b) - score(a);
  });
  const mandatory = rest.filter(u => u.defId==='x_argeon' || (!heroRefined(r,refined) && u.defId==='x_egg'));
  const rank=heroRefined(r,refined)||focus?[...rest].sort((a,b)=>{
    const score=(u:Slotted)=>u.defId==='x_egg'?(r.passives.includes('xingjiao_4')?8:-100):deployedWorth(u)+focusBonus(unitDef(u.defId),focus);
    return score(b)-score(a);
  }):rest;
  const activeSummoner=rank.some(u=>[unitDef(u.defId).cast,unitDef(u.defId).chargeSkill,unitDef(u.defId).onPulse].some(es=>es?.some(e=>e.op==='summon')));
  let tokenValue=0;
  for(const u of rank) for(const effects of [unitDef(u.defId).cast,unitDef(u.defId).chargeSkill,unitDef(u.defId).onPulse])
    for(const e of effects??[]) if(e.op==='summon') tokenValue=Math.max(tokenValue,tri(e.v,lvl(u))*1.4+(tri(e.v2,lvl(u))||tri(e.v,lvl(u)))*0.7);
  const replacement=rank.filter(u=>!mandatory.includes(u))[4-mandatory.length];
  const conditionalOpen=formation==='conditional' && all.length<=7 && !!replacement && deployedWorth(replacement)<tokenValue;
  const fieldCap=focus==='summon' && activeSummoner && (formation==='open'||conditionalOpen) ? Math.max(4,all.length-3):5;
  const chosen = [...mandatory, ...rank.filter(u => !mandatory.includes(u))].slice(0, fieldCap);
  let field = rest.filter(u => chosen.includes(u));
  if(focus==='summon'&&formation==='relay') field=[...field.filter(u=>unitDef(u.defId).onRattle?.some(e=>e.op==='summon')),...field.filter(u=>!unitDef(u.defId).onRattle?.some(e=>e.op==='summon'))];
  // 在队尾时：确保真的站在最后一个有人的格子
  const tail = field.filter(u => unitDef(u.defId).onRear);
  let ordered = [...field.filter(u => !unitDef(u.defId).onRear), ...tail];
  if(focus==='charge') {
    const batteries=ordered.filter(u=>['keeper','hourglass'].includes(unitDef(u.defId).special??''));
    const casters=ordered.filter(u=>!!unitDef(u.defId).traits?.charge);
    if(batteries.length && casters.length) {
      const first=batteries[0], caster=casters[0];
      ordered=[...ordered.filter(u=>u!==first&&u!==caster),first,caster];
      if(unitDef(first.defId).special==='keeper') ordered=[first,caster,...ordered.filter(u=>u!==first&&u!==caster)];
    }
  }
  // 卡西瓦：队尾会被献祭——放亡语/召唤或最不值钱的单位，「在队尾时」单位挪到倒数第 n+1
  if (r.general === 'kasiva' && ordered.length > 1) {
    const n = r.passives.includes('kasiva_1') ? 2 : 1;
    if (ordered.length > n) {
      const victimScore = (u: Slotted) => { const d = unitDef(u.defId); return (d.onRattle ? 100 : 0) + ((d.keywords ?? []).includes('召唤') ? 30 : 0) - worth(d, lvl(u)) - (d.onRear ? 200 : 0) - (d.traits?.taunt ? 50 : 0); };
      const victims = [...ordered].sort((a, b) => victimScore(b) - victimScore(a)).slice(0, n);
      ordered = [...ordered.filter(u => !victims.includes(u)), ...victims];
    }
  }
  const extra = [...lead, ...rest].filter(u => !field.includes(u));
  const desired = [...ordered, ...Array(Math.max(0, 5 - ordered.length)).fill(null), ...reserve, ...extra];
  for (let i = 0; i < 8; i++) {
    const u = desired[i];
    if (!u) continue;
    const at = SLOTS_ALL.find(j => getOwned(r, j)?.ownedId === u.ownedId);
    if (at !== undefined && at !== i) moveSlot(r, at, i, 'swap');
  }
}

/** 培养：法强给施法者或主将，生命/格挡给队首，其余给最强输出；装备依次给队首、最强输出 */
function train(r: RunState, refined=false) {
  const field = r.slots.map((u, i) => ({ u, i })).filter(x => x.u) as { i: number; u: Slotted }[];
  if (!field.length) return;
  const carry = [...field].sort((a, b) => levelStatsAtk(b.u) - levelStatsAtk(a.u))[0].i;
  const caster: number | 'general' | undefined = r.general === 'argeon' && r.passives.includes('argeon_3') ? 'general' : field.find(x => [unitDef(x.u.defId).cast,...(refined?[unitDef(x.u.defId).chargeSkill]:[])].some(es=>es?.some(e=>['dmg','heal','burn','chill'].includes(e.op))))?.i;
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
const levelStatsAtk = (u: Slotted) => preparationStat(u,'atk');

function shop(r: RunState, report?: (a:SimAction)=>void, improved=false,policy:'equipment'|'boon'='boon') {
  const s = r.shop!;
  const purchase=(kind:'equips'|'pack'|'units'|'boon',i=0)=> {const before=r.gold; const price=kind==='boon'?s.boon?.price:kind==='pack'?s.pack?.price:s[kind][i]?.price; const ok=buy(r,kind,i); report?.({battle:r.history.length+1,chapter:r.chapter,node:r.node,type:'specialBuy',ok,goldBefore:before,goldAfter:r.gold,detail:{kind,i,price,owned:owned(r).map(x=>({id:x.u.defId,copies:x.u.copies,growth:x.u.growth}))}}); return ok;};
  if(policy==='equipment') {
    const ranked=s.equips.map((item,i)=>{const e=EQUIP_MAP[item.id],eligible=owned(r).some(x=>(x.u.equips?.length??0)<equipCap(r));const useful=!!e&&(!(e.grants?.power)||owned(r).some(x=>powerUser(x.u)))&&(e.special!=='hourglass'||owned(r).some(x=>unitDef(x.u.defId).traits?.charge));return {i,score:eligible&&useful?(e.atk??0)*1.5+(e.hp??0)*.65+Object.keys(e.grants??{}).length*3+2:-1};}).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score);
    for(const item of ranked)if(r.gold>=s.equips[item.i].price&&!s.equips[item.i].sold)purchase('equips',item.i);
  }
  if(improved && s.boon && !s.boon.sold && r.gold>=s.boon.price && (s.boon.id!=='g_elite'||owned(r).length<=4)) purchase('boon');
  for (let i = 0; i < s.equips.length; i++) if (!s.equips[i].sold && r.gold >= s.equips[i].price + 2) purchase('equips', i);
  if (s.pack && r.gold >= s.pack.price) purchase('pack');
  for (let i = 0; i < s.units.length; i++) if (shopUnitBuysRemaining(r)>0 && !s.units[i].sold && r.gold >= s.units[i].price && unitDestination(r,s.units[i].id)!==null && pickScore(r, s.units[i].id) >= 18) purchase('units', i);
  leaveShop(r);
}


export interface RunOpts {
  /** 消融实验：开战前改 setup */
  mutateSetup?(setup: BattleSetup): void;
  recordBattles?: boolean;
  heroRefinement?: boolean;
  focus?: Focus;
  summonFormation?: SummonFormation;
  playerPolicy?: PlayerPolicy;
  chargeIntent?: boolean;
  legacyAuditClassifier?: boolean;
  shopPolicy?: 'equipment'|'boon';
  investResources?: boolean;
  recovery?: 'wrongBuy'|'skipRefresh'|'skipFirstIntendedRefresh';
  general: string;
  seed: number;
  strategy?: Strategy;
  /** Legacy probes may opt out; paired balance runs must use legal choices. */
  requireLegalGeneral?: boolean;
  /** 第一次升阶强制拿到这个专属被动 */
  forcePassive?: string;
  /** 永远拿不到这个专属被动（换成另一个未拥有的专属） */
  banPassive?: string;
  onAction?: (action: SimAction) => void;
  onSettled?: (r: RunState) => void;
  /** Public current-state commands only; called before the one authoritative battle simulation. */
  beforeBattle?: (r: RunState) => void;
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
  let choice=0;
  if((o.heroRefinement||o.playerPolicy) && (r.general==='hank'||r.general==='xingjiao')) {
    const weights:Record<string,number>=r.general==='hank'?{hank_4:14,hank_1:r.wins<10?10:2,hank_3:r.wins<10?7:1,hank_2:0}:{xingjiao_1:15,xingjiao_2:4,xingjiao_3:r.genPower>0?10:2,xingjiao_4:8};
    choice=r.promo!.map((id,i)=>({i,score:weights[id]??5})).sort((a,b)=>b.score-a.score)[0].i;
  }
  if(o.playerPolicy && !['hank','xingjiao'].includes(r.general)) {
    const c=playerCombos(owned(r).map(x=>x.u),!!o.legacyAuditClassifier);
    const fit=(id:string)=>{const p=PASSIVES.find(p=>p.id===id);const need=p?.need;return (p?.general===r.general?5:4)+(need==='charge'&&c.charge||need==='summon'&&c.summon||need==='rattle'&&c.death||need==='chill'&&c.freeze?5:0)+(id==='g_drill'&&r.wins<10?4:0);};
    choice=r.promo!.map((id,i)=>({i,s:fit(id)})).sort((a,b)=>b.s-a.s)[0].i;
  }
  const id=r.promo![choice], gold=r.gold;
  const ok=choosePromo(r, choice);
  o.onAction?.({battle:r.history.length+1,chapter:r.chapter,node:r.node,type:'tactic',ok,goldBefore:gold,goldAfter:r.gold,detail:{id,promoCount:r.promoCount}});
}

export function playRun(o: RunOpts): RunOut {
  if (o.requireLegalGeneral && !generalChoices(o.seed).includes(o.general)) throw new Error('Illegal general for seed');
  const r = newRun(o.general, o.seed);
  let guard = 0, bossDraws = 0, battles = 0, faults = 0, winsAtPromo = -1;
  while (!r.over && guard++ < 300) {
    const sc = screen(r);
    if (sc === 'promo') { if (winsAtPromo < 0) winsAtPromo = r.wins; promo(r, o); continue; }
    if (sc === 'reward') { const index=o.playerPolicy?(r.reward??[]).map((id,i)=>({i,score:(EQUIP_MAP[id]?.atk??0)*1.5+(EQUIP_MAP[id]?.hp??0)*.65+Object.keys(EQUIP_MAP[id]?.grants??{}).length*3})).sort((a,b)=>b.score-a.score)[0]?.i??0:0; chooseReward(r,index); continue; }
    if (sc === 'shop') { shop(r,o.onAction,!!o.heroRefinement||!!o.focus||!!o.playerPolicy,o.shopPolicy); continue; }
    if (sc === 'fork') {
      let choice:'elite'|'normal'=r.lives>=2?'elite':'normal';
      if(o.playerPolicy) {choice='normal';const stage=currentStage(r);if(stage.type==='fork'&&o.playerPolicy!=='casual'&&r.lives===3) {const enemyHp=stage.elite.lineup.reduce((n,u)=>n+(u?.hp??(u?levelStats(u.defId,u.level??1).hp:0)),0);const mine=r.slots.reduce((n,u)=>n+(u?playerValue(u).total:0),0);const combo=playerCombos(r.slots.filter((u):u is Slotted=>!!u),!!o.legacyAuditClassifier);if(mine>enemyHp*1.4&&(combo.charge&&combo.battery||combo.summon&&combo.summonPayoff||combo.death&&combo.deathPayoff))choice='elite';}
      }
      pickFork(r,choice);continue; }
    if(o.playerPolicy) playerPreparation(r,o);
    else {
    // A valuable long-term contract must be evaluated before refreshes spend its 3-gold signing budget.
    if(o.heroRefinement && r.general==='hank' && r.passives.includes('hank_1')) hankPrep(r,true,o.onAction);
    recruit(r, o.strategy ?? 'synergy', o.onAction,o.focus,o.summonFormation);
    doPrep(r,!!o.heroRefinement,o.onAction,o.focus);
    arrange(r,!!o.heroRefinement,o.focus,o.summonFormation);
    train(r,!!o.heroRefinement);
    }
    if (r.general === 'reva') revaSwaps(r);
    o.beforeBattle?.(r);
    const node = currentNode(r);
    const setup = buildBattle(r);
    o.mutateSetup?.(setup);
    const out = simulate({ ...setup, record: o.recordBattles ?? false });
    battles++; if (out.fault) { faults++; break; }
    o.onBattle?.(r, setup, out, node);
    // 不把平局伪造为败局；连续确定性首领平局终止并标为未通关。
    const res = out.result;
    if (res === 'draw' && node.kind === 'boss') { if (++bossDraws >= 3) break; } else bossDraws = 0;
    const goldBeforeCommit=r.gold;
    beginBattle(r, res, out.gold ?? 0, out.eggStats);
    if(r.economyVersion===2 && !o.mutateSetup) {
      const signature=(entries:BattleSetup['player'])=>JSON.stringify(entries.map(u=>u && 'ownedId' in u?{id:u.ownedId,growth:u.growth??{}}:null));
      const ok=r.prepCommitted===true && signature(setup.player)===signature(r.slots);
      o.onAction?.({battle:battles,chapter:r.chapter,node:r.node,type:'endPrep',ok,goldBefore:goldBeforeCommit,goldAfter:r.gold,detail:{committed:r.prepCommitted,previewMatchesCommittedGrowth:ok}});
      if(!ok) {faults++;break;}
    }
    if (!finishBattle(r)) { faults++; break; }
    o.onSettled?.(r);
  }
  return { r, wins: r.wins, clear: r.over === 'victory', reachedPromo: winsAtPromo >= 0, winsAfterPromo: winsAtPromo >= 0 ? r.wins - winsAtPromo : 0, battles, faults: faults + (guard >= 300 ? 1 : 0) };
}

export { worth, tank, pickScore };


/** Explicit player-audit policies; legacy probes never enter this path. */
export type PlayerPolicy='growth'|'upgrade'|'mechanism'|'casual';
export function playerValue(u:Slotted) {
  const d=unitDef(u.defId),lv=lvl(u),t=d.traits??{};
  const base=levelStats(u.defId,lv);
  const powered=[d.cast,d.chargeSkill].some(es=>es?.some(e=>['dmg','heal','burn','chill'].includes(e.op)));
  const basic=(t.idle?0:base.atk*1.5)+base.hp*.65+tri(t.armor,lv)*3+tri(t.thorns,lv)*2+(t.combo?3:0)+(t.splash?3:0)+(t.reborn?4:0);
  const training=(u.train?.atk??0)*1.5+(u.train?.hp??0)*1.3+(u.train?.block??0)*2+(powered?(u.train?.power??0)*2:0);
  const growth=(u.growth?.atk??0)*1.5+(u.growth?.hp??0)*.65+(powered?(u.growth?.power??0)*2:0);
  const equipment=(u.equips??[]).reduce((n,id)=>n+(EQUIP_MAP[id]?.atk??0)*1.5+(EQUIP_MAP[id]?.hp??0)*.65+3,0);
  const effects=[d.cast,d.chargeSkill,d.onRattle,d.onAllyFaint,d.afterAttack,d.onFront,d.onPulse];
  const ability=effects.reduce((n,es)=>n+(es??[]).reduce((v,e)=>v+(['dmg','burn','chill'].includes(e.op)?tri(e.v,lv)*.7:e.op==='summon'?(tri(e.v,lv)+tri(e.v2,lv))*.45:e.op==='revive'?5:2),0),0)+(d.special?2:0);
  return {base:basic,training,growth,equipment,ability,total:basic+training+growth+equipment+ability};
}
const powerUser=(u:Slotted)=>[unitDef(u.defId).cast,unitDef(u.defId).chargeSkill].some(es=>es?.some(e=>['dmg','heal','burn','chill'].includes(e.op)));
export function playerCombos(bodies:Slotted[],legacy=false) {
  const defs=bodies.map(u=>unitDef(u.defId));
  return {
    summon:defs.some(d=>[d.onAllyFaint,d.onRattle,d.cast,d.chargeSkill,d.onPulse].some(es=>es?.some(e=>e.op==='summon'))),
    summonPayoff:defs.some(d=>d.onAllySummon||d.special==='incubator'||d.special==='pharaoh'),
    charge:defs.some(d=>d.traits?.charge),battery:defs.some(d=>playerBattery(d,legacy)),
    death:defs.some(d=>d.onRattle),deathPayoff:defs.some(d=>d.onAllyFaint),
    growth:defs.some(d=>d.prep?.some(e=>e.event==='endPrep'||e.event==='buy'||e.event==='sell')),
    freeze:defs.some(d=>[d.cast,d.chargeSkill,d.afterAttack].some(es=>es?.some(e=>e.op==='chill'||e.op==='freeze'))),freezePayoff:defs.some(d=>d.onEnemyFreeze),
  };
}
const blockedRefreshRuns=new WeakSet<RunState>();
function playerPreparation(r:RunState,o:RunOpts) {
  const policy=o.playerPolicy!;
  const command=(type:string,detail:Record<string,unknown>,fn:()=>boolean)=> {
    const goldBefore=r.gold,shelf=[...r.draft],ok=fn();o.onAction?.({battle:r.history.length+1,chapter:r.chapter,node:r.node,type,ok,goldBefore,goldAfter:r.gold,detail:{...detail,shelf}});return ok;
  };
  const value=(u:Slotted)=>playerValue(u).total;
  const legacy=!!o.legacyAuditClassifier;
  const route=o.chargeIntent?'charge':playerSelectedRoute(r,legacy);
  const mechanism=(d:UnitDef)=> {
    if(o.chargeIntent&&playerBattery(d,legacy)&&owned(r).some(x=>unitDef(x.u.defId).traits?.charge))return 20;
    if(playerFamilies(d,legacy).includes(route))return 7;
    const c=playerCombos(owned(r).map(x=>x.u),!!o.legacyAuditClassifier);
    if(c.summon && (d.onAllySummon||d.special==='incubator'))return 5;
    if(c.charge && playerBattery(d,legacy))return 5;
    if(c.death && d.onAllyFaint)return 4;
    if(c.freeze && d.onEnemyFreeze)return 4;
    return 0;
  };
  if(o.recovery==='wrongBuy'&&r.history.length===0&&r.gold>=3) {
    const i=r.draft.findIndex(Boolean),slot=SLOTS_ALL.find(i=>!getOwned(r,i));
    if(i>=0&&slot!==undefined) {const id=r.draft[i];if(command('recoveryBuy',{id,slot},()=>!['invalid','confirm'].includes(takeDraft(r,i,slot))))command('recoverySell',{id,slot,price:sellPrice(getOwned(r,slot)!,r)},()=>sell(r,slot));}
  }
  let skippedRefresh=false;
  let guard=0;
  for(;guard<40;guard++) {
    const all=owned(r);let merged=false;
    for(const a of all) {
      const b=all.find(b=>b.i>a.i&&b.u.defId===a.u.defId&&b.u.copies===a.u.copies&&a.u.copies<4&&!a.u.temp&&!b.u.temp);
      if(b){command('merge',{from:a.i,to:b.i,id:a.u.defId},()=>moveSlot(r,a.i,b.i)==='merge');merged=true;break;}
    }
    if(merged)continue;
    const candidates=r.draft.flatMap((id,i)=> {
      if(!id)return [];
      const duplicate=all.find(x=>x.u.defId===id&&x.u.copies===1&&!x.u.temp);
      const fresh:Slotted={defId:id,ownedId:-1,copies:1};
      const upgrade=duplicate?value({...duplicate.u,copies:2})-value(duplicate.u):0;
      const d=unitDef(id),engine=(d.prep??[]).filter(e=>['endPrep','buy','sell'].includes(e.event)).length;
      const score=value(fresh)+(duplicate?(policy==='upgrade'?14:8)+upgrade:0)+(policy==='growth'?engine*4:policy==='mechanism'?mechanism(d):0);
      return [{id,i,score,duplicate,fresh}];
    }).sort((a,b)=>b.score-a.score);
    let purchased=false;
    if(r.gold>=3)for(const item of candidates) {
      let dst=item.duplicate?.i??SLOTS_ALL.find(i=>!getOwned(r,i));
      const weak=all.filter(x=>canSell(r,x.i)).sort((a,b)=>value(a.u)-value(b.u))[0];
      if(!item.duplicate&&all.length>=5&&weak&&item.score<value(weak.u)+2)continue;
      if(dst===undefined&&weak&&!(r.pendingEggs??0)&&item.score>value(weak.u)+4) {
        if(!command('sell',{slot:weak.i,id:weak.u.defId,price:sellPrice(weak.u,r),lostValue:playerValue(weak.u)},()=>sell(r,weak.i)))return;
        dst=unitDestination(r,item.id)??undefined;
      }
      if(dst===undefined)continue;
      const slot=dst;
      purchased=command('buy',{shelf:item.i,id:item.id,slot,merge:!!item.duplicate},()=>!['invalid','confirm'].includes(takeDraft(r,item.i,slot)));
      if(!purchased)return;
      break;
    }
    if(purchased)continue;
    if(o.recovery==='skipRefresh'&&r.history.length===0&&!skippedRefresh){skippedRefresh=true;break;}
    if(policy!=='casual'&&r.gold>=4&&r.draft.some((id,i)=>!id||!r.draftLocked?.[i])) {if(o.recovery==='skipFirstIntendedRefresh'&&!blockedRefreshRuns.has(r)){blockedRefreshRuns.add(r);command('blockedRefresh',{reason:'first actual intended refresh, no compensation'},()=>true);break;}if(!command('refresh',{},()=>reroll(r)))return;continue;}
    for(let i=0;i<r.draft.length;i++)if(r.draft[i]) {
      const keep=r.gold<3&&owned(r).some(x=>x.u.defId===r.draft[i]&&x.u.copies<4);
      if(keep!==!!r.draftLocked?.[i])command('lock',{shelf:i,locked:keep},()=>freezeDraft(r,i));
    }
    break;
  }
  if(guard===40)command('guard',{},()=>false);
  // Free mercs are optional bodies, never preferred over a trained permanent carry.
  if(r.general==='hank'&&owned(r).length<8)hankPrep(r,true,o.onAction);
  const all=owned(r).map(x=>x.u),mandatory=all.filter(u=>u.defId==='x_argeon');
  const ranked=[...all].sort((a,b)=> {
    const score=(u:Slotted)=>u.defId==='x_egg'?-100:value(u)+(policy==='mechanism'?mechanism(unitDef(u.defId)):0);
    return score(b)-score(a);
  });
  const reserve:Slotted[]=[];
  if(r.general==='sajj'&&ranked.length>=6)reserve.push(...ranked.filter(u=>!mandatory.includes(u)).sort((a,b)=>reserveScore(b)-reserveScore(a)).slice(0,Math.min(reserveSlots(r),ranked.length-5)));
  const chosen=[...mandatory,...ranked.filter(u=>!mandatory.includes(u)&&!reserve.includes(u))].slice(0,5);
  let field=[...chosen].sort((a,b)=>fieldKey(b)-fieldKey(a));
  if(policy==='mechanism') {
    const death=field.filter(u=>unitDef(u.defId).onRattle?.some(e=>e.op==='summon'));
    field=[...death,...field.filter(u=>!death.includes(u))];
    const battery=field.find(u=>playerBattery(unitDef(u.defId),legacy));
    const charge=field.find(u=>!!unitDef(u.defId).traits?.charge);
    if(battery&&charge)field=[battery,charge,...field.filter(u=>u!==battery&&u!==charge)];
  }
  if(r.general==='kasiva'&&field.length>1){const n=Math.min(r.passives.includes('kasiva_1')?2:1,field.length-1);const victims=[...field].sort((a,b)=>((unitDef(b.defId).onRattle?12:0)-value(b)*.25)-((unitDef(a.defId).onRattle?12:0)-value(a)*.25)).slice(0,n);field=[...field.filter(u=>!victims.includes(u)),...victims];}
  const desired=[...field,...Array(5-field.length).fill(null),...reserve,...ranked.filter(u=>!chosen.includes(u)&&!reserve.includes(u))];
  for(let i=0;i<8;i++)if(desired[i]) {
    const at=SLOTS_ALL.find(j=>getOwned(r,j)?.ownedId===desired[i].ownedId);
    if(at!==undefined&&at!==i)command('arrange',{from:at,to:i},()=>moveSlot(r,at,i,'swap')!=='invalid');
  }
  useSpells(r);
  if(o.investResources!==false) {
    const bodies=r.slots.flatMap((u,i)=>u?[{u,i}]:[]);
    for(const type of Object.keys(r.stash))while(r.stash[type]>0) {
      const eligible=bodies.filter(x=>type!=='power'||powerUser(x.u));
      const target=type==='hp'||type==='block'?bodies[0]:[...eligible].sort((a,b)=>(type==='power'?playerValue(b.u).ability-playerValue(a.u).ability:preparationStat(b.u,'atk')-preparationStat(a.u,'atk')))[0];
      if(type==='power'&&canTrainGeneral(r)&&(!target||['kaleos','vulkan','zirix','faie','argeon'].includes(r.general))) {if(!command('train',{slot:'general',id:r.general,point:type},()=>allocPoint(r,'general',type)))break;continue;}
      if(!target)break;
      if(!command('train',{slot:target.i,id:target.u.defId,point:type},()=>allocPoint(r,target.i,type)))break;
    }
    for(let n=0;n<r.bag.length&&r.bag.length;) {
      const id=r.bag[n],e=EQUIP_MAP[id];
      const eligible=bodies.filter(x=>(x.u.equips?.length??0)<equipCap(r));
      const target=[...eligible].sort((a,b)=>((e?.hp??0)>0?fieldKey(b.u)-fieldKey(a.u):value(b.u)-value(a.u)))[0];
      if(!target||!command('equip',{slot:target.i,id},()=>equip(r,n,target.i)))n++;
    }
  }
}

/** Select a visible archetype from invested bodies, not future offers or battle outcomes. */
export function playerRoute(bodies:Slotted[],legacy=false) {
  const scores:Record<string,number>={summon:0,charge:0,freeze:0,burn:0,rotation:0,duel:0,defense:0,growth:0};
  for(const u of bodies) {
    const d=unitDef(u.defId),v=1+(lvl(u)-1)*.5+playerValue(u).growth*.03;
    const effects=[d.cast,d.chargeSkill,d.onRattle,d.onAllyFaint,d.afterAttack,d.onPulse,d.onStart].flatMap(es=>es??[]);
    if(effects.some(e=>e.op==='summon'))scores.summon+=v;
    if(d.traits?.charge||playerBattery(d,legacy))scores.charge+=v;
    if(effects.some(e=>e.op==='chill'||e.op==='freeze')||d.onEnemyFreeze)scores.freeze+=v;
    if(effects.some(e=>e.op==='burn'))scores.burn+=v;
    if(d.traits?.rotate||d.onFront||d.onRear)scores.rotation+=v;
    if(d.traits?.duel||d.onDuelKill)scores.duel+=v;
    if(d.traits?.armor||d.traits?.thorns||effects.some(e=>e.op==='heal'||e.op==='block'))scores.defense+=v;
    if(d.prep?.length)scores.growth+=v;
  }
  return Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
}

export function playerFamilies(d:UnitDef,legacy=false) {
 const es=[d.cast,d.chargeSkill,d.onRattle,d.onAllyFaint,d.afterAttack,d.onPulse,d.onStart].flatMap(x=>x??[]);const out:string[]=[];
 if(es.some(e=>e.op==='summon')||d.onAllySummon||['incubator','pharaoh'].includes(d.special??''))out.push('summon');
 if(d.traits?.charge||playerBattery(d,legacy))out.push('charge');
 if(es.some(e=>e.op==='chill'||e.op==='freeze')||d.onEnemyFreeze)out.push('freeze');
 if(es.some(e=>e.op==='burn'))out.push('burn');
 if(d.traits?.rotate||d.onFront||d.onRear)out.push('rotation');
 if(d.traits?.duel||d.onDuelKill)out.push('duel');
 if(d.traits?.armor||d.traits?.thorns||es.some(e=>e.op==='heal'||e.op==='block'))out.push('defense');
 if(d.prep?.length)out.push('growth');return out;
}
export function playerSelectedRoute(r:RunState,legacy=false) {
 const preferred:Record<string,string>={faie:'freeze',vulkan:'burn',zilan:'rotation',argeon:'duel',kaleos:'charge',lilithe:'summon',kasiva:'summon',sajj:'charge',xingjiao:'summon'};
 const bodies=owned(r).map(x=>x.u),pref=preferred[r.general];
 return pref&&bodies.some(u=>!unitDef(u.defId).unique&&playerFamilies(unitDef(u.defId),legacy).includes(pref))?pref:playerRoute(bodies,legacy);
}

export function playerBattery(d:UnitDef,legacy=false) {
 if(legacy)return d.special==='keeper'||d.special==='hourglass';
 return d.special==='hourglass'||[d.onAttacked,d.onHurt,d.onStart,d.cast,d.chargeSkill,d.afterAttack,d.onAllyFaint].some(es=>es?.some(e=>e.op==='charge'&&e.to!=='self'));
}
