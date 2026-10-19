import {STORAGE_KEY as KEY,LEGACY_STORAGE_KEY,PROFILE_SCHEMA_VERSION} from '../dist/campaign.js';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'output');
const URL = 'http://127.0.0.1:4178/';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const GROWTH_BACKUP = `${KEY}.imported-v1`;
const ONLY_667 = process.argv.includes('--only-667');
const ONLY_808 = process.argv.includes('--only-808');
const HEROES = {
  commander: { base: 'fighter', baseKind: 'base_commander', advanced: ['blade_master', 'swift_blade'], kinds: ['general_commander', 'general_swift'], trials: ['blade-trial', 'swift-trial'], quests: ['job-blade', 'job-swift'] },
  summoner: { base: 'summoner', baseKind: 'base_summoner', advanced: ['summoner_master'], kinds: ['general_summoner'], trials: ['summoner-trial'], quests: ['job-summoner'] },
  blink: { base: 'blink', baseKind: 'base_blink', advanced: ['blink_master'], kinds: ['general_blink'], trials: ['blink-trial'], quests: ['job-blink'] },
  mage: { base: 'mage', baseKind: 'base_mage', advanced: ['mage_master'], kinds: ['general_mage'], trials: ['mage-trial'], quests: ['job-mage'] },
};

await mkdir(OUT, { recursive: true });
const report = { url: URL, startedAt: new Date().toISOString(), scope: 'isolated Edge contexts; fixture saves only', cases: [], errors: [] };
const browser = await chromium.launch({ executablePath: EDGE, headless: true });

