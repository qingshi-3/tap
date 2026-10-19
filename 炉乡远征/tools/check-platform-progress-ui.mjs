import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch} from '../dist/js/engine.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
import {RANKED_CHALLENGE_KEY} from '../dist/js/ranked-challenge.js';
const rankedRecord=JSON.parse(await readFile(new URL('./fixtures/ranked-challenge-v1-current.json',import.meta.url),'utf8'));
const {chromium}=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const out=fileURLToPath(new URL('../output/progress-improvements/platform/',import.meta.url));await mkdir(out,{recursive:true});
const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const progress=new ExpeditionProgress(storage);
for(const level of EXPEDITION_LEVELS.slice(0,3)) {
 const state=progress.state,match=createExpeditionMatch(level.id,state.training,state.squad,state.selectedHeroId,progress.getBattleLoadout());
 assert.ok(progress.saveBattle(match).ok);Object.assign(match,{phase:'over',winner:0,result:'win'});assert.ok(progress.settle(match).ok);
}
const report={checks:[],screens:[],errors:[],limitations:['Edge touch emulation; isolated mock Tap callbacks only. Physical phone, native TapTap panels and live score/unlock delivery not verified.']};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
async function shot(page,name){await page.screenshot({path:out+name+'.png'});report.screens.push(name+'.png');}
async function reachable(locator){await locator.scrollIntoViewIfNeeded();assert.ok(await locator.evaluate(el=>{const r=el.getBoundingClientRect();return r.height>=44&&r.width>=44&&r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el;}));}
try {
 for(const [width,height] of [[568,320],[844,390]]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:width===568?'reduce':'no-preference'}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  await page.addInitScript(({key,seed})=>{if(!sessionStorage.getItem('platform-seeded')){localStorage.setItem(key,JSON.stringify(seed));sessionStorage.setItem('platform-seeded','1');}}, {key:SAVE_KEYS.expedition,seed:progress.state});
  await page.addInitScript(({key,seed})=>{if(!sessionStorage.getItem('ranked-platform-seeded')){localStorage.setItem(key,JSON.stringify(seed));sessionStorage.setItem('ranked-platform-seeded','1');}}, {key:RANKED_CHALLENGE_KEY,seed:rankedRecord});
  await page.goto(process.env.PLATFORM_UI_BASE||'http://127.0.0.1:4200');await page.locator('.menu-play').waitFor();
  const before=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEYS.expedition);
  for(const action of ['leaderboard','achievements'])await reachable(page.locator(`[data-action="${action}"]`));
  await page.locator('[data-action="leaderboard"]').tap();await page.locator('#platform-progress-dialog').waitFor({state:'visible'});
  assert.match(await page.locator('.platform-progress-score').innerText(),new RegExp(String(rankedRecord.bestResult.score)));
  assert.equal(await page.locator('[data-challenge-action="resume"]').isVisible(),true);
  await page.getByRole('button',{name:'查看排行',exact:true}).tap();assert.match(await page.locator('.platform-progress-status').innerText(),/TapTap/);
  await shot(page,`${width}-browser-unavailable`);await page.getByRole('button',{name:'关闭',exact:true}).tap();
  await page.locator('[data-action="achievements"]').tap();assert.equal(await page.locator('.achievement-list li').count(),6);
  assert.equal(await page.locator('.achievement-list .is-achieved').count(),2);
  assert.equal(await page.getByRole('button',{name:'TapTap成就',exact:true}).isEnabled(),true);
  await page.getByRole('button',{name:'TapTap成就',exact:true}).tap();
  assert.match(await page.locator('.platform-progress-status').innerText(),/TapTap/);
  await page.locator('.platform-progress-body').focus();await page.keyboard.press('End');
  assert.ok(await page.locator('.achievement-list li').last().isVisible());await shot(page,`${width}-achievements`);
  await page.keyboard.press('Escape');assert.equal(await page.locator('[data-action="achievements"]').evaluate(el=>el===document.activeElement),true);
  await page.evaluate(()=>{window.__platformCalls=[];window.tap={createAchievementManager(){let listener;return {registerListener(value){listener=value;},unlockAchievement({achievementId}){window.__platformCalls.push({kind:'achievement',id:achievementId});listener.onAchievementSuccess(0,{achievementId});},showAchievements(){window.__platformCalls.push({kind:'achievement-open'});}};},getLeaderboardManager(){return {submitScores(args){window.__platformCalls.push({kind:'submit',scores:args.scores});args.callback.onSuccess({});},openLeaderboard(args){window.__platformCalls.push({kind:'open',id:args.leaderboardId});if(window.__platformCalls.filter(c=>c.kind==='open').length===1)args.callback.onFailure(500,'打开失败，请重试。');else args.callback.onSuccess({});}};}};});
  await page.locator('[data-action="leaderboard"]').tap();await page.getByRole('button',{name:'同步成绩',exact:true}).tap();
  assert.match(await page.locator('.platform-progress-status').innerText(),/已同步/);
  assert.deepEqual(await page.evaluate(()=>window.__platformCalls.find(c=>c.kind==='submit').scores),[{leaderboardId:'du5ahriaooqy2yejyy',score:rankedRecord.bestResult.score}]);
  await page.getByRole('button',{name:'查看排行',exact:true}).tap();assert.match(await page.locator('.platform-progress-status').innerText(),/打开失败/);
  await page.getByRole('button',{name:'查看排行',exact:true}).tap();assert.match(await page.locator('.platform-progress-status').innerText(),/交由TapTap/);
  await reachable(page.getByRole('button',{name:'关闭',exact:true}));await shot(page,`${width}-retry-success`);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEYS.expedition),before);
  await page.locator('[data-action="achievements"]').tap();
  await page.getByRole('button',{name:'重新同步',exact:true}).tap();
  assert.deepEqual((await page.evaluate(()=>window.__platformCalls.filter(c=>c.kind==='achievement').map(c=>c.id))).sort(),['LXFirstVictory','LXFaction3'].sort());
  await page.getByRole('button',{name:'TapTap成就',exact:true}).tap();
  assert.equal(await page.evaluate(()=>window.__platformCalls.filter(c=>c.kind==='achievement-open').length),1);
  await page.keyboard.press('Escape');
  await context.close();report.checks.push(`${width}x${height}: challenge best score and resume, no-host fallback, registered achievement IDs, scroll/keyboard/Escape focus, mock score submission/open failure and retry, mock earned achievement unlock/list, player save unchanged`);
 }
 assert.deepEqual(report.errors,[]);
} finally {await writeFile(out+'report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
