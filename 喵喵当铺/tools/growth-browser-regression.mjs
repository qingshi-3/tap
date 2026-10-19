import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const runtime=process.env.GROWTH_RUNTIME==='dist'?'dist/':'';
const root=resolve(import.meta.dirname,'../../..'),out=process.env.GROWTH_UI_OUTPUT?resolve(process.env.GROWTH_UI_OUTPUT):resolve(root,'output/miaomiao-pawnshop/growth-20261019',runtime?'ui-dist':'ui-root');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{let u=decodeURIComponent(req.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const p=resolve(root,'.'+u);if(!p.startsWith(root))throw Error();const b=await readFile(p);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'})[extname(p)]||'application/octet-stream');res.end(b);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/games/miaomiao-pawnshop/${runtime}`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
let page;const errors=[],checks=[];
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mmdp_run')));
const shot=name=>page.screenshot({path:resolve(out,name+'.png'),animations:'disabled'});
async function close(){const btn=page.getByRole('button',{name:'关闭',exact:true}).last();if(await btn.count())await btn.click();}
async function night(){
 for(let i=0;i<12&&!(await page.getByRole('button',{name:'小铺',exact:true}).count());i++){
  let handled=false;
  for(const label of ['开门营业','不收了','不卖了','抱歉，没有','不接','辛苦了','送客','舍不得','不卖','离开']){
   const button=page.getByRole('button',{name:label,exact:true});if(await button.count()&&await button.first().isVisible()){await button.first().click();handled=true;break;}
  }
  if(!handled){const pay=page.getByRole('button',{name:/^付房租 /});if(await pay.count()){await pay.click();handled=true;}}
  if(!handled)throw Error('Unhandled daytime UI: '+await page.locator('body').innerText());
  await page.clock.runFor(1800);
 }
 await page.getByRole('button',{name:'小铺',exact:true}).waitFor({timeout:3000});
}
async function sleep(){
 await page.getByRole('button',{name:'💤 睡觉',exact:true}).click();
 if(!await page.getByRole('button',{name:'开门营业',exact:true}).count())await page.getByRole('button',{name:'💤 睡觉',exact:true}).click();
 console.log('sleep feedback',await page.locator('.toast').allTextContents());
 await page.getByRole('button',{name:'开门营业',exact:true}).waitFor({timeout:5000});
 await page.getByRole('button',{name:'开门营业',exact:true}).click();
}
try{
 for(const width of [360,402]){
  const context=await browser.newContext({viewport:{width,height:width===360?640:874},isMobile:true,hasTouch:true});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
  await page.goto(base);
  await page.evaluate(async()=>{const G=await import('./js/game.js');G.newRun();G.S.day=6;G.S.money=1000;G.S.tutorial=true;G.startNight();localStorage.setItem('mmdp_run',JSON.stringify(G.S));localStorage.setItem('mmdp_meta',JSON.stringify({tut:true,music:false,sfx:false}));});
  await page.reload();await page.getByRole('button',{name:'继续营业',exact:true}).click();await page.getByRole('button',{name:'小铺',exact:true}).waitFor();
  await page.getByRole('button',{name:'小铺',exact:true}).click();
  // Storage quota failure must not turn a purchase into a success or mutate live money.
  await page.evaluate(()=>{window.nativeSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='mmdp_run')throw Error('quota fixture');return window.nativeSet.call(this,k,v);};});
  await page.locator('.li').filter({hasText:'净水器'}).getByRole('button').click();
  assert.equal((await state()).money,1000);assert.equal(await page.evaluate(async()=>{const G=await import('./js/game.js');return G.S.money;}),1000);
  await page.evaluate(()=>Storage.prototype.setItem=window.nativeSet);
  await page.locator('.li').filter({hasText:'净水器'}).getByRole('button').click();assert.equal((await state()).money,940);assert.equal((await state()).owned.purifier,true);
  await page.getByRole('button',{name:'预订',exact:true}).first().click();await page.getByRole('spinbutton',{name:'数量'}).fill('3');await page.getByRole('button',{name:'确认预订',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mmdp_run')).money===916);await shot(`${width}-purchase`);await close();
  await page.getByRole('button',{name:'订单',exact:true}).click();await page.getByRole('button',{name:'报价',exact:true}).first().click();await page.getByRole('button',{name:'确认接单',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mmdp_run')).business.contracts.length===1);await close();
  await page.reload();await page.getByRole('button',{name:'继续营业',exact:true}).click();await page.getByRole('button',{name:'小铺',exact:true}).waitFor();assert.equal((await state()).business.purchases.length,1);
  await sleep();await night();await page.getByRole('button',{name:'作坊',exact:true}).click();
  await page.locator('[data-machine=purifier]').click();await shot(`${width}-production`);
  console.log('production modal',width,await page.locator('[role=dialog]').innerText());
  const start=page.getByRole('button',{name:/开工/}).last();await start.click();await page.waitForFunction(()=>!!JSON.parse(localStorage.getItem('mmdp_run')).machines.purifier);assert.equal((await state()).filter,7);
  await sleep();await night();await page.getByRole('button',{name:'订单',exact:true}).click();
  console.log('delivery modal',width,await page.locator('[role=dialog]').innerText());
  await page.getByRole('button',{name:'交付',exact:true}).first().click();await shot(`${width}-delivery`);
  console.log('delivery selection',width,await page.locator('[role=dialog]').innerText());
  await page.getByRole('button',{name:/交付3件/}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mmdp_run')).business.contracts[0].status==='completed');
  assert.equal((await state()).money,1048);checks.push({width,trial:'3 water delivered',cash:1048,saveFailureRollback:true,saveReload:true});await close();
  await page.getByRole('button',{name:'门面',exact:true}).click();await shot(`${width}-front`);
  const bounds=await page.locator('.night-screen .bar button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return{text:b.textContent,x:r.x,y:r.y,width:r.width,height:r.height};}));assert(bounds.every(b=>b.x>=0&&b.y+b.height<=(width===360?640:874)+1));
  await context.close();console.log('PASS mobile',width);
 }
 assert.equal(errors.length,0);await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors,limitations:'Chromium touch emulation; not iPhone/Android TapTap host; real input on isolated controlled state'},null,2));
}catch(error){console.error(error);if(page){await shot('failure');await writeFile(resolve(out,'failure.txt'),await page.locator('body').innerText());}throw error;}
finally{await browser.close();server.close();}

