import {STORAGE_KEY} from '../dist/campaign.js';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const OUT=path.resolve(import.meta.dirname,'../output/blink-rework');await mkdir(OUT,{recursive:true});
const report={cases:[],errors:[],scope:'Isolated Edge; real CDP touch. Fixtures only arrange anchors/enemies and stop unrelated waves; no player HP/invulnerability changes.'};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
function assert(v,m){if(!v)throw Error(m)}
try { for(const [width,height,reduced] of [[844,390,false],[667,320,true]]) {
 const c=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',reducedMotion:reduced?'reduce':'no-preference'});
 await c.route('**/main.js',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text())+'\nwindow.__BLINK_QA={game:()=>game};'});});
 await c.route('**/skill-preview.js',async r=>{const response=await r.fetch();let source=(await response.text()).replaceAll("\r\n","\n");source=source.replace('  return {\n    select,','  const controller = {\n    select,').replace('  };\n}\n\nexport const SKILL_PREVIEW_IDS','  };\n  window.__BLINK_PREVIEW=controller;\n  return controller;\n}\n\nexport const SKILL_PREVIEW_IDS');await r.fulfill({response,body:source});});
 const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto('http://127.0.0.1:4178/');await p.locator('.campaign-shell:not(.is-hidden)').waitFor({timeout:35000});
 await p.locator('[data-tab="hero"]').click();await p.locator('[data-hero="blink"]').click();
 await p.locator('[data-tab="map"]').click();await p.locator('[data-action="depart"]').click();await p.waitForFunction(()=>window.__BLINK_QA.game().phase==='playing');
 const storage=await p.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
 const cdp=await c.newCDPSession(p);
 async function arrange(){return p.evaluate(()=>{const g=window.__BLINK_QA.game();g.enemies=[];g.enemyHazards=[];g.enemyProjectiles=[];g.effects=[];g._spawnClock=999;g._eliteWaves=3;g._attackClock=999;g.player.x=900;g.player.y=900;g.heroState.blinkAnchors=[{id:90001,x:1080,y:900,remaining:14,maxLife:14},{id:90002,x:1380,y:900,remaining:14,maxLife:14},{id:90003,x:1080,y:1040,remaining:14,maxLife:14}];g.skills.blinkStrike.remaining=0;g.skills.blinkStorm.remaining=0;return {hp:g.player.hp};})}
 async function drag(skill,dx=0,dy=0,release='touchEnd'){const b=await p.locator(`[data-skill="${skill}"]`).boundingBox();const start={x:b.x+b.width/2,y:b.y+b.height/2,id:1};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});if(dx||dy)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...start,x:start.x+dx,y:start.y+dy}]});await p.waitForTimeout(60);const aim=await p.evaluate(()=>window.__BLINK_QA.game().skillAim);return {aim,end:async()=>cdp.send('Input.dispatchTouchEvent',{type:release,touchPoints:[]})};}
 await arrange();let tap=await drag('blinkStrike');assert(tap.aim.anchorId===90001,'tap nearest');await tap.end();await p.waitForTimeout(300);assert(await p.evaluate(()=>Math.abs(window.__BLINK_QA.game().player.x-1080)<1),'tap nearest landing');
 await arrange();let d=await drag('blinkStrike',24,0);assert(d.aim.anchorId===90001,'near E');await p.screenshot({path:path.join(OUT,`near-${width}.png`)});await d.end();await p.waitForTimeout(300);let pos=await p.evaluate(()=>({x:window.__BLINK_QA.game().player.x,y:window.__BLINK_QA.game().player.y}));assert(Math.abs(pos.x-1080)<1,'near landing');
 await arrange();d=await drag('blinkStrike',64,0);assert(d.aim.anchorId===90002,'far E');await p.screenshot({path:path.join(OUT,`offscreen-${width}.png`)});await d.end();await p.waitForTimeout(300);pos=await p.evaluate(()=>({x:window.__BLINK_QA.game().player.x,y:window.__BLINK_QA.game().player.y}));assert(Math.abs(pos.x-1380)<1,'screen independent far landing');
 await arrange();d=await drag('blinkStrike',-145,0);assert(d.aim.cancelled,'drag cancel');await d.end();assert(await p.evaluate(()=>window.__BLINK_QA.game().skills.blinkStrike.remaining===0),'cancel CD');
 await arrange();d=await drag('blinkStrike',24,0,'touchCancel');await d.end();assert(await p.evaluate(()=>!window.__BLINK_QA.game().skillAim&&window.__BLINK_QA.game().skills.blinkStrike.remaining===0),'pointercancel');
 await arrange();d=await drag('blinkStrike',64,0);await p.evaluate(()=>window.__BLINK_QA.game().heroState.blinkAnchors=window.__BLINK_QA.game().heroState.blinkAnchors.filter(a=>a.id!==90002));await d.end();assert(await p.evaluate(()=>window.__BLINK_QA.game().skills.blinkStrike.remaining===0),'invalid explicit ID should reject');
 await arrange();d=await drag('blinkStorm');await p.screenshot({path:path.join(OUT,`storm-route-${width}.png`)});await d.end();const route=await p.evaluate(()=>window.__BLINK_QA.game().heroState.blinkTravel?.route.map(a=>a.id));assert(route?.length===5,'R complete route');await p.waitForTimeout(850);pos=await p.evaluate(()=>({x:window.__BLINK_QA.game().player.x,y:window.__BLINK_QA.game().player.y}));assert(Math.abs(pos.x-1080)<1&&Math.abs(pos.y-900)<1,'R final anchor');
 await arrange();await p.evaluate(()=>{const g=window.__BLINK_QA.game();g.heroState.blinkAnchors=[];g.skills.markBlade.remaining=0;});d=await drag('markBlade',30,0);await d.end();await p.waitForTimeout(650);const q=await p.evaluate(()=>{const g=window.__BLINK_QA.game();return {anchors:g.heroState.blinkAnchors.map(a=>({x:a.x,y:a.y,targetId:a.targetId})),hp:g.player.hp};});assert(q.anchors.length===1&&!q.anchors[0].targetId,'Q ground anchor');
 assert(await p.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)===storage,'battle test wrote storage');
 await p.goto('http://127.0.0.1:4178/');await p.locator('.campaign-shell:not(.is-hidden)').waitFor();await p.locator('[data-tab="hero"]').click();const previewStorage=await p.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);const previews=[];
 for(const skill of ['blinkStrike','blinkStorm']){await p.locator(`[data-preview-skill="${skill}"]`).click();await p.locator('[data-action="replay"]').click();await p.waitForTimeout(700);const state=await p.evaluate(()=>{const s=window.__BLINK_PREVIEW.getState(),g=s.game;return {skill:s.skillId,anchors:g.heroState.blinkAnchors.length,travel:g.heroState.blinkTravel?.route.length,cd:g.skills[s.skillId].remaining};});assert(state.anchors===3&&state.cd>0,'preview real skill');previews.push(state);await p.screenshot({path:path.join(OUT,`preview-${skill}-${width}.png`)});}
 assert(await p.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)===previewStorage,'preview storage');
 report.cases.push({q,previews,width,height,reduced,near:true,farOffscreen:true,cancel:true,pointerCancel:true,expiredExplicit:true,stormRoute:route,final:pos,storageUnchanged:true});await c.close();
 }}catch(e){report.errors.push(e.stack)}finally{await browser.close();await writeFile(path.join(OUT,'browser-report.json'),JSON.stringify(report,null,2));}
if(report.errors.length)throw Error(report.errors.join('\n'));
console.log(JSON.stringify(report));

