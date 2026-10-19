import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {ORDERS,ITEMS,TRUCKS} from '../js/content.js';
import {unloadPath,truckFor,cellsFor} from '../js/engine.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
process.env.PLAYWRIGHT_BROWSERS_PATH=fileURLToPath(new URL('../output/browser-runtime/',import.meta.url));
const {chromium}=require('playwright');
const out=fileURLToPath(new URL('../output/qa-v2/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],report=[];let currentPage,campaignVideo;const clockStart=Date.now();
const key='cargo-packer.save.v1';
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,recordVideo:{dir:out+'video/',size:{width:390,height:844}}});
 const page=await context.newPage();currentPage=page;page.on('pageerror',e=>errors.push(e.message));const cdp=await context.newCDPSession(page);
 await page.goto('http://127.0.0.1:4197/');await page.locator('.cargo').first().waitFor();
 await page.screenshot({path:out+'01-first-load-390.png'});
 const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 const geometry=async o=>{const b=await page.locator('#board').boundingBox(),t=truckFor(o),cell=Math.min((b.width-64)/t.w,(b.height-56)/(t.h+1.9),64);return{x:b.x+(b.width-t.w*cell)/2,y:b.y+cell*1.3+10,cell,b};};
 async function touchDrag(from,to){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,id:0}]});for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12,id:0}]});await page.waitForTimeout(12);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(160);}
 async function loadCargo(o,c,p){const g=await geometry(o),loc=page.locator(`[data-cargo="${c.id}"]`);while(!await loc.count())await page.locator('#tray-next').tap();await loc.tap();for(let k=0;k<p.r;k++)await page.locator('#rotate').tap();const b=await loc.boundingBox(),cs=cellsFor(c.type,p.r),w=Math.max(...cs.map(c=>c[0]))+1,h=Math.max(...cs.map(c=>c[1]))+1;await touchDrag({x:b.x+b.width/2,y:b.y+24},{x:g.x+(p.x+w/2)*g.cell,y:g.y+(p.y+h*.55)*g.cell});const current=await read();assert.deepEqual({...current.active.placements[c.id],z:current.active.placements[c.id]?.z??0},{...p,z:p.z??0},`${o.id} ${c.id} real touch placement`);}
 // Drive the campaign through real touch: no injected placement, rewards or unlocks.
 for(let index=0;index<ORDERS.length;index++){
   const startedSeconds=(Date.now()-clockStart)/1000;const o=ORDERS[index];console.log("Playing",o.id);if(index>0){await page.locator('#result-orders').tap();const current=await read();if(!current.ownedTrucks.includes(o.truckId))await page.locator(`[data-truck="${o.truckId}"]`).tap();await page.locator(`[data-order="${o.id}"]`).tap();}
   for(const c of [...o.cargo].sort((a,b)=>(o.solution[a.id].z??0)-(o.solution[b.id].z??0)))await loadCargo(o,c,o.solution[c.id]);
   if([0,4,7,10,13,14,18,24].includes(index))await page.screenshot({path:out+`loaded-${o.id}-390.png`});
   await page.locator('#go').tap();await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).active.phase==='unloading',key);assert.equal((await read()).active.phase,'unloading');
   for(let stop=0;stop<o.stops.length;stop++){
     let current=await read();while(o.cargo.some(c=>c.stop===stop&&!current.active.delivered.includes(c.id))){const c=o.cargo.find(c=>c.stop===stop&&current.active.placements[c.id]&&unloadPath(o,current.active.placements,c.id));assert.ok(c,`${o.id} next unloadable`);const p=current.active.placements[c.id],g=await geometry(o),cell=cellsFor(c.type,p.r)[0];await page.touchscreen.tap(g.x+(p.x+cell[0]+.5)*g.cell,g.y+(p.y+cell[1]+.5-((p.z??0)===1?.16:0))*g.cell);await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key)).active.delivered.includes(id),{key,id:c.id});current=await read();}
     if(index===2&&stop===0)await page.screenshot({path:out+'multi-stop-unloaded.png'});
     await page.locator('#go').tap();if(stop<o.stops.length-1)await page.waitForFunction(({key,stop})=>JSON.parse(localStorage.getItem(key)).active.stop===stop+1,{key,stop});
   }
   await page.locator('#result-next').waitFor();const completed=await read();assert.equal(completed.active.phase,'result');assert.ok(completed.completed[o.id]);report.push({order:o.id,startedSeconds,finishedSeconds:(Date.now()-clockStart)/1000,touchLoaded:o.cargo.length,stops:o.stops.length,coins:completed.coins,stars:completed.completed[o.id].stars});
   if([0,24].includes(index))await page.screenshot({path:out+`result-${o.id}.png`});
   if(index===0){await page.reload();await page.locator('#result-next').waitFor();assert.equal((await read()).coins,completed.coins);}
 }
 await page.reload();await page.locator('#result-next').waitFor();assert.equal(Object.keys((await read()).completed).length,ORDERS.length);const finalCoins=(await read()).coins;
 await page.locator('#result-orders').tap();await page.locator('[data-order="o01"]').tap();const first=ORDERS[0];await loadCargo(first,first.cargo[0],first.solution[first.cargo[0].id]);await page.reload();await page.locator('#remove').waitFor();assert.equal(Object.keys((await read()).active.placements).length,1);await loadCargo(first,first.cargo[1],first.solution[first.cargo[1].id]);await page.reload();assert.equal(Object.keys((await read()).active.placements).length,2);assert.equal((await read()).coins,finalCoins);report.push({sameDeviceReloadContinueSave:'passed'});
 campaignVideo=await page.video().path();await context.close();
 for(const [width,height]of [[360,640],[320,568],[844,390],[390,844]]){const c=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4197/');await p.locator('.cargo').first().waitFor();await p.screenshot({path:out+`viewport-${width}x${height}.png`});const metrics=await p.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,innerWidth,innerHeight,controls:[...document.querySelectorAll('header button,#selection button,footer button,.cargo')].map(e=>{const r=e.getBoundingClientRect();return{label:e.textContent,w:r.width,h:r.height,x:r.x,y:r.y}})}));assert.ok(metrics.width<=width);assert.ok(metrics.height<=height);for(const b of metrics.controls){assert.ok(b.w>=44&&b.h>=44,JSON.stringify(b));assert.ok(b.y>=0&&b.y+b.h<=height+1,JSON.stringify(b));}await p.locator('#orders').tap();await p.screenshot({path:out+`orders-${width}x${height}.png`});report.push({viewport:[width,height],controls:'visible >=44px',reducedMotion:true});await c.close();}
 assert.deepEqual(errors,[]);await writeFile(out+'browser-report.json',JSON.stringify({passed:true,report,errors,campaignVideo},null,2));console.log('Browser QA passed',report.length);
}catch(e){await currentPage?.screenshot({path:out+'failure.png'});const visible=await currentPage?.locator('body').innerText();await writeFile(out+'browser-report.json',JSON.stringify({passed:false,error:e.stack,report,errors,visible,stored:await currentPage?.evaluate(key=>localStorage.getItem(key),key)},null,2));throw e;}finally{await browser.close();}
