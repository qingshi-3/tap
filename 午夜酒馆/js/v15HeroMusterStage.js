// v19.5 Plan B — CYBER PRISM & NEON SLICE:
//   1. Twin Plasma Charge Rails along the -11deg parallel borders (crisp unidirectional top->bottom bars + corner pixel telemetry ticks!)
//   2. Floating -11deg Geometric Holo Shards (translucent beveled parallelograms with metallic specular edges, zero noisy dots!)
//   3. Live Interactive Cursor Lock-On: twin border focal flares + subtle prism refraction line tracking mouse position!
//   4. Razor-sharp Post-Expand Twin Diagonal Light Blades on hero switch!
// Also exports ThemeSanctumStage for the 8-Theme-Pack Sanctum.
(function () {
  window.MT = window.MT || {};

  const W = 1280;
  const H = 720;
  const VW = 320;
  const VH = 180;
  const SKEW_DX = 35; // exact -11deg slant across 180px virtual height

  const HERO_ACCENTS = {
    hero_01: { main: '#ffd966', sec: '#ff4d8d' },
    hero_02: { main: '#5cf2ff', sec: '#4a88ff' },
    hero_03: { main: '#4ef0c4', sec: '#5cf2ff' },
    hero_05: { main: '#ff7a52', sec: '#ffd24c' },
    hero_07: { main: '#7ef28a', sec: '#c26eff' },
    hero_08: { main: '#d27dff', sec: '#ff5ca8' },
    hero_09: { main: '#ffe066', sec: '#5cf2ff' },
    hero_10: { main: '#ff4d8d', sec: '#5cf2ff' },
    hero_04: { main: '#f5b841', sec: '#fff2a6' },
    hero_06: { main: '#ff8c42', sec: '#ff4d8d' }
  };

  const THEME_ACCENTS = {
    discard: { main: '#6be5ff', sec: '#b8f3ff' },
    shield:  { main: '#78b7ff', sec: '#ffe082' },
    poison:  { main: '#7ef28a', sec: '#b97aff' },
    frost:   { main: '#9cf4ff', sec: '#5ea6ff' },
    hand:    { main: '#f0b85b', sec: '#fff2b0' },
    summon:  { main: '#e288ff', sec: '#6be5c8' },
    blood:   { main: '#ff5c72', sec: '#ff9c52' },
    dice:    { main: '#ffe066', sec: '#ff7aa8' }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. HERO GALLERY — PLAN B: CYBER PRISM & NEON SLICE
  // ═══════════════════════════════════════════════════════════════════════════
  class HeroMusterStage {
    constructor() {
      this.canvas = null;
      this.ctx = null;
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

      this.selectedHeroId = 'hero_01';
      this.accent = HERO_ACCENTS.hero_01;
      this.seamLeftX = 88;
      this.seamRightX = 222;
      this.seamsReady = false;

      // Interactive cursor tracking (in 320x180 virtual coords)
      this.pointerActive = false;
      this.pointerTargetX = 155;
      this.pointerTargetY = 82;
      this.pointerX = 155;
      this.pointerY = 82;
      this.pointerAlpha = 0;

      // Floating geometric -11deg Holo Shards along outer flanks of expanded hero (never over face!)
      this.shards = [
        { side: 'L', dx: -10, yBase: 36,  w: 6, h: 14, amp: 5.5, spd: 1.15, ph: 0.4, useSec: false },
        { side: 'L', dx:  12, yBase: 102, w: 5, h: 11, amp: 4.2, spd: 1.45, ph: 2.1, useSec: true  },
        { side: 'L', dx:  -6, yBase: 122, w: 4, h: 8,  amp: 3.6, spd: 1.75, ph: 4.0, useSec: false },
        { side: 'R', dx:  10, yBase: 44,  w: 6, h: 15, amp: 5.8, spd: 1.05, ph: 1.3, useSec: true  },
        { side: 'R', dx: -12, yBase: 92,  w: 5, h: 10, amp: 4.5, spd: 1.55, ph: 3.4, useSec: false },
        { side: 'R', dx:   8, yBase: 126, w: 4, h: 9,  amp: 3.8, spd: 1.35, ph: 5.2, useSec: true  }
      ];

      // Plasma charge rail pulses (unidirectional TOP -> BOTTOM!)
      this.railSegments = [
        { side: 'L', speed: 0.56, len: 28, phase: 0.0,  bright: 1.0 },
        { side: 'L', speed: 0.56, len: 12, phase: 0.52, bright: 0.65 },
        { side: 'R', speed: 0.62, len: 30, phase: 0.24, bright: 1.0 },
        { side: 'R', speed: 0.62, len: 14, phase: 0.74, bright: 0.65 }
      ];

      this.slashes = [];
      this.sparks = [];
    }

    static getHeroAccent(heroId) {
      return HERO_ACCENTS[heroId] || HERO_ACCENTS.hero_01;
    }

    static getSeatLayout() { return []; }
    static getDais() { return { x: 455, y: 454 }; }

    _ensureFrame() {
      const PFX = window.MT && window.MT.PixelFX;
      if (!PFX) return null;
      if (!this.frame) this.frame = PFX.createFrame(VW, VH, 0, 0);
      return PFX;
    }

    attach(canvas, heroes, selectedHeroId) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.selectedHeroId = selectedHeroId || 'hero_01';
      this.accent = HeroMusterStage.getHeroAccent(this.selectedHeroId);
      if (this.ctx) this.start();
    }

    setHeroes() {}
    setHovered() {}

    setHeroAccent(hero) {
      if (!hero) return;
      this.selectedHeroId = hero.id;
      this.accent = HeroMusterStage.getHeroAccent(hero.id);
      this.slashes = [];
      if (this.ctx && !this.running) this.start();
    }

    setPointerScreen(screenX, screenY, active = true) {
      this.pointerActive = Boolean(active);
      if (active && isFinite(screenX) && isFinite(screenY)) {
        this.pointerTargetX = Math.max(0, Math.min(VW, screenX / 4));
        this.pointerTargetY = Math.max(0, Math.min(VH, screenY / 4));
      }
    }

    setSeamBounds(leftScreenX, rightScreenX) {
      if (isFinite(leftScreenX) && isFinite(rightScreenX)) {
        this.seamLeftX = Math.max(4, Math.min(VW - 60, leftScreenX / 4));
        this.seamRightX = Math.max(this.seamLeftX + 20, Math.min(VW - 4, rightScreenX / 4));
        this.seamsReady = true;
      }
    }

    selectHero(hero, triggerFx = true, isUnlockCelebrate = false) {
      if (!hero) return;
      this.selectedHeroId = hero.id;
      this.accent = HeroMusterStage.getHeroAccent(hero.id);
      if (triggerFx) this.triggerFlourish(hero, isUnlockCelebrate);
      else this.start();
    }

    triggerFlourish(hero, isCelebrate = false, seamLeftScreen = null, seamRightScreen = null) {
      if (hero) {
        this.selectedHeroId = hero.id;
        this.accent = HeroMusterStage.getHeroAccent(hero.id);
      }
      if (seamLeftScreen !== null && seamRightScreen !== null) {
        this.setSeamBounds(seamLeftScreen, seamRightScreen);
      }

      // Twin razor-sharp FOREGROUND diagonal light blades racing DOWNWARD along settled parallel seams!
      this.slashes.push(
        { xTop: this.seamLeftX + SKEW_DX * 0.5, xBot: this.seamLeftX - SKEW_DX * 0.5, life: 0.44, maxLife: 0.44, col: this.accent.main },
        { xTop: this.seamRightX + SKEW_DX * 0.5, xBot: this.seamRightX - SKEW_DX * 0.5, life: 0.48, maxLife: 0.48, col: this.accent.sec }
      );

      const count = isCelebrate ? 40 : 20;
      for (let i = 0; i < count; i++) {
        const onRight = i % 2 === 1;
        const frac = Math.random();
        const bx = (onRight ? this.seamRightX : this.seamLeftX) + (0.5 - frac) * SKEW_DX;
        const by = 10 + frac * (VH - 20);
        const dir = onRight ? 1 : -1;
        this.sparks.push({
          x: bx,
          y: by,
          vx: dir * (26 + Math.random() * 54),
          vy: -10 - Math.random() * 28,
          s: Math.random() < 0.3 ? 2 : 1,
          life: 0.30 + Math.random() * 0.32,
          col: i % 4 === 0 ? '#ffffff' : (i % 2 === 0 ? this.accent.main : this.accent.sec)
        });
      }
      this.start();
    }

    start() {
      if (this.running || !this.ctx) return;
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

    stop() {
      this.running = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      this.slashes = [];
      this.sparks = [];
      if (this.ctx) this.ctx.clearRect(0, 0, W, H);
    }

    _update(dt) {
      this.time += dt;
      const lerp = Math.min(1, dt * 14);
      this.pointerX += (this.pointerTargetX - this.pointerX) * lerp;
      this.pointerY += (this.pointerTargetY - this.pointerY) * lerp;
      const targetA = this.pointerActive ? 1 : 0;
      this.pointerAlpha += (targetA - this.pointerAlpha) * Math.min(1, dt * 8);

      for (let i = this.slashes.length - 1; i >= 0; i--) {
        this.slashes[i].life -= dt;
        if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
      }
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        s.life -= dt;
        if (s.life <= 0) { this.sparks.splice(i, 1); continue; }
        s.vx *= Math.pow(0.91, dt * 60);
        s.vy = s.vy * Math.pow(0.94, dt * 60) + 28 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
    }

    _render() {
      const ctx = this.ctx;
      const PFX = this._ensureFrame();
      if (!ctx || !PFX || !this.frame) return;

      PFX.clearFrame(this.frame);
      const p = PFX.painterFor(this.frame);
      p.place(0, 0, false, 0);
      const whiteC = PFX.WHITE;
      const cyanC = PFX.hex('#5cf2ff');
      const magC = PFX.hex('#ff4d8d');
      const mainC = PFX.hex(this.accent.main);
      const secC = PFX.hex(this.accent.sec);

      const seamXAtY = (seamX, y) => seamX + (0.5 - y / VH) * SKEW_DX;

      if (this.seamsReady) {
        // 1. TWIN PLASMA CHARGE RAILS (dual-track precision energy bars sliding TOP -> BOTTOM)
        const drawRail = (seamX, col, offsetX) => {
          const xTop = seamX + SKEW_DX * 0.5;
          const xBot = seamX - SKEW_DX * 0.5;
          // Subtle inner secondary guide track parallel to the border
          p.glowLine(xTop + offsetX, 16, xBot + offsetX, VH - 16, 1.4, col, 0.12);
          p.glowLine(xTop, 0, xBot, VH, 3.6, col, 0.16);
        };
        drawRail(this.seamLeftX, mainC, -4);
        drawRail(this.seamRightX, secC, 4);

        if (!this.slashes.length) {
          for (const seg of this.railSegments) {
            const seamX = seg.side === 'L' ? this.seamLeftX : this.seamRightX;
            const col = seg.side === 'L' ? mainC : secC;
            const prog = (this.time * seg.speed + seg.phase) % 1.25;
            if (prog > 1) continue;
            const yHead = prog * (VH + seg.len) - 2;
            const yTail = yHead - seg.len;
            const y0 = Math.max(0, Math.min(VH, yTail));
            const y1 = Math.max(0, Math.min(VH, yHead));
            if (y1 <= y0 + 2) continue;
            const x0 = seamXAtY(seamX, y0);
            const x1 = seamXAtY(seamX, y1);
            const env = Math.sin(prog * Math.PI) * seg.bright;
            // Crisp chromatic plasma bar + leading glint
            p.glowLine(x0, y0, x1, y1, 5.4, col, 0.55 * env);
            p.glowLine(x0, y0, x1, y1, 1.8, whiteC, 0.68 * env);
            if (y1 > 2 && y1 < VH - 2 && seg.bright > 0.8) {
              p.glow(x1, y1, 3.6, whiteC, 0.55 * env);
            }
          }
        }

        // 2. CORNER PRECISION TELEMETRY & FLOATING HOLO SHARDS are rendered crisp on full 1280x720 ctx below!

        // 3. INTERACTIVE CURSOR LOCK-ON (twin rail focal flares + crisp slanted prism beam tracking cursor!)
        if (this.pointerAlpha > 0.02) {
          const py = Math.max(12, Math.min(VH - 12, this.pointerY));
          const lx = seamXAtY(this.seamLeftX, py);
          const rx = seamXAtY(this.seamRightX, py);
          const a = this.pointerAlpha;
          // Twin rail lock-on flares sliding smoothly to match cursor Y!
          p.glow(lx, py, 6.2, mainC, 0.54 * a);
          p.glow(lx, py, 2.4, whiteC, 0.68 * a);
          p.glow(rx, py, 6.2, secC, 0.54 * a);
          p.glow(rx, py, 2.4, whiteC, 0.68 * a);

          // Ultra-clean diagonal prism refraction blade anchored near cursor X (strictly inside expanded slice)
          if (this.pointerX > lx + 4 && this.pointerX < rx - 4) {
            const dxTop = this.pointerX + (py / VH) * SKEW_DX;
            const dxBot = this.pointerX - ((VH - py) / VH) * SKEW_DX;
            p.glowLine(dxTop - 1, 0, dxBot - 1, VH, 2.2, cyanC, 0.085 * a);
            p.glowLine(dxTop + 1, 0, dxBot + 1, VH, 2.2, magC, 0.085 * a);
            p.glowLine(lx, py, rx, py, 1.2, whiteC, 0.08 * a);
          }
        }
      }

      // 5. Post-Expand Razor-Sharp Twin Diagonal Light Blades on hero switch!
      for (const sl of this.slashes) {
        const prog = 1 - sl.life / sl.maxLife;
        const fade = 1 - PFX.smooth(0.22, 1, prog);
        const col = PFX.hex(sl.col);
        const curY = Math.min(VH, prog * 3.5 * VH);
        const xEnd = sl.xTop + (sl.xBot - sl.xTop) * (curY / VH);
        p.glowLine(sl.xTop, 0, xEnd, curY, 7.5 * fade + 1, col, 0.78 * fade);
        p.glowLine(sl.xTop, 0, xEnd, curY, 2.2 * fade + 0.5, whiteC, 0.85 * fade);
        if (fade > 0.2) {
          PFX.sparkle(p, xEnd, Math.min(VH - 6, curY), 6 * fade, whiteC, col, 0.92 * fade);
        }
      }

      for (const s of this.sparks) {
        const a = Math.max(0, Math.min(1, s.life / 0.32));
        const col = PFX.hex(s.col);
        p.rect(Math.round(s.x), Math.round(s.y), s.s, s.s, col, a);
        if (a > 0.5) p.glow(s.x, s.y, 2.0, col, 0.22 * a);
      }

      PFX.composite(this.frame, this.imgData.data, null, 1.15);
      this.offCtx.putImageData(this.imgData, 0, 0);

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.off, 0, 0, VW, VH, 0, 0, W, H);
      ctx.restore();

      // 6. RAZOR-CRISP NATIVE 1280x720 HOLOGRAPHIC GLASS SHARDS & CORNER TELEMETRY RIGS
      if (this.seamsReady) {
        const sxAtY = (seamX, sy) => (seamX + (0.5 - sy / H) * SKEW_DX) * 4;
        ctx.save();

        // Crisp translucent -11deg geometric holo glass shards along outer flanks
        for (const sh of this.shards) {
          const seamX = sh.side === 'L' ? this.seamLeftX : this.seamRightX;
          const cy = (sh.yBase + Math.sin(this.time * sh.spd + sh.ph) * sh.amp) * 4;
          const cx = sxAtY(seamX, cy) + sh.dx * 4;
          const sw = sh.w * 3.4;
          const shH = sh.h * 4.0;
          const slant = (shH / H) * (SKEW_DX * 4) * 0.5;
          const glint = 0.5 + 0.5 * Math.sin(this.time * 2.4 + sh.ph * 1.6);
          const colHex = sh.useSec ? this.accent.sec : this.accent.main;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(cx - sw * 0.5 + slant, cy - shH * 0.5);
          ctx.lineTo(cx + sw * 0.5 + slant, cy - shH * 0.5);
          ctx.lineTo(cx + sw * 0.5 - slant, cy + shH * 0.5);
          ctx.lineTo(cx - sw * 0.5 - slant, cy + shH * 0.5);
          ctx.closePath();

          const grad = ctx.createLinearGradient(cx, cy - shH * 0.5, cx, cy + shH * 0.5);
          grad.addColorStop(0, `rgba(255, 255, 255, ${(0.08 + 0.14 * glint).toFixed(3)})`);
          grad.addColorStop(0.5, `rgba(92, 242, 255, ${(0.05 + 0.08 * glint).toFixed(3)})`);
          grad.addColorStop(1, 'rgba(10, 16, 34, 0.04)');
          ctx.fillStyle = grad;
          ctx.fill();

          // Razor-sharp 1px chromatic beveled edge
          ctx.lineWidth = 1;
          ctx.strokeStyle = colHex;
          ctx.globalAlpha = 0.34 + 0.44 * glint;
          ctx.stroke();

          // Bright top specular highlight strip
          ctx.beginPath();
          ctx.moveTo(cx - sw * 0.5 + slant, cy - shH * 0.5);
          ctx.lineTo(cx + sw * 0.5 + slant, cy - shH * 0.5);
          ctx.strokeStyle = '#ffffff';
          ctx.globalAlpha = 0.55 + 0.4 * glint;
          ctx.stroke();
          ctx.restore();
        }

        // Crisp 2px pixel crosshairs + oscillating telemetry meters near upper seam corners
        const drawHudRig = (seamX, sy, sideSign, colHex) => {
          const cx = Math.round(sxAtY(seamX, sy) + sideSign * 22);
          const cy = Math.round(sy);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
          ctx.fillRect(cx - 5, cy, 11, 1);
          ctx.fillRect(cx, cy - 5, 1, 11);
          for (let i = 0; i < 6; i++) {
            const ty = cy + 16 + i * 7;
            const tx = Math.round(sxAtY(seamX, ty) + sideSign * 14);
            const lvl = 0.5 + 0.5 * Math.sin(this.time * 4.4 + i * 0.85 + (sideSign > 0 ? 2 : 0));
            const bw = Math.round(6 + lvl * 14);
            ctx.fillStyle = colHex;
            ctx.globalAlpha = 0.32 + 0.55 * lvl;
            ctx.fillRect(sideSign > 0 ? tx : tx - bw, ty, bw, 2);
          }
          ctx.globalAlpha = 1;
        };
        drawHudRig(this.seamLeftX, 92, -1, this.accent.main);
        drawHudRig(this.seamRightX, 92, 1, this.accent.sec);

        // Crisp 1px twin lock-on reticle ticks tracking cursor Y along left & right seams
        if (this.pointerAlpha > 0.04) {
          const py = Math.max(48, Math.min(H - 48, this.pointerY * 4));
          const lx = sxAtY(this.seamLeftX, py);
          const rx = sxAtY(this.seamRightX, py);
          ctx.globalAlpha = 0.78 * this.pointerAlpha;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(lx - 14), Math.round(py), 10, 1.5);
          ctx.fillRect(Math.round(rx + 4), Math.round(py), 10, 1.5);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. THEME SANCTUM STRUCTURED ASTROLABE & SPOTLIGHT STAGE (unchanged & verified!)
  // ═══════════════════════════════════════════════════════════════════════════
  class ThemeSanctumStage {
    constructor() {
      this.canvas = null;
      this.ctx = null;
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

      this.themeId = 'discard';
      this.accent = THEME_ACCENTS.discard;
      this.astroAngle = 0;
      this.astroSpinBoost = 0;
      this.spotTargetX = 48;
      this.spotCurX = 48;
      this.spotVisible = true;
      this.rings = [];
      this.bursts = [];
    }

    _ensureFrame() {
      const PFX = window.MT && window.MT.PixelFX;
      if (!PFX) return null;
      if (!this.frame) this.frame = PFX.createFrame(VW, VH, 0, 0);
      return PFX;
    }

    attach(canvas, themeId) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.setTheme(themeId || 'discard', false);
      if (this.ctx) this.start();
    }

    setTheme(themeId, pulse = true) {
      this.themeId = themeId || 'discard';
      this.accent = THEME_ACCENTS[this.themeId] || THEME_ACCENTS.discard;
      if (pulse) {
        this.astroSpinBoost = 2.6;
        this.rings.push({ x: 96, y: 74, r: 12, maxR: 88, life: 0.56, maxLife: 0.56, col: this.accent.main });
      }
    }

    setSpotlightScreenX(screenX, show = true) {
      this.spotVisible = Boolean(show);
      if (isFinite(screenX)) {
        this.spotTargetX = Math.max(16, Math.min(VW - 16, screenX / 4));
      }
    }

    triggerBurst(themeId, intense = false) {
      if (themeId) this.accent = THEME_ACCENTS[themeId] || this.accent;
      this.astroSpinBoost = intense ? 4.4 : 2.8;
      const cx = 160;
      const cy = 68;
      this.rings.push({ x: cx, y: cy, r: 10, maxR: intense ? 112 : 76, life: 0.62, maxLife: 0.62, col: this.accent.main });
      const n = intense ? 32 : 18;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n;
        const spd = (intense ? 44 : 28) + Math.random() * 48;
        this.bursts.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd * 0.65,
          s: Math.random() < 0.35 ? 2 : 1,
          life: 0.38 + Math.random() * 0.32,
          col: i % 3 === 0 ? '#ffffff' : (i % 2 === 0 ? this.accent.main : this.accent.sec)
        });
      }
      if (!this.running && this.ctx) this.start();
    }

    start() {
      if (this.running || !this.ctx) return;
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

    stop() {
      this.running = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      this.rings = [];
      this.bursts = [];
      if (this.ctx) this.ctx.clearRect(0, 0, W, H);
    }

    _update(dt) {
      this.time += dt;
      this.astroAngle += (0.14 + this.astroSpinBoost) * dt;
      this.astroSpinBoost *= Math.pow(0.88, dt * 60);
      this.spotCurX += (this.spotTargetX - this.spotCurX) * Math.min(1, dt * 10);

      for (let i = this.rings.length - 1; i >= 0; i--) {
        this.rings[i].life -= dt;
        if (this.rings[i].life <= 0) this.rings.splice(i, 1);
      }
      for (let i = this.bursts.length - 1; i >= 0; i--) {
        const b = this.bursts[i];
        b.life -= dt;
        if (b.life <= 0) { this.bursts.splice(i, 1); continue; }
        b.vx *= Math.pow(0.92, dt * 60);
        b.vy *= Math.pow(0.92, dt * 60);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
    }

    _render() {
      const ctx = this.ctx;
      const PFX = this._ensureFrame();
      if (!ctx || !PFX || !this.frame) return;

      PFX.clearFrame(this.frame);
      const p = PFX.painterFor(this.frame);
      p.place(0, 0, false, 0);
      const mainC = PFX.hex(this.accent.main);
      const secC = PFX.hex(this.accent.sec);
      const whiteC = PFX.WHITE;

      const ax = 96;
      const ay = 68;
      const breathe = 0.88 + 0.12 * Math.sin(this.time * 1.4);
      p.glow(ax, ay, 72 * breathe, mainC, 0.13);
      p.glow(246, 56, 48, secC, 0.065);

      const outerR = 58;
      const outerTicks = 36;
      for (let i = 0; i < outerTicks; i++) {
        const ang = this.astroAngle + (Math.PI * 2 * i) / outerTicks;
        const x1 = ax + Math.cos(ang) * outerR;
        const y1 = ay + Math.sin(ang) * outerR * 0.82;
        if (i % 9 === 0) {
          const x2 = ax + Math.cos(ang) * (outerR + 6);
          const y2 = ay + Math.sin(ang) * (outerR + 6) * 0.82;
          p.line(x1, y1, x2, y2, mainC, 0.24);
          p.glow(x1, y1, 2.8, mainC, 0.22);
        } else if (i % 3 === 0) {
          p.rect(Math.round(x1), Math.round(y1), 2, 1, mainC, 0.18);
        } else {
          p.rect(Math.round(x1), Math.round(y1), 1, 1, secC, 0.1);
        }
      }

      const innerR = 38;
      const innerSegs = 24;
      for (let i = 0; i < innerSegs; i++) {
        const ang = -this.astroAngle * 1.45 + (Math.PI * 2 * i) / innerSegs;
        const x = ax + Math.cos(ang) * innerR;
        const y = ay + Math.sin(ang) * innerR * 0.82;
        p.rect(Math.round(x), Math.round(y), 1, 1, i % 6 === 0 ? whiteC : secC, i % 6 === 0 ? 0.34 : 0.14);
      }

      if (this.spotVisible) {
        const sx = this.spotCurX;
        const beamPulse = 0.095 + 0.03 * Math.sin(this.time * 2.2);
        p.glowLine(sx + 5, 16, sx, 98, 13, mainC, beamPulse);
        p.glowLine(sx + 5, 16, sx, 94, 5, whiteC, beamPulse * 0.45);
      }

      const daisCx = 94;
      const daisCy = 92;
      const daisRx = 74;
      const daisRy = 11;
      for (let i = 0; i < 32; i++) {
        const ang = (Math.PI * 2 * i) / 32 + this.time * 0.36;
        const px = daisCx + Math.cos(ang) * daisRx;
        const py = daisCy + Math.sin(ang) * daisRy;
        const front = 0.25 + 0.75 * ((Math.sin(ang) + 1) * 0.5);
        p.rect(Math.round(px), Math.round(py), i % 4 === 0 ? 2 : 1, 1, i % 8 === 0 ? whiteC : mainC, 0.46 * front);
      }

      for (let i = 0; i < 3; i++) {
        const lx = ((this.time * 9 + i * 115) % (VW + 70)) - 35;
        p.glowLine(lx + SKEW_DX * 0.5, 0, lx - SKEW_DX * 0.5, VH, 4, mainC, 0.032);
      }

      for (const r of this.rings) {
        const prog = 1 - r.life / r.maxLife;
        const rad = r.r + (r.maxR - r.r) * (1 - Math.pow(1 - prog, 2.5));
        const fade = (1 - prog) * 0.58;
        const col = PFX.hex(r.col);
        for (let i = 0; i < 32; i++) {
          const a = (Math.PI * 2 * i) / 32;
          p.rect(Math.round(r.x + Math.cos(a) * rad), Math.round(r.y + Math.sin(a) * rad * 0.72), 2, 1, col, fade);
        }
      }

      for (const b of this.bursts) {
        const a = Math.max(0, Math.min(1, b.life / 0.35));
        const col = PFX.hex(b.col);
        p.rect(Math.round(b.x), Math.round(b.y), b.s, b.s, col, a);
        if (a > 0.5) p.glow(b.x, b.y, 2.4, col, 0.22 * a);
      }

      PFX.composite(this.frame, this.imgData.data, null, 1.12);
      this.offCtx.putImageData(this.imgData, 0, 0);

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.off, 0, 0, VW, VH, 0, 0, W, H);
      ctx.restore();
    }
  }

  window.MT.HeroMusterStage = HeroMusterStage;
  window.MT.ThemeSanctumStage = ThemeSanctumStage;
})();
