import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as G from '../js/game.js';
import { MECHANIC_LESSONS, itemLessonKeys } from '../js/lessons.js';

const clone = x => JSON.parse(JSON.stringify(x));
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
function setup() {
  const s = G.newRun(); s.day = 4; s.money = 1000; s.tutorial = true;
  s.shelf = []; s.mkt = { food: 1, drink: 1, material: 1, tech: 1, treasure: 1, toy: 1, ban: 1 };
  return s;
}
function seeded(seed, fn) {
  const original = Math.random;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  try { return fn(); } finally { Math.random = original; }
}
const seller = item => ({ kind: 'sell', who: 'worker', item, ask: 1000, res: 500, pat: 3, checks: [null, null, null], bad: 1 });

test('six first-encounter explanations expose only short data and item matching is side-effect free', () => {
  assert.deepEqual(Object.keys(MECHANIC_LESSONS).sort(), ['inspection', 'stolen', 'contraband', 'counterfeit', 'water', 'impostor'].sort());
  for (const lesson of Object.values(MECHANIC_LESSONS)) {
    assert.equal(typeof lesson.title, 'string'); assert(lesson.title.length > 0);
    assert(lesson.points.length > 0 && lesson.points.length <= 3);
    assert(lesson.points.every(point => typeof point === 'string' && point.length > 0 && point.length <= 52));
  }
  const it = { id: 'chip', stolen: true, stolenKnown: true, fake: true, known: true };
  const before = clone(it); itemLessonKeys(it); assert.deepEqual(it, before);
  assert.deepEqual(itemLessonKeys(null), []); assert.deepEqual(itemLessonKeys({ id: 'missing' }), []);
});

test('unknown theft and counterfeit facts cannot trigger explanations', () => {
  const publicItem = { id: 'scrap', known: false, stolenKnown: false };
  for (const fake of [false, true]) for (const stolen of [false, true]) {
    assert.deepEqual(itemLessonKeys({ ...publicItem, fake, stolen }), []);
  }
  assert.deepEqual(itemLessonKeys({ id: 'scrap', known: true, fake: false, stolenKnown: true, stolen: false }), []);
});

test('visible item tags trigger in theft, contraband, counterfeit, water priority', () => {
  assert.deepEqual(itemLessonKeys({ id: 'chip', stolen: true, stolenKnown: true, fake: true, known: true }), ['stolen', 'contraband', 'counterfeit']);
  assert.deepEqual(itemLessonKeys({ id: 'chip', stolen: true, fake: true }, { stolenVisible: true }), ['stolen', 'contraband']);
  assert.deepEqual(itemLessonKeys({ id: 'water', stolen: true, stolenKnown: true, fake: true, known: true }), ['stolen', 'counterfeit', 'water']);
  assert.deepEqual(itemLessonKeys({ id: 'chip', fake: true, stolen: true }), ['contraband']);
});

test('water explanation is independent of hidden quality, fraud, labels and customer identity', () => {
  for (let g = 0; g <= 5; g++) for (const fake of [false, true]) for (const lab of [null, 0, 5]) {
    assert.deepEqual(itemLessonKeys({ id: 'water', g, fake, lab, known: false, stolen: true, stolenKnown: false }), ['water']);
  }
  assert(!itemLessonKeys({ id: 'scrap', robo: true }).includes('impostor'));
});

test('shelf and hidden stolen goods cool each night while contraband stays contraband', () => {
  const s = setup(), shelf = G.mkItem('scrap', { stolen: true, heat: 2 }), hidden = G.mkItem('chip', { stolen: true, heat: 1 });
  s.shelf.push(shelf); s.hidden.push(hidden); s.hiddenCap = 1;
  G.sleep(); assert.equal(shelf.heat, 1); assert(shelf.stolen);
  assert.equal(hidden.heat, 0); assert.equal(hidden.stolen, false); assert(G.isBan(hidden));
  assert.deepEqual(itemLessonKeys(hidden), ['contraband']);
  G.sleep(); assert.equal(shelf.stolen, false); assert.equal(shelf.heat, 0); assert.equal(s.st.cooled, 2);
});

