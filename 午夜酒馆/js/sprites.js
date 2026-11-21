// Duelyst pre-sliced horizontal strip loader (zero fetch, 100% file:// compatible)
// Uses exact transform: translateX(0 -> -100%) with steps(N, end) on an N*frameW strip — ZERO drift!
(function () {
  window.MT = window.MT || {};

  class SpriteLibrary {
    constructor() {
      this.manifest = null;
      this.images = new Map();
      this.ready = false;
    }

    async load() {
      this.manifest = window.MT.UNIT_MANIFEST;
      const promises = [];
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
      await Promise.all(promises);
      this.ready = true;
      return this;
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

      const frameW = meta.width || Math.floor(img.width / frames);
      const frameH = meta.height || img.height;
      return { img, frames, frameW, frameH, fps };
    }

    drawUnit(ctx, unitId, anim, timeSec, x, y, opts = {}) {
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
        squashY = 1
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

      if (outlineColor) {
        ctx.shadowColor = outlineColor;
        ctx.shadowBlur = 0;
        ctx.filter = `drop-shadow(2px 0 0 ${outlineColor}) drop-shadow(-2px 0 0 ${outlineColor}) drop-shadow(0 -2px 0 ${outlineColor})`;
      }

      const footOffset = Math.round(dh * 0.11);
      ctx.drawImage(
        info.img,
        sx, 0, info.frameW, info.frameH,
        -Math.round(dw / 2), -dh + footOffset, dw, dh
      );
      ctx.restore();
    }

    createDomSprite(unitId, anim = 'idle', size = 72) {
      const info = this.getFrameInfo(unitId, anim);
      const wrap = document.createElement('div');
      wrap.className = 'duelyst-dom-sprite';
      const h = Math.round(size * 1.12);
      wrap.style.width = `${size}px`;
      wrap.style.height = `${h}px`;
      if (!info) return wrap;

      const strip = document.createElement('div');
      strip.className = 'duelyst-dom-strip';
      strip.style.width = `${info.frames * size}px`;
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
