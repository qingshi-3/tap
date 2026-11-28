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

  // Nocturnal Low-Saturation Palettes (10-22% luminance max so HUD, intent, arrows & VFX pop with 100% clarity!)
  const NOCTURNE_PALETTES = {
    default: {
      skyTop: '#070912', skyMid: '#101726', skyLow: '#1b263b',
      moonCore: '#d8e3f0', moonShade: '#a7b8cc', moonGlow: '180, 205, 235',
      cloudHi: '#1c263a', cloudMid: '#141c2c', cloudDark: '#0e1421',
      farHill: '#0d1320', midSil: '#090d17', nearSil: '#060810',
      mistRgb: '150, 178, 212', rainCol: 'rgba(182, 206, 235, 0.16)',
      rimL: '#5a6e8c', rimM: '#7e93b0', rimR: '#4b5a75',
      lakeTintL: 'rgba(6, 11, 22, 0.54)', lakeTintR: 'rgba(10, 10, 22, 0.58)'
    },
    ice: {
      skyTop: '#060a12', skyMid: '#0e1a29', skyLow: '#182b3e',
      moonCore: '#d6ecf5', moonShade: '#9dbbcc', moonGlow: '165, 215, 238',
      cloudHi: '#1a2c3e', cloudMid: '#122030', cloudDark: '#0c1622',
      farHill: '#0c1622', midSil: '#08101a', nearSil: '#050a12',
      mistRgb: '146, 195, 220', rainCol: 'rgba(185, 224, 242, 0.18)',
      rimL: '#567891', rimM: '#7da3bd', rimR: '#476278',
      lakeTintL: 'rgba(5, 14, 24, 0.54)', lakeTintR: 'rgba(8, 15, 26, 0.58)'
    },
    dark: {
      skyTop: '#080710', skyMid: '#151224', skyLow: '#221c33',
      moonCore: '#e2dae8', moonShade: '#b2a6bf', moonGlow: '198, 178, 218',
      cloudHi: '#221d34', cloudMid: '#171426', cloudDark: '#100d1c',
      farHill: '#110e1e', midSil: '#0b0915', nearSil: '#07050e',
      mistRgb: '175, 158, 198', rainCol: 'rgba(202, 188, 222, 0.15)',
      rimL: '#635c7d', rimM: '#887da3', rimR: '#524969',
      lakeTintL: 'rgba(10, 8, 20, 0.56)', lakeTintR: 'rgba(14, 9, 22, 0.60)'
    }
  };

  function hash2(x, y, seed = 1) {
    let n = Math.imul(x + 31, 374761393) + Math.imul(y + 19, 668265263) + Math.imul(seed, 1442695041);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function hexToRgbStr(hex, fallback = '255, 217, 102') {
    if (!hex || typeof hex !== 'string') return fallback;
    const clean = hex.trim().replace('#', '');
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16);
      const g = parseInt(clean[1] + clean[1], 16);
      const b = parseInt(clean[2] + clean[2], 16);
      return Number.isNaN(r) ? fallback : `${r}, ${g}, ${b}`;
    }
    if (clean.length === 6) {
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      return Number.isNaN(r) ? fallback : `${r}, ${g}, ${b}`;
    }
    return fallback;
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

  const WEATHER_MODES = ['drizzle', 'mist', 'fireflies'];
  let prevBattleWeatherIdx = -1;

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

      this.reflBuf = document.createElement('canvas');
      this.reflBuf.width = BW;
      this.reflBuf.height = BH - LAKE_Y;
      this.reflCtx = this.reflBuf.getContext('2d');

      this.bgCache = {};
      this.running = false;
      this.rafId = null;
      this.lastTs = 0;
      this.time = 0;
      this.idleTime = 0;
      this.speed = 1;

      this.hitstop = 0;
      this.hitstopTarget = null; // 'boss' | 'squad' | 'both' | null
      this.shakeTime = 0;
      this.shakeMaxTime = 0.14;
      this.shakeAmp = 0;
      this.shakeDirX = 1;
      this.zoomPunch = null;
      this.screenFlash = null;
      this.scoring = this._makeScoringState();

      this.biome = 'default';
      this.weather = 'drizzle';
      this.boss = null;
      this.ghostUnit = null;
      this.slotUnits = [null, null, null];
      this.slot3Locked = false;
      this.bossIntent = null;
      this.bossPoison = 0;
      this.bossVuln = false;
      this.bossStunned = false;

      this.popups = [];
      this.particles = [];
      this.shockwaves = [];
      this.afterimages = [];
      this.activeVfx = [];
      this.projectiles = [];
      this.synergyLinks = [];
      this.cutIn = null;
      this.dragArrow = null;
      this.inspectedSlotIdx = -1;
      this.relationArrows = [];
      this.onSlotClick = null;
      this.onEmptyClick = null;
      this._tweens = [];
      this._waiters = [];
      this.heroAccent = '#ffd966';
      this.heroAccent2 = '#ff6e96';
      this.heroAccRgb = '255, 217, 102';
      this.heroAcc2Rgb = '255, 110, 150';
      this.ambientMotes = Array.from({ length: 38 }, (_, i) => ({
        x: Math.random() * BW, y: 40 + Math.random() * 370,
        vx: (Math.random() - 0.45) * 16, vy: -9 - Math.random() * 14,
        phase: i * 1.15, size: i % 4 === 0 ? 4 : i % 2 === 0 ? 3 : 2,
        isStar: i % 3 === 0,
        useAcc2: i % 3 === 1
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

    start(bossCfg, biome = 'default', hero = null) {
      this.stop();
      this.biome = biome;
      this.heroAccent = (hero && hero.accent) || '#ffd966';
      this.heroAccent2 = (hero && hero.accent2) || '#ff6e96';
      this.heroAccRgb = hexToRgbStr(this.heroAccent, '255, 217, 102');
      this.heroAcc2Rgb = hexToRgbStr(this.heroAccent2, '255, 110, 150');
      this.time = 0;
      this.hitstop = 0;
      this.hitstopTarget = null;
      this.shakeTime = 0;
      this.shakeMaxTime = 0.14;
      this.shakeAmp = 0;
      this.zoomPunch = null;
      this.screenFlash = null;
      this.scoring = this._makeScoringState();
      this.popups = [];
      this.particles = [];
      this.shockwaves = [];
      this.afterimages = [];
      this.activeVfx = [];
      this.projectiles = [];
      this.synergyLinks = [];
      this.cutIn = null;
      this.ghostUnit = null;
      this._tweens = [];
      this._waiters = [];
      this.slotUnits = [null, null, null];
      this.slot3Locked = false;
      this.bossPoison = 0;
      this.bossVuln = false;
      this.bossStunned = false;

      // Rotate nocturnal battle weather without back-to-back repeats
      const choices = prevBattleWeatherIdx < 0 ? WEATHER_MODES.length : WEATHER_MODES.length - 1;
      const roll = Math.floor(Math.random() * choices);
      prevBattleWeatherIdx = (prevBattleWeatherIdx >= 0 && roll >= prevBattleWeatherIdx) ? roll + 1 : roll;
      this.weather = WEATHER_MODES[prevBattleWeatherIdx];
      if (window.MT.audio && window.MT.audio.setAmbience) {
        window.MT.audio.setAmbience('battle', this.weather);
      }

      this.boss = {
        unitId: bossCfg.unitId,
        name: bossCfg.name,
        vfx: bossCfg.vfx || 'pfx_blunt_hit',
        scale: 2.75,
        x: BOSS_X,
        homeX: BOSS_X,
        y: BRIDGE_Y,
        knockX: 0,
        squashX: 1,
        squashY: 1,
        flash: 0,
        anim: 'idle',
        animElapsed: 0,
        animDuration: 0.55,
        animSpeedMult: 1,
        animTimer: 0,
        phase: 0.6,
        alive: true,
        dying: false,
        deathElapsed: 0,
        deathDur: 1.08,
        deathEmitAcc: 0,
        deathMidBurst: false,
        deathEndBurst: false
      };

      this.running = true;
      this.lastTs = performance.now();
      this.loop(this.lastTs);
    }

    stop() {
      this.running = false;
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
      if (this.scoring && this.scoring.onHeatChange) {
        try { this.scoring.onHeatChange(0); } catch (_) {}
      }
      this.scoring = this._makeScoringState();
      // Resolve any pending choreography waiters cleanly so async callers never hang
      if (this._waiters && this._waiters.length) {
        const list = this._waiters.splice(0);
        for (const w of list) { try { w.resolve(); } catch (_) {} }
      }
      this._tweens = [];
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
              knockX: 0,
              squashX: 1,
              squashY: 1,
              scale: 2.08,
              anim: 'idle',
              animElapsed: 0,
              animDuration: 0.5,
              animSpeedMult: 1,
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
        if (state.bossHp <= 0) {
          if (this.boss.alive && !this.boss.dying) {
            this.triggerBossDeath();
          }
        } else {
          this.boss.alive = true;
          this.boss.dying = false;
          this.boss.deathElapsed = 0;
        }
      }
    }

    // Subtle elastic camera zoom-in centered on impact point (never exposes black borders since scale >= 1)
    triggerZoomPunch(scale = 1.042, focusX = BOSS_X, focusY = BRIDGE_Y - 82, dur = 0.24) {
      if (this.zoomPunch && this.zoomPunch.scale > scale && this.zoomPunch.time > dur * 0.4) return;
      this.zoomPunch = {
        scale: Math.max(1.01, Math.min(1.08, scale)),
        focusX,
        focusY,
        time: dur,
        maxTime: dur
      };
    }

    // Dramatic Kill-Confirm Finisher: hit-stop + zoom punch + white flash + pixel dissolution + gold burst
    triggerBossDeath() {
      if (!this.boss || this.boss.dying || !this.boss.alive) return;
      this.boss.dying = true;
      this.boss.deathElapsed = 0;
      this.boss.deathEmitAcc = 0;
      this.boss.deathMidBurst = false;
      this.boss.deathEndBurst = false;
      this.boss.flash = 0.42;
      this.boss.knockX = Math.max(this.boss.knockX || 0, 28);

      this.triggerHitImpact({
        hitstop: 0.135,
        shakeAmp: 12.5,
        shakeDur: 0.34,
        dirX: 1,
        target: 'boss',
        flashColor: '#fff6d6',
        flashAlpha: 0.36,
        flashDur: 0.24
      });
      this.triggerZoomPunch(1.062, BOSS_X, BRIDGE_Y - 86, 0.46);

      this.spawnVfx('pfx_plasma_death', BOSS_X, BRIDGE_Y - 86, 2.25, { speedMult: 1.0 });
      this.spawnShockwave(BOSS_X, BRIDGE_Y - 86, '#ffffff', 136, 0.38, 5.5);
      this.spawnShockwave(BOSS_X, BRIDGE_Y - 86, '#ffd966', 102, 0.50, 4);
      this.spawnParticles(BOSS_X, BRIDGE_Y - 86, '#ffe484', 32, 0);
      this.spawnParticles(BOSS_X, BRIDGE_Y - 86, '#ff85b3', 18, 1);

      const audio = window.MT.audio;
      if (audio && audio.playBossKill) audio.playBossKill();
    }

    _waitRealMs(ms) {
      return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
    }

    async playBossDeath() {
      if (!this.running || !this.boss) return;
      if (this.boss.alive && !this.boss.dying) {
        this.triggerBossDeath();
      }
      // Wait on REAL wall-clock time (never cut short by 2x/3x speed!) until:
      // 1) Boss finishes full dissolution, 2) all explosion VFX & shockwaves finish, 3) scoring banner settles
      const startMs = performance.now();
      const maxWaitMs = 2300;
      let bossDoneAt = 0;
      while (this.running && (performance.now() - startMs) < maxWaitMs) {
        const bossStillThere = Boolean(this.boss && (this.boss.dying || this.boss.alive));
        if (!bossStillThere && !bossDoneAt) {
          bossDoneAt = performance.now();
          // Gently trim scoring linger once Boss has fully dissolved so the victory modal arrives cleanly
          if (this.scoring && this.scoring.active && !this.scoring.holding) {
            this.scoring.holdTimer = Math.min(this.scoring.holdTimer, 0.22);
          }
        }
        const vfxBusy = (this.activeVfx && this.activeVfx.length > 0) || (this.shockwaves && this.shockwaves.length > 0);
        const scoringBusy = Boolean(this.scoring && this.scoring.active && this.scoring.fade > 0.08);
        if (!bossStillThere && !vfxBusy && !scoringBusy) {
          break;
        }
        await this._waitRealMs(40);
      }
      // Tranquil breath after explosions & scoring clear so the Victory Vault unveils gracefully (never abruptly!)
      if (this.running) {
        await this._waitRealMs(360);
      }
    }

    async playDefeatPause() {
      if (!this.running) return;
      const startMs = performance.now();
      while (this.running && (performance.now() - startMs) < 950) {
        const vfxBusy = (this.activeVfx && this.activeVfx.length > 0) || (this.shockwaves && this.shockwaves.length > 0);
        if (!vfxBusy && (performance.now() - startMs) >= 420) break;
        await this._waitRealMs(40);
      }
      if (this.running) await this._waitRealMs(260);
    }

    triggerShake(amp = 6, dur = 0.14, dirX = 1) {
      if (amp >= this.shakeAmp || this.shakeTime <= 0.02) {
        this.shakeAmp = amp;
        this.shakeMaxTime = dur;
        this.shakeDirX = dirX || 1;
      }
      this.shakeTime = Math.max(this.shakeTime, dur);
    }

    triggerHitImpact(opts = {}) {
      const {
        hitstop = 0.048,
        shakeAmp = 5.5,
        shakeDur = 0.14,
        dirX = 1,
        target = 'boss',
        flashColor = null,
        flashAlpha = 0.16,
        flashDur = 0.1
      } = opts;
      // Scale hitstop gently with battle speed so 2x/3x still feels snappy, never sluggish
      const hsScaled = hitstop / Math.pow(this.speed || 1, 0.45);
      this.hitstop = Math.max(this.hitstop, hsScaled);
      this.hitstopTarget = target;
      this.triggerShake(shakeAmp, shakeDur, dirX);
      if (flashColor) this.triggerFlash(flashColor, flashAlpha, flashDur);
    }

    triggerFlash(color = '#ffffff', alpha = 0.24, dur = 0.12) {
      this.screenFlash = { color, alpha, dur, maxDur: dur };
    }

    spawnShockwave(x, y, color = '#ffd966', maxR = 68, dur = 0.24, lineWidth = 4) {
      this.shockwaves.push({ x, y, color, maxR, t: 0, dur, lineWidth });
    }

    spawnAfterimage(unit, color = null, alpha = 0.44) {
      if (!unit) return;
      this.afterimages.push({
        unitId: unit.unitId,
        anim: unit.anim,
        animElapsed: unit.animElapsed || 0,
        animSpeedMult: unit.animSpeedMult || 1,
        x: unit.x + (unit.knockX || 0),
        y: unit.y,
        scale: unit.scale,
        flipX: unit === this.boss,
        color: color || '#b8dcff',
        alpha,
        life: 0.18,
        maxLife: 0.11
      });
    }

    spawnPopup(x, y, text, color = '#ffd966', size = 28, opts = {}) {
      // Gently nudge vertically if another very fresh popup shares this spot
      let sy = y;
      for (const existing of this.popups) {
        if (existing.life > existing.maxLife * 0.72 && Math.abs(existing.x - x) < 70 && Math.abs(existing.y - sy) < 28) {
          sy -= 28;
        }
      }
      const isBig = Boolean(opts.big) || size >= 34;
      this.popups.push({
        x: x + (Math.random() - 0.5) * 26,
        y: sy,
        vy: isBig ? -98 : -86,
        text,
        color,
        size,
        age: 0,
        isBig,
        tilt: isBig ? (Math.random() - 0.5) * 0.14 : (Math.random() - 0.5) * 0.05,
        life: isBig ? 1.04 : 0.92,
        maxLife: isBig ? 1.04 : 0.92
      });
    }

    spawnParticles(x, y, color, count = 14, dirX = 0) {
      for (let i = 0; i < count; i++) {
        const baseAng = dirX !== 0
          ? (dirX > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.9
          : Math.random() * Math.PI * 2;
        const spd = 95 + Math.random() * 240;
        this.particles.push({
          x, y, px: x, py: y,
          vx: Math.cos(baseAng) * spd,
          vy: Math.sin(baseAng) * spd - 65,
          size: 3.5 + Math.floor(Math.random() * 4.5),
          color,
          life: 0.28 + Math.random() * 0.34,
          maxLife: 0.62
        });
      }
    }

    spawnVfx(vfxId, x, y, scale = 1.65, opts = {}) {
      const vfx = window.MT.vfx;
      if (!vfxId || !vfx) return;
      const fn = vfx.spawn || vfx.createInstance;
      if (!fn) return;
      const inst = fn.call(vfx, vfxId, x, y, Object.assign({ scale }, opts));
      if (inst) this.activeVfx.push(inst);
    }

    spawnProjectile(fromX, fromY, toX, toY, color = '#6be5ff', opts = {}) {
      const dur = opts.dur || 0.16;
      const arc = opts.arc !== undefined ? opts.arc : 22;
      const kind = opts.kind || 'bolt'; // 'dagger' | 'shield' | 'bolt' | 'thorn' | 'amp'
      this.projectiles.push({
        x: fromX, y: fromY, px: fromX, py: fromY,
        fromX, fromY, toX, toY,
        t: 0, dur, arc, color, kind
      });
      return dur;
    }

    // =========================================================================
    // v15.6 BALATRO-STYLE SCORING HEAT & PIXEL FLAME ESCALATION ENGINE
    // =========================================================================
    _makeScoringState() {
      return {
        active: false,
        holding: false,
        holdTimer: 0,
        fade: 0,
        baseAtk: 0,
        mult: 1,
        totalDmg: 0,
        displayTotal: 0,
        lethalTarget: 400,
        heat: 0,
        heatLevel: 0, // 0: calm | 1: warm | 2: orange flame | 3: blue overkill flame | 4: eclipse supernova
        chainCount: 0,
        heroName: '',
        statusTag: '',
        atkPop: 0,
        multPop: 0,
        totalPop: 0,
        embers: [],
        sparks: [],
        onHeatChange: null
      };
    }

    beginScoringTally(lethalTarget = 400, hooks = null) {
      const s = this._makeScoringState();
      s.active = true;
      s.holding = true;
      s.fade = 0.05;
      s.lethalTarget = Math.max(80, Number(lethalTarget) || 400);
      s.onHeatChange = (hooks && hooks.onHeatChange) || null;
      this.scoring = s;
      if (s.onHeatChange) s.onHeatChange(0);
    }

    endScoringTally() {
      const s = this.scoring;
      if (!s || !s.active) return;
      s.holding = false;
      // Linger longer when flames are blazing so the player can savor the huge total!
      s.holdTimer = s.heatLevel >= 3 ? 1.05 : s.heatLevel >= 2 ? 0.82 : 0.55;
    }

    _evalHeatLevel(totalDmg, mult, lethalTarget) {
      const ratio = totalDmg / Math.max(80, lethalTarget);
      const absRatio = totalDmg / 520;
      const multBonus = mult >= 4 ? 0.25 : mult >= 2.2 ? 0.12 : 0;
      const heat = Math.max(ratio, absRatio) + multBonus;
      let level = 0;
      if (ratio >= 1.45 || totalDmg >= 1100) level = 4;
      else if (ratio >= 0.92 || totalDmg >= 540) level = 3;
      else if (ratio >= 0.52 || totalDmg >= 260) level = 2;
      else if (ratio >= 0.22 || totalDmg >= 110 || mult >= 1.8) level = 1;
      return { heat: Math.min(2.2, heat), level };
    }

    _syncScoringHeat(hooks = null) {
      const s = this.scoring;
      if (!s || !s.active) return;
      const prevLv = s.heatLevel;
      const { heat, level } = this._evalHeatLevel(s.totalDmg, s.mult, s.lethalTarget);
      s.heat = Math.max(s.heat, heat);
      if (level > prevLv) {
        s.heatLevel = level;
        const cb = (hooks && hooks.onHeatChange) || s.onHeatChange;
        if (cb) cb(level);
        if (level >= 2) {
          const audio = window.MT.audio;
          if (audio && audio.playHeatIgnite) audio.playHeatIgnite(level);
          // Burst of pixel flames when crossing into Orange / Blue / Eclipse heat!
          this._spawnScoreEmbers(level >= 3 ? 28 : 18, 640, 162, 130, level);
          if (level >= 3) {
            this.triggerShake(level >= 4 ? 6.5 : 4.5, 0.14, 1);
          }
        }
      }
    }

    _setScoringFactor(baseAtk, mult, kind = 'init', heroName = '', statusTag = '', hooks = null) {
      const s = this.scoring;
      if (!s || !s.active) return;
      if (typeof baseAtk === 'number') s.baseAtk = Math.max(0, Math.round(baseAtk));
      if (typeof mult === 'number') s.mult = Math.max(0.1, Number(mult.toFixed(2)));
      if (heroName) s.heroName = heroName;
      if (statusTag !== undefined) s.statusTag = statusTag || '';
      if (kind === 'atk') {
        s.atkPop = 1.0;
        this._spawnScoreEmbers(7, 566, 152, 42, s.heatLevel, '#7be8ff');
      } else if (kind === 'mult') {
        s.multPop = 1.0;
        this._spawnScoreEmbers(11, 714, 152, 46, Math.max(2, s.heatLevel), s.heatLevel >= 3 ? '#7be8ff' : '#ff6b8b');
      } else {
        s.atkPop = 0.7;
        if (s.mult > 1) s.multPop = 0.7;
      }
      this._syncScoringHeat(hooks);
    }

    _addScoringDamage(dmg, hooks = null) {
      const s = this.scoring;
      if (!s || !s.active) return;
      const add = Math.max(0, Math.round(Number(dmg) || 0));
      if (add <= 0) return;
      s.totalDmg += add;
      s.totalPop = 1.0;
      this._syncScoringHeat(hooks);
      const count = s.heatLevel >= 3 ? 16 : s.heatLevel >= 2 ? 10 : 6;
      this._spawnScoreEmbers(count, 640, 178, 96, s.heatLevel);
    }

    _spawnScoreEmbers(count, cx, cy, spreadX, heatLv, forceColor = null) {
      const s = this.scoring;
      if (!s) return;
      const pal = heatLv >= 4
        ? ['#ff5e8e', '#58e8ff', '#ffe266', '#ffffff']
        : heatLv >= 3
          ? ['#38c8ff', '#8ef6ff', '#ffffff', '#60a5fa']
          : heatLv >= 2
            ? ['#ff4d2e', '#ff942e', '#ffe266', '#fff6d6']
            : ['#ffd966', '#ffae38', '#fff4c2'];
      for (let i = 0; i < count; i++) {
        if (s.embers.length > 95) s.embers.shift();
        const col = forceColor || pal[Math.floor(Math.random() * pal.length)];
        s.embers.push({
          x: cx + (Math.random() - 0.5) * spreadX * 2,
          y: cy + (Math.random() - 0.5) * 24,
          vx: (Math.random() - 0.5) * (48 + heatLv * 24),
          vy: -(65 + Math.random() * (95 + heatLv * 38)),
          size: Math.random() < 0.35 ? 5 : 3,
          color: col,
          life: 0.34 + Math.random() * 0.36,
          maxLife: 0.70
        });
      }
    }

    _spawnRelicConvergeSparks(isMult = false, heatLv = 0) {
      const s = this.scoring;
      if (!s) return;
      const toX = isMult ? 714 : 566;
      const toY = 152;
      const fromX = 520 + (Math.random() - 0.5) * 240;
      const fromY = 86;
      const col = heatLv >= 3 ? '#7be8ff' : (isMult ? '#ff5e8e' : '#66d0ff');
      for (let i = 0; i < 6; i++) {
        s.sparks.push({
          fromX: fromX + (Math.random() - 0.5) * 24,
          fromY,
          toX: toX + (Math.random() - 0.5) * 28,
          toY: toY + (Math.random() - 0.5) * 14,
          t: 0,
          dur: 0.14 + Math.random() * 0.08,
          size: i % 2 === 0 ? 5 : 3,
          color: i === 0 ? '#ffffff' : col
        });
      }
    }

    _updateScoring(dt) {
      const s = this.scoring;
      if (!s || !s.active) return;

      // Smooth fade-in and delayed fade-out
      if (s.holding) {
        s.fade = Math.min(1, s.fade + dt * 7.5);
      } else {
        if (s.holdTimer > 0) {
          s.holdTimer -= dt;
        } else {
          s.fade = Math.max(0, s.fade - dt * 2.8);
          if (s.fade <= 0) {
            s.active = false;
            if (s.onHeatChange) s.onHeatChange(0);
            return;
          }
        }
      }

      // Snappy odometer roll-up for totalDmg
      if (s.displayTotal < s.totalDmg) {
        const diff = s.totalDmg - s.displayTotal;
        const step = Math.max(1, Math.ceil(diff * Math.min(1, dt * 18)));
        s.displayTotal = Math.min(s.totalDmg, s.displayTotal + step);
      }

      // Pop-bounce decay
      if (s.atkPop > 0) s.atkPop = Math.max(0, s.atkPop - dt * 4.8);
      if (s.multPop > 0) s.multPop = Math.max(0, s.multPop - dt * 4.4);
      if (s.totalPop > 0) s.totalPop = Math.max(0, s.totalPop - dt * 3.8);

      // Continuous rising embers proportional to Heat Level
      if (s.heatLevel >= 1 && s.fade > 0.35) {
        const spawnProb = s.heatLevel >= 4 ? 0.85 : s.heatLevel >= 3 ? 0.68 : s.heatLevel >= 2 ? 0.45 : 0.18;
        if (Math.random() < spawnProb) {
          this._spawnScoreEmbers(s.heatLevel >= 3 ? 2 : 1, 640, 178, 125, s.heatLevel);
        }
      }

      for (let i = s.embers.length - 1; i >= 0; i--) {
        const e = s.embers[i];
        e.life -= dt;
        if (e.life <= 0) { s.embers.splice(i, 1); continue; }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vx *= Math.pow(0.95, dt * 60);
      }
      for (let i = s.sparks.length - 1; i >= 0; i--) {
        const sp = s.sparks[i];
        sp.t += dt;
        if (sp.t >= sp.dur) s.sparks.splice(i, 1);
      }
    }

    _renderScoringOverlay(octx) {
      const s = this.scoring;
      if (!s || !s.active || s.fade <= 0.01) return;

      const t = this.idleTime;
      const lv = s.heatLevel;
      const cx = 640;
      const cy = 152;
      const fade = s.fade;

      octx.save();
      octx.imageSmoothingEnabled = false;

      // 1. Subtle Full-Screen Edge Heat Aura when Heat >= Lv.2 (feels genuinely hot without obscuring combat!)
      if (lv >= 2) {
        const pulse = 0.78 + 0.22 * Math.sin(t * (lv >= 3 ? 11 : 6.5));
        const edgeA = (lv >= 4 ? 0.24 : lv >= 3 ? 0.18 : 0.12) * fade * pulse;
        const rgb = lv >= 4 ? '255, 72, 138' : lv >= 3 ? '56, 206, 255' : '255, 118, 34';
        const rgb2 = lv >= 4 ? '56, 224, 255' : rgb;
        octx.save();
        octx.globalCompositeOperation = 'lighter';
        const leftG = octx.createLinearGradient(0, 0, 120, 0);
        leftG.addColorStop(0, `rgba(${rgb}, ${edgeA.toFixed(3)})`);
        leftG.addColorStop(1, 'rgba(0,0,0,0)');
        octx.fillStyle = leftG;
        octx.fillRect(0, 0, 120, BH);

        const rightG = octx.createLinearGradient(BW, 0, BW - 120, 0);
        rightG.addColorStop(0, `rgba(${rgb2}, ${edgeA.toFixed(3)})`);
        rightG.addColorStop(1, 'rgba(0,0,0,0)');
        octx.fillStyle = rightG;
        octx.fillRect(BW - 120, 0, 120, BH);
        octx.restore();
      }

      // 2. Converging Relic -> Scoreboard Spark Stream
      if (s.sparks.length > 0) {
        octx.save();
        octx.globalCompositeOperation = 'lighter';
        for (const sp of s.sparks) {
          const k = Math.min(1, sp.t / sp.dur);
          const ease = 1 - Math.pow(1 - k, 2);
          const px = sp.fromX + (sp.toX - sp.fromX) * ease;
          const py = sp.fromY + (sp.toY - sp.fromY) * ease;
          octx.globalAlpha = (1 - k * 0.4) * fade;
          octx.fillStyle = sp.color;
          octx.fillRect(Math.round(px - sp.size / 2), Math.round(py - sp.size / 2), sp.size, sp.size);
        }
        octx.restore();
      }

      // 3. Dynamic Pixel Flame Wall behind & flanking the Scoring Counter (Balatro Orange -> Blue Overkill -> Eclipse!)
      const slideY = Math.round((1 - fade) * -14);
      const panelY = cy + slideY;
      octx.globalAlpha = fade;

      if (lv >= 1) {
        const flameCols = lv >= 4
          ? { outer: '#e11d48', mid: '#38e8ff', hi: '#ffe266', core: '#ffffff', glow: '255, 76, 140' }
          : lv >= 3
            ? { outer: '#1d4ed8', mid: '#00c8ff', hi: '#8ef6ff', core: '#ffffff', glow: '56, 206, 255' }
            : lv >= 2
              ? { outer: '#dc2626', mid: '#ff7a18', hi: '#ffe266', core: '#fffce8', glow: '255, 118, 34' }
              : { outer: '#b45309', mid: '#f59e0b', hi: '#fef08a', core: '#fffbeb', glow: '245, 158, 11' };

        const flameSpan = lv >= 4 ? 320 : lv >= 3 ? 286 : lv >= 2 ? 250 : 196;
        const maxFlameH = lv >= 4 ? 86 : lv >= 3 ? 68 : lv >= 2 ? 48 : 22;
        const colW = 6;
        const cols = Math.floor(flameSpan / colW);
        const startX = Math.round(cx - (cols * colW) / 2);
        const baseY = panelY + 42;

        // Soft volumetric under-glow behind flames
        octx.save();
        octx.globalCompositeOperation = 'lighter';
        const fg = octx.createRadialGradient(cx, panelY + 12, 16, cx, panelY + 8, flameSpan * 0.62);
        fg.addColorStop(0, `rgba(${flameCols.glow}, ${(0.22 + lv * 0.08).toFixed(3)})`);
        fg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        octx.fillStyle = fg;
        octx.fillRect(cx - flameSpan, panelY - 84, flameSpan * 2, 168);

        // Crisp 6px-stepped pixel flame tongues!
        for (let i = 0; i < cols; i++) {
          const norm = (i / Math.max(1, cols - 1)) * 2 - 1; // -1..1
          // Higher on center & shoulders (classic Balatro framing!)
          const arch = Math.max(0.18, 1 - Math.pow(Math.abs(norm), 1.85) * 0.78);
          const wave1 = Math.sin(t * (9 + lv * 2.5) + i * 0.85);
          const wave2 = Math.cos(t * (14 + lv * 3.0) - i * 1.42);
          const flicker = 0.55 + 0.28 * wave1 + 0.17 * wave2;
          const h = Math.max(6, Math.round(maxFlameH * arch * flicker / 4) * 4);
          const x = startX + i * colW;

          octx.globalAlpha = fade * (0.72 + lv * 0.06);
          octx.fillStyle = flameCols.outer;
          octx.fillRect(x, baseY - h, colW, h);

          const midH = Math.max(4, Math.round(h * 0.68 / 4) * 4);
          octx.fillStyle = flameCols.mid;
          octx.fillRect(x + 1, baseY - midH, colW - 2, midH);

          if (lv >= 2 && h >= 18) {
            const hiH = Math.max(4, Math.round(h * 0.42 / 4) * 4);
            octx.fillStyle = flameCols.hi;
            octx.fillRect(x + 1, baseY - hiH, colW - 2, hiH);
          }
          if (lv >= 3 && h >= 28 && (i % 2 === 0)) {
            const cH = Math.max(4, Math.round(h * 0.24 / 4) * 4);
            octx.fillStyle = flameCols.core;
            octx.fillRect(x + 2, baseY - cH, colW - 4, cH);
          }
        }
        octx.restore();
      }

      // 4. Rising Pixel Embers
      if (s.embers.length > 0) {
        octx.save();
        octx.globalCompositeOperation = 'lighter';
        for (const e of s.embers) {
          octx.globalAlpha = Math.max(0, (e.life / e.maxLife) * fade);
          octx.fillStyle = e.color;
          octx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
        }
        octx.restore();
      }

      // 5. Compact HD-2D Scoring Plaque: [ Blue ATK ] × [ Crimson MULT ] + Blazing Total Counter
      const jitterMag = lv >= 4 ? 3.2 : lv >= 3 ? 2.2 : lv >= 2 ? 1.2 : 0;
      const jx = jitterMag ? Math.round((Math.sin(t * 68) + (Math.random() - 0.5)) * jitterMag * 0.55) : 0;
      const jy = jitterMag ? Math.round((Math.cos(t * 54) + (Math.random() - 0.5)) * jitterMag * 0.55) : 0;

      const boxW = 248;
      const boxH = 44;
      const boxX = Math.round(cx - boxW / 2 + jx * 0.4);
      const boxY = Math.round(panelY - 22 + jy * 0.4);

      const borderCol = lv >= 4 ? '#ff6ea8' : lv >= 3 ? '#7be8ff' : lv >= 2 ? '#ff9d3b' : '#c9a452';
      octx.save();
      octx.fillStyle = 'rgba(10, 8, 22, 0.86)';
      octx.fillRect(boxX, boxY, boxW, boxH);
      octx.strokeStyle = '#05040c';
      octx.lineWidth = 4;
      octx.strokeRect(boxX - 1, boxY - 1, boxW + 2, boxH + 2);
      octx.strokeStyle = borderCol;
      octx.lineWidth = 2;
      octx.strokeRect(boxX, boxY, boxW, boxH);

      // Left Blue Chips Box (ATK)
      const atkScale = 1 + s.atkPop * 0.28;
      const atkRot = -s.atkPop * 0.11;
      octx.save();
      octx.translate(cx - 64, panelY);
      octx.rotate(atkRot);
      octx.scale(atkScale, atkScale);
      octx.fillStyle = s.atkPop > 0.45 ? '#3b9cff' : '#184b8c';
      octx.fillRect(-52, -16, 104, 32);
      octx.strokeStyle = '#7be8ff';
      octx.lineWidth = 2;
      octx.strokeRect(-52, -16, 104, 32);
      octx.font = '20px "FusionPixel", monospace';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.lineWidth = 4;
      octx.strokeStyle = '#060a18';
      octx.strokeText(`${s.baseAtk}`, 0, 1);
      octx.fillStyle = '#e8faff';
      octx.fillText(`${s.baseAtk}`, 0, 1);
      octx.restore();

      // Center × Glyph
      octx.font = '20px "FusionPixel", monospace';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.lineWidth = 4;
      octx.strokeStyle = '#080510';
      octx.strokeText('×', cx, panelY + 1);
      octx.fillStyle = lv >= 3 ? '#8ef6ff' : '#ffd966';
      octx.fillText('×', cx, panelY + 1);

      // Right Crimson Multiplier Box (MULT)
      const multScale = 1 + s.multPop * 0.34;
      const multRot = s.multPop * 0.12;
      const multStr = Number.isInteger(s.mult) ? `${s.mult}` : `${s.mult.toFixed(2).replace(/0$/, '')}`;
      octx.save();
      octx.translate(cx + 64, panelY);
      octx.rotate(multRot);
      octx.scale(multScale, multScale);
      octx.fillStyle = s.multPop > 0.45 ? '#ff4778' : '#8f1938';
      octx.fillRect(-52, -16, 104, 32);
      octx.strokeStyle = lv >= 3 ? '#8ef6ff' : '#ff7a98';
      octx.lineWidth = 2;
      octx.strokeRect(-52, -16, 104, 32);
      octx.font = '20px "FusionPixel", monospace';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.lineWidth = 4;
      octx.strokeStyle = '#18050d';
      octx.strokeText(multStr, 0, 1);
      octx.fillStyle = '#fff5d6';
      octx.fillText(multStr, 0, 1);
      octx.restore();

      // Top micro-ribbon: Hero name / Status bonus / Heat banner
      const heatLabel = lv >= 4
        ? '✦ 伤害破表 ✦'
        : lv >= 3
          ? '⚡ 斩杀魔火 ⚡'
          : lv >= 2
            ? '🔥 火力全开 🔥'
            : (s.statusTag || s.heroName);
      if (heatLabel) {
        octx.font = '12px "FusionPixel", monospace';
        octx.textAlign = 'center';
        octx.textBaseline = 'alphabetic';
        octx.lineWidth = 4;
        octx.strokeStyle = '#07040f';
        octx.strokeText(heatLabel, cx, boxY - 6);
        octx.fillStyle = lv >= 4 ? '#ff94c2' : lv >= 3 ? '#8ef6ff' : lv >= 2 ? '#ffb84d' : '#f2e6c9';
        octx.fillText(heatLabel, cx, boxY - 6);
      }

      // Blazing Cumulative Total Counter directly below the equation
      if (s.totalDmg > 0) {
        const totSize = lv >= 4 ? 42 : lv >= 3 ? 38 : lv >= 2 ? 34 : 28;
        const totScale = 1 + s.totalPop * (lv >= 3 ? 0.32 : 0.22);
        const totCol = lv >= 4 ? '#fff6d6' : lv >= 3 ? '#8ef6ff' : lv >= 2 ? '#ffae38' : '#ffe266';
        octx.save();
        octx.translate(Math.round(cx + jx), Math.round(panelY + 46 + jy));
        octx.scale(totScale, totScale);
        octx.font = `${totSize}px "FusionPixel", monospace`;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.lineWidth = lv >= 3 ? 7 : 5.5;
        octx.lineJoin = 'round';
        octx.strokeStyle = lv >= 3 ? '#061428' : '#09050f';
        const totText = `${s.displayTotal}`;
        octx.strokeText(totText, 0, 0);
        octx.fillStyle = totCol;
        octx.fillText(totText, 0, 0);
        octx.restore();
      }

      octx.restore();
      octx.restore();
    }

    // Frame-accurate combat timer (pauses cleanly during hit-stop & scales with battle speed!)
    waitSec(sec) {
      if (!this.running || sec <= 0) return Promise.resolve();
      return new Promise((resolve) => {
        this._waiters.push({ rem: sec, resolve });
      });
    }

    // Smooth unit horizontal dash/retreat tween (runs on combat clock, leaves crisp afterimages)
    tweenUnitX(unit, toX, durSec, opts = {}) {
      if (!unit || !this.running) return Promise.resolve();
      const fromX = unit.x;
      if (durSec <= 0 || Math.abs(toX - fromX) < 1) {
        unit.x = toX;
        return Promise.resolve();
      }
      // Remove any existing tween on the same unit
      for (let i = this._tweens.length - 1; i >= 0; i--) {
        if (this._tweens[i].unit === unit) {
          this._tweens[i].resolve();
          this._tweens.splice(i, 1);
        }
      }
      return new Promise((resolve) => {
        this._tweens.push({
          unit,
          fromX,
          toX,
          t: 0,
          dur: durSec,
          ease: opts.ease || 'outCubic',
          trailColor: opts.trailColor || null,
          trailEvery: opts.trailEvery || 0.042,
          trailAcc: 0,
          resolve
        });
      });
    }

    startUnitAttack(unit, durOverride = null) {
      if (!unit) return { dur: 0.44, impactAt: 0.20 };
      const sprites = window.MT.sprites;
      const targetDur = durOverride || (sprites && sprites.getAttackDurationSec ? sprites.getAttackDurationSec(unit.unitId) : 0.48);
      const speedMult = (sprites && sprites.getAttackSpeedMult) ? sprites.getAttackSpeedMult(unit.unitId, targetDur) : 1;
      unit.anim = 'attack';
      unit.animElapsed = 0;
      unit.animDuration = targetDur;
      unit.animSpeedMult = speedMult;
      unit.animTimer = targetDur;
      return {
        dur: targetDur,
        impactAt: Math.max(0.14, targetDur * 0.46)
      };
    }

    async playEvents(events, hooks = {}) {
      const audio = window.MT.audio;
      let pitchStep = 0;
      let lastHeroSlotIdx = 0;

      const tierTrail = (tier) => (
        tier === 'SSS' ? '#ff5e8e'
        : tier === 'S' ? '#ffd966'
        : tier === 'A' ? '#d48cff'
        : tier === 'B' ? '#66d0ff'
        : '#cde2ff'
      );

      for (const ev of events) {
        if (!this.running) break;

        if (ev.type === 'strike') {
          pitchStep += 1;
          const actor = (ev.slotIdx >= 0 && ev.slotIdx < 3) ? this.slotUnits[ev.slotIdx] : null;
          if (actor) lastHeroSlotIdx = ev.slotIdx;
          const isHeavy = ev.dmg >= 220 || Boolean(ev.isRetrigger);
          const isMega = ev.dmg >= 420;

          // Seed scoreboard with this unit's base chips × mult, then pop each Relic left-to-right!
          const initAtk = ev.baseAtk !== undefined ? ev.baseAtk : ev.dmg;
          const initMult = ev.baseMult !== undefined ? ev.baseMult : 1;
          this._setScoringFactor(initAtk, initMult, 'init', ev.heroName || '', ev.statusMultLabel || '', hooks);

          if (ev.relicSteps && ev.relicSteps.length > 0) {
            for (const step of ev.relicSteps) {
              if (!this.running) break;
              const chainIdx = this.scoring ? (this.scoring.chainCount++) : pitchStep;
              const isMultStep = Boolean(step.isMult || (step.mult && step.mult !== 1));
              const curHeat = this.scoring ? this.scoring.heatLevel : 0;
              if (hooks.onRelicPulse) {
                hooks.onRelicPulse(step.relicUid, step.label, { isMult: isMultStep, heatLevel: curHeat, chainIdx });
              }
              if (step.afterBase !== undefined || step.afterMult !== undefined) {
                this._setScoringFactor(
                  step.afterBase !== undefined ? step.afterBase : undefined,
                  step.afterMult !== undefined ? step.afterMult : undefined,
                  isMultStep ? 'mult' : 'atk',
                  ev.heroName || '',
                  ev.statusMultLabel || '',
                  hooks
                );
              }
              this._spawnRelicConvergeSparks(isMultStep, this.scoring ? this.scoring.heatLevel : 0);
              if (audio && audio.playRelicTick) {
                audio.playRelicTick({ step: chainIdx, isMult: isMultStep, heatLevel: this.scoring ? this.scoring.heatLevel : 0 });
              }
              // Escalating tempo: accelerates cleanly as combo chain grows (72ms -> 34ms)!
              const stepDelay = Math.max(0.034, 0.072 - Math.min(8, chainIdx) * 0.0048);
              await this.waitSec(stepDelay);
            }
          }
          if (ev.finalMult !== undefined && this.scoring && Math.abs(ev.finalMult - this.scoring.mult) > 0.01) {
            this._setScoringFactor(ev.finalBaseAtk, ev.finalMult, 'mult', ev.heroName || '', ev.statusMultLabel || '', hooks);
          }

          if (ev.isKnife) {
            // ── Directional Throwing Dagger Volley ──
            const srcSlot = this.slotUnits[lastHeroSlotIdx] || this.slotUnits.find(Boolean);
            const fromX = (srcSlot ? srcSlot.x : SLOT_X[1]) + 28;
            const fromY = BRIDGE_Y - 68 + (Math.random() - 0.5) * 18;
            const toX = BOSS_X - 38;
            const toY = BRIDGE_Y - 82 + (Math.random() - 0.5) * 24;
            if (audio) {
              if (audio.playDaggerThrow) audio.playDaggerThrow(pitchStep);
              else audio.tone(Math.min(1080, 620 + pitchStep * 36), 0.06, 'triangle', 0.08, 0, 960);
            }
            const flightDur = this.spawnProjectile(fromX, fromY, toX, toY, '#7be8ff', { dur: 0.135, arc: 14, kind: 'dagger' });
            await this.waitSec(flightDur);
            if (!this.running) break;

            if (this.boss) {
              this.boss.knockX = Math.max(this.boss.knockX, 13);
              this.boss.flash = 0.13;
              this.boss.squashX = 0.90;
              this.boss.squashY = 1.10;
            }
            this.triggerHitImpact({
              hitstop: 0.034,
              shakeAmp: 3.6,
              shakeDur: 0.10,
              dirX: 1,
              target: 'boss'
            });
            this.spawnVfx(ev.vfx || 'pfx_hit_spark', toX + 12, toY, 1.35, { speedMult: 1.15 });
            this.spawnShockwave(toX + 12, toY, '#7be8ff', 42, 0.18, 3);
            this.spawnParticles(toX + 10, toY, '#7be8ff', 10, 1);
            if (audio) {
              if (audio.playDaggerHit) audio.playDaggerHit(pitchStep);
              else audio.tone(240 + Math.min(260, pitchStep * 22), 0.07, 'square', 0.08, 0, 110);
            }
            this.spawnPopup(BOSS_X, BRIDGE_Y - 132, `-${ev.dmg}`, '#7be8ff', ev.dmg >= 140 ? 30 : 24);
            this._addScoringDamage(ev.dmg, hooks);
            if (hooks.onBossDamage) hooks.onBossDamage(ev.dmg, false);
            else if (hooks.onSyncHud) hooks.onSyncHud();
            await this.waitSec(0.06);
          } else if (ev.isGhost) {
            // ── Phantom Shadow Follow-Up Striker ──
            const ghostStartX = SLOT_X[2] - 40;
            const ghostStrikeX = BOSS_X - 150;
            this.ghostUnit = {
              unitId: ev.unitId || 'sword_w',
              x: ghostStartX,
              homeX: ghostStartX,
              y: BRIDGE_Y,
              knockX: 0,
              squashX: 1.08,
              squashY: 0.92,
              scale: 2.08,
              anim: 'idle',
              animElapsed: 0,
              animDuration: 0.48,
              animSpeedMult: 1,
              animTimer: 0,
              flash: 0.14,
              alpha: 0.82,
              phase: 0
            };
            this.spawnVfx('pfx_spawn_portal', ghostStartX, BRIDGE_Y - 56, 1.25, { speedMult: 1.35 });
            this.spawnPopup(ghostStartX, BRIDGE_Y - 126, `影袭 · ${ev.heroName}`, '#d48cff', 20);
            if (audio) {
              if (audio.playGhostAppear) audio.playGhostAppear();
              else audio.tone(360, 0.09, 'sine', 0.09, 0, 560);
            }
            await this.tweenUnitX(this.ghostUnit, ghostStrikeX, 0.12, { ease: 'outCubic', trailColor: '#d48cff' });
            if (!this.running) break;

            const atk = this.startUnitAttack(this.ghostUnit, 0.46);
            await this.waitSec(atk.impactAt);
            if (!this.running) break;

            if (this.boss) {
              this.boss.knockX = 24;
              this.boss.flash = 0.17;
              this.boss.squashX = 0.85;
              this.boss.squashY = 1.15;
            }
            this.triggerHitImpact({
              hitstop: isHeavy ? 0.072 : 0.054,
              shakeAmp: isHeavy ? 7.5 : 5.5,
              shakeDur: 0.16,
              dirX: 1,
              target: 'boss',
              flashColor: '#d48cff',
              flashAlpha: 0.14
            });
            if (isHeavy) this.triggerZoomPunch(isMega ? 1.046 : 1.028, BOSS_X, BRIDGE_Y - 82, 0.22);
            this.spawnVfx(ev.vfx || 'pfx_void_scythe', BOSS_X - 8, BRIDGE_Y - 82, isHeavy ? 1.85 : 1.55);
            this.spawnShockwave(BOSS_X - 8, BRIDGE_Y - 82, '#d48cff', 66, 0.24, 4);
            this.spawnParticles(BOSS_X - 6, BRIDGE_Y - 82, '#d48cff', 18, 1);
            if (audio) {
              if (audio.playBattleHit) audio.playBattleHit({ step: pitchStep, isHeavy, isMega, isGhost: true, heatLevel: this.scoring ? this.scoring.heatLevel : 0 });
              else audio.tone(180, 0.12, 'sawtooth', 0.10, 0, 88);
            }
            this.spawnPopup(BOSS_X, BRIDGE_Y - 140, `-${ev.dmg}`, '#e5a8ff', isHeavy ? 34 : 28, { big: isHeavy });
            this._addScoringDamage(ev.dmg, hooks);
            if (hooks.onBossDamage) hooks.onBossDamage(ev.dmg, false);
            else if (hooks.onSyncHud) hooks.onSyncHud();

            await this.waitSec(Math.max(0.14, atk.dur - atk.impactAt));
            this.spawnVfx('pfx_spawn_portal', this.ghostUnit.x, BRIDGE_Y - 56, 1.15, { speedMult: 1.5 });
            this.ghostUnit = null;
            await this.waitSec(0.05);
          } else if (actor) {
            // ── Full Choreographed Hero Dash -> Full Attack Clip -> Hit-Stop & Shake -> Retreat ──
            const trailCol = tierTrail(actor.tier);
            const strikeX = Math.max(actor.homeX + 120, BOSS_X - 160 - (2 - ev.slotIdx) * 14);
            // 1) Crisp anticipation crouch + dash dust
            actor.squashX = 1.14;
            actor.squashY = 0.88;
            this.spawnParticles(actor.homeX - 10, BRIDGE_Y - 6, trailCol, 6, -1);
            if (audio) {
              if (audio.playDashWhoosh) audio.playDashWhoosh(pitchStep);
              else {
                const whoosh = Math.min(820, 290 + pitchStep * 36);
                audio.tone(whoosh, 0.08, 'triangle', 0.08, 0, whoosh * 1.32);
              }
            }
            await this.waitSec(0.035);
            if (!this.running) break;

            // 2) Smooth dash-in to actual melee/strike range in front of Boss
            actor.squashX = 1.16;
            actor.squashY = 0.90;
            const dashDist = Math.abs(strikeX - actor.x);
            const dashDur = Math.max(0.10, Math.min(0.16, 0.085 + dashDist / 6500));
            await this.tweenUnitX(actor, strikeX, dashDur, { ease: 'outCubic', trailColor: trailCol, trailEvery: 0.036 });
            if (!this.running) break;

            // 3) Play FULL Duelyst attack clip starting from elapsed = 0
            actor.squashX = 0.94;
            actor.squashY = 1.07;
            const atk = this.startUnitAttack(actor);
            await this.waitSec(atk.impactAt);
            if (!this.running) break;

            // 4) EXACT IMPACT FRAME: Hit-stop + Subtle Directional Screen Shake + Boss Recoil + VFX + Progressive HP Drain!
            const hitstopDur = isMega ? 0.092 : isHeavy ? 0.072 : 0.052;
            const shakeAmp = isMega ? 9.5 : isHeavy ? 7.2 : 5.0;
            const shakeDur = isMega ? 0.21 : isHeavy ? 0.17 : 0.13;
            if (this.boss) {
              this.boss.knockX = isMega ? 34 : isHeavy ? 26 : 19;
              this.boss.flash = isHeavy ? 0.19 : 0.14;
              this.boss.squashX = isHeavy ? 0.82 : 0.88;
              this.boss.squashY = isHeavy ? 1.18 : 1.12;
            }
            actor.squashX = 1.10;
            actor.squashY = 0.93;
            this.triggerHitImpact({
              hitstop: hitstopDur,
              shakeAmp,
              shakeDur,
              dirX: 1,
              target: 'boss',
              flashColor: isMega ? '#fff4cc' : isHeavy ? '#ffd966' : null,
              flashAlpha: isMega ? 0.22 : 0.12
            });
            if (isMega) {
              this.triggerZoomPunch(1.046, BOSS_X - 10, BRIDGE_Y - 84, 0.28);
            } else if (isHeavy) {
              this.triggerZoomPunch(1.024, BOSS_X - 10, BRIDGE_Y - 84, 0.20);
            }

            const vfxKey = ev.vfx || (isMega ? 'pfx_spin_slash' : 'pfx_sword_slash');
            this.spawnVfx(vfxKey, BOSS_X - 8, BRIDGE_Y - 84, isMega ? 1.95 : isHeavy ? 1.75 : 1.58);
            if (isMega) {
              this.spawnVfx('pfx_crit_hit', BOSS_X + 4, BRIDGE_Y - 82, 1.55, { speedMult: 1.1 });
            }
            this.spawnShockwave(BOSS_X - 6, BRIDGE_Y - 82, ev.isRetrigger ? '#ff9a2e' : '#ffd966', isMega ? 92 : isHeavy ? 72 : 54, 0.22, isHeavy ? 4.5 : 3);
            this.spawnParticles(BOSS_X - 10, BRIDGE_Y - 82, ev.isRetrigger ? '#ff9a2e' : '#ffd966', isMega ? 26 : isHeavy ? 18 : 12, 1);

            if (audio) {
              if (audio.playBattleHit) {
                audio.playBattleHit({ step: pitchStep, isHeavy, isMega, isRetrigger: Boolean(ev.isRetrigger), heatLevel: this.scoring ? this.scoring.heatLevel : 0 });
              } else {
                const hitPitch = Math.min(360, 155 + pitchStep * 18);
                audio.tone(hitPitch, isHeavy ? 0.13 : 0.09, 'sawtooth', isHeavy ? 0.13 : 0.10, 0, hitPitch * 0.45);
                audio.tone(Math.min(920, 420 + pitchStep * 45), 0.06, 'triangle', 0.08, 0, 240);
              }
            }

            this.spawnPopup(
              BOSS_X,
              BRIDGE_Y - 138,
              `-${ev.dmg}`,
              ev.isRetrigger ? '#ff9a2e' : (isMega ? '#fff29e' : '#ffd966'),
              isMega ? 40 : isHeavy ? 34 : 28,
              { big: isHeavy || isMega }
            );
            this._addScoringDamage(ev.dmg, hooks);
            if (hooks.onBossDamage) hooks.onBossDamage(ev.dmg, false);
            else if (hooks.onSyncHud) hooks.onSyncHud();

            // 5) Let follow-through frames play cleanly, then smoothly spring-retreat home
            const followDur = Math.max(0.14, Math.min(0.24, atk.dur - atk.impactAt));
            await this.waitSec(followDur);
            if (!this.running) break;

            const retDur = Math.max(0.10, Math.min(0.15, 0.08 + dashDist / 6800));
            await this.tweenUnitX(actor, actor.homeX, retDur, { ease: 'outQuad', trailColor: null });
            actor.squashX = 1.07;
            actor.squashY = 0.94;
            actor.anim = 'idle';
            actor.animTimer = 0;
            await this.waitSec(0.035);
          } else {
            // Fallback strike with no slot actor
            if (this.boss) { this.boss.knockX = 18; this.boss.flash = 0.15; }
            this.triggerHitImpact({ hitstop: 0.048, shakeAmp: 5.5, shakeDur: 0.13, dirX: 1, target: 'boss' });
            this.spawnVfx(ev.vfx || 'pfx_sword_slash', BOSS_X, BRIDGE_Y - 84, 1.6);
            this.spawnParticles(BOSS_X, BRIDGE_Y - 80, '#ffd966', 14, 1);
            this.spawnPopup(BOSS_X, BRIDGE_Y - 136, `-${ev.dmg}`, '#ffd966', 28);
            if (hooks.onBossDamage) hooks.onBossDamage(ev.dmg, false);
            else if (hooks.onSyncHud) hooks.onSyncHud();
            await this.waitSec(0.14);
          }
        } else if (ev.type === 'amp_cast') {
          const actor = this.slotUnits[ev.slotIdx];
          const target = this.slotUnits[ev.slotIdx + 1];
          if (actor) {
            actor.flash = 0.16;
            actor.squashX = 0.92;
            actor.squashY = 1.12;
            const castAtk = this.startUnitAttack(actor, 0.36);
            this.spawnVfx('pfx_holy_pillar', actor.x, BRIDGE_Y - 62, 1.35, { speedMult: 1.25 });
            if (target) {
              const dur = this.spawnProjectile(actor.x + 14, BRIDGE_Y - 68, target.x, BRIDGE_Y - 68, '#ffd966', { dur: 0.15, arc: 36, kind: 'amp' });
              if (audio) {
                if (audio.playAmpCast) audio.playAmpCast();
                else audio.tone(520, 0.12, 'sine', 0.10, 0, 820);
              }
              await this.waitSec(dur);
              target.flash = 0.18;
              target.squashX = 0.92;
              target.squashY = 1.10;
              this.spawnVfx('pfx_collect_burst', target.x, BRIDGE_Y - 62, 1.45, { speedMult: 1.2 });
              this.spawnShockwave(target.x, BRIDGE_Y - 58, '#ffd966', 54, 0.22, 3);
              this.spawnPopup(target.x, BRIDGE_Y - 122, `✦ ${ev.label}`, '#ffd966', 24);
            } else {
              if (audio) {
                if (audio.playAmpCast) audio.playAmpCast();
                else audio.tone(520, 0.12, 'sine', 0.10, 0, 820);
              }
              this.spawnPopup(actor.homeX, BRIDGE_Y - 118, `✦ ${ev.label}`, '#ffd966', 24);
            }
            await this.waitSec(Math.max(0.12, castAtk.dur - 0.15));
            actor.anim = 'idle';
          }
        } else if (ev.type === 'crown_bash') {
          const dur = this.spawnProjectile(380, BRIDGE_Y - 72, BOSS_X - 32, BRIDGE_Y - 84, '#78b7ff', { dur: 0.15, arc: 20, kind: 'shield' });
          if (audio) {
            if (audio.playDashWhoosh) audio.playDashWhoosh(2);
            else audio.tone(360, 0.08, 'triangle', 0.09, 0, 240);
          }
          await this.waitSec(dur);
          if (!this.running) break;
          if (this.boss) {
            this.boss.knockX = 16;
            this.boss.flash = 0.14;
            this.boss.squashX = 0.89;
            this.boss.squashY = 1.11;
          }
          this.triggerHitImpact({ hitstop: 0.042, shakeAmp: 4.8, shakeDur: 0.12, dirX: 1, target: 'boss' });
          this.spawnVfx('pfx_parry', BOSS_X - 8, BRIDGE_Y - 84, 1.55);
          this.spawnShockwave(BOSS_X - 8, BRIDGE_Y - 84, '#78b7ff', 52, 0.20, 3.5);
          this.spawnParticles(BOSS_X - 10, BRIDGE_Y - 84, '#78b7ff', 14, 1);
          this.spawnPopup(BOSS_X, BRIDGE_Y - 152, `盾击 -${ev.dmg}`, '#78b7ff', 26);
          if (audio) {
            if (audio.playShieldBash) audio.playShieldBash();
            else audio.tone(240, 0.09, 'square', 0.09, 0, 140);
          }
          this._addScoringDamage(ev.dmg, hooks);
          if (hooks.onBossDamage) hooks.onBossDamage(ev.dmg, false);
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.11);
        } else if (ev.type === 'poison_apply') {
          this.spawnVfx('pfx_acid_splash', BOSS_X, BRIDGE_Y - 86, 1.2, { speedMult: 1.35 });
          this.spawnParticles(BOSS_X, BRIDGE_Y - 90, '#7ef28a', 10);
          this.spawnPopup(BOSS_X + 34, BRIDGE_Y - 114, `+${ev.stacks} 剧毒`, '#7ef28a', 22);
          if (audio) {
            if (audio.playPoisonApply) audio.playPoisonApply();
            else audio.tone(310, 0.06, 'sine', 0.07, 0, 440);
          }
          if (hooks.onBossStatus) hooks.onBossStatus({ addPoison: ev.stacks });
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.075);
        } else if (ev.type === 'poison_detonate' || ev.type === 'poison_tick') {
          if (this.boss) {
            this.boss.knockX = 16;
            this.boss.flash = 0.16;
            this.boss.squashX = 0.88;
            this.boss.squashY = 1.12;
          }
          this.triggerHitImpact({
            hitstop: 0.068,
            shakeAmp: 7.2,
            shakeDur: 0.17,
            dirX: 1,
            target: 'boss',
            flashColor: '#7ef28a',
            flashAlpha: 0.16
          });
          this.triggerZoomPunch(1.032, BOSS_X, BRIDGE_Y - 88, 0.24);
          this.spawnVfx('pfx_spore_burst', BOSS_X, BRIDGE_Y - 88, 1.85);
          this.spawnShockwave(BOSS_X, BRIDGE_Y - 88, '#7ef28a', 78, 0.24, 4);
          this.spawnParticles(BOSS_X, BRIDGE_Y - 88, '#7ef28a', 24);
          this.spawnPopup(BOSS_X, BRIDGE_Y - 150, `毒爆 -${ev.dmg}`, '#7ef28a', 34, { big: true });
          if (audio) {
            if (audio.playPoisonDetonate) audio.playPoisonDetonate();
            else audio.tone(175, 0.16, 'sawtooth', 0.11, 0, 88);
          }
          this._addScoringDamage(ev.dmg, hooks);
          if (hooks.onBossDamage) hooks.onBossDamage(ev.dmg, true);
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.22);
        } else if (ev.type === 'furnace_proc') {
          this.spawnVfx('pfx_flame_pillar', 405, BRIDGE_Y - 86, 1.45);
          this.spawnParticles(405, BRIDGE_Y - 86, '#ffd966', 18);
          this.spawnPopup(405, BRIDGE_Y - 145, `炼金炉 +${ev.gold}G · 手牌+${ev.handAtkGain}攻`, '#ffd966', 24);
          if (audio) {
            if (audio.playCoin) audio.playCoin();
            else audio.tone(480, 0.11, 'triangle', 0.09, 0, 720);
          }
          if (hooks.onGoldGain) hooks.onGoldGain(ev.gold);
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.22);
        } else if (ev.type === 'boss_vuln') {
          this.spawnVfx('pfx_vuln_sigil', BOSS_X, BRIDGE_Y - 82, 1.35, { speedMult: 1.25 });
          this.spawnPopup(BOSS_X, BRIDGE_Y - 172, '易伤 ×1.4!', '#ff8a5c', 24);
          if (audio) audio.tone(280, 0.09, 'sawtooth', 0.07, 0, 170, { filterFreq: 900 });
          if (hooks.onBossStatus) hooks.onBossStatus({ vuln: true });
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.08);
        } else if (ev.type === 'boss_break') {
          if (this.boss) {
            this.boss.knockX = 32;
            this.boss.flash = 0.24;
            this.boss.squashX = 0.82;
            this.boss.squashY = 1.18;
          }
          this.triggerHitImpact({
            hitstop: 0.095,
            shakeAmp: 10.5,
            shakeDur: 0.24,
            dirX: 1,
            target: 'boss',
            flashColor: '#ffd966',
            flashAlpha: 0.28,
            flashDur: 0.20
          });
          this.triggerZoomPunch(1.05, BOSS_X, BRIDGE_Y - 84, 0.30);
          this.spawnVfx('pfx_holy_smite', BOSS_X, BRIDGE_Y - 84, 1.85);
          this.spawnShockwave(BOSS_X, BRIDGE_Y - 84, '#ffd966', 105, 0.28, 5);
          this.spawnParticles(BOSS_X, BRIDGE_Y - 84, '#ffd966', 26);
          this.spawnPopup(BOSS_X, BRIDGE_Y - 190, '破招眩晕! ×1.5', '#ffd966', 34, { big: true });
          if (audio) {
            if (audio.playBreakStun) audio.playBreakStun();
            else audio.tone(440, 0.14, 'square', 0.12, 0, 880);
          }
          if (hooks.onBossStatus) hooks.onBossStatus({ stunned: true });
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.24);
        } else if (ev.type === 'boss_shield') {
          this.spawnVfx('pfx_shield_block', BOSS_X, BRIDGE_Y - 76, 1.65, { flipX: true });
          this.spawnPopup(BOSS_X, BRIDGE_Y - 154, `+${ev.amount} 魔盾`, '#7be8ff', 24);
          if (audio) {
            if (audio.playShieldGain) audio.playShieldGain();
            else audio.tone(420, 0.10, 'sine', 0.09, 0, 620);
          }
          if (hooks.onBossStatus) hooks.onBossStatus({ addShield: ev.amount });
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.16);
        } else if (ev.type === 'shield_gain') {
          const sx = (this.slotUnits[lastHeroSlotIdx] ? this.slotUnits[lastHeroSlotIdx].homeX : SLOT_X[0]);
          this.spawnVfx('pfx_shield_block', sx, BRIDGE_Y - 58, 1.35, { speedMult: 1.25 });
          this.spawnParticles(sx, BRIDGE_Y - 58, '#7be8ff', 8);
          this.spawnPopup(sx, BRIDGE_Y - 114, `+${ev.amount} 蓝盾`, '#78b7ff', 22);
          if (audio) {
            if (audio.playShieldGain) audio.playShieldGain();
            else audio.tone(460, 0.07, 'sine', 0.07, 0, 640);
          }
          if (hooks.onShieldGain) hooks.onShieldGain(ev.amount);
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.065);
        } else if (ev.type === 'shield_consume') {
          const sx = (this.slotUnits[lastHeroSlotIdx] ? this.slotUnits[lastHeroSlotIdx].homeX : SLOT_X[1]);
          this.spawnParticles(sx, BRIDGE_Y - 64, '#7be8ff', 10);
          this.spawnPopup(sx, BRIDGE_Y - 128, `燃盾 -${ev.amount}`, '#7be8ff', 20);
          if (hooks.onShieldGain) hooks.onShieldGain(-ev.amount);
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.055);
        } else if (ev.type === 'gold_gain') {
          const gx = (this.slotUnits[lastHeroSlotIdx] ? this.slotUnits[lastHeroSlotIdx].homeX : 405);
          this.spawnParticles(gx, BRIDGE_Y - 76, '#ffd966', 10);
          this.spawnPopup(gx, BRIDGE_Y - 134, `+${ev.amount}G`, '#ffd966', 24);
          if (audio) {
            if (audio.playCoin) audio.playCoin();
            else audio.tone(680, 0.06, 'triangle', 0.08, 0, 980);
          }
          if (hooks.onGoldGain) hooks.onGoldGain(ev.amount);
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.065);
        } else if (ev.type === 'hero_grow') {
          const u = this.slotUnits.find((x) => x && x.uid === ev.heroUid) || this.slotUnits[lastHeroSlotIdx];
          const gx = u ? u.homeX : 405;
          if (u) { u.flash = 0.12; u.squashX = 0.94; u.squashY = 1.08; }
          this.spawnVfx('pfx_collect_burst', gx, BRIDGE_Y - 60, 1.25, { speedMult: 1.35 });
          this.spawnPopup(gx, BRIDGE_Y - 148, `✦ ${ev.text}`, '#ffd966', 21);
          if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.065);
        } else if (ev.type === 'hand_grow') {
          this.spawnParticles(520, BRIDGE_Y + 26, '#7ef28a', 8);
          this.spawnPopup(520, BRIDGE_Y - 32, `手牌 +${ev.amount} 攻`, '#7ef28a', 20);
          await this.waitSec(0.05);
        } else if (ev.type === 'thorns_hit') {
          const u = this.slotUnits[lastHeroSlotIdx] || this.slotUnits.find(Boolean);
          const tx = u ? u.x : SLOT_X[1];
          const dur = this.spawnProjectile(BOSS_X - 40, BRIDGE_Y - 78, tx, BRIDGE_Y - 62, '#a8ff78', { dur: 0.11, arc: 12, kind: 'thorn' });
          await this.waitSec(dur);
          if (u) { u.knockX = -12; u.flash = 0.12; }
          this.triggerHitImpact({ hitstop: 0.032, shakeAmp: 3.4, shakeDur: 0.09, dirX: -1, target: 'squad' });
          this.spawnParticles(tx, BRIDGE_Y - 64, '#a8ff78', 8, -1);
          this.spawnPopup(tx, BRIDGE_Y - 122, `反伤 -${ev.dmg}`, '#a8ff78', 22);
          if (audio) {
            if (audio.playThornsHit) audio.playThornsHit();
            else audio.tone(210, 0.07, 'square', 0.07, 0, 130);
          }
          if (hooks.onSquadDamage) hooks.onSquadDamage({ rawDmg: ev.dmg, isThorns: true });
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.07);
        } else if (ev.type === 'relic_grow' && hooks.onRelicPulse) {
          hooks.onRelicPulse(ev.relicUid, ev.text);
        } else if (ev.type === 'boss_attack') {
          const isUlt = this.bossIntent && this.bossIntent.kind === 'ult';
          const sName = (this.bossIntent && this.bossIntent.skillName) || '重击';
          const sCol = (this.bossIntent && this.bossIntent.color) || '#ff477e';
          if (isUlt) {
            this.triggerCutIn(`✦ ${sName} ✦`, ev.hpLost > 0 ? `承受 ${ev.hpLost} 伤害` : `完美格挡 ${ev.blocked} 伤`, sCol);
          }

          if (this.boss) {
            // 1) Boss windup crouch + smooth heavy lunge forward
            this.boss.squashX = 1.12;
            this.boss.squashY = 0.90;
            this.spawnParticles(this.boss.homeX + 20, BRIDGE_Y - 10, '#ff5e8e', 10, 1);
            if (audio) {
              if (audio.playBossWindup) audio.playBossWindup(isUlt);
              else audio.tone(110, 0.12, 'sawtooth', 0.09, 0, 165);
            }
            await this.waitSec(0.06);
            if (!this.running) break;

            const lungeX = SLOT_X[2] + 150;
            await this.tweenUnitX(this.boss, lungeX, 0.15, { ease: 'outCubic', trailColor: '#ff477e', trailEvery: 0.04 });
            if (!this.running) break;

            // 2) Play Boss's FULL Duelyst attack animation starting from 0!
            const bAtk = this.startUnitAttack(this.boss, isUlt ? 0.68 : 0.56);
            await this.waitSec(bAtk.impactAt);
            if (!this.running) break;

            // 3) EXACT IMPACT: Hit-stop + directional shake + squad recoil / hex shield block VFX!
            const hitCenter = 405;
            const fullBlocked = ev.hpLost <= 0;
            this.triggerHitImpact({
              hitstop: isUlt ? 0.095 : fullBlocked ? 0.056 : 0.072,
              shakeAmp: isUlt ? 11 : fullBlocked ? 5.2 : 8.5,
              shakeDur: isUlt ? 0.24 : 0.18,
              dirX: -1,
              target: 'squad',
              flashColor: fullBlocked ? '#78b7ff' : '#ff4757',
              flashAlpha: isUlt ? 0.30 : 0.20,
              flashDur: 0.16
            });
            if (isUlt || !fullBlocked) {
              this.triggerZoomPunch(isUlt ? 1.05 : 1.028, hitCenter, BRIDGE_Y - 76, isUlt ? 0.30 : 0.22);
            }

            if (fullBlocked) {
              this.spawnVfx('pfx_shield_block', hitCenter, BRIDGE_Y - 72, 1.9);
              this.spawnShockwave(hitCenter, BRIDGE_Y - 72, '#78b7ff', 82, 0.24, 4);
              this.spawnParticles(hitCenter, BRIDGE_Y - 72, '#7be8ff', 18, -1);
            } else {
              const bossAtkVfx = isUlt ? 'pfx_ground_slam' : ((this.boss && this.boss.vfx) || 'pfx_blunt_hit');
              this.spawnVfx(bossAtkVfx, hitCenter, BRIDGE_Y - 76, isUlt ? 1.95 : 1.75, { flipX: true });
              this.spawnShockwave(hitCenter, BRIDGE_Y - 76, '#ff4757', isUlt ? 105 : 78, 0.24, 4.5);
              this.spawnParticles(hitCenter, BRIDGE_Y - 76, '#ff5c72', isUlt ? 26 : 18, -1);
            }
            if (audio) {
              if (audio.playBossSlam) audio.playBossSlam(isUlt, fullBlocked);
              else if (fullBlocked) {
                audio.tone(520, 0.09, 'triangle', 0.11, 0, 740);
                audio.tone(240, 0.12, 'sine', 0.09, 0, 180);
              } else {
                audio.tone(115, 0.20, 'sawtooth', 0.13, 0, 48);
              }
            }

            // Recoil all active bridge heroes on impact
            for (const u of this.slotUnits) {
              if (!u) continue;
              u.knockX = fullBlocked ? -10 : (isUlt ? -26 : -18);
              u.flash = fullBlocked ? 0.10 : 0.18;
              u.squashX = fullBlocked ? 0.94 : 0.85;
              u.squashY = fullBlocked ? 1.06 : 1.15;
            }

            const msg = ev.hpLost > 0
              ? `${sName} -${ev.hpLost} HP${ev.blocked > 0 ? ` (挡${ev.blocked})` : ''}`
              : `完美格挡 ${ev.blocked} 伤!`;
            this.spawnPopup(hitCenter, BRIDGE_Y - 134, msg, ev.hpLost > 0 ? '#ff5c72' : '#78b7ff', isUlt ? 32 : 28, { big: isUlt });
            if (hooks.onSquadDamage) hooks.onSquadDamage(ev);
            else if (hooks.onSyncHud) hooks.onSyncHud();

            // 4) Follow-through + smooth Boss retreat back to BOSS_X
            await this.waitSec(Math.max(0.16, bAtk.dur - bAtk.impactAt));
            if (!this.running) break;
            await this.tweenUnitX(this.boss, BOSS_X, 0.18, { ease: 'outQuad' });
            this.boss.anim = 'idle';
            this.boss.animTimer = 0;
            await this.waitSec(0.06);
          }
        } else if (ev.type === 'revenge_hit') {
          const dur = this.spawnProjectile(405, BRIDGE_Y - 72, BOSS_X - 24, BRIDGE_Y - 82, '#78b7ff', { dur: 0.14, arc: 14, kind: 'shield' });
          await this.waitSec(dur);
          if (!this.running) break;
          if (this.boss) {
            this.boss.knockX = 28;
            this.boss.flash = 0.20;
            this.boss.squashX = 0.84;
            this.boss.squashY = 1.16;
          }
          this.triggerHitImpact({
            hitstop: 0.075,
            shakeAmp: 8.8,
            shakeDur: 0.19,
            dirX: 1,
            target: 'boss',
            flashColor: '#78b7ff',
            flashAlpha: 0.18
          });
          this.triggerZoomPunch(1.036, BOSS_X, BRIDGE_Y - 84, 0.24);
          this.spawnVfx('pfx_hammer_smash', BOSS_X, BRIDGE_Y - 84, 1.85);
          this.spawnShockwave(BOSS_X, BRIDGE_Y - 84, '#78b7ff', 88, 0.26, 4.5);
          this.spawnParticles(BOSS_X, BRIDGE_Y - 84, '#78b7ff', 22, 1);
          this.spawnPopup(BOSS_X, BRIDGE_Y - 155, `反震 -${ev.dmg}!`, '#78b7ff', 34, { big: true });
          if (audio) {
            if (audio.playRevengeHit) audio.playRevengeHit();
            else audio.tone(190, 0.15, 'sawtooth', 0.12, 0, 92);
          }
          this._addScoringDamage(ev.dmg, hooks);
          if (hooks.onBossDamage) hooks.onBossDamage(ev.dmg, false);
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.22);
        } else if (ev.type === 'toast' && hooks.onToast) {
          hooks.onToast(ev.text);
        }
      }
    }

    // ─── Nocturnal Mist & Pale-Moon Mirror Bridge Backdrop (Low-Saturation HD-2D) ───
    getUpperBgCanvas(biome) {
      if (this.bgCache[biome]) return this.bgCache[biome];
      const pal = NOCTURNE_PALETTES[biome] || NOCTURNE_PALETTES.default;
      const c = document.createElement('canvas');
      c.width = VW; c.height = BRIDGE_VY + 8;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // 1. Calm deep nocturnal sky gradient (darkest at top behind HUD, soft mist rise at horizon)
      const sky = ctx.createLinearGradient(0, 0, 0, BRIDGE_VY);
      sky.addColorStop(0, pal.skyTop);
      sky.addColorStop(0.54, pal.skyMid);
      sky.addColorStop(1, pal.skyLow);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, VW, BRIDGE_VY + 8);

      // 2. Sparse muted pinpoint stars in upper half (never cluttered)
      for (let i = 0; i < 28; i++) {
        const sx = Math.floor(hash2(i, 1, 7) * VW);
        const sy = 5 + Math.floor(hash2(i, 2, 13) * 44);
        const bright = hash2(i, 3, 29);
        ctx.fillStyle = bright > 0.72 ? 'rgba(220, 232, 248, 0.42)' : 'rgba(182, 198, 224, 0.22)';
        ctx.fillRect(sx, sy, 1, 1);
      }

      // 3. Pale Cold Moon placed cleanly in open sky between Central Forecast and Boss HP bar
      const mx = 182;
      const my = 36;
      const mg = ctx.createRadialGradient(mx, my, 8, mx, my, 42);
      mg.addColorStop(0, `rgba(${pal.moonGlow}, 0.16)`);
      mg.addColorStop(0.45, `rgba(${pal.moonGlow}, 0.06)`);
      mg.addColorStop(1, `rgba(${pal.moonGlow}, 0)`);
      ctx.fillStyle = mg;
      ctx.fillRect(mx - 44, my - 44, 88, 88);
      this.drawPixelDisc(ctx, mx, my, 10, pal.moonCore);
      // Subtle lunar maria craters
      this.drawPixelDisc(ctx, mx - 3, my - 2, 3, pal.moonShade);
      this.drawPixelDisc(ctx, mx + 3, my + 2, 2, pal.moonShade);
      ctx.fillStyle = pal.moonShade;
      ctx.fillRect(mx - 1, my + 4, 3, 2);

      // 4. Sculpted wind-sheared nocturnal pixel cloud bands (replaces repetitive circular disc blobs!)
      this.drawMergedCloudBank(ctx, [
        { x: 6,   y: 52, w: 94,  h: 10, seed: 1.2 },
        { x: 84,  y: 46, w: 108, h: 12, seed: 2.7 },
        { x: 178, y: 50, w: 92,  h: 10, seed: 4.1 },
        { x: 242, y: 45, w: 84,  h: 11, seed: 5.5 },
        { x: 34,  y: 66, w: 124, h: 8,  seed: 6.8 },
        { x: 162, y: 65, w: 136, h: 9,  seed: 8.3 }
      ], pal.cloudHi, pal.cloudMid, pal.cloudDark);

      // 5. Far mountain ridge silhouette (ultra-low contrast, zero harsh outlines)
      ctx.fillStyle = pal.farHill;
      for (let x = 0; x < VW; x++) {
        const h = Math.round(
          17 + Math.sin(x * 0.028 + 0.6) * 7
          + Math.sin(x * 0.071) * 4
          + Math.cos(x * 0.13) * 2
        );
        ctx.fillRect(x, BRIDGE_VY - h, 1, h);
      }

      // 6. Distant subtle architectural silhouettes: far-left tavern edge & far-right ruined spires
      // Far-left midnight tavern gable + distant quiet pines (vx = 0..48, safely outside combat focus)
      ctx.fillStyle = pal.midSil;
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(0, 62 + i, 12 + i, 1);
      }
      ctx.fillRect(0, 72, 22, BRIDGE_VY - 72);
      // Muted warm tavern window glow (links world to Midnight Tavern without competing with UI)
      ctx.fillStyle = 'rgba(218, 158, 76, 0.24)';
      ctx.fillRect(4, 77, 10, 14);
      ctx.fillStyle = '#c48d44';
      ctx.fillRect(6, 79, 6, 10);
      ctx.fillStyle = '#e8c17d';
      ctx.fillRect(7, 81, 4, 4);
      ctx.fillStyle = pal.nearSil;
      ctx.fillRect(8, 79, 1, 10);
      ctx.fillRect(6, 84, 6, 1);

      // Soft muted far-left pine silhouettes (no bright cyan, no heavy ink boxes)
      for (const [px, ph] of [[30, 26], [44, 21], [58, 17], [74, 14]]) {
        for (let row = 0; row < ph; row++) {
          const hw = Math.max(1, Math.round((row / ph) * (ph * 0.28)) + (row % 5 === 0 ? -1 : 0));
          ctx.fillStyle = pal.midSil;
          ctx.fillRect(px - hw, BRIDGE_VY - ph + row, hw * 2 + 1, 1);
        }
      }

      // Far-right ruined gothic watchtower & broken arches (vx = 258..320, muted slate-black)
      const spires = [
        { cx: 274, h: 30, w: 6 },
        { cx: 292, h: 42, w: 8 },
        { cx: 310, h: 34, w: 7 }
      ];
      ctx.fillStyle = pal.midSil;
      for (let x = 248; x < VW; x++) {
        const h = Math.max(8, Math.round(13 + Math.sin(x * 0.11) * 4 + (Math.floor(x / 6) % 2 === 0 ? 3 : 0)));
        ctx.fillRect(x, BRIDGE_VY - h, 1, h);
      }
      for (const sp of spires) {
        for (let dy = 0; dy < sp.h; dy++) {
          const t = dy / sp.h;
          const hw = Math.max(1, Math.round((0.32 + t * 0.68) * (sp.w * 0.55)));
          ctx.fillRect(sp.cx - hw, BRIDGE_VY - sp.h + dy, hw * 2 + 1, 1);
        }
      }
      // Subtle moon-rim edge along the left face of the right watchtower
      ctx.fillStyle = `rgba(${pal.moonGlow}, 0.14)`;
      ctx.fillRect(288, BRIDGE_VY - 40, 1, 24);
      ctx.fillRect(271, BRIDGE_VY - 28, 1, 14);

      // 7. Distant iron bridge lamp post on far-left (vx = 17 -> screen x = 68px, far from Slot 1)
      ctx.fillStyle = pal.nearSil;
      ctx.fillRect(17, BRIDGE_VY - 30, 2, 30);
      ctx.fillRect(15, BRIDGE_VY - 30, 6, 2);
      ctx.fillRect(16, BRIDGE_VY - 28, 4, 5);
      ctx.fillStyle = '#d9a452';
      ctx.fillRect(17, BRIDGE_VY - 27, 2, 3);
      ctx.fillStyle = '#fff0c4';
      ctx.fillRect(17, BRIDGE_VY - 26, 2, 1);

      // 8. Soft horizon fog veil uniting sky and bridge without harsh edges
      const fog = ctx.createLinearGradient(0, BRIDGE_VY - 28, 0, BRIDGE_VY);
      fog.addColorStop(0, `rgba(${pal.mistRgb}, 0)`);
      fog.addColorStop(1, `rgba(${pal.mistRgb}, 0.14)`);
      ctx.fillStyle = fog;
      ctx.fillRect(0, BRIDGE_VY - 28, VW, 28);

      this.bgCache[biome] = c;
      return c;
    }

    drawMergedCloudBank(ctx, ribbons, colHi, colMid, colDark) {
      // Organic wind-sheared pixel cloud decks (flat mist underside, stepped billowy top crest)
      for (const c of ribbons) {
        const seed = c.seed || 1;
        for (let dx = 0; dx < c.w; dx++) {
          const px = c.x + dx;
          if (px < 0 || px >= VW) continue;
          const u = dx / Math.max(1, c.w - 1);
          const env = Math.sin(u * Math.PI);
          if (env < 0.08) continue;
          const crest =
            0.48 +
            0.28 * Math.sin(u * 8.2 + seed) +
            0.16 * Math.cos(u * 15.5 - seed * 1.4) +
            0.08 * Math.sin(u * 27.0 + seed * 2.1);
          const topH = Math.max(1, Math.round(env * crest * c.h));
          const botH = Math.max(1, Math.round(env * 2));
          const yTop = c.y - topH;
          const yBot = c.y + botH;
          for (let py = yTop; py <= yBot; py++) {
            const p = (py - yTop) / Math.max(1, yBot - yTop);
            ctx.fillStyle = p < 0.25 ? colHi : p < 0.65 ? colMid : colDark;
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    }
    drawPixelDisc(ctx, cx, cy, r, color) {
      ctx.fillStyle = color;
      const r2 = r * r;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r2) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
    drawStoneBridge(ctx) {
      const pal = NOCTURNE_PALETTES[this.biome] || NOCTURNE_PALETTES.default;
      const y = BRIDGE_Y, h = LAKE_Y - BRIDGE_Y;
      const heat = (this.scoring && this.scoring.heatLevel) || 0;
      const rimPulse = 0.72 + 0.28 * Math.sin(this.idleTime * 2.2);

      ctx.fillStyle = '#070810'; ctx.fillRect(0, y - 4, BW, 4);
      const rim = ctx.createLinearGradient(0, 0, BW, 0);
      rim.addColorStop(0, pal.rimL); rim.addColorStop(0.55, pal.rimM); rim.addColorStop(1, pal.rimR);
      ctx.fillStyle = rim; ctx.fillRect(0, y, BW, 4);

      // Luminous hero-tinted stone coping edge sheen (brightens gently with heat!)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const sheen = ctx.createLinearGradient(0, y, BW, y);
      const accAlpha = (0.28 + heat * 0.11) * rimPulse;
      const acc2Alpha = (0.18 + heat * 0.08) * rimPulse;
      sheen.addColorStop(0, `rgba(${this.heroAccRgb}, ${(accAlpha * 0.35).toFixed(3)})`);
      sheen.addColorStop(0.26, `rgba(${this.heroAccRgb}, ${accAlpha.toFixed(3)})`);
      sheen.addColorStop(0.58, `rgba(255, 248, 224, ${(accAlpha * 0.82).toFixed(3)})`);
      sheen.addColorStop(0.84, `rgba(${this.heroAcc2Rgb}, ${acc2Alpha.toFixed(3)})`);
      sheen.addColorStop(1, `rgba(${this.heroAcc2Rgb}, 0.04)`);
      ctx.fillStyle = sheen;
      ctx.fillRect(0, y, BW, 3);
      // Soft moonlight specular under active hero slots
      for (let i = 0; i < 3; i++) {
        if (!this.slotUnits[i]) continue;
        const sx = SLOT_X[i];
        const sg = ctx.createLinearGradient(sx - 56, y, sx + 56, y);
        sg.addColorStop(0, `rgba(${this.heroAccRgb}, 0)`);
        sg.addColorStop(0.5, `rgba(${this.heroAccRgb}, ${(0.36 * rimPulse).toFixed(3)})`);
        sg.addColorStop(1, `rgba(${this.heroAccRgb}, 0)`);
        ctx.fillStyle = sg;
        ctx.fillRect(sx - 56, y - 1, 112, 4);
      }
      ctx.restore();

      ctx.fillStyle = '#262d40'; ctx.fillRect(0, y + 4, BW, 12);
      ctx.fillStyle = '#171c2b'; ctx.fillRect(0, y + 16, BW, 12);
      for (let bx = 0; bx < BW; bx += 48) { ctx.fillStyle = '#0c0f1a'; ctx.fillRect(bx, y + 4, 4, 12); ctx.fillRect(bx + 24, y + 16, 4, 12); }
      ctx.fillStyle = '#06070f'; ctx.fillRect(0, y + h - 4, BW, 4);
    }

    loop(ts) {
      if (!this.running) return;
      if (window.MT.perf && !window.MT.perf.gate(this, 'game')) { this.rafId = requestAnimationFrame((t) => this.loop(t)); return; }
      const rawDt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
      this.lastTs = ts;
      const dt = rawDt * this.speed;

      // Always tick screen shake, zoom punch, scoring flames, flash & cut-in smoothly even during hit-stop!
      if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - rawDt);
      this._updateScoring(rawDt);
      if (this.zoomPunch) {
        this.zoomPunch.time -= rawDt;
        if (this.zoomPunch.time <= 0) this.zoomPunch = null;
      }
      if (this.screenFlash) {
        this.screenFlash.dur -= rawDt;
        if (this.screenFlash.dur <= 0) this.screenFlash = null;
      }
      if (this.cutIn) {
        this.cutIn.life -= rawDt;
        if (this.cutIn.life <= 0) this.cutIn = null;
      }

      if (this.hitstop > 0) {
        // Hit-stop freezes unit strike frames, movement tweens & choreography waiters,
        // while keeping sparks/VFX/popups ticking at crisp slow-motion so impact feels tactile, NEVER laggy!
        this.hitstop = Math.max(0, this.hitstop - rawDt);
        if (this.hitstop <= 0) this.hitstopTarget = null;
        this.updateEffectsOnly(dt * 0.22);
      } else {
        this.time += dt;
        this.idleTime += rawDt;
        this.update(dt);
      }
      this.render();
      this.rafId = requestAnimationFrame((t) => this.loop(t));
    }

    updateEffectsOnly(dt) {
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const p = this.popups[i];
        p.age = (p.age || 0) + dt;
        p.y += p.vy * dt;
        p.vy *= Math.pow(0.92, dt * 60);
        p.life -= dt;
        if (p.life <= 0) this.popups.splice(i, 1);
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.px = pt.x; pt.py = pt.y;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 420 * dt;
        pt.life -= dt;
        if (pt.life <= 0) this.particles.splice(i, 1);
      }
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.t += dt;
        if (sw.t >= sw.dur) this.shockwaves.splice(i, 1);
      }
      if (window.MT.vfx && window.MT.vfx.update) {
        for (let i = this.activeVfx.length - 1; i >= 0; i--) {
          window.MT.vfx.update(this.activeVfx[i], dt);
          if (this.activeVfx[i].done) this.activeVfx.splice(i, 1);
        }
      }
    }

    update(dt) {
      // Tick choreography waiters on the exact same combat clock
      for (let i = this._waiters.length - 1; i >= 0; i--) {
        const w = this._waiters[i];
        w.rem -= dt;
        if (w.rem <= 0) {
          this._waiters.splice(i, 1);
          w.resolve();
        }
      }

      // Tick smooth unit dash/retreat tweens
      for (let i = this._tweens.length - 1; i >= 0; i--) {
        const tw = this._tweens[i];
        tw.t += dt;
        const p = Math.min(1, tw.t / tw.dur);
        let k = p;
        if (tw.ease === 'outCubic') k = 1 - Math.pow(1 - p, 3);
        else if (tw.ease === 'outQuad') k = 1 - Math.pow(1 - p, 2);
        else if (tw.ease === 'inOutQuad') k = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        tw.unit.x = tw.fromX + (tw.toX - tw.fromX) * k;
        if (tw.trailColor && p < 0.92) {
          tw.trailAcc += dt;
          if (tw.trailAcc >= tw.trailEvery) {
            tw.trailAcc = 0;
            this.spawnAfterimage(tw.unit, tw.trailColor, 0.42);
          }
        }
        if (p >= 1) {
          tw.unit.x = tw.toX;
          this._tweens.splice(i, 1);
          tw.resolve();
        }
      }

      for (const m of this.ambientMotes) {
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.y < 30) { m.y = BRIDGE_Y - 12; m.x = Math.random() * BW; }
        if (m.x < 0) m.x = BW;
        if (m.x > BW) m.x = 0;
      }

      const relaxUnit = (u) => {
        if (!u) return;
        u.knockX = (u.knockX || 0) * Math.pow(0.0006, dt);
        if (Math.abs(u.knockX) < 0.25) u.knockX = 0;
        const sqRelax = 1 - Math.pow(0.001, dt);
        u.squashX = (u.squashX || 1) + (1 - (u.squashX || 1)) * sqRelax;
        u.squashY = (u.squashY || 1) + (1 - (u.squashY || 1)) * sqRelax;
        if (u.flash > 0) u.flash = Math.max(0, u.flash - dt);
        if (u.anim === 'attack') {
          u.animElapsed = (u.animElapsed || 0) + dt;
          if (u.animTimer > 0) {
            u.animTimer -= dt;
            if (u.animTimer <= 0) {
              u.anim = 'idle';
              u.animElapsed = 0;
            }
          }
        }
      };

      relaxUnit(this.boss);
      if (this.boss && this.boss.dying) {
        this.boss.deathElapsed += dt;
        const prog = Math.min(1, this.boss.deathElapsed / this.boss.deathDur);
        this.boss.deathEmitAcc = (this.boss.deathEmitAcc || 0) + dt;
        if (this.boss.deathEmitAcc >= 0.04) {
          this.boss.deathEmitAcc = 0;
          for (let k = 0; k < 5; k++) {
            const sx = this.boss.x + (Math.random() - 0.5) * 92;
            const sy = BRIDGE_Y - 12 - Math.random() * 134;
            this.particles.push({
              x: sx, y: sy, px: sx, py: sy,
              vx: (Math.random() - 0.5) * 64,
              vy: -95 - Math.random() * 155 - prog * 68,
              size: Math.random() < 0.45 ? 5 : 3.5,
              color: Math.random() < 0.58 ? '#fff2b0' : '#ff7aa8',
              life: 0.40 + Math.random() * 0.30,
              maxLife: 0.70
            });
          }
        }
        // Mid-dissolution secondary shatter + heroes victory hop!
        if (!this.boss.deathMidBurst && prog >= 0.44) {
          this.boss.deathMidBurst = true;
          this.spawnVfx('pfx_crit_hit', this.boss.x, BRIDGE_Y - 84, 1.8, { speedMult: 1.0 });
          this.spawnShockwave(this.boss.x, BRIDGE_Y - 84, '#ffd966', 110, 0.34, 4);
          this.triggerShake(7.5, 0.18, 1);
          for (const u of this.slotUnits) {
            if (!u) continue;
            u.squashX = 0.88;
            u.squashY = 1.15;
            u.flash = 0.14;
          }
        }
        // Final shatter burst: golden loot sparks fountain!
        if (!this.boss.deathEndBurst && prog >= 0.86) {
          this.boss.deathEndBurst = true;
          this.spawnShockwave(this.boss.x, BRIDGE_Y - 76, '#ffe699', 140, 0.42, 4.5);
          for (let k = 0; k < 28; k++) {
            const ang = -Math.PI * (0.12 + Math.random() * 0.76);
            const spd = 130 + Math.random() * 240;
            this.particles.push({
              x: this.boss.x + (Math.random() - 0.5) * 32,
              y: BRIDGE_Y - 74 + (Math.random() - 0.5) * 36,
              px: this.boss.x,
              py: BRIDGE_Y - 74,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd - 45,
              size: Math.random() < 0.55 ? 5 : 4,
              color: Math.random() < 0.72 ? '#ffd966' : '#fff7d4',
              life: 0.55 + Math.random() * 0.40,
              maxLife: 0.95
            });
          }
        }
        if (this.boss.deathElapsed >= this.boss.deathDur) {
          this.boss.dying = false;
          this.boss.alive = false;
        }
      }
      relaxUnit(this.ghostUnit);
      for (const u of this.slotUnits) relaxUnit(u);

      for (let i = this.afterimages.length - 1; i >= 0; i--) {
        const ai = this.afterimages[i];
        ai.life -= dt;
        if (ai.life <= 0) this.afterimages.splice(i, 1);
      }

      this.updateEffectsOnly(dt);

      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        pr.px = pr.x; pr.py = pr.y;
        pr.t += dt;
        const k = Math.min(1, pr.t / pr.dur);
        pr.x = pr.fromX + (pr.toX - pr.fromX) * k;
        pr.y = pr.fromY + (pr.toY - pr.fromY) * k - Math.sin(k * Math.PI) * pr.arc;
        if (pr.t >= pr.dur) this.projectiles.splice(i, 1);
      }
    }

    renderUpperWorld(ctx) {
      const sprites = window.MT.sprites;
      const pal = NOCTURNE_PALETTES[this.biome] || NOCTURNE_PALETTES.default;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, BW, this.sceneBuf.height);

      // 1. Nocturnal Mist & Pale-Moon Cached Pixel Backdrop (low luminance & low saturation for 100% UI clarity)
      const bg = this.getUpperBgCanvas(this.biome);
      ctx.drawImage(bg, 0, 0, VW, BRIDGE_VY, 0, 0, BW, BRIDGE_Y);

      // 1B. Hero-Tinted Luminous Eclipse Corona, -11deg Volumetric Moonlight Shafts & Horizon Aura
      const heatLvl = (this.scoring && this.scoring.heatLevel) || 0;
      const skyBreath = 0.85 + 0.15 * Math.sin(this.idleTime * 1.35);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Luminous moon corona linking Hero Select palette with the pale moon
      const moonX = 182 * 4;
      const moonY = 36 * 4;
      const moonCorona = ctx.createRadialGradient(moonX, moonY, 26, moonX, moonY, 265);
      moonCorona.addColorStop(0, `rgba(${pal.moonGlow}, ${(0.20 * skyBreath).toFixed(3)})`);
      moonCorona.addColorStop(0.42, `rgba(${this.heroAccRgb}, ${(0.11 * skyBreath).toFixed(3)})`);
      moonCorona.addColorStop(0.74, `rgba(${this.heroAcc2Rgb}, ${(0.055 * skyBreath).toFixed(3)})`);
      moonCorona.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = moonCorona;
      ctx.fillRect(moonX - 270, moonY - 270, 540, 540);

      // Subtle -11deg slanted volumetric moonlight shafts descending across open sky
      const rays = [
        { x: 295, w: 120, a: 0.058, col: this.heroAccRgb, spd: 0.55 },
        { x: 640, w: 155, a: 0.068, col: pal.moonGlow, spd: 0.42 },
        { x: 895, w: 135, a: 0.052, col: this.heroAcc2Rgb, spd: 0.48 }
      ];
      for (let i = 0; i < rays.length; i++) {
        const ray = rays[i];
        const drift = Math.sin(this.idleTime * ray.spd + i * 2.1) * 18;
        const pulse = 0.78 + 0.22 * Math.sin(this.idleTime * 0.9 + i * 1.7);
        const rx = ray.x + drift;
        ctx.save();
        ctx.translate(rx, 0);
        ctx.transform(1, 0, -0.194, 1, 0, 0); // -11deg slant echoing Hero Select!
        const rg = ctx.createLinearGradient(0, 18, 0, BRIDGE_Y);
        rg.addColorStop(0, `rgba(${ray.col}, 0)`);
        rg.addColorStop(0.28, `rgba(${ray.col}, ${(ray.a * pulse).toFixed(3)})`);
        rg.addColorStop(0.76, `rgba(${ray.col}, ${(ray.a * 0.55 * pulse).toFixed(3)})`);
        rg.addColorStop(1, `rgba(${ray.col}, 0)`);
        ctx.fillStyle = rg;
        ctx.fillRect(-ray.w * 0.5, 0, ray.w, BRIDGE_Y);
        ctx.restore();
      }

      // Soft twilight hero-tinted horizon glow behind the squad & bridge (never washes out HUD!)
      const hGlow = ctx.createLinearGradient(0, BRIDGE_Y - 145, 0, BRIDGE_Y);
      const hBoost = 1 + heatLvl * 0.24;
      hGlow.addColorStop(0, 'rgba(0, 0, 0, 0)');
      hGlow.addColorStop(0.62, `rgba(${this.heroAcc2Rgb}, ${(0.055 * hBoost).toFixed(3)})`);
      hGlow.addColorStop(1, `rgba(${this.heroAccRgb}, ${(0.125 * hBoost).toFixed(3)})`);
      ctx.fillStyle = hGlow;
      ctx.fillRect(0, BRIDGE_Y - 145, BW, 145);
      ctx.restore();

      // 2. Subtle Warm Bridge-Lamp Halo (far left edge x=72px, softly flickering)
      const lampFlicker = 0.86 + 0.14 * Math.sin(this.idleTime * 5.2) * Math.cos(this.idleTime * 2.3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(72, BRIDGE_Y - 104, 4, 72, BRIDGE_Y - 104, 86);
      lg.addColorStop(0, `rgba(235, 178, 92, ${0.24 * lampFlicker})`);
      lg.addColorStop(0.5, `rgba(210, 140, 62, ${0.08 * lampFlicker})`);
      lg.addColorStop(1, 'rgba(210, 140, 62, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, BRIDGE_Y - 190, 162, 176);
      ctx.restore();

      // 3. Slow-Drifting Low-Lying Mist Ribbons along the horizon (intensified during 'mist' weather)
      ctx.save();
      const mistCount = this.weather === 'mist' ? 5 : 3;
      const mistBoost = this.weather === 'mist' ? 1.55 : 1.0;
      for (let r = 0; r < mistCount; r++) {
        const yBase = BRIDGE_Y - 62 + r * 14;
        const speed = 10 + (r % 3) * 6;
        const offset = (this.idleTime * speed + r * 290) % (BW + 440);
        const mx = offset - 440;
        const mg = ctx.createLinearGradient(mx, yBase, mx + 440, yBase);
        mg.addColorStop(0, `rgba(${pal.mistRgb}, 0)`);
        mg.addColorStop(0.5, `rgba(${pal.mistRgb}, ${((0.048 + (r % 3) * 0.015) * mistBoost).toFixed(3)})`);
        mg.addColorStop(1, `rgba(${pal.mistRgb}, 0)`);
        ctx.fillStyle = mg;
        ctx.fillRect(Math.round(mx), yBase, 440, 20 + (r % 3) * 6);
      }
      ctx.restore();

      // 3B. Luminous Hero-Tinted Floating Starlight & Drifting Embers (echoes Hero Select atmosphere!)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const m of this.ambientMotes) {
        const tw = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(this.idleTime * 2.4 + m.phase), 2);
        const edgeFade = Math.min(1, Math.max(0, (m.y - 36) / 60)) * Math.min(1, Math.max(0, (BRIDGE_Y - 8 - m.y) / 48));
        const alpha = tw * edgeFade * (m.isStar ? 0.72 : 0.54);
        if (alpha <= 0.03) continue;
        const mx = Math.round(m.x + Math.sin(this.idleTime * 1.1 + m.phase) * 8);
        const my = Math.round(m.y);
        const colRgb = m.useAcc2 ? this.heroAcc2Rgb : this.heroAccRgb;
        const haloR = m.isStar ? 11 : 7;
        const mg = ctx.createRadialGradient(mx, my, 0.5, mx, my, haloR);
        mg.addColorStop(0, `rgba(${colRgb}, ${(alpha * 0.55).toFixed(3)})`);
        mg.addColorStop(1, `rgba(${colRgb}, 0)`);
        ctx.fillStyle = mg;
        ctx.fillRect(mx - haloR, my - haloR, haloR * 2, haloR * 2);

        ctx.globalAlpha = alpha;
        ctx.fillStyle = m.isStar ? '#fffaf0' : (m.useAcc2 ? this.heroAccent2 : this.heroAccent);
        if (m.isStar) {
          // Crisp 4-point starlight cross glint
          ctx.fillRect(mx - 1, my - 4, 2, 8);
          ctx.fillRect(mx - 4, my - 1, 8, 2);
        } else {
          ctx.fillRect(mx - 1, my - 1, m.size, m.size);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // 4. Rotated Nocturnal Weather Layer ('drizzle' | 'mist' | 'fireflies', always low-distraction HD-2D!)
      if (this.weather === 'drizzle') {
        ctx.save();
        ctx.strokeStyle = pal.rainCol;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 22; i++) {
          const rx = ((hash2(i, 4, 31) * BW) - this.idleTime * 46) % BW;
          const x = rx < 0 ? rx + BW : rx;
          const y = ((hash2(i, 9, 17) * BRIDGE_Y) + this.idleTime * (215 + (i % 3) * 38)) % BRIDGE_Y;
          ctx.moveTo(Math.round(x), Math.round(y));
          ctx.lineTo(Math.round(x - 4), Math.round(y + 17));
        }
        ctx.stroke();
        ctx.restore();
      } else if (this.weather === 'fireflies') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 20; i++) {
          const phase = hash2(i, 3, 73) * Math.PI * 2;
          const fx = 64 + hash2(i, 1, 41) * (BW - 128) + Math.sin(this.idleTime * (0.7 + (i % 3) * 0.25) + phase) * 28;
          const fy = 115 + hash2(i, 2, 59) * (BRIDGE_Y - 148) + Math.cos(this.idleTime * 0.85 + phase) * 14;
          const pulse = Math.pow(0.5 + 0.5 * Math.sin(this.idleTime * (1.8 + (i % 4) * 0.35) + phase), 2.5);
          const alpha = 0.22 + pulse * 0.56;
          const rad = (i % 3 === 0) ? 14 : 9;
          const fg = ctx.createRadialGradient(fx, fy, 1, fx, fy, rad);
          fg.addColorStop(0, `rgba(255, 228, 128, ${(alpha * 0.65).toFixed(3)})`);
          fg.addColorStop(1, 'rgba(255, 214, 96, 0)');
          ctx.fillStyle = fg;
          ctx.fillRect(Math.round(fx - rad), Math.round(fy - rad), rad * 2, rad * 2);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#fff3b8';
          ctx.fillRect(Math.round(fx - 1), Math.round(fy - 1), i % 3 === 0 ? 3 : 2, i % 3 === 0 ? 3 : 2);
        }
        ctx.restore();
      }

      // 5-Tier Unit Visual Signatures (Outline + Persistent Ambient Aura/Motes) + Dedicated Selection Indicator!
      const TIER_VFX = {
        C:   { outline: '#e6eefc', rgb: null, motes: 0 },
        B:   { outline: '#66d0ff', rgb: '91, 194, 255', motes: 2, moteCol: '#b8ecff' },
        A:   { outline: '#d48cff', rgb: '201, 125, 255', motes: 3, moteCol: '#f0d4ff' },
        S:   { outline: '#ffd966', rgb: '255, 214, 82', motes: 5, moteCol: '#fff4b8' },
        SSS: { outline: '#ff5e8e', rgb: '255, 94, 142', motes: 7, moteCol: '#ffd6e5' }
      };

      // Draw Slot Heroes with Tier Auras, Afterimages, Hit-Stop Jitter & Full Attack Playback!
      if (sprites) {
        // Motion-blur dash afterimages behind active actors
        for (const ai of this.afterimages) {
          const a = Math.max(0, (ai.life / ai.maxLife) * ai.alpha);
          sprites.drawUnit(ctx, ai.unitId, ai.anim, this.idleTime, Math.round(ai.x), Math.round(ai.y), {
            scale: ai.scale,
            flipX: ai.flipX,
            alpha: a,
            loop: ai.anim !== 'attack',
            elapsedOverride: ai.anim === 'attack' ? ai.animElapsed : null,
            speedMult: ai.anim === 'attack' ? ai.animSpeedMult : 1,
            tintColor: ai.color
          });
        }

        const inspectActive = this.inspectedSlotIdx >= 0 && !this.slotUnits.some((x) => x && x.isDragging && x.isRecallZone);
        const relSlots = (this.relatedMeta && this.relatedMeta.slots) || new Set();
        const relColors = (this.relatedMeta && this.relatedMeta.slotColors) || {};
        const squadHitJitter = (this.hitstop > 0 && this.hitstopTarget === 'squad') ? ((Math.floor(performance.now() / 16) % 2 === 0) ? -3 : 3) : 0;

        // Draw idle heroes first, actively lunging/attacking hero ON TOP so it never clips behind allies
        const slotOrder = [0, 1, 2].sort((a, b) => {
          const ua = this.slotUnits[a];
          const ub = this.slotUnits[b];
          const actA = (ua && (ua.anim === 'attack' || Math.abs(ua.x - ua.homeX) > 4)) ? 1 : 0;
          const actB = (ub && (ub.anim === 'attack' || Math.abs(ub.x - ub.homeX) > 4)) ? 1 : 0;
          return actA - actB;
        });

        const drawHeroSlot = (i) => {
          const u = this.slotUnits[i];
          if (!u || u.isDragging) return;
          const isInspected = this.inspectedSlotIdx === i;
          const isRelated = relSlots.has(i);
          const tv = TIER_VFX[u.tier] || TIER_VFX.C;
          const ux = u.x + (u.knockX || 0) + squadHitJitter;

          ctx.save();
          if (inspectActive && !isInspected && !isRelated) ctx.globalAlpha = 0.34;

          // Refined Pixel-Grid Tier Ground Aura & Outer Stardust (NEVER obscures hero silhouette!)
          if (u.tier !== 'C') {
            const tierCfg = {
              B:   { col: '#66d0ff', hi: '#c8f0ff', rx: 38, motes: 2, size: 3 },
              A:   { col: '#c97dff', hi: '#f0d6ff', rx: 42, motes: 3, size: 3 },
              S:   { col: '#ffd24c', hi: '#fff6c4', rx: 46, motes: 5, size: 4 },
              SSS: { col: '#ff5e8e', hi: '#ffd966', rx: 50, motes: 6, size: 4 }
            }[u.tier];
            if (tierCfg) {
              const pulse = 0.72 + 0.28 * Math.sin(this.idleTime * 2.6 + u.phase);
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              // Stepped pixel oval foot ring strictly at bridge floor level (zero behind-body vector crosshair!)
              const rx = tierCfg.rx;
              const ry = Math.round(rx * 0.24);
              const steps = 28;
              ctx.fillStyle = tierCfg.col;
              ctx.globalAlpha = 0.65 * pulse;
              for (let k = 0; k < steps; k++) {
                const a = (k / steps) * Math.PI * 2 + this.idleTime * 0.35;
                const px = Math.round((ux + Math.cos(a) * rx) / 2) * 2;
                const py = Math.round((BRIDGE_Y + 2 + Math.sin(a) * ry) / 2) * 2;
                ctx.fillRect(px, py, 3, 2);
              }
              if (u.tier === 'S' || u.tier === 'SSS') {
                // Subtle rotating 4-cardinal pixel rune pips at ground level
                ctx.fillStyle = tierCfg.hi;
                ctx.globalAlpha = 0.85 * pulse;
                for (let k = 0; k < 4; k++) {
                  const a = (k * Math.PI) / 2 + this.idleTime * 0.7 + u.phase;
                  const px = Math.round(ux + Math.cos(a) * (rx + 6));
                  const py = Math.round(BRIDGE_Y + 2 + Math.sin(a) * (ry + 2));
                  ctx.fillRect(px - 2, py - 1, 4, 2);
                }
              }
              // Rising outer pixel stardust motes orbiting cleanly OUTSIDE the hero's body
              for (let m = 0; m < tierCfg.motes; m++) {
                const mt = (this.idleTime * 0.44 + m / tierCfg.motes + u.phase) % 1;
                const side = (m % 2 === 0 ? 1 : -1);
                const mx = ux + side * (26 + Math.sin(m * 2.1 + this.idleTime * 1.6) * 14);
                const my = u.y - 10 - mt * 94;
                ctx.globalAlpha = Math.sin(mt * Math.PI) * 0.85;
                ctx.fillStyle = m % 2 === 0 ? tierCfg.hi : tierCfg.col;
                ctx.fillRect(Math.round(mx), Math.round(my), tierCfg.size, tierCfg.size);
              }
              ctx.restore();
            }
          }

          if (isInspected) {
            const sp = 0.82 + 0.18 * Math.sin(this.idleTime * 3.8);
            const bob = Math.round(Math.sin(this.idleTime * 4.5) * 4);
            ctx.save();
            ctx.translate(ux, BRIDGE_Y + 3);
            ctx.scale(1, 0.26);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * sp})`;
            ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(255, 226, 102, ${0.72 * sp})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();

            const cy = u.y - 122 + bob;
            ctx.save();
            ctx.fillStyle = '#07040f';
            ctx.beginPath();
            ctx.moveTo(ux, cy + 12); ctx.lineTo(ux - 10, cy); ctx.lineTo(ux, cy - 12); ctx.lineTo(ux + 10, cy);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(ux, cy + 9); ctx.lineTo(ux - 7, cy); ctx.lineTo(ux, cy - 9); ctx.lineTo(ux + 7, cy);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ffe266';
            ctx.fillRect(Math.round(ux - 2), Math.round(cy - 2), 4, 4);
            ctx.restore();
          }

          // Escalating Heat Fire-Ring beneath the actively striking Hero (Lv.2 Orange -> Lv.3 Blue -> Lv.4 Eclipse!)
          const isHeroActing = u.anim === 'attack' || Math.abs(u.x - u.homeX) > 4;
          if (isHeroActing && this.scoring && this.scoring.active && this.scoring.heatLevel >= 2) {
            const hLv = this.scoring.heatLevel;
            const ringCol = hLv >= 4 ? '#ff5e8e' : hLv >= 3 ? '#38d6ff' : '#ff942e';
            const coreCol = hLv >= 3 ? '#ffffff' : '#ffe266';
            const hp = 0.8 + 0.2 * Math.sin(this.idleTime * 14);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(ux, BRIDGE_Y + 3);
            ctx.scale(1, 0.28);
            ctx.strokeStyle = ringCol;
            ctx.globalAlpha = 0.85 * hp;
            ctx.lineWidth = hLv >= 3 ? 5 : 3.5;
            ctx.beginPath(); ctx.arc(0, 0, 44 + hLv * 5, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = coreCol;
            ctx.globalAlpha = 0.72 * hp;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 32 + hLv * 3, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          }

          const outline = u.flash > 0 ? '#ffffff'
            : (inspectActive && isRelated && relColors[i]) ? relColors[i]
            : tv.outline;
          const isAtk = u.anim === 'attack';
          sprites.drawUnit(ctx, u.unitId, u.anim, this.idleTime + u.phase, Math.round(ux), Math.round(u.y), {
            scale: u.scale,
            flipX: false,
            loop: !isAtk,
            elapsedOverride: isAtk ? (u.animElapsed || 0) : null,
            speedMult: isAtk ? (u.animSpeedMult || 1) : 1,
            squashX: u.squashX || 1,
            squashY: u.squashY || 1,
            flashWhite: u.flash > 0 ? Math.min(0.85, u.flash / 0.14) : 0,
            outlineColor: outline
          });
          ctx.restore();
        };

        const bossLunging = Boolean(this.boss && (this.boss.anim === 'attack' || Math.abs(this.boss.x - BOSS_X) > 4));
        const drawBossUnit = () => {
          if (!this.boss || (!this.boss.alive && !this.boss.dying)) return;
          const isCharging = this.bossIntent && (this.bossIntent.kind === 'charge' || this.bossIntent.kind === 'ult');
          const bossRelated = Boolean(this.relatedMeta && this.relatedMeta.boss);
          const bossJitter = (this.hitstop > 0 && this.hitstopTarget === 'boss') ? ((Math.floor(performance.now() / 16) % 2 === 0) ? 3 : -3) : 0;
          ctx.save();
          let bossAlpha = 1;
          let bossLiftY = 0;
          let deathSquashX = this.boss.squashX || 1;
          let deathSquashY = this.boss.squashY || 1;
          let deathFlash = this.boss.flash > 0 ? Math.min(0.9, this.boss.flash / 0.15) : 0;
          if (this.boss.dying) {
            const dp = Math.max(0, Math.min(1, this.boss.deathElapsed / this.boss.deathDur));
            bossAlpha = Math.max(0, 1 - Math.pow(dp, 1.35));
            bossLiftY = -Math.round(dp * 28);
            deathSquashX = 1 - dp * 0.24;
            deathSquashY = 1 + dp * 0.34;
            deathFlash = Math.min(1, 0.55 + (1 - dp) * 0.45);
          } else if (inspectActive && !bossRelated) {
            ctx.globalAlpha = 0.42;
          }
          const bossOutline = (this.boss.flash > 0 || this.boss.dying) ? '#ffffff'
            : (inspectActive && bossRelated && this.relatedMeta.bossColor) ? this.relatedMeta.bossColor
            : this.bossStunned ? '#ffd966' : isCharging ? '#ff477e' : '#f2f6ff';
          const isBossAtk = this.boss.anim === 'attack';
          sprites.drawUnit(ctx, this.boss.unitId, this.boss.anim, this.idleTime + this.boss.phase, Math.round(this.boss.x + this.boss.knockX + bossJitter), Math.round(this.boss.y + bossLiftY), {
            scale: this.boss.scale,
            flipX: true,
            alpha: bossAlpha,
            loop: !isBossAtk,
            elapsedOverride: isBossAtk ? (this.boss.animElapsed || 0) : null,
            speedMult: isBossAtk ? (this.boss.animSpeedMult || 1) : 1,
            squashX: deathSquashX,
            squashY: deathSquashY,
            flashWhite: deathFlash,
            outlineColor: bossOutline
          });
          ctx.restore();
        };

        // Draw Boss behind attacking hero, OR on top of heroes when Boss is lunging!
        if (!bossLunging) drawBossUnit();
        for (const idx of slotOrder) drawHeroSlot(idx);
        if (this.ghostUnit) {
          const g = this.ghostUnit;
          const isGAtk = g.anim === 'attack';
          sprites.drawUnit(ctx, g.unitId, g.anim, this.idleTime, Math.round(g.x), Math.round(g.y), {
            scale: g.scale,
            flipX: false,
            alpha: g.alpha || 0.78,
            loop: !isGAtk,
            elapsedOverride: isGAtk ? (g.animElapsed || 0) : null,
            speedMult: isGAtk ? (g.animSpeedMult || 1) : 1,
            squashX: g.squashX || 1,
            squashY: g.squashY || 1,
            outlineColor: '#d48cff'
          });
        }
        if (bossLunging) drawBossUnit();
      }

      // Crisp Directional Projectiles (Daggers, Shield Waves, Amp Bolts, Thorns)
      for (const pr of this.projectiles) {
        const ang = Math.atan2(pr.y - pr.py, pr.x - pr.px);
        ctx.save();
        ctx.translate(Math.round(pr.x), Math.round(pr.y));
        ctx.rotate(ang);
        ctx.globalCompositeOperation = 'lighter';
        if (pr.kind === 'dagger') {
          // Glowing pixel throwing blade with speed streak
          ctx.fillStyle = pr.color;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(-38, -2, 34, 4);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#090612';
          ctx.beginPath();
          ctx.moveTo(16, 0); ctx.lineTo(-8, -7); ctx.lineTo(-14, 0); ctx.lineTo(-8, 7);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = pr.color;
          ctx.beginPath();
          ctx.moveTo(14, 0); ctx.lineTo(-6, -5); ctx.lineTo(-11, 0); ctx.lineTo(-6, 5);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-5, -1.5, 14, 3);
        } else if (pr.kind === 'shield') {
          ctx.strokeStyle = pr.color;
          ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(-4, 0, 20, -Math.PI * 0.42, Math.PI * 0.42); ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(-2, 0, 17, -Math.PI * 0.34, Math.PI * 0.34); ctx.stroke();
        } else if (pr.kind === 'thorn') {
          ctx.fillStyle = '#a8ff78';
          ctx.beginPath();
          ctx.moveTo(14, 0); ctx.lineTo(-10, -5); ctx.lineTo(-6, 0); ctx.lineTo(-10, 5);
          ctx.closePath(); ctx.fill();
        } else {
          const pg = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
          pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.4, pr.color); pg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = pg; ctx.fillRect(-28, -28, 56, 56);
        }
        ctx.restore();
      }

      // Crisp Pixel-Stepped Impact Shockwave Rings (replaces thin smooth vector ctx.arc!)
      for (const sw of this.shockwaves) {
        const p = Math.min(1, sw.t / sw.dur);
        const r = 10 + (sw.maxR - 10) * (1 - Math.pow(1 - p, 3));
        const pxSz = p < 0.35 ? 4 : 3;
        const steps = Math.max(16, Math.round(r * 0.72));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - p) * 0.92;
        ctx.fillStyle = sw.color;
        for (let k = 0; k < steps; k++) {
          const a = (k / steps) * Math.PI * 2;
          const sx = Math.round((sw.x + Math.cos(a) * r) / pxSz) * pxSz;
          const sy = Math.round((sw.y + Math.sin(a) * r) / pxSz) * pxSz;
          ctx.fillRect(sx, sy, pxSz, pxSz);
        }
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
      // Subtle elastic camera zoom-in punch on heavy / break / finisher hits (never exposes edge borders)
      if (this.zoomPunch && this.zoomPunch.time > 0) {
        const zp = this.zoomPunch;
        const prog = 1 - (zp.time / Math.max(0.01, zp.maxTime));
        // Quick ramp-in (first 16%), smooth cubic ease-out back to 1.0
        const env = prog < 0.16 ? (prog / 0.16) : Math.pow(1 - (prog - 0.16) / 0.84, 2.2);
        const s = 1 + (zp.scale - 1) * env;
        const fx = Math.max(BW * 0.2, Math.min(BW * 0.8, zp.focusX));
        const fy = Math.max(BH * 0.2, Math.min(BH * 0.8, zp.focusY));
        ctx.translate(fx, fy);
        ctx.scale(s, s);
        ctx.translate(-fx, -fy);
      }
      if (this.shakeTime > 0 && this.shakeAmp > 0) {
        // Subtle damped directional camera shake (smooth quadratic falloff, crisp punch!)
        const ratio = Math.max(0, Math.min(1, this.shakeTime / Math.max(0.01, this.shakeMaxTime)));
        const mag = this.shakeAmp * Math.pow(ratio, 1.35);
        const osc = Math.sin(this.shakeTime * 95);
        const sx = Math.round((osc * 0.72 + (Math.random() - 0.5) * 0.55) * mag * (this.shakeDirX || 1));
        const sy = Math.round((Math.cos(this.shakeTime * 78) * 0.45 + (Math.random() - 0.5) * 0.45) * mag * 0.65);
        ctx.translate(sx, sy);
      }

      this.renderUpperWorld(this.sceneCtx);
      ctx.drawImage(this.sceneBuf, 0, 0, BW, BRIDGE_Y, 0, 0, BW, BRIDGE_Y);

      // Fast Shimmering Mirror-Lake Reflection (single vertical flip + 20 wave bands, zero per-slice save/restore!)
      const lakeH = BH - LAKE_Y;
      const rctx = this.reflCtx;
      rctx.save();
      rctx.clearRect(0, 0, BW, lakeH);
      rctx.translate(0, lakeH);
      rctx.scale(1, -1);
      rctx.drawImage(this.sceneBuf, 0, BRIDGE_Y - lakeH, BW, lakeH, 0, 0, BW, lakeH);
      rctx.restore();

      ctx.save();
      ctx.beginPath(); ctx.rect(0, LAKE_Y, BW, lakeH); ctx.clip();
      const bandH = 12;
      for (let sy = 0; sy < lakeH; sy += bandH) {
        const h = Math.min(bandH, lakeH - sy);
        const ripple = Math.round(Math.sin(sy * 0.08 + this.idleTime * 3.6) * (1.5 + (sy / lakeH) * 2.4));
        ctx.drawImage(this.reflBuf, 0, sy, BW, h, ripple, LAKE_Y + sy, BW, h);
      }
      const pal = NOCTURNE_PALETTES[this.biome] || NOCTURNE_PALETTES.default;
      const waterTint = ctx.createLinearGradient(0, LAKE_Y, BW, LAKE_Y);
      waterTint.addColorStop(0, pal.lakeTintL); waterTint.addColorStop(1, pal.lakeTintR);
      ctx.fillStyle = waterTint; ctx.fillRect(0, LAKE_Y, BW, lakeH);

      // Luminous Mirror-Lake Specular Ripples & Hero-Tinted Aurora Shimmer (keeps reflections vivid above hand dock!)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lakeAurora = ctx.createLinearGradient(0, LAKE_Y, BW, LAKE_Y + 95);
      lakeAurora.addColorStop(0, `rgba(${this.heroAccRgb}, 0.08)`);
      lakeAurora.addColorStop(0.45, `rgba(${pal.moonGlow}, 0.07)`);
      lakeAurora.addColorStop(0.72, `rgba(${this.heroAcc2Rgb}, 0.09)`);
      lakeAurora.addColorStop(1, `rgba(${this.heroAccRgb}, 0.03)`);
      ctx.fillStyle = lakeAurora;
      ctx.fillRect(0, LAKE_Y, BW, 118);

      // Crisp dancing moon-path & hero specular glints across upper mirror surface
      for (let r = 0; r < 14; r++) {
        const ry = LAKE_Y + 6 + r * 7;
        const waveShift = Math.sin(this.idleTime * (2.2 + (r % 3) * 0.55) + r * 1.3) * (16 + r * 2);
        const rw = Math.max(26, 128 - r * 6 + Math.sin(this.idleTime * 3.1 + r) * 18);
        const rx = 728 - rw * 0.5 + waveShift;
        const ra = Math.max(0.03, (0.20 - r * 0.011) * (0.7 + 0.3 * Math.sin(this.idleTime * 3.5 + r * 2.1)));
        ctx.fillStyle = r % 3 === 0 ? `rgba(${this.heroAccRgb}, ${ra.toFixed(3)})` : `rgba(235, 244, 255, ${ra.toFixed(3)})`;
        ctx.fillRect(Math.round(rx), ry, Math.round(rw), 2);
      }
      // Subtle hero-side shimmer lines below the 3 bridge slots
      for (let i = 0; i < 3; i++) {
        if (!this.slotUnits[i]) continue;
        const sx = SLOT_X[i];
        for (let k = 0; k < 4; k++) {
          const ry = LAKE_Y + 10 + k * 14;
          const rw = 46 - k * 7 + Math.sin(this.idleTime * 3.4 + i + k) * 8;
          const rx = sx - rw * 0.5 + Math.sin(this.idleTime * 2.5 + k * 1.4 + i) * 9;
          ctx.fillStyle = `rgba(${this.heroAccRgb}, ${(0.16 - k * 0.03).toFixed(3)})`;
          ctx.fillRect(Math.round(rx), ry, Math.round(rw), 2);
        }
      }
      ctx.restore();

      const waterDepth = ctx.createLinearGradient(0, LAKE_Y, 0, BH);
      waterDepth.addColorStop(0, 'rgba(4, 6, 14, 0.20)');
      waterDepth.addColorStop(0.46, 'rgba(4, 6, 14, 0.58)');
      waterDepth.addColorStop(1, 'rgba(3, 4, 10, 0.88)');
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

      // Dynamic Ground Contact Shadows following units as they dash/recoil!
      for (let i = 0; i < 3; i++) {
        const u = this.slotUnits[i];
        if (!u || u.isDragging) continue;
        ctx.save();
        ctx.fillStyle = 'rgba(5, 4, 14, 0.52)';
        ctx.beginPath();
        ctx.ellipse(Math.round(u.x + (u.knockX || 0)), BRIDGE_Y + 2, 34, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (this.ghostUnit) {
        ctx.save();
        ctx.fillStyle = 'rgba(140, 64, 210, 0.42)';
        ctx.beginPath();
        ctx.ellipse(Math.round(this.ghostUnit.x), BRIDGE_Y + 2, 30, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (this.boss && (this.boss.alive || this.boss.dying)) {
        const shAlpha = this.boss.dying
          ? Math.max(0, 1 - this.boss.deathElapsed / this.boss.deathDur)
          : 1;
        ctx.save();
        ctx.globalAlpha = shAlpha;
        ctx.fillStyle = 'rgba(5, 4, 14, 0.58)';
        ctx.beginPath();
        ctx.ellipse(Math.round(this.boss.x + this.boss.knockX), BRIDGE_Y + 2, 54, 8, 0, 0, Math.PI * 2);
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
          ctx.font = '14px "FusionPixel", monospace';
          const tw = ctx.measureText('封锁').width;
          const ox = Math.round(sx - (16 + 4 + tw) / 2);
          drawPixelGlyph(ctx, 'frost', ox, BRIDGE_Y + 12, 2);
          ctx.textAlign = 'left';
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#08060f';
          ctx.strokeText('封锁', ox + 20, BRIDGE_Y + 25);
          ctx.fillStyle = '#8ef0ff';
          ctx.fillText('封锁', ox + 20, BRIDGE_Y + 25);
        } else {
          const chips = (u.effectChips && u.effectChips.length) ? u.effectChips : [{ icon: 'atk', text: `${u.atk}`, color: '#ffe266' }];
          ctx.font = '14px "FusionPixel", monospace';
          const gap = 9;
          const items = chips.map((c) => {
            const icoW = c.icon ? 15 : 0;
            const txtW = ctx.measureText(c.text).width;
            return { ...c, icoW, txtW, w: icoW + (c.icon ? 3 : 0) + txtW };
          });
          const totalW = items.reduce((a, b) => a + b.w, 0) + gap * (items.length - 1);
          let curX = Math.round(sx - totalW / 2);
          ctx.textAlign = 'left';
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#08060f';
          for (const it of items) {
            if (it.icon) {
              drawPixelGlyph(ctx, it.icon, curX, BRIDGE_Y + 13, 1.8);
              curX += it.icoW + 3;
            }
            ctx.strokeText(it.text, Math.round(curX), BRIDGE_Y + 25);
            ctx.fillStyle = it.color;
            ctx.fillText(it.text, Math.round(curX), BRIDGE_Y + 25);
            curX += it.txtW + gap;
          }
        }
        ctx.restore();
      }

      // Boss Overhead Minimal High-Signal Intent (Crisp Pixel Glyphs + Numbers, ZERO emojis!)
      if (this.boss && this.boss.alive && !this.boss.dying) {
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
          ctx.font = '24px "FusionPixel", monospace';
          const gap = 14;
          const measured = parts.map((p) => {
            const tw = ctx.measureText(p.text).width;
            return { ...p, tw, w: 22 + 6 + tw };
          });
          const totalW = measured.reduce((a, c) => a + c.w, 0) + gap * (measured.length - 1);
          let ox = Math.round(bx - totalW / 2);
          ctx.textAlign = 'left';
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#08060f';
          for (const p of measured) {
            drawPixelGlyph(ctx, p.icon, ox, 146, 2.6);
            ctx.strokeText(p.text, Math.round(ox + 27), 166);
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, Math.round(ox + 27), 166);
            ox += p.w + gap;
          }
          ctx.restore();
        }
        const badges = [];
        if (this.bossPoison > 0) badges.push({ icon: 'poison', text: `${this.bossPoison}`, color: '#7ef28a' });
        if (this.bossVuln) badges.push({ icon: 'vuln', text: '×1.4', color: '#ff8a5c' });
        if (badges.length > 0) {
          ctx.save();
          ctx.font = '14px "FusionPixel", monospace';
          const gap = 14;
          const items = badges.map((b) => ({ ...b, tw: ctx.measureText(b.text).width, w: 16 + 4 + ctx.measureText(b.text).width }));
          const tw = items.reduce((a, c) => a + c.w, 0) + gap * (items.length - 1);
          let ox = Math.round(bx - tw / 2);
          ctx.textAlign = 'left';
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#08060f';
          for (const b of items) {
            drawPixelGlyph(ctx, b.icon, ox, 180, 1.8);
            ctx.strokeText(b.text, Math.round(ox + 19), 193);
            ctx.fillStyle = b.color;
            ctx.fillText(b.text, Math.round(ox + 19), 193);
            ox += b.w + gap;
          }
          ctx.restore();
        }
      }

      // Floating Damage / Growth Popups (with Balatro-style elastic Pop-in Overshoot!)
      for (const p of this.popups) {
        const age = p.age || 0;
        const peak = p.isBig ? 1.54 : 1.34;
        let popScale = 1;
        if (age < 0.045) {
          const t = age / 0.045;
          popScale = 0.45 + (peak - 0.45) * (1 - Math.pow(1 - t, 2));
        } else if (age < 0.15) {
          const t = (age - 0.045) / 0.105;
          popScale = peak - (peak - 1) * (1 - Math.pow(1 - t, 3));
        }
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.45));
        ctx.translate(Math.round(p.x), Math.round(p.y));
        if (p.tilt) ctx.rotate(p.tilt);
        ctx.scale(popScale, popScale);
        const pxSize = Math.max(12, Math.round(p.size / 2) * 2);
        ctx.font = `${pxSize}px "FusionPixel", monospace`;
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = p.isBig ? 6 : 5;
        ctx.strokeStyle = '#08060f';
        ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, 0, 0);
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
        ctx.font = '14px "FusionPixel", monospace';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#08060f';
        ctx.strokeText(slotNames[activeTargetSlot], Math.round(sx), Math.round(ry - 20));
        ctx.fillStyle = '#fff4c2';
        ctx.fillText(slotNames[activeTargetSlot], Math.round(sx), Math.round(ry - 20));
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
            const mx = Math.round(0.25 * fromX + 0.5 * ctrlX + 0.25 * toX);
            const my = Math.round(0.25 * fromY + 0.5 * ctrlY + 0.25 * toY - 12);
            octx.font = '12px "FusionPixel", monospace';
            octx.textAlign = 'center';
            octx.lineJoin = 'round';
            octx.miterLimit = 2;
            octx.lineWidth = 4;
            octx.strokeStyle = '#08060f';
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

        // 4. Balatro-Style Live Scoring Tally & Escalating Pixel Flame Wall
        this._renderScoringOverlay(octx);
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
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.font = '36px "FusionPixel", monospace';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#08060f';
        ctx.strokeText(this.cutIn.title, 0, 6);
        ctx.fillStyle = this.cutIn.color;
        ctx.fillText(this.cutIn.title, 0, 6);
        if (this.cutIn.sub) {
          ctx.font = '16px "FusionPixel", monospace';
          ctx.lineWidth = 4;
          ctx.strokeText(this.cutIn.sub, 0, 30);
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
