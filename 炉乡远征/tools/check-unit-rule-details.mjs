import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch,confirmMulligan,getBattleCard,validateMatch} from '../dist/js/engine.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
const {chromium}=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const out=new URL('../output/unit-rule-details/',import.meta.url);mkdirSync(out,{recursive:true});
const base=process.env.CAMPAIGN_UI_BASE||'http://127.0.0.1:4227';
class Memory{data=new Map();getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,String(v))}removeItem(k){this.data.delete(k)}}
function fixture(){
 const p=new ExpeditionProgress(new Memory()),profile=p.state,m=createExpeditionMatch('border-01',profile.training,profile.squad,profile.selectedHeroId,p.getBattleLoadout());assert.ok(p.saveBattle(m).ok);assert.ok(confirmMulligan(m));
 const template=m.units.find(u=>u.owner===1&&getBattleCard(m,u.cardId,1)?.type==='unit');m.units=m.units.filter(u=>getBattleCard(m,u.cardId,u.owner)?.type==='general');
 const cases=[{id:121,key:'rush-bounce',labels:['突袭','回手'],x:5,y:2},{id:17,key:'provoke-airdrop',labels:['嘲讽','空投'],x:4,y:1},{id:111,key:'flying-backstab',labels:['飞行','背刺'],x:5,y:1},{id:18,key:'multi-effect',labels:['嘲讽'],x:6,y:1},{id:14,key:'vanilla',labels:[],x:4,y:3},{id:17,key:'silenced',labels:['嘲讽','空投'],x:5,y:3,silenced:true},{id:14,key:'granted',labels:['飞行','亡愿'],x:6,y:3,flyingBuff:true,grantedDyingSpawns:[516]}];
 for(const[index,test]of cases.entries()){
  const card=getBattleCard(m,test.id,1),unitId=10001+index;test.unitId=unitId;
  m.units.push({...template,unitId,cardId:test.id,x:test.x,y:test.y,attack:card.attack,maxHealth:card.health,health:card.health,attackBuff:0,healthBuff:0,silenced:Boolean(test.silenced),...(test.flyingBuff?{flyingBuff:true}:{}),...(test.grantedDyingSpawns?{grantedDyingSpawns:test.grantedDyingSpawns}:{})});
 }
 assert.ok(validateMatch(m),'all read-only UI fixtures legal');const saved=p.saveBattle(m);assert.ok(saved.ok,saved.error);return{profile:p.state,cases,heroId:m.units.find(u=>u.owner===0&&getBattleCard(m,u.cardId)?.type==='general').unitId};
}
if(process.env.UNIT_RULE_FIXTURES_ONLY==='1'){fixture();console.log('Six unit-rule fixtures validate/save successfully');process.exit(0);}
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const checks=[],errors=[];let passed=false;
const shot=(page,name)=>page.screenshot({path:new URL(name+'.png',out).pathname.replace(/^\/([A-Z]:)/,'$1')});
async function point(page,id){return page.evaluate(id=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===id);r.focusCell(u.x,u.y);r.pan(-60,-60);r.draw(r.state,window.__opts);const p=r.getUnitAnchor(u);for(let dy=-35;dy<=25;dy+=5)for(let dx=-20;dx<=20;dx+=5){const q={x:p.x+dx,y:p.y+dy},hit=r.positionFromPointer({clientX:q.x,clientY:q.y},{preferUnits:true});if(hit?.x===u.x&&hit?.y===u.y&&document.elementFromPoint(q.x,q.y)===r.canvas)return q}return null},id)}
async function hold(page,p){const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await page.waitForTimeout(500);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();}
async function scrollTouch(page,element){const b=await element.boundingBox(),c=await page.context().newCDPSession(page),p={x:b.x+b.width/2,y:b.y+b.height-8};await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});for(let i=1;i<=8;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y-(b.height-20)*i/8}]});await page.waitForTimeout(30)}await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();}
try{for(const[width,height,motion]of[[568,320,'no-preference'],[844,390,'reduce']]){
 const f=fixture(),context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:motion}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(({profile,key})=>localStorage.setItem(key,JSON.stringify(profile)),{profile:f.profile,key:SAVE_KEYS.expedition});await page.addInitScript(async()=>{const{BoardRenderer}=await import('/js/renderer.js'),draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__renderer=this;window.__opts=args[1];return draw.apply(this,args)}});await page.goto(base);await page.locator('.menu-play').tap();await page.locator('#objective-close').tap();await page.waitForFunction(()=>window.__renderer?.ready&&!document.querySelector('#end-turn').disabled);
 for(const test of f.cases.filter(test=>process.env.UNIT_RULE_DEFINITIONS_ONLY==='1'?['rush-bounce','multi-effect'].includes(test.key):process.env.UNIT_RULE_SUPPLEMENT_ONLY!=='1'||['silenced','rush-bounce'].includes(test.key))){
  const evidenceKey=process.env.UNIT_RULE_DEFINITIONS_ONLY==='1'?'definitions-'+test.key:test.key;const p=await point(page,test.unitId);assert.ok(p,test.key+' reachable');await page.touchscreen.tap(p.x,p.y);await page.locator('#unit-inspect').waitFor({state:'visible'});
  const description=page.locator('#unit-inspect-description'),compact=await description.innerText();const buttons=description.getByRole('button');
  if(test.key==='vanilla'){assert.equal(await buttons.count(),0);assert.ok(!/无特殊效果/.test(compact));await shot(page,`${evidenceKey}-${width}`);await page.keyboard.press('Escape');continue;}
  assert.ok(await buttons.count()>0,test.key+' has rule buttons');for(const label of test.labels)assert.ok((await buttons.allTextContents()).some(text=>text.includes(label)),test.key+' includes '+label);
  if(test.key==='silenced')assert.match(compact,/驱散|沉默/);
  // Compact card has no duplicated long generic definitions.
  assert.ok(!compact.includes('可召唤到任意空格，无需邻近友军。'));assert.ok(!compact.includes('从目标背后紧邻的同排格主动攻击'));
  await shot(page,`${evidenceKey}-${width}`);
  const before=await page.evaluate(()=>JSON.stringify(window.__renderer.state));
  await page.evaluate(()=>{window.__ruleBoardPresses=0;if(!window.__rulePressObserver){window.__rulePressObserver=true;window.__renderer.canvas.addEventListener('pointerdown',()=>window.__ruleBoardPresses++)}});
  const texts=[];
  for(let index=0;index<await buttons.count();index++){
   const button=buttons.nth(index),b=await button.boundingBox();assert.ok(b.width>=44&&b.height>=44,'rule touch target at least44px');
   const face=await page.locator('#unit-inspect .game-card').boundingBox();assert.ok(b.y+b.height<=face.y+face.height+1,'rule target fully inside card');
   await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(150);assert.equal(await page.locator('dialog[open].hero-effect-dialog').count(),0,'hover never opens rule');
   await button.tap();const dialog=page.locator('dialog[open].hero-effect-dialog');await dialog.waitFor();const copy=dialog.locator('.hero-effect-copy'),text=await copy.innerText();assert.ok(text.trim());texts.push(text);
   if(test.id===111&&/背刺/.test(await button.innerText()))assert.match(text,/4/,'backstab amount retained');
   if(test.key==='granted'&&/亡愿/.test(await button.innerText()))assert.match(text,/1\s*[\/／]\s*1|1攻击.*1生命|1\/1/);
   if(test.key==='rush-bounce'){assert.match(text,/突袭/);assert.match(text,/返回手牌/);}
   if(process.env.UNIT_RULE_DEFINITIONS_ONLY==='1') {
    if(test.key==='rush-bounce'){assert.match(text,/召唤当回合即可移动和攻击/);assert.match(text,/嘲讽与眩晕/);}
    if(test.key==='multi-effect'){assert.match(text,/相邻敌人不能移动/);assert.match(text,/只能攻击相邻嘲讽单位/);assert.match(text,/移动距离增加1/);}
   }
   if(test.key==='silenced')assert.match(text,/原有能力与专精已停用/);
   const overflow=await copy.evaluate(el=>el.scrollHeight>el.clientHeight);if(overflow){await scrollTouch(page,copy);assert.ok(await copy.evaluate(el=>el.scrollTop>0));}
   await shot(page,`${evidenceKey}-effect-${index}-${width}`);
   const method=process.env.UNIT_RULE_DEFINITIONS_ONLY==='1'||test.key==='silenced'?0:f.cases.indexOf(test)%3;if(method===0)await dialog.getByRole('button',{name:'返回',exact:true}).tap();else if(method===1)await page.keyboard.press('Escape');else await page.touchscreen.tap(10,height/2);
   assert.equal(await page.locator('.hero-effect-dialog').count(),0);assert.equal(await page.locator('#unit-inspect').isVisible(),true);assert.equal(await button.evaluate(el=>document.activeElement===el),true);assert.equal(await page.evaluate(()=>window.__ruleBoardPresses),0);const after=await page.evaluate(()=>JSON.stringify(window.__renderer.state));if(after!==before){const a=JSON.parse(after),b=JSON.parse(before),diff=Object.keys(a).filter(k=>k!=='playtimeSeconds'&&JSON.stringify(a[k])!==JSON.stringify(b[k])).map(k=>({key:k,before:b[k],after:a[k]}));writeFileSync(new URL('state-diff.json',out),JSON.stringify(diff,null,2));assert.deepEqual(diff,[],'reading leaves battle state unchanged');}
  }
  checks.push({width,motion,key:test.key,compact,details:texts});await page.keyboard.press('Escape');
 }
 if(process.env.UNIT_RULE_SUPPLEMENT_ONLY!=='1'&&process.env.UNIT_RULE_DEFINITIONS_ONLY!=='1'){await hold(page,await point(page,f.heroId));assert.equal(await page.locator('#unit-inspect .inspect-ability').count(),2);await page.locator('#unit-inspect .inspect-ability').first().tap();await page.locator('.hero-effect-dialog[open]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('#unit-inspect').isVisible(),true);await shot(page,`hero-preserved-${width}`);await page.keyboard.press('Escape');}await context.close();
 }assert.deepEqual(errors,[]);passed=true;
}finally{await browser.close();writeFileSync(new URL(process.env.UNIT_RULE_DEFINITIONS_ONLY==='1'?'definitions-report.json':process.env.UNIT_RULE_SUPPLEMENT_ONLY==='1'?'supplement-report.json':'report.json',out),JSON.stringify({passed,checks,errors},null,2));}
console.log(JSON.stringify({passed,samples:checks.length,errors}));
