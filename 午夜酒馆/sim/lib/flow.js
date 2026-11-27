'use strict';
// 一局游戏的无头流程：开局 → 8 波（每波若干回合）→ 每波后黑市。
// 数值结算全部调用游戏本体的 V14_ENGINE；Boss 意图 / 抽牌 / 商店货架直接执行从 v14Main.js 摘出的原方法。
// 下面「镜像」的部分对应 v14Main.js 中混有 UI 的同名方法，只保留会影响数值的语句。
// 若游戏改了这些方法，loadGame.checkDrift() 会报出是哪一个，届时同步这里即可。

class SimRun {
  constructor(G, cfg = {}) {
    this.G = G;
    this.D = G.D;
    this.E = G.E;
    this.cfg = cfg;
    const m = G.mainMethods;
    // 原样借用游戏方法（this 指向本对象）
    this.prepareBossIntent = m.prepareBossIntent;
    this.drawToHandSize = m.drawToHandSize;
    this.getRemainingHand = m.getRemainingHand;
    this.rollShopOffers = m.rollShopOffers;
    this.getPackCost = m.getPackCost;
    this.log = [];
  }

  getAscension(lv) {
    const A = this.G.META.ASCENSIONS;
    return A.find((a) => a.lv === lv) || A[0];
  }

  getHero(id) {
    return this.G.HEROES.find((h) => h.id === id) || this.G.HEROES[0];
  }

  // ---- 镜像 v14Main.startNewRun ----
  startNewRun() {
    const { D } = this;
    const cfg = this.cfg;
    const hero = this.getHero(cfg.heroId || 'hero_01');
    const themes = cfg.themes;
    const activeRelicPool = D.getActiveRelics(themes);
    const startRelics = [];
    if (hero.startHighRelic) {
      const highPool = activeRelicPool.filter((r) => r.tier === 'S' || r.tier === 'SSS');
      const pick = highPool[Math.floor(Math.random() * highPool.length)];
      if (pick) startRelics.push(D.makeRelicInstance(pick));
    }
    const asc = this.getAscension(cfg.ascension || 0);
    this.run = {
      hero,
      ascension: asc.lv,
      activeThemes: themes,
      wave: 1,
      maxWaves: 8,
      phase: 'battle',
      gold: hero.startGold || 6,
      roster: D.createStarterRoster(),
      relics: startRelics,
      maxRelicSlots: 5 + (hero.extraRelicSlots || 0),
      slotLevels: { slot1: 1, slot2: 1, slot3: 1, hand: 1 },
      totalKills: 0,
      peakHit: 0,
      adReviveLeft: cfg.ads ? 1 : 0,
      adShopRerollLeft: cfg.ads ? 1 : 0,
      adPackRerollLeft: 0,
      adFilterLeft: 0
    };
    // —— 模拟器专用：强制带卡 / 带秘宝（A/B 测试用）——
    for (const id of cfg.forceCards || []) {
      if (!D.ALL_HERO_MAP[id]) throw new Error('未知卡牌 ' + id);
      this.run.roster.push(D.makeHeroInstance(id));
    }
    for (const id of cfg.forceRelics || []) {
      const tpl = D.RELICS.find((r) => r.id === id);
      if (!tpl) throw new Error('未知秘宝 ' + id);
      this.run.relics.push(D.makeRelicInstance(tpl));
    }
  }

