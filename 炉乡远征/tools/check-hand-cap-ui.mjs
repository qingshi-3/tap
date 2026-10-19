import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[];
try {
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(async()=>{const {BoardRenderer}=await import('/js/renderer.js');const draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__renderer=this;return draw.apply(this,args);};});
  await page.goto('http://127.0.0.1:4198/');
  await page.locator('[data-page=trials]').waitFor();
  await page.evaluate(async()=>{
    const {ExpeditionProgress}=await import('/js/expedition-progress.js');
    const {createExpeditionMatch}=await import('/js/engine.js');
    const p=new ExpeditionProgress(localStorage);p.selectHero(418);const f=p.state;
    const s=createExpeditionMatch('border-01',f.training,f.squad,418);
    s.players[0].hand=Array(6).fill(20116);s.players[1].hand=Array(5).fill(14);s.players[1].deck=[14,9];
    if(!p.saveBattle(s).ok)throw Error('fixture save failed');
  });
  await page.reload();await page.locator('[data-action=resume]').tap();await page.locator('#objective-close').tap();
  await page.waitForFunction(()=>window.__renderer?.ready);
  const decks=await page.evaluate(()=>window.__renderer.state.players.map(p=>[...p.deck]));
  await page.locator('#bbs-button').tap();await page.locator('.command-preview-confirm').tap();
  await page.waitForFunction(()=>window.__renderer.state.players[0].bbsUsed&&!document.querySelector('#bbs-button').disabled);
  let players=await page.evaluate(()=>window.__renderer.state.players);
  assert.equal(players[0].hand.length,6);assert.deepEqual(players[0].deck,decks[0]);
  assert.equal(players[1].hand.length,6);assert.deepEqual(players[1].deck,decks[1].slice(1));
  assert.match(await page.locator('#hand-count').innerText(),/6\/6.*暂停抽牌/);
  // The first visible folded edge must remain a real touch target.
  const card=await page.locator('#hand button').first().boundingBox();await page.touchscreen.tap(card.x+20,card.y+30);
  const point=await page.evaluate(async()=>{
    const {getCard}=await import('/js/cards.js');const r=window.__renderer,b=r.canvas.getBoundingClientRect(),m=r.boardMetrics(b.width,b.height);
    return r.state.units.filter(u=>u.owner===0&&getCard(u.cardId).type==='unit').map(u=>{const q=r.cellGeometry(m,u.x,u.y).center;return{x:b.left+q.x,y:b.top+q.y};}).find(q=>document.elementFromPoint(q.x,q.y)?.id==='board');
  });
  assert(point);await page.touchscreen.tap(point.x,point.y);
  await page.waitForFunction(()=>window.__renderer.state.players[0].hand.length===5&&!document.querySelector('#bbs-button').disabled);
  assert.match(await page.locator('#hand-count').innerText(),/5\/6/);
  assert.doesNotMatch(await page.locator('#hand-count').innerText(),/暂停/);
  const round=await page.evaluate(()=>window.__renderer.state.round);
  await page.locator('#end-turn').tap();
  await page.waitForFunction(round=>{const s=window.__renderer.state;return s.round>round&&s.currentPlayer===0&&s.phase==='playing'&&!document.querySelector('#bbs-button').disabled;},round,{timeout:30000});
  players=await page.evaluate(()=>window.__renderer.state.players);
  assert.equal(players[0].hand.length,6);assert.deepEqual(players[0].deck,decks[0].slice(1));
  assert.deepEqual(errors,[]);
  await writeFile('output/playwright/hand-cap-ui-evidence.json',JSON.stringify({fullSkillPreservesDeck:true,opponentDrawsToSix:true,realSpellFreesSlot:true,nextTurnDraws:true,errors},null,2));
  console.log('Touch skill at cap preserves deck; actual spell frees slot; next turn draws exactly one.');
} finally {await browser.close();}
