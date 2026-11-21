// HD-2D Atmospheric Midnight Tavern Canvas Renderer (1280x720)
// Combines rich volumetric moonlight/hearth bloom, subtle scanline grain, clean unobstructed
// Duelyst sprite staging, and Image-1-inspired luminous corner-bracket targeting reticles.
(function () {
  window.MT = window.MT || {};

  const STAGE_W = 1280;
  const STAGE_H = 720;

  // Clean, spacious 2-row promenade in left/center hall (ZERO overlap with tables or right panel)
  const TAVERN_SPOTS = [
    { x: 208, y: 416, facing: 1 },
    { x: 382, y: 414, facing: -1 },
    { x: 562, y: 416, facing: 1 },
    { x: 748, y: 416, facing: -1 },
    { x: 292, y: 558, facing: 1 },
    { x: 486, y: 562, facing: -1 },
    { x: 678, y: 556, facing: -1 },
    { x: 825, y: 492, facing: -1 }
  ];

  class TavernCanvas {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.canvas.width = STAGE_W;
      this.canvas.height = STAGE_H;

      this.time = 0;
      this.lastTs = 0;
      this.shakeTime = 0;
      this.shakeAmp = 0;
      this.lightningAlpha = 0;
      this.nextLightning = 6 + Math.random() * 9;
      this.doorOpen = 0;

      this.rain = Array.from({ length: 72 }, () => ({
        x: Math.random() * 160,
        y: Math.random() * 210,
        spd: 290 + Math.random() * 140,
        len: 12 + Math.random() * 14
      }));

      this.dust = Array.from({ length: 46 }, () => ({
        x: 60 + Math.random() * 820,
        y: 90 + Math.random() * 490,
        vx: (Math.random() - 0.5) * 9,
        vy: -6 - Math.random() * 10,
        r: 1.5 + Math.random() * 1.8,
        phase: Math.random() * 6.28
      }));

      this.embers = Array.from({ length: 28 }, () => ({
        x: 92 + (Math.random() - 0.5) * 64,
        y: 348 - Math.random() * 100,
        vy: 24 + Math.random() * 34,
        life: Math.random()
      }));

      this.particles = [];
      this.floaters = [];
      this.actors = [];
      this.selectedMercId = null;
      this.synergyHighlightIds = new Set();
      this.drinkReadyColor = null;
      this.ripples = [];
      this.dragTargetMercId = null;
      this.dragDrinkColor = null;
      this.upgrades = new Set();
    }

    setUpgrades(upgradeSet) {
      this.upgrades = upgradeSet;
    }

    syncMercenaries(mercs, assignedIds = new Set()) {
      const existing = new Map(this.actors.map((a) => [a.merc.id, a]));
      const nextActors = [];
      mercs.forEach((m, idx) => {
        const spot = TAVERN_SPOTS[idx % TAVERN_SPOTS.length];
        const prev = existing.get(m.id);
        if (prev) {
          prev.merc = m;
          prev.assigned = assignedIds.has(m.id);
          prev.homeX = spot.x;
          prev.homeY = spot.y;
          if (!prev.marching && !prev.lifted) {
            prev.x = spot.x;
            prev.y = spot.y;
          }
          nextActors.push(prev);
        } else {
          const bark = m.barks[Math.floor(Math.random() * m.barks.length)];
          nextActors.push({
            merc: m,
            x: spot.x,
            y: spot.y,
            homeX: spot.x,
            homeY: spot.y,
            facing: spot.facing,
            bubble: idx === 1 ? bark : '',
            bubbleTimer: idx === 1 ? 5.2 : 0,
            nextBarkIn: 4.5 + Math.random() * 7,
            anim: 'idle',
            animTimer: 0,
            lifted: false,
            assigned: assignedIds.has(m.id),
            marching: false,
            alpha: 1,
            phase: Math.random() * 6
          });
        }
      });
      this.actors = nextActors;
    }

    say(mercId, text, duration = 4.2) {
      const a = this.actors.find((x) => x.merc.id === mercId);
      if (!a) return;
      a.bubble = text;
      a.bubbleTimer = duration;
    }

    triggerAnim(mercId, anim, duration = 0.8) {
      const a = this.actors.find((x) => x.merc.id === mercId);
      if (!a) return;
      a.anim = anim;
      a.animTimer = duration;
    }

    triggerTapFeedback(mercId, color = '#4de8e8') {
      const a = this.actors.find((x) => x.merc.id === mercId);
      if (!a) return;
      a.tapPop = 1.0;
      this.ripples.push({ x: a.x, y: a.y + 3, r: 14, maxR: 62, color, life: 0.36, maxLife: 0.36 });
      this.burstParticles(a.x, a.y - 36, color, 10, 95);
    }

    shake(amp = 8, duration = 0.28) {
      this.shakeAmp = Math.max(this.shakeAmp, amp);
      this.shakeTime = Math.max(this.shakeTime, duration);
    }

    burstParticles(x, y, color, count = 22, speed = 150) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.35 + Math.random() * 0.85) * speed;
        this.particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 52,
          size: 3 + (i % 2),
          color,
          life: 0.5 + Math.random() * 0.45,
          maxLife: 0.95
        });
      }
    }

    spawnFloater(x, y, text, color = '#ffd97d') {
      this.floaters.push({ x, y, text, color, life: 1.65, maxLife: 1.65 });
    }

    startSquadMarchOut(mercIds) {
      this.doorOpen = 1;
      const set = new Set(mercIds);
      for (const a of this.actors) {
        if (set.has(a.merc.id)) {
          a.marching = true;
          a.facing = 1;
          a.bubble = '走起！天亮前凯旋！';
          a.bubbleTimer = 1.6;
        }
      }
    }

    resetMarch() {
      this.doorOpen = 0;
      for (const a of this.actors) {
        a.marching = false;
        a.alpha = 1;
        a.x = a.homeX;
        a.y = a.homeY;
      }
    }

    getMercActor(mercId) {
      return this.actors.find((a) => a.merc.id === mercId) || null;
    }

    hitTestMerc(stageX, stageY) {
      const sorted = [...this.actors].sort((a, b) => b.y - a.y);
      for (const a of sorted) {
        if (a.marching || a.alpha < 0.2) continue;
        if (Math.abs(stageX - a.x) <= 54 && stageY >= a.y - 122 && stageY <= a.y + 24) {
          return a;
        }
      }
      return null;
    }

    clientToStage(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * STAGE_W,
        y: ((clientY - rect.top) / rect.height) * STAGE_H
      };
    }

    start() {
      const loop = (ts) => {
        if (!this.lastTs) this.lastTs = ts;
        const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
        this.lastTs = ts;
        this.update(dt);
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    update(dt) {
      this.time += dt;
      if (this.shakeTime > 0) {
        this.shakeTime = Math.max(0, this.shakeTime - dt);
        if (this.shakeTime === 0) this.shakeAmp = 0;
      }

      for (const r of this.rain) {
        r.x -= r.spd * 0.2 * dt;
        r.y += r.spd * dt;
        if (r.y > 210) {
          r.y = -12;
          r.x = Math.random() * 160;
        }
      }
      this.nextLightning -= dt;
      if (this.nextLightning <= 0) {
        this.lightningAlpha = 0.75;
        this.nextLightning = 8 + Math.random() * 13;
      }
      if (this.lightningAlpha > 0) this.lightningAlpha = Math.max(0, this.lightningAlpha - dt * 2.8);

      for (const e of this.embers) {
        e.y -= e.vy * dt;
        e.x += Math.sin(this.time * 4 + e.life * 9) * 14 * dt;
        e.life -= dt * 0.58;
        if (e.life <= 0) {
          e.life = 0.8 + Math.random() * 0.5;
          e.x = 92 + (Math.random() - 0.5) * 56;
          e.y = 352;
        }
      }

      for (const d of this.dust) {
        d.x += (d.vx + Math.sin(this.time + d.phase) * 5) * dt;
        d.y += d.vy * dt;
        if (d.y < 80) {
          d.y = 580;
          d.x = 60 + Math.random() * 820;
        }
      }

      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const rp = this.ripples[i];
        rp.life -= dt;
        rp.r = 14 + (1 - rp.life / rp.maxLife) * (rp.maxR - 14);
        if (rp.life <= 0) this.ripples.splice(i, 1);
      }
      for (const a of this.actors) {
        if (a.tapPop > 0) a.tapPop = Math.max(0, a.tapPop - dt * 4.5);
        if (a.animTimer > 0) {
          a.animTimer -= dt;
          if (a.animTimer <= 0) a.anim = 'idle';
        }
        if (a.bubbleTimer > 0) {
          a.bubbleTimer -= dt;
          if (a.bubbleTimer <= 0) a.bubble = '';
        } else if (!a.marching && !a.lifted) {
          a.nextBarkIn -= dt;
          if (a.nextBarkIn <= 0) {
            a.nextBarkIn = 7 + Math.random() * 10;
            const activeBubbles = this.actors.filter((x) => x.bubbleTimer > 0).length;
            if (activeBubbles < 1 && a.merc.barks && a.merc.barks.length) {
              a.bubble = a.merc.barks[Math.floor(Math.random() * a.merc.barks.length)];
              a.bubbleTimer = 3.8;
            }
          }
        }
        if (a.marching) {
          a.x += 290 * dt;
          a.y += (390 - a.y) * 2.5 * dt;
          if (a.x > 1135) a.alpha = Math.max(0, a.alpha - dt * 3.5);
        }
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 310 * dt;
        p.life -= dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
      for (let i = this.floaters.length - 1; i >= 0; i--) {
        const f = this.floaters[i];
        f.y -= 40 * dt;
        f.life -= dt;
        if (f.life <= 0) this.floaters.splice(i, 1);
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.save();
      ctx.imageSmoothingEnabled = false;

      if (this.shakeTime > 0) {
        ctx.translate(
          Math.round((Math.random() - 0.5) * this.shakeAmp * 2),
          Math.round((Math.random() - 0.5) * this.shakeAmp * 2)
        );
      }

      this.drawHD2DArchitecture(ctx);
      this.drawGothicWindows(ctx);
      this.drawVolumetricMoonlight(ctx);
      this.drawFireplace(ctx);
      this.drawBackgroundTables(ctx);
      this.drawFloorAndRunway(ctx);
      this.drawActors(ctx);
      this.drawDustAndParticles(ctx);
      this.drawSubtleScanlines(ctx);

      ctx.restore();
    }

    drawHD2DArchitecture(ctx) {
      // Deep obsidian-midnight navy-plum atmospheric backdrop
      const bg = ctx.createLinearGradient(0, 0, 0, 368);
      bg.addColorStop(0, '#070914');
      bg.addColorStop(0.5, '#0e1124');
      bg.addColorStop(1, '#15122b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, STAGE_W, 368);

      // Subtle architectural stone grid (delicate, high-end, never loud)
      ctx.fillStyle = 'rgba(130, 160, 220, 0.032)';
      for (let y = 64; y < 300; y += 24) {
        ctx.fillRect(0, y, STAGE_W, 1);
      }
      for (let row = 0; row < 10; row++) {
        const off = (row % 2) * 38;
        for (let x = off; x < 920; x += 76) {
          if ((row * 3 + x) % 5 === 0) {
            ctx.fillStyle = 'rgba(160, 140, 255, 0.025)';
            ctx.fillRect(x + 2, 66 + row * 24, 72, 20);
          }
        }
      }

      // Sleek dark wainscot paneling with thin brass trim
      ctx.fillStyle = '#110d20';
      ctx.fillRect(0, 296, STAGE_W, 72);
      ctx.fillStyle = 'rgba(245, 203, 92, 0.28)';
      ctx.fillRect(0, 296, STAGE_W, 1);
      ctx.fillStyle = 'rgba(77, 232, 232, 0.14)';
      ctx.fillRect(0, 299, STAGE_W, 1);

      // Timber pillars with subtle specular highlight
      for (const px of [172, 468, 848]) {
        ctx.fillStyle = '#090916';
        ctx.fillRect(px, 0, 26, 368);
        ctx.fillStyle = '#18152e';
        ctx.fillRect(px + 3, 0, 18, 368);
        ctx.fillStyle = 'rgba(245, 203, 92, 0.16)';
        ctx.fillRect(px + 4, 0, 1, 368);
      }

      // Illuminated Liquor Back-Shelf (between the two gothic windows)
      const sx = 412, sy = 188;
      ctx.fillStyle = '#0c0a18';
      ctx.fillRect(sx - 6, sy - 10, 114, 96);
      ctx.strokeStyle = 'rgba(245, 203, 92, 0.32)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 5.5, sy - 9.5, 113, 95);

      const bottles = ['#ff595e', '#4de8a8', '#ffd166', '#56cfe1', '#c77dff', '#ff8c42', '#4de8e8'];
      for (let row = 0; row < 2; row++) {
        const by = sy + 28 + row * 38;
        ctx.fillStyle = '#2d1c33';
        ctx.fillRect(sx, by, 102, 4);
        ctx.fillStyle = 'rgba(245, 203, 92, 0.35)';
        ctx.fillRect(sx, by, 102, 1);
        for (let i = 0; i < 7; i++) {
          const bx = sx + 6 + i * 13;
          const col = bottles[(i + row * 3) % bottles.length];
          ctx.fillStyle = col;
          ctx.fillRect(bx, by - 16, 7, 15);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(bx + 1, by - 14, 2, 7);
          ctx.fillStyle = col;
          ctx.fillRect(bx + 2, by - 20, 3, 4);
        }
      }

      // VIP Tapestry Banners when upgraded
      if (this.upgrades.has('vip_booth')) {
        for (const bx of [205, 792]) {
          ctx.fillStyle = '#2d1042';
          ctx.fillRect(bx, 74, 34, 108);
          ctx.strokeStyle = '#f5cb5c';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx + 2.5, 76.5, 29, 103);
          ctx.fillStyle = '#f5cb5c';
          ctx.fillRect(bx + 15, 108, 4, 24);
          ctx.fillRect(bx + 9, 116, 16, 4);
        }
      }
    }

    drawGothicWindows(ctx) {
      for (const wx of [254, 578]) {
        const wy = 98, ww = 128, wh = 166;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(wx, wy + wh);
        ctx.lineTo(wx, wy + 52);
        ctx.arc(wx + ww / 2, wy + 52, ww / 2, Math.PI, 0, false);
        ctx.lineTo(wx + ww, wy + wh);
        ctx.closePath();
        ctx.clip();

        const sky = ctx.createLinearGradient(wx, wy, wx, wy + wh);
        sky.addColorStop(0, '#070d24');
        sky.addColorStop(0.65, '#132048');
        sky.addColorStop(1, '#1e2c5c');
        ctx.fillStyle = sky;
        ctx.fillRect(wx, wy, ww, wh);

        // Luminous crescent moon & stars
        if (wx === 254) {
          const mg = ctx.createRadialGradient(wx + 88, wy + 46, 4, wx + 88, wy + 46, 44);
          mg.addColorStop(0, 'rgba(180, 215, 255, 0.35)');
          mg.addColorStop(1, 'rgba(180, 215, 255, 0)');
          ctx.fillStyle = mg;
          ctx.fillRect(wx + 36, wy, 92, 92);
          ctx.fillStyle = '#e6f0ff';
          ctx.beginPath();
          ctx.arc(wx + 88, wy + 46, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0c1534';
          ctx.beginPath();
          ctx.arc(wx + 94, wy + 42, 13, 0, Math.PI * 2);
          ctx.fill();
        }

        if (this.lightningAlpha > 0) {
          ctx.fillStyle = `rgba(180, 210, 255, ${this.lightningAlpha * 0.4})`;
          ctx.fillRect(wx, wy, ww, wh);
        }

        // Fine silver rain streaks
        ctx.strokeStyle = 'rgba(155, 210, 255, 0.36)';
        ctx.lineWidth = 1.2;
        for (const r of this.rain) {
          const rx = wx + (r.x % ww);
          const ry = wy + (r.y % wh);
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 3, ry + r.len);
          ctx.stroke();
        }
        ctx.restore();

        // Thin gothic tracery frame
        ctx.strokeStyle = '#2d3559';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(wx, wy + wh);
        ctx.lineTo(wx, wy + 52);
        ctx.arc(wx + ww / 2, wy + 52, ww / 2, Math.PI, 0, false);
        ctx.lineTo(wx + ww, wy + wh);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = '#14172e';
        ctx.fillRect(wx + ww / 2 - 2, wy + 4, 4, wh - 4);
        ctx.fillRect(wx + 2, wy + 96, ww - 4, 3);
        ctx.fillStyle = 'rgba(125, 210, 255, 0.28)';
        ctx.fillRect(wx - 4, wy + wh, ww + 8, 2);
      }
    }

    drawVolumetricMoonlight(ctx) {
      // Soft diagonal HD-2D moonlight beams across the tavern floor
      for (const wx of [254, 578]) {
        const beam = ctx.createLinearGradient(wx + 60, 160, wx - 40, 560);
        beam.addColorStop(0, 'rgba(110, 185, 255, 0.11)');
        beam.addColorStop(0.6, 'rgba(110, 185, 255, 0.035)');
        beam.addColorStop(1, 'rgba(110, 185, 255, 0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(wx + 8, 264);
        ctx.lineTo(wx + 120, 264);
        ctx.lineTo(wx + 40, 580);
        ctx.lineTo(wx - 90, 580);
        ctx.closePath();
        ctx.fill();
      }
    }

    drawFireplace(ctx) {
      const fx = 28, fy = 196, fw = 122, fh = 172;
      const upgraded = this.upgrades.has('hearth');
      const fl = Math.sin(this.time * 13) * 3.5 + Math.cos(this.time * 7) * 2.5;

      // Stone hearth frame
      ctx.fillStyle = '#131024';
      ctx.fillRect(fx, fy, fw, fh);
      ctx.strokeStyle = 'rgba(245, 203, 92, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);
      ctx.fillStyle = '#201a38';
      ctx.fillRect(fx - 8, fy - 8, fw + 16, 12);
      ctx.fillStyle = 'rgba(245, 203, 92, 0.4)';
      ctx.fillRect(fx - 8, fy - 8, fw + 16, 1);

      // Cavity
      ctx.fillStyle = '#07050f';
      ctx.fillRect(fx + 20, fy + 52, fw - 40, fh - 52);

      // Glowing logs
      ctx.fillStyle = '#3b1d14';
      ctx.fillRect(fx + 30, fy + 148, 62, 12);
      ctx.fillStyle = '#ff7b29';
      ctx.fillRect(fx + 38, fy + 150, 44, 4);

      // Crisp pixel-layered flame + soft bloom
      const outer = upgraded ? '#b53bff' : '#ff511a';
      const mid = upgraded ? '#ff79c6' : '#ffa62b';
      ctx.fillStyle = outer;
      ctx.fillRect(fx + 36, fy + 104 + fl * 0.4, 50, 44 - fl * 0.4);
      ctx.fillRect(fx + 46, fy + 86 + fl, 30, 22);
      ctx.fillStyle = mid;
      ctx.fillRect(fx + 44, fy + 114 - fl * 0.3, 34, 34 + fl * 0.3);
      ctx.fillRect(fx + 52, fy + 98 + fl * 0.5, 18, 18);
      ctx.fillStyle = '#fff4c2';
      ctx.fillRect(fx + 52, fy + 126, 18, 20);

      // Volumetric warm amber hearth bloom washing onto the floor & left mercenaries
      const glow = ctx.createRadialGradient(fx + 62, fy + 140, 14, fx + 62, fy + 152, 290 + fl * 4);
      glow.addColorStop(0, upgraded ? 'rgba(204, 102, 255, 0.38)' : 'rgba(255, 138, 43, 0.36)');
      glow.addColorStop(0.45, upgraded ? 'rgba(155, 70, 255, 0.12)' : 'rgba(255, 96, 24, 0.11)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 100, 420, 420);

      // Rising pixel embers
      for (const e of this.embers) {
        ctx.fillStyle = upgraded ? '#f0a6ff' : '#ffd166';
        ctx.globalAlpha = Math.max(0, Math.min(1, e.life));
        ctx.fillRect(Math.round(e.x), Math.round(e.y), 3, 3);
      }
      ctx.globalAlpha = 1;
    }

    drawBackgroundTables(ctx) {
      // Tables sit cleanly along the back wainscot wall (y=346) so they enrich the tavern
      // WITHOUT ever colliding with the mercenaries or their nameplates!
      for (const tx of [305, 625]) {
        ctx.fillStyle = 'rgba(4, 3, 10, 0.65)';
        ctx.fillRect(tx - 54, 360, 108, 10);
        ctx.fillStyle = '#241421';
        ctx.fillRect(tx - 48, 336, 96, 16);
        ctx.fillStyle = '#47272e';
        ctx.fillRect(tx - 50, 330, 100, 8);
        ctx.fillStyle = 'rgba(245, 203, 92, 0.35)';
        ctx.fillRect(tx - 50, 330, 100, 1);

        // Flickering candle + warm micro bloom
        const fl = Math.sin(this.time * 12 + tx) * 1.2;
        ctx.fillStyle = '#f5eedc';
        ctx.fillRect(tx - 3, 320, 6, 10);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(tx - 2, 314 + fl, 4, 6);
        const cg = ctx.createRadialGradient(tx, 318, 2, tx, 318, 42);
        cg.addColorStop(0, 'rgba(255, 200, 90, 0.32)');
        cg.addColorStop(1, 'rgba(255, 200, 90, 0)');
        ctx.fillStyle = cg;
        ctx.fillRect(tx - 42, 276, 84, 84);

        // Two mug silhouettes
        ctx.fillStyle = '#a87038';
        ctx.fillRect(tx + 20, 321, 8, 9);
        ctx.fillStyle = '#fff5df';
        ctx.fillRect(tx + 20, 319, 8, 2);
      }
    }

    drawFloorAndRunway(ctx) {
      // Deep atmospheric oak stage floor
      const floor = ctx.createLinearGradient(0, 368, 0, STAGE_H);
      floor.addColorStop(0, '#131024');
      floor.addColorStop(0.45, '#19142c');
      floor.addColorStop(1, '#090714');
      ctx.fillStyle = floor;
      ctx.fillRect(0, 368, STAGE_W, STAGE_H - 368);

      // Subtle floor plank hairlines
      ctx.fillStyle = 'rgba(255, 230, 180, 0.045)';
      for (let y = 396; y < STAGE_H; y += 32) {
        ctx.fillRect(0, y, STAGE_W, 1);
      }

      // Luminous obsidian-gold carpet runway framing the mercenary promenade
      ctx.fillStyle = 'rgba(56, 18, 58, 0.42)';
      ctx.fillRect(156, 412, 686, 174);
      ctx.strokeStyle = 'rgba(245, 203, 92, 0.32)';
      ctx.lineWidth = 1;
      ctx.strokeRect(156.5, 412.5, 685, 173);
      ctx.strokeStyle = 'rgba(77, 232, 232, 0.14)';
      ctx.strokeRect(162.5, 418.5, 673, 161);
    }

    drawActors(ctx) {
      const { sprites } = window.MT;
      const sorted = [...this.actors].sort((a, b) => a.y - b.y);

      const hasFocus = Boolean(this.selectedMercId);

      // Expanding tap ripple rings on the floor
      for (const rp of this.ripples) {
        const p = rp.life / rp.maxLife;
        ctx.save();
        ctx.strokeStyle = rp.color;
        ctx.globalAlpha = p * 0.9;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.34, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      for (const a of sorted) {
        const isSelected = this.selectedMercId === a.merc.id;
        const isSynergyPeer = !isSelected && this.synergyHighlightIds.has(a.merc.id);
        const isDrinkTarget = this.dragTargetMercId === a.merc.id;
        const isDrinkReady = Boolean(this.drinkReadyColor) && !a.marching;
        const bob = a.lifted ? Math.round(Math.sin(this.time * 16) * 4) : 0;
        const pop = a.tapPop || 0;

        // Soft dramatic ground spotlight beneath every mercenary (HD-2D look!)
        const spotCol = isDrinkTarget
          ? (this.dragDrinkColor || '#4de8a8')
          : isSelected
            ? '#4de8e8'
            : isSynergyPeer
              ? '#f5c249'
              : isDrinkReady
                ? this.drinkReadyColor
                : a.assigned
                  ? '#f5c249'
                  : a.merc.drinkBuff
                    ? a.merc.drinkBuff.color
                    : '#7a52b8';

        const spotR = isSelected || isDrinkTarget ? 58 : isDrinkReady || isSynergyPeer ? 46 : 36;
        const sg = ctx.createRadialGradient(a.x, a.y + 2, 4, a.x, a.y + 2, spotR);
        sg.addColorStop(0, `${spotCol}${isSelected || isDrinkTarget ? '66' : '40'}`);
        sg.addColorStop(1, `${spotCol}00`);
        ctx.fillStyle = sg;
        ctx.fillRect(a.x - 62, a.y - 26, 124, 56);

        // Crisp elliptical shadow
        ctx.fillStyle = 'rgba(4, 3, 12, 0.65)';
        ctx.beginPath();
        ctx.ellipse(a.x, a.y + 3, 28, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing ground target ring when user tapped a drink (shows every valid tap target!)
        if (isDrinkReady && !isDrinkTarget) {
          const pulse = 32 + Math.sin(this.time * 7 + a.phase) * 4;
          ctx.save();
          ctx.strokeStyle = this.drinkReadyColor;
          ctx.globalAlpha = 0.72;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(a.x, a.y + 3, pulse, pulse * 0.34, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Luminous corner-bracket lock-on reticle ONLY on TAP-SELECTED, SYNERGY PEER, ASSIGNED, or DRAG-TARGET (zero mouse hover!)
        if ((isSelected || isSynergyPeer || isDrinkTarget || a.assigned) && !a.marching) {
          const pad = isSelected ? Math.sin(this.time * 6) * 2.5 : 0;
          this.drawCornerBrackets(
            ctx,
            a.x - 43 - pad,
            a.y - 104 - pad,
            86 + pad * 2,
            112 + pad * 2,
            spotCol,
            isSelected || isDrinkTarget ? 2.5 : 1.5
          );
        }

        // Focus dimming: when one merc is tapped, dim unrelated mercs slightly so tapped merc + synergy peers pop!
        let unitAlpha = a.alpha;
        if (a.lifted) unitAlpha = 0.22;
        else if (a.assigned && !a.marching) unitAlpha = 0.52;
        else if (hasFocus && !isSelected && !isSynergyPeer && !isDrinkReady) unitAlpha = 0.62;

        // Draw crisp Duelyst animated sprite with tactile tap squash-and-stretch bounce
        const anim = a.lifted || isSelected || isDrinkTarget ? 'selected' : a.anim;
        sprites.drawUnit(ctx, a.merc.unitId, anim, this.time + a.phase, a.x, a.y + bob - (a.lifted ? 16 : 0) - Math.round(pop * 10), {
          scale: isSelected || isDrinkTarget ? 1.54 : 1.44,
          flipX: a.facing < 0,
          alpha: unitAlpha,
          outlineColor: isDrinkTarget ? (this.dragDrinkColor || '#4de8e8') : isSelected ? '#4de8e8' : isSynergyPeer ? '#f5c249' : null,
          squashX: a.lifted ? 0.92 : 1 - pop * 0.1,
          squashY: a.lifted ? 1.08 : 1 + pop * 0.14
        });

        // Synergy badge above matching teammates when a merc is tapped!
        if (isSynergyPeer && !a.marching && !a.assigned) {
          ctx.fillStyle = 'rgba(245, 194, 73, 0.94)';
          ctx.fillRect(Math.round(a.x - 24), Math.round(a.y - 118), 48, 16);
          ctx.fillStyle = '#120a18';
          ctx.font = 'bold 10px "Noto Sans SC", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('可凑羁绊', Math.round(a.x), Math.round(a.y - 106));
        }

        // Sleek HD-2D translucent obsidian nameplate + mini segmented power bar (NEVER obstructed!)
        if (!a.marching && a.alpha > 0.3) {
          const nameTxt = a.merc.name;
          const pwr = a.merc.effectivePower ?? a.merc.power;
          ctx.font = 'bold 12px "Noto Sans SC", monospace';
          const nw = Math.max(88, Math.ceil(ctx.measureText(nameTxt).width) + 44);
          const lx = Math.round(a.x - nw / 2);
          const ly = Math.round(a.y + 11);

          ctx.fillStyle = 'rgba(9, 11, 24, 0.88)';
          ctx.fillRect(lx, ly, nw, 24);
          ctx.strokeStyle = a.assigned ? '#f5cb5c' : a.merc.drinkBuff ? a.merc.drinkBuff.color : 'rgba(130, 175, 255, 0.38)';
          ctx.lineWidth = 1;
          ctx.strokeRect(lx + 0.5, ly + 0.5, nw - 1, 23);

          // Name left, power right
          ctx.fillStyle = a.assigned ? '#ffe79e' : '#f2f5ff';
          ctx.textAlign = 'left';
          ctx.fillText(nameTxt, lx + 6, ly + 13);

          ctx.fillStyle = a.merc.drinkBuff ? a.merc.drinkBuff.glow : '#f5cb5c';
          ctx.textAlign = 'right';
          ctx.fillText(`${pwr}`, lx + nw - 6, ly + 13);

          // Tiny 6-cell segmented glowing power bar (Image 1 signature detail!)
          const litCells = Math.max(1, Math.min(6, Math.round(pwr / 10)));
          const cellW = Math.floor((nw - 16) / 6);
          for (let c = 0; c < 6; c++) {
            ctx.fillStyle = c < litCells
              ? (a.merc.drinkBuff ? a.merc.drinkBuff.glow : '#4de8e8')
              : 'rgba(120, 140, 180, 0.22)';
            ctx.fillRect(lx + 6 + c * (cellW + 1), ly + 18, cellW - 1, 3);
          }

          if (a.assigned) {
            ctx.fillStyle = 'rgba(245, 203, 92, 0.95)';
            ctx.fillRect(Math.round(a.x - 24), Math.round(a.y - 118), 48, 16);
            ctx.fillStyle = '#120a18';
            ctx.font = 'bold 10px "Noto Sans SC", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('已入队', Math.round(a.x), Math.round(a.y - 106));
          }
        }
      }

      // Speech bubbles on top
      for (const a of sorted) {
        if (a.bubble && a.bubbleTimer > 0 && a.alpha > 0.3) {
          this.drawSleekBubble(ctx, a.x, a.y - 122, a.bubble);
        }
      }
    }

    drawCornerBrackets(ctx, x, y, w, h, color, lw = 2) {
      const len = 12;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      // Top-left
      ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
      // Top-right
      ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
      // Bottom-left
      ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h);
      // Bottom-right
      ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
      ctx.stroke();
      ctx.restore();
    }

    drawSleekBubble(ctx, x, y, text) {
      ctx.save();
      ctx.font = '12px "Noto Sans SC", monospace';
      const maxW = 204;
      const lines = [];
      let cur = '';
      for (const ch of text) {
        if (ctx.measureText(cur + ch).width > maxW - 20) {
          lines.push(cur);
          cur = ch;
        } else cur += ch;
      }
      if (cur) lines.push(cur);

      const bw = Math.min(maxW, Math.max(82, Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width))) + 20));
      const bh = lines.length * 16 + 12;
      const bx = Math.max(16, Math.min(872 - bw, Math.round(x - bw / 2)));
      const by = Math.max(76, Math.round(y - bh));

      ctx.fillStyle = 'rgba(11, 14, 30, 0.92)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = 'rgba(77, 232, 232, 0.65)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      // Tiny glowing corner ticks
      ctx.fillStyle = '#4de8e8';
      ctx.fillRect(bx, by, 4, 2);
      ctx.fillRect(bx + bw - 4, by, 4, 2);
      ctx.fillRect(Math.round(x) - 3, by + bh, 6, 4);

      ctx.fillStyle = '#e8f4ff';
      ctx.textAlign = 'left';
      lines.forEach((line, idx) => {
        ctx.fillText(line, bx + 10, by + 16 + idx * 16);
      });
      ctx.restore();
    }

    drawDustAndParticles(ctx) {
      for (const d of this.dust) {
        const a = 0.16 + 0.2 * Math.sin(this.time * 2.2 + d.phase);
        ctx.fillStyle = `rgba(255, 224, 148, ${a})`;
        ctx.fillRect(Math.round(d.x), Math.round(d.y), Math.round(d.r), Math.round(d.r));
      }

      for (const p of this.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;

      for (const f of this.floaters) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.life * 1.4);
        ctx.font = 'bold 15px "Noto Sans SC", monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
        ctx.restore();
      }
    }

    drawSubtleScanlines(ctx) {
      // Very fine Image-1 CRT horizontal scanline texture (3.5% opacity)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      for (let y = 0; y < STAGE_H; y += 3) {
        ctx.fillRect(0, y, STAGE_W, 1);
      }
    }
  }

  window.MT.STAGE_W = STAGE_W;
  window.MT.STAGE_H = STAGE_H;
  window.MT.TavernCanvas = TavernCanvas;
})();