  // ---- 镜像 v14Main.startWaveBattle（战斗状态初始化）----
  startWaveBattle(wave) {
    const { D } = this;
    this.run.phase = 'battle';
    const rawBoss = D.getWaveBoss(wave);
    const asc = this.getAscension(this.run.ascension || 0);
    const bossCfg = {
      ...rawBoss,
      maxHp: Math.round(rawBoss.maxHp * asc.hpMult),
      breakThreshold: Math.round(rawBoss.breakThreshold * asc.hpMult),
      shieldGain: Math.round(rawBoss.shieldGain * asc.hpMult),
      heavyDmg: Math.round(rawBoss.heavyDmg * asc.dmgMult),
      ultDmg: Math.round(rawBoss.ultDmg * asc.dmgMult)
    };
    const hero = this.run.hero;
    const extraDiscards = this.run.relics.filter((r) => r.id === 'r_disc_extra').length * 2 + (hero.extraDiscards || 0) + (asc.discardDelta || 0);
    const drawPile = this.G.shuffle(this.run.roster);
    const maxHp = Math.max(40, D.SQUAD_MAX_HP + (hero.maxHpBonus || 0));
    if (typeof this.run.squadHp !== 'number' || this.run.squadHp <= 0) this.run.squadHp = maxHp;
    this.run.squadHp = Math.min(maxHp, this.run.squadHp);
    this.run.squadMaxHp = maxHp;
    const baseHandLimit = Math.max(4, D.HAND_SIZE + (asc.handDelta || 0));
    this.battle = {
      wave,
      round: 1,
      maxRounds: D.MAX_ROUNDS,
      handLimit: baseHandLimit,
      bossCfg,
      heroPassive: hero,
      gold: this.run.gold,
      squadHp: this.run.squadHp,
      squadMaxHp: maxHp,
      squadShield: hero.startShield || 0,
      bossHp: bossCfg.maxHp,
      bossMaxHp: bossCfg.maxHp,
      bossShield: 0,
      bossPoison: hero.startBossPoison || 0,
      bossFrost: 0,
      bossFrozen: false,
      waveFrostNovaUsed: false,
      waveExhaustCount: 0,
      waveSummonTriggered: false,
      waveSubstituteUsed: false,
      waveImmortalUsed: false,
      waveImmortalBuff: false,
      waveGambleWins: 0,
      waveJackpotActive: false,
      bossVuln: false,
      bossStunned: false,
      bossCharging: false,
      bossThorns: false,
      bossBreakProgress: 0,
      bossBreakThreshold: bossCfg.breakThreshold,
      pendingUltNextTurn: false,
      slot3Locked: false,
      intent: null,
      slotLevels: this.run.slotLevels,
      relics: this.run.relics,
      discardsLeft: Math.max(1, D.BASE_DISCARDS + extraDiscards),
      maxDiscards: Math.max(1, D.BASE_DISCARDS + extraDiscards),
      waveDiscardsCount: 0,
      roundDiscardsCount: 0,
      roundUsedDiscard: false,
      roundTeamAtkBonus: 0,
      roundSlot1MultBonus: 0,
      nextRoundSlot3Bonus: 0,
      currentSlot3Bonus: 0,
      ghostQueuedHero: null,
      pendingKnives: [],
      pendingScavengers: [],
      drawPile,
      discardPile: [],
      exhaustPile: [],
      hand: [],
      slots: [null, null, null]
    };
    this.waveStat = {
      wave, boss: bossCfg.id, bossHp: bossCfg.maxHp, hpStart: this.run.squadHp, rounds: 0,
      hpLost: 0, shieldBlocked: 0, berserkRounds: 0, ultTaken: 0, breaks: 0, discards: 0, peakHit: 0, dmgDealt: 0
    };
    this.beginRound();
  }

  // ---- 镜像 v14Main.beginRound ----
  beginRound() {
    const b = this.battle;
    b.slots = [null, null, null];
    this.prepareBossIntent();
    this.drawToHandSize();
    this.E.onRoundStart(b);
  }

  // ---- 镜像 v14Main.handleDiscardButton（普通换牌分支）----
  // 返回 'win' 表示换牌技能直接打死了 Boss
  discard(uids) {
    const b = this.battle;
    if (b.discardsLeft <= 0 || !uids.length) return 'continue';
    const picked = new Set(uids);
    const discarded = b.hand.filter((h) => picked.has(h.uid));
    b.hand = b.hand.filter((h) => !picked.has(h.uid));
    b.slots = b.slots.map((s) => (s && picked.has(s.uid) ? null : s));
    const remainingHand = b.hand.slice();
    b.discardsLeft -= 1;
    const hpBefore = b.bossHp;
    this.E.onDiscard(b, discarded, remainingHand);
    b.discardPile.push(...discarded);
    this.drawToHandSize();
    this.run.gold = b.gold;
    this.waveStat.discards += 1;
    this.waveStat.dmgDealt += Math.max(0, hpBefore - b.bossHp);
    if (b.bossHp <= 0) return this.finishBattle(true);
    return 'continue';
  }

