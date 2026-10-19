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
const out=new URL('../output/campaign-integration/',import.meta.url);mkdirSync(out,{recursive:true});
class Memory{data=new Map();getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,String(v))}removeItem(k){this.data.delete(k)}}
function seed(hero,spells){
 const p=new ExpeditionProgress(new Memory());assert.ok(p.selectHero(hero).ok);const state=p.state;
 state.inventory.units=[...new Set([...state.inventory.units,10020])];state.inventory.spells=[...new Set([...state.inventory.spells,...spells])];assert.ok(p.replaceState(state).ok);
 const load=p.getBattleLoadout(),extra=[10020,...spells];for(const id of extra){const i=load.deck.findIndex(x=>!extra.includes(x));load.deck[i]=id}assert.ok(p.setBattleDeck(load.deck).ok);
 const m=createExpeditionMatch('border-01',p.state.training,p.state.squad,hero,p.getBattleLoadout());assert.ok(p.saveBattle(m).ok);assert.ok(confirmMulligan(m));
 function hand(ids){const deck=[...m.loadout.deck];for(const id of ids){const i=deck.indexOf(id);assert.ok(i>=0);deck.splice(i,1)}m.players[0].hand=[...ids];m.players[0].deck=deck;m.players[0].mana=9}
 if(hero===101){const own=load.deck.find(id=>CARDS[id].type==='unit'&&id!==10020);hand([own]);assert.ok(playCard(m,0,2,1));const e=m.units.find(u=>u.owner===1&&u.cardId===14);e.x=2;e.y=0;e.attackBuff=7;hand([20129,10020]);}
 else hand(spells);
 assert.ok(validateMatch(m));assert.ok(p.saveBattle(m).ok);return p.state;
}
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const errors=[],checks=[];
async function open(profile,width=844,height=390){const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(({profile,key})=>{if(!sessionStorage.getItem('content-seed')){localStorage.setItem(key,JSON.stringify(profile));sessionStorage.setItem('content-seed','1')}},{profile,key:SAVE_KEYS.expedition});await page.addInitScript(async()=>{const{BoardRenderer}=await import('/js/renderer.js');const draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__renderer=this;return draw.apply(this,args)}});await page.goto(base);await resume(page);return {context,page}}
async function resume(page){await page.locator('.menu-play').tap();await page.locator('#objective-close').waitFor({state:'visible'});await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__renderer?.ready&&!document.querySelector('#match').hidden)}
const state=page=>page.evaluate(()=>structuredClone(window.__renderer.state));
async function cell(page,x,y){const p=await page.evaluate(({x,y})=>{const r=window.__renderer,rect=r.canvas.getBoundingClientRect(),c=r.cellGeometry(r.boardMetrics(rect.width,rect.height),x,y).center;for(const dy of [0,-8,8,-16,16]){const point={clientX:rect.x+c.x,clientY:rect.y+c.y+dy},hit=r.positionFromPointer(point);if(hit?.x===x&&hit?.y===y&&document.elementFromPoint(point.clientX,point.clientY)===r.canvas)return {x:point.clientX,y:point.clientY}}return null},{x,y});assert.ok(p,`cell ${x},${y} visible`);await page.touchscreen.tap(p.x,p.y)}
async function card(page,index){const el=page.locator('#hand button').nth(index);const p=await el.evaluate(el=>{const b=el.getBoundingClientRect();for(const rx of [.5,.1,.9,.03])for(const ry of [.5,.15,.85]){const x=b.x+b.width*rx,y=b.y+b.height*ry;if(document.elementFromPoint(x,y)?.closest('#hand button')===el)return{x,y}}return null});assert.ok(p);await page.touchscreen.tap(p.x,p.y)}
async function shot(page,name){await page.screenshot({path:new URL(name,out).pathname.replace(/^\/([A-Z]:)/,'$1')})}
try{
 const {context,page}=await open(seed(101,[20129]));const original=await state(page),ally=original.units.find(u=>u.owner===0&&CARDS[u.cardId].type==='unit'),enemy=original.units.find(u=>u.owner===1&&u.cardId===14);
 await card(page,0);await cell(page,2,1);assert.equal((await state(page)).players[0].mana,9);await page.keyboard.press('Escape');assert.deepEqual((await state(page)).players[0].hand,original.players[0].hand);checks.push('swap primary target then Escape cancels without charge');
 await card(page,0);await cell(page,2,1);await shot(page,'swap-second-target.png');await cell(page,2,0);await page.waitForFunction(id=>window.__renderer.state.units.find(u=>u.unitId===id).y===0,ally.unitId);let after=await state(page);assert.equal(after.units.find(u=>u.unitId===enemy.unitId).y,1);assert.equal(after.players[0].hand.includes(20129),false);checks.push('swap two real unit taps commit exactly once');
 await card(page,0);await cell(page,2,2);assert.equal((await state(page)).units.some(u=>u.cardId===10020),false);await shot(page,'dispel-second-target.png');await cell(page,2,1);await page.waitForFunction(id=>window.__renderer.state.units.find(u=>u.unitId===id).silenced,enemy.unitId);after=await state(page);assert.equal(after.units.find(u=>u.unitId===enemy.unitId).attackBuff,0);assert.equal(after.units.some(u=>u.cardId===10020&&u.x===2&&u.y===2),true);assert.equal(after.players[0].hand.length,0);checks.push('opening dispel waits for second tap, deploys and clears target buff');
 await page.reload();await resume(page);assert.equal((await state(page)).units.find(u=>u.unitId===enemy.unitId).silenced,true);await cell(page,2,1);assert.match(await page.locator('#unit-inspect-description').innerText(),/已驱散/);checks.push('reload preserves committed swap and dispel; inspected target displays silenced status');await context.close();
 const tele=await open(seed(301,[20049]),568,320);const before=await state(tele.page),victim=before.units.find(u=>u.owner===1&&u.cardId===14);await card(tele.page,0);await cell(tele.page,victim.x,victim.y);assert.equal((await state(tele.page)).players[0].mana,9);await shot(tele.page,'teleport-second-target-568.png');await cell(tele.page,3,2);await tele.page.waitForFunction(id=>window.__renderer.state.units.find(u=>u.unitId===id)?.x===3,victim.unitId);const teleAfter=await state(tele.page);assert.equal(teleAfter.units.find(u=>u.unitId===victim.unitId).health,victim.health-1);assert.equal(teleAfter.players[0].hand.length,0);checks.push('568px damage-and-teleport: unit then destination, damage and charge once');await tele.context.close();
 assert.deepEqual(errors,[]);writeFileSync(new URL('targeting-ui-report.json',out),JSON.stringify({passed:true,checks,errors,limits:'Isolated authored fixture battles, actual touch input. Does not establish campaign balance or human win rates.'},null,2)+'\n');console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close()}
