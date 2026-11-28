import { navigateCamp } from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { LEVELS, TRIAL_GROUPS } from '../dist/js/levels.js';
const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const errors = [], results = [];
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript(async () => {
    const { BoardRenderer } = await import('/js/renderer.js');
    const draw = BoardRenderer.prototype.draw;
    BoardRenderer.prototype.draw = function (...args) { window.__renderer = this; return draw.apply(this, args); };
  });
  await page.goto(process.env.TRIAL_URL || 'http://127.0.0.1:4197/');
  const trial = page.locator('[data-action="trial"]');
  await page.locator('[data-page="trials"]').tap();
  await page.locator('[data-group-id="advanced"]').tap();
  assert.equal(await trial.count(), 3);
  assert.equal(await trial.nth(1).isDisabled(), false);
  assert.equal(await page.locator('#lobby').isVisible(), false);
  await trial.first().tap();
  await page.locator('#objective-close').tap();
  await page.waitForFunction(() => window.__renderer?.ready);
  await page.locator('#leave-match').tap();await page.locator('#confirm-accept').tap();
  assert.match(await trial.first().innerText(), /继续试炼/);
  assert.equal(await page.locator('#expedition-home').getAttribute('data-page'), 'trials');
  await trial.first().tap();
  await page.locator('#objective-close').tap();
  await page.locator('#end-turn').tap();
  await page.locator('#game-result').waitFor({ state: 'visible' });
  await page.locator('#play-again').tap();
  await page.locator('#objective-close').tap();
  const points = await page.evaluate(() => {
    const r = window.__renderer, b = r.canvas.getBoundingClientRect(), m = r.boardMetrics(b.width, b.height);
    return r.state.units.map(u => { const p = r.cellGeometry(m, u.x, u.y).center; return { x: b.left + p.x, y: b.top + p.y }; });
  });
  await page.locator('#hand button').first().tap();
  await page.touchscreen.tap(points[1].x, points[1].y);
  await page.waitForFunction(() => !document.querySelector('#end-turn').disabled);
  await page.touchscreen.tap(points[1].x, points[1].y);
  await page.touchscreen.tap(points[2].x, points[2].y);
  await page.locator('#game-result').waitFor({ state: 'visible' });
  assert.match(await page.locator('#result-title').innerText(), /胜利|完成|通关/);
  await page.locator('#next-level').tap();
  await page.locator('#objective-close').tap();
  await page.locator('#leave-match').tap();await page.locator('#confirm-accept').tap();
  assert.match(await trial.first().innerText(), /已完成/);
  assert.match(await trial.nth(1).innerText(), /继续试炼/);
  assert.equal(await trial.nth(2).isDisabled(), false);
  results.push('触控：自由选课、退出续玩、失败重试、原关真实出牌胜利及下一课');
  await page.reload();
  await page.locator('[data-page="trials"]').tap();
  assert.match(await trial.first().innerText(), /已完成/);
  assert.match(await trial.nth(1).innerText(), /继续试炼/);
  await page.screenshot({ path: 'output/playwright/latest-trials-phone.png' });
  await page.setViewportSize({ width: 568, height: 320 });
  await page.screenshot({ path: 'output/playwright/latest-trials-small.png' });
  for (const card of await trial.all()) { const box = await card.boundingBox(); assert.ok(box.height >= 44); }
  await navigateCamp(page.locator('#expedition-home'), 'codex');
  assert.ok(await page.locator('.expedition-codex-card').count() > 0);
  await navigateCamp(page.locator('#expedition-home'), 'expedition');
  assert.equal(await page.locator('.expedition-chapter').count(), 6);
  await navigateCamp(page.locator('#expedition-home'), 'menu');
  await page.locator('[data-action="nav"][data-page="trials"]').focus();
  await page.keyboard.press('Enter');
  await trial.nth(1).focus();
  await page.keyboard.press('Enter');
  await page.locator('#objective-close').tap();
  await page.locator('#leave-match').tap();await page.locator('#confirm-accept').tap();
  await page.waitForFunction(() => document.activeElement?.dataset.levelId === 'break-the-guard');
  results.push('刷新保留进度；844×390 / 568×320；图鉴及远征导航；键盘进入与返回焦点；减少动态效果');

  // The course directory is actually navigated, including every new fixed battle.
  await page.setViewportSize({ width: 844, height: 390 });
  for (const level of LEVELS) {
    await page.locator(`[data-action="trial-group"][data-group-id="${level.group}"]`).tap();
    const card = page.locator(`[data-action="trial"][data-level-id="${level.id}"]`);
    await card.scrollIntoViewIfNeeded(); await card.tap();
    if (await page.locator('#confirm-screen').isVisible()) await page.locator('#confirm-accept').tap();
    await page.locator('#objective-dialog').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#trial-lesson-summary').innerText(), level.lesson.summary);
    await page.locator('#objective-close').tap();
    assert.equal(await page.locator('#level-title').innerText(), level.title);
    await page.locator('#objective-open').tap();
    assert.equal(await page.locator('#trial-lesson-steps li').count(), level.lesson.steps.length);
    await page.keyboard.press('Escape'); await page.locator('#leave-match').tap();await page.locator('#confirm-accept').tap();
  }
  for (const [w, h] of [[568, 320], [844, 390], [1280, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const group of TRIAL_GROUPS) {
      const button = page.locator(`[data-action="trial-group"][data-group-id="${group.id}"]`);
      await button.tap(); const b = await button.boundingBox(); assert.ok(b.width >= 44 && b.height >= 44);
      await page.screenshot({ path: `output/playwright/trial-curriculum-${group.id}-${w}.png` });
    }
  }
  results.push('全部课程通过真实入口进入战斗和查看提示；四组课程在三种视口可达');
  assert.deepEqual(errors, []);
  await writeFile('output/playwright/latest-trial-navigation.json', JSON.stringify({ results, errors }, null, 2));
  console.log(results.join('\n'));
} finally { await browser.close(); }
