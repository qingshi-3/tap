// v9.0 《午夜酒馆：秘宝引擎流》Ultra-Converged 2-Screen Balatro Loop Controller
// Indoor Tavern = Shop (Buy/Merge Heroes, Buy/Reorder 5-Slot Relic Chain, Buy Drinks, Reroll/Lock, Earn Interest)
// Outdoor Mirror-Lake Eclipse = Live Relic-Chain Battle (1-tap Drinks, 6-Turn Boss Blind, Ascending Chimes & Duelyst VFX)
(function () {
  const { sfx, sprites, TavernCanvas, EngineBattle, STAGE_W, STAGE_H, ENGINE_DATA } = window.MT;
  const { ELEMENTS, HEROES, RELICS, TACTICAL_DRINKS, WAVES, getHeroStats } = ENGINE_DATA;

  const SAVE_KEY = 'midnight_tavern_v9_engine';

  class RelicTavernGame {
    constructor() {
      this.stageEl = document.getElementById('stage');
      this.tavern = new TavernCanvas(document.getElementById('tavern-canvas'));
      this.battle = new EngineBattle(document.getElementById('battle-canvas'));

      this.state = null;
      this.selectedRelicSlot = -1; // tap-to-swap left/right relic ordering!
      this.inspectedHeroUid = null;

      this.bindResize();
      this.bindEvents();
    }

    async init() {
      await Promise.all([
        sprites.load(),
        window.MT.vfx ? window.MT.vfx.load() : Promise.resolve(),
        window.MT.uiIcons && window.MT.uiIcons.load ? window.MT.uiIcons.load() : Promise.resolve()
      ]);
      this.tavern.setTavernLevel(2); // Rich guild hearth hall
      this.tavern.start();

      if (!this.loadSave()) {
        this.startNewRun();
      } else {
        this.renderAll();
      }
    }

    createFreshState() {
      return {
        version: 9,
        started: false,
        wave: 1,
        hearts: 3,
        maxHearts: 3,
        gold: 12,
        rerollCost: 3,
        rerollsTotal: 0,
        shopLocked: false,
        waveAdvancePaid: {}, // GPT Fix #2: track per-wave 50% consolation advance so defeat cannot farm extra gold!
        nextUid: 1,
        squad: [],           // [{ uid, id, stars }] (max 3)
        relics: [],          // [{ uid, id }] (max 5, evaluated left -> right!)
        drinks: [],          // ['flame_shot', ...] (max 2)
        shop: { relics: [], heroes: [], drink: null },
        stats: { peakHit: 0, totalTriggers: 0, wins: 0, rerollsAfterFastWin: 0 },
        lastFastWinWave: 0,
        finished: null       // null | 'win' | 'lose'
      };
    }

    startNewRun() {
      this.state = this.createFreshState();
      this.selectedRelicSlot = -1;
      this.inspectedHeroUid = null;
      this.save();
      this.openStarterModal();
      this.renderAll();
    }

    save() {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch {}
    }

    loadSave() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 9 && parsed.started && !parsed.finished && Array.isArray(parsed.squad) && parsed.squad.length > 0) {
          this.state = parsed;
          return true;
        }
      } catch {}
      return false;
    }

    showToast(msg, ms = 2200) {
      const el = document.getElementById('event-toast');
      if (!el) return;
      el.textContent = msg;
      el.classList.remove('hidden');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
    }

    // ─── Starter 3-Pick Captain ───
    openStarterModal() {
      const modal = document.getElementById('starter-modal');
      const grid = document.getElementById('starter-grid');
      const starters = HEROES.filter((h) => h.starter);
      grid.innerHTML = '';

      for (const h of starters) {
        const elInfo = ELEMENTS[h.element] || ELEMENTS.fire;
        const card = document.createElement('button');
        card.className = 'starter-card';
        card.style.setProperty('--elcol', elInfo.color);
        card.innerHTML = `
          <div class="starter-sprite" data-unit="${h.unitId}"></div>
          <div class="starter-name"><strong>${h.name}</strong><span class="starter-el">${elInfo.name} · ${h.tag}</span></div>
          <div class="starter-stats">攻 ${h.baseAtk} · 血 ${h.baseHp} · 暴 ${h.crit}%</div>
          <p class="starter-desc">${h.desc}</p>
          <span class="starter-pick-btn">选他开局（+12G）</span>
        `;
        const spBox = card.querySelector('.starter-sprite');
        const sp = sprites.createDomSprite(h.unitId, 'idle', 88);
        if (sp) spBox.appendChild(sp);
        card.onclick = () => {
          this.state.started = true;
          this.state.squad = [{ uid: `h_${this.state.nextUid++}`, id: h.id, stars: 1 }];
          // Gift 1 thematic starter drink so player immediately feels battle interaction on W1!
          this.state.drinks = [h.id === 'iron_anvil' ? 'holy_ale' : h.id === 'seven_boom' ? 'flame_shot' : 'fury_absinthe'];
          this.rollShop(true);
          modal.classList.add('hidden');
          sfx.playSynergy();
          this.save();
          this.renderAll();
        };
        grid.appendChild(card);
      }
      modal.classList.remove('hidden');
    }

    // ─── Shop Rolling (3 Relics + 2 Heroes + 1 Tactical Drink) ───
    rollShop(isNewWave = false) {
      if (isNewWave && this.state.shopLocked) {
        this.state.shopLocked = false;
        this.state.rerollCost = 3;
        return;
      }
      if (isNewWave) this.state.rerollCost = 3;

      const ownedRelicIds = new Set(this.state.relics.map((r) => r.id));
      const availRelics = RELICS.filter((r) => !ownedRelicIds.has(r.id));
      const pickedRelics = this.sampleDistinct(availRelics, 3).map((r) => ({ id: r.id, sold: false }));

      // Slightly bias 1 hero slot toward mergeable owned heroes (~40%) for juicy 2-in-1 star-ups!
      const heroOffer = [];
      const ownedMergeable = this.state.squad.filter((m) => m.stars < 3).map((m) => HEROES.find((h) => h.id === m.id)).filter(Boolean);
      if (ownedMergeable.length > 0 && Math.random() < 0.45) {
        const mh = ownedMergeable[Math.floor(Math.random() * ownedMergeable.length)];
        heroOffer.push({ id: mh.id, sold: false });
      }
      const restHeroes = this.sampleDistinct(HEROES.filter((h) => !heroOffer.some((x) => x.id === h.id)), 2 - heroOffer.length);
      for (const h of restHeroes) heroOffer.push({ id: h.id, sold: false });

      const drinkTpl = TACTICAL_DRINKS[Math.floor(Math.random() * TACTICAL_DRINKS.length)];
      this.state.shop = {
        relics: pickedRelics,
        heroes: heroOffer,
        drink: { id: drinkTpl.id, sold: false }
      };
    }

    sampleDistinct(arr, n) {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, Math.min(n, copy.length));
    }

    // ─── Shop Actions (All 1-Tap Converged!) ───
    buyRelic(idx) {
      const slot = this.state.shop.relics[idx];
      if (!slot || slot.sold) return;
      const tpl = RELICS.find((r) => r.id === slot.id);
      if (!tpl) return;
      if (this.state.relics.length >= 5) {
        sfx.playError();
        this.showToast('秘宝槽已满（5/5）！先点上方秘宝卖掉 1 件腾位', 2200);
        return;
      }
      if (this.state.gold < tpl.cost) {
        sfx.playError();
        this.showToast(`金币不足（需要 ${tpl.cost}G）`, 1600);
        return;
      }
      this.state.gold -= tpl.cost;
      slot.sold = true;
      this.state.relics.push({ uid: `r_${this.state.nextUid++}`, id: tpl.id });
      sfx.playSlotSnap();
      this.showToast(`装备秘宝【${tpl.name}】！可点上方槽位调换左右结算顺序`, 2200);
      this.save();
      this.renderAll();
    }

    buyHero(idx) {
      const slot = this.state.shop.heroes[idx];
      if (!slot || slot.sold) return;
      const tpl = HEROES.find((h) => h.id === slot.id);
      if (!tpl) return;
      if (this.state.gold < tpl.cost) {
        sfx.playError();
        this.showToast(`金币不足（需要 ${tpl.cost}G）`, 1600);
        return;
      }

      // Check 2-in-1 Star Up merge first!
      const existing = this.state.squad.find((m) => m.id === tpl.id && m.stars < 3);
      if (existing) {
        this.state.gold -= tpl.cost;
        slot.sold = true;
        existing.stars++;
        sfx.playSynergy();
        const actor = this.tavern.getMercActor(existing.uid);
        if (actor) {
          this.tavern.playVfx('fxBuffSimpleGold', actor.x, actor.y - 54, { scale: 2.0 });
          this.tavern.spawnFloater(actor.x, actor.y - 108, `${tpl.name} 升至 ${'★'.repeat(existing.stars)}!!`, '#ffe07d');
        }
        this.showToast(`合成升星！【${tpl.name}】晋升 ${'★'.repeat(existing.stars)}（攻血暴涨！）`, 2400);
        this.save();
        this.renderAll();
        return;
      }

      if (this.state.squad.length >= 3) {
        sfx.playError();
        this.showToast('出战席已满（3/3）！先点大厅里某位佣兵卖掉换人', 2200);
        return;
      }

      this.state.gold -= tpl.cost;
      slot.sold = true;
      const newUnit = { uid: `h_${this.state.nextUid++}`, id: tpl.id, stars: 1 };
      this.state.squad.push(newUnit);
      sfx.playSlotSnap();
      this.showToast(`雇佣【${tpl.name}】加入常驻小队！`, 2000);
      this.save();
      this.renderAll();
    }

    buyDrink() {
      const slot = this.state.shop.drink;
      if (!slot || slot.sold) return;
      const tpl = TACTICAL_DRINKS.find((d) => d.id === slot.id);
      if (!tpl) return;
      if (this.state.drinks.length >= 2) {
        sfx.playError();
        this.showToast('战中特调槽已满（最多携带 2 瓶）', 1800);
        return;
      }
      if (this.state.gold < tpl.cost) {
        sfx.playError();
        this.showToast(`金币不足（需要 ${tpl.cost}G）`, 1600);
        return;
      }
      this.state.gold -= tpl.cost;
      slot.sold = true;
      this.state.drinks.push(tpl.id);
      sfx.playDrinkServe();
      this.showToast(`装瓶【${tpl.name}】！战斗中点击或拖拽泼出`, 2000);
      this.save();
      this.renderAll();
    }

    rerollShop() {
      if (this.state.gold < this.state.rerollCost) {
        sfx.playError();
        this.showToast(`刷新需要 ${this.state.rerollCost}G`, 1500);
        return;
      }
      this.state.gold -= this.state.rerollCost;
      this.state.rerollCost++;
      this.state.rerollsTotal++;
      if (this.state.lastFastWinWave === this.state.wave - 1) {
        this.state.stats.rerollsAfterFastWin++;
      }
      this.state.shopLocked = false;
      this.rollShop(false);
      sfx.playDrop();
      this.save();
      this.renderAll();
    }

    // Click slot A then slot B -> Swap Left/Right order (GPT Fix #1 makes ordering truly matter!)
    clickRelicSlot(idx) {
      if (idx >= this.state.relics.length) {
        this.selectedRelicSlot = -1;
        this.renderRelicRack();
        return;
      }
      if (this.selectedRelicSlot === -1) {
        this.selectedRelicSlot = idx;
        sfx.playPickup();
      } else if (this.selectedRelicSlot === idx) {
        this.selectedRelicSlot = -1;
      } else {
        const arr = this.state.relics;
        [arr[this.selectedRelicSlot], arr[idx]] = [arr[idx], arr[this.selectedRelicSlot]];
        this.selectedRelicSlot = -1;
        sfx.playSlotSnap();
        this.showToast('秘宝结算顺序已调换（左 → 右依次结算）', 1600);
        this.save();
      }
      this.renderRelicRack();
    }

    sellRelic(idx) {
      const item = this.state.relics[idx];
      if (!item) return;
      const tpl = RELICS.find((r) => r.id === item.id);
      const refund = tpl ? Math.max(2, Math.floor(tpl.cost * 0.5)) : 3;
      this.state.relics.splice(idx, 1);
      this.state.gold += refund;
      this.selectedRelicSlot = -1;
      sfx.playCoin();
      this.showToast(`卖出【${tpl ? tpl.name : '秘宝'}】回收 +${refund}G`, 1800);
      this.save();
      this.renderAll();
    }

    sellHero(uid) {
      if (this.state.squad.length <= 1) {
        sfx.playError();
        this.showToast('至少保留 1 名佣兵出战！', 1800);
        return;
      }
      const idx = this.state.squad.findIndex((m) => m.uid === uid);
      if (idx === -1) return;
      const m = this.state.squad[idx];
      const tpl = HEROES.find((h) => h.id === m.id);
      const refund = Math.max(2, Math.floor((tpl ? tpl.cost : 4) * m.stars * 0.5));
      this.state.squad.splice(idx, 1);
      this.state.gold += refund;
      this.inspectedHeroUid = null;
      sfx.playCoin();
      this.showToast(`遣散【${tpl ? tpl.name : '佣兵'}】回收 +${refund}G`, 1800);
      this.save();
      this.renderAll();
    }

    // ─── Launch Outdoor Mirror-Lake Eclipse Battle ───
    launchWaveBattle() {
      const waveCfg = WAVES[this.state.wave - 1];
      if (!waveCfg || this.state.squad.length === 0) return;
      this.selectedRelicSlot = -1;
      this.inspectedHeroUid = null;
      sfx.playWaxSlam();

      const fullRelics = this.state.relics
        .map((r) => RELICS.find((x) => x.id === r.id))
        .filter(Boolean);

      const modal = document.getElementById('theater-modal');
      modal.classList.remove('hidden');

      this.battle.play({
        squad: this.state.squad,
        relics: fullRelics,
        drinks: this.state.drinks,
        waveCfg,
        runCtx: { gold: this.state.gold, rerollsTotal: this.state.rerollsTotal },
        onDone: (res) => {
          modal.classList.add('hidden');
          this.handleBattleEnd(waveCfg, res);
        }
      });
    }

    // ─── Wave Payout (Strictly Implementing GPT Fix #2 Advance Payout!) ───
    handleBattleEnd(waveCfg, res) {
      this.state.drinks = res.remainingDrinks || [];
      if (res.peakHit > this.state.stats.peakHit) this.state.stats.peakHit = res.peakHit;
      this.state.stats.totalTriggers += res.totalTriggers || 0;

      const interest = Math.min(10, Math.floor(this.state.gold / 10) * 2);
      const alreadyAdvanced = this.state.waveAdvancePaid[waveCfg.wave] || 0;

      if (res.victory) {
        this.state.stats.wins++;
        const baseRemaining = Math.max(0, waveCfg.reward - alreadyAdvanced);
        const speedBonus = res.turnsUsed <= 3 ? 3 : 0;
        const combatGold = res.combatGold || 0;
        const totalGain = baseRemaining + interest + speedBonus + combatGold;
        this.state.gold += totalGain;
        if (speedBonus > 0) this.state.lastFastWinWave = waveCfg.wave;

        if (this.state.wave >= WAVES.length) {
          this.state.finished = 'win';
          this.save();
          this.openEndModal(true, res);
          return;
        }

        this.openPayoutModal({
          victory: true, waveCfg, res,
          rows: [
            { k: alreadyAdvanced > 0 ? `本波尾款（已预支 ${alreadyAdvanced}G）` : '盲注赏金', v: `+${baseRemaining}G` },
            { k: `存钱利息（每10G +2G）`, v: `+${interest}G` },
            ...(speedBonus > 0 ? [{ k: `3回合速通奖（${res.turnsUsed}回合）`, v: `+${speedBonus}G` }] : []),
            ...(combatGold > 0 ? [{ k: '战中印钞杯掉金', v: `+${combatGold}G` }] : [])
          ],
          totalGain
        });
      } else {
        this.state.hearts = Math.max(0, this.state.hearts - 1);
        if (this.state.hearts <= 0) {
          this.state.finished = 'lose';
          this.save();
          this.openEndModal(false, res);
          return;
        }
        // GPT Fix #2: Advance 50% of this wave's bounty ONCE (deducted when winning this wave later!)
        let advance = 0;
        if (!alreadyAdvanced) {
          advance = Math.floor(waveCfg.reward * 0.5);
          this.state.waveAdvancePaid[waveCfg.wave] = advance;
        }
        const combatGold = res.combatGold || 0;
        const totalGain = advance + interest + combatGold;
        this.state.gold += totalGain;

        this.openPayoutModal({
          victory: false, waveCfg, res,
          rows: [
            { k: advance > 0 ? '本波赏金预支（胜后补齐）' : '本波已预支过赏金', v: `+${advance}G` },
            { k: '存钱利息', v: `+${interest}G` },
            ...(combatGold > 0 ? [{ k: '战中掉金', v: `+${combatGold}G` }] : [])
          ],
          totalGain
        });
      }
      this.save();
    }

    openPayoutModal({ victory, waveCfg, res, rows, totalGain }) {
      const modal = document.getElementById('payout-modal');
      document.getElementById('payout-stamp').textContent = victory ? `W${waveCfg.wave} 盲注击破！` : `挑战受挫 (-1❤)`;
      document.getElementById('payout-stamp').className = `payout-stamp ${victory ? 'win' : 'lose'}`;
      document.getElementById('payout-sub').textContent = victory
        ? `最高一击 ${res.peakHit.toLocaleString()} · 秘宝连锁 ${res.totalTriggers} 次`
        : `剩余红心 ${'❤'.repeat(this.state.hearts)} · 回酒馆调整秘宝顺序或补强后再战 W${waveCfg.wave}！`;
      document.getElementById('payout-rows').innerHTML = rows.map((r) =>
        `<div class="pay-row"><span>${r.k}</span><strong>${r.v}</strong></div>`
      ).join('') + `<div class="pay-row total"><span>本波总入账</span><strong>+${totalGain}G</strong></div>`;

      const btn = document.getElementById('btn-payout-next');
      btn.textContent = victory ? `回酒馆逛店 → 备战 W${waveCfg.wave + 1}` : `回酒馆补强 → 再战 W${waveCfg.wave}`;
      btn.onclick = () => {
        modal.classList.add('hidden');
        if (victory) this.state.wave++;
        this.rollShop(true);
        sfx.playCoin();
        this.save();
        this.renderAll();
      };
      modal.classList.remove('hidden');
    }

    openEndModal(win, lastRes) {
      const modal = document.getElementById('end-modal');
      document.getElementById('end-title').textContent = win ? '★ 通关！午夜日蚀征服者 ★' : '酒馆熄灯 · 止步 W' + this.state.wave;
      document.getElementById('end-sub').textContent = win
        ? '你的 5 格秘宝引擎彻底打穿了 8 波盲注！'
        : '调整秘宝流派与左右乘算顺序，下一局炸穿它！';
      document.getElementById('end-stats').innerHTML = `
        <div class="end-stat"><span>单次最高伤害</span><strong>${this.state.stats.peakHit.toLocaleString()}</strong></div>
        <div class="end-stat"><span>秘宝总连锁</span><strong>${this.state.stats.totalTriggers} 次</strong></div>
        <div class="end-stat"><span>击破波次</span><strong>${this.state.stats.wins} / 8</strong></div>
        <div class="end-stat"><span>结余金币</span><strong>${this.state.gold}G</strong></div>
      `;
      modal.classList.remove('hidden');
    }

    // ─── Rendering All Indoor Tavern Shop UI ───
    renderAll() {
      if (!this.state) return;
      this.renderTopHud();
      this.renderRelicRack();
      this.renderShopDock();
      this.renderHeroInspect();
      this.syncTavernCanvas();
    }

    renderTopHud() {
      const wCfg = WAVES[this.state.wave - 1] || WAVES[0];
      const interest = Math.min(10, Math.floor(this.state.gold / 10) * 2);
      document.getElementById('hud-wave').textContent = `W${wCfg.wave}/8`;
      document.getElementById('hud-hearts').textContent = '❤'.repeat(this.state.hearts) + '♡'.repeat(Math.max(0, this.state.maxHearts - this.state.hearts));
      document.getElementById('hud-gold').textContent = `${this.state.gold}G`;
      document.getElementById('hud-interest').textContent = `+息${interest}G`;
      document.getElementById('hud-next-boss').textContent = `下波: ${wCfg.bossName} ${wCfg.hp.toLocaleString()}血 · ${wCfg.affixName}`;
      document.getElementById('hud-next-boss').title = wCfg.affixDesc;
    }

    renderRelicRack() {
      const rack = document.getElementById('shop-relic-bar');
      if (!rack) return;
      let html = '';
      for (let i = 0; i < 5; i++) {
        const item = this.state.relics[i];
        if (!item) {
          html += `<button class="rack-slot empty" data-ridx="${i}"><span>秘宝 ${i + 1}</span></button>`;
          continue;
        }
        const tpl = RELICS.find((r) => r.id === item.id);
        const sel = this.selectedRelicSlot === i ? 'selected' : '';
        const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(tpl.icon) : null;
        const badgeTxt = tpl.id === 'r_ledger' ? `+${Math.max(14, this.state.rerollsTotal * 14)}` : tpl.badge;
        const sellVal = Math.max(2, Math.floor(tpl.cost * 0.5));
        html += `
          <div class="rack-slot filled kind-${tpl.kind} ${sel}" data-ridx="${i}" style="--rcol:${tpl.color}" title="${tpl.name}：${tpl.desc}">
            ${iconUrl ? `<img src="${iconUrl}" alt="${tpl.name}" />` : ''}
            <div class="rack-info">
              <strong>${tpl.name}</strong>
              <span class="rack-badge">${badgeTxt}</span>
            </div>
            <button class="rack-sell" data-sell="${i}" title="卖出 +${sellVal}G">卖${sellVal}</button>
          </div>`;
      }
      rack.innerHTML = html;

      rack.querySelectorAll('.rack-slot').forEach((el) => {
        el.onclick = (e) => {
          if (e.target.closest('.rack-sell')) return;
          this.clickRelicSlot(Number(el.dataset.ridx));
        };
      });
      rack.querySelectorAll('.rack-sell').forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          this.sellRelic(Number(btn.dataset.sell));
        };
      });
    }

    renderShopDock() {
      const shelf = document.getElementById('shop-shelf');
      if (!shelf) return;
      shelf.innerHTML = '';

      // 1. 3 Relic Cards
      this.state.shop.relics.forEach((slot, idx) => {
        const tpl = RELICS.find((r) => r.id === slot.id);
        if (!tpl) return;
        const btn = document.createElement('button');
        btn.className = `shop-card relic-card kind-${tpl.kind} ${slot.sold ? 'sold' : ''}`;
        btn.style.setProperty('--ccol', tpl.color);
        btn.title = `${tpl.name}：${tpl.desc}`;
        const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(tpl.icon) : null;
        btn.innerHTML = `
          <span class="sc-kind">${tpl.kind === 'mult' ? '×乘算' : tpl.kind === 'fx' ? '⚡特效' : '+加成'}</span>
          <div class="sc-ico-wrap">${iconUrl ? `<img src="${iconUrl}" alt="${tpl.name}" />` : ''}</div>
          <strong class="sc-name">${tpl.name}</strong>
          <small class="sc-short">${tpl.short}</small>
          <span class="sc-price">${slot.sold ? '已买' : `${tpl.cost}G`}</span>
        `;
        btn.onclick = () => this.buyRelic(idx);
        shelf.appendChild(btn);
      });

      const d1 = document.createElement('i'); d1.className = 'shop-div'; shelf.appendChild(d1);

      // 2. 2 Mercenary Cards (shows golden 2合1 升星! tag when matching owned hero!)
      this.state.shop.heroes.forEach((slot, idx) => {
        const tpl = HEROES.find((h) => h.id === slot.id);
        if (!tpl) return;
        const canMerge = this.state.squad.some((m) => m.id === tpl.id && m.stars < 3);
        const elInfo = ELEMENTS[tpl.element] || ELEMENTS.fire;
        const btn = document.createElement('button');
        btn.className = `shop-card hero-card ${canMerge ? 'mergeable' : ''} ${slot.sold ? 'sold' : ''}`;
        btn.style.setProperty('--ccol', canMerge ? '#ffe07d' : elInfo.color);
        btn.title = `${tpl.name}（${tpl.tag}）：${tpl.desc}`;
        btn.innerHTML = `
          <span class="sc-kind">${canMerge ? '★升星!' : `${elInfo.name}·佣兵`}</span>
          <div class="sc-sprite-wrap"></div>
          <strong class="sc-name">${tpl.name}</strong>
          <small class="sc-short">${tpl.tag}</small>
          <span class="sc-price">${slot.sold ? '已雇' : `${tpl.cost}G`}</span>
        `;
        const sp = sprites.createDomSprite(tpl.unitId, 'idle', 42);
        if (sp) btn.querySelector('.sc-sprite-wrap').appendChild(sp);
        btn.onclick = () => this.buyHero(idx);
        shelf.appendChild(btn);
      });

      const d2 = document.createElement('i'); d2.className = 'shop-div'; shelf.appendChild(d2);

      // 3. 1 Tactical Drink Card (Tarot Consumable!)
      const dSlot = this.state.shop.drink;
      if (dSlot) {
        const tpl = TACTICAL_DRINKS.find((d) => d.id === dSlot.id);
        if (tpl) {
          const btn = document.createElement('button');
          btn.className = `shop-card drink-card ${dSlot.sold ? 'sold' : ''}`;
          btn.style.setProperty('--ccol', tpl.color);
          btn.title = `${tpl.name}：${tpl.desc}`;
          const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(tpl.duelystIcon) : null;
          btn.innerHTML = `
            <span class="sc-kind">战中酒 (${this.state.drinks.length}/2)</span>
            <div class="sc-ico-wrap">${iconUrl ? `<img src="${iconUrl}" alt="${tpl.name}" />` : ''}</div>
            <strong class="sc-name">${tpl.name}</strong>
            <small class="sc-short">${tpl.short}</small>
            <span class="sc-price">${dSlot.sold ? '已装' : `${tpl.cost}G`}</span>
          `;
          btn.onclick = () => this.buyDrink();
          shelf.appendChild(btn);
        }
      }

      // Update left & right wing labels
      document.getElementById('btn-reroll-cost').textContent = `${this.state.rerollCost}G`;
      const lockBtn = document.getElementById('btn-lock-shop');
      lockBtn.classList.toggle('locked', this.state.shopLocked);
      lockBtn.textContent = this.state.shopLocked ? '已锁' : '锁定';

      const wCfg = WAVES[this.state.wave - 1] || WAVES[0];
      document.getElementById('btn-fight-wave').textContent = `迎战 W${wCfg.wave}`;
      document.getElementById('btn-fight-hp').textContent = `${wCfg.hp.toLocaleString()}血`;
    }

    renderHeroInspect() {
      const box = document.getElementById('hero-quick-pop');
      if (!box) return;
      if (!this.inspectedHeroUid) {
        box.classList.add('hidden');
        return;
      }
      const m = this.state.squad.find((x) => x.uid === this.inspectedHeroUid);
      if (!m) { box.classList.add('hidden'); return; }
      const tpl = HEROES.find((h) => h.id === m.id);
      const st = getHeroStats(tpl, m.stars);
      const sellVal = Math.max(2, Math.floor(tpl.cost * m.stars * 0.5));
      box.innerHTML = `
        <div class="hq-head"><strong>${'★'.repeat(m.stars)} ${tpl.name}</strong><button class="hq-x" id="hq-close">×</button></div>
        <div class="hq-stats">攻 ${st.atk} · 血 ${st.maxHp} · 暴 ${st.crit}% · 速 ${st.speed}</div>
        <div class="hq-desc">${tpl.desc}</div>
        <button class="hq-sell" id="hq-sell-btn" ${this.state.squad.length <= 1 ? 'disabled' : ''}>遣散回收 +${sellVal}G</button>
      `;
      box.classList.remove('hidden');
      document.getElementById('hq-close').onclick = () => { this.inspectedHeroUid = null; this.renderHeroInspect(); };
      document.getElementById('hq-sell-btn').onclick = () => this.sellHero(m.uid);
    }

    syncTavernCanvas() {
      // Convert persistent squad to TavernCanvas actor format (shows stars & effective ATK on steel nameplates!)
      const mercs = this.state.squad.map((m) => {
        const tpl = HEROES.find((h) => h.id === m.id) || HEROES[0];
        const st = getHeroStats(tpl, m.stars);
        return {
          id: m.uid,
          unitId: tpl.unitId,
          name: `${'★'.repeat(m.stars)}${tpl.name}`,
          tier: m.stars === 3 ? 'SSS' : m.stars === 2 ? 'A+' : 'C',
          power: st.atk,
          effectivePower: st.atk,
          isSigned: false,
          barks: [tpl.tag + '，随时开战！', '多叠几个乘法秘宝在最右边！']
        };
      });
      this.tavern.syncMercenaries(mercs, new Set(mercs.map((x) => x.id)));
      this.tavern.selectedMercId = this.inspectedHeroUid;
    }

    bindEvents() {
      document.getElementById('btn-reroll-shop').onclick = () => this.rerollShop();
      document.getElementById('btn-lock-shop').onclick = () => {
        this.state.shopLocked = !this.state.shopLocked;
        sfx.playDrop();
        this.save();
        this.renderShopDock();
      };
      document.getElementById('btn-fight-go').onclick = () => this.launchWaveBattle();
      document.getElementById('btn-mute').onclick = (e) => {
        const muted = sfx.toggleMute();
        e.currentTarget.textContent = muted ? '声:关' : '声:开';
      };
      document.getElementById('btn-restart').onclick = () => {
        try { localStorage.removeItem(SAVE_KEY); } catch {}
        this.startNewRun();
      };
      document.getElementById('btn-end-again').onclick = () => {
        document.getElementById('end-modal').classList.add('hidden');
        try { localStorage.removeItem(SAVE_KEY); } catch {}
        this.startNewRun();
      };
      document.getElementById('btn-bt-speed-1').onclick = () => this.battle.setSpeed(1);
      document.getElementById('btn-bt-speed-2').onclick = () => this.battle.setSpeed(2);

      // Tap mercenaries in Indoor Tavern Hall to inspect/sell!
      document.getElementById('tavern-canvas').addEventListener('pointerdown', (e) => {
        const pt = this.tavern.clientToStage(e.clientX, e.clientY);
        const actor = this.tavern.hitTestMerc(pt.x, pt.y);
        if (actor) {
          this.inspectedHeroUid = this.inspectedHeroUid === actor.merc.id ? null : actor.merc.id;
          this.tavern.triggerTapFeedback(actor.merc.id, '#ffe07d');
          sfx.playPickup();
          this.renderHeroInspect();
          this.tavern.selectedMercId = this.inspectedHeroUid;
        } else if (this.tavern.hitTestBountyBoard(pt.x, pt.y)) {
          this.launchWaveBattle();
        } else {
          this.inspectedHeroUid = null;
          this.renderHeroInspect();
          this.tavern.selectedMercId = null;
        }
      });
    }

    bindResize() {
      const resize = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scale = Math.min(vw / STAGE_W, vh / STAGE_H);
        this.stageEl.style.transform = `scale(${scale})`;
      };
      window.addEventListener('resize', resize);
      resize();
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.MT.game = new RelicTavernGame();
    window.MT.game.init();
  });
})();
