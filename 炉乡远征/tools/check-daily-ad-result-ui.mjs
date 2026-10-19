import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch,confirmMulligan} from '../dist/js/engine.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'),{chromium}=require('playwright');
const memory={data:new Map(),getItem(k){return this.data.get(k)??null},setItem(k,v){this.data.set(k,v)},removeItem(k){this.data.delete(k)}};
const progress=new ExpeditionProgress(memory),seed=progress.state,battle=createExpeditionMatch('border-01',seed.training,seed.squad,seed.selectedHeroId,progress.getBattleLoadout());
assert.ok(progress.saveBattle(battle).ok);confirmMulligan(battle);
const player=battle.units.find(u=>u.owner===0&&u.cardId===1),enemy=battle.units.find(u=>u.owner===1&&u.cardId===battle.players[1].generalId);
battle.units=[player,enemy];player.x=4;player.y=2;enemy.x=5;enemy.y=2;enemy.health=1;assert.ok(progress.saveBattle(battle).ok);
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(({seed,key})=>{
  if(!sessionStorage.getItem('daily-result-seeded')){localStorage.setItem(key,JSON.stringify(seed));sessionStorage.setItem('daily-result-seeded','1')}
  window.__adCount=0;window.tap={createRewardedVideoAd(){let close,loaded;return{load:()=>{queueMicrotask(()=>loaded?.());return Promise.resolve()},onLoad(fn){loaded=fn},offLoad(){loaded=null},show:()=>{window.__adCount++;setTimeout(()=>close?.({isEnded:true}),30);return Promise.resolve()},onClose(fn){close=fn},offClose(){close=null},onError(){},offError(){},destroy(){}}}};
 },{seed:progress.state,key:SAVE_KEYS.expedition});
 await page.addInitScript(async()=>{const{BoardRenderer}=await import('/js/renderer.js'),original=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__dailyRenderer=this;return original.apply(this,args)}});
 await page.goto('http://127.0.0.1:4223/');await page.locator('.menu-play').tap();await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__dailyRenderer?.ready);await page.locator('#focus-general').tap();
 for(const id of [player.unitId,enemy.unitId]){
  const point=await page.evaluate(id=>{const r=window.__dailyRenderer,box=r.canvas.getBoundingClientRect(),metrics=r.boardMetrics(box.width,box.height),u=r.state.units.find(u=>u.unitId===id),c=r.cellGeometry(metrics,u.x,u.y).center;for(const delta of [0,-8,-16,8]){const x=box.left+c.x,y=box.top+c.y+delta,cell=r.positionFromPointer({clientX:x,clientY:y});if(document.elementFromPoint(x,y)===r.canvas&&cell?.x===u.x&&cell?.y===u.y)return{x,y}}return null},id);
  assert.ok(point);await page.touchscreen.tap(point.x,point.y);await page.waitForFunction(()=>window.__dailyRenderer.state.phase==='over'||!document.querySelector('#end-turn').disabled);
 }
 await page.locator('#result-ad-reward').waitFor({state:'visible'});assert.match(await page.locator('#result-ad-reward').innerText(),/100.*1000/);
 const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).coins,SAVE_KEYS.expedition);await page.locator('#result-ad-reward').tap();await page.waitForFunction(()=>document.querySelector('#result-ad-status').textContent.includes('已获得'));
 const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEYS.expedition);assert.ok([100,200,500,1000].includes(after.coins-before));assert.equal(await page.evaluate(()=>window.__adCount),1);
 await page.locator('.reward-presentation').waitFor({state:'visible'});assert.equal(await page.locator('.reward-presentation-amount').innerText(),`+${after.coins-before} 金币`);await page.screenshot({path:'output/reward-presentation/battle-success.png'});await page.locator('.reward-presentation-continue').tap();assert.equal(await page.locator('.reward-presentation').isVisible(),false);
 await page.locator('#back-to-lobby').tap();if(await page.locator('[data-action=nav][data-page=menu]').count())await page.locator('[data-action=nav][data-page=menu]').first().tap();await page.locator('[data-action=resource-rewards]').tap();assert.equal(await page.locator('[data-reward-action=gold]').isDisabled(),true);assert.match(await page.locator('[data-reward-kind=gold]').innerText(),/今日已领取/);assert.equal(await page.locator('[data-reward-action=orb]').isDisabled(),false);assert.doesNotMatch(await page.locator('.resource-rewards-dialog').innerText(),/余额|来源|通关/);
 await mkdir(new URL('../output/resource-rewards/',import.meta.url),{recursive:true});await page.screenshot({path:'output/resource-rewards/result-shared-daily.png'});assert.deepEqual(errors,[]);await writeFile(new URL('../output/resource-rewards/result-report.json',import.meta.url),JSON.stringify({passed:true,coinsAwarded:after.coins-before,adCount:1,checks:['real-select-attack-victory','result-random-gold','committed-amount-visible-popup','touch-dismiss-popup','menu-gold-disabled','orb-still-eligible','shared-daily-ledger'],errors},null,2));console.log('Full app daily result ad path passed');await context.close();
}finally{await browser.close()}

