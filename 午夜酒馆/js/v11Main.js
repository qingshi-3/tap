// v11.0 Midnight Tavern Main Controller — Pure 2-Beat Balatro x Active-Boss Loop
// - Beat 1 (Outdoor Mirror-Lake): 4-Round Active-Boss Battle (Deal 5 -> Pick 3 -> Strike -> Relic Cascade -> Boss Intent Counterplay!)
// - Beat 2 (Indoor Midnight Tavern): 100% Pure Black-Market Shop (Relics + Showstopper Booster Pack Ceremony + Planet Tomes + Left->Right Rack)
(function () {
  window.MT = window.MT || {};

  // ─── Pack Opening Ceremony 60fps Canvas FX (God-Rays, Duelyst Burst VFX, Spark Streaks & Vertical Light Pillars) ───
  class PackCeremonyFX {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.canvas.width = 1280;
      this.canvas.height = 720;
      this.running = false;
      this.rafId = null;
      this.lastTs = 0;
      this.time = 0;
      this.phase = 'idle';
      this.accent = '#ffd966';
      this.glow = '#ff942e';
      this.sparks = [];
      this.rings = [];
      this.activeVfx = [];
      this.pillars = [];
      this.flashAlpha = 0;
    }

    start(accent, glow) {
      this.accent = accent || '#ffd966';
      this.glow = glow || '#ff942e';
      this.phase = 'charge';
      this.time = 0;
      this.sparks = [];
      this.rings = [];
      this.activeVfx = [];
      this.pillars = [];
      this.flashAlpha = 0;
      this.running = true;
      this.lastTs = performance.now();
      this.loop(this.lastTs);
    }

    stop() {
      this.running = false;
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
      this.ctx.clearRect(0, 0, 1280, 720);
    }

    triggerBurst(burstVfxKey) {
      this.phase = 'burst';
      this.flashAlpha = 0.92;
      this.rings.push({ x: 640, y: 340, r: 24, maxR: 460, color: '#ffffff', life: 0.55, maxLife: 0.55, lw: 10 });
      this.rings.push({ x: 640, y: 340, r: 16, maxR: 380, color: this.accent, life: 0.65, maxLife: 0.65, lw: 7 });

      if (window.MT.vfx) {
        const v1 = window.MT.vfx.createInstance('fxExplosionBigWhiteHot', 640, 345, { scale: 3.1 });
        if (v1) this.activeVfx.push(v1);
        const v2 = window.MT.vfx.createInstance(burstVfxKey || 'fx_f1_holyimmolation', 640, 355, { scale: 2.8 });
        if (v2) this.activeVfx.push(v2);
      }

      const colors = ['#ffffff', this.accent, this.glow, '#fff3b8'];
      for (let i = 0; i < 88; i++) {
        const ang = (i / 88) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
        const spd = 220 + Math.random() * 680;
        this.sparks.push({
          x: 640, y: 340, px: 640, py: 340,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 60,
          size: 3 + Math.random() * 4, color: colors[i % colors.length],
          life: 0.55 + Math.random() * 0.55, maxLife: 1.1
        });
      }
    }

    addCardRevealPillar(x, color, isRainbow = false) {
      this.phase = 'reveal';
      this.pillars.push({ x, color, rainbow: isRainbow, alpha: 0, targetAlpha: isRainbow ? 0.58 : 0.42 });
      this.rings.push({ x, y: 365, r: 14, maxR: 135, color: isRainbow ? '#ffffff' : color, life: 0.38, maxLife: 0.38, lw: 5 });
      for (let i = 0; i < 20; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 80 + Math.random() * 240;
        this.sparks.push({
          x, y: 365, px: x, py: 365,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 110,
          size: 3 + Math.random() * 3,
          color: isRainbow ? `hsl(${(i * 25) % 360}, 100%, 72%)` : color,
          life: 0.45 + Math.random() * 0.3, maxLife: 0.75
        });
      }
    }

    loop(ts) {
      if (!this.running) return;
      const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
      this.lastTs = ts;
      this.time += dt;
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
      if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.4);
      if (this.phase === 'charge' && Math.random() < 0.45) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 120 + Math.random() * 140;
        const sx = 640 + Math.cos(ang) * dist, sy = 340 + Math.sin(ang) * dist;
        this.sparks.push({ x: sx, y: sy, px: sx, py: sy, vx: (640 - sx) * 2.8, vy: (340 - sy) * 2.8, size: 4, color: Math.random() < 0.4 ? '#ffffff' : this.accent, life: 0.35, maxLife: 0.35 });
      }
      for (const pil of this.pillars) pil.alpha += (pil.targetAlpha - pil.alpha) * Math.min(1, dt * 8);
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i]; s.px = s.x; s.py = s.y; s.x += s.vx * dt; s.y += s.vy * dt;
        if (this.phase !== 'charge') { s.vx *= Math.pow(0.18, dt); s.vy += 220 * dt; }
        s.life -= dt; if (s.life <= 0) this.sparks.splice(i, 1);
      }
      for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].life -= dt; if (this.rings[i].life <= 0) this.rings.splice(i, 1); }
      if (window.MT.vfx) {
        for (let i = this.activeVfx.length - 1; i >= 0; i--) {
          window.MT.vfx.update(this.activeVfx[i], dt);
          if (this.activeVfx[i].done) this.activeVfx.splice(i, 1);
        }
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, 1280, 720);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const rayCount = 14;
      const raySpeed = this.phase === 'charge' ? 1.45 : 0.32;
      const baseAlpha = this.phase === 'charge' ? 0.24 : 0.12;
      ctx.save(); ctx.translate(640, 345); ctx.rotate(this.time * raySpeed);
      for (let i = 0; i < rayCount; i++) {
        const a0 = (i / rayCount) * Math.PI * 2, a1 = a0 + (Math.PI / rayCount) * 0.72;
        const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 620);
        g.addColorStop(0, this.accent); g.addColorStop(0.45, this.glow); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = baseAlpha * (i % 2 === 0 ? 1 : 0.55);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 620, a0, a1); ctx.closePath(); ctx.fill();
      }
      ctx.restore();

      for (const pil of this.pillars) {
        const col = pil.rainbow ? `hsl(${(this.time * 160 + pil.x) % 360}, 95%, 65%)` : pil.color;
        const pw = pil.rainbow ? 170 : 140;
        const g = ctx.createLinearGradient(pil.x - pw / 2, 0, pil.x + pw / 2, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = pil.alpha * (0.85 + Math.sin(this.time * 5 + pil.x) * 0.15);
        ctx.fillStyle = g; ctx.fillRect(pil.x - pw / 2, 70, pw, 540);
      }
      for (const rg of this.rings) {
        const p = 1 - Math.max(0, rg.life / rg.maxLife), r = rg.r + (rg.maxR - rg.r) * (1 - Math.pow(1 - p, 3));
        ctx.globalAlpha = (1 - p) * 0.9; ctx.strokeStyle = rg.color; ctx.lineWidth = Math.max(2, rg.lw * (1 - p * 0.6));
        ctx.beginPath(); ctx.arc(rg.x, rg.y, r, 0, Math.PI * 2); ctx.stroke();
      }
      if (window.MT.vfx) {
        ctx.globalCompositeOperation = 'source-over';
        for (const inst of this.activeVfx) window.MT.vfx.draw(ctx, inst);
        ctx.globalCompositeOperation = 'lighter';
      }
      for (const s of this.sparks) {
        ctx.globalAlpha = Math.max(0, s.life / s.maxLife); ctx.strokeStyle = s.color; ctx.lineWidth = s.size;
        ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); ctx.stroke();
      }
      if (this.flashAlpha > 0) { ctx.globalAlpha = this.flashAlpha; ctx.fillStyle = '#fff9e6'; ctx.fillRect(0, 0, 1280, 720); }
      ctx.restore();
    }
  }

  // ─── Main v11 Pure 2-Beat Game Controller ───
  class V11Game {
    constructor() {
      this.stageEl = document.getElementById('stage');
      this.tavern = new window.MT.TavernCanvas(document.getElementById('tavern-canvas'));
      this.battle = new window.MT.V11Battle(document.getElementById('battle-canvas'));
      this.packFx = new PackCeremonyFX(document.getElementById('pack-fx-canvas'));

      this.state = null;
      this.swapSlotIdx = -1;
      this.activePack = null;
      this.packTimers = [];
      this.muted = false;

      this.bindGlobalEvents();
      this.fitStage();
      window.addEventListener('resize', () => this.fitStage());
    }

    fitStage() {
      const sc = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
      this.stageEl.style.transform = `scale(${sc})`;
    }

    async init() {
      await Promise.all([
        window.MT.sprites ? window.MT.sprites.load() : Promise.resolve(),
        window.MT.vfx ? window.MT.vfx.load() : Promise.resolve()
      ]);
      this.tavern.start();
      this.startNewRun();
    }

    startNewRun() {
      const D = window.MT.V11_DATA;
      const starterRelicTpl = D.RELICS[0]; // 神锤碎甲 (+35伤)
      this.state = {
        runSeed: Math.floor(Math.random() * 1000),
        wave: 1,
        hearts: 3,
        maxHearts: 3,
        gold: 6, // Start right in Mirror-Lake W1; winning W1 awards ~12G for your first juicy Tavern Shop & Pack!
        view: 'battle', // battle | shop
        roster: D.createStarterRoster(),
        drawPile: [],
        discardPile: [],
        hand: [],         // 5 dealt cards in Mirror-Lake Battle
        selectedIds: [],  // 0..3 selected (GPT Fix #3: starts empty, zero forced preselect!)
        frozenUid: null,  // Set when Boss casts Frost Lock
        discardsLeft: D.MAX_DISCARDS,
        relics: [{ uid: 'r_start_1', tplId: starterRelicTpl.id, tpl: starterRelicTpl, edition: 'normal' }],
        handLevels: { royal_triangle: 1, three_kind: 1, flush: 1, triangle: 1, pair: 1, high_card: 1 },
        shop: null,
        rerollCost: 3,
        endless: false
      };
      this.swapSlotIdx = -1;
      this.closeAllModals();
      this.enterBattleWave();
    }

    getMaxRelicSlots() {
      return 5 + this.state.relics.filter((r) => r.edition === 'negative').length;
    }

    // ─── Deck Management Inside Mirror-Lake 4-Round Battle ───
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    initWaveDeck() {
      this.state.drawPile = this.shuffle(this.state.roster);
      this.state.discardPile = [];
      this.state.hand = [];
      this.state.selectedIds = [];
      this.state.frozenUid = null;
      this.state.discardsLeft = window.MT.V11_DATA.MAX_DISCARDS;
      this.refillBattleHand(5);
    }

    refillBattleHand(targetCount = 5) {
      const inHand = new Set(this.state.hand.map((h) => h.uid));
      const maxTotal = Math.min(targetCount, this.state.roster.length);

      while (this.state.hand.length < maxTotal) {
        if (this.state.drawPile.length === 0) {
          // Reshuffle discard pile (or any roster hero not currently in hand)
          const recycle = this.state.roster.filter((h) => !inHand.has(h.uid));
          if (recycle.length === 0) break;
          this.state.drawPile = this.shuffle(recycle);
          this.state.discardPile = [];
        }
        const next = this.state.drawPile.pop();
        if (!next || inHand.has(next.uid)) continue;
        const live = this.state.roster.find((r) => r.uid === next.uid);
        if (!live) continue;
        inHand.add(live.uid);
        this.state.hand.push(live);
      }
    }

    // ─── BEAT 1: Enter Outdoor Mirror-Lake 4-Round Active-Boss Battle! ───
    enterBattleWave() {
      const D = window.MT.V11_DATA;
      this.state.view = 'battle';
      document.getElementById('tavern-view').classList.add('hidden');
      document.getElementById('battle-view').classList.remove('hidden');

      this.initWaveDeck();
      const bossCfg = D.getWaveBoss(this.state.wave, this.state.runSeed);

      this.battle.startWave({
        bossCfg,
        relics: this.state.relics,
        maxRelicSlots: this.getMaxRelicSlots(),
        runCtx: {
          wave: this.state.wave,
          gold: this.state.gold,
          discardsLeft: this.state.discardsLeft,
          rosterSize: this.state.roster.length
        },
        onRoundReady: ({ freezeRight }) => this.handleNextBattleRound(freezeRight),
        onDone: (res) => this.handleBattleDone(res)
      });

      this.showBattlePickDock(true);
      this.renderBattleHandDock();
    }

    handleNextBattleRound(freezeRight) {
      // Played heroes were already removed on strike; refill back to 5!
      this.state.selectedIds = [];
      this.state.frozenUid = null;
      this.refillBattleHand(5);
      if (freezeRight && this.state.hand.length >= 4) {
        this.state.frozenUid = this.state.hand[this.state.hand.length - 1].uid;
      }
      this.showBattlePickDock(true);
      this.renderBattleHandDock();
    }

    showBattlePickDock(show) {
      document.getElementById('bt-hand-dock').classList.toggle('hidden', !show);
      document.getElementById('bt-forecast-bar').classList.toggle('hidden', !show);
      document.getElementById('battle-live-telemetry').classList.toggle('hidden', show);
    }

    toggleSelectBattleHero(uid) {
      if (this.battle.phase !== 'picking') return;
      if (uid === this.state.frozenUid) { this.toast('这张卡牌被 Boss 冰封，本回合无法选中！'); return; }
      const idx = this.state.selectedIds.indexOf(uid);
      if (idx >= 0) {
        this.state.selectedIds.splice(idx, 1);
      } else {
        if (this.state.selectedIds.length >= 3) this.state.selectedIds.shift();
        this.state.selectedIds.push(uid);
      }
      if (window.MT.sfx) window.MT.sfx.playChainDing(this.state.selectedIds.length, false);
      const selected = this.state.selectedIds.map((id) => this.state.hand.find((h) => h.uid === id)).filter(Boolean);
      this.battle.previewSelectedHeroes(selected);
      this.renderBattleHandDock();
    }

    discardAndRedrawBattle() {
      if (this.battle.phase !== 'picking') return;
      if (this.state.discardsLeft <= 0) { this.toast('本波换桌次数已用完！'); return; }

      // Keep selected heroes (+ any frozen hero); swap all other unselected heroes!
      // If 0 heroes selected, swap ALL unfrozen heroes!
      const keepSet = new Set(this.state.selectedIds);
      if (this.state.frozenUid) keepSet.add(this.state.frozenUid);

      const toSwap = this.state.hand.filter((h) => !keepSet.has(h.uid));
      if (toSwap.length === 0) { this.toast('请先取消选中想换掉的侠客'); return; }

      this.state.discardsLeft--;
      this.state.discardPile.push(...toSwap);
      this.state.hand = this.state.hand.filter((h) => keepSet.has(h.uid));
      this.refillBattleHand(5);

      if (window.MT.sfx) window.MT.sfx.playChainDing(2, false);
      this.battle.shake(4, 0.14);
      const selected = this.state.selectedIds.map((id) => this.state.hand.find((h) => h.uid === id)).filter(Boolean);
      this.battle.previewSelectedHeroes(selected);
      this.renderBattleHandDock();
      this.toast(`换桌重抽 ${toSwap.length} 人！剩余 ${this.state.discardsLeft} 次`);
    }

    strikeWithSelectedHand() {
      if (this.battle.phase !== 'picking') return;
      const D = window.MT.V11_DATA;
      const squad3 = this.state.selectedIds
        .map((uid) => this.state.hand.find((h) => h.uid === uid))
        .filter(Boolean);
      if (squad3.length < 3) { this.toast('请先点选 3 位侠客出击！'); return; }

      const handEval = D.evaluateHand(squad3, this.state.handLevels);

      // Remove played 3 cards from hand into discard pile
      const playedSet = new Set(squad3.map((h) => h.uid));
      this.state.discardPile.push(...squad3);
      this.state.hand = this.state.hand.filter((h) => !playedSet.has(h.uid));
      this.state.selectedIds = [];

      // Minimize dock to show unobstructed Mirror-Lake spectacle!
      this.showBattlePickDock(false);
      document.getElementById('bt-hand-pill').innerHTML = `<b style="color:${handEval.hand.color}">${handEval.hand.name} Lv.${handEval.lv}</b> <span>×${handEval.mult}</span>`;

      this.battle.executeHand({
        squad3,
        handEval,
        runCtx: {
          wave: this.state.wave,
          gold: this.state.gold,
          discardsLeft: this.state.discardsLeft,
          rosterSize: this.state.roster.length
        }
      });
    }

    renderBattleHandDock() {
      const D = window.MT.V11_DATA;
      const selected = this.state.selectedIds
        .map((uid) => this.state.hand.find((h) => h.uid === uid))
        .filter(Boolean);
      const ev = D.evaluateHand(selected, this.state.handLevels);
      const intent = this.battle.bossIntent;

      // Live Tactical Forecast Bar (Clear Win/Lose, Shield & Break Math!)
      const fBar = document.getElementById('bt-forecast-bar');
      let counterTag = '';
      if (intent) {
        if (intent.kind === 'charge') {
          const strikerBonus = selected.some((h) => h.role === 'striker') ? 1.15 : 1.0;
          const estBreak = Math.round(ev.estBaseDmg * strikerBonus);
          if (ev.ready && estBreak >= intent.breakNeed) {
            counterTag = `<span class="fc-pill ok">💥 预估足够破招眩晕!</span>`;
          } else {
            const need = Math.max(0, intent.breakNeed - estBreak);
            counterTag = `<span class="fc-pill warn">🔥 破招需 ${intent.breakNeed}伤${ev.ready ? ` (基础差${need}, 靠秘宝或换桌)` : ''}</span>`;
          }
        } else if (intent.dmg > 0) {
          const hpLoss = Math.max(0, intent.dmg - ev.shield);
          if (ev.shield >= intent.dmg) {
            counterTag = `<span class="fc-pill ok">🛡 护盾 ${ev.shield} 完美格挡 ${intent.dmg}伤!</span>`;
          } else if (hpLoss >= this.battle.squadHp) {
            counterTag = `<span class="fc-pill danger">⚠ 致命威胁! 实扣 ${hpLoss}HP · 快选铁壁(盾)!</span>`;
          } else {
            counterTag = `<span class="fc-pill warn">⚔ 来袭 ${intent.dmg}伤 · 盾挡${ev.shield} (实扣 ${hpLoss}HP)</span>`;
          }
        } else if (intent.kind === 'stunned') {
          counterTag = `<span class="fc-pill ok">💫 Boss眩晕易伤 +50% · 全力输出!</span>`;
        }
      }

      if (ev.ready) {
        fBar.className = 'bt-forecast-bar ready';
        fBar.innerHTML = `
          <div class="fc-left">
            <b style="color:${ev.hand.color}">${ev.hand.name} Lv.${ev.lv}</b>
            <span class="fc-mult" style="background:${ev.hand.color}">×${ev.mult}</span>
            <span class="fc-dmg">基础预估 ~${ev.estBaseDmg}+</span>
            ${ev.shield > 0 ? `<span class="fc-shield">🛡 +${ev.shield}盾</span>` : ''}
          </div>
          <div class="fc-right">${counterTag}</div>
        `;
      } else {
        fBar.className = 'bt-forecast-bar';
        fBar.innerHTML = `
          <div class="fc-left">
            <b>已选 ${ev.count}/3 位出击侠客</b>
            <span class="fc-hint">铁壁=+28盾 · 突袭=破招+25% · 秘术=秘宝+25%</span>
          </div>
          <div class="fc-right">${counterTag}</div>
        `;
      }

      // Discard Wing
      const discBtn = document.getElementById('btn-bt-discard');
      const swappable = this.state.hand.filter((h) => !this.state.selectedIds.includes(h.uid) && h.uid !== this.state.frozenUid).length;
      discBtn.disabled = this.state.discardsLeft <= 0 || swappable === 0;
      discBtn.innerHTML = `
        <span class="wing-title">换桌重抽</span>
        <span class="wing-sub">剩 ${this.state.discardsLeft} 次 · 换未选 ${swappable} 人</span>
      `;

      // Strike Wing
      const strikeBtn = document.getElementById('btn-bt-strike');
      const roundsLeft = this.battle.maxRounds - this.battle.round + 1;
      strikeBtn.disabled = !ev.ready;
      strikeBtn.innerHTML = `
        <span class="wing-title">出击! (剩${roundsLeft}回)</span>
        <span class="wing-sub">${ev.ready ? `${ev.hand.name} ×${ev.mult}` : `还差 ${3 - ev.count} 人`}</span>
      `;

      // 5 Hero Cards
      const row = document.getElementById('bt-cards-row');
      row.innerHTML = this.state.hand.map((h) => {
        const fac = D.FACTIONS[h.faction];
        const role = D.ROLES[h.role];
        const selIdx = this.state.selectedIds.indexOf(h.uid);
        const isSel = selIdx >= 0;
        const isFrozen = h.uid === this.state.frozenUid;
        return `
          <button class="hero-hand-card ${isSel ? 'selected' : ''} ${h.redSeal ? 'has-seal' : ''} ${isFrozen ? 'frozen' : ''}" data-huid="${h.uid}" style="--fcol:${fac.color};--fbg:${fac.bg}">
            <div class="hhc-top">
              <span class="hhc-fac">${fac.name}</span>
              <span class="hhc-role" style="color:${role.color}">${role.short}·${role.perkShort}</span>
            </div>
            <div class="hhc-sprite" data-unit="${h.unitId}"></div>
            <div class="hhc-name">${h.redSeal ? '◈' : ''}${h.name}</div>
            <div class="hhc-atk">攻 ${h.atk}${h.redSeal ? ' · 2连击' : ''}</div>
            ${isSel ? `<span class="hhc-pick-badge">出击 #${selIdx + 1}</span>` : ''}
            ${isFrozen ? `<span class="hhc-frozen-badge">❄ 冻结</span>` : ''}
          </button>`;
      }).join('');

      row.querySelectorAll('.hhc-sprite').forEach((s) => {
        const sp = window.MT.sprites.createDomSprite(s.dataset.unit, { width: 68, height: 58 });
        if (sp) s.appendChild(sp);
      });
      row.querySelectorAll('.hero-hand-card').forEach((btn) => {
        btn.onclick = () => this.toggleSelectBattleHero(btn.dataset.huid);
      });
    }

    // ─── Battle Done -> Payout -> BEAT 2: Pure Indoor Tavern Black-Market Shop! ───
    handleBattleDone(res) {
      const D = window.MT.V11_DATA;
      const bossCfg = D.getWaveBoss(res.wave, this.state.runSeed);
      const interest = Math.min(5, Math.floor(this.state.gold / 5));
      let baseGold = 0;
      let speedBonus = 0;

      if (res.win) {
        baseGold = bossCfg.reward;
        speedBonus = res.handsSaved * 2; // +2G per remaining unused round!
      } else {
        this.state.hearts = Math.max(0, this.state.hearts - 1);
        baseGold = Math.max(3, Math.round(bossCfg.reward * Math.max(0.45, res.bossDamagePct)));
      }
      const totalEarned = baseGold + speedBonus + interest + (res.combatGold || 0);
      this.state.gold += totalEarned;

      const modal = document.getElementById('payout-modal');
      const title = document.getElementById('po-title');
      const sub = document.getElementById('po-sub');
      const rows = document.getElementById('po-rows');
      const btn = document.getElementById('po-next-btn');

      const gameOver = !res.win && this.state.hearts <= 0;
      const victory = res.win && res.wave === 8 && !this.state.endless;

      if (gameOver) {
        title.textContent = `止步第 ${res.wave} 波 · 酒馆打烊`;
        title.className = 'po-title lose';
        sub.textContent = `${res.reason === 'squad_wiped' ? '小队阵亡' : '4回合耗尽'} · 最高一击 ${res.peakHit.toLocaleString()}`;
        btn.textContent = '再来一局';
        btn.onclick = () => { modal.classList.add('hidden'); this.startNewRun(); };
      } else if (victory) {
        title.textContent = '★ 8波通关 · 镜湖传奇! ★';
        title.className = 'po-title win';
        sub.textContent = `最高牌型【${res.handName} ×${res.handMult}】· 最高单击 ${res.peakHit.toLocaleString()}`;
        btn.textContent = '进酒馆开包 · 继续无尽 →';
        btn.onclick = () => { modal.classList.add('hidden'); this.state.endless = true; this.enterTavernShop(true); };
      } else {
        const loseTag = res.reason === 'squad_wiped' ? '小队被 Boss 击溃 (生命 -1❤)' : '4回合耗尽未击杀 (生命 -1❤)';
        title.textContent = res.win ? `W${res.wave} 讨伐成功!` : `W${res.wave} ${loseTag}`;
        title.className = `po-title ${res.win ? 'win' : 'lose'}`;
        sub.textContent = `最佳牌型 ${res.handName} ×${res.handMult} · 最高一击 ${res.peakHit.toLocaleString()} · 秘宝连锁 ${res.totalTriggers} 次`;
        btn.textContent = '推门进酒馆 · 开包构筑 →';
        btn.onclick = () => { modal.classList.add('hidden'); this.enterTavernShop(res.win); };
      }

      rows.innerHTML = `
        <div class="po-row"><span>${res.win ? '悬赏基础赏金' : '战损保底补贴'}</span><b>+${baseGold}G</b></div>
        ${speedBonus > 0 ? `<div class="po-row"><span>余合速通赏金 (剩${res.handsSaved}回 ×2G)</span><b>+${speedBonus}G</b></div>` : ''}
        <div class="po-row"><span>酒馆存款利息 (每5G+1)</span><b>+${interest}G</b></div>
        ${res.combatGold > 0 ? `<div class="po-row"><span>秘宝战中吸金</span><b>+${res.combatGold}G</b></div>` : ''}
        <div class="po-row total"><span>本波实得金币</span><b>+${totalEarned}G</b></div>
      `;
      modal.classList.remove('hidden');
    }

    // ─── BEAT 2: Pure Indoor Midnight Tavern Shop! ───
    enterTavernShop(didWin) {
      if (didWin) this.state.wave++;
      this.state.view = 'shop';
      this.state.rerollCost = 3;
      this.swapSlotIdx = -1;
      this.rollShopInventory();

      document.getElementById('battle-view').classList.add('hidden');
      document.getElementById('tavern-view').classList.remove('hidden');

      this.syncTavernHeroes();
      this.renderShopAll();
    }

    syncTavernHeroes() {
      const D = window.MT.V11_DATA;
      // Show 3 featured heroes from your roster relaxing in the cozy hearth tavern hall!
      const featured = this.state.roster.slice(0, 3);
      const mercs = featured.map((h) => ({
        id: h.uid, unitId: h.unitId, name: h.name, power: h.atk, effectivePower: h.atk,
        tier: 'A', factionColor: D.FACTIONS[h.faction].color, factionTag: D.FACTIONS[h.faction].short,
        roleTag: D.ROLES[h.role].short, redSeal: h.redSeal
      }));
      this.tavern.syncMercenaries(mercs, new Set());
    }

    rollShopInventory() {
      const D = window.MT.V11_DATA;
      const ownedIds = new Set(this.state.relics.map((r) => r.tplId));
      const pool = D.RELICS.filter((r) => !ownedIds.has(r.id));
      const shuffled = [...pool].sort(() => Math.random() - 0.5);

      const shopRelics = shuffled.slice(0, 3).map((tpl, idx) => {
        const edition = D.rollEdition(false);
        const ed = D.EDITIONS[edition];
        return { shopId: `sr_${Date.now()}_${idx}`, tplId: tpl.id, tpl, edition, cost: tpl.cost + ed.priceAdd, sold: false };
      });
      const packOrder = [...D.PACKS].sort(() => Math.random() - 0.5).slice(0, 2);
      const shopPacks = packOrder.map((p, idx) => ({ shopId: `sp_${Date.now()}_${idx}`, packId: p.id, tpl: p, cost: p.cost, sold: false }));
      const tomeHand = D.HAND_TYPES[Math.floor(Math.random() * 5)];
      const shopTome = { shopId: `st_${Date.now()}`, handId: tomeHand.id, hand: tomeHand, cost: 4, sold: false };
      this.state.shop = { relics: shopRelics, packs: shopPacks, tome: shopTome };
    }

    rerollShop() {
      if (this.state.view !== 'shop') return;
      if (this.state.gold < this.state.rerollCost) { this.toast('金币不足！'); return; }
      this.state.gold -= this.state.rerollCost;
      this.state.rerollCost = Math.min(7, this.state.rerollCost + 1);
      this.rollShopInventory();
      if (window.MT.sfx) window.MT.sfx.playChainDing(2, false);
      this.renderShopAll();
    }

    buyShopRelic(shopId) {
      const item = this.state.shop.relics.find((r) => r.shopId === shopId);
      if (!item || item.sold) return;
      if (this.state.gold < item.cost) { this.toast('金币不足！'); return; }
      if (item.edition !== 'negative' && this.state.relics.length >= this.getMaxRelicSlots()) {
        this.toast('秘宝栏已满！点击顶部秘宝可出售腾位'); return;
      }
      this.state.gold -= item.cost;
      item.sold = true;
      this.state.relics.push({ uid: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), tplId: item.tplId, tpl: item.tpl, edition: item.edition });
      if (window.MT.sfx) window.MT.sfx.playChainDing(4, item.edition === 'polychrome' || item.tpl.cat === 'mult');
      this.renderShopAll();
      this.toast(`装备【${item.tpl.name}】！点击顶部两个秘宝可左右换序`);
    }

    buyPlanetTome() {
      const t = this.state.shop && this.state.shop.tome;
      if (!t || t.sold) return;
      if (this.state.gold < t.cost) { this.toast('金币不足！'); return; }
      this.state.gold -= t.cost;
      t.sold = true;
      this.state.handLevels[t.handId] = (this.state.handLevels[t.handId] || 1) + 1;
      if (window.MT.sfx) window.MT.sfx.playChainDing(6, true);
      this.tavern.shake(7, 0.22);
      this.renderShopAll();
      this.toast(`【${t.hand.name}】升至 Lv.${this.state.handLevels[t.handId]}（永久增倍）!`);
    }

    buyBoosterPack(shopId) {
      const p = this.state.shop.packs.find((x) => x.shopId === shopId);
      if (!p || p.sold) return;
      if (this.state.gold < p.cost) { this.toast('金币不足！'); return; }
      this.state.gold -= p.cost;
      p.sold = true;
      this.renderShopAll();
      this.openPackCeremony(p.tpl);
    }

    // ─── SHOWSTOPPER: Booster Pack Opening Ceremony ───
    clearPackTimers() { for (const id of this.packTimers) clearTimeout(id); this.packTimers = []; }

    generatePackChoices(packTpl) {
      const D = window.MT.V11_DATA;
      if (packTpl.id === 'pack_relic') {
        const owned = new Set(this.state.relics.map((r) => r.tplId));
        return [...D.RELICS.filter((r) => !owned.has(r.id))].sort(() => Math.random() - 0.5).slice(0, 4)
          .map((tpl, i) => ({ kind: 'relic', idx: i, tpl, edition: D.rollEdition(true) }));
      }
      if (packTpl.id === 'pack_hero') {
        return [...D.HEROES].sort(() => Math.random() - 0.5).slice(0, 4)
          .map((tpl, i) => ({ kind: 'hero', idx: i, tpl, redSeal: Math.random() < 0.34, bonusAtk: Math.random() < 0.45 ? 14 : 0 }));
      }
      return [...D.ALCHEMY_CARDS].sort(() => Math.random() - 0.5).slice(0, 3)
        .map((tpl, i) => ({ kind: 'alchemy', idx: i, tpl }));
    }

    openPackCeremony(packTpl) {
      this.clearPackTimers();
      this.activePack = { tpl: packTpl, choices: this.generatePackChoices(packTpl), stage: 'charge' };

      const modal = document.getElementById('pack-ceremony-modal');
      const env = document.getElementById('pack-foil-envelope');
      const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(packTpl.icon) : null;

      modal.classList.remove('hidden');
      document.getElementById('pack-sealed-stage').classList.remove('hidden');
      document.getElementById('pack-reveal-stage').classList.add('hidden');
      document.getElementById('pack-target-stage').classList.add('hidden');

      env.style.setProperty('--p-accent', packTpl.accent);
      env.style.setProperty('--p-glow', packTpl.glow);
      env.classList.remove('tearing');
      env.innerHTML = `
        <div class="foil-shimmer"></div>
        <div class="foil-seal-top">✦ 午夜黑市封印 ✦</div>
        <div class="foil-emblem">${iconUrl ? `<img src="${iconUrl}" alt="${packTpl.name}" />` : ''}</div>
        <div class="foil-title">${packTpl.name}</div>
        <div class="foil-sub">${packTpl.subtitle}</div>
        <div class="foil-tap-hint">点击立即撕开 (蓄力中…)</div>
      `;
      document.getElementById('pack-ceremony-title').textContent = `${packTpl.name} · ${packTpl.subtitle}`;
      document.getElementById('pack-ceremony-sub').textContent = packTpl.desc;

      this.packFx.start(packTpl.accent, packTpl.glow);
      if (window.MT.sfx) {
        window.MT.sfx.playChainDing(1, false);
        this.packTimers.push(setTimeout(() => window.MT.sfx && window.MT.sfx.playChainDing(3, false), 220));
        this.packTimers.push(setTimeout(() => window.MT.sfx && window.MT.sfx.playChainDing(5, false), 440));
      }
      env.onclick = () => this.tearOpenPack();
      this.packTimers.push(setTimeout(() => this.tearOpenPack(), 700));
    }

    tearOpenPack() {
      if (!this.activePack || this.activePack.stage !== 'charge') return;
      this.clearPackTimers();
      this.activePack.stage = 'burst';
      document.getElementById('pack-foil-envelope').classList.add('tearing');
      this.packFx.triggerBurst(this.activePack.tpl.burstVfx);
      if (window.MT.sfx) window.MT.sfx.playChainDing(7, true);
      this.packTimers.push(setTimeout(() => this.showPackRevealCards(), 310));
    }

    showPackRevealCards() {
      if (!this.activePack) return;
      this.activePack.stage = 'reveal';
      document.getElementById('pack-sealed-stage').classList.add('hidden');
      document.getElementById('pack-reveal-stage').classList.remove('hidden');

      const grid = document.getElementById('pack-cards-grid');
      const D = window.MT.V11_DATA;
      const choices = this.activePack.choices;

      grid.innerHTML = choices.map((c, idx) => {
        if (c.kind === 'relic') {
          const r = c.tpl, ed = D.EDITIONS[c.edition];
          const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(r.icon) : null;
          const beamCol = c.edition === 'polychrome' ? '#ff7be5' : c.edition === 'foil' ? '#ffd966' : c.edition === 'negative' ? '#9e7aff' : (r.cat === 'mult' ? '#ff6b9d' : r.cat === 'vfx' ? '#6be5ff' : '#ffd966');
          return `
            <div class="pcard-wrap ed-${c.edition}" data-cidx="${idx}" data-beam="${beamCol}" data-rainbow="${c.edition === 'polychrome' ? '1' : '0'}">
              <div class="pcard-inner">
                <div class="pcard-back"><span>✦</span></div>
                <div class="pcard-front cat-${r.cat} ed-${c.edition}">
                  <div class="pcard-top">
                    <span class="pcard-cat">${r.cat === 'mult' ? '× 倍率秘宝' : r.cat === 'vfx' ? '⚡ 连锁特效' : '+ 基础增伤'}</span>
                    ${ed.badge ? `<span class="ed-pill ed-${c.edition}">${ed.badge}</span>` : ''}
                  </div>
                  <div class="pcard-icon-box">${iconUrl ? `<img src="${iconUrl}" alt="${r.name}" />` : ''}</div>
                  <div class="pcard-name">${r.name}</div>
                  <div class="pcard-short">${r.short}</div>
                  <div class="pcard-desc">${r.desc}${ed.desc ? `<br><b class="ed-note">${ed.desc}</b>` : ''}</div>
                  <div class="pcard-cta">点击收入秘宝栏</div>
                </div>
              </div>
            </div>`;
        }
        if (c.kind === 'hero') {
          const h = c.tpl, fac = D.FACTIONS[h.faction], role = D.ROLES[h.role];
          return `
            <div class="pcard-wrap ${c.redSeal ? 'ed-foil' : ''}" data-cidx="${idx}" data-beam="${c.redSeal ? '#ff5268' : fac.color}" data-rainbow="${c.redSeal ? '1' : '0'}">
              <div class="pcard-inner">
                <div class="pcard-back"><span>⚔</span></div>
                <div class="pcard-front hero-card" style="--fcol:${fac.color}">
                  <div class="pcard-top">
                    <span class="fac-chip" style="background:${fac.bg};color:${fac.color}">${fac.name}</span>
                    ${c.redSeal ? `<span class="ed-pill seal-pill">◈ 红印·2连击</span>` : `<span class="role-chip" style="color:${role.color}">${role.name}</span>`}
                  </div>
                  <div class="pcard-sprite-slot" data-unit="${h.unitId}"></div>
                  <div class="pcard-name">${c.redSeal ? '◈ ' : ''}${h.name}</div>
                  <div class="pcard-short">攻 ${h.atk + c.bonusAtk}${c.bonusAtk ? ` (+${c.bonusAtk})` : ''} · ${role.perkShort}</div>
                  <div class="pcard-desc">${c.redSeal ? '<b style="color:#ff6b81">自带【红印】：每次出击打 2 下!</b>' : `加入花名册，助你凑齐【${fac.name}】同花!`}</div>
                  <div class="pcard-cta">点击招募入花名册</div>
                </div>
              </div>
            </div>`;
        }
        const al = c.tpl, iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(al.icon) : null;
        const disabled = al.minRoster && this.state.roster.length < al.minRoster;
        return `
          <div class="pcard-wrap ${disabled ? 'disabled' : ''}" data-cidx="${idx}" data-beam="${al.color}" data-rainbow="0">
            <div class="pcard-inner">
              <div class="pcard-back"><span>☾</span></div>
              <div class="pcard-front alchemy-card" style="--acol:${al.color}">
                <div class="pcard-top"><span class="pcard-cat">炼金塔罗</span></div>
                <div class="pcard-icon-box">${iconUrl ? `<img src="${iconUrl}" alt="${al.name}" />` : ''}</div>
                <div class="pcard-name">${al.name}</div>
                <div class="pcard-desc">${al.desc}</div>
                <div class="pcard-cta">${disabled ? '花名册已达3人下限' : '点击施展秘术'}</div>
              </div>
            </div>
          </div>`;
      }).join('');

      grid.querySelectorAll('.pcard-sprite-slot').forEach((slot) => {
        const spr = window.MT.sprites.createDomSprite(slot.dataset.unit, { width: 96, height: 96 });
        if (spr) slot.appendChild(spr);
      });

      const centerXs = choices.length === 3 ? [380, 640, 900] : [250, 510, 770, 1030];
      grid.querySelectorAll('.pcard-wrap').forEach((el, i) => {
        this.packTimers.push(setTimeout(() => {
          el.classList.add('flipped');
          const isRainbow = el.dataset.rainbow === '1';
          this.packFx.addCardRevealPillar(centerXs[i] || 640, el.dataset.beam || '#ffd966', isRainbow);
          if (window.MT.sfx) window.MT.sfx.playChainDing(2 + i, isRainbow);
        }, 120 + i * 150));
        el.onclick = () => {
          if (!el.classList.contains('flipped') || el.classList.contains('disabled')) return;
          this.claimPackChoice(Number(el.dataset.cidx));
        };
      });
    }

    claimPackChoice(idx) {
      if (!this.activePack) return;
      const c = this.activePack.choices[idx];
      if (!c) return;
      const D = window.MT.V11_DATA;

      if (c.kind === 'relic') {
        if (c.edition !== 'negative' && this.state.relics.length >= this.getMaxRelicSlots()) {
          this.toast('秘宝栏已满！可点击【放弃本包 (+2G)】'); return;
        }
        this.state.relics.push({ uid: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), tplId: c.tpl.id, tpl: c.tpl, edition: c.edition });
        if (window.MT.sfx) window.MT.sfx.playChainDing(6, true);
        this.closePackCeremony();
        this.toast(`获得秘宝【${c.tpl.name}】!`);
        return;
      }
      if (c.kind === 'hero') {
        const inst = D.makeHeroInstance(c.tpl, { redSeal: c.redSeal, bonusAtk: c.bonusAtk });
        this.state.roster.push(inst);
        if (window.MT.sfx) window.MT.sfx.playChainDing(5, c.redSeal);
        this.closePackCeremony();
        this.toast(`招募【${inst.redSeal ? '◈红印·' : ''}${inst.name}】加入花名册！`);
        return;
      }
      const al = c.tpl;
      if (!al.needsHero) {
        const gain = Math.min(18, this.state.gold);
        this.state.gold += gain;
        if (window.MT.sfx) window.MT.sfx.playChainDing(6, true);
        this.closePackCeremony();
        this.toast(`点金黑市契生效！获得 +${gain}G！`);
        return;
      }
      if (al.id === 'al_banish' && this.state.roster.length <= 3) {
        this.toast('花名册至少需保留 3 人！'); return;
      }
      this.renderAlchemyTargetPicker(al);
    }

    renderAlchemyTargetPicker(al) {
      const D = window.MT.V11_DATA;
      document.getElementById('pack-reveal-stage').classList.add('hidden');
      document.getElementById('pack-target-stage').classList.remove('hidden');
      document.getElementById('pack-target-title').textContent = `选择【${al.name}】施展目标（花名册共 ${this.state.roster.length} 人）`;
      const grid = document.getElementById('pack-target-grid');
      grid.innerHTML = this.state.roster.map((h) => {
        const fac = D.FACTIONS[h.faction], role = D.ROLES[h.role];
        return `
          <button class="target-hero-btn" data-huid="${h.uid}" style="--fcol:${fac.color}">
            <div class="th-sprite" data-unit="${h.unitId}"></div>
            <div class="th-info">
              <div class="th-name">${h.redSeal ? '◈' : ''}${h.name}</div>
              <div class="th-tags"><span style="color:${fac.color}">${fac.name}</span> · <span style="color:${role.color}">${role.name}</span> · 攻${h.atk}</div>
            </div>
          </button>`;
      }).join('');
      grid.querySelectorAll('.th-sprite').forEach((s) => {
        const sp = window.MT.sprites.createDomSprite(s.dataset.unit, { width: 58, height: 58 });
        if (sp) s.appendChild(sp);
      });
      grid.querySelectorAll('.target-hero-btn').forEach((btn) => {
        btn.onclick = () => this.applyAlchemyToHero(al, btn.dataset.huid);
      });
    }

    applyAlchemyToHero(al, uid) {
      const D = window.MT.V11_DATA;
      const idx = this.state.roster.findIndex((h) => h.uid === uid);
      if (idx < 0) return;
      const hero = this.state.roster[idx];
      if (al.id === 'al_red_seal') { hero.redSeal = true; this.toast(`【${hero.name}】已烙上红印（每次出击打2下）！`); }
      else if (al.id === 'al_shift_f') {
        const counts = {};
        for (const h of this.state.roster) counts[h.faction] = (counts[h.faction] || 0) + 1;
        const topFac = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        hero.faction = topFac;
        this.toast(`【${hero.name}】已同化为【${D.FACTIONS[topFac].name}】阵营！`);
      } else if (al.id === 'al_clone') {
        this.state.roster.push({ ...hero, uid: 'h_clone_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5) });
        this.toast(`成功克隆【${hero.name}】加入花名册！`);
      } else if (al.id === 'al_banish') {
        if (this.state.roster.length <= 3) return;
        this.state.roster.splice(idx, 1);
        this.toast(`已驱逐【${hero.name}】，牌库更精纯了！`);
      } else if (al.id === 'al_forge') {
        hero.atk += 28;
        this.toast(`【${hero.name}】淬体成功，攻击 +28！`);
      }
      if (window.MT.sfx) window.MT.sfx.playChainDing(6, true);
      this.closePackCeremony();
    }

    abandonActivePack() {
      if (!this.activePack) return;
      this.state.gold += 2;
      if (window.MT.sfx) window.MT.sfx.playChainDing(1, false);
      this.closePackCeremony();
      this.toast('已放弃本包，获得拆封回收 +2G');
    }

    closePackCeremony() {
      this.clearPackTimers();
      this.activePack = null;
      this.packFx.stop();
      document.getElementById('pack-ceremony-modal').classList.add('hidden');
      this.syncTavernHeroes();
      this.renderShopAll();
    }

    // ─── Shop Rendering & Top Relic Rack Reordering ───
    handleRelicSlotClick(idx) {
      if (idx >= this.state.relics.length) { this.swapSlotIdx = -1; this.renderShopAll(); return; }
      if (this.swapSlotIdx === -1) this.swapSlotIdx = idx;
      else if (this.swapSlotIdx === idx) this.swapSlotIdx = -1;
      else {
        [this.state.relics[this.swapSlotIdx], this.state.relics[idx]] = [this.state.relics[idx], this.state.relics[this.swapSlotIdx]];
        this.swapSlotIdx = -1;
        if (window.MT.sfx) window.MT.sfx.playChainDing(3, false);
        this.toast('秘宝顺序已调换（战斗按从左到右连锁触发）');
      }
      this.renderShopAll();
    }

    sellRelicAt(idx) {
      const r = this.state.relics[idx];
      if (!r) return;
      const refund = Math.max(2, Math.floor((r.tpl.cost || 4) * 0.5));
      this.state.relics.splice(idx, 1);
      this.state.gold += refund;
      this.swapSlotIdx = -1;
      if (window.MT.sfx) window.MT.sfx.playChainDing(1, false);
      this.renderShopAll();
      this.toast(`出售【${r.tpl.name}】回收 +${refund}G`);
    }

    renderShopAll() {
      const D = window.MT.V11_DATA;
      document.getElementById('hud-wave').textContent = `W${this.state.wave}${this.state.endless ? ' 无尽' : '/8'}`;
      document.getElementById('hud-hearts').textContent = '❤'.repeat(this.state.hearts) + '♡'.repeat(Math.max(0, this.state.maxHearts - this.state.hearts));
      document.getElementById('hud-gold').textContent = `${this.state.gold}G`;
      document.getElementById('hud-roster-count').textContent = `${this.state.roster.length}`;

      // Top Relic Rack
      const rack = document.getElementById('top-relic-rack');
      const maxSlots = this.getMaxRelicSlots();
      let html = `<span class="rack-dir-tag">左→右</span>`;
      for (let i = 0; i < maxSlots; i++) {
        const inst = this.state.relics[i];
        if (!inst) { html += `<div class="rack-slot empty"><span>空</span></div>`; continue; }
        const r = inst.tpl, ed = D.EDITIONS[inst.edition] || D.EDITIONS.normal;
        const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(r.icon) : null;
        const isSel = this.swapSlotIdx === i;
        html += `
          <div class="rack-slot filled cat-${r.cat} ed-${inst.edition} ${isSel ? 'swap-active' : ''}" data-ridx="${i}" title="${r.name}：${r.desc}">
            ${ed.badge ? `<i class="ed-pip ed-${inst.edition}">${ed.badge}</i>` : ''}
            ${iconUrl ? `<img src="${iconUrl}" alt="${r.name}" />` : ''}
            <span class="rack-badge">${r.short}</span>
            ${isSel ? `<button class="rack-sell-btn" data-sell="${i}">卖+${Math.max(2, Math.floor(r.cost * 0.5))}G</button>` : ''}
          </div>`;
      }
      rack.innerHTML = html;
      rack.querySelectorAll('.rack-slot.filled').forEach((el) => {
        el.onclick = (e) => { if (!e.target.classList.contains('rack-sell-btn')) this.handleRelicSlotClick(Number(el.dataset.ridx)); };
      });
      rack.querySelectorAll('.rack-sell-btn').forEach((btn) => {
        btn.onclick = (e) => { e.stopPropagation(); this.sellRelicAt(Number(btn.dataset.sell)); };
      });

      // Next Boss Preview Ribbon above Shop Dock
      const nextBoss = D.getWaveBoss(this.state.wave, this.state.runSeed);
      document.getElementById('shop-boss-preview').innerHTML = `
        <span>✦ 午夜黑市补给 · 开包买秘宝调整顺序</span>
        <span class="sbp-boss">下战 Boss：<b>${nextBoss.name}</b> · ${nextBoss.maxHp.toLocaleString()} HP</span>
      `;

      const sh = this.state.shop;
      if (!sh) return;
      const rerollBtn = document.getElementById('btn-shop-reroll');
      rerollBtn.innerHTML = `<span class="wing-title">刷新黑市</span><span class="wing-sub">${this.state.rerollCost}G</span>`;
      rerollBtn.disabled = this.state.gold < this.state.rerollCost;

      const nextBtn = document.getElementById('btn-shop-next');
      nextBtn.innerHTML = `<span class="wing-title">推门迎战 W${this.state.wave}</span><span class="wing-sub">直进镜湖开打 →</span>`;

      const relicsRow = document.getElementById('shop-relics-row');
      relicsRow.innerHTML = sh.relics.map((item) => {
        const r = item.tpl, ed = D.EDITIONS[item.edition];
        const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(r.icon) : null;
        return `
          <button class="shop-card relic-sc cat-${r.cat} ed-${item.edition} ${item.sold ? 'sold' : ''}" data-srid="${item.shopId}" title="${r.name}：${r.desc}">
            <div class="sc-top"><span class="sc-cat">${r.cat === 'mult' ? '×倍' : r.cat === 'vfx' ? '⚡效' : '+伤'}</span>${ed.badge ? `<span class="ed-pill sm ed-${item.edition}">${ed.badge}</span>` : ''}<span class="sc-price">${item.sold ? '已购' : `${item.cost}G`}</span></div>
            <div class="sc-ico">${iconUrl ? `<img src="${iconUrl}" alt="${r.name}" />` : ''}</div>
            <div class="sc-name">${r.name}</div>
            <div class="sc-short">${r.short}</div>
          </button>`;
      }).join('');
      relicsRow.querySelectorAll('.relic-sc').forEach((btn) => { btn.onclick = () => this.buyShopRelic(btn.dataset.srid); });

      const packsRow = document.getElementById('shop-packs-row');
      const packsHtml = sh.packs.map((p) => {
        const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(p.tpl.icon) : null;
        return `
          <button class="shop-card pack-sc ${p.sold ? 'sold' : ''}" data-spid="${p.shopId}" style="--pcol:${p.tpl.accent};--pglow:${p.tpl.glow}" title="${p.tpl.desc}">
            <div class="pack-pulse-bg"></div>
            <div class="sc-top"><span class="sc-cat">开包</span><span class="sc-price">${p.sold ? '已拆' : `${p.cost}G`}</span></div>
            <div class="sc-ico">${iconUrl ? `<img src="${iconUrl}" alt="${p.tpl.name}" />` : ''}</div>
            <div class="sc-name">${p.tpl.name}</div>
            <div class="sc-short">${p.tpl.subtitle}</div>
          </button>`;
      }).join('');

      const t = sh.tome, tIcon = window.MT.vfx ? window.MT.vfx.getIconUrl(t.hand.icon) : null, curLv = this.state.handLevels[t.handId] || 1;
      const tomeHtml = `
        <button class="shop-card tome-sc ${t.sold ? 'sold' : ''}" id="btn-buy-tome" title="永久升级【${t.hand.name}】倍率+${t.hand.multPerLv}×">
          <div class="sc-top"><span class="sc-cat">酒谱</span><span class="sc-price">${t.sold ? '已读' : `${t.cost}G`}</span></div>
          <div class="sc-ico">${tIcon ? `<img src="${tIcon}" alt="${t.hand.name}" />` : ''}</div>
          <div class="sc-name">${t.hand.short}谱</div>
          <div class="sc-short">Lv.${curLv}→${curLv + 1}</div>
        </button>`;
      packsRow.innerHTML = packsHtml + tomeHtml;
      packsRow.querySelectorAll('.pack-sc').forEach((btn) => { btn.onclick = () => this.buyBoosterPack(btn.dataset.spid); });
      const tomeBtn = document.getElementById('btn-buy-tome');
      if (tomeBtn) tomeBtn.onclick = () => this.buyPlanetTome();
    }

    openRosterModal(tab = 'roster') {
      const D = window.MT.V11_DATA;
      document.getElementById('roster-modal').classList.remove('hidden');
      const counts = {};
      for (const h of this.state.roster) counts[h.faction] = (counts[h.faction] || 0) + 1;
      document.getElementById('rm-summary').innerHTML = Object.entries(counts).sort((a, b) => b[1] - a[1])
        .map(([fid, c]) => `<span class="rm-fac-pill" style="background:${D.FACTIONS[fid].bg};color:${D.FACTIONS[fid].color}">${D.FACTIONS[fid].name} ×${c}</span>`).join('');
      const body = document.getElementById('rm-body');
      document.getElementById('rm-tab-roster').classList.toggle('active', tab === 'roster');
      document.getElementById('rm-tab-hands').classList.toggle('active', tab === 'hands');

      if (tab === 'hands') {
        body.innerHTML = `<div class="rm-hands-list">` + D.HAND_TYPES.map((ht) => {
          const lv = this.state.handLevels[ht.id] || 1;
          const mult = +(ht.baseMult + (lv - 1) * ht.multPerLv).toFixed(2);
          const bonus = ht.baseBonus + (lv - 1) * ht.bonusPerLv;
          return `<div class="rm-hand-row"><b style="color:${ht.color}">${ht.name}</b><span class="rm-lv">Lv.${lv}</span><span class="rm-mult" style="color:${ht.color}">×${mult}</span><span class="rm-bonus">+${bonus}伤</span><span class="rm-perk">${ht.perk}</span></div>`;
        }).join('') + `</div>`;
      } else {
        body.innerHTML = `<div class="rm-roster-grid">` + this.state.roster.map((h) => {
          const fac = D.FACTIONS[h.faction], role = D.ROLES[h.role];
          return `<div class="rm-hero-tile" style="--fcol:${fac.color}"><div class="rm-spr" data-unit="${h.unitId}"></div><div class="rm-hname">${h.redSeal ? '◈' : ''}${h.name}</div><div class="rm-htags"><span style="color:${fac.color}">${fac.name}</span> · <span style="color:${role.color}">${role.name}</span> · 攻${h.atk}</div></div>`;
        }).join('') + `</div>`;
        body.querySelectorAll('.rm-spr').forEach((s) => {
          const sp = window.MT.sprites.createDomSprite(s.dataset.unit, { width: 64, height: 58 });
          if (sp) s.appendChild(sp);
        });
      }
    }

    closeAllModals() {
      document.getElementById('payout-modal').classList.add('hidden');
      document.getElementById('roster-modal').classList.add('hidden');
      document.getElementById('pack-ceremony-modal').classList.add('hidden');
    }

    toast(msg) {
      const el = document.getElementById('toast-banner');
      if (!el) return;
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(this._toastId);
      this._toastId = setTimeout(() => el.classList.remove('show'), 2200);
    }

    bindGlobalEvents() {
      document.getElementById('btn-bt-discard').onclick = () => this.discardAndRedrawBattle();
      document.getElementById('btn-bt-strike').onclick = () => this.strikeWithSelectedHand();
      document.getElementById('btn-bt-hands').onclick = () => this.openRosterModal('hands');
      document.getElementById('btn-bt-roster').onclick = () => this.openRosterModal('roster');

      document.getElementById('btn-shop-reroll').onclick = () => this.rerollShop();
      document.getElementById('btn-shop-next').onclick = () => this.enterBattleWave();

      document.getElementById('btn-roster-open').onclick = () => this.openRosterModal('roster');
      document.getElementById('btn-hands-open').onclick = () => this.openRosterModal('hands');
      document.getElementById('rm-close-btn').onclick = () => document.getElementById('roster-modal').classList.add('hidden');
      document.getElementById('rm-tab-roster').onclick = () => this.openRosterModal('roster');
      document.getElementById('rm-tab-hands').onclick = () => this.openRosterModal('hands');

      document.getElementById('btn-pack-abandon').onclick = () => this.abandonActivePack();
      document.getElementById('btn-pack-target-back').onclick = () => {
        document.getElementById('pack-target-stage').classList.add('hidden');
        document.getElementById('pack-reveal-stage').classList.remove('hidden');
      };

      document.getElementById('btn-restart').onclick = () => this.startNewRun();
      document.getElementById('btn-mute').onclick = (e) => {
        this.muted = !this.muted;
        if (window.MT.sfx) window.MT.sfx.muted = this.muted;
        e.currentTarget.textContent = this.muted ? '静音' : '音效';
      };

      const spdBtn = document.getElementById('bt-speed-btn');
      spdBtn.onclick = () => {
        const next = this.battle.speed >= 2 ? 1 : 2;
        this.battle.setSpeed(next);
        spdBtn.textContent = next >= 2 ? '速度 2×' : '速度 1×';
        spdBtn.classList.toggle('fast', next >= 2);
      };
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const game = new V11Game();
    window.MT.game = game;
    game.init();
  });
})();
