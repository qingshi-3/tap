import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {HEROES,getHeroJobs} from '../dist/heroes.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const short=process.argv.includes('--short'),filter=process.argv.find(a=>a.startsWith('--heroes='))?.split('=')[1].split(',');
const out=new URL('../output/basic-pressure/browser/',import.meta.url);await mkdir(out,{recursive:true});
const report={scope:'Isolated production preview with a fixed 72-enemy zero-contact-damage wave; no active skills or player storage. Not a survival/balance claim.',cases:[],errors:[],missing:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const ctx=await browser.newContext({viewport:short?{width:667,height:375}:{width:1100,height:950},hasTouch:true,reducedMotion:short?'reduce':'no-preference'});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
 await page.goto('http://127.0.0.1:4178/grappler-vfx-lab.html');await page.waitForFunction(()=>!!window.heroVfxLab);
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 for(const hero of HEROES.filter(h=>!filter||filter.includes(h.id))){
  await page.locator('#hero').selectOption(hero.id);
  await page.locator('#scenario').selectOption('pressure');
  for(const job of getHeroJobs(hero.id).filter(j=>short?j.tier===3:j.tier>=2)){
   await page.locator(`[data-job="${job.id}"]`).tap();
   for(const rank of short?['a']:['3','a','b']){
    await page.locator(`[data-rank="${rank}"]`).tap();await page.locator('#replay').tap();
    const initial=await page.evaluate(()=>{const g=window.heroVfxLab.state().game;return {x:g.player.x,y:g.player.y,enemies:g.enemies.length};});assert.equal(initial.enemies,72);
    let previous=0;const samples=[];
    for(const at of[1.2,3,6,12.1]){await page.clock.runFor(Math.round((at-previous)*1000));previous=at;
     const state=await page.evaluate(()=>{const s=window.heroVfxLab.state(),g=s.game;return {phase:s.phase,hero:g.heroId,job:g.player.job,elapsed:s.elapsed,kills:g.kills,x:g.player.x,y:g.player.y,living:g.enemies.filter(e=>!e.dead).length,cooldowns:Object.values(g.skills).map(s=>s.remaining)};});
     assert.equal(state.hero,hero.id);assert.equal(state.job,job.id);assert.equal(state.x,initial.x);assert.equal(state.y,initial.y);assert(state.cooldowns.every(n=>n===0),'no active skill used');
     const path=fileURLToPath(new URL(`${short?'667':'1100'}-${hero.id}-${job.tier}-${rank}-${at}.png`,out));await page.locator('canvas').screenshot({path});samples.push({...state,path});
    }
    assert(samples.at(-1).kills>0,`${hero.id}/${job.id}/${rank} clears actual enemies`);assert.equal(samples.at(-1).phase,'complete');report.cases.push({hero:hero.id,tier:job.tier,rank,samples});
   }
  }
  console.log(`${hero.id}: pressure playback checked`);
 }
 await page.locator('#pause').isDisabled().then(disabled=>assert(disabled,'completed preview pause disabled'));
 await page.locator('#scenario').selectOption('formation');await page.locator('#replay').tap();await page.clock.runFor(350);assert.equal(await page.evaluate(()=>window.heroVfxLab.state().game.enemies.length),15);
 if(short){await page.locator('#fullscreen').tap();await page.waitForFunction(()=>!!document.fullscreenElement);await page.clock.runFor(200);await page.screenshot({path:fileURLToPath(new URL('phone-fullscreen.png',out))});await page.locator('#fullscreen').tap();await page.waitForFunction(()=>!document.fullscreenElement);}
 assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;
}catch(error){report.passed=false;report.failure={message:error.message,stack:error.stack};throw error;}finally{await writeFile(new URL(`report${filter?'-'+filter.join('-'):''}${short?'-short':''}.json`,out),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:true,cases:report.cases.length}));
