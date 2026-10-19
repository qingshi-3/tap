import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'../../output/miaomiao-pawnshop/operations-20261019/ui-dist');
await mkdir(out,{recursive:true});
const frozen=await readFile(resolve(root,'tools/fixtures/growth-v3/hands-on-day17.json'),'utf8');
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(req.url.split('?')[0]);if(path.endsWith('/'))path+='index.html';const target=resolve(root,'dist','.'+path);if(!target.startsWith(resolve(root,'dist')))throw Error('outside runtime');res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'})[extname(target)]||'application/octet-stream');res.end(await readFile(target));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const report=[],errors=[];
try{
 for(const [width,height]of [[360,640],[402,874]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:width===360?'reduce':'no-preference'}),page=await context.newPage();page.setDefaultTimeout(5000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.evaluate(raw=>{localStorage.setItem('mmdp_run',raw);localStorage.setItem('mmdp_meta',JSON.stringify({tut:true,music:false,sfx:false}));},frozen);
  await page.reload();await page.getByRole('button',{name:'继续营业',exact:true}).click();
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mmdp_run')));
  assert.equal((await state()).money,669);assert.equal((await state()).day,17);
  await page.getByRole('button',{name:'门面',exact:true}).click();await page.getByRole('button',{name:'安排',exact:true}).click();
  await page.getByRole('button',{name:/自动经营.*关闭/}).click();
  await page.getByRole('combobox',{name:'饮水客户'}).selectOption('regular');await page.getByRole('combobox',{name:'鲜鱼客户'}).selectOption('regular');
  await page.getByRole('spinbutton',{name:'额外留用鱼币'}).fill('80');
  await page.getByRole('button',{name:'保存安排',exact:true}).click();
  assert.equal((await state()).business.operations.enabled,true);assert.equal((await state()).business.operations.reserve,80);
  await page.waitForFunction(()=>!document.querySelector('.toast'),null,{timeout:7000});
  await page.screenshot({path:resolve(out,`${width}-arrangement.png`),animations:'disabled'});
  await page.getByRole('button',{name:'关闭',exact:true}).click();await page.getByRole('button',{name:'继续经营',exact:true}).click();
  const advanced=await state();assert(advanced.day>17&&advanced.day<=21);assert(advanced.business.operations.enabled);
  await page.screenshot({path:resolve(out,`${width}-stopped.png`),animations:'disabled'});
  await page.reload();await page.getByRole('button',{name:'继续营业',exact:true}).click();const restored=await state();assert.equal(restored.day,advanced.day);assert.equal(restored.money,advanced.money);assert.deepEqual(restored.business.operations.routes,{water:'regular',fish:'regular'});
  report.push({width,height,start:'actual frozen day17 night / cash669',endDay:restored.day,cash:restored.money,enabled:true,reserve:80,saveReload:true,source:'all runtime modules served from final dist'});
  await context.close();
 }
 assert.equal(errors.length,0);await writeFile(resolve(out,'report.json'),JSON.stringify({checks:report,errors,limitations:'Browser touch emulation; not iOS/Android TapTap host. Full-period source UI checks are recorded separately.'},null,2));console.log(JSON.stringify(report));
}finally{await browser.close();server.close();}
