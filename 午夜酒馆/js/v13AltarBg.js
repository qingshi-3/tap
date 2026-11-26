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

  // ─── Procedural 16-bit Pixel-Art Title Scene: "ECLIPSE SANCTUM OVER THE MIRROR LAKE" ───
  // 100% code-generated on strict 320x180 pixel grid (4x integer scale -> 1280x720) with Bayer 4x4 dithering,
  // living animated Solar Eclipse corona, stratified rim-lit storm clouds, gothic spire silhouettes,
  // weathered obsidian bridge with twin simulated pixel-fire braziers, live Duelyst warband heroes,
  // real-time horizontal-scanline Mirror Lake reflections, and wind-swept golden embers. Zero background PNGs!
  class TitleRainFX {
    constructor(canvas, sprites = null) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.sprites = sprites || window.MT.sprites || null;
      if (this.canvas) {
        this.canvas.width = W;
        this.canvas.height = H;
      }

      // Strict virtual pixel grid: 320x180 -> exact 4x integer scale to 1280x720
      this.VW = 320;
      this.VH = 180;
      this.HORIZON_VY = 118; // y = 472px
      this.HORIZON_Y = this.HORIZON_VY * 4;

      // 1. Pre-baked static pixel sky + stars + mountains + gothic ruins + obsidian bridge (320x118)
      this.staticSky = document.createElement('canvas');
      this.staticSky.width = this.VW;
      this.staticSky.height = this.HORIZON_VY;
      this.staticSkyCtx = this.staticSky.getContext('2d');
      this.staticSkyCtx.imageSmoothingEnabled = false;

      // 2. Dynamic pixel overlay (clouds, eclipse corona, pixel fire braziers, embers) at 320x118
      this.dynPx = document.createElement('canvas');
      this.dynPx.width = this.VW;
      this.dynPx.height = this.HORIZON_VY;
      this.dynPxCtx = this.dynPx.getContext('2d');
      this.dynPxCtx.imageSmoothingEnabled = false;

      // 3. Full upper world composition buffer (1280 x 472) -> reflected live into Mirror Lake!
      this.upperBuf = document.createElement('canvas');
      this.upperBuf.width = W;
      this.upperBuf.height = this.HORIZON_Y;
      this.upperCtx = this.upperBuf.getContext('2d');
      this.upperCtx.imageSmoothingEnabled = false;

      // 4. Foreground full-screen pixel overlay (320x180) for wind embers & atmospheric rain/sparks
      this.fgPx = document.createElement('canvas');
      this.fgPx.width = this.VW;
      this.fgPx.height = this.VH;
      this.fgPxCtx = this.fgPx.getContext('2d');
      this.fgPxCtx.imageSmoothingEnabled = false;

      this.running = false;
      this.rafId = null;
      this.lastTs = 0;
      this.time = 0;

      // Eclipse coordinates in 320x180 grid
      this.EX = 226;
      this.EY = 48;
      this.ER = 19;

      // Twin iron brazier coordinates on the obsidian bridge (320x180 grid)
      this.braziers = [
        { x: 162, y: 109, phase: 0.4 },
        { x: 294, y: 109, phase: 2.3 }
      ];

      // 4x4 Bayer ordered dithering matrix (values 0..15)
      this.bayer4 = [
        [ 0,  8,  2, 10],
        [12,  4, 14,  6],
        [ 3, 11,  1,  9],
        [15,  7, 13,  5]
      ];

      // Deterministic hash
      this._h01 = (i, s) => {
        let n = Math.imul(i + 37, 374761393) ^ Math.imul(s + 17, 668265263);
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
      };

      // Organic wind-sheared pixel cloud wisps (sculpted irregular silhouettes, never ruler-flat bars!)
      this.clouds = [
        { x: 16,  y: 26, w: 68, h: 7, spd: 1.4, layer: 'back',  lit: 0.28, seed: 1.1 },
        { x: 118, y: 20, w: 76, h: 8, spd: 1.1, layer: 'back',  lit: 0.62, seed: 2.7 },
        { x: 256, y: 18, w: 66, h: 7, spd: 1.3, layer: 'back',  lit: 0.72, seed: 4.3 },
        { x: 56,  y: 66, w: 86, h: 8, spd: 2.0, layer: 'front', lit: 0.45, seed: 5.9 },
        { x: 184, y: 71, w: 96, h: 7, spd: 2.4, layer: 'front', lit: 0.88, seed: 7.4 },
        { x: 264, y: 58, w: 64, h: 6, spd: 1.9, layer: 'front', lit: 0.75, seed: 9.1 }
      ];

      // Twinkling night stars in the calm dark left sky
      this.stars = [];
      for (let i = 0; i < 42; i++) {
        const sx = Math.floor(this._h01(i, 11) * 308) + 6;
        const sy = Math.floor(this._h01(i, 23) * 72) + 4;
        const dx = sx - this.EX;
        const dy = sy - this.EY;
        if (dx * dx + dy * dy < 38 * 38) continue; // keep corona zone clean
        this.stars.push({
          x: sx,
          y: sy,
          phase: this._h01(i, 37) * Math.PI * 2,
          spd: 1.1 + this._h01(i, 43) * 2.2,
          bright: this._h01(i, 53),
          cross: i % 9 === 0
        });
      }

      // Wind-swept golden hearth embers & ash motes drifting right-to-left across the entire scene
      this.embers = [];
      for (let i = 0; i < 48; i++) {
        const fromBrazier = i < 24;
        const b = this.braziers[i % 2];
        this.embers.push({
          fromBrazier,
          bx: b.x,
          by: b.y - 10,
          x: fromBrazier ? (b.x + (this._h01(i, 61) - 0.5) * 40) : (this._h01(i, 67) * this.VW),
          y: fromBrazier ? (b.y - 10 - this._h01(i, 71) * 65) : (this._h01(i, 73) * this.VH),
          vx: -(12 + this._h01(i, 79) * 24),
          vy: -(8 + this._h01(i, 83) * 18),
          phase: this._h01(i, 89) * Math.PI * 2,
          hot: this._h01(i, 97) > 0.35,
          life: this._h01(i, 101)
        });
      }

      // Subtle atmospheric night rain streaks (sparse & refined so fire & eclipse shine)
      this.rain = [];
      for (let i = 0; i < 34; i++) {
        this.rain.push({
          x: this._h01(i, 131) * (this.VW + 40),
          y: this._h01(i, 137) * this.VH,
          spd: 115 + this._h01(i, 149) * 55,
          len: i % 3 === 0 ? 5 : 3
        });
      }

      // 3-Hero Eclipse Warband Vanguard standing on the obsidian stone bridge beneath the Eclipse!
      // Clean breathing spacing between all 3 silhouettes so weapons & staves never collide!
      this.warband = [
        { unitId: 'f1_spellbladeadept', x: 742, y: 440, scale: 1.76, flipX: true,  phase: 0.2, rim: 'rgba(255, 206, 110, 0.72)' },
        { unitId: 'f1_3rdgeneral',      x: 896, y: 440, scale: 1.86, flipX: true,  phase: 1.4, rim: 'rgba(255, 190, 92, 0.78)' },
        { unitId: 'f3_allomancer',      x: 1066, y: 440, scale: 1.72, flipX: true, phase: 2.6, rim: 'rgba(255, 176, 86, 0.72)' }
      ];

      this._bakeStaticBackdrop();
    }

    _bayerPick(x, y, t, colA, colB) {
      const thresh = (this.bayer4[y & 3][x & 3] + 0.5) / 16;
      return t > thresh ? colB : colA;
    }

    _bakeStaticBackdrop() {
      const ctx = this.staticSkyCtx;
      const VW = this.VW;
      const HY = this.HORIZON_VY;

      // Curated 7-stop Dark-Fantasy Eclipse Sky Palette (obsidian indigo -> amethyst -> crimson dusk -> amber horizon)
      const skyStops = [
        '#06060f', // 0: zenith obsidian
        '#0b0a1a', // 1: deep midnight indigo
        '#131026', // 2: royal night slate
        '#1f1430', // 3: plum dusk
        '#341935', // 4: eclipse violet-wine
        '#562235', // 5: crimson horizon haze
        '#853a36', // 6: warm molten dusk near eclipse
        '#b85c3b'  // 7: bright horizon ember right below eclipse
      ];

      // 1. Ordered Bayer-dithered sky + radial eclipse atmospheric bloom (authentic 16-bit look!)
      for (let y = 0; y < HY; y++) {
        const ny = y / (HY - 1);
        for (let x = 0; x < VW; x++) {
          // Subtle directional warmth radiating from the Eclipse center (EX, EY) and low horizon
          const dx = (x - this.EX) / 118;
          const dy = (y - (this.EY + 16)) / 86;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const eclipseBloom = Math.max(0, 1 - dist);
          const horizonWarm = Math.pow(ny, 2.2) * (0.42 + 0.58 * Math.max(0, 1 - Math.abs(x - this.EX) / 210));
          // Keep far-left sky deeper & cleaner for razor-sharp title readability
          const leftDeepen = x < 145 ? (1 - x / 145) * 0.24 : 0;

          const val = Math.max(0, Math.min(0.999,
            ny * 0.56 + eclipseBloom * eclipseBloom * 0.44 + horizonWarm * 0.36 - leftDeepen
          ));
          const scaled = val * (skyStops.length - 1);
          const idx = Math.floor(scaled);
          const frac = scaled - idx;
          ctx.fillStyle = this._bayerPick(x, y, frac, skyStops[idx], skyStops[Math.min(skyStops.length - 1, idx + 1)]);
          ctx.fillRect(x, y, 1, 1);
        }
      }

      // 2. Far misty gothic mountain range (layered atmospheric perspective)
      const drawRidge = (baseY, amp1, amp2, freq1, freq2, phase, fillCol, rimCol, rimThresh) => {
        for (let x = 0; x < VW; x++) {
          const h = Math.round(
            Math.sin(x * freq1 + phase) * amp1 +
            Math.sin(x * freq2 + phase * 1.9) * amp2 +
            Math.cos(x * 0.14 + phase) * 2
          );
          const topY = Math.max(48, Math.min(HY - 4, baseY - h));
          ctx.fillStyle = fillCol;
          ctx.fillRect(x, topY, 1, HY - topY);
          // Warm eclipse rim-light along mountain crest facing the eclipse!
          if (rimCol) {
            const distX = Math.abs(x - this.EX);
            if (distX < rimThresh) {
              const rA = 1 - distX / rimThresh;
              if (this._bayerPick(x, topY, rA * 0.85, false, true)) {
                ctx.fillStyle = rimCol;
                ctx.fillRect(x, topY, 1, 1);
              }
            }
          }
        }
      };

      // Far ridge
      drawRidge(101, 11, 5, 0.024, 0.068, 0.8, '#151124', '#7a3b42', 145);

      // Distant ruined gothic spires flanking the right eclipse horizon (keeping left title zone calm & clean!)
      ctx.fillStyle = '#120f22';
      const rightSpires = [
        { cx: 144, w: 6, h: 20 },
        { cx: 306, w: 9, h: 34 },
        { cx: 315, w: 6, h: 24 }
      ];
      for (const sp of rightSpires) {
        for (let dy = 0; dy < sp.h; dy++) {
          const p = dy / sp.h;
          const hw = Math.max(0, Math.floor((0.16 + p * 0.84) * (sp.w * 0.5)));
          ctx.fillRect(sp.cx - hw, HY - sp.h + dy - 6, hw * 2 + 1, 1);
        }
        // Subtle eclipse rim edge facing center
        ctx.fillStyle = '#733840';
        const rimSide = sp.cx > this.EX ? -1 : 1;
        ctx.fillRect(sp.cx + rimSide, HY - sp.h - 2, 1, Math.floor(sp.h * 0.55));
        ctx.fillStyle = '#120f22';
      }

      // Midground dark crags & ruined viaduct arches on right
      drawRidge(109, 7, 4, 0.036, 0.095, 2.4, '#0c0a17', '#a8533b', 110);

      // Ruined gothic aqueduct pillars emerging from the right cliff
      ctx.fillStyle = '#0a0814';
      for (const ax of [188, 224, 260, 296]) {
        ctx.fillRect(ax, 102, 7, HY - 102);
        // Arch span between pillars
        if (ax < 296) {
          for (let dx = 0; dx < 30; dx++) {
            const u = (dx - 15) / 15;
            const archBot = 109 - Math.round(Math.sqrt(Math.max(0, 1 - u * u)) * 5);
            ctx.fillRect(ax + 6 + dx, 102, 1, Math.max(1, archBot - 102));
          }
        }
      }

      // 3. Soft Bayer-dithered mist hugging the lake horizon
      for (let y = HY - 12; y < HY; y++) {
        const p = (y - (HY - 12)) / 12;
        for (let x = 0; x < VW; x++) {
          const nearE = Math.max(0, 1 - Math.abs(x - this.EX) / 145);
          if (this._bayerPick(x, y, p * (0.28 + nearE * 0.28), false, true)) {
            ctx.fillStyle = nearE > 0.35 ? '#61333b' : '#25203a';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }

      // 4. Majestic Weathered Obsidian Stone Bridge / Sanctum Pier (vx = 148..320, vy = 109..118)
      const bx0 = 152;
      const by = 110;
      // Broken carved prow steps at left edge of bridge
      ctx.fillStyle = '#07060d';
      ctx.fillRect(bx0 - 4, by + 2, 4, 6);
      ctx.fillRect(bx0 - 2, by, 2, 8);
      ctx.fillStyle = '#292238';
      ctx.fillRect(bx0 - 3, by + 2, 3, 2);

      // Main bridge deck & stone masonry courses
      ctx.fillStyle = '#080710';
      ctx.fillRect(bx0, by - 1, VW - bx0, 1); // crisp top outline
      // Eclipse & firelit bevel along bridge top surface
      for (let x = bx0; x < VW; x++) {
        const dB1 = Math.abs(x - this.braziers[0].x);
        const dB2 = Math.abs(x - this.braziers[1].x);
        const warm = Math.max(Math.max(0, 1 - dB1 / 34), Math.max(0, 1 - dB2 / 34));
        ctx.fillStyle = warm > 0.55 ? '#c78548' : warm > 0.2 ? '#734a42' : '#433852';
        ctx.fillRect(x, by, 1, 1);
      }
      ctx.fillStyle = '#221d30';
      ctx.fillRect(bx0, by + 1, VW - bx0, 3);
      ctx.fillStyle = '#14111f';
      ctx.fillRect(bx0, by + 4, VW - bx0, 4);

      // Stone block mortar joints + subtle moss/cracks
      for (let x = bx0 + 6; x < VW; x += 12) {
        ctx.fillStyle = '#090812';
        ctx.fillRect(x, by + 1, 1, 3);
        ctx.fillRect(x + 6, by + 4, 1, 4);
        ctx.fillStyle = '#362d47';
        ctx.fillRect(x + 1, by + 1, 2, 1);
      }
      // Subtle engraved gold-bronze trim along bridge fascia
      ctx.fillStyle = '#5e4334';
      ctx.fillRect(bx0 + 4, by + 4, VW - bx0 - 4, 1);
      // Heavy support piers descending into lake
      for (const px of [162, 212, 266, 308]) {
        ctx.fillStyle = '#090812';
        ctx.fillRect(px - 3, by + 5, 9, HY - (by + 5));
        ctx.fillStyle = '#1d182b';
        ctx.fillRect(px - 2, by + 5, 6, HY - (by + 5));
        ctx.fillStyle = '#382e4a';
        ctx.fillRect(px - 2, by + 5, 1, HY - (by + 5));
      }

      // 5. Twin Carved Stone Pedestals & Wrought-Iron Fire Braziers
      for (const b of this.braziers) {
        const x = b.x;
        const y = b.y;
        // Stone pedestal base
        ctx.fillStyle = '#07060d';
        ctx.fillRect(x - 5, y - 10, 11, 11);
        ctx.fillStyle = '#262034';
        ctx.fillRect(x - 4, y - 3, 9, 3);
        ctx.fillStyle = '#3b324e';
        ctx.fillRect(x - 4, y - 3, 9, 1);
        // Iron column
        ctx.fillStyle = '#1d192b';
        ctx.fillRect(x - 2, y - 9, 5, 6);
        ctx.fillStyle = '#4e4263';
        ctx.fillRect(x - 1, y - 9, 1, 6);
        // Iron fire bowl
        ctx.fillStyle = '#080710';
        ctx.fillRect(x - 6, y - 13, 13, 4);
        ctx.fillStyle = '#3b3047';
        ctx.fillRect(x - 5, y - 12, 11, 2);
        ctx.fillStyle = '#9e5c34';
        ctx.fillRect(x - 4, y - 13, 9, 1); // rim glowing from fire
      }
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

    _drawCloudRibbon(pctx, c, t) {
      const cx = Math.floor(c.x);
      const cy = c.y;
      const w = c.w;
      const h = c.h;
      const seed = c.seed || 1;
      const centerE = this.EX;

      // Sculpted organic column-by-column pixel cloud profile (billowy stepped top, wispy feathered bottom!)
      for (let dx = 0; dx < w; dx++) {
        const px = cx + dx;
        if (px < 0 || px >= this.VW) continue;
        const u = dx / Math.max(1, w - 1); // 0..1 across width
        const env = Math.sin(u * Math.PI); // tapers cleanly to 0 at both tips
        if (env < 0.08) continue;

        const billow =
          0.52 +
          0.26 * Math.sin(u * 8.5 + seed) +
          0.16 * Math.cos(u * 17.0 - seed * 1.6) +
          0.08 * Math.sin(u * 29.0 + seed * 2.3);
        const topH = Math.max(1, Math.round(env * billow * h));
        const botH = Math.max(0, Math.round(env * (0.35 + 0.3 * Math.sin(u * 11 + seed * 0.7)) * 2));
        const yTop = cy - topH;
        const yBot = cy + botH;

        const distE = Math.abs(px - centerE);
        const lit = c.lit * Math.max(0, 1 - distE / 128);

        for (let py = yTop; py <= yBot; py++) {
          if (py < 0 || py >= this.HORIZON_VY) continue;
          const isTopRim = (py === yTop) && (cy > this.EY);
          const isBotRim = (py === yBot) && (cy <= this.EY);
          if ((isTopRim || isBotRim) && lit > 0.24) {
            if (lit > 0.62 && this._bayerPick(px, py, lit, false, true)) {
              pctx.fillStyle = '#e08248';
            } else if (this._bayerPick(px, py, lit * 0.9, false, true)) {
              pctx.fillStyle = '#7c3844';
            } else {
              pctx.fillStyle = '#1b152e';
            }
          } else {
            // Subtle inner dark-slate depth shading
            const innerNorm = (py - yTop) / Math.max(1, yBot - yTop);
            pctx.fillStyle = innerNorm < 0.45 ? '#171329' : '#0f0c1d';
          }
          pctx.fillRect(px, py, 1, 1);
        }
      }
    }

    _drawLivingEclipse(pctx, t) {
      const ex = this.EX;
      const ey = this.EY;
      const r = this.ER;

      // 1. Subtle diagonal pixel crepuscular rays radiating behind the Eclipse
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + t * 0.06;
        const len = 32 + Math.sin(t * 1.1 + i * 2.1) * 7;
        for (let d = r + 2; d < r + len; d += 2) {
          const px = Math.round(ex + Math.cos(ang) * d);
          const py = Math.round(ey + Math.sin(ang) * d);
          const a = (1 - (d - r) / len) * 0.28;
          if (a <= 0.03) continue;
          pctx.fillStyle = `rgba(255, 178, 86, ${a.toFixed(3)})`;
          pctx.fillRect(px, py, 1, 1);
        }
      }

      // 2. Animated writhing pixel solar corona (strict pixel-grid radial noise)
      const maxR = r + 13;
      for (let dy = -maxR; dy <= maxR; dy++) {
        for (let dx = -maxR; dx <= maxR; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < r - 0.5 || dist > maxR) continue;
          const ang = Math.atan2(dy, dx);
          // Layered animated corona tongues
          const wave =
            Math.sin(ang * 5 + t * 0.9) * 2.4 +
            Math.sin(ang * 11 - t * 1.55) * 1.6 +
            Math.cos(ang * 17 + t * 2.2) * 0.9;
          const rimExtent = 4.6 + Math.max(0, wave) * 1.35;
          const dr = dist - r;
          if (dr < 0 || dr > rimExtent) continue;

          const norm = dr / rimExtent;
          if (norm < 0.24) {
            pctx.fillStyle = '#fff9dc';
          } else if (norm < 0.50) {
            pctx.fillStyle = '#ffd05c';
          } else if (norm < 0.76) {
            pctx.fillStyle = this._bayerPick(ex + dx, ey + dy, (norm - 0.50) / 0.26, '#f58436', '#c93c34');
          } else {
            if (!this._bayerPick(ex + dx, ey + dy, 1 - (norm - 0.76) / 0.24, false, true)) continue;
            pctx.fillStyle = '#8c2432';
          }
          pctx.fillRect(ex + dx, ey + dy, 1, 1);
        }
      }

      // 3. Obsidian pitch-black eclipsed sun disc
      pctx.fillStyle = '#06050c';
      const r2 = (r - 0.4) * (r - 0.4);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r2) {
            pctx.fillRect(ex + dx, ey + dy, 1, 1);
          }
        }
      }

      // 4. Razor-sharp Diamond-Ring Flare gleaming at 8:30 o'clock (cleanly above clouds, pointing toward title!)
      const flareAng = Math.PI * 0.84;
      const fx = Math.round(ex + Math.cos(flareAng) * r);
      const fy = Math.round(ey + Math.sin(flareAng) * r);
      const pulse = 0.72 + 0.28 * Math.sin(t * 2.6);
      const arm = Math.round(5 + pulse * 4);
      pctx.fillStyle = '#ffd978';
      pctx.fillRect(fx - arm, fy, arm * 2 + 1, 1);
      pctx.fillRect(fx, fy - Math.round(arm * 0.75), 1, Math.round(arm * 1.5) + 1);
      // Subtle diagonal star-glint pixels
      pctx.fillStyle = '#ffbf54';
      pctx.fillRect(fx - 2, fy - 2, 1, 1);
      pctx.fillRect(fx + 2, fy - 2, 1, 1);
      pctx.fillRect(fx - 2, fy + 2, 1, 1);
      pctx.fillRect(fx + 2, fy + 2, 1, 1);
      pctx.fillStyle = '#ffffff';
      pctx.fillRect(fx - 1, fy - 1, 3, 3);
      pctx.fillRect(fx - 2, fy, 5, 1);
      pctx.fillRect(fx, fy - 2, 1, 5);
    }

    _drawPixelBrazierFire(pctx, bx, by, t, phase) {
      // Pure pixelfx-style procedural pixel fire inside the iron bowl (320x180 grid)
      const baseY = by - 13;
      for (let dy = 0; dy < 15; dy++) {
        const ny = dy / 14;
        const sway = Math.round(Math.sin(t * 9.5 + phase + dy * 0.55) * (0.4 + ny * 2.2) - ny * 1.4);
        const halfW = Math.max(0, Math.round((1 - ny * 0.92) * 3.8 + Math.sin(t * 14 + dy + phase) * 0.55));
        for (let dx = -halfW; dx <= halfW; dx++) {
          const edgeDist = Math.abs(dx) / Math.max(1, halfW + 0.5);
          const heat = (1 - ny * 0.85) * (1 - edgeDist * 0.45);
          if (heat < 0.14) continue;
          let col = '#b82534';
          if (heat > 0.78) col = '#fffce0';
          else if (heat > 0.58) col = '#ffd452';
          else if (heat > 0.36) col = '#ff7b29';
          pctx.fillStyle = col;
          pctx.fillRect(bx + dx + sway, baseY - dy, 1, 1);
        }
      }
      // Detached dancing flame spark tip
      const sparkT = (t * 2.4 + phase) % 1;
      const sx = Math.round(bx - sparkT * 6 + Math.sin(t * 7 + phase) * 2);
      const sy = Math.round(baseY - 12 - sparkT * 10);
      pctx.fillStyle = sparkT < 0.5 ? '#ffe078' : '#e85b30';
      pctx.fillRect(sx, sy, 1, 1);
    }

    render(dt) {
      const ctx = this.ctx;
      const uctx = this.upperCtx;
      const dctx = this.dynPxCtx;
      const fctx = this.fgPxCtx;
      if (!ctx || !uctx || !dctx || !fctx) return;

      const t = this.time;
      const VW = this.VW;
      const VH = this.VH;
      const HY = this.HORIZON_VY;

      // ═══ STEP 1: Dynamic Pixel Sky, Stars, Back Clouds, Living Eclipse, Front Clouds, Braziers (320x118) ═══
      dctx.clearRect(0, 0, VW, HY);
      dctx.drawImage(this.staticSky, 0, 0);

      // Twinkling pixel stars
      for (const st of this.stars) {
        const tw = 0.45 + 0.55 * Math.sin(t * st.spd + st.phase);
        const a = (0.28 + st.bright * 0.62) * tw;
        dctx.fillStyle = st.bright > 0.75 ? `rgba(255, 240, 204, ${a.toFixed(2)})` : `rgba(196, 214, 248, ${a.toFixed(2)})`;
        dctx.fillRect(st.x, st.y, 1, 1);
        if (st.cross && tw > 0.82) {
          dctx.fillStyle = `rgba(255, 232, 176, ${(a * 0.45).toFixed(2)})`;
          dctx.fillRect(st.x - 1, st.y, 3, 1);
          dctx.fillRect(st.x, st.y - 1, 1, 3);
        }
      }

      // Back clouds behind Eclipse
      for (const c of this.clouds) {
        c.x -= c.spd * dt;
        if (c.x + c.w < -12) c.x = VW + 12;
        if (c.layer === 'back') this._drawCloudRibbon(dctx, c, t);
      }

      // The Living Solar Eclipse!
      this._drawLivingEclipse(dctx, t);

      // Front clouds drifting softly across lower eclipse rim
      for (const c of this.clouds) {
        if (c.layer === 'front') this._drawCloudRibbon(dctx, c, t);
      }

      // Twin blazing pixel-art iron braziers on the stone bridge
      for (const b of this.braziers) {
        this._drawPixelBrazierFire(dctx, b.x, b.y, t, b.phase);
      }

      // ═══ STEP 2: Composite Upper World at 1280x472 (4x pixel sky/bridge + Live Duelyst Heroes!) ═══
      uctx.clearRect(0, 0, W, this.HORIZON_Y);
      uctx.imageSmoothingEnabled = false;
      uctx.drawImage(this.dynPx, 0, 0, VW, HY, 0, 0, W, this.HORIZON_Y);

      // Subtle breathing warm firelight pools from twin braziers onto bridge & heroes
      uctx.save();
      uctx.globalCompositeOperation = 'lighter';
      for (const b of this.braziers) {
        const flick = 0.86 + Math.sin(t * 7.8 + b.phase) * 0.10 + Math.cos(t * 13.4 + b.phase) * 0.04;
        const bx = b.x * 4;
        const by = (b.y - 15) * 4;
        const rad = 116 * flick;
        const g = uctx.createRadialGradient(bx, by, 4, bx, by, rad);
        g.addColorStop(0, `rgba(255, 210, 108, ${(0.34 * flick).toFixed(3)})`);
        g.addColorStop(0.45, `rgba(235, 114, 46, ${(0.14 * flick).toFixed(3)})`);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        uctx.fillStyle = g;
        uctx.fillRect(bx - rad, by - rad, rad * 2, rad * 2);
      }
      uctx.restore();

      // Live Animated Duelyst Eclipse Warband standing heroically on the bridge!
      const sprites = this.sprites || window.MT.sprites;
      if (sprites && sprites.drawUnit) {
        for (const h of this.warband) {
          // Crisp dark pixel ground contact shadow on bridge slabs
          uctx.fillStyle = 'rgba(5, 4, 12, 0.78)';
          uctx.fillRect(Math.round(h.x - 28), Math.round(h.y - 2), 56, 6);
          sprites.drawUnit(uctx, h.unitId, 'idle', t + h.phase, h.x, h.y, {
            scale: h.scale,
            flipX: h.flipX,
            alpha: 1,
            outlineColor: h.rim
          });
        }
      }

      // ═══ STEP 3: Blit Upper World + Real-Time Shimmering Pixel Mirror Lake Reflection! ═══
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.upperBuf, 0, 0);

      // Mirror Lake (y = HORIZON_Y .. H): flip upperBuf into crisp 4px-tall wavy pixel scanlines!
      const lakeH = H - this.HORIZON_Y;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, this.HORIZON_Y, W, lakeH);
      ctx.clip();

      // Deep nocturnal lake base
      ctx.fillStyle = '#070712';
      ctx.fillRect(0, this.HORIZON_Y, W, lakeH);

      // Scanline wavy reflection strips (4px = 1 virtual pixel row!)
      const stripH = 4;
      for (let sy = 0; sy < lakeH; sy += stripH) {
        const progress = sy / lakeH; // 0 at horizon -> 1 at bottom foreground
        // Sample flipped source row from upperBuf (compressed vertically so the FULL Solar Eclipse ring reflects proudly in the Mirror Lake!)
        const srcY = Math.max(0, Math.min(this.HORIZON_Y - stripH, Math.floor(this.HORIZON_Y - stripH - sy * 1.62)));
        const wave = Math.sin(t * 2.3 + sy * 0.11 + Math.sin(t * 0.9 + sy * 0.04) * 1.4);
        const shiftPx = Math.round(wave * (1.1 + progress * 3.4)) * 4; // snapped to exact 4px pixel grid!
        ctx.globalAlpha = 0.66 - progress * 0.22;
        ctx.drawImage(
          this.upperBuf,
          0, srcY, W, stripH,
          shiftPx, this.HORIZON_Y + sy, W, stripH
        );
      }
      ctx.globalAlpha = 1;

      // Subtle horizontal dark-indigo lake depth glaze + crisp water-horizon separator line
      const lakeTint = ctx.createLinearGradient(0, this.HORIZON_Y, 0, H);
      lakeTint.addColorStop(0, 'rgba(10, 10, 24, 0.28)');
      lakeTint.addColorStop(0.55, 'rgba(7, 8, 20, 0.48)');
      lakeTint.addColorStop(1, 'rgba(4, 5, 12, 0.78)');
      ctx.fillStyle = lakeTint;
      ctx.fillRect(0, this.HORIZON_Y, W, lakeH);

      // Crisp 1-virtual-pixel horizon shimmer line
      ctx.fillStyle = 'rgba(224, 152, 92, 0.26)';
      ctx.fillRect(0, this.HORIZON_Y, W, 4);
      ctx.restore();

      // ═══ STEP 4: Foreground Wind-Swept Golden Embers & Sparse Atmospheric Drizzle (320x180 -> 4x) ═══
      fctx.clearRect(0, 0, VW, VH);

      // Subtle pixel water glint bars on lake surface
      for (let i = 0; i < 16; i++) {
        const wy = HY + 4 + Math.floor(this._h01(i, 211) * (VH - HY - 8));
        const baseX = this.EX + Math.round((this._h01(i, 223) - 0.5) * 90);
        const wx = Math.round(baseX + Math.sin(t * 2.1 + i * 1.7) * 5);
        const ww = 3 + Math.floor(this._h01(i, 229) * 8);
        const a = 0.14 + 0.18 * (0.5 + 0.5 * Math.sin(t * 3.2 + i * 2.3));
        fctx.fillStyle = `rgba(255, 198, 114, ${a.toFixed(2)})`;
        fctx.fillRect(wx, wy, ww, 1);
      }

      // Sparse delicate wind-driven night drizzle (crisp 1px streaks)
      for (const r of this.rain) {
        r.x -= r.spd * 0.22 * dt;
        r.y += r.spd * dt;
        if (r.y > VH + 6) {
          r.y = -6;
          r.x = ((r.x + 173) % (VW + 36));
        }
        if (r.x < -6) r.x += VW + 36;
        const nearGlow = Math.abs(r.x - this.EX) < 62 && r.y < HY + 12;
        fctx.fillStyle = nearGlow ? 'rgba(255, 204, 134, 0.24)' : 'rgba(154, 178, 224, 0.15)';
        for (let s = 0; s < r.len; s++) {
          fctx.fillRect(Math.round(r.x + s * 0.22), Math.round(r.y - s), 1, 1);
        }
      }

      // Wind-swept glowing golden & ember-red sparks drifting right-to-left!
      for (const e of this.embers) {
        e.x += e.vx * dt;
        e.y += (e.vy + Math.sin(t * 2.6 + e.phase) * 7) * dt;
        if (e.x < -4 || e.y < -4) {
          if (e.fromBrazier) {
            e.x = e.bx + (Math.sin(t * 7 + e.phase) * 3);
            e.y = e.by;
          } else {
            e.x = VW + 2;
            e.y = 20 + ((e.y + 97) % (VH - 24));
          }
        }
        const flicker = 0.45 + 0.55 * Math.abs(Math.sin(t * 4.5 + e.phase));
        fctx.globalAlpha = Math.min(1, flicker * 0.92);
        fctx.fillStyle = e.hot ? (flicker > 0.78 ? '#fff6cc' : '#ffbe4f') : '#e85b35';
        fctx.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
      }
      fctx.globalAlpha = 1;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.fgPx, 0, 0, VW, VH, 0, 0, W, H);
      ctx.restore();
    }
  }

  window.MT.EclipseAltarBg = EclipseAltarBg;
  window.MT.TitleRainFX = TitleRainFX;
})();
