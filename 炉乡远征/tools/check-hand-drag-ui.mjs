import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch,confirmMulligan,playCard,validateMatch} from '../dist/js/engine.js';
import {CARDS} from '../dist/js/cards.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const base=process.env.CAMPAIGN_UI_BASE||'http://127.0.0.1:4223';
const out=new URL('../output/hand-drag/',import.meta.url);mkdirSync(out,{recursive:true});
class Memory{data=new Map();getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,String(v))}removeItem(k){this.data.delete(k)}}
function seed(hero,spells,full=false,opening=false){
 const p=new ExpeditionProgress(new Memory());assert.ok(p.selectHero(hero).ok);const state=p.state;
 state.inventory.units=[...new Set([...state.inventory.units,10020,14])];state.inventory.spells=[...new Set([...state.inventory.spells,...spells])];assert.ok(p.replaceState(state).ok);
 const load=p.getBattleLoadout(),extra=[10020,...(hero===1?[14]:[]),...spells];for(const id of extra){if(load.deck.includes(id))continue;const i=load.deck.findIndex(x=>!extra.includes(x));load.deck[i]=id}assert.ok(p.setBattleDeck(load.deck).ok);
 const m=createExpeditionMatch('border-01',p.state.training,p.state.squad,hero,p.getBattleLoadout());assert.ok(p.saveBattle(m).ok);assert.ok(confirmMulligan(m));
 function hand(ids){const deck=[...m.loadout.deck];for(const id of ids){const i=deck.indexOf(id);assert.ok(i>=0);deck.splice(i,1)}m.players[0].hand=[...ids];m.players[0].deck=deck;m.players[0].mana=9}
 if(hero===101){const own=load.deck.find(id=>CARDS[id].type==='unit'&&id!==10020);hand([own]);assert.ok(playCard(m,0,2,1));const e=m.units.find(u=>u.owner===1&&u.cardId===14);e.x=2;e.y=0;e.attackBuff=7;hand([20129,10020]);}
 else hand(full ? load.deck.slice(0,6) : [opening?10020:14,...spells]);
 assert.ok(validateMatch(m));assert.ok(p.saveBattle(m).ok);return p.state;
}
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const errors=[],checks=[];
async function open(profile,width=844,height=390){const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(({profile,key})=>{if(!sessionStorage.getItem('content-seed')){localStorage.setItem(key,JSON.stringify(profile));sessionStorage.setItem('content-seed','1')}},{profile,key:SAVE_KEYS.expedition});await page.addInitScript(async()=>{const{BoardRenderer}=await import('/js/renderer.js');const targetPath=BoardRenderer.prototype.drawCardTargetPath;BoardRenderer.prototype.drawCardTargetPath=function(...args){window.__targetLineDraws=(window.__targetLineDraws||0)+1;return targetPath.apply(this,args)};const draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__renderer=this;return draw.apply(this,args)}});await page.goto(base);await resume(page);return {context,page}}
async function resume(page){await page.locator('.menu-play').tap();await page.locator('#objective-close').waitFor({state:'visible'});await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__renderer?.ready&&!document.querySelector('#match').hidden&&!document.querySelector('#end-turn').disabled)}
const state=page=>page.evaluate(()=>structuredClone(window.__renderer.state));
async function cell(page,x,y){const p=await page.evaluate(({x,y})=>{const r=window.__renderer,rect=r.canvas.getBoundingClientRect(),c=r.cellGeometry(r.boardMetrics(rect.width,rect.height),x,y).center;for(const dy of [0,-8,8,-16,16]){const point={clientX:rect.x+c.x,clientY:rect.y+c.y+dy},hit=r.positionFromPointer(point);if(hit?.x===x&&hit?.y===y&&document.elementFromPoint(point.clientX,point.clientY)===r.canvas)return {x:point.clientX,y:point.clientY}}return null},{x,y});assert.ok(p,`cell ${x},${y} visible`);await page.touchscreen.tap(p.x,p.y)}
async function card(page,index){const el=page.locator('#hand button').nth(index);const p=await el.evaluate(el=>{const b=el.getBoundingClientRect();for(const rx of [.5,.1,.9,.03])for(const ry of [.5,.15,.85]){const x=b.x+b.width*rx,y=b.y+b.height*ry;if(document.elementFromPoint(x,y)?.closest('#hand button')===el)return{x,y}}return null});assert.ok(p);await page.touchscreen.tap(p.x,p.y)}
async function shot(page,name){await page.screenshot({path:new URL(name,out).pathname.replace(/^\/([A-Z]:)/,'$1')})}
async function point(page,x,y){return page.evaluate(({x,y})=>{const r=window.__renderer,b=r.canvas.getBoundingClientRect(),c=r.cellGeometry(r.boardMetrics(b.width,b.height),x,y).center;return {x:b.x+c.x,y:b.y+c.y}},{x,y})}
async function drag(page,index,to,touch=false,screenshot=null){const b=await page.locator('#hand button').nth(index).boundingBox();const start={x:b.x+Math.min(20,b.width/2),y:b.y+b.height/2};
 if(touch){const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});if(to.y>start.y)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x,y:start.y-35}]});for(let i=1;i<=12;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(to.x-start.x)*i/12,y:start.y+(to.y-start.y)*i/12}]});await page.screenshot({path:new URL(screenshot || 'drag-active.png',out).pathname.replace(/^\/([A-Z]:)/,'$1')});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();}
 else {await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});await page.screenshot({path:new URL(screenshot || 'mouse-active.png',out).pathname.replace(/^\/([A-Z]:)/,'$1')});await page.mouse.up();}await page.waitForTimeout(500);}
