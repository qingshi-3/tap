import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'output');
const URL = 'http://127.0.0.1:4178/';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
await mkdir(OUT, { recursive: true });

const report = { url: URL, startedAt: new Date().toISOString(), cases: [], errors: [] };
const browser = await chromium.launch({ executablePath: EDGE, headless: true });

async function contextFor({ width, height, reducedMotion = 'no-preference', mobile = false }) {
  const context = await browser.newContext({
    viewport: { width, height }, reducedMotion, hasTouch: mobile, isMobile: mobile,
    userAgent: mobile ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' : undefined,
  });
  await context.route('**/main.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: `${source}\nObject.defineProperty(window,'__QA',{configurable:true,value:{game:()=>game}});\n` });
  });
  return context;
}

async function openBattle(page, hero) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.campaign-shell:not(.is-hidden)').waitFor({ timeout: 35000 });
  await page.locator('[data-tab="hero"]').click();
  await page.locator(`[data-hero="${hero}"]`).click();
  await page.locator(`[data-hero="${hero}"].is-active`).waitFor();
  await page.locator('[data-tab="map"]').click();
  await page.locator('[data-action="depart"]').click();
  await page.waitForFunction(() => window.__QA?.game().phase === 'playing');
  await page.locator('#battle').waitFor({ state: 'visible' });
}

async function seedTargets(page) {
  await page.evaluate(() => {
    const g = window.__QA.game(), p = g.player;
    g.enemies = Array.from({ length: 8 }, (_, i) => ({
      id: 9000 + i, kind: 'grunt', x: p.x + 72 + (i % 4) * 24, y: p.y - 42 + Math.floor(i / 4) * 74,
      radius: 15, hp: 220, maxHp: 220, speed: 0, damage: 0, xp: 2, spawnDelay: 0, attackCooldown: 99,
      anim: 'idle', animTime: 0, animDuration: 0, hitFlash: 0, dead: false,
    }));
  });
}

async function assertNoOverflow(page, selector) {
  return page.locator(selector).evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect();
    return { text: node.textContent.trim().slice(0, 40), left: r.left, top: r.top, right: r.right, bottom: r.bottom,
      clipped: r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 };
  }));
}

async function desktopHero(hero, natural = false) {
  const context = await contextFor({ width: 1280, height: 720 });
  const page = await context.newPage(), browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
  await openBattle(page, hero);
  if (natural) {
    await page.keyboard.down('d'); await page.waitForTimeout(1800); await page.keyboard.up('d');
    await page.waitForFunction(() => { const g=window.__QA.game(); return g.kills > 0 && g.player.xp > 0; }, null, { timeout: 18000 });
  }
  await seedTargets(page);
  for (const key of ['q','e','r']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(hero==='blink'&&key==='q'?750:620);
  }
  const loadoutCooldowns=await page.evaluate(()=>{const g=window.__QA.game();return Object.fromEntries(g.skillLoadout.map(id=>[id,g.skills[id]?.remaining||0]))});
  if(Object.values(loadoutCooldowns).some(value=>value<=0))throw new Error(`${hero} skill input did not cast all loadout skills: ${JSON.stringify(loadoutCooldowns)}`);
  const state = await page.evaluate(() => { const g=window.__QA.game(); return { hero:g.heroId, phase:g.phase, time:g.time, kills:g.kills, xp:g.player.xp,
    heroEffects:g.heroEffects.length, commonEffects:g.commonEffects.length, companions:g.companions.length, skills:Object.fromEntries(Object.entries(g.skills).map(([k,v])=>[k,v.remaining])) }; });
  await page.screenshot({ path: path.join(OUT, `dual-axis-browser-desktop-${hero}.png`) });
  if(hero==='commander'){
    await page.evaluate(()=>{const g=window.__QA.game();g.upgrades.frost=1;g.upgrades.vortex=1;g._commonClocks.frost=0;g._commonClocks.vortex=0;});
    await page.waitForTimeout(180);await page.screenshot({path:path.join(OUT,'dual-axis-browser-common-zones.png')});
    await page.evaluate(()=>{const g=window.__QA.game();for(const id of Object.keys(g.upgrades))g.upgrades[id]=0;g.commonEffects=[];g.commonEntities=[];g.upgrades.beam=4;g.evolutions.beam='a';g.upgrades.dagger=4;g.evolutions.dagger='a';g._commonClocks.beam=0;g._commonClocks.dagger=0;});
    await page.waitForTimeout(180);await page.screenshot({path:path.join(OUT,'dual-axis-browser-common-beam-dagger.png')});
  }
  await page.locator('#pause').click();
  await page.locator('#pause-dialog[open]').waitFor();
  await page.locator('#pause-dialog summary').click();
  const focus = await page.evaluate(() => ({ active:document.activeElement?.id || document.activeElement?.tagName, open:document.querySelector('#pause-dialog')?.open }));
  const pauseLayout = await assertNoOverflow(page, '#pause-dialog, #pause-dialog button, #build-summary p');
  report.cases.push({ name:`desktop-${hero}`, state, focus, pauseLayout, browserErrors });
  report.errors.push(...browserErrors.map(message=>({case:`desktop-${hero}`,message})));
  await context.close();
}

