import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../output/recruitment-presentation-ui/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const reports=[],errors=[],focused=process.argv.includes('--lifecycle-only');
const seed=new ExpeditionProgress({getItem(){return null},setItem(){}}).state;seed.recruitment.tickets=60;
const popup=page=>page.locator('.recruitment-presentation[open]');
const action=(page,kind)=>popup(page).locator(`[data-recruitment-presentation-action="${kind}"]`);
const shot=(page,name)=>page.screenshot({path:fileURLToPath(new URL(`${name}.png`,out))});
async function setup(width,height,reducedMotion='no-preference'){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({seed,key})=>{if(!sessionStorage.seeded){localStorage.setItem(key,JSON.stringify(seed));sessionStorage.seeded='1';}const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key&&window.failSave)throw Error('isolated save failure');return set.call(this,k,v)};},{seed,key:SAVE_KEYS.expedition});
 await page.goto('http://127.0.0.1:4227');await page.locator('[data-action=recruitment]').waitFor();
 await page.evaluate(async()=>{const{RecruitmentUI}=await import('/js/recruitment-ui.js');const open=RecruitmentUI.prototype.open;RecruitmentUI.prototype.open=function(...args){window.qa={ui:this,p:this.progress,shows:0};this.ad={cancel(){qa.finish?.('cancelled')},show({isContextValid}){qa.shows++;return new Promise(resolve=>qa.finish=status=>resolve(isContextValid()?{status}:{status:'cancelled'}))}};return open.apply(this,args)};});
 await page.locator('[data-action=recruitment]').tap();return {context,page};
}
async function settled(page){await page.locator('.recruitment-presentation[open][data-phase=settled]').waitFor();await page.waitForTimeout(160);}
async function done(page){await action(page,'continue').tap();await popup(page).waitFor({state:'hidden'});}
async function controlsFit(page){return popup(page).locator('button:visible').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {text:el.innerText,w:r.width,h:r.height,visible:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}}));}
try{
 for(const [width,height]of (focused?[]:[[568,320],[844,390]])){
  const {page,context}=await setup(width,height),before=await page.evaluate(()=>qa.p.state);
  await page.locator('.recruitment-dialog [data-count="1"]').tap();await popup(page).waitFor();assert.equal(await popup(page).getAttribute('data-kind'),'draw');
  assert.equal(await page.evaluate(()=>qa.p.state.recruitment.tickets),before.recruitment.tickets-1);assert.equal(await page.evaluate(()=>qa.p.state.coins),before.coins+20);
  await shot(page,`single-charge-${width}`);await page.waitForTimeout(700);await shot(page,`single-reveal-${width}`);await settled(page);await shot(page,`single-settled-${width}`);
  const controls=await controlsFit(page);assert.ok(controls.every(c=>c.visible&&c.w>=44&&c.h>=44));
  const cdp=await context.newCDPSession(page),hold=await action(page,'continue').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:hold.x+hold.width/2,y:hold.y+hold.height/2}]});await page.waitForTimeout(900);assert.equal(await page.evaluate(()=>getSelection().toString()),'');await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.keyboard.press('Tab');assert.ok(await popup(page).evaluate(el=>el.contains(document.activeElement)));await done(page);
  // Cancellation cannot celebrate or alter the committed base result.
  const base=await page.evaluate(()=>qa.p.state);await page.locator('[data-recruitment-action=double]').tap();await page.evaluate(()=>qa.finish('cancelled'));await page.waitForFunction(()=>!qa.ui.session);assert.equal(await popup(page).count(),0);assert.equal(await page.evaluate(()=>qa.p.state.coins),base.coins);
  await page.locator('[data-recruitment-action=double]').tap();await page.evaluate(()=>qa.finish('completed'));await popup(page).waitFor();assert.equal(await popup(page).getAttribute('data-kind'),'double');
  assert.equal(await page.evaluate(()=>qa.p.state.coins),base.coins+20);await shot(page,`double-charge-${width}`);await page.waitForTimeout(650);await shot(page,`double-reveal-${width}`);await settled(page);await shot(page,`double-settled-${width}`);await done(page);
  await page.evaluate(()=>qa.finish('completed'));await page.waitForTimeout(100);assert.equal(await popup(page).count(),0);assert.equal(await page.evaluate(()=>qa.p.state.coins),base.coins+20);
  await page.locator('.recruitment-result-footer [data-recruitment-action=home]').tap();await page.locator('.recruitment-dialog [data-count="10"]').tap();await popup(page).waitFor();await page.waitForTimeout(900);await shot(page,`ten-reveal-${width}`);await settled(page);await shot(page,`ten-settled-${width}`);await done(page);assert.equal(await page.locator('.recruitment-result').count(),10);
  // An earned but unsaved double must show a retry, without success effects.
  await page.locator('[data-index="3"]').tap();await page.locator('[data-recruitment-action=double]').tap();await page.evaluate(()=>{window.failSave=true;qa.finish('completed')});await page.getByRole('button',{name:'重试保存翻倍奖励',exact:true}).waitFor();assert.equal(await popup(page).count(),0);
  const shows=await page.evaluate(()=>qa.shows);await page.evaluate(()=>window.failSave=false);await page.getByRole('button',{name:'重试保存翻倍奖励',exact:true}).tap();await popup(page).waitFor();assert.equal(await page.evaluate(()=>qa.shows),shows);await action(page,'skip').tap();await settled(page);await done(page);
  // Skip and Escape dismiss only presentation; saved rewards persist.
  await page.locator('.recruitment-result-footer [data-recruitment-action=home]').tap();await page.locator('.recruitment-dialog [data-count="10"]').tap();await popup(page).waitFor();await action(page,'skip').tap();await settled(page);await shot(page,`ten-skip-${width}`);const saved=await page.evaluate(()=>qa.p.state);await page.keyboard.press('Escape');await popup(page).waitFor({state:'hidden'});assert.deepEqual(await page.evaluate(()=>qa.p.state),saved);
  await page.locator('.recruitment-result-footer [data-recruitment-action=home]').tap();await page.evaluate(()=>{const s=qa.p.state;for(const id of qa.p.recruitmentStatus().eligibleTargets)s.recruitment.fragments[id]=29;if(!qa.p.replaceState(s).ok)throw Error('new unit fixture rejected');qa.ui.render()});await page.locator('.recruitment-dialog [data-count="1"]').tap();await settled(page);await shot(page,`new-unit-${width}`);await done(page);
  await page.locator('.recruitment-result-footer [data-recruitment-action=home]').tap();
  await page.evaluate(()=>{const s=qa.p.state;for(const id of [17,116,215,310,404,526]){s.recruitment.misses[id]=3;s.recruitment.random.legacyGuarantees[id]=1;}if(!qa.p.replaceState(s).ok)throw Error('legacy supplemental fixture rejected');qa.ui.render()});
  await page.locator('.recruitment-dialog [data-count="10"]').tap();await settled(page);await shot(page,`legacy-ten-${width}`);await done(page);
  await page.locator('.recruitment-result-footer [data-recruitment-action=home]').tap();await page.locator('.recruitment-dialog [data-count="1"]').tap();await popup(page).waitFor();const last=await page.evaluate(()=>qa.p.state);await page.reload();await page.locator('[data-action=recruitment]').waitFor();assert.equal(await page.locator('.recruitment-presentation[open]').count(),0);assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEYS.expedition),last);
  reports.push({width,height,committedBeforeAnimation:true,singleChargeReveal:true,tenNaturalReveal:true,doublePopup:true,cancelNoCelebration:true,failedSaveNoCelebration:true,retryOnceWithoutAd:true,duplicateNoCelebration:true,skip:true,escape:true,newUnit:true,reloadPreservesReward:true,controls});await context.close();
 }
 {
  const{page,context}=await setup(568,320,'reduce');await page.locator('.recruitment-dialog [data-count="1"]').tap();await settled(page);assert.equal(await popup(page).evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);await shot(page,'reduced-motion-568');await done(page);await page.locator('[data-recruitment-action=double]').tap();await page.evaluate(()=>qa.finish('completed'));await settled(page);assert.equal(await popup(page).evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);await done(page);// Fast replacement must not let a queued old close event erase a new popup.
  const stable=await page.evaluate(()=>qa.p.state);
  await page.evaluate(()=>{const r=qa.p.recruitmentStatus().lastReceipt;void qa.ui.present('draw',r);void qa.ui.present('draw',r)});await page.waitForTimeout(80);assert.equal(await popup(page).count(),1);assert.equal(await page.evaluate(()=>qa.ui.revealing),true);assert.ok(await popup(page).locator('.recruitment-presentation-card').count());await done(page);assert.deepEqual(await page.evaluate(()=>qa.p.state),stable);
  await page.evaluate(()=>{qa.ui.dialog.close();qa.ui.open()});await page.waitForTimeout(80);assert.ok(await page.locator('.recruitment-dialog[open]').isVisible());assert.ok(await page.evaluate(()=>!!qa.ui.stopDailyRefresh));assert.equal(await page.evaluate(()=>{let refreshes=0;const render=qa.ui.render;qa.ui.render=function(...args){refreshes++;return render.apply(this,args)};document.dispatchEvent(new Event('visibilitychange'));return refreshes}),1);
  await page.evaluate(()=>{const s=qa.p.state;for(const id of [17,116,215,310,404,526]){s.recruitment.misses[id]=3;s.recruitment.random.legacyGuarantees[id]=1;}if(!qa.p.replaceState(s).ok)throw Error('legacy focus fixture rejected');qa.ui.render()});await page.locator('.recruitment-dialog [data-count="10"]').tap();await settled(page);
  await action(page,'continue').focus();await page.keyboard.press('Tab');assert.ok(await page.locator('.recruitment-presentation-extra').evaluate(el=>el===document.activeElement));
  const strip=page.locator('.recruitment-presentation-extra'),b=await strip.boundingBox(),touch=await context.newCDPSession(page);await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width-25,y:b.y+b.height/2}]});for(let n=1;n<=8;n++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width-25-n*(b.width-50)/8,y:b.y+b.height/2}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);assert.ok(await strip.evaluate(el=>el.scrollLeft)>0);await shot(page,'legacy-touch-scroll-568');await done(page);
  reports.push({reducedMotion:true,staticSuccessFeedback:true,rapidReplacementSafe:true,rapidReopenSafe:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL(focused?'lifecycle-report.json':'report.json',out),JSON.stringify({reports,errors},null,2));console.log(JSON.stringify({reports,errors}));
}finally{await browser.close();}
