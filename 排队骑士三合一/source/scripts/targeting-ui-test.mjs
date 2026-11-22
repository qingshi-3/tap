// Authored legal seed fixtures; expected targets are derived independently from engine events.
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.BASE_URL??'http://127.0.0.1:4175',output='output/targeting-ui';
mkdirSync(`${output}/screenshots`,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[],fixtures=[];let page,size;
const ok=(v,m)=>{if(!v)throw Error(m);};
async function shot(name){const path=`${output}/screenshots/${size}-${name}.png`;await page.screenshot({path});return path;}
async function step(name,fn){if(process.env.UI_STEPS&&!process.env.UI_STEPS.split(',').includes(name))return;try{results.push({size,name,ok:true,detail:await fn()});console.log(`PASS ${size} ${name}`);}catch(e){results.push({size,name,ok:false,error:String(e),screenshot:await shot(`FAIL-${name}`)});console.log(`FAIL ${size} ${name}: ${e}`);}}
async function saved(){return page.evaluate(()=>localStorage.getItem('pdqs3_run_v5'));}
async function markers(){return page.locator('.target-glow').evaluateAll(els=>els.map(el=>({side:+el.dataset.side,slot:+el.dataset.slot,kind:el.dataset.targetKind,uid:el.dataset.targetUid,cls:el.className,color:getComputedStyle(el).color,animation:getComputedStyle(el).animationName,duration:getComputedStyle(el).animationDuration,pointer:getComputedStyle(el).pointerEvents,width:getComputedStyle(el).width,svg:el.querySelector('svg')?.outerHTML})));}
const keys=xs=>[...new Set(xs.map(x=>`${x.side}:${x.slot}`))].sort();
async function expected(focus=null){return page.evaluate(async focus=>{
 const m=await import('/src/core/run.ts'),e=await import('/src/core/engine.ts');const r=structuredClone(m.load());m.endTurn(r);
 const out=e.simulate(m.playerTeam(r),r.enemy.units,m.curNode(r)?.battleSeed??r.seed,r.relics,m.simOpts(r));
 const positions=new Map(),sides=new Map(),slots=r.queue.flatMap((u,i)=>u?[i]:[]);
 out.init.forEach(u=>{const i=out.initOrder[u.side].indexOf(u.uid);positions.set(u.uid,{side:u.side,slot:u.side===0?slots[i]:i});sides.set(u.uid,u.side);});
 let clash=0;const hits=[];let source=null,firstPhase=null,firstMelee=null;
 for(let i=0;i<out.events.length;i++){
  const v=out.events[i];if(v.t==='summon')sides.set(v.unit.uid,v.unit.side);if(v.t==='clash')clash++;
  const enemyHit=v.t==='dmg'&&v.kind!=='burn'&&v.src!=null&&sides.has(v.src)&&positions.has(v.tgt)&&sides.get(v.src)!==sides.get(v.tgt);
  if(focus){
   if(enemyHit&&positions.get(v.src)?.side===focus.side&&positions.get(v.src)?.slot===focus.slot){if(firstPhase===null){firstPhase=clash;firstMelee=v.kind==='melee';}if(firstPhase===clash&&firstMelee===(v.kind==='melee'))hits.push({...positions.get(v.tgt),kind:v.kind==='melee'?'melee':clash===0?'opening':'skill'});}
  }else if(enemyHit&&(clash===0||clash===1&&v.kind==='melee'))hits.push({...positions.get(v.tgt),kind:v.kind==='melee'?'melee':'opening'});
 }
 return {hits,seed:r.worldSeed,events:out.events,init:out.init,initOrder:out.initOrder};
},focus);}
async function fixture(mode){
 await page.goto(base);
 const info=await page.evaluate(async mode=>{
  const m=await import('/src/core/run.ts'),d=await import('/src/core/data.ts');let r;
  const need=mode==='no-hunt'?['wheel','charge']:mode==='battle'?['wheel','charge','hunt','nest']:['wheel','charge','hunt'];
  for(let seed=1;seed<10000;seed++){const c=m.newRun(seed);if(need.every(id=>c.activeArchetypes.includes(id))&&(mode!=='no-hunt'||!c.activeArchetypes.includes('hunt'))){r=c;break;}}
  if(!r)throw Error('legal seed missing');r.act=2;r.gold=12;r.tavern=6;
  function route(layer,choices,path=[]){for(const i of choices){const n=r.map[layer][i],p=[...path,i];if(n.enemy&&n.k!=='boss'&&(mode==='no-hunt'?layer>=1:layer===4&&n.enemy.units.length>=3))return p;if(layer<4){const x=route(layer+1,n.next,p);if(x)return x;}}}
  const path=route(0,m.nodeOpts(r));if(!path)throw Error('legal encounter missing');r.layer=path.length-1;r.path=path.slice(0,-1);r.turn=m.actTurn(r.act,r.layer);m.pickNode(r,path.at(-1));
  const pool=m.activeCardPool(r),legal=id=>{if(!pool.some(c=>c.id===id))throw Error(`illegal fixture card ${id}`);return id;};
  const clean=pool.filter(c=>!c.rules?.some(x=>x.phase==='battle'&&x.target==='quarry'));
  let ids=['rw_charge_bunker','rw_charge_sling','rw_wheel_lancer','rw_wheel_marshal',clean[0].id];
  if(mode==='rear')ids[0]='rw_wheel_lancer';
  if(mode==='all'||mode==='sparse'||mode==='battle')ids[0]='rw_wheel_marshal';
  if(['front','food','relic','quarry'].includes(mode))ids[0]='rw_charge_sling';
  r.queue=ids.map(id=>({oid:r.nextId++,def:legal(id),copies:1,atkBonus:0,hpBonus:0}));
  r.event=null;r.relicPick=null;r.relicDue=0;r.chest=null;r.pendingFx=[];r.firstRelicGiven=true;r.shop=[];r.bag=[];r.relics=[];
  function feed(id,slot){const sid=r.nextId++;r.shop.push({sid,kind:'food',def:id,free:true,locked:false});if(!m.useFood(r,sid,slot).ok)throw Error(`food intake failed ${id}`);}
  if(mode==='gear'){r.queue[0].ench='e_field_cannon';}
  if(['front','gear','food','relic','quarry'].includes(mode))feed('f_powder',0);
  if(mode==='food')feed('f_siege_fuse',0);
  if(mode==='relic'){r.relics=['r_quarry_writ'];feed('f_quarry_salt',0);r.quarry=2;}
  if(mode==='quarry'){r.queue[0].ench='e_hunting_scope';r.queue[1].def=legal('rw_hunt_spotter');feed('f_siege_fuse',0);r.quarry=0;}
  if(mode==='battle'){r.queue[3].def=legal('rw_nest_hatch');r.queue[4]=null;}
  if(mode==='sparse'){r.queue[2]=r.queue[0];r.queue[0]=null;r.queue[1]=null;}
  m.save(r);if(!m.load())throw Error(`v5 fixture rejected ${mode}`);
  return {mode,seed:r.worldSeed,activeArchetypes:r.activeArchetypes,queue:r.queue,enemy:r.enemy,relics:r.relics,quarry:r.quarry};
 },mode);
 fixtures.push({size,...info});await page.reload();await page.getByRole('button',{name:'继续游戏',exact:true}).click();await page.locator('.hud-archetypes').waitFor();await page.locator('.unit.side-0').first().waitFor({state:'visible'});await page.waitForTimeout(1700);return info;
}
async function closeTip(){await page.mouse.click(8,8);}
async function checkTargets(focus=null){const exp=await expected(focus),actual=await markers();ok(JSON.stringify(keys(actual))===JSON.stringify(keys(exp.hits)),`targets mismatch ${JSON.stringify({focus,actual:keys(actual),expected:keys(exp.hits)})}`);return {actual,expected:exp.hits};}
try{for(const viewport of [{width:844,height:390},{width:720,height:360}]){
 size=`${viewport.width}x${viewport.height}`;const context=await browser.newContext({viewport});page=await context.newPage();page.setDefaultTimeout(7000);
 page.on('pageerror',e=>errors.push({size,type:'pageerror',text:String(e)}));page.on('console',e=>{if(e.type()==='error')errors.push({size,type:'console',text:e.text()});});page.on('response',r=>{if(r.status()>=400)errors.push({size,type:'http',status:r.status(),url:r.url()});});
 for(const mode of ['no-hunt','hunt-open'])await step(`irrelevant-${mode}`,async()=>{
  const info=await fixture(mode),before=await saved();ok(await page.locator('.is-quarry').count()===0,'irrelevant quarry badge');
  for(const side of [1,0]){const units=page.locator(`.unit.side-${side}`);for(let i=0;i<await units.count();i++){await units.nth(i).click();await checkTargets({side,slot:+(await units.nth(i).getAttribute('data-slot'))});ok(await page.locator('.quarry-select').count()===0,'irrelevant quarry action');const text=await page.locator('.tip').allTextContents();ok(!text.join('').includes('将它标为猎物')&&!text.join('').includes('猎标结算'),'irrelevant tutorial');if(i===0)await shot(`${mode}-${side===1?'enemy':'ally'}-detail`);await closeTip();}}
  ok(before===await saved(),'detail changed save');return {seed:info.seed,screenshot:await shot(mode),...await checkTargets()};
 });
 for(const mode of ['front','rear','all','gear','food','relic','sparse'])await step(`target-${mode}`,async()=>{
  const info=await fixture(mode),before=await saved(),data=await checkTargets();ok(data.actual.length>0,'missing original reticle');for(const a of data.actual){ok(a.width==='78px'&&a.animation==='aim, aimPulse'&&a.duration==='3s, 1.4s'&&a.pointer==='none'&&a.svg,'reticle styling mismatch');ok(a.color===(a.side===1?'rgb(255, 211, 107)':'rgb(255, 75, 110)'),'reticle color mismatch');}
  const screenshot=await shot(mode);
  const units=page.locator('.unit.side-0');for(let i=0;i<await units.count();i++){const u=units.nth(i),slot=+(await u.getAttribute('data-slot'));await u.click();await checkTargets({side:0,slot});await closeTip();}
  await checkTargets();ok(before===await saved(),'focus changed save');return {seed:info.seed,...data,screenshot};
 });

 await step('responsive-reticle-alignment',async()=>{
  await fixture('all');const checks=[];
  for(const v of [viewport.width===844?{width:720,height:360}:{width:844,height:390},viewport]){
   await page.setViewportSize(v);await page.waitForTimeout(150);
   const geometry=await page.locator('.target-glow').evaluateAll(els=>els.map(el=>{const unit=document.querySelector(`.unit.side-${el.dataset.side}[data-slot="${el.dataset.slot}"]`);const p={x:parseFloat(unit.style.left),y:parseFloat(unit.style.top)-12};return {side:+el.dataset.side,slot:+el.dataset.slot,left:parseFloat(el.style.left),top:parseFloat(el.style.top),expected:p};}));
   ok(geometry.length>0,'resize lost targets');for(const g of geometry)ok(g.left===g.expected.x&&g.top===g.expected.y,`resize target body alignment ${JSON.stringify({viewport:v,geometry})}`);checks.push({viewport:v,geometry});
  }
  await shot('resize-restored');return checks;
 });
 await step('quarry-selection',async()=>{
  const info=await fixture('quarry');ok(await page.locator('.unit.side-1.is-quarry').count()===1,'quarry count');const before=await checkTargets();await page.locator('.unit.side-1[data-slot="2"]').click();await page.getByRole('button',{name:'指定猎物',exact:true}).click();
  const r=JSON.parse(await saved());ok(r.quarry===2,'quarry selection not saved');ok(await page.locator('.unit.side-1.is-quarry[data-slot="2"]').count()===1,'new quarry badge');const after=await checkTargets();await shot('selected-quarry');return {seed:info.seed,before,after};
 });

 await step('contextual-hunt-rule-help',async()=>{
  await fixture('quarry');const before=await saved();
  await page.locator('.unit.side-0[data-slot="1"]').click();
  ok(await page.locator('.tip-rules').count()===0,'legacy rules disclosure remains');
  const hunter = page.locator('.tip.on [data-keyword="猎标"][role="button"]').first();
  await hunter.click();
  ok(await page.locator('.keyword-explanation').count()===1,'hunter explanation count');
  const related=await page.locator('.keyword-explanation').innerText();
  ok(related.includes('交锋')&&related.includes('身后')&&related.includes('1'),'hunter contextual mechanics missing');
  await shot('hunt-related-keyword');await closeTip();
  await page.locator('.unit.side-0[data-slot="2"]').click();ok(await page.locator('.tip-hunt-rule').count()===0,'unrelated ally hunt rule exists');const unrelated=await page.locator('.tip').innerText();ok(!unrelated.includes('猎标结算')&&!unrelated.includes('转移给身后')&&!unrelated.includes('传给身后'),'unrelated ally contains generic hunt guide');await closeTip();
  await page.locator('.unit.side-1').first().click();ok(await page.locator('.tip-hunt-rule').count()===0,'unrelated enemy hunt rule exists');const enemy=await page.locator('.tip').innerText();ok(!enemy.includes('猎标结算')&&!enemy.includes('转移给身后')&&!enemy.includes('传给身后'),'unrelated enemy contains generic hunt guide');await shot('quarry-action-no-generic-tutorial');await closeTip();ok(before===await saved(),'help changed save');
  await page.goto(base);await page.getByRole('button',{name:'图鉴',exact:true}).click();await page.getByRole('button',{name:'规则',exact:true}).click();await page.locator('.cx-tile[data-key="猎标"]').click();const codex=await page.locator('.cx-dt').innerText();ok(codex.includes('交锋')&&codex.includes('身后')&&codex.includes('1'),'codex hunt mechanics missing');await shot('codex-hunt-rule');return {related,unrelated,enemy,codex,savePreserved:true};
 });
 await step('battle-and-trial-cleanup',async()=>{
  const info=await fixture('battle'),exp=await expected();
  await page.evaluate(()=>{window.__aimSamples=[];window.__aimObserver=new MutationObserver(()=>{const els=[...document.querySelectorAll('.target-glow[data-target-uid]')];if(els.length)window.__aimSamples.push({time:performance.now(),markers:els.map(el=>({uid:+el.dataset.targetUid,side:+el.dataset.side,slot:+el.dataset.slot,kind:el.dataset.targetKind}))});});window.__aimObserver.observe(document.body,{subtree:true,childList:true});});
  await page.getByRole('button',{name:/开 战/}).click();await page.getByRole('button',{name:'跳过',exact:true}).waitFor();await page.waitForFunction(()=>window.__aimSamples.length>0);await shot('battle-reticles');await page.waitForTimeout(8000);await page.getByRole('button',{name:'跳过',exact:true}).click();await page.locator('.res-review').waitFor({timeout:15000});ok(await page.locator('.target-glow').count()===0,'skip retained reticles');await shot('battle-skip-cleared');
  const samples=await page.evaluate(()=>{window.__aimObserver.disconnect();return window.__aimSamples;});const all=new Set(exp.init.map(u=>u.uid));for(const e of exp.events)if(e.t==='summon')all.add(e.unit.uid);for(const sample of samples)for(const m of sample.markers)ok(all.has(m.uid),'lock references unknown uid');ok(samples.some(x=>x.markers.length>1),'multi-target lock missing');
  const formal=await saved();await page.getByRole('button',{name:'重打',exact:true}).click();await page.locator('.hud-archetypes').waitFor();await page.waitForTimeout(500);ok(await page.locator('.target-glow').count()===0,'random trial has formal reticles');const trialButton=page.getByRole('button',{name:/试 打/});await trialButton.click();await page.getByRole('button',{name:'跳过',exact:true}).waitFor();await page.getByRole('button',{name:'跳过',exact:true}).click();await page.getByRole('button',{name:'回去调整',exact:true}).waitFor({timeout:15000});ok(await page.locator('.target-glow').count()===0,'trial retained reticles');ok(formal===await saved(),'trial changed formal save');await shot('trial-cleaned');return {seed:info.seed,samples,events:{moves:exp.events.filter(e=>e.t==='move').length,summons:exp.events.filter(e=>e.t==='summon').length},trialSavePreserved:true};
 });
 await context.close();
}}finally{await browser.close();writeFileSync(`${output}/${process.env.RESULTS_FILE??'results.json'}`,JSON.stringify({base,results,errors,fixtures,coverageNotes:['Fixtures use legal activeCardPool seeds, authored later map encounters and exactly five queue slots.','Targets independently extracted from actual endTurn+simulate events; UI markers checked with real mouse interactions.','Trial and detail save equality checked as localStorage v5 raw string.']},null,2));}
console.log(JSON.stringify({results:results.map(({detail,...x})=>x),errors},null,2));if(results.some(x=>!x.ok)||errors.length)process.exitCode=1;
