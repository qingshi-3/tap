import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { navigateCamp } from './ui-navigation.mjs';
import { LEVELS } from '../dist/js/levels.js';
import { EXPEDITION_LEVELS } from '../dist/js/expedition-data.js';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const output = 'output/terrain';
await mkdir(output, { recursive: true });
const results = [], errors = [];
const mapAudit = [...LEVELS.map(level => ({ kind: 'trial', id: level.id, columns: level.map?.columns ?? 9, rows: level.map?.rows ?? 5, tiles: level.map?.tiles ?? [] })),
  ...EXPEDITION_LEVELS.map(level => ({ kind: 'expedition', id: level.id, columns: level.columns, rows: level.rows, tiles: level.tiles ?? [] }))].map(map => {
  const seen = new Set();
  for (const tile of map.tiles) {
    assert.ok(['wall', 'rough', 'outpost'].includes(tile.type), `${map.id}: supported terrain`);
    assert.ok(Number.isInteger(tile.x) && Number.isInteger(tile.y) && tile.x >= 0 && tile.y >= 0 && tile.x < map.columns && tile.y < map.rows, `${map.id}: terrain inside map`);
    assert.ok(!seen.has(`${tile.x},${tile.y}`), `${map.id}: unique terrain coordinate`);
    seen.add(`${tile.x},${tile.y}`);
  }
  return { ...map, counts: Object.fromEntries(['wall', 'rough', 'outpost'].map(type => [type, map.tiles.filter(tile => tile.type === type).length])) };
});
assert.equal(LEVELS.length, 17); assert.equal(EXPEDITION_LEVELS.length, 18);
try {
  for (const width of [844, 568]) {
    const context = await browser.newContext({ viewport: { width, height: width === 844 ? 390 : 320 }, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.addInitScript(async () => {
      const { BoardRenderer } = await import('/js/renderer.js');
      const original = BoardRenderer.prototype.draw;
      BoardRenderer.prototype.draw = function (...args) { window.__renderer = this; return original.apply(this, args); };
    });
    await page.goto(process.env.TRIAL_URL || 'http://127.0.0.1:4223/');
    async function cellPoint(x, y) {
      return page.evaluate(({ x, y }) => {
        const renderer = window.__renderer, bounds = renderer.canvas.getBoundingClientRect();
        const point = renderer.cellGeometry(renderer.boardMetrics(bounds.width, bounds.height), x, y).center;
        return { x: point.x + bounds.left, y: point.y + bounds.top };
      }, { x, y });
    }
    for (const [group, id] of [['basics', 'summon-next-turn'], ['battlefield', 'terrain-detour'], ['factions', 'flight-and-airdrop']]) {
      await navigateCamp(page.locator('#expedition-home'), 'trials');
      await page.locator(`[data-group-id="${group}"]`).tap();
      const lesson = page.locator(`[data-action="trial"][data-level-id="${id}"]`);
      await lesson.scrollIntoViewIfNeeded(); await lesson.tap();
      if (await page.locator('#confirm-accept').isVisible()) await page.locator('#confirm-accept').tap();
      await page.waitForFunction(id => window.__renderer?.ready && window.__renderer.state.levelId === id, id);
      if (await page.locator('#objective-close').isVisible()) await page.locator('#objective-close').tap();
      await page.screenshot({ path: `${output}/${id}-${width}.png` });
      const geometry = await page.evaluate(() => {
        const renderer = window.__renderer, bounds = renderer.canvas.getBoundingClientRect();
        const metrics = renderer.boardMetrics(bounds.width, bounds.height);
        const wall = renderer.images.get('terrain-wall');
        return renderer.state.board.tiles.filter(tile => tile.type === 'wall').map(tile => {
          const cell = renderer.cellGeometry(metrics, tile.x, tile.y);
          const height = Math.min(cell.height * .74, cell.width * .9 * wall.naturalHeight / wall.naturalWidth);
          return { x: tile.x, y: tile.y, top: cell.center.y + cell.height * .31 - height, cellTop: cell.points[0].y, bottom: cell.center.y + cell.height * .31, cellBottom: cell.points[2].y };
        });
      });
      assert.ok(geometry.length > 0);
      for (const wall of geometry) {
        assert.ok(wall.top >= wall.cellTop - 1, `${id}: wall intrudes into previous row`);
        assert.ok(wall.bottom <= wall.cellBottom, `${id}: wall intrudes into next row`);
      }
      if (id === 'summon-next-turn') {
        await page.locator('#hand button').first().tap();
        const wallPoint = await cellPoint(6, 1);
        await page.touchscreen.tap(wallPoint.x, wallPoint.y);
        assert.equal(await page.evaluate(() => window.__renderer.state.units.some(unit => unit.x === 6 && unit.y === 1)), false);
        await page.keyboard.press('Escape');
        await page.locator('#hand button').first().tap();
        const point = await cellPoint(6, 2);
        await page.touchscreen.tap(point.x, point.y);
        await page.waitForFunction(() => window.__renderer.state.units.some(unit => unit.owner === 0 && unit.x === 6 && unit.y === 2));
        await page.screenshot({ path: `${output}/${id}-summoned-${width}.png` });
      }
      if (id === 'terrain-detour') {
        const from = await cellPoint(1, 2), to = await cellPoint(1, 1);
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
        for (let step = 1; step <= 8; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 8, y: from.y + (to.y - from.y) * step / 8 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForFunction(() => window.__renderer.state.units.some(unit => unit.owner === 0 && unit.x === 1 && unit.y === 1));
        await page.waitForFunction(() => !document.querySelector('#end-turn').disabled);
        await page.screenshot({ path: `${output}/${id}-rough-entered-${width}.png` });
        await cdp.detach();
      }
      results.push({ width, id, walls: geometry.length, containedWithinRows: true, ...(id === 'summon-next-turn' ? { wallRejectedSummon: true, centerGapTouchSummon: true } : id === 'terrain-detour' ? { roughEnteredByTouchDrag: true } : {}) });
      // A fresh document also checks that terrain assets reload correctly;
      // unfinished lessons remain in this disposable browser context only.
      await page.reload();
    }
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 568, height: 320 }, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(async () => {
    const { BoardRenderer } = await import('/js/renderer.js'), original = BoardRenderer.prototype.draw;
    BoardRenderer.prototype.draw = function (...args) { window.__renderer = this; return original.apply(this, args); };
  });
  await page.goto(process.env.TRIAL_URL || 'http://127.0.0.1:4223/');
  await page.evaluate(async () => {
    const { ExpeditionProgress } = await import('/js/expedition-progress.js');
    const { createExpeditionMatch } = await import('/js/engine.js');
    const profile = new ExpeditionProgress(localStorage), seed = profile.state;
    seed.legacyUnlockedLevels.push('banners-02');
    const result = profile.replaceState(seed);
    if (!result.ok) throw new Error(result.error);
    const saved = profile.saveBattle(createExpeditionMatch('banners-02', seed.training, seed.squad, seed.selectedHeroId, profile.getBattleLoadout()));
    if (!saved.ok) throw new Error(saved.error);
  });
  await page.reload();
  await page.locator('.menu-play').tap();
  await page.waitForFunction(() => window.__renderer?.ready);
  if (await page.locator('#objective-close').isVisible()) {
    await page.screenshot({ path: `${output}/banners-02-objective-568.png` });
    await page.locator('#objective-close').tap();
  }
  if (await page.evaluate(() => window.__renderer.state.phase === 'mulligan')) await page.locator('#end-turn').tap();
  await page.waitForFunction(() => window.__renderer.state.phase === 'playing');
  async function measure() {
    return page.evaluate(() => {
      const renderer = window.__renderer, bounds = renderer.canvas.getBoundingClientRect(), metrics = renderer.boardMetrics(bounds.width, bounds.height);
      const terrain = renderer.state.board.tiles.map(tile => {
        const cell = renderer.cellGeometry(metrics, tile.x, tile.y);
        return { ...tile, center: cell.center, foot: { x: cell.center.x, y: cell.center.y + cell.height * .31 } };
      });
      const empty = Array.from({ length: metrics.rows }, (_, y) => Array.from({ length: metrics.columns }, (_, x) => ({ x, y }))).flat()
        .filter(cell => !renderer.state.units.some(unit => unit.x === cell.x && unit.y === cell.y))
        .map(cell => { const point = renderer.cellGeometry(metrics, cell.x, cell.y).center; return { x: point.x + bounds.left, y: point.y + bounds.top }; })
        .find(point => point.x > 90 && point.x < bounds.right - 60 && point.y > 145 && point.y < 205 && document.elementFromPoint(point.x, point.y) === renderer.canvas);
      return { camera: { ...renderer.camera }, terrain, empty, columns: metrics.columns, rows: metrics.rows };
    });
  }
  const before = await measure(); assert.equal(before.columns, 13); assert.ok(before.empty);
  await page.screenshot({ path: `${output}/banners-02-before-pan-568.png` });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [before.empty] });
  for (let step = 1; step <= 10; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: before.empty.x - step * 10, y: before.empty.y + step * 4 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const after = await measure(); assert.notDeepEqual(after.camera, before.camera);
  for (let index = 0; index < before.terrain.length; index++) {
    assert.ok(Math.abs(after.terrain[index].foot.x - before.terrain[index].foot.x - (after.camera.x - before.camera.x)) < .01);
    assert.ok(Math.abs(after.terrain[index].foot.y - before.terrain[index].foot.y - (after.camera.y - before.camera.y)) < .01);
  }
  await page.screenshot({ path: `${output}/banners-02-after-pan-568.png` });
  // This colour comparison is an isolated preview variant, not a product theme.
  await page.addStyleTag({ content: '.battle-layers{background-image:url("./assets/maps/battlemap7_background.png")!important}.battle-midground{background-image:url("./assets/maps/battlemap7_middleground.png")!important}.battle-foreground{display:none!important}' });
  await page.evaluate(() => Promise.all(['battlemap7_background.png', 'battlemap7_middleground.png'].map(name => new Promise((resolve, reject) => { const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = `./assets/maps/${name}`; }))));
  await page.screenshot({ path: `${output}/banners-02-cool-background-568.png` });
  results.push({ id: 'banners-02', width: 568, columns: 13, rows: 9, realTouchMapPan: true, terrainFootFollowsCamera: true, before, after, colourComparison: ['production warm orange', 'isolated cool blue background variant'] });
  await cdp.detach(); await context.close();
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ mapAudit, results, errors }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ results, errors }, null, 2));