  // ---- 镜像 v14Main.handleStrikeButton ----
  strike(slots) {
    const { D, E } = this;
    const b = this.battle;
    b.slots = slots.slice(0, 3);
    while (b.slots.length < 3) b.slots.push(null);
    if (b.slots.filter(Boolean).length === 0) throw new Error('AI 没有派出任何侠客');
    const slotted = b.slots.slice();
    const remainingHand = this.getRemainingHand();
    const ws = this.waveStat;
    ws.rounds = b.round;
    if (b.intent && b.intent.berserk) ws.berserkRounds += 1;
    if (b.intent && b.intent.kind === 'ult') ws.ultTaken += 1;
    const wasCharging = b.bossCharging;
    const hpBefore = b.bossHp;

    const strikeRes = E.executeStrike(b, slotted, remainingHand, this.run.roster);
    this.run.gold = b.gold;
    if (strikeRes.directDmg > this.run.peakHit) this.run.peakHit = strikeRes.directDmg;
    if (strikeRes.directDmg > ws.peakHit) ws.peakHit = strikeRes.directDmg;
    if (wasCharging && b.bossStunned) ws.breaks += 1;

    if (b.bossHp <= 0) { ws.dmgDealt += hpBefore; return this.finishBattle(true); }

    if (b.bossCharging && !b.bossStunned) {
      b.pendingUltNextTurn = true;
    }

    const hpPre = b.squadHp;
    const bossEvents = E.onBossActAndRoundEnd(b, slotted, remainingHand, b.intent, this.run.roster);
    this.run.gold = b.gold;
    for (const ev of bossEvents) {
      if (ev.type === 'boss_attack') ws.shieldBlocked += ev.blocked || 0;
    }
    ws.hpLost += Math.max(0, hpPre - b.squadHp);
    ws.dmgDealt += Math.max(0, hpBefore - Math.max(0, b.bossHp));

    if (b.bossHp <= 0) return this.finishBattle(true);
    if (b.squadHp <= 0 || b.round >= D.HARD_ROUND_CAP) {
      ws.capHit = b.squadHp > 0;
      return this.finishBattle(false);
    }

    const devouredSet = new Set(strikeRes.devouredUids || []);
    const slottedUids = new Set(slotted.filter(Boolean).map((h) => h.uid));
    for (const h of slotted) {
      if (!h) continue;
      if (devouredSet.has(h.uid)) {
        b.exhaustPile.push(h);
      } else if (h.glassBlade) {
        const saved = E.triggerExhaustHooks(b, h, this.run.roster, [], false);
        if (saved) b.discardPile.push(h);
        else b.exhaustPile.push(h);
      } else {
        b.discardPile.push(h);
      }
    }
    b.hand = b.hand.filter((h) => !slottedUids.has(h.uid));
    b.round += 1;
    this.beginRound();
    return 'continue';
  }

  // ---- 镜像 v14Main.finishBattle（只保留数值部分）----
  finishBattle(won) {
    const { D, E } = this;
    const b = this.battle;
    const ws = this.waveStat;
    this.run.gold = b.gold;
    ws.won = won;
    ws.rounds = b.round;
    ws.hpEnd = b.squadHp;
    this.waveStats.push(ws);
    if (won) {
      this.run.totalKills += 1;
      E.onWaveClear(this.run.relics);
      const baseReward = Math.max(1, b.bossCfg.reward + (this.run.hero.rewardDelta || 0));
      const maxInt = this.run.hero.maxInterest || 5;
      const interest = Math.min(maxInt, Math.floor(this.run.gold / 5));
      const roundBonus = Math.max(0, b.maxRounds - b.round);
      const bloodBonus = (this.run.relics.some((r) => r.id === 'r_bld_heal') && b.squadHp <= b.squadMaxHp * 0.5) ? 4 : 0;
      const totalEarn = baseReward + interest + roundBonus + bloodBonus;
      this.run.gold += totalEarn;
      const restHeal = Math.round(b.squadMaxHp * D.WAVE_CLEAR_HEAL_PCT);
      this.run.squadHp = Math.min(b.squadMaxHp, Math.max(1, b.squadHp) + restHeal);
      this.run.squadMaxHp = b.squadMaxHp;
      ws.goldEarned = totalEarn;
      if (b.wave === this.run.maxWaves) return 'cleared';
      this.run.wave += 1;
      return 'win';
    }
    if (this.run.adReviveLeft > 0) {
      this.run.adReviveLeft -= 1;
      this.revivesUsed = (this.revivesUsed || 0) + 1;
      this.run.squadHp = Math.max(1, Math.round(b.squadMaxHp * D.REVIVE_HP_PCT));
      return 'revive';
    }
    return 'lose';
  }

  // ---- 镜像 v14Main.openShop / 商店操作 ----
  openShop() {
    this.run.phase = 'shop';
    const asc = this.getAscension(this.run.ascension || 0);
    this.shop = { rerollCost: asc.rerollCost || 3, relicOffers: [], packSold: {} };
    this.rollShopOffers(false);
  }

  spendGold(amount) {
    this.run.gold -= amount;
    this.E.onShopSpend(this.run.relics, this.run.roster, amount);
  }

  rerollShop() {
    if (this.run.gold < this.shop.rerollCost) return false;
    this.spendGold(this.shop.rerollCost);
    this.rollShopOffers(false);
    return true;
  }

  adRerollShop() {
    if (this.run.adShopRerollLeft <= 0) return false;
    this.run.adShopRerollLeft -= 1;
    this.rollShopOffers(true);
    return true;
  }

