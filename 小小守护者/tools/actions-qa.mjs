import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:4184');await page.waitForFunction(()=>window.__guardians?.snapshot().ready);await page.clock.install();
await page.getByRole('button',{name:'按种子开局',exact:true}).tap();await page.getByRole('button',{name:'确认',exact:true}).tap();await page.getByRole('button',{name:'全景地图',exact:true}).tap();
const snap=()=>page.evaluate(()=>window.__guardians.snapshot());
const point=async(x,y)=>{const p=await page.evaluate(p=>window.__guardians.screenPoint(p),{x:x+.5,y:y+.5});await page.touchscreen.tap(p.x,p.y)};
const close=async()=>{const b=page.getByRole('button',{name:'取消选中',exact:true});if(await b.isVisible())await b.tap()};
async function buy(kind,x,y){await page.locator(`[data-tool="${kind}"]`).tap();await point(x,y);await page.getByRole('button',{name:'放在这里',exact:true}).tap();await close()}
await buy('archer',23,8);await buy('archer',23,12);await buy('shield',23,10);await buy('wall',18,6);
let repaired=false;
for(let wave=1;wave<=3;wave++){
 await page.getByRole('button',{name:'开战',exact:true}).tap();for(let n=0;n<40&&(await snap()).phase==='combat';n++)await page.clock.runFor(5000);assert.equal((await snap()).phase,'prep');
 await page.locator('#card-choices button').first().tap();
 await point(wave===3?25:18,6);const repair=page.locator('#context button').filter({hasText:/^修满/});if(await repair.count()&&await repair.isEnabled()){const gold=(await snap()).gold;await repair.tap();assert.ok((await snap()).gold<gold);repaired=true;await page.screenshot({path:'output/repair-qa.png'})}await close();if(wave===2)await buy('wall',25,6);
}
assert.equal(repaired,true,'A surviving damaged wall must be repaired through its button');
await page.getByRole('button',{name:'商店',exact:true}).tap();await page.locator('#shop-items button').filter({hasText:/^工程师/}).tap();await point(22,10);await page.getByRole('button',{name:'放在这里',exact:true}).tap();
await page.getByRole('button',{name:'商店',exact:true}).tap();await page.locator('#shop-items button').filter({hasText:/^治疗/}).tap();await page.locator('#shop-items button').filter({hasText:/^定身/}).tap();await page.locator('#shop [data-close]').tap();
await page.getByRole('button',{name:'开战',exact:true}).tap();await page.clock.runFor(1500);
await page.locator('[data-spell="freeze"]').tap();await page.getByRole('button',{name:'放在这里',exact:true}).tap();assert.equal(await page.locator('[data-spell="freeze"]').isDisabled(),true);
await page.locator('[data-spell="heal"]').tap();await point(23,10);await page.getByRole('button',{name:'放在这里',exact:true}).tap();assert.equal(await page.locator('[data-spell="heal"]').isDisabled(),true);
await page.screenshot({path:'output/spells-qa.png'});await page.getByRole('button',{name:'暂停与设置',exact:true}).tap();await page.getByRole('button',{name:'回放',exact:true}).tap();
const original=await page.evaluate(()=>localStorage.getItem('little-guardians-h5.run.v1'));
await page.getByRole('button',{name:'载入并观看',exact:true}).tap();await page.getByRole('button',{name:'确认',exact:true}).tap();assert.equal((await snap()).wave,1);
await page.clock.runFor(1000);assert.equal(await page.evaluate(()=>localStorage.getItem('little-guardians-h5.run.v1')),original);assert.equal((await snap()).phase,'combat');await page.screenshot({path:'output/replay-playing.png'});
assert.deepEqual(errors,[]);writeFileSync('output/actions-qa.json',JSON.stringify({paidRepair:repaired,heroPurchased:true,healChargeConsumedOnce:true,freezeChargeConsumedOnce:true,replayStartsAtFirstWave:true,replayDoesNotOverwriteCheckpoint:true,errors},null,2));await browser.close();



