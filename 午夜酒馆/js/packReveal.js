/* PackReveal — booster opening with the "flip each card yourself" rhythm.
 *
 *   sealed pack ──tap──▶ charge (0.55s, light leaks in the best rarity's colour)
 *        ──▶ burst (flash, shake, particles) ──▶ cards fly out face-down
 *        ──▶ each back glows in its rarity colour; hovering makes it hum
 *        ──▶ tap a card: flip. S = gold burst, SSS = everything else dims,
 *            the card charges, flips, slams a stamp, screen shakes hard
 *        ──▶ when all are face-up, pick one.
 *
 * Owns its own overlay (#pr-root) and particle canvas on the 1280×720 stage.
 * Callers pass ready-made front HTML; the module never touches game state.
 */
(function () {
  window.MT = window.MT || {};

  const W = 1280;
  const H = 720;
  const CARD_W = 188;
  const CARD_H = 262;
  const CARD_TOP = 214;
  const PACK_CX = W / 2;
  const PACK_CY = 372;

  const TIER = {
    C:   { rank: 0, col: '#c4ccde', rgb: [196, 204, 222] },
    B:   { rank: 1, col: '#79d2ff', rgb: [121, 210, 255] },
    A:   { rank: 2, col: '#c99cff', rgb: [201, 156, 255] },
    S:   { rank: 3, col: '#ffd36b', rgb: [255, 211, 107] },
    SSS: { rank: 4, col: '#ff6b8b', rgb: [255, 107, 139] }
  };
  const tierOf = (t) => TIER[t] || TIER.B;

  class PackReveal {
    constructor(stage, audio, sprites) {
      this.stage = stage;
      this.audio = audio || null;
      this.sprites = sprites || null;
      this.root = null;
      this.cv = null;
      this.ctx = null;
      this.parts = [];
      this.rings = [];
      this.raf = 0;
      this.last = 0;
      this.opts = null;
      this.phase = 'idle';
      this.flipped = [];
      this.busy = false;
      this.reduced = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    // ─── public ────────────────────────────────────────────────────────
    open(opts) {
      this._ensureRoot();
      this.opts = opts;
      this.flipped = opts.cards.map(() => false);
      this.busy = false;
      this.parts = [];
      this.rings = [];
      const root = this.root;
      root.className = `pr-root kind-${opts.kind || 'hero'}`;
      root.classList.remove('hidden');
      const best = opts.cards.reduce((m, c) => (tierOf(c.tier).rank > tierOf(m).rank ? c.tier : m), 'C');
      this.best = best;
      root.style.setProperty('--best', tierOf(best).col);

      this.$('.pr-title b').textContent = opts.title || '';
      this.$('.pr-title span').textContent = opts.subtitle || '';
      this._renderCards();
      this._renderFoot();
      this._loop();

      if (opts.skipSeal) {
        this.$('.pr-pack').classList.add('gone');
        this._burst(true);
      } else {
        this._showPack();
      }
    }

    hide() {
      if (this.root) this.root.classList.add('hidden');
    }

    show() {
      if (!this.root || !this.opts) return;
      this.root.classList.remove('hidden');
      this.root.classList.remove('picking-out');
      this.root.querySelectorAll('.pr-card').forEach((c) => c.classList.remove('chosen', 'dropped'));
      this.busy = false;
      this._loop();
    }

    close() {
      if (!this.root) return;
      this.root.classList.add('hidden');
      this.opts = null;
      this.phase = 'idle';
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      if (this.ctx) this.ctx.clearRect(0, 0, W, H);
    }

    // ─── DOM ───────────────────────────────────────────────────────────
    $(sel) { return this.root.querySelector(sel); }

    _ensureRoot() {
      if (this.root) return;
      const root = document.createElement('div');
      root.id = 'pr-root';
      root.className = 'pr-root hidden';
      root.innerHTML = `
        <div class="pr-dim"></div>
        <div class="pr-shake">
          <div class="pr-rays" aria-hidden="true"></div>
          <div class="pr-title"><b></b><span></span></div>
          <button type="button" class="pr-pack" aria-label="开包">
            <span class="pr-pack-leak" aria-hidden="true"></span>
            <span class="pr-pack-foil">
              <i class="pr-crimp top"></i>
              <span class="pr-pack-face">
                <span class="pr-pack-count"></span>
                <span class="pr-pack-emblem"><i></i><i></i><i></i><b></b></span>
                <span class="pr-pack-name"></span>
              </span>
              <i class="pr-pack-sheen"></i>
              <i class="pr-crimp bottom"></i>
            </span>
          </button>
          <div class="pr-cards"></div>
          <canvas class="pr-fx" width="${W}" height="${H}" aria-hidden="true"></canvas>
          <div class="pr-hint"></div>
          <div class="pr-foot"></div>
        </div>
        <div class="pr-flash" aria-hidden="true"></div>
      `;
      this.stage.appendChild(root);
      this.root = root;
      this.cv = root.querySelector('.pr-fx');
      this.ctx = this.cv.getContext('2d');
      root.querySelector('.pr-pack').onclick = () => this._tearPack();
    }

    _renderCards() {
      const { cards } = this.opts;
      const n = cards.length;
      const gap = n >= 4 ? 30 : 44;
      const total = n * CARD_W + (n - 1) * gap;
      const x0 = (W - total) / 2;
      const wrap = this.$('.pr-cards');
      wrap.innerHTML = cards.map((c, i) => {
        const x = Math.round(x0 + i * (CARD_W + gap));
        const dx = PACK_CX - (x + CARD_W / 2);
        const dy = PACK_CY - (CARD_TOP + CARD_H / 2);
        const rot = (i - (n - 1) / 2) * 9;
        return `
          <div class="pr-card tier-${c.tier} pr-in" data-i="${i}"
               style="left:${x}px;top:${CARD_TOP}px;--dx:${dx}px;--dy:${dy}px;--r0:${rot}deg;--tc:${tierOf(c.tier).col}">
            <div class="pr-card-glow" aria-hidden="true"></div>
            <div class="pr-card-rays" aria-hidden="true"></div>
            <div class="pr-inner">
              <div class="pr-back">
                <div class="pr-back-frame"><span class="pr-back-emblem">A</span></div>
              </div>
              <div class="pr-front">${c.frontHtml}</div>
            </div>
            <div class="pr-stamp" aria-hidden="true">${c.tier}</div>
          </div>
        `;
      }).join('');
      wrap.querySelectorAll('.pr-card').forEach((el) => {
        const i = Number(el.dataset.i);
        const c = cards[i];
        const sp = el.querySelector('[data-pr-unit]');
        if (sp && this.sprites && this.sprites.createDomSprite) {
          sp.appendChild(this.sprites.createDomSprite(sp.dataset.prUnit, 'idle', Number(sp.dataset.prSize) || 84));
        }
        el.onmouseenter = () => {
          if (!this.flipped[i] && this.phase === 'dealt') this._hoverHum(c.tier);
        };
        el.onclick = () => this._onCardClick(i);
      });
      // pack face text
      this.$('.pr-pack-count').textContent = `${n} 选 1`;
      this.$('.pr-pack-name').textContent = this.opts.title || '';
    }

    _renderFoot() {
      const foot = this.$('.pr-foot');
      const o = this.opts;
      foot.innerHTML = `
        <button type="button" class="pr-btn" data-act="all">全部翻开</button>
        ${o.reroll ? `<button type="button" class="pr-btn ad" data-act="reroll" ${o.reroll.left > 0 ? '' : 'disabled'}>${o.reroll.left > 0 ? `▶ 看广告重抽 (${o.reroll.left})` : '重抽已用完'}</button>` : ''}
        ${o.onAbandon ? `<button type="button" class="pr-btn ghost" data-act="abandon">${o.abandonLabel || '放弃本包'}</button>` : ''}
      `;
      foot.querySelector('[data-act="all"]').onclick = () => this._flipAll();
      const rr = foot.querySelector('[data-act="reroll"]');
      if (rr) rr.onclick = () => { if (!this.busy && o.reroll.onClick) o.reroll.onClick(); };
      const ab = foot.querySelector('[data-act="abandon"]');
      if (ab) ab.onclick = () => { if (!this.busy && o.onAbandon) o.onAbandon(); };
    }

    _setHint(text) {
      const h = this.$('.pr-hint');
      h.textContent = text;
      h.classList.remove('pop');
      void h.offsetWidth;
      h.classList.add('pop');
    }

    // ─── phases ────────────────────────────────────────────────────────
    _showPack() {
      this.phase = 'sealed';
      const pack = this.$('.pr-pack');
      pack.classList.remove('gone', 'charging', 'torn');
      pack.classList.add('drop');
      setTimeout(() => pack.classList.remove('drop'), 700);
      this._setHint('点击卡包撕开');
      this.root.classList.add('is-sealed');
    }

    _tearPack() {
      if (this.phase !== 'sealed') return;
      this.phase = 'charging';
      const pack = this.$('.pr-pack');
      pack.classList.add('charging');
      this._setHint('');
      this._sfxCharge();
      setTimeout(() => {
        pack.classList.remove('charging');
        pack.classList.add('torn');
        this._burst(false);
      }, this.reduced ? 80 : 560);
    }

    _burst(fromReroll) {
      this.phase = 'burst';
      this.root.classList.remove('is-sealed');
      this.root.classList.add('is-open');
      const bestRank = tierOf(this.best).rank;
      this._flash(bestRank >= 3 ? 0.9 : 0.6);
      this._shake(bestRank >= 4 ? 12 : bestRank >= 3 ? 8 : 5, 420);
      this._sfxTear(bestRank >= 3);
      const bestCol = tierOf(this.best).rgb;
      this._spray(PACK_CX, PACK_CY, 90 + bestRank * 30, [[255, 236, 190], bestCol], 520);
      this._ring(PACK_CX, PACK_CY, bestCol, 520);
      setTimeout(() => this.$('.pr-pack').classList.add('gone'), 420);
      // deal the cards out face-down
      const cards = [...this.root.querySelectorAll('.pr-card')];
      cards.forEach((el, i) => {
        setTimeout(() => {
          el.classList.remove('pr-in');
          el.classList.add('landing');
          setTimeout(() => {
            el.classList.remove('landing');
            this._sfxLand(i);
          }, 380);
        }, (fromReroll ? 60 : 160) + i * 95);
      });
      setTimeout(() => {
        this.phase = 'dealt';
        this.root.classList.add('is-dealt');
        this._setHint('逐张翻开卡牌');
      }, 220 + cards.length * 95 + 380);
    }

    _onCardClick(i) {
      if (this.phase === 'dealt' && !this.flipped[i] && !this.busy) {
        this._flip(i);
      } else if (this.phase === 'pick' && !this.busy) {
        this._pick(i);
      }
    }

    _flipAll() {
      if (this.phase !== 'dealt') return;
      const order = this.flipped.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0);
      // the rarest one goes last so the run ends on the big moment
      order.sort((a, b) => tierOf(this.opts.cards[a].tier).rank - tierOf(this.opts.cards[b].tier).rank);
      let delay = 0;
      order.forEach((i) => {
        setTimeout(() => this._flip(i, true), delay);
        delay += tierOf(this.opts.cards[i].tier).rank >= 4 ? 1500 : tierOf(this.opts.cards[i].tier).rank >= 3 ? 700 : 300;
      });
    }

    _flip(i, auto = false) {
      if (this.flipped[i]) return;
      const el = this.root.querySelector(`.pr-card[data-i="${i}"]`);
      const tier = this.opts.cards[i].tier;
      const rank = tierOf(tier).rank;
      this.flipped[i] = true;
      const rect = { x: parseFloat(el.style.left) + CARD_W / 2, y: CARD_TOP + CARD_H / 2 };

      const doFlip = () => {
        el.classList.add('flipped');
        this._sfxFlip();
        setTimeout(() => this._revealFx(el, tier, rect, i), 210);
      };

      if (rank >= 4 && !this.reduced) {
        // SSS: hold the moment — dim the rest, the card rises and trembles
        this.busy = true;
        this.root.classList.add('focus');
        el.classList.add('focus', 'charging');
        this._sfxLegendCharge();
        setTimeout(() => {
          el.classList.remove('charging');
          doFlip();
        }, 900);
        setTimeout(() => {
          this.root.classList.remove('focus');
          el.classList.remove('focus');
          this.busy = false;
          this._afterFlip();
        }, 2000);
      } else if (rank >= 3 && !this.reduced) {
        el.classList.add('charging-s');
        setTimeout(() => { el.classList.remove('charging-s'); doFlip(); }, 260);
        setTimeout(() => this._afterFlip(), 760);
      } else {
        doFlip();
        setTimeout(() => this._afterFlip(), 420);
      }
    }

    _revealFx(el, tier, p, i) {
      const t = tierOf(tier);
      el.classList.add('revealed');
      if (this.audio && this.audio.playCardReveal) this.audio.playCardReveal(tier, i);
      if (t.rank >= 4) {
        this._flash(1);
        this._shake(16, 620);
        this._spray(p.x, p.y, 260, [t.rgb, [255, 224, 140], [255, 255, 255]], 760);
        this._ring(p.x, p.y, t.rgb, 760);
        setTimeout(() => this._ring(p.x, p.y, [255, 224, 140], 620), 120);
        this._sfxLegendBoom();
        el.classList.add('stamped');
      } else if (t.rank === 3) {
        this._flash(0.45);
        this._shake(7, 360);
        this._spray(p.x, p.y, 140, [t.rgb, [255, 246, 214]], 560);
        this._ring(p.x, p.y, t.rgb, 560);
        el.classList.add('stamped');
      } else if (t.rank === 2) {
        this._spray(p.x, p.y, 70, [t.rgb], 420);
        this._ring(p.x, p.y, t.rgb, 400);
      } else {
        this._spray(p.x, p.y, 26, [t.rgb, [236, 228, 212]], 300);
      }
    }

    _afterFlip() {
      if (this.flipped.every(Boolean) && this.phase === 'dealt') {
        this.phase = 'pick';
        this.root.classList.add('is-pick');
        this._setHint(this.opts.pickHint || '选择 1 张');
        const allBtn = this.$('[data-act="all"]');
        if (allBtn) allBtn.disabled = true;
      }
    }

    _pick(i) {
      const o = this.opts;
      if (!o || !o.onPick) return;
      this.busy = true;
      const cards = [...this.root.querySelectorAll('.pr-card')];
      cards.forEach((c, k) => c.classList.add(k === i ? 'chosen' : 'dropped'));
      this.root.classList.add('picking-out');
      const t = tierOf(o.cards[i].tier);
      const el = cards[i];
      this._spray(parseFloat(el.style.left) + CARD_W / 2, CARD_TOP + CARD_H / 2, 60, [t.rgb, [255, 236, 190]], 420);
      this._sfxPick();
      setTimeout(() => {
        const keep = o.onPick(i);
        if (keep === false) this.show();
      }, this.reduced ? 60 : 520);
    }

    // ─── FX: CSS hooks ─────────────────────────────────────────────────
    _flash(strength) {
      const f = this.root.querySelector('.pr-flash');
      f.style.setProperty('--fa', String(strength));
      f.classList.remove('go');
      void f.offsetWidth;
      f.classList.add('go');
    }

    _shake(px, ms) {
      if (this.reduced) return;
      const s = this.root.querySelector('.pr-shake');
      s.style.setProperty('--sk', `${px}px`);
      s.style.setProperty('--skd', `${ms}ms`);
      s.classList.remove('go');
      void s.offsetWidth;
      s.classList.add('go');
    }

    // ─── FX: canvas particles ──────────────────────────────────────────
    _spray(x, y, n, palette, power) {
      if (this.reduced) n = Math.min(n, 20);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = power * (0.25 + Math.random() * 0.75);
        const col = palette[k % palette.length];
        this.parts.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - power * 0.25,
          s: Math.random() < 0.25 ? 4 : Math.random() < 0.5 ? 3 : 2,
          life: 0.6 + Math.random() * 0.9,
          max: 1.5,
          col,
          star: Math.random() < 0.12
        });
      }
    }

    _ring(x, y, rgb, power) {
      this.rings.push({ x, y, r: 10, v: power * 1.4, life: 0.55, max: 0.55, rgb });
    }

    _loop() {
      if (this.raf) return;
      this.last = performance.now();
      const tick = (now) => {
        if (!this.root || this.root.classList.contains('hidden')) { this.raf = 0; return; }
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this._step(dt, now / 1000);
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }

    _step(dt, t) {
      const g = this.ctx;
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      // ambient motes rising behind face-down rare cards
      if (this.phase === 'dealt' || this.phase === 'pick') {
        this.root.querySelectorAll('.pr-card').forEach((el) => {
          const i = Number(el.dataset.i);
          const tier = this.opts && this.opts.cards[i] ? this.opts.cards[i].tier : 'B';
          const rank = tierOf(tier).rank;
          if (rank < 2 || el.classList.contains('dropped')) return;
          const rate = rank >= 4 ? 34 : rank === 3 ? 16 : 6;
          if (Math.random() < rate * dt) {
            const x = parseFloat(el.style.left) + Math.random() * CARD_W;
            this.parts.push({ x, y: CARD_TOP + CARD_H - Math.random() * 30, vx: (Math.random() - 0.5) * 14, vy: -30 - Math.random() * 50, s: 2, life: 1.2, max: 1.2, col: tierOf(tier).rgb, star: false, float: true });
          }
        });
      }
      for (let k = this.parts.length - 1; k >= 0; k--) {
        const p = this.parts[k];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(k, 1); continue; }
        if (!p.float) {
          p.vx *= 0.93;
          p.vy = p.vy * 0.93 + 260 * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const a = Math.min(1, p.life / (p.max * 0.5));
        const [r, gg, b] = p.col;
        g.fillStyle = `rgba(${r},${gg},${b},${a.toFixed(3)})`;
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        if (p.star) {
          g.fillRect(x - 4, y, 9, 1);
          g.fillRect(x, y - 4, 1, 9);
          g.fillRect(x - 1, y - 1, 3, 3);
        } else {
          g.fillRect(x, y, p.s, p.s);
        }
      }
      for (let k = this.rings.length - 1; k >= 0; k--) {
        const R = this.rings[k];
        R.life -= dt;
        if (R.life <= 0) { this.rings.splice(k, 1); continue; }
        R.r += R.v * dt;
        R.v *= 0.9;
        const a = R.life / R.max;
        g.strokeStyle = `rgba(${R.rgb[0]},${R.rgb[1]},${R.rgb[2]},${(a * 0.9).toFixed(3)})`;
        g.lineWidth = 2 + a * 6;
        g.beginPath();
        g.ellipse(R.x, R.y, R.r, R.r * 0.92, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    }

    // ─── SFX (built on the game's tone/noise synth, all optional) ──────
    _tone(...a) { if (this.audio && this.audio.tone) this.audio.tone(...a); }
    _noise(...a) { if (this.audio && this.audio.noise) this.audio.noise(...a); }

    _hoverHum(tier) {
      const r = tierOf(tier).rank;
      if (r <= 1) { this._tone(660, 0.06, 'sine', 0.03, 0, 700); return; }
      const f = r >= 4 ? 196 : r === 3 ? 262 : 330;
      this._tone(f, 0.5, 'sine', r >= 4 ? 0.09 : 0.06, 0, f * 1.01);
      this._tone(f * 1.5, 0.45, 'triangle', r >= 4 ? 0.05 : 0.03, 0.02, f * 1.52);
      if (r >= 4) this._noise(0.4, 0.03, 1800, 0, { kind: 'pink', filterType: 'bandpass', endFreq: 3200, Q: 3 });
    }
    _sfxCharge() {
      if (this.audio && this.audio.playPackCharge) this.audio.playPackCharge();
      this._tone(120, 0.55, 'sawtooth', 0.04, 0, 360);
    }
    _sfxTear(big) {
      if (this.audio && this.audio.playPackTear) this.audio.playPackTear(big);
    }
    _sfxLand(i) {
      this._tone(150 - i * 8, 0.08, 'sine', 0.12, 0, 70);
      this._noise(0.05, 0.05, 900, 0, { kind: 'pink' });
    }
    _sfxFlip() {
      this._noise(0.09, 0.07, 2600, 0, { kind: 'white', filterType: 'bandpass', endFreq: 900, Q: 1.4 });
    }
    _sfxLegendCharge() {
      this._tone(98, 0.9, 'sawtooth', 0.05, 0, 392);
      this._tone(147, 0.9, 'sine', 0.07, 0.05, 587);
      this._noise(0.85, 0.05, 600, 0, { kind: 'pink', filterType: 'bandpass', endFreq: 4200, Q: 2 });
    }
    _sfxLegendBoom() {
      this._tone(70, 0.6, 'sine', 0.22, 0, 38, { bypassLimit: true });
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, k) => this._tone(f, 0.7, 'triangle', 0.05, 0.12 + k * 0.05, f, { bypassLimit: true }));
    }
    _sfxPick() {
      if (this.audio && this.audio.playSynergy) this.audio.playSynergy();
    }
  }

  window.MT.PackReveal = PackReveal;
})();
