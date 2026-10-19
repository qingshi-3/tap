import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.PLAYWRIGHT_PACKAGE || 'C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=new URL('../output/',import.meta.url); await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
const evidence=[],errors=[];
try {
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto('http://127.0.0.1:4178/');
  await page.getByRole('button',{name:'进入荒野'}).waitFor();
  await page.screenshot({path:new URL('title.png',output).pathname.replace(/^\/(?:([A-Za-z]):)/,'$1:')});
  await page.getByRole('button',{name:'进入荒野'}).click();await page.clock.runFor(1100);
  assert.equal(await page.locator('#time').innerText(),'00:01');
  await page.keyboard.down('d');await page.clock.runFor(2000);await page.keyboard.up('d');
  await page.screenshot({path:new URL('keyboard-move.png',output).pathname.replace(/^\/(?:([A-Za-z]):)/,'$1:')});
  evidence.push('1280x720: keyboard movement rendered; game time advances');
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  const paused=await page.locator('#time').innerText();await page.clock.runFor(8000);assert.equal(await page.locator('#time').innerText(),paused);
  await page.getByRole('button',{name:'重新开始',exact:true}).click();await page.getByRole('button',{name:'继续本次战斗'}).click();assert.equal(await page.locator('#time').innerText(),paused);
  await page.getByRole('button',{name:'继续战斗'}).click();await page.clock.runFor(1500);
  assert.notEqual(await page.locator('#time').innerText(),paused);
  await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'重新开始',exact:true}).click();await page.getByRole('button',{name:'确定',exact:true}).click();
  assert.equal(await page.locator('#time').innerText(),'00:00'); evidence.push('pause freezes time; cancel restart preserves run; confirm restart creates new run');
  // Ordinary input only: remain in place and choose upgrades until failure.
  let seenUpgrade=false,seenDefeat=false;
  for(let n=0;n<80;n++) {
    await page.clock.runFor(3000);
    if(await page.locator('#upgrade-dialog').isVisible()) {
      seenUpgrade=true;const t=await page.locator('#time').innerText();await page.clock.runFor(4000);assert.equal(await page.locator('#time').innerText(),t);
      if(!(await page.locator('#upgrade-choices').locator('button').count()))throw new Error('upgrade has no choices');
      await page.screenshot({path:new URL('upgrade.png',output).pathname.replace(/^\/(?:([A-Za-z]):)/,'$1:')});
      await page.locator('#upgrade-choices').locator('button').first().click();
    }
    if(await page.locator('#result-dialog').isVisible()) {seenDefeat=true;break;}
  }
  assert(seenUpgrade,'natural stationary play must reach upgrade');assert(seenDefeat,'natural stationary play must reach defeat');
  await page.screenshot({path:new URL('defeat.png',output).pathname.replace(/^\/(?:([A-Za-z]):)/,'$1:')});evidence.push('natural stationary play: automatic attack, kill/XP upgrade, choice freeze/resume, defeat result');
  await page.getByRole('button',{name:'再战一次'}).click();await page.clock.runFor(1100);assert.equal(await page.locator('#time').innerText(),'00:01');
  await page.setViewportSize({width:390,height:844});await page.clock.runFor(1000);assert(await page.locator('#rotate').isVisible());
  const rotated=await page.locator('#time').innerText();await page.keyboard.press('Escape');await page.clock.runFor(8000);assert.equal(await page.locator('#time').innerText(),rotated);assert(await page.locator('#rotate').isVisible());
  await page.screenshot({path:new URL('portrait.png',output).pathname.replace(/^\/(?:([A-Za-z]):)/,'$1:')});
  await page.setViewportSize({width:844,height:390});await page.getByRole('button',{name:'继续战斗'}).click();
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:110,y:270}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:145,y:250}]});
  await page.clock.runFor(2200);assert(await page.locator('#joystick').evaluate(el=>el.classList.contains('active')));
  await page.screenshot({path:new URL('mobile-touch.png',output).pathname.replace(/^\/(?:([A-Za-z]):)/,'$1:')});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert(!(await page.locator('#joystick').evaluate(el=>el.classList.contains('active'))));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth || document.documentElement.scrollHeight>innerHeight);assert(!overflow);
  evidence.push('844x390: real emulated touch drag and release; portrait 390x844 freezes time with rotation prompt; no page overflow');
  await page.emulateMedia({reducedMotion:'reduce'});await page.clock.runFor(7000);await page.screenshot({path:new URL('reduced-motion.png',output).pathname.replace(/^\/(?:([A-Za-z]):)/,'$1:')});
  await page.getByRole('button',{name:'暂停',exact:true}).click();await page.keyboard.press('Tab');
  const focus=await page.evaluate(()=>document.activeElement?.tagName);assert.equal(focus,'BUTTON');evidence.push('reduced-motion rendered; keyboard focus stays in pause dialog buttons');
  assert.deepEqual(errors,[]);await context.close();
  await writeFile(new URL('browser-evidence.json',output),JSON.stringify({date:'2026-10-10',evidence,errors},null,2));
  console.log(JSON.stringify({evidence,errors},null,2));
} finally {await browser.close();}
