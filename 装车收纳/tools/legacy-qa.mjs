import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { ORDERS, getOrder } from '../js/content.js';
import { cellsFor, truckFor, unloadPath } from '../js/engine.js';
import { SAVE_KEY, BACKUP_KEY } from '../js/persistence.js';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const out = fileURLToPath(new URL('../output/qa-v2/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const report = [], errors = [];
let currentPage, failureState;
const read = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);

async function geometry(page, order) {
  const bounds = await page.locator('#board').boundingBox(), truck = truckFor(order);
  const cell = Math.min((bounds.width - 64) / truck.w, (bounds.height - 56) / (truck.h + 1.9), 64);
  return { x: bounds.x + (bounds.width - truck.w * cell) / 2, y: bounds.y + cell * 1.3 + 10, cell };
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
async function placeCargo(page, cdp, order, cargo, target) {
  const current = await read(page), existing = current.active.placements[cargo.id], g = await geometry(page, order);
  let from;
  if (existing) {
    const [x, y] = cellsFor(cargo.type, existing.r)[0];
    from = { x: g.x + (existing.x + x + .5) * g.cell, y: g.y + (existing.y + y + .5) * g.cell };
    assert.equal(existing.r, target.r, 'existing historical fixture needs only a translation');
  } else {
    const tile = page.locator(`[data-cargo="${cargo.id}"]`);
    let batches = 0;
    while (!await tile.count()) {
      assert.ok(batches++ < 5, 'cargo remains reachable through the tray');
      await page.locator('#tray-next').tap();
    }
    await tile.tap();
    for (let i = 0; i < target.r; i++) await page.locator('#rotate').tap();
    const bounds = await tile.boundingBox();
    from = { x: bounds.x + bounds.width / 2, y: bounds.y + 24 };
  }
  const cells = cellsFor(cargo.type, target.r);
  const w = Math.max(...cells.map(([x]) => x)) + 1, h = Math.max(...cells.map(([, y]) => y)) + 1;
  await drag(page, cdp, from, { x: g.x + (target.x + w / 2) * g.cell, y: g.y + (target.y + h * .55) * g.cell });
  const saved = (await read(page)).active.placements[cargo.id];
  assert.deepEqual({ ...saved, z: saved?.z ?? 0 }, { ...target, z: target.z ?? 0 }, `${order.id}/${cargo.id} real touch placement`);
}

try {
  for (const phase of ['loading', 'unloading', 'result']) {
    const raw = await readFile(new URL(`../tests/fixtures/save-v1-${phase}.json`, import.meta.url), 'utf8');
    const original = JSON.parse(raw), legacy = getOrder(original.active.orderId, 1);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    try {
      // Only the initial frozen fixture is injected. All subsequent state changes
      // below use the rendered game's normal touch, keyboard and button paths.
      await context.addInitScript(({ key, raw }) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
      }, { key: SAVE_KEY, raw });
      const page = await context.newPage(); currentPage = page;
      page.on('pageerror', error => errors.push(error.message));
      page.setDefaultTimeout(12000);
      const cdp = await context.newCDPSession(page);
      await page.goto('http://127.0.0.1:4197/');
      await page.locator('#order-title').filter({ hasText: legacy.name }).waitFor();
      const route = await page.locator('#route').innerText();
      for (const name of legacy.stops) assert.ok(route.includes(name), `legacy station ${name} is visible`);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), raw, 'restoring a legacy order performs no storage write');
      await page.screenshot({ path: `${out}legacy-${phase}-restored.png` });
      let checkedBackup = false;
      const checkFirstWrite = async () => {
        if (checkedBackup) return;
        assert.equal(await page.evaluate(key => localStorage.getItem(key), BACKUP_KEY), raw, 'first real action backs up exact legacy bytes');
        const migrated = await read(page);
        assert.equal(migrated.schema, 2);
        assert.equal(migrated.active.contentVersion, 1);
        checkedBackup = true;
      };
      let touchLoaded = 0, touchUnloaded = 0;
      if (phase === 'loading') {
        for (const cargo of legacy.cargo) {
          await placeCargo(page, cdp, legacy, cargo, legacy.solution[cargo.id]);
          await checkFirstWrite(); touchLoaded++;
        }
        await page.locator('#go').tap();
        await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).active.phase === 'unloading', SAVE_KEY);
      }
      if (phase !== 'result') {
        while ((await read(page)).active.phase === 'unloading') {
          const current = await read(page), a = current.active;
          const atStop = legacy.cargo.filter(cargo => cargo.stop === a.stop && a.placements[cargo.id]);
          if (atStop.length) {
            const cargo = atStop.find(item => unloadPath(legacy, a.placements, item.id));
            assert.ok(cargo, 'a historical current-station cargo remains reachable');
            const p = a.placements[cargo.id], [x, y] = cellsFor(cargo.type, p.r)[0], g = await geometry(page, legacy);
            await page.touchscreen.tap(g.x + (p.x + x + .5) * g.cell, g.y + (p.y + y + .5) * g.cell);
            await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)).active.delivered.includes(id), { key: SAVE_KEY, id: cargo.id });
            await checkFirstWrite(); touchUnloaded++;
          } else {
            await page.locator('#go').tap();
            await page.waitForFunction(({ key, stop }) => {
              const active = JSON.parse(localStorage.getItem(key)).active;
              return active.phase === 'result' || active.stop === stop + 1;
            }, { key: SAVE_KEY, stop: a.stop });
          }
        }
      }
      await page.locator('#result-next').waitFor();
      const result = await read(page);
      const stars = phase === 'loading' ? 2 : 3;
      const rewardDelta = phase === 'result' ? 0 : legacy.reward + stars * 10;
      assert.equal(result.coins, original.coins + rewardDelta, 'legacy settlement preserves the original reward contract');
      await page.screenshot({ path: `${out}legacy-${phase}-result.png` });
      await page.reload();
      await page.locator('#result-next').waitFor();
      assert.equal((await read(page)).coins, result.coins, 'result reload does not pay again');
      await page.keyboard.press('Escape');
      await page.locator('#go').tap();
      await page.locator('#result-next').waitFor();
      assert.equal((await read(page)).coins, result.coins, 'viewing a result again does not pay again');
      const next = ORDERS[ORDERS.findIndex(order => order.id === legacy.id) + 1];
      await page.locator('#result-next').tap();
      await page.locator('#order-title').filter({ hasText: next.name }).waitFor();
      if (phase === 'result') {
        // Starting the next order is this fixture's first normal save.
        assert.equal(await page.evaluate(key => localStorage.getItem(key), BACKUP_KEY), raw);
        checkedBackup = true;
      }
      const newActive = (await read(page)).active;
      assert.equal(newActive.orderId, next.id);
      assert.equal(newActive.contentVersion, 2);
      const firstFloorCargo = [...next.cargo].sort((a, b) => (next.solution[a.id].z ?? 0) - (next.solution[b.id].z ?? 0))[0];
      await placeCargo(page, cdp, next, firstFloorCargo, next.solution[firstFloorCargo.id]);
      const placed = await read(page);
      await page.reload();
      await page.locator('#order-title').filter({ hasText: next.name }).waitFor();
      assert.deepEqual((await read(page)).active.placements, placed.active.placements);
      await page.locator('#orders').tap();
      await page.locator('#sound').tap();
      assert.ok((await read(page)).revision > placed.revision, 'a normal user action can save again after reload');
      await page.locator('#close-sheet').tap();
      await page.screenshot({ path: `${out}legacy-${phase}-next-v2.png` });
      assert.equal((await read(page)).coins, result.coins);
      report.push({ phase, legacyOrder: legacy.id, legacyTitle: legacy.name, legacyStops: legacy.stops, initialRawPreserved: true,
        exactLegacyBackup: checkedBackup, touchLoaded, touchUnloaded, rewardDelta, duplicateReward: false,
        nextOrder: next.id, nextContentVersion: 2, reloadContinueSave: true, viewport: [390, 844], reducedMotion: true });
    } catch (error) {
      if (currentPage && !currentPage.isClosed()) {
        await currentPage.screenshot({ path: `${out}legacy-failure.png` });
        failureState = { visible: await currentPage.locator('body').innerText(),
          stored: await currentPage.evaluate(key => localStorage.getItem(key), SAVE_KEY) };
      }
      throw error;
    } finally { await context.close(); }
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}legacy-report.json`, JSON.stringify({ passed: true, report, errors }, null, 2));
  console.log('Legacy browser QA passed:', report.length, 'frozen phases');
} catch (error) {
  await writeFile(`${out}legacy-report.json`, JSON.stringify({ passed: false, error: error.stack, report, errors, ...failureState }, null, 2));
  throw error;
} finally { await browser.close(); }
