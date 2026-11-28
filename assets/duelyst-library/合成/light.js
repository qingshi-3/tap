// Duelyst board-plane lighting. Render the opaque diffuse board first, call this
// once with ALL lights, then draw decals, actors, particles and UI. Repaint the
// diffuse board on every frame, including seeks. All coordinates use board pixels
// (95 per tile); the current Canvas2D transform maps them to backing pixels.
//
// render(ctx, lights, timeMs [, {ambientColor, falloffModifier, intensityModifier}])
// ambientColor = combined global + receiver RGB in byte units (FX default 89).
// BattleMap._setupLights selects per-map ambient and sets both modifiers to 2,
// but FX._initShaderUniforms uploads 1/1 at construction. The subsequent setters
// only change JS fields. Defaults below follow the uniform writes in this ZIP.
//
// Each light: {conf, place(ageMs) -> {x,y,z?}, start, ms?, parentBaseMs?,
// parentOpacity?}. place resolves offsets and movement; z is extra height above
// the plane. ms is an optional hard removal time measured from start. A child
// with zero/missing duration inherits the FXSprite base duration (parentBaseMs).
// parentOpacity is the cascaded parent opacity (0..255 or function of ageMs).
// lifeMs(conf, parentBaseMs) returns the natural lifetime, possibly Infinity.
(() => {
  'use strict';

  const WHITE = {r: 255, g: 255, b: 255};
  const AMBIENT = {r: 89, g: 89, b: 89};
  const DEFAULT_RADIUS = 3 * 95;
  const cache = new WeakMap();

  function timing(conf, parentBaseMs) {
    const duration = (conf.duration || 0) * 1000 || parentBaseMs || 0;
    const inPct = conf.fadeInDurationPct ?? 0.35;
    const outPct = conf.fadeOutDurationPct ?? 1.5;
    const fadeIn = Math.max(0, (conf.fadeInDuration || 0) * 1000 + duration * inPct);
    const fadeOut = Math.max(0, (conf.fadeOutDuration || 0) * 1000 + duration * outPct);
    const hold = Math.max(0, duration - duration * (inPct + outPct));
    const end = duration > 0 || fadeOut > 0 ? fadeIn + hold + fadeOut : Infinity;
    return {fadeIn, fadeOut, hold, end};
  }

  function lifeMs(conf, parentBaseMs = 0) {
    return timing(conf, parentBaseMs).end;
  }

  // Light.startAutoFade -> EaseExponentialOut(fadeIn to 255);
  // NodeInjections.destroy -> EaseExponentialInOut(fadeTo zero).
  function opacityAt(conf, age, t) {
    if (age >= t.end) return 0;
    if (age < t.fadeIn) return 1 - 2 ** (-10 * age / t.fadeIn);
    const peak = t.fadeIn > 0 ? 1 : (conf.opacity ?? 255) / 255;
    const elapsed = age - t.fadeIn - t.hold;
    if (elapsed <= 0 || t.end === Infinity) return peak;
    const u = elapsed / t.fadeOut;
    const remaining = u < 0.5 ? 1 - 0.5 * 2 ** (20 * u - 10) : 0.5 * 2 ** (10 - 20 * u);
    return peak * remaining;
  }

  function batchLights(lights, time) {
    const batch = [];
    let maxIntensity = 1;
    for (const light of lights) {
      const {conf} = light;
      const age = time - light.start;
      if (age < 0 || age >= (light.ms ?? Infinity)) continue;
      const inherited = typeof light.parentOpacity === 'function' ? light.parentOpacity(age) : light.parentOpacity;
      // CCNode.setColor copies RGB only. _realColor.a stays 255 on recipe-created lights.
      const alpha = opacityAt(conf, age, timing(conf, light.parentBaseMs)) * ((inherited ?? 255) / 255);
      const intensity = alpha * (conf.intensity ?? 1);
      if (!(intensity > 0)) continue;
      const {x, y, z = 0} = light.place(age);
      const radius = conf.radius ?? DEFAULT_RADIUS;
      maxIntensity = Math.max(maxIntensity, intensity);
      batch.push({x, y, height: z + 6 * Math.sqrt(radius), radius, color: conf.color || WHITE, alpha, intensity});
    }
    batch.sort((a, b) => a.intensity - b.intensity);
    if (maxIntensity > 1) {
      for (const l of batch) l.alpha *= Math.sqrt(l.intensity / maxIntensity);
    }
    return batch;
  }

  function surface(ctx, width, height) {
    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(width, height) : ctx.canvas.ownerDocument.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext('2d', {alpha: false});
  }

  function buffers(ctx, width, height) {
    let b = cache.get(ctx);
    if (!b || b.diffuse.canvas.width !== width || b.diffuse.canvas.height !== height) {
      // BaseSprite.lightMapScale = 0.5; RenderPass rounds dimensions up.
      const map = surface(ctx, Math.ceil(width / 2), Math.ceil(height / 2));
      b = {map, pixels: map.createImageData(map.canvas.width, map.canvas.height),
        diffuse: surface(ctx, width, height)};
      cache.set(ctx, b);
    }
    return b;
  }

  // LightingVertex + LightingFragment restricted to the horizontal ground plane.
  // Its rotated normal is (0,1,0), depth is the board Y and normalOffset is zero.
  function drawLightMap(b, batch, inverse, options, ambient) {
    const {width, height, data} = b.pixels;
    const stepX = b.diffuse.canvas.width / width;
    const stepY = b.diffuse.canvas.height / height;
    const falloff = options.falloffModifier ?? 1;
    const gain = options.intensityModifier ?? 1;
    data.fill(0);
    for (const l of batch) {
      if (!(l.radius > 0 && l.height > 0 && l.height < l.radius)) continue;
      const radius2 = l.radius * l.radius;
      const height2 = l.height * l.height;
      const {r, g, b: blue} = l.color;
      for (let row = 0; row < height; row++) {
        const py = (row + 0.5) * stepY;
        let dx = inverse.a * 0.5 * stepX + inverse.c * py + inverse.e - l.x;
        let dy = inverse.b * 0.5 * stepX + inverse.d * py + inverse.f - l.y;
        for (let col = 0, i = row * width * 4; col < width; col++, i += 4) {
          const d2 = dx * dx + dy * dy + height2;
          dx += inverse.a * stepX;
          dy += inverse.b * stepX;
          if (d2 >= radius2) continue;
          const d = Math.sqrt(d2);
          const ratio = d / l.radius;
          const attenuation = 1 - (falloff === 1 ? ratio : ratio ** falloff);
          const angle = Math.min(1, Math.max(0, gain * l.height / d));
          const weight = l.alpha * attenuation * angle;
          // SRC_ALPHA, ONE into RGBA8888. Only the accumulated RGB is sampled.
          data[i] += r * weight;
          data[i + 1] += g * weight;
          data[i + 2] += blue * weight;
        }
      }
    }
    // Signed receiver ambient offsets may bring a channel below zero. Move
    // that deficit into its light term to implement max(ambient + light, 0).
    const dr = Math.min(0, ambient.r), dg = Math.min(0, ambient.g), db = Math.min(0, ambient.b);
    for (let i = 0; i < data.length; i += 4) {
      data[i] += dr;
      data[i + 1] += dg;
      data[i + 2] += db;
      data[i + 3] = 255;
    }
    b.map.putImageData(b.pixels, 0, 0);
  }

  function render(ctx, lights, time, options = {}) {
    const {width, height} = ctx.canvas;
    if (!width || !height) return;
    const ambient = options.ambientColor ?? AMBIENT;
    const batch = batchLights(lights, time);
    const inverse = ctx.getTransform().inverse();
    if (!Number.isFinite(inverse.a)) return;
    ctx.save();
    try {
      ctx.resetTransform();
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      ctx.shadowColor = 'transparent';
      let diffuse;
      if (batch.length) {
        const b = buffers(ctx, width, height);
        drawLightMap(b, batch, inverse, options, ambient);
        diffuse = b.diffuse;
        // Canvas-to-Canvas drawing is allowed even when a file:// image taints
        // the source. Only the private, procedural light map uses ImageData.
        diffuse.globalCompositeOperation = 'copy';
        diffuse.drawImage(ctx.canvas, 0, 0);
        diffuse.globalCompositeOperation = 'multiply';
        diffuse.imageSmoothingEnabled = true;
        diffuse.drawImage(b.map.canvas, 0, 0, width, height);
      }
      // MultipliedLightingFragment: D*(A+L) = D*A + D*L. Separating the
      // products preserves gains above one until the final output saturates.
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgb(' + [ambient.r, ambient.g, ambient.b].join(',') + ')';
      ctx.fillRect(0, 0, width, height);
      if (diffuse) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(diffuse.canvas, 0, 0);
      }
    } finally {
      ctx.restore();
    }
  }

  globalThis.CompositeLight = {render, lifeMs};
})();
