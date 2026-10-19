import { navigateCamp } from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';
import { EXPEDITION_LEVELS } from '../dist/js/expedition-data.js';
import { unlockedInventory, getUnitSpecializations } from '../dist/js/campaign-rules.js';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';

// Every case uses a fresh browser context and explicit fixture storage.
const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const base = process.env.CAMPAIGN_UI_BASE || 'http://127.0.0.1:4197';
const out = new URL('../output/playwright/', import.meta.url);
const checks = [], errors = [];
const initial = new ExpeditionProgress({ getItem() { return null; }, setItem() {} }).state;
const advanced = structuredClone(initial);
advanced.completed = EXPEDITION_LEVELS.slice(0, 6).map(level => level.id);
advanced.inventory = unlockedInventory(advanced.completed);
advanced.coins = 1000;
advanced.training[14] = 2;
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
await mkdir(out, { recursive: true });
async function fixture(seed, width, height, reducedMotion = 'reduce') {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(({ seed, key }) => localStorage.setItem(key, JSON.stringify(seed)), { seed, key: SAVE_KEYS.expedition });
  await page.addInitScript(async () => {
    const { ExpeditionUI } = await import('/js/expedition-ui.js');
    const tick = ExpeditionUI.prototype.tickIdle;
    ExpeditionUI.prototype.tickIdle = function (...args) { window.__campaignIdleTicks = (window.__campaignIdleTicks || 0) + 1; return tick.apply(this, args); };
  });
  await page.goto(base);
  await page.locator('.expedition-ui').waitFor({ state: 'visible' });
  return { context, page, root: page.locator('.expedition-ui') };
}
async function state(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEYS.expedition); }
async function nav(root, name) { await navigateCamp(root, name); }
async function open(root, id) { await root.locator(`[data-action="card-detail"][data-card-id="${id}"]`).first().tap(); }
async function screenshot(page, name) { await page.screenshot({ path: new URL(name, out).pathname.replace(/^\/([A-Z]:)/, '$1') }); }
try {
  {
    const { context, page, root } = await fixture(initial, 844, 390);
    await nav(root, 'barracks');
    await open(root, 10021);
    const dialog = root.locator('dialog[open]');
    assert.match(await dialog.innerText(), /通关.*解锁/);
    assert.equal(await dialog.locator('[data-action="train"]').isDisabled(), true);
    assert.equal(await dialog.locator('[data-action="choose-unit"]').first().isDisabled(), true);
    await dialog.locator('[data-action="close-card"]').tap();
    // Locked inventory cannot be lifted through the existing keyboard drag path.
    await root.locator('.training-card-open[data-card-id="10021"]').focus();
    await page.keyboard.press('Space');
    assert.equal(await root.locator('.is-keyboard-dragging').count(), 0);
    assert.deepEqual((await state(page)).squad, initial.squad);
    assert.equal(await page.evaluate(() => window.__campaignIdleTicks || 0), 0, 'reduced motion suspends idle scheduling');
    checks.push('new profile: visible locked neutral, no training/deployment/keyboard drag');
    await context.close();
  }
  for (const [width, height] of [[844, 390], [568, 320]]) {
    const { context, page, root } = await fixture(advanced, width, height);
    await nav(root, 'barracks');
    await root.locator('.squad-slot[data-slot="2"]').tap();
    await root.locator('dialog[open] .unit-replacements summary').tap();
    await root.locator('dialog[open] .unit-replacements [data-card-id="10021"]').tap();
    assert.equal((await state(page)).squad[2], 10021);
    await root.locator('dialog[open] [data-action="close-card"]').tap();
    // Open and confirm through the normal keyboard path, including rebuilt focus.
    const unit = root.locator('.training-card-open[data-card-id="14"]');
    await unit.focus(); await page.keyboard.press('Enter');
    const spec = getUnitSpecializations(14)[0];
    const coins = (await state(page)).coins;
    await root.locator(`dialog[open] [data-spec="${spec.id}"]`).focus();
    await page.keyboard.press('Enter');
    assert.equal((await state(page)).specializations[14], spec.id);
    assert.equal((await state(page)).coins, coins);
    await page.waitForFunction(specId => document.activeElement?.dataset.spec === specId, spec.id);
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(specId => document.querySelector('dialog[open]')?.contains(document.activeElement) && document.activeElement?.dataset.spec !== specId && !document.activeElement?.disabled, spec.id), 'Tab remains in dialog and skips locked specialty');
    await screenshot(page, `campaign-v2-unit-${width}.png`);
    await root.locator('dialog[open] [data-spec="none"]').tap();
    assert.equal((await state(page)).specializations[14], 'none');
    await root.locator('dialog[open] [data-action="close-card"]').tap();
    await root.locator('[data-action="inventory-tab"][data-tab="spells"]').tap();
    await open(root, 20066);
    await root.locator('dialog[open] [data-action="choose-spell"][data-slot="1"]').tap();
    assert.equal((await state(page)).factionSpells[1][1], 20066);
    await root.locator('dialog[open] [data-action="train-spell"]').tap();
    assert.equal((await state(page)).spellTraining[20066], 1);
    await root.locator('dialog[open] [data-action="train-spell"]').tap();
    assert.equal((await state(page)).spellTraining[20066], 2);
    assert.equal((await state(page)).coins, coins - 160);
    await root.locator('dialog[open] [data-mode="tactical"]').tap();
    assert.equal((await state(page)).spellModes[20066], 'tactical');
    assert.match(await root.locator('dialog[open] .spell-current-rule').innerText(), /额外消耗1法力/);
    await screenshot(page, `campaign-v2-spell-${width}.png`);
    assert.ok(await root.locator('dialog[open] [data-action="close-card"]').evaluate(el => {
      const b = el.getBoundingClientRect(); return b.top >= 0 && b.right <= innerWidth && b.height >= 44 && document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('[data-action="close-card"]') === el;
    }), 'close button remains reachable while growth details scroll');
    await root.locator('dialog[open] [data-action="close-card"]').tap();
    await screenshot(page, `campaign-v2-barracks-${width}.png`);
    await nav(root, 'expedition');
    await root.locator('[data-action="chapter"]').first().tap();
    await root.locator('[data-action="level"][data-level-id="border-01"]').tap();
    assert.match(await root.locator('.mission-loadout').innerText(), /谷地猎手|援军/);
    await root.locator('.mission-intel summary').tap();
    assert.match(await root.locator('.mission-intel').innerText(), /主将.*生命/);
    await screenshot(page, `campaign-v2-mission-${width}.png`);
    await root.locator('[data-action="adjust-loadout"]').tap();
    await root.locator('[data-action="return-mission"]').tap();
    assert.equal(await root.locator('[data-action="start"]').getAttribute('data-level-id'), 'border-01');
    await nav(root, 'codex');
    await root.locator('[data-action="codex-faction"][data-faction-id="0"]').tap();
    assert.equal(await root.locator('.expedition-codex-card').count(), 7);
    checks.push(`${width}x${height}: real touch unit replacement, free specialty reset, spell selection/upgrades/mode, mission intelligence and return, neutral codex`);
    await context.close();
  }
  {
    const { context, page, root } = await fixture(advanced, 844, 390, 'no-preference');
    await nav(root, 'barracks');
    await page.waitForFunction(() => window.__campaignIdleTicks > 2);
    const before = await page.evaluate(() => window.__campaignIdleTicks);
    await page.waitForTimeout(350);
    assert.ok(await page.evaluate(before => window.__campaignIdleTicks > before, before), 'normal motion keeps idle ticking');
    const source = root.locator('.training-card-open[data-card-id="10981"]');
    await source.scrollIntoViewIfNeeded();
    const from = await source.boundingBox(), to = await root.locator('.squad-slot[data-slot="2"]').boundingBox();
    const cdp = await context.newCDPSession(page);
    const a = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const b = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 12, y: a.y + (b.y - a.y) * i / 12 }] });
      await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal((await state(page)).squad[2], 10981, 'real touch drag deploys unlocked neutral');
    checks.push('keyboard Enter/Tab preserves specialization focus; reduced motion pauses idle; normal motion keeps idle; real CDP touch drag deploys neutral');
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, errors, limitation: 'Isolated desktop touch emulation; physical phone and TapTap host are not covered.' }, null, 2));
} finally {
  await writeFile(new URL('campaign-v2-ui.json', out), JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
