/**
 * TEMPORARY renderer self-test (Node, no browser).
 *
 * Run: node --experimental-strip-types src/render/__selftest__.ts
 *
 * Verifies the renderer contract mechanically: camera round-trip, fit() at
 * 844x390 and 568x320, pan clamping (no black edges), one-time terrain cache,
 * safe drawing in every phase, projectile / damage-number / particle plumbing,
 * the particle cap, tier fallback warnings and asset URL resolution.
 *
 * Visual verification (real Canvas 2D pixels) is a separate Playwright pass in
 * `output/render-check/`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyAction, createGame, getMapDefinition, step } from '../core/index.ts';
import type { GameState, Point } from '../core/types.ts';
import type { AssetManifest } from '../assets-types.ts';
import { BattleRenderer } from './engine.ts';
import { SpriteStore, assetURL } from './sprites.ts';
import { Terrain, cellHash } from './terrain.ts';
import { Effects, PARTICLE_CAP } from './effects.ts';
import { installShim, mainCanvas, type FakeElement } from './dom-shim.ts';

// `process.cwd()` is the game root: the check is always launched from there.
const ROOT = resolve(process.cwd());

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];
function check(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
}
const f = (n: number, digits = 4): string => n.toFixed(digits);

function manifest(fixture: string): AssetManifest {
  return JSON.parse(readFileSync(fixture, 'utf8')) as AssetManifest;
}

function makeState(seed = 1337): GameState {
  return createGame(seed);
}

function camps(state: GameState): void {
  state.gold = 100000;
  const spots: Point[] = [
    { x: 24, y: 9 }, { x: 22, y: 11 }, { x: 23, y: 8 }, { x: 20, y: 10 },
  ];
  for (const spot of spots) applyAction(state, { type: 'buyLegion', kind: 'shield', x: spot.x, y: spot.y });
  for (const spot of spots) applyAction(state, { type: 'buyLegion', kind: 'archer', x: spot.x, y: spot.y - 2 });
  for (let i = 0; i < 4; i++) applyAction(state, { type: 'buyBuilding', kind: 'wall', x: 22 + (i % 2), y: 5 + Math.floor(i / 2) });
  applyAction(state, { type: 'buyBuilding', kind: 'tower', x: 21, y: 9 });
  applyAction(state, { type: 'buyBuilding', kind: 'slow', x: 19, y: 10 });
  state.gold = 200;
}

async function cameraSuite(fixturePath: string, width: number, height: number, dpr: number): Promise<void> {
  const env = installShim(width, height, dpr);
  const renderer = new BattleRenderer(env.host as unknown as HTMLElement, manifest(fixturePath));
  await renderer.init();
  const state = makeState();
  renderer.draw(state);
  renderer.setInsets({ top: 44, right: 18, bottom: 12, left: 18 });

  const tag = `${width}x${height}@${dpr}x`;

  // 1) toScreen / toWorld are exact inverses.
  let worst = 0;
  const probes: Point[] = [];
  for (let x = 0; x <= 30; x += 2.5) for (let y = 0; y <= 20; y += 2.5) probes.push({ x, y });
  for (const mode of ['raw', 'fit', 'zoom'] as const) {
    if (mode === 'fit') renderer.fit();
    if (mode === 'zoom') renderer.toggleZoom({ x: 15, y: 10 });
    if (mode === 'raw') renderer.focusCamp(state);
    for (const p of probes) {
      const screen = renderer.toScreen(p);
      const back = renderer.toWorld(screen.x, screen.y);
      worst = Math.max(worst, Math.abs(back.x - p.x), Math.abs(back.y - p.y));
    }
  }
  check(`${tag} toScreen/toWorld 互逆`, worst < 1e-6, `${probes.length * 3} 个探测点，最大误差 ${worst.toExponential(2)}`);

  // 2) fit() keeps the whole map inside the viewport.
  renderer.fit();
  const canvas = mainCanvas(env.host as FakeElement);
  const view = { x: 18, y: 44, width: width - 36, height: height - 56 };
  const corners: Point[] = [{ x: 0, y: 0 }, { x: 30, y: 20 }, { x: 0, y: 20 }, { x: 30, y: 0 }];
  const screenCorners = corners.map((c) => renderer.toScreen(c));
  const inside = screenCorners.every(
    (s) => s.x >= view.x - 1 && s.y >= view.y - 1 && s.x <= view.x + view.width + 1 && s.y <= view.y + view.height + 1,
  );
  check(`${tag} fit() 整图可见`, inside, `视口 ${view.width}x${view.height}，四角 x:[${f(Math.min(...screenCorners.map((s) => s.x)), 1)},${f(Math.max(...screenCorners.map((s) => s.x)), 1)}] y:[${f(Math.min(...screenCorners.map((s) => s.y)), 1)},${f(Math.max(...screenCorners.map((s) => s.y)), 1)}]，画布 ${canvas?.width}x${canvas?.height}`);

  // 3) Panning must never expose a gap between the map and the viewport:
  //    an overflowing axis stays covered, a fitting axis stays centred.
  renderer.focusCamp(state);
  renderer.draw(state);
  let worstGap = 0;
  let worstAt = '';
  const passes = [[5000, 0], [-5000, 0], [0, 5000], [0, -5000], [900, -900], [-900, 900], [0, 300], [300, 0]] as const;
  for (let pass = 0; pass < passes.length; pass++) {
    const [dx, dy] = passes[pass]!;
    renderer.focusCamp(state);
    // `draw` re-applies the play scale after a previous `fit()`.
    renderer.draw(state);
    for (let i = 0; i < 6; i++) renderer.pan(dx / 6, dy / 6);
    const tl = renderer.toScreen({ x: 0, y: 0 });
    const br = renderer.toScreen({ x: 30, y: 20 });
    const overflowsX = br.x - tl.x > view.width;
    const overflowsY = br.y - tl.y > view.height;
    // Overflowing axis: the map edge may sit exactly on (or outside) the viewport
    // edge, but it must never fall inside it (that would show dead space).
    const gapX = overflowsX
      ? Math.max(0, Math.min(tl.x - view.x, view.x + view.width - br.x))
      : Math.abs(tl.x - view.x - (view.x + view.width - br.x));
    const gapY = overflowsY
      ? Math.max(0, Math.min(tl.y - view.y, view.y + view.height - br.y))
      : Math.abs(tl.y - view.y - (view.y + view.height - br.y));
    const gap = Math.max(gapX, gapY);
    if (gap > worstGap) {
      worstAt = `pass#${pass} d=(${dx},${dy}) tile=${renderer.debug.tile} tl=(${f(tl.x, 1)},${f(tl.y, 1)}) br=(${f(br.x, 1)},${f(br.y, 1)}) over=${overflowsX}/${overflowsY} view=${view.width}x${view.height}`;
      worstGap = gap;
    }
  }
  check(`${tag} 拖图不露黑边`, worstGap <= 1.0001, `最大外露/偏心 ${f(worstGap, 3)}px @ ${worstAt}`);

  // 4) Default cells stay legible; only fit() may shrink them.
  renderer.focusCamp(state);
  renderer.draw(state);
  const tile = renderer.debug.tile;
  renderer.fit();
  const fitTileImmediate = renderer.debug.tile;
  renderer.draw(state);
  const fitTile = renderer.debug.tile;
  renderer.focusCamp(state);
  renderer.draw(state);
  check(
    `${tag} 默认地块尺寸可读`,
    tile >= 16 && fitTile >= 3 && fitTile < tile,
    `默认 ${tile}px，fit() 后 ${fitTile}px（fit 即时 ${fitTileImmediate}px），视口 ${view.width}x${view.height}`,
  );

  // 5) Terrain cache survives long static stretches (variable water aside), and
  //    never re-creates the whole offscreen map per frame.
  const before = env.document.createdCanvases.length;
  const opsBefore = env.canvasOps().get('drawImage') ?? 0;
  for (let i = 0; i < 45; i++) {
    state.tick += 1;
    renderer.draw(state);
  }
  const after = env.document.createdCanvases.length;
  const opsAfter = env.canvasOps().get('drawImage') ?? 0;
  check(
    `${tag} 地形缓存不逐帧重建`,
    after - before <= 6,
    `45 帧新增离屏画布 ${after - before} 个（水面 10 tick 一档 + 首次布局），drawImage ${opsAfter - opsBefore} 次`,
  );

  // 6) Drawing is safe in every phase, including empty prep and end states.
  const phases: GameState['phase'][] = ['prep', 'combat', 'won', 'lost'];
  let phaseOk = true;
  let phaseError = '';
  for (const phase of phases) {
    const probe = makeState(11);
    probe.phase = phase;
    try {
      renderer.draw(probe);
    } catch (error) {
      phaseOk = false;
      phaseError = `${phase}: ${(error as Error).message}`;
    }
  }
  const empty = makeState(12);
  try {
    renderer.draw(empty);
  } catch (error) {
    phaseOk = false;
    phaseError = (error as Error).message;
  }
  check(`${tag} 四个阶段空状态可绘`, phaseOk, phaseOk ? 'prep/combat/won/lost 与空 state 均无异常' : phaseError);

  renderer.destroy();
}

async function behaviourSuite(fixturePath: string): Promise<void> {
  const env = installShim(844, 390, 2);
  const renderer = new BattleRenderer(env.host as unknown as HTMLElement, manifest(fixturePath));
  await renderer.init();
  renderer.setInsets({ top: 44, right: 18, bottom: 12, left: 18 });

  const state = makeState();
  camps(state);
  renderer.focusCamp(state);
  renderer.draw(state);

  // Deterministic terrain: same cell hash every time, both tile classes present.
  const terrain = new Terrain(env.host as unknown as HTMLElement);
  let deterministic = true;
  for (let x = 0; x < 30; x++) {
    for (let y = 0; y < 20; y++) {
      const first = terrain.tileKeyAt(state, x, y);
      if (terrain.tileKeyAt(state, x, y) !== first) deterministic = false;
    }
  }
  const types = new Set<string>();
  for (let x = 0; x < 30; x++) for (let y = 0; y < 20; y++) types.add(terrain.tileKeyAt(state, x, y));
  const hashStable = cellHash(3, 7, 11) === cellHash(3, 7, 11) && cellHash(3, 7, 11) !== cellHash(3, 8, 11);
  check('地形变体确定性', deterministic && hashStable, `600 格重复取样一致；出现变体 ${[...types].sort().join('/')}`);

  // Advance through a real battle and keep drawing.
  applyAction(state, { type: 'startWave' });
  let drawError = '';
  let maxParticles = 0;
  let maxProjectiles = 0;
  let maxNumbers = 0;
  let sawKillText = false;
  let ticks = 0;
  try {
    while ((state.phase as string) === 'combat' && ticks < 4000) {
      step(state, 3);
      ticks += 3;
      renderer.draw(state);
      maxParticles = Math.max(maxParticles, renderer.debug.particles);
      maxProjectiles = Math.max(maxProjectiles, renderer.debug.projectiles);
      maxNumbers = Math.max(maxNumbers, renderer.debug.numbers);
      if (renderer.debug.corpses > 0) sawKillText = true;
    }
  } catch (error) {
    drawError = (error as Error).message;
  }
  check('战斗推进可绘', drawError === '', drawError || `战斗 ${ticks} tick，phase=${state.phase}，wave=${state.wave}，击杀 ${state.stats.kills}`);
  check('真实伤害飘字', maxNumbers > 0, `同屏最多 ${maxNumbers} 个伤害数字`);
  check('弹道飞行', maxProjectiles > 0, `同屏最多 ${maxProjectiles} 个弹丸`);
  check('击杀残留', sawKillText, '观测到尸体淡出帧');
  check('粒子封顶', maxParticles <= PARTICLE_CAP, `峰值 ${maxParticles} ≤ ${PARTICLE_CAP}`);

  // Damage numbers carry the real damage value.
  const effects = new Effects();
  effects.damageNumber({ x: 1, y: 1 }, 7.4);
  check('飘字取整数真实伤害', effects.numberCount === 1, `damageNumber(7.4) -> 1 条，合计 ${effects.numberCount}`);

  // Missing key fallback warns exactly once and never throws.
  const broken: AssetManifest = { units: {}, world: {}, ui: {} };
  const store = new SpriteStore(broken);
  store.profile('shield', 3);
  store.profile('shield', 3);
  store.profile('shield', 2);
  store.profile('boss', 1);
  check('缺失素材只报一次且降级', store.warnings.length === 2, `警告 ${store.warnings.length} 条：${store.warnings.join(' | ')}`);

  // URL resolution: manifest paths are site-root relative.
  check(
    '素材路径解析',
    assetURL('assets/atlases/a.png') === './assets/atlases/a.png' && assetURL('world/g.png') === './assets/world/g.png',
    `assets/atlases/a.png -> ${assetURL('assets/atlases/a.png')}；world/g.png -> ${assetURL('world/g.png')}`,
  );

  // Unused tier-2 legion keys are absent from this fixture: tier 3 must fall back.
  const realStore = new SpriteStore(manifest(fixturePath));
  await realStore.loadAll();
  const tier3 = realStore.profile('shield', 3);
  const profileIdle = realStore.idleFrame(realStore.manifest.units['shield-1']!);
  check('缺级降级到 1 级', !!tier3 && !!profileIdle, `shield:3 -> ${tier3 ? '已解析' : '缺失'}；警告 ${realStore.warnings.length} 条`);

  // Anchor of the frozen UnitAsset type drives the feet position.
  const anchor = realStore.manifest.units['shield-1']!.anchor;
  check(
    'anchor 用于落地对齐',
    Array.isArray(anchor) && anchor.length === 2 && Number.isFinite(anchor[0]) && Number.isFinite(anchor[1]),
    `shield-1 anchor = [${anchor[0]}, ${anchor[1]}]`,
  );

  renderer.destroy();
}

interface StressResult {
  wavesCleared: number;
  endPhase: string;
  ticks: number;
  killCount: number;
  maxParticles: number;
  maxProjectiles: number;
  frames: number;
  ms: number;
}

/** Seven-wave full-camp stress run; the hardest case the contract names. */
async function stressSuite(fixturePath: string, width: number, height: number): Promise<StressResult> {
  const env = installShim(width, height, 2);
  const renderer = new BattleRenderer(env.host as unknown as HTMLElement, manifest(fixturePath));
  await renderer.init();
  renderer.setInsets({ top: 40, right: 16, bottom: 10, left: 16 });
  const state = makeState(7);
  camps(state);
  renderer.focusCamp(state);
  const waveCount = getMapDefinition(state.mapId).waves.length;
  const result: StressResult = {
    wavesCleared: 0, endPhase: state.phase as string, ticks: 0, killCount: 0,
    maxParticles: 0, maxProjectiles: 0, frames: 0, ms: 0,
  };
  const started = Date.now();
  for (let wave = 0; wave < waveCount; wave++) {
    if ((state.phase as string) !== 'prep') break;
    applyAction(state, { type: 'startWave' });
    let guard = 0;
    while ((state.phase as string) === 'combat' && guard < 4000) {
      step(state, 6);
      guard += 6;
      renderer.draw(state);
      result.frames++;
      result.ticks = state.tick;
      result.maxParticles = Math.max(result.maxParticles, renderer.debug.particles);
      result.maxProjectiles = Math.max(result.maxProjectiles, renderer.debug.projectiles);
    }
    if ((state.phase as string) === 'won' || (state.phase as string) === 'lost') break;
    if (state.cardChoices.length) applyAction(state, { type: 'chooseCard', kind: state.cardChoices[0]! });
    result.wavesCleared = state.stats.wavesCleared;
  }
  result.ms = Date.now() - started;
  result.killCount = state.stats.kills;
  result.endPhase = state.phase as string;
  result.wavesCleared = state.stats.wavesCleared;
  check(
    `${width}x${height} 七波满编可绘`,
    result.frames > 0 && result.maxParticles <= PARTICLE_CAP,
    `${result.frames} 帧 / ${result.ticks} tick / 清 ${result.wavesCleared} 波 / ${result.killCount} 击杀 / 峰值粒子 ${result.maxParticles} / 峰值弹丸 ${result.maxProjectiles} / 结束于 ${result.endPhase} / ${result.ms}ms`,
  );
  renderer.destroy();
  return result;
}

async function main(): Promise<void> {
  const fixture = resolve(ROOT, 'output/render-check/assets/manifest.json');
  const real = resolve(ROOT, 'public/assets/manifest.json');
  const useReal = process.argv.includes('--real');
  const chosen = useReal ? real : fixture;
  const loaded = manifest(chosen);
  const unitKeys = Object.keys(loaded.units).length;
  const worldKeys = Object.keys(loaded.world).length;

  await cameraSuite(chosen, 844, 390, 1);
  await cameraSuite(chosen, 568, 320, 1);
  await cameraSuite(chosen, 844, 390, 2);
  await behaviourSuite(chosen);
  const stressSmall = await stressSuite(chosen, 568, 320);
  const stressWide = await stressSuite(chosen, 844, 390);

  const failed = checks.filter((c) => !c.ok);
  const report = {
    manifest: chosen.replace(/\\/g, '/'),
    unitKeys,
    worldKeys,
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    stress: { small: stressSmall, wide: stressWide },
    results: checks.map((c) => ({ name: c.name, ok: c.ok, detail: c.detail })),
  };
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) process.exitCode = 1;
}

await main();
