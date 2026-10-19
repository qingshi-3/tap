import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = new URL('../output/', import.meta.url);
const outPath = name => new URL(name, output).pathname.replace(/^\/(?:([A-Za-z]):)/, '$1:');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const evidence = { viewport: '844x390', errors: [], eventLog: [] };
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  page.on('pageerror', error => evidence.errors.push(error.message));
  await page.addInitScript(() => {
    window.__gestureAudit = [];
    for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
      document.addEventListener(type, event => queueMicrotask(() => window.__gestureAudit.push({ type, defaultPrevented: event.defaultPrevented })), true);
    }
  });
  await page.clock.install();
  await page.goto('http://127.0.0.1:4178/');
  await page.getByRole('button', { name: '进入荒野' }).click();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });

  const p1 = (x, y) => ({ x, y, id: 1, radiusX: 5, radiusY: 5, force: 1 });
  const p2 = { x: 800, y: 32, id: 2, radiusX: 5, radiusY: 5, force: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p1(110, 300)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p1(390, 28)] });
  await page.clock.runFor(1700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p1(275, 250)] });
  assert(await page.locator('#joystick').evaluate(el => el.classList.contains('active')), 'long cross-HUD drag should retain joystick capture');
  assert.equal(await page.evaluate(() => getSelection()?.toString() || ''), '', 'long drag must not select text');
  const beforeScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }));

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p1(275, 250), p2] });
  await page.clock.runFor(120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [p1(275, 250)] });
  await page.clock.runFor(120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.clock.runFor(120);
  assert(await page.locator('#pause-dialog').isVisible(), 'second-finger pause tap should pause during movement');
  assert(!(await page.locator('#joystick').evaluate(el => el.classList.contains('active'))), 'pausing must clear captured joystick state');
  const pausedTime = await page.locator('#time').innerText();
  await page.clock.runFor(1500);
  assert.equal(await page.locator('#time').innerText(), pausedTime, 'multi-touch pause must freeze play');
  await page.getByRole('button', { name: '继续战斗' }).tap();
  await page.clock.runFor(500);
  assert(!(await page.locator('#pause-dialog').isVisible()), 'resume button tap must restore play');

  const afterScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  assert.deepEqual(afterScroll, { x: beforeScroll.x, y: beforeScroll.y }, 'gesture must not scroll the page');
  assert(beforeScroll.sw <= 844 && beforeScroll.sh <= 390, 'mobile viewport must not overflow');

  const synthetic = await page.locator('#arena').evaluate(arena => {
    const result = {};
    for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const dispatched = arena.dispatchEvent(event);
      result[type] = { dispatched, defaultPrevented: event.defaultPrevented };
    }
    return result;
  });
  evidence.syntheticDefense = synthetic;
  for (const value of Object.values(synthetic)) assert(value.defaultPrevented && !value.dispatched, 'selection/callout fallback event must be prevented');

  let orbitChosen = false;
  for (let ticks = 0; ticks < 180 && !orbitChosen; ticks++) {
    await page.clock.runFor(500);
    if (!(await page.locator('#upgrade-dialog').isVisible())) continue;
    const cards = page.locator('#upgrade-choices button');
    const labels = await cards.allInnerTexts();
    const orbitIndex = labels.findIndex(label => label.includes('护身旋刃'));
    const choice = orbitIndex >= 0 ? orbitIndex : 0;
    const box = await cards.nth(choice).boundingBox();
    assert(box, 'upgrade choice must have a touch target');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    orbitChosen = orbitIndex >= 0;
  }
  assert(orbitChosen, 'natural upgrades must offer and select 护身旋刃');
  evidence.orbitChosen = true;

  for (let frame = 0; frame < 12; frame++) {
    await page.clock.runFor(140);
    await page.screenshot({ path: outPath(`polish-live-${String(frame).padStart(2, '0')}.png`) });
  }
  await page.screenshot({ path: outPath('touch-polish.png') });
  evidence.selection = await page.evaluate(() => getSelection()?.toString() || '');
  evidence.scroll = { before: beforeScroll, after: afterScroll };
  evidence.eventLog = await page.evaluate(() => window.__gestureAudit);
  evidence.nativeLongPressEvents = evidence.eventLog.filter(item => ['contextmenu', 'selectstart'].includes(item.type)).length;
  evidence.note = 'Synthetic cancelable events validate the DOM prevention path; headless Edge does not reproduce an OS-level mobile WebView copy callout.';
  assert.deepEqual(evidence.errors, []);
  await writeFile(new URL('touch-polish-evidence.json', output), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  await context.close();
} finally {
  await browser.close();
}
