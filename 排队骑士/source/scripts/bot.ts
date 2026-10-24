// 启发式 bot：和玩家同一套商店规则选卡、合卡、吃补给、排站位。sim 与幽灵生成共用。
import { card, FOOD } from '../src/core/data';
import { autoSlot, buy, endTurn, foodNeedsTarget, lvlOf, ownedAtk, ownedHp, reroll, sell, useFood, type Owned, type RunState } from '../src/core/run';

const units = (r: RunState) => r.queue.filter((o): o is Owned => !!o);
/** 卡的“想要程度”：阶层为主，同线加分 */
function want(r: RunState, def: string, skill: number) {
  const d = card(def);
  const lines = new Map<string, number>();
  for (const o of units(r)) lines.set(card(o.def).line, (lines.get(card(o.def).line) ?? 0) + 1);
  return d.tier * 10 + d.atk + d.hp + (lines.get(d.line) ?? 0) * 3 * skill + (d.perm ? 4 * skill : 0);
}
const ownedValue = (o: Owned) => card(o.def).tier * 10 + ownedAtk(o) + ownedHp(o) + (lvlOf(o.copies) - 1) * 8;

/** skill 0..1：越高越会凑线、越肯刷新 */
export function shopTurn(r: RunState, skill = 1) {
  for (let guard = 0; guard < 40; guard++) {
    const free = r.shop.find((s) => s.free);
    const unitsShop = r.shop.filter((s) => s.kind === 'unit');
    const owned = (def: string) => units(r).some((o) => o.def === def && o.copies < 6);
    const best = free ?? [...unitsShop].sort((a, b) => (owned(b.def) ? 25 : 0) + want(r, b.def, skill) - (owned(a.def) ? 25 : 0) - want(r, a.def, skill))[0];
    if (best && r.gold >= 3) {
      let slot = autoSlot(r, best.def);
      if (slot < 0) {
        let wi = -1;
        let wv = 1e9;
        r.queue.forEach((o, i) => {
          if (o && ownedValue(o) < wv) {
            wv = ownedValue(o);
            wi = i;
          }
        });
        if (wv + 6 < want(r, best.def, skill)) {
          sell(r, wi);
          slot = wi;
        } else slot = -1;
      }
      if (slot >= 0) {
        buy(r, best.sid, slot);
        continue;
      }
    }
    // 补给
    const food = r.shop.find((s) => s.kind === 'food');
    if (food && r.gold >= 3 && units(r).length) {
      const f = FOOD[food.def];
      const us = units(r);
      let target: Owned | undefined;
      if (f.ench) target = f.ench === 'rotate' ? us.find((o) => !card(o.def).kws.includes('rotate') && !o.ench) : us.find((o) => !o.ench) ;
      else if (f.id === 'f_elixir') target = us.filter((o) => o.copies < 6).sort((a, b) => b.copies - a.copies)[0];
      else target = [...us].sort((a, b) => ownedValue(b) - ownedValue(a))[0];
      if (!foodNeedsTarget(f.id) || target) {
        const slot = target ? r.queue.indexOf(target) : null;
        if (useFood(r, food.sid, slot).ok) continue;
      }
    }
    if (r.gold >= (skill > 0.5 ? 1 : 4)) {
      reroll(r);
      continue;
    }
    break;
  }
  arrange(r);
  endTurn(r);
}

/** 站位：肉在前，跟随类紧贴第 1 位，忍者蹲队尾 */
export function arrange(r: RunState) {
  const us = units(r);
  const role = (o: Owned) => card(o.def).ab ?? '';
  const tail = us.filter((o) => role(o) === 'ninja');
  const follow = us.filter((o) => ['dart', 'dancer', 'snowman', 'backstab', 'cult'].includes(role(o)));
  const rest = us.filter((o) => !tail.includes(o) && !follow.includes(o)).sort((a, b) => front(b) - front(a));
  const out: Owned[] = [];
  if (rest.length) out.push(rest.shift()!);
  out.push(...follow, ...rest, ...tail);
  r.queue = [...out, ...Array(5 - out.length).fill(null)];
}
function front(o: Owned) {
  const d = card(o.def);
  let s = ownedHp(o) * 1.2 + ownedAtk(o);
  if (['guard', 'vigil', 'sentinel', 'knight'].includes(d.ab ?? '') || d.kws.includes('rotate') || o.ench === 'iron' || o.ench === 'amulet') s += 6;
  if (['egg', 'imp', 'graveguard'].includes(d.ab ?? '') || d.kws.includes('reborn')) s += 4;
  if (['spine', 'ritualist', 'reaper', 'storm', 'lord', 'master', 'viper', 'medic', 'incubator', 'heart', 'bloodcaller', 'caliber', 'archon'].includes(d.ab ?? '')) s -= 8;
  return s;
}
