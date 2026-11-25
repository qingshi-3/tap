// v14.0 Mirror-Lake Pixel Battle Stage & Event-Driven Theater
// 100% authentic Eclipse Mirror-Lake backdrop, stone bridge, live reflections,
// Pixelfx BattleWeather, and proper sprites.drawUnit() Duelyst rendering!
(function () {
  window.MT = window.MT || {};

  const BW = 1280;
  const BH = 720;
  const VW = 320;
  const VH = 180;
  const BRIDGE_VY = 104;
  const BRIDGE_Y = BRIDGE_VY * 4;     // 416px
  const LAKE_Y = (BRIDGE_VY + 8) * 4; // 448px

  const SLOT_X = [225, 405, 585];
  const BOSS_X = 955;

  const ECLIPSE_PALETTES = {
    default: { skyTop: '#3e1c4a', skyMid: '#8a3560', skyLow: '#d96c84', corona1: '#a82c58', corona2: '#ff6e8e', cloudDark: '#b84b6a', cloudMid: '#ea7b8e', cloudHi: '#ffc2cc', ruinDark: '#3f384f', ruinMid: '#5d5370', ruinHi: '#827699' },
    ice:     { skyTop: '#241a4a', skyMid: '#5c2e6e', skyLow: '#b85c94', corona1: '#7e308c', corona2: '#eb78d4', cloudDark: '#7a3c7c', cloudMid: '#bf68a8', cloudHi: '#f5b8e2', ruinDark: '#34334d', ruinMid: '#504e70', ruinHi: '#7a789e' },
    dark:    { skyTop: '#2d123d', skyMid: '#6e2159', skyLow: '#c24874', corona1: '#941e58', corona2: '#ff528c', cloudDark: '#94315e', cloudMid: '#d65e83', cloudHi: '#ffb0c8', ruinDark: '#362e47', ruinMid: '#54486b', ruinHi: '#7b6c96' }
  };

  function hash2(x, y, seed = 1) {
    let n = Math.imul(x + 31, 374761393) + Math.imul(y + 19, 668265263) + Math.imul(seed, 1442695041);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  const PROP_PAL = {
    'K': '#090712', 'I': '#1f2336', 'i': '#3d4563', 's': '#7c89b0',
    'C': '#2289b8', 'c': '#58d4ff', 'W': '#f0fdff',
    'S': '#383d59', 'z': '#5a6385', 'Z': '#8e99bf',
    'O': '#2e293d', 'o': '#524966', 'h': '#7b6f94',
    'V': '#a34cff', 'v': '#e6b8ff'
  };

  const PROPS = {
    cyanLamp: [
      '......K......', '.....KsK.....', '....KisiK....', '...KiCCciK...',
      '..KiCWWWCiK..', '..KiCWWWCiK..', '..KiCWWWCiK..', '...KiCCciK...',
      '....KiiiK....', '.....KiK.....', '....KisiK....', '.....KiK.....',
      '.....KiK.....', '.....KiK.....', '.....KiK.....', '.....KiK.....',
      '.....KiK.....', '.....KiK.....', '.....KiK.....', '.....KiK.....',
      '.....KiK.....', '.....KiK.....', '.....KiK.....', '.....KiK.....',
      '.....KiK.....', '.....KiK.....', '.....KiK.....', '.....KiK.....',
      '.....KiK.....', '.....KiK.....', '.....KiK.....', '.....KiK.....',
      '.....KiK.....', '.....KiK.....', '....KisiK....', '...KizSziK...',
      '...KzSSSzK...', '..KzZSSSZzK..', '..KKKKKKKKK..'
    ],
    floatCrystal: [
      '....K....', '...KCK...', '..KCcWK..', '..KCcWK..', '.KCccWWK.',
      '.KCccWWK.', 'KCcccWWcK', 'KCcccWWcK', 'KCccWWccK', '.KCcWccK.',
      '.KCccccK.', '..KCccK..', '..KCCcK..', '...KCK...', '....K....'
    ],
    floatShard: [
      '..KKKKK..', '.KOhhhoK.', '.KOhhooK.', 'KOhhoOOK.', 'KOhooOOK.',
      '.KOooOOK.', '.KOOoOK..', '..KOOOK..', '..KOOOK..', '...KOOK..', '...KOK...', '....K....'
    ],
    arcanePrism: [
      '.KKKKKKKKKKKKK.', 'KhhhooooooooohK', 'KhOoKKKKKKKKoOK', '.KhOKVVVVVVKoK.',
      '.KhOKVvvvvVKoK.', '..KhOKvWWvKoK..', '..KhOKvWWvKoK..', '...KhOKvvKoK...',
      '...KhOKVVKoK...', '....KhOKKoK....', '....KhOOoK.....', '.....KhOK......',
      '.....KOOK......', '......KK.......'
    ]
  };

  // Crisp Pixel Glyphs for Canvas (ZERO system emojis!)
  const GLYPH_MAT = {
    atk:    ['......WW', '.....WWY', '....WWY.', '...WWY..', '.YYWY...', '..YY....', '.B.Y....', 'B.......'],
    shield: ['.BBBBBB.', 'BCCCCCCB', 'BCWCCCCB', 'BCWCCCCB', 'BCCCCCCB', '.BCCCCB.', '..BCCB..', '...BB...'],
    poison: ['...GG...', '..GGGG..', '.GLLLLG.', '.GLLWLG.', '.GGGGGG.', '..GGGG..', '...GG...', '........'],
    frost:  ['...CC...', '.C.WW.C.', '..CWWC..', 'CWWWWWWC', '..CWWC..', '.C.WW.C.', '...CC...', '........'],
    gold:   ['..YYYY..', '.YWWWWY.', 'YWWYYWWY', 'YWYYYYWY', 'YWYYYYWY', 'YWWYYWWY', '.YYYYYY.', '..YYYY..'],
    skull:  ['..WWWW..', '.WWWWWW.', 'WWKWWKWW', 'WWWWWWWW', '.WWKKWW.', '..WWWW..', '..W.W.W.', '........'],
    flame:  ['....R...', '...RR...', '..ROOR..', '.ROYYOR.', '.ROYYOR.', '..ROOR..', '...RR...', '........'],
    vuln:   ['R......R', '.R....R.', '..RYYR..', '...YY...', '...YY...', '..RYYR..', '.R....R.', 'R......R'],
    stun:   ['...YY...', '...YY...', 'Y..WW..Y', '.YYWWYY.', '..WWWW..', '.YY..YY.', 'Y......Y', '........'],
    thorns: ['...GG...', '..GLLG..', 'G..GG..G', '.GGLLGG.', '..GGGG..', '.G.GG.G.', '...GG...', '........']
  };
  const GLYPH_COL = {
    W: '#ffffff', Y: '#ffe266', B: '#3b82f6', C: '#7be8ff',
    G: '#34d399', L: '#a7f3d0', K: '#090612', R: '#ff4769', O: '#ff9a2e'
  };

  function drawPixelGlyph(ctx, kind, x, y, px = 2) {
    const mat = GLYPH_MAT[kind];
    if (!mat) return 0;
    ctx.save();
    for (let r = 0; r < mat.length; r++) {
      const row = mat[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        ctx.fillStyle = '#07040f';
        ctx.fillRect(Math.round(x + c * px) - 1, Math.round(y + r * px) - 1, px + 2, px + 2);
      }
    }
    for (let r = 0; r < mat.length; r++) {
      const row = mat[r];
      for (let c = 0; c < row.length; c++) {
        const col = GLYPH_COL[row[c]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(x + c * px), Math.round(y + r * px), px, px);
      }
    }
    ctx.restore();
    return 8 * px;
  }

  function drawMatrix(ctx, rows, ox, oy) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const col = PROP_PAL[row[x]];
        if (col) { ctx.fillStyle = col; ctx.fillRect(ox + x, oy + y, 1, 1); }
      }
    }
  }

  class V14BattleStage {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.canvas.width = BW;
      this.canvas.height = BH;
      this.overlayCanvas = document.getElementById('battle-overlay-canvas');
      this.overlayCtx = this.overlayCanvas ? this.overlayCanvas.getContext('2d') : null;
      if (this.overlayCanvas) {
        this.overlayCanvas.width = BW;
        this.overlayCanvas.height = BH;
      }

      this.sceneBuf = document.createElement('canvas');
      this.sceneBuf.width = BW;
      this.sceneBuf.height = BRIDGE_Y + 24;
      this.sceneCtx = this.sceneBuf.getContext('2d');

      this.bgCache = {};
      this.running = false;
      this.rafId = null;
      this.lastTs = 0;
      this.time = 0;
      this.idleTime = 0;
      this.speed = 1;

      this.hitstop = 0;
      this.shakeTime = 0;
      this.shakeAmp = 0;
      this.screenFlash = null;

      this.biome = 'default';
      this.atmosphere = null;
      this.boss = null;
      this.slotUnits = [null, null, null];
      this.slot3Locked = false;
      this.bossIntent = null;
      this.bossPoison = 0;
      this.bossVuln = false;
      this.bossStunned = false;

      this.popups = [];
      this.particles = [];
      this.activeVfx = [];
      this.projectiles = [];
      this.synergyLinks = [];
      this.cutIn = null;
      this.synergyLinks = [];
      this.cutIn = null;
      this.dragArrow = null;
      this.inspectedSlotIdx = -1;
      this.relationArrows = [];
      this.onSlotClick = null;
      this.onEmptyClick = null;
      this.ambientMotes = Array.from({ length: 34 }, (_, i) => ({
        x: Math.random() * BW, y: 40 + Math.random() * 380,
        vx: (Math.random() - 0.5) * 18, vy: -8 - Math.random() * 14,
        phase: i * 1.15, size: i % 3 === 0 ? 5 : 3
      }));
      this._bindCanvasClick();
    }

    _bindCanvasClick() {
      if (!this.canvas || this._clickBound) return;
      this._clickBound = true;
      this.canvas.addEventListener('click', (ev) => {
        if (!this.running) return;
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const mx = ((ev.clientX - rect.left) / rect.width) * BW;
        const my = ((ev.clientY - rect.top) / rect.height) * BH;
        if (this.onSlotClick && my >= BRIDGE_Y - 125 && my <= BRIDGE_Y + 38) {
          for (let i = 0; i < 3; i++) {
            if (Math.abs(mx - SLOT_X[i]) <= 68) {
              this.onSlotClick(i);
              return;
            }
          }
        }
        if (this.onEmptyClick) this.onEmptyClick();
      });
    }

    triggerCutIn(title, sub, color = '#ffd966') {
      this.cutIn = { title, sub, color, life: 0.52, maxLife: 0.52 };
    }

    syncSynergyLinks(links) {
      this.synergyLinks = Array.isArray(links) ? links : [];
    }

    setDragArrow(cfg) {
      this.dragArrow = cfg || null;
    }

    setInspectedSlot(slotIdx, arrows = [], relatedMeta = null) {
      this.inspectedSlotIdx = typeof slotIdx === 'number' ? slotIdx : -1;
      this.relationArrows = Array.isArray(arrows) ? arrows : [];
      this.relatedMeta = relatedMeta || { slots: new Set(), boss: false, slotColors: {} };
    }

    setUnitDragPos(slotIdx, x, y, targetSlotIdx = -1, isRecallZone = false) {
      const u = this.slotUnits[slotIdx];
      if (!u) return;
      if (x === null || y === null) {
        u.x = u.homeX;
        u.y = BRIDGE_Y;
        u.isDragging = false;
        u.isRecallZone = false;
        this.unitDragTarget = -1;
      } else {
        u.x = x;
        u.y = y;
        u.isDragging = true;
        u.isRecallZone = Boolean(isRecallZone);
        this.unitDragTarget = targetSlotIdx;
      }
    }

    start(bossCfg, biome = 'default') {
      this.stop();
      this.biome = biome;
      this.time = 0;
      this.hitstop = 0;
      this.shakeTime = 0;
      this.screenFlash = null;
      this.popups = [];
      this.particles = [];
      this.activeVfx = [];
      this.projectiles = [];
      this.synergyLinks = [];
      this.cutIn = null;
      this.slotUnits = [null, null, null];
      this.slot3Locked = false;
      this.bossPoison = 0;
      this.bossVuln = false;
      this.bossStunned = false;

      if (window.MT.BattleWeather) {
        this.atmosphere = new window.MT.BattleWeather();
      }

      this.boss = {
        unitId: bossCfg.unitId,
        name: bossCfg.name,
        scale: 2.75,
        x: BOSS_X,
        homeX: BOSS_X,
        y: BRIDGE_Y,
        knockX: 0,
        flash: 0,
        anim: 'idle',
        animTimer: 0,
        phase: 0.6,
        alive: true
      };

      this.running = true;
      this.lastTs = performance.now();
      this.loop(this.lastTs);
    }

    stop() {
      if (this.atmosphere) { this.atmosphere.dispose(); this.atmosphere = null; }
      this.running = false;
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    }

    setSpeed(spd) {
      this.speed = spd;
    }

    buildUnitCompactChips(h) {
      const chips = [];
      const multTag = (h.redSeal ? '×2' : '') + (h.glassBlade ? '×2' : '');
      if (h.atk > 0) chips.push({ icon: 'atk', text: `${h.atk}${multTag}`, color: '#ffe266' });
      const shd = (h.shieldVal || 0) + (h.ironPlated ? 18 : 0);
      if (shd > 0) chips.push({ icon: 'shield', text: `+${shd}`, color: '#7be8ff' });
      if (h.applyPoison > 0) chips.push({ icon: 'poison', text: `+${h.applyPoison}`, color: '#7ef28a' });
      if (h.applyFrost > 0) chips.push({ icon: 'frost', text: `+${h.applyFrost}`, color: '#9ef2ff' });
      const gold = (h.goldOnStrike || 0) + (h.greedBadge ? 2 : 0);
      if (gold > 0) chips.push({ icon: 'gold', text: `+${gold}`, color: '#ffd966' });
      if (h.applyVuln) chips.push({ icon: 'vuln', text: '易伤×1.4', color: '#ff9666' });
      if (h.retriggerLeft) chips.push({ text: '再动←', color: '#ffe89e' });
      if (h.noAttackAmpRight) chips.push({ text: `→×${h.noAttackAmpRight}`, color: '#ff9666' });
      if (h.inheritLeftRatio) chips.push({ text: '继承←', color: '#ffb8e6' });
      if (h.devourLeftRatio) chips.push({ text: '吞噬←', color: '#d896ff' });
      if (h.followPrev) chips.push({ text: '补刀', color: '#7be8ff' });
      if (h.emptySlotMult) chips.push({ text: `孤狼×${h.emptySlotMult}`, color: '#ff8a5c' });
      if (h.multPerRemainingHand) chips.push({ text: '留手×', color: '#7ef28a' });
      if (h.selfHpCost) chips.push({ text: `-${h.selfHpCost}血`, color: '#ff6e8a' });
      if (h.healOnStrike) chips.push({ text: `+${h.healOnStrike}血`, color: '#7ef28a' });
      if (h.gambleChance) chips.push({ text: '赌倍', color: '#ffd966' });
      return chips.slice(0, 3);
    }

    syncSlots(slots, opts = {}) {
      this.slot3Locked = Boolean(opts.slot3Locked);
      for (let i = 0; i < 3; i++) {
        const h = slots[i];
        if (!h) {
          this.slotUnits[i] = null;
        } else {
          const prev = this.slotUnits[i];
          const effectChips = this.buildUnitCompactChips(h);
          if (prev && prev.uid === h.uid) {
            prev.atk = h.atk;
            prev.tier = h.tier || 'C';
            prev.redSeal = h.redSeal;
            prev.glassBlade = h.glassBlade;
            prev.effectChips = effectChips;
          } else {
            this.slotUnits[i] = {
              uid: h.uid,
              unitId: h.unitId,
              name: h.shortName || h.name,
              tier: h.tier || 'C',
              atk: h.atk,
              redSeal: h.redSeal,
              glassBlade: h.glassBlade,
              effectChips,
              x: SLOT_X[i],
              homeX: SLOT_X[i],
              y: BRIDGE_Y,
              scale: 2.08,
              anim: 'idle',
              animTimer: 0,
              flash: 0,
              phase: i * 0.45
            };
          }
        }
      }
    }

    syncBossState(state, intent) {
      this.bossIntent = intent || null;
      this.bossPoison = state.bossPoison || 0;
      this.bossVuln = Boolean(state.bossVuln);
      this.bossStunned = Boolean(state.bossStunned);
      if (this.boss) {
        this.boss.alive = state.bossHp > 0;
      }
    }

    triggerShake(amp = 8, dur = 0.16) {
      this.shakeAmp = Math.max(this.shakeAmp, amp);
      this.shakeTime = Math.max(this.shakeTime, dur);
    }

    triggerFlash(color = '#ffffff', alpha = 0.28, dur = 0.14) {
      this.screenFlash = { color, alpha, dur, maxDur: dur };
    }

    spawnPopup(x, y, text, color = '#ffd966', size = 28) {
      this.popups.push({
        x: x + (Math.random() - 0.5) * 32,
        y,
        vy: -78,
        text,
        color,
        size,
        life: 0.95,
        maxLife: 0.95
      });
    }

    spawnParticles(x, y, color, count = 14) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 70 + Math.random() * 210;
        this.particles.push({
          x, y, px: x, py: y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 60,
          size: 4 + Math.floor(Math.random() * 5),
          color,
          life: 0.35 + Math.random() * 0.35,
          maxLife: 0.7
        });
      }
    }

    spawnVfx(vfxId, x, y, scale = 1.65) {
      if (!vfxId || !window.MT.vfx || !window.MT.vfx.spawn) return;
      const inst = window.MT.vfx.spawn(vfxId, x, y, { scale });
      if (inst) this.activeVfx.push(inst);
    }

    spawnProjectile(fromX, fromY, toX, toY, color = '#6be5ff') {
      this.projectiles.push({ x: fromX, y: fromY, fromX, fromY, toX, toY, t: 0, dur: 0.22, color });
    }

    async playEvents(events, hooks = {}) {
      const wait = (ms) => new Promise((res) => setTimeout(res, Math.max(25, Math.round(ms / this.speed))));
      const audio = window.MT.audio;
      let pitchStep = 0;

      for (const ev of events) {
        if (!this.running) break;

        if (ev.type === 'strike') {
          pitchStep += 1;
          const actor = (ev.slotIdx >= 0 && ev.slotIdx < 3) ? this.slotUnits[ev.slotIdx] : null;
          if (actor && !ev.isKnife && !ev.isGhost) {
            actor.anim = 'attack';
            actor.animTimer = 0.42;
            actor.x = actor.homeX + 115;
          } else if (ev.isKnife) {
            this.spawnProjectile(320, BRIDGE_Y - 60, BOSS_X - 40, BRIDGE_Y - 90, '#6be5ff');
          } else if (ev.isGhost) {
            this.spawnPopup(SLOT_X[2], BRIDGE_Y - 120, `影子补打: ${ev.heroName}`, '#d48cff', 22);
          }

          if (ev.relicSteps && ev.relicSteps.length > 0 && hooks.onRelicPulse) {
            for (const step of ev.relicSteps) hooks.onRelicPulse(step.relicUid, step.label);
          }

          if (audio) {
            const baseFreq = Math.min(880, 260 + pitchStep * 42);
            audio.tone(baseFreq, 0.09, 'triangle', 0.11, 0, baseFreq * 1.25);
          }

          await wait(ev.isKnife ? 110 : 170);

          if (this.boss) {
            this.boss.knockX = 22;
            this.boss.flash = 0.16;
          }
          this.hitstop = ev.dmg >= 200 ? 0.05 : 0.025;
          this.triggerShake(ev.dmg >= 250 ? 11 : 6, 0.14);
          this.spawnVfx(ev.vfx || 'fx_crossslash', BOSS_X, BRIDGE_Y - 85, ev.dmg >= 250 ? 1.85 : 1.45);
          this.spawnParticles(BOSS_X, BRIDGE_Y - 80, ev.isKnife ? '#6be5ff' : '#ffd966', ev.dmg >= 200 ? 18 : 10);
          this.spawnPopup(
            BOSS_X,
            BRIDGE_Y - 135,
            `${ev.isKnife ? '🗡' : ''}-${ev.dmg}`,
            ev.isRetrigger ? '#ff9a2e' : '#ffd966',
            ev.dmg >= 260 ? 36 : 28
          );
          if (hooks.onSyncHud) hooks.onSyncHud();
          await wait(ev.isKnife ? 90 : 150);
          if (actor) actor.x = actor.homeX;
        } else if (ev.type === 'amp_cast') {
          const actor = this.slotUnits[ev.slotIdx];
          if (actor) {
            actor.flash = 0.25;
            this.spawnPopup(actor.homeX, BRIDGE_Y - 115, `✦ ${ev.label}`, '#ffd966', 24);
          }
          if (audio) audio.tone(520, 0.12, 'sine', 0.1, 0, 780);
          await wait(160);
        } else if (ev.type === 'crown_bash') {
          this.spawnProjectile(380, BRIDGE_Y - 70, BOSS_X - 30, BRIDGE_Y - 85, '#78b7ff');
          if (this.boss) { this.boss.knockX = 14; this.boss.flash = 0.12; }
          this.spawnPopup(BOSS_X, BRIDGE_Y - 155, `🛡盾击 -${ev.dmg}`, '#78b7ff', 26);
          if (audio) audio.tone(320, 0.08, 'square', 0.08, 0, 210);
          if (hooks.onSyncHud) hooks.onSyncHud();
          await wait(120);
        } else if (ev.type === 'poison_apply') {
          this.spawnParticles(BOSS_X, BRIDGE_Y - 95, '#7ef28a', 10);
          this.spawnPopup(BOSS_X + 36, BRIDGE_Y - 110, `+${ev.stacks} 剧毒`, '#7ef28a', 22);
          if (hooks.onSyncHud) hooks.onSyncHud();
          await wait(80);
        } else if (ev.type === 'poison_detonate' || ev.type === 'poison_tick') {
          this.spawnVfx('fxImpactGreenBig', BOSS_X, BRIDGE_Y - 90, 1.85);
          this.spawnParticles(BOSS_X, BRIDGE_Y - 90, '#7ef28a', 22);
          this.triggerShake(10, 0.18);
          this.spawnPopup(BOSS_X, BRIDGE_Y - 150, `☠ 毒爆 -${ev.dmg}`, '#7ef28a', 34);
          if (audio) audio.tone(180, 0.18, 'sawtooth', 0.1, 0, 95);
          if (hooks.onSyncHud) hooks.onSyncHud();
          await wait(240);
        } else if (ev.type === 'furnace_proc') {
          this.spawnPopup(380, BRIDGE_Y - 145, `🔥炼金炉 +${ev.gold}G · 手牌全员+${ev.handAtkGain}永久攻!`, '#ffd966', 24);
          if (hooks.onSyncHud) hooks.onSyncHud();
          await wait(260);
        } else if (ev.type === 'boss_vuln') {
          this.spawnPopup(BOSS_X, BRIDGE_Y - 175, '易伤 ×1.4!', '#ff8a5c', 24);
          if (hooks.onSyncHud) hooks.onSyncHud();
        } else if (ev.type === 'boss_break') {
          this.triggerFlash('#ffd966', 0.35, 0.22);
          this.triggerShake(14, 0.25);
          this.spawnPopup(BOSS_X, BRIDGE_Y - 190, '⚡ 破招眩晕! ×1.5', '#ffd966', 34);
          if (audio) audio.tone(440, 0.12, 'square', 0.12, 0, 880);
          if (hooks.onSyncHud) hooks.onSyncHud();
          await wait(220);
        } else if (ev.type === 'shield_gain') {
          this.spawnPopup(320, BRIDGE_Y - 110, `+${ev.amount} 蓝盾`, '#78b7ff', 22);
          if (hooks.onSyncHud) hooks.onSyncHud();
        } else if (ev.type === 'gold_gain') {
          this.spawnPopup(420, BRIDGE_Y - 130, `+${ev.amount}G`, '#ffd966', 24);
          if (hooks.onSyncHud) hooks.onSyncHud();
        } else if (ev.type === 'hero_grow') {
          this.spawnPopup(420, BRIDGE_Y - 160, `✦ ${ev.text}`, '#ffd966', 22);
          if (hooks.onSyncHud) hooks.onSyncHud();
        } else if (ev.type === 'relic_grow' && hooks.onRelicPulse) {
          hooks.onRelicPulse(ev.relicUid, ev.text);
        } else if (ev.type === 'boss_attack') {
          const sName = (this.bossIntent && this.bossIntent.skillName) || '重击';
          const sCol = (this.bossIntent && this.bossIntent.color) || '#ff477e';
          this.triggerCutIn(`✦ ${sName} ✦`, ev.hpLost > 0 ? `受到 ${ev.hpLost} 伤${ev.blocked > 0 ? `（格挡 ${ev.blocked}）` : ''}` : `护盾完美格挡 ${ev.blocked} 伤`, sCol);
          if (this.boss) {
            this.boss.anim = 'attack';
            this.boss.animTimer = 0.45;
            this.boss.x = BOSS_X - 130;
          }
          await wait(220);
          this.triggerShake(13, 0.22);
          this.triggerFlash(ev.hpLost > 0 ? '#ff4757' : '#78b7ff', 0.28, 0.18);
          this.spawnVfx('fxImpactBigOrange', 420, BRIDGE_Y - 75, 1.8);
          const msg = ev.hpLost > 0 ? `Boss 重击 -${ev.hpLost} HP${ev.blocked > 0 ? ` (挡${ev.blocked})` : ''}` : `🛡 完美挡下 ${ev.blocked} 伤!`;
          this.spawnPopup(420, BRIDGE_Y - 125, msg, ev.hpLost > 0 ? '#ff5c72' : '#78b7ff', 28);
          if (audio) audio.tone(130, 0.18, 'sawtooth', 0.13, 0, 55);
          if (hooks.onSyncHud) hooks.onSyncHud();
          await wait(260);
          if (this.boss) this.boss.x = BOSS_X;
        } else if (ev.type === 'revenge_hit') {
          this.spawnVfx('fxExplosionBigBall_MetalSlug', BOSS_X, BRIDGE_Y - 85, 1.9);
          this.triggerShake(12, 0.2);
          this.spawnPopup(BOSS_X, BRIDGE_Y - 155, `⚡反震 -${ev.dmg}!`, '#78b7ff', 34);
          if (hooks.onSyncHud) hooks.onSyncHud();
          await wait(240);
        } else if (ev.type === 'toast' && hooks.onToast) {
          hooks.onToast(ev.text);
        }
      }
    }

    // ─── Authentic Mirror-Lake Eclipse Backdrop (from v12Battle) ───
    getUpperBgCanvas(biome) {
      if (this.bgCache[biome]) return this.bgCache[biome];
      const pal = ECLIPSE_PALETTES[biome] || ECLIPSE_PALETTES.default;
      const c = document.createElement('canvas');
      c.width = VW; c.height = BRIDGE_VY + 8;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      const leftSky = ctx.createLinearGradient(0, 0, 0, BRIDGE_VY);
      leftSky.addColorStop(0, '#161638'); leftSky.addColorStop(0.50, '#222b60');
      leftSky.addColorStop(0.82, '#347db0'); leftSky.addColorStop(1, '#68d8f5');
      ctx.fillStyle = leftSky; ctx.fillRect(0, 0, 178, BRIDGE_VY);

      const rightSky = ctx.createLinearGradient(0, 0, 0, BRIDGE_VY);
      rightSky.addColorStop(0, pal.skyTop); rightSky.addColorStop(0.55, pal.skyMid); rightSky.addColorStop(1, pal.skyLow);
      ctx.fillStyle = rightSky; ctx.fillRect(156, 0, VW - 156, BRIDGE_VY);

      this.drawMergedCloudBank(ctx, [[18, 56, 20], [46, 46, 24], [78, 42, 26], [112, 48, 24], [140, 56, 20]], '#3a367d', '#29265e', '#1e1c4a');

      const ex = 232, ey = 38;
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2 + 0.08;
        const len = 30 + (i % 3) * 7 + (i % 2) * 3;
        for (let step = 16; step <= len; step++) {
          const t = (step - 16) / (len - 16);
          const a = ang + 0.34 * t * t;
          const w = Math.max(1, Math.round((1 - t) * 3.5));
          ctx.fillStyle = t < 0.38 ? pal.corona2 : pal.corona1;
          ctx.fillRect(Math.round(ex + Math.cos(a) * step - w / 2), Math.round(ey + Math.sin(a) * step - w / 2), w, w);
        }
      }
      this.drawPixelDisc(ctx, ex, ey, 21, pal.corona2);
      this.drawPixelDisc(ctx, ex, ey, 19, '#fff2f7');
      this.drawPixelDisc(ctx, ex, ey, 16, '#08040e');

      this.drawMergedCloudBank(ctx, [[168, 72, 16], [190, 65, 18], [216, 68, 17], [244, 66, 18], [272, 62, 20], [300, 54, 22], [318, 48, 18]], pal.cloudHi, pal.cloudMid, pal.cloudDark);

      for (const px of [16, 36, 58, 80, 102, 124, 144]) this.drawOutlinedPine(ctx, px, BRIDGE_VY - 10, 32 + Math.floor(hash2(px, 2, 12) * 12), '#143844', '#1f5360');
      for (const px of [8, 28, 48, 70, 92, 114, 134, 150]) this.drawOutlinedPine(ctx, px, BRIDGE_VY - 6, 26 + Math.floor(hash2(px, 5, 19) * 12), '#1d545e', '#2e787e');
      this.drawMergedCloudBank(ctx, [[8, BRIDGE_VY - 7, 14], [30, BRIDGE_VY - 9, 16], [56, BRIDGE_VY - 8, 16], [84, BRIDGE_VY - 10, 18], [112, BRIDGE_VY - 8, 16], [138, BRIDGE_VY - 9, 15]], '#8ef0ff', '#5ccce8', '#3ba4cc');
      ctx.fillStyle = '#70dff5'; ctx.fillRect(0, BRIDGE_VY - 5, 154, 5);

      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = '#090712'; ctx.fillRect(0, 52 + i, 12 + i, 2);
        ctx.fillStyle = i % 2 === 0 ? '#2b3454' : '#3d4c78'; ctx.fillRect(0, 52 + i, 10 + i, 1);
      }
      ctx.fillStyle = '#090712'; ctx.fillRect(0, 60, 16, BRIDGE_VY - 60);
      ctx.fillStyle = '#364369'; ctx.fillRect(0, 60, 14, BRIDGE_VY - 60);
      ctx.fillStyle = '#090712'; ctx.fillRect(2, 72, 9, 13);
      ctx.fillStyle = '#9cf4ff'; ctx.fillRect(3, 73, 7, 11);
      drawMatrix(ctx, PROPS.cyanLamp, 38, BRIDGE_VY - 38);

      this.drawShatteredRuins(ctx, 158, VW, BRIDGE_VY, pal);
      ctx.save();
      ctx.globalAlpha = 0.42;
      for (let y = 0; y < BRIDGE_VY; y += 2) {
        const sway = Math.round(Math.sin(y * 0.08) * 6 + (BRIDGE_VY - y) * 0.06);
        const w = 14 + Math.round(Math.sin(y * 0.14) * 5);
        ctx.fillStyle = pal.cloudMid; ctx.fillRect(156 + sway - Math.floor(w / 2), y, w, 3);
      }
      ctx.restore();

      this.bgCache[biome] = c;
      return c;
    }

    drawMergedCloudBank(ctx, puffs, colHi, colMid, colDark) {
      for (const [cx, cy, r] of puffs) this.drawPixelDisc(ctx, cx, cy, r, colHi);
      for (const [cx, cy, r] of puffs) this.drawPixelDisc(ctx, cx + 1, cy + 3, Math.max(2, r - 1), colMid);
      for (const [cx, cy, r] of puffs) this.drawPixelDisc(ctx, cx + 2, cy + 7, Math.max(2, r - 2), colDark);
    }
    drawPixelDisc(ctx, cx, cy, r, color) {
      ctx.fillStyle = color;
      const r2 = r * r;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r2) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
    drawOutlinedPine(ctx, cx, baseY, h, colDark, colLit) {
      const tiers = 4, topY = baseY - h;
      for (let t = 0; t < tiers; t++) {
        const ty = topY + Math.floor((t / tiers) * (h * 0.68)), th = Math.floor(h * 0.40), maxW = 5 + t * 3.6;
        for (let row = 0; row < th; row++) { const hw = Math.max(1, Math.round((row / th) * maxW)); ctx.fillStyle = '#090712'; ctx.fillRect(cx - hw - 1, ty + row - 1, hw * 2 + 3, 3); }
      }
      for (let t = 0; t < tiers; t++) {
        const ty = topY + Math.floor((t / tiers) * (h * 0.68)), th = Math.floor(h * 0.40), maxW = 5 + t * 3.6;
        for (let row = 0; row < th; row++) { const hw = Math.max(1, Math.round((row / th) * maxW)); ctx.fillStyle = colDark; ctx.fillRect(cx - hw, ty + row, hw * 2 + 1, 1); ctx.fillStyle = colLit; ctx.fillRect(cx - hw, ty + row, Math.max(1, Math.floor(hw * 0.72)), 1); }
      }
    }
    drawShatteredRuins(ctx, startX, endX, baseY, pal) {
      const mask = new Uint8Array(VW * baseY);
      const setPx = (px, py, val) => { if (px >= startX && px < endX && py >= 0 && py < baseY) mask[py * VW + px] = val; };
      for (let x = startX; x < endX; x++) {
        const h = Math.max(10, Math.round(20 + Math.sin(x * 0.09) * 5 + Math.cos(x * 0.23) * 3 + (Math.floor(x / 5) % 3 === 0 ? 5 : 0)));
        for (let y = baseY - h; y < baseY; y++) setPx(x, y, 1);
      }
      for (const sp of [{ cx: 174, h: 40, w: 6, lean: -1 }, { cx: 196, h: 48, w: 7, lean: 1 }, { cx: 222, h: 36, w: 6, lean: -1 }, { cx: 262, h: 42, w: 7, lean: 1 }, { cx: 294, h: 38, w: 6, lean: -1 }]) {
        for (let dy = 0; dy < sp.h; dy++) {
          const t = dy / sp.h, hw = Math.max(1, Math.round((0.25 + t * 0.75) * (sp.w * 0.55)));
          const ox = sp.cx + Math.round((1 - t) * sp.lean * 2.5);
          for (let dx = -hw; dx <= hw; dx++) setPx(ox + dx, baseY - sp.h + dy, 2);
        }
      }
      for (let y = 1; y < baseY; y++) {
        for (let x = startX; x < endX; x++) {
          const v = mask[y * VW + x]; if (!v) continue;
          const edge = !mask[(y - 1) * VW + x] || x <= startX || !mask[y * VW + (x - 1)] || x >= endX - 1 || !mask[y * VW + (x + 1)];
          ctx.fillStyle = edge ? '#090712' : (!mask[(y - 2) * VW + x] ? pal.ruinHi : (v === 2 ? pal.ruinDark : pal.ruinMid));
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    drawStoneBridge(ctx) {
      const y = BRIDGE_Y, h = LAKE_Y - BRIDGE_Y;
      ctx.fillStyle = '#090712'; ctx.fillRect(0, y - 4, BW, 4);
      const rim = ctx.createLinearGradient(0, 0, BW, 0);
      rim.addColorStop(0, '#c2f7ff'); rim.addColorStop(0.5, '#9ed8f2'); rim.addColorStop(1, '#d8b4c8');
      ctx.fillStyle = rim; ctx.fillRect(0, y, BW, 4);
      ctx.fillStyle = '#474f6e'; ctx.fillRect(0, y + 4, BW, 12);
      ctx.fillStyle = '#2a3047'; ctx.fillRect(0, y + 16, BW, 12);
      for (let bx = 0; bx < BW; bx += 48) { ctx.fillStyle = '#141726'; ctx.fillRect(bx, y + 4, 4, 12); ctx.fillRect(bx + 24, y + 16, 4, 12); }
      ctx.fillStyle = '#090712'; ctx.fillRect(0, y + h - 4, BW, 4);
    }

    loop(ts) {
      if (!this.running) return;
      const rawDt = Math.min(0.05, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      const dt = rawDt * this.speed;

      if (this.hitstop > 0) {
        this.hitstop -= rawDt;
      } else {
        this.time += dt;
        this.idleTime += rawDt;
        this.update(dt);
      }
      this.render();
      this.rafId = requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
      if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.screenFlash) {
        this.screenFlash.dur -= dt;
        if (this.screenFlash.dur <= 0) this.screenFlash = null;
      }
      if (this.cutIn) {
        this.cutIn.life -= dt;
        if (this.cutIn.life <= 0) this.cutIn = null;
      }
      for (const m of this.ambientMotes) {
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.y < 30) { m.y = BRIDGE_Y - 12; m.x = Math.random() * BW; }
        if (m.x < 0) m.x = BW;
        if (m.x > BW) m.x = 0;
      }
      if (this.boss) {
        this.boss.knockX *= Math.pow(0.001, dt);
        if (this.boss.flash > 0) this.boss.flash = Math.max(0, this.boss.flash - dt);
        if (this.boss.animTimer > 0) {
          this.boss.animTimer -= dt;
          if (this.boss.animTimer <= 0) this.boss.anim = 'idle';
        }
      }
      for (const u of this.slotUnits) {
        if (!u) continue;
        if (u.flash > 0) u.flash = Math.max(0, u.flash - dt);
        if (u.animTimer > 0) {
          u.animTimer -= dt;
          if (u.animTimer <= 0) u.anim = 'idle';
        }
      }
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const p = this.popups[i];
        p.y += p.vy * dt;
        p.vy *= 0.92;
        p.life -= dt;
        if (p.life <= 0) this.popups.splice(i, 1);
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.px = pt.x; pt.py = pt.y;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 380 * dt;
        pt.life -= dt;
        if (pt.life <= 0) this.particles.splice(i, 1);
      }
      if (window.MT.vfx && window.MT.vfx.update) {
        for (let i = this.activeVfx.length - 1; i >= 0; i--) {
          window.MT.vfx.update(this.activeVfx[i], dt);
          if (this.activeVfx[i].done) this.activeVfx.splice(i, 1);
        }
      }
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        pr.t += dt;
        const k = Math.min(1, pr.t / pr.dur);
        pr.x = pr.fromX + (pr.toX - pr.fromX) * k;
        pr.y = pr.fromY + (pr.toY - pr.fromY) * k - Math.sin(k * Math.PI) * 32;
        if (pr.t >= pr.dur) this.projectiles.splice(i, 1);
      }
    }

    renderUpperWorld(ctx) {
      const sprites = window.MT.sprites;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, BW, this.sceneBuf.height);
      // Pure black backdrop (keeping bridge, heroes, boss, VFX, and mirror-lake reflection intact!)
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, BW, BRIDGE_Y);

      // 5-Tier Unit Visual Signatures (Outline + Persistent Ambient Aura/Motes) + Dedicated Selection Indicator!
      const TIER_VFX = {
        C:   { outline: '#e6eefc', rgb: null, motes: 0 },
        B:   { outline: '#66d0ff', rgb: '91, 194, 255', motes: 2, moteCol: '#b8ecff' },
        A:   { outline: '#d48cff', rgb: '201, 125, 255', motes: 3, moteCol: '#f0d4ff' },
        S:   { outline: '#ffd966', rgb: '255, 214, 82', motes: 5, moteCol: '#fff4b8' },
        SSS: { outline: '#ff5e8e', rgb: '255, 94, 142', motes: 7, moteCol: '#ffd6e5' }
      };

      // Draw Slot Heroes with Tier Auras, Spotlight Dimming & Dedicated RPG Selection Indicator!
      if (sprites) {
        const inspectActive = this.inspectedSlotIdx >= 0 && !this.slotUnits.some((x) => x && x.isDragging && x.isRecallZone);
        const relSlots = (this.relatedMeta && this.relatedMeta.slots) || new Set();
        const relColors = (this.relatedMeta && this.relatedMeta.slotColors) || {};
        for (let i = 0; i < 3; i++) {
          const u = this.slotUnits[i];
          if (!u || u.isDragging) continue;
          const isInspected = this.inspectedSlotIdx === i;
          const isRelated = relSlots.has(i);
          const tv = TIER_VFX[u.tier] || TIER_VFX.C;

          ctx.save();
          if (inspectActive && !isInspected && !isRelated) ctx.globalAlpha = 0.34;

          // Distinct Structural Tier VFX on Bridge Units (C: none | B: Ice-Blue Floor Pedestal | A: Rotating Purple Star | S: Golden Sun Halo + Pedestal | SSS: Dual Crimson-Gold Eclipse Halo!)
          if (u.tier === 'B') {
            const bp = 0.78 + 0.22 * Math.sin(this.idleTime * 2.4 + u.phase);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(u.x, BRIDGE_Y + 3);
            ctx.scale(1, 0.28);
            ctx.strokeStyle = `rgba(91, 200, 255, ${0.85 * bp})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(184, 236, 255, ${0.55 * bp})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          } else if (u.tier === 'A') {
            const ap = 0.78 + 0.22 * Math.sin(this.idleTime * 2.2 + u.phase);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            // Rotating purple 4-point arcane star behind unit
            ctx.save();
            ctx.translate(u.x, u.y - 54);
            ctx.rotate(this.idleTime * 0.55 + u.phase);
            ctx.strokeStyle = `rgba(212, 140, 255, ${0.58 * ap})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(-26, -26, 52, 52);
            ctx.rotate(Math.PI / 4);
            ctx.strokeRect(-26, -26, 52, 52);
            ctx.restore();
            // Ground purple ring
            ctx.save();
            ctx.translate(u.x, BRIDGE_Y + 3);
            ctx.scale(1, 0.28);
            ctx.strokeStyle = `rgba(208, 128, 255, ${0.85 * ap})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            for (let m = 0; m < 4; m++) {
              const mt = (this.idleTime * 0.42 + m * 0.25 + u.phase) % 1;
              const mx = u.x + Math.sin(m * 2.3 + this.idleTime * 1.5) * 28;
              const my = u.y - 8 - mt * 96;
              ctx.globalAlpha = Math.sin(mt * Math.PI) * 0.85;
              ctx.fillStyle = m % 2 === 0 ? '#f0d4ff' : '#c97dff';
              ctx.fillRect(Math.round(mx), Math.round(my), 3, 3);
            }
            ctx.restore();
          } else if (u.tier === 'S') {
            const sp = 0.8 + 0.2 * Math.sin(this.idleTime * 2.4 + u.phase);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            // Radiant Golden Sun Halo behind unit
            ctx.save();
            ctx.translate(u.x, u.y - 56);
            ctx.strokeStyle = `rgba(255, 214, 82, ${0.72 * sp})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke();
            ctx.rotate(this.idleTime * 0.65 + u.phase);
            for (let k = 0; k < 8; k++) {
              ctx.rotate(Math.PI / 4);
              ctx.fillStyle = k % 2 === 0 ? '#fff4b8' : '#ffd24c';
              ctx.fillRect(36, -2, 10, 4);
            }
            ctx.restore();
            // Golden floor rune ring
            ctx.save();
            ctx.translate(u.x, BRIDGE_Y + 3);
            ctx.scale(1, 0.28);
            ctx.strokeStyle = `rgba(255, 214, 82, ${0.9 * sp})`;
            ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            for (let m = 0; m < 6; m++) {
              const mt = (this.idleTime * 0.45 + m * 0.166 + u.phase) % 1;
              const mx = u.x + Math.sin(m * 2.1 + this.idleTime * 1.6) * 32;
              const my = u.y - 8 - mt * 108;
              ctx.globalAlpha = Math.sin(mt * Math.PI) * 0.9;
              ctx.fillStyle = m % 2 === 0 ? '#fff9d6' : '#ffd24c';
              ctx.fillRect(Math.round(mx), Math.round(my), 4, 4);
            }
            ctx.restore();
          } else if (u.tier === 'SSS') {
            const mp = 0.8 + 0.2 * Math.sin(this.idleTime * 2.8 + u.phase);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            // Dual Counter-Rotating Crimson-Gold Eclipse Halo behind unit!
            ctx.save();
            ctx.translate(u.x, u.y - 58);
            const ag = ctx.createRadialGradient(0, 0, 8, 0, 0, 62);
            ag.addColorStop(0, `rgba(255, 94, 142, ${0.42 * mp})`);
            ag.addColorStop(1, 'rgba(255, 94, 142, 0)');
            ctx.fillStyle = ag;
            ctx.fillRect(-62, -62, 124, 124);
            ctx.strokeStyle = `rgba(255, 94, 142, ${0.88 * mp})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.stroke();
            ctx.save();
            ctx.rotate(this.idleTime * 0.85 + u.phase);
            for (let k = 0; k < 8; k++) {
              ctx.rotate(Math.PI / 4);
              ctx.fillStyle = k % 2 === 0 ? '#ffd966' : '#ff5e8e';
              ctx.fillRect(42, -2.5, 12, 5);
            }
            ctx.restore();
            ctx.save();
            ctx.rotate(-this.idleTime * 0.95 - u.phase);
            ctx.strokeStyle = 'rgba(255, 226, 122, 0.85)';
            ctx.lineWidth = 2;
            ctx.strokeRect(-28, -28, 56, 56);
            ctx.rotate(Math.PI / 4);
            ctx.strokeRect(-28, -28, 56, 56);
            ctx.restore();
            ctx.restore();
            // Ground crimson-gold ring
            ctx.save();
            ctx.translate(u.x, BRIDGE_Y + 3);
            ctx.scale(1, 0.28);
            ctx.strokeStyle = `rgba(255, 94, 142, ${0.95 * mp})`;
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            for (let m = 0; m < 8; m++) {
              const mt = (this.idleTime * 0.5 + m * 0.125 + u.phase) % 1;
              const mx = u.x + Math.sin(m * 2.4 + this.idleTime * 1.9) * 36;
              const my = u.y - 6 - mt * 120;
              ctx.globalAlpha = Math.sin(mt * Math.PI) * 0.95;
              ctx.fillStyle = m % 2 === 0 ? '#ffd966' : '#ff5e8e';
              ctx.fillRect(Math.round(mx), Math.round(my), 4, 4);
            }
            ctx.restore();
          }

          // Dedicated Selected-Unit Indicator System (Ground Crisp Ring + Overhead White-Gold RPG Cursor — independent of Tier Outline!)
          if (isInspected) {
            const sp = 0.82 + 0.18 * Math.sin(this.idleTime * 3.8);
            const bob = Math.round(Math.sin(this.idleTime * 4.5) * 4);
            ctx.save();
            // Ground crisp double-ring selection base
            ctx.translate(u.x, BRIDGE_Y + 3);
            ctx.scale(1, 0.26);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * sp})`;
            ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(255, 226, 102, ${0.72 * sp})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();

            // Overhead floating RPG Diamond Cursor above unit head
            const cy = u.y - 122 + bob;
            ctx.save();
            ctx.fillStyle = '#07040f';
            ctx.beginPath();
            ctx.moveTo(u.x, cy + 12); ctx.lineTo(u.x - 10, cy); ctx.lineTo(u.x, cy - 12); ctx.lineTo(u.x + 10, cy);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(u.x, cy + 9); ctx.lineTo(u.x - 7, cy); ctx.lineTo(u.x, cy - 9); ctx.lineTo(u.x + 7, cy);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ffe266';
            ctx.fillRect(Math.round(u.x - 2), Math.round(cy - 2), 4, 4);
            ctx.restore();
          }

          // Unit Outline honors its Tier Color (never overwritten by selection!)
          const outline = u.flash > 0 ? '#ffffff'
            : (inspectActive && isRelated && relColors[i]) ? relColors[i]
            : tv.outline;
          const unitAnimTime = u.anim === 'idle' ? (this.idleTime + u.phase) : (this.time + u.phase);
          sprites.drawUnit(ctx, u.unitId, u.anim, unitAnimTime, Math.round(u.x), Math.round(u.y), {
            scale: u.scale,
            flipX: false,
            loop: u.anim !== 'attack',
            outlineColor: outline
          });
          ctx.restore();
        }

        // Draw Boss (dims slightly if inspected unit has no special debuff relation to Boss)
        if (this.boss && this.boss.alive) {
          const isCharging = this.bossIntent && (this.bossIntent.kind === 'charge' || this.bossIntent.kind === 'ult');
          const bossRelated = Boolean(this.relatedMeta && this.relatedMeta.boss);
          ctx.save();
          if (inspectActive && !bossRelated) ctx.globalAlpha = 0.42;
          const bossOutline = this.boss.flash > 0 ? '#ffffff'
            : (inspectActive && bossRelated && this.relatedMeta.bossColor) ? this.relatedMeta.bossColor
            : this.bossStunned ? '#ffd966' : isCharging ? '#ff477e' : '#f2f6ff';
          const bossAnimTime = this.boss.anim === 'idle' ? (this.idleTime + this.boss.phase) : (this.time + this.boss.phase);
          sprites.drawUnit(ctx, this.boss.unitId, this.boss.anim, bossAnimTime, Math.round(this.boss.x + this.boss.knockX), Math.round(this.boss.y), {
            scale: this.boss.scale,
            flipX: true,
            loop: this.boss.anim !== 'attack',
            outlineColor: bossOutline
          });
          ctx.restore();
        }
      }

      for (const pr of this.projectiles) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const pg = ctx.createRadialGradient(pr.x, pr.y, 2, pr.x, pr.y, 34);
        pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.35, pr.color); pg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pg; ctx.fillRect(pr.x - 36, pr.y - 36, 72, 72);
        ctx.restore();
      }
      if (window.MT.vfx && window.MT.vfx.draw) {
        for (const inst of this.activeVfx) window.MT.vfx.draw(ctx, inst);
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const p of this.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(2, p.size * 0.8);
        ctx.beginPath(); ctx.moveTo(Math.round(p.px), Math.round(p.py)); ctx.lineTo(Math.round(p.x), Math.round(p.y)); ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    }

    render() {
      const ctx = this.ctx;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (this.shakeTime > 0) {
        ctx.translate(
          Math.round((Math.random() - 0.5) * this.shakeAmp * 2),
          Math.round((Math.random() - 0.5) * this.shakeAmp * 2)
        );
      }

      this.renderUpperWorld(this.sceneCtx);
      ctx.drawImage(this.sceneBuf, 0, 0, BW, BRIDGE_Y, 0, 0, BW, BRIDGE_Y);

      // Authentic Shimmering Mirror-Lake Reflection
      const lakeH = BH - LAKE_Y;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, LAKE_Y, BW, lakeH); ctx.clip();
      for (let sy = 0; sy < lakeH; sy += 4) {
        const srcY = BRIDGE_Y - sy - 4;
        if (srcY < 0) break;
        const ripple = Math.round(Math.sin(sy * 0.085 + this.time * 3.8) * (1.5 + (sy / lakeH) * 2.5));
        ctx.save(); ctx.translate(ripple, LAKE_Y + sy + 4); ctx.scale(1, -1);
        ctx.drawImage(this.sceneBuf, 0, srcY, BW, 4, 0, 0, BW, 4);
        ctx.restore();
      }
      const waterTint = ctx.createLinearGradient(0, LAKE_Y, BW, LAKE_Y);
      waterTint.addColorStop(0, 'rgba(12, 42, 92, 0.42)'); waterTint.addColorStop(0.55, 'rgba(28, 14, 52, 0.44)'); waterTint.addColorStop(1, 'rgba(38, 14, 50, 0.46)');
      ctx.fillStyle = waterTint; ctx.fillRect(0, LAKE_Y, BW, lakeH);
      const waterDepth = ctx.createLinearGradient(0, LAKE_Y, 0, BH);
      waterDepth.addColorStop(0, 'rgba(6, 8, 22, 0.28)'); waterDepth.addColorStop(0.55, 'rgba(6, 7, 20, 0.56)'); waterDepth.addColorStop(1, 'rgba(4, 5, 14, 0.78)');
      ctx.fillStyle = waterDepth; ctx.fillRect(0, LAKE_Y, BW, lakeH);
      ctx.restore();

      // Subtle Top Night-Sky Vignette so floating HP blades & HUD pop without boxes
      ctx.save();
      const topScrim = ctx.createLinearGradient(0, 0, 0, 118);
      topScrim.addColorStop(0, 'rgba(6, 5, 16, 0.68)');
      topScrim.addColorStop(0.6, 'rgba(6, 5, 16, 0.22)');
      topScrim.addColorStop(1, 'rgba(6, 5, 16, 0)');
      ctx.fillStyle = topScrim;
      ctx.fillRect(0, 0, BW, 118);
      ctx.restore();

      this.drawStoneBridge(ctx);

      // Clean Ground Contact Shadows under Heroes & Boss (No blurry rings, no cheap connecting lines!)
      for (let i = 0; i < 3; i++) {
        const sx = SLOT_X[i];
        const u = this.slotUnits[i];
        if (!u) continue;
        ctx.save();
        ctx.fillStyle = 'rgba(5, 4, 14, 0.52)';
        ctx.beginPath();
        ctx.ellipse(sx, BRIDGE_Y + 2, 34, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (this.boss && this.boss.alive) {
        ctx.save();
        ctx.fillStyle = 'rgba(5, 4, 14, 0.58)';
        ctx.beginPath();
        ctx.ellipse(BOSS_X, BRIDGE_Y + 2, 54, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // High-Signal Bridge Unit Effect Chips (Pixel Glyphs + Crisp Stats, ZERO system emojis!)
      for (let i = 0; i < 3; i++) {
        const sx = SLOT_X[i];
        const locked = i === 2 && this.slot3Locked;
        const u = this.slotUnits[i];
        if (!u && !locked) continue;
        if (u && u.isDragging) continue;
        ctx.save();
        if (locked) {
          ctx.font = '900 13.5px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
          const tw = ctx.measureText('封锁').width;
          const ox = sx - (16 + 4 + tw) / 2;
          drawPixelGlyph(ctx, 'frost', ox, BRIDGE_Y + 12, 2);
          ctx.textAlign = 'left';
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#05040e';
          ctx.strokeText('封锁', ox + 20, BRIDGE_Y + 25);
          ctx.fillStyle = '#8ef0ff';
          ctx.fillText('封锁', ox + 20, BRIDGE_Y + 25);
        } else {
          const chips = (u.effectChips && u.effectChips.length) ? u.effectChips : [{ icon: 'atk', text: `${u.atk}`, color: '#ffe266' }];
          ctx.font = '900 13.5px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
          const gap = 9;
          const items = chips.map((c) => {
            const icoW = c.icon ? 15 : 0;
            const txtW = ctx.measureText(c.text).width;
            return { ...c, icoW, txtW, w: icoW + (c.icon ? 3 : 0) + txtW };
          });
          const totalW = items.reduce((a, b) => a + b.w, 0) + gap * (items.length - 1);
          let curX = sx - totalW / 2;
          ctx.textAlign = 'left';
          ctx.lineWidth = 4.5;
          ctx.strokeStyle = '#05040e';
          for (const it of items) {
            if (it.icon) {
              drawPixelGlyph(ctx, it.icon, curX, BRIDGE_Y + 13, 1.8);
              curX += it.icoW + 3;
            }
            ctx.strokeText(it.text, curX, BRIDGE_Y + 25);
            ctx.fillStyle = it.color;
            ctx.fillText(it.text, curX, BRIDGE_Y + 25);
            curX += it.txtW + gap;
          }
        }
        ctx.restore();
      }

      // Boss Overhead Minimal High-Signal Intent (Crisp Pixel Glyphs + Numbers, ZERO emojis!)
      if (this.boss && this.boss.alive) {
        const bx = BOSS_X;
        if (this.bossIntent) {
          const parts = [];
          if (this.bossStunned) {
            parts.push({ icon: 'stun', text: '眩晕 ×1.5', color: '#ffe266' });
          } else {
            const k = this.bossIntent.kind;
            if (k === 'ult') parts.push({ icon: 'skull', text: `${this.bossIntent.dmg}`, color: '#ff477e' });
            else if (k === 'charge') parts.push({ icon: 'flame', text: `破 ${this.bossIntent.breakNeed || ''}`, color: '#ff9a2e' });
            else if (k === 'shield') {
              parts.push({ icon: 'shield', text: `+${this.bossIntent.shieldGain}`, color: '#7be8ff' });
              parts.push({ icon: 'atk', text: `${this.bossIntent.dmg}`, color: '#ff667d' });
            } else if (k === 'lock3') {
              parts.push({ icon: 'frost', text: '封3', color: '#8ef0ff' });
              parts.push({ icon: 'atk', text: `${this.bossIntent.dmg}`, color: '#ff667d' });
            } else if (k === 'thorns') {
              parts.push({ icon: 'thorns', text: '反4', color: '#a8ff78' });
              parts.push({ icon: 'atk', text: `${this.bossIntent.dmg}`, color: '#ff667d' });
            } else {
              parts.push({ icon: 'atk', text: `${this.bossIntent.dmg}`, color: '#ff667d' });
            }
          }
          ctx.save();
          ctx.font = '900 22px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
          const gap = 14;
          const measured = parts.map((p) => {
            const tw = ctx.measureText(p.text).width;
            return { ...p, tw, w: 22 + 6 + tw };
          });
          const totalW = measured.reduce((a, c) => a + c.w, 0) + gap * (measured.length - 1);
          let ox = bx - totalW / 2;
          ctx.textAlign = 'left';
          ctx.lineWidth = 5.5;
          ctx.strokeStyle = '#07040f';
          for (const p of measured) {
            drawPixelGlyph(ctx, p.icon, ox, 146, 2.6);
            ctx.strokeText(p.text, ox + 27, 166);
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, ox + 27, 166);
            ox += p.w + gap;
          }
          ctx.restore();
        }
        const badges = [];
        if (this.bossPoison > 0) badges.push({ icon: 'poison', text: `${this.bossPoison}`, color: '#7ef28a' });
        if (this.bossVuln) badges.push({ icon: 'vuln', text: '×1.4', color: '#ff8a5c' });
        if (badges.length > 0) {
          ctx.save();
          ctx.font = '900 14px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
          const gap = 14;
          const items = badges.map((b) => ({ ...b, tw: ctx.measureText(b.text).width, w: 16 + 4 + ctx.measureText(b.text).width }));
          const tw = items.reduce((a, c) => a + c.w, 0) + gap * (items.length - 1);
          let ox = bx - tw / 2;
          ctx.textAlign = 'left';
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#07040f';
          for (const b of items) {
            drawPixelGlyph(ctx, b.icon, ox, 180, 1.8);
            ctx.strokeText(b.text, ox + 19, 193);
            ctx.fillStyle = b.color;
            ctx.fillText(b.text, ox + 19, 193);
            ox += b.w + gap;
          }
          ctx.restore();
        }
      }

      // Floating Damage / Growth Popups
      for (const p of this.popups) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.45));
        ctx.font = `900 ${p.size}px "Noto Sans SC", sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#120818';
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      }

      // Shared Ornate Summon Pillar & Rotating Pixel Magic Circle (used by BOTH card drag & bridge unit drag!)
      const activeTargetSlot = (this.dragArrow && this.dragArrow.active && this.dragArrow.slotIdx >= 0)
        ? this.dragArrow.slotIdx
        : (this.unitDragTarget >= 0 ? this.unitDragTarget : -1);

      if (activeTargetSlot >= 0 && activeTargetSlot < 3) {
        const sx = SLOT_X[activeTargetSlot];
        const pulse = 0.78 + 0.22 * Math.sin(this.time * 7.5);
        const bob = Math.round(Math.sin(this.time * 6.5) * 5);
        const edgeCol = '#090612';

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pillarGrad = ctx.createLinearGradient(sx, BRIDGE_Y + 4, sx, BRIDGE_Y - 175);
        pillarGrad.addColorStop(0, `rgba(255, 214, 92, ${0.42 * pulse})`);
        pillarGrad.addColorStop(0.55, `rgba(255, 178, 64, ${0.18 * pulse})`);
        pillarGrad.addColorStop(1, 'rgba(255, 214, 92, 0)');
        ctx.fillStyle = pillarGrad;
        ctx.fillRect(sx - 42, BRIDGE_Y - 175, 84, 179);

        const coreGrad = ctx.createLinearGradient(sx, BRIDGE_Y + 4, sx, BRIDGE_Y - 140);
        coreGrad.addColorStop(0, `rgba(255, 250, 210, ${0.55 * pulse})`);
        coreGrad.addColorStop(1, 'rgba(255, 250, 210, 0)');
        ctx.fillStyle = coreGrad;
        ctx.fillRect(sx - 14, BRIDGE_Y - 140, 28, 144);

        for (let m = 0; m < 10; m++) {
          const mt = (this.time * 0.85 + m * 0.137) % 1;
          const mx = sx + Math.sin(m * 2.3 + this.time * 3) * 30;
          const my = BRIDGE_Y - mt * 155;
          const msz = (m % 3 === 0) ? 5 : 3;
          ctx.globalAlpha = Math.sin(mt * Math.PI) * 0.95;
          ctx.fillStyle = (m % 2 === 0) ? '#fff9d6' : '#ffd24c';
          ctx.fillRect(Math.round(mx - msz / 2), Math.round(my - msz / 2), msz, msz);
        }

        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(sx, BRIDGE_Y + 3);
        ctx.scale(1, 0.28);
        ctx.strokeStyle = `rgba(255, 226, 102, ${0.9 * pulse})`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.stroke();
        ctx.save();
        ctx.rotate(this.time * 2.4);
        for (let k = 0; k < 8; k++) {
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = k % 2 === 0 ? '#fff9d6' : '#ffae38';
          ctx.fillRect(50, -3, 12, 6);
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(255, 248, 200, 0.92)';
        ctx.lineWidth = 2.5;
        ctx.save();
        ctx.rotate(-this.time * 3.2);
        ctx.strokeRect(-28, -28, 56, 56);
        ctx.rotate(Math.PI / 4);
        ctx.strokeRect(-28, -28, 56, 56);
        ctx.restore();
        ctx.restore();
        ctx.restore();

        ctx.save();
        const ry = BRIDGE_Y - 134 + bob;
        ctx.globalCompositeOperation = 'lighter';
        const hg = ctx.createRadialGradient(sx, ry, 2, sx, ry, 34);
        hg.addColorStop(0, 'rgba(255, 232, 130, 0.65)');
        hg.addColorStop(1, 'rgba(255, 200, 70, 0)');
        ctx.fillStyle = hg;
        ctx.fillRect(sx - 34, ry - 34, 68, 68);
        ctx.globalCompositeOperation = 'source-over';

        ctx.fillStyle = edgeCol;
        ctx.fillRect(sx - 32, ry - 4, 16, 8);
        ctx.fillRect(sx + 16, ry - 4, 16, 8);
        ctx.fillStyle = '#ffe266';
        ctx.fillRect(sx - 30, ry - 2, 12, 4);
        ctx.fillRect(sx + 18, ry - 2, 12, 4);
        ctx.fillStyle = '#fff9d6';
        ctx.fillRect(sx - 26, ry - 1, 6, 2);
        ctx.fillRect(sx + 20, ry - 1, 6, 2);

        ctx.save();
        ctx.translate(sx, ry);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = edgeCol;
        ctx.fillRect(-11, -11, 22, 22);
        ctx.fillStyle = '#ffe266';
        ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = '#8c142a';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.fillStyle = '#fff9d6';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();

        ctx.fillStyle = edgeCol;
        ctx.beginPath();
        ctx.moveTo(sx, ry + 26); ctx.lineTo(sx - 10, ry + 14); ctx.lineTo(sx + 10, ry + 14);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffe266';
        ctx.beginPath();
        ctx.moveTo(sx, ry + 23); ctx.lineTo(sx - 7, ry + 15); ctx.lineTo(sx + 7, ry + 15);
        ctx.closePath(); ctx.fill();

        const slotNames = ['1号 · 先锋', '2号 · 中军', '3号 · 压轴'];
        ctx.font = '900 13px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#07040f';
        ctx.strokeText(slotNames[activeTargetSlot], sx, ry - 20);
        ctx.fillStyle = '#fff4c2';
        ctx.fillText(slotNames[activeTargetSlot], sx, ry - 20);
        ctx.restore();
      }

      // Render Top-Layer Arrows on Overlay Canvas (ALWAYS above hand cards, relics & UI!)
      if (this.overlayCtx) {
        const octx = this.overlayCtx;
        octx.clearRect(0, 0, BW, BH);

        const drawCurvedPixelArrow = (fromX, fromY, toX, toY, mainCol, glowRgb, label, arcLift = 95) => {
          const dx = toX - fromX;
          const dy = toY - fromY;
          const dist = Math.max(1, Math.hypot(dx, dy));
          let ctrlX, ctrlY;
          if (Math.abs(dy) > Math.abs(dx) * 0.85) {
            // Mostly vertical arrow (e.g., unit -> top relic or drag aim): gentle sideways bow, NEVER overshoot target Y!
            const bow = Math.min(34, dist * 0.14) * (dx >= 0 ? -1 : 1);
            ctrlX = (fromX + toX) * 0.5 + bow;
            ctrlY = (fromY + toY) * 0.5;
          } else {
            // Horizontal / shallow diagonal arrow (e.g., slot -> slot): classic overhead arch bounded by |dx|
            const safeLift = Math.min(arcLift, Math.max(28, Math.abs(dx) * 0.38));
            ctrlX = (fromX + toX) * 0.5;
            ctrlY = Math.min(fromY, toY) - safeLift;
          }
          const edgeCol = '#090612';
          // Sub-linear node count based on curve length
          const approxLen = dist + Math.hypot(ctrlX - (fromX + toX) * 0.5, ctrlY - (fromY + toY) * 0.5) * 0.85;
          const nodeCount = Math.max(5, Math.min(13, Math.round(1.9 * Math.pow(Math.max(60, approxLen) / 42, 0.58) + 1.8)));
          // Continuous smooth packet-transmission flow along the Bezier curve (grows larger as it travels!)
          const flowPhase = (this.idleTime * 1.05) % 1;

          octx.save();
          for (let s = 0; s < nodeCount; s++) {
            const t = (s + flowPhase) / nodeCount;
            if (t <= 0.04 || t >= 0.96) continue;
            const it = 1 - t;
            const px = it * it * fromX + 2 * it * t * ctrlX + t * t * toX;
            const py = it * it * fromY + 2 * it * t * ctrlY + t * t * toY;
            const edgeFade = t < 0.14 ? (t / 0.14) : t > 0.86 ? ((1 - t) / 0.14) : 1;
            const sz = Math.round(3 + Math.pow(t, 0.85) * 8.5);

            octx.save();
            octx.globalAlpha = edgeFade;
            octx.globalCompositeOperation = 'lighter';
            const ng = octx.createRadialGradient(px, py, 1, px, py, sz * 1.85);
            ng.addColorStop(0, `rgba(${glowRgb}, ${0.32 + t * 0.42})`);
            ng.addColorStop(1, `rgba(${glowRgb}, 0)`);
            octx.fillStyle = ng;
            octx.fillRect(px - sz * 2, py - sz * 2, sz * 4, sz * 4);
            octx.restore();

            octx.save();
            octx.globalAlpha = edgeFade;
            octx.translate(Math.round(px), Math.round(py));
            octx.rotate(Math.PI / 4);
            octx.fillStyle = edgeCol;
            octx.fillRect(-sz / 2 - 2, -sz / 2 - 2, sz + 4, sz + 4);
            octx.fillStyle = t > 0.72 ? '#fff9d6' : mainCol;
            octx.fillRect(-sz / 2, -sz / 2, sz, sz);
            if (sz >= 7) {
              octx.fillStyle = '#ffffff';
              octx.fillRect(-1.5, -1.5, 3, 3);
            }
            octx.restore();
          }

          const ang = Math.atan2(toY - ctrlY, toX - ctrlX);
          octx.save();
          octx.globalCompositeOperation = 'lighter';
          const tg = octx.createRadialGradient(toX, toY, 2, toX, toY, 28);
          tg.addColorStop(0, 'rgba(255, 252, 220, 0.9)');
          tg.addColorStop(0.45, `rgba(${glowRgb}, 0.55)`);
          tg.addColorStop(1, `rgba(${glowRgb}, 0)`);
          octx.fillStyle = tg;
          octx.fillRect(toX - 28, toY - 28, 56, 56);
          octx.restore();

          octx.save();
          octx.translate(Math.round(toX), Math.round(toY));
          octx.rotate(ang);
          octx.fillStyle = edgeCol;
          octx.beginPath();
          octx.moveTo(18, 0); octx.lineTo(-14, -15); octx.lineTo(-7, 0); octx.lineTo(-14, 15);
          octx.closePath(); octx.fill();
          octx.fillStyle = mainCol;
          octx.beginPath();
          octx.moveTo(14, 0); octx.lineTo(-11, -11); octx.lineTo(-5, 0); octx.lineTo(-11, 11);
          octx.closePath(); octx.fill();
          octx.fillStyle = '#ffffff';
          octx.beginPath();
          octx.moveTo(8, 0); octx.lineTo(-4, -4); octx.lineTo(-2, 0); octx.lineTo(-4, 4);
          octx.closePath(); octx.fill();
          octx.restore();

          if (label) {
            const mx = 0.25 * fromX + 0.5 * ctrlX + 0.25 * toX;
            const my = 0.25 * fromY + 0.5 * ctrlY + 0.25 * toY - 12;
            octx.font = '900 12px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
            octx.textAlign = 'center';
            octx.lineWidth = 4;
            octx.strokeStyle = '#07040f';
            octx.strokeText(label, mx, my);
            octx.fillStyle = mainCol;
            octx.fillText(label, mx, my);
          }
          octx.restore();
        };

        const draggingRecall = this.slotUnits.some((u) => u && u.isDragging && u.isRecallZone);

        // 1. Unit Inspect / Drag Synergy Relation Arrows (hidden automatically when dragging into recall zone!)
        if (!draggingRecall && this.inspectedSlotIdx >= 0 && this.relationArrows.length > 0 && !(this.dragArrow && this.dragArrow.active)) {
          for (const ra of this.relationArrows) {
            let fx = ra.fromX, fy = ra.fromY, tx = ra.toX, ty = ra.toY;
            if (typeof ra.fromSlot === 'number' && this.slotUnits[ra.fromSlot]) {
              const fu = this.slotUnits[ra.fromSlot];
              fx = fu.x + (ra.fromOx || 0);
              fy = fu.y + (ra.fromOy !== undefined ? ra.fromOy : -64);
            }
            if (typeof ra.toSlot === 'number' && this.slotUnits[ra.toSlot]) {
              const tu = this.slotUnits[ra.toSlot];
              tx = tu.x + (ra.toOx || 0);
              ty = tu.y + (ra.toOy !== undefined ? ra.toOy : -68);
            }
            drawCurvedPixelArrow(fx, fy, tx, ty, ra.color, ra.glowRgb, ra.label, ra.arcLift || 76, ra.nodes || 10);
          }
        }

        // 2. Render Actively Dragged Bridge Unit on Top-Layer Overlay (Red outline when in recall zone!)
        const sprites = window.MT.sprites;
        if (sprites) {
          for (let i = 0; i < 3; i++) {
            const u = this.slotUnits[i];
            if (!u || !u.isDragging) continue;
            const isRecall = Boolean(u.isRecallZone);
            octx.save();
            octx.imageSmoothingEnabled = false;
            octx.globalCompositeOperation = 'lighter';
            const dg = octx.createRadialGradient(u.x, u.y - 54, 6, u.x, u.y - 54, 68);
            dg.addColorStop(0, isRecall ? 'rgba(255, 71, 105, 0.52)' : 'rgba(255, 226, 102, 0.45)');
            dg.addColorStop(1, isRecall ? 'rgba(255, 71, 105, 0)' : 'rgba(255, 210, 80, 0)');
            octx.fillStyle = dg;
            octx.fillRect(u.x - 70, u.y - 124, 140, 140);
            octx.globalCompositeOperation = 'source-over';
            sprites.drawUnit(octx, u.unitId, u.anim, this.time + u.phase, Math.round(u.x), Math.round(u.y), {
              scale: u.scale * 1.08,
              flipX: false,
              loop: true,
              outlineColor: isRecall ? '#ff4769' : '#ffe266'
            });
            octx.restore();
          }
        }

        // 3. Active Card Drag Targeting Arrow
        if (this.dragArrow && this.dragArrow.active) {
          const { fromX, fromY, toX, toY, slotIdx } = this.dragArrow;
          const locked = slotIdx >= 0;
          const mainCol = locked ? '#ffe266' : '#8ef0ff';
          const glowRgb = locked ? '255, 206, 72' : '110, 235, 255';
          drawCurvedPixelArrow(fromX, fromY, toX, toY, mainCol, glowRgb, '', 118, 13);
        }
      }

      if (this.screenFlash) {
        ctx.save();
        ctx.globalAlpha = (this.screenFlash.dur / this.screenFlash.maxDur) * this.screenFlash.alpha;
        ctx.fillStyle = this.screenFlash.color;
        ctx.fillRect(0, 0, BW, BH);
        ctx.restore();
      }

      // Anime Diagonal Cut-in Flash Band (on Break / Lethal / Big Burst)
      if (this.cutIn) {
        const p = 1 - (this.cutIn.life / this.cutIn.maxLife);
        const alpha = p < 0.2 ? p / 0.2 : p > 0.75 ? (1 - p) / 0.25 : 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.translate(BW / 2, 270);
        ctx.rotate(-0.065);
        // Dark ink speed-band
        ctx.fillStyle = 'rgba(10, 6, 20, 0.88)';
        ctx.fillRect(-760, -44, 1520, 88);
        ctx.fillStyle = this.cutIn.color;
        ctx.fillRect(-760, -46, 1520, 4);
        ctx.fillRect(-760, 42, 1520, 4);
        // Speedlines
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.35;
        ctx.fillStyle = '#ffffff';
        for (let s = -600; s < 600; s += 110) {
          const ox = ((s + this.time * 900) % 1200) - 600;
          ctx.fillRect(ox, -28 + (Math.abs(s) % 44), 80, 2);
        }
        // Crisp Anime Title & Sub
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.textAlign = 'center';
        ctx.font = '900 34px "Noto Sans SC", sans-serif';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#090512';
        ctx.strokeText(this.cutIn.title, 0, 6);
        ctx.fillStyle = this.cutIn.color;
        ctx.fillText(this.cutIn.title, 0, 6);
        if (this.cutIn.sub) {
          ctx.font = '800 15px "Noto Sans SC", sans-serif';
          ctx.fillStyle = '#fff8e2';
          ctx.fillText(this.cutIn.sub, 0, 30);
        }
        ctx.restore();
      }

      ctx.restore();
    }
  }

  window.MT.V14BattleStage = V14BattleStage;
})();
