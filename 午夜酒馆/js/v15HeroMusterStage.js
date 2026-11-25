// v15.2 Rainy Night Porch Muster Dais (HD-2D Frameless Hero Selection Stage)
// Replaces web-panel hero grids & pasted 3D battle-card foil tilt with a living
// 1280x720 rainy tavern porch where all 10 heroes stand live in a semicircular
// stone-step arc and step onto the lantern-lit central dais to perform a real
// pixel attack/cast flourish with ground rune rings and raindrop scatter.
(function () {
  'use strict';

  const MT = (window.MT = window.MT || {});

  const STAGE_W = 1280;
  const STAGE_H = 720;

  // Central elevated wet-stone muster dais (framed left-of-center to leave clean room for right folio)
  const DAIS = {
    x: 455,
    y: 454,
    rx: 130,
    ry: 33,
    scale: 2.75
  };

  // Semicircular two-tier rainy porch amphitheater for the 10 neutral heroes
  // Left wing faces right toward center; right wing faces left toward center
  const SEAT_LAYOUT = [
    { x: 118, y: 472, scale: 1.10, flipX: false, row: 'back' },
    { x: 224, y: 520, scale: 1.16, flipX: false, row: 'back' },
    { x: 108, y: 636, scale: 1.22, flipX: false, row: 'front' },
    { x: 244, y: 654, scale: 1.26, flipX: false, row: 'front' },
    { x: 382, y: 662, scale: 1.28, flipX: false, row: 'front' },
    { x: 528, y: 662, scale: 1.28, flipX: true,  row: 'front' },
    { x: 666, y: 654, scale: 1.26, flipX: true,  row: 'front' },
    { x: 802, y: 636, scale: 1.22, flipX: true,  row: 'front' },
    { x: 686, y: 520, scale: 1.16, flipX: true,  row: 'back' },
    { x: 792, y: 472, scale: 1.10, flipX: true,  row: 'back' }
  ];

  // Signature ground-sigil & flourish accent per hero archetype
  const HERO_ACCENTS = {
    hero_01: { main: '#ffd966', glow: 'rgba(255, 210, 96, 0.55)',  core: '#fff5cc' },
    hero_02: { main: '#6be5ff', glow: 'rgba(107, 229, 255, 0.55)', core: '#e0faff' },
    hero_03: { main: '#5eead4', glow: 'rgba(94, 234, 212, 0.52)',  core: '#ccfbf1' },
    hero_05: { main: '#ff6b8b', glow: 'rgba(255, 107, 139, 0.56)', core: '#ffe4ea' },
    hero_07: { main: '#7ef28a', glow: 'rgba(126, 242, 138, 0.55)', core: '#dcfce7' },
    hero_08: { main: '#c084fc', glow: 'rgba(192, 132, 252, 0.56)', core: '#f3e8ff' },
    hero_09: { main: '#facc15', glow: 'rgba(250, 204, 21, 0.56)',  core: '#fef9c3' },
    hero_10: { main: '#fb7185', glow: 'rgba(251, 113, 133, 0.58)', core: '#ffe4e6' },
    hero_04: { main: '#fde047', glow: 'rgba(253, 224, 71, 0.56)',  core: '#fefce8' },
    hero_06: { main: '#38bdf8', glow: 'rgba(56, 189, 248, 0.56)',  core: '#e0f2fe' }
  };

  function hash01(idx, seed) {
    let h = Math.imul(idx + 37, 374761393) ^ Math.imul(seed + 17, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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

      this.bgImg = new Image();
      this.bgLoaded = false;
      this.bgImg.onload = () => { this.bgLoaded = true; };
      this.bgImg.src = './assets/tavern/lv2.png';

      this._initAmbientParticles();
    }

    _initAmbientParticles() {
      this.embers = [];
      for (let i = 0; i < 26; i++) {
        this.embers.push({
          x: 90 + hash01(i, 11) * 760,
          y: 120 + hash01(i, 23) * 420,
          vy: 14 + hash01(i, 37) * 26,
          vx: 8 + hash01(i, 41) * 14,
          phase: hash01(i, 53) * Math.PI * 2,
          size: i % 3 === 0 ? 3 : 2,
          warm: i % 4 !== 0
        });
      }
      this.puddleRipples = [];
      for (let i = 0; i < 20; i++) {
        this.puddleRipples.push({
          x: 42 + hash01(i, 71) * 860,
          y: 416 + hash01(i, 83) * 280,
          age: hash01(i, 97) * 1.4,
          life: 0.9 + hash01(i, 109) * 0.7,
          maxR: 10 + hash01(i, 127) * 14
        });
      }
    }

    static getSeatLayout() {
      return SEAT_LAYOUT;
    }

    static getDais() {
      return DAIS;
    }

    static getHeroAccent(heroId) {
      return HERO_ACCENTS[heroId] || HERO_ACCENTS.hero_01;
    }

    attach(canvas, heroes, selectedHeroId) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.heroes = heroes || [];
      this.selectedHeroId = selectedHeroId || (this.heroes[0] && this.heroes[0].id) || 'hero_01';
      this.start();
    }

    setHeroes(heroes) {
      this.heroes = heroes || [];
    }

    setHovered(heroId) {
      this.hoveredHeroId = heroId || null;
    }

    selectHero(hero, playFlourish = true, isUnlockCelebrate = false) {
      if (!hero) return;
      this.selectedHeroId = hero.id;
      if (playFlourish) {
        this.triggerFlourish(hero, isUnlockCelebrate);
      }
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

      // Spawn radial pixel raindrop scatter + warm embers from dais floor
      const count = isUnlockCelebrate ? 38 : 24;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
        const speed = (isUnlockCelebrate ? 95 : 70) + Math.random() * 115;
        const isSpark = isUnlockCelebrate || i % 2 === 0;
        this.burstParticles.push({
          x: DAIS.x + Math.cos(angle) * (24 + Math.random() * 26),
          y: DAIS.y - 6 + Math.sin(angle) * 10,
          vx: Math.cos(angle) * speed,
          vy: -45 - Math.random() * (isUnlockCelebrate ? 125 : 85),
          gravity: isSpark ? 140 : 260,
          age: 0,
          life: 0.42 + Math.random() * 0.42,
          size: isSpark ? (Math.random() < 0.45 ? 4 : 3) : 2,
          color: isUnlockCelebrate
            ? (i % 3 === 0 ? '#fff5cc' : '#ffd966')
            : (isSpark ? accent.main : '#b9ddff')
        });
      }
    }

    start() {
      if (this.running || !this.canvas || !this.ctx) return;
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

      // Ambient drifting hearth embers
      for (let i = 0; i < this.embers.length; i++) {
        const e = this.embers[i];
        e.y -= e.vy * dt * motionScale;
        e.x += (e.vx + Math.sin(this.elapsed * 2.1 + e.phase) * 14) * dt * motionScale;
        if (e.y < 52 || e.x > 960) {
          e.x = 120 + Math.random() * 680;
          e.y = 430 + Math.random() * 140;
        }
      }

      // Wet cobblestone raindrop splash ripples
      for (let i = 0; i < this.puddleRipples.length; i++) {
        const r = this.puddleRipples[i];
        r.age += dt * (reduced ? 0.35 : 1);
        if (r.age >= r.life) {
          r.age = 0;
          r.x = 34 + Math.random() * 880;
          r.y = 414 + Math.random() * 284;
          r.life = 0.78 + Math.random() * 0.65;
          r.maxR = 9 + Math.random() * 14;
        }
      }

      // Flourish shockwave droplets & sparks
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

      // 1. Rainy Midnight Tavern Exterior Backdrop
      this._drawBackdrop(ctx, lanternPulse, flourishFlash);

      // 2. Back Rain Layer (distant slanted pixel raindrops behind sprites)
      this._drawRainLayer(ctx, t, reduced, 0);

      // 3. Wet Cobblestone Porch Floor & Puddle Reflections
      this._drawPorchFloor(ctx, t, lanternPulse, flourishFlash);

      // 4. Twin Hanging Brass Porch Lanterns + Volumetric Eaves Glow
      this._drawPorchLanterns(ctx, t, reduced, lanternPulse, flourishFlash);

      // 5. Central Elevated Muster Dais + Active Flourish Ground Sigil
      const curHero = this.heroes.find((h) => h.id === this.selectedHeroId) || this.heroes[0];
      const curAccent = curHero ? (HERO_ACCENTS[curHero.id] || HERO_ACCENTS.hero_01) : HERO_ACCENTS.hero_01;
      const curUnlocked = curHero && this.meta ? this.meta.isHeroUnlocked(curHero.id) : true;
      this._drawMusterDais(ctx, t, lanternPulse, flourishFlash, curAccent, curUnlocked);

      // 6. Back-Row Flanking Heroes (indices 0, 1, 8, 9)
      this._drawArcHeroes(ctx, t, lanternPulse, 'back');

      // 7. Focal Hero Standing on Central Muster Dais (Large Scale + Reflection + Flourish!)
      if (curHero) {
        this._drawFocalHero(ctx, curHero, curUnlocked, curAccent, t, lanternPulse, flourishFlash);
      }

      // 8. Front-Arc Courtyard Heroes (indices 2..7)
      this._drawArcHeroes(ctx, t, lanternPulse, 'front');

      // 9. Burst Particles (Flourish sparks & raindrop scatter) + Rising Hearth Embers
      this._drawEmbersAndBursts(ctx, t);

      // 10. Foreground Pixel Rain + Illuminated Rain Glints near Lanterns
      this._drawRainLayer(ctx, t, reduced, 1);

      // 11. Subtle Right-Edge Shadow Scrim (ensures crisp readability for floating folio without a harsh box)
      const rightScrim = ctx.createLinearGradient(835, 0, STAGE_W, 0);
      rightScrim.addColorStop(0, 'rgba(7, 10, 18, 0)');
      rightScrim.addColorStop(0.32, 'rgba(7, 10, 18, 0.56)');
      rightScrim.addColorStop(1, 'rgba(6, 9, 16, 0.86)');
      ctx.fillStyle = rightScrim;
      ctx.fillRect(835, 0, STAGE_W - 835, STAGE_H);

      // Top eaves shadow band
      const topScrim = ctx.createLinearGradient(0, 0, 0, 86);
      topScrim.addColorStop(0, 'rgba(5, 7, 14, 0.84)');
      topScrim.addColorStop(1, 'rgba(5, 7, 14, 0)');
      ctx.fillStyle = topScrim;
      ctx.fillRect(0, 0, STAGE_W, 86);

      ctx.restore();
    }

    _drawBackdrop(ctx, lanternPulse, flourishFlash) {
      // Deep midnight rain sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, 440);
      sky.addColorStop(0, '#070b16');
      sky.addColorStop(0.55, '#0e172a');
      sky.addColorStop(1, '#131d32');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);

      // Tavern exterior pixel art framed softly behind the porch eaves
      if (this.bgLoaded && this.bgImg.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.58;
        ctx.imageSmoothingEnabled = false;
        // Frame tavern facade centered around the muster porch (x ~ 455)
        const iw = this.bgImg.naturalWidth;
        const ih = this.bgImg.naturalHeight;
        const drawW = 1160;
        const drawH = Math.round(drawW * (ih / iw));
        ctx.drawImage(this.bgImg, -110, 22, drawW, drawH);
        ctx.restore();

        // Atmospheric blue-rain night grade over tavern exterior
        const grade = ctx.createLinearGradient(0, 0, 0, 445);
        grade.addColorStop(0, 'rgba(7, 11, 22, 0.62)');
        grade.addColorStop(0.55, 'rgba(10, 17, 32, 0.36)');
        grade.addColorStop(1, 'rgba(11, 16, 28, 0.96)');
        ctx.fillStyle = grade;
        ctx.fillRect(0, 0, STAGE_W, 455);
      }

      // Warm amber hearth spill glowing through the central tavern doorway behind the dais
      const doorGlow = ctx.createRadialGradient(
        DAIS.x, 316, 18,
        DAIS.x, 316, 270
      );
      const a0 = 0.22 + lanternPulse * 0.11 + flourishFlash * 0.18;
      doorGlow.addColorStop(0, `rgba(255, 178, 76, ${a0.toFixed(3)})`);
      doorGlow.addColorStop(0.48, `rgba(220, 114, 42, ${(a0 * 0.42).toFixed(3)})`);
      doorGlow.addColorStop(1, 'rgba(220, 114, 42, 0)');
      ctx.fillStyle = doorGlow;
      ctx.fillRect(140, 60, 640, 410);
    }

    _drawPorchFloor(ctx, t, lanternPulse, flourishFlash) {
      const horizonY = 396;
      const floorGrad = ctx.createLinearGradient(0, horizonY, 0, STAGE_H);
      floorGrad.addColorStop(0, '#131b2c');
      floorGrad.addColorStop(0.32, '#0f1625');
      floorGrad.addColorStop(0.75, '#0b101d');
      floorGrad.addColorStop(1, '#070a13');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, horizonY, STAGE_W, STAGE_H - horizonY);

      // Wet wooden porch curb / stone step threshold line
      ctx.fillStyle = '#202b40';
      ctx.fillRect(0, horizonY, STAGE_W, 4);
      ctx.fillStyle = '#090d17';
      ctx.fillRect(0, horizonY + 4, STAGE_W, 3);

      // Perspective staggered pixel cobblestone courses
      const rows = [
        { y: 416, h: 24, w: 68 },
        { y: 444, h: 28, w: 78 },
        { y: 476, h: 32, w: 90 },
        { y: 512, h: 36, w: 104 },
        { y: 552, h: 40, w: 118 },
        { y: 596, h: 46, w: 136 },
        { y: 646, h: 56, w: 156 }
      ];
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        ctx.fillStyle = 'rgba(5, 8, 15, 0.58)';
        ctx.fillRect(0, row.y, STAGE_W, 2);
        const offset = (r % 2) * (row.w * 0.5);
        for (let x = -offset; x < STAGE_W; x += row.w) {
          const sx = Math.round(x);
          // Occasional wet sheen stone highlight
          const sheen = hash01(Math.floor(x / 17) + r * 31, 401);
          if (sheen > 0.72) {
            ctx.fillStyle = `rgba(128, 168, 224, ${(0.04 + (sheen - 0.72) * 0.14).toFixed(3)})`;
            ctx.fillRect(sx + 3, row.y + 3, row.w - 6, row.h - 6);
          }
          // Stone mortar vertical seam
          ctx.fillStyle = 'rgba(5, 8, 15, 0.52)';
          ctx.fillRect(sx, row.y, 2, row.h);
        }
      }

      // Warm amber puddle reflections cast from twin eaves lanterns & doorway
      const pools = [
        { x: 154, y: 492, rx: 116, ry: 32, a: 0.14 + lanternPulse * 0.06 },
        { x: DAIS.x, y: 536, rx: 185, ry: 44, a: 0.15 + lanternPulse * 0.08 + flourishFlash * 0.12 },
        { x: 756, y: 492, rx: 116, ry: 32, a: 0.14 + lanternPulse * 0.06 }
      ];
      for (let i = 0; i < pools.length; i++) {
        const p = pools[i];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, p.ry / p.rx);
        const g = ctx.createRadialGradient(0, 0, 8, 0, 0, p.rx);
        g.addColorStop(0, `rgba(255, 178, 76, ${p.a.toFixed(3)})`);
        g.addColorStop(0.6, `rgba(218, 118, 42, ${(p.a * 0.35).toFixed(3)})`);
        g.addColorStop(1, 'rgba(218, 118, 42, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, p.rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Animated pixel rain-splash rings on wet cobblestones
      for (let i = 0; i < this.puddleRipples.length; i++) {
        const r = this.puddleRipples[i];
        const prog = r.age / r.life;
        if (prog <= 0 || prog >= 1) continue;
        const radX = Math.round(2 + prog * r.maxR);
        const radY = Math.max(1, Math.round(radX * 0.32));
        const alpha = (1 - prog) * 0.34;
        ctx.strokeStyle = `rgba(176, 214, 255, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(Math.round(r.x), Math.round(r.y), radX, radY, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    _drawPorchLanterns(ctx, t, reduced, lanternPulse, flourishFlash) {
      // Heavy timber porch overhang beams framing top left/right
      ctx.fillStyle = '#120c09';
      ctx.fillRect(0, 48, 920, 12);
      ctx.fillStyle = '#2c1c12';
      ctx.fillRect(0, 58, 920, 4);

      const lanterns = [
        { x: 154, y: 112, phase: 0.2 },
        { x: 756, y: 112, phase: 2.1 }
      ];
      for (let i = 0; i < lanterns.length; i++) {
        const l = lanterns[i];
        const sway = reduced ? 0 : Math.sin(t * 1.65 + l.phase) * 4.5;
        const lx = Math.round(l.x + sway);
        const ly = l.y;

        // Volumetric amber lantern light cone into the rain
        const haloR = 175 + lanternPulse * 24 + flourishFlash * 36;
        const halo = ctx.createRadialGradient(lx, ly + 10, 6, lx, ly + 16, haloR);
        const baseA = 0.28 + lanternPulse * 0.12 + flourishFlash * 0.14;
        halo.addColorStop(0, `rgba(255, 216, 118, ${baseA.toFixed(3)})`);
        halo.addColorStop(0.35, `rgba(255, 152, 54, ${(baseA * 0.45).toFixed(3)})`);
        halo.addColorStop(1, 'rgba(255, 130, 36, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(lx, ly + 14, haloR, 0, Math.PI * 2);
        ctx.fill();

        // Iron chain hanging from eaves beam
        ctx.fillStyle = '#181414';
        ctx.fillRect(l.x - 1, 60, 3, 28);
        ctx.fillStyle = '#4f3a26';
        ctx.fillRect(lx - 1, 86, 3, 12);

        // Pixel brass lantern cap & cage
        ctx.fillStyle = '#20150d';
        ctx.fillRect(lx - 10, ly - 14, 20, 5);
        ctx.fillStyle = '#b88234';
        ctx.fillRect(lx - 8, ly - 10, 16, 3);
        ctx.fillRect(lx - 8, ly + 11, 16, 4);
        ctx.fillStyle = '#2b1b10';
        ctx.fillRect(lx - 9, ly - 7, 18, 18);

        // Warm flickering flame glass core
        ctx.fillStyle = '#ff9d2e';
        ctx.fillRect(lx - 6, ly - 5, 12, 14);
        ctx.fillStyle = lanternPulse > 0.55 ? '#fff5c0' : '#ffe184';
        ctx.fillRect(lx - 4, ly - 2, 8, 9);
        // Lantern iron crossbars
        ctx.fillStyle = '#24160e';
        ctx.fillRect(lx - 1, ly - 6, 2, 16);
      }
    }

    _drawMusterDais(ctx, t, lanternPulse, flourishFlash, accent, unlocked) {
      const cx = DAIS.x;
      const cy = DAIS.y;

      // Overhead warm spotlight cone descending onto the dais hero
      ctx.save();
      const cone = ctx.createLinearGradient(cx, 62, cx, cy + 28);
      const coneA = (unlocked ? 0.14 : 0.09) + lanternPulse * 0.05 + flourishFlash * 0.16;
      cone.addColorStop(0, unlocked ? `rgba(255, 206, 114, ${coneA.toFixed(3)})` : `rgba(130, 186, 255, ${coneA.toFixed(3)})`);
      cone.addColorStop(0.75, unlocked ? `rgba(255, 168, 68, ${(coneA * 0.45).toFixed(3)})` : `rgba(114, 152, 240, ${(coneA * 0.45).toFixed(3)})`);
      cone.addColorStop(1, 'rgba(255, 168, 68, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(cx - 56, 60);
      ctx.lineTo(cx + 56, 60);
      ctx.lineTo(cx + 158, cy + 20);
      ctx.lineTo(cx - 158, cy + 20);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Ground drop shadow under elevated stone platform
      ctx.fillStyle = 'rgba(3, 5, 11, 0.72)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12, DAIS.rx + 12, DAIS.ry + 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Stone step side bevel
      ctx.fillStyle = '#182133';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6, DAIS.rx, DAIS.ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Top wet granite muster platform
      const topGrad = ctx.createRadialGradient(cx, cy - 6, 12, cx, cy, DAIS.rx);
      topGrad.addColorStop(0, unlocked ? '#2c3548' : '#212b42');
      topGrad.addColorStop(0.72, '#1a2335');
      topGrad.addColorStop(1, '#121928');
      ctx.fillStyle = topGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, DAIS.rx, DAIS.ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Weathered bronze/moonstone rim
      ctx.strokeStyle = unlocked
        ? `rgba(235, 188, 96, ${(0.42 + lanternPulse * 0.22 + flourishFlash * 0.35).toFixed(3)})`
        : `rgba(130, 180, 255, ${(0.38 + flourishFlash * 0.35).toFixed(3)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, DAIS.rx - 2, DAIS.ry - 1, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Inner inlaid rune ring (always breathing softly)
      ctx.save();
      ctx.strokeStyle = accent.main;
      ctx.globalAlpha = 0.26 + lanternPulse * 0.14 + flourishFlash * 0.45;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -t * 16;
      ctx.beginPath();
      ctx.ellipse(cx, cy, DAIS.rx * 0.72, DAIS.ry * 0.70, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Active Switch-to-Flourish expanding pixel ground sigil & shockwave ring!
      if (this.flourish.active) {
        const p = Math.min(1, this.flourish.elapsed / Math.max(0.45, this.flourish.duration));
        const easeOut = 1 - Math.pow(1 - p, 3);
        const fade = Math.max(0, 1 - p);

        // Floor energy pool flash
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, DAIS.ry / DAIS.rx);
        const fg = ctx.createRadialGradient(0, 0, 4, 0, 0, DAIS.rx * (0.65 + easeOut * 0.65));
        fg.addColorStop(0, accent.glow);
        fg.addColorStop(0.55, `rgba(255, 224, 128, ${(fade * 0.28).toFixed(3)})`);
        fg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.globalAlpha = fade * 0.9;
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(0, 0, DAIS.rx * 1.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Expanding crisp octagonal pixel shockwave ring
        const ringRx = DAIS.rx * (0.35 + easeOut * 1.02);
        const ringRy = DAIS.ry * (0.35 + easeOut * 1.02);
        ctx.save();
        ctx.strokeStyle = this.flourish.unlockCelebrate ? '#ffd966' : accent.main;
        ctx.globalAlpha = fade * 0.92;
        ctx.lineWidth = 3.5 - easeOut * 1.8;
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) {
          const ang = (k * Math.PI) / 4 + easeOut * 0.35;
          const px = Math.round(cx + Math.cos(ang) * ringRx);
          const py = Math.round(cy + Math.sin(ang) * ringRy);
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // Second trailing crisp elliptical ripple
        if (p > 0.12) {
          const p2 = Math.min(1, (p - 0.12) / 0.88);
          const e2 = 1 - Math.pow(1 - p2, 2);
          ctx.globalAlpha = (1 - p2) * 0.65;
          ctx.strokeStyle = accent.core;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, DAIS.rx * (0.28 + e2 * 0.9), DAIS.ry * (0.28 + e2 * 0.9), 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Brief vertical pixel light wisps rising from the rune rim
        for (let k = 0; k < 6; k++) {
          const ang = (k * Math.PI) / 3 + t * 0.8;
          const wx = Math.round(cx + Math.cos(ang) * (DAIS.rx * 0.68));
          const wy = Math.round(cy + Math.sin(ang) * (DAIS.ry * 0.65));
          const h = Math.round((1 - p) * 58 + 10);
          ctx.fillStyle = accent.main;
          ctx.globalAlpha = fade * 0.42;
          ctx.fillRect(wx - 1, wy - h, 3, h);
        }
        ctx.restore();
      }
    }

    _drawFocalHero(ctx, hero, unlocked, accent, t, lanternPulse, flourishFlash) {
      if (!this.sprites || !this.sprites.drawUnit) return;
      const x = DAIS.x;
      const y = DAIS.y - 2;
      const isFlourishing = this.flourish.active && this.flourish.unitId === hero.unitId;
      const anim = isFlourishing ? 'attack' : 'idle';

      // 1. Subtle wet-stone puddle reflection below hero's feet (HD-2D touch)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x, DAIS.y + 12, DAIS.rx * 0.94, DAIS.ry * 1.15, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(x, y + 6);
      ctx.scale(1, -0.36);
      this.sprites.drawUnit(ctx, hero.unitId, anim, t, 0, 0, {
        scale: DAIS.scale,
        flipX: false,
        alpha: 0.16,
        loop: !isFlourishing,
        elapsedOverride: isFlourishing ? this.flourish.elapsed : null,
        speedMult: isFlourishing ? this.flourish.speedMult : 1
      });
      ctx.restore();

      // 2. Ground contact shadow
      ctx.fillStyle = 'rgba(4, 6, 12, 0.72)';
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 48, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. Breathing firelight/cloak back-aura behind focal hero ("披风火光呼吸")
      const cloakR = 96 + lanternPulse * 18 + flourishFlash * 38;
      const cloakGlow = ctx.createRadialGradient(x, y - 74, 8, x, y - 66, cloakR);
      if (unlocked) {
        const ga = 0.24 + lanternPulse * 0.14 + flourishFlash * 0.28;
        cloakGlow.addColorStop(0, `rgba(255, 198, 92, ${ga.toFixed(3)})`);
        cloakGlow.addColorStop(0.55, accent.glow.replace('0.55', (ga * 0.55).toFixed(3)));
        cloakGlow.addColorStop(1, 'rgba(255, 160, 56, 0)');
      } else {
        const ga = 0.22 + lanternPulse * 0.08 + flourishFlash * 0.25;
        cloakGlow.addColorStop(0, `rgba(138, 186, 255, ${ga.toFixed(3)})`);
        cloakGlow.addColorStop(0.6, `rgba(128, 92, 224, ${(ga * 0.45).toFixed(3)})`);
        cloakGlow.addColorStop(1, 'rgba(100, 120, 220, 0)');
      }
      ctx.fillStyle = cloakGlow;
      ctx.beginPath();
      ctx.arc(x, y - 68, cloakR, 0, Math.PI * 2);
      ctx.fill();

      // 4. Crisp live Duelyst hero sprite on dais
      ctx.save();
      if (!unlocked) {
        // Locked hero still performs full flourish clearly, tinted slightly cool moonlit steel
        ctx.filter = `brightness(${(0.84 + flourishFlash * 0.25).toFixed(2)}) saturate(0.82)`;
      } else if (flourishFlash > 0.05) {
        ctx.filter = `brightness(${(1 + flourishFlash * 0.24).toFixed(2)})`;
      }
      const rimColor = flourishFlash > 0.08
        ? accent.main
        : (unlocked ? `rgba(255, 204, 112, ${(0.34 + lanternPulse * 0.30).toFixed(2)})` : 'rgba(138, 188, 255, 0.52)');
      this.sprites.drawUnit(ctx, hero.unitId, anim, t, x, y, {
        scale: DAIS.scale,
        flipX: false,
        alpha: 1,
        outlineColor: rimColor,
        loop: !isFlourishing,
        elapsedOverride: isFlourishing ? this.flourish.elapsed : null,
        speedMult: isFlourishing ? this.flourish.speedMult : 1
      });
      ctx.restore();
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

        // Ground contact shadow + wet stone puddle ring
        ctx.fillStyle = isSelected ? 'rgba(12, 10, 4, 0.65)' : 'rgba(3, 5, 11, 0.68)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 3, 28, 7.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Active seat beacon OR hover lantern pool on wet stone
        if (isSelected || isHovered) {
          ctx.save();
          ctx.strokeStyle = isSelected ? accent.main : 'rgba(255, 224, 132, 0.72)';
          ctx.lineWidth = isSelected ? 2 : 1.5;
          ctx.globalAlpha = isSelected ? (0.55 + lanternPulse * 0.35) : 0.7;
          ctx.beginPath();
          ctx.ellipse(sx, sy + 2, isSelected ? 34 : 31, isSelected ? 9.5 : 8.5, 0, 0, Math.PI * 2);
          ctx.stroke();

          const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 36);
          g.addColorStop(0, isSelected ? accent.glow : 'rgba(255, 214, 112, 0.28)');
          g.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(sx, sy + 2, 36, 11, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Draw living pixel sprite in the porch arc (phase-offset so all 10 don't breathe identically!)
        const phaseTime = t + i * 0.41;
        ctx.save();
        if (isSelected) {
          // Hero has stepped up onto the central dais — leave a translucent luminous echo at their seat
          ctx.filter = 'brightness(1.15) saturate(1.1)';
          this.sprites.drawUnit(ctx, hero.unitId, 'idle', phaseTime, sx, sy, {
            scale: seat.scale,
            flipX: seat.flipX,
            alpha: 0.34,
            outlineColor: accent.main
          });
        } else if (!unlocked) {
          // Locked hero: atmospheric rain-cloaked moonlit silhouette (brightens smoothly on hover)
          ctx.filter = isHovered
            ? 'brightness(0.76) saturate(0.72)'
            : 'brightness(0.42) saturate(0.42)';
          this.sprites.drawUnit(ctx, hero.unitId, 'idle', phaseTime, sx, sy, {
            scale: seat.scale * (isHovered ? 1.07 : 1),
            flipX: seat.flipX,
            alpha: isHovered ? 0.94 : 0.82,
            outlineColor: isHovered ? '#93c5fd' : 'rgba(116, 174, 245, 0.42)'
          });
        } else {
          // Unlocked hero: vivid pixel sprite catching warm porch lantern glow
          this.sprites.drawUnit(ctx, hero.unitId, 'idle', phaseTime, sx, sy, {
            scale: seat.scale * (isHovered ? 1.08 : 1),
            flipX: seat.flipX,
            alpha: 1,
            outlineColor: isHovered ? '#ffe082' : 'rgba(255, 198, 108, 0.26)'
          });
        }
        ctx.restore();
      }
    }

    _drawEmbersAndBursts(ctx, t) {
      // Rising warm tavern hearth embers
      for (let i = 0; i < this.embers.length; i++) {
        const e = this.embers[i];
        const flicker = 0.35 + 0.65 * Math.abs(Math.sin(t * 3.1 + e.phase));
        ctx.globalAlpha = flicker * 0.8;
        ctx.fillStyle = e.warm ? '#ffb84d' : '#fff0a8';
        ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
      }

      // Flourish shockwave particles
      for (let i = 0; i < this.burstParticles.length; i++) {
        const p = this.burstParticles[i];
        const alpha = Math.max(0, 1 - p.age / p.life);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }

    _drawRainLayer(ctx, t, reduced, layerIndex) {
      const time = reduced ? 0 : t;
      // 2x crisp pixel scaling (640x360 virtual grid -> super crisp slanted rain streaks matching Battle)
      ctx.save();
      ctx.scale(2, 2);
      const specs = layerIndex === 0
        ? [{ count: 52, len: 6, speed: 120, tail: '#6d8cc2', head: '#a5c7f7', alpha: 0.30 }]
        : [
            { count: 44, len: 10, speed: 185, tail: '#88afe8', head: '#d0e8ff', alpha: 0.44 },
            { count: 24, len: 14, speed: 245, tail: '#9ec5fa', head: '#eef7ff', alpha: 0.56 }
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
          // Warm amber glint when rain passes close to the twin lanterns or dais spotlight
          const nearLantern =
            (Math.abs(x - 77) < 42 && y > 38 && y < 140) ||
            (Math.abs(x - 378) < 42 && y > 38 && y < 140) ||
            (Math.abs(x - 227) < 58 && y > 100 && y < 235);
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
