import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {normalizeExpeditionState,validateExpeditionState} from '../dist/js/expedition-progress.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),out=new URL('../output/recruitment-fragments-ui/',import.meta.url);await mkdir(out,{recursive:true});
const old=JSON.parse(await readFile(new URL('./fixtures/save-contract-profile10-pre-random-2026-10-14.json',import.meta.url)));
const seed=normalizeExpeditionState(old.profiles[0]);seed.recruitment.tickets=50;seed.coins=1000;seed.recruitment.fragments={};seed.recruitment.random.legacyGuarantees={};seed.recruitment.random.legacyUnitGuarantee=null;assert.ok(validateExpeditionState(seed));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const reports=[],errors=[];
async function dismissPresentation(page){const popup=page.locator('.recruitment-presentation[open]');if(!await popup.count())return;const skip=popup.locator('[data-recruitment-presentation-action=skip]');if(await skip.isVisible())await skip.tap();await popup.locator('[data-recruitment-presentation-action=continue]').tap();await popup.waitFor({state:'hidden'});}
async function shot(page,name){await page.waitForTimeout(650);await page.screenshot({path:fileURLToPath(new URL(`${name}.png`,out))});}
async function setup(width,height,reducedMotion='reduce'){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion}),page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
 await page.addInitScript(({seed,key})=>{
  if(!sessionStorage.seeded){localStorage.setItem(key,JSON.stringify(seed));sessionStorage.seeded='1';}
  const realNow=Date.now;Date.now=()=>window.qaNow??realNow();
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key&&window.failSave)throw Error('isolated save failure');return set.call(this,k,v)};
 },{seed,key:SAVE_KEYS.expedition});
 await page.goto('http://127.0.0.1:4227');await page.locator('[data-action=recruitment]').waitFor();
 await attach(page);await page.locator('[data-action=recruitment]').tap();await page.locator('.recruitment-dialog[open]').waitFor();await page.waitForTimeout(500);return {context,page};
}
async function attach(page){await page.evaluate(async()=>{
 const{RecruitmentUI}=await import('/js/recruitment-ui.js');const open=RecruitmentUI.prototype.open;RecruitmentUI.prototype.open=function(...args){window.qa={ui:this,p:this.progress,shows:0};this.ad={cancel(){qa.finish?.('cancelled')},show({isContextValid}){qa.shows++;return new Promise(resolve=>{qa.finish=status=>resolve(isContextValid()?{status}:{status:'cancelled'})})}};return open.apply(this,args)};
});}
async function fits(page,selector){return page.locator(selector).evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {text:el.innerText,width:r.width,height:r.height,visible:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}}));}
try{
 for(const [w,h]of[[568,320],[844,390]]){
  const{context,page}=await setup(w,h);await shot(page,`home-${w}`);
  await page.locator('[data-recruitment-action=pool]').tap();await shot(page,`pool-${w}`);assert.equal(await page.locator('.recruitment-pool-unit').count(),24);
  const grid=await page.locator('.recruitment-pool-grid').boundingBox(),cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:grid.x+grid.width/2,y:grid.y+grid.height-10}]});
  for(let n=1;n<=8;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:grid.x+grid.width/2,y:grid.y+grid.height-10-n*(grid.height-20)/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(700);assert.ok(await page.locator('.recruitment-pool-grid').evaluate(el=>el.scrollTop)>0);
  await page.locator('[data-recruitment-action=home]').tap();await page.locator('.recruitment-home').waitFor();await page.locator('.recruitment-dialog [data-count="1"]').tap();await dismissPresentation(page);await shot(page,`single-${w}`);
  assert.equal(await page.locator('.recruitment-result').count(),1);assert.ok(await page.locator('[data-recruitment-action=double]').isEnabled());
  const before=await page.evaluate(()=>qa.p.state);await page.locator('[data-recruitment-action=double]').tap();await page.evaluate(()=>qa.finish('cancelled'));await dismissPresentation(page);await page.waitForFunction(()=>!qa.ui.session);assert.deepEqual(await page.evaluate(()=>({coins:qa.p.state.coins,fragments:qa.p.state.recruitment.fragments})),{coins:before.coins,fragments:before.recruitment.fragments});
  await page.locator('[data-recruitment-action=double]').tap();await page.evaluate(()=>qa.finish('completed'));await dismissPresentation(page);await page.waitForFunction(()=>!qa.ui.session);await shot(page,`single-doubled-${w}`);assert.equal(await page.evaluate(()=>qa.p.state.coins),before.coins+20);
  await page.locator('.recruitment-result-footer [data-recruitment-action=home]').tap();await page.locator('.recruitment-dialog [data-count="10"]').tap();await dismissPresentation(page);await shot(page,`ten-${w}`);assert.equal(await page.locator('.recruitment-result').count(),10);
  await page.locator('[data-index="3"]').tap();await page.locator('[data-recruitment-action=double]').tap();await page.evaluate(()=>{window.failSave=true;qa.finish('completed')});await page.getByRole('button',{name:'重试保存翻倍奖励',exact:true}).waitFor();await shot(page,`save-retry-${w}`);const shows=await page.evaluate(()=>qa.shows);
  await page.evaluate(()=>window.failSave=false);await page.getByRole('button',{name:'重试保存翻倍奖励',exact:true}).tap();await dismissPresentation(page);await page.waitForFunction(()=>!qa.ui.session);assert.equal(await page.evaluate(()=>qa.shows),shows);await shot(page,`ten-doubled-${w}`);
  // Success journal recovery after reload uses the result UI, without replaying an ad.
  await page.locator('[data-index="4"]').tap();await page.locator('[data-recruitment-action=double]').tap();await page.evaluate(()=>{window.failSave=true;qa.finish('completed')});await page.getByRole('button',{name:'重试保存翻倍奖励',exact:true}).waitFor();
  const reloadBefore=await page.evaluate(()=>qa.p.state.coins);await page.reload();await page.locator('[data-action=recruitment]').waitFor();await attach(page);await page.locator('[data-action=recruitment]').tap();await page.getByRole('button',{name:'重试保存翻倍奖励',exact:true}).tap();await dismissPresentation(page);await page.waitForFunction(()=>!qa.ui.session);assert.equal(await page.evaluate(()=>qa.shows),0);assert.equal(await page.evaluate(()=>qa.p.state.coins),reloadBefore+20);await shot(page,`reload-recovered-${w}`);
  for(const index of[1,2,5,6,7,8,9]){await page.locator(`[data-index="${index}"]`).tap();await page.locator('[data-recruitment-action=double]').tap();await page.evaluate(()=>qa.finish('completed'));await dismissPresentation(page);await page.waitForFunction(()=>!qa.ui.session);}
  await page.locator('[data-index="10"]').tap();assert.ok(await page.locator('[data-recruitment-action=double]').isDisabled());assert.match(await page.locator('.recruitment-double-quota').innerText(),/0\/10/);assert.ok(await page.evaluate(()=>qa.p.resourceRewardOffer('orb').eligible&&qa.p.resourceRewardOffer('gold').eligible));await shot(page,`daily-limit-${w}`);
  await page.evaluate(()=>{window.qaNow=Date.now()+86400000;document.dispatchEvent(new Event('visibilitychange'))});assert.ok(await page.locator('[data-recruitment-action=double]').isEnabled());
  await page.locator('.recruitment-result-footer [data-recruitment-action=home]').tap();await page.evaluate(()=>window.failSave=true);const beforeRetry=await page.evaluate(()=>qa.p.state);await page.locator('.recruitment-dialog [data-count="1"]').tap();await dismissPresentation(page);assert.ok(await page.locator('.recruitment-dialog [data-count="10"]').isDisabled());assert.ok(await page.locator('[data-recruitment-action=ad]').isDisabled());await page.evaluate(()=>window.failSave=false);await page.getByRole('button',{name:'重试保存招募结果',exact:true}).tap();await dismissPresentation(page);assert.equal(await page.evaluate(()=>qa.p.state.recruitment.tickets),beforeRetry.recruitment.tickets-1);
  await page.locator('[data-recruitment-action=double]').tap();const lateBefore=await page.evaluate(()=>qa.p.state.coins);await page.keyboard.press('Escape');await page.evaluate(()=>qa.finish('completed'));await dismissPresentation(page);assert.equal(await page.evaluate(()=>qa.p.state.coins),lateBefore);
  await page.locator('[data-action=recruitment]').tap();await page.locator('[data-recruitment-action=results]').tap();
  const controls=await fits(page,'.recruitment-result-footer button');assert.ok(controls.every(r=>r.visible&&r.width>=44&&r.height>=44));
  await page.locator('.recruitment-result-footer [data-recruitment-action=home]').tap();
  await page.evaluate(()=>{const s=qa.p.state,ids=qa.p.recruitmentStatus().recipes.map(r=>r.cardId);s.inventory.units=s.inventory.units.filter(id=>!ids.includes(id));for(const id of ids)s.recruitment.fragments[id]=29;if(!qa.p.replaceState(s).ok)throw Error('craft fixture rejected');qa.ui.render()});
  await page.locator('.recruitment-dialog [data-count="1"]').tap();await dismissPresentation(page);assert.ok(await page.locator('.recruitment-new-unit').isVisible());assert.equal(await page.evaluate(()=>qa.p.recruitmentStatus().ownedCount),1);await shot(page,`synthesized-${w}`);
  await page.locator('.recruitment-result-footer [data-recruitment-action=home]').tap();await page.evaluate(()=>{const s=qa.p.state;s.recruitment.tickets=0;if(!qa.p.replaceState(s).ok)throw Error('empty fixture rejected');qa.ui.render()});assert.ok(await page.locator('.recruitment-dialog [data-count="1"]').isDisabled());assert.ok(await page.locator('.recruitment-dialog [data-count="10"]').isDisabled());await shot(page,`insufficient-${w}`);
  // Fresh accounts can spend ad-earned orbs without completing any stage.
  await page.evaluate(async()=>{const{ExpeditionProgress}=await import('/js/expedition-progress.js');const s=new ExpeditionProgress({getItem(){return null},setItem(){}}).state;if(!qa.p.replaceState(s).ok)throw Error('fresh fixture rejected');qa.ui.render()});
  assert.ok(await page.locator('.recruitment-dialog [data-count="1"]').isDisabled());
  const emptyBefore=await page.evaluate(()=>qa.p.state),emptyBox=await page.locator('.recruitment-dialog [data-count="1"]').boundingBox();
  await page.touchscreen.tap(emptyBox.x+emptyBox.width/2,emptyBox.y+emptyBox.height/2);assert.deepEqual(await page.evaluate(()=>qa.p.state),emptyBefore);
  await page.locator('[data-recruitment-action=ad]').tap();await page.evaluate(()=>qa.finish('completed'));await dismissPresentation(page);await page.waitForFunction(()=>!qa.ui.session);await page.locator('.reward-presentation').getByRole('button',{name:'继续',exact:true}).tap();
  assert.ok(await page.locator('.recruitment-dialog [data-count="1"]').isEnabled());assert.ok(await page.locator('.recruitment-dialog [data-count="10"]').isDisabled());
  const noStageBefore=await page.evaluate(()=>({state:qa.p.state,shows:qa.shows}));assert.deepEqual(noStageBefore.state.completed,[]);
  // Actual sustained touch on nested button text must not start native selection.
  for(const count of [1,10]){
    const box=await page.locator(`.recruitment-dialog [data-count="${count}"]`).evaluate(el=>{const r=document.createRange();r.selectNodeContents(el.firstChild);const b=r.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(()=>getSelection().toString()),'');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  }
  await shot(page,`fresh-ad-orbs-${w}`);
  await page.locator('.recruitment-dialog [data-count="1"]').tap();await dismissPresentation(page);assert.equal(await page.locator('.recruitment-result').count(),1);
  await page.locator('.recruitment-result-footer [data-recruitment-action=home]').tap();
  assert.equal(await page.evaluate(()=>qa.shows),noStageBefore.shows);assert.equal(await page.evaluate(()=>qa.p.state.recruitment.tickets),noStageBefore.state.recruitment.tickets-1);
  await page.reload();await page.locator('[data-action=recruitment]').waitFor();await attach(page);await page.locator('[data-action=recruitment]').tap();assert.equal(await page.evaluate(()=>qa.p.state.coins),noStageBefore.state.coins+20);
  // Owned cards disappear from both the rendered pool and subsequent actual draws.
  await page.evaluate(()=>{const s=qa.p.state,ids=qa.p.recruitmentConfig.recipes.map(r=>r.cardId);const remaining=ids.filter(id=>!s.inventory.units.includes(id));s.inventory.units.push(...remaining.slice(0,-1));s.recruitment.tickets=10;s.recruitment.fragments[remaining.at(-1)]=29;if(!qa.p.replaceState(s).ok)throw Error('nearly complete fixture rejected');qa.ui.render()});
  await page.locator('[data-recruitment-action=pool]').tap();assert.equal(await page.locator('.recruitment-pool-unit').count(),1);await shot(page,`remaining-pool-${w}`);
  await page.locator('[data-recruitment-action=home]').tap();await page.locator('.recruitment-dialog [data-count="10"]').tap();await dismissPresentation(page);assert.equal(await page.locator('.recruitment-result').count(),1);
  assert.equal(await page.evaluate(()=>qa.p.state.recruitment.tickets),9);await page.locator('.recruitment-result-footer [data-recruitment-action=home]').tap();
  assert.ok(await page.locator('.recruitment-dialog [data-count="1"]').isDisabled());assert.ok(await page.locator('.recruitment-dialog [data-count="10"]').isDisabled());assert.ok(await page.getByText('已集齐全部招募随从',{exact:true}).isVisible());await shot(page,`all-collected-${w}`);

  reports.push({width:w,height:h,poolTouchScroll:true,single:true,ten:true,cancelNoReward:true,double:true,saveRetryWithoutReplay:true,reloadRecovery:true,independentDailyTen:true,visibleMidnightRefresh:true,lateCallbackIgnored:true,baseSaveRetry:true,automaticSynthesis:true,disabledInputs:true,freshAdOrbsDraw:true,longPressNoSelection:true,ownedExcluded:true,exhaustedBatchRefund:true,controls});await context.close();
 }
 {
  const{context,page}=await setup(568,320,'no-preference');await page.locator('.recruitment-dialog [data-count="10"]').tap();assert.ok(await page.locator('[data-recruitment-presentation-action=skip]').isVisible());await page.waitForTimeout(250);await page.screenshot({path:fileURLToPath(new URL('reveal-motion-568.png',out))});await page.locator('[data-recruitment-presentation-action=skip]').tap();await dismissPresentation(page);assert.ok(await page.locator('[data-recruitment-action=double]').isVisible());await page.keyboard.press('Tab');assert.ok(await page.locator('.recruitment-dialog').evaluate(el=>el.contains(document.activeElement)));await shot(page,'keyboard-focus-568');await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('report.json',out),JSON.stringify({reports,errors},null,2));console.log(JSON.stringify({reports,errors}));
}finally{await browser.close();}