async function mobileTouch() {
  const context = await contextFor({ width: 844, height: 390, mobile: true });
  const page = await context.newPage(), browserErrors=[];
  page.on('pageerror', e=>browserErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text())});
  await openBattle(page, 'mage'); await seedTargets(page);
  const canvas=await page.locator('#battle').boundingBox(), skill=page.locator('.skill-button').first(),box=await skill.boundingBox();
  const before=await page.evaluate(()=>({x:window.__QA.game().player.x,y:window.__QA.game().player.y}));
  const cdp=await context.newCDPSession(page);
  const joy={x:canvas.x+105,y:canvas.y+canvas.height-75,id:1},aim={x:box.x+box.width/2,y:box.y+box.height/2,id:2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[joy]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[joy,aim]});
  const joyMove={...joy,x:joy.x+68,y:joy.y-22},aimMove={...aim,x:aim.x+70,y:aim.y-26};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[joyMove,aimMove]});await page.waitForTimeout(420);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(220);
  const state=await page.evaluate((before)=>{const g=window.__QA.game(),id=g.skillLoadout[0];return{phase:g.phase,x:g.player.x,y:g.player.y,moved:Math.hypot(g.player.x-before.x,g.player.y-before.y),skillAim:g.skillAim,skill:id,cooldown:g.skills[id]?.remaining||0}},before);
  if(state.moved<3||state.cooldown<=0||state.skillAim!==null)throw new Error(`Touch multitask failed: ${JSON.stringify(state)}`);
  const layout=await assertNoOverflow(page,'#hud, #skill-bar, .skill-button, #joystick');
  await page.screenshot({path:path.join(OUT,'dual-axis-browser-mobile-844x390.png')});
  report.cases.push({name:'mobile-844x390-touch',state,layout,browserErrors});report.errors.push(...browserErrors.map(message=>({case:'mobile-touch',message})));
  await context.close();
}

async function reducedUpgrade() {
  const context=await contextFor({width:667,height:320,reducedMotion:'reduce',mobile:true});
  const page=await context.newPage(),browserErrors=[];
  page.on('pageerror',e=>browserErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text())});
  await openBattle(page,'commander');
  await page.evaluate(()=>{const g=window.__QA.game(),p=g.player;g.upgrades.orb=3;g.gems.push({id:g._nextId++,x:p.x,y:p.y,value:p.xpNext+1});});
  await page.locator('#upgrade-dialog[open]').waitFor({timeout:6000});
  const firstChoices=await page.locator('.upgrade-option').evaluateAll(cards=>cards.map(c=>({text:c.innerText,category:c.dataset.category,rect:(()=>{const r=c.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom}})()})));
  if(firstChoices.length!==3)throw new Error(`Expected 3 choices, got ${firstChoices.length}`);
  await page.screenshot({path:path.join(OUT,'dual-axis-browser-reduced-choice-667x320.png')});
  const evolution=page.locator('.upgrade-option[data-category="evolution"]').first();
  if(await evolution.count()!==1)throw new Error('Expected evolution choice for rank-3 orb');
  await page.waitForTimeout(260);await evolution.click();
  await page.waitForFunction(()=>Boolean(window.__QA.game().evolutions.orb));
  await page.waitForFunction(()=>window.__QA.game().phase==='playing',{timeout:3000});
  await page.evaluate(()=>{const g=window.__QA.game(),p=g.player;g.upgrades.dagger=1;g.gems.push({id:g._nextId++,x:p.x,y:p.y,value:p.xpNext+1});});
  await page.locator('#upgrade-dialog[open]').waitFor({timeout:6000});
  const capChoices=await page.locator('.upgrade-option').evaluateAll(cards=>cards.map(c=>({text:c.innerText,category:c.dataset.category})));
  if(capChoices.some(c=>c.category==='weapon'))throw new Error('Unowned common ability appeared at the two-ability cap');
  await page.waitForTimeout(260);await page.keyboard.press('1');
  await page.waitForFunction(()=>window.__QA.game().phase!=='upgrade');
  const state=await page.evaluate(()=>{const g=window.__QA.game();return{reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,evolution:g.evolutions.orb,orb:g.upgrades.orb,dagger:g.upgrades.dagger,phase:g.phase}});
  const layout=await assertNoOverflow(page,'#upgrade-dialog, .upgrade-option, #skill-bar, .skill-button');
  await page.screenshot({path:path.join(OUT,'dual-axis-browser-reduced-667x320.png')});
  report.cases.push({name:'reduced-667x320-upgrade',state,firstChoices,capChoices,layout,browserErrors});report.errors.push(...browserErrors.map(message=>({case:'reduced-upgrade',message})));
  await context.close();
}

