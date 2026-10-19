// Final packaged runtime only. All progression actions below use rendered controls.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const game=resolve(import.meta.dirname,'..'),root=resolve(game,'../../output/miaomiao-pawnshop/expansion-20261019'),out=resolve(root,'ui-dist');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(req.url.split('?')[0]);if(path.endsWith('/'))path+='index.html';const file=resolve(game,'dist','.'+path);if(!file.startsWith(resolve(game,'dist')))throw Error('outside runtime');res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),checks=[],errors=[];
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('mmdp_run')));
async function setup(width,height,name){
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:width===360?'reduce':'no-preference'}),page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
 const raw=await readFile(resolve(root,`natural/${name}.json`),'utf8');await page.goto(url);await page.evaluate(raw=>{localStorage.setItem('mmdp_run',raw);localStorage.setItem('mmdp_meta',JSON.stringify({ach:{},tut:true,music:false,sfx:false}));},raw);await page.reload();await page.getByRole('button',{name:'继续营业',exact:true}).click();return{page,context};
}
async function shot(page,name){await page.waitForFunction(()=>!document.querySelector('.toast'),null,{timeout:8000});await page.locator('.sheet,.dialog').evaluateAll(els=>Promise.all(els.flatMap(e=>e.getAnimations()).map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:resolve(out,name+'.png'),animations:'disabled'});}
async function openMap(page){await page.getByRole('button',{name:'门面',exact:true}).click();await page.getByRole('button',{name:'查看',exact:true}).click();}
try{
 for(const[width,height]of[[360,640],[402,874]]){
  {
   const{page,context}=await setup(width,height,'pre-buyout');await page.getByRole('button',{name:'账本',exact:true}).click();await page.getByRole('button',{name:'赎回店铺 6000',exact:true}).click();await page.getByRole('button',{name:'支付并永久免租',exact:true}).click();assert.equal((await saved(page)).money,2639);
   await page.getByRole('dialog').getByRole('button',{name:'生意版图',exact:true}).click();await page.locator('.network-object').filter({hasText:'中央作坊'}).getByRole('button').click();await page.getByRole('button',{name:'支付 1400',exact:true}).click();assert.equal((await saved(page)).money,1239);
   await page.getByRole('button',{name:'下期安排',exact:true}).click();await page.getByRole('button',{name:'中央作坊：停工',exact:true}).click();await page.getByRole('spinbutton',{name:'额外留用鱼币'}).fill('200');await page.getByRole('button',{name:'保存下期安排',exact:true}).click();await shot(page,`${width}-workshop`);
   await page.reload();await page.getByRole('button',{name:'继续营业',exact:true}).click();const s=await saved(page);assert.equal(s.business.network.policy.reserve,200);assert.equal(s.business.network.builds.workshop.effectiveDay,81);checks.push({width,test:'natural buyout -> workshop -> enable -> reload',cash:s.money,day:s.day,source:'final dist'});await context.close();
  }
  {
   const{page,context}=await setup(width,height,'after-capacity');await openMap(page);const s=await saved(page),workshop=page.locator('.network-object').filter({hasText:'中央作坊'});assert((await workshop.innerText()).includes(`${s.business.network.current.plan.capacity}工时/期`));assert((await workshop.innerText()).includes(`第${s.business.network.builds.capacity.effectiveDay}天72工时`));await shot(page,`${width}-capacity-pending`);checks.push({width,test:'pending capacity distinguishes current and effective date'});await context.close();
  }
  {
   const{page,context}=await setup(width,height,'mature'),before=await saved(page);await openMap(page);await page.getByRole('button',{name:'下期安排',exact:true}).click();await page.getByRole('combobox',{name:'生产偏向'}).selectOption('fish');await page.getByRole('combobox',{name:'水质结构'}).selectOption('premium');await page.getByRole('combobox',{name:'配送优先'}).selectOption('boutique');await page.getByRole('button',{name:'保存下期安排',exact:true}).click();const after=await saved(page);assert.deepEqual(after.business.network.current,before.business.network.current);assert.equal(after.business.network.policy.production,'fish');await shot(page,`${width}-mature-locked`);checks.push({width,test:'two-store next policy preserves paid current batch',day:after.day});await context.close();
  }
  {
   const{page,context}=await setup(width,height,'before-goal-settlement');const before=await saved(page);assert.equal(before.business.network.streak,2);await page.getByRole('button',{name:'继续经营',exact:true}).click();await page.getByRole('heading',{name:'经营回顾',exact:true}).waitFor();const after=await saved(page);assert.equal(after.business.network.completedDay,120);assert.equal(after.business.network.streak,3);await shot(page,`${width}-goal`);await page.getByRole('dialog').getByRole('button',{name:'继续经营',exact:true}).click();await page.reload();await page.getByRole('button',{name:'继续营业',exact:true}).click();assert.equal((await saved(page)).business.network.completedDay,120);checks.push({width,test:'natural third full period settles -> review -> continue -> reload',completedDay:120,saveRetained:true});await context.close();
  }
 }
 assert.equal(errors.length,0);await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors,limitations:'Local mobile browser touch emulation, not TapTap iOS/Android host.'},null,2));console.log(JSON.stringify(checks));
}finally{await browser.close();server.close();}
