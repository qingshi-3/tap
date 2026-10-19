import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const label=process.argv[2]??'baseline';
const cpuRate=Number(process.argv[3]??1);
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,deviceScaleFactor:2,reducedMotion:'no-preference'});
const page=await context.newPage(),errors=[];
if(cpuRate>1){const session=await context.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});}page.on('pageerror',e=>errors.push(String(e)));
if(process.argv.includes('--baseline-source')) await page.route(/\/js\/(main|renderer|effects-player|atlas)\.js$/,async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);await route.fulfill({contentType:'text/javascript',body:await readFile(`games/duelyst-h5/output/perf-baseline/${name}`,'utf8')});});
await page.addInitScript(async()=>{
 window.__perf={bufferStarts:[],samples:{},sounds:[],media:[],reads:[],canvases:0,active:false,frames:[],last:0};
 const p=window.__perf;
 const create=document.createElement.bind(document);document.createElement=function(tag,...args){if(p.active&&tag==='canvas')p.canvases++;return create(tag,...args);};
 const read=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(...args){const t=performance.now();const r=read.apply(this,args);if(p.active)p.reads.push(performance.now()-t);return r;};
 const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){const t=performance.now();const result=start.apply(this,args);if(p.active)p.bufferStarts.push({at:t,contextState:this.context.state});return result;};
 const media=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){const t=performance.now();const path=this.src;const result=media.apply(this,args);result?.then(()=>{if(p.active)p.media.push({path,delay:performance.now()-t});}).catch(()=>{});return result;};
 const {BoardRenderer}=await import('/js/renderer.js');const {EffectsPlayer}=await import('/js/effects-player.js');
 for(const [type,names] of [[BoardRenderer,['paint','cardIdleLayout','drawCardIdle']],[EffectsPlayer,['drawRecipe','drawParticles','drawPersistent']]])for(const name of names){const orig=type.prototype[name];type.prototype[name]=function(...args){const t=performance.now();const result=orig.apply(this,args);if(p.active)(p.samples[name]??=[]).push(performance.now()-t);return result;};}
 const draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__renderer=this;return draw.apply(this,args);};
 const sound=EffectsPlayer.prototype.playSound;EffectsPlayer.prototype.playSound=function(symbol){if(p.active)p.sounds.push({symbol,at:performance.now()});return sound.call(this,symbol);};
 const play=EffectsPlayer.prototype.play;EffectsPlayer.prototype.play=function(...args){const t=performance.now();const result=play.apply(this,args);if(p.active){p.actionBuild=performance.now()-t;p.timeline=this.playback?.entries.filter(e=>e.kind==='body').map(e=>({unitId:e.unit.unitId,state:e.state,at:e.at,duration:e.animationDuration}));}return result;};
 function tick(now){if(p.active&&!p.pauseFrames){if(p.last)p.frames.push(now-p.last);p.last=now;}else p.last=0;requestAnimationFrame(tick);}requestAnimationFrame(tick);
});
await page.goto('http://127.0.0.1:4197');
await page.evaluate(async()=>{
 const {ExpeditionProgress}=await import('/js/expedition-progress.js'),{createExpeditionMatch}=await import('/js/engine.js');
 const progress=new ExpeditionProgress(localStorage);const s=createExpeditionMatch('border-01',progress.state.training,progress.state.squad);
 const own=s.units.find(u=>u.owner===0&&u.cardId===14),enemy=s.units.find(u=>u.owner===1&&u.cardId===14);own.x=3;own.y=2;enemy.x=4;enemy.y=2;
 s.players[0].hand=[11,14,20066];s.players[0].mana=s.players[0].maxMana=9;
 const saved=progress.saveBattle(s);if(!saved.ok)throw Error(saved.error);
});
await page.reload();await page.locator('[data-action=resume]').tap();await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__renderer?.ready);
async function point(x,y){return page.evaluate(({x,y})=>{const r=window.__renderer,b=r.canvas.getBoundingClientRect(),p=r.cellGeometry(r.boardMetrics(b.width,b.height),x,y).center;return {x:b.left+p.x,y:b.top+p.y};},{x,y});}
async function reset(){await page.evaluate(()=>{const p=window.__perf;p.samples={};p.sounds=[];p.media=[];p.bufferStarts=[];p.reads=[];p.canvases=0;p.frames=[];p.last=0;p.active=true;});}
async function collect(name){return page.evaluate(name=>{const p=window.__perf;p.active=false;const stats=a=>{const b=[...a].sort((x,y)=>x-y);return {count:a.length,total:a.reduce((x,y)=>x+y,0),p50:b[Math.floor(b.length*.5)]??0,p95:b[Math.floor(b.length*.95)]??0,max:b.at(-1)??0};};return {name,samples:Object.fromEntries(Object.entries(p.samples).map(([k,v])=>[k,stats(v)])),frames:stats(p.frames),reads:stats(p.reads),canvases:p.canvases,sounds:p.sounds,media:p.media,bufferStarts:p.bufferStarts.map(start=>({...start,callToStart:start.at-(p.sounds.filter(sound=>sound.at<=start.at).at(-1)?.at??start.at)})),actionBuild:p.actionBuild,timeline:p.timeline,audio:{decodedBytes:window.__renderer.effects.audioBytes??null,decodedBuffers:window.__renderer.effects.audioBuffers?.size??null,pending:window.__renderer.effects.audioJobs?.size??null,mediaVoices:window.__renderer.effects.mediaVoiceCount??null,context:window.__renderer.effects.audioContext?.state??null}};},name);}
const results=[];
await reset();await page.waitForTimeout(1200);results.push(await collect('idle'));
const src=await point(3,2),target=await point(4,2);
await reset();await page.touchscreen.tap(src.x,src.y);await page.touchscreen.tap(target.x,target.y);await page.waitForFunction(()=>window.__renderer.effects.playback?.action.kind==='attack');
await page.evaluate(()=>window.__perf.pauseFrames=true);await page.screenshot({path:`games/duelyst-h5/output/playwright/perf-${label}-attack.png`});await page.evaluate(()=>{window.__perf.pauseFrames=false;window.__perf.last=0;});
await page.waitForFunction(()=>!window.__renderer.effects.playback,{timeout:15000});results.push(await collect('attack-cold'));
// Same living pair, second attack only as a disposable saved fixture with turn flags reset.
await page.evaluate(()=>{const r=window.__renderer;const u=r.state.units.find(u=>u.owner===0&&u.cardId===14);u.attacked=false;});
await reset();await page.touchscreen.tap(src.x,src.y);await page.touchscreen.tap(target.x,target.y);await page.waitForFunction(()=>window.__renderer.effects.playback?.action.kind==='attack');await page.waitForFunction(()=>!window.__renderer.effects.playback,{timeout:15000});results.push(await collect('attack-hot'));
await reset();await page.locator('.hand-card').first().tap();const drop=await point(1,1);await page.touchscreen.tap(drop.x,drop.y);await page.waitForFunction(()=>window.__renderer.effects.playback?.action.kind==='summon');
await page.evaluate(()=>window.__perf.pauseFrames=true);await page.screenshot({path:`games/duelyst-h5/output/playwright/perf-${label}-summon.png`});await page.evaluate(()=>{window.__perf.pauseFrames=false;window.__perf.last=0;});
await page.waitForFunction(()=>!window.__renderer.effects.playback,{timeout:15000});results.push(await collect('summon-cold'));
await reset();await page.locator('#end-turn').tap();await page.waitForFunction(()=>window.__renderer.state.currentPlayer===0||window.__renderer.state.phase==='over',null,{timeout:30000});results.push(await collect('enemy-turn'));
await mkdir('games/duelyst-h5/output/playwright',{recursive:true});
await writeFile(`games/duelyst-h5/output/playwright/perf-${label}.json`,JSON.stringify({label,environment:{browser:await browser.version(),viewport:'844x390',dpr:2,headless:true,throttle:cpuRate},results,errors},null,2));
console.log(JSON.stringify(results.map(r=>({name:r.name,paint:r.samples.paint,frames:r.frames,reads:r.reads,canvases:r.canvases,build:r.actionBuild,timeline:r.timeline})),null,2));
assert.deepEqual(errors,[]);await browser.close();
