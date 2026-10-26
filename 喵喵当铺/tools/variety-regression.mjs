import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as G from '../js/game.js';
import { ITEMS, CATS, SELLERS, BUYERS, CRATES, MACHINES, PHONE_CONTACTS, NEWS, FEATURED_VISITS } from '../js/data.js';

const clone = x => JSON.parse(JSON.stringify(x));
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
function rng(seed, fn) {
  const original = Math.random;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  try { return fn(); } finally { Math.random = original; }
}
function constant(value, fn) { const original = Math.random; Math.random = () => value; try { return fn(); } finally { Math.random = original; } }
function setup(tier = 1) {
  const s = G.newRun();
  s.day = [0, 2, 3, 6, 10][tier]; s.st.buy = [0, 0, 6, 12, 20][tier];
  s.money = 10000; s.tutorial = true; G.contentTier();
  return s;
}
function roundtrip() { const saved = clone(G.S); G.setState(saved); return saved; }
function booking(template, day) {
  const { id, kind, who, item, line, premium } = template;
  return { day, id, kind, who, item, qty: template.qty || 1, line, ...(premium === undefined ? {} : { premium }) };
}
function visit(template, tier = template.tier) {
  const s = setup(tier);
  s.variety.next = booking(template, s.day);
  G.startDay();
  const c = s.queue.find(c => c.visitId === template.id);
  assert(c, template.id); s.qi = s.queue.indexOf(c);
  return { s, c };
}

test('content stages require both day and completed trades and remain latched after reload', () => {
  const s = G.newRun(); s.day = 30; assert.equal(G.contentTier(), 1);
  assert.deepEqual(G.nextContentUnlock(), { tier: 2, day: 3, trades: 6, remainingTrades: 6, label: '码头与夜市的新客、新货' });
  s.day = 2; s.st.buy = 20; assert.equal(G.contentTier(), 1);
  s.day = 3; assert.equal(G.contentTier(), 2); s.day = 6; assert.equal(G.contentTier(), 3);
  s.day = 10; assert.equal(G.contentTier(), 4); assert.equal(G.nextContentUnlock(), null);
  const saved = roundtrip(); saved.day = 2; saved.st.buy = 0;
  assert.equal(G.contentTier(), 4); assert.equal(G.validateVariety(saved.variety), true);
});

test('all generated sellers, buyers, goods, appraisals, crates and phone packages respect their stage', () => {
  const seen = new Set();
  for (let tier = 1; tier <= 4; tier++) for (let seed = 1; seed <= 120; seed++) rng(seed + tier * 991, () => {
    const s = setup(tier); s.up.appraisal_certificate = true; G.ensureGrowth().appraisalDisplay = true;
    G.startDay();
    for (const c of s.queue) {
      assert((CATS[c.who].tier || 1) <= tier, `${c.who} stage ${tier}`);
      if (c.visitId) assert(!c.robo, 'booked visitors cannot be replaced by impostors');
      if (c.item) { assert((ITEMS[c.item.id].tier || 1) <= tier); seen.add(c.item.id); }
      if (c.order) assert((ITEMS[c.order.id].tier || 1) <= tier);
    }
    s.owned.purifier = true; s.rep.gang = 2;
    for (const c of G.phoneContacts()) for (const p of c.packages) {
      assert((p.tier || 1) <= tier); assert(p.items.every(x => (ITEMS[x.id].tier || 1) <= tier));
    }
    G.startNight(); s.shelf = []; s.shelfCap = 100;
    // This fixture samples every crate's content; permission limits are tested separately.
    s.night.free = s.night.crates.length;
    for (let i = 0; i < s.night.crates.length; i++) { const r = G.openCrate(i); assert((ITEMS[r.id].tier || 1) <= tier); seen.add(r.id); }
    G.sleep(); assert((NEWS.find(n => n.id === s.nextNews).tier || 1) <= tier);
  });
  for (const [id, it] of Object.entries(ITEMS)) if (it.tier) assert(seen.has(id), `${id} has a real generation route`);
});

test('locked packages and machine upgrades refuse purchase while owned higher-stage goods keep working', () => {
  const s = setup(1); s.day = 2; s.st.buy = 4;
  const pkg = PHONE_CONTACTS.find(c => c.id === 'folk').packages.find(p => p.tier === 2);
  const cash = s.money; assert(!G.placePhoneOrder('folk', pkg.id).ok); assert.equal(s.money, cash);
  for (const id of ['smoker', 'repairbench', 'gemtable']) assert(!G.upgradeAvailable(id).ok);
  const item = G.mkItem('pendant'); s.shelf.push(item);
  const c = { kind: 'buy', who: 'noble', want: 'treasure', rich: 1.2, eye: .75, pat: 3 };
  assert(G.buyerLooks(c, item)); assert(G.sellItem(c, 10));
  s.owned.repairbench = true; s.machines.repairbench = null;
  const raw = G.mkItem('brokenconsole'); s.shelf.push(raw);
  assert.equal(G.runMachine('repairbench', { uids: [raw.uid] }), 1);
  G.sleep(); G.sleep(); assert(s.shelf.some(it => it.id === 'console'));
});

