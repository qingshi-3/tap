import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { ORDERS, TRUCKS } from '../js/content.js';
import { freshSave, validateSave, SAVE_KEY } from '../js/persistence.js';
import { cellsFor, truckFor, unloadPath } from '../js/engine.js';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const out = fileURLToPath(new URL('../output/qa-v2/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const report = [], errors = [];
// Optional check names allow a copy/layout fix to recheck only affected paths.
const selectedChecks = new Set(process.argv.slice(2));
const active = order => ({ orderId: order.id, contentVersion: 2, placements: {}, phase: 'loading', stop: 0, delivered: [], moves: 0, hints: 0, paid: false });
const normalize = placement => ({ ...placement, z: placement.z ?? 0 });
function seed(order) {
  const save = freshSave();
  save.completed = Object.fromEntries(ORDERS.slice(0, ORDERS.indexOf(order)).map(item => [item.id, { stars: 3, reward: item.reward + 30 }]));
  save.ownedTrucks = TRUCKS.map(truck => truck.id);
  save.coins = 3000;
  save.active = active(order);
  validateSave(save);
  return save;
}
const read = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function context(width, height, raw) {
  const c = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', acceptDownloads: true });
  // The only injected state is this initial isolated fixture. Every subsequent
  // placement, removal, unload, retry and save goes through normal game inputs.
  if (raw !== undefined) await c.addInitScript(({ key, raw }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
  }, { key: SAVE_KEY, raw });
  const p = await c.newPage();
  p.setDefaultTimeout(12000);
  p.on('pageerror', error => errors.push(error.message));
  await p.goto('http://127.0.0.1:4197/');
  return { c, p, cdp: await c.newCDPSession(p) };
}
async function geometry(page, order) {
  const b = await page.locator('#board').boundingBox(), t = truckFor(order);
  const cell = Math.min((b.width - 64) / t.w, (b.height - 56) / (t.h + 1.9), 64);
  return { x: b.x + (b.width - t.w * cell) / 2, y: b.y + cell * 1.3 + 10, cell, b };
}
async function drag(page, cdp, from, to) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 0 }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / 10, y: from.y + (to.y - from.y) * i / 10, id: 0 }] });
    await page.waitForTimeout(12);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(120);
}
async function load(page, cdp, order, cargo, placement) {
  const item = page.locator(`[data-cargo="${cargo.id}"]`);
  let batches = 0;
  while (!await item.count()) {
    assert.ok(batches++ < 5, 'cargo remains reachable through tray batch controls');
    await page.locator('#tray-next').tap();
  }
  await item.tap();
  for (let i = 0; i < placement.r; i++) await page.locator('#rotate').tap();
  const g = await geometry(page, order), b = await item.boundingBox(), cells = cellsFor(cargo.type, placement.r);
  const w = Math.max(...cells.map(([x]) => x)) + 1, h = Math.max(...cells.map(([, y]) => y)) + 1;
  await drag(page, cdp, { x: b.x + b.width / 2, y: b.y + 22 }, { x: g.x + (placement.x + w / 2) * g.cell, y: g.y + (placement.y + h * .55) * g.cell });
  const actual = (await read(page)).active.placements[cargo.id];
  assert.ok(actual, `${order.id}/${cargo.id} is placed by real touch`);
  assert.deepEqual(normalize(actual), normalize(placement), `${order.id}/${cargo.id} auto-selects the intended floor/upper layer`);
  return batches;
}
async function tapCargo(page, order, cargo, placement) {
  const g = await geometry(page, order), [x, y] = cellsFor(cargo.type, placement.r)[0];
  await page.touchscreen.tap(g.x + (placement.x + x + .5) * g.cell, g.y + (placement.y + y + .5 - ((placement.z ?? 0) === 1 ? .16 : 0)) * g.cell);
}
async function unload(page, order, cargo) {
  const placement = (await read(page)).active.placements[cargo.id];
  await tapCargo(page, order, cargo, placement);
  await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)).active.delivered.includes(id), { key: SAVE_KEY, id: cargo.id });
}
async function checkControls(page, width, height) {
  const metrics = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
    controls: [...document.querySelectorAll('header button,#selection button,footer button,.cargo,#tray-next')].map(element => {
      const r = element.getBoundingClientRect();
      return { label: element.textContent, w: r.width, h: r.height, x: r.x, y: r.y };
    }) }));
  assert.ok(metrics.width <= width && metrics.height <= height, 'the game fits its target viewport');
  for (const item of metrics.controls) {
    assert.ok(item.w >= 44 && item.h >= 44, JSON.stringify(item));
    assert.ok(item.x >= 0 && item.y >= 0 && item.x + item.w <= width + 1 && item.y + item.h <= height + 1, JSON.stringify(item));
  }
  return metrics;
}
async function run(name, fn) {
  if (selectedChecks.size && !selectedChecks.has(name)) return;
  try { report.push({ check: name, passed: true, ...await fn() }); }
  catch (error) { report.push({ check: name, passed: false, error: error.stack }); }
}
async function withPage(name, width, height, raw, fn) {
  const session = await context(width, height, raw);
  try { return await fn(session); }
  catch (error) {
    await session.p.screenshot({ path: `${out}edge-${name}-failure.png` });
    await writeFile(`${out}edge-${name}-failure.json`, JSON.stringify({ visible: await session.p.locator('body').innerText(),
      stored: await session.p.evaluate(key => localStorage.getItem(key), SAVE_KEY) }, null, 2));
    throw error;
  } finally { await session.c.close(); }
}

