import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const out = new URL('../output/resource-rewards/', import.meta.url); await mkdir(out, { recursive:true });
const browser = await chromium.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true });
const reports = [];
try {
 for (const [width,height] of [[844,390],[568,320]]) {
  const context = await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce'}), page = await context.newPage();
  await page.route('**/resource-qa.html', route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/safe-area.css"><link rel="stylesheet" href="/resource-rewards.css"><link rel="stylesheet" href="/recruitment.css"></head><body></body></html>'}));
  await page.goto('http://127.0.0.1:4223/resource-qa.html');
  await page.evaluate(async () => {
   const {ExpeditionProgress}=await import('/js/expedition-progress.js'),{createExpeditionMatch}=await import('/js/expedition-engine.js'),{ResourceRewardsUI}=await import('/js/resource-rewards-ui.js');
   const storage={data:new Map([['duelyst-h5.safe-v1.namespace','{"version":1}']]),fail:false,getItem(k){return this.data.get(k)??null},setItem(k,v){if(this.fail)throw Error('quota');this.data.set(k,v)},removeItem(k){this.data.delete(k)}};
   const ad={count:0,cancel(){this.resolve?.({status:'cancelled'})},show({isContextValid}){this.count++;return new Promise(resolve=>{this.resolve=result=>resolve(isContextValid()?result:{status:'cancelled'})})}};
   const clock={now:Date.parse('2026-10-13T12:00:00Z')}; const p=new ExpeditionProgress(storage,{rng:()=>0,now:()=>clock.now}),ui=new ResourceRewardsUI({progress:p,ad});
   window.qa={p,ui,ad,storage,clock,win(id){const s=p.state,m=createExpeditionMatch('border-01',s.training,s.squad,s.selectedHeroId);Object.assign(m,{runId:id,phase:'over',winner:0,result:'win'});return p.settle(m)},finish(status='completed'){ad.resolve({status})}}; ui.open();
  });
  assert.equal(await page.locator('[data-reward-action]:enabled').count(),2);
  assert.equal(await page.getByText('100～1000 金币',{exact:true}).count(),1);assert.equal(await page.getByText('1～5 枚',{exact:true}).count(),1);
  assert.doesNotMatch(await page.locator('.resource-rewards-dialog').innerText(),/余额|来源|通关/);
  await page.screenshot({path:new URL(`available-${width}x${height}.png`,out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  const before=await page.evaluate(()=>({coins:qa.p.state.coins,tickets:qa.p.state.recruitment.tickets}));
  await page.locator('[data-reward-action="gold"]').tap(); await page.evaluate(()=>qa.finish('cancelled')); await page.waitForFunction(()=>!qa.ui.session);
  assert.equal(await page.evaluate(()=>qa.p.state.coins),before.coins);
  await page.locator('[data-reward-action="gold"]').tap(); await page.evaluate(()=>{qa.storage.fail=true;qa.finish()}); await page.getByRole('button',{name:/重试保存/}).waitFor();
  assert.equal(await page.evaluate(()=>qa.p.state.coins),before.coins); assert.equal(await page.evaluate(()=>qa.ad.count),2);
  await page.evaluate(()=>qa.storage.fail=false); await page.getByRole('button',{name:/重试保存/}).tap(); await page.waitForFunction(()=>!qa.ui.session);
  assert.equal(await page.evaluate(()=>qa.p.state.coins),before.coins+100); assert.equal(await page.evaluate(()=>qa.ad.count),2);
  await page.evaluate(()=>qa.finish()); assert.equal(await page.evaluate(()=>qa.p.state.coins),before.coins+100);
  await page.locator('[data-reward-action="orb"]').tap(); await page.evaluate(()=>qa.finish()); await page.waitForFunction(()=>!qa.ui.session); assert.equal(await page.evaluate(()=>qa.p.state.recruitment.tickets),before.tickets+1);
  assert.equal(await page.locator('[data-reward-action]:enabled').count(),0);
  const rect=await page.locator('.resource-rewards-dialog').boundingBox(); assert.ok(rect.x>=59 && rect.x+rect.width<=width-59); assert.ok(rect.y>=51 && rect.y+rect.height<=height-7);
  await page.screenshot({path:new URL(`rewards-${width}x${height}.png`,out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  await page.evaluate(()=>{qa.clock.now+=86400000;document.dispatchEvent(new Event('visibilitychange'))}); await page.locator('[data-reward-action="orb"]').tap(); await page.getByRole('button',{name:'返回',exact:true}).tap(); await page.evaluate(()=>qa.finish());
  assert.equal(await page.evaluate(()=>qa.p.state.recruitment.tickets),before.tickets+1); // new victory base orb, no ad
  const evidence=await page.evaluate(async()=>{const{ExpeditionProgress}=await import('/js/expedition-progress.js');const reload=new ExpeditionProgress(qa.storage);return{coins:reload.state.coins,tickets:reload.state.recruitment.tickets,goldClaimed:!!reload.state.dailyAds.gold.lastClaim,orbClaimed:!!reload.state.dailyAds.orb.lastClaim,lateClaimed:false}});
  await page.evaluate(async()=>{qa.ui.close();const{RecruitmentUI}=await import('/js/recruitment-ui.js');qa.recruit=new RecruitmentUI({progress:qa.p,ad:qa.ad});qa.recruit.open()});
  await page.locator('[data-recruitment-action=ad]').tap(); await page.evaluate(()=>qa.finish()); await page.waitForFunction(()=>!qa.recruit.session); assert.equal(await page.evaluate(()=>qa.p.state.dailyAds.orb.claimedDay==='2026-10-14'),true);
  await page.evaluate(()=>{qa.recruit.invalidate();qa.ui.open()}); assert.equal(await page.locator('[data-reward-action=orb]:enabled').count(),0);
  await page.evaluate(()=>{qa.ui.render()}); await page.locator('[data-reward-action=gold]').tap(); await page.evaluate(()=>qa.finish('failed')); await page.waitForFunction(()=>!qa.ui.session); assert.equal(await page.evaluate(()=>qa.p.state.dailyAds.gold.claimedDay==='2026-10-14'),false);
  await page.locator('[data-reward-action=gold]').tap(); await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));qa.finish()}); assert.equal(await page.evaluate(()=>qa.p.state.dailyAds.gold.claimedDay==='2026-10-14'),false);
  await page.evaluate(async()=>{const{PREMIUM_IDS}=await import('/js/recruitment.js');const state=qa.p.state;state.inventory.units=[...new Set([...state.inventory.units,...PREMIUM_IDS])];if(!qa.p.replaceState(state).ok)throw Error('invalid all-owned fixture');qa.clock.now+=86400000;qa.ui.open()}); assert.equal(await page.locator('[data-reward-action=orb]:enabled').count(),1,'all-owned retains generic orb rewards');
  assert.equal(evidence.goldClaimed,true);assert.equal(evidence.orbClaimed,true);assert.equal(evidence.lateClaimed,false);
  reports.push({width,height,...evidence,passed:['no-victory-gate','cancel','failure','save-retry-no-replay','late-duplicate','gold-orb-choice','two-entry-dedup','close-no-award','pagehide','all-owned-still-eligible','visible-midnight-refresh','reload']}); await context.close();
 }
 await writeFile(new URL('report.json',out),JSON.stringify(reports,null,2)); console.log('Resource reward touch UI passed',JSON.stringify(reports));
} finally { await browser.close(); }
