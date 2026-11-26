// v14.1 Main Controller: Live-Gear Heroes x 7-Phase Event Bus x Meta Orbs / 10 Neutral Heroes / 7 Rewarded Ad Placements
(function () {
  window.MT = window.MT || {};
  const D = window.MT.V14_DATA;
  const E = window.MT.V14_ENGINE;
  const M = window.MT.V14_META;
  const T = window.MT.V14_TAP;

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pxIcon(kind, cls = '') {
    const c = `v15-px-ico ${cls}`.trim();
    if (kind === 'atk') {
      return `<svg class="${c}" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="6" y="0" width="2" height="2" fill="#fff9d6"/><rect x="5" y="1" width="2" height="2" fill="#ffe266"/><rect x="4" y="2" width="2" height="2" fill="#ffe266"/><rect x="3" y="3" width="2" height="2" fill="#ffd24c"/><rect x="1" y="4" width="3" height="1" fill="#d48c1d"/><rect x="2" y="5" width="2" height="2" fill="#d48c1d"/><rect x="0" y="6" width="2" height="2" fill="#ffe266"/></svg>`;
    }
    if (kind === 'shield') {
      return `<svg class="${c}" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="1" y="0" width="6" height="5" fill="#3b82f6"/><rect x="2" y="1" width="4" height="4" fill="#7be8ff"/><rect x="2" y="1" width="1" height="3" fill="#ffffff"/><rect x="2" y="5" width="4" height="2" fill="#3b82f6"/><rect x="3" y="7" width="2" height="1" fill="#2563eb"/></svg>`;
    }
    if (kind === 'poison') {
      return `<svg class="${c}" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="3" y="0" width="2" height="2" fill="#34d399"/><rect x="2" y="2" width="4" height="4" fill="#22c55e"/><rect x="1" y="3" width="6" height="3" fill="#4ade80"/><rect x="2" y="3" width="2" height="2" fill="#bbf7d0"/><rect x="2" y="6" width="4" height="2" fill="#16a34a"/></svg>`;
    }
    if (kind === 'gold') {
      return `<svg class="${c}" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="2" y="0" width="4" height="8" fill="#d48c1d"/><rect x="1" y="1" width="6" height="6" fill="#ffe266"/><rect x="2" y="1" width="2" height="2" fill="#fff9d6"/><rect x="3" y="2" width="2" height="4" fill="#b4690e"/></svg>`;
    }
    if (kind === 'hit') {
      return `<svg class="${c}" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="4" y="0" width="2" height="2" fill="#fff9d6"/><rect x="3" y="2" width="3" height="2" fill="#ffe266"/><rect x="1" y="3" width="5" height="2" fill="#ffffff"/><rect x="2" y="5" width="3" height="2" fill="#ffe266"/><rect x="1" y="7" width="2" height="1" fill="#ffd24c"/></svg>`;
    }
    if (kind === 'orb') {
      return `<svg class="${c}" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="3" y="0" width="2" height="1" fill="#b4f0ff"/><rect x="2" y="1" width="4" height="2" fill="#6be5ff"/><rect x="1" y="3" width="6" height="2" fill="#38bdf8"/><rect x="2" y="2" width="2" height="2" fill="#ffffff"/><rect x="2" y="5" width="4" height="2" fill="#0284c7"/><rect x="3" y="7" width="2" height="1" fill="#0369a1"/></svg>`;
    }
    if (kind === 'play') {
      return `<svg class="${c}" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="1" y="1" width="2" height="6" fill="#fff6d6"/><rect x="3" y="2" width="2" height="4" fill="#ffe266"/><rect x="5" y="3" width="2" height="2" fill="#ffd24c"/></svg>`;
    }
    if (kind === 'check') {
      return `<svg class="${c}" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="6" y="1" width="2" height="2" fill="#a7f3d0"/><rect x="5" y="2" width="2" height="2" fill="#7ef28a"/><rect x="4" y="3" width="2" height="2" fill="#4ade80"/><rect x="3" y="4" width="2" height="2" fill="#4ade80"/><rect x="1" y="3" width="2" height="2" fill="#7ef28a"/><rect x="2" y="5" width="2" height="2" fill="#22c55e"/></svg>`;
    }
    if (kind === 'cloud') {
      return `<svg class="${c}" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="2" y="2" width="4" height="2" fill="#a5f3fc"/><rect x="1" y="3" width="6" height="3" fill="#6be5ff"/><rect x="2" y="3" width="2" height="1" fill="#ffffff"/></svg>`;
    }
    return '';
  }

  function renderCardTierOrnament(tier, w = 78, h = 104) {
    if (tier === 'C') return '';
    const border = tier === 'SSS' ? `<div class="v15-b-border"></div>` : '';
    const holo = (tier === 'S' || tier === 'SSS') ? `<div class="v15-b-holo"></div>` : '';
    return `
      ${border}
      <div class="v15-card-window">
        <canvas class="v15-card-fx-canvas" width="${w}" height="${h}" data-fx="${tier}"></canvas>
        ${holo}
        <div class="v15-b-specular"></div>
      </div>
    `;
  }

  class V14App {
    constructor() {
      this.stage = $('stage');
      this.audio = window.MT.audio || window.MT.sfx;
      this.sprites = window.MT.sprites;
      this.vfx = window.MT.vfx;
      this.meta = M.manager;
      this.tap = T ? T.bridge : null;
      if (this.tap) {
        this.tap.onSyncStatusChange = (txt) => {
          const el = $('meta-sync-badge');
          if (el) el.textContent = `☁ ${txt}`;
        };
      }

      this.battleStage = new window.MT.V14BattleStage($('battle-canvas'));
      this.altarBg = window.MT.EclipseAltarBg ? new window.MT.EclipseAltarBg($('altar-bg-canvas')) : null;
      this.tavernShopStage = window.MT.TavernShopStage ? new window.MT.TavernShopStage($('altar-bg-canvas'), this.sprites) : null;
      this.packCeremonyFX = window.MT.PackCeremonyFX ? new window.MT.PackCeremonyFX($('pack-fx-canvas'), this.vfx) : null;
      this.titleRain = window.MT.TitleRainFX ? new window.MT.TitleRainFX($('title-fx-canvas')) : null;
      this.heroMusterStage = window.MT.HeroMusterStage ? new window.MT.HeroMusterStage(this.sprites, this.meta) : null;

      this.run = null;
      this.battle = null;
      this.shop = null;
      this.busy = false;
      this.discardMode = false;
      this.pureFilterMode = false; // Ad #7: pure filter without triggering discard skills
      this.discardPicks = new Set();
      this.swapSlotIdx = -1;
      this.selectedRelicUid = null;
      this.inspectedShopKey = null;
      this.activePackState = null;
      this.prepTab = 'heroes'; // 'heroes' | 'themes'
      this.previewHeroId = this.meta.data.selectedHeroId || 'hero_01';
      this.speed = 1;

      this.bindEvents();
      this.fitViewport();
      window.addEventListener('resize', () => this.fitViewport());
      this.boot();
    }

    async boot() {
      try {
        await this.sprites.load();
      } catch (_) {}
      this.meta.syncFromCloud(() => {
        if (!$('deck-select-modal').classList.contains('hidden')) this.renderPrepHall();
      });
      const demo = new URLSearchParams(window.location.search).get('demo');
      if (demo === 'tiers') {
        this.launchTierShowcase();
      } else {
        this.showTitleScreen();
      }
    }

    launchTierShowcase() {
      this.startNewRun('hero_01', true);
      const b = this.battle;
      if (!b) return;
      const pool = D.SHOP_HEROES || [];
      const pick = (tier, idx = 0) => {
        const list = pool.filter((h) => h.tier === tier);
        return (list[idx] || list[0] || {}).id;
      };
      const a1 = pick('A', 0) || 'c_shadow_follow';
      const a2 = pick('A', 1) || a1;
      const s1 = pick('S', 0) || 'c_lone_wolf';
      const s2 = pick('S', 1) || s1;
      const sss1 = pick('SSS', 0) || 'c_grand_drummer';
      const sss2 = pick('SSS', 1) || sss1;

      // Full 5-tier ladder (C / B / A / S / SSS) side-by-side in hand + (A / S / SSS) on bridge
      b.hand = ['st_blade', 'st_drummer', a1, s1, sss1].map((id) => D.makeHeroInstance(id));
      b.slots = [a2, s2, sss2].map((id) => D.makeHeroInstance(id));

      const rB = D.RELICS.find((r) => r.tier === 'B');
      const rS = D.RELICS.find((r) => r.tier === 'S');
      const rSSS = D.RELICS.find((r) => r.tier === 'SSS');
      this.run.relics = [rB, rS, rSSS].filter(Boolean).map((r) => D.makeRelicInstance(r));
      this.syncBattleUI();
    }

    bindInteractive3DTilt(el, maxY = 12, maxX = 10, resetOnLeave = true) {
      if (!el) return;
      el.onpointermove = (ev) => {
        if (el.classList.contains('dragging-centered') || el.classList.contains('in-slot') || el.classList.contains('sold')) return;
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        el._hoveringTilt = true;
        const nx = Math.max(-1, Math.min(1, ((ev.clientX - rect.left) / rect.width) * 2 - 1));
        const ny = Math.max(-1, Math.min(1, ((ev.clientY - rect.top) / rect.height) * 2 - 1));
        const ry = nx * maxY;
        const rx = -ny * maxX;
        el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
        el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
        el.style.setProperty('--mx', `${(50 + nx * 42).toFixed(1)}%`);
        el.style.setProperty('--my', `${(50 + ny * 42).toFixed(1)}%`);
        el.style.setProperty('--sh-x', `${(-ry * 0.75).toFixed(1)}px`);
        el.style.setProperty('--sh-y', `${(8 + rx * 0.55).toFixed(1)}px`);
      };
      el.onpointerleave = () => {
        el._hoveringTilt = false;
        if (resetOnLeave) {
          el.style.setProperty('--rx', '0deg');
          el.style.setProperty('--ry', '0deg');
          el.style.setProperty('--mx', '50%');
          el.style.setProperty('--my', '35%');
          el.style.setProperty('--sh-x', '0px');
          el.style.setProperty('--sh-y', '4px');
        }
      };
    }

    startCardFxLoop() {
      if (this._cardFxRaf) return;
      const initParticles = (canvas, kind) => {
        if (canvas._fxInit) return;
        canvas._fxInit = true;
        const countMap = { B: 14, A: 18, S: 20, SSS: 28 };
        const n = countMap[kind] || 16;
        canvas._pts = Array.from({ length: n }, () => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: kind === 'B' ? -10 - Math.random() * 6
            : kind === 'SSS' ? 16 + Math.random() * 24
            : (Math.random() - 0.5) * 6,
          vy: kind === 'B' ? 32 + Math.random() * 22
            : kind === 'A' ? -(10 + Math.random() * 14)
            : kind === 'S' ? -(6 + Math.random() * 11)
            : -(14 + Math.random() * 26),
          s: Math.random() < 0.35 ? 2 : 1,
          ph: Math.random() * Math.PI * 2
        }));
      };
      let lastTs = performance.now();
      const tick = (now) => {
        const dt = Math.min(0.05, (now - lastTs) / 1000);
        lastTs = now;
        const t = now * 0.001;
        const canvases = document.querySelectorAll('.v15-card-fx-canvas');
        const tiltCards = document.querySelectorAll('.v14-card-tier-A, .v14-card-tier-S, .v14-card-tier-SSS, .v15-idle-tilt');
        if (!canvases.length && !tiltCards.length) {
          this._cardFxRaf = 0;
          return;
        }

        // 1) Living Pixel Scene Windows (B: Mirror-Lake Rain | A: Amethyst Wisp | S: God Rays | SSS: Black Sun Eclipse)
        canvases.forEach((cv) => {
          const kind = cv.dataset.fx;
          const ctx = cv.getContext('2d');
          if (!ctx) return;
          initParticles(cv, kind);
          const W = cv.width;
          const H = cv.height;
          ctx.clearRect(0, 0, W, H);

          if (kind === 'B') {
            // Deep sapphire midnight lake backdrop
            const bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, '#0c203a');
            bg.addColorStop(0.62, '#081529');
            bg.addColorStop(1, '#050c1a');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            // Soft moonlight water glow near bottom
            const wg = ctx.createRadialGradient(W * 0.5, H * 0.72, 2, W * 0.5, H * 0.72, 34);
            wg.addColorStop(0, 'rgba(84, 198, 255, 0.28)');
            wg.addColorStop(1, 'rgba(30, 96, 160, 0)');
            ctx.fillStyle = wg;
            ctx.fillRect(0, 0, W, H);

            // Subtle shimmering mirror-lake ripples at bottom
            for (let i = 0; i < 4; i++) {
              const ry = 66 + i * 5;
              const rw = 16 + Math.sin(t * 2.2 + i * 1.4) * 7;
              const rx = Math.round(W * 0.5 - rw * 0.5 + Math.cos(t * 1.3 + i) * 4);
              ctx.fillStyle = `rgba(130, 224, 255, ${(0.18 - i * 0.03).toFixed(2)})`;
              ctx.fillRect(rx, ry, Math.round(rw), 1);
            }

            // Crisp diagonal pixel rain streaks
            cv._pts.forEach((p) => {
              p.x += p.vx * dt;
              p.y += p.vy * dt;
              if (p.y > H + 4 || p.x < -4) {
                p.y = -3 - Math.random() * 10;
                p.x = Math.random() * (W + 18);
              }
              const ix = Math.round(p.x);
              const iy = Math.round(p.y);
              ctx.fillStyle = 'rgba(132, 220, 255, 0.55)';
              ctx.fillRect(ix, iy, 1, 2);
              ctx.fillStyle = 'rgba(196, 242, 255, 0.85)';
              ctx.fillRect(ix - 1, iy + 2, 1, 2);
            });
          } else if (kind === 'A') {
            // Deep royal amethyst night
            const bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, '#160926');
            bg.addColorStop(0.55, '#220c3b');
            bg.addColorStop(1, '#301052');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            // Rising amethyst wisp core glow
            const ag = ctx.createRadialGradient(W * 0.5, H * 0.62, 3, W * 0.5, H * 0.62, 36);
            ag.addColorStop(0, 'rgba(216, 126, 255, 0.45)');
            ag.addColorStop(0.55, 'rgba(146, 62, 224, 0.22)');
            ag.addColorStop(1, 'rgba(30, 10, 56, 0)');
            ctx.fillStyle = ag;
            ctx.fillRect(0, 0, W, H);

            // Flickering pixel wisp tongues at lower stage
            for (let i = 0; i < 7; i++) {
              const fx = 12 + i * 8 + Math.sin(t * 2.6 + i * 1.5) * 2;
              const fh = 10 + Math.sin(t * 4.4 + i * 2.1) * 5;
              ctx.fillStyle = 'rgba(184, 96, 255, 0.26)';
              ctx.fillRect(Math.round(fx), Math.round(H - 18 - fh), 3, Math.round(fh));
              ctx.fillStyle = 'rgba(238, 196, 255, 0.35)';
              ctx.fillRect(Math.round(fx + 1), Math.round(H - 18 - fh * 0.5), 1, Math.round(fh * 0.5));
            }

            // Floating arcane lavender sparks
            cv._pts.forEach((p) => {
              p.y += p.vy * dt;
              p.x += (Math.sin(t * 2.4 + p.ph) * 8) * dt;
              if (p.y < -3) { p.y = H + 2; p.x = Math.random() * W; }
              if (p.x < 0) p.x += W;
              if (p.x >= W) p.x -= W;
              const tw = 0.45 + 0.55 * Math.sin(t * 4.5 + p.ph);
              ctx.fillStyle = tw > 0.8 ? `rgba(250,234,255,${tw.toFixed(2)})` : `rgba(210,136,255,${(tw * 0.9).toFixed(2)})`;
              ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
            });
          } else if (kind === 'S') {
            // Deep obsidian-amber cathedral backdrop
            const bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, '#2e1d06');
            bg.addColorStop(0.55, '#191004');
            bg.addColorStop(1, '#090602');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            // Diagonal golden cathedral God Rays
            const rays = [
              { x0: -6, w: 15, spd: 0.7, ph: 0.0, a: 0.28 },
              { x0: 18, w: 20, spd: 0.55, ph: 1.9, a: 0.34 },
              { x0: 44, w: 13, spd: 0.85, ph: 3.4, a: 0.24 }
            ];
            rays.forEach((r) => {
              const pulse = 0.65 + 0.35 * Math.sin(t * r.spd + r.ph);
              const shift = Math.sin(t * 0.4 + r.ph) * 3;
              const grad = ctx.createLinearGradient(r.x0 + shift, 0, r.x0 + 26 + shift, H * 0.82);
              grad.addColorStop(0, `rgba(255, 242, 174, ${(r.a * pulse).toFixed(3)})`);
              grad.addColorStop(0.65, `rgba(255, 198, 66, ${(r.a * 0.58 * pulse).toFixed(3)})`);
              grad.addColorStop(1, 'rgba(255, 170, 30, 0)');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.moveTo(Math.round(r.x0 + shift), 0);
              ctx.lineTo(Math.round(r.x0 + r.w + shift), 0);
              ctx.lineTo(Math.round(r.x0 + r.w + 26 + shift), H);
              ctx.lineTo(Math.round(r.x0 + 18 + shift), H);
              ctx.closePath();
              ctx.fill();
            });

            // Warm golden floor mist
            const fg = ctx.createRadialGradient(W * 0.5, H * 0.74, 2, W * 0.5, H * 0.74, 36);
            fg.addColorStop(0, 'rgba(255, 214, 92, 0.46)');
            fg.addColorStop(1, 'rgba(255, 174, 42, 0)');
            ctx.fillStyle = fg;
            ctx.fillRect(0, 0, W, H);

            // Drifting pixel golden light dust
            cv._pts.forEach((p) => {
              p.y += p.vy * dt;
              p.x += (p.vx + Math.sin(t * 1.8 + p.ph) * 5) * dt;
              if (p.y < -3) { p.y = H + 2; p.x = Math.random() * W; }
              if (p.x < 0) p.x += W;
              if (p.x >= W) p.x -= W;
              const tw = 0.45 + 0.55 * Math.sin(t * 4.2 + p.ph);
              ctx.fillStyle = tw > 0.82 ? `rgba(255,252,226,${tw.toFixed(2)})` : `rgba(255,212,84,${(tw * 0.88).toFixed(2)})`;
              ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
            });
          } else if (kind === 'SSS') {
            // Pitch-black void sky with crimson eclipse horizon
            const bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, '#090208');
            bg.addColorStop(0.52, '#1d0512');
            bg.addColorStop(1, '#320718');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            const cx = Math.round(W * 0.5);
            const cy = Math.round(H * 0.44);
            const aura = ctx.createRadialGradient(cx, cy, 10, cx, cy, 38);
            aura.addColorStop(0, 'rgba(255, 232, 130, 0.94)');
            aura.addColorStop(0.32, 'rgba(255, 72, 112, 0.74)');
            aura.addColorStop(0.68, 'rgba(180, 18, 62, 0.30)');
            aura.addColorStop(1, 'rgba(40, 4, 18, 0)');
            ctx.fillStyle = aura;
            ctx.fillRect(0, 0, W, H);

            // Animated pixel solar flare tongues around the Black Sun
            for (let i = 0; i < 16; i++) {
              const ang = (i / 16) * Math.PI * 2 + t * 0.55;
              const flare = 14 + Math.sin(t * 5.2 + i * 1.9) * 3.5 + (i % 2 ? 2.5 : 0);
              const px = Math.round(cx + Math.cos(ang) * flare);
              const py = Math.round(cy + Math.sin(ang) * flare);
              ctx.fillStyle = i % 2 === 0 ? '#ffd966' : '#ff4d7a';
              ctx.fillRect(px - 1, py - 1, 2, 2);
              const px2 = Math.round(cx + Math.cos(ang) * (flare + 3));
              const py2 = Math.round(cy + Math.sin(ang) * (flare + 3));
              ctx.fillStyle = 'rgba(255, 76, 120, 0.65)';
              ctx.fillRect(px2, py2, 1, 1);
            }

            // Blazing eclipse rim + pitch-black void core
            ctx.fillStyle = '#fff0b0';
            ctx.beginPath();
            ctx.arc(cx, cy, 13.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff3d6e';
            ctx.beginPath();
            ctx.arc(cx, cy, 12.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#070208';
            ctx.beginPath();
            ctx.arc(cx, cy, 11.2, 0, Math.PI * 2);
            ctx.fill();

            // Diagonal whipping crimson-gold ember storm
            cv._pts.forEach((p) => {
              p.x += p.vx * dt;
              p.y += p.vy * dt;
              if (p.y < -4 || p.x > W + 4) {
                if (Math.random() < 0.5) { p.x = Math.random() * W * 0.7; p.y = H + 2; }
                else { p.x = -2; p.y = H * 0.35 + Math.random() * H * 0.65; }
              }
              const ix = Math.round(p.x);
              const iy = Math.round(p.y);
              ctx.fillStyle = 'rgba(255, 58, 102, 0.65)';
              ctx.fillRect(ix - 2, iy + 2, 2, 1);
              ctx.fillStyle = p.s > 1 ? '#fff4c2' : '#ff8aa8';
              ctx.fillRect(ix, iy, p.s, p.s);
            });
          }
        });

        // 2) Organic Idle 3D Tilt + Glass Specular & Floating Hero Shadow (A gentle, S/SSS rich)
        tiltCards.forEach((card, idx) => {
          if (card._hoveringTilt || card.classList.contains('dragging-centered') || card.classList.contains('in-slot')) return;
          const isGentle = card.classList.contains('v14-card-tier-A') || card.classList.contains('v14-relic-chip') || card.classList.contains('v15-gentle-tilt');
          const ampY = isGentle ? 6.0 : 10.5;
          const ampX = isGentle ? 4.0 : 6.5;
          const phase = t * (isGentle ? 0.85 : 1.15) + idx * 1.65;
          const ry = Math.sin(phase) * ampY;
          const rx = Math.cos(phase * 0.85) * ampX;
          const mx = 50 + Math.sin(phase) * 34;
          const my = 50 + Math.cos(phase * 0.85) * 28;
          card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
          card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
          card.style.setProperty('--mx', `${mx.toFixed(1)}%`);
          card.style.setProperty('--my', `${my.toFixed(1)}%`);
          card.style.setProperty('--sh-x', `${(-ry * 0.72).toFixed(1)}px`);
          card.style.setProperty('--sh-y', `${(8 + rx * 0.55).toFixed(1)}px`);
        });

        this._cardFxRaf = requestAnimationFrame(tick);
      };
      this._cardFxRaf = requestAnimationFrame(tick);
    }

    fitViewport() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scale = Math.min(vw / 1280, vh / 720);
      this.stage.style.transform = `scale(${scale})`;
    }

    toast(msg) {
      const el = $('toast-banner');
      if (!el) return;
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
    }

    // Unified Rewarded Ad Bridge (Real TapTap SDK on Host, 3s Local Preview Mock on Browser)
    playRewardedAd(title, onReward, contextCheck = null) {
      const showLocalMock = (adTitle, doneCb) => {
        const modal = $('ad-sim-modal');
        const bar = $('ad-sim-bar');
        const cd = $('ad-sim-countdown');
        $('ad-sim-title').textContent = adTitle;
        bar.style.width = '0%';
        cd.textContent = '剩余 3 秒发放奖励（本地试玩模拟）';
        modal.classList.remove('hidden');

        let elapsed = 0;
        const totalMs = 3000;
        const tick = setInterval(() => {
          elapsed += 100;
          const pct = Math.min(100, (elapsed / totalMs) * 100);
          bar.style.width = `${pct}%`;
          const rem = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
          cd.textContent = rem > 0 ? `剩余 ${rem} 秒发放奖励（本地试玩模拟）` : '奖励已发放！';
          if (elapsed >= totalMs) {
            clearInterval(tick);
            modal.classList.add('hidden');
            doneCb(true);
          }
        }, 100);
      };

      if (this.tap) {
        this.tap.requestRewardedAd({
          title,
          contextCheck,
          onGranted: () => {
            this.meta.recordAdWatch();
            if (onReward) onReward();
          },
          onCancelled: (reason) => {
            if (reason) this.toast(reason);
          },
          onMockShow: showLocalMock
        });
      } else {
        showLocalMock(title, (ok) => {
          if (ok) {
            this.meta.recordAdWatch();
            if (onReward) onReward();
          }
        });
      }
    }

    tryUnlockAch(achId) {
      const res = this.meta.unlockAchievement(achId);
      if (res && res.ach) {
        this.toast(`🏅 成就解锁【${res.ach.name}】+${res.ach.shards}碎片${res.mergedOrbs > 0 ? `（合成+${res.mergedOrbs}宝珠!）` : ''}`);
      }
    }

    bindEvents() {
      $('btn-title-enter').onclick = () => this.openPrepHall();
      $('btn-title-hands').onclick = () => this.openCodexModal('codex');
      $('btn-title-mute').onclick = () => this.toggleMute();

      $('btn-contracts-back').onclick = () => {
        if (this.prepTab === 'themes') {
          this.prepTab = 'heroes';
          this.renderPrepHall({ triggerEntryFlourish: false });
        } else {
          this.showTitleScreen();
        }
      };
      if ($('btn-prep-themes-top')) {
        $('btn-prep-themes-top').onclick = () => {
          this.prepTab = this.prepTab === 'themes' ? 'heroes' : 'themes';
          this.audio.playPickup();
          this.renderPrepHall({ triggerEntryFlourish: false });
        };
      }
      $('btn-contracts-hands').onclick = () => this.openCodexModal('codex');
      $('btn-contracts-mute').onclick = () => this.toggleMute();
      $('btn-meta-daily-ad').onclick = () => this.handleDailyAdButton();
      $('btn-meta-board').onclick = () => this.openLeaderboardModal();
      $('btn-meta-ach').onclick = () => this.openAchievementsModal();

      // Keyboard Left/Right hero cycling on the Rainy Night Porch Muster Dais
      window.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const modal = $('deck-select-modal');
        if (!modal || modal.classList.contains('hidden') || this.prepTab !== 'heroes') return;
        if (!$('roster-modal').classList.contains('hidden') || !$('ad-sim-modal').classList.contains('hidden')) return;
        const list = M.HEROES_META || [];
        if (!list.length) return;
        const idx = Math.max(0, list.findIndex((h) => h.id === this.previewHeroId));
        const nextIdx = (idx + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
        e.preventDefault();
        this.selectMusterHero(list[nextIdx].id, true);
      });

      $('btn-bt-roster').onclick = () => this.openCodexModal('roster');
      $('btn-bt-hands').onclick = () => this.openCodexModal('codex');
      $('bt-speed-btn').onclick = () => {
        this.speed = this.speed === 1 ? 1.8 : 1;
        this.battleStage.setSpeed(this.speed);
        $('bt-speed-btn').textContent = this.speed === 1 ? '1×' : '2×';
      };

      $('btn-bt-discard').onclick = () => this.handleDiscardButton();
      $('btn-bt-strike').onclick = () => this.handleStrikeButton();

      $('btn-hands-open').onclick = () => this.openCodexModal('codex');
      $('btn-mute').onclick = () => this.toggleMute();
      $('btn-restart').onclick = () => this.openPrepHall();
      $('btn-shop-reroll').onclick = () => this.rerollShop(false);
      $('btn-shop-ad-reroll').onclick = () => this.handleShopAdReroll();
      $('btn-shop-next').onclick = () => this.startNextWaveBattle();
      $('deck-overview-panel').onclick = () => this.openCodexModal('roster');
      $('deck-overview-panel').onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openCodexModal('roster');
        }
      };

      // Outside-click & Escape dismissal for mobile Tap-to-Inspect shop popover
      $('tavern-view').addEventListener('click', (e) => {
        if (!this.inspectedShopKey) return;
        if (e.target.closest('#shop-detail-popover')) return;
        if (e.target.closest('[data-shop-inspect]')) return;
        this.closeShopInspector();
      });
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (this.inspectedShopKey) this.closeShopInspector();
          if (this.selectedRelicUid) {
            this.selectedRelicUid = null;
            if (this.run && this.run.phase === 'shop') this.renderShop();
          }
        }
      });

      $('rm-tab-roster').onclick = () => this.renderCodexModal('roster');
      $('rm-tab-hands').onclick = () => this.renderCodexModal('codex');
      $('rm-close-btn').onclick = () => $('roster-modal').classList.add('hidden');

      $('btn-pack-ad-reroll').onclick = () => this.handlePackAdReroll();
      $('btn-pack-abandon').onclick = () => {
        if (!this.activePackState) return;
        this.run.gold += 2;
        this.activePackState = null;
        if (this.packCeremonyFX) this.packCeremonyFX.stop();
        $('pack-ceremony-modal').classList.add('hidden');
        this.toast('放弃本包，返还 +2G');
        this.renderShop();
      };
      $('btn-pack-target-back').onclick = () => {
        if (!this.activePackState) return;
        this.activePackState.chosenInscription = null;
        $('pack-target-stage').classList.add('hidden');
        $('pack-reveal-stage').classList.remove('hidden');
      };
    }

    toggleMute() {
      const m = this.audio.toggleMute();
      $('btn-title-mute').textContent = m ? '音效：关' : '音效：开';
      $('btn-mute').textContent = m ? '静音' : '音效';
      $('btn-contracts-mute').textContent = m ? '静音' : '音效';
    }

    showTitleScreen() {
      this.battleStage.stop();
      if (this.heroMusterStage) this.heroMusterStage.stop();
      if (this.tavernShopStage) this.tavernShopStage.stop();
      if (this.packCeremonyFX) this.packCeremonyFX.stop();
      if (this.altarBg && this.altarBg.stop) this.altarBg.stop();
      if (this.titleRain && this.titleRain.start) this.titleRain.start();
      this.closeShopInspector();
      $('title-screen-view').classList.remove('hidden');
      $('deck-select-modal').classList.add('hidden');
      $('battle-view').classList.add('hidden');
      $('tavern-view').classList.add('hidden');
      $('payout-modal').classList.add('hidden');
      $('pack-ceremony-modal').classList.add('hidden');
    }

    // =========================================================================
    // META PREP HALL: RAINY NIGHT PORCH MUSTER DAIS + UNTOUCHED 8 THEME PACKS
    // =========================================================================
    openPrepHall() {
      this.battleStage.stop();
      if (this.titleRain && this.titleRain.stop) this.titleRain.stop();
      if (this.tavernShopStage) this.tavernShopStage.stop();
      if (this.packCeremonyFX) this.packCeremonyFX.stop();
      if (this.altarBg && this.altarBg.stop) this.altarBg.stop();
      this.closeShopInspector();
      this.prepTab = 'heroes';
      $('title-screen-view').classList.add('hidden');
      $('battle-view').classList.add('hidden');
      $('tavern-view').classList.remove('hidden');
      $('top-hud').classList.add('hidden');
      $('market-main-stage').classList.add('hidden');
      $('payout-modal').classList.add('hidden');
      $('pack-ceremony-modal').classList.add('hidden');
      $('deck-select-modal').classList.remove('hidden');
      this.renderPrepHall({ triggerEntryFlourish: true });
    }

    handleDailyAdButton() {
      this.meta.checkDailyReset();
      const d = this.meta.data;
      if (!d.dailyCheckedIn) {
        const res = this.meta.claimDailyCheckin();
        this.audio.playPickup();
        this.toast(`每日签到成功：+${res.base} 宝珠碎片${res.mergedOrbs > 0 ? `（合成 +${res.mergedOrbs} 宝珠!）` : ''}`);
        this.renderPrepHall();
        return;
      }
      if (!d.dailyCheckinDoubled) {
        const extra = d.dailyCheckinBase || 5;
        this.playRewardedAd(`每日签到碎片 ×2 · 额外领取 +${extra} 碎片`, () => {
          const res = this.meta.doubleDailyCheckin();
          this.toast(`签到翻倍：额外 +${res.extra} 宝珠碎片${res.mergedOrbs > 0 ? `（合成 +${res.mergedOrbs} 宝珠!）` : ''}`);
          this.renderPrepHall();
        });
        return;
      }
      this.toast('今日签到及翻倍已完成');
    }

    getShortPerk(h) {
      if (h.applyVuln && !h.bloodToShield) return '挂易伤 ×1.4';
      if (h.retriggerLeft && h.inheritLeftAtkRatio) return '继60%攻+复读';
      if (h.retriggerLeft) return '左侧再动 1 次';
      if (h.goldOnDiscard && h.goldOnStrike) return '出手/弃牌 +1G';
      if (h.followPrev) return '前动补刀+4攻';
      if (h.emptySlotMult) return '每空位 ×1.8';
      if (h.inHandGrowPerStrike) return '留手每击 +8攻';
      if (h.noAttackAmpRight) return '右侧伤害 ×2.0';
      if (h.growPerSpend3G) return '+2G · 消费成长';
      if (h.knifeCount > 0) return `弃牌蓄 ${h.knifeCount} 刀`;
      if (h.discardInjectTeamAtk) return '弃牌注攻 +1G';
      if (h.discardTriggerLeftmostHand) return '接口 · 弃牌导流';
      if (h.multPerWaveDiscard) return '每弃1张 +0.4×';
      if (h.growOnSlot1SurviveShield) return `+${h.shieldVal}盾 · 挨打成长`;
      if (h.shieldToAtkRatio) return `+${h.shieldVal}盾 · 盾转攻`;
      if (h.borrowHitToSlot3) return '接口 · 承伤充3号';
      if (h.consumeHalfShieldMult) return '耗半盾 ×8 重击';
      if (h.slot1InfectTeammates) return `挂${h.applyPoison}毒 · 队友传染`;
      if (h.multPoison) return `挂${h.applyPoison}毒 · 毒×1.5`;
      if (h.poisonBloodBridge) return '接口 · 吞毒注全队';
      if (h.detonatePoison) return '即时引爆剧毒';
      if (h.applyFrost) return `挂 ${h.applyFrost} 层冰霜`;
      if (h.shatterMult) return '碎冰 ×1.8 成长';
      if (h.shieldToFrostPer10) return '接口 · 蓝盾转冰';
      if (h.consumeFrostBonusAtk) return '耗全冰爆发';
      if (h.inHandTeamMult) return '留手全队 ×1.25';
      if (h.inHandEndGold) return '留手+2G +12攻';
      if (h.leftmostAssistSlot3) return '接口 · 3号援护';
      if (h.multPerRemainingHand) return '每留1手 ×1.35';
      if (h.devourLeftRatio) return '吞左侧 ×1.6';
      if (h.onExhaustTeamPermAtk) return '遗言全队 +15攻';
      if (h.summonBladeIfEmpty) return '接口 · 空位召灵';
      if (h.multPerWaveExhaust) return '每退场 ×1.8';
      if (h.selfCostGrowAtk) return '自残8血 ×1.75';
      if (h.healOnStrike) return '回12血 · 残血×1.8';
      if (h.bloodToShield) return '接口 · 燃血转盾';
      if (h.missingHpPctMult) return '每损1%血 +3%';
      if (h.gambleCoinMult) return '抛币 ×2.2/+2G';
      if (h.gambleDiceMode) return '掷骰盾/攻/×2.4';
      if (h.retriggerLeftOnBet) return '接口 · 押2G复读';
      if (h.multPerGambleWin) return '每正面 ×1.45';
      if (h.shieldVal > 0) return `出手 +${h.shieldVal} 蓝盾`;
      return '纯高战力底座';
    }

    getThemeFallbackGear(themeOrKind = 'core') {
      const map = {
        core: './assets/gear/eq_dragon_heart.png',
        discard: './assets/gear/eq_shadow_cloak.png',
        shield: './assets/gear/eq_aegis_seal.png',
        poison: './assets/gear/eq_venom_fang.png',
        frost: './assets/gear/eq_frost_bow.png',
        hand: './assets/gear/eq_oak_charm.png',
        exhaust: './assets/gear/eq_void_fan.png',
        blood: './assets/gear/eq_blood_edge.png',
        gamble: './assets/gear/eq_greed_dice.png',
        pack_hero: './assets/gear/eq_dawn_lance.png',
        pack_inscription: './assets/gear/eq_storm_staff.png'
      };
      return map[themeOrKind] || './assets/gear/eq_dragon_heart.png';
    }

    getIconUrlSafe(iconId, fallbackKind = 'core') {
      const fb = this.getThemeFallbackGear(fallbackKind);
      if (this.vfx && this.vfx.getIconUrl && iconId) {
        return this.vfx.getIconUrl(iconId, fb) || fb;
      }
      return fb;
    }

    renderSafeIconImg(iconId, fallbackKind, className = 'v14-shop-pixel-icon', extraStyle = '') {
      const fb = this.getThemeFallbackGear(fallbackKind);
      const url = this.getIconUrlSafe(iconId, fallbackKind);
      const stylePart = extraStyle ? ` style="${extraStyle}"` : '';
      return `<img class="${className}" src="${url}" onerror="this.onerror=null;this.src='${fb}';" alt=""${stylePart} />`;
    }

    _shortHeroLabel(name) {
      const idx = name.indexOf('·');
      return idx >= 0 ? name.slice(idx + 1).trim() : name;
    }

    selectMusterHero(heroId, playSound = true, isUnlockCelebrate = false) {
      const hero = this.meta.getHero(heroId);
      if (!hero) return;
      this.previewHeroId = hero.id;
      if (this.heroMusterStage) {
        this.heroMusterStage.selectHero(hero, true, isUnlockCelebrate);
      }
      if (playSound) {
        if (isUnlockCelebrate && this.audio.playCheer) this.audio.playCheer();
        else if (this.audio.playSlash) this.audio.playSlash();
        else this.audio.playPickup();
      }
      this.syncMusterSpots();
      this.updateMusterFolio();
    }

    syncMusterSpots() {
      const hitLayer = $('muster-hit-layer');
      if (!hitLayer) return;
      hitLayer.querySelectorAll('.muster-hero-spot').forEach((spot) => {
        const hid = spot.dataset.pickHero;
        const hero = this.meta.getHero(hid);
        const unlocked = this.meta.isHeroUnlocked(hid);
        const active = hid === this.previewHeroId;
        spot.classList.toggle('is-active', active);
        spot.classList.toggle('is-unlocked', unlocked);
        spot.classList.toggle('is-locked', !unlocked);
        spot.setAttribute('aria-pressed', active ? 'true' : 'false');
        const tagEl = spot.querySelector('.mhs-state');
        if (tagEl && hero) {
          tagEl.innerHTML = active
            ? '登台中'
            : (unlocked ? '待命' : `${pxIcon('orb')}${hero.cost}`);
        }
      });
    }

    updateMusterSavedBar() {
      const slot = $('muster-saved-slot');
      if (!slot) return;
      const savedRun = this.meta.data.activeRun;
      if (!savedRun) {
        slot.innerHTML = '';
        return;
      }
      slot.innerHTML = `
        <div class="muster-saved-strip">
          <span class="v14-body-text"><b>未完成对局</b> · ${esc(savedRun.hero.name)} · 第 ${savedRun.wave}/8 波 · ${pxIcon('gold')}${savedRun.gold} · ${savedRun.roster.length}人</span>
          <div class="muster-saved-actions">
            <button class="steel-btn crimson hud-mini-btn" id="btn-resume-run">${pxIcon('play')} 继续对局</button>
            <button class="steel-btn hud-mini-btn" id="btn-discard-run">放弃旧局</button>
          </div>
        </div>
      `;
      if ($('btn-resume-run')) $('btn-resume-run').onclick = () => this.resumeSavedRun();
      if ($('btn-discard-run')) $('btn-discard-run').onclick = () => {
        this.meta.clearActiveRun();
        this.toast('已放弃旧对局');
        this.updateMusterSavedBar();
      };
    }

    updateMusterFolio() {
      const folio = $('muster-folio');
      if (!folio) return;
      const d = this.meta.data;
      const curHero = this.meta.getHero(this.previewHeroId);
      const curUnlocked = this.meta.isHeroUnlocked(curHero.id);
      const curCanTrial = this.meta.canTrialHero(curHero.id);
      const curAsc = this.meta.getAscension(d.selectedAscension || 0);
      const liveUnlocked = M.THEME_PACKS_META.filter((tp) => tp.live && this.meta.isThemeUnlocked(tp.id));
      const canRandom = liveUnlocked.length >= 4;
      const activeThemeLabels = d.themeMode === 'random' && canRandom
        ? ['随机 3 包 (+25%碎片)']
        : (d.selectedThemes || []).map((id) => (D.THEMES[id] && D.THEMES[id].name) || id);
      const accent = window.MT.HeroMusterStage
        ? window.MT.HeroMusterStage.getHeroAccent(curHero.id)
        : { main: '#ffd966' };

      folio.style.setProperty('--hero-accent', accent.main);
      folio.innerHTML = `
        <div class="mf-block mf-hero-head">
          <div class="mf-meta-row">
            <span class="mf-status-text ${curUnlocked ? 'owned' : 'locked'}">
              ${curUnlocked ? '已入酒馆名册 · 可出征' : `未解锁 · 需 ${curHero.cost} 宝珠`}
            </span>
            <button class="mf-flourish-btn" id="btn-folio-flourish" type="button">↻ 演武</button>
          </div>
          <h3 class="mf-hero-name">${esc(curHero.name)}</h3>
          <p class="mf-hero-desc v14-body-text">${esc(curHero.desc)}</p>
        </div>

        <div class="mf-divider"></div>

        <div class="mf-block">
          <div class="mf-section-head">
            <span class="mf-kicker">难度阶梯</span>
            <span class="mf-kicker-val">${esc(curAsc.name)}</span>
          </div>
          <div class="v14-asc-row">
            ${M.ASCENSIONS.map((a) => {
              const locked = a.lv > (d.maxAscensionUnlocked || 0);
              const active = a.lv === (d.selectedAscension || 0);
              return `<button class="v14-asc-btn ${active ? 'active' : ''}" data-asc="${a.lv}" ${locked ? 'disabled' : ''}>${a.lv === 0 ? '标准' : `阶${a.lv}`}</button>`;
            }).join('')}
          </div>
          <p class="mf-sub-note v14-body-text">${esc(curAsc.desc)}</p>
        </div>

        <div class="mf-divider"></div>

        <div class="mf-block">
          <div class="mf-section-head">
            <span class="mf-kicker">本局卡池 · 51张</span>
            <button class="mf-link-btn" id="btn-folio-themes" type="button">配置 8 大主题包 (${liveUnlocked.length}/8) →</button>
          </div>
          <div class="mf-theme-line v14-body-text">
            ${activeThemeLabels.map((lbl) => `<span>${esc(lbl)}</span>`).join('<span class="mf-sep" aria-hidden="true">·</span>')}
          </div>
        </div>

        <div class="mf-cta-row">
          ${curUnlocked
            ? `<button class="v15-primary-cta mf-start-btn" id="btn-prep-start">${pxIcon('atk')} 开始出征</button>`
            : `<button class="v15-primary-cta gold" id="btn-prep-buy" ${d.orbs < curHero.cost ? 'disabled' : ''}>${pxIcon('orb')} ${curHero.cost} 购买解锁</button>
               ${curCanTrial
                 ? `<button class="v14-ad-btn mf-trial-btn" id="btn-prep-trial">${pxIcon('play')} 免费试用</button>`
                 : `<button class="steel-btn mf-trial-btn" disabled>已试用</button>`}`
          }
        </div>
      `;

      if ($('btn-folio-flourish')) {
        $('btn-folio-flourish').onclick = () => {
          if (this.heroMusterStage) this.heroMusterStage.triggerFlourish(curHero, false);
          if (this.audio.playSlash) this.audio.playSlash();
        };
      }
      if ($('btn-folio-themes')) {
        $('btn-folio-themes').onclick = () => {
          this.prepTab = 'themes';
          this.audio.playPickup();
          this.renderPrepHall();
        };
      }
      if ($('btn-prep-start')) {
        $('btn-prep-start').onclick = () => {
          if (this.audio.playWaxSlam) this.audio.playWaxSlam();
          this.startNewRun(curHero.id, false);
        };
      }
      if ($('btn-prep-buy')) {
        $('btn-prep-buy').onclick = () => {
          if (this.meta.buyHero(curHero.id)) {
            this.toast(`已解锁【${curHero.name}】！`);
            this.syncPrepTopRail();
            this.selectMusterHero(curHero.id, true, true);
          }
        };
      }
      if ($('btn-prep-trial')) {
        $('btn-prep-trial').onclick = () => {
          this.playRewardedAd(`免费试用【${curHero.name}】（每英雄限 1 次）`, () => {
            this.meta.markHeroTrialed(curHero.id);
            this.startNewRun(curHero.id, true);
          });
        };
      }
      folio.querySelectorAll('[data-asc]').forEach((btn) => {
        btn.onclick = () => {
          this.meta.setSelectedAscension(Number(btn.dataset.asc));
          this.audio.playPickup();
          this.updateMusterFolio();
        };
      });
    }

    syncPrepTopRail() {
      this.meta.checkDailyReset();
      const d = this.meta.data;
      $('meta-orbs-badge').innerHTML = `${pxIcon('orb')} 宝珠 <b>${d.orbs}</b> · 碎片 ${d.shards || 0}/10`;
      const dailyBtn = $('btn-meta-daily-ad');
      if (!d.dailyCheckedIn) {
        dailyBtn.innerHTML = `${pxIcon('gold')} 每日签到 (领 3~10 碎片)`;
        dailyBtn.disabled = false;
      } else if (!d.dailyCheckinDoubled) {
        dailyBtn.innerHTML = `${pxIcon('play')} 签到翻倍 (+${d.dailyCheckinBase}碎片)`;
        dailyBtn.disabled = false;
      } else {
        dailyBtn.innerHTML = `${pxIcon('check')} 今日已签到`;
        dailyBtn.disabled = true;
      }

      const syncEl = $('meta-sync-badge');
      if (syncEl && this.tap) syncEl.innerHTML = `${pxIcon('cloud')} ${esc(this.tap.syncStatus)}`;
      const achCount = (d.unlockedAchievements || []).length;
      const achTotal = T ? T.ACHIEVEMENTS.length : 12;
      if ($('btn-meta-ach')) $('btn-meta-ach').textContent = `成就 ${achCount}/${achTotal}`;

      const liveUnlocked = M.THEME_PACKS_META.filter((tp) => tp.live && this.meta.isThemeUnlocked(tp.id));
      const topThemesBtn = $('btn-prep-themes-top');
      if (topThemesBtn) {
        topThemesBtn.textContent = this.prepTab === 'themes'
          ? '← 返回点将台'
          : `8大主题包 (${liveUnlocked.length}/8)`;
        topThemesBtn.classList.toggle('gold', this.prepTab === 'themes');
      }
      const titleEl = document.querySelector('#deck-select-modal .crt-main');
      if (titleEl) {
        titleEl.textContent = this.prepTab === 'themes' ? '出征准备 · 8 大主题包' : '雨夜门廊 · 点将台';
      }
    }

    renderPrepHall(opts = {}) {
      this.syncPrepTopRail();
      const modal = $('deck-select-modal');
      const body = $('deck-select-grid');
      const d = this.meta.data;
      const liveUnlocked = M.THEME_PACKS_META.filter((tp) => tp.live && this.meta.isThemeUnlocked(tp.id));
      const canRandom = liveUnlocked.length >= 4;

      if (this.prepTab === 'heroes') {
        modal.classList.add('muster-mode');
        modal.classList.remove('themes-mode');

        const existingStage = $('muster-stage-root');
        if (!existingStage) {
          const seats = window.MT.HeroMusterStage ? window.MT.HeroMusterStage.getSeatLayout() : [];
          const dais = window.MT.HeroMusterStage ? window.MT.HeroMusterStage.getDais() : { x: 455, y: 454 };

          body.innerHTML = `
            <div id="muster-stage-root" class="muster-stage-root">
              <canvas id="hero-muster-canvas" class="hero-muster-canvas" width="1280" height="720"></canvas>
              <div id="muster-saved-slot" class="muster-saved-slot"></div>
              <div id="muster-hit-layer" class="muster-hit-layer">
                <button id="btn-dais-replay" class="muster-dais-hit" type="button"
                  style="left:${dais.x}px;top:${dais.y - 84}px;"
                  title="点击演武" aria-label="点击重播当前英雄演武"></button>
                ${M.HEROES_META.map((h, i) => {
                  const seat = seats[i] || { x: 140 + i * 74, y: 630 };
                  const shortName = this._shortHeroLabel(h.name);
                  const unlocked = this.meta.isHeroUnlocked(h.id);
                  const active = h.id === this.previewHeroId;
                  return `
                    <button class="muster-hero-spot ${active ? 'is-active' : ''} ${unlocked ? 'is-unlocked' : 'is-locked'}"
                      type="button"
                      data-pick-hero="${h.id}"
                      style="left:${seat.x}px;top:${seat.y}px;"
                      aria-pressed="${active ? 'true' : 'false'}"
                      aria-label="${esc(h.name)}">
                      <span class="mhs-plate">
                        <span class="mhs-name">${esc(shortName)}</span>
                        <span class="mhs-state">${active ? '登台中' : (unlocked ? '待命' : `${pxIcon('orb')}${h.cost}`)}</span>
                      </span>
                    </button>
                  `;
                }).join('')}
              </div>
              <div class="muster-stage-hint" aria-hidden="true">点选门廊侠客登台演武 · 轻触石台重播招式 · 方向键 ← → 切换</div>
              <aside id="muster-folio" class="muster-folio"></aside>
            </div>
          `;

          const canvas = $('hero-muster-canvas');
          if (this.heroMusterStage && canvas) {
            this.heroMusterStage.attach(canvas, M.HEROES_META, this.previewHeroId);
            if (opts.triggerEntryFlourish) {
              this.heroMusterStage.triggerFlourish(this.meta.getHero(this.previewHeroId), false);
            }
          }

          if ($('btn-dais-replay')) {
            $('btn-dais-replay').onclick = () => {
              const cur = this.meta.getHero(this.previewHeroId);
              if (this.heroMusterStage && cur) this.heroMusterStage.triggerFlourish(cur, false);
              if (this.audio.playSlash) this.audio.playSlash();
            };
          }

          const hitLayer = $('muster-hit-layer');
          if (hitLayer) {
            hitLayer.querySelectorAll('.muster-hero-spot').forEach((spot) => {
              const hid = spot.dataset.pickHero;
              spot.onclick = () => this.selectMusterHero(hid, true, false);
              spot.onmouseenter = () => {
                if (this.heroMusterStage) this.heroMusterStage.setHovered(hid);
              };
              spot.onmouseleave = () => {
                if (this.heroMusterStage) this.heroMusterStage.setHovered(null);
              };
            });
          }
        } else if (this.heroMusterStage) {
          this.heroMusterStage.setHeroes(M.HEROES_META);
          this.heroMusterStage.start();
          if (opts.triggerEntryFlourish) {
            this.heroMusterStage.selectHero(this.meta.getHero(this.previewHeroId), true, false);
          }
        }

        this.syncMusterSpots();
        this.updateMusterSavedBar();
        this.updateMusterFolio();
        return;
      }

      // ─── UNTOUCHED 8 THEME PACKS VIEW ("卡包先不动") ───
      if (this.heroMusterStage) this.heroMusterStage.stop();
      modal.classList.remove('muster-mode');
      modal.classList.add('themes-mode');

      body.innerHTML = `
        <section class="v14-prep-right v15-themes-only-shell">
          <div class="v14-prep-tabs">
            <div class="v14-tab-group">
              <button class="v14-tab-btn" id="btn-tab-heroes">← 雨夜门廊点将台 (10)</button>
              <button class="v14-tab-btn active" id="btn-tab-themes">8 大主题包 (${liveUnlocked.length}/8 已解锁)</button>
            </div>
            ${canRandom ? `
              <div style="display:flex;gap:6px;">
                <button class="steel-btn hud-mini-btn ${d.themeMode === 'pick' ? 'crimson' : ''}" id="btn-theme-pick">自选3包</button>
                <button class="steel-btn hud-mini-btn ${d.themeMode === 'random' ? 'gold' : ''}" id="btn-theme-rand">随机3包 (+25%碎片)</button>
              </div>
            ` : ''}
          </div>

          <div class="v14-themes-grid-8">
            ${M.THEME_PACKS_META.map((tp) => {
              const unlocked = this.meta.isThemeUnlocked(tp.id);
              const selected = (d.selectedThemes || []).includes(tp.id);
              const th = D.THEMES[tp.id] || D.THEMES.core;
              const isPicked = unlocked && selected && d.themeMode === 'pick';
              return `
                <div class="v14-theme-card ${isPicked ? 'active-pick' : ''}" style="--th-col:${th.color};--th-bg:${th.bg};">
                  <div class="v15-card-window"><div class="v15-b-specular"></div></div>
                  <div style="display:flex;justify-content:space-between;align-items:center;position:relative;z-index:2;">
                    <b style="font-size:14px;color:${th.color};">${esc(tp.name)}</b>
                    <span class="v14-tier ${unlocked ? 'tier-B' : 'tier-S'}">${tp.cost === 0 ? '免费' : `${pxIcon('orb')}${tp.cost}`}</span>
                  </div>
                  <div class="v14-body-text" style="font-size:12.5px;line-height:1.4;color:#d6e0f5;flex:1;position:relative;z-index:2;">${esc(tp.desc)}</div>
                  ${unlocked
                    ? `<button class="steel-btn ${isPicked ? 'crimson' : ''}" style="font-size:12px;padding:6px;position:relative;z-index:2;" data-toggle-theme="${tp.id}">${d.themeMode === 'random' ? '已入随机池' : (selected ? `${pxIcon('check')} 本局已选` : '点选入局')}</button>`
                    : `<button class="steel-btn gold" style="font-size:12px;padding:6px;position:relative;z-index:2;" data-buy-theme="${tp.id}" ${d.orbs < tp.cost ? 'disabled' : ''}>${pxIcon('orb')} ${tp.cost} 购买解锁</button>`
                  }
                </div>
              `;
            }).join('')}
          </div>
        </section>
      `;

      body.querySelectorAll('.v14-theme-card').forEach((el) => {
        this.bindInteractive3DTilt(el, 9, 7, true);
      });

      if ($('btn-tab-heroes')) {
        $('btn-tab-heroes').onclick = () => {
          this.prepTab = 'heroes';
          this.audio.playPickup();
          this.renderPrepHall({ triggerEntryFlourish: false });
        };
      }
      if ($('btn-theme-pick')) $('btn-theme-pick').onclick = () => { this.meta.setThemeMode('pick'); this.renderPrepHall(); };
      if ($('btn-theme-rand')) $('btn-theme-rand').onclick = () => { this.meta.setThemeMode('random'); this.renderPrepHall(); };
      body.querySelectorAll('[data-buy-theme]').forEach((btn) => {
        btn.onclick = () => {
          if (this.meta.buyThemePack(btn.dataset.buyTheme)) {
            this.audio.playPickup();
            this.toast('已解锁拓展主题包！');
            this.renderPrepHall();
          }
        };
      });
      body.querySelectorAll('[data-toggle-theme]').forEach((btn) => {
        btn.onclick = () => {
          this.meta.toggleSelectTheme(btn.dataset.toggleTheme);
          this.renderPrepHall();
        };
      });
    }

    startNewRun(heroId = 'hero_01', isTrial = false) {
      this.audio.ensure();
      const hero = this.meta.getHero(heroId);
      const themeSetup = this.meta.resolveRunThemes();
      const activeRelicPool = D.getActiveRelics(themeSetup.themes);
      const startRelics = [];
      if (hero.startHighRelic) {
        const highPool = activeRelicPool.filter((r) => r.tier === 'S' || r.tier === 'SSS');
        const pick = highPool[Math.floor(Math.random() * highPool.length)];
        if (pick) startRelics.push(D.makeRelicInstance(pick));
      }

      const asc = this.meta.getAscension(this.meta.data.selectedAscension || 0);
      this.run = {
        runId: 'run_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        hero,
        ascension: asc.lv,
        isTrial,
        activeThemes: themeSetup.themes,
        shardBonusMult: themeSetup.bonusMult,
        wave: 1,
        maxWaves: 8,
        phase: 'battle',
        gold: hero.startGold || 6,
        roster: D.createStarterRoster(),
        relics: startRelics,
        maxRelicSlots: 5 + (hero.extraRelicSlots || 0),
        slotLevels: { slot1: 1, slot2: 1, slot3: 1, hand: 1 },
        totalKills: 0,
        peakHit: 0,
        adReviveLeft: 1,
        adShopRerollLeft: 1,
        adPackRerollLeft: 1,
        adFilterLeft: 1
      };
      this.selectedRelicUid = null;
      this.meta.saveActiveRun(this.run);
      if (this.heroMusterStage) this.heroMusterStage.stop();
      $('title-screen-view').classList.add('hidden');
      $('deck-select-modal').classList.add('hidden');
      $('payout-modal').classList.add('hidden');
      this.startWaveBattle(1);
    }

    resumeSavedRun() {
      const saved = this.meta.data.activeRun;
      if (!saved) return;
      this.audio.ensure();
      this.run = JSON.parse(JSON.stringify(saved));
      this.selectedRelicUid = null;
      if (this.heroMusterStage) this.heroMusterStage.stop();
      $('title-screen-view').classList.add('hidden');
      $('deck-select-modal').classList.add('hidden');
      $('payout-modal').classList.add('hidden');
      if (this.run.phase === 'shop') {
        this.openShop();
      } else {
        this.startWaveBattle(this.run.wave);
      }
    }

    // =========================================================================
    // BEAT 1: MIRROR-LAKE 7-PHASE BATTLE
    // =========================================================================
    startWaveBattle(wave) {
      if (this.tavernShopStage) this.tavernShopStage.stop();
      if (this.packCeremonyFX) this.packCeremonyFX.stop();
      if (this.altarBg && this.altarBg.stop) this.altarBg.stop();
      this.closeShopInspector();
      $('tavern-view').classList.add('hidden');
      $('pack-ceremony-modal').classList.add('hidden');
      $('battle-view').classList.remove('hidden');
      $('payout-modal').classList.add('hidden');

      this.run.phase = 'battle';
      this.meta.saveActiveRun(this.run);

      const rawBoss = D.getWaveBoss(wave);
      const asc = this.meta.getAscension(this.run.ascension || 0);
      const bossCfg = {
        ...rawBoss,
        maxHp: Math.round(rawBoss.maxHp * asc.hpMult),
        breakThreshold: Math.round(rawBoss.breakThreshold * asc.hpMult),
        shieldGain: Math.round(rawBoss.shieldGain * asc.hpMult),
        heavyDmg: Math.round(rawBoss.heavyDmg * asc.dmgMult),
        ultDmg: Math.round(rawBoss.ultDmg * asc.dmgMult)
      };
      const hero = this.run.hero;
      const extraDiscards = this.run.relics.filter((r) => r.id === 'r_disc_extra').length * 2 + (hero.extraDiscards || 0) + (asc.discardDelta || 0);
      const drawPile = shuffle(this.run.roster);
      const maxHp = Math.max(40, D.SQUAD_MAX_HP + (hero.maxHpBonus || 0));
      const baseHandLimit = Math.max(4, D.HAND_SIZE + (asc.handDelta || 0));

      this.battle = {
        wave,
        round: 1,
        maxRounds: D.MAX_ROUNDS,
        handLimit: baseHandLimit,
        bossCfg,
        heroPassive: hero,
        gold: this.run.gold,
        squadHp: maxHp,
        squadMaxHp: maxHp,
        squadShield: hero.startShield || 0,
        bossHp: bossCfg.maxHp,
        bossMaxHp: bossCfg.maxHp,
        bossShield: 0,
        bossPoison: hero.startBossPoison || 0,
        bossFrost: 0,
        bossFrozen: false,
        waveFrostNovaUsed: false,
        waveExhaustCount: 0,
        waveSummonTriggered: false,
        waveSubstituteUsed: false,
        waveImmortalUsed: false,
        waveImmortalBuff: false,
        waveGambleWins: 0,
        waveJackpotActive: false,
        bossVuln: false,
        bossStunned: false,
        bossCharging: false,
        bossThorns: false,
        bossBreakProgress: 0,
        bossBreakThreshold: bossCfg.breakThreshold,
        pendingUltNextTurn: false,
        slot3Locked: false,
        intent: null,
        slotLevels: this.run.slotLevels,
        relics: this.run.relics,
        discardsLeft: Math.max(1, D.BASE_DISCARDS + extraDiscards),
        maxDiscards: Math.max(1, D.BASE_DISCARDS + extraDiscards),
        waveDiscardsCount: 0,
        roundDiscardsCount: 0,
        roundUsedDiscard: false,
        roundTeamAtkBonus: 0,
        roundSlot1MultBonus: 0,
        nextRoundSlot3Bonus: 0,
        currentSlot3Bonus: 0,
        ghostQueuedHero: null,
        pendingKnives: [],
        pendingScavengers: [],
        drawPile,
        discardPile: [],
        exhaustPile: [],
        hand: [],
        slots: [null, null, null]
      };

      const biome = wave % 3 === 0 ? 'ice' : wave % 2 === 0 ? 'dark' : 'default';
      this.battleStage.onSlotClick = (idx) => {
        if (this.busy || !this.battle) return;
        if (this.battle.slots[idx]) {
          this.inspectedSlotIdx = (this.inspectedSlotIdx === idx) ? -1 : idx;
          this.inspectedCardUid = null;
          this.audio.playPickup();
          this.syncBattleUI();
        }
      };
      this.battleStage.onEmptyClick = () => {
        if (this.inspectedSlotIdx >= 0 || this.inspectedCardUid) {
          this.inspectedSlotIdx = -1;
          this.inspectedCardUid = null;
          this.syncBattleUI();
        }
      };
      if (!this._battleDismissBound) {
        this._battleDismissBound = true;
        $('battle-view').addEventListener('pointerdown', (ev) => {
          if (this.inspectedSlotIdx < 0) return;
          if (ev.target.closest('.v15-bridge-hitbox') || ev.target.closest('#v14-card-tip')) return;
          this.inspectedSlotIdx = -1;
          if (this.battleStage.setInspectedSlot) this.battleStage.setInspectedSlot(-1, []);
          this.syncBattleUI();
        });
      }
      this.battleStage.start(bossCfg, biome);
      this.beginRound();
    }

    prepareBossIntent() {
      const b = this.battle;
      b.bossStunned = false;
      b.bossBreakProgress = 0;
      b.bossCharging = false;
      b.bossThorns = false;
      b.slot3Locked = false;

      if (b.pendingUltNextTurn) {
        b.pendingUltNextTurn = false;
        b.intent = { kind: 'ult', dmg: b.bossCfg.ultDmg, skillName: '灭世大招', compact: `💀 ${b.bossCfg.ultDmg}`, label: `💀 灭世大招 · ${b.bossCfg.ultDmg} 巨伤`, color: '#ff477e' };
        return;
      }

      const pat = b.bossCfg.pattern || ['heavy', 'charge', 'heavy', 'heavy'];
      let kind = pat[(b.round - 1) % pat.length];
      if (kind === 'charge' && b.round >= 3) kind = 'heavy';

      if (kind === 'charge') {
        b.bossCharging = true;
        b.intent = { kind: 'charge', dmg: 0, breakNeed: b.bossCfg.breakThreshold, skillName: '灭世蓄力', label: `破招 ${b.bossCfg.breakThreshold}`, color: '#ff9a2e' };
      } else if (kind === 'shield') {
        const d = Math.round(b.bossCfg.heavyDmg * 0.65);
        b.intent = { kind: 'shield', dmg: d, shieldGain: b.bossCfg.shieldGain, skillName: '魔盾壁垒', compact: `🛡+${b.bossCfg.shieldGain}  ⚔ ${d}`, label: `🛡 魔盾 +${b.bossCfg.shieldGain} · 击 ${d} 伤`, color: '#6be5ff' };
      } else if (kind === 'lock3') {
        const d = Math.round(b.bossCfg.heavyDmg * 0.72);
        b.slot3Locked = true;
        b.intent = { kind: 'lock3', dmg: d, skillName: '极寒封阵', compact: `❄封3  ⚔ ${d}`, label: `❄ 封锁3号位 · 击 ${d} 伤`, color: '#8ef0ff' };
      } else if (kind === 'thorns') {
        const d = Math.round(b.bossCfg.heavyDmg * 0.7);
        b.bossThorns = true;
        b.intent = { kind: 'thorns', dmg: d, skillName: '荆棘反甲', compact: `🌵反4  ⚔ ${d}`, label: `🌵 反伤荆棘(每段4伤) · 击 ${d} 伤`, color: '#a8ff78' };
      } else {
        b.intent = { kind: 'heavy', dmg: b.bossCfg.heavyDmg, skillName: '裂空重击', compact: `⚔ ${b.bossCfg.heavyDmg}`, label: `⚔ 裂空重击 · ${b.bossCfg.heavyDmg} 伤`, color: '#ff667d' };
      }
    }

    drawToHandSize() {
      const b = this.battle;
      const lim = b.handLimit || D.HAND_SIZE;
      while (b.hand.length < lim) {
        if (b.drawPile.length === 0) {
          if (b.discardPile.length === 0) break;
          b.drawPile = shuffle(b.discardPile);
          b.discardPile = [];
        }
        b.hand.push(b.drawPile.pop());
      }
    }

    beginRound() {
      const b = this.battle;
      this.busy = false;
      this.discardMode = false;
      this.pureFilterMode = false;
      this.discardPicks.clear();
      this.swapSlotIdx = -1;
      this.inspectedCardUid = null;
      this.inspectedSlotIdx = -1;
      if (this.battleStage.setInspectedSlot) this.battleStage.setInspectedSlot(-1, []);
      b.slots = [null, null, null];

      this.prepareBossIntent();
      this.drawToHandSize();

      const startEvents = E.onRoundStart(b);
      for (const ev of startEvents) {
        if (ev.type === 'toast') this.toast(ev.text);
        if (ev.type === 'shield_gain') this.battleStage.spawnPopup(320, 300, `+${ev.amount} ${ev.label}`, '#78b7ff', 22);
      }
      this.syncBattleUI();
    }

    getRemainingHand() {
      const slottedUids = new Set(this.battle.slots.filter(Boolean).map((h) => h.uid));
      return this.battle.hand.filter((h) => !slottedUids.has(h.uid));
    }

    deployCardToSlot(heroUid, preferredIdx = -1) {
      if (this.busy || !this.battle) return;
      const b = this.battle;
      const hero = b.hand.find((h) => h.uid === heroUid);
      if (!hero) return;
      const curIdx = b.slots.findIndex((s) => s && s.uid === heroUid);
      const maxSlot = b.slot3Locked ? 2 : 3;

      if (preferredIdx >= 0 && preferredIdx < maxSlot) {
        if (curIdx === preferredIdx) return;
        if (curIdx >= 0) {
          [b.slots[curIdx], b.slots[preferredIdx]] = [b.slots[preferredIdx], b.slots[curIdx]];
        } else {
          // Honor exact player intent: dropping onto an occupied slot directly replaces it (returning previous unit to hand)
          b.slots[preferredIdx] = hero;
        }
        this.discardPicks.delete(heroUid);
        this.inspectedCardUid = null;
        this.audio.playPickup();
        this.syncBattleUI();
        return;
      }

      if (curIdx >= 0) return;
      for (let i = 0; i < maxSlot; i++) {
        if (!b.slots[i]) {
          b.slots[i] = hero;
          this.discardPicks.delete(heroUid);
          this.inspectedCardUid = null;
          this.audio.playPickup();
          this.syncBattleUI();
          return;
        }
      }
      this.toast(b.slot3Locked ? '3 号位已封锁，当前最多上阵 2 人' : '1~3 号位已满，可点击桥上单位撤回');
    }

    toggleCardInHand(heroUid) {
      if (this.busy) return;
      const b = this.battle;
      const hero = b.hand.find((h) => h.uid === heroUid);
      if (!hero) return;

      const isSlotted = b.slots.some((s) => s && s.uid === heroUid);
      if (isSlotted) {
        this.inspectedCardUid = (this.inspectedCardUid === heroUid) ? null : heroUid;
        this.audio.playPickup();
        this.syncBattleUI();
        return;
      }

      // Balatro-style direct selection: tap 1~4 hand cards to lift & inspect, then tap 换桌 once to discard!
      const limit = this.pureFilterMode ? 3 : 4;
      if (this.discardPicks.has(heroUid)) {
        this.discardPicks.delete(heroUid);
        const remaining = Array.from(this.discardPicks);
        this.inspectedCardUid = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        this.audio.playDrop();
      } else {
        if (this.discardPicks.size >= limit) {
          this.toast(`单次换桌最多选择 ${limit} 张手牌`);
          this.inspectedCardUid = heroUid;
        } else {
          this.discardPicks.add(heroUid);
          this.inspectedCardUid = heroUid;
          this.audio.playPickup();
        }
      }
      this.syncBattleUI();
    }

    swapSlots(idxA, idxB) {
      if (this.busy) return;
      const b = this.battle;
      if (idxA < 0 || idxB < 0 || idxA >= 3 || idxB >= 3) return;
      if (b.slot3Locked && (idxA === 2 || idxB === 2)) return;
      [b.slots[idxA], b.slots[idxB]] = [b.slots[idxB], b.slots[idxA]];
      this.swapSlotIdx = -1;
      this.audio.playPickup();
      this.syncBattleUI();
    }

    async handleDiscardButton() {
      if (this.busy) return;
      const b = this.battle;

      // Ad #7: Emergency Pure Filter (when discardsLeft === 0 and adFilterLeft > 0)
      if (b.discardsLeft <= 0 && !this.pureFilterMode) {
        if (this.run.adFilterLeft > 0) {
          this.playRewardedAd('绝境纯调度 · 换最多 3 张牌（不触发弃牌技）', () => {
            this.run.adFilterLeft -= 1;
            this.pureFilterMode = true;
            this.discardPicks.clear();
            this.toast('请点选最多 3 张手牌，再点【确认纯调度】');
            this.syncBattleUI();
          });
          return;
        }
        this.toast('本波换桌次数已用尽');
        return;
      }

      if (this.pureFilterMode) {
        if (this.discardPicks.size === 0) {
          this.toast('请先点选 1~3 张手牌进行纯调度');
          return;
        }
        const origHandLen = b.hand.length;
        const pickedUids = new Set(this.discardPicks);
        const moved = b.hand.filter((h) => pickedUids.has(h.uid));
        b.hand = b.hand.filter((h) => !pickedUids.has(h.uid));
        b.slots = b.slots.map((s) => (s && pickedUids.has(s.uid) ? null : s));
        this.drawToHandSize();
        b.discardPile.push(...moved);
        if (b.hand.length < origHandLen) {
          this.drawToHandSize();
        }
        this.pureFilterMode = false;
        this.discardPicks.clear();
        this.inspectedCardUid = null;
        this.toast(`已完成纯调度（换出 ${moved.length} 张，手牌保持 ${b.hand.length} 张）`);
        this.syncBattleUI();
        return;
      }

      // Balatro-style 1-step discard: directly discard currently selected cards (no modal mode!)
      if (this.discardPicks.size === 0) {
        this.toast('请先点选 1~4 张手牌，再点【换桌】弃牌抽新');
        return;
      }

      this.busy = true;
      const pickedUids = new Set(this.discardPicks);
      // Slay-the-Spire physical fly-to-discard-pile trajectory!
      const discPileEl = $('btn-discard-pile');
      const discRect = discPileEl ? discPileEl.getBoundingClientRect() : null;
      const cRect = $('battle-canvas').getBoundingClientRect();
      const scaleX = cRect.width > 0 ? 1280 / cRect.width : 1;
      const scaleY = cRect.height > 0 ? 720 / cRect.height : 1;
      const handCards = document.querySelectorAll('#bt-cards-row .v14-card');
      let flyOrder = 0;
      handCards.forEach((c) => {
        if (pickedUids.has(c.dataset.uid)) {
          if (discRect) {
            const cr = c.getBoundingClientRect();
            const dx = Math.round(((discRect.left + discRect.width / 2) - (cr.left + cr.width / 2)) * scaleX);
            const dy = Math.round(((discRect.top + discRect.height / 2) - (cr.top + cr.height / 2)) * scaleY);
            c.style.setProperty('--fly-dx', `${dx}px`);
            c.style.setProperty('--fly-dy', `${dy}px`);
          }
          c.style.setProperty('--fly-delay', `${flyOrder * 45}ms`);
          c.classList.add('card-discard-fly');
          flyOrder++;
        }
      });
      this.audio.playDrop();
      if (discPileEl) {
        setTimeout(() => {
          discPileEl.classList.remove('v15-pile-pop');
          void discPileEl.offsetWidth;
          discPileEl.classList.add('v15-pile-pop');
        }, 160);
      }
      await new Promise((r) => setTimeout(r, 260 + Math.max(0, flyOrder - 1) * 45));

      const discarded = b.hand.filter((h) => pickedUids.has(h.uid));
      const prevHandUids = new Set(b.hand.map((h) => h.uid));
      b.hand = b.hand.filter((h) => !pickedUids.has(h.uid));
      b.slots = b.slots.map((s) => (s && pickedUids.has(s.uid) ? null : s));
      const remainingHand = b.hand.slice();

      b.discardsLeft -= 1;
      this.discardMode = false;
      this.discardPicks.clear();
      this.inspectedCardUid = null;

      const preDiscSnap = this.snapshotBattleHud();
      const res = E.onDiscard(b, discarded, remainingHand);
      b.discardPile.push(...discarded);
      this.drawToHandSize();
      this.newlyDrawnUids = new Set(b.hand.filter((h) => !prevHandUids.has(h.uid)).map((h) => h.uid));
      this.run.gold = b.gold;

      this.syncBattleUI();
      this.syncBattleHudOnly(preDiscSnap);
      this.newlyDrawnUids = null;
      await this.battleStage.playEvents(res.events, this.makePlayEventHooks(preDiscSnap));
      this.syncBattleHudOnly();

      if (b.bossHp <= 0) {
        this.finishBattle(true);
        return;
      }

      this.busy = false;
      this.syncBattleUI();
    }

    async handleStrikeButton() {
      if (this.busy) return;
      const b = this.battle;
      if (this.discardMode) { this.discardMode = false; this.discardPicks.clear(); }
      if (b.slots.filter(Boolean).length === 0) {
        this.toast('请至少派出 1 名侠客上阵！');
        return;
      }

      this.busy = true;
      this.inspectedSlotIdx = -1;
      if (this.battleStage.setInspectedSlot) this.battleStage.setInspectedSlot(-1, []);
      const slotted = b.slots.slice();
      const remainingHand = this.getRemainingHand();

      const preStrikeSnap = this.snapshotBattleHud();
      const preCharging = b.bossCharging;
      const preBreakProgress = b.bossBreakProgress;
      const preBreakThreshold = b.bossBreakThreshold;

      const strikeRes = E.executeStrike(b, slotted, remainingHand, this.run.roster);
      if (strikeRes.directDmg >= preStrikeSnap.bossHp + preStrikeSnap.bossShield) {
        this.battleStage.triggerCutIn('⚔ 终结斩杀！', `单手直伤 ${strikeRes.directDmg}`, '#ffd966');
      } else if (preCharging && preBreakProgress + strikeRes.directDmg >= preBreakThreshold) {
        this.battleStage.triggerCutIn('💥 破招强袭！', `打断蓄力 · 易伤 ×1.5`, '#7be8ff');
      } else if (strikeRes.directDmg >= 450) {
        this.battleStage.triggerCutIn('✦ 绝技连携！', `爆发直伤 ${strikeRes.directDmg}`, '#ff7a98');
      }
      this.run.gold = b.gold;
      if (strikeRes.directDmg > this.run.peakHit) this.run.peakHit = strikeRes.directDmg;
      if (strikeRes.directDmg >= 1000) this.tryUnlockAch('ach_hit_1k');
      if (strikeRes.directDmg >= 5000) this.tryUnlockAch('ach_hit_5k');
      if (strikeRes.directDmg >= 20000) this.tryUnlockAch('ach_hit_20k');
      if (b.squadShield >= 100) this.tryUnlockAch('ach_shield_100');
      for (const ev of strikeRes.events) {
        if (ev.type === 'ach_trigger' && ev.id) this.tryUnlockAch(ev.id);
      }

      // Keep Boss HP bar & badges at pre-strike values until each hit lands on screen!
      this.syncBattleHudOnly(preStrikeSnap);
      await this.battleStage.playEvents(strikeRes.events, this.makePlayEventHooks(preStrikeSnap));
      this.syncBattleHudOnly();

      if (b.bossHp <= 0) {
        this.finishBattle(true);
        return;
      }

      if (b.bossCharging && !b.bossStunned) {
        b.pendingUltNextTurn = true;
        this.toast('⚠ 未能破招！Boss 下回合将释放灭世大招！');
      }

      const preBossSnap = this.snapshotBattleHud();
      const bossEvents = E.onBossActAndRoundEnd(b, slotted, remainingHand, b.intent, this.run.roster);
      this.run.gold = b.gold;

      this.syncBattleHudOnly(preBossSnap);
      await this.battleStage.playEvents(bossEvents, this.makePlayEventHooks(preBossSnap));
      this.syncBattleHudOnly();

      if (b.bossHp <= 0) {
        if (bossEvents.some((e) => e.type === 'poison_tick')) this.tryUnlockAch('ach_poison_kill');
        this.finishBattle(true);
        return;
      }
      if (b.squadHp <= 0 || b.round >= b.maxRounds) {
        this.finishBattle(false);
        return;
      }

      const devouredSet = new Set(strikeRes.devouredUids || []);
      const slottedUids = new Set(slotted.filter(Boolean).map((h) => h.uid));
      for (const h of slotted) {
        if (!h) continue;
        if (devouredSet.has(h.uid)) {
          b.exhaustPile.push(h);
        } else if (h.glassBlade) {
          const saved = E.triggerExhaustHooks(b, h, this.run.roster, [], false);
          if (saved) b.discardPile.push(h);
          else {
            b.exhaustPile.push(h);
            this.toast(`玻璃刃【${h.shortName}】本波力竭退场`);
          }
        } else {
          b.discardPile.push(h);
        }
      }
      b.hand = b.hand.filter((h) => !slottedUids.has(h.uid));
      b.round += 1;
      this.beginRound();
    }

    finishBattle(won) {
      const b = this.battle;
      this.busy = true;
      this.run.gold = b.gold;
      const extraBox = $('po-extra-actions');
      extraBox.innerHTML = '';

      if (won) {
        this.run.totalKills += 1;
        if (b.wave === 1) this.tryUnlockAch('ach_first_w1');
        if (b.wave >= 4) this.tryUnlockAch('ach_clear_w4');
        if (b.wave >= 8) this.tryUnlockAch('ach_clear_w8');
        E.onWaveClear(this.run.relics);
        const baseReward = Math.max(1, b.bossCfg.reward + (this.run.hero.rewardDelta || 0));
        const maxInt = this.run.hero.maxInterest || 5;
        const interest = Math.min(maxInt, Math.floor(this.run.gold / 5));
        const roundBonus = Math.max(0, b.maxRounds - b.round);
        const bloodBonus = (this.run.relics.some((r) => r.id === 'r_bld_heal') && b.squadHp <= b.squadMaxHp * 0.5) ? 4 : 0;
        const totalEarn = baseReward + interest + roundBonus + bloodBonus;
        this.run.gold += totalEarn;

        const isFinalClear = b.wave === this.run.maxWaves;
        let shardsEarned = 0;
        let ascBonusOrbs = 0;
        let mergedInfo = '';
        if (isFinalClear) {
          shardsEarned = this.meta.calcRunShards(this.run.totalKills, true, this.run.shardBonusMult || 1.0);
          const r = this.meta.addShards(shardsEarned);
          if (r.mergedOrbs > 0) mergedInfo = `（自动合成 +${r.mergedOrbs} 宝珠）`;
          const ascRes = this.meta.recordAscensionClear(this.run.ascension || 0);
          ascBonusOrbs = ascRes.bonusOrbs || 0;
          this.meta.clearActiveRun();
          if (this.tap) {
            this.tap.submitRunScore({
              runId: this.run.runId,
              heroName: this.run.hero.name,
              kills: this.run.totalKills,
              peakHit: this.run.peakHit,
              themes: this.run.activeThemes
            });
          }
        }

        $('po-title').textContent = isFinalClear ? '🏆 8 波通关！' : `第 ${b.wave} 波讨伐成功！`;
        $('po-title').className = 'po-title win';
        $('po-sub').textContent = `${b.bossCfg.name} 已倒下 · 用时 ${b.round}/${b.maxRounds} 回合`;
        $('po-rows').innerHTML = `
          <div class="po-row"><span>赏金报酬</span><b>+${baseReward}G</b></div>
          <div class="po-row"><span>黑市利息 (上限${maxInt}G)</span><b>+${interest}G</b></div>
          <div class="po-row"><span>速胜奖励 (剩${roundBonus}回合)</span><b>+${roundBonus}G</b></div>
          ${bloodBonus > 0 ? `<div class="po-row"><span>血瓶续命残血奖</span><b>+${bloodBonus}G</b></div>` : ''}
          <div class="po-row total"><span>当前总金币</span><b>${this.run.gold}G</b></div>
          ${isFinalClear ? `<div class="po-row" style="color:#6be5ff"><span>💎 通关结算</span><b>+${shardsEarned} 碎片${mergedInfo}</b></div>` : ''}
          ${ascBonusOrbs > 0 ? `<div class="po-row" style="color:#ffd966"><span>🏆 进阶首通奖励</span><b>+${ascBonusOrbs} 宝珠</b></div>` : ''}
        `;
        if (isFinalClear && shardsEarned > 0) {
          extraBox.innerHTML = `<button class="v14-ad-btn" id="btn-po-double-orbs">▶ 看广告 · 碎片 ×2 (+${shardsEarned}碎片)</button>`;
          $('btn-po-double-orbs').onclick = () => {
            this.playRewardedAd(`结算碎片翻倍 (+${shardsEarned} 宝珠碎片)`, () => {
              const r = this.meta.addShards(shardsEarned);
              $('btn-po-double-orbs').disabled = true;
              $('btn-po-double-orbs').textContent = `已翻倍 (+${shardsEarned}碎片)`;
              this.toast(`额外获得 +${shardsEarned} 碎片${r.mergedOrbs > 0 ? `（合成 +${r.mergedOrbs} 宝珠!）` : ''}`);
            });
          };
        }
        const nextBtn = $('po-next-btn');
        nextBtn.textContent = isFinalClear ? '返回出征大厅（购买新英雄）' : '进入酒馆黑市 · 构筑齿轮 →';
        nextBtn.onclick = () => {
          $('payout-modal').classList.add('hidden');
          if (isFinalClear) {
            this.openPrepHall();
          } else {
            this.run.wave += 1;
            this.openShop();
          }
        };
      } else {
        const shardsEarned = this.meta.calcRunShards(this.run.totalKills, false, this.run.shardBonusMult || 1.0);
        const showFinalLossSettle = () => {
          this.meta.clearActiveRun();
          if (this.tap && this.run.totalKills > 0) {
            this.tap.submitRunScore({
              runId: this.run.runId,
              heroName: this.run.hero.name,
              kills: this.run.totalKills,
              peakHit: this.run.peakHit,
              themes: this.run.activeThemes
            });
          }
          const r = shardsEarned > 0 ? this.meta.addShards(shardsEarned) : { mergedOrbs: 0 };
          const mergedInfo = r.mergedOrbs > 0 ? `（合成 +${r.mergedOrbs} 宝珠）` : '';
          $('po-title').textContent = '本局结算';
          $('po-title').className = 'po-title lose';
          $('po-sub').textContent = `倒在第 ${b.wave} 波 ${b.bossCfg.name}（剩余 ${b.bossHp} HP）`;
          $('po-rows').innerHTML = `
            <div class="po-row"><span>讨伐波次</span><b>${this.run.totalKills} 波</b></div>
            <div class="po-row"><span>单手最高直伤</span><b>${this.run.peakHit}</b></div>
            <div class="po-row" style="color:#6be5ff"><span>💎 本局结算</span><b>+${shardsEarned} 碎片${mergedInfo}</b></div>
          `;
          extraBox.innerHTML = shardsEarned > 0
            ? `<button class="v14-ad-btn" id="btn-po-double-orbs">▶ 看广告 · 碎片 ×2 (+${shardsEarned}碎片)</button>`
            : '';
          if ($('btn-po-double-orbs')) {
            $('btn-po-double-orbs').onclick = () => {
              this.playRewardedAd(`结算碎片翻倍 (+${shardsEarned} 宝珠碎片)`, () => {
                const r2 = this.meta.addShards(shardsEarned);
                $('btn-po-double-orbs').disabled = true;
                $('btn-po-double-orbs').textContent = `已翻倍 (+${shardsEarned}碎片)`;
                this.toast(`额外获得 +${shardsEarned} 碎片${r2.mergedOrbs > 0 ? `（合成 +${r2.mergedOrbs} 宝珠!）` : ''}`);
              });
            };
          }
          const nextBtn = $('po-next-btn');
          nextBtn.textContent = '返回出征大厅（选英雄 / 再来一局）';
          nextBtn.onclick = () => this.openPrepHall();
        };

        // P0 Fix: Separate Revive Choice from Final Settlement (no double-orb + revive exploit!)
        if (this.run.adReviveLeft > 0) {
          $('po-title').textContent = '讨伐受挫';
          $('po-title').className = 'po-title lose';
          $('po-sub').textContent = `倒在第 ${b.wave} 波 ${b.bossCfg.name}（剩余 ${b.bossHp} HP）`;
          $('po-rows').innerHTML = `
            <div class="po-row"><span>讨伐波次</span><b>${this.run.totalKills} 波</b></div>
            <div class="po-row"><span>单手最高直伤</span><b>${this.run.peakHit}</b></div>
            <div class="po-row"><span>若现在结束可得</span><b>+${shardsEarned} 宝珠碎片</b></div>
          `;
          extraBox.innerHTML = `<button class="v14-ad-btn" id="btn-po-revive">▶ 看广告复活 · 满血重打第 ${b.wave} 波</button>`;
          $('btn-po-revive').onclick = () => {
            this.playRewardedAd(`满血重打第 ${b.wave} 波（保留全部构筑）`, () => {
              this.run.adReviveLeft -= 1;
              $('payout-modal').classList.add('hidden');
              this.startWaveBattle(this.run.wave);
            });
          };
          const nextBtn = $('po-next-btn');
          nextBtn.textContent = '放弃重打 · 结算本局碎片 →';
          nextBtn.onclick = () => showFinalLossSettle();
        } else {
          showFinalLossSettle();
        }
      }
      $('payout-modal').classList.remove('hidden');
    }

    snapshotBattleHud() {
      const b = this.battle;
      if (!b) return null;
      return {
        wave: b.wave,
        round: b.round,
        maxRounds: b.maxRounds,
        gold: b.gold,
        squadHp: b.squadHp,
        squadMaxHp: b.squadMaxHp,
        squadShield: b.squadShield,
        bossCfg: b.bossCfg,
        bossHp: b.bossHp,
        bossMaxHp: b.bossMaxHp,
        bossShield: b.bossShield,
        bossPoison: b.bossPoison || 0,
        bossVuln: Boolean(b.bossVuln),
        bossStunned: Boolean(b.bossStunned),
        intent: b.intent
      };
    }

    makePlayEventHooks(snap) {
      const pulseBar = (el) => {
        if (!el) return;
        el.classList.remove('hp-bar-hit');
        void el.offsetWidth;
        el.classList.add('hp-bar-hit');
      };
      return {
        onBossDamage: (dmg, ignoreShield = false) => {
          if (!snap) { this.syncBattleHudOnly(); return; }
          let rem = Math.max(0, Number(dmg) || 0);
          if (!ignoreShield && snap.bossShield > 0) {
            const blk = Math.min(snap.bossShield, rem);
            snap.bossShield -= blk;
            rem -= blk;
          }
          snap.bossHp = Math.max(0, snap.bossHp - rem);
          this.syncBattleHudOnly(snap);
          pulseBar($('bt-boss-hp-bar'));
        },
        onSquadDamage: (ev) => {
          if (!snap) { this.syncBattleHudOnly(); return; }
          if (ev && ev.isThorns) {
            let rem = Math.max(0, Number(ev.rawDmg) || 0);
            const blk = Math.min(snap.squadShield, rem);
            snap.squadShield -= blk;
            rem -= blk;
            snap.squadHp = Math.max(1, snap.squadHp - rem);
          } else if (ev) {
            snap.squadShield = Math.max(0, snap.squadShield - (Number(ev.blocked) || 0));
            snap.squadHp = Math.max(0, snap.squadHp - (Number(ev.hpLost) || 0));
          }
          this.syncBattleHudOnly(snap);
          pulseBar(document.querySelector('#battle-top-bar .bt-sq-bar-wrap'));
        },
        onBossStatus: (st) => {
          if (!snap || !st) { this.syncBattleHudOnly(); return; }
          if (st.addPoison) snap.bossPoison = (snap.bossPoison || 0) + st.addPoison;
          if (st.vuln) snap.bossVuln = true;
          if (st.stunned) snap.bossStunned = true;
          if (st.addShield) snap.bossShield = (snap.bossShield || 0) + st.addShield;
          this.syncBattleHudOnly(snap);
        },
        onShieldGain: (delta) => {
          if (!snap) { this.syncBattleHudOnly(); return; }
          snap.squadShield = Math.max(0, (snap.squadShield || 0) + (Number(delta) || 0));
          this.syncBattleHudOnly(snap);
        },
        onGoldGain: (delta) => {
          if (!snap) { this.syncBattleHudOnly(); return; }
          snap.gold = Math.max(0, (snap.gold || 0) + (Number(delta) || 0));
          this.syncBattleHudOnly(snap);
        },
        onSyncHud: () => this.syncBattleHudOnly(snap),
        onRelicPulse: (uid, lbl) => this.pulseRelicChip(uid, lbl),
        onToast: (t) => this.toast(t)
      };
    }

    syncBattleHudOnly(overrideState = null) {
      const b = overrideState || this.battle;
      if (!b) return;
      $('bt-title').innerHTML = `<span class="v15-hud-tag">第${b.wave}/8波</span><span class="v15-hud-tag">第${b.round}/${b.maxRounds}回合</span><span class="v15-hud-tag gold">${pxIcon('gold')}${b.gold}</span>`;
      $('bt-squad-hp-text').textContent = `${b.squadHp}/${b.squadMaxHp}${b.squadShield > 0 ? ` (+${b.squadShield}盾)` : ''}`;
      $('bt-squad-hp-fill').style.width = `${Math.max(0, Math.min(100, (b.squadHp / b.squadMaxHp) * 100))}%`;
      $('bt-squad-shield-fill').style.width = `${Math.max(0, Math.min(100, (b.squadShield / b.squadMaxHp) * 100))}%`;

      $('bt-boss-name').textContent = `${b.bossCfg.name}`;
      $('bt-boss-hp-text').textContent = `${b.bossHp} / ${b.bossMaxHp}${b.bossShield > 0 ? ` (+${b.bossShield}盾)` : ''}`;
      const pct = Math.max(0, Math.min(100, (b.bossHp / b.bossMaxHp) * 100));
      const barEl = $('bt-boss-hp-bar');
      if (barEl) {
        let lagEl = barEl.querySelector('.boss-hp-lag');
        let fillEl = barEl.querySelector('.boss-hp-fill');
        if (!lagEl || !fillEl) {
          barEl.innerHTML = `<div class="boss-hp-track"><div class="boss-hp-lag" style="width:${pct}%"></div><div class="boss-hp-fill" style="width:${pct}%"></div></div>`;
          lagEl = barEl.querySelector('.boss-hp-lag');
          fillEl = barEl.querySelector('.boss-hp-fill');
        }
        fillEl.style.width = `${pct}%`;
        lagEl.style.width = `${pct}%`;
      }

      this.battleStage.syncBossState(b, b.intent);
    }

    syncBattleUI() {
      const b = this.battle;
      this.syncBattleHudOnly();
      this.battleStage.syncSlots(b.slots, { slot3Locked: b.slot3Locked });

      const drawIco = `<svg class="v15-pile-ico" viewBox="0 0 10 12" shape-rendering="crispEdges"><rect x="2" y="0" width="7" height="9" fill="#5e78a8"/><rect x="1" y="1" width="7" height="9" fill="#223054"/><rect x="2" y="2" width="5" height="7" fill="#8fd4ff"/><rect x="3" y="4" width="3" height="3" fill="#ffe89e"/></svg>`;
      const discIco = `<svg class="v15-pile-ico" viewBox="0 0 10 12" shape-rendering="crispEdges"><rect x="2" y="1" width="7" height="9" fill="#524668"/><rect x="1" y="2" width="7" height="9" fill="#1e182e"/><rect x="2" y="3" width="5" height="7" fill="#8b7fa6"/><rect x="3" y="5" width="3" height="1" fill="#ffd966"/></svg>`;
      $('btn-draw-pile').innerHTML = `${drawIco}<span>抽</span><b>${b.drawPile.length}</b>`;
      $('btn-discard-pile').innerHTML = `${discIco}<span>弃</span><b>${b.discardPile.length}</b>`;

      const rBar = $('bt-relic-chain');
      rBar.className = 'steel-panel v14-relic-bar';
      const emptyCount = Math.max(0, this.run.maxRelicSlots - this.run.relics.length);
      const ownedHtml = this.run.relics.map((r) => {
        const iconUrl = this.getIconUrlSafe(r.icon);
        const rTier = r.tier || 'S';
        return `
          <div class="v14-relic-chip v15-relic-tier-${rTier} ${rTier === 'SSS' || rTier === 'S' ? 'v15-idle-tilt' : ''}" data-ruid="${r.uid}" title="${esc(r.desc)}">
            ${renderCardTierOrnament(rTier, 44, 52)}
            ${iconUrl ? `<img class="v14-relic-mini-icon" src="${iconUrl}" alt="" />` : ''}
            <div class="v14-relic-chip-text">
              <div class="v14-relic-chip-title">${esc(r.name)}</div>
              <div class="v14-relic-chip-sub">${esc(this.formatRelicLiveStat(r))}</div>
            </div>
          </div>
        `;
      }).join('');
      const emptyHtml = Array.from({ length: emptyCount }, () => `<div class="v15-relic-empty-slot"></div>`).join('');
      rBar.innerHTML = ownedHtml + emptyHtml;
      rBar.querySelectorAll('.v14-relic-chip').forEach((chip) => {
        this.bindInteractive3DTilt(chip, 14, 12, !chip.classList.contains('v15-idle-tilt'));
        chip.onclick = (ev) => {
          ev.stopPropagation();
          const r = this.run.relics.find((x) => x.uid === chip.dataset.ruid);
          const tip = $('v14-card-tip');
          if (r && tip) {
            this.inspectedSlotIdx = -1;
            this.inspectedCardUid = null;
            if (this.battleStage.setInspectedSlot) this.battleStage.setInspectedSlot(-1, []);
            tip.innerHTML = `<b style="color:#ffe266">${esc(r.name)}</b><br/>${esc(r.desc)}`;
            tip.classList.remove('hidden');
            this.audio.playPickup();
          }
        };
      });

      const slotCenters = [225, 405, 585];
      const slotsEl = $('v14-slots-bar');
      // Zero overhead buttons — drag bridge units directly to swap slots or pull down to hand to recall!
      slotsEl.innerHTML = b.slots.map((h, idx) => {
        if (!h || (idx === 2 && b.slot3Locked)) return '';
        return `<div class="v15-bridge-hitbox" style="left:${slotCenters[idx]}px" data-hit-slot="${idx}"></div>`;
      }).join('');

      slotsEl.querySelectorAll('[data-hit-slot]').forEach((box) => {
        const fromIdx = Number(box.dataset.hitSlot);
        box.onpointerdown = (ev) => {
          if (this.busy || (ev.button !== undefined && ev.button !== 0)) return;
          const startX = ev.clientX;
          const startY = ev.clientY;
          let dragging = false;

          const getStageCoord = (cx, cy) => {
            const cRect = $('battle-canvas').getBoundingClientRect();
            if (!cRect.width || !cRect.height) return { sx: slotCenters[fromIdx], sy: 416 };
            return {
              sx: ((cx - cRect.left) / cRect.width) * 1280,
              sy: ((cy - cRect.top) / cRect.height) * 720
            };
          };

          const cleanup = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onCancel);
            if (this.battleStage.setUnitDragPos) this.battleStage.setUnitDragPos(fromIdx, null, null, -1);
          };

          const onMove = (mev) => {
            if (!dragging && Math.hypot(mev.clientX - startX, mev.clientY - startY) > 8) {
              dragging = true;
              // Ensure this unit's relation arrows & spotlight appear & follow it live during drag!
              if (this.inspectedSlotIdx !== fromIdx) {
                this.inspectedSlotIdx = fromIdx;
                this.inspectedCardUid = null;
                this.applyInspectSpotlight(fromIdx);
              }
            }
            if (dragging && this.battleStage.setUnitDragPos) {
              const { sx, sy } = getStageCoord(mev.clientX, mev.clientY);
              const isRecallZone = sy > 465;
              let targetSlot = -1;
              if (!isRecallZone) {
                const maxS = b.slot3Locked ? 2 : 3;
                let bestD = 9999;
                for (let i = 0; i < maxS; i++) {
                  const d = Math.abs(sx - slotCenters[i]);
                  if (d < bestD && d < 140) { bestD = d; targetSlot = i; }
                }
              }
              this.battleStage.setUnitDragPos(fromIdx, sx, Math.max(180, Math.min(680, sy + 32)), targetSlot, isRecallZone);
            }
          };

          const onUp = (uev) => {
            const { sx, sy } = getStageCoord(uev.clientX, uev.clientY);
            const wasDragging = dragging;
            cleanup();
            if (!wasDragging) {
              // Tap on bridge unit -> inspect unit (yellow outline + aura + synergy arrows + info card; drag down to recall!)
              if (b.slots[fromIdx]) {
                this.inspectedSlotIdx = (this.inspectedSlotIdx === fromIdx) ? -1 : fromIdx;
                this.inspectedCardUid = null;
                this.audio.playPickup();
                this.syncBattleUI();
              }
              return;
            }
            if (sy > 465) {
              // Pulled down into mirror lake / hand area -> recall naturally back to hand!
              if (this.inspectedSlotIdx === fromIdx) this.inspectedSlotIdx = -1;
              b.slots[fromIdx] = null;
              this.audio.playDrop();
              this.syncBattleUI();
            } else {
              // Dropped near another bridge slot -> swap/move!
              const maxS = b.slot3Locked ? 2 : 3;
              let targetSlot = fromIdx;
              let bestD = 9999;
              for (let i = 0; i < maxS; i++) {
                const d = Math.abs(sx - slotCenters[i]);
                if (d < bestD && d < 150) { bestD = d; targetSlot = i; }
              }
              if (targetSlot !== fromIdx) {
                if (this.inspectedSlotIdx === fromIdx) this.inspectedSlotIdx = targetSlot;
                this.swapSlots(fromIdx, targetSlot);
              }
            }
          };

          const onCancel = () => cleanup();

          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
          window.addEventListener('pointercancel', onCancel);
        };
      });

      const remainingHand = this.getRemainingHand();
      const fc = E.forecast(b, b.slots, remainingHand);
      if (this.battleStage.syncSynergyLinks) this.battleStage.syncSynergyLinks(fc.links);
      const fcCore = $('fc-core-content');
      const hasAnyActive = b.slots.some(Boolean);
      fcCore.innerHTML = hasAnyActive ? `
        <div class="v14-fc-metrics">
          <span class="v14-fc-pill direct">${pxIcon('atk', 'lg')} ${fc.directDmg}${fc.willDirectKill ? ' 斩杀!' : ''}</span>
          ${fc.poisonEndDmg > 0 ? `<span class="v14-fc-pill poison">${pxIcon('poison')} ${fc.poisonEndDmg}</span>` : ''}
          ${fc.shieldTotal > 0 ? `<span class="v14-fc-pill shield">${pxIcon('shield')} ${fc.shieldTotal}</span>` : ''}
          <span class="v14-fc-pill">${pxIcon('hit')} ${fc.hits}段</span>
          ${fc.willBreak ? `<span class="v14-fc-pill break">可破招</span>` : ''}
        </div>
        ${fc.links.length > 0 ? `
          <div class="v14-fc-links">
            ${fc.links.map((l) => `<span class="v14-link-chip">✦ ${esc(l)}</span>`).join('')}
          </div>
        ` : ''}
      ` : '';

      const hasScav = b.hand.some((h) => h.discardTriggerLeftmostHand);
      const slottedUids = new Set(b.slots.filter(Boolean).map((h) => h.uid));
      const row = $('bt-cards-row');
      row.className = 'v14-hand-row';
      let firstUnslottedMarked = false;
      const totalCards = b.hand.length;
      const midIdx = (totalCards - 1) / 2;
      row.innerHTML = b.hand.map((h, idx) => {
        const inSlot = slottedUids.has(h.uid);
        const isPick = this.discardPicks.has(h.uid);
        const theme = D.THEMES[h.theme] || D.THEMES.core;
        const grown = h.atk > h.baseAtk || h.knifeCount > h.baseKnifeCount || h.shieldVal > h.baseShieldVal || h.applyPoison > h.baseApplyPoison;
        let leftmostBadge = '';
        if (hasScav && !inSlot && !firstUnslottedMarked) {
          firstUnslottedMarked = true;
          leftmostBadge = `<span class="v14-leftmost-tag">最左(导流目标)</span>`;
        }
        const shortPerk = this.getShortPerk(h);
        const hasBadges = h.redSeal || h.glassBlade || h.greedBadge || h.ironPlated;
        const offset = idx - midIdx;
        const fanRot = (offset * 2.1).toFixed(2);
        const fanY = Math.round(Math.abs(offset) * Math.abs(offset) * 2.1);
        const hasHolo = h.tier === 'A' || h.tier === 'S' || h.tier === 'SSS';
        const isSelected = this.inspectedCardUid === h.uid;
        const isNewlyDrawn = this.newlyDrawnUids && this.newlyDrawnUids.has(h.uid);
        const drawDelay = isNewlyDrawn ? `${(idx % 5) * 55}ms` : '0ms';
        // Exact trajectory from draw pile (stage x≈64, y≈526) to each card's fan slot!
        const estCardX = 640 + offset * 144;
        const dealDx = Math.round(64 - estCardX);
        const dealDy = Math.round(526 - 600);
        return `
          <div class="v14-card v14-card-tier-${h.tier} ${inSlot ? 'in-slot' : ''} ${isPick ? 'discard-pick' : ''} ${isSelected ? 'selected-card' : ''} ${isNewlyDrawn ? 'card-draw-in' : ''}" data-uid="${h.uid}" style="--fan-rot:${fanRot}deg;--fan-y:${fanY}px;--card-glow:${theme.bg};--draw-delay:${drawDelay};--deal-dx:${dealDx}px;--deal-dy:${dealDy}px;z-index:${10 + idx}">
            ${renderCardTierOrnament(h.tier)}
            ${leftmostBadge}
            <div class="v14-card-top">
              <span class="v14-tier tier-${h.tier}">${h.tier}</span>
              <span class="v14-theme-pill" style="background:${theme.bg};color:${theme.color}">${theme.short}</span>
              <span class="v14-card-atk ${grown ? 'grown' : ''}">${pxIcon('atk')}${h.atk}</span>
            </div>
            <div class="v14-card-hero-stage">
              <div class="v14-card-sprite" data-unit="${h.unitId}"></div>
              <div class="v14-card-name">${esc(h.shortName)}${h.isBridge ? ' <span class="v14-bridge-tag">接口</span>' : ''}</div>
            </div>
            <div class="v14-card-perk">${esc(shortPerk)}</div>
            ${hasBadges ? `
              <div class="v14-card-badges">
                ${h.redSeal ? `<span class="v14-inscrip-pill">双连印</span>` : ''}
                ${h.glassBlade ? `<span class="v14-inscrip-pill glass">玻璃刃</span>` : ''}
                ${h.greedBadge ? `<span class="v14-inscrip-pill greed">+2G</span>` : ''}
                ${h.ironPlated ? `<span class="v14-inscrip-pill iron">+18盾</span>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      row.querySelectorAll('.v14-card-sprite').forEach((sp) => {
        if (this.sprites && this.sprites.createDomSprite) {
          sp.appendChild(this.sprites.createDomSprite(sp.dataset.unit, 'idle', 68));
        }
      });
      const tiltCards = row.querySelectorAll('.v14-card-tier-B, .v14-card-tier-A, .v14-card-tier-S, .v14-card-tier-SSS');
      tiltCards.forEach((card) => {
        const isB = card.classList.contains('v14-card-tier-B');
        const maxY = isB ? 8 : 15;
        const maxX = isB ? 6 : 12;
        card.onpointermove = (ev) => {
          if (card.classList.contains('dragging-card') || card.classList.contains('in-slot')) return;
          const rect = card.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          card._hoveringTilt = true;
          const nx = Math.max(-1, Math.min(1, ((ev.clientX - rect.left) / rect.width) * 2 - 1));
          const ny = Math.max(-1, Math.min(1, ((ev.clientY - rect.top) / rect.height) * 2 - 1));
          const ry = nx * maxY;
          const rx = -ny * maxX;
          card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
          card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
          card.style.setProperty('--mx', `${(50 + nx * 42).toFixed(1)}%`);
          card.style.setProperty('--my', `${(50 + ny * 42).toFixed(1)}%`);
          card.style.setProperty('--sh-x', `${(-ry * 0.8).toFixed(1)}px`);
          card.style.setProperty('--sh-y', `${(9 + rx * 0.6).toFixed(1)}px`);
        };
        card.onpointerleave = () => {
          card._hoveringTilt = false;
          if (isB) {
            card.style.setProperty('--rx', '0deg');
            card.style.setProperty('--ry', '0deg');
            card.style.setProperty('--mx', '50%');
            card.style.setProperty('--my', '35%');
            card.style.setProperty('--sh-x', '0px');
            card.style.setProperty('--sh-y', '4px');
          }
        };
      });
      if (tiltCards.length || row.querySelector('.v15-card-fx-canvas')) {
        this.startCardFxLoop();
      }
      const tipEl = $('v14-card-tip');
      const inspectedUnit = (this.inspectedSlotIdx >= 0 && b.slots[this.inspectedSlotIdx]) ? b.slots[this.inspectedSlotIdx] : null;
      const inspectedHero = (!inspectedUnit && this.inspectedCardUid) ? b.hand.find((x) => x.uid === this.inspectedCardUid) : null;
      if (tipEl) {
        if (inspectedUnit) {
          const badges = [];
          if (inspectedUnit.redSeal) badges.push('双连印');
          if (inspectedUnit.glassBlade) badges.push('玻璃刃');
          if (inspectedUnit.greedBadge) badges.push('贪财+2G');
          if (inspectedUnit.ironPlated) badges.push('铁壁+18盾');
          const bStr = badges.length ? ` <span style="color:#ff9cb0">[${badges.join(' · ')}]</span>` : '';
          tipEl.innerHTML = `<b style="color:#ffe266">${esc(inspectedUnit.name)} · ${pxIcon('atk')}${inspectedUnit.atk}</b>${bStr}<br/>${esc(inspectedUnit.desc)}`;
          tipEl.classList.remove('hidden');
        } else if (inspectedHero) {
          tipEl.innerHTML = `<b style="color:#ffd966">${esc(inspectedHero.name)} · ${pxIcon('atk')}${inspectedHero.atk}</b><br/>${esc(inspectedHero.desc)}`;
          tipEl.classList.remove('hidden');
        } else {
          tipEl.classList.add('hidden');
        }
      }

      // Compute & sync Spotlight Dimming + High-Overhead Synergy Arrows
      this.applyInspectSpotlight(inspectedUnit ? this.inspectedSlotIdx : -1);

      // Mobile-native Slay-the-Spire Pointer Interaction:
      // Tap = Inspect & Glow; Drag = Card centers at bottom & aims curved pixel arrow at bridge!
      row.querySelectorAll('.v14-card').forEach((card) => {
        const uid = card.dataset.uid;
        card.onpointerdown = (ev) => {
          if (this.busy || (ev.button !== undefined && ev.button !== 0)) return;
          const startX = ev.clientX;
          const startY = ev.clientY;
          const canDrag = !this.pureFilterMode && !slottedUids.has(uid);
          let dragging = false;

          const getStagePos = (clientX, clientY) => {
            const cRect = $('battle-canvas').getBoundingClientRect();
            if (!cRect.width || !cRect.height) return { sx: 640, sy: 360, slotIdx: -1 };
            const sx = ((clientX - cRect.left) / cRect.width) * 1280;
            const sy = ((clientY - cRect.top) / cRect.height) * 720;
            let slotIdx = -1;
            if (sy < 485) {
              const centers = [225, 405, 585];
              let bestD = 9999;
              const maxS = b.slot3Locked ? 2 : 3;
              for (let i = 0; i < maxS; i++) {
                const d = Math.abs(sx - centers[i]);
                if (d < bestD && d < 165) { bestD = d; slotIdx = i; }
              }
              // Even if pointing anywhere on the upper battlefield, default to first empty slot!
              if (slotIdx === -1) {
                for (let i = 0; i < maxS; i++) { if (!b.slots[i]) { slotIdx = i; break; } }
              }
            }
            return { sx, sy, slotIdx };
          };

          const cleanup = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onCancel);
            row.classList.remove('is-dragging-hand');
            card.classList.remove('dragging-centered');
            card.style.removeProperty('--drag-cx');
            card.style.removeProperty('--drag-cy');
            card.style.removeProperty('--drag-rx');
            card.style.removeProperty('--drag-ry');
            if (this.battleStage.setDragArrow) this.battleStage.setDragArrow(null);
          };

          const onMove = (mev) => {
            const dx = mev.clientX - startX;
            const dy = mev.clientY - startY;
            if (!dragging && canDrag && Math.hypot(dx, dy) > 10) {
              dragging = true;
              // Exact untransformed card layout center via card.offsetParent (100% immune to fan/hover/offsetParent mismatch!)
              const cRect = $('battle-canvas').getBoundingClientRect();
              const op = card.offsetParent || row;
              const opRect = op.getBoundingClientRect();
              if (cRect.width > 0 && cRect.height > 0) {
                const scaleX = 1280 / cRect.width;
                const scaleY = 720 / cRect.height;
                const opStageLeft = (opRect.left - cRect.left) * scaleX;
                const opStageTop = (opRect.top - cRect.top) * scaleY;
                const baseStageX = opStageLeft + card.offsetLeft + card.offsetWidth / 2;
                const baseStageY = opStageTop + card.offsetTop + card.offsetHeight / 2;
                const shiftX = Math.round(640 - baseStageX);
                const shiftY = Math.round(560 - baseStageY);
                card.style.setProperty('--drag-cx', `${shiftX}px`);
                card.style.setProperty('--drag-cy', `${shiftY}px`);
              }
              row.classList.add('is-dragging-hand');
              card.classList.add('dragging-centered');
              if (tipEl) tipEl.classList.add('hidden');
            }
            if (dragging && this.battleStage.setDragArrow) {
              const { sx, sy, slotIdx } = getStagePos(mev.clientX, mev.clientY);
              // Arrow emerges cleanly from the exact top-center edge of the centered card (640, 452)
              this.battleStage.setDragArrow({ fromX: 640, fromY: 452, toX: sx, toY: sy, slotIdx, active: true });
              // Refined, upright 3D aim tilt (center-origin, max ±8°/±6°, zero crooked roll!)
              const nx = Math.max(-1, Math.min(1, (sx - 640) / 480));
              const ny = Math.max(-0.25, Math.min(1, (560 - sy) / 420));
              const dragRy = nx * 8.0;
              const dragRx = ny * 6.0;
              card.style.setProperty('--drag-rx', `${dragRx.toFixed(2)}deg`);
              card.style.setProperty('--drag-ry', `${dragRy.toFixed(2)}deg`);
              card.style.setProperty('--mx', `${(50 + nx * 42).toFixed(1)}%`);
              card.style.setProperty('--my', `${(50 - ny * 38).toFixed(1)}%`);
              card.style.setProperty('--sh-x', `${(-dragRy * 0.9).toFixed(1)}px`);
              card.style.setProperty('--sh-y', `${(8 + dragRx * 0.6).toFixed(1)}px`);
            }
          };

          const onUp = (uev) => {
            const { sy, slotIdx } = getStagePos(uev.clientX, uev.clientY);
            const wasDragging = dragging;
            cleanup();
            if (wasDragging) {
              if (sy < 485) {
                this.deployCardToSlot(uid, slotIdx);
              }
            } else {
              this.toggleCardInHand(uid);
            }
          };

          const onCancel = () => cleanup();

          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
          window.addEventListener('pointercancel', onCancel);
        };
      });

      const discBtn = $('btn-bt-discard');
      const hasPicks = this.discardPicks.size > 0;
      const canActDisc = (hasPicks && (b.discardsLeft > 0 || this.pureFilterMode)) || (b.discardsLeft <= 0 && this.run.adFilterLeft > 0);
      discBtn.classList.remove('active-mode');
      discBtn.classList.toggle('no-discards', b.discardsLeft <= 0 && !this.pureFilterMode && this.run.adFilterLeft <= 0);
      discBtn.classList.toggle('ready-discard', canActDisc);
      let discTitle = '换桌';
      let discSub = '';
      let discBadge = `${b.discardsLeft}/${b.maxDiscards}`;
      if (this.pureFilterMode) {
        discTitle = '纯调度';
        discSub = hasPicks ? `弃 ${this.discardPicks.size} 张` : '';
        discBadge = `${this.discardPicks.size}/3`;
      } else if (b.discardsLeft <= 0 && this.run.adFilterLeft > 0) {
        discTitle = '▶ 绝境调度';
        discSub = '滤 3 张';
        discBadge = 'AD';
      } else if (hasPicks) {
        discTitle = '换桌';
        discSub = `弃 ${this.discardPicks.size} 张`;
      }
      const discRim = canActDisc ? '#7ef2ff' : '#ffd966';
      const discInnerRim = canActDisc ? '#0d3f54' : '#122244';
      const discCore = canActDisc ? '#145a78' : '#1a325e';
      discBtn.innerHTML = `
        <div class="v15-crest-wrap">
          <svg class="v15-crest-svg" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">
            <!-- Matching Twin Diamond Crest (Sapphire & Gold Mirror of Strike Crest) -->
            <polygon points="16,0 32,16 16,32 0,16" fill="#0d0714"/>
            <polygon points="16,1.5 30.5,16 16,30.5 1.5,16" fill="${discRim}"/>
            <polygon points="16,3.5 28.5,16 16,28.5 3.5,16" fill="${discInnerRim}"/>
            <polygon points="16,5 27,16 16,27 5,16" fill="${discCore}"/>
            <!-- Four Gold Corner Filigree Sparks -->
            <rect x="15" y="2" width="2" height="3" fill="#fff6cc"/>
            <rect x="15" y="27" width="2" height="3" fill="#fff6cc"/>
            <rect x="2" y="15" width="3" height="2" fill="#fff6cc"/>
            <rect x="27" y="15" width="3" height="2" fill="#fff6cc"/>
            <!-- Crisp Pixel Arcane Hourglass / Fate Rewind Emblem -->
            <rect x="11" y="9" width="10" height="2" fill="#ffe89e"/>
            <rect x="11" y="21" width="10" height="2" fill="#ffe89e"/>
            <rect x="12" y="11" width="8" height="2" fill="#7be8ff"/>
            <rect x="13" y="13" width="6" height="2" fill="#c4f7ff"/>
            <rect x="15" y="15" width="2" height="2" fill="#ffffff"/>
            <rect x="13" y="17" width="6" height="2" fill="#7be8ff"/>
            <rect x="12" y="19" width="8" height="2" fill="#4cc4f0"/>
            <!-- Gold Side Pillars -->
            <rect x="11" y="11" width="1" height="10" fill="#d4a038"/>
            <rect x="20" y="11" width="1" height="10" fill="#d4a038"/>
          </svg>
          <span class="v15-crest-count">${discBadge}</span>
        </div>
        <div class="v15-crest-ribbon">
          <b>${discTitle}</b>
          ${discSub ? `<small>${discSub}</small>` : ''}
        </div>
      `;

      const activeN = b.slots.filter(Boolean).length;
      const strikeBtn = $('btn-bt-strike');
      const isLethal = Boolean(fc.willDirectKill || fc.willBreak);
      strikeBtn.classList.toggle('ready-glow', activeN > 0 && !isLethal);
      strikeBtn.classList.toggle('lethal-glow', isLethal);
      const strikeRim = isLethal ? '#fff2a8' : '#ffd966';
      const strikeBg = activeN === 0 ? '#3a1a28' : (isLethal ? '#b81d38' : '#8c142a');
      strikeBtn.innerHTML = `
        <div class="v15-crest-wrap">
          <svg class="v15-crest-svg" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">
            <polygon points="16,0 32,16 16,32 0,16" fill="#0d0714"/>
            <polygon points="16,1.5 30.5,16 16,30.5 1.5,16" fill="${strikeRim}"/>
            <polygon points="16,3.5 28.5,16 16,28.5 3.5,16" fill="#4a0918"/>
            <polygon points="16,5 27,16 16,27 5,16" fill="${strikeBg}"/>
            <!-- Four Gold Corner Filigree Sparks -->
            <rect x="15" y="2" width="2" height="3" fill="#fff6cc"/>
            <rect x="15" y="27" width="2" height="3" fill="#fff6cc"/>
            <rect x="2" y="15" width="3" height="2" fill="#fff6cc"/>
            <rect x="27" y="15" width="3" height="2" fill="#fff6cc"/>
            <!-- Crisp Pixel Diagonal Glowing Blade -->
            <rect x="21" y="8" width="3" height="3" fill="#fff9e0"/>
            <rect x="19" y="10" width="3" height="3" fill="#fff9e0"/>
            <rect x="17" y="12" width="3" height="3" fill="#ffe699"/>
            <rect x="15" y="14" width="3" height="3" fill="#ffe699"/>
            <rect x="13" y="16" width="3" height="3" fill="#ffd966"/>
            <!-- Crossguard & Pommel -->
            <rect x="10" y="15" width="2" height="2" fill="#ffd966"/>
            <rect x="15" y="20" width="2" height="2" fill="#ffd966"/>
            <rect x="11" y="17" width="4" height="4" fill="#d48c1d"/>
            <rect x="9" y="21" width="3" height="3" fill="#5c2818"/>
            <rect x="8" y="22" width="2" height="2" fill="#ffd966"/>
          </svg>
          <span class="v15-crest-count crimson">${activeN}/3</span>
        </div>
        <div class="v15-crest-ribbon">
          <b>${fc.willDirectKill ? '斩杀' : '出击'}</b>
          ${activeN > 0 ? `<small>${pxIcon('atk')} ${fc.directDmg}</small>` : ''}
        </div>
      `;
    }

    applyInspectSpotlight(slotIdx) {
      const cards = document.querySelectorAll('#bt-cards-row .v14-card');
      const relics = document.querySelectorAll('#bt-relic-chain .v14-relic-chip');
      cards.forEach((c) => c.classList.remove('v15-dimmed', 'v15-related-glow'));
      relics.forEach((r) => r.classList.remove('v15-dimmed', 'v15-related-glow'));

      if (slotIdx < 0 || !this.battle || !this.battle.slots[slotIdx]) {
        if (this.battleStage.setInspectedSlot) this.battleStage.setInspectedSlot(-1, [], null);
        return;
      }

      const { arrows, meta } = this.buildUnitRelationArrows(slotIdx);
      if (this.battleStage.setInspectedSlot) this.battleStage.setInspectedSlot(slotIdx, arrows, meta);

      // Highlight related hand cards without dimming unrelated hand cards (prevents flicker on card switch!)
      cards.forEach((c) => {
        if (meta.handUids.has(c.dataset.uid)) c.classList.add('v15-related-glow');
      });
      relics.forEach((r) => {
        if (meta.relicUids.has(r.dataset.ruid)) r.classList.add('v15-related-glow');
        else r.classList.add('v15-dimmed');
      });
    }

    buildUnitRelationArrows(slotIdx) {
      const b = this.battle;
      const u = b && b.slots[slotIdx];
      const meta = { slots: new Set(), slotColors: {}, handUids: new Set(), relicUids: new Set(), boss: false, bossColor: null };
      if (!u) return { arrows: [], meta };
      const centers = [225, 405, 585];
      const ux = centers[slotIdx];
      // High overhead anchor (y = 266, well above character heads — NEVER cuts through sprites!)
      const headY = 266;
      const arrows = [];
      const cRect = $('battle-canvas').getBoundingClientRect();
      const toStage = (el) => {
        if (!el || !cRect.width || !cRect.height) return null;
        const r = el.getBoundingClientRect();
        return {
          x: ((r.left + r.width / 2) - cRect.left) * (1280 / cRect.width),
          y: ((r.top + r.height / 2) - cRect.top) * (720 / cRect.height)
        };
      };

      // 1. Direct Overhead Bridge Ally Synergies ONLY
      if ((u.retriggerLeft || u.inheritLeftRatio || u.devourLeftRatio) && slotIdx > 0 && b.slots[slotIdx - 1]) {
        const lbl = u.devourLeftRatio ? '吞噬继承' : u.inheritLeftRatio ? '继承+再动' : '复读再动';
        meta.slots.add(slotIdx - 1); meta.slotColors[slotIdx - 1] = '#ffe266';
        arrows.push({ fromSlot: slotIdx, toSlot: slotIdx - 1, fromOy: -146, toOy: -146, fromX: ux, fromY: headY, toX: centers[slotIdx - 1], toY: headY, color: '#ffe266', glowRgb: '255, 220, 96', label: lbl, arcLift: 58, nodes: 9 });
      }
      if (u.noAttackAmpRight && slotIdx < 2 && b.slots[slotIdx + 1]) {
        meta.slots.add(slotIdx + 1); meta.slotColors[slotIdx + 1] = '#ff9666';
        arrows.push({ fromSlot: slotIdx, toSlot: slotIdx + 1, fromOy: -146, toOy: -146, fromX: ux, fromY: headY, toX: centers[slotIdx + 1], toY: headY, color: '#ff9666', glowRgb: '255, 145, 92', label: `增伤 ×${u.noAttackAmpRight}`, arcLift: 58, nodes: 9 });
      }
      if (slotIdx < 2 && b.slots[slotIdx + 1] && (b.slots[slotIdx + 1].retriggerLeft || b.slots[slotIdx + 1].inheritLeftRatio)) {
        meta.slots.add(slotIdx + 1); meta.slotColors[slotIdx + 1] = '#ffe266';
        arrows.push({ fromSlot: slotIdx + 1, toSlot: slotIdx, fromOy: -146, toOy: -146, fromX: centers[slotIdx + 1], fromY: headY, toX: ux, toY: headY, color: '#ffe266', glowRgb: '255, 220, 96', label: '触发再动', arcLift: 58, nodes: 9 });
      }
      if (slotIdx > 0 && b.slots[slotIdx - 1] && b.slots[slotIdx - 1].noAttackAmpRight) {
        meta.slots.add(slotIdx - 1); meta.slotColors[slotIdx - 1] = '#ff9666';
        arrows.push({ fromSlot: slotIdx - 1, toSlot: slotIdx, fromOy: -146, toOy: -146, fromX: centers[slotIdx - 1], fromY: headY, toX: ux, toY: headY, color: '#ff9666', glowRgb: '255, 145, 92', label: `受增伤 ×${b.slots[slotIdx - 1].noAttackAmpRight}`, arcLift: 58, nodes: 9 });
      }
      if (u.followPrev) {
        for (let j = 0; j < slotIdx; j++) {
          if (b.slots[j]) {
            meta.slots.add(j); meta.slotColors[j] = '#7be8ff';
            arrows.push({ fromSlot: j, toSlot: slotIdx, fromOy: -146, toOy: -146, fromX: centers[j], fromY: headY, toX: ux, toY: headY, color: '#7be8ff', glowRgb: '110, 230, 255', label: '顺手补刀', arcLift: 54 + (slotIdx - j) * 14, nodes: 9 });
          }
        }
      }

      // 2. Direct Unslotted Hand Card Interactions
      const slottedUids = new Set(b.slots.filter(Boolean).map((h) => h.uid));
      const remHand = b.hand.filter((h) => !slottedUids.has(h.uid));
      if (u.multPerRemainingHand || u.handAtkBonus || u.triggerLeftmostHand) {
        const targets = u.triggerLeftmostHand ? remHand.slice(0, 1) : remHand.slice(0, 3);
        for (const hc of targets) {
          meta.handUids.add(hc.uid);
          const el = document.querySelector(`#bt-cards-row .v14-card[data-uid="${hc.uid}"]`);
          const pt = toStage(el);
          if (pt) {
            arrows.push({ fromSlot: slotIdx, fromOy: 6, fromX: ux, fromY: 422, toX: pt.x, toY: pt.y - 84, color: '#7ef28a', glowRgb: '126, 242, 138', label: u.triggerLeftmostHand ? '触发手牌' : '留手增伤', arcLift: 16, nodes: 7 });
          }
        }
      }
      for (const hc of remHand) {
        if (hc.inHandGrowPerStrike || hc.handCheerTeamAtk) {
          meta.handUids.add(hc.uid);
          const el = document.querySelector(`#bt-cards-row .v14-card[data-uid="${hc.uid}"]`);
          const pt = toStage(el);
          if (pt) {
            arrows.push({ fromSlot: slotIdx, fromOy: 6, fromX: ux, fromY: 422, toX: pt.x, toY: pt.y - 84, color: '#7be8ff', glowRgb: '110, 230, 255', label: '出手成长', arcLift: 14, nodes: 7 });
          }
        }
      }

      // 3. Direct Equipped Relics in Center-Top #bt-relic-chain (high overhead arch!)
      for (const r of this.run.relics) {
        let relLabel = '';
        if (r.id === 'r_slot1_repeat' && slotIdx === 0) relLabel = '1号再动';
        else if (r.id === 'r_slot3_mult' && slotIdx === 2) relLabel = '3号增伤';
        else if (r.theme === u.theme && u.theme !== 'core') relLabel = '主题联动';
        else if ((r.id === 'r_gold_atk' || r.id === 'r_spend_scale' || r.id === 'r_wave_scale') && u.atk > 0) relLabel = '秘宝加成';
        else if (r.id === 'r_retrig_scale' && (u.redSeal || u.retriggerLeft)) relLabel = '重触发增伤';
        else if (u.shieldVal > 0 && r.theme === 'shield') relLabel = '护盾联动';
        else if (u.applyPoison > 0 && r.theme === 'poison') relLabel = '剧毒联动';
        if (relLabel) {
          meta.relicUids.add(r.uid);
          const el = document.querySelector(`#bt-relic-chain .v14-relic-chip[data-ruid="${r.uid}"]`);
          const pt = toStage(el);
          if (pt) {
            arrows.push({ fromSlot: slotIdx, fromOy: -146, fromX: ux, fromY: headY, toX: pt.x, toY: pt.y + 48, color: '#d896ff', glowRgb: '216, 150, 255', label: relLabel, arcLift: 32, nodes: 8 });
          }
        }
      }

      // 4. Boss Target Arrow ONLY for Special Debuffs (Pure crisp text, ZERO emojis!)
      if (this.battleStage.boss && this.battleStage.boss.alive && (u.applyPoison > 0 || u.applyFrost > 0 || u.applyVuln)) {
        let bossLbl = '挂易伤 ×1.4';
        let bossCol = '#ff9666';
        let bossGlow = '255, 150, 102';
        if (u.applyPoison > 0) { bossLbl = `挂毒 +${u.applyPoison}`; bossCol = '#7ef28a'; bossGlow = '126, 242, 138'; }
        else if (u.applyFrost > 0) { bossLbl = `叠冰 +${u.applyFrost}`; bossCol = '#7be8ff'; bossGlow = '123, 232, 255'; }
        meta.boss = true;
        meta.bossColor = bossCol;
        arrows.push({ fromSlot: slotIdx, fromOy: -146, fromX: ux, fromY: headY, toX: 935, toY: 222, color: bossCol, glowRgb: bossGlow, label: bossLbl, arcLift: 68 });
      }

      return { arrows, meta };
    }

    pulseRelicChip(uid, label) {
      const el = document.querySelector(`.v14-relic-chip[data-ruid="${uid}"]`);
      if (!el) return;
      el.classList.add('pulse');
      const sub = el.querySelector('.v14-relic-chip-sub');
      if (sub && label) sub.textContent = label;
      setTimeout(() => el.classList.remove('pulse'), 360);
    }

    formatRelicLiveStat(r) {
      if (r.id === 'r_spend_scale') return `当前 +${r.state.bonusAtk || 0} 攻`;
      if (r.id === 'r_retrig_scale') return `当前 ×${(1 + (r.state.bonusMult || 0)).toFixed(2)}`;
      if (r.id === 'r_wave_scale') return `当前 ×${(1 + (r.state.bonusMult || 0.25)).toFixed(2)}`;
      if (r.id === 'r_disc_scale') return `当前 +${r.state.bonusAtk || 0} 攻`;
      if (r.id === 'r_shd_scale') return `当前 +${r.state.bonusAtk || 0} 攻`;
      if (r.id === 'r_poi_scale') return `单层毒 +${r.state.poisonPerStackBonus || 0}`;
      return r.short;
    }

    // =========================================================================
    // BEAT 2: MIDNIGHT TAVERN INTERIOR BLACK-MARKET SHOP (v15.2)
    // =========================================================================
    openShop() {
      this.battleStage.stop();
      if (this.heroMusterStage) this.heroMusterStage.stop();
      if (this.titleRain && this.titleRain.stop) this.titleRain.stop();
      if (this.altarBg && this.altarBg.stop) this.altarBg.stop();
      if (this.tavernShopStage) {
        this.tavernShopStage.setState({ wave: this.run.wave, roster: this.run.roster });
        this.tavernShopStage.start();
      } else if (this.altarBg && this.altarBg.start) {
        this.altarBg.start();
      }
      this.run.phase = 'shop';
      this.meta.saveActiveRun(this.run);
      $('battle-view').classList.add('hidden');
      $('deck-select-modal').classList.add('hidden');
      $('tavern-view').classList.remove('hidden');
      $('top-hud').classList.remove('hidden');
      $('market-main-stage').classList.remove('hidden');
      this.selectedRelicUid = null;
      this.closeShopInspector();

      const asc = this.meta.getAscension(this.run.ascension || 0);
      this.shop = { rerollCost: asc.rerollCost || 3, relicOffers: [], packSold: {} };
      this.rollShopOffers(false);
      this.renderShop();
    }

    rollShopOffers(guaranteeHigh = false) {
      const ownedIds = new Set(this.run.relics.map((r) => r.id));
      const pool = D.getActiveRelics(this.run.activeThemes);
      let picked = [];
      if (guaranteeHigh) {
        const highAvail = pool.filter((r) => !ownedIds.has(r.id) && (r.tier === 'S' || r.tier === 'SSS'));
        if (highAvail.length > 0) {
          const first = highAvail[Math.floor(Math.random() * highAvail.length)];
          picked.push(first);
          ownedIds.add(first.id);
        }
      }
      const rest = D.weightedPick(pool, 3 - picked.length, ownedIds);
      picked = [...picked, ...rest];
      this.shop.relicOffers = picked.map((tpl) => ({ tpl, sold: false }));
    }

    rerollShop() {
      if (this.run.gold < this.shop.rerollCost) {
        this.toast(`金币不足（需 ${this.shop.rerollCost}G）`);
        return;
      }
      this.closeShopInspector();
      this.spendGold(this.shop.rerollCost);
      this.rollShopOffers(false);
      this.audio.playPickup();
      if (this.tavernShopStage) this.tavernShopStage.triggerCelebrate('#ffd966');
      this.renderShop();
    }

    handleShopAdReroll() {
      if (this.run.adShopRerollLeft <= 0) {
        this.toast('本局免费必出 S/SSS 刷新次数已用完');
        return;
      }
      this.closeShopInspector();
      this.playRewardedAd('免费刷新货架 · 必出 1 件 S/SSS 秘宝', () => {
        this.run.adShopRerollLeft -= 1;
        this.rollShopOffers(true);
        if (this.tavernShopStage) this.tavernShopStage.triggerCelebrate('#ff9ee8');
        this.toast('已刷新货架（含保底 S/SSS 秘宝）！');
        this.renderShop();
      });
    }

    spendGold(amount) {
      this.run.gold -= amount;
      const notes = E.onShopSpend(this.run.relics, this.run.roster, amount);
      if (notes.length > 0) this.toast(`✦ ${notes.join(' · ')}`);
    }

    buyRelicOffer(idx) {
      const offer = this.shop.relicOffers[idx];
      if (!offer || offer.sold) return;
      if (this.run.relics.length >= this.run.maxRelicSlots) {
        this.toast(`秘宝栏已满 (${this.run.maxRelicSlots}件)，可先点击顶部秘宝出售`);
        return;
      }
      if (this.run.gold < offer.tpl.cost) {
        this.toast(`金币不足（需 ${offer.tpl.cost}G）`);
        return;
      }
      this.closeShopInspector();
      this.spendGold(offer.tpl.cost);
      this.run.relics.push(D.makeRelicInstance(offer.tpl));
      offer.sold = true;
      this.audio.playPickup();
      if (this.tavernShopStage) this.tavernShopStage.triggerCelebrate('#ffd966');
      this.renderShop();
    }

    upgradeSlot(slotId) {
      const u = D.SLOT_UPGRADES.find((x) => x.id === slotId);
      if (!u) return;
      if (this.run.gold < u.cost) {
        this.toast(`金币不足（需 ${u.cost}G）`);
        return;
      }
      this.closeShopInspector();
      this.spendGold(u.cost);
      this.run.slotLevels[slotId] = (this.run.slotLevels[slotId] || 1) + 1;
      this.audio.playPickup();
      if (this.tavernShopStage) this.tavernShopStage.triggerCelebrate(u.color || '#ffd966');
      this.toast(`${u.name} 升至 Lv.${this.run.slotLevels[slotId]}！`);
      this.renderShop();
    }

    getPackCost(pack) {
      if (pack.id === 'pack_inscription' && this.run.hero.inscriptionDiscount) {
        return Math.max(1, pack.cost - this.run.hero.inscriptionDiscount);
      }
      return pack.cost;
    }

    openPack(packId, isAdReroll = false) {
      const pack = D.PACKS.find((p) => p.id === packId);
      if (!pack) return;
      if (!isAdReroll) {
        if (this.shop.packSold[packId]) return;
        const cost = this.getPackCost(pack);
        if (this.run.gold < cost) {
          this.toast(`金币不足（需 ${cost}G）`);
          return;
        }
        this.closeShopInspector();
        this.spendGold(cost);
        this.shop.packSold[packId] = true;
        this.audio.playCoin ? this.audio.playCoin() : this.audio.playPickup();
        if (this.tavernShopStage) this.tavernShopStage.triggerCelebrate(pack.accent || '#6be5ff');
      }

      // Roll contents immediately so the ceremony can preview jackpot intensity & deal seamlessly
      if (packId === 'pack_hero') {
        const heroPool = D.getActiveShopHeroes(this.run.activeThemes);
        const picks = D.weightedPick(heroPool, 4);
        const inscripRate = this.run.hero.bonusHeroInscripRate || 0.24;
        const instances = picks.map((tpl) => {
          const ov = {};
          if (Math.random() < inscripRate) {
            const roll = Math.random();
            if (roll < 0.34) ov.redSeal = true;
            else if (roll < 0.67) ov.greedBadge = true;
            else ov.ironPlated = true;
          }
          return D.makeHeroInstance(tpl, ov);
        });
        this.activePackState = { type: 'hero', packId, pack, instances, torn: false };
      } else {
        const picks = shuffle(D.INSCRIPTIONS).slice(0, 3);
        this.activePackState = { type: 'inscription', packId, pack, picks, chosenInscription: null, torn: false };
      }

      const modal = $('pack-ceremony-modal');
      modal.classList.remove('hidden', 'ceremony-shake');
      $('pack-target-stage').classList.add('hidden');
      $('pack-ceremony-title').textContent = pack.name;
      $('pack-ceremony-sub').textContent = pack.desc;

      const adBtn = $('btn-pack-ad-reroll');
      adBtn.disabled = this.run.adPackRerollLeft <= 0;
      adBtn.textContent = this.run.adPackRerollLeft > 0 ? `▶ 看广告重抽本包 (${this.run.adPackRerollLeft}/1)` : '重抽次数已用完';

      this.renderShop();

      if (isAdReroll) {
        // Re-roll skips waiting on the sealed pack and immediately erupts into fresh cards
        $('pack-sealed-stage').classList.add('hidden');
        $('pack-reveal-stage').classList.remove('hidden');
        if (this.packCeremonyFX) this.packCeremonyFX.triggerTearBurst(packId);
        if (this.audio.playSackBurst) this.audio.playSackBurst();
        this._renderPackRevealCards();
        return;
      }

      // Phase 1: Interactive Sealed Foil Booster Sachet / Arcane Rune Coffer Ceremony
      $('pack-reveal-stage').classList.add('hidden');
      $('pack-sealed-stage').classList.remove('hidden');
      const footer = modal.querySelector('.pack-footer');
      if (footer) footer.classList.add('is-sealed');

      if (this.packCeremonyFX) this.packCeremonyFX.startCharging(packId);
      if (this.audio.playStampCharge) this.audio.playStampCharge();

      const env = $('pack-foil-envelope');
      const isHeroPack = packId === 'pack_hero';
      const hasJackpot = isHeroPack
        ? this.activePackState.instances.some((h) => h.tier === 'S' || h.tier === 'SSS')
        : this.activePackState.picks.some((ins) => ins.id === 'm_clone' || ins.id === 'm_red_seal');

      env.className = `v152-ceremony-pack ${isHeroPack ? 'hero-foil' : 'rune-coffer'} ${hasJackpot ? 'has-jackpot' : ''}`;
      env.innerHTML = isHeroPack ? `
        <div class="v152-cp-cap">
          <div class="v152-foil-crimp top"></div>
          <div class="v152-cp-cap-band"><span>${pack.count}选1 · 稀客招募</span></div>
        </div>
        <div class="v152-cp-seam" aria-hidden="true"></div>
        <div class="v152-cp-body">
          <div class="v152-foil-sheen" aria-hidden="true"></div>
          <div class="v152-cp-halo" aria-hidden="true"></div>
          <div class="v152-cp-vfx-fan" aria-hidden="true">
            <span class="cp-card left"></span>
            <span class="cp-card right"></span>
            <span class="cp-card center"><i>✦</i></span>
          </div>
          <div class="v152-cp-titles">
            <div class="v152-cp-name">${esc(pack.name)}</div>
            <div class="v152-cp-sub">${esc(pack.subtitle)}</div>
          </div>
          <div class="v152-cp-prompt">✦ 轻触或划开封口 ✦</div>
          <div class="v152-foil-crimp bottom"></div>
        </div>
      ` : `
        <div class="v152-cp-cap coffer-lid">
          <div class="v152-cp-cap-band"><span>${pack.count}选1 · 秘传铭文</span></div>
          <div class="v152-cp-wax-latch" aria-hidden="true">封</div>
        </div>
        <div class="v152-cp-seam arcane" aria-hidden="true"></div>
        <div class="v152-cp-body coffer-body">
          <div class="v152-foil-sheen arcane" aria-hidden="true"></div>
          <div class="v152-cp-halo arcane" aria-hidden="true"></div>
          <div class="v152-cp-vfx-sigil" aria-hidden="true">
            <span class="cp-ring outer"></span>
            <span class="cp-ring inner"></span>
            <span class="cp-core-gem"></span>
          </div>
          <div class="v152-cp-titles">
            <div class="v152-cp-name">${esc(pack.name)}</div>
            <div class="v152-cp-sub">${esc(pack.subtitle)}</div>
          </div>
          <div class="v152-cp-prompt">✦ 轻触启封铭文匣 ✦</div>
        </div>
      `;

      let swipeStartX = null;
      const doTear = () => {
        if (!this.activePackState || this.activePackState.torn) return;
        this.activePackState.torn = true;
        env.classList.add('tearing');
        modal.classList.remove('ceremony-shake');
        void modal.offsetWidth;
        modal.classList.add('ceremony-shake');

        if (this.packCeremonyFX) this.packCeremonyFX.triggerTearBurst(packId);
        if (this.audio.playSlash) this.audio.playSlash();
        setTimeout(() => {
          if (this.audio.playSackBurst) this.audio.playSackBurst();
        }, 90);

        setTimeout(() => {
          if (!this.activePackState) return;
          $('pack-sealed-stage').classList.add('hidden');
          $('pack-reveal-stage').classList.remove('hidden');
          if (footer) footer.classList.remove('is-sealed');
          this._renderPackRevealCards();
        }, 440);
      };

      env.onclick = () => doTear();
      env.onpointerdown = (e) => { swipeStartX = e.clientX; };
      env.onpointermove = (e) => {
        if (swipeStartX !== null && Math.abs(e.clientX - swipeStartX) > 36) {
          swipeStartX = null;
          doTear();
        }
      };
      env.onpointerup = () => { swipeStartX = null; };
    }

    _renderPackRevealCards() {
      const st = this.activePackState;
      if (!st) return;
      const modal = $('pack-ceremony-modal');
      const grid = $('pack-cards-grid');

      if (st.type === 'hero') {
        const instances = st.instances;
        grid.className = 'v14-modal-choices';
        grid.innerHTML = instances.map((h, i) => {
          const th = D.THEMES[h.theme] || D.THEMES.core;
          return `
            <div class="v14-shop-card v15-shop-3d v152-deal-card tier-border-${h.tier} ${h.tier === 'S' || h.tier === 'SSS' ? 'v15-idle-tilt v15-gentle-tilt' : ''}" data-pidx="${i}" style="--deal-delay:${i * 105}ms">
              ${renderCardTierOrnament(h.tier, 72, 92)}
              <div class="v14-shop-card-head">
                <span class="v14-tier tier-${h.tier}">${h.tier}</span>
                <span class="v14-theme-pill" style="background:${th.bg};color:${th.color}">${th.short}</span>
                <span style="color:#ffd966;font-weight:900;font-size:15px;display:inline-flex;align-items:center;gap:2px;">${pxIcon('atk')}${h.atk}</span>
              </div>
              <div class="v14-pack-sprite-stage" data-unit="${h.unitId}"></div>
              <div class="v14-shop-card-name" style="text-align:center">${esc(h.name)} ${h.isBridge ? '<span class="v14-bridge-tag">接口</span>' : ''}</div>
              <div class="v14-shop-card-desc">${esc(h.desc)}</div>
              <div class="v14-card-badges">
                ${h.redSeal ? `<span class="v14-inscrip-pill">自带·双连印</span>` : ''}
                ${h.greedBadge ? `<span class="v14-inscrip-pill greed">自带·贪财徽</span>` : ''}
                ${h.ironPlated ? `<span class="v14-inscrip-pill iron">自带·铁壁甲</span>` : ''}
              </div>
            </div>
          `;
        }).join('');
        grid.querySelectorAll('.v14-pack-sprite-stage').forEach((sp) => {
          if (this.sprites && this.sprites.createDomSprite) {
            sp.appendChild(this.sprites.createDomSprite(sp.dataset.unit, 'idle', 74));
          }
        });
        grid.querySelectorAll('[data-pidx]').forEach((el) => {
          this.bindInteractive3DTilt(el, 12, 10, !el.classList.contains('v15-idle-tilt'));
          el.onclick = () => {
            const chosen = instances[Number(el.dataset.pidx)];
            this.run.roster.push(chosen);
            this.activePackState = null;
            if (this.packCeremonyFX) this.packCeremonyFX.stop();
            modal.classList.add('hidden');
            if (this.audio.playSynergy) this.audio.playSynergy();
            if (this.tavernShopStage) this.tavernShopStage.triggerCelebrate('#7ef28a');
            this.toast(`已招募【${chosen.name}】加入牌组！`);
            this.renderShop();
          };
        });

        if (this.packCeremonyFX) {
          this.packCeremonyFX.startReveal(instances.map((h) => ({ tier: h.tier })));
        }
        instances.forEach((h, i) => {
          setTimeout(() => {
            if (!this.activePackState) return;
            if (h.tier === 'SSS' && this.audio.playCrit) this.audio.playCrit();
            else if (h.tier === 'S' && this.audio.playSynergy) this.audio.playSynergy();
            else if (this.audio.playChainDing) this.audio.playChainDing(i, false);
          }, i * 105 + 60);
        });
        this.startCardFxLoop();
      } else {
        const picks = st.picks;
        grid.className = 'v14-modal-choices cols-3';
        const insTier = (ins) => (ins.id === 'm_clone' ? 'SSS' : (ins.id === 'm_red_seal' || ins.id === 'm_glass' ? 'S' : 'A'));
        grid.innerHTML = picks.map((ins, i) => {
          const t = insTier(ins);
          return `
            <div class="v14-shop-card v15-shop-3d v152-deal-card tier-border-${t}" data-pidx="${i}" style="--deal-delay:${i * 115}ms;align-items:center;text-align:center;padding:18px 16px;">
              ${renderCardTierOrnament(t, 64, 72)}
              <div class="v152-ins-float-stage">
                ${this.renderSafeIconImg(ins.icon, 'pack_inscription', 'v152-ins-float-icon')}
              </div>
              <div class="v14-shop-card-name" style="color:${ins.color};font-size:15.5px;">${esc(ins.name)}</div>
              <div class="v14-shop-card-desc">${esc(ins.desc)}</div>
            </div>
          `;
        }).join('');
        grid.querySelectorAll('[data-pidx]').forEach((el) => {
          this.bindInteractive3DTilt(el, 12, 10, true);
          el.onclick = () => this.selectInscriptionTarget(picks[Number(el.dataset.pidx)]);
        });
        if (this.packCeremonyFX) {
          this.packCeremonyFX.startReveal(picks.map((ins) => ({ tier: insTier(ins) })));
        }
        picks.forEach((ins, i) => {
          setTimeout(() => {
            if (!this.activePackState) return;
            if (this.audio.playChainDing) this.audio.playChainDing(i, insTier(ins) !== 'A');
          }, i * 115 + 60);
        });
        this.startCardFxLoop();
      }
    }

    handlePackAdReroll() {
      if (!this.activePackState || this.run.adPackRerollLeft <= 0) return;
      const pid = this.activePackState.packId;
      this.playRewardedAd('免费重抽当前卡包', () => {
        this.run.adPackRerollLeft -= 1;
        this.openPack(pid, true);
      });
    }

    selectInscriptionTarget(ins) {
      if (ins.minRoster && this.run.roster.length <= ins.minRoster) {
        this.toast(`牌组至少需保留 ${ins.minRoster} 名侠客，无法驱逐`);
        return;
      }
      this.activePackState.chosenInscription = ins;
      $('pack-reveal-stage').classList.add('hidden');
      $('pack-target-stage').classList.remove('hidden');
      $('pack-target-title').textContent = `选择目标侠客施加【${ins.name}】`;

      const tGrid = $('pack-target-grid');
      tGrid.className = 'v14-modal-choices';
      tGrid.innerHTML = this.run.roster.map((h, i) => `
        <div class="v14-shop-card" data-hidx="${i}">
          <div class="v14-shop-card-head">
            <span class="v14-tier tier-${h.tier}">${h.tier}</span>
            <span style="color:#ffd966;font-weight:900">⚔${h.atk}</span>
          </div>
          <div class="v14-shop-card-name">${esc(h.name)}</div>
          <div class="v14-shop-card-desc">${esc(h.desc)}</div>
        </div>
      `).join('');

      tGrid.querySelectorAll('[data-hidx]').forEach((el) => {
        el.onclick = () => {
          const idx = Number(el.dataset.hidx);
          const h = this.run.roster[idx];
          if (ins.id === 'm_red_seal') h.redSeal = true;
          else if (ins.id === 'm_glass') h.glassBlade = true;
          else if (ins.id === 'm_greed') h.greedBadge = true;
          else if (ins.id === 'm_iron') h.ironPlated = true;
          else if (ins.id === 'm_clone') this.run.roster.push(D.cloneHeroInstance(h));
          else if (ins.id === 'm_banish') this.run.roster.splice(idx, 1);

          this.activePackState = null;
          if (this.packCeremonyFX) this.packCeremonyFX.stop();
          $('pack-ceremony-modal').classList.add('hidden');
          if (this.audio.playWaxSlam) this.audio.playWaxSlam();
          if (this.tavernShopStage) this.tavernShopStage.triggerCelebrate(ins.color || '#ffd966');
          this.toast(`已对【${h.name}】施加 ${ins.name}！`);
          this.renderShop();
        };
      });
    }

    _slotEmblemSvg(slotId) {
      if (slotId === 'slot1') {
        // Vanguard Shield + Spear
        return `<svg class="v152-slot-emblem" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
          <rect x="3" y="2" width="10" height="8" fill="#18324c"/>
          <rect x="4" y="3" width="8" height="6" fill="#68b6ff"/>
          <rect x="5" y="10" width="6" height="2" fill="#68b6ff"/>
          <rect x="7" y="12" width="2" height="2" fill="#4d94e0"/>
          <rect x="5" y="4" width="2" height="4" fill="#d8f2ff"/>
          <rect x="7" y="4" width="2" height="6" fill="#ffd966"/>
        </svg>`;
      }
      if (slotId === 'slot2') {
        // Midguard Crossed Blade
        return `<svg class="v152-slot-emblem" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
          <rect x="11" y="2" width="3" height="3" fill="#fff5cc"/>
          <rect x="9" y="4" width="3" height="3" fill="#ffd966"/>
          <rect x="7" y="6" width="3" height="3" fill="#f0b636"/>
          <rect x="5" y="8" width="3" height="3" fill="#d48c1d"/>
          <rect x="3" y="9" width="5" height="2" fill="#9c590c"/>
          <rect x="2" y="11" width="3" height="3" fill="#6e3610"/>
        </svg>`;
      }
      if (slotId === 'slot3') {
        // Finisher Crimson Crown / Flame
        return `<svg class="v152-slot-emblem" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
          <rect x="7" y="1" width="2" height="3" fill="#ffd966"/>
          <rect x="5" y="4" width="6" height="4" fill="#ff7b6b"/>
          <rect x="3" y="7" width="10" height="5" fill="#d93b48"/>
          <rect x="6" y="7" width="4" height="4" fill="#fff0b8"/>
          <rect x="4" y="12" width="8" height="2" fill="#8c1d2c"/>
        </svg>`;
      }
      // Hand Reserve Lantern Scroll
      return `<svg class="v152-slot-emblem" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
        <rect x="3" y="2" width="10" height="12" fill="#1e4429"/>
        <rect x="4" y="3" width="8" height="10" fill="#5bd674"/>
        <rect x="5" y="4" width="6" height="2" fill="#d8ffe0"/>
        <rect x="5" y="7" width="6" height="2" fill="#235730"/>
        <rect x="5" y="10" width="4" height="2" fill="#235730"/>
      </svg>`;
    }

    _bossPatternChip(code, roundIdx) {
      const map = {
        heavy:  { label: '重击', cls: 'heavy' },
        charge: { label: '蓄力', cls: 'charge' },
        shield: { label: '魔盾', cls: 'shield' },
        thorns: { label: '荆棘', cls: 'thorns' },
        lock3:  { label: '封位', cls: 'lock' }
      };
      const info = map[code] || { label: '重击', cls: 'heavy' };
      return `<span class="v152-pat-chip ${info.cls}"><b>R${roundIdx + 1}</b>${info.label}</span>`;
    }

    _slotLevelPreview(u, curLv) {
      const nextLv = curLv + 1;
      const curBonus = curLv - 1;
      const nextBonus = nextLv - 1;
      if (u.id === 'slot1') {
        return `当前 Lv.${curLv}（+${curBonus * 15}攻 / +${curBonus * 12}盾） → 升至 Lv.${nextLv}（+${nextBonus * 15}攻 / +${nextBonus * 12}盾）`;
      }
      if (u.id === 'slot2') {
        return `当前 Lv.${curLv}（+${curBonus * 28}攻） → 升至 Lv.${nextLv}（+${nextBonus * 28}攻）`;
      }
      if (u.id === 'slot3') {
        return `当前 Lv.${curLv}（+${(curBonus * 0.25).toFixed(2)}×） → 升至 Lv.${nextLv}（+${(nextBonus * 0.25).toFixed(2)}×）`;
      }
      return `当前 Lv.${curLv}（留手 +${curBonus * 6}永久攻） → 升至 Lv.${nextLv}（留手 +${nextBonus * 6}永久攻）`;
    }

    closeShopInspector() {
      this.inspectedShopKey = null;
      const pop = $('shop-detail-popover');
      if (pop) {
        pop.classList.add('hidden');
        pop.innerHTML = '';
      }
      document.querySelectorAll('#market-main-stage .is-inspected').forEach((el) => {
        el.classList.remove('is-inspected');
      });
    }

    inspectShopItem(key, anchorEl, spec) {
      // Tap #2 on the same selected card: fast-confirm if allowed
      if (this.inspectedShopKey === key) {
        if (spec.canConfirm) {
          spec.onConfirm();
        } else {
          this.toast(spec.disabledReason || '当前无法购买');
        }
        return;
      }

      // Close top relic strip so only one inspector is active at a time
      if (this.selectedRelicUid) {
        this.selectedRelicUid = null;
        const insp = $('relic-inspect-bar');
        if (insp) insp.classList.add('hidden');
        document.querySelectorAll('#top-relic-rack .pulse').forEach((el) => el.classList.remove('pulse'));
      }

      this.inspectedShopKey = key;
      document.querySelectorAll('#market-main-stage .is-inspected').forEach((el) => {
        el.classList.remove('is-inspected');
      });
      if (anchorEl) anchorEl.classList.add('is-inspected');

      const pop = $('shop-detail-popover');
      if (!pop) return;

      pop.innerHTML = `
        <div class="sdp-head">
          <div class="sdp-icon-wrap">${spec.iconHtml}</div>
          <div class="sdp-head-text">
            <div class="sdp-badges">${spec.badgesHtml}</div>
            <div class="sdp-title">${esc(spec.title)}</div>
          </div>
          <div class="sdp-price-badge">${pxIcon('gold')}${spec.cost}G</div>
        </div>
        <div class="sdp-desc">${esc(spec.desc)}</div>
        ${spec.extraHtml ? `<div class="sdp-extra">${spec.extraHtml}</div>` : ''}
        <div class="sdp-actions">
          <button type="button" class="sdp-btn-cancel" id="sdp-btn-cancel">取消</button>
          <button type="button" class="sdp-btn-confirm ${spec.canConfirm ? '' : 'disabled'}" id="sdp-btn-confirm" ${spec.canConfirm ? '' : 'aria-disabled="true"'}>
            ${spec.canConfirm ? `${esc(spec.confirmLabel)} · ${spec.cost}G` : esc(spec.disabledReason)}
          </button>
        </div>
      `;

      pop.classList.remove('hidden');

      // Smart positioning inside the 1280x720 #stage coordinate space
      const stageRect = this.stage.getBoundingClientRect();
      const anchorRect = anchorEl.getBoundingClientRect();
      const scaleX = 1280 / Math.max(1, stageRect.width);
      const scaleY = 720 / Math.max(1, stageRect.height);

      const aLeft = (anchorRect.left - stageRect.left) * scaleX;
      const aRight = (anchorRect.right - stageRect.left) * scaleX;
      const aTop = (anchorRect.top - stageRect.top) * scaleY;
      const aCenterY = aTop + (anchorRect.height * scaleY) / 2;

      const popW = pop.offsetWidth || 356;
      const popH = pop.offsetHeight || 200;

      // Prefer placing neatly to the left of the shelf item so the card itself stays unobstructed
      let left = aLeft - popW - 14;
      if (left < 18) {
        left = aRight + 14;
      }
      if (left + popW > 1262) {
        left = Math.max(18, Math.min(1262 - popW, aLeft - popW * 0.35));
      }
      let top = Math.round(aCenterY - popH / 2);
      top = Math.max(70, Math.min(704 - popH, top));

      pop.style.left = `${Math.round(left)}px`;
      pop.style.top = `${Math.round(top)}px`;

      $('sdp-btn-cancel').onclick = (e) => {
        e.stopPropagation();
        this.closeShopInspector();
      };
      $('sdp-btn-confirm').onclick = (e) => {
        e.stopPropagation();
        if (spec.canConfirm) {
          spec.onConfirm();
        } else {
          this.toast(spec.disabledReason || '当前无法购买');
        }
      };
    }

    renderShop() {
      this.closeShopInspector();

      // 1. Top Walnut & Brass Ledger Beam (fixes duplicate gold icon!)
      $('hud-wave').textContent = `W${this.run.wave}/${this.run.maxWaves}`;
      $('hud-gold').textContent = `${this.run.gold}G`;
      $('hud-hearts').innerHTML = `
        <span class="v152-hud-hero">${esc(this.run.hero.name)}</span>
        <span class="v152-hud-sep">·</span>
        <span class="v152-hud-orbs">${pxIcon('orb')}${this.meta.data.orbs}</span>
      `;

      // 2. Real Visual 5/6-Slot Brass Relic Rack (Ⅰ ~ Ⅴ/Ⅵ)
      const romans = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
      const maxSlots = this.run.maxRelicSlots || 5;
      const rack = $('top-relic-rack');
      const slotHtml = [];
      for (let i = 0; i < maxSlots; i++) {
        const r = this.run.relics[i];
        if (r) {
          const isSel = this.selectedRelicUid === r.uid;
          slotHtml.push(`
            <button type="button" class="v152-rack-slot filled tier-${r.tier || 'A'} ${isSel ? 'pulse' : ''}" data-ridx="${i}" title="${esc(r.name)}">
              ${this.renderSafeIconImg(r.icon, r.theme || 'core', 'v152-rack-icon')}
              <span class="v152-rack-stat">${esc(this.formatRelicLiveStat(r) || r.short || r.tier)}</span>
            </button>
          `);
        } else {
          slotHtml.push(`
            <div class="v152-rack-slot empty" aria-label="空秘宝槽 ${romans[i] || i + 1}">
              <span class="v152-rack-roman">${romans[i] || (i + 1)}</span>
            </div>
          `);
        }
      }
      rack.innerHTML = `<span class="v152-rack-lbl">秘宝<br>${this.run.relics.length}/${maxSlots}</span><div class="v152-rack-slots">${slotHtml.join('<span class="v152-rack-arrow">›</span>')}</div>`;

      rack.querySelectorAll('[data-ridx]').forEach((el) => {
        el.onclick = (e) => {
          e.stopPropagation();
          this.closeShopInspector();
          const r = this.run.relics[Number(el.dataset.ridx)];
          this.selectedRelicUid = this.selectedRelicUid === r.uid ? null : r.uid;
          this.renderShop();
        };
      });

      const insp = $('relic-inspect-bar');
      const selIdx = this.run.relics.findIndex((r) => r.uid === this.selectedRelicUid);
      if (selIdx >= 0) {
        const r = this.run.relics[selIdx];
        const sellVal = Math.max(2, Math.floor(r.cost / 2));
        insp.classList.remove('hidden');
        insp.innerHTML = `
          <div class="v14-relic-order-bar">
            <b style="color:#ffd966;white-space:nowrap">${esc(r.name)}</b>
            <span class="v14-inspect-desc">${esc(r.desc)}</span>
            ${selIdx > 0 ? `<button class="steel-btn hud-mini-btn" id="btn-r-left">←左移</button>` : ''}
            ${selIdx < this.run.relics.length - 1 ? `<button class="steel-btn hud-mini-btn" id="btn-r-right">右移→</button>` : ''}
            <button class="steel-btn crimson hud-mini-btn" id="btn-r-sell">出售 +${sellVal}G</button>
            <button class="steel-btn hud-mini-btn" id="btn-r-close" title="关闭">✕</button>
          </div>
        `;
        if ($('btn-r-left')) $('btn-r-left').onclick = () => {
          [this.run.relics[selIdx - 1], this.run.relics[selIdx]] = [this.run.relics[selIdx], this.run.relics[selIdx - 1]];
          this.renderShop();
        };
        if ($('btn-r-right')) $('btn-r-right').onclick = () => {
          [this.run.relics[selIdx + 1], this.run.relics[selIdx]] = [this.run.relics[selIdx], this.run.relics[selIdx + 1]];
          this.renderShop();
        };
        $('btn-r-sell').onclick = () => {
          this.run.relics.splice(selIdx, 1);
          this.run.gold += sellVal;
          this.selectedRelicUid = null;
          if (this.tavernShopStage) this.tavernShopStage.triggerCelebrate('#ffd966');
          this.toast(`出售秘宝 +${sellVal}G`);
          this.renderShop();
        };
        if ($('btn-r-close')) $('btn-r-close').onclick = () => {
          this.selectedRelicUid = null;
          this.renderShop();
        };
      } else {
        insp.classList.add('hidden');
      }

      // 3. Left Top: 4-Rank Escalating Live Boss Wanted Warrant + Crimson Wax Seal CTA
      const nextBoss = D.getWaveBoss(this.run.wave);
      const asc = this.meta.getAscension(this.run.ascension || 0);
      const nextBossHp = Math.round(nextBoss.maxHp * asc.hpMult);
      const nextBossBreak = Math.round(nextBoss.breakThreshold * asc.hpMult);
      const nextBossHeavy = Math.round(nextBoss.heavyDmg * asc.dmgMult);
      const nextBossUlt = Math.round(nextBoss.ultDmg * asc.dmgMult);
      const bountyGold = Math.max(1, nextBoss.reward + (this.run.hero.rewardDelta || 0));
      const patHtml = (nextBoss.pattern || ['heavy', 'charge', 'heavy', 'heavy'])
        .slice(0, 4)
        .map((code, i) => this._bossPatternChip(code, i))
        .join('');

      // Boss Threat Tier & Elemental Aura Profile (W1-2 Elite / W3-4 Blood Rival / W5-6 Calamity Overlord / W7-8 Eclipse Sovereign)
      let bossTier = this.run.wave >= 7 ? 4 : this.run.wave >= 5 ? 3 : this.run.wave >= 3 ? 2 : 1;
      if (asc.lv >= 3 && bossTier < 4) bossTier += 1;
      const bossRankLabels = { 1: '精英悬赏', 2: '猩红大敌', 3: '灾厄霸主', 4: '终末魔王' };
      const bossStars = '★'.repeat(bossTier);
      let bossAura = 'ember';
      if (bossTier === 4) bossAura = 'eclipse';
      else if (bossTier === 3) bossAura = nextBoss.id === 'b_boreal' ? 'frost' : 'inferno';
      else if (bossTier === 2) bossAura = 'blood';

      const bountyEl = $('boss-bounty-panel');
      bountyEl.className = `v152-boss-monolith boss-tier-${bossTier} aura-${bossAura}`;
      bountyEl.style.transform = '';
      bountyEl.innerHTML = `
        ${bossTier >= 3 ? `<div class="v152-monolith-crest" aria-hidden="true">${bossTier === 4 ? '♛' : '❖'}</div>` : ''}
        <div class="v152-boss-stage-wrap" title="点击激怒 Boss 预览气场">
          <canvas class="v152-boss-fx-canvas" id="shop-boss-fx-canvas" width="362" height="188"></canvas>
          <div class="v152-boss-top-hud">
            <span class="v152-boss-rank-line tier-${bossTier}">
              <i class="v152-rank-stars">${bossStars}</i>
              <span>${bossRankLabels[bossTier]}</span>
              <span class="v152-rank-sep">·</span>
              <span class="v152-bounty-wave">W${this.run.wave}${asc.lv > 0 ? ` 阶${asc.lv}` : ''}</span>
            </span>
            <span class="v152-bounty-hp-readout">${nextBossHp.toLocaleString()} <small>HP</small></span>
          </div>
          <div class="v152-boss-name-scrim">
            <span class="v152-boss-name">${esc(nextBoss.name)}</span>
            <span class="v152-boss-title">${esc(nextBoss.title || '镜湖强敌')}</span>
          </div>
        </div>
        <div class="v152-boss-tactical-bar">
          <div class="v152-boss-pattern">${patHtml}</div>
          <div class="v152-boss-metrics">
            <span>破招 <b>≥${nextBossBreak}</b></span>
            <span class="v152-m-dot">·</span>
            <span>重击 <b>${nextBossHeavy}</b> / 大招 <b>${nextBossUlt}</b></span>
            <span class="v152-m-dot">·</span>
            <span class="v152-m-gold">赏金 <b>+${bountyGold}G</b></span>
          </div>
        </div>
      `;
      const bossFxCanvas = $('shop-boss-fx-canvas');
      if (this.tavernShopStage && bossFxCanvas) {
        this.tavernShopStage.attachBossCanvas(bossFxCanvas, {
          tier: bossTier,
          aura: bossAura,
          unitId: nextBoss.unitId
        });
      }
      bountyEl.onclick = () => {
        if (this.tavernShopStage) this.tavernShopStage.triggerBossRoar();
        if (this.audio && this.audio.playSlash) this.audio.playSlash();
      };

      $('btn-shop-next').innerHTML = `
        <span class="v152-wax-disc" aria-hidden="true">战</span>
        <span class="v152-cta-text">迎战 W${this.run.wave} · ${esc(nextBoss.name)}</span>
        <span class="v152-cta-arrow" aria-hidden="true">→</span>
      `;

      // 4. Left Bottom: Sync Live Resting Squad to Tavern Floor Canvas + Minimal Ledger Strip
      if (this.tavernShopStage) {
        this.tavernShopStage.setState({ wave: this.run.wave, roster: this.run.roster });
      }
      const themeCounts = {};
      for (const h of this.run.roster) {
        const k = h.theme || 'core';
        themeCounts[k] = (themeCounts[k] || 0) + 1;
      }
      const themeSummary = Object.entries(themeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, cnt]) => {
          const th = D.THEMES[k] || D.THEMES.core;
          return `<span class="v152-sq-th" style="color:${th.color}">${th.short}${cnt}</span>`;
        }).join('');
      $('squad-ledger-strip').innerHTML = `
        <span class="v152-sq-count">战团 <b>${this.run.roster.length}</b> 人</span>
        <span class="v152-sq-themes">${themeSummary}</span>
        <span class="v152-sq-link">名册 →</span>
      `;
      $('squad-roam-zone').innerHTML = `
        <div class="v152-roam-hint">${this.run.roster.length > 10 ? `地板展示前 10 位 / 共 ${this.run.roster.length} 人` : '点击休整区管理牌组'}</div>
      `;

      // 5. Right Top Shelf Controls
      const adRerollBtn = $('btn-shop-ad-reroll');
      adRerollBtn.disabled = this.run.adShopRerollLeft <= 0;
      adRerollBtn.innerHTML = this.run.adShopRerollLeft > 0 ? `${pxIcon('play')} 免费必出S刷新` : '保底刷新已用';
      $('btn-shop-reroll').innerHTML = `<span class="v152-reroll-lbl">刷新</span><span class="v152-reroll-cost">${pxIcon('gold')}${this.shop.rerollCost}G</span>`;

      // 6. Right Upper Shelf: 3 Full-Art Illustrated Collectible Relic Cards (ZERO Box-in-Box!)
      const rRow = $('shop-relics-row');
      rRow.className = 'v152-relics-row';
      rRow.innerHTML = this.shop.relicOffers.map((o, idx) => {
        const thKey = o.tpl.theme || 'core';
        const th = D.THEMES[thKey] || D.THEMES.core;
        const canAfford = this.run.gold >= o.tpl.cost;
        let srcStatus = '';
        if (o.tpl.requiresSource) {
          const cnt = E.countThemeSources(this.run.roster, this.run.hero, o.tpl.requiresSource);
          srcStatus = `<span class="v152-src-line ${cnt === 0 ? 'warn' : 'ok'}">${cnt === 0 ? '缺启动源' : `启动源 ${cnt}张`}</span>`;
        }
        return `
          <button type="button" class="v152-relic-card v15-shop-3d theme-${thKey} tier-${o.tpl.tier} ${o.sold ? 'sold' : ''} ${!o.sold && !canAfford ? 'unaffordable' : ''}" data-buyr="${idx}" data-shop-inspect="relic:${idx}" style="--rc-accent:${th.color}" ${o.sold ? 'disabled' : ''}>
            ${renderCardTierOrnament(o.tpl.tier, 76, 118)}
            <div class="v152-rc-art-layer" aria-hidden="true">
              <div class="v152-rc-rays"></div>
              <div class="v152-rc-filigree"></div>
              ${this.renderSafeIconImg(o.tpl.icon, thKey, 'v152-rc-art-img')}
              <div class="v152-rc-vignette"></div>
            </div>
            <div class="v152-rc-top-meta">
              <span class="v152-rc-tier-emblem tier-${o.tpl.tier}">${o.tpl.tier}</span>
              <span class="v152-rc-theme-line" style="color:${th.color}">
                ${th.short}${o.tpl.isBridge ? '<i class="v152-rc-bridge-dot">·</i><b class="v152-rc-bridge-txt">接口</b>' : ''}
              </span>
            </div>
            <div class="v152-rc-bottom-scrim">
              <div class="v152-rc-name">${esc(o.tpl.name)}</div>
              <div class="v152-rc-perk">${esc(o.tpl.short || o.tpl.desc)}</div>
              ${srcStatus ? `<div class="v152-rc-meta">${srcStatus}</div>` : ''}
              <div class="v152-rc-price-strip ${o.sold ? 'sold' : canAfford ? 'ready' : 'short'}">
                ${o.sold ? '已购入' : `${pxIcon('gold')}<span>${o.tpl.cost}G</span>`}
              </div>
            </div>
          </button>
        `;
      }).join('');

      rRow.querySelectorAll('[data-buyr]').forEach((el) => {
        if (!el.classList.contains('sold')) {
          this.bindInteractive3DTilt(el, 8, 7, true);
        }
        el.onclick = (e) => {
          e.stopPropagation();
          const idx = Number(el.dataset.buyr);
          const offer = this.shop.relicOffers[idx];
          if (!offer || offer.sold) return;
          const th = D.THEMES[offer.tpl.theme] || D.THEMES.core;
          const rackFull = this.run.relics.length >= this.run.maxRelicSlots;
          const afford = this.run.gold >= offer.tpl.cost;
          let extraHtml = '';
          if (offer.tpl.requiresSource) {
            const cnt = E.countThemeSources(this.run.roster, this.run.hero, offer.tpl.requiresSource);
            extraHtml += `<div class="sdp-note ${cnt === 0 ? 'warn' : 'ok'}">当前牌组启动源：<b>${cnt} 张</b>${cnt === 0 ? '（建议同时招募对应流派侠客）' : '（已就绪，购入即可生效）'}</div>`;
          }
          if (rackFull) {
            extraHtml += `<div class="sdp-note warn">秘宝架已满（${this.run.relics.length}/${this.run.maxRelicSlots}），可先点击顶部已装秘宝出售腾位。</div>`;
          }
          this.inspectShopItem(`relic:${idx}`, el, {
            iconHtml: this.renderSafeIconImg(offer.tpl.icon, offer.tpl.theme || 'core', 'sdp-icon-img'),
            badgesHtml: `<span class="v14-tier tier-${offer.tpl.tier}">${offer.tpl.tier}</span><span class="v152-theme-chip" style="color:${th.color};border-color:${th.color}66;background:${th.bg}">${th.short}</span>${offer.tpl.isBridge ? '<span class="v152-bridge-chip">跨流派接口</span>' : ''}`,
            title: offer.tpl.name,
            cost: offer.tpl.cost,
            desc: offer.tpl.desc,
            extraHtml,
            canConfirm: !rackFull && afford,
            confirmLabel: '确认购入',
            disabledReason: rackFull ? `秘宝栏已满 (${this.run.relics.length}/${this.run.maxRelicSlots})` : `金币不足 · 需 ${offer.tpl.cost}G`,
            onConfirm: () => this.buyRelicOffer(idx)
          });
        };
      });

      // 7. Right Lower Shelf: Pure-VFX Foil Booster Sachet + Pure-VFX Arcane Rune Coffer + 4 Forged Slot Plaques
      const lower = $('shop-packs-row');
      lower.className = 'v152-lower-shop';
      lower.innerHTML = `
        <div class="v152-packs-col">
          ${D.PACKS.map((p) => {
            const c = this.getPackCost(p);
            const sold = Boolean(this.shop.packSold[p.id]);
            const canAfford = this.run.gold >= c;
            const isHeroPack = p.id === 'pack_hero';
            if (isHeroPack) {
              return `
                <button type="button" class="v152-pack-card hero-pack ${sold ? 'sold' : ''} ${!sold && !canAfford ? 'unaffordable' : ''}" data-pack="${p.id}" data-shop-inspect="pack:${p.id}" ${sold ? 'disabled' : ''}>
                  <div class="v152-foil-crimp top" aria-hidden="true"></div>
                  <div class="v152-pack-body">
                    <div class="v152-foil-sheen" aria-hidden="true"></div>
                    <div class="v152-foil-tearline" aria-hidden="true"><span>${p.count}选1</span></div>
                    <div class="v152-pack-vfx-stage">
                      <canvas class="v152-pack-fx-canvas" id="shop-pack-hero-fx" width="184" height="136"></canvas>
                    </div>
                    <div class="v152-pack-foot">
                      <div class="v152-pack-name" style="color:${p.accent}">${esc(p.name)}</div>
                      <div class="v152-pack-sub">${esc(p.subtitle)}</div>
                      <div class="v152-price-bar ${sold ? 'sold' : canAfford ? 'ready' : 'short'}">
                        ${sold ? '已撕开' : `${pxIcon('gold')}<span>${c}G 撕开</span>`}
                      </div>
                    </div>
                  </div>
                  <div class="v152-foil-crimp bottom" aria-hidden="true"></div>
                </button>
              `;
            }
            return `
              <button type="button" class="v152-pack-card inscrip-pack ${sold ? 'sold' : ''} ${!sold && !canAfford ? 'unaffordable' : ''}" data-pack="${p.id}" data-shop-inspect="pack:${p.id}" ${sold ? 'disabled' : ''}>
                <div class="v152-coffer-lid" aria-hidden="true">
                  <span class="v152-coffer-tag">${p.count}选1</span>
                  <span class="v152-coffer-clasp">封</span>
                </div>
                <div class="v152-coffer-body">
                  <div class="v152-foil-sheen arcane" aria-hidden="true"></div>
                  <div class="v152-pack-vfx-stage">
                    <canvas class="v152-pack-fx-canvas" id="shop-pack-inscrip-fx" width="184" height="136"></canvas>
                  </div>
                  <div class="v152-pack-foot">
                    <div class="v152-pack-name" style="color:${p.accent}">${esc(p.name)}</div>
                    <div class="v152-pack-sub">${esc(p.subtitle)}</div>
                    <div class="v152-price-bar ${sold ? 'sold' : canAfford ? 'ready' : 'short'}">
                      ${sold ? '已启封' : `${pxIcon('gold')}<span>${c}G 启封</span>`}
                    </div>
                  </div>
                </div>
              </button>
            `;
          }).join('')}
        </div>
        <div class="v152-slots-col">
          ${D.SLOT_UPGRADES.map((u) => {
            const lv = this.run.slotLevels[u.id] || 1;
            const canAfford = this.run.gold >= u.cost;
            return `
              <button type="button" class="v152-slot-plaque slot-${u.id} ${canAfford ? '' : 'unaffordable'}" data-upgs="${u.id}" data-shop-inspect="slot:${u.id}" style="--slot-col:${u.color}">
                <div class="v152-slot-head">
                  <div class="v152-slot-id">
                    ${this._slotEmblemSvg(u.id)}
                    <span class="v152-slot-name">${esc(u.name)}</span>
                  </div>
                  <span class="v152-slot-lv">Lv.${lv}</span>
                </div>
                <div class="v152-slot-body">
                  <span class="v152-slot-perk">${esc(u.short)}</span>
                  <span class="v152-slot-cost ${canAfford ? 'ready' : 'short'}">${pxIcon('gold')}${u.cost}G</span>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      `;

      if (this.tavernShopStage && this.tavernShopStage.attachPackCanvases) {
        this.tavernShopStage.attachPackCanvases({
          heroCanvas: $('shop-pack-hero-fx'),
          inscripCanvas: $('shop-pack-inscrip-fx')
        });
      }

      lower.querySelectorAll('[data-pack]').forEach((el) => {
        el.onclick = (e) => {
          e.stopPropagation();
          const p = D.PACKS.find((x) => x.id === el.dataset.pack);
          if (!p || this.shop.packSold[p.id]) return;
          const cost = this.getPackCost(p);
          const afford = this.run.gold >= cost;
          const isHeroPack = p.id === 'pack_hero';
          const extraHtml = isHeroPack
            ? `<div class="sdp-note ok">当前可抽取主题池：<b>${this.run.activeThemes.map((k) => (D.THEMES[k] && D.THEMES[k].short) || k).join(' / ')}</b></div>`
            : `<div class="sdp-note ok">${this.run.hero.inscriptionDiscount ? `已享英雄铭文折减（原价 ${p.cost}G → ${cost}G）` : '开启后先 3 选 1 铭文，再指定 1 名战团侠客施加。'}</div>`;
          const vfxMiniHtml = isHeroPack
            ? `<div class="sdp-vfx-badge hero-fan" aria-hidden="true"><span>✦</span></div>`
            : `<div class="sdp-vfx-badge coffer-seal" aria-hidden="true"><span>封</span></div>`;
          this.inspectShopItem(`pack:${p.id}`, el, {
            iconHtml: vfxMiniHtml,
            badgesHtml: `<span class="v152-theme-chip" style="color:${p.accent};border-color:${p.accent}66;background:rgba(16,14,24,0.85)">${p.subtitle}</span>`,
            title: p.name,
            cost,
            desc: p.desc,
            extraHtml,
            canConfirm: afford,
            confirmLabel: isHeroPack ? '确认撕开' : '确认启封',
            disabledReason: `金币不足 · 需 ${cost}G`,
            onConfirm: () => this.openPack(p.id, false)
          });
        };
      });

      this.startCardFxLoop();

      lower.querySelectorAll('[data-upgs]').forEach((el) => {
        el.onclick = (e) => {
          e.stopPropagation();
          const u = D.SLOT_UPGRADES.find((x) => x.id === el.dataset.upgs);
          if (!u) return;
          const lv = this.run.slotLevels[u.id] || 1;
          const afford = this.run.gold >= u.cost;
          this.inspectShopItem(`slot:${u.id}`, el, {
            iconHtml: this._slotEmblemSvg(u.id),
            badgesHtml: `<span class="v152-theme-chip" style="color:${u.color};border-color:${u.color}66;background:rgba(16,12,10,0.85)">战位锻造 · Lv.${lv} → Lv.${lv + 1}</span>`,
            title: u.name,
            cost: u.cost,
            desc: u.desc,
            extraHtml: `<div class="sdp-note ok">${esc(this._slotLevelPreview(u, lv))}</div>`,
            canConfirm: afford,
            confirmLabel: '确认强化',
            disabledReason: `金币不足 · 需 ${u.cost}G`,
            onConfirm: () => this.upgradeSlot(u.id)
          });
        };
      });
    }

    startNextWaveBattle() {
      this.startWaveBattle(this.run.wave);
    }

    openLeaderboardModal() {
      const showLocal = (list) => {
        $('roster-modal').classList.remove('hidden');
        $('rm-tab-roster').classList.remove('active');
        $('rm-tab-hands').classList.remove('active');
        const ready = this.tap && this.tap.getStatusSummary().boardReady;
        $('rm-summary').textContent = ready
          ? 'TapTap 排行榜（计分：通关波次×10000 + 单手最高直伤）'
          : '本机战绩排行（非 TapTap 宿主降级展示 · 计分：波次×10000 + 单手最高直伤）';
        $('rm-body').innerHTML = list.length === 0
          ? `<div style="padding:20px;color:#aeb7cf;">暂无战绩记录，完成一局后自动计入。</div>`
          : list.map((item, idx) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin:6px 0;border-radius:8px;background:rgba(22,16,32,0.9);border:1px solid #594b70;color:#fff6dc;">
                <div><b>#${idx + 1}</b> ${esc(item.heroName)} · 过 <b>${item.kills}</b> 波 · 峰值 <b>${item.peakHit}</b> <small style="color:#9da8c4">(${esc(item.themes || '')})</small></div>
                <b style="color:#ffd966">${item.score} 分</b>
              </div>
            `).join('');
      };
      if (this.tap) {
        this.tap.openLeaderboard(showLocal);
      } else {
        showLocal([]);
      }
    }

    openAchievementsModal() {
      $('roster-modal').classList.remove('hidden');
      $('rm-tab-roster').classList.remove('active');
      $('rm-tab-hands').classList.remove('active');
      const unlocked = new Set(this.meta.data.unlockedAchievements || []);
      const list = T ? T.ACHIEVEMENTS : [];
      $('rm-summary').textContent = `成就进度：${unlocked.size} / ${list.length}（解锁即赠一次性宝珠碎片，自动同步存档）`;
      $('rm-body').innerHTML = `<div class="v14-modal-choices">${list.map((a) => {
        const done = unlocked.has(a.id);
        return `
          <div class="v14-shop-card" style="border-color:${done ? '#7ef28a' : '#454d66'};opacity:${done ? 1 : 0.72}">
            <div class="v14-shop-card-head">
              <b style="color:${done ? '#7ef28a' : '#ffd966'}">${done ? '✓ 已解锁' : '未解锁'}</b>
              <span style="color:#6be5ff;font-weight:900">+${a.shards} 碎片</span>
            </div>
            <div class="v14-shop-card-name">${esc(a.name)}</div>
            <div class="v14-shop-card-desc">${esc(a.desc)}</div>
          </div>
        `;
      }).join('')}</div>`;
    }

    openCodexModal(tab = 'roster') {
      $('roster-modal').classList.remove('hidden');
      this.renderCodexModal(tab);
    }

    renderCodexModal(tab) {
      $('rm-tab-roster').classList.toggle('active', tab === 'roster');
      $('rm-tab-hands').classList.toggle('active', tab === 'codex');
      const body = $('rm-body');
      const sum = $('rm-summary');

      if (tab === 'roster' && this.run) {
        sum.textContent = `当前牌组共 ${this.run.roster.length} 名侠客 · 英雄：${this.run.hero.name} · 战位：1号Lv.${this.run.slotLevels.slot1} / 2号Lv.${this.run.slotLevels.slot2} / 3号Lv.${this.run.slotLevels.slot3} / 手牌Lv.${this.run.slotLevels.hand}`;
        body.innerHTML = `<div class="v14-modal-choices">${this.run.roster.map((h) => {
          const th = D.THEMES[h.theme] || D.THEMES.core;
          return `<div class="v14-shop-card">
            <div class="v14-shop-card-head">
              <span class="v14-tier tier-${h.tier}">${h.tier}</span>
              <span class="v14-theme-pill" style="background:${th.bg};color:${th.color}">${th.short}</span>
              <b style="color:${h.atk > h.baseAtk ? '#7ef28a' : '#ffd966'}">⚔${h.atk}</b>
            </div>
            <div class="v14-shop-card-name">${esc(h.name)}</div>
            <div class="v14-shop-card-desc">${esc(h.desc)}</div>
          </div>`;
        }).join('')}</div>`;
      } else {
        sum.textContent = `v14.1 单局卡池（51张）：常驻通用 + 换桌 + 盾反 + 剧毒`;
        body.innerHTML = `
          <h4 style="color:#ffd966;margin:6px 0">商店稀客 (18名)</h4>
          <div class="v14-modal-choices">${D.SHOP_HEROES.map((h) => {
            const th = D.THEMES[h.theme];
            return `<div class="v14-shop-card">
              <div class="v14-shop-card-head">
                <span class="v14-tier tier-${h.tier}">${h.tier}</span>
                <span class="v14-theme-pill" style="background:${th.bg};color:${th.color}">${th.short}</span>
                <span>⚔${h.atk}</span>
              </div>
              <div class="v14-shop-card-name">${esc(h.name)} ${h.isBridge ? '<span class="v14-bridge-tag">接口</span>' : ''}</div>
              <div class="v14-shop-card-desc">${esc(h.desc)}</div>
            </div>`;
          }).join('')}</div>
          <h4 style="color:#6be5ff;margin:14px 0 6px">商店秘宝 (27件)</h4>
          <div class="v14-modal-choices">${D.RELICS.map((r) => {
            const th = D.THEMES[r.theme];
            return `<div class="v14-shop-card">
              <div class="v14-shop-card-head">
                <span class="v14-tier tier-${r.tier}">${r.tier}</span>
                <span class="v14-theme-pill" style="background:${th.bg};color:${th.color}">${th.short}</span>
                <span>${r.cost}G</span>
              </div>
              <div class="v14-shop-card-name">${esc(r.name)} ${r.isBridge ? '<span class="v14-bridge-tag">接口</span>' : ''}</div>
              <div class="v14-shop-card-desc">${esc(r.desc)}</div>
            </div>`;
          }).join('')}</div>
        `;
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (document.fonts && document.fonts.load) {
      document.fonts.load('12px "FusionPixel"').catch(() => {});
      document.fonts.load('24px "FusionPixel"').catch(() => {});
    }
    window.MT.app = new V14App();
  });
})();
