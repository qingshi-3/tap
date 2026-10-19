import { unitAssets } from './assets.js';
import { vfxAssets } from './vfx-assets.js';
import { WEAPONS } from './combat-content.js';
import { createGame, configureRun, startGame, updateGame } from './simulation.js';
import { createRenderer } from './renderer.js';

const WIDTH = 720, HEIGHT = 400, SECONDS = 10;

function stage(weapon, level, branch) {
  const game = createGame({ seed: 0xc011ab1e, duration: 1000 });
  configureRun(game, { heroId: 'commander', heroJob: 'fighter' });
  startGame(game);
  game.viewport = { width: WIDTH, height: HEIGHT };
  game.world = { width: WIDTH, height: HEIGHT };
  game.previewMode = true;
  game.mapObjects = [];
  game.announcement = { text: '', remaining: 0 };
  game.encounter = { name: '', hint: '', index: 0 };
  game._spawnClock = game._nextSupplyAt = Infinity;
  game._eliteWaves = 3;
  game.player.x = WIDTH / 2;
  game.player.y = HEIGHT / 2;
  // Initialize the production hero kit before equipping the preview ability.
  // Suppress basic attacks through its clock, leaving the selected ability's
  // production damage, cooldowns, entity updates and evolution rules intact.
  updateGame(game, 1 / 60, { x: 0, y: 0 });
  game.heroKit.attackClock = Infinity;
  game.upgrades = Object.fromEntries(WEAPONS.map(item => [item.id, item.id === weapon.id ? level : 0]));
  game.evolutions = branch ? { [weapon.id]: branch } : {};
  game.enemies = Array.from({ length: 12 }, (_, index) => {
    const angle = index / 12 * Math.PI * 2;
    const distance = index % 3 === 0 ? 56 : index % 3 === 1 ? 122 : 175;
    return {
      id: game._nextId++, kind: 'grunt', x: game.player.x + Math.cos(angle) * distance,
      y: game.player.y + Math.sin(angle) * distance, radius: 20,
      hp: 100000, maxHp: 100000, speed: 0, damage: 0, xp: 0,
      elite: false, hitFlash: 0, spawnDelay: 0, anim: 'idle', animTime: index * .13,
      animDuration: 0, facing: -1, aiClock: Infinity, contactClock: Infinity,
    };
  });
  return game;
}

/** Profile-free production combat demonstration; callers own the image bundle. */
export function createCommonPreview({ canvas, images = {}, abilityId, level = 1, branch = null, onState = () => {} } = {}) {
  if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('createCommonPreview requires a canvas element.');
  const weapon = WEAPONS.find(item => item.id === abilityId);
  if (!weapon) throw new RangeError(`Unknown common ability: ${abilityId}`);
  const selectedBranch = weapon.branches.some(item => item.id === branch) ? branch : null;
  const selectedLevel = selectedBranch ? weapon.max : Math.max(1, Math.min(weapon.max, Math.floor(Number(level) || 1)));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Common preview requires a 2D canvas context.');
  const renderCanvas = document.createElement('canvas');
  const renderer = createRenderer(renderCanvas, unitAssets, images, vfxAssets);
  const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let game, elapsed = 0, frameId = 0, lastTime = 0, running = false, disposed = false, observer;
  const report = phase => onState({ phase, caption: phase === 'ready' ? '点击重播查看效果' : phase === 'complete' ? '演示结束 · 可重播' : `${weapon.name} · ${selectedBranch ? weapon.branches.find(item => item.id === selectedBranch).name : `${selectedLevel} 级`} · 实际战斗规则` });

  function draw() {
    if (disposed || !game) return;
    const width = Math.max(1, canvas.clientWidth || canvas.width || 480);
    const height = Math.max(1, canvas.clientHeight || canvas.height || 270);
    const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    renderer.render(game, { width: WIDTH, height: HEIGHT, dpr, reducedMotion: !!motion?.matches });
    if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
    if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#091816';
    context.fillRect(0, 0, width, height);
    const scale = Math.min(width / WIDTH, height / HEIGHT);
    context.drawImage(renderCanvas, 0, 0, renderCanvas.width, renderCanvas.height,
      (width - WIDTH * scale) / 2, (height - HEIGHT * scale) / 2, WIDTH * scale, HEIGHT * scale);
  }

  function stop(phase = 'complete') {
    cancelAnimationFrame(frameId);
    frameId = 0;
    running = false;
    draw();
    report(phase);
  }

  function frame(now) {
    if (disposed || !running) return;
    const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    elapsed += dt;
    // Movement puts new mines along a real path while durable nearby targets
    // trigger them; other abilities retain a stable aiming stage.
    const move = weapon.id === 'mine' ? { x: Math.cos(elapsed * 1.5) * .3, y: Math.sin(elapsed * 1.5) * .3 } : { x: 0, y: 0 };
    updateGame(game, dt, move);
    draw();
    if (elapsed >= SECONDS) stop();
    else frameId = requestAnimationFrame(frame);
  }

  function replay() {
    if (disposed) return false;
    cancelAnimationFrame(frameId);
    game = stage(weapon, selectedLevel, selectedBranch);
    elapsed = 0;
    running = true;
    lastTime = performance.now();
    draw();
    report('playing');
    frameId = requestAnimationFrame(frame);
    return true;
  }

  function motionChange() {
    if (disposed) return;
    if (motion.matches && running) stop('ready');
    else draw();
  }
  // Late-loaded supplied sprites also refresh a reduced-motion still frame.
  const loadingImages = [...new Set(Object.values(images))].filter(image => image?.addEventListener && !image.complete);
  for (const image of loadingImages) image.addEventListener('load', draw);
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(draw);
    observer.observe(canvas);
  }
  motion?.addEventListener?.('change', motionChange);
  game = stage(weapon, selectedLevel, selectedBranch);
  draw();
  if (motion?.matches) report('ready');
  else replay();
  return {
    replay,
    dispose() {
      if (disposed) return;
      disposed = true;
      running = false;
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      motion?.removeEventListener?.('change', motionChange);
      for (const image of loadingImages) image.removeEventListener('load', draw);
      renderer.destroy();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      game = null;
    },
  };
}
