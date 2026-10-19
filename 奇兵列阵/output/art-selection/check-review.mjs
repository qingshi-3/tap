import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=new URL('review-check/',import.meta.url);mkdirSync(out,{recursive:true});
const data=JSON.parse(readFileSync(new URL('selection.json',import.meta.url),'utf8'));
const cards=data.units.filter(u=>u.kind==='card');
const browser=await chromium.launch({channel:'msedge',headless:true});
const report=[];
try{
for(const size of [{width:1440,height:900},{width:844,height:390},{width:390,height:844}]){
 const context=await browser.newContext({viewport:size,hasTouch:size.width<1000,isMobile:size.width<1000,reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(new URL('review.html',import.meta.url).href);
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 assert.equal(await page.locator('#cards img').count(),56);assert.equal(await page.locator('img').count(),73);
 for(const u of cards){const row=page.locator(`[data-id="${u.id}"]`);assert.equal(await row.locator('.identity strong').textContent(),u.name);for(const star of u.stars){const cell=row.locator(`[data-level="${star.level}"]`);assert.equal(await cell.locator('.stats').textContent(),`攻击 ${star.atk} / 生命 ${star.hp}`);assert.equal(await cell.locator('p').textContent(),star.effect);}assert.equal(await row.locator('.mapping code').textContent(),u.source);assert.equal(await row.locator('.mapping span').textContent(),u.reason);}
 const shot=async name=>page.screenshot({path:fileURLToPath(new URL(`${size.width}-${name}.png`,out))});
 await shot('initial');
 await page.keyboard.press('Tab');assert.equal(await page.locator('#search').evaluate(n=>n===document.activeElement),true);assert.equal(await page.locator('#search').evaluate(n=>getComputedStyle(n).outlineStyle),'solid');await shot('focus');
 await page.getByRole('searchbox').fill(cards[0].name);assert.equal(await page.locator('#cards .unit:visible').count(),1);await shot('search');
 await page.getByRole('button',{name:'重置'}).click();await page.waitForFunction(()=>document.querySelector('#count').textContent.startsWith('56 /'));
 await page.getByRole('searchbox').fill('指定');
 const designated=cards.filter(u=>['id','name','faction','rarity','role','source','reason'].some(k=>String(u[k]??'').includes('指定'))||u.stars.some(s=>s.effect.includes('指定'))).map(u=>u.id);
 assert.deepEqual(await page.locator('#cards .unit:visible').evaluateAll(rows=>rows.map(n=>n.dataset.id)),designated);
 assert.ok(['n_marshal','s_choreo','a_ritualist','l_archon'].every(id=>designated.includes(id)));
 await shot('designated-search');
 await page.getByRole('searchbox').fill(cards.find(u=>u.id==='l_archon').name);
 assert.equal(await page.locator('#cards .unit:visible').count(),1);
 await page.locator('[data-id="l_archon"]').scrollIntoViewIfNeeded();await shot('archon-skill');
 await page.locator('[data-id="l_archon"] [data-level="3"]').scrollIntoViewIfNeeded();await shot('archon-three-star');
 assert.equal(await page.locator('[data-id="l_archon"] [data-level="3"] p').textContent(),cards.find(u=>u.id==='l_archon').stars[2].effect);
 await page.getByRole('button',{name:'重置'}).click();await page.waitForFunction(()=>document.querySelector('#count').textContent.startsWith('56 /'));
 await page.getByRole('combobox',{name:/^阵营/}).selectOption(cards[0].faction);
 await page.getByRole('combobox',{name:/^品质/}).selectOption(cards[0].rarity);
 const expected=cards.filter(u=>u.faction===cards[0].faction&&u.rarity===cards[0].rarity).length;
 assert.equal(await page.locator('#cards .unit:visible').count(),expected);await shot('filtered');
 await page.getByRole('searchbox').fill('不存在的单位xyz');assert.equal(await page.locator('#empty').isVisible(),true);await shot('empty');
 await page.getByRole('button',{name:'重置'}).click();await page.waitForFunction(()=>document.querySelector('#count').textContent.startsWith('56 /'));
 const long=cards.toSorted((a,b)=>Math.max(...b.stars.map(s=>s.effect.length))-Math.max(...a.stars.map(s=>s.effect.length)))[0];
 await page.locator(`[data-id="${long.id}"]`).scrollIntoViewIfNeeded();await shot('long-skill');
 await page.getByRole('heading',{name:'召唤物',exact:true}).scrollIntoViewIfNeeded();await shot('tokens');
 const layout=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,animations:document.getAnimations().length,controls:[...document.querySelectorAll('input,select,button')].map(n=>({height:n.getBoundingClientRect().height})),loadedImages:[...document.images].filter(i=>i.complete&&i.naturalWidth>0).length}));
 assert.ok(layout.scrollWidth<=layout.viewport);assert.equal(layout.animations,0);assert.ok(layout.controls.every(c=>c.height>=44));assert.equal(requests.filter(u=>/^https?:/.test(u)).length,0);assert.deepEqual(errors,[]);
 report.push({size,designVersion:data.designVersion,designatedSearch:designated,archonSkill:true,verifiedCards:56,exactStarValuesAndEffects:168,imagesLoaded:layout.loadedImages,search:true,factionAndRarity:true,emptyState:true,reset:true,keyboardFocus:true,reducedMotion:true,offline:true,layout,errors});
 await context.close();
}
writeFileSync(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close()}
