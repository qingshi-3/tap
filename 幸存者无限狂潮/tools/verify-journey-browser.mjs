import {STORAGE_KEY,PROFILE_SCHEMA_VERSION} from '../dist/campaign.js';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'output');
const URL = 'http://127.0.0.1:4178/';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const DUNGEONS = ['moss-gate', 'ember-trail', 'blade-trial', 'swift-trial'];
const FORBIDDEN_MAPS = ['world-map-original.png', 'world-map.jpg'];

await mkdir(OUT, { recursive: true });
const report = { url: URL, startedAt: new Date().toISOString(), cases: [], errors: [] };
const browser = await chromium.launch({ executablePath: EDGE, headless: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function profile({ level = 1, cleared = [], wins = {}, claimed = [], gold = 300, materials = 30 } = {}) {
  return {
    version: PROFILE_SCHEMA_VERSION, gold, materials,
    roster: { 'stone-guard': { level: 1, copies: 0 }, 'wind-scout': { level: 1, copies: 0 } },
    squad: ['stone-guard', 'wind-scout'], buildings: { hall: 0, barracks: 0, workshop: 0 },
    cleared: [...cleared], settledRuns: [], lastReward: null, selectedHero: 'commander',
    heroes: {
      commander: { level, experience: 0, job: 'fighter', unlockedJobs: ['fighter'], skillLoadout: ['dash', 'cleave', 'guard'] },
      summoner: { level: 1, experience: 0, job: 'summoner', unlockedJobs: ['summoner'], skillLoadout: ['summonGuard', 'recallSummons', 'summonElite'] },
      blink: { level: 1, experience: 0, job: 'blink', unlockedJobs: ['blink'], skillLoadout: ['markBlade', 'blinkStrike', 'blinkStorm'] },
      mage: { level: 1, experience: 0, job: 'mage', unlockedJobs: ['mage'], skillLoadout: ['flameBreath', 'rockWall', 'frostAura'] },
    },
    progression: { claimedQuests: [...claimed], dungeonWins: { ...wins }, kills: 0 },
  };
}

async function contextFor({ width, height, touch = false, state = profile() }) {
  const context = await browser.newContext({
    viewport: { width, height }, hasTouch: touch, isMobile: touch,
    userAgent: touch ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' : undefined,
  });
  await context.addInitScript(({ key, value }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: state });
  // Read-only gameplay state used only to prove that depart entered the selected real dungeon.
  await context.route('**/main.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: `${source}\nObject.defineProperty(window,'__JOURNEY_QA_GAME',{configurable:true,get:()=>game});\n` });
  });
  return context;
}

function observe(page, name) {
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('request', request => requests.push(request.url()));
  page.on('requestfailed', request => errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText || 'failed'})`));
  return () => {
    const forbidden = requests.filter(url => FORBIDDEN_MAPS.some(namePart => url.includes(namePart)));
    if (forbidden.length) errors.push(`forbidden map requested: ${forbidden.join(', ')}`);
    report.errors.push(...errors.map(message => ({ case: name, message })));
    return { errors, requests };
  };
}

async function openCampaign(page, tab = 'quests') {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.campaign-shell:not(.is-hidden)').waitFor({ timeout: 35000 });
  if (tab) await page.locator(`[data-tab="${tab}"]`).click();
  await page.locator(tab === 'map' ? '.journey-expedition' : '.journey-quests').waitFor();
}

async function saved(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

async function brokenImages(page) {
  await page.waitForFunction(() => [...document.images].every(image => image.complete), null, { timeout: 10000 });
  return page.locator('img').evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.getAttribute('src')));
}

async function visibleRects(page, selector) {
  return page.locator(selector).evaluateAll(nodes => nodes.filter(node => {
    const style = getComputedStyle(node), r = node.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && r.width && r.height;
  }).map(node => {
    const r = node.getBoundingClientRect();
    return { label: node.getAttribute('aria-label') || node.textContent.trim().replace(/\s+/g, ' ').slice(0, 42), width: r.width, height: r.height, x: r.x, y: r.y, right: r.right, bottom: r.bottom, inViewport: r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight };
  }));
}

async function touchTap(context, page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert(box, 'Touch target has no bounding box');
  const cdp = await context.newCDPSession(page);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function touchSwipe(context, page, locator, { from = .8, to = .2 } = {}) {
  const box = await locator.boundingBox();
  assert(box, 'Touch scroll area has no bounding box');
  const cdp = await context.newCDPSession(page), x = box.x + box.width / 2;
  const start = { x, y: box.y + box.height * from, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (let step = 1; step <= 6; step++) {
    const y = start.y + (box.height * (to - from) * step / 6);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(180);
}

async function effectiveTouchSize(locator) {
  return locator.evaluate(node => {
    let rect = node.getBoundingClientRect();
    let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
    let right = Math.min(innerWidth, rect.right), bottom = Math.min(innerHeight, rect.bottom);
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll|hidden|clip)/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)) {
        rect = parent.getBoundingClientRect();
        left = Math.max(left, rect.left); top = Math.max(top, rect.top);
        right = Math.min(right, rect.right); bottom = Math.min(bottom, rect.bottom);
      }
    }
    return { width: Math.max(0, right - left), height: Math.max(0, bottom - top), left, top, right, bottom };
  });
}

async function questBehavior() {
  const initial = profile({ level: 3, cleared: ['moss-gate'], wins: { 'moss-gate': 1 }, gold: 300, materials: 30 });
  const context = await contextFor({ width: 1280, height: 720, state: initial });
  const page = await context.newPage(), finish = observe(page, 'quest-behavior');
  await openCampaign(page, 'quests');
  assert(await page.locator('.journey-quest').count() === 4, 'Expected four explicit quest rows');
  assert(await page.locator('.journey-quest.is-ready [data-claim="main-moss"]').count() === 1, 'Ready quest is not explicit/claimable');
  assert(await page.locator('.journey-quest:not(.is-ready):not(.is-complete)').count() >= 1, 'Available or locked quest state is missing');
  const before = await saved(page);
  await page.locator('[data-claim="main-moss"]').click();
  let after = await saved(page);
  assert(after.gold === before.gold + 200 && after.materials === before.materials + 20, `Claim reward wrong: ${after.gold}/${after.materials}`);
  assert(after.progression.claimedQuests.filter(id => id === 'main-moss').length === 1, 'Claim was not recorded exactly once');
  assert(await page.locator('.journey-quest.is-complete').filter({ hasText: '突破苔痕关' }).count() === 1, 'Claimed state is not explicit');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.journey-quests').waitFor();
  after = await saved(page);
  assert(after.gold === before.gold + 200 && after.materials === before.materials + 20, 'Reload duplicated or lost claimed reward');
  assert(await page.locator('[data-claim="main-moss"]').count() === 0, 'Claim action remained after reload');
  await page.locator('[data-route="ember-trail"]').click();
  await page.locator('.journey-expedition [data-dungeon="ember-trail"][aria-pressed="true"]').waitFor();
  assert((await page.locator('.journey-brief-title h2').textContent()).includes('烬火'), 'Quest route selected wrong dungeon');
  const resourceFailures = await brokenImages(page), observed = finish();
  assert(!resourceFailures.length && !observed.errors.length, `Quest errors: ${[...resourceFailures, ...observed.errors].join('; ')}`);
  report.cases.push({ name: 'quest-claim-once-persist-and-route', reward: { gold: 200, materials: 20 }, routedDungeon: 'ember-trail' });
  await context.close();
}

async function expeditionRulesAndDepart() {
  const freshContext = await contextFor({ width: 1280, height: 720, state: profile() });
  const freshPage = await freshContext.newPage(), finishFresh = observe(freshPage, 'fresh-locks');
  await openCampaign(freshPage, 'map');
  assert(await freshPage.locator('[data-dungeon="moss-gate"]:not(.is-locked)').count() === 1, 'Moss gate should be open on a fresh profile');
  for (const id of ['ember-trail', 'blade-trial', 'swift-trial']) assert(await freshPage.locator(`[data-dungeon="${id}"].is-locked`).count() === 1, `${id} should be locked on a fresh profile`);
  let observed = finishFresh();
  assert(!observed.errors.length, `Fresh lock browser errors: ${observed.errors.join('; ')}`);
  await freshContext.close();

  const unlocked = profile({ level: 3, cleared: ['moss-gate'], wins: { 'moss-gate': 1 } });
  const context = await contextFor({ width: 1280, height: 720, state: unlocked });
  const page = await context.newPage(), finish = observe(page, 'scenes-depart');
  await openCampaign(page, 'map');
  const before = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  const scenes = [];
  for (const id of DUNGEONS) {
    const button = page.locator(`[data-dungeon="${id}"]`);
    await button.focus(); await page.keyboard.press('Enter');
    await page.locator(`[data-dungeon="${id}"][aria-pressed="true"]`).waitFor();
    assert(await page.evaluate(expected => document.activeElement?.dataset.dungeon === expected, id), `Keyboard focus did not survive selecting ${id}`);
    const state = await page.locator('.journey-stage').evaluate(node => ({ title: node.querySelector('header h2')?.textContent.trim(), src: node.querySelector(':scope > img')?.getAttribute('src') }));
    assert(state.title && state.src, `Missing scene details for ${id}`);
    scenes.push({ id, ...state });
  }
  assert(new Set(scenes.map(scene => scene.src)).size === 4, `Expected four distinct scene images: ${JSON.stringify(scenes)}`);
  assert(DUNGEONS.every(id => scenes.some(scene => scene.id === id && !FORBIDDEN_MAPS.some(name => scene.src.includes(name)))), 'Generated world map still used');
  assert(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY) === before, 'Dungeon selection mutated save data');
  assert(await page.locator('[data-dungeon="ember-trail"]:not(.is-locked)').count() === 1, 'Ember should unlock after clearing moss gate');
  assert(await page.locator('[data-dungeon="blade-trial"]:not(.is-locked)').count() === 1 && await page.locator('[data-dungeon="swift-trial"]:not(.is-locked)').count() === 1, 'Commander level 3 trials should unlock after moss clear');
  await page.locator('[data-dungeon="ember-trail"]').click();
  await page.locator('[data-action="depart"]').click();
  await page.waitForFunction(() => window.__JOURNEY_QA_GAME?.phase === 'playing', null, { timeout: 10000 });
  const gameDungeon = await page.evaluate(() => window.__JOURNEY_QA_GAME?.dungeon?.id);
  assert(gameDungeon === 'ember-trail', `Depart entered wrong actual dungeon: ${gameDungeon}`);
  const failures = await brokenImages(page); observed = finish();
  assert(!failures.length && !observed.errors.length, `Expedition errors: ${[...failures, ...observed.errors].join('; ')}`);
  report.cases.push({ name: 'four-scenes-locks-selection-and-real-depart', scenes, gameDungeon, storageUnchangedBySelection: true });
  await context.close();
}

async function layoutsTouchAndSmoke() {
  const state = profile({ level: 3, cleared: ['moss-gate'], wins: { 'moss-gate': 1 } });
  for (const viewport of [{ width: 844, height: 390, touch: true }, { width: 667, height: 320, touch: true }, { width: 1130, height: 1180 }, { width: 1280, height: 720 }]) {
    const name = `layout-${viewport.width}x${viewport.height}`;
    const context = await contextFor({ ...viewport, state });
    const page = await context.newPage(), finish = observe(page, name);
    await openCampaign(page, 'quests');
    if (viewport.touch) {
      await touchTap(context, page, page.locator('[data-tab="map"]'));
      await page.locator('.journey-expedition').waitFor();
      await touchTap(context, page, page.locator('[data-dungeon="ember-trail"]'));
      await page.locator('[data-dungeon="ember-trail"][aria-pressed="true"]').waitFor();
    } else {
      await page.locator('[data-tab="map"]').click();
      await page.locator('.journey-expedition').waitFor();
    }
    const controls = await visibleRects(page, '.campaign-nav button, .journey-scene, .journey-depart, .journey-action');
    const primary = await visibleRects(page, '.journey-depart, .journey-action');
    assert(primary.length && primary.every(item => item.width >= 44 && item.height >= 44 && item.inViewport), `${name} primary button under 44px or clipped: primary=${JSON.stringify(primary)} controls=${JSON.stringify(controls)}`);
    const picker = page.locator('.journey-scene-picker');
    if (!viewport.touch) {
      await picker.evaluate(node => { node.scrollTop = node.scrollHeight; node.scrollLeft = node.scrollWidth; });
      await page.locator('[data-dungeon="swift-trial"]').scrollIntoViewIfNeeded();
    }
    const lastReachable = await page.locator('[data-dungeon="swift-trial"]').evaluate(node => { const r = node.getBoundingClientRect(); return r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; });
    assert(lastReachable, `${name} could not reach final dungeon by scrolling`);
    const screenshot = path.join(OUT, `journey-qa-expedition-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: screenshot, fullPage: viewport.height >= 700 });
    await page.locator('[data-tab="quests"]').click(); await page.locator('.journey-quests').waitFor();
    const list = page.locator('.journey-quest-list');
    const lastAction = page.locator('.journey-quest').last().locator('.journey-action');
    if (viewport.width === 667 && viewport.height === 320) {
      let effective = await effectiveTouchSize(lastAction);
      let swipeCount = 0;
      for (let attempt = 0; (effective.width < 44 || effective.height < 44) && attempt < 4; attempt++) {
        await touchSwipe(context, page, list);
        swipeCount++;
        effective = await effectiveTouchSize(lastAction);
      }
      assert(effective.width >= 44 && effective.height >= 44, `${name} final quest action clipped after real swipe: ${JSON.stringify(effective)}`);
      await page.screenshot({ path: path.join(OUT, `journey-qa-quests-${viewport.width}x${viewport.height}.png`) });
      await touchTap(context, page, lastAction);
      await page.locator('[data-dungeon="swift-trial"][aria-pressed="true"]').waitFor();
      assert((await page.locator('.journey-brief-title h2').textContent()).includes('迅刃'), `${name} final quest real touch routed to wrong details`);
      report.cases.push({ name: `${name}-focused-touch`, finalActionEffective: effective, realSwipeCount: swipeCount, realRoute: 'swift-trial' });
      await page.locator('[data-tab="quests"]').click(); await page.locator('.journey-quests').waitFor();
    } else if (!viewport.touch) {
      await list.evaluate(node => { node.scrollTop = node.scrollHeight; });
      await page.locator('.journey-quest').last().scrollIntoViewIfNeeded();
    }
    const finalQuest = await page.locator('.journey-quest').last().evaluate(node => { const r = node.getBoundingClientRect(); return r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; });
    assert(finalQuest, `${name} could not reach final quest by scrolling`);
    if (viewport.width !== 667 || viewport.height !== 320) await page.screenshot({ path: path.join(OUT, `journey-qa-quests-${viewport.width}x${viewport.height}.png`), fullPage: viewport.height >= 700 });
    const failures = await brokenImages(page), observed = finish();
    assert(!failures.length && !observed.errors.length, `${name} resource/browser errors: ${[...failures, ...observed.errors].join('; ')}`);
    report.cases.push({ name, primary, finalDungeonReachable: lastReachable, finalQuestReachable: finalQuest });
    await context.close();
  }

  const context = await contextFor({ width: 1280, height: 720, state });
  const page = await context.newPage(), finish = observe(page, 'hero-preview-nav-smoke');
  await openCampaign(page, 'quests');
  await page.locator('[data-tab="hero"]').click();
  await page.locator('.skill-armory .skill-preview-canvas').waitFor();
  await page.locator('[data-tab="quests"]').click();
  await page.locator('.journey-quests').waitFor();
  const observed = finish(); assert(!observed.errors.length, `Hero preview navigation smoke errors: ${observed.errors.join('; ')}`);
  report.cases.push({ name: 'hero-preview-navigation-smoke' });
  await context.close();
}

try {
  await questBehavior();
  await expeditionRulesAndDepart();
  await layoutsTouchAndSmoke();
} catch (error) {
  report.errors.push({ case: 'harness', message: error.stack || String(error) });
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(OUT, 'journey-qa-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}

console.log(JSON.stringify({ cases: report.cases.map(item => item.name), errors: report.errors }, null, 2));
