import { navigateCamp } from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
// The rules check produces a plan; the browser executes it only through user inputs.
const plan = JSON.parse(execFileSync(process.execPath, ['tools/check-trial-lessons.mjs', '--json'], { encoding: 'utf8' }));
const chosen = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const errors = [], completed = [], outputs = 'output/playwright'; await mkdir(outputs, { recursive: true });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, reducedMotion: 'reduce' });
const page = await context.newPage(); page.setDefaultTimeout(12000);
page.on('pageerror', e => errors.push(String(e)));
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.addInitScript(async () => {
  const { BoardRenderer } = await import('/js/renderer.js'); const draw = BoardRenderer.prototype.draw;
  BoardRenderer.prototype.draw = function (...args) { window.__renderer = this; return draw.apply(this, args); };
});
const cdp = await context.newCDPSession(page);
async function point(cell, unit = false) {
  return page.evaluate(({ x, y, unit }) => {
    const r = window.__renderer, b = r.canvas.getBoundingClientRect(), p = r.cellGeometry(r.boardMetrics(b.width, b.height), x, y).center;
    // Touch the visible sprite when it stands above its tile. This only reads
    // hit geometry; all selections and combat still go through real input.
    for (const dy of unit ? [0, -16, -28, -40] : [0]) {
      const candidate = { x: b.left + p.x, y: b.top + p.y + dy };
      const hit = r.positionFromPointer({ clientX: candidate.x, clientY: candidate.y }, { preferUnits: unit });
      if (hit?.x === x && hit?.y === y && document.elementFromPoint(candidate.x, candidate.y) === r.canvas) return candidate;
    }
    throw new Error(`No unobscured touch point for ${x},${y}`);
  }, { ...cell, unit });
}
async function tapCell(cell, unit = true) { const p = await point(cell, unit); await page.touchscreen.tap(p.x, p.y); }
async function dragCells(from, to) {
  const a = await point(from, true), b = await point(to);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 12, y: a.y + (b.y - a.y) * i / 12 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function dragSkill(target) {
  const rect=await page.locator('#bbs-button').boundingBox();
  assert.ok(rect,'skill is visible');
  const a={x:rect.x+rect.width/2,y:rect.y+rect.height/2},b=await point(target,true);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
  for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/12,y:a.y+(b.y-a.y)*i/12}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
async function idle() { await page.waitForFunction(() => !document.querySelector('#game-result').hidden || !document.querySelector('#end-turn').disabled); }
let current, step;
try {
  await page.goto(process.env.TRIAL_URL || 'http://127.0.0.1:4197/');
  // Establish an actual remote-from-trials local expedition, then protect its bytes.
  await page.locator('.menu-play').tap(); await page.locator('.expedition-chapter').first().tap();
  await page.locator('[data-action="start"]').tap(); await page.locator('#objective-close').tap();
  await page.locator('#leave-match').tap();await page.locator('#confirm-accept').tap();
  const expedition = await page.evaluate(() => localStorage.getItem('duelyst-h5.safe-v1.expedition'));
  for (const lesson of plan.results.filter(l => !chosen.length || chosen.includes(l.id))) {
    current = lesson.id;
    await navigateCamp(page.locator('#expedition-home'), 'trials');
    await page.locator(`[data-action="trial-group"][data-group-id="${lesson.group}"]`).tap();
    const card = page.locator(`[data-action="trial"][data-level-id="${lesson.id}"]`);
    await card.scrollIntoViewIfNeeded(); await card.tap();
    await page.locator('#objective-close').tap(); await page.waitForFunction(() => window.__renderer?.ready);
    for (step of lesson.steps) {
      await idle(); await page.keyboard.press('Escape');
      if (step.type === 'move') await dragCells(step.from, step.to);
      else if (step.type === 'attack') { await tapCell(step.from); await tapCell(step.target); }
      else if (step.type === 'skill') { assert.ok(step.target,'trial skill has a target');await dragSkill(step.target); }
      else if (step.type === 'end-turn') await page.locator('#end-turn').tap();
      else {
        const index = await page.evaluate(id => window.__renderer.state.players[0].hand.indexOf(id), step.cardId);
        assert.ok(index >= 0, `${lesson.id}: hand contains ${step.cardId}`);
        await page.locator('#hand button').nth(index).tap();
        if (step.type === 'summon') await tapCell(step.to, false);
        else if (step.target) await tapCell(step.target);
        else await page.locator('#inspect-cast').tap();
      }
      await idle();
    }
    await page.locator('#game-result').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#result-title').innerText(), '胜利', lesson.id);
    await page.screenshot({ path: `${outputs}/trial-win-${lesson.id}.png` });
    await page.locator('#back-to-lobby').tap();
    // Reload after each victory checks the actual fixed local key and directory record.
    await page.reload(); await navigateCamp(page.locator('#expedition-home'), 'trials');
    await page.locator(`[data-action="trial-group"][data-group-id="${lesson.group}"]`).tap();
    assert.match(await page.locator(`[data-action="trial"][data-level-id="${lesson.id}"]`).innerText(), /已完成/);
    assert.equal(await page.evaluate(() => localStorage.getItem('duelyst-h5.safe-v1.expedition')), expedition);
    completed.push({ id: lesson.id, actions: lesson.steps.length }); console.log(`Touch win and reload: ${lesson.id}`);
  }
  assert.deepEqual(errors, []);
} catch (error) {
  await page.screenshot({ path: `${outputs}/trial-playthrough-failure.png` });
  console.error(JSON.stringify({ current, step, visible: await page.locator('body').innerText() }));
  throw error;
} finally {
  await writeFile(`${outputs}/trial-playthrough.json`, JSON.stringify({ completed, errors, current, step }, null, 2));
  await browser.close();
}
