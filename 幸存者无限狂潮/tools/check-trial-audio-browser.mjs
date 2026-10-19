import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadProfile,STORAGE_KEY,validateProfile,DUNGEONS} from '../dist/campaign.js';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v))};
const template=loadProfile().profile;
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),out=new URL(process.env.TRIAL_AUDIO_QA_OUTPUT==='foley'?'../output/trial-audio-rework/browser/':'../output/trial-audio/browser/',import.meta.url);
await mkdir(out,{recursive:true});
const names={
 'blade-trial':['trialShieldReady','trialShieldSlash'],
 'swift-trial':['trialWindCharge','trialWindDash','trialWindLand'],
 'summoner-trial':['trialSoulBind','trialSoulPulse','trialSoulBreak'],
 'blink-trial':['trialRiftMark','trialRiftBurst','trialRiftCut'],
 'mage-trial':['trialPrismIn','trialPrismOut','trialPrismCharge','trialPrismBreak'],
};
const hook=`
import {__qaDamageEnemy} from './simulation.js';
window.__TRIAL_AUDIO_QA={manual:false,maximumVoices:0,perFrameStarts:0,frames:[],
 state(){const b=game.boss,s=b?.abilityState;return {phase:game.phase,time:game.time,boss:b?{kind:b.kind,hp:b.hp,x:b.x,y:b.y,spawnDelay:b.spawnDelay,stage:s?.stage,move:s?.move,cycle:s?.cycle,cue:b.trialCue}:null,nodes:game.enemies.filter(e=>e.trialConstruct&&!e.dead).map(e=>({id:e.id,hp:e.hp,x:e.x,y:e.y})),hazards:game.enemyHazards.map(h=>({type:h.type,move:h.trialMove,remaining:h.remaining,ordinal:h.ordinal})),audio:audioEngine.diagnostics,enabled:audioEngine.enabled};},
 protect(){game.player.invulnerable=1e6;game.player.xpNext=1e8;game.companions=[];if(game.heroKit)game.heroKit.attackClock=1e6;},
 prepare(){this.manual=true;this.protect();game.time=99.98;game._eliteWaves=3;game._nextSupplyAt=1e8;game.mapObjects=[];game.gems=[];game.supplies=[];for(let i=0;i<2;i++)updateGame(game,1/60,{x:0,y:0});game.duration=10000;game.announcement={text:'',remaining:0};return this.state();},
 tick(){this.protect();for(let i=0;i<5;i++)updateGame(game,1/60,{x:0,y:0});return this.state();},
 breakNodes(){for(const n of game.enemies.filter(e=>e.trialConstruct&&!e.dead))__qaDamageEnemy(game,n,300);this.protect();updateGame(game,1/60,{x:0,y:0});return this.state();},
 interrupt(){__qaDamageEnemy(game,game.boss,550);return this.state();},
 // A damage threshold probe uses the production damage callback, never a
 // manually emitted sound or fabricated state/cue.
 halfChannel(){__qaDamageEnemy(game,game.boss,250);return this.state();},
 metrics(){return {maximumVoices:this.maximumVoices,maximumPerFrameStarts:window.__AUDIO_CAPTURE.maxPerFrameStarts,rawMaximumSources:window.__AUDIO_CAPTURE.maxActive,starts:window.__AUDIO_CAPTURE.starts};},
 record(){const c=window.__AUDIO_CAPTURE,stream=document.querySelector('#battle').captureStream(20);for(const t of c.target.stream.getAudioTracks())stream.addTrack(t);const chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus'});recorder.ondataavailable=e=>chunks.push(e.data);window.__trialRecording={recorder,chunks};recorder.start();},
 async recording(){const v=window.__trialRecording;await new Promise(r=>{v.recorder.onstop=r;v.recorder.stop();});return Array.from(new Uint8Array(await new Blob(v.chunks,{type:v.recorder.mimeType}).arrayBuffer()));},
};
function audioMetrics(){const q=window.__TRIAL_AUDIO_QA;q.maximumVoices=Math.max(q.maximumVoices,audioEngine.diagnostics.voices);requestAnimationFrame(audioMetrics);}requestAnimationFrame(audioMetrics);
`;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={scope:'Disposable local profiles; real touch navigation and sound/pause controls. Production simulation advanced in five 1/60 steps with 90 ms wall-clock waits, protected player, time jump to boss entry, suppressed auto-attacks and extended duration. Production damage callback breaks nodes and interrupts channel. Captured actual WebAudio compressor output with rendered canvas. No fabricated play calls. Not subjective listening, natural-run difficulty, physical-phone performance or TapTap host acceptance.',cases:[]};
const trialCounts=ds=>Object.fromEntries(Object.entries(ds.startedByName).filter(([key])=>key.startsWith('trial')));
try{
 for(const dungeon of DUNGEONS.filter(d=>d.id.endsWith('-trial'))){
  const width=dungeon.id==='blink-trial'?667:844,height=width===667?320:390;
  const p=structuredClone(template);p.cleared=['moss-gate'];p.progression.dungeonWins={'moss-gate':1};p.selectedHero=({'summoner-trial':'summoner','blink-trial':'blink','mage-trial':'mage'})[dungeon.id]||'commander';p.heroes[p.selectedHero].level=3;assert(validateProfile(p));
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:height===320?'reduce':'no-preference'});
  await context.addInitScript(({key,profile})=>localStorage.setItem(key,JSON.stringify(profile)),{key:STORAGE_KEY,profile:p});
  await context.addInitScript(()=>{
   const q=window.__AUDIO_CAPTURE={active:new Set(),maxActive:0,maxPerFrameStarts:0,perFrameStarts:0,starts:[],target:null};
   const connect=AudioNode.prototype.connect;
   AudioNode.prototype.connect=function(dest,...args){const result=connect.call(this,dest,...args);if(dest===this.context.destination&&!q.target){q.target=this.context.createMediaStreamDestination();connect.call(this,q.target);}return result;};
   const start=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...args){q.active.add(this);q.maxActive=Math.max(q.maxActive,q.active.size);q.perFrameStarts++;q.maxPerFrameStarts=Math.max(q.maxPerFrameStarts,q.perFrameStarts);q.starts.push({at:performance.now(),duration:this.buffer?.duration||0,active:q.active.size});this.addEventListener('ended',()=>q.active.delete(this),{once:true});return start.apply(this,args);};
   function frame(){q.perFrameStarts=0;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  });
  await context.route('**/main.js',async route=>{const response=await route.fetch();let body=await response.text();body=body.replace('updateGame(game,dt,x||y?{x,y}:stick?movement:{x:0,y:0});','if(!window.__TRIAL_AUDIO_QA?.manual)updateGame(game,dt,x||y?{x,y}:stick?movement:{x:0,y:0});');await route.fulfill({response,body:body+hook});});
  await context.route('**/simulation.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nexport {damageEnemy as __qaDamageEnemy};'});});
  const page=await context.newPage(),errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push({url:r.url(),status:r.status()});});
  await page.goto('http://127.0.0.1:4178/');await page.locator('[data-tab="map"]').tap();await page.locator(`[data-dungeon="${dungeon.id}"]`).tap();await page.locator('[data-action="depart"]').tap();await page.waitForFunction(()=>window.__TRIAL_AUDIO_QA?.state().phase==='playing');
  await page.locator('#sound').tap();await page.waitForFunction(()=>window.__TRIAL_AUDIO_QA.state().enabled&&window.__TRIAL_AUDIO_QA.state().audio.decoded===24);assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');
  const decoded=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.state().audio);assert.equal(decoded.samples,24);assert.equal(decoded.decoded,24);assert.deepEqual(decoded.decodeErrors,{});
  const entry=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.prepare());assert.equal(entry.boss.kind,dungeon.boss.kind);
  const recording=dungeon.id==='mage-trial';if(recording)await page.evaluate(()=>window.__TRIAL_AUDIO_QA.record());
  const captures=[],seen=new Set();let shattered=false,interrupted=false,half=false,phaseProbe=false,pauseChecked=false,muteChecked=false;
  for(let i=0;i<650;i++){
   let state=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.tick());await page.waitForTimeout(90);state=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.state());
   assert.equal(state.phase,'playing');assert(state.audio.voices<=4);
   const b=state.boss,signature=b.stage+'-'+b.move;
   if(b.spawnDelay<=0&&b.stage!=='idle'&&!seen.has(signature)){
    seen.add(signature);const screenshot=fileURLToPath(new URL(`${dungeon.id}-${width}-${signature}.png`,out));await page.screenshot({path:screenshot});captures.push({signature,...state,screenshot});
   }
   if(!pauseChecked&&Object.values(trialCounts(state.audio)).some(n=>n>0)&&b.stage==='warning'){
    const before=trialCounts(state.audio);await page.locator('#pause').tap();await page.locator('#pause-dialog[open]').waitFor();await page.waitForTimeout(160);
    const paused=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.state());assert.equal(paused.audio.voices,0);assert.equal(paused.phase,'paused');assert.equal(paused.time,state.time);
    await page.keyboard.press('Escape');await page.waitForTimeout(150);const resumed=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.state());assert.equal(resumed.phase,'playing');assert.deepEqual(trialCounts(resumed.audio),before);pauseChecked=true;
   }
   if(dungeon.id==='summoner-trial'&&b.cycle>=1&&state.nodes.length===2&&!shattered){
    await page.waitForTimeout(400);
    state=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.breakNodes());await page.waitForTimeout(160);state=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.state());assert.equal(state.nodes.length,0);assert.equal(state.boss.cue.mode,'exposed');assert(state.audio.startedByName.trialSoulBreak>0);shattered=true;
    const screenshot=fileURLToPath(new URL('summoner-trial-node-break.png',out));await page.screenshot({path:screenshot});captures.push({signature:'actual-node-break',...state,screenshot});
   }
   if(dungeon.id==='mage-trial'&&b.stage==='channel'&&!half){state=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.halfChannel());assert.equal(state.boss.cue.progress,.5);half=true;await page.waitForTimeout(330);}
   if(dungeon.id==='mage-trial'&&b.stage==='channel'&&half&&!interrupted){
    state=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.interrupt());await page.waitForTimeout(180);state=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.state());assert.equal(state.boss.cue.mode,'exposed');assert(state.audio.startedByName.trialPrismBreak>0);assert(!state.hazards.some(h=>h.type==='warning'));interrupted=true;
    const screenshot=fileURLToPath(new URL('mage-trial-interrupted.png',out));await page.screenshot({path:screenshot});captures.push({signature:'actual-interruption',...state,screenshot});
   }
   // Pause resume during a live warning is an event-lifetime check. A mute
   // toggle later checks all voices stop and re-enabling does not replay it.
   if(!muteChecked&&b.cycle>=1&&b.stage==='warning'){
    await page.locator('#sound').tap();await page.waitForTimeout(120);const muted=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.state());assert.equal(muted.enabled,false);assert.equal(muted.audio.voices,0);const before=trialCounts(muted.audio);
    await page.locator('#sound').tap();await page.waitForFunction(()=>window.__TRIAL_AUDIO_QA.state().enabled);await page.waitForTimeout(140);assert.deepEqual(trialCounts((await page.evaluate(()=>window.__TRIAL_AUDIO_QA.state())).audio),before);muteChecked=true;
   }
   const counts=state.audio.startedByName,allNames=names[dungeon.id].every(name=>(counts[name]||0)>0);
   if(allNames&&b.cycle>=2&&pauseChecked&&muteChecked){phaseProbe=true;break;}
   if(i>0&&i%180===0)console.log(`${dungeon.id}: tick ${i}, cycle ${b.cycle}, sounds ${Object.keys(trialCounts(state.audio)).join(',')}`);
  }
  assert(phaseProbe,`${dungeon.id}: expected complete real audio cycle/pause/mute`);assert(pauseChecked);assert(muteChecked);
  const final=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.state()),metrics=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.metrics());assert(metrics.maximumVoices<=4);assert(metrics.maximumPerFrameStarts<=4);for(const name of names[dungeon.id])assert(final.audio.startedByName[name]>0,name);
  let media=null;if(recording){const bytes=await page.evaluate(()=>window.__TRIAL_AUDIO_QA.recording());media=fileURLToPath(new URL('prism-interruption-mix.webm',out));await writeFile(media,Buffer.from(bytes));assert(bytes.length>10000);}
  await page.locator('#sound').tap();await page.waitForTimeout(130);assert.equal((await page.evaluate(()=>window.__TRIAL_AUDIO_QA.state())).audio.voices,0);
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);report.cases.push({id:dungeon.id,width,height,entry,decoded,captures,shattered,interrupted,pauseChecked,muteChecked,final,metrics,media,errors,missing});await writeFile(new URL('report.json',out),JSON.stringify(report,null,2)+'\n');console.log(`${dungeon.id}: 24 decoded, ${Object.keys(trialCounts(final.audio)).length} trial cues, maximum ${metrics.maximumVoices} voices, pause/mute passed`);await context.close();
 }
}finally{await browser.close();}
