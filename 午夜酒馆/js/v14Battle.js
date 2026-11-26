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
      this.screenFlash = null;

      this.biome = 'default';
      this.atmosphere = null;
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
      this.hitstopTarget = null;
      this.shakeTime = 0;
      this.shakeMaxTime = 0.14;
      this.shakeAmp = 0;
      this.screenFlash = null;
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
        squashX: 1,
        squashY: 1,
        flash: 0,
        anim: 'idle',
        animElapsed: 0,
        animDuration: 0.55,
        animSpeedMult: 1,
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
        this.boss.alive = state.bossHp > 0;
      }
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
        maxLife: 0.18
      });
    }

    spawnPopup(x, y, text, color = '#ffd966', size = 28) {
      // Gently nudge vertically if another very fresh popup shares this spot
      let sy = y;
      for (const existing of this.popups) {
        if (existing.life > existing.maxLife * 0.72 && Math.abs(existing.x - x) < 70 && Math.abs(existing.y - sy) < 28) {
          sy -= 28;
        }
      }
      this.popups.push({
        x: x + (Math.random() - 0.5) * 26,
        y: sy,
        vy: -88,
        text,
        color,
        size,
        life: 0.92,
        maxLife: 0.92
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

          if (ev.relicSteps && ev.relicSteps.length > 0 && hooks.onRelicPulse) {
            for (const step of ev.relicSteps) hooks.onRelicPulse(step.relicUid, step.label);
          }

          if (ev.isKnife) {
            // ── Directional Throwing Dagger Volley ──
            const srcSlot = this.slotUnits[lastHeroSlotIdx] || this.slotUnits.find(Boolean);
            const fromX = (srcSlot ? srcSlot.x : SLOT_X[1]) + 28;
            const fromY = BRIDGE_Y - 68 + (Math.random() - 0.5) * 18;
            const toX = BOSS_X - 38;
            const toY = BRIDGE_Y - 82 + (Math.random() - 0.5) * 24;
            if (audio) audio.tone(Math.min(1080, 620 + pitchStep * 36), 0.06, 'triangle', 0.08, 0, 960);
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
            this.spawnVfx(ev.vfx || 'fx_f2_twilightreiki', toX + 12, toY, 1.35, { speedMult: 1.45 });
            this.spawnShockwave(toX + 12, toY, '#7be8ff', 42, 0.18, 3);
            this.spawnParticles(toX + 10, toY, '#7be8ff', 10, 1);
            if (audio) audio.tone(240 + Math.min(260, pitchStep * 22), 0.07, 'square', 0.08, 0, 110);
            this.spawnPopup(BOSS_X, BRIDGE_Y - 132, `-${ev.dmg}`, '#7be8ff', ev.dmg >= 140 ? 30 : 24);
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
            this.spawnVfx('fx_f2_teleportsmoke', ghostStartX, BRIDGE_Y - 56, 1.4, { speedMult: 1.5 });
            this.spawnPopup(ghostStartX, BRIDGE_Y - 126, `影袭 · ${ev.heroName}`, '#d48cff', 20);
            if (audio) audio.tone(360, 0.09, 'sine', 0.09, 0, 560);
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
            this.spawnVfx(ev.vfx || 'fx_f4_shadownova', BOSS_X - 8, BRIDGE_Y - 82, isHeavy ? 1.85 : 1.55);
            this.spawnShockwave(BOSS_X - 8, BRIDGE_Y - 82, '#d48cff', 66, 0.24, 4);
            this.spawnParticles(BOSS_X - 6, BRIDGE_Y - 82, '#d48cff', 18, 1);
            if (audio) audio.tone(180, 0.12, 'sawtooth', 0.10, 0, 88);
            this.spawnPopup(BOSS_X, BRIDGE_Y - 140, `-${ev.dmg}`, '#e5a8ff', isHeavy ? 34 : 28);
            if (hooks.onBossDamage) hooks.onBossDamage(ev.dmg, false);
            else if (hooks.onSyncHud) hooks.onSyncHud();

            await this.waitSec(Math.max(0.14, atk.dur - atk.impactAt));
            this.spawnVfx('fx_f2_teleportsmoke', this.ghostUnit.x, BRIDGE_Y - 56, 1.35, { speedMult: 1.6 });
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
              const whoosh = Math.min(820, 290 + pitchStep * 36);
              audio.tone(whoosh, 0.08, 'triangle', 0.08, 0, whoosh * 1.32);
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

            const vfxKey = ev.vfx || (isMega ? 'fx_multislash_full' : 'fx_crossslash');
            this.spawnVfx(vfxKey, BOSS_X - 8, BRIDGE_Y - 84, isMega ? 2.0 : isHeavy ? 1.78 : 1.52);
            if (isHeavy) {
              this.spawnVfx(isMega ? 'fxExplosionBigWhiteHot' : 'fxImpactBigOrange', BOSS_X + 6, BRIDGE_Y - 78, isMega ? 1.55 : 1.25, { speedMult: 1.4 });
            }
            this.spawnShockwave(BOSS_X - 6, BRIDGE_Y - 82, ev.isRetrigger ? '#ff9a2e' : '#ffd966', isMega ? 92 : isHeavy ? 72 : 54, 0.22, isHeavy ? 4.5 : 3);
            this.spawnParticles(BOSS_X - 10, BRIDGE_Y - 82, ev.isRetrigger ? '#ff9a2e' : '#ffd966', isMega ? 26 : isHeavy ? 18 : 12, 1);

            if (audio) {
              const hitPitch = Math.min(360, 155 + pitchStep * 18);
              audio.tone(hitPitch, isHeavy ? 0.13 : 0.09, 'sawtooth', isHeavy ? 0.13 : 0.10, 0, hitPitch * 0.45);
              audio.tone(Math.min(920, 420 + pitchStep * 45), 0.06, 'triangle', 0.08, 0, 240);
            }

            this.spawnPopup(
              BOSS_X,
              BRIDGE_Y - 138,
              `-${ev.dmg}`,
              ev.isRetrigger ? '#ff9a2e' : (isMega ? '#fff29e' : '#ffd966'),
              isMega ? 40 : isHeavy ? 34 : 28
            );
            if (hooks.onBossDamage) hooks.onBossDamage(ev.dmg, false);
            else if (hooks.onSyncHud) hooks.onSyncHud();

            // 5) Let follow-through frames play cleanly, then smoothly spring-retreat home
            const followDur = Math.max(0.14, Math.min(0.24, atk.dur - atk.impactAt));
            await this.waitSec(followDur);
            if (!this.running) break;

            const retDur = Math.max(0.10, Math.min(0.16, 0.08 + dashDist / 6800));
            await this.tweenUnitX(actor, actor.homeX, retDur, { ease: 'outQuad', trailColor: trailCol, trailEvery: 0.05 });
            actor.squashX = 1.07;
            actor.squashY = 0.94;
            actor.anim = 'idle';
            actor.animTimer = 0;
            await this.waitSec(0.035);
          } else {
            // Fallback strike with no slot actor
            if (this.boss) { this.boss.knockX = 18; this.boss.flash = 0.15; }
            this.triggerHitImpact({ hitstop: 0.048, shakeAmp: 5.5, shakeDur: 0.13, dirX: 1, target: 'boss' });
            this.spawnVfx(ev.vfx || 'fx_crossslash', BOSS_X, BRIDGE_Y - 84, 1.6);
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
            this.spawnVfx('fxBuffSimpleGold', actor.x, BRIDGE_Y - 62, 1.35, { speedMult: 1.4 });
            if (target) {
              const dur = this.spawnProjectile(actor.x + 14, BRIDGE_Y - 68, target.x, BRIDGE_Y - 68, '#ffd966', { dur: 0.15, arc: 36, kind: 'amp' });
              if (audio) audio.tone(520, 0.12, 'sine', 0.10, 0, 820);
              await this.waitSec(dur);
              target.flash = 0.18;
              target.squashX = 0.92;
              target.squashY = 1.10;
              this.spawnVfx('fxBuffSimpleGold', target.x, BRIDGE_Y - 62, 1.55, { speedMult: 1.3 });
              this.spawnShockwave(target.x, BRIDGE_Y - 58, '#ffd966', 54, 0.22, 3);
              this.spawnPopup(target.x, BRIDGE_Y - 122, `✦ ${ev.label}`, '#ffd966', 24);
            } else {
              if (audio) audio.tone(520, 0.12, 'sine', 0.10, 0, 820);
              this.spawnPopup(actor.homeX, BRIDGE_Y - 118, `✦ ${ev.label}`, '#ffd966', 24);
            }
            await this.waitSec(Math.max(0.12, castAtk.dur - 0.15));
            actor.anim = 'idle';
          }
        } else if (ev.type === 'crown_bash') {
          const dur = this.spawnProjectile(380, BRIDGE_Y - 72, BOSS_X - 32, BRIDGE_Y - 84, '#78b7ff', { dur: 0.15, arc: 20, kind: 'shield' });
          if (audio) audio.tone(360, 0.08, 'triangle', 0.09, 0, 240);
          await this.waitSec(dur);
          if (!this.running) break;
          if (this.boss) {
            this.boss.knockX = 16;
            this.boss.flash = 0.14;
            this.boss.squashX = 0.89;
            this.boss.squashY = 1.11;
          }
          this.triggerHitImpact({ hitstop: 0.042, shakeAmp: 4.8, shakeDur: 0.12, dirX: 1, target: 'boss' });
          this.spawnVfx('fxImpactBlueBig', BOSS_X - 8, BRIDGE_Y - 84, 1.45);
          this.spawnShockwave(BOSS_X - 8, BRIDGE_Y - 84, '#78b7ff', 52, 0.20, 3.5);
          this.spawnParticles(BOSS_X - 10, BRIDGE_Y - 84, '#78b7ff', 14, 1);
          this.spawnPopup(BOSS_X, BRIDGE_Y - 152, `盾击 -${ev.dmg}`, '#78b7ff', 26);
          if (audio) audio.tone(240, 0.09, 'square', 0.09, 0, 140);
          if (hooks.onBossDamage) hooks.onBossDamage(ev.dmg, false);
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.11);
        } else if (ev.type === 'poison_apply') {
          this.spawnVfx('fxImpactGreenBig', BOSS_X, BRIDGE_Y - 86, 1.05, { speedMult: 1.7 });
          this.spawnParticles(BOSS_X, BRIDGE_Y - 90, '#7ef28a', 10);
          this.spawnPopup(BOSS_X + 34, BRIDGE_Y - 114, `+${ev.stacks} 剧毒`, '#7ef28a', 22);
          if (audio) audio.tone(310, 0.06, 'sine', 0.07, 0, 440);
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
          this.spawnVfx('fxImpactGreenBig', BOSS_X, BRIDGE_Y - 88, 1.9);
          this.spawnShockwave(BOSS_X, BRIDGE_Y - 88, '#7ef28a', 78, 0.24, 4);
          this.spawnParticles(BOSS_X, BRIDGE_Y - 88, '#7ef28a', 24);
          this.spawnPopup(BOSS_X, BRIDGE_Y - 150, `毒爆 -${ev.dmg}`, '#7ef28a', 34);
          if (audio) audio.tone(175, 0.16, 'sawtooth', 0.11, 0, 88);
          if (hooks.onBossDamage) hooks.onBossDamage(ev.dmg, true);
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.22);
        } else if (ev.type === 'furnace_proc') {
          this.spawnVfx('fx_flamesphere', 405, BRIDGE_Y - 86, 1.5);
          this.spawnParticles(405, BRIDGE_Y - 86, '#ffd966', 18);
          this.spawnPopup(405, BRIDGE_Y - 145, `炼金炉 +${ev.gold}G · 手牌+${ev.handAtkGain}攻`, '#ffd966', 24);
          if (audio) audio.tone(480, 0.11, 'triangle', 0.09, 0, 720);
          if (hooks.onGoldGain) hooks.onGoldGain(ev.gold);
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.22);
        } else if (ev.type === 'boss_vuln') {
          this.spawnVfx('fx_f4_voidpulse', BOSS_X, BRIDGE_Y - 82, 1.35, { speedMult: 1.5 });
          this.spawnPopup(BOSS_X, BRIDGE_Y - 172, '易伤 ×1.4!', '#ff8a5c', 24);
          if (audio) audio.tone(280, 0.09, 'sawtooth', 0.07, 0, 170);
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
          this.spawnVfx('fx_f1_holyimmolation', BOSS_X, BRIDGE_Y - 84, 1.85);
          this.spawnShockwave(BOSS_X, BRIDGE_Y - 84, '#ffd966', 105, 0.28, 5);
          this.spawnParticles(BOSS_X, BRIDGE_Y - 84, '#ffd966', 26);
          this.spawnPopup(BOSS_X, BRIDGE_Y - 190, '破招眩晕! ×1.5', '#ffd966', 34);
          if (audio) audio.tone(440, 0.14, 'square', 0.12, 0, 880);
          if (hooks.onBossStatus) hooks.onBossStatus({ stunned: true });
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.24);
        } else if (ev.type === 'boss_shield') {
          this.spawnVfx('fxDistortionHexShield', BOSS_X, BRIDGE_Y - 76, 1.65);
          this.spawnPopup(BOSS_X, BRIDGE_Y - 154, `+${ev.amount} 魔盾`, '#7be8ff', 24);
          if (audio) audio.tone(420, 0.10, 'sine', 0.09, 0, 620);
          if (hooks.onBossStatus) hooks.onBossStatus({ addShield: ev.amount });
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.16);
        } else if (ev.type === 'shield_gain') {
          const sx = (this.slotUnits[lastHeroSlotIdx] ? this.slotUnits[lastHeroSlotIdx].homeX : SLOT_X[0]);
          this.spawnVfx('fxDistortionHexShield', sx, BRIDGE_Y - 58, 1.25, { speedMult: 1.5 });
          this.spawnParticles(sx, BRIDGE_Y - 58, '#7be8ff', 8);
          this.spawnPopup(sx, BRIDGE_Y - 114, `+${ev.amount} 蓝盾`, '#78b7ff', 22);
          if (audio) audio.tone(460, 0.07, 'sine', 0.07, 0, 640);
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
          if (audio) audio.tone(680, 0.06, 'triangle', 0.08, 0, 980);
          if (hooks.onGoldGain) hooks.onGoldGain(ev.amount);
          else if (hooks.onSyncHud) hooks.onSyncHud();
          await this.waitSec(0.065);
        } else if (ev.type === 'hero_grow') {
          const u = this.slotUnits.find((x) => x && x.uid === ev.heroUid) || this.slotUnits[lastHeroSlotIdx];
          const gx = u ? u.homeX : 405;
          if (u) { u.flash = 0.12; u.squashX = 0.94; u.squashY = 1.08; }
          this.spawnVfx('fxBuffSimpleGold', gx, BRIDGE_Y - 60, 1.15, { speedMult: 1.6 });
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
          if (audio) audio.tone(210, 0.07, 'square', 0.07, 0, 130);
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
            if (audio) audio.tone(110, 0.12, 'sawtooth', 0.09, 0, 165);
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

            if (fullBlocked) {
              this.spawnVfx('fxDistortionHexShield', hitCenter, BRIDGE_Y - 72, 1.95);
              this.spawnShockwave(hitCenter, BRIDGE_Y - 72, '#78b7ff', 82, 0.24, 4);
              this.spawnParticles(hitCenter, BRIDGE_Y - 72, '#7be8ff', 18, -1);
              if (audio) {
                audio.tone(520, 0.09, 'triangle', 0.11, 0, 740);
                audio.tone(240, 0.12, 'sine', 0.09, 0, 180);
              }
            } else {
              this.spawnVfx(isUlt ? 'fxExplosionBigBall_MetalSlug' : 'fxImpactBigOrange', hitCenter, BRIDGE_Y - 76, isUlt ? 2.15 : 1.85);
              this.spawnShockwave(hitCenter, BRIDGE_Y - 76, '#ff4757', isUlt ? 105 : 78, 0.24, 4.5);
              this.spawnParticles(hitCenter, BRIDGE_Y - 76, '#ff5c72', isUlt ? 26 : 18, -1);
              if (audio) audio.tone(115, 0.20, 'sawtooth', 0.13, 0, 48);
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
            this.spawnPopup(hitCenter, BRIDGE_Y - 134, msg, ev.hpLost > 0 ? '#ff5c72' : '#78b7ff', isUlt ? 32 : 28);
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
          this.spawnVfx('fxExplosionBigBall_MetalSlug', BOSS_X, BRIDGE_Y - 84, 1.9);
          this.spawnShockwave(BOSS_X, BRIDGE_Y - 84, '#78b7ff', 88, 0.26, 4.5);
          this.spawnParticles(BOSS_X, BRIDGE_Y - 84, '#78b7ff', 22, 1);
          this.spawnPopup(BOSS_X, BRIDGE_Y - 155, `反震 -${ev.dmg}!`, '#78b7ff', 34);
          if (audio) audio.tone(190, 0.15, 'sawtooth', 0.12, 0, 92);
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

      // 3. Pale Cold Moon placed cleanly in the open gap between Slot 3 (vx=146) and Boss (vx=238)!
      const mx = 186;
      const my = 29;
      const mg = ctx.createRadialGradient(mx, my, 8, mx, my, 46);
      mg.addColorStop(0, `rgba(${pal.moonGlow}, 0.16)`);
      mg.addColorStop(0.45, `rgba(${pal.moonGlow}, 0.06)`);
      mg.addColorStop(1, `rgba(${pal.moonGlow}, 0)`);
      ctx.fillStyle = mg;
      ctx.fillRect(mx - 48, my - 48, 96, 96);
      this.drawPixelDisc(ctx, mx, my, 11, pal.moonCore);
      // Subtle lunar maria craters
      this.drawPixelDisc(ctx, mx - 3, my - 2, 3, pal.moonShade);
      this.drawPixelDisc(ctx, mx + 4, my + 2, 2, pal.moonShade);
      ctx.fillStyle = pal.moonShade;
      ctx.fillRect(mx - 1, my + 4, 3, 2);

      // 4. Low-contrast horizontal nocturnal cloud bands (softly veiling lower moon rim)
      this.drawMergedCloudBank(ctx, [
        [28, 52, 18], [58, 49, 20], [92, 53, 18], [134, 48, 21],
        [174, 44, 15], [204, 46, 17], [248, 50, 19], [286, 46, 22], [312, 49, 17]
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
    drawStoneBridge(ctx) {
      const pal = NOCTURNE_PALETTES[this.biome] || NOCTURNE_PALETTES.default;
      const y = BRIDGE_Y, h = LAKE_Y - BRIDGE_Y;
      ctx.fillStyle = '#070810'; ctx.fillRect(0, y - 4, BW, 4);
      const rim = ctx.createLinearGradient(0, 0, BW, 0);
      rim.addColorStop(0, pal.rimL); rim.addColorStop(0.55, pal.rimM); rim.addColorStop(1, pal.rimR);
      ctx.fillStyle = rim; ctx.fillRect(0, y, BW, 4);
      ctx.fillStyle = '#262d40'; ctx.fillRect(0, y + 4, BW, 12);
      ctx.fillStyle = '#171c2b'; ctx.fillRect(0, y + 16, BW, 12);
      for (let bx = 0; bx < BW; bx += 48) { ctx.fillStyle = '#0c0f1a'; ctx.fillRect(bx, y + 4, 4, 12); ctx.fillRect(bx + 24, y + 16, 4, 12); }
      ctx.fillStyle = '#06070f'; ctx.fillRect(0, y + h - 4, BW, 4);
    }

    loop(ts) {
      if (!this.running) return;
      const rawDt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
      this.lastTs = ts;
      const dt = rawDt * this.speed;

      // Always tick screen shake, flash & cut-in smoothly even during hit-stop!
      if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - rawDt);
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

      // 2. Subtle Warm Bridge-Lamp Halo (far left edge x=72px, softly flickering)
      const lampFlicker = 0.86 + 0.14 * Math.sin(this.idleTime * 5.2) * Math.cos(this.idleTime * 2.3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(72, BRIDGE_Y - 104, 4, 72, BRIDGE_Y - 104, 86);
      lg.addColorStop(0, `rgba(235, 178, 92, ${0.22 * lampFlicker})`);
      lg.addColorStop(0.5, `rgba(210, 140, 62, ${0.07 * lampFlicker})`);
      lg.addColorStop(1, 'rgba(210, 140, 62, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, BRIDGE_Y - 190, 162, 176);
      ctx.restore();

      // 3. Slow-Drifting Low-Lying Mist Ribbons along the horizon (zero distraction over UI)
      ctx.save();
      for (let r = 0; r < 3; r++) {
        const yBase = BRIDGE_Y - 52 + r * 18;
        const speed = 11 + r * 6;
        const offset = (this.idleTime * speed + r * 370) % (BW + 420);
        const mx = offset - 420;
        const mg = ctx.createLinearGradient(mx, yBase, mx + 420, yBase);
        mg.addColorStop(0, `rgba(${pal.mistRgb}, 0)`);
        mg.addColorStop(0.5, `rgba(${pal.mistRgb}, ${0.045 + r * 0.015})`);
        mg.addColorStop(1, `rgba(${pal.mistRgb}, 0)`);
        ctx.fillStyle = mg;
        ctx.fillRect(Math.round(mx), yBase, 420, 20 + r * 6);
      }
      ctx.restore();

      // 4. Delicate Midnight Drizzle Streaks (ultra-faint, purely atmospheric)
      ctx.save();
      ctx.strokeStyle = pal.rainCol;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const rx = ((hash2(i, 4, 31) * BW) - this.idleTime * 42) % BW;
        const x = rx < 0 ? rx + BW : rx;
        const y = ((hash2(i, 9, 17) * BRIDGE_Y) + this.idleTime * (210 + (i % 3) * 35)) % BRIDGE_Y;
        ctx.moveTo(Math.round(x), Math.round(y));
        ctx.lineTo(Math.round(x - 4), Math.round(y + 16));
      }
      ctx.stroke();
      ctx.restore();

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

          // Distinct Structural Tier VFX on Bridge Units
          if (u.tier === 'B') {
            const bp = 0.78 + 0.22 * Math.sin(this.idleTime * 2.4 + u.phase);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(ux, BRIDGE_Y + 3);
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
            ctx.save();
            ctx.translate(ux, u.y - 54);
            ctx.rotate(this.idleTime * 0.55 + u.phase);
            ctx.strokeStyle = `rgba(212, 140, 255, ${0.58 * ap})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(-26, -26, 52, 52);
            ctx.rotate(Math.PI / 4);
            ctx.strokeRect(-26, -26, 52, 52);
            ctx.restore();
            ctx.save();
            ctx.translate(ux, BRIDGE_Y + 3);
            ctx.scale(1, 0.28);
            ctx.strokeStyle = `rgba(208, 128, 255, ${0.85 * ap})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            for (let m = 0; m < 4; m++) {
              const mt = (this.idleTime * 0.42 + m * 0.25 + u.phase) % 1;
              const mx = ux + Math.sin(m * 2.3 + this.idleTime * 1.5) * 28;
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
            ctx.save();
            ctx.translate(ux, u.y - 56);
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
            ctx.save();
            ctx.translate(ux, BRIDGE_Y + 3);
            ctx.scale(1, 0.28);
            ctx.strokeStyle = `rgba(255, 214, 82, ${0.9 * sp})`;
            ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            for (let m = 0; m < 6; m++) {
              const mt = (this.idleTime * 0.45 + m * 0.166 + u.phase) % 1;
              const mx = ux + Math.sin(m * 2.1 + this.idleTime * 1.6) * 32;
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
            ctx.save();
            ctx.translate(ux, u.y - 58);
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
            ctx.save();
            ctx.translate(ux, BRIDGE_Y + 3);
            ctx.scale(1, 0.28);
            ctx.strokeStyle = `rgba(255, 94, 142, ${0.95 * mp})`;
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            for (let m = 0; m < 8; m++) {
              const mt = (this.idleTime * 0.5 + m * 0.125 + u.phase) % 1;
              const mx = ux + Math.sin(m * 2.4 + this.idleTime * 1.9) * 36;
              const my = u.y - 6 - mt * 120;
              ctx.globalAlpha = Math.sin(mt * Math.PI) * 0.95;
              ctx.fillStyle = m % 2 === 0 ? '#ffd966' : '#ff5e8e';
              ctx.fillRect(Math.round(mx), Math.round(my), 4, 4);
            }
            ctx.restore();
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
          if (!this.boss || !this.boss.alive) return;
          const isCharging = this.bossIntent && (this.bossIntent.kind === 'charge' || this.bossIntent.kind === 'ult');
          const bossRelated = Boolean(this.relatedMeta && this.relatedMeta.boss);
          const bossJitter = (this.hitstop > 0 && this.hitstopTarget === 'boss') ? ((Math.floor(performance.now() / 16) % 2 === 0) ? 3 : -3) : 0;
          ctx.save();
          if (inspectActive && !bossRelated) ctx.globalAlpha = 0.42;
          const bossOutline = this.boss.flash > 0 ? '#ffffff'
            : (inspectActive && bossRelated && this.relatedMeta.bossColor) ? this.relatedMeta.bossColor
            : this.bossStunned ? '#ffd966' : isCharging ? '#ff477e' : '#f2f6ff';
          const isBossAtk = this.boss.anim === 'attack';
          sprites.drawUnit(ctx, this.boss.unitId, this.boss.anim, this.idleTime + this.boss.phase, Math.round(this.boss.x + this.boss.knockX + bossJitter), Math.round(this.boss.y), {
            scale: this.boss.scale,
            flipX: true,
            loop: !isBossAtk,
            elapsedOverride: isBossAtk ? (this.boss.animElapsed || 0) : null,
            speedMult: isBossAtk ? (this.boss.animSpeedMult || 1) : 1,
            squashX: this.boss.squashX || 1,
            squashY: this.boss.squashY || 1,
            flashWhite: this.boss.flash > 0 ? Math.min(0.9, this.boss.flash / 0.15) : 0,
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

      // Impact Shockwave Rings
      for (const sw of this.shockwaves) {
        const p = Math.min(1, sw.t / sw.dur);
        const r = 10 + (sw.maxR - 10) * (1 - Math.pow(1 - p, 3));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - p) * 0.85;
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = Math.max(1.5, sw.lineWidth * (1 - p * 0.65));
        ctx.beginPath();
        ctx.arc(Math.round(sw.x), Math.round(sw.y), r, 0, Math.PI * 2);
        ctx.stroke();
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
      const waterDepth = ctx.createLinearGradient(0, LAKE_Y, 0, BH);
      waterDepth.addColorStop(0, 'rgba(4, 6, 14, 0.34)'); waterDepth.addColorStop(0.55, 'rgba(4, 6, 14, 0.68)'); waterDepth.addColorStop(1, 'rgba(3, 4, 10, 0.88)');
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
      if (this.boss && this.boss.alive) {
        ctx.save();
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

      // Floating Damage / Growth Popups
      for (const p of this.popups) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.45));
        const pxSize = Math.max(12, Math.round(p.size / 2) * 2);
        ctx.font = `${pxSize}px "FusionPixel", monospace`;
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#08060f';
        ctx.strokeText(p.text, Math.round(p.x), Math.round(p.y));
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, Math.round(p.x), Math.round(p.y));
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
