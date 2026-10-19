import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const game=resolve(import.meta.dirname,'..'),runtime=process.env.STARTUP_RUNTIME==='source'?game:resolve(game,'dist'),out=resolve(game,'../../output/miaomiao-pawnshop/startup-fix-20261019/ui-boot');await mkdir(out,{recursive:true});
const raw=await readFile(resolve(game,'../../output/miaomiao-pawnshop/expansion-20261019/natural/mature.json'),'utf8');
const server=createServer(async(req,res)=>{try{if(req.url==='/seed.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Isolated test storage</title>');return;}let path=decodeURIComponent(req.url.split('?')[0]);if(path.endsWith('/'))path+='index.html';const file=resolve(runtime,'.'+path);if(!file.startsWith(runtime))throw Error('outside');res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),checks=[];
async function start(width,height){const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:width===360?'reduce':'no-preference'}),page=await context.newPage();page.setDefaultTimeout(7000);await page.goto(url+'seed.html');await page.evaluate(raw=>{localStorage.setItem('mmdp_run',raw);localStorage.setItem('mmdp_meta',JSON.stringify({ach:{},tut:true,music:false,sfx:false}));},raw);return{context,page};}
const original=p=>p.evaluate(()=>localStorage.getItem('mmdp_run'));
async function title(page){await page.getByRole('button',{name:'继续营业',exact:true}).waitFor();assert(await page.locator('#boot').isHidden());}
try{
 for(const[width,height]of[[360,640],[402,874]]){
  {
   const{context,page}=await start(width,height);await page.evaluate(()=>localStorage.setItem('mmdp_meta','{broken'));
   await page.goto(url);await page.getByRole('alert').waitFor();assert(await page.locator('#boot').isHidden());assert(await page.getByRole('button',{name:'继续营业',exact:true}).isDisabled());
   await page.screenshot({path:resolve(out,`${width}-storage-failed.png`)});assert.equal(await original(page),raw);
   await page.evaluate(()=>localStorage.setItem('mmdp_meta',JSON.stringify({ach:{},tut:true,music:false,sfx:false})));await page.getByRole('button',{name:'重试',exact:true}).click();assert.equal(await page.getByRole('alert').count(),0);
   await page.getByRole('button',{name:'继续营业',exact:true}).click();await page.getByRole('button',{name:'门面',exact:true}).waitFor();assert.equal(JSON.parse(await original(page)).day,106);
   checks.push({width,test:'metadata fault renders title; retry after fault removal enables continuing original save'});await context.close();
  }
  if(process.env.STARTUP_STORAGE_ONLY==='1')continue;
  {
   const{context,page}=await start(width,height);
   await page.route('**/js/business.js',route=>route.abort('failed'));await page.goto(url);
   await page.getByText('游戏资源未能加载，请重试。').waitFor();assert.equal(await original(page),raw);
   await page.screenshot({path:resolve(out,`${width}-resource-failed.png`)});
   await page.unroute('**/js/business.js');await page.getByRole('button',{name:'重新加载',exact:true}).click();await title(page);assert.equal(await original(page),raw);
   await page.getByRole('button',{name:'继续营业',exact:true}).click();await page.getByRole('button',{name:'门面',exact:true}).waitFor();assert.equal(JSON.parse(await original(page)).day,106);
   checks.push({width,test:'missing nested module shows retry; real retry loads old save without alteration',runtime});await context.close();
  }
  {
   const{context,page}=await start(width,height);await page.route('**/js/boot.js',route=>route.abort('failed'));await page.goto(url);await title(page);assert.equal(await original(page),raw);
   checks.push({width,test:'missing diagnostic script cannot cover a successfully rendered title'});await context.close();
  }
 }
 if(process.env.STARTUP_STORAGE_ONLY!=='1'){
  const{context,page}=await start(360,640);let release;
  await page.route('**/js/main.js',async route=>{await new Promise(r=>release=r);await route.continue();});
  const navigation=page.goto(url,{timeout:30000});
  await page.getByText('开门时间有些久，请重新加载。').waitFor({timeout:18000});
  await page.screenshot({path:resolve(out,'360-slow-network.png')});assert.equal(await original(page),raw);release();await navigation;await title(page);
  checks.push({width:360,test:'stalled main module surfaces timeout; late successful load dismisses fallback without touching save'});await context.close();
 }
 await writeFile(resolve(out,process.env.STARTUP_STORAGE_ONLY==='1'?'storage-report.json':'report.json'),JSON.stringify({checks,limits:'Injected browser network/storage failures, not observed TapTap outer-host failures.'},null,2));console.log(JSON.stringify(checks));
}finally{await browser.close();server.close();}