test('ordinary visitors avoid duplicate faces and repeat goods are downweighted', () => {
  const s = setup(2);
  constant(.99, () => G.startDay());
  const ordinary = s.queue.filter(c => !c.visitId && ['buy', 'sell'].includes(c.kind));
  assert.equal(new Set(ordinary.map(c => c.who)).size, ordinary.length);
  const frequencies = recent => {
    let repeated = 0;
    for (let seed = 1; seed <= 180; seed++) rng(seed * 83, () => {
      const s = setup(1); s.sign = 'neon'; s.variety.recentGoods = recent;
      G.startDay(); repeated += s.queue.filter(c => c.kind === 'sell' && !c.visitId && c.item.id === 'scrap').length;
    });
    return repeated;
  };
  assert(frequencies(Array(10).fill('scrap')) < frequencies([]), 'recent scrap must become less common');
});

test('an empty shop receives affordable genuine supply, and stocked hot goods attract a usable buyer without extra slots', () => {
  const empty = setup(1); empty.shelf = []; empty.money = 5;
  constant(.99, () => G.startDay());
  assert.equal(empty.queue.length, 6); assert.equal(empty.queue.filter(c => c.visitId).length, 1);
  const supply = empty.queue.find(c => c.kind === 'sell' && !c.item.fake && !c.item.stolen && !G.fakeish(c.item) && c.ask <= empty.money);
  assert(supply); assert(G.buyItem(supply, supply.ask));
  const stocked = setup(2); stocked.day = 4; stocked.sign = 'neon'; stocked.shelf = [G.mkItem('smokedfish')]; stocked.mkt.smokedfish = 1.4;
  constant(.99, () => G.startDay());
  assert.equal(stocked.queue.length, 6);
  assert(stocked.queue.some(c => c.kind === 'buy' && G.wants(c, stocked.shelf[0])));
});

test('night booking is immutable, survives stock changes and reload, and replaces one ordinary slot', () => {
  const s = setup(1); s.day = 3; G.startDay(); G.startNight();
  const promise = G.nextVisit(), raw = JSON.stringify(s.variety.next);
  s.shelf = []; s.money = 1;
  assert.deepEqual(G.nextVisit(), promise); assert.equal(JSON.stringify(s.variety.next), raw);
  const night = clone(s.night); G.startNight(); assert.deepEqual(s.night, night);
  roundtrip(); assert.deepEqual(G.nextVisit(), promise);
  G.sleep(); constant(.99, () => G.startDay());
  const actual = G.S.queue.filter(c => c.visitId);
  assert.equal(actual.length, 1); assert.equal(G.S.queue.length, 6);
  assert.equal(actual[0].visitId, promise.id); assert.equal(actual[0].who, promise.who);
  assert.equal(actual[0].kind, promise.kind);
  assert.equal(actual[0].kind === 'buy' ? actual[0].wantId : actual[0].kind === 'order' ? actual[0].order.id : actual[0].item.id, promise.item); assert(!actual[0].robo);
  assert(!Object.keys(promise).some(k => ['fake', 'bad', 'res', 'robo', 'stolen'].includes(k)));
  G.S.qi = G.S.queue.length; const queue = clone(G.S.queue);
  roundtrip(); G.startDay(); assert.deepEqual(G.S.queue, queue); assert.equal(G.S.qi, queue.length);
});

test('supply, precise purchase and order bookings rotate, and recent available templates are not repeated', () => {
  const s = setup(4), promises = [];
  for (let i = 0; i < 9; i++) { G.startNight(); const p = G.nextVisit(); promises.push(p); G.sleep(); G.startDay(); }
  assert.deepEqual(promises.map(p => p.kind), ['sell', 'buy', 'order', 'sell', 'buy', 'order', 'sell', 'buy', 'order']);
  for (let i = 1; i < promises.length; i++) assert.notEqual(promises[i].id, promises[i - 1].id);
  for (let i = 3; i < 6; i++) assert.notEqual(promises[i].id, promises[i - 3].id);
});

