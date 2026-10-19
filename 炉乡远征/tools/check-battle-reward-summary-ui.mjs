import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';
import { createExpeditionMatch, createChallengeMatch, confirmMulligan, validateMatch } from '../dist/js/engine.js';
import { SaveManager } from '../dist/js/save-manager.js';
import { EXPEDITION_LEVELS } from '../dist/js/expedition-data.js';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';
import { battleRewardSummary } from '../dist/js/battle-reward-summary.js';

const {chromium}=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const out=new URL('../output/progress-improvements/rewards/',import.meta.url); await mkdir(out,{recursive:true});
class Memory { data=new Map();getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,String(v))}removeItem(k){this.data.delete(k)} }
function fixture(levelId) {
  const p=new ExpeditionProgress(new Memory());
  for(const level of EXPEDITION_LEVELS){
    const m=createExpeditionMatch(level.id,p.state.training,p.state.squad,p.state.selectedHeroId,p.getBattleLoadout());
    assert.ok(p.saveBattle(m).ok);
    if(level.id===levelId){
      assert.ok(confirmMulligan(m));
      const a=m.units.find(u=>u.owner===0&&u.cardId===m.players[0].generalId),b=m.units.find(u=>u.owner===1&&u.cardId===m.players[1].generalId);
      m.units=[a,b];Object.assign(a,{x:3,y:2,moved:false,attacked:false});Object.assign(b,{x:4,y:2,health:1});
      assert.ok(validateMatch(m));assert.ok(p.saveBattle(m).ok);
      const profile=p.state, terminal=structuredClone(m);Object.assign(terminal,{phase:'over',winner:0,result:'win'});
      const payout=p.settle(terminal);assert.ok(payout.ok);
      return {profile,sourceId:a.unitId,targetId:b.unitId,expected:battleRewardSummary({match:terminal,payout:{...payout,runId:m.runId},profile:p.state}),runId:m.runId};
    }
    Object.assign(m,{phase:'over',winner:0,result:'win'});assert.ok(p.settle(m).ok);
  }
  throw Error('unknown fixture');
}
const report={checks:[],errors:[],limitations:['Desktop Edge touch emulation; physical phones and TapTap host unverified.']};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
async function shot(page,name){await page.screenshot({path:fileURLToPath(new URL(name+'.png',out))});}
async function drag(page,from,to){
  const c=await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
  for(let i=1;i<=10;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/10,y:from.y+(to.y-from.y)*i/10}]});
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();
}
try {
 for(const [width,height,motion,levelId,action] of [[568,320,'reduce','road-01','touch'],[844,390,'no-preference','road-01','keyboard'],[568,320,'reduce','road-02','scroll']]){
  const f=fixture(levelId),context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:motion}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(String(e)));
  await page.addInitScript(({profile,key})=>localStorage.setItem(key,JSON.stringify(profile)),{profile:f.profile,key:SAVE_KEYS.expedition});
  await page.addInitScript(async()=>{const {BoardRenderer}=await import('/js/renderer.js');const draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__renderer=this;return draw.apply(this,args)}});
  await page.goto(process.env.REWARD_SUMMARY_UI_BASE||'http://127.0.0.1:4200');await page.locator('.menu-play').tap();await page.locator('#objective-close').tap();
  await page.waitForFunction(()=>window.__renderer?.ready&&window.__renderer.state.phase==='playing');await page.locator('#focus-general').tap();
  const points=await page.evaluate(ids=>ids.map(id=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===id),p=r.getUnitAnchor(u);for(const dy of [0,8,-8,16,-16]){const q={x:p.x,y:p.y+dy};if(document.elementFromPoint(q.x,q.y)===r.canvas&&r.positionFromPointer({clientX:q.x,clientY:q.y},{preferUnits:true})?.x===u.x)return q}return null}),[f.sourceId,f.targetId]);
  assert.ok(points.every(Boolean),'both attack objects visible through normal focus-general input');
  // Current authored input contract: select friendly, then tap enemy to attack.
  // Dragging onto enemies is deliberately movement-only in main.js.
  for(const point of points)await page.touchscreen.tap(point.x,point.y);
  await page.locator('#game-result').waitFor({state:'visible'});await page.waitForTimeout(900);
  assert.equal(await page.locator('#game-result').isVisible(),true,'attack release does not activate next-level');
  assert.equal(await page.locator('#result-reward').getAttribute('data-reward-status'),'saved');
  const text=await page.locator('#result-reward').innerText();for(const c of f.expected.cards)assert.ok(text.includes(c.name));
  for(const r of f.expected.resources)assert.ok(text.includes(`+${r.amount} ${r.kind==='gold'?'金币':'灵魂宝珠'}`));
  assert.ok(text.includes('新随从'));if(levelId==='road-01')assert.ok(text.includes('新法术'));
  const layout=await page.evaluate(()=>({cards:[...document.querySelectorAll('.battle-reward-card')].map(el=>{const c=el.querySelector('canvas'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {text:el.innerText,painted:[...data].some((v,i)=>i%4===3&&v>0),rect:el.getBoundingClientRect().toJSON()}}),buttons:[...document.querySelectorAll('#game-result button')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>({id:el.id,rect:el.getBoundingClientRect().toJSON()})),scroll:{width:document.querySelector('.battle-reward-cards').clientWidth,total:document.querySelector('.battle-reward-cards').scrollWidth},viewport:{width:innerWidth,height:innerHeight}}));
  assert.ok(layout.cards.every(c=>c.painted),'all real card canvases contain art');
  await writeFile(new URL(`layout-${width}-${levelId}.json`,out),JSON.stringify(layout,null,2));
  for(const card of await page.locator('.battle-reward-card').all()){
    if(await card.evaluate(el=>{const b=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return b.right>p.right||b.left<p.left}))continue;
    assert.ok(await card.evaluate(el=>{const name=el.querySelector('strong'),b=name.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return b.top>=0&&b.bottom<=innerHeight&&!!hit&&el.contains(hit)}),'new card name visible and unobstructed');
  }
  for(const b of layout.buttons){assert.ok(b.rect.width>=44&&b.rect.height>=44,`${b.id} 44px touch target`);assert.ok(b.rect.x>=0&&b.rect.y>=0&&b.rect.right<=width+.5&&b.rect.bottom<=height+.5,`${b.id} within viewport`)}
  await shot(page,`result-${width}-${levelId}-${motion}`);
  if(action==='scroll'){
    const list=page.locator('.battle-reward-cards'),box=await list.boundingBox();
    if(layout.scroll.total>layout.scroll.width){await drag(page,{x:box.x+box.width-15,y:box.y+box.height/2},{x:box.x+15,y:box.y+box.height/2});await page.waitForTimeout(250);assert.ok(await list.evaluate(el=>el.scrollLeft)>0,'real horizontal touch reveals remaining cards');assert.ok(await list.locator('.battle-reward-card').last().evaluate(el=>{const b=el.querySelector('strong').getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return !!hit&&el.contains(hit)}),'last card name visible after real swipe');await shot(page,'cards-scrolled-568');}
    await page.locator('#back-to-lobby').focus();await page.keyboard.press('Tab');assert.equal(await list.evaluate(el=>el===document.activeElement),true,'card strip reachable by real Tab from final action');await page.keyboard.press('ArrowRight');
  }else{
    if(action==='touch')await page.locator('#next-level').tap();else{await page.locator('#next-level').focus();await page.keyboard.press('Enter');}
    await page.locator('.prep-start').waitFor({state:'visible'});await shot(page,`next-level-${width}-${action}`);
  }
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEYS.expedition);assert.ok(saved.settlements[f.runId]);for(const c of f.expected.cards)assert.ok(saved.inventory[c.type==='spell'?'spells':'units'].includes(c.id));
  report.checks.push({width,height,motion,levelId,action,realTapAttackVictory:true,expected:f.expected,layout});await context.close();
 }
 // Shared result wrapper also serves preserved trial saves.
 {
  const storage=new Memory(),m=createChallengeMatch('trade-and-retaliate'),source=m.units.find(u=>u.owner===0),target=m.units.find(u=>u.owner===1&&u.cardId===m.players[1].generalId);
  m.units=[source,target];Object.assign(source,{x:3,y:2,moved:false,attacked:false});Object.assign(target,{x:4,y:2,health:1});assert.ok(validateMatch(m));assert.ok(new SaveManager(()=>{},storage).saveLocal(m));
  const context=await browser.newContext({viewport:{width:568,height:320},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(String(e)));
  await page.addInitScript(entries=>{for(const [k,v] of entries)localStorage.setItem(k,v)},[...storage.data]);
  await page.addInitScript(async()=>{const{BoardRenderer}=await import('/js/renderer.js'),draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__renderer=this;return draw.apply(this,args)}});
  await page.goto(process.env.REWARD_SUMMARY_UI_BASE||'http://127.0.0.1:4200');await page.locator('.menu-trials').focus();await page.keyboard.press('Enter');await page.locator('[data-action="trial"][data-level-id="trade-and-retaliate"]').tap();await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__renderer?.ready);await page.locator('#focus-general').tap();
  for(const id of [source.unitId,target.unitId]){
    const point=await page.evaluate(id=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===id),b=r.canvas.getBoundingClientRect(),c=r.cellGeometry(r.boardMetrics(b.width,b.height),u.x,u.y).center;return{x:b.x+c.x,y:b.y+c.y}},id);await page.touchscreen.tap(point.x,point.y);
  }
  await page.locator('#game-result').waitFor({state:'visible'});await shot(page,'trial-result-568');
  assert.equal(await page.locator('#result-reward').isVisible(),false,'trial does not show expedition reward');assert.ok(await page.locator('#play-again').isVisible());assert.ok(await page.locator('#back-to-lobby').isVisible());
  await page.locator('#back-to-lobby').tap();await page.locator('.trial-card').first().waitFor({state:'visible'});report.checks.push({trial:'trade-and-retaliate',width:568,height:320,realTapAttackVictory:true,returnToTrials:true,entry:'keyboard; touch navigation verified separately'});await context.close();
 }
}catch(error){report.errors.push(error.stack);for(const c of browser.contexts())for(const p of c.pages())await shot(p,'failure');}
finally{await browser.close();report.passed=report.errors.length===0;await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));}
if(!report.passed)process.exitCode=1;
