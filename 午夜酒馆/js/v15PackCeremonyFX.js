// v15.3 HD-2D Pack Opening Ceremony VFX Engine (#pack-fx-canvas, 1280x720)
// Drives 3 dramatic stages:
//   1. 'charging': rotating volumetric god-rays, orbiting rune motes, energy convergence around sealed pack
//   2. 'burst':    horizontal light-blade rip slash, real Duelyst H5 burst VFX, triple shockwaves,
//                  screen flash, 90+ foil confetti & pixel sparks
//   3. 'reveal':   persistent ambient god-rays + per-card vertical rarity light pillars (S gold / SSS crimson-gold / A violet)
//                  + staggered card landing Duelyst VFX bursts
(function () {
  window.MT = window.MT || {};

  const W = 1280;
  const H = 720;
  const CX = 640;
  const CY = 356;

  const PACK_PALETTES = {
    pack_hero: {
      primary: '#6be5ff',
      secondary: '#ffd966',
      core: '#ffffff',
      rayRgba: [94, 210, 255],
      burstFx: ['fx_f6_winterswake', 'fxExplosionBigWhiteHot', 'fx_f2_twilightreiki']
    },
    pack_inscription: {
      primary: '#e07dff',
      secondary: '#ff5c8a',
      core: '#fff0ff',
      rayRgba: [212, 108, 255],
      burstFx: ['fx_f4_shadownova', 'fx_f2_heavenseclipse', 'fxExplosionBigWhiteHot']
    }
  };

  const TIER_PILLAR_STYLES = {
    SSS: { rgb: [255, 76, 134], accent: '#ffd966', width: 210, alpha: 0.42, fx: 'fx_f2_heavenseclipse' },
    S:   { rgb: [255, 210, 76], accent: '#fff4ba', width: 185, alpha: 0.34, fx: 'fx_f1_holyimmolation' },
    A:   { rgb: [192, 122, 255], accent: '#e7c6ff', width: 155, alpha: 0.22, fx: 'fx_f2_twilightreiki' },
    B:   { rgb: [96, 198, 255], accent: '#c8ecff', width: 130, alpha: 0.14, fx: 'fxBuffSimpleGold' },
    C:   { rgb: [180, 192, 214], accent: '#e0e6f0', width: 110, alpha: 0.08, fx: null }
  };

  class PackCeremonyFX {
    constructor(canvas, vfx) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.vfx = vfx || window.MT.vfx || null;

      this.running = false;
      this.rafId = 0;
      this.lastTs = 0;
      this.time = 0;

      this.mode = 'idle'; // 'charging' | 'burst' | 'reveal'
      this.packId = 'pack_hero';
      this.palette = PACK_PALETTES.pack_hero;

      this.flashAlpha = 0;
      this.slashLife = 0;
      this.slashMax = 0.42;
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
      this.chargeIntensity = 0.35;
      this.particles = [];
      this.shockwaves = [];
      this.vfxInstances = [];
      this.pillars = [];

      this.orbitMotes = [];
      for (let i = 0; i < 42; i++) {
        this.orbitMotes.push({
          angle: (Math.PI * 2 * i) / 42 + Math.random() * 0.4,
          radius: 135 + Math.random() * 210,
          speed: (0.75 + Math.random() * 1.15) * (i % 2 === 0 ? 1 : -1),
          size: i % 4 === 0 ? 5 : 3,
          yScale: 0.62 + Math.random() * 0.25,
          color: i % 3 === 0 ? this.palette.secondary : (i % 5 === 0 ? '#ffffff' : this.palette.primary),
          phase: Math.random() * Math.PI * 2
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
      this.flashAlpha = 0.88;
      this.slashLife = this.slashMax;
      this.chargeIntensity = 1.0;

      // Triple expanding shockwave rings
      this.shockwaves.push(
        { x: CX, y: CY, r: 22, maxR: 540, life: 0.56, maxLife: 0.56, lineW: 10, color: '#ffffff' },
        { x: CX, y: CY, r: 16, maxR: 460, life: 0.68, maxLife: 0.68, lineW: 6, color: this.palette.secondary },
        { x: CX, y: CY, r: 10, maxR: 380, life: 0.78, maxLife: 0.78, lineW: 4, color: this.palette.primary }
      );

      // Real Duelyst H5 Burst VFX layered at center
      const vfx = this.vfx || window.MT.vfx;
      if (vfx && vfx.createInstance) {
        const keys = this.palette.burstFx || [];
        keys.forEach((k, idx) => {
          const inst = vfx.createInstance(k, CX, CY - (idx === 0 ? 12 : 0), {
            scale: idx === 0 ? 2.85 : 2.25,
            speedMult: idx === 0 ? 1.05 : 1.25,
            blend: 'lighter'
          });
          if (inst) this.vfxInstances.push(inst);
        });
      }

      // 96 high-energy sparks & foil confetti shards exploding outward
      for (let i = 0; i < 96; i++) {
        const ang = (Math.PI * 2 * i) / 96 + (Math.random() - 0.5) * 0.25;
        const speed = 170 + Math.random() * 540;
        const isFoil = i % 3 === 0;
        this.particles.push({
          x: CX + (Math.random() - 0.5) * 80,
          y: CY - 30 + (Math.random() - 0.5) * 50,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 90,
          gravity: isFoil ? 240 : 420,
          drag: isFoil ? 0.96 : 0.94,
          size: isFoil ? (6 + Math.random() * 5) : (3 + Math.random() * 4),
          isFoil,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 14,
          life: 0.65 + Math.random() * 0.85,
          maxLife: 1.5,
          color: i % 4 === 0 ? '#fff9d6' : (i % 2 === 0 ? this.palette.secondary : this.palette.primary)
        });
      }

      this._ensureLoop();
    }

    startReveal(cardSpecs = []) {
      this.mode = 'reveal';
      this.pillars = [];
      const count = cardSpecs.length || 3;
      const totalSpan = count === 4 ? 1040 : 810;
      const startX = CX - totalSpan / 2 + totalSpan / (count * 2);
      const stepX = totalSpan / count;

      cardSpecs.forEach((spec, i) => {
        const x = startX + stepX * i;
        const tier = spec.tier || 'A';
        const style = TIER_PILLAR_STYLES[tier] || TIER_PILLAR_STYLES.A;
        this.pillars.push({
          x,
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
      if (this.ctx) {
        this.ctx.clearRect(0, 0, W, H);
      }
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
      if (this.flashAlpha > 0) {
        this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.1);
      }
      if (this.slashLife > 0) {
        this.slashLife = Math.max(0, this.slashLife - dt);
      }

      // Orbit motes
      for (const m of this.orbitMotes) {
        m.angle += m.speed * dt * (this.mode === 'charging' ? (1 + this.chargeIntensity * 0.8) : 0.45);
      }

      // Shockwaves
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.life -= dt;
        if (sw.life <= 0) {
          this.shockwaves.splice(i, 1);
          continue;
        }
        const prog = 1 - sw.life / sw.maxLife;
        const ease = 1 - Math.pow(1 - prog, 3);
        sw.r = 18 + (sw.maxR - 18) * ease;
      }

      // Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
      }

      // Ambient rising sparks in reveal mode
      if (this.mode === 'reveal' && !this.reducedMotion && this.particles.length < 48 && Math.random() < 0.45) {
        const pickPillar = this.pillars.length > 0 ? this.pillars[Math.floor(Math.random() * this.pillars.length)] : null;
        const spawnX = pickPillar ? (pickPillar.x + (Math.random() - 0.5) * 140) : (Math.random() * W);
        this.particles.push({
          x: spawnX,
          y: 590 + Math.random() * 80,
          vx: (Math.random() - 0.5) * 24,
          vy: -(45 + Math.random() * 70),
          gravity: -10,
          drag: 0.99,
          size: Math.random() < 0.35 ? 4 : 2.5,
          isFoil: false,
          rot: 0,
          vrot: 0,
          life: 1.4 + Math.random() * 1.1,
          maxLife: 2.5,
          color: pickPillar ? pickPillar.style.accent : this.palette.secondary
        });
      }

      // Staggered per-card landing bursts
      const vfx = this.vfx || window.MT.vfx;
      for (const pl of this.pillars) {
        pl.elapsed += dt;
        if (!pl.bursted && pl.elapsed >= pl.delay) {
          pl.bursted = true;
          if (pl.tier === 'S' || pl.tier === 'SSS' || pl.tier === 'A') {
            this.shockwaves.push({
              x: pl.x,
              y: pl.y,
              r: 14,
              maxR: pl.tier === 'SSS' ? 230 : (pl.tier === 'S' ? 185 : 130),
              life: 0.55,
              maxLife: 0.55,
              lineW: pl.tier === 'SSS' ? 6 : 4,
              color: pl.style.accent
            });
            if (vfx && vfx.createInstance && pl.style.fx) {
              const inst = vfx.createInstance(pl.style.fx, pl.x, pl.y - 20, {
                scale: pl.tier === 'SSS' ? 2.15 : (pl.tier === 'S' ? 1.85 : 1.45),
                speedMult: 1.15,
                blend: 'lighter'
              });
              if (inst) this.vfxInstances.push(inst);
            }
            const sparkCount = pl.tier === 'SSS' ? 28 : (pl.tier === 'S' ? 18 : 10);
            for (let k = 0; k < sparkCount; k++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 80 + Math.random() * 210;
              this.particles.push({
                x: pl.x,
                y: pl.y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd - 65,
                gravity: 210,
                drag: 0.95,
                size: 3 + Math.random() * 3,
                isFoil: k % 3 === 0,
                rot: Math.random() * 6,
                vrot: (Math.random() - 0.5) * 10,
                life: 0.65 + Math.random() * 0.55,
                maxLife: 1.2,
                color: k % 2 === 0 ? pl.style.accent : '#ffffff'
              });
            }
          }
        }
      }

      // Update Duelyst VFX instances
      if (vfx && vfx.update) {
        for (let i = this.vfxInstances.length - 1; i >= 0; i--) {
          vfx.update(this.vfxInstances[i], dt);
          if (this.vfxInstances[i].done) {
            this.vfxInstances.splice(i, 1);
          }
        }
      }
    }

    _render() {
      const ctx = this.ctx;
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      const [rr, rg, rb] = this.palette.rayRgba;

      // 1. Rotating Volumetric God-Rays
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(CX, CY);
      const rayCount = this.mode === 'charging' ? 14 : 10;
      const baseAlpha = this.mode === 'charging'
        ? (0.08 + this.chargeIntensity * 0.12)
        : (this.mode === 'burst' ? 0.24 : 0.085);
      for (let i = 0; i < rayCount; i++) {
        const ang = (Math.PI * 2 * i) / rayCount + this.time * (i % 2 === 0 ? 0.22 : -0.14);
        const halfW = (i % 3 === 0 ? 0.11 : 0.055);
        const len = 760;
        const g = ctx.createLinearGradient(0, 0, Math.cos(ang) * len, Math.sin(ang) * len);
        g.addColorStop(0, `rgba(${rr}, ${rg}, ${rb}, ${baseAlpha.toFixed(3)})`);
        g.addColorStop(0.55, `rgba(${rr}, ${rg}, ${rb}, ${(baseAlpha * 0.32).toFixed(3)})`);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang - halfW) * len, Math.sin(ang - halfW) * len);
        ctx.lineTo(Math.cos(ang + halfW) * len, Math.sin(ang + halfW) * len);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 2. Charging Magic Ring + Orbiting Runes behind Sealed Pack
      if (this.mode === 'charging') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.88 + Math.sin(this.time * 5.2) * 0.12;
        const halo = ctx.createRadialGradient(CX, CY, 24, CX, CY, 285 * pulse);
        halo.addColorStop(0, `rgba(${rr}, ${rg}, ${rb}, 0.42)`);
        halo.addColorStop(0.5, `rgba(${rr}, ${rg}, ${rb}, 0.14)`);
        halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(CX, CY, 285 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Concentric rotating arcane rings
        ctx.strokeStyle = `rgba(${rr}, ${rg}, ${rb}, 0.45)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 10]);
        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(this.time * 0.55);
        ctx.beginPath();
        ctx.arc(0, 0, 204, 0, Math.PI * 2);
        ctx.stroke();
        ctx.rotate(-this.time * 1.15);
        ctx.strokeStyle = 'rgba(255, 226, 134, 0.36)';
        ctx.setLineDash([6, 14]);
        ctx.beginPath();
        ctx.arc(0, 0, 242, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        for (const m of this.orbitMotes) {
          const mx = CX + Math.cos(m.angle) * m.radius;
          const my = CY + Math.sin(m.angle) * m.radius * m.yScale;
          const tw = 0.55 + 0.45 * Math.sin(this.time * 6 + m.phase);
          ctx.fillStyle = m.color;
          ctx.globalAlpha = tw * 0.9;
          ctx.fillRect(Math.round(mx - m.size / 2), Math.round(my - m.size / 2), m.size, m.size);
        }
        ctx.restore();
      }

      // 3. Per-Card Rarity Light Pillars during Reveal
      if (this.mode === 'reveal') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const pl of this.pillars) {
          if (pl.elapsed < pl.delay) continue;
          const fadeIn = Math.min(1, (pl.elapsed - pl.delay) / 0.28);
          const breathe = 0.86 + Math.sin(this.time * 3.4 + pl.x * 0.01) * 0.14;
          const [pr, pg, pb] = pl.style.rgb;
          const a = pl.style.alpha * fadeIn * breathe;
          const halfW = pl.style.width / 2;

          const grad = ctx.createLinearGradient(pl.x - halfW, 0, pl.x + halfW, 0);
          grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(0.32, `rgba(${pr}, ${pg}, ${pb}, ${(a * 0.55).toFixed(3)})`);
          grad.addColorStop(0.5, `rgba(${pr}, ${pg}, ${pb}, ${a.toFixed(3)})`);
          grad.addColorStop(0.68, `rgba(${pr}, ${pg}, ${pb}, ${(a * 0.55).toFixed(3)})`);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(pl.x - halfW, 60, pl.style.width, 600);
        }
        ctx.restore();
      }

      // 4. Horizontal Light-Blade Tear Slash
      if (this.slashLife > 0) {
        const p = this.slashLife / this.slashMax;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const sy = CY - 92;
        const slashW = 860 * (1.2 - p * 0.4);
        const slashH = 26 * p;
        const g = ctx.createLinearGradient(CX - slashW / 2, sy, CX + slashW / 2, sy);
        g.addColorStop(0, 'rgba(255, 255, 255, 0)');
        g.addColorStop(0.25, this.palette.primary);
        g.addColorStop(0.5, '#ffffff');
        g.addColorStop(0.75, this.palette.secondary);
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.globalAlpha = Math.min(1, p * 1.4);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(CX, sy, slashW / 2, Math.max(2, slashH), -0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 5. Expanding Shockwaves
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const sw of this.shockwaves) {
        const a = Math.max(0, sw.life / sw.maxLife);
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = a * 0.85;
        ctx.lineWidth = Math.max(1.5, sw.lineW * a);
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // 6. Real Duelyst H5 Keyed VFX Clips
      const vfx = this.vfx || window.MT.vfx;
      if (vfx && vfx.draw) {
        for (const inst of this.vfxInstances) {
          vfx.draw(ctx, inst);
        }
      }

      // 7. Sparks & Foil Confetti
      ctx.save();
      for (const p of this.particles) {
        const a = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.55)));
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        if (p.isFoil) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
          ctx.restore();
        } else {
          ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
        }
      }
      ctx.restore();

      // 8. Dramatic Opening Flash
      if (this.flashAlpha > 0) {
        ctx.save();
        const fg = ctx.createRadialGradient(CX, CY, 40, CX, CY, 740);
        fg.addColorStop(0, `rgba(255, 250, 232, ${this.flashAlpha.toFixed(3)})`);
        fg.addColorStop(0.55, `rgba(${rr}, ${rg}, ${rb}, ${(this.flashAlpha * 0.48).toFixed(3)})`);
        fg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
  }

  window.MT.PackCeremonyFX = PackCeremonyFX;
})();
