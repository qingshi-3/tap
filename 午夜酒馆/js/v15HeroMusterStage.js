// v15.5 Pure-Code Rainy Night Courtyard Muster Dais (Zero Static PNG, Zero ctx.filter!)
// Strict pixel-grid rainy sanctuary courtyard (320x180 Bayer-dithered backdrop + 640x360 crisp pixel rain)
// with twin hanging brass lanterns, wet flagstone puddle reflections, carved pixel octagonal dais,
// and all 10 Duelyst heroes standing live with clear silhouettes and full attack flourish playback.
(function () {
  'use strict';

  const MT = (window.MT = window.MT || {});

  const STAGE_W = 1280;
  const STAGE_H = 720;
  const VW = 320;
  const VH = 180;

  // Central elevated wet-stone muster dais (framed left-of-center to leave clean room for right folio)
  const DAIS = {
    x: 455,
    y: 448,
    rx: 128,
    ry: 32,
    scale: 2.55
  };

  // Semicircular two-tier rainy courtyard amphitheater for the 10 neutral heroes
  const SEAT_LAYOUT = [
    { x: 118, y: 472, scale: 1.15, flipX: false, row: 'back' },
    { x: 226, y: 518, scale: 1.20, flipX: false, row: 'back' },
    { x: 108, y: 630, scale: 1.25, flipX: false, row: 'front' },
    { x: 244, y: 646, scale: 1.25, flipX: false, row: 'front' },
    { x: 382, y: 652, scale: 1.28, flipX: false, row: 'front' },
    { x: 528, y: 652, scale: 1.28, flipX: true,  row: 'front' },
    { x: 666, y: 646, scale: 1.25, flipX: true,  row: 'front' },
    { x: 802, y: 630, scale: 1.25, flipX: true,  row: 'front' },
    { x: 684, y: 518, scale: 1.20, flipX: true,  row: 'back' },
    { x: 792, y: 472, scale: 1.15, flipX: true,  row: 'back' }
  ];

  // Signature ground-sigil & flourish accent per hero archetype
  const HERO_ACCENTS = {
    hero_01: { main: '#ffd966', glow: 'rgba(255, 210, 96, 0.50)',  core: '#fff5cc' },
    hero_02: { main: '#6be5ff', glow: 'rgba(107, 229, 255, 0.50)', core: '#e0faff' },
    hero_03: { main: '#5eead4', glow: 'rgba(94, 234, 212, 0.48)',  core: '#ccfbf1' },
    hero_05: { main: '#ff6b8b', glow: 'rgba(255, 107, 139, 0.52)', core: '#ffe4ea' },
    hero_07: { main: '#7ef28a', glow: 'rgba(126, 242, 138, 0.50)', core: '#dcfce7' },
    hero_08: { main: '#c084fc', glow: 'rgba(192, 132, 252, 0.52)', core: '#f3e8ff' },
    hero_09: { main: '#facc15', glow: 'rgba(250, 204, 21, 0.52)',  core: '#fef9c3' },
    hero_10: { main: '#fb7185', glow: 'rgba(251, 113, 133, 0.54)', core: '#ffe4e6' },
    hero_04: { main: '#fde047', glow: 'rgba(253, 224, 71, 0.52)',  core: '#fefce8' },
    hero_06: { main: '#38bdf8', glow: 'rgba(56, 189, 248, 0.52)',  core: '#e0f2fe' }
  };

  const BAYER4 = [
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
  ];

  function hash01(idx, seed) {
    let h = Math.imul(idx + 37, 374761393) ^ Math.imul(seed + 17, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function bayerPick(x, y, t, a, b) {
    return t > (BAYER4[y & 3][x & 3] + 0.5) / 16 ? b : a;
  }

  function drawSteppedEllipse(ctx, cx, cy, rx, ry, col, alpha = 1, stepSize = 2) {
    ctx.save();
    ctx.fillStyle = col;
    ctx.globalAlpha = alpha;
    const steps = Math.max(16, Math.round((rx + ry) * 1.4));
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const px = Math.round((cx + Math.cos(a) * rx) / stepSize) * stepSize;
      const py = Math.round((cy + Math.sin(a) * ry) / stepSize) * stepSize;
      ctx.fillRect(px, py, stepSize, stepSize);
    }
    ctx.restore();
  }

  class HeroMusterStage {
    constructor(sprites, meta) {
      this.sprites = sprites;
      this.meta = meta;
      this.canvas = null;
      this.ctx = null;
      this.rafId = 0;
      this.running = false;
      this.startTs = 0;
      this.lastTs = 0;
      this.elapsed = 0;

      this.heroes = [];
      this.selectedHeroId = 'hero_01';
      this.hoveredHeroId = null;

      this.flourish = {
        active: false,
        unitId: null,
        elapsed: 0,
        duration: 0.72,
        speedMult: 1,
        accent: HERO_ACCENTS.hero_01,
        unlockCelebrate: false
      };

      this.burstParticles = [];
      this.embers = [];
      this.puddleRipples = [];
      this.reducedMotion = typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : { matches: false };

      this.bgCanvas = null;
      this._initAmbientParticles();
    }

    _bakeCourtyardBg() {
      const c = document.createElement('canvas');
      c.width = VW;
      c.height = VH;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      const horizonY = 98; // y = 392px

      // 1. Deep nocturnal rainy sky (Bayer 4x4 ordered dithering)
      const skyStops = ['#070b15', '#0c1324', '#131d34', '#1a2742', '#233352'];
      for (let y = 0; y < horizonY; y++) {
        const ny = y / horizonY;
        for (let x = 0; x < VW; x++) {
          const moonGlow = Math.max(0, 1 - Math.hypot((x - 74) / 68, (y - 34) / 48));
          const val = Math.min(0.999, ny * 0.65 + moonGlow * moonGlow * 0.40);
          const sc = val * (skyStops.length - 1);
          const idx = Math.floor(sc);
          ctx.fillStyle = bayerPick(x, y, sc - idx, skyStops[idx], skyStops[Math.min(skyStops.length - 1, idx + 1)]);
          ctx.fillRect(x, y, 1, 1);
        }
      }

      // 2. Soft rain-veiled pale moon placed cleanly in upper-left misty sky (vx=74, vy=32)
      const mx = 74, my = 32, mr = 8;
      for (let dy = -mr; dy <= mr; dy++) {
        for (let dx = -mr; dx <= mr; dx++) {
          if (dx * dx + dy * dy <= mr * mr) {
            ctx.fillStyle = (dx < 2 && dy < 2) ? '#d6e5f5' : '#9eb6d1';
            ctx.fillRect(mx + dx, my + dy, 1, 1);
          }
        }
      }

      // Organic wind-sheared rain cloud wisps
      const cloudBands = [
        { x: 12, y: 24, w: 68, h: 6, s: 1.1 },
        { x: 74, y: 34, w: 84, h: 6, s: 2.3 },
        { x: 164, y: 22, w: 78, h: 7, s: 3.7 }
      ];
      for (const cl of cloudBands) {
        for (let dx = 0; dx < cl.w; dx++) {
          const u = dx / Math.max(1, cl.w - 1);
          const env = Math.sin(u * Math.PI);
          if (env < 0.1) continue;
          const th = Math.max(1, Math.round(env * (0.5 + 0.3 * Math.sin(u * 9 + cl.s)) * cl.h));
          for (let py = cl.y - th; py <= cl.y + 1; py++) {
            ctx.fillStyle = py === cl.y - th ? '#243554' : '#111b30';
            ctx.fillRect(cl.x + dx, py, 1, 1);
          }
        }
      }

      // 3. Distant misty mountain & pine ridge across the rainy night
      for (let x = 0; x < VW; x++) {
        const mh = Math.round(14 + Math.sin(x * 0.032 + 0.5) * 6 + Math.sin(x * 0.08) * 3);
        ctx.fillStyle = '#11192b';
        ctx.fillRect(x, horizonY - mh, 1, mh);
      }
      for (const [px, ph] of [[16, 26], [28, 20], [42, 24], [186, 22], [202, 28], [218, 19]]) {
        for (let r = 0; r < ph; r++) {
          const hw = Math.max(1, Math.round((r / ph) * (ph * 0.25)));
          ctx.fillStyle = '#0d1424';
          ctx.fillRect(px - hw, horizonY - ph + r, hw * 2 + 1, 1);
        }
      }

      // 4. Rainy Sanctuary Stone Colonnade / Covered Stone Gallery behind the muster dais (vx=20..216)
      // Gives rich architectural silhouette & framing WITHOUT static painted rain or tavern-wall clutter!
      ctx.fillStyle = '#0b101d';
      ctx.fillRect(0, 14, 240, 5); // heavy timber/stone eaves beam
      ctx.fillStyle = '#1d273d';
      ctx.fillRect(0, 18, 240, 1);

      // Stone balustrade & distant gothic arches across the courtyard rear wall
      const wallTop = 76;
      ctx.fillStyle = '#141d30';
      ctx.fillRect(0, wallTop, VW, horizonY - wallTop);
      ctx.fillStyle = '#25344f';
      ctx.fillRect(0, wallTop, VW, 2); // rain-slick top coping stone
      ctx.fillStyle = '#0a0f1c';
      ctx.fillRect(0, wallTop + 2, VW, 1);

      // Recessed dark stone arches along rear gallery
      for (let ax = 12; ax < 226; ax += 34) {
        const aw = 24;
        for (let dx = 0; dx < aw; dx++) {
          const u = (dx - aw / 2) / (aw / 2);
          const archY = 50 + Math.round((1 - Math.sqrt(Math.max(0, 1 - u * u))) * 9);
          // Pillar frame
          ctx.fillStyle = '#0f1626';
          ctx.fillRect(ax - 5, 42, 5, horizonY - 42);
          ctx.fillStyle = '#202d45';
          ctx.fillRect(ax - 4, 42, 1, horizonY - 42);
          // Arch spandrel
          ctx.fillStyle = '#131c2e';
          ctx.fillRect(ax + dx, 42, 1, Math.max(0, archY - 42));
        }
      }
      // Central Sanctuary Portal Archway directly behind the muster dais (vx=96..132)
      ctx.fillStyle = '#090d18';
      ctx.fillRect(96, 36, 36, horizonY - 36);
      ctx.fillStyle = '#1b263d';
      ctx.fillRect(94, 34, 40, 3);
      ctx.fillRect(94, 34, 3, horizonY - 34);
      ctx.fillRect(131, 34, 3, horizonY - 34);
      ctx.fillStyle = '#314363';
      ctx.fillRect(95, 35, 38, 1);
      // Warm distant inner sanctuary light seeping softly from portal center
      for (let y = 50; y < horizonY; y++) {
        for (let x = 100; x < 128; x++) {
          const g = Math.max(0, 1 - Math.hypot((x - 114) / 16, (y - 84) / 34));
          if (g > 0.15 && bayerPick(x, y, g * 0.72, false, true)) {
            ctx.fillStyle = g > 0.6 ? '#b87638' : '#4a3228';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }

      // 5. Wet Flagstone Courtyard Floor (vy = 98..180, crisp Bayer-dithered depth + stone courses)
      const floorStops = ['#1c273d', '#161f33', '#111829', '#0c1220', '#090d18'];
      for (let y = horizonY; y < VH; y++) {
        const p = (y - horizonY) / (VH - horizonY);
        const sc = p * (floorStops.length - 1);
        const idx = Math.floor(sc);
        for (let x = 0; x < VW; x++) {
          ctx.fillStyle = bayerPick(x, y, sc - idx, floorStops[idx], floorStops[Math.min(floorStops.length - 1, idx + 1)]);
          ctx.fillRect(x, y, 1, 1);
        }
      }

      // Raised courtyard step curb
      ctx.fillStyle = '#2d3e5e';
      ctx.fillRect(0, horizonY, VW, 1);
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(0, horizonY + 1, VW, 1);

      // Perspective pixel stone flagstone seams & wet highlights
      const stoneRows = [
        { y: 103, h: 6,  w: 18 },
        { y: 109, h: 7,  w: 20 },
        { y: 116, h: 8,  w: 23 },
        { y: 124, h: 9,  w: 26 },
        { y: 133, h: 10, w: 30 },
        { y: 143, h: 12, w: 34 },
        { y: 155, h: 13, w: 39 },
        { y: 168, h: 13, w: 44 }
      ];
      for (let r = 0; r < stoneRows.length; r++) {
        const row = stoneRows[r];
        ctx.fillStyle = '#0a0f1c';
        ctx.fillRect(0, row.y, VW, 1);
        const off = (r % 2) * Math.floor(row.w / 2);
        for (let x = -off; x < VW; x += row.w) {
          ctx.fillStyle = '#0a0f1c';
          ctx.fillRect(x, row.y, 1, row.h);
          const sheen = hash01(x * 7 + r * 31, 409);
          if (sheen > 0.65) {
            ctx.fillStyle = sheen > 0.85 ? 'rgba(136, 178, 232, 0.12)' : 'rgba(116, 152, 206, 0.06)';
            ctx.fillRect(x + 1, row.y + 1, row.w - 2, row.h - 2);
          }
        }
      }

      this.bgCanvas = c;
    }

    _initAmbientParticles() {
      this.embers = [];
      for (let i = 0; i < 20; i++) {
        this.embers.push({
          x: 90 + hash01(i, 11) * 760,
          y: 120 + hash01(i, 23) * 420,
          vy: 14 + hash01(i, 37) * 24,
          vx: 6 + hash01(i, 41) * 12,
          phase: hash01(i, 53) * Math.PI * 2,
          size: i % 3 === 0 ? 4 : 2,
          warm: i % 4 !== 0
        });
      }
      this.puddleRipples = [];
      for (let i = 0; i < 18; i++) {
        this.puddleRipples.push({
          x: 42 + hash01(i, 71) * 840,
          y: 416 + hash01(i, 83) * 270,
          age: hash01(i, 97) * 1.4,
          life: 0.9 + hash01(i, 109) * 0.7,
          maxR: 10 + hash01(i, 127) * 14
        });
      }
    }

    static getSeatLayout() { return SEAT_LAYOUT; }
    static getDais() { return DAIS; }
    static getHeroAccent(heroId) { return HERO_ACCENTS[heroId] || HERO_ACCENTS.hero_01; }

    attach(canvas, heroes, selectedHeroId) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.heroes = heroes || [];
      this.selectedHeroId = selectedHeroId || (this.heroes[0] && this.heroes[0].id) || 'hero_01';
      if (!this.bgCanvas) this._bakeCourtyardBg();
      this.start();
    }

    setHeroes(heroes) { this.heroes = heroes || []; }
    setHovered(heroId) { this.hoveredHeroId = heroId || null; }

    selectHero(hero, playFlourish = true, isUnlockCelebrate = false) {
      if (!hero) return;
      this.selectedHeroId = hero.id;
      if (playFlourish) this.triggerFlourish(hero, isUnlockCelebrate);
    }

    triggerFlourish(hero, isUnlockCelebrate = false) {
      if (!hero) return;
      const dur = (this.sprites && this.sprites.getAttackDurationSec)
        ? this.sprites.getAttackDurationSec(hero.unitId)
        : 0.72;
      const speedMult = (this.sprites && this.sprites.getAttackSpeedMult)
        ? this.sprites.getAttackSpeedMult(hero.unitId, dur)
        : 1;
      const accent = HERO_ACCENTS[hero.id] || HERO_ACCENTS.hero_01;

      this.flourish = {
        active: true,
        unitId: hero.unitId,
        elapsed: 0,
        duration: dur,
        speedMult,
        accent,
        unlockCelebrate: !!isUnlockCelebrate
      };

      const count = isUnlockCelebrate ? 34 : 22;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
        const speed = (isUnlockCelebrate ? 95 : 70) + Math.random() * 110;
        const isSpark = isUnlockCelebrate || i % 2 === 0;
        this.burstParticles.push({
          x: DAIS.x + Math.cos(angle) * (24 + Math.random() * 26),
          y: DAIS.y - 6 + Math.sin(angle) * 10,
          vx: Math.cos(angle) * speed,
          vy: -45 - Math.random() * (isUnlockCelebrate ? 120 : 82),
          gravity: isSpark ? 140 : 250,
          age: 0,
          life: 0.42 + Math.random() * 0.4,
          size: isSpark ? 4 : 2,
          color: isUnlockCelebrate
            ? (i % 3 === 0 ? '#fff5cc' : '#ffd966')
            : (isSpark ? accent.main : '#b9ddff')
        });
      }
    }

    start() {
      if (this.running || !this.canvas || !this.ctx) return;
      if (!this.bgCanvas) this._bakeCourtyardBg();
      this.running = true;
      this.startTs = performance.now();
      this.lastTs = this.startTs;
      const loop = (now) => {
        if (!this.running) return;
        if (!this.canvas || !this.canvas.isConnected) {
          this.stop();
          return;
        }
        const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTs) / 1000));
        this.lastTs = now;
        this.elapsed += dt;
        this._update(dt);
        this._draw();
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }

    stop() {
      this.running = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
    }

    _update(dt) {
      const reduced = this.reducedMotion && this.reducedMotion.matches;
      const motionScale = reduced ? 0.25 : 1;

      if (this.flourish.active) {
        this.flourish.elapsed += dt;
        if (this.flourish.elapsed >= this.flourish.duration + 0.14) {
          this.flourish.active = false;
        }
      }

      for (let i = 0; i < this.embers.length; i++) {
        const e = this.embers[i];
        e.y -= e.vy * dt * motionScale;
        e.x += (e.vx + Math.sin(this.elapsed * 2.1 + e.phase) * 14) * dt * motionScale;
        if (e.y < 52 || e.x > 920) {
          e.x = 120 + Math.random() * 680;
          e.y = 430 + Math.random() * 140;
        }
      }

      for (let i = 0; i < this.puddleRipples.length; i++) {
        const r = this.puddleRipples[i];
        r.age += dt * (reduced ? 0.35 : 1);
        if (r.age >= r.life) {
          r.age = 0;
          r.x = 34 + Math.random() * 860;
          r.y = 414 + Math.random() * 270;
          r.life = 0.78 + Math.random() * 0.65;
          r.maxR = 9 + Math.random() * 13;
        }
      }

      for (let i = this.burstParticles.length - 1; i >= 0; i--) {
        const p = this.burstParticles[i];
        p.age += dt;
        if (p.age >= p.life) {
          this.burstParticles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
      }
    }

    _draw() {
      const ctx = this.ctx;
      const t = this.elapsed;
      const reduced = this.reducedMotion && this.reducedMotion.matches;
      const lanternPulse = reduced
        ? 0.5
        : (0.5 + 0.32 * Math.sin(t * 2.4) + 0.18 * Math.sin(t * 5.7 + 1.1));
      const flourishFlash = this.flourish.active
        ? Math.max(0, 1 - this.flourish.elapsed / 0.52)
        : 0;

      ctx.save();
      ctx.clearRect(0, 0, STAGE_W, STAGE_H);
      ctx.imageSmoothingEnabled = false;

      // 1. Crisp 4x Pure-Code Rainy Sanctuary Courtyard Backdrop
      if (this.bgCanvas) {
        ctx.drawImage(this.bgCanvas, 0, 0, VW, VH, 0, 0, STAGE_W, STAGE_H);
      }

      // 2. Back Rain Layer
      this._drawRainLayer(ctx, t, reduced, 0);

      // 3. Wet Flagstone Warm Lantern Pools & Stepped Pixel Puddle Ripples
      this._drawCourtyardPools(ctx, lanternPulse, flourishFlash);

      // 4. Twin Hanging Brass Sanctuary Lanterns
      this._drawPorchLanterns(ctx, t, reduced, lanternPulse, flourishFlash);

      // 5. Pixel-Stepped Carved Stone Muster Dais + Active Flourish Pixel Sigil
      const curHero = this.heroes.find((h) => h.id === this.selectedHeroId) || this.heroes[0];
      const curAccent = curHero ? (HERO_ACCENTS[curHero.id] || HERO_ACCENTS.hero_01) : HERO_ACCENTS.hero_01;
      const curUnlocked = curHero && this.meta ? this.meta.isHeroUnlocked(curHero.id) : true;
      this._drawMusterDais(ctx, t, lanternPulse, flourishFlash, curAccent, curUnlocked);

      // 6. Back-Row Heroes
      this._drawArcHeroes(ctx, t, lanternPulse, 'back');

      // 7. Focal Hero on Central Dais
      if (curHero) {
        this._drawFocalHero(ctx, curHero, curUnlocked, curAccent, t, lanternPulse, flourishFlash);
      }

      // 8. Front-Arc Heroes
      this._drawArcHeroes(ctx, t, lanternPulse, 'front');

      // 9. Embers & Flourish Sparks
      this._drawEmbersAndBursts(ctx, t);

      // 10. Foreground Crisp Pixel Rain
      this._drawRainLayer(ctx, t, reduced, 1);

      // 11. Subtle Right-Side Dark Scrim for Tactical Dossier Contrast
      const rightScrim = ctx.createLinearGradient(835, 0, STAGE_W, 0);
      rightScrim.addColorStop(0, 'rgba(6, 9, 18, 0)');
      rightScrim.addColorStop(0.35, 'rgba(6, 9, 18, 0.56)');
      rightScrim.addColorStop(1, 'rgba(5, 8, 16, 0.88)');
      ctx.fillStyle = rightScrim;
      ctx.fillRect(835, 0, STAGE_W - 835, STAGE_H);

      ctx.restore();
    }

    _drawCourtyardPools(ctx, lanternPulse, flourishFlash) {
      const pools = [
        { x: 154, y: 492, rx: 112, ry: 28, a: 0.13 + lanternPulse * 0.05 },
        { x: DAIS.x, y: 528, rx: 180, ry: 42, a: 0.14 + lanternPulse * 0.06 + flourishFlash * 0.10 },
        { x: 756, y: 492, rx: 112, ry: 28, a: 0.13 + lanternPulse * 0.05 }
      ];
      for (const p of pools) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, p.ry / p.rx);
        const g = ctx.createRadialGradient(0, 0, 8, 0, 0, p.rx);
        g.addColorStop(0, `rgba(255, 184, 82, ${p.a.toFixed(3)})`);
        g.addColorStop(0.6, `rgba(218, 122, 46, ${(p.a * 0.32).toFixed(3)})`);
        g.addColorStop(1, 'rgba(218, 122, 46, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, p.rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Crisp stepped pixel puddle ripples (ZERO blurry antialiased ellipses!)
      for (const r of this.puddleRipples) {
        const prog = r.age / r.life;
        if (prog <= 0 || prog >= 1) continue;
        const radX = Math.round(2 + prog * r.maxR);
        const radY = Math.max(2, Math.round(radX * 0.30));
        drawSteppedEllipse(ctx, r.x, r.y, radX, radY, '#a6ccf8', (1 - prog) * 0.36, 2);
      }
    }

    _drawPorchLanterns(ctx, t, reduced, lanternPulse, flourishFlash) {
      const lanterns = [
        { x: 154, y: 116, phase: 0.2 },
        { x: 756, y: 116, phase: 2.1 }
      ];
      for (const l of lanterns) {
        const sway = reduced ? 0 : Math.round(Math.sin(t * 1.65 + l.phase) * 3) * 2;
        const lx = l.x + sway;
        const ly = l.y;

        const haloR = 165 + lanternPulse * 22 + flourishFlash * 32;
        const halo = ctx.createRadialGradient(lx, ly + 10, 6, lx, ly + 16, haloR);
        const baseA = 0.24 + lanternPulse * 0.10 + flourishFlash * 0.12;
        halo.addColorStop(0, `rgba(255, 214, 114, ${baseA.toFixed(3)})`);
        halo.addColorStop(0.35, `rgba(255, 152, 54, ${(baseA * 0.42).toFixed(3)})`);
        halo.addColorStop(1, 'rgba(255, 130, 36, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(lx - haloR, ly + 14 - haloR, haloR * 2, haloR * 2);

        // Pixel wrought-iron chain & lantern housing
        ctx.fillStyle = '#0c101b';
        ctx.fillRect(l.x - 2, 72, 4, 24);
        ctx.fillStyle = '#4d3a28';
        ctx.fillRect(lx - 2, 94, 4, 10);

        ctx.fillStyle = '#18120c';
        ctx.fillRect(lx - 12, ly - 14, 24, 6);
        ctx.fillStyle = '#c48d3c';
        ctx.fillRect(lx - 10, ly - 10, 20, 4);
        ctx.fillRect(lx - 10, ly + 12, 20, 4);
        ctx.fillStyle = '#1d140e';
        ctx.fillRect(lx - 10, ly - 6, 20, 18);

        ctx.fillStyle = '#ff9d2e';
        ctx.fillRect(lx - 6, ly - 4, 12, 14);
        ctx.fillStyle = lanternPulse > 0.55 ? '#fff6c4' : '#ffe184';
        ctx.fillRect(lx - 4, ly - 2, 8, 10);
        ctx.fillStyle = '#24160e';
        ctx.fillRect(lx - 1, ly - 6, 2, 18);
      }
    }

    _drawMusterDais(ctx, t, lanternPulse, flourishFlash, accent, unlocked) {
      const cx = DAIS.x;
      const cy = DAIS.y;

      // Soft ambient spotlight from sanctuary arch
      ctx.save();
      const cone = ctx.createLinearGradient(cx, 72, cx, cy + 28);
      const coneA = (unlocked ? 0.13 : 0.10) + lanternPulse * 0.04 + flourishFlash * 0.14;
      cone.addColorStop(0, unlocked ? `rgba(255, 206, 114, ${coneA.toFixed(3)})` : `rgba(130, 186, 255, ${coneA.toFixed(3)})`);
      cone.addColorStop(0.75, unlocked ? `rgba(255, 168, 68, ${(coneA * 0.4).toFixed(3)})` : `rgba(114, 152, 240, ${(coneA * 0.4).toFixed(3)})`);
      cone.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(cx - 56, 72);
      ctx.lineTo(cx + 56, 72);
      ctx.lineTo(cx + 150, cy + 20);
      ctx.lineTo(cx - 150, cy + 20);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Pixel-stepped octagonal wet granite dais (replaces smooth vector oval!)
      const drawOctagon = (ox, oy, rx, ry, fill) => {
        ctx.fillStyle = fill;
        const cX = Math.round(rx * 0.62);
        const cY = Math.round(ry * 0.62);
        ctx.beginPath();
        ctx.moveTo(ox - cX, oy - ry);
        ctx.lineTo(ox + cX, oy - ry);
        ctx.lineTo(ox + rx, oy - cY);
        ctx.lineTo(ox + rx, oy + cY);
        ctx.lineTo(ox + cX, oy + ry);
        ctx.lineTo(ox - cX, oy + ry);
        ctx.lineTo(ox - rx, oy + cY);
        ctx.lineTo(ox - rx, oy - cY);
        ctx.closePath();
        ctx.fill();
      };

      drawOctagon(cx, cy + 12, DAIS.rx + 10, DAIS.ry + 6, 'rgba(3, 5, 11, 0.78)');
      drawOctagon(cx, cy + 6, DAIS.rx, DAIS.ry, '#141d2f');
      drawOctagon(cx, cy, DAIS.rx, DAIS.ry, '#222e46');
      drawOctagon(cx, cy, DAIS.rx - 8, DAIS.ry - 3, '#192338');

      // Stepped pixel metallic trim & animated pixel rune pips around the dais
      const rimCol = unlocked ? '#e8ba62' : '#7cb5ff';
      drawSteppedEllipse(ctx, cx, cy, DAIS.rx - 4, DAIS.ry - 2, rimCol, 0.55 + lanternPulse * 0.25, 2);
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * Math.PI * 2 + t * 0.35;
        const rx = Math.round((cx + Math.cos(ang) * (DAIS.rx * 0.72)) / 2) * 2;
        const ry = Math.round((cy + Math.sin(ang) * (DAIS.ry * 0.68)) / 2) * 2;
        ctx.fillStyle = k % 2 === 0 ? accent.main : accent.core;
        ctx.globalAlpha = 0.35 + lanternPulse * 0.3 + flourishFlash * 0.35;
        ctx.fillRect(rx - 2, ry - 1, 4, 2);
      }
      ctx.globalAlpha = 1;

      // Active flourish stepped pixel shockwave
      if (this.flourish.active) {
        const p = Math.min(1, this.flourish.elapsed / Math.max(0.45, this.flourish.duration));
        const easeOut = 1 - Math.pow(1 - p, 3);
        const fade = Math.max(0, 1 - p);
        drawSteppedEllipse(
          ctx, cx, cy,
          DAIS.rx * (0.35 + easeOut * 1.0),
          DAIS.ry * (0.35 + easeOut * 1.0),
          this.flourish.unlockCelebrate ? '#ffd966' : accent.main,
          fade * 0.9,
          3
        );
        for (let k = 0; k < 6; k++) {
          const ang = (k * Math.PI) / 3 + t * 0.8;
          const wx = Math.round(cx + Math.cos(ang) * (DAIS.rx * 0.68));
          const wy = Math.round(cy + Math.sin(ang) * (DAIS.ry * 0.65));
          const h = Math.round((1 - p) * 52 + 8);
          ctx.fillStyle = accent.main;
          ctx.globalAlpha = fade * 0.45;
          ctx.fillRect(wx - 2, wy - h, 4, h);
        }
        ctx.globalAlpha = 1;
      }
    }

    _drawFocalHero(ctx, hero, unlocked, accent, t, lanternPulse, flourishFlash) {
      if (!this.sprites || !this.sprites.drawUnit) return;
      const x = DAIS.x;
      const y = DAIS.y - 2;
      const isFlourishing = this.flourish.active && this.flourish.unitId === hero.unitId;
      const anim = isFlourishing ? 'attack' : 'idle';

      // Subtle wet granite puddle reflection below dais hero
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - DAIS.rx, DAIS.y - 4, DAIS.rx * 2, DAIS.ry * 1.4);
      ctx.clip();
      ctx.translate(x, y + 6);
      ctx.scale(1, -0.34);
      this.sprites.drawUnit(ctx, hero.unitId, anim, t, 0, 0, {
        scale: DAIS.scale,
        flipX: false,
        alpha: 0.16,
        loop: !isFlourishing,
        elapsedOverride: isFlourishing ? this.flourish.elapsed : null,
        speedMult: isFlourishing ? this.flourish.speedMult : 1
      });
      ctx.restore();

      // Stepped pixel contact shadow
      ctx.fillStyle = 'rgba(4, 6, 12, 0.75)';
      ctx.fillRect(x - 42, y - 2, 84, 8);
      ctx.fillRect(x - 32, y + 6, 64, 4);

      // Soft warm/moonlit back-aura (zero ctx.filter!)
      const cloakR = 92 + lanternPulse * 16 + flourishFlash * 32;
      const cloakGlow = ctx.createRadialGradient(x, y - 70, 8, x, y - 66, cloakR);
      const ga = 0.22 + lanternPulse * 0.12 + flourishFlash * 0.24;
      if (unlocked) {
        cloakGlow.addColorStop(0, `rgba(255, 204, 102, ${ga.toFixed(3)})`);
        cloakGlow.addColorStop(1, 'rgba(255, 160, 56, 0)');
      } else {
        cloakGlow.addColorStop(0, `rgba(132, 188, 255, ${ga.toFixed(3)})`);
        cloakGlow.addColorStop(1, 'rgba(92, 128, 224, 0)');
      }
      ctx.fillStyle = cloakGlow;
      ctx.fillRect(x - cloakR, y - 68 - cloakR, cloakR * 2, cloakR * 2);

      // Crisp live Duelyst hero sprite (ZERO ctx.filter overhead!)
      const rimColor = flourishFlash > 0.08
        ? accent.main
        : (unlocked ? '#f4c86c' : '#8ac2ff');
      this.sprites.drawUnit(ctx, hero.unitId, anim, t, x, y, {
        scale: DAIS.scale,
        flipX: false,
        alpha: 1,
        outlineColor: rimColor,
        loop: !isFlourishing,
        elapsedOverride: isFlourishing ? this.flourish.elapsed : null,
        speedMult: isFlourishing ? this.flourish.speedMult : 1,
        flashWhite: flourishFlash > 0.4 ? (flourishFlash - 0.4) * 0.35 : 0
      });
    }

    _drawArcHeroes(ctx, t, lanternPulse, rowFilter) {
      if (!this.sprites || !this.sprites.drawUnit) return;
      for (let i = 0; i < this.heroes.length && i < SEAT_LAYOUT.length; i++) {
        const seat = SEAT_LAYOUT[i];
        if (seat.row !== rowFilter) continue;
        const hero = this.heroes[i];
        const unlocked = this.meta ? this.meta.isHeroUnlocked(hero.id) : true;
        const isSelected = hero.id === this.selectedHeroId;
        const isHovered = hero.id === this.hoveredHeroId;
        const accent = HERO_ACCENTS[hero.id] || HERO_ACCENTS.hero_01;

        const sx = seat.x;
        const sy = seat.y;

        // Crisp ground contact shadow
        ctx.fillStyle = 'rgba(4, 6, 14, 0.72)';
        ctx.fillRect(sx - 24, sy - 1, 48, 6);

        // Subtle cool moonlit puddle beneath locked/unlocked heroes so EVERY hero reads cleanly against wet stone!
        if (isSelected || isHovered) {
          drawSteppedEllipse(ctx, sx, sy + 2, isSelected ? 34 : 30, 8, isSelected ? accent.main : '#ffe082', 0.82, 2);
        } else if (!unlocked) {
          drawSteppedEllipse(ctx, sx, sy + 2, 24, 6, '#5c89c4', 0.35, 2);
        }

        // ZERO ctx.filter! Crisp readable locked heroes (alpha 0.86 + bright moonlit rim so faces/weapons are 100% clear!)
        const phaseTime = t + i * 0.41;
        if (isSelected) {
          this.sprites.drawUnit(ctx, hero.unitId, 'idle', phaseTime, sx, sy, {
            scale: seat.scale,
            flipX: seat.flipX,
            alpha: 0.38,
            outlineColor: accent.main
          });
        } else if (!unlocked) {
          this.sprites.drawUnit(ctx, hero.unitId, 'idle', phaseTime, sx, sy, {
            scale: seat.scale * (isHovered ? 1.06 : 1),
            flipX: seat.flipX,
            alpha: isHovered ? 0.98 : 0.84,
            outlineColor: isHovered ? '#b8dcff' : '#6aa4e8'
          });
        } else {
          this.sprites.drawUnit(ctx, hero.unitId, 'idle', phaseTime, sx, sy, {
            scale: seat.scale * (isHovered ? 1.06 : 1),
            flipX: seat.flipX,
            alpha: 1,
            outlineColor: isHovered ? '#ffe082' : '#d6a95c'
          });
        }
      }
    }

    _drawEmbersAndBursts(ctx, t) {
      for (const e of this.embers) {
        const flicker = 0.35 + 0.65 * Math.abs(Math.sin(t * 3.1 + e.phase));
        ctx.globalAlpha = flicker * 0.75;
        ctx.fillStyle = e.warm ? '#ffb84d' : '#fff0a8';
        ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
      }
      for (const p of this.burstParticles) {
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }

    _drawRainLayer(ctx, t, reduced, layerIndex) {
      const time = reduced ? 0 : t;
      ctx.save();
      ctx.scale(2, 2);
      const specs = layerIndex === 0
        ? [{ count: 48, len: 6, speed: 120, tail: '#6d8cc2', head: '#a5c7f7', alpha: 0.28 }]
        : [
            { count: 42, len: 10, speed: 185, tail: '#88afe8', head: '#d0e8ff', alpha: 0.42 },
            { count: 22, len: 14, speed: 240, tail: '#9ec5fa', head: '#eef7ff', alpha: 0.54 }
          ];

      for (let s = 0; s < specs.length; s++) {
        const sp = specs[s];
        const seed = 313 + layerIndex * 101 + s * 57;
        ctx.globalAlpha = sp.alpha;
        for (let i = 0; i < sp.count; i++) {
          const travel = hash01(i, seed) * 390 + time * sp.speed;
          const pass = Math.floor(travel / 390);
          const y = (travel % 390) - 18;
          const x = hash01(i + pass * sp.count + 77, seed) * 700 - y * 0.22;
          const nearLantern =
            (Math.abs(x - 77) < 42 && y > 38 && y < 140) ||
            (Math.abs(x - 378) < 42 && y > 38 && y < 140) ||
            (Math.abs(x - 227) < 56 && y > 100 && y < 235);
          ctx.fillStyle = nearLantern ? '#ffd891' : sp.tail;
          for (let step = 2; step < sp.len; step += 2) {
            ctx.fillRect(Math.round(x + step * 0.22), Math.round(y) - step, 1, 2);
          }
          ctx.fillStyle = nearLantern ? '#fff3c4' : sp.head;
          ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 2);
        }
      }
      ctx.restore();
    }
  }

  MT.HeroMusterStage = HeroMusterStage;
})();