if(process.env.HAND_DRAG_DELAY_ONLY==='1') {
 try {for(const [width,height] of [[568,320],[844,390]]) {
  const {context,page}=await open(seed(1,[20044]),width,height),before=await state(page);
  await card(page,0);assert.equal(await page.locator('#unit-inspect').isVisible(),true);
  const source=await page.locator('#hand button').nth(0).evaluate(el=>{const b=el.getBoundingClientRect();for(const ry of [.9,.5,.2])for(const rx of [.15,.5,.85]){const x=b.x+b.width*rx,y=b.y+b.height*ry;if(document.elementFromPoint(x,y)?.closest('#hand button')===el)return{x,y}}return null});
  assert.ok(source,'original hand card remains reachable after tap preview');
  const to=await point(page,2,1),cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[source]});await page.waitForTimeout(500);
  for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:source.x+(to.x-source.x)*i/12,y:source.y+(to.y-source.y)*i/12}]});
  assert.equal(await page.locator('.hand-cancel-zone').isVisible(),true);
  await shot(page,`tap-hold-drag-${width}.png`);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  await page.waitForFunction(mana=>window.__renderer.state.players[0].mana<mana,before.players[0].mana);
  assert.equal((await state(page)).players[0].hand.length,before.players[0].hand.length-1);
  await page.waitForFunction(()=>!document.querySelector('#end-turn').disabled);
  await card(page,0);assert.equal(await page.locator('#unit-inspect').isVisible(),true);
  checks.push(`${width}: tap preview → original card hold500ms → real touch drag spends once; next card tap responds`);
  await context.close();
 }assert.deepEqual(errors,[]);writeFileSync(new URL('tap-hold-drag-report.json',out),JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks}));}
 finally {await browser.close()}process.exit(0);
}
if(process.env.HAND_DRAG_AIMING_ONLY==='1') {
 const checks=[];
 async function hold(page,index,to,touch){const source=page.locator('#hand button').nth(index),b=await source.boundingBox(),start=await source.evaluate(el=>{const b=el.getBoundingClientRect();for(const ry of [.5,.85,.98,.15])for(const rx of [.2,.5,.8]){const x=b.x+b.width*rx,y=b.y+b.height*ry;if(document.elementFromPoint(x,y)?.closest('#hand button')===el)return{x,y}}return null});assert.ok(start,'source card visible touch point');
  const before=await page.evaluate(()=>window.__targetLineDraws||0);let c;
  if(touch){c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});if(to.y>start.y)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x,y:start.y-35}]});for(let i=1;i<=12;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(to.x-start.x)*i/12,y:start.y+(to.y-start.y)*i/12}]});}
  else{await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});}
  await page.waitForTimeout(50);
  return {b,before,cancel:async()=>{if(c){await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await c.detach()}else await page.keyboard.press('Escape');await page.waitForTimeout(100)},release:async()=>{if(c){await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach()}else await page.mouse.up();await page.waitForTimeout(300)}};
 }
 try{for(const [width,height,touch] of [[844,390,false],[568,320,true]]){
  const aim=await open(seed(101,[20129]),width,height);await shot(aim.page,`hand-static-${width}.png`);
  const h=await hold(aim.page,0,await point(aim.page,2,1),touch),after=await aim.page.locator('#hand button').nth(0).boundingBox();assert.ok(Math.abs(h.b.x-after.x)<.5&&Math.abs(h.b.y-after.y)<.5);assert.equal(await aim.page.locator('.hand-drag-ghost').isVisible(),false);assert.ok(await aim.page.evaluate(()=>window.__targetLineDraws||0)>h.before);await shot(aim.page,`target-line-${width}.png`);await h.release();checks.push(`${width}: targeted source stays in rail; ghost hidden; actual renderer line drawn`);await aim.context.close();
  const basic=await open(seed(1,[20044]),width,height),initial=await state(basic.page);
  for(const destination of [await point(basic.page,0,0),{x:width/2,y:height-5}]){const invalid=await hold(basic.page,0,destination,touch);assert.equal(await basic.page.locator('.hand-drag-ghost').isVisible(),false);await invalid.release();const saved=await state(basic.page);assert.equal(saved.players[0].mana,initial.players[0].mana);assert.deepEqual(saved.players[0].hand,initial.players[0].hand);}
  if(touch){const cancel=await hold(basic.page,0,await point(basic.page,2,1),true);await cancel.cancel();assert.equal((await state(basic.page)).players[0].mana,initial.players[0].mana);assert.deepEqual((await state(basic.page)).players[0].hand,initial.players[0].hand);const resize=await hold(basic.page,0,await point(basic.page,2,1),true);await basic.page.setViewportSize({width:width+2,height});await basic.page.waitForTimeout(100);assert.equal(await basic.page.locator('.hand-cancel-zone').isVisible(),false);await resize.release();await basic.page.setViewportSize({width,height});await basic.page.waitForTimeout(100);assert.deepEqual((await state(basic.page)).players[0].hand,initial.players[0].hand);}
  const u=await hold(basic.page,0,await point(basic.page,2,1),touch),unitBox=await basic.page.locator('#hand button').nth(0).boundingBox();assert.ok(Math.abs(u.b.x-unitBox.x)<.5&&Math.abs(u.b.y-unitBox.y)<.5);assert.equal(await basic.page.locator('.hand-drag-ghost').isVisible(),false);assert.ok(await basic.page.evaluate(()=>window.__targetLineDraws||0)>u.before);await shot(basic.page,`unit-target-line-${width}.png`);await u.release();const deployed=await state(basic.page);assert.equal(deployed.units.filter(u=>u.owner===0&&u.cardId===14).length,1);assert.equal(deployed.players[0].mana,initial.players[0].mana-CARDS[14].cost);assert.equal(deployed.players[0].hand.length,initial.players[0].hand.length-1);checks.push(`${width}: unit fixed source/line, no ghost; illegal/red/cancel preserve; legal drop charged once`);
  const n=await hold(basic.page,0,await point(basic.page,3,1),touch);assert.equal(await basic.page.locator('.hand-drag-ghost').isVisible(),true);assert.equal(await basic.page.evaluate(()=>window.__targetLineDraws||0),n.before);await shot(basic.page,`untargeted-ghost-${width}.png`);await n.release();assert.equal((await state(basic.page)).players[0].hand.includes(20044),false);checks.push(`${width}: untargeted ghost visible; no target line; release casts`);await basic.context.close();
  const opening=await open(seed(1,[],false,true),width,height);const first=await hold(opening.page,0,await point(opening.page,2,1),touch);await first.release();assert.equal((await state(opening.page)).players[0].mana,9);assert.ok(await opening.page.locator('#inspect-followup-skip').isVisible());const second=await hold(opening.page,0,await point(opening.page,3,1),touch);await shot(opening.page,`opening-second-${width}.png`);assert.ok(await opening.page.evaluate(()=>window.__targetLineDraws||0)>second.before);await second.release();assert.equal((await state(opening.page)).players[0].hand.includes(10020),false);assert.equal((await state(opening.page)).players[0].mana,7);checks.push(`${width}: opening-dispel unit two-stage target flow charged once`);await opening.context.close();
 }assert.deepEqual(errors,[]);writeFileSync(new URL('hand-aiming-report.json',out),JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks}));}finally{await browser.close()}process.exit(0);
}
if(process.env.HAND_DRAG_SCREENSHOTS_ONLY==='1') {
 try { for(const [width,height,touch] of [[844,390,false],[568,320,true]]) {
  const {context,page}=await open(seed(101,[20129]),width,height);await page.waitForTimeout(100);
  const bounds=await page.locator('#hand button').evaluateAll(cards=>cards.map(card=>{const b=card.getBoundingClientRect(),copy=card.querySelector('.card-copy').getBoundingClientRect();return {name:card.getAttribute('aria-label'),bottom:b.bottom,copyBottom:copy.bottom,screen:innerHeight,width:b.width,height:b.height}}));
  for(const b of bounds){assert.ok(b.copyBottom<=b.bottom+.5,JSON.stringify(b));assert.ok(b.bottom<=height+.5,JSON.stringify(b));assert.ok(b.width>=44&&b.height>=44)}
  await shot(page,`hand-static-${width}.png`);await drag(page,0,await point(page,2,1),touch,`target-line-${width}.png`);await drag(page,0,{x:width/2,y:height-5},touch,`cancel-active-${width}.png`);await shot(page,`cancel-result-${width}.png`);await context.close();
 } assert.deepEqual(errors,[]);writeFileSync(new URL('hand-final-visual-report.json',out),JSON.stringify({passed:true,checks:['844/568 card-copy stays inside card; cards stay inside viewport and >=44px','final static, valid-target line and active cancel screenshots use separate names'],errors},null,2));console.log('final visual screenshots and geometry passed');
 } finally {await browser.close()} process.exit(0);
}
try{
 for(const [width,height,touch] of [[844,390,false],[568,320,true]]){
 const {context,page}=await open(seed(101,[20129]),width,height);const original=await state(page);await shot(page,`hand-static-${width}.png`);
 await drag(page,0,{x:width/2,y:height-5},touch,`cancel-active-${width}.png`);assert.equal((await state(page)).players[0].mana,9);checks.push(`${width} red cancel`);
 await drag(page,0,await point(page,0,0),touch);assert.equal((await state(page)).players[0].mana,9);checks.push(`${width} illegal drop`);
 await drag(page,0,await point(page,2,1),touch,`target-line-${width}.png`);assert.equal((await state(page)).players[0].mana,9);assert.equal(await page.locator('#inspect-followup-skip').isVisible(),false);
 await drag(page,0,{x:width/2,y:height-5},touch,`cancel-active-${width}.png`);assert.equal((await state(page)).players[0].mana,9);checks.push(`${width} followup cancel`);
 await drag(page,0,await point(page,2,1),touch);await drag(page,0,await page.evaluate(()=>window.__renderer.getUnitAnchor(window.__renderer.state.units.find(u=>u.owner===1&&u.cardId===14))),touch);assert.equal((await state(page)).players[0].hand.includes(20129),false);checks.push(`${width} swap double drag commits`);
 await page.screenshot({path:new URL(`drag-result-${width}.png`,out).pathname.replace(/^\/([A-Z]:)/,'$1')});await context.close();
 }
 const basic=await open(seed(1,[20044]),568,320);
 await basic.page.locator('#hand button').nth(0).tap();assert.equal(await basic.page.locator('#unit-inspect').isVisible(),true);checks.push('touch tap opens description');await basic.page.keyboard.press('Escape');
 const cardButton=basic.page.locator('#hand button').nth(0);await cardButton.focus();await basic.page.keyboard.press('Enter');assert.equal(await basic.page.locator('#unit-inspect').isVisible(),true);await basic.page.keyboard.press('Escape');checks.push('keyboard Enter description and Escape');
 const b=await cardButton.boundingBox(), cdp=await basic.context.newCDPSession(basic.page), manaBefore=(await state(basic.page)).players[0].mana;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+20,y:b.y+40}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+100,y:b.y+40}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await state(basic.page)).players[0].mana,manaBefore);assert.equal(await basic.page.locator('.hand-drag-ghost').isVisible(),false);checks.push('horizontal touch swipe does not play');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+20,y:b.y+40}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+20,y:b.y-45}]});assert.equal(await basic.page.locator('.hand-drag-ghost').isVisible(),false);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await basic.page.locator('.hand-drag-ghost').isVisible(),false);assert.equal((await state(basic.page)).players[0].mana,manaBefore);checks.push('native touchCancel cleans without charge');await cdp.detach();
 await drag(basic.page,0,await point(basic.page,2,1),true);assert.equal((await state(basic.page)).units.some(u=>u.owner===0&&u.cardId===14),true);checks.push('touch unit drop deploys');
 const mana=(await state(basic.page)).players[0].mana;
 await drag(basic.page,0,{x:550,y:300},true);assert.equal((await state(basic.page)).players[0].mana,mana);checks.push('untargeted red drop cancels');
 await drag(basic.page,0,await point(basic.page,3,1),true);assert.equal((await state(basic.page)).players[0].hand.includes(20044),false);checks.push('untargeted battlefield release casts once');await basic.context.close();
 const full=await open(seed(1,[20044],true),568,320);await full.page.waitForTimeout(100);assert.equal(await full.page.locator('#hand button').count(),6);
 // Force the same narrow rail fixture used by viewport checks, preserving real cards and input.
 await full.page.locator('#hand').evaluate(el=>{el.style.width='240px';el.style.maxWidth='240px'});await full.page.waitForTimeout(100);
 const originalFull=await state(full.page), railBefore=await full.page.locator('#hand').evaluate(el=>({scroll:el.scrollLeft,width:el.clientWidth,content:el.scrollWidth}));assert.ok(railBefore.content>railBefore.width);
 const f=await full.page.locator('#hand button').nth(0).boundingBox(), fc=await full.context.newCDPSession(full.page);const fp={x:f.x+20,y:f.y+f.height/2};
 await fc.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[fp]});for(let i=1;i<=8;i++)await fc.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:fp.x-100*i/8,y:fp.y}]});await fc.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const scrollAfter=await full.page.locator('#hand').evaluate(el=>el.scrollLeft);assert.ok(scrollAfter>railBefore.scroll+20);assert.equal((await state(full.page)).players[0].mana,originalFull.players[0].mana);assert.deepEqual((await state(full.page)).players[0].hand,originalFull.players[0].hand);assert.equal(await full.page.locator('#hand .selected').count(),0);checks.push(`six-card 568 touch rail scroll ${railBefore.scroll}->${scrollAfter}; explicit 240px test rail`);await shot(full.page,'six-card-scroll-568.png');
 await full.page.locator('#hand').evaluate(el=>el.scrollLeft=0);await full.page.waitForTimeout(50);const fb=await full.page.locator('#hand button').nth(0).boundingBox();
 await fc.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:fb.x+20,y:fb.y+30}]});await fc.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:fb.x+20,y:fb.y-45}]});assert.equal(await full.page.locator('.hand-drag-ghost').isVisible(),false);
 await full.page.setViewportSize({width:844,height:390});await full.page.waitForTimeout(100);assert.equal(await full.page.locator('.hand-drag-ghost').isVisible(),false);assert.equal(await full.page.locator('.hand-cancel-zone').isVisible(),false);assert.equal((await state(full.page)).players[0].mana,originalFull.players[0].mana);await fc.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await fc.detach();checks.push('real viewport resize during active touch drag clears overlays and preserves mana');await full.context.close();
 assert.deepEqual(errors,[]);writeFileSync(new URL('hand-drag-report.json',out),JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close()}
