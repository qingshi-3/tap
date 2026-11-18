import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const out = 'output/ui-refinement/opening-card-details'; await mkdir(out, { recursive: true });
const report = [];
try {
  for (const viewport of [{ width: 568, height: 320 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4227');
    // Disposable browser storage only; never reuse a user's connected browser context.
    await page.evaluate(async () => {
      const { ExpeditionProgress } = await import('/js/expedition-progress.js');
      const { createExpeditionMatch } = await import('/js/engine.js');
      const progress = new ExpeditionProgress(localStorage);
      const state = createExpeditionMatch('border-01', progress.state.training, progress.state.squad, progress.state.selectedHeroId, progress.getBattleLoadout());
      const result = progress.saveBattle(state); if (!result.ok) throw Error(result.error);
    });
    await page.reload(); await page.locator('[data-action=resume]').tap(); await page.locator('#objective-close').tap();
    const cards = page.locator('.opening-cards .hand-card'), toggles = page.locator('.opening-card-toggle');
    assert.equal(await cards.count(), 5);
    await cards.nth(0).tap(); await page.locator('.opening-card-detail').waitFor({ state: 'visible' });
    assert.ok((await page.locator('.opening-detail-rules').innerText()).length > 0);
    assert.equal(await page.locator('.opening-cards .replacing').count(), 0);
    await page.screenshot({ path: `${out}/detail-${viewport.width}.png` });
    const bounds = await page.locator('.opening-card-detail').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height);
    await page.locator('.opening-detail-close').tap(); await cards.nth(0).waitFor({ state: 'visible' });
    assert.equal(await cards.nth(0).evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Enter'); await page.locator('.opening-card-detail').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape'); await page.locator('.opening-card-detail').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.opening-cards .replacing').count(), 0);
    await toggles.nth(0).tap(); await toggles.nth(1).tap();
    assert.equal(await page.locator('.opening-cards .replacing').count(), 2);
    assert.equal(await page.locator('.opening-card-toggle:disabled').count(), 3);
    assert.equal(await page.locator('.opening-cards .hand-card:disabled').count(), 0);
    await cards.nth(2).tap(); await page.locator('.opening-card-detail').waitFor({ state: 'visible' });
    await page.locator('.opening-detail-close').tap();
    await toggles.nth(0).tap(); assert.equal(await page.locator('.opening-card-toggle:disabled').count(), 0);
    await page.screenshot({ path: `${out}/opening-${viewport.width}.png` });
    const controls = await toggles.evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; }));
    assert.ok(controls.every(r => r.height >= 44 && r.width >= 44 && r.y >= 0 && r.y + r.height <= viewport.height));
    await page.locator('.opening-confirm').tap(); await page.locator('.opening-hand').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []); report.push({ viewport, checks: ['tap and keyboard details', 'complete rules', 'close restores card focus', 'two replacements cap', 'inspect unselected card at cap', 'cancel replacement', 'confirm starts battle', '44px targets and viewport bounds'], errors });
    await context.close();
  }
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await browser.close(); }


