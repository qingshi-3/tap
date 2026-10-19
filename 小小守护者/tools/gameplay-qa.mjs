import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const empty=process.argv.includes('--empty');
const prefix=empty?'gameplay-drag-loss':'gameplay-drag';
const inputLog=[];
try {
await page.goto('http://localhost:4184');await page.waitForFunction(()=>window.__guardians?.snapshot().ready);
await page.clock.install();
const tap=async locator=>{await locator.tap();await page.clock.runFor(160)};
await tap(page.getByRole('button',{name:'按种子开局',exact:true}));await tap(page.getByRole('button',{name:'确认',exact:true}));
await tap(page.getByRole('button',{name:'全景地图',exact:true}));
const snap=()=>page.evaluate(()=>window.__guardians.snapshot());
const screenPoint=(x,y)=>page.evaluate(p=>window.__guardians.screenPoint(p),{x:x+.5,y:y+.5});
const point=async(x,y)=>{const p=await screenPoint(x,y);await page.touchscreen.tap(p.x,p.y);await page.clock.runFor(160)};
const closeSelection=async()=>{const b=page.getByRole('button',{name:'取消选中',exact:true});if(await b.isVisible())await tap(b)};
const cdp=await context.newCDPSession(page);
async function buy(kind,x,y){
 const before=await snap(),button=page.locator(`[data-tool="${kind}"]`);
 assert.equal(await button.isEnabled(),true,`${kind} purchase must be enabled`);
 const box=await button.boundingBox();assert.ok(box,'Recruit button has a real rendered hitbox');
 const from={x:box.x+box.width/2,y:box.y+box.height/2},to=await screenPoint(x,y);assert.ok(to&&Number.isFinite(to.x)&&Number.isFinite(to.y));
 const touch=p=>[{x:p.x,y:p.y,id:1,radiusX:1,radiusY:1,force:1}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touch(from)});
 for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touch({x:from.x+(to.x-from.x)*i/6,y:from.y+(to.y-from.y)*i/6})});await page.clock.runFor(16)}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.clock.runFor(160);
 const after=await snap();assert.equal(after.legions.length,before.legions.length+1,`${kind} drag must buy exactly one legion`);
 const purchased=after.legions.at(-1);assert.equal(purchased.kind,kind);assert.equal(purchased.x,x);assert.equal(purchased.y,y);assert.equal(after.gold,before.gold-(kind==='archer'?48:42));
 inputLog.push({type:'recruitDrag',kind,from,to,steps:6,id:purchased.id,x,y});await closeSelection();
}
if(!process.argv.includes('--empty')){await buy('archer',23,8);await buy('archer',23,12);await buy('shield',23,10);}
const waves=[];
for(let wave=1;wave<=7;wave++){
 if(wave>1){
  const choices=page.locator('#card-choices button');const preferred=page.locator('#card-choices button').filter({hasText:'巨型化'});const sharp=page.locator('#card-choices button').filter({hasText:'磨刃'});const chosen=await preferred.count()?preferred:await sharp.count()?sharp:choices.first();const cardName=await chosen.innerText();await tap(chosen);assert.equal(await page.locator('#cards').isVisible(),false);inputLog.push({type:'chooseCard',wave,cardName});
  const archer=(await snap()).legions.find(l=>l.kind==='archer');if(archer){await point(archer.x,archer.y);const assign=page.locator('#context button').filter({hasText:/^挂 /});if(await assign.count()){const card=await assign.first().innerText();await tap(assign.first());assert.equal(await assign.count(),0);inputLog.push({type:'assignCard',wave,legionId:archer.id,card});}await closeSelection()}
  for(const l of empty?[]:(await snap()).legions){await point(l.x,l.y);const promotion=page.locator('#context button').filter({hasText:/^晋升/});if(await promotion.count()&&await promotion.isEnabled()){await tap(promotion);assert.equal((await snap()).legions.find(u=>u.id===l.id)?.tier,l.tier+1,'Promotion must affect selected legion');inputLog.push({type:'promote',wave,id:l.id,tier:l.tier+1});}await closeSelection()}
  let n=0;while(!empty&&(await snap()).gold>=48&&n++<30){const i=(await snap()).legions.length;await buy('archer',21+i%4,5+Math.floor(i/4)*2)}
 }
 await tap(page.getByRole('button',{name:'开战',exact:true}));if(empty)await tap(page.getByRole('button',{name:'确认',exact:true}));assert.equal((await snap()).phase,'combat');
 if(wave===1)await page.screenshot({path:`output/${prefix}-combat.png`});
 for(let batch=0;batch<40&&(await snap()).phase==='combat';batch++)await page.clock.runFor(5000);
 const current=await snap();waves.push(current);console.log(`Wave ${wave}: ${current.phase} core=${current.coreHp}`);
 assert.notEqual(current.phase,'combat','Wave should finish');
 if(current.phase==='lost')break;
}
await page.screenshot({path:`output/${prefix}-result.png`});const result=await snap();assert.equal(result.phase,empty?'lost':'won');if(!empty)assert.equal(waves.length,7);assert.equal(await page.getByText(empty?'营地失守':'营地守住了',{exact:true}).isVisible(),true);
const profile=await page.evaluate(()=>JSON.parse(localStorage.getItem('little-guardians-h5.profile.v1')));assert.equal(profile.stats.wins,empty?0:1);assert.equal(profile.stats.runs,1);
await page.reload();await page.waitForFunction(()=>window.__guardians?.snapshot().ready);await tap(page.getByRole('button',{name:'继续营地',exact:true}));assert.equal((await snap()).phase,empty?'lost':'won');const afterReload=await page.evaluate(()=>JSON.parse(localStorage.getItem('little-guardians-h5.profile.v1')));assert.equal(afterReload.stats.wins,empty?0:1);assert.equal(afterReload.stats.runs,1);
assert.deepEqual(errors,[]);writeFileSync(`output/${prefix}-qa.json`,JSON.stringify({version:'0.1.1',viewport:{width:844,height:390},waves,result,profile,afterReload,inputLog,errors,input:'real CDP touch recruitment drag (six moves, one release), touchscreen selection, upgrade, card assignment and battle start; virtual browser clock only accelerates elapsed time'},null,2));
}catch(error){await page.screenshot({path:`output/${prefix}-failure.png`}).catch(()=>{});writeFileSync(`output/${prefix}-failure.json`,JSON.stringify({message:error.message,errors,inputLog,dom:await page.locator('body').innerText().catch(()=>''),snapshot:await page.evaluate(()=>window.__guardians?.snapshot()).catch(()=>null)},null,2));throw error;}finally{await browser.close();}


