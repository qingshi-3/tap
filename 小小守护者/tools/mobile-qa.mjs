import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const report=[];
const variants=[
 {name:'iphone-844',width:844,height:390,iphone:true},
 {name:'iphone-reverse-844',width:844,height:390,iphone:true,native:{left:72,right:749,top:44,bottom:362}},
 {name:'android-short-568',width:568,height:320,iphone:false},
 {name:'iphone-short-568',width:568,height:320,iphone:true},
];
for(const v of variants){
 const context=await browser.newContext({viewport:{width:v.width,height:v.height},isMobile:true,hasTouch:true,reducedMotion:'reduce',userAgent:v.iphone?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'});
 if(v.native)await context.addInitScript(({w,h,s})=>{window.tap={getWindowInfo:()=>({windowWidth:w,windowHeight:h,safeArea:s})}}, {w:v.width,h:v.height,s:v.native});
 const page=await context.newPage(),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
 await page.goto('http://localhost:4184');await page.waitForFunction(()=>window.__guardians?.snapshot().ready);
 await page.screenshot({path:`output/${v.name}-home.png`});
 await page.getByRole('button',{name:'按种子开局',exact:true}).tap();await page.getByRole('button',{name:'确认',exact:true}).tap();
 const snap=()=>page.evaluate(()=>window.__guardians.snapshot());
 await page.getByRole('button',{name:/^盾卫/}).tap();
 const at=await page.evaluate(()=>window.__guardians.screenPoint({x:23.5,y:9.5}));
 await page.touchscreen.tap(at.x,at.y);assert.equal(await page.locator('#confirm-placement').isEnabled(),true);
 const session=await context.newCDPSession(page);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:at.x,y:at.y,id:1}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 assert.equal((await snap()).gold,160);assert.equal(await page.locator('#confirm-placement').isEnabled(),false);
 await page.touchscreen.tap(at.x,at.y);await page.getByRole('button',{name:'放在这里',exact:true}).tap();assert.equal((await snap()).gold,118);
 await page.screenshot({path:`output/${v.name}-selected.png`});
 await page.getByRole('button',{name:'取消选中',exact:true}).tap();
 const before=await page.evaluate(()=>window.__guardians.screenPoint({x:23,y:9}));
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:v.width/2,y:v.height/2,id:1}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:v.width/2+45,y:v.height/2+15,id:1}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.evaluate(()=>{window.__events=[];for(const t of ['pointerdown','pointerup','touchstart','touchend','click'])document.addEventListener(t,e=>window.__events.push({type:t,target:e.target.id,pointerId:e.pointerId}))});const after=await page.evaluate(()=>window.__guardians.screenPoint({x:23,y:9}));assert.notEqual(before.x,after.x);
 await page.waitForTimeout(1000);await page.getByRole('button',{name:'暂停与设置',exact:true}).tap();
 await page.screenshot({path:'output/debug-pause.png'});console.log(v.name,await snap(),await page.locator('dialog[open]').count(),await page.evaluate(()=>window.__events));await page.getByRole('button',{name:'音效：开',exact:true}).tap();
 await page.screenshot({path:`output/${v.name}-pause.png`});
 await page.getByRole('button',{name:'图鉴',exact:true}).tap();await page.screenshot({path:`output/${v.name}-codex.png`});
 await page.locator('#collection [data-close]').tap();await page.getByRole('button',{name:'继续',exact:true}).tap();
 await page.reload();await page.waitForFunction(()=>window.__guardians?.snapshot().ready);await page.getByRole('button',{name:'继续营地',exact:true}).tap();assert.equal((await snap()).gold,118);
 await page.waitForTimeout(1000);await page.getByRole('button',{name:'暂停与设置',exact:true}).tap();assert.equal(await page.getByRole('button',{name:'音效：关',exact:true}).isVisible(),true);
 await page.getByRole('button',{name:'成就',exact:true}).tap();await page.screenshot({path:`output/${v.name}-profile.png`});await page.locator('#collection [data-close]').tap();await page.getByRole('button',{name:'继续',exact:true}).tap();
 await page.getByRole('button',{name:'全景地图',exact:true}).tap();await page.screenshot({path:'output/'+v.name+'-overview.png'});const geometry=await page.evaluate(()=>({insets:Object.fromEntries(['top','right','bottom','left'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue('--host-'+k)])),overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('#hud button,#start-wave')].map(b=>({text:b.textContent,x:b.getBoundingClientRect().x,y:b.getBoundingClientRect().y,w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})),background:getComputedStyle(document.querySelector('[data-tool="shield"]')).backgroundImage}));
 assert.equal(geometry.overflow,false);assert.ok(geometry.background.includes('/assets/ui/wide-normal.png'));assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 report.push({device:v.name,checks:['new-run','deployment-preview-confirm','touch-cancel-no-charge','single-touch-pan','pause','codex','settings-reload','checkpoint-reload','profile'],geometry,errors,failed});await context.close();
}
writeFileSync('output/mobile-qa.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report.map(r=>({device:r.device,checks:r.checks,errors:r.errors,failed:r.failed})),null,2));









