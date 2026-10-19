// Historical UI suite: its tooltip target-start/default sections describe the superseded interaction.
// Current designation acceptance is scripts/check-target-drag.mjs; do not use this whole legacy suite as current acceptance.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = new URL('../../output/content-expansion/ui/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
const url = process.env.UI_URL || 'http://127.0.0.1:8770/?debug';
try {
for (const [width, height] of [[568,320],[667,375],[844,390],[1280,720]]) {
  if (process.env.UI_WIDTH && Number(process.env.UI_WIDTH) !== width) continue;
  const context = await browser.newContext({ viewport:{width,height}, isMobile:width<1000, hasTouch:true, reducedMotion:width===667?'reduce':'no-preference' });
  await context.addInitScript(() => localStorage.setItem('zl_coach','drag,preview,hint'));
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.setDefaultTimeout(6000);
  await page.goto(url);
  await page.getByRole('button',{name:'开始远征',exact:true}).tap();
  await page.locator('.gen-card').first().tap();
  await page.waitForTimeout(2500);
  const tapSlot = async index => { const q=await page.evaluate(i=>{ const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.left+(540-i*110)*r.width/1280,y:r.top+300*r.width/1280};},index);await page.touchscreen.tap(q.x,q.y); };
  const draft = async i => page.locator('.card').nth(i).tap();
  const owned = async () => page.evaluate(()=>{const g=window.__app.game; return JSON.parse(JSON.stringify({slots:g.inventory.slots,bench:g.inventory.bench,picks:g.run.picks,rng:g.run.rngState}));});
  const fixture = async (options={}) => page.evaluate(options=>{
    const g=window.__app.game;g.closeOverlay();g.sandbox=null;g.mode='prep';g.sel=null;g.focus=null;g.targeting=null;g.swapOnly=false;
    const ids=['n_marshal','s_choreo','a_ritualist','l_archon','a_seed'];
    g.run.slots=ids.map((defId,i)=>({defId,ownedId:i+1,copies:i===4?2:1}));
    g.run.bench=[{defId:'s_wind',ownedId:6,copies:1},{defId:'l_shield',ownedId:7,copies:4}];
    Object.assign(g.run,{nextOwnedId:8,picks:2,rerolls:1,over:null,lives:3,stage:0,history:[],wins:0,rewardedRetryCount:0});
    if(options.emptyBench)g.run.bench[0]=null;
    if(options.target)g.run.slots[0].targetIds=[5];
    if(options.merge){g.run.bench[0]={defId:'a_seed',ownedId:6,copies:2};}
    if(options.overflow){g.run.bench[0]={defId:'a_seed',ownedId:6,copies:1};}
    g.run.draft=['n_colossus','m_rex','l_shield'];g.resetBattleUi();g.renderAll();
  },options);
  const screenshot = async name => {assert.equal(await page.locator('#stage').evaluate(el=>el.scrollTop),0);assert.equal(await page.locator('#viewport').evaluate(el=>el.scrollTop),0);console.log(width,name,await page.evaluate(()=>({scrollY,stageTop:document.querySelector('#stage').getBoundingClientRect().top,scrolls:[...document.querySelectorAll('*')].filter(el=>el.scrollTop>0).map(el=>({c:el.className,top:el.scrollTop}))})));await page.waitForTimeout(180);await page.screenshot({path:new URL(`${width}-${name}.png`,out).pathname.replace(/^\/(\w:)/,'$1')});};
  // Actual untouched recruitment: card -> battlefield, card -> bench, point return and drag return.
  await draft(0); await tapSlot(4); assert.equal((await owned()).picks,1);
  await draft(0); await page.locator('.bench-slot[data-index="5"]').tap();
  assert.ok((await owned()).bench[0]);
  await page.locator('.bench-slot[data-index="5"]').tap(); await tapSlot(3); assert.equal((await owned()).bench[0],null);
  await tapSlot(3); await page.locator('.bench-slot[data-index="5"]').tap(); assert.equal((await owned()).slots[3],null);
  const drag = async (from,to) => {await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});await page.mouse.up();};
  const point = async selector => {const b=await page.locator(selector).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
  const slotPoint = async i => page.evaluate(i=>{const r=document.querySelector('#stage').getBoundingClientRect();return{x:r.left+(540-i*110)*r.width/1280,y:r.top+300*r.width/1280};},i);
  await drag(await point('.bench-slot[data-index="5"]'),await slotPoint(2)); assert.equal((await owned()).bench[0],null);assert.ok((await owned()).slots[2]);
  // Strict same-star 2+2 keeps the target identity; unlike stars exchange directly.
  await fixture({merge:true}); await screenshot('seven-positions');
  assert.equal(await page.locator('.copy-progress').count(),0);
  await drag(await point('.bench-slot[data-index="5"]'),await slotPoint(4));
  assert.equal((await owned()).slots[4].copies,4); assert.equal((await owned()).slots[4].ownedId,5);assert.equal((await owned()).bench[0],null);
  await fixture({overflow:true});
  await drag(await point('.bench-slot[data-index="5"]'),await slotPoint(4));assert.equal((await owned()).slots[4].ownedId,6);assert.equal((await owned()).bench[0].ownedId,5);
  // Single target, invalid source, identity binding, restore default.
  await fixture(); await tapSlot(0); await page.locator('.target-start').tap();
  await tapSlot(0);assert.equal(await page.evaluate(()=>!!window.__app.game.targeting),true);
  await tapSlot(4);assert.deepEqual((await owned()).slots[0].targetIds,[5]);
  await screenshot('single-target');await page.locator('.target-default').tap();assert.equal((await owned()).slots[0].targetIds,undefined);
  // Double target commits only a full valid pair; half selection cancel leaves inventory untouched.
  await fixture();await tapSlot(1);await page.locator('.target-start').tap();await tapSlot(0);
  assert.equal((await owned()).slots[1].targetIds,undefined);assert.equal(await page.evaluate(()=>window.__app.game.board.centerNum.textContent),'1/2');
  await screenshot('double-half');await page.keyboard.press('Escape');assert.equal((await owned()).slots[1].targetIds,undefined);
  await tapSlot(1);await page.locator('.target-start').tap();await tapSlot(0);await tapSlot(1);assert.deepEqual((await owned()).slots[1].targetIds,[1,2]);
  await fixture();await tapSlot(2);await page.locator('.target-start').tap();await tapSlot(0);assert.equal((await owned()).slots[2].targetIds,undefined);await tapSlot(4);assert.deepEqual((await owned()).slots[2].targetIds,[5]);
  await fixture();await tapSlot(3);await page.locator('.target-start').tap();await tapSlot(3);assert.deepEqual((await owned()).slots[3].targetIds,[4]);
  await fixture({target:true});await drag(await slotPoint(4),await point('.bench-slot[data-index="5"]'));await tapSlot(0);assert.match(await page.locator('.target-start').innerText(),/目标失效/);await screenshot('invalid-target');
  // Full inventory replacement is confirmation only; empty bench preserves the old card.
  await fixture();const beforeDismiss=await owned();await draft(0);await tapSlot(4);await page.getByRole('button',{name:'取消',exact:true}).tap();await page.locator('.modal-ov').waitFor({state:'detached'});assert.deepEqual(await owned(),beforeDismiss);
  await tapSlot(4);await page.getByRole('button',{name:'遣散并招募',exact:true}).tap();assert.equal((await owned()).slots[4].defId,'n_colossus');assert.equal((await owned()).picks,1);
  await page.locator('.modal-ov').waitFor({state:'detached'});await fixture({emptyBench:true});await draft(0);await tapSlot(4);assert.equal((await owned()).bench[0].ownedId,5);
  // Directional reroll and only this run's four factions plus neutral in the codex.
  await fixture();await page.locator('.tray-left .reroll').tap();
  const faction=await page.evaluate(()=>window.__app.game.run.activeFactions[0]);
  const name=await page.evaluate(async f=>(await import('/src/core/data.ts')).FACTION_INFO[f].name,faction);
  await page.locator('.refresh-dialog').getByRole('button',{name,exact:true}).tap();await page.locator('.modal-ov').waitFor({state:'detached'});
  assert.equal(await page.evaluate(async f=>{const {unitDef}=await import('/src/core/data.ts');return window.__app.game.run.draft.every(id=>unitDef(id).faction===f);},faction),true);
  assert.equal(await page.evaluate(()=>window.__app.game.run.rerolls),0);
  await page.locator('.pool-open').tap();await screenshot('pool');assert.equal(await page.locator('.pool-tabs button').count(),5);
  await page.locator('.pool-tabs button').last().tap();await page.locator('.pool-unit').last().tap();await screenshot('legendary-detail');
  await page.locator('.modal-x').tap();await page.locator('.modal-ov').waitFor({state:'detached'});
  // Original failure -> sandbox: bench and target identity remain isolated, restore returns original seven units.
  await fixture({target:true});await page.evaluate(()=>{const g=window.__app.game;g.run.slots=[{defId:'n_obelisk',ownedId:1,copies:1},null,null,null,null];g.run.bench=[{defId:'n_marshal',ownedId:2,copies:1,targetIds:[1]},{defId:'a_seed',ownedId:3,copies:1}];g.run.nextOwnedId=4;g.run.stage=9;g.speed=3;g.renderAll();});
  const original=await owned();await page.locator('.tray .fight').tap();await page.getByRole('button',{name:'跳过',exact:true}).tap();await page.getByRole('button',{name:'复盘',exact:true}).waitFor();await page.waitForTimeout(400);await page.getByRole('button',{name:'复盘',exact:true}).tap();
  await drag(await point('.bench-slot[data-index="5"]'),await slotPoint(0));assert.equal((await owned()).slots[0].ownedId,2);
  await tapSlot(0);await page.locator('.target-start').tap();await tapSlot(0);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'还原站位',exact:true}).tap();assert.deepEqual((await owned()).slots,original.slots);assert.deepEqual((await owned()).bench,original.bench);await screenshot('replay');
  // Real SDK replacement: cancelled/error do not spend an attempt, duplicate completion settles once.
  await page.evaluate(()=>{window.__adMode='cancelled';window.tap={createRewardedVideoAd(){const events={};return{onLoad:f=>events.load=f,onError:f=>events.error=f,onClose:f=>events.close=f,offLoad(){},offError(){},offClose(){},load:async()=>{},show:async()=>{setTimeout(()=>{if(window.__adMode==='failed')events.error(new Error('test'));else{events.close({isEnded:window.__adMode==='rewarded'});events.close({isEnded:true});}},30)},destroy(){}}}}});
  const retry=page.getByRole('button',{name:'看广告重打',exact:true});
  await retry.tap();await page.waitForFunction(()=>window.__app.game.mode==='sandbox');assert.equal(await page.evaluate(()=>window.__app.game.run.rewardedRetryCount),0);
  await page.evaluate(()=>window.__adMode='failed');await retry.tap();await page.waitForFunction(()=>window.__app.game.mode==='sandbox');assert.equal(await page.evaluate(()=>window.__app.game.run.rewardedRetryCount),0);
  await page.evaluate(()=>window.__adMode='rewarded');
  for(let n=1;n<=3;n++){
    await retry.tap();await page.getByRole('button',{name:'跳过',exact:true}).tap();await page.getByRole('button',{name:'复盘',exact:true}).waitFor();await page.waitForTimeout(400);
    assert.equal(await page.evaluate(()=>window.__app.game.run.rewardedRetryCount),n);assert.equal(await page.evaluate(()=>window.__app.game.run.lives),2);
    await page.getByRole('button',{name:'复盘',exact:true}).tap();
  }
  assert.equal(await retry.count(),0);await screenshot('retry-exhausted');
  await page.getByRole('button',{name:'还原站位',exact:true}).focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');assert.equal(await page.getByRole('button',{name:'还原站位',exact:true}).evaluate(el=>el.matches(':focus-visible')),true);
  await page.waitForTimeout(450);
  const controls=await page.locator('.sandbox-panel button, .bench-slot').evaluateAll(els=>els.map(el=>{const b=el.getBoundingClientRect();return{text:el.innerText,width:b.width,height:b.height,x:b.x,y:b.y,right:b.right,bottom:b.bottom};}));
  for(const b of controls){assert.ok(b.width>=43.9&&b.height>=43.9,`small ${JSON.stringify(b)}`);assert.ok(b.x>=0&&b.y>=0&&b.right<=width+1&&b.bottom<=height+1,`offscreen ${JSON.stringify(b)}`)}
  await page.getByRole('button',{name:'结束复盘',exact:true}).tap();assert.equal(await page.evaluate(()=>window.__app.game.mode),'prep');
  assert.deepEqual(errors,[]);report.push({width,height,reducedMotion:width===667,actions:['normal recruit to battlefield/bench','point and drag bench return','2+2 merge','different-star direct swap','four target modes/cancel/default/invalid identity','dismiss cancel/confirm and preserve old card','focused reroll and pool codex','real defeat/replay/restore','cancel/error/duplicate SDK callbacks and three retries','focus and touch targets'],controls,errors});
  if (width === 1280) {
    await fixture();
    await page.locator('.pool-open').focus();await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');await page.locator('.modal-ov').waitFor({state:'detached'});
    assert.equal(await page.locator('.pool-open').evaluate(el=>document.activeElement===el),true);
    // Leaving while an ad is unresolved cancels the original transaction; its late close is harmless.
    await page.evaluate(()=>{ const app=window.__app,g=app.game;g.run.rerolls=0;g.renderAll();window.tap={createRewardedVideoAd(){return{onLoad(){},onError(){},onClose:f=>window.__lateClose=f,offLoad(){},offError(){},offClose(){},load:async()=>{},show:async()=>{},destroy(){}}}};window.__oldGame=g; });
    await page.getByRole('button',{name:'广告刷新',exact:true}).tap();
    // The waiting state intentionally locks game input; simulate a host navigation lifecycle exit.
    await page.evaluate(()=>window.__app.toTitle());
    await page.getByRole('button',{name:'开始远征',exact:true}).waitFor();
    const old=await page.evaluate(()=>JSON.stringify(window.__oldGame.run));
    await page.evaluate(()=>window.__lateClose({isEnded:true}));await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__oldGame.run)),old);
    report.at(-1).actions.push('modal keyboard Escape/focus return','simulated host exit while SDK pending then late callback ignored');
  }
  await context.close();
}
writeFileSync(new URL(process.env.UI_WIDTH ? `report-${process.env.UI_WIDTH}.json` : 'report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report.map(({width,height,actions})=>({width,height,actions}))));
} finally { await browser.close(); }
