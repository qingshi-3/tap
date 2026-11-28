/* LivingUI — small living pixel windows inside UI elements.
 *
 * One idea, adapted per element: every UI piece gets its own tiny animated
 * pixel world whose CONTENT comes from what it means (a relic's school) and
 * whose STRENGTH comes from its rarity/importance. Not one effect reused.
 *
 *   <canvas class="lv-fx" data-painter="relic" data-theme="poison" data-tier="S" width="90" height="76">
 *
 * Intensity rises on touch, not hover (mobile first):
 *   - pressed  : finger down on any [data-pressable]   → .is-pressed
 *   - selected : the element (or ancestor) has .is-inspected
 *   - spotlight: when idle, a scheduler gives ONE element at a time a short
 *                flare every few seconds, so the screen breathes without
 *                everything shouting at once (the "motion budget").
 *
 * All windows share one rAF loop, capped by MT.perf ('fx' = 30fps).
 */
(function () {
  window.MT = window.MT || {};

  const TIER_RANK = { C: 0, B: 1, A: 2, S: 3, SSS: 4 };
  const TIER_RGB = { C: [196, 204, 222], B: [121, 210, 255], A: [201, 156, 255], S: [255, 211, 107], SSS: [255, 107, 139] };
  const THEME_RGB = {
    core: [255, 217, 102], discard: [107, 229, 255], shield: [120, 183, 255], poison: [126, 242, 138],
    frost: [156, 244, 255], hand: [240, 184, 91], summon: [226, 136, 255], blood: [255, 92, 114], dice: [255, 224, 102]
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ─── relic altar painter ─────────────────────────────────────────────
  // An arched niche: theme-coloured air, a halo behind the floating icon (DOM),
  // a stone plinth, and a school-specific motif. Tier adds layers:
  // B glint · A motes · S light shafts · SSS eclipse ring + orbiting runes.
  const MOTIF_COUNT = { core: 14, discard: 7, shield: 0, poison: 10, frost: 16, hand: 3, summon: 6, blood: 6, dice: 4 };

  function initMotif(e, w, h) {
    const n = Math.round((MOTIF_COUNT[e.theme] ?? 10) * (0.6 + e.rank * 0.25));
    e.pts = Array.from({ length: n }, (_, i) => ({
      x: rnd(6, w - 6), y: rnd(10, h - 10), v: rnd(0.6, 1.4), ph: rnd(0, 6.28), i
    }));
    e.rings = [];
  }

  function paintRelic(g, w, h, t, dt, e) {
    const tc = THEME_RGB[e.theme] || THEME_RGB.core;
    const rim = TIER_RGB[e.tier] || TIER_RGB.B;
    const rank = e.rank;
    const energy = 0.55 + rank * 0.15 + e.boost * 0.6 + e.flare * 0.5;
    const cx = w / 2;
    const cy = 34;
    if (!e.pts) initMotif(e, w, h);

    // air
    g.clearRect(0, 0, w, h);
    if (!e.float) { g.fillStyle = '#0c0907'; g.fillRect(0, 0, w, h); }
    const air = g.createLinearGradient(0, 0, 0, h);
    air.addColorStop(0, rgba(tc, 0.05));
    air.addColorStop(0.7, rgba(tc, 0.16 + e.boost * 0.08));
    air.addColorStop(1, rgba(tc, 0.04));
    g.fillStyle = air;
    g.fillRect(0, 0, w, h);

    g.globalCompositeOperation = 'lighter';
    // S+: light shafts from the top
    if (rank >= 3) {
      for (let k = 0; k < 3; k++) {
        const x0 = cx - 22 + k * 18 + Math.sin(t * 0.5 + k * 2) * 3;
        const a = (0.06 + 0.04 * Math.sin(t * 0.9 + k)) * energy;
        g.fillStyle = rgba(rank >= 4 ? [255, 214, 160] : rim, a);
        g.beginPath();
        g.moveTo(x0, 0); g.lineTo(x0 + 7, 0); g.lineTo(x0 + 13, h - 14); g.lineTo(x0 + 4, h - 14);
        g.closePath();
        g.fill();
      }
    }
    // halo behind the icon
    const halo = g.createRadialGradient(cx, cy, 3, cx, cy, 28 + rank * 3 + e.boost * 8);
    halo.addColorStop(0, rgba(rank >= 4 ? [255, 220, 150] : tc, 0.34 * energy));
    halo.addColorStop(0.6, rgba(rank >= 4 ? rim : tc, 0.12 * energy));
    halo.addColorStop(1, rgba(tc, 0));
    g.fillStyle = halo;
    g.fillRect(0, 0, w, h);
    // SSS: eclipse ring + orbiting runes
    if (rank >= 4) {
      const r = 19 + Math.sin(t * 2) * 1;
      g.fillStyle = rgba([255, 230, 170], 0.75);
      for (let a = 0; a < 64; a++) {
        const ang = (a / 64) * Math.PI * 2;
        g.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.92), 1, 1);
      }
      for (let k = 0; k < 6; k++) {
        const ang = t * (0.9 + e.boost * 1.2) + (k / 6) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(ang) * 26);
        const y = Math.round(cy + Math.sin(ang) * 11);
        g.fillStyle = rgba(k % 2 ? [255, 107, 139] : [255, 214, 107], 0.9);
        g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
      }
    }

    // school motif
    const sp = (0.7 + e.boost * 0.9 + e.flare * 0.8);
    const pts = e.pts;
    switch (e.theme) {
      case 'discard': // fluttering cards spiralling up
        for (const p of pts) {
          p.y -= 9 * p.v * sp * dt; p.ph += dt * 2.2 * sp;
          if (p.y < 8) { p.y = h - 12; p.x = rnd(8, w - 8); }
          const x = Math.round(p.x + Math.sin(p.ph) * 6);
          const flip = Math.abs(Math.cos(p.ph)) > 0.5;
          g.fillStyle = rgba([230, 248, 255], 0.55 * energy);
          g.fillRect(x, Math.round(p.y), flip ? 3 : 1, 4);
          g.fillStyle = rgba(tc, 0.6 * energy);
          g.fillRect(x, Math.round(p.y) + 4, flip ? 3 : 1, 1);
        }
        break;
      case 'shield': // ripples spreading from the icon
        e.rt = (e.rt || 0) - dt * sp;
        if (e.rt <= 0) { e.rt = 1.1 - rank * 0.12; e.rings.push({ r: 8, a: 0.8 }); }
        for (let k = e.rings.length - 1; k >= 0; k--) {
          const rg = e.rings[k];
          rg.r += 16 * dt * sp; rg.a -= 0.45 * dt * sp;
          if (rg.a <= 0) { e.rings.splice(k, 1); continue; }
          g.fillStyle = rgba(tc, rg.a * energy * 0.8);
          for (let a = 0; a < 6; a++) { // hexagon
            const a0 = (a / 6) * Math.PI * 2 + Math.PI / 6;
            const a1 = ((a + 1) / 6) * Math.PI * 2 + Math.PI / 6;
            for (let s = 0; s <= 8; s++) {
              const u = s / 8;
              const x = cx + (Math.cos(a0) * (1 - u) + Math.cos(a1) * u) * rg.r;
              const y = cy + (Math.sin(a0) * (1 - u) + Math.sin(a1) * u) * rg.r * 0.86;
              g.fillRect(Math.round(x), Math.round(y), 1, 1);
            }
          }
        }
        break;
      case 'poison': // bubbles rising from a mist band, popping near the top
        g.fillStyle = rgba(tc, 0.18 * energy);
        for (let x = 0; x < w; x += 2) g.fillRect(x, Math.round(h - 16 + Math.sin(x * 0.3 + t * 2) * 2), 2, 4);
        for (const p of pts) {
          p.y -= 11 * p.v * sp * dt;
          const r = p.i % 3 === 0 ? 2 : 1;
          if (p.y < 14 + p.ph * 3) { p.y = h - 14; p.x = rnd(8, w - 8); }
          const x = Math.round(p.x + Math.sin(t * 2 + p.ph) * 2);
          const y = Math.round(p.y);
          g.fillStyle = rgba(tc, 0.7 * energy);
          if (r === 2) { g.fillRect(x - 1, y - 2, 3, 1); g.fillRect(x - 1, y + 2, 3, 1); g.fillRect(x - 2, y - 1, 1, 3); g.fillRect(x + 2, y - 1, 1, 3); }
          else g.fillRect(x, y, 2, 2);
        }
        break;
      case 'frost': // snow falling, frost creeping at the corners
        for (const p of pts) {
          p.y += 7 * p.v * sp * dt;
          if (p.y > h - 12) { p.y = 22; p.x = rnd(4, w - 4); }
          const x = Math.round(p.x + Math.sin(t + p.ph) * 3);
          g.fillStyle = rgba([230, 252, 255], 0.65 * energy);
          if (p.i % 4 === 0) { g.fillRect(x - 1, Math.round(p.y), 3, 1); g.fillRect(x, Math.round(p.y) - 1, 1, 3); }
          else g.fillRect(x, Math.round(p.y), 1, 1);
        }
        g.fillStyle = rgba(tc, 0.3 * energy);
        for (let k = 0; k < 8; k++) { g.fillRect(1, h - 2 - k * 2, 8 - k, 1); g.fillRect(w - 9 + k, h - 2 - k * 2, 8 - k, 1); }
        break;
      case 'hand': // three held cards orbiting slowly behind the icon
        for (let k = 0; k < 3; k++) {
          const ang = t * 0.6 * sp + (k / 3) * Math.PI * 2;
          const x = Math.round(cx + Math.cos(ang) * 28 - 3);
          const y = Math.round(cy + Math.sin(ang) * 9 - 5);
          const front = Math.sin(ang) > 0;
          g.fillStyle = rgba(front ? [255, 236, 190] : tc, (front ? 0.55 : 0.3) * energy);
          g.fillRect(x, y, 6, 9);
          g.fillStyle = rgba([10, 8, 6], 0.6);
          g.fillRect(x + 1, y + 1, 4, 7);
          g.fillStyle = rgba(tc, 0.7 * energy);
          g.fillRect(x + 2, y + 3, 2, 3);
        }
        break;
      case 'summon': // soul wisps rising in sine paths
        for (const p of pts) {
          p.y -= 8 * p.v * sp * dt;
          if (p.y < 6) { p.y = h - 10; p.x = rnd(10, w - 10); }
          for (let s = 0; s < 4; s++) {
            const yy = p.y + s * 3;
            const x = Math.round(p.x + Math.sin(yy * 0.15 + p.ph) * 4);
            g.fillStyle = rgba(tc, (0.7 - s * 0.16) * energy);
            g.fillRect(x, Math.round(yy), s === 0 ? 2 : 1, s === 0 ? 2 : 1);
          }
        }
        break;
      case 'blood': // drops falling, splashing on the plinth; a slow heartbeat
        {
          const beat = Math.max(0, Math.sin(t * 3.2)) ** 6;
          g.fillStyle = rgba(tc, 0.12 * beat * energy);
          g.fillRect(0, 0, w, h);
        }
        for (const p of pts) {
          p.y += 16 * p.v * sp * dt;
          if (p.y > h - 14) { p.y = 22 + rnd(0, 10); p.x = rnd(14, w - 14); }
          const x = Math.round(p.x);
          const y = Math.round(p.y);
          g.fillStyle = rgba(tc, 0.75 * energy);
          g.fillRect(x, y, 1, 2); g.fillRect(x - 1, y + 2, 3, 2);
        }
        break;
      case 'dice': // dice tumbling up and falling back
        for (const p of pts) {
          p.ph += dt * sp * 1.4;
          const hop = Math.abs(Math.sin(p.ph)) * 26;
          const x = Math.round(14 + p.i * ((w - 28) / Math.max(1, pts.length - 1)) - 2);
          const y = Math.round(h - 18 - hop);
          g.fillStyle = rgba([255, 246, 220], 0.7 * energy);
          g.fillRect(x, y, 5, 5);
          g.fillStyle = rgba([20, 14, 8], 0.9);
          const face = Math.floor(p.ph * 2) % 3;
          if (face === 0) g.fillRect(x + 2, y + 2, 1, 1);
          else if (face === 1) { g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x + 3, y + 3, 1, 1); }
          else { g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x + 2, y + 2, 1, 1); g.fillRect(x + 3, y + 3, 1, 1); }
        }
        break;
      default: // core: warm dust motes + rare glints
        for (const p of pts) {
          p.y -= 4 * p.v * sp * dt; p.x += Math.sin(t * 0.8 + p.ph) * 3 * dt;
          if (p.y < 8) { p.y = h - 12; p.x = rnd(4, w - 4); }
          const tw = 0.5 + 0.5 * Math.sin(t * 3 + p.ph);
          g.fillStyle = rgba(tc, (0.3 + 0.5 * tw) * energy);
          g.fillRect(Math.round(p.x), Math.round(p.y), p.i % 5 === 0 ? 2 : 1, p.i % 5 === 0 ? 2 : 1);
        }
    }
    // B+: a rare glint near the icon
    const gl = (t * 0.35 + e.seed) % 1;
    if (gl < 0.06 || e.flare > 0.6) {
      const k = e.flare > 0.6 ? e.flare : 1 - Math.abs(gl - 0.03) / 0.03;
      const gx = Math.round(cx + 14);
      const gy = Math.round(cy - 14);
      g.fillStyle = rgba([255, 252, 236], 0.9 * k);
      g.fillRect(gx - 3, gy, 7, 1); g.fillRect(gx, gy - 3, 1, 7);
    }
    // flare burst of sparks
    if (e.flare > 0.85 && !e.flareBurst) {
      e.flareBurst = true;
      e.sparks = Array.from({ length: 14 + rank * 4 }, () => ({ x: cx, y: cy, vx: rnd(-40, 40), vy: rnd(-50, 10), life: rnd(0.4, 0.9) }));
    }
    if (e.flare < 0.2) e.flareBurst = false;
    if (e.sparks) {
      for (let k = e.sparks.length - 1; k >= 0; k--) {
        const s = e.sparks[k];
        s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 60 * dt;
        if (s.life <= 0) { e.sparks.splice(k, 1); continue; }
        g.fillStyle = rgba(rank >= 4 ? [255, 214, 140] : rim, s.life * 1.2);
        g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      }
    }
    g.globalCompositeOperation = 'source-over';

    // ground: a stone plinth for the slanted frame, a glowing pool for the floating one
    const py = h - 12;
    if (e.float) {
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const rx = 22 - k * 6 + e.boost * 4;
        g.fillStyle = rgba(rank >= 4 ? [255, 190, 140] : tc, (0.10 + k * 0.08) * energy);
        for (let x = -rx; x <= rx; x++) {
          const yy = Math.round(Math.sqrt(Math.max(0, 1 - (x * x) / (rx * rx))) * (3 - k * 0.8));
          g.fillRect(Math.round(cx + x), py + 4 - yy, 1, yy * 2 + 1);
        }
      }
      g.globalCompositeOperation = 'source-over';
    } else {
      g.fillStyle = '#2a2219'; g.fillRect(cx - 16, py, 32, 3);
      g.fillStyle = '#5a4a34'; g.fillRect(cx - 16, py, 32, 1);
      g.fillStyle = '#1a140e'; g.fillRect(cx - 12, py + 3, 24, 5);
      g.fillStyle = '#3a3024'; g.fillRect(cx - 12, py + 3, 24, 1);
      g.fillStyle = '#120d09'; g.fillRect(cx - 18, py + 8, 36, 4);
      g.fillStyle = rgba(rim, 0.55); g.fillRect(cx - 16, py, 32, 1);
    }
  }

  const PAINTERS = { relic: paintRelic };

  // ─── shared loop ─────────────────────────────────────────────────────
  const entries = new Map();
  let raf = 0;
  let last = 0;
  let scanAt = 0;
  let nextFlareAt = 0;
  const gateKey = {};

  function scan() {
    const live = new Set();
    document.querySelectorAll('canvas.lv-fx').forEach((cv) => {
      live.add(cv);
      if (!entries.has(cv)) {
        const tier = cv.dataset.tier || 'B';
        entries.set(cv, {
          cv, g: cv.getContext('2d'), painter: PAINTERS[cv.dataset.painter] || paintRelic,
          theme: cv.dataset.theme || 'core', tier, rank: TIER_RANK[tier] ?? 1,
          boost: 0, flare: 0, seed: Math.random(), host: cv.closest('[data-pressable], .is-inspectable') || cv.parentElement,
          float: Boolean(cv.closest('.frame-float'))
        });
      }
    });
    for (const [cv, e] of entries) { if (!live.has(cv)) entries.delete(cv); else e.float = Boolean(cv.closest('.frame-float')); }
  }

  function visible(e) {
    return e.cv.isConnected && e.cv.offsetParent !== null && !e.cv.closest('.hidden, .under-overlay');
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (window.MT.perf && !window.MT.perf.gate(gateKey, 'fx')) return;
    const dt = Math.min(0.06, (now - (last || now)) / 1000);
    last = now;
    if (now - scanAt > 500) { scanAt = now; scan(); }
    if (!entries.size) { cancelAnimationFrame(raf); raf = 0; return; }
    const t = now / 1000;
    const vis = [];
    for (const e of entries.values()) {
      if (!visible(e)) continue;
      vis.push(e);
      const host = e.host || e.cv;
      const target = host.classList.contains('is-pressed') || host.classList.contains('is-inspected') ? 1 : 0;
      e.boost += (target - e.boost) * Math.min(1, dt * 8);
      e.flare = Math.max(0, e.flare - dt / 1.3);
      e.g.imageSmoothingEnabled = false;
      e.painter(e.g, e.cv.width, e.cv.height, t, dt, e);
    }
    // spotlight: one idle element at a time gets a flare
    if (now > nextFlareAt && vis.length) {
      nextFlareAt = now + rnd(2600, 4200);
      const idle = vis.filter((e) => e.boost < 0.1 && e.flare <= 0);
      if (idle.length) {
        // rarer things get picked more often, but everyone gets a turn
        const weights = idle.map((e) => 1 + e.rank * 0.6);
        let r = Math.random() * weights.reduce((a, b) => a + b, 0);
        let pick = idle[0];
        for (let k = 0; k < idle.length; k++) { r -= weights[k]; if (r <= 0) { pick = idle[k]; break; } }
        pick.flare = 1;
        const host = pick.host;
        if (host) { host.classList.remove('lv-flare'); void host.offsetWidth; host.classList.add('lv-flare'); }
      }
    }
  }

  function start() {
    if (raf) return;
    last = 0;
    scanAt = 0;
    raf = requestAnimationFrame(tick);
  }

  // press feedback for touch (no hover on phones)
  const clearPress = () => document.querySelectorAll('.is-pressed').forEach((el) => el.classList.remove('is-pressed'));
  document.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest && ev.target.closest('[data-pressable]');
    if (el && !el.disabled) el.classList.add('is-pressed');
  }, true);
  document.addEventListener('pointerup', clearPress, true);
  document.addEventListener('pointercancel', clearPress, true);

  window.MT.livingUI = { start, rescan: () => { scanAt = 0; start(); }, PAINTERS };
})();
