import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),root=resolve(import.meta.dirname,'../../..'),out=resolve(root,'output/miaomiao-pawnshop/pv-audio-20261019/audio');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(root))throw Error();const b=await readFile(p);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[extname(p)]||'application/octet-stream');res.end(b);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--autoplay-policy=document-user-activation-required']});
const context=await browser.newContext({viewport:{width:390,height:680},isMobile:true,hasTouch:true}),page=await context.newPage();
await page.addInitScript(()=>{
 const Native=window.AudioContext;
 window.AudioContext=class extends Native{constructor(...args){super(...args);window.testAudio=this;const gain=this.createGain.bind(this);this.createGain=()=>{const g=gain(),connect=g.connect.bind(g);g.connect=(to,...args)=>{if(to===this.destination){window.testAnalyser=this.createAnalyser();connect(window.testAnalyser);window.testAnalyser.connect(to);return to;}return connect(to,...args);};return g;};}};
 window.measureOutput=async()=>{const a=window.testAnalyser,b=new Float32Array(a.fftSize);let sum=0,peak=0,count=0;for(let i=0;i<40;i++){a.getFloatTimeDomainData(b);for(const x of b){sum+=x*x;peak=Math.max(peak,Math.abs(x));count++;}await new Promise(r=>setTimeout(r,25));}return {rms:Math.sqrt(sum/count),peak,state:window.testAudio.state};};
});
await page.goto(`http://127.0.0.1:${server.address().port}/games/miaomiao-pawnshop/tools/audio-fixture.html`);
await page.getByRole('button',{name:'继续营业',exact:true}).tap();
const playing=await page.evaluate(()=>window.measureOutput());assert.ok(playing.rms>0.001);
await page.evaluate(()=>window.testAudio.suspend());
await page.touchscreen.tap(10,10);
const recovered=await page.evaluate(()=>window.measureOutput());assert.ok(recovered.rms>0.001);
await page.screenshot({path:resolve(out,'night-playing.png')});
const recording=await page.evaluate(async()=>{const c=window.testAudio,d=c.createMediaStreamDestination(),a=window.testAnalyser;a.connect(d);const chunks=[],rec=new MediaRecorder(d.stream);rec.ondataavailable=e=>chunks.push(e.data);rec.start();await new Promise(r=>setTimeout(r,5000));await new Promise(r=>{rec.onstop=r;rec.stop();});a.disconnect(d);return [...new Uint8Array(await new Blob(chunks).arrayBuffer())];});
await writeFile(resolve(out,'night-output.webm'),Buffer.from(recording));
await page.getByRole('button',{name:'菜单',exact:true}).tap();
await page.getByRole('button',{name:'音乐：开',exact:true}).tap();
assert.equal(await page.getByRole('button',{name:'音乐：关',exact:true}).count(),1);
await page.waitForTimeout(100);
const disabled=await page.evaluate(()=>window.measureOutput());assert.ok(disabled.peak<0.00001);
await page.evaluate(()=>window.testAudio.suspend());await page.touchscreen.tap(10,10);
const disabledAfterRecovery=await page.evaluate(()=>window.measureOutput());assert.ok(disabledAfterRecovery.peak<0.00001);
await page.evaluate(async()=>{const a=await import('/games/miaomiao-pawnshop/js/audio.js');a.sound.sfx=true;a.sfx('bell');});
const sfx=await page.evaluate(()=>window.measureOutput());assert.ok(sfx.peak>0.001);
const results={playing,recovered,disabled,disabledAfterRecovery,sfx,limitations:'Chromium mobile emulation, not TapTap device or iOS; interrupted state covered by unit fixture. Output sampled after master gain, before physical speaker. SFX independence invokes exported sfx directly; music off uses actual menu tap.'};
await writeFile(resolve(out,'browser-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser?.close();server.close();}

