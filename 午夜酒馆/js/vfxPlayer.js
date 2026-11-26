// Unified VFX Player: MIT pixelfx Procedural Dual-Buffer Engine (Primary) + Duelyst H5 Kit Fallback
// Uses patch-gg/pixelfx (MIT License, Copyright (c) 2026 Patch, Copyright (c) 2026 Hugo Duprez)
// with true Color + Additive Light dual-buffer compositing, deterministic seeded PRNG, and bespoke per-unit palettes!
(function () {
  window.MT = window.MT || {};

  // Curated themed color ramps (dark -> bright) for per-archetype palette swaps
  const RAMPS = {
    steel:   ['#18254a', '#264d8f', '#3c84d4', '#6cc8f8', '#c2e4ff', '#eef8ff', '#ffffff'],
    gold:    ['#2a1806', '#663c0a', '#b57214', '#e8a828', '#ffd966', '#fff2b0', '#ffffff'],
    crimson: ['#260610', '#631024', '#a81e38', '#e63956', '#ff7a8e', '#ffc2cc', '#ffffff'],
    venom:   ['#082112', '#124d26', '#1f8a3c', '#4ad45c', '#98f57a', '#dcffba', '#ffffff'],
    frost:   ['#0d2042', '#1b4a8a', '#3282cc', '#66c8f5', '#b8ecff', '#e8faff', '#ffffff'],
    void:    ['#160826', '#3a1460', '#6e28b0', '#a855f0', '#d49cff', '#f0dcff', '#ffffff'],
    cyan:    ['#092438', '#145878', '#2694bd', '#52d6f4', '#a6f0ff', '#e2fcff', '#ffffff'],
    ember:   ['#290a06', '#6e1e0c', '#c24214', '#f27c24', '#ffc44d', '#fff0a8', '#ffffff']
  };

  // Curated MIT pixelfx presets: EVERY hero, mechanic, status, and Boss gets a hand-picked visual signature!
  // anchorYShift: vertical offset in pixelfx native pixels (positive shifts sprite down so floor-based fx align with feet!)
  const PIXELFX_PRESETS = {
    // --- Melee Weapons & Slashes (xOff centers forward-facing blade arcs right onto target torso!) ---
    pfx_sword_slash:    { id: 'melee/sword-slash',       scale: 2.15, speed: 1.05, palette: RAMPS.steel,   xOff: -56, yOff: 56 },
    pfx_cyan_slash:     { id: 'melee/sword-slash',       scale: 2.15, speed: 1.10, palette: RAMPS.cyan,    xOff: -56, yOff: 56 },
    pfx_double_slash:   { id: 'melee/double-slash',      scale: 2.10, speed: 1.10, palette: RAMPS.gold,    xOff: -62, yOff: 56 },
    pfx_emerald_double: { id: 'melee/double-slash',      scale: 2.10, speed: 1.10, palette: RAMPS.venom,   xOff: -62, yOff: 56 },
    pfx_dagger_flurry:  { id: 'melee/dagger-flurry',     scale: 2.10, speed: 1.15, palette: RAMPS.cyan,    xOff: -58, yOff: 52 },
    pfx_heavy_cleave:   { id: 'melee/heavy-cleave',      scale: 1.95, speed: 1.35, palette: RAMPS.ember,   xOff: -54, yOff: 64 },
    pfx_gold_cleave:    { id: 'melee/heavy-cleave',      scale: 2.00, speed: 1.35, palette: RAMPS.gold,    xOff: -54, yOff: 64 },
    pfx_blood_cleave:   { id: 'melee/heavy-cleave',      scale: 2.05, speed: 1.35, palette: RAMPS.crimson, xOff: -54, yOff: 64 },
    pfx_scythe_reap:    { id: 'melee/scythe-reap',       scale: 2.00, speed: 1.35, palette: RAMPS.cyan,    xOff: -36, yOff: 62 },
    pfx_void_scythe:    { id: 'melee/scythe-reap',       scale: 2.00, speed: 1.35, palette: RAMPS.void,    xOff: -36, yOff: 62 },
    pfx_hammer_smash:   { id: 'melee/hammer-smash',      scale: 1.95, speed: 1.35, palette: RAMPS.steel,   xOff: -48, yOff: 64 },
    pfx_thrust:         { id: 'melee/thrust',            scale: 2.10, speed: 1.05, palette: RAMPS.ember,   xOff: -92, yOff: 44 },
    pfx_spin_slash:     { id: 'melee/spin-slash',        scale: 2.05, speed: 1.05, palette: RAMPS.gold,    xOff: 0,   yOff: 56 },
    pfx_blood_claws:    { id: 'melee/claw-swipe',        scale: 2.20, speed: 1.10, palette: RAMPS.crimson, xOff: -72, yOff: 56 },

    // --- Shields, Parries & Impacts ---
    pfx_shield_block:   { id: 'impacts/shield-block',    scale: 2.00, speed: 1.15, palette: RAMPS.frost,   yOff: 48 },
    pfx_parry:          { id: 'impacts/parry',           scale: 1.95, speed: 1.10, palette: RAMPS.gold,    yOff: 52 },
    pfx_crit_hit:       { id: 'impacts/crit-hit',        scale: 1.85, speed: 1.10, palette: RAMPS.gold,    yOff: 48 },
    pfx_royal_crit:     { id: 'impacts/crit-hit',        scale: 2.05, speed: 1.05, palette: RAMPS.gold,    yOff: 50 },
    pfx_ground_slam:    { id: 'impacts/ground-slam',     scale: 1.65, speed: 1.55, palette: RAMPS.ember,   yOff: 66 },
    pfx_blunt_hit:      { id: 'impacts/blunt-hit',       scale: 1.95, speed: 1.15, palette: RAMPS.steel,   yOff: 46 },
    pfx_hit_spark:      { id: 'impacts/hit-spark',       scale: 1.90, speed: 1.00, palette: RAMPS.gold,    yOff: 34 },

    // --- Poison / Nature ---
    pfx_acid_splash:    { id: 'nature/acid-splash',      scale: 1.90, speed: 1.45, palette: RAMPS.venom,   yOff: 58 },
    pfx_spore_burst:    { id: 'nature/spore-burst',      scale: 1.85, speed: 1.50, palette: RAMPS.venom,   yOff: 64 },
    pfx_venom_blast:    { id: 'shadow/dark-explosion',   scale: 1.55, speed: 1.65, palette: RAMPS.venom,   yOff: 64 },
    pfx_venom_bolt:     { id: 'lightning/lightning-strike', scale: 1.45, speed: 1.60, palette: RAMPS.venom, yOff: 72 },

    // --- Frost / Ice ---
    pfx_ice_spikes:     { id: 'ice/ice-spikes',          scale: 1.75, speed: 1.50, palette: RAMPS.frost,   yOff: 58 },
    pfx_ice_shatter:    { id: 'ice/ice-shatter',         scale: 1.85, speed: 1.45, palette: RAMPS.frost,   yOff: 54 },
    pfx_frost_nova:     { id: 'ice/frost-nova',          scale: 1.65, speed: 1.55, palette: RAMPS.frost,   yOff: 64 },
    pfx_snowflake_burst:{ id: 'ice/snowflake-burst',     scale: 2.00, speed: 1.50, palette: RAMPS.frost,   yOff: 58 },

    // --- Shadow / Sacrifice / Blood ---
    pfx_blood_drain:    { id: 'shadow/soul-drain',       scale: 1.85, speed: 1.45, palette: RAMPS.crimson, yOff: 58 },
    pfx_dark_explosion: { id: 'shadow/dark-explosion',   scale: 1.60, speed: 1.60, palette: RAMPS.void,    yOff: 66 },
    pfx_hex_sigil:      { id: 'shadow/hex-sigil',        scale: 1.85, speed: 1.65, palette: RAMPS.void,    yOff: 62 },
    pfx_vuln_sigil:     { id: 'shadow/hex-sigil',        scale: 1.70, speed: 1.75, palette: RAMPS.ember,   yOff: 58 },
    pfx_shadow_tendrils:{ id: 'shadow/shadow-tendrils',  scale: 1.85, speed: 1.55, palette: RAMPS.void,    yOff: 60 },

    // --- Holy / Arcane / Lightning / Gold ---
    pfx_holy_smite:     { id: 'holy/smite',              scale: 1.75, speed: 1.50, palette: RAMPS.gold,    yOff: 66 },
    pfx_blood_smite:    { id: 'holy/smite',              scale: 1.75, speed: 1.50, palette: RAMPS.crimson, yOff: 66 },
    pfx_holy_pillar:    { id: 'holy/holy-pillar',        scale: 1.55, speed: 1.65, palette: RAMPS.gold,    yOff: 68 },
    pfx_magic_circle:   { id: 'arcane/magic-circle-cast',scale: 1.55, speed: 1.70, palette: RAMPS.gold,    yOff: 68 },
    pfx_star_fall:      { id: 'arcane/star-fall',        scale: 1.80, speed: 1.45, palette: RAMPS.gold,    yOff: 64 },
    pfx_mana_burst:     { id: 'arcane/mana-burst',       scale: 1.85, speed: 1.35, palette: RAMPS.cyan,    yOff: 60 },
    pfx_zap_hit:        { id: 'lightning/zap-hit',       scale: 2.00, speed: 1.15, palette: RAMPS.cyan,    yOff: 32 },
    pfx_lightning_strike:{ id: 'lightning/lightning-strike', scale: 1.45, speed: 1.55, palette: RAMPS.cyan, yOff: 72 },
    pfx_coin_drop:      { id: 'spawn/coin-drop',         scale: 2.00, speed: 1.45, palette: RAMPS.gold,    yOff: 52 },
    pfx_spawn_portal:   { id: 'spawn/spawn-portal',      scale: 1.70, speed: 1.60, palette: RAMPS.void,    yOff: 62 },
    pfx_collect_burst:  { id: 'pickups/collect-burst',   scale: 2.00, speed: 1.25, palette: RAMPS.gold,    yOff: 52 },
    pfx_plasma_death:   { id: 'explosions/plasma-explosion', scale: 2.05, speed: 1.25, palette: RAMPS.gold, yOff: 36 },
    pfx_flame_pillar:   { id: 'fire/flame-pillar',       scale: 1.55, speed: 1.75, palette: RAMPS.ember,   yOff: 72 }
  };

  // Legacy Duelyst semantic aliases (kept as fallback for any unmigrated key)
  const EFFECT_ALIASES = {
    fire:       'pfx_flame_pillar',
    fireslash:  'pfx_heavy_cleave',
    grass:      'pfx_acid_splash',
    ice:        'pfx_ice_spikes',
    ice_hit:    'pfx_ice_shatter',
    light:      'pfx_holy_smite',
    dark:       'pfx_dark_explosion',
    void:       'pfx_hex_sigil',
    bolt:       'pfx_lightning_strike',
    slash:      'pfx_sword_slash',
    ult_slash:  'pfx_spin_slash',
    frenzy:     'pfx_dagger_flurry',
    crit:       'pfx_crit_hit',
    flame_bomb: 'pfx_ground_slam',
    buff:       'pfx_collect_burst',
    shield:     'pfx_shield_block',
    teleport:   'pfx_spawn_portal',
    hit_orange: 'pfx_blunt_hit',
    hit_blue:   'pfx_shield_block',
    hit_green:  'pfx_acid_splash'
  };

  let _seedSeq = 1;

  class VfxPlayer {
    constructor() {
      this.images = new Map();
      this.duelystImages = new Map();
      this.iconImages = new Map();
      this.kit = null;
      this.loaded = false;
    }

    initKit() {
      if (!this.kit && globalThis.DuelystH5 && globalThis.DuelystH5Manifest) {
        this.kit = globalThis.DuelystH5.create({
          baseURL: './assets/duelyst/',
          manifest: globalThis.DuelystH5Manifest
        });
      }
      return this.kit;
    }

    async load() {
      const promises = [];

      // 1. Preload Duelyst H5 shop/relic icons (VFX now primarily powered by pure-code MIT pixelfx!)
      const kit = this.initKit();
      if (kit && kit.manifest && kit.manifest.icons) {
        for (const [key, rec] of Object.entries(kit.manifest.icons)) {
          if (!rec || !rec.path) continue;
          promises.push(
            kit.image(rec)
              .then((img) => { this.iconImages.set(key, img); })
              .catch(() => {})
          );
        }
      }

      // 2. Preload local pixel UI icons & gear fallbacks
      const localUiIcons = [
        './assets/icons/role_tank.png',
        './assets/icons/role_assassin.png',
        './assets/icons/role_ranged.png',
        './assets/icons/role_warrior.png',
        './assets/icons/el_fire.png',
        './assets/icons/el_ice.png',
        './assets/icons/el_light.png',
        './assets/icons/el_dark.png',
        './assets/icons/el_bolt.png',
        './assets/gear/eq_dragon_heart.png',
        './assets/gear/eq_aegis_seal.png',
        './assets/gear/eq_storm_staff.png',
        './assets/gear/eq_greed_dice.png'
      ];
      for (const src of localUiIcons) {
        promises.push(new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
        }));
      }

      await Promise.all(promises);
      this.loaded = true;
      return this;
    }

    resolvePixelFx(key) {
      const PFX = window.MT && window.MT.PixelFX;
      if (!PFX || !PFX.EFFECTS || !key) return null;
      const aliased = EFFECT_ALIASES[key] || key;
      const preset = PIXELFX_PRESETS[aliased];
      if (preset && PFX.EFFECTS[preset.id]) {
        return { mod: PFX.EFFECTS[preset.id], preset };
      }
      if (PFX.EFFECTS[aliased]) {
        return { mod: PFX.EFFECTS[aliased], preset: { id: aliased, scale: 1.95, speed: 1.25, yOff: 48 } };
      }
      return null;
    }

    resolveDuelystKey(key) {
      const kit = this.initKit();
      if (!kit) return null;
      if (kit.effect(key)) return key;
      return null;
    }

    spawn(key, x, y, opts = {}) {
      return this.createInstance(key, x, y, opts);
    }

    createInstance(key, x, y, opts = {}) {
      // 1. Primary Engine: MIT pixelfx Procedural Dual-Buffer Effects (crisp pixel art + additive light!)
      const pfxMatch = this.resolvePixelFx(key);
      if (pfxMatch) {
        const PFX = window.MT.PixelFX;
        const { mod, preset } = pfxMatch;
        const [w, h] = mod.meta.size || [128, 128];
        const [ox, oy] = mod.meta.origin || [Math.floor(w / 2), Math.floor(h / 2)];
        const frame = PFX.createFrame(w, h, -ox, -oy);
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const offCtx = off.getContext('2d');
        const imgData = offCtx.createImageData(w, h);

        const fxOpts = {
          x: 0,
          y: 0,
          flip: Boolean(opts.flipX),
          seed: opts.seed || ((_seedSeq = (_seedSeq % 997) + 1)),
          light: opts.light !== undefined ? opts.light : 1.18
        };
        if (opts.palette || preset.palette) {
          fxOpts.palette = opts.palette || preset.palette;
        }

        const fx = PFX.createFx(mod, fxOpts);
        const speedMult = (opts.speedMult || 1) * (preset.speed || 1.2);
        // opts.scale passed by battle caller is usually 1.0~2.2 (centered around 1.65); normalize gently
        const callerFactor = opts.scale ? Math.max(0.72, Math.min(1.38, opts.scale / 1.65)) : 1.0;
        const pxScale = (preset.scale || 1.95) * callerFactor;
        const rawDur = mod.meta.duration || 1.2;

        const xShift = (opts.xOff !== undefined ? opts.xOff : (preset.xOff || 0)) * (opts.flipX ? -1 : 1);
        return {
          engine: 'pixelfx_live',
          key,
          fx,
          frame,
          off,
          offCtx,
          imgData,
          w,
          h,
          ox,
          oy,
          x: x + xShift,
          y: y + (opts.yOff !== undefined ? opts.yOff : (preset.yOff || 44)),
          pxScale,
          alpha: opts.alpha !== undefined ? opts.alpha : 1,
          blend: opts.blend || null,
          speedMult,
          elapsed: 0,
          duration: rawDur / speedMult,
          done: false
        };
      }

      // 2. Fallback: Duelyst H5 independent keyed effect (if any legacy key remains)
      const dKey = this.resolveDuelystKey(key);
      if (dKey) {
        const kit = this.initKit();
        const clip = kit.effect(dKey);
        const speedMult = opts.speedMult || 1.55;
        const rawDurMs = kit.duration(clip) || 500;
        if (!this.duelystImages.has(dKey)) {
          kit.image(clip).then((img) => this.duelystImages.set(dKey, img)).catch(() => {});
        }
        return {
          engine: 'duelyst',
          key: dKey,
          clip,
          x,
          y,
          scale: opts.scale || 1.65,
          flipX: Boolean(opts.flipX),
          loop: Boolean(opts.loop),
          blend: opts.blend || null,
          alpha: opts.alpha !== undefined ? opts.alpha : 1,
          speedMult,
          elapsed: 0,
          duration: (rawDurMs / 1000) / speedMult,
          done: false
        };
      }

      return null;
    }

    update(inst, dt) {
      if (!inst || inst.done) return;
      inst.elapsed += dt;
      if (inst.engine === 'pixelfx_live') {
        inst.fx.update(dt * inst.speedMult);
        if (inst.fx.done() || inst.elapsed >= inst.duration + 0.08) {
          inst.done = true;
        }
        return;
      }
      if (!inst.loop && inst.elapsed >= inst.duration) {
        inst.done = true;
      }
    }

    draw(ctx, inst) {
      if (!inst || inst.done) return;

      if (inst.engine === 'pixelfx_live') {
        const PFX = window.MT && window.MT.PixelFX;
        if (!PFX) return;
        PFX.clearFrame(inst.frame);
        inst.fx.draw(inst.frame);
        PFX.composite(inst.frame, inst.imgData.data, null, 1.15);
        inst.offCtx.putImageData(inst.imgData, 0, 0);

        const dw = Math.round(inst.w * inst.pxScale);
        const dh = Math.round(inst.h * inst.pxScale);
        const dx = Math.round(inst.x - inst.ox * inst.pxScale);
        const dy = Math.round(inst.y - inst.oy * inst.pxScale);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (inst.blend) ctx.globalCompositeOperation = inst.blend;
        if (inst.alpha < 1) ctx.globalAlpha = inst.alpha;
        ctx.drawImage(inst.off, 0, 0, inst.w, inst.h, dx, dy, dw, dh);
        ctx.restore();
        return;
      }

      if (inst.engine === 'duelyst') {
        const kit = this.initKit();
        const img = this.duelystImages.get(inst.key);
        if (!kit || !img) return;
        const elapsedMs = inst.elapsed * 1000 * inst.speedMult;
        ctx.save();
        if (inst.blend) ctx.globalCompositeOperation = inst.blend;
        if (inst.alpha < 1) ctx.globalAlpha = inst.alpha;
        const active = kit.draw(ctx, inst.clip, img, elapsedMs, Math.round(inst.x), Math.round(inst.y), {
          loop: inst.loop,
          scale: inst.scale,
          flipX: inst.flipX
        });
        ctx.restore();
        if (!active && !inst.loop) inst.done = true;
      }
    }

    getIconUrl(iconId, fallback = './assets/gear/eq_dragon_heart.png') {
      if (!iconId) return fallback;
      const manifest = globalThis.DuelystH5Manifest;
      const directRec = manifest && manifest.icons && manifest.icons[iconId];
      if (directRec && directRec.path) {
        return `./assets/duelyst/${directRec.path}`;
      }
      const kit = this.initKit();
      const rec = kit && kit.icon(iconId);
      if (rec && rec.path) {
        return `./assets/duelyst/${rec.path}`;
      }
      return fallback;
    }
  }

  window.MT.vfx = new VfxPlayer();
  window.MT.PIXELFX_PRESETS = PIXELFX_PRESETS;
})();
