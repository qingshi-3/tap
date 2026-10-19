import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const base = process.env.HERO_UI_BASE || 'http://127.0.0.1:4197';
const results = [], errors = [];
async function makePage() {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(async () => {
    const { BoardRenderer } = await import('/js/renderer.js');
    const draw = BoardRenderer.prototype.draw;
    BoardRenderer.prototype.draw = function (...args) { window.__renderer = this; return draw.apply(this, args); };
  });
  await page.goto(base);
  return { context, page };
}
async function fixture(page, heroId, spellId = null) {
  await page.evaluate(async ({ heroId, spellId }) => {
    const { ExpeditionProgress } = await import('/js/expedition-progress.js');
    const { createExpeditionMatch } = await import('/js/engine.js');
    const progress = new ExpeditionProgress(localStorage);
    if (!progress.selectHero(heroId).ok) throw Error('Hero selection failed');
    const profile = progress.state;
    const match = createExpeditionMatch('border-01', profile.training, profile.squad, heroId);
    if (heroId === 23) match.units.find(u => u.owner === 0 && u.cardId !== 23).health -= 1;
    if (spellId) { match.players[0].hand = [spellId]; match.players[0].mana = 9; match.units[0].health = 17; }
    const saved = progress.saveBattle(match);
    if (!saved.ok) throw Error(saved.error);
  }, { heroId, spellId });
  await page.reload();
  await page.locator('[data-action=resume]').click();
  await page.locator('#objective-close').click();
  await page.waitForFunction(() => window.__renderer?.ready);
}
async function targetPoint(page, spellId = null) {
  return page.evaluate(async spellId => {
    const r = window.__renderer, { battleCommandTargets, spellTargets, spellPositions } = await import('/js/engine.js');
    const { getCard } = await import('/js/cards.js');
    const spell = spellId && getCard(spellId), command = !spell && battleCommandTargets(r.state, 0);
    const cells = spell ? spell.target === 'cell' ? spellPositions(r.state, spell, 0) : spellTargets(r.state, spell, 0)
      : command.type === 'cell' ? command.cells : r.state.units.filter(u => command.unitIds.includes(u.unitId));
    const bounds = r.canvas.getBoundingClientRect(), metrics = r.boardMetrics(bounds.width, bounds.height);
    const points = cells.map(c => { const p = r.cellGeometry(metrics, c.x, c.y).center; return { x: bounds.left + p.x, y: bounds.top + p.y }; });
    return points.find(p => document.elementFromPoint(p.x, p.y) === r.canvas) ?? null;
  }, spellId);
}
try {
  for (const heroId of (process.env.HERO_UI_PREVIEW_ONLY ? [201,527] : [1, 23, 101, 123, 201, 223, 301, 323, 401, 418, 501, 527])) {
    const { context, page } = await makePage();
    await fixture(page, heroId);
    const type = await page.evaluate(async () => (await import('/js/engine.js')).battleCommandTargets(window.__renderer.state).type);
    await page.locator('#bbs-button').tap();
    await page.locator('#command-preview').waitFor({state:'visible'});
    assert.equal(await page.evaluate(() => window.__renderer.state.players[0].mana), 3, 'reading never spends mana');
    assert.ok((await page.locator('.command-preview-rule').innerText()).length > 12);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#command-preview').isVisible(), false);
    assert.equal(await page.locator('#bbs-button').evaluate(el=>el===document.activeElement), true);
    await page.locator('#bbs-button').tap();
    if ([201,527].includes(heroId)) {
      await page.screenshot({path:`output/playwright/skill-preview-${heroId}-844.png`});
      await page.setViewportSize({width:568,height:320});
      await page.screenshot({path:`output/playwright/skill-preview-${heroId}-568.png`});
      assert(await page.locator('.command-preview-confirm').evaluate(el=>{const b=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return b.bottom<=p.bottom && b.height>=44;}), 'short-screen confirmation fully visible');
      await page.locator('.command-preview-rule').focus();
      await page.keyboard.press('End');
    }
    await page.locator('.command-preview-confirm').tap();
    if (type !== 'self') { const point = await targetPoint(page); assert.ok(point, `${heroId} has visible target`); await page.touchscreen.tap(point.x, point.y); }
    await page.waitForFunction(() => window.__renderer.state.players[0].bbsUsed, { timeout: 5000 });
    const state = await page.evaluate(() => window.__renderer.state);
    assert.equal(state.players[0].generalId, heroId);
    assert.equal(state.players[0].mana, 2);
    await page.waitForFunction(()=>!document.querySelector('#bbs-button').disabled);
    await page.locator('#bbs-button').tap();
    assert.match(await page.locator('.command-preview-status').innerText(), /本回合已使用/);
    assert.equal(await page.locator('.command-preview-confirm').isDisabled(), true);
    assert.equal(await page.evaluate(() => window.__renderer.state.players[0].mana), 2);
    await page.locator('.command-preview-close').tap();
    await page.evaluate(()=>{const p=window.__renderer.state.players[0];p.bbsUsed=false;p.mana=0;});
    await page.locator('#bbs-button').tap();
    assert.match(await page.locator('.command-preview-status').innerText(), /法力不足/);
    assert.equal(await page.locator('.command-preview-confirm').isDisabled(), true);
    await page.locator('#mana-count').tap();
    assert.equal(await page.locator('#command-preview').isVisible(), false);
    results.push({ heroId, command: state.lastAction.cardId, touch: true });
    console.log(`Hero ${heroId}: touch command applied, cost and lock correct`);
    await context.close();
  }
  for (const [heroId, spellId] of (process.env.HERO_UI_PREVIEW_ONLY ? [] : [[123,20081],[123,20086],[201,20095],[201,20151],[323,20052],[301,20072],[401,20116],[418,20117],[501,20139],[527,20149]])) {
    const { context, page } = await makePage();
    await fixture(page, heroId, spellId);
    await page.locator('.hand-card').first().click();
    const cast = page.locator('#inspect-cast');
    if (await cast.isVisible()) await cast.click();
    else { const point = await targetPoint(page, spellId); assert.ok(point, `${spellId} visible target`); await page.touchscreen.tap(point.x, point.y); }
    await page.waitForFunction(id => window.__renderer.state.lastAction?.cardId === id, spellId, { timeout: 5000 });
    const state = await page.evaluate(() => window.__renderer.state);
    assert.equal(state.lastAction.kind, 'spell');
    assert.equal(state.players[0].hand.includes(spellId), false);
    results.push({ spellId, touch: true, mana: state.players[0].mana });
    console.log(`Spell ${spellId}: preview and touch cast applied`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL(process.env.HERO_UI_PREVIEW_ONLY ? '../output/playwright/skill-preview-short-check.json' : '../latest-hero-ui-check.json', import.meta.url), JSON.stringify({ results, errors }, null, 2));
  console.log('Hero and faction spell touch UI checks passed.');
} finally { await browser.close(); }
