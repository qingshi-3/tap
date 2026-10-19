import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const evidence=[],errors=[];
try {
  for (const viewport of [{width:852,height:392},{width:568,height:320}]) {
    const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:4198/');
    await page.locator('#startup').waitFor({state:'detached'});
    await page.evaluate(async()=>{
      const {ExpeditionProgress}=await import('/js/expedition-progress.js');
      const {createExpeditionMatch}=await import('/js/engine.js');
      const p=new ExpeditionProgress(localStorage),s=p.state;
      assertSaved(p.saveBattle(createExpeditionMatch('border-01',s.training,s.squad,s.selectedHeroId)));
      function assertSaved(r){if(!r.ok)throw Error(r.error);}
    });
    await page.reload(); await page.locator('#startup').waitFor({state:'detached'});
    await page.locator('[data-action=resume]').tap();
    const dialog=page.locator('#objective-dialog'),button=page.locator('#objective-close');
    await dialog.waitFor({state:'visible'});
    assert.equal(await page.locator('#objective-title').evaluate(el=>el===document.activeElement),true);
    assert.equal(await button.evaluate(el=>getComputedStyle(el).outlineStyle),'none','no automatic yellow ring');
    assert(await button.evaluate(el=>{const r=el.getBoundingClientRect(),d=el.closest('dialog').getBoundingClientRect();return r.height>=44&&r.bottom<d.bottom&&r.top>d.top;}));
    await page.screenshot({path:`output/playwright/objective-clean-${viewport.width}.png`});
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    assert.equal(await button.evaluate(el=>el===document.activeElement),true);
    assert.equal(await button.evaluate(el=>getComputedStyle(el).outlineStyle),'solid','keyboard focus preserved');
    await page.keyboard.press('Enter'); assert.equal(await dialog.isVisible(),false);
    await page.locator('#objective-open').tap(); await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(),false);
    await page.locator('#leave-match').tap();await page.locator('#confirm-accept').tap();
    await page.locator('[data-page=trials]').tap();
    await page.locator('[data-group-id=basics]').tap();
    await page.locator('[data-action=trial]').first().tap();
    await dialog.waitFor({state:'visible'});
    assert(await page.locator('#trial-lesson-steps').isVisible());
    await page.screenshot({path:`output/playwright/objective-lesson-${viewport.width}.png`});
    const body=page.locator('.objective-body');
    if(await body.evaluate(el=>el.scrollHeight>el.clientHeight)){
      const box=await body.boundingBox(),cdp=await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height-15}]});
      for(let n=1;n<=5;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height-15-n*15}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForTimeout(150);
      assert(await body.evaluate(el=>el.scrollTop>0),'lesson touch scrolling');
    }
    assert(await button.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;}));
    await button.tap();assert.equal(await dialog.isVisible(),false);
    evidence.push({viewport,expedition:true,lesson:true,touchClose:true,keyboardFocus:true});
    await context.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile('output/playwright/objective-clean-evidence.json',JSON.stringify({evidence,errors},null,2));
  console.log(evidence);
} finally {await browser.close();}
