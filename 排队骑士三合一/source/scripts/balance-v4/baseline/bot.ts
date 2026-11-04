// 启发式 bot：和玩家同一套商店规则选卡、合卡、吃补给、排站位。sim、幽灵生成、整局验收共用。
import { card, EQUIP, FOOD, hasTag, type CardDef, type Line } from './data';
import { autoSlot, buy, chestPick, pickRelic, resolveEvent, MAX_COPIES, endTurn, equipFromBag, pickBranch, foodNeedsTarget, foodPrice, lvlOf, ownedAtk, ownedHp, PRICE, reroll, sell, useFood, type Owned, type RunState } from './run';

const units = (r: RunState) => r.queue.filter((o): o is Owned => !!o);
const tagsOf = (d: CardDef) => (d.tag2 ? [d.line, d.tag2] : [d.line]);
/** 开战卡、通用卡不靠队友，任何阵容都能塞 */
const PLUGIN = (d: CardDef) => hasTag(d, 'start') || hasTag(d, 'any');
/**
 * 卡的“想要程度”：阶层 + 攻血 + 与现有队伍的标签契合度 + 桥接加分。
 * 指定 engine 时偏向该引擎（会混搭插件卡和桥接卡）；不指定时哪个契合拿哪个。
 */
function want(r: RunState, def: string, skill: number, engine?: Line) {
  const d = card(def);
  const team = units(r).map((o) => card(o.def));
  const fit = tagsOf(d).reduce((s, t) => s + team.filter((x) => hasTag(x, t)).length, 0);
  const bridge = d.tag2 && team.some((x) => hasTag(x, d.line)) && team.some((x) => hasTag(x, d.tag2!)) ? 6 : 0;
  const pref = engine ? (hasTag(d, engine) ? 30 : PLUGIN(d) ? 10 : -10) : PLUGIN(d) ? 6 : 0;
  return d.tier * 10 + d.atk + d.hp + pref + (fit * 3 + bridge) * skill + (d.perm ? 4 * skill : 0);
}
const ownedValue = (o: Owned, engine?: Line) =>
  card(o.def).tier * 10 + ownedAtk(o) + ownedHp(o) + (lvlOf(o.copies) - 1) * 8 + (engine && hasTag(card(o.def), engine) ? 30 : 0);
const EATERS = ['cat', 'worm', 'seal', 'tabby'];

