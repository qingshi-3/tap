// v10.0 Midnight Tavern Main Controller
// - Phase 1 (Deal): Indoor Tavern Hall Deal-5-Pick-3 Poker Squad Combos + 2x Discard/Redraw
// - Phase 2 (Battle): Zero-Intervention Mirror-Lake Eclipse Auto-Battle Spectacle (1x/2x)
// - Phase 3 (Shop): Left-to-Right Reorderable Relic Rack + Foil/Polychrome/Negative Editions + Planet Battle-Tomes
// - Showstopper: Full-Screen Booster Pack Opening Ceremony with live Duelyst VFX burst, God-Rays, Spark Streaks & Vertical Rarity Light Pillars!
(function () {
  window.MT = window.MT || {};

  const SAVE_KEY = 'midnight_tavern_v10_deck_v1';

  // ─── Pack Opening FX Canvas Engine (60fps God-Rays, Duelyst Burst VFX, Spark Streaks & Light Pillars!) ───
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
      this.phase = 'idle'; // charge | burst | reveal
      this.accent = '#ffd966';
      this.glow = '#ff942e';
      this.sparks = [];
      this.rings = [];
      this.activeVfx = [];
      this.pillars = []; // { x, color, rainbow, alpha }
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

      // 88 radiant pixel spark streaks exploding outward!
      const colors = ['#ffffff', this.accent, this.glow, '#fff3b8'];
      for (let i = 0; i < 88; i++) {
        const ang = (i / 88) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
        const spd = 220 + Math.random() * 680;
        this.sparks.push({
          x: 640, y: 340, px: 640, py: 340,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 60,
          size: 3 + Math.random() * 4,
          color: colors[i % colors.length],
          life: 0.55 + Math.random() * 0.55,
          maxLife: 1.1
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
          life: 0.45 + Math.random() * 0.3,
          maxLife: 0.75
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
        const sx = 640 + Math.cos(ang) * dist;
        const sy = 340 + Math.sin(ang) * dist;
        this.sparks.push({
          x: sx, y: sy, px: sx, py: sy,
          vx: (640 - sx) * 2.8, vy: (340 - sy) * 2.8,
          size: 4, color: Math.random() < 0.4 ? '#ffffff' : this.accent,
          life: 0.35, maxLife: 0.35
        });
      }
      for (const pil of this.pillars) {
        pil.alpha += (pil.targetAlpha - pil.alpha) * Math.min(1, dt * 8);
      }
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        s.px = s.x; s.py = s.y;
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (this.phase !== 'charge') { s.vx *= Math.pow(0.18, dt); s.vy += 220 * dt; }
        s.life -= dt;
        if (s.life <= 0) this.sparks.splice(i, 1);
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        this.rings[i].life -= dt;
        if (this.rings[i].life <= 0) this.rings.splice(i, 1);
      }
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

      // Rotating Spotlight God-Rays
      const rayCount = 14;
      const raySpeed = this.phase === 'charge' ? 1.45 : 0.32;
      const baseAlpha = this.phase === 'charge' ? 0.24 : 0.12;
      ctx.save();
      ctx.translate(640, 345);
      ctx.rotate(this.time * raySpeed);
      for (let i = 0; i < rayCount; i++) {
        const a0 = (i / rayCount) * Math.PI * 2;
        const a1 = a0 + (Math.PI / rayCount) * 0.72;
        const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 620);
        g.addColorStop(0, this.accent);
        g.addColorStop(0.45, this.glow);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = baseAlpha * (i % 2 === 0 ? 1 : 0.55);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 620, a0, a1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Vertical Rarity Light Pillars behind revealed cards!
      for (const pil of this.pillars) {
        const col = pil.rainbow ? `hsl(${(this.time * 160 + pil.x) % 360}, 95%, 65%)` : pil.color;
        const pw = pil.rainbow ? 170 : 140;
        const g = ctx.createLinearGradient(pil.x - pw / 2, 0, pil.x + pw / 2, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = pil.alpha * (0.85 + Math.sin(this.time * 5 + pil.x) * 0.15);
        ctx.fillStyle = g;
        ctx.fillRect(pil.x - pw / 2, 70, pw, 540);
      }

      // Shockwave Rings
      for (const rg of this.rings) {
        const p = 1 - Math.max(0, rg.life / rg.maxLife);
        const r = rg.r + (rg.maxR - rg.r) * (1 - Math.pow(1 - p, 3));
        ctx.globalAlpha = (1 - p) * 0.9;
        ctx.strokeStyle = rg.color;
        ctx.lineWidth = Math.max(2, rg.lw * (1 - p * 0.6));
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Duelyst Explosion VFX
      if (window.MT.vfx) {
        ctx.globalCompositeOperation = 'source-over';
        for (const inst of this.activeVfx) window.MT.vfx.draw(ctx, inst);
        ctx.globalCompositeOperation = 'lighter';
      }

      // Flying Spark Streaks
      for (const s of this.sparks) {
        ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size;
        ctx.beginPath();
        ctx.moveTo(s.px, s.py);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }

      // Blinding Opening Flash
      if (this.flashAlpha > 0) {
        ctx.globalAlpha = this.flashAlpha;
        ctx.fillStyle = '#fff9e6';
        ctx.fillRect(0, 0, 1280, 720);
      }

      ctx.restore();
    }
  }

  // ─── Main v10 Game Controller ───
  class V10Game {
    constructor() {
      this.stageEl = document.getElementById('stage');
      this.tavern = new window.MT.TavernCanvas(document.getElementById('tavern-canvas'));
      this.battle = new window.MT.V10Battle(document.getElementById('battle-canvas'));
      this.packFx = new PackCeremonyFX(document.getElementById('pack-fx-canvas'));

      this.state = null;
      this.swapSlotIdx = -1; // For 2-tap relic slot reordering
      this.activePack = null; // Currently open ceremony pack state
      this.packTimers = [];
      this.pendingAlchemy = null;
      this.muted = false;

      this.bindGlobalEvents();
      this.fitStage();
      window.addEventListener('resize', () => this.fitStage());
    }

    fitStage() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const sc = Math.min(vw / 1280, vh / 720);
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
      const D = window.MT.V10_DATA;
      const starterRelicTpl = D.RELICS[0]; // 神锤碎甲 (+38伤) so player feels Relic Chain immediately on W1!
      this.state = {
        runSeed: Math.floor(Math.random() * 1000),
        wave: 1,
        hearts: 3,
        maxHearts: 3,
        gold: 12,
        phase: 'deal', // deal | battle | shop | victory | gameover
        roster: D.createStarterRoster(),
        drawPile: [],
        hand: [],         // 5 dealt heroes
        selectedIds: [],  // up to 3 uids selected for battle (or discard)
        discardsLeft: 2,
        relics: [
          { uid: 'r_start_1', tplId: starterRelicTpl.id, tpl: starterRelicTpl, edition: 'normal' }
        ],
        handLevels: {
          royal_triangle: 1, three_kind: 1, flush: 1, triangle: 1, pair: 1, high_card: 1
        },
        shop: null,
        rerollCost: 3,
        endless: false,
        stats: { peakHit: 0, totalPacks: 0, wavesCleared: 0 }
      };
      this.swapSlotIdx = -1;
      this.closeAllModals();
      this.dealNewHand();
      this.enterPhase('deal');
    }

    getMaxRelicSlots() {
      const negCount = this.state.relics.filter((r) => r.edition === 'negative').length;
      return 5 + negCount;
    }

    // ─── Deck Dealing (Non-Replacement Draw with Auto-Reshuffle) ───
    refillDrawPile(excludeUids = new Set()) {
      const pool = this.state.roster.filter((h) => !excludeUids.has(h.uid));
      // Fisher-Yates shuffle
      const arr = [...pool];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      this.state.drawPile = arr;
    }

    drawHeroes(count, excludeUids = new Set()) {
      const drawn = [];
      const seen = new Set(excludeUids);
      const maxAvail = Math.max(0, this.state.roster.length - seen.size);
      const target = Math.min(count, maxAvail);

      while (drawn.length < target) {
        if (this.state.drawPile.length === 0) {
          this.refillDrawPile(seen);
          if (this.state.drawPile.length === 0) break;
        }
        const cand = this.state.drawPile.pop();
        if (!cand || seen.has(cand.uid)) continue;
        // Refresh latest hero stats from roster
        const live = this.state.roster.find((r) => r.uid === cand.uid);
        if (!live) continue;
        seen.add(live.uid);
        drawn.push(live);
      }
      return drawn;
    }

    dealNewHand() {
      this.state.drawPile = [];
      this.state.hand = this.drawHeroes(5);
      this.state.discardsLeft = 2;
      // Auto-preselect the strongest 3-hero combo among the 5 dealt so the player immediately sees what hand is available!
      this.state.selectedIds = this.findBest3Uids(this.state.hand);
      this.syncTavernHeroes();
    }

    findBest3Uids(hand) {
      if (hand.length <= 3) return hand.map((h) => h.uid);
      const D = window.MT.V10_DATA;
      let bestScore = -1;
      let best = [hand[0].uid, hand[1].uid, hand[2].uid];
      for (let i = 0; i < hand.length; i++) {
        for (let j = i + 1; j < hand.length; j++) {
          for (let k = j + 1; k < hand.length; k++) {
            const sub = [hand[i], hand[j], hand[k]];
            const ev = D.evaluateHand(sub, this.state.handLevels);
            const score = ev.mult * 1000 + ev.bonus + sub.reduce((s, h) => s + h.atk, 0);
            if (score > bestScore) { bestScore = score; best = sub.map((h) => h.uid); }
          }
        }
      }
      return best;
    }

    discardAndRedraw() {
      if (this.state.phase !== 'deal') return;
      if (this.state.discardsLeft <= 0) { this.toast('本波换桌次数已用尽'); return; }

      // Discard whichever heroes are NOT selected (so you lock the ones you want to keep & redraw the rest!),
      // OR if 0 or 5 selected, redraw all 5!
      let keepUids = new Set(this.state.selectedIds);
      if (keepUids.size === 0 || keepUids.size >= this.state.hand.length) {
        keepUids = new Set();
      }
      const kept = this.state.hand.filter((h) => keepUids.has(h.uid));
      const need = Math.min(5, this.state.roster.length) - kept.length;
      if (need <= 0) { this.toast('请先取消选中想换掉的侠客'); return; }

      this.state.discardsLeft--;
      const exclude = new Set(this.state.hand.map((h) => h.uid));
      const replacements = this.drawHeroes(need, exclude);
      // If deck was tiny (e.g. 5 total), fallback to redrawing excluded ones
      if (replacements.length < need) {
        const extra = this.drawHeroes(need - replacements.length, new Set([...kept.map((h) => h.uid), ...replacements.map((h) => h.uid)]));
        replacements.push(...extra);
      }

      this.state.hand = [...kept, ...replacements];
      // Preserve kept selections and auto-fill up to 3 only if kept < 3
      this.state.selectedIds = kept.map((h) => h.uid).slice(0, 3);
      if (this.state.selectedIds.length < 3) {
        const auto = this.findBest3Uids(this.state.hand);
        for (const uid of auto) {
          if (this.state.selectedIds.length >= 3) break;
          if (!this.state.selectedIds.includes(uid)) this.state.selectedIds.push(uid);
        }
      }

      if (window.MT.sfx) window.MT.sfx.playChainDing(2, false);
      this.tavern.shake(5, 0.16);
      this.syncTavernHeroes();
      this.renderAll();
      this.toast(`换桌完成！剩余 ${this.state.discardsLeft} 次`);
    }

    toggleSelectHero(uid) {
      if (this.state.phase !== 'deal') return;
      const idx = this.state.selectedIds.indexOf(uid);
      if (idx >= 0) {
        this.state.selectedIds.splice(idx, 1);
      } else {
        if (this.state.selectedIds.length >= 3) {
          this.state.selectedIds.shift();
        }
        this.state.selectedIds.push(uid);
      }
      if (window.MT.sfx) window.MT.sfx.playChainDing(this.state.selectedIds.length, false);
      this.tavern.triggerTapFeedback(uid, '#ffd966');
      this.syncTavernHeroes();
      this.renderDealDock();
    }

    syncTavernHeroes() {
      const D = window.MT.V10_DATA;
      const list = this.state.phase === 'shop'
        ? this.state.hand.filter((h) => this.state.selectedIds.includes(h.uid)).slice(0, 3)
        : this.state.hand;
      const mercs = list.map((h) => ({
        id: h.uid,
        unitId: h.unitId,
        name: h.name,
        power: h.atk,
        effectivePower: h.atk,
        tier: 'A',
        factionColor: D.FACTIONS[h.faction].color,
        factionTag: D.FACTIONS[h.faction].short,
        roleTag: D.ROLES[h.role].short,
        redSeal: h.redSeal
      }));
      const assigned = this.state.phase === 'deal' ? new Set(this.state.selectedIds) : new Set();
      this.tavern.syncMercenaries(mercs, assigned);
    }

    // ─── Phase Switching ───
    enterPhase(phase) {
      this.state.phase = phase;
      const tavernView = document.getElementById('tavern-view');
      const battleView = document.getElementById('battle-view');
      const dealDock = document.getElementById('deal-dock');
      const shopDock = document.getElementById('shop-dock');
      const handMeter = document.getElementById('hand-meter-bar');

      if (phase === 'battle') {
        tavernView.classList.add('hidden');
        battleView.classList.remove('hidden');
      } else {
        battleView.classList.add('hidden');
        tavernView.classList.remove('hidden');
        dealDock.classList.toggle('hidden', phase !== 'deal');
        handMeter.classList.toggle('hidden', phase !== 'deal');
        shopDock.classList.toggle('hidden', phase !== 'shop');
        this.syncTavernHeroes();
        this.renderAll();
      }
    }

    // ─── Launch Zero-Intervention Auto-Battle! ───
    launchBattle() {
      if (this.state.phase !== 'deal') return;
      const D = window.MT.V10_DATA;
      const squad3 = this.state.selectedIds
        .map((uid) => this.state.hand.find((h) => h.uid === uid))
        .filter(Boolean);
      if (squad3.length < 3) {
        this.toast('请先选满 3 位侠客出战！');
        return;
      }

      const handEval = D.evaluateHand(squad3, this.state.handLevels);
      const bossCfg = D.getWaveBoss(this.state.wave, this.state.runSeed);
      this.enterPhase('battle');

      this.battle.play({
        squad3,
        handEval,
        relics: this.state.relics,
        maxRelicSlots: this.getMaxRelicSlots(),
        bossCfg,
        runCtx: {
          wave: this.state.wave,
          gold: this.state.gold,
          discardsLeft: this.state.discardsLeft,
          rosterSize: this.state.roster.length
        },
        onDone: (res) => this.handleBattleDone(res)
      });
    }

    handleBattleDone(res) {
      const D = window.MT.V10_DATA;
      const bossCfg = D.getWaveBoss(res.wave, this.state.runSeed);
      if (res.peakHit > this.state.stats.peakHit) this.state.stats.peakHit = res.peakHit;

      const interest = Math.min(5, Math.floor(this.state.gold / 5));
      let baseGold = 0;
      let speedBonus = 0;

      if (res.win) {
        baseGold = bossCfg.reward;
        speedBonus = res.roundsSaved;
        this.state.stats.wavesCleared++;
      } else {
        this.state.hearts = Math.max(0, this.state.hearts - 1);
        // GPT v9 Fix #2: Consolation advance payout (50% of wave reward scaled by boss damage, min 3G) so losses never soft-lock economy!
        baseGold = Math.max(3, Math.round(bossCfg.reward * Math.max(0.45, res.bossDamagePct)));
      }

      const totalEarned = baseGold + speedBonus + interest + (res.combatGold || 0);
      this.state.gold += totalEarned;

      this.showPayoutModal({
        win: res.win,
        wave: res.wave,
        bossName: res.bossName,
        handName: res.handName,
        handMult: res.handMult,
        peakHit: res.peakHit,
        totalTriggers: res.totalTriggers,
        baseGold,
        speedBonus,
        interest,
        combatGold: res.combatGold || 0,
        totalEarned,
        gameOver: !res.win && this.state.hearts <= 0,
        victory: res.win && res.wave === 8 && !this.state.endless
      });
    }

    showPayoutModal(info) {
      const modal = document.getElementById('payout-modal');
      const title = document.getElementById('po-title');
      const sub = document.getElementById('po-sub');
      const rows = document.getElementById('po-rows');
      const btn = document.getElementById('po-next-btn');

      if (info.gameOver) {
        title.textContent = `止步第 ${info.wave} 波 · 酒馆打烊`;
        title.className = 'po-title lose';
        sub.textContent = `最高单击 ${info.peakHit.toLocaleString()} · 秘宝连锁 ${info.totalTriggers} 次`;
        btn.textContent = '再来一局';
        btn.onclick = () => { modal.classList.add('hidden'); this.startNewRun(); };
      } else if (info.victory) {
        title.textContent = '★ 8波通关 · 镜湖传奇! ★';
        title.className = 'po-title win';
        sub.textContent = `以【${info.handName} ×${info.handMult}】斩落终末日蚀暴君！`;
        btn.textContent = '继续无尽模式 →';
        btn.onclick = () => {
          modal.classList.add('hidden');
          this.state.endless = true;
          this.advanceToShop();
        };
      } else {
        title.textContent = info.win ? `W${info.wave} 讨伐成功!` : `W${info.wave} 惜败 (生命 -1 ❤)`;
        title.className = `po-title ${info.win ? 'win' : 'lose'}`;
        sub.textContent = `${info.handName} ×${info.handMult} · 最高一击 ${info.peakHit.toLocaleString()} · 连锁 ${info.totalTriggers} 次`;
        btn.textContent = '进入黑市酒馆商店 →';
        btn.onclick = () => {
          modal.classList.add('hidden');
          this.advanceToShop(info.win);
        };
      }

      rows.innerHTML = `
        <div class="po-row"><span>${info.win ? '悬赏基础赏金' : '战损保底补贴'}</span><b>+${info.baseGold}G</b></div>
        ${info.speedBonus > 0 ? `<div class="po-row"><span>速通余合奖励</span><b>+${info.speedBonus}G</b></div>` : ''}
        <div class="po-row"><span>酒馆存款利息 (每5G+1)</span><b>+${info.interest}G</b></div>
        ${info.combatGold > 0 ? `<div class="po-row"><span>秘宝战中吸金</span><b>+${info.combatGold}G</b></div>` : ''}
        <div class="po-row total"><span>本波实得金币</span><b>+${info.totalEarned}G</b></div>
      `;

      modal.classList.remove('hidden');
    }

    advanceToShop(didWin = true) {
      if (didWin) this.state.wave++;
      this.state.rerollCost = 3;
      this.rollShopInventory();
      this.enterPhase('shop');
    }

    // ─── Shop Generation (3 Relics w/ Editions + 2 Booster Packs + 1 Planet Battle-Tome) ───
    rollShopInventory() {
      const D = window.MT.V10_DATA;
      const ownedIds = new Set(this.state.relics.map((r) => r.tplId));
      const pool = D.RELICS.filter((r) => !ownedIds.has(r.id));
      const shuffled = [...pool].sort(() => Math.random() - 0.5);

      const shopRelics = shuffled.slice(0, 3).map((tpl, idx) => {
        const edition = D.rollEdition(false);
        const ed = D.EDITIONS[edition];
        return {
          shopId: `sr_${Date.now()}_${idx}`,
          tplId: tpl.id,
          tpl,
          edition,
          cost: tpl.cost + ed.priceAdd,
          sold: false
        };
      });

      // Always offer 2 distinct Booster Packs (high excitement every shop!)
      const packOrder = [...D.PACKS].sort(() => Math.random() - 0.5).slice(0, 2);
      const shopPacks = packOrder.map((p, idx) => ({
        shopId: `sp_${Date.now()}_${idx}`,
        packId: p.id,
        tpl: p,
        cost: p.cost,
        sold: false
      }));

      // 1 Planet Battle-Tome (upgrades a Hand Type permanently, 0 relic slots!)
      const tomeHand = D.HAND_TYPES[Math.floor(Math.random() * 5)]; // Upgrade one of the 5 combo hands
      const shopTome = {
        shopId: `st_${Date.now()}`,
        handId: tomeHand.id,
        hand: tomeHand,
        cost: 4,
        sold: false
      };

      this.state.shop = { relics: shopRelics, packs: shopPacks, tome: shopTome };
    }

    rerollShop() {
      if (this.state.phase !== 'shop') return;
      if (this.state.gold < this.state.rerollCost) { this.toast('金币不足！'); return; }
      this.state.gold -= this.state.rerollCost;
      this.state.rerollCost = Math.min(7, this.state.rerollCost + 1);
      this.rollShopInventory();
      if (window.MT.sfx) window.MT.sfx.playChainDing(2, false);
      this.renderAll();
    }

    buyShopRelic(shopId) {
      const item = this.state.shop.relics.find((r) => r.shopId === shopId);
      if (!item || item.sold) return;
      if (this.state.gold < item.cost) { this.toast('金币不足！'); return; }
      const willFit = item.edition === 'negative' || this.state.relics.length < this.getMaxRelicSlots();
      if (!willFit) { this.toast('秘宝栏位已满！可点击顶部秘宝出售腾位'); return; }

      this.state.gold -= item.cost;
      item.sold = true;
      this.state.relics.push({
        uid: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        tplId: item.tplId,
        tpl: item.tpl,
        edition: item.edition
      });
      if (window.MT.sfx) window.MT.sfx.playChainDing(4, item.edition === 'polychrome' || item.tpl.cat === 'mult');
      this.renderAll();
      this.toast(`装备【${item.tpl.name}】！点击顶部两个秘宝可互换顺序`);
    }

    buyPlanetTome() {
      const t = this.state.shop && this.state.shop.tome;
      if (!t || t.sold) return;
      if (this.state.gold < t.cost) { this.toast('金币不足！'); return; }
      this.state.gold -= t.cost;
      t.sold = true;
      this.state.handLevels[t.handId] = (this.state.handLevels[t.handId] || 1) + 1;
      const lv = this.state.handLevels[t.handId];
      if (window.MT.sfx) window.MT.sfx.playChainDing(6, true);
      this.tavern.shake(8, 0.24);
      this.renderAll();
      this.toast(`战技酒谱生效！【${t.hand.name}】升至 Lv.${lv}（永久增倍）`);
    }

    buyBoosterPack(shopId) {
      const p = this.state.shop.packs.find((x) => x.shopId === shopId);
      if (!p || p.sold) return;
      if (this.state.gold < p.cost) { this.toast('金币不足！'); return; }
      this.state.gold -= p.cost;
      p.sold = true;
      this.state.stats.totalPacks++;
      this.renderAll();
      this.openPackCeremony(p.tpl);
    }

    // ─── SHOWSTOPPER: Full-Screen Booster Pack Opening Ceremony! ───
    clearPackTimers() {
      for (const id of this.packTimers) clearTimeout(id);
      this.packTimers = [];
    }

    generatePackChoices(packTpl) {
      const D = window.MT.V10_DATA;
      if (packTpl.id === 'pack_relic') {
        const owned = new Set(this.state.relics.map((r) => r.tplId));
        const pool = [...D.RELICS.filter((r) => !owned.has(r.id))].sort(() => Math.random() - 0.5);
        return pool.slice(0, 4).map((tpl, i) => {
          const edition = D.rollEdition(true); // Boosted special edition odds in packs!
          return { kind: 'relic', idx: i, tpl, edition, flipped: false };
        });
      }
      if (packTpl.id === 'pack_hero') {
        const pool = [...D.HEROES].sort(() => Math.random() - 0.5);
        return pool.slice(0, 4).map((tpl, i) => {
          const redSeal = Math.random() < 0.32;
          const bonusAtk = Math.random() < 0.45 ? 14 : 0;
          return { kind: 'hero', idx: i, tpl, redSeal, bonusAtk, flipped: false };
        });
      }
      // pack_alchemy (3 Tarot cards)
      const pool = [...D.ALCHEMY_CARDS].sort(() => Math.random() - 0.5);
      return pool.slice(0, 3).map((tpl, i) => ({ kind: 'alchemy', idx: i, tpl, flipped: false }));
    }

    openPackCeremony(packTpl) {
      this.clearPackTimers();
      this.pendingAlchemy = null;
      const choices = this.generatePackChoices(packTpl);
      this.activePack = { tpl: packTpl, choices, stage: 'charge' };

      const modal = document.getElementById('pack-ceremony-modal');
      const sealedWrap = document.getElementById('pack-sealed-stage');
      const revealWrap = document.getElementById('pack-reveal-stage');
      const targetWrap = document.getElementById('pack-target-stage');
      const env = document.getElementById('pack-foil-envelope');
      const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(packTpl.icon) : null;

      modal.classList.remove('hidden');
      sealedWrap.classList.remove('hidden');
      revealWrap.classList.add('hidden');
      targetWrap.classList.add('hidden');

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

      // Ascending anticipation chimes during 0.72s charge
      if (window.MT.sfx) {
        window.MT.sfx.playChainDing(1, false);
        this.packTimers.push(setTimeout(() => window.MT.sfx && window.MT.sfx.playChainDing(3, false), 230));
        this.packTimers.push(setTimeout(() => window.MT.sfx && window.MT.sfx.playChainDing(5, false), 460));
      }

      // Clicking envelope fast-forwards straight to tear-open (0 extra gold per GPT Fix #3!)
      env.onclick = () => this.tearOpenPack();
      this.packTimers.push(setTimeout(() => this.tearOpenPack(), 720));
    }

    tearOpenPack() {
      if (!this.activePack || this.activePack.stage !== 'charge') return;
      this.clearPackTimers();
      this.activePack.stage = 'burst';

      const env = document.getElementById('pack-foil-envelope');
      env.classList.add('tearing');
      this.packFx.triggerBurst(this.activePack.tpl.burstVfx);
      if (window.MT.sfx) window.MT.sfx.playChainDing(7, true);

      this.packTimers.push(setTimeout(() => this.showPackRevealCards(), 320));
    }

    showPackRevealCards() {
      if (!this.activePack) return;
      this.activePack.stage = 'reveal';

      document.getElementById('pack-sealed-stage').classList.add('hidden');
      const revealWrap = document.getElementById('pack-reveal-stage');
      revealWrap.classList.remove('hidden');

      const grid = document.getElementById('pack-cards-grid');
      const D = window.MT.V10_DATA;
      const choices = this.activePack.choices;

      grid.innerHTML = choices.map((c, idx) => {
        if (c.kind === 'relic') {
          const r = c.tpl;
          const ed = D.EDITIONS[c.edition];
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
          const h = c.tpl;
          const fac = D.FACTIONS[h.faction];
          const role = D.ROLES[h.role];
          const beamCol = c.redSeal ? '#ff5268' : fac.color;
          return `
            <div class="pcard-wrap ${c.redSeal ? 'ed-foil' : ''}" data-cidx="${idx}" data-beam="${beamCol}" data-rainbow="${c.redSeal ? '1' : '0'}">
              <div class="pcard-inner">
                <div class="pcard-back"><span>⚔</span></div>
                <div class="pcard-front hero-card" style="--fcol:${fac.color}">
                  <div class="pcard-top">
                    <span class="fac-chip" style="background:${fac.bg};color:${fac.color}">${fac.name}</span>
                    ${c.redSeal ? `<span class="ed-pill seal-pill">◈ 红印·2连动</span>` : `<span class="role-chip" style="color:${role.color}">${role.name}</span>`}
                  </div>
                  <div class="pcard-sprite-slot" data-unit="${h.unitId}"></div>
                  <div class="pcard-name">${c.redSeal ? '◈ ' : ''}${h.name}</div>
                  <div class="pcard-short">攻 ${h.atk + c.bonusAtk}${c.bonusAtk ? ` (+${c.bonusAtk})` : ''} · 血 ${h.hp}</div>
                  <div class="pcard-desc">${c.redSeal ? '<b style="color:#ff6b81">自带【红印】：出战自动攻击2次!</b>' : `加入酒馆花名册，助你凑齐【${fac.name}】同花!`}</div>
                  <div class="pcard-cta">点击招募入花名册</div>
                </div>
              </div>
            </div>`;
        }
        // Alchemy Tarot Card
        const al = c.tpl;
        const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(al.icon) : null;
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

      // Mount live animated Duelyst sprites onto hero pack cards
      grid.querySelectorAll('.pcard-sprite-slot').forEach((slot) => {
        const spr = window.MT.sprites.createDomSprite(slot.dataset.unit, { width: 96, height: 96 });
        if (spr) slot.appendChild(spr);
      });

      // Staggered 3D Flip Reveal + Vertical Rarity Light Pillars!
      const count = choices.length;
      const centerXs = count === 3 ? [380, 640, 900] : [250, 510, 770, 1030];
      const wraps = [...grid.querySelectorAll('.pcard-wrap')];

      wraps.forEach((el, i) => {
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
      const choice = this.activePack.choices[idx];
      if (!choice) return;
      const D = window.MT.V10_DATA;

      if (choice.kind === 'relic') {
        const willFit = choice.edition === 'negative' || this.state.relics.length < this.getMaxRelicSlots();
        if (!willFit) {
          this.toast('秘宝栏已满！请先关闭或点击【放弃本包 (+2G)】');
          return;
        }
        this.state.relics.push({
          uid: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
          tplId: choice.tpl.id,
          tpl: choice.tpl,
          edition: choice.edition
        });
        if (window.MT.sfx) window.MT.sfx.playChainDing(6, true);
        this.closePackCeremony();
        this.toast(`获得秘宝【${choice.tpl.name}】!`);
        return;
      }

      if (choice.kind === 'hero') {
        const inst = D.makeHeroInstance(choice.tpl, { redSeal: choice.redSeal, bonusAtk: choice.bonusAtk });
        this.state.roster.push(inst);
        if (window.MT.sfx) window.MT.sfx.playChainDing(5, choice.redSeal);
        this.closePackCeremony();
        this.toast(`招募【${inst.redSeal ? '◈红印·' : ''}${inst.name}】加入花名册！`);
        return;
      }

      // Alchemy Tarot
      const al = choice.tpl;
      if (!al.needsHero) {
        // al_midas: Double gold (cap +18G)
        const gain = Math.min(18, this.state.gold);
        this.state.gold += gain;
        if (window.MT.sfx) window.MT.sfx.playChainDing(6, true);
        this.closePackCeremony();
        this.toast(`点金黑市契生效！获得 +${gain}G！`);
        return;
      }

      // GPT Fix #1: Banish enforces roster.length >= 4 before removing 1 (always >= 3 remaining)
      if (al.id === 'al_banish' && this.state.roster.length <= 3) {
        this.toast('花名册至少需保留 3 名侠客，无法继续驱逐！');
        return;
      }

      // Open 1-tap Roster Target Picker right inside the ceremony!
      this.pendingAlchemy = al;
      this.renderAlchemyTargetPicker(al);
    }

    renderAlchemyTargetPicker(al) {
      const D = window.MT.V10_DATA;
      document.getElementById('pack-reveal-stage').classList.add('hidden');
      const targetWrap = document.getElementById('pack-target-stage');
      targetWrap.classList.remove('hidden');

      document.getElementById('pack-target-title').textContent = `选择【${al.name}】施展目标（花名册共 ${this.state.roster.length} 人）`;
      const grid = document.getElementById('pack-target-grid');
      grid.innerHTML = this.state.roster.map((h) => {
        const fac = D.FACTIONS[h.faction];
        const role = D.ROLES[h.role];
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
      const D = window.MT.V10_DATA;
      const idx = this.state.roster.findIndex((h) => h.uid === uid);
      if (idx < 0) return;
      const hero = this.state.roster[idx];

      if (al.id === 'al_red_seal') {
        hero.redSeal = true;
        this.toast(`【${hero.name}】已烙上永久红印（自动攻击2次）！`);
      } else if (al.id === 'al_shift_f') {
        // Find dominant faction in roster
        const counts = {};
        for (const h of this.state.roster) counts[h.faction] = (counts[h.faction] || 0) + 1;
        const topFac = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        hero.faction = topFac;
        this.toast(`【${hero.name}】已同化为【${D.FACTIONS[topFac].name}】阵营！`);
      } else if (al.id === 'al_clone') {
        const copy = { ...hero, uid: 'h_clone_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5) };
        this.state.roster.push(copy);
        this.toast(`成功克隆【${hero.name}】加入花名册！`);
      } else if (al.id === 'al_banish') {
        if (this.state.roster.length <= 3) { this.toast('至少需保留3名侠客！'); return; }
        this.state.roster.splice(idx, 1);
        this.toast(`已驱逐【${hero.name}】，花名册更精纯了！`);
      } else if (al.id === 'al_forge') {
        hero.atk += 28;
        hero.hp += 40;
        this.toast(`【${hero.name}】淬体成功，攻击 +28！`);
      }

      if (window.MT.sfx) window.MT.sfx.playChainDing(6, true);
      this.closePackCeremony();
    }

    // GPT Fix #3: Explicit Abandon Pack button gives +2G consolation (separate from animation fast-forward!)
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
      this.pendingAlchemy = null;
      this.packFx.stop();
      document.getElementById('pack-ceremony-modal').classList.add('hidden');
      this.renderAll();
    }

    // ─── Relic Rack Click: 2-Tap Reorder (Left -> Right!) or Sell ───
    handleRelicSlotClick(idx) {
      if (this.state.phase === 'battle') return;
      if (idx >= this.state.relics.length) {
        this.swapSlotIdx = -1;
        this.renderRelicRack();
        return;
      }
      if (this.swapSlotIdx === -1) {
        this.swapSlotIdx = idx;
      } else if (this.swapSlotIdx === idx) {
        this.swapSlotIdx = -1;
      } else {
        const tmp = this.state.relics[this.swapSlotIdx];
        this.state.relics[this.swapSlotIdx] = this.state.relics[idx];
        this.state.relics[idx] = tmp;
        this.swapSlotIdx = -1;
        if (window.MT.sfx) window.MT.sfx.playChainDing(3, false);
        this.toast('秘宝顺序已调换（战斗按从左到右连锁触发）');
      }
      this.renderRelicRack();
    }

    sellRelicAt(idx) {
      const r = this.state.relics[idx];
      if (!r) return;
      const refund = Math.max(2, Math.floor((r.tpl.cost || 4) * 0.5));
      this.state.relics.splice(idx, 1);
      this.state.gold += refund;
      this.swapSlotIdx = -1;
      if (window.MT.sfx) window.MT.sfx.playChainDing(1, false);
      this.renderAll();
      this.toast(`出售【${r.tpl.name}】回收 +${refund}G`);
    }

    // ─── Rendering All HUD & Docks ───
    renderAll() {
      this.renderTopHud();
      this.renderRelicRack();
      if (this.state.phase === 'deal') this.renderDealDock();
      if (this.state.phase === 'shop') this.renderShopDock();
    }

    renderTopHud() {
      document.getElementById('hud-wave').textContent = `W${this.state.wave}${this.state.endless ? ' 无尽' : '/8'}`;
      document.getElementById('hud-hearts').textContent = '❤'.repeat(this.state.hearts) + '♡'.repeat(Math.max(0, this.state.maxHearts - this.state.hearts));
      document.getElementById('hud-gold').textContent = `${this.state.gold}G`;
      document.getElementById('hud-roster-count').textContent = `${this.state.roster.length}`;
    }

    renderRelicRack() {
      const rack = document.getElementById('top-relic-rack');
      const D = window.MT.V10_DATA;
      const maxSlots = this.getMaxRelicSlots();
      let html = `<span class="rack-dir-tag" title="按从左到右顺序结算：+加伤放左，×倍率放右">左→右</span>`;

      for (let i = 0; i < maxSlots; i++) {
        const inst = this.state.relics[i];
        if (!inst) {
          html += `<div class="rack-slot empty"><span>空</span></div>`;
          continue;
        }
        const r = inst.tpl;
        const ed = D.EDITIONS[inst.edition] || D.EDITIONS.normal;
        const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(r.icon) : null;
        const isSel = this.swapSlotIdx === i;
        html += `
          <div class="rack-slot filled cat-${r.cat} ed-${inst.edition} ${isSel ? 'swap-active' : ''}" data-ridx="${i}" title="${r.name}：${r.desc}${ed.desc ? ' · ' + ed.desc : ''}">
            ${ed.badge ? `<i class="ed-pip ed-${inst.edition}">${ed.badge}</i>` : ''}
            ${iconUrl ? `<img src="${iconUrl}" alt="${r.name}" />` : ''}
            <span class="rack-badge">${r.short}</span>
            ${isSel ? `<button class="rack-sell-btn" data-sell="${i}">卖+${Math.max(2, Math.floor(r.cost * 0.5))}G</button>` : ''}
          </div>`;
      }
      rack.innerHTML = html;

      rack.querySelectorAll('.rack-slot.filled').forEach((el) => {
        el.onclick = (e) => {
          if (e.target.classList.contains('rack-sell-btn')) return;
          this.handleRelicSlotClick(Number(el.dataset.ridx));
        };
      });
      rack.querySelectorAll('.rack-sell-btn').forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          this.sellRelicAt(Number(btn.dataset.sell));
        };
      });
    }

    renderDealDock() {
      const D = window.MT.V10_DATA;
      const selectedHeroes = this.state.selectedIds
        .map((uid) => this.state.hand.find((h) => h.uid === uid))
        .filter(Boolean);
      const ev = D.evaluateHand(selectedHeroes, this.state.handLevels);
      const boss = D.getWaveBoss(this.state.wave, this.state.runSeed);

      // Live Hand Combo Meter Bar
      const meter = document.getElementById('hand-meter-bar');
      if (ev.ready) {
        meter.className = `hand-meter-bar ready tier-${ev.hand.id}`;
        meter.innerHTML = `
          <div class="hm-left">
            <span class="hm-tag" style="color:${ev.hand.color}">${ev.hand.name} Lv.${ev.lv}</span>
            <span class="hm-mult" style="background:${ev.hand.color}">×${ev.mult}</span>
            <span class="hm-bonus">+${ev.bonus}伤</span>
            <span class="hm-perk">${ev.hand.perk}</span>
          </div>
          <div class="hm-boss">下战: <b>${boss.name}</b> <span>${boss.maxHp.toLocaleString()} HP</span></div>
        `;
      } else {
        meter.className = 'hand-meter-bar';
        meter.innerHTML = `
          <div class="hm-left">
            <span class="hm-tag">已选 ${ev.count}/3 位出战侠客</span>
            <span class="hm-perk">点击下方卡牌凑【同阵营三连】【铁三角】或【同名双煞】</span>
          </div>
          <div class="hm-boss">下战: <b>${boss.name}</b> <span>${boss.maxHp.toLocaleString()} HP</span></div>
        `;
      }

      // Discard button
      const discBtn = document.getElementById('btn-discard');
      const unselectedCount = this.state.hand.length - this.state.selectedIds.length;
      discBtn.disabled = this.state.discardsLeft <= 0;
      discBtn.innerHTML = `
        <span class="wing-title">换桌重抽</span>
        <span class="wing-sub">剩 ${this.state.discardsLeft} 次 · ${unselectedCount > 0 && unselectedCount < this.state.hand.length ? `换未选${unselectedCount}人` : '全换5人'}</span>
      `;

      // Launch Battle button
      const fightBtn = document.getElementById('btn-fight');
      fightBtn.disabled = !ev.ready;
      fightBtn.innerHTML = `
        <span class="wing-title">推门迎战 W${this.state.wave}</span>
        <span class="wing-sub">${ev.ready ? `${ev.hand.name} ×${ev.mult}` : `还差 ${3 - ev.count} 人`}</span>
      `;

      // 5 Dealt Hero Cards
      const listEl = document.getElementById('deal-cards-row');
      listEl.innerHTML = this.state.hand.map((h) => {
        const fac = D.FACTIONS[h.faction];
        const role = D.ROLES[h.role];
        const selIdx = this.state.selectedIds.indexOf(h.uid);
        const isSel = selIdx >= 0;
        return `
          <button class="hero-hand-card ${isSel ? 'selected' : ''} ${h.redSeal ? 'has-seal' : ''}" data-huid="${h.uid}" style="--fcol:${fac.color};--fbg:${fac.bg}">
            <div class="hhc-top">
              <span class="hhc-fac">${fac.name}</span>
              <span class="hhc-role" style="color:${role.color}">${role.name}</span>
            </div>
            <div class="hhc-sprite" data-unit="${h.unitId}"></div>
            <div class="hhc-name">${h.redSeal ? '◈' : ''}${h.name}</div>
            <div class="hhc-atk">攻 ${h.atk}${h.redSeal ? ' · 2连动' : ''}</div>
            ${isSel ? `<span class="hhc-pick-badge">出战 #${selIdx + 1}</span>` : ''}
          </button>`;
      }).join('');

      listEl.querySelectorAll('.hhc-sprite').forEach((s) => {
        const sp = window.MT.sprites.createDomSprite(s.dataset.unit, { width: 72, height: 64 });
        if (sp) s.appendChild(sp);
      });

      listEl.querySelectorAll('.hero-hand-card').forEach((btn) => {
        btn.onclick = () => this.toggleSelectHero(btn.dataset.huid);
      });
    }

    renderShopDock() {
      const D = window.MT.V10_DATA;
      const sh = this.state.shop;
      if (!sh) return;

      const rerollBtn = document.getElementById('btn-shop-reroll');
      rerollBtn.innerHTML = `<span class="wing-title">刷新黑市</span><span class="wing-sub">${this.state.rerollCost}G</span>`;
      rerollBtn.disabled = this.state.gold < this.state.rerollCost;

      const nextBtn = document.getElementById('btn-shop-next');
      nextBtn.innerHTML = `<span class="wing-title">发牌迎战 W${this.state.wave}</span><span class="wing-sub">返回酒馆发牌 →</span>`;

      // 3 Single Relics
      const relicsRow = document.getElementById('shop-relics-row');
      relicsRow.innerHTML = sh.relics.map((item) => {
        const r = item.tpl;
        const ed = D.EDITIONS[item.edition];
        const iconUrl = window.MT.vfx ? window.MT.vfx.getIconUrl(r.icon) : null;
        return `
          <button class="shop-card relic-sc cat-${r.cat} ed-${item.edition} ${item.sold ? 'sold' : ''}" data-srid="${item.shopId}" title="${r.name}：${r.desc}${ed.desc ? ' · ' + ed.desc : ''}">
            <div class="sc-top">
              <span class="sc-cat">${r.cat === 'mult' ? '×倍' : r.cat === 'vfx' ? '⚡效' : '+伤'}</span>
              ${ed.badge ? `<span class="ed-pill sm ed-${item.edition}">${ed.badge}</span>` : ''}
              <span class="sc-price">${item.sold ? '已购' : `${item.cost}G`}</span>
            </div>
            <div class="sc-ico">${iconUrl ? `<img src="${iconUrl}" alt="${r.name}" />` : ''}</div>
            <div class="sc-name">${r.name}</div>
            <div class="sc-short">${r.short}</div>
          </button>`;
      }).join('');

      relicsRow.querySelectorAll('.relic-sc').forEach((btn) => {
        btn.onclick = () => this.buyShopRelic(btn.dataset.srid);
      });

      // 2 Booster Packs + 1 Planet Battle-Tome
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

      const t = sh.tome;
      const tIcon = window.MT.vfx ? window.MT.vfx.getIconUrl(t.hand.icon) : null;
      const curLv = this.state.handLevels[t.handId] || 1;
      const tomeHtml = `
        <button class="shop-card tome-sc ${t.sold ? 'sold' : ''}" id="btn-buy-tome" title="永久升级【${t.hand.name}】倍率+${t.hand.multPerLv}×、伤害+${t.hand.bonusPerLv}，不占秘宝栏！">
          <div class="sc-top"><span class="sc-cat">酒谱</span><span class="sc-price">${t.sold ? '已读' : `${t.cost}G`}</span></div>
          <div class="sc-ico">${tIcon ? `<img src="${tIcon}" alt="${t.hand.name}" />` : ''}</div>
          <div class="sc-name">${t.hand.short}谱</div>
          <div class="sc-short">Lv.${curLv}→${curLv + 1}</div>
        </button>`;

      packsRow.innerHTML = packsHtml + tomeHtml;
      packsRow.querySelectorAll('.pack-sc').forEach((btn) => {
        btn.onclick = () => this.buyBoosterPack(btn.dataset.spid);
      });
      const tomeBtn = document.getElementById('btn-buy-tome');
      if (tomeBtn) tomeBtn.onclick = () => this.buyPlanetTome();
    }

    // ─── Roster & Hand Guide Modal ───
    openRosterModal(tab = 'roster') {
      const D = window.MT.V10_DATA;
      const modal = document.getElementById('roster-modal');
      modal.classList.remove('hidden');

      // Faction summary pills
      const counts = {};
      for (const h of this.state.roster) counts[h.faction] = (counts[h.faction] || 0) + 1;
      document.getElementById('rm-summary').innerHTML = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([fid, c]) => `<span class="rm-fac-pill" style="background:${D.FACTIONS[fid].bg};color:${D.FACTIONS[fid].color}">${D.FACTIONS[fid].name} ×${c}</span>`)
        .join('');

      const body = document.getElementById('rm-body');
      document.getElementById('rm-tab-roster').classList.toggle('active', tab === 'roster');
      document.getElementById('rm-tab-hands').classList.toggle('active', tab === 'hands');

      if (tab === 'hands') {
        body.innerHTML = `<div class="rm-hands-list">` + D.HAND_TYPES.map((ht) => {
          const lv = this.state.handLevels[ht.id] || 1;
          const mult = +(ht.baseMult + (lv - 1) * ht.multPerLv).toFixed(2);
          const bonus = ht.baseBonus + (lv - 1) * ht.bonusPerLv;
          return `
            <div class="rm-hand-row">
              <b style="color:${ht.color}">${ht.name}</b>
              <span class="rm-lv">Lv.${lv}</span>
              <span class="rm-mult" style="color:${ht.color}">×${mult}</span>
              <span class="rm-bonus">+${bonus}伤</span>
              <span class="rm-perk">${ht.perk}</span>
            </div>`;
        }).join('') + `</div>`;
      } else {
        body.innerHTML = `<div class="rm-roster-grid">` + this.state.roster.map((h) => {
          const fac = D.FACTIONS[h.faction];
          const role = D.ROLES[h.role];
          return `
            <div class="rm-hero-tile" style="--fcol:${fac.color}">
              <div class="rm-spr" data-unit="${h.unitId}"></div>
              <div class="rm-hname">${h.redSeal ? '◈' : ''}${h.name}</div>
              <div class="rm-htags"><span style="color:${fac.color}">${fac.name}</span> · <span style="color:${role.color}">${role.name}</span> · 攻${h.atk}</div>
            </div>`;
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
      // Clicking heroes directly on Indoor Tavern Canvas selects/deselects them!
      const tc = document.getElementById('tavern-canvas');
      tc.addEventListener('pointerdown', (e) => {
        if (this.state.phase !== 'deal') return;
        const rect = tc.getBoundingClientRect();
        const sx = ((e.clientX - rect.left) / rect.width) * 1280;
        const sy = ((e.clientY - rect.top) / rect.height) * 720;
        const hit = this.tavern.actors.find((a) => Math.abs(a.x - sx) < 62 && sy >= a.y - 135 && sy <= a.y + 38);
        if (hit) this.toggleSelectHero(hit.merc.id);
      });

      document.getElementById('btn-discard').onclick = () => this.discardAndRedraw();
      document.getElementById('btn-fight').onclick = () => this.launchBattle();
      document.getElementById('btn-shop-reroll').onclick = () => this.rerollShop();
      document.getElementById('btn-shop-next').onclick = () => {
        this.dealNewHand();
        this.enterPhase('deal');
      };

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

      // Battle 1x / 2x Speed Toggle (ONLY control in battle — zero intervention!)
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
    const game = new V10Game();
    window.MT.game = game;
    game.init();
  });
})();
