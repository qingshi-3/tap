// v15.5 Strict Pixel-Grid Pack Opening Ceremony VFX Engine (320x180 -> 4x integer blit to 1280x720)
// ZERO smooth vector concentric arcs, ZERO blurry flat ellipses!
// All rays, rune circles, light-blade tear slashes, octagonal shockwaves, rarity pillars & sparks
// are rendered onto a crisp 320x180 pixelfx-style buffer with Bayer ordered dithering.
(function () {
  window.MT = window.MT || {};

  const W = 1280;
  const H = 720;
  const VW = 320;
  const VH = 180;
  const VCX = 160;
  const VCY = 89;
  const CX = 640;
  const CY = 356;

  const BAYER4 = [
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
  ];

  function bayerPass(x, y, a) {
    return a > (BAYER4[y & 3][x & 3] + 0.5) / 16;
  }

  const PACK_PALETTES = {
    pack_hero: {
      primary: '#6be5ff',
      secondary: '#ffd966',
      deep: '#1f64a8',
      core: '#ffffff',
      burstFx: ['fx_f6_winterswake', 'fxExplosionBigWhiteHot', 'fx_f2_twilightreiki']
    },
    pack_inscription: {
      primary: '#e07dff',
      secondary: '#ff6b98',
      deep: '#6b249e',
      core: '#fff0ff',
      burstFx: ['fx_f4_shadownova', 'fx_f2_heavenseclipse', 'fxExplosionBigWhiteHot']
    }
  };

  const TIER_PILLAR_STYLES = {
    SSS: { main: '#ff5286', mid: '#c42458', accent: '#ffd966', vw: 48, alpha: 0.52, fx: 'fx_f2_heavenseclipse' },
    S:   { main: '#ffd24c', mid: '#c48622', accent: '#fff4ba', vw: 42, alpha: 0.42, fx: 'fx_f1_holyimmolation' },
    A:   { main: '#c47dff', mid: '#7834b8', accent: '#ebd0ff', vw: 36, alpha: 0.30, fx: 'fx_f2_twilightreiki' },
    B:   { main: '#60c6ff', mid: '#266ea8', accent: '#c8ecff', vw: 30, alpha: 0.20, fx: 'fxBuffSimpleGold' },
    C:   { main: '#96a8c4', mid: '#48556e', accent: '#e0e6f0', vw: 24, alpha: 0.12, fx: null }
  };

  class PackCeremonyFX {
    constructor(canvas, vfx) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.vfx = vfx || window.MT.vfx || null;

      this.pxCanvas = document.createElement('canvas');
      this.pxCanvas.width = VW;
      this.pxCanvas.height = VH;
      this.pxCtx = this.pxCanvas.getContext('2d');
      this.pxCtx.imageSmoothingEnabled = false;

      this.running = false;
      this.rafId = 0;
      this.lastTs = 0;
      this.time = 0;

      this.mode = 'idle'; // 'charging' | 'burst' | 'reveal'
      this.packId = 'pack_hero';
      this.palette = PACK_PALETTES.pack_hero;

      this.flashAlpha = 0;
      this.slashLife = 0;
      this.slashMax = 0.36;
      this.chargeIntensity = 0;

      this.orbitMotes = [];
      this.particles = [];
      this.shockwaves = [];
      this.vfxInstances = [];
      this.pillars = [];

      this.reducedMotion = Boolean(
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    }

    startCharging(packId = 'pack_hero') {
      this.packId = packId;
      this.palette = PACK_PALETTES[packId] || PACK_PALETTES.pack_hero;
      this.mode = 'charging';
      this.time = 0;
      this.flashAlpha = 0;
      this.slashLife = 0;
      this.chargeIntensity = 0.4;
      this.particles = [];
      this.shockwaves = [];
      this.vfxInstances = [];
      this.pillars = [];

      this.orbitMotes = [];
      for (let i = 0; i < 36; i++) {
        this.orbitMotes.push({
          angle: (Math.PI * 2 * i) / 36 + (i % 3) * 0.12,
          radius: 34 + (i % 7) * 7.5,
          speed: (0.7 + (i % 5) * 0.24) * (i % 2 === 0 ? 1 : -1),
          yScale: 0.65 + (i % 3) * 0.08,
          big: i % 5 === 0,
          color: i % 3 === 0 ? this.palette.secondary : (i % 5 === 0 ? '#ffffff' : this.palette.primary),
          phase: i * 0.71
        });
      }
      this._ensureLoop();
    }

    triggerTearBurst(packId) {
      if (packId) {
        this.packId = packId;
        this.palette = PACK_PALETTES[packId] || PACK_PALETTES.pack_hero;
      }
      this.mode = 'burst';
      this.flashAlpha = 0.78;
      this.slashLife = this.slashMax;
      this.chargeIntensity = 1.0;

      // Pixel-stepped octagonal expanding shockwaves (NO smooth concentric vector arcs!)
      this.shockwaves.push(
        { x: VCX, y: VCY, r: 6, maxR: 118, life: 0.44, maxLife: 0.44, sides: 8, rot: 0, color: '#ffffff' },
        { x: VCX, y: VCY, r: 4, maxR: 92,  life: 0.54, maxLife: 0.54, sides: 8, rot: Math.PI / 8, color: this.palette.secondary },
        { x: VCX, y: VCY, r: 3, maxR: 72,  life: 0.62, maxLife: 0.62, sides: 6, rot: 0.2, color: this.palette.primary }
      );

      // Real Duelyst H5 Burst VFX layered at center
      const vfx = this.vfx || window.MT.vfx;
      if (vfx && vfx.createInstance) {
        const keys = this.palette.burstFx || [];
        keys.forEach((k, idx) => {
          const inst = vfx.createInstance(k, CX, CY - (idx === 0 ? 8 : 0), {
            scale: idx === 0 ? 2.4 : 2.0,
            speedMult: idx === 0 ? 1.25 : 1.4,
            blend: 'lighter'
          });
          if (inst) this.vfxInstances.push(inst);
        });
      }

      // 84 crisp pixel sparks & shards in 320x180 coordinates
      for (let i = 0; i < 84; i++) {
        const ang = (Math.PI * 2 * i) / 84 + (Math.random() - 0.5) * 0.24;
        const speed = 44 + Math.random() * 138;
        const isShard = i % 3 === 0;
        this.particles.push({
          x: VCX + (Math.random() - 0.5) * 18,
          y: VCY - 6 + (Math.random() - 0.5) * 12,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 22,
          gravity: isShard ? 68 : 115,
          drag: 0.94,
          size: isShard ? 2 : 1,
          life: 0.55 + Math.random() * 0.65,
          maxLife: 1.2,
          color: i % 4 === 0 ? '#ffffff' : (i % 2 === 0 ? this.palette.secondary : this.palette.primary)
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
          vy: 92,
          x: vx * 4,
          y: 368,
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
        this.chargeIntensity = Math.min(1, this.chargeIntensity + dt * 0.45);
      }
      if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.6);
      if (this.slashLife > 0) this.slashLife = Math.max(0, this.slashLife - dt);

      for (const m of this.orbitMotes) {
        m.angle += m.speed * dt * (this.mode === 'charging' ? (1 + this.chargeIntensity * 0.7) : 0.4);
      }

      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.life -= dt;
        if (sw.life <= 0) { this.shockwaves.splice(i, 1); continue; }
        const prog = 1 - sw.life / sw.maxLife;
        const ease = 1 - Math.pow(1 - prog, 3);
        sw.r = 5 + (sw.maxR - 5) * ease;
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      // Gentle ambient rising pixel motes strictly behind reveal cards
      if (this.mode === 'reveal' && !this.reducedMotion && this.particles.length < 36 && Math.random() < 0.38) {
        const pl = this.pillars.length ? this.pillars[Math.floor(Math.random() * this.pillars.length)] : null;
        this.particles.push({
          x: pl ? (pl.vx + (Math.random() - 0.5) * 32) : (Math.random() * VW),
          y: 152 + Math.random() * 20,
          vx: (Math.random() - 0.5) * 6,
          vy: -(14 + Math.random() * 18),
          gravity: -2,
          drag: 0.99,
          size: 1,
          life: 1.2 + Math.random() * 0.9,
          maxLife: 2.1,
          color: pl ? pl.style.accent : this.palette.secondary
        });
      }

      const vfx = this.vfx || window.MT.vfx;
      for (const pl of this.pillars) {
        pl.elapsed += dt;
        if (!pl.bursted && pl.elapsed >= pl.delay) {
          pl.bursted = true;
          if (pl.tier === 'S' || pl.tier === 'SSS' || pl.tier === 'A') {
            this.shockwaves.push({
              x: pl.vx, y: pl.vy, r: 4,
              maxR: pl.tier === 'SSS' ? 54 : (pl.tier === 'S' ? 42 : 30),
              life: 0.45, maxLife: 0.45, sides: 8, rot: 0, color: pl.style.accent
            });
            if (vfx && vfx.createInstance && pl.style.fx) {
              const inst = vfx.createInstance(pl.style.fx, pl.x, pl.y - 16, {
                scale: pl.tier === 'SSS' ? 2.0 : (pl.tier === 'S' ? 1.7 : 1.35),
                speedMult: 1.35,
                blend: 'lighter'
              });
              if (inst) this.vfxInstances.push(inst);
            }
          }
        }
      }

      if (vfx && vfx.update) {
        for (let i = this.vfxInstances.length - 1; i >= 0; i--) {
          vfx.update(this.vfxInstances[i], dt);
          if (this.vfxInstances[i].done) this.vfxInstances.splice(i, 1);
        }
      }
    }

    _drawPixelLine(pctx, x0, y0, x1, y1, col) {
      x0 = Math.round(x0); y0 = Math.round(y0);
      x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      pctx.fillStyle = col;
      for (let guard = 0; guard < 360; guard++) {
        pctx.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }

    _render() {
      const ctx = this.ctx;
      const pctx = this.pxCtx;
      if (!ctx || !pctx) return;

      ctx.clearRect(0, 0, W, H);
      pctx.clearRect(0, 0, VW, VH);

      const t = this.time;

      // 1. Stepped Pixel Starburst Rays (strict 320x180 Bayer-dithered pixel beams, zero smooth cones!)
      if (this.mode === 'charging' || this.mode === 'burst') {
        const rayCount = this.mode === 'burst' ? 16 : 12;
        const maxLen = this.mode === 'burst' ? 145 : 95;
        for (let i = 0; i < rayCount; i++) {
          const ang = (Math.PI * 2 * i) / rayCount + t * (i % 2 === 0 ? 0.28 : -0.18);
          const col = i % 2 === 0 ? this.palette.primary : this.palette.secondary;
          for (let r = 18; r < maxLen; r += 2) {
            const fade = (1 - r / maxLen) * (this.mode === 'burst' ? 0.72 : 0.34);
            const px = Math.round(VCX + Math.cos(ang) * r);
            const py = Math.round(VCY + Math.sin(ang) * r);
            if (!bayerPass(px, py, fade)) continue;
            pctx.fillStyle = col;
            pctx.fillRect(px, py, 1, 1);
          }
        }
      }

      // 2. Charging Stepped Pixel Rune Ring & Orbiting Diamond Motes
      if (this.mode === 'charging') {
        const ringR = 52;
        for (let k = 0; k < 48; k++) {
          if (k % 3 === 0) continue; // stepped rune dash gaps
          const a = (k / 48) * Math.PI * 2 + t * 0.6;
          const px = Math.round(VCX + Math.cos(a) * ringR);
          const py = Math.round(VCY + Math.sin(a) * ringR);
          pctx.fillStyle = k % 2 === 0 ? this.palette.primary : this.palette.secondary;
          pctx.globalAlpha = 0.65;
          pctx.fillRect(px, py, 1, 1);
        }
        pctx.globalAlpha = 1;
        for (const m of this.orbitMotes) {
          const mx = Math.round(VCX + Math.cos(m.angle) * m.radius);
          const my = Math.round(VCY + Math.sin(m.angle) * m.radius * m.yScale);
          const tw = 0.5 + 0.5 * Math.sin(t * 6 + m.phase);
          pctx.fillStyle = m.color;
          pctx.globalAlpha = 0.35 + tw * 0.65;
          pctx.fillRect(mx, my, 1, 1);
          if (m.big && tw > 0.6) {
            pctx.fillRect(mx - 1, my, 3, 1);
            pctx.fillRect(mx, my - 1, 1, 3);
          }
        }
        pctx.globalAlpha = 1;
      }

      // 3. Pixel-Dithered Vertical Rarity Light Pillars during Reveal
      if (this.mode === 'reveal') {
        for (const pl of this.pillars) {
          if (pl.elapsed < pl.delay) continue;
          const fadeIn = Math.min(1, (pl.elapsed - pl.delay) / 0.25);
          const breathe = 0.85 + 0.15 * Math.sin(t * 3.5 + pl.vx * 0.08);
          const hw = Math.floor(pl.style.vw / 2);
          for (let py = 18; py < 164; py += 2) {
            const vFade = Math.sin(((py - 18) / 146) * Math.PI);
            for (let dx = -hw; dx <= hw; dx++) {
              const hFade = 1 - Math.abs(dx) / (hw + 1);
              const density = pl.style.alpha * fadeIn * breathe * hFade * hFade * vFade;
              if (!bayerPass(pl.vx + dx, py, density)) continue;
              pctx.fillStyle = Math.abs(dx) < hw * 0.32 ? pl.style.accent : (Math.abs(dx) < hw * 0.68 ? pl.style.main : pl.style.mid);
              pctx.fillRect(pl.vx + dx, py, 1, 2);
            }
          }
        }
      }

      // 4. Stepped Pixel Light-Blade Rip Slash (sharp pixel blade + star glints, ZERO flat smooth ellipse!)
      if (this.slashLife > 0) {
        const p = this.slashLife / this.slashMax;
        const sy = VCY - 22;
        const halfLen = Math.round(125 * (1.15 - p * 0.35));
        const maxThick = Math.max(1, Math.round(5 * p));
        for (let dx = -halfLen; dx <= halfLen; dx++) {
          const u = 1 - Math.abs(dx) / Math.max(1, halfLen);
          const thick = Math.max(1, Math.round(u * u * maxThick));
          const yOff = Math.round(dx * -0.05);
          pctx.fillStyle = u > 0.55 ? '#ffffff' : (u > 0.25 ? this.palette.primary : this.palette.secondary);
          pctx.fillRect(VCX + dx, sy + yOff - Math.floor(thick / 2), 1, thick);
        }
        // Crisp 4-point pixel flare star at tear center
        const starR = Math.round(14 * p);
        pctx.fillStyle = '#ffffff';
        pctx.fillRect(VCX - starR, sy, starR * 2 + 1, 1);
        pctx.fillRect(VCX, sy - starR, 1, starR * 2 + 1);
      }

      // 5. Pixel-Stepped Octagonal Shockwaves (Bresenham crisp pixel edges!)
      for (const sw of this.shockwaves) {
        const a = Math.max(0, sw.life / sw.maxLife);
        pctx.globalAlpha = a * 0.92;
        const pts = [];
        for (let k = 0; k < sw.sides; k++) {
          const ang = (k / sw.sides) * Math.PI * 2 + sw.rot;
          pts.push([sw.x + Math.cos(ang) * sw.r, sw.y + Math.sin(ang) * sw.r]);
        }
        for (let k = 0; k < sw.sides; k++) {
          const [x0, y0] = pts[k];
          const [x1, y1] = pts[(k + 1) % sw.sides];
          this._drawPixelLine(pctx, x0, y0, x1, y1, sw.color);
        }
        pctx.globalAlpha = 1;
      }

      // 6. Crisp Pixel Sparks & Shards
      for (const p of this.particles) {
        const a = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.55)));
        pctx.globalAlpha = a;
        pctx.fillStyle = p.color;
        pctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      pctx.globalAlpha = 1;

      // Blit 320x180 pixel VFX canvas onto 1280x720 at exact 4x integer scale!
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.pxCanvas, 0, 0, VW, VH, 0, 0, W, H);
      ctx.restore();

      // 7. Real Duelyst H5 Keyed Pixel Burst VFX on top
      const vfx = this.vfx || window.MT.vfx;
      if (vfx && vfx.draw) {
        for (const inst of this.vfxInstances) vfx.draw(ctx, inst);
      }

      // 8. Brief crisp opening flash (fades fast, never milky)
      if (this.flashAlpha > 0.02) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 248, 224, ${(this.flashAlpha * 0.42).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
  }

  window.MT.PackCeremonyFX = PackCeremonyFX;
})();
