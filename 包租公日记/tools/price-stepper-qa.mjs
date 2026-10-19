import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createGame,dispatch,selectProperties,SAVE_KEY} from '../src/game/index.ts';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={viewports:[],errors:[]};mkdirSync('output/qa',{recursive:true});
const id='xingfu-402';
function act(s,a){const r=dispatch(s,a);assert.ok(r.ok,r.message);return r.state;}
let seed=act(createGame(17),{type:'repair',propertyId:id});
seed=act(seed,{type:'listing',propertyId:id,askingRent:400});
seed=act(seed,{type:'agency',propertyId:id});
const url=process.env.QA_URL??'http://127.0.0.1:4192/';
const value=async s=>Number((await s.locator('.price-value').innerText()).replace(/[^0-9]/g,''));
const button=(p,name)=>p.getByRole('button',{name,exact:true});
async function checkLayout(p,name){
 const r=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('.price-stepper button')].map(b=>({text:b.textContent,height:b.getBoundingClientRect().height,width:b.getBoundingClientRect().width}))}));
 assert.ok(r.scroll<=r.width);for(const b of r.buttons){assert.ok(b.height>=44,`${b.text}: height`);assert.ok(b.width>=44,`${b.text}: width`);}
 await p.screenshot({path:`output/qa/price-${name}.png`});
}
try{
 for(const [name,w,h] of [['390',390,844],['360',360,640],['320',320,568],['844',844,390],['568',568,320]]){
  const context=await browser.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await context.addInitScript(({key,state})=>{if(!sessionStorage.getItem('price.seed')){localStorage.setItem(key,JSON.stringify(state));sessionStorage.setItem('price.seed','1');}},{key:SAVE_KEY,state:seed});
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url);await p.getByRole('button',{name:'幸福里，进入小区',exact:true}).tap();await p.getByRole('button',{name:'幸福里A栋，进入楼栋',exact:true}).tap();
  await p.getByRole('button',{name:/幸福里402.*查看房间/}).tap();await button(p,'招租').first().tap();
  let s=p.getByRole('dialog').locator('.listing-form .price-stepper');const baseline=selectProperties(seed)[0].marketRent;
  assert.equal(await value(s),baseline);assert.equal(await p.getByRole('dialog').locator('input').count(),0);
  await button(s,'+10').tap();assert.equal(await value(s),baseline+10);
  await button(s,'-10').tap();await button(s,'+100').tap();assert.equal(await value(s),baseline+100);
  await button(s,'-100').tap();await button(s,'+1000').tap();assert.equal(await value(s),baseline+1000);
  await button(s,'-1000').tap();assert.equal(await value(s),baseline);
  assert.equal(await button(s,'-1000').isDisabled(),true);
  await button(s,'+10').tap();await button(s,'恢复基准价').tap();assert.equal(await value(s),baseline);
  await checkLayout(p,`${name}-listing`);
  await button(s,'+10').tap();await button(p,'确认改价').tap();
  let saved=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),SAVE_KEY);assert.equal(saved.properties[id].askingRent,baseline+10);
  await button(p,'关闭').tap();await p.getByRole('button',{name:/幸福里402.*查看房间/}).tap();await button(p,'招租').first().tap();s=p.getByRole('dialog').locator('.listing-form .price-stepper');assert.equal(await value(s),baseline+10);await button(s,'+10').tap();assert.equal(await value(s),baseline+20);await button(p,'确认改价').tap();await button(p,'关闭').tap();await p.locator('.inquiry-notice').first().tap();
  s=p.getByRole('dialog').locator('.price-stepper');assert.equal(await value(s),baseline);
  await button(s,'+100').focus();await p.keyboard.press('Enter');assert.equal(await value(s),baseline+100);
  await button(s,'恢复基准价').tap();await checkLayout(p,`${name}-inquiry`);
  await button(p,'还价签约').tap();saved=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),SAVE_KEY);
  assert.equal(saved.properties[id].leases[0].monthlyRent,baseline);
  await button(p,'关闭').tap();await p.reload();assert.equal((await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),SAVE_KEY)).properties[id].leases[0].monthlyRent,baseline);
  report.viewports.push({name,w,h,baseline,checks:'六种步长、基准恢复、负值禁止、确认挂牌、还价签约、键盘、刷新'});await context.close();
 }
 assert.deepEqual(report.errors,[]);writeFileSync('output/qa/price-stepper-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){writeFileSync('output/qa/price-stepper-failure.json',JSON.stringify({...report,error:String(e)},null,2));throw e;}
finally{await browser.close();}
