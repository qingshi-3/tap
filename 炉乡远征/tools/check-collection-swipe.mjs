import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../output/ui-repair/',import.meta.url);
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const context=await browser.newContext({viewport:{width:568,height:320},hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage();await page.goto(process.env.COLLECTION_UI_BASE||'http://127.0.0.1:4226');
 await page.locator('[data-action="nav"][data-page="codex"]').tap();
 const bar=page.locator('.codex-faction-buttons'),box=await bar.boundingBox();
 const before=await bar.evaluate(e=>({scroll:e.scrollLeft,width:e.clientWidth,content:e.scrollWidth}));

 const session=await context.newCDPSession(page);await page.waitForTimeout(500);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width-18,y:box.y+22}]});
 for(let step=1;step<=8;step++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width-18-step*160/8,y:box.y+22}]});await page.waitForTimeout(40);}
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(700);
 const after=await bar.evaluate(e=>e.scrollLeft);assert.ok(after>before.scroll,'finger swipe reveals final factions');
 const taps=[];
 for(const factionId of [6,0]){
  const target=page.locator(`[data-action="codex-faction"][data-faction-id="${factionId}"]`);const r=await target.boundingBox();const b=await bar.boundingBox();
  assert.ok(r.x>=b.x&&r.x+r.width<=b.x+b.width+1,'last faction fully revealed by swipe');
  await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
  assert.equal(await target.getAttribute('aria-pressed'),'true');
  taps.push({factionId,x:r.x+r.width/2,y:r.y+r.height/2});
 }
 const viewport=await page.evaluate(()=>({scrollX,bodyScroll:document.documentElement.scrollLeft}));assert.equal(viewport.scrollX,0);assert.equal(viewport.bodyScroll,0);
 const back=await page.locator('.expedition-menu-return').boundingBox();assert.ok(back.x>=0&&back.y>=0&&back.x+back.width<=568&&back.y+back.height<=320);
 const factionLabels=await page.locator('.codex-types').innerText();assert.match(factionLabels,/全部/);
 await page.screenshot({path:fileURLToPath(new URL('collection-faction-swipe-568.png',out))});
 const evidence={width:568,height:320,before,after,taps,viewport,back,method:'CDP horizontal finger swipe, then touchscreen coordinate taps; no locator auto-scroll'};
 const report=JSON.parse(await readFile(new URL('collection-report.json',out),'utf8'));report.find(row=>row.width===568).factionSwipe=evidence;
 await writeFile(new URL('collection-report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(evidence));
}finally{await browser.close();}
