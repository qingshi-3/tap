import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
import {EXPEDITION_LEVELS,EXPEDITION_CHAPTERS} from '../dist/js/expedition-data.js';
import {attackPositions,movementPositions,spellTargets,battleCommandTargets,getBattleCard,canUseHandCard} from '../dist/js/engine.js';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {getUnitSpecializations,getSpellUpgrade,getSpellTrainingPolicy} from '../dist/js/campaign-rules.js';
import {getHero} from '../dist/js/factions.js';
import {getCard} from '../dist/js/cards.js';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const{chromium}=require('playwright');
const faction=Number(process.env.PLAY_FACTION||1),hero=Number(process.env.PLAY_HERO||({1:1,2:101,3:201,4:301,5:401,6:501}[faction]));assert.equal(getHero(hero)?.faction,faction);
const browserOut=process.env.PLAY_OUTPUT?pathToFileURL(resolve(process.env.PLAY_OUTPUT)+'/'):new URL(`../output/content-expansion/browser/f${faction}-${Date.now()}/`,import.meta.url);
const isProbe=!!(process.env.PLAY_INPUT_PROBE||process.env.PLAY_OCCLUSION_PROBE||process.env.PLAY_ISOLATED_STAGE);
const out=isProbe?new URL('input-probes/',browserOut):browserOut;await mkdir(out,{recursive:true});
const sessionId=new Date().toISOString().replace(/[:.]/g,'-');await mkdir(new URL('segments/',out),{recursive:true});
try{const previous=await readFile(new URL('report.json',out),'utf8');await writeFile(new URL(`segments/before-${sessionId}.json`,out),previous);}catch{}
const policy=await import('./playthrough-policy.mjs');
const seed=Number(process.env.PLAY_SEED||17001),completionLimit=Number(process.env.PLAY_LEVEL_LIMIT||EXPEDITION_LEVELS.length),limit=Number(process.env.PLAY_ATTEMPT_LIMIT||completionLimit*3);
const preparation=process.env.PLAY_PREPARATION?JSON.parse(await readFile(process.env.PLAY_PREPARATION,'utf8')):null;
const stagePreparations=process.env.PLAY_STAGE_PLANS?JSON.parse(await readFile(process.env.PLAY_STAGE_PLANS,'utf8')):{};
const autoCardPlan=process.env.PLAY_AUTO_PREPARE==='1'?JSON.parse(await readFile(new URL('../output/content-expansion/card-plan.json',import.meta.url),'utf8')):null;
const policyOverrides=JSON.parse(process.env.PLAY_POLICY_OPTIONS||'{}');
const openingActions=process.env.PLAY_OPENING_ACTIONS?JSON.parse(await readFile(process.env.PLAY_OPENING_ACTIONS,'utf8')):[];let openingCursor=0;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:Number(process.env.PLAY_WIDTH||844),height:Number(process.env.PLAY_HEIGHT||390)},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
const page=await context.newPage(),cdp=await context.newCDPSession(page),report={sessionId,seed,touchGapMs:Number(process.env.PLAY_TOUCH_GAP||500),started:new Date().toISOString(),attempts:[],resourcesAdded:[],errors:[],limitations:['Read-only policy observes complete game state; this is assisted automated input, not human skill or timing.','Reduced motion and desktop Edge touch emulation; TapTap host is not verified.','Only real DOM/touch input mutates gameplay; no business action API is invoked.']};
if(process.env.PLAY_ISOLATED_STAGE){report.probeOnly=true;report.provenance={type:'isolated actual UI stage from engine natural entry',profile:process.env.PLAY_RESUME,engineSource:process.env.PLAY_ENGINE_SOURCE,notice:'Earlier history was produced by engine natural progression, not browser input. This branch only verifies this stage and actual card mechanisms.'};}
page.on('pageerror',e=>report.errors.push(e.message));
await page.addInitScript(seed=>{let v=seed>>>0;Math.random=()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296}},seed);
if(process.env.PLAY_RESUME){const saved=JSON.parse(await readFile(process.env.PLAY_RESUME,'utf8'));await page.addInitScript(({key,saved})=>localStorage.setItem(key,JSON.stringify(saved)),{key:SAVE_KEYS.expedition,saved});report.resume=process.env.PLAY_RESUME;}
await page.addInitScript(async()=>{const {ExpeditionProgress}=await import('/js/expedition-progress.js');const descriptor=Object.getOwnPropertyDescriptor(ExpeditionProgress.prototype,'state');Object.defineProperty(ExpeditionProgress.prototype,'state',{...descriptor,get(){const state=descriptor.get.call(this);window.__playObservedProfile=state;return state;}});});
await page.addInitScript(async()=>{const{BoardRenderer}=await import('/js/renderer.js');const draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__playRenderer=this;return draw.apply(this,args)}});
await page.addInitScript(()=>{window.__playInput=[];window.__playClickCount=0;for(const kind of ['pointerdown','pointerup','click'])document.addEventListener(kind,e=>{if(kind==='click')window.__playClickCount++;window.__playInput.push({kind,target:e.target.id||e.target.className,disabled:e.target.disabled,x:e.clientX,y:e.clientY,phase:window.__playRenderer?.state.phase});if(window.__playInput.length>100)window.__playInput.shift()},true)});
const snap=()=>page.evaluate(()=>JSON.parse(JSON.stringify(window.__playRenderer?.state)));
const profile=()=>page.evaluate(key=>{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):structuredClone(window.__playObservedProfile)},SAVE_KEYS.expedition);
async function save(name,value){const contents=JSON.stringify(value,null,2);await writeFile(new URL(name,out),contents);if(name==='report.json')await writeFile(new URL(`segments/${sessionId}.json`,out),contents);if(name.includes('-attempt-'))await writeFile(new URL(`segments/${sessionId}-${name}`,out),contents);}
async function shot(name){await page.screenshot({path:fileURLToPath(new URL(name,out))});await page.screenshot({path:fileURLToPath(new URL(`segments/${sessionId}-${name}`,out))});}
async function updateJourney(){
 if(isProbe||process.env.PLAY_FINISH_VERIFY)return;const state=await profile();if(!state?.schemaVersion)throw Error('Missing actual browser profile for journey accounting');
 let journey={};try{journey=JSON.parse(await readFile(new URL('journey.json',out),'utf8'));}catch{}
 journey.completedLevels=state.factionCompleted[faction];journey.settlements=state.settlements;journey.currentCoins=state.coins;journey.currentOrbs=state.recruitment.tickets;journey.coinsInjected=0;
 journey.coinsSpentTraining=Object.values(state.training).reduce((n,rank)=>n+[40,70,110,160].slice(0,rank).reduce((a,b)=>a+b,0),0)+Object.values(state.spellTraining).reduce((n,rank)=>n+[60,100].slice(0,rank).reduce((a,b)=>a+b,0),0);
 journey.coinEquation=`80 + ${Object.values(state.settlements).reduce((n,s)=>n+s.amount,0)} - ${journey.coinsSpentTraining} = ${state.coins}`;journey.latestSession=sessionId;journey.attempts||=[];
 for(const a of report.attempts.filter(a=>a.result)){const row={runId:a.runId,levelId:a.levelId,result:a.result,source:`segments/${sessionId}.json`};const i=journey.attempts.findIndex(v=>v.runId===a.runId);if(i>=0)journey.attempts[i]=row;else journey.attempts.push(row);}
 journey.status=journey.completedLevels.length===EXPEDITION_LEVELS.length?'actual UI campaign completed':report.stoppedAt?'actual gameplay loss; tactical review':'actual UI campaign in progress';await save('journey.json',journey);
}
async function summarizeJourney(){
 if(isProbe||process.env.PLAY_FINISH_VERIFY)return;
 const state=await profile(),rows=[];
 for(const directory of ['', 'segments/'])for(const name of await readdir(new URL(directory,out))){
  if(!name.endsWith('.json')||name==='journey.json'||name==='summary.json')continue;
  const source=directory+name;let doc;try{doc=JSON.parse(await readFile(new URL(source,out),'utf8'));}catch{continue;}if(doc?.probeOnly)continue;
  const entries=Array.isArray(doc?.attempts)?doc.attempts:doc?.runId&&Array.isArray(doc.actions)?[doc]:[];
  for(const entry of entries)if(entry.result?.phase==='over')rows.push({entry,source});
 }
 const unique=new Map();for(const row of rows){const old=unique.get(row.entry.runId);if(!old||row.entry.actions.length>old.entry.actions.length)unique.set(row.entry.runId,row);}
 for(const row of unique.values()){const stable=`segments/finished-${row.entry.runId}.json`;const rawRetainedSource=row.entry.rawRetainedSource||row.source;await save(stable,{...row.entry,rawRetainedSource});row.source=stable;}
 const attempts=[...unique.values()].sort((a,b)=>a.entry.started.localeCompare(b.entry.started)).map(({entry,source})=>{
  const battle=entry.profileAfter?.activeBattle,player=battle?.units.find(u=>u.owner===0&&u.cardId===battle.players[0].generalId),general=entry.result.generals?.find(u=>u.owner===0);
  return{runId:entry.runId,levelId:entry.levelId,result:entry.result.result,winner:entry.result.winner,rounds:entry.result.round,playerHP:general?.health??player?.health??(Array.isArray(entry.result.generals)&&entry.result.winner!==0?0:null),observedActionsInFinalSegment:entry.actions.length,source,policyOptions:entry.actions.at(-1)?.action.policy??null};
 });
 const wins=EXPEDITION_LEVELS.map((level,index)=>{const settlement=Object.entries(state.settlements).find(([,s])=>s.levelId===level.id),found=settlement&&attempts.find(a=>a.runId===settlement[0]);return{stage:index+1,levelId:level.id,completed:!!settlement,runId:settlement?.[0]??null,rounds:found?.rounds??null,playerHP:found?.playerHP??null,source:found?.source??null};});
 const summary={completedStages:state.factionCompleted[faction].length,totalFinishedAttempts:attempts.length,wins,failures:attempts.filter(a=>a.winner!==0),attempts,coins:state.coins,orbs:state.recruitment.tickets,notes:['Null means the value was not retained, never inferred.','Technical interrupts and probeOnly contexts are excluded from finished attempts.','observedActionsInFinalSegment excludes earlier same-run recovery segments; first stage warmup traces have a declared gap.','Settlement runIds are the authority for genuine wins and progression.']};
 assert.equal(attempts.filter(a=>a.winner===0).length,state.factionCompleted[faction].length,'Every actual settlement must have a retained winning UI segment');await save('summary.json',summary);
 const journey=JSON.parse(await readFile(new URL('journey.json',out),'utf8'));journey.attempts=attempts;journey.wins=wins;journey.totalFinishedAttempts=attempts.length;await save('journey.json',journey);
}
async function tap(selector){
 const el=page.locator(selector).first();await el.scrollIntoViewIfNeeded();
 const clicks=await page.evaluate(()=>window.__playClickCount||0);await el.tap();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 if(!selector.includes('hand-card')&&await el.isVisible()&&await page.evaluate(()=>window.__playClickCount||0)===clicks){
  (report.inputFriction??=[]).push({selector,issue:'first fresh tap after drag produced pointer events without click; second real tap used',time:new Date().toISOString()});await el.tap();
 }
}
async function idle(){await page.waitForFunction(()=>window.__playRenderer?.state.phase==='over'||(!document.querySelector('#end-turn').disabled&&window.__playRenderer?.state.currentPlayer===0),{},{timeout:60000});}
async function point(x,y,preferUnits=true,unitIds=null,moveDrop=false){
 const find=()=>page.evaluate(({x,y,preferUnits,unitIds,moveDrop})=>{const r=window.__playRenderer,b=r.canvas.getBoundingClientRect(),m=r.boardMetrics(b.width,b.height),c=r.cellGeometry(m,x,y).center,cards=[...document.querySelector('#hand').children],boundary=cards.length?Math.min(...cards.map(c=>c.getBoundingClientRect().top)):document.querySelector('#hand').getBoundingClientRect().bottom-80;for(const dy of [0,-8,-16,8,-24,16,24,-32,-40,-48,-56,32,40])for(const dx of [0,-16,16,-28,28,-40,40,-44,44]){const p={x:b.x+c.x+dx,y:b.y+c.y+dy},cell=r.positionFromPointer({clientX:p.x,clientY:p.y},{preferUnits,unitIds}),body=moveDrop?r.positionFromPointer({clientX:p.x,clientY:p.y}):cell;if((!moveDrop||(body?.x===x&&body?.y===y))&&p.y>=56&&p.x>=44&&p.x<=innerWidth-44&&p.y<boundary&&cell?.x===x&&cell?.y===y&&document.elementFromPoint(p.x,p.y)===r.canvas)return p}return null},{x,y,preferUnits,unitIds,moveDrop});
 let p=await find();if(p)return p;
 if(await page.locator('#map-open').isVisible()){
  await tap('#map-open');const box=await page.locator('#map-overview').boundingBox(),state=await snap();await page.touchscreen.tap(box.x+box.width*(x+.5)/state.board.columns,box.y+box.height*(y+.5)/state.board.rows);
 }else{
  const pan=await page.evaluate(({x,y})=>{const r=window.__playRenderer,b=r.canvas.getBoundingClientRect(),m=r.boardMetrics(b.width,b.height),c=r.cellGeometry(m,x,y).center;for(let sy=innerHeight*.3;sy<innerHeight*.66;sy+=30)for(let sx=innerWidth*.13;sx<innerWidth*.85;sx+=50){const pos=r.positionFromPointer({clientX:sx,clientY:sy});if(document.elementFromPoint(sx,sy)===r.canvas&&!r.state.units.some(u=>u.x===pos?.x&&u.y===pos?.y))return{from:{x:sx,y:sy},to:{x:sx+Math.max(-160,Math.min(160,innerWidth*.49-(b.x+c.x))),y:sy+Math.max(-90,Math.min(90,innerHeight*.49-(b.y+c.y)))}}}return null},{x,y});
  assert.ok(pan,'empty board point for pan');await drag(pan.from,pan.to);
 }
 p=await find();assert.ok(p,`No exposed board point ${x},${y}`);return p;
}
async function drag(from,to,card=false){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,id:1}]});if(card)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x,y:from.y-38,id:1}]});else await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+14,y:from.y-14,id:1}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(Number(process.env.PLAY_TOUCH_GAP||500));}
async function act(action,state){
 const signature=JSON.stringify({phase:state.phase,round:state.round,currentPlayer:state.currentPlayer,players:state.players,units:state.units,mulligan:state.mulligan});
 if(action.kind==='mulligan'){for(const i of action.mulliganIndices||[])await tap(`.opening-cards .hand-card:nth-child(${i+1})`);await tap('.opening-confirm');}
 else if(action.kind==='end-turn')await tap('#end-turn');
 else if(action.kind==='replace'){await tap(`.hand-card:nth-child(${action.handIndex+1})`);await tap('#replace-hand-card');}
 else if(action.kind==='move'){const u=state.units.find(u=>u.unitId===action.unitId);await point(u.x,u.y);await point(action.x,action.y,false,null,true);const from=await point(u.x,u.y),to=await point(action.x,action.y,false,null,true);await drag(from,to);}
 else if(action.kind==='attack'){const u=state.units.find(u=>u.unitId===(action.sourceId??action.unitId)),v=state.units.find(u=>u.unitId===action.targetId);await point(u.x,u.y);await point(v.x,v.y);const from=await point(u.x,u.y),to=await point(v.x,v.y);await drag(from,to);}
 else if(action.kind==='summon'||action.kind==='spell'){
  const composite=action.target;const target=composite?.unitIds?.[0]??composite?.unitId??action.target??action.targetId;let x=action.x,y=action.y;if(typeof target==='number'){const u=state.units.find(u=>u.unitId===target);assert.ok(u,'spell target exists');({x,y}=u);}else if(target&&typeof target==='object')({x,y}=target);
  if(x===undefined){const u=state.units.find(u=>u.owner===0);({x,y}=u);}
  const ids=action.kind==='spell'?spellTargets(state,getBattleCard(state,state.players[0].hand[action.handIndex],0),0).map(u=>u.unitId):null;
  const to=await point(x,y,action.kind!=='summon',ids),card=page.locator('.hand-card').nth(action.handIndex);await card.scrollIntoViewIfNeeded();const b=await card.boundingBox();await drag({x:b.x+b.width/2,y:b.y+Math.min(b.height/2,24)},to,true);
  if(action.kind==='spell'&&composite?.unitIds){const unit=state.units.find(u=>u.unitId===composite.unitIds[1]),pos=await point(unit.x,unit.y);await page.touchscreen.tap(pos.x,pos.y);}else if(action.kind==='spell'&&composite?.cell){const pos=await point(composite.cell.x,composite.cell.y,false);await page.touchscreen.tap(pos.x,pos.y);}
  if(action.kind==='summon'&&await page.locator('#inspect-followup-skip').isVisible()){
   if(action.openingTarget){const target=action.openingTarget;if(target.unitId){const unit=state.units.find(u=>u.unitId===target.unitId),pos=await point(unit.x,unit.y);await page.touchscreen.tap(pos.x,pos.y);}const cell=target.cell||(target.x!==undefined?target:null);if(cell){const follow=await point(cell.x,cell.y,false);await page.touchscreen.tap(follow.x,follow.y);}}else await tap('#inspect-followup-skip');
  }
 }else if(action.kind==='bbs'){await tap('#bbs-button');await tap('.command-preview-confirm');const command=battleCommandTargets(state,0);if(command.type!=='self'){const target=state.units.find(u=>u.unitId===(action.targetId??action.target)),cell=typeof action.target==='object'?action.target:action;const to=await point(target?.x??cell.x,target?.y??cell.y,command.type!=='cell',command.unitIds);await page.touchscreen.tap(to.x,to.y);}}
 else throw Error(`Unsupported UI action ${JSON.stringify(action)}`);
 await page.waitForFunction(signature=>{const s=window.__playRenderer.state;return JSON.stringify({phase:s.phase,round:s.round,currentPlayer:s.currentPlayer,players:s.players,units:s.units,mulligan:s.mulligan})!==signature},signature,{timeout:5000});
 await idle();
}
async function inputFallback(action,state,error){
 const alternatives=[];
 if(action.kind==='attack'){
  const source=state.units.find(u=>u.unitId===action.sourceId);
  alternatives.push(...attackPositions(state,source).filter(t=>t.unitId!==action.targetId).sort((a,b)=>(state.units.some(u=>u.unitId===b.unitId&&u.cardId===state.players[u.owner].generalId))-(state.units.some(u=>u.unitId===a.unitId&&u.cardId===state.players[u.owner].generalId))).map(t=>({...action,targetId:t.unitId})));
 }else if(action.kind==='move'){
  const source=state.units.find(u=>u.unitId===action.unitId);
  alternatives.push(...movementPositions(state,source).filter(p=>p.x!==action.x||p.y!==action.y).sort((a,b)=>Math.abs(a.x-action.x)+Math.abs(a.y-action.y)-Math.abs(b.x-action.x)-Math.abs(b.y-action.y)).slice(0,3).map(p=>({...action,x:p.x,y:p.y})));
 }
 for(const alternative of alternatives){try{await act(alternative,await snap());(report.inputFallbacks??=[]).push({round:state.round,recommended:action,actual:alternative,reason:error.message});return alternative;}catch(next){if(!next.message.includes('No exposed board point'))throw next;}}
 throw error;
}
function scriptedAction(state){
 while(openingCursor<openingActions.length){
  const step=openingActions[openingCursor];if(step.phase&&step.phase!==state.phase||state.phase==='mulligan'&&step.kind!=='mulligan')return null;
  if(step.maxRound!==undefined&&state.round>step.maxRound){openingCursor++;continue;}
  const a={...step};if(a.cardId!==undefined&&['spell','summon','replace'].includes(a.kind)){a.handIndex=state.players[0].hand.indexOf(a.cardId);if(a.handIndex<0){(report.openingNotes??=[]).push({step:openingCursor,skipped:'specified card is not in the actual hand',cardId:a.cardId});openingCursor++;continue;}}
  if(a.targetCardId!==undefined){const u=state.units.find(u=>u.cardId===a.targetCardId&&u.owner===(a.targetOwner??1));if(!u){openingCursor++;continue;}a.targetId=a.target=u.unitId;}
  if(['spell','summon'].includes(a.kind)&&!canUseHandCard(state,a.handIndex,0))return null;
  if(a.kind==='spell'&&a.target!=null&&!spellTargets(state,getBattleCard(state,a.cardId??state.players[0].hand[a.handIndex],0),0).some(u=>u.unitId===a.target)){(report.openingNotes??=[]).push({step:openingCursor,skipped:'specified spell target is not legal in the actual state'});openingCursor++;continue;}
  openingCursor++;return{...a,manualOpening:true};
 }
 return null;
}
async function startFirst(){
 await tap('.menu-play');if(await page.locator('.prep-start').count())return;
 const id=process.env.PLAY_START_LEVEL||'border-01',chapter=EXPEDITION_CHAPTERS.find(c=>c.levelIds.includes(id));
 await tap(`[data-action="chapter"][data-chapter-id="${chapter.id}"]`);await tap(`[data-action="level"][data-level-id="${id}"]`);await tap('[data-action="adjust-loadout"]');
}
function naturalPreparation(state){const archetype=autoCardPlan.archetypes.find(a=>a.heroId===hero)||autoCardPlan.archetypes.find(a=>a.faction===faction);assert.ok(archetype);const memory={data:new Map([[SAVE_KEYS.expedition,JSON.stringify(state)]]),getItem(k){return this.data.get(k)??null},setItem(k,v){this.data.set(k,String(v))},removeItem(k){this.data.delete(k)}},p=new ExpeditionProgress(memory);assert.equal(p.error,'');const starter=state.factionDecks[faction],owned=[...new Set(starter)],deck=[],replacements=[];for(const desired of archetype.deck){const d=getCard(desired),candidates=[desired,...owned.filter(id=>id!==desired).sort((a,b)=>{const score=id=>{const c=getCard(id);return(c.type!==d.type?100:0)+Math.abs(c.cost-d.cost)*5+['ranged','provoke','grow','flying'].filter(k=>!!c[k]!==!!d[k]).length};return score(a)-score(b)||a-b})],id=candidates.find(id=>(state.inventory.units.includes(id)||state.inventory.spells.includes(id))&&deck.filter(v=>v===id).length<3);assert.ok(id);deck.push(id);if(id!==desired)replacements.push({desired,replacement:id});}assert.ok(p.setBattleDeck(deck).ok);const plan={deck,purchases:[],specializations:{},reserveCoins:40,budget:Math.max(0,state.coins-40),archetype:archetype.name,replacements},priority=[...new Set([...(archetype.coreIds||[]).map(id=>replacements.find(r=>r.desired===id)?.replacement??id),...deck])].filter(id=>deck.includes(id)),units=priority.filter(id=>getCard(id).type==='unit'),spells=priority.filter(id=>getCard(id).type==='spell');const buy=(id,kind,rank)=>{const field=kind==='spell'?'spellTraining':'training';while(p.state[field][id]<rank){const a=p.getTrainingAvailability(id);if(!a.canTrain||state.coins-p.state.coins+a.cost>plan.budget)break;if(kind==='spell'){if(!getSpellTrainingPolicy(id).trainable)break;const n=p.state.spellTraining[id],before=getSpellUpgrade(id,n,'power'),after=getSpellUpgrade(id,n+1,'power');if(!['amount','attackBuff','healthBuff','heal','count','duration','maxAttack'].some(k=>typeof after[k]==='number'&&after[k]>Number(before[k]||0)))break;}const r=kind==='spell'?p.trainSpell(id):p.train(id);assert.ok(r.ok,r.error);plan.purchases.push({kind,cardId:id,rank:r.rank});}};for(const rank of [1,2])for(const id of units)buy(id,'unit',rank);for(const id of spells)buy(id,'spell',1);for(const rank of [3,4])for(const id of units)buy(id,'unit',rank);for(const id of spells)buy(id,'spell',2);for(const id of units){const c=getCard(id),opts=getUnitSpecializations(id,p.state.growthVersion[id]).filter(o=>p.state.training[id]>=o.rank),preferred=c.provoke?'bodyguard':c.ranged||c.backstab||c.flying?'skirmish':c.openingHeal?'medic':null,option=opts.find(o=>o.id===preferred)||opts[0];if(option)plan.specializations[id]=option.id;}return plan;}
async function prepare(selectedPlan=preparation,sourcePath=process.env.PLAY_PREPARATION){
 const preparation=selectedPlan||(autoCardPlan?naturalPreparation(await profile()):null);
 if(!preparation)return;
 report.preparation={source:sourcePath||'naturalPreparation: isolated read-only planning clone; purchases executed with DOM touch',plan:preparation,coinsBefore:(await profile()).coins,purchases:[],deck:preparation.deck};
 for(const purchase of preparation.purchases||[]){
  while(((await profile())[purchase.kind==='spell'?'spellTraining':'training'][purchase.cardId]||0)<purchase.rank){
  const current=await profile(),rank=current[purchase.kind==='spell'?'spellTraining':'training'][purchase.cardId]||0;if(rank>=purchase.rank)continue;
  await tap(`[data-action="inventory-tab"][data-tab="${purchase.kind==='spell'?'spells':'units'}"]`);await tap(`.${purchase.kind==='spell'?'spell-card-open':'training-card-open'}[data-card-id="${purchase.cardId}"]`);const selector=purchase.kind==='spell'?'[data-action="train-spell"]':'[data-action="train"]';await tap(selector);await tap('[data-action="close-card"]');
  const after=await profile();assert.equal(after[purchase.kind==='spell'?'spellTraining':'training'][purchase.cardId],rank+1,'Actual training purchase must advance exactly one rank');report.preparation.purchases.push({cardId:purchase.cardId,name:getCard(purchase.cardId)?.name,kind:purchase.kind,fromRank:rank,rank:after[purchase.kind==='spell'?'spellTraining':'training'][purchase.cardId],cost:current.coins-after.coins});
  }
 }
 const specs=preparation.specializations||preparation.profileBefore?.specializations||{};report.preparation.specializations=[];
 for(const [id,spec]of Object.entries(specs)){if(spec==='none'||(await profile()).specializations[id]===spec)continue;await tap('[data-action="inventory-tab"][data-tab="units"]');await tap(`.training-card-open[data-card-id="${id}"]`);await shot(`specialization-${id}.png`);await tap(`[data-action="specialization"][data-spec="${spec}"]`);await tap('[data-action="close-card"]');assert.equal((await profile()).specializations[id],spec);report.preparation.specializations.push({cardId:Number(id),spec,cost:0});}
 report.preparation.spellModes=[];
 for(const [id,mode]of Object.entries(preparation.spellModes||preparation.profileBefore?.spellModes||{})){if(mode==='base'||(await profile()).spellModes[id]===mode)continue;await tap('[data-action="inventory-tab"][data-tab="spells"]');await tap(`.spell-card-open[data-card-id="${id}"]`);await tap(`[data-action="spell-mode"][data-mode="${mode}"]`);await tap('[data-action="close-card"]');assert.equal((await profile()).spellModes[id],mode);report.preparation.spellModes.push({cardId:Number(id),mode,cost:0});}
 if(preparation.deck&&JSON.stringify((await profile()).factionDecks[faction])!==JSON.stringify(preparation.deck)){
  const state=await profile();for(const id of [...new Set(state.factionDecks[faction])])for(let i=0;i<state.factionDecks[faction].filter(card=>card===id).length-preparation.deck.filter(card=>card===id).length;i++)await tap(`[data-action="deck-remove"][data-card-id="${id}"]`);
  for(const id of [...new Set(preparation.deck)]){
   const missing=preparation.deck.filter(card=>card===id).length-state.factionDecks[faction].filter(card=>card===id).length;if(missing<=0)continue;
   const spell=getCard(id)?.type==='spell';await tap(`[data-action="inventory-tab"][data-tab="${spell?'spells':'units'}"]`);await tap(`.${spell?'spell-card-open':'training-card-open'}[data-card-id="${id}"]`);
   for(let i=0;i<missing;i++)await tap(`dialog[open] [data-action="deck-add"][data-card-id="${id}"]`);await tap('[data-action="close-card"]');
  }await tap('[data-action="deck-save"]');
  assert.deepEqual([...(await profile()).factionDecks[faction]].sort((a,b)=>a-b),[...preparation.deck].sort((a,b)=>a-b));
 }
 report.preparation.coinsAfter=(await profile()).coins;report.preparation.profileAfter=await profile();(report.preparations??=[]).push(report.preparation);await save('preparation.json',report.preparation);await save(`segments/${sessionId}-preparation-${report.preparation.profileAfter.completed.length}.json`,report.preparation);await save('resume-profile.json',report.preparation.profileAfter);await shot('prepared-deck.png');
}
try{
 await page.goto(process.env.PLAY_URL||'http://127.0.0.1:4227/');await page.locator('.menu-play').waitFor();
 if((await profile())?.selectedHeroId!==hero){await tap('[data-action="heroes"]');await tap(`[data-action="hero-faction"][data-faction-id="${faction}"]`);await tap(`[data-action="select-hero"][data-card-id="${hero}"]`);}
 if(process.env.PLAY_FINISH_VERIFY){
  const before=await profile(),count=Object.keys(before.settlements).length;assert.equal(before.factionCompleted[faction].length,Number(process.env.PLAY_VERIFY_COMPLETED||EXPEDITION_LEVELS.length));const targetLevel=before.factionCompleted[faction].at(-1),targetChapter=EXPEDITION_CHAPTERS.find(c=>c.levelIds.includes(targetLevel));
  await shot('finish-home-before-reload.png');await tap('.menu-play');await tap(`[data-action="chapter"][data-chapter-id="${targetChapter.id}"]`);await tap(`[data-action="level"][data-level-id="${targetLevel}"]`);
  await tap('[data-action="back"]');await tap('[data-action="nav"][data-page="menu"]');await shot('finish-return-menu.png');await page.reload();await page.locator('.menu-play').waitFor();await shot('finish-home-after-reload.png');
  await tap('.menu-play');await tap(`[data-action="chapter"][data-chapter-id="${targetChapter.id}"]`);await tap(`[data-action="level"][data-level-id="${targetLevel}"]`);await shot('finish-level-after-reload.png');
  const after=await profile();assert.deepEqual(after.factionCompleted,before.factionCompleted);assert.deepEqual(after.settlements,before.settlements);assert.equal(after.coins,before.coins);assert.equal(after.recruitment.tickets,before.recruitment.tickets);assert.deepEqual(after.battleRewards,before.battleRewards);
  report.finishVerification={passed:true,completed:before.factionCompleted[faction].length,coins:before.coins,orbs:before.recruitment.tickets,settlementCount:count,settlementsUnchanged:true,battleRewardsUnchanged:true,checks:['actual saved final profile loaded in isolated context','real menu/chapter/level/return input','real reload and level reopening','no additional rewards or settlement'],originalEndScreenshot:`${targetLevel}-result.png`};await save('finish-verification.json',report.finishVerification);await save('resume-profile.json',after);
 }else{
 const resumed=process.env.PLAY_RESUME&&(await profile()).activeBattle;
 if(resumed){await tap('.menu-play');if(resumed.phase==='over'){await page.locator('#game-result').waitFor({state:'visible'});await tap(resumed.winner===0&&process.env.PLAY_START_LEVEL!==resumed.levelId?'#next-level':'#result-prep');await prepare();}else await tap('#objective-close');}else {await startFirst();await prepare();}
 if(process.env.PLAY_OCCLUSION_PROBE){
  await page.waitForFunction(()=>window.__playRenderer?.ready);await idle();report.probeOnly=true;
  const original=await snap(),target=original.units.find(u=>u.unitId===Number(process.env.PLAY_PROBE_TARGET||4));assert.ok(target);
  const observe=()=>page.evaluate(({x,y})=>{const r=window.__playRenderer,b=r.canvas.getBoundingClientRect(),m=r.boardMetrics(b.width,b.height),c=r.cellGeometry(m,x,y),p={x:b.x+c.center.x,y:b.y+c.center.y};return{camera:{...r.camera},center:p,element:document.elementFromPoint(p.x,p.y)?.id}},target);
  const before=await observe();await shot(`pan-${Number(process.env.PLAY_WIDTH||844)}-before.png`);const panActions=[];
  for(let i=0;i<3;i++){const from=await page.evaluate(()=>{const r=window.__playRenderer;for(let y=innerHeight*.4;y<innerHeight*.65;y+=22)for(let x=innerWidth*.25;x<innerWidth*.75;x+=35){const p=r.positionFromPointer({clientX:x,clientY:y});if(document.elementFromPoint(x,y)===r.canvas&&!r.state.units.some(u=>u.x===p?.x&&u.y===p?.y))return{x,y};}return null});assert.ok(from,'empty board for single finger pan');const to={x:Math.max(48,from.x-180),y:Math.min(Number(process.env.PLAY_HEIGHT||390)*.7,from.y+70)};await drag(from,to);panActions.push({from,to,after:await observe()});}
  const exposed=await point(target.x,target.y);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...exposed,id:1}]});await page.waitForTimeout(750);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await shot(`pan-${Number(process.env.PLAY_WIDTH||844)}-selected.png`);
  const after=await observe();report.panProbe={source:report.resume,target,before,after,panActions,exposed,inspectionVisible:await page.locator('#unit-inspect').isVisible().catch(()=>false),gameStateUnchanged:JSON.stringify(await snap())===JSON.stringify(original),input:await page.evaluate(()=>window.__playInput)};if(process.env.PLAY_PROBE_ATTACK_SOURCE){await tap('#inspect-close');await shot(`pan-${Number(process.env.PLAY_WIDTH||844)}-after.png`);const action={kind:'attack',sourceId:Number(process.env.PLAY_PROBE_ATTACK_SOURCE),targetId:Number(process.env.PLAY_PROBE_ATTACK_TARGET||target.unitId)};await act(action,await snap());report.panProbe.attack={action,after:await snap(),actualInput:await page.evaluate(()=>window.__playInput)};await shot(`pan-${Number(process.env.PLAY_WIDTH||844)}-attack.png`);}await save(`pan-${Number(process.env.PLAY_WIDTH||844)}.json`,report.panProbe); }else
 journey: for(let attempt=0;attempt<limit;attempt++){
  if(await page.locator('.prep-start').isVisible()){
   const currentLevel=await page.locator('.prep-start').getAttribute('data-level-id');if(stagePreparations[currentLevel])await prepare(stagePreparations[currentLevel],process.env.PLAY_STAGE_PLANS);else if(autoCardPlan)await prepare();
   if(await page.locator('.prep-start').getAttribute('data-level-id')==='frost-02'&&process.env.PLAY_STAGE17_AFTER_FAILURE==='1'&&process.env.PLAY_STAGE17_PREPARATION){const path=process.env.PLAY_STAGE17_PREPARATION;await prepare(JSON.parse(await readFile(path,'utf8')),path);}
   await tap('.prep-start');await tap('#objective-close');
  }
  await page.waitForFunction(()=>window.__playRenderer?.ready);await idle();const opening=await snap(),entry={levelId:opening.levelId,runId:opening.runId,profileBefore:await profile(),actions:[],started:new Date().toISOString()};report.attempts.push(entry);
  await shot(`${opening.levelId}-opening.png`);
  if(process.env.PLAY_LONG_PRESS==='1'&&opening.units[0]){const pos=await point(opening.units[0].x,opening.units[0].y);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...pos,id:1}]});await page.waitForTimeout(750);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await shot(`${opening.levelId}-long-press.png`);entry.longPress={screenshot:`${opening.levelId}-long-press.png`,before:opening,after:await snap()};if(await page.locator('#inspect-close').isVisible())await tap('#inspect-close');}
  for(let i=0;i<1800;i++){
   const state=await snap();if(state.phase==='over')break;
   const options={lookahead:process.env.PLAY_LOOKAHEAD==='1',aggression:state.objective?.type==='survive'?.8:1.2,clockPressure:process.env.PLAY_CLOCK_PRESSURE==='1'&&state.objective?.type==='eliminate',...policyOverrides};if(options.counterGrowth17)options.counterGrowth17=state.levelId==='frost-02';report.policyOptions=options;
   let action=scriptedAction(state)||policy.chooseAction(state,options);if(!action)throw Error('Policy returned no action');report.pendingAction=action;const before=JSON.stringify(state);
   try{await act(action,state);}catch(error){if(error.message.includes('No exposed board point'))action=await inputFallback(action,state,error);else throw error;}
   const after=await snap();delete report.pendingAction;
   entry.actions.push({index:i,round:state.round,action,actualAction:after.lastAction,afterDigest:{phase:after.phase,round:after.round,currentPlayer:after.currentPlayer,mana:after.players[0].mana,hand:after.players[0].hand,units:after.units.map(({unitId,cardId,owner,x,y,health,maxHealth,attack,attackBuff,auraAttackBuff,auraHealthBuff,dervish,hatchCardId,movesUsed,attacksUsed,moved,attacked})=>({unitId,cardId,owner,x,y,health,maxHealth,attack,attackBuff,auraAttackBuff,auraHealthBuff,dervish,hatchCardId,movesUsed,attacksUsed,moved,attacked}))},changed:JSON.stringify(after)!==before});if(JSON.stringify(after)===before)throw Error(`UI action had no game effect: ${JSON.stringify(action)}`);
   if(isProbe&&process.env.PLAY_ACTION_LIMIT&&i+1>=Number(process.env.PLAY_ACTION_LIMIT)){report.probeOnly=true;report.actionWindow={actions:entry.actions,profileAfter:await profile(),after:await snap(),source:report.provenance};await save('action-window.json',report.actionWindow);await shot('action-window-after.png');break journey;}
   if(process.env.PLAY_INPUT_PROBE&&action.kind==='summon'){
    const clicks=await page.evaluate(()=>window.__playClickCount),prior=await snap();await page.locator('#end-turn').tap();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    report.inputProbe={touchGapMs:Number(process.env.PLAY_TOUCH_GAP||500),clickGenerated:await page.evaluate(()=>window.__playClickCount)>clicks,businessChanged:JSON.stringify(await snap())!==JSON.stringify(prior),trace:await page.evaluate(()=>window.__playInput),context:'CDP drag followed by Playwright touchscreen tap in desktop Edge; not physical TapTap'};
    report.probeOnly=true;await save(`input-probe-${report.inputProbe.touchGapMs}ms.json`,report.inputProbe);break journey;
   }
   if(i%15===0){await save(`${opening.levelId}-attempt-${attempt+1}.json`,entry);await save('resume-profile.json',await profile());await shot(`${opening.levelId}-checkpoint.png`);}
  }
  const final=await snap();entry.result={phase:final.phase,winner:final.winner,round:final.round,result:final.result,generals:final.units.filter(u=>final.players[u.owner]?.generalId===u.cardId).map(u=>({owner:u.owner,health:u.health,maxHealth:u.maxHealth,x:u.x,y:u.y}))};entry.profileAfter=await profile();entry.finished=new Date().toISOString();await page.locator('#game-result').waitFor({state:'visible'});await shot(`${opening.levelId}-result.png`);await save(`${opening.levelId}-attempt-${attempt+1}.json`,entry);await save('resume-profile.json',entry.profileAfter);await save('report.json',report);await updateJourney();
  console.log(JSON.stringify({levelId:entry.levelId,result:entry.result,actions:entry.actions.length,coins:entry.profileAfter.coins}));
  if(final.winner!==0){report.stoppedAt={levelId:entry.levelId,reason:'gameplay loss; separate tactical/turn-limit causes from resource shortage'};if(process.env.PLAY_RETRY==='1'&&attempt+1<limit){await tap('#result-prep');continue;}break;}
  if(entry.profileAfter.factionCompleted[faction].length>=completionLimit||attempt+1>=limit||!(await page.locator('#next-level').isVisible()))break;await tap('#next-level');
 }
 }
}catch(error){report.errors.push(error.stack);try{await save('failure-state.json',await snap());await save('failure-input.json',await page.evaluate(()=>window.__playInput));await save('resume-profile.json',await profile());await page.screenshot({path:fileURLToPath(new URL('failure.png',out))});}catch{}}
finally{report.finished=new Date().toISOString();await save('report.json',report);await updateJourney();await summarizeJourney();await browser.close();}
console.log(JSON.stringify({attempts:report.attempts.map(a=>({levelId:a.levelId,result:a.result,actions:a.actions.length})),stoppedAt:report.stoppedAt,errors:report.errors}));if(report.errors.length)process.exitCode=1;








