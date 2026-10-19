import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';
const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const base = process.env.SCENE_UI_BASE || 'http://127.0.0.1:4215';
const out = 'output/scene-loading';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const checks = [], errors = [];
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function fixture(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  return { context, page };
}
async function start(page) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('.menu-play').tap();
  await page.locator('[data-action="chapter"]').first().tap();
  await page.locator('[data-action="adjust-loadout"]').tap();
  await page.locator('.prep-start').tap();
  await page.locator('#scene-loading[open]').waitFor();
}
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEYS.expedition);
async function battleReady(page) {
  await page.locator('#scene-loading').waitFor({ state: 'hidden' });
  await page.locator('#objective-close').tap();
  assert.equal(await page.locator('#match').isVisible(), true);
  assert.ok(await page.locator('#match img').evaluateAll(imgs => imgs.filter(img => img.getAttribute('src')).every(img => img.complete && img.naturalWidth > 0)), 'first-screen portraits decoded');
}
try {
  {
    const { context, page } = await fixture(844, 390);
    const background = deferred(), sprites = deferred();
    await page.route('**/assets/maps/battlemap2_background.png', async route => { await background.promise; await route.continue(); });
    await page.route('**/assets/units/*.png', async route => { await sprites.promise; await route.continue(); });
    await start(page);
    assert.equal(await page.locator('#match').isVisible(), false, 'battle remains hidden before background and sprites are ready');
    await page.waitForFunction(() => document.querySelector('#scene-loading progress').value > 0);
    await page.screenshot({ path: `${out}/loading-844.png` });
    background.resolve();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('#match').isVisible(), false, 'background alone cannot reveal an unfinished board');
    sprites.resolve();
    await battleReady(page);
    const runId = (await saved(page)).activeBattle.runId;
    await page.screenshot({ path: `${out}/ready-844.png` });
    await page.locator('#leave-match').tap();await page.locator('#confirm-accept').tap();
    await page.locator('.menu-play').tap();
    await battleReady(page);
    assert.equal((await saved(page)).activeBattle.runId, runId, 'cached resume preserves the original battle');
    checks.push('844x390: menu usable while sprites download; entry waits for decoded background AND renderer; real resume keeps runId');
    await context.close();
  }
  {
    const { context, page } = await fixture(568, 320);
    let fail = true;
    await page.route('**/assets/maps/battlemap2_background.png', route => fail ? route.abort() : route.continue());
    await start(page);
    await page.locator('[data-loading-action="retry"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#match').isVisible(), false);
    await page.screenshot({ path: `${out}/failed-568.png` });
    const frozen = (await saved(page))?.activeBattle;
    await page.locator('[data-loading-action="cancel"]').tap();
    await page.locator('#scene-loading').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#match').isVisible(), false, 'cancel cannot enter the battle later');
    if (frozen) assert.equal((await saved(page)).activeBattle.runId, frozen.runId, 'cancel preserves frozen unfinished battle');
    if (frozen) {
      await page.locator('[data-action="nav"][data-page="menu"]').first().tap();
      await page.locator('.menu-play').tap();
    } else await page.locator('.prep-start').tap();
    await page.locator('[data-loading-action="retry"]').waitFor({ state: 'visible' });
    fail = false;
    await page.locator('[data-loading-action="retry"]').tap();
    await battleReady(page);
    if (frozen) assert.equal((await saved(page)).activeBattle.runId, frozen.runId, 'retry must not reroll a frozen battle');
    await page.screenshot({ path: `${out}/ready-568.png` });
    await page.locator('#leave-match').tap();await page.locator('#confirm-accept').tap();
    await page.locator('[data-action="nav"][data-page="trials"]').tap();
    await page.locator('[data-action="trial"]').first().tap();
    await battleReady(page);
    await page.locator('#leave-match').tap();await page.locator('#confirm-accept').tap();
    await page.locator('[data-action="trial"]').first().tap();
    await battleReady(page);
    checks.push('568x320: failed background stays behind loading, cancel returns safely, retry and resume retain save; trials start and resume use the same gate');
    await context.close();
  }
  {
    const { context, page } = await fixture(844, 390);
    const background = deferred();
    await page.route('**/assets/maps/battlemap2_background.png', async route => { await background.promise; await route.continue(); });
    await start(page);
    const before = await saved(page);
    assert.equal(await page.locator('[data-loading-action="cancel"]').evaluate(button => button === document.activeElement), true, 'loading receives keyboard focus');
    await page.keyboard.press('Escape');
    await page.locator('#scene-loading').waitFor({ state: 'hidden' });
    background.resolve();
    await page.waitForTimeout(700);
    assert.equal(await page.locator('#match').isVisible(), false, 'late asset completion after cancellation must not open the battle');
    assert.equal(await page.locator('.prep-start').evaluate(button => button === document.activeElement), true, 'cancel restores the initiating control focus');
    assert.deepEqual(await saved(page), before, 'cancelled entry cannot create or replace a saved battle');
    await page.locator('.prep-start').tap();
    await battleReady(page);
    checks.push('cancel during a pending background request: late completion does not enter or change the save; a subsequent real start succeeds');
    await context.close();
  }
  {
    const { context, page } = await fixture(844, 390);
    await context.addInitScript(key => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(name, value) {
        if (window.failBattleSave && name === key) throw new DOMException('Test storage full', 'QuotaExceededError');
        return setItem.call(this, name, value);
      };
    }, SAVE_KEYS.expedition);
    const background = deferred();
    await page.route('**/assets/maps/battlemap2_background.png', async route => { await background.promise; await route.continue(); });
    await start(page);
    const before = await saved(page);
    await page.evaluate(() => { window.failBattleSave = true; });
    background.resolve();
    await page.locator('#scene-loading').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#match').isVisible(), false, 'failed battle save cannot enter battle');
    assert.deepEqual(await saved(page), before, 'failed battle save preserves previous storage');
    assert.match(await page.locator('body').innerText(), /无法出征/);
    await page.screenshot({ path: `${out}/save-failed-844.png` });
    await page.evaluate(() => { window.failBattleSave = false; });
    await page.locator('.prep-start').tap();
    await battleReady(page);
    checks.push('new expedition storage failure after preparation: stays outside battle and preserves the save; later retry succeeds');
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ passed: true, checks, errors }, null, 2));
  console.log(checks);
} catch (error) {
  await writeFile(`${out}/report.json`, JSON.stringify({ passed: false, checks, errors, failure: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
