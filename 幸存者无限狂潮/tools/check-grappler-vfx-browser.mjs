import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../output/grappler-vfx/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={cases:[],errors:[],missing:[],scope:'Disposable browser contexts. Real production preview and renderer; normal input, slowed/paused playback. No player save or platform writes.'};
const focus=process.argv.includes('--focus');
try{
 for(const [width,height,reduced] of [[1100,900,false],[667,375,true]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:reduced?'reduce':'no-preference'}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
  await page.goto('http://127.0.0.1:4178/grappler-vfx-lab.html');await page.waitForFunction(()=>!!window.grapplerVfxLab);
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
  const snapshot=()=>page.evaluate(()=>{const s=window.grapplerVfxLab.state(),g=s.game;return {elapsed:s.elapsed,phase:s.phase,job:g.player.job,held:g.specialHero?.heldSlots.length,motions:g.specialHero?.motions.map(m=>m.kind),throws:g.specialHero?.throws.length,combo:g.specialHero?.combo,effects:g.heroEffects.map(f=>f.style),damage:g.enemies.reduce((n,e)=>n+e.maxHp-e.hp,0)};});
  for(const job of ['brawler','grappler','titan_grappler']){
   await page.locator(`[data-job="${job}"]`).tap();
   for(const action of focus?['basic']:['basic','grappleHook','grappleSlam','grappleClash']){
    await page.locator(`[data-action="${action}"]`).tap();
    for(const rank of action==='basic'?(focus?['2','3']:['1','2','3','a','b']):['1']){
     if(action==='basic')await page.locator(`[data-rank="${rank}"]`).tap();
     await page.locator('#replay').tap();
     const times=action==='basic'?[.2,.82,1.44,1.62]:[.64,.78,.96,1.2,1.42];let last=0;const samples=[];
     for(const time of times){await page.clock.runFor(Math.round((time-last)*1000));last=time;const state=await snapshot();assert.equal(state.job,job);
      const path=fileURLToPath(new URL(`${width}-${job}-${action}-${rank}-${time}.png`,out));
      await page.locator('canvas').screenshot({path});samples.push({time,...state,path});
     }
     assert(samples.some(s=>s.damage>0),`${job} ${action} ${rank} deals damage`);
     report.cases.push({width,height,reduced,job,action,rank,samples});
    }
   }
  }
  await page.locator('#speed').selectOption('0.35');await page.locator('#replay').tap();await page.clock.runFor(1000);const slow=await snapshot();assert(slow.elapsed>.3&&slow.elapsed<.4);
  await page.locator('#pause').tap();const paused=await snapshot();await page.clock.runFor(600);assert.deepEqual(await snapshot(),paused);await page.locator('#pause').tap();await page.clock.runFor(300);assert((await snapshot()).elapsed>paused.elapsed);
  await page.locator('[data-job="brawler"]').focus();await page.keyboard.press('Enter');assert.equal((await snapshot()).job,'brawler');
  await page.screenshot({path:fileURLToPath(new URL(`${width}-workbench.png`,out))});
  assert.equal(await page.evaluate(()=>localStorage.length),0,'workbench never creates or changes a profile');
  await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;
}finally{await writeFile(new URL(focus?'focus-report.json':'report.json',out),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,errors:report.errors,missing:report.missing}));

