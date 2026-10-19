import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
try {
 for(const touch of [true,false]) {
  const context=await browser.newContext({viewport:{width:touch?844:1280,height:touch?390:720},isMobile:touch,hasTouch:touch,reducedMotion:'reduce'});
  await context.addInitScript(()=>localStorage.setItem('zl_coach','drag,preview,hint'));
  const page=await context.newPage();await page.goto('http://127.0.0.1:8766/source/dist/?debug');
  await page.getByRole('button',{name:'开始远征',exact:true}).click();await page.locator('.gen-card').first().click();
  await page.locator('.stage-intro').waitFor({state:'attached'});await page.locator('.stage-intro').waitFor({state:'detached'});
  await page.evaluate(()=>{const g=window.__app.game;g.run.general='kaleos';g.run.slots=[{defId:'l_shield',level:1},null,null,null,{defId:'l_priest',level:1}];g.renderAll(false);});
  await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getTiming().iterations)).map(a=>a.finished));});
  const b=await page.locator('.unit.side-0[data-slot="0"]').boundingBox();
  if(touch) await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);else await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
  await page.locator('.tip.on').waitFor();
  assert.equal(await page.locator('.tip.on .tip-name').innerText(),'银盾侍卫');
  if(touch) assert.equal(await page.locator('.arw-kind-swap .arw-flow').count(),2);
  await page.evaluate(async()=>{await Promise.allSettled(document.querySelector('.tip.on')?.getAnimations().map(a=>a.finished)??[]);});
  await page.screenshot({path:fileURLToPath(new URL(`../../output/touch-inspect-check/${touch?'swap':'desktop-hover'}.png`,import.meta.url)),fullPage:true});
  if(!touch){await page.mouse.move(10,10);assert.equal(await page.locator('.tip.on').count(),0);}
  results.push({touch,swapFlows:await page.locator('.arw-kind-swap .arw-flow').count()});await context.close();
 }
 writeFileSync(new URL('../../output/touch-inspect-check/desktop-swap-report.json',import.meta.url),JSON.stringify(results,null,2));console.log(results);
} finally {await browser.close();}
