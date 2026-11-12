// Authored legal-pool fixtures, real pointer/keyboard/touch interactions. Expected recipients
// below follow the printed card rules; helper output is supplemental evidence only.
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.BASE_URL??'http://127.0.0.1:4175',output='output/card-understanding-ui';
mkdirSync(`${output}/screenshots`,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[],fixtures=[];let page,size,touch;
const ok=(v,m)=>{if(!v)throw Error(m);};
const saved=()=>page.evaluate(()=>localStorage.getItem('pdqs3_run_v5'));
const state=()=>page.evaluate(async()=>(await import('/src/core/run.ts')).load());
async function shot(name){const path=`${output}/screenshots/${size}-${name}.png`;await page.screenshot({path});return path;}
async function step(name,fn){if(process.env.UI_STEPS&&!process.env.UI_STEPS.split(',').includes(name))return;try{results.push({size,name,ok:true,detail:await fn()});console.log(`PASS ${size} ${name}`);}catch(e){results.push({size,name,ok:false,error:String(e),screenshot:await shot(`FAIL-${name}`)});console.log(`FAIL ${size} ${name}: ${e}`);}}
async function fixture(mode='basic'){
 await page.goto(base);
 const info=await page.evaluate(async mode=>{
  const m=await import('/src/core/run.ts');
  const modes={basic:['rw_charge_gunner','rw_wheel_runner','rw_pair_cadet','rw_hunt_spotter','rw_nest_hatch'],runner:['rw_wheel_runner','rw_charge_sling','rw_hunt_spotter',null,null],pair:['rw_pair_cadet','rw_pair_cadet','rw_pair_cadet','rw_charge_sling',null],cannon:['rw_charge_gunner','rw_charge_sling','rw_wheel_runner',null,null],egg:['rw_nest_hatch','rw_charge_sling','rw_wheel_runner','rw_hunt_spotter','rw_charge_bunker'],support:['rw_wheel_runner','rw_wheel_runner','rw_hunt_spotter',null,null],growth:['rw_trade_factor','rw_trade_factor','rw_charge_sling',null,null],reward:['rw_charge_gunner','rw_wheel_runner',null,null,null]};
  const ids=modes[mode],need=[...new Set(ids.filter(Boolean))];let r;
  for(let seed=1;seed<100000;seed++){const c=m.newRun(seed),pool=m.activeCardPool(c);if(need.every(id=>pool.some(d=>d.id===id))&&(mode!=='support'||['nest','pair','charge'].every(a=>c.activeArchetypes.includes(a)))){r=c;break;}}
  if(!r)throw Error('legal active pool seed absent '+mode);
  r.act=2;r.gold=30;r.tavern=6;
  function route(layer,choices,path=[]){for(const i of choices){const n=r.map[layer][i],p=[...path,i];if(layer===4&&n.enemy&&n.k!=='boss'&&n.enemy.units.length>=2)return p;if(layer<4){const found=route(layer+1,n.next,p);if(found)return found;}}}
  const path=route(0,m.nodeOpts(r));if(!path)throw Error('authored enemy missing');r.layer=path.length-1;r.path=path.slice(0,-1);r.turn=m.actTurn(r.act,r.layer);m.pickNode(r,path.at(-1));
  r.queue=ids.map(def=>def?{oid:r.nextId++,def,copies:1,atkBonus:0,hpBonus:0}:null);
  r.event=null;r.relicPick=null;r.relicDue=0;r.chest=null;r.pendingFx=[];r.firstRelicGiven=true;r.relics=[];r.hand=Array.from({length:r.hand.length},()=>null);r.bag=[];
  r.shop=[{sid:r.nextId++,kind:'unit',def:need[0],locked:false,free:false},{sid:r.nextId++,kind:'food',def:'f_powder',locked:false,free:false}];
  if(mode==='basic'){r.queue[0].startCharge=2;r.queue[0].ench='e_loader';r.hand[0]={oid:r.nextId++,def:'rw_wheel_runner',copies:1,atkBonus:0,hpBonus:0};}
  if(mode==='cannon')r.queue[0].startCharge=2;
  if(mode==='support'){r.queue[1].ench='e_loader';r.queue[0].supportFoods=['f_twincake'];r.relics=['r_nest_roll'];}
  if(mode==='growth')r.tc.bought=4;
  if(mode==='reward')r.rewards=[{id:r.nextId++,card:{oid:r.nextId++,def:need[0],copies:1,atkBonus:0,hpBonus:0},source:'understanding UI fixture'}];
  m.save(r);if(!m.load())throw Error('valid v5 save rejected '+mode);
  return {mode,seed:r.worldSeed,activeArchetypes:r.activeArchetypes,queue:r.queue,enemy:r.enemy};
 },mode);
 fixtures.push({size,...info});await page.reload();await page.getByRole('button',{name:'继续游戏',exact:true}).click();await page.locator('.hud-archetypes').waitFor();await page.waitForTimeout(1650);return info;
}
const unit=slot=>page.locator(`.unit.side-0[data-slot="${slot}"]`);
async function activate(locator){await locator.scrollIntoViewIfNeeded();if(touch)await locator.tap();else await locator.click();}
async function close(){await page.mouse.click(8,8);}
async function detail(slot){await activate(unit(slot));await page.locator('.tip.on .card-detail').waitFor();}
async function marks(){return page.locator('.unit.side-0.benefit-preview').evaluateAll(xs=>xs.map(x=>+x.dataset.slot).sort());}
async function feedback(){return page.locator('.tip.on .formation-feedback').innerText();}
async function hoverDrag(from,to){const a=await unit(from).boundingBox(),b=await page.locator(`.slot[data-side="0"][data-slot="${to}"]`).boundingBox();ok(a&&b,'drag coordinates');await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2+14,a.y+a.height/2,{steps:3});await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:15});await page.locator('.placement-feedback:not(.hidden)').waitFor();}
try{for(const setup of [{width:844,height:390,hasTouch:false},{width:720,height:360,hasTouch:false},{width:844,height:390,hasTouch:true}]){
 if(process.env.SMOKE_ONLY&&(setup.hasTouch||setup.width!==844))continue;
 touch=setup.hasTouch;size=`${setup.width}x${setup.height}${touch?'-touch':''}`;const context=await browser.newContext({viewport:{width:setup.width,height:setup.height},hasTouch:touch});page=await context.newPage();page.setDefaultTimeout(7000);
 page.on('pageerror',e=>errors.push({size,type:'pageerror',text:String(e)}));page.on('console',e=>{if(e.type()==='error')errors.push({size,type:'console',text:e.text()});});page.on('response',r=>{if(r.status()>=400)errors.push({size,type:'http',status:r.status(),url:r.url()});});
 await step('minimal-smoke',async()=>{
  await fixture('cannon');const before=await saved();await detail(0);const d=page.locator('.tip.on .card-detail'),normal=await d.locator('.unit-effect-text').innerText();
  await activate(d.locator('.tip-variant[data-level="2"]'));ok(await d.getAttribute('data-preview-level')==='2'&&await d.locator('.unit-effect-text').innerText()!==normal,'gold switch');ok(before===await saved(),'variant changed save');
  await activate(d.locator('.tip-variant[data-level="1"]'));const token=d.locator('[data-keyword][role="button"]').first();await activate(token);ok(await page.locator('.keyword-explanation').count()===1,'keyword open');await page.getByRole('button',{name:'关闭关键词释义',exact:true}).click();ok(await page.locator('.keyword-explanation').count()===0,'keyword close');await close();
  await hoverDrag(0,1);const preview=await page.locator('.placement-feedback').innerText();ok(preview.includes('放到这里')&&preview.length>10,'placement feedback');ok(before===await saved(),'hover changed save');const screenshot=await shot('minimal-smoke');await page.mouse.move(6,6,{steps:5});await page.mouse.up();ok(before===await saved(),'cancel changed save');return {normal,preview,screenshot,savePreserved:true};
 });
 await step('plain-detail-variant-and-actions',async()=>{
  await fixture();const before=await saved();
  ok(await page.locator('.cards [data-keyword][role="button"]').count()===0,'shop thumbnail activates keyword');
  await detail(0);const d=page.locator('.tip.on .card-detail');ok(await d.locator('details').count()===0,'detail disclosure remains');ok((await d.locator('.unit-effect-text').innerText()).length>10,'skill text incomplete');
  const stats=await d.locator('.tip-stats').innerText(),effect=await d.locator('.unit-effect-text').innerText(),actions=await page.locator('.tip.on .shelf-acts').innerText();
  await activate(d.locator('.tip-variant[data-level="2"]'));
  ok(await d.getAttribute('data-current-level')==='1'&&await d.getAttribute('data-preview-level')==='2','actual/preview levels');ok(await d.locator('.unit-effect-text').innerText()!==effect,'gold skill values unchanged');ok(await d.locator('.tip-number-change').count()>0,'variant value emphasis absent');ok(await d.locator('.tip-stats').innerText()===stats,'actual stats changed');ok(await page.locator('.tip.on .shelf-acts').innerText()===actions,'variant actions changed');
  ok(await page.locator('.formation-feedback:visible').count()===0&&await page.locator('.benefit-preview,.target-glow').count()===0,'actual projections visible in gold');await shot('gold-skill');
  await activate(d.locator('.tip-variant[data-level="1"]'));ok(await d.locator('.unit-effect-text').innerText()===effect,'normal skill restore');ok(await page.locator('.formation-feedback:visible').count()===1,'current formation restore');
  for(const label of [/^出售/,/卸下装备/]){const button=page.getByRole('button',{name:label});await button.scrollIntoViewIfNeeded();ok(await button.isVisible(),'action inaccessible');}
  ok(before===await saved(),'detail preview changed persisted save');await shot('owned-complete');await close();
  await activate(page.getByRole('button',{name:'手牌 递旗手',exact:true}));ok(await page.locator('.tip.on .card-detail .unit-effect-text').count()===1,'hand skill missing');ok(await page.locator('.tip.on details').count()===0,'hand disclosure');await close();
  await activate(page.locator('.cards .card[data-id="rw_charge_gunner"]'));ok(await page.locator('.tip.on .card-detail .unit-effect-text').count()===1,'shop skill missing');const buy=page.getByRole('button',{name:/^招募 \d+ 金$/});await buy.scrollIntoViewIfNeeded();ok(await buy.isVisible(),'recruit action inaccessible');await close();
  await activate(page.locator('.unit.side-1').first());ok(await page.locator('.tip.on .unit-effect-text').count()===1,'enemy skill missing');ok(await page.locator('.tip.on details').count()===0,'enemy disclosure');return {stats,effect,actions,savePreserved:before===await saved()};
 });
 await step('keyword-singleton-lifecycle',async()=>{
  await fixture();const before=await saved();await detail(0);const tokens=page.locator('.tip.on [data-keyword][role="button"]');ok(await tokens.count()>=2,'fixture needs several keywords');
  await activate(tokens.first());ok(await page.locator('.keyword-explanation').count()===1,'first explanation missing');const first=await page.locator('.keyword-explanation').innerText();await activate(tokens.nth(1));ok(await page.locator('.keyword-explanation').count()===1,'switch duplicated explanation');ok(await page.locator('.keyword-explanation').innerText()!==first,'switch retained previous explanation');
  await page.getByRole('button',{name:'关闭关键词释义',exact:true}).click();ok(await page.locator('.keyword-explanation').count()===0,'close retained explanation');
  await tokens.first().focus();await page.keyboard.press('Enter');ok(await page.locator('.keyword-explanation').count()===1,'Enter failed');await page.keyboard.press('Escape');ok(await page.locator('.keyword-explanation').count()===0,'Escape failed');ok(await tokens.first().evaluate(el=>el===document.activeElement),'Escape focus restore');await page.keyboard.press(' ');ok(await page.locator('.keyword-explanation').count()===1,'Space failed');
  await activate(page.locator('.tip.on .tip-variant[data-level="2"]'));ok(await page.locator('.keyword-explanation').count()===0,'switch level retained help');await activate(page.locator('.tip.on [data-keyword][role="button"]').first());await detail(1);ok(await page.locator('.keyword-explanation').count()===0,'switch card retained help');await activate(page.locator('.tip.on [data-keyword][role="button"]').first());await close();ok(await page.locator('.keyword-explanation').count()===0,'blank click retained help');
  ok(before===await saved(),'keyword action changed save');ok(await page.locator('.drag-ghost').count()===0,'keyword gesture started drag');await detail(0);await activate(page.locator('.tip.on [data-keyword][role="button"]').first());await shot('keyword-in-place');return {touch,first,savePreserved:true};
 });
 await step('actual-formation-beneficiaries',async()=>{
  await fixture('runner');let before=await saved();await detail(0);const runner=await feedback();ok(runner.includes('第2位格挡+1'),'runner next actual recipient');ok((await marks()).includes(1),'runner recipient highlight missing');ok((await page.locator('.formation-feedback-line').count())<=3,'feedback exceeds 3 lines');ok(before===await saved(),'selection changed save');await shot('runner-block');
  await fixture('pair');await detail(1);const pair=await feedback(),pairMarks=await marks();ok(pair.includes('第1位+2/+1'),'paired cadet prefers front');ok(pairMarks.includes(0)&&!pairMarks.includes(2),'paired cadet highlights wrong same-name partner');await shot('pair-front-partner');
  await fixture('egg');await detail(0);const egg=await feedback();ok(egg.includes('满员')&&(/无处|空位/.test(egg)),'full egg missing capacity');await shot('full-board-egg');
  await fixture('support');await detail(0);const support=await feedback();ok(support.includes('对半饼')&&support.includes('育兽名册'),'supply/relic provenance missing');await detail(1);const gear=await feedback();ok(gear.includes('递弹臂环')&&gear.includes('第3位蓄能+1'),'equipment actual recipient');
  await fixture('growth');await detail(1);const end=await feedback();ok(end.includes('回合末')&&end.includes('第1位首击追加4伤害'),'end turn actual target');await close();before=await saved();await page.getByRole('button',{name:'成长预览',exact:true}).click();await detail(0);ok(await page.locator('.tip-projection-label').innerText()==='回合末预览','growth preview label');ok(before===await saved(),'growth changed persisted state');await shot('turn-end-label');return {runner,pair,pairMarks,egg,support,gear,end};
 });
 if(!touch)await step('placement-hover-commit-cancel',async()=>{
  await fixture('cannon');const before=await saved();await detail(0);const front=await feedback();ok(/伤害/.test(front),'front gunner release missing');await close();await hoverDrag(0,1);const predicted=await page.locator('.placement-feedback').innerText();ok(predicted.includes('放到这里')&&predicted.includes('每次交锋后自身蓄能+2'),'rear placement preview');ok((await marks()).includes(0),'predicted recipient lost original oid');ok(before===await saved(),'hover committed save');await shot('drag-rear-preview');await page.mouse.up();await page.waitForTimeout(400);ok(await page.locator('.placement-feedback:not(.hidden)').count()===0,'drop retained preview');await detail(1);const after=await feedback();ok(after.includes('每次交锋后自身蓄能+2'),'committed rear differs from preview');await close();const committed=await saved();await hoverDrag(1,0);await page.mouse.move(6,6,{steps:10});ok(await page.locator('.placement-feedback:not(.hidden)').count()===0,'leave retained preview');await page.mouse.up();ok(committed===await saved(),'cancel changed save');ok(await page.locator('.benefit-preview').count()===0,'cancel retained beneficiary');return {front,predicted,after};
 });
 await step('catalog-variant-demo-keyword',async()=>{
  await page.goto(base);const before=await saved();await page.getByRole('button',{name:'图鉴',exact:true}).click();await activate(page.locator('.ub-cell[data-id="rw_charge_gunner"]'));const normal=await page.locator('.cx-lv .unit-effect-text').innerText();ok(await page.locator('.cx-lv details').count()===0,'catalog disclosure');await activate(page.locator('.cx-lv .tip-variant[data-level="2"]'));ok(await page.locator('.cx-lv .unit-effect-text').innerText()!==normal,'catalog gold skill unchanged');if(await page.locator('.unit-demo-label').count())ok((await page.locator('.unit-demo-label').innerText()).includes('金色'),'catalog demo level mismatch');await activate(page.locator('.cx-lv [data-keyword][role="button"]').first());ok(await page.locator('.keyword-explanation').count()===1,'catalog keyword missing');await activate(page.locator('.ub-cell[data-id="rw_wheel_runner"]'));ok(await page.locator('.keyword-explanation').count()===0,'catalog card retained help');await shot('catalog-complete');ok(before===await saved(),'catalog changed save');return {normal,savePreserved:true};
 });
 await step('reward-and-level3-detail',async()=>{
  await fixture('reward');await page.locator('.reward-open').click();ok(await page.locator('.spell-dialog .card-detail .unit-effect-text').count()===1,'reward skill missing');ok(await page.locator('.spell-dialog details').count()===0,'reward disclosure');await page.getByRole('button',{name:'领取',exact:true}).scrollIntoViewIfNeeded();await shot('reward-complete');
  const three=await page.evaluate(async()=>{const t=await import('/src/qb/tip.ts'),c=await import('/src/qb/card.ts');const el=t.unitTip('e_shield',3,{atk:6,hp:10,copies:3});el.id='level3-fixture';document.body.append(el);return {text:el.querySelector('.unit-effect-text').textContent,expected:c.cardText('e_shield',3),current:el.dataset.currentLevel,preview:el.dataset.previewLevel,tabs:el.querySelectorAll('.tip-variant').length};});ok(three.current==='3'&&three.preview==='3'&&three.tabs===0&&three.text===three.expected,'level3 actual rendering');await page.locator('#level3-fixture').evaluate(el=>el.remove());return {three,kind:'standalone DOM legacy enemy level3'};
 });
 await context.close();
}}finally{await browser.close();writeFileSync(`${output}/${process.env.RESULTS_FILE??'results.json'}`,JSON.stringify({base,results,errors,fixtures,coverageNotes:['Expected recipients and magnitudes checked against card rules with explicit slot assertions, then real move committed for comparison.','Fixtures select legal activeCardPool seeds, authored map enemies, exactly five Owned slots; isolated level3 enemy DOM rendering is recorded separately.','Touch context uses real tap gestures for keywords and switches.']},null,2));}
console.log(JSON.stringify({results:results.map(({detail,...r})=>r),errors},null,2));if(results.some(r=>!r.ok)||errors.length)process.exitCode=1;
