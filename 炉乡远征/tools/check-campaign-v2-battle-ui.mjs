import { navigateCamp } from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';
import { EXPEDITION_LEVELS } from '../dist/js/expedition-data.js';
import { unlockedInventory } from '../dist/js/campaign-rules.js';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const base = process.env.CAMPAIGN_UI_BASE || 'http://127.0.0.1:4207';
const out = new URL('../output/playwright/', import.meta.url);
const checks = [], errors = [], screenshots = [];
const initial = new ExpeditionProgress({ getItem() { return null; }, setItem() {} }).state;
const seed = structuredClone(initial);
seed.completed = EXPEDITION_LEVELS.slice(0, 6).map(level => level.id);
seed.inventory = unlockedInventory(seed.completed);
seed.squad = seed.factionSquads[1] = [14, 9, 10021];
seed.factionSpells[1] = [20174, 20066];
seed.spellTraining[20066] = 2; seed.spellModes[20066] = 'tactical';
const historical = JSON.parse(await readFile(new URL('fixtures/save-contract-0.1.9.json', import.meta.url), 'utf8'));
const legacy = historical.profiles.find(profile => profile.schemaVersion === 4);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
await mkdir(out, { recursive: true });
async function fixture(profile, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(({ profile, key }) => {
    if (!sessionStorage.getItem('campaign-v2-test-seeded')) {
      localStorage.setItem(key, JSON.stringify(profile)); sessionStorage.setItem('campaign-v2-test-seeded', '1');
    }
  }, { profile, key: SAVE_KEYS.expedition });
  await page.addInitScript(async () => {
    const { BoardRenderer } = await import('/js/renderer.js');
    const draw = BoardRenderer.prototype.draw;
    BoardRenderer.prototype.draw = function (...args) { window.__renderer = this; return draw.apply(this, args); };
  });
  await page.goto(base);
  return { context, page };
}
async function snapshot(page) { return page.evaluate(() => structuredClone(window.__renderer.state)); }
async function saved(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEYS.expedition); }
async function ready(page) {
  if (await page.locator('#objective-close').isVisible()) await page.locator('#objective-close').tap();
  await page.waitForFunction(() => window.__renderer?.ready && window.__renderer.state?.phase === 'playing');
}
async function start(page) {
  await navigateCamp(page.locator('#expedition-home'), 'expedition');
  await page.locator('[data-action="chapter"]').first().tap();
  await page.locator('[data-action="level"][data-level-id="border-01"]').tap();
  await page.locator('[data-action="start"]').tap(); await ready(page);
}
async function resume(page) { await page.locator('.menu-play').tap(); await ready(page); }
async function shot(page, name) {
  const file = `campaign-v2-battle-${name}.png`;
  await page.screenshot({ path: new URL(file, out).pathname.replace(/^\/([A-Z]:)/, '$1') }); screenshots.push(file);
}
async function clickCard(page, index) {
  const point = await page.locator(`#hand button:nth-child(${index + 1})`).evaluate(el => {
    const b = el.getBoundingClientRect();
    for (const ry of [.5, .2, .8, .05, .95]) for (const rx of [.5, .2, .8, .05, .95]) {
      const x = b.x + b.width * rx, y = b.y + b.height * ry;
      if (document.elementFromPoint(x, y)?.closest('#hand button') === el) return { x, y };
    }
    return null;
  });
  assert.ok(point, `supply slot ${index}: exposed part accepts touch`);
  await page.touchscreen.tap(point.x, point.y);
  await page.locator('#unit-inspect').waitFor({ state: 'visible' });
}
async function target(page, mode, cardId, unitId = null) {
  const point = await page.evaluate(async ({ mode, cardId, unitId }) => {
    const r = window.__renderer, state = r.state;
    const { summonPositions, spellTargets, getBattleCard } = await import('/js/engine.js');
    const cells = mode === 'unit' ? state.units.filter(unit => unit.unitId === unitId) : mode === 'summon' ? summonPositions(state, 0, cardId) : spellTargets(state, getBattleCard(state, cardId), 0).filter(unit => !unitId || unit.unitId === unitId);
    const rect = r.canvas.getBoundingClientRect(), metrics = r.boardMetrics(rect.width, rect.height);
    for (const cell of cells) {
      const p = r.cellGeometry(metrics, cell.x, cell.y).center;
      for (const delta of [0, -8, -16, 8]) {
        const x = rect.left + p.x, y = rect.top + p.y + delta;
        if (document.elementFromPoint(x, y) !== r.canvas) continue;
        const at = r.positionFromPointer({ clientX: x, clientY: y });
        if (at?.x === cell.x && at?.y === cell.y) return { x, y };
      }
    }
    return null;
  }, { mode, cardId, unitId });
  assert.ok(point, `${mode} ${cardId}: a legal target is visibly reachable`);
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForFunction(() => window.__renderer.state.phase === 'over' || !document.querySelector('#end-turn').disabled);
}
async function reloadContinue(page, before) {
  await page.reload(); await resume(page);
  const after = await snapshot(page);
  assert.equal(after.schemaVersion, before.schemaVersion);
  assert.deepEqual(after.campaignSupply, before.campaignSupply);
  assert.deepEqual(after.players[0].hand, before.players[0].hand);
  assert.deepEqual(after.players[0].deck, before.players[0].deck);
  assert.equal(after.players[0].mana, before.players[0].mana);
  assert.deepEqual(after.units, before.units);
  return after;
}
try {
  for (const [width, height] of [[844, 390], [568, 320]]) {
    const { context, page } = await fixture(seed, width, height);
    await start(page);
    assert.equal((await snapshot(page)).schemaVersion, 5);
    assert.equal(await page.locator('#hand button').count(), 5);
    assert.equal(await page.locator('#hand').getAttribute('data-supply-mode'), 'true');
    // Explicit synthetic battle setup; subsequent deployment and casts are real input.
    const targetId = await page.evaluate(() => {
      const state = window.__renderer.state; state.players[0].mana = state.players[0].maxMana = 9;
      const ally = state.units.find(unit => unit.owner === 0 && unit.cardId === 14);
      ally.health = ally.maxHealth = 20;
      const general = state.units.find(unit => unit.owner === 0 && unit.cardId === 1); general.health = 10;
      return ally.unitId;
    });
    await page.locator('#focus-general').tap();
    for (let n = 0; n < 3; n++) {
      await clickCard(page, 2); await target(page, 'summon', 10021);
      const state = await snapshot(page);
      assert.equal(state.campaignSupply.remaining[2], 2 - n);
      assert.equal(state.units.filter(unit => unit.owner === 0 && unit.cardId === 10021).length, n + 1);
      assert.equal(await page.locator('#hand button').count(), 5);
    }
    assert.equal((await snapshot(page)).players[0].mana, 3);
    await clickCard(page, 2);
    assert.match(await page.locator('#board-hint').innerText(), /用尽/);
    assert.equal(await page.locator('#hand button:nth-child(3) .supply-count').innerText(), '用尽');
    assert.equal((await snapshot(page)).campaignSupply.remaining[2], 0);
    await page.locator('#inspect-close').tap();
    // Refill fixture mana to independently exercise all three upgraded casts in this turn.
    await page.evaluate(() => { window.__renderer.state.players[0].mana = 9; });
    for (let n = 0; n < 3; n++) {
      await clickCard(page, 4);
      assert.equal(await page.locator('#unit-inspect-cost').innerText(), '2');
      assert.match(await page.locator('#unit-inspect-description').innerText(), /战术式/);
      await target(page, 'spell', 20066, targetId);
      const state = await snapshot(page);
      assert.equal(state.players[0].mana, 7 - n * 2);
      assert.equal(state.units.find(unit => unit.unitId === targetId).health, 18 - n * 2);
      assert.equal(state.units.find(unit => unit.cardId === 1 && unit.owner === 0).health, 12 + n * 2);
      assert.equal(state.campaignSupply.remaining[4], 2 - n);
      assert.equal(await page.locator('#hand button').count(), 5);
    }
    await shot(page, `supply-${width}`);
    const before = await snapshot(page);
    assert.deepEqual((await saved(page)).activeBattle.campaignSupply, before.campaignSupply);
    await reloadContinue(page, before);
    await clickCard(page, 4);
    assert.equal(await page.locator('#hand button:nth-child(5) .supply-count').innerText(), '用尽');
    await shot(page, `resume-${width}`);
    checks.push(`${width}x${height}: real schema5 start, neutral 3 deployments, tactical spell 3 casts at 2 mana/2 damage/+2 heal, fixed 5 slots/exhaustion, saved/reloaded same units/supply/mana`);
    await context.close();
  }
  {
    const refill = structuredClone(seed);
    refill.selectedHeroId = 418; refill.squad = [...refill.factionSquads[5]];
    const { context, page } = await fixture(refill, 844, 390);
    await start(page);
    await page.evaluate(() => { const s = window.__renderer.state; s.players[0].mana = s.players[0].maxMana = 9; });
    await clickCard(page, 0); await target(page, 'summon', 406);
    assert.equal((await snapshot(page)).campaignSupply.remaining[0], 0);
    await page.locator('#bbs-button').tap(); await page.locator('.command-preview-confirm').tap();
    await page.waitForFunction(() => window.__renderer.state.players[0].bbsUsed && !document.querySelector('#end-turn').disabled);
    const after = await snapshot(page);
    assert.equal(after.campaignSupply.remaining[0], 1);
    assert.equal(after.campaignSupply.resupply, 2);
    assert.equal(await page.locator('#hand button:nth-child(1) .supply-count').innerText(), '余1');
    await reloadContinue(page, after);
    await clickCard(page, 0); await target(page, 'summon', 406);
    assert.equal((await snapshot(page)).campaignSupply.remaining[0], 0);
    await shot(page, 'resupply');
    checks.push('schema5 星角 real BBS: exhausted first unit refilled once, resupply 3→2, preserved across reload, redeployed with real touch');
    await context.close();
  }
  {
    const { context, page } = await fixture(legacy, 844, 390);
    await resume(page);
    const before = await snapshot(page);
    assert.equal(before.schemaVersion, 4); assert.equal(before.campaignSupply, undefined);
    assert.equal(await page.locator('#hand').getAttribute('data-supply-mode'), 'false');
    await page.locator('#focus-general').tap();
    await clickCard(page, 1);
    const targetId = before.units.find(unit => unit.owner === 0 && unit.cardId !== 1).unitId;
    await target(page, 'spell', 20174, targetId);
    const after = await snapshot(page);
    assert.equal(after.players[0].hand.length, before.players[0].hand.length - 1);
    assert.equal(after.players[0].mana, before.players[0].mana - 1);
    assert.equal((await saved(page)).schemaVersion, 6);
    assert.equal((await saved(page)).activeBattle.schemaVersion, 4);
    await reloadContinue(page, after);
    // A second normal action after restoring proves the migrated profile keeps saving legacy battles.
    await page.locator('#bbs-button').tap(); await page.locator('.command-preview-confirm').tap();
    const bbsPoint = await page.evaluate(() => {
      const r = window.__renderer, rect = r.canvas.getBoundingClientRect(), metrics = r.boardMetrics(rect.width, rect.height);
      const unit = r.state.units.find(u => u.owner === 0 && u.cardId !== 1), p = r.cellGeometry(metrics, unit.x, unit.y).center;
      return { x: rect.left + p.x, y: rect.top + p.y };
    });
    await page.touchscreen.tap(bbsPoint.x, bbsPoint.y);
    await page.waitForFunction(() => window.__renderer.state.players[0].bbsUsed && !document.querySelector('#end-turn').disabled);
    const continued = await snapshot(page); await reloadContinue(page, continued);
    await shot(page, 'legacy-schema4');
    checks.push('frozen synthetic 0.1.9 schema4 profile/battle: migrated profile remains schema5, original hand/deck battle remains schema4, real roar consumes hand/mana, reload/BBS/save/reload succeeds');
    await context.close();
  }
  {
    const lossSeed = structuredClone(seed); lossSeed.factionSpells[1] = [20174, 20044];
    const { context, page } = await fixture(lossSeed, 568, 320);
    await start(page);
    const firstRunId = (await snapshot(page)).runId;
    await page.evaluate(() => {
      const state = window.__renderer.state; state.players[0].mana = state.players[0].maxMana = 9;
      state.units.find(unit => unit.owner === 0 && unit.cardId === 1).health = 1;
      state.campaignSupply.remaining[2] = 0;
    });
    await clickCard(page, 4); await page.locator('#inspect-cast').tap();
    await page.locator('#play-again').waitFor({ state: 'visible' });
    assert.equal((await snapshot(page)).winner, 1);
    await shot(page, 'loss-568');
    await page.locator('#play-again').tap(); await ready(page);
    const retry = await snapshot(page);
    assert.equal(retry.schemaVersion, 5); assert.notEqual(retry.runId, firstRunId);
    assert.deepEqual(retry.campaignSupply.remaining, [1, 1, 3, 3, 3]);
    assert.equal(retry.campaignSupply.resupply, 3);
    assert.equal(retry.units.find(unit => unit.cardId === 1 && unit.owner === 0).health, 25);
    await shot(page, 'retry-568');
    checks.push('568x320: real self-damaging tempest defeat; retry starts a new schema5 run, full health and supply reset');
    await context.close();
  }
  {
    const { context, page } = await fixture(initial, 844, 390);
    await start(page); await page.locator('#focus-general').tap();
    const ids = await page.evaluate(() => {
      const s = window.__renderer.state, general = s.units.find(u => u.owner === 0 && u.cardId === 1);
      const enemy = s.units.find(u => u.owner === 1 && u.cardId === s.players[1].generalId);
      s.units = s.units.filter(u => u.owner !== 1 || u === enemy);
      // Synthetic one-hit victory setup; resolve the kill through real unit taps.
      enemy.x = general.x; enemy.y = general.y - 1; enemy.health = 1;
      return { player: general.unitId, enemy: enemy.unitId };
    });
    await target(page, 'unit', 1, ids.player);
    await target(page, 'unit', null, ids.enemy);
    await page.locator('#next-level').waitFor({ state: 'visible' });
    assert.equal((await snapshot(page)).winner, 0);
    assert.match(await page.locator('#result-reward').innerText(), /解锁.*山谷猎手/);
    const profile = await saved(page);
    assert.ok(profile.inventory.units.includes(10021)); assert.ok(profile.completed.includes('border-01'));
    assert.equal(profile.coins, 180);
    await shot(page, 'first-clear-unlocks');
    checks.push('844x390: real general one-hit victory shows first-clear recruit; inventory/coins/completion persist exactly once');
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, errors, screenshots }, null, 2));
} catch (error) {
  const page = browser.contexts().at(-1)?.pages().at(-1);
  if (page) await shot(page, 'failure').catch(() => {});
  errors.push(String(error));
  throw error;
} finally {
  await writeFile(new URL('campaign-v2-battle-ui.json', out), JSON.stringify({ checks, errors, screenshots, provenance: historical.provenance, limitation: 'Synthetic isolated contexts and desktop touch emulation; physical phone and TapTap host are not covered.' }, null, 2));
  await browser.close();
}
