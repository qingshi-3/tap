import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = new URL('../../output/ads-check/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const results = [];
try {
  for (const mode of ['no-sdk', 'completed', 'cancelled', 'error', 'short-screen']) {
    const context = await browser.newContext({ viewport: mode === 'short-screen' ? { width: 667, height: 375 } : { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (['completed', 'cancelled', 'error'].includes(mode)) {
      await page.addInitScript((mode) => {
        window.tap = { createRewardedVideoAd() {
          let close, error;
          return { onLoad() {}, onClose(cb) { close = cb; }, onError(cb) { error = cb; }, offLoad() {}, offClose() {}, offError() {},
            load: () => Promise.resolve(), show: () => { setTimeout(() => mode === 'error' ? error({ errCode: -1 }) : close({ isEnded: mode === 'completed' }), 100); return Promise.resolve(); }, destroy() {} };
        } };
      }, mode);
    }
    await page.goto('http://127.0.0.1:8766/source/dist/?debug');
    await page.getByRole('button', { name: '开始远征', exact: true }).click();
    await page.getByRole('button', { name: /圣光 阿尔吉昂/ }).click();
    await page.locator('.reroll').click();
    await page.locator('.refresh-dialog').getByRole('button', { name: '随机', exact: true }).click();
    const adButton = page.getByRole('button', { name: '广告刷新', exact: true });
    await adButton.waitFor();
    await adButton.click();
    await page.waitForFunction(() => !window.__app.game.adPending);
    const state = await page.evaluate(() => ({ stage: window.__app.game.run.stage, grant: window.__app.game.run.rewardedRerollCount, picks: window.__app.game.run.picks, mode: window.__app.game.mode, locked: window.__app.game.el.classList.contains('ad-locked') }));
    assert.equal(state.grant, mode === 'completed' ? 1 : 0);
    assert.equal(state.picks, 2);
    assert.equal(state.mode, 'prep');
    assert.equal(state.locked, false);
    assert.deepEqual(errors, []);
    assert.equal(await page.locator('.rewarded-ov').count(), 0);
    await page.evaluate(async () => { await Promise.all(document.querySelector('.reward-notice')?.getAnimations().map((a) => a.finished) ?? []); });
    await page.screenshot({ path: new URL(`${mode}.png`, out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
    results.push({ mode, state, errors, evidence: `${mode}.png` });
    await context.close();
  }
  writeFileSync(new URL('report.json', out), JSON.stringify({ sdk: 'fake SDK only; real TapTap playback requires device', results }, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
