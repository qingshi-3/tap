import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../output/ui-repair/',import.meta.url); await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const results=[];
try{for(const [width,height] of [[844,390],[568,320]]){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(process.env.COLLECTION_UI_BASE||'http://127.0.0.1:4213');
 await page.locator('[data-action="nav"][data-page="codex"]').tap();
 const factions=page.locator('[data-action="codex-faction"]');
 for(let i=0;i<7;i++){await factions.nth(i).tap();assert.equal(await factions.nth(i).getAttribute('aria-pressed'),'true');}
 for(const type of ['unit','spell','general','all']){const button=page.locator(`[data-action="codex-filter"][data-filter="${type}"]`);await button.tap();assert.equal(await button.getAttribute('aria-pressed'),'true');}
 for(const scope of ['all','owned','all']){const button=page.locator(`[data-action="collection-scope"][data-scope="${scope}"]`);await button.tap();assert.equal(await button.getAttribute('aria-pressed'),'true');}
 await factions.nth(0).tap();
 const bounds=await page.locator('.expedition-codex-filters button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {label:b.getAttribute('aria-label')||b.textContent,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}));
 for(const b of bounds)assert.ok(b.x>=0&&b.y>=0&&b.right<=width&&b.bottom<=height&&b.w>=44&&b.h>=44,JSON.stringify(b));
 await page.screenshot({path:new URL(`collection-${width}.png`,out).pathname.replace(/^\/(\w:)/,'$1')});
 const rail=page.locator('.expedition-codex-rail');const before=await rail.evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight}));
 const box=await rail.boundingBox();const session=await context.newCDPSession(page);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height-12}]});
 for(let step=1;step<=8;step++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height-12-step*(box.height-30)/8}]});await page.waitForTimeout(40);}
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
 const scrolled=await rail.evaluate(e=>e.scrollTop);if(before.scroll>before.height)assert.ok(scrolled>0,'touch scroll moves card rail');
 await page.waitForTimeout(700); await page.locator('.expedition-menu-return').tap();await page.locator('[data-action="nav"][data-page="codex"]').tap();await page.waitForTimeout(500);const cardBox=await page.locator('.expedition-codex-card').first().boundingBox();await page.touchscreen.tap(cardBox.x+cardBox.width/2,Math.max(cardBox.y+45,110));await page.locator('.expedition-card-dialog[open]').waitFor();
 await page.screenshot({path:new URL(`collection-detail-${width}.png`,out).pathname.replace(/^\/(\w:)/,'$1')});
 await page.locator('[data-action="close-card"]').tap();await page.locator('.expedition-menu-return').tap();await page.locator('.menu-faction-grid').waitFor();
 await page.locator('.menu-faction').nth(1).tap();assert.equal(await page.locator('.menu-faction').nth(1).getAttribute('aria-pressed'),'true');
 await page.screenshot({path:new URL(`collection-home-${width}.png`,out).pathname.replace(/^\/(\w:)/,'$1')});
 assert.deepEqual(errors,[]);results.push({width,height,bounds,rail:before,scrolled,errors});await context.close();
 }}finally{await browser.close();}
await writeFile(new URL('collection-report.json',out),JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({width,height,scrolled})=>({width,height,scrolled}))));
