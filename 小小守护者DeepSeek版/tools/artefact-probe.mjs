/**
 * 定位"战场出现巨大不透明白色矩形"的缺陷。
 * 抓取逐帧 canvas 像素统计与引擎地形诊断，判断是地形缓存、特效层还是飘字层画出来的。
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const OUT = 'output/combat';
mkdirSync(OUT, { recursive: true });
const URL = process.env.QA_URL ?? 'http://127.0.0.1:4190/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__deepseekGuardians?.snapshot().ready, null, { timeout: 25000 });

const session = await context.newCDPSession(page);
const snap = () => page.evaluate(() => window.__deepseekGuardians.snapshot());
const screenOf = (x, y) => page.evaluate(([wx, wy]) => window.__deepseekGuardians.screenPoint({ x: wx, y: wy }), [x, y]);
async function touchDrag(from, to, steps = 8) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, id: 1 }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tapText(text, exact = true) {
  const locator = exact ? page.getByRole('button', { name: text, exact: true }) : page.getByRole('button', { name: text });
  if (await locator.count() === 0) return false;
  const box = await locator.first().boundingBox();
  if (!box) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}

await tapText('按种子开局');
await tapText('确定');
await page.waitForFunction(() => window.__deepseekGuardians.snapshot().phase === 'prep');
await page.waitForTimeout(300);
for (const [cx, cy] of [[20, 7], [21, 7], [19, 7]]) {
  const to = await screenOf(cx, cy);
  const usable = await page.evaluate(([px, py]) => window.__deepseekGuardians.snapshot().input.usableAt(px, py), [to.x, to.y]);
  if (!usable) continue;
  const box = await page.locator('#prep-tools [data-tool="shield"]').boundingBox();
  await touchDrag({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: to.x, y: to.y });
  await page.waitForTimeout(220);
  if ((await snap()).legions.length) break;
}
await tapText(/开战/, false);
await page.waitForTimeout(250);
await tapText('确定');
await page.waitForFunction(() => window.__deepseekGuardians.snapshot().phase === 'combat', null, { timeout: 12000 });

/** 统计 canvas 里"接近纯白/接近奶油色"的像素占比，以及最大连通矩形包围盒。 */
const analyze = () => page.evaluate(() => {
  const canvas = document.querySelector('#battlefield canvas') ?? document.querySelector('canvas');
  if (!canvas) return { error: 'no canvas', canvases: document.querySelectorAll('canvas').length };
  const probe = document.createElement('canvas');
  probe.width = canvas.width;
  probe.height = canvas.height;
  const ctx = probe.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let white = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // 近白/奶油：通道都很高且差异小
      if (r > 225 && g > 218 && b > 170 && Math.abs(r - g) < 42) {
        white++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return {
    total: width * height,
    whitePixels: white,
    whiteRatio: +(white / (width * height)).toFixed(4),
    bbox: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
  };
});

const frames = [];
let worst = null;
for (let i = 0; i < 70; i++) {
  await page.waitForTimeout(100);
  const stats = await analyze();
  const now = await snap();
  const record = { i, phase: now.phase, enemies: now.enemies.length, effects: now.effects.length, whiteRatio: stats.whiteRatio, bbox: stats.bbox };
  frames.push(record);
  if (!worst || stats.whiteRatio > worst.whiteRatio) {
    worst = record;
    await page.screenshot({ path: `${OUT}/artefact-worst.png` });
  }
  if (stats.whiteRatio > 0.05) {
    await page.screenshot({ path: `${OUT}/artefact-${String(i).padStart(2, '0')}.png` });
    const dbg = await page.evaluate(() => window.__deepseekGuardians.renderDebug?.() ?? null);
    frames[frames.length - 1].renderDebug = dbg;
  }
  if (now.phase !== 'combat') break;
}

const report = { url: URL, worst, framesWithArtefact: frames.filter((f) => f.whiteRatio > 0.05).length, frames: frames.filter((f) => f.whiteRatio > 0.02).slice(0, 8) };
writeFileSync(`${OUT}/artefact-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1).slice(0, 4000));
await browser.close();
