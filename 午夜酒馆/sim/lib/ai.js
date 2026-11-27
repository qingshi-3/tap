'use strict';
// 启发式代打 AI（不调用大模型）。
// 战斗：枚举 1~3 人的所有上阵排列 → 用游戏自己的 E.forecast 粗筛 → 前 K 名在状态副本上完整跑一遍
//       「出手 + Boss 行动 + 回合末结算」→ 选「本波结束时预期剩余血量」最高的方案。
//       换牌：对若干弃牌方案抽样模拟（不偷看牌堆顺序），收益够大才换。
// 商店：按 档位 × 流派契合度 / 价格 打分贪心购买，参数都在 DEFAULT_PARAMS 里可调。

const DEFAULT_PARAMS = {
  level: 'expert',         // expert = 全量推演 + 换牌抽样；novice = 只挑本手伤害最高、不换牌（新手下限）
  topK: 6,                 // 粗筛后进入完整模拟的方案数
  discardSamples: 2,       // 每个换牌方案抽样次数
  discardMinGain: 4,       // 换牌至少要多换回这么多「预期血量」
  discardReserveValue: 3,  // 留一次换牌给后面回合的价值
  // 商店
  tierValue: { C: 1, B: 3, A: 5, S: 7.5, SSS: 10 },
  themeSynergy: 0.35,      // 每张同流派卡 / 秘宝让流派物品价值 +35%
  heroPackValue: 6.5,      // 招募包基础价值（随牌组变大递减）
  inscPackValue: 6,
  slotValue: { slot1: 4.5, slot2: 4.5, slot3: 5, hand: 2.5 },
  slotDecay: 0.8,          // 同一个位置每多升 1 级价值 ×0.8
  minValuePerGold: 0.75,   // 性价比低于这个就不买
  rerollIfBestBelow: 1.1,  // 货架最好的东西性价比低于此值才考虑刷新
  maxRerolls: 2,
  goldReserveFromWave: 3,  // 从第几波开始为利息留钱
  goldReserve: 10          // 留多少金币吃利息（每 5G 1 利息）
};

function deepClone(obj, memo = new Map()) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (memo.has(obj)) return memo.get(obj);
  if (Array.isArray(obj)) {
    const arr = new Array(obj.length);
    memo.set(obj, arr);
    for (let i = 0; i < obj.length; i++) arr[i] = deepClone(obj[i], memo);
    return arr;
  }
  if (obj instanceof Set) {
    const s = new Set();
    memo.set(obj, s);
    for (const v of obj) s.add(deepClone(v, memo));
    return s;
  }
  const out = {};
  memo.set(obj, out);
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    // heroPassive / bossCfg / intent 只读，共享引用即可
    if (k === 'heroPassive' || k === 'bossCfg') out[k] = v;
    else out[k] = deepClone(v, memo);
  }
  return out;
}

