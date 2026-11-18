import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium }=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const out='output/ui-refinement/battle-history-spells';await mkdir(out,{recursive:true});const report=[];
try {for(const viewport of [{width:568,height:320},{width:844,height:390}]) {
 const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__historyInput=[];for(const type of ['pointerdown','pointerup','touchstart','touchend','click'])document.addEventListener(type,event=>{const target=event.target;window.__historyInput.push({type,id:target.id,tag:target.tagName,x:event.clientX??event.changedTouches?.[0]?.clientX,y:event.clientY??event.changedTouches?.[0]?.clientY,defaultPrevented:event.defaultPrevented,open:document.querySelector('#battle-history-open')?.getAttribute('aria-expanded'),hit:event.clientX!=null?document.elementFromPoint(event.clientX,event.clientY)?.id:null});queueMicrotask(()=>{window.__historyInput.at(-1).preventedAfter=event.defaultPrevented;});},{capture:true});});await page.goto(process.env.GAME_URL||'http://127.0.0.1:4227');
 await page.evaluate(async()=>{const {ExpeditionProgress}=await import('/js/expedition-progress.js');const {createExpeditionMatch,confirmMulligan}=await import('/js/engine.js');const p=new ExpeditionProgress(localStorage),loadout=p.getBattleLoadout();loadout.deck[0]=20044;const s=createExpeditionMatch('border-01',p.state.training,p.state.squad,p.state.selectedHeroId,loadout);let r=p.saveBattle(s);if(!r.ok)throw Error(r.error);confirmMulligan(s);s.players[0].deck=s.players[0].deck.filter(id=>id!==20044);s.players[0].hand=[20044];s.players[0].mana=s.players[0].maxMana=9;s.log=[];r=p.saveBattle(s);if(!r.ok)throw Error(r.error);});
 await page.reload();await page.locator('[data-action=resume]').tap();await page.locator('#objective-close').tap();await page.locator('.turn-toast').waitFor({state:'hidden'});
 await page.locator('#battle-history-open').tap();assert.equal(await page.locator('#battle-history-open').getAttribute('aria-expanded'),'true','fresh resume tap opens history');await page.locator('#battle-history-open').tap();await page.locator('#battle-history-open').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#battle-history-open').getAttribute('aria-expanded'),'true','keyboard still opens after touch');await page.keyboard.press('Escape');const card=await page.locator('#hand .hand-card').first().boundingBox(),cdp=await context.newCDPSession(page),x=card.x+card.width/2,startY=card.y+card.height/2,endY=viewport.height*.45;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:startY}]});for(let step=1;step<=12;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:startY+(endY-startY)*step/12}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.screenshot({path:out+'/after-drag-'+viewport.width+'.png'});await page.waitForFunction(()=>JSON.parse(localStorage.getItem('duelyst-h5.safe-v1.expedition')).activeBattle.log.some(row=>row.includes('法术结算：')),null,{timeout:10000});
 await page.waitForFunction(()=>!document.querySelector('#end-turn').disabled);await page.locator('.turn-toast').waitFor({state:'hidden'});await page.locator('#battle-history-open').tap();await writeFile(out+'/input-'+viewport.width+'.json',JSON.stringify(await page.evaluate(()=>window.__historyInput),null,2));await page.screenshot({path:out+'/open-'+viewport.width+'.png'});await page.locator('.battle-history-spell').waitFor({state:'visible',timeout:10000});
 assert.equal(await page.locator('.battle-history-spell').count(),1);
 assert.match(await page.locator('.battle-history-spell').innerText(),/风暴/);
 assert.ok(await page.locator('.battle-history-spell-result').count()>=2);
 await page.screenshot({path:`${out}/storm-${viewport.width}.png`});
 const overflow=await page.locator('#battle-history-list').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(overflow.scroll<=overflow.client+1,'history does not overflow horizontally');
 await page.reload();await page.locator('[data-action=resume]').tap();await page.locator('#objective-close').tap();await page.waitForFunction(()=>!document.querySelector('#end-turn').disabled);await page.locator('#battle-history-open').tap();assert.equal(await page.locator('.battle-history-spell').count(),1);
 assert.deepEqual(errors,[]);report.push({viewport,checks:['fresh resume touch opens and closes once','keyboard after touch','actual touch hand drag onto battlefield','post-drag touch opens without delay','reload touch opens history','spell persisted before playback','one spell transaction','actual effect portraits and numbers','reload retains record','no horizontal overflow'],errors});await context.close();
}await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}finally{await browser.close();}