function assert(value, message) { if (!value) throw new Error(message); }
function profile({ selectedHero = 'commander', jobs = {}, unlocked = {}, wins = {}, claimed = [], cleared = ['moss-gate'], level = 5 } = {}) {
  const hero = (id, base, skills) => ({ level, experience: 17, job: jobs[id] || base, unlockedJobs: unlocked[id] || [base], skillLoadout: [...skills] });
  return {
    version: PROFILE_SCHEMA_VERSION, gold: 2345, materials: 678,
    roster: { 'stone-guard': { level: 1, copies: 0 }, 'wind-scout': { level: 1, copies: 0 } }, squad: ['stone-guard', 'wind-scout'],
    buildings: { hall: 0, barracks: 0, workshop: 0 }, cleared: [...cleared], settledRuns: [], lastReward: null, selectedHero,
    heroes: {
      commander: hero('commander', 'fighter', ['dash', 'cleave', 'guard']),
      summoner: hero('summoner', 'summoner', ['summonGuard', 'recallSummons', 'summonElite']),
      blink: hero('blink', 'blink', ['markBlade', 'blinkStrike', 'blinkStorm']),
      mage: hero('mage', 'mage', ['flameBreath', 'rockWall', 'frostAura']),
    }, progression: { claimedQuests: [...claimed], dungeonWins: { 'moss-gate': 1, ...wins }, kills: 12 },
  };
}
function oldProfile() {
  return { version: 1, gold: 731, materials: 87, roster: { 'stone-guard': { level: 2, copies: 1 } }, squad: ['stone-guard'], buildings: { hall: 1, barracks: 0, workshop: 0 }, cleared: ['moss-gate'], settledRuns: [], lastReward: null, heroes: { commander: { level: 4, job: 'fighter' } } };
}
async function contextFor({ width = 1280, height = 720, touch = false, reducedMotion = 'no-preference', state = profile(), seedKey = KEY } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion,
    userAgent: touch ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' : undefined });
  await context.addInitScript(({ key, value }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); window.__PROF_QA_UNITS = []; window.__PROF_QA_SKILLS = []; }, { key: seedKey, value: state });
  await context.route('**/main.js', async route => { try { const response = await route.fetch(); const source = await response.text(); await route.fulfill({ response, body: `${source}\nObject.defineProperty(window,'__PROF_QA_GAME',{configurable:true,get:()=>game});\n` }); } catch { await route.continue().catch(() => {}); } });
  await context.route('**/unit-preview.js', async route => {
    let response, source; try { response = await route.fetch(); source = await response.text(); } catch { await route.continue().catch(() => {}); return; }
    source = source.replace(' return {attack(){if(disposed||!asset.animations.attack)return;action=\'attack\';time=0;draw();start();},dispose(){disposed=true;cancelAnimationFrame(frameId);observer.disconnect();motion.removeEventListener(\'change\',motionChanged);}};',
      " const controller={attack(){if(disposed||!asset.animations.attack)return;action='attack';time=0;draw();start();},dispose(){disposed=true;cancelAnimationFrame(frameId);observer.disconnect();motion.removeEventListener('change',motionChanged);},get state(){return Object.freeze({kind,action,time,disposed});}};globalThis.__PROF_QA_UNITS?.push(controller);return controller;");
    await route.fulfill({ response, body: source });
  });
  await context.route('**/skill-preview.js', async route => {
    let response, source; try { response = await route.fetch(); source = await response.text(); } catch { await route.continue().catch(() => {}); return; }
    source = source.replace('  return {\n    select,', '  const controller = {\n    select,')
      .replace('  };\n}\n\nexport const SKILL_PREVIEW_IDS', '  };\n  globalThis.__PROF_QA_SKILLS?.push(controller);\n  return controller;\n}\n\nexport const SKILL_PREVIEW_IDS');
    await route.fulfill({ response, body: source });
  });
  return context;
}
function observe(page, name) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('requestfailed', r => errors.push(`requestfailed: ${r.url()} (${r.failure()?.errorText || 'failed'})`));
  return () => { report.errors.push(...errors.map(message => ({ case: name, message }))); return errors; };
}
async function openJobs(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.campaign-shell:not(.is-hidden)').waitFor({ timeout: 35000 });
  await page.locator('[data-tab="hero"]').click();
  await page.locator('[data-hero-panel="jobs"]').click();
  await page.locator('.profession-view').waitFor();
}
async function raw(page) { return page.evaluate(key => localStorage.getItem(key), KEY); }
async function saved(page) { return JSON.parse(await raw(page)); }
async function selectHero(page, id) { await page.locator(`[data-hero="${id}"]`).click(); await page.locator(`[data-hero="${id}"][aria-pressed="true"]`).waitFor(); }
async function tap(context, page, locator) {
  await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert(box, 'tap target has no box');
  const cdp = await context.newCDPSession(page), p = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function swipe(context, page, locator, from = .82, to = .18) {
  const box = await locator.boundingBox(); assert(box, 'swipe target has no box'); const cdp = await context.newCDPSession(page), x = box.x + box.width / 2, y0 = box.y + box.height * from;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + box.height * (to - from) * i / 8, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(150);
}
async function effective(locator) {
  return locator.evaluate(node => { let r = node.getBoundingClientRect(), l = Math.max(0, r.left), t = Math.max(0, r.top), rr = Math.min(innerWidth, r.right), b = Math.min(innerHeight, r.bottom);
    for (let p = node.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(`${s.overflow} ${s.overflowX} ${s.overflowY}`)) { r = p.getBoundingClientRect(); l = Math.max(l, r.left); t = Math.max(t, r.top); rr = Math.min(rr, r.right); b = Math.min(b, r.bottom); } }
    return { width: Math.max(0, rr - l), height: Math.max(0, b - t), left: l, top: t, right: rr, bottom: b };
  });
}
async function oldSaveMigration() {
  const state = oldProfile(), c = await contextFor({ state, seedKey:LEGACY_STORAGE_KEY }), p = await c.newPage(), done = observe(p, 'old-save'); await openJobs(p);
  const migrated = await saved(p), backup = await p.evaluate(k => localStorage.getItem(k), GROWTH_BACKUP);
  assert(migrated.gold === state.gold && migrated.materials === state.materials && migrated.heroes.commander.level === 4 && migrated.heroes.commander.job === 'fighter', 'old save values were not preserved');
  assert(backup === JSON.stringify(state), 'v1 import backup does not exactly preserve old save'); assert(await p.evaluate(key=>localStorage.getItem(key),LEGACY_STORAGE_KEY)===JSON.stringify(state),'legacy source was modified'); assert(!done().length, 'browser errors during migration');
  report.cases.push({ name: 'old-save-preserved-and-backed-up', preserved: { gold: migrated.gold, materials: migrated.materials, level: 4, job: 'fighter' }, backupKey: GROWTH_BACKUP }); await c.close();
}
async function previewsAndAttack() {
  const c = await contextFor(), p = await c.newPage(), done = observe(p, 'all-job-previews'); await openJobs(p); const seen = [];
  for (const [hero, meta] of Object.entries(HEROES)) {
    await selectHero(p, hero); const expected = [meta.base, ...meta.advanced], beforeHero = await raw(p);
    const ids = await p.locator('[data-preview-job]').evaluateAll(ns => ns.map(n => n.dataset.previewJob)); assert(JSON.stringify(ids) === JSON.stringify(expected), `${hero} path wrong: ${ids}`);
    for (let i = 0; i < expected.length; i++) {
      const id = expected[i]; await p.locator(`[data-preview-job="${id}"]`).click(); await p.locator(`[data-preview-job="${id}"][aria-pressed="true"]`).waitFor();
      const kind = await p.locator('canvas.profession-preview-portrait').getAttribute('data-unit-kind'); assert(kind === (i ? meta.kinds[i - 1] : meta.baseKind), `${id} preview kind ${kind}`);
      assert(await raw(p) === beforeHero, `${id} preview wrote localStorage`); const index = await p.evaluate(() => window.__PROF_QA_UNITS.length - 1);
      await p.locator('[data-action="profession-attack"]').click(); await p.waitForFunction(i => window.__PROF_QA_UNITS[i]?.state.action === 'attack', index);
      const animation = await p.locator('canvas.profession-preview-portrait').getAttribute('data-animation'); assert(animation === 'attack', `${id} canvas did not visibly enter attack animation`);
      seen.push({ hero, id, kind, attack: animation });
    }
  }
  assert(seen.length === 9, `expected 9 job previews, saw ${seen.length}`); assert(!done().length, 'preview browser errors'); report.cases.push({ name: 'four-base-five-advanced-preview-no-write-and-real-attack', previews: seen }); await c.close();
}
async function stateTransitionsAndSkills() {
  const state = profile({ selectedHero: 'commander', wins: { 'blade-trial': 1 }, unlocked: { commander: ['fighter', 'swift_blade'] }, jobs: { commander: 'swift_blade' } });
  const c = await contextFor({ state }), p = await c.newPage(), done = observe(p, 'states-switch-persist'); await openJobs(p);
  await p.locator('[data-preview-job="swift_blade"]').click(); assert(await p.locator('.profession-cta.is-current').isDisabled(), 'current state missing');
  await p.locator('[data-preview-job="blade_master"]').click(); assert(await p.locator('[data-claim="job-blade"]').isVisible(), 'ready-to-claim state missing');
  await p.locator('[data-claim="job-blade"]').click(); let s = await saved(p); assert(s.heroes.commander.unlockedJobs.includes('blade_master'), 'claim did not unlock blade master');
  await p.locator('[data-job="blade_master"]').click(); s = await saved(p); assert(s.heroes.commander.job === 'blade_master' && s.heroes.commander.skillLoadout.length === 3, 'advanced switch or 3-slot loadout failed');
  const afterAdvanced = [...s.heroes.commander.skillLoadout]; await p.reload({ waitUntil: 'domcontentloaded' }); await p.locator('.campaign-shell:not(.is-hidden)').waitFor({ timeout: 35000 });
  s = await saved(p); assert(s.heroes.commander.job === 'blade_master' && s.heroes.commander.skillLoadout.join() === afterAdvanced.join(), 'advanced job/loadout lost on refresh');
  await p.locator('[data-tab="hero"]').click(); await p.locator('[data-hero-panel="jobs"]').click(); await p.locator('[data-preview-job="fighter"]').click(); await p.locator('[data-job="fighter"]').click();
  s = await saved(p); assert(s.heroes.commander.job === 'fighter' && s.gold === 2445 && s.materials === 693 && s.heroes.commander.skillLoadout.length === 3, 'free base switch or loadout preservation failed');
  const baseLoadout = [...s.heroes.commander.skillLoadout]; await p.reload({ waitUntil: 'domcontentloaded' }); s = await saved(p); assert(s.heroes.commander.job === 'fighter' && s.heroes.commander.skillLoadout.join() === baseLoadout.join(), 'base switch/loadout lost on refresh');
  assert(!done().length, 'state browser errors'); report.cases.push({ name: 'current-ready-claim-unlock-switch-refresh-free-return', advancedLoadout: afterAdvanced, baseLoadout, claimRewards: { gold: 100, materials: 15 } }); await c.close();
}
async function filteringAndLockedSkillArt() {
  const c = await contextFor({ state: profile({ selectedHero: 'mage' }) }), p = await c.newPage(), done = observe(p, 'filtering-locked-art'); await openJobs(p);
  await p.locator('[data-preview-job="mage_master"]').click(); const lockedKind = await p.locator('canvas.profession-preview-portrait').getAttribute('data-unit-kind'); assert(lockedKind === 'general_mage', `locked advanced art is ${lockedKind}`);
  await p.locator('[data-hero-panel="skills"]').click(); const skillKinds = await p.locator('[data-preview-skill]').evaluateAll(ns => ns.map(n => n.dataset.previewSkill)); assert(skillKinds.join() === 'flameBreath,rockWall,frostAura', `mage skills leaked across professions: ${skillKinds}`);
  await p.locator('[data-tab="quests"]').click(); const questClaims = await p.locator('.journey-quest').evaluateAll(ns => ns.map(n => n.textContent)); assert(questClaims.some(t => t.includes('元素传承')) && !questClaims.some(t => /剑阵传承|迅刃传承|契灵传承|瞬印传承/.test(t)), 'quest page leaked another hero trial');
  await p.locator('[data-tab="map"]').click(); const dungeons = await p.locator('[data-dungeon]').evaluateAll(ns => ns.map(n => n.dataset.dungeon)); assert(dungeons.includes('mage-trial') && !dungeons.some(id => ['blade-trial','swift-trial','summoner-trial','blink-trial'].includes(id)), `expedition leaked trials: ${dungeons}`);
  assert(!done().length, 'filtering browser errors'); report.cases.push({ name: 'locked-art-skills-quests-expedition-filtered-to-hero', lockedKind, skills: skillKinds, dungeons }); await c.close();
}
async function enterBattle(state, dungeon, expectedKind, label) {
  const c = await contextFor({ state }), p = await c.newPage(), done = observe(p, label); await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.locator('.campaign-shell:not(.is-hidden)').waitFor({ timeout: 35000 });
  await p.locator('[data-tab="map"]').click(); await p.locator(`[data-dungeon="${dungeon}"]`).click(); await p.locator('[data-action="depart"]').click(); await p.waitForFunction(() => window.__PROF_QA_GAME?.phase === 'playing', null, { timeout: 10000 });
  const before = await p.evaluate(() => { const g = window.__PROF_QA_GAME; return { kind: g.player.kind, dungeon: g.dungeon.id, cooldown: g.skills[g.skillLoadout[0]]?.remaining || 0 }; });
  assert(before.kind === expectedKind && before.dungeon === dungeon, `${label} entered ${before.kind}/${before.dungeon}`); const button = p.locator('.skill-button').first(); await button.click();
  await p.waitForFunction(() => { const g = window.__PROF_QA_GAME; return (g.skills[g.skillLoadout[0]]?.remaining || 0) > 0; }, null, { timeout: 3000 });
  const after = await p.evaluate(() => { const g = window.__PROF_QA_GAME; return { kind: g.player.kind, cooldown: g.skills[g.skillLoadout[0]]?.remaining || 0, phase: g.phase }; }); assert(after.cooldown > 0, `${label} real skill click did not act`);
  assert(!done().length, `${label} browser errors`); await c.close(); return { before, after };
}
async function realBattleInputs() {
  const base = await enterBattle(profile({ selectedHero: 'mage' }), 'moss-gate', 'base_mage', 'base-battle');
  const advanced = await enterBattle(profile({ selectedHero: 'mage', jobs: { mage: 'mage_master' }, unlocked: { mage: ['mage', 'mage_master'] }, claimed: ['job-mage'], wins: { 'mage-trial': 1 } }), 'mage-trial', 'general_mage', 'advanced-battle');
  report.cases.push({ name: 'real-click-base-and-advanced-battle-actions', base, advanced });
}
async function previewKindsAndLifecycle() {
  const state = profile({ selectedHero: 'mage', unlocked: { mage: ['mage', 'mage_master'] } });
  const c = await contextFor({ state }), p = await c.newPage(), done = observe(p, 'preview-kinds-lifecycle');
  await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.locator('.campaign-shell:not(.is-hidden)').waitFor({ timeout: 35000 }); await p.locator('[data-tab="hero"]').click(); await p.locator('.skill-armory').waitFor();
  let index = await p.evaluate(() => window.__PROF_QA_SKILLS.length - 1); let kind = await p.evaluate(i => window.__PROF_QA_SKILLS[i].getState().game.player.kind, index); assert(kind === 'base_mage', `base mage skill preview used ${kind}`);
  await p.locator('[data-hero-panel="jobs"]').click(); await p.locator('[data-preview-job="mage_master"]').click(); await p.locator('[data-job="mage_master"]').click();
  const changed = await saved(p); assert(changed.heroes.mage.job === 'mage_master', 'real mage master switch failed'); await p.locator('[data-hero-panel="skills"]').click();
  index = await p.evaluate(() => window.__PROF_QA_SKILLS.length - 1); kind = await p.evaluate(i => window.__PROF_QA_SKILLS[i].getState().game.player.kind, index); assert(kind === 'general_mage', `advanced mage skill preview used ${kind}`);
  await selectHero(p, 'commander');
  const lockedKinds = {};
  for (const [skill, expected] of [['swordField', 'general_commander'], ['quickCut', 'general_swift']]) {
    const before = await raw(p); await p.locator(`[data-preview-skill="${skill}"]`).click(); index = await p.evaluate(() => window.__PROF_QA_SKILLS.length - 1);
    const value = await p.evaluate(i => { const s = window.__PROF_QA_SKILLS[i].getState(); return { kind: s.game.player.kind, skillId: s.skillId }; }, index);
    assert(value.kind === expected && value.skillId === skill, `${skill} preview used ${JSON.stringify(value)}`); assert(await raw(p) === before, `${skill} locked preview wrote save`); lockedKinds[skill] = value.kind;
  }
  await p.locator('[data-hero-panel="jobs"]').click(); const unitIndex = await p.evaluate(() => window.__PROF_QA_UNITS.length - 1); const unitBefore = await p.evaluate(i => window.__PROF_QA_UNITS[i].state, unitIndex);
  await p.locator('[data-hero-panel="skills"]').click(); const disposed = await p.evaluate(i => window.__PROF_QA_UNITS[i].state, unitIndex); await p.waitForTimeout(450); const stopped = await p.evaluate(i => window.__PROF_QA_UNITS[i].state, unitIndex);
  assert(disposed.disposed && stopped.disposed && stopped.time === disposed.time, `unit preview did not stop after leaving jobs: ${JSON.stringify({ unitBefore, disposed, stopped })}`);
  assert(!done().length, 'preview kind/lifecycle browser errors'); report.cases.push({ name: 'skill-preview-job-kinds-and-unit-dispose', baseMage: 'base_mage', advancedMage: kind, lockedKinds, disposedAt: disposed.time, stoppedAt: stopped.time }); await c.close();

  const rc = await contextFor({ width: 667, height: 320, touch: true, reducedMotion: 'reduce', state: profile() }), rp = await rc.newPage(), rdone = observe(rp, 'reduced-unit-once'); await openJobs(rp);
  const ri = await rp.evaluate(() => window.__PROF_QA_UNITS.length - 1), idle0 = await rp.evaluate(i => window.__PROF_QA_UNITS[i].state, ri); await rp.waitForTimeout(500); const idle1 = await rp.evaluate(i => window.__PROF_QA_UNITS[i].state, ri);
  assert(idle0.action === 'idle' && idle1.action === 'idle' && idle1.time === idle0.time, `reduced idle preview moved: ${JSON.stringify({ idle0, idle1 })}`);
  await tap(rc, rp, rp.locator('[data-action="profession-attack"]')); await rp.waitForFunction(i => window.__PROF_QA_UNITS[i].state.action === 'attack', ri); await rp.waitForFunction(i => window.__PROF_QA_UNITS[i].state.action === 'idle', ri, { timeout: 4000 });
  const ended = await rp.evaluate(i => window.__PROF_QA_UNITS[i].state, ri); await rp.waitForTimeout(450); const held = await rp.evaluate(i => window.__PROF_QA_UNITS[i].state, ri); assert(held.action === 'idle' && held.time === ended.time, `reduced attack did not stop after one play: ${JSON.stringify({ ended, held })}`);
  assert(!rdone().length, 'reduced unit browser errors'); report.cases.push({ name: 'reduced-motion-unit-idle-manual-once-stop', idleTime: idle1.time, stoppedTime: held.time }); await rc.close();
}
async function layoutsFocusMotion() {
  const viewports = ONLY_808 ? [{ width: 808, height: 847 }] : ONLY_667 ? [{ width: 667, height: 320, touch: true, reducedMotion: 'reduce' }] : [{ width: 1280, height: 720 }, { width: 1130, height: 1180 }, { width: 844, height: 390, touch: true }, { width: 667, height: 320, touch: true, reducedMotion: 'reduce' }];
  for (const v of viewports) {
    const name = `${v.width}x${v.height}`, c = await contextFor({ ...v, state: profile({ selectedHero: 'commander' }) }), p = await c.newPage(), done = observe(p, `layout-${name}`); await openJobs(p);
    const target = p.locator('[data-preview-job="blade_master"]'); if (v.touch) await tap(c, p, target); else { await target.focus(); await p.keyboard.press('Enter'); assert(await p.evaluate(() => document.activeElement?.dataset.previewJob) === 'blade_master', `${name} focus not preserved`); }
    const controls = p.locator('.campaign-nav button, .hero-roster button, .hero-tabs button, .profession-node, .profession-cta, [data-action="profession-attack"]:not([disabled]), [data-action="train"]:not([disabled]), [data-action="buildings"]'); const measures = [];
    for (let i = 0; i < await controls.count(); i++) { const loc = controls.nth(i); if (!await loc.isVisible()) continue; let e = await effective(loc); if (v.touch && (e.width < 44 || e.height < 44)) { const area = p.locator('.profession-view'); for (let n = 0; n < 4 && (e.width < 44 || e.height < 44); n++) { await swipe(c, p, area); e = await effective(loc); } } measures.push({ label: (await loc.getAttribute('aria-label')) || (await loc.textContent()).trim().replace(/\s+/g, ' ').slice(0, 35), ...e }); }
    const undersized = measures.filter(x => x.width < 44 || x.height < 44); if (undersized.length) report.errors.push({ case: `layout-${name}`, message: `effective targets under 44px: ${JSON.stringify(undersized)}` });
    const currentCard = await p.locator('.profession-current').evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, horizontalScroll: node.scrollWidth > node.clientWidth + 1 }));
    if (currentCard.horizontalScroll) report.errors.push({ case: `layout-${name}`, message: `current profession card has horizontal scroll: ${JSON.stringify(currentCard)}` });
    if (v.touch) { const attack = p.locator('[data-action="profession-attack"]'); await attack.scrollIntoViewIfNeeded(); await tap(c, p, attack); await p.locator('canvas.profession-preview-portrait[data-animation="attack"]').waitFor(); }
    const motion = await p.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches); assert(motion === (v.reducedMotion === 'reduce'), `${name} reduced motion mismatch`);
    const file = path.join(OUT, `profession-${name}${motion ? '-reduced' : ''}.png`); await p.screenshot({ path: file, fullPage: v.height >= 700 }); const browserErrors = done();
    report.cases.push({ name: `layout-focus-touch-${name}`, screenshot: path.basename(file), reducedMotion: motion, effectiveControls: measures, currentCard, undersized, browserErrors }); await c.close();
  }
}

try {
  if (!ONLY_667 && !ONLY_808) { await oldSaveMigration(); await previewsAndAttack(); await stateTransitionsAndSkills(); await filteringAndLockedSkillArt(); await realBattleInputs(); await previewKindsAndLifecycle(); }
  await layoutsFocusMotion();
} catch (error) { report.errors.push({ case: 'harness', message: error.stack || String(error) }); throw error; }
finally { report.finishedAt = new Date().toISOString(); await writeFile(path.join(OUT, ONLY_808 ? 'profession-808-recheck.json' : ONLY_667 ? 'profession-667-recheck.json' : 'profession-report.json'), JSON.stringify(report, null, 2)); await browser.close(); }

console.log(JSON.stringify({ cases: report.cases.map(x => x.name), errors: report.errors }, null, 2));
