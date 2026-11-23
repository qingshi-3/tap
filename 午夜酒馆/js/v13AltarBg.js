// v13.2 Full-Screen Candlelit Walnut Tavern Tabletop + Unified Recessed Emerald Baize Mat + Free-Roaming Squad Heroes
// Renders the entire continuous physical tabletop surface (1280x720) with unified top-left lantern lighting,
// inlaid brass astrolabe felt, subtle tabletop storytelling props, and live animated Duelyst squad sprites roaming freely.
(function () {
  window.MT = window.MT || {};

  const W = 1280, H = 720, VW = 320, VH = 180;
  // Spacious lower-left open walnut promenade bounds (keeps tall heads cleanly below the squad strip!)
  const ROAM_BOUNDS = { minX: 48, maxX: 432, minY: 572, maxY: 686 };

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

      this.roamers = [];
      this.hoveredUid = null;
      this.shakeTime = 0;
      this.shakeAmp = 0;

      this.embers = Array.from({ length: 24 }, (_, i) => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 9,
        vy: -5 - Math.random() * 9,
        size: i % 4 === 0 ? 4 : 3,
        phase: Math.random() * 6.28,
        bright: i % 3 === 0
      }));
    }

    bakeStatic() {
      const c = document.createElement('canvas');
      c.width = VW; c.height = VH;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // 1. Rich Warm Dark-Walnut Horizontal Planks (9 planks x 20px)
      const plankColors = [
        '#2c1b12', '#332015', '#27170f', '#362217',
        '#2d1c13', '#382317', '#291910', '#311e14', '#24150e'
      ];
      const plankH = 20;

      for (let p = 0; p < Math.ceil(VH / plankH); p++) {
        const y0 = p * plankH;
        ctx.fillStyle = plankColors[p % plankColors.length];
        ctx.fillRect(0, y0, VW, plankH);

        // Warm top bevel catching overhead candle lantern light
        ctx.fillStyle = 'rgba(224, 166, 98, 0.12)';
        ctx.fillRect(0, y0 + 1, VW, 1);

        // Organic wood grain fibers
        for (let g = 0; g < 18; g++) {
          const seed = (p + 1) * 101 + g * 37;
          const gx = (seed * 19) % (VW - 18);
          const gy = y0 + 3 + (seed % (plankH - 6));
          const gw = 16 + (seed % 38);
          ctx.fillStyle = g % 2 === 0 ? 'rgba(18, 9, 5, 0.28)' : 'rgba(196, 134, 72, 0.11)';
          ctx.fillRect(gx, gy, gw, 1);
        }

        // Subtle wood knot detail
        const knotX = ((p * 67 + 29) % (VW - 44)) + 18;
        const knotY = y0 + 6 + (p % 3) * 3;
        ctx.fillStyle = 'rgba(20, 10, 5, 0.36)';
        ctx.fillRect(knotX, knotY, 7, 3);
        ctx.fillStyle = 'rgba(168, 108, 56, 0.14)';
        ctx.fillRect(knotX + 1, knotY + 1, 4, 1);

        // Staggered plank vertical butt seam + brass nail studs
        const jointX = (p * 107 + 52) % (VW - 40) + 20;
        ctx.fillStyle = '#150b07';
        ctx.fillRect(jointX, y0, 1, plankH);
        ctx.fillStyle = 'rgba(220, 162, 92, 0.09)';
        ctx.fillRect(jointX + 1, y0 + 1, 1, plankH - 2);

        for (const ny of [y0 + 4, y0 + plankH - 5]) {
          for (const nx of [jointX - 3, jointX + 3]) {
            ctx.fillStyle = '#140a06';
            ctx.fillRect(nx, ny, 2, 2);
            ctx.fillStyle = '#a87d3e';
            ctx.fillRect(nx, ny, 1, 1);
          }
        }

        // Deep plank groove seam
        ctx.fillStyle = '#140a06';
        ctx.fillRect(0, y0 + plankH - 1, VW, 1);
      }

      // 2. Subtle Coaster Ring & Brass Compass Marks on Lower-Left Open Squad Promenade Wood
      ctx.strokeStyle = 'rgba(18, 9, 5, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(96, 152, 16, 0, Math.PI * 2);
      ctx.stroke();

      // Subtle engraved brass corner flourishes framing the wide open squad promenade floor
      ctx.fillStyle = 'rgba(204, 158, 82, 0.24)';
      ctx.fillRect(10, 114, 8, 1); ctx.fillRect(10, 114, 1, 8);
      ctx.fillRect(106, 114, 8, 1); ctx.fillRect(113, 114, 1, 8);
      ctx.fillRect(10, 174, 8, 1); ctx.fillRect(10, 167, 1, 8);
      ctx.fillRect(106, 174, 8, 1); ctx.fillRect(113, 167, 1, 8);

      // 3. SLEEK RECESSED EMERALD-MOSS BAIZE TABLETOP MAT (Right Market Zone: x 120..313, y 22..175 => 480..1252, 88..700)
      const mx = 120, my = 22, mw = 193, mh = 153;

      // Carved outer wood bevel catching candlelight around the recessed felt
      ctx.fillStyle = '#120905';
      ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
      ctx.fillStyle = 'rgba(218, 168, 94, 0.34)';
      ctx.fillRect(mx - 2, my + mh + 2, mw + 4, 1);
      ctx.fillRect(mx + mw + 2, my - 2, 1, mh + 5);

      // Rich deep-forest baize felt gradient
      const feltGrad = ctx.createRadialGradient(mx + mw * 0.46, my + mh * 0.42, 16, mx + mw * 0.5, my + mh * 0.5, 138);
      feltGrad.addColorStop(0, '#1f362c');
      feltGrad.addColorStop(0.62, '#162821');
      feltGrad.addColorStop(1, '#0e1b16');
      ctx.fillStyle = feltGrad;
      ctx.fillRect(mx, my, mw, mh);

      // Subtle woven felt stipple grain (deterministic pixel weave)
      for (let fy = my + 2; fy < my + mh - 2; fy += 3) {
        for (let fx = mx + 2; fx < mx + mw - 2; fx += 4) {
          const h = ((fx * 37 + fy * 73) & 15);
          if (h === 0) {
            ctx.fillStyle = 'rgba(255, 232, 176, 0.035)';
            ctx.fillRect(fx, fy, 1, 1);
          } else if (h === 7) {
            ctx.fillStyle = 'rgba(4, 10, 8, 0.16)';
            ctx.fillRect(fx, fy, 1, 1);
          }
        }
      }

      // Inner recessed shadow along top & left of felt mat
      ctx.fillStyle = 'rgba(4, 9, 7, 0.55)';
      ctx.fillRect(mx, my, mw, 2);
      ctx.fillRect(mx, my, 2, mh);

      // Double Gilded Stitched Brass Trim inside the Baize Mat
      ctx.strokeStyle = 'rgba(214, 170, 92, 0.34)';
      ctx.lineWidth = 1;
      ctx.strokeRect(mx + 3.5, my + 3.5, mw - 7, mh - 7);

      // Subtle dashed stitch inner line
      ctx.fillStyle = 'rgba(232, 192, 114, 0.22)';
      for (let sx = mx + 7; sx < mx + mw - 7; sx += 4) {
        ctx.fillRect(sx, my + 6, 2, 1);
        ctx.fillRect(sx, my + mh - 7, 2, 1);
      }
      for (let sy = my + 7; sy < my + mh - 7; sy += 4) {
        ctx.fillRect(mx + 6, sy, 1, 2);
        ctx.fillRect(mx + mw - 7, sy, 1, 2);
      }

      // Four Corner Burnished Brass Rivets on the Baize Mat
      const rivets = [
        [mx + 5, my + 5], [mx + mw - 7, my + 5],
        [mx + 5, my + mh - 7], [mx + mw - 7, my + mh - 7]
      ];
      for (const [rx, ry] of rivets) {
        ctx.fillStyle = '#120a05';
        ctx.fillRect(rx, ry, 2, 2);
        ctx.fillStyle = '#d9ae5e';
        ctx.fillRect(rx, ry, 1, 1);
      }

      // Faint Gold-Inlaid Astrolabe Compass Watermark in Center of Baize Mat
      const cx = mx + Math.round(mw * 0.5), cy = my + Math.round(mh * 0.52);
      ctx.strokeStyle = 'rgba(222, 178, 96, 0.10)';
      ctx.lineWidth = 1;
      for (const r of [24, 42, 62]) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
        ctx.lineTo(cx + Math.cos(a) * 62, cy + Math.sin(a) * 62);
        ctx.stroke();
      }

      // Engraved Brass Horizontal Divider Hairline between Upper Relic Shelf & Lower Packs/Tome (y = 100 => 400px)
      const divY = 100;
      ctx.fillStyle = 'rgba(218, 172, 92, 0.24)';
      ctx.fillRect(mx + 12, divY, mw - 24, 1);
      // Tiny brass diamond center ornament on divider
      ctx.fillStyle = '#d4a656';
      ctx.fillRect(cx - 1, divY - 1, 3, 3);
      ctx.fillStyle = '#1a2e25';
      ctx.fillRect(cx, divY, 1, 1);

      // 4. Resting Ambient Props: Scattered Gold Coins on walnut rim
      const coins = [[14, 108], [19, 110], [112, 164]];
      for (const [gx, gy] of coins) {
        ctx.fillStyle = '#120904';
        ctx.fillRect(gx, gy + 1, 4, 2);
        ctx.fillStyle = '#c48d2c';
        ctx.fillRect(gx, gy, 3, 2);
        ctx.fillStyle = '#ffe594';
        ctx.fillRect(gx, gy, 2, 1);
      }

      // Outer Tabletop Edge Vignette (gentle, keeps wood & felt clearly readable!)
      const vig = ctx.createRadialGradient(VW * 0.48, VH * 0.46, 72, VW * 0.5, VH * 0.5, 206);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(0.75, 'rgba(10, 5, 2, 0.18)');
      vig.addColorStop(1, 'rgba(5, 2, 1, 0.56)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, VW, VH);

      // Outer brass corner table guards
      ctx.fillStyle = 'rgba(206, 158, 80, 0.36)';
      ctx.fillRect(2, 14, 9, 1); ctx.fillRect(2, 14, 1, 9);
      ctx.fillRect(VW - 11, 14, 9, 1); ctx.fillRect(VW - 3, 14, 1, 9);
      ctx.fillRect(2, VH - 3, 9, 1); ctx.fillRect(2, VH - 11, 1, 9);
      ctx.fillRect(VW - 11, VH - 3, 9, 1); ctx.fillRect(VW - 3, VH - 11, 1, 9);

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
        this.updateRoamers(dt);
        this.render(dt);
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    }

    stop() {
      this.running = false;
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    }

    shake(amp = 6, dur = 0.2) {
      this.shakeAmp = Math.max(this.shakeAmp, amp);
      this.shakeTime = Math.max(this.shakeTime, dur);
    }

    syncMercenaries(mercs = []) {
      const existingById = new Map(this.roamers.map((r) => [r.uid, r]));
      const next = [];
      const count = Math.max(1, mercs.length);
      mercs.forEach((m, i) => {
        const prev = existingById.get(m.id);
        if (prev) {
          Object.assign(prev, {
            unitId: m.unitId,
            name: m.name,
            atk: m.power,
            factionName: m.factionName || '',
            factionColor: m.factionColor || '#ffd966',
            roleName: m.roleName || '',
            roleColor: m.roleColor || '#d6c3a5',
            redSeal: Boolean(m.redSeal),
            ironPlated: Boolean(m.ironPlated)
          });
          next.push(prev);
        } else {
          // Distribute initial positions organically across the open walnut promenade
          const cols = Math.min(4, count);
          const col = i % cols;
          const row = Math.floor(i / cols);
          const spanX = ROAM_BOUNDS.maxX - ROAM_BOUNDS.minX;
          const spanY = ROAM_BOUNDS.maxY - ROAM_BOUNDS.minY;
          const baseX = ROAM_BOUNDS.minX + ((col + 0.5) / cols) * spanX + (Math.random() - 0.5) * 28;
          const baseY = ROAM_BOUNDS.minY + ((row + 0.45) / Math.max(2, Math.ceil(count / cols))) * spanY + (Math.random() - 0.5) * 16;
          const x = Math.max(ROAM_BOUNDS.minX, Math.min(ROAM_BOUNDS.maxX, baseX));
          const y = Math.max(ROAM_BOUNDS.minY, Math.min(ROAM_BOUNDS.maxY, baseY));
          next.push({
            uid: m.id,
            unitId: m.unitId,
            name: m.name,
            atk: m.power,
            factionName: m.factionName || '',
            factionColor: m.factionColor || '#ffd966',
            roleName: m.roleName || '',
            roleColor: m.roleColor || '#d6c3a5',
            redSeal: Boolean(m.redSeal),
            ironPlated: Boolean(m.ironPlated),
            x, y,
            tx: x, ty: y,
            flipX: Math.random() < 0.5,
            mode: Math.random() < 0.45 ? 'walk' : 'idle',
            timer: 0.6 + Math.random() * 2.8,
            speed: 24 + Math.random() * 14,
            walkPhase: Math.random() * Math.PI * 2,
            animOffset: Math.random() * 4.0
          });
        }
      });
      this.roamers = next;
    }

    setHoveredHero(uid) {
      this.hoveredUid = uid || null;
    }

    pickHeroAt(stageX, stageY) {
      // Search front-to-back (highest Y first) for accurate overlapping sprite selection
      const sorted = [...this.roamers].sort((a, b) => b.y - a.y);
      for (const h of sorted) {
        const dx = stageX - h.x;
        const dy = stageY - (h.y - 36);
        if (Math.abs(dx) <= 34 && Math.abs(dy) <= 44) {
          return h;
        }
      }
      return null;
    }

    updateRoamers(dt) {
      if (this.shakeTime > 0) {
        this.shakeTime = Math.max(0, this.shakeTime - dt);
        if (this.shakeTime <= 0) this.shakeAmp = 0;
      }

      for (let i = 0; i < this.roamers.length; i++) {
        const h = this.roamers[i];
        // Pause smoothly when player hovers to inspect this hero
        if (this.hoveredUid && h.uid === this.hoveredUid) {
          continue;
        }

        // Gentle continuous separation even when idle so heroes spread across the floor instead of clumping
        let sepX = 0, sepY = 0;
        for (let j = 0; j < this.roamers.length; j++) {
          if (i === j) continue;
          const o = this.roamers[j];
          const sx = h.x - o.x;
          const sy = (h.y - o.y) * 1.45;
          const sd = Math.hypot(sx, sy);
          if (sd > 0.1 && sd < 74) {
            const push = (74 - sd) * 1.15;
            sepX += (sx / sd) * push;
            sepY += (sy / sd) * push * 0.65;
          } else if (sd <= 0.1) {
            sepX += (i % 2 === 0 ? 18 : -18);
            sepY += (i % 3 === 0 ? 10 : -10);
          }
        }

        h.timer -= dt;
        if (h.mode === 'idle') {
          if (Math.abs(sepX) > 2 || Math.abs(sepY) > 2) {
            h.x = Math.max(ROAM_BOUNDS.minX, Math.min(ROAM_BOUNDS.maxX, h.x + sepX * 0.45 * dt));
            h.y = Math.max(ROAM_BOUNDS.minY, Math.min(ROAM_BOUNDS.maxY, h.y + sepY * 0.45 * dt));
          }
          if (h.timer <= 0) {
            // Choose a fresh pleasant stroll destination inside the open walnut promenade
            h.tx = ROAM_BOUNDS.minX + Math.random() * (ROAM_BOUNDS.maxX - ROAM_BOUNDS.minX);
            h.ty = ROAM_BOUNDS.minY + Math.random() * (ROAM_BOUNDS.maxY - ROAM_BOUNDS.minY);
            h.mode = 'walk';
            h.timer = 3.0 + Math.random() * 2.8;
          }
        } else {
          const dx = h.tx - h.x;
          const dy = h.ty - h.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 8 || h.timer <= 0) {
            h.mode = 'idle';
            h.timer = 1.8 + Math.random() * 3.0;
          } else {
            const vx = (dx / dist) * h.speed + sepX;
            const vy = (dy / dist) * h.speed * 0.68 + sepY;

            h.x = Math.max(ROAM_BOUNDS.minX, Math.min(ROAM_BOUNDS.maxX, h.x + vx * dt));
            h.y = Math.max(ROAM_BOUNDS.minY, Math.min(ROAM_BOUNDS.maxY, h.y + vy * dt));
            if (Math.abs(vx) > 2.5) h.flipX = vx < 0;
            h.walkPhase += dt * 11.5;
          }
        }
      }
    }

    drawRoamingHeroes(ctx) {
      if (!window.MT.sprites || this.roamers.length === 0) return;
      const ordered = [...this.roamers].sort((a, b) => a.y - b.y);

      for (const h of ordered) {
        const isHovered = this.hoveredUid === h.uid;
        const isWalking = h.mode === 'walk' && !isHovered;
        const bounce = isWalking ? Math.abs(Math.sin(h.walkPhase)) * 4.4 : 0;
        const squashX = isWalking ? 1 + Math.sin(h.walkPhase * 2) * 0.04 : 1;
        const squashY = isWalking ? 1 - Math.sin(h.walkPhase * 2) * 0.04 : 1;

        ctx.save();
        // Grounded tabletop contact shadow
        ctx.fillStyle = 'rgba(8, 4, 2, 0.58)';
        ctx.beginPath();
        ctx.ellipse(Math.round(h.x), Math.round(h.y + 3), isHovered ? 27 : 22, isHovered ? 9 : 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Subtle faction aura pip / hover selection ring directly on the wood
        ctx.strokeStyle = isHovered ? '#ffe28a' : h.factionColor;
        ctx.globalAlpha = isHovered ? 0.94 : 0.38;
        ctx.lineWidth = isHovered ? 2.2 : 1.5;
        ctx.beginPath();
        ctx.ellipse(Math.round(h.x), Math.round(h.y + 3), isHovered ? 28 : 20, isHovered ? 9.5 : 6, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Red-Seal or Iron-Plated miniature tabletop mark
        if (h.redSeal) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#ff4d6d';
          ctx.fillRect(Math.round(h.x - 19), Math.round(h.y - 3), 6, 6);
        } else if (h.ironPlated) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#6be5ff';
          ctx.fillRect(Math.round(h.x + 14), Math.round(h.y - 3), 6, 6);
        }
        ctx.restore();

        // Draw ENLARGED crisp pixel Duelyst unit standing on the walnut tabletop!
        window.MT.sprites.drawUnit(
          ctx,
          h.unitId,
          'idle',
          this.time + h.animOffset,
          h.x,
          h.y - bounce,
          {
            scale: isHovered ? 1.38 : 1.24,
            flipX: h.flipX,
            squashX,
            squashY,
            outlineColor: isHovered ? '#ffe28a' : null
          }
        );
      }
    }

    render(dt) {
      const ctx = this.ctx;
      ctx.save();
      if (this.shakeTime > 0 && this.shakeAmp > 0) {
        const sx = (Math.random() - 0.5) * this.shakeAmp;
        const sy = (Math.random() - 0.5) * this.shakeAmp;
        ctx.translate(sx, sy);
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.bgCanvas, 0, 0, VW, VH, 0, 0, W, H);

      // Unified warm overhead tavern lantern pools (consistent top-left lighting across wood & baize!)
      const flick1 = 0.90 + Math.sin(this.time * 2.3) * 0.06 + Math.sin(this.time * 6.1) * 0.03;
      const flick2 = 0.90 + Math.cos(this.time * 1.8) * 0.07 + Math.sin(this.time * 4.9) * 0.03;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Primary top-left hearth candle lantern illuminating Wanted Poster + Promenade
      const lg = ctx.createRadialGradient(186, 175, 24, 186, 175, 490);
      lg.addColorStop(0, `rgba(255, 190, 96, ${0.18 * flick1})`);
      lg.addColorStop(0.55, `rgba(204, 114, 42, ${0.07 * flick1})`);
      lg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, 740, H);

      // Warm tavern chandelier glow over the Emerald Baize Market Mat
      const rg = ctx.createRadialGradient(820, 340, 36, 820, 340, 560);
      rg.addColorStop(0, `rgba(255, 206, 116, ${0.13 * flick2})`);
      rg.addColorStop(0.6, `rgba(176, 118, 48, ${0.05 * flick2})`);
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rg;
      ctx.fillRect(320, 0, 960, H);

      // Soft warm pool lighting the lower-left roaming squad promenade
      const pg = ctx.createRadialGradient(192, 622, 18, 192, 622, 230);
      pg.addColorStop(0, `rgba(255, 186, 92, ${0.11 * flick1})`);
      pg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = pg;
      ctx.fillRect(0, 440, 440, 280);
      ctx.restore();

      // Draw live free-roaming squad heroes right on the walnut tabletop!
      this.drawRoamingHeroes(ctx);

      // Gentle rising golden candle-dust motes over the tabletop
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const e of this.embers) {
        e.x += (e.vx + Math.sin(this.time * 1.2 + e.phase) * 7) * dt;
        e.y += e.vy * dt;
        if (e.y < -10) { e.y = H + 8; e.x = Math.random() * W; }
        if (e.x < 0) e.x = W;
        if (e.x > W) e.x = 0;
        const a = 0.14 + 0.34 * (0.5 + 0.5 * Math.sin(this.time * 2.1 + e.phase));
        ctx.globalAlpha = a;
        ctx.fillStyle = e.bright ? '#ffe5a3' : '#d99646';
        ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
      }
      ctx.restore();

      ctx.restore();
    }
  }

  // ─── Rainy Midnight Tavern Exterior Live Atmosphere Overlay (1280x720) ───
  class TitleRainFX {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      if (this.canvas) {
        this.canvas.width = W;
        this.canvas.height = H;
      }
      this.running = false;
      this.rafId = null;
      this.lastTs = 0;
      this.time = 0;

      this.drops = Array.from({ length: 110 }, () => ({
        x: Math.random() * (W + 180),
        y: Math.random() * H,
        len: 12 + Math.random() * 14,
        spd: 540 + Math.random() * 260,
        alpha: 0.16 + Math.random() * 0.24
      }));

      this.ripples = Array.from({ length: 14 }, () => ({
        x: 80 + Math.random() * (W - 160),
        y: 652 + Math.random() * 58,
        r: Math.random() * 18,
        maxR: 12 + Math.random() * 16,
        spd: 14 + Math.random() * 12
      }));

      this.motes = Array.from({ length: 18 }, (_, i) => ({
        x: 260 + Math.random() * 760,
        y: 260 + Math.random() * 380,
        vy: -7 - Math.random() * 10,
        phase: Math.random() * 6.28,
        size: i % 3 === 0 ? 4 : 3
      }));
    }

    start() {
      if (!this.ctx || this.running) return;
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
      if (this.ctx) this.ctx.clearRect(0, 0, W, H);
    }

    render(dt) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, W, H);

      // 1. Flickering warm doorway lanterns & stained window light halos (aligned to lv2.png!)
      const f1 = 0.88 + Math.sin(this.time * 3.1) * 0.08 + Math.sin(this.time * 7.7) * 0.04;
      const f2 = 0.88 + Math.cos(this.time * 2.7) * 0.08 + Math.sin(this.time * 6.3) * 0.04;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const lights = [
        { x: 512, y: 492, r: 128, a: 0.24 * f1 }, // Left doorway lantern
        { x: 768, y: 492, r: 128, a: 0.24 * f2 }, // Right doorway lantern
        { x: 374, y: 318, r: 150, a: 0.14 * f2 }, // Left upstairs tavern window
        { x: 904, y: 318, r: 150, a: 0.14 * f1 }, // Right upstairs tavern window
        { x: 640, y: 548, r: 170, a: 0.12 * f1 }  // Warm doorway welcome pool on stone steps
      ];
      for (const l of lights) {
        const g = ctx.createRadialGradient(l.x, l.y, 6, l.x, l.y, l.r);
        g.addColorStop(0, `rgba(255, 198, 92, ${l.a})`);
        g.addColorStop(0.5, `rgba(235, 126, 42, ${l.a * 0.42})`);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }

      // Gentle drifting golden hearth sparks near windows & doorway
      for (const m of this.motes) {
        m.y += m.vy * dt;
        m.x += Math.sin(this.time * 1.4 + m.phase) * 9 * dt;
        if (m.y < 180) { m.y = 620; m.x = 260 + Math.random() * 760; }
        const a = 0.18 + 0.36 * (0.5 + 0.5 * Math.sin(this.time * 2.4 + m.phase));
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffe199';
        ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
      }
      ctx.restore();

      // 2. Crisp diagonal midnight pixel rain streaks
      ctx.save();
      ctx.lineWidth = 2;
      for (const d of this.drops) {
        d.x -= d.spd * 0.22 * dt;
        d.y += d.spd * dt;
        if (d.y > H + 20) {
          d.y = -20 - Math.random() * 80;
          d.x = Math.random() * (W + 180);
        }
        ctx.strokeStyle = `rgba(176, 214, 255, ${d.alpha})`;
        ctx.beginPath();
        ctx.moveTo(Math.round(d.x), Math.round(d.y));
        ctx.lineTo(Math.round(d.x - d.len * 0.22), Math.round(d.y + d.len));
        ctx.stroke();
      }

      // 3. Subtle cobblestone rain puddle ripples along bottom edge
      ctx.lineWidth = 1.5;
      for (const rp of this.ripples) {
        rp.r += rp.spd * dt;
        if (rp.r >= rp.maxR) {
          rp.r = 1;
          rp.x = 80 + Math.random() * (W - 160);
          rp.y = 654 + Math.random() * 54;
        }
        const alpha = (1 - rp.r / rp.maxR) * 0.36;
        ctx.strokeStyle = `rgba(255, 218, 140, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(Math.round(rp.x), Math.round(rp.y), rp.r, rp.r * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  window.MT.EclipseAltarBg = EclipseAltarBg;
  window.MT.TitleRainFX = TitleRainFX;
})();
