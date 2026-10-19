import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadProfile,STORAGE_KEY,validateProfile,DUNGEONS} from '../dist/campaign.js';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v))};
const template=loadProfile().profile;
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),out=new URL('../output/trial-bosses/browser/',import.meta.url);
await mkdir(out,{recursive:true});
const hook=`
import {__qaDamageEnemy} from './simulation.js';
window.__TRIAL_QA={manual:false,seen:new Set(),
 state(){const b=game.boss,s=b?.abilityState;return {phase:game.phase,time:game.time,player:{x:game.player.x,y:game.player.y},boss:b?{kind:b.kind,hp:b.hp,maxHp:b.maxHp,dead:b.dead,x:b.x,y:b.y,spawnDelay:b.spawnDelay,cue:b.trialCue,stage:s?.stage,move:s?.move,cycle:s?.cycle,phase:s?.phase,remaining:s?.remaining}:null,nodes:game.enemies.filter(e=>e.trialConstruct&&!e.dead).map(e=>({id:e.id,hp:e.hp,x:e.x,y:e.y})),hazards:game.enemyHazards.map(h=>({type:h.type,shape:h.shape,move:h.trialMove,ordinal:h.ordinal,remaining:h.remaining,total:h.total,x:h.x,y:h.y,radius:h.radius,inner:h.innerRadius,outer:h.outerRadius})),skills:getSkillState(game),settlement:!!settlement?.ok,win:profile.progression.dungeonWins[game.dungeon?.id]||0,unlockedJobs:profile.heroes[profile.selectedHero].unlockedJobs};},
 draw(){renderer.render(game,{width:appViewport.width,height:appViewport.height,dpr:devicePixelRatio,reducedMotion:motion.matches});syncUI();},
 protect(){game.player.invulnerable=1e6;game.player.xpNext=1e8;if(game.heroKit)game.heroKit.attackClock=1e6;game.companions=[];},
 prepare(){this.manual=true;game.time=99.98;game.mapObjects=[];game.supplies=[];game.gems=[];game._eliteWaves=3;game._nextSupplyAt=1e8;this.protect();updateGame(game,1/60,{x:0,y:0});updateGame(game,1/60,{x:0,y:0});this.protect();game.duration=10000;game.announcement={text:"",remaining:0};this.draw();return this.state();},
 step(){this.protect();updateGame(game,1/60,{x:0,y:0});},
 next(){for(let i=0;i<2400;i++){this.step();const s=this.state(),b=s.boss;if(!b||b.dead)throw Error('lost boss');if((b.cycle>=1||game.boss.abilityState.index>0)&&b.hp>b.maxHp*.45)game.boss.hp=b.maxHp*.4;
  const keys=[];if(b.spawnDelay<=0){
   if(b.cue)keys.push('cue-'+b.cue.mode);
   if(b.stage==='warning'&&b.remaining<bossDuration()*.72)keys.push('warning-'+b.move+'-p'+b.phase);
   if(b.stage==='channel'&&b.remaining<2.7)keys.push('channel-p'+b.phase);
   if(b.stage==='dash'&&b.remaining<.3&&b.remaining>.12)keys.push('dash-'+b.move+'-p'+b.phase);
   if(b.stage==='marks'&&s.hazards.filter(h=>h.type==='warning').length===3)keys.push('three-marks-p'+b.phase);
   for(const h of s.hazards)if(h.type==='impact'&&h.remaining<h.total*.72)keys.push('impact-'+h.move+'-'+(h.ordinal||0)+'-p'+b.phase);
  }const key=keys.find(k=>!this.seen.has(k));if(key){this.seen.add(key);this.draw();return {key,...s};}if(b.cycle>=2){this.draw();return {key:null,complete:true,...s};}
 }throw Error('cycle stalled');function bossDuration(){return game.boss.abilityState.total||1;}},
 success(){for(let i=0;i<1800;i++){this.step();const b=game.boss;if(b.abilityId==='trialBinder'&&game.enemies.some(e=>e.trialConstruct&&!e.dead)){for(const n of game.enemies.filter(e=>e.trialConstruct&&!e.dead))__qaDamageEnemy(game,n,300);for(let j=0;j<30;j++)this.step();this.draw();return this.state();}if(b.abilityId==='trialPrism'&&b.abilityState.stage==='channel'){__qaDamageEnemy(game,b,250);for(let j=0;j<10;j++)this.step();this.draw();return this.state();}}throw Error('success window stalled');},
 interrupt(){__qaDamageEnemy(game,game.boss,350);for(let j=0;j<30;j++)this.step();this.draw();return this.state();},
 aimChannel(){game.player.x=game.boss.x-26;game.player.y=game.boss.y;game.player.facing=1;game.skills.flameBreath.remaining=0;this.draw();},
 channelDamage(){for(let i=0;i<60;i++)this.step();this.draw();return this.state();},
 resumeLive(){this.manual=false;this.protect();},
 hold(){this.manual=true;this.draw();return this.state();},
 finish(){this.manual=false;game.duration=120;game.time=Math.max(120,game.time);game.boss.hp=1;game.boss.spawnDelay=0;game.player.x=game.boss.x-45;game.player.y=game.boss.y+5;game.player.invulnerable=1e6;if(game.heroKit)game.heroKit.attackClock=0;game.announcement={text:"",remaining:0};return this.state();}
};`;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={scope:'Isolated profiles. Actual touch navigation, movement, skill, pause and settlement. Production boss entry at time 100; protected player, suppressed auto-attacks, fixed 1/60 simulation and extended fixture duration for two cycles; low HP fixture triggers phase two. Kill uses actual auto-attack with remaining boss HP lowered to 1. Not natural runs, physical phones or TapTap host.',cases:[]};
try{
 for(const [width,height] of [[844,390],[667,320]])for(const dungeon of DUNGEONS.filter(d=>d.id.endsWith('-trial'))){
  const p=structuredClone(template);p.cleared=['moss-gate'];p.progression.dungeonWins={'moss-gate':1};
  p.selectedHero=({'summoner-trial':'summoner','blink-trial':'blink','mage-trial':'mage'})[dungeon.id]||'commander';p.heroes[p.selectedHero].level=3;assert(validateProfile(p));
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:height===320?'reduce':'no-preference'});
  await context.addInitScript(({key,profile})=>localStorage.setItem(key,JSON.stringify(profile)),{key:STORAGE_KEY,profile:p});
  await context.route('**/main.js',async route=>{const response=await route.fetch();let body=await response.text();body=body.replace('updateGame(game,dt,x||y?{x,y}:stick?movement:{x:0,y:0});','if(!window.__TRIAL_QA?.manual)updateGame(game,dt,x||y?{x,y}:stick?movement:{x:0,y:0});');await route.fulfill({response,body:body+hook});});
  // Export the existing damage function in the isolated response only; success
  // probes traverse real damage, ownership cleanup and interruption logic.
  await context.route('**/simulation.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nexport {damageEnemy as __qaDamageEnemy};'});});
  const page=await context.newPage(),errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push({url:r.url(),status:r.status()});});
  await page.goto('http://127.0.0.1:4178/');await page.locator('[data-tab="map"]').tap();await page.locator(`[data-dungeon="${dungeon.id}"]`).tap();await page.locator('[data-action="depart"]').tap();
  await page.waitForFunction(()=>window.__TRIAL_QA?.state().phase==='playing');
  const entry=await page.evaluate(()=>window.__TRIAL_QA.prepare());assert.equal(entry.boss.kind,dungeon.boss.kind);
  const captures=[];let channelProgress=null;
  for(let i=0;i<55;i++){
   const state=await page.evaluate(()=>window.__TRIAL_QA.next());if(state.complete)break;
   const screenshot=fileURLToPath(new URL(`${dungeon.id}-${width}-${state.key}.png`,out));await page.screenshot({path:screenshot});captures.push({...state,screenshot});
   if(dungeon.id==='mage-trial'&&state.key==='channel-p1'){
    await page.evaluate(()=>window.__TRIAL_QA.aimChannel());await page.locator('[data-skill="flameBreath"]').tap();
    channelProgress=await page.evaluate(()=>window.__TRIAL_QA.channelDamage());assert(channelProgress.boss.cue?.progress>0||channelProgress.boss.cue?.mode==='exposed');
    const progressScreenshot=fileURLToPath(new URL(`mage-trial-${width}-channel-damage.png`,out));await page.screenshot({path:progressScreenshot});channelProgress.screenshot=progressScreenshot;
   }
  }
  assert(captures.length>=5);const final=await page.evaluate(()=>window.__TRIAL_QA.state());assert(final.boss.cycle>=2);assert.equal(final.boss.phase,2);
  const keys=captures.map(c=>c.key);
  if(dungeon.id==='blade-trial'){assert(keys.includes('cue-guard'));assert(keys.includes('cue-exposed'));}
  if(dungeon.id==='swift-trial')assert(keys.some(k=>k.startsWith('dash-thirdDash-p2')));
  if(dungeon.id==='summoner-trial')assert(captures.some(c=>c.nodes.length===2));
  if(dungeon.id==='blink-trial')assert(keys.includes('three-marks-p1'));
  if(dungeon.id==='mage-trial'){assert(keys.includes('channel-p1'));assert(captures.some(c=>c.hazards.some(h=>h.shape==='ring'&&h.inner>0)));}
  let success=null;
  if(width===844&&['summoner-trial','mage-trial'].includes(dungeon.id)){
   success=await page.evaluate(()=>window.__TRIAL_QA.success());
   if(dungeon.id==='mage-trial'){
    assert.equal(success.boss.cue.mode,'channel');assert(success.boss.cue.progress>=.5);
    const progressScreenshot=fileURLToPath(new URL('mage-trial-844-channel-half.png',out));await page.screenshot({path:progressScreenshot});
    const partial=success;success=await page.evaluate(()=>window.__TRIAL_QA.interrupt());success.partial=partial;success.progressScreenshot=progressScreenshot;
   }else assert.equal(success.nodes.length,0);
   assert.equal(success.boss.cue.mode,'exposed');assert.equal(success.hazards.filter(h=>h.type==='warning').length,0);
   const successScreenshot=fileURLToPath(new URL(`${dungeon.id}-844-success-exposed.png`,out));await page.screenshot({path:successScreenshot});success.screenshot=successScreenshot;
  }
  await page.evaluate(()=>window.__TRIAL_QA.resumeLive());
  const before=await page.evaluate(()=>window.__TRIAL_QA.state().player),cdp=await context.newCDPSession(page),point={x:90,y:height-75,id:1};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:point.x+65}]});await page.waitForTimeout(300);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const moved=await page.evaluate(b=>{const p=window.__TRIAL_QA.state().player;return Math.hypot(p.x-b.x,p.y-b.y);},before);assert(moved>20);
  const firstSkill=page.locator('.skill-button').first(),skillId=await firstSkill.getAttribute('data-skill');await firstSkill.tap();await page.waitForTimeout(80);const skillState=await page.evaluate(()=>window.__TRIAL_QA.state());assert(skillState.skills.find(s=>s.id===skillId).remaining>0);
  await page.locator('#pause').tap();await page.locator('#pause-dialog[open]').waitFor();const frozen=await page.evaluate(()=>window.__TRIAL_QA.state());await page.waitForTimeout(180);assert.deepEqual(await page.evaluate(()=>window.__TRIAL_QA.state().boss),frozen.boss);assert.equal(await page.evaluate(()=>window.__TRIAL_QA.state().time),frozen.time);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__TRIAL_QA.state().phase==='playing');
  await page.evaluate(()=>window.__TRIAL_QA.finish());await page.waitForFunction(()=>window.__TRIAL_QA.state().phase==='victory',null,{timeout:15000});await page.locator('#result-dialog[open]').waitFor();
  const victory=await page.evaluate(()=>window.__TRIAL_QA.state());assert(victory.boss.dead);assert.equal(victory.win,1);assert(victory.settlement);assert.equal(victory.nodes.length,0);assert.equal(victory.hazards.length,0);
  const resultScreenshot=fileURLToPath(new URL(`${dungeon.id}-${width}-victory.png`,out));await page.screenshot({path:resultScreenshot});
  await page.locator('#result-home').tap();await page.locator('[data-tab="quests"]').tap();
  const [questId,jobId]=({'blade-trial':['job-blade','blade_master'],'swift-trial':['job-swift','swift_blade'],'summoner-trial':['job-summoner','summoner_master'],'blink-trial':['job-blink','blink_master'],'mage-trial':['job-mage','mage_master']})[dungeon.id];
  const claim=page.locator(`[data-claim="${questId}"]`);assert(await claim.isEnabled());await claim.tap();
  const unlocked=await page.evaluate(()=>window.__TRIAL_QA.state().unlockedJobs);assert(unlocked.includes(jobId));
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);report.cases.push({id:dungeon.id,width,height,entry,captures,channelProgress,success,final,moved,skillId,skillVerified:true,pauseVerified:true,victory,resultScreenshot,jobUnlock:{questId,jobId,unlocked},errors,missing});
  await writeFile(new URL('report.json',out),JSON.stringify(report,null,2)+'\n');console.log(`${dungeon.id} ${width}: ${captures.length} scenes, cycles ${final.boss.cycle}, touch ${moved.toFixed(1)}, skill ${skillId}, victory`);await context.close();
 }
}finally{await browser.close();}




