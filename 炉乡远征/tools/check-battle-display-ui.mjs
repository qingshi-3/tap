import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Use the same script against the working copy and a frozen publication tree.
// The factory and validator always come from that tree, never from another schema.
const args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const base = arg('--base', process.env.CAMPAIGN_UI_BASE || 'http://127.0.0.1:4197');
const phase = arg('--phase', process.env.BATTLE_DISPLAY_PHASE || 'after');
assert.match(phase, /^[a-z0-9-]+$/i);
const source = pathToFileURL(resolve(arg('--source', process.env.BATTLE_DISPLAY_SOURCE || fileURLToPath(new URL('../', import.meta.url)))) + '/');
const mod = path => import(new URL('dist/js/' + path, source));
const [{ ExpeditionProgress }, engine, { CARDS }, { SAVE_KEYS }] = await Promise.all([
  mod('expedition-progress.js'), mod('engine.js'), mod('cards.js'), mod('storage-keys.js'),
]);
const { createExpeditionMatch, confirmMulligan, validateMatch, attackUnit, movementPath } = engine;
const out = process.argv.includes('--output') ? pathToFileURL(resolve(arg('--output'))+'/') : new URL(`../output/battle-display/qa/${phase}/`, import.meta.url);
await mkdir(out, { recursive: true });
const { chromium } = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
class Memory {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
function unit(cardId, owner, x, y, unitId, extra = {}) {
  const card = CARDS[cardId]; assert.ok(card);
  return { unitId, cardId, owner, x, y, attack: card.attack, health: card.health, maxHealth: card.health,
    attackBuff: 0, healthBuff: 0, moved: false, attacked: false, summonedThisTurn: false,
    token: Boolean(card.token), reborn: false, silenced: false, bodyguardUsed: false, skirmishUsed: false,
    ...(owner === 0 && !card.token ? { specialization: 'none' } : {}), ...extra };
}
function fixture(kind = 'dense') {
  const p = new ExpeditionProgress(new Memory());
  const match = createExpeditionMatch('border-01', p.state.training, p.state.squad, 1, p.getBattleLoadout());
  assert.ok(p.saveBattle(match).ok, 'freeze reward before mulligan');
  assert.ok(confirmMulligan(match));
  const a = match.units.find(u => u.owner === 0 && CARDS[u.cardId].type === 'general');
  const b = match.units.find(u => u.owner === 1 && CARDS[u.cardId].type === 'general');
  const object = match.units.find(u => u.cardId === 9101);
  assert.ok(object, 'ordinary campaign encounter 9101 exists');
  Object.assign(a, { x: 1, y: 2 }); Object.assign(b, { x: 7, y: 2 });
  Object.assign(object, { x: 4, y: 1 });
  const es = match.encounter.sources.find(s => s.unitId === object.unitId);
  Object.assign(es, { x: object.x, y: object.y });
  const next = Math.max(...match.units.map(u => u.unitId)) + 1;
  const ally = unit(14, 0, 2, 2, next, { attack: 2, health: 12, maxHealth: 12 });
  const enemy = unit(14, 1, 3, 2, next + 1, { attack: 1, health: 10, maxHealth: 10 });
  const frozen = unit(14, 0, 2, 3, next + 2, { stunTurns: 1, moved: true, attacked: true });
  const spent = unit(9, 0, 3, 3, next + 3, { moved: true, attacked: true });
  const guard = unit(11, 0, 2, 1, next + 4);
  const soldier = unit(11, 1, 3, 1, next + 5);
  const secondObject = unit(9101, 1, 4, 3, next + 6);
  // The original mechanism retains its real lifecycle. An extra same-art token
  // stresses adjacent rows without changing the immutable encounter definition.
  match.units = [a, b, object, ally, enemy, frozen, spent, guard, soldier, secondObject];
  if (kind === 'long-round') match.round = 10;
  if (['win', 'loss'].includes(kind)) {
    match.units = [a, b];
    match.encounter.sources.forEach(s => Object.assign(s, { closed: true, remaining: 0 }));
    if (kind === 'win') Object.assign(b, { x: 2, y: 2, health: 1 });
    else { Object.assign(a, { health: 1 }); Object.assign(b, { x: 2, y: 2, health: 12 }); }
  }
  match.lastAction = null; match.selectedUnitId = null;
  assert.ok(validateMatch(match), `${kind} battle validates in ${fileURLToPath(source)}`);
  const saved = p.saveBattle(match); assert.ok(saved.ok, saved.error);
  return { profile: p.state, ids: { ally: ally.unitId, enemy: enemy.unitId, frozen: frozen.unitId,
    spent: spent.unitId, guard: guard.unitId, blocker: soldier.unitId, object: object.unitId, general: a.unitId, enemyGeneral: b.unitId } };
}
const report = { phase, base, source: fileURLToPath(source), checks: [], errors: [], screenshots: [],
  limitations: ['Isolated Edge touch emulation; physical phone and TapTap host are not covered.'] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
async function shot(page, name) {
  const file = `${name}.png`; await page.screenshot({ path: fileURLToPath(new URL(file, out)) });
  report.screenshots.push(file);
}
async function open(f, width, height, motion) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: motion });
  const page = await context.newPage(); page.on('pageerror', e => report.errors.push(String(e)));
  await page.addInitScript(({ profile, key }) => {
    if (!sessionStorage.getItem('battle-display-seed')) {
      localStorage.setItem(key, JSON.stringify(profile)); sessionStorage.setItem('battle-display-seed', '1');
    }
  }, { profile: f.profile, key: SAVE_KEYS.expedition });
  await page.addInitScript(async () => {
    const { BoardRenderer } = await import('/js/renderer.js');
    const draw = BoardRenderer.prototype.draw;
    BoardRenderer.prototype.draw = function (state, options = {}) {
      window.__renderer = this; window.__drawOptions = structuredClone(options);
      return draw.call(this, state, options);
    };
  });
  await page.goto(base); await page.locator('.menu-play').tap();
  await page.locator('#objective-close').waitFor({ state: 'visible' }); await page.locator('#objective-close').tap();
  await ready(page);
  return { context, page };
}
async function ready(page) {
  await page.waitForFunction(() => window.__renderer?.ready && !document.querySelector('#match').hidden
    && !document.querySelector('#end-turn').disabled && !document.querySelector('#match').classList.contains('turn-transition'));
  await page.waitForTimeout(120);
}
const state = page => page.evaluate(() => structuredClone(window.__renderer.state));
async function point(page, id) {
  return page.evaluate(id => {
    const r = window.__renderer, u = r.state.units.find(u => u.unitId === id); if (!u) return null;
    const p = r.getUnitAnchor(u);
    for (const dy of [0, 8, -8, 16, -16, -24, 24]) for (const dx of [0, 8, -8]) {
      const q = { x: p.x + dx, y: p.y + dy }, hit = r.positionFromPointer({ clientX: q.x, clientY: q.y }, { preferUnits: true });
      if (document.elementFromPoint(q.x, q.y) === r.canvas && hit?.x === u.x && hit?.y === u.y) return q;
    }
    return null;
  }, id);
}
async function cell(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const r = window.__renderer, b = r.canvas.getBoundingClientRect();
    const p = r.cellGeometry(r.boardMetrics(b.width, b.height), x, y).center;
    return { x: b.x + p.x, y: b.y + p.y };
  }, { x, y });
}
async function touch(page, from) {
  assert.ok(from, 'target visible and hit-tested on the actual canvas');
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  return {
    async move(to) {
      assert.ok(to, 'destination exposed');
      for (let i = 1; i <= 10; i++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / 10, y: from.y + (to.y - from.y) * i / 10 }] });
    },
    async end() {
      await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await c.detach(); await page.waitForTimeout(650);
    },
  };
}
function combat(m) { return { units: m.units, players: m.players, phase: m.phase, log: m.log, lastAction: m.lastAction }; }
function outcome(m) { return { units: m.units, players: m.players, phase: m.phase, lastAction: m.lastAction }; }
async function tapUnit(page, id) {
  const p = await point(page, id); assert.ok(p, `unit ${id} has an exposed touch point`);
  await page.touchscreen.tap(p.x, p.y);
}
async function closeDetail(page) {
  // Compact cards intentionally omit a close button; empty battle space is the
  // ordinary mobile dismissal route. Never force-click a hidden control.
  const p = await page.evaluate(() => {
    const r = window.__renderer, b = r.canvas.getBoundingClientRect(), m = r.boardMetrics(b.width, b.height);
    for (const y of [2, 1, 3, 0, 4]) for (const x of [5, 6, 0, 1, 4, 7, 8, 2, 3]) {
      if (r.state.units.some(u => u.x === x && u.y === y)) continue;
      const q = r.cellGeometry(m, x, y).center, at = { x: b.x + q.x, y: b.y + q.y };
      const hit = r.positionFromPointer({ clientX: at.x, clientY: at.y });
      if (document.elementFromPoint(at.x, at.y) === r.canvas && hit?.x === x && hit?.y === y) return at;
    }
    return null;
  });
  assert.ok(p, 'empty space exposed beside the detail card'); await page.touchscreen.tap(p.x, p.y);
  assert.equal(await page.locator('#unit-inspect').isVisible(), false);
}
async function inspect(page, id, name, expected = null, hero = false) {
  const before = await state(page), g = await touch(page, await point(page, id));
  await page.waitForTimeout(480); await g.end();
  assert.equal(await page.locator('#unit-inspect').isVisible(), true);
  assert.deepEqual(combat(await state(page)), combat(before), 'long press details preserve combat');
  const details = await page.locator('#unit-inspect').innerText();
  const layering = await page.locator('#unit-inspect').evaluate(el => {
    const b = el.getBoundingClientRect(), x = b.x + b.width - 24, y = b.y + 30;
    return el.contains(document.elementFromPoint(x, y));
  });
  assert.equal(layering, true, 'card art owns its input above overlapping HUD controls');
  await shot(page, name);
  const control = hero ? page.locator('#unit-inspect .inspect-ability').filter({ hasText: /^状态$/ })
    : page.locator('#unit-inspect .inspect-unit-rule').first();
  if (expected) assert.equal(await control.isVisible(), true, 'state explanation has a real touch control');
  if (await control.isVisible()) {
    if (/frozen-detail|spent-detail/.test(name)) {
      const label = (await control.innerText()).trim();
      assert.ok(label.length <= 16, 'current status and native keyword use short labels on the card');
      assert.match(label, /frozen-detail/.test(name) ? /眩晕|冻结/ : /已行动/);
    }
    const button = await control.boundingBox();
    assert.ok(button.width >= 44 && button.height >= 44, 'rule/status touch control is at least 44px');
    await control.tap(); await page.locator('.hero-effect-dialog').waitFor({ state: 'visible' });
    const copy = await page.locator('.hero-effect-copy').innerText();
    if (expected) assert.match(copy, expected, 'reader explains the actual current status');
    const box = await page.locator('.hero-effect-dialog').boundingBox(), viewport = page.viewportSize();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, 'effect reader fits viewport');
    await shot(page, name + '-rules');
    if (hero) {
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.hero-effect-back').evaluate(el => el === document.activeElement), true, 'reader has a keyboard path to Back');
      await shot(page, name + '-rules-keyboard-focus');
    }
    await page.locator('.hero-effect-back').tap();
    assert.equal(await page.locator('.hero-effect-dialog').count(), 0);
    assert.equal(await control.evaluate(el => el === document.activeElement), true, 'reader restores focus to its opener');
    assert.deepEqual(combat(await state(page)), combat(before), 'reader/back never issue combat commands');
    await writeFile(new URL(name + '-detail.json', out), JSON.stringify({ details, copy, box }, null, 2));
  }
  await closeDetail(page);
}
async function feedback(page, f, name) {
  const layout = await page.evaluate(() => ({ rows: structuredClone(window.__renderer.unitFeedbackLayout), badges: structuredClone(window.__renderer.encounterBadgeLayout), state: structuredClone(window.__renderer.state) }));
  assert.equal(layout.rows.length, layout.state.units.length, 'every dense unit has a visible stats pass');
  const rects = [];
  for (const row of layout.rows) {
    const u = layout.state.units.find(u => u.unitId === row.unitId);
    assert.ok(u); assert.equal(row.stats.length, 2);
    assert.equal(row.stats.find(r => r.kind === 'health').value, u.health);
    const attack = engine.effectiveAttack(layout.state, u);
    assert.equal(row.stats.find(r => r.kind === 'attack').value, attack);
    for (const r of row.stats) {
      assert.ok(r.width >= 18 && r.height >= 18, 'dense attack/health keeps readable icon size');
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= page.viewportSize().width && r.y + r.height <= page.viewportSize().height, 'dense stats stay inside viewport');
      rects.push({ ...r, unitId: row.unitId });
    }
  }
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, `unit ${a.unitId}/${b.unitId} numerical stats never overlap`);
  }
  assert.ok(layout.rows.find(r => r.unitId === f.ids.frozen).indicators.all.some(r => r.kind === 'frozen'));
  assert.ok(layout.rows.find(r => r.unitId === f.ids.spent).indicators.all.some(r => r.kind === 'resting'));
  assert.ok(layout.rows.find(r => r.unitId === f.ids.guard).indicators.all.some(r => r.kind === 'provoke'));
  await writeFile(new URL(name + '-initial-feedback.json', out), JSON.stringify(layout, null, 2));
}
async function hud(page, name) {
  const layout = await page.evaluate(() => {
    const rect = element => { const b = element.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
    const nodes = ['.general-player', '.general-enemy', '.turn-marker', '#objective-open', '#end-turn'];
    return { boxes: nodes.flatMap(selector => { const el = document.querySelector(selector); return el ? [{ selector, ...rect(el) }] : []; }),
      labels: ['#turn-label', '#phase-label'].map(selector => { const el = document.querySelector(selector); return { selector, text: el.textContent, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, ...rect(el) }; }) };
  });
  const target = layout.boxes.find(b => b.selector === '#objective-open');
  assert.ok(target.width >= 44 && target.height >= 44 && target.x >= 0 && target.x + target.width <= page.viewportSize().width, 'objective touch target fits short viewport and is 44px');
  const turn = layout.boxes.find(b => b.selector === '.turn-marker');
  assert.ok(turn.x + turn.width <= target.x + 1, 'turn and objective columns never overlap');
  const player = layout.boxes.find(b => b.selector === '.general-player'), enemy = layout.boxes.find(b => b.selector === '.general-enemy');
  assert.ok(player.x + player.width <= turn.x + 1 && target.x + target.width <= enemy.x + 1, 'center HUD fits between both general panels');
  for (const label of layout.labels) assert.ok(label.scrollWidth <= label.clientWidth + 1, `${label.selector} full current text fits its column`);
  await writeFile(new URL(name + '-hud.json', out), JSON.stringify(layout, null, 2));
  await page.locator('#objective-open').tap(); await page.locator('#objective-close').waitFor({ state: 'visible' });
  await shot(page, name + '-objective'); await page.locator('#objective-close').tap(); await ready(page);
}
async function attack(page, sourceId, targetId) {
  await tapUnit(page, sourceId);
  const before = await state(page), expected = structuredClone(before);
  assert.ok(attackUnit(expected, sourceId, targetId, 0), 'isolated expected engine attack is legal');
  await tapUnit(page, targetId); await ready(page);
  assert.deepEqual(outcome(await state(page)), outcome(expected), 'real taps commit exactly one expected attack');
}
async function move(page, sourceId, x, y, name) {
  const before = await state(page), u = before.units.find(u => u.unitId === sourceId);
  assert.ok(movementPath(before, u, x, y).length, 'fixture movement is legal');
  const g = await touch(page, await point(page, sourceId)); await g.move(await cell(page, x, y));
  const preview = await page.evaluate(() => window.__drawOptions.movementPreview);
  assert.ok(preview?.path?.length, 'real touch drag renders a movement preview');
  await shot(page, name + '-preview'); await g.end(); await ready(page);
  const actual = (await state(page)).units.find(u => u.unitId === sourceId);
  assert.deepEqual([actual.x, actual.y], [x, y]);
  await shot(page, name + '-after');
}

try {
  const combos = args.includes('--baseline-only') ? [[568, 320, 'reduce'], [844, 390, 'no-preference']]
    : [[568, 320, 'reduce'], [568, 320, 'no-preference'], [844, 390, 'reduce'], [844, 390, 'no-preference']];
  for (const [width, height, motion] of combos) {
    const f = fixture(args.includes('--details-only') ? 'long-round' : 'dense'), { context, page } = await open(f, width, height, motion);
    const name = `${width}x${height}-${motion}`;
    await shot(page, name + '-dense');
    await writeFile(new URL(name + '-state.json', out), JSON.stringify(await state(page), null, 2));
    report.checks.push(`${name}: validated dense campaign fixture resumed through menu`);
    if (!args.includes('--baseline-only')) {
      await feedback(page, f, name);
      await tapUnit(page, f.ids.ally); assert.equal((await state(page)).selectedUnitId, f.ids.ally);
      await shot(page, name + '-selected');
      await inspect(page, f.ids.object, name + '-enemy-detail', /不可移动|固定在当前格|剩余3次/);
      await inspect(page, f.ids.frozen, name + '-frozen-detail', /跳过1个自身回合|无法移动和攻击/);
      await inspect(page, f.ids.spent, name + '-spent-detail', /移动和攻击机会已用完/);
      await inspect(page, f.ids.guard, name + '-provoke-detail', /嘲讽/);
      await inspect(page, f.ids.general, name + '-hero-status', /当前没有额外状态/, true);
      await hud(page, name);
      report.checks.push(`${name}: real selection, mechanism/frozen/spent/provoke long press, effect reader/back and empty-space dismissal`);
      if (args.includes('--details-only')) { await context.close(); continue; }
      // Enemy dragging deliberately does not attack under the current tap-to-attack contract.
      const before = await state(page), g = await touch(page, await point(page, f.ids.ally));
      await g.move(await point(page, f.ids.blocker)); await shot(page, name + '-drag-enemy'); await g.end();
      assert.deepEqual(combat(await state(page)), combat(before), 'drag to enemy does not attack');
      await attack(page, f.ids.ally, f.ids.blocker); await shot(page, name + '-attack-partial');
      assert.equal(await page.evaluate(id => window.__renderer.unitRestingAfterAction(window.__renderer.state.units.find(u => u.unitId === id)), f.ids.ally), false);
      await attack(page, f.ids.guard, f.ids.blocker);
      assert.equal((await state(page)).units.some(u => u.unitId === f.ids.blocker), false, 'two real attacks remove adjacent provoke');
      await move(page, f.ids.general, 0, 2, name + '-general-move');
      await move(page, f.ids.ally, 1, 2, name + '-ally-move');
      assert.equal(await page.evaluate(id => window.__renderer.unitRestingAfterAction(window.__renderer.state.units.find(u => u.unitId === id)), f.ids.ally), true);
      await shot(page, name + '-spent-after-input');
      const round = (await state(page)).round;
      await page.locator('#end-turn').tap();
      await page.waitForFunction(round => window.__renderer.state.round > round && window.__renderer.state.currentPlayer === 0 && !document.querySelector('#end-turn').disabled, round, { timeout: 30000 });
      await ready(page); await shot(page, name + '-next-turn');
      const next = await state(page), refreshed = next.units.find(u => u.unitId === f.ids.ally);
      assert.ok(refreshed, 'acted ally survives AI turn');
      assert.equal(refreshed.moved, false); assert.equal(refreshed.attacked, false);
      assert.equal(await page.evaluate(id => window.__renderer.unitRestingAfterAction(window.__renderer.state.units.find(u => u.unitId === id)), f.ids.ally), false);
      await tapUnit(page, f.ids.ally); assert.equal((await state(page)).selectedUnitId, f.ids.ally);
      await shot(page, name + '-next-turn-reselected');
      report.checks.push(`${name}: enemy drag leaves combat intact; real general/ally drag movement, two exact tap attacks, partial/full action state, AI end turn refresh and reselection`);
      const layout = await page.evaluate(() => {
        const r = window.__renderer;
        return { unitFeedbackLayout: r.unitFeedbackLayout, unitStatsLayout: r.unitStatsLayout, encounterBadgeLayout: r.encounterBadgeLayout,
          viewport: r.battlefieldViewport(innerWidth, innerHeight), documentOverflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(layout.documentOverflow, false, 'no document horizontal overflow');
      await writeFile(new URL(name + '-layout.json', out), JSON.stringify(layout, null, 2));
    }
    await context.close();
  }
  if (!args.includes('--baseline-only') && !args.includes('--details-only')) {
    for (const [width, height, motion] of [[568, 320, 'reduce'], [844, 390, 'no-preference']]) {
      const { context, page } = await open(fixture('long-round'), width, height, motion);
      await shot(page, `${width}x${height}-${motion}-long-round`);
      await hud(page, `${width}x${height}-${motion}-long-round`);
      report.checks.push(`${width} ${motion}: long round 10/10 remains within the safe center HUD, both general panels clear, 44px objective real touch`);
      await context.close();
    }
  }
  if (!args.includes('--baseline-only') && !args.includes('--dense-only') && !args.includes('--details-only')) {
    for (const [kind, width, height, motion] of [['win', 568, 320, 'reduce'], ['loss', 844, 390, 'no-preference']]) {
      const f = fixture(kind), { context, page } = await open(f, width, height, motion);
      if (kind === 'win') await attackTerminal(page, f.ids.general, f.ids.enemyGeneral);
      else {
        await page.locator('#end-turn').tap();
        await page.locator('#game-result').waitFor({ state: 'visible', timeout: 30000 });
      }
      assert.equal((await state(page)).winner, kind === 'win' ? 0 : 1);
      assert.match(await page.locator('#result-title').innerText(), kind === 'win' ? /胜利/ : /战败/);
      await shot(page, `${kind}-${width}-result`);
      await page.locator('#back-to-lobby').tap();
      await page.locator('#expedition-home').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#match').isVisible(), false);
      await shot(page, `${kind}-${width}-returned-camp`);
      report.checks.push(`${width} ${motion}: real ${kind === 'win' ? 'lethal tap attack' : 'end-turn/AI defeat'} result and touch return to camp`);
      await context.close();
    }
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.errors.push(String(error));
  const page = browser.contexts().at(-1)?.pages().at(-1);
  if (page) await shot(page, 'failure').catch(() => {});
  throw error;
} finally {
  await browser.close();
  report.passed = report.errors.length === 0;
  await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

async function attackTerminal(page, sourceId, targetId) {
  await tapUnit(page, sourceId); await tapUnit(page, targetId);
  await page.locator('#game-result').waitFor({ state: 'visible' });
}
