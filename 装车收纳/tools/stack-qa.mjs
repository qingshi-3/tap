import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {ITEMS,ORDERS,TRUCKS,getOrder} from '../js/content.js';
import {freshSave,validateSave,SAVE_KEY} from '../js/persistence.js';
import {cellsFor,truckFor,canPlace} from '../js/engine.js';

// These are explicitly seeded interaction fixtures, not campaign completion.
// All subsequent placement/removal changes use touch or keyboard input.
const require=createRequire(process.env.PLAYWRIGHT_MODULE||'C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=fileURLToPath(new URL('../output/qa-v2/',import.meta.url));
await mkdir(out,{recursive:true});
const order=ORDERS.slice(7).map(o=>getOrder(o.id,2)).find(o=>o.rules.stacking&&['vase','chest','crate'].every(type=>o.cargo.some(c=>c.type===type)));
assert.ok(order,'An actual v2 order from order 8 onward must include vase, chest and crate');
const vase=order.cargo.find(c=>c.type==='vase'),chest=order.cargo.find(c=>c.type==='chest'),crate=order.cargo.find(c=>c.type==='crate');
function seed(){
  const s=freshSave();
  s.completed=Object.fromEntries(ORDERS.slice(0,ORDERS.findIndex(o=>o.id===order.id)).map(o=>[o.id,{stars:3,reward:o.reward+30}]));
  s.ownedTrucks=TRUCKS.map(t=>t.id);s.coins=3000;s.sound=false;
  s.active={orderId:order.id,contentVersion:2,placements:{},phase:'loading',stop:0,delivered:[],moves:0,hints:0,paid:false};
  validateSave(s);return s;
}
function floorSpot(cargo,placements={},accept=()=>true){
  const t=truckFor(order);
  for(let y=1;y<t.h-1;y++)for(let x=0;x<t.w;x++)if(accept(x,y)&&canPlace(order,placements,cargo.id,x,y,0,0).ok)return{x,y,r:0,z:0};
  throw new Error(`No empty floor fixture for ${cargo.type}`);
}
const support=floorSpot(chest),single={...support},keyboard=floorSpot(vase);
const movedSupport=floorSpot(chest,{},(_x,y)=>y!==support.y);
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report=[],errors=[];
const read=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),SAVE_KEY);
const norm=p=>p?{...p,z:p.z??0}:p;
const equalPlacement=(actual,expected)=>assert.deepEqual(norm(actual),norm(expected));
async function geometry(p){const b=await p.locator('#board').boundingBox(),t=truckFor(order),cell=Math.min((b.width-64)/t.w,(b.height-56)/(t.h+1.9),64);return{x:b.x+(b.width-t.w*cell)/2,y:b.y+cell*1.3+10,cell,b};}
async function drag(p,cdp,from,to){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:0}]});
  for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/10,y:from.y+(to.y-from.y)*i/10,id:0}]});await p.waitForTimeout(12);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(120);
}
async function inTray(p,cargo){
  const item=p.locator(`[data-cargo="${cargo.id}"]`);
  for(let batches=0;!await item.count();batches++){assert.ok(batches<8,'Cargo must be reachable through real batch controls');await p.locator('#tray-next').tap();}
  return item;
}
async function load(p,cdp,cargo,placement){
  const item=await inTray(p,cargo);await item.tap();
  const g=await geometry(p),b=await item.boundingBox(),cs=cellsFor(cargo.type,placement.r),w=Math.max(...cs.map(c=>c[0]))+1,h=Math.max(...cs.map(c=>c[1]))+1;
  for(let i=0;i<placement.r;i++)await p.locator('#rotate').tap();
  await drag(p,cdp,{x:b.x+b.width/2,y:b.y+22},{x:g.x+(placement.x+w/2)*g.cell,y:g.y+(placement.y+h*.55)*g.cell});
}
async function tapCargo(p,placement,cell=[0,0]){const g=await geometry(p);await p.touchscreen.tap(g.x+(placement.x+cell[0]+.5)*g.cell,g.y+(placement.y+cell[1]+.5-(placement.z===1?.16:0))*g.cell);}
async function screenshot(p,name){await p.screenshot({path:out+`stack-${name}.png`});}
async function unchanged(p,before){assert.deepEqual(await read(p),before,'Rejected action must preserve the persisted save');}
async function run(width,height){
  const name=`${width}x${height}`,checks=[];
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await context.addInitScript(({key,raw})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,raw);},{key:SAVE_KEY,raw:JSON.stringify(seed())});
  const p=await context.newPage();p.on('pageerror',e=>errors.push({viewport:name,message:e.message}));
  const cdp=await context.newCDPSession(p);
  try{
    await p.goto(process.env.CARGO_PREVIEW_URL||'http://127.0.0.1:4197/');await p.locator('.cargo').first().waitFor();
    assert.equal(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
    await screenshot(p,`${name}-initial`);
    await load(p,cdp,chest,support);equalPlacement((await read(p)).active.placements[chest.id],support);
    const upper={...support,r:1,z:1};
    await load(p,cdp,vase,upper);equalPlacement((await read(p)).active.placements[vase.id],upper);
    assert.match(await p.locator('#selected-name').innerText(),/上层/);
    await screenshot(p,`${name}-selected-vase`);checks.push('real-touch-vase-on-box-auto-upper-layer');

    // The uncovered second cell selects the supporting chest, not its upper vase.
    const exposed=cellsFor(chest.type,0).find(([x,y])=>x!==0||y!==0);
    assert.ok(exposed,'Fixture support must have an exposed cell');
    await tapCargo(p,support,exposed);assert.ok((await p.locator('#selected-name').innerText()).includes(ITEMS[chest.type].name));
    let before=await read(p);await p.locator('#remove').tap();await unchanged(p,before);assert.match(await p.locator('#bubble').innerText(),/上|支撑|先/);
    checks.push('support-removal-rejected');
    const g=await geometry(p),cs=cellsFor(chest.type,0),cw=Math.max(...cs.map(c=>c[0]))+1;
    await drag(p,cdp,{x:g.x+(support.x+exposed[0]+.5)*g.cell,y:g.y+(support.y+exposed[1]+.5)*g.cell},{x:g.x+(movedSupport.x+cw/2)*g.cell,y:g.y+(movedSupport.y+.55)*g.cell});
    await unchanged(p,before);assert.match(await p.locator('#bubble').innerText(),/上|支撑|先/);checks.push('support-moving-rejected');await screenshot(p,`${name}-support-rejected`);

    // Reload an actual saved stack, then continue through normal removal inputs.
    await p.reload();await p.locator('.cargo').first().waitFor();
    equalPlacement((await read(p)).active.placements[vase.id],upper);
    await tapCargo(p,upper);assert.match(await p.locator('#selected-name').innerText(),/上层/);
    await screenshot(p,`${name}-reload-stack`);
    const revision=(await read(p)).revision;await p.locator('#remove').tap();
    assert.equal((await read(p)).active.placements[vase.id],undefined);assert.ok((await read(p)).revision>revision);
    await tapCargo(p,support,exposed);await p.locator('#remove').tap();
    assert.equal((await read(p)).active.placements[chest.id],undefined);checks.push('save-reload-continue-upper-then-lower-removal');

    await load(p,cdp,vase,single);equalPlacement((await read(p)).active.placements[vase.id],single);
    before=await read(p);await load(p,cdp,crate,{...single,z:1});await unchanged(p,before);
    assert.match(await p.locator('#bubble').innerText(),/易碎|承重|支撑|压|上面/);checks.push('crate-on-vase-rejected');
    await screenshot(p,`${name}-fragile-rejected`);
    await tapCargo(p,single);await p.locator('#remove').tap();
    await load(p,cdp,crate,single);equalPlacement((await read(p)).active.placements[crate.id],single);
    before=await read(p);await load(p,cdp,chest,{...single,z:1});await unchanged(p,before);
    assert.match(await p.locator('#bubble').innerText(),/支撑|承重|悬空|每一格|托住/);checks.push('partial-unsupported-top-rejected');
    await screenshot(p,`${name}-partial-support-rejected`);
    await tapCargo(p,single);await p.locator('#remove').tap();

    await inTray(p,vase);
    for(let i=0;i<50;i++){await p.keyboard.press('Tab');if(await p.evaluate(id=>document.activeElement?.dataset.cargo===id,vase.id))break;}
    assert.equal(await p.evaluate(()=>document.activeElement?.dataset.cargo),vase.id);
    await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>document.activeElement.id),'board');
    assert.equal(await p.locator('#board').evaluate(e=>e.matches(':focus-visible')),true);
    await p.keyboard.press('r');
    for(let i=0;i<keyboard.x;i++)await p.keyboard.press('ArrowRight');
    for(let i=0;i<keyboard.y;i++)await p.keyboard.press('ArrowDown');
    await screenshot(p,`${name}-keyboard-focus`);await p.keyboard.press('Enter');
    equalPlacement((await read(p)).active.placements[vase.id],{...keyboard,r:1});
    await p.keyboard.press('Delete');assert.equal((await read(p)).active.placements[vase.id],undefined);
    assert.equal(await p.locator('#remove').isDisabled(),true);checks.push('keyboard-focus-rotate-place-delete');

    const metrics=await p.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,controls:[...document.querySelectorAll('header button,#selection button,footer button,.cargo,#tray-next')].map(e=>{const r=e.getBoundingClientRect();return{label:e.getAttribute('aria-label')||e.textContent,w:r.width,h:r.height,x:r.x,y:r.y};})}));
    assert.ok(metrics.width<=width&&metrics.height<=height,'No viewport scrolling');
    for(const c of metrics.controls){assert.ok(c.w>=44&&c.h>=44,`Touch target: ${JSON.stringify(c)}`);assert.ok(c.x>=0&&c.y>=0&&c.x+c.w<=width+1&&c.y+c.h<=height+1,`Reachability: ${JSON.stringify(c)}`);}
    report.push({viewport:[width,height],passed:true,order:order.id,fixture:'explicitly seeded unlocked v2 loading order, no campaign progression claim',checks,metrics});
  }catch(error){await screenshot(p,`${name}-failure`).catch(()=>{});report.push({viewport:[width,height],passed:false,order:order.id,checks,error:error.stack});}
  finally{await context.close();}
}
try{for(const [w,h]of [[360,640],[320,568],[844,390]])await run(w,h);}
finally{await browser.close();await writeFile(out+'stack-report.json',JSON.stringify({report,errors},null,2));}
console.log(JSON.stringify({report,errors},null,2));
if(errors.length||report.some(r=>!r.passed))process.exitCode=1;
