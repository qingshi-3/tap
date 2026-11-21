// Main controller for Midnight Tavern v2.0 (Classic script: works on file:// double-click AND http://)
(function () {
  const { pixelArt, sfx, sprites, TavernCanvas, BattleTheater, STAGE_W, STAGE_H, DATA } = window.MT;
  const { DRINKS, SYNERGIES, MERCENARY_POOL, CONTRACTS, TAVERN_UPGRADES, MORNING_HEADLINES } = DATA;
  const SAVE_KEY = 'midnight_tavern_v2';

  class MidnightTavernGame {
    constructor() {
      pixelArt.injectPixelTheme();
      this.stageEl = document.getElementById('stage');
      this.canvasEl = document.getElementById('tavern-canvas');
      this.tavern = new TavernCanvas(this.canvasEl);
      this.theater = new BattleTheater(
        document.getElementById('battle-canvas'),
        document.getElementById('bt-log-box')
      );

      this.state = this.createInitialState();
      this.selectedDrinkId = null;
      this.inspectedMercId = null;
      this.dragState = null;
      this.sealChargeStart = 0;
      this.pendingSettlement = null;

      this.bindStageResize();
      this.bindUIEvents();
      this.bindPointerEngine();
    }

    createInitialState() {
      return {
        day: 1,
        maxDays: 7,
        endless: false,
        gold: 165,
        rep: 50,
        upgrades: [],
        wins: 0,
        totalContracts: 0,
        cutHistory: [],
        mvpCounts: {},
        loyaltyMap: Object.fromEntries(MERCENARY_POOL.map((m) => [m.id, m.loyalty])),
        visitors: [],
        contracts: [],
        activeContractIdx: 0,
        squadIds: [null, null, null],
        unlockedIntelIds: [],
        dispatchedToday: false,
        headline: MORNING_HEADLINES[0]
      };
    }

    async init() {
      await sprites.load();
      this.loadSaveOrStart();
      this.tavern.start();
      this.renderAll();
    }

    loadSaveOrStart() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.day && Array.isArray(parsed.visitors) && parsed.visitors.length > 0) {
            this.state = parsed;
            return;
          }
        }
      } catch {}
      this.setupNight(1, true);
    }

    showToast(msg, ms = 2600) {
      const el = document.getElementById('event-toast');
      if (!el) return;
      el.textContent = msg;
      el.classList.remove('hidden');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
    }

    save() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
      } catch {}
    }

    setupNight(day, isFresh = false) {
      if (isFresh) this.state = this.createInitialState();
      this.state.day = day;
      this.state.dispatchedToday = false;
      this.state.squadIds = [null, null, null];
      this.state.unlockedIntelIds = [];
      this.state.headline = MORNING_HEADLINES[(day - 1) % MORNING_HEADLINES.length];

      const hasHearth = this.state.upgrades.includes('hearth');
      const hasVip = this.state.upgrades.includes('vip_booth');
      const hasSpy = this.state.upgrades.includes('spy_net');

      const count = hasHearth ? 7 : 6;
      const pool = [...MERCENARY_POOL].sort((a, b) => {
        const wA = Math.random() + (hasVip && a.power >= 40 ? 0.35 : 0);
        const wB = Math.random() + (hasVip && b.power >= 40 ? 0.35 : 0);
        return wB - wA;
      });

      this.state.visitors = pool.slice(0, count).map((tpl) => {
        const loyalty = Math.min(100, (this.state.loyaltyMap[tpl.id] ?? tpl.loyalty) + (hasHearth ? 4 : 0));
        return {
          ...tpl,
          loyalty,
          drinkBuff: null,
          effectivePower: tpl.power,
          effectiveFee: tpl.fee
        };
      });

      const maxTier = day <= 2 ? 2 : 3;
      const eligible = CONTRACTS.filter((c) => c.tier <= maxTier);
      const picked = [...eligible].sort(() => Math.random() - 0.5).slice(0, 3).sort((a, b) => a.threat - b.threat);
      this.state.contracts = picked.map((c) => ({
        ...c,
        threat: Math.round(c.threat * (1 + Math.max(0, day - 2) * 0.05)),
        baseReward: Math.round(c.baseReward * (1 + Math.max(0, day - 1) * 0.07) * (hasSpy ? 1.15 : 1))
      }));
      this.state.activeContractIdx = 0;
      if (hasSpy) this.state.unlockedIntelIds = this.state.contracts.map((c) => c.id);

      this.tavern.resetMarch();
      if (this.showToast) this.showToast(`第 ${day} 夜开张 — 拖酒套情报，拎人派悬赏`, 2400);
      this.save();
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

    getDrinkCost(drink) {
      return this.state.upgrades.includes('cellar') ? Math.ceil(drink.cost * 0.5) : drink.cost;
    }

    computeSquadMetrics() {
      const contract = this.getActiveContract();
      const squad = this.getSquadMercs();
      const intelUnlocked = contract && this.state.unlockedIntelIds.includes(contract.id);

      let totalPower = 0;
      let totalFee = 0;
      let safeBonus = 0;
      let lootMult = 1;
      const tagCounts = {};

      const hasLocke = squad.some((m) => m.id === 'lady_locke');
      const hasMord = squad.some((m) => m.id === 'mord_blood');
      const hasKiri = squad.some((m) => m.id === 'kiri_mist');

      for (const m of squad) {
        let p = m.effectivePower;
        if (hasLocke && m.id !== 'lady_locke') p = Math.round(p * 1.15);
        if (hasMord && (m.tags.includes('暗影') || m.tags.includes('秘术'))) p = Math.round(p * 1.12);
        totalPower += p;
        totalFee += m.effectiveFee;
        if (m.drinkBuff && m.drinkBuff.effect.steady) safeBonus += 10;
        if (m.id === 'aria_sun') safeBonus += 10;
        for (const t of m.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
      }

      const activeSynergies = [];
      for (const syn of SYNERGIES) {
        if ((tagCounts[syn.tag] || 0) >= syn.need) {
          activeSynergies.push(syn);
          totalPower += syn.bonusPower || 0;
          safeBonus += syn.bonusSafe || 0;
          lootMult += syn.bonusLoot || 0;
        }
      }

      let weakMatched = false;
      if (contract && (tagCounts[contract.weakTag] || 0) > 0) {
        weakMatched = true;
        totalPower += intelUnlocked ? 24 : 14;
      }

      let effThreat = contract ? contract.threat : 100;
      if (hasKiri) effThreat = Math.round(effThreat * 0.84);
      if (intelUnlocked) effThreat = Math.round(effThreat * 0.92);

      let winRate = 0;
      if (squad.length > 0) {
        const ratio = totalPower / Math.max(1, effThreat);
        winRate = Math.round(Math.max(12, Math.min(98, 16 + ratio * 66 + safeBonus * 0.5)));
      }

      return { squad, totalPower, totalFee, activeSynergies, weakMatched, intelUnlocked, winRate, lootMult, effThreat };
    }

    serveDrinkToMerc(drinkId, mercId) {
      const drink = DRINKS.find((d) => d.id === drinkId);
      const merc = this.getVisitor(mercId);
      if (!drink || !merc) return;

      const cost = this.getDrinkCost(drink);
      if (this.state.gold < cost) {
        sfx.playError();
        const actor = this.tavern.getMercActor(mercId);
        if (actor) this.tavern.spawnFloater(actor.x, actor.y - 95, '金币不够调酒!', '#ff595e');
        return;
      }

      this.state.gold -= cost;
      const cellarBonus = this.state.upgrades.includes('cellar') ? 0.08 : 0;
      const favBonus = merc.favDrink === drink.id ? 0.1 : 0;
      const pMult = 1 + drink.effect.powerMult + cellarBonus + favBonus;
      merc.drinkBuff = drink;
      merc.effectivePower = Math.round(merc.power * pMult);
      merc.effectiveFee = Math.max(8, Math.round(merc.fee * (1 - (drink.effect.feeDiscount || 0))));
      merc.loyalty = Math.min(100, merc.loyalty + (drink.effect.loyaltyDelta || 0) + (merc.favDrink === drink.id ? 5 : 0));
      this.state.loyaltyMap[merc.id] = merc.loyalty;

      const actor = this.tavern.getMercActor(mercId);
      sfx.playDrinkServe();
      if (actor) {
        this.tavern.burstParticles(actor.x, actor.y - 54, drink.color, 24, 150);
        this.tavern.triggerAnim(mercId, 'selected', 1.1);
        const favText = merc.favDrink === drink.id ? ' 最爱!' : '';
        this.tavern.spawnFloater(actor.x, actor.y - 108, `${drink.name} 战力->${merc.effectivePower}${favText}`, drink.glow);
      }

      const contract = this.getActiveContract();
      if (drink.effect.revealIntel && contract && !this.state.unlockedIntelIds.includes(contract.id)) {
        this.state.unlockedIntelIds.push(contract.id);
        this.tavern.say(mercId, merc.intelBark, 5.2);
        if (actor) this.tavern.spawnFloater(actor.x, actor.y - 134, '已套出副本情报 & 砍价30%!', '#4de8a8');
        sfx.playSynergy();
      } else {
        this.tavern.say(mercId, merc.drunkBark, 4.4);
      }

      this.selectedDrinkId = null;
      this.save();
      this.renderAll();
    }

    assignMercToSlot(mercId, slotIdx = null) {
      if (this.state.dispatchedToday) return;
      const existingSlot = this.state.squadIds.indexOf(mercId);
      if (existingSlot !== -1) {
        if (slotIdx === null || slotIdx === existingSlot) return;
        const other = this.state.squadIds[slotIdx];
        this.state.squadIds[slotIdx] = mercId;
        this.state.squadIds[existingSlot] = other;
      } else {
        const target = slotIdx !== null ? slotIdx : this.state.squadIds.indexOf(null);
        if (target === -1) {
          sfx.playError();
          return;
        }
        this.state.squadIds[target] = mercId;
      }

      sfx.playSlotSnap();
      if (this.computeSquadMetrics().activeSynergies.length > 0) sfx.playSynergy();

      const merc = this.getVisitor(mercId);
      if (merc) this.tavern.say(mercId, `算我一个！定金 ${merc.effectiveFee}G。`, 3.0);
      this.inspectedMercId = null;
      this.save();
      this.renderAll();
    }

    removeMercFromSlot(slotIdx) {
      if (this.state.dispatchedToday) return;
      if (this.state.squadIds[slotIdx]) {
        this.state.squadIds[slotIdx] = null;
        sfx.playDrop();
        this.save();
        this.renderAll();
      }
    }

    dispatchSquad() {
      const m = this.computeSquadMetrics();
      if (m.squad.length === 0 || this.state.dispatchedToday) return;
      if (this.state.gold < m.totalFee) {
        sfx.playError();
        this.tavern.shake(6, 0.2);
        this.showToast(`金币不足垫付 ${m.totalFee}G 定金 — 喝【迷雾苦艾】可砍价 30%`, 3000);
        return;
      }

      this.state.gold -= m.totalFee;
      this.state.dispatchedToday = true;
      sfx.playWaxSlam();
      this.tavern.shake(12, 0.34);
      this.tavern.burstParticles(1120, 560, '#ef233c', 30, 180);
      this.tavern.startSquadMarchOut(m.squad.map((x) => x.id));

      const contract = this.getActiveContract();
      const outcome = this.resolveExpedition(contract, m);
      this.pendingSettlement = { contract, metrics: m, outcome };

      this.renderAll();
      setTimeout(() => this.openBattleTheater(contract, m, outcome), 900);
    }

    resolveExpedition(contract, metrics) {
      const roll = Math.random() * 100;
      const victory = roll <= metrics.winRate;
      const squad = metrics.squad;

      let bonusGold = 0;
      let highlight = victory ? '全员稳健推进，顺利拿下悬赏' : 'Boss过于凶猛，狼狈撤回酒馆';
      const beats = [];

      const h0 = squad[0];
      beats.push({
        actor: 'hero', heroIndex: 0, dmgPct: 26, crit: !!h0.drinkBuff,
        kind: h0.drinkBuff ? 'crit' : 'hit',
        popup: h0.drinkBuff ? '酒劲暴击!' : '先手突袭!',
        text: `${h0.name}（${h0.title}）率先冲入阵中${h0.drinkBuff ? `，借着【${h0.drinkBuff.name}】劲头` : ''}重创 ${contract.bossName}！`
      });

      const hasVera = squad.find((x) => x.id === 'vera_gambit');
      const hasBuck = squad.find((x) => x.id === 'buck_pirate');
      const hasSeven = squad.find((x) => x.id === 'seven_boom');
      const hasFox = squad.find((x) => x.id === 'crimson_fox');

      if (hasVera && Math.random() < 0.55) {
        bonusGold += 45;
        highlight = '红桃薇拉【梭哈暴击】偷走Boss密袋 +45G';
        beats.push({ actor: 'quirk', kind: 'quirk', popup: '千术顺财 +45G!', text: `红桃薇拉趁乱发动【梭哈暴击】，反手摸走了 ${contract.bossName} 的私房钱袋（+45G）！` });
      } else if (hasBuck) {
        bonusGold += 35;
        highlight = '黑胡子巴克【顺手牵羊】多捞 +35G';
        beats.push({ actor: 'quirk', kind: 'quirk', popup: '顺手牵羊 +35G!', text: '黑胡子巴克一边砍怪一边撬地砖，顺手多刮走 35G 战利品！' });
      } else if (hasFox) {
        bonusGold += 38;
        highlight = '赤尾【鬼火引财】发现隐藏暗格 +38G';
        beats.push({ actor: 'quirk', kind: 'quirk', popup: '隐藏宝箱 +38G!', text: '灯笼狐灵赤尾嗅到密室气味，带队掀开隐藏宝箱（+38G）！' });
      } else if (metrics.activeSynergies.length > 0) {
        const syn = metrics.activeSynergies[0];
        beats.push({
          actor: 'hero', heroIndex: Math.min(1, squad.length - 1), dmgPct: 30, crit: true, kind: 'crit',
          popup: `羁绊·${syn.name}!`,
          text: `队伍触发羁绊【${syn.name}】，默契连招打得 ${contract.bossName} 节节败退！`
        });
      }

      const tankIdx = Math.max(0, squad.findIndex((x) => x.id === 'iron_anvil'));
      beats.push({
        actor: 'boss', heroIndex: tankIdx, kind: 'boss',
        popup: squad[tankIdx].id === 'iron_anvil' ? '铁砧硬扛!' : 'Boss反扑!',
        text: squad[tankIdx].id === 'iron_anvil'
          ? `${contract.bossName} 发动狂暴重击，银盾老兵【铁砧】死扛到底纹丝不动！`
          : `${contract.bossName} 狂怒反扑，逼得 ${squad[tankIdx].name} 狼狈翻滚躲避！`
      });

      const finisher = hasSeven || squad[squad.length - 1];
      const finisherIdx = squad.indexOf(finisher);
      if (victory) {
        beats.push({
          actor: 'hero', heroIndex: finisherIdx, dmgPct: 55, crit: true, kind: 'crit',
          popup: hasSeven ? '艺术就是爆炸!' : '致命终结!',
          text: hasSeven
            ? `火药桶老七点着三捆黑火药轰碎天花板，直接把 ${contract.bossName} 炸飞上天！`
            : `${finisher.name} 抓住破绽一剑封喉，${contract.bossName} 轰然倒地！`
        });
      } else {
        beats.push({
          actor: 'boss', heroIndex: finisherIdx, kind: 'boss', popup: '险些团灭!',
          text: `${contract.bossName} 底牌尽出，小队见势不妙抓起地上散落的财宝连夜撤退……`
        });
      }

      const relicVal = victory ? parseInt((contract.relicDrop.match(/\+(\d+)G/) || [0, 30])[1], 10) : 0;
      const grossLoot = victory
        ? Math.round((contract.baseReward + bonusGold) * metrics.lootMult) + relicVal
        : Math.round(contract.baseReward * 0.38 + bonusGold * 0.5);

      return { victory, grossLoot, relicText: victory ? contract.relicDrop : '无（撤退时掉在半路了）', highlight, beats };
    }

    openBattleTheater(contract, metrics, outcome) {
      const modal = document.getElementById('theater-modal');
      document.getElementById('theater-subtitle').textContent = `${contract.name} · 胜率 ${metrics.winRate}%`;
      modal.classList.remove('hidden');
      this.theater.setSpeed(1);
      document.getElementById('btn-bt-speed').textContent = '加速 2x';

      this.theater.play({
        squad: metrics.squad, contract, outcome, beats: outcome.beats,
        onDone: () => {
          modal.classList.add('hidden');
          this.openSettlement();
        }
      });
    }

    openSettlement() {
      if (!this.pendingSettlement) return;
      const { outcome } = this.pendingSettlement;
      const modal = document.getElementById('settlement-modal');
      const stamp = document.getElementById('result-stamp');
      stamp.textContent = outcome.victory ? '大获全胜' : '惊险撤退';
      stamp.className = `result-stamp ${outcome.victory ? '' : 'fail'}`;
      document.getElementById('settlement-title').textContent = outcome.victory
        ? '沉甸甸的战利品麻袋砸在了吧台上！'
        : '佣兵们灰头土脸扛回半袋残余财宝……';

      document.getElementById('sack-stage').classList.remove('hidden');
      document.getElementById('split-stage').classList.add('hidden');
      modal.classList.remove('hidden');
    }

    burstLootSack() {
      sfx.playSackBurst();
      const { outcome } = this.pendingSettlement;
      document.getElementById('sack-stage').classList.add('hidden');
      document.getElementById('split-stage').classList.remove('hidden');

      document.getElementById('settle-gross').textContent = `${outcome.grossLoot}G`;
      document.getElementById('settle-relic').textContent = outcome.relicText;
      document.getElementById('settle-highlight').textContent = outcome.highlight;

      document.getElementById('cut-slider').value = '45';
      this.updateCutPreview(45);
    }

    updateCutPreview(cutPct) {
      if (!this.pendingSettlement) return;
      const { metrics, outcome } = this.pendingSettlement;
      const myGold = Math.round(outcome.grossLoot * (cutPct / 100));
      const mercGold = outcome.grossLoot - myGold;

      let label = '业内行规';
      if (cutPct <= 30) label = '慈善大老板';
      else if (cutPct <= 45) label = '业内行规';
      else if (cutPct <= 60) label = '精明经纪人';
      else if (cutPct <= 70) label = '黑心吸血鬼';
      else label = '资本家天花板';

      document.getElementById('cut-badge').textContent = `抽成 ${cutPct}% · ${label}`;
      document.getElementById('preview-my-gold').textContent = `+${myGold}G`;
      document.getElementById('preview-merc-gold').textContent = `${mercGold}G`;

      const hasVip = this.state.upgrades.includes('vip_booth');
      let repDelta = outcome.victory ? 6 : -4;
      let loyaltyDelta = 0;
      if (cutPct <= 30) { repDelta += 8; loyaltyDelta = 12; }
      else if (cutPct <= 45) { repDelta += 3; loyaltyDelta = 4; }
      else if (cutPct <= 60) { repDelta -= 2; loyaltyDelta = -4; }
      else if (cutPct <= 70) { repDelta -= 7; loyaltyDelta = -12; }
      else { repDelta -= 14; loyaltyDelta = -22; }
      if (repDelta > 0 && hasVip) repDelta = Math.round(repDelta * 1.3);

      const repSign = repDelta >= 0 ? `+${repDelta}` : `${repDelta}`;
      const loySign = loyaltyDelta >= 0 ? `+${loyaltyDelta}` : `${loyaltyDelta}`;
      document.getElementById('preview-rep-delta').textContent = `声望 ${repSign} · 忠诚 ${loySign}`;

      const container = document.getElementById('merc-reactions');
      container.innerHTML = '';
      for (const m of metrics.squad) {
        const greedLimit = Math.round((1 - m.greed * 0.45) * 75);
        const isAngry = cutPct >= greedLimit;
        const isHappy = cutPct <= 35;

        const card = document.createElement('div');
        card.className = `reaction-card ${isAngry ? 'angry' : isHappy ? 'happy' : ''}`;
        card.appendChild(sprites.createDomSprite(m.unitId, isAngry ? 'hit' : 'idle', 42));

        const txt = document.createElement('div');
        txt.className = 'reaction-text';
        const quote = isAngry
          ? `“抽${cutPct}%？！下次直接去隔壁酒馆！”`
          : isHappy
            ? '“老板大气！以后好活先紧着你！”'
            : '“分账还算公道，明晚继续合作。”';
        txt.innerHTML = `<strong>${m.name}</strong>${quote}`;
        card.appendChild(txt);
        container.appendChild(card);
      }

      this.pendingSettlement.calculated = { cutPct, myGold, repDelta, loyaltyDelta };
    }

    confirmSettlement() {
      if (!this.pendingSettlement || !this.pendingSettlement.calculated) return;
      const { metrics, outcome, calculated } = this.pendingSettlement;

      this.state.gold += calculated.myGold;
      this.state.rep = Math.max(0, this.state.rep + calculated.repDelta);
      this.state.totalContracts += 1;
      if (outcome.victory) this.state.wins += 1;
      this.state.cutHistory.push(calculated.cutPct);

      for (const m of metrics.squad) {
        this.state.mvpCounts[m.id] = (this.state.mvpCounts[m.id] || 0) + 1;
        this.state.loyaltyMap[m.id] = Math.max(10, Math.min(100, (this.state.loyaltyMap[m.id] ?? m.loyalty) + calculated.loyaltyDelta));
      }

      if (calculated.cutPct >= 65) sfx.playGrumpy();
      else sfx.playCheer();

      document.getElementById('settlement-modal').classList.add('hidden');
      this.pendingSettlement = null;

      if (this.state.day % 3 === 0) {
        const rent = 120 + Math.floor((this.state.day - 1) / 3) * 60;
        this.showRentModal(rent);
        return;
      }
      this.advanceNextNight();
    }

    showRentModal(rent) {
      const modal = document.getElementById('rent-modal');
      const title = document.getElementById('rent-modal-title');
      const desc = document.getElementById('rent-modal-desc');
      const btn = document.getElementById('btn-rent-ok');

      if (this.state.gold >= rent) {
        this.state.gold -= rent;
        title.textContent = `第 ${this.state.day} 夜 · 缴清酒馆租金 ${rent}G`;
        desc.textContent = `城卫税官收走了 ${rent}G 地税，顺口夸赞你的午夜酒馆生意红火。剩余资金 ${this.state.gold}G！`;
        btn.textContent = '继续营业';
        btn.onclick = () => {
          sfx.playCoin();
          modal.classList.add('hidden');
          this.advanceNextNight();
        };
      } else {
        this.state.gold = 0;
        title.textContent = `资金断裂！无力支付 ${rent}G 租金`;
        desc.textContent = '税官贴上了封条，但你的暗夜经纪人生涯依然留下了不少江湖传说……';
        btn.textContent = '查看经纪人档案';
        btn.onclick = () => {
          modal.classList.add('hidden');
          this.openSummaryModal(true);
        };
      }
      modal.classList.remove('hidden');
      this.renderAll();
    }

    advanceNextNight() {
      if (!this.state.endless && this.state.day >= this.state.maxDays) {
        this.openSummaryModal(false);
        return;
      }
      this.setupNight(this.state.day + 1, false);
      this.renderAll();
    }

    openSummaryModal(bankrupt = false) {
      const modal = document.getElementById('summary-modal');
      const avgCut = this.state.cutHistory.length
        ? Math.round(this.state.cutHistory.reduce((a, b) => a + b, 0) / this.state.cutHistory.length)
        : 45;

      let rank = '午夜新秀老板';
      if (bankrupt) rank = '破产逃债经纪人';
      else if (this.state.gold >= 600 && this.state.rep >= 75) rank = '传奇紫金暗夜教父';
      else if (avgCut >= 62 && this.state.gold >= 400) rank = '黑市血汗资本大亨';
      else if (this.state.rep >= 85) rank = '江湖义气白月光';
      else if (this.state.wins >= 5) rank = '金牌佣兵撮合大师';

      document.getElementById('summary-rank').textContent = rank;
      document.getElementById('sum-gold').textContent = `${this.state.gold}G`;
      document.getElementById('sum-rep').textContent = `${this.state.rep}`;
      document.getElementById('sum-wins').textContent = `${this.state.wins} / ${this.state.totalContracts}`;
      document.getElementById('sum-greed').textContent = `${avgCut}%`;

      let mvpId = MERCENARY_POOL[0].id;
      let bestCount = -1;
      for (const [id, cnt] of Object.entries(this.state.mvpCounts)) {
        if (cnt > bestCount) { bestCount = cnt; mvpId = id; }
      }
      const mvp = MERCENARY_POOL.find((m) => m.id === mvpId) || MERCENARY_POOL[0];
      const mvpBox = document.getElementById('sum-mvp-sprite');
      mvpBox.innerHTML = '';
      mvpBox.appendChild(sprites.createDomSprite(mvp.unitId, 'selected', 66));
      document.getElementById('sum-mvp-name').textContent = `${mvp.title} · ${mvp.name}（出战 ${Math.max(1, bestCount)} 次）`;
      document.getElementById('sum-mvp-quote').textContent = avgCut >= 60
        ? '“老板的抽成比Boss的刀还狠，但我竟然还想再来喝一杯……”'
        : '“跟着老板干有酒喝有肉吃，这间午夜酒馆我罩定了！”';

      document.getElementById('btn-continue-endless').classList.toggle('hidden', bankrupt);
      modal.classList.remove('hidden');
    }

    buyUpgrade(upgId) {
      const upg = TAVERN_UPGRADES.find((u) => u.id === upgId);
      if (!upg || this.state.upgrades.includes(upgId)) return;
      if (this.state.gold < upg.cost) {
        sfx.playError();
        return;
      }
      this.state.gold -= upg.cost;
      this.state.upgrades.push(upgId);
      if (upgId === 'spy_net') this.state.unlockedIntelIds = this.state.contracts.map((c) => c.id);
      sfx.playCheer();
      this.tavern.shake(6, 0.22);
      this.save();
      this.renderUpgradesModal();
      this.renderAll();
    }

    renderAll() {
      this.tavern.setUpgrades(new Set(this.state.upgrades));
      this.tavern.syncMercenaries(this.state.visitors, new Set(this.state.squadIds.filter(Boolean)));

      document.getElementById('hud-day').textContent = this.state.endless
        ? `无尽 D${this.state.day}`
        : `D${this.state.day}/${this.state.maxDays}`;
      document.getElementById('hud-gold').textContent = `${this.state.gold}`;
      document.getElementById('hud-rep').textContent = `${this.state.rep}`;

      const daysToRent = 3 - ((this.state.day - 1) % 3);
      const nextRent = 120 + Math.floor((this.state.day - 1) / 3) * 60;
      const rentPill = document.getElementById('hud-rent-pill');
      document.getElementById('hud-rent-text').textContent = daysToRent === 1
        ? `今晚缴租 ${nextRent}G`
        : `${daysToRent}夜缴租 ${nextRent}G`;
      rentPill.classList.toggle('urgent', daysToRent === 1);
      // Quiet HUD: show headline only as a brief toast at night start

      this.renderDrinkTray();
      this.renderContractDesk();
      this.renderMercDossier();
    }

    renderDrinkTray() {
      this.syncTapFocusVisuals();
      const list = document.getElementById('drink-list');
      list.innerHTML = '';
      for (const d of DRINKS) {
        const cost = this.getDrinkCost(d);
        const el = document.createElement('div');
        el.className = `drink-card ${this.selectedDrinkId === d.id ? 'selected-drink' : ''}`;
        el.style.setProperty('--drink-col', d.color);
        el.dataset.drinkId = d.id;
        el.title = d.desc;
        el.innerHTML = `
          <span class="drink-cost">${cost}G</span>
          <div class="drink-glass"><i class="pxi pxi-${d.pxIcon}"></i></div>
          <div class="drink-info">
            <div class="drink-name">${d.name}</div>
            <div class="drink-tag">${d.shortTag}</div>
          </div>
        `;
        list.appendChild(el);
      }

      if (this.selectedDrinkId) {
        const d = DRINKS.find((x) => x.id === this.selectedDrinkId);
        if (d) this.showToast(`已端起【${d.name}】— 点击酒馆里任意佣兵递给他`, 2200);
      }
    }

    renderContractDesk() {
      const tabs = document.getElementById('contract-tabs');
      tabs.innerHTML = '';
      const roman = ['', 'I阶', 'II阶', 'III阶'];
      this.state.contracts.forEach((c, idx) => {
        const btn = document.createElement('button');
        btn.className = `contract-tab ${idx === this.state.activeContractIdx ? 'active' : ''}`;
        btn.textContent = `${roman[c.tier]}·${c.name.slice(0, 4)}`;
        btn.onclick = () => {
          if (this.state.dispatchedToday) return;
          this.state.activeContractIdx = idx;
          sfx.playPickup();
          this.renderContractDesk();
        };
        tabs.appendChild(btn);
      });

      const contract = this.getActiveContract();
      if (!contract) return;
      const m = this.computeSquadMetrics();

      const bossBox = document.getElementById('contract-boss-sprite');
      bossBox.innerHTML = '';
      const sil = sprites.createDomSprite(contract.bossUnitId, 'still', 78);
      sil.classList.add('boss-silhouette');
      bossBox.appendChild(sil);
      bossBox.appendChild(sprites.createDomSprite(contract.bossUnitId, 'idle', 78));

      const renderSegBar = (elId, ratio, colorClass, total = 8) => {
        const el = document.getElementById(elId);
        if (!el) return;
        const lit = Math.max(0, Math.min(total, Math.round(ratio * total)));
        el.innerHTML = Array.from({ length: total }, (_, i) =>
          `<span class="seg-cell ${i < lit ? colorClass : ''}"></span>`
        ).join('');
      };

      document.getElementById('contract-tier').textContent = `${roman[contract.tier]}`;
      document.getElementById('contract-boss-name').textContent = contract.bossName;
      document.getElementById('contract-title').textContent = contract.name;
      document.getElementById('contract-threat').textContent = `${m.effThreat}`;
      document.getElementById('contract-reward').textContent = `${contract.baseReward}G`;
      renderSegBar('contract-threat-bar', Math.min(1, m.effThreat / 200), 'on-red', 7);
      renderSegBar('contract-reward-bar', Math.min(1, contract.baseReward / 550), 'on-gold', 7);

      const intelEl = document.getElementById('intel-strip');
      if (m.intelUnlocked) {
        intelEl.className = 'intel-strip unlocked';
        intelEl.innerHTML = `<i class="pxi pxi-eye pxi-sm"></i><span>${contract.intelHint}</span>`;
      } else {
        intelEl.className = 'intel-strip locked';
        intelEl.innerHTML = '<i class="pxi pxi-lock pxi-sm"></i><span>弱点未知 — 给佣兵喝【迷雾苦艾】套真情报</span>';
      }

      document.getElementById('squad-fee').textContent = `${m.totalFee}G`;

      const slotEls = document.querySelectorAll('#squad-slots .squad-slot');
      slotEls.forEach((el, idx) => {
        const mid = this.state.squadIds[idx];
        el.innerHTML = '';
        if (mid) {
          const merc = this.getVisitor(mid);
          if (merc) {
            el.classList.add('filled');
            if (merc.drinkBuff) {
              const b = document.createElement('i');
              b.className = `pxi pxi-${merc.drinkBuff.pxIcon} pxi-sm slot-drink-badge`;
              el.appendChild(b);
            }
            const rm = document.createElement('button');
            rm.className = 'slot-remove';
            rm.textContent = 'X';
            rm.onclick = (e) => { e.stopPropagation(); this.removeMercFromSlot(idx); };
            el.appendChild(rm);
            el.appendChild(sprites.createDomSprite(merc.unitId, 'selected', 58));
            const nm = document.createElement('div');
            nm.className = 'slot-merc-name';
            nm.textContent = merc.name;
            el.appendChild(nm);
            const pw = document.createElement('div');
            pw.className = 'slot-merc-pwr';
            pw.textContent = `战${merc.effectivePower} · ${merc.effectiveFee}G`;
            el.appendChild(pw);
            return;
          }
        }
        el.classList.remove('filled');
        el.innerHTML = '<span class="slot-plus">+</span>';
        el.onclick = () => {
          if (this.inspectedMercId && !this.state.dispatchedToday) {
            this.assignMercToSlot(this.inspectedMercId, idx);
          }
        };
      });

      const synBar = document.getElementById('synergy-bar');
      synBar.innerHTML = '';
      if (m.activeSynergies.length === 0 && !m.weakMatched) {
        synBar.innerHTML = '<span class="synergy-empty">凑齐 2 名同词条佣兵激活羁绊</span>';
      } else {
        for (const s of m.activeSynergies) {
          const p = document.createElement('span');
          p.className = 'synergy-pill';
          p.style.setProperty('--syn-col', s.color);
          p.title = s.desc;
          p.textContent = `羁绊·${s.name}`;
          synBar.appendChild(p);
        }
        if (m.weakMatched) {
          const p = document.createElement('span');
          p.className = 'synergy-pill';
          p.style.setProperty('--syn-col', '#4de896');
          p.textContent = `克制·${contract.weakTag}`;
          synBar.appendChild(p);
        }
      }

      const wrText = document.getElementById('winrate-text');
      wrText.textContent = `${m.winRate}%`;
      const wrClass = m.winRate >= 72 ? 'on-green' : m.winRate >= 45 ? 'on-gold' : 'on-red';
      wrText.style.color = m.winRate >= 72 ? '#4de896' : m.winRate >= 45 ? '#f5c249' : '#ff4d6d';
      renderSegBar('winrate-bar', m.winRate / 100, wrClass, 12);

      const waxBtn = document.getElementById('wax-seal-btn');
      const canDispatch = m.squad.length > 0 && !this.state.dispatchedToday;
      waxBtn.classList.toggle('disabled', !canDispatch);
      document.getElementById('wax-btn-label').textContent = this.state.dispatchedToday ? '已出发' : '按住派单';
    }

    syncTapFocusVisuals() {
      this.tavern.selectedMercId = this.inspectedMercId;
      const peers = new Set();
      if (this.inspectedMercId) {
        const cur = this.getVisitor(this.inspectedMercId);
        if (cur) {
          for (const v of this.state.visitors) {
            if (v.id !== cur.id && v.tags.some((t) => cur.tags.includes(t))) {
              peers.add(v.id);
            }
          }
        }
      }
      this.tavern.synergyHighlightIds = peers;
      const selDrink = this.selectedDrinkId ? DRINKS.find((d) => d.id === this.selectedDrinkId) : null;
      this.tavern.drinkReadyColor = selDrink ? selDrink.color : null;
    }

    renderMercDossier() {
      this.syncTapFocusVisuals();
      const panel = document.getElementById('merc-dossier');
      if (!this.inspectedMercId) {
        panel.classList.add('hidden');
        return;
      }
      const merc = this.getVisitor(this.inspectedMercId);
      if (!merc) {
        panel.classList.add('hidden');
        return;
      }

      const portrait = document.getElementById('dossier-portrait');
      portrait.innerHTML = '';
      portrait.appendChild(sprites.createDomSprite(merc.unitId, 'selected', 66));

      document.getElementById('dossier-name').textContent = `${merc.name} · ${merc.title}`;
      document.getElementById('dossier-role').textContent = merc.role;
      document.getElementById('dossier-power').textContent = `${merc.effectivePower}`;
      document.getElementById('dossier-fee').textContent = `${merc.effectiveFee}G`;
      document.getElementById('dossier-loyalty').textContent = `${merc.loyalty}`;

      const pBar = document.getElementById('dossier-power-bar');
      if (pBar) {
        const lit = Math.max(1, Math.min(8, Math.round(merc.effectivePower / 8)));
        pBar.innerHTML = Array.from({ length: 8 }, (_, i) =>
          `<span class="seg-cell ${i < lit ? 'on-cyan' : ''}"></span>`
        ).join('');
      }

      const tagsEl = document.getElementById('dossier-tags');
      tagsEl.innerHTML = merc.tags.map((t) => `<span class="tag-chip">${t}</span>`).join('') +
        (merc.drinkBuff ? `<span class="tag-chip" style="color:${merc.drinkBuff.glow}">${merc.drinkBuff.name}</span>` : '');

      document.getElementById('dossier-quirk').innerHTML = `<b>【${merc.quirk.name}】</b>${merc.quirk.desc}`;

      const inSquad = this.state.squadIds.includes(merc.id);
      const assignBtn = document.getElementById('dossier-assign-btn');
      assignBtn.textContent = inSquad ? '已在出征小队中' : '拎入当前出征小队';
      assignBtn.disabled = inSquad;
      panel.classList.remove('hidden');
    }

    renderUpgradesModal() {
      const grid = document.getElementById('upgrade-grid');
      grid.innerHTML = '';
      for (const u of TAVERN_UPGRADES) {
        const owned = this.state.upgrades.includes(u.id);
        const item = document.createElement('div');
        item.className = `upg-item ${owned ? 'owned' : ''}`;
        item.innerHTML = `
          <div class="upg-top">
            <i class="pxi pxi-${u.pxIcon} pxi-lg"></i>
            <div>
              <h3>${u.name}</h3>
              <p>${u.desc}</p>
            </div>
          </div>
        `;
        const btn = document.createElement('button');
        btn.className = owned ? 'hd-btn full-btn' : 'hd-btn hd-btn-amber full-btn';
        btn.textContent = owned ? '已装潢生效' : `花费 ${u.cost}G 升级`;
        btn.disabled = owned || this.state.gold < u.cost;
        btn.onclick = () => this.buyUpgrade(u.id);
        item.appendChild(btn);
        grid.appendChild(item);
      }
    }

    bindPointerEngine() {
      const ghost = document.getElementById('drag-ghost');

      document.getElementById('drink-list').addEventListener('pointerdown', (e) => {
        const card = e.target.closest('.drink-card');
        if (!card || this.state.dispatchedToday) return;
        const drinkId = card.dataset.drinkId;
        const drink = DRINKS.find((d) => d.id === drinkId);
        if (!drink) return;
        e.preventDefault();
        sfx.playPickup();
        this.dragState = { type: 'drink', id: drinkId, drink, startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY, moved: false };
        ghost.innerHTML = `<div class="ghost-drink"><i class="pxi pxi-${drink.pxIcon} pxi-xl"></i></div>`;
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
      });

// Mobile-first: zero desktop hover listener; all focus & reticles respond to explicit tap/drag!

      this.canvasEl.addEventListener('pointerdown', (e) => {
        if (this.state.dispatchedToday) return;
        const pos = this.tavern.clientToStage(e.clientX, e.clientY);
        const hit = this.tavern.hitTestMerc(pos.x, pos.y);
        if (!hit) {
          if (this.inspectedMercId) {
            this.inspectedMercId = null;
            this.renderMercDossier();
          }
          return;
        }

        if (this.selectedDrinkId) {
          this.serveDrinkToMerc(this.selectedDrinkId, hit.merc.id);
          return;
        }

        e.preventDefault();
        sfx.playPickup();
        hit.lifted = true;
        this.dragState = { type: 'merc', id: hit.merc.id, merc: hit.merc, actor: hit, startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY, moved: false };
        ghost.innerHTML = '';
        ghost.appendChild(sprites.createDomSprite(hit.merc.unitId, 'selected', 82));
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
      });

      window.addEventListener('pointermove', (e) => {
        if (!this.dragState) return;
        const dx = e.clientX - this.dragState.startX;
        const dy = e.clientY - this.dragState.startY;
        if (!this.dragState.moved && Math.hypot(dx, dy) > 8) {
          this.dragState.moved = true;
          ghost.classList.remove('hidden');
        }
        if (!this.dragState.moved) return;

        const vx = Math.max(-22, Math.min(22, e.clientX - this.dragState.curX));
        this.dragState.curX = e.clientX;
        this.dragState.curY = e.clientY;
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
        ghost.style.transform = `translate(-50%, -50%) rotate(${vx * 0.9}deg)`;

        if (this.dragState.type === 'drink') {
          const pos = this.tavern.clientToStage(e.clientX, e.clientY);
          const hit = this.tavern.hitTestMerc(pos.x, pos.y);
          this.tavern.dragTargetMercId = hit ? hit.merc.id : null;
          this.tavern.dragDrinkColor = this.dragState.drink.color;
        } else if (this.dragState.type === 'merc') {
          document.querySelectorAll('#squad-slots .squad-slot').forEach((slot) => {
            const r = slot.getBoundingClientRect();
            slot.classList.toggle('drop-hover', e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
          });
        }
      });

      window.addEventListener('pointerup', (e) => {
        if (!this.dragState) return;
        const ds = this.dragState;
        this.dragState = null;
        ghost.classList.add('hidden');
        ghost.style.transform = 'translate(-50%, -50%)';
        this.tavern.dragTargetMercId = null;
        document.querySelectorAll('#squad-slots .squad-slot').forEach((s) => s.classList.remove('drop-hover'));

        if (ds.type === 'drink') {
          if (!ds.moved) {
            if (this.inspectedMercId) {
              this.serveDrinkToMerc(ds.id, this.inspectedMercId);
              return;
            }
            this.selectedDrinkId = this.selectedDrinkId === ds.id ? null : ds.id;
            this.renderDrinkTray();
            return;
          }
          const pos = this.tavern.clientToStage(e.clientX, e.clientY);
          const hit = this.tavern.hitTestMerc(pos.x, pos.y);
          if (hit) this.serveDrinkToMerc(ds.id, hit.merc.id);
          else sfx.playDrop();
        } else if (ds.type === 'merc') {
          if (ds.actor) ds.actor.lifted = false;
          if (!ds.moved) {
            const togglingOff = this.inspectedMercId === ds.id;
            this.inspectedMercId = togglingOff ? null : ds.id;
            if (!togglingOff) {
              this.tavern.triggerTapFeedback(ds.id, '#4de8e8');
              const m = this.getVisitor(ds.id);
              if (m && m.barks && m.barks.length) {
                this.tavern.say(ds.id, m.barks[Math.floor(Math.random() * m.barks.length)], 3.6);
              }
            }
            this.renderMercDossier();
            return;
          }
          let droppedSlot = null;
          document.querySelectorAll('#squad-slots .squad-slot').forEach((slot, idx) => {
            const r = slot.getBoundingClientRect();
            if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) droppedSlot = idx;
          });
          const deskRect = document.getElementById('parchment-body').getBoundingClientRect();
          const onDesk = e.clientX >= deskRect.left && e.clientX <= deskRect.right && e.clientY >= deskRect.top && e.clientY <= deskRect.bottom;
          if (droppedSlot !== null) this.assignMercToSlot(ds.id, droppedSlot);
          else if (onDesk) this.assignMercToSlot(ds.id, null);
          else sfx.playDrop();
        }
      });

      // Hold-to-Stamp Crimson Wax Seal (0.35s)
      const waxBtn = document.getElementById('wax-seal-btn');
      const ring = document.getElementById('seal-progress');
      const PERIM = 304;
      let charging = false;
      let rafCharge = null;

      const cancelCharge = () => {
        charging = false;
        waxBtn.classList.remove('charging');
        ring.style.strokeDashoffset = `${PERIM}`;
        if (rafCharge) cancelAnimationFrame(rafCharge);
      };

      waxBtn.addEventListener('pointerdown', (e) => {
        if (waxBtn.classList.contains('disabled')) return;
        e.preventDefault();
        charging = true;
        waxBtn.classList.add('charging');
        this.sealChargeStart = performance.now();
        sfx.playStampCharge();

        const step = (now) => {
          if (!charging) return;
          const pct = Math.min(1, (now - this.sealChargeStart) / 250);
          ring.style.strokeDashoffset = `${PERIM * (1 - pct)}`;
          if (pct >= 1) {
            cancelCharge();
            this.dispatchSquad();
          } else {
            rafCharge = requestAnimationFrame(step);
          }
        };
        rafCharge = requestAnimationFrame(step);
      });
      window.addEventListener('pointerup', cancelCharge);
      waxBtn.addEventListener('pointerleave', cancelCharge);
    }

    bindUIEvents() {
      document.getElementById('dossier-close').onclick = () => {
        this.inspectedMercId = null;
        this.renderMercDossier();
      };
      document.getElementById('dossier-assign-btn').onclick = () => {
        if (this.inspectedMercId) this.assignMercToSlot(this.inspectedMercId, null);
      };
      document.getElementById('btn-upgrades').onclick = () => {
        sfx.playPickup();
        this.renderUpgradesModal();
        document.getElementById('upgrade-modal').classList.remove('hidden');
      };
      document.getElementById('upgrade-close').onclick = () => {
        document.getElementById('upgrade-modal').classList.add('hidden');
      };
      document.getElementById('btn-mute').onclick = (e) => {
        const muted = sfx.toggleMute();
        e.currentTarget.textContent = muted ? '声:关' : '声:开';
      };
      document.getElementById('btn-reset').onclick = () => {
        if (confirm('确定要清空当前进度，重新开启第 1 夜吗？')) {
          localStorage.removeItem(SAVE_KEY);
          document.getElementById('upgrade-modal').classList.add('hidden');
          this.setupNight(1, true);
          this.renderAll();
        }
      };
      document.getElementById('btn-bt-speed').onclick = (e) => {
        const next = this.theater.speed === 1 ? 2 : 1;
        this.theater.setSpeed(next);
        e.currentTarget.textContent = next === 2 ? '当前 2x' : '加速 2x';
      };
      document.getElementById('btn-bt-skip').onclick = () => {
        this.theater.stop();
        document.getElementById('theater-modal').classList.add('hidden');
        this.openSettlement();
      };
      document.getElementById('loot-sack-btn').onclick = () => this.burstLootSack();
      document.getElementById('cut-slider').addEventListener('input', (e) => {
        const v = Number(e.target.value);
        sfx.playSliderTick((v - 20) / 60);
        this.updateCutPreview(v);
      });
      document.getElementById('btn-confirm-settle').onclick = () => this.confirmSettlement();
      document.getElementById('btn-continue-endless').onclick = () => {
        this.state.endless = true;
        document.getElementById('summary-modal').classList.add('hidden');
        this.setupNight(this.state.day + 1, false);
        this.renderAll();
      };
      document.getElementById('btn-new-run').onclick = () => {
        localStorage.removeItem(SAVE_KEY);
        document.getElementById('summary-modal').classList.add('hidden');
        this.setupNight(1, true);
        this.renderAll();
      };
    }

    bindStageResize() {
      const resize = () => {
        const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
        this.stageEl.style.transform = `scale(${scale})`;
      };
      window.addEventListener('resize', resize);
      resize();
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const game = new MidnightTavernGame();
    game.init();
  });
})();
