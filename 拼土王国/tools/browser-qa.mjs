import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from '../dist/rules.js';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='output/qa/';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const key='patchwork-kingdom.save.v1',errors=[],report=[];
let page;
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const cdp=await context.newCDPSession(page);
 await page.goto('http://127.0.0.1:4198/');await page.locator('.offer').first().waitFor();
 
 const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 async function drag(from,to){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,id:0}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8,id:0}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(65);}
 async function pointTile(x,y){const loc=page.locator(`.tile[data-x="${x}"][data-y="${y}"]`);let box=await loc.boundingBox();const v=await page.locator('#viewport').boundingBox(),dest={x:v.x+v.width/2,y:v.y+v.height/2};let dx=dest.x-(box.x+box.width/2),dy=dest.y-(box.y+box.height/2);while(Math.abs(dx)>2||Math.abs(dy)>2){const mx=Math.max(-100,Math.min(100,dx)),my=Math.max(-100,Math.min(100,dy));await drag(dest,{x:dest.x+mx,y:dest.y+my});dx-=mx;dy-=my;}await loc.tap();await page.waitForTimeout(350);}
 async function build(type,t){await page.locator('[data-tab="build"]').tap();await page.locator(`[data-build="${type}"]`).tap();await pointTile(t.x,t.y);await page.locator('#confirm-placement').tap();assert.equal((await read()).tiles.find(q=>q.x===t.x&&q.y===t.y).building,type);}
 async function season(){await page.locator('#next-turn').tap();await page.locator('#close-dialog').tap();}
 let initial=await read();assert.equal(initial.gold,150);
 const panBefore=await page.locator('#viewport').evaluate(e=>e.scrollLeft);await drag({x:190,y:330},{x:250,y:350});assert.notEqual(await page.locator('#viewport').evaluate(e=>e.scrollLeft),panBefore);await page.locator('#center').tap();
 await page.locator('.offer').first().tap();await page.locator('#rotate').tap();await page.screenshot({path:out+'rotated-390.png'});for(let i=0;i<3;i++)await page.locator('#rotate').tap();
 await pointTile(6,6);assert.equal(await page.locator('#confirm-placement').isDisabled(),true);assert.equal((await read()).gold,150);await page.screenshot({path:out+'overlap-rejected.png'});
 const candidates=[];for(let y=0;y<14;y++)for(let x=0;x<14;x++)if(R.canPlaceLand(initial,0,x,y,0).ok)candidates.push({x,y,d:Math.abs(x-6)+Math.abs(y-6)});candidates.sort((a,b)=>a.d-b.d);await pointTile(candidates[0].x,candidates[0].y);await page.locator('#confirm-placement').tap();let s=await read();assert.equal(s.gold,150-initial.offers[0].cost);assert.equal(s.tiles.length,9+initial.offers[0].cells.length);
 await build('school',{x:6,y:5});await build('lumber',{x:5,y:5});await build('fishery',{x:7,y:5});await page.screenshot({path:out+'built-390.png'});
 for(let i=0;i<4;i++)await season();s=await read();assert.equal(s.level,2);assert.equal(s.turn,5);
 await pointTile(6,6);await page.locator('#upgrade').tap();s=await read();assert.equal(s.tiles.find(t=>t.building==='hall').level,2);await page.screenshot({path:out+'upgraded-390.png'});
 await page.locator('[data-tab="realm"]').tap();await page.locator('[data-policy="growth"]').tap();assert.equal((await read()).policy,'growth');
 await page.locator('[data-tab="land"]').tap();const old=await read();await page.locator('#reroll').tap();s=await read();assert.equal(s.gold,old.gold-5);assert.notDeepEqual(s.offers,old.offers);
 await page.reload();await page.locator('.offer').first().waitFor();assert.deepEqual(await read(),s);await season();assert.equal((await read()).turn,s.turn+1);
 report.push({flow:'touch pan, rotate, overlap rejection, buy, school/lumber/fishery, four seasons, level 2, upgrade, policy, paid refresh, reload and continue',passed:true});
 // A longer real-input run develops the city without injecting currency or progress.
 for(let n=0;n<24;n++){
  s=await read();let f=R.forecast(s);const priorities=[];
  if(f.capacity-s.population<4)priorities.push('house');
  if(f.food<4)priorities.push('fishery','farm');
  if(f.knowledge<9)priorities.push('school');
  if(s.level>=3&&!s.tiles.some(t=>t.building==='clinic'))priorities.push('clinic');
  if(s.level>=3&&!s.tiles.some(t=>t.building==='barracks'))priorities.push('barracks');
  if(s.level>=2&&!s.tiles.some(t=>t.building==='market'))priorities.push('market');
  if(s.level>=2&&!s.tiles.some(t=>t.building==='mine'))priorities.push('mine');
  for(const type of priorities){s=await read();const def=R.BUILDINGS[type],t=s.tiles.find(t=>!t.building&&def.terrains.includes(t.terrain));if(t&&s.gold>=def.cost&&s.level>=def.unlock)await build(type,t);}
  s=await read();if(!s.landBought&&s.gold>75&&s.tiles.filter(t=>!t.building&&['grass','fertile','water'].includes(t.terrain)).length<4){
   let chosen=null;for(let i=0;i<3;i++)for(let r=0;r<4&&!chosen;r++)for(let y=2;y<12&&!chosen;y++)for(let x=2;x<12&&!chosen;x++)if(R.canPlaceLand(s,i,x,y,r).ok)chosen={i,r,x,y};
   if(chosen){await page.locator('[data-tab="land"]').tap();await page.locator(`[data-offer-index="${chosen.i}"]`).tap();for(let r=0;r<chosen.r;r++)await page.locator('#rotate').tap();await pointTile(chosen.x,chosen.y);await page.locator('#confirm-placement').tap();}
  }
  await season();
 }
 s=await read();assert.ok(s.level>=4,JSON.stringify({level:s.level,population:s.population,knowledge:s.knowledge}));await page.locator('#center').tap();await page.locator('[data-tab="land"]').tap();await page.screenshot({path:out+'developed-390.png'});report.push({developed:{turn:s.turn,level:s.level,population:s.population,territory:s.tiles.length,buildings:s.tiles.filter(t=>t.building).length},passed:true});
 await page.reload();await page.locator('.offer').first().waitFor();assert.deepEqual(await read(),s);await season();
 await context.close();
 for(const [w,h] of [[360,640],[844,390],[1366,900]]){
  const c=await browser.newContext({viewport:{width:w,height:h},isMobile:w<1000,hasTouch:true,reducedMotion:'reduce'});page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4198/');await page.locator('.offer').first().waitFor();await page.screenshot({path:out+`final-${w}x${h}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true);
  const controls=await page.locator('.tabs button,.offer,#next-turn,.map-controls button,#records,#reroll').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {label:e.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height};}));for(const b of controls){assert.ok(b.w>=44&&b.h>=44,JSON.stringify(b));assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=w+1&&b.y+b.h<=h+1,JSON.stringify(b));}
  await page.locator('.offer').first().tap();await page.screenshot({path:out+`placing-${w}x${h}.png`});await page.locator('#cancel-placement').tap();await page.locator('[data-tab="build"]').tap();await page.screenshot({path:out+`build-${w}x${h}.png`});
  if(w===1366){await page.locator('.tile[data-x="6"][data-y="6"]').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');assert.match(await page.locator('#panel').innerText(),/农田/);await page.screenshot({path:out+'keyboard-focus.png'});}
  report.push({viewport:[w,h],controls:'visible >=44px',reducedMotion:true});await c.close();
 }
 // Isolated damaged-save and browser-storage-denied scenarios.
 for(const mode of ['corrupt','denied','quota']){
  const c=await browser.newContext({viewport:{width:390,height:844}});await c.addInitScript(({mode,key})=>{if(mode==='corrupt')localStorage.setItem(key,'broken-original');if(mode==='denied')Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});if(mode==='quota')Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError');};},{mode,key});page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4198/');await page.locator('.offer').first().waitFor();if(mode!=='quota'){await page.locator('#recover-new').waitFor();if(mode==='corrupt')assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),'broken-original');else{await page.locator('#recover-new').click();assert.equal(await page.locator('#dialog').evaluate(e=>e.open),true);}}else{await page.locator('#next-turn').click();await page.locator('#close-dialog').click();assert.equal(await page.locator('#records').innerText(),'未保存');}await page.screenshot({path:out+`storage-${mode}.png`});report.push({storage:mode,passed:true});await c.close();
 }
 assert.deepEqual(errors,[]);await writeFile(out+'report.json',JSON.stringify({passed:true,report,errors},null,2));console.log(JSON.stringify(report,null,2));
}catch(error){await page?.screenshot({path:out+'failure.png'});await writeFile(out+'report.json',JSON.stringify({passed:false,error:error.stack,report,errors},null,2));throw error;}finally{await browser.close();}



