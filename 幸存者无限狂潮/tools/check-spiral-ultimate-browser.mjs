import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadProfile,STORAGE_KEY} from '../dist/campaign.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../output/spiral-ultimate/',import.meta.url);await mkdir(out,{recursive:true});
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v))};
const fresh=loadProfile().profile;
const report={passed:false,scope:'Isolated Lv1 save; real touch selects locked stages and replays production simulation/rendering. Route-only observation and stop-time capture freezes frames without changing battle state. No real player save or platform writes.',cases:[],errors:[],missing:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
let page;
async function shot(name){const path=fileURLToPath(new URL(name+'.png',out));await page.screenshot({path});return path;}
async function capture(time){
 await page.evaluate(t=>window.__captureUntil=t,time);await page.locator('[data-action="replay"]').tap();
 await page.waitForFunction(t=>window.__previewAPI.getState().elapsed>=t,time);
 return page.evaluate(()=>{const {game:g,elapsed}=window.__previewAPI.getState(),s=g.mythicHero,v=s.convergence;return {elapsed,job:g.player.job,phase:v?.phase,radius:v?.radius,height:v?.height,clones:s.clones.map(c=>({x:c.x,y:c.y})),orbs:s.orbs.map(o=>({radius:o.radius,phase:o.phase})),caption:document.querySelector('.preview-state').textContent};});
}
try{
 for(const [width,height]of [[844,390],[667,320]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:height===320?'reduce':'no-preference'});
  await context.addInitScript(({key,p})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(p));},{key:STORAGE_KEY,p:fresh});
  await context.route('**/skill-preview.js',async route=>{
   const response=await route.fetch();let body=(await response.text()).replace('export function createSkillPreview(', 'function originalCreateSkillPreview(');
   body=body.replace('if (elapsed >= PREVIEW_SECONDS) stop();','if (elapsed >= (window.__captureUntil ?? PREVIEW_SECONDS)) stop("playing");');
   body+='\nexport function createSkillPreview(options){const api=originalCreateSkillPreview(options);window.__previewAPI=api;return api;}';await route.fulfill({response,body});
  });
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
  await page.goto('http://127.0.0.1:4178/');await page.locator('[data-tab="hero"]').first().tap();await page.locator('[data-hero="spiral"]').tap();
  const baseline=await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY);
  for(const [index,job]of ['shadow_novice','spiral_adept','spiral_sage'].entries()){
   await page.locator('[data-hero-panel="jobs"]').tap();await page.locator(`[data-preview-job="${job}"]`).tap();await page.locator('[data-action="profession-skills"]').tap();
   assert.equal(await page.locator('.preview-job-picker button').count(),3);
   for(const button of await page.locator('.preview-job-picker button').all()){const rect=await button.boundingBox();assert(rect.width>=44&&rect.height>=44,'stage touch target');}
   await page.locator('[data-preview-skill="spiralOrb"]').tap();const q=await capture(1.9);assert.equal(q.job,job);assert(q.orbs.some(o=>o.phase==='grind'));const qImage=await shot(`${width}-tier${index+1}-q`);
   await page.locator('[data-preview-skill="spiralConvergence"]').tap();const phases=[];
   for(const [phase,time]of [['gather',.95],['descend',1.35],['grind',1.85],['burst',3.0]]){
    const state=await capture(time);assert.equal(state.job,job);assert.equal(state.phase,phase);assert.equal(state.clones.length,index+2);assert(state.radius>=q.orbs.find(o=>o.phase==='grind').radius*1.8);
    phases.push({...state,image:await shot(`${width}-tier${index+1}-${phase}`)});
   }
   assert(phases[0].height>phases[1].height&&phases[1].height>phases[2].height,'visible downward travel');
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY),baseline,'preview must not change save');
   report.cases.push({width,tier:index+1,job,q,qImage,phases});
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;
}catch(error){report.failure={message:error.message,stack:error.stack};if(page&&!page.isClosed())report.failure.image=await shot('failure');throw error;}
finally{await writeFile(new URL('browser-report.json',out),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length}));
