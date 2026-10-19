// Real rendered controls on the final dist; isolated natural saves and explicit fault injection.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import * as G from '../js/game.js';
import {normalizeRun,validateRun} from '../js/persistence.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const game=resolve(import.meta.dirname,'..'),base=resolve(game,'../../output/miaomiao-pawnshop/expansion-20261019/natural'),out=resolve(game,'../../output/miaomiao-pawnshop/refinement-20261019/ui');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(req.url.split('?')[0]);if(path.endsWith('/'))path+='index.html';const file=resolve(game,'dist','.'+path);if(!file.startsWith(resolve(game,'dist')+'/')&&!file.startsWith(resolve(game,'dist')+'\\'))throw Error('outside');res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),checks=[],errors=[];
const saved=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('mmdp_run')));
async function setup(width,height,name='mature',derived=null){
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:width===360?'reduce':'no-preference'}),page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{let seed=11;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});
 const raw=derived?JSON.stringify(derived):await readFile(resolve(base,name+'.json'),'utf8');await page.goto(url);await page.evaluate(raw=>{localStorage.setItem('mmdp_run',raw);localStorage.setItem('mmdp_meta',JSON.stringify({ach:{},tut:true,music:false,sfx:false}));},raw);await page.reload();await page.getByRole('button',{name:'继续营业',exact:true}).click();return{page,context};
}
async function shot(p,name,wait=true){if(wait)await p.waitForFunction(()=>!document.querySelector('.toast'),null,{timeout:10000});await p.screenshot({path:resolve(out,name+'.png'),animations:'disabled'});}
async function openMap(p){await p.getByRole('button',{name:'门面',exact:true}).click();await p.getByRole('button',{name:'查看',exact:true}).click();}
async function fault(p,enabled){await p.evaluate(enabled=>{if(!window.realSetItem){window.realSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(window.failSave&&k==='mmdp_run')throw new DOMException('quota','QuotaExceededError');return window.realSetItem.call(this,k,v);};}window.failSave=enabled;},enabled);}
async function saveChanged(p,before){await p.waitForFunction(revision=>JSON.parse(localStorage.getItem('mmdp_run')).persistence.revision>revision,before.persistence.revision);}
try{
 for(const[width,height]of[[360,640],[402,874]]){
  if(process.env.RECEPTION_BOUNDARIES_ONLY!=='1'){
  {
   const{page,context}=await setup(width,height);await openMap(page);
   const select=page.getByRole('combobox',{name:'临时订单接待'});assert.equal(await select.inputValue(),'all');
   const before=await saved(page);await fault(page,true);await select.selectOption('stock');await page.getByText(/未保存：/).waitFor();assert.equal(await select.inputValue(),'all');assert.deepEqual(await saved(page),before);await shot(page,`${width}-save-failed`,false);
   await fault(page,false);await select.selectOption('stock');await saveChanged(page,before);
   let s=await saved(page);assert.equal(s.business.network.reception,'stock');assert.deepEqual(s.business.network.current,before.business.network.current);assert.deepEqual(s.business.network.policy,before.business.network.policy);assert.equal(s.money,before.money);
   await select.scrollIntoViewIfNeeded();await shot(page,`${width}-reception`);
   await page.reload();await page.getByRole('button',{name:'继续营业',exact:true}).click();await openMap(page);assert.equal(await select.inputValue(),'stock');
   await page.getByRole('button',{name:'关闭',exact:true}).click();const actions=[];
   for(let guard=0;guard<15&&(await saved(page)).day<111;guard++){
    const prior=await saved(page);const reject=page.getByRole('button',{name:'不接',exact:true});
    if(await reject.isVisible()){actions.push({day:prior.day,action:'不接'});await reject.click();await page.waitForFunction(()=>!document.querySelector('.toast'),null,{timeout:10000});}
    else {actions.push({day:prior.day,action:'继续经营'});await page.getByRole('button',{name:'继续经营',exact:true}).click();}
    await saveChanged(page,prior);
   }
   s=await saved(page);assert.equal(s.day,111);assert.equal(s.business.network.reception,'stock');assert.equal(s.business.network.history.at(-1).period.end,110);
   await shot(page,`${width}-period-finished`);await page.reload();await page.getByRole('button',{name:'继续营业',exact:true}).click();assert.equal((await saved(page)).day,111);
   checks.push({width,test:'old default -> failed save rollback -> explicit stock -> reload -> natural five-day settlement -> reload',actions,day:s.day,cash:s.money});await context.close();
  }
  {
   const{page,context}=await setup(width,height);await openMap(page);await page.getByRole('button',{name:'下期安排',exact:true}).click();
   const before=await saved(page),originalText=await page.locator('.network-preview').innerText();
   await page.getByRole('combobox',{name:'生产偏向'}).selectOption('fish');await page.getByRole('combobox',{name:'水质结构'}).selectOption('standard');await page.getByRole('combobox',{name:'配送优先'}).selectOption('harbor');
   const boutique=page.locator('.network-preview-store').filter({hasText:'精品街分店'});
   await boutique.scrollIntoViewIfNeeded();const text=await boutique.innerText();assert.match(text,/纯净水 0\//);assert.match(text,/（原/);assert.notEqual(await page.locator('.network-preview').innerText(),originalText);assert.deepEqual(await saved(page),before);
   await shot(page,`${width}-policy-comparison`);
   await page.getByRole('button',{name:'保存下期安排',exact:true}).click();await saveChanged(page,before);let after=await saved(page);assert.equal(after.business.network.policy.quality,'standard');assert.deepEqual(after.business.network.current,before.business.network.current);
   await page.reload();await page.getByRole('button',{name:'继续营业',exact:true}).click();await openMap(page);await page.getByRole('button',{name:'下期安排',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:'水质结构'}).inputValue(),'standard');assert(!(await page.locator('.network-preview').innerText()).includes('（原'));
   checks.push({width,test:'visible shortage and saved-policy profit comparison, draft read-only, saved for next period only, reload resets baseline',boutiqueText:text});await context.close();
  }
  {
   const{page,context}=await setup(width,height,'before-goal-settlement');await page.getByRole('button',{name:'继续经营',exact:true}).click();await page.getByRole('heading',{name:'经营回顾',exact:true}).waitFor();assert.equal((await saved(page)).business.network.completedDay,120);await shot(page,`${width}-goal`);await page.getByRole('dialog').getByRole('button',{name:'继续经营',exact:true}).click();await page.reload();await page.getByRole('button',{name:'继续营业',exact:true}).click();assert.equal((await saved(page)).business.network.completedDay,120);checks.push({width,test:'original natural goal settlement and continue/reload preserved'});await context.close();
  }
  }
  {
   // Explicit UI boundary fixture, not evidence of a naturally acquired item or progression.
   G.setState(normalizeRun(JSON.parse(await readFile(resolve(base,'mature.json'),'utf8'))));
   G.S.phase='day';G.S.business.network.reception='stock';G.S.shelf=[G.mkItem('yarn',{known:true,fake:false})];
   G.S.queue=[{kind:'order',who:'robot',order:{id:'yarn',qty:1,due:110,reward:100}},{kind:'police',who:'police'}];G.S.qi=0;validateRun(G.S);
   const{page,context}=await setup(width,height,'mature',G.S);
   await page.getByRole('button',{name:'接单',exact:true}).waitFor();const before=await saved(page);
   await page.getByRole('button',{name:'继续经营',exact:true}).click();await saveChanged(page,before);assert.equal((await saved(page)).qi,0);await page.getByRole('button',{name:'接单',exact:true}).waitFor();
   await shot(page,`${width}-stock-order-retained`);
   await page.getByRole('button',{name:'接单',exact:true}).click();await page.getByRole('button',{name:'辛苦了',exact:true}).waitFor();
   let state=await saved(page);assert.equal(state.orders.length,1);assert.equal(state.shelf.length,1);assert.equal(state.money,before.money);
   await shot(page,`${width}-police-retained`);await page.reload();await page.getByRole('button',{name:'继续营业',exact:true}).click();await page.getByRole('button',{name:'辛苦了',exact:true}).waitFor();assert.equal((await saved(page)).orders.length,1);
   checks.push({width,test:'derived UI boundary: stocked offer remains manual; accepted order, goods and police survive continue/reload'});await context.close();
  }
 }
 assert.equal(errors.length,0);await writeFile(resolve(out,process.env.RECEPTION_BOUNDARIES_ONLY==='1'?'boundary-report.json':'report.json'),JSON.stringify({runtime:'dist',checks,errors,limits:'Local touch emulation in isolated browser contexts; not TapTap physical devices or human fun assessment.'},null,2));console.log(JSON.stringify(checks));
}catch(error){await writeFile(resolve(out,'failure.json'),JSON.stringify({checks,errors,error:error.stack},null,2));throw error;}
finally{await browser.close();server.close();}
