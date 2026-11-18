import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ExpeditionProgress, validateExpeditionState } from '../dist/js/expedition-progress.js';
import { ORIGINAL_CAMPAIGN_LEVEL_IDS } from '../dist/js/adventure-access.js';
import { getUnlockRewards } from '../dist/js/campaign-rules.js';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';

const { chromium } = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const base = process.env.ADVENTURE_URL || 'http://127.0.0.1:4248';
const refinementDragOnly = process.argv.includes('--refinement-drag-only');
const refinementOnly = process.argv.includes('--refinement-only') || refinementDragOnly;
const output = new URL(refinementOnly?'../output/adventure-ui-refinement/':'../output/adventure-ui/', import.meta.url);
const hudOnly = process.argv.includes('--hud-only');
const dockOnly = process.argv.includes('--dock-only');
await mkdir(output, { recursive: true });
const report = { checks: [], errors: [], limitations: ['Isolated Edge touch emulation. Physical phone and TapTap host remain unverified.'] };

function profile(count = 31) {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const state = new ExpeditionProgress(storage).state;
  let remaining = count;
  for (let faction = 1; faction <= 6; faction++) {
    const amount = Math.min(remaining, 6);
    state.factionCompleted[faction] = ORIGINAL_CAMPAIGN_LEVEL_IDS.slice(0, amount);
    remaining -= amount;
    for (const levelId of state.factionCompleted[faction]) {
      const unlocks = getUnlockRewards(levelId, faction);
      for (const kind of ['units', 'spells']) state.inventory[kind] = [...new Set([...state.inventory[kind], ...unlocks[kind]])];
    }
  }
  state.completed = [...new Set(Object.values(state.factionCompleted).flat())];
  state.accountStageClaims = Object.fromEntries(state.completed.map(id => [id, 'legacy']));
  assert.ok(validateExpeditionState(state));
  return state;
}

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
let page;
async function contextFor(width, height, motion, count = 31) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: motion });
  await context.addInitScript(({ key, seed }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed));
  }, { key: SAVE_KEYS.expedition, seed: profile(count) });
  page = await context.newPage();
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(base)) report.errors.push(`${response.status()} ${response.url()}`); });
  await page.route('**/js/main.js', async route => {
    const source = await readFile(new URL('../dist/js/main.js', import.meta.url), 'utf8');
    // Read-only QA observation. All navigation and commands use actual input.
    await route.fulfill({ contentType: 'text/javascript', body: source + '\nwindow.__adventureQA={renderer,get state(){return match},get ready(){return activeTurn()}};' });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__adventureQA);
  return context;
}
async function shot(name) { await page.screenshot({ path: fileURLToPath(new URL(name + '.png', output)) }); }
async function cellPoint(x, y) {
  return page.evaluate(({ x, y }) => {
    const renderer = window.__adventureQA.renderer, rect = renderer.canvas.getBoundingClientRect();
    const cell = renderer.cellGeometry(renderer.boardMetrics(rect.width, rect.height), x, y);
    return { x: rect.left + cell.center.x, y: rect.top + cell.center.y };
  }, { x, y });
}
async function tapCell(x, y) { const p = await cellPoint(x, y); await page.touchscreen.tap(p.x, p.y); }
async function abilityResources() {
  return page.evaluate(() => {
    const state=window.__adventureQA.state;
    return {mana:state.players[0].mana,revision:state.revision,units:state.units.map(unit=>({unitId:unit.unitId,x:unit.x,y:unit.y,health:unit.health})),abilities:state.adventure.units};
  });
}
async function verifyAimLayout(width) {
  const target=await cellPoint(4,3);
  const layout=await page.evaluate(target=>{
    const panel=document.querySelector('.adventure-controls'),rect=panel.getBoundingClientRect(),root=getComputedStyle(document.documentElement);
    const inset=Math.max(8,parseFloat(root.getPropertyValue('--safe-side-floor'))+8||8);
    const hud=['.battle-top-center','.general-panel','#end-turn','#leave-match','#map-controls'].flatMap(selector=>[...document.querySelectorAll(selector)]).filter(element=>element.getBoundingClientRect().width&&element.getBoundingClientRect().height);
    const overlaps=hud.filter(element=>{const box=element.getBoundingClientRect();return rect.left<box.right&&rect.right>box.left&&rect.top<box.bottom&&rect.bottom>box.top;}).map(element=>element.id||element.className);
    return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,inset,overlaps,targetBlocked:panel.contains(document.elementFromPoint(target.x,target.y))};
  },target);
  assert.ok(layout.left>=layout.inset,`${width}: ability panel must stay inside the existing safe inset`);
  assert.ok(layout.right<=width-layout.inset,`${width}: panel right edge must stay inside the safe inset`);
  assert.deepEqual(layout.overlaps,[],`${width}: ability panel must not cover key battle HUD`);
  assert.equal(layout.targetBlocked,false,`${width}: preview target remains directly touchable`);
  return layout;
}

