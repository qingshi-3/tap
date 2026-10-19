import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = new URL('../../output/performance-check/', import.meta.url);
mkdirSync(out, { recursive: true });
const report = { viewport: { width: 844, height: 390 }, steps: [], errors: [] };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let context;
try {
 context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
 await context.addInitScript(() => {
  localStorage.setItem('zl_coach', 'drag,preview,hint'); localStorage.setItem('zl_speed', '1'); localStorage.setItem('zl_muted', '1');
  window.__perfDraws = {};
  const clear = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect = function (...args) {
   const key = this.canvas.className || this.canvas.id || 'canvas';
   window.__perfDraws[key] = (window.__perfDraws[key] || 0) + 1;
   return clear.apply(this, args);
  };
 });
 const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
 await page.goto('http://127.0.0.1:8766/source/dist/?debug');
 await page.getByRole('button', { name: '开始远征', exact: true }).tap();
 await page.locator('.gen-card').first().tap();
 await page.locator('.stage-intro').waitFor({ state: 'attached' });
 await page.locator('.stage-intro').waitFor({ state: 'detached' });
 await page.evaluate(() => {
  const g = window.__app.game;
  g.run.stage = 8; // Isolated ninth encounter has five enemies as well as five friendlies.
  g.run.slots = ['l_shield', 'l_priest', 'l_martyr', 'n_echo', 'n_obelisk'].map(defId => ({ defId, level: 1 }));
  g.renderAll(false);
 });
 await page.waitForTimeout(400);
 const snapshot = () => page.evaluate(() => {
  const rows = document.getAnimations().filter(a => a.effect?.getTiming().iterations === Infinity).map(a => {
   const el = a.effect.target;
   const css = el instanceof Element ? getComputedStyle(el) : null;
   const visible = !!css && css.visibility !== 'hidden' && css.display !== 'none' && el.getClientRects().length > 0;
   return { name: a.animationName || '', class: el?.className || '', state: a.playState, rate: a.playbackRate, visible };
  });
  return { animations: rows, runningVisible: rows.filter(r => r.visible && r.state === 'running').length,
   runningHidden: rows.filter(r => !r.visible && r.state === 'running').length,
   canvases: [...document.querySelectorAll('canvas')].map(c => ({ class: c.className, width: c.width, height: c.height })), draws: { ...window.__perfDraws } };
 });
 const prep = await snapshot(); report.steps.push({ name: 'full-lineup-prep', ...prep });
 assert.ok(prep.canvases.some(c => c.width === 640 && c.height === 360), 'ambient must use half-resolution backing buffer');
 assert.ok(prep.canvases.every(c => c.width <= 1600 && c.height <= 900), 'canvas DPR cap');
 const sampleStart = await snapshot(); const sampleTime = Date.now(); await page.waitForTimeout(1000); const sampleEnd = await snapshot();
 const sampleMs = Date.now() - sampleTime; const ambientKey = Object.keys(sampleEnd.draws).find(k => k.includes('bg-motes'));
 const ambientDraws = (sampleEnd.draws[ambientKey] || 0) - (sampleStart.draws[ambientKey] || 0);
 report.steps.push({ name: 'ambient-one-second-budget', sampleMs, ambientDraws, fps: ambientDraws * 1000 / sampleMs });
 assert.ok(ambientDraws > 0 && ambientDraws <= Math.ceil(sampleMs / 50) + 1, 'ambient obeys 20FPS draw budget');
 const box = await page.locator('.unit.side-0[data-slot="0"]').boundingBox();
 await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
 await page.locator('.tip.on').waitFor();
 const selected = await snapshot(); report.steps.push({ name: 'selected', ...selected });
 const selectedRows = selected.animations.filter(r => String(r.class).includes('duelyst-'));
 assert.ok(selectedRows.some(r => String(r.class).includes('duelyst-selected') && r.visible && r.state === 'running'), 'visible selected outline animates');
 assert.ok(selectedRows.filter(r => !r.visible).every(r => r.state !== 'running'), 'hidden normal/selected sprite variants must not animate');
 await page.screenshot({ path: fileURLToPath(new URL('844-selected.png', out)), fullPage: true });
 await page.touchscreen.tap(3, 3);
 await page.locator('button.fight').tap();
 await page.waitForFunction(() => window.__app.game?.pb);
 await page.evaluate(() => { window.__perfOldGame = window.__app.game; window.__perfOldPb = window.__app.game.pb; });
 for (const speed of [1, 2, 3, 1]) {
  const button = page.locator('.speed');
  if (await page.evaluate(() => window.__app.game.pb.speed) !== speed) await button.tap();
  const actualSpeed = await page.evaluate(() => window.__app.game.pb.speed);
  assert.equal(actualSpeed, speed, 'real speed button reaches requested multiplier');
  const state = await snapshot();
  const sprites = state.animations.filter(r => String(r.class).includes('duelyst-'));
  assert.ok(sprites.length > 0); assert.ok(sprites.every(r => r.rate === 1), 'battle speed must never retime idle sprite animation');
  report.steps.push({ name: `battle-speed-${speed}`, actualSpeed, ...state });
 }
 // Controlled document visibility is restored in this isolated browser context.
 await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
 });
 const hiddenBefore = await snapshot(); await page.waitForTimeout(250); const hiddenAfter = await snapshot();
 assert.deepEqual(hiddenAfter.draws, hiddenBefore.draws, 'hidden page must stop ambient and battle canvas draws');
 assert.ok(hiddenAfter.animations.every(r => r.state !== 'running'), 'hidden page pauses infinite CSS animation');
 report.steps.push({ name: 'hidden', ...hiddenAfter });
 await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
 await page.waitForTimeout(150); const resumed = await snapshot(); report.steps.push({ name: 'visible-resumed', ...resumed });
 assert.ok(Object.keys(resumed.draws).some(k => resumed.draws[k] > (hiddenAfter.draws[k] || 0)), 'visible restores rendering');
 await page.screenshot({ path: fileURLToPath(new URL('844-battle.png', out)), fullPage: true });
 const oldRunBeforeExit = await page.evaluate(() => { const { stage, wins, lives } = window.__perfOldGame.run; return { stage, wins, lives }; });
 await page.evaluate(() => window.__app.toTitle());
 await page.getByRole('button', { name: '开始远征', exact: true }).waitFor();
 await page.waitForTimeout(1800);
 const exit = await page.evaluate(() => ({ gameGone: window.__app.game === null, cancelled: window.__perfOldPb.cancelled, disposed: window.__perfOldGame.disposed, title: !!document.querySelector('.screen.title'), battle: !!document.querySelector('.battle-bar') }));
 assert.ok(exit.gameGone && exit.cancelled && exit.disposed && exit.title && !exit.battle, 'cancelled old battle must not replace title');
 const oldRunAfterExit = await page.evaluate(() => { const { stage, wins, lives } = window.__perfOldGame.run; return { stage, wins, lives }; });
 assert.deepEqual(oldRunAfterExit, oldRunBeforeExit, 'cancelled old battle must not settle or mutate old run');
 report.steps.push({ name: 'exit-title', ...exit, oldRunBeforeExit, oldRunAfterExit });
 await page.screenshot({ path: fileURLToPath(new URL('844-title-after-exit.png', out)), fullPage: true });
 assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.passed = false; report.failure = error.stack || String(error); process.exitCode = 1; }
finally {
 writeFileSync(new URL('report.json', out), JSON.stringify(report, null, 2));
 await context?.close(); await browser.close();
 console.log(JSON.stringify({ passed: report.passed, failure: report.failure, steps: report.steps.map(s => s.name) }, null, 2));
}
