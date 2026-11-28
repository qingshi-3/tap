// Real-input regression for the trial board layout (schema2 non-tactical framing).
// Plays the protected trials through tap/drag in isolated browser contexts, checks that the
// objective panel is never opened by mistake, reloads mid-battle to confirm continue, and
// confirms the completed record survives a reload.
// Env: TRIAL_URL (default http://localhost:4197/), VP (e.g. 844x390), MOTION (normal|reduce),
//      SAFE=1 (left/right 44px safe area, re-applied after every load), CANVAS_OFFSET=24 (shifts
//      the board canvas down and asserts the framing stays inside the field viewport), SHOTS=1
//      (active-board screenshots), NO_RELOAD=1 (skip the mid-battle reload check, off by default),
//      LEVELS (comma list), ROUTE_RENDERER (path to a JS file
//      served in place of /js/renderer.js, used for the frozen release check), TAG (output name).
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const execFileAsync = promisify(execFile);

const env = process.env;
const url = env.TRIAL_URL || 'http://localhost:4197/';
const [W, H] = (env.VP || '844x390').split('x').map(Number);
const motion = env.MOTION === 'reduce' ? 'reduce' : 'no-preference';
const levelIds = (env.LEVELS || 'roar-lethal,break-the-guard,lightchaser-bond').split(',');
const tag = env.TAG || `layout-${W}x${H}-${motion === 'reduce' ? 'reduce' : 'normal'}`;
const outDir = 'output/trial-freeze-20261116/fix';
const STALL_MS = 5000;

async function loadPlan() {
  const { stdout } = await execFileAsync(process.execPath, ['tools/check-trial-lessons.mjs', '--json'], { maxBuffer: 64 * 1024 * 1024 });
  const json = JSON.parse(stdout.slice(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1));
  return json.results;
}

const stateSig = (s) => JSON.stringify({ phase: s.phase, round: s.round, winner: s.winner, mana: s.mana, hand: s.hand, units: s.units, last: s.last });
// Game-state-only signature evaluated in the page, so before/after compare identical fields.
const gameSigExpr = `JSON.stringify((() => { const s = window.__renderer?.state; if (!s) return null; return { phase: s.phase, round: s.round, winner: s.winner, mana: s.players[0].mana, hand: s.players[0].hand, units: s.units.map(u => [u.unitId, u.x, u.y, u.health, u.owner]), last: s.lastAction?.kind ?? null }; })())`;

