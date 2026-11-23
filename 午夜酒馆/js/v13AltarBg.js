// v13.0 Eclipse Star-Altar Ambient Pixel Backdrop (1280x720 = 320x180 x 4)
// Unified Dark-Fantasy Art DNA with Mirror-Lake Battle Theater:
// Deep indigo-violet starlit nebula, distant crimson solar eclipse sigil, obsidian stone tabletop runes & drifting cyan/crimson embers.
(function () {
  window.MT = window.MT || {};

  const W = 1280, H = 720, VW = 320, VH = 180;

  class EclipseAltarBg {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.canvas.width = W;
      this.canvas.height = H;
      this.running = false;
      this.rafId = null;
      this.lastTs = 0;
      this.time = 0;
      this.bgCanvas = null;

      this.embers = Array.from({ length: 34 }, (_, i) => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 14,
        vy: -8 - Math.random() * 14,
        size: i % 3 === 0 ? 4 : 3,
        phase: Math.random() * 6.28,
        cool: i % 2 === 0
      }));
    }

    bakeStatic() {
      const c = document.createElement('canvas');
      c.width = VW; c.height = VH;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // Deep indigo-to-abyssal-crimson ambient gradient
      const g = ctx.createLinearGradient(0, 0, VW, VH);
      g.addColorStop(0, '#0d0e24');
      g.addColorStop(0.48, '#16132e');
      g.addColorStop(1, '#261029');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VW, VH);

      // Subtle obsidian tiled altar floor grid
      ctx.fillStyle = 'rgba(8, 6, 18, 0.45)';
      for (let y = 0; y < VH; y += 16) ctx.fillRect(0, y, VW, 1);
      for (let x = 0; x < VW; x += 16) ctx.fillRect(x, 0, 1, VH);

      // Subtle pixel stars
      for (let i = 0; i < 65; i++) {
        const sx = (i * 53 + 17) % VW;
        const sy = (i * 37 + 11) % VH;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(142,240,255,0.28)' : 'rgba(255,190,210,0.22)';
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Giant subtle carved Solar Eclipse Emblem in background center
      const cx = 196, cy = 94;
      ctx.strokeStyle = 'rgba(255, 110, 150, 0.14)';
      ctx.lineWidth = 1;
      for (const r of [38, 56, 74]) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Subtle radial star ticks
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 38, cy + Math.sin(a) * 38);
        ctx.lineTo(cx + Math.cos(a) * 74, cy + Math.sin(a) * 74);
        ctx.stroke();
      }

      this.bgCanvas = c;
    }

    start() {
      if (this.running) return;
      if (!this.bgCanvas) this.bakeStatic();
      this.running = true;
      this.lastTs = performance.now();
      const tick = (ts) => {
        if (!this.running) return;
        const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
        this.lastTs = ts;
        this.time += dt;
        this.render(dt);
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    }

    stop() {
      this.running = false;
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    }

    shake() {}
    syncMercenaries() {}

    render(dt) {
      const ctx = this.ctx;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.bgCanvas, 0, 0, VW, VH, 0, 0, W, H);

      // Slow pulsing dual eclipse glows (cyan moonlight left, eclipse crimson right)
      const p1 = 0.85 + Math.sin(this.time * 1.4) * 0.15;
      const p2 = 0.85 + Math.cos(this.time * 1.1) * 0.15;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const lg = ctx.createRadialGradient(210, 320, 20, 210, 320, 420);
      lg.addColorStop(0, `rgba(70, 175, 255, ${0.14 * p1})`);
      lg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, 680, H);

      const rg = ctx.createRadialGradient(840, 380, 30, 840, 380, 480);
      rg.addColorStop(0, `rgba(220, 70, 130, ${0.16 * p2})`);
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rg;
      ctx.fillRect(320, 0, 960, H);

      // Drifting glowing pixel star-embers
      for (const e of this.embers) {
        e.x += (e.vx + Math.sin(this.time * 1.5 + e.phase) * 10) * dt;
        e.y += e.vy * dt;
        if (e.y < -10) { e.y = H + 8; e.x = Math.random() * W; }
        if (e.x < 0) e.x = W;
        if (e.x > W) e.x = 0;
        const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(this.time * 2.8 + e.phase));
        ctx.globalAlpha = a;
        ctx.fillStyle = e.cool ? '#7ceeff' : '#ffb870';
        ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
      }
      ctx.restore();
    }
  }

  window.MT.EclipseAltarBg = EclipseAltarBg;
})();
