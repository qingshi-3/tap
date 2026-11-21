// Live Animated Midnight Expedition Battle Theater (classic script, pixel-crisp 16-bit style)
(function () {
  window.MT = window.MT || {};

  class BattleTheater {
    constructor(canvas, logContainer) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.canvas.width = 840;
      this.canvas.height = 310;
      this.logContainer = logContainer;
      this.rafId = null;
      this.active = false;
      this.speed = 1;
    }

    setSpeed(mult) {
      this.speed = mult;
    }

    play({ squad, contract, outcome, beats, onDone }) {
      const { sprites, sfx } = window.MT;
      this.stop();
      this.active = true;
      this.logContainer.innerHTML = '';

      const heroes = squad.map((m, i) => ({
        merc: m,
        x: 155 + i * 74,
        homeX: 155 + i * 74,
        y: 238 + (i % 2 === 0 ? -14 : 14),
        anim: 'idle',
        animElapsed: 0,
        flash: 0
      }));

      const boss = {
        unitId: contract.bossUnitId,
        name: contract.bossName,
        x: 645,
        homeX: 645,
        y: 244,
        hp: 100,
        targetHp: 100,
        anim: 'idle',
        animElapsed: 0,
        flash: 0
      };

      const particles = [];
      const popups = [];
      let shake = 0;
      let time = 0;
      let beatIdx = 0;
      let beatTimer = 0.4;
      let finished = false;
      let finishDelay = 0.85;
      let lastTs = 0;

      const spawnBurst = (x, y, color, count = 20) => {
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 60 + Math.random() * 190;
          particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 50, life: 0.52, color, size: 4 });
        }
      };

      const triggerBeat = (beat) => {
        const row = document.createElement('div');
        row.className = `bt-log-item bt-${beat.kind || 'hit'}`;
        row.textContent = beat.text;
        this.logContainer.appendChild(row);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;

        if (beat.actor === 'hero') {
          const h = heroes[beat.heroIndex % heroes.length];
          h.anim = 'attack';
          h.animElapsed = 0;
          h.x = boss.x - 145;
          boss.anim = 'hit';
          boss.animElapsed = 0;
          boss.flash = 0.25;
          boss.targetHp = Math.max(outcome.victory ? 0 : 14, boss.targetHp - beat.dmgPct);
          shake = beat.crit ? 12 : 6;
          if (beat.crit) sfx.playCrit();
          else sfx.playSlash();
          spawnBurst(boss.x - 20, boss.y - 60, beat.crit ? '#ffd166' : '#c77dff', beat.crit ? 28 : 16);
          popups.push({
            x: boss.x + (Math.random() - 0.5) * 30,
            y: boss.y - 125,
            text: beat.popup || `-${beat.dmgPct}%`,
            color: beat.crit ? '#ffd166' : '#ff7b7b',
            life: 1.2
          });
        } else if (beat.actor === 'boss') {
          boss.anim = 'attack';
          boss.animElapsed = 0;
          boss.x = 460;
          const target = heroes[beat.heroIndex % heroes.length];
          target.anim = 'hit';
          target.animElapsed = 0;
          target.flash = 0.28;
          shake = 9;
          sfx.playHit();
          spawnBurst(target.x + 12, target.y - 52, '#ff4d6d', 18);
          popups.push({
            x: target.x,
            y: target.y - 110,
            text: beat.popup || '重击!',
            color: '#ff595e',
            life: 1.2
          });
        } else {
          sfx.playSynergy();
          const h = heroes[0];
          spawnBurst(h.x + 40, h.y - 70, '#5ef2c0', 22);
          popups.push({ x: 420, y: 120, text: beat.popup || '奇遇触发!', color: '#5ef2c0', life: 1.3 });
        }
      };

      const tick = (ts) => {
        if (!this.active) return;
        if (!lastTs) lastTs = ts;
        const dt = Math.min(0.05, (ts - lastTs) / 1000) * this.speed;
        lastTs = ts;
        time += dt;

        if (shake > 0) shake = Math.max(0, shake - dt * 28);
        boss.hp += (boss.targetHp - boss.hp) * Math.min(1, dt * 8);

        for (const h of heroes) {
          h.x += (h.homeX - h.x) * Math.min(1, dt * 5.2);
          if (h.flash > 0) h.flash = Math.max(0, h.flash - dt);
          if (h.anim !== 'idle') {
            h.animElapsed += dt;
            if (h.animElapsed > 0.72) h.anim = 'idle';
          }
        }
        boss.x += (boss.homeX - boss.x) * Math.min(1, dt * 4.5);
        if (boss.flash > 0) boss.flash = Math.max(0, boss.flash - dt);
        if (boss.anim !== 'idle') {
          boss.animElapsed += dt;
          if (boss.animElapsed > 0.78) boss.anim = 'idle';
        }

        if (!finished) {
          beatTimer -= dt;
          if (beatTimer <= 0) {
            if (beatIdx < beats.length) {
              triggerBeat(beats[beatIdx]);
              beatIdx++;
              beatTimer = 1.05;
            } else {
              finished = true;
            }
          }
        } else {
          finishDelay -= dt;
          if (finishDelay <= 0) {
            this.active = false;
            if (onDone) onDone();
            return;
          }
        }

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 320 * dt;
          p.life -= dt;
          if (p.life <= 0) particles.splice(i, 1);
        }
        for (let i = popups.length - 1; i >= 0; i--) {
          const u = popups[i];
          u.y -= 42 * dt;
          u.life -= dt;
          if (u.life <= 0) popups.splice(i, 1);
        }

        const ctx = this.ctx;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (shake > 0) {
          ctx.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake * 2));
        }

        // Stepped 16-bit pixel sky bands
        const bands = ['#0c0719', '#140c29', '#1e123b', '#2a184c'];
        bands.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect(0, i * 54, 840, 56);
        });

        // Pixelated Blood/Violet Moon
        const moonCol = contract.tier >= 3 ? '#ff5978' : '#d8c2ff';
        ctx.fillStyle = contract.tier >= 3 ? '#4a1530' : '#32205c';
        ctx.fillRect(380, 44, 80, 80);
        ctx.fillStyle = moonCol;
        ctx.fillRect(392, 56, 56, 56);

        // Pixel ruins & stone floor
        ctx.fillStyle = '#120a21';
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(32 + i * 144, 108, 28, 108);
          ctx.fillRect(24 + i * 144, 104, 44, 8);
        }
        ctx.fillStyle = '#1d1233';
        ctx.fillRect(0, 214, 840, 96);
        ctx.fillStyle = '#53357a';
        ctx.fillRect(0, 214, 840, 4);
        ctx.fillStyle = '#2d1c4a';
        for (let x = 0; x < 840; x += 48) {
          ctx.fillRect(x, 226, 40, 12);
          ctx.fillRect(x + 24, 248, 40, 14);
        }

        // Boss Pixel HP Bar
        ctx.fillStyle = '#12081f';
        ctx.fillRect(508, 16, 308, 36);
        ctx.fillStyle = '#ff4d6d';
        ctx.fillRect(508, 16, 308, 2);
        ctx.fillRect(508, 50, 308, 2);
        ctx.fillRect(508, 16, 2, 36);
        ctx.fillRect(814, 16, 2, 36);
        ctx.fillStyle = '#3b1224';
        ctx.fillRect(516, 36, 292, 10);
        ctx.fillStyle = '#ff4d6d';
        ctx.fillRect(516, 36, Math.round(292 * Math.max(0, boss.hp) / 100), 10);
        ctx.fillStyle = '#ffe5ec';
        ctx.font = 'bold 12px "Noto Sans SC", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`BOSS · ${boss.name}`, 518, 31);

        // Heroes
        for (const h of heroes) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(Math.round(h.x - 24), Math.round(h.y + 2), 48, 8);
          sprites.drawUnit(ctx, h.merc.unitId, h.anim, time, h.x, h.y, {
            scale: 1.5,
            flipX: false,
            outlineColor: h.flash > 0 ? '#ff4d6d' : (h.merc.drinkBuff ? h.merc.drinkBuff.color : null),
            elapsedOverride: h.anim === 'idle' ? null : h.animElapsed,
            loop: h.anim === 'idle'
          });
        }

        // Boss
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(Math.round(boss.x - 42), Math.round(boss.y + 4), 84, 12);
        sprites.drawUnit(ctx, boss.unitId, boss.anim, time, boss.x, boss.y, {
          scale: 1.95,
          flipX: true,
          alpha: outcome.victory && boss.hp < 2 ? 0.25 : 1,
          outlineColor: boss.flash > 0 ? '#ffffff' : '#ff4d6d',
          elapsedOverride: boss.anim === 'idle' ? null : boss.animElapsed,
          loop: boss.anim === 'idle'
        });

        for (const p of particles) {
          ctx.globalAlpha = Math.max(0, p.life / 0.52);
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(p.x / 4) * 4, Math.round(p.y / 4) * 4, 4, 4);
        }
        ctx.globalAlpha = 1;
        for (const u of popups) {
          ctx.font = 'bold 20px "Noto Sans SC", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#12081c';
          ctx.fillText(u.text, Math.round(u.x) + 2, Math.round(u.y) + 2);
          ctx.fillStyle = u.color;
          ctx.fillText(u.text, Math.round(u.x), Math.round(u.y));
        }

        ctx.restore();
        this.rafId = requestAnimationFrame(tick);
      };

      this.rafId = requestAnimationFrame(tick);
    }

    stop() {
      this.active = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
  }

  window.MT.BattleTheater = BattleTheater;
})();
