import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
for(const viewport of [{width:844,height:390},{width:568,height:320}]){
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,reducedMotion:'reduce',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
 const page=await context.newPage(),errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
 await page.goto('http://localhost:4184');await page.waitForFunction(()=>window.__guardians?.snapshot().ready);
 await page.getByRole('button',{name:'按种子开局',exact:true}).tap();await page.getByRole('button',{name:'确认',exact:true}).tap();
 const session=await context.newCDPSession(page);
 const snap=()=>page.evaluate(()=>window.__guardians.snapshot());
 const world=async(x,y)=>page.evaluate(p=>window.__guardians.screenPoint(p),{x,y});
 const center=async(locator)=>{const r=await locator.boundingBox();assert.ok(r);return{x:r.x+r.width/2,y:r.y+r.height/2}};
 async function gesture(from,to,{cancel=false,shot=null}={}){
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,id:1}]});
  for(let i=1;i<=6;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/6,y:from.y+(to.y-from.y)*i/6,id:1}]});await page.waitForTimeout(18);}
  if(shot)await page.screenshot({path:'output/'+shot});
  await session.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await page.waitForTimeout(180);
 }
 const prefix='drag-'+viewport.width;
 await gesture(await center(page.locator('[data-tool="shield"]')),await world(23.5,9.5),{shot:prefix+'-legion-blue.png'});
 let state=await snap();assert.equal(state.gold,118);assert.equal(state.legions.length,1);
 assert.equal(await page.locator('#placement').isVisible(),false);
 await page.screenshot({path:'output/'+prefix+'-placed.png'});
 // Touch cancellation and release in the HUD never pay for a new legion.
 await gesture(await center(page.locator('[data-tool="archer"]')),await world(22.5,11.5),{cancel:true});assert.equal((await snap()).gold,118);
 await gesture(await center(page.locator('[data-tool="archer"]')),{x:5,y:25});assert.equal((await snap()).gold,118);
 // A second contact cancels the entire placement gesture, including its first finger.
 const source=await center(page.locator('[data-tool="archer"]')),secondTarget=await world(22.5,11.5);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...source,id:1}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...secondTarget,id:1}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...secondTarget,id:1},{x:secondTarget.x+20,y:secondTarget.y+20,id:2}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(180);assert.equal((await snap()).gold,118);
 // An existing legion follows the same drag path and does not charge again.
 await gesture(await world(23.5,9.5),await world(21.5,10.5),{shot:prefix+'-move-legion.png'});
 state=await snap();assert.equal(state.gold,118);assert.equal(state.legions.length,1);assert.equal(state.legions[0].x,21);assert.equal(state.legions[0].y,10);
 // Shop-to-battle drag is also available on a short phone without building shortcuts.
 await page.getByRole('button',{name:'商店',exact:true}).tap();const wall=page.locator('#shop-items button').filter({hasText:/^城墙/});
 await gesture(await center(wall),await world(24.5,7.5),{shot:prefix+'-building-preview.png'});
 state=await snap();assert.equal(state.gold,106);assert.equal(state.buildings.length,1);
 const id=state.buildings[0].id;
 await gesture(await world(24.5,7.5),await world(22.5,7.5),{shot:prefix+'-move-building.png'});
 state=await snap();assert.equal(state.gold,106);assert.equal(state.buildings[0].id,id);assert.equal(state.buildings[0].x,22.5);assert.equal(state.buildings[0].y,7.5);
 // Building occupancy and a terrain obstruction refuse a drop atomically.
 await page.getByRole('button',{name:'商店',exact:true}).tap();await gesture(await center(page.locator('#shop-items button').filter({hasText:/^城墙/})),await world(22.5,7.5));assert.equal((await snap()).gold,106);assert.equal((await snap()).buildings.length,1);
 // Cancel any selection before panning toward the natural obstacle column.
 const close=page.getByRole('button',{name:'取消选中',exact:true});if(await close.isVisible())await close.tap();
 await page.getByRole('button',{name:'全景地图',exact:true}).tap();
 const obstruction=await world(10.5,9.5);await gesture(await center(page.locator('[data-tool="archer"]')),obstruction,{shot:prefix+'-invalid-red.png'});assert.equal((await snap()).gold,106);assert.equal((await snap()).legions.length,1);
 await page.reload();await page.waitForFunction(()=>window.__guardians?.snapshot().ready);await page.getByRole('button',{name:'继续营地',exact:true}).tap();state=await snap();assert.equal(state.gold,106);assert.equal(state.buildings[0].x,22.5);assert.equal(state.legions[0].x,21);
 await page.getByRole('button',{name:'开战',exact:true}).tap();assert.equal((await snap()).phase,'combat');
 await gesture(await world(21.5,10.5),await world(20.5,10.5));assert.equal((await snap()).legions[0].x,21);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);results.push({viewport,checks:['new-legion-drop-once','blue-preview','cancel-no-charge','hud-drop-rejected','move-legion-free','shop-building-drop','move-building-free','occupied-drop-rejected','obstacle-drop-rejected','reload-continue','combat-cannot-move'],errors,failed});await context.close();
}
await browser.close();writeFileSync('output/drag-qa.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
