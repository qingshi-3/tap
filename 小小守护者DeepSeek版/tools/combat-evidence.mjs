/**
 * 战斗表现取证：在真实战斗推进过程中抓取受击、击杀、镜头震动与特效状态。
 * 只读取页面状态与截图，不注入金币/单位/胜负。
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const OUT = 'output/combat';
mkdirSync(OUT, { recursive: true });
const URL = process.env.QA_URL ?? 'http://127.0.0.1:4191/';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__deepseekGuardians?.snapshot().ready, null, { timeout: 25000 });

const session = await context.newCDPSession(page);
const snap = () => page.evaluate(() => window.__deepseekGuardians.snapshot());
const screenOf = (x, y) => page.evaluate(([wx, wy]) => window.__deepseekGuardians.screenPoint({ x: wx, y: wy }), [x, y]);

async function touchDrag(from, to, steps = 8) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, id: 1 }],
    });
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

// 第一波敌人沿 y=6 走廊从 x=1 直行到 x≈20 再转向核心(25,10)。
// 所以防守点必须贴着这条走廊，否则警戒半径够不到、整局不会交火（这是上一轮取证失败的原因）。
// 顶部 HUD 与路线条会占掉屏幕上方一条带，所以先对候选落点做可用性扫描再拖。
const plan = [
  { tool: 'shield', candidates: [[20, 7], [21, 7], [19, 7], [20, 8]] },
  { tool: 'archer', candidates: [[14, 7], [15, 8], [13, 7], [14, 8]] },
];
for (const step of plan) {
  const box = await page.locator(`#prep-tools [data-tool="${step.tool}"]`).boundingBox();
  if (!box) { console.log('跳过（无按钮）', step.tool); continue; }
  let done = false;
  for (const [cx, cy] of step.candidates) {
    const to = await screenOf(cx, cy);
    const usable = await page.evaluate(([px, py]) => window.__deepseekGuardians.snapshot().input.usableAt(px, py), [to.x, to.y]);
    if (!usable) { console.log(`  ${step.tool}@${cx},${cy} 屏幕(${Math.round(to.x)},${Math.round(to.y)}) 被界面遮挡，换候选`); continue; }
    const before = (await snap()).legions.length;
    await touchDrag({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: to.x, y: to.y });
    await page.waitForTimeout(240);
    const now = await snap();
    console.log(`  拖 ${step.tool}@${cx},${cy} -> 部队 ${before}->${now.legions.length} 金币=${now.gold}`);
    if (now.legions.length > before) { done = true; break; }
  }
  if (!done) console.log(`  ${step.tool} 所有候选点都未能部署`);
}
const placed = await snap();
console.log('placed:', JSON.stringify({ gold: placed.gold, legions: placed.legions.length, buildings: placed.buildings.length }));
if (!placed.legions.length) {
  console.log('没有部署任何部队，取证无法继续');
  await browser.close();
  process.exit(1);
}

await tapText(/开战/, false);
await page.waitForTimeout(300);
await tapText('确定');
try {
  await page.waitForFunction(() => window.__deepseekGuardians.snapshot().phase === 'combat', null, { timeout: 12000 });
} catch {
  console.log('未能进入战斗:', JSON.stringify(await snap()));
  await browser.close();
  process.exit(1);
}

// 采样战斗过程：记录敌人血量变化、弹道/命中特效、受击与击杀统计。
const frames = [];
let shotsSeen = 0;
let hurtSeen = 0;
let maxEffects = 0;
let minEnemyHp = Infinity;
let captured = 0;
let everHurt = false;
for (let i = 0; i < 80; i++) {
  await page.waitForTimeout(110);
  const now = await snap();
  const hpList = now.enemies.map((e) => e.hp);
  if (hpList.length) minEnemyHp = Math.min(minEnemyHp, ...hpList);
  const shots = now.effects.filter((e) => e.kind === 'shot').length;
  if (shots > 0) shotsSeen++;
  maxEffects = Math.max(maxEffects, now.effects.length);
  if (now.hurtEnemies > 0) { hurtSeen++; everHurt = true; }
  frames.push({ i, phase: now.phase, enemies: now.enemies.length, effects: now.effects.length, shots, hurt: now.hurtEnemies, kills: now.stats.kills, coreHp: now.coreHp });
  // 优先在"正在交火"的帧截图，覆盖飘字、弹道与击杀瞬间。
  if (captured < 6 && i >= 3 && now.enemies.length > 0 && (shots > 0 || now.hurtEnemies > 0) && i % 2 === 0) {
    await page.screenshot({ path: `${OUT}/combat-${String(captured).padStart(2, '0')}.png` });
    captured++;
  }
  if (now.phase !== 'combat') break;
}
await page.screenshot({ path: `${OUT}/combat-final.png` });

const final = await snap();
const report = {
  url: URL,
  placed: { gold: placed.gold, legions: placed.legions.length, buildings: placed.buildings.length },
  minEnemyHpSeen: Number.isFinite(minEnemyHp) ? minEnemyHp : null,
  framesWithShots: shotsSeen,
  framesWithHurtEnemies: hurtSeen,
  maxLiveEffects: maxEffects,
  everSawHurt: everHurt,
  screenshots: captured,
  finalPhase: final.phase,
  finalCoreHp: final.coreHp,
  finalGold: final.gold,
  finalKills: final.stats.kills,
  frameCount: frames.length,
  sample: frames.slice(0, 12),
  errors,
};
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
