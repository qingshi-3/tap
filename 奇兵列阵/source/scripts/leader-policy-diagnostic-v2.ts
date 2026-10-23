/** diagnostic-v2: separate policy-mismatch supplement. Visible-information policies. This module never imports/calls simulate. */
import * as Run from '../src/core/run';
import * as Content from '../src/core/content';
import { unitDef } from '../src/core/data';
import { levelStats } from '../src/core/engine';
import { levelFromCopies, type Slotted, type UnitDef, type Effect } from '../src/core/types';
import type { RunState } from '../src/core/run';

export type LeaderPolicy = 'A' | 'B';
export interface PolicyAudit { attempted: number; succeeded: number; rejected: number; skipped: number; actions: { kind: string; detail: unknown }[] }
export const newPolicyAudit = (): PolicyAudit => ({ attempted: 0, succeeded: 0, rejected: 0, skipped: 0, actions: [] });
const indexes = [0, 1, 2, 3, 4, 5, 6, 7];
const dragons = new Set(['x_bone', 'x_fire', 'x_frostd', 'x_wind', 'x_brood']);
const own = (r: RunState) => indexes.map(i => ({ i, u: Run.getOwned(r, i) })).filter((x): x is { i: number; u: Slotted } => !!x.u);
const lv = (u: Slotted) => levelFromCopies(u.copies);
const tri = (t: readonly number[] | undefined, n: number) => t?.[n - 1] ?? 0;
const effects = (es: readonly Effect[] | undefined, ops: string[]) => es?.some(e => ops.includes(e.op)) ?? false;
const damageSpell = (d: UnitDef) => effects(d.cast, ['dmg', 'burn']) || effects(d.chargeSkill, ['dmg', 'burn']);
// Summons remain valued as units; they are no longer mislabeled personal damage spells.
const attackUser = (d: UnitDef) => !d.cast || !!d.castUses;
const tags = (d: UnitDef, family: string) => (d.tags ?? []).some(t => t.includes(family));
function action<T>(a: PolicyAudit, kind: string, detail: unknown, fn: () => T): T {
  a.attempted++;
  const value = fn();
  if (value === false || value === 'invalid' || value === 'confirm') a.rejected++;
  else { a.succeeded++; a.actions.push({ kind, detail }); }
  return value;
}
export function visibleStats(u: Slotted) {
  const d = unitDef(u.defId), level = lv(u), stats = levelStats(d.id, level);
  const eq = (u.equips ?? []).map(id => Content.EQUIP_MAP[id]);
  const atk = stats.atk + (u.train?.atk ?? 0) + eq.reduce((n, e) => n + (e.atk ?? 0), 0);
  const hp = stats.hp + 2 * (u.train?.hp ?? 0) + eq.reduce((n, e) => n + (e.hp ?? 0), 0);
  const power = tri(d.traits?.power, level) + (u.train?.power ?? 0) + eq.reduce((n, e) => n + (e.grants?.power ?? 0), 0);
  const armor = tri(d.traits?.armor, level) + eq.reduce((n, e) => n + (e.grants?.armor ?? 0), 0);
  const combo = !!d.traits?.combo || eq.some(e => e.grants?.combo);
  const snipe = !!d.traits?.snipe || eq.some(e => e.grants?.snipe);
  const duel = !!d.traits?.duel || eq.some(e => e.grants?.duel);
  const taunt = !!d.traits?.taunt || eq.some(e => e.grants?.taunt);
  const spell = [...(d.cast ?? []), ...(d.chargeSkill ?? [])].reduce((n, e) => n + (['dmg', 'burn'].includes(e.op) ? tri(e.v, level) + power : e.op === 'summon' ? 2 : 0), 0);
  const physical = attackUser(d) ? Math.max(0, atk) * (combo ? 1.15 : 1) : Math.max(0, atk) * 0.15;
  return { d, atk, hp, power, armor, combo, snipe, duel, taunt, offense: physical + spell * (d.cast ? 0.9 : 0.4), tank: hp + armor * 4 + (d.traits?.reborn ? 4 : 0), spell };
}
const mainDamage = (u: Slotted) => {
  const s = visibleStats(u);
  return damageSpell(s.d) || (attackUser(s.d) && (s.atk >= 3 || s.combo || s.snipe || s.duel || tags(s.d, '输出')));
};
const protectedUnit = (r: RunState, u: Slotted) => u.defId === 'x_argeon' || u.defId === 'x_egg' || (r.general === 'xingjiao' && dragons.has(u.defId) && own(r).filter(x => dragons.has(x.u.defId)).length === 1);

