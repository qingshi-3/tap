import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const ROOT=path.resolve(import.meta.dirname,'..'),CAPTURE_ROOT=path.join(ROOT,'output/gameplay-recording');
const take=process.argv[2]||'';
if(take&&!/^[a-z0-9-]+$/.test(take))throw Error('Recording take must be a lowercase filename slug');
const OUT=take?path.join(CAPTURE_ROOT,take):CAPTURE_ROOT,FRAMES=path.join(OUT,'frames');
await mkdir(FRAMES,{recursive:true});await mkdir(path.join(ROOT,'media'),{recursive:true});
const report={scope:'Isolated local H5 browser recording. Real CDP touch input, unmodified gameplay and fresh storage. Read-only combat observation; no health, spawns, cooldown or time changes.',viewport:{width:1280,height:720},inputs:[],samples:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
let context;
try{
 context=await browser.newContext({viewport:report.viewport,hasTouch:true,isMobile:true,deviceScaleFactor:1,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'});
 // The recording harness duplicates the existing mixed game output; it supplies no sounds.
 await context.addInitScript(()=>{
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination,...args){
   const result=connect.call(this,destination,...args);
   if(destination===this.context.destination){
    const target=this.context.createMediaStreamDestination();connect.call(this,target);
    window.__audioCapture={target,context:this.context};
   }
   return result;
  };
 });
 await context.route('**/main.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.__RECORD_READ=()=>({phase:game.phase,time:game.time,hp:game.player.hp,kills:game.kills,level:game.player.level,x:game.player.x,y:game.player.y,enemies:game.enemies.filter(e=>!e.dead&&e.hp>0).map(e=>({x:e.x,y:e.y})),anchors:(game.heroState?.blinkAnchors||[]).map(a=>({x:a.x,y:a.y,remaining:a.remaining}))});'});});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:4178/');await page.locator('.campaign-shell:not(.is-hidden)').waitFor({timeout:35000});
 await page.locator('[data-tab="hero"]').click();await page.locator('[data-hero="blink"]').click();await page.locator('[data-tab="map"]').click();await page.locator('[data-action="depart"]').click();
 await page.waitForFunction(()=>window.__RECORD_READ().phase==='playing');await page.locator('#sound').click();
 await page.waitForFunction(()=>window.__audioCapture?.context.state==='running');
 const audioStarted=await page.evaluate(()=>{const a=window.__audioCapture;a.parts=[];a.recorder=new MediaRecorder(a.target.stream,{mimeType:'audio/webm;codecs=opus'});a.recorder.ondataavailable=e=>{if(e.data.size)a.parts.push(e.data)};a.recorder.start();return Date.now()/1000;});
 const cdp=await context.newCDPSession(page),frames=[],writes=[];
 cdp.on('Page.screencastFrame',event=>{
  const index=frames.length,name=`frame-${String(index).padStart(5,'0')}.jpg`;
  frames.push({name,time:event.metadata.timestamp});writes.push(writeFile(path.join(FRAMES,name),Buffer.from(event.data,'base64')));
  void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
 });
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:720,everyNthFrame:3});
 let touch=null,lastCast={markBlade:-10,blinkStrike:-10,blinkStorm:-30},lastDirection={x:1,y:0};
 const origin={x:115,y:620,id:1};
 async function move(dx,dy){const length=Math.hypot(dx,dy)||1;lastDirection={x:dx/length,y:dy/length};if(!touch){touch={...origin};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});}touch={...origin,x:origin.x+lastDirection.x*38,y:origin.y+lastDirection.y*38};await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch]});}
 async function release(){if(touch){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});touch=null;}}
 async function skill(id,dx,dy){const box=await page.locator(`[data-skill="${id}"]`).boundingBox();if(!box)return;const len=Math.hypot(dx,dy)||1,second={x:box.x+box.width/2,y:box.y+box.height/2,id:2},released={...second,x:second.x+dx/len*42,y:second.y+dy/len*42};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[...(touch?[touch]:[]),second]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[...(touch?[touch]:[]),released]});await page.waitForTimeout(70);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[released]});report.inputs.push({action:id,at:(Date.now()/1000-audioStarted)});}
 const started=Date.now();let sampleAt=0;
 while(Date.now()-started<55000){
  const s=await page.evaluate(()=>window.__RECORD_READ());
  if(Date.now()-sampleAt>1000){report.samples.push({wall:(Date.now()-started)/1000,...s,enemies:s.enemies.length});sampleAt=Date.now();}
  if(['defeat','victory'].includes(s.phase)){report.outcome=s.phase;await release();await page.waitForTimeout(1000);break;}
  if(s.phase==='upgrade'){
   await page.waitForTimeout(500);
   // Choose an actual available card, favouring a common ability so the film shows both axes.
   const cards=page.locator('#upgrade-choices button');const options=await cards.allTextContents();let choice=options.findIndex(t=>/通用能力|生命|体魄/.test(t));if(choice<0)choice=0;
   const box=await cards.nth(choice).boundingBox(),finger={x:box.x+box.width/2,y:box.y+box.height/2,id:2};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[...(touch?[touch]:[]),finger]});await page.waitForTimeout(80);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[finger]});report.inputs.push({action:'upgrade',choice:options[choice],at:(Date.now()/1000-audioStarted)});await page.waitForTimeout(350);continue;
  }
  if(s.phase==='playing'){
   // Ordinary kiting by continuous thumb input. Observation only chooses where to drag.
   const angle=s.time*.055,waypoint={x:900+Math.cos(angle)*320,y:900+Math.sin(angle)*280};
   let dx=(waypoint.x-s.x)*.015,dy=(waypoint.y-s.y)*.015;
   for(const e of s.enemies){const ex=s.x-e.x,ey=s.y-e.y,d=Math.hypot(ex,ey);if(d>0&&d<145){dx+=ex/d*(145-d)*.08;dy+=ey/d*(145-d)*.08;}}
   await move(dx,dy);
   const near=[...s.enemies].sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
   if(s.time-lastCast.markBlade>2.6){await skill('markBlade',near?near.x-s.x:dx,near?near.y-s.y:dy);lastCast.markBlade=s.time;}
   else if(s.anchors.length>=2&&s.time-lastCast.blinkStorm>20){await skill('blinkStorm',dx,dy);lastCast.blinkStorm=s.time;}
   else if(s.anchors.length&&s.time-lastCast.blinkStrike>6.5){const a=s.anchors[s.anchors.length-1];await skill('blinkStrike',a.x-s.x,a.y-s.y);lastCast.blinkStrike=s.time;}
  }
  await page.waitForTimeout(160);
 }
 await release();await cdp.send('Page.stopScreencast');await Promise.all(writes);
 const audioBase64=await page.evaluate(async()=>{const a=window.__audioCapture;await new Promise(resolve=>{a.recorder.onstop=resolve;a.recorder.stop()});const bytes=new Uint8Array(await new Blob(a.parts,{type:'audio/webm'}).arrayBuffer());let result='';for(let i=0;i<bytes.length;i+=32768)result+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(result);});
 await writeFile(path.join(OUT,'original-audio.webm'),Buffer.from(audioBase64,'base64'));
 if(frames.length<15)throw Error('Insufficient captured frames');
 const duration=frames.at(-1).time-frames[0].time;
 const concat=frames.map((f,i)=>`file 'frames/${f.name}'\nduration ${Math.max(.001,(frames[i+1]?.time??f.time+.04)-f.time).toFixed(6)}`).join('\n')+`\nfile 'frames/${frames.at(-1).name}'\n`;
 await writeFile(path.join(OUT,'frames.txt'),concat);
 report.capture={frames:frames.length,durationSeconds:duration,firstFrameEpoch:frames[0].time,audioStartedEpoch:audioStarted,audioTrimSeconds:Math.max(0,frames[0].time-audioStarted),frameRateMeasured:frames.length/duration};
 await writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
 const ffmpeg=path.join(CAPTURE_ROOT,'tooling/node_modules/ffmpeg-static/ffmpeg.exe'),target=path.join(ROOT,'media',take?`pixel-survivor-gameplay-${take}.mp4`:'pixel-survivor-gameplay-0.12.0.mp4');
 const run=spawnSync(ffmpeg,['-hide_banner','-y','-f','concat','-safe','0','-i',path.join(OUT,'frames.txt'),'-ss',String(report.capture.audioTrimSeconds),'-i',path.join(OUT,'original-audio.webm'),'-map','0:v:0','-map','1:a:0','-t',String(duration),'-vf','fps=30,format=yuv420p','-c:v','libx264','-preset','fast','-crf','20','-threads','2','-c:a','aac','-b:a','128k','-movflags','+faststart',target],{encoding:'utf8',windowsHide:true});
 await writeFile(path.join(OUT,'encode.log'),run.stderr||'');if(run.status!==0)throw Error(`MP4 encode failed: ${run.error?.message||run.stderr?.slice(-1200)}`);
 report.output=target;report.outputFps=30;report.audio='Actual game WebAudio mix, captured concurrently; no added music or voice.';report.completedAt=new Date().toISOString();
}catch(error){report.errors.push(error.stack||String(error));process.exitCode=1;}
finally{await context?.close();await browser.close();await writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({output:report.output,capture:report.capture,outcome:report.outcome,errors:report.errors},null,2));
