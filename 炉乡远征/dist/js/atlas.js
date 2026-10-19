// Exact tinted atlas pixels are reusable; bound retained RGBA surfaces to 32 MiB.
const TINT_CACHE_BYTES = 32 * 1024 * 1024;
const tintCache = new Map();
const tintIds = new WeakMap();
let nextTintId = 0;
let tintBytes = 0;
const tintId = (value) => { if (!tintIds.has(value)) tintIds.set(value, ++nextTintId); return tintIds.get(value); };

function tuple(text) {
  return [...String(text ?? '').matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

function readDict(dict) {
  const result = {};
  const children = Array.from(dict?.children ?? []);
  for (let index = 0; index + 1 < children.length; index += 2) {
    const key = children[index]?.textContent ?? '';
    const value = children[index + 1];
    if (!key || !value) continue;
    if (value.tagName === 'dict') result[key] = readDict(value);
    else if (value.tagName === 'true' || value.tagName === 'false') result[key] = value.tagName === 'true';
    else if (value.tagName === 'integer' || value.tagName === 'real') result[key] = Number(value.textContent);
    else result[key] = value.textContent ?? '';
  }
  return result;
}

export function parsePlist(xml) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const root = readDict(document.querySelector('plist > dict'));
  const rawFrames = root.frames ?? {};
  return Object.entries(rawFrames).map(([name, data]) => {
    const frame = tuple(data.frame ?? data.textureRect);
    const offset = tuple(data.offset ?? data.spriteOffset);
    const sourceRect = tuple(data.sourceColorRect ?? data.spriteSourceSize);
    const sourceSize = tuple(data.sourceSize ?? data.spriteSize);
    return {
      name,
      x: frame[0] ?? 0, y: frame[1] ?? 0, width: frame[2] ?? 0, height: frame[3] ?? 0,
      rotated: Boolean(data.rotated ?? data.textureRotated),
      offsetX: offset[0] ?? 0, offsetY: offset[1] ?? 0,
      sourceX: sourceRect[0] ?? 0, sourceY: sourceRect[1] ?? 0,
      sourceWidth: sourceRect[2] ?? sourceSize[0] ?? frame[2] ?? 0,
      sourceHeight: sourceRect[3] ?? sourceSize[1] ?? frame[3] ?? 0,
      canvasWidth: sourceSize[0] ?? sourceRect[2] ?? frame[2] ?? 0,
      canvasHeight: sourceSize[1] ?? sourceRect[3] ?? frame[3] ?? 0
    };
  });
}

export function framesWithPrefix(frames, prefix = '') {
  return frames.filter((frame) => frame.name.startsWith(prefix)).sort((a, b) => {
    const aOrdinal = Number(a.name.match(/(\d+)(?=\.[^.]+$)/)?.[1] ?? 0);
    const bOrdinal = Number(b.name.match(/(\d+)(?=\.[^.]+$)/)?.[1] ?? 0);
    return aOrdinal - bOrdinal || a.name.localeCompare(b.name);
  });
}

export function drawAtlasFrame(ctx, image, frame, x, y, options = {}) {
  if (!ctx || !image || !frame) return;
  if (options.tint || options.resting) {
    const width = frame.canvasWidth || frame.sourceWidth || (frame.rotated ? frame.height : frame.width);
    const height = frame.canvasHeight || frame.sourceHeight || (frame.rotated ? frame.width : frame.height);
    const key = `${tintId(image)}:${tintId(frame)}:${options.tint}:${options.tintAlpha ?? .32}:${Boolean(options.resting)}`;
    let isolated = tintCache.get(key)?.canvas;
    if (!isolated) {
      isolated = document.createElement('canvas');
      isolated.width = Math.max(1, Math.ceil(width)); isolated.height = Math.max(1, Math.ceil(height));
      const isolatedContext = isolated.getContext('2d');
      drawAtlasFrame(isolatedContext, image, frame, width / 2, height / 2, { scale: 1 });
      if (options.resting) {
        // Canvas filters are missing in some mobile WebViews. Cache actual muted
        // pixels so action availability has the same appearance on every host.
        const pixels = isolatedContext.getImageData(0, 0, isolated.width, isolated.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const gray = Math.round((pixels.data[i] * .2126 + pixels.data[i + 1] * .7152 + pixels.data[i + 2] * .0722) * .78);
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray;
        }
        isolatedContext.putImageData(pixels, 0, 0);
      }
      if (options.tint) {
      const mask = document.createElement('canvas');
      mask.width = isolated.width; mask.height = isolated.height;
      mask.getContext('2d').drawImage(isolated, 0, 0);
      isolatedContext.globalCompositeOperation = 'multiply';
      isolatedContext.globalAlpha = options.tintAlpha ?? .32;
      isolatedContext.fillStyle = options.tint;
      isolatedContext.fillRect(0, 0, width, height);
      isolatedContext.globalCompositeOperation = 'destination-in';
      isolatedContext.globalAlpha = 1;
      isolatedContext.drawImage(mask, 0, 0);
      }
      const bytes = isolated.width * isolated.height * 4;
      while (tintBytes + bytes > TINT_CACHE_BYTES && tintCache.size) {
        const oldest = tintCache.keys().next().value;
        tintBytes -= tintCache.get(oldest).bytes; tintCache.delete(oldest);
      }
      if (bytes <= TINT_CACHE_BYTES) { tintCache.set(key, {canvas:isolated,bytes}); tintBytes += bytes; }
    } else {
      const cached = tintCache.get(key); tintCache.delete(key); tintCache.set(key,cached);
    }
    const clean = { ...options, tint: null, glow: 0 };
    ctx.save();
    ctx.translate(x, y); ctx.rotate((clean.rotation ?? 0) * Math.PI / 180);
    ctx.scale((clean.scaleX ?? clean.scale ?? 1) * (clean.flipX ? -1 : 1), (clean.scaleY ?? clean.scale ?? 1) * (clean.flipY ? -1 : 1));
    ctx.globalAlpha *= clean.alpha ?? 1;
    if (options.resting) ctx.imageSmoothingEnabled = false;
    ctx.drawImage(isolated, -width / 2, -height / 2);
    ctx.restore();
    return;
  }
  const scaleX = (options.scaleX ?? options.scale ?? 1) * (options.flipX ? -1 : 1);
  const scaleY = (options.scaleY ?? options.scale ?? 1) * (options.flipY ? -1 : 1);
  const logicalWidth = frame.canvasWidth || frame.sourceWidth || (frame.rotated ? frame.height : frame.width);
  const logicalHeight = frame.canvasHeight || frame.sourceHeight || (frame.rotated ? frame.width : frame.height);
  const sourceWidth = frame.rotated ? frame.height : frame.width;
  const sourceHeight = frame.rotated ? frame.width : frame.height;
  const placedX = frame.sourceX || (logicalWidth - sourceWidth) / 2 + frame.offsetX;
  const placedY = frame.sourceY || (logicalHeight - sourceHeight) / 2 - frame.offsetY;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((options.rotation ?? 0) * Math.PI / 180);
  ctx.scale(scaleX, scaleY);
  ctx.globalAlpha *= options.alpha ?? 1;
  ctx.imageSmoothingEnabled = false;
  const dx = placedX - logicalWidth / 2;
  const dy = placedY - logicalHeight / 2;
  if (frame.rotated) {
    ctx.translate(dx, dy + sourceHeight);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
  } else {
    ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, dx, dy, frame.width, frame.height);
  }
  ctx.restore();
}