function identityBonus(r: RunState, u: Slotted, p: LeaderPolicy) {
  const s = visibleStats(u), d = s.d, a = p === 'A';
  switch (r.general) {
    case 'argeon': return a ? (s.duel ? 5 : 0) + (attackUser(d) ? s.offense * 0.2 : 0) : (damageSpell(d) ? 4 : 0) + (s.hp < 9 && mainDamage(u) ? 1 : 0);
    case 'zilan': return a ? (d.onFront ? 8 : 0) + (d.onRear ? 6 : 0) : (s.combo ? 5 : 0) + (d.onKill ? 4 : 0) + (d.onFront ? 3 : 0);
    case 'kaleos': return a ? (attackUser(d) ? 3 : -2) + (s.combo ? 5 : 0) + (d.onKill ? 3 : 0) : (damageSpell(d) ? 7 : -1) + (d.chargeSkill && damageSpell(d) ? 3 : 0);
    case 'reva': return a ? s.tank * 0.08 + (attackUser(d) ? 1 : 0) : (s.snipe ? 6 : 0) + (s.duel ? 5 : 0) + (damageSpell(d) ? 3 : 0);
    case 'lilithe': return a ? (effects(d.onRattle, ['summon']) ? 7 : d.onRattle ? 4 : 0) + (tags(d, '召唤') ? 3 : 0) : (damageSpell(d) ? 5 : 0) + s.tank * 0.08;
    case 'kasiva': return a ? (d.onRattle ? 6 : 0) + (effects(d.onRattle, ['summon']) ? 3 : 0) : s.tank * 0.08 + (s.combo ? 4 : 0) + (d.onHurt ? 3 : 0);
    case 'vulkan': return a ? s.tank * 0.18 + (s.snipe ? 2 : 0) : (tags(d, '灼烧') ? 7 : 0) + (s.combo ? 3 : 0) + (damageSpell(d) ? 2 : 0);
    case 'xingjiao': {
      if (dragons.has(d.id)) return 12;
      if (!a && own(r).some(x => dragons.has(x.u.defId))) return mainDamage(u) ? 5 : 0;
      const events = Object.entries(r.eggStats ?? {}).sort((x, y) => y[1] - x[1]);
      const map: Record<string, string> = { death: '亡语', burn: '灼烧', freeze: '寒意', move: '轮换', summon: '召唤' };
      const top = events[0];
      if (top && top[1] > 0 && tags(d, map[top[0]])) return 6;
      return own(r).reduce((n, x) => n + ['亡语', '灼烧', '寒意', '轮换', '召唤'].filter(t => tags(d, t) && tags(unitDef(x.u.defId), t)).length, 0) * 0.7;
    }
    case 'faie': return a ? (mainDamage(u) ? 5 : -3) + (s.snipe || s.duel ? 3 : 0) : (d.traits?.charge && damageSpell(d) ? 9 : 0) + (damageSpell(d) ? 3 : 0) + (d.onHurt ? 2 : 0);
    case 'kara': {
      const sets = own(r).map(x => new Set(unitDef(x.u.defId).keywords ?? []));
      const words = d.keywords ?? [], have = new Set(sets.flatMap(x => [...x]));
      return a ? words.filter(k => !have.has(k)).length * 2.5 + (damageSpell(d) ? 2 : 0) : words.reduce((n, k) => Math.max(n, sets.filter(x => x.has(k)).length), 0) * 2 + (mainDamage(u) ? 2 : 0);
    }
    case 'zirix': return a ? s.tank * 0.17 + (mainDamage(u) ? 2 : 0) : (tags(d, '轮换') ? 6 : 0) + (mainDamage(u) ? 3 : 0) + (d.onFront ? 4 : 0);
    case 'sajj': return a ? (mainDamage(u) ? 5 : 0) + s.tank * 0.08 : (d.traits?.charge && damageSpell(d) ? 9 : 0) + (damageSpell(d) ? 3 : 0);
    case 'hank': return a ? s.offense * 0.15 + (s.hp >= 8 ? 1 : 0) : (damageSpell(d) ? 4 : 0) + (s.combo ? 3 : 0);
    default: return 0;
  }
}
function unitValue(r: RunState, u: Slotted, p: LeaderPolicy) {
  const s = visibleStats(u);
  return s.offense * 1.2 + s.tank * 0.3 + s.d.tier + identityBonus(r, u, p);
}
// ownedId -1 is a read-only scoring descriptor; it is never inserted into RunState.
function draftValue(r: RunState, id: string, p: LeaderPolicy) {
  const u: Slotted = { defId: id, copies: 1, ownedId: -1 }, all = own(r);
  let score = unitValue(r, u, p);
  const same = all.find(x => x.u.defId === id && x.u.copies < 4 && !x.u.temp);
  if (same) score += same.u.copies === 1 ? (p === 'B' && r.general === 'hank' ? 13 : 9) : 4;
  if (all.filter(x => mainDamage(x.u)).length < 2 && mainDamage(u)) score += 7;
  if (all.length < 2 && !mainDamage(u)) score -= 2;
  return score;
}
function mergePairs(r: RunState, audit: PolicyAudit) {
  for (let guard = 0; guard < 8; guard++) {
    const all = own(r), pair = all.flatMap((a, i) => all.slice(i + 1).filter(b => a.u.defId === b.u.defId && a.u.copies === b.u.copies && a.u.copies < 4 && !a.u.temp && !b.u.temp).map(b => [a, b] as const))[0];
    if (!pair) return;
    action(audit, 'merge', pair.map(x => x.u.defId), () => Run.moveSlot(r, pair[0].i, pair[1].i));
  }
}
export function recruitLeader(r: RunState, p: LeaderPolicy, audit: PolicyAudit) {
  for (let guard = 0; r.picks > 0 && guard < 4; guard++) {
    const choices = r.draft.map((id, i) => ({ id, i, score: draftValue(r, id, p) })).sort((a, b) => b.score - a.score);
    const selected = choices[0];
    if (!selected) break;
    const all = own(r), same = all.find(x => x.u.defId === selected.id && x.u.copies === 1 && !x.u.temp);
    let slot = same?.i ?? indexes.find(i => !Run.getOwned(r, i));
    if (slot === undefined) {
      const weak = all.filter(x => !protectedUnit(r, x.u) && Run.canSell(r, x.i)).sort((a, b) => unitValue(r, a.u, p) - unitValue(r, b.u, p))[0];
      if (!weak || selected.score < unitValue(r, weak.u, p) + 3) { audit.skipped++; break; }
      slot = weak.i;
    }
    const kind = Run.placeKind(r, selected.id, slot);
    if (kind === 'invalid') { audit.skipped++; break; }
    const result = action(audit, 'draft', { id: selected.id, slot, kind }, () => Run.takeDraft(r, selected.i, slot!, true));
    if (result === 'invalid' || result === 'confirm') break;
    mergePairs(r, audit);
  }
}