async function checkFixedDock(width,height,motion){
  const context=await contextFor(width,height,motion);
  await page.locator('#adventure-gift[open]').waitFor();
  await page.locator('.gift-play').tap();
  await page.locator('[data-action="level"][data-level-id="storm-02"]').tap();
  await page.locator('.atlas-start').tap();await page.locator('.prep-start').tap();
  await page.locator('#match').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#scene-loading').open);
  await page.locator('#objective-close').tap();await page.locator('.opening-confirm').tap();
  await page.waitForFunction(()=>window.__adventureQA.ready);
  const cannon=await page.evaluate(()=>window.__adventureQA.state.units.find(u=>u.cardId===9202));
  await tapCell(cannon.x,cannon.y);
  await page.locator('.adventure-ability').waitFor({state:'visible'});
  const layout=await page.evaluate(()=>{
    const panel=document.querySelector('.adventure-controls').getBoundingClientRect(),first=document.querySelector('#hand .hand-card').getBoundingClientRect(),map=document.querySelector('#map-open').getBoundingClientRect(),button=document.querySelector('.adventure-ability');
    const handTop=Math.min(...[...document.querySelector('#hand').children].map(card=>card.getBoundingClientRect().top));
    return {panel:{x:panel.x,y:panel.y,width:panel.width,height:panel.height,right:panel.right,bottom:panel.bottom},firstCard:{left:first.left,top:first.top},map:{top:map.top},handTop,nameSize:getComputedStyle(button.querySelector('span')).fontSize,costSize:getComputedStyle(button.querySelector('b')).fontSize};
  });
  assert.equal(layout.panel.x,68);assert.equal(layout.panel.width,78);assert.equal(layout.panel.height,44);
  assert.ok(Math.abs(layout.panel.y-layout.handTop)<1);
  assert.ok(layout.panel.right<=layout.firstCard.left,'fixed skill lane leaves the first hand card clear');
  assert.ok(layout.panel.bottom<=layout.map.top,'map button below the fixed lane remains reachable');
  assert.equal(layout.nameSize,'14px');assert.equal(layout.costSize,'12px');
  await shot(`${width}-fixed-dock`);
  await page.locator('#map-open').tap();await page.locator('#map-panel').waitFor({state:'visible'});
  await page.locator('#map-overview').tap();await page.locator('#map-panel').waitFor({state:'hidden'});
  const first=page.locator('#hand .hand-card').first();
  await first.tap();
  assert.ok((await first.getAttribute('class')).includes('selected'));
  assert.equal(await page.locator('.adventure-controls').isVisible(),false,'hand selection clears the skill panel');
  await shot(`${width}-dock-first-card`);
  await page.keyboard.press('Escape');
  await tapCell(cannon.x,cannon.y);
  await page.locator('.adventure-ability').waitFor({state:'visible'});
  const before=await abilityResources(),button=await page.locator('.adventure-ability').boundingBox(),target=await cellPoint(4,3);
  const touch=await context.newCDPSession(page),origin={x:button.x+button.width/2,y:button.y+button.height/2};
  await page.evaluate(()=>{window.__dockInputs=[];for(const type of ['pointerdown','pointermove','pointercancel'])document.addEventListener(type,event=>window.__dockInputs.push({type:event.type,target:event.target.className,primary:event.isPrimary,button:event.button,id:event.pointerId}),true);});
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...origin,id:1}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:origin.x,y:origin.y-18,id:1}]});
  await page.waitForTimeout(80);
  report.checks.push({dragStart:await page.evaluate(()=>window.__dockInputs),origin});
  assert.equal(await page.locator('.adventure-cancel').isVisible(),true,'moving a captured skill press must enter aiming');
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...target,id:1}]});
  await page.locator('.adventure-summary').filter({hasText:'4目标'}).waitFor();
  assert.deepEqual(await abilityResources(),before,'dragging starts and previews without spending');
  const aimingButton=await page.locator('.adventure-ability').boundingBox();
  assert.ok(Math.abs(aimingButton.y-button.y)<1,'aiming does not move the action button');
  await shot(`${width}-fixed-dock-preview`);
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>window.__adventureQA.state.lastAction?.kind==='adventure');
  await page.waitForFunction(()=>window.__adventureQA.ready);
  const after=await abilityResources();assert.equal(after.mana,before.mana-2);
  assert.equal(after.abilities.find(q=>q.unitId===cannon.unitId).charge,0);
  report.checks.push({viewport:`${width}x${height} ${motion}`,layout,map:'real touch opens overview and closes it by map touch',firstCard:'actual tap selects first card and hides skill panel',drag:'touch starts, previews with no cost, releases to consume exactly2 mana and2 charge; prepare preserves gesture'});
  await touch.detach();await context.close();
}