test('booked buyers require the precise product and still use water and counterfeit checks', () => {
  const t = FEATURED_VISITS.find(x => x.kind === 'buy' && x.item === 'smokedfish');
  const { s, c } = visit(t); const correct = G.mkItem('smokedfish'), wrong = G.mkItem('fish'); s.shelf = [correct, wrong];
  assert(G.wants(c, correct)); assert(!G.wants(c, wrong)); assert.equal(G.buyerLooks(c, wrong), null);
  assert(G.buyerLooks(c, correct)); assert.equal(c.rich, t.premium); assert(G.sellItem(c, c.bid));
  const money = s.money, rep = clone(s.rep); assert(!G.sellItem(c, c.bid)); assert.equal(s.money, money); assert.deepEqual(s.rep, rep);
  const water = G.mkItem('water', { g: 2, lab: 5 }), b = { kind: 'buy', who: 'noble', want: 'drink', wantId: 'water', minG: 4, rich: 1.5, eye: 1, pat: 3 };
  s.shelf.push(water); assert(G.wants(b, water)); G.buyerLooks(b, water); assert(b.caught); assert(!G.sellItem(b, b.bid));
  water.lab = null; assert(!G.wants(b, water));
});

test('appointment suppliers and buyers settle only once across save/reload', () => {
  const { s, c } = visit(FEATURED_VISITS.find(x => x.kind === 'sell'));
  s.shelf = []; assert(G.buyItem(c, c.ask)); const cash = s.money, count = s.st.buy;
  roundtrip(); const restored = G.current(); assert(restored.settled); assert(!G.buyItem(restored, restored.ask));
  assert.equal(G.S.money, cash); assert.equal(G.S.st.buy, count); const before = clone(G.S.queue); G.startDay(); assert.deepEqual(G.S.queue, before);
});

test('featured order accepts once, verifies actual selected goods, and rewards reputation once after reload', () => {
  const t = FEATURED_VISITS.find(x => x.kind === 'order' && CATS[x.who].fac);
  const { s, c } = visit(t), o = c.order;
  s.shelf = Array.from({ length: o.qty }, () => G.mkItem(o.id, { q: 1 }));
  assert(G.acceptOrder(o)); assert(c.settled); assert(!G.acceptOrder(o));
  const loaded = roundtrip(), order = loaded.orders[0], money = loaded.money, fac = CATS[t.who].fac, rep = loaded.rep[fac];
  assert(!G.acceptOrder(G.current().order)); assert.equal(loaded.orders.length, 1);
  assert(G.deliver(order, loaded.shelf.map(it => it.uid))); assert.equal(loaded.money, money + o.reward); assert.equal(loaded.rep[fac], Math.min(5, rep + 1));
  assert(!G.deliver(order)); assert(!G.acceptOrder(order));
  const paid = roundtrip(); assert(!G.acceptOrder(G.current().order)); assert.equal(paid.money, money + o.reward); assert.equal(paid.orders.length, 0);
});

test('orders reject unknown counterfeit or mislabeled low water atomically and remain deliverable through the due day', () => {
  for (const water of [false, true]) {
    const s = setup(2), item = G.mkItem(water ? 'water' : 'can', water ? { g: 2, lab: 5 } : { fake: true });
    s.shelf = [item]; const o = { id: item.id, qty: 1, due: s.day, reward: 100 }; assert(G.acceptOrder(o));
    assert(G.orderPlan(o, [item.uid]).ok); const before = JSON.stringify(s); assert(!G.deliver(o, [item.uid])); assert.equal(JSON.stringify(s), before);
    item.fake = false; if (water) { item.g = 3; item.lab = null; }
    assert(G.deliver(o, [item.uid])); assert(!G.deliver(o));
  }
  const s = setup(2), item = G.mkItem('can'); s.shelf = [item];
  const o = { id: 'can', qty: 1, due: s.day, reward: 100 }; assert(G.acceptOrder(o)); s.day++;
  const before = JSON.stringify(s); assert(!G.deliver(o)); assert.equal(JSON.stringify(s), before);
  assert.deepEqual(G.expireOrders(), [o]); assert(!G.acceptOrder(o)); assert.equal(s.shelf.length, 1);
});

test('three new machines consume selected real material, wait exact nights and retain overflow across reload', () => {
  for (const [mid, days] of [['smoker', 1], ['repairbench', 2], ['gemtable', 2]]) {
    let s = setup(4); s.owned[mid] = true; s.machines[mid] = null;
    const m = MACHINES[mid], input = G.mkItem(m.in[0]); s.shelf = [input]; s.shelfCap = 1;
    assert(G.productionPlan(mid, { uids: [input.uid] }).ok); assert.equal(G.runMachine(mid, { uids: [input.uid] }), 1); assert.equal(s.shelf.length, 0);
    s.shelf.push(G.mkItem('yarn'));
    for (let i = 0; i < days; i++) { G.sleep(); s = roundtrip(); }
    assert(s.machines[mid].ready); assert.equal(s.machines[mid].n, 1);
    G.collectMachines(); assert.equal(s.machines[mid].n, 1);
    G.removeItem(s.shelf[0]); const out = G.collectMachines(); assert.equal(out.length, 1); assert.equal(out[0].id, m.out[0]); assert.equal(s.machines[mid], null);
    assert.equal(G.collectMachines().length, 0); assert.equal(s.shelf.length, 1);
  }
});

