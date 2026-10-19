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
const HEROES = ['commander', 'summoner', 'blink', 'mage'];
const EXPECTED_SKILLS = [
  'dash', 'cleave', 'guard', 'swordField', 'bladeWave', 'whirlwind', 'quickCut',
  'summonGuard', 'recallSummons', 'summonElite', 'markBlade', 'blinkStrike',
  'blinkStorm', 'flameBreath', 'rockWall', 'frostAura',
];

await mkdir(OUT, { recursive: true });
const report = { url: URL, startedAt: new Date().toISOString(), cases: [], errors: [] };
const browser = await chromium.launch({ executablePath: EDGE, headless: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function qaProfile() {
  return {
    version: PROFILE_SCHEMA_VERSION, gold: 9999, materials: 9999,
    roster: { 'stone-guard': { level: 1, copies: 0 }, 'wind-scout': { level: 1, copies: 0 } },
    squad: ['stone-guard', 'wind-scout'], buildings: { hall: 0, barracks: 0, workshop: 0 },
    cleared: ['moss-gate', 'blade-trial', 'swift-trial'], settledRuns: [], lastReward: null,
    selectedHero: 'commander',
    heroes: {
      commander: { level: 5, experience: 0, job: 'blade_master', unlockedJobs: ['fighter', 'blade_master', 'swift_blade'], skillLoadout: ['dash', 'cleave', 'swordField'] },
      summoner: { level: 1, experience: 0, job: 'summoner', unlockedJobs: ['summoner'], skillLoadout: ['summonGuard', 'recallSummons', 'summonElite'] },
      blink: { level: 1, experience: 0, job: 'blink', unlockedJobs: ['blink'], skillLoadout: ['markBlade', 'blinkStrike', 'blinkStorm'] },
      mage: { level: 1, experience: 0, job: 'mage', unlockedJobs: ['mage'], skillLoadout: ['flameBreath', 'rockWall', 'frostAura'] },
    },
    progression: { claimedQuests: [], dungeonWins: { 'moss-gate': 1, 'blade-trial': 1, 'swift-trial': 1 }, kills: 0 },
  };
}

async function contextFor({ width, height, reducedMotion = 'no-preference', touch = false, profile = qaProfile() }) {
  const context = await browser.newContext({
    viewport: { width, height }, reducedMotion, hasTouch: touch, isMobile: touch,
    userAgent: touch ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' : undefined,
  });
  await context.addInitScript(({ key, value }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value));
    window.__ARMORY_QA_PREVIEWS = [];
    window.__ARMORY_QA_EVENTS = [];
  }, { key: STORAGE_KEY, value: profile });
  await context.route('**/skill-preview.js', async route => {
    const response = await route.fetch();
    let source = await response.text();
    source = source.replace(
      '  const report = (phase, extra = {}) => onState?.({',
      "  const report = (phase, extra = {}) => { const payload = {",
    ).replace(
      '    ...extra,\n  });',
      '    ...extra,\n  }; globalThis.__ARMORY_QA_EVENTS?.push(payload); onState?.(payload); };',
    ).replace(
      '  return {\n    select,',
      '  const controller = {\n    select,',
    ).replace(
      '  };\n}\n\nexport const SKILL_PREVIEW_IDS',
      '  };\n  globalThis.__ARMORY_QA_PREVIEWS?.push(controller);\n  return controller;\n}\n\nexport const SKILL_PREVIEW_IDS',
    );
    await route.fulfill({ response, body: source });
  });
  return context;
}

function observe(page, caseName) {
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('requestfailed', request => {
    if (request.resourceType() === 'image') errors.push(`image request: ${request.url()} (${request.failure()?.errorText || 'failed'})`);
  });
  return () => {
    report.errors.push(...errors.map(message => ({ case: caseName, message })));
    return errors;
  };
}

async function openArmory(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.campaign-shell:not(.is-hidden)').waitFor({ timeout: 35000 });
  await page.locator('[data-tab="hero"]').click();
  await page.locator('.skill-armory').waitFor();
}

async function storage(page) {
  return page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
}

async function imageFailures(page) {
  return page.locator('img').evaluateAll(images => images.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.getAttribute('src')));
}

