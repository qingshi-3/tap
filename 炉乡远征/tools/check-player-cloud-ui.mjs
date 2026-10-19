import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';
import { createExpeditionMatch } from '../dist/js/engine.js';
const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const KEY = 'duelyst-h5.safe-v1.expedition', META = 'duelyst-h5.safe-v1.cloud-meta';
const errors = [], checks = [];
const server = { archive: null, files: new Map(), sequence: 0, offline: false };
const memory = { data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, v); } };
const fixture = new ExpeditionProgress(memory).state;
fixture.coins = 240;
fixture.activeBattle = createExpeditionMatch('border-01', fixture.training, fixture.squad, fixture.selectedHeroId);
async function makePage(seed = null, tap = true) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, reducedMotion: 'reduce' });
  if (tap) {
    await context.exposeBinding('__cloudRpc', async (_, { method, options }) => {
      if (server.offline) throw new Error('测试断网');
      if (method === 'writeFile') { server.files.set(options.filePath, options.data); return {}; }
      if (method === 'readFile') return { data: server.files.get(options.filePath) };
      if (method === 'getArchiveList') return { saves: server.archive ? [{ name: 'duelyst_player_safe_v1', uuid: 'player-archive', fileId: server.archive.fileId }] : [] };
      if (method === 'getArchiveData') {
        if (options.archiveFileId !== server.archive?.fileId) throw new Error('旧版文件');
        server.files.set(options.targetFilePath, JSON.stringify(server.archive.data));
        return { filePath: options.targetFilePath };
      }
      if (method === 'createArchive' || method === 'updateArchive') {
        server.archive = { fileId: `v${++server.sequence}`, data: JSON.parse(server.files.get(options.archiveFilePath)) };
        return { uuid: 'player-archive', fileId: server.archive.fileId };
      }
      throw new Error(`Unexpected ${method}`);
    });
    await context.addInitScript(() => {
      const call = method => options => {
        const { success, fail, ...payload } = options;
        window.__cloudRpc({ method, options: payload }).then(success, e => fail({ errMsg: e.message }));
      };
      const cloud = Object.fromEntries(['getArchiveList', 'getArchiveData', 'createArchive', 'updateArchive'].map(m => [m, call(m)]));
      const fs = Object.fromEntries(['writeFile', 'readFile'].map(m => [m, call(m)]));
      window.tap = { env: { USER_DATA_PATH: 'tapfile://usr' }, getCloudSaveManager: () => cloud, getFileSystemManager: () => fs };
    });
  }
  if (seed) await context.addInitScript(({ seed, KEY }) => {
    if (!sessionStorage.getItem('fixture-seeded')) { localStorage.setItem(KEY, JSON.stringify(seed)); sessionStorage.setItem('fixture-seeded', 'yes'); }
  }, { seed, KEY });
  const page = await context.newPage();
  await page.clock.install();
  page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto('http://127.0.0.1:4197/');
  return { context, page };
}
const coins = page => page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)).coins, KEY);
const open = async page => { await page.locator('[data-action="cloud"]').tap(); await page.waitForFunction(() => !document.querySelector('#cloud-refresh').disabled); };
const train = async page => {
  await page.locator('[data-page="barracks"]').tap();
  await page.locator('[data-action="slot"][data-slot="0"]').tap();
  await page.locator('[data-action="train"]').tap();
  await page.locator('[data-action="close-card"]').tap();
};
try {
  const { page } = await makePage(fixture);
  await open(page);
  assert.match(await page.locator('#cloud-remote-summary').innerText(), /暂无/);
  assert.match(await page.locator('#cloud-local-summary').innerText(), /远征\s*0\/9/);
  assert.match(await page.locator('#cloud-local-summary').innerText(), /金币\s*240/);
  assert.match(await page.locator('#cloud-local-summary').innerText(), /培养\s*0 阶/);
  assert.match(await page.locator('#cloud-local-summary').innerText(), /试炼\s*0\/3/);
  assert.equal(await page.locator('#cloud-local-summary svg').count(), 4);
  await page.screenshot({ path: 'output/playwright/latest-keyword-cloud.png' });
  assert.equal(await page.locator('#cloud-close').evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'touch-opened close button has no permanent outline');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('#cloud-close').evaluate(el => el === document.activeElement), true);
  assert.equal(await page.locator('#cloud-close').evaluate(el => el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none'), true, 'keyboard focus remains visible');
  await page.locator('#cloud-use-local').tap();
  await page.waitForFunction(() => document.querySelector('#player-cloud-status').textContent.includes('已同步'));
  assert.equal(server.archive.data.data.expedition.coins, 240);
  await page.locator('#cloud-close').tap();
  await train(page);
  assert.equal(await coins(page), 200);
  checks.push('真实触控：首次主动云备份、军营培养及时本地保存');

  const second = await makePage();
  await second.page.waitForFunction(KEY => JSON.parse(localStorage.getItem(KEY) || 'null')?.coins === 240, KEY);
  await open(second.page);
  assert.match(await second.page.locator('#cloud-local-summary').innerText(), /可续战/);
  assert.equal(JSON.parse(await second.page.evaluate(KEY => localStorage.getItem(KEY), KEY)).activeBattle.levelId, fixture.activeBattle.levelId);
  await second.context.close();
  checks.push('模拟 TapTap：全新设备自动恢复金币、培养与未完成远征');

  server.archive.data.data.expedition.coins = 500;
  server.archive.data.data.expedition.training[14] = 2;
  server.archive.fileId = `v${++server.sequence}`;
  await open(page);
  assert.match(await page.locator('#player-cloud-status').innerText(), /冲突/);
  assert.match(await page.locator('#cloud-local-summary').innerText(), /200/);
  assert.match(await page.locator('#cloud-remote-summary').innerText(), /500/);
  await page.screenshot({ path: 'output/playwright/latest-cloud-conflict-phone.png' });
  await page.locator('#cloud-use-remote').tap();
  assert.match(await page.locator('#cloud-choice-copy').innerText(), /本机进度会先备份/);
  assert.equal(await coins(page), 200, 'opening overwrite confirmation cannot change local coins');
  await page.locator('#cloud-choice-back').tap();
  assert.equal(await coins(page), 200);
  assert.equal(await page.locator('#cloud-use-remote').isVisible(), true);
  await page.locator('#cloud-use-remote').tap();
  await Promise.all([page.waitForEvent('domcontentloaded'), page.locator('#cloud-choice-confirm').tap()]);
  await page.waitForFunction(KEY => JSON.parse(localStorage.getItem(KEY)).coins === 500, KEY);
  assert.match(await page.evaluate(META => localStorage.getItem(`${META}.local-backup`), META), /200/);
  checks.push('真实选择：冲突显示双方进度，备份本地后恢复云端并重载');

  await train(page);
  assert.equal(await coins(page), 390);
  server.archive.data.data.expedition.coins = 650;
  server.archive.fileId = `v${++server.sequence}`;
  await open(page);
  await page.clock.fastForward(61_000);
  await page.locator('#cloud-use-local').tap();
  assert.match(await page.locator('#cloud-choice-copy').innerText(), /原云端副本会先保存在本机/);
  assert.equal(server.archive.data.data.expedition.coins, 650, 'opening confirmation cannot overwrite remote');
  await page.locator('#cloud-choice-confirm').tap();
  await page.waitForFunction(() => document.querySelector('#player-cloud-status').textContent.includes('已同步'));
  assert.equal(server.archive.data.data.expedition.coins, 390);
  assert.match(await page.evaluate(META => localStorage.getItem(`${META}.remote-backup`), META), /650/);
  checks.push('真实选择：备份原云端后使用本机，不叠加金币');
  await page.setViewportSize({ width: 568, height: 320 });
  await page.screenshot({ path: 'output/playwright/latest-cloud-small.png' });
  await page.screenshot({ path: 'output/playwright/latest-keyword-cloud-small.png' });
  const dialog = await page.locator('#cloud-dialog').boundingBox();
  assert.ok(dialog.x >= 0 && dialog.y >= 0 && dialog.x + dialog.width <= 568 && dialog.y + dialog.height <= 320);
  for (const id of ['cloud-close', 'cloud-refresh', 'cloud-use-local', 'cloud-use-remote']) {
    const box = await page.locator(`#${id}`).boundingBox();
    assert.ok(box && box.x >= dialog.x && box.x + box.width <= dialog.x + dialog.width && box.y + box.height <= dialog.y + dialog.height, `${id} must be visible within the short-screen dialog`);
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#cloud-dialog').isVisible(), false);
  assert.equal(await page.locator('[data-action="cloud"]').evaluate(el => el === document.activeElement), true);

  server.offline = true;
  await open(page);
  assert.match(await page.locator('#player-cloud-status').innerText(), /失败/);
  assert.equal(await coins(page), 390);
  server.offline = false;
  await page.locator('#cloud-refresh').tap();
  await page.waitForFunction(() => document.querySelector('#player-cloud-status').textContent.includes('一致'));
  checks.push('断网保留本地；恢复联网后手动重试；568×320；Escape 返回焦点');

  const plain = await makePage(fixture, false);
  await plain.page.locator('[data-action="cloud"]').tap();
  assert.match(await plain.page.locator('#cloud-remote-summary').innerText(), /TapTap/);
  assert.equal(await plain.page.locator('#cloud-use-local').isVisible(), false);
  await plain.page.locator('#cloud-close').tap();
  await train(plain.page);
  assert.equal(await coins(plain.page), 200);
  checks.push('普通浏览器无 Tap：本地养成照常保存，无伪云同步');
  assert.deepEqual(errors, []);
  await writeFile('output/playwright/latest-player-cloud-ui.json', JSON.stringify({ checks, errors, environment: 'isolated4197; fake Tap SDK, not device verification' }, null, 2));
  console.log(checks.join('\n'));
} finally { await browser.close(); }
