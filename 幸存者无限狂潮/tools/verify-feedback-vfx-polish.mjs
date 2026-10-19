import {STORAGE_KEY} from '../dist/campaign.js';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const OUT=path.resolve(import.meta.dirname,'../output/blink-vfx-polish');await mkdir(OUT,{recursive:true});
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

 await p.waitForFunction(()=>window.__BLINK_QA.game().enemies.some(e=>!e.dead&&e.spawnDelay<=0&&e.kind==='grunt'),{},{timeout:20000});
 const before=await p.evaluate(()=>{const g=window.__BLINK_QA.game(),e=g.enemies.find(e=>!e.dead&&e.spawnDelay<=0&&e.kind==='grunt');g.enemies=[e];e.x=g.player.x+58;e.y=g.player.y;return {hp:g.player.hp,x:g.player.x,enemyId:e.id,enemyKind:e.kind};});
 const start={x:160,y:height-70,id:1};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...start,x:start.x+34}]});
 await p.waitForFunction(hp=>window.__BLINK_QA.game().player.hp<hp,before.hp,{timeout:10000,polling:'raf'});
 await p.screenshot({path:path.join(OUT,`hit-natural-${width}.png`)});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const after=await p.evaluate(()=>{const g=window.__BLINK_QA.game();return {hp:g.player.hp,x:g.player.x,contactDamage:g.stats.damageTakenBySource.contact,hitEvents:g.effects.filter(e=>e.type==='hit').length};});assert(after.hp<before.hp&&after.contactDamage>0&&after.x>before.x,'real movement/contact damage');
 await p.evaluate(()=>{const g=window.__BLINK_QA.game();g.enemies=[];g._spawnClock=999;g._attackClock=999;g.commonEffects=[];g.commonEntities=[];g.heroEffects=[];g.enemyHazards=[];g.announcement={text:"",remaining:0};g.effects=[{type:'heal',x:g.player.x-90,y:g.player.y-40,life:.8,maxLife:1},{type:'slash',x:g.player.x+90,y:g.player.y-40,angle:.3,life:.8,maxLife:1},{type:'radial',x:g.player.x,y:g.player.y+45,radius:80,life:.6,maxLife:1}];});await p.screenshot({path:path.join(OUT,`inactive-feedback-fixture-${width}.png`)});
 assert(await p.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)===storage,'battle test wrote storage');report.cases.push({width,height,reduced,before,after,fixture:'Repositioned one naturally spawned grunt 58 units right; touch moved player into contact. No HP or injury events injected. Separate inactive branches rendered with explicit visual fixture.'});await c.close();
 }}catch(e){report.errors.push(e.stack)}finally{await browser.close();await writeFile(path.join(OUT,'feedback-report.json'),JSON.stringify(report,null,2));}if(report.errors.length)throw Error(report.errors.join('\n'));console.log(JSON.stringify(report));

