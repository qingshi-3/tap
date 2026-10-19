import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='output/qa-generated-art/';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),requests=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();page.on('request',r=>{if(r.url().includes('/assets/'))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4198');await page.locator('.offer').first().waitFor();await page.waitForTimeout(180);
 assert.ok(requests.some(u=>u.endsWith('/generated/buildings.png')));assert.ok(requests.some(u=>u.endsWith('/generated/terrain.png')));assert.ok(requests.some(u=>u.endsWith('/generated/resources.png')));assert.equal(requests.some(u=>u.includes('/world/')),false);assert.deepEqual(errors,[]);
 await page.screenshot({path:out+'land-390.png'});await page.locator('#skip-land').tap();await page.waitForTimeout(160);await page.screenshot({path:out+'buildings-390.png'});await page.locator('#close-market').tap();await page.waitForTimeout(160);await page.screenshot({path:out+'map-390.png'});
 const art=await page.evaluate(async()=>{const {loadArt}=await import('/art.js');return loadArt();});assert.equal(art.loaded,3);
 const gallery=await browser.newContext({viewport:{width:960,height:760}}),preview=await gallery.newPage();
 const html=(await readFile('tests/art/preview.html','utf8')).replace('../../dist/art.js','/art.js');
 await preview.route('**/__art-preview',route=>route.fulfill({contentType:'text/html',body:html}));
 await preview.goto('http://127.0.0.1:4198/__art-preview');await preview.waitForFunction(()=>document.body.dataset.ready==='true');
 await preview.screenshot({path:out+'gallery-forest.png'});
 await preview.locator('#tier').click();await preview.locator('#background').click();
 assert.equal(await preview.locator('#tier').textContent(),'建筑等级 2');
 assert.equal(await preview.locator('#background').textContent(),'建筑底层 水域');
 await preview.screenshot({path:out+'gallery-water.png'});await gallery.close();
 await writeFile(out+'report.json',JSON.stringify({passed:true,requests,errors,art,generatedOnly:true,gallery:{buildings:[48,64],resources:[24,40],backings:['forest','water']}},null,2));console.log('Generated images loaded; no legacy material requests. Gallery rendered and controls exercised.');await context.close();
}finally{await browser.close();}