try {
  for (const [width, height] of [[360, 640], [320, 568], [844, 390]]) await run(`late-${width}x${height}`, () => {
    const order = ORDERS.at(-1);
    return withPage(`late-${width}x${height}`, width, height, JSON.stringify(seed(order)), async ({ p, cdp }) => {
      await p.locator('.cargo').first().waitFor();
      await p.screenshot({ path: `${out}edge-late-${width}x${height}-initial.png` });
      const g = await geometry(p, order), metrics = await checkControls(p, width, height);
      const floor = order.cargo.filter(cargo => (order.solution[cargo.id].z ?? 0) === 0);
      const upper = order.cargo.filter(cargo => order.solution[cargo.id].z === 1);
      // A late-batch floor support is picked early, while all upper cargo waits
      // for its full support. No fixture directly supplies a placed cargo.
      const loadingSequence = [floor[0], floor.at(-1), ...floor.slice(1, -1), ...upper];
      let batchTaps = 0;
      for (const [index, cargo] of loadingSequence.entries()) {
        batchTaps += await load(p, cdp, order, cargo, order.solution[cargo.id]);
        if (index === 1) await p.screenshot({ path: `${out}edge-late-${width}x${height}-touch.png` });
      }
      const loaded = await read(p);
      assert.equal(Object.keys(loaded.active.placements).length, order.cargo.length);
      assert.equal(loaded.active.contentVersion, 2);
      await checkControls(p, width, height);
      await p.screenshot({ path: `${out}edge-late-${width}x${height}-loaded.png` });
      await p.locator('#go').tap();
      await p.waitForFunction(key => JSON.parse(localStorage.getItem(key)).active.phase === 'unloading', SAVE_KEY);
      for (const cargo of upper.filter(item => item.stop === 0)) await unload(p, order, cargo);
      await p.screenshot({ path: `${out}edge-late-${width}x${height}-upper-unloaded.png` });
      assert.equal((await read(p)).active.delivered.length, upper.filter(cargo => cargo.stop === 0).length);
      return { viewport: [width, height], cell: g.cell, board: g.b, metrics, touchLoaded: order.cargo.length, batchTaps,
        autoUpperPlacements: upper.length, touchUpperUnloaded: upper.filter(cargo => cargo.stop === 0).length, reducedMotion: true };
    });
  });
  await run('keyboard-rotate-place-remove-and-touch-rearrange', () => withPage('keyboard', 360, 640, undefined, async ({ p, cdp }) => {
    const order = ORDERS[0], first = order.cargo[0];
    await p.locator('.cargo').first().waitFor();
    await p.locator('#go').tap();
    assert.equal((await read(p)).active.phase, 'loading');
    assert.match(await p.locator('#bubble').innerText(), /还未装车/);
    for (let i = 0; i < 20; i++) {
      await p.keyboard.press('Tab');
      if (await p.evaluate(id => document.activeElement?.dataset.cargo === id, first.id)) break;
    }
    assert.equal(await p.evaluate(() => document.activeElement?.dataset.cargo), first.id);
    await p.keyboard.press('Enter');
    assert.equal(await p.evaluate(() => document.activeElement.id), 'board');
    await p.keyboard.press('r');
    await p.keyboard.press('ArrowRight');
    await p.keyboard.press('ArrowDown');
    await p.screenshot({ path: `${out}edge-keyboard-focus.png` });
    assert.equal(await p.locator('#board').evaluate(element => element.matches(':focus-visible')), true);
    await p.keyboard.press('Enter');
    assert.deepEqual(normalize((await read(p)).active.placements[first.id]), { x: 1, y: 1, r: 1, z: 0 });
    await p.locator('#remove').tap();
    assert.equal((await read(p)).active.placements[first.id], undefined);
    assert.equal(await p.locator('#remove').isDisabled(), true);
    for (let i = 0; i < 3; i++) await p.locator('#rotate').tap();
    await load(p, cdp, order, first, order.solution[first.id]);
    const g = await geometry(p, order);
    await drag(p, cdp, { x: g.x + g.cell, y: g.y + .5 * g.cell }, { x: g.x + g.cell, y: g.y + 2.55 * g.cell });
    assert.deepEqual(normalize((await read(p)).active.placements[first.id]), { x: 0, y: 2, r: 0, z: 0 });
    await p.screenshot({ path: `${out}edge-remove-rearrange.png` });
    await p.locator('#remove').tap();
    for (const cargo of order.cargo) await load(p, cdp, order, cargo, order.solution[cargo.id]);
    await p.locator('#go').tap();
    await p.waitForFunction(key => JSON.parse(localStorage.getItem(key)).active.phase === 'unloading', SAVE_KEY);
    await p.screenshot({ path: `${out}edge-incomplete-departure-recovered.png` });
    return { incompleteDepartureRejected: true, keyboardFocus: true, keyboardRotatePlace: true, removedAndRearranged: true, recoveredDeparture: true };
  }));
  await run('multi-stop-wrong-stop-click-recovers', () => {
    const order = ORDERS.find(item => item.stops.length > 1), save = seed(order);
    save.active.placements = structuredClone(order.solution);
    validateSave(save);
    return withPage('wrong-stop', 360, 640, JSON.stringify(save), async ({ p }) => {
      await p.locator('#go').tap();
      await p.waitForFunction(key => JSON.parse(localStorage.getItem(key)).active.phase === 'unloading', SAVE_KEY);
      const before = await read(p), later = order.cargo.find(cargo => cargo.stop === 1);
      await tapCargo(p, order, later, before.active.placements[later.id]);
      assert.deepEqual(await read(p), before, 'wrong-station touch cannot unload or save');
      assert.match(await p.locator('#bubble').innerText(), /第2站/);
      await p.screenshot({ path: `${out}edge-wrong-stop.png` });
      assert.equal(await p.locator('#go').isDisabled(), true);
      let recovered = 0;
      while (true) {
        const current = await read(p);
        const pending = order.cargo.filter(cargo => cargo.stop === 0 && current.active.placements[cargo.id])
          .sort((a, b) => (current.active.placements[b.id].z ?? 0) - (current.active.placements[a.id].z ?? 0));
        if (!pending.length) break;
        const cargo = pending.find(item => unloadPath(order, current.active.placements, item.id));
        assert.ok(cargo, 'correct-station cargo is reachable after wrong-station rejection');
        await unload(p, order, cargo); recovered++;
      }
      assert.equal(await p.locator('#go').isDisabled(), false);
      await p.screenshot({ path: `${out}edge-wrong-stop-recovered.png` });
      await p.locator('#go').tap();
      await p.waitForFunction(key => JSON.parse(localStorage.getItem(key)).active.stop === 1, SAVE_KEY);
      return { order: order.id, wrongStationRejected: true, touchUnloadedAfterError: recovered, nextStation: 1 };
    });
  });
  for (const [label, raw] of [['corrupt', '{ broken original'], ['future', JSON.stringify({ ...freshSave(), schema: 3 })]]) {
    await run(`${label}-export-reload-preserve`, () => withPage(label, 320, 568, raw, async ({ p }) => {
      await p.locator('#export-save').waitFor();
      assert.equal(await p.evaluate(key => localStorage.getItem(key), SAVE_KEY), raw);
      await p.screenshot({ path: `${out}edge-${label}-error.png` });
      const download = p.waitForEvent('download');
      await p.locator('#export-save').tap();
      const file = await download, filename = `${out}edge-${label}-export.json`;
      await file.saveAs(filename);
      assert.equal(await readFile(filename, 'utf8'), raw);
      await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.locator('#retry-save').tap()]);
      await p.locator('#export-save').waitFor();
      assert.equal(await p.evaluate(key => localStorage.getItem(key), SAVE_KEY), raw);
      assert.equal(await p.locator('#sheet').evaluate(element => element.open), true);
      const controls = await p.locator('#sheet button').evaluateAll(elements => elements.map(element => {
        const r = element.getBoundingClientRect(); return { w: r.width, h: r.height, y: r.y, bottom: r.bottom };
      }));
      assert.ok(controls.every(item => item.w >= 44 && item.h >= 44 && item.y >= 0 && item.bottom <= 568));
      return { viewport: [320, 568], exportedExactOriginal: true, retryPreservesOriginal: true, controls };
    }));
  }
} finally {
  await browser.close();
  for (const name of selectedChecks) if (!report.some(item => item.check === name)) report.push({ check: name, passed: false, error: 'Unknown check name' });
  const filename = selectedChecks.size ? 'edge-focused-report.json' : 'edge-report.json';
  await writeFile(`${out}${filename}`, JSON.stringify({ passed: !errors.length && report.every(item => item.passed), report, errors }, null, 2));
}
console.log('Edge browser QA:', report.filter(item => item.passed).length, '/', report.length, 'passed;', errors.length, 'page errors');
if (errors.length || report.some(item => !item.passed)) process.exitCode = 1;