// partial=false 时只枚举满 3 人（或封 3 号位时满 2 人）的排列；只有空位有收益时才需要枚举空位
function arrangements(hand, maxSlot, partial = true) {
  const res = [];
  const n = hand.length;
  for (let a = 0; a < n; a++) {
    if (partial || n < 2) res.push([hand[a], null, null]);
    for (let c = 0; c < n; c++) {
      if (c === a) continue;
      if (partial || maxSlot < 3 || n < 3) res.push([hand[a], hand[c], null]);
      if (maxSlot >= 3) {
        if (partial || n < 3) { res.push([hand[a], null, hand[c]]); res.push([null, hand[a], hand[c]]); }
        for (let d = 0; d < n; d++) {
          if (d === a || d === c) continue;
          res.push([hand[a], hand[c], hand[d]]);
        }
      }
    }
  }
  if (partial || n < 2) {
    if (maxSlot >= 3) for (let a = 0; a < n; a++) { res.push([null, hand[a], null]); res.push([null, null, hand[a]]); }
    else for (let a = 0; a < n; a++) res.push([null, hand[a], null]);
  }
  // 同名同数值的牌（比如 3 张初始剑客）互换位置结果完全一样，去重
  const seen = new Set();
  return res.filter((slots) => {
    const key = slots.map((h) => (h ? cardSig(h) : '-')).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cardSig(h) {
  const s = [h.tplId, h.atk, h.shieldVal, h.knifeCount, h.applyPoison, h.redSeal ? 1 : 0, h.glassBlade ? 1 : 0, h.greedBadge ? 1 : 0, h.ironPlated ? 1 : 0, h.spendAcc || 0].join(',');
  return s;
}

class HeuristicAI {
  constructor(params = {}) {
    this.p = { ...DEFAULT_PARAMS, ...params };
    this.dmgMemo = 0;
    this.shieldMemo = 0;
  }

  // ===== 战斗 =====
  // 预估未来每回合 Boss 打进来的伤害（扣掉平均护盾）
  futureLoss(sim, b, roundFrom, bossLeft, dmgNow) {
    const D = sim.D;
    const est = Math.max(1, dmgNow, this.dmgMemo * 0.85);
    let rounds = bossLeft / est;
    const heavy = b.bossCfg.heavyDmg;
    let loss = 0;
    let r = roundFrom;
    while (rounds > 0) {
      const frac = Math.min(1, rounds);
      const raw = r > b.maxRounds ? Math.round(heavy * D.BERSERK_MULT) : heavy * 0.85;
      loss += Math.max(0, raw - this.shieldMemo) * frac;
      rounds -= 1;
      r += 1;
      if (r > D.HARD_ROUND_CAP) { loss += 400 + 400 * rounds; break; } // 到安全上限还打不完 = 判负，剩得越多越差
    }
    return loss;
  }

  // 用 E.forecast 粗估方案价值：本波结束时预期剩余血量
  quickScore(sim, b, slots, rem) {
    const fc = sim.E.forecast(b, slots, rem);
    const bossTotal = b.bossHp + b.bossShield;
    if (fc.willDirectKill) return { score: b.squadHp + 0.01 * fc.directDmg, fc, kill: true };
    let incoming = b.intent ? (b.intent.dmg || 0) : 0;
    if (fc.willBreak) incoming = 0;
    if (incoming > 0 && b.bossFrost > 0) incoming = Math.round(incoming * (b.bossFrozen ? 0.5 : Math.max(0.55, 1 - b.bossFrost * 0.05)));
    const hpLoss = Math.max(0, incoming - fc.shieldTotal);
    const hpAfter = b.squadHp - hpLoss;
    if (hpAfter <= 0 && !b.relics.some((r) => r.id === 'r_bld_immortal')) return { score: -1000 + fc.directDmg / bossTotal, fc };
    const dealt = fc.directDmg + fc.poisonEndDmg;
    if (fc.willPoisonKill) return { score: hpAfter, fc, kill: true };
    let left = Math.max(0, bossTotal - dealt);
    let score = hpAfter - this.futureLoss(sim, b, b.round + 1, left, dealt);
    if (b.bossCharging && !fc.willBreak) score -= Math.max(0, b.bossCfg.ultDmg - this.shieldMemo);
    return { score, fc };
  }

  // 在副本上完整执行一回合（出手 + Boss 行动 + 回合末）
  fullScore(sim, slotsIdx) {
    const b0 = sim.battle;
    const box = deepClone({ b: b0, roster: sim.run.roster });
    const b = box.b;
    const slots = slotsIdx.map((i) => (i < 0 ? null : b.hand[i]));
    const used = new Set(slots.filter(Boolean));
    const rem = b.hand.filter((h) => !used.has(h));
    const bossBefore = b.bossHp + b.bossShield;
    const res = sim.E.executeStrike(b, slots, rem, box.roster);
    if (b.bossHp <= 0) return { score: b.squadHp + 0.01 * res.directDmg, dmg: res.directDmg, kill: true, shield: b.squadShield };
    const shieldBeforeBoss = b.squadShield;
    const willUlt = b.bossCharging && !b.bossStunned;
    sim.E.onBossActAndRoundEnd(b, slots, rem, b.intent, box.roster);
    if (b.bossHp <= 0) return { score: b.squadHp, dmg: bossBefore - b.bossShield, kill: true, shield: shieldBeforeBoss };
    if (b.squadHp <= 0) return { score: -1000 + res.directDmg / bossBefore, dmg: res.directDmg, shield: shieldBeforeBoss };
    const left = b.bossHp + b.bossShield;
    const dealt = Math.max(0, bossBefore - left);
    let score = b.squadHp - this.futureLoss(sim, b, b.round + 1, left, dealt);
    if (willUlt) score -= Math.max(0, b.bossCfg.ultDmg - this.shieldMemo);
    return { score, dmg: dealt, shield: shieldBeforeBoss };
  }

  bestPlay(sim, b, useFull = true) {
    const maxSlot = b.slot3Locked ? 2 : 3;
    const partial = b.hand.some((h) => h.emptySlotMult || h.devourLeftRatio) || (b.heroPassive && b.heroPassive.emptySlotExtraMult) || b.relics.some((r) => r.id === 'r_empty_bounty' || r.id === 'r_lone_mult');
    const cands = arrangements(b.hand, maxSlot, partial);
    const scored = [];
    for (const slots of cands) {
      const used = new Set(slots.filter(Boolean));
      const rem = b.hand.filter((h) => !used.has(h));
      const q = this.quickScore(sim, b, slots, rem);
      scored.push({ slots, q });
    }
    scored.sort((x, y) => y.q.score - x.q.score);
    if (!useFull) return { slots: scored[0].slots, score: scored[0].q.score, kill: scored[0].q.kill, dmg: scored[0].q.fc.directDmg };
    this._lastQuickBest = scored[0].q.score;
    let best = null;
    for (const c of scored.slice(0, this.p.topK)) {
      const idx = c.slots.map((h) => (h ? b.hand.indexOf(h) : -1));
      const f = this.fullScore(sim, idx);
      if (!best || f.score > best.score) best = { slots: c.slots, ...f };
    }
    return best;
  }

  cardWorth(h) {
    return (h.atk || 0) + (h.shieldVal || 0) * 0.8 + (this.p.tierValue[h.tier] || 1) * 6 + (h.redSeal ? 40 : 0);
  }

  // 抽样评估一个换牌方案（在副本上执行游戏的 onDiscard + 抽牌，牌堆顺序重新洗，不偷看）
  sampleDiscard(sim, uids) {
    let total = 0;
    const n = this.p.discardSamples;
    for (let s = 0; s < n; s++) {
      const box = deepClone({ b: sim.battle, roster: sim.run.roster });
      const b = box.b;
      b.drawPile = sim.G.shuffle(b.drawPile);
      const picked = new Set(uids);
      const discarded = b.hand.filter((h) => picked.has(h.uid));
      b.hand = b.hand.filter((h) => !picked.has(h.uid));
      const remaining = b.hand.slice();
      b.discardsLeft -= 1;
      sim.E.onDiscard(b, discarded, remaining);
      b.discardPile.push(...discarded);
      sim.drawToHandSize.call({ battle: b }); // 用游戏原版抽牌逻辑
      if (b.bossHp <= 0) { total += b.squadHp; continue; }
      total += this.bestPlay(sim, b, false).score;
    }
    return total / n;
  }

  // 新手档：只看本手伤害最高，不换牌（下限参考）
  chooseGreedy(sim) {
    const b = sim.battle;
    const cands = arrangements(b.hand, b.slot3Locked ? 2 : 3, true);
    let best = null;
    for (const slots of cands) {
      const used = new Set(slots.filter(Boolean));
      const fc = sim.E.forecast(b, slots, b.hand.filter((h) => !used.has(h)));
      const v = fc.directDmg + fc.poisonEndDmg + fc.shieldTotal * 0.01;
      if (!best || v > best.v) best = { v, slots };
    }
    return { type: 'strike', slots: best.slots };
  }

  chooseBattleAction(sim) {
    const b = sim.battle;
    if (this.p.level === 'novice') return this.chooseGreedy(sim);
    const best = this.bestPlay(sim, b, true);
    const quickNow = this._lastQuickBest;
    // 现在这手已经预计「不掉血打完本波」就不换牌
    if (b.discardsLeft > 0 && !best.kill && quickNow < b.squadHp - 2) {
      const usedSet = new Set(best.slots.filter(Boolean));
      const spare = b.hand.filter((h) => !usedSet.has(h)).sort((x, y) => this.cardWorth(x) - this.cardWorth(y));
      const options = [];
      const allSpare = spare.slice(0, 4);
      if (allSpare.length) options.push(allSpare);
      if (spare.length >= 2) options.push(spare.slice(0, 2));
      // 也考虑把最弱的出战牌换掉（手里全是烂牌时）
      const weakAll = b.hand.slice().sort((x, y) => this.cardWorth(x) - this.cardWorth(y)).slice(0, 4);
      options.push(weakAll);
      let bestOpt = null;
      for (const opt of options) {
        const v = this.sampleDiscard(sim, opt.map((h) => h.uid));
        if (!bestOpt || v > bestOpt.v) bestOpt = { v, opt };
      }
      const reserve = b.discardsLeft > 1 ? 0 : this.p.discardReserveValue;
      if (bestOpt && bestOpt.v - quickNow >= this.p.discardMinGain + reserve) {
        return { type: 'discard', uids: bestOpt.opt.map((h) => h.uid) };
      }
    }
    // 更新经验值：本局「每回合能打多少」「平均能叠多少盾」
    this.dmgMemo = this.dmgMemo ? this.dmgMemo * 0.6 + best.dmg * 0.4 : best.dmg;
    this.shieldMemo = this.shieldMemo ? this.shieldMemo * 0.7 + (best.shield || 0) * 0.3 : (best.shield || 0);
    return { type: 'strike', slots: best.slots };
  }

  // ===== 商店 =====
  themeCount(sim, theme) {
    if (!theme || theme === 'core') return 0;
    return sim.run.roster.filter((h) => h.theme === theme).length + sim.run.relics.filter((r) => r.theme === theme).length;
  }

  relicValue(sim, tpl) {
    const p = this.p;
    let v = p.tierValue[tpl.tier] || 3;
    if (tpl.theme && tpl.theme !== 'core') v *= 0.55 + p.themeSynergy * this.themeCount(sim, tpl.theme);
    if (sim.cfg.focusRelic === tpl.id) v *= 3;
    return v;
  }

  heroValue(sim, h) {
    const p = this.p;
    let v = (p.tierValue[h.tier] || 3) + (h.atk || 0) / 30;
    if (h.theme && h.theme !== 'core') v *= 0.7 + p.themeSynergy * this.themeCount(sim, h.theme);
    if (h.redSeal) v += 3;
    if (h.ironPlated) v += 1.2;
    if (h.greedBadge) v += 0.8;
    if (sim.cfg.focusCard === h.tplId) v *= 3;
    return v;
  }

  slotUpValue(sim, id) {
    const lv = sim.run.slotLevels[id] || 1;
    return (this.p.slotValue[id] || 3) * Math.pow(this.p.slotDecay, lv - 1);
  }

  reserveFor(sim) {
    return sim.run.wave >= this.p.goldReserveFromWave ? this.p.goldReserve : 0;
  }

  bestInscriptionMove(sim, picks) {
    const roster = sim.run.roster;
    const byWorth = roster.slice().sort((x, y) => this.cardWorth(y) - this.cardWorth(x));
    const moves = [];
    for (const ins of picks) {
      if (ins.id === 'm_red_seal') { const t = byWorth.find((h) => !h.redSeal && !h.glassBlade && h.atk > 0); if (t) moves.push({ ins, t, v: 9 }); }
      else if (ins.id === 'm_clone') { const t = byWorth[0]; if (t) moves.push({ ins, t, v: 8 + (this.p.tierValue[t.tier] || 0) * 0.3 }); }
      else if (ins.id === 'm_iron') { const t = byWorth.find((h) => !h.ironPlated); if (t) moves.push({ ins, t, v: 4.5 }); }
      else if (ins.id === 'm_greed') { const t = byWorth.find((h) => !h.greedBadge); if (t) moves.push({ ins, t, v: sim.run.wave <= 4 ? 4 : 2 }); }
      else if (ins.id === 'm_glass') { const t = byWorth.find((h) => !h.glassBlade && !h.redSeal && h.atk >= 50); if (t) moves.push({ ins, t, v: 3.5 }); }
      else if (ins.id === 'm_banish' && roster.length > (ins.minRoster || 4)) {
        const worst = roster.slice().sort((x, y) => this.cardWorth(x) - this.cardWorth(y))[0];
        if (worst) moves.push({ ins, t: worst, v: worst.isStarter ? 5 : 2 });
      }
    }
    moves.sort((a, b) => b.v - a.v);
    return moves[0] || null;
  }

  doShop(sim) {
    const p = this.p;
    sim.pickLog = sim.pickLog || [];
    let rerolls = 0;
    if (sim.run.adShopRerollLeft > 0 && sim.run.wave >= 3) sim.adRerollShop();
    for (let guard = 0; guard < 40; guard++) {
      const gold = sim.run.gold;
      const spendable = gold - this.reserveFor(sim);
      const acts = [];
      sim.shop.relicOffers.forEach((o, i) => {
        if (o.sold) return;
        const v = this.relicValue(sim, o.tpl);
        acts.push({ kind: 'relic', i, cost: o.tpl.cost, v, id: o.tpl.id });
      });
      for (const u of sim.D.SLOT_UPGRADES) acts.push({ kind: 'slot', id: u.id, cost: u.cost, v: this.slotUpValue(sim, u.id) });
      for (const pk of sim.D.PACKS) {
        if (sim.shop.packSold[pk.id]) continue;
        const cost = sim.getPackCost(pk);
        let v = pk.id === 'pack_hero' ? p.heroPackValue * Math.pow(0.93, Math.max(0, sim.run.roster.length - 8)) : p.inscPackValue;
        if (pk.id === 'pack_hero' && sim.cfg.focusCard) v *= 1.3;
        acts.push({ kind: 'pack', id: pk.id, cost, v });
      }
      const afford = acts.filter((a) => a.cost <= spendable && a.v / a.cost >= p.minValuePerGold);
      // 秘宝栏满：如果新秘宝明显更好，就卖掉最差的
      const full = sim.run.relics.length >= sim.run.maxRelicSlots;
      let pick = null;
      for (const a of afford.sort((x, y) => y.v / y.cost - x.v / x.cost)) {
        if (a.kind === 'relic' && full) {
          const worst = sim.run.relics.slice().sort((x, y) => this.relicValue(sim, x) - this.relicValue(sim, y))[0];
          if (worst && a.v > this.relicValue(sim, worst) * 1.5) { sim.sellRelic(worst.uid); pick = a; break; }
          continue;
        }
        pick = a; break;
      }
      if (!pick) {
        const bestRelic = acts.filter((a) => a.kind === 'relic').sort((x, y) => y.v / y.cost - x.v / x.cost)[0];
        const canReroll = rerolls < p.maxRerolls && spendable >= sim.shop.rerollCost + 5 && !full;
        if (canReroll && (!bestRelic || bestRelic.v / bestRelic.cost < p.rerollIfBestBelow)) {
          sim.rerollShop(); rerolls++; continue;
        }
        break;
      }
      if (pick.kind === 'relic') {
        if (sim.buyRelicOffer(pick.i)) sim.pickLog.push({ wave: sim.run.wave, type: 'relic', id: pick.id });
      } else if (pick.kind === 'slot') {
        sim.upgradeSlot(pick.id);
      } else if (pick.kind === 'pack') {
        const content = sim.openPack(pick.id);
        if (!content) break;
        if (content.type === 'hero') {
          const ranked = content.instances.slice().sort((x, y) => this.heroValue(sim, y) - this.heroValue(sim, x));
          sim.pickPackHero(ranked[0]);
          sim.pickLog.push({ wave: sim.run.wave, type: 'hero', id: ranked[0].tplId, offered: content.instances.map((h) => h.tplId) });
        } else {
          const mv = this.bestInscriptionMove(sim, content.picks);
          if (mv) {
            sim.applyInscription(mv.ins, mv.t);
            sim.pickLog.push({ wave: sim.run.wave, type: 'insc', id: mv.ins.id, target: mv.t.tplId });
          }
        }
      }
    }
  }
}

module.exports = { HeuristicAI, DEFAULT_PARAMS, deepClone, arrangements, cardSig };
