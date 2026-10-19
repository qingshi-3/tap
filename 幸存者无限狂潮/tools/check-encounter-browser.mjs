import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadProfile,STORAGE_KEY,validateProfile,DUNGEONS} from '../dist/campaign.js';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v))};
const template=loadProfile().profile;
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),out=new URL('../output/encounter-tuning/browser/',import.meta.url);
await mkdir(out,{recursive:true});
const hook=`
window.__ENCOUNTER_QA={state:()=>({time:game.time,phase:game.phase,dungeon:game.dungeon.id,encounter:game.encounter,player:{x:game.player.x,y:game.player.y},ordinary:game.enemies.filter(e=>!e.dead&&!e.elite&&!e.boss).reduce((a,e)=>(a[e.kind]=(a[e.kind]||0)+1,a),{}),shots:game.enemyProjectiles.filter(s=>s.kind==='enemyOrb').length,warnings:game.enemies.filter(e=>!e.dead&&e.attackWarning?.type==='shot').length}),prepare(stage){
 const g=game;g._seed=941;g.player.invulnerable=1e6;g.player.xpNext=1e8;
 g.mapObjects=[];g.gems=[];g.supplies=[];g.enemies=[];g._eliteWaves=3;g._nextSupplyAt=1e8;g._spawnClock=0;
 g.time=stage*60*g.duration/360+.1;g._stageIndex=0;
 // Production spawn, AI and collision run unchanged; protected player and skipped elites isolate the ordinary composition.
 for(let i=0;i<900;i++)updateGame(g,1/60,{x:Math.cos(i/180),y:Math.sin(i/180)});
 const shots=new Set();for(let i=0;i<600;i++){updateGame(g,1/60,{x:0,y:0});for(const shot of g.enemyProjectiles)if(shot.kind==='enemyOrb')shots.add(shot.id);}
 g.announcement={text:g.encounter.name,remaining:2.8};
 return {...this.state(),observedOrdinaryShots:shots.size};
}};`;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={scope:'Isolated profiles; actual touch navigation/movement/pause; mid-run clock fixtures with protected player and ordinary waves only. Not natural-run or TapTap phone balance validation.',cases:[]};
try{
 for(const [width,height] of [[844,390],[667,320]])for(const dungeon of DUNGEONS){
  if(width===667&&!['moss-gate','ember-trail'].includes(dungeon.id))continue;
  const p=structuredClone(template);p.cleared=['moss-gate'];p.progression.dungeonWins={'moss-gate':1};
  p.selectedHero=({'summoner-trial':'summoner','blink-trial':'blink','mage-trial':'mage'})[dungeon.id]||'commander';p.heroes[p.selectedHero].level=3;assert(validateProfile(p));
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:height===320?'reduce':'no-preference'});
  await context.addInitScript(({key,profile})=>localStorage.setItem(key,JSON.stringify(profile)),{key:STORAGE_KEY,profile:p});
  await context.route('**/main.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+hook});});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4178/');await page.locator('[data-tab="map"]').tap();await page.locator(`[data-dungeon="${dungeon.id}"]`).tap();await page.locator('[data-action="depart"]').tap();
  await page.waitForFunction(()=>window.__ENCOUNTER_QA?.state().phase==='playing');
  const initial=await page.evaluate(()=>window.__ENCOUNTER_QA.state());assert.equal(initial.dungeon,dungeon.id);
  const seeded=await page.evaluate(()=>window.__ENCOUNTER_QA.prepare(3));assert.equal(seeded.phase,'playing');
  assert(Object.keys(seeded.ordinary).every(kind=>dungeon.enemies.includes(kind)));assert(seeded.shots+seeded.warnings<=6);assert(seeded.warnings<=2);
  if(dungeon.id==='moss-gate')assert((seeded.ordinary.archer_elite||0)<=6);
  if(['moss-gate','ember-trail'].includes(dungeon.id)&&!seeded.observedOrdinaryShots){
   // A short viewport can still be displaying a valid aim warning at the sampling boundary.
   await page.waitForFunction(()=>window.__ENCOUNTER_QA.state().shots>0,{},{timeout:10000});seeded.liveFrameShotVerified=true;
  }
  const screenshot=fileURLToPath(new URL(`${dungeon.id}-${width}.png`,out));await page.screenshot({path:screenshot});
  const before=await page.evaluate(()=>window.__ENCOUNTER_QA.state().player),cdp=await context.newCDPSession(page),point={x:100,y:height-72,id:1};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:point.x+65}]});
  await page.waitForTimeout(320);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const moved=await page.evaluate(b=>{const p=window.__ENCOUNTER_QA.state().player;return Math.hypot(p.x-b.x,p.y-b.y);},before);assert(moved>20);
  await page.locator('#pause').tap();await page.locator('#pause-dialog[open]').waitFor();const t=await page.evaluate(()=>window.__ENCOUNTER_QA.state().time);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.__ENCOUNTER_QA.state().time),t);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__ENCOUNTER_QA.state().phase==='playing');
  assert.deepEqual(errors,[]);report.cases.push({id:dungeon.id,width,height,initial:initial.encounter,sampled:seeded,moved,paused:true,errors,screenshot});await context.close();
 }
 await writeFile(new URL('report.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.cases.map(({id,width,sampled,moved})=>({id,width,ordinary:sampled.ordinary,shots:sampled.shots,warnings:sampled.warnings,moved})),null,2));
}finally{await browser.close();}