const preference: Record<string, [number[], number[]]> = {
  argeon: [[2, 1, 4, 3], [3, 4, 1, 2]], zilan: [[1, 4, 3, 2], [2, 3, 4, 1]], kaleos: [[1, 3, 4, 2], [2, 4, 3, 1]],
  reva: [[2, 3, 1, 4], [4, 1, 3, 2]], lilithe: [[2, 4, 3, 1], [1, 3, 4, 2]], kasiva: [[2, 4, 1, 3], [3, 4, 2, 1]],
  vulkan: [[3, 4, 2, 1], [1, 2, 3, 4]], xingjiao: [[1, 4, 2, 3], [3, 2, 1, 4]], faie: [[1, 2, 3, 4], [4, 1, 2, 3]],
  kara: [[3, 4, 2, 1], [1, 2, 4, 3]], zirix: [[1, 3, 4, 2], [2, 4, 3, 1]], sajj: [[2, 3, 4, 1], [1, 2, 3, 4]], hank: [[3, 4, 2, 1], [1, 3, 4, 2]],
};
export function promoteLeader(r: RunState, p: LeaderPolicy, audit: PolicyAudit) {
  const ranks = preference[r.general][p === 'A' ? 0 : 1];
  const all = own(r), caster = all.some(x => damageSpell(unitDef(x.u.defId))), charge = all.some(x => !!unitDef(x.u.defId).traits?.charge);
  const scores = (r.promo ?? []).map((id, i) => {
    const def = Content.PASSIVES.find(x => x.id === id);
    let score = def?.general === r.general ? 14 - ranks.indexOf(Number(id.split('_').at(-1))) * 2 : 6;
    if (id === 'kaleos_2' && !caster) score -= 10;
    if (id === 'faie_4' && !charge) score -= 9;
    if (id === 'kasiva_1' && all.length < 5) score -= 10;
    if (id === 'kara_1' && p === 'A') score -= 8;
    if (r.general === 'kara' && p === 'A') {
      const field = all.filter(x => x.i < 5).map(x => x.u);
      const words = new Set(field.flatMap(u => unitDef(u.defId).keywords ?? []));
      const enemyWords = new Set(Run.currentNode(r).lineup.flatMap(u => u ? unitDef(u.defId).keywords ?? [] : []));
      const added = [...enemyWords].filter(w => !words.has(w)).length;
      const recipients = field.filter(u => { const d = unitDef(u.defId); return [...(d.cast ?? []), ...(d.chargeSkill ?? [])].some(e => ['dmg', 'burn', 'heal'].includes(e.op)); });
      if (id === 'kara_3') score = recipients.length && (words.size >= 6 || (r.passives.includes('kara_4') && words.size + added >= 6)) ? 8 + Math.min(4, recipients.length) : 0;
      if (id === 'kara_4') score = added ? 4 + Math.min(6, added) + (Math.floor((words.size + added) / 3) > Math.floor(words.size / 3) ? 2 : 0) : 1;
      // Refraction exchanges every ally's health for at most three front blocks.
      if (id === 'kara_2') {
        const front = field[0], block = front?.train?.block ?? 0;
        const gained = Math.max(0, Math.min(3, words.size) - block);
        const saved = front ? gained * Math.max(1, visibleStats(front).hp / 4) : 0;
        score = saved > words.size * field.length ? 9 : 2;
      }
    }
    if (id === 'faie_3' && p === 'A') score -= 6;
    if (id === 'lilithe_3' && all.filter(x => mainDamage(x.u)).length < 2) score -= 5;
    if (id === 'xingjiao_3' && !all.some(x => dragons.has(x.u.defId))) score -= 4;
    if (id === 'g_surge' && !caster) score -= 7;
    if (id === 'g_wall') score += 2;
    return { id, i, score };
  }).sort((a, b) => b.score - a.score);
  if (scores[0]) action(audit, 'promo', scores[0].id, () => Run.choosePromo(r, scores[0].i));
}

