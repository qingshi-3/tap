import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch} from '../dist/js/engine.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium} = require('playwright');
const out = new URL('../output/ui-repair/', import.meta.url);
await mkdir(out, {recursive:true});
const values = new Map(), storage = {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
const progress = new ExpeditionProgress(storage);
assert.ok(progress.selectHero(527).ok);
assert.ok(progress.saveBattle(createExpeditionMatch('border-01',progress.state.training,progress.state.squad,527,progress.getBattleLoadout())).ok);
const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const checks = [], errors = [];
try {
  for (const [width,height] of [[844,390],[568,320]]) {
    const context = await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});
    await context.addInitScript(({seed,key})=>localStorage.setItem(key,JSON.stringify(seed)), {seed:progress.state,key:SAVE_KEYS.expedition});
    const page = await context.newPage();
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:4223/');
    await page.locator('.menu-play').waitFor();
    await page.waitForFunction(()=>document.fonts.status==='loaded');
    await page.waitForTimeout(600);
    const capsule = {x:width-150,y:18,width:82,height:34};
    async function checkClear(selector) {
      const controls = page.locator(selector);
      for (const control of await controls.all()) {
        if (!await control.isVisible()) continue;
        const b = await control.boundingBox();
        assert.ok(b && b.x>=0 && b.y>=0 && b.x+b.width<=width+1 && b.y+b.height<=height+1, `${selector} fits: ${JSON.stringify(b)}`);
        const overlap = b.x<capsule.x+capsule.width && b.x+b.width>capsule.x && b.y<capsule.y+capsule.height && b.y+b.height>capsule.y;
        assert.equal(overlap,false,`${selector} overlaps host capsule: ${JSON.stringify(b)}`);
      }
    }
    async function shot(name) {
      // Native chrome is outside the page. Draw its measured shape in the active
      // top layer for screenshots only; geometric checks above use the same bounds.
      await page.evaluate(c=>{
        document.querySelector('[data-test-capsule]')?.remove();
        const e=document.createElement('div');e.dataset.testCapsule='';e.textContent='•••　◉';
        e.style.cssText=`position:fixed;left:${c.x}px;top:${c.y}px;width:${c.width}px;height:${c.height}px;border:1px solid #76818d;border-radius:22px;background:#08111cdd;color:white;display:grid;place-content:center;font:18px sans-serif;z-index:99999;pointer-events:none`;
        (document.querySelector('dialog[open]')??document.body).append(e);
      },capsule);
      await page.screenshot({path:fileURLToPath(new URL(`${name}-${width}.png`,out))});
      await page.locator('[data-test-capsule]').evaluate(e=>e.remove());
    }
    await checkClear('.menu-resources > *');
    await shot('host-menu');
    await page.locator('[data-action="cloud"]').tap();
    await checkClear('#cloud-close');
    await shot('host-cloud');
    await page.locator('#cloud-close').tap();
    await page.locator('.menu-play').tap();
    await page.locator('#objective-close').waitFor({state:'visible'});
    assert.equal(await page.locator('#objective-close').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
    await shot('host-objective');
    await page.locator('#objective-close').tap();
    await checkClear('#leave-match, #objective-open, .turn-marker, #focus-enemy');
    await shot('host-battle');
    await page.locator('#objective-open').tap();
    await page.keyboard.press('Tab');
    for(let i=0;i<4 && await page.evaluate(()=>document.activeElement.id!=='objective-close');i++) await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.inputMode),'keyboard');
    const focus = await page.evaluate(()=>({tag:document.activeElement.tagName,style:getComputedStyle(document.activeElement).outlineStyle,color:getComputedStyle(document.activeElement).outlineColor}));
    assert.equal(focus.tag,'BUTTON');assert.notEqual(focus.style,'none');assert.notEqual(focus.color,'rgb(229, 198, 111)');
    await page.locator('#objective-close').tap();
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.inputMode),'pointer');
    checks.push(`${width}x${height}: menu, archive close, objective touch/keyboard, battle turn status/enemy focus clear of simulated native capsule; reduced motion`);
    await context.close();
  }
  {
    const context = await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
    const page = await context.newPage();
    let fail = true;
    await page.route('**/units/f6_altgeneral.png',route=>fail?route.abort():route.continue());
    await page.goto('http://127.0.0.1:4223/');
    await page.locator('#art-retry').waitFor({state:'visible'});
    const before = await page.evaluate(key=>localStorage.getItem(key),SAVE_KEYS.expedition);
    fail = false;
    await page.locator('#art-retry').tap();
    await page.locator('#art-retry').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEYS.expedition),before,'art retry must not modify player progress');
    await page.locator('[data-page="codex"]').tap();
    await page.locator('[data-action="codex-faction"][data-faction-id="6"]').tap();
    await page.screenshot({path:fileURLToPath(new URL('art-retry-recovered.png',out))});
    checks.push('Failed Kara atlas produces a visible retry action; real tap reloads art and collection without changing save');
    await context.close();
  }
  assert.deepEqual(errors,[]);
} finally {
  await browser.close();
  await writeFile(new URL('host-chrome-report.json',out),JSON.stringify({checks,errors,limitation:'Desktop touch and native-capsule geometry simulation, not TapTap device validation'},null,2));
}
console.log(JSON.stringify({checks,errors}));
