import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const OUT=path.resolve(import.meta.dirname,'../output/release-readiness');
const url=process.env.STORE_PREVIEW_URL||'http://127.0.0.1:4178/';
const report={scope:'Current client, fresh isolated browser storage, actual UI input and natural combat; no gameplay state injection.',screenshots:[],errors:[]};
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'});
 await context.route('**/main.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.__STORE_READ_STATE=()=>({phase:game.phase,time:game.time,hp:game.player.hp,heroId:game.heroId,enemies:game.enemies.filter(e=>!e.dead).length});'});});
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 await page.goto(url);await page.locator('.campaign-shell:not(.is-hidden)').waitFor({timeout:35000});
 async function capture(name,note){await page.screenshot({path:path.join(OUT,name)});report.screenshots.push({name,note,viewport:page.viewportSize(),state:await page.evaluate(()=>window.__STORE_READ_STATE?.())});}
 await page.locator('[data-tab="hero"]').click();await page.locator('[data-hero="mage"]').click();await page.locator('[data-hero-panel="jobs"]').click();await page.locator('[data-preview-job="mage_master"]').click();await page.locator('[data-action="profession-attack"]').click();await page.waitForTimeout(120);await capture('store-profession.png','Actual locked element sage preview and profession path; no profession unlock or purchase.');
 await page.locator('[data-tab="map"]').click();await page.waitForTimeout(100);await capture('store-expedition.png','Actual first expedition scene and briefing.');
 await page.locator('[data-action="depart"]').click();await page.waitForFunction(()=>window.__STORE_READ_STATE?.().phase==='playing');
 const cdp=await context.newCDPSession(page);
 async function move(dx,dy,ms){const box=await page.locator('#battle').boundingBox(),start={x:box.x+110,y:box.y+box.height-85,id:1};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...start,x:start.x+dx,y:start.y+dy}]});await page.waitForTimeout(ms);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 async function cast(id,dx=0,dy=0){const box=await page.locator(`[data-skill="${id}"]`).boundingBox();if(!box)throw Error('missing active skill '+id);const start={x:box.x+box.width/2,y:box.y+box.height/2,id:2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});if(dx||dy)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...start,x:start.x+dx,y:start.y+dy}]});await page.waitForTimeout(60);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 for(let i=0;i<35;i++){let state=await page.evaluate(()=>window.__STORE_READ_STATE());if(state.phase==='defeat'||state.phase==='victory')throw Error('Natural battle ended before selected screenshot; review existing frames, do not inject health.');if(await page.locator('#upgrade-dialog').isVisible()){await page.locator('#upgrade-choices button').first().click();await page.waitForTimeout(350);}if(state.time>=14)break;if(i%3===0)await move(i%2?48:-48,i%2?-15:15,450);await page.waitForTimeout(600);}
 async function settleGrowth(){for(let i=0;i<12;i++){const state=await page.evaluate(()=>window.__STORE_READ_STATE());if(state.phase==='playing')return;if(await page.locator('#upgrade-dialog').isVisible())await page.locator('#upgrade-choices button').first().click();await page.waitForTimeout(100);}throw Error('Could not settle natural growth before combat capture');}
 await settleGrowth();
 await cast('frostAura',-35,-15);await page.waitForTimeout(300);await cast('flameBreath',-50,0);await page.waitForTimeout(220);await settleGrowth();await capture('store-battle.png','Natural first expedition combat with actual element skills; no enemy/effect fixtures or player health edits.');
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(350);if(await page.locator('#upgrade-dialog').isVisible()){await page.locator('#upgrade-choices button').first().click();await page.waitForTimeout(500);}await page.waitForFunction(()=>window.__STORE_READ_STATE().phase==='playing');await capture('store-battle-mobile.png','Same naturally running combat at short landscape viewport; adaptation evidence.');
 report.naturalObservation={wallLimitSeconds:45,samples:[]};const observationStart=Date.now();
 for(let i=0;Date.now()-observationStart<45000;i++){
  const state=await page.evaluate(()=>window.__STORE_READ_STATE());report.naturalObservation.samples.push(state);
  if(['defeat','victory'].includes(state.phase)){report.naturalObservation.outcome=state.phase;report.naturalObservation.final=state;await capture('store-observation-end.png','Natural run result for internal observation; not proposed store screenshot.');break;}
  if(await page.locator('#upgrade-dialog').isVisible()){await page.locator('#upgrade-choices button').first().click();await page.waitForTimeout(450);continue;}
  if(state.phase==='playing'){await move(i%2?52:-52,i%3?-18:18,550);if(i%7===0)await cast('flameBreath',-50,0);if(i%11===0)await cast('rockWall',-40,0);}
  await page.waitForTimeout(250);
 }
 if(!report.naturalObservation.outcome){report.naturalObservation.outcome='observation_window_ended';report.naturalObservation.final=await page.evaluate(()=>window.__STORE_READ_STATE());}
 report.naturalObservation.wallSeconds=(Date.now()-observationStart)/1000;
 report.completedAt=new Date().toISOString();await context.close();if(report.errors.length)throw Error(report.errors.join('; '));
} catch(error){report.errors.push(error.stack||String(error));process.exitCode=1;} finally{await browser.close();await writeFile(path.join(OUT,'capture-report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({screenshots:report.screenshots.map(x=>x.name),errors:report.errors.length}));
