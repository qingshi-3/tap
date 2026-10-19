import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadProfile,STORAGE_KEY} from '../dist/campaign.js';
import {HEROES,getHeroJobs} from '../dist/heroes.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../output/hero-progression/browser/',import.meta.url);await mkdir(out,{recursive:true});
const mem=new Map();globalThis.localStorage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v))};
const fresh=loadProfile().profile,spiralOnly=process.argv.includes('--spiral'),finalReview=process.argv.includes('--final');
const report={passed:false,scope:'Disposable profile. Real touch navigation, career/skill/weapon selection and replay. Production simulation/rendering; route exposes read-only preview state and stops at requested time. No player save/platform writes.',cases:[],errors:[],missing:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});let page;
async function screenshot(name){const path=fileURLToPath(new URL(name+'.png',out));await page.screenshot({path});return path;}
async function capture(time){await page.evaluate(t=>window.__captureUntil=t,time);await page.locator('[data-action="replay"]').tap();await page.waitForFunction(t=>window.__previewAPI?.getState().elapsed>=t,time);return page.evaluate(()=>{const {game:g,elapsed}=window.__previewAPI.getState(),s=g.mythicHero;return {elapsed,job:g.player.job,castPhase:g.phase,player:{x:g.player.x,y:g.player.y},convergence:s?.convergence?{phase:s.convergence.phase,x:s.convergence.x,y:s.convergence.y,angle:s.convergence.angle}:null,clones:s?.clones?.length,orbs:s?.orbs?.map(o=>({phase:o.phase,large:o.large,x:o.x,y:o.y})),caption:document.querySelector('.preview-state')?.textContent};});}
try{
 for(const [width,height]of [[844,390],[667,320]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:height===320?'reduce':'no-preference'});
  await context.addInitScript(({key,p})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(p));},{key:STORAGE_KEY,p:fresh});
  await context.route('**/skill-preview.js',async route=>{const response=await route.fetch();let body=(await response.text()).replace('export function createSkillPreview(', 'function originalCreateSkillPreview(').replace('if (elapsed >= PREVIEW_SECONDS) stop();','if (elapsed >= (window.__captureUntil ?? PREVIEW_SECONDS)) stop("playing");');body+='\nexport function createSkillPreview(options){const api=originalCreateSkillPreview(options);window.__previewAPI=api;return api;}';await route.fulfill({response,body});});
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
  await page.goto('http://127.0.0.1:4178/');await page.locator('[data-tab="hero"]').first().tap();
  for(const hero of HEROES.filter(h=>!spiralOnly||h.id==='spiral')){
   await page.locator(`[data-hero="${hero.id}"]`).tap();const baseline=await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY);
   for(const job of getHeroJobs(hero.id).filter(j=>!finalReview||j.tier===3)){
    await page.locator('[data-hero-panel="jobs"]').tap();await page.locator(`[data-preview-job="${job.id}"]`).tap();await page.locator('[data-action="profession-skills"]').tap();
    assert.equal(await page.locator('.preview-job-picker button').count(),3);
    for(const b of await page.locator('.preview-job-picker button').all()){const r=await b.boundingBox();assert(r.width>=44&&r.height>=44);}
    for(const skill of hero.skills){
     const instant=['dash','cleave','frostAura','rockWall','markBlade','blinkStrike','recallSummons','grappleSlam','petalPierce'];
     await page.locator(`[data-preview-skill="${skill.id}"]`).tap();const state=await capture(finalReview&&instant.includes(skill.id)?.72:1.8);assert.equal(state.job,job.id);assert.equal(state.castPhase,'playing');
     const row={width,hero:hero.id,job:job.id,skill:skill.id,state,image:await screenshot(`${width}-${job.id}-${skill.id}`)};
     if(skill.id==='spiralConvergence'){assert.equal(state.convergence?.phase,'held');row.release=await capture(2.65);assert.equal(row.release.convergence?.phase,job.tier>=2?'roll':'held');assert.equal(state.clones,job.tier===3?4:0);row.releaseImage=await screenshot(`${width}-${job.id}-release`);}
     if(skill.id==='spiralOrb')assert(state.orbs.some(o=>o.large&&o.phase==='grind'));
     report.cases.push(row);
    }
    if(!spiralOnly){
     await page.locator('[data-hero-panel="attacks"]').tap();
     for(const rank of finalReview?['2','b']:['1','2','3','a','b']){
      await page.locator(`[data-attack-stage="${rank}"]`).tap();const state=await capture(1.55);assert.equal(state.job,job.id);
      report.cases.push({width,hero:hero.id,job:job.id,rank,state,...(['1','a','b'].includes(rank)?{image:await screenshot(`${width}-${job.id}-basic-${rank}`)}:{})});
     }
    }
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY),baseline,'previews must preserve profile bytes');
   }
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;
}catch(error){report.failure={message:error.message,stack:error.stack};if(page&&!page.isClosed())report.failure.image=await screenshot('failure');throw error;}
finally{await writeFile(new URL(spiralOnly?'spiral-report.json':finalReview?'final-report.json':'report.json',out),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length}));
