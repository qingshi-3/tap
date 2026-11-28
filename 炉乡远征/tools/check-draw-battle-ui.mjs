import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';
const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const base = process.env.DRAW_UI_BASE || 'http://127.0.0.1:4207';
const out = new URL('../output/playwright/', import.meta.url);
const seed = new ExpeditionProgress({ getItem() { return null; }, setItem() {} }).state;
const checks = [], errors = [], screenshots = [];
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
await mkdir(out, { recursive: true });
async function fixture(width, height, profile = seed) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(({ profile, key }) => {
    if (!sessionStorage.getItem('draw-test-seeded')) { localStorage.setItem(key, JSON.stringify(profile)); sessionStorage.setItem('draw-test-seeded', '1'); }
  }, { profile, key: SAVE_KEYS.expedition });
  await page.addInitScript(async () => {
    const { BoardRenderer } = await import('/js/renderer.js'); const draw = BoardRenderer.prototype.draw;
    BoardRenderer.prototype.draw = function (...args) { window.__renderer = this; return draw.apply(this, args); };
  });
  await page.goto(base); return { context, page };
}
async function state(page) { return page.evaluate(() => structuredClone(window.__renderer.state)); }
async function profile(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEYS.expedition); }
async function shot(page, name) { const file = `draw-ui-${name}.png`; await page.screenshot({ path: new URL(file, out).pathname.replace(/^\/([A-Z]:)/, '$1') }); screenshots.push(file); }
async function start(page) {
  await page.locator('.menu-routes [data-page="expedition"]').tap();
  await page.locator('[data-action="chapter"]').first().tap();
  await page.locator('.mission-intel summary').tap();
  const enemySizes = (await page.locator('.enemy-deck-summary').allInnerTexts()).map(text => [...text.matchAll(/×(\d+)/g)].reduce((sum, match) => sum + Number(match[1]), 0));
  await page.locator('[data-action="start"]').tap();
  await page.locator('#objective-close').tap();
  await page.waitForFunction(() => window.__renderer?.ready && window.__renderer.state.schemaVersion === 6);
  const match = await state(page);
  assert.deepEqual(enemySizes, Object.values(match.enemyPlan.players).map(player => player.deck.length), 'mission preview uses the actual new enemy deck version');
}
async function resume(page) { await page.reload(); await page.locator('.menu-play').tap(); await page.waitForFunction(() => window.__renderer?.ready && !document.querySelector('#match').hidden); if (await page.locator('#objective-close').isVisible()) await page.locator('#objective-close').tap(); }
async function clickHand(page, index) {
  const card = page.locator(`#hand button:nth-child(${index + 1})`);
  const p = await card.evaluate(el => {
    const b = el.getBoundingClientRect();
    for (const ry of [.5, .15, .85, .05]) for (const rx of [.5, .1, .9, .03]) { const x = b.x + b.width * rx, y = b.y + b.height * ry; if (document.elementFromPoint(x, y)?.closest('#hand button') === el) return { x, y }; }
    return null;
  });
  assert.ok(p, `card ${index} has exposed touch region`); await page.touchscreen.tap(p.x, p.y);
}
async function unitPoint(page, id) {
  const p = await page.evaluate(id => {
    const r = window.__renderer, unit = r.state.units.find(u => u.unitId === id), rect = r.canvas.getBoundingClientRect(), metrics = r.boardMetrics(rect.width, rect.height), p = r.cellGeometry(metrics, unit.x, unit.y).center;
    for (const offset of [0, -8, -16, 8]) { const x = rect.x + p.x, y = rect.y + p.y + offset, at = r.positionFromPointer({ clientX: x, clientY: y }); if (at?.x === unit.x && at?.y === unit.y && document.elementFromPoint(x, y) === r.canvas) return { x, y }; }
    return null;
  }, id);
  assert.ok(p, 'unit is visible through real hit testing'); await page.touchscreen.tap(p.x, p.y);
}
try {
  for (const [width, height] of [[844, 390], [568, 320]]) {
    const { context, page } = await fixture(width, height);
    await page.locator('.menu-destinations [data-page="barracks"]').tap();
    assert.equal(await page.locator('.squad-slot').count(), 0);
    assert.equal(await page.locator('.deck-total').innerText(), '30/30');
    const original = (await profile(page)).factionDecks[1];
    await page.locator('.deck-card-row [data-action="deck-remove"]').first().tap();
    assert.equal(await page.locator('.deck-total').innerText(), '29/30');
    assert.deepEqual((await profile(page)).factionDecks[1], original, 'draft edits do not overwrite saved deck');
    assert.equal(await page.locator('[data-action="deck-save"]').isDisabled(), true);
    await page.locator('[data-action="deck-default"]').tap();
    await page.locator('[data-action="deck-save"]').tap();
    assert.match(await page.locator('.deck-status').innerText(), /已保存/);
    await shot(page, `deck-${width}`);
    await page.locator('.expedition-topbar [data-action="nav"][data-page="menu"]').tap();
    await start(page);
    const opening = await state(page);
    assert.equal(opening.phase, 'mulligan'); assert.equal(opening.players[0].hand.length, 5); assert.equal(opening.players[0].deck.length, 25);
    assert.equal(opening.units.filter(u => u.owner === 0).length, 1);
    await clickHand(page, 0); await clickHand(page, 1); await clickHand(page, 2);
    assert.equal((await state(page)).mulligan.length, 2);
    assert.equal(await page.locator('#hand .replacing .mulligan-mark').count(), 2);
    assert.equal(await page.locator('#end-turn').innerText(), '确认起手');
    assert.equal(await page.locator('#bbs-button').isVisible(), false);
    await shot(page, `mulligan-${width}`);
    await resume(page); assert.equal((await state(page)).phase, 'mulligan'); assert.equal((await state(page)).mulligan.length, 2);
    await page.locator('#end-turn').tap();
    assert.equal((await state(page)).phase, 'playing');
    const before = await state(page), originalCard = before.players[0].hand[0];
    await clickHand(page, 0);
    const replace = page.locator('#replace-hand-card');
    assert.ok(await replace.evaluate(el => el.getBoundingClientRect().height >= 44));
    await replace.focus(); await page.keyboard.press('Enter');
    const replaced = await state(page);
    assert.equal(replaced.players[0].replacesUsed, 1);
    assert.equal(replaced.players[0].deck.length, 25); assert.equal(replaced.players[0].hand.length, 5);
    assert.notEqual(replaced.players[0].hand[0], originalCard);
    await page.waitForFunction(() => document.activeElement?.classList.contains('hand-card'));
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.activeElement?.classList.contains('hand-card')), 'Tab continues within visible hand after keyboard replacement');
    await clickHand(page, 1); assert.equal(await replace.isDisabled(), true); assert.match(await page.locator('#draw-hand-status').innerText(), /本回合已换/);
    await page.locator('#inspect-close').tap();
    await shot(page, `replace-${width}`);
    await resume(page); const restored = await state(page);
    assert.deepEqual(restored.players[0].hand, replaced.players[0].hand); assert.deepEqual(restored.players[0].deck, replaced.players[0].deck); assert.equal(restored.players[0].replacesUsed, 1);
    // Synthetic full-hand setup conserves card counts; the end-turn draw uses actual touch.
    await page.evaluate(() => { const p = window.__renderer.state.players[0]; p.hand.push(p.deck.shift()); });
    await clickHand(page, 0); await page.locator('#inspect-close').tap();
    const full = await state(page);
    await page.locator('#end-turn').tap();
    const endTurnDraw = await state(page);
    assert.match(endTurnDraw.log.join('\n'), /手牌已满.*烧毁/);
    await page.waitForFunction(() => window.__renderer.state.phase === 'playing' && window.__renderer.state.currentPlayer === 0 && !document.querySelector('#end-turn').disabled);
    const burned = await state(page);
    assert.equal(burned.players[0].hand.length, 6); assert.equal(burned.players[0].deck.length, full.players[0].deck.length - 1);
    assert.match(await page.locator('#hand-count').innerText(), /满手烧牌/);
    assert.equal(burned.players[0].replacesUsed, 0);
    await shot(page, `burn-${width}`);
    assert.deepEqual(burned.deckRules[1], { openingHandSize: burned.enemyPlan.players[1].openingHandSize, drawPerTurn: burned.enemyPlan.players[1].drawPerTurn, handLimit: burned.enemyPlan.players[1].handLimit, fatigueDamage: burned.enemyPlan.players[1].fatigueDamage, replacePerTurn: burned.enemyPlan.players[1].replacePerTurn, shuffleDeck: burned.enemyPlan.players[1].shuffleDeck });
    // Synthetic depleted-deck/low-health fixture; fatigue and defeat resolve through end turn.
    await page.evaluate(() => { const s = window.__renderer.state; s.players[0].deck = []; s.units.find(u => u.owner === 0 && u.cardId === s.players[0].generalId).health = 2; });
    await clickHand(page, 0); assert.equal(await replace.isDisabled(), true); assert.match(await page.locator('#draw-hand-status').innerText(), /空库/);
    await page.locator('#inspect-close').tap(); await page.locator('#end-turn').tap();
    await page.locator('#play-again').waitFor({ state: 'visible' });
    assert.equal((await state(page)).winner, 1); assert.match((await state(page)).log.join('\n'), /2点疲劳/);
    await shot(page, `fatigue-${width}`);
    checks.push(`${width}x${height}: draft deck save/default, 5-card mulligan cap2+reload, keyboard per-turn replacement, saved hand/deck/used count, full-hand burn, enemy draw configuration, empty-deck disabled replacement and 2-damage fatal fatigue via real end turn`);
    await context.close();
  }
  {
    const unlockSeed = structuredClone(seed); unlockSeed.completed = ['border-01', 'border-02'];
    const { context, page } = await fixture(844, 390, unlockSeed); await start(page); await page.locator('#end-turn').tap(); await page.locator('#focus-general').tap();
    const ids = await page.evaluate(() => { const s = window.__renderer.state, a = s.units.find(u => u.owner === 0), e = s.units.find(u => u.owner === 1 && u.cardId === s.players[1].generalId); s.units = [a, e]; e.x = a.x; e.y = a.y - 1; e.health = 1; return [a.unitId, e.unitId]; });
    await unitPoint(page, ids[0]); await unitPoint(page, ids[1]); await page.locator('#next-level').waitFor({ state: 'visible' });
    assert.match(await page.locator('#result-reward').innerText(), /解锁/);
    await shot(page, 'first-clear'); checks.push('real one-hit victory preserves first settlement unlock/recruitment reward despite duplicate persist'); await context.close();
  }
  assert.deepEqual(errors, []); console.log(JSON.stringify({ checks, errors, screenshots }, null, 2));
} catch (error) {
  errors.push(String(error)); const page = browser.contexts().at(-1)?.pages().at(-1); if (page) await shot(page, 'failure').catch(() => {}); throw error;
} finally {
  await writeFile(new URL('draw-battle-ui.json', out), JSON.stringify({ checks, errors, screenshots, limitation: 'Isolated synthetic contexts and desktop touch emulation; not physical phone/TapTap-host verification.' }, null, 2)); await browser.close();
}