function equipValue(r: RunState, id: string, u: Slotted, slot: number, p: LeaderPolicy) {
  const e = Content.EQUIP_MAP[id], s = visibleStats(u), front = slot === 0;
  let value = (e.atk ?? 0) * (attackUser(s.d) ? 1.2 : 0.1) + (e.hp ?? 0) * (front ? 0.7 : mainDamage(u) ? 0.5 : 0.2);
  if (e.grants?.combo && !s.combo && attackUser(s.d)) value += Math.max(2, s.atk * 0.55);
  if (e.grants?.snipe && !s.snipe && attackUser(s.d)) value += p === 'B' && r.general === 'reva' ? 8 : 4;
  if (e.grants?.duel && !s.duel && attackUser(s.d)) value += r.general === 'argeon' || r.general === 'reva' ? 6 : 3;
  if (e.grants?.taunt && !s.taunt) value += front ? 4 : -3;
  if (e.grants?.armor) value += front ? 4 : 1;
  if (e.grants?.reborn && !s.d.traits?.reborn) value += mainDamage(u) ? 4 : 2;
  if (e.grants?.power) value += (s.d.cast || s.d.chargeSkill) ? (damageSpell(s.d) ? 5 : 2) : 0;
  if (e.afterAttack) value += attackUser(s.d) ? 4 : 0;
  if (e.special === 'hourglass') value += s.d.traits?.charge ? (damageSpell(s.d) ? 6 : 2) : 0;
  if (e.special === 'hammer' && attackUser(s.d)) value += 4;
  if (e.onStart) value += 2;
  return value;
}
export function rewardLeader(r: RunState, p: LeaderPolicy, audit: PolicyAudit) {
  const best = (r.reward ?? []).map((id, i) => ({ i, id, score: Math.max(0, ...own(r).map(x => equipValue(r, id, x.u, x.i, p))) })).sort((a, b) => b.score - a.score)[0];
  if (best) action(audit, 'reward', best.id, () => Run.chooseReward(r, best.i));
}
export function shopLeader(r: RunState, p: LeaderPolicy, audit: PolicyAudit) {
  const shop = r.shop!;
  for (const x of shop.units.map((item, i) => ({ item, i, score: draftValue(r, item.id, p) })).sort((a, b) => b.score - a.score)) {
    if (Run.shopUnitBuysRemaining(r)<=0 || x.item.sold || r.gold < x.item.price) continue;
    const all = own(r), duplicate = all.some(a => a.u.defId === x.item.id && a.u.copies === 1);
    const need = all.length < 6 || all.filter(a => mainDamage(a.u)).length < 2 || duplicate;
    if (!need && x.score < Math.min(...all.map(a => unitValue(r, a.u, p))) + 6) continue;
    if (Run.unitDestination(r, x.item.id) === null) {
      const weak = all.filter(a => !protectedUnit(r, a.u) && Run.canSell(r, a.i)).sort((a, b) => unitValue(r, a.u, p) - unitValue(r, b.u, p))[0];
      if (!weak || x.score < unitValue(r, weak.u, p) + 5) continue;
      action(audit, 'sell-shop-upgrade', weak.u.defId, () => Run.sell(r, weak.i));
    }
    if (Run.unitDestination(r, x.item.id) !== null) action(audit, 'buy-unit', x.item.id, () => Run.buy(r, 'units', x.i));
    mergePairs(r, audit);
  }
  if (shop.pack&&!shop.pack.sold && r.gold >= shop.pack.price + (r.general === 'hank' && p === 'B' ? Run.SIGN_PRICE : 0)) action(audit, 'buy-points', shop.pack.points, () => Run.buy(r, 'pack'));
  for (let i = 0; i < shop.equips.length; i++) {
    const item = shop.equips[i];
    if (!item.sold && r.gold >= item.price && Math.max(0, ...own(r).map(x => equipValue(r, item.id, x.u, x.i, p))) >= 3) action(audit, 'buy-equip', item.id, () => Run.buy(r, 'equips', i));
  }
  action(audit, 'leave-shop', null, () => Run.leaveShop(r));
}

