import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { navigateCamp } from './ui-navigation.mjs';
const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const base = process.env.MENU_UI_BASE || 'http://127.0.0.1:4213';
const out = new URL('../output/menu-routes/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const errors = [], checks = [], space = [];
async function shot(page, label) { await page.screenshot({ path: fileURLToPath(new URL(`${label}.png`, out)) }); }
async function reachable(locator) {
  await locator.click({ trial: true });
  const metrics = await locator.evaluate(el => {
    const b = el.getBoundingClientRect(); const target = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return { width: b.width, height: b.height, x: b.x, y: b.y, right: b.right, bottom: b.bottom, viewWidth: innerWidth, viewHeight: innerHeight, hit: target === el || el.contains(target) };
  });
  assert.ok(metrics.width >= 43.9 && metrics.height >= 43.9 && metrics.x >= 0 && metrics.y >= 0 && metrics.right <= metrics.viewWidth + 1 && metrics.bottom <= metrics.viewHeight + 1 && metrics.hit,
    `visible, unobstructed 44px touch target: ${await locator.textContent()} ${JSON.stringify(metrics)}`);
}
try {
  for (const [width, height, touch] of [[844,390,true],[568,320,true],[1280,720,false]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(base); const root = page.locator('#expedition-home');
    await root.locator('.menu-play').waitFor(); await page.evaluate(() => document.fonts.ready);
    const act = locator => touch ? locator.tap() : locator.click();
    const nav = name => navigateCamp(root, name, act);
    for (const destination of ['barracks','codex','trials']) await reachable(root.locator(`[data-action="nav"][data-page="${destination}"]`));
    await reachable(root.locator('[data-action="recruitment"]'));
    assert.equal(await root.locator('[data-action="recruitment"]').textContent(), '招募');
    const balances = root.locator('.menu-resources');
    assert.equal(await balances.locator('[data-resource]').count(), 2);
    const hud = await balances.boundingBox();
    const playBounds = await root.locator('.menu-play').boundingBox();
    assert.ok(hud.y >= 0 && hud.y + hud.height <= playBounds.y, 'resource balances occupy menu top');
    assert.ok(await balances.locator('img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0)), 'original resource art loaded');
    await reachable(root.locator('.menu-play')); await shot(page, `menu-${width}`);
    await act(root.locator('[data-action="recruitment"]'));
    await page.locator('.recruitment-dialog[open]').waitFor(); await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.dataset.action === 'recruitment');
    for (const destination of ['codex','trials','barracks','expedition']) {
      await nav(destination);
      const back = root.locator('[data-action="nav"][data-page="menu"]'); await reachable(back);
      const stage = await root.locator('.expedition-stage').boundingBox();
      const inset = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0);
      assert.ok(stage.y + stage.height >= height - inset - 12, `${destination}: content uses freed bottom space`);
      space.push({ width, height, page: destination, content: stage });
      if (destination === 'codex') {
        await act(root.locator('[data-action="codex-filter"][data-filter="spell"]'));
        await act(root.locator('[data-action="card-detail"]').first());
        await root.locator('dialog[open]').waitFor(); await page.keyboard.press('Escape');
      }
      if (destination === 'trials') await act(root.locator('[data-action="trial-group"][data-group-id="advanced"]'));
      if (destination === 'barracks') {
        await act(root.locator('.training-card-open').first());
        await root.locator('dialog[open]').waitFor(); await page.keyboard.press('Escape');
      }
      await shot(page, `${destination}-${width}`);
      await nav('menu');
      if (destination !== 'expedition') await page.waitForFunction(dest => document.activeElement?.dataset.page === dest, destination);
    }
    // Preserve the in-context route used to prepare a selected mission.
    await nav('expedition'); await act(root.locator('[data-action="chapter"]').first());
    await act(root.locator('[data-action="level"]').first());
    const selected = await root.locator('[data-action="start"]').getAttribute('data-level-id');
    await act(root.locator('[data-action="adjust-loadout"]'));
    assert.equal(await root.getAttribute('data-page'), 'barracks');
    await reachable(root.locator('[data-action="return-mission"]'));
    await act(root.locator('[data-action="return-mission"]'));
    assert.equal(await root.locator('[data-action="start"]').getAttribute('data-level-id'), selected);
    await shot(page, `mission-${width}`);
    await nav('menu');
    await root.locator('[data-action="nav"][data-page="codex"]').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.dataset.page === 'menu');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.dataset.page === 'codex');
    checks.push(`${width}x${height}: menu entries/recruitment, all feature returns, full-height content, card details, trials group, mission preparation round trip, keyboard focus and reduced-motion viewport`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks }));
} catch (error) {
  errors.push(String(error)); const page = browser.contexts().at(-1)?.pages().at(-1);
  if (page) await shot(page, 'failure').catch(() => {}); throw error;
} finally {
  await writeFile(new URL('report.json', out), JSON.stringify({ passed: errors.length === 0, checks, errors, space }, null, 2));
  await browser.close();
}
