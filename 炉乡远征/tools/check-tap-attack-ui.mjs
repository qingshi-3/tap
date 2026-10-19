import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch,confirmMulligan,playCard,validateMatch,attackUnit,attackPositions,movementPath} from '../dist/js/engine.js';
import {CARDS} from '../dist/js/cards.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const base=process.env.CAMPAIGN_UI_BASE||'http://127.0.0.1:4227';
const out=new URL('../output/tap-attack/',import.meta.url);mkdirSync(out,{recursive:true});
class Memory{data=new Map();getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,String(v))}removeItem(k){this.data.delete(k)}}

// Fixtures live only in the disposable browser context; no user's storage is touched.
function seed(kind='melee',fullHand=false,mulligan=false) {
 const hero=kind==='ranged'?101:kind==='blast'?201:1, card=kind==='ranged'?109:kind==='blast'?213:14;
 const p=new ExpeditionProgress(new Memory());assert.ok(p.selectHero(hero).ok);const profile=p.state;profile.inventory.units=[...new Set([...profile.inventory.units,card])];assert.ok(p.replaceState(profile).ok);
 const load=p.getBattleLoadout();if(!load.deck.includes(card)){load.deck[0]=card;assert.ok(p.setBattleDeck(load.deck).ok)}
 const m=createExpeditionMatch('border-01',p.state.training,p.state.squad,hero,p.getBattleLoadout());assert.ok(p.saveBattle(m).ok);if(mulligan)return {profile:p.state,sourceId:null,targetId:null,secondId:null};assert.ok(confirmMulligan(m));
 const deck=[...m.loadout.deck],i=deck.indexOf(card);assert.ok(i>=0);deck.splice(i,1);m.players[0].hand=[card];m.players[0].deck=deck;m.players[0].mana=9;assert.ok(playCard(m,0,2,1));
 const source=m.units.find(u=>u.owner===0&&u.cardId===card);Object.assign(source,{x:3,y:2,moved:false,attacked:false,summonedThisTurn:false,health:12,maxHealth:12});
 const target=m.units.find(u=>u.owner===1&&CARDS[u.cardId]?.type==='unit');assert.ok(target);Object.assign(target,{x:kind==='melee'||kind==='provoke'?4:5,y:2,health:12,maxHealth:12,attack:2,attackBuff:0});
 if(kind==='ranged')target.cardId=213;
 const second={...target,unitId:Math.max(...m.units.map(u=>u.unitId))+1,x:kind==='blast'?6:5,y:2,health:12};if(kind==='ranged'){second.x=5;second.y=3};m.units.push(second);
 if(kind==='provoke'){target.cardId=11;target.x=3;target.y=3;second.x=4;second.y=2;}
 const general=m.units.find(u=>u.owner===1&&CARDS[u.cardId]?.type==='general');general.x=8;general.y=4;
 m.selectedUnitId=null;m.lastAction=null;if(fullHand)m.players[0].hand=m.players[0].deck.splice(0,6);assert.ok(validateMatch(m),`${kind} fixture valid`);assert.ok(p.saveBattle(m).ok);return {profile:p.state,sourceId:source.unitId,targetId:target.unitId,secondId:second.unitId};
}
if(process.env.ATTACK_FIXTURES_ONLY==='1'){for(const kind of ['melee','ranged','blast','provoke'])seed(kind);console.log('four isolated attack fixtures validated');process.exit(0)}
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const errors=[],checks=[];
async function open(fixture,width,height,motion='reduce'){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:motion});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(({profile,key})=>localStorage.setItem(key,JSON.stringify(profile)),{profile:fixture.profile,key:SAVE_KEYS.expedition});
 await page.addInitScript(async()=>{const{BoardRenderer}=await import('/js/renderer.js'),draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(state,options={}){window.__renderer=this;window.__drawOptions=structuredClone(options);return draw.call(this,state,options)}});
 await page.goto(base);await page.locator('.menu-play').tap();await page.locator('#objective-close').waitFor({state:'visible'});await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__renderer?.ready&&!document.querySelector('#match').hidden&&!document.querySelector('#end-turn').disabled);
 if(fixture.sourceId)await page.evaluate(id=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===id);r.focusCell(u.x,u.y);r.pan(-60,-60);r.draw(r.state,window.__drawOptions)},fixture.sourceId);return {page,context,fixture};
}
const state=page=>page.evaluate(()=>structuredClone(window.__renderer.state));
const options=page=>page.evaluate(()=>structuredClone(window.__drawOptions));
async function point(page,id){return page.evaluate(id=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===id),p=r.getUnitAnchor(u);for(const dy of [0,8,-8,16,-16]){const q={x:p.x,y:p.y+dy};if(document.elementFromPoint(q.x,q.y)===r.canvas&&r.positionFromPointer({clientX:q.x,clientY:q.y},{preferUnits:true})?.x===u.x&&r.positionFromPointer({clientX:q.x,clientY:q.y},{preferUnits:true})?.y===u.y)return q}return null},id)}
async function cellPoint(page,x,y){return page.evaluate(({x,y})=>{const r=window.__renderer,b=r.canvas.getBoundingClientRect(),c=r.cellGeometry(r.boardMetrics(b.width,b.height),x,y).center;return {x:b.x+c.x,y:b.y+c.y}},{x,y})}
async function shot(page,name){await page.screenshot({path:new URL(name+'.png',out).pathname.replace(/^\/([A-Z]:)/,'$1')})}
async function gesture(page,from){
 assert.ok(from,'visible source');const c=await page.context().newCDPSession(page);
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
 return {
  async move(to){assert.ok(to,'visible destination');for(let i=1;i<=8;i++){
   await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8}]});
   await page.waitForTimeout(30);
  }},
  async finish(cancel=false){await c.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await c.detach();await page.waitForTimeout(650)}
 };
}
function business(m){return {units:m.units,players:m.players,phase:m.phase,log:m.log,lastAction:m.lastAction}}
function result(m){return {units:m.units.map(({unitId,x,y,health,attack,attackBuff,moved,attacked,summonedThisTurn,stunTurns,skirmishUsed,attacksUsed,movesUsed})=>({unitId,x,y,health,attack,attackBuff,moved,attacked,summonedThisTurn,stunTurns,skirmishUsed,attacksUsed,movesUsed})),players:m.players,phase:m.phase,lastAction:m.lastAction}}
async function assertPreview(page,sourceId,targetId){const o=await options(page);assert.ok(o.attackPreview,'real drag rendered attack preview');assert.ok(o.attackGesture,'real drag rendered attacking gesture');assert.equal(o.attackGesture.targetId,targetId);assert.equal(o.attackPreview.attackerId,sourceId);assert.equal(o.attackPreview.targetId,targetId);const expected=await state(page);assert.ok(attackPositions(expected,expected.units.find(u=>u.unitId===sourceId)).some(u=>u.unitId===targetId));const predicted=structuredClone(expected);assert.ok(attackUnit(predicted,sourceId,targetId,0));for(const unit of o.attackPreview.units){const after=predicted.units.find(u=>u.unitId===unit.unitId);assert.equal(unit.removed,!after,`forecast removal ${unit.unitId}`);if(after)assert.equal(unit.healthAfter,after.health,`forecast health ${unit.unitId}`)}return o}

