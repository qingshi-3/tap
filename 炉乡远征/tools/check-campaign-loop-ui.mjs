import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
import {createExpeditionMatch,confirmMulligan} from '../dist/js/engine.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
import {PREMIUM_IDS} from '../dist/js/recruitment.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../output/campaign-integration/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const checks=[],errors=[],screens=[];
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
const fresh=new ExpeditionProgress(memory()).state;
function stageSeed(n=3){const s=structuredClone(fresh);s.completed=EXPEDITION_LEVELS.slice(0,n).map(l=>l.id);s.factionCompleted[1]=[...s.completed];s.accountStageClaims=Object.fromEntries(s.completed.map(id=>[id,'legacy']));s.coins=10000;return s;}
async function fixture(width,height,seed=fresh){const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(({seed,key})=>{if(!sessionStorage.getItem('campaign-ui-seed')){localStorage.setItem(key,JSON.stringify(seed));sessionStorage.setItem('campaign-ui-seed','1')}}, {seed,key:SAVE_KEYS.expedition});await page.addInitScript(async()=>{const {BoardRenderer}=await import('/js/renderer.js');const draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...a){window.__renderer=this;return draw.apply(this,a)}});await page.goto('http://127.0.0.1:4223');await page.locator('.menu-play').waitFor();return {context,page};}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEYS.expedition);
async function shot(page,name){await page.screenshot({path:fileURLToPath(new URL(name+'.png',out))});screens.push(name+'.png')}
async function tap(page,selector){await page.locator(selector).first().tap();}
async function target(page,selector){const d=await page.locator(selector).first().evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,clear:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el}});assert.ok(d.width>=44&&d.height>=44&&d.clear,selector+' touch '+JSON.stringify(d));}
async function mission(page){await tap(page,'.menu-play');await tap(page,'[data-action="chapter"]');await tap(page,'[data-action="level"]');}
async function closeObjective(page){await page.locator('#match').waitFor({state:'visible'});if(await page.locator('#objective-close').isVisible())await tap(page,'#objective-close');}
async function unitTap(page,id){const p=await page.evaluate(id=>{const r=window.__renderer,u=r.state.units.find(u=>u.unitId===id),b=r.canvas.getBoundingClientRect(),m=r.boardMetrics(b.width,b.height),c=r.cellGeometry(m,u.x,u.y).center;for(const dy of [0,-8,-16,8]){const x=b.x+c.x,y=b.y+c.y+dy,at=r.positionFromPointer({clientX:x,clientY:y});if(at?.x===u.x&&at?.y===u.y&&document.elementFromPoint(x,y)===r.canvas)return{x,y}}return null},id);assert.ok(p,'board exposed target '+id);await page.touchscreen.tap(p.x,p.y)}
try{
for(const [w,h] of (process.env.UI_TAIL_ONLY?[]:[[844,390],[568,320]])){
 const {context,page}=await fixture(w,h,stageSeed());
 for(let f=1;f<=6;f++){await tap(page,`[data-action="select-faction"][data-faction-id="${f}"]`);assert.match(await page.locator('.menu-faction-story').innerText(),new RegExp((f===1?3:0)+' / 18'));await target(page,`[data-action="select-faction"][data-faction-id="${f}"]`)}
 await tap(page,'[data-action="select-faction"][data-faction-id="1"]');await shot(page,`menu-${w}`);
 await mission(page);await shot(page,`mission-${w}`);await tap(page,'.mission-preview [data-action="adjust-loadout"]');await shot(page,`prep-${w}`);
 await tap(page,'[data-action="deck-remove"]');assert.match(await page.locator('.deck-total').innerText(),/29\/30/);assert.ok(await page.locator('[data-action="deck-save"]').isDisabled());assert.ok(await page.locator('.prep-start').isDisabled());await tap(page,'[data-action="deck-default"]');await tap(page,'[data-action="deck-save"]');await target(page,'.prep-start');await tap(page,'.prep-start');await closeObjective(page);await page.waitForFunction(()=>window.__renderer?.state?.schemaVersion===7);assert.equal(await page.evaluate(()=>window.__renderer.state.phase),'mulligan');await tap(page,'#end-turn');await page.waitForFunction(()=>window.__renderer.state.phase==='playing');await shot(page,`draw-battle-${w}`);const run=await page.evaluate(()=>window.__renderer.state.runId);await tap(page,'#end-turn');await page.waitForFunction(()=>window.__renderer.state.round>=2&&window.__renderer.state.phase==='playing',{},{timeout:25000});await page.reload();await tap(page,'.menu-play');await closeObjective(page);assert.equal(await page.evaluate(()=>window.__renderer.state.runId),run);checks.push(`${w}x${h}: six independent faction routes; mission→30-card draft invalid/save→schema7 mulligan→end-turn draw→reload resume; reduced motion`);await context.close();
}
{
 const seed=stageSeed();seed.training[14]=1;seed.recruitment.tickets=8;seed.recruitment.fragments[17]=10;seed.recruitment.focus=17;seed.recruitment.misses[17]=3;
 const {context,page}=await fixture(844,390,seed);
 await tap(page,'[data-page="codex"]');await tap(page,'.expedition-codex-card[data-card-id="14"]');await tap(page,'[data-action="train"]');assert.equal((await saved(page)).training[14],2);assert.equal(await page.locator('[data-action="specialization"]:enabled').count(),3);await tap(page,'[data-action="specialization"]:enabled:not([data-spec="none"])');await shot(page,'training-844');await page.keyboard.press('Escape');await tap(page,'[data-page="menu"]');await tap(page,'[data-action="recruitment"]');await shot(page,'recruit-844');await tap(page,'[data-recruitment-action="draw"]');assert.equal((await saved(page)).recruitment.fragments[17],12);assert.equal((await saved(page)).recruitment.misses[17],0);await tap(page,'[data-recruitment-action="tab"][data-tab="craft"]');await tap(page,'[data-recruitment-action="synthesize"][data-card-id="17"]');assert.ok((await saved(page)).inventory.units.includes(17));assert.equal((await saved(page)).recruitment.focus,null);await page.reload();assert.ok((await saved(page)).inventory.units.includes(17));checks.push('844: collection rank1→2 purchase, both specializations selectable, real premium pity3 guaranteed fragments→synthesis→reload');await context.close();
}
{
 const seed=stageSeed();seed.inventory.units.push(17);seed.recruitment.fragments[17]=4;
 const {context,page}=await fixture(568,320,seed);await tap(page,'[data-action="recruitment"]');await tap(page,'[data-recruitment-action="tab"][data-tab="craft"]');await page.locator('.recruitment-transfer-target').selectOption('116');await tap(page,'[data-recruitment-action="transfer"]');assert.equal((await saved(page)).recruitment.fragments[116],4);assert.equal((await saved(page)).recruitment.fragments[17],0);await shot(page,'recruit-transfer-568');await page.reload();assert.equal((await saved(page)).recruitment.fragments[116],4);checks.push('568: owned premium remaining fragments transfer 1:1 and persist');await context.close();
}

for(const [n,label] of [[2,'unlock'],[17,'complete']]){
 const storage=memory();storage.setItem(SAVE_KEYS.expedition,JSON.stringify(stageSeed(n)));const progress=new ExpeditionProgress(storage),level=EXPEDITION_LEVELS[n];
 const m=createExpeditionMatch(level.id,progress.state.training,progress.state.squad,progress.state.selectedHeroId,progress.getBattleLoadout());assert.ok(progress.saveBattle(m).ok);confirmMulligan(m);
 const player=m.units.find(u=>u.owner===0&&u.cardId===m.players[0].generalId),enemy=m.units.find(u=>u.owner===1&&u.cardId===m.players[1].generalId);
 m.units=m.units.filter(u=>u===player||u===enemy);player.x=4;player.y=2;enemy.x=5;enemy.y=2;enemy.health=1;const result=progress.saveBattle(m);assert.ok(result.ok,result.error);
 const {context,page}=await fixture(844,390,progress.state);await tap(page,'.menu-play');await closeObjective(page);await tap(page,'#focus-general');await unitTap(page,player.unitId);await unitTap(page,enemy.unitId);await page.locator('#game-result').waitFor({state:'visible'});await shot(page,'result-'+label);assert.ok((await saved(page)).factionCompleted[1].includes(level.id));
 if(n===2){await tap(page,'#next-level');assert.equal(await page.locator('.prep-start').getAttribute('data-level-id'),EXPEDITION_LEVELS[n+1].id);await tap(page,'[data-page="menu"]');await tap(page,'[data-page="codex"]');assert.ok(await page.locator('.expedition-codex-rail').isVisible());await tap(page,'[data-page="menu"]');await mission(page);await tap(page,'.mission-preview [data-action="adjust-loadout"]');assert.ok(await page.locator('.prep-start').isVisible());}
 else {assert.match(await page.locator('#result-progress').innerText(),/18/);await tap(page,'#result-prep');assert.ok(await page.locator('.prep-start').isVisible());}
 checks.push('844: real one-hit general select→attack result '+label+' and next-level/collection/prep return');await context.close();
}
{
 const seed=stageSeed();seed.inventory.spells=[...new Set([...seed.inventory.spells,20129,20073,20077,20061,20125,20144])];const {context,page}=await fixture(844,390,seed);await tap(page,'[data-page="codex"]');await tap(page,'.expedition-codex-card[data-card-id="14"]');assert.ok(await page.locator('[data-action="train"]').isEnabled());await tap(page,'[data-action="train"]');await tap(page,'[data-action="train"]');assert.ok(await page.locator('[data-action="train"]').isDisabled());assert.match(await page.locator('.training-detail').innerText(),/第9关/);await page.keyboard.press('Escape');
 for(const [id,f] of [[20129,2],[20073,3],[20077,3],[20061,4],[20125,5],[20144,6]]){await tap(page,`[data-action="codex-faction"][data-faction-id="${f}"]`);await tap(page,'[data-action="collection-scope"][data-scope="all"]');await tap(page,`.expedition-codex-card[data-card-id="${id}"]`);if(await page.locator('[data-action="collection-faction"]').count())await tap(page,'[data-action="collection-faction"]');assert.ok(await page.locator('[data-action="train-spell"]').isDisabled());await page.keyboard.press('Escape');}
 checks.push('844: rank3 stage9 purchase gate and six spell cards training disabled');await context.close();
}

{
 const storage=memory(),progress=new ExpeditionProgress(storage);const m=createExpeditionMatch('border-01',progress.state.training,progress.state.squad,1,progress.getBattleLoadout());assert.ok(progress.saveBattle(m).ok);confirmMulligan(m);
 const player=m.units.find(u=>u.owner===0&&u.cardId===1),enemy=m.units.find(u=>u.owner===1&&u.cardId===m.players[1].generalId);m.units=m.units.filter(u=>u===player||u===enemy);player.x=4;player.y=2;player.health=1;enemy.x=5;enemy.y=2;assert.ok(progress.saveBattle(m).ok);
 const {context,page}=await fixture(568,320,progress.state);await tap(page,'.menu-play');await closeObjective(page);await tap(page,'#end-turn');await page.locator('#game-result').waitFor({state:'visible',timeout:25000});assert.match(await page.locator('#result-title').innerText(),/失败|败北|战败/);await shot(page,'result-fail-568');await tap(page,'#result-prep');assert.ok(await page.locator('.prep-start').isVisible());checks.push('568: real end-turn AI kills 1-health general→defeat→prep');await context.close();
}

} catch(e){errors.push(e.stack);for(const c of browser.contexts())for(const p of c.pages()){await shot(p,'failure');errors.push(await p.locator('body').innerText())}}finally{await writeFile(new URL('ui-report.json',out),JSON.stringify({checks,errors,screens,unverified:['multi-target spells','TapTap host abilities','keyboard focus cycle beyond dialog Escape restoration']},null,2));await browser.close();}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}else console.log(checks.join('\n'));



