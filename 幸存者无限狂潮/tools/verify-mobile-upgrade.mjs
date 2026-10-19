import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = new URL('../output/', import.meta.url);
const outPath = name => new URL(name, output).pathname.replace(/^\/(?:([A-Za-z]):)/, '$1:');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const evidence = { viewport: '844x390', errors: [] };
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  page.on('pageerror', error => evidence.errors.push(error.message));
  await page.clock.install();
  await page.goto('http://127.0.0.1:4178/');
  await page.getByRole('button', { name: '进入荒野' }).click();

  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: 270 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 154, y: 246 }] });
  await page.clock.runFor(2200);
  assert(await page.locator('#joystick').evaluate(el => el.classList.contains('active')), 'touch drag should activate joystick');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert(!(await page.locator('#joystick').evaluate(el => el.classList.contains('active'))), 'touch release should clear joystick');

  for (let i = 0; i < 60 && !(await page.locator('#upgrade-dialog').isVisible()); i++) await page.clock.runFor(1000);
  const dialog = page.locator('#upgrade-dialog');
  assert(await dialog.isVisible(), 'natural play should reach an upgrade');
  const cards = page.locator('#upgrade-choices .upgrade-option');
  assert.equal(await cards.count(), 3, 'upgrade must show exactly three cards');
  const metrics = await cards.evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect();
    const title = node.querySelector('strong');
    const description = node.querySelector('.description');
    const titleBox = title?.getBoundingClientRect();
    const descriptionBox = description?.getBoundingClientRect();
    return {
      width: box.width, height: box.height,
      title: title?.textContent?.trim(), description: description?.textContent?.trim(),
      titleVisible: !!titleBox && titleBox.width > 0 && titleBox.height > 0,
      descriptionVisible: !!descriptionBox && descriptionBox.width > 0 && descriptionBox.height > 0,
    };
  }));
  for (const card of metrics) {
    assert(card.width >= 44 && card.height >= 44, 'each upgrade card must meet 44px touch target');
    assert(card.title && card.description && card.titleVisible && card.descriptionVisible, 'card title and description must be visible');
  }
  const layout = await dialog.evaluate(node => ({
    rect: node.getBoundingClientRect().toJSON(),
    scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
    scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
  }));
  assert(layout.rect.left >= 0 && layout.rect.right <= 844, 'dialog must remain inside viewport');
  assert(layout.scrollWidth <= layout.clientWidth + 1, 'dialog must not overflow horizontally');
  await cards.last().scrollIntoViewIfNeeded();
  assert(await cards.last().isVisible(), 'dialog can scroll to the final option');
  await page.screenshot({ path: outPath('mobile-upgrade.png') });

  const firstBox = await cards.first().boundingBox();
  assert(firstBox, 'first upgrade card needs a touchable box');
  const selected = (await cards.first().locator('strong').innerText()).trim();
  await page.touchscreen.tap(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.clock.runFor(250);
  assert(!(await dialog.isVisible()), 'touching an upgrade card should resume play');
  evidence.time = await page.locator('#time').innerText();
  evidence.cards = metrics;
  evidence.dialog = layout;
  evidence.selected = selected;
  assert.deepEqual(evidence.errors, []);
  await writeFile(new URL('mobile-upgrade-evidence.json', output), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  await context.close();
} finally {
  await browser.close();
}