/** skill 0..1：越高越会凑引擎、越肯刷新；skill < 0 随手玩 */
export function shopTurn(r: RunState, skill = 1, line?: Line) {
  intro(r, skill, line);
  for (let guard = 0; guard < 40; guard++) {
    const free = r.shop.find((s) => s.free && s.kind === 'unit');
    const unitsShop = r.shop.filter((s) => s.kind === 'unit');
    const owned = (def: string) => units(r).some((o) => o.def === def && o.copies < 6);
    const score = (def: string) => (owned(def) ? 25 : 0) + want(r, def, skill, line);
    // skill < 0：随手玩（随机买、不吃补给、不刷新、不排站位），用来模拟弱玩家
    const best = skill < 0 ? unitsShop[Math.floor(Math.random() * unitsShop.length)] : free ?? [...unitsShop].sort((a, b) => score(b.def) - score(a.def))[0];
    if (best && r.gold >= PRICE) {
      let slot = autoSlot(r, best.def);
      if (slot < 0) {
        let wi = -1;
        let wv = 1e9;
        r.queue.forEach((o, i) => {
          if (o && ownedValue(o, line) < wv) {
            wv = ownedValue(o, line);
            wi = i;
          }
        });
        if (wv + 6 < want(r, best.def, skill, line)) {
          sell(r, wi);
          slot = wi;
        } else slot = -1;
      }
      if (slot >= 0) {
        buy(r, best.sid, slot);
        continue;
      }
    }
    if (skill < 0) {
      if (r.gold >= PRICE + 1 && Math.random() < -skill) {
        reroll(r);
        continue;
      }
      break;
    }
    // 补给
    const food = r.shop.find((s) => s.kind === 'food' && r.gold >= foodPrice(s));
    if (food && units(r).length) {
      const f = FOOD[food.def];
      const us = units(r);
      let target: Owned | undefined;
      if (f.fx) target = [...us].sort((a, b) => ownedValue(b) - ownedValue(a)).find((o) => !o.tfx?.includes(f.fx!));
      else if (f.id === 'f_elixir') target = us.filter((o) => o.copies < 6).sort((a, b) => b.copies - a.copies)[0];
      else if (f.id === 'f_lamp') target = us.find((o) => !o.lamp);
      else target = us.find((o) => EATERS.includes(card(o.def).ab ?? '')) ?? [...us].sort((a, b) => ownedValue(b) - ownedValue(a))[0];
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
  if (skill >= 0) arrange(r);
  endTurn(r);
}

/** 回合开始：开箱拿品质最高的；岔路心多才挑精英；背包装备给最值钱、没装备（或装备更差）的单位 */
function intro(r: RunState, skill: number, line?: Line) {
  while (r.relicPick) pickRelic(r, Math.floor(Math.random() * r.relicPick.opts.length));
  if (r.event) {
    const us = units(r).filter((o) => !o.merc).sort((a, b) => ownedValue(b, line) - ownedValue(a, line));
    const ev = r.event;
    if (skill < 0) resolveEvent(r, -1);
    else if (ev === 'camp' && us[0]) resolveEvent(r, 0, r.queue.indexOf(us[0]));
    else if (ev === 'smith' && us.length >= 4) {
      const t = us.find((o) => o.copies < MAX_COPIES);
      resolveEvent(r, t ? 0 : -1, t ? r.queue.indexOf(t) : null);
    } else if (ev === 'merc') resolveEvent(r, 0);
    else if (ev === 'chaos' && r.lives >= 7) resolveEvent(r, 0);
    else resolveEvent(r, -1);
    if (r.event) resolveEvent(r, -1);
  }
  if (r.chest) {
    const it = r.chest.items;
    const best = it.reduce((b, id, i) => (EQUIP[id].q > EQUIP[it[b]].q ? i : b), 0);
    chestPick(r, skill < 0 ? Math.floor(Math.random() * it.length) : best);
  }
  if (r.branch) {
    const ei = r.branch.findIndex((e) => e.elite?.length);
    pickBranch(r, ei >= 0 && r.lives >= (skill < 0 ? 3 : 6) ? ei : ei >= 0 ? 1 - ei : 0);
  }
  for (let i = r.bag.length - 1; i >= 0; i--) {
    const q = EQUIP[r.bag[i]].q;
    const us = units(r).filter((o) => !o.ench || EQUIP[o.ench].q < q).sort((a, b) => ownedValue(b, line) - ownedValue(a, line));
    if (us[0]) equipFromBag(r, i, r.queue.indexOf(us[0]));
  }
}

/** 站位：肉/大象在前；跟随类紧贴队首；受伤反应排在大象身后；老虎贴在最值钱的技能后；长颈鹿队尾 */
export function arrange(r: RunState) {
  const us = units(r);
  const ab = (o: Owned) => card(o.def).ab ?? '';
  const take = (pred: (o: Owned) => boolean) => {
    const out = rest.filter(pred);
    rest = rest.filter((o) => !out.includes(o));
    return out;
  };
  let rest = [...us];
  const tigers = take((o) => ab(o) === 'tiger');
  const tail = take((o) => ['giraffe', 'bluebird'].includes(ab(o)));
  const hurt = take((o) => ['peacock', 'camel', 'blowfish', 'gorilla', 'thornback', 'idol', 'storm', 'anvil'].includes(ab(o)));
  const follow = take((o) => ['snake', 'kangaroo', 'dodo', 'backstab'].includes(ab(o)));
  const elephant = take((o) => ['elephant', 'drill'].includes(ab(o)));
  rest.sort((a, b) => front(b) - front(a));
  const out: Owned[] = [];
  if (elephant.length) out.push(...elephant, ...hurt);
  else {
    if (rest.length) out.push(rest.shift()!);
    else if (hurt.length) out.push(hurt.shift()!);
    out.push(...follow.splice(0), ...hurt);
  }
  out.push(...follow, ...rest);
  // 老虎贴在最值钱的技能单位身后
  for (const t of tigers) {
    const key = out.findIndex((o) => ['elephant', 'blowfish', 'fly', 'sheep', 'deer', 'croc', 'leopard', 'mammoth'].includes(ab(o)));
    out.splice(key >= 0 ? key + 1 : Math.min(1, out.length), 0, t);
  }
  out.push(...tail);
  r.queue = [...out, ...Array(5 - out.length).fill(null)];
}
function front(o: Owned) {
  const d = card(o.def);
  let s = ownedHp(o) * 1.2 + ownedAtk(o);
  if (['boar', 'hippo', 'rhino', 'gorilla'].includes(d.ab ?? '') || (o.ench && (EQUIP[o.ench].block || EQUIP[o.ench].atoms?.includes('undying') || EQUIP[o.ench].atoms?.includes('shield')))) s += 6;
  if (['egg', 'cricket', 'sheep', 'deer', 'spider', 'eagle', 'rooster', 'ant', 'flamingo', 'hedgehog', 'badger', 'mammoth', 'turtle'].includes(d.ab ?? '') || d.kws.includes('reborn')) s += 5;
  if (['shark', 'fly', 'tiger', 'horse', 'dog', 'turkey', 'heart', 'giraffe', 'mosquito', 'dolphin', 'croc', 'skunk', 'leopard'].includes(d.ab ?? '')) s -= 8;
  return s;
}
