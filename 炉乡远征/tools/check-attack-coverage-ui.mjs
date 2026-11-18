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
const out=new URL('../output/finite-range/coverage/',import.meta.url);mkdirSync(out,{recursive:true});
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
 const second={...target,unitId:Math.max(...m.units.map(u=>u.unitId))+1,x:kind==='blast'?6:4,y:kind==='blast'?2:3,health:12};if(kind==='ranged')second.x=5;m.units.push(second);
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
async function gesture(page,from){assert.ok(from,'visible source');const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});return{async move(to){for(let i=1;i<=8;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8}]})},async finish(cancel=false){await c.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await c.detach();await page.waitForTimeout(650)}}}
function business(m){return {units:m.units,players:m.players,phase:m.phase,log:m.log,lastAction:m.lastAction}}
function result(m){return {units:m.units.map(({unitId,x,y,health,attack,attackBuff,moved,attacked,summonedThisTurn,stunTurns,skirmishUsed})=>({unitId,x,y,health,attack,attackBuff,moved,attacked,summonedThisTurn,stunTurns,skirmishUsed})),players:m.players,phase:m.phase,lastAction:m.lastAction}}
async function assertPreview(page,sourceId,targetId){const o=await options(page);assert.ok(o.attackPreview,'real drag rendered attack preview');assert.ok(o.attackGesture,'real drag rendered attacking gesture');assert.equal(o.attackGesture.targetId,targetId);assert.equal(o.attackPreview.attackerId,sourceId);assert.equal(o.attackPreview.targetId,targetId);const expected=await state(page);assert.ok(attackPositions(expected,expected.units.find(u=>u.unitId===sourceId)).some(u=>u.unitId===targetId));const predicted=structuredClone(expected);assert.ok(attackUnit(predicted,sourceId,targetId,0));for(const unit of o.attackPreview.units){const after=predicted.units.find(u=>u.unitId===unit.unitId);assert.equal(unit.removed,!after,`forecast removal ${unit.unitId}`);if(after)assert.equal(unit.healthAfter,after.health,`forecast health ${unit.unitId}`)}return o}

if(process.env.ATTACK_CACHE_ONLY==='1') {
 try {
  const fixture=seed('ranged'),{page,context}=await open(fixture,568,320),from=await point(page,fixture.sourceId);
  await page.touchscreen.tap(from.x,from.y);await page.waitForFunction(id=>window.__drawOptions.selectedUnitId===id&&window.__renderer.attackCoveragePositions?.length>0,fixture.sourceId);
  const evidence=await page.evaluate(()=>{
   const r=window.__renderer,cache=r.attackCoverageCache,initial=cache.computations,original=r.attackCoveragePositions;
   for(let i=0;i<120;i++){r.pan(i%2?1:-1,0);r.draw(r.state,window.__drawOptions)}
   return {initial,afterPan:cache.computations,sameCoverage:r.attackCoveragePositions===original};
  });
  assert.equal(evidence.initial,evidence.afterPan);assert.ok(evidence.sameCoverage);assert.deepEqual(errors,[]);
  writeFileSync(new URL('cache-ui-report.json',out),JSON.stringify({passed:true,viewport:[568,320],panDraws:120,...evidence,errors},null,2));
  console.log(JSON.stringify({passed:true,...evidence}));await context.close();
 } finally {await browser.close()}process.exit(0);
}
try {
 for(const [width,height] of [[844,390],[568,320]]) for(const kind of ['melee','ranged','blast','provoke']) {
  const fixture=seed(kind),{page,context}=await open(fixture,width,height),from=await point(page,fixture.sourceId),to=await point(page,fixture.targetId);
  await page.touchscreen.tap(from.x,from.y);await page.waitForFunction(id=>window.__drawOptions.selectedUnitId===id&&window.__renderer.attackCoveragePositions?.length>0,fixture.sourceId);
  const covered=await page.evaluate(()=>window.__renderer.attackCoveragePositions);
    assert.ok(covered.length>0);
  const availability=await page.evaluate(async id=>{
    const {attackCoverage}=await import('/js/attack-coverage.js'),r=window.__renderer,u=r.state.units.find(v=>v.unitId===id),m=structuredClone(r.state),copy=m.units.find(v=>v.unitId===id);
    const counts={};for(const key of ['attacked','summonedThisTurn']){copy[key]=true;counts[key]=attackCoverage(m,copy).length;copy[key]=false}
    copy.moved=true;counts.moved=attackCoverage(m,copy).length;
    copy.silenced=true;counts.silenced=attackCoverage(m,copy).length;
    m.currentPlayer=1;counts.otherTurn=attackCoverage(m,copy).length;return counts;
  },fixture.sourceId);
  assert.equal(availability.attacked,0);assert.equal(availability.summonedThisTurn,0);assert.equal(availability.otherTurn,0);assert.equal(availability.moved,covered.length);
  if(kind==='ranged')assert.ok(availability.silenced<covered.length,'silence removes ranged coverage');
  if(kind==='provoke') assert.deepEqual(covered.map(p=>p.unitId),[fixture.targetId]);
  else assert.ok(covered.length>attackPositions(await state(page),(await state(page)).units.find(u=>u.unitId===fixture.sourceId)).length,'range includes empty squares');
  await shot(page,`${kind}-${width}-selected`);
  const before=await state(page),g=await gesture(page,from);await g.move(to);await assertPreview(page,fixture.sourceId,fixture.targetId);await shot(page,`${kind}-${width}-drag`);await g.finish();
  const after=await state(page);assert.ok(after.units.find(u=>u.unitId===fixture.sourceId).attacked);assert.deepEqual(await page.evaluate(()=>window.__renderer.attackCoveragePositions),[],'spent attack hides red range');
  checks.push({kind,width,height,covered:covered.length,touchAttack:true});await context.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(new URL('report.json',out),JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close()}



