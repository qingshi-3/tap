import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const {ExpeditionProgress}=await import(pathToFileURL(root+'dist/js/expedition-progress.js'));
const {EXPEDITION_LEVELS,EXPEDITION_CHAPTERS}=await import(pathToFileURL(root+'dist/js/expedition-data.js'));
const {SAVE_KEYS}=await import(pathToFileURL(root+'dist/js/storage-keys.js'));
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=fileURLToPath(new URL('../output/campaign-atlas/',import.meta.url));await mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={checks:[],errors:[],screens:[]};
function seed(n){const s=new ExpeditionProgress({getItem(){return null},setItem(){}}).state;s.completed=EXPEDITION_LEVELS.slice(0,n).map(l=>l.id);s.factionCompleted[1]=[...s.completed];s.accountStageClaims=Object.fromEntries(s.completed.map(id=>[id,'legacy']));return s}
async function fixture(w,h,n=0,motion='reduce'){const c=await b.newContext({viewport:{width:w,height:h},hasTouch:true,reducedMotion:motion});const p=await c.newPage();p.on('pageerror',e=>report.errors.push(String(e)));await p.addInitScript(({s,k})=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem(k,JSON.stringify(s));sessionStorage.setItem('seeded','1')}},{s:seed(n),k:SAVE_KEYS.expedition});await p.goto(process.env.CAMPAIGN_UI_BASE || 'http://127.0.0.1:4227');await p.locator('.menu-play').tap();await p.locator('.campaign-atlas').waitFor();return{p,c}}
async function shot(p,name){await p.screenshot({path:out+'/'+name+'.png'});report.screens.push(name+'.png')}
async function target(p,selector){const d=await p.locator(selector).first().evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,visible:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,clear:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el}});assert.ok(d.w>=44&&d.h>=44&&d.visible&&d.clear,selector+JSON.stringify(d))}
try {
for(const [w,h] of [[568,320],[844,390],[1280,720]]){
 const {p,c}=await fixture(w,h);await shot(p,'selection-'+w);assert.equal(await p.locator('.atlas-level').count(),3);await target(p,'.atlas-start');assert.ok(await p.locator('.atlas-start').isEnabled());
 for(const l of EXPEDITION_LEVELS.slice(0,3)){await target(p,`.atlas-level[data-level-id="${l.id}"]`);await p.locator(`.atlas-level[data-level-id="${l.id}"]`).tap();assert.equal(await p.locator('.atlas-start').getAttribute('data-level-id'),l.id);assert.equal(await p.locator('.atlas-start').isDisabled(),l.id!=='border-01');}
 await shot(p,'selection-locked-'+w);
 await p.locator('.atlas-level[data-level-id="border-01"]').tap();await p.locator('.atlas-start').tap();await p.locator('[data-action="return-mission"]').waitFor();await p.locator('[data-action="return-mission"]').tap();assert.equal(await p.locator('.atlas-start').getAttribute('data-level-id'),'border-01');
 // Native touch scrolling should expose the final chapter without accidentally selecting one.
 const rail=await p.locator('.atlas-chapters').boundingBox();const cdp=await c.newCDPSession(p);
 for(let k=0;k<8;k++){const x=rail.x+rail.width-25,y=rail.y+rail.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-(rail.width-50)*i/6,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 const final=p.locator('[data-action="chapter"][data-chapter-id="'+EXPEDITION_CHAPTERS.at(-1).id+'"]');await final.tap();assert.equal(await p.locator('.atlas-start').getAttribute('data-level-id'),EXPEDITION_LEVELS[27].id);assert.ok(await p.locator('.atlas-start').isDisabled());await shot(p,'selection-final-locked-'+w);
 // Keyboard activation keeps focus on the selected chapter across re-render.
 await final.focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>document.activeElement.dataset.chapterId),EXPEDITION_CHAPTERS.at(-1).id);await p.keyboard.press('Tab');await shot(p,'selection-focus-'+w);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));report.checks.push(`${w}x${h}: fresh selection, all three targets, locked preview, prep return, actual touch chapter swipe, chapter keyboard focus, no page overflow`);await c.close();
}
for(const n of [16,30]){const{p,c}=await fixture(n===30?568:844,n===30?320:390,n,'no-preference');await shot(p,'selection-progress-'+n);assert.ok(await p.locator('.atlas-start').isEnabled());if(n===16)assert.equal(await p.locator('.atlas-start').getAttribute('data-level-id'),EXPEDITION_LEVELS[n].id);for(const ch of EXPEDITION_CHAPTERS){const bt=p.locator(`[data-action="chapter"][data-chapter-id="${ch.id}"]`);await bt.click();for(const id of ch.levelIds){await p.locator(`.atlas-level[data-level-id="${id}"]`).click();assert.equal(await p.locator('.atlas-start').getAttribute('data-level-id'),id);assert.ok(await p.locator('.atlas-level-name').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1)),'all stage names fit')}}report.checks.push(`progress ${n}: correct current stage and all 10 chapters / 30 levels inspectable`);await c.close()}
for (const [w,h] of [[568,320],[844,390]]) {
 const {p,c}=await fixture(w,h,16);
 await p.waitForTimeout(150);
 const selected=await p.locator('.atlas-chapter[aria-pressed="true"]').boundingBox(), rail=await p.locator('.atlas-chapters').boundingBox();
 assert.ok(selected.x>=rail.x-1 && selected.x+selected.width<=rail.x+rail.width+1,'current chapter fully visible');
 await target(p,'.atlas-intel'); await target(p,'.atlas-start'); await shot(p,'selection-progress-final-'+w);
 // Every visible chapter control stays below the host capsule.
 assert.ok(rail.y>=52,'chapter row clear of native capsule');
 await p.locator('.atlas-intel').tap();await target(p,'.atlas-dialog-close');
 const closeBox=await p.locator('.atlas-dialog-close').boundingBox();assert.ok(closeBox.y>=52 && closeBox.x+closeBox.width<=w-60,'dialog respects host and side safe areas');
 await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.className),'atlas-dialog-body');await p.keyboard.press('End');await p.waitForTimeout(100);assert.ok(await p.locator('.atlas-dialog-body').evaluate(el=>el.scrollTop>0),'enemy intelligence keyboard scroll');await p.keyboard.press('Home');await p.waitForTimeout(100);await shot(p,'selection-intel-'+w);
 await p.keyboard.press('Escape');assert.ok(await p.locator('.atlas-dialog').isHidden());assert.equal(await p.evaluate(()=>document.activeElement.className),'atlas-intel');
 await p.locator('[data-action="chapter"]').last().tap();await p.locator('.atlas-level').last().tap();await shot(p,'selection-final-locked-'+w);
 const box=await p.locator('.atlas-start').boundingBox();await p.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);assert.ok(await p.locator('.campaign-atlas').isVisible());
 await p.locator('.atlas-intel').tap();const db=await p.locator('.atlas-dialog-body').boundingBox();const cdp=await c.newCDPSession(p);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:db.x+db.width/2,y:db.y+db.height-15}]});
 for(let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:db.x+db.width/2,y:db.y+db.height-15-(db.height-30)*i/8}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(150);
 assert.ok(await p.locator('.atlas-dialog-body').evaluate(el=>el.scrollTop>0),'enemy intelligence touch scroll');await shot(p,'selection-intel-scrolled-'+w);await p.locator('.atlas-dialog-close').tap();
 await p.locator('[data-action="chapter"]').first().tap();await p.locator('.atlas-level').first().tap();await p.locator('.atlas-start').tap();await p.locator('[data-action="return-mission"]').tap();await shot(p,'selection-final-'+w);
 // Inspect geometry and overflowing text at the target viewport.
 const geometry=await p.locator('.atlas-level-name,.atlas-goal,.atlas-summary,.atlas-actions').evaluateAll(nodes=>nodes.map(el=>({c:el.className,t:el.textContent,w:el.clientWidth,sw:el.scrollWidth,h:el.clientHeight,sh:el.scrollHeight,b:el.getBoundingClientRect().bottom})));
 for(const g of geometry)assert.ok(g.sw<=g.w+1&&g.sh<=g.h+1&&g.b<=h,g.c+JSON.stringify(g));
 await p.locator('.atlas-start').focus();await shot(p,'selection-focus-final-'+w);const sb=await p.locator('.atlas-start').boundingBox();await p.mouse.move(sb.x+sb.width/2,sb.y+sb.height/2);await p.mouse.down();await shot(p,'selection-pressed-'+w);await p.mouse.move(0,h-1);await p.mouse.up();
 report.checks.push(`${w}x${h}: default active chapter fully visible, host capsule pocket, enemy dialog touch scroll / Escape / return focus, locked touch cannot start, prep return, rendered text bounds, focus and pressed states`);await c.close();
}
// Returning from preparation must still start the chosen actual encounter.
{const {p,c}=await fixture(844,390);await shot(p,'selection-final-fresh-844');await p.locator('.atlas-start').tap();await p.locator('.prep-start').tap();await p.locator('#match').waitFor({state:'visible'});await shot(p,'selection-enter-battle');report.checks.push('844x390: selection -> preparation -> actual battle displayed');await c.close()}
}catch(e){report.errors.push(e.stack);for(const c of b.contexts())for(const p of c.pages()){await shot(p,'selection-followup-failure');report.failureText=await p.locator('body').innerText()}}
await writeFile(out+'/report.json',JSON.stringify(report,null,2));await b.close();console.log(JSON.stringify(report,null,2));if(report.errors.length)process.exitCode=1;
