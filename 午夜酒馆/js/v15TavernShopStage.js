// v15.4 HD-2D Midnight Tavern Interior Stage + Full-Bleed Boss Monolith + Pure-VFX Packs
// Single unified 60fps loop driving:
//   1. #altar-bg-canvas (1280x720): native 16-bit pixel tavern interior, window night rain,
//      breathing torches/candles, rising embers, reactive landlady, and live resting Duelyst squad.
//   2. #shop-boss-fx-canvas (362x188): Full-bleed HD-2D Boss Encounter Monolith with 4 distinct
//      theatrical threat ranks (Ember Forge / Blood Moon / Elemental Rift / Abyssal Eclipse),
//      heroic normalized Boss scaling (~134-158px tall!), and click-to-roar attack burst!
//   3. #shop-pack-hero-fx & #shop-pack-inscrip-fx (184x136): Pure-VFX pack artwork (NO square icons!)
//      — Holographic 3-Card Celestial Fan for Booster Sachet & Counter-Rotating Arcane Sigil for Rune Coffer.
(function () {
  window.MT = window.MT || {};

  const W = 1280;
  const H = 720;

  const ROOM_ASSETS = {
    1: './assets/tavern/room_lv1.png',
    2: './assets/tavern/room_lv2.png',
    3: './assets/tavern/room_lv3.png'
  };
  const LANDLADY_ASSET = './assets/tavern/landlady_pixel.png';

  const THEME_FOOT_COLORS = {
    core: '#ffd966',
    discard: '#c586ff',
    shield: '#6be5ff',
    poison: '#7ef28a',
    frost: '#8be9ff',
    hand: '#ffb86c',
    exhaust: '#ff79c6',
    blood: '#ff5c72',
    gamble: '#ffe66d'
  };

  // Cleanly staggered 2-row resting spots inside lower-left tavern wooden floor (x: 24..446, y: 520..700)
  const REST_SPOTS = [
    { x: 74,  y: 588, flipX: false, scale: 0.92 },
    { x: 156, y: 584, flipX: false, scale: 0.92 },
    { x: 238, y: 588, flipX: true,  scale: 0.92 },
    { x: 320, y: 586, flipX: true,  scale: 0.92 },
    { x: 64,  y: 662, flipX: false, scale: 1.00 },
    { x: 144, y: 664, flipX: false, scale: 1.00 },
    { x: 224, y: 662, flipX: false, scale: 1.00 },
    { x: 304, y: 664, flipX: true,  scale: 1.00 },
    { x: 112, y: 625, flipX: false, scale: 0.94 },
    { x: 276, y: 625, flipX: true,  scale: 0.94 }
  ];

  // Torch & table candle light anchors matching room_lv1..3 interior architecture
  const LIGHT_ANCHORS = [
    { x: 122, y: 178, r: 170, color: [255, 168, 72],  base: 0.24, freq: 3.1, phase: 0.2 },
    { x: 430, y: 172, r: 165, color: [255, 162, 68],  base: 0.20, freq: 2.7, phase: 1.4 },
    { x: 840, y: 176, r: 175, color: [255, 164, 70],  base: 0.20, freq: 3.4, phase: 2.8 },
    { x: 1152, y: 184, r: 175, color: [255, 154, 64], base: 0.23, freq: 2.9, phase: 4.1 },
    { x: 210, y: 626, r: 220, color: [255, 186, 94],  base: 0.22, freq: 2.2, phase: 0.9 },
    { x: 404, y: 626, r: 135, color: [255, 206, 118], base: 0.20, freq: 3.7, phase: 2.2 }
  ];

  const BOSS_STAGE_PALETTES = {
    ember: {
      skyTop: '#19100e',
      skyBot: '#090606',
      core: [255, 146, 66],
      rim: [212, 68, 36],
      spark: '#ffc478',
      ring: 'rgba(255, 186, 98, 0.45)',
      floor: 'rgba(184, 88, 38, 0.34)'
    },
    blood: {
      skyTop: '#240910',
      skyBot: '#0a0306',
      core: [248, 48, 82],
      rim: [148, 12, 42],
      spark: '#ff7d96',
      ring: 'rgba(255, 86, 118, 0.62)',
      floor: 'rgba(196, 24, 52, 0.38)'
    },
    frost: {
      skyTop: '#0b1c2c',
      skyBot: '#050b14',
      core: [96, 224, 255],
      rim: [34, 126, 214],
      spark: '#ccf7ff',
      ring: 'rgba(122, 232, 255, 0.68)',
      floor: 'rgba(72, 188, 242, 0.36)'
    },
    inferno: {
      skyTop: '#2a1009',
      skyBot: '#0d0404',
      core: [255, 124, 38],
      rim: [204, 32, 24],
      spark: '#ffe282',
      ring: 'rgba(255, 162, 68, 0.72)',
      floor: 'rgba(235, 88, 28, 0.42)'
    },
    eclipse: {
      skyTop: '#1b0921',
      skyBot: '#07030b',
      core: [255, 68, 138],
      rim: [255, 208, 78],
      spark: '#ffe68c',
      ring: 'rgba(255, 214, 102, 0.82)',
      floor: 'rgba(235, 164, 62, 0.42)'
    }
  };

  class TavernShopStage {
    constructor(canvas, sprites) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.sprites = sprites || null;

      this.rooms = {};
      this.landladyImg = null;
      this.wave = 1;
      this.roster = [];

      // Embedded Full-Bleed Boss Monolith Canvas
      this.bossCanvas = null;
      this.bossCtx = null;
      this.bossMeta = { tier: 1, aura: 'ember', unitId: null };
      this.bossRoarTime = 0;
      this.bossMotes = [];

      // Embedded Pure-VFX Booster Pack & Rune Coffer Canvases
      this.packHeroCanvas = null;
      this.packHeroCtx = null;
      this.packInscripCanvas = null;
      this.packInscripCtx = null;
      this.packMotes = [];

      this.running = false;
      this.rafId = 0;
      this.lastTs = 0;
      this.time = 0;
      this.celebrateTime = 0;
      this.celebrateColor = '#ffd966';

      this.reducedMotion = Boolean(
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );

      this.rainDrops = [];
      this.embers = [];
      this.sparkles = [];

      this._initParticles();
      this._preloadImages();
    }

    _preloadImages() {
      // Lazy-load tavern room backdrops on demand in _getRoomImg() so initial startup saves ~6MB!
      this.landladyImg = null;
    }

    _ensureRoomTierLoaded(tier) {
      if (!this.rooms[tier] && ROOM_ASSETS[tier]) {
        const img = new Image();
        img.src = ROOM_ASSETS[tier];
        this.rooms[tier] = img;
      }
      if (!this.landladyImg) {
        const ll = new Image();
        ll.src = LANDLADY_ASSET;
        this.landladyImg = ll;
      }
    }

    _initParticles() {
      for (let i = 0; i < 42; i++) {
        this.rainDrops.push({
          x: Math.random() * W,
          y: 54 + Math.random() * 145,
          len: 12 + Math.random() * 14,
          speed: 220 + Math.random() * 140,
          alpha: 0.14 + Math.random() * 0.22
        });
      }
      for (let i = 0; i < 28; i++) {
        this.embers.push({
          x: Math.random() * W,
          y: 120 + Math.random() * (H - 120),
          vx: (Math.random() - 0.5) * 14,
          vy: -(12 + Math.random() * 20),
          size: Math.random() < 0.35 ? 3 : 2,
          phase: Math.random() * Math.PI * 2,
          alpha: 0.25 + Math.random() * 0.45
        });
      }
      this._initBossMotes(26);
      this.packMotes = [];
      for (let i = 0; i < 22; i++) {
        this.packMotes.push({
          x: Math.random() * 184,
          y: Math.random() * 136,
          vx: (Math.random() - 0.5) * 18,
          vy: -(14 + Math.random() * 28),
          size: i % 3 === 0 ? 3 : 2,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    _initBossMotes(count) {
      this.bossMotes = [];
      for (let i = 0; i < count; i++) {
        this.bossMotes.push({
          x: 16 + Math.random() * 330,
          y: 10 + Math.random() * 170,
          vx: (Math.random() - 0.5) * 32,
          vy: -(18 + Math.random() * 48),
          size: i % 4 === 0 ? 4 : (i % 2 === 0 ? 3 : 2),
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    attachBossCanvas(canvas, meta = {}) {
      this.bossCanvas = canvas || null;
      this.bossCtx = canvas ? canvas.getContext('2d') : null;
      this.bossMeta = {
        tier: meta.tier || 1,
        aura: meta.aura || 'ember',
        unitId: meta.unitId || null
      };
      this.bossRoarTime = 0;
      const moteCount = 18 + (this.bossMeta.tier * 9);
      this._initBossMotes(moteCount);
      if (this.bossCtx) {
        this._renderBossShrine(this.time);
      }
    }

    attachPackCanvases({ heroCanvas = null, inscripCanvas = null } = {}) {
      this.packHeroCanvas = heroCanvas;
      this.packHeroCtx = heroCanvas ? heroCanvas.getContext('2d') : null;
      this.packInscripCanvas = inscripCanvas;
      this.packInscripCtx = inscripCanvas ? inscripCanvas.getContext('2d') : null;
      this._renderPackCanvases(this.time);
    }

    triggerBossRoar() {
      this.bossRoarTime = 0.78;
    }

    setState({ wave, roster } = {}) {
      if (typeof wave === 'number') this.wave = wave;
      if (Array.isArray(roster)) {
        this.roster = roster.slice(0, REST_SPOTS.length).map((h, idx) => ({
          uid: h.uid || `${h.id}_${idx}`,
          unitId: h.unitId,
          name: h.shortName || h.name,
          atk: h.atk,
          baseAtk: h.baseAtk,
          tier: h.tier,
          theme: h.theme || 'core',
          redSeal: Boolean(h.redSeal),
          glassBlade: Boolean(h.glassBlade),
          spot: REST_SPOTS[idx]
        }));
      }
      if (this.running && this.reducedMotion) {
        this._render(this.time);
        this._renderBossShrine(this.time);
        this._renderPackCanvases(this.time);
      }
    }

    triggerCelebrate(color = '#ffd966') {
      this.celebrateTime = 0.85;
      this.celebrateColor = color || '#ffd966';
      const origins = [
        { x: 404, y: 616 },
        { x: 860, y: 340 }
      ];
      for (const orig of origins) {
        for (let i = 0; i < 11; i++) {
          const ang = (Math.PI * 2 * i) / 11 + (Math.random() - 0.5) * 0.45;
          const spd = 48 + Math.random() * 96;
          this.sparkles.push({
            x: orig.x + (Math.random() - 0.5) * 26,
            y: orig.y + (Math.random() - 0.5) * 20,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 36,
            life: 0.55 + Math.random() * 0.35,
            maxLife: 0.9,
            size: Math.random() < 0.4 ? 4 : 3,
            color: i % 3 === 0 ? '#fff6cf' : this.celebrateColor
          });
        }
      }
    }

    start() {
      if (!this.ctx) return;
      if (this.running) return;
      this.running = true;
      this.lastTs = performance.now();
      if (this.reducedMotion) {
        this._render(this.time);
        this._renderBossShrine(this.time);
        this._renderPackCanvases(this.time);
        return;
      }
      const tick = (now) => {
        if (!this.running) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTs) / 1000));
        this.lastTs = now;
        this._update(dt);
        this._render(this.time);
        this._renderBossShrine(this.time);
        this._renderPackCanvases(this.time);
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
    }

    _update(dt) {
      this.time += dt;
      if (this.celebrateTime > 0) this.celebrateTime = Math.max(0, this.celebrateTime - dt);
      if (this.bossRoarTime > 0) this.bossRoarTime = Math.max(0, this.bossRoarTime - dt);

      for (const r of this.rainDrops) {
        r.x -= r.speed * 0.24 * dt;
        r.y += r.speed * dt;
        if (r.y > 205 || r.x < -20) {
          r.x = Math.random() * (W + 120);
          r.y = 48 + Math.random() * 24;
        }
      }

      for (const e of this.embers) {
        e.x += (e.vx + Math.sin(this.time * 1.4 + e.phase) * 8) * dt;
        e.y += e.vy * dt;
        if (e.y < 66) {
          e.y = H - 18;
          e.x = Math.random() * W;
        }
        if (e.x < 0) e.x = W;
        if (e.x > W) e.x = 0;
      }

      for (let i = this.sparkles.length - 1; i >= 0; i--) {
        const p = this.sparkles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.sparkles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt;
      }

      // Boss shrine elemental motes
      const boost = this.bossRoarTime > 0 ? 2.5 : 1;
      for (const m of this.bossMotes) {
        m.x += (m.vx + Math.sin(this.time * 2.6 + m.phase) * 16) * dt * boost;
        m.y += m.vy * dt * boost;
        if (m.y < 6) {
          m.y = 180;
          m.x = 18 + Math.random() * 326;
        }
        if (m.x < 6) m.x = 356;
        if (m.x > 356) m.x = 6;
      }

      // Pack VFX motes
      for (const m of this.packMotes) {
        m.x += (m.vx + Math.sin(this.time * 2.4 + m.phase) * 12) * dt;
        m.y += m.vy * dt;
        if (m.y < 4) {
          m.y = 132;
          m.x = 12 + Math.random() * 160;
        }
        if (m.x < 4) m.x = 180;
        if (m.x > 180) m.x = 4;
      }
    }

    _getRoomImg() {
      const tier = this.wave >= 6 ? 3 : this.wave >= 3 ? 2 : 1;
      this._ensureRoomTierLoaded(tier);
      const primary = this.rooms[tier];
      if (primary && primary.complete && primary.naturalWidth > 0) return primary;
      for (const k of [1, 2, 3]) {
        const fb = this.rooms[k];
        if (fb && fb.complete && fb.naturalWidth > 0) return fb;
      }
      return null;
    }

    // Compute heroic normalized draw scale so compact pixel Bosses (e.g. 42px) and tall Bosses (e.g. 90px)
    // BOTH tower imposingly inside the 362x188 Boss Monolith stage!
    _computeHeroicBossScale(unitId, tier) {
      const targetH = tier === 4 ? 148 : (tier === 3 ? 140 : (tier === 2 ? 134 : 128));
      if (this.sprites && this.sprites.getDuelystClip) {
        const dc = this.sprites.getDuelystClip(unitId, 'idle');
        if (dc && dc.idleClip && dc.idleClip.height > 0) {
          // drawUnit multiplies scale by 1.18 internally for Duelyst clips
          const rawScale = targetH / (dc.idleClip.height * 1.18);
          return Math.max(1.38, Math.min(2.65, rawScale));
        }
      }
      if (this.sprites && this.sprites.getFrameInfo) {
        const info = this.sprites.getFrameInfo(unitId, 'idle');
        if (info && info.frameH > 0) {
          return Math.max(1.35, Math.min(2.35, targetH / info.frameH));
        }
      }
      return tier === 4 ? 2.15 : 1.95;
    }

    _renderBossShrine(t) {
      const ctx = this.bossCtx;
      const c = this.bossCanvas;
      if (!ctx || !c || !c.isConnected) return;
      const bw = c.width;
      const bh = c.height;
      const cx = bw / 2;
      const cy = bh * 0.56;
      const tier = this.bossMeta.tier || 1;
      const aura = this.bossMeta.aura || 'ember';
      const pal = BOSS_STAGE_PALETTES[aura] || BOSS_STAGE_PALETTES.ember;
      const [cr, cg, cb] = pal.core;
      const [rr, rg, rb] = pal.rim;
      const roarBoost = this.bossRoarTime > 0 ? (this.bossRoarTime / 0.78) : 0;

      ctx.clearRect(0, 0, bw, bh);
      ctx.save();

      // 1. Deep Atmospheric Dark-Fantasy Backdrop Gradient
      const bg = ctx.createLinearGradient(0, 0, 0, bh);
      bg.addColorStop(0, pal.skyTop);
      bg.addColorStop(0.7, '#0d090b');
      bg.addColorStop(1, pal.skyBot);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, bw, bh);

      // Subtle architectural stone-pillar silhouette left & right
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx.fillRect(0, 0, 34, bh);
      ctx.fillRect(bw - 34, 0, 34, bh);
      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, 0.14)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(34, 0); ctx.lineTo(34, bh);
      ctx.moveTo(bw - 34, 0); ctx.lineTo(bw - 34, bh);
      ctx.stroke();

      // 2. Volumetric Back-Portal Glow
      const pulse = 0.90 + Math.sin(t * (2.5 + tier * 0.6)) * 0.10 + roarBoost * 0.35;
      const portalR = (96 + tier * 18) * pulse;
      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, portalR);
      g.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${(0.42 + tier * 0.08 + roarBoost * 0.28).toFixed(3)})`);
      g.addColorStop(0.52, `rgba(${rr}, ${rg}, ${rb}, ${(0.22 + tier * 0.05).toFixed(3)})`);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, bw, bh);

      // 3. Tier-Specific Theatrical Stage Choreography
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(cx, cy - 6);

      if (tier === 1) {
        // Tier 1: Forged Ember Arch + Subtle Warm Torch Beams
        for (let i = -2; i <= 2; i++) {
          const ang = -Math.PI / 2 + i * 0.26 + Math.sin(t * 1.4 + i) * 0.03;
          ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.075)`;
          ctx.beginPath();
          ctx.moveTo(0, 22);
          ctx.lineTo(Math.cos(ang - 0.08) * 180, Math.sin(ang - 0.08) * 180);
          ctx.lineTo(Math.cos(ang + 0.08) * 180, Math.sin(ang + 0.08) * 180);
          ctx.closePath();
          ctx.fill();
        }
      }

      if (tier === 2) {
        // Tier 2: Crimson Blood-Moon + Rotating Ritual Sigil
        const moonG = ctx.createRadialGradient(0, -16, 4, 0, -16, 56);
        moonG.addColorStop(0, 'rgba(255, 110, 128, 0.56)');
        moonG.addColorStop(0.75, 'rgba(182, 18, 42, 0.34)');
        moonG.addColorStop(1, 'rgba(120, 0, 20, 0)');
        ctx.fillStyle = moonG;
        ctx.beginPath();
        ctx.arc(0, -16, 56, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.rotate(t * 0.52);
        ctx.strokeStyle = pal.ring;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(0, -4, 62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (tier >= 3) {
        // Tier 3 (Frost / Inferno) & Tier 4 (Eclipse): Volumetric Rotating Rays + Sacred Ring
        const rays = tier === 4 ? 12 : 8;
        for (let i = 0; i < rays; i++) {
          const ang = (Math.PI * 2 * i) / rays + t * (tier === 4 ? 0.45 : 0.26);
          ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${(tier === 4 ? 0.14 : 0.11) + roarBoost * 0.12})`;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang - 0.075) * 195, Math.sin(ang - 0.075) * 195);
          ctx.lineTo(Math.cos(ang + 0.075) * 195, Math.sin(ang + 0.075) * 195);
          ctx.closePath();
          ctx.fill();
        }

        ctx.save();
        ctx.rotate(t * (tier === 4 ? 0.62 : 0.38));
        ctx.strokeStyle = pal.ring;
        ctx.lineWidth = tier === 4 ? 2.2 : 1.6;
        ctx.setLineDash(tier === 4 ? [10, 6] : [7, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, 66, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (tier >= 4) {
        // Tier 4: Blazing Black-Sun Eclipse Corona + Counter-Rotating Gold Seal + Void Lightning
        ctx.save();
        ctx.rotate(-t * 0.85);
        ctx.strokeStyle = 'rgba(255, 226, 128, 0.72)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 9]);
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.strokeStyle = 'rgba(255, 236, 152, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 42 + Math.sin(t * 5.5) * 2.5, 0, Math.PI * 2);
        ctx.stroke();

        if (Math.sin(t * 16) > 0.48 || roarBoost > 0.15) {
          ctx.strokeStyle = '#fff5c4';
          ctx.lineWidth = 1.8;
          for (let b = 0; b < 3; b++) {
            const startAng = (t * 3.8 + b * 2.1) % (Math.PI * 2);
            ctx.beginPath();
            ctx.moveTo(Math.cos(startAng) * 34, Math.sin(startAng) * 34);
            ctx.lineTo(Math.cos(startAng + 0.24) * 76, Math.sin(startAng + 0.24) * 76);
            ctx.lineTo(Math.cos(startAng + 0.04) * 124, Math.sin(startAng + 0.04) * 124);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // 4. Perspective Stone Altar Ground Plane & Ground Shadow under Boss
      const floorY = bh - 26;
      const floorG = ctx.createRadialGradient(cx, floorY, 12, cx, floorY, 150);
      floorG.addColorStop(0, pal.floor);
      floorG.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = floorG;
      ctx.beginPath();
      ctx.ellipse(cx, floorY, 148, 26, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
      ctx.beginPath();
      ctx.ellipse(cx, floorY + 2, 62, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // 5. Roar Shockwave Ring on Click
      if (roarBoost > 0) {
        const prog = 1 - roarBoost;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = pal.spark;
        ctx.globalAlpha = roarBoost * 0.92;
        ctx.lineWidth = 4 * roarBoost;
        ctx.beginPath();
        ctx.arc(cx, cy - 4, 24 + prog * 145, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 6. Rising Elemental Motes
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const m of this.bossMotes) {
        const alpha = (0.38 + 0.52 * Math.sin(t * 4.8 + m.phase)) * Math.min(1, m.y / 36);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = pal.spark;
        ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
      }
      ctx.restore();

      // 7. HEROIC-SCALE Live Boss Pixel Sprite (normalized to ~128-148px tall so every Boss looms huge!)
      if (this.sprites && this.sprites.drawUnit && this.bossMeta.unitId) {
        const anim = this.bossRoarTime > 0 ? 'attack' : 'idle';
        const bossScale = this._computeHeroicBossScale(this.bossMeta.unitId, tier);
        const animTime = this.bossRoarTime > 0 ? (0.78 - this.bossRoarTime) * 1.45 : t;
        this.sprites.drawUnit(ctx, this.bossMeta.unitId, anim, animTime, cx, floorY + 2, {
          scale: bossScale,
          flipX: false,
          alpha: 1,
          outlineColor: `rgba(${cr}, ${cg}, ${cb}, ${tier >= 3 ? 0.72 : 0.48})`
        });
      }

      ctx.restore();
    }

    // Pure-VFX Live Artwork inside Booster Sachet & Arcane Rune Coffer (ZERO square icons!)
    _renderPackCanvases(t) {
      if (this.packHeroCtx && this.packHeroCanvas && this.packHeroCanvas.isConnected) {
        this._renderHeroPackVFX(this.packHeroCtx, this.packHeroCanvas.width, this.packHeroCanvas.height, t);
      }
      if (this.packInscripCtx && this.packInscripCanvas && this.packInscripCanvas.isConnected) {
        this._renderInscripCofferVFX(this.packInscripCtx, this.packInscripCanvas.width, this.packInscripCanvas.height, t);
      }
    }

    _renderHeroPackVFX(ctx, cw, ch, t) {
      // Strict 2x pixel-art Booster Card Fan (ZERO ctx.shadowBlur, ZERO smooth vector roundRect!)
      const p = 2;
      const pw = Math.floor(cw / p);
      const ph = Math.floor(ch / p);
      const cx = Math.floor(pw / 2);
      const cy = Math.floor(ph * 0.50);
      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.scale(p, p);

      // Stepped pixel starlight spokes
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI * 2 * i) / 8 + t * 0.35;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(118, 228, 255, 0.24)' : 'rgba(255, 222, 114, 0.18)';
        for (let r = 8; r < 34; r += 3) {
          ctx.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), 1, 1);
        }
      }

      // 3 crisp pixel-art tarot/hero cards (stair-stepped pixel frames!)
      const bob = Math.round(Math.sin(t * 2.6) * 1.5);
      const drawPxCard = (ox, oy, w, h, rim, fillTop, fillBot, isCenter) => {
        const x0 = Math.round(cx + ox - w / 2);
        const y0 = Math.round(cy + oy + bob - h / 2);
        // Dark pixel outline
        ctx.fillStyle = '#09111f';
        ctx.fillRect(x0 - 1, y0, w + 2, h);
        ctx.fillRect(x0, y0 - 1, w, h + 2);
        // Metallic rim
        ctx.fillStyle = rim;
        ctx.fillRect(x0, y0, w, h);
        // Inner body (two-tone pixel shade)
        ctx.fillStyle = fillTop;
        ctx.fillRect(x0 + 1, y0 + 1, w - 2, Math.floor((h - 2) * 0.5));
        ctx.fillStyle = fillBot;
        ctx.fillRect(x0 + 1, y0 + 1 + Math.floor((h - 2) * 0.5), w - 2, h - 2 - Math.floor((h - 2) * 0.5));
        // Corner pixel rivets
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x0 + 2, y0 + 2, 1, 1);
        ctx.fillRect(x0 + w - 3, y0 + 2, 1, 1);
        if (isCenter) {
          // Crisp 4-point pixel celestial star
          const sx = x0 + Math.floor(w / 2);
          const sy = y0 + Math.floor(h / 2);
          const sp = Math.sin(t * 4.5) > 0 ? 5 : 4;
          ctx.fillStyle = '#ffe588';
          ctx.fillRect(sx - sp, sy, sp * 2 + 1, 1);
          ctx.fillRect(sx, sy - sp, 1, sp * 2 + 1);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx - 1, sy - 1, 3, 3);
        }
      };

      drawPxCard(-14, 3, 16, 24, '#66ccff', '#1e4d7a', '#0f2744', false);
      drawPxCard(14, 3, 16, 24, '#66ccff', '#1e4d7a', '#0f2744', false);
      drawPxCard(0, -1, 20, 29, '#ffe27c', '#2e72b0', '#143359', true);

      // Ascending crisp pixel stardust
      for (let i = 0; i < this.packMotes.length; i++) {
        const m = this.packMotes[i];
        const a = 0.35 + 0.55 * Math.sin(t * 5.2 + m.phase);
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.fillStyle = i % 3 === 0 ? '#ffe588' : '#a8f2ff';
        ctx.fillRect(Math.round(m.x / p), Math.round(m.y / p), 1, 1);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    _renderInscripCofferVFX(ctx, cw, ch, t) {
      // Strict 2x pixel-art Arcane Rune Sigil (ZERO ctx.shadowBlur, ZERO smooth vector curves!)
      const p = 2;
      const pw = Math.floor(cw / p);
      const ph = Math.floor(ch / p);
      const cx = Math.floor(pw / 2);
      const cy = Math.floor(ph * 0.50);
      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.scale(p, p);

      const drawPxSeg = (x0, y0, x1, y1, col) => {
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        ctx.fillStyle = col;
        for (let g = 0; g < 96; g++) {
          ctx.fillRect(x0, y0, 1, 1);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      };

      // Outer stepped pixel rune circle
      const ringR = 20;
      ctx.fillStyle = '#d996ff';
      for (let k = 0; k < 36; k++) {
        if (k % 6 === 0) continue;
        const a = (k / 36) * Math.PI * 2 + t * 0.5;
        ctx.fillRect(Math.round(cx + Math.cos(a) * ringR), Math.round(cy + Math.sin(a) * ringR), 1, 1);
      }

      // Counter-rotating pixel hexagram (two stepped triangles)
      for (let tri = 0; tri < 2; tri++) {
        const pts = [];
        for (let k = 0; k < 3; k++) {
          const ang = (Math.PI * 2 * k) / 3 + (tri * Math.PI) / 3 - t * 0.7;
          pts.push([cx + Math.cos(ang) * 15, cy + Math.sin(ang) * 15]);
        }
        const col = tri === 0 ? '#ffd978' : '#e6a2ff';
        for (let k = 0; k < 3; k++) {
          drawPxSeg(pts[k][0], pts[k][1], pts[(k + 1) % 3][0], pts[(k + 1) % 3][1], col);
        }
      }

      // Breathing pixel core diamond crystal
      const rad = Math.sin(t * 4.2) > 0 ? 5 : 4;
      for (let dy = -rad; dy <= rad; dy++) {
        const hw = rad - Math.abs(dy);
        ctx.fillStyle = Math.abs(dy) <= 1 ? '#ffffff' : '#ffe699';
        ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
      }

      // Swirling pixel sparks
      for (let i = 0; i < this.packMotes.length; i++) {
        const m = this.packMotes[i];
        const a = 0.32 + 0.56 * Math.sin(t * 4.6 + m.phase + 1.2);
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.fillStyle = i % 3 === 0 ? '#ffd978' : '#e6a2ff';
        ctx.fillRect(Math.round((cw - m.x) / p), Math.round(m.y / p), 1, 1);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    _render(t) {
      const ctx = this.ctx;
      if (!ctx) return;

      ctx.save();
      ctx.imageSmoothingEnabled = false;

      // 1. Camp backdrop: warm near-black ground matching the hero select (no tavern room,
      //    no landlady, no squad on the floor - the squad now lives in the left DOM panel).
      ctx.fillStyle = '#100e0c';
      ctx.fillRect(0, 0, W, H);
      const glow = ctx.createRadialGradient(W * 0.62, H * 0.42, 40, W * 0.62, H * 0.42, 760);
      glow.addColorStop(0, 'rgba(92, 64, 34, 0.30)');
      glow.addColorStop(0.5, 'rgba(48, 32, 18, 0.16)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      const leftGlow = ctx.createRadialGradient(210, 220, 20, 210, 220, 420);
      leftGlow.addColorStop(0, 'rgba(140, 34, 46, 0.16)');
      leftGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = leftGlow;
      ctx.fillRect(0, 0, W, H);
      // faint diagonal bands, the same texture motif as the hero select canvas
      ctx.save();
      ctx.strokeStyle = 'rgba(212, 174, 104, 0.035)';
      ctx.lineWidth = 26;
      for (let x = -400; x < W + 400; x += 170) {
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x + 420, 0);
        ctx.stroke();
      }
      ctx.restore();
      const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, 260, W * 0.5, H * 0.5, 820);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(1, 'rgba(4, 3, 2, 0.7)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      // 8. Rising Golden Hearth Embers
      for (const e of this.embers) {
        const shimmer = 0.55 + 0.45 * Math.sin(t * 4.2 + e.phase);
        ctx.fillStyle = `rgba(255, 212, 118, ${(e.alpha * shimmer).toFixed(3)})`;
        ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
      }

      // 9. Celebration Pixel Sparkles
      for (const p of this.sparkles) {
        const a = Math.max(0, Math.min(1, p.life / p.maxLife));
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        ctx.restore();
      }

      ctx.restore();
    }

    _drawRestingSquad(ctx, t) {
      if (!this.roster || this.roster.length === 0) return;

      const sorted = [...this.roster].sort((a, b) => a.spot.y - b.spot.y);
      for (let i = 0; i < sorted.length; i++) {
        const h = sorted[i];
        const { x, y, flipX, scale } = h.spot;
        const footColor = THEME_FOOT_COLORS[h.theme] || '#ffd966';

        ctx.save();
        ctx.fillStyle = 'rgba(8, 4, 2, 0.62)';
        ctx.beginPath();
        ctx.ellipse(x, y + 3, 20 * scale, 6 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = h.redSeal ? 'rgba(255, 102, 128, 0.62)' : `${footColor}55`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, y + 3, 17 * scale, 5 * scale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        if (this.sprites && this.sprites.drawUnit && h.unitId) {
          const hop = this.celebrateTime > 0
            ? Math.abs(Math.sin((this.celebrateTime * 8) + i * 0.7)) * 6
            : 0;
          this.sprites.drawUnit(ctx, h.unitId, 'idle', t + i * 0.47, x, y - hop, {
            scale,
            flipX,
            alpha: 1,
            outlineColor: h.redSeal ? 'rgba(255, 92, 114, 0.48)' : 'rgba(255, 206, 118, 0.24)'
          });
        }

        ctx.save();
        ctx.font = '12px "FusionPixel", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#08060f';
        const label = `${h.name} ${h.atk}`;
        const lx = Math.round(x);
        const ly = Math.round(y + 7);
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = h.atk > h.baseAtk ? '#8cf59a' : '#f7e5be';
        ctx.fillText(label, lx, ly);
        ctx.restore();
      }
    }

    _drawLandlady(ctx, t) {
      const img = this.landladyImg;
      if (!img || !img.complete || img.naturalWidth <= 0) return;

      const cx = 404;
      const baseY = 672;
      const bob = Math.sin(t * 2.5) * 2.2;
      const celebBounce = this.celebrateTime > 0
        ? Math.sin((1 - this.celebrateTime / 0.85) * Math.PI * 2) * -9
        : 0;

      const drawH = 88;
      const drawW = Math.round((img.naturalWidth / img.naturalHeight) * drawH);
      const dx = Math.round(cx - drawW / 2);
      const dy = Math.round(baseY - drawH + bob + celebBounce);

      ctx.save();
      ctx.fillStyle = 'rgba(8, 4, 2, 0.68)';
      ctx.beginPath();
      ctx.ellipse(cx, baseY + 2, 24, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      if (this.celebrateTime > 0) {
        const ringAlpha = Math.min(0.75, this.celebrateTime);
        ctx.strokeStyle = `rgba(255, 217, 102, ${ringAlpha.toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, baseY + 2, 26 + (1 - this.celebrateTime) * 14, 8 + (1 - this.celebrateTime) * 4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();
    }
  }

  window.MT.TavernShopStage = TavernShopStage;
})();