test('inspection confiscates exposed stolen or banned goods and preserves hidden goods', () => {
  const s = setup(), stolen = G.mkItem('scrap', { stolen: true, heat: 2 }), banned = G.mkItem('chip');
  const safe = G.mkItem('can'), hidden = G.mkItem('chip', { stolen: true, heat: 3 });
  s.shelf.push(stolen, banned, safe); s.hidden.push(hidden);
  const result = G.inspect(); assert.deepEqual(result.found, [stolen, banned]); assert(result.fine > 0);
  const cash = s.money; G.acceptFine(result); assert.equal(s.money, cash - result.fine);
  assert.deepEqual(s.shelf, [safe]); assert.deepEqual(s.hidden, [hidden]);
});

test('exposed heat raises police visits and moving the same heat to hidden storage avoids that increase', () => {
  const base = setup(); base.shelf.push(G.mkItem('scrap', { q: 1 }));
  let clean = 0, hot = 0, hidden = 0;
  for (let seed = 1; seed <= 96; seed++) {
    const visit = (mode) => seeded(seed * 113, () => {
      const s = clone(base); G.setState(s);
      if (mode !== 'clean') Object.assign(s.shelf[0], { stolen: true, heat: 9 });
      if (mode === 'hidden') { s.hidden.push(s.shelf.pop()); s.hiddenCap = 1; }
      return Number(G.startDay().some(c => c.kind === 'police'));
    });
    clean += visit('clean'); hot += visit('hot'); hidden += visit('hidden');
  }
  assert(hot > clean, `hot:${hot}, clean:${clean}`); assert.equal(hidden, clean);
});

test('a suggested inspection location can be normal and one normal result does not clear other faults', () => {
  setup(); const real = seller(G.mkItem('yarn', { q: 1 }));
  assert.equal(G.checkSpot(real, G.itemClue(real).index).res, 'ok'); assert.equal(real.pat, 2);
  const fake = seller(G.mkItem('yarn', { fake: true }));
  assert.equal(G.checkSpot(fake, 0).res, 'ok'); assert.equal(fake.item.fake, true); assert.equal(fake.checks[1], null);
  assert.deepEqual(itemLessonKeys(fake.item), []);
  assert.equal(G.checkSpot(fake, 1).res, 'fake'); assert(fake.exposed);
});

test('checking a new location shares patience, repeat checks are free and the lens exempts one new check', () => {
  const s = setup(), c = seller(G.mkItem('can'));
  G.checkSpot(c, 0); assert.equal(c.pat, 2); assert(G.checkSpot(c, 0).free); assert.equal(c.pat, 2);
  s.up.lens = true; G.checkSpot(c, 1); assert.equal(c.pat, 2);
  G.checkSpot(c, 2); assert.equal(c.pat, 1);
});

test('counterfeit discovery reprices the seller and a detecting buyer cannot complete a sale', () => {
  const s = setup(), item = G.mkItem('painting', { fake: true, q: 1 }), c = seller(item);
  assert.equal(G.trueValue(item), 63); assert.equal(G.lookValue(item), 420);
  G.checkSpot(c, 1); assert.equal(c.ask, 82); assert.equal(c.res, 50);
  assert(G.buyItem(c, c.ask)); assert.deepEqual(itemLessonKeys(item), ['counterfeit']);
  const buyer = { kind: 'buy', who: 'noble', want: 'treasure', rich: 1, eye: 1, pat: 3 };
  G.buyerLooks(buyer, item); assert(buyer.caught);
  const before = clone(s); assert.equal(G.sellItem(buyer, 99), false); assert.deepEqual(s, before);
});

