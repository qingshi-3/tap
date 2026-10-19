import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadProfile,STORAGE_KEY} from '../dist/campaign.js';
import {HEROES,getHeroJobs} from '../dist/heroes.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),out=new URL('../output/hero-ascension/preview-fix/',import.meta.url);
await mkdir(out,{recursive:true});
const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};
const fresh=loadProfile().profile;
const report={passed:false,scope:'Isolated fresh Lv1 profiles. Real touch previews locked promoted stages; read-only observation of production preview API. No real player storage or platform writes.',stages:[],weapons:[],errors:[],console:[],missing:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
let page;
async function state(){return page.evaluate(()=>{const s=window.__previewAPIs.at(-1).getState(),g=s.game;return {phase:s.phase,elapsed:s.elapsed,skill:s.skillId,job:g?.player.job,kind:g?.player.kind,animSource:g?.player.animSource,swords:g?.mythicHero?.swords.length,tier:g?.mythicHero?.tier,cooldown:g?.skills[s.skillId]?.remaining,attack:g?.attackProgress};});}
async function shot(name){const path=fileURLToPath(new URL(name+'.png',out));await page.screenshot({path});return path;}
async function replay(){await page.locator('[data-action="replay"]').tap();await page.waitForFunction(()=>window.__previewAPIs.at(-1).getState().elapsed>.7);}
async function raw(){return page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);}
async function pickHero(id){await page.locator(`[data-hero="${id}"]`).scrollIntoViewIfNeeded();await page.locator(`[data-hero="${id}"]`).tap();if(await page.locator('[data-action="confirm-hero"]').isEnabled())await page.locator('[data-action="confirm-hero"]').tap();}
try{
 for(const [width,height] of [[844,390],[667,320]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:height===320?'reduce':'no-preference'});
  await context.addInitScript(({key,p})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(p));},{key:STORAGE_KEY,p:fresh});
  await context.route('**/skill-preview.js',async route=>{const response=await route.fetch();let body=(await response.text()).replace('export function createSkillPreview(', 'function originalCreateSkillPreview(');body+='\nexport function createSkillPreview(options){const api=originalCreateSkillPreview(options);(window.__previewAPIs ||= []).push(api);return api;}';await route.fulfill({response,body});});
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))report.console.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.missing.push({url:r.url(),status:r.status()});});
  await page.goto('http://127.0.0.1:4178/');await page.locator('[data-tab="hero"]').first().tap();
  const heroes=height===390?HEROES:HEROES.filter(h=>['commander','sword','spiral','petal'].includes(h.id));
  for(const hero of heroes){
   await pickHero(hero.id);const baseline=await raw(),job=getHeroJobs(hero.id)[2];
   await page.locator('[data-hero-panel="jobs"]').tap();await page.locator(`[data-preview-job="${job.id}"]`).tap();
   if(['commander','sword'].includes(hero.id))await shot(`${hero.id}-${width}-profession-entry`);
   await page.locator('[data-action="profession-skills"]').tap();await replay();
   const s=await state();assert.equal(s.job,job.id,`${hero.id}: locked T3 must be actual preview job`);assert(s.cooldown>0,`${hero.id}: preview actually casts`);assert.equal(await raw(),baseline,'preview does not ascend, equip or persist');
   const image=await shot(`${hero.id}-${width}-locked-third-skill`);report.stages.push({hero:hero.id,width,...s,image});
   if(hero.id==='commander'){
    await page.locator('[data-preview-skill="bladeWave"]').tap();await replay();assert.equal((await state()).job,job.id);assert(await page.locator('[data-equip="bladeWave"]').isDisabled(),'locked future skill cannot equip');
    await page.locator('[data-preview-job="fighter"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-preview-skill="bladeWave"]').count(),0,'base stage cannot silently show another job skill');assert.equal((await state()).job,'fighter');assert.equal(await raw(),baseline);
   }
   if(hero.id==='sword'){
    await page.locator('[data-hero-panel="attacks"]').tap();
    for(const [stage,count] of [['1',1],['2',3],['3',5],['a',10],['b',8]]){await page.locator(`[data-attack-stage="${stage}"]`).tap();await replay();const w=await state();assert.equal(w.job,'sword_sage');assert.equal(w.swords,count);assert.notEqual(w.animSource,'auto','T3 has no player basic animation');report.weapons.push({width,stage,...w});}
    await shot(`sword-${width}-third-eight-swords`);
    for(const [jobId,count]of [['sword_apprentice',1],['sword_adept',2],['sword_sage',1]]){await page.locator(`[data-preview-job="${jobId}"]`).tap();await page.locator('[data-attack-stage="1"]').tap();await replay();assert.equal((await state()).job,jobId);assert.equal((await state()).swords,count);}
    await page.locator('[data-hero-panel="skills"]').tap();assert.equal((await state()).job,'sword_sage','stage survives tab switch');assert.equal(await raw(),baseline);
   }
  }
  await pickHero('sword');assert.equal((await state()).job,'sword_apprentice','hero change resets to actual stage');
  assert(await page.evaluate(()=>window.__previewAPIs.slice(0,-1).every(p=>p.getState().phase==='disposed')),'all replaced previews disposed');
  await page.reload();await page.locator('[data-tab="hero"]').first().tap();await page.locator('[data-hero-panel="skills"]').waitFor();assert.equal((await state()).job,'sword_apprentice','reload remains unpromoted');
  if(width===844){
   const ready=structuredClone(fresh);ready.selectedHero='sword';ready.heroes.sword.level=6;ready.cleared=['moss-gate','ember-trail'];ready.progression.dungeonWins={'moss-gate':1,'ember-trail':1};
   await page.evaluate(({key,p})=>localStorage.setItem(key,JSON.stringify(p)),{key:STORAGE_KEY,p:ready});await page.reload();await page.locator('[data-tab="hero"]').first().tap();
   for(const [jobId,quest]of [['sword_adept','ascend-sword-2'],['sword_sage','ascend-sword-3']]){
    await page.locator('[data-hero-panel="jobs"]').tap();await page.locator(`[data-preview-job="${jobId}"]`).tap();await page.locator(`[data-claim="${quest}"]`).tap();await page.locator('[data-action="confirm-hero"]').tap();await page.locator('[data-hero-panel="skills"]').tap();
    assert.equal((await state()).job,jobId,'explicit tier selection updates preview stage');assert.equal(JSON.parse(await raw()).heroes.sword.job,jobId);
   }
   report.actualAscensionSync=true;
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.console,[]);assert.deepEqual(report.missing,[]);report.passed=true;
}catch(error){report.failure={message:error.message,stack:error.stack};if(page&&!page.isClosed())report.failure.image=await shot('failure');throw error;}
finally{await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,lockedStagePreviews:report.stages.length,weaponStates:report.weapons.length}));
