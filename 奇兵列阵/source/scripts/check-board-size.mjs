import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = new URL('../../output/board-size-check/', import.meta.url);
mkdirSync(out,{recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
const report=[];
try {
 for(const width of [844,667,568]) {
  const height=width===844?390:width===667?375:320;
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await context.addInitScript(()=>localStorage.setItem('zl_coach','drag,preview,hint'));
  const page=await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8766/source/dist/?debug');
  await page.getByRole('button',{name:'开始远征',exact:true}).tap();
  await page.locator('.gen-card').first().tap();
  await page.locator('.screen.select').waitFor({state:'detached'});
  await page.locator('.stage-intro').waitFor({state:'attached'});
  await page.locator('.stage-intro').waitFor({state:'detached'});
  // Isolated visual fixture: five mixed silhouettes, upgrades, sacrifice and silence.
  await page.evaluate(()=>{const g=window.__app.game;g.run.stage=4;g.run.slots=['l_shield','a_cult','m_titan','v_wall','s_wind'].map((defId,i)=>({defId,level:i%3+1}));g.renderAll(false);});
  await page.waitForFunction(()=>[...document.querySelectorAll('.board .duelyst-strip')].every(i=>i.complete&&i.naturalWidth));
  await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getTiming().iterations)).map(a=>a.finished));});
  const geometry=await page.evaluate(()=>{
   const r=e=>{const a=e.getBoundingClientRect();return {left:a.left,right:a.right,top:a.top,bottom:a.bottom,width:a.width,height:a.height};};
   return {art:[...document.querySelectorAll('.board .u-bob')].map(r),ped:[...document.querySelectorAll('.board .ped')].map(r),tray:r(document.querySelector('.tray')),hud:r(document.querySelector('.hud')),stats:[...document.querySelectorAll('.board .u-stats')].map(r)};
  });
  assert.equal(geometry.ped.length,10);
  for(const a of geometry.art) {assert.ok(a.left>=0&&a.right<=width);assert.ok(a.top>geometry.hud.bottom);assert.ok(a.bottom<geometry.tray.top);}
  for(const a of geometry.ped) {assert.ok(a.left>=0&&a.right<=width);}
  for(const a of geometry.stats) assert.ok(a.bottom<geometry.tray.top);
  await page.screenshot({path:fileURLToPath(new URL(`${width}-full-board.png`,out)),fullPage:true});
  // Hit-test both outermost positions using real touch input and board event routing.
  for(const side of [0,1]) for(const slot of [0,4]) {
   const b=await page.locator(`.unit.side-${side}[data-slot="${slot}"]`).boundingBox();
   await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);
   const focus=await page.evaluate(()=>window.__app.game.focus);
   assert.deepEqual(focus,{side,slot});
  }
  assert.deepEqual(errors,[]);report.push({width,height,geometry,errors});await context.close();
 }
 writeFileSync(new URL('report.json',out),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.map(({width,height,errors})=>({width,height,errors}))));
} finally {await browser.close();}
