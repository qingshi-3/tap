import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const out = new URL('../output/reward-presentation/', import.meta.url); await mkdir(out,{recursive:true});
const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const reports=[];
try {
 for(const [width,height,motion] of [[844,390,'no-preference'],[568,320,'reduce']]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:motion}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/reward-qa.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/resource-rewards.css"><link rel="stylesheet" href="/recruitment.css"><link rel="stylesheet" href="/reward-presentation.css"><link rel="stylesheet" href="/visual-theme.css"><body></body>'}));
  await page.goto('http://127.0.0.1:4223/reward-qa.html');
  await page.evaluate(async()=>{
   const {ExpeditionProgress}=await import('/js/expedition-progress.js'),{ResourceRewardsUI}=await import('/js/resource-rewards-ui.js'),{RewardPresentation}=await import('/js/reward-presentation.js');
   const storage={data:new Map([['duelyst-h5.safe-v1.namespace','{"version":1}']]),fail:false,getItem(k){return this.data.get(k)??null},setItem(k,v){if(this.fail)throw Error('quota');this.data.set(k,v)},removeItem(k){this.data.delete(k)}};
   const ad={count:0,cancel(){this.resolve?.({status:'cancelled'})},show({isContextValid}){this.count++;return new Promise(resolve=>this.resolve=r=>resolve(isContextValid()?r:{status:'cancelled'}))}};
   const p=new ExpeditionProgress(storage,{rng:()=>0,now:()=>Date.parse('2026-10-13T12:00:00Z')}),presentation=new RewardPresentation();
   const receipts=[];const onReward=r=>{receipts.push(r);presentation.show(r)};
   const ui=new ResourceRewardsUI({progress:p,ad,onReward});window.qa={p,storage,ad,ui,presentation,receipts,onReward};ui.open();
  });
  const dialog=page.locator('.reward-presentation');
  for(const status of ['cancelled','failed']) {await page.locator('[data-reward-action=gold]').tap();await page.evaluate(status=>qa.ad.resolve({status}),status);await page.waitForFunction(()=>!qa.ui.session);assert.equal(await dialog.isVisible(),false);}
  await page.locator('[data-reward-action=gold]').tap();await page.evaluate(()=>{qa.storage.fail=true;qa.ad.resolve({status:'completed'})});await page.getByRole('button',{name:'重试保存奖励'}).waitFor();assert.equal(await dialog.isVisible(),false);
  const plays=await page.evaluate(()=>qa.ad.count);await page.evaluate(()=>qa.storage.fail=false);await page.getByRole('button',{name:'重试保存奖励'}).tap();await dialog.waitFor();assert.equal(await page.evaluate(()=>qa.ad.count),plays);
  assert.equal(await dialog.locator('p').innerText(),'+100 金币');
  const rect=await dialog.boundingBox();assert.ok(rect.x>=60&&rect.x+rect.width<=width-60&&rect.y>=25&&rect.y+rect.height<=height-25);
  await page.screenshot({path:fileURLToPath(new URL(`gold-${width}.png`,out))});
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'reward-presentation-continue');
  await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);await page.waitForFunction(()=>document.activeElement.closest('dialog')===qa.ui.dialog);
  assert.equal(await page.evaluate(()=>qa.presentation.show(qa.receipts[0])),false);await page.evaluate(()=>qa.ad.resolve({status:'completed'}));assert.equal(await dialog.isVisible(),false);
  await page.locator('[data-reward-action=orb]').tap();await page.evaluate(()=>qa.ad.resolve({status:'completed'}));await dialog.waitFor();assert.equal(await dialog.locator('p').innerText(),'+1 灵魂宝珠');
  if(motion==='reduce')assert.equal(await dialog.locator('img').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.screenshot({path:fileURLToPath(new URL(`orb-${width}.png`,out))});await dialog.getByRole('button',{name:'继续'}).tap();
  await page.evaluate(async()=>{qa.ui.close();const{RecruitmentUI}=await import('/js/recruitment-ui.js');qa.p=new (await import('/js/expedition-progress.js')).ExpeditionProgress({data:new Map(),getItem(k){return this.data.get(k)??null},setItem(k,v){this.data.set(k,v)},removeItem(k){this.data.delete(k)}},{rng:()=>0,now:()=>Date.parse('2026-10-14T12:00:00Z')});qa.recruit=new RecruitmentUI({progress:qa.p,ad:qa.ad,onReward:qa.onReward,drawCardArt(){}});qa.recruit.open()});
  await page.locator('[data-recruitment-action=ad]').tap();await page.evaluate(()=>qa.ad.resolve({status:'completed'}));await dialog.waitFor();assert.equal(await dialog.locator('p').innerText(),'+1 灵魂宝珠');await dialog.getByRole('button',{name:'继续'}).tap();
  assert.deepEqual(errors,[]);reports.push({width,height,motion,passed:['cancel-no-popup','failure-no-popup','save-retry-no-replay','actual-gold-orb-amount','duplicate-no-popup','touch-continue','keyboard-trap-escape-focus-return','safe-short-landscape','recruitment-reward'],hostVerified:false});await context.close();
 }
 await writeFile(new URL('report.json',out),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
} finally {await browser.close();}

