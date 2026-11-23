// Main controller for Midnight Tavern v4.0 (Classic script: file:// & http:// compatible)
(function () {
  const { pixelArt, uiIcons, sfx, sprites, TavernCanvas, BattleTheater, STAGE_W, STAGE_H, DATA } = window.MT;
  const {
    TIERS, ELEMENTS, getElementMultiplier, ROLES, LIFE_TAGS,
    TAVERN_LEVELS, DRINKS, BATTLE_DRINKS, MONSTER_MATERIALS,
    EQUIPMENT_POOL, SYNERGIES,
    MERCENARY_POOL, CONTRACTS, EVENTS, RENT_SCHEDULE
  } = DATA;

  const SAVE_KEY = 'midnight_tavern_v4';
  const CODEX_KEY = 'midnight_tavern_v4_codex';
  const MAX_DAYS = 15;

  class MidnightTavernGame {
    constructor() {
      pixelArt.injectPixelTheme();
      this.stageEl = document.getElementById('stage');
      this.canvasEl = document.getElementById('tavern-canvas');
      this.tavern = new TavernCanvas(this.canvasEl);
      this.theater = new BattleTheater(document.getElementById('battle-canvas'));
      this.carriedDrinks = [null, null];

      this.codex = this.loadCodex();
      this.state = this.createInitialState();
      this.selectedDrinkId = null;
      this.inspectedMercId = null;
      this.contractDeskOpen = false;
      this.barDrawerOpen = false;
      this.dragState = null;
      this.panState = null;
      this.sealChargeStart = 0;
      this.pendingSettlement = null;
      this.auctionState = null;
      this.activeEvent = null;

      this.bindStageResize();
      this.bindUIEvents();
      this.bindPointerEngine();
    }

    loadCodex() {
      try {
        const raw = localStorage.getItem(CODEX_KEY);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) return new Set(arr);
        }
      } catch {}
      return new Set();
    }

    saveCodex() {
      try {
        localStorage.setItem(CODEX_KEY, JSON.stringify([...this.codex]));
      } catch {}
    }

    createInitialState() {
      const starterGear = {
        uid: 'gear_start_1',
        ...EQUIPMENT_POOL[0], // 精钢斩马刀
        equippedBy: null
      };
      return {
        version: 4,
        day: 1,
        maxDays: MAX_DAYS,
        tavernLevel: 1,
        gold: 150,
        rep: 50,
        wanted: 0,
        rentPenalty: 0,
        wins: 0,
        totalContracts: 0,
        cutHistory: [],
        mvpCounts: {},
        loyaltyMap: Object.fromEntries(MERCENARY_POOL.map((m) => [m.id, m.loyalty])),
        signedRoster: [], // [{ id, level, xp }]
        activeBets: [],   // [{ mercId, targetGold, earnedGold, nightsLeft }]
        armory: [starterGear],
        nextGearUid: 2,
        visitors: [],
        contracts: [],
        activeContractIdx: 0,
        squadIds: [null, null, null],
        unlockedIntelIds: [],
        dispatchedToday: false,
        eventDoneToday: false,
        auctionedTonight: false,
        stats: {
          drinksServed: 0,
          gearRentEarned: 0,
          auctionEarned: 0,
          auctionCount: 0,
          heistsDone: 0,
          scoutsDone: 0,
          signsDone: 0
        }
      };
    }

    async init() {
      await Promise.all([
        sprites.load(),
        window.MT.vfx ? window.MT.vfx.load() : Promise.resolve(),
        uiIcons && uiIcons.load ? uiIcons.load() : Promise.resolve()
      ]);
      this.loadSaveOrStart();
      this.tavern.setTavernLevel(this.state.tavernLevel);
      this.tavern.start();
      this.renderAll();
    }

    loadSaveOrStart() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.version === 4 && parsed.day && Array.isArray(parsed.visitors) && parsed.visitors.length > 0) {
            this.state = parsed;
            this.migrateSavedAssets();
            return;
          }
        }
      } catch {}
      this.setupNight(1, true);
    }

    // Migrate any serialized unitId / bossUnitId from older saves to the latest Duelyst H5 Kit assets
    migrateSavedAssets() {
      if (Array.isArray(this.state.visitors)) {
        for (const v of this.state.visitors) {
          const tpl = MERCENARY_POOL.find((m) => m.id === v.id);
          if (tpl) v.unitId = tpl.unitId;
        }
      }
      if (Array.isArray(this.state.contracts)) {
        for (const c of this.state.contracts) {
          const tpl = CONTRACTS.find((x) => x.id === c.id);
          if (tpl) {
            c.bossUnitId = tpl.bossUnitId;
            c.bossName = tpl.bossName;
          }
        }
      }
    }

    save() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
      } catch {}
    }

    showToast(msg, ms = 2600) {
      const el = document.getElementById('event-toast');
      if (!el) return;
      el.textContent = msg;
      el.classList.remove('hidden');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
    }

    getTavernCfg() {
      return TAVERN_LEVELS.find((x) => x.level === this.state.tavernLevel) || TAVERN_LEVELS[0];
    }

    getSignedEntry(mercId) {
      return this.state.signedRoster.find((s) => s.id === mercId) || null;
    }

    getActiveBet(mercId) {
      return this.state.activeBets.find((b) => b.mercId === mercId) || null;
    }

    getEquippedGear(mercId) {
      return this.state.armory.filter((g) => g.equippedBy === mercId);
    }

    computeMercStats(merc) {
      const signed = this.getSignedEntry(merc.id);
      const level = signed ? signed.level : 1;
      const lvlBonus = (level - 1) * 7;
      const tag = merc.lifeTag;

      let basePwr = merc.power + lvlBonus;
      if (tag && tag.powerMult) {
        const sober = tag.soberByAle && merc.drinkBuff && merc.drinkBuff.id === 'holy_ale';
        basePwr = Math.round(basePwr * (sober ? 1.12 : tag.powerMult));
      }
      if (merc.eventPowerMult) basePwr = Math.round(basePwr * merc.eventPowerMult);

      let drinkMult = 1;
      if (merc.drinkBuff) {
        drinkMult += merc.drinkBuff.effect.powerMult;
        if (merc.favDrink === merc.drinkBuff.id) drinkMult += 0.08;
        if (tag && tag.drinkPowerBonus) drinkMult += tag.drinkPowerBonus;
      }
      let effPwr = Math.round(basePwr * drinkMult);

      // Add equipped gear power & elements
      const gear = this.getEquippedGear(merc.id);
      const els = [...merc.elements];
      if (merc.drinkBuff && merc.drinkBuff.enchantElement && !els.includes(merc.drinkBuff.enchantElement)) {
        els.push(merc.drinkBuff.enchantElement);
      }
      for (const g of gear) {
        effPwr += g.power || 0;
        if (g.element && !els.includes(g.element)) els.push(g.element);
      }

      // Fee calculation (signed mercs have 0 dispatch fee, paid via nightly salary; walk-ins pay fee)
      let effFee = 0;
      if (!signed) {
        const repPenalty = this.state.rep < 35 ? 1.2 : 1;
        let f = merc.fee * repPenalty;
        if (tag && tag.feeMult !== undefined) f *= tag.feeMult;
        if (merc.drinkBuff && merc.drinkBuff.effect.feeDiscount) {
          f *= (1 - merc.drinkBuff.effect.feeDiscount);
        }
        effFee = Math.round(f);
      }

      // Cut threshold (GPT Fix #2: walk-ins have explicit cut redline!)
      const rawLimit = Math.round(74 - merc.greed * 38 + (tag && tag.cutLimitDelta ? tag.cutLimitDelta : 0));
      const cutLimit = Math.max(30, Math.min(75, rawLimit));

      merc.isSigned = Boolean(signed);
      merc.level = level;
      merc.effectivePower = effPwr;
      merc.effectiveFee = effFee;
      merc.activeElements = els;
      merc.cutLimit = cutLimit;
    }

    rollVisitorFromTemplate(tpl, isSigned = false) {
      const loyalty = Math.min(100, this.state.loyaltyMap[tpl.id] ?? tpl.loyalty);
      const lifeTag = LIFE_TAGS[Math.floor(Math.random() * LIFE_TAGS.length)];
      const m = {
        ...tpl,
        loyalty,
        lifeTag,
        drinkBuff: null,
        eventPowerMult: 1,
        isSigned
      };
      this.computeMercStats(m);
      return m;
    }

    setupNight(day, isFresh = false) {
      if (isFresh) this.state = this.createInitialState();
      this.state.day = day;
      this.state.dispatchedToday = false;
      this.state.eventDoneToday = false;
      this.state.auctionedTonight = false;
      this.state.squadIds = [null, null, null];
      this.state.unlockedIntelIds = [];

      // Unequip gear from walk-ins who left overnight
      const signedSet = new Set(this.state.signedRoster.map((s) => s.id));
      for (const g of this.state.armory) {
        if (g.equippedBy && !signedSet.has(g.equippedBy)) g.equippedBy = null;
      }

      const cfg = this.getTavernCfg();
      this.tavern.setTavernLevel(this.state.tavernLevel);

      // Build visitors: always include signed roster first + walk-ins up to visitorCount
      const visitors = [];
      for (const s of this.state.signedRoster) {
        const tpl = MERCENARY_POOL.find((x) => x.id === s.id);
        if (tpl) visitors.push(this.rollVisitorFromTemplate(tpl, true));
      }

      // Also keep active bet mercs in tavern so player can finish their 2-night bet!
      for (const b of this.state.activeBets) {
        if (!visitors.some((v) => v.id === b.mercId)) {
          const tpl = MERCENARY_POOL.find((x) => x.id === b.mercId);
          if (tpl) visitors.push(this.rollVisitorFromTemplate(tpl, false));
        }
      }

      // Day 1 curated start (from 0 gradual intro: 铁砧 + 苏珊 + 1 random C/B)
      if (day === 1 && visitors.length === 0) {
        const starters = ['iron_anvil', 'susan_medic', 'seven_boom'];
        for (const sid of starters) {
          const tpl = MERCENARY_POOL.find((x) => x.id === sid);
          if (tpl) visitors.push(this.rollVisitorFromTemplate(tpl, false));
        }
      } else {
        const maxTierRank = this.state.tavernLevel === 1 ? 5 : this.state.tavernLevel === 2 ? 9 : 11;
        const available = MERCENARY_POOL.filter((m) => {
          if (visitors.some((v) => v.id === m.id)) return false;
          const r = TIERS[m.tier] ? TIERS[m.tier].rank : 2;
          return r <= maxTierRank;
        });
        const shuffled = [...available].sort((a, b) => {
          const bonusA = this.state.tavernLevel >= 3 && TIERS[a.tier].rank >= 8 ? 0.35 : 0;
          const bonusB = this.state.tavernLevel >= 3 && TIERS[b.tier].rank >= 8 ? 0.35 : 0;
          return (Math.random() + bonusB) - (Math.random() + bonusA);
        });
        const targetCount = Math.max(visitors.length, cfg.visitorCount);
        for (const tpl of shuffled) {
          if (visitors.length >= targetCount) break;
          visitors.push(this.rollVisitorFromTemplate(tpl, false));
        }
      }

      this.state.visitors = visitors;

      // Contracts generation
      if (day === 1) {
        const c1 = CONTRACTS[0];
        this.state.contracts = [{ ...c1 }];
      } else {
        const maxTier = day <= 3 ? 1 : day <= 8 ? 2 : 3;
        const eligible = CONTRACTS.filter((c) => {
          if (c.tier > maxTier) return false;
          if ((c.kind === 'heist' || c.kind === 'escort') && this.state.tavernLevel < 2 && day < 4) return false;
          return true;
        });
        const picked = [...eligible].sort(() => Math.random() - 0.5).slice(0, 3).sort((a, b) => a.threat - b.threat);
        this.state.contracts = picked.map((c) => ({
          ...c,
          threat: Math.round(c.threat * (1 + Math.max(0, day - 2) * 0.045)),
          baseReward: Math.round(c.baseReward * (1 + Math.max(0, day - 1) * 0.055))
        }));
      }
      this.state.activeContractIdx = 0;
      this.tavern.resetMarch();

      this.showToast(`第 ${day}/${MAX_DAYS} 夜营业 — 看标签选人，按属性配队`, 2500);
      this.save();

      // Trigger a live tavern event every 2 nights (Day 2, 4, 6, 8, 10, 12, 14)
      if (day >= 2 && day % 2 === 0 && !this.state.eventDoneToday) {
        setTimeout(() => this.maybeTriggerLiveEvent(), 550);
      }
    }

    getActiveContract() {
      return this.state.contracts[this.state.activeContractIdx] || this.state.contracts[0];
    }

    getVisitor(mercId) {
      return this.state.visitors.find((v) => v.id === mercId) || null;
    }

    getSquadMercs() {
      return this.state.squadIds.map((id) => (id ? this.getVisitor(id) : null)).filter(Boolean);
    }

    isContractRevealed(contract) {
      if (!contract) return true;
      if (!contract.fog) return true;
      return this.state.unlockedIntelIds.includes(contract.id);
    }

    // Core squad metrics — strictly honors GPT Fix #1 (zero element leak on unrevealed fog contracts!)
    computeSquadMetrics() {
      const contract = this.getActiveContract();
      const squad = this.getSquadMercs();
      const revealed = this.isContractRevealed(contract);

      let basePowerSum = 0;
      let counterPowerSum = 0;
      let totalFee = 0;
      let upfrontRent = 0;
      let safeBonus = 0;
      let lootMult = 1;
      const elCounts = {};
      const mercCounters = {};

      const hasLocke = squad.some((m) => m.id === 'lady_locke');
      const hasMord = squad.some((m) => m.id === 'mord_blood');
      const hasKiri = squad.some((m) => m.id === 'kiri_mist');
      const hasLilith = squad.some((m) => m.id === 'lilith_dance');
      const hasTank = squad.some((m) => m.role === 'tank');

      for (const m of squad) {
        this.computeMercStats(m);
        let p = m.effectivePower;
        if (hasLocke && m.id !== 'lady_locke') p = Math.round(p * 1.15);
        if (hasMord && (m.activeElements.includes('dark') || m.activeElements.includes('bolt'))) p = Math.round(p * 1.12);
        if (hasLilith && m.id !== 'lilith_dance') p = Math.round(p * 1.18);

        basePowerSum += p;

        // Real elemental multiplier (used for actual battle, and for preview ONLY if revealed!)
        const elRes = contract ? getElementMultiplier(m.activeElements, contract.elements) : { mult: 1, tag: 'neutral' };
        mercCounters[m.id] = elRes;
        counterPowerSum += Math.round(p * elRes.mult);

        totalFee += m.effectiveFee;
        const gear = this.getEquippedGear(m.id);
        for (const g of gear) {
          upfrontRent += g.rent || 0;
          if (g.safeBonus) safeBonus += g.safeBonus;
          if (g.lootMult) lootMult += g.lootMult;
        }
        if (m.drinkBuff && m.drinkBuff.effect.steady) safeBonus += 10;
        if (m.id === 'aria_sun') safeBonus += 14;
        if (m.id === 'susan_medic') safeBonus += 10;
        if (m.id === 'lilith_dance') lootMult += 0.20;

        for (const el of m.activeElements) elCounts[el] = (elCounts[el] || 0) + 1;
      }

      // Frontline penalty if 2+ mercs and no tank
      if (squad.length >= 2 && !hasTank) safeBonus -= 6;

      const activeSynergies = [];
      for (const syn of SYNERGIES) {
        if ((elCounts[syn.key] || 0) >= syn.need) {
          activeSynergies.push(syn);
          basePowerSum += syn.bonusPower || 0;
          counterPowerSum += syn.bonusPower || 0;
          safeBonus += syn.bonusSafe || 0;
          lootMult += syn.bonusLoot || 0;
        }
      }

      let effThreat = contract ? contract.threat : 100;
      if (hasKiri) effThreat = Math.round(effThreat * 0.86);
      if (revealed && contract && contract.fog) effThreat = Math.round(effThreat * 0.94);

      // Exact winRate (true battle probability)
      let exactWinRate = 0;
      let displayWinMin = 0;
      let displayWinMax = 0;
      if (squad.length > 0) {
        const realRatio = counterPowerSum / Math.max(1, effThreat);
        exactWinRate = Math.round(Math.max(10, Math.min(98, 15 + realRatio * 62 + safeBonus * 0.45)));

        // GPT Fix #1: When fog contract is unrevealed, preview uses ONLY basePowerSum (zero Boss element info!)
        const baseRatio = basePowerSum / Math.max(1, effThreat);
        const lowRatio = (basePowerSum * 0.78) / Math.max(1, effThreat);
        const highRatio = (basePowerSum * 1.32) / Math.max(1, effThreat);
        displayWinMin = Math.round(Math.max(10, Math.min(92, 15 + lowRatio * 62 + safeBonus * 0.45)));
        displayWinMax = Math.round(Math.max(displayWinMin + 8, Math.min(98, 15 + highRatio * 62 + safeBonus * 0.45)));
      }

      return {
        squad, revealed, basePowerSum, counterPowerSum, totalFee, upfrontRent,
        activeSynergies, mercCounters, exactWinRate, displayWinMin, displayWinMax,
        lootMult, effThreat
      };
    }

    // ─── Scout Fog Contract (暗夜踩点) ───
    scoutActiveContract() {
      const contract = this.getActiveContract();
      if (!contract || this.isContractRevealed(contract) || this.state.dispatchedToday) return;

      const hasAssassin = this.state.visitors.some((v) => v.role === 'assassin');
      const cost = hasAssassin ? 0 : 18;
      if (this.state.gold < cost) {
        sfx.playError();
        this.showToast('金币不足 18G 踩点（店里有刺客可免费踩点！）', 2400);
        return;
      }

      this.state.gold -= cost;
      const sideLoot = 12 + Math.floor(Math.random() * 14);
      this.state.gold += sideLoot;
      this.state.unlockedIntelIds.push(contract.id);
      this.state.stats.scoutsDone++;

      sfx.playSynergy();
      const elNames = contract.elements.map((e) => ELEMENTS[e].name).join('/');
      this.showToast(`暗夜踩点成功！摸清 Boss 属性【${elNames}】，顺手摸走 +${sideLoot}G`, 3200);
      this.save();
      this.renderAll();
    }

    // ─── Serve Drink (including Elemental Enchant) ───
    serveDrinkToMerc(drinkId, mercId) {
      const drink = DRINKS.find((d) => d.id === drinkId);
      const merc = this.getVisitor(mercId);
      if (!drink || !merc) return;

      if (this.state.gold < drink.cost) {
        sfx.playError();
        const actor = this.tavern.getMercActor(mercId);
        if (actor) this.tavern.spawnFloater(actor.x, actor.y - 95, '金币不够调酒!', '#ff595e');
        return;
      }

      this.state.gold -= drink.cost;
      this.state.stats.drinksServed++;
      merc.drinkBuff = drink;
      merc.loyalty = Math.min(100, merc.loyalty + (drink.effect.loyaltyDelta || 0) + (merc.favDrink === drink.id ? 6 : 0));
      this.state.loyaltyMap[merc.id] = merc.loyalty;
      this.computeMercStats(merc);

      const actor = this.tavern.getMercActor(mercId);
      sfx.playDrinkServe();
      if (actor) {
        this.tavern.burstParticles(actor.x, actor.y - 54, drink.color, 24, 150);
        const drinkVfxMap = {
          fire: 'fx_flamesphere',
          light: 'fx_f1_holyimmolation',
          ice: 'fxExplosionMediumIcyWhite',
          dark: 'fx_f4_shadownova'
        };
        const fxKey = (drink.enchantElement && drinkVfxMap[drink.enchantElement]) || 'fxBuffSimpleGold';
        this.tavern.playVfx(fxKey, actor.x, actor.y - 56, { scale: fxKey === 'fx_f4_shadownova' ? 1.15 : 1.65, speedMult: 1.35 });
        this.tavern.triggerAnim(mercId, 'selected', 1.1);
        const enchTxt = drink.enchantElement ? ` 附魔[${ELEMENTS[drink.enchantElement].name}]` : '';
        this.tavern.spawnFloater(actor.x, actor.y - 96, `${drink.name}${enchTxt} 战力->${merc.effectivePower}`, drink.glow);
      }

      const contract = this.getActiveContract();
      if (drink.effect.revealIntel && contract && contract.fog && !this.state.unlockedIntelIds.includes(contract.id)) {
        this.state.unlockedIntelIds.push(contract.id);
        const elNames = contract.elements.map((e) => ELEMENTS[e].name).join('/');
        this.tavern.say(mercId, merc.intelBark, 4.8);
        if (actor) this.tavern.spawnFloater(actor.x, actor.y - 134, `揭晓Boss属性[${elNames}] & 定金-30%!`, '#4de8a8');
        sfx.playSynergy();
      } else {
        this.tavern.say(mercId, merc.drunkBark, 4.0);
      }

      this.selectedDrinkId = null;
      this.barDrawerOpen = false;
      this.save();
      this.renderAll();
    }

    // ─── Fancy Signing Modal ───
    openSignModal(mercId) {
      const merc = this.getVisitor(mercId);
      if (!merc) return;
      const cfg = this.getTavernCfg();
      const modal = document.getElementById('sign-modal');
      const title = document.getElementById('sign-modal-title');
      const body = document.getElementById('sign-modal-body');

      title.textContent = `花样签约 · [${merc.tier}] ${merc.name}`;
      if (merc.isSigned) {
        body.innerHTML = `<p class="modal-sub">【${merc.name}】已是你的常驻签约王牌（当前 Lv.${merc.level}，每晚底薪 ${merc.salary}G）。</p>`;
        modal.classList.remove('hidden');
        return;
      }

      const bet = this.getActiveBet(merc.id);
      if (bet) {
        body.innerHTML = `<p class="modal-sub">对赌进行中：剩余 <b>${bet.nightsLeft}</b> 晚内带其累计赚取 <b>${bet.earnedGold}/${bet.targetGold}G</b> 赏金即自动免费转正！</p>`;
        modal.classList.remove('hidden');
        return;
      }

      if (this.state.signedRoster.length >= cfg.signCap) {
        body.innerHTML = `<p class="modal-sub">当前酒馆（${cfg.name}）签约上限已满（${this.state.signedRoster.length}/${cfg.signCap}）。请先点击顶部【扩建】升级酒馆！</p>`;
        modal.classList.remove('hidden');
        return;
      }

      const style = merc.signStyle;
      const req = merc.signReq;
      let html = `<p class="modal-sub">签约后长期留店培养（Lv.1→Lv.5）、出征 0 定金，每晚发底薪 <b>${merc.salary}G</b>。</p>`;

      if (style === 'bet') {
        html += `
          <div class="armory-item">
            <div class="armory-item-head"><strong>对赌签约（贪财鬼专属）</strong><span class="gold-big" style="font-size:15px;">0 签字费</span></div>
            <div class="armory-item-perk">约定未来 ${req.nights} 晚内，带 ${merc.name} 出征累计拿下 <b>${req.targetGold}G</b> 总赏金，达标自动免费转正！</div>
            <button class="hd-btn hd-btn-amber" id="btn-do-sign-bet">签下对赌协议（0G）</button>
          </div>`;
      } else if (style === 'drink') {
        const dCfg = DRINKS.find((d) => d.id === req.drinkId) || DRINKS[0];
        const drunkOk = merc.drinkBuff && merc.drinkBuff.id === dCfg.id;
        html += `
          <div class="armory-item">
            <div class="armory-item-head"><strong>灌酒按手印（酒鬼专属）</strong><span class="gold-big" style="font-size:15px;">${req.gold}G</span></div>
            <div class="armory-item-perk">先请他喝一杯【${dCfg.name}】灌到微醺，再付 ${req.gold}G 顺手按手印签约！</div>
            <button class="hd-btn hd-btn-amber" id="btn-do-sign-drink" ${drunkOk ? '' : 'disabled'}>${drunkOk ? `微醺达成！支付 ${req.gold}G 签约` : `请先喂一杯【${dCfg.name}】`}</button>
          </div>`;
      } else if (style === 'gift') {
        const eligibleGear = this.state.armory.filter((g) => !g.equippedBy && (TIERS[g.tier]?.rank || 1) >= req.minTierRank);
        html += `
          <div class="armory-item">
            <div class="armory-item-head"><strong>装备聘礼（武器痴 / 大佬专属）</strong></div>
            <div class="armory-item-perk">给钱免谈！必须从军火架送一件高阶装备当聘礼才肯签。</div>
            ${eligibleGear.length === 0
              ? `<div class="armory-item-meta">军火架暂无符合品级且未穿戴的装备（去打高难单或开盲盒获取）。</div>`
              : eligibleGear.map((g) => `<button class="hd-btn hd-btn-amber btn-gift-sign" data-uid="${g.uid}">送出 [${g.tier}] ${g.name} 拐进店！</button>`).join('')
            }
          </div>`;
      } else {
        const repOk = this.state.rep >= req.rep;
        html += `
          <div class="armory-item">
            <div class="armory-item-head"><strong>义气签约（声望派专属）</strong><span class="gold-big" style="font-size:15px;">${req.gold}G</span></div>
            <div class="armory-item-perk">要求酒馆声望 ≥ ${req.rep}（当前 ${this.state.rep}），签约后底薪低且极度忠诚。</div>
            <button class="hd-btn hd-btn-amber" id="btn-do-sign-rep" ${repOk ? '' : 'disabled'}>${repOk ? `声望达标！支付 ${req.gold}G 签约` : `声望不足（需 ${req.rep}）`}</button>
          </div>`;
      }

      body.innerHTML = html;
      modal.classList.remove('hidden');

      const completeSign = (mId) => {
        this.state.signedRoster.push({ id: mId, level: 1, xp: 0 });
        this.state.stats.signsDone++;
        this.codex.add(mId);
        this.saveCodex();
        this.computeMercStats(merc);
        sfx.playSynergy();
        this.tavern.say(mId, '签字画押！以后这酒馆算我半个家！', 4.5);
        modal.classList.add('hidden');
        this.save();
        this.renderAll();
      };

      const betBtn = document.getElementById('btn-do-sign-bet');
      if (betBtn) {
        betBtn.onclick = () => {
          this.state.activeBets.push({ mercId: merc.id, targetGold: req.targetGold, earnedGold: 0, nightsLeft: req.nights });
          sfx.playSlotSnap();
          this.tavern.say(merc.id, `成交！${req.nights}晚内赚够 ${req.targetGold}G 我就常驻！`, 4.2);
          modal.classList.add('hidden');
          this.save();
          this.renderAll();
        };
      }
      const drinkBtn = document.getElementById('btn-do-sign-drink');
      if (drinkBtn) {
        drinkBtn.onclick = () => {
          if (this.state.gold < req.gold) { sfx.playError(); this.showToast('金币不足！', 2000); return; }
          this.state.gold -= req.gold;
          completeSign(merc.id);
        };
      }
      const repBtn = document.getElementById('btn-do-sign-rep');
      if (repBtn) {
        repBtn.onclick = () => {
          if (this.state.gold < req.gold) { sfx.playError(); this.showToast('金币不足！', 2000); return; }
          this.state.gold -= req.gold;
          completeSign(merc.id);
        };
      }
      body.querySelectorAll('.btn-gift-sign').forEach((btn) => {
        btn.onclick = () => {
          const uid = btn.dataset.uid;
          this.state.armory = this.state.armory.filter((g) => g.uid !== uid);
          completeSign(merc.id);
        };
      });
    }

    // ─── Armory & 10-Second Auction ───
    openArmoryModal(targetMercId = null) {
      this._armoryTargetMercId = targetMercId || this.inspectedMercId;
      document.getElementById('armory-list-view').classList.remove('hidden');
      document.getElementById('auction-stage').classList.add('hidden');
      this.renderArmoryList();
      document.getElementById('armory-modal').classList.remove('hidden');
    }

    renderArmoryList() {
      const grid = document.getElementById('armory-grid');
      if (this.state.armory.length === 0) {
        grid.innerHTML = `<div class="armory-empty">军火架空置中 · 出征或黑市可掉落装备</div>`;
        return;
      }
      const targetMerc = this._armoryTargetMercId ? this.getVisitor(this._armoryTargetMercId) : this.getSquadMercs()[0] || this.state.visitors[0];
      grid.innerHTML = this.state.armory.map((g) => {
        const t = TIERS[g.tier] || TIERS.C;
        const holder = g.equippedBy ? this.getVisitor(g.equippedBy) : null;
        const quickSell = Math.round(g.basePrice * 0.65);
        const elHtml = g.element ? `<span class="gear-el-corner">${uiIcons.elBadge(g.element, { size: 18 })}</span>` : '';
        return `
          <div class="armory-item game-card" style="--tier-col:${t.color};--tier-bg:${t.bg};--tier-bd:${t.border}">
            <div class="armory-item-main">
              <div class="gear-icon-frame" style="border-color:${t.border};box-shadow:0 0 12px ${t.color}33">
                <img src="./assets/gear/${g.id}.png" alt="${g.name}" />
                <span class="gear-tier-corner" style="color:${t.color};background:${t.bg}">${g.tier}</span>
                ${elHtml}
              </div>
              <div class="armory-item-info">
                <div class="armory-item-head">
                  <strong>${g.name}</strong>
                  <span class="mini-pill">${g.slot === 'weapon' ? '武器' : '奇物'}</span>
                </div>
                <div class="stat-pill-row">
                  <span class="stat-pill pwr">⚔ +${g.power}</span>
                  <span class="stat-pill gold">租 +${g.rent}G</span>
                  ${g.bonusGold ? `<span class="stat-pill gold">爆 +${g.bonusGold}G</span>` : ''}
                  ${g.safeBonus ? `<span class="stat-pill cyan">稳 +${g.safeBonus}</span>` : ''}
                </div>
                ${holder ? `<div class="holder-tag">已租给 · ${holder.name}</div>` : ''}
              </div>
            </div>
            <div class="armory-item-btns">
              ${holder
                ? `<button class="hd-btn btn-unequip-gear" data-uid="${g.uid}">收回</button>`
                : `<button class="hd-btn hd-btn-cyan btn-equip-gear" data-uid="${g.uid}" ${targetMerc ? '' : 'disabled'}>租给 ${targetMerc ? targetMerc.name : '佣兵'}</button>
                   <button class="hd-btn hd-btn-amber btn-auction-gear" data-uid="${g.uid}">10秒拍卖</button>
                   <button class="hd-btn btn-sell-gear" data-uid="${g.uid}">售 ${quickSell}G</button>`
              }
            </div>
          </div>`;
      }).join('');

      grid.querySelectorAll('.btn-equip-gear').forEach((btn) => {
        btn.onclick = () => {
          const item = this.state.armory.find((x) => x.uid === btn.dataset.uid);
          if (!item || !targetMerc) return;
          // Replace same slot on targetMerc if occupied
          for (const g of this.state.armory) {
            if (g.equippedBy === targetMerc.id && g.slot === item.slot) g.equippedBy = null;
          }
          item.equippedBy = targetMerc.id;
          this.computeMercStats(targetMerc);
          sfx.playSlotSnap();
          this.showToast(`已将【${item.name}】租给 ${targetMerc.name}，出征即收租金 +${item.rent}G！`, 2400);
          this.save();
          this.renderArmoryList();
          this.renderAll();
        };
      });

      grid.querySelectorAll('.btn-unequip-gear').forEach((btn) => {
        btn.onclick = () => {
          const item = this.state.armory.find((x) => x.uid === btn.dataset.uid);
          if (!item) return;
          const prev = this.getVisitor(item.equippedBy);
          item.equippedBy = null;
          if (prev) this.computeMercStats(prev);
          sfx.playDrop();
          this.save();
          this.renderArmoryList();
          this.renderAll();
        };
      });

      grid.querySelectorAll('.btn-sell-gear').forEach((btn) => {
        btn.onclick = () => {
          const idx = this.state.armory.findIndex((x) => x.uid === btn.dataset.uid);
          if (idx === -1) return;
          const item = this.state.armory[idx];
          const val = Math.round(item.basePrice * 0.65);
          this.state.armory.splice(idx, 1);
          this.state.gold += val;
          sfx.playCoin();
          this.showToast(`急售【${item.name}】套现 +${val}G`, 2200);
          this.save();
          this.renderArmoryList();
          this.renderAll();
        };
      });

      grid.querySelectorAll('.btn-auction-gear').forEach((btn) => {
        btn.onclick = () => this.startTenSecondAuction(btn.dataset.uid);
      });
    }

    startTenSecondAuction(uid) {
      const item = this.state.armory.find((x) => x.uid === uid && !x.equippedBy);
      if (!item) return;

      document.getElementById('armory-list-view').classList.add('hidden');
      document.getElementById('auction-stage').classList.remove('hidden');
      const t = TIERS[item.tier] || TIERS.C;
      const iconBox = document.getElementById('auction-item-icon');
      if (iconBox) {
        iconBox.style.borderColor = t.border;
        iconBox.innerHTML = `<img src="./assets/gear/${item.id}.png" alt="${item.name}" /><span class="gear-tier-corner" style="color:${t.color};background:${t.bg}">${item.tier}</span>`;
      }
      document.getElementById('auction-item-name').textContent = item.name;

      const bidsBox = document.getElementById('auction-bids');
      bidsBox.innerHTML = '';

      const bidders = ['蒙面黑市豪客', '红眼武器痴', '商会采购官', '隔壁酒馆阔佬', '王城暗卫'];
      this.auctionState = {
        uid,
        item,
        timeLeft: 10.0,
        price: Math.round(item.basePrice * 0.9),
        hypeCount: 0,
        risk: 10,
        nextAutoBid: 1.4,
        interval: null
      };

      const pushBid = (who, amt, note = '') => {
        const div = document.createElement('div');
        div.className = 'bid-row';
        div.textContent = `${who} 喊价：${amt}G ${note}`;
        bidsBox.appendChild(div);
        bidsBox.scrollTop = bidsBox.scrollHeight;
      };

      pushBid('拍卖开场', this.auctionState.price, '（起拍！）');
      this.updateAuctionUI();

      this.auctionState.interval = setInterval(() => {
        const st = this.auctionState;
        if (!st) return;
        st.timeLeft = Math.max(0, st.timeLeft - 0.1);
        st.nextAutoBid -= 0.1;
        if (st.nextAutoBid <= 0 && st.timeLeft > 0.5) {
          st.nextAutoBid = 1.6 + Math.random() * 1.4;
          const bump = Math.max(10, Math.round(st.item.basePrice * (0.09 + Math.random() * 0.08)));
          st.price += bump;
          const who = bidders[Math.floor(Math.random() * bidders.length)];
          pushBid(who, st.price, '“我要了！”');
          sfx.playCoin();
        }
        this.updateAuctionUI();
        if (st.timeLeft <= 0) {
          this.finishAuction(true);
        }
      }, 100);
    }

    updateAuctionUI() {
      const st = this.auctionState;
      if (!st) return;
      document.getElementById('auction-timer').textContent = `${st.timeLeft.toFixed(1)}s`;
      document.getElementById('auction-price').textContent = `${st.price}G`;
      const riskLabel = st.risk < 30 ? '低' : st.risk < 55 ? '中' : '极高';
      document.getElementById('auction-risk').textContent = `${riskLabel} (${st.risk}%)`;
    }

    hypeAuction() {
      const st = this.auctionState;
      if (!st) return;
      st.hypeCount++;
      const roll = Math.random() * 100;
      if (roll < st.risk) {
        // Over-hyped! Bidders walk out!
        sfx.playError();
        this.stopAuctionInterval();
        this.auctionState = null;
        this.showToast('拱火过头！豪客全嫌太贵散场流拍，装备退回军火架！', 3000);
        document.getElementById('armory-list-view').classList.remove('hidden');
        document.getElementById('auction-stage').classList.add('hidden');
        this.renderArmoryList();
        return;
      }
      const bump = Math.max(18, Math.round(st.price * 0.22));
      st.price += bump;
      st.risk = Math.min(82, st.risk + 22);
      sfx.playSynergy();
      const bidsBox = document.getElementById('auction-bids');
      const div = document.createElement('div');
      div.className = 'bid-row';
      div.style.borderLeftColor = '#ff5978';
      div.textContent = `老板带节奏拱火成功！豪客红眼加价至 ${st.price}G！`;
      bidsBox.appendChild(div);
      bidsBox.scrollTop = bidsBox.scrollHeight;
      this.updateAuctionUI();
    }

    finishAuction(sold) {
      const st = this.auctionState;
      if (!st) return;
      this.stopAuctionInterval();
      if (sold) {
        this.state.armory = this.state.armory.filter((g) => g.uid !== st.uid);
        this.state.gold += st.price;
        this.state.stats.auctionEarned += st.price;
        this.state.stats.auctionCount++;
        sfx.playCoin();
        this.showToast(`落槌成交！【${st.item.name}】拍出 ${st.price}G！`, 3000);
      }
      this.auctionState = null;
      document.getElementById('armory-list-view').classList.remove('hidden');
      document.getElementById('auction-stage').classList.add('hidden');
      this.save();
      this.renderArmoryList();
      this.renderAll();
    }

    stopAuctionInterval() {
      if (this.auctionState && this.auctionState.interval) {
        clearInterval(this.auctionState.interval);
        this.auctionState.interval = null;
      }
    }

    // ─── Live Tavern Events ───
    maybeTriggerLiveEvent() {
      if (this.state.eventDoneToday || this.state.dispatchedToday) return;
      const candidates = [];
      for (const ev of EVENTS) {
        if (ev.hookTag) {
          const matched = this.state.visitors.find((v) => v.lifeTag && v.lifeTag.id === ev.hookTag);
          if (matched) candidates.push({ ev, ctx: { merc: matched, wanted: this.state.wanted } });
        } else if (ev.needGear) {
          const gear = this.state.armory.find((g) => !g.equippedBy);
          if (gear) candidates.push({ ev, ctx: { gear, wanted: this.state.wanted } });
        } else if (ev.needSigned) {
          const s = this.state.signedRoster[0];
          const m = s ? this.getVisitor(s.id) : null;
          if (m) candidates.push({ ev, ctx: { signed: m, wanted: this.state.wanted } });
        } else {
          candidates.push({ ev, ctx: { merc: this.state.visitors[0], wanted: this.state.wanted } });
        }
      }
      if (!candidates.length) return;
      // Prefer tag-hooked events for maximum humor!
      const tagMatches = candidates.filter((c) => c.ev.hookTag);
      const picked = tagMatches.length
        ? tagMatches[Math.floor(Math.random() * tagMatches.length)]
        : candidates[Math.floor(Math.random() * candidates.length)];

      this.activeEvent = picked;
      this.state.eventDoneToday = true;

      document.getElementById('event-modal-title').textContent = picked.ev.title;
      document.getElementById('event-modal-desc').textContent = picked.ev.desc(picked.ctx);
      const box = document.getElementById('event-choices');
      box.innerHTML = picked.ev.choices.map((ch, i) => `
        <button class="hd-btn ${ch.kind === 'amber' ? 'hd-btn-amber' : ch.kind === 'crimson' ? 'hd-btn-crimson' : ''}" data-idx="${i}">${ch.label}</button>
      `).join('');

      box.querySelectorAll('button').forEach((btn) => {
        btn.onclick = () => this.resolveLiveEvent(picked.ev.choices[Number(btn.dataset.idx)].action, picked.ctx);
      });

      document.getElementById('event-modal').classList.remove('hidden');
      sfx.playSlotSnap();
    }

    resolveLiveEvent(action, ctx) {
      const modal = document.getElementById('event-modal');
      const cfg = this.getTavernCfg();
      let msg = '酒馆恢复了平静。';

      if (action === 'pay_debt_sign') {
        if (this.state.gold >= 60 && this.state.signedRoster.length < cfg.signCap && !ctx.merc.isSigned) {
          this.state.gold -= 60;
          this.state.signedRoster.push({ id: ctx.merc.id, level: 1, xp: 0 });
          this.codex.add(ctx.merc.id);
          this.saveCodex();
          this.computeMercStats(ctx.merc);
          msg = `替 ${ctx.merc.name} 扛下 60G 债，对方感动签下长期卖身契！`;
        } else {
          this.state.rep = Math.min(100, this.state.rep + 4);
          msg = '钱不够或名额满，好言劝退了讨债人（声望 +4）。';
        }
      } else if (action === 'sell_out_merc') {
        this.state.gold += 55;
        this.state.rep = Math.max(0, this.state.rep - 10);
        this.state.visitors = this.state.visitors.filter((v) => v.id !== ctx.merc.id);
        msg = `把 ${ctx.merc.name} 卖给讨债人换了 55G，全店冷眼相看（声望 -10）！`;
      } else if (action === 'brawl_bet') {
        this.state.gold += 65;
        this.state.rep = Math.max(0, this.state.rep - 4);
        if (ctx.merc) { ctx.merc.eventPowerMult = 1.15; this.computeMercStats(ctx.merc); }
        msg = '趁乱开盘口狂收 65G 抽水，店里战意高涨！';
      } else if (action === 'protect_merc') {
        this.state.rep = Math.min(100, this.state.rep + 8);
        if (ctx.merc) { ctx.merc.eventPowerMult = 1.2; this.computeMercStats(ctx.merc); }
        msg = `护短成功！声望 +8，${ctx.merc.name} 今晚战力 +20%！`;
      } else if (action === 'bribe_ignore') {
        this.state.gold += 70;
        this.state.rep = Math.max(0, this.state.rep - 8);
        this.state.visitors = this.state.visitors.filter((v) => v.id !== ctx.merc.id);
        msg = '收下 70G 封口费装没看见，声望 -8。';
      } else if (action === 'take_dirty_money') {
        this.state.gold += 120;
        this.state.rep = Math.max(0, this.state.rep - 8);
        this.state.wanted += 8;
        msg = '收下 120G 黑钱！声望 -8，城卫通缉 +8。';
      } else if (action === 'reject_dirty_money') {
        this.state.rep = Math.min(100, this.state.rep + 10);
        msg = '把黑钱甩金主脸上！酒馆义气名声大振（声望 +10）。';
      } else if (action === 'bribe_guard') {
        const pay = Math.min(this.state.gold, 55);
        this.state.gold -= pay;
        this.state.wanted = Math.max(0, this.state.wanted - 12);
        msg = `塞了 ${pay}G 茶水费，通缉度下降！`;
      } else if (action === 'defy_guard') {
        this.state.rep = Math.min(100, this.state.rep + 6);
        this.state.rentPenalty += 25;
        msg = '硬顶城卫队长（声望 +6），但下次地税被穿小鞋 +25G！';
      } else if (action === 'calm_brawl') {
        const pay = Math.min(this.state.gold, 20);
        this.state.gold -= pay;
        this.state.rep = Math.min(100, this.state.rep + 4);
        for (const v of this.state.visitors) {
          v.loyalty = Math.min(100, v.loyalty + 6);
          this.state.loyaltyMap[v.id] = v.loyalty;
        }
        msg = '请喝麦酒稳住全场，全店忠诚 +6，声望 +4！';
      } else if (action === 'buy_mystery_gear') {
        if (this.state.gold < 85) {
          msg = '金币不足 85G，行商摇摇头走了。';
        } else {
          this.state.gold -= 85;
          const highPool = EQUIPMENT_POOL.filter((g) => (TIERS[g.tier]?.rank || 1) >= 4 && (TIERS[g.tier]?.rank || 1) <= 9);
          const tpl = highPool[Math.floor(Math.random() * highPool.length)];
          this.addGearToArmory(tpl);
          if (Math.random() < 0.45) {
            this.state.wanted += 10;
            msg = `开箱爆出 [${tpl.tier}] ${tpl.name}！但似乎是赃物（通缉 +10）！`;
          } else {
            msg = `血赚！开箱爆出 [${tpl.tier}] ${tpl.name}，已收入军火架！`;
          }
        }
      } else if (action === 'sell_gear_vip' && ctx.gear) {
        const val = Math.round(ctx.gear.basePrice * 1.55);
        this.state.armory = this.state.armory.filter((g) => g.uid !== ctx.gear.uid);
        this.state.gold += val;
        this.state.stats.auctionEarned += val;
        msg = `豪客现金拿下【${ctx.gear.name}】，暴赚 +${val}G！`;
      } else if (action === 'keep_gear_vip') {
        this.state.rep = Math.min(100, this.state.rep + 5);
        msg = '留作镇店之宝，豪客佩服你的眼光（声望 +5）。';
      } else if (action === 'retain_signed' && ctx.signed) {
        const pay = Math.min(this.state.gold, 50);
        this.state.gold -= pay;
        ctx.signed.loyalty = Math.min(100, ctx.signed.loyalty + 15);
        this.state.loyaltyMap[ctx.signed.id] = ctx.signed.loyalty;
        msg = `发出 ${pay}G 留任奖金，${ctx.signed.name} 忠诚 +15！`;
      } else if (action === 'dare_leave' && ctx.signed) {
        if (ctx.signed.loyalty < 65) {
          this.state.signedRoster = this.state.signedRoster.filter((s) => s.id !== ctx.signed.id);
          ctx.signed.isSigned = false;
          msg = `${ctx.signed.name} 忠诚偏低，当场撕约跳槽走了！`;
        } else {
          ctx.signed.loyalty = Math.min(100, ctx.signed.loyalty + 6);
          msg = `${ctx.signed.name} 讲义气拒绝了高薪挖角（忠诚 +6）！`;
        }
      }

      modal.classList.add('hidden');
      this.activeEvent = null;
      sfx.playCoin();
      this.showToast(msg, 3400);
      this.save();
      this.renderAll();
    }

    addGearToArmory(tpl) {
      this.state.armory.push({
        uid: `gear_${this.state.nextGearUid++}`,
        ...tpl,
        equippedBy: null
      });
    }

    // ─── Squad Assignment ───
    sortSquadByRole() {
      const roleRank = { tank: 1, warrior: 2, assassin: 3, ranged: 4, support: 5 };
      const active = this.state.squadIds
        .filter((id) => id && this.getVisitor(id))
        .sort((a, b) => {
          const ma = this.getVisitor(a);
          const mb = this.getVisitor(b);
          const ra = roleRank[ma?.role] || 3;
          const rb = roleRank[mb?.role] || 3;
          return ra - rb;
        });
      this.state.squadIds = [active[0] || null, active[1] || null, active[2] || null];
    }

    assignMercToSlot(mercId) {
      if (this.state.dispatchedToday) return;
      if (this.state.squadIds.includes(mercId)) return;
      const openIdx = this.state.squadIds.indexOf(null);
      if (openIdx === -1) { sfx.playError(); return; }
      this.state.squadIds[openIdx] = mercId;
      this.sortSquadByRole();
      this.lastDeployedMercId = mercId;

      sfx.playSlotSnap();
      if (this.computeSquadMetrics().activeSynergies.length > 0) sfx.playSynergy();
      const merc = this.getVisitor(mercId);
      if (merc) this.tavern.say(mercId, merc.isSigned ? '常驻随时待命！' : `算我一个！定金 ${merc.effectiveFee}G。`, 2.8);
      this.inspectedMercId = null;
      this.contractDeskOpen = true;
      this.save();
      this.renderAll();
    }

    removeMercFromSlot(slotIdx) {
      if (this.state.dispatchedToday) return;
      if (this.state.squadIds[slotIdx]) {
        this.state.squadIds[slotIdx] = null;
        this.sortSquadByRole();
        sfx.playDrop();
        this.save();
        this.renderAll();
      }
    }

    getCarriedDrinkCost() {
      let sum = 0;
      for (const id of this.carriedDrinks) {
        const d = BATTLE_DRINKS.find((x) => x.id === id);
        if (d) sum += d.cost;
      }
      return sum;
    }

    // ─── Dispatch & Real Interactive v7.0 Battle Resolution ───
    dispatchSquad() {
      const m = this.computeSquadMetrics();
      if (m.squad.length === 0 || this.state.dispatchedToday) return;
      const drinkCost = this.getCarriedDrinkCost();
      const totalUpfront = m.totalFee + drinkCost;
      if (this.state.gold < totalUpfront) {
        sfx.playError();
        this.tavern.shake(6, 0.2);
        this.showToast(`金币不足垫付 ${totalUpfront}G（定金 ${m.totalFee}G + 备战酒 ${drinkCost}G）`, 3000);
        return;
      }

      this.state.gold -= totalUpfront;
      if (m.upfrontRent > 0) {
        this.state.gold += m.upfrontRent;
        this.state.stats.gearRentEarned += m.upfrontRent;
        this.showToast(`出征收租落袋 +${m.upfrontRent}G！`, 2200);
      }

      const carried = this.carriedDrinks.filter(Boolean);
      this.carriedDrinks = [null, null];

      this.state.dispatchedToday = true;
      this.contractDeskOpen = false;
      sfx.playWaxSlam();
      this.tavern.shake(12, 0.34);
      this.tavern.burstParticles(1120, 560, '#ef233c', 30, 180);
      this.tavern.startSquadMarchOut(m.squad.map((x) => x.id));

      const contract = this.getActiveContract();
      if (contract.kind === 'heist') this.state.stats.heistsDone++;

      this.renderAll();
      setTimeout(() => this.openBattleTheater(contract, m, carried), 820);
    }

    finalizeBattleOutcome(contract, metrics, liveResult) {
      const victory = Boolean(liveResult && liveResult.victory);
      const squad = metrics.squad;

      let bonusGold = 0;
      let highlight = (liveResult && liveResult.highlight) || (victory ? '全员按职配合，顺利拿下悬赏' : 'Boss 火力太猛，狼狈撤回酒馆');

      for (const m of squad) {
        if (m.lifeTag && m.lifeTag.bonusLootGold) bonusGold += m.lifeTag.bonusLootGold;
        for (const g of this.getEquippedGear(m.id)) {
          if (g.bonusGold) bonusGold += g.bonusGold;
        }
      }
      if (victory) {
        if (squad.some((x) => x.id === 'vera_gambit') && Math.random() < 0.6) bonusGold += 45;
        else if (squad.some((x) => x.id === 'buck_pirate')) bonusGold += 35;
        else if (squad.some((x) => x.id === 'crimson_fox')) bonusGold += 40;
      }

      // Monster Material Drops (1-2 materials stored in tavern inventory for Phase 2 Brewing & Phase 4 Forging!)
      let droppedMaterial = null;
      let droppedMatQty = 0;
      if (victory) {
        const primaryEl = (contract.elements && contract.elements[0]) || 'fire';
        const mat = MONSTER_MATERIALS[primaryEl] || MONSTER_MATERIALS.fire;
        droppedMaterial = mat;
        droppedMatQty = contract.tier >= 2 ? 2 : 1;
        this.state.materials = this.state.materials || {};
        this.state.materials[mat.id] = (this.state.materials[mat.id] || 0) + droppedMatQty;
      }

      let droppedGear = null;
      let brokenGearNames = [];
      if (victory && Math.random() < (contract.dropChance || 0.5)) {
        const minRank = contract.tier === 1 ? 2 : contract.tier === 2 ? 4 : 6;
        const maxRank = contract.tier === 1 ? 4 : contract.tier === 2 ? 8 : 11;
        const pool = EQUIPMENT_POOL.filter((g) => {
          const r = TIERS[g.tier]?.rank || 2;
          return r >= minRank && r <= maxRank;
        });
        if (pool.length) droppedGear = pool[Math.floor(Math.random() * pool.length)];
      } else if (!victory) {
        const hasAnvil = squad.some((x) => x.id === 'iron_anvil');
        const breakChance = hasAnvil ? 0.25 : 0.52;
        for (const m of squad) {
          for (const g of this.getEquippedGear(m.id)) {
            if (Math.random() < breakChance) {
              brokenGearNames.push(g.name);
              this.state.armory = this.state.armory.filter((x) => x.uid !== g.uid);
            }
          }
        }
      }

      const rawBase = victory ? contract.baseReward : Math.round(contract.baseReward * 0.26);
      const grossGold = Math.round(rawBase * metrics.lootMult) + bonusGold;

      return { victory, grossGold, droppedGear, droppedMaterial, droppedMatQty, brokenGearNames, highlight };
    }

    openBattleTheater(contract, metrics, carriedDrinks) {
      const modal = document.getElementById('theater-modal');
      modal.classList.remove('hidden');

      this.theater.play({
        squad: metrics.squad,
        contract,
        carriedDrinks,
        onDone: (liveResult) => {
          modal.classList.add('hidden');
          const outcome = this.finalizeBattleOutcome(contract, metrics, liveResult);
          this.pendingSettlement = { contract, metrics, outcome };
          this.save();
          this.openSettlementModal();
        }
      });
    }

    // ─── Settlement & GPT Fix #2 (Walk-In Cut Redline) ───
    openSettlementModal() {
      const ps = this.pendingSettlement;
      if (!ps) return;
      const { outcome, metrics } = ps;
      const modal = document.getElementById('settlement-modal');
      const stamp = document.getElementById('result-stamp');
      stamp.textContent = outcome.victory ? '大获全胜' : '惨败撤退';
      stamp.className = `result-stamp ${outcome.victory ? 'win' : 'lose'}`;
      document.getElementById('settlement-title').textContent = outcome.victory
        ? '战利品麻袋砸在了吧台上！'
        : '残兵拖着瘪麻袋逃回了酒馆……';

      document.getElementById('sack-stage').classList.remove('hidden');
      document.getElementById('split-stage').classList.add('hidden');

      document.getElementById('settle-gross').textContent = `${outcome.grossGold}G`;
      const matTxt = outcome.droppedMaterial ? `素材: ${outcome.droppedMaterial.name}×${outcome.droppedMatQty}` : '';
      const gearTxt = outcome.droppedGear
        ? `掉落 [${outcome.droppedGear.tier}] ${outcome.droppedGear.name}`
        : outcome.brokenGearNames.length
          ? `团灭损毁：${outcome.brokenGearNames.join('、')}`
          : '';
      document.getElementById('settle-relic').textContent = [matTxt, gearTxt].filter(Boolean).join(' · ') || '无掉落';
      document.getElementById('settle-highlight').textContent = outcome.highlight;

      const minRedline = Math.min(...metrics.squad.map((m) => m.cutLimit));
      document.getElementById('cut-limit-hint').textContent = `(本队最低红线 ≤${minRedline}%)`;
      document.getElementById('cut-slider').value = Math.min(45, minRedline);
      this.updateSettlementPreview();
      modal.classList.remove('hidden');
    }

    updateSettlementPreview() {
      const ps = this.pendingSettlement;
      if (!ps) return;
      const cutPct = Number(document.getElementById('cut-slider').value);
      const { outcome, metrics, contract } = ps;
      const myGold = Math.round((outcome.grossGold * cutPct) / 100);
      const mercGold = outcome.grossGold - myGold;

      // Signed salary deduction
      const totalSalary = this.state.signedRoster.reduce((sum, s) => {
        const tpl = MERCENARY_POOL.find((x) => x.id === s.id);
        return sum + (tpl ? tpl.salary : 0);
      }, 0);

      let badge = `抽成 ${cutPct}% · 业内行规`;
      let badgeCls = '';
      if (cutPct <= 30) { badge = `抽成 ${cutPct}% · 仁义老板`; badgeCls = 'good'; }
      else if (cutPct >= 65) { badge = `抽成 ${cutPct}% · 吸血黑店`; badgeCls = 'evil'; }

      const badgeEl = document.getElementById('cut-badge');
      badgeEl.textContent = badge;
      badgeEl.className = `cut-badge ${badgeCls}`;

      let repDelta = outcome.victory ? (contract.repGain || 4) : -4;
      let totalLoyaltyDelta = 0;
      const reactions = [];

      for (const m of metrics.squad) {
        const overRedline = cutPct > m.cutLimit;
        const generous = cutPct <= m.cutLimit - 10;
        let reactTxt = '“按行规分，没毛病。”';
        let mood = 'ok';

        if (overRedline) {
          mood = 'mad';
          if (m.isSigned) {
            totalLoyaltyDelta -= 18;
            reactTxt = `“超我红线(${m.cutLimit}%)！再黑心老子撕约！”`;
          } else {
            // GPT Fix #2: Walk-ins flip the table & tank your reputation!
            repDelta -= 7;
            reactTxt = `“黑店超红线(${m.cutLimit}%)！出去给你差评！”(声望-7)`;
          }
        } else if (generous) {
          mood = 'happy';
          repDelta += 3;
          totalLoyaltyDelta += 10 + (m.lifeTag && m.lifeTag.fairLoyaltyBonus ? m.lifeTag.fairLoyaltyBonus : 0);
          reactTxt = m.isSigned ? '“老板局气！忠诚爆棚！”' : '“老板厚道！到处帮你美言！”(声望+3)';
        } else {
          totalLoyaltyDelta += outcome.victory ? 3 : -4;
        }
        reactions.push(`<div class="react-chip ${mood}"><b>${m.name}${m.isSigned ? '★' : ''}</b> ${reactTxt}</div>`);
      }

      document.getElementById('merc-reactions').innerHTML = reactions.join('');
      const netGold = myGold - totalSalary;
      document.getElementById('preview-my-gold').textContent = `${netGold >= 0 ? '+' : ''}${netGold}G${totalSalary > 0 ? ` (含底薪-${totalSalary})` : ''}`;
      document.getElementById('preview-merc-gold').textContent = `${mercGold}G`;
      const avgLoy = Math.round(totalLoyaltyDelta / Math.max(1, metrics.squad.length));
      document.getElementById('preview-rep-delta').textContent = `声望 ${repDelta >= 0 ? '+' : ''}${repDelta} · 忠诚 ${avgLoy >= 0 ? '+' : ''}${avgLoy}`;

      ps.preview = { cutPct, netGold, repDelta, avgLoy };
    }

    confirmSettlement() {
      const ps = this.pendingSettlement;
      if (!ps || !ps.preview) return;
      const { outcome, metrics, contract, preview } = ps;

      this.state.gold += preview.netGold;
      this.state.rep = Math.max(0, Math.min(100, this.state.rep + preview.repDelta));
      this.state.wanted = Math.max(0, this.state.wanted + (contract.wantedGain || 0));
      this.state.totalContracts++;
      if (outcome.victory) this.state.wins++;
      this.state.cutHistory.push(preview.cutPct);

      if (outcome.droppedGear) {
        this.addGearToArmory(outcome.droppedGear);
      }

      // Update signed XP/levels, loyalty, and active bets
      const deserted = [];
      for (const m of metrics.squad) {
        this.state.mvpCounts[m.id] = (this.state.mvpCounts[m.id] || 0) + 1;
        const over = preview.cutPct > m.cutLimit;
        const loyChange = over ? -18 : preview.cutPct <= m.cutLimit - 10 ? 10 : (outcome.victory ? 3 : -5);
        const nextLoy = Math.max(0, Math.min(100, (this.state.loyaltyMap[m.id] ?? m.loyalty) + loyChange));
        this.state.loyaltyMap[m.id] = nextLoy;

        // Signed level up or desertion
        const sEntry = this.getSignedEntry(m.id);
        if (sEntry) {
          if (outcome.victory && sEntry.level < 5) {
            sEntry.xp++;
            if (sEntry.xp >= 2) {
              sEntry.level++;
              sEntry.xp = 0;
              this.showToast(`★ 签约王牌【${m.name}】升至 Lv.${sEntry.level}！`, 2800);
            }
          }
          if (nextLoy < 25) {
            this.state.signedRoster = this.state.signedRoster.filter((x) => x.id !== m.id);
            deserted.push(m.name);
          }
        }

        // Check active 2-night bet
        const bet = this.getActiveBet(m.id);
        if (bet) {
          bet.earnedGold += outcome.grossGold;
          if (bet.earnedGold >= bet.targetGold) {
            this.state.activeBets = this.state.activeBets.filter((b) => b.mercId !== m.id);
            if (this.state.signedRoster.length < this.getTavernCfg().signCap) {
              this.state.signedRoster.push({ id: m.id, level: 1, xp: 0 });
              this.state.stats.signsDone++;
              this.codex.add(m.id);
              this.saveCodex();
              this.showToast(`对赌达成！【${m.name}】免费转正签约！`, 3200);
            }
          }
        }
      }

      // Tick down remaining active bets
      this.state.activeBets = this.state.activeBets.filter((b) => {
        b.nightsLeft--;
        return b.nightsLeft > 0;
      });

      if (deserted.length) {
        this.showToast(`警告：${deserted.join('、')} 忍无可忍撕约跑路了！`, 3400);
      }

      document.getElementById('settlement-modal').classList.add('hidden');
      this.pendingSettlement = null;
      sfx.playCoin();

      // Check Rent every 3 nights (D3, D6, D9, D12, D15)
      const baseRent = RENT_SCHEDULE[this.state.day];
      if (baseRent) {
        const due = baseRent + this.state.rentPenalty;
        this.state.rentPenalty = 0;
        this.openRentModal(due);
      } else if (this.state.day >= MAX_DAYS) {
        this.openSummaryModal(false);
      } else {
        this.setupNight(this.state.day + 1);
        this.renderAll();
      }
    }

    openRentModal(due) {
      const modal = document.getElementById('rent-modal');
      const title = document.getElementById('rent-modal-title');
      const desc = document.getElementById('rent-modal-desc');
      const btn = document.getElementById('btn-rent-ok');

      if (this.state.gold >= due) {
        this.state.gold -= due;
        title.textContent = `第 ${this.state.day} 夜地税结清`;
        desc.textContent = `地税官收走了 ${due}G 税金，冷哼一声离开了酒馆。结余金币：${this.state.gold}G。`;
        btn.textContent = this.state.day >= MAX_DAYS ? '查看 15 夜终局档案' : '继续下一夜营业';
        btn.onclick = () => {
          modal.classList.add('hidden');
          if (this.state.day >= MAX_DAYS) this.openSummaryModal(false);
          else { this.setupNight(this.state.day + 1); this.renderAll(); }
        };
      } else {
        title.textContent = '交不起地税 · 酒馆查封破产！';
        desc.textContent = `本夜需缴地税 ${due}G，但账上仅有 ${this.state.gold}G。黑市封条贴上了大门……`;
        btn.textContent = '查看终局档案';
        btn.onclick = () => {
          modal.classList.add('hidden');
          this.openSummaryModal(true);
        };
      }
      modal.classList.remove('hidden');
      this.save();
      this.renderAll();
    }

    // ─── Algorithmic Title & 15-Night Summary (GPT Fix #3 neutral buttons) ───
    computeEndingTitle(bankrupt) {
      if (bankrupt) return { rank: '破产欠租掌柜', sub: '倒在了地税官的封条之下，下次记得留好流动资金或拍卖变现。' };
      const avgCut = this.state.cutHistory.length
        ? Math.round(this.state.cutHistory.reduce((a, b) => a + b, 0) / this.state.cutHistory.length)
        : 45;
      const st = this.state.stats;
      const gearTotal = st.gearRentEarned + st.auctionEarned;

      if (avgCut >= 58 && this.state.rep >= 65) {
        return { rank: '黑心慈善家', sub: '一边狠狠抽成，一边把酒馆声望刷到极高，黑白两道都拿你没办法！' };
      }
      if (gearTotal >= 420 || st.auctionCount >= 3) {
        return { rank: '暗夜军火之王', sub: `佣兵只是打工的，军火才是硬通货！本局靠出租与拍卖狂赚 ${gearTotal}G。` };
      }
      if (avgCut >= 58 || this.state.wanted >= 20) {
        return { rank: '血汗黑市教父', sub: `平均抽成 ${avgCut}%，全城佣兵恨得牙痒痒却又离不开你的高价黑单。` };
      }
      if (this.state.rep >= 75 && this.state.signedRoster.length >= 3) {
        return { rank: '王城传奇公会', sub: '高声望 + 满编签约王牌，你把一间破落小馆干成了全城标杆！' };
      }
      if (st.drinksServed >= 12) {
        return { rank: '午夜炼金酒神', sub: `整局狂调 ${st.drinksServed} 杯属性特调，靠灌酒改属性把 Boss 克得怀疑人生。` };
      }
      return { rank: '金牌佣兵经纪人', sub: '游走于风险与利润之间，成功撑过 15 夜暗夜经营考验！' };
    }

    openSummaryModal(bankrupt) {
      const ending = this.computeEndingTitle(bankrupt);
      document.getElementById('summary-rank').textContent = ending.rank;
      document.getElementById('summary-sub').textContent = ending.sub;
      document.getElementById('sum-gold').textContent = `${this.state.gold}G`;
      document.getElementById('sum-rep').textContent = `${this.state.rep} / 通缉${this.state.wanted}`;
      document.getElementById('sum-wins').textContent = `${this.state.wins} / ${this.state.totalContracts}`;
      const avgCut = this.state.cutHistory.length
        ? Math.round(this.state.cutHistory.reduce((a, b) => a + b, 0) / this.state.cutHistory.length)
        : 45;
      document.getElementById('sum-greed').textContent = `${avgCut}%`;

      let mvpId = 'iron_anvil';
      let best = -1;
      for (const [k, v] of Object.entries(this.state.mvpCounts)) {
        if (v > best) { best = v; mvpId = k; }
      }
      const mvp = MERCENARY_POOL.find((x) => x.id === mvpId) || MERCENARY_POOL[0];
      document.getElementById('sum-mvp-name').textContent = `[${mvp.tier}] ${mvp.name}（图鉴已签 ${this.codex.size}/14）`;
      document.getElementById('sum-mvp-quote').textContent = `“${mvp.barks[0]}”`;
      const mvpBox = document.getElementById('sum-mvp-sprite');
      mvpBox.innerHTML = '';
      const sp = sprites.createDomSprite(mvp.unitId, 'idle', 68);
      if (sp) mvpBox.appendChild(sp);

      document.getElementById('summary-modal').classList.remove('hidden');
      try { localStorage.removeItem(SAVE_KEY); } catch {}
    }

    // ─── Tavern Expansion Modal (3-Column Dark-Fantasy Blueprint Cards) ───
    openExpansionModal() {
      const grid = document.getElementById('upgrade-grid');
      grid.className = 'expansion-cards-grid';
      grid.innerHTML = TAVERN_LEVELS.map((lv) => {
        const owned = this.state.tavernLevel >= lv.level;
        const isNext = lv.level === this.state.tavernLevel + 1;
        const canAfford = isNext && this.state.gold >= lv.upgradeCost && this.state.rep >= lv.upgradeRep;
        const chips = (lv.unlockChips || []).map((c) => `<span class="stat-pill">${c}</span>`).join('');
        return `
          <div class="expansion-card ${owned ? 'owned' : isNext ? 'next' : 'locked'}">
            <div class="exp-bp-wrap">
              <img class="tavern-art-img" src="./assets/tavern/lv${lv.level}.png" alt="${lv.name}" />
              <span class="exp-lv-stamp">Lv.${lv.level}</span>
              ${owned ? `<span class="exp-owned-seal">已建成</span>` : ''}
            </div>
            <div class="exp-body">
              <div class="exp-title">${lv.name}</div>
              <div class="stat-pill-row">${chips}</div>
              <div class="exp-foot">
                ${owned
                  ? `<span class="exp-done-txt">营业中</span>`
                  : isNext
                    ? `<button class="hd-btn hd-btn-amber full-btn btn-expand-lv" data-lv="${lv.level}" ${canAfford ? '' : 'disabled'}>${canAfford ? `扩建 · ${lv.upgradeCost}G` : `需 ${lv.upgradeCost}G · 声望${lv.upgradeRep}`}</button>`
                    : `<span class="exp-lock-txt">需先建 Lv.${lv.level - 1}</span>`
                }
              </div>
            </div>
          </div>`;
      }).join('');

      grid.querySelectorAll('.btn-expand-lv').forEach((btn) => {
        btn.onclick = () => {
          const targetLv = Number(btn.dataset.lv);
          const cfg = TAVERN_LEVELS.find((x) => x.level === targetLv);
          if (!cfg || this.state.gold < cfg.upgradeCost || this.state.rep < cfg.upgradeRep) return;
          this.state.gold -= cfg.upgradeCost;
          this.state.tavernLevel = targetLv;
          this.tavern.setTavernLevel(targetLv);
          sfx.playSynergy();
          this.showToast(`扩建完成！【${cfg.name}】开门迎客，可左右横滑巡视大厅！`, 3400);
          this.save();
          this.openExpansionModal();
          this.renderAll();
        };
      });

      const rosterBox = document.getElementById('signed-roster-box');
      if (this.state.signedRoster.length === 0) {
        rosterBox.innerHTML = '<b>常驻签约花名册</b>：暂无签约佣兵（点击酒馆里的佣兵 → 花样签约）。';
      } else {
        rosterBox.innerHTML = `<b>常驻签约花名册 (${this.state.signedRoster.length}/${this.getTavernCfg().signCap})</b>：` +
          this.state.signedRoster.map((s) => {
            const tpl = MERCENARY_POOL.find((x) => x.id === s.id);
            return `[${tpl.tier}] ${tpl.name} Lv.${s.level} (底薪${tpl.salary}G)`;
          }).join(' ｜ ');
      }
      document.getElementById('codex-counter').textContent = `局外图鉴已签约：${this.codex.size} / ${MERCENARY_POOL.length}`;
      document.getElementById('upgrade-modal').classList.remove('hidden');
    }

    // ─── Rendering ───
    renderAll() {
      this.renderTopHud();
      this.renderDrinks();
      this.renderContractDesk();
      this.renderTavernSteelTray();
      this.renderDossier();
      const assignedSet = new Set(this.state.squadIds.filter(Boolean));
      this.tavern.syncMercenaries(this.state.visitors, assignedSet);
      this.tavern.selectedMercId = this.inspectedMercId;
      this.tavern.drinkReadyColor = this.selectedDrinkId
        ? (DRINKS.find((d) => d.id === this.selectedDrinkId)?.color || null)
        : null;

      // Highlight elemental synergy peers when inspecting a merc
      const peerSet = new Set();
      if (this.inspectedMercId) {
        const cur = this.getVisitor(this.inspectedMercId);
        if (cur) {
          for (const v of this.state.visitors) {
            if (v.id !== cur.id && v.activeElements.some((e) => cur.activeElements.includes(e))) {
              peerSet.add(v.id);
            }
          }
        }
      }
      this.tavern.synergyHighlightIds = peerSet;
    }

    // Bottom-Center Heavy Steel-Beveled Pixel Command Tray (3 Squad Sockets + 3 Quick-Serve Duelyst Drink Sockets!)
    renderTavernSteelTray() {
      const tray = document.getElementById('tavern-squad-tray');
      if (!tray) return;
      tray.innerHTML = '';

      // 1. 3 Squad Unit Sockets
      for (let i = 0; i < 3; i++) {
        const mercId = this.state.squadIds[i];
        const merc = mercId ? this.getVisitor(mercId) : null;
        const btn = document.createElement('button');
        btn.className = `tv-socket squad-sock ${merc ? 'filled' : 'empty'}`;
        if (merc) {
          const tCfg = TIERS[merc.tier] || TIERS.C;
          btn.style.setProperty('--sock-col', tCfg.color);
          btn.title = `${merc.name} (战力 ${merc.effectivePower}) · 点击打开悬赏台`;
          const sp = sprites.createDomSprite(merc.unitId, 'idle', 40);
          if (sp) btn.appendChild(sp);
          const tag = document.createElement('span');
          tag.className = 'tv-sock-badge';
          tag.textContent = merc.tier;
          tag.style.color = tCfg.color;
          btn.appendChild(tag);
        } else {
          btn.title = `空编队槽 ${i + 1} · 点击打开悬赏台`;
          btn.innerHTML = `<span class="tv-sock-plus">+</span>`;
        }
        btn.onclick = () => {
          this.contractDeskOpen = true;
          this.barDrawerOpen = false;
          this.inspectedMercId = null;
          sfx.playSlotSnap();
          this.renderAll();
        };
        tray.appendChild(btn);
      }

      // Steel divider between Squad Sockets and Quick-Drink Sockets
      const div = document.createElement('i');
      div.className = 'tv-sock-div';
      tray.appendChild(div);

      // 2. Quick-Serve Bar Drink Sockets (up to 3 featured drinks directly selectable!)
      const unlocked = DRINKS.filter((d) => d.minTavernLv <= this.state.tavernLevel).slice(0, 3);
      for (const d of unlocked) {
        const sel = this.selectedDrinkId === d.id;
        const btn = document.createElement('button');
        btn.className = `tv-socket drink-sock ${sel ? 'selected' : ''}`;
        btn.style.setProperty('--sock-col', d.color);
        btn.title = `${d.name} (${d.cost}G) · ${d.shortTag}`;
        const dUrl = d.duelystIcon && window.MT.vfx ? window.MT.vfx.getIconUrl(d.duelystIcon) : null;
        btn.innerHTML = dUrl
          ? `<img class="tv-sock-ico" src="${dUrl}" alt="${d.name}" /><span class="tv-sock-cost">${d.cost}</span>`
          : `<i class="pxi pxi-${d.pxIcon}"></i><span class="tv-sock-cost">${d.cost}</span>`;
        btn.onclick = () => {
          this.selectedDrinkId = this.selectedDrinkId === d.id ? null : d.id;
          this.barDrawerOpen = false;
          this.contractDeskOpen = false;
          sfx.playDrop();
          this.renderAll();
        };
        tray.appendChild(btn);
      }
    }

    renderTopHud() {
      const cfg = this.getTavernCfg();
      document.getElementById('hud-day').textContent = `D${this.state.day}/${MAX_DAYS}`;
      document.getElementById('hud-tavern-lv').textContent = `Lv.${cfg.level} ${cfg.name.slice(0, 4)}`;
      document.getElementById('hud-gold').textContent = `${this.state.gold}`;
      document.getElementById('hud-rep').textContent = `${this.state.rep}`;

      const wantedChip = document.getElementById('hud-wanted-chip');
      const wantedDiv = document.getElementById('hud-wanted-div');
      if (this.state.wanted > 0) {
        wantedChip.classList.remove('hidden');
        if (wantedDiv) wantedDiv.classList.remove('hidden');
        document.getElementById('hud-wanted').textContent = `${this.state.wanted}`;
      } else {
        wantedChip.classList.add('hidden');
        if (wantedDiv) wantedDiv.classList.add('hidden');
      }

      const nextRentDay = Object.keys(RENT_SCHEDULE).map(Number).find((d) => d >= this.state.day) || 15;
      const due = (RENT_SCHEDULE[nextRentDay] || 660) + this.state.rentPenalty;
      const left = nextRentDay - this.state.day;
      document.getElementById('hud-rent-text').textContent = left === 0 ? `今晚缴租 ${due}G` : `${left}夜缴租 ${due}G`;
      document.getElementById('btn-armory-label').textContent = `军火(${this.state.armory.length})`;
    }

    renderDrinks() {
      const list = document.getElementById('drink-list');
      const tray = document.getElementById('drink-tray');
      const unlocked = DRINKS.filter((d) => d.minTavernLv <= this.state.tavernLevel);
      const badge = document.getElementById('bar-fab-badge');
      if (badge) {
        const selDrink = this.selectedDrinkId ? DRINKS.find((d) => d.id === this.selectedDrinkId) : null;
        badge.textContent = selDrink ? `已端起:${selDrink.name}` : `${unlocked.length}款特调`;
      }
      if (tray) tray.classList.toggle('drawer-hidden', !this.barDrawerOpen);

      list.innerHTML = unlocked.map((d) => {
        const sel = this.selectedDrinkId === d.id ? 'selected' : '';
        const elIco = d.enchantElement ? uiIcons.elBadge(d.enchantElement, { size: 20 }) : '';
        const dUrl = d.duelystIcon && window.MT.vfx ? window.MT.vfx.getIconUrl(d.duelystIcon) : null;
        const icoHtml = dUrl
          ? `<img class="duelyst-drink-ico sm" src="${dUrl}" alt="${d.name}" />`
          : `<i class="pxi pxi-${d.pxIcon}"></i>`;
        return `
          <button class="drink-card drink-row-card ${sel}" data-drink="${d.id}" style="--drink-col:${d.color}">
            <div class="drink-row-top">
              ${icoHtml}
              <strong class="drink-name">${d.name}</strong>
              ${elIco}
              <span class="drink-cost">${d.cost}G</span>
            </div>
            <div class="drink-row-desc">${d.desc}</div>
          </button>`;
      }).join('');
    }

    renderContractDesk() {
      const tabs = document.getElementById('contract-tabs');
      tabs.innerHTML = this.state.contracts.map((c, idx) => {
        const dotCls = c.fog ? 'dot-fog' : c.kind === 'heist' ? 'dot-heist' : c.kind === 'escort' ? 'dot-escort' : 'dot-bounty';
        const lbl = c.fog ? '迷雾' : c.kind === 'heist' ? '劫镖' : c.kind === 'escort' ? '护镖' : '悬赏';
        return `
        <button class="contract-tab ${idx === this.state.activeContractIdx ? 'active' : ''}" data-cidx="${idx}">
          <i class="tab-wax-dot ${dotCls}"></i>
          <span>${lbl} ${idx + 1}</span>
        </button>`;
      }).join('');

      tabs.querySelectorAll('.contract-tab').forEach((btn) => {
        btn.onclick = () => {
          this.state.activeContractIdx = Number(btn.dataset.cidx);
          sfx.playDrop();
          this.renderAll();
        };
      });

      const contract = this.getActiveContract();
      if (!contract) return;
      const m = this.computeSquadMetrics();
      const revealed = m.revealed;

      document.getElementById('contract-tier').textContent = `${'I'.repeat(contract.tier)}阶`;
      document.getElementById('contract-boss-name').textContent = contract.bossName;
      document.getElementById('contract-title').textContent = contract.name.replace(/^【迷雾】/, '');
      document.getElementById('contract-threat').textContent = `${m.effThreat}`;
      document.getElementById('contract-reward').textContent = `${contract.baseReward}G`;

      // Element-tinted ambient halo behind Boss portrait
      const elGlowMap = {
        fire: '#ff6e3a', grass: '#5ef29b', ice: '#5ce6ff',
        light: '#ffe46b', dark: '#b56cff', bolt: '#64d2ff', fog: '#a87eff'
      };
      const primaryEl = revealed ? (contract.elements[0] || 'fire') : 'fog';
      const bossCol = document.getElementById('bounty-boss-col');
      if (bossCol) bossCol.style.setProperty('--boss-glow', elGlowMap[primaryEl] || '#ffd966');

      // Boss Elements (bold 38px gem badge in dossier header)
      const elBox = document.getElementById('contract-boss-els');
      if (revealed) {
        elBox.innerHTML = contract.elements.map((e) => uiIcons.elBadge(e, { size: 38 })).join('');
      } else {
        elBox.innerHTML = `${uiIcons.elBadge('fog', { size: 38 })}`;
      }

      // Boss hero showcase sprite (114px inside notched brass frame)
      const bossBox = document.getElementById('contract-boss-sprite');
      bossBox.innerHTML = '';
      const bsp = sprites.createDomSprite(contract.bossUnitId, 'idle', 114);
      if (bsp) bossBox.appendChild(bsp);

      this.renderSegBar('contract-threat-bar', Math.min(10, Math.round(m.effThreat / 22)), 10, '#ff5978');
      this.renderSegBar('contract-reward-bar', Math.min(10, Math.round(contract.baseReward / 55)), 10, '#ffd966');

      // Intel stamp: HIDDEN on standard open contracts; shown ONLY for Fog contracts
      const intelStrip = document.getElementById('intel-strip');
      const intelText = document.getElementById('intel-text');
      const scoutBtn = document.getElementById('btn-scout');
      if (!contract.fog) {
        intelStrip.className = 'intel-strip hidden';
        scoutBtn.classList.add('hidden');
      } else if (revealed) {
        intelStrip.className = 'intel-strip unlocked';
        intelText.innerHTML = `已探明 <span class="mini-pill">威胁-6%</span>`;
        scoutBtn.classList.add('hidden');
      } else {
        intelStrip.className = 'intel-strip locked';
        intelText.textContent = '迷雾隐藏属性';
        const hasAss = this.state.visitors.some((v) => v.role === 'assassin');
        scoutBtn.textContent = hasAss ? '刺客免费踩点' : '踩点 18G';
        scoutBtn.classList.remove('hidden');
      }

      // Sandtable 3D Stepped Stone/Brass Rune Pedestals (Auto-sorted by Role!)
      this.sortSquadByRole();
      const drinkCost = this.getCarriedDrinkCost();
      const totalUpfront = m.totalFee + drinkCost;
      document.getElementById('squad-fee').textContent = `${totalUpfront}G${m.upfrontRent > 0 ? `+租${m.upfrontRent}G` : ''}`;

      // Render compact 2-slot Carried Battle Drink Loadout (Tap to cycle: 不带 -> 烈焰 -> 圣泉 -> 狂暴)
      const loadoutEl = document.getElementById('bounty-drink-loadout');
      if (loadoutEl) {
        const cycleIds = [null, ...BATTLE_DRINKS.map((d) => d.id)];
        loadoutEl.innerHTML = `<span class="loadout-lbl">随队战中酒</span>` + this.carriedDrinks.map((did, idx) => {
          const d = BATTLE_DRINKS.find((x) => x.id === did);
          if (!d) {
            return `<button class="loadout-slot empty" data-lidx="${idx}"><span>+ 备酒槽 ${idx + 1}</span></button>`;
          }
          const dUrl = d.duelystIcon && window.MT.vfx ? window.MT.vfx.getIconUrl(d.duelystIcon) : null;
          const icoHtml = dUrl
            ? `<img class="duelyst-drink-ico xs" src="${dUrl}" alt="${d.name}" />`
            : `<i class="pxi pxi-${d.icon} pxi-sm"></i>`;
          return `<button class="loadout-slot filled" data-lidx="${idx}" style="--dcol:${d.color}">
            ${icoHtml}
            <b>${d.name}</b>
            <small>${d.cost}G</small>
          </button>`;
        }).join('');
        loadoutEl.querySelectorAll('.loadout-slot').forEach((btn) => {
          btn.onclick = () => {
            const idx = Number(btn.dataset.lidx);
            const curPos = cycleIds.indexOf(this.carriedDrinks[idx]);
            this.carriedDrinks[idx] = cycleIds[(curPos + 1) % cycleIds.length];
            sfx.playDrop();
            this.renderContractDesk();
          };
        });
      }
      const slotsEl = document.getElementById('squad-slots');
      const posNameMap = { 1: '前排', 2: '中排', 3: '后排' };
      const makePedestal3D = (glowCol, active) => `
        <div class="pedestal-3d ${active ? 'active' : 'idle'}" aria-hidden="true">
          <svg viewBox="0 0 160 64" class="pedestal-3d-svg">
            <defs>
              <linearGradient id="plinthSide" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#353954" />
                <stop offset="55%" stop-color="#1d1f33" />
                <stop offset="100%" stop-color="#0f101d" />
              </linearGradient>
              <linearGradient id="brassRim" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#7c531b" />
                <stop offset="50%" stop-color="#f2c868" />
                <stop offset="100%" stop-color="#7c531b" />
              </linearGradient>
            </defs>
            <!-- Ground drop shadow -->
            <ellipse cx="80" cy="52" rx="74" ry="11" fill="rgba(0,0,0,0.65)" />
            <!-- Lower stepped stone plinth -->
            <path d="M14,38 L14,48 A66,11 0 0,0 146,48 L146,38 Z" fill="url(#plinthSide)" stroke="#4c5174" stroke-width="1" />
            <ellipse cx="80" cy="38" rx="66" ry="11" fill="#23263d" stroke="url(#brassRim)" stroke-width="1.2" opacity="0.85" />
            <!-- Upper stepped pedestal tier -->
            <path d="M26,25 L26,35 A54,9.5 0 0,0 134,35 L134,25 Z" fill="url(#plinthSide)" stroke="#5b6088" stroke-width="1" />
            <!-- Carved front brass emblem on pedestal face -->
            <polygon points="80,29 85,34 80,39 75,34" fill="${active ? glowCol : '#9e7c44'}" opacity="${active ? 0.95 : 0.45}" />
            <!-- Top platform surface -->
            <ellipse cx="80" cy="25" rx="54" ry="9.5" fill="#17192b" stroke="${active ? glowCol : '#70604a'}" stroke-width="${active ? 1.8 : 1.1}" />
            <!-- Inner glowing rune ring -->
            <ellipse cx="80" cy="25" rx="43" ry="7" fill="${active ? glowCol : 'transparent'}" fill-opacity="${active ? 0.16 : 0}" stroke="${active ? glowCol : '#8f7d63'}" stroke-width="1.4" stroke-dasharray="7 5" opacity="${active ? 0.92 : 0.35}" />
          </svg>
        </div>`;

      slotsEl.querySelectorAll('.squad-slot').forEach((slotEl, idx) => {
        const mercId = this.state.squadIds[idx];
        const merc = mercId ? this.getVisitor(mercId) : null;
        slotEl.innerHTML = '';
        if (!merc) {
          slotEl.classList.remove('filled');
          slotEl.style.removeProperty('--slot-tier-col');
          slotEl.innerHTML = `${makePedestal3D('#9e8656', false)}<div class="slot-empty-crest"><span class="empty-rune-plus">+</span><span>待命</span></div>`;
          return;
        }
        const tCfg = TIERS[merc.tier] || TIERS.C;
        const rCfg = ROLES[merc.role] || ROLES.warrior;
        slotEl.classList.add('filled');
        slotEl.style.setProperty('--slot-tier-col', tCfg.color);

        // Element counter badge ONLY
        const cBadge = document.createElement('span');
        if (!revealed) {
          cBadge.className = 'slot-counter-tag fog';
          cBadge.textContent = '?';
        } else {
          const cRes = m.mercCounters[merc.id] || { mult: 1, tag: 'neutral' };
          if (cRes.tag === 'super2') { cBadge.className = 'slot-counter-tag super2'; cBadge.textContent = '×2.0'; }
          else if (cRes.tag === 'super') { cBadge.className = 'slot-counter-tag super'; cBadge.textContent = '×1.5'; }
          else if (cRes.tag === 'resist') { cBadge.className = 'slot-counter-tag resist'; cBadge.textContent = '×0.7'; }
        }
        if (cBadge.textContent) slotEl.appendChild(cBadge);

        const rmBtn = document.createElement('button');
        rmBtn.className = 'slot-rm';
        rmBtn.textContent = '×';
        rmBtn.onclick = (e) => { e.stopPropagation(); this.removeMercFromSlot(idx); };
        slotEl.appendChild(rmBtn);

        slotEl.insertAdjacentHTML('beforeend', makePedestal3D(tCfg.color, true));

        const preview = sprites.createDomSprite(merc.unitId, 'idle', 94);
        if (preview) {
          preview.classList.add('pedestal-sprite');
          slotEl.appendChild(preview);
        }

        const nm = document.createElement('div');
        nm.className = 'slot-name';
        nm.innerHTML = `${merc.name} <em class="slot-lane-tag">${posNameMap[rCfg.posOrder] || '中排'}</em>`;
        slotEl.appendChild(nm);
      });

      // Synergies (show ONLY active glowing badges)
      const synBar = document.getElementById('synergy-bar');
      if (m.activeSynergies.length > 0) {
        synBar.innerHTML = m.activeSynergies.map((s) => `<span class="syn-chip" style="border-color:${s.color};color:${s.color}">${s.name}</span>`).join('');
      } else {
        synBar.innerHTML = '';
      }

      // Unified Command Strip: Winrate Readout + Smooth 0.2s Roll + 8-Segment Bar
      const wrLbl = document.getElementById('winrate-lbl');
      const wrTxt = document.getElementById('winrate-text');
      const wrSegEl = document.getElementById('winrate-seg-bar');
      if (this._wrRaf) { cancelAnimationFrame(this._wrRaf); this._wrRaf = null; }
      const renderCmdSeg = (lit, color) => {
        if (!wrSegEl) return;
        let h = '';
        for (let i = 0; i < 8; i++) {
          h += `<i class="cmd-seg ${i < lit ? 'on' : ''}" style="${i < lit ? `background:${color};box-shadow:0 0 8px ${color}aa` : ''}"></i>`;
        }
        wrSegEl.innerHTML = h;
      };

      if (m.squad.length === 0) {
        wrLbl.textContent = '胜率';
        wrTxt.textContent = '0%';
        this._lastWinRate = 0;
        wrTxt.style.color = '#7b7896';
        wrTxt.style.textShadow = 'none';
        renderCmdSeg(0, '#555270');
      } else if (!revealed) {
        wrLbl.textContent = '迷雾估算';
        wrTxt.textContent = `${m.displayWinMin}–${m.displayWinMax}%`;
        wrTxt.style.color = '#d39bff';
        wrTxt.style.textShadow = '0 0 18px rgba(192, 122, 255, 0.55)';
        const midPct = Math.max(8, Math.min(100, Math.round((m.displayWinMin + m.displayWinMax) / 2)));
        renderCmdSeg(Math.max(1, Math.round((midPct / 100) * 8)), '#c78bff');
      } else {
        wrLbl.textContent = '胜率';
        const targetWr = m.exactWinRate;
        const fromWr = Number.isFinite(this._lastWinRate) ? this._lastWinRate : targetWr;
        this._lastWinRate = targetWr;
        if (fromWr !== targetWr) {
          const t0 = performance.now();
          const tickWr = (now) => {
            const p = Math.min(1, (now - t0) / 210);
            const eased = 1 - Math.pow(1 - p, 3);
            wrTxt.textContent = `${Math.round(fromWr + (targetWr - fromWr) * eased)}%`;
            if (p < 1) this._wrRaf = requestAnimationFrame(tickWr);
            else this._wrRaf = null;
          };
          this._wrRaf = requestAnimationFrame(tickWr);
        } else {
          wrTxt.textContent = `${targetWr}%`;
        }
        const col = m.exactWinRate >= 72 ? '#5ef29b' : m.exactWinRate >= 48 ? '#ffd966' : '#ff5978';
        const glow = m.exactWinRate >= 72 ? 'rgba(94, 242, 155, 0.5)' : m.exactWinRate >= 48 ? 'rgba(255, 217, 102, 0.45)' : 'rgba(255, 89, 120, 0.5)';
        wrTxt.style.color = col;
        wrTxt.style.textShadow = `0 0 20px ${glow}`;
        renderCmdSeg(Math.max(1, Math.round((m.exactWinRate / 100) * 8)), col);
      }

      const sealBtn = document.getElementById('wax-seal-btn');
      sealBtn.classList.toggle('disabled', m.squad.length === 0 || this.state.dispatchedToday);

      const modalEl = document.getElementById('contract-modal');
      if (modalEl) modalEl.classList.toggle('hidden', !this.contractDeskOpen);

      // Recessed Bronze Guild Tray: 3-Column Horizontal Sculpted Plaques (Scales 3 / 6 / 12+ seamlessly!)
      const rosterGrid = document.getElementById('bounty-roster-grid');
      if (rosterGrid) {
        rosterGrid.innerHTML = '';
        for (const v of this.state.visitors) {
          this.computeMercStats(v);
          const inSquad = this.state.squadIds.includes(v.id);
          const isJustDeployed = inSquad && this.lastDeployedMercId === v.id;
          const tCfg = TIERS[v.tier] || TIERS.C;

          // Element counter preview (STRICT GPT Fix #1: hidden if fog unrevealed!)
          let counterHtml = '';
          let isAdv = false;
          if (revealed && contract) {
            const cRes = getElementMultiplier(v.activeElements, contract.elements);
            if (cRes.tag === 'super2') { counterHtml = `<span class="rp-counter super">×2.0</span>`; isAdv = true; }
            else if (cRes.tag === 'super') { counterHtml = `<span class="rp-counter super">×1.5</span>`; isAdv = true; }
            else if (cRes.tag === 'resist') { counterHtml = `<span class="rp-counter resist">×0.7</span>`; }
          }

          const card = document.createElement('button');
          card.className = `roster-pick-card ${inSquad ? 'picked' : ''} ${isAdv && !inSquad ? 'adv-glow' : ''}`;
          card.style.setProperty('--tier-col', tCfg.color);

          // Glowing 6-segment power bar
          const lit = Math.max(1, Math.min(6, Math.round(v.effectivePower / 13)));
          let segHtml = '';
          for (let i = 0; i < 6; i++) {
            segHtml += `<i class="rp-seg ${i < lit ? 'on' : ''}" style="${i < lit ? `background:${tCfg.color};box-shadow:0 0 6px ${tCfg.color}88` : ''}"></i>`;
          }
          const feeLabel = v.isSigned ? '常驻' : v.effectiveFee === 0 ? '免费' : `${v.effectiveFee}G`;
          const feeCls = v.isSigned || v.effectiveFee === 0 ? 'free' : '';

          const stampHtml = inSquad ? `
            <div class="rp-crimson-seal ${isJustDeployed ? 'slam' : ''}" aria-label="已出阵">
              <svg viewBox="0 0 88 34" class="seal-svg" aria-hidden="true">
                <rect x="2" y="2" width="84" height="30" rx="2" fill="rgba(185, 22, 38, 0.28)" stroke="#e62e42" stroke-width="2.4" stroke-dasharray="18 2 24 1.5 22 2 16 1.5" />
                <rect x="6" y="6" width="76" height="22" rx="1" fill="none" stroke="#ff5266" stroke-width="1" opacity="0.85" />
              </svg>
              <span>已出阵</span>
            </div>` : '';

          card.innerHTML = `
            <div class="rp-alcove">
              <span class="rp-tier" style="color:${tCfg.color}">${v.tier}</span>
              <div class="rp-sprite-box"></div>
            </div>
            <div class="rp-body">
              <div class="rp-head-row">
                <span class="rp-name">${v.isSigned ? '★' : ''}${v.name}</span>
                <span class="rp-icons">${uiIcons.roleBadge(v.role, 22)}${v.activeElements.slice(0, 2).map((e) => uiIcons.elBadge(e, { size: 22 })).join('')}${counterHtml}</span>
              </div>
              <div class="rp-stat-row">
                <span class="rp-seg-bar">${segHtml}</span>
                <strong class="rp-pwr-num">${v.effectivePower}</strong>
                <span class="rp-fee ${feeCls}">${feeLabel}</span>
              </div>
            </div>
            ${stampHtml}
          `;
          const spBox = card.querySelector('.rp-sprite-box');
          const sp = sprites.createDomSprite(v.unitId, 'idle', 64);
          if (sp && spBox) spBox.appendChild(sp);

          card.onclick = () => {
            if (inSquad) this.removeMercFromSlot(this.state.squadIds.indexOf(v.id));
            else this.assignMercToSlot(v.id);
          };
          rosterGrid.appendChild(card);
        }
        this.lastDeployedMercId = null;
      }

      const fabBadge = document.getElementById('bounty-fab-badge');
      if (fabBadge) {
        if (m.squad.length === 0) fabBadge.textContent = `${this.state.contracts.length}张单 · 0/3`;
        else if (!revealed) fabBadge.textContent = `小队 ${m.squad.length}/3 · 迷雾`;
        else fabBadge.textContent = `小队 ${m.squad.length}/3 · ${m.exactWinRate}%`;
      }
    }

    renderDossier() {
      const box = document.getElementById('merc-dossier');
      if (!this.inspectedMercId) {
        box.classList.add('hidden');
        return;
      }
      const m = this.getVisitor(this.inspectedMercId);
      if (!m) { box.classList.add('hidden'); return; }

      this.computeMercStats(m);
      const tCfg = TIERS[m.tier] || TIERS.C;
      const rCfg = ROLES[m.role] || { name: '战士' };

      const tierEl = document.getElementById('dossier-tier');
      tierEl.textContent = m.tier;
      tierEl.style.color = tCfg.color;
      tierEl.style.background = tCfg.bg;

      document.getElementById('dossier-name').textContent = `${m.name}${m.isSigned ? ` Lv.${m.level}` : ''}`;
      document.getElementById('dossier-role').innerHTML = uiIcons.roleBadge(m.role, 26);
      document.getElementById('dossier-power').textContent = `${m.effectivePower}`;
      document.getElementById('dossier-fee').textContent = m.isSigned ? `底薪${m.salary}G` : `${m.effectiveFee}G`;
      document.getElementById('dossier-limit-text').textContent = m.isSigned ? `忠诚 ${m.loyalty}` : `红线 ≤${m.cutLimit}%`;

      this.renderSegBar('dossier-power-bar', Math.min(8, Math.round(m.effectivePower / 12)), 8, tCfg.color);

      const portrait = document.getElementById('dossier-portrait');
      portrait.innerHTML = '';
      const sp = sprites.createDomSprite(m.unitId, 'idle', 82);
      if (sp) portrait.appendChild(sp);

      document.getElementById('dossier-tags').innerHTML = m.activeElements.map((e) => uiIcons.elBadge(e, { size: 28 })).join('');

      const lt = document.getElementById('dossier-lifetag');
      lt.style.borderLeftColor = m.lifeTag.color;
      const chipHtml = (m.lifeTag.chips || []).map((c) => `<span class="stat-pill">${c}</span>`).join('');
      lt.innerHTML = `<span class="lt-name" style="color:${m.lifeTag.color}">${m.lifeTag.name}</span><div class="stat-pill-row">${chipHtml}</div>`;

      // Real 52x52 RPG Equipment Slots (with generated pixel art icons!)
      const gear = this.getEquippedGear(m.id);
      const wGear = gear.find((g) => g.slot === 'weapon');
      const rGear = gear.find((g) => g.slot === 'relic');
      const renderSlotCard = (slotType, gItem, btnId) => {
        if (gItem) {
          const gt = TIERS[gItem.tier] || TIERS.C;
          return `
            <button class="rpg-gear-slot filled" id="${btnId}" style="border-color:${gt.border}">
              <div class="gear-icon-frame sm" style="border-color:${gt.border}">
                <img src="./assets/gear/${gItem.id}.png" alt="${gItem.name}" />
                <span class="gear-tier-corner" style="color:${gt.color};background:${gt.bg}">${gItem.tier}</span>
              </div>
              <div class="rpg-slot-meta">
                <strong>${gItem.name}</strong>
                <span>⚔+${gItem.power} · 租+${gItem.rent}G</span>
              </div>
            </button>`;
        }
        return `
          <button class="rpg-gear-slot empty" id="${btnId}">
            <div class="gear-icon-frame sm empty-box">${uiIcons.slotPlaceholder(slotType)}</div>
            <div class="rpg-slot-meta">
              <strong>${slotType === 'weapon' ? '武器槽' : '奇物槽'}</strong>
              <span>+ 点击出租</span>
            </div>
          </button>`;
      };
      const gearRow = document.getElementById('dossier-gear-row');
      gearRow.innerHTML = renderSlotCard('weapon', wGear, 'btn-dossier-weapon') + renderSlotCard('relic', rGear, 'btn-dossier-relic');
      document.getElementById('btn-dossier-weapon').onclick = () => this.openArmoryModal(m.id);
      document.getElementById('btn-dossier-relic').onclick = () => this.openArmoryModal(m.id);

      document.getElementById('dossier-quirk').innerHTML = `<span class="ult-pill">大招</span> <b>${m.ultName}</b> <span class="quirk-short">· ${m.quirk.name}</span>`;

      const inSquad = this.state.squadIds.includes(m.id);
      const assignBtn = document.getElementById('dossier-assign-btn');
      assignBtn.textContent = inSquad ? '移出小队' : '拉入小队';
      assignBtn.onclick = () => {
        if (inSquad) this.removeMercFromSlot(this.state.squadIds.indexOf(m.id));
        else this.assignMercToSlot(m.id);
      };

      const signBtn = document.getElementById('dossier-sign-btn');
      const bet = this.getActiveBet(m.id);
      signBtn.textContent = m.isSigned ? `已签约 Lv.${m.level}` : bet ? `对赌中(${bet.earnedGold}/${bet.targetGold})` : '花样签约';
      signBtn.onclick = () => this.openSignModal(m.id);

      box.classList.remove('hidden');
    }

    renderSegBar(elId, filled, total, color) {
      const el = document.getElementById(elId);
      if (!el) return;
      let html = '';
      for (let i = 0; i < total; i++) {
        html += `<i class="seg-cell ${i < filled ? 'on' : ''}" style="${i < filled ? `background:${color};box-shadow:0 0 6px ${color}` : ''}"></i>`;
      }
      el.innerHTML = html;
    }

    // ─── UI & Pointer Engine (Touch-First: Pan Tavern + Drag Merc + Drag Drink + Wax Seal) ───
    bindStageResize() {
      const fit = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scale = Math.min(vw / STAGE_W, vh / STAGE_H);
        this.stageEl.style.transform = `scale(${scale})`;
      };
      window.addEventListener('resize', fit);
      fit();
    }

    bindUIEvents() {
      document.getElementById('btn-mute').onclick = () => {
        const on = sfx.toggleMute();
        document.getElementById('btn-mute').textContent = on ? '声:关' : '声:开';
      };
      document.getElementById('btn-upgrades').onclick = () => this.openExpansionModal();
      document.getElementById('upgrade-close').onclick = () => document.getElementById('upgrade-modal').classList.add('hidden');
      document.getElementById('btn-reset').onclick = () => {
        document.getElementById('upgrade-modal').classList.add('hidden');
        this.setupNight(1, true);
        this.renderAll();
      };

      document.getElementById('btn-armory').onclick = () => this.openArmoryModal(null);
      document.getElementById('armory-close').onclick = () => {
        this.stopAuctionInterval();
        this.auctionState = null;
        document.getElementById('armory-modal').classList.add('hidden');
      };
      document.getElementById('btn-auction-hype').onclick = () => this.hypeAuction();
      document.getElementById('btn-auction-hammer').onclick = () => this.finishAuction(true);

      document.getElementById('sign-close').onclick = () => document.getElementById('sign-modal').classList.add('hidden');
      document.getElementById('dossier-close').onclick = () => { this.inspectedMercId = null; this.renderAll(); };
      document.getElementById('btn-scout').onclick = () => this.scoutActiveContract();
      document.getElementById('btn-bounty-drawer').onclick = () => {
        this.contractDeskOpen = !this.contractDeskOpen;
        if (this.contractDeskOpen) this.barDrawerOpen = false;
        sfx.playDrop();
        this.renderAll();
      };
      document.getElementById('btn-close-contract-desk').onclick = () => {
        this.contractDeskOpen = false;
        sfx.playDrop();
        this.renderAll();
      };
      document.getElementById('contract-modal').onclick = (e) => {
        if (e.target && e.target.id === 'contract-modal') {
          this.contractDeskOpen = false;
          sfx.playDrop();
          this.renderAll();
        }
      };
      document.getElementById('btn-bar-drawer').onclick = () => {
        this.barDrawerOpen = !this.barDrawerOpen;
        if (this.barDrawerOpen) { this.contractDeskOpen = false; this.inspectedMercId = null; }
        sfx.playDrop();
        this.renderAll();
      };
      document.getElementById('btn-close-drink-tray').onclick = () => {
        this.barDrawerOpen = false;
        this.selectedDrinkId = null;
        sfx.playDrop();
        this.renderAll();
      };

      // Battle Theater controls (v7.0 segmented 1x / 2x speed toggle)
      const spd1 = document.getElementById('btn-bt-speed-1');
      const spd2 = document.getElementById('btn-bt-speed-2');
      if (spd1) spd1.onclick = () => this.theater.setSpeed(1);
      if (spd2) spd2.onclick = () => this.theater.setSpeed(2);

      // Settlement controls
      document.getElementById('loot-sack-btn').onclick = () => {
        sfx.playCoin();
        document.getElementById('sack-stage').classList.add('hidden');
        document.getElementById('split-stage').classList.remove('hidden');
      };
      document.getElementById('cut-slider').oninput = () => this.updateSettlementPreview();
      document.getElementById('btn-confirm-settle').onclick = () => this.confirmSettlement();

      // Summary neutral side-by-side buttons (GPT Fix #3)
      document.getElementById('btn-new-run').onclick = () => {
        document.getElementById('summary-modal').classList.add('hidden');
        this.setupNight(1, true);
        this.renderAll();
      };
      document.getElementById('btn-end-run').onclick = () => {
        document.getElementById('summary-modal').classList.add('hidden');
        this.showToast('本局已结束，随时可点右上角【扩建 → 重置存档】新开一局。', 4000);
      };

      // Wax seal press-and-hold (0.45s charge)
      const sealBtn = document.getElementById('wax-seal-btn');
      const sealProgress = document.getElementById('seal-progress');
      const startSeal = (e) => {
        e.preventDefault();
        if (sealBtn.classList.contains('disabled')) return;
        this.sealChargeStart = performance.now();
        const step = () => {
          if (!this.sealChargeStart) return;
          const pct = Math.min(1, (performance.now() - this.sealChargeStart) / 420);
          sealProgress.style.strokeDashoffset = `${208 * (1 - pct)}`;
          if (pct >= 1) {
            this.sealChargeStart = 0;
            sealProgress.style.strokeDashoffset = '208';
            this.dispatchSquad();
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };
      const cancelSeal = () => {
        this.sealChargeStart = 0;
        sealProgress.style.strokeDashoffset = '208';
      };
      sealBtn.addEventListener('pointerdown', startSeal);
      window.addEventListener('pointerup', cancelSeal);
      window.addEventListener('pointercancel', cancelSeal);
    }

    bindPointerEngine() {
      const ghost = document.getElementById('drag-ghost');

      // Drink dock pointerdown (tap to select OR drag to merc)
      document.getElementById('drink-list').addEventListener('pointerdown', (e) => {
        const card = e.target.closest('.drink-card');
        if (!card) return;
        const drinkId = card.dataset.drink;
        const drink = DRINKS.find((d) => d.id === drinkId);
        if (!drink) return;
        this.dragState = {
          kind: 'drink', id: drinkId, color: drink.color, label: drink.name,
          startX: e.clientX, startY: e.clientY, moved: false
        };
      });

      // Tavern canvas pointerdown (tap/drag merc OR pan hall horizontally)
      this.canvasEl.addEventListener('pointerdown', (e) => {
        const pt = this.tavern.clientToStage(e.clientX, e.clientY);
        const actor = this.tavern.hitTestMerc(pt.x, pt.y);
        if (actor) {
          if (this.selectedDrinkId) {
            this.serveDrinkToMerc(this.selectedDrinkId, actor.merc.id);
            return;
          }
          this.dragState = {
            kind: 'merc', id: actor.merc.id, actor,
            startX: e.clientX, startY: e.clientY, moved: false
          };
        } else {
          // Check interactive tavern props: Hanging Guild Bounty Board or Open-Air Oak Bar Counter!
          if (this.tavern.hitTestBountyBoard(pt.x, pt.y)) {
            this.contractDeskOpen = true;
            this.inspectedMercId = null;
            sfx.playSlotSnap();
            this.renderAll();
            return;
          }
          if (this.tavern.hitTestBarCounter && this.tavern.hitTestBarCounter(pt.x, pt.y)) {
            this.barDrawerOpen = !this.barDrawerOpen;
            if (this.barDrawerOpen) { this.contractDeskOpen = false; this.inspectedMercId = null; }
            sfx.playDrop();
            this.renderAll();
            return;
          }
          this.inspectedMercId = null;
          this.selectedDrinkId = null;
          if (this.contractDeskOpen && pt.x < 840) this.contractDeskOpen = false;
          if (this.barDrawerOpen && pt.x > 420) this.barDrawerOpen = false;
          if (this.tavern.maxScroll > 0) {
            this.panState = { lastX: e.clientX };
          }
          this.renderAll();
        }
      });

      window.addEventListener('pointermove', (e) => {
        if (this.panState) {
          const dx = (this.panState.lastX - e.clientX) * 1.25;
          this.panState.lastX = e.clientX;
          this.tavern.panBy(dx);
          return;
        }
        if (!this.dragState) return;
        const dist = Math.hypot(e.clientX - this.dragState.startX, e.clientY - this.dragState.startY);
        if (dist > 10 && !this.dragState.moved) {
          this.dragState.moved = true;
          ghost.classList.remove('hidden');
          if (this.dragState.kind === 'merc') {
            this.dragState.actor.lifted = true;
            ghost.innerHTML = '';
            const sp = sprites.createDomSprite(this.dragState.actor.merc.unitId, 'selected', 72);
            if (sp) ghost.appendChild(sp);
          } else {
            ghost.innerHTML = `<div class="drink-ghost" style="border-color:${this.dragState.color};color:${this.dragState.color}">${this.dragState.label}</div>`;
          }
        }
        if (this.dragState.moved) {
          ghost.style.left = `${e.clientX}px`;
          ghost.style.top = `${e.clientY}px`;
          if (this.dragState.kind === 'merc') {
            const pt = this.tavern.clientToStage(e.clientX, e.clientY);
            if (pt.x > 880 && !this.contractDeskOpen) {
              this.contractDeskOpen = true;
              const deskEl = document.getElementById('contract-desk');
              if (deskEl) deskEl.classList.remove('drawer-closed');
            }
          } else if (this.dragState.kind === 'drink') {
            const pt = this.tavern.clientToStage(e.clientX, e.clientY);
            const hit = this.tavern.hitTestMerc(pt.x, pt.y);
            this.tavern.dragTargetMercId = hit ? hit.merc.id : null;
            this.tavern.dragDrinkColor = this.dragState.color;
          }
        }
      });

      window.addEventListener('pointerup', (e) => {
        this.panState = null;
        if (!this.dragState) return;
        const ds = this.dragState;
        this.dragState = null;
        ghost.classList.add('hidden');
        this.tavern.dragTargetMercId = null;

        if (ds.kind === 'merc') {
          ds.actor.lifted = false;
          if (!ds.moved) {
            // Tap merc -> inspect dossier
            this.inspectedMercId = this.inspectedMercId === ds.id ? null : ds.id;
            sfx.playDrop();
            this.tavern.triggerTapFeedback(ds.id, '#4de8e8');
            this.renderAll();
          } else {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const slot = el && el.closest('.squad-slot');
            const desk = el && el.closest('#contract-desk');
            if (slot) this.assignMercToSlot(ds.id, Number(slot.dataset.slot));
            else if (desk) this.assignMercToSlot(ds.id, null);
          }
        } else if (ds.kind === 'drink') {
          if (!ds.moved) {
            this.selectedDrinkId = this.selectedDrinkId === ds.id ? null : ds.id;
            sfx.playDrop();
            this.renderAll();
          } else {
            const pt = this.tavern.clientToStage(e.clientX, e.clientY);
            const hit = this.tavern.hitTestMerc(pt.x, pt.y);
            if (hit) this.serveDrinkToMerc(ds.id, hit.merc.id);
          }
        }
      });
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.MT.game = new MidnightTavernGame();
    window.MT.game.init();
  });
})();
