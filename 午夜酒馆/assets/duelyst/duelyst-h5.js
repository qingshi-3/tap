(() => {
  'use strict';

  const scriptURL = document.currentScript?.src;
  const defaultBase = new URL('.', scriptURL || document.baseURI);
  const lookup = (table, key) => table && Object.hasOwn(table, key) ? table[key] : undefined;

  function duration(clip) {
    return clip.count * clip.ms;
  }

  function frame(clip, elapsedMs, {loop = false} = {}) {
    if (!clip || !Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
    const {width, height, count, cols, ms} = clip;
    const step = count === 1 && ms === 0 ? 0 : Math.floor(elapsedMs / ms);
    if (!loop && step >= count) return null;
    const index = step % count;
    return {index, sx:(index % cols) * width, sy:Math.floor(index / cols) * height, width, height};
  }

  function draw(ctx, clip, image, elapsedMs, x, y, {loop = false, scale = 1, flipX = false} = {}) {
    const cell = frame(clip, elapsedMs, {loop});
    if (!cell || !image) return false;
    const {sx, sy, width, height} = cell;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flipX ? -scale : scale, scale);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, sx, sy, width, height, -clip.anchorX, -clip.anchorY, width, height);
    ctx.restore();
    return true;
  }

  function create({baseURL = defaultBase, manifest = globalThis.DuelystH5Manifest} = {}) {
    if (manifest?.version !== 1) throw new Error('Load the Duelyst H5 v1 asset manifest before creating the player.');
    const base = new URL(baseURL, document.baseURI);
    base.pathname = base.pathname.replace(/\/?$/, '/');
    const loaded = new Map();

    function assetURL(asset) {
      if (!asset?.path) throw new TypeError('An asset record with a path is required.');
      return new URL(asset.path, base).href;
    }

    function image(asset) {
      const url = assetURL(asset);
      if (!loaded.has(url)) {
        const promise = new Promise((resolve, reject) => {
          const bitmap = new Image();
          bitmap.onload = () => resolve(bitmap);
          bitmap.onerror = () => reject(new Error('Failed to load image: ' + url));
          bitmap.src = url;
        });
        loaded.set(url, promise);
        // A later preload can retry failures, including an interrupted deployment.
        promise.catch(() => loaded.delete(url));
      }
      return loaded.get(url);
    }

    return {
      manifest,
      unit: (id, action) => lookup(lookup(manifest.units, id)?.actions, action),
      effect: key => lookup(manifest.effects, key),
      icon: id => lookup(manifest.icons, id),
      duration, frame, draw, assetURL, image
    };
  }

  globalThis.DuelystH5 = {create};
})();
