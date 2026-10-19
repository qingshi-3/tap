import {STORAGE_KEY} from '../dist/campaign.js';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=path.resolve(import.meta.dirname,'../output/vfx-full-fix/live');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={scope:'Isolated real-time browser with controlled dense enemies/loadouts; actual touch Q/E. Not natural balance or physical-phone performance.',cases:[],errors:[]};
const assert=(ok,message)=>{if(!ok)throw Error(message)};
try{
 for(const [width,height,reduced] of [[844,390,false],[667,320,false],[667,320,true]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:reduced?'reduce':'no-preference'});
  await context.route('**/main.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.__VFX_LIVE={game:()=>game};'});});
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&r.url().startsWith('http://127.0.0.1:4178/'))report.errors.push(`${r.status()} ${r.url()}`)});
  await p.goto('http://127.0.0.1:4178/');await p.locator('.campaign-shell:not(.is-hidden)').waitFor({timeout:35000});
  await p.locator('[data-tab="hero"]').click();await p.locator('[data-hero="blink"]').click();await p.locator('[data-tab="map"]').click();await p.locator('[data-action="depart"]').click();
  await p.waitForFunction(()=>window.__VFX_LIVE?.game().phase==='playing');
  const storage=await p.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  const cdp=await context.newCDPSession(p);
  const shot=await p.locator('[data-skill="markBlade"]').boundingBox();
  await p.evaluate(()=>{const g=window.__VFX_LIVE.game();g._spawnClock=999;g._eliteWaves=3;g._nextSupplyAt=999;g.enemies=[];g.announcement={text:'',remaining:0};});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:shot.x+shot.width/2,y:shot.y+shot.height/2,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await p.waitForFunction(()=>window.__VFX_LIVE.game().heroState.blinkAnchors.length===1);
  await p.waitForTimeout(1000);await p.screenshot({path:path.join(out,`dagger-settled-${width}-${reduced}.png`)});
  const anchor=await p.evaluate(()=>{const g=window.__VFX_LIVE.game(),a=g.heroState.blinkAnchors[0];g.enemies=Array.from({length:36},(_,i)=>({id:8000+i,kind:'grunt',x:a.x+Math.cos(i*2.4)*(18+5*(i%8)),y:a.y+Math.sin(i*2.4)*(18+5*(i%8)),radius:12,hp:1e7,maxHp:1e7,speed:0,damage:0,xp:0,spawnDelay:0,anim:'idle',animTime:0}));return{x:a.x,y:a.y};});
  await p.waitForTimeout(200);await p.screenshot({path:path.join(out,`dagger-crowded-${width}-${reduced}.png`)});
  await p.waitForFunction(()=>window.__VFX_LIVE.game().heroState.blinkAnchors[0]?.remaining<6,{},{timeout:14000});await p.screenshot({path:path.join(out,`dagger-age8-${width}-${reduced}.png`)});
  await p.waitForFunction(()=>window.__VFX_LIVE.game().heroState.blinkAnchors[0]?.remaining<2,{},{timeout:7000});await p.screenshot({path:path.join(out,`dagger-expiring-${width}-${reduced}.png`)});
  const e=await p.locator('[data-skill="blinkStrike"]').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:e.x+e.width/2,y:e.y+e.height/2,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(300);
  const landed=await p.evaluate(()=>({x:window.__VFX_LIVE.game().player.x,y:window.__VFX_LIVE.game().player.y}));assert(Math.hypot(landed.x-anchor.x,landed.y-anchor.y)<1,'touch E reaches late-life glowing anchor');
  for(const ids of [['nova','beam'],['meteor','mine'],['frost','vortex'],['familiar','aegis']]){
   await p.evaluate(ids=>{const g=window.__VFX_LIVE.game(),q=g.player;g.heroState.blinkAnchors=[];g.commonEffects=[];g.commonEntities=[];g.heroEffects=[];g.effects=[];g._commonAegis=null;g.evolutions={};for(const k of Object.keys(g.upgrades))g.upgrades[k]=0;
    for(const id of ids){g.upgrades[id]=4;g.evolutions[id]=id==='mine'||id==='familiar'?'b':'a';}g._commonClocks=Object.fromEntries(ids.map(id=>[id,.12]));
    g.enemies=Array.from({length:48},(_,i)=>({id:10000+i,kind:'grunt',x:q.x+Math.cos(i*2.4)*(55+18*(i%9)),y:q.y+Math.sin(i*2.4)*(55+18*(i%9)),radius:12,hp:1e7,maxHp:1e7,speed:0,damage:0,xp:0,spawnDelay:0,anim:'idle',animTime:0}));
   },ids);
   await p.waitForTimeout(230);await p.screenshot({path:path.join(out,`${ids.join('-')}-${width}-${reduced}-early.png`)});
   await p.waitForTimeout(800);await p.screenshot({path:path.join(out,`${ids.join('-')}-${width}-${reduced}-hold.png`)});
   if(ids.includes('familiar')){await p.waitForTimeout(1200);await p.screenshot({path:path.join(out,`familiar-firing-${width}-${reduced}.png`)});}
  }
  assert(await p.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)===storage,'unexpected save mutation');
  report.cases.push({width,height,reduced,anchor,landed,storageUnchanged:true,denseEnemies:48});await context.close();
 }
}catch(e){report.errors.push(e.stack)}finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));if(report.errors.length)process.exitCode=1;