async function tapUnit(page,id){const p=await point(page,id);assert.ok(p,`unit ${id} reachable`);await page.touchscreen.tap(p.x,p.y);}
async function clearSelection(page) {
 assert.equal((await state(page)).selectedUnitId,null);
 const o=await options(page);assert.equal(o.selectedUnitId,null);assert.equal(o.observedUnitId,null);
 assert.equal(await page.locator('#unit-inspect').isVisible(),false);
 assert.equal(await page.locator('#board-hint').evaluate(el=>el.classList.contains('visible')),false);
}
let passed=false;
try {for(const [width,height] of (process.env.TAP_ATTACK_VISUAL_ONLY==='1'||process.env.TAP_ATTACK_COMBO_ONLY==='1'?[]:[[568,320],[844,390]])) {
 const attack=await open(seed(),width,height,'no-preference');
 await tapUnit(attack.page,attack.fixture.sourceId);
 assert.equal((await state(attack.page)).selectedUnitId,attack.fixture.sourceId);
 await shot(attack.page,`selected-${width}`);
 const before=await state(attack.page),expected=structuredClone(before);
 assert.ok(attackUnit(expected,attack.fixture.sourceId,attack.fixture.targetId,0));
 await tapUnit(attack.page,attack.fixture.targetId);
 await attack.page.waitForFunction(()=>!document.querySelector('#end-turn').disabled);
 assert.deepEqual(result(await state(attack.page)),result(expected),'tap commits exact attack once');
 await clearSelection(attack.page);await shot(attack.page,`attacked-${width}`);
 checks.push(`${width}: own tap selects; adjacent enemy tap exact engine result once; selection/detail/ranges cleared`);
 await attack.context.close();

 const cancel=await open(seed(),width,height);
 for(const [name,destination] of [['far-enemy',()=>point(cancel.page,cancel.fixture.secondId)],['blank',()=>cellPoint(cancel.page,2,2)]]) {
  await tapUnit(cancel.page,cancel.fixture.sourceId);const original=business(await state(cancel.page));
  const p=await destination();assert.ok(p);await cancel.page.touchscreen.tap(p.x,p.y);
  assert.deepEqual(business(await state(cancel.page)),original,`${name} never changes combat`);
  await clearSelection(cancel.page);await shot(cancel.page,`${name}-cancel-${width}`);
 }
 await tapUnit(cancel.page,cancel.fixture.targetId);
 assert.equal(await cancel.page.locator('#unit-inspect').isVisible(),true);
 assert.equal((await options(cancel.page)).observedUnitId,cancel.fixture.targetId);
 assert.equal((await state(cancel.page)).selectedUnitId,null);
 await shot(cancel.page,`enemy-readonly-${width}`);
 checks.push(`${width}: invalid enemy/blank silently cancel; unselected enemy opens read-only detail/ranges`);
 await cancel.context.close();

 const move=await open(seed(),width,height),from=await point(move.page,move.fixture.sourceId),to=await cellPoint(move.page,2,2);
 const g=await gesture(move.page,from);await g.move(to);
 assert.ok((await options(move.page)).movementPreview?.path.length);
 await shot(move.page,`move-preview-${width}`);await g.finish();
 const moved=(await state(move.page)).units.find(u=>u.unitId===move.fixture.sourceId);
 assert.deepEqual([moved.x,moved.y],[2,2]);await move.context.close();

 const drag=await open(seed(),width,height),original=business(await state(drag.page));
 const d=await gesture(drag.page,await point(drag.page,drag.fixture.sourceId));await d.move(await point(drag.page,drag.fixture.targetId));
 assert.ok((await options(drag.page)).attackGesture==null);
 await shot(drag.page,`drag-enemy-no-attack-${width}`);await d.finish();
 assert.deepEqual(business(await state(drag.page)),original,'drag onto enemy never attacks');
 checks.push(`${width}: paced real touch movement commits; drag onto enemy does not attack`);
 await drag.context.close();
 }
 for(const motion of (process.env.TAP_ATTACK_COMBO_ONLY==='1'?[]:['no-preference','reduce'])) {
  const sample=await open(seed(),568,320,motion),{page,fixture}=sample;
  await page.evaluate(()=>{
   window.__unitFilters={};window.__unitBodyPixels={};const r=window.__renderer,drawUnit=r.drawUnit,drawImage=CanvasRenderingContext2D.prototype.drawImage;
   r.drawUnit=function(ctx,state,unit,...args){window.__drawingUnit=unit.unitId;try{return drawUnit.call(this,ctx,state,unit,...args)}finally{window.__drawingUnit=null}};
   CanvasRenderingContext2D.prototype.drawImage=function(...args){
    if(window.__drawingUnit!=null){
     window.__unitFilters[window.__drawingUnit]=this.filter;
     if(args.length===9){
      const isolated=document.createElement('canvas');isolated.width=args[3];isolated.height=args[4];
      const ctx=isolated.getContext('2d');ctx.filter=this.filter;
      drawImage.call(ctx,args[0],args[1],args[2],args[3],args[4],0,0,args[3],args[4]);
      window.__unitBodyPixels[window.__drawingUnit]=isolated.toDataURL();
     }
    }
    return drawImage.apply(this,args);
   };
  });
  await tapUnit(page,fixture.sourceId);await tapUnit(page,fixture.targetId);
  await page.waitForFunction(()=>!document.querySelector('#end-turn').disabled);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(id=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===id);return r.unitRestingAfterAction(u)||window.__unitFilters[id]?.includes('grayscale')},fixture.sourceId),false,'attack alone keeps unit colored while movement remains');
  await shot(page,`attacked-color-can-move-${motion}`);
  const g=await gesture(page,await point(page,fixture.sourceId));await g.move(await cellPoint(page,3,1));await g.finish();
  assert.deepEqual((await state(page)).units.filter(u=>u.unitId===fixture.sourceId).map(u=>[u.x,u.y,u.moved,u.attacked]),[[3,1,true,true]]);
  await page.waitForFunction(id=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===id);return u&&r.unitRestingAfterAction(u)&&window.__unitFilters[id]?.includes('grayscale')},fixture.sourceId);
  await page.waitForTimeout(400);
  const pixels=()=>page.evaluate(id=>window.__unitBodyPixels[id],fixture.sourceId);
  const still=await pixels();assert.ok(still?.startsWith('data:image/png'));await page.waitForTimeout(500);assert.equal(await pixels(),still,`${motion}: isolated acted body pixels remain stationary`);
  await page.waitForFunction(()=>!document.querySelector('#end-turn').disabled);await page.waitForTimeout(600);
  await shot(page,`acted-gray-${motion}`);
  await page.locator('#end-turn').tap();
  await page.waitForFunction(id=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===id);return r.state.currentPlayer===0&&r.state.round>1&&u&&!r.unitRestingAfterAction(u)&&!document.querySelector('#end-turn').disabled},fixture.sourceId,{timeout:30000});
  await page.waitForTimeout(150);assert.ok(!await page.evaluate(id=>window.__unitFilters[id]?.includes('grayscale'),fixture.sourceId));
  await shot(page,`next-turn-ready-${motion}`);
  checks.push(`568 ${motion}: attack alone stays colored; real drag then exhausts both actions and renders grayscale + stationary body pixels; real end-turn/AI/next-turn restores color/readiness`);
  await sample.context.close();
 }
 if(process.env.TAP_ATTACK_COMBO_ONLY!=='1') {
 const mouse=await open(seed(),844,390),mp=mouse.page;
 const click=async id=>{const p=await point(mp,id);assert.ok(p);await mp.mouse.click(p.x,p.y)};
 await click(mouse.fixture.sourceId);const mouseBefore=await state(mp),mouseExpected=structuredClone(mouseBefore);assert.ok(attackUnit(mouseExpected,mouse.fixture.sourceId,mouse.fixture.targetId,0));
 await click(mouse.fixture.targetId);await mp.waitForFunction(()=>!document.querySelector('#end-turn').disabled);assert.deepEqual(result(await state(mp)),result(mouseExpected));
 await click(mouse.fixture.sourceId);await click(mouse.fixture.secondId);await clearSelection(mp);
 await click(mouse.fixture.sourceId);await mp.keyboard.press('Escape');await clearSelection(mp);
 checks.push('844 mouse: click legal enemy attacks once; invalid enemy click and Escape clear selection silently');await mouse.context.close();
 }
 if(process.env.TAP_ATTACK_COMBO_ONLY==='1')for(const [width,height] of [[568,320],[844,390]])for(const motion of ['no-preference','reduce']) {
  const combo=await open(seed(),width,height,motion),{page,fixture}=combo;
  const g=await gesture(page,await point(page,fixture.sourceId));await g.move(await cellPoint(page,4,1));await g.finish();
  await page.waitForFunction(()=>!document.querySelector('#end-turn').disabled);
  const moved=await state(page),source=moved.units.find(u=>u.unitId===fixture.sourceId);
  assert.deepEqual([source.x,source.y],[4,1]);assert.ok(source.moved);assert.ok(!source.attacked);
  assert.equal(await page.evaluate(id=>{const r=window.__renderer;return r.unitRestingAfterAction(r.state.units.find(u=>u.unitId===id))},fixture.sourceId),false);
  assert.ok(attackPositions(moved,source).some(u=>u.unitId===fixture.targetId));
  await shot(page,`moved-color-can-attack-${width}-${motion}`);
  const expected=structuredClone(moved);assert.ok(attackUnit(expected,fixture.sourceId,fixture.targetId,0));
  await tapUnit(page,fixture.sourceId);await tapUnit(page,fixture.targetId);
  await page.waitForFunction(()=>!document.querySelector('#end-turn').disabled);await page.waitForTimeout(600);
  assert.deepEqual(result(await state(page)),result(expected));
  assert.ok(await page.evaluate(id=>{const r=window.__renderer;return r.unitRestingAfterAction(r.state.units.find(u=>u.unitId===id))},fixture.sourceId));
  await shot(page,`acted-gray-${width}-${motion}`);
  checks.push(`${width} ${motion}: real drag move stays colored with attack available; tap legal enemy attacks exactly once then grays after playback`);
  await combo.context.close();
 }
 assert.deepEqual(errors,[]);passed=true;
}finally{await browser.close();writeFileSync(new URL(process.env.TAP_ATTACK_COMBO_ONLY==='1'?'combo-report.json':process.env.TAP_ATTACK_VISUAL_ONLY==='1'?'supplement-report.json':'report.json',out),JSON.stringify({passed,checks,errors},null,2));}
console.log(JSON.stringify({passed,checks,errors}));

