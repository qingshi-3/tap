// Real browser interaction coverage. Authored seed fixtures are recorded separately from natural play.
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4175';
const output = 'output/support-ui';
const attempt = (process.env.RESULTS_FILE ?? 'results.json').replace(/\.json$/, '');
mkdirSync(`${output}/screenshots`, { recursive:true });
const browser = await chromium.launch({ channel:'chrome', headless:true });
const results = [], errors = [], fixtures = [];
const selected = process.env.UI_STEPS?.split(',');
let page, size;
function ok(value, message) { if (!value) throw Error(message); }
function ruleText(text) {return text.replace(/[\s「」]/g,'').replace(/生命([+−-]?\d+)/g,'$1生命').replace(/攻击([+−-]?\d+)/g,'$1攻击').replace(/([+−-]?\d+)攻(?!击)/g,'$1攻击').replace(/([+−-]?\d+)层格挡/g,'$1格挡').replace(/格挡([+−-]?\d+)/g,'$1格挡');}
async function shot(name) { const path = `${output}/screenshots/${attempt}-${size}-${name}.png`; await page.screenshot({path}); return path; }
async function step(name, category, fn) {
  if (selected && !selected.includes(name)) return;
  try { results.push({viewport:size, name, category, ok:true, detail:await fn()});console.log(`PASS ${size} ${name}`); }
  catch(error) { results.push({viewport:size, name, category, ok:false, error:String(error), screenshot:await shot(`FAIL-${name}`)});console.log(`FAIL ${size} ${name}: ${String(error)}`); }
}
async function state() { return page.evaluate(async () => (await import('/src/core/run.ts')).load()); }
async function noOverflow() {
  const rect = await page.evaluate(() => ({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
  ok(rect.scrollWidth <= rect.width + 1 && rect.scrollHeight <= rect.height + 1, `document overflow ${JSON.stringify(rect)}`); return rect;
}
async function finishFx() {
  await page.locator('.modal-ov.spell-picker').waitFor({state:'hidden'});
  await page.locator('.prep-settling.on').waitFor({state:'hidden'});
}

async function actualCenterClick(locator) {
  const box = await locator.boundingBox(); ok(box, 'no target bounding box');
  await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
}
async function enterMap() {
  await page.locator('.map-ov').waitFor();
  await page.locator('.map-ov').evaluate(async el => { await Promise.all(el.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().iterations)).map(a=>a.finished)); });
  await actualCenterClick(page.locator('.map-node.can').first());
  await page.getByRole('button',{name:'前往',exact:true}).click();
  await page.locator('.hud-archetypes').waitFor();
}
async function fixture(mode='base') {
  await page.goto(base);
  const detail = await page.evaluate(async mode => {
    const m = await import('/src/core/run.ts'), d = await import('/src/core/data.ts');
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
    function food(id){r.shop.push({sid:r.nextId++,kind:'food',def:id,locked:false,free:false});}
    if(mode==='invalid-spells') {food('x_temper');food('x_copy');r.queue[0].copies=3;r.queue[1].granted={id:'bone',duration:'permanent',value:2,source:'骨契',tempered:true};r.queue[2].granted={id:'bone',duration:'permanent',value:2,source:'骨契'};}
    if(mode==='base') {food('f_powder');food('f_red_bitters');food('f_sigil_ink');food('f_spur_oats');}
    if(mode==='detail-preview') {r.queue[2].tmpAtk=3;r.queue[2].tmpHp=3;r.queue[2].wounds=3;r.queue[2].startBlock=1;r.queue[3].def='rw_supply_feast';r.tc.foods=3;}
    if(mode==='single-quarry') {r.queue[1].ench='e_hunting_scope';r.quarry=3;r.enemy={...r.enemy,units:r.enemy.units.slice(0,1)};}
    if(mode==='capped-chest') {r.oranges=['e_field_cannon','e_race_standard'];r.chest={items:['e_chamber','e_sigil_quill','e_quarry_hammer'],ad:false,src:'elite'};}
    if(mode==='share-preview') {r.relics=['r_share'];food('f_travel_rusk');}
    if(mode==='merchant-full') {for(let i=0;i<m.FOOD_SHOP_MAX;i++)food('f_bread');r.merchant=[{kind:'spell',id:'x_coin',price:1}];}
    if(mode==='merchant-target') r.merchant=[{kind:'spell',id:'x_temper',price:3}];
    if(mode==='equipment') {r.bag=['e_field_cannon','e_courier_spurs'];r.queue[0].ench='e_loader';}
    if(mode==='chest') r.chest={items:['e_courier_spurs','e_field_cannon','e_loader'],ad:false,src:'elite'};
    if(mode==='relic') {r.relicDue=1;r.relicPick={opts:['r_relay_bell','r_shot_chain','r_blood_pact'],ad:false};}
    if(mode==='battle') {
      // Actual intake uses core validation; browser then starts/plays/reviews the resulting battle.
      r.queue[0].ench='e_race_standard';r.relics=['r_quarry_writ'];
      for(const [id,slot] of [['f_powder',1],['f_red_bitters',2],['f_sigil_ink',0],['f_spur_oats',2],['f_siege_fuse',1]]) {
        const sid=r.nextId++;r.shop.push({sid,kind:'food',def:id,locked:false,free:true});
        if(!m.useFood(r,sid,slot).ok)throw Error(`Invalid support battle fixture ${id}`);
      }
      // Hunter relic also needs a marked quarry, supplied by a rune/charge neutral usable gear.
      r.queue[1].ench='e_hunting_scope';
    }
    m.save(r);if(!m.load()) throw Error(`Invalid v5 fixture ${mode}`);
    const preview=mode==='battle'?m.fight(structuredClone(r)):null;
    const entry={mode,seed:r.worldSeed,activeArchetypes:r.activeArchetypes,defs,turn:r.turn,encounter:r.enemy,queue:r.queue,bag:r.bag,chest:r.chest,relicPick:r.relicPick,shop:r.shop,preview:preview?{result:preview.result,sources:[...new Set(preview.stats.units.flatMap(u=>u.damageBySource.map(s=>s.kind)))],events:preview.events.filter(e=>e.t==='trigger'&&['散弹引信','换班燕麦','百里风旗','套索准星','合猎令'].some(name=>e.label.includes(name)))}:null};
    return entry;
  },mode);
  fixtures.push({viewport:size,...detail});
  await page.reload();await page.getByRole('button',{name:'继续游戏',exact:true}).click();
  await page.locator('.hud-archetypes').waitFor();
  await page.waitForTimeout(1650);
  return detail;
}
async function useSupply(name, target) {
  await page.getByRole('button',{name:`补给 ${name}`,exact:true}).click();
  await page.getByRole('button',{name:/^直接施放/}).click();
  await page.locator('.spell-target').first().waitFor();
  if(target)await page.locator('.spell-target').filter({hasText:target}).click();
}
async function drag(source,target) {
  const a=await source.boundingBox(), b=await target.boundingBox();ok(a&&b,'drag endpoint missing');
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
  await page.mouse.move(a.x+a.width/2+12,a.y+a.height/2,{steps:3});
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:18});const diagnostic=await page.evaluate(({a,b})=>({a,b,source:document.elementFromPoint(a.x+a.width/2,a.y+a.height/2)?.outerHTML.slice(0,350),target:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.outerHTML.slice(0,350),hover:[...document.querySelectorAll('.drop-hover')].map(el=>({side:el.dataset.side,slot:el.dataset.slot,cell:el.dataset.cell})),ghost:!!document.querySelector('.drag-ghost')}),{a,b});console.log(JSON.stringify({drag:diagnostic}));await page.mouse.up();await finishFx();
}
try {
  for(const viewport of [{width:844,height:390},{width:720,height:360}]) {
    size=`${viewport.width}x${viewport.height}`;
    const context=await browser.newContext({viewport});page=await context.newPage();page.setDefaultTimeout(7000);
    page.on('pageerror',e=>errors.push({viewport:size,type:'pageerror',text:String(e)}));
    page.on('console',e=>{if(e.type()==='error')errors.push({viewport:size,type:'console',text:e.text(),location:e.location()});});
    page.on('response',r=>{if(r.status()>=400)errors.push({viewport:size,type:'http',status:r.status(),url:r.url()});});
    await step('natural-start-first-relic','natural-flow',async()=>{
      await page.goto(base);await page.getByRole('button',{name:'新的游戏',exact:true}).click();
      await page.getByRole('button',{name:/普通/}).click();await page.locator('.hero-opts button').first().click();await enterMap();
      const initial=await state();ok(initial.shop.filter(s=>s.kind==='food').length>=2,'natural shop missing two supplies');
      await shot('natural-shop');
      // Spend through the displayed recruitment buttons, preserving natural authored units and encounter.
      for(let i=0;i<3;i++) {const c=page.locator('.cards .card[data-id^="rw_"]').first();if(!await c.count())break;await c.click();const recruit=page.getByRole('button',{name:/^招募 \d+ 金$/});if(await recruit.isDisabled()){await page.mouse.click(10,viewport.height-10);break;}await recruit.click();await finishFx();}
      await page.getByRole('button',{name:/开 战/}).click();await page.getByRole('button',{name:'跳过',exact:true}).waitFor();await page.getByRole('button',{name:'跳过',exact:true}).click();
      await page.locator('.res-review').waitFor({timeout:15000});await shot('natural-first-result');
      const next=page.getByRole('button',{name:'继续',exact:true});await next.click();
      await page.locator('.rl-card').first().waitFor({timeout:15000});
      const after=await state();const defs=await page.evaluate(async ids=>{const d=await import('/src/core/data.ts');return ids.map(id=>d.RELIC[id]);},after.relicPick.opts);
      for(const def of defs)ok(!def.archetypes?.length||def.archetypes.some(a=>after.activeArchetypes.includes(a)),`natural first relic incompatible ${def.id}`);
      await shot('natural-first-relic');await noOverflow();return {seed:initial.worldSeed,activeArchetypes:initial.activeArchetypes,firstShop:initial.shop,relics:defs.map(d=>d.id)};
    });
    await step('active-support-catalog','catalog-interaction',async()=>{
      await page.goto(base);await page.getByRole('button',{name:'图鉴',exact:true}).click();
      const catalogs=await page.evaluate(async()=>{const d=await import('/src/core/data.ts'),a=await import('/src/core/archetypes.ts');const pack=x=>({id:x.id,name:x.name,text:x.id==='f_milk' ? '永久提高攻击和生命（数值见货架）' : x.text.replace('+{a}/+{h}','攻血'),identities:x.archetypes?.length?x.archetypes.map(id=>a.ARCHETYPES[id].name):['通用']});return [{tab:'补给',items:d.FOODS.filter(f=>!f.legacy&&f.spell!=='echo').map(pack),legacy:d.FOODS.filter(f=>f.legacy).map(f=>f.id)},{tab:'装备',items:d.ACTIVE_EQUIPS.map(pack),legacy:d.EQUIPS.filter(f=>f.legacy).map(f=>f.id)},{tab:'遗物',items:d.ACTIVE_RELICS.map(pack),legacy:d.RELICS.filter(f=>f.legacy).map(f=>f.id)}];});
      const counts={};
      for(const catalog of catalogs) {
        await page.getByRole('button',{name:catalog.tab,exact:true}).click();ok(await page.locator('.cx-tile').count()===catalog.items.length,`${catalog.tab} tile count`);
        for(const id of catalog.legacy)ok(await page.locator(`.cx-tile[data-key="${id}"]`).count()===0,`legacy visible ${id}`);
        for(const def of catalog.items) {
          const tile=page.locator(`.cx-tile[data-key="${def.id}"]`);await tile.click();
          const line=await page.locator('.cx-dt-line').evaluate(el=>{const copy=el.cloneNode(true);for(const icon of copy.querySelectorAll('.kwi[title]'))icon.replaceWith(icon.title+icon.textContent);for(const number of copy.querySelectorAll('.kwn[aria-label]'))number.replaceWith(number.textContent.replace(/攻$/,'')+(number.classList.contains('kwn-hp')?'生命':'攻击'));return copy.textContent;}),meta=await page.locator('.cx-dt-meta').innerText();
          ok((await page.locator('.cx-dt-name').innerText()).includes(def.name),`${def.id} wrong detail`);
          ok(ruleText(line).includes(ruleText(def.text)),`${def.id} incomplete text: ${line}`);
          ok(!/\{[^}]+\}|undefined|NaN/.test(line),`${def.id} unresolved template`);
          for(const identity of def.identities)ok(meta.includes(identity),`${def.id} missing ${identity}`);
          const art=await tile.locator('.px-item').first().evaluate(el=>({style:el.getAttribute('style'),bg:getComputedStyle(el).backgroundImage,width:el.getBoundingClientRect().width}));
          ok(art.bg!=='none'&&art.width>0&&!/--pxi-(?:spell|order|pack|coin)\)/.test(art.style),`${def.id} fallback/missing icon ${JSON.stringify({style:art.style,hasImage:art.bg!=='none',width:art.width})}`);
        }
        counts[catalog.tab]=catalog.items.length;await shot(`catalog-${catalog.tab}`);await noOverflow();
      }
      return counts;
    });
    await step('purchase-target-resources','mechanism-fixture',async()=>{
      const detail=await fixture();const initial=await state();
      await page.getByRole('button',{name:'补给 预装弹包',exact:true}).click();await page.getByRole('button',{name:/^收入手牌/}).click();
      const bought=await state();ok(bought.gold===initial.gold-2&&bought.hand.some(o=>o?.def==='f_powder'),'actual hand purchase failed');
      await page.getByRole('button',{name:'手牌 预装弹包',exact:true}).click();await page.getByRole('button',{name:'施放',exact:true}).click();
      const names=await page.locator('.spell-target:not(:disabled)').allTextContents();ok(names.length===1&&names[0].includes('后排投石手'),`powder targets ${names}`);for(const target of await page.locator('.spell-target:disabled').all())ok((await target.innerText()).includes('需有消耗蓄能射击的技能'),'disabled recipient lacks release reason');
      await shot('powder-legal-target');await page.locator('.spell-target:not(:disabled)').first().click();await finishFx();
      ok((await state()).queue[1].startCharge===2,'preloaded charge missing');
      await useSupply('苦胆酒','赤刃斗士');await finishFx();ok((await state()).queue[2].wounds===3,'wounds missing');
      await useSupply('蘸印墨','万蹄行军令');await finishFx();ok((await state()).queue[0].seal===3,'seal missing');
      await page.getByRole('button',{name:'后排投石手 位置2',exact:true}).click();ok((await page.locator('.prepared-support').allTextContents()).join(' ').includes('下一场带 2 点蓄能'),'charge detail missing');await page.mouse.click(10,viewport.height-10);
      await page.getByRole('button',{name:'赤刃斗士 位置3',exact:true}).click();ok((await page.locator('.prepared-support').allTextContents()).join(' ').includes('下一场开战扣 3 生命'),'wounds detail missing');await page.mouse.click(10,viewport.height-10);
      await shot('prepared-resources');await noOverflow();const after=await state();await fixture('detail-preview');await page.getByRole('button',{name:'赤刃斗士 位置3',exact:true}).click();ok((await page.locator('.tip-stats .atk').innerText()).trim()==='7','detail temporary attack mismatch');ok((await page.locator('.tip-stats .hp').innerText()).replace(/\s/g,'')==='6/9','detail wound/max health mismatch');ok((await page.locator('.tip-stats .kw-block').innerText()).trim()==='1','detail prepared block missing');await shot('prepared-detail-7-6of9-block1');await page.mouse.click(10,viewport.height-10);const previewBefore=JSON.stringify(await state());await page.getByRole('button',{name:'成长预览',exact:true}).click();await page.getByRole('button',{name:'万蹄行军令 位置1',exact:true}).click();ok((await page.locator('.tip-seal').innerText()).includes('首次攻击追加 3'),'growth preview detail seal missing');ok(JSON.stringify(await state())===previewBefore,'growth preview changed actual save');await shot('growth-preview-seal3');await page.mouse.click(10,viewport.height-10);return {seed:detail.seed,targetNames:names,gold:after.gold,queue:after.queue,detailStats:{atk:7,hp:6,maxHp:9,block:1},previewSeal:3};
    });
    await step('spell-invalid-target-reasons','mechanism-fixture',async()=>{
      await fixture('invalid-spells');const before=await state();const names=await page.evaluate(async()=>{const d=await import('/src/core/data.ts');return {temper:d.FOOD.x_temper.name,copy:d.FOOD.x_copy.name};});
      await page.getByRole('button',{name:`法术 ${names.temper}`,exact:true}).click();await page.getByRole('button',{name:/^直接施放/}).click();
      const tempered=page.locator('.spell-target').filter({hasText:'后排投石手'}), plain=page.locator('.spell-target').filter({hasText:'万蹄行军令'}), valid=page.locator('.spell-target').filter({hasText:'赤刃斗士'});
      ok(await tempered.isDisabled()&&(await tempered.innerText()).includes('这项技能已淬炼'),'tempered target reason');
      ok(await plain.isDisabled()&&(await plain.innerText()).includes('永久技能'),'missing permanent target reason');
      ok(!await valid.isDisabled(),'valid permanent ability disabled');await shot('temper-target-reasons');await valid.click();await finishFx();
      let after=await state();ok(after.queue[2].granted.tempered&&after.queue[2].granted.value===4&&after.gold===before.gold-3,'temper actual effect');
      await page.getByRole('button',{name:`法术 ${names.copy}`,exact:true}).click();await page.getByRole('button',{name:/^直接施放/}).click();
      const gold=page.locator('.spell-target').filter({hasText:'万蹄行军令'});ok(await gold.isDisabled()&&(await gold.innerText()).includes('这名队员已是金色'),'copy gold target reason');
      await shot('copy-gold-disabled');const recipient=page.locator('.spell-target').filter({hasText:'赤刃斗士'});ok(!await recipient.isDisabled(),'copy normal disabled');await recipient.click();await finishFx();after=await state();ok(after.queue[2].copies===2,'copy actual effect');return {tempered:after.queue[2].granted,copies:after.queue[2].copies,...await noOverflow()};
    });
    await step('equipment-replace-and-unequip','mechanism-fixture',async()=>{
      await fixture('equipment');await drag(page.getByRole('button',{name:'折返马刺',exact:true}),page.getByRole('button',{name:'万蹄行军令 位置1',exact:true}));
      let r=await state();ok(r.queue[0].ench==='e_courier_spurs'&&r.bag.includes('e_loader'),'replacement failed to return old gear');
      await page.getByRole('button',{name:'万蹄行军令 位置1',exact:true}).click();await page.getByRole('button',{name:'卸下装备',exact:true}).click();
      r=await state();ok(!r.queue[0].ench&&r.bag.includes('e_courier_spurs'),'unequip failed');const slots=await page.locator('.bag-slot').evaluateAll(xs=>xs.map(el=>{const b=el.getBoundingClientRect();return {name:el.getAttribute('aria-label'),x:b.x,y:b.y,width:b.width,height:b.height};}));ok(slots.length===3,'missing third inventory slot');for(const slot of slots)ok(slot.x>=0&&slot.y>=0&&slot.x+slot.width<=viewport.width&&slot.y+slot.height<=viewport.height,`inventory slot outside viewport ${JSON.stringify(slot)}`);await shot('equipment-returned');return {bag:r.bag,slots,...await noOverflow()};
    });
    await step('chest-and-relic-rule-cards','mechanism-fixture',async()=>{
      const chest=await fixture('chest');await page.locator('.chest-item').first().waitFor();
      for(let i=0;i<3;i++){const item=page.locator('.chest-item').nth(i);ok(await item.locator('.support-tag').count()>0,'chest identity missing');ok((await item.locator('.ci-text').innerText()).length>8,'chest rule missing');}
      await shot('chest-rules');await page.locator('.chest-item').first().click();ok((await state()).bag.includes(chest.chest.items[0]),'chest choice missing from bag');
      const relic=await fixture('relic');await page.locator('.rl-card').first().waitFor();
      for(const item of await page.locator('.rl-card').all()){ok(await item.locator('.support-tag').count()>0,'relic identity missing');ok((await item.locator('.rl-text').innerText()).length>8,'relic rule missing');}
      await page.locator('.rl-card').first().click();await shot('relic-rules');await page.locator('.rl-take').click();ok((await state()).relics.includes(relic.relicPick.opts[0]),'relic confirmation missing');await fixture('capped-chest');await page.locator('.chest-ad').waitFor();ok(await page.locator('.chest-ad').isDisabled(),'full two-orange budget still offers purple upgrade');await shot('capped-chest-disabled');return {...await noOverflow(),orangeCapDisabled:true};
    });
    await step('battle-rule-report-and-cleanup','mechanism-fixture',async()=>{
      const detail=await fixture('battle');ok(detail.preview.events.some(e=>e.label.includes('散弹引信')),'support food has no actual rule trigger');
      await page.getByRole('button',{name:/开 战/}).click();await page.getByRole('button',{name:'跳过',exact:true}).waitFor();
      await page.waitForTimeout(1200);await shot('support-battle-playing');await page.getByRole('button',{name:'跳过',exact:true}).click();
      await page.locator('.res-review').waitFor({timeout:15000});const after=await state();ok(after,'postbattle save missing');
      for(const unit of [...after.queue,...after.hand])if(unit&&unit.kind!=='spell')for(const key of ['startCharge','wounds','seal','startBlock','supportFoods','sealSources'])ok(unit[key]===undefined,`resource persisted ${key}`);
      await page.locator('.res-review').click();await page.locator('.br-row').first().waitFor();
      const sourceTitles=[];const visibleSources=new Set();
      for(let i=0;i<await page.locator('.br-row').count();i++){await page.locator('.br-row').nth(i).click();for(const kind of await page.locator('.br-chip.src').evaluateAll(xs=>xs.map(x=>x.dataset.source).filter(Boolean)))visibleSources.add(kind);sourceTitles.push(...await page.locator('.br-chip.src').evaluateAll(xs=>xs.map(x=>x.getAttribute('title')??x.getAttribute('aria-label')??x.textContent)));}
      await shot('support-battle-report');for(const kind of ['equipment','supply','relic'])ok(visibleSources.has(kind),`report missing visible ${kind} provenance ${[...visibleSources]}`);ok(detail.preview.sources.includes('equipment')&&detail.preview.sources.includes('supply')&&detail.preview.sources.includes('relic'),`three-source fixture missing ${detail.preview.sources}`);
      return {seed:detail.seed,preview:detail.preview,sources:sourceTitles,resourcesCleared:true,...await noOverflow()};
    });
    await step('shared-preview-and-merchant-availability','mechanism-fixture',async()=>{
      await fixture('share-preview');
      const before=await state(),a=await page.getByRole('button',{name:'补给 行军干粮',exact:true}).boundingBox(),b=await page.getByRole('button',{name:'后排投石手 位置2',exact:true}).boundingBox();ok(a&&b,'sharing preview endpoints missing');
      await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2+12,a.y+a.height/2,{steps:3});await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:15});
      const highlighted=await page.locator('.unit.side-0.supply-preview').evaluateAll(xs=>xs.map(el=>el.getAttribute('aria-label')));ok(highlighted.length===3,`shared food preview ${highlighted}`);await shot('shared-rusk-preview');
      ok(JSON.stringify(await state())===JSON.stringify(before),'hover changed saved state');await page.mouse.up();await finishFx();const fed=await state();for(const i of [0,1,2])ok(fed.queue[i].hpBonus===before.queue[i].hpBonus+2,`shared food actual recipient ${i}`);
      const merchant=[];
      for(const [mode,reason] of [['merchant-full','补给栏'],['merchant-target','永久技能']]){
        await fixture(mode);await page.locator('.mc-good').waitFor();const current=await state();ok(current.gold>=3,'merchant fixture lacks money');ok(await page.locator('.mc-good').isDisabled(),`${mode} available despite condition`);const text=await page.locator('.mc-availability').innerText();ok(text.includes(reason),`${mode} wrong reason ${text}`);await shot(mode);merchant.push({mode,reason:text,gold:current.gold});await page.getByRole('button',{name:'走了',exact:true}).click();ok(JSON.stringify((await state()).merchant)===JSON.stringify(current.merchant),'disabled merchant changed goods');await noOverflow();
      }
      await fixture('single-quarry');ok(await page.locator('.unit.side-1.is-quarry[aria-label*="敌方位置1"]').count()===1,'shrunk enemy does not mark front quarry');const effective=await page.evaluate(async()=>{const m=await import('/src/core/run.ts');return m.simOpts(m.load()).quarry;});ok(effective===0,'shrunk battle quarry mismatch');await shot('single-enemy-quarry');return {highlighted,merchant,quarry:{saved:3,effective}};
    });
    await step('v4-preserved-v5-and-tutorial','save-and-tutorial',async()=>{
      await page.goto(base);const legacy='support-ui-v4-preserved';
      await page.evaluate(legacy=>{localStorage.clear();localStorage.setItem('pdqs3_run_v4',legacy);},legacy);await page.reload();
      ok((await page.locator('.save-status').innerText()).includes('旧版进度已保留'),'legacy status absent');
      await fixture();const before=await page.evaluate(()=>({v4:localStorage.getItem('pdqs3_run_v4'),v5:localStorage.getItem('pdqs3_run_v5')}));ok(before.v4===legacy&&before.v5,'keys not independent');
      await page.goto(base);await page.getByRole('button',{name:'新手教程',exact:true}).click();await page.locator('.tut-box').waitFor();await shot('tutorial-welcome');await page.locator('.tut-ok').click();
      ok((await page.locator('.tut-box').innerText()).includes('后排投石手'),'new tutorial lesson absent');
      const after=await page.evaluate(()=>({v4:localStorage.getItem('pdqs3_run_v4'),v5:localStorage.getItem('pdqs3_run_v5')}));ok(JSON.stringify(before)===JSON.stringify(after),'tutorial changed persisted saves');
      const box=await page.locator('.tut-box').boundingBox();ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,'tutorial outside viewport');await shot('tutorial-new-charge');return {legacyPreserved:true,v5Preserved:true,...await noOverflow()};
    });
    await context.close();
  }
} finally {
  await browser.close();writeFileSync(`${output}/${process.env.RESULTS_FILE??'results.json'}`,JSON.stringify({base,results,errors,fixtures,coverageNotes:['Natural title, shop purchase, first battle and first relic reward use actual progression.','Mechanism fixtures select legal newRun seeds, use authored unit/enemy stats, and record all setup inputs.','Tutorial covers entry and the first purchase callout.']},null,2));
}
console.log(JSON.stringify({results:results.map(({detail,...result})=>({...result,...(result.ok?{detail:detail?.preview??detail?.sources??detail?.targetNames??(detail?.seed?{seed:detail.seed}:detail)}:{})})),errors},null,2));if(results.some(r=>!r.ok)||errors.length)process.exitCode=1;
