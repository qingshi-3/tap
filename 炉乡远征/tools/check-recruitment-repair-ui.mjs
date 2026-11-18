import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';
import { RECRUITMENT_CONFIG } from '../dist/js/recruitment-config.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium,webkit}=require('playwright');
const out=new URL('../output/ui-repair/',import.meta.url);await mkdir(out,{recursive:true});
const report=[];
for(const kind of ['chromium','webkit']){
let browser;try{browser=await (kind==='webkit'?webkit:chromium).launch(kind==='chromium'?{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}:{});}catch(e){report.push({kind,unavailable:e.message});continue;}
for(const [width,height] of [[844,390],[568,320]]){
const ctx=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'}),page=await ctx.newPage();
const seed=new ExpeditionProgress({getItem(){return null},setItem(){}}).state;
seed.recruitment.tickets=10;seed.recruitment.fragments[RECRUITMENT_CONFIG.recipes[0].cardId]=14;
await page.addInitScript(({key,seed})=>localStorage.setItem(key,JSON.stringify(seed)),{key:SAVE_KEYS.expedition,seed});
await page.goto(process.env.RECRUITMENT_UI_BASE||'http://127.0.0.1:4213/dist/');await page.locator('[data-action="recruitment"]').tap();
await page.evaluate(()=>{document.documentElement.style.setProperty('--host-capsule-width','104px');const x=document.createElement('div');x.id='fake-capsule';x.style.cssText='position:fixed;right:0;top:0;width:104px;height:52px;background:#111c;color:white;z-index:99999;pointer-events:none';x.textContent='TapTap';document.body.append(x)});
const dialog=page.locator('.recruitment-dialog');assert.equal(await dialog.locator('.recruitment-targets button').count(),6);assert.equal(await dialog.locator('select').count(),0);
for(const item of await dialog.locator('.recruitment-targets button').all()){await item.tap();assert.equal(await item.getAttribute('aria-pressed'),'true');}
assert.match(await dialog.innerText(),/完成账号第3关/);
for(const sel of ['[data-recruitment-action="close"]','[data-recruitment-action="draw"]'])assert.ok(await dialog.locator(sel).evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth}));
assert.ok(await dialog.locator('.recruitment-balance').evaluate(el=>el.getBoundingClientRect().right<=innerWidth-104));
await page.screenshot({path:new URL(`recruit-locked-${kind}-${width}.png`,out).pathname.replace(/^\/([A-Z]:)/,'$1')});
await dialog.locator('[data-tab="craft"]').tap();await dialog.locator('.recruitment-targets button').first().tap();await dialog.locator('[data-recruitment-action="synthesize"]').tap();assert.match(await dialog.innerText(),/已加入收藏/);assert.match(await dialog.locator('[data-recruitment-action="synthesize"]').innerText(),/已拥有/);
await page.screenshot({path:new URL(`recruit-craft-${kind}-${width}.png`,out).pathname.replace(/^\/([A-Z]:)/,'$1')});
const unlocked=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEYS.expedition);unlocked.completed=['border-01','border-02','border-03'];unlocked.accountStageClaims=Object.fromEntries(unlocked.completed.map(id=>[id,'legacy']));
await page.addInitScript(({key,seed})=>localStorage.setItem(key,JSON.stringify(seed)),{key:SAVE_KEYS.expedition,seed:unlocked});await page.reload();await page.locator('[data-action="recruitment"]').waitFor();if(await page.locator('#cloud-dialog').isVisible())await page.locator('#cloud-close').tap();await page.locator('[data-action="recruitment"]').tap();
await dialog.locator('.recruitment-targets button').nth(1).tap();await dialog.locator('[data-recruitment-action="draw"]').tap();assert.match(await dialog.locator('.recruitment-notice').innerText(),/碎片 \+2/);
await dialog.locator('[data-tab="craft"]').tap();const transfer=dialog.locator('.recruitment-transfer-target');assert.equal(await transfer.count(),1);
// Swipe the actual touch scroll surface. No locator scrollIntoView may move an overflow-hidden ancestor.
const cdp=await ctx.newCDPSession(page), box=await dialog.locator('.recruitment-recipes').boundingBox();
for(let swipe=0;swipe<3;swipe++){
 const x=box.x+box.width/2,y=box.y+box.height-15,end=box.y+15;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let step=1;step<=8;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+(end-y)*step/8}]});await page.waitForTimeout(20);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(200);
}
assert.ok(await transfer.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('.recruitment-recipes').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom}),'transfer select reachable by phone swipe');
await page.screenshot({path:new URL(`recruit-transfer-entry-${kind}-${width}.png`,out).pathname.replace(/^\/([A-Z]:)/,'$1')});
await transfer.selectOption(String(RECRUITMENT_CONFIG.recipes[1].cardId));await dialog.locator('[data-recruitment-action="transfer"]').tap();assert.match(await dialog.locator('.recruitment-notice').innerText(),/1:1转移/);assert.equal(await dialog.locator('.recruitment-transfer-target').count(),0);
await page.screenshot({path:new URL(`recruit-transfer-${kind}-${width}.png`,out).pathname.replace(/^\/([A-Z]:)/,'$1')});
const close=dialog.locator('[data-recruitment-action="close"]');
const closeBox=await close.boundingBox();assert.ok(closeBox.x>=0&&closeBox.y>=0&&closeBox.y+closeBox.height<=height,'return remains in viewport after transfer');
assert.ok(await close.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el}),'return remains uncovered');
await page.touchscreen.tap(closeBox.x+closeBox.width/2,closeBox.y+closeBox.height/2);assert.equal(await dialog.isVisible(),false);
report.push({kind,width,height,checks:'6 locked previews, no single-pool select, visible touch actions, capsule clearance, real touch synthesis, unlocked draw, real phone swipe to transfer, fragment transfer and return'});await ctx.close();}
await browser.close();}
await writeFile(new URL('recruitment-report.json',out),JSON.stringify(report,null,2));console.log(report);
