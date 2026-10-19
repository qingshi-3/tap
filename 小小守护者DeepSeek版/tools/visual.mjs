/** 视觉复查：按流程逐步截屏，供人眼判断美术。 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const OUT = 'output/visual';
mkdirSync(OUT, { recursive: true });
const URL = process.env.QA_URL ?? 'http://localhost:4190/';
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
  const list = await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].map((b) => ({ id: b.id, text: b.textContent })));
  const locator = exact ? page.getByRole('button', { name: text, exact: true }) : page.getByRole('button', { name: text });
  const count = await locator.count();
  if (count === 0) {
    console.log(`[tapText] 找不到「${String(text)}」；当前对话框按钮=${JSON.stringify(list)}`);
    return false;
  }
  const box = await locator.first().boundingBox().catch(() => null);
  if (!box) { console.log(`[tapText] 「${String(text)}」没有布局盒`); return false; }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}

await page.screenshot({ path: `${OUT}/01-home.png` });
await tapText('按种子开局');
await tapText('确定');
await page.waitForFunction(() => window.__deepseekGuardians.snapshot().phase === 'prep');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/02-battlefield.png` });

const cardBox = await page.locator('#prep-tools [data-tool="shield"]').boundingBox();
// 放一支盾卫、两支弓手，形成真实阵型
const plan = [
  { tool: 'shield', x: 22, y: 10 },
  { tool: 'archer', x: 20, y: 8 },
  { tool: 'archer', x: 20, y: 12 },
];
for (const step of plan) {
  const box = await page.locator(`#prep-tools [data-tool="${step.tool}"]`).boundingBox();
  const to = await screenOf(step.x, step.y);
  await touchDrag({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: to.x, y: to.y });
  await page.waitForTimeout(200);
}
await page.screenshot({ path: `${OUT}/03-army-placed.png` });
console.log('after placing:', JSON.stringify(await snap()));

// 选中一支军团，看上下文面板与范围环
const legion = await screenOf(22.5, 10.5);
await page.mouse.click(legion.x, legion.y);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/04-selected.png` });

// 建一座箭塔
await page.mouse.click(legion.x, legion.y); // 先取消再放塔
const towerBox = await page.locator('#prep-tools [data-tool="tower"]').boundingBox();
const towerAt = await screenOf(24, 7);
await touchDrag({ x: towerBox.x + towerBox.width / 2, y: towerBox.y + towerBox.height / 2 }, { x: towerAt.x, y: towerAt.y });
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/05-tower.png` });
console.log('after tower:', JSON.stringify(await snap()));

// 开战并记录战斗画面
await tapText(/开战/, false);
await page.waitForTimeout(300);
await tapText('确定');
await page.waitForTimeout(500);
const startState = await snap();
console.log('after start click:', JSON.stringify({ phase: startState.phase, wave: startState.wave, tool: startState.tool, dialogOpen: startState.input.dialogOpen }));
try {
  await page.waitForFunction(() => window.__deepseekGuardians.snapshot().phase === 'combat', null, { timeout: 15000 });
} catch {
  console.log('未能进入战斗，当前：', JSON.stringify(await snap()));
  await page.screenshot({ path: `${OUT}/06-combat-failed.png` });
  await browser.close();
  process.exit(1);
}
for (let i = 0; i < 5; i++) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/06-combat-${i}.png` });
  const now = await snap();
  console.log(`combat frame ${i}: phase=${now.phase} enemies=${now.enemies.length} coreHp=${now.coreHp} gold=${now.gold}`);
  if (now.phase !== 'combat') break;
}
// 法术预览
const stillCombat = (await snap()).phase === 'combat';
if (stillCombat) {
  await page.getByRole('button', { name: /治疗/ }).click();
  await page.waitForTimeout(200);
  const healAt = await screenOf(20, 10);
  await touchDrag({ x: healAt.x, y: healAt.y }, { x: healAt.x + 2, y: healAt.y + 2 }, 2);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/07-spell.png` });
}
console.log('final:', JSON.stringify(await snap()));
await browser.close();
