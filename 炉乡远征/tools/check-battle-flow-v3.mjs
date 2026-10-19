import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';
import { createExpeditionMatch } from '../dist/js/engine.js';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../output/battle-flow-v3/',import.meta.url);mkdirSync(out,{recursive:true});
const base=process.env.CAMPAIGN_UI_BASE||'http://127.0.0.1:4227';
class Memory { data=new Map();getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,String(v))}removeItem(k){this.data.delete(k)} }
const progress=new ExpeditionProgress(new Memory());
const profile=progress.state;
const state=createExpeditionMatch('border-01',profile.training,profile.squad,profile.selectedHeroId,progress.getBattleLoadout());
assert.ok(progress.saveBattle(state).ok);
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const checks=[],errors=[];let passed=false;
try {
 for(const [width,height,motion] of [[568,320,'no-preference'],[844,390,'no-preference'],[568,320,'reduce']]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:motion});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(({profile,key})=>localStorage.setItem(key,JSON.stringify(profile)),{profile:progress.state,key:SAVE_KEYS.expedition});
  await page.goto(base);await page.locator('.menu-play').tap();await page.locator('#objective-close').tap();
  await page.locator('.opening-confirm').waitFor({state:'visible'});
  await page.locator('.opening-confirm').tap();
  await page.locator('.battle-draw-face').waitFor({state:'visible'});
  assert.ok(await page.locator('#hand .draw-pending').count()>0,'new card remains hidden before landing');
  assert.equal(await page.locator('#end-turn').isDisabled(),true);
  const face=await page.locator('.battle-draw-face').evaluate(el=>({background:getComputedStyle(el).backgroundImage,rect:{width:parseFloat(el.style.width),height:parseFloat(el.style.height)},rarity:!!el.querySelector('.battle-draw-rarity')}));
  assert.ok(face.background.includes('card-inspect-v2.webp'));
  assert.ok(Math.abs(face.rect.width/face.rect.height-.75)<.02);
  const shot=new URL(`own-read-${width}-${motion}.png`,out).pathname.replace(/^\/([A-Z]:)/,'$1');
  await page.waitForTimeout(motion==='reduce'?30:250);await page.screenshot({path:shot});
  await page.waitForFunction(()=>!document.querySelector('.card-draw-flight')&&!document.querySelector('#hand .draw-pending')&&!document.querySelector('#end-turn').disabled);
  assert.equal(await page.locator('#hand .hand-card').count(),6);
  await page.screenshot({path:new URL(`landed-${width}-${motion}.png`,out).pathname.replace(/^\/([A-Z]:)/,'$1')});
  await page.locator('#end-turn').tap();
  await page.locator('.battle-draw-back').waitFor({state:'visible'});
  assert.equal(await page.locator('.battle-draw-back canvas,.battle-draw-back .game-card-name').count(),0);
  await page.screenshot({path:new URL(`enemy-back-${width}-${motion}.png`,out).pathname.replace(/^\/([A-Z]:)/,'$1')});
  await page.waitForFunction(()=>!document.querySelector('.card-draw-flight'),{timeout:15000});
  checks.push({width,height,motion,face,checks:['confirm opens draw','pending slot hidden','end-turn locked','approved frame3:4','six cards after arrival','enemy private back']});
  await context.close();
 }
 assert.deepEqual(errors,[]);passed=true;
} finally {await browser.close();writeFileSync(new URL('report.json',out),JSON.stringify({passed,checks,errors},null,2));}
console.log(JSON.stringify({passed:true,checks:checks.length,errors}));
