// Current-site checks use BASE_URL (default :4175).
// Optional comparison: serve a git archive of 7697c57 and set BASELINE_URL to it.
// Real browser interaction coverage. Authored seed fixtures are recorded separately from natural play.
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
let base = process.env.BASE_URL ?? 'http://127.0.0.1:4175';
const output = 'output/copy-ui';
const attempt = (process.env.RESULTS_FILE ?? 'results.json').replace(/\.json$/, '');
mkdirSync(`${output}/screenshots`, { recursive:true });
const browser = await chromium.launch({ channel:'chrome', headless:true });
const results = [], errors = [], fixtures = [];
const selected = process.env.UI_STEPS?.split(',');
let page, size;
function ok(value, message) { if (!value) throw Error(message); }
async function shot(name) { const path = `${output}/screenshots/${attempt}-${size}-${name}.png`; await page.screenshot({path}); return path; }
async function step(name, category, fn) {
  if (selected && !selected.includes(name)) return;
  try { results.push({viewport:size, name, category, ok:true, detail:await fn()});console.log(`PASS ${size} ${name}`); }
  catch(error) { results.push({viewport:size, name, category, ok:false, error:String(error), screenshot:await shot(`FAIL-${name}`)});console.log(`FAIL ${size} ${name}: ${String(error)}`); }
}
async function state() { return page.evaluate(async () => (await import('/src/core/run.ts')).load()); }
async function finishFx() {
  await page.locator('.modal-ov.spell-picker').waitFor({state:'hidden'});
  await page.locator('.prep-settling.on').waitFor({state:'hidden'});
}

