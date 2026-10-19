import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const game = fileURLToPath(new URL('../../../', import.meta.url));
const offline = pathToFileURL(`${game}阵列-双击打开.html`); offline.search = 'debug';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
try {
  for (const [name, url] of [['split', 'http://127.0.0.1:8766/dist/?debug'], ['single', offline.href]]) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await context.addInitScript(() => { localStorage.setItem('zl_coach', 'drag,preview,hint'); localStorage.setItem('zl_speed', '3'); });
    const page = await context.newPage(), errors = [], failures = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', req => failures.push({ url: req.url(), error: req.failure()?.errorText }));
    await page.goto(url);
    await page.getByRole('button', { name: '开始远征', exact: true }).tap();
    await page.locator('.gen-card').first().tap();
    await page.waitForTimeout(2200);
    for (const slot of [0, 1]) {
      await page.locator('.card').first().tap();
      const pos = await page.evaluate(i => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left + (540 - i * 110) * r.width / 1280, y: r.top + 300 * r.width / 1280 }; }, slot);
      await page.touchscreen.tap(pos.x, pos.y);
    }
    const run = await page.evaluate(() => { const r = window.__app.game.run; return { version: r.contentVersion, active: r.activeFactions.length, bench: r.bench.length, picks: r.picks, field: r.slots.filter(Boolean).length }; });
    assert.deepEqual(run, { version: '0.3', active: 4, bench: 2, picks: 0, field: 2 });
    const inventory = await page.evaluate(() => JSON.stringify(window.__app.game.run.slots));
    for (const slot of [0, 1]) {
      const pos = await page.evaluate(i => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left + (540 - i * 110) * r.width / 1280, y: r.top + 300 * r.width / 1280 }; }, slot);
      await page.touchscreen.tap(pos.x, pos.y);
      await page.locator('.tip.on').waitFor();
    }
    assert.equal(await page.evaluate(() => JSON.stringify(window.__app.game.run.slots)), inventory);
    assert.equal(await page.getByRole('button', { name: '详情', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '交换位置', exact: true }).count(), 0);
    await page.screenshot({ path: fileURLToPath(new URL(`${name}-selection.png`, import.meta.url)) });
    await page.getByRole('button', { name: '本局卡池', exact: true }).tap();
    assert.equal(await page.locator('.pool-tabs button').count(), 5);
    await page.locator('.pool-tabs button').last().tap();
    assert.equal(await page.locator('.pool-unit').count(), 8);
    await page.locator('.pool-unit').last().tap();
    await page.screenshot({ path: fileURLToPath(new URL(`${name}-codex.png`, import.meta.url)) });
    await page.locator('.modal-x').tap();
    await page.locator('.modal-ov').waitFor({ state: 'detached' });
    await page.locator('.tray .fight').tap();
    await page.getByRole('button', { name: '跳过', exact: true }).tap();
    await page.getByRole('button', { name: '继续', exact: true }).waitFor();
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: '继续', exact: true }).tap();
    await page.waitForTimeout(1300);
    assert.equal(await page.evaluate(() => window.__app.game.run.stage), 1);
    const images = await page.locator('img').evaluateAll(imgs => ({ total: imgs.length, broken: imgs.filter(i => !i.complete || !i.naturalWidth).map(i => i.src) }));
    assert.deepEqual(images.broken, []);
    assert.deepEqual(errors, []); assert.deepEqual(failures, []);
    await page.screenshot({ path: fileURLToPath(new URL(`${name}-next-round.png`, import.meta.url)) });
    // A disposable fixture verifies the delivered bundle, then uses real touch input.
    await page.evaluate(() => {
      const g = window.__app.game;
      g.sel = null; g.focus = null; g.hover = null;
      g.run.slots = ['n_merc', 'a_seed', 'n_merc', 'n_merc', 'a_ritualist'].map((defId, i) => ({ defId, ownedId: i + 1, copies: i === 1 ? 2 : 1 }));
      g.run.bench = [null, null]; g.run.nextOwnedId = 6;
      g.renderAll();
    });
    assert.equal(await page.locator('.target-pending').count(), 1);
    assert.equal(await page.locator('.fight').getAttribute('aria-disabled'), 'true');
    const blockedFight = await page.locator('.fight').boundingBox();
    assert.ok(blockedFight);
    await page.touchscreen.tap(blockedFight.x + blockedFight.width / 2, blockedFight.y + blockedFight.height / 2);
    assert.equal(await page.evaluate(() => window.__app.game.mode), 'prep');
    const stagePoint = (x, y) => page.evaluate(({ x, y }) => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left + x * r.width / 1280, y: r.top + y * r.width / 1280 }; }, { x, y });
    const caster = await stagePoint(100, 300);
    await page.touchscreen.tap(caster.x, caster.y);
    const labelBox = await page.locator('.target-label').boundingBox();
    assert.ok(labelBox);
    const from = { x: labelBox.x + labelBox.width / 2, y: labelBox.y + labelBox.height / 2 };
    const to = await stagePoint(430, 300);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / 10, y: from.y + (to.y - from.y) * i / 10, id: 1 }] });
    assert.equal(await page.locator('.unit.side-0[data-slot="1"].target-lit').count(), 1);
    await page.screenshot({ path: fileURLToPath(new URL(`${name}-ritualist-drag.png`, import.meta.url)) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.deepEqual(await page.evaluate(() => window.__app.game.run.slots[4].targetIds), [2]);
    assert.equal(await page.locator('.target-pending').count(), 0);
    assert.equal(await page.locator('.fight').getAttribute('aria-disabled'), 'false');
    const blank = await stagePoint(640, 420);
    await page.touchscreen.tap(blank.x, blank.y);
    assert.match(await page.locator('.unit.side-0[data-slot="4"]').innerText(), /没有召唤空位/);
    await page.screenshot({ path: fileURLToPath(new URL(`${name}-ritualist-bound.png`, import.meta.url)) });
    await page.locator('.fight').tap();
    assert.equal(await page.evaluate(() => window.__app.game.mode), 'battle');
    await page.getByRole('button', { name: '跳过', exact: true }).tap();
    assert.deepEqual(errors, []); assert.deepEqual(failures, []);
    results.push({ name, url, run, images, errors, failures, nextStage: 2, input: 'touch recruit twice, inspect, neutral codex, battle/continue; full-field ritualist blocked until real label drag to slot2 two-star seed, stored UID2, no-space reason, then battle allowed' });
    await context.close();
  }
  writeFileSync(new URL('smoke.json', import.meta.url), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
