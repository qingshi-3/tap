import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch,confirmMulligan} from '../dist/js/engine.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../output/ui-refinement/objective/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const checks=[],errors=[];
class Memory{data=new Map();getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,String(v))}removeItem(k){this.data.delete(k)}}
function fixture(id){const p=new ExpeditionProgress(new Memory());const profile=p.state;profile.legacyUnlockedLevels=EXPEDITION_LEVELS.slice(0,EXPEDITION_LEVELS.findIndex(l=>l.id===id)+1).map(l=>l.id);assert.ok(p.replaceState(profile).ok);const m=createExpeditionMatch(id,p.state.training,p.state.squad,1,p.getBattleLoadout());assert.ok(p.saveBattle(m).ok);confirmMulligan(m);m.enemyPlan.hint='旧战斗中保存的攻略文字不应成为目标';assert.ok(p.saveBattle(m).ok);return p.state;}
async function shot(page,name){await page.screenshot({path:new URL(name+'.png',out).pathname.replace(/^\/([A-Z]:)/,'$1')});}
async function scroll(page){const b=await page.locator('#objective-dialog .objective-body').boundingBox(),cdp=await page.context().newCDPSession(page);const x=b.x+b.width*.65,y=b.y+b.height-18;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*(b.height-35)/6}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(150);await cdp.detach();}
async function reachable(page){assert.ok(await page.locator('#objective-close').evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;}));}
try{
 for(const [width,height] of [[568,320],[844,390]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:width===568?'reduce':'no-preference'}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:4227');await page.locator('[data-action="battle-rules"]').tap();await page.locator('#objective-dialog').waitFor({state:'visible'});assert.equal(await page.locator('#objective-title').textContent(),'战斗规则');await page.locator('#rule-tab-draw').tap();assert.ok((await page.locator('#battle-rules').innerText()).includes('30张牌'));await reachable(page);await shot(page,`home-rules-${width}`);await scroll(page);assert.ok(await page.locator('.objective-body').evaluate(el=>el.scrollTop>0));await shot(page,`home-rules-scroll-${width}`);await page.keyboard.press('Escape');assert.equal(await page.locator('[data-action="battle-rules"]').evaluate(el=>el===document.activeElement),true);await context.close();
  checks.push(`${width}: 首页规则触控打开、滚动全文、Escape关闭与焦点恢复`);
  for(const id of ['border-02','border-03','banners-01']){
   const ctx=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.addInitScript(({key,profile})=>localStorage.setItem(key,JSON.stringify(profile)),{key:SAVE_KEYS.expedition,profile:fixture(id)});await p.goto('http://127.0.0.1:4227');await p.locator('.menu-play').tap();await p.locator('#objective-dialog').waitFor({state:'visible'});const goal=await p.locator('#objective-goal').textContent();assert.equal(goal,id==='border-03'?'存活7回合':id==='banners-01'?'击败所有敌方主将':'击败敌方主将');assert.ok(!(await p.locator('#objective-dialog').innerText()).includes('旧战斗'));assert.equal(await p.locator('#battle-rules').isVisible(),false);await reachable(p);await shot(p,`${id}-${width}`);await p.locator('#objective-rules').tap();assert.equal(await p.locator('#objective-goal').isVisible(),false);await reachable(p);await shot(p,`battle-rules-${id}-${width}`);await p.locator('#objective-rules').tap();assert.equal(await p.locator('#objective-goal').textContent(),goal);await p.locator('#objective-close').tap();assert.equal(await p.locator('#objective-dialog').isVisible(),false);await p.locator('#objective-open').tap();await p.keyboard.press('Escape');assert.equal(await p.locator('#objective-dialog').isVisible(),false);await ctx.close();checks.push(`${width} ${id}: 单敌将/坚守/多敌将目标准确，旧攻略不出现，规则切换与返回战场`);
  }
 }
 assert.deepEqual(errors,[]);writeFileSync(new URL('report.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}

