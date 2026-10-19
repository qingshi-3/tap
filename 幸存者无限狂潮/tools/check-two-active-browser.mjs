import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {HEROES,getHeroJobs,HERO_ACTIVE_SKILLS} from '../dist/heroes.js';
import {loadProfile,STORAGE_KEY} from '../dist/campaign.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const short=process.argv.includes('--short');
const damageOnly=process.argv.includes('--damage-only'),battleOnly=process.argv.includes('--battle-only')||damageOnly,evolutionOnly=process.argv.includes('--evolution-only'),trialsOnly=process.argv.includes('--trials-only');
const filter=process.argv.find(a=>a.startsWith('--heroes='))?.split('=')[1].split(',');
const out=new URL('../output/final-evolution/browser/',import.meta.url);await mkdir(out,{recursive:true});
const report={scope:'Disposable contexts, real buttons/keyboard, production preview/runtime; no real player data or hosting writes.',cases:[],errors:[],missing:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const viewport=short?{width:667,height:375}:{width:1100,height:900};
const watch=page=>{page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});};
try{
 const ctx=await browser.newContext({viewport,hasTouch:true,reducedMotion:short?'reduce':'no-preference'}),page=await ctx.newPage();watch(page);
 await page.goto('http://127.0.0.1:4178/grappler-vfx-lab.html');await page.waitForFunction(()=>!!window.heroVfxLab);
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 for(const hero of HEROES.filter(h=>!battleOnly&&(!filter||filter.includes(h.id)))){
  await page.locator('#hero').selectOption(hero.id);
  for(const job of getHeroJobs(hero.id).filter(j=>!evolutionOnly&&!trialsOnly&&(!short||j.tier===3))){
   await page.locator(`[data-job="${job.id}"]`).tap();
   assert.equal(await page.locator('#moves [data-action]').count(),3,'one passive + two active previews');
   for(const id of HERO_ACTIVE_SKILLS[hero.id]){
    await page.locator(`[data-action="${id}"]`).tap();await page.locator('#replay').tap();await page.clock.runFor(950);
    const state=await page.evaluate(()=>{const s=window.heroVfxLab.state();return {phase:s.phase,job:s.game.player.job,loadout:s.game.skillLoadout,cast:s.game.skills[s.skillId].remaining};});
    assert.equal(state.job,job.id);assert(state.cast>0,`${job.id}/${id} really casts`);assert.equal(state.loadout.length,2);
    if(job.tier===3)await page.locator('canvas').screenshot({path:fileURLToPath(new URL(`${short?'phone':'desktop'}-${hero.id}-${id}.png`,out))});
    await page.clock.runFor(2000);report.cases.push({hero:hero.id,job:job.id,skill:id,...state});
   }
  }
  await page.locator(`[data-job="${getHeroJobs(hero.id)[2].id}"]`).tap();await page.locator('[data-action="basic"]').tap();
  for(const rank of trialsOnly?[]:short?['a']:['3','a','b']){
   await page.locator(`[data-rank="${rank}"]`).tap();await page.locator('#replay').tap();await page.clock.runFor(1200);
   await page.locator('#pause').tap();assert.equal(await page.evaluate(()=>window.heroVfxLab.state().phase),'paused');
   await page.locator('canvas').screenshot({path:fileURLToPath(new URL(`${short?'phone':'desktop'}-${hero.id}-basic-${rank}.png`,out))});
   await page.locator('#pause').tap();await page.clock.runFor(1200);
   await page.locator('canvas').screenshot({path:fileURLToPath(new URL(`${short?'phone':'desktop'}-${hero.id}-basic-${rank}-later.png`,out))});
  }
  if(!short){
   await page.locator('[data-rank="b"]').tap();
   await page.locator('#scenario').selectOption('survival-orbit');await page.locator('#replay').tap();await page.clock.runFor(24200);
   const trial=await page.evaluate(()=>{const s=window.heroVfxLab.state(),g=s.game;return {elapsed:s.elapsed,phase:g.phase,hp:g.player.hp,kills:g.kills,damage:g.stats.damageTaken,previewMode:!!g.previewMode};});
   assert(trial.kills>0);assert(!trial.previewMode);assert.equal(await page.locator('#pause').isDisabled(),true);report.cases.push({hero:hero.id,trial});
   await page.screenshot({path:fileURLToPath(new URL(`trial-${hero.id}.png`,out))});await page.locator('#scenario').selectOption('formation');
  }
  console.log(`${hero.id}: two-active previews and evolution rendered`);
 }
 if(damageOnly){
  await page.locator('#hero').selectOption('commander');await page.locator('[data-job="blade_master"]').tap();await page.locator('[data-rank="3"]').tap();await page.locator('#scenario').selectOption('survival-orbit');await page.locator('#replay').tap();await page.clock.runFor(24200);
  const failed=await page.evaluate(()=>{const s=window.heroVfxLab.state(),g=s.game;return {phase:g.phase,elapsed:s.elapsed,hp:g.player.hp,damage:g.stats.damageTaken,duration:g.duration,time:g.time,growth:g.growth,previewMode:!!g.previewMode};});
  assert.equal(failed.duration,360);assert.equal(failed.phase,'defeat');assert(failed.damage>0);assert.equal(failed.hp,0);assert(!failed.previewMode);assert((await page.locator('#status').textContent()).includes('已阵亡'));report.cases.push({negativeControl:failed});
  await page.screenshot({path:fileURLToPath(new URL('real-damage-defeat.png',out))});
 }
 assert.equal(await page.evaluate(()=>localStorage.length),0);await ctx.close();
 // Published three-slot payload is injected only into an isolated browser profile.
 const mem=new Map();globalThis.localStorage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v))};const profile=loadProfile().profile;
 for(const h of HEROES){Object.assign(profile.heroes[h.id],{level:6,unlockedJobs:getHeroJobs(h.id).map(j=>j.id)});}profile.cleared=['moss-gate','ember-trail'];
 const gameCtx=await browser.newContext({viewport:short?viewport:{width:844,height:390},hasTouch:true,reducedMotion:short?'reduce':'no-preference'});
 await gameCtx.addInitScript(({key,p})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(p));},{key:STORAGE_KEY,p:profile});
 await gameCtx.route('**/main.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+'\nwindow.__TWO_ACTIVE_QA=()=>({phase:game.phase,hero:game.heroId,job:game.player.job,skills:getSkillState(game),targetInRange:game.enemies.some(e=>!e.dead&&e.spawnDelay<=0&&Math.hypot(e.x-game.player.x,e.y-game.player.y)<280),cooldowns:Object.fromEntries(Object.entries(game.skills).map(([k,v])=>[k,v.remaining]))});'});});
 const gamePage=await gameCtx.newPage();watch(gamePage);await gamePage.goto('http://127.0.0.1:4178/');
 await gamePage.locator('[data-tab="hero"]').first().tap();
 for(const h of HEROES){
  await gamePage.locator(`[data-hero="${h.id}"]`).tap();assert.equal(await gamePage.locator('[data-preview-skill]').count(),2);assert.equal(await gamePage.locator('[data-slot]').count(),2);
  await gamePage.locator(`[data-preview-job="${getHeroJobs(h.id)[2].id}"]`).tap();
  assert.equal(await gamePage.locator('[data-preview-skill]').count(),2);
 }
 await gamePage.locator('[data-hero="blink"]').tap();await gamePage.locator('[data-preview-job="blink_master"]').tap();await gamePage.locator('[data-action="confirm-hero"]').tap();
 await gamePage.screenshot({path:fileURLToPath(new URL(`${short?'phone':'desktop'}-hero-two-active.png`,out))});
 await gamePage.locator('[data-action="back"]').tap();await gamePage.locator('[data-tab="map"]').tap();await gamePage.locator('[data-dungeon="moss-gate"]').tap();await gamePage.locator('[data-action="depart"]').tap();await gamePage.waitForFunction(()=>window.__TWO_ACTIVE_QA?.().phase==='playing');
 assert.equal(await gamePage.locator('#skill-bar button').count(),2);
 await gamePage.keyboard.press('q');await gamePage.waitForFunction(()=>window.__TWO_ACTIVE_QA().skills[0].isReturn);
 assert.equal(await gamePage.locator('[data-skill="markBlade"] .skill-name').textContent(),'返影');
 await gamePage.locator('[data-skill="markBlade"]').tap();await gamePage.waitForFunction(()=>!window.__TWO_ACTIVE_QA().skills[0].isReturn);
 assert(await gamePage.locator('[data-skill="markBlade"]').isDisabled());
 const before=await gamePage.evaluate(()=>window.__TWO_ACTIVE_QA().cooldowns.blinkStrike);await gamePage.keyboard.press('r');assert.equal(await gamePage.evaluate(()=>window.__TWO_ACTIVE_QA().cooldowns.blinkStrike),before);
  await gamePage.waitForFunction(()=>window.__TWO_ACTIVE_QA().targetInRange,{},{timeout:15000});await gamePage.keyboard.press('e');await gamePage.waitForFunction(()=>window.__TWO_ACTIVE_QA().skills[1].remaining>0);assert(await gamePage.locator('[data-skill="blinkStorm"]').isDisabled());
 await gamePage.screenshot({path:fileURLToPath(new URL(`${short?'phone':'desktop'}-battle-two-active.png`,out))});
 const saved=JSON.parse(await gamePage.evaluate(k=>localStorage.getItem(k),STORAGE_KEY));assert.equal(saved.heroes.blink.skillLoadout.length,3);
 await gameCtx.close();assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;
}catch(error){report.passed=false;report.failure={message:error.message,stack:error.stack};throw error;}finally{await writeFile(new URL(`report${short?'-short':''}${damageOnly?'-damage':battleOnly?'-battle':evolutionOnly?'-evolution':trialsOnly?'-trials':''}${filter?'-'+filter.join('-'):''}.json`,out),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length}));
