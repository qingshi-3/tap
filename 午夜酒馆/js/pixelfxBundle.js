/* pixelfx (https://github.com/patch-gg/pixelfx) - MIT License, Copyright (c) 2026 Patch, Copyright (c) 2026 Hugo Duprez */
(function () {
  const __mods = Object.create(null);
  const __cache = Object.create(null);
  function __req(id) {
    if (__cache[id]) return __cache[id].exports;
    const m = (__cache[id] = { exports: {} });
    if (!__mods[id]) throw new Error("pixelfx missing module: " + id);
    __mods[id](m.exports, __req);
    return m.exports;
  }
  __mods["core/index.js"] = function(exports, __req) {
// pixelfx core: everything an effect imports comes from here.

Object.assign(exports, __req("core/math.js"));
Object.assign(exports, __req("core/color.js"));
Object.assign(exports, __req("core/particles.js"));
Object.assign(exports, __req("core/shapes.js"));
const __re_9nlki = __req("core/sim.js"); exports.Particles = __re_9nlki.Particles; exports.Bits = __re_9nlki.Bits; exports.Lights = __re_9nlki.Lights; exports.Blazes = __re_9nlki.Blazes; exports.P = __re_9nlki.P; exports.PF = __re_9nlki.PF; exports.B = __re_9nlki.B; exports.GRAVITY = __re_9nlki.GRAVITY; exports.FIRE_RAMP = __re_9nlki.FIRE_RAMP; exports.SMOKE_RAMP = __re_9nlki.SMOKE_RAMP; exports.sparkle = __re_9nlki.sparkle; exports.flare = __re_9nlki.flare; exports.band = __re_9nlki.band; exports.crystal = __re_9nlki.crystal;
const __re_orgr8 = __req("core/painter.js"); exports.Painter = __re_orgr8.Painter;
const __re_85vtq = __req("core/font.js"); exports.FONTS = __re_85vtq.FONTS; exports.textWidth = __re_85vtq.textWidth;
const __re_jvh01 = __req("core/fx.js"); exports.createFrame = __re_jvh01.createFrame; exports.clearFrame = __re_jvh01.clearFrame; exports.createFx = __re_jvh01.createFx; exports.composite = __re_jvh01.composite; exports.painterFor = __re_jvh01.painterFor; exports.resolveOptions = __re_jvh01.resolveOptions;
const __re_2gpwe = __req("core/actor.js"); exports.stockActor = __re_2gpwe.stockActor; exports.drawActor = __re_2gpwe.drawActor; exports.actorAlphaOf = __re_2gpwe.actorAlphaOf; exports.HERO = __re_2gpwe.HERO; exports.HERO2 = __re_2gpwe.HERO2; exports.HERO_PAL = __re_2gpwe.HERO_PAL; exports.DUMMY_PAL = __re_2gpwe.DUMMY_PAL;
const __re_dfs2b = __req("core/scene.js"); exports.backdrop = __re_dfs2b.backdrop; exports.BACKDROPS = __re_dfs2b.BACKDROPS;
const __re_5frju = __req("core/act.js"); exports.createAct = __re_5frju.createAct; exports.actBounds = __re_5frju.actBounds; exports.actSpan = __re_5frju.actSpan; exports.actTiming = __re_5frju.actTiming; exports.poseAt = __re_5frju.poseAt; exports.lerpPose = __re_5frju.lerpPose; exports.Target = __re_5frju.Target; exports.STAND = __re_5frju.STAND; exports.SKINS = __re_5frju.SKINS; exports.posed = __re_5frju.posed;
const __re_s3v37 = __req("core/rig.js"); exports.skeleton = __re_s3v37.skeleton; exports.posedParts = __re_s3v37.posedParts;
const __re_d2s5a = __req("core/poses.js"); exports.READY = __re_d2s5a.READY;
const __re_8xy5x = __req("core/chain.js"); exports.chain = __re_8xy5x.chain; exports.shiftKeys = __re_8xy5x.shiftKeys; exports.shiftHits = __re_8xy5x.shiftHits;

  };
  __mods["core/math.js"] = function(exports, __req) {
// Numbers, easing, randomness and noise. Everything here is pure and deterministic,
// so an effect drawn at time t always looks the same.

const TAU = Math.PI * 2;

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
const remap = (x, a0, a1, b0, b1) => lerp(b0, b1, invLerp(a0, a1, x));
const fract = (x) => x - Math.floor(x);
const wrap = (x, m) => ((x % m) + m) % m;
/** Progress 0..1 of t through the window [t0, t1]: 0 before it, 1 after it. */
const seg = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
/** Hermite smoothstep of x between e0 and e1. */
const smooth = (e0, e1, x) => {
  const t = seg(x, e0, e1);
  return t * t * (3 - 2 * t);
};
/** 0 → 1 → 0 over the window [t0, t1] (sine bump). */
const bump = (t, t0, t1) => (t <= t0 || t >= t1 ? 0 : Math.sin(Math.PI * seg(t, t0, t1)));
const pingpong = (x) => 1 - Math.abs(wrap(x, 2) - 1);
const dist = (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0);
const angleTo = (x0, y0, x1, y1) => Math.atan2(y1 - y0, x1 - x0);

/** Easing curves: input 0..1, output 0..1 (back and elastic overshoot). */
const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inBack: (t, s = 1.70158) => (t <= 0 ? 0 : t >= 1 ? 1 : (s + 1) * t * t * t - s * t * t),
  outBack: (t, s = 1.70158) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)),
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

/** 32-bit integer hash of any number of integers. */
function hash(...ns) {
  let h = 0x9e3779b9;
  for (const n of ns) {
    h = Math.imul(h ^ (n | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}
/** Deterministic random number in [0, 1) from integers (seed, particle index, which value...). */
const rand = (...ns) => hash(...ns) / 4294967296;

/** Seeded random generator (mulberry32). */
class Rng {
  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p) {
    return this.next() < p;
  }
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  /** Roughly normal, mean 0, sd 1. */
  gauss() {
    return (this.next() + this.next() + this.next() + this.next() - 2) * 1.732;
  }
}
/** A generator for one particle: rng(seed, i) gives the same numbers every frame. */
const rng = (...ns) => new Rng(hash(...ns));

/** Smooth 1D value noise in [-1, 1]. */
function noise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(rand(i, seed), rand(i + 1, seed), u) * 2 - 1;
}
/** Smooth 2D value noise in [-1, 1]. */
function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = rand(ix, iy, seed), b = rand(ix + 1, iy, seed), c = rand(ix, iy + 1, seed), d = rand(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
/** Fractal 2D noise in about [-1, 1]. */
function fbm(x, y, seed = 0, octaves = 3) {
  let s = 0, a = 0.5, n = 0;
  for (let o = 0; o < octaves; o++) {
    s += noise2(x, y, seed + o * 101) * a;
    n += a;
    x *= 2.03;
    y *= 2.03;
    a *= 0.5;
  }
  return s / n;
}
/**
 * 2D value noise whose lattice repeats every px cells in x and py cells in y (0: no repeat). Scroll it by
 * exactly py cells over a loop and the loop has no seam: tileNoise(x, y + phase * py, 0, py).
 */
function tileNoise(x, y, px = 0, py = 0, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = px ? wrap(ix, px) : ix, x1 = px ? wrap(ix + 1, px) : ix + 1;
  const y0 = py ? wrap(iy, py) : iy, y1 = py ? wrap(iy + 1, py) : iy + 1;
  const a = rand(x0, y0, seed), b = rand(x1, y0, seed), c = rand(x0, y1, seed), d = rand(x1, y1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
/** Fractal tileNoise: every octave keeps the repeat, so scrolled fields still loop. */
function tileFbm(x, y, px = 0, py = 0, seed = 0, octaves = 3) {
  let s = 0, a = 0.5, n = 0, k = 1;
  for (let o = 0; o < octaves; o++) {
    s += tileNoise(x * k, y * k, px * k, py * k, seed + o * 101) * a;
    n += a;
    a *= 0.5;
    k *= 2;
  }
  return s / n;
}
/** Noise that loops: the same value at phase 0 and phase 1 (for seamless loops). */
function loopNoise(phase, radius = 1, seed = 0) {
  const a = phase * TAU;
  return noise2(Math.cos(a) * radius + 50, Math.sin(a) * radius + 50, seed);
}

exports.hash = hash;
exports.noise = noise;
exports.noise2 = noise2;
exports.fbm = fbm;
exports.tileNoise = tileNoise;
exports.tileFbm = tileFbm;
exports.loopNoise = loopNoise;
exports.Rng = Rng;
exports.TAU = TAU;
exports.clamp = clamp;
exports.lerp = lerp;
exports.invLerp = invLerp;
exports.remap = remap;
exports.fract = fract;
exports.wrap = wrap;
exports.seg = seg;
exports.smooth = smooth;
exports.bump = bump;
exports.pingpong = pingpong;
exports.dist = dist;
exports.angleTo = angleTo;
exports.ease = ease;
exports.rand = rand;
exports.rng = rng;
  };
  __mods["core/color.js"] = function(exports, __req) {
// Colors are 32-bit integers laid out like ImageData bytes (R, G, B, A in memory),
// so a frame's color buffer can be shown with new ImageData(new Uint8ClampedArray(buf.buffer), w, h).

const {  clamp  } = __req("core/math.js");

const rgb = (r, g, b) => (255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
const red = (c) => c & 255;
const green = (c) => (c >>> 8) & 255;
const blue = (c) => (c >>> 16) & 255;

/** "#rgb" or "#rrggbb" (or a color number, passed through) to a color number. */
function hex(h) {
  if (typeof h === "number") return h;
  let s = h.replace("#", "");
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const v = parseInt(s.slice(0, 6), 16);
  return rgb((v >> 16) & 255, (v >> 8) & 255, v & 255);
}
const toHex = (c) => "#" + [red(c), green(c), blue(c)].map((v) => v.toString(16).padStart(2, "0")).join("");

/** Linear mix of two colors. */
function mix(a, b, t) {
  t = clamp(t);
  return rgb(red(a) + (red(b) - red(a)) * t, green(a) + (green(b) - green(a)) * t, blue(a) + (blue(b) - blue(a)) * t);
}
/** Multiply a color's brightness by k. */
const scale = (c, k) => rgb(Math.min(255, red(c) * k), Math.min(255, green(c) * k), Math.min(255, blue(c) * k));
/** Perceived brightness 0..1. */
const luma = (c) => (0.299 * red(c) + 0.587 * green(c) + 0.114 * blue(c)) / 255;

/** A list of hex strings (dark to bright) to color numbers. */
const ramp = (list) => list.map(hex);
/**
 * Resample a ramp to exactly n steps, keeping its ends (the darkest and brightest stay put). Lets an effect
 * index steps by number (C[5]) whatever length of palette a caller passes.
 */
function fit(r, n) {
  r = r.map(hex);
  if (r.length === n) return r;
  return Array.from({ length: n }, (_, i) => r[Math.round((i * (r.length - 1)) / Math.max(1, n - 1))]);
}
/** The ramp step for t in 0..1, no blending: pixel art picks a color, it doesn't fade between two. */
const at = (r, t) => r[clamp(Math.floor(t * r.length), 0, r.length - 1)];
/** Blended color along a ramp (for light, where smooth is right). */
function blend(r, t) {
  const x = clamp(t) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(x));
  return mix(r[i], r[i + 1], x - i);
}

// Hue-shifted ramps, dark to bright: shadows lean cool or deep, highlights lean warm or white.
// Effects take `palette` as an option, so any of these (or your own) can recolor them.
const PAL = {
  fire: ["#1f0b10", "#4a1118", "#8c1d1c", "#cc3a1a", "#f2701f", "#ffae35", "#ffe27a", "#fff8d6"],
  ember: ["#1a0a0e", "#3d1012", "#701a14", "#a8301a", "#e0561e", "#ff8a2a", "#ffc46a"],
  lava: ["#14060a", "#380a10", "#6e1210", "#ac2410", "#e8501a", "#ff8c2a", "#ffd25a"],
  smoke: ["#0e0c12", "#1d1a22", "#2e2a35", "#433e4b", "#5c5664", "#7b7484", "#a39cab"],
  dust: ["#1c1610", "#33281c", "#4f3f2c", "#6e5a40", "#927a58", "#b89f78", "#dcc8a2"],
  ice: ["#0c1430", "#162c5c", "#1f4f94", "#2f7fcc", "#58b4ec", "#9bdcff", "#d8f4ff", "#ffffff"],
  water: ["#081830", "#0e2e5a", "#14508c", "#1c76bc", "#36a2e0", "#78ccf4", "#c4ecff", "#ffffff"],
  electric: ["#0a0f2e", "#172a78", "#2550d0", "#3f8cff", "#7cc8ff", "#c8f0ff", "#ffffff"],
  volt: ["#24160a", "#5e3a0c", "#a8680f", "#e8a218", "#ffd23c", "#fff08a", "#ffffff"],
  poison: ["#0d1a0c", "#173a14", "#265e18", "#3f8a1e", "#6cb82a", "#a8e04a", "#e0ff8a"],
  holy: ["#2a1c08", "#5a3e10", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#fffbe6", "#ffffff"],
  heal: ["#08201a", "#0f3f2c", "#17663e", "#24924e", "#3ec466", "#7ee88a", "#c8ffc4", "#ffffff"],
  arcane: ["#140a26", "#2b1252", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"],
  shadow: ["#050308", "#0f0a18", "#1c1230", "#2c1a4a", "#432468", "#5e3290", "#8048b8", "#a970e0"],
  blood: ["#14040a", "#3a0a14", "#6a101c", "#a01824", "#d42a30", "#ff5a50", "#ff9a8a"],
  earth: ["#140e0a", "#2a1e14", "#47321e", "#69492a", "#8e6638", "#b88a52", "#dcb47c"],
  stone: ["#0e0e12", "#1c1c24", "#2c2c38", "#42424f", "#5c5c6b", "#7d7d8c", "#a4a4b2", "#d0d0da"],
  gold: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
  leaf: ["#0c1a0e", "#163418", "#225224", "#357530", "#4f9a3a", "#7cc048", "#b4e070", "#e4ffb0"],
  wood: ["#160c06", "#2e1a0c", "#4a2c14", "#6a421e", "#8e5c2c", "#b47c40", "#d8a464"],
  metal: ["#0c0e14", "#1c2230", "#2e3648", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#ffffff"],
  bone: ["#1a1814", "#3a352c", "#5e5648", "#8a806c", "#b8ad96", "#e4dcc8", "#fffaf0"],
  neon: ["#1a0516", "#3d0a33", "#701560", "#b0228f", "#f53cd1", "#ff86e6", "#ffd2f6", "#ffffff"],
  cyber: ["#041418", "#08303a", "#0c5260", "#108088", "#18b4b0", "#4ce8d8", "#b4fff0", "#ffffff"],
  matrix: ["#020a04", "#05200c", "#0a3c16", "#106624", "#1a9a34", "#3cd650", "#a4ffa8", "#e8ffe8"],
  candy: ["#ff4a5a", "#ff9a2a", "#ffe03c", "#5ad84a", "#3cc8ff", "#7a6cff", "#f53cd1"],
  night: ["#07060d", "#0c0a18", "#131026", "#1b1734", "#241f44", "#2f2956"],
};
/** The same ramps as color numbers. */
const RAMP = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, ramp(v)]));

const WHITE = hex("#ffffff");
const BLACK = hex("#000000");
const INK = hex("#0b0a10");
const PATCH = hex("#f53cd1");

exports.hex = hex;
exports.mix = mix;
exports.fit = fit;
exports.blend = blend;
exports.rgb = rgb;
exports.red = red;
exports.green = green;
exports.blue = blue;
exports.toHex = toHex;
exports.scale = scale;
exports.luma = luma;
exports.ramp = ramp;
exports.at = at;
exports.PAL = PAL;
exports.RAMP = RAMP;
exports.WHITE = WHITE;
exports.BLACK = BLACK;
exports.INK = INK;
exports.PATCH = PATCH;
  };
  __mods["core/particles.js"] = function(exports, __req) {
// Particles without a simulation: each one's position is a closed-form function of its age, so an effect
// can be drawn at any time t, scrubbed, looped and rendered to a sprite sheet frame by frame.

const {  rng, clamp  } = __req("core/math.js");

/**
 * Where a particle is after t seconds, launched from (x, y) at (vx, vy) px/s, under gravity g (px/s²,
 * positive is down) and linear drag (1/s). Returns [x, y].
 */
function fly(x, y, vx, vy, t, g = 0, drag = 0) {
  if (drag <= 0) return [x + vx * t, y + vy * t + 0.5 * g * t * t];
  const f = (1 - Math.exp(-drag * t)) / drag, vt = g / drag;
  return [x + vx * f, y + vt * t + (vy - vt) * f];
}
/** Its velocity at t, for streaks that point along the motion. Returns [vx, vy]. */
function flyV(vx, vy, t, g = 0, drag = 0) {
  if (drag <= 0) return [vx, vy + g * t];
  const e = Math.exp(-drag * t), vt = g / drag;
  return [vx * e, vt + (vy - vt) * e];
}

/**
 * n one-shot particles: fn(r, i) with a repeatable rng per particle (the same numbers every frame).
 */
function burst(n, seed, fn) {
  for (let i = 0; i < n; i++) fn(rng(seed, i), i);
}

/**
 * Particles that repeat every `period` seconds, for loops with no seam. Particle i is born at its own
 * phase in the period and lives `life` seconds (a number, or a function of an rng). For every live copy,
 * fn(age, life, r, i) is called; r is a fresh rng for particle i, the same each period.
 */
function cycle(t, period, count, seed, life, fn) {
  for (let i = 0; i < count; i++) {
    const g = rng(seed, i, 911);
    const born = g.next() * period;
    const L = typeof life === "function" ? life(g) : life;
    let age = (((t - born) % period) + period) % period;
    for (; age < L; age += period) fn(age, L, rng(seed, i), i);
  }
}

/**
 * Particles born at a steady rate between t0 and t1 (an emitter that stops): fn(age, life, r, i) for every
 * particle alive at t. rate is particles per second.
 */
function stream(t, t0, t1, rate, seed, life, fn) {
  const n = Math.floor((Math.min(t, t1) - t0) * rate);
  for (let i = 0; i <= n; i++) {
    const born = t0 + i / rate, g = rng(seed, i, 911), L = typeof life === "function" ? life(g) : life;
    const age = t - born;
    if (age >= 0 && age < L) fn(age, L, rng(seed, i), i);
  }
}

/** A simple simulated particle list, for effects that export create() and keep state. */
class Particles {
  constructor() {
    this.list = [];
  }
  /** p: { x, y, vx, vy, life, g?, drag?, ground?, bounce? } plus anything you want to draw with. */
  add(p) {
    p.age = 0;
    p.g ??= 0;
    p.drag ??= 0;
    this.list.push(p);
    return p;
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if ((p.age += dt) >= p.life) {
        this.list.splice(i, 1);
        continue;
      }
      p.vx -= p.vx * p.drag * dt;
      p.vy += p.g * dt - p.vy * p.drag * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.ground !== undefined && p.y > p.ground) {
        p.y = p.ground;
        p.vy = -Math.abs(p.vy) * (p.bounce ?? 0.3);
        p.vx *= 0.7;
      }
    }
  }
  /** Life left, 1 at birth to 0 at death. */
  static k(p) {
    return clamp(1 - p.age / p.life);
  }
}

exports.fly = fly;
exports.flyV = flyV;
exports.burst = burst;
exports.cycle = cycle;
exports.stream = stream;
exports.Particles = Particles;
  };
  __mods["core/shapes.js"] = function(exports, __req) {
// Point lists for shapes effects keep reaching for: lightning paths, stars, polygons, trails.

const {  TAU  } = __req("core/math.js");

/**
 * A jagged lightning path from (x0, y0) to (x1, y1) by midpoint displacement. jag is how far a midpoint
 * may move sideways, as a share of the segment's length. Returns [[x, y], ...].
 */
function bolt(r, x0, y0, x1, y1, { jag = 0.22, depth = 5 } = {}) {
  let pts = [[x0, y0], [x1, y1]];
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      const off = (r.next() * 2 - 1) * jag * L;
      next.push([(ax + bx) / 2 + (-dy / (L || 1)) * off, (ay + by) / 2 + (dx / (L || 1)) * off], pts[i]);
    }
    pts = next;
  }
  return pts;
}

/** Forks off a bolt path: count branches, each up to len px long. Returns a list of paths. */
function forks(r, path, { count = 3, len = 20, jag = 0.3, spread = 0.9 } = {}) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const i = 1 + Math.floor(r.next() * (path.length - 2)), [x, y] = path[i], [px, py] = path[i - 1];
    const a = Math.atan2(y - py, x - px) + (r.next() < 0.5 ? -1 : 1) * spread * (0.4 + 0.6 * r.next());
    const l = len * (0.4 + 0.6 * r.next());
    out.push(bolt(r, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, { jag, depth: 3 }));
  }
  return out;
}

/** A star: n points between radii r1 (tips) and r0 (inner corners). */
function star(cx, cy, r0, r1, n = 5, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, r = i % 2 ? r0 : r1;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/** A regular polygon with n sides. */
function ngon(cx, cy, r, n = 6, rot = 0) {
  return Array.from({ length: n }, (_, i) => [cx + Math.cos(rot + (i * TAU) / n) * r, cy + Math.sin(rot + (i * TAU) / n) * r]);
}

/** Positions of pos(t - i * dt) for i = 0..n-1: a moving thing's trail, newest first. */
function trail(pos, t, n, dt) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(pos(Math.max(0, t - i * dt)));
  return out;
}

exports.bolt = bolt;
exports.forks = forks;
exports.star = star;
exports.ngon = ngon;
exports.trail = trail;
  };
  __mods["core/sim.js"] = function(exports, __req) {
// Simulated particles, debris and lights, for effects that want real physics: sparks that streak and bounce
// off the floor, shards that tumble and settle, vapour and smoke that swell and thin, lights that flare and die.
// Adapted from Sprite Fusion's open-source pixel art VFX (https://www.spritefusion.com/pixel-art-vfx),
// MIT License, Copyright (c) 2026 Hugo Duprez. Units here are art pixels and seconds; draw through a Painter,
// so effects stay in local space and mirror or rotate like any other.

const {  Rng, clamp, TAU  } = __req("core/math.js");
const {  hex, scale, mix, rgb, WHITE  } = __req("core/color.js");

const GRAVITY = 950; // px/s²
const CROSS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const HOT = ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"].map(hex);
/** Fire from white-hot to smouldering, and smoke from fresh to thin: the ramps FIRE puffs and SMOKE walk down. */
const FIRE_RAMP = ["#ffffff", "#fff3a6", "#ffe26b", "#ffc23d", "#ff8a2a", "#f2561d", "#c9281f", "#8a1f17", "#4a1712"].map(hex);
const SMOKE_RAMP = ["#7b6f72", "#5d5660", "#433d48", "#2b2630", "#1a171e"].map(hex);
const rampAt = (r, t) => r[Math.min(r.length - 1, Math.max(0, Math.floor(t * r.length)))];

/** Particle kinds. */
const P = { SPARK: 0, MOTE: 1, STREAK: 2, FLAKE: 3, VAPOUR: 4, DUST: 5, STAR: 6, EMBER: 7, SMOKE: 8, FIRE: 9, BRAND: 10, GRIT: 11 };
/** Particle flags: SMOKES (a FIRE puff leaves smoke when it dies), BIG (bigger, slower smoke), BACK (draw behind). */
const PF = { SMOKES: 1, BIG: 2, BACK: 4 };
const SOFT = new Set([P.VAPOUR, P.DUST, P.SMOKE]);

/**
 * A particle system. opts: { seed, ground: (x) => floor y (local px; sparks bounce on it), sparks: [head..tail]
 * colors for SPARK, haze: color vapour glows with }.
 * spawn(kind, x, y, vx, vy, life, color, size); update(dt); draw(p, layer): "back" draws the soft kinds
 * (vapour, dust, smoke), "front" the rest, nothing for both.
 */
class Particles {
  constructor(opts = {}) {
    this.R = opts.rng ?? new Rng(opts.seed ?? 1);
    this.list = [];
    this.t = 0;
    this.ground = opts.ground ?? (() => Infinity);
    this.sparks = (opts.sparks ?? HOT).map(hex);
    this.haze = opts.haze === undefined ? null : hex(opts.haze);
    this.onLand = opts.onLand ?? null; // (x, y) when a BRAND hits the floor
  }
  /** delay: seconds before it appears; flag: PF bits. col 0 lets FIRE and SMOKE use their own ramps. */
  spawn(k, x, y, vx, vy, life, col = WHITE, size = 1, delay = 0, flag = 0) {
    this.list.push({ k, x, y, vx, vy, life, max: life, col: col ? hex(col) : 0, size, seed: this.R.next() * 100, delay, flag });
  }
  get count() {
    return this.list.length;
  }
  update(dt) {
    this.t += dt;
    const R = this.R, t = this.t;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      if ((p.life -= dt) <= 0) {
        if (p.k === P.FIRE && p.flag & PF.SMOKES) {
          const big = p.flag & PF.BIG;
          this.spawn(P.SMOKE, p.x, p.y, p.vx * 0.6, p.vy * 0.6 - 6, big ? R.range(1.3, 2.3) : R.range(0.8, 1.4), 0, p.size * (big ? 0.85 : 0.7), 0, big ? PF.BIG : 0);
        }
        this.list.splice(i, 1);
        continue;
      }
      switch (p.k) {
        case P.FIRE:
          p.vy -= 95 * dt;
          p.vx += Math.sin(t * 17 + p.seed) * 30 * dt;
          p.vx -= p.vx * 5 * dt;
          p.vy -= p.vy * 3.2 * dt;
          break;
        case P.GRIT: {
          p.vy += GRAVITY * dt;
          p.vx -= p.vx * 0.8 * dt;
          const g = this.ground(p.x), ny = p.y + p.vy * dt;
          p.x += p.vx * dt;
          if (p.vy > 0 && p.y <= g && ny >= g) {
            p.y = g - 0.25;
            if (p.vy > 130 && R.chance(0.4)) (p.vy = -p.vy * 0.25), (p.vx = p.vx * 0.5 + R.range(-10, 10));
            else (p.vx = p.vy = 0), (p.life = Math.min(p.life, 0.5));
          } else p.y = ny;
          continue;
        }
        case P.BRAND: {
          // a burning chunk: arcs, trails flame, and starts a little fire where it lands
          p.vy += GRAVITY * 0.8 * dt;
          p.vx -= p.vx * 0.9 * dt;
          if (R.chance(0.9 * Math.min(1, dt * 60))) this.spawn(P.FIRE, p.x, p.y, p.vx * 0.1 + R.range(-7, 7), p.vy * 0.1 - 10, R.range(0.16, 0.32), 0, R.range(0.9, 1.7) * (0.5 + (p.life / p.max) * 0.6), 0, R.chance(0.4) ? PF.SMOKES : 0);
          const g = this.ground(p.x), ny = p.y + p.vy * dt;
          p.x += p.vx * dt;
          if (p.vy > 0 && p.y <= g && ny >= g) {
            this.onLand?.(p.x, g);
            this.list.splice(i, 1);
          } else p.y = ny;
          continue;
        }
        case P.SPARK: {
          p.vy += GRAVITY * 0.45 * dt;
          p.vx -= p.vx * 2.2 * dt;
          p.vy -= p.vy * 2.2 * dt;
          const g = this.ground(p.x), ny = p.y + p.vy * dt;
          p.x += p.vx * dt;
          if (p.vy > 0 && p.y <= g && ny >= g) (p.vy = -p.vy * 0.45), (p.vx *= 0.7), (p.y = g - 0.25);
          else p.y = ny;
          continue;
        }
        case P.STREAK: (p.vx += p.vx * 3 * dt), (p.vy += p.vy * 3 * dt); break;
        case P.FLAKE:
          p.vx -= p.vx * 2.2 * dt;
          p.vy -= p.vy * 2.2 * dt - 35 * dt;
          p.x += Math.sin(this.t * 2.5 + p.seed) * 7 * dt;
          break;
        case P.EMBER:
          p.vy += (-30 + Math.sin(t * 3 + p.seed) * 20) * dt;
          p.vx += Math.cos(t * 2.3 + p.seed) * 45 * dt;
          p.vx -= p.vx * 1.6 * dt;
          p.vy -= p.vy * 1.6 * dt;
          break;
        case P.SMOKE: {
          const big = p.flag & PF.BIG;
          p.vy -= (big ? 23 : 16) * dt;
          p.vx += Math.sin(t * 1.3 + p.seed) * 8 * dt;
          p.vx -= p.vx * 1.6 * dt;
          p.vy -= p.vy * 1.2 * dt;
          break;
        }
        case P.MOTE: p.vx -= p.vx * 0.6 * dt; p.vy -= p.vy * 0.6 * dt; break;
        default: {
          const drag = SOFT.has(p.k) ? 4 : 1.6;
          p.vx -= p.vx * drag * dt;
          p.vy -= p.vy * drag * dt + 5 * dt;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  draw(p, layer) {
    for (const q of this.list) {
      if (q.delay > 0) continue;
      if (layer && (SOFT.has(q.k) || q.flag & PF.BACK ? "back" : "front") !== layer) continue;
      const k = q.life / q.max, x = q.x, y = q.y, sp = Math.hypot(q.vx, q.vy) || 1, ux = q.vx / sp, uy = q.vy / sp;
      switch (q.k) {
        case P.SPARK: {
          const S = this.sparks, head = k > 0.6 ? S[0] : k > 0.3 ? S[1] : S[2], len = Math.min(9, 1 + sp * 0.022);
          p.line(x - ux * len, y - uy * len, x - ux * len * 0.4, y - uy * len * 0.4, k > 0.5 ? head : S[S.length - 1]);
          p.line(x - ux * len * 0.45, y - uy * len * 0.45, x, y, head);
          p.glow(x, y, 3, head, 0.45 * k);
          break;
        }
        case P.MOTE: {
          const len = Math.min(16, 0.5 + sp * 0.026) * q.size, a = k < 0.35 ? k / 0.35 : 1;
          p.line(x - ux * len, y - uy * len, x - ux * len * 0.35, y - uy * len * 0.35, scale(q.col, 0.55), a);
          p.line(x - ux * len * 0.4, y - uy * len * 0.4, x, y, q.col, a);
          p.glow(x, y, 2.5 + q.size, q.col, 0.4 * k);
          break;
        }
        case P.STREAK: {
          const L = clamp(sp / 30, 1, 7);
          for (let d = L; d >= 0; d -= 0.5) p.dot(x - ux * d, y - uy * d, d < 1 ? WHITE : d < L * 0.5 ? q.col : scale(q.col, 0.6), d < L * 0.5 ? 1 : 1.2 - d / L);
          p.glow(x, y, 4, q.col, 0.4);
          break;
        }
        case P.FLAKE: {
          const a = Math.min(1, k * 3);
          p.dot(x, y, q.col, a);
          if (q.size > 1.3) for (const [dx, dy] of CROSS) p.dot(x + dx, y + dy, scale(q.col, 0.8), a * 0.8);
          break;
        }
        case P.VAPOUR: {
          const r = q.size * (0.6 + (1 - k) * 0.9);
          p.disc(x, y, r, q.col, Math.pow(k, 1.3) * 0.45);
          if (this.haze) p.glow(x, y, r * 1.8, this.haze, 0.16 * k);
          break;
        }
        case P.DUST: p.disc(x, y, q.size * (0.6 + (1 - k) * 0.9), q.col, Math.pow(k, 1.3) * 0.7); break;
        case P.SMOKE: {
          // three soft discs: a body, a denser core sitting low, a lit cap while it's young
          const age = 1 - k, big = q.flag & PF.BIG;
          const r = q.size * (0.65 + Math.min(1, age * 2.5) * 0.45 + age * (big ? 0.5 : 0.4));
          const a = Math.min(1, age * 12) * Math.min(1, k * 2.4) * (big ? 0.7 : 0.58);
          const c = q.col ? mix(q.col, rampAt(SMOKE_RAMP, age), age) : rampAt(SMOKE_RAMP, age * 1.05);
          p.disc(x, y, r, c, a * 0.45);
          p.disc(x + r * 0.05, y + r * 0.06, r * 0.74, c, a * 0.62);
          if (age < 0.5) p.disc(x - r * 0.22, y - r * 0.3, r * 0.5, mix(c, WHITE, 0.12), a * 0.4 * (1 - age * 2));
          break;
        }
        case P.FIRE: {
          // a ball of flame that cools down the ramp as it rises: a darker rim, a lit core, a tongue on top
          const age = 1 - k, heat = Math.min(0.999, Math.pow(age, 0.62) + (q.seed % 1) * 0.1), F = FIRE_RAMP, n = F.length;
          const idx = Math.min(n - 2, Math.floor(heat * (n - 1)));
          const r = q.size * (0.55 + 0.45 * Math.min(1, age * 7)) * (1 - age * 0.55), c = F[idx];
          if (idx >= n - 2) p.disc(x, y, r, c, Math.min(1, k * 3) * 0.85);
          else {
            p.circle(x, y, r, F[Math.min(n - 1, idx + 2)]);
            p.circle(x - r * 0.16, y - r * 0.22, r * 0.78, c);
            if (r > 1.6) p.circle(x, y - r * 0.9, r * 0.42, c);
            if (idx <= 3 && r > 1.8) p.circle(x - r * 0.28, y - r * 0.34, r * 0.36, F[Math.max(0, idx - 1)]);
            if (idx < 6) p.glow(x, y, r * 2.4 + 2, c, 0.18 * k);
          }
          break;
        }
        case P.BRAND:
          p.circle(x, y, 1.6, HOT[3]);
          p.px(x, y, Math.sin(this.t * 40 + q.seed) > 0 ? HOT[0] : HOT[1]);
          p.px(x + 1, y, HOT[1]);
          p.glow(x, y, 7, HOT[2], 0.45);
          break;
        case P.GRIT:
          if (k > 0.25 || k * 4 > 0.5) {
            p.px(x, y, q.col);
            if (q.size >= 2) p.px(x + 1, y, q.col), p.px(x, y + 1, scale(q.col, 0.8)), p.px(x + 1, y + 1, scale(q.col, 0.7));
          }
          break;
        case P.EMBER: {
          const c = k > 0.6 ? this.sparks[0] : k > 0.3 ? this.sparks[1] : this.sparks[2];
          if (k < 0.25 && Math.sin(this.t * 40 + q.seed) < 0) break;
          p.px(x, y, c);
          if (q.size > 1.5) p.px(x, y + 1, this.sparks[this.sparks.length - 1]);
          p.glow(x, y, 3 + q.size, c, 0.35 * k);
          break;
        }
        default: {
          // STAR: a twinkling cross, arms set by size
          const tw = 0.6 + 0.4 * Math.sin(this.t * (8 + (q.seed % 5)) + q.seed);
          if (q.size < 1) {
            if (tw * k > 0.25) p.px(x, y, tw > 0.8 ? WHITE : q.col);
            p.glow(x, y, 3, q.col, 0.4 * k * tw);
            break;
          }
          sparkle(p, x, y, q.size * tw * Math.min(1, k * 3), q.col, scale(q.col, 0.75), 0.5 * k * tw);
        }
      }
    }
  }
}

/**
 * Little fires burning where something landed: add(x, y, life, power) feeds FIRE puffs (and the odd ember)
 * into a particle system, fading over its life. update(dt); drawBack(p) adds a hot pixel and a glow at its foot.
 */
class Blazes {
  constructor(ps) {
    this.ps = ps;
    this.list = [];
  }
  add(x, y, life, power) {
    this.list.push({ x, y, life, max: life, acc: this.ps.R.next(), power });
  }
  get count() {
    return this.list.length;
  }
  update(dt) {
    const ps = this.ps, R = ps.R;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      if ((b.life -= dt) <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      const k = b.life / b.max, intensity = b.power * (k > 0.7 ? 1 : 0.35 + (k / 0.7) * 0.65);
      for (b.acc += dt * (6 + 16 * intensity); b.acc > 1; b.acc--) {
        const s = R.range(1.2, 2.8) * intensity;
        ps.spawn(P.FIRE, b.x + R.range(-1.5, 1.5), b.y - s * 0.6, R.range(-6, 6), R.range(-30, -12), R.range(0.28, 0.6), 0, s, 0, PF.BACK | (R.chance(0.3) ? PF.SMOKES : 0));
        if (R.chance(0.06)) ps.spawn(P.EMBER, b.x, b.y - 1.5, R.range(-15, 15), R.range(-45, -15), R.range(0.6, 1.4), HOT[2], 1, 0, PF.BACK);
      }
    }
  }
  drawBack(p) {
    for (const b of this.list) {
      const k = b.life / b.max;
      p.px(b.x, b.y, k > 0.4 ? (Math.sin(b.life * 31 + b.x) > 0 ? HOT[1] : HOT[2]) : HOT[3]);
      p.glow(b.x, b.y, 6 + 5 * k * b.power, HOT[2], 0.3 * k * b.power);
    }
  }
}

/** Debris kinds. */
const B = { SHARD: 0, CHUNK: 1, DRIP: 2 };

/**
 * Rigid debris that tumbles, bounces and settles. add({ kind, x, y, vx, vy, a, va, s (size), c (color), ramp
 * (chunk shading, dark to bright), g (gravity scale), drag, bounce, life }); update(dt); draw(p).
 */
class Bits {
  constructor(opts = {}) {
    this.list = [];
    this.ground = opts.ground ?? (() => Infinity);
  }
  add(b) {
    const life = b.life ?? 1;
    this.list.push({ kind: B.SHARD, vx: 0, vy: 0, a: 0, va: 0, s: 1, c: WHITE, g: 1, drag: 0, bounce: 0, rest: false, ...b, life, max: life });
  }
  get count() {
    return this.list.length;
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      if ((b.life -= dt) <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      if (b.rest) continue;
      b.vy += GRAVITY * b.g * dt;
      b.vx -= b.vx * b.drag * dt;
      b.vy -= b.vy * b.drag * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.a += b.va * dt;
      const floor = this.ground(b.x), sp = b.vy;
      if (b.g <= 0 || b.y < floor || sp <= 0) continue;
      b.y = floor - 0.01;
      if (b.kind === B.DRIP) b.life = 0;
      else if (b.bounce > 0 && sp > 70) (b.vy = -sp * b.bounce), (b.vx *= 0.7), (b.va *= 0.6);
      else (b.rest = true), (b.vx = b.vy = 0);
    }
  }
  draw(p) {
    for (const b of this.list) {
      const a = Math.min(1, b.life / 0.4), ca = Math.cos(b.a), sa = Math.sin(b.a);
      if (b.kind === B.SHARD) {
        for (let d = -b.s / 2; d <= b.s / 2; d += 0.5) p.dot(b.x + ca * d, b.y + sa * d, d > b.s / 2 - 0.6 ? WHITE : hex(b.c), a);
      } else if (b.kind === B.DRIP) {
        p.dot(b.x, b.y, hex(b.c), a);
        p.dot(b.x, b.y - 1, hex(b.c), a * 0.5);
      } else {
        // a shaded chunk: lit top-left, dark bottom-right, a dark rim
        const R = (b.ramp ?? ["#1c2030", "#3a4a66", "#6e86a8", "#a8c0dc", "#e8f2ff"]).map(hex), n = R.length;
        const x = Math.round(b.x), y = Math.round(b.y), r = Math.ceil(b.s) + 1;
        for (let py = -r; py <= r; py++)
          for (let px = -r; px <= r; px++) {
            const u = (px + 0.5) * ca + (py + 0.5) * sa, v = -(px + 0.5) * sa + (py + 0.5) * ca;
            const d = Math.abs(u) / b.s + Math.abs(v) / (b.s * 0.62);
            if (d > 1.3) continue;
            p.dot(x + px, y + py, d > 1 ? R[0] : v < 0 ? (u < 0 ? R[n - 1] : R[n - 2]) : u < 0 ? R[n - 3] : R[Math.max(1, n - 4)], a);
          }
      }
    }
  }
}

/** Lights that flare and die: add(x, y, r, color, k, life); update(dt); draw(p). */
class Lights {
  constructor() {
    this.list = [];
  }
  add(x, y, r, color, k, life) {
    this.list.push({ x, y, r, color: hex(color), k, life, max: life });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) if ((this.list[i].life -= dt) <= 0) this.list.splice(i, 1);
  }
  draw(p) {
    for (const l of this.list) {
      const k = l.life / l.max;
      p.glow(l.x, l.y, l.r * (0.55 + 0.45 * k), l.color, l.k * k * k);
    }
  }
}

/** A star glint: arms of length arm in color c with tips in tip, a white heart, light. */
function sparkle(p, x, y, arm, c, tip = c, k = 0.6) {
  const n = Math.round(arm);
  if (n < 1) return;
  const X = Math.floor(x), Y = Math.floor(y);
  for (let d = 1; d <= n; d++) {
    const cc = d > n * 0.6 ? tip : c;
    for (const [dx, dy] of CROSS) p.px(X + dx * d, Y + dy * d, cc);
  }
  if (n >= 3) for (const [dx, dy] of DIAG) p.px(X + dx, Y + dy, c);
  if (n >= 6) for (const [dx, dy] of DIAG) p.px(X + dx * 2, Y + dy * 2, tip);
  p.px(X, Y, WHITE);
  p.glow(x, y, 4 + n * 2, c, k);
}

/** An 8-ray flare: long rays on the axes, shorter between, fading out along their length. ramp dark to bright. */
function flare(p, x, y, L, k, ramp) {
  if (L < 1) return;
  const R = ramp.map(hex), n = R.length;
  for (let i = 0; i < 8; i++) {
    const an = (i * Math.PI) / 4, len = i % 4 === 0 ? L : i % 2 === 0 ? L * 0.6 : L * 0.3, ca = Math.cos(an), sa = Math.sin(an);
    for (let d = 0; d <= len; d += 0.5) {
      const u = d / len;
      p.dot(x + ca * d, y + sa * d, u < 0.35 ? WHITE : u < 0.7 ? R[n - 2] : R[n - 3], u < 0.6 ? 1 : k * 1.5 * (1 - u) + 0.2);
    }
  }
}

/**
 * A ring on a tilted plane (sy squashes it: 0.16 lies on the floor, 1 stands up), thickness th inward, alpha k,
 * colored by depth through the band with ramp (dark to bright). keep(angle) picks which part to draw, so the
 * far half can go behind things and the near half in front: (g) => Math.sin(g) < 0 is the far half.
 */
function band(p, cx, cy, r, sy, th, k, ramp, keep = () => true, hot = false) {
  if (r <= 0 || k <= 0) return;
  const R = ramp.map(hex), n = R.length;
  for (let j = 0, m = Math.ceil(r * TAU * 1.2); j < m; j++) {
    const ang = (j / m) * TAU, ca = Math.cos(ang), sa = Math.sin(ang);
    if (!keep(ang)) continue;
    for (let o = th; o >= 0; o -= 0.5) {
      const u = o / th, c = u < 0.15 ? (hot ? WHITE : R[n - 1]) : u < 0.4 ? R[n - 2] : u < 0.7 ? R[n - 3] : R[n - 4];
      p.dot(cx + ca * (r - o), cy + sa * (r - o) * sy, c, k * (u < 0.4 ? 1.2 : 1.15 - u));
    }
  }
}

/**
 * A faceted crystal spike standing on (x, base), height h, base width w, leaning lean px at the tip, shaded in
 * ramp (dark to bright, 6+ steps): a lit ridge, a bright left face, a darker right face, a dark rim.
 * opts: { a (alpha), white (flash it white), glint (0..1 height of a sweeping highlight, or -1) }.
 */
function crystal(p, x, base, h, w, lean, ramp, opts = {}) {
  if (h < 1.5) return;
  const R = ramp.map(hex), n = R.length, C = (i) => R[Math.max(0, n - 1 - i)];
  const a = opts.a ?? 1, top = base - h, ridge0 = x - w * 0.14, glint = opts.glint ?? -1;
  const inside = (px, py) => {
    const u = (base - (py + 0.5)) / h;
    return u >= 0 && u <= 1 && Math.abs(px + 0.5 - (x + lean * u)) <= (w / 2) * (1 - u) + 0.35;
  };
  for (let py = Math.floor(top) - 1; py < Math.ceil(base); py++)
    for (let px = Math.floor(x - w / 2 - Math.abs(lean) - 2); px <= Math.ceil(x + w / 2 + Math.abs(lean) + 2); px++) {
      if (!inside(px, py)) {
        if (inside(px - 1, py) || inside(px + 1, py) || inside(px, py + 1) || (inside(px, py - 1) && py < base - 1)) p.dot(px, py, R[0], a);
        continue;
      }
      if (opts.white) {
        p.dot(px, py, WHITE, a);
        continue;
      }
      const u = (base - (py + 0.5)) / h, rx = ridge0 + (x + lean - ridge0) * u, c = x + lean * u, hw = (w / 2) * (1 - u) + 0.35, fx = px + 0.5;
      let col = u > 0.9 ? WHITE : Math.abs(fx - rx) < 0.55 ? C(1)
        : fx < rx ? (fx - (c - hw) < 1 ? C(1) : (fx - (c - hw)) / Math.max(1, rx - (c - hw)) > 0.55 ? C(2) : C(3))
        : c + hw - fx < 1.2 ? C(Math.min(n - 2, 6)) : (fx - rx) / Math.max(1, c + hw - rx) > 0.5 ? C(5) : C(4);
      if (glint >= 0 && fx <= rx + 0.6) {
        const g = Math.abs(u - glint);
        if (g < 0.05) col = WHITE;
        else if (g < 0.1) col = C(1);
      }
      p.dot(px, py, col, a);
    }
}

exports.sparkle = sparkle;
exports.flare = flare;
exports.band = band;
exports.crystal = crystal;
exports.Particles = Particles;
exports.Blazes = Blazes;
exports.Bits = Bits;
exports.Lights = Lights;
exports.GRAVITY = GRAVITY;
exports.FIRE_RAMP = FIRE_RAMP;
exports.SMOKE_RAMP = SMOKE_RAMP;
exports.P = P;
exports.PF = PF;
exports.B = B;
  };
  __mods["core/painter.js"] = function(exports, __req) {
// The painter draws into a frame's two buffers: `color` (opaque pixels, faded with ordered dither, never
// blended) and `light` (additive glow, composited on top). Effects draw in local coordinates around their
// origin; the painter places, mirrors and rotates them, so an effect never needs to know where it is.

const {  clamp  } = __req("core/math.js");
const {  hex  } = __req("core/color.js");
const {  rasterText, textWidth, FONTS  } = __req("core/font.js");

// 4x4 ordered (Bayer) thresholds: a pixel at alpha a is drawn when a is above its cell's threshold.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const OUT = { c: 0, a: 1, l: 0, k: 0 };
const sprites = new WeakMap();
const call = (v, ...args) => (typeof v === "function" ? v(...args) : v);

class Painter {
  constructor(frame) {
    this.frame = frame;
    this.reset();
  }

  /** Re-read the frame and clear placement, fade and light strength. */
  reset() {
    const f = this.frame;
    this.w = f.w; this.h = f.h; this.ox = f.ox | 0; this.oy = f.oy | 0; this.C = f.color; this.L = f.light;
    this.tx = 0; this.ty = 0; this.fx = 1; this.cs = 1; this.sn = 0;
    this.fade = 1; this.lightK = 1; this.layer = "front";
    return this;
  }

  /** Put the effect's origin at (x, y) in frame space, mirrored if flip, rotated by angle (radians). */
  place(x, y, flip = false, angle = 0) {
    this.tx = x; this.ty = y; this.fx = flip ? -1 : 1; this.cs = Math.cos(angle); this.sn = Math.sin(angle);
    return this;
  }

  // ---- transforms: local (effect) space <-> screen (frame) space
  toX(x, y) { return this.tx + x * this.fx * this.cs - y * this.sn; }
  toY(x, y) { return this.ty + x * this.fx * this.sn + y * this.cs; }
  fromX(sx, sy) { const dx = sx - this.tx, dy = sy - this.ty; return (dx * this.cs + dy * this.sn) * this.fx; }
  fromY(sx, sy) { const dx = sx - this.tx, dy = sy - this.ty; return -dx * this.sn + dy * this.cs; }
  // the screen pixel of the local pixel cell holding (x, y): mirrors and rotations land on whole cells
  cellX(x, y) { return Math.floor(this.toX(Math.floor(x) + 0.5, Math.floor(y) + 0.5)); }
  cellY(x, y) { return Math.floor(this.toY(Math.floor(x) + 0.5, Math.floor(y) + 0.5)); }

  // ---- raw writes, screen space, whole pixels. Color 0 means "nothing": it never erases what's there.
  put(sx, sy, c, a = 1) {
    if (!c) return;
    a *= this.fade;
    if (a < 1 && a <= BAYER[((sy & 3) << 2) | (sx & 3)]) return;
    const x = sx - this.ox, y = sy - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.C[y * this.w + x] = c;
  }
  add(sx, sy, c, k = 1) {
    k *= this.fade * this.lightK;
    if (k <= 0.004) return;
    const x = sx - this.ox, y = sy - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x, d = this.L[i];
    const r = Math.min(255, (d & 255) + (c & 255) * k) | 0;
    const g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k) | 0;
    const b = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k) | 0;
    this.L[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  /**
   * Blend a color over what's there at alpha a (0..1), keeping the result's own alpha: soft smoke, vapour and
   * mist. Use dithered dot() for hard pixel fades and blend() for translucent volumes.
   */
  blendPx(sx, sy, c, a) {
    a *= this.fade;
    if (!c || a <= 0.004) return;
    const x = sx - this.ox, y = sy - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x, d = this.C[i], da = (d >>> 24) / 255, oa = a + da * (1 - a), k = a / oa;
    const ch = (s) => ((((c >>> s) & 255) * k + ((d >>> s) & 255) * (1 - k)) & 255);
    this.C[i] = (((oa * 255) & 255) << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0);
  }
  /** Translucent pixel at a local point. */
  blend(x, y, c, a) { this.blendPx(this.cellX(x, y), this.cellY(x, y), c, a); }
  /** A translucent disc: puffs of smoke, vapour, dust. c and a may be functions of (d: 0 center..1 rim, angle). */
  disc(cx, cy, r, c, a) {
    if (r < 0.5) return this.blend(cx, cy, call(c, 0, 0), call(a, 0, 0));
    this.each(cx - r, cy - r, cx + r, cy + r, (x, y, sx, sy) => {
      const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
      if (d2 > r * r) return;
      const d = Math.sqrt(d2) / r, ang = Math.atan2(dy, dx);
      this.blendPx(sx, sy, call(c, d, ang), call(a, d, ang));
    });
  }
  /** Read back the color under a local point (0 if empty). */
  get(x, y) {
    const sx = this.cellX(x, y) - this.ox, sy = this.cellY(x, y) - this.oy;
    return sx < 0 || sy < 0 || sx >= this.w || sy >= this.h ? 0 : this.C[sy * this.w + sx];
  }

  // ---- pixels
  /** One opaque pixel. */
  px(x, y, c) { this.put(this.cellX(x, y), this.cellY(x, y), c, 1); }
  /** One pixel at alpha a (0..1), faded by ordered dither. */
  dot(x, y, c, a = 1) { if (a > 0) this.put(this.cellX(x, y), this.cellY(x, y), c, a); }
  /** Add light to one pixel. */
  light(x, y, c, k = 1) { this.add(this.cellX(x, y), this.cellY(x, y), c, k); }

  /**
   * Visit every screen pixel whose center falls in the local box [x0, x1] x [y0, y1], with that center in
   * local space: fn(lx, ly, sx, sy). The basis of every filled shape, so shapes mirror and rotate exactly.
   */
  each(x0, y0, x1, y1, fn) {
    let ax = Infinity, bx = -Infinity, ay = Infinity, by = -Infinity;
    for (let k = 0; k < 4; k++) {
      const x = k & 1 ? x1 : x0, y = k & 2 ? y1 : y0, sx = this.toX(x, y), sy = this.toY(x, y);
      if (sx < ax) ax = sx; if (sx > bx) bx = sx; if (sy < ay) ay = sy; if (sy > by) by = sy;
    }
    const sx0 = Math.max(Math.floor(ax), this.ox), sx1 = Math.min(Math.ceil(bx), this.ox + this.w - 1);
    const sy0 = Math.max(Math.floor(ay), this.oy), sy1 = Math.min(Math.ceil(by), this.oy + this.h - 1);
    for (let sy = sy0; sy <= sy1; sy++)
      for (let sx = sx0; sx <= sx1; sx++) {
        const cx = sx + 0.5, cy = sy + 0.5;
        fn(this.fromX(cx, cy), this.fromY(cx, cy), sx, sy);
      }
  }

  /**
   * A pixel shader over a local box. fn(x, y, out) returns a color, or sets out.c (color), out.a (alpha),
   * out.l (light color, defaults to out.c) and out.k (light amount). Return nothing to leave the pixel alone.
   */
  shade(x0, y0, x1, y1, fn) {
    const o = OUT;
    this.each(x0, y0, x1, y1, (lx, ly, sx, sy) => {
      o.c = 0; o.a = 1; o.l = 0; o.k = 0;
      const c = fn(lx, ly, o) || o.c;
      if (c) this.put(sx, sy, c, o.a);
      if (o.k > 0) this.add(sx, sy, o.l || c, o.k);
    });
  }

  // ---- shapes. Colors (c) and alphas (a) can be numbers or functions of the shape's own coordinates.
  /** 1 px line. c and a may be functions of u (0 at the start, 1 at the end). */
  line(x0, y0, x1, y1, c, a = 1) {
    let sx = this.cellX(x0, y0), sy = this.cellY(x0, y0);
    const ex = this.cellX(x1, y1), ey = this.cellY(x1, y1);
    const dx = Math.abs(ex - sx), dy = -Math.abs(ey - sy), stepx = sx < ex ? 1 : -1, stepy = sy < ey ? 1 : -1;
    const n = Math.max(dx, -dy) || 1, fc = typeof c === "function", fa = typeof a === "function";
    let err = dx + dy, i = 0;
    for (;;) {
      const u = i++ / n;
      this.put(sx, sy, fc ? c(u) : c, fa ? a(u) : a);
      if (sx === ex && sy === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; sx += stepx; }
      if (e2 <= dx) { err += dx; sy += stepy; }
    }
  }
  /** Lines through a list of points [[x, y], ...]. */
  polyline(pts, c, a = 1) {
    for (let i = 1; i < pts.length; i++) this.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, a);
  }
  /** Thick segment with round ends. c and a may be functions of (u along, v across: 0 center, 1 edge). */
  beam(x0, y0, x1, y1, width, c, a = 1) {
    const r = width / 2, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
    this.shade(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, (x, y, o) => {
      const u = clamp(((x - x0) * dx + (y - y0) * dy) / L2), px = x0 + dx * u - x, py = y0 + dy * u - y;
      const d2 = px * px + py * py;
      if (d2 > r * r) return;
      const v = Math.sqrt(d2) / r;
      o.c = call(c, u, v);
      o.a = call(a, u, v);
    });
  }
  /** Filled disc. c and a may be functions of (d: 0 center to 1 rim, angle). */
  circle(cx, cy, r, c, a = 1) {
    if (r < 0.6) return this.dot(cx, cy, call(c, 0, 0), call(a, 0, 0));
    this.shade(cx - r, cy - r, cx + r, cy + r, (x, y, o) => {
      const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
      if (d2 > r * r) return;
      const d = Math.sqrt(d2) / r, ang = Math.atan2(dy, dx);
      o.c = call(c, d, ang);
      o.a = call(a, d, ang);
    });
  }
  /** Ellipse. c and a may be functions of (d: 0 center to 1 rim, angle). */
  ellipse(cx, cy, rx, ry, c, a = 1) {
    if (rx <= 0 || ry <= 0) return;
    this.shade(cx - rx, cy - ry, cx + rx, cy + ry, (x, y, o) => {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, d2 = dx * dx + dy * dy;
      if (d2 > 1) return;
      const d = Math.sqrt(d2), ang = Math.atan2(dy, dx);
      o.c = call(c, d, ang);
      o.a = call(a, d, ang);
    });
  }
  /** Ring from radius r - w to r. c and a may be functions of (v: 0 inner to 1 outer, angle). */
  ring(cx, cy, r, w, c, a = 1) {
    const r0 = Math.max(0, r - w);
    this.shade(cx - r, cy - r, cx + r, cy + r, (x, y, o) => {
      const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
      if (d2 > r * r || d2 < r0 * r0) return;
      const v = w > 0 ? (Math.sqrt(d2) - r0) / (r - r0 || 1) : 1, ang = Math.atan2(dy, dx);
      o.c = call(c, v, ang);
      o.a = call(a, v, ang);
    });
  }
  /**
   * Band of a ring from angle a0 to a1 (radians, a1 > a0), radius r - w to r: the slash and smear shape.
   * c and a may be functions of (u: 0 at a0 to 1 at a1, v: 0 inner to 1 outer). w can be a function of u
   * for a crescent that tapers at both ends.
   */
  arc(cx, cy, r, w, a0, a1, c, a = 1) {
    const span = a1 - a0, wf = typeof w === "function";
    this.shade(cx - r, cy - r, cx + r, cy + r, (x, y, o) => {
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) return;
      let ang = Math.atan2(dy, dx) - a0;
      ang -= Math.floor(ang / (Math.PI * 2)) * Math.PI * 2;
      if (ang > span) return;
      const u = ang / span, ww = wf ? w(u) : w;
      if (ww <= 0 || d < r - ww) return;
      const v = (d - (r - ww)) / ww;
      o.c = call(c, u, v);
      o.a = call(a, u, v);
    });
  }
  /** Filled rectangle. */
  rect(x, y, w, h, c, a = 1) {
    if (this.sn === 0) {
      const X0 = Math.round(x), Y0 = Math.round(y), X1 = Math.round(x + w), Y1 = Math.round(y + h);
      for (let yy = Y0; yy < Y1; yy++) for (let xx = X0; xx < X1; xx++) this.put(this.cellX(xx, yy), this.cellY(xx, yy), c, a);
      return;
    }
    this.shade(x, y, x + w, y + h, (lx, ly, o) => {
      if (lx < x || ly < y || lx >= x + w || ly >= y + h) return;
      o.c = c; o.a = a;
    });
  }
  /** Filled polygon from points [[x, y], ...] (even-odd rule). */
  poly(pts, c, a = 1) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const n = pts.length;
    this.shade(x0, y0, x1, y1, (x, y, o) => {
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (!inside) return;
      o.c = call(c, x, y);
      o.a = call(a, x, y);
    });
  }
  tri(x0, y0, x1, y1, x2, y2, c, a = 1) { this.poly([[x0, y0], [x1, y1], [x2, y2]], c, a); }

  // ---- light
  /** Radial glow into the light buffer: k at the center, falling to 0 at radius r. */
  glow(x, y, r, c, k = 0.5) {
    if (r < 1 || k <= 0.004) return;
    const cx = this.toX(x, y), cy = this.toY(x, y);
    const x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r), y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
    for (let sy = y0; sy <= y1; sy++) {
      const dy = (sy + 0.5 - cy) / r;
      for (let sx = x0; sx <= x1; sx++) {
        const dx = (sx + 0.5 - cx) / r, d = dx * dx + dy * dy;
        if (d >= 1) continue;
        const f = 1 - Math.sqrt(d);
        this.add(sx, sy, c, f * f * k);
      }
    }
  }
  /** Glow around a segment (a soft beam of light). */
  glowLine(x0, y0, x1, y1, r, c, k = 0.5) {
    if (r < 1 || k <= 0.004) return;
    const ax = this.toX(x0, y0), ay = this.toY(x0, y0), bx = this.toX(x1, y1), by = this.toY(x1, y1);
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    const X0 = Math.floor(Math.min(ax, bx) - r), X1 = Math.ceil(Math.max(ax, bx) + r);
    const Y0 = Math.floor(Math.min(ay, by) - r), Y1 = Math.ceil(Math.max(ay, by) + r);
    for (let sy = Y0; sy <= Y1; sy++)
      for (let sx = X0; sx <= X1; sx++) {
        const px = sx + 0.5, py = sy + 0.5, u = clamp(((px - ax) * dx + (py - ay) * dy) / L2);
        const ex = ax + dx * u - px, ey = ay + dy * u - py, d = Math.sqrt(ex * ex + ey * ey) / r;
        if (d >= 1) continue;
        const f = 1 - d;
        this.add(sx, sy, c, f * f * k);
      }
  }
  /** Glow hugging a circle of radius R (a shockwave's light), falling off over width r. */
  glowRing(x, y, R, r, c, k = 0.5) {
    if (r < 1 || k <= 0.004) return;
    const cx = this.toX(x, y), cy = this.toY(x, y), E = R + r;
    for (let sy = Math.floor(cy - E); sy <= Math.ceil(cy + E); sy++)
      for (let sx = Math.floor(cx - E); sx <= Math.ceil(cx + E); sx++) {
        const d = Math.abs(Math.hypot(sx + 0.5 - cx, sy + 0.5 - cy) - R) / r;
        if (d >= 1) continue;
        const f = 1 - d;
        this.add(sx, sy, c, f * f * k);
      }
  }

  // ---- sprites, text, masks
  /**
   * A little sprite from strings: rows like ["..##..", ".#oo#."], pal maps characters to colors
   * ({ "#": "#222034", o: 0xff... }); "." and " " are empty. Top-left at (x, y).
   * opts: { scale, a, flip (mirror left-right), flipY (upside down), tint (draw every pixel in one color) }.
   */
  sprite(rows, pal, x, y, opts = {}) {
    let s = sprites.get(rows);
    if (!s) sprites.set(rows, (s = rows.map((r) => [...r])));
    const k = opts.scale ?? 1, a = opts.a ?? 1, W = s[0]?.length ?? 0, cache = {};
    for (let r = 0; r < s.length; r++)
      for (let q = 0; q < s[r].length; q++) {
        const ch = s[r][q];
        if (ch === "." || ch === " ") continue;
        let c = opts.tint;
        if (c === undefined) {
          c = cache[ch];
          if (c === undefined) c = cache[ch] = pal[ch] === undefined ? 0 : hex(pal[ch]);
        }
        if (!c) continue;
        const col = opts.flip ? W - 1 - q : q, row = opts.flipY ? s.length - 1 - r : r;
        if (k === 1) this.dot(x + col, y + row, c, a);
        else this.rect(x + col * k, y + row * k, k, k, c, a);
      }
  }
  /**
   * Pixel text. opts: { font: "mini" (3x5) | "big" (5x7), scale, align: "left" | "center" | "right",
   * outline: color, shadow: color, a }. (x, y) is the top of the text, at the left, center or right.
   */
  text(str, x, y, c, opts = {}) {
    const font = opts.font ?? "mini", k = opts.scale ?? 1, a = opts.a ?? 1, w = textWidth(str, font) * k;
    const left = Math.round(opts.align === "center" ? x - w / 2 : opts.align === "right" ? x - w : x), top = Math.round(y);
    const ol = opts.outline, sh = opts.shadow;
    if (ol !== undefined) rasterText(str, font, (gx, gy) => this.rect(left + gx * k - 1, top + gy * k - 1, k + 2, k + 2, ol, a));
    if (sh !== undefined) rasterText(str, font, (gx, gy) => this.rect(left + gx * k + 1, top + gy * k + 1, k, k, sh, a));
    rasterText(str, font, (gx, gy) => this.rect(left + gx * k, top + gy * k, k, k, call(c, gx, gy), a));
  }
  /** Size of text in pixels: [w, h]. */
  measure(str, opts = {}) {
    const k = opts.scale ?? 1;
    return [textWidth(str, opts.font ?? "mini") * k, FONTS[opts.font ?? "mini"].h * k];
  }
  /** Fill a mask ({ w, h, data }) with its top-left at (x, y). c may be a function of (mx, my). */
  mask(m, x, y, c, a = 1) {
    for (let my = 0; my < m.h; my++)
      for (let mx = 0; mx < m.w; mx++) if (m.data[my * m.w + mx]) this.dot(x + mx, y + my, call(c, mx, my), call(a, mx, my));
  }
  /** The 1 px outline just outside a mask. */
  outline(m, x, y, c, a = 1) {
    const at = (mx, my) => mx >= 0 && my >= 0 && mx < m.w && my < m.h && m.data[my * m.w + mx];
    for (let my = -1; my <= m.h; my++)
      for (let mx = -1; mx <= m.w; mx++)
        if (!at(mx, my) && (at(mx - 1, my) || at(mx + 1, my) || at(mx, my - 1) || at(mx, my + 1)))
          this.dot(x + mx, y + my, call(c, mx, my), call(a, mx, my));
  }
}

exports.Painter = Painter;
  };
  __mods["core/font.js"] = function(exports, __req) {
// Two pixel fonts: "mini" (3x5) for small numbers and tags, "big" (5x7) for words like LEVEL UP.
// Glyphs are trimmed to their inked columns, so text sets proportionally (an I is narrower than an M).

const MINI = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.",
  E: "###|#..|##.|#..|###", F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#",
  I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.", K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###",
  M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.", P: "##.|#.#|##.|#..|#..",
  Q: ".#.|#.#|#.#|##.|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#",
  Y: "#.#|#.#|.#.|.#.|.#.", Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "##.|..#|.#.|#..|###", 3: "##.|..#|.#.|..#|##.",
  4: "#.#|#.#|###|..#|..#", 5: "###|#..|##.|..#|##.", 6: ".##|#..|###|#.#|###", 7: "###|..#|.#.|.#.|.#.",
  8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|##.",
  "+": "...|.#.|###|.#.|...", "-": "...|...|###|...|...", "!": "#|#|#|.|#", "?": "##.|..#|.#.|...|.#.",
  ".": ".|.|.|.|#", ",": "..|..|..|.#|#.", ":": ".|#|.|#|.", "/": "..#|..#|.#.|#..|#..",
  "%": "#.#|..#|.#.|#..|#.#", x: "...|#.#|.#.|#.#|...", "*": "#.#|.#.|#.#|...|...", "'": "#|#|.|.|.",
  "(": ".#|#.|#.|#.|.#", ")": "#.|.#|.#|.#|#.", "<": "..#|.#.|#..|.#.|..#", ">": "#..|.#.|..#|.#.|#..",
  "=": "...|###|...|###|...", _: "...|...|...|...|###", "#": "#.#|###|#.#|###|#.#",
};

const BIG = {
  A: ".###.|#...#|#...#|#####|#...#|#...#|#...#", B: "####.|#...#|#...#|####.|#...#|#...#|####.",
  C: ".###.|#...#|#....|#....|#....|#...#|.###.", D: "####.|#...#|#...#|#...#|#...#|#...#|####.",
  E: "#####|#....|#....|####.|#....|#....|#####", F: "#####|#....|#....|####.|#....|#....|#....",
  G: ".###.|#...#|#....|#.###|#...#|#...#|.####", H: "#...#|#...#|#...#|#####|#...#|#...#|#...#",
  I: "###|.#.|.#.|.#.|.#.|.#.|###", J: "..###|...#.|...#.|...#.|...#.|#..#.|.##..",
  K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#", L: "#....|#....|#....|#....|#....|#....|#####",
  M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#", N: "#...#|#...#|##..#|#.#.#|#..##|#...#|#...#",
  O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.", P: "####.|#...#|#...#|####.|#....|#....|#....",
  Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#", R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
  S: ".####|#....|#....|.###.|....#|....#|####.", T: "#####|..#..|..#..|..#..|..#..|..#..|..#..",
  U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.", V: "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
  W: "#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.", X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
  Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..", Z: "#####|....#|...#.|..#..|.#...|#....|#####",
  0: ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.", 1: ".#.|##.|.#.|.#.|.#.|.#.|###",
  2: ".###.|#...#|....#|...#.|..#..|.#...|#####", 3: "#####|...#.|..#..|...#.|....#|#...#|.###.",
  4: "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.", 5: "#####|#....|####.|....#|....#|#...#|.###.",
  6: "..##.|.#...|#....|####.|#...#|#...#|.###.", 7: "#####|....#|...#.|..#..|.#...|.#...|.#...",
  8: ".###.|#...#|#...#|.###.|#...#|#...#|.###.", 9: ".###.|#...#|#...#|.####|....#|...#.|.##..",
  "!": "#|#|#|#|#|.|#", "?": ".###.|#...#|....#|...#.|..#..|.....|..#..", "+": ".....|..#..|..#..|#####|..#..|..#..|.....",
  "-": "....|....|....|####|....|....|....", ".": ".|.|.|.|.|.|#", ",": "..|..|..|..|..|.#|#.", ":": ".|.|#|.|.|#|.",
  "/": "....#|....#|...#.|..#..|.#...|#....|#....", "%": "##...|##..#|...#.|..#..|.#...|#..##|...##",
  x: ".....|.....|#...#|.#.#.|..#..|.#.#.|#...#", "*": ".....|..#..|#.#.#|.###.|#.#.#|..#..|.....", "'": "#|#|.|.|.|.|.",
  "<": "...#|..#.|.#..|#...|.#..|..#.|...#", ">": "#...|.#..|..#.|...#|..#.|.#..|#...", "=": "....|....|####|....|####|....|....",
  "(": "..#|.#.|#..|#..|#..|.#.|..#", ")": "#..|.#.|..#|..#|..#|.#.|#..", "#": ".#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.",
};

function build(table, h) {
  const out = {};
  for (const [ch, src] of Object.entries(table)) {
    const rows = src.split("|");
    out[ch] = { w: rows[0].length, rows: rows.map((r) => [...r].map((c) => c === "#")) };
    if (rows.length !== h) throw new Error(`glyph ${ch} has ${rows.length} rows, expected ${h}`);
  }
  return out;
}

const FONTS = {
  mini: { h: 5, space: 2, gap: 1, glyphs: build(MINI, 5) },
  big: { h: 7, space: 3, gap: 1, glyphs: build(BIG, 7) },
};

/** Width in font pixels of a string (before scaling). */
function textWidth(str, font = "mini") {
  const F = FONTS[font];
  let w = 0;
  for (const ch of String(str)) {
    const g = F.glyphs[ch] ?? F.glyphs[ch.toUpperCase()];
    w += (g ? g.w : F.space) + F.gap;
  }
  return Math.max(0, w - F.gap);
}

/** Calls plot(x, y) for every inked font pixel of str, with the top-left of the text at (0, 0). */
function rasterText(str, font, plot) {
  const F = FONTS[font];
  let x = 0;
  for (const ch of String(str)) {
    const g = F.glyphs[ch] ?? F.glyphs[ch.toUpperCase()];
    if (!g) {
      x += F.space + F.gap;
      continue;
    }
    for (let r = 0; r < F.h; r++) for (let c = 0; c < g.w; c++) if (g.rows[r][c]) plot(x + c, r);
    x += g.w + F.gap;
  }
}

exports.textWidth = textWidth;
exports.rasterText = rasterText;
exports.FONTS = FONTS;
  };
  __mods["core/fx.js"] = function(exports, __req) {
// Frames and live effect instances.

const {  Painter  } = __req("core/painter.js");
const {  clamp  } = __req("core/math.js");
const {  stockActor  } = __req("core/actor.js");
const {  fit, toHex  } = __req("core/color.js");

/**
 * A frame: w x h pixels whose top-left sits at (ox, oy) in world space. `color` holds opaque pixels,
 * `light` additive glow; composite() puts them together. Same shape as Sprite Fusion's VFX frames.
 */
function createFrame(w, h, ox = 0, oy = 0) {
  return { w, h, ox, oy, color: new Uint32Array(w * h), light: new Uint32Array(w * h) };
}
function clearFrame(f) {
  f.color.fill(0);
  f.light.fill(0);
  return f;
}

const painters = new WeakMap();
/** The painter for a frame (one per frame, reused). */
function painterFor(frame) {
  let p = painters.get(frame);
  if (!p) painters.set(frame, (p = new Painter(frame)));
  return p.reset();
}

const FADE = 0.3;

const isRamp = (v) => Array.isArray(v) && v.length > 0 && v.every((c) => typeof c === "number" || /^#[0-9a-f]{3,8}$/i.test(c));

/**
 * An effect's options: its defaults with the caller's on top. Any color ramp (palette, or another ramp option
 * like dust or smoke) of a different length than its default is resampled to the default's length, so effects
 * can index steps by number whatever a caller passes.
 */
function resolveOptions(meta, o = {}) {
  const opts = { ...(meta.options ?? {}), ...o };
  for (const [k, def] of Object.entries(meta.options ?? {}))
    if (isRamp(def) && isRamp(o[k]) && o[k].length !== def.length) opts[k] = fit(o[k], def.length).map(toHex);
  if (meta.actor && !opts.actor) opts.actor = stockActor(meta.actor === 2 ? 2 : 1);
  return opts;
}

/**
 * A live instance of an effect module: { update(dt), draw(frame, layer), stop(), done() }.
 * o: { x, y, flip, angle, seed, palette, light (glow strength), actor, ...the effect's own options }.
 * draw(frame, "back") draws what goes behind a character, "front" what goes in front, nothing both.
 */
function createFx(mod, o = {}) {
  const meta = mod.meta ?? {};
  const opts = resolveOptions(meta, o);
  const impl = mod.create ? mod.create(opts) : mod;
  const D = meta.duration ?? 1;
  let t = 0, stopAt = Infinity;
  return {
    meta,
    options: opts,
    get t() {
      return t;
    },
    update(dt) {
      t += dt;
      if (!impl.update) return;
      // simulations step at 120 Hz or finer whatever the caller's frame rate, so they look the same everywhere
      const n = Math.max(1, Math.ceil(dt * 120 - 1e-9));
      for (let i = 0; i < n; i++) impl.update(dt / n, opts);
    },
    draw(frame, layer) {
      const p = painterFor(frame);
      p.place(opts.x ?? 0, opts.y ?? 0, !!opts.flip, opts.angle ?? 0);
      p.fade = stopAt === Infinity ? 1 : clamp(1 - (t - stopAt) / FADE);
      p.lightK = opts.light ?? 1;
      const tt = meta.loop ? t % D : Math.min(t, D);
      if (layer !== "front" && impl.drawBack) {
        p.layer = "back";
        impl.drawBack(p, tt, opts);
      }
      if (layer !== "back") {
        p.layer = "front";
        impl.draw(p, tt, opts);
      }
    },
    /** Let it end: loops fade out, one-shots cut short. */
    stop() {
      if (stopAt === Infinity) stopAt = t;
    },
    done() {
      return t - stopAt >= FADE || (!meta.loop && t >= D);
    },
  };
}

/**
 * Color over a background, plus light, into RGBA bytes (a Uint8ClampedArray or Buffer, w * h * 4).
 * bg: null for transparent, a color number, or a Uint32Array of the frame's size. Over transparency, light
 * becomes color with alpha (its brightest channel), which reads as additive over dark backgrounds.
 */
function composite(f, out, bg = null, lightK = 1) {
  const n = f.w * f.h, C = f.color, L = f.light, flat = typeof bg === "number";
  for (let i = 0; i < n; i++) {
    const c = C[i], l = L[i] & 0xffffff;
    let r, g, b, a;
    const ca = c >>> 24;
    if (ca === 255) {
      r = c & 255; g = (c >>> 8) & 255; b = (c >>> 16) & 255; a = 255;
    } else if (bg === null) {
      // translucent color over nothing keeps its alpha
      r = c & 255; g = (c >>> 8) & 255; b = (c >>> 16) & 255; a = ca;
    } else {
      const k = flat ? bg : bg[i], f = ca / 255;
      r = (c & 255) * f + (k & 255) * (1 - f); g = ((c >>> 8) & 255) * f + ((k >>> 8) & 255) * (1 - f);
      b = ((c >>> 16) & 255) * f + ((k >>> 16) & 255) * (1 - f); a = 255;
    }
    if (l) {
      const lr = (l & 255) * lightK, lg = ((l >>> 8) & 255) * lightK, lb = ((l >>> 16) & 255) * lightK;
      if (a < 255) {
        // over transparency: premultiply what's there, add the light, divide by the new alpha
        const pa = a / 255, pr = r * pa + lr, pg = g * pa + lg, pb = b * pa + lb;
        const na = Math.min(1, Math.max(pa, Math.max(lr, lg, lb) / 255));
        if (na > 0) { r = Math.min(255, pr / na); g = Math.min(255, pg / na); b = Math.min(255, pb / na); a = na * 255; }
      } else {
        r = Math.min(255, r + lr); g = Math.min(255, g + lg); b = Math.min(255, b + lb);
      }
    }
    const j = i * 4;
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = a;
  }
  return out;
}

exports.createFrame = createFrame;
exports.clearFrame = clearFrame;
exports.painterFor = painterFor;
exports.resolveOptions = resolveOptions;
exports.createFx = createFx;
exports.composite = composite;
  };
  __mods["core/actor.js"] = function(exports, __req) {
const {  hex  } = __req("core/color.js");
// A stock character to try effects on: status effects wrap its silhouette, hits land on it, auras sit
// behind it. Previews and the gallery draw it; effects only read its mask through o.actor.

const HERO = [
  "....kkkkk...",
  "..kkhhhhhk..",
  ".khhhhhhhhk.",
  ".khhhhhhhhhk",
  ".khhssssshhk",
  ".khsessesshk",
  ".khsessesshk",
  "..ksssssssk.",
  "...kkSSSkk..",
  "..kttttttk..",
  ".kttTttTttk.",
  ".ksttTTttsk.",
  ".kstttttttk.",
  "..kbbbbbbk..",
  "..kppkkppk..",
  "..kppk.kppk.",
  "..kppk.kppk.",
  "..koook.kook",
  "..kkkkk.kkkk",
];
const HERO_PAL = {
  k: "#17121f", h: "#7a4128", s: "#f3c49d", S: "#c98b6c", e: "#17121f",
  t: "#5f6f94", T: "#46536f", b: "#8a5a32", p: "#38334a", o: "#6a4030",
  // the 2x character's extra detail
  H: "#a35d34", w: "#ffffff", m: "#a3564a", g: "#e8c060", L: "#7f90b6", O: "#8f5a3f", P: "#4b4560",
  // the scarf
  c: "#f53cd1", C: "#ff8fe6", D: "#a31f8a",
};
// the dummy: a neutral shell that lets any effect's colors do the talking, near and far limbs, dark bands at the joints, a small mark
const DUMMY_PAL = {
  k: "#0e0c14", A: "#e4e6ec", B: "#b6b9c3", C: "#868995", D: "#5c5e6a", E: "#6e707c", F: "#4b4d58", G: "#34353f", J: "#2a2b33", m: "#f53cd1",
};
// The same character at twice the size (24 x 38), standing easy: the rest pose of src/core/rig.js, baked.
const HERO2 = [
  "...........kkk..........",
  "..........kAABk.........",
  ".........kAAABJk........",
  ".........kABBJJk........",
  ".........kBBBJCDk.......",
  ".........kBCJDDDk.......",
  ".........kkJJJDk........",
  ".......kkkkABBJCkk......",
  "......kAABCJBCCCkDk.....",
  "......kABBCJCCCmDkDk....",
  "......kBBCDDJCDDDkDk....",
  "......kABCDJDDDDDkk.....",
  ".....kAABDkDDDDJkk......",
  ".....kABCDkDDJJGkk......",
  ".....kABCkJJJGGGkk......",
  "....kJJCDkFFFGGGk.......",
  "....kAJJDkJJJGGGk.......",
  "....kJCJJkABBJGGk.......",
  ".....kJCCkBBCDJJJk......",
  ".....kCCCJBBCDJJDk......",
  ".....kCCCDJCCDkJDDk.....",
  "......kCDDJBCDkDDDk.....",
  ".......kDJJJCDkDDDkk....",
  ".......kJBCJCDkDDDkk....",
  ".......kBDJBCDkCDDkk....",
  "........kJJBCDkCDDk.....",
  "........kBBBCDkCCDDk....",
  "........kBBBCDkCCDDk....",
  ".........kBBCDkJDDDk....",
  "........kBJJJJkCJJJk....",
  "........kBBCCDkCCDDk....",
  "........kBBCDDkCDDk.....",
  "........kBBCDkCCDDk.....",
  "........kBCCDkCCDDk.....",
  "........kBCDDkCDDDk.....",
  ".......kJBCJkkkDJkkkk...",
  ".......kAJJAAAAkCCCCCk..",
  "........kkkkkkkkkkkkk...",
];


function maskOf(rows, k = 1) {
  const h = rows.length * k, w = rows[0].length * k, data = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === ".") return;
    for (let j = 0; j < k * k; j++) data[(y * k + ((j / k) | 0)) * w + x * k + (j % k)] = 1;
  }));
  return { w, h, data };
}

const MASKS = { 1: maskOf(HERO, 1), 2: maskOf(HERO2, 1) };
const SPRITES = { 1: HERO, 2: HERO2 };
// the character's own colors, row by row (0 where empty), for effects that recolor it: frozen, poisoned, stone
function pixelsOf(rows, pal) {
  const w = rows[0].length, data = new Uint32Array(w * rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => (data[y * w + x] = ch === "." ? 0 : hex(pal[ch]))));
  return data;
}
const PIXELS = { 1: pixelsOf(HERO, HERO_PAL), 2: pixelsOf(HERO2, DUMMY_PAL) };

/**
 * The stock actor at scale k (1: 12 x 19 px, 2: 24 x 38 px), in local space with its feet at (0, 0):
 * { mask, x, y (top-left of the mask), w, h, k, head: [x, y] (top of the head), chest: [x, y] }.
 */
function stockActor(k = 1) {
  k = k === 2 ? 2 : 1;
  const m = MASKS[k], x = -Math.floor(m.w / 2), y = -m.h;
  return { mask: m, pixels: PIXELS[k], x, y, w: m.w, h: m.h, k, head: [0, y], chest: [0, k === 2 ? -26 : y + 11], ...(k === 2 ? { eyes: [[13, 3], [15, 3]] } : {}) };
}

/** Draw the stock actor with its feet at the painter's origin, at alpha a (dithered). */
function drawActor(p, actor = stockActor(), a = 1) {
  if (a > 0) p.sprite(SPRITES[actor.k === 2 ? 2 : 1], actor.k === 2 ? DUMMY_PAL : HERO_PAL, actor.x, actor.y, { a });
}
/** How visible an effect wants the stand-in character at time t (effects may export actorAlpha). */
const actorAlphaOf = (mod, t, o) => (typeof mod.actorAlpha === "function" ? mod.actorAlpha(t, o) : 1);

exports.HERO = HERO; exports.HERO2 = HERO2; exports.HERO_PAL = HERO_PAL; exports.DUMMY_PAL = DUMMY_PAL;

exports.stockActor = stockActor;
exports.drawActor = drawActor;
exports.actorAlphaOf = actorAlphaOf;
  };
  __mods["core/scene.js"] = function(exports, __req) {
// Preview backdrops: what the tools and the gallery draw behind an effect. Sprite sheets stay transparent.

const {  hex, mix  } = __req("core/color.js");
const {  rand  } = __req("core/math.js");

const SKY = hex("#15131d"), SKY_TOP = hex("#0d0b14"), SKY_LOW = hex("#221d33");
const FLOOR_EDGE = hex("#4a4263"), FLOOR = hex("#2b2639"), FLOOR_DARK = hex("#211d2d"), MORTAR = hex("#1a1724");
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const BACKDROPS = ["dark", "ground", "sky", "light", "black"];

/**
 * A backdrop as a Uint32Array of w x h colors. kind: "dark" | "ground" (a stone floor from groundY down)
 * | "sky" (night gradient with stars) | "light" | "black".
 */
function backdrop(kind, w, h, groundY = h) {
  const out = new Uint32Array(w * h);
  if (kind === "light") return out.fill(hex("#ebe8f0"));
  if (kind === "black") return out.fill(hex("#000000"));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let c = SKY;
      if (kind === "sky") {
        const t = y / Math.max(1, h - 1), step = (t * 5 + BAYER[((y & 3) << 2) | (x & 3)] / 16) | 0;
        c = mix(SKY_TOP, SKY_LOW, Math.min(1, step / 4));
        const r = rand(x, y, 77);
        if (r > 0.994) c = mix(c, hex("#cfc8ff"), 0.35 + (r - 0.994) * 90);
      }
      if (kind === "ground" && y >= groundY) {
        const gy = y - groundY;
        if (gy === 0) c = FLOOR_EDGE;
        else {
          const row = Math.floor((gy - 1) / 5), off = row % 2 ? 6 : 0;
          const mortar = (gy - 1) % 5 === 4 || (x + off) % 12 === 0;
          c = mortar ? MORTAR : gy < 3 ? FLOOR : FLOOR_DARK;
        }
      }
      out[y * w + x] = c;
    }
  return out;
}

exports.backdrop = backdrop;
exports.BACKDROPS = BACKDROPS;
  };
  __mods["core/act.js"] = function(exports, __req) {
// An act: an effect performed. The character winds up, lets go and recovers, a target takes the hit, and everything
// freezes for a moment on contact. Effects describe it as data (`export const act`), so a game with its own character
// can read the same timing. The freeze, the shake, the springy target and poses held on 12 fps steps are how Hollow Crown
// plays its skills (https://github.com/rehan-remade/hollow-crown), MIT License, Copyright (c) 2026 rehan-remade.

const {  Rng, clamp  } = __req("core/math.js");
const {  hex, mix  } = __req("core/color.js");
const {  createFrame, clearFrame, createFx, painterFor  } = __req("core/fx.js");
const {  stockActor, drawActor, actorAlphaOf, HERO2, DUMMY_PAL  } = __req("core/actor.js");
const {  posed, STAND  } = __req("core/rig.js");

exports.STAND = STAND; exports.posed = posed;

// ---- poses over time
const lerp = (a, b, u) => a + (b - a) * u;
/** Between two poses: numbers move, everything else changes at the later key. */
function lerpPose(a, b, u) {
  const out = { ...STAND, ...a };
  const B = { ...STAND, ...b };
  for (const k of Object.keys(B)) {
    const v = B[k];
    if (typeof v === "number" && typeof out[k] === "number") out[k] = lerp(out[k], v, u);
    else if (out[k] === undefined && typeof v === "number") out[k] = v;
  }
  // what the later pose doesn't mention eases back to its default
  for (const k of ["hx", "hy", "lean", "crouch"]) if (B[k] === undefined && typeof out[k] === "number") out[k] = lerp(out[k], 0, u);
  if (B.wl === undefined && typeof out.wl === "number") out.wl = lerp(out.wl, 1, u);
  return out;
}
const eases = { out: (u) => 1 - (1 - u) * (1 - u), in: (u) => u * u, line: (u) => u };
/**
 * The pose at time t on a track of keys [t, pose, how]: `how` says how the pose arrives: smoothly by default, "out"
 * fast then settling, "in" slowly then fast, "snap" holding the last pose and jumping on the key. Limbs move in whole
 * 12 fps steps counted from each key, so they read as held drawings; the feet's position over the floor (x, y) stays smooth.
 */
function poseAt(track, t) {
  if (t <= track[0][0]) return track[0][1];
  for (let i = 0; i < track.length - 1; i++) {
    const [t0, a] = track[i], [t1, b, how] = track[i + 1];
    if (t >= t1) continue;
    if (how === "snap") return a;
    const e = eases[how] ?? ((u) => u * u * (3 - 2 * u));
    const stepped = t0 + Math.floor((t - t0) * 12 + 1e-6) / 12;
    const out = lerpPose(a, b, e((stepped - t0) / (t1 - t0)));
    const u = e((t - t0) / (t1 - t0));
    out.x = lerp(a.x ?? 0, b.x ?? 0, u);
    out.y = lerp(a.y ?? 0, b.y ?? 0, u);
    return out;
  }
  return track[track.length - 1][1];
}

/** Is the body between keys that hardly differ, or past the last? */
function isHeld(track, t) {
  if (t >= track[track.length - 1][0] || t < track[0][0]) return true;
  for (let i = 0; i < track.length - 1; i++) {
    if (t >= track[i + 1][0]) continue;
    const a = { ...STAND, ...track[i][1] }, b = { ...STAND, ...track[i + 1][1] };
    return track[i + 1][0] - track[i][0] > 0.4 && ["fx", "fy", "bx", "by", "crouch", "lean", "x", "y"].every((k) => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) < 1.5);
  }
  return true;
}

// ---- the target
const TW = 38, TH = 52;
const TP = Object.fromEntries(Object.entries({ ink: "#0b0a1a", wood: "#724c2e", woodL: "#a0703a", woodD: "#4e331f", straw: "#d2aa55", strawL: "#f0d98a", burlapD: "#86643a", burlap: "#b38b57", burlapL: "#c9a26c", red: "#9a2f3c", redL: "#c4434f", white: "#ffffff" }).map(([k, v]) => [k, hex(v)]));
const DUST = ["#efe7dc", "#c9bfb8", "#8f8693", "#5a5468"].map(hex);
const DUMMY = new Uint32Array(TW * TH);
(function buildDummy() {
  const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < TW && y < TH) DUMMY[y * TW + x] = c; };
  const R = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
  // the post and the crossbar
  R(15, 38, 8, 14, TP.ink); R(16, 34, 6, 18, TP.wood); R(16, 34, 2, 18, TP.woodL); R(20, 34, 2, 18, TP.woodD);
  R(1, 18, 36, 1, TP.ink); R(1, 23, 36, 1, TP.ink); R(1, 19, 36, 4, TP.wood); R(1, 19, 36, 1, TP.woodL); R(1, 22, 36, 1, TP.woodD);
  // straw bursting out of the ends of the arms
  for (const [bx, s] of [[0, -1], [33, 1]]) {
    R(bx, 17, 5, 8, TP.straw);
    for (const [dx, dy, c] of [[2, 16, TP.straw], [3, 15, TP.strawL], [1, 17, TP.strawL], [2, 25, TP.straw], [1, 26, TP.strawL], [3, 25, TP.burlapD], [2, 19, TP.strawL], [3, 21, TP.strawL], [1, 22, TP.burlapD], [2, 23, TP.strawL]]) px(bx + dx, dy, c);
    px(s < 0 ? bx - 1 : bx + 5, 19, TP.straw); px(s < 0 ? bx - 1 : bx + 5, 22, TP.strawL);
  }
  const sack = (x, y, w, h) => {
    R(x + 1, y, w - 2, 1, TP.ink); R(x + 1, y + h - 1, w - 2, 1, TP.ink);
    R(x, y + 1, 1, h - 2, TP.ink); R(x + w - 1, y + 1, 1, h - 2, TP.ink);
    R(x + 1, y + 1, w - 2, h - 2, TP.burlap);
    R(x + w - 4, y + 1, 3, h - 2, TP.burlapD);
    R(x + 1, y + h - 3, w - 2, 2, TP.burlapD);
    R(x + 1, y + 1, 1, h - 4, TP.burlapL); R(x + 1, y + 1, w - 6, 1, TP.burlapL);
    // the weave
    for (let j = y + 2; j < y + h - 2; j += 3) for (let i = x + 3 + (j % 2); i < x + w - 4; i += 4) px(i, j, TP.burlapD);
  };
  sack(9, 17, 20, 24);
  // the rings on its chest
  for (let y = 19; y < 36; y++) for (let x = 11; x < 27; x++) { const d = Math.hypot(x - 18.5, y - 27); if ((d > 4 && d < 5.4) || d < 1.9) px(x, y, x + y < 45 ? TP.redL : TP.red); }
  // the rope belt, and straw coming out under it
  for (let x = 10; x < 28; x++) { px(x, 36, x & 1 ? TP.woodL : TP.straw); px(x, 37, x & 1 ? TP.woodD : TP.wood); }
  for (const [x, y, c] of [[11, 41, TP.straw], [12, 42, TP.strawL], [14, 41, TP.strawL], [15, 42, TP.straw], [23, 41, TP.straw], [24, 42, TP.strawL], [26, 41, TP.straw], [13, 43, TP.straw], [25, 43, TP.straw]]) px(x, y, c);
  sack(10, 1, 18, 16);
  // X for eyes and a stitched mouth
  for (const ex of [14, 23]) for (let d = -2; d <= 2; d++) { px(ex + d, 7 + d, TP.ink); px(ex - d, 7 + d, TP.ink); }
  for (let x = 14; x < 24; x++) px(x, 12, x & 1 ? TP.ink : TP.burlapD);
  for (const x of [15, 18, 21]) { px(x, 11, TP.ink); px(x, 13, TP.ink); }
  // the rope at its neck, and straw for hair
  for (let x = 12; x < 26; x++) { px(x, 16, x & 1 ? TP.woodL : TP.straw); px(x, 17, x & 1 ? TP.wood : TP.woodD); }
  for (const [x, y, c] of [[13, 0, TP.straw], [15, 0, TP.strawL], [18, 0, TP.straw], [21, 0, TP.strawL], [24, 0, TP.straw], [9, 4, TP.straw], [28, 6, TP.straw], [8, 7, TP.strawL], [29, 3, TP.strawL]]) px(x, y, c);
})();
/** What a hit can leave on the target: [color, how much of it]. */
const SKINS = { flash: [TP.white, 1], char: [hex("#1a0c0e"), 0.72], ice: [hex("#a8e8ff"), 0.72], shadow: [hex("#3a1a70"), 0.5], holy: [hex("#fff4c0"), 0.5], red: [hex("#ff2040"), 0.45], shock: [hex("#8fd6ff"), 0.6], poison: [hex("#58c43a"), 0.5] };
const STRAW = [TP.strawL, TP.straw, TP.straw, TP.burlapD, TP.burlapD];

/** A straw target on a spring: it sways, flashes, takes a skin, shivers and sheds straw. (x, y): the floor under it, local space. */
class Target {
  constructor(x, seed = 5) {
    Object.assign(this, { x, theta: 0, omega: 0, flashT: 0, skin: null, skinFade: 0, shiver: 0, clock: 0, R: new Rng(seed), straw: [] });
  }
  hit({ push = 1.2, straw = 8, flash = 0.05, skin, shiver = 0, y = -26 } = {}) {
    this.omega += push;
    this.flashT = Math.max(this.flashT, flash);
    if (skin !== undefined) this.skin = skin;
    if (shiver) this.shiver = shiver;
    const R = this.R;
    for (let k = 0; k < straw; k++) {
      const back = R.next() < 0.3;
      this.straw.push({ x: this.x + R.range(-3, 3), y: y + R.range(-3, 3), vx: back ? R.range(-60, -5) : R.range(10, 130), vy: R.range(-120, -5), age: 0, life: R.range(1.2, 2.2), big: R.next() < 0.5 });
    }
  }
  step(dt) {
    this.clock += dt;
    this.omega += (-60 * this.theta - 3.4 * this.omega) * dt;
    this.theta = clamp(this.theta + this.omega * dt, -0.4, 0.42);
    if (this.flashT > 0) this.flashT -= dt;
    if (this.shiver > 0) this.shiver -= dt;
    for (const s of this.straw) {
      s.age += dt;
      s.vy += 210 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y >= 0) { s.y = 0; s.vx *= 0.2; s.vy = 0; }
    }
    this.straw = this.straw.filter((s) => s.age < s.life);
  }
  draw(C, W, H, X, Y, flip) {
    const tan = Math.tan(this.theta), sv = this.shiver > 0 ? (Math.floor(this.clock * 30) & 1 ? 1 : -1) : 0, name = this.flashT > 0 ? "flash" : this.skin, sk = name ? SKINS[name] : null;
    const base = X + (flip ? -this.x - 1 : this.x);
    for (let r = 0; r < TH; r++) {
      const o = Math.round((TH - 1 - r) * tan * 0.8) + sv;
      for (let x = 0; x < TW; x++) {
        const c = DUMMY[r * TW + x];
        if (!c) continue;
        const px = base + (flip ? -(x - 19 + o) - 1 : x - 19 + o), py = Y - TH + r;
        if (px >= 0 && py >= 0 && px < W && py < H) C[py * W + px] = sk ? mix(c, sk[0], sk[1]) : c;
      }
    }
  }
  drawStraw(C, W, H, X, Y, flip) {
    for (const s of this.straw) {
      const c = STRAW[Math.min(4, Math.floor((s.age / s.life) * 5))], lx = Math.round(s.x), ly = Math.round(s.y) - 1;
      for (let i = 0; i < (s.big ? 2 : 1); i++) {
        const px = X + (flip ? -(lx + i) - 1 : lx + i), py = Y + ly;
        if (px >= 0 && py >= 0 && px < W && py < H) C[py * W + px] = c;
      }
    }
  }
}

// ---- the act itself
const GHOST_LIFE = 0.16;
const REST_MASK = new Uint8Array(24 * 38), REST_PX = new Uint32Array(24 * 38);
HERO2.forEach((row, r) => [...row].forEach((ch, c) => {
  if (ch !== ".") {
    REST_MASK[r * 24 + c] = 1;
    REST_PX[r * 24 + c] = hex(DUMMY_PAL[ch]);
  }
}));

// every cell of the standing sprite, mapped to the nearest cell that's on the body
const NEAREST = new Int16Array(24 * 38).fill(-1);
for (let r = 0; r < 38; r++)
  for (let c = 0; c < 24; c++) {
    let best = -1, bd = 1e9;
    for (let y = Math.max(0, r - 7); y < Math.min(38, r + 8); y++)
      for (let x = Math.max(0, c - 7); x < Math.min(24, c + 8); x++) {
        const d = (x - c) * (x - c) + (y - r) * (y - r);
        if (REST_MASK[y * 24 + x] && d < bd) { bd = d; best = y * 24 + x; }
      }
    NEAREST[r * 24 + c] = best;
  }
const lum = (c) => (0.3 * (c & 255) + 0.59 * ((c >>> 8) & 255) + 0.11 * ((c >>> 16) & 255)) / 255;
// an effect's color over the standing body, moved onto a pixel of the pose: its color, at this pixel's own light and shade
function carry(v, rest, own) {
  const lv = lum(v);
  if (lv > 0.9 || v >>> 24 < 255) return v;
  const k = Math.max(0.45, Math.min(1.5, lum(own) / Math.max(0.08, lum(rest))));
  const ch = (n) => Math.min(255, Math.round(((v >>> n) & 255) * k));
  return (255 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** When an act's poses begin and end, in effect time (a loop ends when it's told to). */
function actSpan(mod) {
  const a = mod.act, D = mod.meta?.duration ?? 1, k = a?.poses;
  return { from: Math.min(0, k?.[0]?.[0] ?? 0), to: mod.meta?.loop ? Infinity : Math.max(D, k?.[k.length - 1]?.[0] ?? 0) };
}

/**
 * An effect performed: { fx, t, update(dt), draw(frame, { body, target }), shake, done() }. t runs from the first pose
 * (before the effect's own t = 0) to the last. update() holds everything still during a freeze; draw() paints the effect, the
 * character and the target together. o: the effect's options, with x, y placing the feet. Without an act, it just plays.
 */
function createAct(mod, o = {}) {
  const a = mod.act ?? {}, meta = mod.meta ?? {}, D = meta.duration ?? 1, flip = !!o.flip, seed = o.seed ?? meta.options?.seed ?? 1;
  const fx = createFx(mod, o), track = a.poses ?? [[0, { ...STAND }]], span = actSpan(mod);
  const X = o.x ?? 0, Y = o.y ?? 0;
  const targets = (a.targets ?? (a.target ? [a.target] : [])).map((g, i) => new Target(g.x ?? 66, seed + 4 + i));
  const hits = (a.hits ?? []).map((h) => ({ ...h })).sort((p, q) => p.t - q.t), dust = (a.dust ?? []).slice();
  const R = new Rng(seed + 9), specks = [];
  // after-images take the effect's own color unless the act names one
  const ramp = o.palette ?? meta.options?.palette, ghosts = [], gc = hex(a.ghost ?? ramp?.[Math.floor(ramp.length * 0.7)] ?? "#8fb4ff");
  let t = span.from, stop = 0, stopped = false, shakeT = 0, shake0 = 0, amp = 0, nh = 0, nd = 0, loopN = 0, gAcc = 0, last = null;
  const poseNow = () => {
    let tt = t;
    if (meta.loop && t >= D) tt = t % D;
    let q = poseAt(track, tt);
    // nothing is asked of him: he breathes
    if (!meta.loop && isHeld(track, tt)) {
      const up = Math.floor(tt * 3) & 1;
      q = { ...STAND, ...q, crouch: (q.crouch ?? 0) + up, fy: (q.fy ?? STAND.fy) + up, by: (q.by ?? STAND.by) + up };
    }
    last = q;
    return q;
  };
  let scratch = null;
  const scratchFor = (f) => {
    if (!scratch || scratch.a.w !== f.w || scratch.a.h !== f.h) scratch = { a: createFrame(f.w, f.h, f.ox, f.oy), b: createFrame(f.w, f.h, f.ox, f.oy) };
    return scratch;
  };
  const out = {
    fx, meta, act: a, targets,
    get t() { return t; },
    /** How far the whole picture is thrown right now, in px. */
    get shake() {
      if (shakeT <= 0) return [0, 0];
      const k = amp * (shakeT / shake0), f = Math.floor(shakeT * 60);
      return [Math.round(Math.sin(f * 2.4) * k), Math.round(Math.cos(f * 3.7) * k * 0.7)];
    },
    get frozen() { return stop > 0; },
    /** The pose he's in right now. */
    get pose() { return last; },
    update(dt) {
      if (shakeT > 0) shakeT -= dt;
      if (stop > 0) {
        stop -= dt;
        return;
      }
      const t0 = t;
      t += dt;
      if (t >= 0) fx.update(t0 < 0 ? t : dt);
      if (meta.loop && t >= D) {
        const n = Math.floor(t / D);
        if (n !== loopN) {
          loopN = n;
          nh = 0;
          nd = 0;
        }
      }
      const tt = meta.loop && t >= D ? t % D : t;
      for (; nh < hits.length && hits[nh].t <= tt; nh++) {
        const h = hits[nh];
        if (h.stop) stop = Math.max(stop, h.stop);
        if (h.shake) {
          shakeT = shake0 = h.shake;
          amp = h.amp ?? 2;
        }
        if (h.target !== false) targets.forEach((g, i) => (h.at === undefined || h.at === i) && g.hit(h));
        out.onHit?.(h);
      }
      for (; nd < dust.length && dust[nd].t <= tt; nd++) {
        const d = dust[nd], n = d.n ?? 6;
        for (let i = 0; i < n; i++) {
          const dir = d.dir ?? (R.next() < 0.5 ? -1 : 1);
          specks.push({ x: d.x + R.range(-3, 3), y: -1 - R.range(0, 2), vx: dir * R.range(22, 90), vy: R.range(-34, -6), age: 0, life: R.range(0.16, 0.4), big: R.next() < 0.45, c: d.c ? hex(d.c) : 0 });
        }
      }
      for (const k of specks) {
        k.age += dt;
        k.vx *= 1 - 5 * dt;
        k.vy += 110 * dt;
        k.x += k.vx * dt;
        k.y = Math.min(-1, k.y + k.vy * dt);
      }
      for (let i = specks.length - 1; i >= 0; i--) if (specks[i].age >= specks[i].life) specks.splice(i, 1);
      const q = poseNow();
      for (const g of targets) g.step(dt);
      // after-images while a key asks for them
      gAcc += dt;
      if (q.ghost && gAcc >= 1 / 30) {
        gAcc = 0;
        ghosts.push({ q, age: 0 });
        if (ghosts.length > 7) ghosts.shift();
      }
      for (const g of ghosts) g.age += dt;
      while (ghosts.length && ghosts[0].age > GHOST_LIFE) ghosts.shift();
    },
    /** Paint it. { body: false } leaves the character out, { target: false } the target. */
    draw(frame, { body = true, target: showTarget = true } = {}) {
      const W = frame.w, H = frame.h, q = last ?? poseNow(), active = t >= 0;
      const tgt = showTarget ? targets : [];
      const drawTargets = () => tgt.forEach((g) => g.draw(frame.color, W, H, FX, FY, flip));
      const drawStraw = () => tgt.forEach((g) => g.drawStraw(frame.color, W, H, FX, FY, flip));
      const drawDust = () => {
        for (const k of specks) {
          const c = k.c || DUST[Math.min(3, Math.floor((k.age / k.life) * 4))], lx = Math.round(k.x), py = FY + Math.round(k.y);
          for (let i = 0; i < (k.big ? 2 : 1); i++) {
            const px = flip ? FX - lx - i - 1 : FX + lx + i;
            if (px >= 0 && py >= 0 && px < W && py < H) frame.color[py * W + px] = c;
          }
        }
      };
      const FX = X - (frame.ox | 0), FY = Y - (frame.oy | 0);
      if (!body) {
        if (active) fx.draw(frame, "back");
        drawTargets();
        if (active) fx.draw(frame, "front");
        drawStraw();
        return;
      }
      const rx = Math.round(q.x ?? 0), ry = Math.round(q.y ?? 0), BX = FX + (flip ? -rx : rx), BY = FY + ry;
      const r = posed(q), mirror = flip;
      const paint = (i, color) => {
        const px = mirror ? BX - r.xs[i] - 1 : BX + r.xs[i], py = BY + r.ys[i];
        if (px < 0 || py < 0 || px >= W || py >= H) return;
        frame.color[py * W + px] = color;
        // he stays crisp in front of his own after-images
        if (ghosts.length) frame.light[py * W + px] = 0;
      };
      const drawGhosts = () => {
        for (const g of ghosts) {
          // after-images are light, not paint: they brighten what's behind them and leave nothing muddy
          const gr = posed(g.q), gx = FX + (flip ? -Math.round(g.q.x ?? 0) : Math.round(g.q.x ?? 0)), gy = FY + Math.round(g.q.y ?? 0), k = 0.5 * (1 - g.age / GHOST_LIFE);
          const gm = flip, r0 = (gc & 255) * k, g0 = ((gc >>> 8) & 255) * k, b0 = ((gc >>> 16) & 255) * k;
          for (let i = 0; i < gr.n; i++) {
            const px = gm ? gx - gr.xs[i] - 1 : gx + gr.xs[i], py = gy + gr.ys[i];
            if (px < 0 || py < 0 || px >= W || py >= H) continue;
            const j = py * W + px, d = frame.light[j];
            frame.light[j] = (255 << 24) | (Math.min(255, ((d >>> 16) & 255) + b0) << 16) | (Math.min(255, ((d >>> 8) & 255) + g0) << 8) | Math.min(255, (d & 255) + r0);
          }
        }
      };
      const shadow = () => {
        const sy = FY, cx = FX + (flip ? -rx : rx), hw = 10 + (Math.abs(q.ffx - q.fbx) >> 1) - Math.min(8, Math.abs(ry) >> 1);
        if (sy < 0 || sy >= H) return;
        for (let dy = 0; dy < 2; dy++)
          for (let x = -hw + dy * 2; x <= hw - dy * 2; x++) {
            const px = cx + x, i = (sy + dy) * W + px;
            if (px < 0 || px >= W || sy + dy >= H) continue;
            frame.color[i] = (frame.color[i] & 0xffffff) | (Math.max(frame.color[i] >>> 24, 110) << 24);
          }
      };
      if (!a.onBody) {
        // the effect doesn't care about the body: back, body, front
        if (active) fx.draw(frame, "back");
        drawTargets();
        shadow();
        drawGhosts();
        for (let i = 0; i < r.n; i++) paint(i, r.color[i]);
        if (active) fx.draw(frame, "front");
        drawStraw();
        drawDust();
        return;
      }
      // the effect paints the standing body: draw it there, then carry each body pixel to where the pose put it
      const { a: A, b: B } = scratchFor(frame);
      clearFrame(A);
      clearFrame(B);
      if (active) fx.draw(A, "back");
      B.color.set(A.color);
      B.light.set(A.light);
      const tt = meta.loop ? (t < 0 ? 0 : t % D) : clamp(t, 0, D), alpha = active ? actorAlphaOf(mod, tt, fx.options) : 1;
      drawActor(painterFor(B).place(FX, FY, flip), fx.options.actor ?? stockActor(2), alpha);
      if (active) fx.draw(B, "front");
      const follow = a.follow ?? 1, lean = (q.lean ?? 0) * follow, cr = (q.crouch ?? 0) * follow;
      // what's up on the body goes with it; what's on the floor stays on the floor
      const shiftOf = (ly) => {
        const k = clamp((-11 - ly) / 7, 0, 1), f = clamp((-1 - ly) / 6, 0, 1);
        return [Math.round(lean * k + rx * f), Math.round(cr * k + ry * f)];
      };
      const rest = (sx, sy) => {
        const c = (flip ? FX - sx - 1 : sx - FX) + 12, r0 = sy - FY + 38;
        return c >= 0 && r0 >= 0 && c < 24 && r0 < 38 && REST_MASK[r0 * 24 + c] === 1;
      };
      const C = frame.color, Ls = frame.light;
      const copy = (buf, sx, sy, s) => {
        const [dx, dy] = shiftOf(sy - FY), px = sx + (flip ? -dx : dx), py = sy + dy;
        if (px < 0 || py < 0 || px >= W || py >= H) return;
        const i = py * W + px;
        if (buf === Ls) {
          const d = Ls[i];
          Ls[i] = (255 << 24) | (Math.min(255, ((d >>> 16) & 255) + ((s >>> 16) & 255)) << 16) | (Math.min(255, ((d >>> 8) & 255) + ((s >>> 8) & 255)) << 8) | Math.min(255, (d & 255) + (s & 255));
        } else if (s >>> 24 === 255 || !C[i]) C[i] = s;
        else {
          const k = (s >>> 24) / 255, d = C[i];
          const ch = (n) => Math.round(((s >>> n) & 255) * k + ((d >>> n) & 255) * (1 - k));
          C[i] = (Math.max(s >>> 24, d >>> 24) << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0);
        }
      };
      drawTargets();
      shadow();
      for (let sy = 0; sy < H; sy++)
        for (let sx = 0; sx < W; sx++) {
          const c = A.color[sy * W + sx];
          if (c) copy(C, sx, sy, c);
        }
      drawGhosts();
      const restIndex = (s) => {
        const c = s % 24, r0 = (s / 24) | 0, sx = flip ? FX - (c - 12) - 1 : FX + c - 12, sy = FY + r0 - 38;
        return sx >= 0 && sy >= 0 && sx < W && sy < H ? sy * W + sx : -1;
      };
      for (let i = 0; i < r.n; i++) {
        const s = r.src[i] >= 0 ? NEAREST[r.src[i]] : -1;
        if (s < 0) {
          if (alpha > 0.5) paint(i, r.color[i]);
          continue;
        }
        const j = restIndex(s), v = j >= 0 ? B.color[j] : REST_PX[s];
        if (!v) continue;
        // the effect left this bit of body alone, or changed it: carry the change, on top of this pixel's own shading
        paint(i, v === REST_PX[s] ? r.color[i] : carry(v, REST_PX[s], r.color[i]));
      }
      for (let sy = 0; sy < H; sy++)
        for (let sx = 0; sx < W; sx++) {
          const j = sy * W + sx;
          if (B.color[j] && B.color[j] !== A.color[j] && !rest(sx, sy)) copy(C, sx, sy, B.color[j]);
          if (B.light[j] & 0xffffff) copy(Ls, sx, sy, B.light[j]);
        }
      drawStraw();
      drawDust();
    },
    /** Let a loop end: it fades out and done() goes true. */
    stop() {
      fx.stop();
      stopped = true;
    },
    /** One-shots end when the last pose is over. */
    done() {
      return stopped ? fx.done() : t >= span.to && stop <= 0;
    },
  };
  poseNow();
  return out;
}

/**
 * An act as plain data, for a game with its own character: how long the wind-up and recovery are, when to freeze and shake,
 * what a target should do, and the poses themselves. Times are in the effect's own seconds: start the effect at 0.
 */
function actTiming(mod) {
  const a = mod.act;
  if (!a) return null;
  const { from, to } = actSpan(mod), D = mod.meta?.duration ?? 1;
  return {
    windup: -from,
    recovery: mod.meta?.loop ? 0 : Math.max(0, to - D),
    onBody: !!a.onBody,
    targets: (a.targets ?? (a.target ? [a.target] : [])).map((g) => g.x ?? 66),
    hits: (a.hits ?? []).map((h) => ({ t: h.t, freeze: h.stop ?? 0, shake: h.shake ?? 0, amp: h.amp ?? 0, push: h.target === false ? 0 : h.push ?? 1.2, skin: h.skin, at: h.at })),
    poses: (a.poses ?? []).map(([t, pose, how]) => ({ t, how: how ?? "smooth", pose })),
  };
}

/** The box an act needs in local space, so nothing gets cut off: { x0, y0, x1, y1 }, sampled over its poses. */
function actBounds(mod) {
  const a = mod.act, [w, h] = mod.meta.size, [ox, oy] = mod.meta.origin;
  let x0 = -ox, y0 = -oy, x1 = w - ox, y1 = h - oy;
  const see = (p) => {
    const r = posed(p), X = Math.round(p.x ?? 0), Y = Math.round(p.y ?? 0), a = r.x0, b = r.x1;
    x0 = Math.min(x0, a + X - 1); x1 = Math.max(x1, b + X + 1); y0 = Math.min(y0, r.y0 + Y - 1); y1 = Math.max(y1, r.y1 + Y + 1);
  };
  const k = a?.poses;
  if (k) {
    for (let t = k[0][0]; t <= k[k.length - 1][0]; t += 1 / 12) see(poseAt(k, t));
    for (const key of k) see(key[1]);
  } else see(STAND);
  for (const g of a?.targets ?? (a?.target ? [a.target] : [])) {
    const tx = g.x ?? 66;
    x0 = Math.min(x0, tx - 30); x1 = Math.max(x1, tx + 36); y0 = Math.min(y0, -56);
  }
  return { x0, y0, x1, y1 };
}

exports.lerpPose = lerpPose;
exports.poseAt = poseAt;
exports.actSpan = actSpan;
exports.createAct = createAct;
exports.actTiming = actTiming;
exports.actBounds = actBounds;
exports.Target = Target;
exports.SKINS = SKINS;
  };
  __mods["core/rig.js"] = function(exports, __req) {
// The character who acts: a real skeleton in 3D, drawn down to pixels the way Dead Cells makes its sprites. Bones have
// fixed lengths and hang from each other, pelvis to spine to chest to shoulders, so the body can twist, bend and turn round,
// and depth decides what's in front. A pose only says where the hands and feet should be and how the body is carrying
// itself; the solver works out every joint, and the renderer shades it into a few flat tones with one clean ink line.
//
// Coordinates: x right, y up, z towards the viewer, in pixels, the feet at the origin. Poses are in screen terms (y negative
// is up), as effects are. The character faces +x with his right side towards the viewer, so the right hand is the near one.
//
// A rendered pose also knows, for each of its pixels, which pixel of the standing character it came from (`src`). That
// is what lets an effect drawn on the standing body (frost, poison, a scan line) follow the body wherever it goes.

const {  hex  } = __req("core/color.js");
const {  DUMMY_PAL  } = __req("core/actor.js");

const PAL = Object.fromEntries(Object.entries(DUMMY_PAL).map(([k, v]) => [k, hex(v) >>> 0]));
const INK = PAL.k, SEAM = PAL.J, MARK = PAL.m;
// plates and joints: lit to dark
const SHELL = [PAL.A, PAL.B, PAL.C, PAL.D], CORE = [PAL.E, PAL.F, PAL.G, PAL.G];
const DEG = Math.PI / 180, W0 = 24, H0 = 38;

// ---- vectors and turns
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1e-6));
const rotY = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mm = (A, B) => { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return o; };
const mv = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
const tv = (M, v) => [M[0] * v[0] + M[3] * v[1] + M[6] * v[2], M[1] * v[0] + M[4] * v[1] + M[7] * v[2], M[2] * v[0] + M[5] * v[1] + M[8] * v[2]];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---- the body's measurements, in pixels
const M = {
  pelvis: 19.7, spine1: 2.8, spine2: 4.6, shoulderUp: 2.5, shoulderOut: 5.9, neckUp: 4.0, headUp: 3.1,
  hipDown: 1.1, hipOut: 2.8, thigh: 8.6, shin: 8.3, upper: 7.6, fore: 7.4, turn: 36 * DEG,
};
/** Standing easy, in screen terms: hands and feet are where they should end up, y negative is up. */
const STAND = { lean: 0, crouch: 0, yaw: 0, fx: -3, fy: -15, bx: 5, by: -15, ffx: -2, ffy: -4, fbx: 3, fby: -4 };

// ---- solving a pose: from where the hands and feet should be, to every joint
function ik(a, target, L1, L2, pole) {
  let to = sub(target, a), d = len(to);
  const reach = L1 + L2 - 0.02;
  if (d > reach) { to = mul(to, reach / d); d = reach; }
  const u = unit(to), along = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - along * along));
  let v = sub(pole, mul(u, dot(pole, u)));
  v = len(v) < 1e-4 ? unit(cross(u, [0, 0, 1])) : unit(v);
  return { joint: add(a, add(mul(u, along), mul(v, h))), end: add(a, to), u, v };
}
function frame(t, R) {
  return { t, R };
}
// a frame along a bone: its local x runs down the bone
function boneFrame(a, b, pole) {
  const x = unit(sub(b, a));
  let y = sub(pole, mul(x, dot(pole, x)));
  y = len(y) < 1e-4 ? unit(cross(x, [0, 0, 1])) : unit(y);
  const z = cross(x, y);
  return frame(a, [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]);
}
const weaponOf = (name) => WEAPONS[name];

function solve(pose) {
  const q = { ...STAND, ...pose }, lean = q.lean, W = q.weapon && weaponOf(q.weapon), OW = q.offWeapon && weaponOf(q.offWeapon);
  const sa = q.sa ?? 0, wl = q.wl ?? 1, axisZ = Math.sqrt(Math.max(0, 1 - wl * wl)) * (q.wz ?? 1);
  const axis = [Math.cos(sa) * wl, -Math.sin(sa) * wl, axisZ], side = [-Math.sin(sa), -Math.cos(sa), 0];
  const two = !!(q.two && W), nearZ = q.fz ?? (two ? 3 : 4.5);
  // how the chest is turned follows the hands: a hand driving forward brings its shoulder round; one drawn back opens him up
  const fwd = (q.fx - STAND.fx) / 24, farFwd = two ? 0 : (q.bx - STAND.bx) / 22;
  let turn = M.turn + (fwd >= 0 ? -44 * DEG * Math.min(1, fwd) : 28 * DEG * Math.min(1, -fwd * 1.8));
  turn += (farFwd > 0 ? 34 * DEG * Math.min(1, farFwd) : 0) + (q.twist ?? 0) * 4 * DEG;
  if (q.turn !== undefined) turn = q.turn;
  const hipTurn = M.turn + (turn - M.turn) * 0.45, tilt = Math.atan2(lean, 13);
  const Rp = mm(rotZ(-tilt * 0.25), rotY(-hipTurn)), Rc = mm(rotZ(-tilt), rotY(-turn));
  // feet first: the pelvis sinks if that's what it takes for both legs to reach them
  const ankleN = [q.ffx, -q.ffy - 1.8, q.fzz ?? 2.4], ankleF = [q.fbx, -q.fby - 1.8, q.bzz ?? -2.4];
  let pelvis = [lean * 0.2, M.pelvis - q.crouch, 0];
  const hipAt = (s) => add(pelvis, mv(Rp, [0, -M.hipDown, s * M.hipOut]));
  const maxLeg = (M.thigh + M.shin) * 0.995;
  for (const [s, a] of [[1, ankleN], [-1, ankleF]]) {
    const h = hipAt(s), dx = h[0] - a[0], dz = h[2] - a[2], flat = dx * dx + dz * dz;
    if (flat < maxLeg * maxLeg) {
      const top = a[1] + Math.sqrt(maxLeg * maxLeg - flat);
      if (h[1] > top) pelvis = [pelvis[0], pelvis[1] - (h[1] - top), pelvis[2]];
    }
  }
  const waist = add(pelvis, [Math.sin(tilt * 0.45) * M.spine1, Math.cos(tilt * 0.45) * M.spine1, 0]);
  const chest = add(waist, [Math.sin(tilt) * M.spine2, Math.cos(tilt) * M.spine2, 0]);
  const neck = add(chest, mv(Rc, [0, M.neckUp, 0]));
  // the head keeps looking where he's going: it takes only part of the lean and part of the turn
  const headTurn = M.turn * 0.9 + (turn - M.turn) * 0.35, nod = tilt * 0.35 + (q.hy ?? 0) * 7 * DEG, roll = (q.hx ?? 0) * 7 * DEG;
  const Rh = mm(rotZ(-nod - roll), rotY(-headTurn));
  const head = add(neck, mv(Rh, [0.15, M.headUp, 0]));
  // the arms: shoulders reach a little towards a far hand
  const pick = (s, target) => {
    const base = add(chest, mv(Rc, [0, M.shoulderUp, s * M.shoulderOut])), to = sub(target, base), d = len(to);
    return add(base, mul(unit(to), Math.min(1.8, Math.max(0, d - 11) * 0.35)));
  };
  const nearT = [q.fx, -q.fy, nearZ];
  const farT = two ? [q.fx + axis[0] * W.two, -q.fy + axis[1] * W.two, nearZ + axis[2] * W.two] : [q.bx, -q.by, q.bz ?? (q.armsFront ? 5.5 : -4.5)];
  const sN = pick(1, nearT), sF = pick(-1, farT);
  const pole = (s, T, shoulder, hold) => {
    // elbows hang down and back; overhead they go out and forward
    const up = clamp01((T[1] - shoulder[1] + 2) / 10);
    const base = [-0.55 + up * 1.1, -1 + up * 0.9, s * (0.45 + up * 0.5)];
    if (!hold) return base;
    // holding something, the forearm wants to meet the handle side on: try round the circle, keep the best
    const u = unit(sub(T, shoulder));
    let best = base, score = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, x = unit(cross(u, [0.3, 1, 0.2])), y = cross(u, x), v = add(mul(x, Math.cos(a)), mul(y, Math.sin(a)));
      const A = ik(shoulder, T, M.upper, M.fore, v), f = unit(sub(A.end, A.joint));
      const cost = Math.abs(dot(f, hold)) * 0.7 + (1 - dot(unit(base), v)) * 0.55;
      if (cost < score) { score = cost; best = v; }
    }
    return best;
  };
  const holdN = W ? (W.across ? side : axis) : null, holdF = two ? (W.across ? side : axis) : OW ? [Math.cos(q.sb ?? Math.PI), -Math.sin(q.sb ?? Math.PI), 0] : null;
  const armN = ik(sN, nearT, M.upper, M.fore, pole(1, nearT, sN, holdN)), armF = ik(sF, farT, M.upper, M.fore, pole(-1, farT, sF, holdF));
  // the legs: knees forward, a little out
  const kneePole = (s) => mv(Rp, [1, 0, s * 0.35]);
  const hipN = hipAt(1), hipF = hipAt(-1);
  const legN = ik(hipN, ankleN, M.thigh, M.shin, kneePole(1)), legF = ik(hipF, ankleF, M.thigh, M.shin, kneePole(-1));
  const footDir = (s) => { const t = hipTurn * 0.6 + s * 8 * DEG; return [Math.cos(t), 0, Math.sin(t)]; };
  const B = {
    pelvis: frame(pelvis, Rp), waist: frame(waist, mm(rotZ(-tilt * 0.6), rotY(-(turn + hipTurn) / 2))), chest: frame(chest, Rc), head: frame(head, Rh), neck: frame(neck, Rh),
    upperN: boneFrame(sN, armN.joint, armN.v), foreN: boneFrame(armN.joint, armN.end, armN.v), upperF: boneFrame(sF, armF.joint, armF.v), foreF: boneFrame(armF.joint, armF.end, armF.v),
    thighN: boneFrame(hipN, legN.joint, legN.v), shinN: boneFrame(legN.joint, legN.end, legN.v), thighF: boneFrame(hipF, legF.joint, legF.v), shinF: boneFrame(legF.joint, legF.end, legF.v),
  };
  B.footN = frame(legN.end, mm(rotY(-Math.atan2(footDir(1)[2], footDir(1)[0])), rotZ(q.toeF ? -55 * DEG : 0)));
  B.footF = frame(legF.end, mm(rotY(-Math.atan2(footDir(-1)[2], footDir(-1)[0])), rotZ(q.toeB ? -55 * DEG : 0)));
  return { B, W, OW, q, axis, side, armN, armF, legN, legF, sN, sF, hipN, hipF, turn };
}

// ---- drawing: every part goes through one depth buffer
const BW = 300, BH = 240, OX = 150, OY = 180; // the scratch grid, big enough for a raised scythe; feet at (OX, OY)
const Zb = new Float32Array(BW * BH), Tone = new Float32Array(BW * BH), Part = new Int8Array(BW * BH), Mat = new Int8Array(BW * BH), Fr = new Int8Array(BW * BH), LX = new Float32Array(BW * BH), LY = new Float32Array(BW * BH), Col = new Uint32Array(BW * BH);
const touched = [];
const LIGHT = unit([-0.55, 0.72, 0.5]);
let clipBody = false, clipWeapon = false, curFrameIndex = 0, curDim = 0, onlyPart = 0;
const FRAME_IDS = ["pelvis", "waist", "chest", "head", "neck", "upperN", "foreN", "upperF", "foreF", "thighN", "shinN", "thighF", "shinF", "footN", "footF"];
function plot(i, z, tone, part, mat, wx, wy, color) {
  if (onlyPart && part !== onlyPart) return;
  if (Part[i] === 0) touched.push(i);
  else if (z <= Zb[i]) return;
  Zb[i] = z;
  Tone[i] = tone;
  Part[i] = part;
  Mat[i] = mat;
  Fr[i] = curFrameIndex;
  LX[i] = wx;
  LY[i] = wy;
  Col[i] = color;
}
function sphere(c, r, part, mat) {
  const x0 = Math.floor(c[0] - r), x1 = Math.ceil(c[0] + r), y0 = Math.floor(c[1] - r), y1 = Math.ceil(c[1] + r);
  for (let wy = y0; wy <= y1; wy++)
    for (let wx = x0; wx <= x1; wx++) {
      const dx = wx - c[0], dy = wy - c[1], d2 = dx * dx + dy * dy;
      if (d2 > r * r || (clipBody && wy < 1.5)) continue;
      const dz = Math.sqrt(r * r - d2), n = [dx / r, dy / r, dz / r], i = (OY - wy) * BW + (OX + wx);
      plot(i, c[2] + dz, dot(n, LIGHT), part, mat, wx, wy, 0);
    }
}
function sweep(a, b, ra, rb, part, mat, bulge = 0) {
  const n = Math.max(2, Math.ceil(len(sub(b, a)) / 0.4));
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    sphere(add(a, mul(sub(b, a), u)), ra + (rb - ra) * u + bulge * Math.sin(u * Math.PI), part, mat);
  }
}
// an ellipsoid with radii r along the axes of frame R, seen along z
function ellipsoid(c, R, r, part, mat) {
  const big = Math.max(r[0], r[1], r[2]), x0 = Math.floor(c[0] - big), x1 = Math.ceil(c[0] + big), y0 = Math.floor(c[1] - big), y1 = Math.ceil(c[1] + big);
  const Rt = [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]], D = [1 / (r[0] * r[0]), 1 / (r[1] * r[1]), 1 / (r[2] * r[2])];
  // A = R diag(D) R^T
  const A = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) A[i * 3 + j] = R[i * 3] * D[0] * R[j * 3] + R[i * 3 + 1] * D[1] * R[j * 3 + 1] + R[i * 3 + 2] * D[2] * R[j * 3 + 2];
  void Rt;
  for (let wy = y0; wy <= y1; wy++)
    for (let wx = x0; wx <= x1; wx++) {
      if (clipBody && wy < 1.5) continue;
      const dx = wx - c[0], dy = wy - c[1];
      const qa = A[8], qb = 2 * (A[2] * dx + A[5] * dy), qc = A[0] * dx * dx + 2 * A[1] * dx * dy + A[4] * dy * dy - 1, disc = qb * qb - 4 * qa * qc;
      if (disc < 0) continue;
      const dz = (-qb + Math.sqrt(disc)) / (2 * qa);
      const n = unit([A[0] * dx + A[1] * dy + A[2] * dz, A[3] * dx + A[4] * dy + A[5] * dz, A[6] * dx + A[7] * dy + A[8] * dz]);
      plot((OY - wy) * BW + (OX + wx), c[2] + dz, dot(n, LIGHT), part, mat, wx, wy, 0);
    }
}
// parts: each has its own number, so edges between them can be seen
const PART = { pelvis: 1, waist: 2, chest: 3, neck: 4, head: 5, face: 6, upperN: 7, elbowN: 8, foreN: 9, handN: 10, upperF: 11, elbowF: 12, foreF: 13, handF: 14, thighN: 15, kneeN: 16, shinN: 17, footN: 18, thighF: 19, kneeF: 20, shinF: 21, footF: 22, weapon: 23, offWeapon: 24 };
const useFrame = (name) => { curFrameIndex = FRAME_IDS.indexOf(name); };

function drawBody(S) {
  const { B, armN, armF, legN, legF, sN, sF, hipN, hipF, turn } = S, F_ = (name) => B[name];
  useFrame("pelvis");
  ellipsoid(add(F_("pelvis").t, mv(F_("pelvis").R, [0, -0.2, 0])), F_("pelvis").R, [2.9, 2.6, 4.2], PART.pelvis, 0);
  useFrame("waist");
  sweep(F_("pelvis").t, F_("chest").t, 3, 3.3, PART.waist, 1);
  useFrame("chest");
  ellipsoid(add(F_("chest").t, mv(F_("chest").R, [0.2, 0.9, 0])), F_("chest").R, [3.4, 4.2, 5.5], PART.chest, 0);
  useFrame("neck");
  sweep(F_("neck").t, add(F_("neck").t, mv(F_("head").R, [0, 1.6, 0])), 1.25, 1.15, PART.neck, 1);
  useFrame("head");
  ellipsoid(F_("head").t, F_("head").R, [3, 3.3, 2.8], PART.head, 0);
  ellipsoid(add(F_("head").t, mv(F_("head").R, [0.85, -0.45, 0])), F_("head").R, [2.4, 2.7, 2.35], PART.face, 0);
  const arm = (far, A, sh, up, el, fo, ha, nameU, nameF) => {
    curDim = far ? 1 : 0;
    useFrame(nameU);
    sphere(sh, 2.5, up, 0);
    sweep(sh, A.joint, 2.1, 1.6, up, 0);
    sphere(A.joint, 1.45, el, 1);
    useFrame(nameF);
    sweep(A.joint, A.end, 1.6, 1.2, fo, 0, 0.15);
    sphere(A.end, 1.9, ha, 0);
    curDim = 0;
  };
  arm(false, armN, sN, PART.upperN, PART.elbowN, PART.foreN, PART.handN, "upperN", "foreN");
  arm(true, armF, sF, PART.upperF, PART.elbowF, PART.foreF, PART.handF, "upperF", "foreF");
  const leg = (far, L, hip, th, kn, sh, fo, nameT, nameS, nameFt) => {
    useFrame(nameT);
    sweep(hip, L.joint, 3.2, 2.2, th, 0);
    sphere(L.joint, 1.9, kn, 1);
    useFrame(nameS);
    sweep(L.joint, L.end, 2.15, 1.4, sh, 0, 0.4);
    useFrame(nameFt);
    const R = F_(nameFt).R, a = F_(nameFt).t;
    sweep(add(a, mv(R, [-1.5, -0.6, 0])), add(a, mv(R, [4.6, -1.1, 0])), 1.7, 1.25, fo, 0);
  };
  leg(false, legN, hipN, PART.thighN, PART.kneeN, PART.shinN, PART.footN, "thighN", "shinN", "footN");
  leg(true, legF, hipF, PART.thighF, PART.kneeF, PART.shinF, PART.footF, "thighF", "shinF", "footF");
  void turn;
}

// ---- what they hold: drawn along the handle from the fist, through the same depth buffer
function along(H, axis, side, part) {
  const n = cross(axis, side);
  const T = (i, k, c, lift = 0) => {
    const x = H[0] + axis[0] * i + side[0] * k + n[0] * lift, y = H[1] + axis[1] * i + side[1] * k + n[1] * lift, z = H[2] + axis[2] * i + side[2] * k + n[2] * lift;
    const wx = Math.round(x), wy = Math.round(y);
    if (clipWeapon && wy < 0) return;
    const idx = (OY - wy) * BW + (OX + wx);
    if (idx < 0 || idx >= BW * BH) return;
    curFrameIndex = -1;
    plot(idx, z + 0.05, 2, part, 2, wx, wy, c);
  };
  T.at = (i, k) => [H[0] + axis[0] * i + side[0] * k, H[1] + axis[1] * i + side[1] * k, H[2] + axis[2] * i + side[2] * k];
  return T;
}
const STEEL = Object.fromEntries(Object.entries({ hi: "#ffffff", a: "#e8edf6", b: "#a4afc6", d: "#68748f", gold: "#ffd84a", goldD: "#b8862a", grip: "#7a3a2a", gripD: "#4a2018", wood: "#8a5a32", woodD: "#5a3820", dark: "#3a3448", darkD: "#262033", olive: "#58663f", oliveA: "#7d8c58", oliveD: "#3a4529" }).map(([k, v]) => [k, hex(v) >>> 0]));
function blade(T, from, length, w) {
  for (let i = from; i <= from + length + 0.01; i += 0.4) {
    const r = i - from, wd = r > length - 5 ? Math.max(0, ((length - r) / 5) * w) : w;
    for (let k = -wd; k <= wd + 0.01; k += 0.4) T(i, k, k < -w * 0.4 ? STEEL.hi : k > w * 0.4 ? STEEL.d : STEEL.a);
  }
}
const haft = (T, from, to, a, d, r = 0.8) => {
  for (let i = from; i <= to; i += 0.4) for (let k = -r; k <= r + 0.01; k += 0.4) T(i, k, k > 0.1 ? d : a);
};
const WEAPONS = {
  // the fist is at i = 0; `two` is where the other hand goes; `across`: the handle lies across the weapon's length
  sword: { two: -4.4, draw(T, q) {
    const end = q.two ? -6.5 : -2.6;
    haft(T, end, 2.2, STEEL.grip, STEEL.gripD);
    for (let k = -1.4; k <= 1.4; k += 0.4) T(end - 0.4, k, STEEL.gold);
    for (let k = -4.6; k <= 4.6; k += 0.4) (T(2.6, k, Math.abs(k) > 3.8 ? STEEL.goldD : STEEL.gold), T(3, k, STEEL.goldD));
    blade(T, 3.2, 25, 2.2);
  } },
  greatsword: { two: -4.8, draw(T) {
    haft(T, -7.2, 2.2, STEEL.grip, STEEL.gripD);
    for (let k = -1.8; k <= 1.8; k += 0.4) T(-7.6, k, STEEL.gold);
    for (let k = -6.6; k <= 6.6; k += 0.4) (T(2.6, k, Math.abs(k) > 5.6 ? STEEL.goldD : STEEL.gold), T(3, k, STEEL.goldD));
    blade(T, 3.2, 31, 3);
    for (let i = 4; i <= 28; i += 0.4) T(i, 0, STEEL.b);
  } },
  dagger: { draw(T) {
    haft(T, -2.4, 1.8, STEEL.grip, STEEL.gripD);
    for (let k = -2.6; k <= 2.6; k += 0.4) T(2.2, k, STEEL.goldD);
    blade(T, 2.6, 10, 1.3);
  } },
  spear: { two: -12, draw(T) {
    haft(T, -18, 36, STEEL.wood, STEEL.woodD, 0.5);
    blade(T, 36, 11, 2);
    for (let k = -2.4; k <= 2.4; k += 0.4) T(36, k, STEEL.goldD);
  } },
  hammer: { two: -7, draw(T) {
    for (const lift of [-0.8, 0, 0.8]) for (let i = -10; i <= 18; i += 0.4) for (let k = -0.8; k <= 0.81; k += 0.4) T(i, k, k > 0.1 ? STEEL.woodD : STEEL.wood, lift);
    // the head is a block: its two faces, and the steel between them
    for (let i = 18; i <= 28; i += 0.4) for (let k = -9; k <= 9; k += 0.4) {
      const face = Math.abs(k) > 7.4 ? (k < 0 ? STEEL.a : STEEL.d) : i < 20 ? STEEL.hi : i > 26.4 ? STEEL.d : Math.abs(k) < 2 ? STEEL.gold : STEEL.b;
      T(i, k, face, 4.5);
      T(i, k, face, -4.5);
      if (i < 18.4 || i > 27.6 || Math.abs(k) > 8.6) for (let l = -4; l <= 4; l += 0.4) T(i, k, k < 0 ? STEEL.a : i > 27.6 ? STEEL.d : STEEL.b, l);
    }
  } },
  scythe: { two: -11, draw(T) {
    haft(T, -16, 31, STEEL.dark, STEEL.darkD, 0.5);
    for (let j = 0; j <= 28; j += 0.4) {
      const u = j / 28, w = 3.2 * (1 - u) + 0.3, b = 31.5 - u * u * 12;
      for (let k = -w; k <= w; k += 0.4) T(b + k, j + 0.8, k > w * 0.3 ? STEEL.hi : k < -w * 0.4 ? STEEL.d : STEEL.b);
    }
  } },
  claw: { draw(T) {
    for (const q0 of [-2.4, 0, 2.4])
      for (let i = 2; i <= 9.5; i += 0.4) {
        const u = (i - 2) / 7.5, k = q0 + u * u * 1.8;
        T(i, k, u > 0.55 ? STEEL.hi : STEEL.a);
        if (u < 0.6) T(i, k + 0.8, STEEL.d);
      }
  } },
  bow: { across: true, draw(T, q, off) {
    for (let u = -1; u <= 1.001; u += 0.025) {
      const k = u * 17, i = 6 * (1 - u * u) - 1;
      T(i, k, Math.abs(u) > 0.85 ? STEEL.goldD : STEEL.wood);
      T(i + 0.8, k, STEEL.woodD);
    }
    const tipA = T.at(-1, -17), tipB = T.at(-1, 17), mid = q.pull ? off : T.at(-1, 0);
    const line = (A, B, c) => {
      const n = Math.max(2, Math.ceil(len(sub(B, A)) / 0.4)), Z = STEEL.a;
      for (let k = 0; k <= n; k++) {
        const P = add(A, mul(sub(B, A), k / n)), wx = Math.round(P[0]), wy = Math.round(P[1]), idx = (OY - wy) * BW + (OX + wx);
        curFrameIndex = -1;
        plot(idx, P[2] + 0.05, 2, PART.weapon, 2, wx, wy, c ?? Z);
      }
    };
    line(tipA, mid);
    line(tipB, mid);
    if (q.nocked) {
      const nock = mid, tip = T.at(13, 0);
      line(nock, tip, STEEL.wood);
      for (let i = 9; i <= 13; i += 0.4) for (let k = -(13 - i) * 0.45; k <= (13 - i) * 0.45; k += 0.4) T(i, k, STEEL.hi);
    }
  } },
  pistol: { across: true, draw(T) {
    for (let i = -1; i <= 9.5; i += 0.4) for (let k = -4.2; k <= -2.4; k += 0.4) T(i, k, k < -3.6 ? STEEL.a : k > -2.9 ? STEEL.d : STEEL.b);
    for (let i = -1.2; i <= 1.2; i += 0.4) for (let k = -2.4; k <= 2.4; k += 0.4) T(i, k, STEEL.gripD);
    T(9, -4.6, STEEL.hi);
  } },
  launcher: { two: -9, draw(T) {
    for (let i = -14; i <= 22; i += 0.4) for (let k = -6; k <= -1; k += 0.4) T(i, k, k < -4.8 ? STEEL.oliveA : k > -2.2 ? STEEL.oliveD : Math.abs(i - 3) < 1.4 ? STEEL.gold : STEEL.olive);
    for (let k = -6.8; k <= -0.2; k += 0.4) (T(22.4, k, STEEL.b), T(-14.4, k, STEEL.d));
  } },
  handle: { draw(T) {
    haft(T, -2.6, 6, STEEL.grip, STEEL.gripD);
    for (let k = -1.6; k <= 1.6; k += 0.4) (T(-3, k, STEEL.gold), T(6.4, k, STEEL.gold));
  } },
};

// ---- flat tones, seams, and one clean ink line
function finish(S, restFrames) {
  const dim = (part) => part >= PART.upperF && part <= PART.handF ? 1 : part >= PART.thighF && part <= PART.footF ? 1 : 0;
  const toneOf = (v, part) => {
    let t = v > 0.8 ? 0 : v > 0.42 ? 1 : v > 0.08 ? 2 : 3;
    t = Math.min(3, t + dim(part));
    return t;
  };
  const tones = new Map();
  for (const i of touched) tones.set(i, toneOf(Tone[i], Part[i]));
  // a lone pixel of a tone, with no neighbour like it on the same part, takes its neighbours' tone
  for (const i of touched) {
    if (Mat[i] === 2) continue;
    const t = tones.get(i), votes = [0, 0, 0, 0];
    let same = false;
    for (const d of [-1, 1, -BW, BW]) {
      const j = i + d;
      if (Part[j] !== Part[i] || !tones.has(j)) continue;
      const u = tones.get(j);
      votes[u]++;
      if (u === t) same = true;
    }
    if (!same && votes.some((v) => v > 0)) tones.set(i, votes.indexOf(Math.max(...votes)));
  }
  for (const i of touched) {
    if (Mat[i] === 2) continue;
    Col[i] = (Mat[i] === 1 ? CORE : SHELL)[tones.get(i)];
  }
  // where two parts meet: a soft seam if they touch, ink if one stands in front of the other
  const marks = new Map();
  for (const i of touched) {
    for (const d of [1, BW]) {
      const j = i + d;
      if (Part[j] === 0 || Part[j] === Part[i]) continue;
      const far = Zb[i] < Zb[j] ? i : j, dz = Math.abs(Zb[i] - Zb[j]), steel = Mat[i] === 2 || Mat[j] === 2;
      if (Mat[far] === 2 && dz < 1) continue;
      const ink = steel || dz > 2.2;
      if (ink) marks.set(far, INK);
      else if (!marks.has(far)) marks.set(far, SEAM);
    }
  }
  for (const [i, c] of marks) Col[i] = c;
  // the mark on his chest, when it's facing us
  const { B } = S, chestAt = add(B.chest.t, mv(B.chest.R, [3, 1.6, -1.8]));
  if (mv(B.chest.R, [1, 0, 0])[2] > 0.15) {
    const i = (OY - Math.round(chestAt[1])) * BW + (OX + Math.round(chestAt[0]));
    if (Part[i] === PART.chest) Col[i] = MARK;
  }
  // the outline, and everything into a small list of pixels
  const list = touched.slice(), ring = new Map();
  for (const i of list) for (const d of [-1, 1, -BW, BW]) { const j = i + d; if (Part[j] === 0 && !ring.has(j)) ring.set(j, i); }
  const n = list.length + ring.size, out = { n, xs: new Int16Array(n), ys: new Int16Array(n), color: new Uint32Array(n), src: new Int16Array(n), ink: new Uint8Array(n), x0: 0, y0: 0, x1: 0, y1: 0 };
  const srcFor = (i) => {
    const f = Fr[i];
    if (f < 0 || !restFrames) return -1;
    const name = FRAME_IDS[f], A = B[name], R0 = restFrames[name], wx = (i % BW) - OX, wy = OY - ((i / BW) | 0), P = [wx, wy, Zb[i]];
    const lp = tv(A.R, sub(P, A.t)), rp = add(R0.t, mv(R0.R, lp)), c = Math.round(rp[0]) + 12, r = 38 - Math.round(rp[1]);
    return c < 0 || r < 0 || c >= W0 || r >= H0 ? -1 : r * W0 + c;
  };
  let k = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const push = (i, c, s, isInk) => {
    const x = (i % BW) - OX, y = ((i / BW) | 0) - OY;
    out.xs[k] = x; out.ys[k] = y; out.color[k] = c; out.src[k] = s; out.ink[k] = isInk ? 1 : 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    k++;
  };
  for (const i of list) push(i, Col[i], srcFor(i), Col[i] === INK);
  for (const [j, i] of ring) push(j, INK, srcFor(i), true);
  let zs = 0;
  for (const i of list) zs += Zb[i];
  Object.assign(out, { x0, y0, x1, y1, z: list.length ? zs / list.length : 0 });
  for (const i of list) Part[i] = 0;
  touched.length = 0;
  return out;
}

const turnAll = (S, a) => {
  // the whole figure turned about the vertical through the feet
  const R = rotY(-a), P = (v) => mv(R, v);
  for (const f of Object.values(S.B)) { f.t = P(f.t); f.R = mm(R, f.R); }
  for (const A of [S.armN, S.armF, S.legN, S.legF]) { A.joint = P(A.joint); A.end = P(A.end); }
  S.sN = P(S.sN); S.sF = P(S.sF); S.hipN = P(S.hipN); S.hipF = P(S.hipF);
  S.axis = P(S.axis); S.side = P(S.side);
};
let REST_FRAMES = null;
function render(pose) {
  const S = solve(pose), q = S.q, whole = (q.yaw ?? 0) + (q.face === -1 ? Math.PI : 0);
  if (whole) turnAll(S, whole);
  const air = (q.y ?? 0) < -0.5;
  clipBody = !air;
  clipWeapon = !air;
  drawBody(S);
  clipBody = false;
  if (S.W) S.W.draw(along(S.armN.end, S.axis, S.side, PART.weapon), q, S.armF.end);
  if (S.OW) {
    const sb = q.sb ?? Math.PI;
    let ax = [Math.cos(sb), -Math.sin(sb), 0], sd = [-Math.sin(sb), -Math.cos(sb), 0];
    if (whole) { const R = rotY(-whole); ax = mv(R, ax); sd = mv(R, sd); }
    S.OW.draw(along(S.armF.end, ax, sd, PART.offWeapon), q, S.armF.end);
  }
  clipWeapon = false;
  return finish(S, REST_FRAMES);
}
REST_FRAMES = solve({}).B;

const CACHE = new Map();
const keyOf = (p) => {
  let s = (p.y ?? 0) < -0.5 ? "air," : "";
  for (const k of Object.keys(p).sort()) {
    const v = p[k];
    if (v === undefined || k === "x" || k === "y" || k === "ghost") continue;
    s += k + (typeof v === "number" ? (k === "sa" || k === "sb" || k === "wl" || k === "yaw" || k === "turn" ? Math.round(v * 20) : Math.round(v)) : v) + ",";
  }
  return s;
};
/** How far short of where the pose wants them the hands fall, in px: arms don't stretch. */
function shortfall(pose) {
  const S = solve(pose), q = S.q, near = len(sub(S.armN.end, [q.fx, -q.fy, S.armN.end[2]])), far = q.two ? 0 : len(sub(S.armF.end, [q.bx, -q.by, S.armF.end[2]]));
  return Math.max(near, far);
}
/** The pixels of a pose: { n, xs, ys, color, src, ink, x0, y0, x1, y1 }, in local space with the feet at (0, 0). */
function posed(pose) {
  const key = keyOf(pose);
  let r = CACHE.get(key);
  if (!r) {
    if (CACHE.size > 6000) CACHE.clear();
    CACHE.set(key, (r = render(pose)));
  }
  return r;
}

/**
 * The skeleton of a pose, in the same local space as posed(): x right, y down, feet at (0, 0), z toward the viewer, whole
 * figure turned by its yaw. { joints: { name: [x, y, z] }, bones: [[from, to], ...], handles: [name, ...] }: the handles
 * are what a pose moves (hands and feet); everything else is solved from them.
 */
function skeleton(pose) {
  const S = solve(pose), q = S.q, whole = (q.yaw ?? 0) + (q.face === -1 ? Math.PI : 0);
  if (whole) turnAll(S, whole);
  const { B, armN, armF, legN, legF, sN, sF, hipN, hipF } = S, at = (f, v) => add(f.t, mv(f.R, v));
  const J = {
    pelvis: B.pelvis.t, waist: B.waist.t, chest: B.chest.t, neck: B.neck.t, head: B.head.t, crown: at(B.head, [0, 3.3, 0]),
    shoulderN: sN, elbowN: armN.joint, handN: armN.end, shoulderF: sF, elbowF: armF.joint, handF: armF.end,
    hipN, kneeN: legN.joint, ankleN: legN.end, toeN: at(B.footN, [4.6, -1.1, 0]), hipF, kneeF: legF.joint, ankleF: legF.end, toeF: at(B.footF, [4.6, -1.1, 0]),
  };
  const joints = Object.fromEntries(Object.entries(J).map(([k, v]) => [k, [v[0], -v[1], v[2]]]));
  const bones = [["pelvis", "waist"], ["waist", "chest"], ["chest", "neck"], ["neck", "head"], ["head", "crown"], ["chest", "shoulderN"], ["shoulderN", "elbowN"], ["elbowN", "handN"], ["chest", "shoulderF"], ["shoulderF", "elbowF"], ["elbowF", "handF"], ["pelvis", "hipN"], ["hipN", "kneeN"], ["kneeN", "ankleN"], ["ankleN", "toeN"], ["pelvis", "hipF"], ["hipF", "kneeF"], ["kneeF", "ankleF"], ["ankleF", "toeF"]];
  return { joints, bones, handles: ["handN", "handF", "ankleN", "ankleF"] };
}
/** The figure taken apart: each part drawn alone, with its own outline, and where its middle is. For exploded views. */
function posedParts(pose) {
  const out = [];
  for (const [name, part] of Object.entries(PART)) {
    onlyPart = part;
    const r = render(pose);
    onlyPart = 0;
    if (!r.n) continue;
    let cx = 0, cy = 0;
    for (let i = 0; i < r.n; i++) { cx += r.xs[i]; cy += r.ys[i]; }
    out.push({ name, part, n: r.n, xs: r.xs, ys: r.ys, color: r.color, cx: cx / r.n, cy: cy / r.n, z: r.z });
  }
  return out;
}

exports.shortfall = shortfall;
exports.posed = posed;
exports.skeleton = skeleton;
exports.posedParts = posedParts;
exports.STAND = STAND;
exports.WEAPONS = WEAPONS;
  };
  __mods["core/poses.js"] = function(exports, __req) {
// The stance acts start from. A pose only says what differs from standing easy (STAND in rig.js), in screen terms, px from
// the feet, y negative up. Give the hands and feet; the skeleton works out the rest.
//   x, y       where the feet are, from the effect's origin
//   crouch     hips lowered; lean  the spine bent forward (+) or back (-); hx, hy  the head rolled, nodded
//   fx, fy, fz the near (right) hand; bx, by, bz  the far (left) hand; ffx, ffy  the near foot; fbx, fby  the far foot
//   turn       how far the chest faces us, in radians (it follows the hands if you leave it out); yaw  the whole body turned
//              about its feet (0 faces right, pi faces left, in between towards us; a spin is really a spin)
//   twist      extra chest turn; armsFront  the far hand comes round in front of the chest
//   weapon, sa what the near hand holds and its angle on screen (radians, 0 points forward); two  both hands on it
//   wl, wz     foreshorten the weapon towards (or, wz -1, away from) the viewer: wl is its length on screen, 1 is full
//   pull, nocked  a bow drawn to the far hand, an arrow on the string
//   offWeapon, sb  a weapon in the far hand and its angle
//   toeF, toeB up on the toes; ghost  leave after-images
//
// How the body works. He faces right, three-quarters towards us, so his near shoulder is on the LEFT of the chest on screen and
// his far shoulder on the right: for arms raised or open to us, the near hand goes left (fx < 0) and the far hand right (bx > 0). A hand
// driving forward closes the chest and brings its shoulder round; a hand drawn back opens him up. Bones have fixed lengths: an arm reaches
// about 15 px from its shoulder (shoulders are near y = -29), a leg 17 px. Arms don't stretch, so step the body in rather than ask too much.
//
// How to hold things. Keep a little bend in the elbow. The blade lags the hand on a swing, so the wrist breaks and it whips. Long weapons
// rest in one hand with the butt on the floor and take the second hand to swing. Everything is in depth, so a weapon can swing round the front
// of him: turn the body (yaw) and the weapon goes with it.

const READY = { crouch: 3, fx: 11, fy: -21, bx: 9, by: -21, ffx: 7, fbx: -7 };

exports.READY = READY;
  };
  __mods["core/chain.js"] = function(exports, __req) {
// Moves: several effects played as one. A cue says which effect, when, where and for how long; a projectile is just an
// effect whose x is a function of time. It's an ordinary effect from the outside: it plays, recolors and exports.

const {  createFx  } = __req("core/fx.js");

/**
 * create(o) for a list of cues: { fx (an effect module), t (when it starts), until (cut it off here), x, y (numbers, or
 * functions of the move's time, local space), flip, ...any of that effect's options }.
 */
function chain(cues) {
  return (o) => {
    const list = cues.map(({ fx, t, until, x, y, flip, ...opts }, i) => ({ fx, t: t ?? 0, until: until ?? Infinity, x: x ?? 0, y: y ?? 0, flip: !!flip, opts: { ...opts, seed: (o.seed ?? 1) + i }, inst: null, over: false }));
    let t = 0;
    const at = (v) => (typeof v === "function" ? v(t) : v);
    const each = (p, layer) => {
      const { frame, tx, ty, fx: sign, cs, sn, fade, lightK } = p;
      for (const c of list) {
        if (!c.inst || c.over) continue;
        c.inst.options.x = tx + sign * at(c.x);
        c.inst.options.y = ty + at(c.y);
        c.inst.options.flip = sign < 0 !== c.flip;
        c.inst.draw(frame, layer);
      }
      // each one places the painter for itself: put it back for whoever draws next
      Object.assign(p, { tx, ty, fx: sign, cs, sn, fade, lightK });
    };
    return {
      update(dt) {
        t += dt;
        for (const c of list) {
          if (c.over || t < c.t) continue;
          if (!c.inst) c.inst = createFx(c.fx, c.opts);
          else c.inst.update(dt);
          if (t >= c.until || (c.inst.done() && !c.fx.meta?.loop)) c.over = true;
        }
      },
      drawBack: (p) => each(p, "back"),
      draw: (p) => each(p, "front"),
    };
  };
}

/** Reuse an act's keys in a longer move: later by dt, moved along by dx, with anything else laid over each pose. */
const shiftKeys = (keys, dt, { dx = 0, ...over } = {}) => keys.map(([t, pose, how]) => [t + dt, { ...pose, ...over, x: (pose.x ?? 0) + dx }, how]);
/** The same for hits. */
const shiftHits = (hits, dt) => hits.map((h) => ({ ...h, t: h.t + dt }));

exports.chain = chain;
exports.shiftKeys = shiftKeys;
exports.shiftHits = shiftHits;
  };
  __mods["fx/melee/sword-slash.js"] = function(exports, __req) {
// The crescent, echo, trail, glint and spark recipe is adapted from Sprite Fusion's open-source slash
// (https://www.spritefusion.com/pixel-art-vfx/slash), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, P, Rng, fit, sparkle, clamp, smooth, ease, TAU, READY  } = __req("core/index.js");

const meta = {
  name: "Sword slash",
  desc: "A tilted crescent whips round in two frames, cools from white to deep blue as it trails off, glints at the tip and throws sparks.",
  tags: ["melee", "slash", "sword", "combat", "directional", "one-shot"],
  size: [136, 104],
  origin: [44, 92],
  duration: 0.75,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#b8c9e8", "#e8f1ff", "#ffffff"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    radius: 42,
    seed: 2,
  },
};

const GUARD = { ...READY, weapon: "sword", fx: 12, fy: -21, sa: -0.85 };
// the blade goes back past his head, then lags behind the hand on the way through, so the wrist breaks and it whips
const WIND = { ...GUARD, x: -8, crouch: 4, lean: -4, fx: -7, fy: -35, sa: -2.65, bx: 9, by: -25, armsFront: true, ffx: 9, fbx: -8 };
const CUT = { ...GUARD, x: 0, crouch: 2, lean: 3, fx: 16, fy: -37, sa: -1.45, bx: -7, by: -24, ffx: 11, fbx: -10, ghost: 1 };
const DOWN = { ...GUARD, x: 2, crouch: 5, lean: 5, fx: 20, fy: -21, sa: 0.62, bx: -9, by: -24, ffx: 13, fbx: -10, toeB: true };
const act = {
  target: { x: 58 },
  poses: [
    [-0.55, { ...GUARD, x: -8 }],
    [-0.3, WIND],
    [-0.08, { ...WIND, crouch: 5, lean: -5 }],
    [0, CUT, "snap"],
    [0.06, DOWN, "snap"],
    [0.3, { ...DOWN, x: 3, crouch: 6 }],
    [0.58, { ...GUARD, x: 1, crouch: 3, fx: 15, fy: -21, sa: 0.1, bx: -5, by: -21, ffx: 9, fbx: -7 }],
    [0.86, { ...GUARD, x: -8 }],
  ],
  hits: [{ t: 0.06, stop: 0.14, shake: 0.18, amp: 2, push: 2.8, straw: 18 }],
  dust: [{ t: 0.06, x: 16, n: 7, dir: 1 }, { t: 0.06, x: -11, n: 4, dir: -1 }],
};

// a point on the slash's tilted ellipse
function onArc(s, r, a) {
  const lx = Math.cos(a) * r, ly = Math.sin(a) * r * s.sy, c = Math.cos(s.rot), n = Math.sin(s.rot);
  return [s.cx + lx * c - ly * n, s.cy + lx * n + ly * c];
}

// the smear: thickest just behind the leading edge, tapering to a hair at the tail, white on the outer rim,
// cooling down the ramp with age and towards the tail; the tail dissolves through the dither
function crescent(p, s, ta, L, W, age) {
  if (Math.abs(L) < 0.02 || W < 0.3) return;
  const R = s.ramp, n = R.length, dir = Math.sign(L), span = Math.abs(L), c = Math.cos(s.rot), sn = Math.sin(s.rot), B = s.R + 2;
  p.shade(s.cx - B, s.cy - B, s.cx + B, s.cy + B, (x, y, out) => {
    const dx = x - s.cx, dy = y - s.cy, lx = dx * c + dy * sn, ly = (-dx * sn + dy * c) / s.sy, r = Math.hypot(lx, ly);
    if (r > s.R + 0.5 || r < s.R - W - 1) return;
    let u = (dir * (Math.atan2(ly, lx) - ta)) % TAU;
    if (u < 0) u += TAU;
    if (u > span) return;
    const v = u / span, w = W * Math.pow(Math.sin(Math.PI * Math.pow(v, 2.2)), 0.6);
    if (w < 0.35) return;
    const q = (s.R - r) / w;
    if (q < 0 || q > 1) return;
    // brightest step at the rim while it's young, then darker steps inward, with age and towards the tail
    const ci = q < 0.22 && age < 0.5 ? 0 : Math.round(q * (n - 1) * 0.75 + age * 2.4 - v * 0.8 + 0.4);
    out.c = R[n - 1 - clamp(ci, 0, n - 1)];
    out.a = Math.min(1, v / 0.4);
  });
  for (let u = 0; u <= span; u += 0.3) {
    const [x, y] = onArc(s, s.R - W * 0.4, ta + dir * u);
    p.glow(x, y, 5 + W, R[n - 3], 0.22 * (1 - age) * (u / span));
  }
}

function drawSlash(p, s, t) {
  const u = t - s.t0;
  if (u < 0) return;
  const span = s.a1 - s.a0, head = ease.outExpo(clamp(u / s.sweep)), tail = smooth(s.sweep + s.hold, s.sweep + s.hold + s.trail, u);
  const age = clamp(u / (s.sweep + s.hold + s.trail));
  if (tail < 1) crescent(p, s, s.a0 + span * tail, span * (head - tail), s.W * (1 - tail * 0.55), age);
  // a dotted trace of the blade's path lingers where the smear has already gone
  const th = 0.7 * (1 - clamp((u - s.sweep - s.hold) / (s.trail + 0.2)));
  if (tail > 0.02 && th > 0)
    for (let k = 0; k <= tail; k += 0.6 / (Math.abs(span) * s.R)) {
      const [x, y] = onArc(s, s.R - 0.5, s.a0 + span * k);
      p.dot(x, y, s.ramp[1], th * (0.4 + 0.6 * k));
    }
}

function tipOf(s) {
  const [x, y] = onArc(s, s.R - s.W * 0.3, s.a1), [x2, y2] = onArc(s, s.R - s.W * 0.3, s.a1 + Math.sign(s.a1 - s.a0) * 0.05);
  const l = Math.hypot(x2 - x, y2 - y) || 1;
  return { x, y, dx: (x2 - x) / l, dy: (y2 - y) / l };
}

function create(o) {
  const C = fit(o.palette, 7), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks });
  const R0 = o.radius, a0 = -2.55, a1 = 0.95;
  // the main smear, and a thinner echo just inside it a beat behind
  const A = { cx: 6, cy: -26, R: R0, sy: 0.6, rot: -0.38, a0, a1, W: 12, t0: 0, sweep: 0.06, hold: 0.06, trail: 0.24, ramp: C };
  const E = { ...A, R: R0 * (33 / 42), W: R0 * (4.5 / 42), a0: a0 + (a1 - a0) * 0.1, a1: a1 - (a1 - a0) * (0.15 / 3.5), t0: 0.017, hold: 0.03, trail: 0.2, ramp: C.slice(0, 6) };
  const tip = tipOf(A);
  let t = 0, landed = false;
  return {
    update(dt) {
      t += dt;
      if (!landed && t >= A.sweep) {
        landed = true;
        // sparks off the edge where it stops, and bright shavings flung off the arc
        for (let i = 0; i < 10; i++) {
          const a = Math.atan2(tip.dy, tip.dx) + Rg.range(-0.5, 0.5), sp = Rg.range(150, 400);
          ps.spawn(P.SPARK, tip.x, tip.y, Math.cos(a) * sp, Math.sin(a) * sp, Rg.range(0.12, 0.35));
        }
        for (let i = 0; i < 16; i++) {
          const a = a0 + (a1 - a0) * Rg.range(0.3, 1), [x, y] = onArc(A, A.R, a);
          const ox = x - A.cx, oy = y - A.cy, l = Math.hypot(ox, oy) || 1, sp = Rg.range(30, 100);
          ps.spawn(P.MOTE, x, y, (ox / l) * sp, (oy / l) * sp - 10, Rg.range(0.25, 0.55), C[4 + Rg.int(0, 1)], 0.6);
        }
      }
      ps.update(dt);
    },
    draw(p) {
      drawSlash(p, E, t);
      drawSlash(p, A, t);
      // the tip glints as the edge arrives
      const g = t - A.sweep * 0.6;
      if (g > 0 && g < 0.22) sparkle(p, tip.x, tip.y, 9 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.22), C[5], C[3], 0.6);
      // light rides the head of the swing
      if (t < 0.3) {
        const [x, y] = onArc(A, A.R - 4, A.a0 + (A.a1 - A.a0) * ease.outExpo(clamp(t / A.sweep)));
        p.glow(x, y, 40, C[3], 0.5 * (1 - t / 0.3));
      }
      ps.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
exports.act = act;
  };
  __mods["fx/melee/double-slash.js"] = function(exports, __req) {
// The crescent, trace, glint and spark recipe is adapted from Sprite Fusion's open-source slash
// (https://www.spritefusion.com/pixel-art-vfx/slash), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, fit, sparkle, flare, clamp, ease, WHITE, READY  } = __req("core/index.js");
const {  through, slash, slashEnd, shavings, sliver  } = __req("fx/melee/_lib.js");

const meta = {
  name: "Double slash",
  desc: "A down cut, then an up cut that crosses it: the moment the X closes both strokes flash white, the crossing bursts with light and sparks, and a dotted X lingers.",
  tags: ["melee", "slash", "combo", "sword", "cross", "combat", "directional", "one-shot"],
  size: [164, 108],
  origin: [44, 92],
  duration: 0.8,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#2a0a22", "#5e1238", "#a01f4e", "#e0386a", "#ff86a6", "#ffd2dd", "#ffffff"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    seed: 6,
  },
};

const STANCE = { ...READY, weapon: "sword", fx: 12, fy: -21, sa: -0.85 };
const HIGH = { ...STANCE, x: -7, crouch: 4, lean: -4, fx: -7, fy: -35, sa: -2.65, bx: 9, by: -25, armsFront: true, ffx: 9, fbx: -8 };
const LOW = { ...STANCE, x: 3, crouch: 6, lean: 6, fx: 22, fy: -20, sa: 0.62, bx: -8, by: -24, ffx: 13, fbx: -10, toeB: true };
const act = {
  target: { x: 62 },
  poses: [
    [-0.42, { ...STANCE, x: -7 }],
    [-0.18, HIGH],
    [-0.04, { ...HIGH, crouch: 5 }],
    [0, { ...STANCE, x: 0, crouch: 2, lean: 3, fx: 16, fy: -37, sa: -1.45, bx: -7, by: -24, ffx: 11, fbx: -9, ghost: 1 }, "snap"],
    [0.06, LOW, "snap"],
    [0.14, { ...LOW, x: 4, crouch: 6, lean: 5, fx: 20, fy: -17, sa: 0.85, ghost: 1 }],
    [0.17, { ...LOW, x: 5, crouch: 3, lean: 5, fx: 22, fy: -28, sa: 0.1, by: -18, toeB: true, ghost: 1 }, "snap"],
    [0.21, { ...LOW, x: 6, crouch: 1, lean: 6, fx: 19, fy: -37, sa: -0.95, by: -18, ffx: 13, fby: -6 }, "snap"],
    [0.5, { ...LOW, x: 6, crouch: 3, lean: 3, fx: 18, fy: -36, sa: -1.05, by: -19, ffx: 12 }],
    [0.92, { ...STANCE, x: -7 }],
  ],
  hits: [
    { t: 0.06, stop: 0.05, shake: 0.08, amp: 1, push: 1.4, straw: 8 },
    { t: 0.16, stop: 0.14, shake: 0.2, amp: 2, push: 2.8, straw: 18, y: -28 },
  ],
  dust: [{ t: 0.06, x: 16, n: 5, dir: 1 }, { t: 0.17, x: -8, n: 4, dir: -1 }],
};

const UP = 0.14; // the second cut starts
const R0 = 62;

const cut = (x, y, th, dir, span, extra) => through(x, y, th, dir, R0, span, 0.55, extra);

function create(o) {
  const C = fit(o.palette, 7), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
  const X = 34, Y = -23;
  const down = cut(X, Y, 0.72, 1, 0.84, { W: 10, t0: 0, sweep: 0.06, hold: 0.07, trail: 0.24, ramp: C, lens: true });
  const up = cut(X, Y, -0.66, -1, 0.84, { W: 11, t0: UP, sweep: 0.06, hold: 0.06, trail: 0.26, ramp: C, lens: true });
  const ends = [slashEnd(down), slashEnd(up)], slivers = [-2.4, -1.1, 0.2, 1.6].map((a) => ({ a: a + Rg.range(-0.2, 0.2), r: Rg.range(5, 8), v: Rg.range(70, 120), arc: Rg.range(0.4, 0.7) }));
  const CLOSE = UP + 0.012;
  let t = 0, cut1 = false, cut2 = false, closed = false;
  return {
    update(dt) {
      t += dt;
      if (!cut1 && t >= down.sweep) {
        cut1 = true;
        shavings(ps, Rg, down, 10, [C[4], C[5]]);
        for (let i = 0; i < 6; i++) {
          const a = Math.atan2(ends[0].dy, ends[0].dx) + Rg.range(-0.5, 0.5), sp = Rg.range(120, 300);
          ps.spawn(P.SPARK, ends[0].x, ends[0].y, Math.cos(a) * sp, Math.sin(a) * sp, Rg.range(0.12, 0.3));
        }
      }
      if (!closed && t >= CLOSE) {
        closed = true;
        lights.add(X, Y, 56, C[3], 0.45, 0.4);
        lights.add(X, Y, 18, WHITE, 0.6, 0.08);
        for (let i = 0; i < 18; i++) {
          const a = Rg.range(-Math.PI, Math.PI) * 0.8, sp = Rg.range(140, 360);
          ps.spawn(P.SPARK, X, Y, Math.cos(a) * sp, Math.sin(a) * sp - 40, Rg.range(0.14, 0.4));
        }
        for (let i = 0; i < 5; i++) ps.spawn(P.STAR, X + Rg.range(-14, 14), Y + Rg.range(-12, 12), 0, -4, Rg.range(0.2, 0.4), Rg.chance(0.5) ? C[5] : WHITE, Rg.range(1, 2.2), Rg.range(0.05, 0.2));
      }
      if (!cut2 && t >= UP + up.sweep) {
        cut2 = true;
        shavings(ps, Rg, up, 12, [C[4], C[5]]);
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      // both strokes flash white for two frames when the X closes
      const flash = t >= CLOSE && t < CLOSE + 0.07 ? 1 : 0;
      down.hot = up.hot = flash;
      slash(p, down, t);
      slash(p, up, t);
      // glints at the ends of the strokes
      for (const [s, e] of [[down, ends[0]], [up, ends[1]]]) {
        const g = t - s.t0 - s.sweep * 0.6;
        if (g > 0 && g < 0.2) sparkle(p, e.x, e.y, 7 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.2), C[5], C[3], 0.5);
      }
      // the crossing: a flare, slivers flying off it, light
      const q = t - CLOSE;
      if (q >= 0 && q < 0.26) {
        const k = q / 0.26;
        flare(p, X, Y, 22 * Math.pow(1 - k, 1.4), 1 - k, C);
        p.glow(X, Y, 34, C[4], 0.35 * (1 - k));
      }
      if (q >= 0.03 && q < 0.15) {
        const k = (q - 0.03) / 0.12;
        for (const s of slivers) sliver(p, X, Y, s.a, s.r + s.v * (q - 0.03), s.arc * (1 - 0.4 * k), k < 0.4 ? C[6] : k < 0.7 ? C[5] : C[4], 1 - k);
      }
      // light rides each edge as it goes
      for (const s of [down, up]) {
        const u = t - s.t0;
        if (u <= 0 || u >= 0.25) continue;
        const e = slashEnd({ ...s, span: s.span * ease.outExpo(clamp(u / s.sweep)) });
        p.glow(e.x, e.y, 40, C[3], 0.5 * (1 - u / 0.25));
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
exports.act = act;
  };
  __mods["fx/melee/_lib.js"] = function(exports, __req) {
// Shared by the melee effects: swings on a tilted circle (the smear, its dotted trace), floor cracks, rocks.
// The crescent and trace recipe is adapted from Sprite Fusion's open-source slash
// (https://www.spritefusion.com/pixel-art-vfx/slash), MIT License, Copyright (c) 2026 Hugo Duprez.
// Files starting with _ are helpers, not effects.

const {  P, clamp, smooth, ease, hex, mix, scale, rgb, WHITE, TAU  } = __req("core/index.js");

/**
 * A swing: a circle of radius R around (cx, cy), squashed to sy across its plane (1 stands up facing us, 0.16
 * lies on the floor) and turned by rot, swept from angle a0 in direction dir (+1 turns clockwise on screen).
 * k lifts the band into a shallow cone: a point dr inside the rim sits k * dr higher, so a level ring shows its
 * near half broad and its far half thin, like a blade angled down from the hilt (keep k below sy).
 * Positions along it are u, radians from a0 in the swing's direction.
 */
const swing = (o) => ({ cx: 0, cy: 0, R: 30, sy: 1, rot: 0, a0: 0, dir: 1, k: 0, ...o });

/** A swing on radius R whose arc passes through (x, y) heading along angle th, that point `at` of the way along span. */
function through(x, y, th, dir, R, span, at = 0.55, extra = {}) {
  const a = th - (dir * Math.PI) / 2;
  return swing({ cx: x - Math.cos(a) * R, cy: y - Math.sin(a) * R, R, sy: 1, rot: 0, a0: a - dir * span * at, dir, span, ...extra });
}

/** The screen point at plane radius r, u radians along the swing. */
function onSwing(s, r, u) {
  const a = s.a0 + s.dir * u, lx = Math.cos(a) * r, ly = Math.sin(a) * r * s.sy - s.k * (s.R - r), c = Math.cos(s.rot), n = Math.sin(s.rot);
  return [s.cx + lx * c - ly * n, s.cy + lx * n + ly * c];
}

/** The on-screen unit direction the swing travels at u, and the in-plane angle there (sin < 0 is the far half). */
function travel(s, u) {
  const [x0, y0] = onSwing(s, s.R, u), [x1, y1] = onSwing(s, s.R, u + 0.01), l = Math.hypot(x1 - x0, y1 - y0) || 1;
  return { x: x0, y: y0, dx: (x1 - x0) / l, dy: (y1 - y0) / l, a: s.a0 + s.dir * u };
}

/** The plane radius and angle under a screen point (inverts onSwing, cone included). */
function plane(s, x, y) {
  const c = Math.cos(s.rot), n = Math.sin(s.rot), dx = x - s.cx, dy = y - s.cy, lx = dx * c + dy * n, ly = -dx * n + dy * c;
  if (!s.k) return [Math.hypot(lx, ly / s.sy), Math.atan2(ly / s.sy, lx)];
  // r sin(a) sy = m - k r, r cos(a) = lx  =>  r^2 (sy^2 - k^2) + 2 m k r - (lx^2 sy^2 + m^2) = 0
  const m = ly + s.k * s.R, A = s.sy * s.sy - s.k * s.k, B = 2 * m * s.k, Cc = lx * lx * s.sy * s.sy + m * m;
  const r = (-B + Math.sqrt(B * B + 4 * A * Cc)) / (2 * A);
  return [r, Math.atan2((m - s.k * r) / s.sy, lx)];
}

/**
 * Shade a swing's band from u0 to u1 (u1 - u0 at most a full turn), plane radius R + pad down to R - wMax - 1.
 * fn(u, r, out, a) shades each pixel: u along the swing, r its plane radius, a the in-plane angle. half: 0 the
 * whole band, -1 only the far half (behind a character), 1 only the near half.
 */
function smear(p, s, u0, u1, wMax, fn, half = 0, pad = 1) {
  if (u1 - u0 < 0.005) return;
  const c = Math.cos(s.rot), n = Math.sin(s.rot), A = s.R + pad + 1, Bn = A * s.sy + s.k * (wMax + 2);
  const hx = Math.hypot(A * c, Bn * n) + 1, hy = Math.hypot(A * n, Bn * c) + 1, rIn = s.R - wMax - 1;
  // each half only needs its side of the centre (plus what the tilt and the cone lift can reach across)
  const over = Math.abs(n) * A + s.k * (wMax + 2) + 2, y0 = half > 0 ? s.cy - over : s.cy - hy, y1 = half < 0 ? s.cy + over : s.cy + hy;
  p.shade(s.cx - hx, y0, s.cx + hx, y1, (x, y, out) => {
    const [r, a] = plane(s, x, y);
    if (r > s.R + pad || r < rIn) return;
    if (half && (Math.sin(a) < 0 ? -1 : 1) !== half) return;
    let u = (s.dir * (a - s.a0)) % TAU;
    if (u < 0) u += TAU;
    while (u < u0) u += TAU;
    if (u > u1) return;
    return fn(u, r, out, a);
  });
}

/** Dots along a swing at plane radius r from u0 to u1, every `step` px, alpha a(u) (dithered into a dotted trace). */
function trace(p, s, r, u0, u1, c, a, half = 0, step = 0.6) {
  const du = step / Math.max(4, r);
  for (let u = u0; u <= u1; u += du) {
    const g = s.a0 + s.dir * u;
    if (half && (Math.sin(g) < 0 ? -1 : 1) !== half) continue;
    const [x, y] = onSwing(s, r, u), k = typeof a === "function" ? a(u) : a;
    if (k > 0) p.dot(x, y, typeof c === "function" ? c(u) : c, k);
  }
}

/** Glow riding a swing from u0 to u1 (light along the arc). */
function glowAlong(p, s, r, u0, u1, rad, c, k, half = 0, step = 0.35) {
  for (let u = u0; u <= u1; u += step) {
    const g = s.a0 + s.dir * u;
    if (half && (Math.sin(g) < 0 ? -1 : 1) !== half) continue;
    const [x, y] = onSwing(s, r, u), kk = typeof k === "function" ? k(u) : k;
    if (kk > 0.004) p.glow(x, y, rad, c, kk);
  }
}

/**
 * A slash crescent along swing s (Sprite Fusion's recipe): the edge whips out over s.span radians in s.sweep s,
 * holds, then the tail follows over s.trail, thinning and cooling down s.ramp (dark to bright); a dotted trace
 * lingers where it passed. s: a swing plus { span, W, t0, sweep, hold, trail, ramp, hot (0..1 flashes it white),
 * lens (thickest in the middle, not just behind the edge) }.
 */
function slash(p, s, t, half = 0) {
  const u = t - s.t0;
  if (u < 0) return;
  const R = s.ramp, n = R.length, life = s.sweep + s.hold + s.trail, hot = s.hot ?? 0;
  const head = ease.outExpo(clamp(u / s.sweep)), tail = smooth(s.sweep + s.hold, life, u), age = clamp(u / life);
  const U = s.span * head, T = s.span * tail, W = s.W * (1 - tail * 0.55);
  if (tail < 1 && U - T > 0.01) {
    smear(p, s, T, U, W, (uu, r, out) => {
      const v = (uu - T) / (U - T), w = W * Math.pow(Math.sin(Math.PI * Math.pow(v, s.lens ? 1 : 2.2)), s.lens ? 0.75 : 0.6);
      if (w < 0.35) return;
      const q = (s.R - r) / w;
      if (q < 0 || q > 1) return;
      const ci = (q < 0.22 && age < 0.5) || q < hot * 0.7 ? 0 : Math.round(q * (n - 1) * 0.75 + age * 2.4 - v * 0.8 + 0.4 - hot * 3);
      out.c = R[n - 1 - clamp(ci, 0, n - 1)];
      out.a = Math.min(1, v / (s.lens ? 0.1 : 0.4));
    }, half);
    glowAlong(p, s, s.R - W * 0.4, T, U, 5 + W, R[n - 3], (uu) => (0.22 + hot * 0.3) * (1 - age) * ((uu - T) / (U - T)), half, 0.3);
  }
  const th = 0.7 * (1 - clamp((u - s.sweep - s.hold) / (s.trail + 0.2)));
  if (tail > 0.02 && th > 0) trace(p, s, s.R - 0.5, 0, T, R[2], (uu) => th * (0.4 + 0.6 * uu / s.span), half);
}

/** Where a slash's edge ends up, and which way it's travelling there. */
const slashEnd = (s) => travel({ ...s, R: s.R - s.W * 0.3 }, s.span);

/** Shavings flung off a slash's edge, outward from its circle (Sprite Fusion's slash). */
function shavings(ps, R, s, n, colors, from = 0.3) {
  for (let i = 0; i < n; i++) {
    const [x, y] = onSwing(s, s.R, s.span * R.range(from, 1)), ox = x - s.cx, oy = y - s.cy, l = Math.hypot(ox, oy) || 1, sp = R.range(30, 100);
    ps.spawn(P.MOTE, x, y, (ox / l) * sp, Math.min(25, (oy / l) * sp) - 10, R.range(0.25, 0.55), R.pick(colors), 0.6);
  }
}

/** Stone shades for rocks, grit and dust from one body color (as Sprite Fusion's explosion does). */
function stone(c) {
  c = hex(c);
  return { light: mix(scale(c, 1.35), WHITE, 0.08), body: c, shade: scale(c, 0.64), dust: mix(scale(c, 1.2), rgb(150, 140, 150), 0.3), dark: scale(c, 0.42) };
}

const OUTLINE = hex("#1a1422");
/** A tumbling rock (a Bits CHUNK): a lit side, a shaded side, an outline, fading at the end of its life. */
function rock(p, b, st) {
  const r = 0.6 + b.s * 0.75, fade = Math.min(1, b.life / 0.5), lx = Math.cos(b.a) * r * 0.4, ly = Math.sin(b.a) * r * 0.4;
  p.shade(b.x - r - 1, b.y - r - 1, b.x + r + 1, b.y + r + 1, (x, y, out) => {
    const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx * 1.15, dy);
    if (d > r + 0.9) return;
    const lit = dx * lx + dy * ly;
    out.c = d > r ? OUTLINE : lit < -0.4 ? st.light : lit > 0.6 ? st.shade : st.body;
    out.a = fade;
  });
}

/**
 * Jagged cracks splitting the floor from x0: each runs out along the floor's edge and zig-zags down into its
 * face (y from 0 to about depth), with short forks. n cracks alternate sides (bias > 0 sends more forward).
 * Returns [{ pts, at (0..1 how far out it starts), fork }]. Built once from an Rng.
 */
function cracks(R, x0, n, reach, depth = 7, bias = 0.3) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const side = R.chance(0.5 + bias * 0.5) ? 1 : -1, L = reach * R.range(0.45, 1) * (i < 2 ? 1 : 0.7), pts = [[x0 + side * R.range(0, 1.5), 0]];
    let x = pts[0][0], y = 0;
    while (Math.abs(x - x0) < L && y < depth) {
      x += side * R.range(1.5, 3.5);
      y = Math.min(depth, Math.max(0, y + R.range(-0.6, 1.6) * (Math.abs(x - x0) > 3 ? 1 : 0.3)));
      pts.push([Math.round(x), Math.round(y)]);
      if (R.chance(0.18) && pts.length > 3 && y < depth - 2) {
        const f = [[Math.round(x), Math.round(y)]];
        let fx = x, fy = y;
        for (let j = R.int(1, 3); j > 0; j--) (fx += side * R.range(1, 3)), (fy += R.range(0.8, 2)), f.push([Math.round(fx), Math.round(Math.min(depth + 1, fy))]);
        out.push({ pts: f, at: Math.abs(x - x0) / reach, fork: true });
      }
    }
    out.push({ pts, at: 0, fork: false });
  }
  return out;
}

/**
 * An impact star (after Sprite Fusion's impact): tapered spikes [{ a, len, w }] around (x, y), drawn in three
 * passes (rim, body, core) with a hot disc in the middle. sc stretches, th thins.
 */
function star(p, x, y, spikes, sc, th, core, body, inner, rim) {
  for (const pass of [0, 1, 2])
    for (const s of spikes) {
      const c = Math.cos(s.a), sn = Math.sin(s.a), L = s.len * sc;
      for (let d = 0; d <= L; d += 0.5) {
        const hw0 = s.w * th * (1 - d / L) * Math.min(1, 0.5 + d / 3), hw = pass === 0 ? hw0 + 0.8 : pass === 1 ? hw0 : hw0 * 0.45;
        if (pass === 2 && d > L * 0.55) break;
        for (let o = -hw; o <= hw; o += 0.5) p.px(x + c * d - sn * o, y + sn * d + c * o, pass === 0 ? rim : pass === 1 ? (d < L * 0.35 ? inner : body) : core);
      }
    }
  const r = 2.4 * sc * Math.sqrt(th);
  p.circle(x, y, r + 0.8, inner);
  p.circle(x, y, r, core);
}

/** A thin arc flying out from (x, y): a sliver at radius r around angle a, arc radians long, dithered by k. */
function sliver(p, x, y, a, r, arc, c, k) {
  const n = Math.ceil(r * arc * 2.2);
  for (let j = 0; j <= n; j++) {
    const u = j / n - 0.5, th = a + u * arc, w = 1.4 * (1 - Math.abs(u) * 2);
    for (let o = -w * 0.5; o <= w * 0.5 + 0.01; o += 0.5) p.dot(x + Math.cos(th) * (r + o), y + Math.sin(th) * (r + o), c, k);
  }
}

/** Part of a polyline: the first `len` px of it. Calls fn(x0, y0, x1, y1, d) for each piece (d: distance along). */
function along(pts, len, fn) {
  let d = 0;
  for (let i = 1; i < pts.length && d < len; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], l = Math.hypot(x1 - x0, y1 - y0), f = Math.min(1, (len - d) / l);
    fn(x0, y0, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, d);
    d += l;
  }
}


exports.through = through;
exports.onSwing = onSwing;
exports.travel = travel;
exports.plane = plane;
exports.smear = smear;
exports.trace = trace;
exports.glowAlong = glowAlong;
exports.slash = slash;
exports.shavings = shavings;
exports.stone = stone;
exports.rock = rock;
exports.cracks = cracks;
exports.star = star;
exports.sliver = sliver;
exports.along = along;
exports.swing = swing;
exports.slashEnd = slashEnd;
  };
  __mods["fx/melee/dagger-flurry.js"] = function(exports, __req) {
// The crescent, trace, glint and spark recipe is adapted from Sprite Fusion's open-source slash
// (https://www.spritefusion.com/pixel-art-vfx/slash), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, fit, sparkle, clamp, ease, WHITE, READY  } = __req("core/index.js");
const {  swing, slash, slashEnd, shavings, sliver  } = __req("fx/melee/_lib.js");

const meta = {
  name: "Dagger flurry",
  desc: "A flurry of small quick crescents at every angle in front of the fighter, each with a flick of sparks, finished by one big cut that glints and bursts.",
  tags: ["melee", "slash", "dagger", "combo", "flurry", "fast", "combat", "directional", "one-shot"],
  size: [148, 104],
  origin: [36, 86],
  duration: 0.95,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#1b1630", "#3a2f63", "#6150a3", "#9480d8", "#c7b8f5", "#efe9ff", "#ffffff"],
    sparks: ["#ffffff", "#efe9ff", "#c7b8f5", "#9480d8"],
    seed: 12,
  },
};

const BASE = { ...READY, weapon: "dagger", offWeapon: "dagger", sa: -0.5, sb: -0.9, crouch: 4, lean: 3, ffx: 11, fbx: -9, fx: 12, fy: -24, bx: 9, by: -24 };
// a stab with one hand while the other comes back to the chest; the shoulders turn into each one
const near = (fx, fy, sa, o = {}) => ({ ...BASE, fx, fy, sa, bx: 4, by: -24, sb: -1, ...o });
const far = (bx, by, sb, o = {}) => ({ ...BASE, bx, by, sb, fx: 1, fy: -23, sa: -1, ...o });
const act = {
  target: { x: 60 },
  poses: [
    [-0.4, { ...BASE, x: -4 }],
    [-0.14, { ...BASE, x: -6, lean: -2, crouch: 5, fx: 2, fy: -22, sa: -1.2, bx: 2, by: -26, sb: -1.5 }],
    [-0.03, { ...BASE, x: -6, lean: -3, crouch: 6, fx: 1, fy: -21, sa: -1.2, bx: 1, by: -25, sb: -1.5 }],
    [0, near(20, -31, -0.5, { x: 2, ghost: 1 }), "snap"],
    [0.055, far(21, -23, 0.5, { x: 3 }), "snap"],
    [0.11, near(18, -36, -1, { x: 4 }), "snap"],
    [0.165, far(22, -31, -0.6, { x: 5 }), "snap"],
    [0.22, near(20, -22, 0.2, { x: 5 }), "snap"],
    [0.275, far(21, -27, 0.05, { x: 6 }), "snap"],
    [0.33, { ...BASE, x: 4, lean: -3, crouch: 5, fx: -1, fy: -33, sa: -2.5, bx: 2, by: -23, sb: -1.2 }, "snap"],
    [0.37, { ...BASE, x: 7, lean: 2, crouch: 4, fx: 16, fy: -34, sa: -1, bx: -7, by: -24, sb: -2.4, ghost: 1 }, "snap"],
    [0.43, { ...BASE, x: 9, lean: 6, crouch: 6, fx: 22, fy: -23, sa: 0.15, bx: -9, by: -24, sb: -2.6, ffx: 13, fbx: -10, toeB: true }, "snap"],
    [0.68, { ...BASE, x: 9, lean: 5, crouch: 5, fx: 21, fy: -22, sa: 0.2, bx: -8, by: -24, sb: -2.6 }],
    [1.05, { ...BASE, x: -4 }],
  ],
  hits: [
    { t: 0.05, stop: 0.015, push: 0.5, straw: 3, flash: 0.02 },
    { t: 0.105, stop: 0.015, push: -0.3, straw: 3, flash: 0.02 },
    { t: 0.16, stop: 0.015, push: 0.5, straw: 3, flash: 0.02 },
    { t: 0.215, stop: 0.015, push: -0.3, straw: 3, flash: 0.02 },
    { t: 0.27, stop: 0.015, push: 0.5, straw: 3, flash: 0.02 },
    { t: 0.325, stop: 0.015, push: -0.3, straw: 3, flash: 0.02 },
    { t: 0.42, stop: 0.12, shake: 0.18, amp: 2, push: 2.6, straw: 16 },
  ],
  dust: [{ t: 0.43, x: 20, n: 7, dir: 1 }, { t: 0, x: -6, n: 3, dir: -1 }],
};

const EVERY = 0.055;
// small cuts: where, how they're turned, which way they go
const CUTS = [
  [21, -27, -0.5, 1], [33, -16, 0.9, -1], [26, -38, 2.4, 1], [37, -30, -1.8, -1], [19, -17, 0.2, 1], [30, -24, 1.4, -1],
];

function create(o) {
  const C = fit(o.palette, 7), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
  const small = CUTS.map(([x, y, rot, dir], i) => swing({ cx: x, cy: y, R: Rg.range(12, 15), sy: Rg.range(0.55, 0.75), rot, a0: Rg.range(-2.8, -2.2), dir, span: Rg.range(2.3, 2.8), W: Rg.range(5.2, 6.4), t0: i * EVERY, sweep: 0.035, hold: 0.03, trail: 0.13, ramp: C }));
  // the finisher: one wide flat cut right across the front, left to right
  const big = swing({ cx: 24, cy: -26, R: 30, sy: 0.36, k: 0.24, rot: 0.12, a0: 3.0, dir: -1, span: 2.85, W: 11, t0: small.length * EVERY + 0.04, sweep: 0.055, hold: 0.06, trail: 0.24, ramp: C });
  const all = [...small, big], ends = all.map(slashEnd), done = all.map(() => false);
  const slivers = [-2.6, -1.5, -0.4, 0.7].map((a) => ({ a: a + Rg.range(-0.2, 0.2), r: Rg.range(4, 7), v: Rg.range(70, 110), arc: Rg.range(0.4, 0.7) }));
  let t = 0;
  return {
    update(dt) {
      t += dt;
      all.forEach((s, i) => {
        if (done[i] || t < s.t0 + s.sweep) return;
        done[i] = true;
        const e = ends[i], last = s === big;
        lights.add(e.x, e.y, last ? 56 : 26, C[3], last ? 0.6 : 0.4, last ? 0.4 : 0.14);
        if (last) lights.add(e.x, e.y, 16, WHITE, 0.7, 0.08);
        for (let k = 0; k < (last ? 12 : 3); k++) {
          const a = Math.atan2(e.dy, e.dx) + Rg.range(-0.5, 0.5), sp = Rg.range(100, last ? 340 : 220);
          ps.spawn(P.SPARK, e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, Rg.range(0.1, last ? 0.35 : 0.22));
        }
        shavings(ps, Rg, s, last ? 14 : 4, [C[4], C[5]]);
        if (last) for (let k = 0; k < 5; k++) ps.spawn(P.STAR, s.cx + Rg.range(-22, 22), s.cy + Rg.range(-14, 14), 0, -4, Rg.range(0.2, 0.45), Rg.chance(0.5) ? C[5] : WHITE, Rg.range(1, 2.2), Rg.range(0.05, 0.25));
      });
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      for (const s of all) slash(p, s, t);
      all.forEach((s, i) => {
        const e = ends[i], g = t - s.t0 - s.sweep * 0.6, last = s === big, life = last ? 0.24 : 0.12;
        if (g > 0 && g < life) sparkle(p, e.x, e.y, (last ? 10 : 4) * ease.outBack(Math.min(1, g / 0.04)) * (1 - g / life), C[5], C[3], last ? 0.6 : 0.35);
        // light rides each edge while it's moving
        const u = t - s.t0;
        if (u > 0 && u < s.sweep + 0.1) {
          const h = slashEnd({ ...s, span: s.span * ease.outExpo(clamp(u / s.sweep)) });
          p.glow(h.x, h.y, last ? 40 : 22, C[3], (last ? 0.5 : 0.35) * (1 - u / (s.sweep + 0.1)));
        }
      });
      // the finisher throws slivers off its end
      const q = t - big.t0 - big.sweep;
      if (q > 0.02 && q < 0.14) {
        const k = (q - 0.02) / 0.12, e = ends[ends.length - 1];
        for (const s of slivers) sliver(p, e.x, e.y, s.a + Math.atan2(e.dy, e.dx), s.r + s.v * (q - 0.02), s.arc * (1 - 0.4 * k), k < 0.4 ? C[6] : k < 0.7 ? C[5] : C[4], 1 - k);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
exports.act = act;
  };
  __mods["fx/melee/heavy-cleave.js"] = function(exports, __req) {
// The crescent and its cooling ramp are adapted from Sprite Fusion's open-source slash
// (https://www.spritefusion.com/pixel-art-vfx/slash), and the impact star, dust, grit and embers from his
// impact and explosion (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Bits, Lights, P, PF, B, Rng, fit, sparkle, band, clamp, smooth, ease, rand, TAU, WHITE, READY  } = __req("core/index.js");
const {  swing, onSwing, smear, trace, glowAlong, stone, rock, cracks, star, sliver, along  } = __req("fx/melee/_lib.js");

const meta = {
  name: "Heavy cleave",
  desc: "A glint over the head, then a thick ember arc accelerates over the top into the floor: a white slam, glowing cracks, dust rolling both ways, grit and rising embers.",
  tags: ["melee", "slash", "cleave", "axe", "heavy", "ground", "fire", "combat", "directional", "one-shot"],
  size: [208, 116],
  origin: [68, 96],
  duration: 1.9,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#2a0c10", "#5c1414", "#a3241a", "#e0481c", "#ff8a2a", "#ffc23d", "#fff0a0", "#ffffff"],
    stone: "#4a3f69",
    seed: 5,
  },
};

const REST_ = { ...READY, weapon: "greatsword", two: true, sa: -1, fx: 11, fy: -21 };
const OVER = { ...REST_, x: -4, crouch: 2, lean: -2, fx: 1, fy: -42, sa: -2.45, ffx: 8, fbx: -7 };
const FLOOR = { ...REST_, x: 0, crouch: 7, lean: 6, fx: 17, fy: -21, sa: 0.72, ffx: 11, fbx: -10, toeB: true };
const act = {
  target: { x: 66 },
  poses: [
    [-0.42, { ...REST_, x: -4 }],
    [-0.3, { ...REST_, x: -3, crouch: 4, fx: 13, fy: -29, sa: -1.3 }],
    [-0.12, { ...OVER, crouch: 4 }],
    [0.2, { ...OVER, crouch: 3 }],
    [0.27, { ...REST_, x: -1, y: -2, crouch: 0, lean: 2, fx: 11, fy: -42, sa: -1.45, ffx: 10, ghost: 1 }, "snap"],
    [0.31, { ...REST_, x: 0, y: -1, crouch: 3, lean: 4, fx: 18, fy: -33, sa: -0.45, ffx: 12, ghost: 1 }, "snap"],
    [0.335, FLOOR, "snap"],
    [0.85, { ...FLOOR, crouch: 6, lean: 5 }],
    [1.3, { ...REST_, x: -2, crouch: 4, lean: 2, fx: 15, fy: -23, sa: 0.1 }],
    [1.7, { ...REST_, x: -4 }],
  ],
  hits: [{ t: 0.335, stop: 0.2, shake: 0.34, amp: 3, push: 3.2, straw: 28, y: -8 }],
  dust: [{ t: 0.335, x: 18, n: 8, dir: 1 }, { t: 0.335, x: -12, n: 5, dir: -1 }],
};

const RAISE = 0.2; // the glint over the head
const SWING = 0.135; // the arc accelerates over the top
const HIT = RAISE + SWING;
const HOLD = 0.05, TRAIL = 0.22;
const head = (t) => ease.inQuad(clamp((t - RAISE) / SWING)); // fraction of the arc the edge has made
const passedAt = (f) => RAISE + SWING * Math.sqrt(clamp(f)); // when the edge passed fraction f

function create(o) {
  const C = fit(o.palette, 8), n = C.length, R = new Rng(o.seed), st = stone(o.stone), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[3]] }), bits = new Bits({ ground: floor }), lights = new Lights();
  // the arc: from behind the head, over the top, down into the floor in front
  const A = swing({ cx: 3, cy: -22, R: 37, sy: 0.88, rot: 0.32, a0: -2.45, dir: 1 });
  let U1 = 0;
  while (onSwing(A, A.R, U1)[1] < -0.5 && U1 < 4) U1 += 0.005;
  const E = { ...A, R: A.R * 0.76 }, W = 16, WE = 5;
  const [X] = onSwing(A, A.R - 2, U1), GLINT = onSwing(A, A.R - 3, 0);
  const lines = cracks(R, X, 4, 40, 7, 0.4);
  // the impact star: long spikes along the floor, shorter ones up
  const spikes = [-Math.PI, -2.7, -2.15, -1.62, -1.05, -0.45, 0].map((a, i) => ({ a: a + R.range(-0.08, 0.08), len: (i === 0 || i === 6 ? 20 : i === 3 ? 15 : 9) + R.range(0, 4), w: 1.6 + R.range(0, 0.6) }));
  const shards = [-2.5, -1.9, -1.2, -0.6].map((a) => ({ a: a + R.range(-0.15, 0.15), r: 8 + R.range(0, 3), v: R.range(80, 130), arc: R.range(0.35, 0.6) }));
  let t = 0, hit = false;

  const arc = (p, s, w0, lag, rim) => {
    const tt = t - lag, U = U1 * head(tt), T = U1 * smooth(HIT + HOLD, HIT + HOLD + TRAIL, tt);
    if (U < 0.02 || T >= U - 0.02) return;
    const gone = smooth(HIT + HOLD, HIT + HOLD + TRAIL, tt), shrink = 1 - 0.75 * gone;
    smear(p, s, T, U, w0, (u, r, out) => {
      const age = Math.max(0, tt - passedAt(u / U1)), v = (u - T) / (U - T);
      const w = w0 * shrink * Math.pow(Math.sin(Math.PI * Math.pow(v, 2.2)), 0.6);
      if (w < 0.4) return;
      const q = (s.R - r) / w;
      if (q < 0 || q > 1) return;
      const ci = rim && q < 0.22 && age < 0.12 ? 0 : Math.round(q * (n - 1) * 0.62 + age * 7 + Math.max(0, tt - HIT) * 10 - v * 0.8 + (rim ? 0.7 : 1.7));
      out.c = C[n - 1 - clamp(ci, 0, n - 1)];
      out.a = Math.min(1, v / 0.35) * (1.2 - gone);
    });
    if (rim) glowAlong(p, s, s.R - w0 * 0.4, T, U, 7 + w0 * 0.5, C[4], (u) => 0.26 * Math.exp(-Math.max(0, tt - passedAt(u / U1)) / 0.2) * ((u - T) / (U - T)));
  };

  return {
    update(dt) {
      t += dt;
      // heat gathers to the raised blade
      if (t < RAISE - 0.04 && R.chance(0.35)) {
        const a = R.range(0, TAU), D = R.range(14, 26), T = R.range(0.14, 0.2), v = (D * 3) / (Math.exp(3 * T) - 1);
        ps.spawn(P.STREAK, GLINT[0] + Math.cos(a) * D, GLINT[1] + Math.sin(a) * D, -Math.cos(a) * v, -Math.sin(a) * v, T, R.chance(0.5) ? C[5] : C[4]);
      }
      // embers shed off the edge as it comes over
      if (t > RAISE && t < HIT && R.chance(0.7)) {
        const u = U1 * head(t) * R.range(0.6, 1), [x, y] = onSwing(A, A.R - R.range(0, 6), u);
        ps.spawn(P.EMBER, x, y, R.range(-20, 20), R.range(-40, -10), R.range(0.5, 1.1), C[4], R.range(1, 2));
      }
      if (!hit && t >= HIT) {
        hit = true;
        lights.add(X, -6, 26, WHITE, 0.9, 0.1);
        lights.add(X, -12, 64, C[4], 0.5, 0.8);
        // sparks fan up off the floor, most of them forward
        for (let i = 0; i < 26; i++) {
          const a = -Math.PI / 2 + R.range(-1.2, 1.35), sp = R.range(140, 360);
          ps.spawn(P.SPARK, X, -1, Math.cos(a) * sp, Math.sin(a) * sp - 40, R.range(0.15, 0.5));
        }
        // dust rolls out both ways along the floor
        for (let i = 0; i < 20; i++) {
          const s = i % 2 ? -1 : 1;
          ps.spawn(P.SMOKE, X + s * R.range(0, 8), -R.range(2, 6), s * R.range(45, 135), -R.range(2, 12), R.range(1.0, 1.45), st.dust, R.range(5, 8.5), R.range(0, 0.07), PF.BIG);
        }
        for (let i = 0; i < 4; i++) ps.spawn(P.SMOKE, X + R.range(-4, 4), -R.range(3, 8), R.range(-15, 15), -R.range(40, 90), R.range(1.0, 1.45), st.dust, R.range(4, 6.5), R.range(0.02, 0.1), PF.BIG);
        for (let i = 0; i < 8; i++) ps.spawn(P.DUST, X + R.range(-4, 4), -R.range(1, 4), R.range(-60, 60), -R.range(8, 30), R.range(0.35, 0.7), st.dust, R.range(2, 3.5));
        // grit and a few stones thrown up, forward
        for (let i = 0; i < 44; i++) {
          const a = -Math.PI / 2 + R.range(-0.7, 1.0), sp = R.range(60, 230);
          ps.spawn(P.GRIT, X + R.range(-3, 3), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1.0, 1.5), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.35) ? 2 : 1);
        }
        for (let i = 0; i < 6; i++)
          bits.add({ kind: B.CHUNK, x: X + R.range(-3, 3), y: -2, vx: R.range(-50, 110), vy: -R.range(120, 260), g: 1, drag: 0.4, bounce: 0.3, life: R.range(1.15, 1.5), a: R.range(0, TAU), va: R.range(-14, 14), s: R.int(1, 2) });
        // embers lift off the cut
        for (let i = 0; i < 16; i++) ps.spawn(P.EMBER, X + R.range(-8, 8), -R.range(1, 6), R.range(-50, 60), -R.range(30, 110), R.range(0.7, 1.5), C[4], R.range(1, 2));
      }
      // the cracks breathe embers while they're hot
      if (hit && t < HIT + 0.6 && R.chance(0.12)) {
        const c = R.pick(lines), pt = R.pick(c.pts);
        ps.spawn(P.EMBER, pt[0], pt[1] - 1, R.range(-12, 12), -R.range(20, 50), R.range(0.5, 0.9), C[4], 1);
      }
      bits.update(dt);
      for (const b of bits.list)
        if (b.rest && !b.dusted) {
          b.dusted = true;
          for (let i = 0; i < 2; i++) ps.spawn(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, R.sign() * R.range(8, 30), -R.range(2, 12), R.range(0.3, 0.6), st.dust, R.range(1.3, 2.4));
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const q = t - HIT;
      if (q >= 0) {
        // the floor under the blade: white hot, cooling through the ramp to soot
        const fade = 1 - smooth(1.0, 1.5, q);
        for (let y = 0; y <= 2; y++)
          for (let x = -9; x <= 9; x++) {
            const d = Math.hypot((x + 0.5) / 9, (y + 0.5) / 3.5);
            if (d > 1) continue;
            const T = Math.pow(clamp(1 - q / 0.8), 1.4) * (1.2 - d) - rand(x, y, 3) * 0.3;
            if (T > 0.08) p.dot(X + x, y, C[clamp(Math.round(T * 9), 1, 7)], fade);
            else p.dot(X + x, y, d < 0.5 ? st.dark : st.shade, (d < 0.9 - rand(x, y, 9) * 0.3 ? 1 : 1 - d) * fade);
          }
        // the shock runs out along the floor: the far half behind the fighter
        const k = q / 0.45;
        if (k < 1) band(p, X, 0.5, 6 + 46 * ease.outCubic(k), 0.16, Math.max(1, 3 * (1 - k)), 1.15 - k, [st.body, st.light, C[4], C[6]], (g) => Math.sin(g) < 0);
      }
      ps.draw(p, "back");
    },
    draw(p) {
      const q = t - HIT;
      // the glint over the head: the raised blade catching the light
      if (t < RAISE + 0.03) {
        const g = ease.outBack(clamp(t / 0.1)) * (1 + 0.15 * Math.sin(t * 60)) * (t > RAISE ? 1 - (t - RAISE) / 0.03 : 1);
        sparkle(p, GLINT[0], GLINT[1], 1 + 7 * g, C[6], C[4], 0.5);
        p.glow(GLINT[0], GLINT[1], 22, C[4], 0.3 * g);
      }
      if (q >= 0) {
        // cracks race out from the cut and split down into the floor: white hot, cooling down the ramp to dark
        const heat = Math.pow(clamp(1 - q / 1.2), 1.2), fade = 1 - smooth(1.15, 1.5, q);
        for (const c of lines) {
          const reach = 40 * ease.outCubic(clamp((q - c.at * 0.1) / 0.13)) * (c.fork ? 0.3 : 1);
          if (reach <= 0) continue;
          along(c.pts, reach, (x0, y0, x1, y1, d) => {
            const h = heat * (1 - d / 46) - (c.fork ? 0.12 : 0), col = h > 0.72 ? WHITE : h > 0.08 ? C[clamp(Math.round(h * 8), 1, 6)] : st.dark;
            if (y1 > 0.5) p.line(x0 + 1, y0, x1 + 1, y1, st.dark, fade);
            p.line(x0, y0, x1, y1, col, fade);
            if (h > 0.25 && (d | 0) % 6 < 2) p.glow(x1, y1, 6, C[4], 0.2 * h * fade);
          });
        }
        if (heat > 0) p.glow(X, -2, 34, C[4], 0.32 * heat * fade);
        // the near half of the shock ring
        const k = q / 0.45;
        if (k < 1) band(p, X, 0.5, 6 + 46 * ease.outCubic(k), 0.16, Math.max(1, 3 * (1 - k)), 1.15 - k, [st.body, st.light, C[4], C[6]], (g) => Math.sin(g) >= 0);
      }
      // the arc and its echo, then a dotted trace of embers where it has been
      arc(p, E, WE, 0.02, false);
      arc(p, A, W, 0, true);
      const tail = U1 * smooth(HIT + HOLD, HIT + HOLD + TRAIL, t), th = 0.8 * (1 - clamp((t - HIT - HOLD) / (TRAIL + 0.25)));
      if (tail > 0.02 && th > 0) trace(p, A, A.R - 0.5, 0, tail, C[3], (u) => th * (0.4 + 0.6 * u / U1));
      if (t > RAISE && t < HIT + 0.05) {
        const [x, y] = onSwing(A, A.R - 5, U1 * head(t));
        p.glow(x, y, 40, C[4], 0.5);
      }
      // the white slam: an impact star flat on the floor, then slivers flying off and a hot pool
      if (q >= 0 && q < 0.035) star(p, X, -1, spikes, 1, 1, WHITE, C[6], C[7], C[5]);
      else if (q >= 0.035 && q < 0.07) star(p, X, -1, spikes, 1.25, 0.55, C[7], C[6], C[6], C[4]);
      if (q >= 0.05 && q < 0.16) {
        const k = (q - 0.05) / 0.11;
        for (const s of shards) sliver(p, X, -1, s.a, s.r + s.v * (q - 0.05), s.arc * (1 - 0.4 * k), k < 0.4 ? C[6] : k < 0.7 ? C[5] : C[4], 1 - k);
      }
      if (q >= 0 && q < 0.2) {
        const pop = Math.exp(-q / 0.05);
        p.glow(X, -6, 30, C[5], 0.8 * pop);
        p.glow(X, -2, 10, WHITE, 0.7 * pop);
      }
      for (const b of bits.list) rock(p, b, st);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
exports.act = act;
  };
  __mods["fx/melee/scythe-reap.js"] = function(exports, __req) {
// The crescent and trace recipe is adapted from Sprite Fusion's open-source slash, and the vapour from his
// ice and poison (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, PF, Rng, fit, sparkle, clamp, smooth, ease, rand, WHITE, READY  } = __req("core/index.js");
const {  swing, onSwing, travel, smear, glowAlong  } = __req("fx/melee/_lib.js");

const meta = {
  name: "Scythe reap",
  desc: "A slow, huge dark crescent reaps round the front with a pale ghostly edge; it hangs, then tears away from the tail into curling wisps and cold vapour.",
  tags: ["melee", "scythe", "reap", "dark", "ghost", "death", "slash", "combat", "one-shot"],
  size: [184, 116],
  origin: [84, 98],
  duration: 2.1,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#07040c", "#140a22", "#24113a", "#3b1d58", "#5a3a82", "#7fd6c0", "#d8fff2", "#ffffff"],
    seed: 13,
  },
};

// the butt rests on the floor in one hand; both hands take it out to the right, and he turns with it round the front
const REST_ = { ...READY, weapon: "scythe", x: 2, sa: -1.5, fx: 11, fy: -22, bx: 7, by: -16 };
const OUT_ = { ...REST_, two: true, crouch: 4, lean: 4, fx: 17, fy: -27, sa: -0.45, ffx: 11, fbx: -8 };
const END = { ...REST_, two: true, x: 0, yaw: 3.14, crouch: 6, lean: 4, fx: 15, fy: -24, sa: 0.3, ffx: 11, fbx: -10, toeB: true };
const act = {
  target: { x: 66 },
  poses: [
    [-0.56, REST_],
    [-0.26, OUT_],
    [0.08, { ...OUT_, crouch: 5 }],
    [0.2, { ...OUT_, yaw: 0.8, crouch: 5, lean: 3, fx: 16, fy: -23, sa: 0.1, ghost: 1 }],
    [0.3, { ...OUT_, x: 1, yaw: 1.9, crouch: 6, lean: 3, fx: 15, fy: -23, sa: 0.2, ghost: 1 }],
    [0.42, END],
    [0.92, { ...END, crouch: 5 }],
    [1.3, { ...REST_, x: 1, yaw: 1.4, crouch: 4 }],
    [1.7, REST_],
  ],
  hits: [{ t: 0.14, stop: 0.12, shake: 0.16, amp: 2, push: 2.4, straw: 20, skin: "shadow" }],
  dust: [{ t: 0.3, x: 2, n: 6 }],
};

const WIND = 0.08, SWEEP = 0.34, HANG = 0.14, TEAR = 0.55;
const T0 = WIND, T1 = WIND + SWEEP, T2 = T1 + HANG, T3 = T2 + TEAR;
const head = (t) => ease.inOutSine(clamp((t - T0) / SWEEP));

function create(o) {
  const C = fit(o.palette, 8), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, haze: C[5] }), lights = new Lights();
  // a wide reap from out on the right, round the front of the fighter, to the left
  const A = swing({ cx: 8, cy: -33, R: 52, sy: 0.6, k: 0.1, rot: 0.08, a0: -0.5, dir: 1, span: 3.5 });
  const W = 21;
  const wisps = [];
  let t = 0, lastTear = 0;
  // how far the tear has eaten in from the tail (0..1 of the span), ragged by a per-pixel threshold
  const tear = () => smooth(T2, T3, t);
  const addWisp = (x, y, far) => wisps.push({ x, y, vx: Rg.range(-12, 12), vy: -Rg.range(8, 26), life: Rg.range(0.5, 0.9), max: 0, seed: Rg.range(0, 100), pts: [], far });
  return {
    update(dt) {
      t += dt;
      // the cold gathers on the blade before it moves
      if (t < WIND && Rg.chance(0.5)) {
        const [x, y] = onSwing(A, A.R - 4, 0);
        ps.spawn(P.VAPOUR, x + Rg.range(-14, 14), y + Rg.range(-8, 8), Rg.range(-10, 10), Rg.range(-6, 6), Rg.range(0.3, 0.5), C[5], Rg.range(1.5, 2.5));
      }
      // the edge sheds a little vapour as it goes
      if (t > T0 && t < T1 && Rg.chance(0.5)) {
        const tr = travel(A, A.span * head(t) * Rg.range(0.75, 1));
        ps.spawn(P.VAPOUR, tr.x, tr.y, tr.dx * 20, -Rg.range(4, 14), Rg.range(0.5, 0.9), C[6], Rg.range(2, 3.5), 0, Math.sin(tr.a) < 0 ? PF.BACK : 0);
      }
      // tearing away: wisps peel off where the crescent is coming apart
      const k = tear();
      for (let u = lastTear; u < k * 1.15; u += 0.022) {
        const uu = Math.min(1, u) * A.span, tr = travel({ ...A, R: A.R - Rg.range(0, 8) }, uu), far = Math.sin(tr.a) < 0;
        addWisp(tr.x, tr.y, far);
        if (Rg.chance(0.5)) ps.spawn(P.VAPOUR, tr.x, tr.y, Rg.range(-10, 10), -Rg.range(6, 18), Rg.range(0.55, 0.85), Rg.chance(0.5) ? C[5] : C[4], Rg.range(2.5, 4.5), 0, far ? PF.BACK : 0);
        if (Rg.chance(0.2)) ps.spawn(P.STAR, tr.x + Rg.range(-3, 3), tr.y + Rg.range(-3, 3), 0, -6, Rg.range(0.25, 0.5), Rg.chance(0.5) ? C[6] : WHITE, Rg.range(0.6, 1.6), 0, far ? PF.BACK : 0);
      }
      lastTear = Math.max(lastTear, k * 1.15);
      // wisps rise, sway and curl, leaving a fading thread behind them
      for (let i = wisps.length - 1; i >= 0; i--) {
        const w = wisps[i];
        w.max += dt;
        if (w.max > w.life) {
          wisps.splice(i, 1);
          continue;
        }
        w.vy -= 30 * dt;
        w.vx += Math.sin(w.max * 9 + w.seed) * 120 * dt;
        w.vx -= w.vx * 2 * dt;
        w.vy -= w.vy * 1.2 * dt;
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        w.pts.push([w.x, w.y]);
        if (w.pts.length > 14) w.pts.shift();
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      this.blade(p, -1);
      ps.draw(p, "back");
      this.threads(p, true);
    },
    draw(p) {
      this.blade(p, 1);
      // the blade's point glints cold as it sets off and where it stops
      if (t < WIND + 0.05) {
        const [x, y] = onSwing(A, A.R - 3, 0);
        sparkle(p, x, y, 6 * Math.min(1, t / 0.04) * (1 - smooth(WIND - 0.02, WIND + 0.05, t)), C[6], C[5], 0.45);
      }
      const g = t - T1 + 0.06;
      if (g > 0 && g < 0.3) {
        const [x, y] = onSwing(A, A.R - 3, A.span);
        sparkle(p, x, y, 9 * ease.outBack(Math.min(1, g / 0.06)) * (1 - g / 0.3), C[6], C[5], 0.55);
      }
      ps.draw(p, "front");
      this.threads(p, false);
      lights.draw(p);
    },
    blade(p, half) {
      const U = A.span * head(t), k = tear();
      if (U < 0.02 || k >= 1) return;
      const ramp = half < 0 ? [C[0], C[0], C[1], C[2], C[3], C[4], C[5], C[6]] : C;
      smear(p, A, 0, U, W, (u, r, out, a) => {
        const v = u / U, w = W * Math.pow(Math.sin(Math.PI * Math.pow(v, 1.7)), 0.55);
        if (w < 0.5) return;
        const q = (A.R - r) / w;
        if (q < 0 || q > 1) return;
        // torn away from the tail: a ragged front of per-pixel thresholds
        const n = rand(Math.floor(u * 40), Math.floor(r), 7);
        if (k > 0 && (u / A.span) < k * 1.2 - n * 0.2) return;
        // a pale ghostly rim, a dark body that deepens inward, a faint lit seam
        const ci = q < 0.08 ? 7 : q < 0.16 ? 6 : q < 0.25 ? 5 : q < 0.4 ? 4 : q < 0.62 ? 3 : 2;
        out.c = ramp[t > T1 && q < 0.2 ? ci - 1 : ci];
        out.a = Math.min(1, v / 0.25);
      }, half);
      glowAlong(p, A, A.R - 2, Math.max(0, k * 1.2 * A.span - 0.3), U, 14, C[5], (u) => 0.3 * (u / U), half, 0.25);
    },
    threads(p, back) {
      for (const w of wisps) {
        if (w.far !== back) continue;
        const life = 1 - w.max / w.life;
        for (let i = 1; i < w.pts.length; i++) {
          const f = i / w.pts.length;
          p.line(w.pts[i - 1][0], w.pts[i - 1][1], w.pts[i][0], w.pts[i][1], f > 0.75 ? C[6] : f > 0.4 ? C[5] : C[3], life * (0.3 + 0.7 * f));
        }
        if (life > 0.5) p.glow(w.x, w.y, 5, C[5], 0.25 * life);
      }
    },
  };
}

exports.create = create;
exports.meta = meta;
exports.act = act;
  };
  __mods["fx/melee/hammer-smash.js"] = function(exports, __req) {
// The rocks, grit, rolling dust and floor ring are adapted from Sprite Fusion's open-source explosion, and the
// dome from his ice nova (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Bits, Lights, P, PF, B, Rng, fit, band, clamp, smooth, ease, rand, hex, TAU, WHITE, READY  } = __req("core/index.js");
const {  swing, onSwing, smear, stone, rock, cracks, along  } = __req("fx/melee/_lib.js");

const meta = {
  name: "Hammer smash",
  desc: "A hammer drops in front in a wedge of motion: a white slam with rays, a dome of force, a dent with cracks, rocks thrown up that bounce and settle, and dust.",
  tags: ["melee", "smash", "hammer", "heavy", "ground", "shockwave", "debris", "combat", "directional", "one-shot"],
  size: [208, 112],
  origin: [80, 92],
  duration: 2.0,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#141834", "#242c5c", "#38479a", "#5a72d0", "#8fa8f0", "#c4d4ff", "#eef3ff", "#ffffff"],
    stone: "#4a3f69",
    seed: 9,
  },
};

// both hands low on the shaft, the head resting on the floor in front; it comes up, over and down
const REST_ = { ...READY, weapon: "hammer", two: true, sa: 0.62, fx: 11, fy: -21, crouch: 3 };
const TOP = { ...REST_, x: -3, crouch: 0, lean: -3, fx: 3, fy: -41, sa: -2.1, ffx: 8, ffy: -8, fbx: -5, toeB: true };
const SLAM = { ...REST_, x: -1, crouch: 7, lean: 6, fx: 14, fy: -19, sa: 0.62, ffx: 11, fbx: -10 };
const act = {
  target: { x: 66 },
  poses: [
    [-0.72, { ...REST_, x: -3 }],
    [-0.44, { ...REST_, x: -3, crouch: 5, lean: -1, fx: 16, fy: -28, sa: -0.9 }],
    [-0.2, TOP],
    [-0.03, { ...TOP, y: -2 }],
    [0.06, { ...REST_, x: 0, y: -3, crouch: -1, lean: 2, fx: 13, fy: -41, sa: -1.2, ffx: 11, ffy: -8, ghost: 1 }, "snap"],
    [0.11, { ...REST_, x: 0, y: -1, crouch: 3, lean: 5, fx: 19, fy: -30, sa: -0.15, ffx: 13, ghost: 1 }, "snap"],
    [0.15, SLAM, "snap"],
    [0.62, { ...SLAM, crouch: 6, lean: 5 }],
    [1.02, { ...REST_, x: -2, crouch: 5, lean: 2, fx: 14, fy: -24, sa: 0.3 }],
    [1.4, { ...REST_, x: -3 }],
  ],
  hits: [{ t: 0.15, stop: 0.2, shake: 0.34, amp: 3, push: 3, straw: 26, y: -8 }],
  dust: [{ t: 0.15, x: 10, n: 8 }, { t: 0.15, x: -12, n: 5, dir: -1 }],
};

const SOOT = hex("#0d0a12"), HOT = ["#fff3a6", "#ffc23d", "#ff8a2a", "#c9281f"].map(hex);
const DROP = 0.15; // the hammer comes over and down, gathering speed
const head = (t) => {
  const x = clamp((t + 0.03) / (DROP + 0.03));
  return 0.28 * x + 0.72 * x * x;
};

function create(o) {
  const C = fit(o.palette, 8), n = C.length, R = new Rng(o.seed), st = stone(o.stone), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor }), bits = new Bits({ ground: floor }), chips = new Bits({ ground: floor }), lights = new Lights();
  // the hammer head's path: round the shoulders, from overhead down to the floor in front
  const A = swing({ cx: 5, cy: -25, R: 32, sy: 1, rot: 0, a0: -2.25, dir: 1 });
  let U1 = 0;
  while (onSwing(A, A.R, U1)[1] < -0.5 && U1 < 4) U1 += 0.005;
  const HW = 13, [X] = onSwing(A, A.R - HW / 2, U1);
  const lines = cracks(R, X, 5, 24, 6, 0);
  const rays = [-0.95, -0.6, -0.3, -0.05, 0.22, 0.5, 0.85].map((d, i) => ({ a: -Math.PI / 2 + d + R.range(-0.06, 0.06), L: (i === 3 ? 34 : i === 2 || i === 4 ? 26 : i === 1 || i === 5 ? 18 : 12) * R.range(0.9, 1.1) }));
  let t = 0, hit = false;

  // the smear: the hammer head's path as a comet, a hard white leading face, tapering to a hair behind it,
  // cooling along the taper (edges first), with speed lines trailing along the arc
  const Rm = A.R - HW / 2;
  const wedge = (p) => {
    const h = head(t), U = U1 * h, after = smooth(DROP, DROP + 0.07, t), lagU = Math.max(0, U - (0.3 + 1.05 * h)), T = lagU + (U - lagU) * after * 0.8;
    if (U - T < 0.03 || after >= 1) return;
    const len = (U - T) * Rm;
    smear(p, A, T, U, HW + 1, (u, r, out) => {
      const lead = (U - u) * Rm, f = lead / len, w = HW * (lead < 3 ? 1 : Math.pow(1 - (lead - 3) / Math.max(1, len - 3), 0.85)) * (1 - after * 0.5);
      const off = (r - Rm) / (w / 2 + 0.01);
      if (w < 0.6 || Math.abs(off) > 1) return;
      let ci = lead < 2 ? 0 : Math.round(1 + f * 3.4 + Math.abs(off) * 1.4 - (off > 0.55 ? 1 : 0) + after * 3);
      if (ci > n - 3) return;
      out.c = C[n - 1 - Math.max(0, ci)];
    });
    // speed lines trail the head along the arc, dotted out at their ends
    if (after < 0.6)
      for (const [dr, l0, L] of [[-HW / 2 - 2, 3, 26], [-HW / 2 - 5, 9, 16], [HW / 2 + 2, 2, 30], [HW / 2 + 5, 8, 18], [-1, len + 2, 14], [3, len + 4, 9]]) {
        const r = Rm + dr;
        for (let d = l0; d < l0 + L * (1 - after); d += 0.5) {
          const u = U - d / r, k = (d - l0) / L;
          if (u < 0) break;
          p.dot(...onSwing(A, r, u), k < 0.25 ? C[6] : k < 0.6 ? C[5] : C[4], (1 - k) * (1 - after));
        }
      }
    const [hx, hy] = onSwing(A, Rm, U);
    p.glow(hx, hy, 34, C[4], 0.5 * (1 - smooth(DROP - 0.03, DROP, t)));
  };

  return {
    update(dt) {
      t += dt;
      if (!hit && t >= DROP) {
        hit = true;
        lights.add(X, -5, 16, WHITE, 0.35, 0.08);
        lights.add(X, -10, 64, C[4], 0.42, 0.6);
        // rocks thrown up out of the dent: they tumble, land, bounce and settle
        for (let i = 0; i < 15; i++) {
          const s = R.sign();
          bits.add({ kind: B.CHUNK, x: X + s * R.range(0, 5), y: -2, vx: s * R.range(20, 105), vy: -R.range(110, 300), g: 1, drag: 0.35, bounce: 0.38, life: R.range(1.25, 1.65), a: R.range(0, TAU), va: R.range(-16, 16), s: R.pick([1, 1, 2, 2, 3]) });
        }
        // hot chips struck off the stone: they bounce, settle and cool through the ramp
        for (let i = 0; i < 11; i++) {
          const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(90, 230);
          chips.add({ kind: B.SHARD, x: X + R.range(-4, 4), y: -2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.9, drag: 0.5, bounce: 0.35, life: R.range(0.9, 1.5), s: 1 });
        }
        for (let i = 0; i < 40; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(50, 210);
          ps.spawn(P.GRIT, X + R.range(-4, 4), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.9, 1.5), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.4) ? 2 : 1);
        }
        // force motes skid out along the floor, sparks off the stone
        for (let i = 0; i < 14; i++) {
          const s = i % 2 ? -1 : 1, sp = R.range(120, 260);
          ps.spawn(P.MOTE, X + s * 6, -R.range(1, 4), s * sp, -R.range(0, 30), R.range(0.18, 0.34), R.chance(0.5) ? C[6] : C[5], 0.8, R.range(0.02, 0.05));
        }
        for (let i = 0; i < 24; i++) {
          const a = -Math.PI / 2 + R.range(-1.4, 1.4), sp = R.range(150, 380);
          ps.spawn(P.SPARK, X + Math.cos(a) * 6, -2 + Math.sin(a) * 4, Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.12, 0.42), 0, 1, R.range(0.035, 0.08));
        }
        // dust rolls out both ways along the floor, and a puff lifts off the dent
        for (let i = 0; i < 20; i++) {
          const s = i % 2 ? -1 : 1;
          ps.spawn(P.SMOKE, X + s * R.range(2, 10), -R.range(2, 7), s * R.range(40, 125), -R.range(2, 14), R.range(0.95, 1.5), st.dust, R.range(6, 9), R.range(0.02, 0.08), PF.BIG);
        }
        for (let i = 0; i < 7; i++) ps.spawn(P.SMOKE, X + R.range(-6, 6), -R.range(3, 9), R.range(-20, 20), -R.range(30, 80), R.range(1.0, 1.4), st.dust, R.range(5, 7.5), R.range(0.04, 0.14), PF.BIG);
        for (let i = 0; i < 8; i++) ps.spawn(P.DUST, X + R.range(-6, 6), -R.range(1, 4), R.range(-70, 70), -R.range(8, 30), R.range(0.35, 0.7), st.dust, R.range(2, 3.5));
      }
      bits.update(dt);
      chips.update(dt);
      // settled rocks catch the light now and then
      if (hit && t > DROP + 0.4 && t < DROP + 1.2 && R.chance(0.08)) {
        const b = R.pick(bits.list);
        if (b && b.rest) ps.spawn(P.STAR, b.x + R.range(-1, 1), b.y - 1.5 - b.s, 0, -2, R.range(0.25, 0.45), R.chance(0.5) ? HOT[0] : WHITE, R.range(0.6, 1.6));
      }
      // rocks that land kick up a little dust
      for (const b of bits.list)
        if (b.rest && !b.dusted) {
          b.dusted = true;
          for (let i = 0; i < 3; i++) ps.spawn(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, R.sign() * R.range(8, 35), -R.range(2, 14), R.range(0.3, 0.6), st.dust, R.range(1.3, 2.6));
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const q = t - DROP;
      if (q >= 0) {
        // the dent: the floor's top knocked down into a shallow pit, its surface lit at the bottom, chipped lips
        const fade = 1 - smooth(1.3, 1.7, q);
        for (let x = -11; x <= 11; x++) {
          const u = x / 10, d = Math.abs(x) > 10 ? 0 : Math.round(3.2 * (1 - u * u) + (rand(x, 4) - 0.5) * 0.8);
          for (let y = 0; y < d; y++) p.dot(X + x, y, y === 0 ? SOOT : st.dark, fade);
          if (d > 0) p.dot(X + x, d, Math.abs(x) < 7 ? st.light : st.body, fade);
          if (Math.abs(x) >= 8) p.dot(X + x, -1, Math.abs(x) >= 10 ? st.body : st.light, fade);
          if (Math.abs(x) === 9 && rand(x, 7) < 0.7) p.dot(X + x, -2, st.body, fade);
        }
        // the floor ring's far half
        const k = q / 0.5;
        if (k < 1) band(p, X, 0.5, 6 + 50 * ease.outCubic(k), 0.16, Math.max(1, 2 * (1 - k)), 1.15 - k, [st.body, C[3], C[5], C[7]], (g) => Math.sin(g) < 0);
      }
      ps.draw(p, "back");
    },
    draw(p) {
      const q = t - DROP;
      wedge(p);
      if (q >= 0) {
        // cracks split out of the dent: a white flash, then dark lines that fade with the dent
        const fade = 1 - smooth(1.3, 1.7, q);
        for (const c of lines) {
          const reach = 30 * ease.outCubic(clamp((q - c.at * 0.06) / 0.08)) * (c.fork ? 0.3 : 1);
          if (reach > 0)
            along(c.pts, reach, (x0, y0, x1, y1) => {
              if (q >= 0.12) p.line(x0, y0 + 3, x1, y1 + 3, st.shade, fade);
              p.line(x0, y0 + 2, x1, y1 + 2, q < 0.05 ? WHITE : q < 0.12 ? C[5] : SOOT, fade);
            });
        }
        // the near half of the floor ring
        const k = q / 0.5;
        if (k < 1) band(p, X, 0.5, 6 + 50 * ease.outCubic(k), 0.16, Math.max(1, 2 * (1 - k)), 1.15 - k, [st.body, C[3], C[5], C[7]], (g) => Math.sin(g) >= 0);
        // the dome of force swells off the floor, thins to dots and fades
        const d = (q - 0.045) / 0.4;
        if (d >= 0 && d < 1) {
          // solid steps through the shell (white rim, two blues inside); it dissolves as a whole at the end
          const r = 12 + 30 * ease.outCubic(d), th = Math.max(1, 3.6 * Math.pow(1 - d, 0.8)), a = d < 0.6 ? 1 : (1 - d) / 0.4;
          p.shade(X - r - 1, -r - 1, X + r + 1, 0, (x, y, out) => {
            const e = r - Math.hypot(x - X, y);
            if (e < 0 || e > th || y > -0.5) return;
            const v = e / th;
            out.c = d < 0.1 ? (v < 0.6 ? WHITE : C[6]) : v < 0.34 ? (d < 0.45 ? WHITE : C[6]) : v < 0.67 ? C[5] : C[4];
            out.a = a;
          });
          for (let i = 0; i < 7; i++) {
            const g = -Math.PI * (0.08 + (i / 6) * 0.84);
            p.glow(X + Math.cos(g) * r, Math.sin(g) * r, 14, C[4], 0.36 * (1 - d));
          }
        }
        // rays of light shoot up out of the slam
        if (q < 0.2)
          for (const ry of rays) {
            const d1 = ry.L * ease.outCubic(Math.min(1, q / 0.05)), d0 = ry.L * smooth(0.04, 0.2, q), ca = Math.cos(ry.a), sa = Math.sin(ry.a);
            if (d1 - d0 < 1) continue;
            p.line(X + ca * (2 + d0), -1 + sa * (2 + d0), X + ca * d1, -1 + sa * d1, (u) => (u < 0.5 ? WHITE : u < 0.8 ? C[6] : C[5]));
            p.glowLine(X + ca * d0, -1 + sa * d0, X + ca * d1, -1 + sa * d1, 4, C[5], 0.18 * (1 - q / 0.2));
          }
        // the white slam: a flat flash on the floor for two frames
        if (q < 0.07) {
          const hot = q < 0.035, rx = hot ? 16 : 12, ry = hot ? 3 : 2;
          p.ellipse(X, 0, rx + 2, ry + 1, hot ? C[6] : C[5]);
          p.ellipse(X, 0, rx, ry, hot ? WHITE : C[7]);
        }
        if (q < 0.2) {
          const pop = Math.exp(-q / 0.05);
          p.glow(X, -5, 26, C[5], 0.3 * pop);
        }
        // the struck stone stays warm for a moment
        p.glow(X, -1, 16, HOT[2], 0.28 * Math.exp(-q / 0.35));
      }
      for (const b of bits.list) rock(p, b, st);
      for (const b of chips.list) {
        const k = b.life / b.max, c = k > 0.7 ? HOT[0] : k > 0.45 ? HOT[1] : k > 0.25 ? HOT[2] : HOT[3];
        p.dot(b.x, b.y, c, Math.min(1, k * 4));
        if (!b.rest) p.dot(b.x - b.vx * 0.012, b.y - b.vy * 0.012, HOT[3], Math.min(1, k * 4));
        p.glow(b.x, b.y, 4, c, 0.35 * k);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
exports.act = act;
  };
  __mods["fx/melee/thrust.js"] = function(exports, __req) {
// The speed lines are adapted from Sprite Fusion's open-source dash and the ray star from his sparkle
// (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, fit, sparkle, clamp, smooth, ease, TAU, WHITE, READY  } = __req("core/index.js");

const meta = {
  name: "Thrust",
  desc: "A piercing stab: a bundle of streaks shoots out from the hand to a point, a long four-point star flares at the tip with a pierce ring, sparks and speed lines.",
  tags: ["melee", "thrust", "stab", "spear", "rapier", "pierce", "combat", "directional", "one-shot"],
  size: [196, 76],
  origin: [34, 62],
  duration: 0.75,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#2a1608", "#6b3c10", "#b8701a", "#f0b42e", "#ffe27a", "#fff6cf", "#ffffff"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    reach: 66,
    seed: 4,
  },
};

const STANCE = { ...READY, weapon: "sword", x: -14, fx: 12, fy: -21, sa: -0.3 };
// the hand comes back to the hip with the point forward, then the whole arm goes out along the blade
const BACK = { ...STANCE, crouch: 5, lean: -3, fx: -3, fy: -19, sa: -0.05, bx: 8, by: -30, armsFront: true, ffx: 10, fbx: -8 };
const LUNGE = { ...STANCE, crouch: 6, lean: 6, fx: 23, fy: -20, sa: 0, bx: -8, by: -24, ffx: 15, fbx: -11, toeB: true };
const act = {
  target: { x: 80 },
  poses: [
    [-0.46, STANCE],
    [-0.24, BACK],
    [-0.05, { ...BACK, crouch: 6, fx: -5 }],
    [0, { ...LUNGE, ghost: 1 }, "snap"],
    [0.07, LUNGE, "snap"],
    [0.3, { ...LUNGE, crouch: 5, lean: 5 }],
    [0.7, STANCE],
  ],
  hits: [{ t: 0.07, stop: 0.12, shake: 0.14, amp: 2, push: 2.8, straw: 16, y: -26 }],
  dust: [{ t: 0, x: -24, n: 6, dir: -1 }, { t: 0.07, x: 1, n: 6, dir: 1 }],
};

const OUT = 0.07; // the point arrives
const HOLD = 0.06, PULL = 0.2;

// a long four-point star: the forward and back arms long, up and down shorter, thick at the heart
function longStar(p, x, y, L, k, C) {
  if (L < 1) return;
  const arms = [[1, 0, L], [-1, 0, L * 0.7], [0, -1, L * 0.42], [0, 1, L * 0.42]];
  for (const [dx, dy, len] of arms)
    for (let d = 1; d <= len; d += 0.5) {
      const u = d / len, c = u < 0.3 ? WHITE : u < 0.65 ? C[5] : C[4];
      p.dot(x + dx * d, y + dy * d, c, u < 0.7 ? 1 : 1 - (u - 0.7) / 0.35);
      if (u < 0.25 && len > 6) (p.dot(x + dx * d - dy, y + dy * d + dx, C[5]), p.dot(x + dx * d + dy, y + dy * d - dx, C[5]));
    }
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) for (let d = 1; d <= Math.min(3, L * 0.14); d++) p.px(x + dx * d, y + dy * d, d < 2 ? C[5] : C[4]);
  p.px(x, y, WHITE);
  p.glow(x, y, 6 + L * 1.3, C[4], 0.35 * k);
  p.glow(x, y, 3 + L * 0.4, WHITE, 0.3 * k);
}

function create(o) {
  const C = fit(o.palette, 7), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
  const HX = 9, HY = -20, TX = HX + o.reach, TY = HY;
  // the bundle: streaks fanned at the hand, meeting at the point; the middle one hottest
  const streaks = [-7, -4, -2, 0, 2, 4, 7].map((off) => ({ off, x0: HX + 1 + Rg.range(0, 5) + Math.abs(off) * 0.6, t0: Rg.range(0, 0.02) + Math.abs(off) * 0.003, w: off === 0 ? 2 : 1, hot: off === 0, len: Rg.range(0.75, 1) }));
  const lines = [];
  let t = 0, struck = false;
  return {
    update(dt) {
      t += dt;
      // speed lines race forward beside the bundle while it shoots out and just after
      if (t < OUT + 0.08 && Rg.chance(0.5)) {
        const s = Rg.sign();
        lines.push({ x: HX + Rg.range(0, o.reach * 0.6), y: HY + s * Rg.range(7, 17), l: Rg.range(18, 42), v: Rg.range(200, 340), t });
      }
      for (let i = lines.length - 1; i >= 0; i--) if (t - lines[i].t > 0.24) lines.splice(i, 1);
      for (const l of lines) l.x += l.v * dt;
      if (!struck && t >= OUT) {
        struck = true;
        lights.add(TX, TY, 44, C[4], 0.45, 0.3);
        lights.add(TX, TY, 14, WHITE, 0.6, 0.06);
        for (let i = 0; i < 12; i++) {
          const a = Rg.range(-0.55, 0.45), sp = Rg.range(150, 330);
          ps.spawn(P.SPARK, TX, TY, Math.cos(a) * sp, Math.sin(a) * sp - 30, Rg.range(0.12, 0.35));
        }
        for (let i = 0; i < 10; i++) {
          const a = Rg.range(-0.9, 0.9) + (Rg.chance(0.3) ? Math.PI : 0), sp = Rg.range(40, 120);
          ps.spawn(P.MOTE, TX + Rg.range(-6, 2), TY + Rg.range(-2, 2), Math.cos(a) * sp, Math.sin(a) * sp, Rg.range(0.25, 0.5), Rg.chance(0.5) ? C[5] : C[4], 0.6);
        }
        for (let i = 0; i < 4; i++) ps.spawn(P.STAR, TX + Rg.range(-10, 8), TY + Rg.range(-9, 9), 0, -3, Rg.range(0.2, 0.4), Rg.chance(0.5) ? C[5] : WHITE, Rg.range(1, 2), Rg.range(0.06, 0.2));
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      // the point catches the light before it goes
      if (t < 0.05) sparkle(p, HX + 2, HY, 5 * (1 - t / 0.05) + 1, C[5], C[3], 0.4);
      // speed lines: dotted, white at the head, dimming back along their length
      for (const l of lines) {
        const k = (t - l.t) / 0.24;
        for (let d = 0; d < l.l * (1 - k * 0.6); d++) p.dot(l.x - d, l.y, d < 3 ? WHITE : d < l.l * 0.4 ? C[5] : C[3], (1 - d / l.l) * (1 - k));
      }
      // the bundle: each streak shoots from the hand to the point, holds, then is drawn in to the point
      const pull = smooth(OUT + HOLD, OUT + HOLD + PULL, t);
      for (const s of streaks) {
        const u = clamp((t - s.t0) / OUT), head = ease.outExpo(u);
        if (u <= 0 || pull >= 1) continue;
        // the outer streaks stop short of the point and trail a little behind, so each reads on its own
        const y0 = HY + s.off, end = s.x0 + (TX - s.x0) * s.len, x1 = s.x0 + (end - s.x0) * head, xa = s.x0 + (end - s.x0) * Math.max(pull, head * 0.35 * (1 - s.len) * 3);
        const yAt = (x) => y0 + (TY - y0) * clamp((x - s.x0) / (TX - s.x0)) * 0.85;
        for (let x = xa; x <= x1; x += 0.5) {
          const v = (x - xa) / Math.max(1, x1 - xa), c = v > 0.88 ? WHITE : s.hot ? (v > 0.35 ? C[6] : C[5]) : v > 0.55 ? C[5] : v > 0.25 ? C[4] : C[3];
          p.dot(x, yAt(x), c, v < 0.12 ? v / 0.12 : 1);
          if (s.w > 1 && v > 0.1) p.dot(x, yAt(x) + 1, v > 0.6 ? C[5] : C[3], v < 0.2 ? v / 0.2 : 1);
        }
      }
      if (t < OUT + HOLD + PULL) p.glowLine(HX + (TX - HX) * pull, HY, HX + (TX - HX) * ease.outExpo(clamp(t / OUT)), TY, 6, C[4], 0.22 * (1 - pull));
      // the long star at the point, and a pierce ring shed from it
      const q = t - OUT;
      if (q >= 0 && q < 0.4) {
        const g = ease.outBack(clamp(q / 0.04), 2.4) * (1 - smooth(0.08, 0.4, q)) * (1 + 0.12 * Math.sin(q * 70));
        longStar(p, TX, TY, 24 * g, 1 - q / 0.4, C);
      }
      if (q >= 0 && q < 0.2) {
        const k = q / 0.2, rx = 2 + 7 * ease.outCubic(k), ry = 4 + 12 * ease.outCubic(k);
        for (let a = 0; a < TAU; a += 0.05) p.dot(TX + 4 + 10 * k + Math.cos(a) * rx, TY + Math.sin(a) * ry, k < 0.3 ? WHITE : C[5], 1.15 - k);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
exports.act = act;
  };
  __mods["fx/melee/spin-slash.js"] = function(exports, __req) {
// The crescent shading, cooling ramp, dotted trace, glint and spark recipe is adapted from Sprite Fusion's
// open-source slash (https://www.spritefusion.com/pixel-art-vfx/slash), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, PF, Rng, fit, sparkle, clamp, smooth, ease, rand, TAU, WHITE, READY  } = __req("core/index.js");
const {  swing, onSwing, travel, smear, trace, glowAlong  } = __req("fx/melee/_lib.js");

const meta = {
  name: "Spin slash",
  desc: "The blade whirls once round the waist on a tilted plane, behind the body and back in front; the closed ring flares white, dissolves into a dotted trace and throws sparks.",
  tags: ["melee", "slash", "spin", "sword", "aoe", "combat", "one-shot"],
  size: [208, 104],
  origin: [104, 84],
  duration: 0.8,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#16224a", "#1f4a86", "#2a7fc0", "#48b8ec", "#9fe2ff", "#e2f7ff", "#ffffff"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    radius: 46,
    seed: 3,
  },
};

const STANCE = { ...READY, weapon: "sword", fx: 12, fy: -21, sa: -0.85 };
// he really turns: forward, away from us, facing back, towards us, and round to the front
const WOUND = { ...STANCE, crouch: 6, lean: -2, yaw: 1.1, fx: 13, fy: -20, sa: 0.3, bx: 6, by: -24, ffx: 8, fbx: -8 };
const WIDE = { ...STANCE, crouch: 5, lean: 3, fx: 21, fy: -21, sa: 0.05, bx: -9, by: -23, ffx: 11, fbx: -11 };
const act = {
  target: { x: 60 },
  poses: [
    [-0.46, STANCE],
    [-0.2, WOUND],
    [-0.02, { ...WOUND, crouch: 7, yaw: 1.3 }],
    [0, { ...WIDE, sa: -0.1, ghost: 1 }, "snap"],
    [0.05, { ...WIDE, yaw: -1.57, ghost: 1 }, "snap"],
    [0.09, { ...WIDE, yaw: -3.14, ghost: 1 }, "snap"],
    [0.13, { ...WIDE, yaw: -4.71, ghost: 1 }, "snap"],
    [0.17, WIDE, "snap"],
    [0.56, { ...WIDE, crouch: 4, lean: 2 }],
    [0.92, STANCE],
  ],
  hits: [{ t: 0.17, stop: 0.12, shake: 0.16, amp: 2, push: 2.4, straw: 16 }],
  dust: [{ t: 0, x: 0, n: 6 }, { t: 0.17, x: 12, n: 6, dir: 1 }],
};

const SW = 0.17; // the edge goes once round
const FLARE = 0.3; // the closed ring flares and dissolves
const turn = (t) => 1 - Math.pow(1 - clamp(t / SW), 1.6); // fraction of the turn the edge has made
const passedAt = (f) => SW * (1 - Math.pow(1 - clamp(f), 1 / 1.6)); // when the edge passed fraction f

function create(o) {
  const C = fit(o.palette, 7), n = C.length, Rg = new Rng(o.seed), R0 = o.radius;
  const ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
  // the spin starts front-right, goes up the right side, behind the body, down the left and back across the front
  const A = swing({ cx: 0, cy: -17, R: R0, sy: 0.27, rot: -0.1, a0: 0.5, dir: -1, k: 0.15 });
  // a thinner echo just inside, a beat behind
  const E = { ...A, R: R0 * 0.8, k: 0.1 };
  const W = 16, WE = 5;
  // the far half sits deeper in the ramp
  const DIM = [C[0], C[0], C[1], C[2], C[3], C[4], C[5]];
  let t = 0, closed = false, lastU = 0;

  // the smear: thickest just behind the edge, thinning and cooling where the edge passed longer ago
  const body = (p, s, w0, lag, half, rim) => {
    const U = TAU * turn(t - lag), ramp = half < 0 ? DIM : C;
    if (U < 0.02 || t - lag > SW + 0.02) return;
    smear(p, s, 0, U, w0, (u, r, out) => {
      const age = t - lag - passedAt(u / TAU), lead = U - u;
      const w = w0 * Math.pow(clamp(lead / 0.85), 0.5) * (0.3 + 0.7 * Math.exp(-age / 0.075)) * Math.pow(clamp(u / 1.3), 0.7);
      if (w < 0.45) return;
      const q = (s.R - r) / w;
      if (q < 0 || q > 1) return;
      // white rim while fresh, then darker steps inward, with age and towards the tail
      const ci = rim && q < 0.26 && age < 0.06 ? 0 : Math.round(q * (n - 1) * 0.7 + age * 13 + (rim ? 0.4 : 1.4));
      out.c = ramp[n - 1 - clamp(ci, 0, n - 1)];
      out.a = Math.min(1, u / 1.1 + 0.2);
    }, half);
  };

  const ring = (p, half) => {
    // the swept smear and its echo
    body(p, E, WE, 0.025, half, false);
    body(p, A, W, 0, half, true);
    if (t < SW + 0.04) glowAlong(p, A, A.R - 5, 0, TAU * turn(t), 14, C[3], (u) => (half < 0 ? 0.2 : 0.3) * Math.exp(-(t - passedAt(u / TAU)) / 0.08), half);
    if (t < SW) return;
    // closed: the ring flares white, swells a little, thins, cools and breaks into dots
    const f = (t - SW) / FLARE, ramp = half < 0 ? DIM : C;
    if (f < 1) {
      const R = A.R + 6 * ease.outCubic(f), th = f < 0.13 ? 9 : Math.max(1, 6 * Math.pow(1 - f, 1.5) + 0.5), S = { ...A, R };
      const step = f < 0.13 ? 6 : f < 0.3 ? 5 : f < 0.55 ? 4 : 3;
      smear(p, S, 0, TAU, th, (u, r, out) => {
        const q = (R - r) / th;
        if (q < 0 || q > 1) return;
        out.c = f < 0.13 ? (q < 0.6 ? WHITE : ramp[5]) : q < 0.45 ? ramp[step] : ramp[step - 1];
        out.a = f < 0.4 ? 1 : 1.3 - f;
      }, half);
      glowAlong(p, S, R - 2, 0, TAU, 14, C[4], 0.32 * (1 - f) * (1 - f), half);
    }
    // a dotted trace of the blade's path lingers where the ring was, fading
    const k = 1 - clamp((t - SW - 0.06) / 0.4);
    if (k > 0) trace(p, A, A.R - 0.5, 0, TAU, ramp[4], (u) => clamp(k * 1.5 - rand(Math.floor(u * 30), 5) * 0.8) * 0.95, half);
  };

  return {
    update(dt) {
      t += dt;
      const U = TAU * turn(t);
      // shavings peel off the edge as it goes round, flung along its path
      if (t < SW) {
        for (let u = lastU; u < U; u += 0.3) {
          const tr = travel(A, u), ox = tr.x - A.cx, oy = tr.y - A.cy, l = Math.hypot(ox, oy) || 1, sp = Rg.range(40, 120);
          ps.spawn(P.MOTE, tr.x, tr.y, tr.dx * sp + (ox / l) * sp * 0.35, tr.dy * sp * 0.6 - Rg.range(5, 30), Rg.range(0.22, 0.45), C[4 + Rg.int(0, 1)], 0.55, 0, Math.sin(tr.a) < 0 ? PF.BACK : 0);
        }
        lastU = U;
      }
      if (!closed && t >= SW) {
        closed = true;
        lights.add(A.cx, A.cy + 4, 90, C[3], 0.4, 0.4);
        // sparks off the edge where it closes, and all round the ring along its turn
        const end = travel(A, TAU);
        for (let i = 0; i < 9; i++) {
          const a = Math.atan2(end.dy, end.dx) + Rg.range(-0.45, 0.35), sp = Rg.range(160, 360);
          ps.spawn(P.SPARK, end.x, end.y, Math.cos(a) * sp, Math.sin(a) * sp - Rg.range(20, 70), Rg.range(0.14, 0.36));
        }
        for (let i = 0; i < 16; i++) {
          const u = Rg.range(0, TAU), tr = travel(A, u), sp = Rg.range(110, 260);
          ps.spawn(P.SPARK, tr.x, tr.y, tr.dx * sp, tr.dy * sp - Rg.range(20, 80), Rg.range(0.12, 0.32), 0, 1, 0, Math.sin(tr.a) < 0 ? PF.BACK : 0);
        }
        // and twinkles left hanging on the ring
        for (let i = 0; i < 6; i++) {
          const u = Rg.range(0, TAU), [x, y] = onSwing(A, A.R + Rg.range(-1, 3), u);
          ps.spawn(P.STAR, x, y, 0, -Rg.range(2, 8), Rg.range(0.25, 0.5), Rg.chance(0.5) ? C[5] : WHITE, Rg.range(1.2, 2.6), Rg.range(0.04, 0.16), Math.sin(A.a0 + A.dir * u) < 0 ? PF.BACK : 0);
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      ring(p, -1);
      ps.draw(p, "back");
    },
    draw(p) {
      ring(p, 1);
      // the blade catches the light as it sets off, and glints again where the ring closes
      if (t < 0.06) {
        const [x, y] = onSwing(A, A.R - 3, 0);
        sparkle(p, x, y, 7 * (1 - t / 0.06), C[5], C[3], 0.5);
      }
      const g = t - SW * 0.85, tip = onSwing(A, A.R - 3, TAU);
      if (g > 0 && g < 0.24) sparkle(p, tip[0], tip[1], 10 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.24), C[5], C[3], 0.6);
      // light rides the edge
      if (t < SW + 0.05) {
        const U = TAU * turn(t), [x, y] = onSwing(A, A.R - 5, U), far = Math.sin(A.a0 + A.dir * U) < 0;
        p.glow(x, y, far ? 26 : 38, C[3], (far ? 0.3 : 0.5) * (1 - smooth(SW - 0.04, SW + 0.05, t)));
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
exports.act = act;
  };
  __mods["fx/melee/claw-swipe.js"] = function(exports, __req) {
// The shaded smear, its light and the dotted trace follow Sprite Fusion's open-source slash
// (https://www.spritefusion.com/pixel-art-vfx/slash), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Bits, Lights, P, B, Rng, fit, sparkle, clamp, smooth, ease, READY  } = __req("core/index.js");
const {  through, onSwing, travel, smear, trace, glowAlong  } = __req("fx/melee/_lib.js");

const meta = {
  name: "Claw swipe",
  desc: "Three claw marks rake down one after another, white-hot, cooling through orange to red, then close up from both ends and leave a dotted scar, with hot flecks and drips.",
  tags: ["melee", "claw", "swipe", "beast", "scratch", "combat", "directional", "one-shot"],
  size: [128, 96],
  origin: [36, 84],
  duration: 0.9,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#2a0808", "#5c0f12", "#a51d1d", "#e2401f", "#ff8a2a", "#ffd166", "#fff3c4", "#ffffff"],
    sparks: ["#fff3c4", "#ffd166", "#ff8a2a", "#c42a1a"],
    seed: 8,
  },
};

const READY_ = { ...READY, weapon: "claw", offWeapon: "claw", sa: -0.4, sb: -0.9, crouch: 5, lean: 3, fx: 14, fy: -21, bx: 8, by: -25, ffx: 9, fbx: -8 };
const HIGH = { ...READY_, x: -6, crouch: 4, lean: -3, fx: 3, fy: -41, sa: -1.4, bx: 7, by: -18, sb: -0.3, ffx: 10 };
const act = {
  target: { x: 58 },
  poses: [
    [-0.46, { ...READY_, x: -6 }],
    [-0.2, HIGH],
    [-0.05, { ...HIGH, crouch: 5 }],
    [0, { ...READY_, x: 0, crouch: 3, lean: 4, fx: 19, fy: -36, sa: -0.9, bx: -7, by: -24, ghost: 1 }, "snap"],
    [0.05, { ...READY_, x: 2, crouch: 5, lean: 6, fx: 23, fy: -24, sa: 0.5, bx: -7, by: -24, ffx: 13, fbx: -10, toeB: true }, "snap"],
    [0.1, { ...READY_, x: 3, crouch: 7, lean: 7, fx: 22, fy: -12, sa: 1.2, bx: -7, by: -24, ffx: 13, fbx: -10, toeB: true }, "snap"],
    [0.42, { ...READY_, x: 3, crouch: 6, lean: 5, fx: 21, fy: -13, sa: 1.1, bx: -6, by: -22, ffx: 13, fbx: -10 }],
    [0.9, { ...READY_, x: -6 }],
  ],
  hits: [
    { t: 0.04, stop: 0.03, push: 0.9, straw: 5, y: -30, flash: 0.03 },
    { t: 0.08, stop: 0.03, push: 0.9, straw: 5, y: -26, flash: 0.03 },
    { t: 0.12, stop: 0.08, shake: 0.14, amp: 2, push: 1.4, straw: 9, y: -18 },
  ],
  dust: [{ t: 0.1, x: 12, n: 6, dir: 1 }],
};

const RAKE = 0.05; // each mark tears open
const STAGGER = 0.04;
const CLOSE0 = 0.16, CLOSE = 0.3; // then closes up from both ends

function create(o) {
  const C = fit(o.palette, 8), n = C.length, Rg = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: Rg, ground: floor, sparks: o.sparks }), drips = new Bits({ ground: floor }), lights = new Lights();
  // three marks raking down and back, each a little lower and further out than the last
  const marks = [0, 1, 2].map((i) => {
    const s = through(31 + i * 8, -23 + i * 2, 1.84, 1, 40, 0.84 - i * 0.05, 0.5);
    return { s, t0: i * STAGGER, W: 4.2 - i * 0.4, open: false, end: travel(s, s.span) };
  });
  let t = 0;
  const heatAt = (m) => clamp(1 - (t - m.t0) / 0.42);
  return {
    update(dt) {
      t += dt;
      for (const m of marks) {
        if (!m.open && t >= m.t0 + RAKE * 0.7) {
          m.open = true;
          lights.add(m.end.x, m.end.y - 6, 34, C[4], 0.45, 0.3);
          // hot flecks thrown on along the rake, and drips running off the wound
          for (let i = 0; i < 7; i++) {
            const a = Math.atan2(m.end.dy, m.end.dx) + Rg.range(-0.5, 0.5), sp = Rg.range(110, 260);
            ps.spawn(P.SPARK, m.end.x, m.end.y, Math.cos(a) * sp, Math.sin(a) * sp, Rg.range(0.12, 0.32));
          }
          for (let i = 0; i < 5; i++) {
            const [x, y] = onSwing(m.s, m.s.R, m.s.span * Rg.range(0.15, 0.9));
            ps.spawn(P.MOTE, x, y, Rg.range(-60, -10), Rg.range(-30, 30), Rg.range(0.2, 0.4), Rg.chance(0.5) ? C[5] : C[4], 0.5);
          }
          for (let i = 0; i < 2; i++) {
            const [x, y] = onSwing(m.s, m.s.R - 1, m.s.span * Rg.range(0.35, 0.75));
            drips.add({ kind: B.DRIP, x, y, vx: Rg.range(-8, 8), vy: Rg.range(10, 40), g: 0.55, life: 1.2, c: C[3] });
          }
        }
      }
      drips.update(dt);
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      for (const m of marks) {
        const u = t - m.t0;
        if (u < 0) continue;
        const S = m.s.span, head = S * ease.outExpo(clamp(u / RAKE)), c = smooth(CLOSE0, CLOSE0 + CLOSE, u), lo = (S / 2) * c, hi = Math.min(head, S - (S / 2) * c);
        const heat = heatAt(m);
        if (hi - lo > 0.02) {
          // a lens: sharp at both ends, thickest in the middle; white-hot at the core, cooling outward and with time
          smear(p, m.s, lo, hi, m.W, (uu, r, out) => {
            const v = uu / S, w = m.W * Math.pow(Math.sin(Math.PI * v), 1.15) * (1 - 0.55 * c), off = Math.abs(r - (m.s.R - m.W / 2)) / (w / 2 + 0.01);
            if (w < 0.5 || off > 1) return;
            const ci = Math.round((1 - heat) * 5.2 + off * 1.6 + (head < S ? (S - uu) / S : 0) * 0.5);
            out.c = C[n - 1 - clamp(ci, 0, n - 2)];
          }, 0, 2);
          glowAlong(p, m.s, m.s.R - m.W / 2, lo, hi, 11, C[4], 0.42 * heat * heat, 0, 0.2);
        }
        // where it has closed, a dotted red scar lingers and fades
        const k = 0.8 * (1 - clamp((u - CLOSE0 - CLOSE * 0.5) / 0.4));
        if (c > 0.05 && k > 0) {
          trace(p, m.s, m.s.R - m.W / 2, 0.04 * S, lo, C[2], k);
          trace(p, m.s, m.s.R - m.W / 2, S - lo, 0.96 * S, C[2], k);
        }
        // the claw tip glints as it tears in
        const g = u - RAKE * 0.4;
        if (g > 0 && g < 0.16) sparkle(p, m.end.x, m.end.y, 5 * ease.outBack(Math.min(1, g / 0.04)) * (1 - g / 0.16), C[6], C[4], 0.4);
      }
      drips.draw(p);
      ps.draw(p);
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
exports.act = act;
  };
  __mods["fx/impacts/shield-block.js"] = function(exports, __req) {
// Mapping a lattice onto a dome by longitude and latitude, the ripple measured over its surface, the rim light
// and the glancing sparks are adapted from Sprite Fusion's open-source shield
// (https://www.spritefusion.com/pixel-art-vfx/shield), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, fit, clamp, smooth, rand, TAU, WHITE, READY  } = __req("core/index.js");
const {  star, spikes  } = __req("fx/impacts/_lib.js");

const meta = {
  name: "Shield block",
  desc: "A blow is caught on a half-dome of energy in front of the character: its diamond lattice flashes, a ripple runs over it, sparks glance off, then it blinks out cell by cell.",
  tags: ["impact", "block", "shield", "barrier", "energy", "ripple", "actor", "one-shot"],
  size: [148, 104],
  origin: [40, 88],
  duration: 1.1,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    seed: 12,
  },
};

const BRACE = { ...READY, crouch: 4, lean: 2, fx: 13, fy: -28, bx: 6, by: -21, ffx: 9, fbx: -9 };
const act = {
  poses: [
    [-0.36, READY],
    [-0.1, BRACE],
    [0, { ...BRACE, x: -3, crouch: 6, lean: -2, fx: 10, fy: -26 }, "snap"],
    [0.18, { ...BRACE, x: -4, crouch: 5, lean: 0 }],
    [0.65, { ...BRACE, x: -3 }],
    [1.1, { ...READY, x: 0 }],
  ],
  hits: [{ t: 0.005, stop: 0.09, shake: 0.2, amp: 2 }],
  dust: [{ t: 0.01, x: -10, n: 6, dir: -1 }],
};

const CX = 3, RX = 28, RY = 44, GRID = 3.4; // the dome's flat face, its depth and height, lattice density
const HIT = { lon: 1.18, lat: 0.5 }, GONE = 0.5; // where the blow lands; when the dome starts to blink out

// a point on the dome's surface (lon round from facing us, lat up from the floor) to local space
const onDome = (lon, lat) => [CX + RX * Math.cos(lat) * Math.sin(lon), -RY * Math.sin(lat)];

function create(o) {
  const C = fit(o.palette, 8), S = fit(o.sparks, 4), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: S });
  const lights = new Lights();
  const [hx, hy] = onDome(HIT.lon, HIT.lat), sp = spikes(R, 8, 0.2, { len: [5, 8], w: [1.4, 1.9], fwd: 1.2, back: 0.3 });

  lights.add(hx, hy, 40, S[1], 0.7, 0.2);
  lights.add(hx, hy, 12, WHITE, 0.7, 0.06);
  // sparks glance off the dome: out and along its surface, mostly upward
  const nA = Math.atan2(-Math.sin(HIT.lat) / RY, (Math.cos(HIT.lat) * Math.sin(HIT.lon)) / RX); // the outward normal, roughly
  for (let i = 0; i < 14; i++) {
    const a = nA + R.range(-1.2, 0.9), v = R.range(130, 300);
    ps.spawn(P.SPARK, hx + 1, hy, Math.cos(a) * v, Math.sin(a) * v - 30, R.range(0.15, 0.42), WHITE, 1, i > 10 ? R.range(0.01, 0.04) : 0);
  }

  let t = 0;
  // the dome, front (back = false) or the far side seen through it (back = true): a glassy fill, a diamond
  // lattice, a bright rim where it turns away, a sheen sweeping up it
  const dome = (p, back) => {
    const fade = 1 - smooth(GONE + 0.35, GONE + 0.55, t);
    if (fade <= 0) return;
    for (let y = -RY - 1; y < 0; y++)
      for (let x = CX; x <= CX + RX + 1; x++) {
        const u = (x + 0.5 - CX) / RX, v = -(y + 0.5) / RY, q = u * u + v * v;
        if (q > 1 || u < 0 || v < 0) continue;
        const z = Math.sqrt(1 - q) * (back ? -1 : 1), lon = Math.atan2(u, z), lat = Math.asin(clamp(v));
        // the lattice, and which cell this is: each cell keeps its own clock for blinking out
        const a = (lon + lat) * GRID, b = (lon - lat) * GRID, fa = a - Math.floor(a), fb = b - Math.floor(b);
        const cell = rand(Math.floor(a), Math.floor(b), 31), line = Math.min(fa, 1 - fa, fb, 1 - fb) < 0.13;
        const gone = GONE + cell * 0.35;
        if (t > gone) continue;
        // how far over the surface from the blow, and the two ripples running out from it
        const d = Math.acos(clamp(Math.cos(lat) * Math.cos(HIT.lat) * Math.cos(lon - HIT.lon) + Math.sin(lat) * Math.sin(HIT.lat), -1, 1));
        let hit = 0;
        for (const [t0, k0] of [[0, 1], [0.12, 0.55]]) {
          const k = t - t0, front = k * 3.6;
          if (k < 0 || k > 0.55) continue;
          if (Math.abs(d - front) < 0.2) hit = Math.max(hit, k0 * (1 - k / 0.55));
          else if (d < front) hit = Math.max(hit, 0.3 * k0 * (1 - k / 0.55));
        }
        const rim = 1 - Math.abs(z), flash = t < 0.05, blink = t > gone - 0.06, sheen = Math.abs(((lat * 0.8 - lon * 0.3 - t * 1.6) % 1 + 1) % 1 - 0.5) < 0.05;
        if (back) {
          if (line) p.dot(x, y, C[3], 0.5 * fade);
          continue;
        }
        if (q > 0.9) p.dot(x, y, flash || hit > 0.5 ? WHITE : C[6], fade);
        else if (line) p.dot(x, y, flash || blink || hit > 0.5 ? WHITE : hit > 0.2 || sheen ? C[6] : rim > 0.7 ? C[5] : rim > 0.35 ? C[4] : C[3], fade);
        else p.blend(x, y, flash || hit > 0.35 ? C[6] : C[3], fade * Math.min(0.85, (flash ? 0.35 : 0.1 + 0.25 * rim * rim) + hit * 0.65));
        if (((x * 7 + y * 3) & 15) === 0) p.light(x, y, C[4], 0.15 + 0.5 * hit);
      }
  };

  return {
    update(dt) {
      t += dt;
      // as cells blink out, little motes of light lift off
      if (t > GONE && t < GONE + 0.38 && R.chance(0.5)) {
        const lon = R.range(0, Math.PI / 2), lat = R.range(0.05, 1.4), [x, y] = onDome(lon, lat);
        ps.spawn(P.STAR, x, y, R.range(-10, 10), -R.range(10, 40), R.range(0.2, 0.36), R.chance(0.5) ? C[6] : C[5], R.range(0.6, 1.4));
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      dome(p, true);
    },
    draw(p) {
      dome(p, false);
      // where the dome meets the floor
      const fade = 1 - smooth(GONE + 0.3, GONE + 0.55, t);
      if (fade > 0) for (let x = CX; x <= CX + RX; x++) p.dot(x, 0, t < 0.05 ? WHITE : C[5], fade * (0.6 + 0.4 * ((x - CX) / RX)));
      // the blow: a hot star where it lands, then the sparks glancing off
      if (t < 0.03) star(p, hx, hy, sp, 1, 1, [S[3], S[0], S[1], WHITE], 1, 2);
      else if (t < 0.06) star(p, hx, hy, sp, 1.25, 0.55, [S[3], S[1], S[2], S[0]], 1, 2);
      ps.draw(p);
      p.glow(CX + RX * 0.5, -RY * 0.45, RY * 0.9, C[4], 0.2 * (1 - smooth(GONE, GONE + 0.55, t)) + 0.35 * Math.exp(-t / 0.08));
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
exports.act = act;
  };
  __mods["fx/impacts/_lib.js"] = function(exports, __req) {
// Shared by the impacts: the hit star, a ring that breaks into flying arcs, floor cracks that glow and cool,
// standing shock fronts, soft lumpy dust rings, faceted tumbling rocks, and the stone colors they share.
// The star and flying-arc recipes are adapted from Sprite Fusion's open-source impact
// (https://www.spritefusion.com/pixel-art-vfx/impact), and the stone colors from its explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
// Files starting with _ are helpers, not effects.

const {  clamp, rand, TAU, hex, mix, scale, rgb, WHITE  } = __req("core/index.js");

const SOOT = hex("#0d0a12");
const OUTLINE = hex("#1a1422");
const LIGHT = Math.atan2(-1, -1); // light comes from the top left

/** Stone colors from one body color: light, body, shade, dust (lighter and greyer), lip (a lit broken edge). */
function stone(c) {
  c = hex(c);
  return { light: mix(scale(c, 1.35), WHITE, 0.08), body: c, shade: scale(c, 0.64), dust: mix(scale(c, 1.2), rgb(150, 140, 150), 0.3), lip: mix(scale(c, 1.55), WHITE, 0.12) };
}

/**
 * Spikes for a hit star: n of them round the circle, longer towards aim (fwd) and a little behind it (back).
 * len and w: [min, max] base length and root half-width; jag scales every other spike (short teeth between).
 */
function spikes(R, n, aim, { len = [7, 10], w = [1.5, 2.1], fwd = 1.8, back = 0.6, jag = 1, jit = 0.18 } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const a = aim + (i / n) * TAU + R.range(-jit, jit), cb = Math.cos(a - aim);
    const L = R.range(len[0], len[1]) * (1 + fwd * Math.pow(Math.max(0, cb), 3) + back * Math.pow(Math.max(0, -cb), 3)) * (i % 2 ? jag : 1);
    return { a, len: L, w: R.range(w[0], w[1]) * (i % 2 ? Math.sqrt(jag) : 1) };
  });
}

/**
 * A hit star: tapered spikes in three passes (a rim, a body that's paler near the root, a hot core) round a
 * hot heart. sc stretches the spikes, th thins them, cols [rim, body, inner, core], a dithers it out.
 */
function star(p, x, y, list, sc, th, [rim, body, inner, core], a = 1, heart = 2.4) {
  for (let pass = 0; pass < 3; pass++)
    for (const s of list) {
      const c = Math.cos(s.a), sn = Math.sin(s.a), L = s.len * sc;
      for (let d = 0; d <= L; d += 0.5) {
        if (pass === 2 && d > L * 0.55) break;
        const hw0 = s.w * th * (1 - d / L) * Math.min(1, 0.5 + d / 3);
        const hw = pass === 0 ? hw0 + 0.8 : pass === 1 ? hw0 : hw0 * 0.45;
        const col = pass === 0 ? rim : pass === 1 ? (d < L * 0.35 ? inner : body) : core;
        for (let o = -hw; o <= hw; o += 0.5) p.dot(x + c * d - sn * o, y + sn * d + c * o, col, a);
      }
    }
  const r = heart * sc * Math.sqrt(th);
  p.circle(x, y, r + 0.8, inner, a);
  p.circle(x, y, r, core, a);
}

/**
 * A ring that breaks into arcs: segs [{ a (centre angle), gap (0..1), dr (how fast it flies out), w (thickness
 * scale, default 1) }] evenly round the ring. brk 0 draws a whole ring th thick; as brk grows each arc shrinks,
 * tapers at both ends into a crescent and drifts out at its own speed. c is the outer edge's color, c2 the
 * inner's; sy squashes it onto a plane; nothing is drawn below maxY (a floor).
 */
function brokenRing(p, x, y, r, th, segs, brk, c, c2 = c, k = 1, sy = 1, maxY = Infinity) {
  if (r <= 0 || k <= 0) return;
  const full = TAU / segs.length;
  for (const s of segs) {
    const span = full * (1 - s.gap * brk) + 0.02, rr = r * (1 + s.dr * brk), m = Math.max(4, Math.ceil(rr * span * 1.8));
    for (let j = 0; j <= m; j++) {
      const u = j / m, ang = s.a + (u - 0.5) * span, w = Math.max(0.5, th * (s.w ?? 1) * (1 - brk * Math.pow(Math.abs(2 * u - 1), 1.6)));
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let o = -w / 2; o <= w / 2 + 0.01; o += 0.5) if (y + sa * (rr + o) * sy < maxY) p.dot(x + ca * (rr + o), y + sa * (rr + o) * sy, o > -0.26 ? c : c2, k);
    }
  }
}

// a jagged walk from (x, y) heading a for L px; each point is [x, y, distance along]
function walk(R, x, y, a, L, { jit = 0.55, steer = 0.45, step = [2, 4], maxY = Infinity, d0 = 0 } = {}) {
  const pts = [[x, y, d0]];
  let d = 0, cur = a;
  while (d < L - 0.01) {
    const s = Math.min(L - d, R.range(step[0], step[1]));
    cur += R.range(-jit, jit) + (a - cur) * steer;
    x += Math.cos(cur) * s;
    y = clamp(y + Math.sin(cur) * s, 0.5, maxY);
    d += s;
    pts.push([x, y, d0 + d]);
  }
  return pts;
}

/**
 * Cracks in the floor face below (0, 0): n jagged lines, alternately left and right, mostly shallow, a few
 * diving steeply, some forked. len [min, max], maxY how deep they may go, forks 0..1.
 */
function makeCracks(R, n, { len = [14, 40], dive = 0.85, maxY = 22, forks = 0.5, x0 = [1, 5] } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, dip = 0.06 + Math.pow(R.next(), 1.7) * dive, L = R.range(len[0], len[1]) * (1 - (0.5 * dip) / (dive + 0.06));
    const a = side > 0 ? dip : Math.PI - dip, pts = walk(R, side * R.range(x0[0], x0[1]), R.range(0.5, 1.5), a, L, { maxY });
    const c = { pts, len: L, t0: R.range(0, 0.035), kids: [] };
    for (let j = 2; j < pts.length - 1; j++)
      if (R.chance(forks * 0.4)) {
        const [fx, fy, fd] = pts[j];
        c.kids.push(walk(R, fx, fy, a + R.sign() * R.range(0.45, 1), R.range(3, 9) * (1 - (0.5 * j) / pts.length), { maxY, d0: fd, jit: 0.7, step: [1.5, 3] }));
      }
    out.push(c);
  }
  return out;
}

/**
 * Draw cracks grown to g(c) px of their length. heat(d) 0..1 at distance d along a crack lights it from the
 * hot ramp (bright to dark) before it cools to dark; lip is the lit lower edge; k dithers them out.
 * Returns nothing; adds a glow along the hot parts.
 */
function drawCracks(p, cracks, g, heat, hot, dark, lip, k = 1) {
  if (k <= 0) return;
  const col = (d) => {
    const h = heat(d);
    return h > 0.75 ? hot[0] : h > 0.5 ? hot[1] : h > 0.3 ? hot[2] : h > 0.12 ? hot[3] : dark;
  };
  for (const c of cracks) {
    const G = g(c);
    if (G <= 0) continue;
    for (const path of [c.pts, ...c.kids]) {
      for (let i = 1; i < path.length; i++) {
        const [x0, y0, d0] = path[i - 1], [x1, y1, d1] = path[i];
        if (d0 >= G) break;
        const f = d1 > G ? (G - d0) / (d1 - d0) : 1, ex = x0 + (x1 - x0) * f, ey = y0 + (y1 - y0) * f;
        p.line(x0, y0 + 1, ex, ey + 1, lip, (u) => (rand(Math.round(x0 + (ex - x0) * u), Math.round(y0 + (ey - y0) * u), 5) < 0.3 ? k * 0.8 : 0));
        p.line(x0, y0, ex, ey, (u) => col(d0 + (d1 - d0) * f * u), k);
        const h = heat(d0);
        if (h > 0.12) p.glow((x0 + ex) / 2, (y0 + ey) / 2, 4 + h * 4, hot[2], 0.22 * h * k);
      }
    }
  }
}

/**
 * A standing crescent shock front on the floor (y = 0): it leans back from a leading edge low at x, dir 1
 * racing right ")", -1 left "(". h tall, w thick at its widest (thick where it meets the floor, a point at
 * the top); cols [edge, body, back] bright to dark; k dithers it out.
 */
function frontCrescent(p, x, dir, h, w, cols, k = 1) {
  if (h < 1 || w < 0.3 || k <= 0) return;
  const ry = h * 0.8, cy = -h * 0.2, rx = Math.max(2, h * 0.55);
  const x0 = dir > 0 ? x - rx - w - 1 : x - 1, x1 = dir > 0 ? x + 1 : x + rx + w + 1;
  p.shade(x0, -h - 1, x1, 0, (px, py, out) => {
    if (py > 0) return;
    const ey = (py - cy) / ry;
    if (ey <= -1 || ey >= 1) return;
    const e2 = 1 - ey * ey, edge = rx * Math.sqrt(e2) - rx, wt = w * Math.pow(e2, 0.45), q = (edge - (px - x) * dir) / Math.max(0.5, wt);
    if (q < 0 || q > 1) return;
    out.c = q < 0.28 ? cols[0] : q < 0.62 ? cols[1] : cols[2];
    out.a = k * (ey < -0.8 ? 0.7 : 1) * (q > 0.7 ? 1.25 - q * 0.8 : 1);
  });
}

/**
 * A soft, lumpy ring of dust round (cx, cy): radius r, w thick (lumps swell it), alpha k, translucent and lit
 * on its upper side. sy squashes it onto the floor; brk 0..1 tears it into clumps as it thins; ph varies it;
 * nothing is drawn below maxY; half -1 draws only the far half (above cy), 1 only the near half.
 */
function dustRing(p, cx, cy, r, w, k, c, { sy = 1, ph = 0, brk = 0, lit = 0.35, maxY = Infinity, half = 0 } = {}) {
  if (k <= 0.01 || r <= 0) return;
  const W = w * 1.6, lite = mix(c, WHITE, lit);
  for (let y = Math.floor(cy - (r + W) * sy) - 1; y <= Math.min(maxY - 1, Math.ceil(cy + (r + W) * sy) + 1); y++)
    for (let x = Math.floor(cx - r - W) - 1; x <= Math.ceil(cx + r + W) + 1; x++) {
      const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) / sy, d = Math.hypot(dx, dy), g = Math.atan2(dy, dx);
      if ((half < 0 && dy >= 0) || (half > 0 && dy < 0)) continue;
      const lumpy = 0.6 + 0.3 * Math.sin(5 * g + ph) + 0.18 * Math.sin(11 * g + ph * 2.1) + 0.12 * Math.sin(17 * g + ph * 0.7);
      const wt = w * lumpy, off = Math.abs(d - r - w * 0.25 * Math.sin(7 * g + ph));
      if (off >= wt) continue;
      const tear = brk > 0 ? clamp((0.55 + 0.45 * Math.sin(6 * g + ph * 1.7) - brk) / 0.25) : 1;
      const a = k * (1 - Math.pow(off / wt, 2)) * tear;
      if (a > 0.01) p.blend(x, y, dy < 0 && d > r - wt * 0.3 ? lite : c, a);
    }
}

/** A rock's outline: n vertex radii round its centre. */
const rockShape = (R, n = 6) => Array.from({ length: n }, () => R.range(0.7, 1.12));

/**
 * A faceted rock tumbling at angle b.a: every facet shaded by how it faces the light, a lit top face, a dark
 * outline, dithering out over its last half second. b: { x, y, a, s (1..3), life, pts }, st: stone().
 */
function rock(p, b, st) {
  const r = 0.75 + b.s * 0.8, n = b.pts.length, fade = Math.min(1, b.life / 0.5), ca = Math.cos(b.a), sa = Math.sin(b.a);
  p.shade(b.x - r - 2, b.y - r - 2, b.x + r + 2, b.y + r + 2, (x, y, out) => {
    const dx = x - b.x, dy = y - b.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca, d = Math.hypot(u, v);
    let ang = Math.atan2(v, u);
    if (ang < 0) ang += TAU;
    const f = (ang / TAU) * n, i = Math.floor(f) % n, w = f - Math.floor(f), edge = r * (b.pts[i] * (1 - w) + b.pts[(i + 1) % n] * w);
    if (d > edge + 0.85) return;
    out.a = fade;
    if (d > edge) return OUTLINE;
    const lit = Math.cos(((i + 0.5) / n) * TAU + b.a - LIGHT);
    if (d < edge * 0.42) return lit > 0.55 ? st.light : st.body;
    return lit > 0.35 ? st.light : lit < -0.4 ? st.shade : st.body;
  });
}

exports.stone = stone;
exports.spikes = spikes;
exports.star = star;
exports.brokenRing = brokenRing;
exports.makeCracks = makeCracks;
exports.drawCracks = drawCracks;
exports.frontCrescent = frontCrescent;
exports.dustRing = dustRing;
exports.rock = rock;
exports.SOOT = SOOT;
exports.OUTLINE = OUTLINE;
exports.rockShape = rockShape;
  };
  __mods["fx/impacts/parry.js"] = function(exports, __req) {
// The star's key frames and the spark spray are adapted from Sprite Fusion's open-source impact
// (https://www.spritefusion.com/pixel-art-vfx/impact), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, fit, clamp, smooth, ease, TAU, WHITE  } = __req("core/index.js");
const {  star, brokenRing  } = __req("fx/impacts/_lib.js");

const meta = {
  name: "Parry",
  desc: "Two blades clash: their edges flash in an X, a white four-point star rings out, a ring breaks into arcs and a fan of gold sparks sprays up and rains down.",
  tags: ["impact", "parry", "block", "clash", "sword", "metal", "sparks", "one-shot"],
  size: [200, 112],
  origin: [100, 96],
  duration: 1,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#2a1a08", "#6a4410", "#b07a1a", "#e8b030", "#ffe066", "#fff6c4", "#ffffff"], height: 30, seed: 11 },
};

function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), X = 0, Y = -o.height, floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[4], C[4], C[3], C[2]] });
  const lights = new Lights();
  // a hard four-point star: long arms on the axes, short ones between
  const sp = [];
  for (let i = 0; i < 8; i++) sp.push({ a: (i * Math.PI) / 4 + R.range(-0.04, 0.04), len: i % 2 ? R.range(6, 8) : i % 4 === 0 ? R.range(19, 22) : R.range(14, 17), w: i % 2 ? 1.2 : 2.2 });
  const segs = Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * TAU + R.range(-0.1, 0.1), gap: R.range(0.55, 0.8), dr: R.range(0.1, 0.35) }));
  // the two edges that met: lines crossing in an X
  const edges = [-0.62 + R.range(-0.08, 0.08), Math.PI + 0.62 + R.range(-0.08, 0.08)];

  lights.add(X, Y, 60, C[4], 0.65, 0.4);
  lights.add(X, Y, 22, WHITE, 0.8, 0.08);
  // the fan: sparks thrown up and out to both sides, arcing over and raining down to bounce on the floor
  for (let i = 0; i < 24; i++) {
    const s = i % 2 ? 1 : -1, a = -Math.PI / 2 + s * R.range(0.3, 1.3), v = R.range(130, 290);
    ps.spawn(P.SPARK, X + s * R.range(1, 3), Y, Math.cos(a) * v, Math.sin(a) * v, R.range(0.45, 0.85), WHITE, 1, i > 17 ? R.range(0.02, 0.07) : 0);
  }
  for (let i = 0; i < 8; i++) {
    const a = R.range(0, TAU), v = R.range(40, 110);
    ps.spawn(P.MOTE, X, Y, Math.cos(a) * v, Math.sin(a) * v - 20, R.range(0.3, 0.55), R.pick([C[5], C[6]]), 0.6, R.range(0, 0.04));
  }
  for (let i = 0; i < 3; i++) {
    const a = R.range(0, TAU), d = R.range(12, 26);
    ps.spawn(P.STAR, X + Math.cos(a) * d, Y + Math.sin(a) * d, 0, -3, R.range(0.22, 0.34), WHITE, R.range(1.6, 2.6), R.range(0.1, 0.3));
  }

  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      // the ring: rings out off the star and breaks into arcs that fly on and cool
      const u = (t - 0.03) / 0.36;
      if (u >= 0 && u < 1) {
        const r = 8 + 24 * ease.outCubic(u), brk = smooth(0.15, 0.6, u), i = u < 0.15 ? 6 : u < 0.35 ? 5 : u < 0.6 ? 4 : 3;
        brokenRing(p, X, Y, r, Math.max(1, 2.6 * Math.pow(1 - u, 1.2)), segs, brk, C[i], C[Math.max(2, i - 2)], u < 0.6 ? 1 : (1 - u) / 0.4, 1, 0);
        if (u < 0.5) p.glowRing(X, Y, r, 5, C[4], 0.3 * (1 - u / 0.5));
      }
      ps.draw(p);
      // the edges flash where they met
      if (t < 0.058)
        for (const a of edges) {
          const ca = Math.cos(a), sa = Math.sin(a), L = t < 0.025 ? 26 : 32, k = t < 0.025 ? 1 : 0.6;
          for (let d = -L; d <= L; d += 0.5) {
            const q = Math.abs(d) / L;
            p.dot(X + ca * d, Y + sa * d, q < 0.4 ? WHITE : q < 0.75 ? C[5] : C[4], q < 0.6 ? 1 : k * (1.3 - q));
          }
          p.glowLine(X - ca * L, Y - sa * L, X + ca * L, Y + sa * L, 4, C[5], 0.35 * k);
        }
      // the star: white, then bigger and gold as it thins, then just a glint
      if (t < 0.025) star(p, X, Y, sp, 1, 1, [C[4], WHITE, WHITE, WHITE], 1, 2.6);
      else if (t < 0.058) star(p, X, Y, sp, 1.25, 0.65, [C[2], C[5], C[6], WHITE], 1, 2.6);
      else if (t < 0.092) star(p, X, Y, sp, 1.4, 0.3, [C[2], C[4], C[5], C[6]], 1, 2);
      const pop = Math.exp(-t / 0.05);
      if (pop > 0.02) {
        p.glow(X, Y, 30, C[4], 0.5 * pop);
        p.glow(X, Y, 10, WHITE, 0.4 * pop);
      }
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/impacts/crit-hit.js"] = function(exports, __req) {
// The star, its key frames and the spark spray are adapted from Sprite Fusion's open-source impact
// (https://www.spritefusion.com/pixel-art-vfx/impact), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Bits, Lights, P, B, Rng, fit, clamp, smooth, ease, TAU, WHITE  } = __req("core/index.js");
const {  spikes, star, brokenRing  } = __req("fx/impacts/_lib.js");

const meta = {
  name: "Critical hit",
  desc: "A critical hit: a jagged starburst slams in white and overshoots, a ring breaks into flying arcs, sparks streak off, shards tumble to the floor under a big flare.",
  tags: ["impact", "hit", "crit", "critical", "combat", "directional", "one-shot"],
  size: [216, 136],
  origin: [84, 106],
  duration: 0.9,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#2a0510", "#5c0a1c", "#a3142a", "#e0302c", "#ff7a2a", "#ffc23d", "#fff09a", "#ffffff"], height: 26, aim: 0.12, seed: 3 },
};

// the star's key frames: [from t, scale, thickness, alpha, colors (rim, body, inner, core) as steps of the ramp]
const KEYS = [
  [0, 1, 1, 1, [6, 7, 7, 7]],
  [0.025, 1.3, 1, 1, [2, 5, 6, 7]],
  [0.058, 1.05, 0.72, 1, [2, 4, 5, 6]],
  [0.092, 1.22, 0.3, 1, [1, 2, 3, 4]],
  [0.125],
];

// a lens flare: a long level streak, thick and white at the heart, a shorter upright one, on a bed of light
function flare(p, x, y, L, k, C) {
  for (const [dx, dy, len] of [[1, 0, L], [0, 1, L * 0.45], [0.7, 0.7, L * 0.16], [0.7, -0.7, L * 0.16]])
    for (const s of [-1, 1])
      for (let d = 1; d <= len; d++) {
        const u = d / len, a = u < 0.7 ? 1 : k * (1.6 - u);
        p.dot(x + s * dx * d, y + s * dy * d, u < 0.35 ? WHITE : u < 0.7 ? C[6] : C[5], a);
        if (dy === 0 && u < 0.42) for (const e of [-1, 1]) p.dot(x + s * d, y + e, u < 0.2 ? C[6] : C[5], u < 0.3 ? 1 : k);
      }
  p.glowLine(x - L, y, x + L, y, 6, C[6], 0.5 * k);
  p.glowLine(x, y - L * 0.45, x, y + L * 0.45, 4, C[6], 0.3 * k);
}

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), X = 0, Y = -o.height, A = o.aim, floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[3]] });
  const bits = new Bits({ ground: floor }), lights = new Lights();
  const sp = spikes(R, 14, A, { len: [11, 15], w: [1.8, 2.5], fwd: 1.4, back: 0.6, jag: 0.5 });
  [...sp].sort((a, b) => b.len - a.len).slice(0, 2).forEach((s) => (s.len *= 1.3));
  const segs = Array.from({ length: 7 }, (_, i) => {
    const a = A + (i / 7) * TAU;
    return { a, gap: R.range(0.55, 0.85), dr: R.range(0.08, 0.4) + 0.15 * Math.max(0, Math.cos(a - A)), w: 0.7 + 0.5 * Math.max(0, Math.cos(a - A)) };
  });

  lights.add(X, Y, 84, C[5], 0.6, 0.5);
  lights.add(X, Y, 30, WHITE, 0.7, 0.1);
  lights.add(X, -4, 44, C[4], 0.3, 0.45);
  // sparks: most sprayed on along the blow, a few kicked back
  for (let i = 0; i < 36; i++) {
    const back = R.chance(0.22), a = (back ? A + Math.PI : A) + R.range(-1, 1) * (back ? 0.6 : 0.8), v = R.range(170, 430) * (back ? 0.6 : 1);
    ps.spawn(P.SPARK, X, Y, Math.cos(a) * v, Math.sin(a) * v - 50, R.range(0.15, 0.5), WHITE, 1, R.chance(0.3) ? R.range(0, 0.04) : 0);
  }
  // shards: bright splinters that tumble down, bounce and settle
  for (let i = 0; i < 10; i++) {
    const a = A + R.range(-1, 1) * 1.1 - 0.35, v = R.range(110, 280);
    bits.add({ kind: B.SHARD, x: X, y: Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 0.8, drag: 0.7, bounce: 0.35, life: R.range(0.55, 0.85), a: R.range(0, TAU), va: R.range(-25, 25), s: R.range(2, 4.5), c: R.pick([C[7], C[6], C[6], C[5]]) });
  }
  // embers of light drifting up and off, and glints that pop round the ring after the hit
  for (let i = 0; i < 12; i++) {
    const a = A - Math.PI / 2 + R.range(-1.4, 1.4), v = R.range(35, 110);
    ps.spawn(P.MOTE, X + Math.cos(a) * 4, Y + Math.sin(a) * 4, Math.cos(a) * v, Math.sin(a) * v - 15, R.range(0.35, 0.7), R.pick([C[6], C[5], C[5]]), 0.6, R.range(0, 0.05));
  }
  for (let i = 0; i < 5; i++) {
    const a = R.range(0, TAU), d = R.range(14, 34);
    ps.spawn(P.STAR, X + Math.cos(a) * d, Y + Math.sin(a) * d * 0.8, 0, -4, R.range(0.22, 0.38), R.chance(0.5) ? C[6] : WHITE, R.range(1.6, 3), R.range(0.08, 0.32));
  }

  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      bits.update(dt);
      lights.update(dt);
    },
    draw(p) {
      // the ring: it swells off the star, then breaks into arcs that fly on and cool
      const u = clamp((t - 0.03) / 0.37);
      if (t >= 0.03 && u < 1) {
        const r = 10 + 30 * ease.outCubic(u), brk = smooth(0.12, 0.6, u), th = Math.max(1, 3.6 * Math.pow(1 - u, 1.2));
        const i = u < 0.12 ? 7 : u < 0.3 ? 6 : u < 0.5 ? 5 : u < 0.75 ? 4 : 3;
        brokenRing(p, X, Y, r, th, segs, brk, C[i], C[Math.max(2, i - 2)], u < 0.6 ? 1 : (1 - u) / 0.4, 1, 0);
        if (u < 0.6) p.glowRing(X, Y, r, 6, C[5], 0.35 * Math.pow(1 - u / 0.6, 2));
      }
      bits.draw(p);
      ps.draw(p);
      // the flare blooms as the star collapses
      const f = (t - 0.04) / 0.28;
      if (f > 0 && f < 1) {
        flare(p, X, Y, 64 * Math.pow(1 - f, 1.3), 1 - f, C);
        p.glow(X, Y, 56, C[5], 0.4 * (1 - f));
      }
      // the starburst slams in: a white frame, an overshoot, a settle, then it breaks up
      for (let i = 0; i < KEYS.length - 1; i++)
        if (t >= KEYS[i][0] && t < KEYS[i + 1][0]) {
          const [, sc, th, a, cols] = KEYS[i];
          star(p, X, Y, sp, sc, th, cols.map((j) => C[j]), a, 2.6);
        }
      const pop = Math.exp(-t / 0.05);
      if (pop > 0.02) {
        p.glow(X, Y, 44, C[5], 0.4 * pop);
        p.glow(X, Y, 12, WHITE, 0.6 * pop);
      }
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/impacts/ground-slam.js"] = function(exports, __req) {
// The rocks, grit, rolling floor dust and dust column are adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Bits, Lights, P, PF, B, Rng, fit, band, clamp, smooth, ease, TAU, WHITE, mix  } = __req("core/index.js");
const {  stone, star, makeCracks, drawCracks, frontCrescent, rock, rockShape, SOOT  } = __req("fx/impacts/_lib.js");

const meta = {
  name: "Ground slam",
  desc: "Something lands hard: the floor flashes and cracks, two crescent shock waves race out along it, a dust wave and a tall dust cloud rise, rocks erupt, bounce and settle.",
  tags: ["impact", "ground", "slam", "shockwave", "quake", "rocks", "dust", "one-shot"],
  size: [288, 208],
  origin: [144, 164],
  duration: 3.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#2a1712", "#5e2c1c", "#a4502a", "#e8893a", "#ffc764", "#fff0b4", "#ffffff"], stone: "#4a3f69", reach: 104, seed: 5 },
};

const WAVE = 0.6; // seconds for the shock fronts to run out

// the dent: the floor's edge caves into a shallow dish, its bottom glowing while hot, lips thrown up either side
function crater(p, st, hot, C, k) {
  for (let x = -12; x <= 11; x++) {
    const q = Math.abs(x + 0.5) / 12, dep = Math.round(2.6 * (1 - q * q));
    if (q < 0.84) {
      for (let y = 0; y < dep; y++) p.dot(x, y, SOOT, k);
      p.dot(x, dep, hot > 0.5 ? C[5] : hot > 0.2 ? C[4] : st.lip, k);
    } else {
      p.dot(x, -1, q > 0.93 ? st.light : st.lip, k);
      if (q < 0.9) p.dot(x, -2, st.light, k * 0.8);
    }
  }
}

function create(o) {
  const C = fit(o.palette, 7), st = stone(o.stone), REACH = o.reach, R = new Rng(o.seed), floor = () => 0, D = meta.duration;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[3]] });
  const bits = new Bits({ ground: floor }), lights = new Lights(), HOT = [WHITE, C[5], C[4], C[3]];
  const dustLit = mix(st.dust, WHITE, 0.2), cracks = makeCracks(R, 10, { len: [22, 58], dive: 0.55, maxY: 22, forks: 0.7, x0: [2, 9] });
  const front = (t) => 7 + (REACH - 7) * ease.outCubic(clamp((t - 0.015) / WAVE));
  const heat = (t) => Math.pow(clamp(1 - t / 0.8), 1.4);
  const crest = (u) => [6 + 28 * Math.pow(1 - u, 0.75), 1.5 + 5 * Math.pow(1 - u, 0.9)]; // a front's height and thickness
  // the flash: a flat half-star hugging the floor, long rays along it, short ones up
  const burst = [
    { a: -0.07, len: R.range(34, 40), w: 1.9 }, { a: Math.PI + 0.07, len: R.range(34, 40), w: 1.9 },
    { a: -0.42 + R.range(-0.08, 0.08), len: R.range(15, 20), w: 1.5 }, { a: -Math.PI + 0.42 + R.range(-0.08, 0.08), len: R.range(15, 20), w: 1.5 },
    { a: -Math.PI / 2 + R.range(-0.15, 0.15), len: R.range(18, 24), w: 1.7 },
    { a: -1.05 + R.range(-0.1, 0.1), len: R.range(10, 14), w: 1.2 }, { a: -Math.PI + 1.05 + R.range(-0.1, 0.1), len: R.range(10, 14), w: 1.2 },
  ];
  // embers caught in the cracks, flickering as they cool
  const embers = [];
  for (const c of cracks)
    for (const [x, y, d] of c.pts) if (d > 3 && d < 32 && R.chance(0.25)) embers.push({ x, y, d, life: R.range(0.8, 2.2), ph: R.range(0, TAU) });

  // contact: light floods out, sparks fly off the stone and skitter along the floor
  lights.add(0, -12, 96, C[4], 0.6, 0.6);
  lights.add(0, -4, 50, WHITE, 0.9, 0.14);
  for (let i = 0; i < 56; i++) {
    const low = i < 14, s = R.sign(), a = low ? (s > 0 ? -R.range(0.04, 0.6) : Math.PI + R.range(0.04, 0.6)) : -Math.PI / 2 + R.range(-1.15, 1.15);
    const sp = low ? R.range(150, 380) : R.range(200, 500);
    ps.spawn(P.SPARK, R.range(-4, 4), -1, Math.cos(a) * sp, Math.sin(a) * sp, low ? R.range(0.2, 0.5) : R.range(0.25, 0.65), WHITE, 1, low ? 0 : R.range(0, 0.05));
  }
  // rocks erupt from the dent: three heavy ones that barely clear it, the rest thrown high
  for (let i = 0; i < 20; i++) {
    const s = i < 3 ? 4 : R.int(1, 3), a = -Math.PI / 2 + R.range(-0.5, 0.5), sp = s > 3 ? R.range(110, 190) : R.range(170, 380) * (s > 2 ? 0.8 : 1);
    bits.add({ kind: B.CHUNK, x: R.range(-7, 7), y: -2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1, drag: 0.4, bounce: 0.38, life: R.range(1.9, 2.7), a: R.range(0, TAU), va: R.range(-14, 14), s, pts: rockShape(R), pvy: 0 });
  }
  // grit: a fan of floor bits that bounce once and settle
  for (let i = 0; i < 110; i++) {
    const u = R.range(-1, 1), a = -Math.PI / 2 + u * 0.65, sp = R.range(110, 380) * (1 - 0.35 * Math.abs(u));
    ps.spawn(P.GRIT, u * 6, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1, 2.2), R.pick([st.light, st.body, st.body, st.shade, st.shade, st.lip]), R.chance(0.35) ? 2 : 1);
  }
  // the dust cloud: a column that shoots up and spreads at the top, lit on top, and a heavy bank at its foot
  for (let i = 0; i < 28; i++) {
    const core = i < 14, s = R.sign();
    ps.spawn(P.SMOKE, core ? R.range(-5, 5) : s * R.range(4, 12), -R.range(2, 10), core ? R.range(-12, 12) : s * R.range(14, 38), -R.range(50, 130) * (core ? 1 : R.range(0.3, 0.6)), R.range(1.9, 2.7), R.chance(0.35) ? dustLit : st.dust, core ? R.range(4.5, 9) : R.range(4, 7.5), R.range(0.02, 0.22), PF.BIG);
  }
  for (let i = 0; i < 10; i++) {
    const s = R.sign();
    ps.spawn(P.SMOKE, s * R.range(2, 14), -R.range(2, 6), s * R.range(20, 70), -R.range(4, 20), R.range(1.4, 2.3), st.dust, R.range(6, 9), R.range(0, 0.08), PF.BIG);
  }
  // fine dust settling out of the cloud while it hangs
  for (let i = 0; i < 26; i++)
    ps.spawn(P.FLAKE, R.range(-22, 22), -R.range(14, 80), R.range(-12, 12), R.range(-10, 4), R.range(1.2, 2), R.chance(0.5) ? st.lip : dustLit, R.range(0.5, 1.2), R.range(0.25, 1));

  let t = 0;
  const acc = [R.next(), R.next()];
  const ring = (p, back) => {
    const u = clamp((t - 0.015) / (WAVE + 0.1));
    if (t < 0.015 || u >= 0.9) return;
    band(p, 0, 0.5, front(t) + 1, 0.16, Math.max(1, 4 * Math.pow(1 - u, 0.8)), u < 0.55 ? 1.1 : (0.9 - u) / 0.35,
      u < 0.35 ? [C[3], C[4], C[5], C[6]] : [st.body, st.light, C[4], C[5]], (g) => Math.sin(g) < 0 === back, t < 0.09);
  };
  const fronts = (p) => {
    const u = clamp((t - 0.03) / (WAVE + 0.16));
    if (t < 0.03 || u >= 1) return;
    const fr = front(t), [h, w] = crest(u), k = u < 0.7 ? 1 : (1 - u) / 0.3;
    const cols = u < 0.14 ? [WHITE, C[6], C[5]] : u < 0.34 ? [C[6], C[5], C[4]] : u < 0.55 ? [C[5], C[4], st.lip] : [st.lip, st.light, st.dust];
    for (const s of [-1, 1]) {
      frontCrescent(p, s * fr, s, h, w, cols, k);
      p.glow(s * fr, -h * 0.3, 8 + h * 0.7, C[4], 0.5 * (1 - u) * k);
    }
  };

  return {
    update(dt) {
      t += dt;
      // dust kicked up behind the racing fronts, and spray off their crests
      const u = clamp((t - 0.015) / WAVE);
      if (u > 0 && u < 1) {
        const fr = front(t), [h] = crest(u);
        for (let k = 0; k < 2; k++) {
          const s = k ? 1 : -1;
          for (acc[k] += dt * 120 * (1 - u * 0.7); acc[k] > 1; acc[k]--) {
            ps.spawn(P.SMOKE, s * (fr - R.range(1, 7)), -R.range(0.5, 3), s * R.range(15, 70) * (1 - u), -R.range(2, 12), R.range(1, 2.1), R.chance(0.3) ? dustLit : st.dust, R.range(2.5, 6.5) * (1 - 0.4 * u), 0, PF.BIG);
            if (R.chance(0.5)) ps.spawn(P.DUST, s * (fr - R.range(0, 3)), -R.range(0.3, 0.9) * h, s * R.range(-15, 25), -R.range(8, 35), R.range(0.3, 0.6), R.chance(0.5) ? dustLit : st.dust, R.range(1.2, 2.4));
            if (R.chance(0.4)) ps.spawn(P.GRIT, s * fr, -1, s * R.range(10, 60), -R.range(40, 140) * (1 - u), R.range(0.5, 1), R.pick([st.light, st.body, st.lip]), 1);
            if (u < 0.45 && R.chance(0.2)) ps.spawn(P.SPARK, s * fr, -1, s * R.range(60, 200), -R.range(30, 160), R.range(0.12, 0.3));
          }
        }
      }
      for (const b of bits.list) b.pvy = b.vy;
      bits.update(dt);
      // rocks that land hard kick up dust
      for (const b of bits.list)
        if (b.pvy > 70 && b.vy <= 0) {
          const n = b.pvy > 200 ? 3 : 2;
          for (let i = 0; i < n; i++) ps.spawn(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, R.sign() * R.range(8, 35), -R.range(2, 16), R.range(0.3, 0.65), st.dust, R.range(1.3, 2.4) * (0.7 + b.s * 0.25));
          b.pvy = 0;
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const fade = 1 - smooth(D - 0.9, D - 0.15, t), H = heat(t);
      if (t > 0.02) crater(p, st, H, C, fade);
      drawCracks(p, cracks, (c) => c.len * ease.outCubic(clamp((t - c.t0) / 0.1)), (d) => H * clamp(1.2 - d / 40), HOT, SOOT, st.light, fade);
      for (const e of embers) {
        const k = 1 - (t - 0.1) / e.life;
        if (t < 0.1 || k <= 0) continue;
        const f = 0.6 + 0.4 * Math.sin(t * 23 + e.ph);
        p.px(e.x, e.y, k * f > 0.55 ? C[5] : k * f > 0.25 ? C[4] : C[3]);
        p.glow(e.x, e.y, 4, C[4], 0.35 * k * f);
      }
      ring(p, true);
      ps.draw(p, "back");
    },
    draw(p) {
      ring(p, false);
      fronts(p);
      for (const b of bits.list) rock(p, b, st);
      ps.draw(p, "front");
      if (t < 0.035) {
        p.ellipse(0, 0, 30, 4.5, (d) => (d > 0.8 ? C[4] : d > 0.5 ? C[6] : WHITE));
        star(p, 0, -1, burst, 1, 1, [C[4], C[6], WHITE, WHITE]);
      } else if (t < 0.07) star(p, 0, -1, burst, 1.25, 0.5, [C[3], C[5], C[6], WHITE]);
      // the floor flashes along its length, then the dent glows while the cracks are hot
      if (t < 0.14) p.glowLine(-80, 0, 80, 0, 10, C[5], 0.55 * (1 - t / 0.14));
      const H = heat(t);
      if (H > 0) p.glow(0, 1, 46, C[4], 0.35 * H);
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/impacts/blunt-hit.js"] = function(exports, __req) {
// The clods and the dust they kick up are adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Bits, Lights, B, Rng, fit, clamp, ease, TAU, WHITE, mix, hex  } = __req("core/index.js");
const {  stone, rock, rockShape  } = __req("fx/impacts/_lib.js");

const meta = {
  name: "Blunt hit",
  desc: "A heavy, soft thud: a white-hot lumpy blob cools to cream in a warm pool of light, inked wedges jab out and snap back, a squashed ring of dust puffs swells and drifts, clods drop.",
  tags: ["impact", "hit", "blunt", "punch", "club", "thump", "dust", "comic", "one-shot"],
  size: [128, 88],
  origin: [64, 72],
  duration: 0.9,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1d1620", "#4a3a3c", "#7d6a66", "#b09c90", "#dccab4", "#f6ead2", "#ffffff"], warm: "#ffc98a", dust: "#b7a8a6", clod: "#6e5a5a", height: 22, seed: 9 },
};

// a lumpy outline: radius at angle a for a blob of radius r
const lump = (r, a, ph) => r * (1 + 0.15 * Math.sin(5 * a + ph) + 0.08 * Math.sin(9 * a + ph * 2.3));

function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), X = 0, Y = -o.height, PH = R.range(0, TAU), floor = () => 0;
  const WARM = hex(o.warm), DUST = hex(o.dust), st = stone(o.clod);
  const lights = new Lights(), bits = new Bits({ ground: floor });
  // a warm pool of light, a white-hot heart, and a glow on the floor below
  lights.add(X, Y, 48, WARM, 0.6, 0.4);
  lights.add(X, Y, 16, WHITE, 0.6, 0.07);
  lights.add(X, -2, 36, WARM, 0.25, 0.4);
  // inked wedges: each jabs out at its own length and pace, then snaps back
  const wedges = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * TAU + R.range(-0.2, 0.2), len: R.range(6, 15), w: R.range(3.2, 5), r0: R.range(13, 16), t0: R.range(0.015, 0.04), out: R.range(0.04, 0.06), back: R.range(0.09, 0.14) }));
  // the squash ring: soft puffs flung out from the blob's rim, wider than tall, each its own size, pace and life
  const puffs = Array.from({ length: 30 }, (_, i) => {
    const a = (i / 30) * TAU + R.range(-0.12, 0.12), side = Math.abs(Math.cos(a)), v = R.range(40, 140) * (0.6 + 0.5 * side);
    return { x: X + Math.cos(a) * 9, y: Y + Math.sin(a) * 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, r: R.range(2.4, 6.2) * (0.75 + 0.35 * side), life: R.range(0.35, 0.85), max: 0, t0: R.range(0.03, 0.1), lift: R.range(4, 16) };
  });
  // and a few that billow up off the top and hang longer
  for (let i = 0; i < 5; i++)
    puffs.push({ x: X + R.range(-6, 6), y: Y - R.range(3, 6), vx: R.range(-30, 30), vy: -R.range(20, 45), r: R.range(3.5, 5.5), life: R.range(0.6, 0.85), max: 0, t0: R.range(0.05, 0.1), lift: R.range(14, 24) });
  for (const q of puffs) q.max = q.life;
  // heavier clods knocked loose: they arc out, drop to the floor, bounce once and settle
  for (let i = 0; i < 5; i++) {
    const s = R.sign(), a = -Math.PI / 2 + s * R.range(0.5, 1.3), v = R.range(70, 140);
    bits.add({ kind: B.CHUNK, x: X + s * R.range(4, 8), y: Y + R.range(-3, 3), vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1, drag: 0.6, bounce: 0.28, life: R.range(0.65, 0.85), a: R.range(0, TAU), va: s * R.range(8, 16), s: R.chance(0.4) ? 2 : 1, pts: rockShape(R), pvy: 0 });
  }
  const kicks = [];

  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const q of puffs) {
        if (t < q.t0) continue;
        q.life -= dt;
        q.vx -= q.vx * 4.5 * dt;
        q.vy -= q.vy * 4.5 * dt + (q.lift ?? 6) * dt; // they slow, and lift a little as they thin
        q.x += q.vx * dt;
        q.y += q.vy * dt;
      }
      for (const b of bits.list) b.pvy = b.vy;
      bits.update(dt);
      // a clod hitting the floor kicks a little dust
      for (const b of bits.list)
        if (b.pvy > 60 && b.vy <= 0) {
          for (let i = 0; i < 2; i++) kicks.push({ x: b.x, y: -1, vx: R.sign() * R.range(8, 22), vy: -R.range(3, 10), r: R.range(1.2, 2), life: 0.4, max: 0.4, t0: 0 });
          b.pvy = 0;
        }
      for (const q of kicks) {
        q.life -= dt;
        q.vx -= q.vx * 4 * dt;
        q.vy -= q.vy * 4 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
      }
      lights.update(dt);
    },
    draw(p) {
      // dust: each puff swells and thins, warm-lit at first, its top catching the light
      for (const q of [...puffs, ...kicks]) {
        const k = q.life / q.max;
        if (t < q.t0 || k <= 0) continue;
        const r = q.r * (0.7 + (1 - k) * 0.85), a = Math.pow(k, 1.25) * Math.min(1, (t - q.t0) / 0.03), c = mix(DUST, WARM, clamp(1 - (t - 0.03) / 0.25) * 0.55);
        p.disc(q.x, q.y, r, c, (d) => 0.58 * a * (1 - d * d * 0.75));
        p.disc(q.x - r * 0.22, q.y - r * 0.32, r * 0.58, mix(c, WHITE, 0.55), (d) => 0.48 * a * (1 - d * d));
      }
      for (const b of bits.list) rock(p, b, st);
      // the blob: white-hot and lumpy for a frame, then cream and a little bigger, then gone into the dust
      if (t < 0.058) {
        const f = t < 0.025 ? 0 : 1, R0 = f ? 13.5 : 11.5;
        p.shade(X - R0 * 1.4, Y - R0 * 1.4, X + R0 * 1.4, Y + R0 * 1.4, (x, y) => {
          const dx = x - X, dy = (y - Y) * (f ? 1.25 : 1.1), d = Math.hypot(dx, dy), ro = lump(R0, Math.atan2(dy, dx), PH + f * 0.6);
          if (d > ro) return;
          const q = d / ro;
          return f === 0 ? (q < 0.55 ? WHITE : q < 0.86 ? C[5] : C[4]) : q < 0.3 ? WHITE : q < 0.72 ? C[5] : q < 0.9 ? C[4] : C[3];
        });
      }
      // inked wedges jab out from the blob and snap back
      for (const w of wedges) {
        const u = t - w.t0;
        if (u < 0 || u > w.out + w.back) continue;
        const s = u < w.out ? ease.outCubic(u / w.out) : 1 - ease.inQuad((u - w.out) / w.back), L = w.len * s;
        if (L < 1.5) continue;
        const ca = Math.cos(w.a), sa = Math.sin(w.a), r0 = w.r0 + 2 * s, hw = (w.w * (0.6 + 0.4 * s)) / 2;
        const tip = [X + ca * r0, Y + sa * r0], end = [X + ca * (r0 + L), Y + sa * (r0 + L)], n = [-sa * hw, ca * hw];
        const wedge = (g) => [[tip[0] - ca * g, tip[1] - sa * g], [end[0] + n[0] * (1 + g * 0.45) + ca * g, end[1] + n[1] * (1 + g * 0.45) + sa * g], [end[0] - n[0] * (1 + g * 0.45) + ca * g, end[1] - n[1] * (1 + g * 0.45) + sa * g]];
        p.poly(wedge(1), C[1]);
        p.poly(wedge(0), u < w.out + 0.02 ? WHITE : C[5]);
      }
      const pop = Math.exp(-t / 0.06);
      if (pop > 0.02) p.glow(X, Y, 28, WARM, 0.5 * pop);
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/impacts/hit-spark.js"] = function(exports, __req) {
// The two-tone spark spray and the light pop are adapted from Sprite Fusion's open-source impact
// (https://www.spritefusion.com/pixel-art-vfx/impact), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, fit, WHITE  } = __req("core/index.js");

const meta = {
  name: "Hit spark",
  desc: "The everyday hit: a sharp, lopsided cross flare with one long ray along the blow round a white diamond core, then a cone of sparks and hot chips that fall and bounce.",
  tags: ["impact", "hit", "spark", "combat", "directional", "one-shot"],
  size: [136, 80],
  origin: [44, 64],
  duration: 0.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffe26b", "#fff3a6", "#ffffff"], height: 20, aim: 0.1, seed: 4 },
};

// one ray of the cross: fat at the root, a hair at the tip, white cooling outward; from..to draws a stretch of it
function ray(p, x, y, a, L, w, C, from = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let d = from * L; d <= L; d += 0.5) {
    const u = d / L, hw = w * Math.pow(1 - u, 1.6);
    const col = u < 0.3 ? WHITE : u < 0.62 ? C[5] : u < 0.88 ? C[4] : C[3];
    p.px(x + c * d, y + s * d, col);
    if (hw > 0.45) for (let o = 0.5; o <= hw; o += 0.5) for (const e of [-o, o]) p.px(x + c * d - s * e, y + s * d + c * e, u < 0.3 && o < 1 ? C[5] : C[4]);
  }
}

// the core: a crisp white diamond with a pale rim
function diamond(p, x, y, r, C) {
  for (let dy = -r - 1; dy <= r + 1; dy++)
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const m = Math.abs(dx) + Math.abs(dy);
      if (m <= r) p.px(x + dx, y + dy, WHITE);
      else if (m === r + 1) p.px(x + dx, y + dy, C[3]);
    }
}

function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), X = 0, Y = -o.height, A = o.aim, floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[2]] });
  const lights = new Lights();
  // the cross: a long thin ray along the blow, a stub behind, two unequal arms across, and a glint between
  const tilt = R.range(-0.08, 0.08);
  const rays = [
    { a: A + tilt, L: R.range(33, 37), w: 2.2 },
    { a: A + Math.PI + tilt, L: R.range(8, 10), w: 2.2 },
    { a: A - Math.PI / 2 + tilt, L: R.range(15, 18), w: 2.6 },
    { a: A + Math.PI / 2 + tilt, L: R.range(10, 12), w: 2.3 },
    { a: A - Math.PI / 4 + tilt, L: R.range(5, 7), w: 1 },
  ];

  lights.add(X, Y, 38, C[4], 0.35, 0.18);
  lights.add(X + Math.cos(A) * 10, Y + Math.sin(A) * 10, 22, C[5], 0.45, 0.1);
  lights.add(X, -2, 26, C[3], 0.22, 0.22);
  // a cone of sparks sprayed on along the blow: they fall, bounce off the floor and die
  for (let i = 0; i < 9; i++) {
    const a = A + R.range(-0.6, 0.6) - 0.15, v = R.range(170, 360);
    ps.spawn(P.SPARK, X + 1, Y, Math.cos(a) * v, Math.sin(a) * v - 40, R.range(0.25, 0.45), WHITE, 1, i > 6 ? R.range(0.01, 0.03) : 0);
  }
  // hot pixel chips knocked off, tumbling down to tick off the floor
  for (let i = 0; i < 6; i++) {
    const a = A + R.range(-1.1, 0.5) - 0.3, v = R.range(70, 170);
    ps.spawn(P.GRIT, X + 1, Y, Math.cos(a) * v, Math.sin(a) * v - R.range(30, 80), R.range(0.35, 0.45), R.pick([C[5], C[4], C[4], C[3]]), 1);
  }

  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      ps.draw(p);
      if (t < 0.025) {
        // the flash: the whole cross round the diamond
        for (const r of rays) ray(p, X, Y, r.a, r.L, r.w, C);
        diamond(p, X, Y, 4, C);
      } else if (t < 0.058) {
        // reaching further and thinning, the diamond still crisp
        for (const r of rays) ray(p, X, Y, r.a, r.L * 1.2, r.w * 0.55, C, 0.12);
        diamond(p, X, Y, 3, C);
      } else if (t < 0.092) {
        // only the long ray lingers, its root burning away
        const r = rays[0];
        ray(p, X, Y, r.a, r.L * 1.3, 0.6, [C[0], C[1], C[2], C[3], C[3], C[4]], 0.4);
      }
      const pop = Math.exp(-t / 0.045);
      if (pop > 0.02) {
        p.glow(X, Y, 22, C[4], 0.3 * pop);
        p.glow(X, Y, 7, WHITE, 0.15 * pop);
        p.glowLine(X, Y, X + Math.cos(A) * 26, Y + Math.sin(A) * 26, 4, C[5], 0.25 * pop);
      }
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/nature/acid-splash.js"] = function(exports, __req) {
// The drops that splat where they land are adapted from Sprite Fusion's open-source blood
// (https://www.spritefusion.com/pixel-art-vfx/blood), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, fit, sparkle, clamp, smooth, ease, noise, rand, TAU, WHITE, mix, hex  } = __req("core/index.js");
const {  Drops  } = __req("fx/nature/_lib.js");

const meta = {
  name: "Acid splash",
  desc: "A gob of acid bursts into a crown and spatters; it eats a glowing, smoking pit into the floor and boils down into it, spitting bright beads, pale steam curling off.",
  tags: ["nature", "acid", "poison", "splash", "liquid", "ground", "one-shot"],
  size: [184, 116],
  origin: [92, 100],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#0e140a", "#1c3010", "#2c5214", "#457e18", "#6aae1c", "#a0dc2a", "#dcff6a", "#f8ffd0"], seed: 6 },
};

const HIT = 0.3, Y0 = -62, V0 = 60, SPREAD = 0.4, DRY = 0.7, GONE = 2.2, W = 30, PIT = 5;

// a curl of steam: thin, pale, quick, fading as it goes
function wisp(p, q, t, col) {
  const age = t - q.t0, u = age / q.life;
  if (u < 0 || u >= 1) return;
  const head = q.rise * age, tail = Math.max(0, head - q.len), fade = smooth(0, 0.15, u) * (1 - smooth(0.4, 1, u));
  for (let h = tail; h <= head; h += 0.5) {
    const s = (h - tail) / Math.max(1, head - tail), x = q.x + q.amp * Math.sin(h * q.k + q.ph) * (0.2 + s) + q.drift * age;
    p.blend(x, q.y - h, col, fade * Math.sin(Math.PI * s) * 0.42);
  }
}

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0;
  const SCORCH = mix(C[0], hex("#140f0c"), 0.6), BURNT = mix(C[1], hex("#2a1a10"), 0.6), STEAM = mix(C[7], hex("#e8ece6"), 0.75);
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]] });
  const drops = new Drops(floor), lights = new Lights(), stains = [], wisps = [], pops = [];
  const spikes = Array.from({ length: 13 }, (_, i) => ({ a: (i / 13) * TAU + R.range(-0.18, 0.18), h: R.range(4, 10), r: R.range(0.85, 1.12), shed: false }));
  const rag = Array.from({ length: 80 }, (_, i) => rand(i, o.seed, 5) - 0.5);
  let t = 0, hit = false;
  // the pit it etches: wider as it spreads, deeper as it eats; the acid's level sinks into it as it boils away
  const pw = () => W * ease.outCubic(clamp((t - HIT) / SPREAD)) * 1.02;
  const pitD = () => PIT * ease.outCubic(clamp((t - HIT) / 1.1));
  const depth = (x) => {
    const w = pw(), d = Math.abs(x) / Math.max(1, w);
    return d >= 1 ? -1 : pitD() * Math.sqrt(1 - d * d) + rag[(Math.round(x) + 200) % 80] * 0.9;
  };
  const level = () => (t < HIT ? 0 : -1.6 + (PIT + 1.6) * ease.inQuad(smooth(DRY, GONE, t)));
  const width = () => {
    const L = level(), w = pw();
    return L <= 0 ? w : w * Math.sqrt(Math.max(0, 1 - (L / Math.max(0.1, pitD())) ** 2));
  };
  const heat = () => smooth(HIT, HIT + 0.3, t) * (1 - smooth(GONE - 0.3, GONE + 0.25, t));
  const gobY = () => Y0 + V0 * t + 0.5 * 950 * t * t;
  const crownR = () => 4 + 11 * ease.outCubic(clamp((t - HIT) / 0.16));
  const crownH = () => 5 * Math.sin(Math.PI * clamp((t - HIT) / 0.26));
  const spikeK = () => {
    const u = clamp((t - HIT - 0.015) / 0.26);
    return Math.sin(Math.PI * Math.pow(u, 0.6));
  };
  const tipOf = (s) => {
    const r = crownR() * s.r, h = crownH(), sn = Math.sin(s.a), sh = s.h * spikeK();
    const bx = Math.cos(s.a) * r, by = sn * r * 0.3 - h * (0.75 + 0.25 * Math.abs(sn));
    return [bx, by, bx + Math.cos(s.a) * sh * 0.55, by - sh];
  };
  const steam = (x, y, big) => wisps.push({ x, y, t0: t, life: Math.min(R.range(0.5, 0.9) * (big ? 1.3 : 1), meta.duration - 0.05 - t), rise: R.range(22, 32), len: R.range(5, 10) * (big ? 1.4 : 1), amp: R.range(1, 2.5), k: R.range(0.35, 0.6), ph: R.range(0, TAU), drift: R.range(-4, 4) });
  // the crown: a thin cup wall rising round the impact, a bright rim, spikes off the rim with beads on their tips
  const crown = (p, back) => {
    if (t < HIT || t > HIT + 0.27) return;
    const r = crownR(), h = crownH(), ry = r * 0.3;
    for (let x = Math.floor(-r); x <= Math.ceil(r); x++) {
      const c = (x + 0.5) / r;
      if (Math.abs(c) > 1) continue;
      const e = Math.sqrt(1 - c * c), yb = (back ? -ry : ry) * e, hh = h * (0.75 + 0.25 * e);
      for (let y = Math.floor(yb - hh); y <= Math.round(yb); y++) {
        const rim = y === Math.floor(yb - hh);
        if (rim) p.px(x, y, back ? C[5] : c < 0.1 ? C[7] : C[6]);
        else p.blend(x, y, C[(c < -0.25 ? 5 : c > 0.45 ? 3 : 4) - (back ? 1 : 0)], back ? 0.55 : 0.7);
      }
    }
    for (const s of spikes) {
      if (Math.sin(s.a) < 0 !== back) continue;
      const [bx, by, tx, ty] = tipOf(s);
      p.line(bx, by, tx, ty, back ? C[4] : C[6]);
      p.line(bx + 1, by, (bx + tx) / 2 + 0.5, (by + ty) / 2, back ? C[3] : C[5]);
      if (!s.shed) p.px(tx, ty - 1, back ? C[5] : C[7]), p.px(tx + 1, ty - 1, C[5]);
    }
  };

  return {
    update(dt) {
      t += dt;
      const f = Math.min(1, dt * 120), w = width();
      if (!hit && t >= HIT) {
        hit = true;
        lights.add(0, -4, 28, WHITE, 0.6, 0.08);
        lights.add(0, -10, 56, C[5], 0.5, 0.6);
        for (let i = 0; i < 26; i++) {
          const a = -Math.PI / 2 + R.range(-1.35, 1.35), sp = R.range(60, 250);
          drops.add(R.range(-3, 3), -2, Math.cos(a) * sp, Math.sin(a) * sp, R.chance(0.3) ? 2 : 1);
        }
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(120, 260);
          ps.spawn(P.SPARK, 0, -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.12, 0.3));
        }
        for (let i = 0; i < 5; i++) steam(R.range(-10, 10), -R.range(2, 6), true);
      }
      // beads break off the crown's spikes as they peak
      if (hit)
        for (const s of spikes)
          if (!s.shed && t > HIT + 0.09) {
            s.shed = true;
            const [, , tx, ty] = tipOf(s);
            drops.add(tx, ty - 1, Math.cos(s.a) * R.range(30, 80), -R.range(50, 130), R.chance(0.4) ? 2 : 1);
          }
      drops.update(dt, (d) => {
        // a drop that lands eats a little spot into the floor and hisses
        if (Math.abs(d.x) > pw()) stains.push({ x: d.x, t0: t, w: d.s * 0.8 + R.range(0.3, 1.2) });
        if (t < GONE) steam(d.x, -1, false);
      });
      // the acid sizzles: tiny bright beads spit off it, pops flash on its surface, steam curls off it and the pit
      const lv = level(), w2 = width();
      if (t > HIT + 0.15 && t < GONE && w2 > 2) {
        if (R.chance(0.3 * f)) {
          const x = R.range(-0.85, 0.85) * w2, y = Math.min(lv, depth(x)) - 1;
          pops.push({ x, y, t0: t });
          for (let j = 0; j < R.int(1, 3); j++) drops.add(x, Math.min(y - 1, -1), R.range(-40, 40), -R.range(50, 110), 1);
        }
        if (R.chance(0.14 * f)) steam(R.range(-0.9, 0.9) * w2, Math.min(lv, 0) - 1, R.chance(0.25));
      }
      // the pit keeps smoking a while after the acid is gone
      if (t > GONE - 0.2 && t < meta.duration - 0.5 && R.chance(0.08 * f)) steam(R.range(-0.7, 0.7) * pw(), 0, false);
      for (let i = pops.length - 1; i >= 0; i--) if (t - pops[i].t0 > 0.1) pops.splice(i, 1);
      for (let i = wisps.length - 1; i >= 0; i--) if (t - wisps[i].t0 > wisps[i].life) wisps.splice(i, 1);
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const fade = 1 - smooth(meta.duration - 0.6, meta.duration - 0.08, t), hk = heat(), w = pw(), lv = level();
      // spatter spots etched round it
      for (const s of stains) {
        const age = t - s.t0, k = 1 - smooth(1, 1.8, age), c = age < 0.15 ? C[7] : age < 0.5 ? C[6] : age < 0.9 ? C[4] : BURNT;
        for (let x = Math.floor(s.x - s.w); x <= Math.ceil(s.x + s.w); x++) p.dot(x, 0, Math.abs(x - s.x) < s.w * 0.5 ? SCORCH : c, k * fade);
        if (age < 0.5) p.glow(s.x, -1, 5, C[5], 0.3 * (1 - age / 0.5));
      }
      crown(p, true);
      if (t > HIT && w > 1) {
        // the pit: an etched bowl in the floor, its edge glowing where the acid is still eating, cooling to a burnt lip
        for (let x = Math.floor(-w) - 1; x <= Math.ceil(w) + 1; x++) {
          const dp = depth(x + 0.5);
          if (dp < 0) continue;
          const bottom = Math.max(0, Math.round(dp)), edge = Math.abs(x + 0.5) / w > 0.88;
          for (let y = 0; y <= bottom; y++) p.dot(x, y, y === bottom ? (hk > 0.5 ? C[6] : hk > 0.15 ? C[4] : BURNT) : SCORCH, fade);
          p.dot(x, bottom + 1, hk > 0.5 ? C[5] : hk > 0.15 ? C[3] : SCORCH, fade * 0.8);
          if (edge) p.dot(x, -1, hk > 0.4 ? C[7] : hk > 0.1 ? C[5] : BURNT, fade);
        }
        for (const sd of [-1, 1]) p.glow(sd * w, -1, 8, C[6], 0.45 * hk);
        // the acid in it: a bright skin shimmering on top, darker as it deepens, sinking as it boils off
        if (t < GONE)
          for (let x = Math.floor(-w); x <= Math.ceil(w); x++) {
            const dp = depth(x + 0.5);
            if (dp < 0) continue;
            const d = Math.abs(x + 0.5) / w, dome = lv < 0 ? Math.round(lv * Math.sqrt(Math.max(0, 1 - d * d))) : Math.round(lv), bottom = Math.round(dp);
            if (dome > bottom) continue;
            const n = noise(x * 0.25 - t * 2.4, 3) + noise(x * 0.1 + t * 1.4, 5) * 0.6;
            for (let y = dome; y <= bottom; y++) p.px(x, y, y === dome ? (n > 0.7 ? C[7] : C[6]) : y === dome + 1 ? (n > 0.2 ? C[5] : C[4]) : y >= bottom ? C[3] : C[4]);
          }
        p.glow(0, -6, w * 1.4 + 10, C[4], 0.3 * hk * (0.85 + 0.15 * Math.sin(t * 9)));
        p.glow(0, 1, w * 0.9, C[6], 0.2 * hk);
      }
      ps.draw(p, "back");
    },
    draw(p) {
      // the gob: a teardrop stretched by its fall, lit on its upper left, a trail of droplets above it
      if (t < HIT) {
        const y = gobY(), v = V0 + 950 * t, st = 1 + v * 0.0022, rx = 2.6 / Math.sqrt(st), ry = 2.8 * st;
        p.shade(-rx - 1, y - ry - 4, rx + 1, y + ry + 1, (x, yy, out) => {
          const dx = x / rx, dy = (yy - y) / ry, tail = dy < 0 && Math.abs(x) < rx * (1 + dy * 0.9) + 0.4 && dy > -1.7;
          const d = dx * dx + dy * dy;
          if (d > 1.25 && !tail) return;
          out.c = d > 1 && !tail ? C[2] : dx < -0.2 && dy < -0.1 ? C[7] : dy > 0.45 ? C[4] : C[5];
        });
        p.px(-1, y - ry * 0.3, WHITE);
        for (let i = 1; i <= 3; i++) p.dot(0, y - ry - 2 - i * 4, C[5], 1 - i * 0.25);
        p.glow(0, y, 10, C[5], 0.45);
      }
      crown(p, false);
      // the hero frame: a white burst where it lands
      const e = t - HIT;
      if (e >= 0 && e < 0.07) {
        const k = 1 - e / 0.07;
        p.ellipse(0, -2, 6 + 6 * (1 - k), 2.5, k > 0.5 ? WHITE : C[7]);
        sparkle(p, 0, -4, 8 * k, C[7], C[6], 0.6);
      }
      // sizzle: tiny star flashes where beads spit off the surface
      for (const q of pops) {
        const k = (t - q.t0) / 0.1;
        p.px(q.x, q.y, WHITE);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) p.dot(q.x + dx * (1 + k * 2), q.y + dy * (1 + k * 2), C[7], 1 - k);
        p.glow(q.x, q.y, 4, C[6], 0.4 * (1 - k));
      }
      for (const q of wisps) wisp(p, q, t, STEAM);
      drops.draw(p, C);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/nature/_lib.js"] = function(exports, __req) {
// Shared by the nature effects: faceted stones that tumble and break, the stone spike they break from, leaves,
// droplets, bubbles and gas. The gas (puffs that drift off their push, rise, swell and thin, a lit cap) is adapted
// from Sprite Fusion's open-source poison (https://www.spritefusion.com/pixel-art-vfx/poison), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  TAU, WHITE, GRAVITY, rand, clamp  } = __req("core/index.js");

/** Corners of an irregular stone, unit size, in angular order. */
function stoneShape(R, n = R.int(5, 7)) {
  const pts = [], a0 = R.range(0, TAU), squash = R.range(0.7, 1);
  for (let i = 0; i < n; i++) {
    const a = a0 + ((i + R.range(-0.28, 0.28)) * TAU) / n, r = R.range(0.72, 1.12);
    pts.push([Math.cos(a) * r, Math.sin(a) * r * squash]);
  }
  return pts;
}

const LX = -0.6, LY = -0.8;
const inPoly = (V, x, y) => {
  let inside = false;
  for (let i = 0, j = V.length - 1; i < V.length; j = i++) {
    const [xi, yi] = V[i], [xj, yj] = V[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const MASK = new Uint8Array(64 * 64), FACE = new Int8Array(64 * 64), ROWS = 400, RL = new Float32Array(ROWS), RR = new Float32Array(ROWS), RU = new Float32Array(ROWS);

/**
 * A faceted stone at (x, y): corners pts (from stoneShape) scaled by s and turned by a. Each wedge between
 * neighbouring corners is a facet, lit by how squarely it faces the top left; edges facing the light catch a
 * bright rim, a dark rim goes round the rest. S: stone ramp, dark to bright (7+ steps). alpha dithers it out.
 */
function drawRock(p, x, y, s, a, pts, S, alpha = 1, white = false) {
  const n = S.length, top = n - 2, ca = Math.cos(a), sa = Math.sin(a);
  if (s < 1.4) {
    p.dot(x, y, S[top - 1], alpha);
    p.dot(x + 1, y, S[top - 3], alpha);
    return;
  }
  const V = pts.map(([u, v]) => [(u * ca - v * sa) * s, (u * sa + v * ca) * s]);
  const ang = V.map(([vx, vy]) => Math.atan2(vy, vx));
  // each facet's light: its edge's outward normal against the light
  const lit = V.map(([ax, ay], i) => {
    const [bx, by] = V[(i + 1) % V.length], ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey) || 1;
    let nx = ey / l, ny = -ex / l;
    if (nx * (ax + bx) + ny * (ay + by) < 0) (nx = -nx), (ny = -ny);
    return nx * LX + ny * LY;
  });
  const X0 = Math.floor(x) - Math.ceil(s * 1.25) - 1, Y0 = Math.floor(y) - Math.ceil(s * 1.25) - 1, N = Math.min(62, 2 * Math.ceil(s * 1.25) + 3);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dx = X0 + i + 0.5 - x, dy = Y0 + j + 0.5 - y, k = j * 64 + i;
      MASK[k] = inPoly(V, dx, dy) ? 1 : 0;
      if (!MASK[k]) continue;
      const g = Math.atan2(dy, dx);
      let f = 0;
      for (let q = 0; q < ang.length; q++) {
        const a0 = ang[q], a1 = ang[(q + 1) % ang.length];
        let d = (g - a0) % TAU, span = (a1 - a0) % TAU;
        if (d < 0) d += TAU;
        if (span < 0) span += TAU;
        if (d <= span) {
          f = q;
          break;
        }
      }
      FACE[k] = f;
    }
  const at = (i, j) => i >= 0 && j >= 0 && i < N && j < N && MASK[j * 64 + i] === 1;
  for (let j = -1; j <= N; j++)
    for (let i = -1; i <= N; i++) {
      const X = X0 + i, Y = Y0 + j;
      if (!at(i, j)) {
        if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) p.dot(X, Y, S[0], alpha);
        continue;
      }
      if (white) {
        p.dot(X, Y, WHITE, alpha);
        continue;
      }
      const L = lit[FACE[j * 64 + i]], edge = !at(i - 1, j) || !at(i + 1, j) || !at(i, j - 1) || !at(i, j + 1);
      let c = L > 0.55 ? S[top] : L > 0.15 ? S[top - 1] : L > -0.3 ? S[top - 2] : S[top - 3];
      if (edge) c = L > 0.3 ? S[top + 1] : L < -0.2 ? S[Math.max(1, top - 4)] : c;
      p.dot(X, Y, c, alpha);
    }
}

/**
 * A faceted stone spike standing on (x, base): h tall, w wide at the base, its tip `lean` px over. A ridge
 * splits a lit left face from a shaded right face; strata step across both; notches chip the edges; a dark
 * rim goes round it. sp: { notches: [{ u, side, d }], strata: [u], slope } from spikeLook(). S: stone ramp
 * (8 steps). opts: { a, white, glint (0..1 height of a sweeping highlight, or -1), clip (draw only u < clip, with a
 * ragged edge), half (-1 or 1: only the part left or right of the ridge), floor (draw nothing below this y),
 * cracks: [[[u, v], ...], ...] with crack (0..1 of each drawn), heat (0..1: cracks glow) and glowRamp }.
 */
function drawSpike(p, x, base, h, w, lean, sp, S, opts = {}) {
  if (h < 1.5) return;
  const a = opts.a ?? 1, white = opts.white, glint = opts.glint ?? -1, clip = opts.clip ?? 1, floorY = opts.floor ?? Infinity;
  const hw = (u, side) => {
    let v = (w / 2) * Math.pow(Math.max(0, 1 - u), 0.85) + 0.3;
    for (const n of sp.notches) if (n.side === side && u > n.u && u < n.u + 0.07) v -= n.d * (1 - u * 0.5);
    return Math.max(0, v);
  };
  const half = opts.half ?? 0, Y0 = Math.floor(base - h) - 2, NR = Math.min(ROWS, Math.ceil(base) - Y0 + 2);
  // each row's edges, once
  for (let k = 0; k < NR; k++) {
    const u = (base - (Y0 + k + 0.5)) / h;
    RU[k] = u;
    if (u < 0 || u > 1 || Y0 + k + 0.5 > floorY) (RL[k] = Infinity), (RR[k] = -Infinity);
    else (RL[k] = x + lean * u - hw(u, -1)), (RR[k] = x + lean * u + hw(u, 1));
  }
  const inside = (px, py) => {
    const k = py - Y0, fx = px + 0.5;
    if (k < 0 || k >= NR || fx < RL[k] || fx > RR[k]) return false;
    if (clip < 1 && RU[k] > clip + (rand(px, 77) - 0.5) * 0.07) return false;
    if (!half) return true;
    const q = ((fx - RL[k]) / Math.max(0.5, RR[k] - RL[k])) * 2 - 1;
    return half < 0 ? q < -0.18 : q >= -0.18;
  };
  const X0 = Math.floor(x - w / 2 - Math.abs(lean) - 2), X1 = Math.ceil(x + w / 2 + Math.abs(lean) + 2);
  for (let py = Math.floor(base - h) - 1; py < Math.ceil(base); py++)
    for (let px = X0; px <= X1; px++) {
      if (!inside(px, py)) {
        if (py + 0.5 <= floorY && (inside(px - 1, py) || inside(px + 1, py) || inside(px, py + 1) || (inside(px, py - 1) && py < base - 1))) p.dot(px, py, S[0], a);
        continue;
      }
      if (white) {
        p.dot(px, py, WHITE, a);
        continue;
      }
      const k0 = py - Y0, u = RU[k0], c = x + lean * u, l = RL[k0], r = RR[k0], fx = px + 0.5;
      // which stratum this row sits in: facets jog sideways at each bedding plane, like stacked rock
      let band = 0, st = false;
      for (const s of sp.strata) {
        const d = u * h - s * h - sp.slope * (fx - c);
        if (d > 0) band++;
        if (Math.abs(d) < 0.5) st = true;
      }
      const jog = (rand(band, sp.seed) - 0.5) * 0.3, q = ((fx - l) / Math.max(0.5, r - l)) * 2 - 1, qr = -0.18 + jog;
      let i;
      if (u > 0.93) i = q < qr + 0.3 ? 7 : 5;
      else if (Math.abs(q - qr) < Math.max(0.09, 0.55 / Math.max(1, r - l))) i = 7;
      else if (q < qr) i = fx - l < 1 ? 7 : q < -0.5 + jog ? 6 : 5;
      else i = r - fx < 1 ? 3 : q < 0.38 + jog ? 4 : 2;
      if (st && i < 7) i -= 1;
      const fleck = rand(px * 7 + 3, py * 13 + 5);
      if (fleck < 0.035) i = q < qr ? 7 : i - 1;
      else if (fleck > 0.965) i -= 1;
      if (glint >= 0 && q < qr + 0.1) {
        const g = Math.abs(u - glint);
        if (g < 0.035) i = 8;
        else if (g < 0.07) i = Math.max(i, 7);
      }
      p.dot(px, py, i >= 8 ? WHITE : S[clamp(i, 0, S.length - 1)], a);
    }
  // cracks spreading over it, a lit lip on one side of each
  if (opts.cracks && opts.crack > 0)
    for (const path of opts.cracks) {
      const m = Math.max(1, Math.floor(path.length * opts.crack));
      for (let k = 1; k < m; k++) {
        const [u0, v0] = path[k - 1], [u1, v1] = path[k];
        const P = ([u, v]) => [x + lean * u + v * hw(u, v < 0 ? -1 : 1), base - u * h];
        const [ax, ay] = P([u0, v0]), [bx, by] = P([u1, v1]);
        if (u1 > clip) break;
        if (!inside(Math.floor(ax), Math.floor(ay)) || !inside(Math.floor(bx), Math.floor(by))) continue;
        const hot = opts.heat ?? 0, Gl = opts.glowRamp;
        if (hot > 0.05 && Gl) {
          // a seam of light inside the crack, a dark lip below it
          p.line(ax + 1, ay, bx + 1, by, S[0], a);
          p.line(ax, ay, bx, by, hot > 0.7 ? Gl[4] : hot > 0.4 ? Gl[3] : hot > 0.2 ? Gl[2] : Gl[1], a);
          if (k % 2 === 0) p.glow(bx, by, 7, Gl[2], 0.35 * hot);
        } else {
          p.line(ax, ay, bx, by, S[0], a);
          p.dot(bx + 1, by - 1, S[6], a * 0.7);
        }
      }
    }
}

/** The random look of one spike: notches on its edges, strata across it. */
function spikeLook(R) {
  const notches = [], strata = [];
  for (let i = 0, n = R.int(3, 5); i < n; i++) notches.push({ u: R.range(0.1, 0.8), side: R.sign(), d: R.range(0.8, 1.8) });
  for (let i = 0, n = R.int(2, 4); i < n; i++) strata.push(R.range(0.12, 0.8));
  return { notches, strata, slope: R.range(-0.25, 0.25), seed: R.int(1, 9999) };
}

/** A crack that branches up a spike: points [u (height 0..1), v (-1 left edge..1 right edge)]. */
function spikeCrack(R, u0, v0, dir) {
  const pts = [[u0, v0]];
  let u = u0, v = v0;
  for (let i = 0; i < 9; i++) {
    u += R.range(0.03, 0.08);
    v += dir * R.range(0.05, 0.28) + R.range(-0.12, 0.12);
    if (u > 0.95 || Math.abs(v) > 1) break;
    pts.push([u, v]);
  }
  return pts;
}

/** A jagged floor crack from x = 0 out to side * len: points [x, y], y 0..3 into the floor. */
function floorCrack(R, side, len) {
  const pts = [[0, 0]];
  for (let x = 0; Math.abs(x) < len; ) {
    x += side * R.range(2, 5);
    pts.push([x, R.int(0, 2)]);
  }
  return pts;
}

/**
 * A leaf len px long and wid px across at its widest, centered on (x, y), turned by ang and flipping about its
 * midrib by fl (radians: edge on at pi/2, its paler underside showing past it). A pointed blade, lit along its
 * upper half and shaded along the lower, a darker midrib, a stem, a dark rim. pal: [dark, shade, body, light]
 * (dark to bright). alpha dithers it out.
 */
function drawLeaf(p, x, y, len, wid, ang, fl, pal, alpha = 1) {
  const ca = Math.cos(ang), sa = Math.sin(ang), sq = Math.cos(fl), w = Math.max(0.55, Math.abs(sq) * wid), under = sq < 0;
  const R = Math.ceil(len / 2 + 2), X = Math.round(x), Y = Math.round(y);
  const inside = (i, j) => {
    const u = (i + 0.5) * ca + (j + 0.5) * sa + len / 2, v = -(i + 0.5) * sa + (j + 0.5) * ca;
    if (u < 0 || u > len) return 0;
    const half = w * Math.pow(Math.sin((Math.PI * u) / len), 0.75);
    return Math.abs(v) <= half ? (v < 0 ? 1 : 2) : 0;
  };
  for (let j = -R; j <= R; j++)
    for (let i = -R; i <= R; i++) {
      const s = inside(i, j);
      if (!s) {
        if (inside(i - 1, j) || inside(i + 1, j) || inside(i, j - 1) || inside(i, j + 1)) p.dot(X + i, Y + j, pal[0], alpha);
        continue;
      }
      const u = (i + 0.5) * ca + (j + 0.5) * sa + len / 2, v = -(i + 0.5) * sa + (j + 0.5) * ca;
      const rib = Math.abs(v) < 0.5 && u > len * 0.12 && u < len * 0.88 && w > 1.2;
      p.dot(X + i, Y + j, rib ? pal[1] : (s === 1) !== under ? pal[3] : pal[2], alpha);
    }
  // the stem trails off the base
  p.dot(X - ca * (len / 2 + 1), Y - sa * (len / 2 + 1), pal[1], alpha);
}

/**
 * Droplets of liquid: arc under gravity with a little drag, drawn as a bright bead with a short tail along
 * their motion, and land on the floor (onLand(d, y) in update, then they're gone). add(x, y, vx, vy, s, delay).
 */
class Drops {
  constructor(ground = () => 0) {
    this.list = [];
    this.ground = ground;
  }
  add(x, y, vx, vy, s = 1, delay = 0) {
    this.list.push({ x, y, vx, vy, s, delay });
  }
  update(dt, onLand) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      if (d.delay > 0) {
        d.delay -= dt;
        continue;
      }
      const drag = 0.6 / d.s, py = d.y;
      d.vy += GRAVITY * dt;
      d.vx -= d.vx * drag * dt;
      d.vy -= d.vy * drag * 0.5 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const g = this.ground(d.x);
      if (d.vy > 0 && py <= g && d.y >= g) {
        onLand?.(d, g);
        this.list.splice(i, 1);
      }
    }
  }
  /** C: the liquid's ramp, dark to bright (5+ steps). */
  draw(p, C) {
    const n = C.length;
    for (const d of this.list) {
      if (d.delay > 0) continue;
      const sp = Math.hypot(d.vx, d.vy) || 1, ux = d.vx / sp, uy = d.vy / sp, len = Math.min(5, 0.5 + sp * 0.012);
      p.line(d.x - ux * len, d.y - uy * len, d.x - ux, d.y - uy, C[n - 4]);
      p.px(d.x, d.y, C[n - 1]);
      if (d.s > 1) p.px(d.x - ux, d.y - uy, C[n - 2]), p.px(d.x + 1, d.y, C[n - 3]);
      p.glow(d.x, d.y, 3 + d.s * 1.5, C[n - 2], 0.3);
    }
  }
}

/** A puff of gas: a darker belly hanging low, a body, a denser core, a lit cap up and to the left (hi: a rim). */
function gasPuff(p, x, y, r, a, belly, body, cap, hi = 0) {
  if (a < 0.02 || r < 0.6) return;
  p.disc(x + r * 0.06, y + r * 0.28, r * 0.9, belly, a * 0.55);
  p.disc(x, y, r, body, a * 0.45);
  p.disc(x + r * 0.03, y - r * 0.02, r * 0.76, body, a * 0.5);
  p.disc(x - r * 0.2, y - r * 0.34, r * 0.52, cap, a * 0.45);
  if (hi) p.disc(x - r * 0.3, y - r * 0.55, r * 0.26, hi, a * 0.32);
}

/**
 * A bubble of radius r centered at (x, y): a 1 px skin (lit c1 on its upper left, c2 elsewhere), a
 * translucent belly, a white glint. dome: only the part above y (a bubble swelling on a surface).
 */
function bubble(p, x, y, r, c1, c2, fill, a = 1, dome = false) {
  const R = Math.ceil(r) + 1, X = Math.round(x), Y = Math.round(y);
  for (let j = -R; j <= (dome ? 0 : R); j++)
    for (let i = -R; i <= R; i++) {
      const d = Math.hypot(i, j);
      if (d > r + 0.45) continue;
      if (d > r - 0.6) p.dot(X + i, Y + j, i < 0 && j < -r * 0.2 ? c1 : c2, a);
      else p.blend(X + i, Y + j, fill, 0.3 * a);
    }
  if (r >= 1.5) p.dot(X - Math.round(r * 0.45), Y - Math.round(r * 0.5), WHITE, a);
}

/**
 * Puffs of gas with their own clock: add(t, x, y, vx, vy, r0, r1, end, rise) launches one at time t that drifts
 * off its push (fading drag), rises at `rise` px/s, sways, swells from r0 to r1 and thins out by `end`. Draw
 * them with draw(p, t, belly, body, cap, hi, k): layered translucent puffs, a little light on the big ones.
 */
class Gas {
  constructor() {
    this.list = [];
    this.n = 0;
  }
  add(t, x, y, vx, vy, r0, r1, end, rise = 0) {
    this.list.push({ x, y, vx, vy, r0, r1, t0: t, end, rise, seed: (this.n++ * 37.7) % 100 });
  }
  prune(t) {
    for (let i = this.list.length - 1; i >= 0; i--) if (t > this.list[i].end) this.list.splice(i, 1);
  }
  at(q, t) {
    const age = t - q.t0, e = 1 - Math.exp(-age * 2.2), sw = Math.min(1, age);
    const x = q.x + (q.vx / 2.2) * e + Math.sin(t * 1.7 + q.seed) * 2.5 * sw, y = q.y + (q.vy / 2.2) * e - q.rise * age + Math.sin(t * 1.3 + q.seed * 2) * 1.5 * sw;
    const u = clamp(age / Math.max(0.01, q.end - q.t0)), r = q.r0 + (q.r1 - q.r0) * (1 - Math.pow(1 - Math.min(1, age / 1.2), 3));
    return { x, y, r, a: clamp(age / 0.15) * (1 - clamp((u - 0.4) / 0.6)), u };
  }
  draw(p, t, belly, body, cap, hi = 0, k = 1, glow = 0) {
    for (const q of this.list) {
      const g = this.at(q, t);
      if (g.a <= 0.02) continue;
      gasPuff(p, g.x, g.y, g.r, g.a * k, belly, body, cap, g.u < 0.5 ? hi : 0);
      if (glow && g.r > 4) p.glow(g.x, g.y, g.r * 1.6, glow, 0.07 * g.a * k);
    }
  }
}

exports.stoneShape = stoneShape;
exports.drawRock = drawRock;
exports.drawSpike = drawSpike;
exports.spikeLook = spikeLook;
exports.spikeCrack = spikeCrack;
exports.floorCrack = floorCrack;
exports.drawLeaf = drawLeaf;
exports.gasPuff = gasPuff;
exports.bubble = bubble;
exports.Drops = Drops;
exports.Gas = Gas;
  };
  __mods["fx/nature/spore-burst.js"] = function(exports, __req) {
// The lumpy cloud (puffs that drift off their push, rise, swell from small to large and thin out, lit caps,
// motes with light) is adapted from Sprite Fusion's open-source poison cloud (https://www.spritefusion.com/pixel-art-vfx/poison),
// MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, fit, sparkle, clamp, smooth, ease, lerp, TAU, WHITE  } = __req("core/index.js");
const {  Gas  } = __req("fx/nature/_lib.js");

const meta = {
  name: "Spore burst",
  desc: "A toadstool pushes up, swells and trembles as its gills glow, then squashes and puffs a lumpy cloud of glowing spores that billows up and drifts down twinkling.",
  tags: ["nature", "mushroom", "spores", "poison", "cloud", "ground", "one-shot"],
  size: [212, 132],
  origin: [106, 118],
  duration: 3.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#06141c", "#0c2a34", "#11484e", "#17706a", "#22a08a", "#4cd0a8", "#a8f4d0", "#f0fff6"],
    cap: ["#1a0c1e", "#3a1438", "#62204e", "#8e3462", "#bc5276", "#e88a96"],
    stem: ["#2a2230", "#5a4e5e", "#9a8e98", "#d8ccd0", "#f6eeee"],
    seed: 9,
  },
};

const GROW = 0.32, PUFF = 0.8, SINK = 2.15, SPOTS = [[-0.45, 0.45, 1.4], [0.1, 0.72, 1.8], [0.55, 0.38, 1.2], [-0.12, 0.25, 1], [0.3, 0.12, 0.9], [-0.7, 0.16, 0.8]];

// the toadstool at its current squash: a stem with a frilled ring, a domed cap lit from the upper left with
// pale spots, glowing gills beneath it
function toadstool(p, K, Sm, Cs, g, sx, sy, glow, sink) {
  const H = 17 * g, cw = 17 * sx * g, ch = 13 * sy * g, base = sink, top = base - H;
  if (g < 0.05) return;
  // stem
  for (let y = Math.floor(top); y <= Math.min(0, base); y++)
    for (let x = -4; x <= 4; x++) {
      const w = 3 + ((y - top) / H) * 1;
      if (Math.abs(x + 0.5) > w) continue;
      const q = (x + 0.5 + w) / (2 * w);
      p.px(x, y, Math.abs(x + 0.5) > w - 0.8 ? Sm[1] : q < 0.4 ? Sm[4] : q < 0.7 ? Sm[3] : Sm[2]);
    }
  const ring = top + H * 0.3;
  if (ring <= 0) for (let x = -5; x <= 5; x++) p.px(x, ring + (Math.abs(x) > 3 ? 1 : 0), Math.abs(x) > 4 ? Sm[1] : Sm[3]);
  // gills: a glowing underside
  const gy = top + 1;
  if (gy <= 0)
    for (let x = Math.floor(-cw); x <= Math.ceil(cw); x++) {
      const d = Math.abs(x + 0.5) / cw;
      if (d > 0.95) continue;
      p.px(x, gy, d < 0.3 ? Cs[0] : (x & 1) ? Sm[2] : Sm[3]);
      if (glow > 0.05) p.px(x, gy, glow > 0.6 && (x & 1) ? K[7] : K[5]);
    }
  if (glow > 0.05) p.glow(0, gy + 2, cw * 1.5 + 6, K[5], 0.5 * glow);
  // the cap: a dome with a curled lip
  p.shade(-cw - 1, top - ch - 1, cw + 1, top + 1, (x, y, out) => {
    const dx = x / cw, dy = (top - y) / ch, d = dx * dx + dy * dy;
    if (dy < -0.12 || d > 1.12 || y > 0) return;
    if (d > 1) return (out.c = Cs[0]);
    let i = dx < -0.35 && dy > 0.45 ? 5 : dx < 0.05 && dy > 0.3 ? 4 : dy < 0.18 ? 2 : dx > 0.55 ? 2 : 3;
    for (const [sx0, sy0, r] of SPOTS) {
      const ex = (dx - sx0) * cw, ey = (dy - sy0) * ch;
      if (ex * ex + ey * ey * 1.6 < r * r * g * g) i = ex < 0 && ey > 0 ? 9 : 8;
    }
    out.c = i === 9 ? Sm[4] : i === 8 ? Sm[3] : Cs[i];
  });
  p.px(-cw * 0.45, top - ch * 0.8, Cs[5]);
}

function create(o) {
  const K = fit(o.palette, 8), Cs = fit(o.cap, 6), Sm = fit(o.stem, 5), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [K[7], K[6], K[5], K[4]], haze: K[5] });
  const gas = new Gas(), lights = new Lights();
  let t = 0, puffed = false, grown = false;
  const g = () => ease.outBack(clamp(t / GROW), 1.6) * (1 - ease.inCubic(clamp((t - SINK) / 0.45)));
  const charge = () => smooth(GROW, PUFF, t);
  // squash and stretch: it swells as it charges, squashes flat as it puffs, springs back
  const shape = () => {
    if (t < PUFF) {
      const k = charge(), j = Math.sin(t * 70) * 0.04 * k;
      return [1 + 0.28 * k + j, 1 + 0.22 * k - j];
    }
    const e = t - PUFF, sp = Math.exp(-e * 7) * Math.cos(e * 26);
    return [1 + 0.25 * sp, 1 - 0.35 * sp];
  };
  return {
    update(dt) {
      t += dt;
      const f = Math.min(1, dt * 120);
      if (!grown) {
        grown = true;
        for (let i = 0; i < 10; i++) ps.spawn(P.GRIT, R.range(-4, 4), -1, R.range(-50, 50), -R.range(40, 120), R.range(0.5, 0.8), R.pick([Sm[1], Sm[2]]), 1);
        for (let i = 0; i < 4; i++) ps.spawn(P.DUST, R.range(-4, 4), -1, R.sign() * R.range(10, 40), -R.range(4, 12), R.range(0.4, 0.7), Sm[1], R.range(2, 3));
      }
      // charging: spores gather toward the gills
      if (t > GROW && t < PUFF - 0.05 && R.chance(0.25 * f)) {
        const a = R.range(Math.PI * 1.05, Math.PI * 1.95), d = R.range(20, 38), x = Math.cos(a) * d, y = -18 + Math.sin(a) * d * 0.7;
        ps.spawn(P.STREAK, x, y, -x * 3, (-18 - y) * 3, R.range(0.2, 0.3), K[6]);
      }
      if (!puffed && t >= PUFF) {
        puffed = true;
        lights.add(0, -22, 30, WHITE, 0.6, 0.1);
        lights.add(0, -28, 70, K[5], 0.55, 0.9);
        // the cloud: lumps shoved up and out from under the cap, swelling as they go
        for (let i = 0; i < 30; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(15, 95);
          gas.add(t, R.range(-8, 8), -20 + R.range(-3, 3), Math.cos(a) * sp * 1.3, Math.sin(a) * sp - 10, R.range(3, 5), R.range(8, 14), t + R.range(1.6, 2.2), R.range(5, 10));
        }
        for (let i = 0; i < 6; i++) {
          const sd = R.sign();
          gas.add(t, sd * R.range(6, 12), -5, sd * R.range(30, 70), -R.range(2, 14), R.range(2, 3), R.range(4, 6), t + R.range(0.8, 1.1), R.range(4, 8));
        }
        for (let i = 0; i < 40; i++) {
          const a = -Math.PI / 2 + R.range(-1.4, 1.4), sp = R.range(40, 160);
          const mote = R.chance(0.5), k = mote ? 0.35 : 0.7;
          ps.spawn(mote ? P.MOTE : P.FLAKE, R.range(-5, 5), -20, Math.cos(a) * sp * k, Math.sin(a) * sp * k, R.range(1, 2), R.pick([K[7], K[6], K[6], K[5]]), R.range(0.6, 1.6));
        }
        for (let i = 0; i < 6; i++) ps.spawn(P.STAR, R.range(-20, 20), -R.range(12, 40), 0, -6, R.range(0.3, 0.6), K[7], R.range(1, 2.4), R.range(0.05, 0.4));
        for (let i = 0; i < 8; i++) ps.spawn(P.DUST, R.sign() * R.range(4, 10), -1, R.sign() * R.range(30, 90), -R.range(2, 10), R.range(0.5, 0.9), K[3], R.range(2, 3.5));
      }
      // after it: spores keep drifting down out of the cloud, twinkling
      if (puffed && t < 2.6 && R.chance(0.12 * f)) ps.spawn(P.FLAKE, R.range(-40, 40), -R.range(30, 70), R.range(-8, 8), R.range(4, 14), Math.min(R.range(0.9, 1.5), meta.duration - 0.05 - t), R.chance(0.5) ? K[7] : K[6], R.range(0.6, 1.5));
      if (t > SINK && t < SINK + 0.4 && R.chance(0.15 * f)) ps.spawn(P.DUST, R.range(-5, 5), -1, R.sign() * R.range(10, 30), -R.range(2, 8), R.range(0.3, 0.5), Sm[1], R.range(1.5, 2.5));
      gas.prune(t);
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // a ring of glow on the floor round it while it charges and puffs
      const k = charge() * (1 - smooth(PUFF + 0.2, PUFF + 1.2, t));
      if (k > 0) for (let x = -20; x <= 20; x++) p.dot(x, 0, Math.abs(x) < 10 ? K[5] : K[4], k * (1 - Math.abs(x) / 21));
      p.glow(0, -2, 30, K[4], 0.25 * k);
      ps.draw(p, "back");
    },
    draw(p) {
      const [sx, sy] = shape(), gl = t < PUFF ? charge() * (0.75 + 0.25 * Math.sin(t * (20 + 30 * charge()))) : Math.max(0, 1 - (t - PUFF) * 1.5);
      toadstool(p, K, Sm, Cs, g(), sx, sy, gl, ease.inCubic(clamp((t - SINK) / 0.45)) * 20);
      // the cloud: teal lumps lit along their tops, a cool light through them
      gas.draw(p, t, K[2], K[4], K[6], K[7], 0.62, K[6]);
      // the cloud glows from within: a soft light riding its middle
      if (gas.list.length) {
        let cx = 0, cy = 0, n = 0;
        for (const q of gas.list) {
          const g2 = gas.at(q, t);
          (cx += g2.x * g2.a), (cy += g2.y * g2.a), (n += g2.a);
        }
        if (n > 0.2) p.glow(cx / n, cy / n, 46, K[5], Math.min(0.32, 0.03 * n));
      }
      const e = t - PUFF;
      if (e > 0 && e < 0.1) sparkle(p, 0, -20, 10 * (1 - e / 0.1), K[7], K[6], 0.6);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/ice/ice-spikes.js"] = function(exports, __req) {
// The eruption recipe (a frost line racing ahead, each spike punching up white with a spray of shards, a puff
// and a glint, the floor frosting behind) is adapted from Sprite Fusion's open-source ice
// (https://www.spritefusion.com/pixel-art-vfx/ice), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Bits, Lights, P, B, Rng, fit, sparkle, clamp, smooth, seg, ease, rand, TAU, WHITE  } = __req("core/index.js");
const {  Panes, endBy, blade, splitPoly  } = __req("fx/ice/_lib.js");

const meta = {
  name: "Ice spikes",
  desc: "A frost line races along the floor and clusters of jagged ice blades burst up behind it in a rising wave, glint, flash white together and shatter into toppling shards.",
  tags: ["ice", "spikes", "ground", "wave", "directional", "magic", "one-shot"],
  size: [264, 112],
  origin: [24, 96],
  duration: 3,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"], reach: 172, height: 56, seed: 3 },
};

const START = 0.04, RUN = 0.44; // the frost line runs out
const SHIMMER = 0.74; // a glint runs down the line
const TREMBLE = 1.2, FLASH = 1.36, SHATTER = 1.42; // they shiver, flash white together and break
const MELT = 1.75; // the frost goes, oldest first

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), REACH = o.reach, floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[5] });
  const bits = new Bits({ ground: floor }), lights = new Lights();
  const splinter = (x, y, vx, n) => {
    for (let i = 0; i < n; i++) bits.add({ kind: B.SHARD, x: x + R.range(-2, 2), y: y - 1, vx: vx * 0.5 + R.range(-45, 45), vy: -R.range(30, 100), g: 0.8, drag: 0.6, bounce: 0.35, life: R.range(0.4, 0.75), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1.2, 2.4), c: C[R.int(4, 7)] });
  };
  const panes = new Panes({
    ground: floor,
    onCrumble: (q) => {
      splinter(q.x, 0, 0, 3);
      ps.spawn(P.VAPOUR, q.x, -1, R.range(-12, 12), -R.range(2, 8), R.range(0.4, 0.7), C[6], R.range(1.4, 2.2));
    },
    onLand: (q, x, y, v) => {
      if (v < 110) return;
      ps.spawn(P.VAPOUR, x, y - 1, R.range(-20, 20), -R.range(2, 8), R.range(0.4, 0.7), C[6], R.range(1.4, 2.4));
      splinter(x, y, q.vx, 3);
      if (R.chance(0.3)) ps.spawn(P.STAR, x, y - 2, 0, -5, R.range(0.2, 0.4), WHITE, R.range(0.8, 1.6));
    },
  });
  const front = (t) => REACH * (1 - Math.pow(1 - seg(t, START, START + RUN), 1.7));
  const reachedAt = (x) => START + RUN * (1 - Math.pow(1 - clamp(x / REACH), 1 / 1.7));

  // clusters along the line: a main blade leaning into the wave and two to four splayed round it, heights
  // swelling to a crest past the middle and falling off at the end
  const env = (q) => 0.28 + 0.72 * Math.exp(-(((q - 0.64) / 0.3) ** 2));
  const clusters = [];
  for (let x = 10; x < REACH - 2; x += R.range(20, 26)) {
    const q = x / REACH, H = o.height * env(q) * R.range(0.88, 1.06), W = clamp(H * 0.36, 5, 14), lean = H * R.range(0.2, 0.34);
    // a big blade leaning into the wave, a smaller one behind it leaning further, a stub in front of its foot
    const list = [
      { dx: W * R.range(0.35, 0.6), h: H * R.range(0.5, 0.7), w: W * 0.7, lean: H * R.range(0.4, 0.6), back: true, delay: R.range(0.02, 0.05), jag: R.chance(0.5) ? R.range(0.35, 0.6) : -1 },
      { dx: 0, h: H, w: W, lean, back: false, delay: 0, jag: R.chance(0.7) ? R.range(0.32, 0.58) : -1, main: true },
    ];
    if (H > 14) list.push({ dx: -W * R.range(0.35, 0.55), h: H * R.range(0.24, 0.4), w: W * 0.55, lean: -H * R.range(0, 0.12), back: false, delay: R.range(0.03, 0.07), jag: -1 });
    clusters.push({ x, q, H, W, blades: list, main: list[1], t0: reachedAt(x) + 0.012, up: false });
  }
  const crest = clusters.reduce((a, c) => (c.H > a.H ? c : a), clusters[0]);
  let t = 0, broke = false, trembled = false;

  // a blade's base, tip and look right now
  const pose = (c, b) => {
    const g = ease.outBack(clamp((t - c.t0 - b.delay) / 0.09), 2.2), x = c.x + b.dx;
    return { g, x, tx: x + b.lean * g, ty: -b.h * g, white: t - c.t0 - b.delay < 0.03 || (t >= FLASH && t < SHATTER) };
  };
  const drawClusters = (p) => {
    if (t >= SHATTER) return;
    for (const pass of [0, 1, 2])
      for (const c of clusters) {
        if (t < c.t0) continue;
        const jx = t >= TREMBLE && t < FLASH ? ((Math.floor(t * 40) + Math.round(c.x)) % 2 ? 1 : 0) : 0;
        for (const b of c.blades) {
          if ((pass === 0) !== b.back || (pass === 1) !== !!b.main) continue;
          const s = pose(c, b);
          if (s.g <= 0) continue;
          const gl = (t - SHIMMER - c.q * 0.34) / 0.2;
          blade(p, s.x + jx, 0, s.tx + jx, s.ty, b.w, C, { white: s.white, jag: b.jag, dim: b.back ? 1 : 0, glint: gl >= 0 && gl <= 1 ? gl : -1 });
        }
        if (pass === 2) {
          // light: a pop at the base as it bursts, a cold glow up its length while it stands
          const pop = clamp(1 - (t - c.t0) / 0.15), wh = t >= FLASH;
          p.glow(c.x + c.main.lean * 0.4, -c.H * 0.45, c.H * 0.9 + 10, C[4], (0.16 + 0.42 * pop + (wh ? 0.4 : 0)) * (0.85 + 0.15 * Math.sin(t * 3 + c.x)));
          if (pop > 0) p.glow(c.x, -2, 14, WHITE, 0.55 * pop);
        }
      }
  };

  // the frosted floor: a crust with rime tufts, a bloom under the surface, a white-hot head while it runs
  const drawFrost = (p) => {
    const fr = front(t);
    for (let x = -3; x <= Math.min(fr, REACH + 6); x++) {
      const q = clamp(x / REACH), age = t - reachedAt(Math.max(0, x)), a = 1 - smooth(MELT + q * 0.35, MELT + q * 0.35 + 0.6, t);
      if (a <= 0 || age < 0) continue;
      const h = rand(x, 17), grow = smooth(0, 0.3, age), head = fr - x < 3 && fr < REACH;
      p.dot(x, 0, head || age < 0.06 || h < 0.3 ? WHITE : C[6], a);
      const L = h < 0.45 ? Math.round(grow * (1 + rand(x, 5) * 2.6)) : 0;
      for (let j = 1; j <= L; j++) p.dot(x, -j, j === L ? WHITE : C[5], a);
      if (L > 1 && rand(x, 9) < 0.5) p.dot(x + 1, -L + 1, C[6], a);
      const D = grow * (2 + rand(x, 11) * 4) * (1 - q * 0.3);
      for (let j = 1; j <= D; j++) p.dot(x, j, rand(x * 31 + j, 7) < 0.06 ? WHITE : j < 2 ? C[5] : j < 4 ? C[4] : C[3], a * (1.1 - j / (D + 1)));
      if (head) p.dot(x, -1, WHITE);
    }
    if (fr < REACH && t > START) {
      p.glow(fr, -2, 16, C[6], 0.6);
      p.glow(fr, -1, 7, WHITE, 0.6);
    }
  };

  const breakBlade = (c, b) => {
    const s = pose(c, b), ax = s.tx - s.x, ay = s.ty, L = Math.hypot(ax, ay) || 1, nx = -ay / L, ny = ax / L, hw = b.w / 2;
    const tri = [[s.x - nx * hw, -ny * hw], [s.tx, s.ty], [s.x + nx * hw, ny * hw]];
    const ang = Math.atan2(ay, ax) + Math.PI / 2;
    let parts = [tri];
    if (b.h > 9) parts = parts.flatMap((poly) => splitPoly(poly, s.x + ax * 0.4, ay * 0.4, ang));
    if (b.h > 22) parts = parts.flatMap((poly) => (poly.some(([, y]) => y < ay * 0.5) ? splitPoly(poly, s.x + ax * 0.72, ay * 0.72, ang) : [poly]));
    for (const part of parts) {
      let mx = 0, my = 0;
      for (const [x, y] of part) (mx += x), (my += y);
      (mx /= part.length), (my /= part.length);
      const up = clamp(-my / 40);
      panes.add({
        pts: part.map(([x, y]) => [x - mx, y - my]), x: mx, y: my, vx: R.range(-25, 60), vy: -R.range(40, 130) * (0.5 + up), a: 0, va: R.range(-8, 8), f: R.range(-0.7, 0.7), vf: R.range(-6, 6),
        lit: b.back ? 0.45 : 0.75, g: 0.9, drag: 0.6, bounce: 0.3, solid: true, ridge: Math.atan2(ay, ax), brittle: b.h > 30 ? 2 : 1, crumble: R.range(0.12, 0.4), life: R.range(1, 1.4),
      });
    }
    for (let i = 0; i < 2 + b.h / 7; i++) {
      const u = R.next();
      bits.add({ kind: R.chance(0.15) ? B.CHUNK : B.SHARD, x: s.x + ax * u + R.range(-1.5, 1.5), y: ay * u, vx: R.range(-60, 90), vy: -R.range(60, 230), g: 0.9, drag: 0.6, bounce: 0.3, life: R.range(0.7, 1.3), a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(1.2, 3.2), c: C[R.int(4, 7)], ramp: [C[1], C[3], C[4], C[6], C[7]] });
    }
  };

  return {
    update(dt) {
      t += dt;
      // the cast: a puff and a spray where the line starts
      if (t - dt <= START && t > START) {
        for (let i = 0; i < 4; i++) ps.spawn(P.VAPOUR, R.range(0, 6), -R.range(0, 3), R.range(10, 60), -R.range(2, 12), R.range(0.4, 0.7), C[6], R.range(2, 3.2));
        lights.add(4, -4, 26, C[5], 0.6, 0.25);
      }
      // the running front throws frost: streaks along the floor, motes, vapour
      const fr = front(t);
      if (t > START && fr < REACH - 1) {
        if (R.chance(0.5)) ps.spawn(P.STREAK, fr - R.range(4, 12), -R.range(1, 3), R.range(40, 80), -R.range(0, 6), R.range(0.08, 0.14), R.chance(0.5) ? C[6] : WHITE);
        if (R.chance(0.3)) ps.spawn(P.FLAKE, fr, -1, R.range(10, 50), -R.range(20, 70), R.range(0.5, 0.9), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.2));
        if (R.chance(0.12)) ps.spawn(P.VAPOUR, fr, -R.range(0, 3), R.range(20, 60), -R.range(2, 10), R.range(0.4, 0.7), C[6], R.range(1.6, 2.8));
      }
      for (const c of clusters) {
        if (c.up || t < c.t0) continue;
        c.up = true;
        // each cluster bursts up: shards sprayed forward, a puff, motes, a glint at the tip once it stands
        const big = c === crest, n = 3 + Math.round(c.H / 8);
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.0), sp = R.range(60, 190) * (0.45 + c.H / 44);
          bits.add({ kind: B.SHARD, x: c.x + R.range(-3, 3), y: -1, vx: Math.cos(a) * sp + 25, vy: Math.sin(a) * sp, g: 0.8, drag: 0.6, bounce: 0.3, life: R.range(0.6, 1.1), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1.2, 3), c: C[R.int(5, 7)] });
        }
        ps.spawn(P.VAPOUR, c.x, -1, R.range(-10, 40), -R.range(2, 10), R.range(0.5, 0.9), C[6], R.range(2.2, 3.4) * (0.6 + c.H / 60));
        for (let i = 0; i < 2; i++) ps.spawn(P.FLAKE, c.x + R.range(-4, 4), -R.range(2, c.H * 0.5), R.range(-20, 40), -R.range(20, 60), R.range(0.6, 1.1), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.3));
        if (c.H > 16) ps.spawn(P.STAR, c.x + c.main.lean, -c.H * 0.96, 0, -4, R.range(0.3, 0.5), WHITE, R.range(1.4, 2.6), 0.08);
        lights.add(c.x, -c.H * 0.4, 16 + c.H * 0.6, C[5], 0.5, 0.18);
        if (big) {
          lights.add(c.x, -c.H * 0.5, 54, WHITE, 0.5, 0.14);
          for (let i = 0; i < 4; i++) ps.spawn(P.VAPOUR, c.x + R.range(-6, 6), -R.range(0, 4), R.range(-40, 60), -R.range(4, 16), R.range(0.6, 1), C[6], R.range(3, 4.5));
        }
      }
      // while they stand: glints wink on the blades
      if (t > START + RUN && t < TREMBLE && R.chance(0.09)) {
        const c = R.pick(clusters), b = R.pick(c.blades), s = pose(c, b), u = R.range(0.3, 0.95);
        ps.spawn(P.STAR, s.x + (s.tx - s.x) * u, s.ty * u, 0, -3, R.range(0.25, 0.5), R.chance(0.6) ? WHITE : C[6], R.range(0.6, 2));
      }
      // they shiver: chips fall
      if (!trembled && t >= TREMBLE) {
        trembled = true;
        for (const c of clusters)
          for (let i = 0; i < 2; i++) bits.add({ kind: B.SHARD, x: c.x + R.range(-4, 4), y: -R.range(4, c.H * 0.8), vx: R.range(-20, 20), vy: -R.range(0, 30), g: 0.8, drag: 0.5, bounce: 0.3, life: R.range(0.3, 0.6), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1, 1.8), c: C[R.int(5, 7)] });
      }
      if (!broke && t >= SHATTER) {
        broke = true;
        // all at once: every blade breaks into toppling pieces, splinters and ice dust, light along the line
        for (const c of clusters) {
          for (const b of c.blades) breakBlade(c, b);
          for (let i = 0; i < 2; i++) ps.spawn(P.VAPOUR, c.x + R.range(-6, 6), -R.range(1, 8), R.range(-30, 50), -R.range(4, 18), R.range(0.6, 1.1), C[6], R.range(2.4, 4) * (0.7 + c.H / 60));
          if (R.chance(0.7)) ps.spawn(P.STAR, c.x + R.range(-6, 6), -R.range(4, c.H), R.range(-10, 10), -R.range(6, 20), R.range(0.4, 0.8), R.chance(0.5) ? WHITE : C[6], R.range(1, 2.2));
          for (let i = 0; i < 2; i++) ps.spawn(P.FLAKE, c.x + R.range(-6, 6), -R.range(4, c.H), R.range(-30, 60), -R.range(30, 90), R.range(0.9, 1.5), R.chance(0.6) ? WHITE : C[6], R.range(0.5, 1.5));
          lights.add(c.x, -c.H * 0.5, 22 + c.H, WHITE, 0.45, 0.12);
        }
        for (let i = 0; i < 5; i++) lights.add((REACH * (i + 0.5)) / 5, -18, 40, C[4], 0.4, 0.5);
      }
      // the shatter's dust settles; glints on the debris
      if (broke && t < SHATTER + 0.8 && R.chance(0.1) && bits.list.length) {
        const b = R.pick(bits.list);
        ps.spawn(P.STAR, b.x, b.y - 1, 0, -3, R.range(0.2, 0.4), R.chance(0.5) ? WHITE : C[6], R.range(0.6, 1.5));
      }
      ps.update(dt);
      bits.update(dt);
      panes.update(dt);
      lights.update(dt);
      endBy(t, meta.duration, ps, bits, panes);
    },
    drawBack(p) {
      drawFrost(p);
      ps.draw(p, "back");
    },
    draw(p) {
      drawClusters(p);
      // the cold light the frosted floor gives off
      const k = (1 - smooth(MELT, MELT + 0.9, t)) * smooth(START, START + 0.3, t), fr = front(t);
      for (let i = 0; i < 6; i++) p.glow((fr * (i + 0.5)) / 6, -3, 26, C[4], 0.15 * k);
      if (t >= FLASH && t < SHATTER + 0.1) for (const c of clusters) sparkle(p, c.x + c.main.lean, -c.H, 6 * (1 - clamp((t - FLASH) / 0.16)), C[6], C[4], 0.4);
      panes.draw(p, C);
      bits.draw(p);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/ice/_lib.js"] = function(exports, __req) {
// Shared by the ice effects: panes of ice that tumble and skid, polygon helpers, a character turned to ice,
// cracks that race through a shape. Files starting with _ are helpers, not effects.
// The crack walk and the faceted crystal shading are adapted from Sprite Fusion's open-source ice
// (https://www.spritefusion.com/pixel-art-vfx/ice), MIT License, Copyright (c) 2026 Hugo Duprez.

const {  GRAVITY, clamp, luma, TAU, WHITE  } = __req("core/index.js");

/** Is (x, y) inside the polygon pts [[x, y], ...]? (even-odd rule) */
function inPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A polygon's centroid and area: { x, y, area }. */
function centroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [x0, y0] = pts[j], [x1, y1] = pts[i], k = x0 * y1 - x1 * y0;
    a += k;
    cx += (x0 + x1) * k;
    cy += (y0 + y1) * k;
  }
  if (Math.abs(a) < 1e-6) {
    const n = pts.length;
    return { x: pts.reduce((s, q) => s + q[0], 0) / n, y: pts.reduce((s, q) => s + q[1], 0) / n, area: 0 };
  }
  return { x: cx / (3 * a), y: cy / (3 * a), area: Math.abs(a) / 2 };
}

/** Cut a polygon along the line through (x, y) at angle a: the pieces with three corners or more. */
function splitPoly(pts, x, y, a) {
  const nx = -Math.sin(a), ny = Math.cos(a), side = (q) => (q[0] - x) * nx + (q[1] - y) * ny, L = [], Rt = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], sp = side(p), sq = side(q);
    (sp >= 0 ? L : Rt).push(p);
    if (sp >= 0 !== sq >= 0) {
      const u = sp / (sp - sq), m = [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
      L.push(m);
      Rt.push(m);
    }
  }
  return [L, Rt].filter((s) => s.length >= 3);
}

/** A color turned to ice: its brightness picks a step of the ice ramp C (dark to bright), never the darkest. */
function iceOf(c, C) {
  const n = C.length, l = luma(c);
  return C[clamp(Math.round(((l < 0.12 ? 2 : 2 + l * 5.2) * (n - 1)) / 7), 1, n - 1)];
}

/** Fill a polygon with translucent color (true blending, no dither): glass, ice, light. */
function glassPoly(p, pts, c, a) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (inPoly(pts, x + 0.5, y + 0.5)) p.blend(x, y, c, a);
}

/**
 * Panes of ice: flat polygons that fly, spin and tumble end over end (they squash as they turn edge-on and
 * flash as they square up to the light), bounce on the floor, skid, settle and fade. Drawn as glass: a
 * translucent face, edges lit where they face the light, a glint.
 * add({ pts (corners around 0, 0), x, y, vx, vy, a (turn), va, f (tumble), vf, lit (0..1: how much light its
 * face catches), g, drag, bounce, life, brittle (breaks on that many hard landings), crumble (seconds it lies
 * still before it crumbles), solid (opaque: one `tone` 0..1, or shaded like a blade split along `ridge`, an angle) });
 * update(dt); draw(p, C)
 * with an ice ramp, dark to bright. onLand(q, x, y, speed) when one hits the floor hard, onCrumble(q) when one
 * that lay still crumbles away, onSkid(q, x, y) while one slides along the floor.
 */
class Panes {
  constructor(opts = {}) {
    this.list = [];
    this.ground = opts.ground ?? (() => Infinity);
    this.onLand = opts.onLand ?? null;
    this.onCrumble = opts.onCrumble ?? null;
    this.onSkid = opts.onSkid ?? null;
  }
  add(q) {
    const life = q.life ?? 1;
    this.list.push({ vx: 0, vy: 0, a: 0, va: 0, f: 0, vf: 0, lit: 0.6, g: 1, drag: 0.3, bounce: 0.35, rest: false, brittle: false, ...q, life, max: life });
  }
  get count() {
    return this.list.length;
  }
  /** The pane's corners as drawn: tumbled (squashed across its own width), turned and placed. */
  corners(q) {
    const ca = Math.cos(q.a), sa = Math.sin(q.a), k = Math.cos(q.f);
    return q.pts.map(([x, y]) => {
      const yy = y * k;
      return [q.x + x * ca - yy * sa, q.y + x * sa + yy * ca];
    });
  }
  seat(q) {
    let low = -Infinity;
    for (const c of this.corners(q)) low = Math.max(low, c[1]);
    return low;
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const q = this.list[i];
      if ((q.life -= dt) <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      const floor = this.ground(q.x) - 0.5;
      if (q.rest && q.crumble !== undefined && (q.restT = (q.restT ?? 0) + dt) > q.crumble) {
        this.onCrumble?.(q);
        this.list.splice(i, 1);
        continue;
      }
      if (q.rest) {
        // skidding: friction slows the slide and the spin, the pane stays seated on the floor
        if (Math.abs(q.vx) > 8) this.onSkid?.(q, q.x, floor + 0.5);
        q.x += q.vx * dt;
        q.vx -= q.vx * 7 * dt;
        q.a += q.va * dt;
        q.va -= q.va * 9 * dt;
        q.vf -= q.vf * 9 * dt;
        q.f += q.vf * dt;
        q.y -= this.seat(q) - floor;
        continue;
      }
      q.vy += GRAVITY * q.g * dt;
      q.vx -= q.vx * q.drag * dt;
      q.vy -= q.vy * q.drag * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.a += q.va * dt;
      q.f += q.vf * dt;
      const low = this.seat(q);
      if (q.g <= 0 || low < floor || q.vy <= 0) continue;
      q.y -= low - floor;
      if (q.vy > 70) (q.hits = (q.hits ?? 0) + 1), this.onLand?.(q, q.x, floor + 0.5, q.vy);
      if (q.brittle && q.vy > 70 && q.hits >= q.brittle) {
        this.list.splice(i, 1);
        continue;
      }
      if (q.vy > 70 && q.bounce > 0) {
        q.vy = -q.vy * q.bounce;
        q.vx *= 0.75;
        q.va *= 0.6;
        q.vf *= 0.5;
      } else {
        q.rest = true;
        q.vy = 0;
      }
    }
  }
  draw(p, C) {
    const n = C.length;
    for (const q of this.list) {
      const a = Math.min(1, q.life / 0.35), pts = this.corners(q), k = Math.cos(q.f), face = Math.abs(k);
      // the face: glassy, brighter the more it faces us and the more light it catches; it flashes as it squares up
      const lv = q.lit * (0.35 + 0.65 * face), flash = face > 0.97 && !q.rest;
      if (face > 0.25) {
        if (q.solid && q.tone !== undefined) {
          // a chunk of one face: its tone, brighter as it squares up to the light
          p.poly(pts, flash ? C[n - 1] : C[clamp(Math.round(1 + q.tone * 5 * (0.6 + 0.4 * face)), 1, n - 2)], a);
        } else if (q.solid) {
          // shaded like the blade it broke from: a lit side, a pale ridge, a deep side
          const rr = q.ridge ?? -Math.PI / 2, cr = Math.cos(rr), sr = Math.sin(rr), ca = Math.cos(q.a), sa = Math.sin(q.a);
          const rx = cr * ca - sr * k * sa, ry = cr * sa + sr * k * ca;
          let nx = -ry, ny = rx;
          if (nx * -0.55 + ny * -0.84 < 0) (nx = -nx), (ny = -ny);
          const lit = flash ? C[n - 1] : C[clamp(Math.round(3 + lv * 3), 3, n - 2)], deep = C[clamp(Math.round(1 + lv * 2), 1, 3)];
          p.poly(pts, (x, y) => {
            const d = (x - q.x) * nx + (y - q.y) * ny;
            return d > 0.6 ? lit : d > -0.6 ? C[n - 2] : deep;
          }, a);
        } else glassPoly(p, pts, flash ? C[n - 1] : C[clamp(Math.round(3 + lv * 3), 3, n - 2)], (0.3 + 0.35 * lv + (flash ? 0.3 : 0)) * a);
      }
      let cx = 0, cy = 0, top = 0;
      for (const [x, y] of pts) (cx += x), (cy += y);
      cx /= pts.length;
      cy /= pts.length;
      // edges: lit where they face the light (up and left), cool where they face away
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        let nx = y1 - y0, ny = x0 - x1;
        if (nx * ((x0 + x1) / 2 - cx) + ny * ((y0 + y1) / 2 - cy) < 0) (nx = -nx), (ny = -ny);
        const l = Math.hypot(nx, ny) || 1, lit = (-nx * 0.55 - ny * 0.84) / l;
        p.line(x0, y0, x1, y1, face < 0.25 || lit > 0.35 ? C[n - 1] : lit > -0.25 ? C[n - 2] : q.solid ? C[1] : C[Math.max(2, n - 4)], a);
        if (pts[i][1] < pts[top][1]) top = i;
      }
      if (face > 0.7) p.dot(pts[top][0], pts[top][1], WHITE, a);
      p.glow(cx, cy, 5, C[n - 3], (flash ? 0.5 : 0.14) * a);
    }
  }
}

/**
 * A jagged ice blade standing on its base (bx, by), tip at (tx, ty), w wide at the base. Shaded in an ice ramp
 * C (dark to bright, 8 steps): a lit facet on the left with a pale edge, a bright ridge, a deep facet on the
 * right, a white tip, a dark rim, and a notch cut into one side so it reads as a shard, not a cone.
 * opts: { a (alpha), white (flash it white), glint (0..1: a highlight across it at that height, or -1),
 * jag (0..1: where the notch starts, or -1), dim (steps darker, for back rows) }.
 */
function blade(p, bx, by, tx, ty, w, C, opts = {}) {
  const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy);
  if (L < 1.5 || w < 0.5) return;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, a = opts.a ?? 1, dim = opts.dim ?? 0, jag = opts.jag ?? -1, glint = opts.glint ?? -1;
  const K = (i) => C[clamp(i - dim, 0, C.length - 1)], hw = w / 2;
  // half widths on the left (lit) and right (shadow) sides at height u; the notch steps the right side in
  const left = (u) => hw * (1 - u) + 0.35, right = (u) => hw * (1 - u) * (jag >= 0 && u > jag ? 0.55 : 1) + 0.35, ridge = (u) => -w * 0.12 * (1 - u);
  const pad = hw + 2;
  p.shade(Math.min(bx, tx) - pad, Math.min(by, ty) - pad, Math.max(bx, tx) + pad, Math.max(by, ty), (x, y, o) => {
    const rx = x - bx, ry = y - by, u = (rx * ux + ry * uy) / L, s = rx * nx + ry * ny;
    if (u < 0) return;
    const l = left(Math.min(u, 1)), r = right(Math.min(u, 1));
    if (u > 1 || s < -l || s > r) {
      // a dark rim just outside the blade
      const over = u > 1 ? (u - 1) * L : 0, out = Math.max(over, s < -l ? -l - s : s - r);
      if (out < 1 && u < 1 + 1 / L) {
        o.c = K(0);
        o.a = a;
      }
      return;
    }
    o.a = a;
    if (opts.white) return (o.c = WHITE);
    const rd = ridge(u);
    let c;
    if (u > 0.88) c = WHITE;
    else if (Math.abs(s - rd) < 0.55) c = K(6);
    else if (s < rd) c = s + l < 1 ? K(6) : (s + l) / Math.max(1, rd + l) > 0.55 ? K(5) : K(4);
    else c = r - s < 1.1 ? K(1) : (s - rd) / Math.max(1, r - rd) > 0.5 ? K(2) : K(3);
    // the notch's ledge catches light; a little glitter in the lit facet
    if (jag >= 0 && Math.abs(u - jag) * L < 0.8 && s > rd) c = K(6);
    else if (s < rd && c !== K(6) && ((Math.floor(x) * 73856093) ^ (Math.floor(y) * 19349663)) % 997 < 30) c = K(7);
    if (glint >= 0 && s <= rd + 0.6) {
      const g = Math.abs(u - glint) * L;
      if (g < 0.8) c = WHITE;
      else if (g < 1.8) c = K(6);
    }
    o.c = c;
  });
}

/**
 * A snowflake design, seeded: pairs of side branches along each arm ([where 0..1, length 0..1 of the arm]),
 * maybe a hexagonal plate round the heart, maybe forked tips.
 */
function flakeDesign(R) {
  const n = R.int(1, 3), branches = [];
  for (let i = 0; i < n; i++) branches.push([0.38 + (0.4 * (i + R.range(0.2, 0.8))) / n, R.range(0.24, 0.36) * (1 - i * 0.15)]);
  return { branches, plate: R.chance(0.45), fork: R.chance(0.45) };
}

/**
 * A six-armed snowflake of radius r turned by rot, crisp 1 px lines: pale arms, side branches at 60 degrees,
 * a plate or forked tips by design, a white heart, light. hot (0..1) makes it twinkle white.
 */
function snowflake(p, x, y, r, rot, d, C, opts = {}) {
  const n = C.length, a = opts.a ?? 1, hot = opts.hot ?? 0;
  rot = Math.round(rot / (Math.PI / 18)) * (Math.PI / 18); // turn in 10 degree ticks, like sprite frames
  if (r < 1.2) {
    p.dot(x, y, WHITE, a);
    return;
  }
  if (r < 2.6) {
    // too small for branches: a six-point star that flips between two poses as it turns
    const pose = Math.floor(((rot % (Math.PI / 3)) + Math.PI / 3) / (Math.PI / 6)) % 2;
    const pts = pose ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (const [dx, dy] of pts) p.dot(x + dx, y + dy, hot > 0.5 ? WHITE : C[n - 3], a);
    p.dot(x, y, WHITE, a);
    p.glow(x, y, 4, C[n - 3], 0.2 * a);
    return;
  }
  // detail by size: a bare star when small, one pair of branches when middling, the full design when big
  const arm = hot > 0.5 ? WHITE : C[n - 2], br = hot > 0.5 ? C[n - 2] : C[n - 3], big = r >= 7;
  const branches = r < 4 ? [] : big ? d.branches.slice(0, 2) : [[0.58, 0.36]];
  for (let k = 0; k < 6; k++) {
    const g = rot + (k * TAU) / 6, ca = Math.cos(g), sa = Math.sin(g);
    p.line(x, y, x + ca * r, y + sa * r, arm, a);
    for (const [u, l] of branches) {
      const bx = x + ca * r * u, by = y + sa * r * u, bl = Math.max(1, r * l);
      for (const s of [-1, 1]) p.line(bx, by, bx + Math.cos(g + (s * Math.PI) / 3) * bl, by + Math.sin(g + (s * Math.PI) / 3) * bl, br, a);
    }
    if (d.fork && big && !d.plate)
      for (const s of [-1, 1]) p.dot(x + ca * r + Math.cos(g + s * 0.9) * 1.2, y + sa * r + Math.sin(g + s * 0.9) * 1.2, br, a);
    p.dot(x + ca * r, y + sa * r, WHITE, a);
  }
  if (d.plate && big) {
    const q = r * 0.34;
    for (let k = 0; k < 6; k++) {
      const g0 = rot + Math.PI / 6 + (k * TAU) / 6, g1 = g0 + TAU / 6;
      p.line(x + Math.cos(g0) * q, y + Math.sin(g0) * q, x + Math.cos(g1) * q, y + Math.sin(g1) * q, C[n - 3], a);
    }
  }
  p.px(x, y, WHITE);
  p.glow(x, y, 3 + r * 1.2, C[n - 4], (0.14 + 0.35 * hot) * a);
  if (hot > 0.3) p.glow(x, y, 2 + r * 0.5, WHITE, 0.3 * hot * a);
}

/** Nothing outlives the effect: trims the life of every particle, bit and pane that would last past D. */
function endBy(t, D, ...systems) {
  const left = Math.max(0.001, D - 0.05 - t);
  for (const sys of systems) for (const q of sys.list) if (q.life > left) q.life = left;
}

/**
 * Cracks racing out from (x, y) through a shape: n jagged lines that wander, fork now and then and stop at
 * the shape's edge (inside(x, y) says what's in it). Each point carries its distance from the start along the
 * crack, so drawFractures can grow them at a speed. Returns polylines [[x, y, d], ...].
 */
function fractures(R, inside, x, y, n, opts = {}) {
  const out = [], step = opts.step ?? [1.6, 2.6], len = opts.len ?? 18, fork = opts.fork ?? 0.16, a0 = opts.a0 ?? R.range(0, TAU), spread = opts.spread ?? TAU;
  const walk = (x, y, d, a, len, depth) => {
    const pts = [[x, y, d]];
    for (let s = 0; s < len; s++) {
      a += R.range(-0.55, 0.55);
      const st = R.range(step[0], step[1]), nx = x + Math.cos(a) * st, ny = y + Math.sin(a) * st;
      if (!inside(nx, ny)) break;
      (x = nx), (y = ny), (d += st);
      pts.push([x, y, d]);
      if (depth < 2 && pts.length > 2 && R.chance(fork)) walk(x, y, d, a + R.sign() * R.range(0.6, 1.2), Math.ceil(len * 0.5), depth + 1);
    }
    if (pts.length > 1) out.push(pts);
  };
  for (let i = 0; i < n; i++) walk(x, y, 0, a0 + (i / n) * spread + R.range(-0.3, 0.3) * Math.min(1, spread / TAU), len, 0);
  return out;
}

/**
 * Draw cracks grown out to distance `reach` from their start: a bright line over a dark one a pixel lower (an
 * engraved fracture), a white-hot tip while they run, light leaking out along them. ox, oy shift them.
 */
function drawFractures(p, cracks, reach, C, opts = {}) {
  const n = C.length, ox = opts.ox ?? 0, oy = opts.oy ?? 0, hot = opts.hot ?? true, a = opts.a ?? 1;
  const seg = (pts, i) => {
    const [x0, y0, d0] = pts[i - 1], [x1, y1, d1] = pts[i];
    if (d0 >= reach) return null;
    const u = Math.min(1, (reach - d0) / Math.max(0.01, d1 - d0));
    return [x0 + ox, y0 + oy, x0 + ox + (x1 - x0) * u, y0 + oy + (y1 - y0) * u, reach - d1 < 3];
  };
  for (const pts of cracks)
    for (let i = 1; i < pts.length; i++) {
      const s = seg(pts, i);
      if (!s) break;
      p.line(s[0], s[1] + 1, s[2], s[3] + 1, C[Math.min(2, n - 1)], a);
    }
  for (const pts of cracks)
    for (let i = 1; i < pts.length; i++) {
      const s = seg(pts, i);
      if (!s) break;
      const tip = hot && s[4];
      p.line(s[0], s[1], s[2], s[3], tip ? WHITE : C[n - 2], a);
      if (tip) p.glow(s[2], s[3], 5, C[n - 3], 0.5 * a);
      else if (i % 2) p.glow(s[2], s[3], 3, C[n - 3], 0.18 * a);
    }
}

exports.inPoly = inPoly;
exports.centroid = centroid;
exports.splitPoly = splitPoly;
exports.iceOf = iceOf;
exports.glassPoly = glassPoly;
exports.blade = blade;
exports.flakeDesign = flakeDesign;
exports.snowflake = snowflake;
exports.endBy = endBy;
exports.fractures = fractures;
exports.drawFractures = drawFractures;
exports.Panes = Panes;
  };
  __mods["fx/ice/ice-shatter.js"] = function(exports, __req) {
// The crack-and-burst recipe (cracks walking out from the point of impact, a white frame, the ice flung apart
// as shards with ice dust and glints) is adapted from Sprite Fusion's open-source ice
// (https://www.spritefusion.com/pixel-art-vfx/ice), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Bits, Lights, P, B, Rng, fit, sparkle, flare, clamp, smooth, seg, ease, rand, TAU, WHITE  } = __req("core/index.js");
const {  Panes, endBy, inPoly, centroid, splitPoly, fractures, drawFractures  } = __req("fx/ice/_lib.js");

const meta = {
  name: "Ice shatter",
  desc: "A block of ice takes a hit from the left: it jolts, cracks race over its faces, it flashes white and bursts into chunks that tumble, bounce and skid off in a roll of ice dust.",
  tags: ["ice", "shatter", "break", "destroy", "impact", "directional", "one-shot"],
  size: [224, 112],
  origin: [68, 90],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"], seed: 6 },
};

const HIT = 0.26, CRACK2 = 0.4, SHIVER = 0.54, FLASH = 0.62, BURST = 0.68;
// the block, seen from the front and a little above: a front face, a top, a side in shadow
const FRONT = [[-16, 0], [-16, -28], [12, -28], [12, 0]];
const TOP = [[-16, -28], [-8, -34], [20, -34], [12, -28]];
const SIDE = [[12, 0], [12, -28], [20, -34], [20, -6]];
const SIL = [[-16, 0], [-16, -28], [-8, -34], [20, -34], [20, -6], [12, 0]];
const HIT_AT = [-16, -15];
const PLANE = [[-16, -21], [-5, -28], [3, -13], [-16, -9]]; // a fracture plane inside, lighter
const SHADE = [[5, -28], [12, -28], [12, -10]]; // the far corner in shadow

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[5] });
  const bits = new Bits({ ground: floor }), lights = new Lights(), scuffs = [];
  const splinter = (x, y, vx, n) => {
    for (let i = 0; i < n; i++) bits.add({ kind: B.SHARD, x: x + R.range(-2, 2), y: y - 1, vx: vx * 0.6 + R.range(-35, 45), vy: -R.range(30, 100), g: 0.8, drag: 0.6, bounce: 0.35, life: R.range(0.4, 0.8), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1.2, 2.4), c: C[R.int(4, 7)] });
  };
  const panes = new Panes({
    ground: floor,
    onLand: (q, x, y, v) => {
      // a chunk hitting the floor: a puff of ice dust, a few splinters, sometimes a glint
      if (v < 100) return;
      ps.spawn(P.VAPOUR, x, y - 1, q.vx * 0.3 + R.range(-15, 15), -R.range(2, 10), R.range(0.4, 0.7), C[6], R.range(1.6, 2.8));
      splinter(x, y, q.vx, 2);
      if (R.chance(0.3)) ps.spawn(P.STAR, x, y - 3, 0, -5, R.range(0.2, 0.4), WHITE, R.range(0.8, 1.6));
    },
    onSkid: (q, x) => {
      // sliding chunks scuff frost onto the floor
      if (R.chance(0.5)) scuffs.push({ x: Math.round(x + R.range(-1, 1)), t: 0 });
    },
    onCrumble: (q) => {
      splinter(q.x, 0, q.vx, 3);
      ps.spawn(P.VAPOUR, q.x, -1, R.range(-10, 14), -R.range(2, 6), R.range(0.4, 0.7), C[6], R.range(1.2, 2));
    },
  });

  // the ice's insides: veins of frost and trapped bubbles in the front face
  const veins = [], bubbles = [];
  for (let k = 0; k < 3; k++) {
    let x = R.range(-12, 8), y = R.range(-24, -6), a = R.range(0, TAU);
    for (let i = 0; i < 9; i++) {
      a += R.range(-0.6, 0.6);
      x += Math.cos(a) * 1.5;
      y += Math.sin(a) * 1.2;
      if (x < -14 || x > 10 || y < -26 || y > -2) break;
      veins.push([Math.floor(x), Math.floor(y)]);
    }
  }
  for (let k = 0; k < 5; k++) bubbles.push([R.int(-12, 8), R.int(-23, -4), R.chance(0.4) ? 1 : 0]);
  const inside = (x, y) => inPoly(SIL, x, y);
  const cracks = fractures(R, inside, HIT_AT[0] + 1, HIT_AT[1], 4, { len: 8, a0: -0.9, spread: 1.9 });
  const cracks2 = fractures(R, inside, HIT_AT[0] + 1, HIT_AT[1], 6, { len: 18, a0: -1.3, spread: 2.7, fork: 0.16 });

  let t = 0, struck = false, burst = false, wave2 = false, white = false;
  const jolt = () => (t >= HIT && t < HIT + 0.05 ? 2 : t >= HIT + 0.05 && t < HIT + 0.12 ? 1 : t >= SHIVER && t < FLASH ? (Math.floor(t * 40) % 2 ? 1 : 0) : 0);

  // the block: shaded faces, frost veins and bubbles inside, lit edges, a dark rim
  const drawBlock = (p) => {
    if (t >= BURST) return;
    const jx = jolt(), wh = t >= FLASH, sweep = -40 + 70 * seg(t, 0.04, 0.3);
    const sh = (pts) => pts.map(([x, y]) => [x + jx, y]);
    // rim
    p.poly(sh([[-17, 1], [-17, -28.5], [-8.3, -35.2], [21, -35.2], [21, -5.6], [12.5, 1]]), C[0]);
    if (wh) {
      p.poly(sh(SIL), WHITE);
      return;
    }
    // the front: lit at the top, deep at the foot, the far edges showing through, a fracture plane catching
    // light, reflections streaked across the upper left
    p.poly(sh(FRONT), (x, y) => {
      const lx = x - jx, d = lx + y * 0.8;
      if (Math.abs(d - sweep) < 1.3 && y < -6) return WHITE;
      if (y < -9 && (Math.abs(d + 21) < 1.1 || Math.abs(d + 16.5) < 0.6)) return C[6];
      if (((Math.abs(lx + 7.5) < 0.5 && y < -6) || (Math.abs(y + 5.5) < 0.5 && lx > -8)) && (Math.floor(lx) + Math.floor(y)) % 2 === 0) return C[5];
      if (inPoly(PLANE, lx, y)) return y < -25.5 ? C[6] : C[5];
      if (inPoly(SHADE, lx, y)) return C[3];
      return y < -25.5 ? C[5] : y < -8 ? C[4] : y < -2.5 ? C[3] : C[2];
    });
    p.poly(sh(TOP), (x, y) => (y > -29.5 ? C[7] : y < -32.5 ? C[5] : rand(Math.floor(x), Math.floor(y), 3) < 0.08 ? C[7] : C[6]));
    p.poly(sh(SIDE), (x, y) => {
      const lx = x - jx;
      return lx < 13.5 ? C[3] : Math.abs(lx - 16.5) < 0.6 && y < -8 ? C[3] : y > (lx - 12) * -0.75 - 3 ? C[1] : C[2];
    });
    for (const [x, y] of veins) p.px(x + jx, y, C[5]);
    for (const [x, y, big] of bubbles) {
      p.px(x + jx, y, C[6]);
      if (big) p.px(x + jx + 1, y, C[5]), p.px(x + jx, y + 1, C[5]);
    }
    const E = (a, b, c) => p.line(a[0] + jx, a[1], b[0] + jx, b[1], c);
    E([-16, -28], [12, -28], WHITE);
    E([-16, -28], [-8, -34], C[6]);
    E([-8, -34], [20, -34], C[5]);
    E([12, -28], [20, -34], C[7]);
    E([-16, -1], [-16, -28], C[5]);
    E([12, -1], [12, -28], C[6]);
    E([20, -6], [20, -34], C[3]);
    E([13, -1], [20, -6], C[1]);
    if (t >= HIT) drawFractures(p, cracks, (t - HIT) * 170, C, { ox: jx });
    if (t >= CRACK2) drawFractures(p, cracks2, (t - CRACK2) * 200, C, { ox: jx });
  };

  // the floor: a frost patch where the block stands, frost scuffed along by sliding chunks
  const drawFloor = (p) => {
    const out = 1 - smooth(BURST + 0.6, BURST + 1.5, t);
    if (out > 0)
      for (let x = -22; x <= 26; x++) {
        const d = Math.abs(x - 2) / 24, h = rand(x, 41), a = out * clamp((1.1 - d) / 0.25);
        if (a <= 0) continue;
        p.dot(x, 0, h < 0.35 ? WHITE : C[6], a);
        if (h < 0.4 && (x < -16 || x > 20)) p.dot(x, -1, C[5], a);
        for (let j = 1; j <= 1 + Math.round(rand(x, 7) * 3 * (1 - d)); j++) p.dot(x, j, j < 2 ? C[5] : C[4], a * (1 - j / 5));
      }
    for (const s of scuffs) {
      const a = 1 - s.t / 0.9;
      if (a > 0) p.dot(s.x, 0, s.t < 0.15 ? WHITE : C[6], a), p.dot(s.x, 1, C[4], a * 0.6);
    }
  };

  const explode = () => {
    // chunks of each face, cut at random, flung away from the hit, mostly right and up
    const chop = (pts, max, depth) => {
      const c = centroid(pts);
      return c.area < max || depth > 4 ? [pts] : splitPoly(pts, c.x + R.range(-1, 1), c.y + R.range(-1, 1), R.range(0, Math.PI)).flatMap((q) => chop(q, max, depth + 1));
    };
    for (const [face, tone, max] of [[FRONT, 0.6, 46], [TOP, 1, 40], [SIDE, 0.3, 46]])
      for (const part of chop(face, max, 0)) {
        const m = centroid(part), dx = m.x - HIT_AT[0], dy = m.y - HIT_AT[1], d = Math.hypot(dx, dy) || 1, sp = R.range(50, 150) * (0.7 + 0.3 * (1 - d / 40));
        panes.add({
          pts: part.map(([x, y]) => [x - m.x, y - m.y]), x: m.x, y: m.y, vx: (dx / d) * sp * 0.9 + R.range(40, 110), vy: (dy / d) * sp * 0.4 - R.range(60, 200),
          a: 0, va: R.range(-10, 10), f: R.range(-0.9, 0.9), vf: R.range(-7, 7), tone, lit: tone, g: 0.9, drag: 0.5, bounce: 0.38, solid: true, brittle: 3, crumble: R.range(0.25, 0.6), life: R.range(1.5, 1.9),
        });
      }
    for (let i = 0; i < 46; i++) {
      const x = R.range(-15, 19), y = -R.range(1, 33), dx = x - HIT_AT[0], dy = y - HIT_AT[1], d = Math.hypot(dx, dy) || 1, sp = R.range(60, 200);
      if (!inside(x, y)) continue;
      bits.add({ kind: R.chance(0.15) ? B.CHUNK : B.SHARD, x, y, vx: (dx / d) * sp * 0.8 + R.range(20, 90), vy: (dy / d) * sp * 0.4 - R.range(60, 240), g: 0.85, drag: 0.6, bounce: 0.32, life: R.range(0.8, 1.4), a: R.range(0, TAU), va: R.range(-22, 22), s: R.range(1.2, 3.4), c: C[R.int(4, 7)], ramp: [C[1], C[3], C[4], C[6], C[7]] });
    }
    // ice dust rolls out along the floor, vapour hangs where it stood, a flurry, glints, a flash of light
    for (let i = 0; i < 9; i++) ps.spawn(P.VAPOUR, R.range(-6, 18), -R.range(1, 6), R.range(10, 130), -R.range(2, 12), R.range(0.6, 1.1), C[6], R.range(2.2, 3.8));
    for (let i = 0; i < 5; i++) ps.spawn(P.DUST, R.range(-6, 16), -R.range(1, 4), R.range(30, 110), -R.range(2, 8), R.range(0.5, 0.9), C[5], R.range(1.6, 2.8));
    for (let i = 0; i < 4; i++) ps.spawn(P.VAPOUR, R.range(-8, 18), -R.range(8, 28), R.range(-10, 50), -R.range(8, 24), R.range(0.6, 1), C[6], R.range(2.6, 4));
    for (let i = 0; i < 16; i++) {
      const a = R.range(-Math.PI * 0.9, -0.1), sp = R.range(40, 140);
      ps.spawn(P.FLAKE, R.range(-8, 16), -R.range(6, 28), Math.cos(a) * sp + 20, Math.sin(a) * sp, R.range(1, 1.6), R.chance(0.6) ? WHITE : C[6], R.range(0.5, 1.6));
    }
    for (let i = 0; i < 7; i++) ps.spawn(P.STAR, R.range(-14, 40), -R.range(4, 40), R.range(-8, 16), -R.range(4, 16), R.range(0.4, 0.8), R.chance(0.5) ? WHITE : C[6], R.range(1, 2.4));
    lights.add(2, -17, 64, WHITE, 0.85, 0.14);
    lights.add(16, -18, 86, C[4], 0.5, 0.55);
  };

  return {
    update(dt) {
      t += dt;
      // the hit: a flash on the left face, chips and sparks thrown back, the block jolts
      if (!struck && t >= HIT) {
        struck = true;
        lights.add(HIT_AT[0], HIT_AT[1], 24, WHITE, 0.6, 0.08);
        lights.add(HIT_AT[0] + 6, HIT_AT[1], 40, C[5], 0.4, 0.3);
        for (let i = 0; i < 12; i++) {
          const a = Math.PI + R.range(-0.9, 0.9), sp = R.range(50, 120);
          ps.spawn(P.SPARK, HIT_AT[0] - 1, HIT_AT[1], Math.cos(a) * sp, Math.sin(a) * sp - 40, R.range(0.15, 0.4));
        }
        for (let i = 0; i < 6; i++) {
          const a = Math.PI + R.range(-1, 0.8), sp = R.range(40, 100);
          bits.add({ kind: B.SHARD, x: HIT_AT[0] - 1, y: HIT_AT[1] + R.range(-2, 2), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 0.85, drag: 0.6, bounce: 0.3, life: R.range(0.5, 0.9), a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(1.2, 2.4), c: C[R.int(5, 7)] });
        }
      }
      if (!wave2 && t >= CRACK2) {
        wave2 = true;
        lights.add(0, -16, 36, C[6], 0.35, 0.15);
        for (let i = 0; i < 3; i++) bits.add({ kind: B.SHARD, x: R.range(-14, 18), y: -R.range(4, 30), vx: R.range(-30, 30), vy: -R.range(10, 50), g: 0.85, drag: 0.6, bounce: 0.3, life: R.range(0.4, 0.7), a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(1, 2), c: C[R.int(5, 7)] });
      }
      if (!white && t >= FLASH) {
        white = true;
        lights.add(2, -17, 44, WHITE, 0.7, 0.08);
      }
      if (!burst && t >= BURST) {
        burst = true;
        explode();
      }
      // glints wink on the settling debris
      if (burst && t < BURST + 1 && R.chance(0.08) && bits.list.length) {
        const b = R.pick(bits.list);
        ps.spawn(P.STAR, b.x, b.y - 1, 0, -3, R.range(0.2, 0.4), R.chance(0.5) ? WHITE : C[6], R.range(0.6, 1.5));
      }
      for (let i = scuffs.length - 1; i >= 0; i--) if ((scuffs[i].t += dt) > 0.9) scuffs.splice(i, 1);
      ps.update(dt);
      bits.update(dt);
      panes.update(dt);
      lights.update(dt);
      endBy(t, meta.duration, ps, bits, panes);
    },
    drawBack(p) {
      drawFloor(p);
      ps.draw(p, "back");
    },
    draw(p) {
      drawBlock(p);
      // the hit: a star and a short flare on the left face
      const h = t - HIT;
      if (h >= 0 && h < 0.2) {
        sparkle(p, HIT_AT[0] - 1, HIT_AT[1], 9 * ease.outBack(Math.min(1, h / 0.04)) * (1 - h / 0.2), C[6], C[4], 0.7);
        if (h < 0.08) flare(p, HIT_AT[0] - 1, HIT_AT[1], 14 * (1 - h / 0.08), 1 - h / 0.08, C);
      }
      // cold light in the ice, brighter as it cracks; a pool on the floor
      const k = 1 - smooth(BURST, BURST + 0.4, t), crk = smooth(HIT, FLASH, t);
      if (k > 0) {
        p.glow(2, -17, 34, C[4], (0.16 + 0.22 * crk) * k);
        p.glow(2, -2, 30, C[4], 0.14 * k);
      }
      if (t >= FLASH && t < BURST + 0.12) flare(p, 2, -17, 26 * (1 - clamp((t - FLASH) / 0.18)), 1 - clamp((t - FLASH) / 0.18), C);
      panes.draw(p, C);
      bits.draw(p);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/ice/frost-nova.js"] = function(exports, __req) {
const {  Particles, Bits, Lights, P, B, Rng, fit, crystal, band, flare, clamp, smooth, ease, rand, TAU, WHITE, READY  } = __req("core/index.js");

const meta = {
  name: "Frost nova",
  desc: "Frost spirals into a spinning snowflake, then a wave blooms three rings of ice crystals round the caster; snow drifts, frost creeps, and the ice melts back into the floor.",
  tags: ["ice", "nova", "aoe", "frost", "magic", "one-shot"],
  size: [288, 192],
  origin: [144, 150],
  duration: 3.4,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"], reach: 104, seed: 4 },
};

const HIGH = { turn: 1.15, crouch: 0, fx: -7, fy: -44, bx: 8, by: -44, ffx: -5, fbx: 6 };
const SLAM = { turn: 1.15, crouch: 8, lean: 3, fx: -9, fy: -8, bx: 11, by: -8, ffx: -8, fbx: 9 };
const EASE = { turn: 1, crouch: 2, fx: -8, fy: -17, bx: 9, by: -17, ffx: -4, fbx: 5 };
const act = {
  target: { x: 76 },
  poses: [
    [-0.34, READY],
    [-0.04, { ...HIGH, crouch: 2, fy: -36, by: -36 }],
    [0.36, HIGH],
    [0.42, SLAM, "snap"],
    [0.9, { ...SLAM, crouch: 7 }],
    [1.9, { ...SLAM, crouch: 6 }],
    [2.6, EASE],
    [3.4, READY],
  ],
  hits: [
    { t: 0.42, stop: 0.1, shake: 0.26, amp: 2, target: false },
    { t: 0.66, push: 0.9, straw: 6, y: -10, skin: "ice", shiver: 1.7 },
    { t: 2.9, push: 0.2, straw: 0, flash: 0, skin: null },
  ],
  dust: [{ t: 0.42, x: 10, n: 5, dir: 1, c: "#d8f2ff" }, { t: 0.42, x: -10, n: 5, dir: -1, c: "#d8f2ff" }],
};

const CHARGE = 0.42, SPREAD = 0.62, HOLD = 1.95, MELT = 0.7, CORE_Y = -24;
// three rings of crystals: tall ones hugging the caster, smaller ones further out
const RINGS = [
  { q: [0.15, 0.24], h: [24, 32], w: [10, 13], n: 2, kids: 2 },
  { q: [0.36, 0.52], h: [13, 19], w: [7, 9], n: 3, kids: 1 },
  { q: [0.62, 0.9], h: [5, 10], w: [4, 6], n: 4, kids: 0 },
];

// frost on the floor: a white crust, little tufts, a dithered bloom under the surface
function frost(p, C, x0, x1, reach, a, edge) {
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    const d = Math.abs(x + 0.5), q = d / reach, k = clamp((a * 1.15 - q) / 0.15);
    if (k <= 0) continue;
    const h = rand(x, 17), fresh = edge > 0 && d > edge - 3, tuft = h < 0.45 ? Math.round((1 + rand(x, 5) * 3) * (1 - q * 0.6)) : 0, D = (4 + rand(x, 11) * 4) * (1 - q * 0.5);
    p.dot(x, 0, fresh || h < 0.25 ? WHITE : C[6], k);
    for (let j = 1; j <= tuft; j++) p.dot(x, -j, j === tuft ? WHITE : C[5], k);
    if (tuft > 1 && rand(x, 9) < 0.5) p.dot(x + (rand(x, 3) < 0.5 ? -1 : 1), -tuft + 1, C[6], k);
    for (let j = 1; j <= D; j++) {
      const v = j / D;
      p.dot(x, j, rand(x * 31 + j, 7) < 0.06 ? WHITE : v < 0.25 ? C[6] : v < 0.55 ? C[5] : C[4], k * (1.1 - v) * (fresh ? 1.3 : 1));
    }
  }
}

// the snowflake the cold gathers into: six arms with side branches, spinning, pulsing
function snowflake(p, C, x, y, L, spin, k) {
  if (L < 0.8) return;
  for (let i = 0; i < 6; i++) {
    const a = spin + (i * TAU) / 6, ca = Math.cos(a), sa = Math.sin(a);
    for (let d = 0; d <= L; d += 0.5) p.dot(x + ca * d, y + sa * d, d < L * 0.4 ? WHITE : C[6], k + 0.2);
    if (L > 3)
      for (const s of [-1, 1]) {
        const bx = x + ca * L * 0.6, by = y + sa * L * 0.6, ba = a + s * 0.9;
        for (let d = 0; d <= L * 0.35; d += 0.5) p.dot(bx + Math.cos(ba) * d, by + Math.sin(ba) * d, C[5], k);
      }
  }
  p.px(x, y, WHITE);
  p.glow(x, y, 10 + L * 3, C[5], 0.35 + 0.5 * k);
}

function create(o) {
  const C = fit(o.palette, 8), DIM = [C[0], C[0], C[1], C[2], C[3], C[4], C[5], C[6]], REACH = o.reach;
  const R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[5] });
  const bits = new Bits({ ground: floor }), lights = new Lights();
  const front = (t) => (t < CHARGE ? 0 : REACH * (1 - Math.pow(1 - clamp((t - CHARGE) / SPREAD), 3)));
  const reachedAt = (d) => CHARGE + SPREAD * (1 - Math.cbrt(1 - Math.min(1, d / REACH)));
  // lay out the crystals: both sides, three rings, alternating back and front rows
  const sites = [];
  for (const side of [-1, 1])
    RINGS.forEach((ring, ri) => {
      for (let i = 0; i < ring.n; i++) {
        const q = ring.q[0] + ((ring.q[1] - ring.q[0]) * (i + R.range(0.2, 0.8))) / ring.n, h = R.range(...ring.h), w = R.range(...ring.w);
        const parts = [{ dx: 0, h, w, lean: side * h * R.range(0.1, 0.28) }];
        for (let k = 0; k < ring.kids; k++) {
          const s = k % 2 ? -side : side, kh = h * R.range(0.4, 0.62);
          parts.unshift({ dx: s * R.range(0.3, 0.5) * w, h: kh, w: w * 0.62, lean: s * kh * R.range(0.35, 0.6) });
        }
        sites.push({ x: side * q * REACH, d: q * REACH, h, back: (i + ri + (side > 0 ? 1 : 0)) % 2 === 1, t0: reachedAt(q * REACH) + R.range(0, 0.03), up: false, parts, phase: R.next() });
      }
    });
  let t = 0, released = false;
  const sink = (tt) => smooth(HOLD, HOLD + MELT, tt);

  const drawCrystals = (p, back) => {
    const m = sink(t);
    for (const s of sites) {
      if (!s.up || s.back !== back || m >= 1) continue;
      const g = ease.outBack(clamp((t - s.t0) / 0.1), 2.6), white = t < s.t0 + 0.03, sw = (((t - s.t0) * 0.7 + s.phase * 3) % 1.6) / 0.5;
      for (const q of s.parts)
        crystal(p, s.x + q.dx, back ? -1 : 0, q.h * g * (1 - m), q.w * (1 - m * 0.3), q.lean * g * (1 - m), back ? DIM : C, { white, glint: sw <= 1 ? sw : -1 });
    }
  };
  const ring = (p, back) => {
    if (t < CHARGE) return;
    const u = clamp((t - CHARGE) / (SPREAD + 0.15));
    if (u >= 1) return;
    band(p, 0, 0, front(t) + 2, 0.16, Math.max(2, 10 * Math.pow(1 - u, 0.7)), u < 0.75 ? 1 : (1 - u) / 0.25, C, (g) => Math.sin(g) < 0 === back, t - CHARGE < 0.1);
    if (!back) for (const s of [-1, 1]) p.glow(s * (front(t) + 2), -2, 22, C[5], 0.55 * (1 - u));
  };

  return {
    update(dt) {
      t += dt;
      if (t < CHARGE - 0.06) {
        // the cold gathers: streaks spiral in to the core, vapour slides in along the floor
        if (R.chance(0.9)) {
          const a = R.range(0, TAU), D = R.range(26, 58), T = R.range(0.2, 0.3), v = (D * 3) / (Math.exp(3 * T) - 1);
          const x = Math.cos(a) * D, y = Math.min(CORE_Y + Math.sin(a) * D * 0.8, -2), l = Math.hypot(x, y - CORE_Y) || 1;
          ps.spawn(P.STREAK, x, y, (-x / l) * v, ((CORE_Y - y) / l) * v, T, R.chance(0.5) ? C[6] : C[5]);
        }
        if (R.chance(0.14)) {
          const s = R.sign();
          ps.spawn(P.VAPOUR, s * R.range(28, 60), -R.range(0, 2), -s * R.range(35, 70), -R.range(0, 3), R.range(0.35, 0.5), C[6], R.range(2, 3));
        }
      }
      if (t >= CHARGE && !released) {
        released = true;
        lights.add(0, CORE_Y, 84, C[4], 0.8, 0.55);
        lights.add(0, CORE_Y, 45, WHITE, 0.7, 0.12);
        for (let i = 0; i < 22; i++) {
          const a = R.range(-Math.PI, 0.25), sp = R.range(110, 280);
          bits.add({ kind: B.SHARD, x: R.range(-3, 3), y: CORE_Y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.7, drag: 0.6, bounce: 0.3, life: R.range(0.9, 1.5), a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(1.5, 3.5), c: R.pick([C[7], C[6], C[5]]) });
        }
        for (let i = 0; i < 14; i++) {
          const a = R.range(-Math.PI, 0), sp = R.range(40, 160);
          ps.spawn(P.FLAKE, 0, CORE_Y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1.2, 1.8), R.chance(0.6) ? WHITE : C[6], R.range(0.5, 1.6));
        }
      }
      const fr = front(t);
      if (t > CHARGE && t < CHARGE + SPREAD)
        for (const s of [-1, 1]) {
          ps.spawn(P.VAPOUR, s * fr + R.range(-2, 2), -R.range(0, 5), s * R.range(15, 75), -R.range(2, 15), R.range(0.6, 1), R.chance(0.7) ? C[6] : C[5], R.range(3, 5.5) * (1 - 0.4 * (fr / REACH)));
          if (R.chance(0.45)) ps.spawn(P.FLAKE, s * fr, -2, s * R.range(10, 45), -R.range(30, 85), R.range(1.1, 1.9), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.2));
        }
      for (const s of sites) {
        if (!s.up && t >= s.t0) {
          s.up = true;
          // each crystal punches up with a spray of shards, a puff and a glint
          for (let i = 0; i < 2 + Math.round(s.h / 8); i++) {
            const a = -Math.PI / 2 + R.range(-1.3, 1.3), sp = R.range(60, 200) * (0.5 + s.h / 40);
            bits.add({ kind: B.SHARD, x: s.x + R.range(-3, 3), y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.8, drag: 0.6, bounce: 0.3, life: R.range(0.9, 1.6), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1.5, 3), c: R.pick([C[7], C[6], C[5]]) });
          }
          ps.spawn(P.VAPOUR, s.x, -1, R.range(-30, 30), -R.range(2, 8), R.range(0.5, 0.9), C[6], R.range(2.5, 4));
          if (s.h > 10) ps.spawn(P.STAR, s.x + R.range(-3, 3), -R.range(4, s.h * 0.8), 0, -3, R.range(0.3, 0.6), C[6], R.range(1, 2.4));
        }
      }
      // while it holds: glints run over the crystals, snow drifts down
      if (t > CHARGE + 0.2 && t < HOLD + 0.2) {
        if (R.chance(0.5)) {
          const s = R.pick(sites);
          if (s.up) ps.spawn(P.STAR, s.x + R.range(-3, 3), -R.range(2, s.h * 0.9), 0, -3, R.range(0.3, 0.6), R.chance(0.6) ? C[6] : WHITE, R.range(0.6, 2.2));
        }
        if (t < HOLD - 0.3 && R.chance(0.16)) ps.spawn(P.FLAKE, R.range(-1, 1) * fr, -R.range(40, 90), R.range(-5, 5), R.range(3, 10), R.range(1.1, 1.5), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.4));
      }
      // melting: drips run off the crystals, vapour lifts off the floor
      if (t > HOLD && t < HOLD + MELT) {
        if (R.chance(0.5)) {
          const s = R.pick(sites);
          bits.add({ kind: B.DRIP, x: s.x + R.range(-3, 3), y: -R.range(3, s.h * 0.6 * (1 - sink(t))), vy: 10, g: 0.6, life: 1, c: C[5] });
        }
        if (R.chance(0.25)) ps.spawn(P.VAPOUR, R.range(-1, 1) * REACH * 0.8, -R.range(0, 3), R.range(-10, 10), -R.range(6, 16), R.range(0.6, 1), C[5], R.range(3, 5));
      }
      ps.update(dt);
      bits.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const out = 1 - smooth(HOLD + 0.2, HOLD + MELT + 0.6, t), fr = front(t);
      if (out > 0 && t > CHARGE) frost(p, C, -Math.max(12, fr + 1), Math.max(12, fr + 1), REACH, out, fr);
      ring(p, true);
      drawCrystals(p, true);
      ps.draw(p, "back");
    },
    draw(p) {
      ring(p, false);
      drawCrystals(p, false);
      if (t < CHARGE) {
        const k = t / CHARGE, beat = 1 + 0.25 * Math.exp(-((t - CHARGE * 0.55) ** 2) / 0.002) + 0.3 * Math.exp(-((t - CHARGE * 0.85) ** 2) / 0.002);
        snowflake(p, C, 0, CORE_Y, (2 + 5.5 * k * k) * beat, t * 4, k);
      } else if (t < CHARGE + 0.22) {
        const a = (t - CHARGE) / 0.22;
        flare(p, 0, CORE_Y, 36 * Math.pow(1 - a, 1.5), 1 - a, C);
        p.glow(0, CORE_Y, 46, WHITE, 0.6 * (1 - a));
      }
      // the frosted floor gives off a cold light while the ice stands
      if (t > CHARGE) {
        const k = (1 - smooth(HOLD, HOLD + MELT + 0.3, t)) * (0.85 + 0.15 * Math.sin(t * 2.4)), fr = front(t);
        for (let i = -3; i <= 3; i++) p.glow((i / 3.5) * fr, -4, 26, C[4], 0.16 * k);
      }
      bits.draw(p);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
exports.act = act;
  };
  __mods["fx/ice/snowflake-burst.js"] = function(exports, __req) {
// The pop recipe (a gathering, a white flash with a ring and flares, twinkling motes that linger and fade) is
// adapted from Sprite Fusion's open-source sparkle (https://www.spritefusion.com/pixel-art-vfx/sparkle),
// MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, fit, flare, sparkle, clamp, smooth, seg, ease, TAU, WHITE  } = __req("core/index.js");
const {  flakeDesign, snowflake, endBy  } = __req("fx/ice/_lib.js");

const meta = {
  name: "Snowflake burst",
  desc: "A cold pop: frost gathers and flashes white in a ring, then crisp six-armed snowflakes spin out, slow, twinkle and drift down to settle and melt.",
  tags: ["ice", "snow", "snowflake", "burst", "magic", "one-shot"],
  size: [140, 120],
  origin: [70, 106],
  duration: 3.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"], count: 9, seed: 8 },
};

const POP = 0.16, CY = -48;

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[5] });
  const lights = new Lights();
  // the flakes: two big, a few middling, the rest small; small ones fly further
  const flakes = [];
  const SIZES = [2, 0, 1, 0, 2, 0, 1, 0, 1];
  for (let i = 0; i < o.count; i++) {
    const z = SIZES[i % SIZES.length], r = z === 2 ? R.range(9.5, 11.5) : z === 1 ? R.range(6, 7.5) : R.range(3, 4.5);
    const a = (i / o.count) * TAU + R.range(-0.3, 0.3) + 0.4, sp = R.range(80, 120) * (1.4 - r / 14);
    flakes.push({
      x: 0, y: CY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.85 - 20, r, rot: R.range(0, TAU), w0: R.sign() * R.range(7, 12), w1: R.sign() * R.range(0.4, 1),
      d: flakeDesign(R), life: R.range(2.1, 2.8), age: 0, ph: R.range(0, TAU), tw: R.range(0.5, 0.85), tw0: R.range(0.15, 0.6), rest: false, popped: false,
    });
  }
  let t = 0, popped = false;
  const sz = (f) => f.r * Math.min(1, ease.outBack(clamp(f.age / 0.18), 2)) * Math.min(1, (f.life - f.age) / 0.35);

  return {
    update(dt) {
      t += dt;
      // the cold gathers: streaks of frost spiral in, snow motes drift in
      if (t < POP - 0.03 && R.chance(0.8)) {
        const a = R.range(0, TAU), D = R.range(22, 44), T = R.range(0.12, 0.16), v = (D * 3) / (Math.exp(3 * T) - 1);
        ps.spawn(P.STREAK, Math.cos(a) * D, CY + Math.sin(a) * D, -Math.cos(a) * v, -Math.sin(a) * v, T, R.chance(0.5) ? C[6] : C[5]);
      }
      if (!popped && t >= POP) {
        popped = true;
        lights.add(0, CY, 44, WHITE, 0.8, 0.1);
        lights.add(0, CY, 72, C[4], 0.5, 0.6);
        // frost thrown out: streaking motes, snow, glints that come and go round it
        for (let i = 0; i < 22; i++) {
          const a = R.range(0, TAU), sp = R.range(80, 150);
          ps.spawn(P.MOTE, 0, CY, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.25, 0.5), R.chance(0.5) ? C[6] : C[5], R.range(0.6, 1));
        }
        for (let i = 0; i < 18; i++) {
          const a = R.range(-Math.PI, 0.2), sp = R.range(30, 110);
          ps.spawn(P.FLAKE, 0, CY, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1, 1.6), R.chance(0.6) ? WHITE : C[6], R.range(0.5, 1.5));
        }
        for (let i = 0; i < 12; i++) {
          const a = R.range(0, TAU), d = R.range(10, 44);
          ps.spawn(P.STAR, Math.cos(a) * d, CY + Math.sin(a) * d * 0.85, 0, R.range(2, 6), R.range(0.3, 0.6), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 2.2), R.range(0.08, 1.6));
        }
      }
      if (popped)
        for (const f of flakes) {
          f.age += dt;
          if (f.age >= f.life) continue;
          if (!f.rest) {
            f.vx -= f.vx * 2.8 * dt;
            f.vy -= f.vy * 2.8 * dt - 26 * dt;
            f.x += f.vx * dt + Math.sin(t * 1.8 + f.ph) * 5 * dt;
            f.y += f.vy * dt;
            f.rot += (f.w1 + (f.w0 - f.w1) * Math.exp(-f.age * 2.5)) * dt;
            // it settles on the floor, flat and still, and melts there
            if (f.y > -sz(f) * 0.3) {
              f.rest = true;
              f.y = -1;
              f.life = Math.min(f.life, f.age + 0.6);
            }
          }
          // a melted or spent flake goes out with a glint or two
          if (!f.popped && f.life - f.age < 0.1) {
            f.popped = true;
            for (let i = 0; i < 2; i++) ps.spawn(P.STAR, f.x + R.range(-2, 2), f.y + R.range(-2, 2), R.range(-6, 6), -R.range(2, 8), R.range(0.2, 0.4), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 1.6));
          }
        }
      ps.update(dt);
      lights.update(dt);
      endBy(t, meta.duration, ps);
    },
    draw(p) {
      // the gathering: a tiny flake spins up at the heart, faster and brighter
      if (t < POP) {
        const k = t / POP;
        snowflake(p, 0, CY, 1 + 3.2 * k * k, t * 20, flakes[0].d, C, { hot: k });
        p.glow(0, CY, 8 + 14 * k, C[5], 0.3 + 0.4 * k);
      }
      // the pop: a white flash, a flare and a ring of frost running out
      const q = t - POP;
      if (q >= 0 && q < 0.4) {
        if (q < 0.07) p.circle(0, CY, 6 * (1 - q / 0.07) + 1, WHITE);
        flare(p, 0, CY, 28 * Math.pow(Math.max(0, 1 - q / 0.26), 1.5), 1 - q / 0.26, C);
        const e = ease.outCubic(q / 0.4), r = 5 + 34 * e;
        p.ring(0, CY, r, Math.max(1, 2.4 * (1 - e)), q < 0.08 ? WHITE : q < 0.2 ? C[6] : C[5], 1.15 - e);
        p.glowRing(0, CY, r, 5, C[5], 0.4 * (1 - e));
      }
      // the cold light left where it burst, fading
      if (popped) p.glow(0, CY, 46, C[4], 0.3 * (1 - smooth(POP, POP + 1.6, t)));
      // the flakes: spinning out, twinkling now and then, landing and melting
      for (const f of flakes) {
        if (!popped || f.age >= f.life) continue;
        const r = sz(f), tw = Math.max(0, Math.sin(((f.age - f.tw0) / f.tw) * TAU)) ** 8 * (f.age > f.tw0 ? 1 : 0);
        if (f.rest) {
          // lying on the floor: flattened to a sparkling smear that shrinks away
          const L = Math.max(1, Math.round(r * 1.2 * ((f.life - f.age) / 0.6)));
          for (let i = -L; i <= L; i++) p.px(f.x + i, -1, Math.abs(i) === L ? C[5] : i === 0 ? WHITE : C[6]);
          p.glow(f.x, -1, 3 + L, C[4], 0.3);
          continue;
        }
        snowflake(p, f.x, f.y, r, f.rot, f.d, C, { hot: Math.max(tw, 1 - clamp(f.age / 0.12)) });
        p.glow(f.x, f.y, 6 + r * 1.4, C[4], 0.12);
        if (tw > 0.5) flare(p, f.x, f.y, (3 + r * 0.7) * tw, tw, C);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/shadow/soul-drain.js"] = function(exports, __req) {
const {  cycle, fit, smooth, ease, rand, TAU, WHITE  } = __req("core/index.js");
const {  VOID, ringFast, halo  } = __req("fx/shadow/_lib.js");

const meta = {
  name: "Soul drain",
  desc: "Pale souls are torn loose on the right and dragged down a funnel of streaks into a black crystal vessel, which flares violet as each one lands.",
  tags: ["shadow", "soul", "drain", "necromancy", "funnel", "directional", "magic", "loop"],
  size: [208, 120],
  origin: [40, 110],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: VOID, soul: ["#2c3f66", "#7d9fd0", "#cfe6ff", "#ffffff"], seed: 8 },
};

// the vessel's centre; the loop; the funnel's streamlines (start points out on the right); four souls a loop
const VY = -50, D = 3.2, LINES = 11, SOULS = 4, TRAVEL = 1.45;
const wrap = (x) => ((x % D) + D) % D;
const line = (i) => {
  const sx = 96 + rand(i, 1) * 64, sy = -88 + rand(i, 2) * 72, bend = (rand(i, 3) - 0.5) * 50;
  return { sx, sy, c1x: sx * 0.55, c1y: sy + bend, c2x: 22 + rand(i, 4) * 14, c2y: VY + (sy - VY) * 0.25 };
};
const LN = Array.from({ length: LINES }, (_, i) => line(i));
// a point along streamline i at u (0 at its start, 1 at the vessel), cubic bezier
function along(L, u) {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return [a * L.sx + b * L.c1x + c * L.c2x, a * L.sy + b * L.c1y + c * L.c2y + d * (VY - L.sy) + d * L.sy];
}
const soul = (j) => ({ born: (j + 0.15 + rand(j, 7) * 0.5) * (D / SOULS), line: Math.floor(rand(j, 8) * LINES) });
const landings = (t) => {
  let f = 0;
  for (let j = 0; j < SOULS; j++) {
    const since = wrap(t - soul(j).born - TRAVEL);
    f += Math.exp(-since / 0.14) * (since < 1 ? 1 : 0);
  }
  return Math.min(1.4, f);
};

// the vessel: a black crystal, two facets lit violet from inside, a hard ridge, a heart of stolen light
function vessel(p, C, t, f) {
  const y0 = VY + Math.sin((TAU * t) / D) * 1.5, W = 9, UP = 14, DN = 12;
  p.shade(-W - 1, y0 - UP - 1, W + 1, y0 + DN + 1, (x, y) => {
    const dy = y - y0, half = dy < 0 ? W * (1 + dy / UP) : W * (1 - dy / DN);
    if (half <= 0 || Math.abs(x) > half + 0.6) return;
    if (Math.abs(x) > half - 0.4) return f > 0.5 ? C[6] : C[1];
    const ridge = Math.abs(x + dy * 0.12) < 0.6, heart = Math.abs(x) + Math.abs(dy - 1) < 2.6 + f * 1.5;
    if (heart) return f > 0.4 ? WHITE : C[6];
    if (ridge) return f > 0.3 ? C[7] : C[5];
    if (x < 0) return dy < 0 ? (f > 0.2 ? C[5] : C[4]) : C[3];
    return dy < 0 ? C[2] : C[1];
  });
  p.glow(0, y0, 30 + 14 * f, C[5], 0.5 + 0.5 * f);
  p.glow(0, y0 + 1, 8, WHITE, 0.25 + 0.6 * f);
  return y0;
}

function drawBack(p, t, o) {
  const C = fit(o.palette, 8);
  // the funnel: streamlines bunching into the vessel, dashes running down them, brighter as they close in
  for (let i = 0; i < LINES; i++) {
    const L = LN[i], ph = wrap(t + i * 0.37) / D;
    let px = null, py = null;
    for (let u = 0; u <= 1.0001; u += 0.01) {
      const [x, y] = along(L, u), dash = (((u * 5 - ph * 10 + i * 0.3) % 1) + 1) % 1;
      // a faint line the whole way, bright dashes riding it inward, all brighter as it narrows
      if (px !== null) p.line(px, py, x, y, u > 0.6 ? C[3] : C[2], 0.4 + 0.6 * u);
      if (dash < 0.18) p.px(x, y, u > 0.7 ? C[7] : u > 0.35 ? C[6] : C[5]);
      (px = x), (py = y);
    }
  }
  p.glow(10, VY, 40, C[4], 0.22);
}

function draw(p, t, o) {
  const C = fit(o.palette, 8), S = fit(o.soul, 4), f = landings(t);
  // where the souls are torn from: a faint pale haze out on the right
  cycle(t, D, 10, o.seed, (r) => r.range(0.8, 1.3), (age, Lf, r) => {
    const x = r.range(100, 150), y = r.range(-80, -20) - age * 18, u = age / Lf;
    p.dot(x, y, S[2], (1 - u) * 0.8);
    p.glow(x, y, 4, S[1], 0.2 * (1 - u));
  });
  // streaks racing down the funnel, faster as they close on the vessel, white at the head
  cycle(t, D, 22, o.seed + 1, (r) => r.range(0.4, 0.7), (age, Lf, r) => {
    const L = LN[Math.floor(r.next() * LINES)], u0 = r.range(0.15, 0.5), q = u0 + (1 - u0) * Math.pow(age / Lf, 2.2), q2 = u0 + (1 - u0) * Math.pow(Math.max(0, age - 0.06) / Lf, 2.2);
    const [x, y] = along(L, q), [tx, ty] = along(L, q2);
    p.line(tx, ty, x, y, (v) => (v > 0.7 ? WHITE : v > 0.35 ? C[6] : C[4]));
    p.glow(x, y, 4, C[6], 0.35);
  });
  const y0 = vessel(p, C, t, f);
  // motes circling the vessel, in front and behind it
  for (let k = 0; k < 6; k++) {
    const a = (TAU * (2 * t)) / D + (k * TAU) / 6, ex = Math.cos(a) * 15, ey = Math.sin(a) * 5 - 2, z = Math.sin(a);
    p.px(ex, y0 + ey, z > 0 ? C[7] : C[4]);
    if (z > 0) p.glow(ex, y0 + ey, 4, C[6], 0.35);
  }
  // the souls: a pale head with hollow eyes and an open mouth, a wavering tail, dragged faster as they go
  for (let j = 0; j < SOULS; j++) {
    const s = soul(j), age = wrap(t - s.born);
    if (age > TRAVEL) continue;
    const L = LN[s.line], u = Math.pow(age / TRAVEL, 1.8), [x, y] = along(L, u);
    if (age < 0.18) {
      const k = 1 - age / 0.18;
      ringFast(p, L.sx, L.sy, 3 + 9 * (1 - k), 1, k > 0.5 ? S[2] : S[1]);
      p.glow(L.sx, L.sy, 12, S[1], 0.5 * k);
    }
    // the tail: a wavering wisp, pale near the head, thinning to violet
    for (let k = 14; k >= 1; k--) {
      const uu = Math.pow(Math.max(0, age - k * 0.03) / TRAVEL, 1.8), [tx, ty] = along(L, uu), w = Math.sin(t * 12 + k * 0.8 + j) * k * 0.16;
      const r = Math.max(0.5, 2.6 - k * 0.17);
      p.disc(tx, ty + w, r, k < 4 ? S[2] : k < 9 ? S[1] : C[5], 0.75 * (1 - k / 15));
    }
    // the head: a pale round face, hollow eyes and an open mouth, a lit rim, stretched as it nears the vessel
    const near = smooth(0.82, 1, u), hr = 3.4 - near * 1.6;
    p.circle(x, y, hr + 0.8, S[1]);
    p.circle(x, y, hr, S[2]);
    p.px(x - 1, y - 2, S[3]);
    p.px(x - 2, y - 1, S[3]);
    if (near < 0.5) {
      p.px(x - 1.5, y, S[0]);
      p.px(x + 1.5, y, S[0]);
      p.px(x, y + 1.6, S[0]);
      p.px(x, y + 2.4, S[0]);
    }
    p.glow(x, y, 10, S[1], 0.5);
  }
  // each landing: a flash in the heart, a ring off the crystal, a glint
  for (let j = 0; j < SOULS; j++) {
    const since = wrap(t - soul(j).born - TRAVEL);
    if (since < 0.3) {
      const k = since / 0.3;
      ringFast(p, 0, y0, 6 + 18 * ease.outCubic(k), Math.max(1, 2 * (1 - k)), k < 0.4 ? C[7] : k < 0.7 ? C[5] : C[3]);
    }
  }
  halo(p, 0, y0, 4, 22, C[6], 0.25 * f);
}

exports.drawBack = drawBack;
exports.draw = draw;
exports.meta = meta;
  };
  __mods["fx/shadow/_lib.js"] = function(exports, __req) {
// The flame puff (after sim.js's FIRE) and the swirling pull (attract) are adapted from Sprite Fusion's
// open-source black-hole (https://www.spritefusion.com/pixel-art-vfx/black-hole),
// MIT License, Copyright (c) 2026 Hugo Duprez.
//
// Shared bits for the shadow effects (files starting with _ are helpers, not effects): the void palette,
// light that black shapes cut, smoke lit from one side, violet flame, obsidian slivers, ink drops.

const {  hex, mix, ramp, clamp, noise, WHITE, GRAVITY  } = __req("core/index.js");

/** Dark magic, dark to bright: void black, deep violet, a white-lilac edge. */
const VOID = ["#06040b", "#150c26", "#2a1150", "#461a84", "#6f2cc0", "#9d5cec", "#cfa6ff", "#f6eaff"];

/**
 * Take the light back off every pixel in a local box where dark(x, y) is true, keeping a share keep (0..1):
 * call it last, so black shapes stay black under every glow, spark and ring drawn before.
 */
function unlight(p, x0, y0, x1, y1, dark, keep = 0) {
  const L = p.L, w = p.w, ox = p.ox, oy = p.oy;
  p.each(x0, y0, x1, y1, (x, y, sx, sy) => {
    if (!dark(x, y)) return;
    const i = (sy - oy) * w + (sx - ox), d = L[i];
    if (!d) return;
    if (keep <= 0) L[i] = 0;
    else L[i] = (255 << 24) | ((((d >>> 16) & 255) * keep) << 16) | ((((d >>> 8) & 255) * keep) << 8) | ((d & 255) * keep);
  });
}

// the pixel cells of the annulus r0 <= d < r1 round (x, y), row by row, jumping the hole: fn(cx, cy, d)
function annulus(x, y, r0, r1, fn) {
  const r02 = r0 > 0 ? r0 * r0 : -1, r12 = r1 * r1;
  for (let py = Math.floor(y - r1); py <= Math.ceil(y + r1); py++) {
    const cy = py + 0.5, dy = cy - y, dy2 = dy * dy;
    if (dy2 >= r12) continue;
    const xo = Math.sqrt(r12 - dy2), xi = dy2 < r02 ? Math.sqrt(r02 - dy2) : 0;
    for (let px = Math.floor(x - xo), x1 = Math.ceil(x + xo); px <= x1; px++) {
      const cx = px + 0.5, dx = cx - x;
      if (xi > 0 && dx > -xi && dx < xi) {
        px = Math.max(px, Math.floor(x + xi) - 1);
        continue;
      }
      const d2 = dx * dx + dy2;
      if (d2 < r12 && d2 >= r02) fn(cx, cy, Math.sqrt(d2));
    }
  }
}

/**
 * A ring from radius r - w out to r round (x, y), like p.ring (c and a may be functions of v: 0 inner to 1
 * outer, and angle) but visiting only the band's own pixels, so a big thin shock ring stays cheap.
 */
function ringFast(p, x, y, r, w, c, a = 1) {
  if (r <= 0) return;
  const r0 = Math.max(0, r - w), fc = typeof c === "function", fa = typeof a === "function";
  annulus(x, y, r0, r, (cx, cy, d) => {
    const v = (d - r0) / (r - r0 || 1), ang = fc || fa ? Math.atan2(cy - y, cx - x) : 0;
    p.dot(cx, cy, fc ? c(v, ang) : c, fa ? a(v, ang) : a);
  });
}

/** Light hugging a circle of radius R at (x, y), falling off over w either side, only where keep(x, y). */
function ringLight(p, x, y, R, w, c, k, keep = null) {
  if (w < 1 || k <= 0.004) return;
  const col = hex(c);
  annulus(x, y, Math.max(0, R - w), R + w, (cx, cy, d) => {
    if (keep && !keep(cx, cy)) return;
    const f = 1 - Math.abs(d - R) / w;
    p.light(cx, cy, col, f * f * k);
  });
}

/** A ring of light hugging a black disc: k at radius r0, falling to nothing at r1, and none inside r0. */
function halo(p, x, y, r0, r1, c, k) {
  if (r1 <= r0 || k <= 0.004) return;
  const col = hex(c), w = r1 - r0;
  annulus(x, y, Math.max(0, r0), r1, (cx, cy, d) => {
    const f = 1 - (d - r0) / w;
    p.light(cx, cy, col, f * f * k);
  });
}

/**
 * A black star rasterized once: four long arms (L) and four short ones, turned rot, at (0, cy), its cells
 * in a grid. { at(x, y) } says if a local point is black; draw(p, c, rim, skip) fills it and burns a rim on
 * the cells just outside it (except where skip(x, y)). The arms keep a 1 px black spine to their tips.
 */
function blackStar(cy, L, rot, short = 0.46, q = 0.32) {
  const R0 = Math.ceil(L) + 2, n = R0 * 2 + 1, data = new Uint8Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = i - R0 + 0.5, y = cy + j - R0 + 0.5;
      if (inStar(x, y, 0, cy, L, rot, q) || inStar(x, y, 0, cy, L * short, rot + Math.PI / 4, q)) data[j * n + i] = 1;
    }
  for (let a = 0; a < 4; a++)
    for (let d = 0, ca = Math.cos(rot + (a * Math.PI) / 2), sa = Math.sin(rot + (a * Math.PI) / 2); d < L - 1; d += 0.5) {
      const i = Math.floor(ca * d) + R0, j = Math.floor(sa * d) + R0;
      data[j * n + i] = 1;
    }
  const at = (x, y) => {
    const i = Math.floor(x) + R0, j = Math.floor(y - cy) + R0;
    return i >= 0 && j >= 0 && i < n && j < n && data[j * n + i] === 1;
  };
  return {
    R0,
    at,
    /** take the light off its black cells (call last, like unlight) */
    unlight(p) {
      const Lb = p.L, w = p.w, h = p.h, ox = p.ox, oy = p.oy;
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          if (!data[j * n + i]) continue;
          const x = i - R0 + 0.5, y = cy + j - R0 + 0.5, sx = p.cellX(x, y) - ox, sy = p.cellY(x, y) - oy;
          if (sx >= 0 && sy >= 0 && sx < w && sy < h) Lb[sy * w + sx] = 0;
        }
    },
    draw(p, c, rim, skip) {
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const x = i - R0 + 0.5, y = cy + j - R0 + 0.5;
          if (data[j * n + i]) p.px(x, y, c);
          else if (rim && !skip(x, y) && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) p.px(x, y, rim);
        }
    },
  };
}

/** Is (x, y) inside a four-point star at (cx, cy), arms L long, turned rot? q < 1 hollows the sides into thin spikes. */
function inStar(x, y, cx, cy, L, rot, q = 0.42) {
  if (L <= 0) return false;
  const c = Math.cos(rot), s = Math.sin(rot), dx = x - cx, dy = y - cy;
  const u = Math.abs(dx * c + dy * s) / L, v = Math.abs(-dx * s + dy * c) / L;
  // inside needs the smaller of u, v under 0.5^(1/q): most points fail that before any pow
  return u < 1 && v < 1 && Math.min(u, v) <= Math.pow(0.5, 1 / q) && Math.pow(u, q) + Math.pow(v, q) <= 1;
}

/**
 * Pull particles (anything with x, y, vx, vy) toward (x, y): gravity softened at r0, a swirl round it, drag
 * that grows inside reach. Those that reach r0 are eaten (removed); returns how many. w(q) weighs each one
 * (0 leaves it alone).
 */
function attract(list, x, y, G, reach, swirl, r0, dt, w = () => 1, vmax = Infinity) {
  let eaten = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i], wt = w(q);
    if (!wt || q.delay > 0) continue;
    const dx = x - q.x, dy = y - q.y, d2 = dx * dx + dy * dy;
    if (d2 > reach * reach) continue;
    const d = Math.sqrt(d2) || 1;
    if (d < r0) {
      list.splice(i, 1);
      eaten++;
      continue;
    }
    const a = (G / (d2 + r0 * r0)) * Math.min(1, (reach - d) / (reach * 0.25)) * wt * dt, ux = dx / d, uy = dy / d;
    q.vx += (ux - uy * swirl) * a;
    q.vy += (uy + ux * swirl) * a;
    const drag = Math.min(0.2, (1 - d / reach) * 1.6 * dt);
    q.vx -= q.vx * drag;
    q.vy -= q.vy * drag;
    const v = Math.hypot(q.vx, q.vy);
    if (v > vmax) (q.vx *= vmax / v), (q.vy *= vmax / v);
  }
  return eaten;
}

/** Puff kinds: FLAME (a ball of flame cooling down a ramp), SOOT (dark smoke lit on the side facing a light). */
const PK = { FLAME: 0, SOOT: 1 };

/**
 * Violet flame and dark smoke. opts: { rng, flame: ramp white-hot to burnt out, soot: [fresh, old] smoke
 * colours, cap: the soot's dim lit top, rim: [hot, warm, dim] colours of its lit side, floor: (x) => y }.
 * spawn(kind, x, y, vx, vy, life, size, delay, smokes): smokes turns a dying flame into soot.
 * draw(p, kind, light): light = { x, y, k, reach } is what the soot's rims face (k 0 leaves them dark).
 */
class Puffs {
  constructor(o) {
    this.R = o.rng;
    this.list = [];
    this.t = 0;
    this.F = ramp(o.flame);
    this.soot = ramp(o.soot);
    this.cap = hex(o.cap);
    this.rim = ramp(o.rim);
    this.floor = o.floor ?? null;
  }
  spawn(k, x, y, vx, vy, life, size, delay = 0, smokes = false) {
    this.list.push({ k, x, y, vx, vy, life, max: life, size, delay, smokes, seed: this.R.next() * 100 });
  }
  get count() {
    return this.list.length;
  }
  update(dt) {
    this.t += dt;
    const t = this.t;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const q = this.list[i];
      if (q.delay > 0) {
        q.delay -= dt;
        continue;
      }
      if ((q.life -= dt) <= 0) {
        if (q.k === PK.FLAME && q.smokes) this.spawn(PK.SOOT, q.x, q.y - 1, q.vx * 0.5, q.vy * 0.5 - 6, this.R.range(0.9, 1.6), q.size * 1.25);
        this.list.splice(i, 1);
        continue;
      }
      if (q.k === PK.FLAME) {
        q.vy -= 95 * dt;
        q.vx += Math.sin(t * 17 + q.seed) * 30 * dt;
        q.vx -= q.vx * 5 * dt;
        q.vy -= q.vy * 3.2 * dt;
      } else {
        q.vy -= 18 * dt;
        q.vx += Math.sin(t * 1.3 + q.seed) * 8 * dt;
        q.vx -= q.vx * 1.6 * dt;
        q.vy -= q.vy * 1.3 * dt;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      // smoke rolls along the floor rather than through it
      if (this.floor && q.k === PK.SOOT) {
        const f = this.floor(q.x) - q.size * 0.6;
        if (q.y > f) (q.y = f), (q.vy = Math.min(0, q.vy)), (q.vx *= 1 - 2 * dt);
      }
    }
  }
  draw(p, kind, light = null) {
    const F = this.F, n = F.length;
    for (const q of this.list) {
      if (q.delay > 0 || q.k !== kind) continue;
      const k = q.life / q.max, age = 1 - k, x = q.x, y = q.y;
      if (q.k === PK.FLAME) {
        // a ball of flame: a darker rim, a lit core up and left, a tongue on top, a hot heart while young
        const heat = Math.min(0.999, Math.pow(age, 0.62) + (q.seed % 1) * 0.1), idx = Math.min(n - 2, Math.floor(heat * (n - 1)));
        const r = q.size * (0.55 + 0.45 * Math.min(1, age * 7)) * (1 - age * 0.55), c = F[idx];
        if (idx >= n - 3) p.disc(x, y, r, c, Math.min(1, k * 3) * 0.8);
        else {
          p.circle(x, y, r, F[Math.min(n - 1, idx + 2)]);
          p.circle(x - r * 0.16, y - r * 0.22, r * 0.78, c);
          if (r > 1.6) p.circle(x, y - r * 0.9, r * 0.42, c);
          if (idx <= 3 && r > 1.8) p.circle(x - r * 0.28, y - r * 0.34, r * 0.36, F[Math.max(0, idx - 1)]);
          if (idx < 6) p.glow(x, y, r * 2.4 + 2, c, 0.2 * k);
        }
        continue;
      }
      // soot: a soft body and a denser core, a dim cap on top, and lit from the side facing the light by two
      // discs pushed toward it (a soft wash over the near half, a brighter lip at its edge)
      const r = q.size * (0.65 + Math.min(1, age * 2.5) * 0.45 + age * 0.45);
      const a = Math.min(1, age * 10) * Math.min(1, k * 2.2) * 0.72, body = mix(this.soot[0], this.soot[1], age);
      // one pass for the body: thinner at the edge, denser in the core (two layers' worth)
      const edge = a * 0.5, core = 1 - (1 - a * 0.5) * (1 - a * 0.62);
      p.disc(x, y + r * 0.06, r, body, (d) => (d < 0.72 ? core : edge));
      const lk = light ? light.k : 0;
      if (lk < 0.5) p.disc(x - r * 0.2, y - r * 0.32, r * 0.48, this.cap, a * 0.32 * (1 - age * 0.7) * (1 - lk * 2));
      if (lk <= 0.02) continue;
      const lx = light.x - x, ly = light.y - y, dl = Math.sqrt(lx * lx + ly * ly) || 1, ux = lx / dl, uy = ly / dl;
      const lit = Math.min(1, light.k * clamp(1.3 - dl / light.reach)) * a;
      if (lit <= 0.02) continue;
      const [hot, warm, dim] = this.rim;
      p.disc(x + ux * r * 0.26, y + uy * r * 0.26, r * 0.72, dim, lit * 0.55);
      p.disc(x + ux * r * 0.5, y + uy * r * 0.5, r * 0.46, warm, lit * 0.5);
      if (r > 3) p.disc(x + ux * r * 0.68, y + uy * r * 0.68, r * 0.24, hot, lit * 0.4);
    }
  }
}

/**
 * An obsidian shard from core Bits ({ x, y, a, s, life }): a thin triangle pointing along its spin angle, a
 * dark violet body, the long edge facing the light at (lx, ly) lit (brighter with lk), the other in shadow,
 * a white glint at the tip while the light is strong. C is an 8-step palette.
 */
function shard(p, b, C, lx, ly, lk) {
  const fa = Math.min(1, b.life / 0.4), ca = Math.cos(b.a), sa = Math.sin(b.a), L = Math.max(2, b.s), W = Math.max(2, L * 0.55);
  const side = -sa * (lx - b.x) + ca * (ly - b.y) > 0 ? 1 : -1;
  const rim = lk > 0.6 ? C[6] : lk > 0.3 ? C[5] : lk > 0.08 ? C[4] : C[3], E = L / 2 + 1.5;
  p.shade(b.x - E, b.y - E, b.x + E, b.y + E, (x, y, out) => {
    const dx = x - b.x, dy = y - b.y, u = dx * ca + dy * sa, v = (-dx * sa + dy * ca) * side;
    if (u < -L / 2 - 0.4 || u > L / 2 + 0.4) return;
    const half = ((W / 2) * (L / 2 - u)) / L + 0.4;
    if (Math.abs(v) > half) return;
    out.a = fa;
    if (u > L / 2 - 1.3 && lk > 0.3) return WHITE;
    if (v > half - 1) return u > -L / 4 ? rim : C[Math.max(3, C.indexOf(rim) - 1)];
    return v < -half + 1 ? C[1] : C[2];
  });
  if (lk > 0.04) p.glow(b.x, b.y, 3 + L * 0.6, C[5], 0.2 * lk * fa);
}

/**
 * Ink drops: fly under gravity, land on the floor (y = floor(x)) and call onLand(x, y, speed).
 * add(x, y, vx, vy, size); update(dt); draw(p, body, shine) draws a dark drop with a lit top.
 */
class Drops {
  constructor(o = {}) {
    this.list = [];
    this.floor = o.floor ?? (() => 0);
    this.onLand = o.onLand ?? null;
    this.g = o.g ?? 0.8;
  }
  add(x, y, vx, vy, size = 1) {
    this.list.push({ x, y, vx, vy, size });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      d.vy += GRAVITY * this.g * dt;
      d.vx -= d.vx * 0.4 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const f = this.floor(d.x);
      if (d.vy > 0 && d.y >= f) {
        this.onLand?.(d.x, f, d.vy, d.size);
        this.list.splice(i, 1);
      }
    }
  }
  draw(p, body, shine) {
    for (const d of this.list) {
      const up = d.vy < 0;
      p.px(d.x, d.y, body);
      if (d.size > 1.4) p.px(d.x, d.y + (up ? 1 : -1), body);
      p.px(d.x, d.y - (d.size > 1.4 && !up ? 1 : 0), shine);
    }
  }
}

/**
 * A dark pool opened in the floor, seen at a slant (radius rx, centred on the floor at x = 0): the far lip lit,
 * the near lip dark, ripples ({ x, t0, life, w }) running out across it, a sheen along the far side, a wet fringe.
 */
function floorPool(p, C, rx, t, ripples) {
  if (rx < 1) return;
  const ry = rx * 0.17 + 0.6;
  p.shade(-rx - 3, -ry - 2, rx + 3, ry + 2, (x, y) => {
    const dx = x / rx, dy = (y - 0.5) / ry, d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1.18) return;
    if (d > 1) {
      if (dy < 0 && d < 1.09) return Math.abs(dx) < 0.55 ? C[6] : Math.abs(dx) < 0.85 ? C[5] : C[4];
      if (dy >= 0 && d < 1.09) return C[2];
      return y > -0.5 && noise(x * 0.7, 9) > 0.15 ? C[1] : undefined;
    }
    // ripples: ellipses on the slanted surface, kept about a pixel thick all the way round
    for (const r of ripples) {
      const age = t - r.t0, rr = age * 46 * r.w + 1, ex = x - r.x, ey = (y - 0.5) / 0.17, e = Math.sqrt(ex * ex + ey * ey) || 1;
      const g = Math.sqrt(ex * ex + (ey / 0.17) ** 2) / e;
      if (Math.abs(e - rr) < 0.55 * g && age < r.life) return age < r.life * 0.5 ? C[4] : C[3];
    }
    if (dy < -0.55 && dy > -0.85 && noise(x * 0.25 + t * 1.3, 4) > 0.2) return noise(x * 0.6 - t * 2, 6) > 0.55 ? C[5] : C[2];
    // the far inner wall catches the glow from below: violet just under the lip, falling to black
    if (dy < -0.35 && d > 0.72) return d > 0.9 ? C[3] : C[2];
    return d > 0.86 ? C[1] : C[0];
  });
}

exports.unlight = unlight;
exports.ringFast = ringFast;
exports.ringLight = ringLight;
exports.halo = halo;
exports.blackStar = blackStar;
exports.inStar = inStar;
exports.attract = attract;
exports.shard = shard;
exports.floorPool = floorPool;
exports.Puffs = Puffs;
exports.Drops = Drops;
exports.VOID = VOID;
exports.PK = PK;
  };
  __mods["fx/shadow/dark-explosion.js"] = function(exports, __req) {
// The pull that swirls motes into the core and the collapse burst are adapted from Sprite Fusion's open-source
// black-hole (https://www.spritefusion.com/pixel-art-vfx/black-hole), the sparks, rings and smoke from his explosion,
// MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Bits, P, B, Rng, fit, sparkle, band, clamp, smooth, ease, noise, hex, TAU, WHITE, mix  } = __req("core/index.js");
const {  VOID, Puffs, PK, halo, ringLight, ringFast, unlight, blackStar, attract, shard  } = __req("fx/shadow/_lib.js");

const meta = {
  name: "Dark explosion",
  desc: "Motes swirl into a pulsing core, a black star cuts across a violet-white flash, and a black sphere burns at the rim, throws lit shards and smoke, then collapses.",
  tags: ["shadow", "explosion", "void", "dark", "magic", "impact", "one-shot"],
  size: [280, 248],
  origin: [140, 206],
  duration: 3.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: VOID, seed: 6 },
};

// the heart of the blast hangs above the floor; the sphere's radius; the beats of the choreography
const Y = -54, RS = 16, REL = 0.52, BURN = 1.62, POP = 1.84, SMOKE = hex("#5d5468");

// a black sphere: a void body (a faint crescent of reflected light low on the right, a dull glint high on the
// left), a white rim, and pointed tongues of violet flame that lean up, flicker and crawl round it
function sphere(p, C, r, t, heat) {
  if (r < 0.6) return;
  const E = r + 12 * heat + 2;
  p.shade(-E, Y - E, E, Y + E, (x, y, out) => {
    const dx = x, dy = y - Y, d = Math.sqrt(dx * dx + dy * dy);
    if (d > E) return;
    if (d < r - 0.5) {
      const e = r - d, ang = Math.atan2(dy, dx);
      if (e < 1.4 && Math.cos(ang - 0.8) > 0.55) return C[2];
      if (r > 8 && (dx + r * 0.45) ** 2 + (dy + r * 0.45) ** 2 < 1.6) return C[3];
      return C[0];
    }
    const e = d - (r - 0.5);
    if (e < 1) {
      out.c = Math.sin(Math.atan2(dy, dx) * 7 + t * 9) > -0.6 ? WHITE : C[7];
      out.k = 0.4;
      return;
    }
    // the further out, the lower the angle it's sampled at: tongues bend upward like flame
    const ang = Math.atan2(dy + e * 0.6, dx), top = Math.max(0, -Math.sin(ang));
    const a1 = ang - t * 0.9, a2 = ang + t * 1.7;
    const i1 = Math.round((a1 * 9) / TAU), i2 = Math.round((a2 * 15) / TAU);
    const T1 = Math.pow(0.5 + 0.5 * Math.cos(a1 * 9), 3) * (0.55 + 0.45 * noise(t * 7 + i1 * 3.7, 1));
    const T2 = Math.pow(0.5 + 0.5 * Math.cos(a2 * 15), 4) * (0.5 + 0.5 * noise(t * 11 + i2 * 5.1, 2));
    const h = heat * (0.3 + 0.95 * top) * (1.5 + 12 * Math.max(0, T1) + 6 * Math.max(0, T2));
    if (e > h + 1) return;
    const u = (e - 1) / h;
    out.c = u < 0.18 ? WHITE : u < 0.4 ? C[7] : u < 0.62 ? C[6] : u < 0.84 ? C[5] : C[4];
    out.a = u < 0.8 ? 1 : (1 - u) * 5;
    if (u < 0.6 && ((Math.floor(x) + Math.floor(y)) & 1) === 0) out.k = 0.25 * (1 - u);
  });
}

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[7], C[6], C[5]] });
  const embers = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]] });
  const puffs = new Puffs({
    rng: R,
    flame: [WHITE, C[7], C[6], C[5], C[5], C[4], C[4], C[3], C[2]],
    soot: [mix(mix(C[3], C[1], 0.3), SMOKE, 0.45), mix(C[1], SMOKE, 0.3)],
    cap: mix(mix(C[4], C[2], 0.5), SMOKE, 0.4),
    rim: [C[6], C[5], C[4]],
    floor,
  });
  const bits = new Bits({ ground: floor }), lights = [], rings = [];
  let t = 0, released = false, collapsing = false, popped = false, acc = 0, dustAcc = 0, flick = 1;

  const coreR = (tt) => (tt < REL - 0.07 ? 1.5 + 5 * ease.inQuad(tt / REL) : 1);
  const sphereR = (tt) => {
    if (tt < REL) return 0;
    if (tt < BURN) return RS * ease.outBack(clamp((tt - REL) / 0.14), 2.4) * (1 + 0.06 * smooth(REL + 0.3, BURN, tt) + 0.02 * Math.sin(tt * 11));
    if (tt < POP) return RS * 1.08 * (1 - ease.inQuad((tt - BURN) / (POP - BURN)));
    return 0;
  };
  const starL = (tt) => (tt < REL || tt > REL + 0.26 ? 0 : 60 * (1 - ease.inQuad(clamp((tt - REL - 0.05) / 0.21))));
  const starRot = (tt) => 0.32 + (tt - REL) * 2.2;
  // how hard the sphere lights what's round it: the rims of the smoke, the edges of the shards
  const burning = (tt) => (tt < REL ? clamp(tt / REL) * 0.7 : tt < BURN ? 1 : tt < POP ? 1.2 : Math.max(0, 1 - (tt - POP) / 0.35));
  const light = (x, y, r, c, k, life) => lights.push({ x, y, r, c, k, life, max: life });
  const rim = (a, r) => [Math.cos(a) * r, Y + Math.sin(a) * r];

  function release() {
    light(0, Y, 100, C[4], 1.25, 0.85);
    light(0, Y, 86, mix(C[6], WHITE, 0.5), 1.3, 0.22);
    rings.push({ r0: RS, r1: 104, life: 0.46, max: 0.46, th: 3.6, hot: true, delay: 0 });
    rings.push({ r0: RS * 0.8, r1: 62, life: 0.3, max: 0.3, th: 1.6, hot: true, delay: 0.02 });
    rings.push({ r0: RS, r1: 124, life: 0.62, max: 0.62, th: 1.2, hot: false, delay: 0.07 });
    // shards of the void: big slivers tumbling out and raining onto the floor, fine splinters faster
    for (let i = 0; i < 34; i++) {
      const big = i < 20, a = R.range(0, TAU), [x, y] = rim(a, RS * 0.7), sp = big ? R.range(80, 170) : R.range(130, 220);
      bits.add({ kind: B.SHARD, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - R.range(40, 110), g: 0.75, drag: big ? 1.3 : 1.7, bounce: 0.35, life: R.range(1.6, 2.6), a: R.range(0, TAU), va: R.range(-16, 16), s: big ? R.range(6, 11) : R.range(3, 4.5) });
    }
    for (let i = 0; i < 84; i++) {
      const a = R.range(0, TAU), [x, y] = rim(a, RS * 0.8), sp = R.range(120, 235);
      ps.spawn(P.SPARK, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 50, R.range(0.2, 0.7));
    }
    for (let i = 0; i < 28; i++) {
      const a = R.range(0, TAU), [x, y] = rim(a, RS * 0.9), sp = R.range(30, 130);
      embers.spawn(P.EMBER, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 40, R.range(1.3, 2.5));
    }
    for (let i = 0; i < 24; i++) {
      const a = R.range(0, TAU), [x, y] = rim(a, RS * 0.9), sp = R.range(15, 70);
      puffs.spawn(PK.SOOT, x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 14, R.range(2, 2.8), R.range(7, 12), R.range(0.02, 0.3));
    }
    // the shock flattens on the floor and shoves smoke out along it
    for (let i = 0; i < 12; i++) {
      const s = i % 2 ? 1 : -1;
      puffs.spawn(PK.SOOT, s * R.range(10, 40), -R.range(2, 5), s * R.range(50, 120), -R.range(0, 10), R.range(1.6, 2.4), R.range(5, 9), R.range(0.08, 0.2));
    }
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + R.range(-1.6, 1.6), [x, y] = rim(a, RS), sp = R.range(30, 80);
      puffs.spawn(PK.FLAME, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.3, 0.6), R.range(2, 3.6), 0, R.chance(0.5));
    }
    // what was still falling in is swallowed by the blast
    ps.list.length = 0;
    puffs.list = puffs.list.filter((q) => q.delay > 0);
  }

  function pop() {
    light(0, Y, 56, WHITE, 0.9, 0.18);
    light(0, Y, 120, C[5], 0.8, 0.5);
    rings.push({ r0: 2, r1: 40, life: 0.28, max: 0.28, th: 2, hot: true, delay: 0 });
    for (let i = 0; i < 26; i++) {
      const a = R.range(0, TAU), sp = R.range(120, 250);
      ps.spawn(P.SPARK, 0, Y, Math.cos(a) * sp, Math.sin(a) * sp - 40, R.range(0.2, 0.6));
    }
    for (let i = 0; i < 14; i++) {
      const a = R.range(0, TAU), sp = R.range(20, 90);
      embers.spawn(P.EMBER, 0, Y, Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.9, 1.6));
    }
    for (let i = 0; i < 10; i++) {
      const a = R.range(0, TAU), sp = R.range(20, 70);
      puffs.spawn(PK.SOOT, Math.cos(a) * 3, Y + Math.sin(a) * 3, Math.cos(a) * sp, Math.sin(a) * sp - 15, R.range(1.1, 1.7), R.range(3, 6), R.range(0, 0.08));
    }

    for (const q of [...embers.list, ...puffs.list]) {
      const dx = q.x, dy = q.y - Y, d = Math.hypot(dx, dy) || 1, f = 90 * Math.max(0, 1 - d / 70);
      q.vx += (dx / d) * f;
      q.vy += (dy / d) * f - f * 0.3;
    }
    // what's left of it climbs away as a column of smoke
    for (let i = 0; i < 12; i++)
      puffs.spawn(PK.SOOT, R.range(-6, 6), Y + R.range(-4, 6), R.range(-10, 10), -R.range(20, 55), R.range(1.3, 1.8), R.range(7, 12), R.range(0.02, 0.2));
  }

  return {
    update(dt) {
      t += dt;
      flick = 0.88 + 0.12 * Math.sin(t * 37) * Math.sin(t * 23);
      // the charge: motes swirl in from all round, streaks shoot straight at the core, darkness gathers
      if (t < REL - 0.06) {
        const k = t / REL;
        for (acc += dt * (90 + 150 * k); acc > 1; acc--) {
          const a = R.range(0, TAU), D = R.range(36, 84), x = Math.cos(a) * D, y = Math.min(-3, Y + Math.sin(a) * D), vt = R.range(50, 110), vi = R.range(10, 40);
          ps.spawn(P.MOTE, x, y, -Math.sin(a) * vt - Math.cos(a) * vi, Math.cos(a) * vt - Math.sin(a) * vi, 0.9, R.pick([WHITE, C[6], C[6], C[5]]), R.range(0.7, 1.2));
        }
        if (R.chance(0.75)) {
          const a = R.range(0, TAU), D = R.range(28, 70), T = R.range(0.18, 0.28), v = (D * 3) / (Math.exp(3 * T) - 1);
          ps.spawn(P.STREAK, Math.cos(a) * D, Y + Math.sin(a) * D, -Math.cos(a) * v, -Math.sin(a) * v, T, R.chance(0.5) ? C[7] : C[6]);
        }
        if (t < REL - 0.2 && R.chance(0.16)) {
          const a = R.range(0, TAU), D = R.range(34, 60);
          puffs.spawn(PK.SOOT, Math.cos(a) * D, Y + Math.sin(a) * D, -Math.sin(a) * 40, Math.cos(a) * 40, R.range(0.6, 0.9), R.range(3, 6));
        }
        attract(ps.list, 0, Y, 2.2e6 * (0.3 + k), 110, 0.55, 2.5, dt, (q) => (q.k === P.MOTE ? 1 : 0), 420);
        attract(puffs.list, 0, Y, 1.2e6 * (0.3 + k), 90, 0.7, 4, dt, () => 1, 160);
      }
      if (t >= REL && !released) {
        released = true;
        release();
      }
      // the sphere burns: flame licks off its rim, the odd spark and ember
      if (released && t < BURN) {
        const sr = sphereR(t);
        for (acc += dt * 34; acc > 1; acc--) {
          const a = -Math.PI / 2 + R.gauss() * 1.1, [x, y] = rim(a, sr + 1), sp = R.range(10, 35);
          puffs.spawn(PK.FLAME, x, y, Math.cos(a) * sp, Math.sin(a) * sp - R.range(10, 30), R.range(0.25, 0.45), R.range(1.2, 2.2), 0, R.chance(0.2));
        }
        if (R.chance(dt * 10)) {
          const a = -Math.PI / 2 + R.range(-1.4, 1.4), [x, y] = rim(a, sr * 0.9);
          puffs.spawn(PK.SOOT, x, y, Math.cos(a) * 20, -R.range(15, 35), R.range(1.2, 1.7), R.range(5, 9));
        }
        if (R.chance(dt * 8)) {
          const a = R.range(0, TAU), [x, y] = rim(a, sr), sp = R.range(110, 200);
          ps.spawn(P.SPARK, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 40, R.range(0.2, 0.5));
        }
        if (R.chance(dt * 7)) {
          const a = -Math.PI / 2 + R.range(-1.2, 1.2), [x, y] = rim(a, sr);
          embers.spawn(P.EMBER, x, y, Math.cos(a) * 30, -R.range(20, 50), R.range(0.9, 1.6));
        }
      }
      // the collapse: the sphere draws its own flame back in, streaks race to the heart
      if (t >= BURN && !collapsing) {
        collapsing = true;
        for (let i = 0; i < 14; i++) {
          const a = R.range(0, TAU), D = R.range(26, 48), T = R.range(0.14, 0.2), v = (D * 3) / (Math.exp(3 * T) - 1);
          ps.spawn(P.STREAK, Math.cos(a) * D, Y + Math.sin(a) * D, -Math.cos(a) * v, -Math.sin(a) * v, T, R.chance(0.5) ? WHITE : C[6]);
        }
      }
      if (collapsing && !popped) {
        attract(puffs.list, 0, Y, 1.4e6, 64, 0.6, 3, dt, (q) => (q.k === PK.FLAME ? 1 : 0.35), 200);
      }
      if (t >= POP && !popped) {
        popped = true;
        pop();
      }
      // the shock reaches the floor: dust rolls out under the ring
      for (const r of rings) {
        if (r.delay > 0 || !r.hot || r.th < 3) continue;
        const rr = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(r.life / r.max, 3)), rf = rr > -Y ? Math.sqrt(rr * rr - Y * Y) : 0;
        if (rf > 0)
          for (dustAcc += dt * 60; dustAcc > 1; dustAcc--) {
            const s = R.sign();
            ps.spawn(P.DUST, s * rf + R.range(-2, 2), -R.range(1, 3), s * R.range(20, 50), -R.range(4, 14), R.range(0.4, 0.8), mix(C[2], C[3], R.next()), R.range(1.5, 3));
          }
      }
      for (const a of [lights, rings])
        for (let i = a.length - 1; i >= 0; i--) {
          const q = a[i];
          if (q.delay > 0) q.delay -= dt;
          else if ((q.life -= dt) <= 0) a.splice(i, 1);
        }
      bits.update(dt);
      for (const b of bits.list) {
        // a shard that comes to rest lies flat on the floor
        if (b.rest && !b.flat) {
          b.flat = true;
          b.a = Math.round(b.a / Math.PI) * Math.PI + R.range(-0.2, 0.2);
          b.y = -1;
        }
        // and once it has lain a while, it dissolves into a wisp
        if (b.life < 0.45 && !b.wisp) {
          b.wisp = true;
          puffs.spawn(PK.SOOT, b.x, b.y - 1, R.range(-4, 4), -R.range(8, 16), R.range(0.6, 0.9), R.range(1.4, 2.4));
        }
      }
      puffs.update(dt);
      ps.update(dt);
      embers.update(dt);
    },
    drawBack(p) {
      const k = burning(t);
      for (const r of rings) floorRing(p, C, r, true);
      puffs.draw(p, PK.SOOT, { x: 0, y: Y, k: k * flick, reach: 84 });
      ps.draw(p, "back");
      if (k > 0) p.glow(0, -3, 74, C[4], 0.24 * Math.min(1, k) * flick);
    },
    draw(p) {
      const sr = sphereR(t), k = burning(t), L = starL(t);
      for (const r of rings) floorRing(p, C, r, false);
      // the charge: a contracting ring and a black core that beats
      let cr = 0;
      if (t < REL) {
        const q = t / REL, ring = 3 + 74 * (1 - ease.inQuad(q));
        const beat = 1 + 0.3 * Math.exp(-((t - REL * 0.5) ** 2) / 0.0015) + 0.4 * Math.exp(-((t - REL * 0.8) ** 2) / 0.0015);
        cr = coreR(t) * beat;
        ringFast(p, 0, Y, ring, 1, q > 0.7 ? C[6] : C[5], 0.2 + 0.7 * q);
        if (t > REL - 0.07) p.circle(0, Y, 1.6, WHITE);
        else sphere(p, C, cr, t, 0.3 + 0.3 * q);
        halo(p, 0, Y, cr, cr + 14 + 30 * q, C[5], (0.45 + 0.7 * q) * beat);
        p.glow(0, Y, 60 + 30 * q, C[4], 0.12 + 0.3 * q);
      }
      // the release: a violet-white flash with a black star cut across it
      const fu = (t - REL) / 0.12;
      if (fu >= 0 && fu < 1) {
        const r = 36 * (1 - 0.3 * fu);
        p.circle(0, Y, r + 1.5, C[5], 1.2 - fu);
        p.circle(0, Y, r, fu < 0.35 ? WHITE : C[6], 1.1 - fu);
        if (fu < 0.6) p.circle(0, Y, r * 0.62, WHITE);
      }
      // the shock rings in the air
      for (const r of rings) {
        if (r.delay > 0) continue;
        const q = r.life / r.max, rr = r.r0 + (r.r1 - r.r0) * (1 - q * q * q), th = Math.max(1, r.th * q + 0.4);
        // the floor stops it: below the floor line it's the flat ring on the floor instead
        ringFast(p, 0, Y, rr, th, (v) => (r.hot ? (v > 0.6 ? WHITE : v > 0.3 ? C[6] : C[5]) : v > 0.5 ? C[5] : C[4]), (v, g) => (Y + Math.sin(g) * rr > 0.5 ? 0 : Math.min(1, q * 1.6)));
        if (r.hot) ringLight(p, 0, Y, rr, 4, C[5], 0.4 * q, (x, y) => y < 0.5);
      }
      sphere(p, C, sr, t, t < BURN ? 1 : 1 + 0.5 * clamp((t - BURN) / (POP - BURN)));
      // the black star, burning at the edge where its arms leave the flash
      const star = L > 0 ? blackStar(Y, L, starRot(t), 0.5, 0.4) : null;
      if (star) {
        const age = t - REL, fr = age < 0.12 ? 36 * (1 - 0.3 * (age / 0.12)) + 1.5 : 0, cut = Math.max(fr, sr);
        star.draw(p, C[0], age < 0.1 ? C[5] : C[4], (x, y) => x * x + (y - Y) ** 2 < cut * cut);
      }
      puffs.draw(p, PK.FLAME);
      for (const b of bits.list) shard(p, b, C, 0, Y, Math.min(1, k) * 0.9);
      ps.draw(p, "front");
      embers.draw(p, "front");
      // the pop as it goes: a glint and a last hard light
      const pu = (t - POP) / 0.2;
      if (pu >= 0 && pu < 1) sparkle(p, 0, Y, 12 * (1 - pu), C[6], C[5], 0.7 * (1 - pu));
      // light: the blast's flare and the sphere's corona; then black takes its light back
      for (const l of lights) {
        const q = l.life / l.max;
        p.glow(l.x, l.y, l.r * (0.55 + 0.45 * q), l.c, l.k * q * q);
      }
      if (sr > 1) {
        halo(p, 0, Y, sr - 0.5, sr + 16, C[6], 0.5 * flick * Math.min(1, k));
        p.glow(0, Y, sr + 54, C[4], 0.5 * flick * Math.min(1, k));
      }
      // black takes its light back: the sphere and the core, then the star's own cells
      const B0 = Math.max(sr, cr) + 1;
      if (B0 > 2) unlight(p, -B0, Y - B0, B0, Y + B0, (x, y) => x * x + (y - Y) ** 2 < (Math.max(sr, cr) - 0.5) ** 2);
      if (star) star.unlight(p);
    },
  };
}

// where the shock meets the floor: its cross-section with the floor plane, a flat ring racing out
function floorRing(p, C, r, back) {
  if (r.delay > 0 || !r.hot || r.th < 3) return;
  const q = r.life / r.max, rr = r.r0 + (r.r1 - r.r0) * (1 - q * q * q);
  if (rr <= -Y) return;
  const rf = Math.sqrt(rr * rr - Y * Y);
  band(p, 0, 0.5, rf, 0.16, Math.max(1, 3 * q), Math.min(1, q * 1.5), [C[3], C[4], C[5], C[6]], (g) => (Math.sin(g) < 0) === back);
  if (!back) for (const s of [-1, 1]) p.glow(s * rf, -2, 16, C[5], 0.4 * q);
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/shadow/hex-sigil.js"] = function(exports, __req) {
const {  Particles, Bits, P, B, Rng, rng, fit, sparkle, clamp, smooth, ease, TAU, WHITE, mix  } = __req("core/index.js");
const {  VOID, Puffs, PK, ringFast  } = __req("fx/shadow/_lib.js");

const meta = {
  name: "Hex sigil",
  desc: "A burning pen traces a cursed sigil in the air, its glyphs pop in one by one, then it flares white and crumbles into falling embers.",
  tags: ["shadow", "hex", "sigil", "rune", "curse", "magic", "circle", "one-shot"],
  size: [168, 128],
  origin: [84, 112],
  duration: 4.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: VOID, seed: 7 },
};

// the sigil's centre and radii; the beats: traced, glyphs pop, holds, flares, crumbles
const CY = -50, RO = 28, RI = 22, RC = 6, GLYPH = 1.62, FLARE = 2.6, BREAK = 2.74;

// the strokes, in the order the pen draws them, as points with the moment the pen passes each
function strokes(seed) {
  const paths = [], circle = (r, a0, n = 0) => Array.from({ length: (n || Math.ceil(r * TAU)) + 1 }, (_, i) => [Math.cos(a0 + (i / (n || Math.ceil(r * TAU))) * TAU) * r, CY + Math.sin(a0 + (i / (n || Math.ceil(r * TAU))) * TAU) * r]);
  paths.push(circle(RO, -Math.PI / 2));
  // a seven-pointed star, drawn in one stroke, three points round each time
  const star = [];
  for (let i = 0; i <= 7; i++) {
    const a = -Math.PI / 2 + ((i * 3) % 7) * (TAU / 7);
    star.push([Math.cos(a) * RI, CY + Math.sin(a) * RI]);
  }
  paths.push(star);
  paths.push(circle(RI, -Math.PI / 2));
  paths.push(circle(RC, Math.PI / 2));
  paths.push([[0, CY - 3.5], [2, CY], [0, CY + 3.5], [-2, CY], [0, CY - 3.5]]);
  // sample every half pixel, timing the pen along it: the outer circle fast, the star with more weight
  const pts = [], speeds = [420, 700, 550, 380, 300];
  let t = 0.12;
  paths.forEach((path, k) => {
    for (let i = 1; i < path.length; i++) {
      const [x0, y0] = path[i - 1], [x1, y1] = path[i], L = Math.hypot(x1 - x0, y1 - y0);
      for (let d = 0; d < L; d += 0.5) pts.push({ x: x0 + ((x1 - x0) * d) / L, y: y0 + ((y1 - y0) * d) / L, t: t + d / speeds[k] });
      t += L / speeds[k];
    }
    t += 0.04;
  });
  return { pts, end: t };
}

// seven small glyphs of our own: a spine and two or three branches on a 3x3 grid of nodes
function glyphs(seed) {
  return Array.from({ length: 7 }, (_, i) => {
    const r = rng(seed, i, 31), segs = [[[1, 0], [1, 2]]];
    for (let k = 0; k < 2 + (r.next() < 0.5 ? 1 : 0); k++) {
      const a = [r.int(0, 2), r.int(0, 2)], b = [Math.max(0, Math.min(2, a[0] + r.int(-1, 1))), Math.max(0, Math.min(2, a[1] + r.int(-1, 1)))];
      if (a[0] !== b[0] || a[1] !== b[1]) segs.push([a, b]);
    }
    const ang = -Math.PI / 2 + (i * TAU) / 7 + Math.PI / 7, rr = (RO + RI) / 2;
    return { x: Math.cos(ang) * rr, y: CY + Math.sin(ang) * rr, segs, t: GLYPH + i * 0.07 };
  });
}

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0, S = strokes(o.seed), G = glyphs(o.seed);
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[7], C[6], C[5]] });
  const embers = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]] });
  const puffs = new Puffs({ rng: R, flame: [WHITE, C[7], C[6], C[5], C[4], C[3], C[2], C[1], C[0]], soot: [mix(C[3], C[2], 0.5), mix(C[2], C[1], 0.5)], cap: mix(C[4], C[2], 0.5), rim: [C[6], C[5], C[4]], floor });
  const bits = new Bits({ ground: floor }), lights = [];
  let t = 0, pi = 0, flared = false, broke = false;
  const pen = () => S.pts[Math.min(S.pts.length - 1, pi)];
  return {
    update(dt) {
      t += dt;
      // the pen: it spits sparks and drips burning embers as it writes
      while (pi < S.pts.length - 1 && S.pts[pi + 1].t <= t) pi++;
      if (t > 0.12 && t < S.end) {
        const q = pen();
        if (R.chance(dt * 70)) ps.spawn(P.SPARK, q.x, q.y, R.range(-70, 70), R.range(-100, 20), R.range(0.12, 0.35));
        if (R.chance(dt * 10)) embers.spawn(P.EMBER, q.x, q.y, R.range(-12, 12), R.range(5, 25), R.range(0.5, 0.9));
      }
      // power drawn into the sigil while it's written and held: streaks racing in to its heart
      if (t > 0.2 && t < FLARE - 0.05 && R.chance(dt * (8 + 14 * smooth(0.2, FLARE, t)))) {
        const a = R.range(0, TAU), D0 = R.range(40, 60), T = R.range(0.22, 0.32), v = (D0 * 3) / (Math.exp(3 * T) - 1);
        ps.spawn(P.STREAK, Math.cos(a) * D0, CY + Math.sin(a) * D0, -Math.cos(a) * v, -Math.sin(a) * v, T, R.chance(0.5) ? C[7] : C[6]);
      }
      for (const g of G)
        if (!g.popped && t >= g.t) {
          g.popped = true;
          lights.push({ x: g.x, y: g.y, r: 14, k: 0.7, life: 0.2, max: 0.2 });
          for (let i = 0; i < 4; i++) ps.spawn(P.SPARK, g.x, g.y, R.range(-60, 60), R.range(-70, 20), R.range(0.1, 0.25));
        }
      if (t >= FLARE && !flared) {
        flared = true;
        lights.push({ x: 0, y: CY, r: 96, k: 1.4, life: 0.45, max: 0.45 }, { x: 0, y: CY, r: 44, k: 1, life: 0.14, max: 0.14 });
        for (let i = 0; i < 24; i++) {
          const a = R.range(0, TAU), sp = R.range(60, 130);
          ps.spawn(P.SPARK, Math.cos(a) * 13, CY + Math.sin(a) * 13, Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.2, 0.45));
        }
      }
      if (t >= BREAK && !broke) {
        // it crumbles: every stroke breaks into burning fragments that tumble down and bounce
        broke = true;
        // pieces drop nearly straight at first, so the sigil's shape lingers as it falls apart
        for (let i = 0; i < S.pts.length - 1; i += 7) {
          const q = S.pts[i], n = S.pts[i + 1], a = Math.atan2(n.y - q.y, n.x - q.x);
          bits.add({ kind: B.SHARD, x: q.x, y: q.y, vx: R.range(-8, 8), vy: R.range(-12, 6), g: R.range(0.22, 0.45), drag: 0.6, bounce: 0.25, life: R.range(0.8, 1.2), a, va: R.range(-3, 3), s: R.range(2.5, 3.5), c: R.pick([C[7], C[6], C[6], C[5]]) });
          if (i % 27 === 0) embers.spawn(P.EMBER, q.x, q.y, R.range(-10, 10), -R.range(10, 40), R.range(0.6, 1.1));
        }
        for (const g of G) puffs.spawn(PK.SOOT, g.x, g.y, R.range(-6, 6), -R.range(8, 18), R.range(0.7, 1.1), R.range(3, 5));
        for (let i = 0; i < 8; i++) puffs.spawn(PK.SOOT, R.range(-20, 20), CY + R.range(-20, 20), R.range(-8, 8), -R.range(6, 16), R.range(0.8, 1.2), R.range(3, 6), R.range(0, 0.15));
      }
      for (let i = lights.length - 1; i >= 0; i--) if ((lights[i].life -= dt) <= 0) lights.splice(i, 1);
      bits.update(dt);
      ps.update(dt);
      embers.update(dt);
      puffs.update(dt);
    },
    drawBack(p) {
      puffs.draw(p, PK.SOOT, { x: 0, y: CY, k: broke ? 0.3 : 0, reach: 50 });
      const k = t < BREAK ? smooth(0.1, 0.6, t) : 1 - smooth(BREAK, BREAK + 0.6, t);
      if (k > 0) p.glow(0, CY, 52, C[4], 0.3 * k);
    },
    draw(p) {
      if (!broke) {
        // the traced lines: white where the pen just passed, cooling to violet; pulsing as it holds; white in the flare
        const hold = t > S.end ? 0.5 + 0.5 * Math.sin((t - S.end) * 9) : 0, white = t >= FLARE;
        for (const q of S.pts) {
          if (q.t > t) break;
          const age = t - q.t;
          p.px(q.x, q.y, white ? WHITE : age < 0.05 ? WHITE : age < 0.15 ? C[7] : age < 0.35 ? C[6] : hold > 0.75 ? C[6] : C[5]);
        }
        if (white) for (const q of S.pts) if (((q.x * 2) | 0) % 3 === 0) p.light(q.x, q.y, C[6], 0.5);
        // glyphs: each pops in white and settles
        for (const g of G) {
          if (t < g.t) continue;
          const age = t - g.t, col = white || age < 0.06 ? WHITE : age < 0.2 ? C[7] : hold > 0.75 ? C[7] : C[6];
          for (const [a, b] of g.segs) p.line(g.x - 2 + a[0] * 2, g.y - 2 + a[1] * 2, g.x - 2 + b[0] * 2, g.y - 2 + b[1] * 2, col);
          if (age < 0.18) ringFast(p, g.x, g.y, 2 + 4 * (age / 0.18), 1, age < 0.09 ? C[7] : C[5]);
          p.glow(g.x, g.y, 6, C[5], 0.25);
        }
        // the pen: a white-hot point with a little cross of light
        if (t > 0.12 && t < S.end + 0.05) {
          const q = pen();
          sparkle(p, q.x, q.y, 3 + Math.sin(t * 60), C[7], C[6], 0.6);
          p.glow(q.x, q.y, 16, C[6], 0.55);
        }
      }
      // the flare: a burst ring as it goes white
      const fu = (t - FLARE) / 0.35, bu = (t - FLARE) / 0.22;
      if (bu > 0 && bu < 1) sparkle(p, 0, CY, 18 * (1 - bu), C[7], C[5], 0.9 * (1 - bu));
      if (fu > 0 && fu < 1) ringFast(p, 0, CY, RO + 3 + 12 * ease.outCubic(fu), Math.max(1, 3 * (1 - fu)), fu < 0.4 ? WHITE : fu < 0.7 ? C[6] : C[4]);
      bits.draw(p);
      puffs.draw(p, PK.FLAME);
      ps.draw(p);
      embers.draw(p);
      for (const l of lights) {
        const q = l.life / l.max;
        p.glow(l.x, l.y, l.r * (0.6 + 0.4 * q), l.k > 1 ? C[5] : C[6], l.k * q * q);
      }
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/shadow/shadow-tendrils.js"] = function(exports, __req) {
const {  Particles, P, Rng, fit, clamp, smooth, ease, noise, TAU, WHITE, mix  } = __req("core/index.js");
const {  VOID, Puffs, PK, Drops, floorPool  } = __req("fx/shadow/_lib.js");

const meta = {
  name: "Shadow tendrils",
  desc: "A dark pool opens on the floor; tentacles with lit rims and hooked tips lash up out of it with a splash, writhe, and sink back as it closes.",
  tags: ["shadow", "tentacle", "tendril", "ground", "dark", "magic", "one-shot"],
  size: [208, 130],
  origin: [104, 106],
  duration: 3.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: VOID, seed: 3 },
};

const RX = 40, OPEN = 0.34, SHUT = 2.5, SINK = 0.5, LX = -0.6, LY = -0.8;

// a tentacle's spine at t: it rises out of the pool along its own curve, a wave writhes up it, its lean sways
// and sometimes whips, and its tip curls into a hook; points every 0.5 px with angle and half-width
function spine(T, t) {
  const e = clamp((t - T.t0) / 0.2), s1 = clamp((t - T.t1) / SINK);
  if (e <= 0 || s1 >= 1) return null;
  // it lashes up past its length and settles; going, it lifts a little, then slides back under
  const lift = 0.07 * Math.sin(Math.PI * clamp(s1 / 0.3)), down = ease.inOutCubic(clamp((s1 - 0.12) / 0.88));
  const rise = ease.outBack(e, 1.8) * (1 + lift) * (1 - down), hidden = (1 - rise) * T.L;
  const writhe = T.A * (0.25 + 0.75 * smooth(T.t0 + 0.08, T.t0 + 0.5, t));
  const hook = (0.04 + T.H * ease.outBack(clamp((t - T.t0 - 0.1) / 0.32), 2.5)) * (1 + 0.5 * s1) * (1 + 0.18 * Math.sin(t * 2.3 + T.ph));
  let lean = T.lean + 0.12 * Math.sin(t * 1.6 + T.ph);
  if (T.whip) lean += T.whip.a * Math.exp(-(((t - T.whip.t) / 0.14) ** 2));
  let th = -Math.PI / 2 + lean, x = T.x - Math.cos(th) * hidden, y = T.y - Math.sin(th) * hidden;
  const pts = [], n = Math.ceil(T.L / 0.5);
  for (let i = 0; i <= n; i++) {
    const s = i * 0.5, u = s / T.L;
    pts.push({ x, y, th, w: T.W * Math.pow(1 - u, 0.75) + 0.45, u, s });
    th += 0.5 * (writhe * Math.sin((s / T.lam) * TAU - T.om * t + T.ph) + T.curl * hook * smooth(0.58, 1, u));
    x += Math.cos(th) * 0.5;
    y += Math.sin(th) * 0.5;
  }
  return pts;
}

// a tentacle in cross-sections: a dark body with a lighter half toward the light, then the rims: bright where it
// faces the light (white where it faces it squarely), violet on the side the pool lights, suckers inside the hook
function tentacle(p, T, pts, C, t) {
  const surf = T.y;
  for (const q of pts) {
    if (q.y > surf) continue;
    const nx = -Math.sin(q.th), ny = Math.cos(q.th), ks = nx * LX + ny * LY >= 0 ? 1 : -1;
    for (let v = -q.w; v <= q.w; v += 0.5) {
      const x = q.x + nx * v, y = q.y + ny * v;
      const u = (v / q.w) * ks;
      if (y <= surf) p.px(x, y, u > 0.55 ? C[2] : u > -0.45 ? C[1] : C[0]);
    }
  }
  // a pulse of light runs up it as it lashes, then slower ones while it writhes
  const pulse = (t - T.t0) * 150, slow = (((t - T.t0) * 55) % (T.L * 1.8)) - 4;
  for (const q of pts) {
    if (q.y > surf) continue;
    const nx = -Math.sin(q.th), ny = Math.cos(q.th), f = nx * LX + ny * LY, ks = f >= 0 ? 1 : -1;
    const lit = ks * q.w, x0 = q.x + nx * lit, y0 = q.y + ny * lit, x1 = q.x - nx * lit, y1 = q.y - ny * lit;
    if (y1 <= surf) p.px(x1, y1, C[3]);
    if (y0 <= surf) p.px(x0, y0, Math.abs(f) > 0.8 && q.u > 0.15 ? C[7] : q.u > 0.85 ? C[6] : Math.abs(f) > 0.3 ? C[6] : C[5]);
    if (q.u > 0.62 && q.u < 0.93 && q.s % 3 < 0.5) p.px(q.x + nx * T.curl * q.w * 0.45, q.y + ny * T.curl * q.w * 0.45, C[4]);
    const dp = Math.min(Math.abs(q.s - pulse), Math.abs(q.s - slow) * 1.6);
    if (dp < 2.5) p.px(q.x, q.y, dp < 1 ? C[7] : C[5]);
  }
  // the tip catches the light, and light runs along it
  const tip = pts[pts.length - 1];
  if (tip.y <= surf) {
    p.px(tip.x, tip.y, WHITE);
    p.glow(tip.x, tip.y, 6, C[6], 0.25);
  }
  for (let i = 0; i < pts.length; i += 8) if (pts[i].y < surf) p.glow(pts[i].x, pts[i].y, 9, C[4], 0.1);
  const pq = pts[Math.min(pts.length - 1, Math.max(0, Math.round(pulse * 2)))];
  if (pulse < T.L && pq.y < surf) p.glow(pq.x, pq.y, 10, C[6], 0.45);
  // where it breaks the surface: a lit collar of ink
  const base = pts.find((q) => q.y <= surf);
  if (base) {
    const w = base.w + 1.5;
    p.line(base.x - w, surf, base.x + w, surf, C[5]);
    p.px(base.x - w - 1, surf + 0.5, C[3]);
    p.px(base.x + w + 1, surf + 0.5, C[3]);
  }
}

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0;
  const DIM = [C[0], C[0], C[1], C[1], C[3], C[4], C[5], C[6]];
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[4] });
  const puffs = new Puffs({ rng: R, flame: [C[7], C[6], C[5], C[4], C[3], C[2], C[1], C[1], C[0]], soot: [mix(C[3], C[2], 0.55), mix(C[2], C[1], 0.5)], cap: mix(C[4], C[2], 0.5), rim: [C[6], C[5], C[4]], floor });
  const ripples = [], splats = [], lights = [];
  let t = 0, acc = 0;
  const rx = (tt) => RX * ease.outCubic(clamp(tt / OPEN)) * (1 - ease.inCubic(clamp((tt - SHUT) / 0.45)));
  const inPool = (x, tt) => Math.abs(x) < rx(tt) * 0.95;
  const drops = new Drops({
    onLand: (x, y, v, s) => {
      if (inPool(x, t)) ripples.push({ x, t0: t, life: 0.5, w: 0.6 });
      else splats.push({ x, t0: t, s });
    },
  });
  // seven tentacles in two rows: the back row taller and dimmer, hooks mostly curling inward
  const rows = [[-22, -2.5], [-8, -3], [7, -3], [21, -2.5], [-28, 2.5], [-1, 3], [27, 2.5]];
  const order = [3, 0, 5, 2, 4, 1, 6], last = [1, 5, 0, 6, 3, 2, 4];
  const tents = rows.map(([x, y], i) => {
    const back = y < 0, sx = Math.sign(x) || 1;
    return {
      x: x + R.range(-3, 3), y, back,
      L: back ? R.range(46, 62) : R.range(32, 46), W: back ? R.range(3.2, 4) : R.range(3.8, 4.6),
      lean: sx * (0.06 + Math.abs(x) / 120) + R.range(-0.06, 0.06), curl: R.chance(0.75) ? -sx : sx,
      lam: R.range(36, 50), om: R.range(4.5, 7) * R.sign(), ph: R.range(0, TAU), A: R.range(0.06, 0.085), H: R.range(0.15, 0.32),
      t0: 0.3 + order[i] * 0.045 + R.range(0, 0.03), t1: 1.5 + last[i] * 0.1 + R.range(0, 0.05),
      whip: R.chance(0.45) ? { t: R.range(0.9, 1.5), a: R.range(0.28, 0.45) * R.sign() } : null,
      up: false, down: false,
    };
  });

  function splash(x, y, n, power) {
    for (let i = 0; i < n; i++) drops.add(x + R.range(-2, 2), y - 1, R.range(-70, 70) * power, -R.range(90, 230) * power, R.chance(0.4) ? 2 : 1);
    ripples.push({ x, t0: t, life: 0.7, w: 1 });
    lights.push({ x, y: y - 7, r: 30, k: 0.6 * power, life: 0.25, max: 0.25 });
  }

  return {
    update(dt) {
      t += dt;
      for (const T of tents) {
        if (!T.up && t >= T.t0) {
          T.up = true;
          splash(T.x, T.y, 12, 1);
          for (let i = 0; i < 4; i++) ps.spawn(P.SPARK, T.x, T.y - 2, R.range(-80, 80), -R.range(120, 260), R.range(0.2, 0.45));
        }
        if (!T.down && t >= T.t1 + SINK * 0.8) {
          T.down = true;
          splash(T.x, T.y, 6, 0.6);
        }
        // glints run over the rims while they stand
        if (t > T.t0 + 0.2 && t < T.t1 && R.chance(dt * 1.6)) {
          const pts = spine(T, t), q = pts && pts[Math.floor(R.range(0.3, 0.95) * pts.length)];
          if (q && q.y < T.y) ps.spawn(P.STAR, q.x - Math.sin(q.th) * q.w, q.y + Math.cos(q.th) * q.w, 0, -4, R.range(0.25, 0.5), C[6], R.range(1, 2.2));
        }
      }
      // the pool breathes out wisps and motes while it's open
      const r = rx(t);
      if (r > 8 && t < SHUT - 0.4) {
        for (acc += dt * 9; acc > 1; acc--) puffs.spawn(PK.SOOT, R.range(-0.8, 0.8) * r, -R.range(1, 4), R.range(-8, 8), -R.range(14, 30), R.range(0.6, 0.85), R.range(3, 6));
        if (R.chance(dt * 16)) ps.spawn(P.MOTE, R.range(-0.8, 0.8) * r, -2, R.range(-8, 8), -R.range(30, 80), R.range(0.5, 1), R.pick([C[7], C[6], C[6], C[5]]), R.range(0.6, 1.1));
        if (R.chance(dt * 5)) ps.spawn(P.EMBER, R.range(-0.8, 0.8) * r, -3, R.range(-10, 10), -R.range(20, 45), R.range(0.6, 1), C[6]);
        if (R.chance(dt * 3)) ripples.push({ x: R.range(-0.7, 0.7) * r, t0: t, life: 0.6, w: 0.5 });
        // a violet haze hangs over the pool, lit from inside
        if (R.chance(dt * 7)) ps.spawn(P.VAPOUR, R.range(-0.7, 0.7) * r, -R.range(2, 8), R.range(-6, 6), -R.range(10, 22), R.range(0.6, 0.9), R.chance(0.5) ? C[3] : C[4], R.range(3, 6));
      }
      for (const a of [ripples, splats]) for (let i = a.length - 1; i >= 0; i--) if (t - a[i].t0 > (a[i].life ?? 0.6)) a.splice(i, 1);
      for (let i = lights.length - 1; i >= 0; i--) if ((lights[i].life -= dt) <= 0) lights.splice(i, 1);
      drops.update(dt);
      puffs.update(dt);
      ps.update(dt);
    },
    drawBack(p) {
      const r = rx(t), k = r / RX;
      floorPool(p, C, r, t, ripples);
      if (k > 0) {
        p.glow(0, -16, 86, C[4], 0.22 * k);
        p.glow(0, -8, r * 1.7 + 12, C[4], 0.32 * k * (0.9 + 0.1 * Math.sin(t * 5)));
        p.glow(0, 0, r * 1.15, C[5], 0.18 * k);
      }
      puffs.draw(p, PK.SOOT, { x: 0, y: 6, k: k, reach: 70 });
      ps.draw(p, "back");
      for (const T of tents) if (T.back) {
        const pts = spine(T, t);
        if (pts) tentacle(p, T, pts, DIM, t);
      }
    },
    draw(p) {
      for (const T of tents) if (!T.back) {
        const pts = spine(T, t);
        if (pts) tentacle(p, T, pts, C, t);
      }
      drops.draw(p, C[1], C[5]);
      for (const s of splats) {
        const a = 1 - (t - s.t0) / 0.6;
        p.dot(s.x, -0.5, C[1], a * 1.5);
        p.dot(s.x + 1, -0.5, C[2], a);
        if (s.s > 1) p.dot(s.x - 1, -0.5, C[2], a);
        p.dot(s.x, -1.5, C[5], a);
      }
      ps.draw(p, "front");
      for (const l of lights) {
        const q = l.life / l.max;
        p.glow(l.x, l.y, l.r * (0.6 + 0.4 * q), C[5], l.k * q * q);
      }
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/holy/smite.js"] = function(exports, __req) {
const {  Particles, Bits, Lights, P, PF, B, Rng, fit, sparkle, band, bolt, clamp, smooth, seg, lerp, ease, TAU, WHITE, hex, mix, scale  } = __req("core/index.js");
const {  GOLD, oval  } = __req("fx/holy/_lib.js");

const meta = {
  name: "Smite",
  desc: "A glint marks the spot, then a bolt of light drops like a hammer: a white flash, a shockwave over the floor, stone chips flying and cracks that glow and cool.",
  tags: ["holy", "smite", "strike", "impact", "light", "ground", "one-shot"],
  size: [224, 176],
  origin: [112, 148],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: GOLD, stone: "#5a5066", seed: 9 },
};

const TOP = -148, SY = 0.38, MARK = 0.42, HIT = 0.54, LEN = 44;
const OUTLINE = hex("#1a1422");

// a chip of stone: lit side, shaded side, outline
function chip(p, b, st) {
  const r = 0.6 + b.s * 0.7, fade = Math.min(1, b.life / 0.5), lx = Math.cos(b.a) * r * 0.4, ly = Math.sin(b.a) * r * 0.4;
  p.shade(b.x - r - 1, b.y - r - 1, b.x + r + 1, b.y + r + 1, (x, y, out) => {
    const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx * 1.2, dy);
    if (d > r + 0.9) return;
    const lit = dx * lx + dy * ly;
    out.c = d > r ? OUTLINE : lit < -0.3 ? st[3] : lit > 0.5 ? st[1] : st[2];
    out.a = fade;
  });
}

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), s0 = hex(o.stone);
  const st = [scale(s0, 0.5), scale(s0, 0.75), s0, mix(scale(s0, 1.4), WHITE, 0.1)], dust = mix(s0, hex("#8a8094"), 0.4);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[3]] });
  const chips = new Bits({ ground: () => 0 }), lights = new Lights();
  // cracks across the floor, mostly out to the sides and towards us, each its own length
  const cracks = Array.from({ length: 7 }, (_, i) => {
    const a = 0.12 + (i / 6) * (Math.PI - 0.24) + R.range(-0.12, 0.12), L = R.range(30, 54) * (Math.abs(Math.sin(a)) > 0.7 ? 0.6 : 1);
    const pts = bolt(R, 0, 0, Math.cos(a) * L, Math.sin(a) * L, { jag: 0.28, depth: 4 }).map(([x, z]) => [x, z * SY]);
    const fork = pts.length > 6 ? bolt(R, ...pts[Math.floor(pts.length * 0.5)], pts[Math.floor(pts.length * 0.5)][0] + Math.cos(a + R.sign() * 0.7) * L * 0.35, pts[Math.floor(pts.length * 0.5)][1] + Math.sin(a + R.sign() * 0.7) * L * 0.35 * SY, { jag: 0.3, depth: 3 }) : null;
    return { pts, fork, L, cool: R.range(1.6, 2.1) };
  });
  let t = 0, hit = false;

  // the hammer of light: a heavy blunt bolt that falls faster and faster
  const tipY = (tt) => lerp(TOP - 6, 0, ease.inCubic(seg(tt, MARK, HIT)));

  function hammer(p) {
    if (t < MARK || t >= HIT + 0.06) return;
    const y1 = t >= HIT ? 0 : tipY(t), y0 = Math.max(TOP + 5, y1 - LEN * (t >= HIT ? 1 - (t - HIT) / 0.06 : 1)), white = t >= HIT;
    if (y1 < TOP + 12) return;
    // speed lines above it
    for (const [dx, k] of [[-5, 0.6], [-2, 0.9], [2, 0.8], [5, 0.5]]) if (y0 > TOP + 2) p.line(dx, Math.max(TOP, y0 - 70), dx, y0, (u) => (u > 0.7 ? C[6] : C[4]), (u) => u * k);
    if (y1 - 3 > y0) p.beam(0, y0, 0, y1 - 3, 9, (u, v) => (white || v < 0.35 ? WHITE : v < 0.7 ? C[6] : C[5]));
    // the head: wider, white hot
    p.beam(0, y1 - 6, 0, y1 - 1, 13, (u, v) => (v < 0.6 || white ? WHITE : C[6]));
    p.glowLine(0, y0 + 10, 0, y1, 16, C[5], 0.6);
    p.glow(0, y1 - 4, Math.min(22, y1 - TOP - 6), WHITE, 0.5);
  }

  function crack(p) {
    if (t < HIT) return;
    const grow = ease.outCubic(seg(t, HIT, HIT + 0.1));
    for (const c of cracks) {
      for (const path of c.fork ? [c.pts, c.fork] : [c.pts]) {
        const n = Math.max(1, Math.round((path.length - 1) * grow));
        for (let i = 0; i < n; i++) {
          const [x0, y0] = path[i], [x1, y1] = path[i + 1], d = Math.hypot(x0, y0 / SY) / c.L, heat = clamp(1 - (t - HIT) / c.cool - d * 0.5);
          if (heat <= 0) continue;
          const col = heat > 0.85 ? WHITE : heat > 0.65 ? C[6] : heat > 0.45 ? C[5] : heat > 0.3 ? C[4] : heat > 0.18 ? C[3] : C[2];
          p.line(x0, y0, x1, y1, col, heat < 0.12 ? heat / 0.12 : 1);
          // wide and deep near the heart, a hairline at the tips
          if (d < 0.45 && path === c.pts) p.line(x0, y0 + 1, x1, y1 + 1, heat > 0.5 ? C[4] : C[2], heat < 0.12 ? heat / 0.12 : 1);
          if (i % 2 === 0) p.glow(x0, y0, 10, C[4], 0.45 * heat);
        }
      }
    }
    // the crater glows at the heart and cools
    const h = clamp(1 - (t - HIT) / 1.6);
    if (h > 0) {
      oval(p, 0, 0, 5, 1.6, h > 0.6 ? WHITE : h > 0.3 ? C[5] : C[3], Math.min(1, h * 3));
      p.glow(0, 0, 18, C[4], 0.45 * h);
    }
  }

  return {
    update(dt) {
      t += dt;
      if (t < MARK && R.chance(0.25)) ps.spawn(P.STAR, R.range(-10, 10), -R.range(0, 18), 0, -R.range(4, 12), R.range(0.2, 0.4), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.2));
      // sparks shed off the sides of the falling hammer
      if (t > MARK && t < HIT && tipY(t) > TOP + 50 && R.chance(0.6)) ps.spawn(P.MOTE, R.sign() * R.range(4, 7), tipY(t) - R.range(4, 30), R.range(-20, 20), -R.range(10, 40), R.range(0.15, 0.3), C[6], 0.7);
      if (!hit && t >= HIT) {
        hit = true;
        lights.add(0, -24, 92, C[5], 1, 0.6);
        lights.add(0, -8, 40, WHITE, 0.9, 0.12);
        for (let i = 0; i < 60; i++) {
          const a = -Math.PI / 2 + R.range(-1.25, 1.25), sp = R.range(110, 280);
          ps.spawn(P.SPARK, R.range(-3, 3), -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.25, 0.75));
        }
        for (let i = 0; i < 16; i++) {
          const a = -Math.PI / 2 + R.range(-1, 1), sp = R.range(60, 160);
          ps.spawn(P.STAR, R.range(-4, 4), -4, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.4, 0.9), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 2.4));
        }
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(90, 230);
          chips.add({ kind: B.CHUNK, x: R.range(-5, 5), y: -2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1, drag: 0.4, bounce: 0.35, life: R.range(1.2, 1.8), a: R.range(0, TAU), va: R.range(-14, 14), s: R.int(1, 3) });
        }
        for (let i = 0; i < 34; i++) {
          const a = -Math.PI / 2 + R.range(-1, 1), sp = R.range(60, 220);
          ps.spawn(P.GRIT, R.range(-4, 4), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.9, 1.5), R.pick(st.slice(1)), R.chance(0.4) ? 2 : 1);
        }
        // dust rolls out along the floor, a little smoke lifts off the crater
        for (let i = 0; i < 9; i++) {
          const s = R.sign();
          ps.spawn(P.SMOKE, s * R.range(2, 10), -R.range(1, 4), s * R.range(50, 130), -R.range(2, 12), R.range(0.7, 1.2), mix(dust, C[4], 0.18), R.range(3.5, 6), R.range(0, 0.06), PF.BIG);
        }
        for (let i = 0; i < 4; i++) ps.spawn(P.SMOKE, R.range(-4, 4), -R.range(2, 8), R.range(-8, 8), -R.range(20, 45), R.range(1.2, 1.8), mix(dust, C[5], 0.25), R.range(4, 6), R.range(0.05, 0.3));
      }
      // the cracks spit embers while they're hot
      if (t > HIT && t < HIT + 1.3 && R.chance(0.5)) {
        const c = R.pick(cracks), q = R.pick(c.pts);
        if (R.chance(0.75)) ps.spawn(P.EMBER, q[0], q[1] - 1, R.range(-8, 8), -R.range(15, 35), R.range(0.5, 0.9), C[5]);
        else ps.spawn(P.STAR, q[0], q[1] - 2, 0, -R.range(4, 12), R.range(0.3, 0.6), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 1.8));
      }
      chips.update(dt);
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      crack(p);
      ps.draw(p, "back");
      const k = seg(t, HIT, HIT + 0.42);
      if (t >= HIT && k < 1) band(p, 0, 0, 6 + 84 * ease.outCubic(k), SY * 0.8, Math.max(1, 5 * (1 - k)), 1.15 - k, C.slice(3), (g) => Math.sin(g) < 0, k < 0.12);
    },
    draw(p) {
      // the mark: a glint on the floor and a ring closing on it
      if (t < HIT) {
        const u = seg(t, 0, MARK), k = smooth(0, 0.08, t), spin = t * 3, rr = lerp(26, 8, ease.inOutCubic(u));
        oval(p, 0, 0, rr, rr * SY, (g) => (Math.sin(g * 4 + spin) > 0 ? WHITE : C[5]), k * (0.65 + 0.35 * Math.sin(t * 40)));
        oval(p, 0, 1, rr, rr * SY, C[3], k * 0.6, (g) => Math.sin(g) > 0);
        const L = (3 + 8 * ease.outBack(clamp(t / 0.2), 2)) * (t > MARK ? 1 + 0.6 * seg(t, MARK, HIT) : 1);
        for (let i = 0; i < 4; i++) {
          const a = spin * 0.3 + (i * Math.PI) / 2, len = i % 2 ? L * 0.6 : L;
          p.line(0, -2, Math.cos(a) * len, -2 + Math.sin(a) * len, (v) => (v < 0.4 ? WHITE : C[5]), (v) => 1.2 - v);
        }
        p.px(0, -2, WHITE);
        p.glow(0, -2, 14 + 10 * u, C[5], 0.5 * k);
        p.glowLine(0, TOP + 6, 0, -2, 5, C[4], 0.12 * u);
      }
      hammer(p);
      // the bolt's afterimage: a thread of light from the sky to the mark, thinning out
      const ai = seg(t, HIT + 0.04, HIT + 0.55);
      if (t > HIT + 0.04 && ai < 1) {
        const w = 1 + 4 * Math.pow(1 - ai, 2);
        p.beam(0, TOP + 4, 0, -4, w, (u, v) => (v < 0.5 ? WHITE : C[5]), (u) => (0.3 + 0.7 * u) * (1 - ai * 0.5));
        p.glowLine(0, TOP + 16, 0, -6, 10, C[5], 0.4 * (1 - ai));
      }
      const k = seg(t, HIT, HIT + 0.42);
      if (t >= HIT && k < 1) band(p, 0, 0, 6 + 84 * ease.outCubic(k), SY * 0.8, Math.max(1, 5 * (1 - k)), 1.15 - k, C.slice(3), (g) => Math.sin(g) >= 0, k < 0.12);
      // the air shock: a dome of light thrown up over the hit
      const d = seg(t, HIT, HIT + 0.28);
      if (t >= HIT && d < 1) {
        const r = 8 + 40 * ease.outCubic(d);
        p.arc(0, 0, r, Math.max(1, 3 * (1 - d)), Math.PI, TAU, (u, v) => (d < 0.2 || v > 0.6 ? WHITE : C[5]), 1.1 - d);
        for (let g = Math.PI * 1.1; g < TAU - 0.2; g += 0.5) p.glow(Math.cos(g) * r, Math.sin(g) * r, 8, C[5], 0.3 * (1 - d));
      }
      // the white hero frame
      if (t >= HIT && t < HIT + 0.07) {
        p.circle(0, -6, 16, WHITE);
        p.circle(0, -6, 19, C[6], 0.6);
      }
      for (const b of chips.list) chip(p, b, st);
      ps.draw(p, "front");
      if (t >= HIT && t < HIT + 0.25) sparkle(p, 0, -8, 16 * (1 - (t - HIT) / 0.25), WHITE, C[5], 0.7);
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/holy/_lib.js"] = function(exports, __req) {
// The plus sign's lit and shaded bevel is adapted from Sprite Fusion's open-source heal (https://www.spritefusion.com/pixel-art-vfx/heal),
// MIT License, Copyright (c) 2026 Hugo Duprez.
// Shared by the holy effects: gold, green and ash ramps, the character's silhouette and recolors, floor ovals,
// feathers of light (drawn, and simulated as they rock and sink) and plus signs.
// Files starting with _ are helpers, not effects.

const {  WHITE, TAU, clamp, smooth, luma  } = __req("core/index.js");

/** Holy gold, dark to bright: a plum shadow, rust, amber, gold, pale gold, cream, white. */
const GOLD = ["#3b1d2a", "#7a3a2c", "#c4652e", "#f0a040", "#ffd25e", "#fff0a0", "#fffbe0", "#ffffff"];
/** Healing green, warm: deep pine, leaf, spring green, a yellow-green highlight, cream. */
const GREEN = ["#0e2a24", "#14472f", "#1d6e3a", "#2f9a45", "#5cc654", "#a0e46c", "#dcffb4", "#ffffff"];
/** Ash: the colour of the fallen, a cool grey-violet, dark to light. */
const ASH = ["#16131c", "#26222f", "#3a3546", "#524c5e", "#6e6878", "#8c8796"];

// ---- the character

const SHAPES = new WeakMap();
/**
 * The actor's silhouette as local points, cached per mask: edge (its own rim pixels), out (the 1 px ring just
 * outside it), at(x, y) (inside?), top and bottom (y of the first row and one past the last).
 */
function shapeOf(A) {
  let s = SHAPES.get(A.mask);
  if (s && s.x === A.x && s.y === A.y) return s;
  const m = A.mask, inside = (i, j) => i >= 0 && j >= 0 && i < m.w && j < m.h && m.data[j * m.w + i] > 0;
  const edge = [], out = [];
  for (let j = -1; j <= m.h; j++)
    for (let i = -1; i <= m.w; i++) {
      const nb = inside(i - 1, j) + inside(i + 1, j) + inside(i, j - 1) + inside(i, j + 1);
      if (inside(i, j)) {
        if (nb < 4) edge.push([A.x + i, A.y + j]);
      } else if (nb) out.push([A.x + i, A.y + j]);
    }
  s = { x: A.x, y: A.y, edge, out, top: A.y, bottom: A.y + m.h, at: (x, y) => inside(Math.floor(x) - A.x, Math.floor(y) - A.y) };
  SHAPES.set(A.mask, s);
  return s;
}

/**
 * Draw the actor's own pixels recolored: fn(c, x, y) gives the new color for its pixel c at (x, y), or 0 to
 * leave that pixel alone (the character shows through). a: alpha, or a function of (x, y).
 */
function recolor(p, A, fn, a = 1) {
  const m = A.mask, P = A.pixels, fa = typeof a === "function";
  if (!P) return;
  for (let j = 0; j < m.h; j++)
    for (let i = 0; i < m.w; i++) {
      const c = P[j * m.w + i];
      if (!c) continue;
      const x = A.x + i, y = A.y + j, n = fn(c, x, y);
      if (n) p.dot(x, y, n, fa ? a(x, y) : a);
    }
}

/** A color mapped onto a ramp by its brightness (a tint that keeps the character's shading). */
const toneOf = (R, c, lift = 0) => R[clamp(Math.floor((luma(c) * 1.1 + lift) * R.length), 0, R.length - 1)];

// ---- floor and ovals

/**
 * A 1 px oval (a ring on a tilted plane): centre (cx, cy), radii rx, ry. c and a may be functions of the angle
 * g round it (sin(g) > 0 is the near side). keep(g) picks the part to draw.
 */
function oval(p, cx, cy, rx, ry, c, a = 1, keep = null) {
  if (rx < 0.5) return;
  const n = Math.ceil(Math.max(rx, ry) * TAU * 1.5) + 6, fc = typeof c === "function", fa = typeof a === "function";
  for (let j = 0; j < n; j++) {
    const g = (j / n) * TAU;
    if (keep && !keep(g)) continue;
    p.dot(cx + Math.cos(g) * rx, cy + Math.sin(g) * ry, fc ? c(g) : c, fa ? a(g) : a);
  }
}
const FAR = (g) => Math.sin(g) < 0;
const NEAR = (g) => Math.sin(g) >= 0;

// ---- feathers

/**
 * A feather of light from its quill at (x, y) pointing along ang, len px long, with a rounded tip; the
 * trailing vane, wid px wide, falls on side (1: clockwise of the shaft, -1: the other way), the leading vane
 * is under half that. R: a ramp, dark to bright (6+ steps). a: alpha. hot 0..1 whitens it (a flash). A white
 * shaft, a lit leading rim, a warm dark trailing edge that parts it from the next feather, a body that cools
 * from cream at the quill to gold, and a tip that thins into light.
 */
function feather(p, x, y, ang, len, wid, R, a = 1, side = 1, hot = 0, quill = 0.02) {
  if (len < 1.5 || a <= 0.02) return;
  const n = R.length, ca = Math.cos(ang), sa = Math.sin(ang), x1 = x + ca * len, y1 = y + sa * len, pad = wid + 1.2, h = hot > 0.5;
  const edge = h ? R[n - 3] : R[n - 5], lead = h ? WHITE : R[n - 2], B = h ? [WHITE, WHITE, R[n - 2]] : [R[n - 2], R[n - 3], R[n - 4]];
  p.each(Math.min(x, x1) - pad, Math.min(y, y1) - pad, Math.max(x, x1) + pad, Math.max(y, y1) + pad, (px, py, sx, sy) => {
    const dx = px - x, dy = py - y, u = (dx * ca + dy * sa) / len;
    if (u < 0 || u > 1.05) return;
    const v = (-dx * sa + dy * ca) * side, av = Math.abs(v);
    const w = wid * Math.sqrt(clamp((u - quill) / 0.22)) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (u - 0.55) / 0.47), 2)));
    const lim = v < 0 ? w * 0.42 : w, fade = u < 0.72 ? 1 : 1 - (u - 0.72) * 1.6;
    if (av < 0.5 && u < 0.9) return p.put(sx, sy, u < 0.5 ? WHITE : B[0], a);
    if (av > lim + 0.05 || w < 0.5) return;
    if (lim - av < 1) return v > 0 ? p.put(sx, sy, u > 0.85 ? B[2] : edge, a * fade) : p.put(sx, sy, lead, a);
    if (u < 0.72) return p.put(sx, sy, u < 0.38 ? B[0] : B[1], a);
    p.blendPx(sx, sy, B[2], a * fade);
  });
}

/**
 * Loose feathers that are thrown, brake hard, then rock like a pendulum as they sink, tilting with each swing
 * and sinking fastest through the bottom of it; on the floor they lie flat and fade.
 * add({ x, y (centre), vx, vy, a (angle), len, wid, life, delay, back }); update(dt); draw(p, R, layer).
 */
class Feathers {
  constructor(rng, floor = 0) {
    this.R = rng;
    this.floor = floor;
    this.list = [];
  }
  add(f) {
    const R = this.R;
    this.list.push({ vx: 0, vy: 0, a: 0, len: 7, wid: 2, delay: 0, back: false, side: R.sign(), ph: R.range(0, TAU), w: R.range(3.2, 4.6), amp: R.range(6, 11), sink: R.range(14, 24), va: R.range(-9, 9), tilt: R.range(-0.35, 0.35), ...f, max: f.life, age: 0, landed: false });
  }
  get count() {
    return this.list.length;
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      if ((f.life -= dt) <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      f.age += dt;
      if (f.landed) {
        f.a += (Math.round(f.a / Math.PI) * Math.PI - f.a) * Math.min(1, dt * 10);
        continue;
      }
      // the throw: drag kills it fast while it spins
      f.vx -= f.vx * 3.4 * dt;
      f.vy -= f.vy * 3.4 * dt;
      const s = smooth(0.1, 0.6, f.age), ph = f.age * f.w + f.ph, c = Math.cos(ph);
      // the flutter: a swing across, a sink that's fastest through the bottom of each swing
      f.x += (f.vx + Math.sin(ph) * f.amp * s * 0.9) * dt;
      f.y += (f.vy + f.sink * s * (c * c * 1.5 - 0.2)) * dt;
      // it lies along its swing, tipping up at each end
      const rest = Math.round(f.a / Math.PI) * Math.PI + f.tilt + Math.sin(ph) * 0.6;
      f.a += f.va * dt * (1 - s) + (rest - f.a) * Math.min(1, dt * 5 * s);
      if (f.y >= this.floor - 0.5) {
        f.y = this.floor - 0.5;
        f.landed = true;
        f.life = Math.min(f.life, 0.6);
      }
    }
  }
  draw(p, R, layer) {
    for (const f of this.list) {
      if (f.delay > 0 || (layer && (f.back ? "back" : "front") !== layer)) continue;
      const k = f.life / f.max, a = Math.min(1, f.life / 0.45, f.age / 0.06), ca = Math.cos(f.a), sa = Math.sin(f.a);
      feather(p, f.x - (ca * f.len) / 2, f.y - (sa * f.len) / 2, f.a, f.len, f.wid, R, a, f.side, f.age < 0.06 ? 1 : 0, 0.2);
      p.glow(f.x, f.y, 4 + f.len * 0.5, R[R.length - 3], 0.22 * a * (0.4 + 0.6 * k));
    }
  }
}

// ---- plus signs

/**
 * A plus sign of light centred on (x, y): arm length L (1..4) and thickness th (1 or 3): a white heart and
 * spine, colored arms lit on the top and left, shaded on the bottom and right. R: a ramp, dark to bright.
 */
function plus(p, x, y, L, th, R, a = 1, glint = false) {
  const n = R.length, X = Math.round(x), Y = Math.round(y), w = th > 1 ? 1 : 0;
  const ins = (i, j) => (Math.abs(i) <= w && Math.abs(j) <= L) || (Math.abs(j) <= w && Math.abs(i) <= L);
  for (let j = -L - 1; j <= L + 1; j++)
    for (let i = -L - 1; i <= L + 1; i++) {
      if (!ins(i, j)) {
        if (w && (ins(i - 1, j) || ins(i + 1, j) || ins(i, j - 1) || ins(i, j + 1))) p.dot(X + i, Y + j, R[Math.max(0, n - 6)], a * 0.9);
        continue;
      }
      let c;
      if (!w) c = i === 0 && j === 0 ? WHITE : Math.abs(i) + Math.abs(j) >= L ? R[n - 3] : R[n - 2];
      else if (i === 0 && j === 0) c = WHITE;
      else if (i === 0 || j === 0) c = Math.abs(i) + Math.abs(j) < L ? R[n - 2] : R[n - 3];
      else c = i < 0 || j < 0 ? R[n - 3] : R[n - 5];
      if (glint && ((i === 0 && j === -L) || (i === -L && j === 0))) c = WHITE;
      p.dot(X + i, Y + j, c, a);
    }
}

exports.shapeOf = shapeOf;
exports.recolor = recolor;
exports.oval = oval;
exports.feather = feather;
exports.plus = plus;
exports.Feathers = Feathers;
exports.GOLD = GOLD;
exports.GREEN = GREEN;
exports.ASH = ASH;
exports.toneOf = toneOf;
exports.FAR = FAR;
exports.NEAR = NEAR;
  };
  __mods["fx/holy/holy-pillar.js"] = function(exports, __req) {
const {  Particles, Lights, P, Rng, fit, sparkle, clamp, smooth, seg, lerp, ease, rand, TAU, WHITE  } = __req("core/index.js");
const {  GOLD, Feathers, oval  } = __req("fx/holy/_lib.js");

const meta = {
  name: "Holy pillar",
  desc: "Light breaks through from above: a sun opens at the top and a fan of shafts converges on the mark, pulsing, while a sigil burns on the floor; then the fan folds shut.",
  tags: ["holy", "pillar", "light", "rays", "aoe", "sigil", "ground", "one-shot"],
  size: [192, 232],
  origin: [96, 204],
  duration: 3.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: GOLD, shafts: 7, seed: 3 },
};

const TOP = -204, PY = -1, SUN = TOP + 38, SY = 0.24, RX = 26;
// the sun opens, the fan unfolds and pours down, it holds and pulses, folds shut, the light lifts away
const OPEN = 0.3, HIT = 0.66, FOLD = 2.05, SHUT = 2.45, LIFT = 2.75;
const frac = (x) => x - Math.floor(x);

function create(o) {
  const C = fit(o.palette, 8), N = Math.max(3, o.shafts | 0), R = new Rng(o.seed), mid = (N - 1) / 2;
  const WING = [C[2], C[3], C[4], C[5], C[6], WHITE];
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[3]] });
  const lights = new Lights(), feathers = new Feathers(R, 0);
  // the shafts: spread angle, how fast each widens, how bright, its pulse offset
  const shafts = Array.from({ length: N }, (_, i) => {
    const off = i - mid, far = Math.abs(off) / mid;
    return { th: off * (0.4 / mid) + R.range(-0.02, 0.02), spread: R.range(0.05, 0.085) * (1 - far * 0.25), b: (1 - far * 0.35) * R.range(0.8, 1), ph: R.range(0, 1), far };
  });
  const motes = Array.from({ length: 72 }, () => ({ x: R.range(-80, 80), y: R.range(0, 1), v: R.range(7, 18), amp: R.range(0.5, 2.5), f: R.range(0.6, 1.5), ph: R.range(0, TAU) }));
  for (let i = 0; i < 6; i++)
    feathers.add({ x: R.range(-46, 46), y: R.range(-150, -100), vx: R.range(-8, 8), vy: R.range(0, 8), a: R.range(-0.4, 0.4), len: R.range(7, 9), wid: R.range(1.9, 2.3), life: R.range(1.4, 1.7), sink: R.range(26, 36), back: i % 3 === 0, delay: HIT + 0.1 + i * 0.16 + R.range(0, 0.08) });
  const DMAX = PY - TOP, row = new Float32Array(192), core = new Uint8Array(192);
  let t = 0, hit = false, shut = false, glinted = false;

  // each shaft's angle now: unfolding from the middle with an overshoot, folding back shut at the end
  const angle = (s, tt) => {
    const st = s.far * 0.1, open = ease.outBack(seg(tt, OPEN + st, OPEN + st + 0.42), 1.5), fold = ease.inOutCubic(seg(tt, FOLD - s.far * 0.1, SHUT));
    return s.th * open * (1 - fold);
  };
  // how far down each shaft the light reaches (it pours from the sky), and where it lifts away at the end
  const frontD = (s, tt) => DMAX * (1 - ease.inQuad(seg(tt, OPEN + s.far * 0.06, HIT + s.far * 0.06)));
  const liftD = (tt) => DMAX * ease.inQuad(seg(tt, SHUT + 0.05, LIFT));
  const fade = (tt) => smooth(OPEN, OPEN + 0.1, tt) * (1 - smooth(LIFT - 0.05, LIFT + 0.05, tt));
  const width = (s, d, tt) => (1.4 + d * s.spread) * lerp(1, 0.25, smooth(SHUT, LIFT, tt));
  // brightness along a shaft: a pulse of light runs down each one, one after another
  const pulse = (s, d, tt) => {
    if (tt < HIT || tt > SHUT) return 1;
    const D = DMAX * (1 - frac((tt - HIT) / 0.6 + s.ph));
    return 1 + 0.9 * Math.exp(-(((d - D) / 12) ** 2));
  };
  // light of all the shafts at a point (for motes)
  const lightAt = (x, y) => {
    const dy = PY - y;
    if (dy <= 0) return 0;
    let I = 0;
    for (const s of shafts) {
      const a = angle(s, t), d = dy / Math.cos(a), xc = Math.tan(a) * dy, hw = width(s, d, t) / 2 / Math.cos(a);
      if (d < liftD(t) || d < frontD(s, t)) continue;
      const v = (x - xc) / hw;
      if (Math.abs(v) < 1) I += (1 - v * v) * s.b;
    }
    return I * fade(t);
  };

  function fan(p) {
    const k = fade(t);
    if (k <= 0) return;
    const lift = liftD(t);
    for (let y = Math.ceil(TOP); y < PY; y++) {
      const dy = PY - (y + 0.5);
      row.fill(0);
      core.fill(0);
      let any = false;
      for (const s of shafts) {
        const a = angle(s, t), ca = Math.cos(a), d = dy / ca;
        if (d < lift || d < frontD(s, t) - 6) continue;
        const xc = Math.tan(a) * dy, hw = width(s, d, t) / 2 / ca, soft = smooth(frontD(s, t) - 6, frontD(s, t) + 4, d) * smooth(lift, lift + 6, d);
        const I0 = s.b * pulse(s, d, t) * soft * k;
        for (let x = Math.floor(xc - hw); x <= Math.ceil(xc + hw); x++) {
          const v = (x + 0.5 - xc) / hw, i = x + 96;
          if (i < 0 || i >= 192 || Math.abs(v) >= 1) continue;
          row[i] += I0 * Math.pow(1 - v * v, 1.3);
          any = true;
        }
        const ci = Math.round(xc - 0.5) + 96;
        if (ci >= 0 && ci < 192) core[ci] = Math.max(core[ci], Math.min(255, I0 * 200));
      }
      if (!any) continue;
      for (let i = 0; i < 192; i++) {
        const I = row[i];
        if (I < 0.02) continue;
        const x = i - 96;
        p.blend(x, y, C[6], Math.min(0.6, I * 0.38));
        p.light(x, y, C[4], Math.min(0.9, I * 0.32));
        // a fine bright line runs down the middle of each shaft
        if (core[i]) p.dot(x, y, core[i] > 150 ? WHITE : C[6], Math.min(1, core[i] / 180));
      }
    }
    // where the shafts converge, the light gathers to a point
    if (t > HIT - 0.05) p.glow(0, PY - 3, 20, C[5], 0.5 * k);
  }

  // the sun: a halo that opens at the top like an iris, rays ticking round it, then closes with a glint
  function sun(p) {
    const r = 15 * ease.outBack(seg(t, 0.02, 0.45), 1.8) * (1 - ease.inBack(seg(t, SHUT, LIFT + 0.1), 1.5));
    if (r > 0.5) {
      const spin = t * 0.6;
      p.glow(0, SUN, Math.min(32, r * 3), C[4], 0.5);
      p.glow(0, SUN, r * 1.4, WHITE, 0.35);
      p.circle(0, SUN, r * 0.45, WHITE);
      oval(p, 0, SUN, r * 0.62, r * 0.62, C[6], 1);
      oval(p, 0, SUN, r, r, (g) => (Math.sin(g * 6 + spin * 4) > 0.5 ? WHITE : C[5]), 1);
      for (let j = 0; j < 16; j++) {
        const g = spin + (j * TAU) / 16, l = j % 2 ? 3 : 6;
        p.line(Math.cos(g) * (r + 2), SUN + Math.sin(g) * (r + 2), Math.cos(g) * (r + 2 + l), SUN + Math.sin(g) * (r + 2 + l), (u) => (u < 0.4 ? C[6] : C[4]), (u) => 1.1 - u);
      }
    }
    if (t > LIFT && t < LIFT + 0.3) sparkle(p, 0, SUN, 10 * (1 - (t - LIFT) / 0.3), WHITE, C[5], 0.6);
  }

  // the sigil burning on the floor: two rings and a turning band of marks; white-hot, then gold, then cooling
  function sigil(p, back) {
    if (t < HIT) return;
    const u = seg(t, HIT, HIT + 0.2), heat = 1 - smooth(SHUT, SHUT + 0.8, t), out = 1 - smooth(SHUT + 0.4, SHUT + 1, t);
    if (out <= 0) return;
    const keep = back ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0;
    // it burns in round from the front, both ways
    const burnt = (g) => Math.abs(((g - Math.PI / 2 + Math.PI) % TAU + TAU) % TAU - Math.PI) <= u * Math.PI + 0.01;
    const col = (g, hot) => {
      if (!burnt(g)) return 0;
      const flick = rand(Math.round(g * 40), Math.floor(t * 20)) < 0.18;
      return t < HIT + 0.08 || (flick && heat > 0.4) ? WHITE : heat > 0.6 ? (hot ? C[6] : C[5]) : heat > 0.3 ? C[4] : heat > 0.1 ? C[3] : C[2];
    };
    oval(p, 0, 0, RX, RX * SY, (g) => col(g, true), out, (g) => keep(g) && burnt(g));
    oval(p, 0, 0, RX * 0.72, RX * 0.72 * SY, (g) => col(g, false), out, (g) => keep(g) && burnt(g));
    // marks between the rings, turning slowly
    for (let j = 0; j < 12; j++) {
      const g = t * 0.35 + (j * TAU) / 12;
      if (!keep(g) || !burnt(g)) continue;
      const c = col(g, j % 2 === 0), r0 = RX * 0.78, r1 = RX * (j % 3 === 0 ? 0.95 : 0.88);
      if (c) p.line(Math.cos(g) * r0, Math.sin(g) * r0 * SY, Math.cos(g) * r1, Math.sin(g) * r1 * SY, c, out);
    }
    if (!back) {
      for (let i = -2; i <= 2; i++) p.glow(i * RX * 0.45, -2, 16, C[4], (0.34 - Math.abs(i) * 0.05) * out * (0.5 + 0.5 * heat));
      p.glow(0, -1, 10, WHITE, 0.3 * heat * out);
    }
  }

  return {
    update(dt) {
      t += dt;
      // light gathers to the sun as it opens
      if (t < OPEN + 0.1 && R.chance(0.5)) {
        const a = R.range(0, TAU), D = R.range(22, 34), x = Math.cos(a) * D, y = SUN + Math.sin(a) * D, T = R.range(0.18, 0.28), v = ((D - 10) * 3) / (Math.exp(3 * T) - 1);
        ps.spawn(P.STREAK, x, y, (-x / D) * v, ((SUN - y) / D) * v, T, R.chance(0.5) ? C[6] : C[5]);
      }
      if (!hit && t >= HIT) {
        hit = true;
        lights.add(0, -30, 64, C[5], 0.85, 0.5);
        lights.add(0, -6, 30, WHITE, 0.8, 0.12);
        for (let i = 0; i < 26; i++) {
          const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(70, 190);
          ps.spawn(P.SPARK, R.range(-3, 3), -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.25, 0.6));
        }
      }
      // while it holds: embers off the burning sigil, a few feathers drifting down through the shafts
      if (t > HIT && t < SHUT + 0.1 && R.chance(0.35)) {
        const g = R.range(0, TAU), r = RX * (R.chance(0.5) ? 1 : 0.72);
        ps.spawn(P.EMBER, Math.cos(g) * r, Math.sin(g) * r * SY - 1, R.range(-6, 6), -R.range(12, 30), R.range(0.5, 0.8), C[5], 1, 0, Math.sin(g) < 0 ? 4 : 0);
      }
      if (t > HIT && t < FOLD && R.chance(0.05)) ps.spawn(P.STAR, R.range(-1, 1) * 40, -R.range(20, 160), 0, R.range(2, 8), R.range(0.3, 0.6), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 1.8));
      // the fan snaps shut on the mark: a flash where the shafts become one
      if (!shut && t >= SHUT) {
        shut = true;
        lights.add(0, -60, 70, C[5], 0.7, 0.35);
        for (let i = 0; i < 12; i++) ps.spawn(P.STAR, R.range(-4, 4), -R.range(10, 170), R.range(-25, 25), R.range(-10, 10), R.range(0.4, 0.8), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 2));
      }
      if (!glinted && t >= LIFT) {
        glinted = true;
        lights.add(0, SUN, 40, WHITE, 0.6, 0.2);
      }
      ps.update(dt);
      feathers.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      fan(p);
      sigil(p, true);
      feathers.draw(p, WING, "back");
      ps.draw(p, "back");
    },
    draw(p) {
      sigil(p, false);
      // dust motes drifting down, lit only where a shaft catches them
      for (const m of motes) {
        const y = TOP + ((((m.y * DMAX + t * m.v) % DMAX) + DMAX) % DMAX), x = m.x + Math.sin(t * m.f + m.ph) * m.amp, I = lightAt(x, y);
        if (I < 0.2) continue;
        p.dot(x, y, I > 0.7 ? WHITE : C[6], Math.min(1, I * 1.3));
        p.light(x, y, C[5], 0.4 * Math.min(1, I));
      }
      sun(p);
      if (t > HIT - 0.02 && t < HIT + 0.25) sparkle(p, 0, PY - 2, 12 * (1 - (t - HIT) / 0.25), WHITE, C[5], 0.7);
      if (t > SHUT && t < SHUT + 0.2) sparkle(p, 0, PY - 2, 8 * (1 - (t - SHUT) / 0.2), WHITE, C[5], 0.5);
      feathers.draw(p, WING, "front");
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/arcane/magic-circle-cast.js"] = function(exports, __req) {
// The column of light (banded across, strands wandering in it, pulses and halos climbing it, stars thrown off,
// rings shocking out across the floor) is adapted from Sprite Fusion's open-source holy light
// (https://www.spritefusion.com/pixel-art-vfx/holy-light), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, PAL, fit, band, flare, sparkle, clamp, smooth, ease, noise2, fract, TAU, WHITE  } = __req("core/index.js");
const {  floorRing, bayer, glyph  } = __req("fx/arcane/_lib.js");

// the circle on the floor (plane px; the floor squashes depth by SY), the column, the beats
const R = 40, R2 = 35, RI = 24, RR = 30, SY = 0.3, TOP = 192, W = 11, NRUNE = 8;
const PEN = [0.04, 0.42], PEN2 = [0.1, 0.48], INNER = [0.3, 0.6], STAR = [0.52, 0.88], RUNES = [0.9, 1.3];
const FLASH = 1.52, BREAK = 2.42, GONE = 3.45, END = 3.9;

const meta = {
  name: "Magic circle cast",
  desc: "A circle draws itself on the floor, runes ignite one by one, it flashes, and a column of light fires up and breaks apart into glints.",
  tags: ["arcane", "magic", "circle", "rune", "cast", "column", "summon", "ground", "one-shot"],
  size: [200, 220],
  origin: [100, 192],
  duration: END,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: PAL.arcane, seed: 6 },
};

const wrap = (a) => ((a % TAU) + TAU) % TAU;
const fromFront = (g) => Math.abs(Math.atan2(Math.sin(g - Math.PI / 2), Math.cos(g - Math.PI / 2)));
// when the pens pass angle g: the outer rings are drawn from the front round both sides to the back, the inner
// ring from the back all the way round
const outerAt = (g, w) => w[0] + (fromFront(g) / Math.PI) * (w[1] - w[0]);
const innerAt = (g) => INNER[0] + (wrap(g + Math.PI / 2) / TAU) * (INNER[1] - INNER[0]);
const runeAngle = (k) => -Math.PI / 2 + ((k + 0.5) * TAU) / NRUNE;
const runeLit = (k) => RUNES[0] + (k * (RUNES[1] - RUNES[0])) / (NRUNE - 1);
const runeOut = (k) => BREAK + 0.2 + k * 0.08;

// how bright the drawn circle burns: settled while it's drawn, swelling as the runes light, white at the flash
function level(t) {
  if (t < RUNES[0]) return 0.55;
  if (t < FLASH) return 0.55 + 0.4 * smooth(RUNES[0], FLASH, t);
  if (t < FLASH + 0.07) return 1.2;
  if (t < BREAK) return 0.92;
  return 0.92 * (1 - smooth(BREAK, GONE, t));
}

function create(o) {
  const C = fit(o.palette, 8), S = o.seed, Rg = new Rng(S);
  const ps = new Particles({ rng: Rg, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
  const COL = [WHITE, C[6], C[5], C[4], C[3]];
  const strands = Array.from({ length: 9 }, () => ({ o: Rg.range(-0.85, 0.85), w: Rg.range(0.04, 0.1), f: Rg.range(1, 3) }));
  // the hexagram: two triangles inside the inner ring, each drawn edge by edge
  const tri = (a0) => [0, 1, 2].map((k) => a0 + (k * TAU) / 3).map((a) => [Math.cos(a) * RI, Math.sin(a) * RI]);
  const A = tri(-Math.PI / 2), Bt = tri(Math.PI / 2), edges = [];
  for (let k = 0; k < 3; k++)
    for (const T of [A, Bt]) edges.push({ p0: T[k], p1: T[(k + 1) % 3], t0: STAR[0] + (k * (STAR[1] - STAR[0])) / 3, dur: (STAR[1] - STAR[0]) / 3 });
  let t = 0, flashed = false, broke = false;
  const out = new Array(NRUNE).fill(false);

  const lineCol = (lvl, age) => (age < 0.05 ? WHITE : age < 0.16 ? C[6] : lvl > 1 ? WHITE : lvl > 0.8 ? C[6] : lvl > 0.45 ? C[5] : lvl > 0.28 ? C[4] : C[3]);
  const lineA = (lvl) => clamp(lvl / 0.3);

  // a straight line on the floor plane, drawn by a pen from p0 to p1 over [t0, t0 + dur]; only the far (v < 0) or near part
  function planeLine(p, p0, p1, t0, dur, lvl, far) {
    const s = clamp((t - t0) / dur);
    if (s <= 0) return;
    let u0 = 0, u1 = s;
    const v0 = p0[1], v1 = p1[1];
    if ((v0 < 0) !== (v1 < 0)) {
      const uc = v0 / (v0 - v1);
      if ((v0 < 0) === far) u1 = Math.min(u1, uc);
      else u0 = uc;
    } else if ((v0 < 0) !== far) return;
    if (u1 <= u0) return;
    const P = (u) => [p0[0] + (p1[0] - p0[0]) * u, (v0 + (v1 - v0) * u) * SY];
    const [xa, ya] = P(u0), [xb, yb] = P(u1);
    p.line(xa, ya, xb, yb, (q) => lineCol(lvl, t - (t0 + (u0 + (u1 - u0) * q) * dur)), lineA(lvl));
  }

  function circle(p, far) {
    if (t >= GONE) return;
    const lvl = level(t), keep = far ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0, a = lineA(lvl);
    const ring = (r, when, chase) => floorRing(p, 0, 0, r, SY, (g) => (chase && chase(g) ? WHITE : lineCol(lvl, t - when(g))), (g) => (t < when(g) ? 0 : a), keep);
    // from the moment the runes start to light, two sparks of light chase round the outer ring, faster and faster
    const run = t > RUNES[0] && t < BREAK ? (t - RUNES[0]) * 5 + (t - RUNES[0]) ** 2 * 4 : null;
    const chase = run === null ? null : (g) => [0, Math.PI].some((o) => Math.abs(Math.atan2(Math.sin(g - run - o), Math.cos(g - run - o))) < 0.22);
    ring(R, (g) => outerAt(g, PEN), chase);
    ring(R2, (g) => outerAt(g, PEN2));
    ring(RI, innerAt);
    // ticks across the band between the two outer rings
    for (let j = 0; j < 32; j++) {
      const g = ((j + 0.5) * TAU) / 32;
      if (Math.sin(g) < 0 !== far) continue;
      const when = outerAt(g, PEN2) + 0.03;
      if (t < when) continue;
      p.line(Math.cos(g) * R2, Math.sin(g) * R2 * SY, Math.cos(g) * R, Math.sin(g) * R * SY, lineCol(lvl, t - when), a * (j % 2 ? 0.6 : 1));
    }
    for (const e of edges) planeLine(p, e.p0, e.p1, e.t0, e.dur, lvl, far);
  }

  // the runes stand on the circle; dim when the inner pen passes, lit one by one, out one by one
  function runes(p, far) {
    for (let k = 0; k < NRUNE; k++) {
      const g = runeAngle(k);
      if (Math.sin(g) < 0 !== far) continue;
      const x = Math.cos(g) * RR, y0 = Math.sin(g) * RR * SY, lit = t - runeLit(k), gone = clamp((t - runeOut(k)) / 0.25);
      if (t < innerAt(g) || gone >= 1) continue;
      if (lit < 0) {
        glyph(p, k, x, y0 - 1, C[3]);
        continue;
      }
      const rise = 3 * ease.outBack(clamp(lit / 0.2), 2.4), bob = lit > 0.2 ? Math.sin(t * 5 + k) * 0.5 : 0, y = y0 - 1 - rise + bob;
      const hot = lit < 0.07 || (t > FLASH && t < FLASH + 0.07), lvl = level(t);
      glyph(p, k, x, y, hot ? WHITE : lvl > 0.8 ? WHITE : C[6], 1 - gone, hot ? C[6] : C[4]);
      if (lit < 0.1) sparkle(p, x, y - 2, 4 * (1 - lit / 0.1) + 1, C[6], C[5], 0.5);
      p.glow(x, y - 2, 8, C[5], (0.3 + 0.3 * lvl) * (1 - gone));
      p.glow(x, y0, 6, C[4], 0.2 * (1 - gone));
    }
  }

  // the column of light: the thread that climbs first, then the beam that fires up, holds and breaks apart
  function column(p) {
    if (t < FLASH - 0.22 || t > BREAK + 0.6) return;
    if (t < FLASH) {
      const a = smooth(FLASH - 0.22, FLASH - 0.04, t), top = -(TOP - 10) * ease.outCubic(a);
      for (let y = -1; y >= top; y--) p.dot(0, y, y > top + 6 ? C[6] : WHITE, a * (0.35 + 0.65 * (1 + y / TOP)));
      p.glow(0, top, 9, C[6], 0.5 * a);
      p.glow(0, -6, 24, C[5], 0.4 * a);
      return;
    }
    const u = t - FLASH, brk = clamp((t - BREAK) / 0.45), top = -TOP * ease.outExpo(clamp(u / 0.09));
    const w = t < BREAK ? W * (1 + 0.38 * Math.exp(-u * 9)) : W * (1 - ease.outCubic(brk) * 0.85);
    const fade = 1 - smooth(BREAK + 0.25, BREAK + 0.55, t), white = u < 0.067;
    if (fade <= 0) return;
    for (let y = 3; y >= Math.ceil(top); y--) {
      const h = -y, ww = w * (1 + 0.5 * Math.exp(-Math.max(0, h) / 6)), pulse = fract(h * 0.022 - u * 2.6) < 0.07 ? 1 : 0;
      for (let x = Math.floor(-ww * 1.3); x <= Math.ceil(ww * 1.3); x++) {
        const q = Math.abs(x + 0.5) / ww;
        // as it breaks, holes open and grow and drift upward until only shards are left
        if (brk > 0 && noise2(x * 0.32, h * 0.11 - (t - BREAK) * 6, S) * 0.5 + 0.5 < brk * 1.25 - 0.1) continue;
        let lv = q < 0.2 ? 0 : q < 0.42 ? 1 : q < 0.66 ? 2 : q < 0.88 ? 3 : 4;
        for (const s of strands) if (Math.abs((x + 0.5) / ww - s.o - 0.05 * Math.sin(t * s.f + s.o * 9)) < s.w) lv = Math.max(0, lv - 1);
        lv = white ? 0 : Math.max(0, lv - pulse);
        const a = (q < 0.88 ? 1 : (1.3 - q) / 0.42) * fade;
        if (a <= bayer(x, y) * (q < 0.66 ? 0.2 : 1)) continue;
        p.px(x, y, COL[lv]);
      }
      if ((h & 7) === 0 && h < TOP - ww * 2.4 - 8) p.glow(0, y, ww * 2.4 + 6, C[5], 0.3 * fade);
    }
    // halos climbing it
    for (let i = 0; i < 6; i++) {
      const k = (t - (FLASH + 0.08 + i * 0.16)) / 0.8;
      if (k < 0 || k > 1) continue;
      const rx = w * 1.4 * (1 + k * 0.35), ry = rx * 0.3, yc = -3 - ease.outQuad(k) * 120, n = Math.ceil(rx * 7);
      for (let j = 0; j < n; j++) {
        const g = (j / n) * TAU;
        p.dot(Math.cos(g) * rx, yc + Math.sin(g) * ry, k < 0.3 ? WHITE : C[6], (1 - k) * fade * (Math.sin(g) < 0 ? 0.6 : 1));
      }
    }
    // white-hot where it meets the floor
    p.glow(0, -4, 34, C[6], 0.45 * fade);
    p.glow(0, -60, 70, C[4], 0.25 * fade);
  }

  function shock(p, far) {
    for (const [d, r0, r1, th, dur] of [[0, R * 0.6, R * 2, 6, 0.5], [0.08, R * 0.4, R * 1.4, 3, 0.4]]) {
      const k = (t - FLASH - d) / dur;
      if (k < 0 || k >= 1) continue;
      band(p, 0, 0, r0 + (r1 - r0) * ease.outCubic(k), SY, Math.max(1, th * (1 - k)), 1.15 - k, [C[3], C[5], C[6], WHITE], (g) => Math.sin(g) < 0 === far, k < 0.2);
    }
  }

  return {
    update(dt) {
      t += dt;
      // the pens shed glitter as they write
      if (t > PEN[0] && t < STAR[1] && Rg.chance(0.5)) {
        let x, y;
        if (t < PEN[1]) {
          const g = Math.PI / 2 + Rg.sign() * ((t - PEN[0]) / (PEN[1] - PEN[0])) * Math.PI;
          (x = Math.cos(g) * R), (y = Math.sin(g) * R * SY);
        } else if (t < INNER[1]) {
          const g = -Math.PI / 2 + ((t - INNER[0]) / (INNER[1] - INNER[0])) * TAU;
          (x = Math.cos(g) * RI), (y = Math.sin(g) * RI * SY);
        } else {
          const e = Rg.pick(edges.filter((e) => t >= e.t0 && t < e.t0 + e.dur)) ?? edges[0], s = clamp((t - e.t0) / e.dur);
          (x = e.p0[0] + (e.p1[0] - e.p0[0]) * s), (y = (e.p0[1] + (e.p1[1] - e.p0[1]) * s) * SY);
        }
        ps.spawn(P.EMBER, x, y - 1, Rg.range(-12, 12), Rg.range(-30, -8), Rg.range(0.25, 0.55), C[6], 1);
      }
      // gathering: light rushes in along the floor to the heart of the circle
      if (t > RUNES[1] - 0.1 && t < FLASH - 0.05 && Rg.chance(0.7)) {
        const g = Rg.range(0, TAU), D = Rg.range(R * 0.7, R * 1.1), T = Rg.range(0.16, 0.24), v = (D * 3) / (Math.exp(3 * T) - 1);
        const x = Math.cos(g) * D, y = Math.sin(g) * D * SY - 1, l = Math.hypot(x, y + 2) || 1;
        ps.spawn(P.STREAK, x, y, (-x / l) * v, ((-2 - y) / l) * v, T, Rg.chance(0.5) ? C[6] : C[5]);
      }
      if (!flashed && t >= FLASH) {
        flashed = true;
        lights.add(0, -56, 104, C[5], 0.9, 0.6);
        lights.add(0, -5, 36, WHITE, 0.8, 0.14);
        for (let i = 0; i < 36; i++) {
          const s = Rg.sign(), sp = Rg.range(80, 175);
          ps.spawn(P.SPARK, s * Rg.range(0, R * 0.5), -1, s * sp, -Rg.range(30, 180), Rg.range(0.25, 0.7));
        }
        for (let i = 0; i < 26; i++)
          ps.spawn(P.STAR, Rg.range(-R, R), -Rg.range(1, 6), Rg.range(-20, 20), -Rg.range(40, 130), Rg.range(0.5, 1.1), Rg.pick([WHITE, C[6], C[5]]), Rg.range(0.8, 2.3));
        // and a spray of twinkles flung out low across the floor
        for (let i = 0; i < 34; i++) {
          const s = Rg.sign();
          ps.spawn(P.STAR, s * Rg.range(0, 14), -Rg.range(1, 4), s * Rg.range(50, 140), -Rg.range(10, 90), Rg.range(0.4, 0.95), Rg.pick([WHITE, C[6], C[6], C[5]]), Rg.range(0.7, 2.2));
        }
      }
      // glints pop along the burning circle
      if (t > RUNES[0] && t < BREAK + 0.2 && Rg.chance(0.12)) {
        const g = Rg.range(0, TAU), r = Rg.pick([R, R2, RI]);
        ps.spawn(P.STAR, Math.cos(g) * r, Math.sin(g) * r * SY - 0.5, 0, -Rg.range(2, 8), Rg.range(0.25, 0.45), Rg.pick([WHITE, C[6]]), Rg.range(0.8, 2));
      }
      // the column throws off stars, and light streams up inside it
      if (t > FLASH && t < BREAK) {
        if (Rg.chance(0.5)) ps.spawn(P.STAR, Rg.range(-1, 1) * W * 1.5, -Rg.range(0, 120), Rg.range(-10, 10), -Rg.range(30, 85), Rg.range(0.5, 1.1), Rg.pick([WHITE, C[6], C[5]]), Rg.range(0.7, 2));
        if (Rg.chance(0.35)) ps.spawn(P.MOTE, Rg.range(-1, 1) * W * 0.8, -Rg.range(0, 50), 0, -Rg.range(160, 300), Rg.range(0.2, 0.35), Rg.chance(0.5) ? WHITE : C[6], 0.8);
      }
      // it breaks apart into glints that twinkle as they drift up
      if (!broke && t >= BREAK) {
        broke = true;
        for (let i = 0; i < 46; i++)
          ps.spawn(P.STAR, Rg.range(-1, 1) * W * 0.9, -Rg.range(2, TOP * 0.8), Rg.range(-12, 12), -Rg.range(8, 40), Rg.range(0.5, 1.15), Rg.pick([WHITE, WHITE, C[6], C[5]]), Rg.range(0.6, 2.4));
      }
      if (t > BREAK && t < BREAK + 0.4 && Rg.chance(0.8)) {
        ps.spawn(P.STAR, Rg.range(-1, 1) * W * 0.7, -Rg.range(2, TOP * 0.78), Rg.range(-8, 8), -Rg.range(10, 50), Rg.range(0.4, 0.9), Rg.pick([WHITE, C[6], C[5]]), Rg.range(0.6, 1.8));
        if (Rg.chance(0.4)) ps.spawn(P.MOTE, Rg.range(-1, 1) * W * 0.5, -Rg.range(2, TOP * 0.7), 0, -Rg.range(60, 140), Rg.range(0.2, 0.4), C[6], 0.7);
      }
      // the runes go out one by one, each in a little puff of glints
      for (let k = 0; k < NRUNE; k++)
        if (!out[k] && t >= runeOut(k)) {
          out[k] = true;
          const g = runeAngle(k), x = Math.cos(g) * RR, y = Math.sin(g) * RR * SY - 5;
          for (let i = 0; i < 4; i++) ps.spawn(P.STAR, x + Rg.range(-2, 2), y + Rg.range(-2, 2), Rg.range(-14, 14), -Rg.range(10, 40), Rg.range(0.3, 0.55), Rg.pick([WHITE, C[6]]), Rg.range(0.6, 1.6));
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const lvl = level(t);
      if (t < GONE) {
        const k = lvl * smooth(PEN[0], PEN[1] + 0.2, t);
        p.glow(0, 0, R * 1.3, C[4], 0.28 * k);
        for (const s of [-1, 1]) p.glow(s * R * 0.6, 1, R * 0.7, C[5], 0.12 * k);
      }
      shock(p, true);
      circle(p, true);
      runes(p, true);
      column(p);
      ps.draw(p, "back");
    },
    draw(p) {
      shock(p, false);
      circle(p, false);
      runes(p, false);
      // the pens: white points running round, writing light
      const pen = (x, y) => {
        sparkle(p, x, y, 2, C[6], C[5], 0.5);
        p.glow(x, y, 7, C[6], 0.45);
      };
      if (t > PEN[0] && t < PEN[1]) for (const s of [-1, 1]) {
        const g = Math.PI / 2 + s * ((t - PEN[0]) / (PEN[1] - PEN[0])) * Math.PI;
        pen(Math.cos(g) * R, Math.sin(g) * R * SY);
      }
      if (t > INNER[0] && t < INNER[1]) {
        const g = -Math.PI / 2 + ((t - INNER[0]) / (INNER[1] - INNER[0])) * TAU;
        pen(Math.cos(g) * RI, Math.sin(g) * RI * SY);
      }
      for (const e of edges)
        if (t > e.t0 && t < e.t0 + e.dur) {
          const s = (t - e.t0) / e.dur;
          pen(e.p0[0] + (e.p1[0] - e.p0[0]) * s, (e.p0[1] + (e.p1[1] - e.p0[1]) * s) * SY);
        }
      // the flash
      if (t >= FLASH && t < FLASH + 0.24) {
        const a = (t - FLASH) / 0.24;
        flare(p, 0, -8, 34 * Math.pow(1 - a, 1.5), 1 - a, C);
        p.glow(0, -26, 56, WHITE, 0.5 * (1 - a));
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/arcane/_lib.js"] = function(exports, __req) {
// Shared by the arcane effects: a dithered light ramp, closed-form motes and streaks for loops, crackling
// arcs, floor rings and an original rune alphabet. Files starting with _ are helpers, not effects.
// The dithered ramp (tone) is adapted from Sprite Fusion's open-source black hole
// (https://www.spritefusion.com/pixel-art-vfx/black-hole), and the arc drawing from its energy
// (https://www.spritefusion.com/pixel-art-vfx/energy), MIT License, Copyright (c) 2026 Hugo Duprez.

const {  scale, clamp, bolt, luma, WHITE  } = __req("core/index.js");

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const CROSS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** The 4x4 ordered-dither threshold (0..1) of the pixel cell holding (x, y). */
const bayer = (x, y) => BAYER[((Math.floor(y) & 3) << 2) | (Math.floor(x) & 3)];

/**
 * Light intensity I (0..1) to a step of ramp R (dark to bright), dithering between neighbouring steps so a
 * gradient reads smooth at 1x; below lo it thins out through the dither and returns 0 (draw nothing).
 */
function tone(R, I, x, y, lo = 0.06, sharp = 0) {
  const b = bayer(x, y);
  if (I < lo && b > I / lo) return 0;
  const n = R.length - 1, f = clamp(I) * n;
  let i = Math.floor(f);
  // sharp (0..1) narrows the dithered zone between two steps, so broad areas stay clean and only edges dither
  const q = sharp > 0 ? clamp((f - i - 0.5) / (1 - sharp) + 0.5) : f - i;
  if (q > b) i = Math.min(n, i + 1);
  return R[i];
}

/** A drifting mote at (x, y) moving (vx, vy) px/s, drawn like the sim's MOTE: bright head, darker tail, light. */
function mote(p, x, y, vx, vy, c, size = 1, k = 1, glow = 0.4) {
  const sp = Math.hypot(vx, vy) || 1, ux = vx / sp, uy = vy / sp, len = Math.min(16, 0.5 + sp * 0.026) * size, a = k < 0.35 ? k / 0.35 : 1;
  if (len > 1.2) p.line(x - ux * len, y - uy * len, x - ux * len * 0.35, y - uy * len * 0.35, scale(c, 0.55), a);
  p.line(x - ux * len * 0.4, y - uy * len * 0.4, x, y, c, a);
  if (glow > 0) p.glow(x, y, 2.5 + size, c, glow * k);
}

/** Energy rushing in, drawn like the sim's STREAK: a white tip, a colored body, a dim dotted tail. */
function streak(p, x, y, vx, vy, c, a = 1, maxLen = 7, glow = 0.4) {
  const sp = Math.hypot(vx, vy) || 1, ux = vx / sp, uy = vy / sp, L = clamp(sp / 30, 1, maxLen);
  for (let d = L; d >= 0; d -= 0.5) p.dot(x - ux * d, y - uy * d, d < 1 ? WHITE : d < L * 0.5 ? c : scale(c, 0.6), (d < L * 0.5 ? 1 : 1.2 - d / L) * a);
  if (glow > 0) p.glow(x, y, 4, c, glow * a);
}

/**
 * A crackling arc from (x0, y0) to (x1, y1): a jagged main path plus forks, as [{ pts, w }]. r is an Rng, so
 * re-seed it every couple of frames for flicker.
 */
function arc(r, x0, y0, x1, y1, { jag = 0.3, forks = 1, forkLen = 0.5 } = {}) {
  const L = Math.hypot(x1 - x0, y1 - y0), depth = Math.max(1, Math.min(5, Math.round(Math.log2(L / 1.5)))), main = bolt(r, x0, y0, x1, y1, { jag, depth });
  const out = [{ pts: main, w: 1 }];
  for (let k = 0; k < forks && main.length > 3; k++) {
    if (r.next() > 0.7) continue;
    const i = 1 + Math.floor(r.next() * (main.length - 2)), [x, y] = main[i], [px, py] = main[i - 1];
    const a = Math.atan2(y - py, x - px) + (r.next() < 0.5 ? -1 : 1) * (0.4 + r.next() * 0.6), l = L * forkLen * (0.4 + 0.6 * r.next()) * (1 - i / main.length);
    if (l > 1.5) out.push({ pts: bolt(r, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, { jag: jag * 1.1, depth: Math.max(1, depth - 2) }), w: 0.55 });
  }
  return out;
}

/**
 * Draw arc paths the way Sprite Fusion draws its bolts: a dithered halo while it's fresh, a body beside the
 * core, a white core, light along the path. cols: { core, body, halo, glow }; k: 1 fresh .. 0 gone.
 */
function drawArc(p, paths, cols, k = 1, glowK = 0.5) {
  const steps = (fn) => {
    for (const path of paths)
      for (let i = 0; i < path.pts.length - 1; i++) {
        const [ax, ay] = path.pts[i], [bx, by] = path.pts[i + 1], l = Math.max(1, Math.hypot(bx - ax, by - ay));
        for (let d = 0; d <= l; d += 0.5) fn(ax + ((bx - ax) * d) / l, ay + ((by - ay) * d) / l, path, i, d === 0);
      }
  };
  if (k > 0.45) steps((x, y, path) => { if (path.w >= 1) for (const [dx, dy] of CROSS) p.dot(x + dx * 1.5, y + dy * 1.5, cols.halo, (k - 0.45) * 1.6); });
  if (k > 0.25) steps((x, y, path) => { if (path.w > 0.4) (p.dot(x + 1, y, cols.body), p.dot(x, y + 1, cols.body)); });
  steps((x, y, path, i, first) => {
    p.px(x, y, path.w >= 1 && k > 0.3 ? cols.core : cols.body);
    if (first && i % 3 === 0) p.glow(x, y, (path.w >= 1 ? 9 : 5) * (0.5 + k * 0.5), cols.glow, glowK * k * path.w);
  });
}

/**
 * A ring lying on the floor (or any tilted plane): centre (cx, cy), radius r, squashed by sy, 1 px thick at
 * any size. c and a may be functions of the angle g around it (sin(g) > 0 is the near side, towards the viewer).
 * keep(g) picks which part to draw: (g) => Math.sin(g) < 0 is the far half, for drawBack.
 */
function floorRing(p, cx, cy, r, sy, c, a = 1, keep = null) {
  if (r < 0.5) return;
  const fc = typeof c === "function", fa = typeof a === "function", ry = r * sy;
  p.shade(cx - r - 1, cy - ry - 1, cx + r + 1, cy + ry + 1, (x, y, o) => {
    const nx = (x - cx) / r, ny = (y - cy) / Math.max(0.3, ry), d = Math.hypot(nx, ny);
    if (d < 1e-6) return;
    const g = Math.hypot(nx / r, ny / Math.max(0.3, ry)) / d;
    if (Math.abs(d - 1) / g > 0.5) return;
    const ang = Math.atan2(ny, nx);
    if (keep && !keep(ang)) return;
    o.c = fc ? c(ang) : c;
    o.a = fa ? a(ang) : a;
  });
}

// An original rune alphabet: angular 3 x 5 glyphs that stay readable standing upright at 1x.
const GLYPHS = [
  [".#.", "#.#", ".#.", ".#.", "#.#"],
  ["#.#", "#.#", ".#.", "#.#", "#.#"],
  ["##.", "#.#", "##.", "#..", "#.."],
  ["#..", "#.#", "###", "#.#", "..#"],
  [".##", "#..", ".#.", "..#", "##."],
  ["###", ".#.", "###", ".#.", ".#."],
  ["#.#", "###", "#.#", "..#", "..#"],
  [".#.", ".##", ".#.", "##.", ".#."],
];

/**
 * Rune i standing on (x, y): its bottom row sits on y, centred on x. c body color, a alpha (dithered), under an
 * optional darker color drawn a pixel lower so the glyph has a little thickness.
 */
function glyph(p, i, x, y, c, a = 1, under = 0) {
  const g = GLYPHS[((i % GLYPHS.length) + GLYPHS.length) % GLYPHS.length], X = Math.round(x) - 1, Y = Math.round(y) - g.length + 1;
  if (under) p.sprite(g, {}, X, Y + 1, { tint: under, a });
  p.sprite(g, {}, X, Y, { tint: c, a });
}

// Larger original sigils, 5 x 7, for runes that fly or hover on their own.
const SIGILS = [
  ["..#..", ".#.#.", "#.#.#", "..#..", ".###.", "..#..", ".#.#."],
  ["#...#", ".#.#.", "..#..", ".###.", "..#..", ".#.#.", "#...#"],
  ["#....", "##...", "#.#..", "#..#.", "#.#..", "##...", "#...."],
  ["..#..", "#.#.#", ".###.", "..#..", "..#..", ".#.#.", "#...#"],
  ["#.#.#", "#.#.#", "#####", "..#..", "..#..", "..#..", ".###."],
  ["#...#", "##.##", "#.#.#", "#...#", "#.#.#", "##.##", "#...#"],
  ["..#..", ".#.#.", "#...#", ".#.#.", "..#..", "..#..", "..#.."],
  ["#..#.", "#.#..", "##...", "#....", "##...", "#.#..", "#..#."],
];

/** Sigil i centred on (x, y) in color c, ringed by a 1 px edge in a darker color so it reads against anything. */
function sigil(p, i, x, y, c, a = 1, edge = 0) {
  const g = SIGILS[((i % SIGILS.length) + SIGILS.length) % SIGILS.length], X = Math.round(x) - 2, Y = Math.round(y) - 3;
  if (edge) for (const [dx, dy] of CROSS) p.sprite(g, {}, X + dx, Y + dy, { tint: edge, a });
  p.sprite(g, {}, X, Y, { tint: c, a });
}

/** A character's silhouette shaded by how light each pixel is: 1 its dark outline, 2 mid, 3 light (0 empty). */
function shades(A) {
  const s = new Uint8Array(A.w * A.h);
  for (let i = 0; i < s.length; i++) if (A.mask.data[i]) s[i] = A.pixels ? (luma(A.pixels[i]) < 0.24 ? 1 : luma(A.pixels[i]) < 0.62 ? 2 : 3) : 2;
  return s;
}

/**
 * Silhouette A (an actor) squeezed to sx of its width about its middle and shifted by dx: body color on its
 * pixels, edge color on its dark outline pixels. sh is shades(A). The blink's squeeze, adapted from Sprite Fusion.
 */
function squeezed(p, A, sh, sx, body, edge, a = 1, dx = 0) {
  if (sx <= 0.02) return;
  const cx = A.x + A.w / 2, half = A.w / 2 + 1;
  for (let y = 0; y < A.h; y++)
    for (let x = Math.floor(cx - half * sx); x <= Math.ceil(cx + half * sx); x++) {
      const i = Math.round(cx + (x + 0.5 - cx) / sx - 0.5) - A.x, v = i < 0 || i >= A.w ? 0 : sh[y * A.w + i];
      if (v) p.dot(x + dx, A.y + y, v === 1 ? edge : body, a);
    }
}

exports.tone = tone;
exports.mote = mote;
exports.streak = streak;
exports.arc = arc;
exports.drawArc = drawArc;
exports.floorRing = floorRing;
exports.glyph = glyph;
exports.sigil = sigil;
exports.shades = shades;
exports.squeezed = squeezed;
exports.bayer = bayer;
exports.GLYPHS = GLYPHS;
exports.SIGILS = SIGILS;
  };
  __mods["fx/arcane/star-fall.js"] = function(exports, __req) {
// The slanted streaks landing with a ring and a kick of bits follow Sprite Fusion's open-source rain
// (https://www.spritefusion.com/pixel-art-vfx/rain), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, PAL, fit, band, flare, sparkle, clamp, ease, TAU, WHITE  } = __req("core/index.js");

const N = 11, SPREAD = 46, H = 124, SLANT = 0.38, TRAIL = 0.17;

const meta = {
  name: "Star fall",
  desc: "Stars streak down on long trails across an area, each landing with a white flash, a ring across the floor and a kick of sparks.",
  tags: ["arcane", "star", "meteor", "rain", "aoe", "magic", "ground", "one-shot"],
  size: [232, 172],
  origin: [124, 150],
  duration: 2.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: PAL.arcane, seed: 13 },
};

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
  // where they land: spread over the area in a shuffled order, a little in front of or behind the line
  const xs = Array.from({ length: N }, (_, i) => -SPREAD + ((i + R.range(0.2, 0.8)) * 2 * SPREAD) / N);
  for (let i = N - 1; i > 0; i--) {
    const j = R.int(0, i);
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  const stars = xs.map((x, i) => {
    const y = R.range(-3, 2), h = H * R.range(0.85, 1);
    return { x, y, sx: x - h * SLANT, sy: y - h, t0: 0.04 + i * 0.105 + R.range(0, 0.05), T: R.range(0.3, 0.4), landed: false, big: R.chance(0.35), ph: R.range(0, TAU) };
  });
  const hits = [];
  let t = 0;
  const at = (s, tt) => {
    const q = clamp((tt - s.t0) / s.T), e = q * (0.35 + 0.65 * q);
    return [s.sx + (s.x - s.sx) * e, s.sy + (s.y - s.sy) * e, q];
  };

  function star(p, s) {
    const [x, y, q] = at(s, t);
    // the trail: a long tapered streak back up its path, white at the head, thinning into violet
    const n = 20;
    for (let k = n; k >= 1; k--) {
      const [ax, ay] = at(s, t - (k * TRAIL) / n), [bx, by] = at(s, t - ((k - 1) * TRAIL) / n), u = k / n;
      if (t - (k * TRAIL) / n < s.t0) continue;
      const c = u < 0.15 ? WHITE : u < 0.4 ? C[6] : u < 0.7 ? C[5] : C[4];
      // a second line beside the first near the head gives it body; the tail thins to a dithered thread
      if (u < (s.big ? 0.55 : 0.35)) p.line(ax + 1, ay, bx + 1, by, u < 0.2 ? C[6] : C[5], 1.1 - u * 1.4);
      p.line(ax, ay, bx, by, c, 1.3 - u);
      if (k % 3 === 0) p.glow(ax, ay, 7 * (1 - u) + 2, C[5], 0.3 * (1 - u));
    }
    // the head: a twinkling four-point star
    if (s.big) flare(p, x, y, 7 + 1.5 * Math.sin(t * 40 + s.ph), 0.8, C);
    else sparkle(p, x, y, 3.5 + Math.sin(t * 40 + s.ph), C[6], C[5], 0.6);
    p.circle(x, y, s.big ? 1.6 : 1.1, WHITE);
    p.glow(x, y, s.big ? 18 : 13, C[5], 0.6);
    p.glow(x, y, 5, WHITE, 0.35);
    return q;
  }

  function hit(p, h, far) {
    const k = (t - h.t) / 0.45;
    if (k < 0 || k >= 1) return;
    band(p, h.x, h.y, 3 + (h.big ? 22 : 16) * ease.outCubic(k), 0.26, Math.max(1, 2.5 * (1 - k)), 1.15 - k, [C[3], C[5], C[6], WHITE], (g) => Math.sin(g) < 0 === far, k < 0.2);
  }

  return {
    update(dt) {
      t += dt;
      for (const s of stars) {
        if (t < s.t0 || s.landed) continue;
        const [x, y, q] = at(s, t);
        if (R.chance(0.55)) ps.spawn(P.STAR, x + R.range(-1.5, 1.5), y + R.range(-1.5, 1.5), R.range(-12, 12), R.range(-8, 4), R.range(0.35, 0.7), R.pick([WHITE, C[6], C[5]]), R.chance(0.7) ? R.range(0.4, 0.9) : R.range(1.2, 1.8));
        if (q >= 1) {
          s.landed = true;
          hits.push({ x: s.x, y: s.y, t, big: s.big });
          lights.add(s.x, s.y - 12, s.big ? 46 : 38, C[5], 0.9, 0.32);
          lights.add(s.x, s.y - 3, 16, WHITE, 0.8, 0.08);
          for (let i = 0; i < (s.big ? 14 : 9); i++) {
            const a = -Math.PI / 2 + R.range(-1.35, 1.35), sp = R.range(50, 150);
            ps.spawn(P.SPARK, s.x, Math.min(-1, s.y - 1), Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.5));
          }
          for (let i = 0; i < 4; i++) ps.spawn(P.STAR, s.x + R.range(-4, 4), s.y - R.range(2, 8), R.range(-15, 15), -R.range(10, 35), R.range(0.4, 0.8), R.pick([WHITE, C[6]]), R.range(0.8, 2));
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // the area lit beneath while they fall
      const k = clamp(t / 0.3) * (1 - clamp((t - 1.7) / 0.7));
      if (k > 0) for (const x of [-36, 0, 36]) p.glow(x, -1, 40, C[4], 0.14 * k);
      for (const h of hits) hit(p, h, true);
      // a glowing mark where each landed, cooling away
      for (const h of hits) {
        const k2 = 1 - (t - h.t) / 0.7;
        if (k2 <= 0) continue;
        p.dot(h.x, h.y, k2 > 0.6 ? WHITE : C[6], k2 * 1.5);
        for (const dx of [-1, 1]) p.dot(h.x + dx, h.y, C[5], k2 * 1.2);
        p.glow(h.x, h.y - 1, 10, C[5], 0.35 * k2);
      }
      ps.draw(p, "back");
    },
    draw(p) {
      for (const s of stars) if (t >= s.t0 && !s.landed) star(p, s);
      for (const h of hits) {
        hit(p, h, false);
        const k = (t - h.t) / 0.22;
        if (k < 0 || k >= 1) continue;
        if (k < 0.35) p.circle(h.x, h.y - 2, 5 * (1 - k / 0.35) + 1, WHITE);
        flare(p, h.x, h.y - 2, (h.big ? 16 : 12) * Math.pow(1 - k, 1.5) + 2, 1 - k, C);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/arcane/mana-burst.js"] = function(exports, __req) {
// The release (a white disc, a cross, two rings, a big light and a spray of motes and stars) is adapted from
// Sprite Fusion's open-source energy charge (https://www.spritefusion.com/pixel-art-vfx/energy),
// MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, PAL, fit, flare, sparkle, clamp, ease, TAU, WHITE  } = __req("core/index.js");
const {  sigil  } = __req("fx/arcane/_lib.js");

const CY = -28, GATHER = 0.22, N = 9;

const meta = {
  name: "Mana burst",
  desc: "Energy rushes into a point and blows out in a white flash and rings, flinging glowing runes that flare and pop into sparks one after another.",
  tags: ["arcane", "burst", "mana", "rune", "nova", "magic", "ground", "one-shot"],
  size: [208, 150],
  origin: [104, 124],
  duration: 1.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: PAL.arcane, seed: 9 },
};

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
  // the runes: flung out round the burst, slowing hard, bobbing while they burn, each popping in its turn
  const runes = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * TAU + R.range(-0.25, 0.25) - Math.PI / 2, sp = R.range(150, 210);
    // thrown less far downward, so the low ones stay clear of the floor
    return { g: i, x: 0, y: CY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (Math.sin(a) > 0 ? 0.42 : 0.85), pop: GATHER + 0.42 + i * 0.065 + R.range(0, 0.05), popped: false, ph: R.range(0, TAU) };
  });
  const pops = [];
  let t = 0, released = false;

  return {
    update(dt) {
      t += dt;
      if (t < GATHER - 0.03) {
        // the gather: streaks rush in from all round
        for (let i = 0; i < 2; i++) {
          const a = R.range(0, TAU), D = R.range(24, 52), T = R.range(0.12, 0.18), v = (D * 3) / (Math.exp(3 * T) - 1);
          const x = Math.cos(a) * D, y = Math.min(-2, CY + Math.sin(a) * D * 0.85), l = Math.hypot(x, y - CY) || 1;
          ps.spawn(P.STREAK, x, y, (-x / l) * v, ((CY - y) / l) * v, T, R.chance(0.5) ? C[6] : C[5]);
        }
      }
      if (t >= GATHER && !released) {
        released = true;
        lights.add(0, CY - 12, 96, C[5], 1, 0.5);
        lights.add(0, CY, 40, WHITE, 0.9, 0.1);
        // a spray of motes and stars, thrown less hard at the floor
        for (let i = 0; i < 96; i++) {
          const a = R.range(0, TAU), sp = R.range(100, 250), dn = Math.sin(a) > 0 ? 0.45 : 1;
          ps.spawn(R.chance(0.65) ? P.MOTE : P.STAR, 0, CY, Math.cos(a) * sp, Math.sin(a) * sp * dn, R.range(0.25, 0.55), R.pick([WHITE, C[6], C[5]]), R.range(0.8, 1.8));
        }
        for (let i = 0; i < 20; i++) {
          const a = R.range(0, TAU), sp = R.range(130, 280);
          ps.spawn(P.SPARK, 0, CY, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.45));
        }
      }
      if (released)
        for (const r of runes) {
          if (r.popped) continue;
          r.vx -= r.vx * 4.2 * dt;
          r.vy -= r.vy * 4.2 * dt + 8 * dt;
          r.x += r.vx * dt;
          r.y += r.vy * dt;
          if (R.chance(0.35)) ps.spawn(P.MOTE, r.x + R.range(-1.5, 1.5), r.y, r.vx * 0.2 + R.range(-10, 10), r.vy * 0.2 - R.range(5, 25), R.range(0.2, 0.4), C[5], 0.5);
          if (t >= r.pop) {
            r.popped = true;
            pops.push({ t, x: r.x, y: r.y });
            lights.add(r.x, r.y, 34, C[5], 0.9, 0.22);
            lights.add(r.x, r.y, 12, WHITE, 0.8, 0.06);
            for (let i = 0; i < 9; i++) {
              const a = R.range(0, TAU), sp = R.range(70, 200);
              ps.spawn(P.SPARK, r.x, r.y, Math.cos(a) * sp, Math.sin(a) * sp - 40, R.range(0.15, 0.4));
            }
            for (let i = 0; i < 5; i++) {
              const a = R.range(0, TAU), sp = R.range(20, 80);
              ps.spawn(i % 2 ? P.STAR : P.MOTE, r.x, r.y, Math.cos(a) * sp, Math.sin(a) * sp - 20, R.range(0.3, 0.6), R.pick([WHITE, C[6]]), R.range(0.8, 1.6));
            }
          }
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // the floor beneath catches the burst
      const k = t < GATHER ? 0.4 * (t / GATHER) : Math.max(0, 1 - (t - GATHER) / 1.1);
      if (k > 0) p.glow(0, -1, 50, C[4], 0.3 * k);
    },
    draw(p) {
      if (t < GATHER) {
        // the point it gathers into: a swelling ball with a white heart
        const k = t / GATHER, r = 1 + 3.5 * k * k;
        p.circle(0, CY, r + 1.2, C[4]);
        p.circle(0, CY, r, C[6]);
        p.circle(0, CY, r * 0.5, WHITE);
        p.glow(0, CY, 10 + 20 * k, C[5], 0.4 + 0.4 * k);
        const q = clamp((t - GATHER * 0.35) / (GATHER * 0.65));
        if (q > 0 && q < 1) p.ring(0, CY, r + 2 + 16 * (1 - ease.outCubic(q)), 1, q > 0.6 ? WHITE : C[6], 1 - q * 0.5);
      } else {
        const q = (t - GATHER) / 0.6;
        if (q < 1) {
          const e = ease.outCubic(q);
          if (q < 0.12) {
            p.circle(0, CY, 12 * (1 - q / 0.12) + 2, C[5]);
            p.circle(0, CY, 12 * (1 - q / 0.12), WHITE);
          }
          if (q < 0.32) flare(p, 0, CY, 30 * (1 - q / 0.32) + 4, 1 - q / 0.32, C);
          // the rings, cut off where they meet the floor
          p.ring(0, CY, 4 + 62 * e, Math.max(1, 5 * (1 - q)), q < 0.2 ? WHITE : C[6], (v, ang) => (CY + Math.sin(ang) * (4 + 62 * e) > 0 ? 0 : 1.2 - q));
          p.ring(0, CY, 2 + 38 * ease.outCubic(Math.min(1, q * 1.4)), Math.max(1, 2 * (1 - q)), C[5], (v, ang) => (CY + Math.sin(ang) * 40 > 0 ? 0 : 1 - q));
          p.glow(0, CY, 60 * (0.4 + 0.6 * e), C[5], 0.9 * (1 - q));
        }
      }
      // the runes: white as they fly, settling to lilac, flaring white just before they pop
      for (const r of runes) {
        if (!released || r.popped) continue;
        const left = r.pop - t, hot = t - GATHER < 0.08 || left < 0.06, bob = Math.sin(t * 9 + r.ph) * 0.6;
        sigil(p, r.g, r.x, r.y + bob, hot ? WHITE : C[6], 1, hot ? C[4] : C[3]);
        p.glow(r.x, r.y + bob, 10, C[5], hot ? 0.7 : 0.35);
        if (left < 0.06) sparkle(p, r.x, r.y + bob, 3 + 4 * (1 - left / 0.06), C[6], C[5], 0.5);
      }
      // each pop: a small flare and a ring
      for (const q of pops) {
        const k = (t - q.t) / 0.32;
        if (k >= 1) continue;
        if (k < 0.35) flare(p, q.x, q.y, 11 * (1 - k / 0.35) + 2, 1 - k / 0.35, C);
        p.ring(q.x, q.y, 2 + 11 * ease.outCubic(k), Math.max(1, 2 * (1 - k)), k < 0.3 ? WHITE : C[6], 1.15 - k);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/lightning/zap-hit.js"] = function(exports, __req) {
// The arc's halo-body-core inking, its flicker and the light that strobes as it dies follow Sprite Fusion's
// open-source lightning (https://www.spritefusion.com/pixel-art-vfx/lightning), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, fit, clamp, smooth, rng, TAU, WHITE, hex, mix  } = __req("core/index.js");
const {  VOLT, zigzag, stroke, crackle  } = __req("fx/lightning/_lib.js");

const meta = {
  name: "Zap hit",
  desc: "A contact zap: an arc snaps in from the left, the hit point overloads into a knot of tiny crackling zigzags, a fern of burn marks glows outward, sparks jink away, ozone puffs.",
  tags: ["lightning", "electric", "hit", "impact", "combat", "directional", "one-shot"],
  size: [144, 112],
  origin: [76, 56],
  duration: 0.9,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: VOLT, seed: 3 },
};

const SNAP = 0.05, ASH = hex("#6a6680");

// the burn the current leaves on what it hit: a Lichtenberg fern, main fronds radiating, side fronds alternating
function fern(R) {
  const out = [];
  const grow = (x, y, a, len, w, d, depth) => {
    const pts = [[x, y, d]];
    let side = R.sign();
    for (let s = 0; s < len; s += 1.4) {
      a += R.range(-0.3, 0.3);
      x += Math.cos(a) * 1.4;
      y += Math.sin(a) * 1.4;
      d += 1.4;
      pts.push([x, y, d]);
      if (depth < 2 && s > 2 && R.chance(0.24)) {
        side = -side;
        grow(x, y, a + side * R.range(0.55, 1.05), (len - s) * R.range(0.3, 0.55), w * 0.6, d, depth + 1);
      }
    }
    out.push({ pts, w });
  };
  for (let i = 0; i < 6; i++) grow(0, 0, (i / 6) * TAU + R.range(-0.35, 0.35), R.range(18, 32), 1, 0, 0);
  return out;
}

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), ps = new Particles({ rng: R }), lights = new Lights();
  const tree = fern(R), Y0 = R.range(-14, 6);
  // sparks that jink: they fly out and jerk to a new heading every few hundredths of a second
  const kinked = Array.from({ length: 16 }, () => {
    const a = R.range(-1.2, 1.2) + (R.chance(0.7) ? 0 : Math.PI), sp = R.range(130, 250);
    return { x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: R.range(0.2, 0.36), age: -SNAP, next: R.range(0.02, 0.05), trail: [] };
  });
  let t = 0, hit = false;
  return {
    update(dt) {
      t += dt;
      if (!hit && t >= SNAP) {
        hit = true;
        lights.add(0, 0, 60, C[4], 0.7, 0.3);
        lights.add(0, 0, 14, WHITE, 0.5, 0.07);
        for (let i = 0; i < 3; i++) ps.spawn(P.SMOKE, R.range(-3, 5), R.range(-4, 2), R.range(-5, 8), -R.range(8, 16), R.range(0.55, 0.75), mix(ASH, C[4], 0.3), R.range(2.5, 3.8), R.range(0.08, 0.16));
      }
      for (const s of kinked) {
        if ((s.age += dt) < 0 || s.age >= s.life) continue;
        if ((s.next -= dt) <= 0) {
          s.next = R.range(0.025, 0.055);
          const sp = Math.hypot(s.vx, s.vy), a = Math.atan2(s.vy, s.vx) + R.sign() * R.range(0.6, 1.3);
          s.vx = Math.cos(a) * sp;
          s.vy = Math.sin(a) * sp;
          s.trail.push([s.x, s.y]);
          if (s.trail.length > 4) s.trail.shift();
        }
        s.vx -= s.vx * 3 * dt;
        s.vy -= s.vy * 3 * dt - 140 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // the fern burns outward from the hit, glowing white, cooling through the palette, then fading
      if (t < SNAP) return;
      // it cools by stepping down the palette, and only the last embers dither away
      const cool = smooth(0.45, 0.85, t), fade = 1 - smooth(0.78, 0.88, t);
      for (const br of tree)
        for (let i = 1; i < br.pts.length; i++) {
          const [x0, y0] = br.pts[i - 1], [x, y, d] = br.pts[i], age = t - SNAP - d / 260;
          if (age < 0) break;
          const k = Math.exp(-age / 0.22) - cool * 0.3, c = k > 0.75 ? WHITE : k > 0.45 ? C[6] : k > 0.25 ? C[5] : k > 0.1 ? C[4] : k > -0.05 ? C[2] : C[1];
          p.line(x0, y0, x, y, c, fade);
          if (br.w >= 1 && d < 9) p.line(x0 + 1, y0, x + 1, y, k > 0.45 ? C[5] : C[2], fade);
          if ((i & 3) === 0 && k > 0) p.glow(x, y, 5, C[5], 0.35 * k * fade);
        }
      ps.draw(p, "back");
    },
    draw(p) {
      const f = Math.floor(t * 30 + 1e-4);
      // the arc snaps in from the left in two frames, holds and flickers, then lets go
      if (t < 0.32) {
        const r = rng(o.seed, 2, f), b = zigzag(r, -66, Y0, 0, 0, 0.22, 0.35), u = clamp(t / SNAP);
        const k = t < SNAP ? 1 : t < 0.2 ? (f % 2 ? 0.7 : 1) : 0.55 * (1 - (t - 0.2) / 0.12);
        stroke(p, u < 1 ? { paths: [b.paths[0]] } : b, k, C, t < SNAP + 0.034 ? 0.95 : 0.7, { upTo: u, hero: t >= SNAP && t < SNAP + 0.034 });
        if (u < 1) {
          const tp = b.paths[0].pts, [hx, hy] = tp[Math.floor(u * (tp.length - 1))];
          p.circle(hx, hy, 2, WHITE);
          p.glow(hx, hy, 14, C[5], 0.6);
        }
      }
      // the hit point overloads: a tight knot of tiny zigzags re-struck every frame round a white heart
      if (t >= SNAP && t < 0.45) {
        const a = (t - SNAP) / 0.4, r = rng(o.seed, 5, f), R0 = 8 * (1 - a * 0.6), m = Math.round(11 * (1 - a * 0.5));
        for (let i = 0; i < m; i++) {
          const ang = r.range(0, TAU), d0 = r.range(0.5, R0 * 0.5), ang2 = ang + r.range(-1.2, 1.2), d1 = r.range(R0 * 0.55, R0);
          crackle(p, zigzag(r, Math.cos(ang) * d0, Math.sin(ang) * d0, Math.cos(ang2) * d1, Math.sin(ang2) * d1, 0.5, 0), 0.75 * (1 - a) + 0.25, C, 0.25);
        }
        p.circle(0, 0, 3 * (1 - a) + 1, C[5]);
        p.circle(0, 0, 2 * (1 - a) + 0.5, WHITE);
        p.glow(0, 0, 20, C[4], 0.55 * (1 - a));
        if (t < SNAP + 0.07) p.glow(0, 0, 9, WHITE, 0.4);
      }
      // the sparks: a bright head, the zigzag behind it cooling
      for (const s of kinked) {
        if (s.age < 0 || s.age >= s.life) continue;
        const k = 1 - s.age / s.life, path = [...s.trail, [s.x, s.y]];
        for (let i = 0; i < path.length - 1; i++) p.line(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1], i === path.length - 2 ? (k > 0.5 ? WHITE : C[6]) : k > 0.5 ? C[5] : C[4], 0.6 + 0.4 * (i / path.length));
        p.px(s.x, s.y, k > 0.4 ? WHITE : C[5]);
        p.glow(s.x, s.y, 4, C[5], 0.4 * k);
      }
      // the light strobes as it dies
      if (t >= SNAP) p.glow(0, 0, 40 * Math.max(0, 1 - t / 0.85), C[3], 0.45 * Math.exp(-(t - SNAP) * 5) * (f % 2 ? 0.7 : 1));
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/lightning/_lib.js"] = function(exports, __req) {
// The bolt shape and the way a bolt is inked (a deep halo, a pale body, a white core, light along it) are
// adapted from Sprite Fusion's open-source lightning (https://www.spritefusion.com/pixel-art-vfx/lightning),
// MIT License, Copyright (c) 2026 Hugo Duprez.
//
// Shared by the lightning effects: bolts that fork and thin as they split, inked at the 2x character scale,
// thin crackles, bowed arcs, heat scorch, and trajectories for pure loops.

const {  clamp, rand, rng, hash, Rng, GRAVITY, FIRE_RAMP, SMOKE_RAMP, hex, mix  } = __req("core/index.js");

/** Default palette, dark to bright: deep violet shadow, electric blue, icy white. */
const VOLT = ["#120a33", "#2a1b78", "#4630c0", "#5a62f0", "#58a6ff", "#9ed8ff", "#e4f6ff", "#ffffff"];
/** Plasma sparks, head to tail: cyan that reads apart from the violet bolt. */
const PLASMA = ["#ffffff", "#c8f8ff", "#7ff3ff", "#1ab8e6"];
const SOOT = hex("#110c16"), SOOT2 = hex("#1c1522");

/**
 * A bolt from (x0, y0) to (x1, y1): midpoint displacement down to ~3 px segments (jag: how far the first
 * midpoint may swing, as a share of the length), with forks that split off along the way, each thinner (w)
 * and forking again up to two levels. Returns { paths: [{ pts: [[x, y], ...], w }] }, the trunk first.
 */
function zigzag(R, x0, y0, x1, y1, jag = 0.32, forks = 0.35, w = 1, depth = 0) {
  const out = { paths: [] }, L = Math.hypot(x1 - x0, y1 - y0);
  let pts = [[x0, y0], [x1, y1]], off = L * jag;
  while (pts.length < 2 + L / 3) {
    const nxt = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.hypot(bx - ax, by - ay) || 1, o = R.range(-off, off);
      nxt.push([(ax + bx) / 2 + (-(by - ay) / l) * o, (ay + by) / 2 + ((bx - ax) / l) * o], [bx, by]);
    }
    pts = nxt;
    off *= 0.52;
  }
  out.paths.push({ pts, w });
  if (depth < 2)
    for (let i = 2; i < pts.length - 3; i++)
      if (R.chance(forks / (1 + depth) / Math.max(4, pts.length / 6))) {
        const [ax, ay] = pts[i], [bx, by] = pts[Math.min(pts.length - 1, i + 3)];
        const a = Math.atan2(by - ay, bx - ax) + R.sign() * R.range(0.35, 0.9), l = (L - (i / pts.length) * L) * R.range(0.25, 0.55);
        out.paths.push(...zigzag(R, ax, ay, ax + Math.cos(a) * l, ay + Math.sin(a) * l, jag * 1.1, forks, w * 0.55, depth + 1).paths);
      }
  return out;
}

/** A bolt bowed off the straight line by `bow` px at its middle (negative: up for a left-to-right arc). */
function bowed(R, x0, y0, x1, y1, bow, jag = 0.22, forks = 0.4) {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
  const mx = (x0 + x1) / 2 + nx * bow + R.range(-2, 2), my = (y0 + y1) / 2 + ny * bow;
  const a = zigzag(R, x0, y0, mx, my, jag, forks), b = zigzag(R, mx, my, x1, y1, jag, forks);
  return { paths: [{ pts: [...a.paths[0].pts, ...b.paths[0].pts.slice(1)], w: 1 }, ...a.paths.slice(1), ...b.paths.slice(1)] };
}

/** Move every point of a bolt: fn(x, y) => [x, y]. */
function bend(b, fn) {
  return { paths: b.paths.map((q) => ({ w: q.w, pts: q.pts.map(([x, y]) => fn(x, y)) })) };
}

// ---- inking. Pixels are gathered in a grid at a level (higher wins), then drawn once each, so a fork's
// halo never covers the trunk's body and overlapping passes cost nothing extra.
const N = 1024, HALF = 512, GRID = new Uint8Array(N * N), HIT = [];
function mark(x, y, lvl) {
  const X = Math.floor(x) + HALF, Y = Math.floor(y) + HALF;
  if (X < 0 || Y < 0 || X >= N || Y >= N) return;
  const i = Y * N + X, v = GRID[i];
  if (!v) HIT.push(i);
  if (lvl > v) GRID[i] = lvl;
}
function stamp(x, y, r, lvl) {
  if (r <= 0.5) return mark(Math.round(x), Math.round(y), lvl);
  const r2 = r * r;
  for (let py = Math.floor(y - r); py <= Math.ceil(y + r); py++) {
    const dy = py + 0.5 - y;
    for (let px = Math.floor(x - r); px <= Math.ceil(x + r); px++) {
      const dx = px + 0.5 - x;
      if (dx * dx + dy * dy <= r2) mark(px, py, lvl);
    }
  }
}
/** Draw what was gathered: level n in cols[n - 1] at alpha alphas[n - 1] (dithered below 1). */
function flush(p, cols, alphas) {
  for (const i of HIT) {
    const v = GRID[i];
    GRID[i] = 0;
    const x = (i % N) - HALF, y = ((i / N) | 0) - HALF, a = alphas ? alphas[v - 1] : 1;
    if (a >= 1) p.px(x, y, cols[v - 1]);
    else if (a > 0) p.dot(x, y, cols[v - 1], a);
  }
  HIT.length = 0;
}
const walk = (pts, fn) => {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.max(1, Math.hypot(bx - ax, by - ay));
    for (let d = 0; d <= l; d += 0.5) fn(ax + ((bx - ax) * d) / l, ay + ((by - ay) * d) / l, i);
  }
};

/**
 * A bolt at full power: a deep halo, a pale body, a white core on the trunk, light every few points. k is the
 * stroke's brightness (forks drop out below 0.5, the trunk thins below 0.6), s scales the thickness.
 * o: { hero (a white frame: the body goes white), light (glow strength), a (alpha), upTo (draw the trunk only
 * to this share of its length), core (radius of a thicker white core), minY (no glow above this y) }.
 */
function stroke(p, b, k, C, s = 1, o = {}) {
  if (k <= 0.02) return;
  const lk = o.light ?? 0.5;
  for (const q of b.paths) {
    const trunk = q.w >= 1;
    if (!trunk && k < 0.5) continue;
    const rh = (trunk ? (k > 0.6 ? 2.1 : 1.6) : 1.1) * s, rb = (trunk ? (k > 0.6 ? 1.3 : 0.8) : 0.5) * s;
    const pts = o.upTo !== undefined && trunk ? q.pts.slice(0, Math.max(2, Math.ceil(q.pts.length * o.upTo))) : q.pts;
    walk(pts, (x, y) => {
      stamp(x, y, rh, 1);
      stamp(x, y, rb, trunk ? 3 : 2);
      if (trunk && k > 0.3) o.core ? stamp(x, y, o.core, 4) : mark(x, y, 4);
    });
    for (let i = 0; i < pts.length - 1; i += 3) if (o.minY === undefined || pts[i][1] > o.minY) p.glow(pts[i][0], pts[i][1], (trunk ? 14 : 7) * s, C[4], lk * k * q.w);
  }
  const a = o.a ?? 1;
  flush(p, o.hero ? [C[3], C[6], C[7], C[7]] : [C[2], C[4], C[5], C[7]], [a, a, a, a]);
}

/**
 * A thin crackle: a 1 px core (white on the trunk while bright), a 2 px pale body, a dithered halo while k is
 * high, light along it. For short arcs that live a frame or two.
 */
function crackle(p, b, k, C, glowK = 0.5, a = 1) {
  if (k <= 0.02) return;
  for (const q of b.paths) {
    const thick = q.w >= 1;
    walk(q.pts, (x, y) => {
      if (k > 0.45 && thick) for (const [dx, dy] of CROSS) mark(x + dx * 1.5, y + dy * 1.5, 1);
      if (k > 0.25 && (thick || q.w > 0.4)) (mark(x + 1, y, 2), mark(x, y + 1, 2));
      mark(x, y, thick && k > 0.3 ? 4 : 3);
    });
    for (let i = 0; i < q.pts.length - 1; i += 3) p.glow(q.pts[i][0], q.pts[i][1], (thick ? 9 : 5) * (0.5 + k * 0.5), C[4], glowK * k * q.w);
  }
  flush(p, [C[3], C[5], C[5], C[7]], [Math.min(1, (k - 0.45) * 1.6) * a, a, a, a]);
}
const CROSS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** A bolt's trunk as a 1 px line in one color (leaders, afterimages, cooling channels). */
function trace(p, pts, c, a = 1, from = 0, to = pts.length - 1) {
  for (let i = Math.max(0, from); i < Math.min(to, pts.length - 1); i++) p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, a);
}

/**
 * Heat left on the floor: a flat ellipse, white-hot in the middle cooling through the fire ramp to soot.
 * T0 is the heat (1 fresh, 0 cold), fade takes the soot away.
 */
function scorch(p, cx, cy, rx, T0, fade = 1, ry = Math.max(2.5, rx * 0.12)) {
  if (fade <= 0) return;
  for (let y = Math.floor(cy); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      const n = rand(x, y, 41), T = T0 * (1.25 - d) - n * 0.35;
      if (T > 0.06) {
        const c = FIRE_RAMP[Math.min(FIRE_RAMP.length - 1, Math.floor((1 - Math.min(1, T)) * (FIRE_RAMP.length - 1)))];
        p.dot(x, y, c, fade);
        if ((x & 3) === 0) p.glow(x + 0.5, y, 6, c, 0.18 * T * fade);
      } else p.dot(x, y, d < 0.5 ? SOOT : SOOT2, (d < 0.95 - n * 0.3 ? 1 : 1 - d) * fade);
    }
}

/** A heat-ramp color for T (1 white-hot .. 0 cold), or 0 when it's cold. */
const heat = (T) => (T > 0.06 ? FIRE_RAMP[Math.min(FIRE_RAMP.length - 1, Math.floor((1 - Math.min(1, T)) * (FIRE_RAMP.length - 1)))] : 0);

/**
 * Where a spark launched at (x, y, vx, vy) is after `age` seconds, stepped like the simulation's SPARK (gravity,
 * drag, bouncing on a floor at `floor`), so pure loops get the same physics. Returns [x, y, vx, vy].
 */
function flight(x, y, vx, vy, age, { g = 0.45, drag = 2.2, floor = Infinity, bounce = 0.45 } = {}) {
  const dt = 1 / 120;
  for (let s = 0; s < age; s += dt) {
    const h = Math.min(dt, age - s);
    vy += GRAVITY * g * h;
    vx -= vx * drag * h;
    vy -= vy * drag * h;
    const ny = y + vy * h;
    x += vx * h;
    if (vy > 0 && y <= floor && ny >= floor) (vy = -vy * bounce), (vx *= 0.7), (y = floor - 0.25);
    else y = ny;
  }
  return [x, y, vx, vy];
}

/** A spark drawn the way the simulation draws one (a streak stretched by speed, a hot head, light), for pure loops. */
function spark(p, x, y, vx, vy, k, S) {
  const sp = Math.hypot(vx, vy) || 1, ux = vx / sp, uy = vy / sp, head = k > 0.6 ? S[0] : k > 0.3 ? S[1] : S[2], len = Math.min(9, 1 + sp * 0.022);
  p.line(x - ux * len, y - uy * len, x - ux * len * 0.4, y - uy * len * 0.4, k > 0.5 ? head : S[S.length - 1]);
  p.line(x - ux * len * 0.45, y - uy * len * 0.45, x, y, head);
  p.glow(x, y, 3, head, 0.45 * k);
}

/** A soft smoke puff at age u (0..1) of its life, drawn like the simulation's SMOKE, for pure loops. */
function puff(p, x, y, size, u, c) {
  const k = 1 - u, r = size * (0.65 + Math.min(1, u * 2.5) * 0.45 + u * 0.4), a = Math.min(1, u * 12) * Math.min(1, k * 2.4) * 0.58;
  if (a <= 0.01) return;
  const col = mix(c, SMOKE_RAMP[Math.min(SMOKE_RAMP.length - 1, Math.floor(u * SMOKE_RAMP.length))], u);
  p.disc(x, y, r, col, a * 0.45);
  p.disc(x + r * 0.05, y + r * 0.06, r * 0.74, col, a * 0.62);
  if (u < 0.5) p.disc(x - r * 0.22, y - r * 0.3, r * 0.5, mix(col, hex("#ffffff"), 0.12), a * 0.4 * (1 - u * 2));
}

/** A seeded generator for frame f of a loop (new shapes every frame, the same shapes every time). */
const frameRng = (seed, f, salt = 0) => rng(seed, salt, f);
exports.rand = rand; exports.rng = rng; exports.hash = hash; exports.Rng = Rng; exports.clamp = clamp;

exports.zigzag = zigzag;
exports.bowed = bowed;
exports.bend = bend;
exports.stroke = stroke;
exports.crackle = crackle;
exports.trace = trace;
exports.scorch = scorch;
exports.flight = flight;
exports.spark = spark;
exports.puff = puff;
exports.VOLT = VOLT;
exports.PLASMA = PLASMA;
exports.SOOT = SOOT;
exports.SOOT2 = SOOT2;
exports.heat = heat;
exports.frameRng = frameRng;
  };
  __mods["fx/lightning/lightning-strike.js"] = function(exports, __req) {
// The stepped leader, the stroke flicker, the cooling channel and the scorch follow Sprite Fusion's open-source
// lightning (https://www.spritefusion.com/pixel-art-vfx/lightning), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, fit, sparkle, clamp, smooth, ease, rand, rng, TAU, WHITE, hex, mix  } = __req("core/index.js");
const {  VOLT, PLASMA, SOOT, SOOT2, zigzag, bend, stroke, crackle, trace, scorch, heat  } = __req("fx/lightning/_lib.js");

const meta = {
  name: "Lightning strike",
  desc: "A targeted strike: a sigil charges on the floor, the scene darkens, a thick bolt slams into it, arcs race out along the cracks it splits, the channel crumbles to a scorch.",
  tags: ["lightning", "electric", "strike", "spell", "target", "impact", "ground", "one-shot"],
  size: [240, 264],
  origin: [120, 228],
  duration: 3,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: VOLT, sparks: PLASMA, seed: 5 },
};

const W = 120, TOP = -224, RX = 28, SY = 0.22, REACH = 52, LEAD0 = 0.48, STEPS = 9, MEET = -30;
const STROKES = [{ t: 0.76, k: 1 }, { t: 1.04, k: 0.8 }, { t: 1.26, k: 0.55 }];
const FLICK = [1, 0.72, 0.3, 0.95, 0.5, 0.8, 0.22];
const level = (a) => (a < 0 ? 0 : FLICK[Math.floor(a * 30 + 1e-4)] ?? 0);
const NIGHT = hex("#04030a"), DUST = hex("#6e6382"), ASH = hex("#5b5566"), STONE = ["#655b7a", "#4a4263", "#342d45"].map(hex);
const S1 = STROKES[0].t;

// the cracks the strike splits in the floor: Lichtenberg branches lying on the floor's face
function cracks(R) {
  const out = [];
  const grow = (x, y, a, len, w, d, depth) => {
    const pts = [[x, y, d]];
    for (let s = 0; s < len; s += 1.5) {
      a += R.range(-0.32, 0.32);
      x += Math.cos(a) * 1.5;
      y = clamp(y + Math.sin(a) * 0.45, 0, 5);
      d += 1.5;
      pts.push([x, y, d]);
      if (depth < 2 && s > 3 && R.chance(0.09)) grow(x, y, a + R.sign() * R.range(0.5, 1.2), (len - s) * R.range(0.3, 0.6), w * 0.6, d, depth + 1);
    }
    out.push({ pts, w });
  };
  for (let i = 0; i < 6; i++) grow(R.range(-1, 1), R.range(0, 1), i % 2 ? R.range(-0.5, 0.7) : Math.PI + R.range(-0.7, 0.5), REACH * R.range(0.55, 1), 1, 0, 0);
  return out;
}

// the sigil on the floor: a ring of dashes turning slowly, crosshair ticks, an inner ring and a heart; drawn in
// from the front, charging brighter; half picks the far (behind) or near part
function sigil(p, t, C, k, near) {
  const reveal = clamp(t / 0.22), spin = t * 0.8, burnt = t > S1 ? t - S1 : -1;
  if (burnt > 0.45) return;
  const a0 = burnt < 0 ? 1 : burnt < 0.07 ? 1 : 1 - (burnt - 0.07) / 0.38, hot = burnt >= 0 && burnt < 0.07;
  const on = (a) => Math.sin(a) >= 0 === near;
  const from = (a) => Math.abs((((a - Math.PI / 2) % TAU) + TAU + Math.PI) % TAU - Math.PI) / Math.PI;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU + spin;
    if (!on(a) || from(a) > reveal) continue;
    for (const da of [0, 0.06, 0.12]) {
      const x = Math.cos(a + da) * RX, y = Math.sin(a + da) * RX * SY;
      p.dot(x, y, hot ? WHITE : near ? (k > 0.7 ? C[6] : C[5]) : k > 0.7 ? C[4] : C[3], a0);
      if (near) p.dot(x, y + 1, hot ? C[6] : C[2], a0);
    }
    if (i % 3 === 0) p.glow(Math.cos(a) * RX, Math.sin(a) * RX * SY, 5, C[4], 0.3 * k * a0);
  }
  for (let j = 0; j < 4; j++) {
    const a = spin * -0.5 + (j * TAU) / 4 + Math.PI / 4;
    if (!on(a) || reveal < 1) continue;
    p.line(Math.cos(a) * (RX - 5), Math.sin(a) * (RX - 5) * SY, Math.cos(a) * (RX + 5), Math.sin(a) * (RX + 5) * SY, hot ? WHITE : near ? C[6] : C[4], a0);
  }
  if (t > 0.3)
    for (let a = 0; a < TAU; a += 0.09) {
      if (!on(a)) continue;
      p.dot(Math.cos(a) * 14, Math.sin(a) * 14 * SY, hot ? WHITE : near ? C[4] : C[2], a0 * clamp((t - 0.3) / 0.12));
    }
  if (near && burnt < 0) {
    const pulse = 0.6 + 0.4 * Math.sin(t * (10 + 30 * k));
    p.px(0, 0, k > 0.5 ? WHITE : C[6]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) p.px(dx, dy, C[5]);
    p.glow(0, -1, 10 + 10 * k, C[5], 0.3 + 0.4 * k * pulse);
  }
}

// keep forks on the canvas and above the floor
function keep(b) {
  const paths = [];
  for (const q of b.paths) {
    const pts = [];
    for (const pt of q.pts) {
      if (Math.abs(pt[0]) > W - 5 || pt[1] > -3 || pt[1] < TOP + 6) break;
      pts.push(pt);
    }
    if (q.w >= 1 || pts.length > 3) paths.push({ w: q.w, pts: q.w >= 1 ? q.pts : pts });
  }
  return { paths };
}

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: o.sparks }), hot = new Particles({ rng: R, ground: floor }), lights = new Lights();
  const X0 = R.range(8, 18) * (R.chance(0.5) ? 1 : -1);
  const main = keep(zigzag(R, X0, TOP, 0, -1, 0.17, 0.5)), trunk = main.paths[0].pts;
  const drift = (dx) => (x, y) => [x + dx * Math.sin((Math.PI * y) / TOP), y];
  const bolts = [main, bend({ paths: [{ pts: trunk, w: 1 }] }, drift(1.5)), bend({ paths: [{ pts: trunk, w: 1 }] }, drift(3))];
  const chan = (i) => bolts[i].paths[0].pts, last = STROKES[STROKES.length - 1], end = chan(STROKES.length - 1);
  const tree = cracks(R);
  // the spent channel breaks up from the top down, each piece at its own moment
  const gone = end.map(([, y], i) => last.t + 0.25 + 0.75 * (0.55 * rand(o.seed, i, 5) + 0.45 * (1 - y / TOP)));
  let t = 0, struck = -1;
  const now = () => {
    for (let i = STROKES.length - 1; i >= 0; i--) if (t >= STROKES[i].t) return { i, s: STROKES[i], a: t - STROKES[i].t, k: level(t - STROKES[i].t) * STROKES[i].k };
    return null;
  };
  const charge = () => clamp(t / S1) ** 1.5;
  const heatAt = () => (struck < 0 ? 0 : Math.max(...STROKES.slice(0, struck + 1).map((s) => s.k * Math.pow(clamp(1 - (t - s.t) / 1.6), 1.4))));

  return {
    update(dt) {
      t += dt;
      for (const [i, s] of STROKES.entries()) {
        if (struck >= i || t < s.t) continue;
        struck = i;
        const k = s.k;
        lights.add(0, -50, 120, C[4], 0.55 * k, 0.4);
        lights.add(0, -3, 24, WHITE, 0.5 * k, 0.1);
        for (let j = 0; j < Math.round(44 * k); j++) {
          const a = -Math.PI / 2 + R.range(-1.3, 1.3), sp = R.range(110, 320) * (0.65 + 0.35 * k);
          ps.spawn(P.SPARK, R.range(-1.5, 1.5), -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.55));
        }
        for (let j = 0; j < Math.round(12 * k); j++) {
          const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(70, 220);
          hot.spawn(P.SPARK, R.range(-2, 2), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.5, 1));
        }
        for (let j = 0; j < Math.round(5 * k); j++) hot.spawn(P.EMBER, R.range(-4, 4), -2, R.range(-25, 25), -R.range(30, 80), R.range(0.8, 1.5));
        for (let j = 0; j < Math.round(18 * k); j++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(50, 190);
          ps.spawn(P.GRIT, R.range(-3, 3), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1, 1.5), R.pick(STONE), R.chance(0.35) ? 2 : 1);
        }
        for (let j = 0; j < 8; j++) ps.spawn(P.DUST, R.range(-3, 3), -1, R.sign() * R.range(30, 110), -R.range(4, 24), R.range(0.4, 0.8), DUST, R.range(1.5, 3));
        for (let j = 0; j < Math.round(4 * k); j++) ps.spawn(P.SMOKE, R.range(-8, 8), -4, R.range(-10, 10), -R.range(10, 25), R.range(1.1, 1.6), mix(ASH, C[2], 0.3), R.range(3, 6), R.range(0.05, 0.25));
      }
      if (struck >= 0 && t < 1.7 && R.chance(6 * dt)) ps.spawn(P.SMOKE, R.range(-8, 8), -2, R.range(-4, 4), -R.range(9, 17), R.range(1, 1.3), 0, R.range(2, 3.5));
      for (let i = 0; i < gone.length - 1; i++)
        if (gone[i] <= t && gone[i] > t - dt && rand(o.seed, i, 6) < 0.5) {
          const [x, y] = end[i];
          ps.spawn(P.MOTE, x, y, R.range(-8, 8), R.range(6, 22), R.range(0.4, 0.8), R.chance(0.5) ? C[5] : C[4], R.range(0.5, 0.9));
        }
      ps.update(dt);
      hot.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // the scene darkens a beat before the strike: a soft veil, deepest round the bolt's path, gone at the flash
      const dark = 0.5 * smooth(0.46, 0.66, t) * (1 - smooth(S1 - 0.01, S1 + 0.02, t));
      if (dark > 0.01)
        for (let y = -228; y < 36; y++)
          for (let x = -W; x < W; x++) {
            const d = Math.hypot(x / W, (y + 96) / 132), a = dark * (1 - smooth(0.55, 1, d));
            if (a > 0.01) p.blend(x + 0.5, y + 0.5, NIGHT, a);
          }
      sigil(p, t, C, charge(), false);
      // the cracks: arcs race out along them white, they glow with heat, cool to soot and fade
      if (struck >= 0) {
        const s = now(), front = REACH * ease.outCubic(clamp((t - S1) / 0.35)), T0 = heatAt(), fade = 1 - smooth(2.3, 2.95, t);
        const elec = s.a < 0.14 ? s.s.k * (1 - s.a / 0.14) : 0;
        for (const br of tree)
          for (const [x, y, d] of br.pts) {
            if (d > front) break;
            const q = d / REACH, n = rand(Math.round(x * 2), Math.round(y * 2), 9), fresh = d > front - 6 && front < REACH;
            const T = T0 * (1.15 - q) * (br.w < 1 ? 0.8 : 1) - n * 0.25, c = fresh || (elec > 0.3 && n < 0.85) ? (q < 0.5 ? WHITE : C[6]) : heat(T) || SOOT2;
            p.dot(x, y + 1, SOOT, fade);
            p.dot(x, y, c, fade);
            if (br.w >= 1 && d < 9) p.dot(x, y + 2, SOOT, fade);
            if ((fresh || elec > 0.3) && (Math.round(d) & 3) === 0) p.glow(x, y, 7, C[5], 0.4);
            else if (T > 0.2 && (Math.round(d) & 3) === 0) p.glow(x, y, 5, c, 0.2 * T);
          }
        scorch(p, 0, 0, 12, T0, fade);
        if (T0 > 0) p.glow(0, -2, 34, heat(0.55), 0.3 * T0);
      }
      ps.draw(p, "back");
      hot.draw(p, "back");
    },
    draw(p) {
      const s = now(), f = Math.floor(t * 30 + 1e-4), k = charge();
      sigil(p, t, C, k, true);
      // static rising off the charging sigil, more and more of it
      if (t > 0.15 && t < S1) {
        const r = rng(o.seed, 61, f);
        for (let i = 0; i < Math.round(1 + 4 * k); i++) {
          const a = r.range(0, TAU), x = Math.cos(a) * RX, y = Math.sin(a) * RX * SY;
          crackle(p, zigzag(r, x, y, x + r.range(-2.5, 2.5), y - r.range(4, 9) * (0.6 + k), 0.45, 0.3), 0.45 + 0.4 * k, C, 0.3);
        }
        p.glow(0, -2, 36, C[4], 0.12 + 0.3 * k);
      }
      // the stepped leader feels down from above; a streamer climbs out of the sigil to meet it
      if (t >= LEAD0 && t < S1) {
        const u = clamp((t - LEAD0) / (S1 - LEAD0)), st = Math.min(STEPS, Math.floor(u * STEPS) + 1), fresh = 1 - ((u * STEPS) % 1);
        const reach = TOP + (MEET - TOP) * Math.pow(st / STEPS, 1.2), prev = TOP + (MEET - TOP) * Math.pow((st - 1) / STEPS, 1.2);
        for (const q of main.paths) {
          const tk = q.w >= 1;
          for (let i = 0; i < q.pts.length - 1; i++) {
            const [ax, ay] = q.pts[i], [bx, by] = q.pts[i + 1];
            if (by > reach) {
              if (ay <= reach && i > 0) (p.px(ax, ay, WHITE), p.glow(ax, ay, 7, C[5], 0.5 * fresh + 0.15));
              break;
            }
            const young = by > prev;
            p.line(ax, ay, bx, by, young ? (fresh > 0.4 ? (tk ? C[6] : C[5]) : C[4]) : tk ? C[3] : C[2]);
            if (i % 4 === 0 && ay > TOP + 14) p.glow(ax, ay, young ? 8 : 5, C[4], young ? 0.3 * fresh + 0.1 : 0.12);
          }
        }
        if (t > 0.62) {
          const h = -MEET * ease.outQuad((t - 0.62) / (S1 - 0.62)), r = rng(o.seed, 77, f);
          const b = zigzag(r, 0, -1, r.range(-2, 2), -Math.max(3, h), 0.3, 0.3), tip = b.paths[0].pts.at(-1);
          crackle(p, b, 0.85, C, 0.45);
          p.px(tip[0], tip[1], WHITE);
          p.glow(tip[0], tip[1], 9, C[5], 0.5);
        }
      }
      // the strokes, the dart that runs down the channel before each flicker, the channel cooling and crumbling
      const next = STROKES.find((q) => q.t > t);
      if (next && next !== STROKES[0] && t > next.t - 0.06) {
        const tr = chan(STROKES.indexOf(next)), u = (t - (next.t - 0.06)) / 0.06, i1 = Math.floor(u * tr.length);
        trace(p, tr, C[3], 1);
        trace(p, tr, C[6], 1, i1 - 18, i1);
        for (let i = Math.max(0, i1 - 18); i < Math.min(tr.length, i1); i += 4) if (tr[i][1] > TOP + 14) p.glow(tr[i][0], tr[i][1], 9, C[4], 0.35);
      } else if (s && s.k > 0) {
        const hero = s.i === 0 && s.a < 1 / 30;
        stroke(p, bolts[s.i], s.k, C, s.i === 0 ? 1.5 : 1.2, { hero, core: s.k > 0.6 ? (hero ? 1.2 : 0.8) : 0, minY: TOP + 14 });
        const r = 4.5 * s.k;
        p.circle(0, -1, r + 1.5, C[2]);
        p.circle(0, -1, r + 0.5, C[5]);
        p.circle(0, -1, r * 0.65, WHITE);
        if (s.a < 0.07) sparkle(p, 0, -2, Math.round(12 * s.k * (1 - s.a / 0.07)), C[6], C[4], 0.25);
        p.glow(0, -16, 96, C[3], 0.42 * s.k);
        p.glow(0, -3, 22, C[5], 0.3 * s.k);
        if (hero) p.glow(X0 * 0.5, -110, 170, C[3], 0.3);
      } else if (s) {
        const crumble = s.i === STROKES.length - 1, cool = clamp((s.a - 0.23) / 0.45), tr = chan(s.i);
        for (let i = 0; i < tr.length - 1; i++) {
          if (crumble && t >= gone[i]) continue;
          const h = crumble ? 1 - clamp((t - last.t - 0.23) / (gone[i] - last.t - 0.23)) : 1 - cool;
          p.line(tr[i][0], tr[i][1], tr[i + 1][0], tr[i + 1][1], h > 0.7 ? C[5] : h > 0.4 ? C[4] : h > 0.15 ? C[3] : C[2]);
          if (i % 6 === 0 && h > 0.3 && tr[i][1] > TOP + 14) p.glow(tr[i][0], tr[i][1], 6, C[4], 0.15 * h);
        }
      }
      // arcs crawl out along the cracks as they split, and again with every flicker
      if (s && s.a < 0.4) {
        const r = rng(o.seed, 91, f), run = s.i === 0 ? REACH * ease.outCubic(clamp(s.a / 0.35)) : REACH * clamp(s.a / 0.22);
        for (const br of tree) {
          if (br.w < 1 || r.next() < 0.3) continue;
          const i1 = br.pts.findIndex(([, , d]) => d > run), j1 = i1 < 0 ? br.pts.length : i1, j0 = Math.max(0, j1 - r.int(7, 13));
          const pts = br.pts.slice(j0, j1).map(([x, y]) => [x + r.range(-0.6, 0.6), y - 1.5 - r.range(0, 2.5)]);
          if (pts.length > 1) crackle(p, { paths: [{ pts, w: 1 }] }, 0.9 * (1 - s.a / 0.4) + 0.1, C, 0.35);
        }
      }
      ps.draw(p, "front");
      hot.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/spawn/coin-drop.js"] = function(exports, __req) {
// The coin's spin (squashed toward its edge), glints and burst of light, and the soft smoke of the poof, follow
// Sprite Fusion's open-source pickup (https://www.spritefusion.com/pixel-art-vfx/pickup), MIT License,
// Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, fit, flare, sparkle, clamp, smooth, ease, TAU, WHITE, hex  } = __req("core/index.js");

const meta = {
  name: "Coin drop",
  desc: "An enemy goes up in a soft poof and gold coins spin out of it, bounce with a glint on each hit, settle on the floor, twinkle, and wink out one by one.",
  tags: ["spawn", "death", "loot", "coins", "gold", "drop", "pickup", "ground", "one-shot"],
  size: [160, 88],
  origin: [80, 78],
  duration: 3,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#2a1606", "#5c3208", "#9a5a0c", "#d48c14", "#f5b82a", "#ffe066", "#fff6c4", "#ffffff"],
    smoke: ["#3a3450", "#6c6688", "#a8a2c0", "#dcd8ea"],
    coins: 7,
    seed: 23,
  },
};

const CY = -16;
// an original coin: a rim, a lit face, a raised mark in the middle
const COIN = ["..oooo..", ".ohhlmo.", "ohlmmmdo", "ohmdhmdo", "olmdhmdo", "olmmmmdo", ".oddddo.", "..oooo.."];
// lying flat on the floor, seen from the side
const FLAT = [".lhhhl.", "olmmmdo", ".odddo."];

function create(o) {
  const C = fit(o.palette, 8), SM = fit(o.smoke, 4), R = new Rng(o.seed), floor = () => 0;
  const PAL = { o: C[1], h: C[6], l: C[5], m: C[4], d: C[3] };
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[6], C[5], C[3]] }), lights = new Lights();
  const coins = [], balls = [];
  // the poof the enemy goes up in
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + R.range(-0.25, 0.25), sp = R.range(60, 100);
    const life = R.range(0.55, 0.85);
    balls.push({ x: Math.cos(a) * 2, y: CY + Math.sin(a) * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 10, r: R.range(4, 6), life, max: life });
  }
  // the coins: thrown up and out, each spinning at its own rate
  const n = o.coins;
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) - 0.5 : 0, a = -Math.PI / 2 + u * 1.6 + R.range(-0.1, 0.1), sp = R.range(230, 300);
    coins.push({ x: R.range(-3, 3), y: CY, vx: Math.cos(a) * sp * 0.4, vy: Math.sin(a) * sp, ph: R.range(0, TAU), w: R.range(9, 15) * R.sign(), rest: false, hits: 0, out: 2.15 + i * 0.07 + R.range(0, 0.1), glint: R.range(1.2, 1.9), born: R.range(0.04, 0.12) });
  }
  for (let i = 0; i < 8; i++) {
    const a = R.range(0, TAU), sp = R.range(50, 120);
    ps.spawn(P.STAR, 0, CY, Math.cos(a) * sp, Math.sin(a) * sp - 20, R.range(0.3, 0.6), R.pick([WHITE, C[6], C[5]]), R.range(0.8, 1.8));
  }
  lights.add(0, CY, 44, C[4], 0.7, 0.4);
  lights.add(0, CY, 20, WHITE, 0.7, 0.1);
  let t = 0;

  // a coin turning in the air: its face squashed toward the edge, the rim showing when it's side-on
  function drawCoin(p, x, y, ph) {
    const c = Math.cos(ph), sx = Math.abs(c);
    if (sx < 0.28) {
      for (let dy = -3; dy <= 3; dy++) p.px(x, y + dy, Math.abs(dy) === 3 ? C[1] : dy < 0 ? C[6] : C[5]);
      if (sx > 0.12) for (let dy = -2; dy <= 2; dy++) p.px(x + (c > 0 ? 1 : -1), y + dy, C[3]);
      return;
    }
    const half = 4 * sx;
    for (let px = Math.floor(x - half); px < Math.ceil(x + half); px++) {
      let col = Math.floor((px + 0.5 - x) / sx + 4);
      if (col < 0 || col > 7) continue;
      if (c < 0) col = 7 - col;
      for (let row = 0; row < 8; row++) {
        const ch = COIN[row][col];
        if (ch !== ".") p.px(px, Math.round(y - 4 + row), PAL[ch]);
      }
    }
  }

  return {
    update(dt) {
      t += dt;
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        if ((b.life -= dt) <= 0) {
          balls.splice(i, 1);
          continue;
        }
        b.vx -= b.vx * 7 * dt;
        b.vy -= b.vy * 7 * dt + 26 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      for (const c of coins) {
        // a coin winks out with a little burst of gold
        if (!c.gone && t >= c.out) {
          c.gone = true;
          for (let j = 0; j < 5; j++) {
            const a = R.range(-Math.PI, 0), sp = R.range(25, 60);
            ps.spawn(P.STAR, c.x, -3, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.3, 0.55), R.pick([WHITE, C[6], C[5]]), R.range(0.7, 1.4));
          }
          lights.add(c.x, -3, 14, C[5], 0.6, 0.2);
        }
        if (t < c.born || t > c.out || c.rest) continue;
        c.vy += 820 * dt;
        c.vx -= c.vx * 0.4 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.ph += c.w * dt;
        if (c.y >= -1.5 && c.vy > 0) {
          c.y = -1.5;
          c.hits++;
          // a tink of light and a puff of dust at each hit
          ps.spawn(P.STAR, c.x, -3, 0, -8, 0.25, WHITE, c.hits === 1 ? 2.2 : 1.4);
          for (let j = 0; j < 2; j++) ps.spawn(P.DUST, c.x + R.range(-1, 1), -0.5, R.sign() * R.range(8, 24), -R.range(2, 8), R.range(0.25, 0.45), SM[1], R.range(1, 1.8));
          lights.add(c.x, -3, 12, C[5], 0.5, 0.15);
          if (c.vy > 110) (c.vy *= -0.45), (c.vx *= 0.7), (c.w = c.w * 0.8 + R.range(-2, 2));
          else (c.rest = true), (c.vx = c.vy = 0), (c.restAt = t);
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // a warm gleam on the floor where the coins lie
      for (const c of coins)
        if (c.rest && t < c.out) p.glow(c.x, -1, 7, C[4], 0.18);
      ps.draw(p, "back");
    },
    draw(p) {
      // the poof: soft, top-lit balls, a pop of light in the middle
      for (const layer of [0, 1, 2])
        for (const b of balls) {
          const age = b.max - b.life, k = b.life / b.max, r = b.r * (0.6 + 0.6 * ease.outCubic(clamp(age / 0.2))) * (k < 0.35 ? k / 0.35 : 1);
          if (r < 0.6) continue;
          if (layer === 0) p.disc(b.x + r * 0.15, b.y + r * 0.2, r, SM[1], 0.8);
          else if (layer === 1) p.disc(b.x - r * 0.06, b.y - r * 0.08, r * 0.86, b.y > CY + 2 ? SM[1] : SM[2], 0.85);
          else if (b.y < CY + 2) p.disc(b.x - r * 0.28, b.y - r * 0.34, r * 0.4, SM[3], 0.85);
        }
      if (t < 0.07) {
        const k = t / 0.07;
        p.circle(0, CY, 8 + 2 * k, C[6]);
        p.circle(0, CY, 6 + 2 * k, WHITE);
        flare(p, 0, CY, 16 * (1 - k * 0.5), 1 - k, C);
      }
      for (const c of coins) {
        if (t < c.born || t > c.out + 0.12) continue;
        if (t > c.out) {
          // a coin winks out with a last flash and a ring
          const k = (t - c.out) / 0.12;
          sparkle(p, c.x, -2, Math.round(5 * (1 - k)), WHITE, C[5], 0.5);
          p.ring(c.x, -3, 2 + 5 * ease.outCubic(k), 1, C[6], 1.1 - k);
          continue;
        }
        if (c.rest) {
          // flat on the floor; now and then a glint runs over it
          p.sprite(FLAT, PAL, Math.round(c.x) - 3, -3);
          p.glow(c.x, -2, 6, C[5], 0.25);
          const g = ((t - c.restAt + c.glint) % 0.95) / 0.95;
          if (g < 0.2) sparkle(p, c.x - 1, -3, Math.round(3 * Math.sin((g / 0.2) * Math.PI)), WHITE, C[5], 0.4);
        } else {
          drawCoin(p, c.x, c.y, c.ph);
          p.glow(c.x, c.y, 8, C[4], 0.3);
          // a glint catches the face as it turns toward us
          if (Math.abs(Math.cos(c.ph)) > 0.96) p.px(c.x - 1, c.y - 2, WHITE);
        }
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/spawn/spawn-portal.js"] = function(exports, __req) {
// The streaks pulled in, the rings and lights at the burst and the collapse pop are adapted from Sprite
// Fusion's open-source black-hole (https://www.spritefusion.com/pixel-art-vfx/black-hole),
// MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Bits, Lights, P, PF, B, Rng, fit, band, sparkle, flare, clamp, smooth, ease, noise, TAU, WHITE, hex, mix  } = __req("core/index.js");

const meta = {
  name: "Spawn portal",
  desc: "A rift tears open on the floor and swirls, belches violet smoke and sparks, spits a fountain of wisps up out of itself, then twists shut with a pop.",
  tags: ["spawn", "portal", "summon", "rift", "arcane", "smoke", "ground", "one-shot"],
  size: [208, 150],
  origin: [104, 122],
  duration: 3.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#12081f", "#2a0f4d", "#481b8c", "#7330d0", "#a35cff", "#cf9bff", "#f1dcff", "#ffffff"],
    width: 28,
    seed: 6,
  },
};

const OPEN = 0.3, BELCH = [0.52, 0.76], BURST = 1.0, SHUT = 1.9, POP = 2.22, SY = 0.34;
const VOID = hex("#06030b"), FUME = hex("#3a3046"), STONE = ["#1a1424", "#2b2639", "#4a4263", "#6c6488", "#9a91b4"].map(hex), DUST = hex("#5a5070");

// the rift's size over its life: a tear that snaps open past round, breathes, swells as it shuts, then collapses
function radius(t, RX) {
  if (t < OPEN) return RX * ease.outBack(clamp(t / OPEN), 2.2);
  if (t < SHUT) return RX * (1 + 0.035 * Math.sin(t * 9) + 0.1 * Math.exp(-((t - BURST - 0.05) ** 2) / 0.006));
  const k = clamp((t - SHUT) / (POP - SHUT));
  return RX * (k < 0.35 ? 1 + 0.1 * Math.sin((k / 0.35) * Math.PI * 0.5) : 1.1 * (1 - Math.pow((k - 0.35) / 0.65, 1.6)));
}
// how far the swirl has turned: lazy, then whipping round as it shuts
const spinAt = (t) => t * 2.4 + 1.5 * smooth(BURST - 0.1, BURST + 0.3, t) + 10 * Math.pow(clamp((t - SHUT) / (POP - SHUT)), 2.2);
const lipAt = (th, spin) => 1 + 0.05 * noise(th * 3 + spin * 0.6, 5) + 0.035 * noise(th * 8 - spin * 1.3, 9);

// the hole: a void, a lit far wall, three arms of light spiralling down into it
function hole(p, C, rx, spin, heat, wind = 2.3) {
  if (rx < 1) return;
  const ry = rx * SY;
  p.shade(-rx - 2, -ry - 2, rx + 2, ry + 2, (x, y, out) => {
    const u = x / rx, v = y / ry, q = Math.hypot(u, v), th = Math.atan2(v, u), lip = lipAt(th, spin);
    if (q > lip) return;
    const w = q / lip;
    // the far inner wall catches the glow from below; the near one is hidden
    out.c = v < 0 && w > 0.72 ? (w > 0.86 ? C[2] : C[1]) : w > 0.55 ? C[0] : VOID;
  });
  const n = Math.max(40, Math.round(rx * 5));
  for (let i = 0; i < 3; i++)
    for (let j = 0; j <= n; j++) {
      const q = 0.14 + 0.82 * (j / n), th = spin + (i * TAU) / 3 - wind * Math.log(q), lip = lipAt(th, spin);
      const x = Math.cos(th) * q * lip * rx, y = Math.sin(th) * q * lip * ry;
      const c = q > 0.8 ? (heat > 1.1 ? WHITE : C[6]) : q > 0.55 ? C[5] : q > 0.32 ? C[4] : C[3];
      p.dot(x, y, c, q > 0.3 ? 1 : q / 0.3);
      // a fainter strand riding just inside each arm
      if (q > 0.4 && j % 2 === 0) {
        const t2 = th - 0.32, x2 = Math.cos(t2) * q * 0.94 * lip * rx, y2 = Math.sin(t2) * q * 0.94 * lip * ry;
        p.dot(x2, y2, q > 0.7 ? C[4] : C[3], 0.85);
      }
    }
  p.glow(0, 0, rx * 0.45, C[3], 0.35 * heat);
}

// the lip: a ragged ring of white-hot light, a dark cut outside it; far half behind, near half in front
function lip(p, C, rx, spin, heat, near) {
  if (rx < 1) return;
  const ry = rx * SY, n = Math.ceil(rx * 7);
  for (let j = 0; j < n; j++) {
    const th = (j / n) * TAU, s = Math.sin(th);
    if ((s >= 0) !== near) continue;
    const l = lipAt(th, spin), x = Math.cos(th) * rx * l, y = s * ry * l, f = noise(th * 9 + spin * 3, 13);
    p.dot(Math.cos(th) * (rx * l + 1.2), s * (ry * l + 1), C[1]);
    p.dot(x, y, near ? (f > -0.3 || heat > 1.1 ? WHITE : C[6]) : f > 0.2 ? C[6] : C[5]);
    if (j % 6 === 0) p.glow(x, y, 7, C[5], (near ? 0.3 : 0.2) * Math.min(1.4, heat));
  }
}

function create(o) {
  const C = fit(o.palette, 8), RX = o.width, R = new Rng(o.seed), floor = () => 0;
  // violet smoke, dulled toward a smoky grey so it reads as smoke and not as glass
  const SM = [mix(C[4], FUME, 0.4), mix(C[3], FUME, 0.3), mix(C[5], FUME, 0.55)];
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[3]] });
  const rocks = new Bits({ ground: floor }), lights = new Lights();
  const swirl = [], wisps = [], rings = [];
  const done = {};
  let t = 0;

  // a mote riding the swirl on the floor plane, spiralling in
  const addSwirl = (r0) => swirl.push({ a: R.range(0, TAU), r: r0, w: R.range(2.2, 4), in: R.range(0.3, 0.7), c: R.pick([WHITE, C[6], C[6], C[5]]) });
  // a streak of light sucked in from the air round the rift
  const pull = () => {
    const a = R.range(Math.PI * 1.03, Math.PI * 1.97), D = R.range(40, 86), T = R.range(0.24, 0.42);
    const x = Math.cos(a) * D * 1.08, y = Math.sin(a) * D * 0.85, l = Math.hypot(x, y), v = (0.6 * l) / (1 - Math.exp(-0.6 * T));
    ps.spawn(P.MOTE, x, y, (-x / l) * v, (-y / l) * v, T, R.pick([WHITE, C[6], C[5], C[5], C[4]]), R.range(1, 1.7));
  };
  const puff = (n, big, sp) => {
    for (let i = 0; i < n; i++) {
      const a = R.range(0, TAU), d = R.range(0, 0.55) * RX;
      ps.spawn(P.SMOKE, Math.cos(a) * d, Math.sin(a) * d * SY - 2, R.range(-1, 1) * sp * 0.6, -R.range(0.4, 1) * sp, R.range(1.2, 2.2) * (big ? 1.15 : 0.8), R.pick(SM), R.range(2.8, 4.6) * (big ? 1.15 : 0.9), big ? R.range(0, 0.3) : R.range(0, 0.1), big ? PF.BIG : 0);
    }
  };
  const sparks = (n, up, spread) => {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + R.range(-spread, spread), sp = R.range(0.5, 1) * up;
      ps.spawn(P.SPARK, R.range(-0.5, 0.5) * RX, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.35, 0.8));
    }
  };
  const once = (k, at) => !done[k] && t >= at && (done[k] = true);

  return {
    update(dt) {
      t += dt;
      // the tear pulls dust and light in while it opens, while it's open, and hard while it shuts
      const shutting = t > SHUT && t < POP;
      if ((t < OPEN + 0.15 || shutting) && R.chance(0.55)) {
        const s = R.sign(), D = R.range(RX * 1.3, RX * 2.4), T = R.range(0.18, 0.3), v = (D * 3) / (Math.exp(3 * T) - 1);
        ps.spawn(P.STREAK, s * D, -R.range(0, 3), -s * v, R.range(-2, 2), T, R.chance(0.5) ? C[6] : C[5]);
      }
      if (t > 0.1 && t < POP - 0.1 && R.chance(shutting ? 0.85 : t < BURST ? 0.55 : 0.1)) pull();
      if (t < POP && t > 0.12 && R.chance(shutting ? 0.5 : 0.25)) addSwirl(R.range(1.1, 1.5));
      if (once("open", OPEN * 0.7)) {
        lights.add(0, -8, 50, C[4], 0.75, 0.45);
        rings.push({ t0: t, life: 0.42, r0: RX * 0.8, r1: RX * 1.9, th: 2.5, hot: true });
        for (let i = 0; i < 8; i++) ps.spawn(P.DUST, R.sign() * R.range(0.7, 1.1) * RX, -1, R.sign() * R.range(10, 45), -R.range(4, 14), R.range(0.4, 0.7), DUST, R.range(1.5, 3));
      }
      // two small belches before the big one: a burp of smoke and a few sparks
      if (once("b0", BELCH[0])) puff(6, false, 34), sparks(8, 210, 0.55), lights.add(0, -6, 44, C[4], 0.6, 0.3);
      if (once("b1", BELCH[1])) puff(8, false, 40), sparks(12, 240, 0.6), lights.add(0, -6, 48, C[4], 0.65, 0.3);
      // the burst: something comes up through it
      if (once("burst", BURST)) {
        lights.add(0, -26, 74, C[4], 1, 0.75);
        lights.add(0, -10, 40, WHITE, 0.85, 0.14);
        rings.push({ t0: t, life: 0.55, r0: RX * 1.0, r1: RX * 2.5, th: 3.5, hot: true }, { t0: t + 0.06, life: 0.45, r0: RX * 0.8, r1: RX * 1.8, th: 2, hot: false });
        puff(18, true, 70);
        sparks(34, 400, 0.8);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.27 + R.range(-0.08, 0.08), sp = R.range(185, 235);
          wisps.push({ x: R.range(-4, 4), y: -2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: R.range(0.75, 1.0), max: 1, tr: [], acc: 0, ph: R.range(0, TAU) });
        }
        for (let i = 0; i < 12; i++)
          rocks.add({ kind: B.CHUNK, x: R.sign() * R.range(0.75, 1.05) * RX, y: -1, vx: R.range(-100, 100), vy: -R.range(150, 280), g: 1, drag: 0.4, bounce: 0.3, life: R.range(1.3, 1.9), a: R.range(0, TAU), va: R.range(-14, 14), s: R.range(1, 2.4), ramp: STONE });
        for (let i = 0; i < 14; i++) ps.spawn(P.STAR, R.range(-0.8, 0.8) * RX, -R.range(4, 34), R.range(-30, 30), -R.range(10, 60), R.range(0.5, 1.1), R.pick([WHITE, C[6], C[5]]), R.range(0.8, 2));
      }
      // while it's open it keeps venting thin smoke and the odd spark
      if (t > OPEN && t < SHUT && R.chance(0.16)) puff(1, false, 22);
      if (t > OPEN && t < SHUT + 0.1 && R.chance(0.06)) sparks(1, 160, 0.4);
      // the pop when it closes
      if (once("pop", POP)) {
        lights.add(0, -4, 50, C[4], 0.95, 0.5);
        lights.add(0, -2, 28, WHITE, 0.9, 0.12);
        rings.push({ t0: t, life: 0.35, r0: 2, r1: RX * 1.9, th: 2.5, hot: true });
        for (let i = 0; i < 18; i++) {
          const a = R.range(-Math.PI, 0), sp = R.range(90, 270);
          ps.spawn(P.SPARK, 0, -1, Math.cos(a) * sp, Math.sin(a) * sp * 0.8, R.range(0.25, 0.6));
        }
        for (let i = 0; i < 9; i++) {
          const a = R.range(0, TAU), sp = R.range(30, 95);
          ps.spawn(P.STAR, 0, -2, Math.cos(a) * sp, Math.sin(a) * sp * 0.5 - 20, R.range(0.4, 0.9), R.pick([WHITE, C[6]]), R.range(0.8, 1.8));
        }
        for (let i = 0; i < 6; i++) ps.spawn(P.SMOKE, R.range(-6, 6), -R.range(1, 4), R.range(-34, 34), -R.range(10, 30), R.range(0.8, 1.3), SM[2], R.range(2.5, 4.5));
        // what's left on the floor: specks of light that twinkle out where the rift was
        for (let i = 0; i < 14; i++) ps.spawn(P.STAR, R.range(-1, 1) * RX * 0.9, -R.range(0.5, 2), R.range(-4, 4), -R.range(0, 4), R.range(0.6, 1.4), R.pick([C[6], C[5], C[5]]), R.range(0.4, 0.9), R.range(0, 0.25));
      }
      for (let i = swirl.length - 1; i >= 0; i--) {
        const s = swirl[i], k = shutting ? 2.4 : 1;
        s.a += s.w * k * dt * (1.4 / Math.max(0.3, s.r));
        s.r -= s.in * k * dt;
        if (s.r < 0.25 || t > POP) swirl.splice(i, 1);
      }
      // the wisps: comets with smoky tails that arc up and out, then burst
      for (let i = wisps.length - 1; i >= 0; i--) {
        const w = wisps[i];
        w.tr.unshift([w.x, w.y]);
        if (w.tr.length > 12) w.tr.pop();
        // a wisp bursts when it runs out or comes down on the floor
        if ((w.life -= dt) <= 0 || (w.vy > 0 && w.y > -2)) {
          for (let j = 0; j < 8; j++) {
            const a = R.range(0, TAU), sp = R.range(30, 120);
            ps.spawn(P.SPARK, w.x, w.y, Math.cos(a) * sp + w.vx * 0.2, Math.sin(a) * sp + w.vy * 0.2, R.range(0.2, 0.5));
          }
          ps.spawn(P.STAR, w.x, w.y, 0, -6, 0.45, WHITE, 2.4);
          lights.add(w.x, w.y, 24, C[5], 0.65, 0.25);
          wisps.splice(i, 1);
          continue;
        }
        w.vy += 360 * dt;
        w.vx += Math.sin((w.max - w.life) * 16 + w.ph) * 160 * dt;
        w.vx -= w.vx * 1.1 * dt;
        w.vy -= w.vy * 1.1 * dt;
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        for (w.acc += dt; w.acc > 0.03; w.acc -= 0.03) ps.spawn(P.SMOKE, w.x, w.y, w.vx * 0.05, w.vy * 0.05 - 4, R.range(0.6, 1), SM[0], R.range(1.5, 2.4));
        if (R.chance(0.3)) ps.spawn(P.MOTE, w.x, w.y, -w.vx * 0.2 + R.range(-15, 15), -w.vy * 0.2 + R.range(-15, 15), R.range(0.2, 0.4), C[6], 0.6);
      }
      for (let i = rings.length - 1; i >= 0; i--) if (t - rings[i].t0 > rings[i].life) rings.splice(i, 1);
      rocks.update(dt);
      for (const b of rocks.list)
        if (b.rest && !b.dusted) {
          b.dusted = true;
          for (let i = 0; i < 2; i++) ps.spawn(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, R.sign() * R.range(6, 30), -R.range(2, 12), R.range(0.3, 0.6), DUST, R.range(1.2, 2.4));
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const rx = radius(t, RX), spin = spinAt(t), heat = 0.85 + 0.15 * Math.sin(t * 7) + 0.6 * Math.exp(-((t - BURST) ** 2) / 0.01);
      // the floor glows violet round the hole
      if (t < POP) {
        p.glow(0, -4, rx * 1.8 + 10, C[4], 0.32 * clamp(rx / RX));
        // and light wells up out of it into the air
        p.glowLine(0, -2, 0, -44, rx * 0.7 + 6, C[4], 0.16 * clamp(rx / RX));
      }
      // the slit it tears open from
      if (t < OPEN * 0.6) {
        const k = t / (OPEN * 0.6), L = RX * 1.1 * ease.outCubic(k);
        p.line(-L, 0, L, 0, (u) => (Math.abs(u - 0.5) < 0.3 ? WHITE : C[6]));
        p.glowLine(-L, 0, L, 0, 7, C[5], 0.6);
      }
      if (t > OPEN * 0.35 && t < POP) {
        // the arms wind tighter as it twists shut
        hole(p, C, rx, spin, heat + 0.4 * smooth(SHUT, POP, t), 2.3 + 2.6 * smooth(SHUT, POP - 0.05, t));
        lip(p, C, rx, spin, heat, false);
      }
      for (const r of rings) ring(p, C, r, t, false);
      drawSwirl(p, false);
      ps.draw(p, "back");
    },
    draw(p) {
      const rx = radius(t, RX), spin = spinAt(t), heat = 0.85 + 0.15 * Math.sin(t * 7) + 0.6 * Math.exp(-((t - BURST) ** 2) / 0.01);
      if (t > OPEN * 0.35 && t < POP) lip(p, C, rx, spin, heat, true);
      for (const r of rings) ring(p, C, r, t, true);
      drawSwirl(p, true);
      // the burst: a column of light shoots up out of the hole, thins and lifts away
      const b = t - BURST;
      if (b > 0 && b < 0.45) {
        const k = b / 0.45, top = -84 * ease.outExpo(clamp(b / 0.14)), bot = -1 - 60 * ease.inQuad(k), w0 = RX * 0.55 * (1 - k * 0.8);
        p.shade(-w0 - 1, top, w0 + 1, bot, (x, y, out) => {
          const u = (y - bot) / (top - bot), half = w0 * Math.pow(1 - u, 0.8) * (0.85 + 0.15 * Math.sin(y * 0.7 + t * 40));
          const d = Math.abs(x) / Math.max(0.5, half);
          if (d > 1) return;
          out.c = d < 0.35 ? WHITE : d < 0.7 ? C[6] : C[5];
        });
        p.glowLine(0, bot, 0, top, w0 + 12, C[5], 0.55 * (1 - k));
        if (b < 0.14) flare(p, 0, -4, 36 * (1 - b / 0.14), 1 - b / 0.14, C);
      }
      // the collapse: a white point that pops
      const q = t - POP;
      if (q > -0.08 && q < 0.25) sparkle(p, 0, -1, Math.round((q < 0 ? 4 : 12) * (1 - clamp(q / 0.25))), WHITE, C[5], 0.7 * (1 - clamp(q / 0.25)));
      rocks.draw(p);
      for (const w of wisps) {
        const k = w.life / w.max;
        for (let i = 1; i < w.tr.length; i++) {
          const [x0, y0] = w.tr[i - 1], [x1, y1] = w.tr[i], u = i / w.tr.length;
          p.line(x0, y0, x1, y1, u < 0.25 ? WHITE : u < 0.55 ? C[6] : C[4], 1.15 - u);
          if (u < 0.35) p.line(x0 + 1, y0, x1 + 1, y1, C[5], 1);
        }
        p.circle(w.x, w.y, 2, C[5]);
        p.circle(w.x, w.y, 1.2, C[6]);
        p.px(w.x, w.y, WHITE);
        p.glow(w.x, w.y, 12, C[5], 0.5 * k + 0.2);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };

  function drawSwirl(p, near) {
    const rx = radius(t, RX);
    for (const s of swirl) {
      for (let j = 0; j < 3; j++) {
        const a = s.a - j * 0.08 * (1.4 / Math.max(0.3, s.r)), x = Math.cos(a) * s.r * rx, y = Math.sin(a) * s.r * rx * SY;
        if ((Math.sin(a) >= 0) !== near) continue;
        p.dot(x, y - 0.5, j ? C[5] : s.c, j ? 0.9 - j * 0.3 : 1);
        if (!j) p.glow(x, y, 3, C[5], 0.35);
      }
    }
  }
}

// a shock ring on the floor plane: far half behind, near half in front
function ring(p, C, r, t, near) {
  const k = (t - r.t0) / r.life;
  if (k < 0 || k >= 1) return;
  band(p, 0, 0, r.r0 + (r.r1 - r.r0) * ease.outCubic(k), SY * 0.62, Math.max(1, r.th * (1 - k)), 1.15 - k, C, (g) => (Math.sin(g) >= 0) === near, r.hot && k < 0.15);
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/pickups/collect-burst.js"] = function(exports, __req) {
// The pop (a white flash, a ring snapping out, star sparks with short trails) follows Sprite Fusion's
// open-source pickup (https://www.spritefusion.com/pixel-art-vfx/pickup), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Lights, Rng, fit, clamp, ease, TAU, WHITE  } = __req("core/index.js");
const {  glint  } = __req("fx/pickups/_lib.js");

const meta = {
  name: "Collect burst",
  desc: "The moment of pickup: a white flash and a cross of light, a thin ring snapping out ahead of a softer one, twinkles thrown wide on curving paths that brake, hang and wink out.",
  tags: ["pickup", "collect", "burst", "sparkle", "reward", "one-shot"],
  size: [112, 108],
  origin: [56, 94],
  duration: 1.35,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1a0516", "#3d0a33", "#701560", "#b0228f", "#f53cd1", "#ff86e6", "#ffd2f6", "#ffffff"], seed: 3 },
};

const CY = -30;

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), lights = new Lights();
  lights.add(0, CY, 36, C[5], 0.85, 0.32);
  lights.add(0, CY, 14, WHITE, 0.75, 0.08);
  // twinkles thrown out on curving paths: each one's heading turns as it flies, and drag brakes it
  const stars = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * TAU + R.range(-0.2, 0.2), sp = R.range(145, 225) * (i % 3 === 0 ? 1.12 : 0.85);
    return { x: 0, y: CY, a, sp, turn: (i % 2 ? 1 : -1) * R.range(2.5, 5), life: R.range(0.75, 1.15), age: 0, size: i % 3 === 0 ? 2.6 : R.range(1.2, 2), tr: [], c: i % 4 === 0 ? WHITE : i % 2 ? C[6] : C[5], ph: R.range(0, TAU) };
  });
  const motes = Array.from({ length: 7 }, () => ({ x: R.range(-8, 8), y: CY + R.range(-4, 6), vy: -R.range(12, 30), life: R.range(0.5, 0.9), d: R.range(0.05, 0.25), w: R.range(0, TAU) }));
  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const s of stars) {
        if (s.age > s.life) continue;
        s.age += dt;
        s.tr.unshift([s.x, s.y]);
        if (s.tr.length > 4) s.tr.pop();
        s.a += s.turn * dt * Math.max(0, 1 - s.age * 1.5);
        s.sp -= s.sp * 4.3 * dt;
        s.x += Math.cos(s.a) * s.sp * dt;
        s.y += Math.sin(s.a) * s.sp * dt + 6 * s.age * dt;
        // the floor turns them back up
        if (s.y > -2) (s.y = -2), (s.a = -Math.abs(s.a)), (s.sp *= 0.5);
      }
      lights.update(dt);
    },
    draw(p) {
      // the flash: a white disc and a cross of light, gone in a few frames
      if (t < 0.07) p.circle(0, CY, 5.5 * (1 - t / 0.07) + 1, WHITE);
      if (t < 0.16) {
        const k = 1 - t / 0.16, L = 26 * ease.outCubic(Math.min(1, t / 0.03 + 0.4)) * k;
        for (const [dx, dy, l] of [[1, 0, 1], [-1, 0, 1], [0, 1, 0.6], [0, -1, 0.6]])
          p.line(0, CY, dx * L * l, CY + dy * L * l, (u) => (u < 0.3 ? WHITE : u < 0.65 ? C[6] : C[5]), (u) => (u < 0.5 ? 1 : (1 - u) * 2) * (0.5 + k));
        p.glow(0, CY, 20 * k + 4, C[5], 0.6 * k);
      }
      // a thin ring snapping out fast, a softer ring following
      const u1 = t / 0.32;
      if (u1 < 1) {
        const r = 3 + 23 * ease.outExpo(u1);
        p.ring(0, CY, r, 1, u1 < 0.3 ? WHITE : C[6], 1.3 - u1 * 1.2);
        p.glowRing(0, CY, r, 4, C[5], 0.4 * (1 - u1));
      }
      const u2 = (t - 0.04) / 0.5;
      if (u2 > 0 && u2 < 1) {
        const r = 2 + 16 * ease.outCubic(u2);
        p.ring(0, CY, r, Math.max(1, 2.6 * (1 - u2)), C[5], 1 - u2);
      }
      // the twinkles, with short trails, flickering as they hang and wink out
      for (const s of stars) {
        if (s.age > s.life) continue;
        const k = 1 - s.age / s.life, tw = 0.65 + 0.35 * Math.sin(s.age * 26 + s.ph);
        s.tr.forEach(([x, y], i) => i > 0 && p.dot(x, y, i < 2 ? C[5] : C[4], (1 - i / 4) * k * 1.4));
        if (k < 0.3 && Math.sin(s.age * 40 + s.ph) < 0) continue;
        glint(p, s.x, s.y, Math.round(s.size * tw * Math.min(1, k * 2.5)), s.c, 0.45 * k);
      }
      // motes drifting up after
      for (const m of motes) {
        const a = t - m.d;
        if (a < 0 || a > m.life) continue;
        const k = 1 - a / m.life, x = m.x + Math.sin(a * 6 + m.w) * 1.5, y = m.y + m.vy * a;
        p.dot(x, y, k > 0.5 ? C[6] : C[5], k * 1.5);
        p.glow(x + 0.5, y + 0.5, 3, C[5], 0.3 * k);
      }
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/pickups/_lib.js"] = function(exports, __req) {
// Helpers for the pickups: a scratch layer to build outlined sprites in, floor shadows, twinkles and bobs.
// Not an effect (the file name starts with _).

const {  createFrame, Painter, TAU, WHITE, hex, ramp, scale, rand  } = __req("core/index.js");

/**
 * The palette as at least n color steps, dark to bright, so effects can index C[0]..C[n-1] whatever ramp a
 * caller passes: a 7-step ramp repeats its brightest step, a short one is stretched step by step (no blending).
 */
function fit(palette, n = 8) {
  const r = ramp(palette);
  if (!r.length) return Array(n).fill(WHITE);
  if (r.length >= n - 1) {
    while (r.length < n) r.push(r[r.length - 1]);
    return r;
  }
  return Array.from({ length: n }, (_, i) => r[Math.round((i * (r.length - 1)) / (n - 1))]);
}

/**
 * A scratch layer: draw a sprite into it with its own painter (same local coordinates as the effect), give
 * it a dark outline, recolor it, then stamp it onto the frame. Lets a procedural shape get a hand-made
 * 1 px outline and lets shines sweep across exactly the sprite's pixels.
 */
class Layer {
  constructor(w = 64, h = 64) {
    this.f = createFrame(w, h);
    this.q = new Painter(this.f);
    this.tmp = new Uint32Array(w * h);
  }
  /** Clear it and put its top-left at local (x0, y0). Returns the layer's painter. */
  begin(x0, y0) {
    const f = this.f;
    f.ox = Math.floor(x0);
    f.oy = Math.floor(y0);
    f.color.fill(0);
    f.light.fill(0);
    return this.q.reset().place(0, 0);
  }
  idx(x, y) {
    const f = this.f, i = Math.floor(x) - f.ox, j = Math.floor(y) - f.oy;
    return i < 0 || j < 0 || i >= f.w || j >= f.h ? -1 : j * f.w + i;
  }
  get(x, y) {
    const i = this.idx(x, y);
    return i < 0 ? 0 : this.f.color[i];
  }
  set(x, y, c) {
    const i = this.idx(x, y);
    if (i >= 0) this.f.color[i] = c;
  }
  /** Fill each pixel from fn(x, y) at the pixel's center (x + 0.5, y + 0.5): return a color or 0. */
  fill(x0, y0, x1, y1, fn) {
    for (let y = Math.floor(y0); y <= y1; y++)
      for (let x = Math.floor(x0); x <= x1; x++) {
        const c = fn(x + 0.5, y + 0.5);
        if (c) this.set(x, y, c);
      }
  }
  /** A 1 px outline around everything drawn: c is a color or fn(x, y, neighbour color). corners adds diagonals. */
  outline(c, corners = false) {
    const f = this.f, C = f.color, T = this.tmp, w = f.w, h = f.h;
    T.fill(0);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (C[k]) continue;
        let n = (i > 0 && C[k - 1]) || (i < w - 1 && C[k + 1]) || (j > 0 && C[k - w]) || (j < h - 1 && C[k + w]);
        if (!n && corners) n = (i > 0 && j > 0 && C[k - w - 1]) || (i < w - 1 && j > 0 && C[k - w + 1]) || (i > 0 && j < h - 1 && C[k + w - 1]) || (i < w - 1 && j < h - 1 && C[k + w + 1]);
        if (n) T[k] = typeof c === "function" ? c(i + f.ox, j + f.oy, n) : c;
      }
    for (let k = 0; k < w * h; k++) if (T[k]) C[k] = T[k];
    return this;
  }
  /** Recolor every drawn pixel: fn(x, y, c) returns the new color. */
  map(fn) {
    const f = this.f, C = f.color;
    for (let k = 0; k < C.length; k++) if (C[k]) C[k] = fn((k % f.w) + f.ox, Math.floor(k / f.w) + f.oy, C[k]) || C[k];
    return this;
  }
  /** Stamp the layer onto p, offset by (dx, dy), at alpha a (dithered); clip [x0, x1] keeps x0 <= x < x1. */
  draw(p, dx = 0, dy = 0, a = 1, clip = null) {
    const f = this.f, C = f.color;
    for (let k = 0; k < C.length; k++) {
      if (!C[k]) continue;
      const x = (k % f.w) + f.ox + dx;
      if (clip && (x < clip[0] || x >= clip[1])) continue;
      p.dot(x, Math.floor(k / f.w) + f.oy + dy, C[k], a);
    }
    return this;
  }
}

const SHADOW = hex("#100e17");
/**
 * A floor shadow centered on x, half-width rx: a solid dark band on the floor line (y = 0) and a narrower one
 * under it, with dithered ends. Shrink rx as the thing above rises.
 */
function shadow(p, x, rx, k = 1) {
  if (rx < 1) return;
  for (let row = 0; row < 2; row++) {
    const w = rx - row * 2;
    for (let i = Math.floor(x - w); i < Math.ceil(x + w); i++) {
      const e = Math.abs(i + 0.5 - x) / w;
      if (e <= 1) p.dot(i, row, SHADOW, row ? k : k * (e < 0.8 ? 1 : 0.5));
    }
  }
}

/** A four-point twinkle of arm length s (whole pixels): white core, bright inner arms, colored tips. */
function twinkle(p, x, y, s, c, mid = c, core = WHITE) {
  s = Math.round(s);
  if (s <= 0) return;
  for (let d = 1; d <= s - 1; d++) {
    const k = d < s / 2 ? mid : c;
    p.px(x + d, y, k), p.px(x - d, y, k), p.px(x, y + d, k), p.px(x, y - d, k);
  }
  if (s >= 4) p.px(x + 1, y + 1, c), p.px(x - 1, y - 1, c), p.px(x + 1, y - 1, c), p.px(x - 1, y + 1, c);
  p.px(x, y, core);
}

/** A seamless bob: up-and-down offset in px for loop phase ph (0..1), n bobs a loop. */
const bob = (ph, amp, n = 1, off = 0) => -amp * Math.sin((ph * n + off) * TAU);

/**
 * Fill a puffy shape into layer L from a signed distance sdf(x, y) in px (negative inside). The surface is
 * flat in the middle and rounds over in a bevel px wide at the edge; color(b, e, x, y) gets the light b
 * (about -0.3 facing away .. 1 facing the light, 0.62 flat) and the depth e in px from the edge. clip(x, y)
 * returning true cuts a pixel away without shading the cut (a break, a bite).
 */
function pillow(L, x0, y0, x1, y1, sdf, color, { bevel = 3, light = [-0.5, -0.6, 0.62], clip = null } = {}) {
  L.fill(x0, y0, x1, y1, (x, y) => {
    const d = sdf(x, y);
    if (d > 0 || (clip && clip(x, y))) return 0;
    const e = -d;
    let gx = sdf(x + 0.5, y) - sdf(x - 0.5, y), gy = sdf(x, y + 0.5) - sdf(x, y - 0.5);
    const gl = Math.hypot(gx, gy) || 1;
    gx /= gl;
    gy /= gl;
    const k = Math.max(0, 1 - e / bevel) * 1.25, sn = Math.sin(k), cs = Math.cos(k);
    return color(gx * sn * light[0] + gy * sn * light[1] + cs * light[2], e, x, y);
  });
}

/** Signed distance (px, roughly) to a heart of half-width w centered at (cx, cy): the classic sextic curve. */
function heartSdf(x, y, cx, cy, w, h = w) {
  const S = w / 1.14, X = (x - cx) / S, Y = -(y - cy) / (h / 1.14) + 0.12;
  const q = X * X + Y * Y - 1, f = q * q * q - X * X * Y * Y * Y;
  const gx = 6 * X * q * q - 2 * X * Y * Y * Y, gy = 6 * Y * q * q - 3 * X * X * Y * Y;
  return (f / Math.max(Math.hypot(gx, gy), 0.6)) * S;
}

// ---- the rebuilt pickups (techniques from Sprite Fusion's open-source pickup and sparkle, MIT, Hugo Duprez)

const INK = hex("#0b0814");

/**
 * A soft floor shadow at x, half-width rx: dithered darkness on the floor line, fuller in the middle, with a
 * shorter second row under it. k (0..1) is its strength: lift the thing above and the shadow shrinks and thins.
 */
function blobShadow(p, x, rx, k = 1, y = 0) {
  if (rx < 0.8 || k <= 0) return;
  for (let i = Math.floor(x - rx); i <= Math.ceil(x + rx); i++) {
    const u = Math.abs(i + 0.5 - x) / rx;
    if (u > 1) continue;
    const a = k * (1 - u * u);
    p.dot(i, y, INK, a * 1.1);
    if (u < 0.6) p.dot(i, y + 1, INK, a * 0.6);
  }
}

/** A four-point star glint: arms of arm px in c, dimmer tips, a white heart, its own light. */
function glint(p, x, y, arm, c, k = 0.4, tip = scale(c, 0.8)) {
  const n = Math.round(arm), X = Math.floor(x), Y = Math.floor(y);
  if (n < 0) return;
  for (let d = 1; d <= n; d++) {
    const cc = d === n && n > 1 ? tip : c;
    p.px(X + d, Y, cc), p.px(X - d, Y, cc), p.px(X, Y + d, cc), p.px(X, Y - d, cc);
  }
  p.px(X, Y, n > 0 ? WHITE : c);
  p.glow(X + 0.5, Y + 0.5, 3 + n * 2.5, c, k);
}

/** Additive light in an ellipse (a pool of light on the floor): k at the center falling off to the rim. */
function pool(p, x, y, rx, ry, c, k) {
  if (k <= 0.004 || rx < 1) return;
  p.shade(x - rx, y - ry, x + rx, y + ry, (px, py, out) => {
    const dx = (px - x) / rx, dy = (py - y) / ry, d = dx * dx + dy * dy;
    if (d >= 1) return;
    const f = 1 - Math.sqrt(d);
    out.l = c;
    out.k = f * f * k;
  });
}

/**
 * A coin of radius r tumbling: its face turns by `spin` about an axis at screen angle `ax`, showing its rim
 * as it goes edge-on. A lit rim round a face with a shine, built in layer L with a dark outline, lit from the
 * top left. C: an 8-step gold ramp. snap puts its center on a pixel corner (even sizes) so it holds its shape
 * while it moves; pass snap false and a pixel-center y for odd heights.
 */
function coin(L, p, x, y, r, ax, spin, C, white = false, a = 1, snap = true) {
  const X = snap ? Math.round(x) : x, Y = snap ? Math.round(y) : y, cs = Math.cos(spin), sn = Math.sin(spin);
  const b = Math.max(0.5, r * Math.abs(cs)), th = 1.2 * sn * Math.sign(cs || 1), ca = Math.cos(ax), sa = Math.sin(ax);
  const face = Math.abs(cs), R = Math.ceil(r) + 2;
  L.begin(Math.floor(X) - R, Math.floor(Y) - R);
  L.fill(Math.floor(X) - R, Math.floor(Y) - R, Math.floor(X) + R, Math.floor(Y) + R, (px, py) => {
    const dx = px - X, dy = py - Y, u = dx * ca + dy * sa, w = -dx * sa + dy * ca;
    const ef = Math.hypot(u / r, w / b), er = Math.hypot(u / r, (w - th) / b);
    if (white && (ef <= 1 || er <= 1)) return WHITE;
    if (ef <= 1) {
      // in the face's own frame: the raised rim, a recessed ring inside it, a raised middle with a shine
      const lit = -(dx * 0.62 + dy * 0.78) / Math.max(1, Math.hypot(dx, dy)), dim = face < 0.45 ? 1 : 0;
      if (b < 1.1) return lit > 0 ? C[6] : C[4];
      if (ef > 0.72) return C[(lit > 0.3 ? 6 : lit > -0.35 ? 5 : 3) - dim];
      if (b > 2.2 && ef > 0.42) return C[(lit > 0.2 ? 4 : 5) - dim];
      if (face > 0.6 && lit > 0.5) return C[7];
      return C[5 - dim];
    }
    if (er <= 1) return Math.abs(w - th) < Math.abs(w) ? C[2] : C[3];
    return 0;
  });
  L.outline(C[1]).draw(p, 0, 0, a);
}

/**
 * A small cut gem of radius r turned to angle `ang` (radians, on screen): a crown with a table over a pointed
 * pavilion, its facets lit from the top left, a white glint on the table; G is a ramp dark to bright (6+
 * steps). Built in L with a dark outline.
 */
function gemlet(L, p, x, y, r, ang, G, white = false, a = 1) {
  const X = Math.round(x), Y = Math.round(y), ca = Math.cos(ang), sa = Math.sin(ang), n = G.length, R = Math.ceil(r * 1.4) + 2;
  const ct = r * 0.75, tw = r * 0.5, pv = r * 1.3;
  L.begin(X - R, Y - R);
  L.fill(X - R, Y - R, X + R - 1, Y + R - 1, (px, py) => {
    const dx = px - X, dy = py - Y, u = dx * ca + dy * sa, w = -dx * sa + dy * ca;
    let facet;
    if (w < 0) {
      if (w < -ct || Math.abs(u) > r - ((-w) / ct) * (r - tw)) return 0;
      facet = w < -ct * 0.45 && Math.abs(u) < tw * 0.95 ? 0 : u < 0 ? 1 : 2;
    } else {
      if (w > pv || Math.abs(u) > r * (1 - w / pv)) return 0;
      facet = Math.abs(u) < 0.5 ? 4 : u < 0 ? 3 : 5;
    }
    if (white) return WHITE;
    // each facet's normal, turned with the gem; the light comes from the top left of the screen
    const N = [[0, -1], [-0.7, -0.7], [0.7, -0.7], [-0.6, 0.8], [0, 1], [0.6, 0.8]][facet];
    const nx = N[0] * ca - N[1] * sa, ny = N[0] * sa + N[1] * ca, l = -(nx * 0.62 + ny * 0.78);
    if (facet === 0 && l > 0.3 && u < 0) return WHITE;
    return l > 0.6 ? G[n - 1] : l > 0.2 ? G[n - 2] : l > -0.2 ? G[n - 3] : l > -0.6 ? G[n - 4] : G[n - 5];
  });
  L.outline(G[0]).draw(p, 0, 0, a);
}

/**
 * A cut gem as a convex solid: facet planes { n: [x, y, z] outward unit normal, d, kind }, y up, z towards
 * the viewer, the girdle on y = 0. brilliant() builds a round brilliant: a table, crown facets, a thin
 * girdle, pavilion facets down to a point; n facets round (8 by default).
 */
function brilliant({ r = 7.5, crown = 3.6, table = 0.52, pavilion = 8, girdle = 0.8, n = 8 } = {}) {
  const planes = [{ n: [0, 1, 0], d: crown + girdle / 2, kind: 0 }];
  const cs = Math.atan2(crown, r * (1 - table)), ps = Math.atan2(pavilion, r);
  for (let i = 0; i < n * 2; i++) {
    const a = (i * Math.PI) / n, half = i % 2;
    const c = half ? Math.min(1.45, cs + 0.22) : cs, pv = half ? ps - 0.1 : ps;
    // crown: main facets, and steeper ones between them by the girdle
    planes.push({ n: [Math.sin(c) * Math.cos(a), Math.cos(c), Math.sin(c) * Math.sin(a)], d: r * Math.sin(c) * (half ? 1.012 : 1) + (girdle / 2) * Math.cos(c), kind: half ? 2 : 1 });
    // the girdle: a ring of thin upright faces
    planes.push({ n: [Math.cos(a), 0, Math.sin(a)], d: r * (half ? 1.0 : 1.0), kind: 3 });
    // pavilion: main facets to the point, shallower ones between them by the girdle
    planes.push({ n: [Math.sin(pv) * Math.cos(a), -Math.cos(pv), Math.sin(pv) * Math.sin(a)], d: r * Math.sin(pv) * (half ? 1.03 : 1) + (girdle / 2) * Math.cos(pv), kind: half ? 5 : 4 });
  }
  return { planes, r, top: crown + girdle / 2, bottom: pavilion + girdle / 2 };
}

/**
 * A crystal: an n-sided prism (apothem r, half-height half) with a pointed cap of height top and a shorter
 * point of height bottom, as facet planes for drawGem (kinds 6 prism, 7 cap, 8 point).
 */
function prism({ r = 4.6, half = 5.5, top = 7.5, bottom = 6, n = 6 } = {}) {
  const planes = [], ct = Math.atan2(top, r), cb = Math.atan2(bottom, r);
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n;
    planes.push({ n: [Math.cos(a), 0, Math.sin(a)], d: r, kind: 6 });
    planes.push({ n: [Math.sin(ct) * Math.cos(a), Math.cos(ct), Math.sin(ct) * Math.sin(a)], d: Math.sin(ct) * r + Math.cos(ct) * half, kind: 7 });
    planes.push({ n: [Math.sin(cb) * Math.cos(a), -Math.cos(cb), Math.sin(cb) * Math.sin(a)], d: Math.sin(cb) * r + Math.cos(cb) * half, kind: 8 });
  }
  return { planes, r: r / Math.cos(Math.PI / n), top: half + top, bottom: half + bottom };
}

/**
 * Draw gem g turned by spin (radians about its upright axis), its center (the girdle) at (x, y), seen from a
 * little above (tilt), into layer L with a dark outline. Each pixel finds the facet it looks at; crown facets
 * catch the light from the top left, pavilion facets glow with the light bouncing up through the stone.
 * C: ramp dark to bright (8). Returns the brightest spot { x, y } for a glint.
 */
function drawGem(L, p, g, x, y, spin, C, { tilt = 0.32, white = false, a = 1, edges = true, gain = 1 } = {}) {
  const cs = Math.cos(spin), sn = Math.sin(spin), ct = Math.cos(tilt), st = Math.sin(tilt);
  const P = g.planes.map((q) => ({ n: [q.n[0] * cs - q.n[2] * sn, q.n[1], q.n[0] * sn + q.n[2] * cs], d: q.d, kind: q.kind }));
  // light from the top left, a little in front; the eye looks down the tilted z axis
  const Lx = -0.55, Ly = 0.72, Lz = 0.42, D = [0, -st, -ct], V = [0, st, ct];
  const Hl = Math.hypot(Lx + V[0], Ly + V[1], Lz + V[2]), H = [(Lx + V[0]) / Hl, (Ly + V[1]) / Hl, (Lz + V[2]) / Hl];
  const X = Math.round(x), Y = Math.round(y), R = Math.ceil(g.r) + 2, top = Math.ceil(g.top + 2), bot = Math.ceil(g.bottom + 2);
  let best = -1, bx = X, by = Y;
  const ids = new Map();
  L.begin(X - R, Y - top);
  L.fill(X - R, Y - top, X + R, Y + bot, (px, py) => {
    const sx = px - X, sy = -(py - Y);
    // the ray through this pixel: origin on the screen plane, straight down the view axis
    const o = [sx, sy * ct, -sy * st];
    let t0 = -1e9, t1 = 1e9, hit = null;
    for (const q of P) {
      const nd = q.n[0] * D[0] + q.n[1] * D[1] + q.n[2] * D[2], no = q.n[0] * o[0] + q.n[1] * o[1] + q.n[2] * o[2];
      if (Math.abs(nd) < 1e-6) {
        if (no > q.d) return 0;
        continue;
      }
      const tt = (q.d - no) / nd;
      if (nd < 0) {
        if (tt > t0) (t0 = tt), (hit = q);
      } else if (tt < t1) t1 = tt;
    }
    if (!hit || t0 > t1) return 0;
    if (white) return WHITE;
    ids.set((Math.floor(px) + 500) * 1000 + Math.floor(py) + 500, P.indexOf(hit));
    const n = hit.n, pav = hit.kind === 4 || hit.kind === 5 || hit.kind === 8;
    // the pavilion shows light that came in through the crown and bounced back: mirror its normal
    const m = pav ? [n[0], -n[1] * 0.6, n[2]] : n, ml = Math.hypot(m[0], m[1], m[2]);
    const lam = Math.max(0, (m[0] * Lx + m[1] * Ly + m[2] * Lz) / ml), spec = Math.pow(Math.max(0, (m[0] * H[0] + m[1] * H[1] + m[2] * H[2]) / ml), 18);
    let b = pav ? 0.02 + 0.72 * Math.pow(lam, 2.4) : hit.kind === 3 ? 0.12 + 0.4 * lam : 0.04 + 0.66 * Math.pow(lam, 1.8);
    // a crystal's upright faces are lit by the light's level direction; its cap catches it from above
    if (hit.kind === 6) b = 0.16 + 0.66 * Math.pow(Math.max(0, (n[0] * Lx + n[2] * Lz) / Math.hypot(Lx, Lz)), 1.3);
    else if (hit.kind === 7) b = 0.22 + 0.62 * Math.pow(lam, 1.2);
    // a fracture shows the lit inside of the stone, rough and grainy; chips are small rough facets
    else if (hit.kind === 9) b = 0.62 + 0.25 * lam;
    else if (hit.kind === 10) b = 0.3 + 0.5 * lam + (rand(Math.floor(px - X), Math.floor(py - Y), 43) - 0.5) * 0.08;
    if (hit.kind !== 9) b *= gain;
    if (hit.kind === 0) b -= 0.04;
    const s = b + spec * 0.6;
    if (s > best) (best = s), (bx = px), (by = py);
    if (spec > 0.8) return pav ? C[6] : WHITE;
    return C[Math.max(1, Math.min(6, Math.round(1 + s * 5.6)))];
  });
  // the cut: where two facets meet, a pavilion edge sinks a shade and a crown ridge catches a shade more light
  if (!white && edges) {
    const out = [];
    for (const [key, id] of ids) {
      const kx = Math.floor(key / 1000), ky = key - kx * 1000, x = kx - 500, y = ky - 500, r = ids.get(key + 1000), d = ids.get(key + 1);
      if ((r !== undefined && r !== id) || (d !== undefined && d !== id)) {
        const c = L.get(x, y) >>> 0, i = C.findIndex((k) => k >>> 0 === c), pav = [4, 5, 8].includes(P[id].kind);
        if (i > 0) out.push([x, y, pav ? C[Math.max(1, i - 1)] : C[Math.min(7, i + 1)]]);
      }
    }
    for (const [x, y, c] of out) L.set(x, y, c);
  }
  L.outline(C[0]).draw(p, 0, 0, a);
  return { x: bx, y: by, k: best };
}

/**
 * A thick coin turning on its upright axis: radius r, thickness th, turned by theta (0 faces you). Each row
 * shows the face (squashed by cos theta, a raised rim, a recessed field, an embossed star) and, beside it,
 * the reeded edge band (th |sin theta| wide). Lit from the top left; the face flashes white as it squares
 * to the light. Built in L with a dark outline. C: 8-step ramp. Returns the flash strength 0..1.
 */
function coin3d(L, p, x, y, r, th, theta, C, { a = 1, white = false } = {}) {
  const ct = Math.cos(theta), st = Math.sin(theta), sg = ct < 0 ? -1 : 1, act = Math.abs(ct), ast = Math.abs(st);
  const xc = (th / 2) * st * sg, nfx = st * sg, Lx = -0.55, Ly = 0.45, Lz = 0.7, Ln = Math.hypot(Lx, Ly, Lz);
  // the face's normal stays level, so its flash comes when it squares to the light's level direction
  const lam = (nfx * Lx + act * Lz) / Ln, Hx = Lx / Ln, Hz = Lz / Ln + 1, Hn = Math.hypot(Hx, Hz);
  const base = Math.max(2, Math.min(5, Math.round(2 + lam * 3.2)));
  const X = Math.round(x), Y = Math.round(y), B = Math.ceil(r + th) + 2;
  let flash = 0;
  L.begin(X - B, Y - B);
  L.fill(X - B, Y - B, X + B, Y + B, (px, py) => {
    const sx = px - X, sy = -(py - Y);
    if (Math.abs(sy) > r) return 0;
    const s = Math.sqrt(1 - (sy / r) ** 2), hw = r * s * act, xr = -(st < 0 ? -1 : 1) * s * r * ct, rw = (th / 2) * ast;
    if (white && (Math.abs(sx - xc) <= hw || Math.abs(sx - xr) <= rw + 0.05)) return WHITE;
    if (Math.abs(sx - xc) <= hw && act > 0.08) {
      // on the face: un-squash to the face's own coordinates
      const fx = (sx - xc) / act, fy = sy, d = Math.hypot(fx, fy) / r;
      // a faint curve across the face makes the flash sweep over it as it turns
      const tx = nfx + (fx / r) * 0.3 * act, sp = Math.pow(Math.max(0, (tx * Hx + act * Hz) / Hn / Math.hypot(tx, act)), 130);
      flash = Math.max(flash, sp);
      // relief in whole ramp steps so it shows at every angle: a raised rim lit on its upper left, a recessed
      // field, a raised diamond with lit and shaded faces
      const lit = (-fx * 0.6 + fy * 0.8) / Math.max(0.5, Math.hypot(fx, fy));
      let k;
      if (d > 0.76) k = base + (lit > 0.75 ? 2 : lit > 0.3 ? 1 : lit < -0.35 ? -1 : 0);
      else {
        const q = (Math.abs(fx) + Math.abs(fy)) / (r * 0.52);
        k = q >= 1 ? base - 1 : q < 0.45 ? base + 1 : fx <= 0 && fy >= 0 ? base + 1 : fx > 0 && fy < 0 ? base - 2 : base;
      }
      if (sp > 0.5) return sp > 0.8 ? WHITE : C[Math.min(7, k + 2)];
      return C[Math.max(2, Math.min(6, k))];
    }
    if (Math.abs(sx - xr) <= rw + 0.05) {
      // the reeded edge: grooves across the band, lit by the edge's own normal
      const cphi = xr < 0 ? -s : s, n = [cphi * ct, sy / r, -cphi * st], l = (n[0] * Lx + n[1] * Ly + n[2] * Lz) / Ln;
      const groove = Math.floor((Math.asin(sy / r) + Math.PI) * 9) % 2;
      const edge = Math.abs(sx - xr) > rw - 0.6 && Math.sign(sx - xr) === Math.sign(xc - xr);
      return C[Math.max(1, Math.min(6, Math.round(2.6 + l * 2.6) - groove + (edge ? 1 : 0)))];
    }
    return 0;
  });
  L.outline(C[1]).draw(p, 0, 0, a);
  return flash;
}

exports.fit = fit;
exports.shadow = shadow;
exports.twinkle = twinkle;
exports.pillow = pillow;
exports.heartSdf = heartSdf;
exports.blobShadow = blobShadow;
exports.glint = glint;
exports.pool = pool;
exports.coin = coin;
exports.gemlet = gemlet;
exports.brilliant = brilliant;
exports.prism = prism;
exports.drawGem = drawGem;
exports.coin3d = coin3d;
exports.Layer = Layer;
exports.bob = bob;
  };
  __mods["fx/explosions/plasma-explosion.js"] = function(exports, __req) {
// The release (flash, rings, flare, light) and the arcs are adapted from Sprite Fusion's open-source energy
// (https://www.spritefusion.com/pixel-art-vfx/energy), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Lights, P, Rng, rng, fit, band, bolt, forks, flare, sparkle, clamp, smooth, ease, noise, TAU, WHITE  } = __req("core/index.js");
const {  cull  } = __req("fx/explosions/_lib.js");

const meta = {
  name: "Plasma explosion",
  desc: "A blue-violet energy blast with no smoke: a white flash, a ball of plasma swelling into a thinning shell, shock rings in and out of depth, lightning arcs crackling off it.",
  tags: ["explosion", "plasma", "energy", "electric", "magic", "sci-fi", "one-shot"],
  size: [224, 200],
  origin: [112, 100],
  duration: 1.7,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#0a0828", "#1a1c6e", "#2c3cc0", "#4a7cf0", "#7cc0ff", "#c8ecff", "#ffffff"],
    accent: ["#1c0a30", "#4a1a8c", "#8a3ce0", "#c48cff", "#f0d8ff"],
    seed: 7,
  },
};

const BALL = 0.55;

function create(o) {
  const C = fit(o.palette, 7), V = fit(o.accent, 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [C[6], C[5], C[4], V[3]] }), lights = new Lights();
  lights.add(0, 0, 96, C[4], 1, 0.6);
  lights.add(0, 0, 40, WHITE, 0.9, 0.1);
  lights.add(0, 0, 70, V[2], 0.5, 1.1);
  for (let i = 0; i < 46; i++) {
    const a = R.range(0, TAU), sp = R.range(140, 360);
    ps.spawn(P.MOTE, Math.cos(a) * 4, Math.sin(a) * 4, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.42), R.pick([C[6], C[5], C[4], V[3]]), R.range(0.7, 1.1));
  }
  for (let i = 0; i < 26; i++) {
    const a = R.range(0, TAU), sp = R.range(40, 140);
    ps.spawn(P.FLAKE, Math.cos(a) * 10, Math.sin(a) * 10, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.8, 1.5), R.pick([C[5], V[3], V[4]]), R.range(0.6, 1.6));
  }
  let t = 0;
  return {
    update(dt) {
      t += dt;
      // the shell sheds sparkles and motes as it thins
      if (t > 0.12 && t < 0.9 && R.chance(30 * dt)) {
        const a = R.range(0, TAU), r = shell(t);
        ps.spawn(P.STAR, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * R.range(10, 40), Math.sin(a) * R.range(10, 40), R.range(0.3, 0.6), R.chance(0.5) ? C[5] : V[4], R.range(0.5, 1.8));
      }
      ps.update(dt);
      cull(ps, -meta.origin[0] + 3, -meta.origin[1] + 3, meta.size[0] - meta.origin[0] - 3, meta.size[1] - meta.origin[1] - 3);
      lights.update(dt);
    },
    drawBack(p) {
      // the tilted ring's far half, behind the ball
      tilted(p, t, C, V, true);
    },
    draw(p) {
      // the ball: a white heart, cyan and blue bands, a violet rim boiling at the edge; it swells, then hollows out
      if (t < BALL) {
        const u = t / BALL, r = shell(t), hollow = smooth(0.35, 1, u), boil = Math.floor(t * 20);
        p.shade(-r - 3, -r - 3, r + 3, r + 3, (x, y, out) => {
          const d = Math.hypot(x, y), a = Math.atan2(y, x), edge = r * (1 + 0.1 * noise(a * 3 + boil * 0.7, 3));
          if (d > edge) return;
          const v = d / edge;
          if (v < hollow * 0.92) return;
          // turbulent bands swirling round the heart, and bright filaments twisting through them
          const n = noise(a * 4 + d * 0.25 + boil * 0.5, 5), w = v + n * 0.14, fil = Math.abs(Math.sin(a * 5 + d * 0.32 - t * 14 + n * 2.5)) < 0.1;
          out.k = 0.25 * (1 - u);
          if (v > 0.9) return V[2];
          if (fil && v > 0.3) return u < 0.5 ? WHITE : C[5];
          return w < 0.32 - u * 0.25 ? WHITE : w < 0.52 ? C[5] : w < 0.72 ? C[4] : w < 0.86 ? (u < 0.5 ? C[3] : V[3]) : V[2];
        });
        p.glow(0, 0, r * 1.6 + 6, C[4], 0.6 * (1 - u));
      }
      if (t < 0.07) p.circle(0, 0, 9 - t * 60, WHITE);
      if (t < 0.25) flare(p, 0, 0, 52 * Math.pow(1 - t / 0.25, 1.3), 1 - t / 0.25, C);
      // shock rings: a fast bright one, a slower violet one
      const u1 = t / 0.42;
      if (u1 < 1) {
        p.ring(0, 0, 8 + 84 * ease.outCubic(u1), Math.max(1, 3 * (1 - u1)), u1 < 0.25 ? WHITE : C[5], 1.15 - u1);
        p.glowRing(0, 0, 8 + 84 * ease.outCubic(u1), 5, C[4], 0.35 * (1 - u1));
      }
      const u2 = (t - 0.06) / 0.6;
      if (u2 > 0 && u2 < 1) p.ring(0, 0, 6 + 60 * ease.outCubic(u2), Math.max(1, 2 * (1 - u2)), V[3], 1.1 - u2);
      // arcs: lightning crackling out of the heart, re-struck every few frames, shorter as the charge runs out
      const left = 1 - smooth(0.15, 0.85, t), strike = Math.floor(t * 18);
      if (left > 0) {
        const r = rng(o.seed, strike, 17), n = 2 + Math.round(4 * left);
        for (let i = 0; i < n; i++) {
          const a = r.range(0, TAU), L = r.range(26, 58) * (0.45 + 0.55 * left), path = bolt(r, 0, 0, Math.cos(a) * L, Math.sin(a) * L, { jag: 0.28, depth: 4 });
          arc(p, path, C, V, 0.8 * left);
          if (r.chance(0.5)) for (const f of forks(r, path, { count: 1, len: 14, jag: 0.35 })) arc(p, f, C, V, 0.5 * left);
        }
        // and little arcs crawling over the shell
        const rs = shell(t);
        for (let i = 0; i < 3; i++) {
          const a = r.range(0, TAU), b = a + r.range(0.3, 0.6);
          arc(p, bolt(r, Math.cos(a) * rs, Math.sin(a) * rs, Math.cos(b) * rs, Math.sin(b) * rs, { jag: 0.4, depth: 3 }), C, V, 0.6 * left);
        }
      }
      tilted(p, t, C, V, false);
      ps.draw(p);
      lights.draw(p);
    },
  };
}

// the ball's radius: punched out fast, then easing
function shell(t) {
  return 5 + 30 * ease.outCubic(clamp(t / BALL));
}

// a ring on a tilted plane racing out round the blast: far half behind, near half in front
function tilted(p, t, C, V, back) {
  const u = (t - 0.03) / 0.5;
  if (u <= 0 || u >= 1) return;
  band(p, 0, 4, 12 + 86 * ease.outCubic(u), 0.28, Math.max(1, 4 * (1 - u)), 1.15 - u, [V[1], V[2], C[4], C[5]], (g) => (Math.sin(g) < 0) === back, u < 0.15);
}

// one arc: a soft glow along it, a cyan halo line, a white core
function arc(p, path, C, V, k) {
  if (k <= 0.05) return;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    p.glowLine(ax, ay, bx, by, 5, V[2], 0.18 * k);
    p.line(ax + 1, ay, bx + 1, by, C[4], k * 0.8);
    p.line(ax, ay, bx, by, i < path.length * 0.6 ? WHITE : C[5], Math.min(1, k * 1.4));
  }
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/explosions/_lib.js"] = function(exports, __req) {
// Shared by the explosions. Not an effect (the leading _ keeps the tools away).
// The fire balls, rocks and scorch are adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.

const {  P, PF, clamp, smooth, rand, TAU, WHITE, hex, mix, scale, rgb  } = __req("core/index.js");

const OUTLINE = hex("#1a1422"), SOOT = hex("#0d0a12"), SOOT2 = hex("#17121d");

/** Stone colors from one body color: a lit face, the body, a shaded face, and the dust it makes. */
function stone(c) {
  c = hex(c);
  return { light: mix(scale(c, 1.35), WHITE, 0.08), body: c, shade: scale(c, 0.64), dust: mix(scale(c, 1.2), rgb(150, 140, 150), 0.3) };
}

/** A 9-step fire ramp, white-hot down to smouldering (the shape of FIRE_RAMP), from an 8-step palette (dark to bright). */
const fireRamp = (F) => [F[7], F[6], F[5], F[4], F[3], F[2], F[1], mix(F[1], F[0], 0.5), F[0]];

/** One FIRE particle drawn in the fire ramp FR: a darker rim, a lit core, a tongue on top, a hot heart. */
function fireBall(p, q, FR) {
  const k = q.life / q.max, age = 1 - k, n = FR.length, x = q.x, y = q.y;
  const heat = Math.min(0.999, Math.pow(age, 0.62) + (q.seed % 1) * 0.1), idx = Math.min(n - 2, Math.floor(heat * (n - 1)));
  const r = q.size * (0.55 + 0.45 * Math.min(1, age * 7)) * (1 - age * 0.55), c = FR[idx];
  if (idx >= n - 2) return p.disc(x, y, r, c, Math.min(1, k * 3) * 0.85);
  // the hottest puffs get a rim a step darker still, so a mass of them reads as separate balls
  p.circle(x, y, r, FR[Math.min(n - 1, idx + (idx <= 2 ? 3 : 2))]);
  p.circle(x - r * 0.16, y - r * 0.22, r * 0.78, c);
  if (r > 1.6) p.circle(x, y - r * 0.9, r * 0.42, c);
  if (idx <= 3 && r > 1.8) p.circle(x - r * 0.28, y - r * 0.34, r * 0.36, FR[Math.max(0, idx - 1)]);
  if (idx < 6) p.glow(x, y, r * 2.4 + 2, c, 0.18 * k);
}

/** A particle system's layer ("back" or "front") with its FIRE puffs in the fire ramp FR, so a palette recolors them. */
function drawPs(p, ps, layer, FR) {
  const all = ps.list, fires = [], rest = [];
  for (const q of all) (q.k === P.FIRE ? fires : rest).push(q);
  const back = layer === "back";
  if (!back) for (const q of fires) if (q.delay <= 0 && !(q.flag & PF.BACK)) fireBall(p, q, FR);
  ps.list = rest;
  ps.draw(p, layer);
  ps.list = all;
  if (back) for (const q of fires) if (q.delay <= 0 && q.flag & PF.BACK) fireBall(p, q, FR);
}

const LIFTS = new Set([P.SMOKE, P.DUST, P.FIRE, P.EMBER, P.VAPOUR]);
/**
 * An updraft column at x: smoke, dust, fire and embers below `top` and within w of the axis are carried up
 * (up px/s²) and squeezed toward it; near the floor (within `low` px) they're drawn in from as far as `reach`:
 * the afterwinds that feed a blast's column. k scales it all.
 */
function draft(ps, dt, { x = 0, top = -Infinity, w = 12, up = 150, squeeze = 4, pull = 0, low = 10, reach = 100, k = 1 }) {
  if (k <= 0) return;
  for (const q of ps.list) {
    if (q.delay > 0 || !LIFTS.has(q.k) || q.y < top) continue;
    const dx = q.x - x, ax = Math.abs(dx), u = ax / w;
    if (u < 1) {
      const f = (1 - u * u) * k;
      q.vy -= up * f * dt;
      q.vx -= dx * squeeze * f * dt;
    }
    if (pull && q.y > -low && ax > w * 0.4 && ax < reach) q.vx -= Math.sign(dx) * pull * k * (1 - ax / reach) * dt;
  }
}

/** Drop particles that leave the box (local px), so nothing is drawn past the canvas. */
function cull(ps, x0, y0, x1, y1) {
  const L = ps.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i];
    if (q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1) L.splice(i, 1);
  }
}

const SOFT = new Set([P.SMOKE, P.DUST, P.VAPOUR]);
/**
 * Soft particles (smoke, dust, vapour) fade out over w px as they near the sides x0, x1 and go before they reach
 * them; y1, a bottom edge, gets a thin w of 6 (keep things off it by design).
 */
function fadeEdges(ps, x0, x1, w = 30, y1 = Infinity) {
  const L = ps.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i];
    if (!SOFT.has(q.k)) continue;
    const r = q.size * 1.65, e = Math.min((Math.min(q.x - x0, x1 - q.x) - r) / w, (y1 - q.y - r) / 6);
    if (e <= 0) L.splice(i, 1);
    else if (e < 1) q.life = Math.min(q.life, q.max * 0.42 * e);
  }
}

/** A soft pool of light, an ellipse rx by ry at (x, y): light falling on the floor (keep ry small, it's perspective). */
function pool(p, x, y, rx, ry, c, k) {
  if (k <= 0.004 || rx < 1 || ry < 0.5) return;
  p.shade(x - rx, y - ry, x + rx, y + ry, (px, py, out) => {
    const dx = (px - x) / rx, dy = (py - y) / ry, d = dx * dx + dy * dy;
    if (d >= 1) return;
    const f = 1 - Math.sqrt(d);
    out.l = c;
    out.k = f * f * k;
  });
}

/** A translucent ellipse (blended, never dithered): c and a may be functions of d (0 centre .. 1 rim). */
function haze(p, x, y, rx, ry, c, a) {
  if (rx < 0.5 || ry < 0.5) return;
  const fc = typeof c === "function", fa = typeof a === "function";
  p.each(x - rx, y - ry, x + rx, y + ry, (lx, ly, sx, sy) => {
    const dx = (lx - x) / rx, dy = (ly - y) / ry, d2 = dx * dx + dy * dy;
    if (d2 > 1) return;
    const d = Math.sqrt(d2);
    p.blendPx(sx, sy, fc ? c(d) : c, fa ? a(d) : a);
  });
}

/** Heat for a scorch, from a fire ramp (bright to dark) down to cinders. */
const heatRamp = (FR) => [...FR.slice(0, 8), mix(FR[8], SOOT, 0.3), mix(FR[8], SOOT, 0.65)];

/**
 * The floor under a blast: a burn that spreads out in a blink, glows white-hot and cools through the heat ramp
 * HR to soot over `cool` seconds; a few cracks hold their glow twice as long. rows deep, fade 0..1.
 */
function scorch(p, HR, t, rx0, cool, fade, rows = 3) {
  if (fade <= 0) return;
  const rx = rx0 * Math.min(1, t / 0.08), ry = rows + 1.5, n = HR.length;
  for (let y = 0; y < rows; y++)
    for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++) {
      const dx = (x + 0.5) / rx, dy = (y + 0.5) / ry, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      const k = rand(x * 31 + y, 3), T = Math.pow(clamp(1 - t / cool), 1.4) * (1.25 - d) - k * 0.35;
      const crack = k > 0.88 && d < 0.85 ? Math.pow(clamp(1 - t / (cool * 2)), 1.2) * (1.15 - d) * 0.8 : 0, H = Math.max(T, crack);
      if (H > 0.06) {
        const c = HR[Math.min(n - 1, Math.floor((1 - Math.min(1, H)) * (n - 1)))];
        p.dot(x, y, c, fade);
        if ((x & 3) === 0 || crack > T) p.glow(x + 0.5, y, 6, c, 0.18 * H * fade);
      } else p.dot(x, y, d < 0.5 ? SOOT : SOOT2, (d < 0.95 - k * 0.3 ? 1 : 1 - d) * fade);
    }
}

/**
 * A rock (a Bits CHUNK): a lit side, a shaded side and an outline, turning as it spins. b.heat (0..1) makes
 * it molten: its heart and shaded side glow through the fire ramp FR and it gives off light, cooling to stone.
 */
function rock(p, b, st, FR) {
  const r = 0.6 + b.s * 0.75, fade = Math.min(1, b.life / 0.5), lx = Math.cos(b.a) * r * 0.4, ly = Math.sin(b.a) * r * 0.4, heat = b.heat ?? 0;
  p.shade(b.x - r - 1, b.y - r - 1, b.x + r + 1, b.y + r + 1, (x, y, out) => {
    const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx * 1.15, dy);
    if (d > r + 0.9) return;
    out.a = fade;
    if (d > r) return OUTLINE;
    const lit = dx * lx + dy * ly;
    if (heat > 0.08) {
      const g = heat * (1.1 - d / (r + 0.5)) + (lit > 0.3 ? heat * 0.45 : 0);
      if (g > 0.5) return FR[g > 1 ? 1 : g > 0.8 ? 2 : g > 0.62 ? 3 : 4];
      if (g > 0.32) return FR[5];
    }
    return lit < -0.4 ? st.light : lit > 0.6 ? st.shade : st.body;
  });
  if (heat > 0.05) p.glow(b.x, b.y, r * 2 + 3, FR[3], 0.32 * heat * fade);
}

/**
 * Light hugging the upper half of a circle of radius R at (x, y) (a dome's shock), falling off over width w.
 * box [x0, y0, x1, y1] (local) keeps it inside a canvas.
 */
function glowDome(p, x, y, R, w, c, k, box = [-Infinity, -Infinity, Infinity, Infinity]) {
  if (k <= 0.004 || w < 1) return;
  p.shade(Math.max(box[0], x - R - w), Math.max(box[1], y - R - w), Math.min(box[2], x + R + w), Math.min(box[3], y + 0.5), (px, py, out) => {
    const d = Math.abs(Math.hypot(px - x, py - y) - R) / w;
    if (d >= 1) return;
    out.l = c;
    out.k = (1 - d) * (1 - d) * k;
  });
}

/**
 * A burning thing's trail: pts [{ x, y, t }] (oldest first) at time t, drawn as a ribbon that is fire near the
 * head (fire ramp FR) and swells into thin smoke behind (smoke ramp SM, light to dark) over life seconds.
 */
function trail(p, pts, t, FR, SM, life = 0.5, w = 1, heat = 1) {
  let lx = NaN, ly = NaN;
  for (let i = pts.length - 1; i >= 0; i--) {
    const q = pts[i], age = (t - q.t) / life;
    if (age >= 1) break;
    if (Math.hypot(q.x - lx, q.y - ly) < 1.6) continue;
    lx = q.x;
    ly = q.y;
    const r = w * (0.7 + age * 2.6);
    if (age < 0.12 * heat) p.circle(q.x, q.y - age * 6, r * 0.8, FR[age < 0.05 ? 3 : 5]);
    else p.disc(q.x, q.y - age * 6, r, SM[Math.min(SM.length - 1, 1 + Math.floor(age * 3))], 0.55 * (1 - age));
  }
}

/**
 * Draw a particle system's GRIT as dirt in flight: fast bits stretch into short streaks (a darker tail, the bit at
 * the head), slow ones are the usual 1 or 2 px chips. The rest of the system draws as usual. layer as in draw.
 */
function drawDirt(p, ps, layer) {
  const all = ps.list, grit = [], rest = [];
  for (const q of all) (q.k === P.GRIT ? grit : rest).push(q);
  ps.list = rest;
  ps.draw(p, layer);
  ps.list = all;
  if (layer === "back") return;
  for (const q of grit) {
    if (q.delay > 0) continue;
    const k = q.life / q.max, sp = Math.hypot(q.vx, q.vy);
    if (k < 0.25 && k * 4 < 0.5) continue;
    if (sp > 140) {
      const L = Math.min(5, sp * 0.012), ux = q.vx / sp, uy = q.vy / sp;
      p.line(q.x - ux * L, q.y - uy * L, q.x, q.y, (u) => (u < 0.5 ? scale(q.col, 0.7) : q.col));
    } else {
      p.px(q.x, q.y, q.col);
      if (q.size >= 2) p.px(q.x + 1, q.y, q.col), p.px(q.x, q.y + 1, scale(q.col, 0.8)), p.px(q.x + 1, q.y + 1, scale(q.col, 0.7));
    }
  }
}

/**
 * A crater in the floor at x: a dark pit (an ellipse in perspective) with its far wall lit, dirt heaped in a lip on
 * either side, and loose earth scattered round it. E: an earth ramp (dark to bright, 5+ steps); r: half-width;
 * k: 0..1 how far it has opened; a: alpha (fade it out).
 */
function crater(p, E, x, r, k, a = 1) {
  if (k <= 0 || a <= 0) return;
  const n = E.length, rx = r * k, ry = Math.max(1.5, r * 0.17 * k);
  for (let py = -1; py <= Math.ceil(ry) + 1; py++)
    for (let px = Math.floor(-rx - 1); px <= Math.ceil(rx + 1); px++) {
      const dx = (px + 0.5) / rx, dy = (py + 0.5 - ry * 0.35) / ry, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1.08) continue;
      // the pit: darkest at its far side under the lit rim, the near wall a step lighter
      const c = d > 0.92 ? (dy < 0 ? E[n - 2] : E[2]) : dy < -0.2 ? E[0] : dy < 0.35 ? E[1] : E[2];
      p.dot(x + px, py, c, a);
    }
  // the lip: dirt heaped up either side, lit on top, and a scatter of loose earth
  for (const s of [-1, 1])
    for (let i = 0; i < 9; i++) {
      const u = i / 8, h = Math.round(Math.sin(Math.PI * u) * 2.2 * k + (rand(i, s > 0 ? 3 : 4) < 0.4 ? 1 : 0) * k);
      const hx = x + s * (rx * 0.82 + u * r * 0.55);
      for (let j = 0; j <= h; j++) p.dot(hx, -j, j === h ? E[n - 2] : j === h - 1 ? E[3] : E[2], a);
    }
  for (let i = 0; i < 26; i++) {
    const s = rand(i, 7) < 0.5 ? -1 : 1, d = rx * (1.05 + rand(i, 8) * 1.4), y = Math.round(rand(i, 9) * 3) - 1;
    if (rand(i, 10) < k) p.dot(x + s * d, y, rand(i, 11) < 0.5 ? E[3] : E[2], a);
  }
}

/** A hemisphere of white-hot air on the floor at x, radius r: an orange rim, a hot body, a white core; k 1 → 0 as it dies. */
function dome(p, F, x, r, k) {
  const e = 1.4 / r;
  p.shade(x - r - 1.5, -r - 1.5, x + r + 1.5, 0.5, (px, py) => {
    const d = Math.hypot(px - x, py) / r;
    if (d > 1 + e) return;
    return d > 1 ? F[2] : d > 0.8 ? (k > 0.45 ? F[6] : F[5]) : d > 0.5 ? (k > 0.45 ? WHITE : F[6]) : k > 0.2 ? WHITE : F[6];
  });
}

/**
 * A lobe of a billowing cloud, shaded like a ball. The sky lights it from the top left through the smoke ramp SM
 * (light to dark); fire (0..1) burns in its heart in the fire ramp FR (bright to dark), shrinking toward the
 * middle as it cools, with a darker band and a dark orange-red seam at its edge so a mass of burning lobes reads
 * apart; glow (0..1) lights its underside from below in fire colors. a: opacity (smoke edges stay soft); z: -1 far
 * .. 1 near (the far side sits a step darker); dark shifts the smoke down the ramp. style 1 cel-shades the smoke:
 * a lit crescent on top, a mid tone, a dark underside the fire tints while it's hot.
 */
function lobe(p, x, y, r, FR, SM, fire, glow, a, z = 0, dark = 0, style = 0) {
  if (r < 0.7 || a <= 0.01) return;
  const n = FR.length, m = SM.length, back = z < -0.35 ? 1 : 0, rim = 1 - Math.min(0.35, 1.6 / r), seam = 1 - Math.min(0.3, 1.3 / r);
  // the soft edge: a step more see-through than the body, less of a step as the whole lobe thins (no bubble rims)
  const D = (i) => SM[Math.min(m - 1, i + back + dark)], soft = 0.55 + 0.4 * (1 - Math.min(1, a));
  const px = (lx, ly, sx, sy) => {
    const dx = (lx - x) / r, dy = (ly - y) / r, d2 = dx * dx + dy * dy;
    if (d2 > 1) return;
    const d = Math.sqrt(d2), nz = Math.sqrt(1 - d2), sky = -0.5 * dx - 0.66 * dy + 0.56 * nz;
    const v = fire * (1.32 - 0.78 * d) + 0.14 * sky * fire;
    let c, k = 0, solid = false;
    if (v > 0.44) {
      let i = Math.min(n - 3, Math.max(0, Math.floor((1.3 - v) * (n - 1) * 0.78)));
      if (d > seam) i = Math.min(6, Math.max(4, i + 2));
      else if (d > seam - 0.22) i = Math.min(n - 3, i + 1);
      c = FR[i];
      k = 0.05 * fire;
      solid = true;
    } else if (style) {
      const lam = -0.42 * dx - 0.78 * dy + 0.46 * nz;
      if (lam > 0.66 && d > 0.4) c = D(0);
      else if (lam > 0.16) c = D(1);
      else if (lam > -0.3) c = D(2);
      else {
        c = D(lam < -0.64 ? 4 : 3);
        const g = glow * (0.6 + 0.4 * dy);
        if (g > 0.55) (c = FR[g > 0.8 ? 5 : 6]), (k = 0.08 * g);
        else if (g > 0.34) c = mix(c, FR[6], 0.6);
        else if (g > 0.16) c = mix(c, FR[7], 0.45);
      }
    } else {
      const g = glow * (0.82 * dy + 0.3 * nz);
      if (g > 0.45) (c = FR[g > 0.66 ? 4 : 5]), (k = 0.1 * glow);
      else if (g > 0.3) c = FR[6];
      else if (g > 0.2) c = FR[7];
      else {
        const s = sky * 0.5 + 0.5;
        c = D(s > 0.8 ? 0 : s > 0.62 ? 1 : s > 0.42 ? 2 : s > 0.22 ? 3 : 4);
      }
    }
    p.blendPx(sx, sy, c, solid || d <= rim ? a : a * soft);
    if (k > 0) p.add(sx, sy, c, k);
  };
  if (p.sn !== 0 || p.cs !== 1) return p.each(x - r, y - r, x + r, y + r, px);
  // unrotated (the usual case): walk the screen pixels directly
  const ax = p.tx + (x - r) * p.fx, bx = p.tx + (x + r) * p.fx;
  const sx0 = Math.max(p.ox, Math.floor(Math.min(ax, bx))), sx1 = Math.min(p.ox + p.w - 1, Math.ceil(Math.max(ax, bx)));
  const sy0 = Math.max(p.oy, Math.floor(p.ty + y - r)), sy1 = Math.min(p.oy + p.h - 1, Math.ceil(p.ty + y + r));
  for (let sy = sy0; sy <= sy1; sy++) {
    const ly = sy + 0.5 - p.ty, q = (ly - y) / r;
    if (q * q >= 1) continue;
    // only the span of this row inside the circle
    const hw = r * Math.sqrt(1 - q * q), cx = p.tx + x * p.fx;
    for (let sx = Math.max(sx0, Math.floor(cx - hw - 0.5)), e = Math.min(sx1, Math.ceil(cx + hw)); sx <= e; sx++) px((sx + 0.5 - p.tx) * p.fx, ly, sx, sy);
  }
}

/**
 * A rolling fireball. n lobes ride a vortex ring that climbs (rise px, slowing with time constant tau, then
 * drifting up at drift px/s), swells (tube and ring radii grow with time constant grow) and rolls (up through
 * the middle, out over the top, down the outside, back in underneath), while it cools from white-hot fire
 * into smoke that glows from inside, then thins away. Seen from a little below: the near side sits lower.
 * update(dt); draw(p, FR (fire ramp, bright to dark), SM (smoke ramp, light to dark), { mid }) (mid() is drawn
 * between the far and near lobes: a stem going up into it); shape() its centre and radii; hot() how hot its heart
 * still is; ember() how strongly its inside still glows. Options for a nuclear cap: style 1 (cel-shaded lobes),
 * inner (a glow that lingers inside and draws back to the middle as it cools), hollow (the underside sits a step
 * darker), fray [t0, rate, t1] with onFray(x, y, r, ux, uy) (the rim sheds small puffs late on).
 */
class Plume {
  constructor(R, o = {}) {
    this.o = o = {
      x: 0, y: -20, rise: 100, tau: 1.2, drift: 4, tube: [8, 20], ring: [1, 18], grow: 0.9, n: 40, size: [5, 10], swell: 0.5,
      spin: 2.4, spinTau: 1.6, heat: 1.15, cool: 0.45, under: 0.5, tilt: 0.2, squash: 0.7, fade: [4, 6], glow: 1, spread: 10,
      style: 0, inner: false, hollow: false, fray: null, ...o,
    };
    this.R = R;
    this.t = 0;
    this.roll = 0;
    this.onFray = null;
    // spread over the ring evenly: the roll angle on a golden-ratio walk, the turn round the axis in order
    this.lobes = Array.from({ length: o.n }, (_, i) => ({
      th: TAU * ((i * 0.618034 + R.range(-0.08, 0.08)) % 1), ph: (TAU * (i + R.range(-0.35, 0.35))) / o.n,
      j: R.range(-0.55, 0.12), s: R.range(o.size[0], o.size[1]), h: R.range(-0.22, 0.08), dx: R.range(-1, 1), dy: R.range(-1, 0.4),
      f: R.range(-0.9, 0.5), gv: R.range(0.55, 1.15),
    }));
  }
  shape(t = this.t) {
    const o = this.o, u = Math.max(0, t), g = 1 - Math.exp(-u / o.grow);
    return { x: o.x, y: o.y - o.rise * (1 - Math.exp(-u / o.tau)) - o.drift * u, tube: o.tube[0] + (o.tube[1] - o.tube[0]) * g, ring: o.ring[0] + (o.ring[1] - o.ring[0]) * g, g };
  }
  hot(t = this.t) {
    return clamp(this.o.heat - this.o.cool * t + 0.3);
  }
  /** How strongly the inside still glows (0..1), lingering well after the fire has gone. */
  ember(t = this.t) {
    return clamp((this.o.heat - this.o.cool * t + 1) / 1.1);
  }
  // where every lobe is at time t
  lobesAt(t) {
    const o = this.o, S = this.shape(t), base = o.heat - o.cool * t, span = S.ring + S.tube || 1, list = [];
    for (const q of this.lobes) {
      const fade = 1 - smooth(o.fade[0] + q.f, o.fade[1] + q.f * 0.5, t), loose = Math.pow(smooth(o.fade[0] - 1.8 + q.f, o.fade[1], t), 1.5) * o.spread;
      if (fade <= 0) continue;
      const th = q.th - this.roll, rt = S.tube * (1 + q.j), rho = S.ring + rt * Math.cos(th), up = Math.sin(th);
      const X = rho * Math.cos(q.ph), Z = rho * Math.sin(q.ph);
      // the outside cools first; the underside keeps its heat, fed from below
      const heat = base + q.h - 0.18 * Math.max(0, Math.cos(th)) * clamp(t * 2) + o.under * Math.max(0, -up) * clamp(base + 0.6);
      const r = q.s * (0.5 + 0.5 * S.g) * (1 + o.swell * clamp(1 - heat)) * (1 + 0.35 * (1 - fade));
      list.push({ x: S.x + X + q.dx * loose, y: S.y - rt * up * o.squash + Z * o.tilt + q.dy * loose, z: Z / span, up, out: Math.cos(th), heat, q, fade, r, d: Math.hypot(X, Z) / span, c: 1 - Math.min(1, Math.abs(X) / span) });
    }
    return list.sort((a, b) => a.z - b.z);
  }
  update(dt) {
    const o = this.o;
    this.t += dt;
    this.roll += o.spin * (0.12 + 0.88 * Math.exp(-this.t / o.spinTau)) * dt;
    // late on, the rim frays: lobes on the outside shed small puffs that drift off and thin
    if (o.fray && this.onFray && this.t > o.fray[0] && this.t < (o.fray[2] ?? Infinity)) {
      const S = this.shape(), k = o.fray[1] * dt * smooth(o.fray[0], o.fray[0] + 1, this.t);
      for (const e of this.lobesAt(this.t)) {
        if (e.out < 0.2 || !this.R.chance(k * e.fade)) continue;
        const ux = e.x - S.x, uy = e.y - S.y, l = Math.hypot(ux, uy) || 1;
        this.onFray(e.x + (ux / l) * e.r * 0.6, e.y + (uy / l) * e.r * 0.6, e.r, ux / l, uy / l);
      }
    }
  }
  draw(p, FR, SM, { mid } = {}) {
    const o = this.o, t = this.t;
    if (t >= o.fade[1] + 0.5) return;
    const S = this.shape(t), base = o.heat - o.cool * t, span = S.ring + S.tube || 1, list = this.lobesAt(t), age = clamp(t / o.fade[1]);
    const E = this.ember(t), reach = 0.3 + 1.15 * E;
    let drawn = false;
    for (const e of list) {
      if (!drawn && e.z >= 0 && mid) (drawn = true), mid();
      const h = e.heat, fade = e.fade, fire = clamp((h - 0.2) / 0.75);
      // the glow from inside: strongest under the middle, uneven from lobe to lobe; with inner, it draws back to the
      // middle as the cap cools
      const glow = o.inner
        ? E * clamp((reach - e.d) / 0.45) * (0.45 + 0.55 * Math.max(0, -e.up)) * e.q.gv * o.glow
        : clamp((base + 0.45) / 0.85) * o.glow * (0.4 + 0.35 * Math.max(0, -e.up) + 0.4 * e.c) * e.q.gv;
      lobe(p, e.x, e.y, e.r, FR, SM, fire, glow, fade * (0.82 + 0.18 * fire), e.z, (age > 0.72 ? 1 : 0) + (o.hollow && e.up < -0.35 ? 1 : 0), o.style);
      if (fire > 0.25) p.glow(e.x, e.y, e.r * 1.25 + 2, FR[2], 0.07 * fire);
    }
    if (!drawn && mid) mid();
    const hot = this.hot(t);
    if (hot > 0) p.glow(S.x, S.y, span * 1.8 + 14, FR[3], 0.32 * hot * o.glow);
    if (o.inner && E > 0.05) p.glow(S.x, S.y + S.tube * 0.3, span * (0.5 + 0.7 * E) + 8, FR[4], 0.22 * E * E);
  }
}

/**
 * A rising column: lobes boil up a stem from the floor into whatever sits on top, wide at the foot, swaying,
 * cooling from fire to smoke and dust. update(dt, top, feed): top is the y the stem rises to, feed 0..1 how
 * strongly it's still being fed (new lobes stop when it's 0, and the stem breaks up from the bottom).
 * draw(p, FR, SM, fire (0..1 heat at the foot), glow (0..1 under-light)).
 */
class Column {
  constructor(R, o = {}) {
    this.R = R;
    this.o = o = { w: 7, foot: 16, speed: 70, size: [5, 8], n: 18, sway: 2.5, fade: 0.5, style: 0, ...o };
    this.t = 0;
    this.lobes = [];
    this.acc = 0;
  }
  spawn(y) {
    const R = this.R, o = this.o;
    this.lobes.push({ y, x: R.range(-1, 1), s: R.range(o.size[0], o.size[1]), ph: R.range(0, TAU), a: 0, v: R.range(0.8, 1.2) });
  }
  update(dt, top, feed) {
    const o = this.o, L = Math.max(10, -top);
    this.t += dt;
    if (feed > 0) for (this.acc += dt * feed * o.n * (o.speed / L); this.acc > 1; this.acc--) this.spawn(-1);
    for (let i = this.lobes.length - 1; i >= 0; i--) {
      const b = this.lobes[i], u = clamp(-b.y / L);
      b.y -= o.speed * b.v * (0.45 + 0.55 * Math.min(1, -b.y / 24)) * dt;
      b.a = Math.min(1, b.a + dt * 4);
      if (b.y < top || (feed <= 0 && (b.a -= dt * (2 - u)) <= 0)) this.lobes.splice(i, 1);
    }
  }
  draw(p, top, FR, SM, fire, glow) {
    const o = this.o, L = Math.max(10, -top);
    // draw from the top down so the foot sits in front
    const list = [...this.lobes].sort((a, b) => a.y - b.y);
    for (const b of list) {
      const u = clamp(-b.y / L), foot = Math.pow(1 - u, 4), w = o.w + o.foot * foot;
      const x = b.x * w * 0.45 + Math.sin(this.t * 1.7 + b.ph + u * 3) * o.sway * u;
      const r = b.s * (0.75 + 0.5 * foot + 0.35 * u) * Math.min(1, b.a * 1.5);
      const end = 1 - smooth(0.85, 1, u);
      lobe(p, x, b.y - r * 0.3 * foot, r, FR, SM, clamp(fire * (1.1 - u * 0.9)), glow * smooth(0.55, 1, u), Math.min(1, b.a) * end * 0.9, 0, u > 0.5 ? 0 : 1, o.style);
    }
  }
}

exports.stone = stone;
exports.fireBall = fireBall;
exports.drawPs = drawPs;
exports.draft = draft;
exports.cull = cull;
exports.fadeEdges = fadeEdges;
exports.pool = pool;
exports.haze = haze;
exports.scorch = scorch;
exports.rock = rock;
exports.glowDome = glowDome;
exports.trail = trail;
exports.drawDirt = drawDirt;
exports.crater = crater;
exports.dome = dome;
exports.lobe = lobe;
exports.Plume = Plume;
exports.Column = Column;
exports.OUTLINE = OUTLINE;
exports.SOOT = SOOT;
exports.SOOT2 = SOOT2;
exports.fireRamp = fireRamp;
exports.heatRamp = heatRamp;
  };
  __mods["fx/fire/flame-pillar.js"] = function(exports, __req) {
// The flame-puff, smoke, spark, debris and floor-ring recipe is adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), and the column's levels, pulses and strands from its
// holy light (https://www.spritefusion.com/pixel-art-vfx/holy-light), MIT License, Copyright (c) 2026 Hugo Duprez.
const {  Particles, Bits, Lights, P, PF, B, Rng, fit, band, clamp, smooth, ease, noise, rand, TAU, WHITE, hex, mix, scale, rgb  } = __req("core/index.js");
const {  hotFirst, flameTongue, simDraw, floorLight, LAYERS  } = __req("fx/fire/_lib.js");

const meta = {
  name: "Flame pillar",
  desc: "The floor cracks and glows, a column of fire erupts white-hot and roars, spewing embers and shedding flame, then collapses into rolling smoke.",
  tags: ["fire", "pillar", "eruption", "spell", "ground", "one-shot"],
  size: [184, 256],
  origin: [92, 232],
  duration: 5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    stone: "#4a3f69",
    height: 140,
    seed: 5,
  },
};

const ERUPT = 0.55, RISE = 0.12, FALL = 1.95, GONE = 2.45, SOOT = hex("#0d0a12"), OUTLINE = hex("#1a1422"), WARM = rgb(255, 176, 96);

function stone(c) {
  c = hex(c);
  return { light: mix(scale(c, 1.35), WHITE, 0.08), body: c, shade: scale(c, 0.64), dust: mix(scale(c, 1.2), rgb(150, 140, 150), 0.3) };
}
function rock(p, b, st) {
  const r = 0.6 + b.s * 0.75, fade = Math.min(1, b.life / 0.5), lx = Math.cos(b.a) * r * 0.4, ly = Math.sin(b.a) * r * 0.4;
  p.shade(b.x - r - 1, b.y - r - 1, b.x + r + 1, b.y + r + 1, (x, y, out) => {
    const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx * 1.15, dy);
    if (d > r + 0.9) return;
    const lit = dx * lx + dy * ly;
    out.c = d > r ? OUTLINE : lit < -0.4 ? st.light : lit > 0.6 ? st.shade : st.body;
    out.a = fade;
  });
}

function create(o) {
  const F = fit(o.palette, 9), H = hotFirst(F), HMAX = o.height, st = stone(o.stone), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [H[1], H[2], H[4], H[5]] });
  const bits = new Bits({ ground: floor }), lights = new Lights();
  const GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.25), S = o.seed * 13;
  // the cracks: jagged lines racing out from the middle across the floor (squashed for perspective), with branches
  const cracks = [];
  const crack = (x, y, a, len, t0, w) => {
    const pts = [[x, y]];
    for (let d = 0; d < len; d += 2) (a += R.range(-0.55, 0.55)), (x += Math.cos(a) * 2), (y += Math.sin(a) * 0.76), pts.push([x, y]);
    cracks.push({ pts, t0, grow: R.range(0.22, 0.36), w });
    return pts;
  };
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + R.range(-0.25, 0.25), pts = crack(R.range(-1, 1), R.range(-0.3, 0.3), a, R.range(20, 40), R.range(0, 0.16), 1);
    const j = 3 + R.int(0, pts.length - 6);
    if (pts.length > 8) crack(pts[j][0], pts[j][1], a + R.sign() * R.range(0.5, 1), R.range(6, 14), 0.18 + R.range(0, 0.15), 0);
  }
  // strands of hotter flame running up the column
  const strands = Array.from({ length: 7 }, (_, i) => ({ o: (rand(i, S, 1) - 0.5) * 1.4, w: 0.05 + rand(i, S, 2) * 0.06, f: 1 + rand(i, S, 3) * 2 }));
  let t = 0, erupted = false, fell = false;

  const height = (tt) => (tt < ERUPT ? 0 : tt < ERUPT + RISE ? HMAX * ease.outCubic((tt - ERUPT) / RISE) : tt < FALL ? HMAX * (1 + 0.05 * noise(tt * 3, S)) : HMAX * (1 - ease.inQuad(clamp((tt - FALL) / (GONE - FALL)))));
  const width = (tt) => (tt < ERUPT ? 0 : tt < FALL ? 12 * (1 + 0.45 * Math.exp(-(tt - ERUPT) * 7)) * (0.94 + 0.06 * noise(tt * 9, S + 1)) : 12 * (1 - smooth(FALL, GONE, tt)) + 1.5 * (1 - smooth(GONE - 0.1, GONE, tt)));
  const heat = (tt) => smooth(0, ERUPT, tt) * 0.75 + 0.25 * smooth(ERUPT - 0.05, ERUPT + 0.1, tt) - smooth(GONE - 0.3, meta.duration - 0.6, tt) * 1.05;

  function column(p) {
    const h = height(t), w0 = width(t);
    if (h < 1 || w0 < 0.3) return;
    // a crown of tongues where the column breaks into the air, drawn first so the column flows up into them
    if (t < FALL + 0.25) {
      const k = clamp(w0 / 12), NZ = (rate, seed, off) => noise(t * rate + off, seed);
      for (let i = 0; i < 5; i++) {
        const n = (S + i) * 17, dx = (i - 2) * w0 * 0.4, th = (12 + 12 * (0.5 + 0.5 * noise(t * 3.3 + i, n))) * k * (i === 2 ? 1.2 : i % 4 === 0 ? 0.6 : 0.9);
        flameTongue(p, dx + noise(t * 2, n + 2) * 1.5, -h + 12, th, 3.4 * k * (i % 4 === 0 ? 0.7 : 1), -dx * 0.3 + noise(t * 2.2, n + 1) * 3, NZ, n, H, LAYERS);
      }
    }
    const lvlC = [H[0], H[1], H[2], H[3], H[4], H[5], H[6], H[7]];
    for (let y = 0; y >= -h; y--) {
      const v = -y / h, cx = noise(-y * 0.04 + t * 1.6, S + 2) * 1.6 * v;
      // licks bulge out of the sides and run up them; a wider splash at the foot; the top thins into tongues
      const foot = 1 + 0.7 * Math.max(0, 1 - -y / 12) ** 2, top = 1 - smooth(0.82, 1, v) * 0.7;
      const wl = w0 * foot * top * (1 + 0.65 * Math.max(0, noise(y * 0.2 + t * 8, S + 3)) ** 1.5), wr = w0 * foot * top * (1 + 0.65 * Math.max(0, noise(y * 0.2 + t * 8, S + 4)) ** 1.5);
      const pulse = ((-y * 0.032 + t * 3.6) % 1) < 0.09 ? 1 : 0;
      for (let x = Math.floor(cx - wl * 1.15); x <= Math.ceil(cx + wr * 1.15); x++) {
        const dx = x + 0.5 - cx, q = Math.abs(dx) / (dx < 0 ? wl : wr);
        if (q > 1.15) continue;
        let lvl = q < 0.12 ? 0 : q < 0.26 ? 1 : q < 0.42 ? 2 : q < 0.56 ? 3 : q < 0.7 ? 4 : q < 0.84 ? 5 : q < 0.96 ? 6 : 7;
        for (const s of strands) if (Math.abs(dx / w0 - s.o - 0.06 * Math.sin(t * s.f * 3 + s.o * 9)) < s.w) lvl = Math.max(0, lvl - 1);
        lvl = Math.max(0, lvl - pulse);
        if (lvl === 7 && rand(x, y, Math.floor(t * 20)) < 0.5) continue;
        p.px(x, y, lvlC[lvl]);
      }
      if (y % 12 === 0) p.glow(cx, y, w0 * 2.4 + 8, GLOW, 0.28 * clamp(w0 / 12));
    }
    p.glow(0, -h * 0.45, 92, GLOW, 0.3 * clamp(w0 / 12));
  }

  function cracksDraw(p) {
    const k = heat(t);
    if (k <= -0.05) return;
    for (const c of cracks) {
      const n = Math.floor(c.pts.length * clamp((t - c.t0) / c.grow));
      for (let i = 1; i < n; i++) {
        const u = i / c.pts.length, hot = k * (1 - 0.45 * u), [x0, y0] = c.pts[i - 1], [x1, y1] = c.pts[i];
        if (hot < 0) {
          // cooled: soot that fades away
          const a = 1 + hot * 3;
          if (a > 0) p.line(x0, y0, x1, y1, SOOT, a);
          continue;
        }
        const col = hot > 0.85 ? H[1] : hot > 0.65 ? H[2] : hot > 0.45 ? H[4] : hot > 0.25 ? H[5] : hot > 0.1 ? H[6] : H[7];
        // the crack: a hot seam with a darker glowing lip, wider near the middle
        if (c.w && i < c.pts.length * 0.5 && hot > 0.2) p.line(x0, y0 + 1, x1, y1 + 1, hot > 0.6 ? H[5] : H[6]), p.line(x0, y0 - 1, x1, y1 - 1, H[7]);
        p.line(x0, y0, x1, y1, col);
        if (i % 2 === 0) p.glow(x1, y1, 5 + 7 * hot, GLOW, 0.3 * hot);
      }
    }
    // the floor glows from beneath while it's hot
    if (k > 0) floorLight(p, 0, 0.5, 44, 8, GLOW, 0.35 * k);
  }

  return {
    update(dt) {
      t += dt;
      // the charge: the crust in the middle glows, little flames lick out of it, heat leaks up the cracks
      if (t < ERUPT && R.chance(0.6 * dt * 60 * smooth(0.15, ERUPT, t))) ps.spawn(P.FIRE, R.range(-5, 5), -1, R.range(-6, 6), -R.range(20, 45), R.range(0.15, 0.3), 0, R.range(1, 2.2));
      if (t < ERUPT && R.chance(0.5 * dt * 60 * smooth(0, ERUPT, t))) {
        const c = R.pick(cracks), i = R.int(0, Math.floor(c.pts.length * clamp((t - c.t0) / c.grow)) - 1);
        if (i >= 0) {
          const [x, y] = c.pts[i];
          if (R.chance(0.5)) ps.spawn(P.FIRE, x, y - 1, R.range(-5, 5), -R.range(15, 35), R.range(0.15, 0.3), 0, R.range(0.8, 1.6));
          else ps.spawn(P.EMBER, x, y - 1, R.range(-15, 15), -R.range(30, 70), R.range(0.5, 1), H[3], 1);
        }
      }
      if (!erupted && t >= ERUPT) {
        erupted = true;
        lights.add(0, -40, 90, WARM, 0.7, 0.6);
        lights.add(0, -8, 44, WHITE, 0.7, 0.1);
        for (let i = 0; i < 70; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(100, 260);
          ps.spawn(P.SPARK, R.range(-4, 4), -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.25, 0.7));
        }
        for (let i = 0; i < 18; i++) bits.add({ kind: B.CHUNK, x: R.range(-6, 6), y: -2, vx: R.range(-110, 110), vy: -R.range(150, 330), g: 1, drag: 0.4, bounce: 0.3, life: R.range(1.6, 2.4), a: R.range(0, TAU), va: R.range(-16, 16), s: R.int(1, 3) });
        for (let i = 0; i < 60; i++) {
          const a = -Math.PI / 2 + R.range(-0.9, 0.9), sp = R.range(80, 260);
          ps.spawn(P.GRIT, R.range(-5, 5), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1, 1.8), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.4) ? 2 : 1);
        }
        for (let i = 0; i < 14; i++) {
          const s = R.sign();
          ps.spawn(P.SMOKE, s * R.range(2, 10), -R.range(1, 4), s * R.range(40, 110), -R.range(2, 10), R.range(1, 1.8), st.dust, R.range(4, 7), R.range(0, 0.06), PF.BIG);
        }
      }
      // the roar: flame shed off the sides, a billowing cap, embers spewed high
      const h = height(t), w = width(t);
      if (t > ERUPT && t < GONE && h > 4) {
        if (R.chance(0.9 * dt * 60)) {
          const s = R.sign(), y = -R.range(4, h * 0.9);
          ps.spawn(P.FIRE, s * w * R.range(0.7, 1.1), y, s * R.range(15, 40), -R.range(30, 70), R.range(0.25, 0.5), 0, R.range(1.6, 3.2), 0, R.chance(0.35) ? PF.SMOKES : 0);
        }
        if (R.chance(0.7 * dt * 60)) ps.spawn(P.FIRE, R.range(-w, w), -h + R.range(0, 6), R.range(-20, 20), -R.range(30, 80), R.range(0.35, 0.7), 0, R.range(3, 5.5), 0, R.chance(0.6) ? PF.SMOKES | (t < FALL - 0.3 ? PF.BIG : 0) : 0);
        if (t < FALL && R.chance(0.5 * dt * 60)) ps.spawn(P.EMBER, R.range(-w, w) * 0.6, -h + 4, R.range(-60, 60), -R.range(50, 110), R.range(0.7, 1.3), H[3], R.chance(0.2) ? 2 : 1);
      }
      // the collapse: the falling top breaks into puffs that roll off as smoke
      if (t >= FALL && !fell) fell = true;
      if (fell && t < GONE - 0.1 && R.chance(1.6 * dt * 60)) ps.spawn(P.FIRE, R.range(-w - 2, w + 2), -h - R.range(0, 8), R.range(-30, 30), -R.range(10, 50), R.range(0.4, 0.75), 0, R.range(3.5, 6.5), 0, PF.SMOKES);
      bits.update(dt);
      for (const b of bits.list)
        if (b.rest && !b.dusted) {
          b.dusted = true;
          for (let i = 0; i < 3; i++) ps.spawn(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, R.sign() * R.range(8, 35), -R.range(2, 18), R.range(0.3, 0.6), st.dust, R.range(1.3, 2.6));
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      cracksDraw(p);
      simDraw(p, ps, H, "back");
      const k = (t - ERUPT) / 0.45;
      if (k > 0 && k < 1) band(p, 0, 0.5, 84 * ease.outCubic(k), 0.18, Math.max(1, 4 * (1 - k)), 1.15 - k, [st.body, st.light, H[4], H[1]], (g) => Math.sin(g) < 0);
    },
    draw(p) {
      column(p);
      for (const b of bits.list) rock(p, b, st);
      simDraw(p, ps, H, "front");
      const k = (t - ERUPT) / 0.45;
      if (k > 0 && k < 1) band(p, 0, 0.5, 84 * ease.outCubic(k), 0.18, Math.max(1, 4 * (1 - k)), 1.15 - k, [st.body, st.light, H[4], H[1]], (g) => Math.sin(g) >= 0, k < 0.15);
      // the eruption's white flash at the foot
      const f = (t - ERUPT) / 0.08;
      if (f > 0 && f < 1) {
        p.ellipse(0, -2, 16 * (1 - f * 0.3), 6, H[2]);
        p.ellipse(0, -3, 11 * (1 - f * 0.3), 4, f < 0.5 ? WHITE : H[1]);
      }
      lights.draw(p);
    },
  };
}

exports.create = create;
exports.meta = meta;
  };
  __mods["fx/fire/_lib.js"] = function(exports, __req) {
// Shared by the fire effects (the leading _ keeps the tools from listing it as an effect).
// Flame tongues, licks, flame puffs that cool into smoke, embers and sparks, with their motion in closed form so
// looping effects can draw them from t alone and stay seamless. The tongue, lick, puff, smoke, ember and spark
// recipes are adapted from Sprite Fusion's open-source fire (https://www.spritefusion.com/pixel-art-vfx/fire),
// MIT License, Copyright (c) 2026 Hugo Duprez.

const {  rand, rng, wrap, noise, mix, hex, clamp, WHITE, SMOKE_RAMP, P, PF  } = __req("core/index.js");

/** Smooth value noise in [-1, 1] that repeats every `period` cells (a whole number). */
function pnoise(x, period, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const a = rand(wrap(i, period), seed), b = rand(wrap(i + 1, period), seed);
  return (a + (b - a) * u) * 2 - 1;
}

/**
 * Noise for a loop D seconds long: N(tt, rate, seed, off) wobbles about `rate` times a second and is the same at
 * tt and tt + D. Pass D = 0 for one-shots (plain noise, no repeat).
 */
function noiseFor(D) {
  if (!D) return (tt, rate, seed = 0, off = 0) => noise(tt * rate + off, seed);
  return (tt, rate, seed = 0, off = 0) => {
    const P = Math.max(1, Math.round(rate * D));
    return pnoise((tt / D) * P + off, P, seed);
  };
}

/**
 * Seamless particles for a loop D seconds long: count particles, each born at its own phase and reborn every D.
 * make(r, i) builds particle i from its own rng (the same every frame) and returns it with a .life (which may
 * be longer than D); draw(q, age, i) is called for every live copy.
 */
function looped(t, D, count, seed, make, draw) {
  for (let i = 0; i < count; i++) {
    const r = rng(seed, i), born = r.next() * D, q = make(r, i);
    for (let age = wrap(t - born, D); age < q.life; age += D) draw(q, age, i);
  }
}

/** Hugo's flicker, 0.74 to 1: a slow breath and a fast crackle. N(rate, seed) at the current time. */
const flicker = (N, s = 0) => 0.74 + 0.16 * N(7.3, 1 + s) + 0.1 * N(19, 2 + s);

/** A fire ramp hot-first (H[0] white .. H[8] smouldering) from a palette dark to bright, any length. */
const hotFirst = (F) => [...F].reverse();

/** Tongue layers [width share, height share, step of the hot-first ramp]: red rim, orange, yellow, white heart. */
const LAYERS = [[1, 1, 6], [0.76, 0.86, 4], [0.54, 0.68, 2], [0.3, 0.42, 0]];

/** Layers for big tongues: more orange and a smaller white heart, so the light doesn't wash them out. */
const BIG_LAYERS = [[1, 1, 6], [0.8, 0.9, 5], [0.62, 0.78, 4], [0.44, 0.6, 3], [0.26, 0.4, 1], [0.12, 0.22, 0]];

/** The same layers a step cooler, for flames further back: dark red rim, deep orange, gold, yellow. */
const BACK_LAYERS = [[1, 1, 7], [0.76, 0.86, 5], [0.54, 0.68, 3], [0.3, 0.42, 2]];

/**
 * A flame tongue standing at (x, y), h tall, w its half-width at the base, its tip swept sx px sideways: a red
 * rim round orange round yellow round a white heart, every row's width and centre jittered by noise so the
 * edges crackle. N(rate, seed, off) is the effect's noise at this frame; n seeds this tongue. H: hot-first ramp.
 * jit: how far the edges crackle (px); wob: how far the tip wanders (px).
 */
function flameTongue(p, x, y, h, w, sx, N, n, H, layers = LAYERS, jit = 0.5, wob = 1.1) {
  if (h < 1) return;
  for (const [lw, lh, ri] of layers) {
    const L = h * lh, c = H[ri];
    for (let r = 0; r <= L; r++) {
      const u = r / Math.max(1, L);
      const half = w * lw * Math.pow(1 - u, 0.85) * Math.min(1, (r + 1.5) / 3.5) + N(9, n, r * 0.45) * jit;
      if (half < 0.3) continue;
      const cx = x + sx * u * u * lh + N(4, n + 7, r * 0.2) * u * wob, Y = Math.round(y - r);
      for (let px = Math.round(cx - half), x1 = Math.round(cx + half); px <= x1; px++) p.px(px, Y, c);
    }
  }
}

/**
 * The same tongue lying along any direction (ux, uy) from its root (x, y): for jets, breath and comet tails.
 * len long, w half-width at the root, bend: px the tip is swept sideways (to the left of the direction).
 */
function flameBlade(p, x, y, ux, uy, len, w, bend, N, n, H, layers = LAYERS, jit = 0.5, wob = 1.1) {
  if (len < 1) return;
  const nx = -uy, ny = ux;
  for (const [lw, lh, ri] of layers) {
    const L = len * lh, c = H[ri];
    for (let r = 0; r <= L; r += 0.5) {
      const u = r / Math.max(1, L);
      const half = w * lw * Math.pow(1 - u, 0.85) * Math.min(1, (r + 1.5) / 3.5) + N(9, n, r * 0.45) * jit;
      if (half < 0.3) continue;
      const off = bend * u * u * lh + N(4, n + 7, r * 0.2) * u * wob, cx = x + ux * r + nx * off, cy = y + uy * r + ny * off;
      for (let q = -half; q <= half; q += 0.5) p.px(cx + nx * q, cy + ny * q, c);
    }
  }
}

/** A solid disc drawn straight in screen space (fast; a disc looks the same mirrored or turned). */
function solid(p, x, y, r, c) {
  if (r < 0.6) return p.px(x, y, c);
  const cx = p.toX(x, y), cy = p.toY(x, y), r2 = r * r;
  for (let sy = Math.floor(cy - r); sy <= Math.ceil(cy + r); sy++) {
    const dy = sy + 0.5 - cy, s2 = r2 - dy * dy;
    if (s2 < 0) continue;
    const s = Math.sqrt(s2);
    for (let sx = Math.ceil(cx - s - 0.5); sx <= Math.floor(cx + s - 0.5); sx++) p.put(sx, sy, c, 1);
  }
}

/** A translucent disc in screen space: smoke and haze. */
function soft(p, x, y, r, c, a) {
  if (a <= 0.004) return;
  if (r < 0.5) return p.blend(x, y, c, a);
  const cx = p.toX(x, y), cy = p.toY(x, y), r2 = r * r;
  for (let sy = Math.floor(cy - r); sy <= Math.ceil(cy + r); sy++) {
    const dy = sy + 0.5 - cy, s2 = r2 - dy * dy;
    if (s2 < 0) continue;
    const s = Math.sqrt(s2);
    for (let sx = Math.ceil(cx - s - 0.5); sx <= Math.floor(cx + s - 0.5); sx++) p.blendPx(sx, sy, c, a);
  }
}

/**
 * A ball of flame with life left k (1 new, 0 gone) cooling down the hot-first ramp H as it ages: a darker rim,
 * a lit core up and to the left, a little tongue on top, a hot heart while it's young, and its light.
 * frac (0..1) nudges how hot it starts. (tx, ty): which way its tongue points (up, unless it's streaming).
 */
function firePuff(p, x, y, k, size, frac, H, glowK = 0.18, tx = 0, ty = -1) {
  const age = 1 - k, n = H.length, heat = Math.min(0.999, Math.pow(age, 0.62) + frac * 0.1);
  const idx = Math.min(n - 2, Math.floor(heat * (n - 1)));
  const r = size * (0.55 + 0.45 * Math.min(1, age * 7)) * (1 - age * 0.55), c = H[idx];
  if (idx >= n - 2) return soft(p, x, y, r, c, Math.min(1, k * 3) * 0.85);
  solid(p, x, y, r, H[Math.min(n - 1, idx + 2)]);
  if (r > 1.6 && ty > -0.99) solid(p, x + tx * r * 1.5, y + ty * r * 1.5, r * 0.3, H[Math.min(n - 1, idx + 1)]);
  solid(p, x - r * 0.16, y - r * 0.22, r * 0.78, c);
  if (r > 1.6) solid(p, x + tx * r * 0.9, y + ty * r * 0.9, r * 0.42, c);
  if (idx <= 3 && r > 1.8) solid(p, x - r * 0.28, y - r * 0.34, r * 0.36, H[Math.max(0, idx - 1)]);
  if (idx < 6) p.glow(x, y, r * 2.4 + 2, c, glowK * k);
}

/** A lick: a blob of flame torn off a tongue's tip, a red rim round a yellow heart, shrinking as it rises. */
function lick(p, x, y, k, s, H) {
  const r = s * (0.4 + 0.6 * k);
  solid(p, x, y, r + 0.6, k > 0.5 ? H[5] : H[6]);
  if (k > 0.35) solid(p, x, y - 0.3, r * 0.6, k > 0.7 ? H[2] : H[4]);
}

const rampAt = (r, t) => r[Math.min(r.length - 1, Math.max(0, Math.floor(t * r.length)))];

/**
 * A puff of smoke with life left k: three soft discs (a body, a denser core sitting low, a lit cap while it's
 * young), swelling and thinning. col tints it (0 for plain smoke); big for slower, fuller smoke.
 */
function smokePuff(p, x, y, k, size, col = 0, big = false, aMul = 1) {
  const age = 1 - k;
  const r = size * (0.65 + Math.min(1, age * 2.5) * 0.45 + age * (big ? 0.5 : 0.4));
  const a = Math.min(1, age * 12) * Math.min(1, k * 2.4) * (big ? 0.7 : 0.58) * aMul;
  const c = col ? mix(col, rampAt(SMOKE_RAMP, age), age) : rampAt(SMOKE_RAMP, age * 1.05);
  soft(p, x, y, r, c, a * 0.45);
  soft(p, x + r * 0.05, y + r * 0.06, r * 0.74, c, a * 0.62);
  if (age < 0.5) soft(p, x - r * 0.22, y - r * 0.3, r * 0.5, mix(c, WHITE, 0.12), a * 0.4 * (1 - age * 2));
}

/**
 * An ember with life left k: a hot pixel cooling through cols [hot, warm, cool, rim], flickering out near the
 * end (ph: its flicker phase), with its own light. Big ones (size 2) are a little cross with a darker rim.
 */
function ember(p, x, y, k, size, cols, ph) {
  if (k < 0.25 && Math.sin(ph) < 0) return;
  const c = k > 0.6 ? cols[0] : k > 0.3 ? cols[1] : cols[2];
  if (size >= 2) {
    const rim = k > 0.45 ? cols[2] : cols[3];
    p.px(x - 1, y, rim), p.px(x + 1, y, rim), p.px(x, y - 1, rim), p.px(x, y + 1, rim);
    p.px(x, y, c);
    p.glow(x, y, 8, c, 0.4 * k);
    return;
  }
  p.px(x, y, c);
  if (size > 1.4) p.px(x, y + 1, cols[3]);
  p.glow(x, y, 3 + size, c, 0.35 * k);
}

/** A spark: a streak stretched along its velocity, a hot head and a cooler tail, and a point of light. */
function spark(p, x, y, vx, vy, k, cols) {
  const sp = Math.hypot(vx, vy) || 1, ux = vx / sp, uy = vy / sp, len = Math.min(9, 1 + sp * 0.022);
  const head = k > 0.6 ? cols[0] : k > 0.3 ? cols[1] : cols[2];
  p.line(x - ux * len, y - uy * len, x - ux * len * 0.4, y - uy * len * 0.4, k > 0.5 ? head : cols[cols.length - 1]);
  p.line(x - ux * len * 0.45, y - uy * len * 0.45, x, y, head);
  p.glow(x, y, 3, head, 0.45 * k);
}

function along(x, v, a, k, t) {
  if (k <= 0) return [x + v * t + 0.5 * a * t * t, v + a * t];
  const e = Math.exp(-k * t), vt = a / k;
  return [x + vt * t + ((v - vt) * (1 - e)) / k, vt + (v - vt) * e];
}

/**
 * Where a body is t seconds after launch from (x, y) at (vx, vy), under acceleration (ax, ay) px/s² and linear
 * drag kx, ky (1/s): [x, y, vx, vy]. The particle kinds' own numbers: FIRE (0, -95, 5, 3.2), SMOKE
 * (0, -16, 1.6, 1.2), EMBER (0, -30, 1.6, 1.6), SPARK (0, 427, 2.2, 2.2).
 */
function drift(x, y, vx, vy, t, ax, ay, kx, ky) {
  const X = along(x, vx, ax, kx, t), Y = along(y, vy, ay, ky, t);
  return [X[0], Y[0], X[1], Y[1]];
}

/** A spark's flight: falls, drags, and bounces off the floor at y = floor, losing speed each time. */
function sparkAt(x, y, vx, vy, t, floor = 0, g = 427, k = 2.2) {
  let s = [x, y, vx, vy], left = t;
  for (let b = 0; b < 3; b++) {
    const e = drift(s[0], s[1], s[2], s[3], left, 0, g, k, k);
    if (e[1] < floor || s[1] >= floor) return e;
    let lo = 0, hi = left;
    for (let i = 0; i < 16; i++) {
      const m = (lo + hi) / 2;
      if (drift(s[0], s[1], s[2], s[3], m, 0, g, k, k)[1] < floor) lo = m;
      else hi = m;
    }
    const c = drift(s[0], s[1], s[2], s[3], hi, 0, g, k, k);
    s = [c[0], floor - 0.25, c[2] * 0.7, -Math.abs(c[3]) * 0.45];
    left -= hi;
  }
  const e = drift(s[0], s[1], s[2], s[3], left, 0, g, k, k);
  return e[1] < floor ? e : [e[0], floor - 0.25, e[2], 0];
}

/** A pool of light on the floor: an ellipse of glow, k at its middle falling to 0 at its rim. */
function floorLight(p, x, y, rx, ry, c, k) {
  if (k <= 0.004 || rx < 1 || ry < 0.5) return;
  p.shade(x - rx, y - ry, x + rx, y + ry, (px, py, out) => {
    const dx = (px - x) / rx, dy = (py - y) / ry, d = dx * dx + dy * dy;
    if (d >= 1) return;
    const f = 1 - Math.sqrt(d);
    out.l = c;
    out.k = f * f * k;
  });
}

/**
 * A core Particles system drawn with its flame puffs recoloured down the hot-first ramp H (the core draws them
 * in its own fire colours): smoke and back particles, then the flames, then sparks and the rest on top.
 */
function simDraw(p, ps, H, layer) {
  const all = ps.list, rest = [], fire = [];
  for (const q of all) (q.k === P.FIRE ? fire : rest).push(q);
  const puffs = (back) => {
    for (const q of fire) if (q.delay <= 0 && !!(q.flag & PF.BACK) === back) firePuff(p, q.x, q.y, q.life / q.max, q.size, q.seed % 1, H);
  };
  ps.list = rest;
  if (layer !== "front") ps.draw(p, "back"), puffs(true);
  if (layer !== "back") puffs(false), ps.draw(p, "front");
  ps.list = all;
}

const SMOKE1 = hex("#5b5566");

/**
 * A fire for loops, drawn from t alone. Tongues T: [[dx, dy, height share, half-width, back row?], ...] from the
 * base (o.x, o.y), back row first then outer to inner; licks torn off their tips, flame puffs that burn out into
 * smoke, a smoke plume curling off with the draught, embers, and the fire's light.
 * o: { H, D, NL (noiseFor(D)), S (seed), height, lean, rates per second: puffs and licks (per tongue), smoke,
 * embers; spread (how wide embers and smoke leave), glow (light strength), glowR, mid() (called after the
 * tongues, before what flies off them: draw what the fire burns out of there) }. Wide tongues get BIG_LAYERS.
 * Returns { tip(i, tt), fl (this frame's flicker) }.
 */
function burn(p, t, T, o) {
  const { H, D, NL, S } = o, HC = o.height, X = o.x ?? 0, Y = o.y ?? 0, W = o.spread ?? 6, G = o.glow ?? 1;
  const N = (rate, seed = 0, off = 0) => NL(t, rate, seed, off);
  const fla = (tt) => 0.74 + 0.16 * NL(tt, 7.3, S + 1) + 0.1 * NL(tt, 19, S + 2), fl = fla(t);
  const SMOKE = mix(SMOKE1, H[6], 0.25), EMB = [H[1], H[2], H[4], H[6]], GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.25);
  const R = rng(S, 77), count = (rate) => Math.round(rate * D);
  const TT = T.map(([dx, dy, h, w, back], i) => ({ dx: dx + R.range(-0.3, 0.3), y: dy, h: 2 + HC * h * R.range(0.92, 1.08), w: w * R.range(0.92, 1.08), back, env: h, n: (S * 7 + i) * 13 }));
  const lean = (tt) => NL(tt, 0.67, S + 90) * (o.lean ?? 0.1);
  const height = (i, tt) => {
    const { h, n } = TT[i], leap = Math.max(0, NL(tt, 2.6, n + 70) - 0.55) * 1.4;
    return (h + 0.25 * h * NL(tt, 3.3, n) + h * leap) * (0.9 + 0.1 * fla(tt));
  };
  const sweep = (i, tt, h) => NL(tt, 2.2, TT[i].n + 40) * (1 + h * 0.08) + lean(tt) * h * 0.9 - clamp(TT[i].dx * 0.3, -2.5, 2.5);
  const tip = (i, tt) => {
    const h = height(i, tt);
    return [X + TT[i].dx + sweep(i, tt, h) * 0.85, Y + TT[i].y - h * 0.88 + 3, h];
  };
  const tongueAt = (i) => {
    const { dx, y, w, n, back } = TT[i], h = height(i, t);
    flameTongue(p, X + dx, Y + y, h, w, sweep(i, t, h), N, n, H, back ? BACK_LAYERS : w > 2.2 ? BIG_LAYERS : LAYERS, 0.5, 1.1 + h * 0.04);
  };

  // the plume: each puff keeps the sway the plume had when it left, so the wiggle climbs it
  looped(t, D, count(o.smoke ?? 12), S + 300, (r) => ({ x: r.range(-W, W) * 0.7, y: -HC * 0.8 - r.range(0, 6), vx: r.range(-2, 2), vy: -r.range(10, 17), life: r.range(...(o.smokeLife ?? [1.6, 2.6])), s: r.range(0.7, 1.1) * (o.smokeSize ?? 3) }), (q, age) => {
    const [x, y] = drift(q.x, q.y, q.vx, q.vy, age, o.wind ?? 3, -20, 1.6, 1);
    smokePuff(p, X + x + NL(t - age, 0.8, S + 60) * (1.5 + 2.5 * age), Y + y, 1 - age / q.life, q.s, SMOKE);
  });
  // flame puffs shed from the tips
  const puffs = [];
  looped(t, D, TT.length * count(o.puffs ?? 8), S + 200, (r, j) => {
    const i = j % TT.length, fire = r.range(0.14, 0.3), smokes = r.chance(0.45);
    return { i, fire, smokes, sl: r.range(0.8, 1.4), ox: r.range(-1, 1), oy: r.range(0, 4), vx: r.range(-4, 4), vy: -r.range(15, 30), s: r.range(0.8, 1.6) * (0.8 + 0.6 * TT[i].env), f: r.next(), life: fire + (smokes ? 1.4 : 0) };
  }, (q, age) => {
    const [tx, ty] = tip(q.i, t - age);
    const [x, y, vx, vy] = drift(tx + q.ox, ty + q.oy, q.vx, q.vy, Math.min(age, q.fire), 0, -95, 5, 3.2);
    if (age < q.fire) return puffs.push([x, y, 1 - age / q.fire, q.s, q.f]);
    if (age - q.fire > q.sl) return;
    const [sx, sy] = drift(x, y, vx * 0.6, vy * 0.6 - 6, age - q.fire, o.wind ?? 3, -16, 1.6, 1.2);
    smokePuff(p, sx, sy, 1 - (age - q.fire) / q.sl, q.s * 0.7, 0);
  });
  for (let i = 0; i < TT.length; i++) if (TT[i].back) tongueAt(i);
  for (let i = 0; i < TT.length; i++) if (!TT[i].back) tongueAt(i);
  o.mid?.(fl);
  // licks torn off the tips, rising and shrinking
  looped(t, D, TT.length * count(o.licks ?? 4), S + 220, (r, j) => ({ i: j % TT.length, vx: r.range(-3, 3), vy: -r.range(12, 22), s: r.range(0.9, 1.6) * (0.8 + 0.5 * TT[j % TT.length].env), life: 0.26 }), (q, age) => {
    const [tx, ty] = tip(q.i, t - age);
    lick(p, tx + q.vx * age, ty - 2 + q.vy * age, 1 - age / q.life, q.s, H);
  });
  for (const [x, y, k, s, f] of puffs) firePuff(p, x, y, k, s, f, H);
  // embers carried up by the heat, wandering and cooling
  looped(t, D, count(o.embers ?? 8), S + 500, (r) => ({ x: r.range(-W, W), y: -r.range(HC * 0.3, HC * 0.8), vx: r.range(-15, 15), vy: -r.range(25, 60), life: r.range(1.1, 2.4), s: r.chance(0.15) ? 2 : r.range(1, 1.6), a: r.range(0, 6.3), b: r.range(0, 6.3) }), (q, age) => {
    const [x, y] = drift(q.x, q.y, q.vx, q.vy, age, 0, -30, 1.6, 1.6);
    ember(p, X + x + 7 * (Math.sin(age * 2.3 + q.a) - Math.sin(q.a)), Y + y + 2 * (Math.sin(age * 3 + q.b) - Math.sin(q.b)), 1 - age / q.life, q.s, EMB, age * 40 + q.a);
  });
  // light: a broad warm wash, lights on the flames, a hot heart at the base
  if (G > 0) {
    const R1 = o.glowR ?? 46, lx = X + lean(t) * 12;
    p.glow(lx, Y - HC * 0.35, R1 * 1.5, GLOW, 0.22 * fl * G);
    p.glow(lx, Y - HC * 0.75, R1, GLOW, 0.34 * fl * G);
    p.glow(X, Y - HC * 0.2, R1 * 0.32, H[2], 0.2 * fl * G);
    p.glow(X, Y - 2, 8, H[0], 0.14 * fl * G);
  }
  return { tip, fl };
}

exports.pnoise = pnoise;
exports.noiseFor = noiseFor;
exports.looped = looped;
exports.flameTongue = flameTongue;
exports.flameBlade = flameBlade;
exports.solid = solid;
exports.soft = soft;
exports.firePuff = firePuff;
exports.lick = lick;
exports.smokePuff = smokePuff;
exports.ember = ember;
exports.spark = spark;
exports.drift = drift;
exports.sparkAt = sparkAt;
exports.floorLight = floorLight;
exports.simDraw = simDraw;
exports.burn = burn;
exports.flicker = flicker;
exports.hotFirst = hotFirst;
exports.LAYERS = LAYERS;
exports.BIG_LAYERS = BIG_LAYERS;
exports.BACK_LAYERS = BACK_LAYERS;
  };
  const core = __req("core/index.js");
  const EFFECTS = {
    "melee/sword-slash": __req("fx/melee/sword-slash.js"),
    "melee/double-slash": __req("fx/melee/double-slash.js"),
    "melee/dagger-flurry": __req("fx/melee/dagger-flurry.js"),
    "melee/heavy-cleave": __req("fx/melee/heavy-cleave.js"),
    "melee/scythe-reap": __req("fx/melee/scythe-reap.js"),
    "melee/hammer-smash": __req("fx/melee/hammer-smash.js"),
    "melee/thrust": __req("fx/melee/thrust.js"),
    "melee/spin-slash": __req("fx/melee/spin-slash.js"),
    "melee/claw-swipe": __req("fx/melee/claw-swipe.js"),
    "impacts/shield-block": __req("fx/impacts/shield-block.js"),
    "impacts/parry": __req("fx/impacts/parry.js"),
    "impacts/crit-hit": __req("fx/impacts/crit-hit.js"),
    "impacts/ground-slam": __req("fx/impacts/ground-slam.js"),
    "impacts/blunt-hit": __req("fx/impacts/blunt-hit.js"),
    "impacts/hit-spark": __req("fx/impacts/hit-spark.js"),
    "nature/acid-splash": __req("fx/nature/acid-splash.js"),
    "nature/spore-burst": __req("fx/nature/spore-burst.js"),
    "ice/ice-spikes": __req("fx/ice/ice-spikes.js"),
    "ice/ice-shatter": __req("fx/ice/ice-shatter.js"),
    "ice/frost-nova": __req("fx/ice/frost-nova.js"),
    "ice/snowflake-burst": __req("fx/ice/snowflake-burst.js"),
    "shadow/soul-drain": __req("fx/shadow/soul-drain.js"),
    "shadow/dark-explosion": __req("fx/shadow/dark-explosion.js"),
    "shadow/hex-sigil": __req("fx/shadow/hex-sigil.js"),
    "shadow/shadow-tendrils": __req("fx/shadow/shadow-tendrils.js"),
    "holy/smite": __req("fx/holy/smite.js"),
    "holy/holy-pillar": __req("fx/holy/holy-pillar.js"),
    "arcane/magic-circle-cast": __req("fx/arcane/magic-circle-cast.js"),
    "arcane/star-fall": __req("fx/arcane/star-fall.js"),
    "arcane/mana-burst": __req("fx/arcane/mana-burst.js"),
    "lightning/zap-hit": __req("fx/lightning/zap-hit.js"),
    "lightning/lightning-strike": __req("fx/lightning/lightning-strike.js"),
    "spawn/coin-drop": __req("fx/spawn/coin-drop.js"),
    "spawn/spawn-portal": __req("fx/spawn/spawn-portal.js"),
    "pickups/collect-burst": __req("fx/pickups/collect-burst.js"),
    "explosions/plasma-explosion": __req("fx/explosions/plasma-explosion.js"),
    "fire/flame-pillar": __req("fx/fire/flame-pillar.js"),
  };
  if (typeof window !== "undefined") { window.MT = window.MT || {}; window.MT.PixelFX = Object.assign({}, core, { EFFECTS }); }
})();