async function fixture() {
  await page.goto(base);
  const detail = await page.evaluate(async () => {
    const m = await import('/src/core/run.ts');
    let r;
    for(let seed=1;seed<10000;seed++) { const candidate=m.newRun(seed); if(['charge','blood','wheel','rune','hunt'].every(a=>candidate.activeArchetypes.includes(a))) {r=candidate;break;} }
    if(!r) throw Error('No legal support draft');
    r.act=2;r.gold=30;r.tavern=6;
    function route(layer,choices,path=[]) {for(const i of choices){const n=r.map[layer][i], next=[...path,i];if(layer===4&&n.enemy&&n.k!=='boss')return next;if(layer<4){const found=route(layer+1,n.next,next);if(found)return found;}}}
    const path=route(0,m.nodeOpts(r));if(!path)throw Error('No authored later encounter');
    r.layer=path.length-1;r.path=path.slice(0,-1);r.turn=m.actTurn(r.act,r.layer);m.pickNode(r,path.at(-1));
    const defs=['rw_wheel_marshal','rw_charge_sling','rw_blood_razor','rw_rune_scribe','rw_charge_bunker'];
    // Resolve a legal rune id through the actual current catalog.
    defs[3]=m.activeCardPool(r).find(c=>c.archetype==='rune').id;
    r.queue=defs.map(def=>({oid:r.nextId++,def,copies:1,atkBonus:0,hpBonus:0}));
    r.event=null;r.relicPick=null;r.relicDue=0;r.chest=null;r.pendingFx=[];r.firstRelicGiven=true;
    r.shop=[];
    m.save(r);if(!m.load()) throw Error(`Invalid v5 fixture`);
    return {seed:r.worldSeed,activeArchetypes:r.activeArchetypes};
  });
  fixtures.push({viewport:size,...detail});
  await page.reload();await page.getByRole('button',{name:'继续游戏',exact:true}).click();
  await page.locator('.hud-archetypes').waitFor();
  await page.waitForTimeout(1650);
  return detail;
}
async function metrics(selector='.tip.on') {return page.locator(selector).evaluate(el=>{const b=el.getBoundingClientRect();return {text:el.innerText,chars:el.innerText.replace(/\s/g,'').length,height:b.height,width:b.width,x:b.x,y:b.y,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight};});}
function bounded(m) {ok(m.x>=-1&&m.y>=-1&&m.x+m.width<=Number(size.split('x')[0])+1&&m.y+m.height<=Number(size.split('x')[1])+1,`out of viewport ${JSON.stringify(m)}`);}
const measurements=[];
try {
for(const viewport of [{width:844,height:390},{width:720,height:360}]) {
 size=`${viewport.width}x${viewport.height}`;
 for(const phase of process.env.BASELINE_URL ? ['before','after'] : ['after']) {
 base=phase==='before'?(process.env.BASELINE_URL??'http://127.0.0.1:4176'):(process.env.BASE_URL??'http://127.0.0.1:4175');
 const context=await browser.newContext({viewport});page=await context.newPage();page.setDefaultTimeout(7000);
 page.on('pageerror',e=>errors.push({viewport:size,phase,type:'pageerror',text:String(e)}));
 page.on('console',e=>{if(e.type()==='error')errors.push({viewport:size,phase,type:'console',text:e.text()});});
 page.on('response',r=>{if(r.status()>=400)errors.push({viewport:size,phase,type:'http',status:r.status(),url:r.url()});});
 await step(`${phase}-unit-details`, 'copy-space',async()=>{
 await fixture();
 const defs=await page.evaluate(async()=>{const m=await import('/src/core/run.ts');const r=m.load(),pool=m.activeCardPool(r);const defs=[r.queue[1].def,pool.find(c=>c.bridge).id,'rw_blood_cutpurse'];r.queue=defs.map(def=>({oid:r.nextId++,def,copies:1,atkBonus:0,hpBonus:0}));r.queue.push(null,null);r.shop=[{sid:r.nextId++,kind:'unit',def:defs[1],locked:false,free:false},{sid:r.nextId++,kind:'food',def:'f_powder',locked:false,free:false}];r.bag=[];m.save(r);return defs.map(id=>({id,name:pool.find(c=>c.id===id).name}));});
 await page.reload();await page.getByRole('button',{name:'继续游戏',exact:true}).click();await page.locator('.hud-archetypes').waitFor();await page.waitForTimeout(1650);
 const sampled=[];
 for(let i=0;i<defs.length;i++) {
 await page.getByRole('button',{name:`${defs[i].name} 位置${i+1}`,exact:true}).click();const compact=await metrics();bounded(compact);await shot(`${phase}-${i}-collapsed`);
 let expanded=null;
 if(phase==='after') {
 ok(!/计数：|留意：|桥接 ·|属性×2/.test(compact.text),'boilerplate in default');
 ok(await page.locator('.tip.on details').count()===0,'legacy rules disclosure remains');
 const detail=page.locator('.tip.on .card-detail');
 ok(await detail.locator('.unit-effect .tip-text').count()===1,'full unit effect missing');
 const actualStats=await detail.locator('.tip-stats').innerText();
 const before=JSON.stringify(await state());
 await detail.locator('.tip-variant[data-level="2"]').click();
 expanded=await metrics();bounded(expanded);
 ok(await detail.getAttribute('data-current-level')==='1'&&await detail.getAttribute('data-preview-level')==='2','variant state');
 ok(await detail.locator('.tip-number-change').count()>0,'changed numbers lack highlight');
 ok(await detail.locator('.tip-stats').innerText()===actualStats,'variant changed current stats');
 ok(JSON.stringify(await state())===before,'variant changed save');
 const action=page.locator('.tip.on .shelf-acts button').last();await action.scrollIntoViewIfNeeded();ok(await action.isVisible(),'selected action invisible');
 await shot(`${phase}-${i}-gold`);
 await detail.locator('.tip-variant[data-level="1"]').click();
 bounded(await metrics());
 }
 sampled.push({type:['single','dual','economy'][i],...defs[i],compact,expanded});await page.mouse.click(10,viewport.height-10);
 }
 // Shop dock uses the same disclosure body; its fixed action row remains reachable.
 await page.locator(`.cards .card[data-id="${defs[1].id}"]`).click();const dockDefault=await metrics();bounded(dockDefault);
 if(phase==='after') {ok(await page.locator('.tip.on details').count()===0,'shop disclosure remains');await page.locator('.tip.on .tip-variant[data-level="2"]').click();bounded(await metrics());await shot(`${phase}-shop-gold`);await page.getByRole('button',{name:'锁定',exact:true}).click();ok((await state()).shop[0].locked,'dock lock action failed');}
 else await shot(`${phase}-shop-default`);
 await page.mouse.click(10,viewport.height-10);
 await page.getByRole('button',{name:'补给 预装弹包',exact:true}).click();const food=await metrics();await shot(`${phase}-food-default`);
 if(phase==='after') {ok(await page.locator('.tip.on .tip-text').count()===1,'food effect rendered multiple times');ok(!/定位：|资源 ·|代价 ·/.test(food.text),'food boilerplate visible');await page.getByRole('button',{name:/^收入手牌/}).click();await finishFx();const card=page.getByRole('button',{name:'手牌 预装弹包',exact:true}).locator('.card-text');ok((await card.innerText()).includes('蓄能'),'held food effect missing');ok(await card.locator('.fr-short').count()===1,'held food duplicate effect');await shot(`${phase}-food-hand`);}
 measurements.push({viewport:size,phase,sampled,dockDefault,food});return {sampled,dockDefault,food};
 });
 await step(`${phase}-catalog-disclosure`,'copy-catalog',async()=>{await page.goto(base);await page.getByRole('button',{name:'图鉴',exact:true}).click();await page.locator('.ub-cell[data-id="rw_blood_cutpurse"]').click();const compact=await metrics('.cx-lv');if(phase==='after'){ok(await page.locator('.cx-lv details').count()===0,'catalog disclosure remains');ok(await page.locator('.cx-lv .unit-effect-text').count()===1,'catalog full skill missing');await page.locator('.cx-lv .tip-variant[data-level="2"]').click();ok(await page.locator('.cx-lv .card-detail').getAttribute('data-preview-level')==='2','catalog gold switch');}await shot(`${phase}-catalog`);return compact;});
 await context.close();
 }
}
} finally {await browser.close();writeFileSync(`${output}/${process.env.RESULTS_FILE??'results.json'}`,JSON.stringify({results,errors,measurements,fixtures},null,2));}
console.log(JSON.stringify({results:results.map(({detail,...r})=>r),errors}));if(results.some(r=>!r.ok)||errors.length)process.exitCode=1;
