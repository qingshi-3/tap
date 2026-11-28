/* MT.perf — one place that decides how hard the game draws.
 *
 * Decorative canvases (title sky, hero-select stage, camp backdrop, card
 * window FX, sprite previews) are pixel art animating at ~12fps, so they are
 * capped at 30fps everywhere. The battle canvas stays at 60fps unless the
 * device is weak or frames are measured to be slow, then it drops to 30.
 * `html.perf-low` lets CSS switch off purely decorative motion.
 *
 * Usage inside a rAF loop, before computing dt:
 *   if (MT.perf && !MT.perf.gate(this, 'bg')) { this.rafId = requestAnimationFrame(tick); return; }
 * Skipped frames don't touch lastTs, so dt simply covers the skipped time.
 *
 * Debug: ?perf=high or ?perf=low in the URL forces a mode.
 */
(function () {
  window.MT = window.MT || {};
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const weak = mobile || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const force = (location.search.match(/[?&]perf=(high|low)/) || [])[1] || null;

  const perf = {
    low: force ? force === 'low' : weak,
    fps: { bg: 30, fx: 30, game: 60 },
    gate(obj, kind) {
      const fps = this.fps[kind] || 60;
      if (fps >= 60) return true;
      const now = performance.now();
      if (obj.__perfT && now - obj.__perfT < 1000 / fps - 3) return false;
      obj.__perfT = now;
      return true;
    },
    setLow(on) {
      this.low = Boolean(on);
      this.fps.game = this.low ? 30 : 60;
      document.documentElement.classList.toggle('perf-low', this.low);
    }
  };
  perf.setLow(perf.low);

  // Watch real frame pacing for a few seconds while the page is visible; if the
  // median frame is slower than ~45fps, switch to low mode for the session.
  if (!force) {
    let samples = [];
    let last = 0;
    const mon = (t) => {
      if (document.visibilityState !== 'visible') { last = 0; requestAnimationFrame(mon); return; }
      if (last) {
        const d = t - last;
        if (d < 200) samples.push(d);
      }
      last = t;
      if (samples.length < 150) { requestAnimationFrame(mon); return; }
      samples.sort((a, b) => a - b);
      if (samples[Math.floor(samples.length / 2)] > 22 && !perf.low) perf.setLow(true);
    };
    setTimeout(() => requestAnimationFrame(mon), 2500);
  }

  window.MT.perf = perf;
})();
