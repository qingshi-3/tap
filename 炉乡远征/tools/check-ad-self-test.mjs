import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';
import { createExpeditionMatch } from '../dist/js/engine.js';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const BASE_URL = 'http://127.0.0.1:4197/';
const SAVE_KEY = 'duelyst-h5.safe-v1.expedition';
const checks = [];
const errors = [];

const memory = {
  data: new Map(),
  getItem(key) { return this.data.get(key) ?? null; },
  setItem(key, value) { this.data.set(key, value); }
};
const fixture = new ExpeditionProgress(memory).state;
fixture.activeBattle = createExpeditionMatch('border-01', fixture.training, fixture.squad, fixture.selectedHeroId);

async function makePage(tapMode = 'absent', seed = null) {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    reducedMotion: 'reduce'
  });
  if (tapMode !== 'absent') {
    await context.addInitScript(mode => {
      window.__adFactoryCalls = 0;
      window.tap = mode === 'host'
        ? {}
        : { createRewardedVideoAd() { window.__adFactoryCalls += 1; throw new Error('广告自测不得创建广告实例'); } };
    }, tapMode);
  }
  if (seed) {
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: SAVE_KEY, value: seed });
  }
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(BASE_URL);
  await page.locator('#expedition-home [data-page="expedition"]').waitFor();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  return { context, page };
}

const storageSnapshot = page => page.evaluate(() => ({
  local: Object.fromEntries(Array.from({ length: localStorage.length }, (_, index) => {
    const key = localStorage.key(index); return [key, localStorage.getItem(key)];
  }).sort(([a], [b]) => a.localeCompare(b))),
  session: Object.fromEntries(Array.from({ length: sessionStorage.length }, (_, index) => {
    const key = sessionStorage.key(index); return [key, sessionStorage.getItem(key)];
  }).sort(([a], [b]) => a.localeCompare(b)))
}));

async function openAdTest(page) {
  const trigger = page.locator('#expedition-home [data-action="ad-self-test"]');
  await trigger.tap();
  await page.locator('#ad-self-test-dialog').waitFor({ state: 'visible' });
  return trigger;
}

async function assertDialogFits(page, width, height) {
  const box = await page.locator('#ad-self-test-dialog').boundingBox();
  assert.ok(box, '广告自测对话框应可见');
  assert.ok(box.x >= 0 && box.y >= 0, `${width}×${height} 对话框不应溢出左上边界`);
  assert.ok(box.x + box.width <= width + 0.5 && box.y + box.height <= height + 0.5, `${width}×${height} 对话框不应溢出右下边界`);
}

function overlap(a, b) {
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5
    && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;
}

try {
  const plain = await makePage('absent', fixture);
  const { page } = plain;
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  await page.waitForTimeout(100);
  const before = await storageSnapshot(page);

  for (const pageName of ['expedition', 'barracks', 'codex', 'trials']) {
    await page.locator(`#expedition-home [data-action="nav"][data-page="${pageName}"]`).tap();
    const trigger = await openAdTest(page);
    assert.equal((await trigger.innerText()).trim(), '广告自测');
    assert.match(await page.locator('#ad-self-test-status').innerText(), /未检测到 TapTap 宿主/);
    assert.equal((await page.locator('#ad-self-test-host').innerText()).trim(), '未检测到');
    assert.equal((await page.locator('#ad-self-test-api').innerText()).trim(), '未检测到');
    await page.locator('#ad-self-test-close').tap();
    assert.equal(await page.locator('#ad-self-test-dialog').isVisible(), false);
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
  }
  checks.push('四个局外页均可真实触控打开“广告自测”，普通浏览器明确提示未检测到 TapTap，关闭后焦点返回入口');

  await page.locator('#expedition-home [data-action="nav"][data-page="expedition"]').tap();
  const trigger = await openAdTest(page);
  await page.screenshot({ path: 'output/playwright/latest-ad-self-test-phone.png' });
  await assertDialogFits(page, 844, 390);
  await page.evaluate(() => {
    window.__adFactoryCalls = 0;
    window.tap = { createRewardedVideoAd() { window.__adFactoryCalls += 1; throw new Error('广告自测不得创建广告实例'); } };
  });
  await page.locator('#ad-self-test-refresh').tap();
  assert.match(await page.locator('#ad-self-test-status').innerText(), /广告接口已检测到；广告位未配置/);
  assert.equal(await page.evaluate(() => window.__adFactoryCalls), 0);
  assert.equal((await page.locator('#ad-self-test-api').innerText()).trim(), '已检测到');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#ad-self-test-dialog').isVisible(), false);
  assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
  checks.push('重新检测可识别晚注入接口，未调用广告工厂；844×390 对话框可见；Escape 返回入口焦点');

  await page.setViewportSize({ width: 568, height: 320 });
  await openAdTest(page);
  await assertDialogFits(page, 568, 320);
  await page.screenshot({ path: 'output/playwright/latest-ad-self-test-small.png' });
  await page.keyboard.press('Escape');
  const topButtons = page.locator('#expedition-home .expedition-topbar > button:visible');
  const boxes = [];
  for (let index = 0; index < await topButtons.count(); index += 1) boxes.push(await topButtons.nth(index).boundingBox());
  assert.ok(boxes.length >= 4, '续玩存档应显示存档、广告自测、返回/主将和续玩等顶栏按钮');
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) assert.equal(overlap(boxes[left], boxes[right]), false, `568×320 顶栏按钮 ${left + 1} 与 ${right + 1} 不应重叠`);
  }
  assert.ok(await page.locator('#expedition-home [data-action="resume"]').isVisible(), 'fixture 应呈现续玩按钮');
  checks.push('568×320 对话框完整可见并截图，存在续玩时顶栏可见按钮互不重叠');

  assert.deepEqual(await storageSnapshot(page), before, '广告环境自测不得修改本地或会话存储');
  checks.push('大厅稳定后比对 domain storage，自测前后 localStorage 与 sessionStorage 均未改变');
  await plain.context.close();

  const hostOnly = await makePage('host');
  await openAdTest(hostOnly.page);
  assert.match(await hostOnly.page.locator('#ad-self-test-status').innerText(), /宿主未提供激励视频接口/);
  assert.equal((await hostOnly.page.locator('#ad-self-test-host').innerText()).trim(), '已检测到');
  assert.equal((await hostOnly.page.locator('#ad-self-test-api').innerText()).trim(), '未检测到');
  await hostOnly.context.close();
  checks.push('模拟 tap={}：识别宿主存在并明确提示缺少激励视频接口');

  const api = await makePage('api');
  await openAdTest(api.page);
  assert.match(await api.page.locator('#ad-self-test-status').innerText(), /广告接口已检测到；广告位未配置/);
  assert.equal(await api.page.evaluate(() => window.__adFactoryCalls), 0);
  assert.match(await api.page.locator('#ad-self-test-dialog').innerText(), /实际播放\s*未测试/);
  await api.context.close();
  checks.push('模拟激励视频接口：仅报告已检测到且广告位未配置，未创建实例、未宣称播放通过');

  assert.deepEqual(errors, []);
  const result = {
    checks,
    errors,
    environment: 'isolated 127.0.0.1:4197; Edge headless touch contexts; fake Tap capability only, not TapTap device or ad playback verification'
  };
  await writeFile('output/playwright/latest-ad-self-test-phone.json', JSON.stringify(result, null, 2));
  console.log(checks.join('\n'));
} finally {
  await browser.close();
}
