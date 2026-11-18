import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const out = new URL('../output/cloud-sync-latest/ui/', import.meta.url);
await mkdir(out, { recursive: true });
const KEY = 'duelyst-h5.safe-v1.expedition';
const storage = { getItem: () => null, setItem() {}, removeItem() {} };
const fixture = new ExpeditionProgress(storage).state;
fixture.coins = 5990;
const envelope = { game: 'duelyst-h5', appId: 970030, schemaVersion: 1,
  saveId: '12345678-1234-4123-8123-123456789012', savedAt: Date.now(),
  data: { expedition: fixture, campaign: null, match: null } };
const root = 'tapfile://usr';
const errors = [], checks = [];
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
  args: process.env.CLOUD_SYNC_DIAG === 'no-gpu' ? ['--disable-gpu'] : [] });

async function scenario(width, height, reducedMotion, mode = 'quota') {
  const files = new Map([
    [`${root}/cloud-archive-upload-1793700000000-1.json`, { data: 'old-upload', size: 32 * 1024 * 1024 }],
    [`${root}/cloud-archive-download-1793700000001-2.json`, { data: 'old-download', size: 32 * 1024 * 1024 }],
    [`${root}/cloud-archive-download-1793700000002-3.json`, { data: 'old-download', size: 32 * 1024 * 1024 }],
    [`${root}/player-save.json`, { data: 'formal-save', size: 1024 }],
    [`${root}/cloud-archive-upload-backup.json`, { data: 'backup', size: 1024 }],
  ]);
  if (mode !== 'quota') for (const path of files.keys()) if (/179370000000[012]-/.test(path)) files.delete(path);
  const server = { archive: mode === 'empty' ? null : structuredClone(envelope), fileId: 'v1', quota: mode === 'quota', failRead: false, failScan: false, scanGate: null, deleted: [], writes: 0, updates: 0, reads: 0 };
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion, deviceScaleFactor: 1 });
  await context.exposeBinding('__cacheRpc', async (_, { method, options }) => {
    if (method === 'getArchiveList') {
      server.reads++;
      if (server.scanGate) await server.scanGate;
      if (server.failRead) throw new Error('network unavailable');
      return { saves: server.archive ? [{ name: 'duelyst_player_safe_v1', uuid: 'cloud-player', fileId: server.fileId }] : [] };
    }
    if (method === 'getArchiveData') {
      const data = JSON.stringify(server.archive);
      files.set(options.targetFilePath, { data, size: Buffer.byteLength(data) });
      return { filePath: options.targetFilePath };
    }
    if (method === 'readFile') return { data: files.get(options.filePath)?.data };
    if (method === 'writeFile') {
      if (server.quota) throw new Error('writeFile fail: Total file size exceeds 100MB');
      files.set(options.filePath, { data: options.data, size: Buffer.byteLength(options.data) });
      return {};
    }
    if (method === 'updateArchive' || method === 'createArchive') {
      server.writes++;
      if (method === 'updateArchive') server.updates++;
      server.archive = JSON.parse(files.get(options.archiveFilePath).data);
      server.fileId = `v${Number(server.fileId.slice(1)) + 1}`;
      return { uuid: 'cloud-player', fileId: server.fileId };
    }
    if (method === 'stat') {
      if (options.recursive) {
        if (server.scanGate) await server.scanGate;
        if (server.failScan) throw new Error('permission denied');
        return { stats: [...files].map(([path, file]) => ({ path, stats: { size: file.size, mode: 0o100644 } })) };
      }
      const file = files.get(options.path);
      if (!file) throw new Error('no such file');
      return { stats: { size: file.size, mode: 0o100644 } };
    }
    if (method === 'unlink') {
      if (!files.has(options.filePath)) throw new Error('no such file');
      files.delete(options.filePath);
      server.deleted.push(options.filePath);
      if (![...files.keys()].some(path => /179370000000[012]-/.test(path))) server.quota = false;
      return {};
    }
    throw new Error(`Unexpected SDK method ${method}`);
  });
  await context.addInitScript(({ KEY, fixture, noStat }) => {
    if (!sessionStorage.getItem('cache-test-seeded')) {
      localStorage.setItem(KEY, JSON.stringify(fixture));
      sessionStorage.setItem('cache-test-seeded', '1');
    }
    const call = method => options => {
      const { success, fail, ...payload } = options;
      window.__cacheRpc({ method, options: payload }).then(result => {
        if (method === 'stat' && !payload.recursive && result.stats) {
          result.stats.isFile = () => true;
          result.stats.isDirectory = () => false;
        }
        success?.(result);
      }, error => fail?.({ errMsg: error.message }));
    };
    const cloud = Object.fromEntries(['getArchiveList', 'getArchiveData', 'createArchive', 'updateArchive'].map(method => [method, call(method)]));
    const fs = Object.fromEntries(['writeFile', 'readFile', 'stat', 'unlink'].map(method => [method, call(method)]));
    if (noStat) delete fs.stat;
    window.tap = { env: { USER_DATA_PATH: 'tapfile://usr' }, getCloudSaveManager: () => cloud, getFileSystemManager: () => fs };
  }, { KEY, fixture, noStat: mode === 'no-stat' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(process.env.CLOUD_CACHE_TEST_URL || 'http://127.0.0.1:4197/');
  await page.locator('[data-action="cloud"]').tap();
  const sync = page.locator('#cloud-clear-cache');
  await page.waitForFunction(() => !document.querySelector('#cloud-clear-cache').disabled);
  assert.equal(await sync.innerText(), '同步最新进度');
  assert.equal(await page.locator('#cloud-use-local').isVisible(), false);
  if (['quota', 'retry', 'conflict'].includes(mode) || process.env.CLOUD_SYNC_NO_STAT_UPLOAD) await page.evaluate(KEY => {
    const value = JSON.parse(localStorage.getItem(KEY)); value.coins += 100; localStorage.setItem(KEY, JSON.stringify(value));
  }, KEY);
  const before = await page.evaluate(KEY => localStorage.getItem(KEY), KEY);
  if (mode === 'conflict') { server.archive.data.expedition.coins += 500; server.fileId = 'v2'; }
  if (mode === 'retry') server.failRead = true;
  let release;
  server.scanGate = new Promise(resolve => { release = resolve; });
  const readsBefore = server.reads;
  await sync.tap();
  await page.waitForFunction(() => /同步中|排队/.test(document.querySelector('#cloud-clear-cache').textContent));
  const busyBox = await sync.boundingBox();
  await page.touchscreen.tap(busyBox.x + busyBox.width / 2, busyBox.y + busyBox.height / 2);
  assert.ok(server.reads <= readsBefore + 1, 'busy duplicate tap does not start concurrent read');
  release(); server.scanGate = null;
  await page.waitForFunction(() => document.querySelector('#cloud-clear-cache').textContent === '同步最新进度');
  if (mode === 'retry') {
    assert.equal(server.writes, 0);
    assert.equal(await page.evaluate(KEY => localStorage.getItem(KEY), KEY), before);
    await page.screenshot({ path: new URL(`failure-${mode}-${width}-${reducedMotion}.png`, out).pathname.replace(/^\//, '') });
    server.failRead = false;
    await sync.tap();
    await page.waitForFunction(() => document.querySelector('#cloud-clear-cache').textContent === '同步最新进度');
  }
  if (mode === 'conflict') {
    assert.equal(server.writes, 0, 'conflict never auto-overwrites');
    await page.locator('#cloud-use-local').tap();
    assert.equal(server.writes, 0, 'local overwrite requires confirmation');
    await page.locator('#cloud-choice-back').tap();
    await page.locator('#cloud-use-remote').tap();
    await page.waitForTimeout(300);
    if (process.env.CLOUD_SYNC_DIAG) {
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1000);
      const diagnostics = await page.evaluate(() => {
        const rect = value => ({ x:value.x,y:value.y,width:value.width,height:value.height });
        return [...document.querySelectorAll('#cloud-dialog p, #cloud-dialog dd, #cloud-dialog strong, #cloud-dialog button')].filter(el=>el.getClientRects().length).map(el=>{
          const range=document.createRange();range.selectNodeContents(el);const style=getComputedStyle(el);
          return {tag:el.tagName,id:el.id,text:el.textContent,container:rect(el.getBoundingClientRect()),textRect:rect(range.getBoundingClientRect()),textRects:[...range.getClientRects()].map(rect),style:Object.fromEntries(['overflow','overflowX','overflowY','clipPath','font','fontFamily','fontSize','fontWeight','lineHeight','filter','transform','animation','textOverflow','whiteSpace'].map(key=>[key,style[key]])),ancestors:[el.parentElement,el.parentElement?.parentElement].filter(Boolean).map(node=>({tag:node.tagName,className:node.className,rect:rect(node.getBoundingClientRect()),overflow:getComputedStyle(node).overflow,clipPath:getComputedStyle(node).clipPath,filter:getComputedStyle(node).filter,transform:getComputedStyle(node).transform}))};
        });
      });
      const prefix = `diagnostic-${process.env.CLOUD_SYNC_DIAG}-${width}-${reducedMotion}`;
      await writeFile(new URL(`${prefix}.json`,out),JSON.stringify(diagnostics,null,2));
      for(let i=1;i<=2;i++){await page.screenshot({path:new URL(`${prefix}-${i}.png`,out).pathname.replace(/^\//,'')});await page.waitForTimeout(300);}
    }
    assert.equal(await page.evaluate(KEY => localStorage.getItem(KEY), KEY), before, 'restore requires confirmation');
    const bodyBox = await page.locator('#cloud-dialog .cloud-body').boundingBox();
    for (const row of await page.locator('#cloud-dialog .cloud-metrics > div').all()) {
      const box = await row.boundingBox();
      assert.ok(box.y >= bodyBox.y - 1 && box.y + box.height <= bodyBox.y + bodyBox.height + 1,
        `confirmation metric clipped at ${width}: body=${JSON.stringify(bodyBox)} row=${JSON.stringify(box)}`);
    }
    for (const id of ['cloud-choice-back', 'cloud-choice-confirm']) {
      const box = await page.locator(`#${id}`).boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44 && box.y >= 0 && box.y + box.height <= height + 1, `${id} reachable in confirmation`);
    }
    if (!process.env.CLOUD_SYNC_DIAG) await page.screenshot({ path: new URL(`confirm-${mode}-${width}-${reducedMotion}.png`, out).pathname.replace(/^\//, '') });
    await page.locator('#cloud-choice-back').tap();
  } else {
    assert.match(await page.locator('#player-cloud-status').innerText(), /一致|已同步/);
    assert.equal(server.archive.data.expedition.coins, JSON.parse(before).coins);
  }
  assert.equal(await page.evaluate(KEY => localStorage.getItem(KEY), KEY), before, 'entire local bytes preserved');
  assert.equal(files.get(`${root}/player-save.json`).data, 'formal-save');
  assert.equal(files.get(`${root}/cloud-archive-upload-backup.json`).data, 'backup');
  if (process.env.CLOUD_SYNC_NO_STAT_UPLOAD) {
    assert.ok(server.writes >= 1, 'missing stat still uploads updated local progress');
    assert.ok(server.updates >= 1, 'SDK updateArchive was called without stat');
    assert.deepEqual(server.archive.data, { expedition: JSON.parse(before), campaign: null, match: null }, 'cloud contains latest entire local profile');
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1000);
    await page.screenshot({path:new URL('no-stat-upload-568-success.png',out).pathname.replace(/^\//,'')});
    checks.push({testPreparation:'Established trusted 5990 baseline; replaced only disposable fixture expedition coins with legal 6090 value in isolated localStorage before real button tap.',latestCloudMatchesLocal:true});
  }
  if (mode === 'quota') assert.ok(![...files.keys()].some(path => /179370000000[012]-/.test(path)));
  const dialog = await page.locator('#cloud-dialog').boundingBox();
  assert.ok(dialog.y >= 0 && dialog.y + dialog.height <= height + 1);
  const boxes = [];
  // Let the existing pressed-state scale return before measuring hit targets.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  if (!process.env.CLOUD_SYNC_DIAG) await page.screenshot({ path: new URL(`${mode}-${width}-${reducedMotion}.png`, out).pathname.replace(/^\//, '') });
  for (const button of await page.locator('#cloud-dialog button:visible').all()) {
    const box = await button.boundingBox(); boxes.push(box);
    assert.ok(box.width >= 44 && box.height >= 44, `44px touch target ${await button.getAttribute('id')}: ${JSON.stringify(box)} at ${width}`);
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, 'controls fit viewport');
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    assert.ok(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)<1 || Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)<1, 'controls do not overlap');
  }
  await sync.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  assert.equal(await sync.evaluate(el => el.matches(':focus-visible')), true);
  if (!process.env.CLOUD_SYNC_DIAG) await page.screenshot({ path: new URL(`${mode}-${width}-${reducedMotion}.png`, out).pathname.replace(/^\//, '') });
  if (mode === 'no-stat') { await page.keyboard.press('Enter'); await page.waitForFunction(() => document.querySelector('#cloud-clear-cache').textContent === '同步最新进度'); assert.match(await page.locator('#player-cloud-status').innerText(), /一致|已同步/); }
  if (process.env.CLOUD_SYNC_FOCUS_RECHECK) {
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1000);
    await page.screenshot({path:new URL('focus-recheck-568-success.png',out).pathname.replace(/^\//,'')});
    const remote=page.locator('#cloud-use-remote');
    await remote.tap(); await page.locator('#cloud-choice-back').tap();
    assert.equal(await remote.evaluate(el=>el===document.activeElement),true,'cancel returns focus to remote choice');
    await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
    assert.equal(await remote.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')),true,'keyboard returns to visible remote choice');
    await page.keyboard.press('Enter');
    await page.locator('#cloud-choice-confirm').waitFor({state:'visible'});
    assert.equal(await page.locator('#cloud-choice-confirm').evaluate(el=>el===document.activeElement),true,'Enter opens confirmation and focuses confirm');
    await page.evaluate(() => document.fonts.ready);await page.waitForTimeout(1000);
    await page.screenshot({path:new URL('focus-recheck-568-confirm.png',out).pathname.replace(/^\//,'')});
    assert.equal(server.writes,0); assert.equal(await page.evaluate(KEY=>localStorage.getItem(KEY),KEY),before);
    await page.locator('#cloud-choice-back').tap();
    checks.push({focusPath:'remote tap → back → Tab/Shift+Tab → Enter → confirmation → back',verified:true});
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-action="cloud"]').evaluate(el => el === document.activeElement), true);
  checks.push({ width, height, reducedMotion, mode, reads: server.reads, writes: server.writes, updateArchiveCalls: server.updates, localBytesPreserved: true, formalFilesPreserved: true });
  await context.close();
}

try {
  const modes = process.env.CLOUD_SYNC_TEST_MODES?.split(',') ?? ['no-stat', 'empty', 'quota', 'retry', 'conflict'];
  for (const [width, height] of (process.env.CLOUD_SYNC_DIAG || process.env.CLOUD_SYNC_FOCUS_RECHECK || process.env.CLOUD_SYNC_NO_STAT_UPLOAD ? [[568,320]] : [[844, 390], [568, 320]]))
    for (const reducedMotion of (process.env.CLOUD_SYNC_FOCUS_RECHECK || process.env.CLOUD_SYNC_NO_STAT_UPLOAD ? ['no-preference'] : ['no-preference', 'reduce']))
      for (const mode of modes) await scenario(width, height, reducedMotion, mode);
  assert.deepEqual(errors, []);
  await writeFile(new URL(process.env.CLOUD_SYNC_NO_STAT_UPLOAD ? 'no-stat-upload-recheck.json' : process.env.CLOUD_SYNC_FOCUS_RECHECK ? 'ui-verification-focus-recheck.json' : process.env.CLOUD_SYNC_DIAG ? `diagnostic-${process.env.CLOUD_SYNC_DIAG}-verification.json` : process.env.CLOUD_SYNC_TEST_MODES ? 'ui-verification-recheck.json' : 'ui-verification.json', out), JSON.stringify({ checks, errors, environment: 'Isolated Edge contexts; simulated TapTap SDK and quota. Physical host not verified.' }, null, 2));
  console.log(JSON.stringify({ passed: true, checks }));
} finally { await browser.close(); }

