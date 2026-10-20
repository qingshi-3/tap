// Browser QA: node tools/qa.mjs [seasons]   (needs `npm run preview` on :4198)
// Plays through the UI at four landscape viewports, checks for page errors and overflow, screenshots to /tmp/pt-qa/.
// Also checks that a portrait phone gets the rotate prompt.
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
const PW = process.env.PLAYWRIGHT || '/home/admin/workspace/喵喵当铺/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const cache = `${homedir()}/.cache/ms-playwright`;
const shell = existsSync(cache) && readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell')).sort().pop();
const executablePath = process.env.CHROME || (shell ? `${cache}/${shell}/chrome-headless-shell-linux64/chrome-headless-shell` : undefined);
const SEASONS = +(process.argv[2] || 10);
const OUT = '/tmp/pt-qa'; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(executablePath ? { executablePath } : {});
let failed = 0;
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  await page.goto(process.env.QA_URL || 'http://localhost:4198/?qa');
  await page.waitForTimeout(400);
  const tip = await page.locator('#rotate-tip').isVisible();
  await page.screenshot({ path: `${OUT}/390x844-portrait.png` });
  if (!tip) failed++;
  console.log(tip ? 'ok  ' : 'FAIL', '390x844 portrait rotate prompt', tip);
  await page.close();
}
for (const [w, h] of [[844, 390], [667, 375], [932, 430], [1366, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: w < 1000 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const tag = `${w}x${h}`, shot = name => page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  const visible = sel => page.locator(sel).first().isVisible().catch(() => false);
  // locator.click can hang on file:// "waiting for scheduled navigations"; click by coordinates instead.
  const tapEl = async loc => { const b = await loc.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
  async function closeModals(name) {
    for (let i = 0; i < 6 && await visible('#modal'); i++) {
      if (name) await shot(`${name}-modal${i}`);
      if (await visible('#modal .codex-close')) { await page.click('#modal .codex-close'); await page.waitForTimeout(250); continue; }
      const pick = page.locator('#modal .modal-actions button:not([disabled])').filter({ hasText: /仍然结算|好的|明白|新王国|再来一局|继续|返回|关闭/ });
      await tapEl(await pick.count() ? pick.first() : page.locator('#modal .modal-actions button').first()).catch(async e => { console.log('modal stuck', await page.evaluate(() => document.querySelector('#modal').innerText.slice(0, 200))); throw e; });
      await page.waitForTimeout(250);
    }
  }
  await page.addInitScript(() => { if (!sessionStorage.qaInit) { localStorage.clear(); sessionStorage.qaInit = '1'; localStorage.setItem('patchwork-kingdom.v3.tutorial-done', '1'); localStorage.setItem('patchwork-kingdom.v3.tips', '{"threat":1,"winter":1,"famine":1,"unlock":1}'); } });
await page.goto(process.env.QA_URL || 'http://localhost:4198/?qa');
  await page.waitForTimeout(500);
  await shot('title');
  await closeModals();
  await page.waitForTimeout(900);
  await shot('land-sheet');
  // Drag the first land offer onto the map, then confirm wherever it is legal.
  const offer = page.locator('[data-land-i]').first();
  if (await offer.isVisible()) {
    const box = await offer.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(w / 2, h / 2 - 40, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(200); await shot('land-drag');
    if (await visible('#place-bar')) {
      if (!(await page.locator('#place-confirm:not([disabled])').count())) { await page.click('#place-cancel'); await page.locator('[data-land-i]').first().click(); }
      if (await page.locator('#place-confirm:not([disabled])').count()) await page.click('#place-confirm'); else await page.click('#place-cancel');
    }
  }
  for (let turn = 0; turn < SEASONS; turn++) {
    const st = await page.evaluate(() => __pt.state.status);
    if (st !== 'playing') break;
    await closeModals();
    if (await visible('[data-land-i]')) {
      await page.locator('[data-land-i]').first().click(); await page.waitForTimeout(100);
      if (await page.locator('#place-confirm:not([disabled])').count()) await page.click('#place-confirm'); else await page.click('#place-cancel');
      await page.waitForTimeout(150);
    }
    if (await visible('#sheet [data-draft-i]:not([disabled])')) {
      if (turn === 0) await shot('draft');
      await page.locator('[data-draft-i]').first().click();
    } else if (await visible('#sheet-close')) await page.click('#sheet-close');
    for (let k = 0; k < 3 && await visible('#sheet-close'); k++) { await page.click('#sheet-close'); await page.waitForTimeout(150); }
    for (const sel of ['.card.hand', '.card[data-type="house"]', '.card[data-type="farm"]', '.card[data-type="lumber"]', '.card[data-type="tower"]']) {
      for (let k = 0; k < 3 && await visible('#sheet-close'); k++) { await page.click('#sheet-close'); await page.waitForTimeout(150); }
      await page.waitForFunction(() => document.querySelector('#dock').getBoundingClientRect().left >= 0, null, { timeout: 3000 }).catch(() => {}); // rail slides back in
      const card = page.locator(sel).first();
      if (!await card.isVisible().catch(() => false) || await card.evaluate(e => e.classList.contains('unaffordable'))) continue;
      await tapEl(card);
      await page.waitForTimeout(80);
      if (turn === 1) await shot('placing');
      if (await page.locator('#place-confirm:not([disabled])').count()) await page.click('#place-confirm');
      else if (await visible('#place-bar')) await page.click('#place-cancel');
      await closeModals();
      if (await visible('#sheet-close')) await page.click('#sheet-close');
    }
    if (turn % 4 === 2) await shot(`turn${turn}`);
    if (!await visible('#next-turn')) { await page.keyboard.press('Escape'); await closeModals(); }
    await page.click('#next-turn'); if (process.env.QA_DEBUG) console.log('turn', turn, await page.evaluate(() => __pt.state.turn));
    await page.waitForTimeout(300);
    await closeModals(turn % 4 === 3 ? `turn${turn}` : '');
    await page.waitForTimeout(1800); // threat scouting delays the auto-opened sheet
    await closeModals();
  }
  // Inspector on the hall.
  if (await visible('#next-turn')) {
    const pos = await page.evaluate(() => { const b = __pt.state.buildings[0], p = __pt.toScreen(b.x + 1, b.y + 1); return p; });
    await page.mouse.click(pos.x, pos.y); await page.waitForTimeout(200); await shot('inspect'); await closeModals();
  }
  const overflow = await page.evaluate(() => [...document.querySelectorAll('#hud, #dock, #side, .left-col, #map-tools')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.id || e.className));
  const st = await page.evaluate(() => ({ status: __pt.state.status, turn: __pt.state.turn, tiles: __pt.state.tiles.length, buildings: __pt.state.buildings.length }));
  await shot('final');
  const bad = errors.length || overflow.length;
  if (bad) failed++;
  console.log(bad ? 'FAIL' : 'ok  ', tag, JSON.stringify(st), errors.length ? 'errors: ' + errors.join(' | ') : '', overflow.length ? 'overflow: ' + overflow : '');
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