test('water label changes no real grade, testing reveals the grade and exposes an overstated label', () => {
  const s = setup(), water = G.mkItem('water', { g: 2, lab: 5, q: 1 }), c = seller(water); c.bad = 2;
  const value = G.trueValue(water); assert.equal(G.grade(water), 2); assert.equal(G.shownG(water), 5);
  assert.equal(G.checkSpot(c, 2).res, 'fake'); assert(water.gk); assert.equal(water.g, 2);
  assert.equal(water.lab, null); assert.equal(G.trueValue(water), value); assert.equal(c.pat, 2);
  s.owned.labeler = true; assert(G.labelWater(water)); assert.equal(water.g, 2); assert.equal(water.lab, 5);
});

test('observing new parts consumes shared patience, repeat observation is free and normal evidence is inconclusive', () => {
  setup(); const c = { robo: true, roboBad: 2, obs: [null, null, null], pat: 3 };
  assert.equal(G.observe(c, 0).bad, false); assert.equal(c.pat, 2); assert(c.robo);
  assert(G.observe(c, 0).free); assert.equal(c.pat, 2);
  assert.equal(G.observe(c, 2).bad, true); assert.equal(c.pat, 1);
  const real = { robo: false, obs: [null, null, null], pat: 3 };
  assert.equal(G.observe(real, 1).bad, false); assert.equal(real.pat, 2);
});

test('correct report pays bounty, false report loses reputation, and impostor sale cash disappears next morning', () => {
  const s = setup(), cash = s.money; assert(G.report({ robo: true, who: 'worker' }).ok);
  assert(s.money > cash); assert.equal(s.rep.law, 2);
  assert.equal(G.report({ robo: false, who: 'worker' }).ok, false);
  assert.equal(s.rep.folk, -2); assert.equal(s.rep.law, 1);
  const item = G.mkItem('scrap'); s.shelf.push(item);
  const buyer = { item, who: 'worker', robo: true }, before = s.money;
  assert(G.sellItem(buyer, 25)); assert.equal(s.money, before + 25); assert.equal(s.fakeCash, 25);
  G.sleep(); assert.equal(G.voidFakeCash(), 25); assert.equal(s.money, before); assert.equal(s.fakeCash, 0);
});

// Execute unchanged main control flow with isolated storage and modal scheduling.
// This verifies lifecycle decisions, not browser focus, layout or actual input.
const mainSource = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
function declaration(name) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(mainSource);
  assert(match, `main function ${name} exists`);
  const tail = mainSource.slice(match.index), end = /\r?\n}\r?\n/.exec(tail);
  assert(end); return tail.slice(0, end.index + end[0].indexOf('}') + 1);
}
function lessonUI(saved = {}) {
  const tasks = [], modals = [], writes = [], screen = {}, meta = { mechanicSeen: clone(saved) };
  const context = {
    G, MECHANIC_LESSONS, meta, protectedRun: false, busy: false, lessonQueued: false,
    mask: null, screen, title: false, metaSaveIssue: '', META_KEY: 'isolated-meta',
    queueMicrotask: fn => tasks.push(fn), showSaveIssue() {}, refreshHud() {}, D: {},
    store: { set: (_key, value) => { writes.push(clone(value)); return true; } },
    stage: { querySelector: selector => selector === '.mask' ? context.mask : selector === '.screen' ? context.screen : selector === '.title' ? context.title : null },
    modal: (_build, options) => { const record = { options }; modals.push(record); context.mask = record; },
  };
  vm.createContext(context);
  // saveMeta is an expression declaration; use its exact production statement.
  const saveLine = mainSource.split(/\r?\n/).find(line => line.startsWith('const saveMeta = '));
  assert(saveLine); vm.runInContext(saveLine, context);
  for (const name of ['showMechanicLesson', 'queueMechanicLesson', 'openObserve']) vm.runInContext(declaration(name), context);
  const flush = () => { let count = 0; while (tasks.length) { assert(count++ < 30); tasks.shift()(); } };
  const close = () => { const active = context.mask; assert(active); context.mask = null; active.options?.onClose?.(); };
  return { context, meta, modals, writes, flush, close };
}

