import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = new URL('../../output/ads-check/run-limit/', import.meta.url);
mkdirSync(out, { recursive: true });
const single = pathToFileURL(fileURLToPath(new URL('../../阵列-双击打开.html', import.meta.url)));
single.search = 'debug';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [name, width, height, url] of [
    ['split-568', 568, 320, 'http://127.0.0.1:8766/dist/?debug'],
    ['split-844', 844, 390, 'http://127.0.0.1:8766/dist/?debug'],
    ['single-844', 844, 390, single.href],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      localStorage.setItem('zl_coach', 'drag,preview,hint'); localStorage.setItem('zl_speed', '3');
      window.__adMode = 'rewarded'; window.__adCreated = 0;
      window.tap = { createRewardedVideoAd() {
        window.__adCreated++;
        let close, error;
        return { onLoad() {}, onClose(cb) { close = cb; }, onError(cb) { error = cb; }, offLoad() {}, offClose() {}, offError() {},
          load: () => Promise.resolve(), show: () => {
            setTimeout(() => window.__adMode === 'failed' ? error({ errCode: -1 }) : close({ isEnded: window.__adMode === 'rewarded' }), 80);
            return Promise.resolve();
          }, destroy() {} };
      } };
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const start = async () => {
      await page.goto(url);
      await page.getByRole('button', { name: '开始远征', exact: true }).tap();
      await page.locator('.gen-card').first().tap();
      await page.waitForTimeout(1400);
      assert.equal(await page.evaluate(() => window.__app.game.run.rewardedRerollCount), 0);
    };
    const normalRefresh = async () => {
      await page.locator('.reroll').tap();
      await page.getByRole('button', { name: '随机', exact: true }).tap();
      await page.locator('.modal-ov').waitFor({ state: 'detached' });
    };
    const state = () => page.evaluate(() => {
      const g = window.__app.game, r = g.run;
      return { count: r.rewardedRerollCount, stage: r.stage, rng: r.rngState, draft: [...r.draft], picks: r.picks, mode: g.mode, pending: g.adPending };
    });
    const ad = async mode => {
      await page.evaluate(mode => { window.__adMode = mode; }, mode);
      await page.locator('.reroll.rewarded').tap();
      await page.waitForFunction(() => !window.__app.game.adPending && window.__app.game.mode === 'prep');
    };
    const screenshot = async suffix => {
      await page.waitForTimeout(380);
      return page.screenshot({ path: fileURLToPath(new URL(`${name}-${suffix}.png`, out)) });
    };
    const nextRound = async () => {
      await page.evaluate(() => {
        const g = window.__app.game;
        g.run.slots = Array.from({ length: 5 }, (_, i) => ({ defId: 'n_merc', ownedId: 100 + i, copies: 4 }));
        g.run.nextOwnedId = 105; g.renderAll();
      });
      await page.locator('.fight').tap();
      await page.getByRole('button', { name: '跳过', exact: true }).tap();
      const proceed = page.getByRole('button', { name: '继续', exact: true });
      await proceed.waitFor(); await page.waitForTimeout(450); await proceed.tap();
      await page.waitForFunction(() => window.__app.game.mode === 'prep');
      assert.equal((await state()).stage, 1);
    };
    await start(); await normalRefresh();
    assert.equal(await page.locator('.reroll.rewarded i').innerText(), '2');
    const untouched = await state();
    for (const mode of ['cancelled', 'failed']) { await ad(mode); assert.deepEqual(await state(), untouched); }
    await ad('rewarded'); assert.equal((await state()).count, 1);
    assert.equal(await page.locator('.reroll.rewarded i').innerText(), '1');
    assert.match(await page.locator('.reroll.rewarded').getAttribute('title'), /本局|整局/);
    await screenshot('one-left');
    await ad('rewarded'); assert.equal((await state()).count, 2);
    assert.equal(await page.locator('.reroll.rewarded').count(), 0);
    assert.equal(await page.locator('.reroll').isDisabled(), true);
    const exhausted = await state(), adCalls = await page.evaluate(() => window.__adCreated);
    const box = await page.locator('.reroll').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    assert.deepEqual(await state(), exhausted);
    assert.equal(await page.evaluate(() => window.__adCreated), adCalls);
    await screenshot('exhausted');
    await nextRound(); assert.equal((await state()).count, 2); await normalRefresh();
    assert.equal(await page.locator('.reroll.rewarded').count(), 0);
    assert.equal(await page.locator('.reroll').isDisabled(), true);
    await screenshot('next-round-exhausted');
    // Start a fresh run, use one reward in each of two rounds.
    await start(); await normalRefresh(); await ad('rewarded');
    await nextRound(); assert.equal((await state()).count, 1); await normalRefresh();
    assert.equal(await page.locator('.reroll.rewarded i').innerText(), '1');
    await ad('rewarded'); assert.equal((await state()).count, 2);
    assert.equal(await page.locator('.reroll.rewarded').count(), 0);
    assert.deepEqual(errors, []);
    report.push({ name, width, height, errors, final: await state(), verified: ['cancel/error preserve count and RNG', 'two in one round', 'third disabled and no SDK call', 'next round does not refill', 'new run resets', 'one in each round accumulates'], sdk: 'test double; no real ad playback' });
    await context.close();
  }
  writeFileSync(new URL('report.json', out), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
