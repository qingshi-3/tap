import './css/title-atmosphere.css';

const WIDTH = 640;
const HEIGHT = 360;
const DITHER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Low-alpha pixel shading is cached once; moving light only transforms these sprites. */
function moonlightTexture(halo: boolean, breadth = 40, phase = 0, spread = .012): HTMLCanvasElement {
  const texture = document.createElement('canvas');
  texture.width = halo ? 144 : 720;
  texture.height = halo ? 144 : Math.ceil((breadth + 720 * spread) * 2 + 8);
  const ctx = texture.getContext('2d')!;
  for (let y = 0; y < texture.height; y += 2) {
    for (let x = 0; x < texture.width; x += 2) {
      const dither = DITHER[((y / 2) % 4) * 4 + (x / 2) % 4] / 16;
      let density: number;
      if (halo) {
        const radius = Math.hypot((x - 68) * .9, (y - 78) * 1.12);
        density = Math.max(0, 1 - radius / 70) ** 2;
        // Preserve the authored crescent rather than whitening its silhouette.
        density *= Math.min(1, Math.max(0, (radius - 16) / 12));
        density *= .55 + .26 * Math.sin(x * .043 + y * .026)
          + .17 * Math.sin(y * .075 - x * .021);
      } else {
        // Continuous slender shafts keep their direction across the screen.
        // Clouds soften their brightness, without breaking them into bright blobs.
        const center = texture.height / 2 + Math.sin(x * .006 + phase) * breadth * .07;
        const width = breadth * (.65 + .35 * Math.min(1, x / 180))
          + x * spread;
        const cross = Math.max(0, 1 - Math.abs(y - center) / width);
        const cloud = .76 + .12 * Math.sin(x * .009 + phase)
          + .07 * Math.sin(x * .024 + y * .012 + phase * 2);
        const rootProgress = Math.min(1, x / 48);
        const rootFade = rootProgress * rootProgress * (3 - 2 * rootProgress);
        // Counter concentrated overlap near the moon; recover brightness outward.
        const outward = Math.min(1, x / 260);
        const rootDimming = .12 + .88 * outward * outward * (3 - 2 * outward);
        const ends = rootFade * rootDimming * Math.min(1, (720 - x) / 90)
          * (1 - x / 1400);
        density = cross ** 1.8 * cloud * ends;
      }
      const opacity = Math.max(0, Math.floor(density * 12 + dither) / 12);
      if (!opacity) continue;
      ctx.fillStyle = `rgba(${halo ? '205,187,233' : '202,211,239'},${opacity})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  return texture;
}

/** Cached, tileable wisps: no image-data work is performed by the animation loop. */
function mistTexture(height: number, phase: number, color: string): HTMLCanvasElement {
  const texture = document.createElement('canvas');
  texture.width = WIDTH;
  texture.height = height;
  const ctx = texture.getContext('2d')!;
  ctx.fillStyle = color;
  for (let x = 0; x < WIDTH; x += 2) {
    const wave = x / WIDTH * Math.PI * 2;
    const center = height * (.48 + .13 * Math.sin(wave * 3 + phase) + .09 * Math.sin(wave * 7));
    const thickness = height * (.15 + .07 * Math.sin(wave * 2 + phase));
    const body = .65 + .35 * Math.sin(wave * 4 + phase);
    for (let y = 0; y < height; y += 2) {
      const density = Math.max(0, 1 - Math.abs(y - center) / thickness) * body;
      const threshold = DITHER[((y / 2) % 4) * 4 + (x / 2) % 4] / 16;
      if (density > threshold) ctx.fillRect(x, y, 2, 2);
    }
  }
  return texture;
}

function backdropStars() {
  let seed = 7;
  const random = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  const stars: { x: number; y: number; warm: boolean; phase: number }[] = [];
  // Consume the same random sequence as pixel.ts, including skipped moon stars.
  for (let k = 0; k < 90; k++) {
    const x = Math.floor(random() * 320), y = Math.floor(random() * 100);
    if (Math.hypot(x - 262, y - 30) < 22) continue;
    random();
    const warm = random() >= .7;
    if (y < 62 && k % 3 === 0) stars.push({ x: x * 2, y: y * 2, warm, phase: k * 1.71 });
  }
  return stars;
}

/** Owned by the title screen; call dispose before replacing that screen. */
export function mountTitleAtmosphere(host: HTMLElement): { dispose(): void } {
  const canvas = document.createElement('canvas');
  canvas.className = 'title-atmosphere';
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dispose: () => canvas.remove() };
  ctx.imageSmoothingEnabled = false;
  const stars = backdropStars();
  const halo = moonlightTexture(true);
  // Only the local moon halo remains; no shafts are generated or animated.
  const moonlitBackdrop = document.createElement('canvas');
  moonlitBackdrop.width = WIDTH;
  moonlitBackdrop.height = HEIGHT;
  const moonlitContext = moonlitBackdrop.getContext('2d')!;
  moonlitContext.imageSmoothingEnabled = true;
  moonlitContext.globalAlpha = .48;
  moonlitContext.drawImage(halo, 452, -12);
  const shimmer = document.createElement('canvas');
  shimmer.width = shimmer.height = 12;
  const shimmerContext = shimmer.getContext('2d')!;
  for (let y = 0; y < 12; y += 2) for (let x = 0; x < 12; x += 2) {
    const density = Math.max(0, 1 - Math.hypot(x - 5, y - 5) / 6) ** 2;
    shimmerContext.fillStyle = `rgba(224,215,249,${density})`;
    shimmerContext.fillRect(x, y, 2, 2);
  }
  // Small soft patches concentrate below/left of the moon, clear of the toolbar.
  const shimmerPoints = [
    [498, 58, 8], [485, 70, 6], [505, 83, 10], [476, 91, 7],
    [517, 101, 8], [492, 109, 6], [465, 61, 6], [528, 87, 7],
    [507, 119, 8], [479, 117, 5],
  ];
  const layers = [
    { texture: mistTexture(58, .8, '#343051'), y: 33, speed: 4, alpha: .30, offset: 0 },
    { texture: mistTexture(58, 2.4, '#51466e'), y: 176, speed: -5.5, alpha: .18, offset: 180 },
    { texture: mistTexture(58, 4.7, '#6b6387'), y: 196, speed: 8, alpha: .14, offset: 35 },
  ];
  // Three tiny cached strips move on the compositor, independently of canvas redraws.
  const fogLayers = layers.map((layer) => {
    const clip = document.createElement('div');
    clip.className = 'title-mist';
    clip.setAttribute('aria-hidden', 'true');
    clip.style.top = `${layer.y / HEIGHT * 100}%`;
    clip.style.height = `${58 / HEIGHT * 100}%`;
    clip.style.opacity = String(layer.alpha);
    const strip = document.createElement('canvas');
    strip.className = 'title-mist-layer';
    // A real static fallback remains when reduced-motion cancels the animation.
    strip.style.transform = `translateX(${-50 + layer.offset / (WIDTH * 2) * 100}%)`;
    strip.width = WIDTH * 2;
    strip.height = 58;
    const stripContext = strip.getContext('2d')!;
    stripContext.drawImage(layer.texture, 0, 0);
    stripContext.drawImage(layer.texture, WIDTH, 0);
    clip.append(strip);
    canvas.after(clip);
    const duration = WIDTH / Math.abs(layer.speed) * 1000;
    const animation = strip.animate([
      { transform: 'translateX(-50%)' }, { transform: 'translateX(0)' },
    ], { duration, iterations: Infinity, easing: 'linear', direction: layer.speed > 0 ? 'normal' : 'reverse' });
    animation.pause();
    const initialTime = (layer.speed > 0 ? layer.offset / WIDTH : 1 - layer.offset / WIDTH) * duration;
    animation.currentTime = initialTime;
    return { clip, animation, initialTime };
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = reduced.matches;
  let disposed = false;
  let frame = 0;
  let lastTime: number | null = null;
  let elapsed = 0;
  const paused = () => document.hidden || document.documentElement.hasAttribute('data-render-paused');

  function draw(time: number) {
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // Soft atmosphere can interpolate subpixels; stars and meteor heads stay crisp.
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
    ctx.drawImage(moonlitBackdrop, 0, 0);
    for (let i = 0; i < shimmerPoints.length; i++) {
      const [x, y, size] = shimmerPoints[i];
      const pulse = .5 + .5 * Math.sin(time * (.28 + i % 4 * .04) + i * 2.37);
      ctx.globalAlpha = .10 + pulse ** 2 * .62;
      ctx.drawImage(shimmer, x - size / 2, y - size / 2, size, size);
    }
    ctx.imageSmoothingEnabled = false;
    for (const star of stars) {
      // Only brighten existing stars; their authored position and shape stay intact.
      ctx.globalAlpha = Math.pow(Math.max(0, Math.sin(time * 1.1 + star.phase)), 5) * .8;
      ctx.fillStyle = star.warm ? '#fff6dc' : '#ffffff';
      ctx.fillRect(star.x, star.y, 2, 2);
    }
    // Five-second cadence, varied sky origins, and a long fading pixel tail.
    const cycle = Math.floor(Math.max(0, time - 1.5) / 5);
    const meteor = (time - 1.5) % 5;
    if (time >= 1.5 && meteor < 1.15) {
      const origins = [90, 335, 198, 420];
      const headX = origins[cycle % origins.length] + meteor * 106;
      const headY = 14 + (cycle % 3) * 8 + meteor * 30;
      const fade = Math.min(1, meteor / .12) * Math.min(1, (1.15 - meteor) / .25);
      for (let i = 29; i >= 0; i--) {
        ctx.globalAlpha = (1 - i / 30) ** 1.5 * fade * .9;
        ctx.fillStyle = i < 5 ? '#f6ebd4' : '#bcb2ed';
        ctx.fillRect(Math.floor(headX - i * 2.8), Math.floor(headY - i * .8), 3, i < 5 ? 2 : 1);
      }
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#fff8e8';
      ctx.fillRect(Math.floor(headX), Math.floor(headY), 4, 3);
    }
    ctx.globalAlpha = 1;
  }

  function tick(now: number) {
    frame = 0;
    if (disposed || paused() || reduceMotion) { lastTime = null; return; }
    if (lastTime === null) lastTime = now;
    const delta = now - lastTime;
    // Soft light/stars redraw at 30fps; fog stays smooth on compositor transforms.
    // sync() clears lastTime across visibility/ad pauses, so resume never jumps.
    if (delta >= 1000 / 30 - .5) {
      elapsed += delta / 1000;
      lastTime = now;
      draw(elapsed);
    }
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    if (disposed) return;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
    for (const fog of fogLayers) {
      if (reduceMotion) {
        // Setting currentTime after pause can resolve a pending WAAPI pause in
        // Chromium. Cancel instead: static inline transform needs no animation.
        fog.animation.cancel();
      } else {
        if (fog.animation.currentTime === null) fog.animation.currentTime = fog.initialTime;
        if (paused()) fog.animation.pause();
        else fog.animation.play();
      }
    }
    if (reduceMotion) draw(0);
    else if (!paused()) frame = requestAnimationFrame(tick);
  }

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-render-paused'] });
  document.addEventListener('visibilitychange', sync);
  const onMotionChange = (event: MediaQueryListEvent) => {
    reduceMotion = event.matches;
    sync();
  };
  reduced.addEventListener('change', onMotionChange);
  draw(0);
  sync();
  return {
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', onMotionChange);
      for (const fog of fogLayers) {
        fog.animation.cancel();
        fog.clip.remove();
      }
      canvas.remove();
    },
  };
}
