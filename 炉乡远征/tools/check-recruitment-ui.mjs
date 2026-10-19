import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';
import { createExpeditionMatch } from '../dist/js/engine.js';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const base = process.env.RECRUITMENT_UI_BASE || 'http://127.0.0.1:4213';
const output = new URL('../output/recruitment/', import.meta.url);
const config = { schemaVersion: 1, victoryTickets: 1, adTickets: 2, adEnabled: true,
  pools: [
    { id: 'test-unit', name: '验收随从池', ticketCost: 1, entries: [{ cardId: 17, weight: 1, fragments: 2 }] },
    { id: 'test-spell', name: '验收法术池', ticketCost: 1, entries: [{ cardId: 20044, weight: 1, fragments: 2 }] }
  ], recipes: [{ cardId: 17, fragmentsRequired: 4 }, { cardId: 20044, fragmentsRequired: 2 }] };
const fresh = new ExpeditionProgress({ getItem() { return null; }, setItem() {} }).state;
const profile = structuredClone(fresh);
profile.recruitment.tickets = 4;
profile.settlements['ui-victory'] = { levelId: 'border-01', amount: 100, firstClear: true };
profile.recruitment.victoryClaims['ui-victory'] = 1;
// Isolated synthetic entitlement; only the UI's SDK adapter callbacks may claim it.
const checks = [], errors = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
async function fixture(width, height, seed = profile, override = config, reducedMotion = 'reduce') {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion });
  if (override) await context.route('**/js/recruitment-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const RECRUITMENT_CONFIG = ${JSON.stringify(override)};` }));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(({ seed, key }) => {
    if (!sessionStorage.getItem('recruitment-seeded')) {
      localStorage.setItem(key, JSON.stringify(seed)); sessionStorage.setItem('recruitment-seeded', '1');
    }
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key && window.__failRecruitmentSave) { window.__failRecruitmentSave = false; throw new Error('isolated disk failure'); }
      return original.call(this, name, value);
    };
    window.__adEnded = false; window.__adShows = 0;
    window.tap = { createRewardedVideoAd() {
      let onClose;
      return { load: () => Promise.resolve(), show: () => { window.__adShows++; setTimeout(() => {
        if (window.__failRecruitmentReward) { window.__failRecruitmentSave = true; window.__failRecruitmentReward = false; }
        onClose?.({ isEnded: window.__adEnded });
      }, 30); return Promise.resolve(); },
        onClose(fn) { onClose = fn; }, offClose() { onClose = null; }, onError() {}, offError() {}, destroy() {} };
    } };
  }, { seed, key: SAVE_KEYS.expedition });
  await page.addInitScript(async () => {
    const { BoardRenderer } = await import('/js/renderer.js');
    const draw = BoardRenderer.prototype.draw;
    BoardRenderer.prototype.draw = function (...args) { window.__recruitmentRenderer = this; return draw.apply(this, args); };
  });
  await page.goto(base);
  await page.locator('[data-action="recruitment"]').waitFor({ state: 'visible' });
  return { context, page, dialog: page.locator('.recruitment-dialog') };
}
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEYS.expedition);
const open = page => page.locator('[data-action="recruitment"]').tap();
const draw = dialog => dialog.locator('[data-recruitment-action="draw"]').tap();
async function shot(page, name) { await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) }); }
async function within(page, selector) {
  assert.ok(await page.locator(selector).evaluate(el => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }), `${selector} touch target visible`);
}
async function fullCard(locator) {
  const visible = await locator.evaluate(card => {
    const r = card.getBoundingClientRect();
    let top = 0, left = 0, right = innerWidth, bottom = innerHeight;
    for (let parent = card.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
    }
    const description = card.querySelector('.game-card-description');
    return { fits: r.top >= top - 1 && r.bottom <= bottom + 1 && r.left >= left - 1 && r.right <= right + 1,
      descriptionShown: getComputedStyle(description).display !== 'none', width: r.width, height: r.height };
  });
  assert.ok(visible.fits && visible.descriptionShown && visible.width >= 110, `entire readable card and description remain visible: ${JSON.stringify(visible)}`);
}
try {
  {
    const { context, page, dialog } = await fixture(844, 390, fresh, null);
    await shot(page, 'menu');
    await open(page);
    assert.match(await dialog.innerText(), /招募即将开放/);
    assert.equal(await dialog.locator('[data-recruitment-action="draw"]').count(), 0);
    await shot(page, 'production-empty');
    await dialog.getByRole('button', { name: '碎片合成', exact: true }).tap();
    assert.match(await dialog.innerText(), /合成目标即将开放/);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.dataset.action === 'recruitment');
    checks.push('production empty pool: no spend action, empty goals, Escape returns menu focus');
    await context.close();
  }
  {
    // A synthetic one-hit board, won only through real select-and-attack taps.
    const seed = structuredClone(fresh);
    seed.activeBattle = createExpeditionMatch('border-01', seed.training, seed.squad, seed.selectedHeroId, new ExpeditionProgress({ getItem() { return null; }, setItem() {} }).getLoadout());
    const battle = seed.activeBattle, player = battle.units.find(u => u.owner === 0 && u.cardId === 1);
    const enemy = battle.units.find(u => u.owner === 1 && u.cardId === battle.players[1].generalId);
    battle.units = battle.units.filter(u => u.owner !== 1 || u === enemy);
    player.x = 4; player.y = 2;
    enemy.x = 5; enemy.y = 2; enemy.health = 1;
    // Simulate a supported schema5 profile before this feature was installed.
    seed.schemaVersion = 5; delete seed.dailyAds; delete seed.recruitment; delete seed.factionDecks;
    const { context, page, dialog } = await fixture(844, 390, seed, null);
    await page.locator('.menu-play').tap();
    await page.locator('#objective-close').tap();
    await page.waitForFunction(() => window.__recruitmentRenderer?.ready);
    await page.locator('#focus-general').tap();
    for (const id of [player.unitId, enemy.unitId]) {
      const p = await page.evaluate(id => {
        const r = window.__recruitmentRenderer, box = r.canvas.getBoundingClientRect(), metrics = r.boardMetrics(box.width, box.height);
        const u = r.state.units.find(unit => unit.unitId === id), c = r.cellGeometry(metrics, u.x, u.y).center;
        for (const delta of [0, -8, -16, 8]) {
          const x = box.left + c.x, y = box.top + c.y + delta;
          const at = r.positionFromPointer({ clientX: x, clientY: y });
          if (document.elementFromPoint(x, y) === r.canvas && at?.x === u.x && at?.y === u.y) return { x, y };
        }
        return null;
      }, id);
      assert.ok(p, 'victory tap reaches the intended board cell');
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForFunction(() => window.__recruitmentRenderer.state.phase === 'over' || !document.querySelector('#end-turn').disabled);
    }
    await page.locator('#back-to-lobby').waitFor({ state: 'visible' });
    assert.match(await page.locator('#result-reward').innerText(), /灵魂宝珠 \+1/);
    assert.equal((await saved(page)).recruitment.tickets, 1);
    await shot(page, 'victory-ticket');
    await page.locator('#back-to-lobby').tap();
    assert.equal(await page.locator('.menu-resource[data-resource="orb"] strong').innerText(), '1');
    await open(page);
    assert.match(await dialog.locator('.recruitment-balance').innerText(), /1/);
    await page.reload(); assert.equal((await saved(page)).recruitment.tickets, 1);
    assert.ok(await page.evaluate(key => localStorage.getItem(`${key}.legacy-v5-backup`), SAVE_KEYS.expedition));
    checks.push('schema5 migrates with original backup; real victory taps show ticket reward; returning/reloading keeps exactly one ticket');
    await context.close();
  }
  for (const [width, height] of [[844, 390], [568, 320]]) {
    const { context, page, dialog } = await fixture(width, height);
    await open(page);
    assert.match(await dialog.locator('.recruitment-balance').innerText(), /灵魂宝珠 4 枚/);
    assert.equal(await dialog.locator('.recruitment-balance').getAttribute('aria-label'), '拥有 4 枚灵魂宝珠');
    assert.equal(await dialog.locator('[data-recruitment-action="draw"]').getAttribute('aria-label'), '招募一次，消耗 1 枚灵魂宝珠');
    await within(page, '[data-recruitment-action="close"]');
    await within(page, '[data-recruitment-action="draw"]');
    await dialog.locator('summary').tap();
    assert.match(await dialog.locator('.recruitment-odds').innerText(), /100%/);
    await shot(page, `odds-${width}`);
    await draw(dialog); await draw(dialog);
    let state = await saved(page);
    assert.equal(state.recruitment.tickets, 2); assert.equal(state.recruitment.fragments[17], 4);
    assert.match(await dialog.locator('.recruitment-balance').innerText(), /灵魂宝珠 2 枚/);
    assert.match(await dialog.innerText(), /碎片 \+2/);
    await fullCard(dialog.locator('.recruitment-goal .game-card'));
    await shot(page, `draw-${width}`);
    if (width === 568) assert.equal(await dialog.locator('.game-card').evaluate(el => getComputedStyle(el).animationName), 'none');
    await dialog.getByRole('button', { name: '碎片合成', exact: true }).tap();
    await dialog.locator('[data-recruitment-action="synthesize"][data-card-id="17"]').tap();
    state = await saved(page); assert.ok(state.inventory.units.includes(17)); assert.equal(state.recruitment.fragments[17], 0);
    await fullCard(dialog.locator('.recruitment-recipe').first().locator('.game-card'));
    assert.equal(await dialog.locator('[data-card-id="17"]').isDisabled(), true);
    await shot(page, `crafted-${width}`);
    await dialog.getByRole('button', { name: '抽取碎片', exact: true }).tap();
    await dialog.locator('select').selectOption('test-spell'); await draw(dialog);
    await dialog.getByRole('button', { name: '碎片合成', exact: true }).tap();
    await dialog.locator('[data-card-id="20044"]').focus(); await page.keyboard.press('Enter');
    state = await saved(page); assert.ok(state.inventory.spells.includes(20044)); assert.equal(state.recruitment.tickets, 1);
    assert.equal(await dialog.locator('[data-card-id="20044"]').isDisabled(), true);
    await page.keyboard.press('Tab'); assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)), 'keyboard stays within modal');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.menu-resource[data-resource="orb"] strong')?.textContent === '1');
    await page.reload();
    assert.equal(await page.locator('.menu-resource[data-resource="orb"] strong').innerText(), '1');
    await open(page);
    await dialog.getByRole('button', { name: '碎片合成', exact: true }).tap();
    assert.equal(await dialog.locator('[data-card-id="17"]').isDisabled(), true);
    assert.equal(await dialog.locator('[data-card-id="20044"]').isDisabled(), true);
    await dialog.getByRole('button', { name: '抽取碎片', exact: true }).tap();
    await draw(dialog); state = await saved(page); assert.equal(state.recruitment.tickets, 0);
    assert.equal(await dialog.locator('[data-recruitment-action="draw"]').isDisabled(), true);
    assert.match(await dialog.innerText(), /还差 1 枚灵魂宝珠/);
    await page.reload(); assert.equal((await saved(page)).recruitment.fragments[17], 2);
    checks.push(`${width}x${height}: touch draws, probabilities, unit/spell synthesis, keyboard, repeated save/reload, owned and insufficient-ticket protection`);
    await context.close();
  }
  {
    const { context, page, dialog } = await fixture(844, 390);
    await open(page); await page.evaluate(() => { window.__failRecruitmentSave = true; });
    await draw(dialog);
    assert.equal((await saved(page)).recruitment.tickets, 4); assert.match(await dialog.innerText(), /未保存/);
    await draw(dialog); assert.equal((await saved(page)).recruitment.tickets, 3);
    await dialog.locator('[data-recruitment-action="ad"]').tap();
    await page.waitForFunction(() => document.querySelector('.recruitment-notice')?.textContent.includes('未完整'));
    assert.equal((await saved(page)).recruitment.tickets, 3);
    await page.evaluate(() => { window.__adEnded = true; window.__failRecruitmentReward = true; });
    await dialog.locator('[data-recruitment-action="ad"]').tap();
    await page.waitForFunction(() => document.querySelector('[data-recruitment-action="ad"]')?.textContent === '重试保存奖励');
    assert.equal((await saved(page)).recruitment.tickets, 3);
    const shows = await page.evaluate(() => window.__adShows);
    await dialog.locator('[data-recruitment-action="ad"]').tap();
    await page.waitForFunction(() => document.querySelector('.recruitment-notice')?.textContent.includes('灵魂宝珠 +2 枚'));
    assert.equal((await saved(page)).recruitment.tickets, 5);
    assert.equal(await page.evaluate(() => window.__adShows), shows, 'earned receipt retries saving without another ad');
    assert.equal(await dialog.locator('[data-recruitment-action="ad"]').isDisabled(), true);
    await page.reload(); await open(page);
    assert.equal(await dialog.locator('[data-recruitment-action="ad"]').isDisabled(), true);
    checks.push('transient save failure spends nothing and retries; SDK mock early close grants nothing, earned save failure retries without rewatch, completed grants once and survives reload');
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('browser-report.json', output), JSON.stringify({ passed: true, checks, errors, note: 'Isolated browser pools and SDK mocks; no production card/probability data or real TapTap ad verification.' }, null, 2));
  console.log(JSON.stringify({ passed: true, checks }));
} finally { await browser.close(); }