  buyRelicOffer(idx) {
    const offer = this.shop.relicOffers[idx];
    if (!offer || offer.sold) return false;
    if (this.run.relics.length >= this.run.maxRelicSlots) return false;
    if (this.run.gold < offer.tpl.cost) return false;
    this.spendGold(offer.tpl.cost);
    this.run.relics.push(this.D.makeRelicInstance(offer.tpl));
    offer.sold = true;
    return true;
  }

  sellRelic(uid) {
    const i = this.run.relics.findIndex((r) => r.uid === uid);
    if (i < 0) return false;
    const r = this.run.relics[i];
    this.run.gold += Math.max(2, Math.floor(r.cost / 2));
    this.run.relics.splice(i, 1);
    return true;
  }

  upgradeSlot(slotId) {
    const u = this.D.SLOT_UPGRADES.find((x) => x.id === slotId);
    if (!u || this.run.gold < u.cost) return false;
    this.spendGold(u.cost);
    this.run.slotLevels[slotId] = (this.run.slotLevels[slotId] || 1) + 1;
    return true;
  }

  // 买包并返回内容（招募包 → 侠客实例数组；铭文匣 → 铭文数组），之后用 pickPackHero / applyInscription 完成选择
  openPack(packId) {
    const { D } = this;
    const pack = D.PACKS.find((p) => p.id === packId);
    if (!pack || this.shop.packSold[packId]) return null;
    const cost = this.getPackCost(pack);
    if (this.run.gold < cost) return null;
    this.spendGold(cost);
    this.shop.packSold[packId] = true;
    if (packId === 'pack_hero') {
      const heroPool = D.getActiveShopHeroes(this.run.activeThemes).filter((h) => !(this.cfg.banCards || []).includes(h.id));
      const picks = D.weightedPick(heroPool, 4);
      const inscripRate = this.run.hero.bonusHeroInscripRate || 0.24;
      const instances = picks.map((tpl) => {
        const ov = {};
        if (Math.random() < inscripRate) {
          const roll = Math.random();
          if (roll < 0.34) ov.redSeal = true;
          else if (roll < 0.67) ov.greedBadge = true;
          else ov.ironPlated = true;
        }
        return D.makeHeroInstance(tpl, ov);
      });
      return { type: 'hero', instances };
    }
    const picks = this.G.shuffle(D.INSCRIPTIONS).slice(0, 3);
    return { type: 'inscription', picks };
  }

  pickPackHero(inst) {
    if (inst) this.run.roster.push(inst);
  }

  applyInscription(ins, hero) {
    const roster = this.run.roster;
    const idx = roster.indexOf(hero);
    if (idx < 0) return false;
    if (ins.minRoster && roster.length <= ins.minRoster) return false;
    if (ins.id === 'm_red_seal') hero.redSeal = true;
    else if (ins.id === 'm_glass') hero.glassBlade = true;
    else if (ins.id === 'm_greed') hero.greedBadge = true;
    else if (ins.id === 'm_iron') hero.ironPlated = true;
    else if (ins.id === 'm_clone') roster.push(this.D.cloneHeroInstance(hero));
    else if (ins.id === 'm_banish') roster.splice(idx, 1);
    return true;
  }

  // ---- 整局 ----
  play(ai) {
    this.waveStats = [];
    this.startNewRun();
    let result = 'lose';
    const MAX_STEPS = 400;
    for (;;) {
      this.startWaveBattle(this.run.wave);
      let st = 'continue';
      let steps = 0;
      while (st === 'continue') {
        if (++steps > MAX_STEPS) throw new Error('单波步数超限，疑似死循环');
        const act = ai.chooseBattleAction(this);
        if (act.type === 'discard') st = this.discard(act.uids);
        else st = this.strike(act.slots);
      }
      if (st === 'revive') continue; // 复活：同一波重打，保留构筑
      if (st === 'lose') { result = 'lose'; break; }
      if (st === 'cleared') { result = 'win'; break; }
      if (this.cfg.stopAfterWave && this.run.totalKills >= this.cfg.stopAfterWave) { result = 'partial'; break; }
      this.openShop();
      ai.doShop(this);
    }
    return this.summary(result);
  }

  summary(result) {
    const run = this.run;
    return {
      won: result === 'win',
      partial: result === 'partial',
      wavesCleared: run.totalKills,
      deathWave: result === 'lose' ? run.wave : null,
      revivesUsed: this.revivesUsed || 0,
      peakHit: run.peakHit,
      gold: run.gold,
      hero: run.hero.id,
      themes: run.activeThemes,
      roster: run.roster.map((h) => h.tplId),
      relics: run.relics.map((r) => r.id),
      slotLevels: { ...run.slotLevels },
      waves: this.waveStats,
      picks: this.pickLog || []
    };
  }
}

module.exports = { SimRun };
