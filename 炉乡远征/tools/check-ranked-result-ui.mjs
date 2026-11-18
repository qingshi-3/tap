import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {RankedChallengeSession,RANKED_CHALLENGE_KEY} from '../dist/js/ranked-challenge.js';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {autoAct,confirmMulligan,createExpeditionMatch} from '../dist/js/engine.js';
import {SAVE_KEYS,LOCAL_DECKS_KEY} from '../dist/js/storage-keys.js';
const {chromium}=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const directory=new URL('../output/progress-improvements/ranked-result/',import.meta.url);await mkdir(directory,{recursive:true});
class Storage{data=new Map();getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,String(v))}removeItem(k){this.data.delete(k)}}
function fixture(){
 const storage=new Storage(),progress=new ExpeditionProgress(storage),ordinary=createExpeditionMatch('border-01',progress.state.training,progress.state.squad,progress.state.selectedHeroId,progress.getBattleLoadout());assert.ok(progress.saveBattle(ordinary).ok);
 const session=new RankedChallengeSession({storage}),made=session.createAttempt();assert.ok(made.ok);const match=made.match;assert.ok(confirmMulligan(match));assert.ok(session.checkpoint(match).ok);
 for(let steps=0;steps<1200;steps++){
  const before=storage.getItem(RANKED_CHALLENGE_KEY),player=match.currentPlayer;assert.ok(autoAct(match));
  if(match.phase==='over'){
   assert.equal(player,0);assert.equal(match.lastAction.kind,'attack');assert.ok(session.result(match).won);
   return {entries:[...storage.data].map(([key,value])=>[key,key===RANKED_CHALLENGE_KEY?before:value]),expected:session.result(match),sourceId:match.lastAction.sourceId,targetId:match.lastAction.targetId};
  }
  assert.ok(session.checkpoint(match).ok);
 }
 throw Error('production fixture did not finish');
}
const seed=fixture(),report={checks:[],errors:[],limitations:['Isolated desktop Edge touch emulation and fake Tap leaderboard callbacks; no real account submission or physical-device verification.']};
if(process.env.RANKED_RESULT_FIXTURE_ONLY==='1'){console.log(JSON.stringify({expected:seed.expected,sourceId:seed.sourceId,targetId:seed.targetId}));process.exit(0)}
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const shot=async(page,name)=>page.screenshot({path:fileURLToPath(new URL(name+'.png',directory))});
async function bytes(page){return page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),[...Object.values(SAVE_KEYS),LOCAL_DECKS_KEY]);}
async function openHub(page){await page.locator('[data-action="leaderboard"]').tap();await page.locator('#platform-progress-dialog').waitFor({state:'visible'});}
async function resume(page){await openHub(page);await page.locator('[data-challenge-action="resume"]').tap();await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__renderer?.ready&&!document.querySelector('#match').hidden&&window.__renderer.state.phase==='playing');}
async function win(page,failSave){
 await page.locator('#focus-enemy').tap();
 if(failSave)await page.evaluate(()=>window.__failRankedWrites=true);
 for(const id of [seed.sourceId,seed.targetId]){
  const point=await page.evaluate(id=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===id),p=r.getUnitAnchor(u);for(const dy of [0,8,-8,16,-16]){const q={x:p.x,y:p.y+dy};if(document.elementFromPoint(q.x,q.y)===r.canvas&&r.positionFromPointer({clientX:q.x,clientY:q.y},{preferUnits:true})?.x===u.x&&r.positionFromPointer({clientX:q.x,clientY:q.y},{preferUnits:true})?.y===u.y)return q}return null},id);
  assert.ok(point,`visible legal final attack object ${id}`);await page.touchscreen.tap(point.x,point.y);
 }
 await page.locator('#game-result').waitFor({state:'visible'});await page.waitForTimeout(800);
}
try{
 for(const [width,height,motion] of [[568,320,'reduce'],[844,390,'no-preference']].filter(([width])=>!process.env.RANKED_RESULT_WIDTH||width===Number(process.env.RANKED_RESULT_WIDTH))){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:motion}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  await page.addInitScript(({entries,key})=>{
   if(!sessionStorage.getItem('ranked-result-seeded')){for(const [k,v] of entries)localStorage.setItem(k,v);sessionStorage.setItem('ranked-result-seeded','1');}
   const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key&&window.__failRankedWrites)throw Error('ranked quota fixture');return original.call(this,k,v)};
   window.__tapCalls=[];window.__tapMode='failure';window.__pendingLeaderboard=null;
   window.tap={getLeaderboardManager(){return {submitScores(args){window.__tapCalls.push(structuredClone(args.scores));if(window.__tapMode==='failure')args.callback.onFailure(500,'模拟提交失败');else if(window.__tapMode==='late')window.__pendingLeaderboard=args.callback;else args.callback.onSuccess({})},openLeaderboard(args){args.callback.onSuccess({})}}}};
  },{entries:seed.entries,key:RANKED_CHALLENGE_KEY});
  await page.addInitScript(async()=>{const{BoardRenderer}=await import('/js/renderer.js'),draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__renderer=this;return draw.apply(this,args)}});
  await page.goto(process.env.RANKED_RESULT_UI_BASE||'http://127.0.0.1:4200');await page.locator('.menu-play').waitFor();const ordinaryBefore=await bytes(page);
  await resume(page);await win(page,width===568);
  const copy=await page.locator('#game-result').innerText();for(const value of [`${seed.expected.round} 回合`,`战损 ${seed.expected.deaths}`,`主将生命 ${seed.expected.health}`,`${seed.expected.score} 分`])assert.ok(copy.includes(value),value);
  for(const selector of ['#result-ad-reward','#next-level','#result-collection','#result-prep'])assert.equal(await page.locator(selector).isVisible(),false,selector+' isolated');assert.ok(!copy.includes('金币')&&!copy.includes('宝珠'));
  if(width===568){
   assert.match(await page.locator('#result-ranked-status').innerText(),/未保存/);assert.equal(await page.locator('#result-ranked-submit').innerText(),'重试保存成绩');await shot(page,'568-save-failed');
   assert.equal(await page.evaluate(()=>window.__tapCalls.length),0);await page.evaluate(()=>window.__failRankedWrites=false);
  }
  await page.locator('#result-ranked-submit').tap();await page.waitForFunction(()=>document.querySelector('#result-ranked-status').textContent.includes('模拟提交失败'));assert.equal(await page.evaluate(()=>window.__tapCalls.length),1);
  await page.evaluate(()=>window.__tapMode='success');await page.locator('#result-ranked-submit').tap();await page.waitForFunction(()=>document.querySelector('#result-ranked-status').textContent.includes('已提交'));
  assert.deepEqual(await page.evaluate(()=>window.__tapCalls.map(c=>c[0].score)),[seed.expected.score,seed.expected.score]);
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),RANKED_CHALLENGE_KEY);assert.deepEqual(saved.bestResult,seed.expected);assert.deepEqual(await bytes(page),ordinaryBefore);
  assert.equal(await page.locator('#board-hint').evaluate(el=>el.classList.contains('visible')&&el.textContent.includes('挑战未保存')),false,'successful retry clears obsolete failed-save banner');
  // Filled buttons briefly compress under a real tap; measure resting targets
  // after that authored pressed-state transition has returned to full size.
  await page.waitForTimeout(350);
  const geometry=await page.locator('#game-result button:visible').evaluateAll(elements=>elements.map(el=>({id:el.id,rect:el.getBoundingClientRect().toJSON()})));
  await writeFile(new URL(`geometry-${width}.json`,directory),JSON.stringify(geometry,null,2));
  for(const b of geometry)assert.ok(b.rect.width>=44&&b.rect.height>=44&&b.rect.x>=0&&b.rect.y>=0&&b.rect.right<=width+.5&&b.rect.bottom<=height+.5,b.id+' reachable');await shot(page,`${width}-result-saved`);
  // A late host success is permitted to finish its request, but must not update
  // a result screen that has already been replaced by the challenge hub.
  await page.evaluate(()=>window.__tapMode='late');await page.locator('#result-ranked-submit').tap();await page.waitForFunction(()=>!!window.__pendingLeaderboard);
  await page.locator('#back-to-lobby').tap();await page.locator('#platform-progress-dialog').waitFor({state:'visible'});const hubBefore=await page.locator('#platform-progress-dialog').innerText();
  await page.evaluate(()=>window.__pendingLeaderboard.onSuccess({}));await page.waitForTimeout(100);assert.equal(await page.locator('#platform-progress-dialog').innerText(),hubBefore);assert.match(hubBefore,new RegExp(String(seed.expected.score)));await shot(page,`${width}-hub-best`);
  await page.reload();await page.locator('.menu-play').waitFor();await openHub(page);assert.match(await page.locator('.platform-progress-score').innerText(),new RegExp(String(seed.expected.score)));assert.deepEqual(await bytes(page),ordinaryBefore);
  // Restore the completed independently saved attempt through the public hub's
  // new challenge path; the start screen must use the legal loaner deck.
  await page.locator('[data-challenge-action="start"]').tap();await page.locator('.prep-start').waitFor({state:'visible'});await page.locator('.prep-start').tap();await page.locator('#objective-close').tap();
  await page.waitForFunction(()=>window.__renderer?.state.phase==='mulligan');assert.equal(await page.evaluate(()=>window.__renderer.state.players[0].generalId),1);assert.deepEqual(await bytes(page),ordinaryBefore);await shot(page,`${width}-new-attempt`);
  report.checks.push({width,height,motion,expected:seed.expected,realFinalAttack:true,saveFailureRetry:width===568,submissionFailureRetry:true,lateCallbackIsolated:true,bestSurvivesReload:true,newAttemptLegal:true,ordinaryBytesUnchanged:true,geometry});await context.close();
 }
 // Exercise the dedicated result replay action as well as the hub start path.
 if(!process.env.RANKED_RESULT_WIDTH){
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  await page.addInitScript(entries=>{for(const [k,v] of entries)localStorage.setItem(k,v)},seed.entries);
  await page.addInitScript(async()=>{const{BoardRenderer}=await import('/js/renderer.js'),draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__renderer=this;return draw.apply(this,args)}});
  await page.goto(process.env.RANKED_RESULT_UI_BASE||'http://127.0.0.1:4200');await page.locator('.menu-play').waitFor();const ordinaryBefore=await bytes(page);await resume(page);await win(page,false);
  await page.locator('#play-again').tap();await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__renderer.state.phase==='mulligan');
  assert.notEqual(await page.evaluate(()=>window.__renderer.state.runId),seed.expected.attemptId);assert.equal(await page.evaluate(()=>window.__renderer.state.players[0].generalId),1);assert.deepEqual(await bytes(page),ordinaryBefore);await shot(page,'844-result-replay');report.checks.push({width:844,height:390,resultReplay:true,ordinaryBytesUnchanged:true});await context.close();
 }
}catch(error){report.errors.push(error.stack);for(const context of browser.contexts())for(const page of context.pages())await shot(page,'failure');}
finally{await browser.close();report.passed=report.errors.length===0;await writeFile(new URL(process.env.RANKED_RESULT_WIDTH?`report-${process.env.RANKED_RESULT_WIDTH}.json`:'report.json',directory),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));}
if(!report.passed)process.exitCode=1;
