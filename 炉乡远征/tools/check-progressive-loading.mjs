import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { battleCardIds, effectDependencies } from '../dist/js/battle-assets.js';
import { CARDS } from '../dist/js/cards.js';
import { EFFECT_MANIFEST } from '../dist/js/effect-manifest.js';
const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const base = process.env.PROGRESSIVE_BASE || 'http://127.0.0.1:4223';
const out = 'output/progressive-loading';
await mkdir(out, { recursive: true });
const checks = [], errors = [], measurements = [];
const state = ids => ({ players: [{ id: 0, generalId: 1, deck: ids, hand: [] }], units: [] });
for (const [roots, expected] of [[[123],108], [[201],225], [[301],315], [[214],217], [[317],315], [[412],411], [[503],504], [[20144],520], [[20061],315], [[20072],315], [[20149],525], [[310],315]]) {
  assert.ok(battleCardIds(state(roots)).includes(expected), `rules closure ${roots} -> ${expected}`);
}
assert.ok(battleCardIds({ ...state([]), units: [{ cardId: 411, hatchCardId: 413 }] }).includes(413));
const frozen = { ...state([9]), schemaVersion: 5, battleCards: { 0: { 9: { ...CARDS[9], dyingWolf: 504 } } } };
assert.ok(battleCardIds(frozen).includes(504), 'historical frozen dependencies');
const random = effectDependencies([1], { resources: { a: {}, b: {} }, cardRecipes: { 1: ['spawn'] }, recipes: { spawn: { UnitSpawnFX: [{ chooseOneRandomly: [{ spriteIdentifier: 'a' }, 'b'] }] } } });
assert.deepEqual(random.resources.sort(), ['a', 'b']);
checks.push('commander, egg/hatch, opening/death summons, transform, frozen rules and all random FX branches included');

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
async function fixture() {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(async () => {
    const { BoardRenderer } = await import('/js/renderer.js');
    for (const method of ['drawCardArt', 'draw']) {
      const original = BoardRenderer.prototype[method];
      BoardRenderer.prototype[method] = function (...args) { window.__renderer = this; return original.apply(this, args); };
    }
  });
  return { context, page };
}
async function prepare(page) {
  await page.locator('.menu-play').tap();
  await page.locator('[data-action="chapter"]').first().tap();
  await page.locator('[data-action="adjust-loadout"]').tap();
}
async function ready(page) {
  await Promise.race([
    page.locator('#objective-close').waitFor({ state: 'visible' }).then(() => 'ready'),
    page.locator('[data-loading-action="retry"]').waitFor({ state: 'visible' }).then(() => { throw new Error('battle dependency preparation failed'); }),
  ]);
}
try {
  {
    const { context, page } = await fixture();
    const unitRequests = [];
    page.on('request', request => { if (/\/assets\/units\//.test(request.url())) unitRequests.push(request.url()); });
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/assets/units/*.png', async route => { await held; await route.continue(); });
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal(unitRequests.length, 0, 'menu does not start card-pool downloads');
    const tracked = await page.evaluate(() => window.__renderer.assets.canvases.size);
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    assert.equal(await page.evaluate(() => window.__renderer.assets.canvases.size), tracked, 'BFCache keeps lazy canvas registrations');
    await page.locator('[data-action="nav"][data-page="codex"]').tap();
    await page.locator('.expedition-codex-card').first().waitFor();
    assert.match(await page.locator('.expedition-codex-rail').innerText(), /阿杰农|齐兰|银翼|守卫/);
    await page.waitForFunction(() => window.__renderer?.assets.optionalActive > 0);
    assert.ok(unitRequests.length < 12, 'only small visible batches download');
    const before = await page.locator('.expedition-codex-rail').screenshot();
    release();
    await page.waitForFunction(() => {
      const cards = [...document.querySelectorAll('.expedition-codex-card canvas')];
      return cards.some(canvas => window.__renderer.assets.hasCard(Number(canvas.dataset.cardArt)));
    });
    await page.screenshot({ path: `${out}/collection-ready.png` });
    const after = await page.locator('.expedition-codex-rail').screenshot();
    assert.notDeepEqual(before, after, 'visible art replaces placeholder without changing page');
    checks.push('cold menu requests no units; BFCache return retains lazy observers; collection text visible during stalled art; visible art progressively replaces placeholder');
    await context.close();
  }
  {
    const { context, page } = await fixture();
    let fail = true;
    await page.route('**/assets/units/f1_general.png', route => fail ? route.abort() : route.continue());
    await page.goto(base); await page.locator('[data-action="nav"][data-page="codex"]').tap();
    await page.locator('#art-retry').waitFor({ state: 'visible' });
    assert.match(await page.locator('.expedition-codex-rail').innerText(), /阿杰农/);
    assert.equal(await page.evaluate(() => window.__renderer.assets.hasCard(1)), false);
    fail = false; await page.locator('#art-retry').tap();
    await page.waitForFunction(() => window.__renderer.assets.hasCard(1));
    await page.locator('#art-retry').waitFor({ state: 'hidden' });
    checks.push('collection image failure preserves text; retry button re-downloads failed visible card and clears warning');
    await context.close();
  }
  {
    const { context, page } = await fixture();
    const cdp = await context.newCDPSession(page); await cdp.send('Network.enable');
    let requests = 0, bytes = 0;
    cdp.on('Network.requestWillBeSent', () => requests++);
    cdp.on('Network.loadingFinished', event => { bytes += event.encodedDataLength; });
    const started = Date.now();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await prepare(page);
    const tapped = Date.now(); await page.locator('.prep-start').tap(); await ready(page);
    const battleReady = Date.now();
    const info = await page.evaluate(async () => {
      const { battleCardIds } = await import('/js/battle-assets.js');
      const r = window.__renderer, ids = battleCardIds(r.state);
      return { ids, missing: ids.filter(id => !r.assets.hasCard(id)), atlases: r.atlases.size, trackedCanvases: r.assets.canvases.size };
    });
    assert.deepEqual(info.missing, []);
    assert.ok(info.atlases < 77, 'first encounter loads fewer atlases than complete pool');
    assert.ok(requests < 616, 'first entry reduces old 616-request baseline');
    const signature = await page.evaluate(() => JSON.parse(localStorage.getItem('duelyst-h5.safe-v1.expedition')).activeBattle.runId);
    await page.locator('#objective-close').tap();
    await page.locator('#leave-match').tap();await page.locator('#confirm-accept').tap();
    const resumed = Date.now(); await page.locator('.menu-play').tap(); await ready(page);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('duelyst-h5.safe-v1.expedition')).activeBattle.runId), signature);
    measurements.push({ network: 'local', firstBattleTapToReadyMs: battleReady - tapped, navigationToReadyMs: battleReady - started, requests, encodedBytes: bytes, samePageResumeMs: Date.now() - resumed, ...info });
    checks.push('first encounter complete card closure drawable with fewer requests/atlases; same-page resume preserves battle');
    await context.close();
  }
  {
    const { context, page } = await fixture();
    await page.goto(base);
    await page.evaluate(async () => {
      const { createChallengeMatch } = await import('/js/engine.js');
      const { SaveManager } = await import('/js/save-manager.js');
      const save = new SaveManager();
      if (!save.saveLocal(createChallengeMatch('vanar-wall-and-infiltrate'))) throw Error('trial fixture save failed');
    });
    await page.reload();
    await page.locator('[data-action="nav"][data-page="trials"]').tap();
    const trial = page.locator('[data-action="trial"][data-level-id="vanar-wall-and-infiltrate"]');
    await trial.scrollIntoViewIfNeeded(); await trial.tap(); await ready(page);
    await page.locator('#objective-close').tap();
    await page.getByRole('button', { name: /^寒骨屏障[,，]/ }).tap();
    const cell = await page.evaluate(() => {
      const r = window.__renderer, rect = r.canvas.getBoundingClientRect();
      const center = r.cellGeometry(r.boardMetrics(rect.width, rect.height), 4, 0).center;
      return { x: rect.left + center.x, y: rect.top + center.y };
    });
    await page.touchscreen.tap(cell.x, cell.y);
    await page.waitForFunction(() => window.__renderer.state.units.filter(unit => unit.cardId === 525).length === 4);
    const visuals = await page.evaluate(async () => {
      const { battleCardIds, effectDependencies } = await import('/js/battle-assets.js');
      const r = window.__renderer, closure = battleCardIds(r.state), dependency = effectDependencies(closure);
      return { missing: closure.filter(id => !r.assets.hasCard(id)), missingFX: dependency.resources.filter(key => !r.effects.atlases.has(key) && !r.effects.staticImages.has(key)), spawned: r.state.units.filter(unit => unit.cardId === 525).length };
    });
    assert.deepEqual(visuals.missing, []); assert.deepEqual(visuals.missingFX, []);
    await page.screenshot({ path: `${out}/summoned-walls.png` });
    checks.push('saved trial resumes through real UI; hand-card and board taps summon three walls; resulting units and related FX already prepared');
    await context.close();
  }
  {
    const { context, page } = await fixture();
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/assets/maps/battlemap2_background.png', async route => { await held; await route.continue(); });
    await page.goto(base); await prepare(page); await page.locator('.prep-start').tap();
    await page.locator('#scene-loading[open]').waitFor();
    const saved = await page.evaluate(() => localStorage.getItem('duelyst-h5.safe-v1.expedition'));
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    await page.locator('#scene-loading').waitFor({ state: 'hidden' });
    release(); await page.waitForTimeout(350);
    assert.equal(await page.locator('#objective-close').isVisible(), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('duelyst-h5.safe-v1.expedition')), saved);
    checks.push('pagehide cancels delayed preparation; late resource completion cannot enter or commit storage');
    await context.close();
  }
  {
    const { context, page } = await fixture();
    let fail = true;
    await page.route('**/assets/units/f1_general.png', route => fail ? route.abort() : route.continue());
    await page.goto(base); await prepare(page);
    await page.locator('.prep-start').tap();
    await page.locator('[data-loading-action="retry"]').waitFor({ state: 'visible' });
    const saved = await page.evaluate(() => localStorage.getItem('duelyst-h5.safe-v1.expedition'));
    assert.equal(JSON.parse(saved).activeBattle, null, 'confirming a deck may save the deck, never the unprepared battle');
    assert.equal(await page.locator('#match').isVisible(), false);
    await page.locator('[data-loading-action="cancel"]').tap();
    assert.equal(await page.evaluate(() => localStorage.getItem('duelyst-h5.safe-v1.expedition')), saved);
    await page.locator('.prep-start').tap();
    await page.locator('[data-loading-action="retry"]').waitFor({ state: 'visible' });
    fail = false; await page.locator('[data-loading-action="retry"]').tap(); await ready(page);
    checks.push('required unit failure keeps battle hidden; cancel preserves exact storage; explicit retry decodes and enters');
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ passed: true, checks, measurements, errors }, null, 2));
  console.log(JSON.stringify({ checks, measurements }, null, 2));
} catch (error) {
  await writeFile(`${out}/report.json`, JSON.stringify({ passed: false, checks, measurements, errors, failure: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
