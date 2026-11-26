// Unified VFX Player: Duelyst H5 Kit Independent Keyed Effects (Primary) + PixelFX Fallback
// Every effect is invoked independently by its own key; timing & landing position are driven by game events;
// a single effect clip/image can serve unlimited concurrent instances across any units.
(function () {
  window.MT = window.MT || {};

  // Semantic aliases -> Duelyst H5 effect keys (callers may pass either a direct Duelyst key or an alias)
  const EFFECT_ALIASES = {
    fire:       'fx_flamesphere',
    fireslash:  'fx_fireslash',
    grass:      'fxImpactGreenBig',
    ice:        'fxFrozenIceBlock',
    ice_hit:    'fxExplosionMediumIcyWhite',
    light:      'fx_f1_holyimmolation',
    dark:       'fx_f4_shadownova',
    void:       'fx_f4_voidpulse',
    bolt:       'fx_f2_twilightreiki',
    slash:      'fx_crossslash',
    ult_slash:  'fx_multislash_full',
    frenzy:     'fx_slashfrenzy',
    crit:       'fxExplosionBigWhiteHot',
    flame_bomb: 'fxExplosionBigBall_MetalSlug',
    buff:       'fxBuffSimpleGold',
    shield:     'fxDistortionHexShield',
    teleport:   'fx_f2_teleportsmoke',
    hit_orange: 'fxImpactBigOrange',
    hit_blue:   'fxImpactBlueBig',
    hit_green:  'fxImpactGreenBig'
  };

  class VfxPlayer {
    constructor() {
      this.images = new Map();        // pixelfx fallback images
      this.duelystImages = new Map(); // duelyst effect key -> HTMLImageElement
      this.iconImages = new Map();    // duelyst icon key -> HTMLImageElement
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

      // 1. Preload all imported Duelyst H5 independent effects & shop icons
      const kit = this.initKit();
      if (kit && kit.manifest && kit.manifest.effects) {
        for (const [key, clip] of Object.entries(kit.manifest.effects)) {
          promises.push(
            kit.image(clip)
              .then((img) => { this.duelystImages.set(key, img); })
              .catch(() => {})
          );
        }
      }
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

      // 3. Preload pixelfx fallback sheets (e.g. coin, weather)
      const manifest = window.MT.VFX_MANIFEST;
      if (manifest) {
        for (const [key, info] of Object.entries(manifest)) {
          promises.push(new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { this.images.set(key, img); resolve(); };
            img.onerror = () => resolve();
            img.src = info.image;
          }));
        }
      }

      await Promise.all(promises);
      this.loaded = true;
      return this;
    }

    resolveDuelystKey(key) {
      const kit = this.initKit();
      if (!kit) return null;
      if (kit.effect(key)) return key;
      const aliased = EFFECT_ALIASES[key];
      if (aliased && kit.effect(aliased)) return aliased;
      return null;
    }

    spawn(key, x, y, opts = {}) {
      return this.createInstance(key, x, y, opts);
    }

    createInstance(key, x, y, opts = {}) {
      // Prefer Duelyst H5 independent keyed effect when available
      const dKey = this.resolveDuelystKey(key);
      if (dKey) {
        const kit = this.initKit();
        const clip = kit.effect(dKey);
        const speedMult = opts.speedMult || 1.55;
        const rawDurMs = kit.duration(clip) || 500;
        // Kick off lazy load if somehow not preloaded yet
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

      // Fallback to pixelfx sprite-sheet manifest
      const manifest = window.MT.VFX_MANIFEST;
      const info = manifest && manifest[key];
      if (!info) return null;
      const speedMult = opts.speedMult || 1.6;
      return {
        engine: 'pixelfx',
        key,
        info,
        x,
        y,
        scale: opts.scale || 1.0,
        flipX: Boolean(opts.flipX),
        loop: Boolean(opts.loop),
        blend: opts.blend || null,
        alpha: opts.alpha !== undefined ? opts.alpha : 1,
        speedMult,
        elapsed: 0,
        duration: info.frames / (info.fps * speedMult),
        done: false
      };
    }

    update(inst, dt) {
      if (!inst || inst.done) return;
      inst.elapsed += dt;
      if (!inst.loop && inst.elapsed >= inst.duration) {
        inst.done = true;
      }
    }

    draw(ctx, inst) {
      if (!inst || inst.done) return;

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
        return;
      }

      // PixelFX fallback draw
      const img = this.images.get(inst.key);
      if (!img) return;
      const info = inst.info;
      const rawFrame = Math.floor(inst.elapsed * info.fps * inst.speedMult);
      const frameIdx = inst.loop
        ? ((rawFrame % info.frames) + info.frames) % info.frames
        : Math.min(info.frames - 1, Math.max(0, rawFrame));
      const col = frameIdx % info.columns;
      const row = Math.floor(frameIdx / info.columns);
      const sx = col * info.frameW;
      const sy = row * info.frameH;
      const dw = Math.round(info.frameW * inst.scale);
      const dh = Math.round(info.frameH * inst.scale);
      const px = info.pivot ? info.pivot[0] / info.frameW : 0.5;
      const py = info.pivot ? info.pivot[1] / info.frameH : 0.5;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (inst.blend) ctx.globalCompositeOperation = inst.blend;
      if (inst.alpha < 1) ctx.globalAlpha = inst.alpha;
      ctx.translate(Math.round(inst.x), Math.round(inst.y));
      if (inst.flipX) ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, info.frameW, info.frameH, -Math.round(dw * px), -Math.round(dh * py), dw, dh);
      ctx.restore();
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
})();