async function rects(page, selector) {
  return page.locator(selector).evaluateAll(nodes => nodes.filter(node => {
    const style = getComputedStyle(node), r = node.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && r.width && r.height;
  }).map(node => {
    const r = node.getBoundingClientRect();
    return { label: node.getAttribute('aria-label') || node.textContent.trim().replace(/\s+/g, ' ').slice(0, 45), x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom,
      inViewport: r.x >= -1 && r.y >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 };
  }));
}

async function allSkillsAndPersistence() {
  const context = await contextFor({ width: 1280, height: 720 });
  const page = await context.newPage(), finishErrors = observe(page, 'all-skills-persistence');
  await openArmory(page);
  const seen = new Set(), casts = [];
  for (const hero of HEROES) {
    await page.locator(`[data-hero="${hero}"]`).click();
    await page.locator(`[data-hero="${hero}"][aria-pressed="true"]`).waitFor();
    const ids = await page.locator('[data-preview-skill]').evaluateAll(nodes => nodes.map(node => node.dataset.previewSkill));
    for (const id of ids) {
      const before = await storage(page);
      await page.locator(`[data-preview-skill="${id}"]`).click();
      await page.locator(`[data-preview-skill="${id}"][aria-pressed="true"]`).waitFor();
      assert(await storage(page) === before, `Preview selection mutated localStorage for ${id}`);
      const controllerIndex = await page.evaluate(() => window.__ARMORY_QA_PREVIEWS.length - 1);
      await page.waitForFunction(({ id, controllerIndex }) => {
        const controller = window.__ARMORY_QA_PREVIEWS[controllerIndex];
        return controller?.getState().skillId === id && window.__ARMORY_QA_EVENTS.some(event => event.skillId === id && event.event === 'cast');
      }, { id, controllerIndex }, { timeout: 5000 });
      const state = await page.evaluate(index => {
        const s = window.__ARMORY_QA_PREVIEWS[index].getState();
        return { phase: s.phase, skillId: s.skillId, elapsed: s.elapsed, castCooldown: s.game?.skills?.[s.skillId]?.remaining || 0 };
      }, controllerIndex);
      assert(state.castCooldown > 0, `Preview cast did not start cooldown for ${id}`);
      assert(await page.locator('.skill-preview-canvas').isVisible(), `Preview canvas missing for ${id}`);
      seen.add(id); casts.push(state);
    }
  }
  assert(EXPECTED_SKILLS.every(id => seen.has(id)) && seen.size === EXPECTED_SKILLS.length, `Expected all 16 skills; saw ${[...seen].join(', ')}`);

  await page.locator('[data-hero="mage"]').click();
  await page.locator('[data-slot="0"]').click();
  await page.locator('[data-preview-skill="rockWall"]').click();
  await page.locator('[data-equip="rockWall"]').click();
  let saved = JSON.parse(await storage(page));
  assert(saved.heroes.mage.skillLoadout.join(',') === 'rockWall,flameBreath,frostAura', `Slot swap wrong: ${saved.heroes.mage.skillLoadout}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.campaign-shell:not(.is-hidden)').waitFor({ timeout: 35000 });
  await page.locator('[data-tab="hero"]').click();
  saved = JSON.parse(await storage(page));
  const labels = await page.locator('[data-slot]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
  assert(saved.heroes.mage.skillLoadout[0] === 'rockWall' && labels[0]?.includes('岩障'), 'Reload did not preserve swapped slot');

  const lockedProfile = qaProfile();
  lockedProfile.selectedHero = 'commander'; lockedProfile.heroes.commander.level = 1;
  lockedProfile.heroes.commander.job = 'fighter'; lockedProfile.heroes.commander.unlockedJobs = ['fighter'];
  lockedProfile.heroes.commander.skillLoadout = ['dash', 'cleave', 'guard'];
  const lockedContext = await contextFor({ width: 1280, height: 720, profile: lockedProfile });
  const lockedPage = await lockedContext.newPage(), finishLocked = observe(lockedPage, 'locked-equip');
  await openArmory(lockedPage);
  const lockedBefore = await storage(lockedPage);
  await lockedPage.locator('[data-preview-skill="swordField"]').click();
  const equip = lockedPage.locator('[data-equip="swordField"]');
  assert(await equip.isDisabled(), 'Locked commander skill equip button is enabled');
  await equip.dispatchEvent('click');
  assert(await storage(lockedPage) === lockedBefore, 'Locked skill mutated localStorage');
  const lockedErrors = finishLocked();
  assert(!lockedErrors.length, `Browser errors in locked case: ${lockedErrors.join('; ')}`);
  await lockedContext.close();

  const failures = await imageFailures(page), errors = finishErrors();
  assert(!failures.length, `Broken images: ${failures.join(', ')}`);
  assert(!errors.length, `Browser errors: ${errors.join('; ')}`);
  report.cases.push({ name: 'all-16-preview-and-persistence', skillCount: seen.size, casts, swappedLoadout: saved.heroes.mage.skillLoadout, images: 'ok' });
  await context.close();
}

async function focusAndTeardown() {
  const context = await contextFor({ width: 1130, height: 1180 });
  const page = await context.newPage(), finishErrors = observe(page, 'focus-teardown');
  await openArmory(page);
  const target = page.locator('[data-preview-skill="bladeWave"]');
  await target.focus(); await page.keyboard.press('Enter');
  assert(await page.evaluate(() => document.activeElement?.dataset.previewSkill) === 'bladeWave', 'Keyboard focus did not survive skill rerender');
  const oldIndex = await page.evaluate(() => window.__ARMORY_QA_PREVIEWS.length - 1);
  await page.locator('[data-hero-panel="jobs"]').focus(); await page.keyboard.press('Enter');
  assert(await page.evaluate(() => document.activeElement?.dataset.heroPanel) === 'jobs', 'Keyboard focus did not survive panel rerender');
  const before = await page.evaluate(index => ({ state: window.__ARMORY_QA_PREVIEWS[index].getState(), events: window.__ARMORY_QA_EVENTS.length }), oldIndex);
  assert(before.state.phase === 'disposed' && before.state.game === null, 'Preview controller was not disposed on tab switch');
  await page.waitForTimeout(850);
  const after = await page.evaluate(index => ({ state: window.__ARMORY_QA_PREVIEWS[index].getState(), events: window.__ARMORY_QA_EVENTS.length }), oldIndex);
  assert(after.state.phase === 'disposed' && after.state.elapsed === before.state.elapsed && after.events === before.events, 'Disposed preview continued updating');
  await page.screenshot({ path: path.join(OUT, 'armory-qa-jobs-1130x1180.png') });
  const errors = finishErrors(); assert(!errors.length, `Browser errors: ${errors.join('; ')}`);
  report.cases.push({ name: 'keyboard-focus-and-preview-teardown', disposedElapsed: after.state.elapsed, eventCount: after.events });
  await context.close();
}

async function reducedMotion() {
  const context = await contextFor({ width: 667, height: 320, reducedMotion: 'reduce', touch: true });
  const page = await context.newPage(), finishErrors = observe(page, 'reduced-motion');
  await openArmory(page);
  const index = await page.evaluate(() => window.__ARMORY_QA_PREVIEWS.length - 1);
  const initial = await page.evaluate(i => window.__ARMORY_QA_PREVIEWS[i].getState(), index);
  await page.waitForTimeout(900);
  const still = await page.evaluate(i => window.__ARMORY_QA_PREVIEWS[i].getState(), index);
  assert(initial.phase === 'ready' && still.phase === 'ready' && still.elapsed === initial.elapsed, `Reduced preview advanced automatically: ${JSON.stringify(still)}`);
  await page.locator('[data-action="replay"]').click();
  await page.waitForFunction(i => window.__ARMORY_QA_PREVIEWS[i].getState().elapsed > .65, index, { timeout: 4000 });
  const replayed = await page.evaluate(i => ({ phase: window.__ARMORY_QA_PREVIEWS[i].getState().phase, elapsed: window.__ARMORY_QA_PREVIEWS[i].getState().elapsed, cast: window.__ARMORY_QA_EVENTS.some(event => event.event === 'cast') }), index);
  assert(replayed.phase === 'playing' && replayed.cast, `Reduced replay did not run after real click: ${JSON.stringify(replayed)}`);
  const errors = finishErrors(); assert(!errors.length, `Browser errors: ${errors.join('; ')}`);
  report.cases.push({ name: 'reduced-motion-explicit-replay', initialElapsed: initial.elapsed, replayed });
  await context.close();
}

async function touchTap(context, page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert(box, 'Touch target has no bounding box');
  const cdp = await context.newCDPSession(page), point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function mobileTouchAndLayouts() {
  const context = await contextFor({ width: 844, height: 390, touch: true });
  const page = await context.newPage(), finishErrors = observe(page, 'touch-844');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.campaign-shell:not(.is-hidden)').waitFor({ timeout: 35000 });
  await touchTap(context, page, page.locator('[data-tab="hero"]'));
  await page.locator('.skill-armory').waitFor();
  await touchTap(context, page, page.locator('[data-hero="mage"]'));
  await page.locator('[data-hero="mage"][aria-pressed="true"]').waitFor();
  await touchTap(context, page, page.locator('[data-preview-skill="rockWall"]'));
  await touchTap(context, page, page.locator('[data-slot="0"]'));
  await touchTap(context, page, page.locator('[data-equip="rockWall"]'));
  const saved = JSON.parse(await storage(page));
  assert(saved.selectedHero === 'mage' && saved.heroes.mage.skillLoadout.join(',') === 'rockWall,flameBreath,frostAura', `CDP touch flow failed: ${JSON.stringify(saved.heroes.mage.skillLoadout)}`);
  await touchTap(context, page, page.locator('[data-preview-skill="frostAura"]'));
  await page.waitForFunction(() => window.__ARMORY_QA_EVENTS.some(event => event.skillId === 'frostAura' && event.event === 'cast'), null, { timeout: 4000 });
  await page.waitForTimeout(240);
  await page.screenshot({ path: path.join(OUT, 'armory-qa-mage-frost-844x390.png') });
  const critical = await rects(page, '.hero-roster button, .hero-tabs button, .skill-slots button, .preview-controls button, .skill-equip-line button, .campaign-nav button');
  const visibleCritical = critical.filter(item => item.inViewport);
  assert(visibleCritical.every(item => item.width >= 44 && item.height >= 44), `Critical touch target below 44px: ${JSON.stringify(visibleCritical.filter(item => item.width < 44 || item.height < 44))}`);
  const errors = finishErrors(); assert(!errors.length, `Browser errors: ${errors.join('; ')}`);
  report.cases.push({ name: 'cdp-touch-844x390', loadout: saved.heroes.mage.skillLoadout, visibleCritical });
  await context.close();

  for (const viewport of [{ width: 667, height: 320 }, { width: 1130, height: 1180 }]) {
    const name = `layout-${viewport.width}x${viewport.height}`;
    const c = await contextFor({ ...viewport, touch: viewport.height < 500 });
    const p = await c.newPage(), done = observe(p, name);
    await openArmory(p);
    const controls = await rects(p, '.campaign-topbar button, .hero-roster button, .hero-tabs button, .skill-slots button, .preview-controls button, .campaign-nav button');
    assert(controls.every(item => item.inViewport), `${name} has clipped visible controls: ${JSON.stringify(controls.filter(item => !item.inViewport))}`);
    const criticalVisible = controls.filter(item => item.inViewport);
    assert(criticalVisible.every(item => item.width >= 44 && item.height >= 44), `${name} has touch target below 44px: ${JSON.stringify(criticalVisible.filter(item => item.width < 44 || item.height < 44))}`);
    const library = p.locator('.skill-library');
    const scroll = await library.evaluate(node => ({ clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, before: node.scrollTop }));
    await library.evaluate(node => { node.scrollTop = node.scrollHeight; });
    const last = p.locator('[data-preview-skill]').last();
    const reachable = await last.evaluate(node => { const r = node.getBoundingClientRect(), p = node.parentElement.getBoundingClientRect(); return r.bottom <= p.bottom + 1 && r.top >= p.top - 1; });
    assert(reachable, `${name} could not reach final library skill by scrolling`);
    const failures = await imageFailures(p), errors2 = done();
    assert(!failures.length && !errors2.length, `${name} resource/browser failures: ${[...failures, ...errors2].join('; ')}`);
    report.cases.push({ name, controls, library: { ...scroll, reachable } });
    await c.close();
  }
}

try {
  await allSkillsAndPersistence();
  await focusAndTeardown();
  await reducedMotion();
  await mobileTouchAndLayouts();
} catch (error) {
  report.errors.push({ case: 'harness', message: error.stack || String(error) });
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(OUT, 'armory-qa-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}

console.log(JSON.stringify({ cases: report.cases.map(item => item.name), errors: report.errors }, null, 2));
