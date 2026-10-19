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
 async function arrange(){return p.evaluate(()=>{const g=window.__BLINK_QA.game();g.enemies=[];g.enemyHazards=[];g.enemyProjectiles=[];g.effects=[];g._spawnClock=999;g._eliteWaves=3;g._attackClock=999;g.player.x=900;g.player.y=900;g.heroState.blinkAnchors=[{id:90001,x:1080,y:900,remaining:14,maxLife:14},{id:90002,x:1380,y:900,remaining:14,maxLife:14},{id:90003,x:1080,y:1040,remaining:14,maxLife:14}];g.skills.blinkStrike.remaining=0;g.skills.blinkStorm.remaining=0;return {hp:g.player.hp};})}
 async function drag(skill,dx=0,dy=0,release='touchEnd'){const b=await p.locator(`[data-skill="${skill}"]`).boundingBox();const start={x:b.x+b.width/2,y:b.y+b.height/2,id:1};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});if(dx||dy)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...start,x:start.x+dx,y:start.y+dy}]});await p.waitForTimeout(60);const aim=await p.evaluate(()=>window.__BLINK_QA.game().skillAim);return {aim,end:async()=>cdp.send('Input.dispatchTouchEvent',{type:release,touchPoints:[]})};}

 await arrange();await p.evaluate(()=>{const g=window.__BLINK_QA.game();g.heroState.blinkAnchors=[];g.commonEntities=[{id:10001,weapon:'dagger',kind:'boomerang',shape:'projectile',x:1010,y:850,vx:100,vy:0,radius:10,damage:0,phase:'outbound',travel:0,maxDistance:1000,curve:0,spin:1,life:4,maxLife:4,hitIds:new Set()},{id:10002,weapon:'dagger',kind:'boomerang',shape:'projectile',x:1010,y:950,vx:-100,vy:0,radius:10,damage:0,phase:'returning',returnSpeed:100,spin:2,life:4,maxLife:4,hitIds:new Set()}];});await p.waitForTimeout(60);await p.screenshot({path:path.join(OUT,`boomerang-${width}.png`)});report.cases.push({width,height,reduced,fixture:'outbound and returning visual, simulation unchanged'});await c.close();
 }}catch(e){report.errors.push(e.stack)}finally{await browser.close();await writeFile(path.join(OUT,'boomerang-report.json'),JSON.stringify(report,null,2));}if(report.errors.length)throw Error(report.errors.join('\n'));console.log(JSON.stringify(report));
