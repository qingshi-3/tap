import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = new URL('../../output/replay-layout-check/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    localStorage.setItem('zl_coach', 'drag,preview,hint');
    window.adOutcome = 'cancelled';
    window.tap = { createRewardedVideoAd() {
      let close, error;
      return { onLoad() {}, onClose(cb) { close = cb; }, onError(cb) { error = cb; }, offLoad() {}, offClose() {}, offError() {}, destroy() {},
        load: async () => {}, show: async () => { setTimeout(() => {
          if (window.adOutcome === 'error') error({ errCode: -1 });
          else { close({ isEnded: window.adOutcome === 'completed' }); close({ isEnded: true }); }
        }, 100); } };
    } };
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8766/source/dist/?debug');
  await page.getByRole('button', { name: '开始远征', exact: true }).tap();
  await page.locator('.gen-card').first().tap();
  await page.locator('.stage-intro').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = window.__app.game;
    g.run.lives = 1;
    g.run.slots = [{ defId: 'n_obelisk', level: 1 }, null, null, null, null];
    g.speed = 3; g.renderAll(false);
  });
  await page.locator('.tray .fight').tap();
  await page.getByRole('button', { name: '复盘', exact: true }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: '复盘', exact: true }).tap();
  const state = () => page.evaluate(() => { const r = window.__app.game.run; return { count: r.rewardedRetryCount, lives: r.lives, stage: r.stage, wins: r.wins, history: r.history, rng: r.rngState }; });
  const initial = await state();
  assert.equal(initial.lives, 0);
  for (const mode of ['cancelled', 'error']) {
    await page.evaluate(mode => { window.adOutcome = mode; }, mode);
    await page.getByRole('button', { name: '看广告重打', exact: true }).tap();
    await page.waitForFunction(() => window.__app.game.mode === 'sandbox');
    assert.deepEqual(await state(), initial);
  }
  const rounds = [];
  await page.evaluate(() => { window.adOutcome = 'completed'; });
  for (let count = 1; count <= 3; count++) {
    assert.match(await page.locator('.sp-text').innerText(), new RegExp(`剩余 ${4 - count} 次`));
    await page.getByRole('button', { name: '看广告重打', exact: true }).tap();
    await page.locator('.result-ov.retry').waitFor({ timeout: 30000 });
    await page.waitForTimeout(450);
    const after = await state();
    assert.deepEqual(after, { ...initial, count });
    rounds.push(after);
    if (count < 3) {
      await page.getByRole('button', { name: '复盘', exact: true }).tap();
      await page.waitForTimeout(450);
      await page.screenshot({ path: fileURLToPath(new URL(`568-remaining-${3 - count}.png`, out)) });
    } else {
      assert.equal(await page.getByRole('button', { name: '复盘', exact: true }).count(), 0);
      await page.screenshot({ path: fileURLToPath(new URL('568-exhausted-result.png', out)) });
    }
  }
  assert.deepEqual(errors, []);
  const report = { sdk: 'fake SDK; real TapTap video remains unverified', cancelledAndError: 'no quota consumed', duplicateClose: 'one quota consumed per completed request', initial, rounds, exhausted: 'no further retry entry on terminal defeat', errors };
  writeFileSync(new URL('retry-limit-report.json', out), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
