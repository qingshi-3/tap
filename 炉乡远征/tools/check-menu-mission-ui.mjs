import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
await mkdir('output/menu-mission',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const results=[];
try{
for(const [width,height] of (process.env.MENU_MISSION_QUICK ? [[568,320],[844,390]] : [[568,320],[844,390],[874,402]])){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();
 await page.goto('http://127.0.0.1:4223/'); const root=page.locator('#expedition-home');await root.waitFor({state:'visible'});
 for(const b of await root.locator('.menu-destination,.menu-play,.menu-utility,.menu-faction').all()){const box=await b.boundingBox();assert.ok(box.height>=44);assert.ok(box.y>=52&&box.y+box.height<=height);}
 await page.screenshot({path:`output/menu-mission/menu-${width}.png`});
 await root.locator('[data-action="resource-rewards"]').tap();await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');
 await root.locator('.menu-play').tap();await root.locator('[data-action="chapter"]').first().tap();
 const start=root.locator('.mission-actions [data-action="adjust-loadout"]');await start.waitFor();let box=await start.boundingBox();assert.ok(box.height>=44&&box.y+box.height<=height);
 assert.equal(await root.locator('.mission-loadout,.mission-recommend').count(),0);
 const chapterHead=await root.locator('.chapter-heading').boundingBox(),chapterBack=await root.locator('.chapter-heading .inline-return').boundingBox();assert.ok(chapterHead.y<12&&Math.abs(chapterHead.y-chapterBack.y)<4);
 await page.screenshot({path:`output/menu-mission/mission-closed-${width}.png`});
 await root.locator('.mission-intel summary').tap();box=await start.boundingBox();assert.ok(box.y+box.height<=height);
 await page.screenshot({path:`output/menu-mission/mission-${width}.png`});await start.tap();assert.equal(await root.getAttribute('data-page'),'prep');
 const headbox=await root.locator('.deck-heading').boundingBox(),tabbox=await root.locator('.inventory-tabs').boundingBox(),backbox=await root.locator('[data-action="return-mission"]').boundingBox();assert.ok(Math.abs(headbox.y-tabbox.y)<4&&Math.abs(backbox.y-tabbox.y)<4&&headbox.y<12);assert.equal(await root.evaluate(e=>getComputedStyle(e).gridTemplateRows.split(' ').length),1);
 await page.screenshot({path:`output/menu-mission/prep-${width}.png`});
 const cdp=await context.newCDPSession(page);
 async function swipe(selector,vertical){const box=await root.locator(selector).boundingBox();const x=box.x+box.width/2,y=box.y+box.height-8;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let k=1;k<=6;k++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:vertical?x:x-k*8,y:vertical?y-k*Math.min(15,(box.height-16)/6):y}]});await page.waitForTimeout(20);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(600);}
 for(const selector of ['.deck-card-list','.training-roster']){await swipe(selector,false);assert.equal(await root.locator(selector).evaluate(e=>e.scrollLeft),0);await swipe(selector,true);assert.ok(await root.locator(selector).evaluate(e=>e.scrollTop)>0);}
 await root.locator('.deck-card-list').evaluate(e=>e.scrollTop=0);

 for(const selector of ['.deck-card-list','.training-roster']){const metrics=await root.locator(selector).evaluate(e=>({width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight}));assert.equal(metrics.width,metrics.scrollWidth);assert.ok(metrics.height>=44);}
 await root.locator('[data-action="inventory-tab"][data-tab="spells"]').tap();await root.locator('.spell-card-open').first().waitFor();await root.locator('[data-action="inventory-tab"][data-tab="units"]').tap();await root.locator('.training-roster .training-card-open').first().tap();await root.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');await root.locator('dialog[open]').waitFor({state:'hidden'});
 const minus=root.locator('.deck-card-row [data-action="deck-remove"]').first();await minus.tap();assert.equal(await root.locator('.deck-total').innerText(),'29/30');assert.ok(await root.locator('.prep-start').isDisabled());await root.locator('.deck-card-row [data-action="deck-add"]').first().tap();await root.locator('[data-action="deck-save"]').tap();assert.equal(await root.locator('.deck-total').innerText(),'30/30');assert.equal(await root.locator('.prep-start').isDisabled(),false);
 await root.locator('[data-action="return-mission"]').tap();assert.equal(await root.getAttribute('data-page'),'expedition');
 await root.locator('[data-action="level"]').nth(1).tap();assert.ok(await start.isDisabled());
 await root.locator('[data-action="level"]').first().tap();await page.keyboard.press('Tab');await start.focus();assert.equal(await start.evaluate(e=>e.matches(':focus-visible')),true);
 results.push(`${width}x${height}: new menu resources tap, fixed mission actions, prep vertical touch scroll/no horizontal overflow, tabs, deck +/- save, locked preview, focus/reduced motion`);if(width===568){
 await start.tap();await root.locator('[data-action="start"]').tap();await page.locator('#objective-close').tap();await page.locator('#leave-match').tap();await page.locator('#confirm-accept').tap();
 if(await root.getAttribute('data-page')!=='menu') await root.locator('[data-action="nav"][data-page="menu"]').tap();assert.equal(await root.locator('.menu-play').innerText(),'继续战斗');
 await root.locator('[data-action="select-faction"]').nth(1).tap();assert.equal(await root.locator('.menu-play').innerText(),'出征');assert.ok(await root.locator('.menu-other-resume').isVisible());
 await page.screenshot({path:'output/menu-mission/other-resume-568.png'});await root.locator('.menu-play').tap();await root.locator('[data-action="chapter"]').first().tap();assert.equal(await root.locator('.expedition-resume').count(),0);assert.equal(await root.locator('.expedition-topbar [data-action="nav"][data-page="menu"]').count(),0);await root.locator('[data-action="back"]').tap();await root.locator('[data-action="nav"][data-page="menu"]').tap();await root.locator('.menu-other-resume').tap();await page.locator('#leave-match').waitFor({state:'visible'});results.push('Same faction continue and other faction resume, actual match entry/exit');
 }
 await context.close();
}
if(!process.env.MENU_MISSION_QUICK){
const fixture=JSON.parse(await readFile('games/duelyst-h5/tools/fixtures/save-contract-profile8-pre-daily-2026-10-13.json','utf8')).profiles[0];
const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});await context.addInitScript(value=>localStorage.setItem('duelyst-h5.safe-v1.expedition',JSON.stringify(value)),fixture);const page=await context.newPage();await page.goto('http://127.0.0.1:4223/');const root=page.locator('#expedition-home');await root.locator('.menu-play').tap();
const chapters=root.locator('[data-action="chapter"]');const count=await chapters.count();for(let i=0;i<count;i++){await chapters.nth(i).tap();const actions=root.locator('.mission-actions');assert.ok(await actions.isVisible());const box=await actions.boundingBox();assert.ok(box.y+box.height<=390);await root.locator('[data-action="back"]').tap();}results.push(`${count} chapter previews with historical profile migration`);await context.close();
}
}finally{await browser.close();}
await writeFile('output/menu-mission/results.json',JSON.stringify(results,null,2));console.log(results);
