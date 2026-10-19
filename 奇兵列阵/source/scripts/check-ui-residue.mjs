import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=new URL('../../output/content-expansion/ui-residue/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
await context.addInitScript(()=>localStorage.setItem('zl_coach','drag,preview,hint'));
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const report={mode:process.env.RESIDUE_MODE||'before',errors};
try{
await page.goto(process.env.RESIDUE_URL||'http://127.0.0.1:8770/?debug');await page.getByRole('button',{name:'开始远征',exact:true}).tap();await page.locator('.gen-card').first().tap();await page.waitForTimeout(2500);
await page.evaluate(()=>{const g=window.__app.game;g.run.slots=[{defId:'v_wall',ownedId:1,copies:4},null,null,null,null];g.run.bench=[null,null];g.run.nextOwnedId=2;g.run.draft=['l_shield','m_rex','n_merc'];g.run.picks=2;g.run.stage=0;g.speed=3;g.renderAll();});
const cdp=await context.newCDPSession(page);
const stage=async(x,y)=>page.evaluate(({x,y})=>{const b=document.querySelector('#stage').getBoundingClientRect();return{x:b.left+x*b.width/1280,y:b.top+y*b.width/1280};},{x,y});
const center=async selector=>{const b=await page.locator(selector).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
const send=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:3,radiusY:3}))});
const first={...await center('.card:nth-child(1)'),id:1};
const bar={...await stage(600,610),id:1};
const second={...await center('.card:nth-child(2)'),id:2};
const secondMove={...second,x:second.x+12,y:second.y-12};
report.inventoryBefore=await page.evaluate(()=>JSON.stringify(window.__app.game.run));
await send('touchStart',[first]);await send('touchMove',[bar]);
report.ghostsFirst=await page.locator('.drag-ghost').count();
await send('touchStart',[bar,second]);await send('touchMove',[bar,secondMove]);
report.ghostsSecond=await page.locator('.drag-ghost').count();
await send('touchEnd',[secondMove]);await send('touchEnd',[]);await page.waitForTimeout(450);
report.ghostsAfterRelease=await page.locator('.drag-ghost').count();
report.inventoryUnchanged=await page.evaluate(before=>JSON.stringify(window.__app.game.run)===before,report.inventoryBefore);
await page.locator('.tray .fight').tap();
await page.waitForFunction(()=>document.querySelector('.bb-phase b')?.textContent==='第 4 拍',{},{timeout:18000});
report.ghostsBeat4=await page.locator('.drag-ghost').count();
report.visibleGhosts=await page.locator('.drag-ghost').evaluateAll(els=>els.map(el=>({transform:el.style.transform,connected:el.isConnected,animationCount:el.getAnimations().length,html:el.innerHTML.slice(0,180)})));
await page.screenshot({path:new URL(`${report.mode}-multitouch-battle.png`,out).pathname.replace(/^\/(\w:)/,'$1')});
writeFileSync(new URL(`${report.mode}-report.json`,out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
if(report.mode==='after'){
  assert.equal(report.ghostsAfterRelease,0);assert.equal(report.ghostsBeat4,0);assert.equal(report.inventoryUnchanged,true);assert.deepEqual(errors,[]);
  const cases=[];
  const inventory=async()=>page.evaluate(()=>JSON.stringify(window.__app.game.run));
  const clean=async label=>{assert.equal(await page.locator('.drag-ghost').count(),0,label);assert.equal(await page.locator('.lifted').count(),0,`${label}: lifted source`);cases.push(label);};
  const fixture=async()=>{await page.evaluate(()=>{
    const g=window.__app.game;g.pb?.cancel();g.pb=null;g.closeOverlay();g.sandbox=null;g.mode='prep';g.sel=null;g.targeting=null;g.focus=null;
    Object.assign(g.run,{slots:[{defId:'v_wall',ownedId:1,copies:4},null,null,null,null],bench:[{defId:'l_shield',ownedId:2,copies:1},null],nextOwnedId:3,draft:['l_shield','m_rex','n_merc'],picks:2,rerolls:1,stage:0,lives:3,wins:0,history:[],over:null,rewardedRetryCount:0,rewardedRerollCount:0});
    g.resetBattleUi();g.renderAll();g.setPaused(false);
  });await page.waitForTimeout(450);};
  const touch=async(a,b)=>{await send('touchStart',[{...a,id:1}]);for(let i=1;i<=8;i++){await send('touchMove',[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8,id:1}]);await page.waitForTimeout(18)}await send('touchEnd',[]);};
  const card=async i=>center(`.card:nth-child(${i+1})`);
  const slot=async i=>stage(540-i*110,300);
  const barPoint=await stage(600,610);
  // A non-owning finger cannot move or end the current recruit; the owner commits exactly once.
  await fixture();let primary={...await card(0),id:1};let target={...await slot(1),id:1};let other={...await card(1),id:2};
  await send('touchStart',[primary]);await send('touchMove',[target]);await send('touchStart',[target,other]);
  await send('touchEnd',[target]);
  await send('touchEnd',[]);assert.equal(await page.evaluate(()=>window.__app.game.run.picks),1);assert.equal(await page.evaluate(()=>window.__app.game.run.slots[1].defId),'l_shield');await clean('multitouch valid placement commits once without double consumption');
  // Normal invalid placement retains every card/resource, and its return naturally removes the node.
  await fixture();let before=await inventory();await touch(await card(0),barPoint);await page.waitForTimeout(300);assert.equal(await inventory(),before);await clean('invalid drop returns without consuming inventory');
  // Cancellation of the return animation must also remove its node (finished rejects on cancel).
  await touch(await card(0),barPoint);assert.equal(await page.locator('.drag-ghost').count(),1);await page.locator('.drag-ghost').evaluate(el=>el.getAnimations().forEach(a=>a.cancel()));await page.waitForTimeout(30);assert.equal(await inventory(),before);await clean('cancelled return animation removes actual node');
  // Touch cancellation removes the active preview without placing or consuming it.
  await send('touchStart',[{...await card(0),id:1}]);await send('touchMove',[{...await slot(1),id:1}]);await send('touchCancel',[]);assert.equal(await inventory(),before);await clean('touchCancel removes preview without consuming inventory');
  // A full inventory render invalidates its old source and tears down the held gesture.
  await send('touchStart',[{...await card(0),id:1}]);await send('touchMove',[{...barPoint,id:1}]);await page.keyboard.press('Escape');await send('touchEnd',[]);assert.equal(await inventory(),before);await clean('Escape cancels held gesture');
  // Real touch bench movement keeps the owned identity/copies, and does not consume recruitment.
  await touch(await center('.bench-slot[data-index="5"]'),await slot(2));assert.deepEqual(await page.evaluate(()=>[window.__app.game.run.slots[2].ownedId,window.__app.game.run.slots[2].copies,window.__app.game.run.picks]),[2,1,2]);
  await touch(await slot(2),await center('.bench-slot[data-index="5"]'));assert.equal(await inventory(),before);await clean('valid touch bench round trip preserves identity/copies/picks');
  // The battle transition owns teardown even when a finger is still holding a valid preview.
  await send('touchStart',[{...await card(0),id:1}]);await send('touchMove',[{...await slot(1),id:1}]);
  await page.locator('.tray .fight').focus();await page.keyboard.press('Enter');await send('touchEnd',[]);await clean('official start cancels held gesture and late release');assert.equal(await page.evaluate(()=>window.__app.game.run.picks),2);
  await page.getByRole('button',{name:'跳过',exact:true}).tap();await page.getByRole('button',{name:'复盘',exact:true}).waitFor();await page.waitForTimeout(400);await page.getByRole('button',{name:'复盘',exact:true}).tap();await page.waitForTimeout(450);
  // Sandbox reset and trial use the same lifecycle cleanup; these remain real keyboard commands.
  await send('touchStart',[{...await center('.bench-slot[data-index="5"]'),id:1}]);await send('touchMove',[{...await slot(1),id:1}]);await page.getByRole('button',{name:'还原站位',exact:true}).focus();await page.keyboard.press('Enter');await send('touchEnd',[]);await clean('sandbox restore cancels held gesture');
  await send('touchStart',[{...await center('.bench-slot[data-index="5"]'),id:1}]);await send('touchMove',[{...barPoint,id:1}]);await page.locator('.sandbox-panel .fight').focus();await page.keyboard.press('Enter');await send('touchEnd',[]);await clean('sandbox trial cancels held gesture');
  await page.getByRole('button',{name:'跳过',exact:true}).tap();await page.getByRole('button',{name:'再调整',exact:true}).waitFor();await page.waitForTimeout(400);await page.getByRole('button',{name:'再调整',exact:true}).tap();await page.waitForTimeout(450);await clean('sandbox result/adjust has no residue');
  await fixture();before=await inventory();await send('touchStart',[{...await card(0),id:1}]);await send('touchMove',[{...barPoint,id:1}]);
  // Browser focus change is an actual lifecycle event, independent of game internals.
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await send('touchEnd',[]);assert.equal(await inventory(),before);await clean('simulated host blur cancels held gesture');
  await send('touchStart',[{...await card(0),id:1}]);await send('touchMove',[{...barPoint,id:1}]);await page.evaluate(()=>window.__app.game.setPaused(true));await send('touchEnd',[]);await page.evaluate(()=>window.__app.game.setPaused(false));assert.equal(await inventory(),before);await clean('pause/resume lifecycle cancels held gesture');
  // Entering ad wait through the real button clears a preview; the mock controls only SDK completion.
  await page.evaluate(()=>{const g=window.__app.game;g.run.rerolls=0;g.renderAll();window.tap={createRewardedVideoAd(){return{onLoad(){},onError(){},onClose:f=>window.__residueAdClose=f,offLoad(){},offError(){},offClose(){},load:async()=>{},show:async()=>{},destroy(){}}}}});
  await send('touchStart',[{...await card(0),id:1}]);await send('touchMove',[{...barPoint,id:1}]);await page.getByRole('button',{name:'广告刷新',exact:true}).focus();await page.keyboard.press('Enter');await send('touchEnd',[]);await page.waitForFunction(()=>window.__app.game.mode==='rewardedAd');await clean('ad wait cancels held gesture');
  await page.evaluate(()=>window.__residueAdClose({isEnded:false}));await page.waitForFunction(()=>window.__app.game.mode==='prep');await clean('cancelled ad returns without residue');assert.equal(await page.evaluate(()=>window.__app.game.run.picks),2);
  // Dispose cancels active and returning previews, rather than leaving hidden orphan nodes.
  await fixture();await touch(await card(0),barPoint);await page.getByRole('button',{name:'放弃',exact:true}).focus();await page.keyboard.press('Enter');await page.locator('.confirm-btns').getByRole('button',{name:'放弃',exact:true}).tap();await page.getByRole('button',{name:'开始远征',exact:true}).waitFor();await clean('exit during invalid return removes preview');
  report.cases=cases;writeFileSync(new URL('after-report.json',out),JSON.stringify(report,null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({cases,errors}));
}
}finally{await browser.close()}