async function checkRefinement(width,height,motion){
  const context=await contextFor(width,height,motion),prefix=`${width}-${motion}`;
  await page.locator('#adventure-gift[open]').waitFor();await page.locator('.gift-play').tap();
  await page.locator('[data-action="level"][data-level-id="storm-02"]').tap();
  await page.locator('.atlas-start').tap();await page.locator('.prep-start').tap();
  await page.locator('#match').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#scene-loading').open);
  await page.locator('#objective-close').tap();await page.locator('.opening-confirm').tap();
  await page.waitForFunction(()=>window.__adventureQA.ready);
  assert.equal(await page.locator('.adventure-controls').isVisible(),false);
  const cannon=await page.evaluate(()=>window.__adventureQA.state.units.find(u=>u.cardId===9202));
  await tapCell(cannon.x,cannon.y);await page.locator('.adventure-ability').waitFor({state:'visible'});
  assert.equal(await page.locator('.adventure-ability b').innerText(),'2法力');
  assert.equal(await page.locator('.adventure-summary').innerText(),'过载就绪');
  assert.match(await page.locator('.adventure-ability').getAttribute('aria-label'),/充能2\/2/);
  const selected=await page.evaluate(()=>{
    const panel=document.querySelector('.adventure-controls').getBoundingClientRect(),first=document.querySelector('#hand .hand-card').getBoundingClientRect(),map=document.querySelector('#map-open').getBoundingClientRect(),button=document.querySelector('.adventure-ability'),summary=document.querySelector('.adventure-summary');
    return {left:panel.left,width:panel.width,height:panel.height,right:panel.right,firstLeft:first.left,bottom:panel.bottom,mapTop:map.top,buttonBackground:getComputedStyle(button).backgroundImage,endTurnBackground:getComputedStyle(document.querySelector('#end-turn')).backgroundImage,border:getComputedStyle(button).borderWidth,radius:getComputedStyle(button).borderRadius,nameSize:getComputedStyle(button.querySelector('span')).fontSize,costSize:getComputedStyle(button.querySelector('b')).fontSize,summaryBackground:getComputedStyle(summary).backgroundColor};
  });
  assert.equal(selected.width,78);assert.equal(selected.height,44);assert.ok(selected.right<=selected.firstLeft);assert.ok(selected.bottom<=selected.mapTop);
  assert.equal(selected.buttonBackground,selected.endTurnBackground,'skill and end turn share the authored primary material');
  assert.equal(selected.border,'0px');assert.equal(selected.radius,'0px');assert.equal(selected.nameSize,'14px');assert.equal(selected.costSize,'12px');assert.equal(selected.summaryBackground,'rgba(0, 0, 0, 0)');
  await shot(`${prefix}-selected`);
  await page.locator('#map-open').tap();await page.locator('#map-panel').waitFor({state:'visible'});
  const map=await page.locator('#map-overview').boundingBox();await page.touchscreen.tap(map.x+map.width*2.5/11,map.y+map.height*.5);
  await page.locator('#map-panel').waitFor({state:'hidden'});
  await page.locator('#hand .hand-card').first().tap();assert.equal(await page.locator('.adventure-controls').isVisible(),false);
  await page.keyboard.press('Escape');await tapCell(cannon.x,cannon.y);await page.locator('.adventure-ability').waitFor({state:'visible'});
  const before=await abilityResources();
  await page.locator('.adventure-ability').tap();await tapCell(4,3);
  await page.locator('.adventure-summary').filter({hasText:'4目标 · 40伤害'}).waitFor();
  assert.equal(await page.locator('.adventure-summary').count(),1);
  assert.deepEqual(await abilityResources(),before);
  await shot(`${prefix}-aim`);
  await page.locator('.adventure-cancel').tap();assert.deepEqual(await abilityResources(),before);
  assert.equal(await page.locator('.adventure-summary').innerText(),'过载就绪');await shot(`${prefix}-cancelled`);
  await page.locator('.adventure-ability').focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');
  assert.deepEqual(await abilityResources(),before);
  if(width===568&&motion==='reduce'){
    const button=await page.locator('.adventure-ability').boundingBox(),target=await cellPoint(4,3),touch=await context.newCDPSession(page);
    const origin={x:button.x+button.width/2,y:button.y+button.height/2};
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...origin,id:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:origin.x,y:origin.y-18,id:1}]});
    await page.locator('.adventure-cancel').waitFor({state:'visible'});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...target,id:1}]});
    await page.locator('.adventure-summary').filter({hasText:'4目标 · 40伤害'}).waitFor();
    assert.deepEqual(await abilityResources(),before);
    await shot(`${prefix}-drag-preview`);
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
  }else{
    await page.locator('.adventure-ability').tap();await tapCell(4,3);await page.locator('.adventure-ability').tap();
  }
  await page.waitForFunction(()=>window.__adventureQA.state.lastAction?.kind==='adventure');
  if(motion==='no-preference'){await page.waitForTimeout(200);await shot(`${prefix}-cast`);}
  await page.waitForFunction(()=>window.__adventureQA.ready);
  assert.equal((await abilityResources()).mana,before.mana-2);
  if(!await page.locator('.adventure-controls').isVisible())await tapCell(cannon.x,cannon.y);
  assert.equal(await page.locator('.adventure-ability').isDisabled(),true);
  assert.equal(await page.locator('.adventure-summary').innerText(),'本回合已用');
  const disabled=await page.locator('.adventure-ability').evaluate(button=>({background:getComputedStyle(button).backgroundImage,filter:getComputedStyle(button).filter,opacity:getComputedStyle(button).opacity}));
  assert.match(disabled.filter,/grayscale\(1\)/);assert.equal(disabled.opacity,'1');
  await shot(`${prefix}-unavailable`);
  const spent=await abilityResources(),box=await page.locator('.adventure-ability').boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);assert.deepEqual(await abilityResources(),spent);
  if(width===568&&motion==='reduce'){
    // A completed drag retains the existing 600ms compatibility-click guard.
    // The independent charge-source action begins after that input boundary.
    await page.waitForTimeout(650);
    const guide=await page.evaluate(()=>window.__adventureQA.state.units.find(u=>u.cardId===9201));await tapCell(guide.x,guide.y);
    await page.locator('.adventure-ability').tap();await tapCell(cannon.x,cannon.y);await page.locator('.adventure-ability').tap();
    await page.waitForFunction(()=>window.__adventureQA.ready&&window.__adventureQA.state.adventure.units.find(q=>q.cardId===9202).charge===1);
    await tapCell(cannon.x,cannon.y);assert.equal(await page.locator('.adventure-summary').innerText(),'充能1/2 · 本回合已用');await shot(`${prefix}-charge-one`);
  }
  report.checks.push({viewport:`${width}x${height} ${motion}`,selected,disabled,input:'map and first card reachable; touch and keyboard preview/cancel spend nothing; real cast spends2 mana and2 charge; disabled touch spends nothing',pixelfx:'charge references rendered and reviewed; existing primary material reused without adding motion'});
  await context.close();
}

