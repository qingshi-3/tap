import { chromium } from 'file:///C:/Users/qs/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const out=new URL('../output/qa/optimization/campaign/',import.meta.url);mkdirSync(out,{recursive:true});
const path=n=>fileURLToPath(new URL(n,out));
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage(),errors=[],report={checks:[],days:[]};page.on('pageerror',e=>errors.push(e.message));
await page.clock.install();await page.goto('http://127.0.0.1:4196');await page.getByRole('button',{name:'接下小站',exact:true}).click();
const raw=()=>page.evaluate(()=>localStorage.getItem('courier-depot.save.v1'));
const snap=n=>page.screenshot({path:path(n)});
const cdp=await context.newCDPSession(page); async function tapAt(locator){const b=await locator.boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);}
async function touchDrag(from,to){const a=await from.boundingBox(),b=to?await to.boundingBox():{x:8,y:150,width:1,height:1};let x=a.x+a.width/2,y=a.y+a.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(b.x+b.width/2-x)*i/8,y:y+(b.y+b.height/2-y)*i/8,id:1}]})}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
await page.getByRole('button',{name:'开门营业',exact:true}).click();
const firstParcelId=await page.locator('.parcel').first().getAttribute('data-id');
let parcel=page.locator(`.parcel[data-id="${firstParcelId}"]`);await touchDrag(parcel,null);assert.equal(await parcel.count(),1);report.checks.push('真实触摸拖出入口取消，包裹保留');
await tapAt(parcel);await page.locator('#targets [data-dest="1"]').tap();assert.match(await page.locator('#toast').innerText(),/目的地/);assert.equal(await parcel.count(),1);report.checks.push('错误目的地保留包裹并提示正确线路');
await touchDrag(parcel,page.locator('#targets [data-dest="0"]'));await page.clock.runFor(200);assert.equal(await parcel.count(),0);report.checks.push('真实触摸拖入正确入口，员工接手');await snap('touch-sorted-390.png');
await page.clock.runFor(5000);await page.reload();await page.waitForSelector('.parcel');assert.match(await page.locator('#day').innerText(),/第 1 天/);report.checks.push('首日中途保存与重进继续');
let iterations=0;
while(iterations++<1300){const running=await page.locator('#main-action').innerText();const dayText=await page.locator('#day').innerText(),day=+dayText.match(/\d+/)[0];
 if(await page.locator('#sheet[open]').count()){
  if(await page.getByRole('button',{name:'继续自由营业',exact:true}).count()){await snap('ending.png');await page.getByRole('button',{name:'继续自由营业',exact:true}).click();report.checks.push('18天真实输入主线完成并进入自由营业');break;}
  if(await page.getByRole('button',{name:'准备明天',exact:true}).count()){console.log('completed day',day);report.days.push({day,text:await page.locator('#sheet-content').innerText()});await page.getByRole('button',{name:'准备明天',exact:true}).click();continue;}
  if(await page.getByRole('button',{name:'开门营业',exact:true}).count()){
   if([2,4,7,10,13,14].includes(day)){await page.getByRole('button',{name:'添置设备',exact:true}).click();await snap(`day-${day}-shop.png`);const buys=page.locator('[data-buy]:not([disabled])');while(await buys.count()){await buys.first().click()}await page.getByRole('button',{name:'返回接单',exact:true}).last().click();}
   if([3,7,13,18].includes(day)){writeFileSync(path(`day-${day}-save.json`),await raw());await snap(`day-${day}-plan.png`)}
   await page.getByRole('button',{name:'开门营业',exact:true}).click();continue;
  }
  throw Error('Unexpected modal '+await page.locator('#sheet-content').innerText());
 }
 // Process a stable ID snapshot so a new arrival never substitutes for the parcel
 // whose successful sort is being checked. Busy specials do not block normal work.
 const parcelIds=await page.locator('.parcel').evaluateAll(nodes=>nodes.map(node=>node.dataset.id));
 for(const id of parcelIds){
  const p=page.locator(`.parcel[data-id="${id}"]`);if(!await p.count())continue;
  const dest=await p.getAttribute('data-dest'),kind=await p.getAttribute('data-kind');await tapAt(p);
  const prepare=page.locator('#prepare');
  if(await prepare.isVisible()){
   if(await prepare.isEnabled()){
    if(day===3)await snap('fragile-before.png');
    await prepare.tap();
   }
   continue;
  }
  if([7,13,18].includes(day)&&!report.checks.includes(`day${day}render`)){await snap(`day-${day}-play.png`);report.checks.push(`day${day}render`)}
  await page.locator(`#targets [data-dest="${dest}"]`).tap();
  assert.equal(await p.count(),0,`day ${day} parcel ${id} must leave belt after sorting`);
  report.checks.push(`第${day}天 ${kind} ${id}已分拣`);
 }
 await page.clock.runFor(2000);
}
assert.ok(iterations<1300,'Campaign terminates');
await page.getByRole('button',{name:'开门营业',exact:true}).click();await page.clock.runFor(4000);await page.reload();assert.match(await page.locator('#day').innerText(),/19/);
const freeplayId=await page.locator('.parcel').first().getAttribute('data-id');
const freeplayParcel=page.locator(`.parcel[data-id="${freeplayId}"]`);
await tapAt(freeplayParcel);
// A running job remains selected and visible until completion; only enabled
// PREPARE starts work. Advancing the clock here exercises actual saved UI work.
let freeplayWait=0;
while(await page.locator('#prepare').isVisible()&&freeplayWait++<100){
 if(await page.locator('#prepare').isEnabled())await page.locator('#prepare').tap();
 await page.clock.runFor(100);
}
assert.ok(freeplayWait<100,'freeplay workbench completes');
assert.equal(await freeplayParcel.count(),1,'prepared parcel remains on belt');
const d=await freeplayParcel.getAttribute('data-dest');await page.locator(`#targets [data-dest="${d}"]`).tap();
assert.equal(await freeplayParcel.count(),0,'freeplay parcel really sorted');
await page.reload();assert.match(await page.locator('#day').innerText(),/19/);
assert.equal(await page.locator(`.parcel[data-id="${freeplayId}"]`).count(),0,'sorted parcel stays sorted after reload');
report.checks.push('自由营业加载→完成处理并分拣→保存→重进→再保存');
for(const [w,h] of [[360,640],[320,568],[390,844],[844,390]]){await page.setViewportSize({width:w,height:h});await page.locator('#menu').click();await snap(`viewport-${w}x${h}.png`);await page.getByRole('button',{name:'继续经营',exact:true}).click();await snap(`yard-${w}x${h}.png`);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,`${w} horizontal overflow`)}
await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#menu').click();assert.match(await page.locator('#sheet-content').innerText(),/减少动效/);await page.keyboard.press('Tab');await snap('reduced-focus.png');await page.keyboard.press('Escape');report.checks.push('四种视口与减少动效、键盘焦点');
const corrupt=await browser.newContext();const p2=await corrupt.newPage();await p2.goto('http://127.0.0.1:4196');await p2.evaluate(()=>localStorage.setItem('courier-depot.save.v1','{"schema":999,"keep":"original"}'));await p2.reload();assert.match(await p2.locator('#sheet-content').innerText(),/存档需要处理/);assert.equal(await p2.evaluate(()=>localStorage.getItem('courier-depot.save.v1')),'{"schema":999,"keep":"original"}');report.checks.push('未知未来存档拒绝覆盖且保留原文');await corrupt.close();
report.errors=errors;assert.deepEqual(errors,[]);writeFileSync(path('full-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({iterations,days:report.days.length,checks:report.checks.length,errors}));await browser.close();


