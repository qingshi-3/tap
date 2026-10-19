import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const out=fileURLToPath(new URL('../output/gift-codes/ui/',import.meta.url));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const base=process.env.GIFT_UI_BASE||'http://127.0.0.1:4200';
const key='duelyst-h5.safe-v1.expedition';
const report={checks:[],screens:[],errors:[],limitations:['Isolated Edge touch emulation; physical phone keyboard and TapTap host not verified.']};
async function make(width,height){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:width===568?'reduce':'no-preference'});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(base);await page.locator('.menu-play').waitFor();await page.waitForTimeout(450);return{page,context};
}
async function shot(page,name){await page.screenshot({path:out+name+'.png'});report.screens.push(name+'.png');}
async function visibleTarget(page,selector){
  const target=page.locator(selector);await target.scrollIntoViewIfNeeded();
  const box=await target.boundingBox(),view=page.viewportSize();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=view.width+1&&box.y+box.height<=view.height+1,`reachable ${selector}`);
  assert.ok(box.height>=43,`44px touch height ${selector}`);return target;
}
async function openGift(page){
  await page.locator('[data-action="audio-settings"]').tap();
  await (await visibleTarget(page,'#settings-gift-code')).tap();
  await page.locator('#gift-code-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#audio-settings').isVisible(),false);
}
async function state(page){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);}
try{
  for(const [width,height] of [[568,320],[844,390]]){
    const {page,context}=await make(width,height);
    const hint=page.locator('.menu-gift-hint');
    assert.equal(await hint.isVisible(),true);
    const hintBox=await hint.boundingBox(),settingsBox=await page.locator('[data-action="audio-settings"]').boundingBox();
    assert.ok(hintBox.x>=settingsBox.x&&hintBox.y>=settingsBox.y&&hintBox.x+hintBox.width<=settingsBox.x+settingsBox.width&&hintBox.y+hintBox.height<=height,'gift hint inside settings and viewport');
    assert.equal(await hint.evaluate(node=>getComputedStyle(node).animationName),'none');
    await shot(page,`${width}-home-gift-pending`);
    const beforeCoins=Number(await page.locator('[data-resource="gold"] strong').textContent());
    const beforeOrbs=Number(await page.locator('[data-resource="orb"] strong').textContent());
    await hint.tap();
    await visibleTarget(page,'#settings-effects-volume');
    await page.locator('#settings-effects-volume').press('Home');
    assert.equal(await page.locator('#settings-effects-value').textContent(),'0%');
    await page.locator('#settings-music-toggle').scrollIntoViewIfNeeded();
    await visibleTarget(page,'#settings-gift-code');await shot(page,`${width}-settings`);
    await page.locator('#settings-gift-code').tap();
    assert.equal(await page.locator('#gift-code-submit').isDisabled(),true);
    await shot(page,`${width}-empty`);
    await page.locator('#gift-code-input').fill('NO-SUCH-CODE');
    await (await visibleTarget(page,'#gift-code-submit')).tap();
    assert.match(await page.locator('#gift-code-status').textContent(),/无效|不存在|正确|有效/);
    assert.equal((await state(page))?.giftCodeClaims?.['return-20261016'],undefined);
    assert.equal(await hint.count(),1);
    await shot(page,`${width}-invalid`);
    await page.locator('#gift-code-input').fill('  lx2026  ');
    if(width===568)await (await visibleTarget(page,'#gift-code-submit')).tap();
    else {
      await page.locator('#gift-code-input').press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'gift-code-submit');
      await shot(page,`${width}-keyboard-focus`);
      await page.keyboard.press('Enter');
    }
    assert.match(await page.locator('#gift-code-status').textContent(),/30宝石.*1200金币.*到账/);
    assert.equal(await page.locator('#gift-code-submit').isDisabled(),true);
    const saved=await state(page);assert.equal(saved.coins,beforeCoins+1200);assert.equal(saved.recruitment.tickets,beforeOrbs+30);
    assert.ok(saved.giftCodeClaims['return-20261016']);
    assert.equal(await hint.count(),0);
    await shot(page,`${width}-success`);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#audio-settings').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'settings-gift-code');
    await page.locator('#audio-settings-close').tap();
    assert.equal(await page.locator('[data-resource="gold"] strong').textContent(),String(beforeCoins+1200));
    assert.equal(await page.locator('[data-resource="orb"] strong').textContent(),String(beforeOrbs+30));
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset.action),'audio-settings');
    await shot(page,`${width}-home-gift-claimed`);
    await page.reload();await page.locator('.menu-play').waitFor();
    assert.equal(await hint.count(),0);
    await openGift(page);
    await page.locator('#gift-code-input').fill('LX2026');await page.locator('#gift-code-input').press('Enter');
    assert.match(await page.locator('#gift-code-status').textContent(),/已领取/);
    assert.equal((await state(page)).coins,saved.coins);assert.equal((await state(page)).recruitment.tickets,saved.recruitment.tickets);
    await shot(page,`${width}-duplicate`);
    // Reduced available height approximates a landscape keyboard, without claiming a physical IME test.
    await page.setViewportSize({width,height:200});
    await page.locator('#gift-code-input').fill('INVALID'.repeat(8));
    await (await visibleTarget(page,'#gift-code-submit')).tap();
    assert.match(await page.locator('#gift-code-status').textContent(),/无效|不存在|正确|有效/);
    await page.locator('#gift-code-status').scrollIntoViewIfNeeded();await shot(page,`${width}-short-height`);
    await (await visibleTarget(page,'#gift-code-close')).tap();
    report.checks.push(`${width}x${height}: settings, disabled/invalid/success, real touch or keyboard, balances, reload duplicate, focus, reduced height`);
    await context.close();
  }
  {
    const {page,context}=await make(568,320);await openGift(page);
    await page.evaluate(k=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.__giftFail&&key===k)throw new DOMException('Test storage full','QuotaExceededError');return original.call(this,key,value)};window.__giftFail=true;},key);
    await page.locator('#gift-code-input').fill('LX2026');await page.locator('#gift-code-submit').tap();
    assert.match(await page.locator('#gift-code-status').textContent(),/失败|未保存/);
    assert.equal((await state(page))?.giftCodeClaims?.['return-20261016'],undefined);
    assert.equal(await page.locator('#gift-code-submit').isDisabled(),false);
    assert.equal(await page.locator('.menu-gift-hint').count(),1);
    await shot(page,'568-storage-failure');
    await page.evaluate(()=>window.__giftFail=false);await page.locator('#gift-code-submit').tap();
    assert.match(await page.locator('#gift-code-status').textContent(),/已到账/);
    const saved=await state(page);assert.equal(saved.coins,1300);assert.equal(saved.recruitment.tickets,40);
    report.checks.push('Storage failure displays error and no receipt; retry pays exactly once');await context.close();
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.failure=String(error.stack);throw error;}
finally{await writeFile(out+'report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
