import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { HOME_BACKGROUNDS } from '../dist/js/home-background.js';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const output = fileURLToPath(new URL('../output/home-backgrounds/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const report = { poolSize: HOME_BACKGROUNDS.length, backgrounds: [], lifecycle: [], errors: [] };
const base = process.env.HOME_UI_BASE || 'http://127.0.0.1:4227';

async function currentBackground(page) {
  return page.locator('#expedition-home').evaluate(root => getComputedStyle(root).backgroundImage);
}

async function checkSession(page) {
  const original = await currentBackground(page);
  for (const faction of [2, 4, 1]) {
    await page.locator(`.menu-faction[data-faction-id="${faction}"]`).tap();
    assert.equal(await currentBackground(page), original, 'faction refresh keeps session background');
  }
  await page.locator('[data-action="audio-settings"]').tap();
  await page.locator('#audio-settings-close').tap();
  assert.equal(await currentBackground(page), original);
  for (const [action, dialog] of [['recruitment', '.recruitment-dialog'], ['resource-rewards', '.resource-rewards-dialog']]) {
    await page.locator(`[data-action="${action}"]`).tap();
    await page.locator(`${dialog}[open]`).waitFor();
    await page.keyboard.press('Escape');
    await page.locator(dialog).waitFor({ state: 'hidden' });
    assert.equal(await currentBackground(page), original, 'modal refresh keeps session background');
  }
  for (const selector of ['.menu-destinations [data-page="codex"]', '.menu-play']) {
    await page.locator(selector).tap();
    await page.locator('[data-action="nav"][data-page="menu"]:visible').first().tap();
    await page.locator('#expedition-home[data-page="menu"]').waitFor();
    await page.locator('.menu-play').waitFor();
    assert.equal(await currentBackground(page), original, 'returning home keeps session background');
  }
  await page.keyboard.press('Tab');
  await page.locator('.menu-play').focus();
  assert.ok(await page.locator('.menu-play').evaluate(el => el.matches(':focus-visible')));
  await page.screenshot({ path: output + '/keyboard-focus-568.png' });
  await page.evaluate(() => history.replaceState(null, '', '?qa-bg=1'));
  await page.reload();
  await page.locator('.menu-play').waitFor();
  assert.ok((await currentBackground(page)).endsWith('/scene-obsidian-woods.webp")'));
  assert.notEqual(await currentBackground(page), original, 'new game load chooses again');
}

try {
  assert.equal(HOME_BACKGROUNDS.length, 30);
  assert.equal(new Set(HOME_BACKGROUNDS).size, 30);
  for (const [width, height] of [[568, 320], [844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    const requested = new Set();
    page.on('request', request => { if (request.url().includes('/assets/home-backgrounds/')) requested.add(request.url()); });
    // Control startup randomness in the isolated test browser, then restore it.
    // No test parameter or random override exists in the game implementation.
    await page.addInitScript(() => {
      const random = Math.random;
      const index = Number(new URL(location.href).searchParams.get('qa-bg') || 0);
      Math.random = () => (index + 0.5) / 30;
      window.restoreTestRandom = () => { Math.random = random; };
    });
    for (let index = 0; index < HOME_BACKGROUNDS.length; index++) {
      requested.clear();
      await page.goto(`${base}/?qa-bg=${index}`);
      await page.locator('.menu-play').waitFor();
      const image = await currentBackground(page);
      assert.ok(image.includes(HOME_BACKGROUNDS[index].slice(1)), `startup candidate ${index}`);
      await page.evaluate(() => window.restoreTestRandom());
      await page.evaluate(async url => { const image = new Image(); image.src = url; await image.decode(); await document.fonts.ready; }, HOME_BACKGROUNDS[index]);
      await page.waitForLoadState('networkidle');
      assert.deepEqual([...requested].map(url => new URL(url).pathname), [HOME_BACKGROUNDS[index].slice(1)], 'only selected background is fetched');
      const targets = await page.locator('.menu-play,.menu-destination,.menu-utility,.menu-faction').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect();
        return { text: node.textContent, x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
      }));
      assert.ok(targets.every(box => box.width >= 44 && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.right <= width && box.bottom <= height));
      const screenshot = `home-${width}-${String(index + 1).padStart(2, '0')}.png`;
      await page.screenshot({ path: output + '/' + screenshot });
      report.backgrounds.push({ width, height, candidate: HOME_BACKGROUNDS[index], screenshot, selectedOnlyLoaded: true, touchTargetsFit: true });
      if (width === 568 && index === 0) {
        await checkSession(page);
        report.lifecycle.push('faction changes, settings, recruitment, supplies, collection and expedition return keep background; reload selects again; keyboard focus visible');
      }
      if ((index + 1) % 10 === 0) console.log(`Checked ${index + 1}/30 backgrounds at ${width}×${height}`);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.errors.push(error.stack);
  throw error;
} finally {
  await writeFile(output + '/report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ backgroundsChecked: report.backgrounds.length, lifecycle: report.lifecycle, errors: report.errors }));
