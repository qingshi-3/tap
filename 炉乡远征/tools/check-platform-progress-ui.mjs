import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch,confirmMulligan} from '../dist/js/engine.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
import {collectionProgressStats,PLATFORM_PROGRESS_BINDING,localAchievements,CONFIRMED_ACHIEVEMENTS} from '../dist/js/platform-progress.js';
import {RANKED_CHALLENGE_KEY} from '../dist/js/ranked-challenge.js';
const rankedRecord=JSON.parse(await readFile(new URL('./fixtures/ranked-challenge-v1-current.json',import.meta.url),'utf8'));
const {chromium}=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const out=fileURLToPath(new URL('../output/ui-refinement/platform/',import.meta.url));await mkdir(out,{recursive:true});
const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const progress=new ExpeditionProgress(storage);
for(const level of EXPEDITION_LEVELS.slice(0,3)) {
 const state=progress.state,match=createExpeditionMatch(level.id,state.training,state.squad,state.selectedHeroId,progress.getBattleLoadout());
 assert.ok(progress.saveBattle(match).ok);Object.assign(match,{phase:'over',winner:0,result:'win'});assert.ok(progress.settle(match).ok);
}
const report={checks:[],screens:[],errors:[],boundaries:{real:['Rendered product UI in Edge','Touch taps and touch swipes','Keyboard End, Tab and Escape','Save-byte comparisons'],mock:['TapTap leaderboard submit/open callbacks','TapTap achievement unlock/list callbacks','Three cleared levels seeded from legitimate ExpeditionProgress settlements','All three production board bindings exercised solely through isolated mock window.tap']},limitations:['Edge touch emulation; isolated mock Tap callbacks only. Physical phone, native TapTap panels and live score/unlock delivery not verified.']};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
async function shot(page,name){
 assert.equal(await page.locator('#platform-progress-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'dialog has no horizontal overflow');
 const title=await page.locator('#platform-progress-title').textContent();
 if(title!=='成就'){
  const tabs=page.locator('[data-board-mode]');
  assert.deepEqual(await tabs.allTextContents(),['战役排行','收集榜','铁崖挑战'],'all three navigation labels remain fixed');
  for(const tab of await tabs.all())await reachable(tab);
  const active=page.locator('[data-board-mode][aria-pressed="true"]');
  assert.equal(await active.count(),1);assert.equal(await active.innerText(),title);
  await active.tap();
  assert.equal(await page.locator('[data-board-mode]:visible').count(),3,'reselecting the active board cannot hide a tab');
  assert.equal(await active.getAttribute('aria-pressed'),'true');
 }
 await page.screenshot({path:out+name+'.png'});report.screens.push(name+'.png');
 if(name.includes('collection'))await checkCollectionGeometry(page,name);
}
async function reachable(locator){await locator.scrollIntoViewIfNeeded();assert.ok(await locator.evaluate(el=>{const r=el.getBoundingClientRect();return r.height>=44&&r.width>=44&&r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el;}));}
async function setup(width,height,{host=false,empty=false,seedOverride=null,noBest=false}={}) {
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:width===568?'reduce':'no-preference'});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.addInitScript(({key,seed,rankedKey,rankedSeed,host})=>{
  if(!sessionStorage.getItem('platform-seeded')){localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem(rankedKey,JSON.stringify(rankedSeed));sessionStorage.setItem('platform-seeded','1');}
  if(!host)return;
  window.__platformCalls=[];window.__platformFailSubmit=true;window.__platformFailOpen=true;window.__platformFailAchievements=true;
  let achievementListener;
  const manager={registerListener(value){achievementListener=value;},unlockAchievement({achievementId}){
   window.__platformCalls.push({kind:'achievement',id:achievementId});
   if(window.__platformFailAchievements)achievementListener.onAchievementFailure(achievementId,500,'成就同步失败，请重试。');
   else achievementListener.onAchievementSuccess(0,{achievementId});
  },showAchievements(){window.__platformCalls.push({kind:'achievement-open'});}};
  window.tap={createAchievementManager(){return manager;},getLeaderboardManager(){return {
   submitScores(args){window.__platformCalls.push({kind:'submit',scores:args.scores});if(window.__platformFailSubmit)args.callback.onFailure(500,'提交失败，请重试。');else args.callback.onSuccess({});},
   openLeaderboard(args){window.__platformCalls.push({kind:'open',id:args.leaderboardId});if(window.__platformFailOpen)args.callback.onFailure(500,'打开失败，请重试。');else args.callback.onSuccess({});}
  };}};
 },{key:SAVE_KEYS.expedition,seed:seedOverride??(empty?new ExpeditionProgress({getItem:()=>null,setItem(){},removeItem(){}}).state:progress.state),rankedKey:RANKED_CHALLENGE_KEY,rankedSeed:noBest?{...rankedRecord,bestResult:null}:rankedRecord,host});
 if(seedOverride)await page.addInitScript(async()=>{const {BoardRenderer}=await import('/js/renderer.js'),original=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__platformRenderer=this;return original.apply(this,args);};});
 await page.goto(process.env.PLATFORM_UI_BASE||'http://127.0.0.1:4227');await page.locator('.menu-play').waitFor();
 return {context,page};
}
const status=page=>page.locator('.platform-progress-status');
const persisted=page=>page.evaluate(({profile,challenge})=>({profile:localStorage.getItem(profile),challenge:localStorage.getItem(challenge)}),{profile:SAVE_KEYS.expedition,challenge:RANKED_CHALLENGE_KEY});
async function checkAchievements(page,width,{host=false,synced=false}={}) {
 const expected=localAchievements(progress.state,CONFIRMED_ACHIEVEMENTS,rankedRecord.bestResult);
 const all=page.locator('[data-achievement-category="all"]');await all.tap();
 assert.equal(await page.locator('.achievement-list li').count(),53);
 await shot(page,`${width}-${host?'host':'local'}-achievements-first-open-all${synced?'-synced':''}`);
 const categories=page.locator('[data-achievement-category]');
 assert.deepEqual(await categories.allTextContents(),['全部','远征','阵营','收集','挑战']);
 for(const item of expected){
  const row=page.locator(`.achievement-list li[data-achievement-key="${item.key}"]`);
  assert.equal(await row.count(),1);
  assert.equal(await row.evaluate(el=>el.classList.contains('is-achieved')),item.achieved);
  if(item.achieved){
   if(!item.configured){assert.match(await row.innerText(),/✓ 已达成/);assert.doesNotMatch(await row.innerText(),/待同步|已同步/);}
   else assert.match(await row.innerText(),synced?/已同步/:/待同步/);
  }
 }
 const before=await page.evaluate(()=>({profile:localStorage.getItem('duelyst-h5.safe-v1.expedition'),ranked:localStorage.getItem('duelyst-h5.safe-v1.ranked-challenge-v1'),calls:JSON.stringify(window.__platformCalls??[])}));
 for(const category of ['expedition','faction','collection','challenge','all']){
  const button=page.locator(`[data-achievement-category="${category}"]`);await reachable(button);await button.tap();
  assert.equal(await page.locator('[data-achievement-category][aria-pressed="true"]').count(),1);
  assert.equal(await button.getAttribute('aria-pressed'),'true');
  const rows=expected.filter(item=>category==='all'||item.category===category);
  assert.deepEqual(await page.locator('.achievement-list li').evaluateAll(items=>items.map(item=>item.dataset.achievementKey)),rows.map(item=>item.key));
  assert.equal(await page.locator('.platform-progress-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await shot(page,`${width}-${host?'host':'local'}-achievements-${category}${synced?'-synced':''}`);
  if(category==='all'){
   const body=page.locator('.platform-progress-body'),box=await body.boundingBox(),cdp=await page.context().newCDPSession(page),x=box.x+box.width/2;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:box.y+box.height-12}]});
   for(let step=1;step<=8;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:box.y+box.height-12-(box.height-24)*step/8}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
   await page.waitForFunction(()=>document.querySelector('.platform-progress-body').scrollTop>0);
   await scrollEnd(page);await shot(page,`${width}-${host?'host':'local'}-achievements-final${synced?'-synced':''}`);
  }
 }
 assert.deepEqual(await page.evaluate(()=>({profile:localStorage.getItem('duelyst-h5.safe-v1.expedition'),ranked:localStorage.getItem('duelyst-h5.safe-v1.ranked-challenge-v1'),calls:JSON.stringify(window.__platformCalls??[])})),before,'category filtering changes neither persisted progress nor platform requests');
 report.checks.push(`${width}: 53 achievement keys, five filter controls, unique aria-pressed selection, each category matches actual catalog, earned states match platform availability, filters preserve profile/challenge bytes and platform calls`);
}
async function checkChallengeRules(page,width,variant='best-resume'){
 const rules=page.locator('dl.challenge-score-breakdown');assert.equal(await rules.count(),1);
 assert.equal(await rules.locator('dt').count(),4);assert.equal(await rules.locator('dd').count(),4);
 assert.deepEqual(await rules.locator('dd').allTextContents(),['100000','−1000','−25/名','+5/点']);
 assert.match(await page.locator('.platform-progress-score').innerText(),variant==='no-best-resume'?/暂无成绩/:new RegExp(String(rankedRecord.bestResult.score)));
 const text=(await rules.innerText()).replace(/\s+/g,'');
 for(const pattern of [/胜利.*100000/,/回合.*[−-]1000/,/阵亡.*[−-]25/,/生命.*[+]5/])assert.match(text,pattern);
 // Measure the initial rendered viewport; scrolling must not conceal clipping.
 assert(await rules.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 assert(await rules.locator('dt,dd').evaluateAll(els=>els.every(el=>{const r=el.getBoundingClientRect(),body=el.closest('.platform-progress-body').getBoundingClientRect();return r.left>=body.left&&r.right<=body.right+1&&el.scrollWidth<=el.clientWidth+1;})));
 const geometry=await rules.locator('dd').evaluateAll(els=>els.map(el=>{
  const body=el.closest('.platform-progress-body'),status=document.querySelector('.platform-progress-status'),r=el.getBoundingClientRect(),b=body.getBoundingClientRect(),s=status.getBoundingClientRect();
  const points=[{x:r.left+Math.min(5,r.width/2),y:r.top+2},{x:r.left+Math.min(5,r.width/2),y:r.bottom-2}];
  return {text:el.textContent,rect:r.toJSON(),body:b.toJSON(),status:s.toJSON(),unobscured:points.every(p=>el.contains(document.elementFromPoint(p.x,p.y)))};
 }));
 (report.challengeRuleGeometry??=[]).push({width,variant,terms:geometry});
 for(const term of geometry){
  assert(term.rect.top>=term.body.top&&term.rect.bottom<=term.body.bottom,`score term must fully fit visible body: ${JSON.stringify({width,variant,...term})}`);
  assert(term.rect.bottom<=term.status.top||term.rect.top>=term.status.bottom,`status must not cover score term: ${JSON.stringify({width,variant,...term})}`);
  assert(term.unobscured,`score term top/bottom must be unobscured: ${JSON.stringify({width,variant,...term})}`);
 }
 await reachable(page.locator('[data-challenge-action="resume"]'));
 await shot(page,`${width}-challenge-score-rules-${variant}`);
 report.checks.push(`${width} ${variant}: all four score dd rectangles fit visible body top/bottom, do not overlap status, and are unobscured; resume button reachable`);
}
async function checkCollection(page,profile=progress.state) {
 const expected=collectionProgressStats(profile);
 assert.equal(await page.locator('#platform-progress-title').innerText(),'收集榜');
 assert.equal(await page.locator('.platform-progress-score').innerText(),`已收集 ${expected.total} / ${expected.available} 种`);
 await checkCollectionGeometry(page,'before-close-reachability');
 assert.deepEqual(await page.locator('.collection-progress-list li').allTextContents(),[`单位${expected.units} 种`,`法术${expected.spells} 种`]);
 await reachable(page.getByRole('button',{name:'关闭',exact:true}));
 await checkCollectionGeometry(page,'after-close-reachability');
}
async function checkCollectionGeometry(page,stage) {
 const geometry=await page.locator('.platform-progress-score').evaluate(score=>{
  const body=score.closest('.platform-progress-body'),dialog=body.closest('dialog');
  return {score:score.getBoundingClientRect().toJSON(),body:body.getBoundingClientRect().toJSON(),bodyScrollTop:body.scrollTop,bodyScrollHeight:body.scrollHeight,bodyClientHeight:body.clientHeight,dialogScrollTop:dialog.scrollTop,dialogScrollHeight:dialog.scrollHeight,dialogClientHeight:dialog.clientHeight};
 });
 (report.collectionGeometry??=[]).push({stage,...geometry});
 assert(geometry.score.top>=geometry.body.top&&geometry.score.bottom<=geometry.body.bottom,JSON.stringify(geometry));
}
async function scrollEnd(page) {
 const body=page.locator('.platform-progress-body');await body.focus();await page.keyboard.press('End');
 await page.waitForFunction(()=>{const el=document.querySelector('.platform-progress-body');return el.scrollTop+el.clientHeight>=el.scrollHeight-2;});
}
async function touchScrollEnd(page) {
 const body=page.locator('.platform-progress-body'),box=await body.boundingBox(),cdp=await page.context().newCDPSession(page);
 const x=box.x+box.width/2,startY=box.y+box.height-10,endY=box.y+10;
 for(let attempt=0;attempt<4;attempt++){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:startY}]});
  for(let step=1;step<=8;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:startY+(endY-startY)*step/8}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 await page.waitForFunction(()=>{const el=document.querySelector('.platform-progress-body');return el.scrollTop+el.clientHeight>=el.scrollHeight-2;});await cdp.detach();
}
async function close(page,action='leaderboard') {
 for(const key of ['Tab','Shift+Tab'])for(let step=0;step<8;step++){
  await page.keyboard.press(key);assert.equal(await page.locator('#platform-progress-dialog').evaluate(el=>el.contains(document.activeElement)),true,await page.evaluate(()=>document.activeElement.tagName+':'+document.activeElement.className));
 }
 await page.keyboard.press('Escape');await page.locator('#platform-progress-dialog').waitFor({state:'hidden'});
 assert.equal(await page.locator(`[data-action="${action}"]`).evaluate(el=>el===document.activeElement),true,'Escape restores opener focus');
}
try {
 // A legal saved battle is won through actual unit taps; no result/clear state is forged.
 if(!process.env.PLATFORM_FOCUS_COLLECTION){
  const winMemory=new Map(),winProgress=new ExpeditionProgress({getItem:k=>winMemory.get(k)??null,setItem:(k,v)=>winMemory.set(k,v),removeItem:k=>winMemory.delete(k)});
  const seed=winProgress.state,battle=createExpeditionMatch('border-01',seed.training,seed.squad,seed.selectedHeroId,winProgress.getBattleLoadout());
  assert(winProgress.saveBattle(battle).ok);confirmMulligan(battle);
  const player=battle.units.find(u=>u.owner===0&&u.cardId===1),enemy=battle.units.find(u=>u.owner===1&&u.cardId===battle.players[1].generalId);
  player.x=4;player.y=2;enemy.x=5;enemy.y=2;enemy.health=1;assert(winProgress.saveBattle(battle).ok);
  const {context,page}=await setup(568,320,{host:true,seedOverride:winProgress.state});
  await page.evaluate(()=>{window.__platformFailSubmit=false;window.__platformFailAchievements=false;});
  await page.locator('.menu-play').tap();await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__platformRenderer?.ready);await page.locator('#focus-general').tap();
  for(const id of [player.unitId,enemy.unitId]){
   const point=await page.evaluate(id=>{const r=window.__platformRenderer,box=r.canvas.getBoundingClientRect(),metrics=r.boardMetrics(box.width,box.height),u=r.state.units.find(u=>u.unitId===id),c=r.cellGeometry(metrics,u.x,u.y).center;for(const delta of [0,-8,-16,8]){const x=box.left+c.x,y=box.top+c.y+delta,cell=r.positionFromPointer({clientX:x,clientY:y});if(document.elementFromPoint(x,y)===r.canvas&&cell?.x===u.x&&cell?.y===u.y)return{x,y};}return null;},id);
   assert(point);await page.touchscreen.tap(point.x,point.y);await page.waitForFunction(()=>window.__platformRenderer.state.phase==='over'||!document.querySelector('#end-turn').disabled);
  }
  await page.locator('#result-platform-status').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#result-platform-status').textContent.includes('排行已同步'));
  assert.match(await page.locator('#result-platform-status').innerText(),/远征总进度 1 \/ 180 关/);
  assert.deepEqual(await page.evaluate(()=>window.__platformCalls.filter(c=>c.kind==='submit'&&c.scores[0].leaderboardId==='fr0m7qzhn7va29tri8').at(-1).scores),[{leaderboardId:'fr0m7qzhn7va29tri8',score:1}]);
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).factionCompleted[1].length,SAVE_KEYS.expedition),1);
  await page.screenshot({path:out+'568-real-victory-progress.png'});report.screens.push('568-real-victory-progress.png');
  report.checks.push('568x320: actual select/attack final blow settles first campaign clear, saves one clear, auto-submits score=1 to mock campaign board and shows result total 1/180 with synced feedback');await context.close();
 }
 for(const [width,height]of [[568,320],[844,390]]) {
  // No host: local progress remains visible and platform controls are disabled.
  {
   const {context,page}=await setup(width,height),before=await persisted(page);
   for(const action of ['leaderboard','achievements'])await reachable(page.locator(`[data-action="${action}"]`));
   await page.locator('[data-action="leaderboard"]').tap();
   assert.match(await page.locator('.platform-progress-score').innerText(),/3 \/ 180/);assert.equal(await page.locator('.faction-progress-list li').count(),6);
   assert.equal(await page.locator('.faction-progress-list').evaluate(list=>{
    const body=list.closest('.platform-progress-body').getBoundingClientRect();
    return [...list.children].every(row=>{const name=row.querySelector('span'),box=name.getBoundingClientRect(),score=row.querySelector('strong').getBoundingClientRect();return box.top>=body.top&&box.bottom<=body.bottom&&score.bottom<=body.bottom&&box.height<=parseFloat(getComputedStyle(name).lineHeight)+1;});
   }),true,'all six faction names and progress values visible with single-line names');
   assert.equal(await page.getByRole('button',{name:'查看排行',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'同步进度',exact:true}).isDisabled(),true);assert.match(await status(page).innerText(),/TapTap/);
   await reachable(page.getByRole('button',{name:'关闭',exact:true}));await shot(page,`${width}-no-host-campaign`);
   await touchScrollEnd(page);await shot(page,`${width}-campaign-touch-scroll`);
   await page.evaluate(()=>{
    window.__collectionFrames=[];let remaining=40;
    const sample=()=>{const score=document.querySelector('.platform-progress-score'),body=score?.closest('.platform-progress-body'),dialog=body?.closest('dialog');
     if(document.querySelector('#platform-progress-title')?.textContent==='收集榜')window.__collectionFrames.push({scoreTop:score.getBoundingClientRect().top,scoreBottom:score.getBoundingClientRect().bottom,bodyTop:body.getBoundingClientRect().top,bodyBottom:body.getBoundingClientRect().bottom,bodyScrollTop:body.scrollTop,dialogScrollTop:dialog.scrollTop});
     if(--remaining)requestAnimationFrame(sample);
    };requestAnimationFrame(sample);
   });
   await page.getByRole('button',{name:'收集榜',exact:true}).tap();
   await shot(page,`${width}-collection-immediate-after-swipe`);await checkCollection(page);
   const frames=await page.evaluate(()=>window.__collectionFrames);(report.collectionFrames??=[]).push({width,frames});
   assert(frames.every(frame=>frame.scoreTop>=frame.bodyTop&&frame.scoreBottom<=frame.bodyBottom),JSON.stringify(frames));
   assert.equal(await page.getByRole('button',{name:'同步收藏',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'查看排行',exact:true}).isDisabled(),true);await shot(page,`${width}-no-host-collection`);
   await page.getByRole('button',{name:'战役排行',exact:true}).tap();
   await page.getByRole('button',{name:'铁崖挑战',exact:true}).tap();assert.match(await page.locator('.platform-progress-score').innerText(),new RegExp(String(rankedRecord.bestResult.score)));
   assert.equal(await page.locator('[data-challenge-action="resume"]').isVisible(),true);assert.equal(await page.getByRole('button',{name:'查看排行',exact:true}).isDisabled(),true);await shot(page,`${width}-no-host-challenge`);await checkChallengeRules(page,width);await close(page);
   await page.locator('[data-action="achievements"]').tap();await checkAchievements(page,width);
   assert.equal(await page.getByRole('button',{name:'TapTap成就',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'同步成就',exact:true}).isDisabled(),true);
   assert.match(await page.locator('.achievement-list').innerText(),/已达成 · 待同步/);await scrollEnd(page);await shot(page,`${width}-no-host-achievements`);await close(page,'achievements');
   assert.deepEqual(await persisted(page),before,'platform UI preserves profile and challenge bytes, rewards and schema');await context.close();
  }
  if(!process.env.PLATFORM_FOCUS_COLLECTION){
   const {context,page}=await setup(width,height,{host:true}),before=await persisted(page);
   await page.waitForFunction(()=>window.__platformCalls.some(c=>c.kind==='submit'));
   assert.deepEqual(await page.evaluate(()=>window.__platformCalls.find(c=>c.kind==='submit'&&c.scores[0].leaderboardId==='fr0m7qzhn7va29tri8').scores),[{leaderboardId:'fr0m7qzhn7va29tri8',score:3}]);
   await page.locator('[data-action="leaderboard"]').tap();await page.waitForFunction(()=>document.querySelector('.platform-progress-status')?.textContent.includes('提交失败'));
   await shot(page,`${width}-campaign-failure`);await page.evaluate(()=>window.__platformFailSubmit=false);await page.getByRole('button',{name:'同步进度',exact:true}).tap();await page.waitForFunction(()=>document.querySelector('.platform-progress-status')?.textContent.includes('已同步'));
   await page.getByRole('button',{name:'查看排行',exact:true}).tap();assert.match(await status(page).innerText(),/打开失败/);await page.evaluate(()=>window.__platformFailOpen=false);await page.getByRole('button',{name:'查看排行',exact:true}).tap();assert.equal(await page.locator('#platform-progress-dialog').evaluate(el=>el.open),false);await page.locator('[data-action="leaderboard"]').tap();
   await reachable(page.getByRole('button',{name:'查看排行',exact:true}));await shot(page,`${width}-campaign-success`);
   assert.deepEqual(await page.evaluate(()=>window.__platformCalls.find(c=>c.kind==='submit'&&c.scores[0].leaderboardId==='kwas6xeb3nql1ovw5v').scores),[{leaderboardId:PLATFORM_PROGRESS_BINDING.collectionLeaderboardId,score:collectionProgressStats(progress.state).total}],'old collection automatically submits at startup');
   await page.evaluate(()=>window.__platformFailSubmit=true);await page.getByRole('button',{name:'收集榜',exact:true}).tap();await checkCollection(page);await page.waitForFunction(()=>document.querySelector('.platform-progress-status')?.textContent.includes('提交失败'));
   await shot(page,`${width}-collection-failure`);await page.evaluate(()=>window.__platformFailSubmit=false);await page.getByRole('button',{name:'同步收藏',exact:true}).tap();await page.waitForFunction(()=>document.querySelector('.platform-progress-status')?.textContent.includes('已同步'));
   const collectionCount=await page.evaluate(()=>window.__platformCalls.filter(c=>c.kind==='submit'&&c.scores[0].leaderboardId==='kwas6xeb3nql1ovw5v').length);
   await page.getByRole('button',{name:'查看排行',exact:true}).tap();assert.equal(await page.evaluate(()=>window.__platformCalls.filter(c=>c.kind==='open').at(-1).id),PLATFORM_PROGRESS_BINDING.collectionLeaderboardId);assert.equal(await page.locator('#platform-progress-dialog').evaluate(el=>el.open),false);await page.locator('[data-action="leaderboard"]').tap();await page.getByRole('button',{name:'收集榜',exact:true}).tap();await shot(page,`${width}-collection-success`);
   await page.getByRole('button',{name:'战役排行',exact:true}).tap();await page.getByRole('button',{name:'收集榜',exact:true}).tap();await checkCollection(page);await page.waitForFunction(()=>!document.querySelector('.platform-progress-actions button:not([hidden]):disabled'));
   assert.equal(await page.evaluate(()=>window.__platformCalls.filter(c=>c.kind==='submit'&&c.scores[0].leaderboardId==='kwas6xeb3nql1ovw5v').length),collectionCount,'reopening existing collection does not submit again or add score');
   assert((await page.evaluate(()=>window.__platformCalls.filter(c=>c.kind==='submit'&&c.scores[0].leaderboardId==='kwas6xeb3nql1ovw5v').map(c=>c.scores[0].score))).every(score=>score===collectionProgressStats(progress.state).total));
   await page.getByRole('button',{name:'铁崖挑战',exact:true}).tap();await page.waitForFunction(()=>document.querySelector('.platform-progress-status')?.textContent.includes('已同步'));
   assert.deepEqual(await page.evaluate(()=>window.__platformCalls.filter(c=>c.kind==='submit').at(-1).scores),[{leaderboardId:'du5ahriaooqy2yejyy',score:rankedRecord.bestResult.score}]);
   await page.getByRole('button',{name:'查看排行',exact:true}).tap();assert.equal(await page.evaluate(()=>window.__platformCalls.filter(c=>c.kind==='open').at(-1).id),'du5ahriaooqy2yejyy');assert.equal(await page.locator('#platform-progress-dialog').evaluate(el=>el.open),false);await page.locator('[data-action="leaderboard"]').tap();await page.getByRole('button',{name:'铁崖挑战',exact:true}).tap();await checkChallengeRules(page,width,'host-best-resume');await shot(page,`${width}-challenge-independent`);
   await page.getByRole('button',{name:'战役排行',exact:true}).tap();assert.match(await page.locator('.platform-progress-score').innerText(),/3 \/ 180/);await close(page);
   await page.locator('[data-action="achievements"]').tap();await page.waitForFunction(()=>document.querySelector('.platform-progress-status')?.textContent.includes('同步失败'));
   assert.match(await page.locator('.achievement-list').innerText(),/待同步/);await page.evaluate(()=>window.__platformFailAchievements=false);await page.getByRole('button',{name:'同步成就',exact:true}).tap();await page.waitForFunction(()=>document.querySelector('.platform-progress-status')?.textContent.includes('已同步'));
   const earned=localAchievements(progress.state,CONFIRMED_ACHIEVEMENTS,rankedRecord.bestResult).filter(item=>item.configured&&item.achieved);
   assert.equal(await page.locator('.achievement-list li').filter({hasText:'已同步'}).count(),earned.length,'every earned published achievement reflects confirmed mock success');
   await checkAchievements(page,width,{host:true,synced:true});await shot(page,`${width}-earned-achievements-synced`);
   assert.deepEqual(await page.evaluate(()=>[...new Set(window.__platformCalls.filter(c=>c.kind==='achievement').map(c=>c.id))].sort()),earned.map(item=>CONFIRMED_ACHIEVEMENTS[item.key]).sort());
   const nativeAchievements=page.getByRole('button',{name:'TapTap成就',exact:true});
   assert.equal(await nativeAchievements.isDisabled(),false,'confirmed published achievements expose native entry');await reachable(nativeAchievements);await nativeAchievements.tap();
   assert.equal(await page.locator('#platform-progress-dialog').evaluate(el=>el.open),false,'local modal closes before mock native achievements entry');
   assert.equal(await page.evaluate(()=>window.__platformCalls.filter(c=>c.kind==='achievement-open').length),1);
   await page.locator('[data-action="achievements"]').tap();await checkAchievements(page,width,{host:true,synced:true});
   await scrollEnd(page);await shot(page,`${width}-achievements-synced`);await close(page,'achievements');
   assert.deepEqual(await persisted(page),before,'platform UI preserves profile and challenge bytes, rewards and schema');report.checks.push(`${width}x${height}: real taps, scrolling, Escape/focus; no-host disabled controls; old three campaign clears and legal collection auto-submit; collection count/split matches saved inventory; collection failures/retry and reopening dedup; all three board IDs isolated; 53 achievement rows, four categories plus all, all eligible published achievement unlock retries, mock native achievement entry closes local modal, returned local category filtering; profile bytes unchanged`);await context.close();
  }
  if(!process.env.PLATFORM_FOCUS_COLLECTION){
   const {context,page}=await setup(width,height,{host:true,empty:true});await page.locator('[data-action="leaderboard"]').tap();assert.match(await page.locator('.platform-progress-score').innerText(),/0 \/ 180/);assert.equal(await page.getByRole('button',{name:'同步进度',exact:true}).isVisible(),false);
   assert.equal(await page.evaluate(()=>window.__platformCalls.filter(c=>c.kind==='submit'&&c.scores[0].leaderboardId==='fr0m7qzhn7va29tri8').length),0);await shot(page,`${width}-empty-campaign`);await close(page);await context.close();report.checks.push(`${width}x${height}: empty campaign has no submit and no irrelevant sync action`);
  }
  {
   const {context,page}=await setup(width,height,{noBest:true});
   await page.locator('[data-action="leaderboard"]').tap();await page.getByRole('button',{name:'铁崖挑战',exact:true}).tap();
   await checkChallengeRules(page,width,'no-best-resume');await close(page);await context.close();
  }
 }
 assert.deepEqual(report.errors,[]);
 report.designSlop={verdict:'Pending actual screenshot review by the validating agent.',evidence:report.screens,scope:'53 achievements with five category controls; local/configured earned states; four-item challenge scoring breakdown; both landscape sizes; existing three leaderboard actions',limitations:['Edge touch emulation with isolated TapTap mock; physical phone, safe-area and native host panels not verified.']};
} catch(error) {report.errors.push(String(error));throw error;}
finally {await writeFile(out+(process.env.PLATFORM_FOCUS_COLLECTION?'collection-focus-report.json':'report.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
