import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { RoguelikeSession, ROGUELIKE_KEY } from '../dist/js/roguelike-session.js';
import { confirmMulligan, validateMatch } from '../dist/js/engine.js';
import { CARDS } from '../dist/js/cards.js';

const { chromium } = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const fixtures = JSON.parse(await readFile(new URL('../output/roguelike/session-engine-fixtures.json', import.meta.url))).fixtures;
const output = new URL('../output/roguelike/integration-ui/', import.meta.url);
await mkdir(output, { recursive: true });
const report = {
  checks: [], errors: [],
  limitations: ['Desktop Edge touch emulation, physical phones and TapTap host pending.', 'Victory/loss UI scenarios use validated near-terminal fixture positions. Whole six-battle runs are covered separately with real engine autoAct.']
};
class Memory {
  constructor(record) { this.raw = JSON.stringify(record); }
  getItem() { return this.raw; }
  setItem(key, value) { assert.equal(key, ROGUELIKE_KEY); this.raw = value; }
}
function battleFixture(losing = false) {
  const storage = new Memory(fixtures.battle);
  const session = new RoguelikeSession({ storage });
  const restored = session.restoreBattle();
  assert.ok(restored.ok, restored.error);
  const match = restored.match;
  assert.ok(confirmMulligan(match));
  const source = match.units.find(unit => unit.owner === 0 && unit.cardId === match.players[0].generalId);
  const target = match.units.find(unit => unit.owner === 1 && unit.cardId === match.players[1].generalId);
  Object.assign(source, { x: 3, y: 2, moved: false, attacked: false });
  Object.assign(target, { x: 4, y: 2 });
  if (losing) source.health = 1;
  else target.health = 1;
  assert.ok(validateMatch(match));
  assert.ok(session.checkpoint(match).ok);
  session.leave();
  return { record: JSON.parse(storage.raw), source: source.unitId, target: target.unitId };
}
const winFixture = battleFixture(), lossFixture = battleFixture(true);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const base = process.env.ROGUELIKE_UI_BASE || 'http://127.0.0.1:4197/';
const action = (page, name) => page.locator(`#roguelike-home [data-action="${name}"]`);
async function confirmation(page, accept) {
  const existing = accept ? '#confirm-accept' : '#confirm-cancel';
  const fallback = accept ? 'confirm-yes' : 'confirm-cancel';
  await page.locator(`${existing}:visible, #roguelike-home [data-action="${fallback}"]:visible`).tap();
}
async function shot(page, name) { await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) }); }
async function record(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), ROGUELIKE_KEY); }
async function phase(page, name) { await page.locator(`#roguelike-home[data-phase="${name}"]`).waitFor({ state: 'visible' }); }
async function permanentBytes(page) {
  return page.evaluate(() => Object.fromEntries(['duelyst-h5.safe-v1.expedition', 'duelyst-h5.safe-v1.campaign', 'duelyst-h5.safe-v1.match', 'duelyst-h5.safe-v1.ranked-challenge-v1'].map(key => [key, localStorage.getItem(key)])));
}
async function createPage(width, height, motion, initial, capsule = false) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, reducedMotion: motion });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.stack || String(error)));
  // Browser instrumentation observes the renderer without invoking gameplay actions.
  await page.route('**/js/renderer.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nconst observedDraw = BoardRenderer.prototype.draw; BoardRenderer.prototype.draw = function(...args) { window.__rogueRenderer = this; return observedDraw.apply(this,args); };` });
  });
  await page.addInitScript(({ key, initial, capsule }) => {
    if (!sessionStorage.getItem('rogue-test-initialized')) {
      if (initial) localStorage.setItem(key, JSON.stringify(initial));
      sessionStorage.setItem('rogue-test-initialized', '1');
    }
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, value) {
      if (window.__failRogueWrite && k === key) throw new DOMException('Isolated quota failure', 'QuotaExceededError');
      return set.call(this, k, value);
    };
    if (capsule) document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--host-capsule-width', '96px');
      document.documentElement.style.setProperty('--host-capsule-height', '36px');
    });
  }, { key: ROGUELIKE_KEY, initial, capsule });
  await page.goto(base);
  await page.locator('#expedition-home [data-action="roguelike"]').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  const destinations = await page.locator('.menu-destinations button').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { text: node.textContent, width: rect.width, height: rect.height, y: rect.y, reachable: !!hit && node.contains(hit), inside: rect.bottom <= innerHeight && rect.right <= innerWidth };
  }));
  for (const button of destinations) assert.ok(button.width >= 44 && button.height >= 44 && button.inside && button.reachable, JSON.stringify(button));
  assert.equal(new Set(destinations.map(button => Math.round(button.y))).size, 1, 'all home destinations occupy the authored row');
  return { context, page };
}
async function enter(page) {
  await page.locator('#expedition-home [data-action="roguelike"]').tap();
  await page.locator('#roguelike-home').waitFor({ state: 'visible' });
}
async function enterBattle(page) {
  await action(page, 'battle').tap();
  await page.locator('#objective-close').waitFor({ state: 'visible' });
  await page.locator('#objective-close').tap();
  await page.waitForFunction(() => window.__rogueRenderer?.state?.roguelike && !document.querySelector('#match').hidden);
  const opening = page.locator('.opening-confirm');
  if (await opening.isVisible()) await opening.tap();
  await page.waitForFunction(() => window.__rogueRenderer?.state?.phase === 'playing');
  await page.waitForTimeout(350);
}
async function attack(page, fixture) {
  await page.locator('#focus-general').tap();
  for (const id of [fixture.source, fixture.target]) {
    const point = await page.evaluate(id => {
      const renderer = window.__rogueRenderer;
      const unit = renderer.state.units.find(item => item.unitId === id);
      const anchor = renderer.getUnitAnchor(unit);
      for (const dy of [0, 8, -8, 16, -16]) {
        const p = { x: anchor.x, y: anchor.y + dy };
        const cell = renderer.positionFromPointer({ clientX: p.x, clientY: p.y }, { preferUnits: true });
        if (document.elementFromPoint(p.x, p.y) === renderer.canvas && cell?.x === unit.x && cell?.y === unit.y) return p;
      }
      return null;
    }, id);
    assert.ok(point, 'battle unit reachable through normal focus-general input');
    await page.touchscreen.tap(point.x, point.y);
  }
  await page.locator('#game-result').waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
}
async function mainControls(page) {
  const controls = await page.locator('#roguelike-home .roguelike-footer button').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => {
    const r = node.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { action: node.dataset.action, disabled: node.disabled, width: r.width, height: r.height, visible: r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, reachable: !!hit && node.contains(hit) };
  }));
  assert.ok(controls.length);
  for (const c of controls) assert.ok(c.width >= 44 && c.height >= 44 && c.visible && (c.disabled || c.reachable), JSON.stringify(c));
}
try {
  if (!process.env.ROGUELIKE_UI_CASE || process.env.ROGUELIKE_UI_CASE === 'new') {
    const { context, page } = await createPage(568, 320, 'reduce', null, true);
    const before = await permanentBytes(page);
    await shot(page, '568-home-entry');
    await enter(page); await phase(page, 'setup'); await mainControls(page);
    await action(page, 'hero-123').tap(); await action(page, 'hero-301').tap(); await action(page, 'hero-23').tap();
    assert.ok(await action(page, 'difficulty-2').isDisabled());
    await shot(page, '568-setup-capsule');
    await action(page, 'start').tap(); await phase(page, 'relic');
    const opening = await record(page);
    await page.locator('#roguelike-home [data-action^="relic-"]').first().tap(); await action(page, 'take-relic').tap();
    await phase(page, 'route'); await mainControls(page);
    const route = (await record(page)).run.offers.routes[0];
    await action(page, `route-intel-${route.id}`).tap(); await shot(page, '568-enemy-intel'); await action(page, 'view-back').tap();
    await action(page, `route-${route.id}`).tap(); await enterBattle(page);
    await shot(page, '568-new-battle');
    await page.locator('#objective-open').tap();
    assert.ok((await page.locator('#objective-dialog').innerText()).includes(opening.run.offers.relics[0].name), 'owned relic shown with battle rules');
    await page.locator('#objective-close').tap();
    await page.locator('#leave-match').tap(); await page.locator('#settings-leave-battle').tap(); await page.locator('#confirm-accept').tap();
    await phase(page, 'battle');
    const saved = await record(page);
    await page.reload(); await enter(page); await phase(page, 'battle'); await enterBattle(page);
    assert.equal(await page.evaluate(() => window.__rogueRenderer.state.runId), saved.run.match.runId);
    await page.locator('#leave-match').tap(); await page.locator('#settings-leave-battle').tap(); await page.locator('#confirm-accept').tap();
    await phase(page, 'battle'); await action(page, 'abandon').tap(); await confirmation(page, false);
    assert.equal((await record(page)).run.phase, 'battle');
    await action(page, 'abandon').tap(); await confirmation(page, true); await phase(page, 'lost');
    await action(page, 'new-run').tap(); await phase(page, 'setup');
    assert.deepEqual(await permanentBytes(page), before);
    report.checks.push({ case: 'new-run-resume-abandon', width: 568, height: 320, capsule: true, normalEntry: true, permanentBytesPreserved: true });
    await context.close();
  }
  for (const [width, height, motion] of [[568, 320, 'reduce'], [844, 390, 'no-preference']]) {
    if (process.env.ROGUELIKE_UI_CASE && process.env.ROGUELIKE_UI_CASE !== 'win') continue;
    const { context, page } = await createPage(width, height, motion, winFixture.record);
    const before = await permanentBytes(page);
    await enter(page); await enterBattle(page); await attack(page, winFixture);
    assert.equal((await record(page)).run.phase, 'cards');
    for (const id of ['next-level', 'play-again', 'result-ad-reward', 'result-collection', 'result-prep', 'result-platform-status', 'result-ranked-submit']) assert.equal(await page.locator(`#${id}`).isVisible(), false, `${id} hidden for rogue`);
    await shot(page, `${width}-victory`);
    await page.locator('#back-to-lobby').tap(); await phase(page, 'cards'); await mainControls(page);
    await shot(page, `${width}-cards`);
    const reward = await record(page), offer = reward.run.offers.cards[0];
    await action(page, `pack-${offer.id}`).tap(); await action(page, 'take-cards').tap();
    await phase(page, 'camp'); await mainControls(page);
    assert.equal((await record(page)).run.deck.length, reward.run.deck.length + 2);
    const id = (await record(page)).run.deck[0];
    await action(page, `camp-card-${id}`).tap(); await action(page, 'camp-buy').tap();
    await confirmation(page, false); assert.equal((await record(page)).run.gold, reward.run.gold);
    await action(page, 'camp-buy').tap(); await confirmation(page, true);
    assert.equal((await record(page)).run.upgrades[id], 1);
    assert.equal((await record(page)).run.gold, reward.run.gold - 45);
    await shot(page, `${width}-camp-upgraded`);
    await page.reload(); await enter(page); await phase(page, 'camp');
    assert.equal((await record(page)).run.upgrades[id], 1);
    assert.equal((await record(page)).run.deck.length, reward.run.deck.length + 2);
    await action(page, 'camp-continue').tap(); await phase(page, 'route');
    assert.equal((await record(page)).run.stage, 2);
    await page.locator('#roguelike-home .roguelike-route').first().tap(); await enterBattle(page);
    assert.equal(await page.evaluate(() => window.__rogueRenderer.state.roguelike.stage), 2);
    const continued = await page.evaluate(id => ({
      rank: window.__rogueRenderer.state.roguelike.upgrades[id],
      card: window.__rogueRenderer.state.battleCards[0][id],
    }), id);
    assert.equal(continued.rank, 1, 'upgrade persists into the next battle');
    if (CARDS[id].type === 'spell') assert.equal(continued.card.cost, Math.max(0, CARDS[id].cost - 1));
    else {
      assert.equal(continued.card.attack, CARDS[id].attack + 1);
      assert.equal(continued.card.health, CARDS[id].health + 2);
    }
    await shot(page, `${width}-second-battle`);
    assert.deepEqual(await permanentBytes(page), before);
    report.checks.push({ case: 'tap-victory-rewards-upgrade-reload-next-battle', width, height, motion, permanentBytesPreserved: true, upgradePersistsAcrossBattles: true });
    await context.close();
  }
  if (!process.env.ROGUELIKE_UI_CASE || process.env.ROGUELIKE_UI_CASE === 'failure') {
    const { context, page } = await createPage(568, 320, 'reduce', winFixture.record);
    await enter(page); await enterBattle(page);
    await page.evaluate(() => { window.__failRogueWrite = true; });
    await attack(page, winFixture);
    assert.equal((await record(page)).run.phase, 'battle');
    await page.locator('#back-to-lobby').tap(); assert.ok(await page.locator('#game-result').isVisible());
    await shot(page, '568-save-error');
    await page.evaluate(() => { window.__failRogueWrite = false; });
    await page.locator('#back-to-lobby').tap(); await phase(page, 'cards');
    const once = await record(page);
    await page.reload(); await enter(page); await phase(page, 'cards');
    assert.equal((await record(page)).run.gold, once.run.gold);
    assert.equal((await record(page)).run.settled.length, 1);
    report.checks.push({ case: 'failed-terminal-save-return-blocked-retry-once', width: 568 });
    await context.close();
  }
  if (!process.env.ROGUELIKE_UI_CASE || process.env.ROGUELIKE_UI_CASE === 'loss') {
    const { context, page } = await createPage(844, 390, 'reduce', lossFixture.record);
    await enter(page); await enterBattle(page); await attack(page, lossFixture);
    assert.equal((await record(page)).run.phase, 'lost');
    await shot(page, '844-defeat'); await page.locator('#back-to-lobby').tap(); await phase(page, 'lost');
    await action(page, 'new-run').tap(); await phase(page, 'setup');
    await action(page, 'start').tap(); await phase(page, 'relic');
    report.checks.push({ case: 'tap-defeat-new-run', width: 844 }); await context.close();
  }
  if (!process.env.ROGUELIKE_UI_CASE || process.env.ROGUELIKE_UI_CASE === 'unlocks') {
    const { context, page } = await createPage(568, 320, 'reduce', fixtures.won, true);
    await enter(page); await phase(page, 'won'); await mainControls(page);
    await shot(page, '568-run-complete');
    await action(page, 'records').tap();
    assert.ok((await page.locator('.roguelike-records').innerText()).includes('最高难度 1'));
    await page.keyboard.press('Escape'); await action(page, 'new-run').tap(); await phase(page, 'setup');
    const kits = page.locator('#roguelike-home [data-action^="kit-"]');
    assert.equal(await kits.nth(1).isDisabled(), false);
    assert.equal(await action(page, 'difficulty-2').isDisabled(), false);
    assert.equal(await action(page, 'difficulty-3').isDisabled(), true);
    await kits.nth(1).tap(); await action(page, 'difficulty-2').tap();
    await action(page, 'start').focus(); await page.keyboard.press('Enter'); await phase(page, 'relic');
    const saved = await record(page); assert.equal(saved.run.difficulty, 2);
    await page.reload(); await enter(page); await phase(page, 'relic');
    assert.deepEqual((await record(page)).run.offers, saved.run.offers);
    await action(page, 'back').focus(); await page.keyboard.press('Shift+Tab');
    assert.ok(await page.locator('#roguelike-home').evaluate(root => root.contains(document.activeElement)), 'keyboard focus remains within run');
    report.checks.push({ case: 'real-engine-finished-save-unlocks-keyboard-start-reload', width: 568 }); await context.close();
  }
  if (!process.env.ROGUELIKE_UI_CASE || process.env.ROGUELIKE_UI_CASE === 'resources') {
    const { context, page } = await createPage(844, 390, 'reduce', fixtures['selected-route']);
    let fail = true;
    await page.route('**/assets/maps/battlemap2_background.png', async route => {
      if (fail) await route.fulfill({ status: 503, contentType: 'text/plain', body: 'isolated loading failure' });
      else await route.continue();
    });
    await enter(page); await phase(page, 'route'); await action(page, 'battle').tap();
    await page.locator('[data-loading-action="retry"]').waitFor({ state: 'visible', timeout: 45000 });
    assert.equal((await record(page)).run.phase, 'route', 'load failure does not commit battle');
    await shot(page, '844-resource-failure');
    await page.locator('[data-loading-action="cancel"]').tap(); await phase(page, 'route');
    assert.equal((await record(page)).run.route.id, fixtures['selected-route'].run.route.id);
    fail = false;
    await enterBattle(page);
    assert.equal((await record(page)).run.phase, 'battle');
    report.checks.push({ case: 'asset-failure-cancel-same-route-retry', width: 844 }); await context.close();
  }
  if (!process.env.ROGUELIKE_UI_CASE || process.env.ROGUELIKE_UI_CASE === 'layout') {
    for (const [width, height] of [[568, 320], [844, 390]]) {
      const { context, page } = await createPage(width, height, 'reduce', fixtures.battle, true);
      await shot(page, `${width}-home-final`);
      await page.locator('#expedition-home [data-action="achievements"]').tap();
      await page.locator('.platform-progress-close').tap();
      await enter(page); await action(page, 'battle').tap();
      await page.locator('#objective-close').waitFor({ state: 'visible' });
      await page.waitForFunction(() => {
        const icons = [...document.querySelectorAll('#objective-relics img')];
        return icons.length > 0 && icons.every(icon => icon.complete && icon.naturalWidth > 0);
      });
      await shot(page, `${width}-objective-relics`);
      await page.locator('#objective-relics').scrollIntoViewIfNeeded();
      assert.ok(await page.locator('#objective-relics').isVisible());
      await shot(page, `${width}-objective-relics-scroll`);
      await page.locator('#objective-close').tap();
      report.checks.push({ case: 'home-destinations-and-battle-relic-details', width, height, capsule: true });
      await context.close();
    }
  }
  if (!process.env.ROGUELIKE_UI_CASE || process.env.ROGUELIKE_UI_CASE === 'turn') {
    const { context, page } = await createPage(568, 320, 'no-preference', fixtures.battle);
    await enter(page); await enterBattle(page);
    await page.locator('#end-turn').tap();
    await page.waitForFunction(() => window.__rogueRenderer?.state?.round >= 2 && window.__rogueRenderer.state.phase === 'playing' && !document.querySelector('#end-turn').disabled, null, { timeout: 45000 });
    await page.locator('#focus-general').tap();
    const move = await page.evaluate(async () => {
      const { movementPositions, findGeneral } = await import('/js/engine.js');
      const renderer = window.__rogueRenderer, match = renderer.state, unit = findGeneral(match, 0);
      const bounds = renderer.canvas.getBoundingClientRect();
      const metrics = renderer.boardMetrics(bounds.width, bounds.height);
      const anchor = renderer.getUnitAnchor(unit), source = { x: anchor.x, y: anchor.y };
      for (const cell of movementPositions(match, unit)) {
        if (cell.x === unit.x && cell.y === unit.y) continue;
        const center = renderer.cellGeometry(metrics, cell.x, cell.y).center;
        const target = { x: bounds.x + center.x, y: bounds.y + center.y };
        if (document.elementFromPoint(target.x, target.y) !== renderer.canvas) continue;
        return { source, target, id: unit.unitId, cell };
      }
      return null;
    });
    assert.ok(move, 'normal second-turn move target available');
    // Authored movement uses pointer drag from the selected unit to its destination.
    const cdp = await context.newCDPSession(page);
    await page.touchscreen.tap(move.source.x, move.source.y);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [move.source] });
    for (let step = 1; step <= 10; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: move.source.x + (move.target.x - move.source.x) * step / 10, y: move.source.y + (move.target.y - move.source.y) * step / 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
    await page.waitForFunction(({ id, cell }) => { const unit = window.__rogueRenderer.state.units.find(value => value.unitId === id); return unit.x === cell.x && unit.y === cell.y; }, move);
    await page.waitForTimeout(700);
    await shot(page, '568-ai-finished-player-move');
    assert.ok((await record(page)).run.match.round >= 2);
    report.checks.push({ case: 'real-ai-turn-finishes-and-player-drag-resumes', width: 568, motion: 'no-preference' });
    await context.close();
  }
} catch (error) {
  report.errors.push(error.stack || String(error));
  for (const context of browser.contexts()) for (const page of context.pages()) await shot(page, 'failure').catch(() => {});
} finally {
  await browser.close();
  report.passed = report.errors.length === 0;
  const suffix = process.env.ROGUELIKE_UI_CASE ? `-${process.env.ROGUELIKE_UI_CASE}` : '';
  await writeFile(new URL(`report${suffix}.json`, output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks, errors: report.errors }, null, 2));
}
if (!report.passed) process.exitCode = 1;
