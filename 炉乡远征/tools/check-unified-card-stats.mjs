import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch,confirmMulligan,playCard,getBattleCard,validateMatch} from '../dist/js/engine.js';
import {getUnitSpecializations} from '../dist/js/campaign-rules.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
const {chromium}=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const out=new URL('../output/unified-card-stats/',import.meta.url);mkdirSync(out,{recursive:true});
const base=process.env.CAMPAIGN_UI_BASE||'http://127.0.0.1:4227';
class Memory{data=new Map();getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,String(v))}removeItem(k){this.data.delete(k)}}
function fixture(id,opening=false){
 const hero=id===211?201:1,p=new ExpeditionProgress(new Memory());assert.ok(p.selectHero(hero).ok);
 const profile=p.state;profile.inventory.units=[...new Set([...profile.inventory.units,id])];assert.ok(p.replaceState(profile).ok);
 const deck=p.getBattleLoadout().deck;while(deck.filter(x=>x===id).length<2){const index=deck.findIndex(x=>x!==id);deck[index]=id;}assert.ok(p.setBattleDeck(deck).ok);
 const m=createExpeditionMatch('border-01',p.state.training,p.state.squad,hero,p.getBattleLoadout());
 assert.ok(p.saveBattle(m).ok);
 if(opening){m.players[0].hand=[id,...m.loadout.deck.filter(x=>x!==id).slice(0,4)];m.players[0].deck=[...m.loadout.deck];for(const held of m.players[0].hand)m.players[0].deck.splice(m.players[0].deck.indexOf(held),1);const index=m.players[0].deck.indexOf(id);if(index>=0)m.players[0].deck.unshift(...m.players[0].deck.splice(index,1));assert.ok(p.saveBattle(m).ok);return{profile:p.state,id};}
 assert.ok(confirmMulligan(m));const template=m.units.find(u=>u.owner===1&&getBattleCard(m,u.cardId,1)?.type==='unit');m.units=m.units.filter(u=>getBattleCard(m,u.cardId,u.owner)?.type==='general');
 const remaining=[...m.loadout.deck];remaining.splice(remaining.indexOf(id),1);m.players[0].hand=[id];m.players[0].deck=remaining;m.players[0].mana=9;assert.ok(playCard(m,0,2,1));
 const own=m.units.find(u=>u.owner===0&&u.cardId===id);own.attackBuff=12-own.attack;own.healthBuff=24-own.maxHealth;own.health=23;
 remaining.splice(remaining.indexOf(id),1);m.players[0].hand=[id];m.players[0].deck=remaining;m.players[0].mana=9;
 const enemy=getBattleCard(m,213,1);m.units.push({...template,unitId:10001,cardId:213,x:5,y:2,attack:enemy.attack,health:enemy.health,maxHealth:enemy.health,attackBuff:0,healthBuff:0,silenced:true});
 assert.ok(validateMatch(m),`valid ${id} dynamic-stat fixture`);assert.ok(p.saveBattle(m).ok);return{profile:p.state,id,ownId:own.unitId};
}
if(process.env.STAT_FIXTURES_ONLY==='1'){fixture(19027);fixture(211);fixture(19027,true);fixture(211,true);console.log('Neutral19027/F3211 dynamic and opening fixtures validated');process.exit(0);}
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const checks=[],errors=[];let passed=false;
const shot=(p,name)=>p.screenshot({path:new URL(name+'.png',out).pathname.replace(/^\/([A-Z]:)/,'$1')});
async function open(f,width,height,motion){const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:motion}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(({profile,key})=>localStorage.setItem(key,JSON.stringify(profile)),{profile:f.profile,key:SAVE_KEYS.expedition});await page.addInitScript(async()=>{const{BoardRenderer}=await import('/js/renderer.js'),draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__renderer=this;window.__opts=args[1];return draw.apply(this,args)}});await page.goto(base);return{page,context};}
async function holdUnit(page,id){const point=await page.evaluate(id=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===id);r.focusCell(u.x,u.y);r.pan(-60,-60);r.draw(r.state,window.__opts);const p=r.getUnitAnchor(u);for(let dy=-30;dy<=25;dy+=5)for(let dx=-20;dx<=20;dx+=5){const q={x:p.x+dx,y:p.y+dy},hit=r.positionFromPointer({clientX:q.x,clientY:q.y},{preferUnits:true});if(hit?.x===u.x&&hit?.y===u.y&&document.elementFromPoint(q.x,q.y)===r.canvas)return q}return null},id);assert.ok(point);const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await page.waitForTimeout(500);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();}
async function geometry(card){return card.evaluate(el=>{const rect=n=>n&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&getComputedStyle(n).display!=='none'?n.getBoundingClientRect().toJSON():null,stats=el.querySelector('.game-card-stats');return{card:rect(el),name:rect(el.querySelector('.game-card-name')),type:rect(el.querySelector('.game-card-type')),rules:rect(el.querySelector('.game-card-description')),stats:rect(stats),badges:[...stats.querySelectorAll(':scope>span')].map(n=>({text:n.textContent,rect:rect(n),scroll:n.scrollWidth,client:n.clientWidth,background:getComputedStyle(n).backgroundImage})),frame:getComputedStyle(el.querySelector('.game-card-frame')).backgroundImage}});}
function checkGeometry(g,label){assert.equal(g.badges.length,2,label+' two stat badges');for(const b of g.badges){assert.ok(b.scroll<=b.client+1,label+' numeral fits');assert.ok(b.rect.x>=g.card.x-1&&b.rect.right<=g.card.right+1,label+' badge inside card');}assert.ok(g.name.bottom<=g.stats.y+2,label+' name stays above stats');if(g.rules)assert.ok(g.stats.bottom<=g.rules.y+2,label+' stats stay above visible rules');}
if(process.env.HERO_EFFECT_ONLY==='1'){
 try{for(const[width,height,motion]of[[568,320,'no-preference'],[844,390,'reduce']]){
  const f=fixture(19027),{page,context}=await open(f,width,height,motion);
  await page.locator('.menu-play').tap();await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__renderer?.ready&&!document.querySelector('#end-turn').disabled);
  const hero=f.profile.activeBattle.units.find(u=>u.cardId===1&&u.owner===0);
  await holdUnit(page,hero.unitId);await page.locator('#unit-inspect.hero-preview').waitFor({state:'visible'});
  assert.equal(await page.locator('.inspect-ability').count(),2);await shot(page,`hero-abilities-${width}`);
  const before=await page.evaluate(()=>JSON.stringify(window.__renderer.state));
  await page.evaluate(()=>{window.__boardPresses=0;window.__renderer.canvas.addEventListener('pointerdown',()=>window.__boardPresses++)});
  for(const[index,method]of[[0,'back'],[1,'escape'],[0,'outside']]){
   const ability=page.locator('.inspect-ability').nth(index);await ability.tap();const dialog=page.locator('dialog.hero-effect-dialog[open]');await dialog.waitFor();
   const content=await dialog.evaluate(el=>({text:el.innerText,effect:el.querySelector('.hero-effect-copy').textContent,buttons:[...el.querySelectorAll('button')].map(n=>n.textContent),headings:el.querySelectorAll('h1,h2,h3,h4,.mana,.inspect-ability-name').length,box:el.getBoundingClientRect().toJSON()}));
   assert.deepEqual(content.buttons,['返回']);assert.equal(content.headings,0);assert.equal(content.text.replace(/\s+/g,''),(content.effect+'返回').replace(/\s+/g,''));assert.ok(content.box.y>=0&&content.box.bottom<=height);
   await shot(page,`hero-${index===0?'active':'passive'}-${method}-${width}`);
   if(method==='back')await dialog.locator('.hero-effect-back').tap();
   else if(method==='escape')await page.keyboard.press('Escape');
   else await page.touchscreen.tap(10,height/2);
   assert.equal(await page.locator('dialog.hero-effect-dialog').count(),0,'only secondary closes');assert.equal(await page.locator('#unit-inspect').isVisible(),true);
   assert.equal(await ability.evaluate(el=>document.activeElement===el),true,'focus returns to ability trigger');
   assert.equal(await page.evaluate(()=>window.__boardPresses),0,'modal input never reaches battlefield');assert.equal(await page.evaluate(()=>JSON.stringify(window.__renderer.state)),before,'reading never mutates battle');
  }
  await page.keyboard.press('Escape');assert.equal(await page.locator('#unit-inspect').isVisible(),false);assert.equal(await page.locator('.hero-effect-dialog').count(),0);
  await page.locator('#leave-match').tap();await page.locator('#confirm-accept').tap();await page.waitForFunction(()=>document.querySelector('#match').hidden);assert.equal(await page.locator('.hero-effect-dialog').count(),0);
  checks.push({width,motion,activeAndPassive:true,effectOnly:true,backEscapeOutsideKeepMain:true,noClickThrough:true,focusRestored:true,noBattleMutation:true,leaveClean:true});await context.close();
 }assert.deepEqual(errors,[]);passed=true;
 }finally{await browser.close();writeFileSync(new URL('hero-effects-report.json',out),JSON.stringify({passed,checks,errors},null,2));}
 console.log(JSON.stringify({passed,samples:checks.length,errors}));process.exit(0);
}
try{for(const[width,height,motion]of[[568,320,'no-preference'],[844,390,'reduce']])for(const id of[19027,211]){
 const f=fixture(id),{page,context}=await open(f,width,height,motion),tag=`${id}-${width}`;
 await page.locator('.menu-destination[data-page="codex"]').tap();await page.locator(`[data-action="codex-faction"][data-faction-id="${id===211?3:0}"]`).tap();await page.locator(`.expedition-codex-card[data-card-id="${id}"]`).tap();await page.locator('dialog.expedition-card-dialog[open]').waitFor();
 const collection=await geometry(page.locator('dialog.expedition-card-dialog[open] .game-card'));checkGeometry(collection,'collection');await shot(page,`collection-${tag}`);await page.locator('[data-action="close-card"]').tap();await page.locator('.expedition-menu-return').tap();
 await page.locator('.menu-play').tap();await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__renderer?.ready&&!document.querySelector('#end-turn').disabled);
 await shot(page,`hand-${tag}`);await page.locator('#hand button').first().tap();const hand=await geometry(page.locator('#unit-inspect .game-card'));checkGeometry(hand,'hand detail');await shot(page,`hand-detail-${tag}`);await page.keyboard.press('Escape');
 await holdUnit(page,f.ownId);const dynamic=await geometry(page.locator('#unit-inspect .game-card'));checkGeometry(dynamic,'two-digit dynamic detail');assert.deepEqual(dynamic.badges.map(b=>b.text),['12','23']);await shot(page,`dynamic-detail-${tag}`);await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await holdUnit(page,10001);const description=page.locator('#unit-inspect-description'),box=await description.boundingBox();const c=await context.newCDPSession(page),from={x:box.x+box.width/2,y:box.y+box.height-8};await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});for(let i=1;i<=10;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x,y:from.y-60*i/10}]});await page.waitForTimeout(30);}await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();assert.ok(await description.evaluate(el=>el.scrollTop>0));await shot(page,`long-rules-${tag}`);
 checks.push({id,width,motion,collection,hand,dynamic,longTouchScroll:true});await context.close();
 const opening=await open(fixture(id,true),width,height,motion);await opening.page.locator('.menu-play').tap();await opening.page.locator('#objective-close').tap();await opening.page.locator('.opening-confirm').waitFor();await shot(opening.page,`opening-${tag}`);await opening.page.locator('.opening-confirm').tap();await opening.page.locator('.battle-draw-face').waitFor({state:'visible'});await opening.page.waitForTimeout(motion==='reduce'?35:260);await shot(opening.page,`draw-${tag}`);await opening.page.waitForFunction(()=>!document.querySelector('.card-draw-flight')&&!document.querySelector('#end-turn').disabled);await opening.context.close();
 }assert.deepEqual(errors,[]);passed=true;
}finally{await browser.close();writeFileSync(new URL('report.json',out),JSON.stringify({passed,checks,errors},null,2));}
console.log(JSON.stringify({passed,samples:checks.length,errors}));
