import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadProfile,STORAGE_KEY,validateProfile} from '../dist/campaign.js';
import {HEROES,getHeroJobs} from '../dist/heroes.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'),{chromium}=require('playwright');
const out=new URL('../output/hero-progression/battle-browser/',import.meta.url);await mkdir(out,{recursive:true});
const mem=new Map();globalThis.localStorage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v))};
const p=loadProfile().profile;p.cleared=['moss-gate','ember-trail'];p.progression.dungeonWins={'moss-gate':1,'ember-trail':1};
for(const hero of HEROES){Object.assign(p.heroes[hero.id],{level:6,job:getHeroJobs(hero.id)[2].id,unlockedJobs:getHeroJobs(hero.id).map(j=>j.id),skillLoadout:hero.skills.map(s=>s.id)});}assert(validateProfile(p));
const hook=`
window.__RESEARCH_QA={
 state(){return {phase:game.phase,time:game.time,hero:game.heroId,player:{x:game.player.x,y:game.player.y,hp:game.player.hp},skills:getSkillState(game),aim:game.skillAim,damage:game.stats.damageDealt,entities:{mythic:!!game.mythicHero,special:!!game.specialHero,original:!!game.originalHero},spiral:game.mythicHero?.convergence?{x:game.mythicHero.convergence.x,y:game.mythicHero.convergence.y,angle:game.mythicHero.convergence.angle,phase:game.mythicHero.convergence.phase}:null};},
 prepare(){game.player.invulnerable=1e6;game.player.xpNext=1e8;game.mapObjects=[];game.enemies=[];game.enemyProjectiles=[];game.gems=[];game._spawnClock=1e6;game._nextSupplyAt=1e8;game._eliteWaves=3;game.announcement={text:'',remaining:0};for(const [x,y]of [[70,0],[100,0],[150,15],[220,0],[90,-45],[140,45]])game.enemies.push({id:game._nextId++,kind:'grunt',x:game.player.x+x,y:game.player.y+y,radius:18,hp:1e6,maxHp:1e6,speed:0,damage:0,xp:0,spawnDelay:0,anim:'idle',animTime:0,aiClock:999,contactClock:999});}
};`;
const report={passed:false,scope:'Isolated all-promoted fixture. Real touch drag/release/cancel, joystick motion, pause/resume/return. No cast callbacks called from evaluate. High-HP zero-damage enemies for observable mechanics; not natural encounter balance.',cases:[],errors:[],missing:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});let page;
const shot=async name=>{const path=fileURLToPath(new URL(name+'.png',out));await page.screenshot({path});return path;};
async function touch(cdp,a,b,ms=80){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:1}]});await page.waitForTimeout(ms);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
async function skill(cdp,id,cancel=false,vertical=false){const r=await page.locator(`[data-skill="${id}"]`).boundingBox();assert(r?.width>=44&&r?.height>=44);const a={x:r.x+r.width/2,y:r.y+r.height/2};await touch(cdp,a,{x:a.x+(vertical?0:cancel?150:46),y:a.y+(vertical?-46:0)});}
try{
 for(const [width,height]of [[844,390],[667,320]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:height===320?'reduce':'no-preference'});
  await context.addInitScript(({key,p})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(p));},{key:STORAGE_KEY,p});
  await context.route('**/main.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+hook});});
  page=await context.newPage();const cdp=await context.newCDPSession(page);page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});await page.goto('http://127.0.0.1:4178/');
  for(const hero of HEROES){
   await page.locator('[data-tab="hero"]').first().tap();await page.locator(`[data-hero="${hero.id}"]`).tap();if(await page.locator('[data-action="confirm-hero"]').isEnabled())await page.locator('[data-action="confirm-hero"]').tap();await page.locator('[data-action="back"]').tap();await page.locator('[data-tab="map"]').tap();await page.locator('[data-dungeon="moss-gate"]').tap();await page.locator('[data-action="depart"]').tap();await page.waitForFunction(()=>window.__RESEARCH_QA?.state().phase==='playing');await page.evaluate(()=>window.__RESEARCH_QA.prepare());
   const ids=hero.skills.map(s=>s.id);await skill(cdp,ids[0],true);assert.equal(await page.evaluate(id=>window.__RESEARCH_QA.state().skills.find(s=>s.id===id).remaining,ids[0]),0,'cancel must not cast');
   const images=[];for(const [i,id]of ids.entries()){await skill(cdp,id,false,hero.id==='blink'&&i===1);await page.waitForTimeout(i===2?180:350);assert(await page.evaluate(id=>window.__RESEARCH_QA.state().skills.find(s=>s.id===id).remaining>0,id),`${hero.id} ${id} touch cast`);images.push(await shot(`${width}-${hero.id}-${id}`));}
   const before=await page.evaluate(()=>window.__RESEARCH_QA.state());await touch(cdp,{x:85,y:height-65},{x:145,y:height-65},360);const moved=await page.evaluate(()=>window.__RESEARCH_QA.state());assert(Math.hypot(moved.player.x-before.player.x,moved.player.y-before.player.y)>20);
   if(hero.id==='spiral'){assert(before.spiral&&moved.spiral);assert(Math.hypot(moved.spiral.x-before.spiral.x,moved.spiral.y-before.spiral.y)>15);images.push(await shot(`${width}-spiral-moved-held`));}
   await page.locator('#pause').tap();await page.locator('#pause-dialog[open]').waitFor();const frozen=await page.evaluate(()=>window.__RESEARCH_QA.state());await page.waitForTimeout(180);assert.deepEqual(await page.evaluate(()=>window.__RESEARCH_QA.state()),frozen);await page.locator('#resume').tap();await page.waitForTimeout(300);const result=await page.evaluate(()=>window.__RESEARCH_QA.state());assert(result.damage>0);
   await page.locator('#pause').tap();await page.locator('#return-title').tap();await page.locator('#confirm-yes').tap();await page.locator('[data-tab="hero"]').first().waitFor();assert.deepEqual(await page.evaluate(()=>window.__RESEARCH_QA.state().entities),{mythic:false,special:false,original:false});
   report.cases.push({width,hero:hero.id,images,movement:Math.hypot(moved.player.x-before.player.x,moved.player.y-before.player.y),damage:result.damage,cancel:true,pause:true,cleanup:true});await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));
  }await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;
}catch(e){report.failure={message:e.message,stack:e.stack,image:page&&!page.isClosed()?await shot('failure'):null};throw e;}
finally{await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length}));
