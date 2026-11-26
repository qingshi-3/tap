// v16.6 Bespoke Pack-Opening Ceremony VFX Engine — Built directly on MIT pixelfx Dual-Buffer Architecture!
// ZERO reused combat explosions / ZERO Duelyst battle skills!
// Every phase is custom-designed for Card Pack / Tarot Coffer opening following pixelfx authoring principles:
//   - Charging: rotating perspective rune ring (`band`) + inward converging starlight streaks + soft core glow
//   - Tear Reveal: razor-sharp starlight foil-cut beam + celestial `pickups/collect-burst` star rings +
//                  upward god-ray fan + fluttering multi-tone foil confetti & diamond glints (NO bomb explosion!)
//   - Card Reveal: bespoke rarity light pillars + floor perspective halos + gentle ascending star glints
(function () {
  window.MT = window.MT || {};

  const W = 1280;
  const H = 720;
  const VW = 320;
  const VH = 180;
  const VCX = 160;
  const VCY = 89;

  const PACK_THEMES = {
    pack_hero: {
      ramp: ['#12264a', '#1f5a9e', '#38a6e8', '#7ce8ff', '#d4f8ff', '#ffffff'],
      gold: ['#422608', '#965c14', '#e0a228', '#ffd966', '#fff2b0', '#ffffff'],
      confetti: ['#ffd966', '#7ce8ff', '#fff4c2', '#64b8ff', '#ffffff'],
      lightMain: '#6be5ff',
      lightAccent: '#ffd966'
    },
    pack_inscription: {
      ramp: ['#220c3b', '#561f8a', '#9640d6', '#d682ff', '#f2d0ff', '#ffffff'],
      gold: ['#4a1228', '#9e2652', '#e65888', '#ff9ec0', '#ffe0ec', '#ffffff'],
      confetti: ['#e28cff', '#ff80aa', '#ffd966', '#f2d4ff', '#ffffff'],
      lightMain: '#d67dff',
      lightAccent: '#ff7ca8'
    }
  };

  const TIER_PILLAR_STYLES = {
    SSS: {
      ramp: ['#4a0d24', '#9e1c48', '#eb4a78', '#ff8aa8', '#ffd966', '#ffffff'],
      col: '#ff6692',
      accent: '#ffd966',
      hw: 24,
      lightK: 0.52,
      burstPalette: ['#4a0d24', '#a81e4a', '#ff5286', '#ffd966', '#fff2b2', '#ffffff']
    },
    S: {
      ramp: ['#3d2406', '#8f5810', '#d99824', '#ffd24c', '#fff2b2', '#ffffff'],
      col: '#ffd24c',
      accent: '#fff4ba',
      hw: 21,
      lightK: 0.42,
      burstPalette: ['#3d2406', '#8f5810', '#e8a828', '#ffd966', '#fff4ba', '#ffffff']
    },
    A: {
      ramp: ['#240c40', '#5a2296', '#9a4ae0', '#d08eff', '#f2dcff', '#ffffff'],
      col: '#c47dff',
      accent: '#ebd0ff',
      hw: 18,
      lightK: 0.30,
      burstPalette: ['#240c40', '#6024a0', '#b460f5', '#dfa6ff', '#f5e4ff', '#ffffff']
    },
    B: {
      ramp: ['#0e2648', '#1e5896', '#3ca0e0', '#7ad8ff', '#d6f4ff', '#ffffff'],
      col: '#60c6ff',
      accent: '#c8ecff',
      hw: 15,
      lightK: 0.20,
      burstPalette: null
    },
    C: {
      ramp: ['#1c2436', '#3b4863', '#6e7f9e', '#a8b8d4', '#dce6f5', '#ffffff'],
      col: '#96a8c4',
      accent: '#e0e6f0',
      hw: 12,
      lightK: 0.12,
      burstPalette: null
    }
  };

  class PackCeremonyFX {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;

      this.off = document.createElement('canvas');
      this.off.width = VW;
      this.off.height = VH;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(VW, VH);

      this.frame = null;
      this.running = false;
      this.rafId = 0;
      this.lastTs = 0;
      this.time = 0;

      this.mode = 'idle'; // 'charging' | 'burst' | 'reveal'
      this.packId = 'pack_hero';
      this.theme = PACK_THEMES.pack_hero;

      this.tearElapsed = 0;
      this.tearActive = false;
      this.chargeLevel = 0;

      this.streamers = [];
      this.confetti = [];
      this.glints = [];
      this.burstInstances = [];
      this.pillars = [];

      this.reducedMotion = Boolean(
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    }

    _ensureFrame() {
      const PFX = window.MT && window.MT.PixelFX;
      if (!PFX) return null;
      if (!this.frame) {
        this.frame = PFX.createFrame(VW, VH, 0, 0);
      }
      return PFX;
    }

    startCharging(packId = 'pack_hero') {
      this.packId = packId;
      this.theme = PACK_THEMES[packId] || PACK_THEMES.pack_hero;
      this.mode = 'charging';
      this.time = 0;
      this.tearActive = false;
      this.tearElapsed = 0;
      this.chargeLevel = 0.35;
      this.confetti = [];
      this.glints = [];
      this.burstInstances = [];
      this.pillars = [];

      // Deterministic orbiting & converging starlight filaments around the sealed pack
      this.streamers = [];
      for (let i = 0; i < 32; i++) {
        this.streamers.push({
          angle: (Math.PI * 2 * i) / 32,
          radius: 36 + (i % 7) * 8,
          baseR: 36 + (i % 7) * 8,
          speed: (0.65 + (i % 5) * 0.22) * (i % 2 === 0 ? 1 : -1),
          yScale: 0.62 + (i % 3) * 0.08,
          phase: i * 0.77,
          star: i % 4 === 0,
          colIdx: i % 3 === 0 ? 1 : 0
        });
      }
      this._ensureLoop();
    }

    triggerTearBurst(packId) {
      if (packId) {
        this.packId = packId;
        this.theme = PACK_THEMES[packId] || PACK_THEMES.pack_hero;
      }
      this.mode = 'burst';
      this.tearActive = true;
      this.tearElapsed = 0;
      this.chargeLevel = 1.0;

      const PFX = this._ensureFrame();
      // Layer MIT pixelfx's celestial `pickups/collect-burst` (clean light rings + curving star twinkles — NO explosion!)
      if (PFX && PFX.EFFECTS && PFX.EFFECTS['pickups/collect-burst']) {
        const mod = PFX.EFFECTS['pickups/collect-burst'];
        this.burstInstances.push({
          fx: PFX.createFx(mod, { x: VCX, y: VCY + 4, palette: this.theme.gold, seed: 11, light: 1.25 }),
          speed: 1.05
        });
        this.burstInstances.push({
          fx: PFX.createFx(mod, { x: VCX, y: VCY - 6, palette: this.theme.ramp, seed: 29, light: 1.1 }),
          speed: 0.88
        });
      }

      // Celebratory Foil Confetti & Starlight Ribbons fanning UPWARD from the torn seal (not an explosive blast!)
      for (let i = 0; i < 64; i++) {
        const spread = (Math.random() - 0.5) * Math.PI * 1.15;
        const ang = -Math.PI / 2 + spread;
        const speed = 38 + Math.random() * 98;
        const isRibbon = i % 3 === 0;
        this.confetti.push({
          x: VCX + (Math.random() - 0.5) * 44,
          y: VCY - 16 + (Math.random() - 0.5) * 8,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 18,
          w: isRibbon ? 3 : 2,
          h: isRibbon ? 1 : 2,
          drag: 0.945,
          gravity: isRibbon ? 28 : 42,
          flutter: (Math.random() - 0.5) * 16,
          phase: Math.random() * Math.PI * 2,
          life: 0.9 + Math.random() * 0.9,
          maxLife: 1.8,
          col: this.theme.confetti[i % this.theme.confetti.length]
        });
      }

      // Crisp 4-point star glints popping along the cut seam
      for (let i = 0; i < 18; i++) {
        this.glints.push({
          x: VCX + (Math.random() - 0.5) * 124,
          y: VCY - 18 + (Math.random() - 0.5) * 34,
          maxArm: 3 + Math.random() * 5,
          delay: Math.random() * 0.22,
          life: 0.42 + Math.random() * 0.35,
          maxLife: 0.77,
          col: i % 2 === 0 ? this.theme.lightAccent : this.theme.lightMain
        });
      }
      this._ensureLoop();
    }

    startReveal(cardSpecs = []) {
      this.mode = 'reveal';
      this.pillars = [];
      const count = cardSpecs.length || 3;
      const totalSpan = count === 4 ? 260 : 202;
      const startX = VCX - totalSpan / 2 + totalSpan / (count * 2);
      const stepX = totalSpan / count;

      cardSpecs.forEach((spec, i) => {
        const vx = Math.round(startX + stepX * i);
        const tier = spec.tier || 'A';
        const style = TIER_PILLAR_STYLES[tier] || TIER_PILLAR_STYLES.A;
        this.pillars.push({
          vx,
          vy: 94,
          tier,
          style,
          delay: i * 0.11,
          elapsed: 0,
          bursted: false
        });
      });
      this._ensureLoop();
    }

    stop() {
      this.running = false;
      this.mode = 'idle';
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      this.burstInstances = [];
      if (this.ctx) this.ctx.clearRect(0, 0, W, H);
    }

    _ensureLoop() {
      if (!this.ctx || this.running) return;
      this.running = true;
      this.lastTs = performance.now();
      const tick = (now) => {
        if (!this.running) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTs) / 1000));
        this.lastTs = now;
        this._update(dt);
        this._render();
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    }

    _update(dt) {
      this.time += dt;
      if (this.mode === 'charging') {
        this.chargeLevel = Math.min(1, this.chargeLevel + dt * 0.45);
      }
      if (this.tearActive) {
        this.tearElapsed += dt;
        if (this.tearElapsed > 0.72) this.tearActive = false;
      }

      for (const s of this.streamers) {
        s.angle += s.speed * dt * (this.mode === 'charging' ? (1 + this.chargeLevel * 0.55) : 0.35);
      }

      for (let i = this.confetti.length - 1; i >= 0; i--) {
        const c = this.confetti[i];
        c.life -= dt;
        if (c.life <= 0) { this.confetti.splice(i, 1); continue; }
        c.vx *= Math.pow(c.drag, dt * 60);
        c.vy = c.vy * Math.pow(c.drag, dt * 60) + c.gravity * dt;
        c.x += (c.vx + Math.sin(this.time * 7 + c.phase) * c.flutter) * dt;
        c.y += c.vy * dt;
      }

      for (let i = this.glints.length - 1; i >= 0; i--) {
        const g = this.glints[i];
        if (g.delay > 0) { g.delay -= dt; continue; }
        g.life -= dt;
        if (g.life <= 0) this.glints.splice(i, 1);
      }

      // Gentle ambient ascending starlight motes behind revealed cards
      if (this.mode === 'reveal' && !this.reducedMotion && this.confetti.length < 30 && Math.random() < 0.35) {
        const pl = this.pillars.length ? this.pillars[Math.floor(Math.random() * this.pillars.length)] : null;
        this.confetti.push({
          x: pl ? (pl.vx + (Math.random() - 0.5) * 34) : (Math.random() * VW),
          y: 158 + Math.random() * 14,
          vx: (Math.random() - 0.5) * 5,
          vy: -(16 + Math.random() * 18),
          w: 1,
          h: 1,
          drag: 0.99,
          gravity: -2,
          flutter: 4,
          phase: Math.random() * Math.PI * 2,
          life: 1.3 + Math.random() * 0.8,
          maxLife: 2.1,
          col: pl ? pl.style.accent : this.theme.lightAccent
        });
      }

      const PFX = this._ensureFrame();
      for (const pl of this.pillars) {
        pl.elapsed += dt;
        if (!pl.bursted && pl.elapsed >= pl.delay) {
          pl.bursted = true;
          // Crisp star-ring reveal burst (pickups/collect-burst) on A / S / SSS cards — ZERO explosions!
          if (PFX && PFX.EFFECTS && PFX.EFFECTS['pickups/collect-burst'] && pl.style.burstPalette) {
            const mod = PFX.EFFECTS['pickups/collect-burst'];
            this.burstInstances.push({
              fx: PFX.createFx(mod, {
                x: pl.vx,
                y: pl.vy + 18,
                palette: pl.style.burstPalette,
                seed: 7 + pl.vx,
                light: pl.tier === 'SSS' ? 1.25 : 0.95
              }),
              speed: 1.15
            });
          }
          // Add extra celebratory twinkle glints above S / SSS cards
          if (pl.tier === 'S' || pl.tier === 'SSS') {
            for (let k = 0; k < (pl.tier === 'SSS' ? 6 : 4); k++) {
              this.glints.push({
                x: pl.vx + (Math.random() - 0.5) * 40,
                y: 36 + Math.random() * 98,
                maxArm: pl.tier === 'SSS' ? 6 : 4,
                delay: k * 0.06,
                life: 0.55,
                maxLife: 0.55,
                col: k % 2 === 0 ? pl.style.accent : pl.style.col
              });
            }
          }
        }
      }

      for (let i = this.burstInstances.length - 1; i >= 0; i--) {
        const b = this.burstInstances[i];
        b.fx.update(dt * b.speed);
        if (b.fx.done()) this.burstInstances.splice(i, 1);
      }
    }

    _render() {
      const ctx = this.ctx;
      const PFX = this._ensureFrame();
      if (!ctx || !PFX || !this.frame) return;

      PFX.clearFrame(this.frame);
      const p = PFX.painterFor(this.frame);
      p.place(0, 0, false, 0);

      const t = this.time;
      const mainC = PFX.hex(this.theme.lightMain);
      const accC = PFX.hex(this.theme.lightAccent);
      const whiteC = PFX.WHITE;
      const rampC = this.theme.ramp.map(PFX.hex);
      const goldC = this.theme.gold.map(PFX.hex);

      // 1. CHARGING PHASE: Soft luminous halo + perspective pixel rune orbit (`band`) + orbiting starlight motes
      if (this.mode === 'charging') {
        const breathe = 0.78 + 0.22 * Math.sin(t * 2.8);
        p.glow(VCX, VCY, 76, mainC, 0.22 * breathe * this.chargeLevel);
        p.glow(VCX, VCY - 4, 40, accC, 0.26 * breathe * this.chargeLevel);

        // Tilted outer celestial band (drawn via pixelfx `band` helper!)
        const allArc = () => true;
        PFX.band(p, VCX, VCY + 44, 54, 0.22, 1.4, 0.55 * breathe, rampC, allArc, 0.5);
        PFX.band(p, VCX, VCY + 44, 38, 0.22, 1.0, 0.48 * breathe, goldC, allArc, 0.4);

        // Subtle rotating starlight filaments (lines & light, zero muddy fills!)
        for (const s of this.streamers) {
          const rNow = s.radius + Math.sin(t * 2.4 + s.phase) * 4;
          const mx = VCX + Math.cos(s.angle) * rNow;
          const my = VCY + Math.sin(s.angle) * rNow * s.yScale;
          const tw = 0.45 + 0.55 * Math.sin(t * 5.2 + s.phase);
          const col = s.colIdx === 1 ? accC : mainC;
          if (s.star && tw > 0.65) {
            PFX.sparkle(p, mx, my, 2.6 * tw, whiteC, col, 0.55 * tw);
          } else {
            p.dot(mx, my, col, 0.55 + tw * 0.4);
            p.glow(mx, my, 4, col, 0.22 * tw);
          }
        }
      }

      // 2. TEAR REVEAL PHASE: Razor Starlight Seam Cut + Upward Celestial Fan Rays (ZERO bomb explosion!)
      if (this.tearActive) {
        const u = Math.min(1, this.tearElapsed / 0.72);
        const seamY = VCY - 18;

        // Soft expanding light bloom from the split foil seam
        const bloomK = Math.sin(Math.min(1, u * 1.4) * Math.PI) * 0.65;
        p.glow(VCX, seamY, 96, accC, bloomK * 0.65);
        p.glow(VCX, seamY, 54, whiteC, bloomK * 0.55);

        // Upward fanning celestial starlight shafts (like opening a sacred card folio)
        if (u < 0.85) {
          const rayFade = Math.sin((u / 0.85) * Math.PI);
          for (let i = -4; i <= 4; i++) {
            const ang = -Math.PI / 2 + i * 0.19 + Math.sin(t * 2 + i) * 0.03;
            const len = (52 + (4 - Math.abs(i)) * 16) * (0.45 + 0.55 * Math.min(1, u * 2.6));
            const x1 = VCX + Math.cos(ang) * len;
            const y1 = seamY + Math.sin(ang) * len;
            const col = i % 2 === 0 ? accC : mainC;
            p.glowLine(VCX + i * 3, seamY, x1, y1, 5, col, 0.24 * rayFade);
            p.line(VCX + i * 3, seamY, x1, y1, (v) => (v < 0.35 ? whiteC : col), (v) => (1 - v) * 0.68 * rayFade);
          }
        }

        // Crisp horizontal razor foil-rip light blade (snaps out fast, then narrows into a glint line)
        if (u < 0.48) {
          const su = u / 0.48;
          const halfW = 128 * PFX.ease.outExpo(Math.min(1, su * 2.4));
          const fade = 1 - PFX.smooth(0.35, 1, su);
          p.glowLine(VCX - halfW, seamY + 3, VCX + halfW, seamY - 3, 7 * fade + 1, mainC, 0.55 * fade);
          p.line(VCX - halfW, seamY + 3, VCX + halfW, seamY - 3, whiteC, fade);
          if (fade > 0.2) {
            PFX.flare(p, VCX, seamY, 24 * fade, 0.85 * fade, goldC);
          }
        }
      }

      // 3. CARD REVEAL PHASE: Bespoke Dual-Buffer Rarity Light Pillars & Floor Perspective Halos
      if (this.mode === 'reveal') {
        for (const pl of this.pillars) {
          if (pl.elapsed < pl.delay) continue;
          const fadeIn = Math.min(1, (pl.elapsed - pl.delay) / 0.28);
          const breathe = 0.86 + 0.14 * Math.sin(t * 3.1 + pl.vx * 0.09);
          const st = pl.style;
          const pCol = PFX.hex(st.col);
          const pAcc = PFX.hex(st.accent);
          const pRamp = st.ramp.map(PFX.hex);

          // Soft luminous vertical pillar using additive light buffer (looks genuinely radiant, never flat!)
          p.glowLine(pl.vx, 22, pl.vx, 158, st.hw * 1.15, pCol, st.lightK * fadeIn * breathe);
          p.glowLine(pl.vx, 34, pl.vx, 148, st.hw * 0.45, pAcc, st.lightK * 0.65 * fadeIn * breathe);

          // Subtle shimmering center filament inside S & SSS pillars
          const allArc = () => true;
          if (pl.tier === 'S' || pl.tier === 'SSS') {
            p.line(pl.vx, 28, pl.vx, 152, pAcc, (v) => Math.sin(v * Math.PI) * 0.42 * fadeIn * breathe);
            PFX.band(p, pl.vx, 154, st.hw + 2, 0.22, 1.3, 0.55 * fadeIn * breathe, pRamp, allArc, 0.5);
          } else {
            PFX.band(p, pl.vx, 154, st.hw, 0.22, 1.0, 0.35 * fadeIn * breathe, pRamp, allArc, 0.25);
          }
        }
      }

      // 4. Composite MIT pixelfx `pickups/collect-burst` star rings into the same dual buffer
      for (const b of this.burstInstances) {
        b.fx.draw(this.frame);
      }

      // Reset painter origin back to (0, 0) since b.fx.draw() repositions the shared frame painter!
      p.place(0, 0, false, 0);

      // 5. Fluttering Pixel Foil Confetti & Star Glints
      for (const c of this.confetti) {
        const a = Math.max(0, Math.min(1, c.life / 0.45));
        const col = PFX.hex(c.col);
        const flipW = Math.max(1, Math.round(c.w * (0.4 + 0.6 * Math.abs(Math.cos(t * 10 + c.phase)))));
        p.rect(Math.round(c.x), Math.round(c.y), flipW, c.h, col, a);
        if (a > 0.45) p.glow(c.x, c.y, 3, col, 0.22 * a);
      }

      for (const g of this.glints) {
        if (g.delay > 0) continue;
        const u = 1 - g.life / g.maxLife;
        const arm = g.maxArm * Math.sin(u * Math.PI);
        if (arm > 0.6) {
          PFX.sparkle(p, g.x, g.y, arm, whiteC, PFX.hex(g.col), 0.72 * Math.sin(u * Math.PI));
        }
      }

      // 6. Dual-Buffer Composite (Color + Additive Light) -> exact 4x integer blit to 1280x720!
      PFX.composite(this.frame, this.imgData.data, null, 1.15);
      this.offCtx.putImageData(this.imgData, 0, 0);

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.off, 0, 0, VW, VH, 0, 0, W, H);
      ctx.restore();
    }
  }

  window.MT.PackCeremonyFX = PackCeremonyFX;
})();
