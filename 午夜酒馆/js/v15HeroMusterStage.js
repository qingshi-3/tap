// v20.2 Flowing Liquid-Light Hero Showcase Edge FX & Theme Sanctum Astrolabe
// Renders ONLY clean directional liquid-starlight streams along the active -11deg slanted seams
// (flowing UP on left, DOWN on right), subtle rising starlight motes, mobile tap starburst ripples,
// and hero-switch cross-slashes. Keeps the hero portrait completely unobstructed.
// Also exports ThemeSanctumStage for the 8-Theme-Pack Sanctum.
(function () {
  window.MT = window.MT || {};

  const W = 1280;
  const H = 720;
  const VW = 320;
  const VH = 180;
  const TAN_11 = Math.tan((11 * Math.PI) / 180);
  const SKEW_DX = 35; // exact -11deg slant across 180px virtual height (used by ThemeSanctumStage too)

  // Muted hero tints (uiAccent mixed 62% with white) + gold, replacing the old neon pairs
  const HERO_ACCENTS = {
    hero_01: { main: '#d38088', sec: '#d4ae68' },
    hero_02: { main: '#9cd2e6', sec: '#d4ae68' },
    hero_03: { main: '#7eb69f', sec: '#d4ae68' },
    hero_05: { main: '#e2ab7b', sec: '#d4ae68' },
    hero_07: { main: '#ad92d9', sec: '#d4ae68' },
    hero_08: { main: '#c1b0e4', sec: '#d4ae68' },
    hero_09: { main: '#7eb0d3', sec: '#d4ae68' },
    hero_10: { main: '#b97e99', sec: '#d4ae68' },
    hero_04: { main: '#cead85', sec: '#d4ae68' },
    hero_06: { main: '#de97b0', sec: '#d4ae68' }
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

  function hexToRgba(hex, alpha) {
    const h = String(hex || '#ffd966').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. HERO GALLERY — CLEAN DIRECTIONAL LIQUID-LIGHT EDGE FX
  // ═══════════════════════════════════════════════════════════════════════════
  class HeroMusterStage {
    constructor() {
      this.canvas = null;
      this.ctx = null;

      this.running = false;
      this.rafId = 0;
      this.lastTs = 0;
      this.time = 0;

      this.selectedHeroId = 'hero_01';
      this.accent = HERO_ACCENTS.hero_01;

      // Active hero slice left/right slanted border X in 1280px screen coords (at vertical center H/2)
      this.seamLeftS = 352;
      this.seamRightS = 888;
      this.targetSeamLeftS = 352;
      this.targetSeamRightS = 888;
      this.seamsReady = false;

      this.railSurge = 0;

      this.edgeStreams = [];
      this.starMotes = [];
      this.slashes = [];
      this.rings = [];
      this.sparks = [];

      this._initStreams();
    }

    static getHeroAccent(heroId) {
      return HERO_ACCENTS[heroId] || HERO_ACCENTS.hero_01;
    }

    static getSeatLayout() { return []; }
    static getDais() { return { x: 455, y: 454 }; }

    _applyHeroAccent(heroId) {
      this.selectedHeroId = heroId || 'hero_01';
      this.accent = HERO_ACCENTS[this.selectedHeroId] || HERO_ACCENTS.hero_01;
    }

    _initStreams() {
      // Directional liquid-light currents flowing UP on left & DOWN on right
      this.edgeStreams = [
        { side: 0, dir: -1, u: 0.10, speed: 0.34, tailLen: 0.29, width: 2.8, waveAmp: 4.8, waveFreq: 13.0, ph: 0.4, bright: 1.0,  sparkT: 0.10 },
        { side: 0, dir: -1, u: 0.58, speed: 0.42, tailLen: 0.20, width: 1.8, waveAmp: 6.6, waveFreq: 16.5, ph: 2.4, bright: 0.72, sparkT: 0.16 },
        { side: 1, dir:  1, u: 0.24, speed: 0.32, tailLen: 0.29, width: 2.8, waveAmp: 5.0, waveFreq: 13.5, ph: 1.5, bright: 1.0,  sparkT: 0.12 },
        { side: 1, dir:  1, u: 0.72, speed: 0.40, tailLen: 0.20, width: 1.8, waveAmp: 6.4, waveFreq: 16.0, ph: 4.2, bright: 0.72, sparkT: 0.18 }
      ];

      // Subtle rising starlight dust along outer flanks & pedestal (face completely clear)
      this.starMotes = [];
      for (let i = 0; i < 24; i++) this.starMotes.push(this._makeStarMote(true));
    }

    _makeStarMote(randomY = false) {
      const band = Math.random();
      let u;
      if (band < 0.42) u = -0.06 + Math.random() * 0.24;
      else if (band < 0.84) u = 0.82 + Math.random() * 0.24;
      else u = 0.18 + Math.random() * 0.64;

      const startY = randomY
        ? (band >= 0.84 ? 460 + Math.random() * 260 : 60 + Math.random() * 640)
        : (band >= 0.84 ? 660 + Math.random() * 60 : 560 + Math.random() * 180);

      return {
        u,
        y: startY,
        vy: -(26 + Math.random() * 48),
        swayAmp: 5 + Math.random() * 11,
        swayFreq: 1.0 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        size: Math.random() < 0.35 ? 3.0 : 1.8,
        isStar: Math.random() < 0.42,
        useSec: Math.random() < 0.46,
        maxRiseY: band >= 0.84 ? 400 + Math.random() * 80 : 32 + Math.random() * 80
      };
    }

    attach(canvas, heroes, selectedHeroId) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this._applyHeroAccent(selectedHeroId || 'hero_01');
      this.syncSeamBoundsFromDom(true);
      if (this.ctx) this.start();
    }

    setHeroes() {}
    setHovered() {}
    setPointerScreen() {}

    setHeroAccent(hero) {
      if (!hero) return;
      this._applyHeroAccent(hero.id);
      if (this.ctx && !this.running) this.start();
    }

    setSeamBounds(leftScreenX, rightScreenX, snap = false) {
      if (isFinite(leftScreenX) && isFinite(rightScreenX)) {
        const ls = Math.max(16, Math.min(W - 220, leftScreenX));
        const rs = Math.max(ls + 120, Math.min(W - 16, rightScreenX));
        this.targetSeamLeftS = ls;
        this.targetSeamRightS = rs;
        if (snap || !this.seamsReady) {
          this.seamLeftS = ls;
          this.seamRightS = rs;
        }
        this.seamsReady = true;
      }
    }

    syncSeamBoundsFromDom(snap = false) {
      const stageEl = document.getElementById('muster-stage-root');
      const activeSlice = document.querySelector('#v17-ribbon-track .v17-hero-slice.is-active');
      if (!stageEl || !activeSlice) return;
      const sRect = stageEl.getBoundingClientRect();
      const aRect = activeSlice.getBoundingClientRect();
      if (sRect.width <= 0 || aRect.width <= 0) return;
      const scaleX = W / sRect.width;
      const leftX = (aRect.left - sRect.left) * scaleX + 70;
      const rightX = (aRect.right - sRect.left) * scaleX - 70;
      this.setSeamBounds(leftX, rightX, snap);
    }

    selectHero(hero, triggerFx = true, isUnlockCelebrate = false) {
      if (!hero) return;
      this._applyHeroAccent(hero.id);
      if (triggerFx) this.triggerFlourish(hero, isUnlockCelebrate);
      else this.start();
    }

    triggerTapPulse(screenX, screenY) {
      if (!isFinite(screenX) || !isFinite(screenY)) return;
      const sx = Math.max(24, Math.min(W - 24, screenX));
      const sy = Math.max(24, Math.min(H - 24, screenY));

      this.rings.push({
        x: sx, y: sy, r0: 10, r1: 112, life: 0.44, maxLife: 0.44,
        col: this.accent.main, diamond: true
      });
      this.rings.push({
        x: sx, y: sy, r0: 6, r1: 72, life: 0.34, maxLife: 0.34,
        col: this.accent.sec, diamond: false
      });

      for (let i = 0; i < 14; i++) {
        const ang = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.25;
        const spd = 110 + Math.random() * 185;
        this.sparks.push({
          x: sx, y: sy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 18,
          size: Math.random() < 0.35 ? 3.6 : 2.2,
          len: 9 + Math.random() * 14,
          life: 0.32 + Math.random() * 0.22,
          maxLife: 0.54,
          col: i % 3 === 0 ? '#ffffff' : (i % 2 === 0 ? this.accent.main : this.accent.sec)
        });
      }

      this.railSurge = Math.max(this.railSurge, 0.45);
      if (!this.running && this.ctx) this.start();
    }

    triggerFlourish(hero, isCelebrate = false, seamLeftScreen = null, seamRightScreen = null) {
      if (hero) this._applyHeroAccent(hero.id);
      if (seamLeftScreen !== null && seamRightScreen !== null) {
        this.setSeamBounds(seamLeftScreen, seamRightScreen, true);
      } else {
        this.syncSeamBoundsFromDom(true);
      }

      this.railSurge = isCelebrate ? 1.2 : 0.9;

      const midX = (this.seamLeftS + this.seamRightS) * 0.5;
      const spanW = Math.max(360, this.seamRightS - this.seamLeftS);
      const slashY = 452;

      this.slashes.push({
        x: midX, y: slashY,
        len: spanW * 1.12,
        angle: -0.32, life: 0.42, maxLife: 0.42,
        col: this.accent.main, thick: isCelebrate ? 14 : 10
      });
      this.slashes.push({
        x: midX, y: slashY + 18,
        len: spanW * 0.88,
        angle: 0.22, life: 0.36, maxLife: 0.36,
        col: this.accent.sec, thick: isCelebrate ? 10 : 8
      });

      this.rings.push({
        x: midX, y: 390, r0: 36, r1: isCelebrate ? 310 : 235,
        life: 0.54, maxLife: 0.54, col: this.accent.main, diamond: true
      });
      this.rings.push({
        x: midX, y: 390, r0: 20, r1: isCelebrate ? 245 : 184,
        life: 0.45, maxLife: 0.45, col: this.accent.sec, diamond: false
      });

      const sparkCount = isCelebrate ? 40 : 24;
      for (let i = 0; i < sparkCount; i++) {
        const isLeft = i % 2 === 0;
        const py = 96 + Math.random() * 530;
        const px = this._sxAtY(isLeft ? this.seamLeftS : this.seamRightS, py);
        const outDir = isLeft ? -1 : 1;
        this.sparks.push({
          x: px, y: py,
          vx: outDir * (60 + Math.random() * 185) + (Math.random() - 0.5) * 76,
          vy: -(40 + Math.random() * 160),
          size: Math.random() < 0.35 ? 3.8 : 2.3,
          len: 11 + Math.random() * 18,
          life: 0.38 + Math.random() * 0.34,
          maxLife: 0.72,
          col: i % 4 === 0 ? '#ffffff' : (isLeft ? this.accent.main : this.accent.sec)
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
      this.rings = [];
      this.sparks = [];
      if (this.ctx) this.ctx.clearRect(0, 0, W, H);
    }

    _sxAtY(seamS, sy) {
      return seamS + (H * 0.5 - sy) * TAN_11;
    }

    _update(dt) {
      this.time += dt;
      this.syncSeamBoundsFromDom(false);

      const lerpK = Math.min(1, dt * 16);
      this.seamLeftS += (this.targetSeamLeftS - this.seamLeftS) * lerpK;
      this.seamRightS += (this.targetSeamRightS - this.seamRightS) * lerpK;
      this.railSurge = Math.max(0, this.railSurge - dt * 1.9);

      for (let i = this.starMotes.length - 1; i >= 0; i--) {
        const e = this.starMotes[i];
        e.y += e.vy * dt;
        if (e.y < e.maxRiseY) this.starMotes[i] = this._makeStarMote(false);
      }

      if (this.seamsReady) {
        for (const st of this.edgeStreams) {
          const clampedU = Math.max(0, Math.min(1, st.u));
          const speedCurve = 0.72 + 0.62 * Math.sin(clampedU * Math.PI);
          st.u += st.speed * speedCurve * (1 + this.railSurge * 0.55) * dt;
          if (st.u >= 1.24) {
            st.u -= 1.24;
            st.ph += 1.37;
          }

          st.sparkT -= dt;
          if (st.sparkT <= 0 && st.u > 0.08 && st.u < 0.92 && this.sparks.length < 56) {
            st.sparkT = st.bright > 0.9 ? (0.11 + Math.random() * 0.09) : (0.20 + Math.random() * 0.14);
            const headY = (st.dir < 0 ? (1 - st.u) : st.u) * H;
            const seamS = st.side === 0 ? this.seamLeftS : this.seamRightS;
            const outDir = st.side === 0 ? -1 : 1;
            const hx = this._sxAtY(seamS, headY) + Math.sin(st.u * st.waveFreq + st.ph) * st.waveAmp * 0.6;
            this.sparks.push({
              x: hx, y: headY,
              vx: outDir * (14 + Math.random() * 28) + (Math.random() - 0.5) * 14,
              vy: st.dir * (16 + Math.random() * 30) - 16,
              size: Math.random() < 0.35 ? 2.3 : 1.5,
              len: 6 + Math.random() * 8,
              life: 0.28 + Math.random() * 0.22,
              maxLife: 0.50,
              col: Math.random() < 0.3 ? '#ffffff' : (st.side === 0 ? this.accent.main : this.accent.sec)
            });
          }
        }
      }

      for (let i = this.slashes.length - 1; i >= 0; i--) {
        this.slashes[i].life -= dt;
        if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        this.rings[i].life -= dt;
        if (this.rings[i].life <= 0) this.rings.splice(i, 1);
      }
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        s.life -= dt;
        if (s.life <= 0) { this.sparks.splice(i, 1); continue; }
        s.vx *= Math.pow(0.92, dt * 60);
        s.vy = s.vy * Math.pow(0.93, dt * 60) + 110 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
    }

    _drawStar4(ctx, x, y, r, col, alpha) {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.22, y - r * 0.22);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x + r * 0.22, y + r * 0.22);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.22, y + r * 0.22);
      ctx.lineTo(x - r, y);
      ctx.lineTo(x - r * 0.22, y - r * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ─── DIRECTIONAL LIQUID-LIGHT EDGE CURRENTS (左升右降沿边流光) ───
    _renderDirectionalEdgeFlow(ctx) {
      const surge = this.railSurge;
      const mainCol = this.accent.main;
      const secCol = this.accent.sec;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const drawAuroraFlow = (seamS, sideSign, flowDir, primaryCol, accentCol, phaseSeed) => {
        const steps = 40;
        const yStart = 20;
        const yEnd = H - 20;
        const t = this.time;
        const ribbons = [
          { amp1: 5.0, amp2: 2.5, f1: 0.013, f2: 0.025, spd1: flowDir * 3.3, spd2: flowDir * 4.9, ph: phaseSeed,       w: 7.5 + surge * 5, a: 0.12 + surge * 0.11, col: primaryCol, outerBias: 2 },
          { amp1: 6.8, amp2: 3.2, f1: 0.016, f2: 0.031, spd1: flowDir * 4.1, spd2: flowDir * 6.2, ph: phaseSeed + 2.0, w: 1.7 + surge * 1.3, a: 0.30 + surge * 0.22, col: accentCol,  outerBias: 0 }
        ];

        for (const rb of ribbons) {
          const pts = [];
          for (let i = 0; i <= steps; i++) {
            const u = i / steps;
            const py = yStart + (yEnd - yStart) * u;
            const edgeFade = Math.sin(u * Math.PI);
            const wave =
              Math.sin(py * rb.f1 - t * rb.spd1 + rb.ph) * rb.amp1 +
              Math.cos(py * rb.f2 - t * rb.spd2 + rb.ph * 1.5) * rb.amp2;
            const px = this._sxAtY(seamS, py) + sideSign * rb.outerBias + wave * (0.24 + 0.76 * edgeFade);
            const crest = 0.16 + 0.84 * Math.pow(0.5 + 0.5 * Math.sin(py * 0.012 - t * (flowDir * 3.8) + rb.ph), 2.8);
            pts.push({ x: px, y: py, alpha: edgeFade * crest });
          }

          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i + 1];
            const mA = (p0.alpha + p1.alpha) * 0.5;
            const segA = mA * rb.a;
            if (segA <= 0.01) continue;
            ctx.strokeStyle = hexToRgba(rb.col, segA);
            ctx.lineWidth = rb.w * (0.45 + 0.72 * mA);
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
          }
        }
      };

      drawAuroraFlow(this.seamLeftS,  -1, -1, mainCol, '#fff5d6', 0.4);
      drawAuroraFlow(this.seamRightS,  1,  1, secCol,  '#ffd9e8', 2.8);

      for (const st of this.edgeStreams) {
        const headNorm = st.u;
        const tailNorm = st.u - st.tailLen;
        if (tailNorm >= 1.02 || headNorm <= -0.02) continue;

        const seamS = st.side === 0 ? this.seamLeftS : this.seamRightS;
        const sideSign = st.side === 0 ? -1 : 1;
        const col = st.side === 0 ? mainCol : secCol;
        const segs = 22;
        const pts = [];

        for (let i = 0; i <= segs; i++) {
          const f = i / segs;
          const norm = tailNorm + (headNorm - tailNorm) * f;
          if (norm < -0.04 || norm > 1.04) continue;
          const py = (st.dir < 0 ? (1 - norm) : norm) * H;
          const flutter = Math.sin(norm * st.waveFreq + st.ph + this.time * 2.4) * st.waveAmp * (0.28 + 0.72 * (1 - f));
          const px = this._sxAtY(seamS, py) + flutter + sideSign * (1 - f) * 2.4;
          const boundsFade = Math.max(0, Math.min(1, Math.sin(Math.max(0, Math.min(1, norm)) * Math.PI) * 1.45));
          pts.push({ x: px, y: py, f, env: boundsFade });
        }

        if (pts.length >= 2) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (let i = 1; i < pts.length; i++) {
            const p0 = pts[i - 1];
            const p1 = pts[i];
            const f = p1.f;
            const env = Math.min(p0.env, p1.env);
            const profile = Math.pow(f, 1.55) * (1 - Math.pow(Math.max(0, f - 0.92) / 0.08, 2) * 0.35);
            const a = profile * env * st.bright * (0.76 + surge * 0.25);
            if (a <= 0.01) continue;

            ctx.strokeStyle = hexToRgba(col, a * 0.34);
            ctx.lineWidth = (st.width * 3.6 + surge * 3.2) * profile + 1.1;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();

            ctx.strokeStyle = hexToRgba(col, a * 0.82);
            ctx.lineWidth = st.width * 1.3 * profile + 0.45;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();

            if (f > 0.38) {
              const wf = (f - 0.38) / 0.62;
              ctx.strokeStyle = hexToRgba('#ffffff', a * wf * 0.90);
              ctx.lineWidth = Math.max(0.6, st.width * 0.50 * wf);
              ctx.beginPath();
              ctx.moveTo(p0.x, p0.y);
              ctx.lineTo(p1.x, p1.y);
              ctx.stroke();
            }
          }

          const head = pts[pts.length - 1];
          if (head.env > 0.08 && headNorm <= 1.0 && headNorm >= 0.0) {
            const hRad = (st.bright > 0.9 ? 15 : 10) + surge * 5;
            const rg = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, hRad * 1.45);
            rg.addColorStop(0, hexToRgba('#ffffff', 0.64 * head.env * st.bright));
            rg.addColorStop(0.32, hexToRgba(col, 0.38 * head.env * st.bright));
            rg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = rg;
            ctx.beginPath();
            ctx.arc(head.x, head.y, hRad * 1.45, 0, Math.PI * 2);
            ctx.fill();

            if (st.bright > 0.9) {
              this._drawStar4(ctx, head.x, head.y, 8 + surge * 4, '#ffffff', 0.74 * head.env);
            }
          }
        }
      }

      ctx.restore();
    }

    // ─── STARLIGHT MOTES, SWITCH CROSS-SLASHES & TAP RIPPLES ───
    _renderImpactAndSparkles(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      if (this.seamsReady) {
        for (const e of this.starMotes) {
          const lx = this._sxAtY(this.seamLeftS, e.y);
          const rx = this._sxAtY(this.seamRightS, e.y);
          const ex = lx + (rx - lx) * e.u + Math.sin(this.time * e.swayFreq + e.phase) * e.swayAmp;
          const heightFade = Math.min(1, (e.y - e.maxRiseY) / 90) * Math.min(1, (H - e.y + 40) / 110);
          const twinkle = 0.42 + 0.58 * Math.sin(this.time * 4.2 + e.phase);
          const a = Math.max(0, heightFade * twinkle);
          if (a <= 0.02) continue;

          const col = e.useSec ? this.accent.sec : this.accent.main;
          if (e.isStar) {
            this._drawStar4(ctx, ex, e.y, e.size * 2.4, col, a * 0.72);
            this._drawStar4(ctx, ex, e.y, e.size * 1.15, '#ffffff', a * 0.90);
          } else {
            ctx.fillStyle = hexToRgba(col, a * 0.72);
            ctx.beginPath();
            ctx.arc(ex, e.y, e.size * 0.72, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      for (const sl of this.slashes) {
        const prog = 1 - sl.life / sl.maxLife;
        const ease = 1 - Math.pow(1 - Math.min(1, prog * 2.2), 3);
        const fade = Math.pow(1 - prog, 1.45);
        const half = (sl.len * ease) * 0.5;
        const w = sl.thick * fade;

        ctx.save();
        ctx.translate(sl.x, sl.y);
        ctx.rotate(sl.angle);

        ctx.fillStyle = hexToRgba(sl.col, 0.78 * fade);
        ctx.beginPath();
        ctx.moveTo(-half, 0);
        ctx.quadraticCurveTo(0, -w * 1.4, half, 0);
        ctx.quadraticCurveTo(0, w * 1.4, -half, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = hexToRgba('#ffffff', 0.95 * fade);
        ctx.beginPath();
        ctx.moveTo(-half * 0.9, 0);
        ctx.quadraticCurveTo(0, -w * 0.52, half * 0.9, 0);
        ctx.quadraticCurveTo(0, w * 0.52, -half * 0.9, 0);
        ctx.closePath();
        ctx.fill();

        if (fade > 0.25) {
          this._drawStar4(ctx, 0, 0, 26 * fade, '#ffffff', 0.92 * fade);
        }
        ctx.restore();
      }

      for (const r of this.rings) {
        const prog = 1 - r.life / r.maxLife;
        const ease = 1 - Math.pow(1 - prog, 2.6);
        const rad = r.r0 + (r.r1 - r.r0) * ease;
        const fade = Math.pow(1 - prog, 1.35);

        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.strokeStyle = hexToRgba(r.col, 0.84 * fade);
        ctx.lineWidth = Math.max(1, 3.0 * fade);
        if (r.diamond) {
          ctx.rotate(-0.19);
          ctx.beginPath();
          ctx.moveTo(0, -rad * 0.88);
          ctx.lineTo(rad * 0.72, 0);
          ctx.lineTo(0, rad * 0.88);
          ctx.lineTo(-rad * 0.72, 0);
          ctx.closePath();
          ctx.stroke();

          ctx.strokeStyle = hexToRgba('#ffffff', 0.62 * fade);
          ctx.lineWidth = Math.max(0.8, 1.25 * fade);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.ellipse(0, 0, rad, rad * 0.68, -0.19, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      for (const s of this.sparks) {
        const a = Math.max(0, Math.min(1, s.life / (s.maxLife * 0.55)));
        const spd = Math.hypot(s.vx, s.vy) || 1;
        const nx = s.vx / spd;
        const ny = s.vy / spd;
        const tailLen = Math.min(s.len, spd * 0.065);

        ctx.lineCap = 'round';
        ctx.strokeStyle = hexToRgba(s.col, 0.88 * a);
        ctx.lineWidth = Math.max(1.1, s.size * 0.68 * a);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - nx * tailLen, s.y - ny * tailLen);
        ctx.stroke();

        ctx.fillStyle = hexToRgba('#ffffff', 0.92 * a);
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.9, s.size * 0.42 * a), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    _render() {
      const ctx = this.ctx;
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      if (this.seamsReady) {
        this._renderDirectionalEdgeFlow(ctx);
      }
      this._renderImpactAndSparkles(ctx);
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
