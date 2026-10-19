import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = new URL('../../output/unit-art-check/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const size of [{width:844,height:390}, {width:667,height:375}, {width:568,height:320}]) {
    const context = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true, reducedMotion: size.width === 568 ? 'reduce' : 'no-preference' });
    await context.addInitScript(() => localStorage.setItem('zl_coach', 'drag,preview,hint'));
    const page = await context.newPage();
    const errors = [], failed = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if(r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    const screenshot = async name => {
      if(name !== 'battle') await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations)).map(a => a.finished)); });
      return page.screenshot({path:fileURLToPath(new URL(`${size.width}-${name}.png`,out)),fullPage:true});
    };
    const verifyImages = async () => {
      await page.locator('[data-unit-art]').first().waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('[data-unit-art] img')].every(i => i.complete && i.naturalWidth > 0));
      return page.locator('[data-unit-art]').evaluateAll(nodes => nodes.map(n => ({id:n.dataset.unitArt, width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,animation:getComputedStyle(n.querySelector('img')).animationName})));
    };
    await page.goto('http://127.0.0.1:8766/source/dist/?debug');
    await page.getByRole('button', {name:'开始远征',exact:true}).waitFor();
    await verifyImages();
    await screenshot('title');
    await page.getByRole('button', {name:'玩法说明',exact:true}).tap();
    await page.waitForFunction(() => [...document.querySelectorAll('.ht-fig image')].every(i => !!i.getAttribute('href')));
    assert.equal(await page.locator('.modal-ov svg image').count() > 0,true);
    await screenshot('help');
    await page.locator('.modal-x').tap();
    await page.getByRole('button',{name:'开始远征',exact:true}).tap();
    await page.locator('.gen-card').first().waitFor();
    await page.locator('.screen.title').waitFor({state:'detached'});
    const generals = await verifyImages();
    assert.equal(generals.filter(n=>n.id.startsWith('general_')).length,4);
    await screenshot('generals');
    await page.locator('.gen-card').first().tap();
    await page.locator('.card').first().waitFor();
    await page.locator('.screen.select').waitFor({state:'detached'});
    await verifyImages();
    // Wait for the intro to finish so it cannot cover deployment feedback.
    await page.locator('.stage-intro').waitFor({state:'attached'});
    await page.locator('.stage-intro').waitFor({state:'detached'});
    const firstId = await page.locator('.card').first().getAttribute('data-id');
    await page.locator('.card').first().tap();
    const deployAt = await page.locator('.slot.side-0[data-slot="0"]').boundingBox();
    await page.touchscreen.tap(deployAt.x,deployAt.y);
    await page.waitForFunction(() => window.__app.game.run.slots[0] !== null);
    assert.equal(await page.locator('.unit.side-0[data-slot="0"] [data-unit-art]').getAttribute('data-unit-art'),firstId);
    await screenshot('deployed');
    // Pointer drag checks that the new image cannot swallow input or leave a stale ghost.
    const from = await page.locator('.unit.side-0[data-slot="0"]').boundingBox();
    const to = await page.locator('.slot.side-0[data-slot="1"]').boundingBox();
    await page.mouse.move(from.x+from.width/2,from.y+from.height/2);
    await page.mouse.down();
    await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});
    await page.mouse.up();
    await page.waitForFunction(() => window.__app.game.run.slots[1] !== null && window.__app.game.run.slots[0] === null);
    assert.equal(await page.locator('.drag-ghost').count(),0);
    const selectedAt = await page.locator('.unit.side-0[data-slot="1"]').boundingBox();
    await page.touchscreen.tap(selectedAt.x+selectedAt.width/2,selectedAt.y+selectedAt.height/2);
    const visible = await verifyImages();
    if(size.width === 568) assert.ok(visible.every(n=>n.animation==='none'));
    await screenshot('selected');
    await page.getByRole('button',{name:/开.*战/}).tap();
    await page.waitForFunction(() => window.__app.game.mode === 'battle' || window.__app.game.mode === 'result');
    await verifyImages();
    await screenshot('battle');
    assert.deepEqual(errors,[]); assert.deepEqual(failed,[]);
    report.push({size,firstId,visible,errors,failed,viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollX,scrollY}))});
    await context.close();
  }
  writeFileSync(new URL('report.json',out),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report.map(({size,firstId,errors,failed})=>({size,firstId,errors,failed}))));
} finally { await browser.close(); }
