import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {HEROES,getHeroJobs,HERO_ACTIVE_SKILLS} from '../dist/heroes.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const short=process.argv.includes('--short'),focus=process.argv.includes('--focus');
const filter=process.argv.find(a=>a.startsWith('--heroes='))?.split('=')[1].split(',');
const out=new URL('../output/vfx-polish/browser/',import.meta.url);await mkdir(out,{recursive:true});
const report={cases:[],errors:[],missing:[]},browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const context=await browser.newContext({viewport:short?{width:667,height:375}:{width:1100,height:900},reducedMotion:short?'reduce':'no-preference',hasTouch:true});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
 await page.goto('http://127.0.0.1:4178/grappler-vfx-lab.html');await page.waitForFunction(()=>!!window.heroVfxLab);
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 for(const hero of HEROES.filter(h=>!filter||filter.includes(h.id))){
  await page.locator('#hero').selectOption(hero.id);
  for(const job of getHeroJobs(hero.id).filter(j=>!short&&!focus||j.tier===3)){
   await page.locator(`[data-job="${job.id}"]`).tap();
   for(const action of ['basic',...HERO_ACTIVE_SKILLS[hero.id]]){
    await page.locator(`[data-action="${action}"]`).tap();
    if(action==='basic')await page.locator('[data-rank="a"]').tap();
    await page.locator('#replay').tap();let last=0;
    const frames=short?[600,1500]:action==='blinkStorm'?[160,380,700,1250,1850,2200]:[160,380,700,1250,2200];
    for(const time of frames){await page.clock.runFor(time-last);last=time;if(job.tier===3){await page.locator('canvas').screenshot({path:fileURLToPath(new URL(`${short?'phone':'desktop'}-${hero.id}-${action}-${time}.png`,out))});}}
    const state=await page.evaluate(()=>{const s=window.heroVfxLab.state();return {job:s.game.player.job,phase:s.phase,elapsed:s.elapsed,loadout:s.game.skillLoadout};});
    assert.equal(state.job,job.id);assert.equal(state.loadout.length,2);report.cases.push({hero:hero.id,tier:job.tier,action,...state});
   }
  }
  await page.locator('[data-action="basic"]').tap();await page.locator('[data-rank="b"]').tap();await page.locator('#scenario').selectOption('pressure');await page.locator('#replay').tap();await page.clock.runFor(1300);
  await page.locator('#pause').tap();assert.equal(await page.evaluate(()=>window.heroVfxLab.state().phase),'paused');
  await page.locator('canvas').screenshot({path:fileURLToPath(new URL(`${short?'phone':'desktop'}-${hero.id}-pressure.png`,out))});
  await page.locator('#pause').tap();await page.clock.runFor(500);await page.locator('#scenario').selectOption('formation');
  console.log(`${hero.id}: rendered sequence, A/B and pause/resume checked`);
 }
 assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;
}finally{await writeFile(new URL(`report${short?'-short':''}${focus?'-focus':''}${filter?'-'+filter.join('-'):''}.json`,out),JSON.stringify(report,null,2));await browser.close();}
