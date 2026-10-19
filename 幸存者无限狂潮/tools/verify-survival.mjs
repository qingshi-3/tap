import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = new URL('../output/', import.meta.url);
const path = name => new URL(name, output).pathname.replace(/^\/(?:([A-Za-z]):)/, '$1:');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const evidence = { upgrades: [], checkpoints: [], attempts: [], errors: [] };
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => evidence.errors.push(error.message));
  await page.clock.install();
  await page.goto('http://127.0.0.1:4178/');
  await page.getByRole('button', { name: '进入荒野' }).click();

  const circuit = ['d','d','d','d','d','d','s','s','s','s','s','s','a','a','a','a','a','a','w','w','w','w','w','w'];
  let active = null;
  let upgradeShot = false;
  let victory = false;
  for (let attempt = 1; attempt <= 3 && !victory; attempt++) {
   let routeStep = 0;
   const captured = new Set();
   for (let second = 0; second < 330; second++) {
    if (await page.locator('#result-dialog').isVisible()) break;
    if (await page.locator('#upgrade-dialog').isVisible()) {
      if (active) { await page.keyboard.up(active); active = null; }
      const buttons = page.locator('#upgrade-choices button');
      const labels = await buttons.allInnerTexts();
      assert.equal(labels.length, 3, 'natural upgrade must present three choices');
      const priorities = ['基础魔弹', '踏风', '护身旋刃', '坚韧心火', '锋刃磨砺', '疾风连斩', '灵息牵引', '重燃斗志', '临时护佑', '战地休整'];
      let index = priorities.map(name => labels.findIndex(label => label.includes(name))).find(i => i >= 0);
      if (index === undefined) index = 0;
      evidence.upgrades.push({ attempt, time: await page.locator('#time').innerText(), choices: labels, selected: labels[index] });
      if (!upgradeShot) { await page.screenshot({ path: path('survival-upgrade.png') }); upgradeShot = true; }
      await buttons.nth(index).click();
      continue;
    }
    const desired = circuit[routeStep % circuit.length];
    routeStep++;
    if (active !== desired) {
      if (active) await page.keyboard.up(active);
      await page.keyboard.down(desired);
      active = desired;
    }
    await page.clock.runFor(1000);
    const label = await page.locator('#time').innerText();
    const [minutes, seconds] = label.split(':').map(Number);
    const hudSeconds = minutes * 60 + seconds;
    for (const checkpoint of [60, 180, 270]) if (hudSeconds >= checkpoint && !captured.has(checkpoint)) {
      captured.add(checkpoint);
      evidence.checkpoints.push({ attempt, hudTime: label, hp: await page.locator('#hp-text').innerText(), kills: await page.locator('#kills').innerText(), level: await page.locator('#level').innerText() });
      await page.screenshot({ path: path(`survival-${checkpoint}s.png`) });
    }
   }
   if (active) { await page.keyboard.up(active); active = null; }
   assert(await page.locator('#result-dialog').isVisible(), 'run must reach a result through ordinary play');
   const title = await page.locator('#result-title').innerText();
   const stats = await page.locator('#result-stats').innerText();
   evidence.result = { attempt, title, stats };
   evidence.attempts.push({ attempt, title, stats });
   await page.screenshot({ path: path('survival-result.png') });
   victory = title === '守住了最后一刻';
   if (!victory && attempt < 3) await page.getByRole('button', { name: '再战一次' }).click();
  }
  await writeFile(new URL('survival-evidence.json', output), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  assert(victory, `expected natural victory after three seeds, got ${evidence.result?.title}`);
  assert.deepEqual(evidence.errors, []);
  await context.close();
} finally {
  await browser.close();
}
