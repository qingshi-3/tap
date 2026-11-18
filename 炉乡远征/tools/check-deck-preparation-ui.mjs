import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {SAVE_KEYS,LOCAL_DECKS_KEY} from '../dist/js/storage-keys.js';
import {CARDS} from '../dist/js/cards.js';
import {getFaction} from '../dist/js/factions.js';
import {NEUTRAL_IDS,getSpellUpgrade} from '../dist/js/campaign-rules.js';
import {recommendDeck} from '../dist/js/deck-recommendation.js';

const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=fileURLToPath(new URL('../output/progress-improvements/decks/',import.meta.url));
const base=process.env.DECK_UI_BASE || 'http://127.0.0.1:4200';
const report={checks:[],errors:[],screens:[]};
const seed=new ExpeditionProgress({getItem(){return null;},setItem(){}}).state;
const original=seed.factionDecks[1].slice(0,27);
const other=seed.factionDecks[2].slice(0,26);
const key=id=>`${LOCAL_DECKS_KEY}.${id}`;
const record=(id,deck)=>JSON.stringify({schemaVersion:1,factionId:id,deck});
const same=(a,b)=>assert.deepEqual([...a].sort((x,y)=>x-y),[...b].sort((x,y)=>x-y));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
async function shot(p,name){await p.waitForTimeout(350);await p.screenshot({path:`${out}/${name}.png`});report.screens.push(`${name}.png`);}
async function touch(p,selector){const loc=typeof selector==='string'?p.locator(selector):selector;await loc.tap();await p.waitForTimeout(80);}
async function stored(p,id){return p.evaluate(k=>JSON.parse(localStorage.getItem(k))?.deck,key(id));}
async function prepare(p){await touch(p,'.menu-play');await p.locator('.atlas-start').waitFor();await touch(p,'.atlas-level[data-level-id="border-01"]');await touch(p,'.atlas-start');await p.locator('[data-action="deck-recommend"]').waitFor();}
async function menu(p){await touch(p,'[data-action="return-mission"]');await touch(p,'[data-action="nav"][data-page="menu"]');await p.locator('.menu-play').waitFor();}
async function ids(p){return p.locator('.barracks-inventory .training-roster [data-action="card-detail"]').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.cardId)));}
async function assertInventory(p,{spells=false,unowned=false,cost=null}={}){
 const faction=getFaction(1),pool=spells?faction.spellIds:[...faction.unitIds,...NEUTRAL_IDS];
 const inventory=seed.inventory[spells?'spells':'units'];
 const expected=pool.filter(id=>(unowned||inventory.includes(id))&&(cost===null||(cost===8?value(id)>=8:value(id)===cost)));
 function value(id){return spells?getSpellUpgrade(id,seed.spellTraining?.[id]||0,seed.spellModes?.[id]||'base').cost:CARDS[id].cost;}
 same(await ids(p),expected);
 if(!expected.length)assert.match(await p.locator('.training-roster').innerText(),/没有符合筛选/);
}
async function geometry(p,selector){
 const metrics=await p.locator(selector).evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return{text:n.textContent,width:r.width,height:r.height,left:r.left,top:r.top,right:r.right,bottom:r.bottom,clear:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===n};}));
 const viewport=p.viewportSize();
 for(const m of metrics)assert(m.width>=43.9&&m.height>=43.9&&m.left>=0&&m.top>=0&&m.right<=viewport.width+.5&&m.bottom<=viewport.height+.5&&m.clear,JSON.stringify(m));
 return metrics;
}
async function swipeCosts(p,context){
 const rail=await p.locator('.deck-cost-filters').boundingBox(),cdp=await context.newCDPSession(p);
 for(let j=0;j<5;j++){
  const x=rail.x+rail.width-15,y=rail.y+rail.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-(rail.width-30)*i/6,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 await p.waitForTimeout(150);
}
try{
 for(const [width,height,motion] of [[568,320,'reduce'],[844,390,'no-preference']]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:motion});
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(String(e)));
  await p.addInitScript(({seed,profile,k1,k2,r1,r2})=>{if(!sessionStorage.getItem('deck-fixture')){localStorage.setItem(profile,JSON.stringify(seed));localStorage.setItem(k1,r1);localStorage.setItem(k2,r2);sessionStorage.setItem('deck-fixture','1');}},{seed,profile:SAVE_KEYS.expedition,k1:key(1),k2:key(2),r1:record(1,original),r2:record(2,other)});
  await p.goto(base);await p.locator('.menu-play').waitFor();
  await geometry(p,'.menu-play,.menu-destination');await shot(p,`menu-${width}`);
  await touch(p,'.menu-trials');await p.locator('.expedition-trials').waitFor();await touch(p,'[data-action="nav"][data-page="menu"]');
  await touch(p,'.menu-destinations [data-page="codex"]');await p.locator('.expedition-codex').waitFor();await touch(p,'[data-action="nav"][data-page="menu"]');
  await touch(p,'[data-action="recruitment"]');await p.locator('.recruitment-dialog[open]').waitFor();await touch(p,'[data-recruitment-action="close"]');
  for(const action of ['leaderboard','achievements']){await touch(p,`[data-action="${action}"]`);await p.locator('#platform-progress-dialog[open]').waitFor();await touch(p,p.locator('#platform-progress-dialog').getByRole('button',{name:'关闭',exact:true}));}
  await prepare(p);await assertInventory(p);await shot(p,`owned-${width}`);
  await geometry(p,'[data-action="return-mission"],[data-action="deck-recommend"],[data-action="deck-default"],.inventory-tabs button,.prep-start');
  await touch(p,'[data-action="deck-show-unowned"]');await assertInventory(p,{unowned:true});
  const unowned=(await ids(p)).find(id=>!seed.inventory.units.includes(id));assert(unowned,'fixture has unowned units');
  const locked=p.locator('.training-card').filter({has:p.locator(`[data-action="card-detail"][data-card-id="${unowned}"]`)});
  assert(await locked.locator('[data-action="deck-add"]').isDisabled());
  const before=await stored(p,1);await locked.scrollIntoViewIfNeeded();const plus=await locked.locator('[data-action="deck-add"]').boundingBox();
  await p.touchscreen.tap(plus.x+plus.width/2,plus.y+plus.height/2);same(await stored(p,1),before);
  await shot(p,`unowned-${width}`);await touch(p,'[data-action="deck-show-unowned"]');await assertInventory(p);
  await touch(p,'[data-action="deck-cost"][data-cost="2"]');await assertInventory(p,{cost:2});
  await touch(p,'[data-action="deck-cost"][data-cost="3"]');await assertInventory(p,{cost:3});
  assert.equal(await p.locator('[data-action="deck-cost"][data-cost="2"]').getAttribute('aria-pressed'),'false');
  await touch(p,'[data-action="deck-cost"][data-cost="3"]');await assertInventory(p);
  await touch(p,'[data-action="deck-cost"][data-cost="0"]');await assertInventory(p,{cost:0});await shot(p,`empty-${width}`);
  await touch(p,'[data-action="inventory-tab"][data-tab="spells"]');await assertInventory(p,{spells:true,cost:0});
  await touch(p,'[data-action="deck-cost"][data-cost="0"]');await assertInventory(p,{spells:true});
  await touch(p,'[data-action="deck-cost"][data-cost="2"]');await assertInventory(p,{spells:true,cost:2});
  await touch(p,'[data-action="deck-show-unowned"]');await assertInventory(p,{spells:true,cost:2,unowned:true});
  await touch(p,'[data-action="deck-show-unowned"]');await touch(p,'[data-action="deck-cost"][data-cost="2"]');
  await swipeCosts(p,context);await geometry(p,'[data-action="deck-cost"][data-cost="8"]');await touch(p,'[data-action="deck-cost"][data-cost="8"]');await assertInventory(p,{spells:true,cost:8});await shot(p,`last-cost-${width}`);
  const last=p.locator('[data-action="deck-cost"][data-cost="8"]');await last.focus();await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');await p.keyboard.press('Enter');await assertInventory(p,{spells:true});
  assert.equal(await p.evaluate(()=>document.activeElement.dataset.cost),'8');await shot(p,`focus-${width}`);
  await touch(p,'[data-action="deck-recommend"]');const recommended=recommendDeck({...seed,heroId:1}).deck;same(await stored(p,1),recommended);same(await stored(p,2),other);
  await geometry(p,'.deck-prep-actions button');await shot(p,`recommended-${width}`);
  await touch(p,'[data-action="deck-undo-recommend"]');same(await stored(p,1),original);
  await touch(p,'[data-action="deck-recommend"]');await p.reload();await p.locator('.menu-play').waitFor();await prepare(p);same(await stored(p,1),recommended);assert.match(await p.locator('.deck-total').innerText(),/30\/30/);
  await menu(p);await touch(p,'[data-action="select-faction"][data-faction-id="2"]');await prepare(p);await touch(p,'[data-action="deck-recommend"]');same(await stored(p,1),recommended);assert.equal((await stored(p,2)).length,30);
  await menu(p);await touch(p,'[data-action="select-faction"][data-faction-id="1"]');await prepare(p);
  // Undo now snapshots a deliberately changed draft, using actual minus input.
  await touch(p,'.deck-card-list [data-action="deck-remove"]:enabled >> nth=0');
  const secondBefore=await stored(p,2),diskBefore=await stored(p,1);
  await p.evaluate(prefix=>{const original=Storage.prototype.setItem;window.__restoreDeckStorage=()=>{Storage.prototype.setItem=original;};Storage.prototype.setItem=function(k,v){if(k.startsWith(prefix))throw new DOMException('Test quota full','QuotaExceededError');return original.call(this,k,v);};},LOCAL_DECKS_KEY);
  await touch(p,'[data-action="deck-recommend"]');same(await stored(p,1),diskBefore);assert.match(await p.locator('.deck-status').innerText(),/保存.*失败/);assert.match(await p.locator('.deck-total').innerText(),/30\/30/);await shot(p,`save-failure-${width}`);
  await p.evaluate(()=>window.__restoreDeckStorage());await touch(p,'[data-action="deck-recommend"]');same(await stored(p,1),recommended);same(await stored(p,2),secondBefore);assert.equal(await p.locator('.deck-status').count(),0);
  await touch(p,'[data-action="deck-undo-recommend"]');assert.equal((await stored(p,1)).length,29);await shot(p,`retry-undo-${width}`);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow');
  report.checks.push(`${width}x${height} ${motion}: menu/map/prep, owned/unowned guards, exclusive cost intersection/empty/8+ touch swipe, keyboard retained focus, recommendation persistence and undo, faction isolation, storage failure/retry, visible target geometry`);
  await context.close();
 }
}catch(error){report.errors.push(error.stack);for(const context of browser.contexts())for(const p of context.pages()){await shot(p,'failure');report.failureText=await p.locator('body').innerText();}}
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));if(report.errors.length)process.exitCode=1;