test('a lesson is remembered only on acknowledgement and remains remembered after a simulated reload', () => {
  setup(); const ui = lessonUI();
  assert(ui.context.showMechanicLesson('stolen')); assert.equal(ui.meta.mechanicSeen.stolen, undefined);
  assert.equal(ui.writes.length, 0);
  const interrupted = lessonUI(); assert(interrupted.context.showMechanicLesson('stolen'));
  ui.close(); assert.equal(ui.meta.mechanicSeen.stolen, true);
  assert.equal(ui.writes.at(-1).mechanicSeen.stolen, true);
  const reloaded = lessonUI(ui.writes.at(-1).mechanicSeen);
  assert.equal(reloaded.context.showMechanicLesson('stolen'), false); assert.equal(reloaded.modals.length, 0);
});

test('one render shows one priority lesson without a closing cascade, and later renders can show the next', () => {
  setup(); const ui = lessonUI();
  ui.context.queueMechanicLesson(['stolen', 'water', 'inspection']);
  ui.context.queueMechanicLesson(['stolen', 'water']); ui.flush(); assert.equal(ui.modals.length, 1);
  ui.close(); ui.flush(); assert.equal(ui.modals.length, 1); assert.equal(ui.meta.mechanicSeen.stolen, true);
  assert.equal(ui.meta.mechanicSeen.water, undefined);
  ui.context.queueMechanicLesson(['stolen', 'water', 'inspection']); ui.flush(); ui.close();
  assert.equal(ui.meta.mechanicSeen.water, true); assert.equal(ui.modals.length, 2);
});

test('another modal, busy departure or a protected save never receives an overlapping lesson', () => {
  setup();
  for (const block of ['mask', 'busy', 'protectedRun']) {
    const ui = lessonUI(); ui.context[block] = block === 'mask' ? {} : true;
    ui.context.queueMechanicLesson(['inspection']); ui.flush();
    assert.equal(ui.modals.length, 0); assert.equal(ui.meta.mechanicSeen.inspection, undefined); assert.equal(ui.writes.length, 0);
  }
});

test('queued lessons are discarded after the run, day, customer, screen or title changes', () => {
  const changes = [() => G.newRun(), () => G.S.day++, () => G.S.qi++, ui => ui.context.screen = {}, ui => ui.context.title = true];
  for (const change of changes) {
    setup(); const ui = lessonUI(); ui.context.queueMechanicLesson(['inspection']); change(ui); ui.flush();
    assert.equal(ui.modals.length, 0); assert.equal(ui.writes.length, 0);
  }
});

test('first observation teaches without consuming patience, then resumes only the same customer', () => {
  const s = setup(), c = seller(G.mkItem('scrap')); s.queue = [c]; s.qi = 0;
  const ui = lessonUI(); let redraws = 0;
  ui.context.openObserve(c, () => redraws++); assert.equal(ui.modals.length, 1);
  assert.equal(c.obs, undefined); assert.equal(c.pat, 3);
  ui.close(); assert.equal(ui.writes.at(-1).mechanicSeen.impostor, true); ui.flush();
  assert.equal(ui.modals.length, 2); assert.deepEqual(Array.from(c.obs), [null, null, null]); assert.equal(c.pat, 3);
  ui.close(); assert.equal(redraws, 1); assert.equal(c.pat, 3);
  const next = seller(G.mkItem('can')); s.queue = [next];
  const stale = lessonUI(); stale.context.openObserve(next, () => {}); stale.close(); s.qi = 1; stale.flush();
  assert.equal(stale.modals.length, 1, 'acknowledging must not open observation for a departed customer');
});

console.log(`${checks} lesson behavior groups passed`);
