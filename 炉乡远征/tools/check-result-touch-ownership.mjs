import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch,confirmMulligan} from '../dist/js/engine.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../output/reward-presentation/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const reports=[];
try {
 for(const motion of ['reduce','no-preference'])for(const action of ['next-touch','prep-touch','next-keyboard']) {
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
  const fixture=new ExpeditionProgress(storage).state;fixture.coins=1500;fixture.completed=EXPEDITION_LEVELS.slice(0,3).map(l=>l.id);fixture.factionCompleted[1]=[...fixture.completed];fixture.accountStageClaims=Object.fromEntries(fixture.completed.map(id=>[id,'legacy']));fixture.training[14]=1;fixture.recruitment.tickets=12;fixture.recruitment.focus=17;
  storage.setItem(SAVE_KEYS.expedition,JSON.stringify(fixture));const p=new ExpeditionProgress(storage),seed=p.state;
  const battle=createExpeditionMatch('border-01',seed.training,seed.squad,seed.selectedHeroId,p.getBattleLoadout());assert.ok(p.saveBattle(battle).ok);confirmMulligan(battle);
  const a=battle.units.find(u=>u.owner===0&&u.cardId===1),b=battle.units.find(u=>u.owner===1&&u.cardId===battle.players[1].generalId);
  battle.units=[a,b];a.x=4;a.y=2;b.x=5;b.y=2;b.health=1;assert.ok(p.saveBattle(battle).ok);
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,reducedMotion:motion}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:SAVE_KEYS.expedition,state:p.state});
  await page.addInitScript(()=>{window.__trace=[];for(const kind of ['pointerdown','pointerup','click'])document.addEventListener(kind,e=>window.__trace.push({kind,target:e.target.id||e.target.className,x:e.clientX,y:e.clientY,detail:e.detail}),true)});
  await page.addInitScript(async()=>{const{BoardRenderer}=await import('/js/renderer.js');const draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__renderer=this;return draw.apply(this,args)}});
  await page.goto('http://127.0.0.1:4223/');await page.locator('.menu-play').tap();await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__renderer?.ready);await page.locator('#focus-general').tap();
  for(const id of [a.unitId,b.unitId]) {
   const pos=await page.evaluate(id=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===id),rect=r.canvas.getBoundingClientRect(),m=r.boardMetrics(rect.width,rect.height),c=r.cellGeometry(m,u.x,u.y).center;return{x:rect.x+c.x,y:rect.y+c.y}},id);
   assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,pos),'board');await page.touchscreen.tap(pos.x,pos.y);
  }
  await page.locator('#game-result').waitFor({state:'visible'});
  // Let the same touch's compatibility click finish before checking the route.
  await page.waitForFunction(()=>window.__trace.filter(e=>e.kind==='click').length>=5);
  assert.equal(await page.locator('.prep-start').isVisible(),false);assert.equal(await page.locator('#game-result').isVisible(),true);
  const trace=await page.evaluate(()=>window.__trace);if(motion==='reduce')assert.equal(trace.at(-1).target,'next-level','original release coordinate must still exercise the revealed control');
  await page.screenshot({path:fileURLToPath(new URL(`result-retained-${motion}-${action}.png`,out))});
  if(action==='prep-touch')await page.locator('#result-prep').tap();
  else if(action==='next-keyboard'){await page.locator('#next-level').focus();await page.keyboard.press('Enter');}
  else await page.locator('#next-level').tap();
  await page.locator('.prep-start').waitFor({state:'visible'});assert.deepEqual(errors,[]);
  reports.push({motion,action,trace,passed:['real-board-touch-attack-victory','same-gesture-does-not-navigate','fresh-result-control-activation'],hostVerified:false});await context.close();
 }
 await writeFile(new URL('result-touch-report.json',out),JSON.stringify(reports,null,2));console.log('Result touch ownership passed: 2 motion modes × touch next/prep and keyboard next');
} finally {await browser.close();}