test('market forecast is free state and successive days never repeat the same event', () => {
  const s = setup(4); s.nextNews = s.news;
  for (let day = 0; day < 40; day++) {
    const old = s.news, cash = s.money; G.startNight(); const forecast = s.nextNews;
    assert.notEqual(forecast, old); assert.equal(s.money, cash); G.sleep(); assert.equal(s.news, forecast); assert.notEqual(s.news, s.nextNews); G.startDay();
  }
});

test('legacy night forecast is honored even when it equals the current news', () => {
  const s = setup(1); delete s.variety; s.phase = 'night'; s.nextNews = s.news;
  const forecast = s.nextNews, cash = s.money; G.nextVisit(); G.startNight();
  assert.equal(s.nextNews, forecast); assert.equal(s.money, cash); roundtrip(); G.sleep();
  assert.equal(G.S.news, forecast); assert.notEqual(G.S.nextNews, forecast);
});

test('booked dialogue, quantity and premium remain saved snapshots across later template revisions', () => {
  const s = setup(4), t = FEATURED_VISITS.find(x => x.kind === 'order' && x.tier === 3);
  s.variety.next = { ...booking(t, s.day + 1), line: '这批旧镜组请按我们昨晚谈好的单子备齐。', qty: 2, premium: 1.4 };
  assert(G.validateVariety(s.variety)); const promise = G.nextVisit();
  roundtrip(); G.sleep(); G.startDay(); const c = G.S.queue.find(c => c.visitId === t.id);
  assert.equal(c.line, promise.line); assert.equal(c.order.qty, 2); assert.equal(c.order.reward, Math.round(ITEMS[t.item].v * 2 * 1.4));
});

test('legacy already-paid high-stage phone cargo remains collectible before content unlock', () => {
  let s = setup(4); s.rep.gang = 2;
  const t = PHONE_CONTACTS.find(c => c.id === 'black').packages.find(p => p.tier === 4);
  const order = G.placePhoneOrder('black', t.id); assert(order.ok);
  s = roundtrip(); delete s.variety; s.day = order.order.due; s.st.buy = s.st.sell = 0; s.shelf = []; s.shelfCap = 1;
  assert.equal(G.contentTier(), 1); assert.equal(G.collectPhoneDelivery(order.order.id).remaining, 1);
  s = roundtrip(); s.shelfCap++; assert.equal(G.collectPhoneDelivery(order.order.id).remaining, 0);
  assert(!G.collectPhoneDelivery(order.order.id).ok); assert(s.shelf.every(it => it.id === 'roughgem'));
});

test('legacy active customers, goods and jobs are preserved and continue through two JSON roundtrips', () => {
  for (const name of ['legacycontinue', 'patience-buyer', 'night-production-mixed-waters', 'order-selected-buyer']) {
    const raw = readFileSync(new URL(`./fixtures/growth-v2/${name}.json`, import.meta.url), 'utf8');
    const old = JSON.parse(raw); G.setState(clone(old)); delete G.S.variety;
    const queue = clone(G.S.queue), goods = clone(G.S.shelf), jobs = clone(G.S.machines), qi = G.S.qi;
    G.ensureVariety(); assert.deepEqual(G.S.shelf, goods); assert.deepEqual(G.S.machines, jobs);
    if (G.S.phase === 'day' && G.S.queue.length) { G.startDay(); assert.deepEqual(G.S.queue, queue); assert.equal(G.S.qi, qi); }
    G.startNight(); G.sleep(); roundtrip(); G.startDay(); G.startNight(); G.sleep(); roundtrip();
    assert.equal(G.S.v, 2); assert(G.S.day > old.day); assert(G.validateVariety(G.S.variety));
  }
});

test('unknown, malformed or forged variety extensions are rejected without changing the original record', () => {
  const base = setup(3); G.startNight(); const good = clone(base);
  for (const mutate of [
    s => s.variety.v = 99, s => s.variety.tier = 5, s => s.variety.rotation = -1,
    s => s.variety.recentGoods = ['invented'], s => s.variety.recentVisitors = ['__proto__'],
    s => s.variety.next.qty = 99, s => s.variety.next.item = 'painting',
    s => s.variety.dayStarted = '3', s => delete s.variety.current, s => s.variety.unrecognized = true,
  ]) {
    const s = clone(good); mutate(s); G.setState(s); const before = JSON.stringify(s);
    assert.throws(() => G.validateVariety(s.variety)); assert.throws(() => G.ensureVariety()); assert.throws(() => G.startDay());
    assert.throws(() => G.startNight()); assert.throws(() => G.ensureGrowth()); assert.equal(JSON.stringify(s), before);
  }
});

console.log(`${checks} variety behavior groups passed`);