function hireLeader(r: RunState, p: LeaderPolicy, audit: PolicyAudit) {
  if (r.general !== 'hank' || !r.merc || r.merc.sold || r.gold < r.merc.price) return;
  const merc: Slotted = { defId: r.merc.id, copies: 1, ownedId: -1, temp: true };
  if (own(r).length === 8) {
    const weak = own(r).filter(x => !protectedUnit(r, x.u) && Run.canSell(r, x.i)).sort((a, b) => unitValue(r, a.u, p) - unitValue(r, b.u, p))[0];
    if (!weak || unitValue(r, merc, p) < unitValue(r, weak.u, p) + 4) { audit.skipped++; return; }
    action(audit, 'sell-for-merc', weak.u.defId, () => Run.sell(r, weak.i));
  }
  if (!action(audit, 'hire', merc.defId, () => Run.hireMerc(r))) return;
  const hired = own(r).find(x => x.u.temp);
  if (p === 'B' && hired && r.passives.includes('hank_1') && r.gold >= Run.SIGN_PRICE) {
    const permanent = own(r).filter(x => !x.u.temp);
    if (permanent.length < 5 || unitValue(r, hired.u, p) > Math.min(...permanent.map(x => unitValue(r, x.u, p))) + 3) action(audit, 'sign', hired.u.defId, () => Run.signMerc(r, hired.i));
  }
}
function deployLeader(r: RunState, p: LeaderPolicy, audit: PolicyAudit) {
  const all = own(r).map(x => x.u), ranked = [...all].sort((a, b) => unitValue(r, b, p) - unitValue(r, a, p));
  const mandatory = [...all.filter(u => u.defId === 'x_argeon'), ...all.filter(u => u.defId === 'x_egg').slice(0, 2), ...(r.general === 'xingjiao' ? ranked.filter(u => dragons.has(u.defId)).slice(0, 1) : [])];
  const selected = [...mandatory];
  for (const u of ranked.filter(mainDamage).slice(0, 2)) if (!selected.includes(u) && selected.length < 5) selected.push(u);
  for (const u of ranked) if (!selected.includes(u) && selected.length < 5) selected.push(u);
  const spare = ranked.filter(u => !selected.includes(u));
  if (r.general === 'sajj' && p === 'B' && r.passives.includes('sajj_1') && spare.length) {
    const wait = ranked.find(u => unitDef(u.defId).traits?.charge && damageSpell(unitDef(u.defId)));
    const fill = spare.find(u => u !== wait && (!selected.includes(wait!) || [...selected.filter(x => x !== wait), u].filter(mainDamage).length >= 2));
    if (wait && fill && selected.includes(wait)) { selected.splice(selected.indexOf(wait), 1, fill); spare.splice(spare.indexOf(fill), 1, wait); }
  }
  const reserve = r.general === 'sajj' ? [...spare].sort((a, b) => {
    const score = (u: Slotted) => unitValue(r, u, p) + (p === 'B' && r.passives.includes('sajj_1') && unitDef(u.defId).traits?.charge && damageSpell(unitDef(u.defId)) ? 12 : 0);
    return score(b) - score(a);
  }).slice(0, Run.reserveSlots(r)) : [];
  let order = [...selected].sort((a, b) => {
    const front = (u: Slotted) => {
      const s = visibleStats(u);
      return s.tank + (s.taunt ? 15 : 0) + (s.d.onFront ? 8 : 0) - (s.d.onRear ? 30 : 0) - (u.defId === 'x_argeon' && r.passives.includes('argeon_3') ? 50 : 0);
    };
    return front(b) - front(a);
  });
  if (r.general === 'kaleos' && order.length > 1) {
    const candidates = order.filter(u => p === 'A' ? attackUser(unitDef(u.defId)) : damageSpell(unitDef(u.defId)));
    const carry = candidates.sort((a, b) => visibleStats(b).offense - visibleStats(a).offense)[0];
    if (carry) order = r.passives.includes('kaleos_1') ? [carry, ...order.filter(u => u !== carry)] : [...order.filter(u => u !== carry), carry];
  }
  if (r.general === 'kasiva' && order.length > 1) {
    const count = r.passives.includes('kasiva_1') ? 2 : 1;
    const damage = order.filter(mainDamage);
    const possible = order.filter(u => !(damage.length <= count && damage.includes(u))).sort((a, b) => {
      const v = (u: Slotted) => {
        const s = visibleStats(u);
        return (p === 'A' && s.d.onRattle ? 15 : 0) + (p === 'B' ? (s.atk + s.hp) * 0.4 : 0) - unitValue(r, u, p) * 0.3 - (s.d.onRear ? 10 : 0);
      };
      return v(b) - v(a);
    });
    const victims = possible.slice(0, Math.min(count, order.length - 1));
    order = [...order.filter(u => !victims.includes(u)), ...victims];
  }
  if (r.general === 'kasiva' && r.passives.includes('kasiva_3')) {
    const carry = order.filter(u => attackUser(unitDef(u.defId))).sort((a, b) => {
      const score = (u: Slotted) => { const s = visibleStats(u); return s.atk * (s.combo ? 2 : 1) + s.tank * 0.1; };
      return score(b) - score(a);
    })[0];
    if (carry) order = [carry, ...order.filter(u => u !== carry)];
  }
  const bench = [...reserve, ...spare.filter(u => !reserve.includes(u))];
  const targets = [...order.map((u, i) => ({ u, i })), ...bench.map((u, i) => ({ u, i: i + 5 }))];
  for (const { u, i } of targets) {
    const from = own(r).find(x => x.u.ownedId === u.ownedId)?.i;
    if (from !== undefined && from !== i) action(audit, 'deploy', { id: u.defId, from, to: i }, () => Run.moveSlot(r, from, i, 'swap'));
  }
}
export function usefulGeneralPower(r: RunState) {
  const api = Run as unknown as { canTrainGeneral?: (run: RunState) => boolean };
  if (api.canTrainGeneral) return api.canTrainGeneral(r);
  const source = Content as unknown as { generalPowerSources?: (id: string, passives: readonly string[]) => string[] };
  if (source.generalPowerSources) return source.generalPowerSources(r.general, r.passives).length > 0;
  const passive: Record<string, string[]> = { argeon: ['argeon_3'], zilan: ['zilan_2', 'zilan_3'], reva: ['reva_2'], lilithe: ['lilithe_1'], xingjiao: ['xingjiao_3'], faie: ['faie_1'], zirix: ['zirix_1', 'zirix_3'], sajj: ['sajj_2'] };
  if (r.general === 'kaleos' || r.general === 'vulkan') return true;
  if (r.general === 'faie' && r.passives.includes('faie_3')) return false;
  return (passive[r.general] ?? []).some(id => r.passives.includes(id));
}
function trainLeader(r: RunState, p: LeaderPolicy, audit: PolicyAudit) {
  for (const type of Object.keys(r.stash)) for (let guard = 0; r.stash[type] > 0 && guard < 200; guard++) {
    const field = own(r).filter(x => x.i < 5), damage = [...field].filter(x => mainDamage(x.u)).sort((a, b) => visibleStats(b.u).offense - visibleStats(a.u).offense).slice(0, 2);
    const candidates: { to: number | 'general'; score: number }[] = [];
    for (const x of field) {
      const s = visibleStats(x.u), core = damage.some(v => v.u.ownedId === x.u.ownedId);
      let score = 0;
      if (type === 'atk' && attackUser(s.d)) score = (core ? 3 : 0.2) * (s.combo ? 1.2 : 1) / (1 + (x.u.train?.atk ?? 0) * 0.18);
      if (type === 'atk' && r.general === 'argeon' && p === 'A' && x.u.defId === 'x_argeon') score *= 3;
      if (type === 'hp') score = ((x.i === 0 ? 2.2 : 0.5) + (core && s.hp < 14 ? 2 : 0)) / (1 + (x.u.train?.hp ?? 0) * 0.1);
      if (type === 'block' && (x.u.train?.block ?? 0) < 3) score = (x.i === 0 ? 3 : core ? 2 : 1) / (1 + (x.u.train?.block ?? 0));
      if (type === 'power' && (s.d.cast || s.d.chargeSkill)) score = (damageSpell(s.d) ? 2 : 0.7) / (1 + (x.u.train?.power ?? 0) * 0.15);
      if (type === 'power' && p === 'B' && ['faie', 'sajj', 'kaleos'].includes(r.general) && s.d.traits?.charge && damageSpell(s.d)) score *= 1.5;
      if (score > 0) candidates.push({ to: x.i, score });
    }
    if (type === 'power' && usefulGeneralPower(r)) {
      const prefer = (r.general === 'argeon' && r.passives.includes('argeon_3')) || (r.general === 'vulkan' && p === 'A') || (r.general === 'lilithe' && p === 'B') || (r.general === 'zilan' && p === 'B') || r.general === 'reva' || (r.general === 'xingjiao' && p === 'B');
      candidates.push({ to: 'general', score: (prefer ? 3 : 1.5) / (1 + r.genPower * 0.12) });
    }
    const best = candidates.sort((a, b) => b.score - a.score)[0];
    if (!best) break; // legally keep unusable points, never dump them into an ineffective general.
    if (!action(audit, 'train', { type, to: best.to }, () => Run.allocPoint(r, best.to, type))) break;
  }
  for (let guard = 0; r.bag.length > 0 && guard < 32; guard++) {
    const options = r.bag.flatMap((id, bag) => own(r).filter(x => x.i < 5 && (x.u.equips?.length ?? 0) < Run.equipCap(r)).map(x => ({ id, bag, slot: x.i, score: equipValue(r, id, x.u, x.i, p) }))).sort((a, b) => b.score - a.score);
    const best = options[0];
    if (!best || best.score <= 0) break;
    action(audit, 'equip', { id: best.id, to: best.slot }, () => Run.equip(r, best.bag, best.slot));
  }
}
function swapLeader(r: RunState, p: LeaderPolicy, audit: PolicyAudit) {
  if (r.general !== 'reva') return;
  const line = Run.currentNode(r).lineup.map((e, id) => e ? { e, id } : null), moved = new Set<number>();
  const enemyStats = (e: NonNullable<(typeof line)[number]>) => { const d = unitDef(e.e.defId), s = levelStats(d.id, e.e.level ?? 1); return { d, atk: e.e.atk ?? s.atk, hp: e.e.hp ?? s.hp }; };
  const score = (board: typeof line, marked: Set<number>) => {
    const enemy = board.filter((e): e is NonNullable<(typeof line)[number]> => !!e);
    if (!enemy.length) return 0;
    const taunt = enemy.find(e => enemyStats(e).d.traits?.taunt);
    let result = 0;
    for (let i = 0; i < r.slots.length; i++) if (r.slots[i]) {
      const s = visibleStats(r.slots[i]!);
      if (!attackUser(s.d)) continue;
      const target = taunt ?? (s.duel ? board[i] ?? enemy[0] : s.snipe ? enemy.at(-1)! : enemy[0]);
      const t = enemyStats(target);
      result += s.atk * (2 + t.atk + (t.d.cast ? 2 : 0)) / Math.max(1, t.hp) * (p === 'B' ? 1.5 : 0.7);
    }
    // Both frozen/current public skills provide movement debuff; query its public definition at runtime.
    const base = Content.GENERAL_MAP.reva.text.includes('被调动') && Content.GENERAL_MAP.reva.text.includes('−1');
    if (base || r.passives.includes('reva_2')) for (const e of enemy) if (marked.has(e.id)) result += enemyStats(e).atk * (p === 'A' ? 0.65 : 0.35);
    if (r.passives.includes('reva_3') && marked.has(enemy[0].id)) result += enemyStats(enemy[0]).atk * 0.5;
    const last = enemy.at(-1)!;
    if (r.passives.includes('reva_4') && marked.has(last.id)) {
      const heal = enemy.some(e => effects(enemyStats(e).d.cast, ['heal', 'buff']));
      result += heal ? enemyStats(last).atk * 0.5 + 3 : 1;
    }
    return result;
  };
  let current = score(line, moved);
  for (let n = 0; n < Run.swapCap(r); n++) {
    let best: { a: number; b: number; value: number; marked: Set<number> } | undefined;
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) {
      if (!line[a] && !line[b]) continue;
      const next = [...line], marked = new Set(moved);
      if (next[a]) marked.add(next[a]!.id);
      if (next[b]) marked.add(next[b]!.id);
      [next[a], next[b]] = [next[b], next[a]];
      const value = score(next, marked);
      if (value > (best?.value ?? current) + 0.05) best = { a, b, value, marked };
    }
    if (!best) break;
    action(audit, 'swap', [best.a, best.b], () => Run.addSwap(r, best!.a, best!.b));
    [line[best.a], line[best.b]] = [line[best.b], line[best.a]];
    best.marked.forEach(id => moved.add(id)); current = best.value;
  }
}
export function prepareLeader(r: RunState, p: LeaderPolicy, audit: PolicyAudit) {
  hireLeader(r, p, audit);
  deployLeader(r, p, audit);
  trainLeader(r, p, audit);
  // Equipment can change the real carry/taunt; re-evaluate order using current stats once.
  deployLeader(r, p, audit);
  swapLeader(r, p, audit);
  const big = Run.currentNode(r).kind !== 'normal';
  let budget = big ? r.spells.length : r.spells.length >= 2 ? 1 : 0;
  for (let i = 0; i < r.spells.length && budget > 0;) {
    if (r.activeSpells.includes(r.spells[i])) { i++; continue; }
    if (action(audit, 'spell', r.spells[i], () => Run.useSpell(r, i))) budget--; else i++;
  }
}
export function forkLeader(r: RunState, p: LeaderPolicy, audit: PolicyAudit) {
  const field = r.slots.filter((u): u is Slotted => !!u), damage = field.filter(mainDamage).length;
  const choose = r.lives >= (p === 'A' ? 2 : 3) && field.length >= 5 && damage >= 2 ? 'elite' : 'normal';
  action(audit, 'fork', choose, () => Run.pickFork(r, choose));
}
