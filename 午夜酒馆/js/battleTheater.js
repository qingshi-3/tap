// v7.5 Full-Bleed 1280x720 Mirror-Lake Eclipse Pixel Battle Theater
// Aesthetic: Split-Biome Midnight Pine Forest <-> Giant Crimson Solar Eclipse Ruins + Real-Time Shimmering Mirror Lake Reflection
// Engine: Duelyst H5 Kit Units (20-43 frame smooth attacks + exact anchorX/anchorY) & 19 Independent Keyed Effects
// Juice: Additive Light Pools (reflected live in water!), Shockwaves, Ranged Projectiles, Speed Afterimages, Recoil Squash & Hitstop
(function () {
  window.MT = window.MT || {};

  const BW = 1280;
  const BH = 720;
  const VW = 320; // 4x crisp integer pixel scale -> 1280x720!
  const VH = 180;
  const BRIDGE_VY = 104;          // Virtual Y of top surface of stone bridge
  const BRIDGE_Y = BRIDGE_VY * 4; // 416px: unit feet sit right on the bridge!
  const LAKE_Y = (BRIDGE_VY + 8) * 4; // 448px: mirror lake begins right beneath bridge!

  // Explicit Duelyst H5 independent effect keys for Boss Ultimates
  const BOSS_ULTS = {
    fire:  { name: '炼狱焚城', vfx: 'fx_flamesphere', color: '#ff6e3a' },
    grass: { name: '剧毒荆棘潮', vfx: 'fxImpactGreenBig', color: '#5ef29b' },
    ice:   { name: '极寒冰风暴', vfx: 'fxFrozenIceBlock', color: '#5ce6ff' },
    light: { name: '炽耀审判', vfx: 'fx_f1_holyimmolation', color: '#ffe46b' },
    dark:  { name: '深渊暗影收割', vfx: 'fx_f4_shadownova', color: '#c07aff' },
    bolt:  { name: '九霄雷霆降', vfx: 'fx_f2_twilightreiki', color: '#64f0e8' }
  };

  const EL_LIGHT_COLORS = {
    fire:  '#ff7a33',
    grass: '#52e88a',
    ice:   '#5ce6ff',
    light: '#ffe378',
    dark:  '#b86cff',
    bolt:  '#58f5ee'
  };

  // Biome right-side eclipse palette subtly shifts by Boss element while preserving iconic cool-vs-warm contrast!
  const ECLIPSE_PALETTES = {
    default: { skyTop: '#3e1c4a', skyMid: '#8a3560', skyLow: '#d96c84', corona1: '#a82c58', corona2: '#ff6e8e', cloudDark: '#b84b6a', cloudMid: '#ea7b8e', cloudHi: '#ffc2cc', ruinDark: '#3f384f', ruinMid: '#5d5370', ruinHi: '#827699', seam: 'rgba(235, 118, 128, 0.42)' },
    ice:     { skyTop: '#241a4a', skyMid: '#5c2e6e', skyLow: '#b85c94', corona1: '#7e308c', corona2: '#eb78d4', cloudDark: '#7a3c7c', cloudMid: '#bf68a8', cloudHi: '#f5b8e2', ruinDark: '#34334d', ruinMid: '#504e70', ruinHi: '#7a789e', seam: 'rgba(195, 115, 225, 0.40)' },
    dark:    { skyTop: '#2d123d', skyMid: '#6e2159', skyLow: '#c24874', corona1: '#941e58', corona2: '#ff528c', cloudDark: '#94315e', cloudMid: '#d65e83', cloudHi: '#ffb0c8', ruinDark: '#362e47', ruinMid: '#54486b', ruinHi: '#7b6c96', seam: 'rgba(218, 92, 138, 0.44)' }
  };

  const MINION_TEMPLATES = {
    fire:  { name: '焦炎步兵', unitId: 's_raider', role: 'warrior', el: 'fire' },
    grass: { name: '剧毒哨兵', unitId: 'n_kiri',   role: 'ranged',  el: 'grass' },
    ice:   { name: '冰霜魔狼', unitId: 'v_frost',  role: 'warrior', el: 'ice' },
    light: { name: '圣殿盾卫', unitId: 'l_iron',   role: 'tank',    el: 'light' },
    dark:  { name: '暗影侍僧', unitId: 'a_bloodmoon', role: 'ranged', el: 'dark' },
    bolt:  { name: '雷爪斥候', unitId: 's_fox',    role: 'assassin', el: 'bolt' }
  };

  function hash2(x, y, seed = 1) {
    let n = Math.imul(x + 31, 374761393) + Math.imul(y + 19, 668265263) + Math.imul(seed, 1442695041);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  // Handcrafted Black-Outlined Multi-Tone Pixel-Matrix Sprites (ZERO simple geometric blocks!)
  const PROP_PAL = {
    'K': '#090712', // bold pixel-art ink outline
    'I': '#1f2336', // dark steel/iron
    'i': '#3d4563', // iron midtone
    's': '#7c89b0', // steel highlight
    'C': '#2289b8', // frost cyan deep
    'c': '#58d4ff', // frost cyan bright
    'W': '#f0fdff', // incandescent cyan-white core
    'S': '#383d59', // stone shadow
    'z': '#5a6385', // stone mid
    'Z': '#8e99bf', // stone highlight
    'O': '#2e293d', // obsidian monolith dark
    'o': '#524966', // obsidian mid
    'h': '#7b6f94', // obsidian edge highlight
    'V': '#a34cff', // arcane violet core
    'v': '#e6b8ff', // arcane pale glow
    'R': '#d4425c', // crimson rune
    'Y': '#ffe699'  // gold accent
  };

  const PROPS = {
    // Gothic Cyan-Glowing Pixel Streetlamp (13x44, matching reference left causeway lamp!)
    cyanLamp: [
      '......K......',
      '.....KsK.....',
      '....KisiK....',
      '...KiCCciK...',
      '..KiCWWWCiK..',
      '..KiCWWWCiK..',
      '..KiCWWWCiK..',
      '...KiCCciK...',
      '....KiiiK....',
      '.....KiK.....',
      '....KisiK....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '.....KiK.....',
      '....KisiK....',
      '...KizSziK...',
      '...KzSSSzK...',
      '..KzZSSSZzK..',
      '..KKKKKKKKK..'
    ],
    // Floating Faceted Cyan Mana Crystal (9x16, bobbing gracefully on ally side!)
    floatCrystal: [
      '....K....',
      '...KCK...',
      '..KCcWK..',
      '..KCcWK..',
      '.KCccWWK.',
      '.KCccWWK.',
      'KCcccWWcK',
      'KCcccWWcK',
      'KCccWWccK',
      '.KCcWccK.',
      '.KCccccK.',
      '..KCccK..',
      '..KCCcK..',
      '...KCK...',
      '....K....'
    ],
    // Floating Jagged Obsidian Ruin Shard (9x14, hovering in eclipse sky!)
    floatShard: [
      '..KKKKK..',
      '.KOhhhoK.',
      '.KOhhooK.',
      'KOhhoOOK.',
      'KOhooOOK.',
      '.KOooOOK.',
      '.KOOoOK..',
      '..KOOOK..',
      '..KOOOK..',
      '...KOOK..',
      '...KOK...',
      '....K....'
    ],
    // Hovering Arcane Eclipse Obelisk Prism (15x17, boss domain emblem!)
    arcanePrism: [
      '.KKKKKKKKKKKKK.',
      'KhhhooooooooohK',
      'KhOoKKKKKKKKoOK',
      '.KhOKVVVVVVKoK.',
      '.KhOKVvvvvVKoK.',
      '..KhOKvWWvKoK..',
      '..KhOKvWWvKoK..',
      '...KhOKvvKoK...',
      '...KhOKVVKoK...',
      '....KhOKKoK....',
      '....KhOOoK.....',
      '.....KhOK......',
      '.....KOOK......',
      '......KK.......'
    ]
  };

  function drawMatrix(ctx, rows, ox, oy, flipX = false) {
    const w = rows[0] ? rows[0].length : 0;
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = PROP_PAL[ch];
        if (!col) continue;
        const dx = flipX ? (ox + (w - 1 - x)) : (ox + x);
        ctx.fillStyle = col;
        ctx.fillRect(dx, oy + y, 1, 1);
      }
    }
  }

  class BattleTheater {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.canvas.width = BW;
      this.canvas.height = BH;

      // Offscreen upper-world buffer (1280 x 440) used to render the real-time shimmering mirror-lake reflection!
      this.sceneBuf = document.createElement('canvas');
      this.sceneBuf.width = BW;
      this.sceneBuf.height = BRIDGE_Y + 24; // 440px
      this.sceneCtx = this.sceneBuf.getContext('2d');

      this.bgCache = {};
      this.running = false;
      this.rafId = null;
      this.lastTs = 0;
      this.speed = 1;

      this.time = 0;
      this.hitstop = 0;
      this.shakeTime = 0;
      this.shakeAmp = 0;
      this.finisherSlow = 0;
      this.screenFlash = null;

      this.allies = [];
      this.enemies = [];
      this.drinks = [];
      this.drinksUsed = 0;
      this.draggingDrinkIdx = -1;
      this.dragPos = null;

      this.turnQueue = [];
      this.round = 1;
      this.actionTimer = 0;
      this.activeAnim = null;
      this.activeActor = null;
      this.cutIn = null;
      this.finishDelay = 0;
      this.battleResult = null;
      this.bossGhostHp = 0;

      this.particles = [];
      this.popups = [];
      this.projectiles = [];
      this.activeVfx = [];
      this.lights = [];
      this.shockwaves = [];
      this.afterimages = [];
      this.ambientMotes = [];

      this.contract = null;
      this.onDone = null;
      this.highlight = '';

      this.bindBattlePointer();
    }

    getBiomeKey(contract) {
      const el = (contract && contract.elements && contract.elements[0]) || 'fire';
      if (el === 'ice') return 'ice';
      if (el === 'dark') return 'dark';
      return 'default';
    }

    // ─── Bake Upper Sky, Pine Forest, Shattered Obsidian Ruins & Bridge (320x112 virtual pixels!) ───
    getUpperBgCanvas(biome) {
      if (this.bgCache[biome]) return this.bgCache[biome];
      const pal = ECLIPSE_PALETTES[biome] || ECLIPSE_PALETTES.default;
      const c = document.createElement('canvas');
      c.width = VW;
      c.height = BRIDGE_VY + 8;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // 1. LEFT SKY (Deep midnight indigo -> serene moonlit cerulean -> glowing frost-cyan mist)
      const leftSky = ctx.createLinearGradient(0, 0, 0, BRIDGE_VY);
      leftSky.addColorStop(0, '#161638');
      leftSky.addColorStop(0.50, '#222b60');
      leftSky.addColorStop(0.82, '#347db0');
      leftSky.addColorStop(1, '#68d8f5');
      ctx.fillStyle = leftSky;
      ctx.fillRect(0, 0, 178, BRIDGE_VY);

      // 2. RIGHT SKY (Dramatic plum -> crimson-magenta -> rose-coral eclipse horizon!)
      const rightSky = ctx.createLinearGradient(0, 0, 0, BRIDGE_VY);
      rightSky.addColorStop(0, pal.skyTop);
      rightSky.addColorStop(0.55, pal.skyMid);
      rightSky.addColorStop(1, pal.skyLow);
      ctx.fillStyle = rightSky;
      ctx.fillRect(156, 0, VW - 156, BRIDGE_VY);

      // Stylized continuous billowing dark-indigo clouds on LEFT sky (merged silhouette, zero donut rings!)
      this.drawMergedCloudBank(ctx, [
        [18, 56, 20], [46, 46, 24], [78, 42, 26], [112, 48, 24], [140, 56, 20]
      ], '#3a367d', '#29265e', '#1e1c4a');

      // 3. MASSIVE PROMINENT BLACK-HOLE SOLAR ECLIPSE & CURVED FLAMING CORONA (Hero Focal Point!)
      const ex = 232, ey = 38;
      // Outer crimson corona radial glow
      const ecg = ctx.createRadialGradient(ex, ey, 16, ex, ey, 44);
      ecg.addColorStop(0, 'rgba(255, 110, 148, 0.45)');
      ecg.addColorStop(0.55, 'rgba(180, 42, 92, 0.20)');
      ecg.addColorStop(1, 'rgba(120, 20, 60, 0)');
      ctx.fillStyle = ecg;
      ctx.fillRect(ex - 46, 0, 92, 86);

      // 24 Curved jagged flame corona tendrils swirling around the eclipse!
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2 + 0.08;
        const len = 30 + (i % 3) * 7 + (i % 2) * 3;
        const curve = 0.34; // unified vortex swirl direction like reference!
        for (let step = 16; step <= len; step++) {
          const t = (step - 16) / (len - 16);
          const a = ang + curve * t * t;
          const px = Math.round(ex + Math.cos(a) * step);
          const py = Math.round(ey + Math.sin(a) * step);
          const w = Math.max(1, Math.round((1 - t) * 3.5));
          ctx.fillStyle = t < 0.38 ? pal.corona2 : pal.corona1;
          ctx.fillRect(px - Math.floor(w / 2), py - Math.floor(w / 2), w, w);
        }
      }
      // Blazing white-rose inner ring + pure void-black eclipse core
      this.drawPixelDisc(ctx, ex, ey, 21, pal.corona2);
      this.drawPixelDisc(ctx, ex, ey, 19, '#fff2f7');
      this.drawPixelDisc(ctx, ex, ey, 16, '#08040e');
      // Subtle jagged dark solar flares licking inward on the black rim
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        ctx.fillStyle = '#08040e';
        ctx.fillRect(Math.round(ex + Math.cos(a) * 16.8), Math.round(ey + Math.sin(a) * 16.8), 2, 2);
      }

      // Billowing Coral-Pink Stylized Pixel Cloud Bank (tucked gracefully BELOW eclipse center — ZERO donuts!)
      this.drawMergedCloudBank(ctx, [
        [168, 72, 16], [190, 65, 18], [216, 68, 17], [244, 66, 18], [272, 62, 20], [300, 54, 22], [318, 48, 18]
      ], pal.cloudHi, pal.cloudMid, pal.cloudDark);

      // 4. LEFT BIOME: CRISP BLACK-OUTLINED LAYERED EVERGREEN PINE FOREST + SOFT CYAN GLOW RIDGE!
      const backPines = [16, 36, 58, 80, 102, 124, 144];
      for (const px of backPines) {
        const h = 32 + Math.floor(hash2(px, 2, 12) * 12);
        this.drawOutlinedPine(ctx, px, BRIDGE_VY - 10, h, '#143844', '#1f5360');
      }
      const frontPines = [8, 28, 48, 70, 92, 114, 134, 150];
      for (const px of frontPines) {
        const h = 26 + Math.floor(hash2(px, 5, 19) * 12);
        this.drawOutlinedPine(ctx, px, BRIDGE_VY - 6, h, '#1d545e', '#2e787e');
      }
      // Smooth organically undulating frost-cyan backlit ridge (softer teal-cyan so allies pop cleanly!)
      this.drawMergedCloudBank(ctx, [
        [8, BRIDGE_VY - 7, 14], [30, BRIDGE_VY - 9, 16], [56, BRIDGE_VY - 8, 16],
        [84, BRIDGE_VY - 10, 18], [112, BRIDGE_VY - 8, 16], [138, BRIDGE_VY - 9, 15]
      ], '#8ef0ff', '#5ccce8', '#3ba4cc');
      ctx.fillStyle = '#70dff5';
      ctx.fillRect(0, BRIDGE_VY - 5, 154, 5);

      // Far-left crafted pitched-roof gothic stone tavern turret corner (zero flat box!)
      this.drawLeftGatehouse(ctx, BRIDGE_VY);

      // Handcrafted Gothic Cyan Streetlamp on left causeway!
      drawMatrix(ctx, PROPS.cyanLamp, 38, BRIDGE_VY - 38);

      // 5. RIGHT BIOME: ORGANIC BLACK-OUTLINED SHATTERED GOTHIC RUINS & CRUMBLED FORTRESS SILHOUETTE!
      this.drawShatteredRuins(ctx, 158, VW, BRIDGE_VY, pal);

      // Warm dusty-rose low horizon mist hugging base of ruins
      const rHaze = ctx.createLinearGradient(0, BRIDGE_VY - 18, 0, BRIDGE_VY);
      rHaze.addColorStop(0, 'rgba(235, 142, 158, 0)');
      rHaze.addColorStop(1, 'rgba(222, 152, 165, 0.56)');
      ctx.fillStyle = rHaze;
      ctx.fillRect(156, BRIDGE_VY - 18, VW - 156, 18);

      // 6. Dramatic Organic Swirling Mist Plume along the Center Biome Divide (zero vertical line!)
      this.drawBiomeSeamPlume(ctx, 156, BRIDGE_VY, pal);

      this.bgCache[biome] = c;
      return c;
    }

    // Renders a clean merged billowing pixel cloud bank (top highlight -> midtone -> shadow, ZERO concentric donut rings!)
    drawMergedCloudBank(ctx, puffs, colHi, colMid, colDark) {
      for (const [cx, cy, r] of puffs) this.drawPixelDisc(ctx, cx, cy, r, colHi);
      for (const [cx, cy, r] of puffs) this.drawPixelDisc(ctx, cx + 1, cy + 3, Math.max(2, r - 1), colMid);
      for (const [cx, cy, r] of puffs) this.drawPixelDisc(ctx, cx + 2, cy + 7, Math.max(2, r - 2), colDark);
    }

    // Crafted far-left gothic stone tavern corner with pitched slate eaves & pointed arch window
    drawLeftGatehouse(ctx, baseY) {
      // Pitched slate shingle roof overhang
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = '#090712';
        ctx.fillRect(0, 52 + i, 12 + i, 2);
        ctx.fillStyle = i % 2 === 0 ? '#2b3454' : '#3d4c78';
        ctx.fillRect(0, 52 + i, 10 + i, 1);
      }
      // Stone wall body with quoins & crisp outline
      ctx.fillStyle = '#090712';
      ctx.fillRect(0, 60, 16, baseY - 60);
      ctx.fillStyle = '#364369';
      ctx.fillRect(0, 60, 14, baseY - 60);
      for (let wy = 62; wy < baseY - 2; wy += 6) {
        ctx.fillStyle = '#536799';
        ctx.fillRect(0, wy, 13, 4);
        ctx.fillStyle = '#738cc4';
        ctx.fillRect(0, wy, 12, 1);
      }
      // Pointed gothic leaded window glowing warm-cyan
      ctx.fillStyle = '#090712';
      ctx.fillRect(2, 72, 9, 13);
      ctx.fillRect(4, 70, 5, 3);
      ctx.fillStyle = '#9cf4ff';
      ctx.fillRect(3, 73, 7, 11);
      ctx.fillRect(5, 71, 3, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, 74, 2, 4);
      ctx.fillStyle = '#222b47';
      ctx.fillRect(6, 72, 1, 12);
      ctx.fillRect(3, 78, 7, 1);
    }

    // Swirling organic pixel smoke/mist plume separating the two biomes (matching reference center plume!)
    drawBiomeSeamPlume(ctx, centerX, baseY, pal) {
      ctx.save();
      ctx.globalAlpha = 0.42;
      for (let y = 0; y < baseY; y += 2) {
        const sway = Math.round(Math.sin(y * 0.08) * 6 + (baseY - y) * 0.06);
        const w = 14 + Math.round(Math.sin(y * 0.14) * 5);
        ctx.fillStyle = pal.cloudMid;
        ctx.fillRect(centerX + sway - Math.floor(w / 2), y, w, 3);
        ctx.fillStyle = pal.cloudHi;
        ctx.fillRect(centerX + sway - Math.floor(w / 2) + 3, y, Math.max(3, Math.floor(w * 0.35)), 2);
      }
      ctx.restore();
    }

    drawPixelDisc(ctx, cx, cy, r, color) {
      ctx.fillStyle = color;
      const r2 = r * r;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r2) {
            ctx.fillRect(cx + dx, cy + dy, 1, 1);
          }
        }
      }
    }

    // Crisp #090712 black-outlined full-bodied evergreen pixel pine tree (wider, softer tiers like reference!)
    drawOutlinedPine(ctx, cx, baseY, h, colDark, colLit) {
      const tiers = 4;
      const topY = baseY - h;
      for (let t = 0; t < tiers; t++) {
        const ty = topY + Math.floor((t / tiers) * (h * 0.68));
        const th = Math.floor(h * 0.40);
        const maxW = 5 + t * 3.6;
        for (let row = 0; row < th; row++) {
          const hw = Math.max(1, Math.round((row / th) * maxW));
          ctx.fillStyle = '#090712';
          ctx.fillRect(cx - hw - 1, ty + row - 1, hw * 2 + 3, 3);
        }
      }
      for (let t = 0; t < tiers; t++) {
        const ty = topY + Math.floor((t / tiers) * (h * 0.68));
        const th = Math.floor(h * 0.40);
        const maxW = 5 + t * 3.6;
        for (let row = 0; row < th; row++) {
          const hw = Math.max(1, Math.round((row / th) * maxW));
          ctx.fillStyle = colDark;
          ctx.fillRect(cx - hw, ty + row, hw * 2 + 1, 1);
          ctx.fillStyle = colLit;
          ctx.fillRect(cx - hw, ty + row, Math.max(1, Math.floor(hw * 0.72)), 1);
        }
      }
    }

    // Organic jagged crumbled obsidian ruins & broken gothic spires (merged outer ink contour, ZERO rectangular pipes!)
    drawShatteredRuins(ctx, startX, endX, baseY, pal) {
      // Build continuous pixel heightmap of crumbled fortress battlements, arches & jagged spires
      const heights = new Int16Array(VW);
      for (let x = startX; x < endX; x++) {
        // Organic rolling rubble base + stepped crenellations
        const wave = Math.sin(x * 0.09) * 5 + Math.cos(x * 0.23) * 3;
        const step = (Math.floor(x / 5) % 3 === 0) ? 5 : (Math.floor(x / 4) % 2 === 0 ? 2 : 0);
        heights[x] = Math.max(10, Math.round(20 + wave + step));
      }
      // Sculpt asymmetric fractured gothic ruin spires (tapered jagged tips, broken ledges!)
      const spireSpecs = [
        { cx: 174, h: 40, w: 6, lean: -1 },
        { cx: 196, h: 48, w: 7, lean: 1 },
        { cx: 222, h: 36, w: 6, lean: -1 },
        { cx: 262, h: 42, w: 7, lean: 1 },
        { cx: 294, h: 38, w: 6, lean: -1 }
      ];
      // First carve silhouette mask on a small virtual grid so we draw ONE unified #090712 ink outline!
      const mask = new Uint8Array(VW * baseY);
      const setPx = (px, py, val) => {
        if (px >= startX && px < endX && py >= 0 && py < baseY) mask[py * VW + px] = val;
      };
      // Fill crumbled wall base
      for (let x = startX; x < endX; x++) {
        for (let y = baseY - heights[x]; y < baseY; y++) setPx(x, y, 1);
      }
      // Fill jagged tapered broken spires (organic eroded edges, NOT flat rectangles!)
      for (const sp of spireSpecs) {
        for (let dy = 0; dy < sp.h; dy++) {
          const t = dy / sp.h; // 0 = top tip, 1 = base
          const hw = Math.max(1, Math.round((0.25 + t * 0.75) * (sp.w * 0.55) + (dy % 7 === 0 ? 1.5 : 0)));
          const ox = sp.cx + Math.round((1 - t) * sp.lean * 2.5 + Math.sin(dy * 0.45) * 0.8);
          for (let dx = -hw; dx <= hw; dx++) setPx(ox + dx, baseY - sp.h + dy, 2);
          // Occasional broken horizontal rubble tooth sticking out
          if (dy === Math.floor(sp.h * 0.35) || dy === Math.floor(sp.h * 0.62)) {
            const side = dy % 2 === 0 ? 1 : -1;
            for (let k = 0; k < 4; k++) {
              setPx(ox + side * (hw + k), baseY - sp.h + dy, 2);
              setPx(ox + side * (hw + k), baseY - sp.h + dy + 1, 2);
            }
          }
        }
      }

      // Render unified pixel outline + shaded stone fill + top catchlights!
      for (let y = 1; y < baseY; y++) {
        for (let x = startX; x < endX; x++) {
          const v = mask[y * VW + x];
          if (!v) continue;
          const topEmpty = y === 0 || !mask[(y - 1) * VW + x];
          const leftEmpty = x <= startX || !mask[y * VW + (x - 1)];
          const rightEmpty = x >= endX - 1 || !mask[y * VW + (x + 1)];
          if (topEmpty || leftEmpty || rightEmpty) {
            ctx.fillStyle = '#090712';
            ctx.fillRect(x, y, 1, 1);
          } else {
            // Check 1px inside top edge for warm eclipse highlight rim!
            const nearTop = y > 1 && !mask[(y - 2) * VW + x];
            const nearLeft = x > startX + 1 && !mask[y * VW + (x - 2)];
            if (nearTop) {
              ctx.fillStyle = pal.ruinHi;
            } else if (v === 2 && !nearLeft) {
              ctx.fillStyle = pal.ruinDark;
            } else {
              ctx.fillStyle = hash2(x, y, 61) > 0.78 ? pal.ruinDark : pal.ruinMid;
            }
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    // Crisp Stone Causeway Bridge (y = 416..448px, razor-sharp separation between sky & mirror lake!)
    drawStoneBridge(ctx) {
      const y = BRIDGE_Y;
      const h = LAKE_Y - BRIDGE_Y; // 32px tall
      // Crisp top ink line
      ctx.fillStyle = '#090712';
      ctx.fillRect(0, y - 4, BW, 4);
      // Glowing dual-biome top stone rim catchlight (cyan on left <-> rose-silver on right!)
      const rim = ctx.createLinearGradient(0, 0, BW, 0);
      rim.addColorStop(0, '#c2f7ff');
      rim.addColorStop(0.46, '#9ed8f2');
      rim.addColorStop(0.56, '#c4a8c4');
      rim.addColorStop(1, '#d8b4c8');
      ctx.fillStyle = rim;
      ctx.fillRect(0, y, BW, 4);

      // Stone masonry courses
      ctx.fillStyle = '#474f6e';
      ctx.fillRect(0, y + 4, BW, 12);
      ctx.fillStyle = '#2a3047';
      ctx.fillRect(0, y + 16, BW, 12);

      // Crisp brick mortar joints & highlight flecks (every 48px)
      for (let bx = 0; bx < BW; bx += 48) {
        ctx.fillStyle = '#141726';
        ctx.fillRect(bx, y + 4, 4, 12);
        ctx.fillRect(bx + 24, y + 16, 4, 12);
        ctx.fillStyle = bx < 600 ? 'rgba(130, 225, 255, 0.25)' : 'rgba(240, 175, 200, 0.22)';
        ctx.fillRect(bx + 4, y + 4, 24, 4);
      }
      // Crisp bottom ink line right above the Mirror Lake!
      ctx.fillStyle = '#090712';
      ctx.fillRect(0, y + h - 4, BW, 4);
    }

    // ─── Start Real Tactical Battle ───
    play({ squad, contract, carriedDrinks = [], onDone }) {
      const { BATTLE_DRINKS } = window.MT.DATA;
      this.contract = contract;
      this.onDone = onDone;
      this.biome = this.getBiomeKey(contract);

      this.time = 0;
      this.hitstop = 0;
      this.shakeTime = 0;
      this.finisherSlow = 0;
      this.screenFlash = null;
      this.round = 1;
      this.actionTimer = 0.5;
      this.activeAnim = null;
      this.activeActor = null;
      this.cutIn = null;
      this.finishDelay = 0;
      this.battleResult = null;
      this.drinksUsed = 0;
      this.draggingDrinkIdx = -1;
      this.dragPos = null;
      this.highlight = '';

      this.particles = [];
      this.popups = [];
      this.projectiles = [];
      this.activeVfx = [];
      this.lights = [];
      this.shockwaves = [];
      this.afterimages = [];
      this.ambientMotes = Array.from({ length: 22 }, (_, i) => ({
        x: Math.random() * BW,
        y: 60 + Math.random() * 340,
        vx: (Math.random() - 0.5) * 18,
        vy: -10 - Math.random() * 14,
        phase: i * 1.15,
        size: 4
      }));

      this.drinks = carriedDrinks
        .map((id) => BATTLE_DRINKS.find((d) => d.id === id))
        .filter(Boolean)
        .slice(0, 2)
        .map((d, idx) => ({
          ...d,
          slotIdx: idx,
          used: false,
          slowMoRemaining: 2.0
        }));

      // Allies stand proudly on left half of the Mirror-Lake Causeway (y = BRIDGE_Y = 416!)
      const roleRank = { tank: 1, warrior: 2, assassin: 3, ranged: 4, support: 5 };
      const sortedSquad = [...squad].sort((a, b) => (roleRank[a.role] || 3) - (roleRank[b.role] || 3));
      const allyXs = sortedSquad.length === 1 ? [390] : sortedSquad.length === 2 ? [470, 290] : [500, 355, 210];
      this.allies = sortedSquad.map((m, idx) => {
        const pwr = m.effectivePower || m.power || 35;
        const hpMult = m.role === 'tank' ? 6.5 : m.role === 'warrior' ? 5.1 : m.role === 'support' ? 4.6 : 4.2;
        const atkMult = m.role === 'assassin' ? 1.32 : m.role === 'ranged' ? 1.24 : m.role === 'warrior' ? 1.15 : m.role === 'tank' ? 0.85 : 0.78;
        const spd = m.role === 'assassin' ? 15 : m.role === 'ranged' ? 12 : m.role === 'warrior' ? 11 : m.role === 'support' ? 10 : 8;
        const maxHp = Math.round(pwr * hpMult);
        return {
          side: 'ally',
          id: m.id,
          merc: m,
          unitId: m.unitId,
          name: m.name,
          role: m.role,
          elements: m.activeElements || m.elements || ['fire'],
          ultName: m.ultName || '必杀一击',
          ultLine: m.lifeTag ? m.lifeTag.ultLine : '接招吧！',
          maxHp,
          hp: maxHp,
          ghostHp: maxHp,
          shield: m.role === 'tank' ? Math.round(maxHp * 0.28) : m.role === 'support' ? Math.round(maxHp * 0.14) : 0,
          atk: Math.round(pwr * atkMult),
          speed: spd,
          rage: m.drinkBuff ? 1 : 0,
          burn: 0,
          freeze: 0,
          alive: true,
          homeX: allyXs[idx],
          homeY: BRIDGE_Y,
          x: allyXs[idx],
          y: BRIDGE_Y,
          knockX: 0,
          squashX: 1,
          squashY: 1,
          anim: 'idle',
          flash: 0,
          phase: idx * 1.4
        };
      });

      // Enemies: 1–2 Minions + 1 Duelyst H5 Boss on right half of the Causeway!
      const primaryEl = (contract.elements && contract.elements[0]) || 'fire';
      const threat = contract.threat || 85;
      const minionCount = contract.tier >= 2 ? 2 : 1;
      const mTpl = MINION_TEMPLATES[primaryEl] || MINION_TEMPLATES.fire;
      this.enemies = [];

      for (let i = 0; i < minionCount; i++) {
        const mHp = Math.round(threat * (contract.tier >= 2 ? 1.55 : 1.7));
        const mx = minionCount === 2 ? (i === 0 ? 755 : 880) : 790;
        this.enemies.push({
          side: 'enemy',
          isBoss: false,
          id: `minion_${i}`,
          unitId: mTpl.unitId,
          name: i === 0 ? mTpl.name : `${mTpl.name}·侍从`,
          role: i === 0 ? 'warrior' : 'ranged',
          elements: [primaryEl],
          maxHp: mHp,
          hp: mHp,
          ghostHp: mHp,
          shield: i === 0 && contract.tier >= 2 ? Math.round(mHp * 0.22) : 0,
          atk: Math.round(threat * 0.34),
          speed: 10 - i,
          rage: 0,
          burn: 0,
          freeze: 0,
          alive: true,
          homeX: mx,
          homeY: BRIDGE_Y,
          x: mx,
          y: BRIDGE_Y,
          knockX: 0,
          squashX: 1,
          squashY: 1,
          anim: 'idle',
          flash: 0,
          phase: 2.1 + i * 1.3
        });
      }

      const bossMaxHp = Math.round(threat * 4.8);
      const bossUlt = BOSS_ULTS[primaryEl] || BOSS_ULTS.fire;
      this.boss = {
        side: 'enemy',
        isBoss: true,
        id: 'boss',
        unitId: contract.bossUnitId,
        name: contract.bossName,
        role: 'boss',
        elements: contract.elements || [primaryEl],
        ultName: bossUlt.name,
        ultVfx: bossUlt.vfx,
        ultColor: bossUlt.color,
        maxHp: bossMaxHp,
        hp: bossMaxHp,
        ghostHp: bossMaxHp,
        shield: contract.tier >= 2 ? Math.round(bossMaxHp * 0.14) : 0,
        atk: Math.round(threat * 0.58),
        speed: 9,
        rage: 0,
        burn: 0,
        freeze: 0,
        charging: false,
        turnsSinceCharge: 0,
        flameInterruptedOnce: false,
        alive: true,
        homeX: 1055,
        homeY: BRIDGE_Y,
        x: 1055,
        y: BRIDGE_Y,
        knockX: 0,
        squashX: 1,
        squashY: 1,
        anim: 'idle',
        flash: 0,
        phase: 0.5
      };
      this.bossGhostHp = bossMaxHp;
      this.enemies.push(this.boss);

      this.buildTurnQueue();
      this.renderBattleHud();
      this.renderDrinkDock();

      this.running = true;
      this.lastTs = 0;
      const loop = (ts) => {
        if (!this.running) return;
        if (!this.lastTs) this.lastTs = ts;
        const rawDt = Math.min(0.05, (ts - this.lastTs) / 1000);
        this.lastTs = ts;
        this.update(rawDt);
        this.render();
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }

    stop() {
      this.running = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    setSpeed(spd) {
      this.speed = spd === 2 ? 2 : 1;
      const b1 = document.getElementById('btn-bt-speed-1');
      const b2 = document.getElementById('btn-bt-speed-2');
      if (b1) b1.classList.toggle('active', this.speed === 1);
      if (b2) b2.classList.toggle('active', this.speed === 2);
    }

    // ─── Dynamic Light Pools, Shockwaves, Afterimages, Projectiles ───
    spawnLight(x, y, color, radius = 165, life = 0.54) {
      this.lights.push({ x, y, color, radius, life, maxLife: life });
    }

    spawnShockwave(x, y, color, maxR = 104, life = 0.38, lineW = 4) {
      this.shockwaves.push({ x, y, color, maxR, life, maxLife: life, lineW });
    }

    spawnScreenFlash(color, alpha = 0.24, life = 0.22) {
      this.screenFlash = { color, alpha, life, maxLife: life };
    }

    spawnAfterimage(u, tint) {
      this.afterimages.push({
        unitId: u.unitId,
        anim: u.anim,
        time: this.time + u.phase,
        x: u.x,
        y: u.y,
        scale: u.isBoss ? 2.25 : 1.55,
        flipX: u.side === 'enemy',
        tint,
        life: 0.22,
        maxLife: 0.22
      });
    }

    spawnProjectile(fromX, fromY, toX, toY, color, onArrive) {
      this.projectiles.push({
        x: fromX, y: fromY,
        startX: fromX, startY: fromY,
        toX, toY,
        color,
        elapsed: 0,
        dur: 0.22,
        onArrive
      });
    }

    // ─── Turn Queue & Combat Resolution ───
    buildTurnQueue() {
      const living = [...this.allies, ...this.enemies].filter((u) => u.alive);
      living.sort((a, b) => b.speed - a.speed);
      this.turnQueue = living;
    }

    stepNextTurn() {
      const alliesAlive = this.allies.filter((u) => u.alive);
      const enemiesAlive = this.enemies.filter((u) => u.alive);
      if (enemiesAlive.length === 0) {
        this.finishBattle(true);
        return;
      }
      if (alliesAlive.length === 0) {
        this.finishBattle(false);
        return;
      }

      if (this.turnQueue.length === 0) {
        this.round++;
        this.buildTurnQueue();
        this.renderBattleHud();
      }

      let actor = null;
      while (this.turnQueue.length > 0 && !actor) {
        const cand = this.turnQueue.shift();
        if (cand.alive) actor = cand;
      }
      if (!actor) return;
      this.activeActor = actor;

      if (actor.burn > 0) {
        const burnDmg = Math.max(8, Math.round(actor.maxHp * 0.06));
        actor.burn--;
        this.playVfx('fxImpactBigOrange', actor.x, actor.y - 52, { scale: 1.75 });
        this.spawnLight(actor.x, actor.y - 52, '#ff7a33', 140, 0.36);
        this.applyDamage(actor, burnDmg, '#ff6e3a', `灼烧 -${burnDmg}`);
        if (!actor.alive) {
          this.actionTimer = 0.45;
          return;
        }
      }

      if (actor.freeze > 0) {
        actor.freeze--;
        this.playVfx('fxFrozenIceBlock', actor.x, actor.y - 54, { scale: 1.7 });
        this.spawnLight(actor.x, actor.y - 54, '#5ce6ff', 160, 0.48);
        if (actor.isBoss && actor.charging) {
          actor.charging = false;
          this.spawnPopup(actor.x, actor.y - 135, '冰冻打断蓄力!', '#5ce6ff', true);
        } else {
          this.spawnPopup(actor.x, actor.y - 122, '冰冻跳过!', '#5ce6ff', false);
        }
        this.actionTimer = 0.55;
        return;
      }

      if (actor.side === 'ally') {
        this.executeAllyTurn(actor);
      } else {
        this.executeEnemyTurn(actor);
      }
    }

    executeAllyTurn(actor) {
      const { getElementMultiplier } = window.MT.DATA;
      const isUlt = actor.rage >= 3;
      if (isUlt) actor.rage = 0;

      if (actor.role === 'support') {
        const livingAllies = this.allies.filter((a) => a.alive);
        if (isUlt) {
          this.triggerCutIn(actor);
          this.spawnScreenFlash('#ffe484', 0.22, 0.28);
          for (const a of livingAllies) {
            const heal = Math.round(a.maxHp * 0.35);
            a.hp = Math.min(a.maxHp, a.hp + heal);
            a.shield += Math.round(a.maxHp * 0.22);
            this.spawnPopup(a.x, a.y - 115, `+${heal} & 护盾`, '#5ef29b', true);
            this.playVfx('fx_f1_holyimmolation', a.x, a.y - 52, { scale: 2.1 });
            this.playVfx('fxDistortionHexShield', a.x, a.y - 58, { scale: 0.82, alpha: 0.88, blend: 'lighter' });
            this.spawnLight(a.x, a.y - 50, '#ffe478', 185, 0.62);
            this.spawnShockwave(a.x, a.y - 34, '#8effb8', 84, 0.42, 3);
          }
          if (window.MT.audio) window.MT.audio.playSynergy();
          this.renderBattleHud();
          this.actionTimer = 1.15;
          return;
        }
        const lowest = [...livingAllies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
        if (lowest && lowest.hp < lowest.maxHp * 0.88) {
          const heal = Math.round(lowest.maxHp * 0.26);
          lowest.hp = Math.min(lowest.maxHp, lowest.hp + heal);
          lowest.shield += Math.round(lowest.maxHp * 0.14);
          actor.rage = Math.min(3, actor.rage + 1);
          this.spawnPopup(lowest.x, lowest.y - 110, `治疗 +${heal}`, '#5ef29b', false);
          this.playVfx('fx_f1_holyimmolation', lowest.x, lowest.y - 50, { scale: 1.7 });
          this.playVfx('fxImpactGreenBig', lowest.x, lowest.y - 50, { scale: 1.5, blend: 'lighter' });
          this.spawnLight(lowest.x, lowest.y - 50, '#62ff9e', 155, 0.48);
          this.renderBattleHud();
          this.actionTimer = 0.68;
          return;
        }
      }

      const livingEnemies = this.enemies.filter((e) => e.alive);
      if (!livingEnemies.length) return;
      const target = actor.role === 'assassin'
        ? livingEnemies[livingEnemies.length - 1]
        : livingEnemies[0];

      const el = actor.elements[0] || 'fire';
      const cRes = getElementMultiplier(actor.elements, target.elements);
      let dmg = Math.round(actor.atk * cRes.mult * (isUlt ? 1.85 : 1.0) * (0.94 + Math.random() * 0.12));

      if (isUlt) {
        this.triggerCutIn(actor);
        this.highlight = `${actor.name} 释放满怒大招【${actor.ultName}】重创敌阵！`;
      } else {
        actor.rage = Math.min(3, actor.rage + (cRes.tag.startsWith('super') ? 2 : 1));
      }

      this.launchAttackAnim(actor, target, {
        el, dmg, isUlt, cRes,
        armorBreak: actor.role === 'warrior' || isUlt,
        applyBurn: el === 'fire' && (isUlt || Math.random() < 0.45),
        applyFreeze: el === 'ice' && (isUlt || Math.random() < 0.28)
      });
      this.actionTimer = isUlt ? 1.25 : 0.78;
    }

    executeEnemyTurn(actor) {
      const livingAllies = this.allies.filter((a) => a.alive);
      if (!livingAllies.length) return;
      const frontAlly = livingAllies[0];

      if (actor.isBoss) {
        if (actor.charging) {
          actor.charging = false;
          actor.turnsSinceCharge = 0;
          this.shake(15, 0.38);
          this.hitstop = 0.085;
          this.spawnScreenFlash(actor.ultColor || '#ff475b', 0.28, 0.30);
          this.spawnPopup(actor.x, actor.y - 150, `${actor.ultName}!!`, '#ff475b', true);
          this.spawnLight(actor.x, actor.y - 72, actor.ultColor || '#ff475b', 250, 0.74);
          this.spawnShockwave(actor.x, actor.y - 54, actor.ultColor || '#ff475b', 175, 0.45, 5);
          for (const ally of livingAllies) {
            const ultDmg = Math.round(actor.atk * 1.38 * (ally.role === 'tank' ? 0.78 : 1.0));
            this.applyDamage(ally, ultDmg, '#ff475b', `-${ultDmg}`, true);
            this.playVfx(actor.ultVfx || 'fx_f4_shadownova', ally.x, ally.y - 58, { scale: 1.85, flipX: true });
            this.playVfx('fxExplosionBigWhiteHot', ally.x, ally.y - 52, { scale: 1.85, blend: 'lighter' });
            this.spawnLight(ally.x, ally.y - 52, actor.ultColor || '#ff475b', 170, 0.56);
          }
          if (window.MT.audio) window.MT.audio.playHit(true);
          this.actionTimer = 1.1;
          return;
        }

        actor.turnsSinceCharge++;
        if (actor.turnsSinceCharge >= 2) {
          actor.charging = true;
          this.spawnPopup(actor.x, actor.y - 148, `⚠ 蓄力: ${actor.ultName}`, '#ff5978', true);
          this.playVfx('fx_f4_voidpulse', actor.x, actor.y - 74, { scale: 2.0 });
          this.spawnLight(actor.x, actor.y - 74, '#ff475b', 220, 0.66);
          this.spawnShockwave(actor.x, actor.y - 56, '#ff475b', 120, 0.42, 4);
          this.actionTimer = 0.75;
          return;
        }
      }

      const el = actor.elements[0] || 'dark';
      const dmg = Math.round(actor.atk * (frontAlly.role === 'tank' ? 0.84 : 1.0) * (0.92 + Math.random() * 0.16));
      this.launchAttackAnim(actor, frontAlly, { el, dmg, isUlt: false, cRes: { tag: 'neutral', mult: 1 } });
      this.actionTimer = 0.78;
    }

    launchAttackAnim(actor, target, payload) {
      const isMelee = actor.role !== 'ranged' && actor.role !== 'support';
      const dashX = actor.side === 'ally' ? target.x - 94 : target.x + 94;
      const dur = window.MT.sprites ? window.MT.sprites.getAttackDurationSec(actor.unitId) : 0.48;
      const animSpeedMult = window.MT.sprites ? window.MT.sprites.getAttackSpeedMult(actor.unitId, dur) : 1;

      if (actor.role === 'assassin') {
        this.playVfx('fx_f2_teleportsmoke', actor.homeX, actor.homeY - 52, { scale: 1.75 });
        this.playVfx('fx_f2_teleportsmoke', dashX, target.y - 52, { scale: 1.85 });
        this.spawnLight(actor.homeX, actor.homeY - 52, '#c07aff', 120, 0.35);
        this.spawnLight(dashX, target.y - 52, '#c07aff', 145, 0.40);
      }

      this.activeAnim = {
        actor, target, payload, isMelee,
        elapsed: 0,
        dur,
        animSpeedMult,
        hitDone: false,
        afterTimer: 0,
        startX: actor.homeX,
        dashX
      };
      actor.anim = 'attack';
    }

    // Dispatch independent keyed Duelyst H5 effects + additive lighting + shockwaves!
    playAttackEventVfx(actor, target, payload) {
      const { el, isUlt, cRes } = payload;
      const tx = target.x;
      const ty = target.y - 60;
      const flip = actor.side === 'enemy';
      const isMelee = actor.role !== 'ranged' && actor.role !== 'support';
      const lightCol = EL_LIGHT_COLORS[el] || '#ffae42';

      if (isUlt) {
        if (actor.role === 'assassin') {
          this.playVfx('fx_slashfrenzy', tx, ty, { scale: 2.2, flipX: flip });
        } else if (actor.role === 'warrior' || actor.role === 'tank') {
          this.playVfx('fx_multislash_full', tx, ty - 6, { scale: 2.1, flipX: flip });
        } else if (el === 'fire') {
          this.playVfx('fx_flamesphere', tx, ty, { scale: 2.05 });
        } else if (el === 'ice') {
          this.playVfx('fxFrozenIceBlock', tx, ty, { scale: 2.25 });
        } else if (el === 'light') {
          this.playVfx('fx_f1_holyimmolation', tx, ty, { scale: 2.35 });
        } else if (el === 'dark') {
          this.playVfx('fx_f4_shadownova', tx, ty, { scale: 1.75 });
        } else if (el === 'bolt') {
          this.playVfx('fx_f2_twilightreiki', tx, ty, { scale: 1.7 });
        } else {
          this.playVfx('fxImpactGreenBig', tx, ty, { scale: 2.45 });
        }
        this.playVfx('fxExplosionBigWhiteHot', tx, ty - 4, { scale: 2.15, blend: 'lighter' });
        this.spawnLight(tx, ty, lightCol, 255, 0.72);
        this.spawnShockwave(tx, ty + 6, lightCol, 145, 0.42, 5);
        this.spawnShockwave(tx, ty + 6, '#ffffff', 98, 0.28, 3);
        this.spawnScreenFlash(lightCol, 0.24, 0.24);
        return;
      }

      if (isMelee) {
        const slashKey = el === 'fire' ? 'fx_fireslash' : 'fx_crossslash';
        this.playVfx(slashKey, tx, ty, { scale: slashKey === 'fx_crossslash' ? 1.55 : 1.95, flipX: flip });
      } else {
        const rangedKey = el === 'fire' ? 'fx_flamesphere'
          : el === 'ice' ? 'fxExplosionMediumIcyWhite'
          : el === 'light' ? 'fx_f1_holyimmolation'
          : el === 'dark' ? 'fx_f4_voidpulse'
          : el === 'bolt' ? 'fx_f2_twilightreiki'
          : 'fxImpactGreenBig';
        const rScale = rangedKey === 'fx_f2_twilightreiki' ? 1.32 : rangedKey === 'fx_flamesphere' ? 1.55 : 1.95;
        this.playVfx(rangedKey, tx, ty, { scale: rScale, flipX: flip });
      }

      const impactKey = el === 'grass' ? 'fxImpactGreenBig'
        : (el === 'ice' || el === 'bolt' || el === 'light') ? 'fxImpactBlueBig'
        : 'fxImpactBigOrange';
      this.playVfx(impactKey, tx, ty + 4, { scale: 1.85, flipX: flip, blend: 'lighter' });
      this.spawnLight(tx, ty, lightCol, cRes.tag.startsWith('super') ? 225 : 165, 0.50);

      if (cRes.tag.startsWith('super')) {
        this.playVfx('fxExplosionBigWhiteHot', tx, ty - 6, { scale: 1.95, blend: 'lighter' });
        this.spawnShockwave(tx, ty + 4, '#ffd966', 115, 0.36, 4);
        this.spawnScreenFlash('#ffd966', 0.16, 0.18);
      } else {
        this.spawnShockwave(tx, ty + 4, lightCol, 72, 0.26, 2.5);
      }
    }

    applyHitPayload(actor, target, payload) {
      const { dmg, isUlt, cRes, armorBreak, applyBurn, applyFreeze } = payload;
      let finalDmg = dmg;
      if (armorBreak && target.shield > 0) {
        finalDmg = Math.round(dmg * 1.45);
      }

      const tagStr = cRes.tag === 'super2' ? `克制 ×2.0! -${finalDmg}`
        : cRes.tag === 'super' ? `克制 ×1.5! -${finalDmg}`
        : cRes.tag === 'resist' ? `抵抗 -${finalDmg}`
        : `-${finalDmg}`;
      const popCol = cRes.tag.startsWith('super') ? '#ffd966' : cRes.tag === 'resist' ? '#a0a8c8' : '#ff6b7d';

      this.applyDamage(target, finalDmg, popCol, tagStr, cRes.tag.startsWith('super') || isUlt);
      if (applyBurn && target.alive) target.burn = 2;
      if (applyFreeze && target.alive) {
        target.freeze = 1;
        this.playVfx('fxFrozenIceBlock', target.x, target.y - 54, { scale: 1.8 });
        this.spawnLight(target.x, target.y - 54, '#5ce6ff', 160, 0.48);
        this.spawnPopup(target.x, target.y - 138, '冰冻!', '#5ce6ff', true);
      }

      this.playAttackEventVfx(actor, target, payload);
      if (cRes.tag.startsWith('super') || isUlt) {
        this.hitstop = isUlt ? 0.085 : 0.06;
        this.shake(isUlt ? 13 : 8, 0.26);
      } else {
        this.shake(3.5, 0.14);
      }
      if (window.MT.audio) window.MT.audio.playHit(cRes.tag.startsWith('super') || isUlt);
    }

    applyDamage(target, dmg, color, label, big = false) {
      let rem = dmg;
      if (target.shield > 0) {
        const absorbed = Math.min(target.shield, rem);
        target.shield -= absorbed;
        rem -= absorbed;
        if (absorbed > 0) {
          this.playVfx('fxDistortionHexShield', target.x, target.y - 58, { scale: 0.78, alpha: 0.85, blend: 'lighter' });
          this.spawnLight(target.x, target.y - 58, '#5ce6ff', 145, 0.36);
        }
      }
      target.hp = Math.max(0, target.hp - rem);
      target.flash = 0.2;
      const pushDir = target.side === 'enemy' ? 1 : -1;
      target.knockX = pushDir * (big ? 24 : 13);
      target.squashX = big ? 0.80 : 0.88;
      target.squashY = big ? 1.22 : 1.12;

      this.spawnPopup(target.x, target.y - 116, label, color, big);
      this.burstParticles(target.x, target.y - 54, color, big ? 24 : 12);

      if (target.hp <= 0 && target.alive) {
        target.alive = false;
        this.burstParticles(target.x, target.y - 50, '#ffd966', 32);
        this.spawnLight(target.x, target.y - 56, '#ffd966', 240, 0.68);
        this.spawnShockwave(target.x, target.y - 46, '#ffe07d', 155, 0.45, 5);
        if (target.isBoss) {
          this.finisherSlow = 0.42;
          this.shake(16, 0.44);
          this.spawnScreenFlash('#ffe48a', 0.34, 0.36);
          this.playVfx('fxExplosionBigWhiteHot', target.x, target.y - 72, { scale: 2.55, blend: 'lighter' });
          this.spawnPopup(target.x, target.y - 160, 'BOSS 击破!!', '#ffe07d', true);
        }
      }
      this.renderBattleHud();
    }

    // ─── Interactive Tactical Drink Throw ───
    throwDrink(drinkIdx, explicitTarget = null) {
      if (!this.running || this.battleResult) return;
      const d = this.drinks[drinkIdx];
      if (!d || d.used) return;

      let target = explicitTarget;
      if (d.target === 'enemy') {
        const livingEnemies = this.enemies.filter((e) => e.alive);
        if (!livingEnemies.length) return;
        if (!target || target.side !== 'enemy' || !target.alive) {
          target = (this.boss && this.boss.alive) ? this.boss : livingEnemies[0];
        }
      } else {
        const livingAllies = this.allies.filter((a) => a.alive);
        if (!livingAllies.length) return;
        if (!target || target.side !== 'ally' || !target.alive) {
          if (d.id === 'holy_ale') {
            target = [...livingAllies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
          } else {
            target = [...livingAllies].sort((a, b) => ((b.rage < 3 ? 1000 : 0) + b.atk) - ((a.rage < 3 ? 1000 : 0) + a.atk))[0];
          }
        }
      }

      d.used = true;
      this.drinksUsed++;
      this.draggingDrinkIdx = -1;
      this.dragPos = null;
      this.renderDrinkDock();

      this.hitstop = 0.08;
      this.shake(11, 0.28);
      if (window.MT.audio) window.MT.audio.playSplash();

      if (d.id === 'flame_shot') {
        const dmg = Math.round((this.boss ? this.boss.maxHp : 300) * 0.16) + 28;
        this.playVfx('fxExplosionBigBall_MetalSlug', target.x, target.y - 74, { scale: 2.2 });
        this.playVfx('fx_flamesphere', target.x, target.y - 68, { scale: 1.65, blend: 'lighter' });
        this.spawnLight(target.x, target.y - 60, '#ff7b29', 290, 0.80);
        this.spawnShockwave(target.x, target.y - 52, '#ffae42', 160, 0.42, 5);
        this.spawnShockwave(target.x, target.y - 52, '#fff2b8', 104, 0.28, 3);
        this.spawnScreenFlash('#ff7b29', 0.24, 0.24);
        this.applyDamage(target, dmg, '#ff7a3d', `烈焰破甲 -${dmg}`, true);
        if (target.isBoss && target.charging) {
          if (!target.flameInterruptedOnce) {
            target.charging = false;
            target.turnsSinceCharge = 0;
            target.flameInterruptedOnce = true;
            this.playVfx('fxExplosionBigWhiteHot', target.x, target.y - 76, { scale: 2.45, blend: 'lighter' });
            this.spawnScreenFlash('#ffe07d', 0.30, 0.30);
            this.spawnPopup(target.x, target.y - 162, '🔥 精准打断 Boss 大招!!', '#ffe07d', true);
            this.highlight = `老板泼出【烈焰烧酒】精准打断 ${target.name} 蓄力大招！`;
          } else {
            this.spawnPopup(target.x, target.y - 162, 'Boss 警觉 · 无法再打断!', '#ff9b5c', true);
          }
        }
      } else if (d.id === 'holy_ale') {
        const heal = Math.round(target.maxHp * 0.35);
        const sh = Math.round(target.maxHp * 0.24);
        target.hp = Math.min(target.maxHp, target.hp + heal);
        target.shield += sh;
        this.playVfx('fx_f1_holyimmolation', target.x, target.y - 52, { scale: 2.25 });
        this.playVfx('fxDistortionHexShield', target.x, target.y - 60, { scale: 0.9, alpha: 0.9, blend: 'lighter' });
        this.spawnLight(target.x, target.y - 54, '#5ef29b', 240, 0.72);
        this.spawnShockwave(target.x, target.y - 42, '#8effc2', 126, 0.42, 4);
        this.spawnScreenFlash('#5ef29b', 0.18, 0.22);
        this.spawnPopup(target.x, target.y - 134, `圣泉 +${heal} & 护盾!`, '#5ef29b', true);
        this.highlight = `老板及时泼出【圣泉麦酒】救下残血的 ${target.name}！`;
        this.renderBattleHud();
      } else if (d.id === 'fury_absinthe') {
        target.rage = 3;
        this.playVfx('fxBuffSimpleGold', target.x, target.y - 58, { scale: 2.4 });
        this.playVfx('fx_f4_voidpulse', target.x, target.y - 60, { scale: 1.65, blend: 'lighter' });
        this.spawnLight(target.x, target.y - 56, '#c07aff', 250, 0.74);
        this.spawnShockwave(target.x, target.y - 46, '#ffd966', 132, 0.40, 4);
        this.spawnScreenFlash('#c07aff', 0.20, 0.22);
        this.spawnPopup(target.x, target.y - 134, '⚡ 狂暴满怒 3/3!', '#d39bff', true);
        this.highlight = `老板泼出【狂暴苦艾】引爆 ${target.name} 满怒大招！`;
        this.renderBattleHud();
      }

      if (this.enemies.every((e) => !e.alive)) {
        this.finishBattle(true);
      }
    }

    finishBattle(victory) {
      if (this.battleResult) return;
      this.battleResult = {
        victory,
        highlight: this.highlight || (victory ? '全员按职配合，干净利落拿下悬赏！' : 'Boss 火力凶猛，小队护着财物撤回酒馆……'),
        drinksUsed: this.drinksUsed
      };
      this.finishDelay = 1.05;
    }

    triggerCutIn(actor) {
      this.cutIn = {
        name: actor.name,
        ultName: actor.ultName,
        line: actor.ultLine,
        unitId: actor.unitId,
        elColor: EL_LIGHT_COLORS[(actor.elements && actor.elements[0]) || 'light'] || '#ffd966',
        timer: 1.05,
        maxTimer: 1.05
      };
    }

    playVfx(key, x, y, opts = {}) {
      if (!window.MT.vfx) return;
      const inst = window.MT.vfx.createInstance(key, x, y, opts);
      if (inst) this.activeVfx.push(inst);
    }

    shake(amp, dur) {
      this.shakeAmp = Math.max(this.shakeAmp, amp);
      this.shakeTime = Math.max(this.shakeTime, dur);
    }

    spawnPopup(x, y, text, color, big = false) {
      this.popups.push({
        x: x + (Math.random() - 0.5) * 14,
        y,
        vx: (Math.random() - 0.5) * 28,
        vy: big ? -88 : -64,
        text,
        color,
        big,
        life: 1.25,
        maxLife: 1.25
      });
    }

    burstParticles(x, y, color, count = 14) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 70 + Math.random() * 210;
        this.particles.push({
          x, y,
          px: x, py: y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 90,
          size: 4 + (i % 3),
          color: i % 4 === 0 ? '#fff8de' : color,
          life: 0.42 + Math.random() * 0.36,
          maxLife: 0.78
        });
      }
    }

    // ─── Update Loop ───
    update(rawDt) {
      let timeScale = this.speed;
      if (this.draggingDrinkIdx >= 0) {
        const d = this.drinks[this.draggingDrinkIdx];
        if (d && !d.used && d.slowMoRemaining > 0) {
          d.slowMoRemaining = Math.max(0, d.slowMoRemaining - rawDt);
          timeScale = 0.25;
          this.updateSlowMoBar(this.draggingDrinkIdx, d.slowMoRemaining / 2.0);
        }
      }
      if (this.finisherSlow > 0) {
        this.finisherSlow = Math.max(0, this.finisherSlow - rawDt);
        timeScale = 0.28;
      }

      if (this.hitstop > 0) {
        this.hitstop = Math.max(0, this.hitstop - rawDt);
        return;
      }

      const dt = rawDt * timeScale;
      this.time += dt;

      if (this.shakeTime > 0) {
        this.shakeTime = Math.max(0, this.shakeTime - rawDt);
        if (this.shakeTime === 0) this.shakeAmp = 0;
      }
      if (this.screenFlash) {
        this.screenFlash.life -= rawDt;
        if (this.screenFlash.life <= 0) this.screenFlash = null;
      }
      if (this.cutIn) {
        this.cutIn.timer -= rawDt;
        if (this.cutIn.timer <= 0) this.cutIn = null;
      }

      if (this.boss && this.bossGhostHp > this.boss.hp) {
        this.bossGhostHp = Math.max(this.boss.hp, this.bossGhostHp - this.boss.maxHp * 0.55 * rawDt);
      }

      for (const u of [...this.allies, ...this.enemies]) {
        if (u.flash > 0) u.flash = Math.max(0, u.flash - rawDt);
        if (u.ghostHp > u.hp) u.ghostHp = Math.max(u.hp, u.ghostHp - u.maxHp * 0.65 * rawDt);
        u.knockX *= Math.pow(0.001, rawDt);
        if (Math.abs(u.knockX) < 0.2) u.knockX = 0;
        u.squashX += (1 - u.squashX) * Math.min(1, rawDt * 14);
        u.squashY += (1 - u.squashY) * Math.min(1, rawDt * 14);
      }

      if (this.activeAnim) {
        const aa = this.activeAnim;
        aa.elapsed += dt;
        const p = Math.min(1, aa.elapsed / aa.dur);
        if (aa.isMelee) {
          const prevX = aa.actor.x;
          if (p < 0.22) {
            const k = p / 0.22;
            aa.actor.x = aa.startX + (aa.dashX - aa.startX) * k;
          } else if (p < 0.76) {
            aa.actor.x = aa.dashX;
          } else {
            const k = (p - 0.76) / 0.24;
            aa.actor.x = aa.dashX + (aa.startX - aa.dashX) * k;
          }
          if (Math.abs(aa.actor.x - prevX) > 4) {
            aa.afterTimer += dt;
            if (aa.afterTimer >= 0.035) {
              aa.afterTimer = 0;
              this.spawnAfterimage(aa.actor, EL_LIGHT_COLORS[aa.payload.el] || '#ffd966');
            }
          }
        }
        if (!aa.hitDone && p >= (aa.isMelee ? 0.46 : 0.34)) {
          aa.hitDone = true;
          if (aa.isMelee) {
            this.applyHitPayload(aa.actor, aa.target, aa.payload);
          } else {
            const pCol = EL_LIGHT_COLORS[aa.payload.el] || '#ffae42';
            const fromX = aa.actor.x + (aa.actor.side === 'ally' ? 36 : -36);
            const fromY = aa.actor.y - 60;
            const toX = aa.target.x;
            const toY = aa.target.y - 60;
            this.spawnLight(fromX, fromY, pCol, 120, 0.24);
            this.spawnProjectile(fromX, fromY, toX, toY, pCol, () => {
              this.applyHitPayload(aa.actor, aa.target, aa.payload);
            });
          }
        }
        if (p >= 1) {
          aa.actor.x = aa.startX;
          aa.actor.anim = 'idle';
          this.activeAnim = null;
        }
      }

      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        pr.elapsed += dt;
        const k = Math.min(1, pr.elapsed / pr.dur);
        const arcY = -Math.sin(k * Math.PI) * 42;
        pr.x = pr.startX + (pr.toX - pr.startX) * k;
        pr.y = pr.startY + (pr.toY - pr.startY) * k + arcY;
        this.particles.push({
          x: pr.x, y: pr.y, px: pr.x, py: pr.y,
          vx: (Math.random() - 0.5) * 45, vy: (Math.random() - 0.5) * 45,
          size: 4, color: pr.color, life: 0.22, maxLife: 0.22
        });
        if (k >= 1) {
          const cb = pr.onArrive;
          this.projectiles.splice(i, 1);
          if (cb) cb();
        }
      }

      if (this.battleResult) {
        this.finishDelay -= rawDt;
        if (this.finishDelay <= 0) {
          const res = this.battleResult;
          const cb = this.onDone;
          this.stop();
          if (cb) cb(res);
        }
      } else if (!this.activeAnim && !this.cutIn && this.projectiles.length === 0) {
        this.actionTimer -= dt;
        if (this.actionTimer <= 0) {
          this.stepNextTurn();
        }
      }

      for (const m of this.ambientMotes) {
        m.x += (m.vx + Math.sin(this.time * 1.6 + m.phase) * 14) * dt;
        m.y += m.vy * dt;
        if (m.y < 30) { m.y = BRIDGE_Y - 12; m.x = Math.random() * BW; }
        if (m.x < 0) m.x = BW;
        if (m.x > BW) m.x = 0;
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.px = p.x; p.py = p.y;
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 380 * dt; p.life -= dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const pp = this.popups[i];
        pp.x += pp.vx * dt;
        pp.y += pp.vy * dt;
        pp.vy *= Math.pow(0.08, dt);
        pp.life -= dt;
        if (pp.life <= 0) this.popups.splice(i, 1);
      }
      for (let i = this.lights.length - 1; i >= 0; i--) {
        this.lights[i].life -= dt;
        if (this.lights[i].life <= 0) this.lights.splice(i, 1);
      }
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        this.shockwaves[i].life -= dt;
        if (this.shockwaves[i].life <= 0) this.shockwaves.splice(i, 1);
      }
      for (let i = this.afterimages.length - 1; i >= 0; i--) {
        this.afterimages[i].life -= dt;
        if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
      }
      if (window.MT.vfx) {
        for (let i = this.activeVfx.length - 1; i >= 0; i--) {
          window.MT.vfx.update(this.activeVfx[i], dt);
          if (this.activeVfx[i].done) this.activeVfx.splice(i, 1);
        }
      }
    }

    // ─── Render Upper Live World onto sceneBuf (reflected LIVE in Mirror Lake!) ───
    renderUpperWorld(ctx) {
      const { sprites } = window.MT;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, BW, this.sceneBuf.height);

      // 1. Baked Split-Biome Upper World (Pine Forest <-> Giant Solar Eclipse & Shattered Ruins)
      const bg = this.getUpperBgCanvas(this.biome);
      ctx.drawImage(bg, 0, 0, VW, BRIDGE_VY, 0, 0, BW, BRIDGE_Y);

      // 2. Animated Live Props hovering in sky (bobbing Cyan Crystals, Obsidian Shards & Eclipse Prism!)
      const bob1 = Math.round(Math.sin(this.time * 2.4) * 3);
      const bob2 = Math.round(Math.sin(this.time * 2.1 + 1.8) * 3);
      const bob3 = Math.round(Math.sin(this.time * 1.7 + 0.7) * 4);
      ctx.save();
      ctx.scale(4, 4);
      drawMatrix(ctx, PROPS.floatCrystal, 55, 58 + bob1);
      drawMatrix(ctx, PROPS.floatCrystal, 66, 70 - bob2);
      drawMatrix(ctx, PROPS.floatShard, 174, 30 + bob2);
      drawMatrix(ctx, PROPS.floatShard, 195, 24 - bob1);
      drawMatrix(ctx, PROPS.floatShard, 288, 34 + bob3);
      drawMatrix(ctx, PROPS.arcanePrism, 266, 58 + bob3);
      ctx.restore();

      // 3. Ambient Glowing Cyan Streetlamp Halo + Eclipse Pulse + Floating Motes
      const flicker = 0.88 + Math.sin(this.time * 7.2) * 0.12;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Cyan streetlamp halo at vx=44, vy=72 -> px=176, py=288
      const lg = ctx.createRadialGradient(176, 288, 6, 176, 288, 130);
      lg.addColorStop(0, `rgba(110, 240, 255, ${0.42 * flicker})`);
      lg.addColorStop(0.5, `rgba(60, 190, 255, ${0.14 * flicker})`);
      lg.addColorStop(1, 'rgba(40, 140, 255, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(40, 150, 270, 260);

      // Solar Eclipse breathing glow halo at vx=232, vy=38 -> px=928, py=152
      const eg = ctx.createRadialGradient(928, 152, 58, 928, 152, 260);
      eg.addColorStop(0, `rgba(255, 118, 162, ${0.34 * flicker})`);
      eg.addColorStop(0.55, `rgba(195, 55, 110, ${0.14 * flicker})`);
      eg.addColorStop(1, 'rgba(140, 30, 80, 0)');
      ctx.fillStyle = eg;
      ctx.fillRect(660, 0, 540, 410);

      // Arcane Prism violet energy halo (vx=273, vy=64+bob3 -> px=1092)
      const pg0 = ctx.createRadialGradient(1092, (64 + bob3) * 4, 4, 1092, (64 + bob3) * 4, 72);
      pg0.addColorStop(0, `rgba(186, 108, 255, ${0.42 * flicker})`);
      pg0.addColorStop(1, 'rgba(130, 50, 220, 0)');
      ctx.fillStyle = pg0;
      ctx.fillRect(1015, (64 + bob3) * 4 - 74, 155, 150);

      // Floating Cyan Crystal soft frost shimmer
      const cg0 = ctx.createRadialGradient(238, (65 + bob1) * 4, 4, 238, (65 + bob1) * 4, 58);
      cg0.addColorStop(0, `rgba(120, 240, 255, ${0.32 * flicker})`);
      cg0.addColorStop(1, 'rgba(60, 180, 255, 0)');
      ctx.fillStyle = cg0;
      ctx.fillRect(178, (65 + bob1) * 4 - 60, 120, 120);

      // Floating cyan-left / rose-right ambient motes
      for (const m of this.ambientMotes) {
        const pulse = 0.28 + 0.55 * (0.5 + 0.5 * Math.sin(this.time * 3.2 + m.phase));
        ctx.globalAlpha = pulse;
        ctx.fillStyle = m.x < 640 ? '#8ef5ff' : '#ffa6c0';
        ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
      }
      ctx.restore();

      // 4. Speed Ghost Afterimages
      for (const ag of this.afterimages) {
        const a = Math.max(0, (ag.life / ag.maxLife) * 0.48);
        sprites.drawUnit(ctx, ag.unitId, ag.anim, ag.time, ag.x, ag.y, {
          scale: ag.scale,
          flipX: ag.flipX,
          alpha: a,
          outlineColor: ag.tint
        });
      }

      // 5. All Living Duelyst Units Standing on the Stone Bridge (y = 416!)
      const livingUnits = [...this.allies, ...this.enemies].filter((u) => u.alive);
      for (const u of livingUnits) {
        const ux = Math.round(u.x + u.knockX);
        const uy = Math.round(u.y);

        // Boss crimson aura when charging!
        if (u.isBoss && u.charging) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const bgGlow = ctx.createRadialGradient(ux, uy - 68, 10, ux, uy - 68, 145);
          bgGlow.addColorStop(0, `rgba(255, 52, 86, ${0.46 + Math.sin(this.time * 12) * 0.14})`);
          bgGlow.addColorStop(1, 'rgba(255, 40, 60, 0)');
          ctx.fillStyle = bgGlow;
          ctx.fillRect(ux - 150, uy - 210, 300, 230);
          ctx.restore();
        }

        const scale = u.isBoss ? 2.25 : 1.55;
        const isActiveAttacker = this.activeAnim && this.activeAnim.actor === u && u.anim === 'attack';
        sprites.drawUnit(ctx, u.unitId, u.anim, this.time + u.phase, ux, uy, {
          scale,
          flipX: u.side === 'enemy',
          loop: !isActiveAttacker,
          elapsedOverride: isActiveAttacker ? this.activeAnim.elapsed : null,
          speedMult: isActiveAttacker ? this.activeAnim.animSpeedMult : 1,
          squashX: u.squashX,
          squashY: u.squashY,
          outlineColor: u.flash > 0 ? '#ffffff' : u.freeze > 0 ? '#5ce6ff' : u.isBoss && u.charging ? '#ff475b' : null
        });
      }

      // 6. Ranged Glowing Projectiles
      for (const pr of this.projectiles) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pg = ctx.createRadialGradient(pr.x, pr.y, 2, pr.x, pr.y, 38);
        pg.addColorStop(0, '#ffffff');
        pg.addColorStop(0.35, pr.color);
        pg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pg;
        ctx.fillRect(pr.x - 40, pr.y - 40, 80, 80);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(pr.x) - 4, Math.round(pr.y) - 4, 8, 8);
        ctx.restore();
      }

      // 7. Duelyst H5 Independent Keyed VFX Clips (ALL reflected live in Mirror Lake!)
      if (window.MT.vfx) {
        for (const inst of this.activeVfx) window.MT.vfx.draw(ctx, inst);
      }

      // 8. Real-Time Additive Light Blooms & Expanding Shockwave Rings
      if (this.lights.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const l of this.lights) {
          const a = Math.max(0, l.life / l.maxLife);
          const lg2 = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, l.radius);
          lg2.addColorStop(0, l.color);
          lg2.addColorStop(0.45, l.color);
          lg2.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = a * 0.48;
          ctx.fillStyle = lg2;
          ctx.beginPath();
          ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      for (const sw of this.shockwaves) {
        const p = 1 - Math.max(0, sw.life / sw.maxLife);
        const r = 14 + sw.maxR * (1 - Math.pow(1 - p, 3));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.max(0, (1 - p) * 0.88);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = Math.max(1.5, sw.lineW * (1 - p * 0.55));
        ctx.beginPath();
        ctx.arc(Math.round(sw.x), Math.round(sw.y), r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 9. Glowing Spark Streak Particles
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.particles) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(2, p.size * 0.8);
        ctx.beginPath();
        ctx.moveTo(Math.round(p.px), Math.round(p.py));
        ctx.lineTo(Math.round(p.x), Math.round(p.y));
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
      }
      ctx.restore();

      ctx.restore();
    }

    // ─── Master Composite Render: Upper World + Real-Time Shimmering Mirror Lake + Bridge + Pixel UI Overlays ───
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

      // 1. Render entire live upper world (sky + eclipse + forest + units + Duelyst VFX + lights) into sceneBuf
      this.renderUpperWorld(this.sceneCtx);

      // 2. Blit upper world directly to top half of main canvas
      ctx.drawImage(this.sceneBuf, 0, 0, BW, BRIDGE_Y, 0, 0, BW, BRIDGE_Y);

      // 3. REAL-TIME SHIMMERING MIRROR LAKE REFLECTION (y = 448..720px)!
      const lakeH = BH - LAKE_Y; // 272px
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, LAKE_Y, BW, lakeH);
      ctx.clip();

      // Flip sceneBuf vertically in 4px pixel-crisp horizontal ripple strips!
      const stripH = 4;
      for (let sy = 0; sy < lakeH; sy += stripH) {
        const srcY = BRIDGE_Y - sy - stripH;
        if (srcY < 0) break;
        const ripple = Math.round(Math.sin(sy * 0.085 + this.time * 3.8) * (1.5 + (sy / lakeH) * 2.5));
        ctx.save();
        ctx.translate(ripple, LAKE_Y + sy + stripH);
        ctx.scale(1, -1);
        ctx.drawImage(this.sceneBuf, 0, srcY, BW, stripH, 0, 0, BW, stripH);
        ctx.restore();
      }

      // Dual-biome translucent water tint glaze (cool azure left <-> deep plum-rose right!)
      const waterTint = ctx.createLinearGradient(0, LAKE_Y, BW, LAKE_Y);
      waterTint.addColorStop(0, 'rgba(26, 98, 175, 0.28)');
      waterTint.addColorStop(0.48, 'rgba(34, 86, 158, 0.24)');
      waterTint.addColorStop(0.56, 'rgba(72, 34, 96, 0.26)');
      waterTint.addColorStop(1, 'rgba(92, 36, 94, 0.30)');
      ctx.fillStyle = waterTint;
      ctx.fillRect(0, LAKE_Y, BW, lakeH);

      // Depth fade toward bottom edge
      const waterDepth = ctx.createLinearGradient(0, LAKE_Y, 0, BH);
      waterDepth.addColorStop(0, 'rgba(10, 16, 38, 0.14)');
      waterDepth.addColorStop(0.7, 'rgba(10, 12, 32, 0.24)');
      waterDepth.addColorStop(1, 'rgba(6, 7, 20, 0.52)');
      ctx.fillStyle = waterDepth;
      ctx.fillRect(0, LAKE_Y, BW, lakeH);

      // Subtle crisp horizontal pixel water shimmer lines + dynamic glowing caustic reflections under live explosions!
      ctx.fillStyle = 'rgba(210, 245, 255, 0.22)';
      for (let i = 0; i < 16; i++) {
        const wy = LAKE_Y + 8 + i * 16;
        const wx = ((i * 193 + Math.floor(this.time * 18 * (i % 2 === 0 ? 1 : -1))) % BW + BW) % BW;
        const ww = 28 + (i % 4) * 18;
        ctx.fillRect(wx, wy, ww, 2);
      }
      if (this.lights.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const l of this.lights) {
          const a = Math.max(0, l.life / l.maxLife);
          for (let r = 0; r < 6; r++) {
            const wy = LAKE_Y + 12 + r * 18;
            const rw = Math.round(l.radius * (0.85 - r * 0.1) * (0.85 + Math.sin(this.time * 9 + r) * 0.15));
            const rx = Math.round(l.x - rw / 2 + Math.sin(this.time * 6 + r * 1.4) * 8);
            ctx.globalAlpha = a * (0.48 - r * 0.06);
            ctx.fillStyle = l.color;
            ctx.fillRect(rx, wy, rw, 4);
          }
        }
        ctx.restore();
      }
      ctx.restore();

      // 4. Razor-sharp Stone Causeway Bridge separating sky and mirror lake
      this.drawStoneBridge(ctx);

      // 5. Slow-Mo Bullet-Time Dimming & Target Reticles when dragging a drink bottle
      if (this.draggingDrinkIdx >= 0) {
        const d = this.drinks[this.draggingDrinkIdx];
        ctx.fillStyle = 'rgba(8, 6, 22, 0.38)';
        ctx.fillRect(0, 0, BW, BH);
        const validUnits = d.target === 'enemy'
          ? this.enemies.filter((e) => e.alive)
          : this.allies.filter((a) => a.alive);
        for (const u of validUnits) {
          ctx.save();
          ctx.strokeStyle = d.color;
          ctx.lineWidth = 4;
          ctx.setLineDash([10, 6]);
          ctx.strokeRect(Math.round(u.x - 44), Math.round(u.y - 122), 88, 128);
          ctx.restore();
        }
      }

      // 6. Chunky Pixel Unit HP / Rage Bars & Boss Charge Telegraph (drawn crisp above bridge — NOT reflected!)
      const livingUnits = [...this.allies, ...this.enemies].filter((u) => u.alive);
      for (const u of livingUnits) {
        const ux = Math.round(u.x + u.knockX);
        if (!u.isBoss) {
          this.drawUnitBars(ctx, u, ux);
        } else {
          this.drawBossTelegraph(ctx, u, ux);
        }
      }

      // 7. Juicy Scale-Pop Floating Damage & Status Numbers
      for (const pp of this.popups) {
        const age = pp.maxLife - pp.life;
        const popScale = age < 0.11 ? (0.7 + (age / 0.11) * 0.72) : age < 0.22 ? (1.42 - ((age - 0.11) / 0.11) * 0.42) : 1.0;
        ctx.save();
        ctx.globalAlpha = Math.min(1, pp.life * 1.8);
        ctx.translate(Math.round(pp.x), Math.round(pp.y));
        ctx.scale(popScale, popScale);
        ctx.font = pp.big ? '900 24px "Noto Sans SC", monospace' : '900 17px "Noto Sans SC", monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = pp.big ? 6 : 4;
        ctx.strokeStyle = '#07040f';
        ctx.lineJoin = 'round';
        ctx.strokeText(pp.text, 0, 0);
        if (pp.big) {
          ctx.shadowColor = pp.color;
          ctx.shadowBlur = 12;
        }
        ctx.fillStyle = pp.color;
        ctx.fillText(pp.text, 0, 0);
        ctx.restore();
      }

      // 8. Screen Chromatic / Vignette Impact Flash
      if (this.screenFlash) {
        const a = (this.screenFlash.life / this.screenFlash.maxLife) * this.screenFlash.alpha;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        const sg = ctx.createRadialGradient(BW / 2, BH / 2, 140, BW / 2, BH / 2, BW * 0.65);
        sg.addColorStop(0, 'rgba(255,255,255,0.22)');
        sg.addColorStop(1, this.screenFlash.color);
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, BW, BH);
        ctx.restore();
      }

      // 9. Full-Rage Ultimate Cut-In Banner
      if (this.cutIn) {
        this.drawCutInBanner(ctx, this.cutIn);
      }

      // 10. Aim Arc while dragging tactical bottle
      if (this.draggingDrinkIdx >= 0 && this.dragPos) {
        const d = this.drinks[this.draggingDrinkIdx];
        ctx.save();
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(BW / 2, BH - 92);
        ctx.quadraticCurveTo((BW / 2 + this.dragPos.x) / 2, Math.min(BH - 220, this.dragPos.y - 80), this.dragPos.x, this.dragPos.y);
        ctx.stroke();
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(this.dragPos.x, this.dragPos.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#090712';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    }

    // Chunky Black-Outlined Steel-Bevel Pixel Unit Bars directly on Bridge Edge!
    drawUnitBars(ctx, u, ux) {
      const bw = 92;
      const bx = Math.round(ux - bw / 2);
      const by = Math.round(u.y + 8);

      // Thick #090712 ink frame
      ctx.fillStyle = '#090712';
      ctx.fillRect(bx - 3, by - 3, bw + 6, 15);
      ctx.fillStyle = '#1b1f33';
      ctx.fillRect(bx, by, bw, 9);

      // White-hot Ghost HP trail
      const ghostPct = Math.max(0, Math.min(1, (u.ghostHp || u.hp) / u.maxHp));
      ctx.fillStyle = '#fff0cc';
      ctx.fillRect(bx, by, Math.round(bw * ghostPct), 9);

      const hpPct = Math.max(0, Math.min(1, u.hp / u.maxHp));
      const colTop = u.side === 'ally' ? (hpPct > 0.35 ? '#7affad' : '#ff859d') : '#ff788a';
      const colBot = u.side === 'ally' ? (hpPct > 0.35 ? '#24ba5a' : '#c41d3c') : '#bd1e38';
      const fillW = Math.round(bw * hpPct);
      ctx.fillStyle = colTop;
      ctx.fillRect(bx, by, fillW, 4);
      ctx.fillStyle = colBot;
      ctx.fillRect(bx, by + 4, fillW, 5);

      if (u.shield > 0) {
        const shW = Math.min(bw, Math.round(bw * (u.shield / u.maxHp)));
        ctx.fillStyle = '#8ef5ff';
        ctx.fillRect(bx, by, shW, 3);
      }

      const segW = Math.floor(bw / 5);
      ctx.fillStyle = '#090712';
      for (let i = 1; i < 5; i++) ctx.fillRect(bx + i * segW, by, 2, 9);

      // 3-Segment Chunky Pixel Rage Gems (allies only)
      if (u.side === 'ally') {
        const ry = by + 13;
        const rSeg = Math.floor((bw - 6) / 3);
        for (let r = 0; r < 3; r++) {
          const rx = bx + r * (rSeg + 3);
          const lit = r < u.rage;
          ctx.fillStyle = '#090712';
          ctx.fillRect(rx - 2, ry - 2, rSeg + 4, 10);
          ctx.fillStyle = lit ? '#ffaa22' : '#23283d';
          ctx.fillRect(rx, ry, rSeg, 6);
          if (lit) {
            ctx.fillStyle = '#fff2a6';
            ctx.fillRect(rx, ry, rSeg, 2);
          }
        }
      }

      // Status tags
      let sx = bx;
      const sy = by - 8;
      ctx.font = '900 12px "Noto Sans SC", monospace';
      ctx.textAlign = 'left';
      if (u.burn > 0) {
        ctx.fillStyle = '#090712';
        ctx.fillText(`灼${u.burn}`, sx + 1, sy + 1);
        ctx.fillStyle = '#ff7b3d';
        ctx.fillText(`灼${u.burn}`, sx, sy);
        sx += 28;
      }
      if (u.freeze > 0) {
        ctx.fillStyle = '#090712';
        ctx.fillText('冻', sx + 1, sy + 1);
        ctx.fillStyle = '#6cf0ff';
        ctx.fillText('冻', sx, sy);
      }
    }

    drawBossTelegraph(ctx, boss, bx) {
      if (!boss.charging) return;
      const w = 204, h = 58;
      const x = Math.round(bx - w / 2);
      const y = Math.round(boss.y - 246);
      const pulse = 0.82 + Math.sin(this.time * 10) * 0.18;

      ctx.save();
      ctx.fillStyle = '#090712';
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      ctx.fillStyle = '#240c1a';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = `rgba(255, 76, 108, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

      ctx.fillStyle = '#fff0f4';
      ctx.font = '900 15px "Noto Sans SC", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`⚠ 蓄力: ${boss.ultName}`, bx, y + 24);

      const segW = 48;
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#090712';
        ctx.fillRect(x + 20 + i * (segW + 6) - 2, y + 32, segW + 4, 14);
        ctx.fillStyle = i < 2 ? '#ff4764' : '#3d1a2c';
        ctx.fillRect(x + 20 + i * (segW + 6), y + 34, segW, 10);
      }
      if (boss.flameInterruptedOnce) {
        ctx.fillStyle = '#ffd966';
        ctx.font = '900 11px "Noto Sans SC", monospace';
        ctx.fillText('警觉·烈焰免疫', bx, y - 8);
      }
      ctx.restore();
    }

    drawCutInBanner(ctx, c) {
      const p = Math.min(1, (c.maxTimer - c.timer) / 0.16);
      const by = 220;
      const bh = 112;
      ctx.save();
      ctx.fillStyle = 'rgba(6, 4, 14, 0.58)';
      ctx.fillRect(0, 0, BW, BH);

      ctx.fillStyle = '#090712';
      ctx.fillRect(0, by - 4, BW * p, bh + 8);
      const bg = ctx.createLinearGradient(0, by, BW, by + bh);
      bg.addColorStop(0, '#1c1236');
      bg.addColorStop(0.55, '#33174c');
      bg.addColorStop(1, '#140b24');
      ctx.fillStyle = bg;
      ctx.fillRect(0, by, BW * p, bh);
      ctx.fillStyle = c.elColor || '#ffd966';
      ctx.fillRect(0, by, BW * p, 4);
      ctx.fillRect(0, by + bh - 4, BW * p, 4);

      if (p > 0.55) {
        window.MT.sprites.drawUnit(ctx, c.unitId, 'attack', this.time, 260, by + 98, { scale: 1.95 });
        ctx.textAlign = 'left';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#090712';
        ctx.font = '900 32px "Noto Sans SC", monospace';
        ctx.strokeText(`【${c.ultName}】`, 360, by + 50);
        ctx.fillStyle = '#ffe588';
        ctx.fillText(`【${c.ultName}】`, 360, by + 50);
        ctx.font = '900 17px "Noto Sans SC", monospace';
        ctx.strokeText(`${c.name}：“${c.line}”`, 364, by + 86);
        ctx.fillStyle = '#fff5dc';
        ctx.fillText(`${c.name}：“${c.line}”`, 364, by + 86);
      }
      ctx.restore();
    }

    // ─── DOM Pixel HUD & Steel-Beveled Drink Tray Binding ───
    renderBattleHud() {
      const titleEl = document.getElementById('bt-title');
      if (titleEl && this.contract) {
        titleEl.textContent = `${this.contract.name.replace(/^【迷雾】/, '')} · R${this.round}`;
      }
      const bossNameEl = document.getElementById('bt-boss-name');
      if (bossNameEl && this.boss) {
        bossNameEl.textContent = this.boss.name;
      }
      const elBox = document.getElementById('bt-boss-el');
      if (elBox && this.boss && window.MT.uiIcons) {
        elBox.innerHTML = this.boss.elements.slice(0, 1).map((e) => window.MT.uiIcons.elBadge(e, { size: 28 })).join('');
      }
      const bar = document.getElementById('bt-boss-hp-bar');
      const hpTxt = document.getElementById('bt-boss-hp-text');
      if (bar && this.boss) {
        const pct = Math.max(0, Math.min(1, this.boss.hp / this.boss.maxHp));
        const lit = Math.ceil(pct * 10);
        let h = '';
        for (let i = 0; i < 10; i++) {
          h += `<i class="bt-boss-seg ${i < lit ? 'on' : ''}"></i>`;
        }
        bar.innerHTML = h;
        if (hpTxt) hpTxt.textContent = `${this.boss.hp}/${this.boss.maxHp}`;
      }

      // Compact vertical pixel squad status badges on top-left (like reference left column!)
      const miniList = document.getElementById('bt-squad-mini-list');
      if (miniList) {
        miniList.innerHTML = this.allies.map((a) => {
          const elIco = window.MT.uiIcons ? window.MT.uiIcons.elBadge(a.elements[0] || 'light', { size: 16 }) : '';
          const rageDots = '◆'.repeat(a.rage) + '◇'.repeat(Math.max(0, 3 - a.rage));
          return `<div class="bt-mini-unit ${a.alive ? '' : 'dead'}">${elIco}<span>${a.name}</span><span class="bt-mini-hp">${a.hp}</span><span class="bt-mini-rage">${rageDots}</span></div>`;
        }).join('');
      }
    }

    renderDrinkDock() {
      const dock = document.getElementById('bt-drink-dock');
      if (!dock) return;
      if (this.drinks.length === 0) {
        dock.innerHTML = `<div class="bt-drink-empty">本次未携带随队战中酒 · 专心观战</div>`;
        return;
      }
      dock.innerHTML = this.drinks.map((d, idx) => {
        const iconUrl = d.duelystIcon && window.MT.vfx ? window.MT.vfx.getIconUrl(d.duelystIcon) : null;
        const iconHtml = iconUrl
          ? `<div class="bt-vial-bezel"><img class="duelyst-drink-ico md" src="${iconUrl}" alt="${d.name}" /></div>`
          : `<div class="bt-vial-bezel"><i class="pxi pxi-${d.icon} pxi-md"></i></div>`;
        return `
        <button class="bt-drink-btn ${d.used ? 'used' : ''}" data-didx="${idx}" style="--dcol:${d.color}">
          ${iconHtml}
          <div class="bt-drink-meta">
            <div class="bt-drink-head">
              <strong>${d.name}</strong>
              <span class="bt-drink-tag">${d.short}</span>
            </div>
            <div class="bt-slowmo-track"><i class="bt-slowmo-fill" id="bt-slowmo-${idx}" style="width:${Math.round((d.slowMoRemaining / 2.0) * 100)}%"></i></div>
          </div>
          ${d.used ? '<span class="bt-used-tag">已泼出</span>' : '<span class="bt-ready-gem" aria-hidden="true">◆</span>'}
        </button>
      `;
      }).join('');

      dock.querySelectorAll('.bt-drink-btn').forEach((btn) => {
        const idx = Number(btn.dataset.didx);
        btn.onpointerdown = (e) => {
          if (this.drinks[idx]?.used || this.battleResult) return;
          e.preventDefault();
          this.draggingDrinkIdx = idx;
          this._downPt = { x: e.clientX, y: e.clientY, moved: false };
        };
      });
    }

    updateSlowMoBar(idx, ratio) {
      const el = document.getElementById(`bt-slowmo-${idx}`);
      if (el) el.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
    }

    bindBattlePointer() {
      window.addEventListener('pointermove', (e) => {
        if (this.draggingDrinkIdx < 0 || !this._downPt) return;
        if (Math.hypot(e.clientX - this._downPt.x, e.clientY - this._downPt.y) > 14) {
          this._downPt.moved = true;
        }
        const rect = this.canvas.getBoundingClientRect();
        this.dragPos = {
          x: ((e.clientX - rect.left) / rect.width) * BW,
          y: ((e.clientY - rect.top) / rect.height) * BH
        };
      });

      window.addEventListener('pointerup', (e) => {
        if (this.draggingDrinkIdx < 0) return;
        const idx = this.draggingDrinkIdx;
        const d = this.drinks[idx];
        const wasDrag = this._downPt && this._downPt.moved;
        this.draggingDrinkIdx = -1;
        this._downPt = null;

        if (!d || d.used) return;
        if (!wasDrag) {
          this.throwDrink(idx, null);
          return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const cx = ((e.clientX - rect.left) / rect.width) * BW;
        const cy = ((e.clientY - rect.top) / rect.height) * BH;
        if (cy >= 0 && cy <= BH + 30 && cx >= 0 && cx <= BW) {
          const pool = d.target === 'enemy' ? this.enemies.filter((u) => u.alive) : this.allies.filter((u) => u.alive);
          const nearest = pool.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
          this.throwDrink(idx, nearest || null);
        }
        this.dragPos = null;
      });
    }
  }

  window.MT.BattleTheater = BattleTheater;
})();
