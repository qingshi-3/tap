import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadProfile,STORAGE_KEY,validateProfile} from '../dist/campaign.js';
import {getHeroJobs} from '../dist/heroes.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../output/new-heroes/browser/',import.meta.url);await mkdir(out,{recursive:true});
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))};
const template=loadProfile().profile;
const hook=`
import {__qaSpawnEnemy} from './simulation.js';
import {getSpecialHeroAim as __qaAimGeometry} from './special-heroes.js';
window.__HERO_QA={fixture:false,
 state(){const s=game.specialHero;return {phase:game.phase,time:game.time,aim:game.skillAim?{...game.skillAim}:null,aimGeometry:game.skillAim?__qaAimGeometry(game,game.skillAim.id,game.skillAim):null,hero:game.heroId,job:game.player.job,player:{x:game.player.x,y:game.player.y,hp:game.player.hp},skills:getSkillState(game),special:s?{tier:s.tier,combo:s.combo,heldId:s.heldId,motions:s.motions.length,throws:s.throws.length,gates:s.gates.map(g=>({x:g.x,y:g.y,remaining:g.remaining})),echoGates:s.echoGates.length,bolts:s.bolts.length,scraps:s.scraps.length,fieldTime:s.fieldTime,fieldCaptured:s.fieldCaptured||0,trails:s.trails.length}:null,enemies:game.enemies.filter(e=>e.qaFixed).map(e=>({id:e.id,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,held:!!e.specialHeld})),shots:game.enemyProjectiles.length,effects:game.heroEffects.filter(e=>e.visualKind==='newHero').map(e=>({style:e.style,life:e.life})),profile:JSON.parse(JSON.stringify(profile))};},
 prepare(){this.fixture=true;game.player.invulnerable=1e6;game.player.xpNext=1e8;game.mapObjects=[];game.enemies=[];game.enemyProjectiles=[];game.supplies=[];game.gems=[];game.spawnClock=1e6;game._nextSupplyAt=1e8;game._eliteWaves=3;game.announcement={text:'',remaining:0};
  for(const [dx,dy] of [[90,0],[140,10],[190,-10],[230,30],[75,-55],[115,60]]){const e=__qaSpawnEnemy(game,'grunt',false,true);Object.assign(e,{x:game.player.x+dx,y:game.player.y+dy,hp:1e6,maxHp:1e6,speed:0,damage:0,spawnDelay:0,frozen:1000,qaFixed:true});}
  return this.state();},
 bullets(){for(let i=0;i<3;i++)game.enemyProjectiles.push({id:game._nextId++,x:game.player.x+65+i*20,y:game.player.y-15+i*15,vx:-35,vy:0,radius:8,damage:8,life:10,kind:'enemyOrb',ownerId:game.enemies[0]?.id});return this.state();},
 tick(){if(this.fixture){game.player.invulnerable=1e6;game.player.xpNext=1e8;}},
 natural(){this.fixture=false;}
};`;
const aimOnly=process.argv.includes('--aim-only'),reportFile=aimOnly?'aim-report.json':'report.json';
const report={passed:false,scope:'Disposable isolated profiles; actual touch hero selection, tier claims, switching, replay, deployment, Q/E/R drag, movement, pause/resume and return. Combat fixtures are fixed high-HP zero-damage enemies, protected player and injected ordinary arrows; no direct skill casting. Additional natural ten-second input probes use production spawns. Not natural clears, physical phone, TapTap host or performance acceptance.',cases:[],natural:[]};
if(process.argv.includes('--resume')&&!aimOnly){const previous=JSON.parse(await readFile(new URL(reportFile,out),'utf8'));report.cases=previous.cases||[];report.natural=previous.natural||[];}
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
let current;
async function shot(page,name){const path=fileURLToPath(new URL(name+'.png',out));await page.screenshot({path});return path;}
async function openHero(page,id){await page.locator('[data-tab="hero"]').first().tap();await page.locator(`[data-hero="${id}"]`).scrollIntoViewIfNeeded();await page.locator(`[data-hero="${id}"]`).tap();await page.locator('[data-hero-panel="jobs"]').tap();}
async function depart(page){await page.locator('[data-action="back"]').tap();await page.locator('[data-tab="map"]').tap();await page.locator('[data-dungeon="moss-gate"]').tap();await page.locator('[data-action="depart"]').tap();await page.waitForFunction(()=>window.__HERO_QA?.state().phase==='playing');}
async function returnHome(page){await page.locator('#pause').tap();await page.locator('#return-title').tap();await page.locator('#confirm-yes').tap();await page.locator('[data-tab="hero"]').first().waitFor();}
async function drag(cdp,start,end,duration=90){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...end,id:1}]});await new Promise(r=>setTimeout(r,duration));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
async function skillDrag(page,cdp,id){const b=await page.locator(`[data-skill="${id}"]`).boundingBox();assert(b);assert(b.width>=44&&b.height>=44,`skill target ${id}`);const start={x:b.x+b.width/2,y:b.y+b.height/2};await drag(cdp,start,{x:start.x+48,y:start.y});}
async function contextFor(width,height){
 const p=structuredClone(template);p.cleared=['moss-gate','ember-trail'];p.progression.dungeonWins={'moss-gate':1,'ember-trail':1};for(const id of ['grappler','rift','magnet'])p.heroes[id].level=6;if(aimOnly)for(const id of ['grappler','rift','magnet'])p.heroes[id].unlockedJobs=getHeroJobs(id).map(j=>j.id);assert(validateProfile(p));
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:height===320?'reduce':'no-preference'});
 await context.addInitScript(({key,p})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(p));},{key:STORAGE_KEY,p});
 await context.route('**/main.js',async route=>{const response=await route.fetch();const body=(await response.text()).replace('updateGame(game,dt,x||y?{x,y}:stick?movement:{x:0,y:0});','window.__HERO_QA?.tick();updateGame(game,dt,x||y?{x,y}:stick?movement:{x:0,y:0});');await route.fulfill({response,body:body+hook});});
 await context.route('**/simulation.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nexport {spawnEnemy as __qaSpawnEnemy};'});});
 const page=await context.newPage(),errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push({url:r.url(),status:r.status()});});await page.goto('http://127.0.0.1:4178/');await page.locator('[data-tab="hero"]').first().waitFor();return {context,page,errors,missing,cdp:await context.newCDPSession(page)};
}
try{
 if(aimOnly){
  for(const [width,height] of [[844,390],[667,320]]){
   current=await contextFor(width,height);const {page,context,cdp,errors,missing}=current;
   for(const id of ['grappler','rift','magnet'])for(const tier of [1,3]){
    await openHero(page,id);const job=getHeroJobs(id).find(j=>j.tier===tier);await page.locator(`[data-preview-job="${job.id}"]`).tap();const switcher=page.locator(`[data-job="${job.id}"]`);if(await switcher.count())await switcher.tap();await depart(page);await page.evaluate(()=>window.__HERO_QA.prepare());await page.waitForTimeout(120);if(id==='magnet')await page.evaluate(()=>window.__HERO_QA.bullets());
    const captures=[],skills=await page.evaluate(()=>window.__HERO_QA.state().profile.heroes[window.__HERO_QA.state().profile.selectedHero].skillLoadout);
    if(id==='grappler'&&tier===1){const b=await page.locator('[data-skill="grappleHook"]').boundingBox(),a={x:b.x+b.width/2,y:b.y+b.height/2},before=await page.evaluate(()=>window.__HERO_QA.state());await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+150,y:a.y-20,id:1}]});await page.waitForTimeout(80);assert((await page.evaluate(()=>window.__HERO_QA.state().aim)).cancelled);await shot(page,`grappler-1-${width}-cancel-aim`);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const after=await page.evaluate(()=>window.__HERO_QA.state());assert.equal(after.skills.find(s=>s.id==='grappleHook').remaining,0);assert.equal(after.effects.filter(e=>e.style==='grappleHook').length,before.effects.filter(e=>e.style==='grappleHook').length);}
    if(id==='rift'){const e=page.locator('[data-skill="riftStep"]'),b=await e.boundingBox(),a={x:b.x+b.width/2,y:b.y+b.height/2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+48,y:a.y,id:1}]});await page.waitForTimeout(80);const unavailable=await page.evaluate(()=>window.__HERO_QA.state().aimGeometry);assert.equal(unavailable,null,'disabled no-gate E does not create fake aim');assert(await e.isDisabled());await shot(page,`${id}-${tier}-${width}-no-gate-aim`);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>window.__HERO_QA.state().skills.find(s=>s.id==='riftStep').remaining),0);}
    for(const skill of skills){const beforeSkill=await page.evaluate(()=>window.__HERO_QA.state());const box=await page.locator(`[data-skill="${skill}"]`).boundingBox(),start={x:box.x+box.width/2,y:box.y+box.height/2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(skill===skills[1]?0:48),y:start.y-(skill===skills[1]?48:0),id:1}]});await page.waitForTimeout(100);const aim=await page.evaluate(()=>window.__HERO_QA.state().aim);assert.equal(aim.id,skill);if(skill===skills[1])assert.equal(aim.x,0,'vertical aim retains zero x');const geometry=await page.evaluate(()=>window.__HERO_QA.state().aimGeometry);assert(geometry);const screenshot=await shot(page,`${id}-${tier}-${width}-${skill}-aim`);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(360);const state=await page.evaluate(()=>window.__HERO_QA.state());assert(state.skills.find(s=>s.id===skill).remaining>0);if(skill==='magnetField')assert(state.special.fieldCaptured>0,'ordinary enemyOrb captured through actual Q');if(skill==='grappleSlam'&&tier>=2){assert(beforeSkill.special.heldId,'Q has held a light enemy');assert(state.special.throws>0,'E launches held enemy');assert.equal(state.special.heldId,null);}if(skill==='riftStep'){const gate=beforeSkill.special.gates[0];assert(Math.hypot(state.player.x-gate.x,state.player.y-gate.y)<1,'E arrives at previous real gate');}if(skill==='magnetLance'){assert(beforeSkill.special.scraps>0);assert(state.special.scraps<beforeSkill.special.scraps,'E consumes collected scraps');}captures.push({skill,aim,geometry,screenshot,before:{special:beforeSkill.special,player:beforeSkill.player},after:{special:state.special,player:state.player},special:state.special});}
    await returnHome(page);report.cases.push({hero:id,tier,width,height,captures,cancelVerified:id==='grappler'&&tier===1,noGateLockedVerified:id==='rift',verticalAimVerified:true,errors:[...errors],missing:[...missing]});assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log(`${id} tier${tier} ${width}: real drag aim shapes and release`);await writeFile(new URL(reportFile,out),JSON.stringify(report,null,2));
   }await context.close();current=null;
  }
 }
 for(const [width,height] of aimOnly?[]:[[844,390],[667,320]]){
  current=await contextFor(width,height);const {page,context,cdp,errors,missing}=current;
  for(const id of ['grappler','rift','magnet']){
   await openHero(page,id);const jobs=getHeroJobs(id);
   for(const job of jobs){
    await page.locator(`[data-preview-job="${job.id}"]`).tap();
    if(job.tier>1){await page.locator(`[data-claim="${job.questId}"]`).tap();await page.locator(`[data-job="${job.id}"]`).tap();}
    assert.equal(await page.evaluate(id=>window.__HERO_QA.state().profile.heroes[id].job,id),job.id);
    if(report.cases.some(c=>c.hero===id&&c.tier===job.tier&&c.width===width))continue;
    const professionShot=await shot(page,`${id}-${job.tier}-${width}-profession`);
    await page.locator('[data-action="profession-details"]').tap();assert(await page.locator('.profession-info').isVisible());await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement?.tagName==='BUTTON'));await page.keyboard.press('Escape');
    await page.reload();await page.locator('[data-tab="hero"]').first().waitFor();assert.equal(await page.evaluate(id=>window.__HERO_QA.state().profile.heroes[id].job,id),job.id);await openHero(page,id);
    await page.locator('[data-hero-panel="skills"]').tap();const skillIds=await page.evaluate(id=>window.__HERO_QA.state().profile.heroes[id].skillLoadout,id);
    for(const skill of skillIds){await page.locator(`[data-preview-skill="${skill}"]`).tap();await page.locator('[data-action="replay"]').tap();await page.waitForTimeout(150);}
    const previewShot=await shot(page,`${id}-${job.tier}-${width}-preview`);
    await depart(page);const initial=await page.evaluate(()=>window.__HERO_QA.prepare());assert.equal(initial.job,job.id);await page.waitForTimeout(150);
    if(id==='magnet')await page.evaluate(()=>window.__HERO_QA.bullets());
    const casts=[];
    for(const skill of skillIds){const before=await page.evaluate(()=>window.__HERO_QA.state());await skillDrag(page,cdp,skill);await page.waitForTimeout(70);const after=await page.evaluate(()=>window.__HERO_QA.state());assert(after.skills.find(s=>s.id===skill).remaining>0,`${id} tier${job.tier} ${skill} did not cast`);casts.push({skill,before:before.special,after:after.special});if(skill===skillIds[0])await page.waitForTimeout(330);}
    const combatShot=await shot(page,`${id}-${job.tier}-${width}-combat`);await page.waitForTimeout(650);const combat=await page.evaluate(()=>window.__HERO_QA.state());assert(combat.enemies.some(e=>e.hp<e.maxHp),'production damage reaches fixed enemies');assert.equal(combat.special.tier,job.tier);
    if(id==='rift')assert(combat.special.gates.length>0,'real far gate persists after Q/E/R');
    if(id==='magnet')assert(casts[0].after.fieldTime>0,'Q starts field');
    const beforeMove=await page.evaluate(()=>window.__HERO_QA.state().player);await drag(cdp,{x:90,y:height-70},{x:150,y:height-70},350);const afterMove=await page.evaluate(()=>window.__HERO_QA.state().player);const moved=Math.hypot(afterMove.x-beforeMove.x,afterMove.y-beforeMove.y);assert(moved>20);
    await page.locator('#pause').tap();await page.locator('#pause-dialog[open]').waitFor();const frozen=await page.evaluate(()=>window.__HERO_QA.state());await page.waitForTimeout(180);const frozenAgain=await page.evaluate(()=>window.__HERO_QA.state());assert.equal(frozenAgain.time,frozen.time);assert.deepEqual(frozenAgain.special,frozen.special);await page.locator('#resume').tap();await page.waitForFunction(()=>window.__HERO_QA.state().phase==='playing');
    await returnHome(page);assert.equal(await page.evaluate(()=>window.__HERO_QA.state().special),null,'return clears run state');await openHero(page,id);
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);report.cases.push({hero:id,tier:job.tier,job:job.id,width,height,reducedMotion:height===320,professionShot,previewShot,combatShot,casts,combat:{damage:combat.enemies.reduce((n,e)=>n+e.maxHp-e.hp,0),special:combat.special},moved,persistence:true,pauseFrozen:true,cleanup:true,errors:[...errors],missing:[...missing]});await writeFile(new URL(reportFile,out),JSON.stringify(report,null,2));console.log(`${id} tier${job.tier} ${width}: progression, preview, touch casts, damage, pause, cleanup`);
   }
   if(!report.natural.some(n=>n.hero===id&&n.width===width)){
   // Additional production spawning and input without the fixed combat fixture.
   await page.evaluate(()=>window.__HERO_QA.natural());await depart(page);await drag(cdp,{x:90,y:height-70},{x:135,y:height-95},800);for(const skill of await page.evaluate(()=>window.__HERO_QA.state().profile.heroes[window.__HERO_QA.state().profile.selectedHero].skillLoadout)){await skillDrag(page,cdp,skill);await page.waitForTimeout(350);}const naturalStart=await page.evaluate(()=>window.__HERO_QA.state().time),deadline=Date.now()+30000;while(await page.evaluate(()=>window.__HERO_QA.state().time)<naturalStart+10){assert(Date.now()<deadline,'natural ten-second probe stalled');if(await page.evaluate(()=>window.__HERO_QA.state().phase)==='upgrade'){await page.waitForTimeout(300);await page.locator('#upgrade-choices button').first().tap();}await page.waitForTimeout(250);}const natural=await page.evaluate(()=>window.__HERO_QA.state());assert.equal(natural.phase,'playing');const screenshot=await shot(page,`${id}-${width}-natural-10s`);report.natural.push({hero:id,width,height,time:natural.time,hp:natural.player.hp,screenshot,scope:'production spawning and player input, ten seconds; not complete clear'});await returnHome(page);
   }else{await page.locator('[data-action="back"]').tap();}
  }
  await page.locator('[data-tab="hero"]').first().tap();const last=page.locator('[data-hero="magnet"]');await last.scrollIntoViewIfNeeded();await last.tap();assert(await last.getAttribute('aria-pressed')==='true');const rosterScroll=await page.locator('.hero-roster').evaluate(n=>({scrollTop:n.scrollTop,scrollHeight:n.scrollHeight,clientHeight:n.clientHeight}));assert(rosterScroll.scrollHeight>rosterScroll.clientHeight);assert(rosterScroll.scrollTop>0);assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);await context.close();current=null;
 }
 report.passed=true;
}catch(error){report.error={message:error.message,stack:error.stack};if(current){report.failureScreenshot=await shot(current.page,'failure');report.pageErrors=current.errors;report.missing=current.missing;}throw error;}
finally{await writeFile(new URL(reportFile,out),JSON.stringify(report,null,2));await browser.close();}
