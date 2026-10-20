// Spotlight tutorial, modelled on 奇兵列阵: an evenodd SVG mask cuts holes around the targets,
// an input guard only lets the highlighted areas through, and each step advances on a tap,
// a game event or a state check. Polling runs every 200ms but only touches the DOM on change.

const PAD = 6;

export class Spotlight {
  /**
   * @param {HTMLElement} el   overlay root (#tut)
   * @param {object[]} steps  {text, at?, allow?, until: 'tap'|event|fn, gate?, skip?, noMask?}
   * @param {object} opts     {idle(): boolean, onDone(skipped), skippable, label}
   */
  constructor(el, steps, opts = {}) {
    this.el = el; this.steps = steps; this.opts = opts;
    this.i = 0; this.sig = ''; this.shown = false; this.rects = []; this.allowRects = []; this.avoidRects = [];
    this.el.hidden = false;
    this.el.innerHTML = '<div class="tut-mask"></div><div class="tut-rings"></div><div class="tut-box"></div>' +
      (opts.skippable ? '<button class="act tut-skip">跳过教学</button>' : '');
    this.mask = el.querySelector('.tut-mask'); this.ring = el.querySelector('.tut-rings'); this.box = el.querySelector('.tut-box');
    el.querySelector('.tut-skip')?.addEventListener('click', () => this.finish(true));
    this.guard = this.guard.bind(this);
    for (const t of ['pointerdown', 'click', 'keydown', 'wheel', 'contextmenu']) window.addEventListener(t, this.guard, { capture: true, passive: false });
    this.timer = setInterval(() => this.update(), 200);
    this.update();
  }

  get done() { return this.i >= this.steps.length; }

  notify(event) {
    const s = this.steps[this.i];
    if (s && s.until === event) this.next();
  }

  next() { this.i++; this.shown = false; this.sig = ''; if (this.done) this.finish(false); else this.update(); }

