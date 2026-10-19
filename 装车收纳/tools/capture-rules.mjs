import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {ORDERS,TRUCKS} from '../js/content.js';
import {cellsFor,truckFor,unloadPath} from '../js/engine.js';
import {freshSave,validateSave,SAVE_KEY} from '../js/persistence.js';
process.env.PLAYWRIGHT_BROWSERS_PATH=fileURLToPath(new URL('../output/browser-runtime/',import.meta.url));
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),out=fileURLToPath(new URL('../output/qa-v2/',import.meta.url));
await mkdir(out+'rules-video/',{recursive:true});
// The initial unlocked order is a disclosed isolated fixture. Every cargo move,
// rejection, departure and unloading in this recording is actual touch input.
const o=ORDERS[7],seed=freshSave();seed.sound=false;seed.coins=756;
seed.ownedTrucks=TRUCKS.slice(0,2).map(t=>t.id);
seed.completed=Object.fromEntries(ORDERS.slice(0,7).map(o=>[o.id,{stars:3,reward:o.reward+30}]));
seed.active={orderId:o.id,contentVersion:2,phase:'loading',placements:{},stop:0,delivered:[],moves:0,hints:0,paid:false};validateSave(seed);
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,recordVideo:{dir:out+'rules-video/',size:{width:390,height:844}}});
await context.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key:SAVE_KEY,seed});
const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];page.on('pageerror',e=>errors.push(e.message));
const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);
async function geometry(){const b=await page.locator('#board').boundingBox(),t=truckFor(o),cell=Math.min((b.width-64)/t.w,(b.height-56)/(t.h+1.9),64);return{x:b.x+(b.width-t.w*cell)/2,y:b.y+cell*1.3+10,cell};}
async function drag(from,to){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:0}]});for(let i=1;i<=20;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/20,y:from.y+(to.y-from.y)*i/20,id:0}]});await page.waitForTimeout(22);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);}
try{
 await page.goto('http://127.0.0.1:4197/');await page.locator('.cargo').first().waitFor();
 for(const c of [...o.cargo].sort((a,b)=>(o.solution[a.id].z??0)-(o.solution[b.id].z??0))){
  const p=o.solution[c.id],loc=page.locator(`[data-cargo="${c.id}"]`);
  while(!await loc.count())await page.locator('#tray-next').tap();await loc.tap();
  for(let r=0;r<p.r;r++){await page.locator('#rotate').tap();await page.waitForTimeout(180);}
  const b=await loc.boundingBox(),g=await geometry(),cs=cellsFor(c.type,p.r),w=Math.max(...cs.map(p=>p[0]))+1,h=Math.max(...cs.map(p=>p[1]))+1;
  await drag({x:b.x+b.width/2,y:b.y+24},{x:g.x+(p.x+w/2)*g.cell,y:g.y+(p.y+h*.55)*g.cell});
  assert.deepEqual((await read()).active.placements[c.id],p);
 }
 await page.waitForTimeout(3600);await page.screenshot({path:out+'rules-loaded-o08-current.png'});
 const c=o.cargo.find(c=>c.type==='crate'),p=o.solution[c.id],vase=o.cargo.find(c=>c.type==='vase'&&!o.solution[c.id].z),v=o.solution[vase.id],g=await geometry(),before=await read();
 await drag({x:g.x+(p.x+.5)*g.cell,y:g.y+(p.y+.5)*g.cell},{x:g.x+(v.x+.5)*g.cell,y:g.y+(v.y+.55)*g.cell});
 assert.deepEqual(await read(),before);assert.match(await page.locator('#bubble').innerText(),/易碎|不能/);
 await page.screenshot({path:out+'rules-crush-rejected-current.png'});await page.waitForTimeout(2100);
 await page.locator('#go').tap();await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).active.phase==='unloading',SAVE_KEY);
 let state=await read();
 while(state.active.delivered.length<o.cargo.length){const c=o.cargo.find(c=>state.active.placements[c.id]&&unloadPath(o,state.active.placements,c.id)),p=state.active.placements[c.id],g=await geometry(),[dx,dy]=cellsFor(c.type,p.r)[0];await page.touchscreen.tap(g.x+(p.x+dx+.5)*g.cell,g.y+(p.y+dy+.5-(p.z?.16:0))*g.cell);await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key)).active.delivered.includes(id),{key:SAVE_KEY,id:c.id});await page.waitForTimeout(220);state=await read();}
 await page.locator('#go').tap();await page.locator('#result-next').waitFor();await page.waitForTimeout(1200);
 const video=await page.video().path();assert.deepEqual(errors,[]);await context.close();
 await writeFile(out+'rules-video.json',JSON.stringify({passed:true,video,order:o.id,fixture:'isolated unlocked order 8; all recorded interactions are real touch, no placement or reward injection',errors},null,2));console.log(video);
}finally{await browser.close();}
