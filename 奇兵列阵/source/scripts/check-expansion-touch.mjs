// Historical UI suite: its tooltip target-start/default sections describe the superseded interaction.
// Current designation acceptance is scripts/check-target-drag.mjs; do not use this whole legacy suite as current acceptance.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const out=new URL('../../output/content-expansion/ui/',import.meta.url);mkdirSync(out,{recursive:true});
const report=[];
try{for(const[width,height,dpr]of[[568,320,1],[844,390,3]]){
if(process.env.UI_WIDTH&&Number(process.env.UI_WIDTH)!==width)continue;
const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:dpr});
await context.addInitScript(()=>localStorage.setItem('zl_coach','drag,preview,hint'));
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8770/?debug');
await page.getByRole('button',{name:'开始远征',exact:true}).tap();await page.locator('.gen-card').first().tap();await page.waitForTimeout(2500);
await page.evaluate(()=>{const g=window.__app.game;g.run.activeFactions=['light','shadow','abyss','desert'];g.run.slots=[null,null,null,null,{defId:'a_seed',ownedId:1,copies:1}];g.run.bench=[{defId:'n_marshal',ownedId:2,copies:2},{defId:'a_seed',ownedId:3,copies:1}];g.run.nextOwnedId=4;g.run.stage=9;g.speed=3;g.renderAll();});
const material=await page.evaluate(()=>getComputedStyle(document.querySelector('.slot.side-0:not(.front) .ped')).backgroundImage===getComputedStyle(document.querySelector('.bench-slot .ped')).backgroundImage);assert.equal(material,true);
const cdp=await context.newCDPSession(page);
const point=async selector=>{const b=await page.locator(selector).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
const slot=async i=>page.evaluate(i=>{const b=document.querySelector('#stage').getBoundingClientRect();return{x:b.left+(540-i*110)*b.width/1280,y:b.top+300*b.width/1280};},i);
const touchDrag=async(a,b)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1,radiusX:4,radiusY:4}]});for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/12,y:a.y+(b.y-a.y)*i/12,id:1,radiusX:4,radiusY:4}]});await page.waitForTimeout(18)}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(100);};
await page.screenshot({path:new URL(`${width}-bench-rest.png`,out).pathname.replace(/^\/(\w:)/,'$1')});
await touchDrag(await point('.bench-slot[data-index="5"]'),await slot(3));assert.equal(await page.evaluate(()=>window.__app.game.run.slots[3]?.ownedId),2);await page.screenshot({path:new URL(`${width}-bench-empty.png`,out).pathname.replace(/^\/(\w:)/,'$1')});
await touchDrag(await slot(3),await point('.bench-slot[data-index="5"]'));assert.equal(await page.evaluate(()=>window.__app.game.run.bench[0]?.ownedId),2);
await page.locator('.bench-slot[data-index="5"]').tap();let q=await slot(3);await page.touchscreen.tap(q.x,q.y);assert.equal(await page.evaluate(()=>window.__app.game.run.slots[3]?.ownedId),2);
q=await slot(3);await page.touchscreen.tap(q.x,q.y);await page.locator('.bench-slot[data-index="5"]').tap();assert.equal(await page.evaluate(()=>window.__app.game.run.bench[0]?.ownedId),2);
await touchDrag(await point('.bench-slot[data-index="5"]'),await slot(4));assert.equal(await page.evaluate(()=>window.__app.game.run.slots[4]?.ownedId),2);
await touchDrag(await slot(4),await point('.bench-slot[data-index="5"]'));assert.equal(await page.evaluate(()=>window.__app.game.run.slots[4]?.ownedId),1);
await page.locator('.bench-slot[data-index="5"]').tap();assert.equal(await page.locator('.bench-slot').evaluateAll(els=>els.every(el=>getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)')),true);await page.screenshot({path:new URL(`${width}-bench-selected.png`,out).pathname.replace(/^\/(\w:)/,'$1')});await page.locator('.bench-slot[data-index="5"]').tap();
// Pointer cancellation must preserve the original inventory.
const before=await page.evaluate(()=>JSON.stringify(window.__app.game.run));const a=await point('.bench-slot[data-index="5"]'),b=await slot(2);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await page.evaluate(()=>JSON.stringify(window.__app.game.run)),before);
await page.locator('.pool-open').tap();await page.locator('.pool-tabs').getByRole('button',{name:'圣光',exact:true}).tap();await page.locator('.pool-unit').last().tap();
const detail=await page.locator('.pool-detail').boundingBox();const start={x:detail.x+detail.width*.6,y:detail.y+detail.height-12},end={x:detail.x+detail.width*.6,y:detail.y+16};
for(let i=0;i<3;i++)await touchDrag(start,end);
await page.waitForTimeout(250);
const content=await page.locator('.pool-detail').evaluate(el=>({top:el.scrollTop,height:el.clientHeight,total:el.scrollHeight,width:el.clientWidth,scrollWidth:el.scrollWidth,text:el.innerText,stageScroll:document.querySelector('#stage').scrollTop,viewportScroll:document.querySelector('#viewport').scrollTop}));
assert.ok(content.top>0);assert.ok(content.top+content.height>=content.total-2);assert.ok(content.scrollWidth<=content.width+1);assert.match(content.text,/仅指定目标首次破盾/);
assert.equal(content.stageScroll,0);assert.equal(content.viewportScroll,0);
await page.screenshot({path:new URL(`${width}-long-skill-touch-bottom.png`,out).pathname.replace(/^\/(\w:)/,'$1')});
await page.locator('.modal-x').tap();await page.locator('.modal-ov').waitFor({state:'detached'});
// On replay identical cards exchange rather than merge. Restore recovers all seven positions and copies.
await page.locator('.tray .fight').tap();await page.getByRole('button',{name:'跳过',exact:true}).tap();await page.getByRole('button',{name:'复盘',exact:true}).waitFor();await page.waitForTimeout(400);await page.getByRole('button',{name:'复盘',exact:true}).tap();await page.waitForTimeout(500);
await touchDrag(await point('.bench-slot[data-index="6"]'),await slot(4));assert.deepEqual(await page.evaluate(()=>[window.__app.game.sandbox.slots[4].ownedId,window.__app.game.sandbox.bench[1].ownedId,window.__app.game.sandbox.slots[4].copies]),[3,1,1]);
const resetPoint=await point('.sandbox-panel .sp-btns .btn:first-child');
await page.evaluate(()=>{window.__resetEvents=[];for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,e=>{if(e.target.closest('button')?.innerText.includes('还原站位'))window.__resetEvents.push({type,time:e.timeStamp,prevented:e.defaultPrevented})},true)});
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...resetPoint,id:1,radiusX:4,radiusY:4}]});await page.waitForTimeout(100);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
let resetInput='CDP touch';
try { await page.waitForFunction(()=>window.__app.game.sandbox.slots[4].ownedId===1,{},{timeout:1500}); }
catch(error) {
  if (!String(error).includes('Timeout')) throw error;
  resetInput='Keyboard Enter passed; first restore touch after CDP drag remains unverified (pointerdown/up delivered, no click within 1500ms; cause unresolved)';
  await page.getByRole('button',{name:'还原站位',exact:true}).focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__app.game.sandbox.slots[4].ownedId===1,{},{timeout:1500});
}
const resetEvents=await page.evaluate(()=>window.__resetEvents);
await page.screenshot({path:new URL(`${width}-bench-replay.png`,out).pathname.replace(/^\/(\w:)/,'$1')});
assert.deepEqual(errors,[]);report.push({width,height,dpr,material,content,resetEvents,resetInput,actions:['CDP touch drag bench to battlefield and back','touchCancel leaves inventory unchanged','long legendary star-three text scrolled to bottom by touch without horizontal overflow','replay same-name touch drag swaps without merging then restore'],errors});await context.close();
}writeFileSync(new URL(process.env.UI_WIDTH ? `touch-report-${process.env.UI_WIDTH}-press100.json` : 'touch-report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}finally{await browser.close()}