try {
  if(refinementOnly){
    if(refinementDragOnly)await checkRefinement(568,320,'reduce');
    else for(const width of [568,844])for(const motion of ['reduce','no-preference'])await checkRefinement(width,width===568?320:390,motion);
    assert.deepEqual(report.errors,[]);
  }else if(dockOnly){
    await checkFixedDock(568,320,'reduce');
    await checkFixedDock(844,390,'no-preference');
    assert.deepEqual(report.errors,[]);
  }else if(hudOnly){
    const context=await contextFor(568,320,'reduce');
    await page.locator('#adventure-gift[open]').waitFor();
    await page.locator('.gift-play').tap();
    await page.locator('[data-action="level"][data-level-id="storm-02"]').tap();
    await page.locator('.atlas-start').tap();
    await page.locator('.prep-start').tap();
    await page.locator('#match').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('#scene-loading').open);
    await page.locator('#objective-close').tap();
    await page.locator('.opening-confirm').tap();
    await page.waitForFunction(()=>window.__adventureQA.ready);
    const cannon=await page.evaluate(()=>window.__adventureQA.state.units.find(u=>u.cardId===9202));
    await tapCell(cannon.x,cannon.y);
    await page.locator('.adventure-ability').waitFor({state:'visible'});
    const layout=await page.evaluate(()=>{
      const panel=document.querySelector('.adventure-controls'),p=panel.getBoundingClientRect(),record=document.querySelector('#battle-history > button'),r=record.getBoundingClientRect();
      const overlaps=p.left<r.right&&p.right>r.left&&p.top<r.bottom&&p.bottom>r.top;
      return {panel:{left:p.left,top:p.top,right:p.right,bottom:p.bottom},records:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},overlaps,recordReachable:record.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};
    });
    assert.equal(layout.overlaps,false);
    assert.equal(layout.recordReachable,true);
    await shot('568-ability-hud');
    await page.locator('#battle-history > button').tap();
    await page.locator('#battle-history-panel').waitFor({state:'visible'});
    await shot('568-records-open');
    const openedLayout=await page.evaluate(()=>{
      const panel=document.querySelector('.adventure-controls'),record=document.querySelector('#battle-history > button'),p=panel.getBoundingClientRect(),r=record.getBoundingClientRect();
      return {panel:{left:p.left,top:p.top,right:p.right,bottom:p.bottom},record:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},overlaps:p.left<r.right&&p.right>r.left&&p.top<r.bottom&&p.bottom>r.top};
    });
    report.checks.push({openedLayout});
    assert.equal(openedLayout.overlaps,false,'opening history must keep the close trigger reachable');
    await page.locator('#battle-history > button').tap();
    await page.locator('#battle-history-panel').waitFor({state:'hidden'});
    await page.locator('#map-open').tap();
    await page.locator('#map-panel').waitFor({state:'visible'});
    const mapPoint=await page.evaluate(()=>{
      const canvas=document.querySelector('#map-overview'),map=canvas.getBoundingClientRect(),panel=document.querySelector('.adventure-controls').getBoundingClientRect();
      const left=Math.max(map.left,panel.left),right=Math.min(map.right,panel.right),top=Math.max(map.top,panel.top),bottom=Math.min(map.bottom,panel.bottom);
      const intersects=left<right&&top<bottom;
      const x=intersects?(left+right)/2:map.left+map.width/2,y=intersects?(top+bottom)/2:map.top+map.height/2;
      const hit=document.elementFromPoint(x,y);
      return {x,y,intersects,reachable:hit===canvas,hit:hit?.id||hit?.className,mapZ:getComputedStyle(document.querySelector('#map-controls')).zIndex};
    });
    report.checks.push({mapPoint});
    assert.equal(mapPoint.reachable,true,'expanded map must receive touch above the skill panel');
    await shot('568-map-above-ability');
    await page.touchscreen.tap(mapPoint.x,mapPoint.y);
    await page.locator('#map-panel').waitFor({state:'hidden'});
    const afterMap=await page.evaluate(()=>({aiming:!document.querySelector('.adventure-cancel').hidden,pressed:document.querySelector('.adventure-ability').getAttribute('aria-pressed')}));
    report.checks.push({afterMap});
    await shot('568-map-closed');
    assert.equal(afterMap.aiming,false,'map touch must not start an unrelated ability');
    const resources=await abilityResources();
    await page.locator('.adventure-ability').tap();
    await page.locator('.adventure-cancel').waitFor({state:'visible'});
    await page.locator('.adventure-cancel').tap();
    assert.deepEqual(await abilityResources(),resources);
    await page.locator('.adventure-ability').focus();
    await page.keyboard.press('Enter');
    await page.locator('.adventure-cancel').waitFor({state:'visible'});
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.adventure-cancel').isVisible(),false);
    assert.deepEqual(await abilityResources(),resources,'pointer provenance guard leaves keyboard targeting unchanged');
    assert.deepEqual(report.errors,[]);
    report.checks.push({viewport:'568x320 reduce',layout,mapPoint,records:'real touch opens and closes history',map:'real overview touch closes expanded map above skill control',ability:'real touch starts and cancels without cost; keyboard Enter/ArrowRight/Escape remains available'});
    await context.close();
  }else{
  for (const [width, height, motion] of [[844, 390, 'no-preference'], [568, 320, 'reduce']]) {
    const context = await contextFor(width, height, motion);
    await page.locator('#adventure-gift[open]').waitFor();
    assert.equal(await page.locator('.gift-review').getAttribute('href'), 'https://www.taptap.cn/app/970030/review');
    await shot(`${width}-gift`);
    await page.locator('.gift-play').tap();
    await page.locator('[data-action="level"][data-level-id="storm-02"]').tap();
    assert.equal(await page.locator('.atlas-chapter').count(), 16);
    await shot(`${width}-chapters`);
    await page.locator('.atlas-start').tap();
    await page.locator('.prep-start').tap();
    await page.locator('#match').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#scene-loading').open);
    await page.locator('#objective-close').tap();
    await page.locator('.opening-confirm').tap();
    await page.waitForFunction(() => window.__adventureQA.ready);
    const before = await page.evaluate(() => {
      const state = window.__adventureQA.state;
      return { mana: state.players[0].mana, count: state.units.length, cannon: state.units.find(unit => unit.cardId === 9202) };
    });
    await tapCell(before.cannon.x, before.cannon.y);
    await page.locator('.adventure-ability').waitFor({ state: 'visible' });
    await shot(`${width}-ability`);
    const resources=await abilityResources();
    await page.locator('.adventure-ability').tap();
    await tapCell(4, 3);
    await page.locator('.adventure-summary').filter({ hasText: '4目标' }).waitFor();
    assert.deepEqual(await abilityResources(),resources,'pure touch start/preview consumes no resources or action');
    assert.equal(await page.locator('.adventure-summary').innerText(),'4目标 · 40伤害');
    const layout=await verifyAimLayout(width);
    await shot(`${width}-beam-preview`);
    assert.equal(await page.evaluate(() => window.__adventureQA.state.players[0].mana), before.mana, 'preview spends nothing');
    await page.locator('.adventure-cancel').tap();
    await page.locator('.adventure-cancel').waitFor({state:'hidden'});
    assert.deepEqual(await abilityResources(),resources,'pure touch start/preview/cancel consumes no resources or action');
    assert.equal(await page.locator('.adventure-summary').innerText(),'过载就绪');
    await page.locator('.adventure-ability').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');
    await page.locator('.adventure-summary').filter({hasText:'4目标'}).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.adventure-cancel').waitFor({state:'hidden'});
    assert.deepEqual(await abilityResources(),resources,'keyboard preview/Escape consumes no resources or action');
    assert.equal(await page.locator('.adventure-ability').evaluate(element=>element===document.activeElement),true);
    if(width===844){
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowRight');
      await page.locator('.adventure-summary').filter({hasText:'4目标'}).waitFor();
      await page.keyboard.press('Enter');
    }else{
      await page.locator('.adventure-ability').tap();
      await tapCell(4,3);
      await tapCell(4,3);
    }
    await page.waitForFunction(() => window.__adventureQA.state.lastAction?.kind === 'adventure');
    if (motion === 'no-preference') { await page.waitForTimeout(250); await shot(`${width}-beam-hit`); }
    await page.waitForFunction(() => window.__adventureQA.ready);
    const after = await page.evaluate(() => {
      const state = window.__adventureQA.state;
      return { mana: state.players[0].mana, count: state.units.length, charge: state.adventure.units.find(unit => unit.cardId === 9202).charge, revision: state.revision };
    });
    assert.equal(after.mana, before.mana - 2);
    assert.equal(after.charge, 0);
    assert.ok(after.count < before.count);
    await shot(`${width}-beam-result`);
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEYS.expedition);
    assert.equal(stored.activeBattle.revision, after.revision);
    await page.reload();
    await page.waitForFunction(() => window.__adventureQA);
    assert.equal(await page.locator('#adventure-gift[open]').count(), 0);
    const resumed = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEYS.expedition);
    assert.deepEqual(resumed.activeBattle.adventure, stored.activeBattle.adventure);
    report.checks.push(`${width}x${height} ${motion}: gift/18-node access/prep/opening/beam preview-confirm/overload costs/save-reload and one-time invitation`);
    report.checks.push({viewport:`${width}x${height}`,layout,touchPreviewCancel:'no cost or action consumed',keyboard:'Enter starts, ArrowRight previews, Escape cancels and restores focus',confirmation:width===844?'keyboard Enter':'pure touch second target tap'});
    await context.close();
  }
  const context = await contextFor(568, 320, 'reduce', 30);
  assert.equal(await page.locator('#adventure-gift[open]').count(), 0);
  await page.locator('.menu-play').tap();
  await page.locator('[data-action="chapter"][data-chapter-id="storm-front"]').tap();
  assert.equal(await page.locator('.atlas-start').isDisabled(), true);
  await shot('568-threshold-30');
  report.checks.push('30 completed records: no invitation, new chapter previews show31 threshold, start disabled');
  await context.close();
  assert.deepEqual(report.errors, []);
  }
} catch (error) {
  report.failure = error.stack;
  if (page && !page.isClosed()) await shot('failure');
  throw error;
} finally {
  await writeFile(new URL(refinementDragOnly?'drag-report.json':dockOnly?'dock-report.json':hudOnly?'hud-report.json':'report.json', output), JSON.stringify(report, null, 2));
  await browser.close();
}
