import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {HEROES,getHeroJobs} from '../dist/heroes.js';
import {recommendedSkills} from '../dist/profession-content.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../output/all-hero-vfx/',import.meta.url);await mkdir(out,{recursive:true});
const filter=process.argv.find(a=>a.startsWith('--heroes='))?.split('=')[1].split(',');
const short=process.argv.includes('--short');
const review=process.argv.includes('--review');
const reviewActions={commander:['basic','cleave','whirlwind'],summoner:['summonElite'],blink:['basic','markBlade'],mage:['basic','flameBreath','frostAura','rockWall'],rift:['basic','riftBarrage'],magnet:['magnetLance','magnetCrush'],spiral:['spiralOrb','spiralClone','spiralConvergence'],petal:['basic']};
const heroes=HEROES.filter(h=>(!filter||filter.includes(h.id))&&(!review||reviewActions[h.id]));
const report={scope:'Isolated real button input with production simulation/renderer. No player storage or platform writes. Screenshots are visual review evidence, not proof of finished art.',cases:[],errors:[],missing:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const reportName=`report${filter?'-'+filter.join('-'):''}${short?'-short':''}${review?'-review':''}.json`;
async function save(){await writeFile(new URL(reportName,out),JSON.stringify(report,null,2));}
try{
 const context=await browser.newContext({viewport:short?{width:667,height:375}:{width:1100,height:1000},hasTouch:true,reducedMotion:short?'reduce':'no-preference'});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
 await page.goto('http://127.0.0.1:4178/grappler-vfx-lab.html');await page.waitForFunction(()=>!!window.heroVfxLab);
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 const snapshot=()=>page.evaluate(()=>{const s=window.heroVfxLab.state(),g=s.game;return {elapsed:s.elapsed,phase:s.phase,job:g.player.job,hero:g.heroId,skill:s.skillId,cooldown:g.skills[s.skillId]?.remaining,player:{x:g.player.x,y:g.player.y},effects:g.heroEffects.map(e=>({kind:e.visualKind,style:e.style,life:e.life})),damage:g.enemies.reduce((n,e)=>n+e.maxHp-e.hp,0),special:g.specialHero&&{held:g.specialHero.heldSlots.length,motions:g.specialHero.motions.map(m=>m.kind),throws:g.specialHero.throws.length,ammo:g.specialHero.scraps.length,bolts:g.specialHero.bolts.length,beams:g.specialHero.beams.length,heat:g.specialHero.heat},mythic:g.mythicHero&&{swords:g.mythicHero.swords.length,petals:g.mythicHero.petals.map(p=>p.phase),orbs:g.mythicHero.orbs.length,union:g.mythicHero.union?.phase,convergence:g.mythicHero.convergence?.phase,clones:g.mythicHero.clones.length},original:g.originalHero&&{momentum:g.originalHero.momentum,corpses:g.originalHero.corpses.length,fusion:!!g.originalHero.fusion},companions:g.companions.length};});
 for(const hero of heroes){
  await page.locator('#hero').selectOption(hero.id);
  const jobs=getHeroJobs(hero.id);
  for(const job of short||review&&hero.id==='petal'?[jobs[2]]:jobs){
   await page.locator(`[data-job="${job.id}"]`).tap();
   for(const action of review?reviewActions[hero.id]:['basic',...recommendedSkills(job.id,6,hero.skills.map(s=>s.id))]){
    await page.locator(`[data-action="${action}"]`).tap();
    for(const rank of action==='basic'?(short?['a','b']:review?(hero.id==='petal'?['1']:hero.id==='rift'?['3','b']:['3']):['1','2','3','a','b']):['1']){
     if(action==='basic')await page.locator(`[data-rank="${rank}"]`).tap();
     await page.locator('#replay').tap();const baseline=await snapshot();
     const times=action==='basic'?[.24,1.6,3]:short?[.8,1.6,2.3]:review&&action==='rockWall'?[.64,.9,1,1.1,1.3,1.6,2.3]:[.64,.8,1.1,1.6,2.3,3.1];let previous=0;const samples=[];
     for(const at of times){await page.clock.runFor(Math.round((at-previous)*1000));previous=at;const state=await snapshot();assert.equal(state.hero,hero.id);assert.equal(state.job,job.id);
      const path=fileURLToPath(new URL(`${short?'667':'1100'}-${hero.id}-${job.tier}-${action}-${rank}-${at}.png`,out));await page.locator('canvas').screenshot({path});samples.push({at,...state,path});
     }
     if(action==='basic')assert(samples.some(s=>s.damage>baseline.damage),`${hero.id} tier ${job.tier} basic ${rank} actually hits`);
     else assert(samples.some(s=>s.cooldown>0),`${hero.id} tier ${job.tier} ${action} actually casts`);
     report.cases.push({hero:hero.id,tier:job.tier,job:job.id,action,rank,baseline,samples});await save();
    }
   }
  }
  console.log(`${hero.id}: ${short?'reduced motion phone':'all tiers, basics and skills'} captured`);
 }
 await page.locator('#speed').selectOption('0.35');await page.locator('#replay').tap();await page.clock.runFor(1000);const slow=await snapshot();assert(slow.elapsed>.3&&slow.elapsed<.4);
 await page.locator('#pause').tap();const frozen=await snapshot();await page.clock.runFor(800);assert.deepEqual(await snapshot(),frozen);await page.locator('#pause').tap();await page.clock.runFor(300);assert((await snapshot()).elapsed>frozen.elapsed);
 assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);
 await page.screenshot({path:fileURLToPath(new URL(short?'phone-workbench.png':'workbench.png',out))});
 if(short){
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:fileURLToPath(new URL('phone-workbench-full.png',out)),fullPage:true});
  await page.locator('#fullscreen').tap();await page.waitForFunction(()=>!!document.fullscreenElement);
  await page.clock.runFor(300);
  const bounds=await page.locator('canvas').boundingBox();assert(bounds.width>=660&&bounds.height>=300,'phone fullscreen keeps a useful stage');
  await page.screenshot({path:fileURLToPath(new URL('phone-fullscreen.png',out))});
  await page.locator('#fullscreen').tap();await page.waitForFunction(()=>!document.fullscreenElement);
  report.phoneFullscreen=true;
 }
 report.passed=true;
}catch(error){report.passed=false;report.failure={message:error.message,stack:error.stack};throw error;}finally{await save();await browser.close();}
console.log(JSON.stringify({passed:true,cases:report.cases.length,report:reportName}));