  finish(skipped) {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.timer);
    for (const t of ['pointerdown', 'click', 'keydown', 'wheel', 'contextmenu']) window.removeEventListener(t, this.guard, { capture: true });
    this.el.innerHTML = ''; this.el.hidden = true;
    this.opts.onDone?.(skipped);
  }

  active(s) { return !!s && (this.opts.idle ? this.opts.idle() : true) && (!s.gate || s.gate()); }

  resolve(t) {
    const r = typeof t === 'function' ? t() : typeof t === 'string' ? document.querySelector(t) : t;
    if (!r) return null;
    if (r instanceof Element) {
      if (!r.isConnected || !r.getClientRects().length) return null;
      const b = r.getBoundingClientRect();
      return b.width && b.height ? { x: b.left, y: b.top, w: b.width, h: b.height } : null;
    }
    return r;
  }

  update() {
    if (this.disposed) return;
    const s = this.steps[this.i];
    if (!s) return;
    if (s.skip?.() || (typeof s.until === 'function' && s.until())) { this.next(); return; }
    const on = this.active(s);
    this.el.classList.toggle('on', on);
    this.el.classList.toggle('no-mask', !!s.noMask);
    this.el.classList.toggle('last', this.i === this.steps.length - 1);
    if (!on) {
      if (this.sig !== 'off') { this.sig = 'off'; this.shown = false; this.mask.innerHTML = ''; this.ring.innerHTML = ''; this.box.style.display = 'none'; }
      this.rects = this.allowRects = [];
      return;
    }
    const pad = r => ({ x: r.x - PAD, y: r.y - PAD, w: r.w + PAD * 2, h: r.h + PAD * 2 });
    this.rects = (s.at || []).map(t => this.resolve(t)).filter(Boolean).map(pad);
    this.allowRects = [...this.rects, ...(s.allow || []).map(t => this.resolve(t)).filter(Boolean)];
    // Soft obstacles for the text box: UI rails and whatever the player is working on (e.g. the ghost).
    this.avoidRects = [...(s.avoid || []), ...(this.opts.avoid || [])].map(t => this.resolve(t)).filter(Boolean);
    const text = typeof s.text === 'function' ? s.text() : s.text;
    const vw = window.innerWidth, vh = window.innerHeight;
    const sig = `${this.i}|${text}|${vw}x${vh}|${this.rects.map(r => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`).join(';')}|${this.avoidRects.map(r => `${Math.round(r.x)},${Math.round(r.y)}`).join(';')}`;
    if (sig === this.sig) return;
    this.sig = sig;
    const holes = this.rects.map(r => `M${r.x},${r.y}h${r.w}v${r.h}h${-r.w}z`).join('');
    this.mask.innerHTML = s.noMask ? '' : `<svg width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}"><path fill-rule="evenodd" d="M0,0H${vw}V${vh}H0z${holes}"/></svg>`;
    this.ring.innerHTML = this.rects.map(r => `<div class="tut-ring" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px"></div>`).join('');
    if (!this.shown) {
      this.shown = true;
      const total = this.steps.length, last = this.i === total - 1;
      this.box.innerHTML = `${this.opts.label === false ? '' : `<div class="tut-step">${this.opts.label || '教学'} ${this.i + 1}/${total}</div>`}<div class="tut-text">${text}</div>` +
        (s.until === 'tap' ? `<button class="act primary tut-ok">${last ? '完成' : s.ok || '继续'}</button>` : '');
      this.box.querySelector('.tut-ok')?.addEventListener('click', () => this.next());
    }
    this.box.style.display = '';
    this.place();
  }

  /** Put the text box where it covers the highlights least (then the soft obstacles), close to the first highlight. */
  place() {
    const vw = window.innerWidth, vh = window.innerHeight, M = 10;
    this.box.style.left = '0px'; this.box.style.top = '0px';
    const W = this.box.offsetWidth, H = this.box.offsetHeight;
    const cx = x => Math.max(8, Math.min(vw - W - 8, x)), cy = y => Math.max(8, Math.min(vh - H - 8, y));
    const f = this.rects[0], cand = [];
    if (f) {
      cand.push({ x: cx(f.x + f.w + M), y: cy(f.y + f.h / 2 - H / 2) }, { x: cx(f.x - W - M), y: cy(f.y + f.h / 2 - H / 2) });
      cand.push({ x: cx(f.x + f.w / 2 - W / 2), y: cy(f.y + f.h + M) }, { x: cx(f.x + f.w / 2 - W / 2), y: cy(f.y - H - M) });
    }
    for (const y of [vh * 0.18, vh / 2 - H / 2, vh - H - 8]) for (const x of [vw / 2 - W / 2, vw * 0.22, vw * 0.78 - W, 8, vw - W - 8]) cand.push({ x: cx(x), y: cy(y) });
    const cover = (p, rs) => rs.reduce((a, r) =>
      a + Math.max(0, Math.min(p.x + W, r.x + r.w) - Math.max(p.x, r.x)) * Math.max(0, Math.min(p.y + H, r.y + r.h) - Math.max(p.y, r.y)), 0);
    const skip = this.resolve(this.el.querySelector('.tut-skip'));
    const hard = skip ? [...this.rects, skip] : this.rects;
    const overlap = p => cover(p, hard) * 4 + cover(p, this.avoidRects);
    let best = cand[0] || { x: cx(vw / 2 - W / 2), y: cy(vh / 2 - H / 2) }, score = Infinity;
    for (const p of cand) { const o = overlap(p); if (o < score - 1) { best = p; score = o; } }
    this.box.style.left = `${Math.round(best.x)}px`; this.box.style.top = `${Math.round(best.y)}px`;
  }

  /** Input lock: only the highlighted/allowed rects, the box and the skip button get through. */
  guard(e) {
    const s = this.steps[this.i];
    if (this.disposed || !this.active(s) || s.noMask) return;
    if (e.target instanceof Node && this.el.contains(e.target)) return;
    if (e instanceof KeyboardEvent) { if (e.key !== 'Escape') { e.stopPropagation(); e.preventDefault(); } return; }
    if (e.clientX !== undefined && this.allowRects.some(r => e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h)) return;
    e.stopPropagation(); e.preventDefault();
  }
}
