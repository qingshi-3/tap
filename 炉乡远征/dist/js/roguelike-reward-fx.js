import { assetImage, assetFetch } from './asset-loading.js';

let assets;
let active;
let generation = 0;

export function prepareRoguelikeRewardFx() {
  assets ??= Promise.all([
    assetImage('./assets/roguelike/chest-open.png'),
    assetFetch('./assets/roguelike/chest-open.json').then(response => response.json())
  ]).catch(() => {
    assets = null;
    return null;
  });
  return assets;
}

export function cancelRoguelikeRewardFx() {
  generation++;
  if (!active) return;
  cancelAnimationFrame(active.frame);
  active.canvas.remove();
  active = null;
}

export async function playRoguelikeRewardFx(target) {
  cancelRoguelikeRewardFx();
  const requested = generation;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches || document.hidden) return;
  const loaded = await prepareRoguelikeRewardFx();
  if (requested !== generation || !loaded || !target?.isConnected || target.closest('[hidden]') || document.hidden || reduced.matches) return;
  const [image, atlas] = loaded;
  const frames = atlas.frames;
  if (!image || !Array.isArray(frames) || !frames.length) return;
  const canvas = document.createElement('canvas');
  canvas.width = 176;
  canvas.height = 112;
  canvas.setAttribute('aria-hidden', 'true');
  const bounds = target.getBoundingClientRect();
  Object.assign(canvas.style, {
    position: 'fixed', width: '132px', height: '84px', pointerEvents: 'none',
    zIndex: '1200', imageRendering: 'pixelated',
    left: `${Math.max(8, Math.min(innerWidth - 140, bounds.right - 132))}px`,
    top: `${Math.max(8, Math.min(innerHeight - 92, bounds.bottom - 20))}px`
  });
  document.body.append(canvas);
  const context = canvas.getContext('2d');
  const playback = active = { canvas, frame: 0 };
  const started = performance.now();
  function render(now) {
    if (active !== playback) return;
    if (!target.isConnected || target.closest('[hidden]') || document.hidden || reduced.matches || now - started >= 1100) {
      cancelRoguelikeRewardFx();
      return;
    }
    const index = Math.min(frames.length - 1, Math.floor((now - started) / 1100 * frames.length));
    const rect = frames[index].frame;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height);
    playback.frame = requestAnimationFrame(render);
  }
  playback.frame = requestAnimationFrame(render);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelRoguelikeRewardFx();
});
