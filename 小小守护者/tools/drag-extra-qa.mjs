import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={viewport:{width:568,height:320},checks:[],errors:[],failedResponses:[]};
const context=await browser.newContext({viewport:report.viewport,isMobile:true,hasTouch:true,reducedMotion:'reduce',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.failedResponses.push(r.url())});
const snap=()=>page.evaluate(()=>window.__guardians.snapshot());
const world=(x,y)=>page.evaluate(p=>window.__guardians.screenPoint(p),{x,y});
const centre=async locator=>{const b=await locator.boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2}};
let session;
const shot=name=>page.screenshot({path:`output/drag-extra-${name}.png`});
async function gesture(from,to,name){await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});for(let i=1;i<=8;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8,id:1}]});await page.waitForTimeout(25)}if(name)await shot(name);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(150)}
async function check(name,fn){try{const evidence=await fn();report.checks.push({name,ok:true,evidence})}catch(e){report.checks.push({name,ok:false,error:e.message});await shot(name+'-failure')}finally{for(const id of ['shop','collection'])if(await page.locator('#'+id).isVisible())await page.locator(`[data-close="${id}"]`).tap()}}
try{
 await page.goto('http://localhost:4184');await page.waitForFunction(()=>window.__guardians?.snapshot().ready);session=await context.newCDPSession(page);
 await page.getByRole('button',{name:'按种子开局',exact:true}).tap();await page.getByRole('button',{name:'确认',exact:true}).tap();
 await check('last-member-drag',async()=>{
  await gesture(await centre(page.locator('[data-tool="shield"]')),await world(23.5,9.5),'purchase-blue');const before=await snap();assert.equal(before.gold,118);assert.equal(before.legions[0].x,23);
  const last=before.members.at(-1),from=await world(last.x+.5,last.y+.5),to=await world(last.x+1.5,last.y+.5);
  await gesture(from,to,'last-member-moving');const after=await snap();assert.equal(after.gold,118);assert.equal(after.legions[0].x,24);assert.equal(after.legions[0].y,9);assert.equal(after.members.length,before.members.length);
  after.members.forEach((u,i)=>{assert.equal(u.x,before.members[i].x+1);assert.equal(u.y,before.members[i].y)});await shot('last-member-placed');return {before,after,from,to};
 });
 await check('shop-short-phone-scroll',async()=>{
  await page.getByRole('button',{name:'商店',exact:true}).tap();const rail=await page.locator('#shop-scroll').boundingBox();assert.ok(rail);
  const start=await page.locator('#shop-items').evaluate(e=>({top:e.scrollTop,height:e.clientHeight,total:e.scrollHeight}));
  const dialogBox=await page.locator('#shop').boundingBox();await gesture({x:rail.x+rail.width/2,y:Math.min(rail.y+rail.height-15,dialogBox.y+dialogBox.height-20)},{x:rail.x+rail.width/2,y:rail.y+15},'shop-scrolling');
  const end=await page.locator('#shop-items').evaluate(e=>({top:e.scrollTop,height:e.clientHeight,total:e.scrollHeight}));report.shopGeometry={start,end,rail};assert.ok(end.top>start.top);
  const hero=page.locator('#shop-items button').filter({hasText:/工程师/}),heal=page.locator('#shop-items button').filter({hasText:/治疗/});assert.equal(await hero.isDisabled(),true);
  const heroBox=await hero.boundingBox(),healBox=await heal.boundingBox();assert.ok(healBox.y>=0&&healBox.y+healBox.height<=320);const gold=(await snap()).gold;
  if(heroBox.y>0&&heroBox.y+heroBox.height<=320){await page.touchscreen.tap(heroBox.x+heroBox.width/2,heroBox.y+heroBox.height/2);assert.equal((await snap()).gold,gold)}
  await heal.tap();assert.equal((await snap()).gold,gold-18);const saved=await page.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('little-guardians-h5.run.v1')).snapshot));assert.equal(saved.spells.heal,1);
  const bounds=await page.evaluate(()=>{const css=getComputedStyle(document.documentElement),safe={left:parseFloat(css.getPropertyValue('--host-left'))||0,right:parseFloat(css.getPropertyValue('--host-right'))||0,top:parseFloat(css.getPropertyValue('--host-top'))||0,bottom:parseFloat(css.getPropertyValue('--host-bottom'))||0};return {safe,viewport:{width:innerWidth,height:innerHeight},parts:['#shop','#shop .dialog-heading','#shop .shop-body','#shop-detail'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}})}});
  for(const b of bounds.parts){assert.ok(b.y>=bounds.safe.top&&b.bottom<=bounds.viewport.height-bounds.safe.bottom);assert.ok(b.x>=bounds.safe.left&&b.right<=bounds.viewport.width-bounds.safe.right)}
  await shot('shop-bottom');await page.getByRole('button',{name:'关闭商店',exact:true}).tap();return {start,end,heroDisabled:true,heroBox,healBox,goldBefore:gold,goldAfter:(await snap()).gold,healUses:saved.spells.heal,bounds};
 });
 await check('complete-route-preview',async()=>{
  await page.locator('#wave-preview button').tap();const content=page.locator('#collection-content'),text=await content.innerText();for(let i=1;i<=7;i++)assert.ok(text.includes(`第${i}波`));assert.ok(text.includes('最终围攻'));
  const box=await page.locator('#collection').boundingBox();report.routeGeometry=await page.locator('#collection').evaluate(e=>({top:e.scrollTop,height:e.clientHeight,total:e.scrollHeight}));
  for(let i=0;i<6;i++)await gesture({x:box.x+box.width/2,y:box.y+box.height-22},{x:box.x+box.width/2,y:box.y+65});
  const last=content.getByText('第7波 · 最终围攻',{exact:true}),lastBox=await last.boundingBox();report.routeLastBox=lastBox;await shot('route-preview');assert.ok(lastBox.y>=box.y&&lastBox.y+lastBox.height<=box.y+box.height);const closing=page.locator('[data-close="collection"]');await closing.tap();assert.equal(await page.locator('#collection').isVisible(),false);return {text,lastBox};
 });
 await check('alert-radius-keyboard-save',async()=>{
  const state=await snap();await page.touchscreen.tap(...Object.values(await world(state.legions[0].x+.5,state.legions[0].y+.5)));
  const range=page.getByRole('slider',{name:'警戒半径'});await range.waitFor({state:'visible'});const before=Number(await range.inputValue());await range.focus();await range.press('ArrowRight');await page.waitForTimeout(120);
  const fresh=page.getByRole('slider',{name:'警戒半径'}),value=Number(await fresh.inputValue());assert.equal(value,before+.25);await fresh.focus();await shot('alert-blue-focus');
  const focus=await fresh.evaluate(e=>{const s=getComputedStyle(e);return {outline:s.outline,background:s.background,focused:document.activeElement===e}});const saved=await page.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('little-guardians-h5.run.v1')).snapshot));assert.equal(saved.legions[0].alertRadius,value);return {before,value,savedRadius:saved.legions[0].alertRadius,focus};
 });
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedResponses,[]);
}finally{writeFileSync('output/drag-extra-qa.json',JSON.stringify(report,null,2));await context.close();await browser.close()}
console.log(JSON.stringify({checks:report.checks.map(c=>({name:c.name,ok:c.ok,error:c.error})),errors:report.errors,failedResponses:report.failedResponses}));