async function runLevel(browser, lesson) {
  const log = { id: lesson.id, steps: [], stall: null, result: null, errors: [], objectiveOpened: false, reload: null, completionAfterReload: null, geometry: null, shots: [] };
  const shot = async name => {
    if (env.SHOTS !== '1') return;
    await mkdir(`${outDir}/shots`, { recursive: true });
    const path = `${outDir}/shots/${tag}-${lesson.id}-${name}.png`;
    await page.screenshot({ path });
    log.shots.push(path);
  };
  const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, reducedMotion: motion });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => log.errors.push('pageerror: ' + (e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') log.errors.push('console.error: ' + m.text()); });
  if (env.ROUTE_RENDERER) {
    const body = await readFile(env.ROUTE_RENDERER, 'utf8');
    await page.route(/\/js\/renderer\.js(\?.*)?$/, route => route.fulfill({ status: 200, contentType: 'text/javascript', body }));
  }
  await page.addInitScript(async () => {
    window.__errs = [];
    addEventListener('error', e => window.__errs.push('error: ' + (e.error?.stack || e.message)));
    addEventListener('unhandledrejection', e => window.__errs.push('unhandledrejection: ' + (e.reason?.stack || e.reason)));
    try {
      const { BoardRenderer } = await import('/js/renderer.js');
      const draw = BoardRenderer.prototype.draw;
      BoardRenderer.prototype.draw = function (...a) { window.__renderer = this; return draw.apply(this, a); };
    } catch (e) { window.__errs.push('renderer-hook: ' + e); }
  });
  const extraCss = [
    env.SAFE === '1' ? ':root{--device-safe-left:44px;--device-safe-right:44px;--device-safe-top:0px;--device-safe-bottom:0px}' : '',
    env.CANVAS_OFFSET ? `#board{transform:translateY(${Number(env.CANVAS_OFFSET)}px)}` : ''
  ].join('');
  if (extraCss) await page.addInitScript(css => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); }), extraCss);
  const cdp = await context.newCDPSession(page);
  const sig = () => page.evaluate(() => {
    const r = window.__renderer, s = r?.state; if (!s) return null;
    return { phase: s.phase, round: s.round, winner: s.winner, mana: s.players[0].mana, hand: s.players[0].hand,
      units: s.units.map(u => [u.unitId, u.x, u.y, u.health, u.owner]), last: s.lastAction?.kind ?? null,
      endDisabled: document.querySelector('#end-turn')?.disabled, result: !document.querySelector('#game-result')?.hidden,
      objectiveOpen: !!document.querySelector('#objective-dialog')?.open };
  });
  const idle = () => page.waitForFunction(() => !document.querySelector('#game-result').hidden || !document.querySelector('#end-turn').disabled, null, { timeout: STALL_MS, polling: 100 });
  const point = (cell, unit = false) => page.evaluate(({ x, y, unit }) => {
    const r = window.__renderer, b = r.canvas.getBoundingClientRect(), p = r.cellGeometry(r.boardMetrics(b.width, b.height), x, y).center;
    for (const dy of unit ? [0, -16, -28, -40] : [0]) {
      const c = { x: b.left + p.x, y: b.top + p.y + dy };
      const hit = r.positionFromPointer({ clientX: c.x, clientY: c.y }, { preferUnits: unit });
      if (hit?.x === x && hit?.y === y && document.elementFromPoint(c.x, c.y) === r.canvas) return c;
    }
    throw new Error(`No unobscured touch point for ${x},${y}`);
  }, { ...cell, unit });
  const drag = async (a, b) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 12, y: a.y + (b.y - a.y) * i / 12 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const openTrial = async () => {
    await page.locator('[data-action="nav"][data-page="trials"]').first().tap();
    await page.locator(`[data-action="trial-group"][data-group-id="${lesson.group}"]`).tap();
    await page.locator(`[data-action="trial"][data-level-id="${lesson.id}"]`).tap();
    await page.locator('#objective-close').tap().catch(() => {});
  };
  let stepNo = 0;
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await openTrial();
    await page.waitForFunction(() => window.__renderer?.ready, null, { timeout: STALL_MS });
    log.geometry = await page.evaluate(() => {
      const r = window.__renderer, b = r.canvas.getBoundingClientRect();
      return { canvas: [b.left, b.top, b.width, b.height], metrics: r.boardMetrics(b.width, b.height), field: r.battlefieldViewport(b.width, b.height) };
    });
    if (env.CANVAS_OFFSET) {
      const { metrics, field } = log.geometry;
      if (metrics.top < field.top - .5 || metrics.bottom > field.bottom + .5) log.errors.push(`board framing ${metrics.top}-${metrics.bottom} outside field ${field.top}-${field.bottom}`);
    }
    for (const step of lesson.steps) {
      stepNo++;
      const rec = { n: stepNo, step, before: null, after: null, changed: false };
      await page.keyboard.press('Escape');
      await idle().catch(() => { rec.idleTimeout = true; });
      rec.before = await sig();
      const beforeGame = await page.evaluate(gameSigExpr);
      if (stepNo === 1) await shot('start');
      if (step.type === 'move') {
        const a = await point(step.from, true), b = await point(step.to);
        await drag(a, b);
      } else if (step.type === 'attack') {
        const a = await point(step.from, true), b = await point(step.target, true);
        await page.touchscreen.tap(a.x, a.y); await page.touchscreen.tap(b.x, b.y);
      } else if (step.type === 'skill') {
        const rect = await page.locator('#bbs-button').boundingBox();
        await drag({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, await point(step.target, true));
      } else if (step.type === 'end-turn') {
        await page.locator('#end-turn').tap();
      } else {
        const index = await page.evaluate(id => window.__renderer.state.players[0].hand.indexOf(id), step.cardId);
        if (index < 0) throw new Error(`hand missing ${step.cardId}`);
        const card = await page.locator('#hand button').nth(index).boundingBox();
        const from = { x: card.x + card.width / 2, y: card.y + Math.min(24, card.height / 2) };
        const destination = step.type === 'summon' ? step.to : (step.target ?? { x: 3, y: 2 });
        await drag(from, await point(destination, !!step.target && step.type !== 'summon'));
      }
      try {
        await page.waitForFunction(`${gameSigExpr} !== ${JSON.stringify(beforeGame)}`, undefined, { timeout: STALL_MS, polling: 100 });
        rec.changed = true;
      } catch { rec.changed = false; }
      await idle().catch(() => { rec.idleTimeout = true; });
      rec.after = await sig();
      if (stepNo === 1) await shot('after-step1');
      log.objectiveOpened ||= !!rec.after?.objectiveOpen;
      log.steps.push(rec);
      if (stepNo === 1 && rec.changed && env.NO_RELOAD !== '1') {
        const before = stateSig(rec.after);
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(1200);
        const resume = page.locator('#resume-local');
        if (await resume.isVisible().catch(() => false)) await resume.tap();
        else { await openTrial(); }
        await page.waitForFunction(() => window.__renderer?.ready, null, { timeout: STALL_MS }).catch(() => {});
        await page.waitForTimeout(600);
        const resumed = await sig();
        log.reload = { restored: !!resumed && stateSig(resumed) === before, resumedVia: await resume.isVisible().catch(() => false) ? 'resume-local' : 'trial-card' };
      }
      if (!rec.changed) { log.stall = { step: stepNo, action: step.type }; break; }
    }
    await page.waitForTimeout(500);
    log.result = await page.evaluate(() => ({ visible: !document.querySelector('#game-result').hidden, title: document.querySelector('#result-title')?.innerText, winner: window.__renderer?.state?.winner ?? null, errs: window.__errs.slice() }));
    if (log.result.visible && log.result.winner === 0) {
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(1200);
      await page.locator('[data-action="nav"][data-page="trials"]').first().tap();
      await page.locator(`[data-action="trial-group"][data-group-id="${lesson.group}"]`).tap();
      const card = page.locator(`[data-action="trial"][data-level-id="${lesson.id}"]`);
      log.completionAfterReload = (await card.innerText().catch(() => '')).includes('已完成');
    }
  } finally {
    await context.close();
  }
  const reloadOk = env.NO_RELOAD === '1' || log.reload?.restored === true;
  log.won = !!(log.result?.visible && log.result?.winner === 0) && !log.stall && !log.errors.length && !(log.result?.errs?.length)
    && !log.objectiveOpened && reloadOk && log.completionAfterReload === true;
  return log;
}

const plan = await loadPlan();
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const summary = { url, tag, viewport: [W, H], motion, routedRenderer: env.ROUTE_RENDERER || null, levels: [] };
try {
  for (const id of levelIds) {
    const lesson = plan.find(p => p.id === id);
    if (!lesson) throw new Error(`no plan for ${id}`);
    try {
      summary.levels.push(await runLevel(browser, lesson));
    } catch (e) {
      summary.levels.push({ id, won: false, error: String(e.message || e).split('\n')[0] });
    }
  }
} finally {
  await browser.close();
}
summary.allWon = summary.levels.every(l => l.won);
await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}/check-trial-layout-${tag}.json`, JSON.stringify(summary, null, 2));
console.log(summary.levels.map(l => l.error ? `${l.id}: won=false error=${l.error}` : `${l.id}: won=${l.won} stall=${!!l.stall} objectiveOpened=${l.objectiveOpened} reload=${l.reload?.restored} completionAfterReload=${l.completionAfterReload}`).join('\n'));
console.log(`allWon=${summary.allWon}`);
process.exitCode = summary.allWon ? 0 : 1;
