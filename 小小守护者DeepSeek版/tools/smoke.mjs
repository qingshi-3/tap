/** 快速冒烟：打开页面、开局、截屏，报告控制台异常与关键渲染状态。 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const URL = process.env.QA_URL ?? 'http://localhost:4190/';
const OUT = 'output/qa';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
const logs = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { logs.push(`${m.type()}: ${m.text()}`); if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
try {
  await page.waitForFunction(() => window.__deepseekGuardians?.snapshot().ready, null, { timeout: 25000 });
  console.log('READY OK');
} catch {
  console.log('NOT READY within 25s');
}
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/smoke-home.png` });

const homeText = await page.locator('#home-error').innerText().catch(() => '');
console.log('home-error:', JSON.stringify(homeText));
console.log('boot-progress:', JSON.stringify(await page.locator('#boot-progress').innerText().catch(() => '')));
console.log('canvases:', await page.locator('#battlefield canvas').count());
console.log('snapshot:', JSON.stringify(await page.evaluate(() => window.__deepseekGuardians?.snapshot?.() ?? null)));

if (errors.length) { console.log('--- ERRORS ---'); for (const e of errors.slice(0, 20)) console.log(e); }
else console.log('no page errors');
console.log('--- console tail ---');
for (const l of logs.slice(-12)) console.log(l);

await browser.close();
