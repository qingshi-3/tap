import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch,confirmMulligan,playCard,validateMatch,getBattleCard,battleCommandTargets,useBattleCommand} from '../dist/js/engine.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
import {ALL_RECRUITMENT_IDS} from '../dist/js/recruitment-catalog.js';
import {getUnitSpecializations} from '../dist/js/campaign-rules.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');const {chromium}=require('playwright');
const out=new URL('../output/original-battle-cards/',import.meta.url);mkdirSync(out,{recursive:true});
const base=process.env.CAMPAIGN_UI_BASE||'http://127.0.0.1:4227';
class Memory{data=new Map();getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,String(v))}removeItem(k){this.data.delete(k)}}
function seed(enemyId){const memory=new Memory();memory.setItem(SAVE_KEYS.expedition,JSON.stringify(JSON.parse(readFileSync(new URL('../tools/fixtures/save-contract-profile10-pre-random-2026-10-14.json',import.meta.url))).profiles[0]));const p=new ExpeditionProgress(memory);assert.equal(p.error,'');assert.ok(p.selectHero(1).ok);const profile=p.state;profile.activeBattle=null;profile.inventory.units=[...new Set([...profile.inventory.units,...ALL_RECRUITMENT_IDS])];assert.ok(p.replaceState(profile).ok);const deck=p.getBattleLoadout().deck;for(const id of [18,10973,10994])if(!deck.includes(id))deck[deck.findIndex(x=>![18,10973,10994].includes(x))]=id;assert.ok(p.setBattleDeck(deck).ok);const m=createExpeditionMatch('border-01',p.state.training,p.state.squad,1,p.getBattleLoadout());assert.ok(p.saveBattle(m).ok);assert.ok(confirmMulligan(m));m.board.tiles=[];const template=m.units.find(u=>u.owner===1&&getBattleCard(m,u.cardId,1)?.type==='unit');m.units=m.units.filter(u=>getBattleCard(m,u.cardId,u.owner)?.type==='general');for(const [id,x,y]of [[18,2,1],[10973,3,1]]){m.players[0].hand=[id];m.players[0].mana=9;assert.ok(playCard(m,0,x,y));}const c=getBattleCard(m,enemyId,1);m.units.push({...template,unitId:10001,cardId:enemyId,x:5,y:2,attack:c.attack,maxHealth:c.health,health:c.health,attackBuff:0,healthBuff:0});m.players[0].hand=[10994];m.players[0].deck=deck.filter((x,i)=>![deck.indexOf(18),deck.indexOf(10973),deck.indexOf(10994)].includes(i));m.players[0].mana=9;assert.ok(validateMatch(m));const saved=p.saveBattle(m);assert.ok(saved.ok,saved.error);return p.state;}
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],checks=[];let passed=false;
const file=name=>new URL(name+'.png',out).pathname.replace(/^\/([A-Z]:)/,'$1');
async function shot(page,name){await page.screenshot({path:file(name)});}
async function open(profile,width,height,motion){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:motion});const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(({profile,key})=>localStorage.setItem(key,JSON.stringify(profile)),{profile,key:SAVE_KEYS.expedition});
 await page.addInitScript(async()=>{const{BoardRenderer}=await import('/js/renderer.js'),draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__renderer=this;window.__opts=args[1];return draw.apply(this,args)}});
 await page.goto(base);return{page,context};
}
async function touch(page,from,to,{hold=0,cancel=false}={}){
 const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});if(hold)await page.waitForTimeout(hold);
 if(to)for(let i=1;i<=10;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/10,y:from.y+(to.y-from.y)*i/10}]});await page.waitForTimeout(30);}
 await c.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await c.detach();
}
async function unitPoint(page,id){return page.evaluate(id=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===id);r.focusCell(u.x,u.y);r.pan(-60,-60);r.draw(r.state,window.__opts);const p=r.getUnitAnchor(u);for(let dy=-35;dy<=25;dy+=5)for(let dx=-20;dx<=20;dx+=5){const q={x:p.x+dx,y:p.y+dy},hit=r.positionFromPointer({clientX:q.x,clientY:q.y},{preferUnits:true});if(document.elementFromPoint(q.x,q.y)===r.canvas&&hit?.x===u.x&&hit?.y===u.y)return q}return null},id)}
async function detailGeometry(page,label){
 const data=await page.locator('#unit-inspect').evaluate(el=>{const b=el.getBoundingClientRect(),boxes={};for(const key of ['name','cost','stats','description']){const n=el.querySelector('.game-card-'+key)||el.querySelector('#unit-inspect-'+key);if(n&&getComputedStyle(n).display!=='none')boxes[key]=n.getBoundingClientRect().toJSON()}return{bounds:b.toJSON(),boxes,text:el.innerText,backgrounds:[...el.querySelectorAll('*')].map(n=>getComputedStyle(n).backgroundImage).filter(v=>v!=='none')}});
 assert.ok(Object.keys(data.boxes).length>=3,label+' geometry includes real card anatomy');
 assert.ok(data.bounds.x>=0&&data.bounds.y>=0&&data.bounds.right<=page.viewportSize().width+1&&data.bounds.bottom<=page.viewportSize().height+1,label+' stays in viewport');
 const {name,description}=data.boxes;if(name&&description)assert.ok(name.bottom<=description.y+2,label+' name does not overlap rules');
 return data;
}
if(process.env.ORIGINAL_SUPPLEMENT_ONLY==='1'){
 try{for(const [width,height,motion]of [[568,320,'no-preference'],[844,390,'reduce']]){
  const session=await open(seed(213),width,height,motion),{page}=session,tag=`${width}-${motion}`;
  await page.locator('.menu-play').tap();await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__renderer?.ready&&!document.querySelector('#end-turn').disabled);
  const name=await page.locator('#hand button .game-card-name').first().evaluate(el=>({text:el.textContent,scroll:el.scrollWidth,client:el.clientWidth}));
  assert.equal(name.text,'枯萎之子泽瑞');assert.ok(name.scroll<=name.client+1,'long hand name fully fits');await shot(page,`long-hand-name-${tag}`);
  await page.locator('#hand button').first().tap();const geometry=await detailGeometry(page,'hand');
  const card=page.locator('#hand button').first(),from=await card.evaluate(el=>{const b=el.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height*.9}});
  const beforeCard=await page.evaluate(()=>JSON.stringify({hand:window.__renderer.state.players[0].hand,mana:window.__renderer.state.players[0].mana}));
  await touch(page,from,{x:width*.48,y:height*.35},{hold:500,cancel:true});assert.equal(await page.evaluate(()=>JSON.stringify({hand:window.__renderer.state.players[0].hand,mana:window.__renderer.state.players[0].mana})),beforeCard);await page.keyboard.press('Escape');
  const before=await page.evaluate(()=>structuredClone(window.__renderer.state));
  const button=await page.locator('#bbs-button').boundingBox();await touch(page,{x:button.x+button.width/2,y:button.y+button.height/2},null,{hold:500});
  await page.locator('#command-preview').waitFor({state:'visible'});
  assert.deepEqual(await page.evaluate(()=>window.__renderer.state.players),before.players,'skill reading never charges');
  const skill=await page.locator('#command-preview').evaluate(el=>({bounds:el.getBoundingClientRect().toJSON(),frame:getComputedStyle(el.querySelector('.game-card-frame')).backgroundImage,name:el.querySelector('.game-card-name').getBoundingClientRect().toJSON(),rules:el.querySelector('.game-card-description').getBoundingClientRect().toJSON(),text:el.innerText}));
  assert.ok(skill.name.bottom<=skill.rules.y+2);assert.ok(skill.bounds.bottom<=height&&skill.bounds.y>=0);await shot(page,`skill-original-${tag}`);
  const blank=await page.evaluate(()=>{const r=window.__renderer;for(let y=70;y<innerHeight-110;y+=10)for(let x=70;x<innerWidth-70;x+=10){if(document.elementFromPoint(x,y)!==r.canvas)continue;const p=r.positionFromPointer({clientX:x,clientY:y});if(p&&!r.state.units.some(u=>u.x===p.x&&u.y===p.y))return{x,y}}return null});assert.ok(blank);await page.touchscreen.tap(blank.x,blank.y);assert.equal(await page.locator('#command-preview').isVisible(),false);
  await page.locator('#bbs-button').tap();const selected=await page.evaluate(()=>structuredClone(window.__renderer.state)),targets=battleCommandTargets(selected,0);assert.ok(targets.available&&targets.unitIds.length);
  const targetId=targets.unitIds[0],expected=structuredClone(selected);assert.ok(useBattleCommand(expected,targetId,0));const target=await unitPoint(page,targetId);assert.ok(target);await page.touchscreen.tap(target.x,target.y);await page.waitForFunction(()=>!document.querySelector('#end-turn').disabled);
  const result=await page.evaluate(()=>({players:window.__renderer.state.players,units:window.__renderer.state.units}));assert.deepEqual(result,{players:expected.players,units:expected.units});
  await shot(page,`skill-used-${tag}`);checks.push({width,motion,name,geometry,skill,readFree:true,blankCloses:true,tapTargetsAndCasts:true,cardDragCancelUnchanged:true});await session.context.close();
 }assert.deepEqual(errors,[]);passed=true;
 }finally{await browser.close();writeFileSync(new URL('supplement-report.json',out),JSON.stringify({passed,checks,errors},null,2));}
 console.log(JSON.stringify({passed,samples:checks.length,errors}));process.exit(0);
}
try{for(const [width,height,motion]of [[568,320,'no-preference'],[844,390,'reduce']]){
 const profile=seed(213),tag=`${width}-${motion}`,session=await open(profile,width,height,motion),{page}=session;
 await page.locator('.menu-destination[data-page="codex"]').tap();
 await page.locator('.expedition-codex-card[data-card-id="18"]').tap();
 await page.locator('dialog.expedition-card-dialog[open]').waitFor();await shot(page,`collection-reference-${tag}`);
 const reference=await page.locator('dialog.expedition-card-dialog[open] .game-card').evaluate(el=>({backgrounds:[...el.querySelectorAll('*')].map(n=>getComputedStyle(n).backgroundImage).filter(v=>v!=='none')}));
 await page.locator('[data-action="close-card"]').tap();
 await page.locator('[data-action="codex-faction"][data-faction-id="0"]').tap();await page.locator('.expedition-codex-card[data-card-id="10994"]').tap();await page.locator('dialog.expedition-card-dialog[open]').waitFor();await shot(page,`collection-neutral-reference-${tag}`);
 const neutralReference=await page.locator('dialog.expedition-card-dialog[open] .game-card').evaluate(el=>({backgrounds:[...el.querySelectorAll('*')].map(n=>getComputedStyle(n).backgroundImage).filter(v=>v!=='none')}));
 if(process.env.ORIGINAL_REFERENCE_ONLY==='1'){checks.push({width,motion,reference,neutralReference});await session.context.close();continue;}
 await page.locator('[data-action="close-card"]').tap();await page.locator('.expedition-menu-return').tap();
 await page.locator('.menu-play').tap();await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__renderer?.ready&&!document.querySelector('#end-turn').disabled);
 await page.locator('#hand button').first().tap();const hand=await detailGeometry(page,'hand');await shot(page,`hand-detail-${tag}`);
 const before=await page.evaluate(()=>JSON.stringify({hand:window.__renderer.state.players[0].hand,mana:window.__renderer.state.players[0].mana}));
 const source=await page.locator('#hand button').first().evaluate(el=>{const b=el.getBoundingClientRect();for(const y of [.9,.5,.15])for(const x of [.15,.5,.85]){const p={x:b.x+b.width*x,y:b.y+b.height*y};if(document.elementFromPoint(p.x,p.y)?.closest('#hand button')===el)return p}return null});
 assert.ok(source,'detail leaves original source card reachable');await touch(page,source,{x:width*.48,y:height*.35},{hold:500,cancel:true});
 assert.equal(await page.evaluate(()=>JSON.stringify({hand:window.__renderer.state.players[0].hand,mana:window.__renderer.state.players[0].mana})),before);
 await page.keyboard.press('Escape');
 const ownId=profile.activeBattle.units.find(u=>u.owner===0&&u.cardId===18).unitId;
 await touch(page,await unitPoint(page,ownId),null,{hold:500});const friendly=await detailGeometry(page,'friendly');await shot(page,`friendly-detail-${tag}`);await page.keyboard.press('Escape');
 const enemyPoint=await unitPoint(page,10001);await page.touchscreen.tap(enemyPoint.x,enemyPoint.y);const enemy=await detailGeometry(page,'enemy');await shot(page,`enemy-detail-${tag}`);await page.keyboard.press('Escape');
 const heroId=profile.activeBattle.units.find(u=>u.owner===0&&u.cardId===1).unitId;
 await touch(page,await unitPoint(page,heroId),null,{hold:500});const hero=await detailGeometry(page,'hero');await shot(page,`hero-detail-${tag}`);await page.keyboard.press('Escape');
 // Exercise a genuine long rule state, keeping mutations inside this disposable context.
 await page.evaluate(async()=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===10001),{getUnitSpecializations}=await import('/js/campaign-rules.js');u.silenced=true;u.specialization=getUnitSpecializations(u.cardId)[0]?.id;r.state.selectedUnitId=null;});
 const ep=await unitPoint(page,10001);await page.touchscreen.tap(ep.x,ep.y);
 const desc=page.locator('#unit-inspect-description'),scroll=await desc.evaluate(el=>({client:el.clientHeight,full:el.scrollHeight}));
 assert.ok(scroll.full>scroll.client,'long rules require scroll');const box=await desc.boundingBox();await touch(page,{x:box.x+box.width/2,y:box.y+box.height-8},{x:box.x+box.width/2,y:box.y+8});
 assert.ok(await desc.evaluate(el=>el.scrollTop>0),'real finger scroll reveals long rules');await shot(page,`long-rules-scrolled-${tag}`);
 checks.push({width,motion,reference,hand,friendly,enemy,hero,scroll,sourceDragCancelledWithoutSpend:true});await session.context.close();

 const p=new ExpeditionProgress(new Memory()),s=p.state,m=createExpeditionMatch('border-01',s.training,s.squad,s.selectedHeroId,p.getBattleLoadout());assert.ok(p.saveBattle(m).ok);
 const opening=await open(p.state,width,height,motion);await opening.page.locator('.menu-play').tap();await opening.page.locator('#objective-close').tap();await opening.page.locator('.opening-confirm').waitFor();await shot(opening.page,`opening-${tag}`);await opening.page.locator('.opening-confirm').tap();await opening.page.locator('.battle-draw-face').waitFor({state:'visible'});await opening.page.waitForTimeout(motion==='reduce'?35:250);await shot(opening.page,`draw-${tag}`);await opening.page.waitForFunction(()=>!document.querySelector('.card-draw-flight')&&!document.querySelector('#end-turn').disabled);await shot(opening.page,`draw-landed-${tag}`);await opening.context.close();
 }assert.deepEqual(errors,[]);passed=true;
}finally{await browser.close();writeFileSync(new URL(process.env.ORIGINAL_REFERENCE_ONLY==='1'?'reference-report.json':'report.json',out),JSON.stringify({passed,checks,errors},null,2));}
console.log(JSON.stringify({passed,viewports:checks.length,errors}));