async function focusedCommonZones() {
  const context=await contextFor({width:1280,height:720}),page=await context.newPage(),browserErrors=[];
  page.on('pageerror',e=>browserErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text())});
  await openBattle(page,'commander');await seedTargets(page);
  await page.evaluate(()=>{const g=window.__QA.game();g.upgrades.frost=1;g.upgrades.vortex=1;g._commonClocks.frost=0;g._commonClocks.vortex=0;});
  await page.waitForTimeout(220);
  const state=await page.evaluate(()=>{const g=window.__QA.game();return{zones:g.commonEntities.filter(e=>e.kind==='zone').map(e=>({weapon:e.weapon,radius:e.radius})),effects:g.commonEffects.map(e=>({weapon:e.weapon,shape:e.shape,radius:e.radius,layer:e.layer}))}});
  await page.screenshot({path:path.join(OUT,'dual-axis-browser-common-zones.png')});
  report.cases.push({name:'focused-common-zones',state,browserErrors});report.errors.push(...browserErrors.map(message=>({case:'focused-common-zones',message})));
  await context.close();
}

async function focusedProjectileDash() {
  const context=await contextFor({width:1280,height:720}),page=await context.newPage(),browserErrors=[];
  page.on('pageerror',e=>browserErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text())});
  await openBattle(page,'commander');await seedTargets(page);
  await page.evaluate(()=>{const g=window.__QA.game();g.upgrades.orb=4;g.evolutions.orb='b';g.upgrades.dagger=4;g.evolutions.dagger='a';g._commonClocks.orb=0;g._commonClocks.dagger=0;});
  await page.keyboard.press('q');await page.waitForTimeout(120);
  const state=await page.evaluate(()=>{const g=window.__QA.game();return{dash:g.skills.dash.remaining,projectiles:g.commonEntities.filter(e=>e.shape==='projectile').map(e=>({weapon:e.weapon,kind:e.kind,radius:e.radius}))}});
  if(state.dash<=0||!state.projectiles.length)throw new Error(`Focused projectile/dash setup failed: ${JSON.stringify(state)}`);
  await page.screenshot({path:path.join(OUT,'dual-axis-browser-focused-projectile-dash.png')});
  report.cases.push({name:'focused-projectile-dash',state,browserErrors});report.errors.push(...browserErrors.map(message=>({case:'focused-projectile-dash',message})));
  await context.close();
}

async function focusedMobileWideSkill() {
  const context=await contextFor({width:844,height:390,mobile:true}),page=await context.newPage(),browserErrors=[];
  page.on('pageerror',e=>browserErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text())});
  await openBattle(page,'mage');await seedTargets(page);
  const button=page.locator('.skill-button').nth(2),box=await button.boundingBox(),cdp=await context.newCDPSession(page);
  const start={x:box.x+box.width/2,y:box.y+box.height/2,id:7},end={...start,x:start.x-76};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[end]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(260);
  const state=await page.evaluate(()=>{const g=window.__QA.game();return{cooldown:g.skills.frostAura.remaining,fields:g.fields.filter(f=>f.type==='heroFrost').map(f=>({radius:f.radius,life:f.life})),skillAim:g.skillAim}});
  if(state.cooldown<=0||!state.fields.length||state.skillAim!==null)throw new Error(`Focused mobile frost cast failed: ${JSON.stringify(state)}`);
  await page.screenshot({path:path.join(OUT,'dual-axis-browser-mobile-wide-skill-844x390.png')});
  report.cases.push({name:'focused-mobile-wide-skill',state,browserErrors});report.errors.push(...browserErrors.map(message=>({case:'focused-mobile-wide-skill',message})));
  await context.close();
}

try {
  if(process.argv.includes('--focused')){
    await focusedCommonZones();await focusedProjectileDash();await focusedMobileWideSkill();
  }else{
    for (const hero of ['commander','summoner','blink','mage']) await desktopHero(hero,hero==='commander');
    await mobileTouch();await reducedUpgrade();
  }
} catch (error) {
  report.errors.push({case:'harness',message:error.stack||String(error)});
  throw error;
} finally {
  report.finishedAt=new Date().toISOString();
  await writeFile(path.join(OUT,process.argv.includes('--focused')?'dual-axis-browser-focused-report.json':'dual-axis-browser-report.json'),JSON.stringify(report,null,2));
  await browser.close();
}

console.log(JSON.stringify({cases:report.cases.map(c=>c.name),errors:report.errors},null,2));
