import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:4184');await page.waitForFunction(()=>window.__guardians?.snapshot().ready);
await page.screenshot({path:'output/home-844.png'});
await page.getByRole('button',{name:'按种子开局',exact:true}).tap();await page.getByRole('button',{name:'确认',exact:true}).tap();
await page.screenshot({path:'output/prep-844.png'});
await page.getByRole('button',{name:/^盾卫/}).tap();
const target=await page.evaluate(()=>window.__guardians.screenPoint({x:23.5,y:9.5}));await page.touchscreen.tap(target.x,target.y);
await page.screenshot({path:'output/place-844.png'});
await page.getByRole('button',{name:'放在这里',exact:true}).tap();
await page.screenshot({path:'output/selected-844.png'});
console.log(JSON.stringify({errors,state:await page.evaluate(()=>window.__guardians.snapshot()),buttons:await page.locator('button:visible').evaluateAll(bs=>bs.map(b=>({text:b.textContent,rect:JSON.stringify(b.getBoundingClientRect().toJSON())})))},null,2));
await browser.close();

