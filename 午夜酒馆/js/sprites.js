// Duelyst pre-sliced horizontal strip loader (zero fetch, 100% file:// compatible)
// Computes exact frameW = img.width / frames (100x112 for idle/selected/still, 160x112 for attack/hit)
// and uses exact transform: translateX(0 -> -100%) with steps(N, end) — ZERO sliding/drift anywhere!
(function () {
  window.MT = window.MT || {};
  // Global unified animation pacing config (single source of truth for Canvas + DOM cards/posters)
  window.MT.ANIM_CONFIG = Object.assign({ idleRate: 0.80 }, window.MT.ANIM_CONFIG || {});

  class SpriteLibrary {
    constructor() {
      this.manifest = null;
      this.images = new Map();
      this.kit = null;
      this.duelystImages = new Map(); // `${unitId}:${action}` -> HTMLImageElement
      this.domCanvases = [];
      this.ready = false;
      this._outlineCache = new Map();
      this._silCanvas = null;
      this._silCtx = null;
      this._flashCanvas = null;
      this._flashCtx = null;
    }

    _getOutlinedCell(cacheKey, img, sx, sy, sw, sh, outlineColor) {
      let cached = this._outlineCache.get(cacheKey);
      if (cached) return cached;
      if (this._outlineCache.size > 480) {
        const firstKey = this._outlineCache.keys().next().value;
        this._outlineCache.delete(firstKey);
      }
      if (!this._silCanvas) {
        this._silCanvas = document.createElement('canvas');
        this._silCtx = this._silCanvas.getContext('2d');
      }
      const silC = this._silCanvas;
      const silCtx = this._silCtx;
      if (silC.width < sw || silC.height < sh) {
        silC.width = Math.max(silC.width, sw);
        silC.height = Math.max(silC.height, sh);
      }
      silCtx.clearRect(0, 0, sw, sh);
      silCtx.globalCompositeOperation = 'source-over';
      silCtx.imageSmoothingEnabled = false;
      silCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      silCtx.globalCompositeOperation = 'source-in';
      silCtx.fillStyle = outlineColor;
      silCtx.fillRect(0, 0, sw, sh);
      silCtx.globalCompositeOperation = 'source-over';

      const out = document.createElement('canvas');
      out.width = sw + 2;
      out.height = sh + 2;
      const octx = out.getContext('2d');
      octx.imageSmoothingEnabled = false;
      // Crisp 1-native-pixel silhouette rim (left, right, top) — zero ctx.filter overhead!
      octx.drawImage(silC, 0, 0, sw, sh, 0, 1, sw, sh);
      octx.drawImage(silC, 0, 0, sw, sh, 2, 1, sw, sh);
      octx.drawImage(silC, 0, 0, sw, sh, 1, 0, sw, sh);
      octx.drawImage(img, sx, sy, sw, sh, 1, 1, sw, sh);
      this._outlineCache.set(cacheKey, out);
      return out;
    }

    _getWhiteFlashCell(img, sx, sy, sw, sh) {
      if (!this._flashCanvas) {
        this._flashCanvas = document.createElement('canvas');
        this._flashCtx = this._flashCanvas.getContext('2d');
      }
      const fc = this._flashCanvas;
      const fctx = this._flashCtx;
      if (fc.width < sw || fc.height < sh) {
        fc.width = Math.max(fc.width, sw);
        fc.height = Math.max(fc.height, sh);
      }
      fctx.clearRect(0, 0, sw, sh);
      fctx.globalCompositeOperation = 'source-over';
      fctx.imageSmoothingEnabled = false;
      fctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      fctx.globalCompositeOperation = 'source-in';
      fctx.fillStyle = '#ffffff';
      fctx.fillRect(0, 0, sw, sh);
      fctx.globalCompositeOperation = 'source-over';
      return fc;
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
      this.manifest = window.MT.UNIT_MANIFEST;
      const promises = [];

      // 1. Preload legacy UNIT_MANIFEST horizontal strips
      if (this.manifest && this.manifest.units) {
        for (const [id, info] of Object.entries(this.manifest.units)) {
          const keys = [
            ['idle', info.image],
            ['selected', info.selectedImage],
            ['still', info.still],
            ['attack', info.attack && info.attack.image],
            ['hit', info.hit && info.hit.image]
          ];
          for (const [anim, file] of keys) {
            if (!file) continue;
            promises.push(this.loadImage(`${id}:${anim}`, `./assets/units/${file}`));
          }
        }
      }

      // 2. Preload all imported Duelyst H5 kit units (idle + attack!)
      const kit = this.initKit();
      if (kit && kit.manifest && kit.manifest.units) {
        for (const [unitId, rec] of Object.entries(kit.manifest.units)) {
          for (const [action, clip] of Object.entries(rec.actions || {})) {
            if (!clip || !clip.path) continue;
            promises.push(
              kit.image(clip)
                .then((img) => { this.duelystImages.set(`${unitId}:${action}`, img); })
                .catch(() => {})
            );
          }
        }
      }

      await Promise.all(promises);
      this.ready = true;
      this.startDomCanvasTicker();
      return this;
    }

    getDuelystClip(unitId, anim = 'idle') {
      const kit = this.initKit();
      if (!kit) return null;
      const action = anim === 'attack' ? 'attack' : 'idle';
      const clip = kit.unit(unitId, action) || kit.unit(unitId, 'idle');
      if (!clip) return null;
      const usedAction = kit.unit(unitId, action) ? action : 'idle';
      const img = this.duelystImages.get(`${unitId}:${usedAction}`);
      if (!img) {
        kit.image(clip).then((loaded) => this.duelystImages.set(`${unitId}:${usedAction}`, loaded)).catch(() => {});
        return null;
      }
      const idleClip = kit.unit(unitId, 'idle') || clip;
      return { kit, clip, idleClip, img, action: usedAction };
    }

    getAttackDurationSec(unitId) {
      const kit = this.initKit();
      const clip = kit && kit.unit(unitId, 'attack');
      if (clip) {
        // Play full 20-43 frame Duelyst attack animations at snappy combat tempo (~0.48s - 0.72s)
        const rawSec = kit.duration(clip) / 1000;
        return Math.max(0.46, Math.min(0.72, rawSec * 0.38));
      }
      return 0.44;
    }

    getAttackSpeedMult(unitId, targetDurSec) {
      const kit = this.initKit();
      const clip = kit && kit.unit(unitId, 'attack');
      if (clip && targetDurSec > 0) {
        const rawSec = kit.duration(clip) / 1000;
        return rawSec / targetDurSec;
      }
      return 1;
    }

    startDomCanvasTicker() {
      if (this._domTickStarted) return;
      this._domTickStarted = true;
      const tick = (now) => {
        for (let i = this.domCanvases.length - 1; i >= 0; i--) {
          const item = this.domCanvases[i];
          if (!item.canvas.isConnected) {
            this.domCanvases.splice(i, 1);
            continue;
          }
          const dc = this.getDuelystClip(item.unitId, item.anim);
          if (!dc) continue;
          const { kit, clip, img } = dc;
          const idleRate = (item.anim === 'idle' && window.MT.ANIM_CONFIG) ? window.MT.ANIM_CONFIG.idleRate : 1;
          const cell = kit.frame(clip, (now - item.t0) * idleRate, { loop: true });
          if (!cell) continue;
          const ctx = item.ctx;
          const cw = item.canvas.width;
          const ch = item.canvas.height;
          ctx.clearRect(0, 0, cw, ch);
          ctx.imageSmoothingEnabled = false;
          const fitScale = Math.min((cw - 6) / cell.width, (ch - 6) / cell.height);
          const dw = Math.round(cell.width * fitScale);
          const dh = Math.round(cell.height * fitScale);
          ctx.drawImage(img, cell.sx, cell.sy, cell.width, cell.height, Math.round((cw - dw) / 2), Math.round(ch - dh - 2), dw, dh);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    loadImage(key, src) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.images.set(key, img);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = src;
      });
    }

    getUnitMeta(unitId) {
      return this.manifest && this.manifest.units ? this.manifest.units[unitId] : null;
    }

    getFrameInfo(unitId, anim = 'idle') {
      const meta = this.getUnitMeta(unitId);
      if (!meta) return null;
      let img = this.images.get(`${unitId}:${anim}`);
      let frames = meta.frames || 1;
      let fps = 12;

      if (anim === 'attack' && meta.attack) {
        frames = meta.attack.frames;
        fps = 16;
      } else if (anim === 'hit' && meta.hit) {
        frames = meta.hit.frames;
        fps = 10;
      } else if (anim === 'still') {
        frames = 1;
      } else if (anim === 'selected') {
        frames = meta.frames || 1;
        fps = 13;
      } else {
        frames = meta.frames || 1;
        fps = Math.max(8, Math.round((frames / (meta.durationMs || 1000)) * 1000));
      }

      if (!img) {
        img = this.images.get(`${unitId}:idle`);
        frames = meta.frames || 1;
      }
      if (!img) return null;

      // Always derive exact per-frame width & height from the loaded PNG strip
      // (idle/selected/still = 100x112, attack/hit = 160x112)
      const frameW = Math.round(img.width / frames);
      const frameH = img.height;
      return { img, frames, frameW, frameH, fps };
    }

    drawUnit(ctx, unitId, anim, timeSec, x, y, opts = {}) {
      // 1. Check Duelyst H5 Kit unit first (honors exact frame timing & original canvas-center anchorX/anchorY!)
      const dc = this.getDuelystClip(unitId, anim);
      if (dc) {
        const { kit, clip, idleClip, img, action } = dc;
        const {
          scale = 1.4,
          flipX = false,
          alpha = 1,
          outlineColor = null,
          loop = true,
          elapsedOverride = null,
          speedMult = 1,
          squashX = 1,
          squashY = 1,
          flashWhite = 0,
          tintColor = null
        } = opts;
        const rawSec = elapsedOverride !== null ? elapsedOverride : timeSec;
        const idleRate = (anim === 'idle' && elapsedOverride === null && window.MT.ANIM_CONFIG) ? window.MT.ANIM_CONFIG.idleRate : 1;
        const tMs = Math.max(0, rawSec * 1000 * speedMult * idleRate);
        const totalMs = kit.duration(clip) || 1;
        const safeMs = (!loop && tMs >= totalMs) ? Math.max(0, totalMs - 1) : tMs;
        const cell = kit.frame(clip, safeMs, { loop });
        if (!cell) return;

        // Normalize Duelyst kit unit scale relative to legacy ~80px tall units
        const kitScale = scale * 1.18;
        // Invariant foot-to-center offset derived from idle clip so idle <-> attack never jumps vertically!
        const idleFootFromAnchorY = (idleClip.height - idleClip.anchorY) - 2;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = alpha;
        ctx.translate(Math.round(x), Math.round(y));
        ctx.scale(squashX, squashY);
        ctx.translate(0, Math.round(-idleFootFromAnchorY * kitScale));
        ctx.scale(flipX ? -kitScale : kitScale, kitScale);

        if (tintColor) {
          const sil = this._getOutlinedCell(`tint:${unitId}:${action}:${cell.index}:${tintColor}`, img, cell.sx, cell.sy, cell.width, cell.height, tintColor);
          ctx.drawImage(sil, -clip.anchorX - 1, -clip.anchorY - 1);
        } else if (outlineColor) {
          const outlined = this._getOutlinedCell(`d:${unitId}:${action}:${cell.index}:${outlineColor}`, img, cell.sx, cell.sy, cell.width, cell.height, outlineColor);
          ctx.drawImage(outlined, -clip.anchorX - 1, -clip.anchorY - 1);
        } else {
          ctx.drawImage(img, cell.sx, cell.sy, cell.width, cell.height, -clip.anchorX, -clip.anchorY, cell.width, cell.height);
        }

        if (flashWhite > 0.02) {
          const fc = this._getWhiteFlashCell(img, cell.sx, cell.sy, cell.width, cell.height);
          ctx.globalAlpha = Math.min(1, alpha * flashWhite);
          ctx.drawImage(fc, 0, 0, cell.width, cell.height, -clip.anchorX, -clip.anchorY, cell.width, cell.height);
        }
        ctx.restore();
        return;
      }

      // 2. Legacy UNIT_MANIFEST horizontal strip fallback
      const info = this.getFrameInfo(unitId, anim);
      if (!info) return;
      const {
        scale = 1.4,
        flipX = false,
        alpha = 1,
        outlineColor = null,
        loop = true,
        elapsedOverride = null,
        squashX = 1,
        squashY = 1,
        flashWhite = 0
      } = opts;

      const t = elapsedOverride !== null ? elapsedOverride : timeSec;
      let frameIdx = Math.floor(t * info.fps);
      if (loop) {
        frameIdx = ((frameIdx % info.frames) + info.frames) % info.frames;
      } else {
        frameIdx = Math.min(info.frames - 1, Math.max(0, frameIdx));
      }

      const sx = frameIdx * info.frameW;
      const dw = Math.round(info.frameW * scale * squashX);
      const dh = Math.round(info.frameH * scale * squashY);

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = alpha;
      ctx.translate(Math.round(x), Math.round(y));
      if (flipX) ctx.scale(-1, 1);

      const footOffset = Math.round(dh * 0.11);
      if (outlineColor) {
        const outlined = this._getOutlinedCell(`l:${unitId}:${anim}:${frameIdx}:${outlineColor}`, info.img, sx, 0, info.frameW, info.frameH, outlineColor);
        const padX = Math.round(scale * squashX);
        const padY = Math.round(scale * squashY);
        ctx.drawImage(
          outlined,
          0, 0, outlined.width, outlined.height,
          -Math.round(dw / 2) - padX, -dh + footOffset - padY, dw + padX * 2, dh + padY * 2
        );
      } else {
        ctx.drawImage(
          info.img,
          sx, 0, info.frameW, info.frameH,
          -Math.round(dw / 2), -dh + footOffset, dw, dh
        );
      }

      if (flashWhite > 0.02) {
        const fc = this._getWhiteFlashCell(info.img, sx, 0, info.frameW, info.frameH);
        ctx.globalAlpha = Math.min(1, alpha * flashWhite);
        ctx.drawImage(fc, 0, 0, info.frameW, info.frameH, -Math.round(dw / 2), -dh + footOffset, dw, dh);
      }
      ctx.restore();
    }

    createDomSprite(unitId, anim = 'idle', size = 72) {
      // 1. Duelyst H5 Kit animated DOM canvas preview
      const kit = this.initKit();
      if (kit && kit.unit(unitId, 'idle')) {
        const wrap = document.createElement('div');
        wrap.className = 'duelyst-dom-sprite duelyst-kit-dom';
        const cw = Math.round(size * 1.15);
        const ch = Math.round(size * 1.12);
        wrap.style.width = `${cw}px`;
        wrap.style.height = `${ch}px`;
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        canvas.style.width = `${cw}px`;
        canvas.style.height = `${ch}px`;
        canvas.style.imageRendering = 'pixelated';
        wrap.appendChild(canvas);
        this.domCanvases.push({ canvas, ctx: canvas.getContext('2d'), unitId, anim, t0: performance.now() });
        return wrap;
      }

      // 2. Legacy UNIT_MANIFEST CSS strip preview
      const info = this.getFrameInfo(unitId, anim);
      const wrap = document.createElement('div');
      wrap.className = 'duelyst-dom-sprite';
      const h = Math.round(size * 1.12);
      const frameDisplayW = info ? Math.round(h * (info.frameW / info.frameH)) : size;
      wrap.style.width = `${frameDisplayW}px`;
      wrap.style.height = `${h}px`;
      if (!info) return wrap;

      const strip = document.createElement('div');
      strip.className = 'duelyst-dom-strip';
      strip.style.width = `${info.frames * frameDisplayW}px`;
      strip.style.height = `${h}px`;
      strip.style.backgroundImage = `url("${info.img.src}")`;
      strip.style.backgroundSize = '100% 100%';
      if (info.frames > 1) {
        const dur = (info.frames / info.fps).toFixed(2);
        strip.style.animation = `duelyst-strip-play ${dur}s steps(${info.frames}, end) infinite`;
      }
      wrap.appendChild(strip);
      return wrap;
    }
  }

  window.MT.sprites = new SpriteLibrary();
})();
