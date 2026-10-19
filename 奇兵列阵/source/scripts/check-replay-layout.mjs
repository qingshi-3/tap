import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = new URL('../../output/replay-layout-check/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [width, height] of [[568, 320], [667, 375], [844, 390], [2048, 942]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('zl_coach', 'drag,preview,hint'));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8766/source/dist/?debug');
    await page.getByRole('button', { name: '开始远征', exact: true }).tap();
    await page.locator('.gen-card').first().tap();
    await page.locator('.stage-intro').waitFor({ state: 'detached' });
    // Disposable weak lineup reaches the real defeat -> replay flow without changing any player save.
    await page.evaluate(() => {
      const g = window.__app.game;
      g.run.slots = [{ defId: 'n_obelisk', level: 1 }, null, null, null, null];
      g.speed = 3;
      g.renderAll(false);
    });
    await page.locator('.tray .fight').tap();
    await page.getByRole('button', { name: '复盘', exact: true }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: '复盘', exact: true }).tap();
    const panel = page.locator('.sandbox-panel');
    await panel.waitFor();
    await page.waitForTimeout(450);
    const inspect = async expected => {
      const data = await panel.evaluate(el => {
        const box = e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
        const range = document.createRange(); range.selectNodeContents(el.querySelector('.sp-text'));
        return { panel: box(el), buttons: [...el.querySelectorAll('button')].map(e => ({ text: e.innerText, ...box(e), overflow: e.scrollWidth > e.clientWidth + 1 })), text: [...range.getClientRects()].map(b => ({ x: b.x, y: b.y, right: b.right, bottom: b.bottom })) };
      });
      assert.equal(data.buttons.length, expected);
      const p = data.panel;
      assert.ok(p.x >= 0 && p.y >= 0 && p.right <= width + 1 && p.bottom <= height + 1);
      for (const b of data.buttons) {
        assert.ok(b.x >= p.x + 3 && b.y >= p.y + 3 && b.right <= p.right - 3 && b.bottom <= p.bottom - 3, `Button escapes panel: ${b.text}`);
        assert.ok(b.height >= 44 && b.width >= 44, `Touch target too small: ${b.text}`);
        assert.equal(b.overflow, false);
      }
      for (const t of data.text) {
        assert.ok(t.bottom <= Math.min(...data.buttons.map(b => b.y)));
        assert.ok(t.x >= p.x && t.right <= p.right && t.y >= p.y);
      }
      for (let i = 1; i < data.buttons.length; i++) assert.ok(data.buttons[i].x >= data.buttons[i - 1].right);
      return data;
    };
    const withAd = await inspect(4);
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-with-ad.png`, out)) });
    // Exercise moving the unit and restoring the recorded battle lineup through real pointer input.
    const unit = await page.locator('.unit.side-0[data-slot="0"]').boundingBox();
    const target = await page.locator('.slot.side-0[data-slot="1"]').boundingBox();
    await page.mouse.move(unit.x + unit.width / 2, unit.y + unit.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
    await page.mouse.up();
    assert.equal(await page.evaluate(() => window.__app.game.sandbox.slots[1]?.defId), 'n_obelisk');
    await page.getByRole('button', { name: '还原站位', exact: true }).tap();
    assert.equal(await page.evaluate(() => window.__app.game.sandbox.slots[0]?.defId), 'n_obelisk');
    await page.getByRole('button', { name: /看广告重打/ }).tap();
    await page.locator('.reward-notice.error').waitFor();
    await inspect(4);
    await page.locator('.sandbox-panel .fight').tap();
    await page.getByRole('button', { name: '再调整', exact: true }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: '再调整', exact: true }).tap();
    await page.waitForTimeout(450);
    await inspect(4);
    // Alternate state: the existing once-per-run retry has already been used.
    await page.evaluate(() => { const g = window.__app.game; g.run.rewardedRetryCount = 3; g.renderAll(false); });
    const withoutAd = await inspect(3);
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-without-ad.png`, out)) });
    await page.getByRole('button', { name: '还原站位', exact: true }).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.getByRole('button', { name: '还原站位', exact: true }).evaluate(e => e.matches(':focus-visible')), true);
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-focus.png`, out)) });
    await page.getByRole('button', { name: '结束复盘', exact: true }).tap();
    await page.waitForFunction(() => window.__app.game.mode === 'prep');
    assert.deepEqual(errors, []);
    report.push({ width, height, withAd, withoutAd, actions: ['defeat -> replay', 'drag -> restore', 'ad unavailable -> unlocked', 'trial -> adjust', 'end replay'], errors });
    await context.close();
  }
  writeFileSync(new URL('report.json', out), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.map(({ width, height, actions, errors }) => ({ width, height, actions, errors }))));
} finally { await browser.close(); }
