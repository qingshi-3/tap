// Isolated real-input verification. Run only when the shared browser slot is free.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';
const { chromium } = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const base = process.env.SCENE_TRANSITION_URL || 'http://127.0.0.1:4197';
const fallback = process.env.SCENE_NO_POPOVER === '1';
const resultsOnly = process.env.SCENE_ONLY_RESULTS === '1';
const settingsOnly = process.env.SCENE_SETTINGS_ONLY === '1';
const out = new URL(settingsOnly ? '../output/cloud-cache/transitions/browser-settings/' : fallback ? '../output/cloud-cache/transitions/browser-no-popover/' : resultsOnly ? '../output/cloud-cache/transitions/browser-results/' : '../output/cloud-cache/transitions/browser/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const report = { checks: [], errors: [], limitations: ['Isolated Edge touch emulation; physical phone and TapTap host not verified.'] };
let currentPage;
const save = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEYS.expedition);
try {
  for (const [width, height, motion] of (resultsOnly ? [] : (fallback || settingsOnly) ? [[568,320,'no-preference']] : [[844,390,'no-preference'],[568,320,'no-preference'],[844,390,'reduce'],[568,320,'reduce']])) {
    const context = await browser.newContext({ viewport: { width,height }, hasTouch:true, reducedMotion:motion, recordVideo:{dir:fileURLToPath(out),size:{width,height}} });
    if(fallback) await context.addInitScript(()=>{delete HTMLElement.prototype.showPopover;});
    const page = await context.newPage(); currentPage = page; page.setDefaultTimeout(20000);
    page.on('pageerror', error => report.errors.push(String(error)));
    // Read-only observation seams; every route and game action uses real input.
    await page.route('**/js/main.js', async route => {
      const source = await readFile(new URL('../dist/js/main.js', import.meta.url), 'utf8');
      await route.fulfill({ contentType:'text/javascript', body: source + '\nwindow.__sceneQA={renderer,get state(){return match},get busy(){return !activeTurn()},moves:u=>battleRules.movementPositions(match,u)};' });
    });
    await page.addInitScript(() => {
      window.__scenePlays=[]; window.__sceneClicks=[];
      const animate = Element.prototype.animate;
      Element.prototype.animate = function(frames, options) {
        if (this.classList.contains('qibing-scene-veil')) window.__scenePlays.push({ time:performance.now(), frames, options });
        return animate.call(this, frames, options);
      };
      document.addEventListener('click', event => {
        const target = event.target.closest('button');
        if (target) window.__sceneClicks.push({ id:target.id, action:target.dataset.action });
      }, true);
    });
    const shot = name => page.screenshot({ path:fileURLToPath(new URL(`${width}-${motion}-${name}.png`, out)), animations:'allow' });
    const hidden = () => page.locator('.qibing-scene-veil').evaluate(el => el.hidden);
    const settled = async () => { await page.waitForTimeout(1200); assert.equal(await hidden(), true); };
    await page.goto(base, { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => window.__sceneQA);
    await page.locator('.menu-play').tap();
    assert.equal(await hidden(),true,'home navigation has no burn');
    await page.locator('[data-action="chapter"]').first().tap();
    await page.locator('[data-action="adjust-loadout"]' ).waitFor({state:'visible'});
    assert.equal(await page.locator('[data-action="adjust-loadout"]').count(), 1, 'touch during reveal reaches the actual chapter once');
    await page.locator('[data-action="adjust-loadout"]').tap();
    assert.equal(await page.evaluate(()=>window.__scenePlays.length),0,'chapter and preparation have no burn');
    await page.locator('.prep-start').tap();
    await page.locator('#match').waitFor({ state:'visible' });
    await page.waitForFunction(() => !document.querySelector('#scene-loading').open);
    if (motion === 'no-preference') {
      await page.locator('.qibing-scene-veil').evaluate(el=>{const a=el.getAnimations()[0];a.pause();a.currentTime=670;});
      assert.equal(await page.locator('.qibing-scene-veil').evaluate(el=>el.matches(':popover-open,:modal')),true,'burn remains top layer over objective');
      await shot('battle-burn-open');
      await page.locator('.qibing-scene-veil').evaluate(el=>el.getAnimations()[0]?.play());
    }
    await page.locator('#objective-close').tap();
    await page.locator('.opening-confirm').tap();
    await page.waitForFunction(() => !window.__sceneQA.busy);
    await page.locator('#focus-general').tap();
    const move = await page.evaluate(() => {
      const qa=window.__sceneQA, r=qa.renderer, u=qa.state.units.find(u=>u.owner===0&&u.cardId===qa.state.players[0].generalId);
      const destinations=qa.moves(u), b=r.canvas.getBoundingClientRect();
      const d=destinations.find(d=>d.x===u.x+1&&d.y===u.y)||destinations[0];
      const p=r.cellGeometry(r.boardMetrics(b.width,b.height),d.x,d.y).center;
      return { id:u.unitId, from:r.getUnitAnchor(u), to:{x:p.x+b.left,y:p.y+b.top}, destination:d };
    });
    const touch = await context.newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[move.from]});
    for(let i=1;i<=12;i++) await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:move.from.x+(move.to.x-move.from.x)*i/12,y:move.from.y+(move.to.y-move.from.y)*i/12}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await touch.detach();
    await page.waitForFunction(({id,d}) => { const qa=window.__sceneQA,u=qa.state.units.find(u=>u.unitId===id);return u?.x===d.x&&u?.y===d.y&&!qa.busy; }, {id:move.id,d:move.destination});
    const unitBefore = await page.evaluate(id => ({...window.__sceneQA.state.units.find(u=>u.unitId===id)}), move.id);
    const runId = (await save(page)).activeBattle.runId;
    const playsBeforeRefresh = await page.evaluate(() => window.__scenePlays.length);
    // Let the completed CDP touch stream's compatibility-click window expire
    // before starting a separate gesture with Playwright's touch API.
    await page.waitForTimeout(850);
    await page.locator('#objective-open').tap();
    await page.locator('#objective-dialog[open]').waitFor({state:'visible'});
    await page.locator('#objective-close').tap();
    await settled();
    assert.equal(await page.evaluate(() => window.__scenePlays.length),playsBeforeRefresh,'battle UI refresh does not replay a scene reveal');
    await page.locator('#leave-match').tap();
    await page.locator('#settings-leave-battle').tap();
    await page.evaluate(()=>{
      window.__settingsFrames=[];
      let previous,seen=false;
      const sample=t=>{
        const active=!document.querySelector('.qibing-scene-veil').hidden;
        if(active){seen=true;if(previous!==undefined)window.__settingsFrames.push(t-previous);previous=t;}
        if(!seen||active)requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.locator('#confirm-accept').tap();
    if(motion==='no-preference') {
      await page.waitForTimeout(160);
      await shot('settings-exit-burn-in');
    }
    await page.locator('.menu-play').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>window.__scenePlays.length),playsBeforeRefresh+(motion==='reduce'?0:1),'settings return burns exactly once');
    await settled();
    const performanceObservation=await page.evaluate(()=>{
      const samples=window.__settingsFrames||[],sorted=[...samples].sort((a,b)=>a-b);
      return {samples:samples.length,medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:Math.max(0,...samples),activeVeilAnimations:document.querySelector('.qibing-scene-veil').getAnimations().length};
    });
    assert.equal(performanceObservation.activeVeilAnimations,0,'finished transition leaves no active animation');
    report.checks.push({scope:'settings exit',performanceObservation,note:'Headless Edge rAF intervals with video capture; not physical-device FPS.'});
    assert.equal((await save(page)).activeBattle.runId,runId,'return keeps the in-progress battle');
    await page.locator('[data-action="cloud"]').tap();
    await page.locator('#cloud-dialog').waitFor({state:'visible'});
    await shot('cloud-open');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#cloud-dialog').evaluate(el=>el.open),false,'Escape closes native dialog without waiting for motion');
    assert.equal(await page.locator('[data-action="cloud"]').evaluate(el=>el===document.activeElement),true,'native close restores opener focus');
    assert.equal(await page.locator('#cloud-dialog').evaluate(el=>getComputedStyle(el).pointerEvents),'none','exiting visual cannot trap a touch');
    await page.waitForTimeout(180);
    assert.equal(await page.locator('#cloud-dialog').evaluate(el=>getComputedStyle(el).display),'none');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.menu-play').tap();
    await page.locator('#objective-close').tap();
    await page.waitForFunction(()=>window.__sceneQA && !window.__sceneQA.busy);
    assert.equal((await save(page)).activeBattle.runId,runId,'reentry loads the same local battle');
    const unitAfter=await page.evaluate(id=>window.__sceneQA.state.units.find(u=>u.unitId===id),move.id);
    assert.equal(unitAfter.x,unitBefore.x); assert.equal(unitAfter.y,unitBefore.y);
    await settled(); await shot('resumed-battle');
    if(motion==='reduce')assert.equal(await page.evaluate(()=>window.__scenePlays.length),0,'reduced motion disables scene animation');
    report.checks.push({width,height,motion,runId,hero:move.id,position:move.destination,actions:['real menu and chapter input','real battle start and hero drag','battle settings return','native Escape/focus','reload and saved battle resume']});
    const video = await page.video().path();
    await context.close();
    await rename(video,fileURLToPath(new URL(`${width}-${motion}.webm`,out)));
  }
  // Copy a provenance-recorded, already settled historical archive into an
  // isolated browser. These checks verify result navigation, not a new win.
  if (!settingsOnly) {
  const profile = JSON.parse(await readFile(new URL('../output/content-expansion/ui-mechanics/result-render-fixtures/f1-s18-profile.json',import.meta.url),'utf8'));
  assert.equal(profile.activeBattle.phase,'over');
  const defeated = JSON.parse(await readFile(new URL('../output/content-expansion/ui-mechanics/isolated-f5-s30-eggs/input-probes/resume-profile.json',import.meta.url),'utf8'));
  assert.equal(defeated.activeBattle.phase,'over');
  assert.notEqual(defeated.activeBattle.winner,0);
  for(const [button,destination] of [['#back-to-lobby','menu'],['#result-collection','codex'],['#result-prep','prep'],['#next-level','prep']]) {
    const context = await browser.newContext({viewport:{width:568,height:320},hasTouch:true});
    if(fallback)await context.addInitScript(()=>{delete HTMLElement.prototype.showPopover;});
    const seed = ['#result-collection','#result-prep'].includes(button) ? defeated : profile;
    await context.addInitScript(({key,profile})=>localStorage.setItem(key,JSON.stringify(profile)),{key:SAVE_KEYS.expedition,profile:seed});
    const page=await context.newPage();currentPage=page;
    page.on('pageerror',error=>report.errors.push(String(error)));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.locator('.menu-play').tap();
    await page.locator('#game-result').waitFor({state:'visible'});
    await page.waitForTimeout(1200);
    // Observe only: the navigation itself is a real touch on a result button.
    await page.evaluate(()=>{window.__resultPlays=0;const animate=Element.prototype.animate;Element.prototype.animate=function(...args){if(this.classList.contains('qibing-scene-veil'))window.__resultPlays++;return animate.apply(this,args);};});
    const before=await save(page);
    await page.locator(button).tap();
    await page.waitForTimeout(160);
    assert.equal(await page.locator('#match').evaluate(el=>el.hidden),false,'result scene retained until cover');
    assert.equal(await page.locator('.qibing-scene-veil').evaluate(el=>el.matches(':popover-open,:modal')),true);
    if(button==='#result-prep')await page.screenshot({path:fileURLToPath(new URL('568-result-exit-burn-in.png',out)),animations:'allow'});
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('#expedition-home').getAttribute('data-page'),destination);
    assert.equal(await page.evaluate(()=>window.__resultPlays),1,'one full burn for compound result navigation');
    const after=await save(page);
    assert.equal(after.coins,before.coins,'result return cannot award coins again');
    assert.deepEqual(after.settlements,before.settlements,'result return preserves settlement history');
    report.checks.push({button,destination,fixture:seed===defeated?'isolated-f5-s30-eggs historical defeated archive':'f1-s18 historical settled winning archive',scope:'result navigation only; no new victory claimed',input:'real touch'});
    await context.close();
  }
  }
  assert.deepEqual(report.errors,[]);
} catch (error) {
  report.failure = String(error);
  if(currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({path:fileURLToPath(new URL('failure.png',out))});
    report.failureState = await currentPage.evaluate(()=>({clicks:window.__sceneClicks,phase:window.__sceneQA?.state?.phase,busy:window.__sceneQA?.busy,objective:document.querySelector('#objective-dialog').open,dialogs:[...document.querySelectorAll('dialog[open]')].map(x=>x.id),body:document.body.innerText.slice(-2500)}));
  }
  throw error;
} finally {
  await browser.close();
  await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report,null,2));




