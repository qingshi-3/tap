import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=new URL('../../output/touch-inspect-check/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const report=[];
try {
 for(const width of [844,667,568]) {
  const height=width===844?390:width===667?375:320;
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await context.addInitScript(()=>localStorage.setItem('zl_coach','drag,preview,hint'));
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8766/source/dist/?debug');
  await page.getByRole('button',{name:'开始远征',exact:true}).tap();await page.locator('.gen-card').first().tap();
  await page.locator('.stage-intro').waitFor({state:'attached'});await page.locator('.stage-intro').waitFor({state:'detached'});
  await page.evaluate(()=>{const g=window.__app.game;g.run.slots=['l_shield','l_priest','l_martyr','n_echo','n_obelisk'].map(defId=>({defId,level:1}));g.renderAll(false);});
  await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getTiming().iterations)).map(a=>a.finished));});
  const tapUnit=async(side,slot)=>{const b=await page.locator(`.unit.side-${side}[data-slot="${slot}"]`).boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);};
  const visible=page.locator('.tip.on');
  const expectTip=async()=>{
   await visible.waitFor();await page.evaluate(async()=>{await Promise.allSettled(document.querySelector('.tip.on')?.getAnimations().map(a=>a.finished)??[]);});
   const b=await visible.boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1);
   assert.ok(Number(await visible.locator('.tip-text').evaluate(e=>getComputedStyle(e).fontSize.replace('px','')))>=14);
  };
  await tapUnit(0,0);await expectTip();assert.equal(await visible.locator('.tip-name').innerText(),'银盾侍卫');
  assert.equal(await page.locator('.unit.side-0[data-slot="0"] .duelyst-selected').evaluate(e=>getComputedStyle(e).visibility),'visible');
  assert.equal(await page.locator('.unit.side-0[data-slot="0"] .duelyst-normal').evaluate(e=>getComputedStyle(e).visibility),'hidden');
  assert.ok(await visible.evaluate(e=>{
   const skin=getComputedStyle(document.documentElement).getPropertyValue('--pxf-steel').trim();
   return getComputedStyle(e).borderImageSource===skin;
  }), 'Unit details must reuse the existing game panel material');
  const hp=await page.evaluate(()=>window.__app.game.board.view('p0-0').getStats().hp);
  assert.equal(Number(await visible.locator('.ts.hp').innerText()),hp);assert.ok(hp>4);
  const flows=await page.locator('.arw-g.direction-flow').evaluateAll(nodes=>nodes.map(n=>({from:n.dataset.from,to:n.dataset.to,kind:n.dataset.kind,paths:[...n.querySelectorAll('.arw-flow')].map(p=>({length:p.getTotalLength(),stroke:getComputedStyle(p).stroke,dash:getComputedStyle(p).strokeDasharray})),heads:n.querySelectorAll('.arw-head').length})));
  assert.ok(flows.length>=2);assert.ok(flows.every(b=>b.from!==b.to&&b.heads===b.paths.length&&b.paths.every(p=>p.stroke!=='none'&&p.dash!=='none'&&p.length>50)));
  await page.screenshot({path:fileURLToPath(new URL(`${width}-friendly-arrows.png`,out)),fullPage:true});
  // A finger release emits pointerleave: the inspected unit must remain visible.
  assert.equal(await visible.isVisible(),true);
  await tapUnit(0,0);assert.equal(await page.locator('.tip.on').count(),0);
  assert.equal(await page.locator('.unit.side-0[data-slot="0"] .duelyst-normal').evaluate(e=>getComputedStyle(e).visibility),'visible');
  await tapUnit(1,0);await expectTip();assert.equal(await visible.locator('.tip-name').innerText(),'骷髅兵');
  await tapUnit(1,0);assert.equal(await page.locator('.tip.on').count(),0);
  await tapUnit(0,4);await expectTip();await page.touchscreen.tap(3,3);assert.equal(await page.locator('.tip.on').count(),0);
  // Controlled playback state verifies displayed current values rather than the card's base stats.
  await page.evaluate(()=>{const g=window.__app.game;g.mode='battle';g.board.view('p0-0').setStats({atk:17,hp:2,maxHp:9,shield:4,frozen:2,silenced:true});});
  await tapUnit(0,0);await expectTip();assert.equal(Number(await visible.locator('.ts.atk').innerText()),17);assert.equal(Number(await visible.locator('.ts.hp').innerText()),2);
  assert.equal(Number(await visible.locator('.ts.sh').innerText()),4);assert.equal(await visible.locator('.ts.fr').innerText(),'冻结 2');assert.equal(await visible.locator('.ts.si').innerText(),'已沉默');
  await page.screenshot({path:fileURLToPath(new URL(`${width}-current-stats.png`,out)),fullPage:true});
  await page.touchscreen.tap(3,3);assert.equal(await page.locator('.tip.on').count(),0);
  assert.deepEqual(errors,[]);report.push({width,height,hp,flows,errors});await context.close();
 }
 writeFileSync(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report.map(({width,height,hp,errors})=>({width,height,hp,errors}))));
} finally {await browser.close();}
