// v18.0 Living Atmospheric PixelFX Stages:
//   1. HeroMusterStage  — Full-screen Hero Gallery foreground living embers, breathing diagonal seam glints,
//                         plus razor-sharp post-expand twin diagonal light-blades!
//   2. ThemeSanctumStage — Full-screen 8-Theme-Pack Sanctum backdrop with rotating arcane astrolabe ring,
//                          color-morphing nebula particles, and equip/unlock star-bursts!
(function () {
  window.MT = window.MT || {};

  const W = 1280;
  const H = 720;
  const VW = 320;
  const VH = 180;
  const SKEW_DX = 35; // matches ~11deg diagonal slant across 180px height

  const HERO_ACCENTS = {
    hero_01: { main: '#ffd966', sec: '#ff5c8a' },
    hero_02: { main: '#6be5ff', sec: '#3a88ff' },
    hero_03: { main: '#4ef0c4', sec: '#38a6e8' },
    hero_05: { main: '#ff7a52', sec: '#ffd24c' },
    hero_07: { main: '#7ef28a', sec: '#a855f0' },
    hero_08: { main: '#c97dff', sec: '#ff7aa8' },
    hero_09: { main: '#ffe066', sec: '#6be5ff' },
    hero_10: { main: '#ff5286', sec: '#c97dff' },
    hero_04: { main: '#f5b841', sec: '#fff2a6' },
    hero_06: { main: '#ff8c42', sec: '#ff5286' }
  };

  const THEME_ACCENTS = {
    discard: { main: '#6be5ff', sec: '#b8f3ff', drift: 'wind' },
    shield:  { main: '#78b7ff', sec: '#ffe082', drift: 'rise' },
    poison:  { main: '#7ef28a', sec: '#a855f0', drift: 'bubble' },
    frost:   { main: '#9cf4ff', sec: '#66a6ff', drift: 'snow' },
    hand:    { main: '#f0b85b', sec: '#fff2b0', drift: 'rise' },
    summon:  { main: '#e288ff', sec: '#7ef2d4', drift: 'spiral' },
    blood:   { main: '#ff5c72', sec: '#ffaa5e', drift: 'ember' },
    dice:    { main: '#ffe066', sec: '#ff7aa8', drift: 'sparkle' }
  };

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

      this.slashes = [];
      this.sparks = [];
      this.motes = this._createAmbientMotes();
    }

    static getHeroAccent(heroId) {
      return HERO_ACCENTS[heroId] || HERO_ACCENTS.hero_01;
    }

    static getSeatLayout() { return []; }
    static getDais() { return { x: 455, y: 454 }; }

    _createAmbientMotes() {
      const list = [];
      for (let i = 0; i < 36; i++) {
        list.push({
          x: Math.random() * VW,
          y: Math.random() * VH,
          vx: (Math.random() - 0.5) * 4.5,
          vy: -(4.5 + Math.random() * 11),
          ph: Math.random() * Math.PI * 2,
          spd: 1.6 + Math.random() * 2.8,
          s: Math.random() < 0.22 ? 2 : 1,
          useSec: i % 3 === 0,
          isWhite: i % 9 === 0,
          nearSeam: i < 12
        });
      }
      return list;
    }

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

      // Twin razor-sharp FOREGROUND diagonal blades racing down the two settled parallel seams!
      this.slashes.push(
        { xTop: this.seamLeftX + SKEW_DX * 0.5, xBot: this.seamLeftX - SKEW_DX * 0.5, life: 0.44, maxLife: 0.44, col: this.accent.main },
        { xTop: this.seamRightX + SKEW_DX * 0.5, xBot: this.seamRightX - SKEW_DX * 0.5, life: 0.48, maxLife: 0.48, col: this.accent.sec }
      );

      // Crisp sparks flying off the two parallel opening edges
      const count = isCelebrate ? 54 : 32;
      for (let i = 0; i < count; i++) {
        const onRight = i % 2 === 1;
        const frac = Math.random();
        const bx = (onRight ? this.seamRightX : this.seamLeftX) + (0.5 - frac) * SKEW_DX;
        const by = 6 + frac * (VH - 12);
        const dir = onRight ? 1 : -1;
        this.sparks.push({
          x: bx,
          y: by,
          vx: dir * (24 + Math.random() * 68) + (Math.random() - 0.5) * 16,
          vy: -16 - Math.random() * 44,
          s: Math.random() < 0.36 ? 2 : 1,
          life: 0.40 + Math.random() * 0.48,
          maxLife: 0.88,
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
      for (let i = this.slashes.length - 1; i >= 0; i--) {
        this.slashes[i].life -= dt;
        if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
      }
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        s.life -= dt;
        if (s.life <= 0) { this.sparks.splice(i, 1); continue; }
        s.vx *= Math.pow(0.93, dt * 60);
        s.vy = s.vy * Math.pow(0.95, dt * 60) + 34 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      for (const m of this.motes) {
        m.x += (m.vx + Math.sin(this.time * 1.1 + m.ph) * 3.2) * dt;
        m.y += m.vy * dt;
        if (m.y < -4) {
          m.y = VH + 3;
          if (m.nearSeam && this.seamsReady) {
            const onRight = Math.random() < 0.5;
            m.x = (onRight ? this.seamRightX : this.seamLeftX) - SKEW_DX * 0.5 + (Math.random() - 0.5) * 26;
          } else {
            m.x = Math.random() * VW;
          }
        }
        if (m.x < -4) m.x = VW + 4;
        if (m.x > VW + 4) m.x = -4;
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
      const mainC = PFX.hex(this.accent.main);
      const secC = PFX.hex(this.accent.sec);

      // 1. Living floating ambient stardust (never lets the Hero Gallery feel frozen!)
      for (const m of this.motes) {
        const tw = 0.22 + 0.78 * (0.5 + 0.5 * Math.sin(this.time * m.spd + m.ph));
        const col = m.isWhite ? whiteC : (m.useSec ? secC : mainC);
        const alpha = tw * (m.nearSeam ? 0.68 : 0.48);
        const rx = Math.round(m.x);
        const ry = Math.round(m.y);
        p.rect(rx, ry, m.s, m.s, col, alpha);
        if (tw > 0.74) {
          p.glow(m.x, m.y, m.s === 2 ? 3.2 : 2.2, col, 0.16 * tw);
        }
      }

      // 2. Subtle breathing traveling starlight glints along both settled parallel borders
      if (this.seamsReady && !this.slashes.length) {
        const tL = (this.time * 0.24) % 1;
        const tR = (this.time * 0.24 + 0.52) % 1;
        const drawSeamGlint = (seamX, frac, col) => {
          const yHead = frac * VH;
          const yTail = Math.max(0, yHead - 22);
          const xHead = seamX + (0.5 - yHead / VH) * SKEW_DX;
          const xTail = seamX + (0.5 - yTail / VH) * SKEW_DX;
          const env = Math.sin(frac * Math.PI);
          if (env <= 0.04) return;
          p.glowLine(xTail, yTail, xHead, yHead, 3.2, col, 0.34 * env);
          p.line(xTail, yTail, xHead, yHead, whiteC, 0.42 * env);
          if (env > 0.5) {
            PFX.sparkle(p, xHead, yHead, 3.2 * env, whiteC, col, 0.55 * env);
          }
        };
        drawSeamGlint(this.seamLeftX, tL, mainC);
        drawSeamGlint(this.seamRightX, 1 - tR, secC);
      }

      // 3. Razor-sharp FOREGROUND diagonal light blades right along the opening seams!
      for (const sl of this.slashes) {
        const prog = 1 - sl.life / sl.maxLife;
        const fade = 1 - PFX.smooth(0.22, 1, prog);
        const col = PFX.hex(sl.col);
        const curY = Math.min(VH, prog * 3.5 * VH);
        const xEnd = sl.xTop + (sl.xBot - sl.xTop) * (curY / VH);
        p.glowLine(sl.xTop, 0, xEnd, curY, 7 * fade + 1, col, 0.72 * fade);
        p.line(sl.xTop, 0, xEnd, curY, whiteC, fade);
        if (fade > 0.2) {
          PFX.sparkle(p, xEnd, Math.min(VH - 6, curY), 7 * fade, whiteC, col, 0.95 * fade);
        }
      }

      // 4. Burst sparks off edges
      for (const s of this.sparks) {
        const a = Math.max(0, Math.min(1, s.life / 0.42));
        const col = PFX.hex(s.col);
        p.rect(Math.round(s.x), Math.round(s.y), s.s, s.s, col, a);
        if (a > 0.5) p.glow(s.x, s.y, 2.5, col, 0.24 * a);
      }

      PFX.composite(this.frame, this.imgData.data, null, 1.15);
      this.offCtx.putImageData(this.imgData, 0, 0);

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.off, 0, 0, VW, VH, 0, 0, W, H);
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // v18.0 THEME SANCTUM LIVING ASTROLABE & ELEMENTAL PARTICLE STAGE
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
      this.motes = this._createMotes();
      this.bursts = [];
      this.rings = [];
    }

    _createMotes() {
      const arr = [];
      for (let i = 0; i < 46; i++) {
        arr.push({
          x: Math.random() * VW,
          y: Math.random() * VH,
          vx: (Math.random() - 0.5) * 9,
          vy: -(5 + Math.random() * 14),
          ph: Math.random() * Math.PI * 2,
          spd: 1.5 + Math.random() * 3.0,
          s: Math.random() < 0.28 ? 2 : 1,
          useSec: i % 3 === 0
        });
      }
      return arr;
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
        this.rings.push({ x: 96, y: 74, r: 8, maxR: 72, life: 0.55, maxLife: 0.55, col: this.accent.main });
      }
    }

    triggerBurst(themeId, intense = false) {
      if (themeId) this.accent = THEME_ACCENTS[themeId] || this.accent;
      const cx = 160;
      const cy = 76;
      const n = intense ? 42 : 24;
      this.rings.push({ x: cx, y: cy, r: 6, maxR: intense ? 96 : 64, life: 0.58, maxLife: 0.58, col: this.accent.main });
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.25;
        const spd = (intense ? 40 : 26) + Math.random() * 68;
        this.bursts.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd - 8,
          s: Math.random() < 0.4 ? 2 : 1,
          life: 0.42 + Math.random() * 0.42,
          col: i % 4 === 0 ? '#ffffff' : (i % 2 === 0 ? this.accent.main : this.accent.sec)
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
      this.bursts = [];
      this.rings = [];
      if (this.ctx) this.ctx.clearRect(0, 0, W, H);
    }

    _update(dt) {
      this.time += dt;
      const drift = this.accent.drift || 'rise';
      for (const m of this.motes) {
        if (drift === 'wind') {
          m.x += (16 + m.vx * 0.5) * dt;
          m.y += (m.vy * 0.45 + Math.sin(this.time * 2.2 + m.ph) * 4) * dt;
        } else if (drift === 'snow') {
          m.x += Math.sin(this.time * 1.4 + m.ph) * 7 * dt;
          m.y += Math.abs(m.vy) * 0.65 * dt;
        } else {
          m.x += (m.vx * 0.4 + Math.sin(this.time * 1.3 + m.ph) * 4.5) * dt;
          m.y += m.vy * dt;
        }
        if (m.y < -4) { m.y = VH + 4; m.x = Math.random() * VW; }
        if (m.y > VH + 4) { m.y = -4; m.x = Math.random() * VW; }
        if (m.x < -4) m.x = VW + 4;
        if (m.x > VW + 4) m.x = -4;
      }
      for (let i = this.bursts.length - 1; i >= 0; i--) {
        const b = this.bursts[i];
        b.life -= dt;
        if (b.life <= 0) { this.bursts.splice(i, 1); continue; }
        b.vx *= Math.pow(0.93, dt * 60);
        b.vy = b.vy * Math.pow(0.94, dt * 60) + 26 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        this.rings[i].life -= dt;
        if (this.rings[i].life <= 0) this.rings.splice(i, 1);
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

      // 1. Subtle rotating arcane astrolabe horizon halo behind left showcase pedestal
      const cx = 94;
      const cy = 78;
      const breathe = 0.85 + 0.15 * Math.sin(this.time * 1.8);
      p.glow(cx, cy, 62 * breathe, mainC, 0.14);
      p.glow(244, 62, 46, secC, 0.08);

      // Perspective rune ring under the 4-hero stone dais
      const rx = 68;
      const ry = 13;
      const daisY = 98;
      const dots = 24;
      for (let i = 0; i < dots; i++) {
        const ang = (Math.PI * 2 * i) / dots + this.time * 0.42;
        const px = cx + Math.cos(ang) * rx;
        const py = daisY + Math.sin(ang) * ry;
        const depth = 0.35 + 0.65 * ((Math.sin(ang) + 1) * 0.5);
        p.rect(Math.round(px), Math.round(py), i % 3 === 0 ? 2 : 1, 1, i % 4 === 0 ? whiteC : mainC, 0.52 * depth);
      }

      // Faint diagonal speedlines echo matching the slanted aesthetic
      for (let i = 0; i < 4; i++) {
        const lx = ((this.time * 8 + i * 86) % (VW + 60)) - 30;
        p.line(lx + SKEW_DX * 0.45, 0, lx - SKEW_DX * 0.45, VH, mainC, 0.06);
      }

      // 2. Elemental drifting particles
      for (const m of this.motes) {
        const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(this.time * m.spd + m.ph));
        const col = m.useSec ? secC : mainC;
        p.rect(Math.round(m.x), Math.round(m.y), m.s, m.s, col, 0.58 * tw);
        if (tw > 0.78) p.glow(m.x, m.y, 2.5, col, 0.16 * tw);
      }

      // 3. Expanding focus / equip shockwave rings
      for (const r of this.rings) {
        const prog = 1 - r.life / r.maxLife;
        const rad = r.r + (r.maxR - r.r) * (1 - Math.pow(1 - prog, 2.4));
        const fade = (1 - prog) * 0.65;
        const col = PFX.hex(r.col);
        const segs = 28;
        for (let i = 0; i < segs; i++) {
          const a = (Math.PI * 2 * i) / segs;
          p.rect(Math.round(r.x + Math.cos(a) * rad), Math.round(r.y + Math.sin(a) * rad * 0.32), 2, 1, col, fade);
        }
      }

      // 4. Equip / unlock burst sparks
      for (const b of this.bursts) {
        const a = Math.max(0, Math.min(1, b.life / 0.42));
        const col = PFX.hex(b.col);
        p.rect(Math.round(b.x), Math.round(b.y), b.s, b.s, col, a);
        if (a > 0.45) p.glow(b.x, b.y, 2.6, col, 0.24 * a);
      }

      PFX.composite(this.frame, this.imgData.data, null, 1.15);
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
