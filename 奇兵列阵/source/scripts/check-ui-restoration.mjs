// Historical UI suite: its tooltip target-start/default sections describe the superseded interaction.
// Current designation acceptance is scripts/check-target-drag.mjs; do not use this whole legacy suite as current acceptance.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=new URL('../../output/content-expansion/ui-restoration/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const report=[];
try{for(const[width,height]of[[568,320],[844,390],[1280,720]]){
if(process.env.UI_WIDTH&&Number(process.env.UI_WIDTH)!==width)continue;
const mobile=width<1000;
const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,reducedMotion:width===844?'reduce':'no-preference'});
await context.addInitScript(()=>localStorage.setItem('zl_coach','drag,preview,hint'));
const page=await context.newPage();page.setDefaultTimeout(6500);const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.UI_URL||'http://127.0.0.1:8770/?debug');await page.getByRole('button',{name:'开始远征',exact:true}).click();await page.locator('.gen-card').first().click();await page.waitForTimeout(2500);
const cdp=await context.newCDPSession(page);
const stage=async(x,y)=>page.evaluate(({x,y})=>{const b=document.querySelector('#stage').getBoundingClientRect();return{x:b.left+x*b.width/1280,y:b.top+y*b.width/1280};},{x,y});
const center=async locator=>{const b=await locator.boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
const activate=async locator=>mobile?locator.tap():locator.click();
const at=async(x,y)=>{const p=await stage(x,y);if(mobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);};
const slot=async i=>at(540-i*110,300);
const snap=async()=>page.evaluate(()=>JSON.stringify(window.__app.game.inventory));
const fixture=async(opts={})=>{await page.evaluate(opts=>{
const g=window.__app.game;g.pb?.cancel();g.pb=null;g.closeOverlay();g.sandbox=null;g.mode='prep';g.sel=null;g.targeting=null;g.focus=null;
const ids=opts.rarity?['l_shield','l_priest','n_marshal','l_archon','a_seed']:['n_marshal','s_choreo','a_ritualist','l_archon','a_seed'];
Object.assign(g.run,{activeFactions:['light','shadow','abyss','desert'],slots:ids.map((defId,i)=>({defId,ownedId:i+1,copies:1})),bench:[{defId:'l_shield',ownedId:6,copies:2},null],nextOwnedId:7,draft:['l_shield','m_rex','n_merc'],picks:2,rerolls:1,stage:0,lives:3,history:[],wins:0,over:null,rewardedRetryCount:0,rewardedRerollCount:0});
if(opts.merge){g.run.slots[4]={defId:'l_shield',ownedId:5,copies:2};}
if(opts.different){g.run.slots[4]={defId:'l_shield',ownedId:5,copies:2};g.run.bench[0].copies=1;}
if(opts.target)g.run.slots[0].targetIds=[5];
g.resetBattleUi();g.renderAll();},opts);await at(640,420);await page.waitForTimeout(50);};
const shot=async name=>{await page.waitForTimeout(180);assert.equal(await page.locator('#stage').evaluate(el=>el.scrollTop),0);await page.screenshot({path:new URL(`${width}-${name}.png`,out).pathname.replace(/^\/(\w:)/,'$1')});};
const touchDrag=async(a,b,hold=false)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/10,y:a.y+(b.y-a.y)*i/10,id:1}]});await page.waitForTimeout(16)}if(!hold){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(50)}};
const drag=async(a,b,hold=false)=>{if(mobile)return touchDrag(a,b,hold);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});if(!hold)await page.mouse.up();};
const release=async()=>mobile?cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}):page.mouse.up();
await fixture();
const benchNumbers=await page.locator('.bench-slot[data-index="5"] .st i').allTextContents();assert.deepEqual(benchNumbers,['3','7']);assert.equal(await page.locator('.bench-slot[data-index="6"] .st').count(),0);
const benchLayout=await page.locator('.bench-slot[data-index="5"]').evaluate(el=>{const s=el.querySelector('.bench-stats').getBoundingClientRect(),l=el.querySelector('.bench-label').getBoundingClientRect();return{statsBottom:s.bottom,starsTop:l.top,bottom:el.getBoundingClientRect().bottom};});assert.ok(benchLayout.statsBottom<=benchLayout.starsTop);assert.ok(benchLayout.bottom<=height);
assert.equal(await page.locator('.pool-summary,.focus-reroll,.unit-actions,.copy-progress').count(),0);await shot('prep');
await page.evaluate(()=>{const g=window.__app.game;g.run.slots=[{defId:'v_wall',ownedId:1,copies:1},null,null,null,null];g.renderAll()});
await drag(await center(page.locator('.bench-slot[data-index="5"]')),await stage(320,300));
assert.deepEqual(await page.locator('.unit.side-0[data-slot="2"] .st i').allTextContents(),['3','7']);
await drag(await stage(320,300),await center(page.locator('.bench-slot[data-index="5"]')));assert.deepEqual(await page.locator('.bench-slot[data-index="5"] .st i').allTextContents(),['3','7']);await shot('bench-stats');await fixture();
// Ordinary selection changes only the inspected entity, never swaps two occupied positions.
let before=await snap();await slot(4);await slot(2);assert.equal(await snap(),before);assert.equal(await page.locator('.tip.on .tip-name').innerText(),'唤亡祭师');assert.equal(await page.getByRole('button',{name:'交换位置',exact:true}).count(),0);
// The original below-pedestal tooltip contains the sole target controls. Follow its actual mouse path.
await fixture();await slot(0);let target=page.locator('.tip.on .target-start');await target.waitFor();
if(!mobile){const p=await center(target);await page.mouse.move(p.x,p.y,{steps:14});assert.equal(await target.isVisible(),true);await target.click();}
else await target.tap();
await slot(4);assert.deepEqual(await page.evaluate(()=>window.__app.game.run.slots[0].targetIds),[5]);await shot('epic-target');
await activate(page.locator('.tip.on .target-default'));assert.equal(await page.evaluate(()=>window.__app.game.run.slots[0].targetIds),undefined);
// Double choice remains atomic; a blank tap cancels and Escape also leaves the prior configuration.
await fixture();await slot(1);await activate(page.locator('.tip.on .target-start'));await slot(0);assert.equal(await page.evaluate(()=>window.__app.game.run.slots[1].targetIds),undefined);await at(640,420);assert.equal(await page.evaluate(()=>window.__app.game.targeting),null);
await slot(1);await slot(1);await activate(page.locator('.tip.on .target-start'));await slot(0);await slot(1);assert.deepEqual(await page.evaluate(()=>window.__app.game.run.slots[1].targetIds),[1,2]);
await activate(page.locator('.tip.on .target-start'));await slot(0);await page.keyboard.press('Escape');assert.deepEqual(await page.evaluate(()=>window.__app.game.run.slots[1].targetIds),[1,2]);
// Ritualist rejects a non-deathrattle entity and archon may designate itself.
await fixture();await slot(2);await activate(page.locator('.tip.on .target-start'));await slot(0);assert.equal(await page.evaluate(()=>window.__app.game.run.slots[2].targetIds),undefined);await slot(4);assert.deepEqual(await page.evaluate(()=>window.__app.game.run.slots[2].targetIds),[5]);
await fixture();await slot(3);await activate(page.locator('.tip.on .target-start'));await slot(3);assert.deepEqual(await page.evaluate(()=>window.__app.game.run.slots[3].targetIds),[4]);await shot('legendary-target');
// All four qualities have independent rarity and gold star text, in the shared tooltip component.
await fixture({rarity:true});const rarity=[];for(let i=0;i<4;i++){await slot(i);const data=await page.locator('.tip.on').evaluate(el=>({name:el.querySelector('.tip-name').textContent,rarity:el.querySelector('.tip-rarity').textContent,color:getComputedStyle(el.querySelector('.tip-rarity')).color,starColor:getComputedStyle(el.querySelector('.tip-stars')).color}));rarity.push(data);if(i===2||i===3)await shot(i===2?'rarity-epic':'rarity-legendary');}
assert.deepEqual(rarity.map(x=>x.color),['rgb(208, 216, 223)','rgb(143, 230, 255)','rgb(221, 176, 255)','rgb(255, 207, 113)']);assert.ok(rarity.every(x=>x.starColor==='rgb(255, 211, 107)'));
if(process.env.UI_TIP_STATS_ONLY){assert.deepEqual(errors,[]);report.push({width,height,mobile,rarity,benchNumbers,benchLayout,actions:['bench shared stat gems and actual battlefield round trip','mouse/touch original tooltip controls','single/double cancel/default/invalid/self targets','four rarity colors with gold stars'],errors});await context.close();continue;}
// Pool entry is an ordinary top-right icon; refresh has exactly one visible entry for random/focus.
await at(640,420);await activate(page.getByRole('button',{name:'本局卡池',exact:true}));assert.equal(await page.locator('.pool-tabs button').count(),5);await shot('pool');await activate(page.locator('.modal-x'));await page.locator('.modal-ov').waitFor({state:'detached'});
await activate(page.locator('.tray-left .reroll'));await activate(page.locator('.refresh-dialog').getByRole('button',{name:'圣光',exact:true}));await page.locator('.modal-ov').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.__app.game.run.rerolls),0);assert.equal(await page.evaluate(()=>window.__app.game.run.draft.every(id=>id.startsWith('l_'))),true);
await fixture();await activate(page.locator('.tray-left .reroll'));await activate(page.locator('.refresh-dialog').getByRole('button',{name:'随机',exact:true}));await page.locator('.modal-ov').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.__app.game.run.rerolls),0);
// Labels and direct two-star merge restore the original short feedback, with no new modal.
await fixture({merge:true});before=await snap();await drag(await center(page.locator('.bench-slot[data-index="5"]')),await stage(100,300),true);assert.equal(await page.locator('.slot.side-0[data-slot="4"]').getAttribute('data-drop'),'merge');assert.match(await page.locator('.slot.side-0[data-slot="4"]').evaluate(el=>getComputedStyle(el,'::after').content),/升级/);await shot('upgrade-label');await release();assert.equal(await page.evaluate(()=>window.__app.game.run.slots[4].copies),4);assert.equal(await page.evaluate(()=>window.__app.game.run.bench[0]),null);assert.equal(await page.locator('.modal-ov').count(),0);
await fixture({different:true});await drag(await center(page.locator('.bench-slot[data-index="5"]')),await stage(100,300));assert.deepEqual(await page.evaluate(()=>[window.__app.game.run.slots[4].copies,window.__app.game.run.bench[0].copies]),[1,2]);assert.equal(await page.locator('.modal-ov').count(),0);
// A recruit is one-star: it cannot be fed into two-star, and may be placed separately in empty bench.
await fixture({merge:true});before=await snap();await activate(page.locator('.card').first());assert.equal(await page.locator('.card').first().locator('.card-badge:not(.maxed)').count(),0);await slot(4);assert.equal(await snap(),before);await activate(page.locator('.bench-slot[data-index="6"]'));assert.equal(await page.evaluate(()=>window.__app.game.run.bench[1].copies),1);assert.equal(await page.evaluate(()=>window.__app.game.run.picks),1);
await fixture();await activate(page.locator('.card').first());assert.match(await page.locator('.slot.side-0[data-slot="0"]').evaluate(el=>getComputedStyle(el,'::after').content),/替换/);assert.equal(await page.locator('.slot.side-0[data-slot="0"] .slot-num').evaluate(el=>getComputedStyle(el).visibility),'hidden');await shot('replace-label');await slot(0);assert.equal(await page.evaluate(()=>window.__app.game.run.bench[1].ownedId),1);
assert.equal(await page.locator('.drag-ghost').count(),0);assert.deepEqual(errors,[]);report.push({width,height,mobile,reducedMotion:width===844,rarity,benchNumbers,benchLayout,actions:['ordinary occupied tap inspects without swapping','mouse/touch original tooltip target controls','single/double cancel/default/invalid/self targets','four rarity colors separate from gold stars','top-right pool and single random/focused refresh','short replace/upgrade labels','2+2 direct merge and different-star swap','one-star recruit rejected by two-star then stored separately'],errors});await context.close();
}writeFileSync(new URL(process.env.UI_TIP_STATS_ONLY ? 'report-tip-stats.json' : process.env.UI_WIDTH?`report-${process.env.UI_WIDTH}.json`:'report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}finally{await browser.close()}

