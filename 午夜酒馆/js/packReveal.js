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
  // the battle hand card (156×208) shown at 1.5×
  const CARD_W = 234;
  const CARD_H = 312;
  const CARD_TOP = 198;
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
      if (this.onOpen) this.onOpen();
      root.className = `pr-root kind-${opts.kind || 'hero'}`;
      root.classList.remove('hidden');
      const best = opts.cards.reduce((m, c) => (tierOf(c.tier).rank > tierOf(m).rank ? c.tier : m), 'C');
      this.best = best;
      root.style.setProperty('--best', tierOf(best).col);

      this.$('.pr-title b').textContent = opts.title || '';
      this.$('.pr-title span').textContent = opts.subtitle || '';
      const kind = opts.kind === 'ins' ? 'ins' : 'hero';
      this.$('.pr-pack-emblem').innerHTML = this._packEmblemSvg(kind);
      this.$('.pr-pack-sub').textContent = kind === 'hero' ? 'RARE RECRUIT' : 'ARCANE SEAL';
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
      if (this.onClose) this.onClose();
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
                <i class="pr-pack-corners"></i>
                <span class="pr-pack-count"></span>
                <span class="pr-pack-emblem"></span>
                <span class="pr-pack-banner">
                  <span class="pr-pack-name"></span>
                  <span class="pr-pack-sub"></span>
                </span>
              </span>
              <i class="pr-pack-crack" aria-hidden="true"></i>
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
      const gap = n >= 4 ? 26 : 44;
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
        const sp = el.querySelector('.pr-front [data-unit]');
        if (sp && this.sprites && this.sprites.createDomSprite) {
          sp.appendChild(this.sprites.createDomSprite(sp.dataset.unit, 'idle', 68));
        }
        // Touch first: press and hold a face-down card to charge it (it lifts, its
        // rarity light swells, it hums); release to flip. Mouse hover only adds a hint.
        el.onpointerenter = (ev) => {
          if (ev.pointerType === 'mouse' && !this.flipped[i] && this.phase === 'dealt') this._hoverHum(c.tier);
        };
        el.onpointerdown = (ev) => {
          if (this.phase !== 'dealt' || this.flipped[i] || this.busy) return;
          el.classList.add('pressing');
          this._hoverHum(c.tier);
          if (el.setPointerCapture) { try { el.setPointerCapture(ev.pointerId); } catch (_) { /* ignore */ } }
        };
        const release = (flip) => {
          if (!el.classList.contains('pressing')) return;
          el.classList.remove('pressing');
          if (flip) this._flip(i);
        };
        el.onpointerup = () => release(true);
        el.onpointercancel = () => release(false);
        el.onclick = () => { if (this.phase === 'pick' && !this.busy) this._pick(i); };
      });
      this.cardEls = [...wrap.querySelectorAll('.pr-card')];
      this.cardX = this.cardEls.map((el) => parseFloat(el.style.left));
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

    _packEmblemSvg(kind) {
      return kind === 'hero'
        ? `<svg class="pr-pack-svg" viewBox="0 0 88 88" fill="none" aria-hidden="true">
             <circle cx="44" cy="44" r="36" stroke="#f2dba2" stroke-opacity="0.3" stroke-width="1.2" stroke-dasharray="3 3"/>
             <circle cx="44" cy="44" r="29" fill="rgba(20,6,9,0.55)" stroke="#d4ae68" stroke-opacity="0.7" stroke-width="1.2"/>
             <g transform="rotate(-18 44 46)">
               <rect x="27" y="20" width="26" height="38" rx="2" fill="#2c0b12" stroke="#d4ae68" stroke-width="1.6"/>
               <rect x="30" y="23" width="20" height="32" rx="1" stroke="#f2dba2" stroke-opacity="0.35" stroke-width="1"/>
             </g>
             <g transform="rotate(18 44 46)">
               <rect x="35" y="20" width="26" height="38" rx="2" fill="#2c0b12" stroke="#d4ae68" stroke-width="1.6"/>
               <rect x="38" y="23" width="20" height="32" rx="1" stroke="#f2dba2" stroke-opacity="0.35" stroke-width="1"/>
             </g>
             <rect x="30" y="18" width="28" height="42" rx="2" fill="url(#prHeroGold)" stroke="#14080a" stroke-width="1.5"/>
             <rect x="32.5" y="20.5" width="23" height="37" rx="1" fill="#3a0d16" stroke="#fff0c2" stroke-width="1.2"/>
             <path d="M44 26 L46.6 35.4 L55 39 L46.6 42.6 L44 52 L41.4 42.6 L33 39 L41.4 35.4 Z" fill="#ffe7a8" stroke="#5a1820" stroke-width="0.9"/>
             <circle cx="44" cy="39" r="2.2" fill="#fffaf0"/>
             <path d="M44 8 L45.5 13 L44 15 L42.5 13 Z M44 80 L45.5 75 L44 73 L42.5 75 Z M8 44 L13 45.5 L15 44 L13 42.5 Z M80 44 L75 45.5 L73 44 L75 42.5 Z" fill="#f2dba2" opacity="0.85"/>
             <defs>
               <linearGradient id="prHeroGold" x1="30" y1="18" x2="58" y2="60" gradientUnits="userSpaceOnUse">
                 <stop offset="0%" stop-color="#fff0c2"/>
                 <stop offset="50%" stop-color="#d4ae68"/>
                 <stop offset="100%" stop-color="#8a6228"/>
               </linearGradient>
             </defs>
           </svg>`
        : `<svg class="pr-pack-svg" viewBox="0 0 88 88" fill="none" aria-hidden="true">
             <circle cx="44" cy="44" r="35" stroke="#d8beff" stroke-opacity="0.34" stroke-width="1.2" stroke-dasharray="2 3"/>
             <circle cx="44" cy="44" r="27" fill="rgba(16,8,34,0.62)" stroke="#e8c77e" stroke-opacity="0.72" stroke-width="1.3"/>
             <polygon points="44,12 68,44 44,76 20,44" fill="none" stroke="#e8c77e" stroke-opacity="0.52" stroke-width="1.2"/>
             <polygon points="44,18 64,44 44,70 24,44" fill="url(#prInsPrism)" stroke="#fff0c2" stroke-width="1.5"/>
             <polygon points="44,25 56,44 44,63 32,44" fill="#231048" stroke="#d4b3ff" stroke-width="1.2"/>
             <polygon points="44,32 50,44 44,56 38,44" fill="#e8c77e"/>
             <circle cx="44" cy="44" r="3" fill="#ffffff"/>
             <circle cx="44" cy="12" r="2" fill="#fff0c2"/>
             <circle cx="44" cy="76" r="2" fill="#fff0c2"/>
             <circle cx="12" cy="44" r="2" fill="#d4b3ff"/>
             <circle cx="76" cy="44" r="2" fill="#d4b3ff"/>
             <defs>
               <linearGradient id="prInsPrism" x1="24" y1="18" x2="64" y2="70" gradientUnits="userSpaceOnUse">
                 <stop offset="0%" stop-color="#e5ccff"/>
                 <stop offset="45%" stop-color="#7c4dff"/>
                 <stop offset="100%" stop-color="#2c125c"/>
               </linearGradient>
             </defs>
           </svg>`;
    }

    // ─── phases ────────────────────────────────────────────────────────
    _showPack() {
      this.phase = 'sealed';
      const pack = this.$('.pr-pack');
      pack.classList.remove('gone', 'charging', 'hitstop', 'torn');
      this.root.classList.remove('pack-focus');
      pack.classList.add('drop');
      setTimeout(() => pack.classList.remove('drop'), 700);
      this._setHint('点一下撕开卡包');
      this.root.classList.add('is-sealed');
    }

    _tearPack() {
      if (this.phase !== 'sealed') return;
      this.phase = 'charging';
      const pack = this.$('.pr-pack');
      const bestRank = tierOf(this.best).rank;
      const bestCol = tierOf(this.best).rgb;

      if (this.reduced) {
        pack.classList.add('torn');
        this._burst(false);
        return;
      }

      // Beat 1: dim the theater, lift & tremble the sealed pack with escalating rarity tension
      this.root.classList.add('pack-focus');
      pack.classList.add('charging');
      this._setHint('');
      if (bestRank >= 3) this._sfxLegendCharge();
      else this._sfxCharge();

      // Pull-in spark anticipation bursts during charge
      const chargeMs = bestRank >= 4 ? 660 : bestRank >= 3 ? 580 : 460;
      const hitstopMs = bestRank >= 4 ? 195 : bestRank >= 3 ? 165 : 120;
      this._spray(PACK_CX, PACK_CY, 18 + bestRank * 8, [bestCol, [255, 240, 200]], 180);

      // Beat 2: sudden dead-stop HITSTOP freeze at peak tension (the tactile 顿挫感)
      setTimeout(() => {
        if (this.phase !== 'charging') return;
        pack.classList.remove('charging');
        pack.classList.add('hitstop');
        this._sfxCrackTick(bestRank);
        this._ring(PACK_CX, PACK_CY, [255, 246, 214], 240);
      }, chargeMs);

      // Beat 3: explosive tear release
      setTimeout(() => {
        if (this.phase !== 'charging') return;
        this.root.classList.remove('pack-focus');
        pack.classList.remove('hitstop');
        pack.classList.add('torn');
        this._burst(false);
      }, chargeMs + hitstopMs);
    }

    _burst(fromReroll) {
      this.phase = 'burst';
      this.root.classList.remove('is-sealed', 'pack-focus');
      this.root.classList.add('is-open');
      const bestRank = tierOf(this.best).rank;
      const bestCol = tierOf(this.best).rgb;
      this._flash(bestRank >= 4 ? 1.0 : bestRank >= 3 ? 0.85 : 0.62);
      this._shake(bestRank >= 4 ? 16 : bestRank >= 3 ? 11 : 7, bestRank >= 4 ? 580 : 420);
      this._sfxTear(bestRank >= 3);
      if (bestRank >= 3) this._sfxLegendBoom();
      this._spray(PACK_CX, PACK_CY, 110 + bestRank * 42, [[255, 236, 190], bestCol, [255, 255, 255]], 580 + bestRank * 45);
      this._ring(PACK_CX, PACK_CY, bestCol, 560 + bestRank * 45);
      if (bestRank >= 3) {
        setTimeout(() => this._ring(PACK_CX, PACK_CY, [255, 224, 140], 480), 110);
      }
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
        }, (fromReroll ? 60 : 180) + i * 95);
      });
      setTimeout(() => {
        this.phase = 'dealt';
        this.root.classList.add('is-dealt');
        this._setHint('按住卡牌蓄力，松手翻开');
      }, 240 + cards.length * 95 + 380);
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
        delay += tierOf(this.opts.cards[i].tier).rank >= 4 ? 520 : tierOf(this.opts.cards[i].tier).rank >= 3 ? 380 : 240;
      });
    }

    _flip(i, auto = false) {
      if (this.flipped[i]) return;
      const el = this.root.querySelector(`.pr-card[data-i="${i}"]`);
      const tier = this.opts.cards[i].tier;
      const rank = tierOf(tier).rank;
      this.flipped[i] = true;
      const rect = { x: this.cardX[i] + CARD_W / 2, y: CARD_TOP + CARD_H / 2 };

      const doFlip = () => {
        el.classList.add('flipped');
        this._sfxFlip();
        setTimeout(() => this._revealFx(el, tier, rect, i), 200);
      };

      // Heavy hitstop drama now lives on tearing the pack open;
      // individual card flips stay crisp and punchy with a brief tactile squeeze for S/SSS.
      if (rank >= 4 && !this.reduced) {
        el.classList.add('charging-s');
        setTimeout(() => { el.classList.remove('charging-s'); doFlip(); }, 220);
        setTimeout(() => this._afterFlip(), 680);
      } else if (rank >= 3 && !this.reduced) {
        el.classList.add('charging-s');
        setTimeout(() => { el.classList.remove('charging-s'); doFlip(); }, 150);
        setTimeout(() => this._afterFlip(), 560);
      } else {
        doFlip();
        setTimeout(() => this._afterFlip(), 380);
      }
    }

    _revealFx(el, tier, p, i) {
      const t = tierOf(tier);
      el.classList.add('revealed');
      if (this.audio && this.audio.playCardReveal) this.audio.playCardReveal(tier, i);
      if (t.rank >= 4) {
        this._flash(0.65);
        this._shake(10, 420);
        this._spray(p.x, p.y, 180, [t.rgb, [255, 224, 140], [255, 255, 255]], 640);
        this._ring(p.x, p.y, t.rgb, 620);
        setTimeout(() => this._ring(p.x, p.y, [255, 224, 140], 500), 100);
        el.classList.add('stamped');
      } else if (t.rank === 3) {
        this._flash(0.35);
        this._shake(6, 300);
        this._spray(p.x, p.y, 110, [t.rgb, [255, 246, 214]], 500);
        this._ring(p.x, p.y, t.rgb, 500);
        el.classList.add('stamped');
      } else if (t.rank === 2) {
        this._spray(p.x, p.y, 65, [t.rgb], 400);
        this._ring(p.x, p.y, t.rgb, 380);
      } else {
        this._spray(p.x, p.y, 24, [t.rgb, [236, 228, 212]], 280);
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
      this._spray(this.cardX[i] + CARD_W / 2, CARD_TOP + CARD_H / 2, 60, [t.rgb, [255, 236, 190]], 420);
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
      if (!this.parts.length && !this.rings.length && this.phase !== 'dealt') {
        if (this._dirty) { g.clearRect(0, 0, W, H); this._dirty = false; }
        return;
      }
      this._dirty = true;
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      // ambient motes rising behind face-down rare cards only (once face-up, the card settles)
      if (this.phase === 'dealt' && this.opts && this.cardX) {
        this.opts.cards.forEach((c, i) => {
          if (this.flipped[i]) return;
          const rank = tierOf(c.tier).rank;
          if (rank < 3) return;
          const rate = rank >= 4 ? 26 : 10;
          if (Math.random() < rate * dt) {
            const x = this.cardX[i] + Math.random() * CARD_W;
            this.parts.push({ x, y: CARD_TOP + CARD_H - Math.random() * 30, vx: (Math.random() - 0.5) * 12, vy: -30 - Math.random() * 40, s: 2, life: 1.1, max: 1.1, col: tierOf(c.tier).rgb, star: false, float: true });
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
      this._tone(110, 0.46, 'sawtooth', 0.045, 0, 340);
      this._tone(165, 0.44, 'sine', 0.05, 0.04, 480);
    }
    _sfxCrackTick(rank) {
      // Crisp metallic snap right as the hitstop freezes — accents the 顿挫 beat!
      this._tone(rank >= 3 ? 1180 : 880, 0.07, 'triangle', 0.11, 0, rank >= 3 ? 1560 : 1120);
      this._noise(0.05, 0.08, 3400, 0, { kind: 'white', filterType: 'bandpass', Q: 2.2 });
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
