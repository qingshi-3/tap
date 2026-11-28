import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch} from '../dist/js/engine.js';
import {SAVE_KEYS,LOCAL_DECKS_KEY} from '../dist/js/storage-keys.js';
import {RANKED_CHALLENGE,RANKED_CHALLENGE_KEY} from '../dist/js/ranked-challenge.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=fileURLToPath(new URL('../output/progress-improvements/ranked-prep/',import.meta.url));
const base=process.env.DECK_UI_BASE||'http://127.0.0.1:4200';
const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
const ordinary=new ExpeditionProgress(storage);assert(ordinary.selectHero(101).ok);
const profile=ordinary.state,ordinaryMatch=createExpeditionMatch('border-01',profile.training,profile.squad,101,ordinary.getBattleLoadout());assert(ordinary.saveBattle(ordinaryMatch).ok);
const ordinaryRaw=data.get(SAVE_KEYS.expedition);
const deckKey=`${LOCAL_DECKS_KEY}.2`,deckRaw=JSON.stringify({schemaVersion:1,factionId:2,deck:ordinary.state.factionDecks[2].slice(0,28)});
const challengeRaw=await readFile(new URL('./fixtures/ranked-challenge-v1-current.json',import.meta.url),'utf8');
const report={checks:[],errors:[],screens:[]};await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
async function tap(p,selector){await (typeof selector==='string'?p.locator(selector):selector).tap();await p.waitForTimeout(100);}
async function shot(p,name){await p.waitForTimeout(400);await p.screenshot({path:`${out}/${name}.png`});report.screens.push(`${name}.png`);}
async function unchanged(p){const actual=await p.evaluate(({key,deckKey})=>({profile:localStorage.getItem(key),deck:localStorage.getItem(deckKey)}),{key:SAVE_KEYS.expedition,deckKey});assert.equal(actual.profile,ordinaryRaw,'ordinary profile including selected hero and active battle unchanged byte-for-byte');assert.equal(actual.deck,deckRaw,'ordinary local deck unchanged byte-for-byte');}
async function target(p,selector){const m=await p.locator(selector).evaluate(n=>{const r=n.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y,right:r.right,bottom:r.bottom,clear:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===n};});const v=p.viewportSize();assert(m.w>=44&&m.h>=44&&m.x>=0&&m.y>=0&&m.right<=v.width+.5&&m.bottom<=v.height+.5&&m.clear,selector+JSON.stringify(m));}
async function leave(p){if(await p.locator('#objective-dialog[open]').isVisible())await tap(p,'#objective-close');await tap(p,'#leave-match');await tap(p,'#settings-leave-battle');await tap(p,'#confirm-accept');await p.locator('#platform-progress-dialog[open]').waitFor();}
async function detailGeometry(p){await target(p,'.challenge-card-dialog [data-action="close-card"]');for(const action of ['deck-add','deck-remove'])if(await p.locator(`.challenge-card-dialog [data-action="${action}"]`).isEnabled())await target(p,`.challenge-card-dialog [data-action="${action}"]`);const r=await p.locator('.challenge-card-dialog').boundingBox();assert(r.y>=0&&r.y+r.height<=p.viewportSize().height+.5,'entire detail dialog stays in safe viewport');}
try{
for(const [width,height,motion] of [[568,320,'reduce'],[844,390,'no-preference']]){
 const c=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:motion});const p=await c.newPage();p.on('pageerror',e=>report.errors.push(String(e)));
 await p.addInitScript(({key,ordinaryRaw,deckKey,deckRaw,challengeKey,challengeRaw})=>{if(!sessionStorage.getItem('ranked-fixture')){localStorage.setItem(key,ordinaryRaw);localStorage.setItem(deckKey,deckRaw);localStorage.setItem(challengeKey,challengeRaw);sessionStorage.setItem('ranked-fixture','1');}},{key:SAVE_KEYS.expedition,ordinaryRaw,deckKey,deckRaw,challengeKey:RANKED_CHALLENGE_KEY,challengeRaw});
 await p.goto(base);await p.locator('[data-action="leaderboard"]').waitFor();await unchanged(p);
 await tap(p,'[data-action="leaderboard"]');await p.locator('[data-challenge-action="start"]').waitFor();assert.match(await p.locator('.platform-progress-score').innerText(),/96010/);await target(p,'[data-challenge-action="start"]');await tap(p,'[data-challenge-action="start"]');
 await p.locator('[data-challenge="true"]').waitFor();assert.match(await p.locator('.challenge-prep-title').innerText(),/远征挑战/);assert.equal(await p.locator('[data-action="deck-show-unowned"]').count(),0);
 const loaner=RANKED_CHALLENGE.inventory.units.find(id=>!ordinary.state.inventory.units.includes(id)&&!JSON.parse(challengeRaw).deck.includes(id));assert(loaner,'fixture includes borrowed unit unavailable to ordinary account');assert(await p.locator(`.training-roster [data-card-id="${loaner}"][data-action="card-detail"]`).count(),'loaner visible independently of player ownership');
 await target(p,'[data-action="deck-recommend"]');await target(p,'[data-action="deck-default"]');await target(p,'[data-action="start"]');await shot(p,`loaner-${width}`);
 await tap(p,p.locator('.deck-card-list [data-action="deck-remove"]:enabled').first());
 const borrowed=p.locator('.training-roster .training-card').filter({has:p.locator(`[data-action="card-detail"][data-card-id="${loaner}"]`)});await borrowed.scrollIntoViewIfNeeded();assert(await borrowed.locator('[data-action="deck-add"]').isEnabled());await tap(p,borrowed.locator('[data-action="deck-add"]'));assert.match(await p.locator('.deck-total').innerText(),/30\/30/);assert(await p.locator(`.deck-card-list [data-card-id="${loaner}"]`).count(),'unowned player card actually added as loaner');
 await tap(p,'[data-action="deck-cost"][data-cost="2"]');const unitIds=await p.locator('.training-roster [data-action="card-detail"]').evaluateAll(ns=>ns.map(n=>Number(n.dataset.cardId)));
 assert(unitIds.length>0);assert(await p.locator('[data-action="deck-cost"][data-cost="2"]').getAttribute('aria-pressed')==='true');
 await tap(p,'[data-action="inventory-tab"][data-tab="spells"]');assert.equal(await p.locator('[data-action="deck-cost"][data-cost="2"]').getAttribute('aria-pressed'),'true');await tap(p,'[data-action="deck-cost"][data-cost="2"]');
 const spell=p.locator('.training-roster [data-action="card-detail"]').first();await tap(p,spell);await p.locator('.challenge-card-dialog[open]').waitFor();await detailGeometry(p);assert.equal(await p.locator('.challenge-card-dialog [data-action="train"],.challenge-card-dialog [data-action="train-spell"],.challenge-card-dialog [data-action="spell-mode"],.challenge-card-dialog [data-action="specialization"]').count(),0);await shot(p,`spell-rules-${width}`);await tap(p,'[data-action="close-card"]');
 await tap(p,'[data-action="inventory-tab"][data-tab="units"]');await tap(p,p.locator('.training-roster [data-action="card-detail"]').first());await p.locator('.challenge-card-dialog[open]').waitFor();await detailGeometry(p);assert.equal(await p.locator('.challenge-card-dialog [data-action="train"]').count(),0);await shot(p,`unit-rules-${width}`);await tap(p,'[data-action="close-card"]');
 const before=await p.locator('.deck-card-list').innerText();await tap(p,'[data-action="deck-recommend"]');const undo=p.locator('[data-action="deck-undo-recommend"]');if(await undo.count()){await tap(p,undo);assert.equal(await p.locator('.deck-card-list').innerText(),before);}await unchanged(p);
 await tap(p,'[data-action="return-mission"]');await p.locator('#platform-progress-dialog[open]').waitFor();await tap(p,'[data-challenge-action="start"]');await tap(p,'[data-action="start"]');await p.locator('#confirm-accept').waitFor({state:'visible'});await tap(p,'#confirm-accept');
 await p.locator('#objective-dialog[open]').waitFor({timeout:20000});await tap(p,'#objective-close');await p.locator('.opening-confirm').waitFor({state:'visible',timeout:20000});await target(p,'.opening-confirm');await shot(p,`opening-${width}`);await tap(p,'.opening-confirm');await p.locator('.opening-confirm').waitFor({state:'hidden'});await p.waitForTimeout(500);await unchanged(p);
 const started=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),RANKED_CHALLENGE_KEY);assert.equal(started.match.players[0].generalId,1);assert.equal(started.match.loadout.deck.length,30);assert(Object.values(started.match.training).every(rank=>rank===0));await shot(p,`battle-${width}`);
 await leave(p);await unchanged(p);assert(await p.locator('[data-challenge-action="resume"]').isVisible());await shot(p,`returned-hub-${width}`);await tap(p,'[data-challenge-action="resume"]');await p.locator('#match').waitFor({state:'visible'});await p.waitForTimeout(500);await unchanged(p);
 await leave(p);const saved=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),RANKED_CHALLENGE_KEY);await p.reload();await p.locator('[data-action="leaderboard"]').waitFor();await tap(p,'[data-action="leaderboard"]');await tap(p,'[data-challenge-action="resume"]');await p.locator('#match').waitFor({state:'visible'});await p.waitForTimeout(500);const restored=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),RANKED_CHALLENGE_KEY);assert.equal(restored.match.runId,saved.match.runId);assert.equal(restored.match.phase,saved.match.phase);await unchanged(p);await shot(p,`reloaded-${width}`);
 await leave(p);await tap(p,p.locator('#platform-progress-dialog').getByRole('button',{name:'关闭',exact:true}));assert.equal(await p.locator('[data-action="select-faction"][aria-pressed="true"]').getAttribute('data-faction-id'),'2');await unchanged(p);
 report.checks.push(`${width}x${height} ${motion}: hub/loaner prep, unit/spell filters and rules without cultivation, recommendation undo, actual opening, settings exit/hub/resume/reload, ordinary profile/local deck/hero/active battle bytes preserved`);await c.close();
}
}catch(error){report.errors.push(error.stack);for(const c of browser.contexts())for(const p of c.pages()){await shot(p,'failure');report.failureText=await p.locator('body').innerText();}}
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));if(report.errors.length)process.exitCode=1;
