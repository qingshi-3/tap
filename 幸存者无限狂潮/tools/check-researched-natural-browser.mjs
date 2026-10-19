import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadProfile,STORAGE_KEY,validateProfile} from '../dist/campaign.js';
import {HEROES,getHeroJobs} from '../dist/heroes.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'),{chromium}=require('playwright');
const out=new URL('../output/hero-progression/natural-browser/',import.meta.url);await mkdir(out,{recursive:true});
const mem=new Map();globalThis.localStorage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v))};
const fixture=loadProfile().profile;fixture.cleared=['moss-gate','ember-trail'];fixture.progression.dungeonWins={'moss-gate':1,'ember-trail':1};
for(const hero of HEROES)Object.assign(fixture.heroes[hero.id],{level:6,job:getHeroJobs(hero.id)[2].id,unlockedJobs:getHeroJobs(hero.id).map(j=>j.id),skillLoadout:hero.skills.map(s=>s.id)});
assert(validateProfile(fixture));
// This hook only reads live state. Every command below uses real browser inputs.
const hook=`window.__NATURAL_QA={state(){return {phase:game.phase,time:game.time,hero:game.heroId,player:{x:game.player.x,y:game.player.y,hp:game.player.hp,maxHp:game.player.maxHp},skills:getSkillState(game),damage:game.stats.damageDealt,heroDamage:game.stats.heroDamage,damageTaken:game.stats.damageTaken,kills:game.stats.kills,enemies:game.enemies.filter(e=>!e.dead).length,rank:game.attackProgress?.rank};}};`;
const report={passed:false,scope:'Fresh isolated promoted profile, third career / weapon I at each departure. Natural moss-gate spawns, real touch joystick and three skill drag/releases; no encounter mutation or direct casts. 12 simulated seconds per hero, 844x390 viewport.',limitations:['Short natural encounter smoke test; not long-run balance, Boss, save migration, platform host, or two-viewport visual acceptance.','Skill acceptance is verified by real-touch cooldown consumption; damage is aggregate and does not prove each cast hit an enemy.'],cases:[],errors:[],missing:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});let page;
const shot=async name=>{const path=fileURLToPath(new URL(name+'.png',out));await page.screenshot({path});return path;};
async function touch(cdp,a,b,ms=260){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:1}]});await page.waitForTimeout(ms);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
async function skill(cdp,id){const r=await page.locator(`[data-skill="${id}"]`).boundingBox();assert(r&&r.width>=44&&r.height>=44);const a={x:r.x+r.width/2,y:r.y+r.height/2};await touch(cdp,a,{x:a.x-38,y:a.y-24},100);return page.evaluate(id=>window.__NATURAL_QA.state().skills.find(s=>s.id===id)?.remaining||0,id);}
try{
 for(const hero of HEROES){
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  // New ephemeral browser context per hero; no user's existing localStorage is read.
  await context.addInitScript(({key,p})=>localStorage.setItem(key,JSON.stringify(p)),{key:STORAGE_KEY,p:fixture});
  await context.route('**/main.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+hook});});
  page=await context.newPage();page.on('pageerror',e=>report.errors.push({hero:hero.id,message:e.message}));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith('http://127.0.0.1:4178/'))report.missing.push({hero:hero.id,url:r.url(),status:r.status()});});
  const cdp=await context.newCDPSession(page);await page.goto('http://127.0.0.1:4178/');
  await page.locator('[data-tab="hero"]').first().tap();await page.locator(`[data-hero="${hero.id}"]`).tap();if(await page.locator('[data-action="confirm-hero"]').isEnabled())await page.locator('[data-action="confirm-hero"]').tap();await page.locator('[data-action="back"]').tap();await page.locator('[data-tab="map"]').tap();await page.locator('[data-dungeon="moss-gate"]').tap();await page.locator('[data-action="depart"]').tap();await page.waitForFunction(()=>window.__NATURAL_QA?.state().phase==='playing');
  const result={hero:hero.id,start:await page.evaluate(()=>window.__NATURAL_QA.state()),skills:[],upgrades:[],images:[],samples:[],movement:0};
  let index=0,step=0,last=result.start,wallStart=Date.now();const directions=[[34,0],[0,-34],[-34,0],[0,34]],ids=hero.skills.map(s=>s.id);
  while(last.time<12&&Date.now()-wallStart<35000){
   if(last.phase==='upgrade'||last.phase==='upgrade_slowdown'){const choice=page.locator('#upgrade-choices button:not(:disabled)').first();if(await choice.isVisible()){const label=await choice.innerText();await choice.tap();result.upgrades.push(label);await page.waitForTimeout(300);}}
   else if(last.phase==='playing'){
    if(index<ids.length&&last.time>=3+index*3){const cooldown=await skill(cdp,ids[index]);result.skills.push({id:ids[index],time:last.time,cooldown,accepted:cooldown>0});index++;}
    const [dx,dy]=directions[step%4];await touch(cdp,{x:85,y:325},{x:85+dx,y:325+dy},280);step++;
    const now=await page.evaluate(()=>window.__NATURAL_QA.state());result.movement+=Math.hypot(now.player.x-last.player.x,now.player.y-last.player.y);last=now;
    if(step%7===0){result.samples.push(now);if(result.images.length<2)result.images.push(await shot(`${hero.id}-${result.images.length+1}`));}
   }else if(['defeat','victory','revive'].includes(last.phase))break;
   else await page.waitForTimeout(150);
   last=await page.evaluate(()=>window.__NATURAL_QA.state());
  }
  result.end=last;result.wallSeconds=(Date.now()-wallStart)/1000;result.images.push(await shot(`${hero.id}-final`));result.completed=last.time>=12;result.survived=last.player.hp>0;result.observedDamage=last.heroDamage>0;result.allSkillsAccepted=result.skills.length===3&&result.skills.every(s=>s.accepted);result.passed=result.completed&&result.survived&&result.observedDamage&&result.allSkillsAccepted&&result.movement>20;report.cases.push(result);await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({hero:hero.id,completed:result.completed,phase:last.phase,time:last.time,hp:last.player.hp,heroDamage:last.heroDamage,damageTaken:last.damageTaken,skills:result.skills,passed:result.passed}));await context.close();
 }
 report.passed=report.cases.length===HEROES.length&&report.cases.every(c=>c.passed)&&report.errors.length===0&&report.missing.length===0;
 if(!report.passed)process.exitCode=1;
}catch(e){report.failure={message:e.message,stack:e.stack,image:page&&!page.isClosed()?await shot('failure'):null};process.exitCode=1;}
finally{await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,errors:report.errors.length,missing:report.missing.length}));
