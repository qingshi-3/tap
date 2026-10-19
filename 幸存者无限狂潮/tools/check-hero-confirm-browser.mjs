import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadProfile,STORAGE_KEY} from '../dist/campaign.js';
import {HEROES,getHeroJobs} from '../dist/heroes.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const mem=new Map();globalThis.localStorage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v))};
const fresh=loadProfile().profile,original=fresh.selectedHero,target=HEROES.find(h=>h.id!==original).id;
const tier=process.argv.includes('--tier');
if(tier){Object.assign(fresh.heroes[original],{level:6,job:getHeroJobs(original)[2].id,unlockedJobs:getHeroJobs(original).map(j=>j.id),skillLoadout:HEROES.find(h=>h.id===original).skills.map(s=>s.id)});fresh.heroes[target].level=3;fresh.cleared=['moss-gate'];fresh.progression.dungeonWins={'moss-gate':1};}
const out=new URL(tier?'../output/hero-confirm/tier/':'../output/hero-confirm/',import.meta.url);await mkdir(out,{recursive:true});
const report={passed:false,cases:[],errors:[],missing:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
async function tierChecks(){
 for(const [width,height]of [[844,390],[667,320]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:height===320?'reduce':'no-preference'});
  await context.addInitScript(({key,p})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(p));},{key:STORAGE_KEY,p:fresh});
  await context.route('**/main.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.__HERO_CONFIRM_QA=()=>({phase:game.phase,hero:game.heroId,job:game.player.job});'});});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
  const raw=()=>page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY),enter=()=>page.locator('[data-tab="hero"]').first().tap(),confirm=()=>page.locator('[data-action="confirm-hero"]');
  const shot=async name=>page.screenshot({path:fileURLToPath(new URL(`${width}-${name}.png`,out))});
  const gray=async()=>{assert(await confirm().isDisabled());const style=await confirm().evaluate(b=>({background:getComputedStyle(b).backgroundColor,image:getComputedStyle(b).backgroundImage}));assert.equal(style.background,'rgb(38, 49, 59)');assert.equal(style.image,'none');return style;};
  await page.goto('http://127.0.0.1:4178/');await enter();const baseline=await raw();await gray();await shot('same-combination-gray');
  await page.locator(`[data-hero="${target}"]`).tap();await page.locator(`[data-preview-job="${getHeroJobs(target)[2].id}"]`).tap();await gray();assert.equal(await confirm().textContent(),'该阶层未解锁');await shot('other-hero-locked-gray');assert.equal(await raw(),baseline);
  await page.locator(`[data-hero="${original}"]`).tap();assert.equal(await page.locator('.preview-job-picker .is-active').getAttribute('data-preview-job'),getHeroJobs(original)[2].id);
  await page.locator(`[data-preview-job="${getHeroJobs(original)[0].id}"]`).tap();assert(await confirm().isEnabled());await shot('lower-tier-enabled');
  for(const panel of ['jobs','attacks','skills']){await page.locator(`[data-hero-panel="${panel}"]`).tap();assert(await confirm().isEnabled());assert.equal(await raw(),baseline);}
  assert(await page.locator('[data-equip]').isDisabled());await page.locator('[data-hero-panel="jobs"]').tap();assert(await page.locator('[data-action="train"]').isDisabled());assert.equal(await page.locator('[data-job]').count(),0);
  await page.locator('[data-action="back"]').tap();await enter();assert.equal(await raw(),baseline);await gray();
  for(const index of [0,1]){
   const job=getHeroJobs(original)[index].id;await page.locator('[data-hero-panel="skills"]').tap();await page.locator(`[data-preview-job="${job}"]`).tap();
   if(index===0){await page.evaluate(()=>{window.__savedSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Test blocked','QuotaExceededError');};});await confirm().tap();assert.equal(await raw(),baseline);assert(await confirm().isEnabled());assert(await page.locator('.campaign-toast.is-visible').count());await page.evaluate(()=>Storage.prototype.setItem=window.__savedSet);}
   await confirm().focus();assert.equal(await page.evaluate(()=>document.activeElement?.dataset.action),'confirm-hero');await page.keyboard.press('Enter');assert.equal(JSON.parse(await raw()).heroes[original].job,job);await gray();
   await page.reload();await enter();assert.equal(await page.locator('.preview-job-picker .is-active').getAttribute('data-preview-job'),job);await gray();
   await page.locator('[data-action="back"]').tap();await page.locator('[data-tab="map"]').tap();await page.locator('[data-dungeon="moss-gate"]').tap();await page.locator('[data-action="depart"]').tap();await page.waitForFunction(()=>window.__HERO_CONFIRM_QA?.().phase==='playing');const battle=await page.evaluate(()=>window.__HERO_CONFIRM_QA());assert.equal(battle.hero,original);assert.equal(battle.job,job);
   await page.locator('#pause').tap();await page.locator('#return-title').tap();await page.locator('#confirm-yes').tap();await enter();report.cases.push({width,height,job,battle});
  }
  await page.locator(`[data-hero="${target}"]`).tap();assert.equal(await page.locator('.preview-job-picker .is-active').getAttribute('data-preview-job'),getHeroJobs(target)[0].id);await confirm().tap();
  await page.locator('[data-hero-panel="jobs"]').tap();await page.locator(`[data-preview-job="${getHeroJobs(target)[1].id}"]`).tap();await gray();await shot('current-hero-locked-gray');
  const claimedBefore=JSON.parse(await raw());await page.locator(`[data-claim="${getHeroJobs(target)[1].questId}"]`).tap();const claimed=JSON.parse(await raw());assert.equal(claimed.heroes[target].job,claimedBefore.heroes[target].job);assert(claimed.heroes[target].unlockedJobs.includes(getHeroJobs(target)[1].id));assert(await confirm().isEnabled());
  const bounds=await confirm().boundingBox();assert(bounds.width>=44&&bounds.height>=44&&bounds.y+bounds.height<=height);await context.close();
 }
}
try{
 if(tier)await tierChecks();else for(const [width,height]of [[844,390],[667,320]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:height===320?'reduce':'no-preference'});
  await context.addInitScript(({key,p})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(p));},{key:STORAGE_KEY,p:fresh});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
  const raw=()=>page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY);
  const enter=()=>page.locator('[data-tab="hero"]').first().tap();
  await page.goto('http://127.0.0.1:4178/');await enter();const baseline=await raw();
  assert(await page.locator('[data-action="confirm-hero"]').isDisabled());
  await page.locator(`[data-hero="${target}"]`).tap();assert.equal(await raw(),baseline);
  assert.equal(await page.locator(`[data-hero="${original}"] .roster-check`).count(),1);
  assert.equal(await page.locator(`[data-hero="${target}"]`).getAttribute('aria-pressed'),'true');
  for(const panel of ['skills','jobs','attacks']){await page.locator(`[data-hero-panel="${panel}"]`).tap();assert.equal(await raw(),baseline);assert(await page.locator('[data-action="confirm-hero"]').isEnabled());}
  await page.locator('[data-hero-panel="skills"]').tap();assert(await page.locator('[data-equip]').isDisabled());
  await page.locator('[data-hero-panel="jobs"]').tap();assert(await page.locator('[data-action="train"]').isDisabled());
  await page.locator('[data-action="profession-details"]').tap();assert(await page.locator('[data-action="recommend-skills"]').isDisabled());await page.locator('[data-action="close-profession-details"]').tap();
  const bounds=await page.locator('[data-action="confirm-hero"]').boundingBox();assert(bounds.height>=44&&bounds.width>=44&&bounds.y>=0&&bounds.y+bounds.height<=height);
  await page.screenshot({path:fileURLToPath(new URL(`${width}-pending.png`,out))});
  await page.locator('[data-action="back"]').tap();assert.equal(await raw(),baseline);await enter();assert(await page.locator('[data-action="confirm-hero"]').isDisabled());
  await page.locator(`[data-hero="${target}"]`).tap();await page.reload();await enter();assert.equal(await raw(),baseline);assert(await page.locator('[data-action="confirm-hero"]').isDisabled());
  await page.locator(`[data-hero="${target}"]`).tap();await page.evaluate(()=>{window.__savedSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Test blocked','QuotaExceededError');};});
  await page.locator('[data-action="confirm-hero"]').tap();assert.equal(await raw(),baseline);assert(await page.locator('[data-action="confirm-hero"]').isEnabled());assert(await page.locator('.campaign-toast.is-visible').count());assert.equal(await page.locator(`[data-hero="${original}"] .roster-check`).count(),1);
  await page.evaluate(()=>Storage.prototype.setItem=window.__savedSet);
  await page.locator('[data-action="confirm-hero"]').focus();assert.equal(await page.evaluate(()=>document.activeElement?.dataset.action),'confirm-hero');await page.keyboard.press('Enter');assert.equal(JSON.parse(await raw()).selectedHero,target);assert(await page.locator('[data-action="confirm-hero"]').isDisabled());
  await page.locator('[data-action="back"]').tap();await enter();assert.equal(await page.locator(`[data-hero="${target}"]`).getAttribute('aria-pressed'),'true');await page.reload();await enter();assert.equal(JSON.parse(await raw()).selectedHero,target);assert(await page.locator('[data-action="confirm-hero"]').isDisabled());
  await page.screenshot({path:fileURLToPath(new URL(`${width}-confirmed.png`,out))});report.cases.push({width,height,bounds,checks:'browse, all tabs, blocked writes, exit, reload, storage failure, confirm, persisted reload'});await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;
}finally{await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
